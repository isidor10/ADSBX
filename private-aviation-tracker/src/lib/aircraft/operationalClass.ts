import { lookupAirlineCallsign, lookupAirlineName } from "./airlineDatabase";
import { BIZAV_OPERATOR_CALLSIGNS } from "./typeDatabase";
import type {
  AircraftCategory,
  DataStatus,
  OperationClass,
  StatusReason,
} from "@/lib/types";

/**
 * The central aircraft classification engine.
 *
 * Two questions are answered here, and they are deliberately kept apart
 * because conflating them is how a map ends up lying:
 *
 *   1. **What is this aircraft doing?** — `operation`. Airline, corporate,
 *      charter, private, military. This decides whether it belongs on a
 *      private-aviation map at all.
 *   2. **How much do we actually know about it?** — `dataStatus`. This decides
 *      the colour. A green marker does not mean "nice aircraft", it means
 *      "we have verified who owns and operates this".
 *
 * Colouring by data status rather than by aircraft model is the whole point:
 * the map becomes a picture of what has been researched and what has not, so
 * an unresearched contact cannot be mistaken for a confirmed one.
 *
 * Every classification carries its reasons. Nothing here is allowed to assert
 * something it cannot show its working for.
 */

export interface ClassificationEvidence {
  registration: string | null;
  icao24: string | null;
  callsign: string | null;
  typeCode: string | null;
  /** Airframe category from the type database. */
  airframe: AircraftCategory;
  /** Operator string straight from the ADS-B feed, if any. */
  feedOperator: string | null;
  /** Operator resolved from research/registry, if any. */
  operator?: string | null;
  /** Registered owner from a registry or research. */
  owner?: string | null;
  /** Company the aircraft is associated with (corporate flight department). */
  company?: string | null;
  /** AOC number, present only for certified commercial operators. */
  aocNumber?: string | null;
  /** True when the owner/operator came from an official registry (FAA, DCV). */
  fromOfficialRegistry?: boolean;
  isMilitary: boolean;
  isSpecial: boolean;
  isBlocked: boolean;
  /** Feed carries no registration or type (OpenSky state vectors). */
  identityDegraded?: boolean;
}

export interface ClassificationResult {
  operation: OperationClass;
  dataStatus: DataStatus;
  /** 0-100. How much the classification itself can be relied on. */
  confidence: number;
  reasons: StatusReason[];
  /** Shown on the default private-aviation map. */
  visibleByDefault: boolean;
}

/** Operator names that are management companies rather than the end user. */
const MANAGEMENT_HINTS = /\b(aviation|jet|air charter|aircraft management|flight (services|department)|executive)\b/i;

/** Corporate-owner name shapes: a company that is not an aviation business. */
const CORPORATE_ENTITY = /\b(inc|corp|corporation|company|co|llc|llp|ltd|limited|plc|gmbh|ag|s\.?a\.?|b\.?v\.?|n\.?v\.?|holdings?|group|d\.?o\.?o\.?|a\.?d\.?|oy|ab|as|aps)\b/i;

function normalise(value: string | null | undefined): string | null {
  const clean = value?.trim();
  return clean ? clean : null;
}

/** Is the callsign simply the registration? Typical of owner-flown private ops. */
function callsignIsRegistration(callsign: string | null, registration: string | null): boolean {
  if (!callsign || !registration) return false;
  return (
    callsign.replace(/-/g, "").toUpperCase() === registration.replace(/-/g, "").toUpperCase()
  );
}

const BUSINESS_AIRFRAMES: AircraftCategory[] = [
  "private_jet",
  "business_jet",
  "bizliner",
  "turboprop",
  "vip",
  "charter",
];

/**
 * Classify one aircraft.
 *
 * Order matters. Military and airline are decided first because they are
 * disqualifying: no amount of corporate-looking ownership makes a Turkish
 * Airlines 737 a business jet.
 */
