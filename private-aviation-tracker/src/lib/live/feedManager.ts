import { getAdsbProvider } from "@/lib/adsb";
import { AdsbError } from "@/lib/adsb/types";
import { matchesFilters } from "@/lib/aircraft/classifier";
import { config } from "@/lib/config";
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
      recordObservations(result.aircraft);
      // History persistence must never delay the map response.
      void ingestObservations(result.aircraft).catch((err) =>
        console.warn("[history] ingest failed:", (err as Error).message),
      );
      return result;
    })
    .catch((error: unknown) => {
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
  } else {
    result = await refreshCell(key, lat, lon, radiusNm);
  }

  const filtered = result.aircraft.filter((a) => matchesFilters(a, query.filters));
  return { ...result, aircraft: filtered, totalObserved: result.aircraft.length };
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
  };
}

