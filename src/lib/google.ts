/** Google Maps Platform helpers: geocoding + Places API (New) text search. */

const KEY = () => {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new Error("Missing GOOGLE_MAPS_API_KEY");
  return k;
};

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
}

export async function geocode(address: string): Promise<GeocodeResult> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${KEY()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(`Geocoding failed for "${address}": ${data.status}`);
  }
  const r = data.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address,
  };
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  website: string | null;
  googleMapsUri: string | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  types: string[];
  phone: string | null;
}

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export async function searchPlaces(
  query: string,
  center: { lat: number; lng: number },
  radiusM: number
): Promise<PlaceResult[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY(),
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.websiteUri",
        "places.googleMapsUri",
        "places.rating",
        "places.userRatingCount",
        "places.priceLevel",
        "places.types",
        "places.nationalPhoneNumber",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: {
        circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusM },
      },
      maxResultCount: 20,
    }),
  });
  if (!res.ok) {
    throw new Error(`Places search failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return (data.places ?? [])
    .filter((p: Record<string, any>) => p.location?.latitude != null && p.location?.longitude != null)
    .map((p: Record<string, any>) => ({
    id: p.id,
    name: p.displayName?.text ?? "Unknown",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    website: p.websiteUri ?? null,
    googleMapsUri: p.googleMapsUri ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    priceLevel: p.priceLevel != null ? (PRICE_LEVELS[p.priceLevel] ?? null) : null,
    types: p.types ?? [],
    phone: p.nationalPhoneNumber ?? null,
  }));
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export interface WalkResult {
  durationMinutes: number;
  distanceMeters: number;
}

/** Walking or driving routes via the Routes API, one origin -> many destinations. */
export async function routeTimes(
  origin: { lat: number; lng: number },
  destinations: { lat: number; lng: number }[],
  mode: "walking" | "driving" = "walking"
): Promise<(WalkResult | null)[]> {
  if (destinations.length === 0) return [];
  const res = await fetch(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY(),
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
      },
      body: JSON.stringify({
        origins: [
          { waypoint: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } } },
        ],
        destinations: destinations.map((d) => ({
          waypoint: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
        })),
        travelMode: mode === "driving" ? "DRIVE" : "WALK",
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Route matrix failed (${res.status}): ${await res.text()}`);
  }
  const rows = await res.json();
  const out: (WalkResult | null)[] = new Array(destinations.length).fill(null);
  for (const row of rows) {
    if (row.condition === "ROUTE_EXISTS" && row.duration) {
      out[row.destinationIndex] = {
        durationMinutes: Math.round(parseInt(row.duration) / 60 * 10) / 10,
        distanceMeters: row.distanceMeters ?? 0,
      };
    }
  }
  return out;
}