export function classifyOperation(evidence: ClassificationEvidence): ClassificationResult {
  const reasons: StatusReason[] = [];
  const callsign = normalise(evidence.callsign)?.toUpperCase() ?? null;
  const feedOperator = normalise(evidence.feedOperator);
  const operator = normalise(evidence.operator) ?? feedOperator;
  const owner = normalise(evidence.owner);
  const company = normalise(evidence.company);
  const aoc = normalise(evidence.aocNumber);

  const add = (label: string, detail: string, weight: number, source: StatusReason["source"]) => {
    reasons.push({ label, detail, weight, source });
  };

  // ---- 1. Military -------------------------------------------------------
  if (evidence.isMilitary || evidence.airframe === "military") {
    add("Military", "Flagged military by the feed or by callsign prefix.", 0, "FEED");
    return {
      operation: "MILITARY",
      dataStatus: "UNKNOWN",
      confidence: 70,
      reasons,
      visibleByDefault: false,
    };
  }

  // ---- 2. Scheduled airline or cargo ------------------------------------
  // Checked before anything else because it is disqualifying, and checked on
  // the callsign *and* the operator name so that an airline missing from the
  // code table is still caught by its name.
  const airlineByCallsign = lookupAirlineCallsign(callsign);
  const airlineByName = lookupAirlineName(operator) ?? lookupAirlineName(owner);
  const airline = airlineByCallsign ?? airlineByName;
  if (airline) {
    add(
      airline.kind === "cargo" ? "Cargo operator" : "Scheduled airline",
      airlineByCallsign
        ? `Flying under the ${callsign} callsign, which belongs to ${airline.name}.`
        : `Operator "${operator ?? owner}" is a scheduled carrier.`,
      0,
      airlineByCallsign ? "CALLSIGN" : "OPERATOR",
    );
    return {
      operation: airline.kind === "cargo" ? "CARGO" : "AIRLINE",
      dataStatus: "UNKNOWN",
      confidence: airlineByCallsign ? 92 : 70,
      reasons,
      visibleByDefault: false,
    };
  }

  // An airliner airframe with no business-aviation signal at all is airline
  // work by default. This is the backstop for carriers in neither table.
  const bizavCallsign = callsign
    ? BIZAV_OPERATOR_CALLSIGNS[callsign.slice(0, 3)] ?? null
    : null;
  const csIsReg = callsignIsRegistration(callsign, evidence.registration);
  if (evidence.airframe === "airliner" && !bizavCallsign && !csIsReg && !evidence.isSpecial) {
    add(
      "Airline airframe",
      "An airliner type with no business-aviation operator, private callsign or VIP flag.",
      0,
      "AIRFRAME",
    );
    return {
      operation: "AIRLINE",
      dataStatus: "UNKNOWN",
      confidence: 55,
      reasons,
      visibleByDefault: false,
    };
  }

  // ---- 3. Helicopters and light GA --------------------------------------
  if (evidence.airframe === "helicopter") {
    add("Rotorcraft", "Classified as a helicopter by type code or emitter category.", 0, "AIRFRAME");
    return {
      operation: "HELICOPTER",
      dataStatus: owner || operator ? "OPERATOR_KNOWN" : "UNKNOWN",
      confidence: 60,
      reasons,
      visibleByDefault: false,
    };
  }
  if (evidence.airframe === "light_ga") {
    add("Light general aviation", "Light piston or trainer airframe.", 0, "AIRFRAME");
    return {
      operation: "GENERAL_AVIATION",
      dataStatus: owner || operator ? "OPERATOR_KNOWN" : "UNKNOWN",
      confidence: 60,
      reasons,
      visibleByDefault: false,
    };
  }

  // ---- 4. Business aviation: decide which kind --------------------------
  const isBusinessAirframe = BUSINESS_AIRFRAMES.includes(evidence.airframe);
  if (isBusinessAirframe) {
    add(
      "Business airframe",
      `Type ${evidence.typeCode ?? "unknown"} is a business or private aircraft.`,
      15,
      "AIRFRAME",
    );
  }

  if (evidence.isSpecial) {
    add("VIP flag", "The feed marks this aircraft as of special interest.", 5, "FEED");
  }
  if (evidence.isBlocked) {
    add(
      "Privacy programme",
      "Registration is hidden by PIA or LADD, so identity cannot be resolved from the feed.",
      0,
      "FEED",
    );
  }

  // Evidence about who is behind the aircraft.
  if (evidence.fromOfficialRegistry && owner) {
    add("Official registry", `Registered owner "${owner}" from an official register.`, 35, "REGISTRY");
  } else if (owner) {
    add("Owner researched", `Registered owner "${owner}" from research sources.`, 20, "RESEARCH");
  }

  if (aoc) {
    add("Air Operator Certificate", `Operator holds AOC ${aoc}.`, 25, "AOC");
  }

  if (operator) {
    add(
      "Operator known",
      bizavCallsign
        ? `Callsign ${callsign} belongs to ${bizavCallsign}.`
        : `Operator "${operator}".`,
      bizavCallsign ? 25 : 15,
      bizavCallsign ? "CALLSIGN" : "OPERATOR",
    );
  } else if (bizavCallsign) {
    add("Business-aviation callsign", `Callsign ${callsign} belongs to ${bizavCallsign}.`, 25, "CALLSIGN");
  }

  if (company) {
    add("Company association", `Associated with ${company}.`, 25, "COMPANY");
  }

  if (csIsReg) {
    add(
      "Private callsign",
      "Flying under its own registration rather than an operator callsign — typical of owner-flown private operations.",
      10,
      "CALLSIGN",
    );
  }

  if (evidence.identityDegraded) {
    add(
      "Identity not carried",
      "This source provides no registration or aircraft type, so the aircraft cannot be identified from it.",
      0,
      "FEED",
    );
  }

  // ---- 5. Operation class ------------------------------------------------
  // A company that is not itself an aviation business points to a corporate
  // flight department; an AOC or a fractional callsign points to charter.
  const ownerLooksCorporate =
    !!owner && CORPORATE_ENTITY.test(owner) && !MANAGEMENT_HINTS.test(owner);
  const companyIsCorporate = !!company && !MANAGEMENT_HINTS.test(company);

  let operation: OperationClass;
  if (aoc || (bizavCallsign && !company)) {
    operation = "CHARTER";
  } else if (companyIsCorporate || ownerLooksCorporate) {
    operation = "CORPORATE";
  } else if (owner && !CORPORATE_ENTITY.test(owner)) {
    // A named individual on the register.
    operation = "PRIVATE";
  } else if (isBusinessAirframe) {
    operation = "BUSINESS_AVIATION";
  } else {
    operation = "UNKNOWN";
  }

  // ---- 6. Data status: how much is actually established ------------------
  const confidence = Math.max(
    0,
    Math.min(100, reasons.reduce((sum, r) => sum + r.weight, 0)),
  );

  // A conflict is worth flagging loudly: it means two sources disagree about
  // who is behind the aircraft, which is exactly what a research tool exists
  // to surface rather than paper over.
  const conflict = detectConflict({ owner, operator, company, feedOperator });
  if (conflict) add("Data conflict", conflict, 0, "RESEARCH");

  let dataStatus: DataStatus;
  if (conflict) {
    dataStatus = "CONFLICT";
  } else if (evidence.identityDegraded || (!owner && !operator && !company && !bizavCallsign)) {
    dataStatus = "UNKNOWN";
  } else if (aoc && operator) {
    dataStatus = "CHARTER_AOC";
  } else if ((company || ownerLooksCorporate) && (operator || evidence.fromOfficialRegistry)) {
    dataStatus = "CORPORATE";
  } else if (owner && operator && confidence >= 45) {
    dataStatus = "VERIFIED_PRIVATE";
  } else if (operator || bizavCallsign) {
    dataStatus = "OPERATOR_KNOWN";
  } else {
    dataStatus = "PARTIAL";
  }

  return {
    operation,
    dataStatus,
    confidence,
    reasons,
    visibleByDefault:
      operation === "PRIVATE" ||
      operation === "CORPORATE" ||
      operation === "BUSINESS_AVIATION" ||
      operation === "CHARTER",
  };
}

