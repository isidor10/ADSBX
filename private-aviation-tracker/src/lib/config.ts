/**
 * Server-side configuration. Every value here is read from process.env at
 * module load. Nothing in this file may be imported from a client component —
 * it carries API keys.
 */

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export type AdsbProviderName =
  | "adsbexchange"
  | "adsbx_direct"
  | "readsb"
  | "demo";

export type SearchProviderName =
  | "google_cse"
  | "serpapi"
  | "bing"
  | "brave"
  | "none";

export const config = {
  adsb: {
    provider: str("ADSB_PROVIDER", "adsbexchange") as AdsbProviderName,
    rapidApiKey: str("ADSBX_RAPIDAPI_KEY"),
    rapidApiHost: str("ADSBX_RAPIDAPI_HOST", "adsbexchange-com1.p.rapidapi.com"),
    directApiKey: str("ADSBX_API_KEY"),
    directBaseUrl: str("ADSBX_BASE_URL", "https://adsbexchange.com/api/aircraft"),
    readsbBaseUrl: str("ADSB_BASE_URL", "https://opendata.adsb.fi/api/v2"),
    pollIntervalMs: num("ADSB_POLL_INTERVAL_MS", 5000),
    maxRadiusNm: num("ADSB_MAX_RADIUS_NM", 250),
    requestTimeoutMs: num("ADSB_TIMEOUT_MS", 12000),
  },
  search: {
    provider: str("SEARCH_PROVIDER", "none") as SearchProviderName,
    googleApiKey: str("GOOGLE_CSE_API_KEY"),
    googleCx: str("GOOGLE_CSE_CX"),
    serpApiKey: str("SERPAPI_KEY"),
    bingKey: str("BING_SEARCH_KEY"),
    bingEndpoint: str("BING_SEARCH_ENDPOINT", "https://api.bing.microsoft.com/v7.0/search"),
    braveKey: str("BRAVE_SEARCH_KEY"),
    resultsPerQuery: num("SEARCH_RESULTS_PER_QUERY", 8),
    maxQueries: num("SEARCH_MAX_QUERIES", 5),
    timeoutMs: num("SEARCH_TIMEOUT_MS", 10000),
  },
  llm: {
    enabled: bool("OWNERSHIP_LLM_ENABLED", false),
    apiKey: str("ANTHROPIC_API_KEY"),
    model: str("OWNERSHIP_LLM_MODEL", "claude-opus-5"),
    timeoutMs: num("OWNERSHIP_LLM_TIMEOUT_MS", 25000),
  },
  ownership: {
    cacheTtlHours: num("OWNERSHIP_CACHE_TTL_HOURS", 168),
    notFoundTtlHours: num("OWNERSHIP_NOTFOUND_TTL_HOURS", 24),
  },
  photos: {
    enabled: bool("PHOTOS_ENABLED", true),
    ttlHours: num("PHOTOS_CACHE_TTL_HOURS", 720),
  },
  history: {
    persistPositions: bool("PERSIST_POSITIONS", true),
    sampleIntervalSec: num("POSITION_SAMPLE_INTERVAL_SEC", 30),
    retentionDays: num("HISTORY_RETENTION_DAYS", 30),
    /** Gap after which an airborne aircraft's leg is considered finished. */
    legTimeoutMin: num("FLIGHT_LEG_TIMEOUT_MIN", 30),
  },
  redisUrl: str("REDIS_URL"),
  databaseUrl: str("DATABASE_URL"),
} as const;

export const isDemoMode = config.adsb.provider === "demo";

/** True when the configured ADS-B provider has the credentials it needs. */
export function adsbConfigured(): boolean {
  switch (config.adsb.provider) {
    case "adsbexchange":
      return Boolean(config.adsb.rapidApiKey);
    case "adsbx_direct":
      return Boolean(config.adsb.directApiKey);
    case "readsb":
      return Boolean(config.adsb.readsbBaseUrl);
    case "demo":
      return true;
    default:
      return false;
  }
}

export function searchConfigured(): boolean {
  switch (config.search.provider) {
    case "google_cse":
      return Boolean(config.search.googleApiKey && config.search.googleCx);
    case "serpapi":
      return Boolean(config.search.serpApiKey);
    case "bing":
      return Boolean(config.search.bingKey);
    case "brave":
      return Boolean(config.search.braveKey);
    default:
      return false;
  }
}

export function databaseConfigured(): boolean {
  return Boolean(config.databaseUrl);
}
