import { config } from "@/lib/config";
import { distanceNm } from "@/lib/geo";
import type { AirportRef, CostBasis, CostEstimate, CostLine, LegCost } from "@/lib/types";
export type { CostBasis, CostEstimate, CostLine, LegCost };

import {
  JET_A_KG_PER_LITRE,
  LITRES_PER_US_GALLON,
  performanceFor,
  type PerformanceProfile,
} from "./performance";

/**
 * Estimated operating cost for a flight.
 *
 * Everything here is an estimate built from class performance data and
 * configurable rates. It is not a quotation, not an invoice, and not what an
 * operator actually paid. Three things keep it honest:
 *
 *   1. Every output is a range — low / most likely / high — because a single
 *      figure to the euro would imply a precision that does not exist.
 *   2. Each line item records where its number came from and how confident
 *      that is, so the reader can see which parts are solid (fuel burn for a
 *      well-documented type) and which are broad (airport fees).
 *   3. Operating cost and charter price are computed and shown separately.
 *      Charter includes margin, broker commission and positioning; conflating
 *      the two would misrepresent both.
 *
 * Distance is not raw great-circle: real routings are longer, so a routing
 * factor is applied and the result is labelled as an estimate.
 */

const DISCLAIMER =
  "ESTIMATED OPERATING COST — computed from published class performance data and configurable rates. Not a quotation and not an actual invoice; real costs vary with weight, winds, altitude, fuel uplift location, contracts and airport-specific fees.";

/** Taxi, climb and approach add block time beyond pure cruise. */
const BLOCK_TIME_OVERHEAD_HOURS = 0.35;

/** Extra fuel burnt on the ground and in the climb, as a share of cruise burn. */
const CLIMB_FUEL_FACTOR = 1.12;

function hoursFor(distanceNm: number, cruiseKt: number): number {
  if (cruiseKt <= 0) return 0;
  return distanceNm / cruiseKt + BLOCK_TIME_OVERHEAD_HOURS;
}

function legFor(
  kind: LegCost["kind"],
  from: AirportRef | null,
  to: AirportRef | null,
  profile: PerformanceProfile,
  routingFactor: number,
): LegCost | null {
  if (!from || !to) return null;
  const gc = distanceNm(from.lat, from.lon, to.lat, to.lon);
  if (gc < 1) return null;

  const routed = gc * routingFactor;
  const blockHours = hoursFor(routed, profile.cruiseKt);
  const fuelLitres = blockHours * profile.fuelBurnLph * CLIMB_FUEL_FACTOR;

  return {
    kind,
    from,
    to,
    greatCircleNm: Math.round(gc),
    routedNm: Math.round(routed),
    blockHours,
    fuelLitres: Math.round(fuelLitres),
    fuelKg: Math.round(fuelLitres * JET_A_KG_PER_LITRE),
  };
}

/**
 * Airport and handling charges scale with weight and vary enormously by field.
 * A major hub charges several times what a regional field does for the same
 * aircraft, so this is deliberately produced as a wide band.
 */
function airportFees(profile: PerformanceProfile, movements: number) {
  const tonnes = profile.mtowKg / 1000;
  const perMovementLow = 180 + tonnes * 12;
  const perMovementLikely = 320 + tonnes * 24;
  const perMovementHigh = 650 + tonnes * 48;
  return {
    low: Math.round(perMovementLow * movements),
    likely: Math.round(perMovementLikely * movements),
    high: Math.round(perMovementHigh * movements),
  };
}

export interface CostInput {
  registration?: string | null;
  typeCode: string | null;
  aircraftCategory: string | null;
  /** The revenue/passenger leg. */
  from: AirportRef | null;
  to: AirportRef | null;
  /** Home base, when one has been established. Enables positioning legs. */
  base?: AirportRef | null;
  /** DIRECT = passenger leg only. FULL = base → from → to → base. */
  mode?: "DIRECT" | "FULL";
  /** Overrides the configured price. */
  fuelPricePerLitre?: number;
}

