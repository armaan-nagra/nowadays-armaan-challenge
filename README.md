# venuemaxxing

Private dining finder for corporate event planners, built for the Nowadays
coding challenge.

You give it an address, a headcount, and a max commute time (walking or
driving), and it returns a ranked list of venues that can host the group.
Each result shows the private rooms and their capacities, a price signal,
commute time, and contact info. Every fact carries a trust label so you know
whether it came from the venue's own website or still needs a phone call.

## Stack

- Next.js 16, React 19, Tailwind 4
- Supabase (Postgres): venues, private rooms, commute cache, radius search RPC
- Leaflet with Stamen watercolor tiles (via Stadia Maps)
- Google Places (New), Geocoding, and Routes APIs
- Claude for structured extraction from venue websites (pipeline only)

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=        Supabase project settings > API
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=                 session pooler URI, used by the migration runner
GOOGLE_MAPS_API_KEY=             needs Places API (New), Geocoding API, Routes API
ANTHROPIC_API_KEY=               only needed to run the enrichment pipeline
```

Apply the schema:

```bash
npm run db:migrate
```

Seed venue data for the three challenge areas (takes a few minutes, it reads
real venue websites):

```bash
npm run pipeline -- --all
```

You can also seed a single area or any address:

```bash
npm run pipeline -- --area times-square        # or salesforce-tower, waikiki
npm run pipeline -- --address "Ferry Building, San Francisco" --radius 1200
```

Then:

```bash
npm run dev
```

The three required scenarios are preloaded as "try" chips under the search bar:
50 near Times Square (20 min walk), 30 near Salesforce Tower (15 min walk), and
the 200 person Waikiki reception (15 min walk).

Note on map tiles: Stadia serves the watercolor style without a key on
localhost. If you deploy this you'll need a free Stadia key added to the tile
URL in `src/components/MapPanel.tsx`.

## How data gets in

There are two paths into the database:

1. The offline pipeline (`scripts/pipeline/run.ts`). It finds candidate venues
   near a point with Google Places, fetches each venue's website, follows links
   to private dining / events pages, and extracts rooms, capacities, pricing,
   dietary info, and events contacts with Claude. Everything is upserted into
   Supabase with a source URL per fact.
2. Live scouting. If you search an address that hasn't been seeded, the empty
   state offers "Scout this area now", which runs the same pipeline server side
   with a progress bar. Results stream in as venues are confirmed, usually
   2-3 minutes for a new neighborhood.

Search itself is: geocode the address, pull candidates inside a crow-flies
radius (Postgres haversine function), get real walk/drive times from the
Routes API (cached per origin/venue/mode), then rank on capacity fit, trust,
commute, event style, price signal, and rating. Each card has a "why here"
line explaining its rank.

## Trust labels

- verified: the fact is stated on the venue's own website, source link included
- likely: good evidence of private dining, but the specific number is inferred
- needs a call: found nearby, but nothing published to back it up

Trust is computed per field, so a venue can have verified rooms and an
unverified price at the same time.

## Layout

```
supabase/migrations/      schema + radius search + RLS
scripts/db/migrate.ts     migration runner
scripts/pipeline/run.ts   pipeline CLI
src/lib/                  enrichment, extraction, trust rules, ranking, google helpers
src/app/api/              search, autocomplete proxy, live scout jobs
src/components/           search bar, venue cards, map, detail drawer, compare tray
```

## Limitations

- Research and recommendations only, no booking integrations (per the brief).
- The pipeline reads HTML only. Capacities buried in PDF event kits are linked,
  not parsed.
- Live scout jobs are held in memory and the endpoint is unauthenticated, which
  is fine locally. A hosted version would want job state in Postgres, a real
  queue, and rate limiting, since each scout costs API credits.
