import type { AircraftCategory, FilterKey, LiveAircraft } from "@/lib/types";
import {
  BIZAV_OPERATOR_CALLSIGNS,
  BIZLINER_CAPABLE,
  MILITARY_CALLSIGN_PREFIXES,
  lookupType,
} from "./typeDatabase";

export interface ClassificationInput {
  typeCode: string | null;
  callsign: string | null;
  registration: string | null;
  /** ADS-B emitter category, e.g. "A1".."A7", "B4". */
  emitterCategory: string | null;
  /** ADS-B Exchange dbFlags bitfield: 1 military, 2 interesting, 4 PIA, 8 LADD. */
  dbFlags: number | null;
  /** Operator string if the feed supplies one. */
  operator: string | null;
}

export interface Classification {
  category: AircraftCategory;
  manufacturer: string | null;
  model: string | null;
  isMilitary: boolean;
  isSpecial: boolean;
  isBlocked: boolean;
  /** Callsign matched a known business-aviation operator. */
  bizavOperator: string | null;
}

const AIRLINE_CALLSIGN_RE = /^[A-Z]{3}\d{1,4}[A-Z]?$/;

/** Callsign prefix (first 3 letters) if it looks like an ICAO operator code. */
function operatorCode(callsign: string | null): string | null {
  if (!callsign) return null;
  const cs = callsign.trim().toUpperCase();
  if (!AIRLINE_CALLSIGN_RE.test(cs)) return null;
  return cs.slice(0, 3);
}

function looksMilitary(callsign: string | null, dbFlags: number | null): boolean {
  if (dbFlags != null && (dbFlags & 1) === 1) return true;
  if (!callsign) return false;
  const cs = callsign.trim().toUpperCase();
  return MILITARY_CALLSIGN_PREFIXES.some((p) => cs.startsWith(p));
}

export function classify(input: ClassificationInput): Classification {
  const typeInfo = lookupType(input.typeCode);
  const code = input.typeCode?.trim().toUpperCase() ?? null;
  const callsign = input.callsign?.trim().toUpperCase() ?? null;
  const opCode = operatorCode(callsign);
  const bizavOperator = opCode ? BIZAV_OPERATOR_CALLSIGNS[opCode] ?? null : null;

  const dbFlags = input.dbFlags ?? 0;
  const isMilitary = looksMilitary(callsign, input.dbFlags);
  const isSpecial = (dbFlags & 2) === 2;
  // PIA (Privacy ICAO Address) or LADD (Limiting Aircraft Data Displayed)
  const isBlocked = (dbFlags & 4) === 4 || (dbFlags & 8) === 8;

  let category: AircraftCategory = typeInfo?.category ?? "unknown";
  let manufacturer = typeInfo?.manufacturer ?? null;
  let model = typeInfo?.model ?? null;

  // Rotorcraft per the ADS-B emitter category, even for unknown type codes.
  if (input.emitterCategory === "A7" || input.emitterCategory === "B6") {
    category = "helicopter";
  }

  if (isMilitary) {
    category = "military";
  } else if (category === "airliner" && code && BIZLINER_CAPABLE.has(code)) {
    // Airliner airframes are only promoted to VIP/bizliner with corroboration:
    // a business-aviation operator callsign, a "special interest" flag, or a
    // callsign that is simply the registration (typical of private ops).
    const csIsRegistration =
      !!callsign && !!input.registration &&
      callsign.replace(/-/g, "") === input.registration.toUpperCase().replace(/-/g, "");
    if (bizavOperator || isSpecial || csIsRegistration) {
      category = "bizliner";
    }
  } else if (category === "unknown" && bizavOperator) {
    // Known charter/fractional operator but an unrecognised type code — still
    // business aviation, just with an unidentified airframe.
    category = "charter";
  }

  // A business-aviation operator callsign on a business jet marks it as charter
  // or fractional rather than owner-flown; kept as a separate signal so the UI
  // can filter on it without losing the airframe category.
  return { category, manufacturer, model, isMilitary, isSpecial, isBlocked, bizavOperator };
}

/** The categories included by the default "Private / Business Aviation" view. */
export const BUSINESS_CATEGORIES: AircraftCategory[] = [
  "private_jet",
  "business_jet",
  "bizliner",
  "turboprop",
  "vip",
  "charter",
];

export function isBusinessAviation(a: Pick<LiveAircraft, "category">): boolean {
  return BUSINESS_CATEGORIES.includes(a.category);
}

/**
 * Does an aircraft pass the active filter set?
 * Filters are additive: `["business", "helicopter"]` shows business aviation
 * plus helicopters.
 */
export function matchesFilters(a: LiveAircraft, filters: FilterKey[]): boolean {
  if (filters.length === 0 || filters.includes("all")) return true;

  for (const f of filters) {
    switch (f) {
      case "business":
        if (isBusinessAviation(a)) return true;
        break;
      case "private_jet":
        if (a.category === "business_jet" || a.category === "private_jet") return true;
        break;
      case "bizliner":
        if (a.category === "bizliner") return true;
        break;
      case "turboprop":
        if (a.category === "turboprop") return true;
        break;
      case "vip":
        if (a.category === "vip" || a.category === "bizliner" || a.isSpecial) return true;
        break;
      case "charter":
        if (a.category === "charter") return true;
        break;
      case "military":
        if (a.category === "military" || a.isMilitary) return true;
        break;
      case "helicopter":
        if (a.category === "helicopter") return true;
        break;
    }
  }
  return false;
}

