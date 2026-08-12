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

  // The operation class is decisive and overrides everything below it. A
  // Turkish Airlines 737 does not reach a private-aviation map because its
  // airframe happened to match a filter, and the only way to see one is to ask
  // for airlines explicitly. This is the rule that keeps the map private-only.
  const operation = a.operation;
  if (operation === "AIRLINE") return filters.includes("airline");
  if (operation === "CARGO") return filters.includes("cargo") || filters.includes("airline");
  if (operation === "MILITARY") return filters.includes("military");
  if (operation === "GENERAL_AVIATION") return filters.includes("general_aviation");
  if (operation === "HELICOPTER") return filters.includes("helicopter");

  for (const f of filters) {
    switch (f) {
      case "business":
        // Anything the engine puts in a private-aviation class belongs on the
        // default map, even when the airframe is unrecognised — that is how a
        // researched aircraft with an odd type code stays visible.
        if (
          operation === "PRIVATE" ||
          operation === "CORPORATE" ||
          operation === "BUSINESS_AVIATION" ||
          operation === "CHARTER"
        ) {
          return true;
        }
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
      case "airline":
        if (a.category === "airliner" || a.operation === "AIRLINE") return true;
        break;
      case "cargo":
        if (a.operation === "CARGO") return true;
        break;
      case "general_aviation":
        if (a.category === "light_ga" || a.operation === "GENERAL_AVIATION") return true;
        break;
    }
  }
  return false;
}

