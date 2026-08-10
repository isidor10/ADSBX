/**
 * Import the Serbian aircraft register and approved-operator list (DCV).
 *
 *   npm run import:dcv -- --aircraft ./dcv-register.csv
 *   npm run import:dcv -- --operators ./dcv-operators.csv
 *   npm run import:dcv -- --aircraft a.csv --operators o.csv --source-url https://cad.gov.rs/...
 *
 * Why an importer rather than a live scraper
 * -----------------------------------------
 * The Directorate of Civil Aviation publishes its register as documents for
 * human readers, not as an open API. Scraping it at request time would be
 * fragile, would put load on a public service, and could run into access
 * controls that must not be circumvented. Downloading the published file and
 * importing it is the compliant path: the operator of this deployment obtains
 * the data the way the authority intends it to be obtained, and this script
 * transcribes it faithfully, keeping the original row for audit.
 *
 * Column names are matched loosely and in both Serbian and English, because
 * the published headings change between editions. Anything unrecognised is
 * reported rather than silently dropped.
 *
 * Nothing here invents data. A field absent from the file stays null.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { upsertAocRows, upsertRegistryRows, DCV_REGISTRY_URL } from "../src/lib/registry/serbia";

interface Args {
  aircraft?: string;
  operators?: string;
  sourceUrl?: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--aircraft") args.aircraft = argv[++i];
    else if (key === "--operators") args.operators = argv[++i];
    else if (key === "--source-url") args.sourceUrl = argv[++i];
    else if (key === "--dry-run") args.dryRun = true;
  }
  return args;
}

/** Minimal RFC4180-ish CSV reader: quoted fields, embedded commas, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";" || ch === "\t") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  row.push(field.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/**
 * Latin-Serbian letters that Unicode normalisation does not decompose.
 * "đ" (U+0111) has no canonical decomposition, so NFKD leaves it intact and
 * the following strip removes it entirely — turning "proizvođač" into
 * "proizvoac", which matches no alias. Mapping these explicitly is what makes
 * Serbian column headings resolve at all.
 */
const SERBIAN_LETTERS: Record<string, string> = {
  "đ": "dj",
  "Đ": "dj",
  "ć": "c",
  "č": "c",
  "š": "s",
  "ž": "z",
};

function normaliseHeading(value: string): string {
  return value
    .replace(/[đĐćčšž]/g, (ch) => SERBIAN_LETTERS[ch] ?? ch)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Heading aliases, Serbian and English, for each field we care about. */
const AIRCRAFT_FIELDS: Record<string, string[]> = {
  registration: ["registracija", "oznaka", "registarskaoznaka", "registration", "regmark", "marks"],
  manufacturer: ["proizvodjac", "proizvodac", "proizvoda", "manufacturer", "maker"],
  model: ["model", "tip", "type", "aircrafttype", "tipvazduhoplova"],
  serialNumber: ["serijskibroj", "serijski", "serialnumber", "msn", "serial"],
  yearBuilt: ["godinaproizvodnje", "godina", "yearofmanufacture", "year"],
  registeredHolder: ["vlasnik", "korisnik", "imalac", "owner", "holder", "registeredowner"],
  holderAddress: ["adresa", "address", "sediste"],
  operator: ["operater", "operator", "koristnik", "operaterivazduhoplova"],
  status: ["status", "napomena", "remarks"],
};

const OPERATOR_FIELDS: Record<string, string[]> = {
  name: ["operater", "operator", "naziv", "nazivoperatera", "company", "name"],
  aocNumber: ["aoc", "aocbroj", "brojaoc", "aocnumber", "certificate", "brojsertifikata"],
  operationType: ["vrstaoperacija", "vrsta", "typeofoperation", "operations", "vrstasaobracaja"],
  operatingLicence: ["operativnadozvola", "dozvola", "operatinglicence", "licence", "license"],
  principalPlace: ["sediste", "adresa", "principalplaceofbusiness", "address", "mesto"],
  status: ["status", "vazenje", "validity", "napomena"],
};

function buildIndex(headings: string[], fields: Record<string, string[]>) {
  const normalised = headings.map(normaliseHeading);
  const index: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(fields)) {
    const at = normalised.findIndex((h) => aliases.some((a) => h === a || h.startsWith(a)));
    if (at >= 0) index[field] = at;
  }
  return { index, normalised };
}

const cell = (row: string[], at: number | undefined): string | null => {
  if (at === undefined) return null;
  const value = row[at]?.trim();
  return value ? value : null;
};

function readFile(file: string): string[][] {
  const resolved = path.resolve(file);
  if (!existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }
  const rows = parseCsv(readFileSync(resolved, "utf8"));
  if (rows.length < 2) {
    console.error(`${resolved} has no data rows.`);
    process.exit(1);
  }
  return rows;
}

