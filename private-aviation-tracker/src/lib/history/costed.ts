import { normalizeRegistration } from "@/lib/aircraft/registration";
import { getIdentity } from "@/lib/aircraft/service";
import { estimateFlightCost } from "@/lib/cost/calculator";
import { withDb } from "@/lib/db";
import { findAirport } from "@/lib/flight/airports";
import { detectBase } from "@/lib/flight/base";
import type { AirportRef, CostedFlight, CostedHistory, FleetCostSummary } from "@/lib/types";

/**
 * Historical flights with an estimated cost attached to each one.
 *
 * Two honesty rules run through this module:
 *
 *   1. Coverage is reported, not implied. History exists only from the moment
 *      this deployment first saw an aircraft, so a "last 90 days" request on a
 *      tail first seen yesterday covers one day, not ninety. The response says
 *      which, and the UI shows it.
 *   2. A leg whose airports could not be inferred gets no cost. Guessing the
 *      endpoints to produce a number would make the totals fiction.
 */

export interface HistoryWindow {
  from: Date;
  to: Date;
}

export function windowFromDays(days: number): HistoryWindow {
  const to = new Date();
  return { from: new Date(to.getTime() - days * 24 * 3600 * 1000), to };
}

interface LegRow {
  id: string;
  registration: string;
  callsign: string | null;
  status: string;
  departureIcao: string | null;
  departureName: string | null;
  departureLat: number | null;
  departureLon: number | null;
  departedAt: Date | null;
  arrivalIcao: string | null;
  arrivalName: string | null;
  arrivalLat: number | null;
  arrivalLon: number | null;
  arrivedAt: Date | null;
  durationSec: number | null;
  distanceNm: number | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

function refFrom(
  icao: string | null,
  name: string | null,
  lat: number | null,
  lon: number | null,
): AirportRef | null {
  if (lat == null || lon == null) return null;
  return { icao, iata: null, name: name ?? icao ?? "Unknown", city: null, country: null, lat, lon };
}

async function legsIn(
  registrations: string[],
  window: HistoryWindow,
  limit: number,
): Promise<LegRow[]> {
  if (registrations.length === 0) return [];
  return withDb(
    (db) =>
      db.flightLeg.findMany({
        where: {
          registration: { in: registrations },
          firstSeenAt: { gte: window.from, lte: window.to },
        },
        orderBy: { firstSeenAt: "desc" },
        take: limit,
      }),
    [] as LegRow[],
    "history:costed-legs",
  );
}

/**
 * How much of the requested window this deployment could actually have
 * observed, as a percentage. Anything less than complete is stated plainly.
 */
async function coverageFor(
  registrations: string[],
  window: HistoryWindow,
): Promise<{ percent: number; firstSeenAt: string | null; note: string | null }> {
  const earliest = await withDb(
    (db) =>
      db.position.findFirst({
        where: { registration: { in: registrations } },
        orderBy: { seenAt: "asc" },
        select: { seenAt: true },
      }),
    null,
    "history:coverage",
  );

  const requestedMs = window.to.getTime() - window.from.getTime();
  if (!earliest) {
    return {
      percent: 0,
      firstSeenAt: null,
      note: "No positions have been recorded for this period. Historical data is built from ADS-B this deployment observed — it does not back-fill from before it started watching.",
    };
  }

  const observedFrom = Math.max(earliest.seenAt.getTime(), window.from.getTime());
  const observedMs = Math.max(0, window.to.getTime() - observedFrom);
  const percent = requestedMs > 0 ? Math.min(100, Math.round((observedMs / requestedMs) * 100)) : 0;

  return {
    percent,
    firstSeenAt: earliest.seenAt.toISOString(),
    note:
      percent >= 99
        ? null
        : `Historical coverage ${percent}% — this deployment first recorded a position on ${earliest.seenAt.toISOString().slice(0, 10)}, so the earlier part of the requested period was not observed. Flights before that are not missing from the aircraft's history, they are missing from ours.`,
  };
}

/** Attach an estimated cost to one leg, or explain why it has none. */
async function costLeg(
  leg: LegRow,
  typeCode: string | null,
  category: string | null,
  base: AirportRef | null,
): Promise<CostedFlight> {
  const departure = refFrom(leg.departureIcao, leg.departureName, leg.departureLat, leg.departureLon);
  const arrival = refFrom(leg.arrivalIcao, leg.arrivalName, leg.arrivalLat, leg.arrivalLon);

  const base_: CostedFlight = {
    id: leg.id,
    registration: leg.registration,
    callsign: leg.callsign,
    status: leg.status as CostedFlight["status"],
    departure,
    arrival,
    departedAt: leg.departedAt?.toISOString() ?? leg.firstSeenAt.toISOString(),
    arrivedAt: leg.arrivedAt?.toISOString() ?? null,
    durationSec: leg.durationSec,
    distanceNm: leg.distanceNm,
    fuelLitres: null,
    cost: null,
    positioningCost: null,
    costNote: null,
  };

  if (!departure || !arrival) {
    return {
      ...base_,
      costNote:
        "No cost estimate — the departure or arrival airport could not be inferred from the observed positions, and inventing endpoints would make the figure meaningless.",
    };
  }

  const direct = estimateFlightCost({
    registration: leg.registration,
    typeCode,
    aircraftCategory: category,
    from: departure,
    to: arrival,
  });
  if (!direct) return { ...base_, costNote: "No cost estimate — the endpoints resolve to one point." };

  // Positioning is only meaningful when a base is known and this leg neither
  // starts nor ends there.
  let positioning: number | null = null;
  if (base && departure.icao !== base.icao && arrival.icao !== base.icao) {
    const withPositioning = estimateFlightCost({
      typeCode,
      aircraftCategory: category,
      from: departure,
      to: arrival,
      base,
      mode: "FULL",
    });
    if (withPositioning) {
      positioning = Math.max(0, withPositioning.total.likely - direct.total.likely);
    }
  }

  return {
    ...base_,
    fuelLitres: direct.totalFuelLitres,
    cost: { low: direct.total.low, likely: direct.total.likely, high: direct.total.high },
    positioningCost: positioning,
    costNote: null,
  };
}

/** Costed flight history for one aircraft over a window. */
export async function getCostedHistory(
  rawRegistration: string,
  window: HistoryWindow,
  limit = 200,
): Promise<CostedHistory> {
  const registration = normalizeRegistration(rawRegistration) ?? rawRegistration.toUpperCase();

  const [identity, base, legs, coverage] = await Promise.all([
    getIdentity(registration),
    detectBase(registration),
    legsIn([registration], window, limit),
    coverageFor([registration], window),
  ]);

  const flights = await Promise.all(
    legs.map((leg) =>
      costLeg(leg, identity?.typeCode ?? null, identity?.category ?? null, base.known ? base.airport : null),
    ),
  );

  return {
    registration,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    flights,
    totals: summarise(flights),
    coveragePercent: coverage.percent,
    firstObservedAt: coverage.firstSeenAt,
    note: coverage.note,
  };
}

function summarise(flights: CostedFlight[]): FleetCostSummary {
  const costed = flights.filter((f) => f.cost);
  return {
    flights: flights.length,
    flightsCosted: costed.length,
    hours:
      Math.round(
        (flights.reduce((sum, f) => sum + (f.durationSec ?? 0), 0) / 3600) * 10,
      ) / 10,
    distanceNm: Math.round(flights.reduce((sum, f) => sum + (f.distanceNm ?? 0), 0)),
    fuelLitres: costed.reduce((sum, f) => sum + (f.fuelLitres ?? 0), 0),
    cost: costed.reduce(
      (sum, f) => ({
        low: sum.low + (f.cost?.low ?? 0),
        likely: sum.likely + (f.cost?.likely ?? 0),
        high: sum.high + (f.cost?.high ?? 0),
      }),
      { low: 0, likely: 0, high: 0 },
    ),
    positioningCost: costed.reduce((sum, f) => sum + (f.positioningCost ?? 0), 0),
  };
}

export interface FleetHistory {
  slug: string;
  from: string;
  to: string;
  totals: FleetCostSummary;
  perAircraft: Array<{ registration: string; typeCode: string | null } & FleetCostSummary>;
  perRoute: Array<{
    route: string;
    flights: number;
    distanceNm: number;
    hours: number;
    costLikely: number;
    averageCost: number;
  }>;
  flights: CostedFlight[];
  coveragePercent: number;
  note: string | null;
}

/** Costed history for a whole fleet, aggregated per aircraft and per route. */
export async function getFleetHistory(
  slug: string,
  registrations: string[],
  window: HistoryWindow,
  limit = 600,
): Promise<FleetHistory> {
  if (registrations.length === 0) {
    return {
      slug,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      totals: summarise([]),
      perAircraft: [],
      perRoute: [],
      flights: [],
      coveragePercent: 0,
      note: "No aircraft are linked to this company yet.",
    };
  }

  const [legs, coverage] = await Promise.all([
    legsIn(registrations, window, limit),
    coverageFor(registrations, window),
  ]);

  // One identity and base lookup per aircraft, not per leg.
  const perRegistration = new Map<string, { typeCode: string | null; category: string | null; base: AirportRef | null }>();
  await Promise.all(
    [...new Set(legs.map((l) => l.registration))].map(async (reg) => {
      const [identity, base] = await Promise.all([getIdentity(reg), detectBase(reg)]);
      perRegistration.set(reg, {
        typeCode: identity?.typeCode ?? null,
        category: identity?.category ?? null,
        base: base.known ? base.airport : null,
      });
    }),
  );

  const flights = await Promise.all(
    legs.map((leg) => {
      const meta = perRegistration.get(leg.registration);
      return costLeg(leg, meta?.typeCode ?? null, meta?.category ?? null, meta?.base ?? null);
    }),
  );

  // ---- per aircraft -------------------------------------------------------
  const byAircraft = new Map<string, CostedFlight[]>();
  for (const flight of flights) {
    const list = byAircraft.get(flight.registration) ?? [];
    list.push(flight);
    byAircraft.set(flight.registration, list);
  }
  const perAircraft = [...byAircraft.entries()]
    .map(([registration, list]) => ({
      registration,
      typeCode: perRegistration.get(registration)?.typeCode ?? null,
      ...summarise(list),
    }))
    .sort((a, b) => b.cost.likely - a.cost.likely);

  // ---- per route ----------------------------------------------------------
  const byRoute = new Map<string, CostedFlight[]>();
  for (const flight of flights) {
    if (!flight.departure?.icao || !flight.arrival?.icao) continue;
    const key = `${flight.departure.icao} → ${flight.arrival.icao}`;
    const list = byRoute.get(key) ?? [];
    list.push(flight);
    byRoute.set(key, list);
  }
  const perRoute = [...byRoute.entries()]
    .map(([route, list]) => {
      const totals = summarise(list);
      return {
        route,
        flights: totals.flights,
        distanceNm: totals.distanceNm,
        hours: totals.hours,
        costLikely: totals.cost.likely,
        averageCost:
          totals.flightsCosted > 0 ? Math.round(totals.cost.likely / totals.flightsCosted) : 0,
      };
    })
    .sort((a, b) => b.flights - a.flights);

  return {
    slug,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    totals: summarise(flights),
    perAircraft,
    perRoute,
    flights,
    coveragePercent: coverage.percent,
    note: coverage.note,
  };
}
