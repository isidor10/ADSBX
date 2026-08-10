import { getAdsbProvider } from "@/lib/adsb";
import { projectPosition } from "@/lib/geo";
import { AdsbError } from "@/lib/adsb/types";
import { matchesFilters } from "@/lib/aircraft/classifier";
import { config, usingOpenFeedFallback } from "@/lib/config";
import { ingestObservations } from "@/lib/history/ingest";
import type { FilterKey, LiveFeedResult } from "@/lib/types";
import { recordObservations } from "./recentIndex";

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
 * Upstream rate-limit backoff, shared across every cell.
 *
 * Community feeds rate-limit per client, and a 429 answered by simply retrying
 * on the next poll makes it worse. When one arrives, every cell stops asking
 * for a while and serves its last good payload instead — the map keeps showing
 * traffic and the feed gets a chance to recover.
 */
const globalForLimit = globalThis as unknown as { __patRateLimit?: { until: number; strikes: number } };
const rateLimit = (globalForLimit.__patRateLimit ??= { until: 0, strikes: 0 });

const BACKOFF_BASE_MS = 20_000;
const BACKOFF_MAX_MS = 5 * 60_000;

function rateLimited(): boolean {
  return Date.now() < rateLimit.until;
}

function noteRateLimit(): void {
  rateLimit.strikes = Math.min(rateLimit.strikes + 1, 5);
  rateLimit.until = Date.now() + Math.min(BACKOFF_BASE_MS * 2 ** (rateLimit.strikes - 1), BACKOFF_MAX_MS);
}

function noteSuccess(): void {
  rateLimit.strikes = 0;
  rateLimit.until = 0;
}

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
  const provider = getAdsbProvider();

  const promise = provider
    .fetchArea(lat, lon, radiusNm)
    .then((result) => {
      state.result = result;
      state.fetchedAt = Date.now();
      state.lastError = null;
      noteSuccess();
      recordObservations(result.aircraft);
      // History persistence must never delay the map response.
      void ingestObservations(result.aircraft).catch((err) =>
        console.warn("[history] ingest failed:", (err as Error).message),
      );
      return result;
    })
    .catch((error: unknown) => {
      if (error instanceof AdsbError && error.status === 429) noteRateLimit();

      const message =
        error instanceof AdsbError
          ? error.message
          : `Live aircraft data temporarily unavailable: ${(error as Error).message}`;
      state.lastError = message;

      if (state.result) {
        // Serve the last good payload rather than an empty map.
        return { ...state.result, stale: true, error: message } satisfies LiveFeedResult;
      }
      return {
        aircraft: [],
        totalObserved: 0,
        updatedAt: Date.now(),
        source: provider.name,
        simulated: provider.simulated,
        stale: true,
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
  } else if (rateLimited()) {
    // Backing off after a 429. Keep showing the last good payload rather than
    // adding to the load that triggered the limit in the first place.
    const waitSec = Math.ceil((rateLimit.until - Date.now()) / 1000);
    result = state.result
      ? {
          ...state.result,
          stale: true,
          error: `Upstream feed rate limit reached — pausing requests for ${waitSec}s and showing the last received positions.`,
        }
      : {
          aircraft: [],
          totalObserved: 0,
          updatedAt: Date.now(),
          source: getAdsbProvider().name,
          simulated: false,
          stale: true,
          error: `Upstream feed rate limit reached. Retrying in ${waitSec}s. Community feeds limit how often a client may poll — raise ADSB_POLL_INTERVAL_MS, or set ADSBX_RAPIDAPI_KEY to use ADS-B Exchange instead.`,
        };
  } else {
    result = await refreshCell(key, lat, lon, radiusNm);
  }

  return result;
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

  const merged = [...byIcao.values()];
  const errored = results.find((r) => r.error);
  const result: LiveFeedResult = {
    aircraft: merged,
    totalObserved: merged.length,
    updatedAt: Math.max(...results.map((r) => r.updatedAt)),
    source: results[0]?.source ?? getAdsbProvider().name,
    simulated: results[0]?.simulated ?? false,
    // Partial coverage is still useful; only flag stale when nothing succeeded.
    stale: results.every((r) => r.stale),
    error: merged.length === 0 ? errored?.error : undefined,
  };

  const filtered = result.aircraft.filter((a) => matchesFilters(a, query.filters));
  return {
    ...result,
    aircraft: filtered,
    totalObserved: result.aircraft.length,
    tilesRequested: tiles.length,
    coveredRadiusNm: Math.round(coveredRadiusNm),
    viewportRadiusNm: Math.round(query.radiusNm),
    notice: usingOpenFeedFallback()
      ? `Live data from the open community feed at ${new URL(config.adsb.openFeedUrl).host} — ` +
        `no ${config.adsb.provider === "adsbx_direct" ? "ADSBX_API_KEY" : "ADSBX_RAPIDAPI_KEY"} ` +
        "is set, so ADS-B Exchange is not in use. Coverage differs."
      : undefined,
  };
}


export function feedDiagnostics() {
  const provider = getAdsbProvider();
  return {
    provider: provider.name,
    configured: provider.configured,
    simulated: provider.simulated,
    activeCells: cells.size,
    pollIntervalMs: config.adsb.pollIntervalMs,
    errors: [...cells.values()].filter((c) => c.lastError).length,
    rateLimited: rateLimited(),
    rateLimitStrikes: rateLimit.strikes,
  };
}

