import { config } from "@/lib/config";
import type { LiveAircraft, LiveFeedResult, ProviderHealth } from "@/lib/types";
import { AdsbError, type AdsbProvider } from "./types";

/**
 * Multi-provider failover.
 *
 * The application previously had one live source, so a rate limit or a spent
 * credit balance at that one vendor took the map down. It now walks an ordered
 * chain and uses the first provider that answers.
 *
 * Three rules make this actually resilient rather than just longer:
 *
 *   1. A provider that fails is opened (circuit-breaker style) with exponential
 *      backoff, so a rate-limited vendor is not hammered — hammering is what
 *      turns a brief limit into a long one. It is retried automatically once
 *      the backoff expires, and one success closes the breaker.
 *   2. Providers are tried in order and the chain stops at the first success.
 *      Polling every provider on every tick would multiply the load that caused
 *      the problem.
 *   3. Every attempt is recorded — latency, aircraft returned, last error — so
 *      the health endpoint can show which source is actually carrying the map.
 *
 * Failure of the whole chain is not an error state for the UI: the caller falls
 * back to its cached payload and reports degradation.
 */

interface BreakerState {
  /** Consecutive failures. Resets on any success. */
  strikes: number;
  /** Epoch ms before which this provider is not attempted. */
  openUntil: number;
  lastError: string | null;
  lastErrorAt: number | null;
  lastSuccessAt: number | null;
  lastLatencyMs: number | null;
  lastCount: number | null;
  attempts: number;
  failures: number;
}

/**
 * Backoff schedule. Deliberately starts short — a transient 502 should not
 * sideline a provider for a minute — and grows quickly for a persistent limit.
 */
const BACKOFF_MS = [5_000, 10_000, 30_000, 60_000, 300_000];

const globalForBreakers = globalThis as unknown as {
  __patBreakers?: Map<string, BreakerState>;
};
const breakers: Map<string, BreakerState> = (globalForBreakers.__patBreakers ??= new Map());

function breakerFor(name: string): BreakerState {
  let state = breakers.get(name);
  if (!state) {
    state = {
      strikes: 0,
      openUntil: 0,
      lastError: null,
      lastErrorAt: null,
      lastSuccessAt: null,
      lastLatencyMs: null,
      lastCount: null,
      attempts: 0,
      failures: 0,
    };
    breakers.set(name, state);
  }
  return state;
}

function recordSuccess(name: string, latencyMs: number, count: number): void {
  const state = breakerFor(name);
  state.strikes = 0;
  state.openUntil = 0;
  state.lastError = null;
  state.lastSuccessAt = Date.now();
  state.lastLatencyMs = latencyMs;
  state.lastCount = count;
  state.attempts += 1;
}

function recordFailure(name: string, error: unknown): void {
  const state = breakerFor(name);
  state.strikes = Math.min(state.strikes + 1, BACKOFF_MS.length);
  state.openUntil = Date.now() + BACKOFF_MS[state.strikes - 1];
  state.lastError = error instanceof Error ? error.message : String(error);
  state.lastErrorAt = Date.now();
  state.attempts += 1;
  state.failures += 1;
}

function isOpen(name: string): boolean {
  return Date.now() < breakerFor(name).openUntil;
}

/**
 * Merge results from more than one provider.
 *
 * De-duplication is on the ICAO 24-bit address, which is the only globally
 * unique identifier a transponder emits. Where two providers describe the same
 * aircraft, the fresher position wins, but identifying fields are taken from
 * whichever source actually has them — OpenSky never carries a registration or
 * type, so a position from OpenSky merged with identity from a readsb feed is
 * strictly better than either alone.
 */
export function mergeAircraft(groups: LiveAircraft[][]): LiveAircraft[] {
  const byIcao = new Map<string, LiveAircraft>();

  for (const group of groups) {
    for (const incoming of group) {
      const existing = byIcao.get(incoming.icao24);
      if (!existing) {
        byIcao.set(incoming.icao24, incoming);
        continue;
      }

      // Freshest position wins; identity fields are filled from whichever
      // source has them rather than being overwritten with null.
      const newer = incoming.seenAt > existing.seenAt ? incoming : existing;
      const older = incoming.seenAt > existing.seenAt ? existing : incoming;

      byIcao.set(incoming.icao24, {
        ...newer,
        registration: newer.registration ?? older.registration,
        callsign: newer.callsign ?? older.callsign,
        typeCode: newer.typeCode ?? older.typeCode,
        manufacturer: newer.manufacturer ?? older.manufacturer,
        model: newer.model ?? older.model,
        feedOperator: newer.feedOperator ?? older.feedOperator,
        // A merged record is only degraded if neither side knew the type.
        category: newer.typeCode ? newer.category : (older.typeCode ? older.category : newer.category),
        identityDegraded: Boolean(newer.identityDegraded && older.identityDegraded),
      });
    }
  }

  return [...byIcao.values()];
}

