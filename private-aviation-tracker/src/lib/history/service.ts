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

export async function getHistory(
  rawRegistration: string,
  options: { flightLimit?: number; positionLimit?: number } = {},
): Promise<AircraftHistory> {
  const registration = normalizeRegistration(rawRegistration) ?? rawRegistration.toUpperCase();
  const flightLimit = Math.min(options.flightLimit ?? 20, 100);
  const positionLimit = Math.min(options.positionLimit ?? 200, 2000);

  if (!databaseEnabled()) {
    return { registration, flights: [], recentPositions: [], timeline: [], note: NO_DATABASE_NOTE };
  }

  const [flightRows, positionRows] = await Promise.all([
    withDb(
      (db) =>
        db.flightLeg.findMany({
          where: { registration },
          orderBy: { firstSeenAt: "desc" },
          take: flightLimit,
        }),
      [],
      "history:flights",
    ),
    withDb(
      (db) =>
        db.position.findMany({
          where: { registration },
          orderBy: { seenAt: "desc" },
          take: positionLimit,
        }),
      [],
      "history:positions",
    ),
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
    note:
      flights.length === 0 && recentPositions.length === 0
        ? NO_HISTORY_NOTE
        : `Positions are retained for ${config.history.retentionDays} days. Departure and arrival airports are inferred from observed positions.`,
  };
}

