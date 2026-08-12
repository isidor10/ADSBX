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
/**
 * What the aircraft is being used for. Decides whether it belongs on a
 * private-aviation map at all — see `lib/aircraft/operationalClass.ts`.
 */
export type OperationClass =
  | "PRIVATE"
  | "CORPORATE"
  | "BUSINESS_AVIATION"
  | "CHARTER"
  | "AIRLINE"
  | "CARGO"
  | "MILITARY"
  | "HELICOPTER"
  | "GENERAL_AVIATION"
  | "UNKNOWN";

/**
 * How much is established about the aircraft's identity and ownership. This is
 * what the map colours by: the colour reports the state of the research, not
 * the aircraft model.
 */
export type DataStatus =
  | "VERIFIED_PRIVATE"
  | "CORPORATE"
  | "CHARTER_AOC"
  | "OPERATOR_KNOWN"
  | "PARTIAL"
  | "CONFLICT"
  | "UNKNOWN";

/** One piece of evidence behind a classification. */
export interface StatusReason {
  label: string;
  detail: string;
  /** Contribution to the confidence score, 0 when merely explanatory. */
  weight: number;
  source: "FEED" | "CALLSIGN" | "AIRFRAME" | "REGISTRY" | "RESEARCH" | "OPERATOR" | "COMPANY" | "AOC";
}

export type FilterKey =
  | "business"
  | "private_jet"
  | "bizliner"
  | "turboprop"
  | "vip"
  | "charter"
  | "military"
  | "helicopter"
  | "airline"
  | "cargo"
  | "general_aviation"
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
  /**
   * How the position was obtained — broadcast by the aircraft (ADS-B),
   * computed from receiver timing (MLAT), relayed from radar (TIS-B), and so
   * on. Governs how much the position can be trusted.
   */
  positionSource?: PositionSource;

  /** What the aircraft is being used for. Drives default map visibility. */
  operation?: OperationClass;
  /** How much is established about it. Drives the marker colour. */
  dataStatus?: DataStatus;
  /** 0-100 confidence in the classification above. */
  statusConfidence?: number;
  /** The evidence behind it, shown in the panel. */
  statusReasons?: StatusReason[];
  /** Set only when the provider is `demo`. */
  simulated?: boolean;
  /**
   * True when the source carries no registration or type designator (OpenSky
   * state vectors). Such a contact cannot be classified by airframe, so the
   * private/business filter is running blind for it and the UI says so.
   */
  identityDegraded?: boolean;
}

/** Live health of one aircraft data provider. */
export interface ProviderHealth {
  name: string;
  /** 1 = primary. */
  priority: number;
  status: "LIVE" | "STANDBY" | "RATE_LIMITED" | "BACKING_OFF" | "DISABLED";
  configured: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  /** Aircraft returned by the last successful call. */
  lastCount: number | null;
  attempts: number;
  failures: number;
  /** Seconds until this provider is tried again, when backing off. */
  retryInSec: number | null;
}

/**
 * Reception method for a position, as stated by the feed. See
 * `lib/adsb/positionSource.ts` for what each one implies about accuracy.
 */
export type PositionSource =
  | "ADSB"
  | "ADSR"
  | "TISB"
  | "MLAT"
  | "ADSC"
  | "MODE_S"
  | "OTHER"
  | "UNKNOWN";

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
  /** Upstream requests used to cover the viewport (>1 when zoomed out). */
  tilesRequested?: number;
  /** How far from the centre was actually fetched. */
  coveredRadiusNm?: number;
  /** How far the user can see. Larger than covered = partial coverage. */
  viewportRadiusNm?: number;
  /** Which provider actually served this payload. */
  servedBy?: string | null;
  /** Health of every provider in the chain. */
  providers?: ProviderHealth[];
  /** True when the payload is cached because every provider failed. */
  degraded?: boolean;
  /** Contacts with no type/registration (OpenSky), so unclassifiable. */
  degradedIdentityCount?: number;
  /**
   * Positions being shown from retention because no provider answered for this
   * viewport. Real observations, but older than a live poll — the UI says so.
   */
  lastKnownCount?: number;
  /**
   * How the contacts in this viewport were received, split by method. `shown`
   * counts what is drawn after filtering; `received` counts everything the
   * feeds returned for the view.
   */
  positionSources?: {
    shown: Record<PositionSource, number>;
    received: Record<PositionSource, number>;
  };
}

