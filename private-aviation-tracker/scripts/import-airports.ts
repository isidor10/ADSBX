/**
 * Import airport reference data from OurAirports (public domain).
 *
 * The app ships with a curated core list so departure/arrival inference works
 * out of the box; importing the full dataset makes small private fields
 * resolvable too, which matters for business aviation.
 *
 *   curl -O https://davidmegginson.github.io/ourairports-data/airports.csv
 *   npm run import:airports -- --file ./airports.csv
 *
 * Heliports and closed fields are skipped by default; pass --all to keep them.
 */

import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { parseFloatOrNull, parseIntOrNull, readCsv } from "./csv";

const prisma = new PrismaClient();
const BATCH_SIZE = 1000;

const KEEP_TYPES = new Set(["large_airport", "medium_airport", "small_airport"]);

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function main() {
  const file = arg("file");
  const keepAll = process.argv.includes("--all");

  if (!file || !existsSync(file)) {
    console.error("Usage: npm run import:airports -- --file ./airports.csv");
    process.exit(1);
  }

  let batch: Array<{
    icao: string;
    iata: string | null;
    name: string;
    city: string | null;
    country: string | null;
    lat: number;
    lon: number;
    elevationFt: number | null;
    type: string | null;
  }> = [];
  let total = 0;
  let skipped = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    // Upsert-by-batch: delete then insert keeps this simple and idempotent.
    await prisma.$transaction([
      prisma.airport.deleteMany({ where: { icao: { in: batch.map((a) => a.icao) } } }),
      prisma.airport.createMany({ data: batch, skipDuplicates: true }),
    ]);
    total += batch.length;
    batch = [];
    process.stdout.write(`\rImported ${total.toLocaleString()} airports…`);
  };

  for await (const row of readCsv(file)) {
    const type = row["TYPE"]?.trim();
    if (!keepAll && !KEEP_TYPES.has(type ?? "")) {
      skipped++;
      continue;
    }

    // Prefer the ICAO code column; fall back to `ident` when it looks like one.
    const ident = row["IDENT"]?.trim().toUpperCase() ?? "";
    const icaoCode = row["ICAO_CODE"]?.trim().toUpperCase() || ident;
    const lat = parseFloatOrNull(row["LATITUDE_DEG"] ?? "");
    const lon = parseFloatOrNull(row["LONGITUDE_DEG"] ?? "");

    if (!icaoCode || !/^[A-Z0-9]{3,7}$/.test(icaoCode) || lat === null || lon === null) {
      skipped++;
      continue;
    }

    batch.push({
      icao: icaoCode,
      iata: row["IATA_CODE"]?.trim().toUpperCase() || null,
      name: row["NAME"]?.trim() || icaoCode,
      city: row["MUNICIPALITY"]?.trim() || null,
      country: row["ISO_COUNTRY"]?.trim() || null,
      lat,
      lon,
      elevationFt: parseIntOrNull(row["ELEVATION_FT"] ?? ""),
      type: type || null,
    });

    if (batch.length >= BATCH_SIZE) await flush();
  }

  await flush();
  process.stdout.write("\n");
  console.log(`Done. ${total.toLocaleString()} airports imported, ${skipped.toLocaleString()} skipped.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