export interface ChainResult {
  result: LiveFeedResult | null;
  /** Provider that served the data, if any. */
  servedBy: string | null;
  /** Everything tried and what happened, newest attempt last. */
  attempts: Array<{ provider: string; ok: boolean; latencyMs: number; error?: string }>;
}

/**
 * Try each provider in order until one answers.
 *
 * Returns `result: null` when every provider is unavailable — the caller then
 * serves its cache. That is deliberately not an exception: the whole point of
 * this module is that an exhausted vendor is a normal, survivable condition.
 */
export async function fetchWithFailover(
  providers: AdsbProvider[],
  lat: number,
  lon: number,
  radiusNm: number,
): Promise<ChainResult> {
  const attempts: ChainResult["attempts"] = [];
  // A provider that answers "nothing here" for a busy area is usually a feed
  // with no receiver coverage there, not empty sky. It counts as a success for
  // health purposes but does not stop the chain — a second opinion costs one
  // request and only in the case where we would otherwise show an empty map.
  let empty: ChainResult | null = null;

  for (const provider of providers) {
    if (!provider.configured) continue;
    if (isOpen(provider.name)) {
      attempts.push({
        provider: provider.name,
        ok: false,
        latencyMs: 0,
        error: `backing off for ${Math.ceil((breakerFor(provider.name).openUntil - Date.now()) / 1000)}s`,
      });
      continue;
    }

    const startedAt = Date.now();
    try {
      const result = await provider.fetchArea(lat, lon, radiusNm);
      const latencyMs = Date.now() - startedAt;
      recordSuccess(provider.name, latencyMs, result.aircraft.length);
      attempts.push({ provider: provider.name, ok: true, latencyMs });
      if (result.aircraft.length === 0) {
        empty ??= { result, servedBy: provider.name, attempts };
        continue;
      }
      return { result, servedBy: provider.name, attempts };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      recordFailure(provider.name, error);
      attempts.push({
        provider: provider.name,
        ok: false,
        latencyMs,
        error: error instanceof AdsbError ? error.message : (error as Error).message,
      });
      // Fall through to the next provider.
    }
  }

  // Nobody had traffic. If at least one provider genuinely answered "empty",
  // that is a real observation of empty sky — report it as data, not an outage.
  if (empty) return { ...empty, attempts };

  return { result: null, servedBy: null, attempts };
}

/** Snapshot for the health endpoint and the status panel. */
export function providerHealth(providers: AdsbProvider[]): ProviderHealth[] {
  return providers.map((provider, index) => {
    const state = breakerFor(provider.name);
    const open = isOpen(provider.name);

    let status: ProviderHealth["status"];
    if (!provider.configured) status = "DISABLED";
    else if (open) {
      status = state.lastError?.toLowerCase().includes("rate limit") ? "RATE_LIMITED" : "BACKING_OFF";
    } else if (state.lastSuccessAt && Date.now() - state.lastSuccessAt < 60_000) {
      status = index === 0 ? "LIVE" : "LIVE";
    } else status = "STANDBY";

    return {
      name: provider.name,
      priority: index + 1,
      status,
      configured: provider.configured,
      lastSuccessAt: state.lastSuccessAt ? new Date(state.lastSuccessAt).toISOString() : null,
      lastErrorAt: state.lastErrorAt ? new Date(state.lastErrorAt).toISOString() : null,
      lastError: state.lastError,
      lastLatencyMs: state.lastLatencyMs,
      lastCount: state.lastCount,
      attempts: state.attempts,
      failures: state.failures,
      retryInSec: open ? Math.ceil((state.openUntil - Date.now()) / 1000) : null,
    };
  });
}

/** Test seam: forget all breaker state. */
export function resetBreakers(): void {
  breakers.clear();
}