/**
 * Two sources describing the aircraft's operator incompatibly. Only reported
 * when the names are genuinely different entities rather than spellings of the
 * same one — a false conflict is worse than none.
 */
function detectConflict(input: {
  owner: string | null;
  operator: string | null;
  company: string | null;
  feedOperator: string | null;
}): string | null {
  const { operator, feedOperator } = input;
  if (!operator || !feedOperator) return null;

  const a = simplify(operator);
  const b = simplify(feedOperator);
  if (!a || !b || a === b) return null;
  if (a.includes(b) || b.includes(a)) return null;
  // Share a significant word — "Prince Aviation" vs "Prince Aviation DOO".
  const wordsA = new Set(a.split(" ").filter((w) => w.length > 3));
  if ([...b.split(" ")].some((w) => w.length > 3 && wordsA.has(w))) return null;

  return `The live feed reports the operator as "${feedOperator}" while research resolved "${operator}". Both are shown; neither is treated as confirmed.`;
}

function simplify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\b(inc|corp|corporation|company|co|llc|llp|ltd|limited|plc|gmbh|ag|sa|bv|nv|doo|ad|oy|ab|aps)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

/**
 * The status palette. Muted, aviation-instrument colours rather than saturated
 * primaries — a map of two hundred markers in pure #00ff00 is unreadable, and
 * these have to sit on a dark chart without vibrating.
 */
