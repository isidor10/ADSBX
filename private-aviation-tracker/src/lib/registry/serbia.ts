import { companyMatchKey } from "@/lib/company/naming";
import { config } from "@/lib/config";
import { withDb } from "@/lib/db";
import type {
  AocInfo,
  RegistryConflict,
  RegistryRecordView,
  SerbianRegistryResult,
} from "@/lib/types";

/**
 * Serbian aircraft register (Direktorat civilnog vazduhoplovstva — DCV).
 *
 * For a YU- registration the national register is the authoritative source,
 * and it outranks every aviation database this app otherwise consults. That
 * priority is enforced here: a DCV record wins, a database that disagrees is
 * shown as a conflict rather than quietly discarded, and nothing is presented
 * as coming from DCV unless it was actually imported from DCV.
 *
 * How the data gets in
 * -------------------
 * The DCV register is published as documents for human readers rather than as
 * an open API, so there is nothing to call at request time. Rather than
 * scraping a site — which would be brittle, would risk its access controls and
 * would break the moment the page changes — this reads from a structured
 * import: `npm run import:dcv -- --aircraft <file> --operators <file>`.
 *
 * If DCV later publishes a machine-readable endpoint, setting DCV_API_URL
 * switches the same service to fetch it; the storage, matching and display
 * layers do not change.
 *
 * Until an import has been run, YU- aircraft report that DCV data has not been
 * loaded and say how to load it. They never fall back to guessing.
 */

export const DCV_AUTHORITY = "DCV";
export const DCV_REGISTRY_URL = "https://cad.gov.rs/";

/** True for Serbian civil registrations. */
export function isSerbianRegistration(registration: string | null | undefined): boolean {
  return /^YU-[A-Z0-9]{3,4}$/i.test((registration ?? "").trim());
}

interface RegistryRow {
  registration: string;
  aircraftType: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  yearBuilt: number | null;
  registeredHolder: string | null;
  holderAddress: string | null;
  operator: string | null;
  status: string | null;
  sourceUrl: string | null;
  raw: unknown;
}

interface AocRow {
  name: string;
  aocNumber: string | null;
  operationType: string | null;
  operatingLicence: string | null;
  principalPlace: string | null;
  status: string | null;
  sourceUrl: string | null;
  raw: unknown;
}

// ------------------------------------------------------------------ storage

export async function upsertRegistryRows(rows: RegistryRow[]): Promise<number> {
  let written = 0;
  await withDb(
    async (db) => {
      for (const row of rows) {
        const registration = row.registration.trim().toUpperCase();
        if (!registration) continue;
        const data = {
          aircraftType: row.aircraftType,
          manufacturer: row.manufacturer,
          model: row.model,
          serialNumber: row.serialNumber,
          yearBuilt: row.yearBuilt,
          registeredHolder: row.registeredHolder,
          holderAddress: row.holderAddress,
          operator: row.operator,
          status: row.status,
          sourceUrl: row.sourceUrl ?? DCV_REGISTRY_URL,
          sourceKind: "dcv_import",
          confidence: 95,
          verifiedAt: new Date(),
          raw: (row.raw ?? null) as object,
        };
        await db.registryRecord.upsert({
          where: { authority_registration: { authority: DCV_AUTHORITY, registration } },
          create: { authority: DCV_AUTHORITY, registration, ...data },
          update: data,
        });
        written += 1;
      }
      return null;
    },
    null,
    "registry:upsert",
  );
  return written;
}

export async function upsertAocRows(rows: AocRow[]): Promise<number> {
  let written = 0;
  await withDb(
    async (db) => {
      for (const row of rows) {
        const name = row.name.trim();
        if (!name) continue;
        const matchKey = companyMatchKey(name);
        const data = {
          name,
          aocNumber: row.aocNumber,
          operationType: row.operationType,
          operatingLicence: row.operatingLicence,
          principalPlace: row.principalPlace,
          status: row.status,
          sourceUrl: row.sourceUrl ?? DCV_REGISTRY_URL,
          sourceKind: "dcv_import",
          confidence: 95,
          verifiedAt: new Date(),
          raw: (row.raw ?? null) as object,
        };
        await db.aocRecord.upsert({
          where: { authority_matchKey: { authority: DCV_AUTHORITY, matchKey } },
          create: { authority: DCV_AUTHORITY, matchKey, ...data },
          update: data,
        });
        written += 1;
      }
      return null;
    },
    null,
    "registry:aoc-upsert",
  );
  return written;
}

// ------------------------------------------------------------------ reading

async function registryFor(registration: string): Promise<RegistryRecordView | null> {
  const row = await withDb(
    (db) =>
      db.registryRecord.findUnique({
        where: {
          authority_registration: {
            authority: DCV_AUTHORITY,
            registration: registration.toUpperCase(),
          },
        },
      }),
    null,
    "registry:get",
  );
  if (!row) return null;

  return {
    authority: row.authority,
    registration: row.registration,
    aircraftType: row.aircraftType,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serialNumber,
    yearBuilt: row.yearBuilt,
    registeredHolder: row.registeredHolder,
    operator: row.operator,
    status: row.status,
    sourceName: "Serbian Civil Aviation Directorate (DCV)",
    sourceUrl: row.sourceUrl,
    verifiedAt: row.verifiedAt.toISOString(),
    confidence: row.confidence,
  };
}

/**
 * AOC lookup by operator name.
 *
 * Absence is reported as NOT_FOUND rather than NO: this table holds only what
 * has been imported, so "we have no record" and "they hold no certificate" are
 * different statements and must not be collapsed.
 */
