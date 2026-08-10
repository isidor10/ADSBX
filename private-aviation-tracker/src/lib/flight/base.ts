import { normalizeRegistration } from "@/lib/aircraft/registration";
import { withDb } from "@/lib/db";
import type { AirportRef, LikelyBase, UtilisationStats } from "@/lib/types";
import { findAirport } from "./airports";

/**
 * Home-base detection and utilisation, both computed from observed flights.
 *
 * A base is an inference, never a fact: an aircraft that repeatedly starts and
 * ends its days at one field is very probably based there, but a busy month at
 * a seasonal destination looks the same from the outside. The result therefore
 * carries a confidence and the evidence count, and says BASE UNKNOWN rather
 * than naming the most common airport when the data is thin.
 */

const MIN_MOVEMENTS = 6;
const LOOKBACK_DAYS = 180;

interface LegRow {
  departureIcao: string | null;
  arrivalIcao: string | null;
  departedAt: Date | null;
  arrivedAt: Date | null;
  durationSec: number | null;
  distanceNm: number | null;
  firstSeenAt: Date;
}

async function legsFor(registration: string, days: number): Promise<LegRow[]> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  return withDb(
    (db) =>
      db.flightLeg.findMany({
        where: { registration, firstSeenAt: { gte: since } },
        select: {
          departureIcao: true,
          arrivalIcao: true,
          departedAt: true,
          arrivedAt: true,
          durationSec: true,
          distanceNm: true,
          firstSeenAt: true,
        },
        orderBy: { firstSeenAt: "desc" },
        take: 500,
      }),
    [] as LegRow[],
    "flight:base-legs",
  );
}

export async function detectBase(rawRegistration: string): Promise<LikelyBase> {
  const registration = normalizeRegistration(rawRegistration) ?? rawRegistration.toUpperCase();
  const unknown: LikelyBase = {
    known: false,
    airport: null,
    confidence: 0,
    band: "none",
    movements: 0,
    note: "Not enough recorded flights to establish a base. A base is inferred from where an aircraft repeatedly starts and finishes its flying.",
  };

  const legs = await legsFor(registration, LOOKBACK_DAYS);
  if (legs.length < 3) return unknown;

  // Count every arrival and departure by airport.
  const counts = new Map<string, number>();
  let total = 0;
  for (const leg of legs) {
    for (const icao of [leg.departureIcao, leg.arrivalIcao]) {
      if (!icao) continue;
      counts.set(icao, (counts.get(icao) ?? 0) + 1);
      total += 1;
    }
  }
  if (total < MIN_MOVEMENTS) return unknown;

  let top: { icao: string; count: number } | null = null;
  let second = 0;
  for (const [icao, count] of counts) {
    if (!top || count > top.count) {
      second = top?.count ?? 0;
      top = { icao, count };
    } else if (count > second) {
      second = count;
    }
  }
  if (!top) return unknown;

  const share = top.count / total;
  // A base should dominate. If the top field is barely ahead of the next, the
  // aircraft is roaming and naming one would be misleading.
  if (share < 0.25 || top.count < 3) return unknown;

  const airport = await findAirport(top.icao);
  if (!airport) return unknown;

  // Confidence blends dominance with sample size; capped because this is an
  // inference from movement patterns, not a filed operating base.
  const dominance = Math.min(1, share / 0.6);
  const sample = Math.min(1, top.count / 12);
  const separation = second > 0 ? Math.min(1, (top.count - second) / Math.max(3, second)) : 1;
  const confidence = Math.round(Math.min(92, 35 + dominance * 30 + sample * 15 + separation * 12));

  return {
    known: true,
    airport: airport as AirportRef,
    confidence,
    band: confidence >= 75 ? "high" : confidence >= 55 ? "medium" : "low",
    movements: top.count,
    note: `Inferred from ${top.count} of ${total} recorded movements (${Math.round(share * 100)}%) at ${top.icao} over the last ${LOOKBACK_DAYS} days. This is an inference from observed activity, not a declared operating base.`,
  };
}

