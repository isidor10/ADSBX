import { getAdsbProvider, getProviderChain } from "@/lib/adsb";
import { fetchWithFailover, providerHealth } from "@/lib/adsb/manager";
import { countByPositionSource } from "@/lib/adsb/positionSource";
import { distanceNm, projectPosition } from "@/lib/geo";
import { AdsbError } from "@/lib/adsb/types";
import { matchesFilters } from "@/lib/aircraft/classifier";
import { config, usingOpenFeedFallback } from "@/lib/config";
import { ingestObservations } from "@/lib/history/ingest";
import type { FilterKey, LiveAircraft, LiveFeedResult } from "@/lib/types";
import { indexSize, recordObservations, snapshot } from "./recentIndex";

/**
 * How old a retained position may be before it is dropped rather than shown.
 * Long enough to ride out a provider outage, short enough that nothing on the
 * map is meaningfully wrong about where an aircraft is.
 */
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

/**
 * Shared upstream polling.
 *
 * The map viewport is quantised into cells; every cell is fetched from the
 * ADS-B provider at most once per `ADSB_POLL_INTERVAL_MS` no matter how many
 * browsers are watching it. Concurrent requests for the same cell share one
 * in-flight upstream call, and the last good payload is served (flagged
 * `stale`) if upstream subsequently fails.
 */

export interface ViewportQuery {
  lat: number;
  lon: number;
  radiusNm: number;
  filters: FilterKey[];
}

interface CellState {
  result: LiveFeedResult | null;
  fetchedAt: number;
  inflight: Promise<LiveFeedResult> | null;
  lastError: string | null;
}

/**
 * Rate limits are handled per provider, in the failover manager's circuit
 * breakers — not here.
 *
 * There used to be one global backoff shared by every cell and every provider:
 * a 429 anywhere stopped the whole map from fetching. That directly contradicts
 * the point of the provider chain. A rate limit at one vendor must sideline
 * that vendor and nothing else, which is exactly what `fetchWithFailover` does,
 * so the map keeps being served by whoever is healthy.
 */

const globalForFeed = globalThis as unknown as { __patCells?: Map<string, CellState> };
const cells: Map<string, CellState> = (globalForFeed.__patCells ??= new Map());
const MAX_CELLS = 500;

function quantise(lat0: number, lon0: number, radius: number) {
  // ~0.5° cells keep neighbouring clients on the same upstream call while
  // staying well inside the provider's radius cap.
  const lat = Math.round(lat0 * 2) / 2;
  const lon = Math.round(lon0 * 2) / 2;
  const radiusNm = Math.min(
    config.adsb.maxRadiusNm,
    Math.max(25, Math.ceil(radius / 25) * 25),
  );
  return { lat, lon, radiusNm, key: `${lat}:${lon}:${radiusNm}` };
}

/**
 * Cover a viewport with upstream requests.
 *
 * One request reaches at most `ADSB_MAX_RADIUS_NM` (250 NM upstream), but a
 * zoomed-out map is far wider than that. Asking for a single centred circle —
 * which is what this did — returns a fraction of what is on screen and looks
 * exactly like "the map is not showing all the aircraft".
 *
 * So a large viewport is covered by a grid of overlapping circles instead.
 * Circles of radius r centred on a grid of spacing r·√2 tile the plane, and a
 * slightly tighter spacing leaves no gaps at the corners. The count is capped:
 * each tile is an upstream request, and community feeds rate-limit per client,
 * so beyond the cap the centre of the view is covered and the far edges are
 * not — which is the right trade when the alternative is being throttled into
 * showing nothing at all.
 */
