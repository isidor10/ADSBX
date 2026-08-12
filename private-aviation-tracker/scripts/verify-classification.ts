/**
 * The classification engine, tested against the cases that matter.
 *
 *   npm run verify:classification
 *
 * The headline requirement is negative: a scheduled airline must never reach
 * the private-aviation map. The app was showing SunExpress, and the cause was
 * a data error — SXS was listed as a business-aviation operator callsign, so
 * every SunExpress flight with an unrecognised type code was promoted to
 * "charter" and drawn. These checks pin that shut and cover the classes either
 * side of it.
 */

import assert from "node:assert/strict";
import { matchesFilters } from "../src/lib/aircraft/classifier";
import { classifyOperation } from "../src/lib/aircraft/operationalClass";
import { normalizeAircraft } from "../src/lib/adsb/normalize";
import { lookupAirlineCallsign, lookupAirlineName } from "../src/lib/aircraft/airlineDatabase";
import { BIZAV_OPERATOR_CALLSIGNS } from "../src/lib/aircraft/typeDatabase";
import type { LiveAircraft } from "../src/lib/types";
import type { RawAircraft } from "../src/lib/adsb/types";

const DEFAULT_FILTERS = ["business" as const];

function contact(raw: RawAircraft): LiveAircraft {
  const a = normalizeAircraft({ lat: 45, lon: 20, ...raw }, "test");
  assert.ok(a, "the fixture must normalise");
  return a;
}

