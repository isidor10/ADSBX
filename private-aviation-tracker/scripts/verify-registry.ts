/**
 * Serbian registry (DCV) + costed history checks.
 *
 *   DATABASE_URL=... npm run verify:registry
 *
 * Imports a small CSV through the real importer, then exercises the lookup,
 * AOC matching, conflict detection and the costed history aggregation.
 * No network, no credentials.
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AIRCRAFT_CSV = `Registarska oznaka,Proizvođač,Model,Serijski broj,Godina proizvodnje,Vlasnik,Operater,Status
YU-TST,Cessna,560XL Citation XLS+,560-5901,2011,Adriatic Holdings DOO,Prince Aviation DOO,Registrovan
YU-BBB,Bombardier,CL-600-2B16 Challenger 604,5501,2003,Prince Aviation DOO,Prince Aviation DOO,Registrovan
N999ZZ,Gulfstream,G650,6001,2015,Not Serbian LLC,Somebody Else,Registered
`;

const OPERATORS_CSV = `Naziv operatera,Broj AOC,Vrsta operacija,Operativna dozvola,Sedište,Status
Prince Aviation DOO,RS-012,javni avio-prevoz,DA,Beograd,Važeći
Some Other Air DOO,RS-044,javni avio-prevoz,DA,Niš,Važeći
`;

async function run(args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "import-dcv.ts");
  return new Promise((resolve, reject) => {
    execFile("npx", ["tsx", script, ...args], { env }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${stdout}\n${stderr}`));
      else resolve(stdout);
    });
  });
}

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "dcv-"));
  const aircraftFile = path.join(dir, "register.csv");
  const operatorsFile = path.join(dir, "operators.csv");
  writeFileSync(aircraftFile, AIRCRAFT_CSV);
  writeFileSync(operatorsFile, OPERATORS_CSV);

  // ---- 1. the importer parses Serbian headings and skips non-YU rows ------
  const out = await run(
    ["--aircraft", aircraftFile, "--operators", operatorsFile],
    process.env,
  );
  assert.match(out, /2 row\(s\) parsed/, "two YU- aircraft should import");
  assert.match(out, /not YU- registrations and were skipped/, "the N-number must be skipped");
  assert.match(out, /imported 2 aircraft record/);
  assert.match(out, /imported 2 operator record/);
  console.log("importer: Serbian headings mapped, non-YU rows skipped");

  const { lookupSerbianRegistry, isSerbianRegistration, serbianFleetFor } = await import(
    "../src/lib/registry/serbia"
  );

  // ---- 2. YU detection ----------------------------------------------------
  assert.equal(isSerbianRegistration("YU-TST"), true);
  assert.equal(isSerbianRegistration("N650TT"), false);

  // ---- 3. register entry + AOC -------------------------------------------
  const result = await lookupSerbianRegistry("YU-TST");
  assert.equal(result.applicable, true);
  assert.ok(result.record, "the imported aircraft must be found");
  assert.equal(result.record.manufacturer, "Cessna");
  assert.equal(result.record.serialNumber, "560-5901");
  assert.equal(result.record.registeredHolder, "Adriatic Holdings DOO");
  assert.equal(result.record.operator, "Prince Aviation DOO");
  assert.equal(result.record.sourceName, "Serbian Civil Aviation Directorate (DCV)");

  assert.ok(result.aoc);
  assert.equal(result.aoc.status, "HOLDER", "the operator is on the approved list");
  assert.equal(result.aoc.aocNumber, "RS-012");
  assert.equal(result.aoc.operationType, "javni avio-prevoz");
  console.log(
    `YU-TST: holder ${result.record.registeredHolder}, operator ${result.record.operator}, AOC ${result.aoc.aocNumber}`,
  );

  // ---- 4. holder != operator is preserved --------------------------------
  assert.notEqual(
    result.record.registeredHolder,
    result.record.operator,
    "holder and operator must remain distinct fields",
  );

  // ---- 5. an operator absent from the list is NOT_FOUND, never "NO" -------
  const { lookupAoc } = await import("../src/lib/registry/serbia");
  const missing = await lookupAoc("Unlisted Air DOO");
  assert.equal(missing.status, "NOT_FOUND");
  assert.match(missing.note ?? "", /not proof/i, "absence must not be presented as proof");

  // ---- 6. source conflict is surfaced, not resolved -----------------------
  const conflicted = await lookupSerbianRegistry("YU-TST", {
    researched: {
      owner: "Adriatic Holdings DOO",
      operator: "Completely Different Air",
      sourceLabel: "adsbdb",
    },
  });
  assert.equal(conflicted.conflicts.length, 1, "the operator disagreement must be reported");
  assert.equal(conflicted.conflicts[0].field, "operator");
  assert.equal(conflicted.conflicts[0].official, "Prince Aviation DOO");
  assert.equal(conflicted.conflicts[0].alternative, "Completely Different Air");
  // The matching owner must NOT be reported as a conflict.
  console.log("conflict: operator disagreement surfaced, matching holder ignored");

  // ---- 7. legal-suffix tolerance in AOC matching --------------------------
  const suffixless = await lookupAoc("Prince Aviation");
  assert.equal(suffixless.status, "HOLDER", "d.o.o. suffix must not break AOC matching");

  // ---- 8. fleet by operator ----------------------------------------------
  const fleet = await serbianFleetFor("Prince Aviation DOO");
  assert.deepEqual(fleet.sort(), ["YU-BBB", "YU-TST"], "both aircraft link to the operator");
  console.log(`fleet: ${fleet.join(", ")}`);

  // ---- 9. non-Serbian registrations are not applicable --------------------
  const foreign = await lookupSerbianRegistry("N650TT");
  assert.equal(foreign.applicable, false, "the section must not render for non-YU tails");

  // ---- 10. costed history reports coverage honestly -----------------------
  const { getCostedHistory, windowFromDays } = await import("../src/lib/history/costed");
  const history = await getCostedHistory("YU-TST", windowFromDays(90));
  assert.equal(history.registration, "YU-TST");
  assert.ok(history.coveragePercent >= 0 && history.coveragePercent <= 100);
  assert.ok(
    history.flights.length > 0 || history.note,
    "an empty history must explain itself rather than showing nothing",
  );
  if (history.flights.length === 0) {
    assert.match(history.note ?? "", /does not back-fill|not observed/i);
  }
  console.log(
    `history: ${history.flights.length} flight(s), coverage ${history.coveragePercent}%`,
  );

  console.log("registry + costed history: all checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
