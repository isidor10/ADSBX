import { normalizeRegistration } from "@/lib/aircraft/registration";
import { withDb } from "@/lib/db";
import type { AirportRef, NextTrip } from "@/lib/types";
import { findAirport } from "./airports";

/**
 * NEXT TRIP.
 *
 * There is no public source of future private flights — no filed flight plan
 * is published ahead of departure, and nothing in ADS-B looks forward. So the
 * only honest answers are:
 *
 *   "Unknown"          — the default, and by far the most common
 *   "Estimated"        — this aircraft has repeatedly flown the same route out
 *                        of where it now sits, labelled as a pattern, with the
 *                        number of past flights it is based on
 *
 * The bar for the second is deliberately high: a pattern needs several past
 * occurrences and must be a clear majority of what this aircraft does from
 * this airport. Anything weaker is reported as unknown rather than dressed up
 * as intelligence.
 */

const MIN_OCCURRENCES = 3;
const MIN_SHARE = 0.5;
const LOOKBACK_DAYS = 180;

const UNKNOWN: NextTrip = {
  known: false,
  estimated: false,
  departure: null,
  destination: null,
  window: null,
  confidence: "none",
  basis: 0,
  note: "No future flight can be established. Private flight plans are not published in advance, so a next trip is only ever shown when this aircraft has repeatedly flown the same route.",
};

function describeWindow(hours: number[]): string | null {
  if (hours.length < MIN_OCCURRENCES) return null;
  const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
  const spread = Math.max(...hours) - Math.min(...hours);
  // A departure time that swings across the day is not a pattern worth stating.
  if (spread > 8) return null;
  if (mean < 11) return "typically departs in the morning";
  if (mean < 16) return "typically departs around midday";
  return "typically departs in the afternoon or evening";
}

export async function getNextTrip(rawRegistration: string): Promise<NextTrip> {
  const registration = normalizeRegistration(rawRegistration);
  if (!registration) return UNKNOWN;

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000);

  const legs = await withDb(
    (db) =>
      db.flightLeg.findMany({
        where: {
          registration,
          status: "COMPLETED",
          departureIcao: { not: null },
          arrivalIcao: { not: null },
          firstSeenAt: { gte: since },
        },
        orderBy: { firstSeenAt: "desc" },
        select: {
          departureIcao: true,
          arrivalIcao: true,
          departedAt: true,
          arrivedAt: true,
        },
        take: 200,
      }),
    [] as Array<{
      departureIcao: string | null;
      arrivalIcao: string | null;
      departedAt: Date | null;
      arrivedAt: Date | null;
    }>,
    "flight:next-trip",
  );

  if (legs.length === 0) return UNKNOWN;

  // Where is it now? The last completed flight ended somewhere; the next trip
  // can only start from there.
  const currentBase = legs[0].arrivalIcao;
  if (!currentBase) return UNKNOWN;

  const departures = legs.filter((l) => l.departureIcao === currentBase);
  if (departures.length < MIN_OCCURRENCES) return UNKNOWN;

  const byDestination = new Map<string, Date[]>();
  for (const leg of departures) {
    if (!leg.arrivalIcao) continue;
    const list = byDestination.get(leg.arrivalIcao) ?? [];
    if (leg.departedAt) list.push(leg.departedAt);
    byDestination.set(leg.arrivalIcao, list);
  }

  let top: { icao: string; times: Date[] } | null = null;
  for (const [icao, times] of byDestination) {
    if (!top || times.length > top.times.length) top = { icao, times };
  }

  if (!top || top.times.length < MIN_OCCURRENCES) return UNKNOWN;
  if (top.times.length / departures.length < MIN_SHARE) return UNKNOWN;

  const [departure, destination] = await Promise.all([
    findAirport(currentBase),
    findAirport(top.icao),
  ]);
  if (!departure || !destination) return UNKNOWN;

  const window = describeWindow(top.times.map((t) => t.getUTCHours()));
  const share = top.times.length / departures.length;

  return {
    known: true,
    estimated: true,
    departure: departure as AirportRef,
    destination: destination as AirportRef,
    window,
    // A behavioural pattern is never "high" confidence about a future event.
    confidence: top.times.length >= 6 && share >= 0.7 ? "medium" : "low",
    basis: top.times.length,
    note: `Estimated from ${top.times.length} previous flight${top.times.length === 1 ? "" : "s"} ${departure.icao} → ${destination.icao} observed by this deployment (${Math.round(share * 100)}% of its departures from ${departure.icao}). This is a pattern, not a scheduled flight.`,
  };
}
