import { normalizeRegistration } from "@/lib/aircraft/registration";
import { config } from "@/lib/config";
import { databaseEnabled, withDb } from "@/lib/db";
import type {
  AircraftHistory,
  FlightLegSummary,
  PositionSample,
  TimelineEvent,
} from "@/lib/types";

/**
 * Flight history derived entirely from observed ADS-B positions this
 * deployment recorded. There is no back-fill: an aircraft only has history
 * from the moment this instance first saw it, and the API says so rather than
 * inventing past flights.
 */

const NO_DATABASE_NOTE =
  "Flight history requires the database. Configure DATABASE_URL and run the migrations to record flights.";
const NO_HISTORY_NOTE =
  "No recorded flights yet — history is built from live ADS-B positions observed by this deployment.";

function toSummary(row: {
  id: string;
  callsign: string | null;
  status: string;
  departureIcao: string | null;
  departureName: string | null;
  departedAt: Date | null;
  arrivalIcao: string | null;
  arrivalName: string | null;
  arrivedAt: Date | null;
  maxAltitudeFt: number | null;
  maxGroundSpeedKt: number | null;
  distanceNm: number | null;
  durationSec: number | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}): FlightLegSummary {
  return {
    id: row.id,
    callsign: row.callsign,
    status: row.status as FlightLegSummary["status"],
    departureIcao: row.departureIcao,
    departureName: row.departureName,
    departedAt: row.departedAt?.toISOString() ?? null,
    arrivalIcao: row.arrivalIcao,
    arrivalName: row.arrivalName,
    arrivedAt: row.arrivedAt?.toISOString() ?? null,
    maxAltitudeFt: row.maxAltitudeFt,
    maxGroundSpeedKt: row.maxGroundSpeedKt,
    distanceNm: row.distanceNm,
    durationSec: row.durationSec,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

function flightLevel(altFt: number): string {
  return altFt >= 18000 ? `FL${Math.round(altFt / 100)}` : `${altFt.toLocaleString()} ft`;
}

/**
 * Build a human timeline from the recorded legs. Every entry corresponds to an
 * observation — departures and arrivals are the first/last positions of a leg,
 * the cruise entry is the highest altitude actually seen.
 */
function buildTimeline(flights: FlightLegSummary[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const flight of flights.slice(0, 12)) {
    if (flight.departedAt) {
      events.push({
        at: flight.departedAt,
        kind: "departure",
        label: flight.departureIcao ? `Departed ${flight.departureIcao}` : "Departure observed",
        detail: flight.departureName ?? (flight.departureIcao ? null : "Airport could not be inferred"),
      });
    }

    if (flight.maxAltitudeFt && flight.maxAltitudeFt > 5000) {
      events.push({
        at: flight.firstSeenAt,
        kind: "cruise",
        label: `Cruising ${flightLevel(flight.maxAltitudeFt)}`,
        detail: flight.maxGroundSpeedKt ? `${Math.round(flight.maxGroundSpeedKt)} kt ground speed` : null,
      });
    }

    if (flight.arrivedAt) {
      events.push({
        at: flight.arrivedAt,
        kind: "arrival",
        label: flight.arrivalIcao ? `Landed ${flight.arrivalIcao}` : "Arrival observed",
        detail: flight.arrivalName ?? (flight.arrivalIcao ? null : "Airport could not be inferred"),
      });
    } else if (flight.status === "ACTIVE") {
      events.push({
        at: flight.lastSeenAt,
        kind: "observed",
        label: "In flight",
        detail: "Currently airborne",
      });
    } else if (flight.status === "STALE") {
      events.push({
        at: flight.lastSeenAt,
        kind: "observed",
        label: "Signal lost",
        detail: "Aircraft stopped reporting before an arrival was observed",
      });
    }
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/** Windows offered by the track selector, in minutes. */
export const TRACK_WINDOWS = [30, 60, 120, 360, 1440] as const;

/**
 * Which windows actually contain recorded positions. The UI greys out the
 * rest: offering "24 hours" for an aircraft first seen ten minutes ago would
 * promise data that does not exist.
 */
async function availableWindows(registration: string): Promise<number[]> {
  const oldest = await withDb(
    (db) =>
      db.position.findFirst({
        where: { registration },
        orderBy: { seenAt: "asc" },
        select: { seenAt: true },
      }),
    null,
    "history:oldest",
  );
  if (!oldest) return [];
  const spanMin = (Date.now() - oldest.seenAt.getTime()) / 60000;
  const usable = TRACK_WINDOWS.filter((w) => w <= spanMin);
  // Always offer the smallest window when there is any data at all, so a fresh
  // contact still has something to select.
  return usable.length > 0 ? usable : [TRACK_WINDOWS[0]];
}

export async function getHistory(
  rawRegistration: string,
  options: { flightLimit?: number; positionLimit?: number; minutes?: number } = {},
): Promise<AircraftHistory> {
  const registration = normalizeRegistration(rawRegistration) ?? rawRegistration.toUpperCase();
  const flightLimit = Math.min(options.flightLimit ?? 20, 100);
  const positionLimit = Math.min(options.positionLimit ?? 200, 2000);
  const minutes = options.minutes
    ? Math.min(Math.max(options.minutes, 5), 7 * 24 * 60)
    : null;

  if (!databaseEnabled()) {
    return {
      registration,
      flights: [],
      recentPositions: [],
      timeline: [],
      windowMinutes: minutes,
      availableWindows: [],
      note: NO_DATABASE_NOTE,
    };
  }

  const since = minutes ? new Date(Date.now() - minutes * 60 * 1000) : null;

  const [flightRows, positionRows, windows] = await Promise.all([
    withDb(
      (db) =>
        db.flightLeg.findMany({
          where: { registration, ...(since ? { lastSeenAt: { gte: since } } : {}) },
          orderBy: { firstSeenAt: "desc" },
          take: flightLimit,
        }),
      [],
      "history:flights",
    ),
    withDb(
      (db) =>
        db.position.findMany({
          where: { registration, ...(since ? { seenAt: { gte: since } } : {}) },
          orderBy: { seenAt: "desc" },
          take: positionLimit,
        }),
      [],
      "history:positions",
    ),
    availableWindows(registration),
  ]);

  const flights = flightRows.map(toSummary);
  const recentPositions: PositionSample[] = positionRows.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    altBaroFt: p.altBaroFt,
    groundSpeedKt: p.groundSpeedKt,
    trackDeg: p.trackDeg,
    verticalRateFpm: p.verticalRateFpm,
    onGround: p.onGround,
    seenAt: p.seenAt.toISOString(),
  }));

  return {
    registration,
    flights,
    recentPositions,
    timeline: buildTimeline(flights),
    windowMinutes: minutes,
    availableWindows: windows,
    note:
      flights.length === 0 && recentPositions.length === 0
        ? minutes
          ? `Nothing recorded in the last ${minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hours`}.`
          : NO_HISTORY_NOTE
        : `Positions are retained for ${config.history.retentionDays} days. Departure and arrival airports are inferred from observed positions.`,
  };
}

