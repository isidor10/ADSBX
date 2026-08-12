import { classify } from "@/lib/aircraft/classifier";
import { normalizeIcao24, normalizeRegistration } from "@/lib/aircraft/registration";
import { lookupType } from "@/lib/aircraft/typeDatabase";
import type { FlightPhase, LiveAircraft } from "@/lib/types";
import { classifyOperation } from "@/lib/aircraft/operationalClass";
import { positionSourceFor } from "./positionSource";
import type { RawAircraft } from "./types";

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function altitudeFeet(value: number | "ground" | undefined): {
  alt: number | null;
  onGround: boolean;
} {
  if (value === "ground") return { alt: 0, onGround: true };
  const n = toNumber(value);
  return { alt: n, onGround: false };
}

function flightPhase(
  onGround: boolean,
  altFt: number | null,
  verticalRate: number | null,
): FlightPhase {
  if (onGround) return "on_ground";
  if (altFt === null) return "unknown";
  if (verticalRate !== null && verticalRate > 300) return "climbing";
  if (verticalRate !== null && verticalRate < -300) return "descending";
  if (altFt >= 18000) return "cruising";
  return "level";
}

/**
 * Split a feed `desc` string ("GULFSTREAM AEROSPACE G-VI") into manufacturer
 * and model when the curated type database has no entry.
 */
function splitDescription(desc: string | undefined): { manufacturer: string | null; model: string | null } {
  if (!desc) return { manufacturer: null, model: null };
  const clean = desc.trim();
  if (!clean) return { manufacturer: null, model: null };
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { manufacturer: clean, model: null };
  return { manufacturer: parts[0], model: parts.slice(1).join(" ") };
}

/** Convert one raw feed record into the app's canonical aircraft shape. */
export function normalizeAircraft(raw: RawAircraft, source: string, now = Date.now()): LiveAircraft | null {
  const lat = toNumber(raw.lat);
  const lon = toNumber(raw.lon);
  const icao24 = normalizeIcao24(raw.hex);
  if (lat === null || lon === null || !icao24) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  const { alt: altBaroFt, onGround } = altitudeFeet(raw.alt_baro);
  const registration = normalizeRegistration(raw.r);
  const callsign = raw.flight?.trim().toUpperCase() || null;
  const typeCode = raw.t?.trim().toUpperCase() || null;
  const verticalRateFpm = toNumber(raw.baro_rate) ?? toNumber(raw.geom_rate);

  const classification = classify({
    typeCode,
    callsign,
    registration,
    emitterCategory: raw.category ?? null,
    dbFlags: toNumber(raw.dbFlags),
    operator: raw.ownOp ?? null,
  });

  const typeInfo = lookupType(typeCode);
  const fromDesc = splitDescription(raw.desc);
  const ageSec = toNumber(raw.seen_pos) ?? toNumber(raw.seen);

  return {
    icao24,
    registration,
    callsign,
    typeCode,
    manufacturer: typeInfo?.manufacturer ?? fromDesc.manufacturer,
    model: typeInfo?.model ?? fromDesc.model,
    category: classification.category,
    feedOperator: raw.ownOp?.trim() || classification.bizavOperator || null,

    lat,
    lon,
    altBaroFt,
    altGeomFt: toNumber(raw.alt_geom),
    groundSpeedKt: toNumber(raw.gs),
    trackDeg: toNumber(raw.track) ?? toNumber(raw.true_heading) ?? toNumber(raw.mag_heading),
    verticalRateFpm,
    squawk: raw.squawk?.trim() || null,
    onGround: onGround || (altBaroFt !== null && altBaroFt <= 0 && (toNumber(raw.gs) ?? 0) < 40),
    emergency: raw.emergency && raw.emergency !== "none" ? raw.emergency : null,

    ageSec,
    seenAt: ageSec !== null ? now - Math.round(ageSec * 1000) : now,

    isMilitary: classification.isMilitary,
    isSpecial: classification.isSpecial,
    isBlocked: classification.isBlocked,

    flightStatus: flightPhase(onGround, altBaroFt, verticalRateFpm),
    source,
    positionSource: positionSourceFor(raw.type),
    ...operationalFields({
      registration,
      icao24,
      callsign,
      typeCode,
      airframe: classification.category,
      feedOperator: raw.ownOp?.trim() || classification.bizavOperator || null,
      isMilitary: classification.isMilitary,
      isSpecial: classification.isSpecial,
      isBlocked: classification.isBlocked,
    }),
  };
}

/**
 * Run the classification engine over one contact.
 *
 * Done at normalisation time so that every path into the app — live map,
 * search, history ingest — sees the same verdict. Only feed-level evidence is
 * available here; ownership research enriches it later via
 * `reclassifyWithResearch`.
 */
function operationalFields(
  evidence: Parameters<typeof classifyOperation>[0],
): Pick<LiveAircraft, "operation" | "dataStatus" | "statusConfidence" | "statusReasons"> {
  const result = classifyOperation(evidence);
  return {
    operation: result.operation,
    dataStatus: result.dataStatus,
    statusConfidence: result.confidence,
    statusReasons: result.reasons,
  };
}

export function normalizeMany(
  raws: RawAircraft[] | null | undefined,
  source: string,
  now = Date.now(),
): LiveAircraft[] {
  if (!raws) return [];
  const out: LiveAircraft[] = [];
  for (const raw of raws) {
    const a = normalizeAircraft(raw, source, now);
    if (a) out.push(a);
  }
  return out;
}