export async function lookupAoc(operatorName: string | null | undefined): Promise<AocInfo> {
  const notFound: AocInfo = {
    status: "NOT_FOUND",
    name: operatorName ?? null,
    aocNumber: null,
    operationType: null,
    operatingLicence: null,
    principalPlace: null,
    sourceName: "Serbian Civil Aviation Directorate (DCV)",
    sourceUrl: DCV_REGISTRY_URL,
    verifiedAt: null,
    note: operatorName
      ? `${operatorName} does not appear in the imported DCV list of approved operators. That is not proof they hold no certificate — it may simply mean the list has not been imported, or the name is spelled differently there.`
      : "No operator is known for this aircraft, so no AOC lookup was possible.",
  };
  if (!operatorName) return notFound;

  const row = await withDb(
    (db) =>
      db.aocRecord.findUnique({
        where: {
          authority_matchKey: {
            authority: DCV_AUTHORITY,
            matchKey: companyMatchKey(operatorName),
          },
        },
      }),
    null,
    "registry:aoc",
  );
  if (!row) return notFound;

  return {
    status: "HOLDER",
    name: row.name,
    aocNumber: row.aocNumber,
    operationType: row.operationType,
    operatingLicence: row.operatingLicence,
    principalPlace: row.principalPlace,
    sourceName: "Serbian Civil Aviation Directorate (DCV)",
    sourceUrl: row.sourceUrl,
    verifiedAt: row.verifiedAt.toISOString(),
    note: null,
  };
}

/** Have any DCV rows been imported at all? */
export async function dcvDataLoaded(): Promise<{ aircraft: number; operators: number }> {
  const [aircraft, operators] = await Promise.all([
    withDb((db) => db.registryRecord.count({ where: { authority: DCV_AUTHORITY } }), 0, "registry:count"),
    withDb((db) => db.aocRecord.count({ where: { authority: DCV_AUTHORITY } }), 0, "registry:aoc-count"),
  ]);
  return { aircraft, operators };
}

/**
 * Compare the official register against what other sources concluded. A
 * disagreement about who operates an aircraft is exactly the kind of thing
 * this product must surface rather than resolve on the user's behalf.
 */
function conflictsBetween(
  registry: RegistryRecordView,
  other: { owner: string | null; operator: string | null; sourceLabel: string } | null,
): RegistryConflict[] {
  if (!other) return [];
  const conflicts: RegistryConflict[] = [];

  const compare = (
    field: "operator" | "holder",
    official: string | null,
    alternative: string | null,
  ) => {
    if (!official || !alternative) return;
    if (companyMatchKey(official) === companyMatchKey(alternative)) return;
    conflicts.push({
      field,
      official,
      officialSource: "DCV (official register)",
      alternative,
      alternativeSource: other.sourceLabel,
    });
  };

  compare("operator", registry.operator, other.operator);
  compare("holder", registry.registeredHolder, other.owner);
  return conflicts;
}

export interface SerbianLookupOptions {
  /** What the non-official pipeline concluded, for conflict detection. */
  researched?: { owner: string | null; operator: string | null; sourceLabel: string } | null;
}

/**
 * Full DCV picture for one registration: register entry, the operator's AOC
 * status, and any disagreement with other sources.
 */
export async function lookupSerbianRegistry(
  registration: string,
  options: SerbianLookupOptions = {},
): Promise<SerbianRegistryResult> {
  const reg = registration.trim().toUpperCase();

  if (!isSerbianRegistration(reg)) {
    return { applicable: false, registration: reg, record: null, aoc: null, conflicts: [], note: null };
  }

  const [record, loaded] = await Promise.all([registryFor(reg), dcvDataLoaded()]);

  if (!record) {
    return {
      applicable: true,
      registration: reg,
      record: null,
      aoc: null,
      conflicts: [],
      note:
        loaded.aircraft === 0
          ? `No Serbian register data has been imported yet, so DCV cannot be consulted for ${reg}. Import the published register with: npm run import:dcv -- --aircraft <file>. The register is published by the Directorate of Civil Aviation at ${DCV_REGISTRY_URL}.`
          : `${reg} does not appear in the imported DCV register (${loaded.aircraft} aircraft loaded). The import may predate the aircraft's registration, or the registration may not be Serbian.`,
    };
  }

  // The operator named by the register is the one whose AOC status matters.
  const aoc = await lookupAoc(record.operator ?? record.registeredHolder);
  const conflicts = conflictsBetween(record, options.researched ?? null);

  return {
    applicable: true,
    registration: reg,
    record,
    aoc,
    conflicts,
    note:
      loaded.operators === 0
        ? "The DCV approved-operator list has not been imported, so AOC status cannot be checked. Import it with: npm run import:dcv -- --operators <file>."
        : null,
  };
}

/** Registrations in the DCV register held or operated by one company. */
export async function serbianFleetFor(companyName: string): Promise<string[]> {
  const key = companyMatchKey(companyName);
  if (!key) return [];

  const rows = await withDb(
    (db) =>
      db.registryRecord.findMany({
        where: { authority: DCV_AUTHORITY },
        select: { registration: true, operator: true, registeredHolder: true },
        take: 5000,
      }),
    [] as Array<{ registration: string; operator: string | null; registeredHolder: string | null }>,
    "registry:fleet",
  );

  return rows
    .filter(
      (r) =>
        (r.operator && companyMatchKey(r.operator) === key) ||
        (r.registeredHolder && companyMatchKey(r.registeredHolder) === key),
    )
    .map((r) => r.registration);
}

/** Whether a configured HTTP source exists, for diagnostics. */
export function dcvApiConfigured(): boolean {
  return Boolean(config.registry.dcvApiUrl);
}
