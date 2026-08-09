import type { LiveAircraft } from "@/lib/types";

/**
 * Bounded in-process index of aircraft observed recently, keyed by
 * registration and ICAO hex. Backs "the aircraft is not airborne right now,
 * here is what we last saw" without a database round-trip.
 */

const MAX_ENTRIES = 20_000;
const TTL_MS = 30 * 60 * 1000;

interface Entry {
  aircraft: LiveAircraft;
  storedAt: number;
}

const globalForIndex = globalThis as unknown as {
  __patRecent?: Map<string, Entry>;
};

const store: Map<string, Entry> = (globalForIndex.__patRecent ??= new Map());

function put(key: string, aircraft: LiveAircraft, now: number) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, { aircraft, storedAt: now });
}

export function recordObservations(aircraft: LiveAircraft[]): void {
  const now = Date.now();
  for (const a of aircraft) {
    put(`hex:${a.icao24}`, a, now);
    if (a.registration) put(`reg:${a.registration}`, a, now);
    if (a.callsign) put(`cs:${a.callsign}`, a, now);
  }
}

function read(key: string): LiveAircraft | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.storedAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.aircraft;
}

export function findByRegistration(registration: string): LiveAircraft | null {
  return read(`reg:${registration.toUpperCase()}`);
}

export function findByIcao(icao24: string): LiveAircraft | null {
  return read(`hex:${icao24.toLowerCase()}`);
}

export function findByCallsign(callsign: string): LiveAircraft | null {
  return read(`cs:${callsign.toUpperCase()}`);
}

/** All distinct aircraft currently held in the index. */
export function snapshot(): LiveAircraft[] {
  const now = Date.now();
  const seen = new Set<string>();
  const out: LiveAircraft[] = [];
  for (const [key, entry] of store) {
    if (!key.startsWith("hex:")) continue;
    if (now - entry.storedAt > TTL_MS) {
      store.delete(key);
      continue;
    }
    if (seen.has(entry.aircraft.icao24)) continue;
    seen.add(entry.aircraft.icao24);
    out.push(entry.aircraft);
  }
  return out;
}

export function indexSize(): number {
  return store.size;
}
