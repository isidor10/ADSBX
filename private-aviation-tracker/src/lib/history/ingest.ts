import { isBusinessAviation } from "@/lib/aircraft/classifier";
import { config } from "@/lib/config";
import { withDb } from "@/lib/db";
import { distanceNm } from "@/lib/geo";
import type { LiveAircraft } from "@/lib/types";
import { nearestAirport } from "./airportLookup";

/**
 * Turns the live feed into persisted history: aircraft identity, sampled
 * positions and derived flight legs.
 *
 * Everything written here is observed data. Departure and arrival airports are
 * *inferred* from where an aircraft was last seen on or near the ground and are
 * labelled as such in the UI; nothing is invented when the data is missing.
 *
 * Note for multi-instance deployments: this runs in-process alongside the web
 * server. Run a single ingest worker (or set PERSIST_POSITIONS=false on the web
 * tier) if you scale horizontally, so legs are not derived twice.
 */

interface TrackState {
  aircraftId: string;
  legId: string | null;
  lastPersistAt: number;
  lastSeenAt: number;
  onGround: boolean;
  lat: number;
  lon: number;
}

const globalForIngest = globalThis as unknown as { __patTracks?: Map<string, TrackState> };
const tracks: Map<string, TrackState> = (globalForIngest.__patTracks ??= new Map());
const MAX_TRACKS = 20_000;

function shouldPersist(a: LiveAircraft): boolean {
  if (!config.history.persistPositions) return false;
  if (!a.registration) return false;
  // Keep the write volume proportional to the product's focus.
  return isBusinessAviation(a) || a.category === "helicopter" || a.category === "military";
}

async function upsertAircraft(a: LiveAircraft): Promise<string | null> {
  const registration = a.registration!;
  const seenAt = new Date(a.seenAt);
  return withDb(
    async (db) => {
      const row = await db.aircraft.upsert({
        where: { registration },
        create: {
          registration,
          icao24: a.icao24,
          typeCode: a.typeCode,
          manufacturer: a.manufacturer,
          model: a.model,
          category: a.category,
          identitySource: "adsb",
          firstSeenAt: seenAt,
          lastSeenAt: seenAt,
        },
        update: {
          icao24: a.icao24,
          typeCode: a.typeCode ?? undefined,
          manufacturer: a.manufacturer ?? undefined,
          model: a.model ?? undefined,
          category: a.category,
          lastSeenAt: seenAt,
        },
        select: { id: true },
      });
      return row.id;
    },
    null,
    "ingest:aircraft",
  );
}

/**
 * Find a leg that is still open for this aircraft and recent enough to be the
 * same flight. Without this, a process restart would orphan every in-flight
 * leg and open a duplicate for the same journey.
 */
async function resumeLeg(aircraftId: string, seenAt: number): Promise<string | null> {
  const cutoff = new Date(seenAt - config.history.legTimeoutMin * 60 * 1000);
  const leg = await withDb(
    (db) =>
      db.flightLeg.findFirst({
        where: { aircraftId, status: "ACTIVE", lastSeenAt: { gte: cutoff } },
        orderBy: { lastSeenAt: "desc" },
        select: { id: true },
      }),
    null,
    "ingest:leg-resume",
  );
  return leg?.id ?? null;
}

async function openLeg(
  aircraftId: string,
  a: LiveAircraft,
  previous: TrackState | undefined,
): Promise<string | null> {
  // Departure airport: prefer the field the aircraft was last seen on the
  // ground at; otherwise infer from the current position while still low.
  let departure = null as Awaited<ReturnType<typeof nearestAirport>>;
  if (previous?.onGround) {
    departure = await nearestAirport(previous.lat, previous.lon);
  } else if ((a.altBaroFt ?? 99999) < 6000) {
    departure = await nearestAirport(a.lat, a.lon, 12);
  }

  return withDb(
    async (db) => {
      const leg = await db.flightLeg.create({
        data: {
          aircraftId,
          registration: a.registration!,
          callsign: a.callsign,
          status: "ACTIVE",
          departureIcao: departure?.icao ?? null,
          departureName: departure?.name ?? null,
          departureLat: departure?.lat ?? null,
          departureLon: departure?.lon ?? null,
          departedAt: new Date(a.seenAt),
          firstSeenAt: new Date(a.seenAt),
          lastSeenAt: new Date(a.seenAt),
          maxAltitudeFt: a.altBaroFt ?? null,
          maxGroundSpeedKt: a.groundSpeedKt ?? null,
        },
        select: { id: true },
      });
      return leg.id;
    },
    null,
    "ingest:leg-open",
  );
}

async function closeLeg(legId: string, a: LiveAircraft): Promise<void> {
  const arrival = await nearestAirport(a.lat, a.lon, 12);
  await withDb(
    async (db) => {
      const leg = await db.flightLeg.findUnique({
        where: { id: legId },
        select: { departedAt: true, departureLat: true, departureLon: true, firstSeenAt: true },
      });
      const startedAt = leg?.departedAt ?? leg?.firstSeenAt ?? new Date(a.seenAt);
      const durationSec = Math.max(0, Math.round((a.seenAt - startedAt.getTime()) / 1000));
      const dist =
        leg?.departureLat != null && leg?.departureLon != null
          ? distanceNm(leg.departureLat, leg.departureLon, a.lat, a.lon)
          : null;

      await db.flightLeg.update({
        where: { id: legId },
        data: {
          status: "COMPLETED",
          arrivalIcao: arrival?.icao ?? null,
          arrivalName: arrival?.name ?? null,
          arrivalLat: arrival?.lat ?? null,
          arrivalLon: arrival?.lon ?? null,
          arrivedAt: new Date(a.seenAt),
          lastSeenAt: new Date(a.seenAt),
          durationSec,
          distanceNm: dist,
        },
      });
      return null;
    },
    null,
    "ingest:leg-close",
  );
}

