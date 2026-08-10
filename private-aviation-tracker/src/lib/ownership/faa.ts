import { isUsRegistration, normalizeRegistration } from "@/lib/aircraft/registration";
import { withDb } from "@/lib/db";
import type { OwnerKind, OwnershipSource } from "@/lib/types";

/**
 * Lookup against the FAA Releasable Aircraft Database, if it has been imported
 * (`npm run import:faa`). This is the single most reliable ownership source
 * available for US tails: it is the official register, published by the FAA as
 * public data, and it states the *registered owner* — which is frequently a
 * trustee or a single-purpose LLC rather than the beneficial owner.
 */

export interface FaaOwnerRecord {
  registrantName: string;
  ownerKind: OwnerKind;
  registrantTypeLabel: string | null;
  address: string | null;
  statusCode: string | null;
  yearBuilt: number | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  lastActionDate: Date | null;
  source: OwnershipSource;
}

const REGISTRANT_TYPES: Record<string, string> = {
  "1": "Individual",
  "2": "Partnership",
  "3": "Corporation",
  "4": "Co-owned",
  "5": "Government",
  "7": "LLC",
  "8": "Non-citizen corporation",
  "9": "Non-citizen co-owned",
};

function faaUrl(registration: string): string {
  return `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${encodeURIComponent(
    registration.replace(/^N/i, "").toUpperCase(),
  )}`;
}

function ownerKindFor(name: string, registrantType: string | null): OwnerKind {
  const upper = name.toUpperCase();
  if (/\bTRUSTEE\b|\bTRUST\b/.test(upper)) return "TRUSTEE";
  if (registrantType === "1") return "REGISTERED_OWNER";
  return "REGISTERED_OWNER";
}

export async function lookupFaaRegistration(
  registration: string,
): Promise<FaaOwnerRecord | null> {
  const reg = normalizeRegistration(registration);
  if (!reg || !isUsRegistration(reg)) return null;

  const row = await withDb(
    (db) => db.faaRegistration.findUnique({ where: { nNumber: reg } }),
    null,
    "faa",
  );
  if (!row || !row.registrantName) return null;

  const address = [row.street, row.city, row.state, row.zipCode, row.country]
    .filter(Boolean)
    .join(", ");

  return {
    registrantName: row.registrantName.trim(),
    ownerKind: ownerKindFor(row.registrantName, row.registrantType),
    registrantTypeLabel: row.registrantType ? REGISTRANT_TYPES[row.registrantType] ?? null : null,
    address: address || null,
    statusCode: row.statusCode,
    yearBuilt: row.yearMfr,
    serialNumber: row.serialNumber,
    manufacturer: row.manufacturer,
    model: row.model,
    lastActionDate: row.lastActionDate,
    source: {
      title: `FAA Civil Aviation Registry — ${reg}`,
      url: faaUrl(reg),
      label: "FAA Registry",
      kind: "official_registry",
      snippet: `Registered owner of record: ${row.registrantName.trim()}${
        address ? ` (${address})` : ""
      }.`,
      weight: 1,
    },
  };
}

/** Link to the official registry search for any registration, US or not. */
export function officialRegistrySource(registration: string, authority: string, url: string): OwnershipSource {
  return {
    title: `${authority} — search ${registration}`,
    url,
    label: authority,
    kind: "official_registry",
    weight: 0.9,
  };
}
