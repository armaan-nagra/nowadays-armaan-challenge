import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { geocode, haversineMeters, routeTimes } from "@/lib/google";
import { rankVenues } from "@/lib/ranking";
import type {
  Commute,
  CommuteMode,
  PrivateRoom,
  SearchParams,
  SearchResponse,
  Venue,
} from "@/lib/types";

export const maxDuration = 60;

// Crow-flies distance is always ≤ route distance, so pace × minutes is a safe
// upper bound for the DB radius query. Driving pace is a dense-urban estimate -
// highway-reachable venues beyond it are out of scope for a dinner search.
const PACE_METERS_PER_MIN: Record<CommuteMode, number> = {
  walking: 80,
  driving: 600,
};

export async function POST(req: Request) {
  let body: Partial<SearchParams> & { maxWalkMinutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const address = (body.address ?? "").trim();
  const headcount = Math.min(Number(body.headcount), 5000);
  const maxMinutes = Math.max(5, Math.min(Number(body.maxMinutes ?? body.maxWalkMinutes), 60));
  const mode: CommuteMode = body.mode === "driving" ? "driving" : "walking";
  const style = body.style ?? "any";
  if (!address || !Number.isFinite(headcount) || headcount < 1 || !Number.isFinite(maxMinutes)) {
    return NextResponse.json(
      { error: "address, headcount, and maxMinutes are required" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  let origin;
  try {
    origin = await geocode(address);
  } catch {
    return NextResponse.json(
      { error: "We couldn't find that address - try adding a city or zip." },
      { status: 422 }
    );
  }

  const radiusM = maxMinutes * PACE_METERS_PER_MIN[mode] * 1.05;
  const { data: venuesData, error: venuesError } = await db.rpc("venues_within_radius", {
    origin_lat: origin.lat,
    origin_lng: origin.lng,
    radius_m: radiusM,
  });
  if (venuesError) {
    return NextResponse.json({ error: venuesError.message }, { status: 500 });
  }
  const venues = (venuesData ?? []) as Venue[];
  if (venues.length === 0) {
    return NextResponse.json({
      origin: { lat: origin.lat, lng: origin.lng, formatted: origin.formatted },
      results: [],
      meta: { totalInRadius: 0, mode },
    } satisfies SearchResponse);
  }

  const venueIds = venues.map((v) => v.id);
  const { data: roomsData, error: roomsError } = await db
    .from("private_rooms")
    .select("*")
    .in("venue_id", venueIds);
  if (roomsError) {
    return NextResponse.json({ error: `Couldn't load room data: ${roomsError.message}` }, { status: 500 });
  }
  const roomsByVenue = new Map<string, PrivateRoom[]>();
  for (const room of (roomsData ?? []) as PrivateRoom[]) {
    const list = roomsByVenue.get(room.venue_id) ?? [];
    list.push(room);
    roomsByVenue.set(room.venue_id, list);
  }

  // Commutes: cached per (origin grid cell, venue, mode), Routes API on miss.
  const originKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}`;
  const { data: cachedData } = await db
    .from("commute_cache")
    .select("venue_id, duration_minutes, distance_meters")
    .eq("origin_key", originKey)
    .eq("mode", mode)
    .in("venue_id", venueIds);
  const commuteByVenue = new Map<string, Commute>();
  for (const c of cachedData ?? []) {
    commuteByVenue.set(c.venue_id, {
      duration_minutes: Number(c.duration_minutes),
      distance_meters: c.distance_meters,
      mode,
    });
  }

  // Bound per-request Routes spend: nearest venues first, at most two batches.
  const missing = venues
    .filter((v) => !commuteByVenue.has(v.id))
    .sort((a, b) => haversineMeters(origin, a) - haversineMeters(origin, b))
    .slice(0, 90);
  const BATCH = 45;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    try {
      const results = await routeTimes(
        origin,
        batch.map((v) => ({ lat: v.lat, lng: v.lng })),
        mode
      );
      const rows = [];
      for (let j = 0; j < batch.length; j++) {
        const r = results[j];
        if (!r) continue;
        commuteByVenue.set(batch[j].id, {
          duration_minutes: r.durationMinutes,
          distance_meters: r.distanceMeters,
          mode,
        });
        rows.push({
          venue_id: batch[j].id,
          origin_key: originKey,
          mode,
          duration_minutes: r.durationMinutes,
          distance_meters: r.distanceMeters,
        });
      }
      if (rows.length > 0) {
        await db.from("commute_cache").upsert(rows, { onConflict: "venue_id,origin_key,mode" });
      }
    } catch (err) {
      console.error("Routes API batch failed:", err);
    }
  }

  // Degraded mode: if the Routes API failed for some venues, enforce the time
  // limit with a crow-flies estimate instead of silently dropping the filter.
  const pace = PACE_METERS_PER_MIN[mode];
  const inRange = venues.filter((v) => {
    if (commuteByVenue.has(v.id)) return true;
    return haversineMeters(origin, v) / pace <= maxMinutes;
  });

  const params: SearchParams = { address, headcount, maxMinutes, mode, style };
  const ranked = rankVenues(
    inRange.map((v) => ({
      venue: v,
      rooms: roomsByVenue.get(v.id) ?? [],
      commute: commuteByVenue.get(v.id) ?? null,
    })),
    params
  ).slice(0, 15);

  return NextResponse.json({
    origin: { lat: origin.lat, lng: origin.lng, formatted: origin.formatted },
    results: ranked,
    meta: { totalInRadius: venues.length, mode },
  } satisfies SearchResponse);
}
