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
    // Documented direct/enterprise endpoint:
    //   GET https://gateway.adsbexchange.com/api/aircraft/v2/icao/{icao}
    //   header: api-auth: <key>
    directBaseUrl: str("ADSBX_BASE_URL", "https://gateway.adsbexchange.com/api/aircraft"),
    readsbBaseUrl: str("ADSB_BASE_URL", "https://opendata.adsb.fi/api/v2"),
    pollIntervalMs: num("ADSB_POLL_INTERVAL_MS", 5000),
    maxRadiusNm: num("ADSB_MAX_RADIUS_NM", 250),
    requestTimeoutMs: num("ADSB_TIMEOUT_MS", 12000),
    /**
     * Sent on every upstream call. Community feeds ask clients to identify
     * themselves; set ADSB_USER_AGENT to add your contact details if you run
     * this against one at any volume.
     */
    userAgent: str("ADSB_USER_AGENT", "PrivateAviationTracker/0.1 (+self-hosted)"),
    /**
     * How long one SSE connection is held open before the server closes it
     * cleanly and the browser reconnects. Serverless platforms cap function
     * duration (Vercel: 60s on Hobby, 300s on Pro), so rotating just under the
     * cap turns a hard platform kill into an orderly hand-off.
     */
    streamLifetimeMs: num("ADSB_STREAM_LIFETIME_MS", 50_000),
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
    /** auto (Planespotters then Google) | planespotters | google */
    provider: str("PHOTO_PROVIDER", "auto") as "auto" | "planespotters" | "google",
    // Falls back to the ownership-search Google credentials when a dedicated
    // image search engine is not configured separately.
    googleApiKey: str("GOOGLE_IMAGE_API_KEY") || str("GOOGLE_CSE_API_KEY"),
    googleCx: str("GOOGLE_IMAGE_CSE_CX") || str("GOOGLE_CSE_CX"),
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

/**
 * Why the configured ADS-B provider cannot run, naming the exact environment
 * variable that is missing. Generic "set the matching API key" advice is not
 * actionable when the reader is looking at a deployment dashboard.
 */
export function adsbConfigurationHint(): string {
  const missing: Record<AdsbProviderName, string> = {
    adsbexchange: 'ADSBX_RAPIDAPI_KEY is not set (ADSB_PROVIDER="adsbexchange").',
    adsbx_direct: 'ADSBX_API_KEY is not set (ADSB_PROVIDER="adsbx_direct").',
    readsb: 'ADSB_BASE_URL is not set (ADSB_PROVIDER="readsb").',
    demo: "",
  };
  const reason =
    missing[config.adsb.provider] ??
    `ADSB_PROVIDER="${config.adsb.provider}" is not a recognised provider.`;

  return (
    `${reason} Add it in your deployment's environment variables and redeploy. ` +
    "No paid key? Set ADSB_PROVIDER=readsb with " +
    "ADSB_BASE_URL=https://opendata.adsb.fi/api/v2 for free live data " +
    "(check their terms for your use), or ADSB_PROVIDER=demo for clearly " +
    "labelled simulated traffic."
  );
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
