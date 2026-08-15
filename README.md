# Table Scout 🍽️ — Private Dining Finder

A research & recommendation tool for corporate event planners. Type an address (with autocomplete), a headcount, a commute mode (**walk or drive**), and a max time, and Table Scout returns a ranked set of private dining venues — each with room-by-room capacities, price signals, contact info, and a **trust label** that tells you exactly how much to believe each fact.

Built for the Nowadays Private Dining Finder challenge.

## How it works

```
┌─────────────────────── enrichment pipeline (offline) ───────────────────────┐
│  Google Places (New)  →  venue websites  →  Claude (structured extraction)  │
│  discovery near a point   PD/events pages     rooms, prices, contacts       │
│                                                    │                        │
│                              per-field provenance → trust labels            │
│                                                    ▼                        │
│                                            Supabase (Postgres)              │
└─────────────────────────────────────────────────────────────────────────────┘
                                                     │
┌─────────────────────────── app (Next.js) ──────────▼────────────────────────┐
│  geocode address → radius query → walk/drive times (Google Routes, cached)  │
│  → transparent weighted ranking → cards + watercolor map + compare tray     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Commute modes: walking and driving** — a 🚶/🚗 toggle in the search bar. Real route times come from the Google Routes API and are cached per (origin, venue, mode) in Postgres. The address field has Google Places autocomplete (proxied server-side so the key stays private).

**Trust labels** come from real provenance, not vibes:

| Label | Meaning |
|---|---|
| ✓ `verified` | The fact (a room + capacity, a dollar figure) is stated verbatim on the venue's **own website** — source URL included |
| ~ `likely` | Good evidence of private dining, but the specific fact is inferred or partial |
| ☎ `needs a call` | Discovered nearby, but no published evidence — the planner should confirm by phone |

Trust is per-field: a venue can have `verified` rooms but an `unverified` price signal.

## Tech stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind v4, Leaflet + react-leaflet (Stamen watercolor tiles via Stadia Maps)
- **Database:** Supabase (PostgreSQL) — venues, private rooms, commute cache, haversine radius RPC, RLS (public read / service-role write)
- **Pipeline:** Google Places API (New) + Geocoding + Routes API, Claude (`claude-opus-5`) with structured outputs for extraction
- **Ranking:** weighted score over capacity fit, trust, commute, event style, price signal, and Google rating — every card shows *why* it ranked where it did

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=        # Supabase → Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=                 # Supabase → Connect → Session pooler URI
GOOGLE_MAPS_API_KEY=             # enable: Places API (New), Geocoding API, Routes API
ANTHROPIC_API_KEY=               # only needed to run the enrichment pipeline
```

### 3. Migrate the database

```bash
npm run db:migrate
```

Applies `supabase/migrations/*.sql` (tables, radius-search function, RLS policies).

### 4. Seed venue data

Run the enrichment pipeline for the three scenario areas (takes a few minutes; discovers venues, reads their websites, extracts private dining facts with Claude):

```bash
npm run pipeline -- --all
```

Or one area / any custom address:

```bash
npm run pipeline -- --area times-square      # also: salesforce-tower, waikiki
npm run pipeline -- --address "Ferry Building, San Francisco" --radius 1200
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and hit one of the **Try:** chips — they're preloaded with the three required scenarios:

1. 50 people near Times Square, ≤ 20 min walk
2. 30 people near Salesforce Tower (415 Mission St, SF), ≤ 15 min walk
3. 200 people, reception style, near Hilton Hawaiian Village Waikiki, ≤ 15 min walk

> **Map tiles:** the Stamen watercolor style is served by Stadia Maps, which is key-free on `localhost`. For a deployed domain, add a free Stadia API key to the tile URL in `src/components/MapPanel.tsx`.

## Repo tour

```
supabase/migrations/     schema: venues, private_rooms, commute_cache, radius RPC, RLS
scripts/db/migrate.ts    tiny migration runner (npm run db:migrate)
scripts/pipeline/run.ts  pipeline CLI (npm run pipeline)
src/lib/
  enrich.ts              enrichment core: discover → enrich → upsert
  site.ts                website fetching + private-dining page discovery
  extract.ts             Claude structured extraction (zod schema)
  trust.ts               provenance → trust label rules
  google.ts              Geocoding, Places (New), Autocomplete, Routes helpers
  ranking.ts             transparent weighted scoring + "why" explanations
  types.ts               shared domain types
src/app/api/search/      search endpoint: geocode → radius → commutes → rank
src/app/api/research/    live "Scout this area" jobs with progress
src/app/api/autocomplete/ Places autocomplete proxy
src/components/          SearchBar, VenueCard, MapPanel, VenueDetail, CompareTray
```

## Any address works — two speeds

- **Seeded areas** (the three scenarios + anywhere you've run the pipeline): instant results.
- **Anywhere else**: the empty state offers **"Scout this area now"** — the same enrichment pipeline runs live server-side (discovery → website reading → Claude extraction), with a progress bar, and ranked results stream in as venues are confirmed (~2–3 minutes for a new neighborhood). Live scouting researches up to ~8 km around the address (driving searches beyond that need an offline pipeline run), and the click-to-start gate keeps API spend intentional.

## Notes & limitations

- Research and recommendations only — no live booking integrations, by design.
- Live scout jobs are tracked in-memory and the `/api/research` endpoint is unauthenticated — both fine for a local research tool running on a long-lived server; a hosted version would move job state to Postgres, run enrichment in a queue/worker (fire-and-forget promises don't survive serverless freezes), and gate scouting behind auth/rate limits (each scout spends real API credits).
- The pipeline reads HTML pages only; capacities locked inside PDFs are surfaced as linked documents rather than parsed (a known next step).
