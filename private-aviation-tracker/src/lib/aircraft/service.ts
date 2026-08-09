import { getAdsbProvider } from "@/lib/adsb";
import { withDb } from "@/lib/db";
import { findByRegistration } from "@/lib/live/recentIndex";
import { lookupFaaRegistration } from "@/lib/ownership/faa";
import { getOwnership } from "@/lib/ownership/service";
import type {
  AircraftCategory,
  AircraftDetail,
  AircraftIdentity,
  LiveAircraft,
  PositionSample,
} from "@/lib/types";
import { getAircraftPhoto } from "./photos";
import { normalizeRegistration, registryFor } from "./registration";
import { lookupType } from "./typeDatabase";

/**
 * Assembles everything known about one aircraft: identity from the type
 * database, the persisted record and the official registry; the live position
 * if it is flying; and the last known position if it is not.
 */

function positionFromLive(a: LiveAircraft): PositionSample {
  return {
    lat: a.lat,
    lon: a.lon,
    altBaroFt: a.altBaroFt,
    groundSpeedKt: a.groundSpeedKt,
    trackDeg: a.trackDeg,
    verticalRateFpm: a.verticalRateFpm,
    onGround: a.onGround,
    seenAt: new Date(a.seenAt).toISOString(),
  };
}

/** Live position: in-process index first, then a direct upstream lookup. */
export async function getLiveAircraft(registration: string): Promise<LiveAircraft | null> {
  const reg = normalizeRegistration(registration);
  if (!reg) return null;

  const cached = findByRegistration(reg);
  if (cached) return cached;

  try {
    return await getAdsbProvider().fetchByRegistration(reg);
  } catch {
    return null;
  }
}

async function lastKnownPosition(registration: string): Promise<PositionSample | null> {
  const row = await withDb(
    (db) =>
      db.position.findFirst({
        where: { registration },
        orderBy: { seenAt: "desc" },
      }),
    null,
    "aircraft:last-position",
  );
  if (!row) return null;
  return {
    lat: row.lat,
    lon: row.lon,
    altBaroFt: row.altBaroFt,
    groundSpeedKt: row.groundSpeedKt,
    trackDeg: row.trackDeg,
    verticalRateFpm: row.verticalRateFpm,
    onGround: row.onGround,
    seenAt: row.seenAt.toISOString(),
  };
}

export async function getIdentity(rawRegistration: string): Promise<AircraftIdentity | null> {
  const registration = normalizeRegistration(rawRegistration);
  if (!registration) return null;

  const [row, live, faa, photo] = await Promise.all([
    withDb(
      (db) => db.aircraft.findUnique({ where: { registration } }),
      null,
      "aircraft:identity",
    ),
    getLiveAircraft(registration),
    lookupFaaRegistration(registration),
    getAircraftPhoto(registration),
  ]);

  if (!row && !live && !faa) {
    // Nothing observed and nothing on record — still return the registry
    // context so the UI can link out rather than showing a dead end.
    const registry = registryFor(registration);
    if (!registry) return null;
    return {
      registration,
      icao24: null,
      typeCode: null,
      manufacturer: null,
      model: null,
      category: "unknown",
      serialNumber: null,
      yearBuilt: null,
      engineCount: null,
      registryCountry: registry.country,
      identitySource: null,
      photo,
      firstSeenAt: null,
      lastSeenAt: null,
    };
  }

  const typeCode = live?.typeCode ?? row?.typeCode ?? null;
  const typeInfo = lookupType(typeCode);
  const registry = registryFor(registration);

  return {
    registration,
    icao24: live?.icao24 ?? row?.icao24 ?? null,
    typeCode,
    manufacturer: typeInfo?.manufacturer ?? row?.manufacturer ?? faa?.manufacturer ?? null,
    model: typeInfo?.model ?? row?.model ?? faa?.model ?? null,
    category: (live?.category ?? (row?.category as AircraftCategory | undefined) ?? "unknown"),
    serialNumber: row?.serialNumber ?? faa?.serialNumber ?? null,
    yearBuilt: row?.yearBuilt ?? faa?.yearBuilt ?? null,
    engineCount: row?.engineCount ?? null,
    registryCountry: row?.registryCountry ?? registry?.country ?? null,
    identitySource: faa ? "faa_registry" : (row?.identitySource ?? (live ? "adsb" : null)),
    photo,
    firstSeenAt: row?.firstSeenAt?.toISOString() ?? null,
    lastSeenAt: row?.lastSeenAt?.toISOString() ?? (live ? new Date(live.seenAt).toISOString() : null),
  };
}

export async function getAircraftDetail(
  rawRegistration: string,
  options: { includeOwnership?: boolean } = {},
): Promise<AircraftDetail | null> {
  const registration = normalizeRegistration(rawRegistration);
  if (!registration) return null;

  const identity = await getIdentity(registration);
  if (!identity) return null;

  const live = await getLiveAircraft(registration);
  const [ownership, stored] = await Promise.all([
    options.includeOwnership
      ? getOwnership(registration, {
          hints: {
            manufacturer: identity.manufacturer,
            model: identity.model,
            typeCode: identity.typeCode,
            operatorHint: live?.feedOperator ?? null,
          },
          blocked: live?.isBlocked,
        })
      : Promise.resolve(null),
    lastKnownPosition(registration),
  ]);

  return {
    identity,
    live,
    ownership,
    lastKnownPosition: live ? positionFromLive(live) : stored,
  };
}
