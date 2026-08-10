/**
 * Cost-engine checks. Pure arithmetic over the performance table, so this runs
 * offline with no database and no network.
 *
 *   npm run verify:cost
 */

import assert from "node:assert/strict";
import { estimateFlightCost, perGallonToPerLitre } from "../src/lib/cost/calculator";
import { performanceFor, typesCovered } from "../src/lib/cost/performance";
import type { AirportRef } from "../src/lib/types";

const LFPB: AirportRef = { icao: "LFPB", iata: "LBG", name: "Paris Le Bourget", city: "Paris", country: "FR", lat: 48.9694, lon: 2.4414 };
const OMDB: AirportRef = { icao: "OMDB", iata: "DXB", name: "Dubai", city: "Dubai", country: "AE", lat: 25.2528, lon: 55.3644 };
const LYBE: AirportRef = { icao: "LYBE", iata: "BEG", name: "Belgrade", city: "Belgrade", country: "RS", lat: 44.8184, lon: 20.3091 };

function main() {
  console.log(`performance table: ${typesCovered()} types`);

  // --- 1. Known type uses published figures --------------------------------
  const g650 = performanceFor("GLF6", "business_jet");
  assert.equal(g650.exact, true);
  assert.equal(g650.profile.name, "Gulfstream G650 / G650ER");

  const unknownType = performanceFor("ZZZZ", "business_jet");
  assert.equal(unknownType.exact, false, "an unknown type must fall back to its class");

  // --- 2. Paris -> Dubai on a G650 -----------------------------------------
  const direct = estimateFlightCost({
    registration: "N1TEST",
    typeCode: "GLF6",
    aircraftCategory: "business_jet",
    from: LFPB,
    to: OMDB,
  })!;
  assert.ok(direct, "estimate must be produced");
  assert.equal(direct.legs.length, 1, "direct mode is the passenger leg only");

  // Sanity-check the physics rather than the exact number.
  const gc = direct.legs[0].greatCircleNm;
  assert.ok(gc > 2500 && gc < 3200, `Paris-Dubai great circle should be ~2900 NM, got ${gc}`);
  assert.ok(direct.legs[0].routedNm > gc, "routed distance must exceed great circle");
  assert.ok(
    direct.totalBlockHours > 5.5 && direct.totalBlockHours < 8,
    `block time should be ~6-7 h, got ${direct.totalBlockHours.toFixed(1)}`,
  );

  // Fuel: ~1750 L/h for 6.5 h plus climb allowance.
  assert.ok(
    direct.totalFuelLitres > 10000 && direct.totalFuelLitres < 16000,
    `fuel should be ~12-13 kL, got ${direct.totalFuelLitres}`,
  );
  assert.ok(direct.totalFuelLitres < 22600, "fuel burn must not exceed tank capacity for this leg");

  // --- 3. The range is a range, and ordered --------------------------------
  assert.ok(direct.total.low < direct.total.likely, "low < likely");
  assert.ok(direct.total.likely < direct.total.high, "likely < high");
  for (const line of direct.lines) {
    assert.ok(line.low <= line.likely && line.likely <= line.high, `${line.key} range ordered`);
    assert.ok(line.note.length > 20, `${line.key} states its basis`);
  }
  assert.equal(
    direct.lines.reduce((s, l) => s + l.likely, 0),
    direct.total.likely,
    "total must be the sum of its lines",
  );

  // --- 4. Charter is separate from, and above, operating cost --------------
  assert.ok(direct.charter, "charter estimate present");
  assert.ok(
    direct.charter!.low > direct.total.likely,
    "charter must not be quoted below operating cost",
  );
  assert.match(direct.charter!.note, /margin|commission/i);

  // --- 5. FULL mode adds positioning both ways -----------------------------
  const full = estimateFlightCost({
    typeCode: "GLF6",
    aircraftCategory: "business_jet",
    from: LFPB,
    to: OMDB,
    base: LYBE,
    mode: "FULL",
  })!;
  assert.equal(full.legs.length, 3, "base -> from -> to -> base is three legs");
  assert.deepEqual(
    full.legs.map((l) => l.kind),
    ["POSITIONING", "PASSENGER", "RETURN"],
  );
  assert.ok(full.totalRoutedNm > direct.totalRoutedNm, "full operation flies further");
  assert.ok(full.total.likely > direct.total.likely, "and therefore costs more");

  // --- 6. Range warning fires on a leg beyond the type's legs --------------
  const shortLegged = estimateFlightCost({
    typeCode: "C25A", // CJ2, ~1600 NM
    aircraftCategory: "business_jet",
    from: LFPB,
    to: OMDB,
  })!;
  assert.ok(shortLegged.rangeWarning, "a CJ2 cannot reach Dubai — that must be flagged");
  assert.match(shortLegged.rangeWarning!, /fuel stop/i);

  // --- 7. Fuel price drives fuel cost linearly -----------------------------
  const cheap = estimateFlightCost({ typeCode: "GLF6", aircraftCategory: "business_jet", from: LFPB, to: OMDB, fuelPricePerLitre: 1 })!;
  const dear = estimateFlightCost({ typeCode: "GLF6", aircraftCategory: "business_jet", from: LFPB, to: OMDB, fuelPricePerLitre: 2 })!;
  const cheapFuel = cheap.lines.find((l) => l.key === "fuel")!.likely;
  const dearFuel = dear.lines.find((l) => l.key === "fuel")!.likely;
  assert.ok(
    Math.abs(dearFuel - cheapFuel * 2) <= 2,
    `doubling the price should double fuel cost (${cheapFuel} -> ${dearFuel})`,
  );

  // --- 8. Gallon conversion ------------------------------------------------
  assert.ok(Math.abs(perGallonToPerLitre(4) - 1.0567) < 0.001, "USG -> litre conversion");

  // --- 9. A class fallback widens the fuel range ---------------------------
  const classFallback = estimateFlightCost({ typeCode: "ZZZZ", aircraftCategory: "business_jet", from: LFPB, to: LYBE })!;
  const exactType = estimateFlightCost({ typeCode: "GLF6", aircraftCategory: "business_jet", from: LFPB, to: LYBE })!;
  const spread = (e: typeof exactType) => {
    const f = e.lines.find((l) => l.key === "fuel")!;
    return (f.high - f.low) / f.likely;
  };
  assert.ok(
    spread(classFallback) > spread(exactType),
    "an unknown type must produce a wider fuel range than a documented one",
  );
  assert.match(classFallback.assumptions.join(" "), /class profile is used/);

  console.log(
    `G650 LFPB->OMDB: ${direct.legs[0].routedNm} NM, ${direct.totalBlockHours.toFixed(1)} h, ` +
      `${direct.totalFuelLitres.toLocaleString()} L, ` +
      `${direct.total.low.toLocaleString()}-${direct.total.high.toLocaleString()} ${direct.currency} ` +
      `(charter ${direct.charter!.low.toLocaleString()}-${direct.charter!.high.toLocaleString()})`,
  );
  console.log(
    `full operation via LYBE: ${full.totalRoutedNm} NM, ${full.total.likely.toLocaleString()} ${full.currency}`,
  );
  console.log("cost engine: all checks passed");
}

main();
