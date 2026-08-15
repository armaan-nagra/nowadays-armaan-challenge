-- Private Dining Finder - initial schema
-- Trust model: every uncertain fact (rooms, price, contact) carries its own
-- trust label + source URL. 'verified' = stated on the venue's own site,
-- 'likely' = inferred from partial/third-party evidence,
-- 'unverified' = discovered but unconfirmed - needs a call.

create type trust_label as enum ('verified', 'likely', 'unverified');

create table venues (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  city text,
  website text,
  google_maps_url text,
  venue_type text,                -- restaurant | hotel | event_space | bar | rooftop
  cuisines text[] default '{}',
  google_rating numeric,
  google_review_count integer,
  google_price_level integer,    -- 0-4 from Places

  -- private dining evidence
  private_dining_url text,       -- the events/private-dining page we found
  pd_summary text,               -- one-paragraph planner-facing summary
  event_styles text[] default '{}',   -- seated_dinner | reception | buyout | semi_private
  max_seated integer,
  max_standing integer,
  trust trust_label not null default 'unverified',
  trust_reasons text[] default '{}',  -- human-readable evidence bullets

  -- price signal
  price_tier text,               -- $ | $$ | $$$ | $$$$
  min_spend_low integer,         -- USD, null if unknown
  min_spend_high integer,
  per_person_low integer,
  per_person_high integer,
  price_notes text,
  price_trust trust_label not null default 'unverified',
  price_source_url text,

  -- menus & dietary
  menu_urls text[] default '{}',
  dietary_options text[] default '{}',  -- vegetarian | vegan | gluten_free | kosher | halal | dairy_free | nut_free
  dietary_notes text,

  -- contact
  events_email text,
  events_phone text,
  phone text,                    -- general line from Google
  contact_trust trust_label not null default 'unverified',

  sources jsonb default '[]',    -- [{url, kind: official_site|third_party|google_places, fetched_at}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private_rooms (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null,
  seated_capacity integer,
  standing_capacity integer,
  description text,
  is_full_buyout boolean not null default false,
  trust trust_label not null default 'unverified',
  source_url text,
  created_at timestamptz not null default now()
);

-- walking-time cache: one row per (origin ~30m grid, venue)
create table commute_cache (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  origin_key text not null,      -- "lat4,lng4" rounded to 4 decimals
  mode text not null default 'walking',
  duration_minutes numeric not null,
  distance_meters integer not null,
  created_at timestamptz not null default now(),
  unique (venue_id, origin_key, mode)
);

create index venues_lat_lng_idx on venues (lat, lng);
create index private_rooms_venue_idx on private_rooms (venue_id);

-- haversine radius search, avoids needing PostGIS for this scale
create or replace function venues_within_radius(
  origin_lat double precision,
  origin_lng double precision,
  radius_m double precision
)
returns setof venues
language sql stable as $$
  select *
  from venues v
  where 2 * 6371000 * asin(sqrt(
      power(sin(radians(v.lat - origin_lat) / 2), 2) +
      cos(radians(origin_lat)) * cos(radians(v.lat)) *
      power(sin(radians(v.lng - origin_lng) / 2), 2)
    )) <= radius_m
$$;

-- read-only for the browser; all writes go through the service role
alter table venues enable row level security;
alter table private_rooms enable row level security;
alter table commute_cache enable row level security;

create policy "public read venues" on venues for select using (true);
create policy "public read rooms" on private_rooms for select using (true);
create policy "public read commutes" on commute_cache for select using (true);
