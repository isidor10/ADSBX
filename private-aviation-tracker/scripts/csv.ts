/** Minimal RFC-4180 CSV parser used by the import scripts. */

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

/** Iterate a CSV file as objects keyed by its header row. */
export async function* readCsv(
  path: string,
): AsyncGenerator<Record<string, string>, void, unknown> {
  const { createReadStream } = await import("node:fs");
  const { createInterface } = await import("node:readline");

  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });

  let header: string[] | null = null;
  for await (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (!header) {
      header = fields.map((f) => f.replace(/^﻿/, "").toUpperCase());
      continue;
    }
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      row[key] = fields[index] ?? "";
    });
    yield row;
  }
}

/** FAA dates are YYYYMMDD. */
export function parseFaaDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{8}$/.test(trimmed)) return null;
  const date = new Date(
    `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}T00:00:00Z`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseIntOrNull(value: string): number | null {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

export function parseFloatOrNull(value: string): number | null {
  const n = Number.parseFloat(value.trim());
  return Number.isFinite(n) ? n : null;
}
