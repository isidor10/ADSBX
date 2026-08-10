import { normalizeRegistration } from "@/lib/aircraft/registration";
import { withDb } from "@/lib/db";
import { distanceNm } from "@/lib/geo";
import { getLiveAircraft } from "@/lib/aircraft/service";
import type {
  AirportRef,
  CurrentFlight,
  LandingSummary,
  LiveAircraft,
  RouteSourceKind,
  SelectedRoute,
} from "@/lib/types";
import { findAirport } from "./airports";
import { estimateDestination } from "./destination";
import { lookupRoute } from "./routeProvider";

/**
 * "Where is this aircraft going, and when does it get there."
 *
 * Assembled from three sources of decreasing authority, and the answer always
 * says which one it came from:
 *
 *   FLIGHT_DATA          a route source resolved the callsign — treated as filed
 *   OBSERVED             we watched it happen (departure airport, landings)
 *   TRAJECTORY_ESTIMATE  inferred from the current heading, labelled an estimate
 *
 * When none of them produce anything the destination is Unknown, with a note
 * explaining why. There is no fourth tier where the app makes something up.
 */

const NO_DESTINATION_NOTE =
  "No filed route is published for this callsign and the current track does not point clearly at one airport. ADS-B broadcasts position only — it never carries a destination.";
const ON_GROUND_NOTE = "Aircraft is on the ground — no flight in progress.";

interface ActiveLeg {
  id: string;
  callsign: string | null;
  departureIcao: string | null;
  departureName: string | null;
  departureLat: number | null;
  departureLon: number | null;
  departedAt: Date | null;
  firstSeenAt: Date;
}

async function activeLeg(registration: string): Promise<ActiveLeg | null> {
  return withDb(
    (db) =>
      db.flightLeg.findFirst({
        where: { registration, status: "ACTIVE" },
        orderBy: { lastSeenAt: "desc" },
        select: {
          id: true,
          callsign: true,
          departureIcao: true,
          departureName: true,
          departureLat: true,
          departureLon: true,
          departedAt: true,
          firstSeenAt: true,
        },
      }),
    null,
    "flight:active-leg",
  );
}

function legDeparture(leg: ActiveLeg | null): AirportRef | null {
  if (!leg?.departureLat || !leg.departureLon) return null;
  return {
    icao: leg.departureIcao,
    iata: null,
    name: leg.departureName ?? leg.departureIcao ?? "Unknown",
    city: null,
    country: null,
    lat: leg.departureLat,
    lon: leg.departureLon,
  };
}

/** Persist the destination on the leg so history keeps what was known. */
async function recordDestination(
  legId: string,
  destination: AirportRef,
  source: RouteSourceKind,
  confidence: number,
  eta: Date | null,
): Promise<void> {
  await withDb(
    async (db) => {
      await db.flightLeg.update({
        where: { id: legId },
        data: {
          destinationIcao: destination.icao,
          destinationName: destination.name,
          destinationLat: destination.lat,
          destinationLon: destination.lon,
          destinationSource: source,
          destinationConfidence: confidence,
          destinationEta: eta,
          destinationUpdatedAt: new Date(),
        },
      });
      return null;
    },
    null,
    "flight:record-destination",
  );
}