// ------------------------------------------------------------ routes / flight

/**
 * Where a departure or destination came from. Every airport shown in the UI
 * carries one of these, because "we saw it land there" and "it is pointed that
 * way" are completely different claims.
 */
export type RouteSourceKind =
  /** A route data source resolved the callsign to a filed route. */
  | "FLIGHT_DATA"
  /** Observed: the aircraft was actually on the ground there. */
  | "OBSERVED"
  /** Inferred from the current trajectory. Always labelled as an estimate. */
  | "TRAJECTORY_ESTIMATE";

export interface AirportRef {
  icao: string | null;
  iata: string | null;
  name: string;
  city: string | null;
  country: string | null;
  lat: number;
  lon: number;
}

/** The flight an aircraft is on right now. */
export interface CurrentFlight {
  registration: string;
  callsign: string | null;
  airborne: boolean;

  departure: AirportRef | null;
  departureSource: RouteSourceKind | null;
  departedAt: string | null;

  destination: AirportRef | null;
  destinationSource: RouteSourceKind | null;
  /** 0-100. Null when there is no destination at all. */
  destinationConfidence: number | null;

  etaAt: string | null;
  distanceRemainingNm: number | null;
  distanceFlownNm: number | null;
  /** 0-100 along the great circle, when both ends are known. */
  progressPct: number | null;

  /** Plain-English reason when the destination is unknown. Never a guess. */
  note: string | null;
}

/** Geometry the map needs to draw the selected aircraft's route. */
export interface SelectedRoute {
  registration: string;
  /** [lon, lat] pairs of the path actually flown, oldest first. */
  flown: Array<[number, number]>;
  departure: AirportRef | null;
  destination: AirportRef | null;
  /** True when the destination is a trajectory estimate rather than filed. */
  destinationEstimated: boolean;
}

/** A completed flight, used by LAST LANDING. */
export interface LandingSummary {
  registration: string;
  callsign: string | null;
  departure: AirportRef | null;
  arrival: AirportRef | null;
  departedAt: string | null;
  arrivedAt: string | null;
  durationSec: number | null;
  distanceNm: number | null;
}

/**
 * A future flight. Only ever produced from repeated observed behaviour, and
 * always carries `estimated: true` plus the evidence count behind it.
 */
export interface NextTrip {
  known: boolean;
  estimated: boolean;
  departure: AirportRef | null;
  destination: AirportRef | null;
  /** e.g. "Weekday mornings" — never a specific invented timestamp. */
  window: string | null;
  confidence: ConfidenceBand;
  /** How many past flights support this. */
  basis: number;
  note: string;
}

export type ConfidenceBand = "high" | "medium" | "low" | "none";

/** Where an aircraft most likely lives. Always an inference, never a fact. */
export interface LikelyBase {
  known: boolean;
  airport: AirportRef | null;
  /** 0-100. */
  confidence: number;
  band: ConfidenceBand;
  /** Movements observed at that airport. */
  movements: number;
  note: string;
}

export interface UtilisationPeriod {
  days: number;
  flights: number;
  hours: number;
  distanceNm: number;
  activeDays: number;
}

export interface UtilisationStats {
  registration: string;
  periods: UtilisationPeriod[];
  averageLegNm: number | null;
  averageLegHours: number | null;
  /** 0-100, or null when nothing has been observed. */
  activityScore: number | null;
  /** Published so the score is explainable rather than a black box. */
  scoreMethod: string;
  note: string;
}

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

// ---------------------------------------------------------------- research

export type ResearchKind =
  | "NEWS"
  | "FORUM"
  | "COMPANY_WEBSITE"
  | "OFFICIAL_REGISTRY"
  | "AVIATION_DATABASE"
  | "OTHER";

/**
 * How far a source can be trusted. Shown as a chip on every result so a forum
 * post is never read as an established fact.
 */
