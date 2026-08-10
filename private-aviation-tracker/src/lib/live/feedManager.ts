import { getAdsbProvider } from "@/lib/adsb";
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

function quantise(query: ViewportQuery) {
  // ~0.5° cells keep neighbouring clients on the same upstream call while
  // staying well inside the provider's radius cap.
  const lat = Math.round(query.lat * 2) / 2;
  const lon = Math.round(query.lon * 2) / 2;
  const radiusNm = Math.min(
    config.adsb.maxRadiusNm,
    Math.max(25, Math.ceil(query.radiusNm / 25) * 25),
  );
  return { lat, lon, radiusNm, key: `${lat}:${lon}:${radiusNm}` };
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

/** Fetch (or reuse) the feed for a viewport and apply the caller's filters. */
export async function getViewportAircraft(query: ViewportQuery): Promise<LiveFeedResult> {
  const { lat, lon, radiusNm, key } = quantise(query);
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

  const filtered = result.aircraft.filter((a) => matchesFilters(a, query.filters));
  return {
    ...result,
    aircraft: filtered,
    totalObserved: result.aircraft.length,
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

