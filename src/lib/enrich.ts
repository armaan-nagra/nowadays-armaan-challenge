/**
 * Enrichment core, shared by the offline pipeline (scripts/pipeline/run.ts)
 * and the live "Scout this area" API route.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchPlaces, haversineMeters, type PlaceResult } from "./google";
import { fetchSiteContent } from "./site";
import { extractVenueFacts } from "./extract";
import { venueTrust, roomTrust, priceTrust, contactTrust } from "./trust";

export const BASE_QUERIES = [
  "restaurant with private dining room",
  "private event space restaurant",
  "restaurant private party venue",
  "restaurant full buyout events",
];

const EXCLUDED_TYPES = new Set([
  "fast_food_restaurant",
  "meal_takeaway",
  "convenience_store",
  "grocery_store",
]);

export async function discover(
  center: { lat: number; lng: number },
  radiusM: number,
  extraQueries: string[] = [],
  log: (msg: string) => void = () => {}
): Promise<PlaceResult[]> {
  const byId = new Map<string, PlaceResult>();
  for (const q of [...BASE_QUERIES, ...extraQueries]) {
    try {
      const results = await searchPlaces(q, center, radiusM);
      for (const p of results) {
        if (byId.has(p.id)) continue;
        if (p.types.some((t) => EXCLUDED_TYPES.has(t))) continue;
        // locationBias is soft — enforce the radius (25% slack; exact commute computed later)
        if (haversineMeters(center, p) > radiusM * 1.25) continue;
        byId.set(p.id, p);
      }
      log(`query "${q}" → ${results.length} results (${byId.size} unique kept)`);
    } catch (err) {
      log(`query "${q}" failed: ${(err as Error).message}`);
    }
  }
  return [...byId.values()];
}

export async function enrichAndStore(db: SupabaseClient, place: PlaceResult, city: string) {
  const site = place.website ? await fetchSiteContent(place.website) : null;
  const extraction =
    site && site.pages.length > 0 ? await extractVenueFacts(place.name, site) : null;

  // A failed read (site down, extraction refused) must never downgrade data we
  // already hold — skip the write if the stored row knows more than we do now.
  if (!extraction) {
    const { data: existing } = await db
      .from("venues")
      .select("trust")
      .eq("google_place_id", place.id)
      .maybeSingle();
    if (existing && existing.trust !== "unverified") {
      return { trust: existing.trust as "verified" | "likely", rooms: -1, skipped: true };
    }
  }

  const trust = extraction
    ? venueTrust(extraction)
    : {
        trust: "unverified" as const,
        reasons: [
          place.website
            ? "Website could not be read — needs a call to confirm private dining"
            : "No website on file — needs a call to confirm private dining",
        ],
      };

  const rooms = extraction?.rooms ?? [];
  const maxSeated = rooms.reduce<number | null>(
    (acc, r) => (r.seated_capacity != null ? Math.max(acc ?? 0, r.seated_capacity) : acc),
    null
  );
  const maxStanding = rooms.reduce<number | null>(
    (acc, r) => (r.standing_capacity != null ? Math.max(acc ?? 0, r.standing_capacity) : acc),
    null
  );

  const sources = [
    { url: place.googleMapsUri, kind: "google_places", fetched_at: new Date().toISOString() },
    ...(site?.pages ?? []).map((p) => ({
      url: p.url,
      kind: "official_site",
      fetched_at: new Date().toISOString(),
    })),
  ].filter((s) => s.url);

  const venueRow = {
    google_place_id: place.id,
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    city,
    website: place.website,
    google_maps_url: place.googleMapsUri,
    venue_type: extraction?.venue_type ?? "restaurant",
    cuisines: extraction?.cuisines ?? [],
    google_rating: place.rating,
    google_review_count: place.reviewCount,
    google_price_level: place.priceLevel,
    private_dining_url: extraction?.private_dining_url ?? null,
    pd_summary: extraction?.pd_summary ?? null,
    event_styles: extraction?.event_styles ?? [],
    max_seated: maxSeated,
    max_standing: maxStanding,
    trust: trust.trust,
    trust_reasons: trust.reasons,
    price_tier:
      extraction?.price.tier ??
      (place.priceLevel != null && place.priceLevel > 0 ? "$".repeat(place.priceLevel) : null),
    min_spend_low: extraction?.price.min_spend_low ?? null,
    min_spend_high: extraction?.price.min_spend_high ?? null,
    per_person_low: extraction?.price.per_person_low ?? null,
    per_person_high: extraction?.price.per_person_high ?? null,
    price_notes: extraction?.price.notes ?? null,
    price_trust: extraction ? priceTrust(extraction) : ("unverified" as const),
    price_source_url: extraction?.price.source_url ?? null,
    menu_urls: site?.menuUrls ?? [],
    dietary_options: extraction?.dietary_options ?? [],
    dietary_notes: extraction?.dietary_notes ?? null,
    events_email:
      extraction?.events_email ??
      site?.emails.find((e) => !/careers|jobs|press|media|hr@|recruit/i.test(e)) ??
      null,
    events_phone: extraction?.events_phone ?? null,
    phone: place.phone,
    contact_trust: extraction
      ? contactTrust(extraction, place.phone)
      : place.phone
        ? ("likely" as const)
        : ("unverified" as const),
    sources,
    updated_at: new Date().toISOString(),
  };

  const { data: venue, error } = await db
    .from("venues")
    .upsert(venueRow, { onConflict: "google_place_id" })
    .select("id")
    .single();
  if (error) throw new Error(`Upsert failed for ${place.name}: ${error.message}`);

  await db.from("private_rooms").delete().eq("venue_id", venue.id);
  if (rooms.length > 0) {
    const roomRows = rooms.map((r) => ({
      venue_id: venue.id,
      name: r.name,
      seated_capacity: r.seated_capacity,
      standing_capacity: r.standing_capacity,
      description: r.description,
      is_full_buyout: r.is_full_buyout,
      trust: roomTrust(r),
      source_url: r.source_url,
    }));
    const { error: roomErr } = await db.from("private_rooms").insert(roomRows);
    if (roomErr) throw new Error(`Room insert failed for ${place.name}: ${roomErr.message}`);
  }

  return { trust: trust.trust, rooms: rooms.length };
}

export interface ResearchProgress {
  total: number;
  done: number;
  succeeded: number;
  finished: boolean;
}

/** Discover + enrich an area with a small worker pool, reporting progress. */
export async function researchArea(
  db: SupabaseClient,
  origin: { lat: number; lng: number },
  radiusM: number,
  opts: {
    city: string;
    limit?: number;
    extraQueries?: string[];
    skipExisting?: boolean;
    concurrency?: number;
    onProgress?: (p: ResearchProgress) => void;
    log?: (msg: string) => void;
  }
): Promise<ResearchProgress> {
  const log = opts.log ?? (() => {});
  const places = (await discover(origin, radiusM, opts.extraQueries ?? [], log)).slice(
    0,
    opts.limit ?? 28
  );

  let queue = [...places];
  if (opts.skipExisting) {
    const { data: existing } = await db
      .from("venues")
      .select("google_place_id")
      .in("google_place_id", places.map((p) => p.id));
    const existingIds = new Set((existing ?? []).map((r) => r.google_place_id));
    queue = queue.filter((p) => !existingIds.has(p.id));
    log(`${places.length} discovered, ${queue.length} new to enrich`);
  }

  const progress: ResearchProgress = {
    total: queue.length,
    done: 0,
    succeeded: 0,
    finished: queue.length === 0,
  };
  opts.onProgress?.(progress);

  const workers = Array.from({ length: opts.concurrency ?? 4 }, async () => {
    while (queue.length > 0) {
      const place = queue.shift()!;
      try {
        const r = await enrichAndStore(db, place, opts.city);
        progress.succeeded++;
        log(`✔ ${place.name} — ${r.trust}, ${r.rooms} rooms`);
      } catch (err) {
        log(`✖ ${place.name}: ${(err as Error).message}`);
      }
      progress.done++;
      opts.onProgress?.(progress);
    }
  });
  await Promise.all(workers);
  progress.finished = true;
  opts.onProgress?.(progress);
  return progress;
}