export type Verification = "CONFIRMED" | "REPORTED" | "UNVERIFIED";

export interface ResearchItem {
  title: string;
  url: string;
  host: string;
  /** Short display name for the host, e.g. "FAA Registry". */
  label: string;
  snippet: string | null;
  kind: ResearchKind;
  verification: Verification;
  publishedAt: string | null;
  query: string | null;
}

export interface ResearchReport {
  subject: string;
  items: ResearchItem[];
  provider: string | null;
  cached: boolean;
  /** Explains an empty report rather than showing nothing. */
  note: string | null;
}

export interface AircraftPhoto {
  url: string;
  thumbnailUrl: string | null;
  credit: string | null;
  link: string | null;
  source: string;
  /**
   * True only when the source keyed the image on this exact registration.
   * False means the image is of the same *type* and must be labelled as a
   * type reference — showing another airframe as though it were this one is
   * exactly the kind of fabrication this product must not commit.
   */
  verified?: boolean;
  takenAt?: string | null;
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
  /** The window this response covers, or null for "everything on record". */
  windowMinutes: number | null;
  /** Windows that actually contain data — the UI disables the others. */
  availableWindows: number[];
  /** Explains an empty history rather than pretending data exists. */
  note: string | null;
}

// ----------------------------------------------------------------- companies

/**
 * How a company relates to an aircraft. Never collapsed into one "company"
 * field: an operator is not an owner, and the UI must be able to say which.
 */
export type FleetRole =
  | "REGISTERED_OWNER"
  | "BENEFICIAL_OWNER"
  | "OPERATOR"
  | "MANAGEMENT_COMPANY"
  | "CHARTER_OPERATOR"
  | "ASSOCIATED";

export const FLEET_ROLE_LABELS: Record<FleetRole, string> = {
  REGISTERED_OWNER: "Registered owner",
  BENEFICIAL_OWNER: "Beneficial owner",
  OPERATOR: "Operator",
  MANAGEMENT_COMPANY: "Management",
  CHARTER_OPERATOR: "Charter",
  ASSOCIATED: "Associated",
};

export interface CompanySummary {
  slug: string;
  name: string;
  aircraftCount: number;
  website: string | null;
  country: string | null;
  exact: boolean;
}

export interface CompanyFleetEntry {
  registration: string;
  role: FleetRole;
  typeCode: string | null;
  manufacturer: string | null;
  model: string | null;
  /** "flying" is only claimed when the aircraft is being received now. */
  status: "flying" | "on_ground" | "unknown";
  location: string | null;
  destination: AirportRef | null;
  destinationEstimated: boolean;
  lastSeenAt: string | null;
  lastLanding: LandingSummary | null;
  confidence: number;
  sourceUrl: string | null;
}

export interface CompanyProfile {
  slug: string;
  name: string;
  website: string | null;
  country: string | null;
  summary: string | null;
  fleet: CompanyFleetEntry[];
  stats: { aircraft: number; flying: number; onGround: number; unknown: number };
  note: string | null;
}