function tilesFor(query: ViewportQuery): {
  tiles: Array<{ lat: number; lon: number; radiusNm: number }>;
  /** How far from the centre is actually covered, once the cap is applied. */
  coveredRadiusNm: number;
} {
  const max = config.adsb.maxRadiusNm;
  if (query.radiusNm <= max) {
    return {
      tiles: [{ lat: query.lat, lon: query.lon, radiusNm: query.radiusNm }],
      coveredRadiusNm: query.radiusNm,
    };
  }

  const spacing = max * 1.3;
  const steps = Math.ceil(query.radiusNm / spacing);
  const candidates: Array<{ lat: number; lon: number; radiusNm: number; distance: number }> = [];

  for (let ix = -steps; ix <= steps; ix += 1) {
    for (let iy = -steps; iy <= steps; iy += 1) {
      const east = ix * spacing;
      const north = iy * spacing;
      const distance = Math.hypot(east, north);
      // Cover the viewport's inscribed circle, plus one tile of margin.
      if (distance > query.radiusNm + max * 0.5) continue;

      const moved = projectPosition(query.lat, query.lon, 0, north);
      const point = projectPosition(moved.lat, moved.lon, 90, east);
      candidates.push({ lat: point.lat, lon: point.lon, radiusNm: max, distance });
    }
  }

  // Nearest the centre first: if the cap bites, the middle of the view — where
  // the user is looking — is what gets covered.
  const chosen = candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.max(1, config.adsb.maxTiles));

  // The covered radius is the furthest tile centre plus its own reach. Anything
  // beyond that is genuinely not being fetched, and the UI says so rather than
  // letting an empty edge read as empty sky.
  const coveredRadiusNm = Math.min(
    query.radiusNm,
    Math.max(...chosen.map((c) => c.distance)) + max,
  );

  return {
    tiles: chosen.map(({ lat, lon, radiusNm }) => ({ lat, lon, radiusNm })),
    coveredRadiusNm,
  };
}

function cellFor(key: string): CellState {
  let state = cells.get(key);
  if (!state) {
    if (cells.size >= MAX_CELLS) {
      const oldest = cells.keys().next();
      if (!oldest.done) cells.delete(oldest.value);
    }
    state = { result: null, fetchedAt: 0, inflight: null, lastError: null };
    cells.set(key, state);
  }
  return state;
}

async function refreshCell(
  key: string,
  lat: number,
  lon: number,
  radiusNm: number,
): Promise<LiveFeedResult> {
  const state = cellFor(key);
  const chain = getProviderChain();

  // Walk the provider chain. A vendor that is out of credit, rate-limited or
  // simply down is a normal condition here, not an error: the next provider
  // takes over, and if none answer we serve the cache.
  const promise = fetchWithFailover(chain, lat, lon, radiusNm)
    .then(({ result, servedBy, attempts }) => {
      if (result) {
        const enriched: LiveFeedResult = { ...result, servedBy };
        state.result = enriched;
        state.fetchedAt = Date.now();
        state.lastError = null;
        recordObservations(result.aircraft);
        // History persistence must never delay the map response.
        void ingestObservations(result.aircraft).catch((err) =>
          console.warn("[history] ingest failed:", (err as Error).message),
        );
        return enriched;
      }

      // Every provider failed. Each one is already backing off individually.
      const detail = attempts
        .map((a) => `${a.provider}: ${a.ok ? "ok" : (a.error ?? "failed")}`)
        .join(" · ");
      const message = `Live data degraded — no aircraft source responded (${detail}).`;
      state.lastError = message;

      if (state.result) {
        // The whole point of the chain: a dead vendor must not blank the map.
        return {
          ...state.result,
          stale: true,
          degraded: true,
          error: message,
        } satisfies LiveFeedResult;
      }
      return {
        aircraft: [],
        totalObserved: 0,
        updatedAt: Date.now(),
        source: "none",
        simulated: false,
        stale: true,
        degraded: true,
        error: message,
      } satisfies LiveFeedResult;
    })
    .finally(() => {
      state.inflight = null;
    });

  state.inflight = promise;
  return promise;
}

/** Fetch (or reuse) one tile. */
async function tileResult(
  tile: { lat: number; lon: number; radiusNm: number },
): Promise<LiveFeedResult> {
  const { lat, lon, radiusNm, key } = quantise(tile.lat, tile.lon, tile.radiusNm);
  const state = cellFor(key);
  const age = Date.now() - state.fetchedAt;

  let result: LiveFeedResult;
  if (state.inflight) {
    result = await state.inflight;
  } else if (state.result && age < config.adsb.pollIntervalMs) {
    result = state.result;
  } else {
    result = await refreshCell(key, lat, lon, radiusNm);
  }

  return result;
}

/**
 * Positions observed recently anywhere, narrowed to this viewport.
 *
 * The per-cell cache is keyed by quantised centre and radius, so panning or
 * zooming lands on a cell that has never been fetched. If upstream is failing
 * at that moment the map blanks — even though the aircraft the user was just
 * looking at were received seconds ago and are still in memory. This is the
 * retention layer for that: real observations, none of them invented, each
 * carrying its own `seenAt` so the UI can age them honestly.
 */
