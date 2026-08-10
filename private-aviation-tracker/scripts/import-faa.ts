/**
 * Import the FAA Releasable Aircraft Database into Postgres.
 *
 * The dataset is published by the US FAA as public data and is the
 * authoritative record of the *registered owner* for every N-numbered
 * aircraft. Loading it turns US ownership lookups from "best guess from web
 * sources" into "official register says X".
 *
 *   1. Download https://registry.faa.gov/database/ReleasableAircraft.zip
 *   2. Extract it (MASTER.txt and ACFTREF.txt are the files used here)
 *   3. npm run import:faa -- --dir ./ReleasableAircraft
 *
 * Re-run monthly; the FAA refreshes the file daily.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { parseFaaDate, parseIntOrNull, readCsv } from "./csv";

const prisma = new PrismaClient();
const BATCH_SIZE = 2000;

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

interface AircraftRef {
  manufacturer: string;
  model: string;
  aircraftType: string;
  engineType: string;
}

async function loadAircraftReference(dir: string): Promise<Map<string, AircraftRef>> {
  const file = path.join(dir, "ACFTREF.txt");
  const refs = new Map<string, AircraftRef>();
  if (!existsSync(file)) {
    console.warn("ACFTREF.txt not found — manufacturer/model will be blank.");
    return refs;
  }

  for await (const row of readCsv(file)) {
    const code = row["CODE"]?.trim();
    if (!code) continue;
    refs.set(code, {
      manufacturer: row["MFR"]?.trim() ?? "",
      model: row["MODEL"]?.trim() ?? "",
      aircraftType: row["TYPE-ACFT"]?.trim() ?? "",
      engineType: row["TYPE-ENG"]?.trim() ?? "",
    });
  }
  console.log(`Loaded ${refs.size.toLocaleString()} aircraft reference rows.`);
  return refs;
}

async function main() {
  const dir = arg("dir");
  if (!dir) {
    console.error(
      "Usage: npm run import:faa -- --dir <path to extracted ReleasableAircraft folder>",
    );
    process.exit(1);
  }

  const masterFile = path.join(dir, "MASTER.txt");
  if (!existsSync(masterFile)) {
    console.error(`MASTER.txt not found in ${dir}`);
    process.exit(1);
  }

  const refs = await loadAircraftReference(dir);

  console.log("Clearing existing FAA registration rows…");
  await prisma.faaRegistration.deleteMany({});

  let batch: Prisma.FaaRegistrationCreateManyInput[] = [];
  let total = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    await prisma.faaRegistration.createMany({ data: batch, skipDuplicates: true });
    total += batch.length;
    batch = [];
    process.stdout.write(`\rImported ${total.toLocaleString()} registrations…`);
  };

  for await (const row of readCsv(masterFile)) {
    const nNumber = row["N-NUMBER"]?.trim();
    if (!nNumber) continue;

    const ref = refs.get(row["MFR MDL CODE"]?.trim() ?? "");
    const record = {
      // Stored with the leading N so it matches the registrations used app-wide.
      nNumber: `N${nNumber.toUpperCase()}`,
      serialNumber: row["SERIAL NUMBER"]?.trim() || null,
      mfrMdlCode: row["MFR MDL CODE"]?.trim() || null,
      engMfrMdlCode: row["ENG MFR MDL"]?.trim() || null,
      yearMfr: parseIntOrNull(row["YEAR MFR"] ?? ""),
      registrantType: row["TYPE REGISTRANT"]?.trim() || null,
      registrantName: row["NAME"]?.trim() || null,
      street: [row["STREET"], row["STREET2"]].map((s) => s?.trim()).filter(Boolean).join(" ") || null,
      city: row["CITY"]?.trim() || null,
      state: row["STATE"]?.trim() || null,
      zipCode: row["ZIP CODE"]?.trim() || null,
      country: row["COUNTRY"]?.trim() || null,
      lastActionDate: parseFaaDate(row["LAST ACTION DATE"] ?? ""),
      certIssueDate: parseFaaDate(row["CERT ISSUE DATE"] ?? ""),
      statusCode: row["STATUS CODE"]?.trim() || null,
      modeSHex: row["MODE S CODE HEX"]?.trim().toLowerCase() || null,
      fractionalOwner: (row["FRACT OWNER"] ?? "").trim().toUpperCase() === "Y",
      expirationDate: parseFaaDate(row["EXPIRATION DATE"] ?? ""),
      manufacturer: ref?.manufacturer || null,
      model: ref?.model || null,
      aircraftType: ref?.aircraftType || null,
      engineType: ref?.engineType || null,
    };

    batch.push(record);
    if (batch.length >= BATCH_SIZE) await flush();
  }

  await flush();
  process.stdout.write("\n");
  console.log(`Done. ${total.toLocaleString()} FAA registrations imported.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