export const STATUS_STYLE: Record<
  DataStatus,
  { label: string; color: string; description: string }
> = {
  VERIFIED_PRIVATE: {
    label: "Verified private/business",
    color: "#34d399",
    description: "Owner and operator both established from sources.",
  },
  CORPORATE: {
    label: "Corporate",
    color: "#38bdf8",
    description: "Associated with a company flight department.",
  },
  CHARTER_AOC: {
    label: "Charter / AOC",
    color: "#a78bfa",
    description: "Commercial operator holding an Air Operator Certificate.",
  },
  OPERATOR_KNOWN: {
    label: "Operator known",
    color: "#fb923c",
    description: "An operator is identified but ownership is unresolved.",
  },
  PARTIAL: {
    label: "Partial information",
    color: "#facc15",
    description: "Some identity established, key fields still missing.",
  },
  CONFLICT: {
    label: "Data conflict",
    color: "#f43f5e",
    description: "Sources disagree about who operates this aircraft.",
  },
  UNKNOWN: {
    label: "Unknown",
    color: "#94a3b8",
    description: "Little more than a position and a transponder address.",
  },
};

export const STATUS_ORDER: DataStatus[] = [
  "VERIFIED_PRIVATE",
  "CORPORATE",
  "CHARTER_AOC",
  "OPERATOR_KNOWN",
  "PARTIAL",
  "CONFLICT",
  "UNKNOWN",
];

export const OPERATION_LABEL: Record<OperationClass, string> = {
  PRIVATE: "Private",
  CORPORATE: "Corporate",
  BUSINESS_AVIATION: "Business aviation",
  CHARTER: "Charter",
  AIRLINE: "Airline",
  CARGO: "Cargo",
  MILITARY: "Military",
  HELICOPTER: "Helicopter",
  GENERAL_AVIATION: "General aviation",
  UNKNOWN: "Unclassified",
};

/** Shown on the map without the user opting in. */
export const DEFAULT_OPERATIONS: OperationClass[] = [
  "PRIVATE",
  "CORPORATE",
  "BUSINESS_AVIATION",
  "CHARTER",
];
