import type { Commute, PrivateRoom, ScoredVenue, SearchParams, Venue } from "./types";

const WEIGHTS = {
  capacity: 0.32,
  trust: 0.22,
  commute: 0.18,
  style: 0.1,
  price: 0.08,
  quality: 0.1,
};

const TRUST_SCORE = { verified: 1, likely: 0.55, unverified: 0.2 };

/** Capacity of a room for the requested style (reception counts standing room). */
function roomCapacityFor(room: PrivateRoom, style: SearchParams["style"]): number | null {
  if (style === "reception") return room.standing_capacity ?? room.seated_capacity;
  if (style === "seated_dinner") return room.seated_capacity;
  return Math.max(room.seated_capacity ?? 0, room.standing_capacity ?? 0) || null;
}

function venueMaxFor(venue: Venue, style: SearchParams["style"]): number | null {
  if (style === "reception") return venue.max_standing ?? venue.max_seated;
  if (style === "seated_dinner") return venue.max_seated;
  return Math.max(venue.max_seated ?? 0, venue.max_standing ?? 0) || null;
}

export function scoreVenue(
  venue: Venue,
  rooms: PrivateRoom[],
  commute: Commute | null,
  params: SearchParams
): ScoredVenue | null {
  const { headcount, maxMinutes, mode, style } = params;
  const why: string[] = [];

  // ----- capacity fit -----
  // Best room: the smallest space that still fits the group.
  const fitting = rooms
    .map((r) => ({ room: r, cap: roomCapacityFor(r, style) }))
    .filter((x): x is { room: PrivateRoom; cap: number } => x.cap != null && x.cap >= headcount)
    .sort((a, b) => a.cap - b.cap);
  const venueMax = venueMaxFor(venue, style);

  let capacity: number;
  let bestRoom: PrivateRoom | null = null;
  if (fitting.length > 0) {
    bestRoom = fitting[0].room;
    const cap = fitting[0].cap;
    const oversize = cap / headcount;
    capacity = oversize <= 2.2 ? 1 : oversize <= 4 ? 0.8 : 0.6;
    const capLabel =
      style === "reception" && bestRoom.standing_capacity != null
        ? `${bestRoom.standing_capacity} standing`
        : `seats ${cap}`;
    why.push(
      bestRoom.is_full_buyout
        ? `Full buyout fits ${headcount} (${capLabel})`
        : `"${bestRoom.name}" fits ${headcount} (${capLabel})`
    );
    if (oversize > 4) why.push("Space is much larger than the group — may feel empty");
  } else if (venueMax != null && venueMax >= headcount) {
    capacity = 0.75;
    why.push(`Total private capacity ~${venueMax} covers ${headcount}, exact room mix to confirm`);
  } else if (venueMax != null && venueMax >= headcount * 0.8) {
    capacity = 0.35;
    why.push(`Published capacity (${venueMax}) is tight for ${headcount} — worth a call`);
  } else if (venueMax != null) {
    // We know it's too small — drop it entirely.
    return null;
  } else if (venue.trust !== "unverified") {
    capacity = 0.3;
    why.push("Offers private dining but capacities aren't published — call to confirm size");
  } else {
    capacity = 0.15;
    why.push("Capacity unknown — needs a call");
  }

  // ----- commute -----
  let commuteScore: number;
  if (commute) {
    if (commute.duration_minutes > maxMinutes) return null;
    commuteScore = 1 - Math.pow(commute.duration_minutes / maxMinutes, 1.6) * 0.85;
    why.push(`${Math.round(commute.duration_minutes)} min ${mode === "driving" ? "drive" : "walk"}`);
  } else {
    commuteScore = 0.4; // in radius but no route found
  }

  // ----- trust -----
  const trustScore = TRUST_SCORE[venue.trust];
  if (venue.trust === "verified") why.push("Rooms & capacities verified on the venue's own site");
  else if (venue.trust === "unverified") why.push("Unverified — needs a call");

  // ----- style -----
  let styleScore = 0.5;
  if (style !== "any") {
    if (venue.event_styles.includes(style)) {
      styleScore = 1;
      if (style === "reception") why.push("Hosts standing receptions");
    } else if (venue.event_styles.length > 0) {
      styleScore = 0.25;
    }
  } else {
    styleScore = venue.event_styles.length > 0 ? 0.8 : 0.5;
  }

  // ----- price signal -----
  const priceScore = TRUST_SCORE[venue.price_trust];
  if (venue.price_trust === "verified") {
    if (venue.min_spend_low != null)
      why.push(`Minimum spend published: $${venue.min_spend_low.toLocaleString()}${venue.min_spend_high && venue.min_spend_high !== venue.min_spend_low ? `–$${venue.min_spend_high.toLocaleString()}` : ""}`);
    else if (venue.per_person_low != null)
      why.push(`Per-person pricing published: from $${venue.per_person_low}`);
  }

  // ----- quality (Google signal) -----
  let quality = 0.5;
  if (venue.google_rating != null) {
    quality = Math.max(0, Math.min(1, (venue.google_rating - 3.7) / 1.1));
    if ((venue.google_review_count ?? 0) < 50) quality *= 0.7;
    if (venue.google_rating >= 4.5 && (venue.google_review_count ?? 0) >= 300)
      why.push(`${venue.google_rating}★ (${venue.google_review_count} reviews)`);
  }

  const fit = { capacity, commute: commuteScore, trust: trustScore, price: priceScore, style: styleScore };
  const score =
    capacity * WEIGHTS.capacity +
    trustScore * WEIGHTS.trust +
    commuteScore * WEIGHTS.commute +
    styleScore * WEIGHTS.style +
    priceScore * WEIGHTS.price +
    quality * WEIGHTS.quality;

  return { venue, rooms, commute, score, fit, why, bestRoom };
}

export function rankVenues(
  entries: { venue: Venue; rooms: PrivateRoom[]; commute: Commute | null }[],
  params: SearchParams
): ScoredVenue[] {
  return entries
    .map((e) => scoreVenue(e.venue, e.rooms, e.commute, params))
    .filter((s): s is ScoredVenue => s !== null)
    .sort((a, b) => b.score - a.score);
}