export function estimateFlightCost(input: CostInput): CostEstimate | null {
  const { profile, exact, typeCode } = performanceFor(input.typeCode, input.aircraftCategory);
  const mode = input.mode ?? "DIRECT";
  const routingFactor = config.cost.routingFactor;
  const fuelPrice = input.fuelPricePerLitre ?? config.cost.fuelPricePerLitre;

  const legs: LegCost[] = [];
  const passenger = legFor("PASSENGER", input.from, input.to, profile, routingFactor);
  if (!passenger) return null;

  if (mode === "FULL" && input.base) {
    const positioning = legFor("POSITIONING", input.base, input.from, profile, routingFactor);
    if (positioning) legs.push(positioning);
  }
  legs.push(passenger);
  if (mode === "FULL" && input.base) {
    const ret = legFor("RETURN", input.to, input.base, profile, routingFactor);
    if (ret) legs.push(ret);
  }

  const totalRoutedNm = legs.reduce((sum, l) => sum + l.routedNm, 0);
  const totalBlockHours = legs.reduce((sum, l) => sum + l.blockHours, 0);
  const totalFuelLitres = legs.reduce((sum, l) => sum + l.fuelLitres, 0);
  const movements = legs.length * 2;

  // ---- line items ---------------------------------------------------------
  const fuelCost = totalFuelLitres * fuelPrice;
  const crewCost = totalBlockHours * profile.crew * config.cost.crewEurPerHourPerPilot;
  const maintenance = totalBlockHours * profile.maintenanceEurPerHour;
  const airport = airportFees(profile, movements);
  const navigation = totalRoutedNm * config.cost.navigationEurPerNm;
  const handlingPerStop = config.cost.handlingEurPerStop;
  const handling = handlingPerStop * movements;

  // Fuel burn for a documented type is solid; a class fallback is not.
  const fuelSpread = exact && profile.confidence === "high" ? 0.12 : 0.25;

  const lines: CostLine[] = [
    {
      key: "fuel",
      label: "Fuel",
      low: Math.round(fuelCost * (1 - fuelSpread)),
      likely: Math.round(fuelCost),
      high: Math.round(fuelCost * (1 + fuelSpread)),
      basis: exact ? "PUBLISHED_PERFORMANCE" : "CLASS_ESTIMATE",
      note: `${Math.round(totalFuelLitres).toLocaleString()} L at ${fuelPrice.toFixed(2)} ${config.cost.currency}/L, ${profile.fuelBurnLph} L/h cruise burn${exact ? "" : " (class average — exact type not in the performance table)"}.`,
    },
    {
      key: "crew",
      label: "Crew",
      low: Math.round(crewCost * 0.75),
      likely: Math.round(crewCost),
      high: Math.round(crewCost * 1.45),
      basis: "CONFIGURED_RATE",
      note: `${profile.crew} pilot${profile.crew === 1 ? "" : "s"} × ${totalBlockHours.toFixed(1)} block hours at the configured rate. Duty, overnight and per-diem costs vary widely.`,
    },
    {
      key: "maintenance",
      label: "Maintenance reserve",
      low: Math.round(maintenance * 0.7),
      likely: Math.round(maintenance),
      high: Math.round(maintenance * 1.4),
      basis: exact ? "PUBLISHED_PERFORMANCE" : "CLASS_ESTIMATE",
      note: `Industry hourly reserve for the type (${profile.maintenanceEurPerHour} ${config.cost.currency}/h) × ${totalBlockHours.toFixed(1)} h. Programme coverage and engine reserves differ per operator.`,
    },
    {
      key: "airport",
      label: "Landing & parking",
      low: airport.low,
      likely: airport.likely,
      high: airport.high,
      basis: "CLASS_ESTIMATE",
      note: `${movements} movements, scaled by ${Math.round(profile.mtowKg / 1000)} t MTOW. Actual published tariffs are airport-specific and are not consulted here.`,
    },
    {
      key: "navigation",
      label: "Navigation / ATC",
      low: Math.round(navigation * 0.75),
      likely: Math.round(navigation),
      high: Math.round(navigation * 1.35),
      basis: "CONFIGURED_RATE",
      note: `${totalRoutedNm.toLocaleString()} NM at the configured en-route rate. Real charges depend on the airspace crossed and aircraft weight.`,
    },
    {
      key: "handling",
      label: "Handling",
      low: Math.round(handling * 0.6),
      likely: handling,
      high: Math.round(handling * 2),
      basis: "CONFIGURED_RATE",
      note: `${movements} movements at ${handlingPerStop} ${config.cost.currency} per movement. FBO handling ranges enormously between fields.`,
    },
  ];

  const total = lines.reduce(
    (sum, l) => ({ low: sum.low + l.low, likely: sum.likely + l.likely, high: sum.high + l.high }),
    { low: 0, likely: 0, high: 0 },
  );

  // ---- charter price, deliberately separate -------------------------------
  const charterMultiplierLow = config.cost.charterMarkupLow;
  const charterMultiplierHigh = config.cost.charterMarkupHigh;
  const charter = {
    low: Math.round(total.likely * charterMultiplierLow),
    likely: Math.round(total.likely * ((charterMultiplierLow + charterMultiplierHigh) / 2)),
    high: Math.round(total.high * charterMultiplierHigh),
    note: "Charter market price is not operating cost. It adds operator margin, broker commission, positioning the aircraft to and from the trip, crew duty costs, VAT/taxes where applicable and airport fees — and moves with demand. An empty-leg price can sit far below this range.",
  };

  // ---- range check --------------------------------------------------------
  const longestLeg = Math.max(...legs.map((l) => l.routedNm));
  let rangeWarning: string | null = null;
  if (longestLeg > profile.rangeNm) {
    rangeWarning = `The longest leg (${longestLeg.toLocaleString()} NM) exceeds the type's typical range of ${profile.rangeNm.toLocaleString()} NM, so a technical fuel stop would be required. The estimate does not add the cost of that stop.`;
  } else if (longestLeg > profile.rangeNm * 0.9) {
    rangeWarning = `The longest leg (${longestLeg.toLocaleString()} NM) is close to the type's typical range of ${profile.rangeNm.toLocaleString()} NM — payload or winds could force a fuel stop.`;
  }

  return {
    registration: input.registration ?? null,
    aircraftType: profile.name,
    typeCode,
    exactPerformance: exact,
    performanceConfidence: profile.confidence,
    legs,
    totalRoutedNm,
    totalBlockHours,
    totalFuelLitres: Math.round(totalFuelLitres),
    lines,
    total,
    charter,
    currency: config.cost.currency,
    fuelPricePerLitre: fuelPrice,
    routingFactor,
    rangeWarning,
    assumptions: [
      `Distance is great-circle × ${routingFactor} to approximate real routing; no airway or flight-plan data is used.`,
      `Block time adds ${BLOCK_TIME_OVERHEAD_HOURS * 60} minutes to cruise time for taxi, climb and approach.`,
      `Fuel includes a ${Math.round((CLIMB_FUEL_FACTOR - 1) * 100)}% allowance above cruise burn for ground and climb.`,
      exact
        ? `Performance figures are published values for the ${profile.name}.`
        : `No performance data for this exact type — the ${profile.name} class profile is used.`,
      mode === "FULL"
        ? "Full-operation mode includes positioning to the departure airport and the return to base."
        : "Direct mode covers the passenger leg only; positioning flights are excluded.",
    ],
    disclaimer: DISCLAIMER,
  };
}

/** Convert a price per US gallon to price per litre. */
export function perGallonToPerLitre(perGallon: number): number {
  return perGallon / LITRES_PER_US_GALLON;
}