function main() {
  // ---- 1. No scheduled carrier may sit in the bizav callsign table -------
  // This is the actual defect that put SunExpress on the map. Assert the
  // classes cannot overlap again rather than just removing the one entry.
  const overlap = Object.keys(BIZAV_OPERATOR_CALLSIGNS).filter((code) =>
    lookupAirlineCallsign(`${code}123`),
  );
  assert.deepEqual(overlap, [], `scheduled carriers listed as business aviation: ${overlap}`);
  console.log("1. no airline code is listed as a business-aviation operator");

  // ---- 2. SunExpress: the reported bug ----------------------------------
  // Unrecognised type code, exactly the case that used to be promoted.
  const sunExpress = contact({ hex: "4bb1c3", flight: "SXS1848 ", t: "B38M", r: "TC-SOE" });
  assert.equal(sunExpress.operation, "AIRLINE");
  assert.equal(
    matchesFilters(sunExpress, DEFAULT_FILTERS),
    false,
    "SunExpress must not appear on the default private-aviation map",
  );
  assert.equal(
    matchesFilters(sunExpress, ["business", "airline"]),
    true,
    "it must still be visible when airlines are explicitly enabled",
  );

  // Even with no type code at all, the callsign is enough.
  const noType = contact({ hex: "4bb1c4", flight: "SXS42  " });
  assert.equal(noType.operation, "AIRLINE", "an unknown airframe must not rescue an airline");
  assert.equal(matchesFilters(noType, DEFAULT_FILTERS), false);
  console.log("2. SunExpress hidden by default, with and without a type code");

  // ---- 3. The other named carriers --------------------------------------
  for (const [cs, who] of [
    ["THY1846", "Turkish Airlines"],
    ["WZZ3421", "Wizz Air"],
    ["RYR84HK", "Ryanair"],
    ["DLH400", "Lufthansa"],
    ["ASL501", "Air Serbia"],
    ["EZY83VT", "easyJet"],
    ["UAE73", "Emirates"],
    ["QTR8", "Qatar Airways"],
    ["BAW117", "British Airways"],
    ["KLM1001", "KLM"],
    ["AFR447", "Air France"],
  ] as const) {
    const a = contact({ hex: "abc123", flight: `${cs} `, t: "A320" });
    assert.equal(a.operation, "AIRLINE", `${who} (${cs}) must classify as an airline`);
    assert.equal(matchesFilters(a, DEFAULT_FILTERS), false, `${who} must be hidden by default`);
  }
  console.log("3. every named carrier classifies as AIRLINE and is hidden");

  // ---- 4. An airline missing from the code table is still caught ---------
  // By name...
  assert.equal(lookupAirlineName("Some Regional Airlines Ltd")?.kind, "airline");
  assert.equal(lookupAirlineName("Volga Freight Logistics")?.kind, "cargo");
  // ...and by airframe, as the backstop.
  const unlistedCarrier = contact({ hex: "aa0001", flight: "ZZZ1234 ", t: "B738" });
  assert.equal(
    unlistedCarrier.operation,
    "AIRLINE",
    "an airliner airframe with no business signal defaults to airline",
  );
  console.log("4. unlisted carriers caught by operator name and by airframe");

  // ---- 5. "Air Hamburg" must not be mistaken for an airline -------------
  // The name heuristic has to be conservative: business-aviation companies are
  // full of the word "Air".
  assert.equal(lookupAirlineName("Air Hamburg"), null);
  assert.equal(lookupAirlineName("Prince Aviation DOO"), null);
  assert.equal(lookupAirlineName("Jet Aviation Business Jets"), null);
  const airHamburg = contact({ hex: "3c0001", flight: "AHO123 ", t: "E55P", r: "D-CAAA" });
  assert.notEqual(airHamburg.operation, "AIRLINE");
  assert.equal(matchesFilters(airHamburg, DEFAULT_FILTERS), true, "bizav operators stay visible");
  console.log("5. business-aviation operators are not mistaken for airlines");

  // ---- 6. A private jet flying under its own registration ---------------
  const ownerFlown = contact({ hex: "3c0002", flight: "DCAAA  ", t: "C56X", r: "D-CAAA" });
  assert.equal(matchesFilters(ownerFlown, DEFAULT_FILTERS), true);
  assert.ok(
    ["PRIVATE", "BUSINESS_AVIATION", "CORPORATE"].includes(ownerFlown.operation!),
    `expected a private class, got ${ownerFlown.operation}`,
  );
  console.log("6. owner-flown business jet is visible");

  // ---- 7. Data status drives the colour, not the airframe ---------------
  // The same G650 gets four different colours depending only on what is known.
  const base = {
    registration: "N123AB",
    icao24: "a12345",
    callsign: "N123AB",
    typeCode: "GLF6",
    airframe: "business_jet" as const,
    feedOperator: null,
    isMilitary: false,
    isSpecial: false,
    isBlocked: false,
  };

  const bare = classifyOperation(base);
  assert.equal(bare.dataStatus, "UNKNOWN", "nothing known -> grey");

  const withOperator = classifyOperation({ ...base, operator: "XYZ Aviation" });
  assert.equal(withOperator.dataStatus, "OPERATOR_KNOWN", "operator only -> orange");

  const corporate = classifyOperation({
    ...base,
    operator: "XYZ Aviation",
    owner: "XYZ Holdings LLC",
    company: "Walmart Inc.",
    fromOfficialRegistry: true,
  });
  assert.equal(corporate.dataStatus, "CORPORATE", "company association -> blue");
  assert.equal(corporate.operation, "CORPORATE");

  const charter = classifyOperation({
    ...base,
    callsign: "EJA002",
    operator: "NetJets Aviation",
    aocNumber: "RS-012",
  });
  assert.equal(charter.dataStatus, "CHARTER_AOC", "AOC holder -> purple");
  assert.equal(charter.operation, "CHARTER");

  const verified = classifyOperation({
    ...base,
    owner: "John Smith",
    operator: "Self",
    fromOfficialRegistry: true,
  });
  assert.equal(verified.dataStatus, "VERIFIED_PRIVATE", "owner + operator verified -> green");
  assert.equal(verified.operation, "PRIVATE");
  assert.ok(verified.confidence > corporate.confidence - 100);
  console.log("7. the same airframe takes four colours from data status alone");

  // ---- 8. Conflicting sources are surfaced, not silently resolved -------
  const conflicted = classifyOperation({
    ...base,
    feedOperator: "Globe Air",
    operator: "Prince Aviation",
  });
  assert.equal(conflicted.dataStatus, "CONFLICT", "two different operators -> red");
  assert.ok(
    conflicted.reasons.some((r) => r.label === "Data conflict"),
    "the conflict must be explained",
  );

  // But a spelling variant of the same company is not a conflict.
  const notConflicted = classifyOperation({
    ...base,
    feedOperator: "Prince Aviation DOO",
    operator: "Prince Aviation",
  });
  assert.notEqual(notConflicted.dataStatus, "CONFLICT", "a legal-suffix variant is the same entity");
  console.log("8. genuine conflicts flagged, spelling variants are not");

  // ---- 9. Every classification can show its working ---------------------
  for (const result of [bare, withOperator, corporate, charter, verified, conflicted]) {
    assert.ok(result.reasons.length > 0, "a classification with no stated reason is not allowed");
    for (const reason of result.reasons) {
      assert.ok(reason.detail.length > 10, `reason "${reason.label}" must explain itself`);
    }
  }
  console.log("9. every verdict carries its evidence");

  // ---- 10. Military and cargo stay off the default map ------------------
  const military = contact({ hex: "ae1234", flight: "RCH451 ", t: "C17" });
  assert.equal(military.operation, "MILITARY");
  assert.equal(matchesFilters(military, DEFAULT_FILTERS), false);
  assert.equal(matchesFilters(military, ["business", "military"]), true);

  const cargo = contact({ hex: "a00001", flight: "FDX1234 ", t: "B763" });
  assert.equal(cargo.operation, "CARGO");
  assert.equal(matchesFilters(cargo, DEFAULT_FILTERS), false);
  assert.equal(matchesFilters(cargo, ["business", "cargo"]), true);
  console.log("10. military and cargo hidden by default, available on request");

  console.log("aircraft classification: all checks passed");
}

main();
