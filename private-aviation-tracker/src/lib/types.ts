/**
 * Types shared by the server and the browser. This module must stay free of
 * server-only imports so client components can use it.
 */

export type AircraftCategory =
  | "private_jet"
  | "business_jet"
  | "bizliner"
  | "turboprop"
  | "vip"
  | "charter"
  | "helicopter"
  | "military"
  | "airliner"
  | "light_ga"
  | "special"
  | "unknown";

/** Filter groups exposed in the UI. */
export type FilterKey =
  | "business"
  | "private_jet"
  | "bizliner"
  | "turboprop"
  | "vip"
  | "charter"
  | "military"
  | "helicopter"
  | "all";

export interface LiveAircraft {
  /** ICAO 24-bit address, lowercase hex. Always present. */
  icao24: string;
  registration: string | null;
  callsign: string | null;
  typeCode: string | null;
  manufacturer: string | null;
  model: string | null;
  category: AircraftCategory;
  /** Operator/owner hint straight from the feed (often absent). */
  feedOperator: string | null;

  lat: number;
  lon: number;
  altBaroFt: number | null;
  altGeomFt: number | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  verticalRateFpm: number | null;
  squawk: string | null;
  onGround: boolean;
  emergency: string | null;

  /** Seconds since this position was received by the feed. */
  ageSec: number | null;
  /** Epoch ms of the observation. */
  seenAt: number;

  isMilitary: boolean;
  isSpecial: boolean;
  /** Feed reports the aircraft as PIA / LADD / registration-blocked. */
  isBlocked: boolean;

  flightStatus: FlightPhase;
  source: string;
  /** Set only when the provider is `demo`. */
  simulated?: boolean;
}

export type FlightPhase =
  | "on_ground"
  | "climbing"
  | "cruising"
  | "descending"
  | "level"
  | "unknown";

export interface LiveFeedResult {
  aircraft: LiveAircraft[];
  /** Aircraft seen upstream before private/business filtering. */
  totalObserved: number;
  updatedAt: number;
  source: string;
  simulated: boolean;
  stale: boolean;
  error?: string;
  /**
   * Shown persistently in the UI when the data is real but not from the
   * source the operator selected — currently the open-feed fallback.
   */
  notice?: string;
}

export type ConfidenceBand = "high" | "medium" | "low" | "none";

export type OwnerKind =
  | "REGISTERED_OWNER"
  | "OPERATOR"
  | "MANAGEMENT_COMPANY"
  | "CHARTER_OPERATOR"
  | "TRUSTEE"
  | "BENEFICIAL_OWNER"
  | "UNKNOWN";

export type OwnershipStatus =
  | "PENDING"
  | "RESOLVED"
  | "NOT_FOUND"
  | "BLOCKED"
  | "ERROR";

export interface OwnershipSource {
  title: string;
  url: string;
  /** Short label shown as a chip, e.g. "FAA". */
  label: string;
  kind:
    | "official_registry"
    | "aviation_database"
    | "company_website"
    | "corporate_filing"
    | "news"
    | "search_result";
  snippet?: string;
  weight: number;
}

export interface OwnershipResult {
  registration: string;
  status: OwnershipStatus;
  owner: string | null;
  ownerKind: OwnerKind;
  operator: string | null;
  managementCompany: string | null;
  charterOperator: string | null;
  confidence: number;
  confidenceBand: ConfidenceBand;
  beneficialOwnerConfirmed: boolean;
  summary: string | null;
  evidence: string | null;
  sources: OwnershipSource[];
  queries: string[];
  searchProvider: string | null;
  analyzer: string | null;
  lastVerifiedAt: string | null;
  cached: boolean;
  errorMessage?: string | null;
  /** Human-readable reason when nothing could be established. */
  notFoundReason?: string | null;
}

export interface AircraftIdentity {
  registration: string;
  icao24: string | null;
  typeCode: string | null;
  manufacturer: string | null;
  model: string | null;
  category: AircraftCategory;
  serialNumber: string | null;
  yearBuilt: number | null;
  engineCount: number | null;
  registryCountry: string | null;
  identitySource: string | null;
  photo: AircraftPhoto | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface AircraftPhoto {
  url: string;
  thumbnailUrl: string | null;
  credit: string | null;
  link: string | null;
  source: string;
}

export interface AircraftDetail {
  identity: AircraftIdentity;
  live: LiveAircraft | null;
  ownership: OwnershipResult | null;
  lastKnownPosition: PositionSample | null;
}

export interface PositionSample {
  lat: number;
  lon: number;
  altBaroFt: number | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  verticalRateFpm: number | null;
  onGround: boolean;
  seenAt: string;
}

export interface FlightLegSummary {
  id: string;
  callsign: string | null;
  status: "ACTIVE" | "COMPLETED" | "STALE";
  departureIcao: string | null;
  departureName: string | null;
  departedAt: string | null;
  arrivalIcao: string | null;
  arrivalName: string | null;
  arrivedAt: string | null;
  maxAltitudeFt: number | null;
  maxGroundSpeedKt: number | null;
  distanceNm: number | null;
  durationSec: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface TimelineEvent {
  at: string;
  kind: "departure" | "arrival" | "cruise" | "climb" | "descent" | "observed";
  label: string;
  detail: string | null;
}

export interface AircraftHistory {
  registration: string;
  /** Newest first. */
  flights: FlightLegSummary[];
  recentPositions: PositionSample[];
  timeline: TimelineEvent[];
  /** Explains an empty history rather than pretending data exists. */
  note: string | null;
}

export interface SearchHit {
  registration: string | null;
  icao24: string | null;
  callsign: string | null;
  typeCode: string | null;
  manufacturer: string | null;
  model: string | null;
  owner: string | null;
  operator: string | null;
  airborne: boolean;
  lat: number | null;
  lon: number | null;
  altBaroFt: number | null;
  lastSeenAt: string | null;
  matchedOn: string;
  score: number;
}

export interface ApiError {
  error: string;
  message: string;
  detail?: string;
}