function lastKnownWithin(query: ViewportQuery, maxAgeMs: number): LiveAircraft[] {
  const cutoff = Date.now() - maxAgeMs;
  return snapshot().filter(
    (a) =>
      a.seenAt >= cutoff &&
      distanceNm(query.lat, query.lon, a.lat, a.lon) <= query.radiusNm,
  );
}

/** Fetch (or reuse) the feed for a viewport and apply the caller's filters. */
export async function getViewportAircraft(query: ViewportQuery): Promise<LiveFeedResult> {
  const { tiles, coveredRadiusNm } = tilesFor(query);
  const results = await Promise.all(tiles.map(tileResult));

  // Merge the tiles: overlapping circles return the same aircraft more than
  // once, and the freshest observation wins.
  const byIcao = new Map<string, LiveFeedResult["aircraft"][number]>();
  for (const tile of results) {
    for (const aircraft of tile.aircraft) {
      const existing = byIcao.get(aircraft.icao24);
      if (!existing || aircraft.seenAt > existing.seenAt) byIcao.set(aircraft.icao24, aircraft);
    }
  }

  let merged = [...byIcao.values()];
  const errored = results.find((r) => r.error);

  // Nothing came back for this viewport and upstream is unhappy. Fall back to
  // what was genuinely observed in the last few minutes rather than showing an
  // empty map: an empty map is indistinguishable from empty sky, which is a
  // worse lie than a labelled stale position.
  let lastKnownCount = 0;
  if (merged.length === 0 && errored) {
    const retained = lastKnownWithin(query, LAST_KNOWN_MAX_AGE_MS);
    if (retained.length > 0) {
      merged = retained;
      lastKnownCount = retained.length;
    }
  }

  const degradedIdentityCount = merged.filter((a) => a.identityDegraded).length;
  const result: LiveFeedResult = {
    aircraft: merged,
    totalObserved: merged.length,
    updatedAt: Math.max(...results.map((r) => r.updatedAt)),
    source: results[0]?.source ?? getAdsbProvider().name,
    simulated: results[0]?.simulated ?? false,
    // Partial coverage is still useful; only flag stale when nothing succeeded.
    stale: results.every((r) => r.stale),
    // With positions on screen this is a notice, not a failure — the UI shows
    // a red blocking box only when there is genuinely nothing to look at.
    error: merged.length === 0 ? errored?.error : undefined,
    servedBy: results.find((r) => r.servedBy)?.servedBy ?? null,
    degraded: results.every((r) => r.degraded === true) || lastKnownCount > 0,
    degradedIdentityCount,
    lastKnownCount: lastKnownCount || undefined,
  };

  const filtered = result.aircraft.filter((a) => matchesFilters(a, query.filters));
  return {
    ...result,
    aircraft: filtered,
    totalObserved: result.aircraft.length,
    positionSources: {
      shown: countByPositionSource(filtered),
      received: countByPositionSource(result.aircraft),
    },
    tilesRequested: tiles.length,
    coveredRadiusNm: Math.round(coveredRadiusNm),
    viewportRadiusNm: Math.round(query.radiusNm),
    providers: providerHealth(getProviderChain()),
    notice: lastKnownCount
      ? `No source answered for this view — showing the last known position of ` +
        `${lastKnownCount} aircraft, received within the last ` +
        `${Math.round(LAST_KNOWN_MAX_AGE_MS / 60_000)} minutes. Each aircraft's own ` +
        "timestamp is shown in its panel."
      : usingOpenFeedFallback()
        ? `Live data from the open community feed at ${new URL(config.adsb.openFeedUrl).host} — ` +
          `no ${config.adsb.provider === "adsbx_direct" ? "ADSBX_API_KEY" : "ADSBX_RAPIDAPI_KEY"} ` +
          "is set, so ADS-B Exchange is not in use. Coverage differs."
        : undefined,
  };
}


export function feedDiagnostics() {
  const provider = getAdsbProvider();
  return {
    providers: providerHealth(getProviderChain()),
    provider: provider.name,
    configured: provider.configured,
    simulated: provider.simulated,
    activeCells: cells.size,
    pollIntervalMs: config.adsb.pollIntervalMs,
    errors: [...cells.values()].filter((c) => c.lastError).length,
    // Rate limiting is per provider now — read it off provider health above,
    // where it says which vendor is limited rather than just "something is".
    retainedPositions: indexSize(),
  };
}