export async function getCurrentFlight(
  rawRegistration: string,
  liveHint?: LiveAircraft | null,
): Promise<CurrentFlight | null> {
  const registration = normalizeRegistration(rawRegistration);
  if (!registration) return null;

  const live = liveHint ?? (await getLiveAircraft(registration));
  const leg = await activeLeg(registration);

  const base: CurrentFlight = {
    registration,
    callsign: live?.callsign ?? leg?.callsign ?? null,
    airborne: Boolean(live && !live.onGround),
    departure: legDeparture(leg),
    departureSource: legDeparture(leg) ? "OBSERVED" : null,
    departedAt: leg?.departedAt?.toISOString() ?? leg?.firstSeenAt.toISOString() ?? null,
    destination: null,
    destinationSource: null,
    destinationConfidence: null,
    etaAt: null,
    distanceRemainingNm: null,
    distanceFlownNm: null,
    progressPct: null,
    note: null,
  };

  if (!live) {
    return { ...base, note: "Aircraft is not currently being received." };
  }
  if (live.onGround) {
    return { ...base, note: ON_GROUND_NOTE };
  }

  // ---- 1. A filed route, if the callsign is published anywhere -------------
  const route = await lookupRoute(live.callsign);
  let destination: AirportRef | null = null;
  let source: RouteSourceKind | null = null;
  let confidence: number | null = null;

  if (route?.destination) {
    destination = route.destination;
    source = "FLIGHT_DATA";
    confidence = 100;
  }

  // A filed origin is better than a positional guess at where it took off.
  let departure = base.departure;
  let departureSource = base.departureSource;
  if (route?.origin) {
    departure = route.origin;
    departureSource = "FLIGHT_DATA";
  }

  // ---- 2. Otherwise estimate from the trajectory --------------------------
  if (!destination) {
    const estimate = await estimateDestination(live);
    if (estimate) {
      destination = estimate.airport;
      source = "TRAJECTORY_ESTIMATE";
      confidence = estimate.confidence;
    }
  }

  if (!destination) {
    return {
      ...base,
      departure,
      departureSource,
      note: NO_DESTINATION_NOTE,
    };
  }

  // ---- 3. Distances and ETA ----------------------------------------------
  const remaining = distanceNm(live.lat, live.lon, destination.lat, destination.lon);
  const flown = departure ? distanceNm(departure.lat, departure.lon, live.lat, live.lon) : null;
  const speed = live.groundSpeedKt ?? 0;
  const eta = speed > 60 ? new Date(Date.now() + (remaining / speed) * 3600 * 1000) : null;

  const total = flown !== null ? flown + remaining : null;
  const progress = total && total > 0 ? Math.round((flown! / total) * 100) : null;

  if (leg) {
    void recordDestination(leg.id, destination, source!, confidence ?? 0, eta).catch(() => {});
  }

  return {
    ...base,
    departure,
    departureSource,
    destination,
    destinationSource: source,
    destinationConfidence: confidence,
    etaAt: eta?.toISOString() ?? null,
    distanceRemainingNm: Math.round(remaining),
    distanceFlownNm: flown === null ? null : Math.round(flown),
    progressPct: progress,
    note:
      source === "TRAJECTORY_ESTIMATE"
        ? "Estimated destination — inferred from the current track, not from a filed flight plan."
        : null,
  };
}

/**
 * Geometry for the map: the path actually flown plus the endpoints. Positions
 * come from what this deployment recorded, so the flown line is observation,
 * never interpolation between two airports.
 */
export async function getSelectedRoute(
  rawRegistration: string,
  options: { minutes?: number } = {},
): Promise<SelectedRoute | null> {
  const registration = normalizeRegistration(rawRegistration);
  if (!registration) return null;

  const minutes = Math.min(Math.max(options.minutes ?? 120, 5), 24 * 60);
  const since = new Date(Date.now() - minutes * 60 * 1000);

  const [flight, positions] = await Promise.all([
    getCurrentFlight(registration),
    withDb(
      (db) =>
        db.position.findMany({
          where: { registration, seenAt: { gte: since } },
          orderBy: { seenAt: "asc" },
          select: { lat: true, lon: true },
          take: 2000,
        }),
      [] as Array<{ lat: number; lon: number }>,
      "flight:route-positions",
    ),
  ]);

  if (!flight) return null;

  return {
    registration,
    flown: positions.map((p) => [p.lon, p.lat] as [number, number]),
    departure: flight.departure,
    destination: flight.destination,
    destinationEstimated: flight.destinationSource === "TRAJECTORY_ESTIMATE",
  };
}

/** The most recent flight that actually finished. Observed data only. */
export async function getLastLanding(rawRegistration: string): Promise<LandingSummary | null> {
  const registration = normalizeRegistration(rawRegistration);
  if (!registration) return null;

  const leg = await withDb(
    (db) =>
      db.flightLeg.findFirst({
        where: { registration, status: "COMPLETED", arrivedAt: { not: null } },
        orderBy: { arrivedAt: "desc" },
      }),
    null,
    "flight:last-landing",
  );
  if (!leg) return null;

  const departure: AirportRef | null =
    leg.departureLat != null && leg.departureLon != null
      ? {
          icao: leg.departureIcao,
          iata: null,
          name: leg.departureName ?? leg.departureIcao ?? "Unknown",
          city: null,
          country: null,
          lat: leg.departureLat,
          lon: leg.departureLon,
        }
      : await findAirport(leg.departureIcao);

  const arrival: AirportRef | null =
    leg.arrivalLat != null && leg.arrivalLon != null
      ? {
          icao: leg.arrivalIcao,
          iata: null,
          name: leg.arrivalName ?? leg.arrivalIcao ?? "Unknown",
          city: null,
          country: null,
          lat: leg.arrivalLat,
          lon: leg.arrivalLon,
        }
      : await findAirport(leg.arrivalIcao);

  return {
    registration,
    callsign: leg.callsign,
    departure,
    arrival,
    departedAt: leg.departedAt?.toISOString() ?? null,
    arrivedAt: leg.arrivedAt?.toISOString() ?? null,
    durationSec: leg.durationSec,
    distanceNm: leg.distanceNm,
  };
}