async function importAircraft(file: string, sourceUrl: string, dryRun: boolean) {
  const [headings, ...rows] = readFile(file);
  const { index } = buildIndex(headings, AIRCRAFT_FIELDS);

  if (index.registration === undefined) {
    console.error(
      `Could not find a registration column in: ${headings.join(" | ")}\n` +
        `Expected one of: ${AIRCRAFT_FIELDS.registration.join(", ")}`,
    );
    process.exit(1);
  }

  const parsed = rows
    .map((row) => {
      const registration = cell(row, index.registration);
      if (!registration) return null;
      const year = cell(row, index.yearBuilt);
      return {
        registration: registration.toUpperCase().replace(/\s+/g, ""),
        aircraftType: cell(row, index.model),
        manufacturer: cell(row, index.manufacturer),
        model: cell(row, index.model),
        serialNumber: cell(row, index.serialNumber),
        yearBuilt: year && /^\d{4}$/.test(year) ? Number(year) : null,
        registeredHolder: cell(row, index.registeredHolder),
        holderAddress: cell(row, index.holderAddress),
        operator: cell(row, index.operator),
        status: cell(row, index.status),
        sourceUrl,
        // The untouched row, so any transcription can be checked later.
        raw: Object.fromEntries(headings.map((h, i) => [h, row[i] ?? ""])),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const serbian = parsed.filter((r) => /^YU-/.test(r.registration));
  if (serbian.length !== parsed.length) {
    console.log(
      `  ${parsed.length - serbian.length} row(s) are not YU- registrations and were skipped`,
    );
  }

  console.log(`aircraft: ${serbian.length} row(s) parsed from ${path.basename(file)}`);
  console.log(`  mapped columns: ${Object.keys(index).join(", ")}`);
  if (serbian[0]) {
    console.log(
      `  first row: ${serbian[0].registration} — ${serbian[0].manufacturer ?? "?"} ${serbian[0].model ?? ""} — holder: ${serbian[0].registeredHolder ?? "?"}`,
    );
  }
  if (dryRun) return;

  const written = await upsertRegistryRows(serbian);
  console.log(`  imported ${written} aircraft record(s)`);
}

async function importOperators(file: string, sourceUrl: string, dryRun: boolean) {
  const [headings, ...rows] = readFile(file);
  const { index } = buildIndex(headings, OPERATOR_FIELDS);

  if (index.name === undefined) {
    console.error(
      `Could not find an operator-name column in: ${headings.join(" | ")}\n` +
        `Expected one of: ${OPERATOR_FIELDS.name.join(", ")}`,
    );
    process.exit(1);
  }

  const parsed = rows
    .map((row) => {
      const name = cell(row, index.name);
      if (!name) return null;
      return {
        name,
        aocNumber: cell(row, index.aocNumber),
        operationType: cell(row, index.operationType),
        operatingLicence: cell(row, index.operatingLicence),
        principalPlace: cell(row, index.principalPlace),
        status: cell(row, index.status),
        sourceUrl,
        raw: Object.fromEntries(headings.map((h, i) => [h, row[i] ?? ""])),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`operators: ${parsed.length} row(s) parsed from ${path.basename(file)}`);
  console.log(`  mapped columns: ${Object.keys(index).join(", ")}`);
  if (parsed[0]) {
    console.log(`  first row: ${parsed[0].name} — AOC ${parsed[0].aocNumber ?? "not stated"}`);
  }
  if (dryRun) return;

  const written = await upsertAocRows(parsed);
  console.log(`  imported ${written} operator record(s)`);
}

async function main() {
  const args = parseArgs();
  if (!args.aircraft && !args.operators) {
    console.log(
      [
        "Import the Serbian aircraft register / approved-operator list.",
        "",
        "  npm run import:dcv -- --aircraft ./register.csv",
        "  npm run import:dcv -- --operators ./operators.csv",
        "  npm run import:dcv -- --aircraft a.csv --operators o.csv --dry-run",
        "",
        `Obtain the published files from the Directorate of Civil Aviation (${DCV_REGISTRY_URL}).`,
        "Save each table as CSV. Headings may be Serbian or English; both are recognised.",
        "--dry-run parses and reports without writing to the database.",
      ].join("\n"),
    );
    return;
  }

  const sourceUrl = args.sourceUrl ?? DCV_REGISTRY_URL;
  if (args.aircraft) await importAircraft(args.aircraft, sourceUrl, args.dryRun);
  if (args.operators) await importOperators(args.operators, sourceUrl, args.dryRun);
  if (args.dryRun) console.log("dry run — nothing written");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
