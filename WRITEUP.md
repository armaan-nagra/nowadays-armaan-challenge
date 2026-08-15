# Written response — Private Dining Finder

## How I framed the problem

The prompt has a tell in it: the required "trust label." Private dining is still handled manually at Nowadays because the data is messy — capacities live in PDFs on restaurant websites, minimum spends get quoted over the phone, and half the venues that host great buyouts never say so online. So I decided the core of my submission shouldn't be a CRUD app over a venues table; it should be **a data pipeline that's honest about what it knows**, and a planner UX that makes uncertain data genuinely usable.

## How I built it

**1. An enrichment pipeline, not a hand-curated dataset.** A script (`scripts/pipeline/`) discovers candidate venues near a point with the Google Places API, fetches each venue's website, follows links to private-dining/events pages, and uses Claude with structured outputs to extract: private rooms with seated/standing capacities, minimum spends and per-person pricing, menus, dietary accommodations, and events-specific contact info. Every extracted fact carries an `explicitly_stated` flag and a source URL.

**2. Trust as provenance, per field.** The trust rules are simple and auditable (`trust.ts`): a fact stated verbatim on the venue's own site → `verified` (with the source link shown in the UI); evidence of private dining but inferred specifics → `likely`; no published evidence → `unverified / needs a call`. Trust is computed per field — a venue can have verified rooms and an unverified price — because that's the real shape of this data.

**3. Search over the enriched library.** The app geocodes any address, pulls venues within a crow-flies bound (Postgres haversine RPC in Supabase), computes real **walking or driving** times via the Google Routes API (cached per origin–venue–mode in Postgres so repeat searches are instant), and ranks. Walking is the default — scenario 3 requires it, and walk radii are how groups move in Manhattan, SoMa, and Waikiki — with a drive toggle for car-first cities and larger radii.

**4. Transparent ranking.** The score is a weighted blend of capacity fit (a 64-seat room for 50 people beats a 300-person ballroom), trust, commute, event-style match (the 200-person Waikiki happy hour scores venues on *standing* capacity), price-signal availability, and Google rating. Every card shows a "Why here" line — planners have to defend picks to their boss, so a ranked list without reasons is a black box they can't use.

**5. A UI with a point of view.** Planners' tools are usually grey. I went the other way: a sticker-book aesthetic — watercolor map tiles, hand-drawn walking radius, wobbling numbered pins — with deliberately crisp data underneath (monospace chips for times/capacities/prices, plain-language trust badges). The playfulness is the skin; the information design is conservative. The compare tray (pick up to 4 → side-by-side table) mirrors the actual decision workflow, and the detail drawer puts contact info and trust reasons front and center for the "needs a call" cases.

## Key decisions & trade-offs

- **Hybrid coverage: pre-seeded areas + live on-demand scouting.** Seeding the three scenario areas keeps demo searches instant. For any other address, the app doesn't fake results or dead-end — the empty state offers "Scout this area now," which runs the same pipeline live server-side with a progress bar, streaming ranked venues in as their websites are read (~2–3 min per neighborhood). The click-to-start gate keeps enrichment spend intentional rather than firing on every typo.
- **HTML-only extraction.** Many PD kits are PDFs. I surface them as linked documents rather than parsing them — parsing PDFs well is a project of its own, and a wrong capacity is worse than a link. This was the single biggest coverage trade-off.
- **Haversine prefilter + real routes.** Crow-flies distance is always ≤ walking distance, so a `walk_speed × minutes` radius is a safe overapproximation for the DB query; exact walking times then come from the Routes API only for candidates. This keeps API spend low without ever wrongly excluding a venue.
- **Conservative extraction prompt.** The failure mode that kills trust in a tool like this is a confident wrong number. The extraction is instructed to prefer `null` + `explicitly_stated: false` over guessing, and the trust rules only award `verified` when there's a URL to point at.

## Challenges

- **Restaurant websites are hostile.** JS-heavy pages, capacity numbers in image carousels, "private events" pages hidden behind marketing-speak URLs. The link-discovery heuristics (regex over hrefs *and* anchor text, PD-page-first sorting, contact scraping from `mailto:`/`tel:`) recovered most of it; the trust system absorbs the rest honestly — a venue we couldn't read becomes "needs a call," not a fabricated entry.
- **The 200-person Waikiki scenario** is a different shape of problem — few restaurants seat 200, so the pipeline runs extra discovery queries there (hotel banquet, luau venues, event spaces) and the ranker switches to standing capacity for reception searches.

## With more time

- Parse PDF private-dining kits (they hold the best capacity/pricing data).
- A re-verification loop: facts age; store `fetched_at` (already in the schema) and re-crawl stale venues on a schedule.
- Planner accounts: saved searches, shortlists, and a one-click "draft the inquiry email" using the extracted events contact.
- Availability signals — scraping OpenTable/SevenRooms large-party availability would upgrade "likely" venues without a phone call.
- Feedback loop: when a Nowadays planner confirms a capacity by phone, write it back as `verified (by Nowadays)` — the manual work the team already does would compound into the dataset.
