export type TrustLabel = "verified" | "likely" | "unverified";

export type EventStyle = "seated_dinner" | "reception" | "buyout" | "semi_private";

export interface PrivateRoom {
  id: string;
  venue_id: string;
  name: string;
  seated_capacity: number | null;
  standing_capacity: number | null;
  description: string | null;
  is_full_buyout: boolean;
  trust: TrustLabel;
  source_url: string | null;
}

export interface Venue {
  id: string;
  google_place_id: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  website: string | null;
  google_maps_url: string | null;
  venue_type: string | null;
  cuisines: string[];
  google_rating: number | null;
  google_review_count: number | null;
  google_price_level: number | null;
  private_dining_url: string | null;
  pd_summary: string | null;
  event_styles: EventStyle[];
  max_seated: number | null;
  max_standing: number | null;
  trust: TrustLabel;
  trust_reasons: string[];
  price_tier: string | null;
  min_spend_low: number | null;
  min_spend_high: number | null;
  per_person_low: number | null;
  per_person_high: number | null;
  price_notes: string | null;
  price_trust: TrustLabel;
  price_source_url: string | null;
  menu_urls: string[];
  dietary_options: string[];
  dietary_notes: string | null;
  events_email: string | null;
  events_phone: string | null;
  phone: string | null;
  contact_trust: TrustLabel;
  sources: { url: string; kind: string; fetched_at: string }[];
}

export type CommuteMode = "walking" | "driving";

export interface Commute {
  duration_minutes: number;
  distance_meters: number;
  mode: CommuteMode;
}

export interface ScoredVenue {
  venue: Venue;
  rooms: PrivateRoom[];
  commute: Commute | null;
  score: number;
  fit: {
    capacity: number;   // 0-1
    commute: number;    // 0-1
    trust: number;      // 0-1
    price: number;      // 0-1
    style: number;      // 0-1
  };
  why: string[];        // planner-facing ranking explanation
  bestRoom: PrivateRoom | null;
}

export interface SearchParams {
  address: string;
  headcount: number;
  maxMinutes: number;
  mode: CommuteMode;
  style: "any" | "seated_dinner" | "reception";
}

export interface SearchResponse {
  origin: { lat: number; lng: number; formatted: string };
  results: ScoredVenue[];
  meta: { totalInRadius: number; mode: CommuteMode };
}