/** Flight-hour and distance totals over the usual reporting windows. */
export async function getUtilisation(rawRegistration: string): Promise<UtilisationStats> {
  const registration = normalizeRegistration(rawRegistration) ?? rawRegistration.toUpperCase();
  const legs = await legsFor(registration, 90);

  const windows = [1, 7, 30, 90] as const;
  const now = Date.now();

  const periods = windows.map((days) => {
    const since = now - days * 24 * 3600 * 1000;
    const inWindow = legs.filter((l) => l.firstSeenAt.getTime() >= since);
    const seconds = inWindow.reduce((sum, l) => sum + (l.durationSec ?? 0), 0);
    const distance = inWindow.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
    const activeDays = new Set(inWindow.map((l) => l.firstSeenAt.toDateString())).size;
    return {
      days,
      flights: inWindow.length,
      hours: Math.round((seconds / 3600) * 10) / 10,
      distanceNm: Math.round(distance),
      activeDays,
    };
  });

  const ninety = periods[3];
  const averageLegNm = ninety.flights > 0 ? Math.round(ninety.distanceNm / ninety.flights) : null;
  const averageHours = ninety.flights > 0 ? Math.round((ninety.hours / ninety.flights) * 10) / 10 : null;

  // A simple, explainable score. Published so the number is not a black box.
  const hoursScore = Math.min(1, ninety.hours / 120) * 45;
  const flightsScore = Math.min(1, ninety.flights / 60) * 30;
  const recencyScore = periods[1].flights > 0 ? 15 : periods[2].flights > 0 ? 8 : 0;
  const spreadScore = Math.min(1, ninety.activeDays / 45) * 10;
  const score = Math.round(hoursScore + flightsScore + recencyScore + spreadScore);

  return {
    registration,
    periods,
    averageLegNm,
    averageLegHours: averageHours,
    activityScore: ninety.flights === 0 ? null : score,
    scoreMethod:
      "45 points for flight hours (120 h over 90 days = full marks), 30 for number of flights (60 = full marks), 15 for having flown in the last 7 days, 10 for spread across active days.",
    note:
      legs.length === 0
        ? "No flights recorded yet. Utilisation is computed only from flights this deployment observed, so it understates any aircraft it has not been watching."
        : "Computed from flights observed by this deployment only — an aircraft flying outside ADS-B coverage, or before this instance started watching, is not counted.",
  };
}

/**
 * Legs that look like repositioning: an aircraft that lands somewhere and
 * later departs the same field for a third airport is very often moving empty.
 * Without passenger or charter data that cannot be confirmed, so this is
 * reported as POTENTIAL REPOSITIONING with a confidence, never as "empty".
 */
export async function detectRepositioning(
  rawRegistration: string,
  limit = 10,
): Promise<
  Array<{
    from: string;
    to: string;
    at: string;
    confidence: "medium" | "low";
    reason: string;
  }>
> {
  const registration = normalizeRegistration(rawRegistration) ?? rawRegistration.toUpperCase();
  const legs = (await legsFor(registration, 90))
    .filter((l) => l.departureIcao && l.arrivalIcao && l.arrivedAt)
    .sort((a, b) => (a.arrivedAt!.getTime() ?? 0) - (b.arrivedAt!.getTime() ?? 0));

  const base = await detectBase(registration);
  const out: Array<{ from: string; to: string; at: string; confidence: "medium" | "low"; reason: string }> = [];

  for (const leg of legs) {
    const isShort = (leg.distanceNm ?? 0) > 0 && (leg.distanceNm ?? 0) < 400;
    const toBase = base.known && leg.arrivalIcao === base.airport?.icao;
    const fromBase = base.known && leg.departureIcao === base.airport?.icao;

    // A leg back to base shortly after a trip, or a short hop between two
    // non-base fields, is the classic repositioning shape.
    if (toBase && !fromBase) {
      out.push({
        from: leg.departureIcao!,
        to: leg.arrivalIcao!,
        at: leg.arrivedAt!.toISOString(),
        confidence: base.band === "high" ? "medium" : "low",
        reason: `Returned to the likely base (${base.airport?.icao}) from ${leg.departureIcao}. Aircraft returning to base after dropping passengers are often flying empty, but no passenger data is public, so this is not confirmed.`,
      });
    } else if (!toBase && !fromBase && isShort && base.known) {
      out.push({
        from: leg.departureIcao!,
        to: leg.arrivalIcao!,
        at: leg.arrivedAt!.toISOString(),
        confidence: "low",
        reason: `Short leg between two airports that are not the likely base. This can be a positioning flight or a genuine passenger sector — it cannot be distinguished from public data.`,
      });
    }
  }

  return out.slice(-limit).reverse();
}
