# Private Aviation Tracker

Live map and ownership intelligence for **private and business aviation only** —
business jets, VIP airliners, corporate turboprops and charter traffic. Click an
aircraft and the backend automatically researches who owns and operates it from
public registries and web sources, then shows the evidence and the links it used.

```
SEE PRIVATE JET → CLICK JET → IDENTIFY AIRCRAFT → AUTO-RESEARCH OWNER → OWNER + OPERATOR + SOURCES
```

This is a working application, not a mock-up. It has one hard requirement — an
ADS-B data source — and everything else degrades gracefully with a clear
explanation on screen when it is not configured.

---

## What you must provide

| # | Credential | Needed for | Without it |
|---|---|---|---|
| 1 | **ADS-B Exchange API key** (`ADSBX_RAPIDAPI_KEY`) via [RapidAPI](https://rapidapi.com/adsbx/api/adsbexchange-com1) | Live aircraft positions | The map shows “Live aircraft data temporarily unavailable.” Use `ADSB_PROVIDER=demo` for clearly-labelled simulated traffic while you evaluate the UI. |
| 2 | **A web search API key** — one of Google Programmable Search (`GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX`), SerpAPI (`SERPAPI_KEY`), Bing (`BING_SEARCH_KEY`) or Brave (`BRAVE_SEARCH_KEY`) | Owner research beyond official registries | Ownership shows “Unknown — no web search provider is configured”, with a link to the official registry for the tail number. |
| 3 | **PostgreSQL** (`DATABASE_URL`) | Aircraft database, ownership cache, flight history | Map, filtering, search-by-live-traffic and ownership lookups still work; nothing is persisted between restarts and there is no flight history. |
| 4 | *(optional)* **Anthropic API key** (`ANTHROPIC_API_KEY` + `OWNERSHIP_LLM_ENABLED=true`) | Model-assisted reading of the search evidence | Ownership uses the deterministic source scorer only. |
| 5 | *(optional)* **Redis** (`REDIS_URL`) | Shared cache across instances | Falls back to an in-process LRU cache. |

No key is ever exposed to the browser. Every provider call happens in a route
handler or a server module; the only `NEXT_PUBLIC_*` values are the map style
and refresh interval.

---

## Quick start

```bash
cd private-aviation-tracker
cp .env.example .env.local          # then fill in the values below
npm install

docker compose up -d postgres       # or point DATABASE_URL at your own Postgres
npx prisma migrate deploy           # creates the schema

npm run dev                         # http://localhost:3000
```

Minimum `.env.local` to see real traffic:

```bash
DATABASE_URL="postgresql://tracker:tracker@localhost:5432/private_aviation?schema=public"
ADSB_PROVIDER="adsbexchange"
ADSBX_RAPIDAPI_KEY="your-rapidapi-key"
SEARCH_PROVIDER="google_cse"
GOOGLE_CSE_API_KEY="..."
GOOGLE_CSE_CX="..."
```

To evaluate the interface with no keys at all, set `ADSB_PROVIDER="demo"`. Demo
traffic uses deliberately invalid registrations (`N0GLF6` — an N-number cannot
have a leading zero) and the UI shows a permanent **SIMULATED DATA** banner.
Ownership research still runs for real against those tails and correctly reports
that nothing was found.

Check what is wired up at any time: `curl localhost:3000/api/health`.

---

## Optional: load the official reference datasets

Both are public datasets and both make the product materially better.

**FAA aircraft registry** — the authoritative registered owner for every US tail.
With it loaded, N-number ownership comes back as “the official register says X”
at 90%+ confidence instead of an inference from web sources.

```bash
curl -O https://registry.faa.gov/database/ReleasableAircraft.zip
unzip ReleasableAircraft.zip -d ReleasableAircraft
npm run import:faa -- --dir ./ReleasableAircraft
```

**OurAirports** — full airport list, so departure/arrival inference resolves small
private fields and not just the ~200 airports bundled with the app.

```bash
curl -O https://davidmegginson.github.io/ourairports-data/airports.csv
npm run import:airports -- --file ./airports.csv
```

---

## How it works

```
Browser ──SSE──▶ /api/aircraft/stream ──▶ LiveFeedManager ──▶ ADS-B provider
                                              │                (ADS-B Exchange)
                                              ├──▶ classifier (ICAO type DB)
                                              └──▶ history ingest ──▶ Postgres

Browser ──────▶ /api/aircraft/:reg/ownership ──▶ Ownership service
                                                   ├── cache (Redis / memory)
                                                   ├── FAA registry table
                                                   ├── search provider (swappable)
                                                   ├── evidence scoring
                                                   └── optional Claude analysis
```

**Private/business filtering.** `src/lib/aircraft/typeDatabase.ts` maps ICAO type
designators to manufacturer, model and category, and covers business aviation in
depth plus enough of the airline, rotorcraft, military and light-GA world to
exclude them. Classification also uses business-aviation operator callsigns
(NetJets `EJA`, Flexjet `LXJ`, VistaJet `VJT`…) and the feed's military/PIA flags.
Airline airframes are only promoted to “VIP airliner” with corroborating signals.
Default view is Private / Business Aviation; military and helicopters are opt-in.

**One upstream poll per viewport.** The map viewport is quantised into cells and
each cell is fetched at most once per `ADSB_POLL_INTERVAL_MS` regardless of how
many browsers are watching it, with in-flight de-duplication and last-good-payload
fallback. Adding viewers costs no extra API calls.

**Smooth movement without extra requests.** Between updates the client
dead-reckons each aircraft from its last reported position using ground speed and
track, capped at 45 s so a stale contact drifts slightly and then stops.

**Ownership research.** Cache → FAA registry → web search across a set of tail-number
queries → organisation-name extraction from titles and snippets → scoring by source
authority, distinct-domain corroboration and proximity to the registration →
optional Claude pass over the same evidence → persisted result. A page that does
not mention the registration is not evidence, and a name on a single low-authority
page cannot reach high confidence.

**Nothing is invented.** If the sources do not establish an owner, the panel says
“Unknown” with the reason, links to the official registry, and lists the queries
that were run. Where an owner is found but no source names the party behind it,
the UI states *“Registered owner identified, beneficial owner not publicly
confirmed.”* Flight history is built only from positions this deployment actually
observed — airports are marked as inferred from position, never from a flight plan.

---

## API

| Endpoint | Description |
|---|---|
| `GET /api/aircraft/live?lat=&lon=&radius=&filters=` | Live aircraft for a viewport |
| `GET /api/aircraft/stream?lat=&lon=&radius=&filters=` | Same payload as SSE |
| `GET /api/aircraft/:registration` | Identity, live and last known position (`?ownership=1` to include ownership) |
| `GET /api/aircraft/:registration/history` | Recorded flights, positions and timeline |
| `GET /api/aircraft/:registration/ownership` | Ownership result (cached when fresh) |
| `POST /api/aircraft/:registration/ownership/refresh` | Force re-research |
| `GET /api/search?q=` | Registration, callsign, hex, model, owner, operator |
| `GET /api/health` | Which integrations are configured |

`filters`: `business` (default), `private_jet`, `bizliner`, `turboprop`, `vip`,
`charter`, `helicopter`, `military`, `all` — comma-separated and additive.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · MapLibre GL ·
Prisma · PostgreSQL · Redis (optional) · Anthropic SDK (optional).

```
src/lib/adsb/        ADS-B providers behind one interface (+ demo provider)
src/lib/aircraft/    Type database, classifier, registration/registry helpers
src/lib/live/        Shared viewport polling, recent-aircraft index
src/lib/ownership/   Query building, evidence extraction, scoring, FAA, LLM, service
src/lib/search/      Search providers behind one interface
src/lib/history/     Position ingest, flight-leg derivation, airport inference
src/components/      Map, panels, owner intelligence, timeline
```

Swapping a provider means adding one class and one `case`: ADS-B providers
implement `AdsbProvider`, search providers implement `SearchProvider`.

---

## Built to extend

The seams for the follow-on features are already in place:

- **Alerts / notifications** — `ingestObservations()` in `src/lib/history/ingest.ts`
  is the single choke point where every observation, take-off and landing is seen.
- **Favourites and watchlists** — `Aircraft` and `OwnershipRecord` are keyed by
  registration; add a user table and join.
- **Airport tracking** — the `Airport` table and `nearestAirport()` already exist.
- **Historical analytics** — `Position` and `FlightLeg` retain observed movement.
- **Mobile** — the layout is responsive; the panel goes full-width below `sm`.

Note for horizontal scaling: history ingest runs in-process alongside the web
server. Run a single ingest worker (or set `PERSIST_POSITIONS=false` on the web
tier) if you scale out, so flight legs are not derived twice.

---

## Legal and data use

- ADS-B Exchange data is used through its official API. Review its current
  API/data-access terms before deploying, and keep `ADSB_POLL_INTERVAL_MS` within
  the rate limits of your plan.
- Ownership research uses official public registries and a **licensed web search
  API**. The app does not scrape search engines from the browser or the server.
- Aircraft photos come from the Planespotters public API and are displayed with
  the required photographer attribution and a link back.
- The UI distinguishes registered owner, operator, management company, charter
  operator, trustee and beneficial owner, and never claims a person owns an
  aircraft without a source that says so.
- Every ownership panel carries: *“Ownership information is based on publicly
  available sources and may represent the registered owner or operator rather than
  the ultimate beneficial owner.”*

Aircraft in a privacy programme (PIA/LADD) are handled explicitly rather than
guessed at.