async function persistPosition(
  aircraftId: string,
  legId: string | null,
  a: LiveAircraft,
): Promise<void> {
  await withDb(
    async (db) => {
      await db.position.create({
        data: {
          aircraftId,
          registration: a.registration!,
          icao24: a.icao24,
          callsign: a.callsign,
          lat: a.lat,
          lon: a.lon,
          altBaroFt: a.altBaroFt,
          altGeomFt: a.altGeomFt,
          groundSpeedKt: a.groundSpeedKt,
          trackDeg: a.trackDeg,
          verticalRateFpm: a.verticalRateFpm,
          squawk: a.squawk,
          onGround: a.onGround,
          source: a.source,
          seenAt: new Date(a.seenAt),
          flightLegId: legId,
        },
      });
      if (legId) {
        await db.flightLeg.update({
          where: { id: legId },
          data: {
            lastSeenAt: new Date(a.seenAt),
            callsign: a.callsign ?? undefined,
            maxAltitudeFt: a.altBaroFt ?? undefined,
            maxGroundSpeedKt: a.groundSpeedKt ?? undefined,
          },
        });
      }
      return null;
    },
    null,
    "ingest:position",
  );
}

async function ingestOne(a: LiveAircraft): Promise<void> {
  const key = a.registration!;
  const now = a.seenAt;
  const previous = tracks.get(key);

  if (previous && now - previous.lastPersistAt < config.history.sampleIntervalSec * 1000) {
    previous.lastSeenAt = now;
    return;
  }

  const aircraftId = previous?.aircraftId ?? (await upsertAircraft(a));
  if (!aircraftId) return;

  let legId = previous?.legId ?? null;
  const legTimeoutMs = config.history.legTimeoutMin * 60 * 1000;
  const legExpired = previous ? now - previous.lastSeenAt > legTimeoutMs : true;

  if (legId && legExpired) {
    legId = null;
  }

  if (!a.onGround && !legId) {
    // Cold start for this aircraft: adopt an open leg from before the restart
    // rather than splitting one flight into two.
    legId = previous ? null : await resumeLeg(aircraftId, now);
    if (!legId) legId = await openLeg(aircraftId, a, previous);
  } else if (a.onGround && legId) {
    await closeLeg(legId, a);
    legId = null;
  }

  await persistPosition(aircraftId, legId, a);

  if (tracks.size >= MAX_TRACKS) {
    const oldest = tracks.keys().next();
    if (!oldest.done) tracks.delete(oldest.value);
  }
  tracks.set(key, {
    aircraftId,
    legId,
    lastPersistAt: now,
    lastSeenAt: now,
    onGround: a.onGround,
    lat: a.lat,
    lon: a.lon,
  });
}

const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;
let lastMaintenanceAt = 0;

/**
 * Housekeeping, run at most hourly off the back of ingest: close legs whose
 * aircraft stopped reporting, and enforce the position retention window.
 */
async function runMaintenance(): Promise<void> {
  if (Date.now() - lastMaintenanceAt < MAINTENANCE_INTERVAL_MS) return;
  lastMaintenanceAt = Date.now();
  const [stale, pruned] = await Promise.all([closeStaleLegs(), pruneHistory()]);
  if (stale || pruned) {
    console.info(`[history] closed ${stale} stale leg(s), pruned ${pruned} position(s)`);
  }
}

/** Persist a batch of observations. Never throws into the request path. */
export async function ingestObservations(aircraft: LiveAircraft[]): Promise<void> {
  if (!config.history.persistPositions) return;

  void runMaintenance().catch((err) =>
    console.warn("[history] maintenance failed:", (err as Error).message),
  );

  const relevant = aircraft.filter(shouldPersist);
  if (relevant.length === 0) return;

  // Bounded concurrency keeps a busy viewport from flooding the connection pool.
  const CHUNK = 10;
  for (let i = 0; i < relevant.length; i += CHUNK) {
    await Promise.all(
      relevant.slice(i, i + CHUNK).map((a) =>
        ingestOne(a).catch((err) =>
          console.warn("[ingest]", a.registration, (err as Error).message),
        ),
      ),
    );
  }
}

/** Mark legs whose aircraft stopped reporting as STALE rather than guessing. */
export async function closeStaleLegs(): Promise<number> {
  const cutoff = new Date(Date.now() - config.history.legTimeoutMin * 60 * 1000);
  return withDb(
    async (db) => {
      const result = await db.flightLeg.updateMany({
        where: { status: "ACTIVE", lastSeenAt: { lt: cutoff } },
        data: { status: "STALE" },
      });
      return result.count;
    },
    0,
    "ingest:stale",
  );
}

/** Delete positions past the retention window. */
export async function pruneHistory(): Promise<number> {
  const cutoff = new Date(Date.now() - config.history.retentionDays * 24 * 60 * 60 * 1000);
  return withDb(
    async (db) => {
      const result = await db.position.deleteMany({ where: { seenAt: { lt: cutoff } } });
      return result.count;
    },
    0,
    "ingest:prune",
  );
}
