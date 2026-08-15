# Written response

## Approach

The trust label requirement shaped everything. Private dining data is messy:
capacities live in PDFs, minimum spends get quoted over the phone, and plenty
of venues that host great buyouts never mention it online. So rather than a
CRUD app over a hand-filled venues table, I built a data pipeline that is
honest about what it actually knows, plus a planner UI that makes uncertain
data usable.

## How it works

The pipeline discovers candidate venues near a point with the Google Places
API, fetches each venue's website, follows links to private dining and events
pages, and uses Claude with structured outputs to pull out rooms with
seated/standing capacities, pricing, menus, dietary accommodations, and events
contacts. Every extracted fact carries an `explicitly_stated` flag and a
source URL.

The trust rules (`src/lib/trust.ts`) are deliberately simple so they can be
audited: a fact stated on the venue's own site is "verified" and the UI links
the source; evidence of private dining with inferred specifics is "likely";
no published evidence means "needs a call". Trust is computed per field
because that's the real shape of the data. A venue can have verified rooms
and an unverified price.

Search geocodes any address, pulls candidates within a crow-flies bound using
a Postgres haversine function, gets real walking or driving times from the
Routes API (cached per origin/venue/mode so repeat searches are instant), and
ranks. Walking is the default since that's how groups actually move in
Manhattan, SoMa, and Waikiki, with a drive toggle for car-first cities.

Ranking is a weighted blend of capacity fit (a 64 seat room for 50 people
beats a 300 person ballroom), trust, commute, event style match, price signal
availability, and rating. Each card shows a "why here" line. Planners have to
defend picks to whoever's paying, and a ranked list without reasons is a black
box they can't use.

For the UI I went playful on purpose: planner tools are usually grey. It's a
sticker-book look with watercolor map tiles, a hand-drawn walking radius, and
numbered pins, but the information design underneath is conservative: mono
numerals for times and capacities, plain-language trust badges, a compare
tray for shortlisting up to four venues side by side, and a detail drawer
that puts contacts and trust reasoning front and center for the "needs a
call" cases.

## Decisions and trade-offs

Seeding vs live coverage. The three scenario areas are pre-seeded so demo
searches are instant. Any other address gets a "Scout this area now" button
that runs the same pipeline live with a progress bar, streaming results in as
venues are confirmed (about 2-3 minutes). Making it click-to-start keeps API
spend intentional instead of firing on every typo.

HTML-only extraction. A lot of private dining kits are PDFs. I link them
instead of parsing them, because parsing PDFs well is its own project and a
wrong capacity is worse than a link. This was the biggest coverage trade-off.

Haversine prefilter plus real routes. Crow-flies distance is always shorter
than walking distance, so a walk-speed-times-minutes radius is a safe
overapproximation for the DB query. Exact times then come from the Routes API
only for the candidates. Cheap, and it never wrongly excludes a venue.

Conservative extraction. The failure mode that kills a tool like this is a
confident wrong number. The extraction prompt prefers null over guessing, and
"verified" is only awarded when there's a URL to point at.

## Challenges

Restaurant websites are hostile: JS-heavy pages, capacities inside image
carousels, events pages hiding behind marketing URLs. Link discovery matches
on both hrefs and anchor text, sorts private-dining-looking pages first, and
scrapes contacts from mailto/tel links. Whatever still can't be read becomes
"needs a call" rather than a fabricated entry.

The 200 person Waikiki scenario is a different problem shape. Few restaurants
seat 200, so the pipeline runs extra discovery queries there (hotel banquet,
luau, event spaces) and the ranker switches to standing capacity for
reception-style searches.

## With more time

- Parse PDF event kits, which hold the best capacity and pricing data.
- Re-verification: facts age. `fetched_at` is already stored, so stale venues
  could be re-crawled on a schedule.
- Planner accounts with saved searches and a one-click inquiry email draft
  using the extracted events contact.
- Availability signals from OpenTable/SevenRooms large-party slots.
- A feedback loop: when a planner confirms a capacity by phone, write it back
  as verified. The manual work the team already does would compound into the
  dataset.