export interface CompanyActivityFilters {
  registration?: string;
  airport?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export interface CompanyFlightActivity {
  slug: string;
  filters: CompanyActivityFilters;
  flights: Array<{
    id: string;
    registration: string;
    callsign: string | null;
    status: "ACTIVE" | "COMPLETED" | "STALE";
    departureIcao: string | null;
    departureName: string | null;
    departedAt: string | null;
    arrivalIcao: string | null;
    arrivalName: string | null;
    arrivedAt: string | null;
    distanceNm: number | null;
    durationSec: number | null;
  }>;
  note: string | null;
}

export interface AirportActivity {
  icao: string;
  name: string | null;
  departures: number;
  arrivals: number;
  movements: number;
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

// -------------------------------------------------------------------- cost

export type CostBasis = "PUBLISHED_PERFORMANCE" | "CLASS_ESTIMATE" | "CONFIGURED_RATE";

export interface CostLine {
  key: "fuel" | "crew" | "maintenance" | "airport" | "navigation" | "handling";
  label: string;
  low: number;
  likely: number;
  high: number;
  basis: CostBasis;
  note: string;
}

export interface LegCost {
  kind: "PASSENGER" | "POSITIONING" | "RETURN";
  from: AirportRef | null;
  to: AirportRef | null;
  greatCircleNm: number;
  routedNm: number;
  blockHours: number;
  fuelLitres: number;
  fuelKg: number;
}

export interface CostEstimate {
  registration: string | null;
  aircraftType: string;
  typeCode: string | null;
  exactPerformance: boolean;
  performanceConfidence: "high" | "medium" | "low";
  legs: LegCost[];
  totalRoutedNm: number;
  totalBlockHours: number;
  totalFuelLitres: number;
  lines: CostLine[];
  total: { low: number; likely: number; high: number };
  /** Separate from operating cost: includes margin, commission, positioning. */
  charter: { low: number; likely: number; high: number; note: string } | null;
  currency: string;
  fuelPricePerLitre: number;
  routingFactor: number;
  rangeWarning: string | null;
  assumptions: string[];
  disclaimer: string;
}

// ------------------------------------------------------- costed history

export interface CostedFlight {
  id: string;
  registration: string;
  callsign: string | null;
  status: "ACTIVE" | "COMPLETED" | "STALE";
  departure: AirportRef | null;
  arrival: AirportRef | null;
  departedAt: string;
  arrivedAt: string | null;
  durationSec: number | null;
  distanceNm: number | null;
  fuelLitres: number | null;
  cost: { low: number; likely: number; high: number } | null;
  /** Extra cost attributable to positioning, when a base is known. */
  positioningCost: number | null;
  /** Why there is no cost, when there is none. */
  costNote: string | null;
}

export interface FleetCostSummary {
  flights: number;
  /** Flights the cost could actually be computed for. */
  flightsCosted: number;
  hours: number;
  distanceNm: number;
  fuelLitres: number;
  cost: { low: number; likely: number; high: number };
  positioningCost: number;
}

export interface CostedHistory {
  registration: string;
  from: string;
  to: string;
  flights: CostedFlight[];
  totals: FleetCostSummary;
  /** How much of the requested period this deployment could observe. */
  coveragePercent: number;
  firstObservedAt: string | null;
  note: string | null;
}

// ------------------------------------------------------- national registries

export interface RegistryRecordView {
  authority: string;
  registration: string;
  aircraftType: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  yearBuilt: number | null;
  /** The holder as printed in the register. Not necessarily the operator. */
  registeredHolder: string | null;
  operator: string | null;
  status: string | null;
  sourceName: string;
  sourceUrl: string | null;
  verifiedAt: string;
  confidence: number;
}

/**
 * HOLDER  — the operator appears in the authority's approved-operator list.
 * NOT_FOUND — no record. Deliberately not "NO": absence of a record is not
 * evidence that no certificate exists.
 */
export type AocStatus = "HOLDER" | "NOT_FOUND";

export interface AocInfo {
  status: AocStatus;
  name: string | null;
  aocNumber: string | null;
  operationType: string | null;
  operatingLicence: string | null;
  principalPlace: string | null;
  sourceName: string;
  sourceUrl: string | null;
  verifiedAt: string | null;
  note: string | null;
}

/** A disagreement between the official register and another source. */
export interface RegistryConflict {
  field: "operator" | "holder";
  official: string;
  officialSource: string;
  alternative: string;
  alternativeSource: string;
}

export interface SerbianRegistryResult {
  /** False for non-YU registrations; the section is then hidden. */
  applicable: boolean;
  registration: string;
  record: RegistryRecordView | null;
  aoc: AocInfo | null;
  conflicts: RegistryConflict[];
  note: string | null;
}

export interface OwnerHit {
  name: string;
  role: "owner" | "operator" | "management";
  registrations: string[];
  confidence: number;
}

export interface AirportHit {
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string | null;
  lat: number;
  lon: number;
}

export interface GlobalSearchResults {
  query: string;
  aircraft: SearchHit[];
  companies: CompanySummary[];
  owners: OwnerHit[];
  operators: OwnerHit[];
  airports: AirportHit[];
}

export interface ApiError {
  error: string;
  message: string;
  detail?: string;
}
