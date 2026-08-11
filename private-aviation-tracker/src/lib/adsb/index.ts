import { config, usingOpenFeedFallback } from "@/lib/config";
import { DemoAdsbProvider } from "./demoProvider";
import { HttpAdsbProvider } from "./httpProvider";
import { OpenSkyProvider } from "./openskyProvider";
import type { AdsbProvider } from "./types";

/**
 * Build one provider by name. Used to assemble the failover chain, which is
 * ordered by ADSB_PROVIDER_ORDER rather than hard-coded.
 */
function buildProvider(name: string): AdsbProvider | null {
  switch (name) {
    case "airplanes_live":
    case "airplaneslive":
      return new HttpAdsbProvider({
        name: "airplanes.live",
        baseUrl: config.airplanesLive.baseUrl,
        headers: config.airplanesLive.apiKey
          ? { "api-key": config.airplanesLive.apiKey }
          : {},
        configured: config.airplanesLive.enabled,
        trailingSlash: false,
        hexPath: "hex",
        // Documented as /v2/point/{lat}/{lon}/{radius}.
        areaStyle: "point",
      });

    case "opensky":
      return new OpenSkyProvider();

    case "adsbexchange":
      return new HttpAdsbProvider({
        name: "adsbexchange",
        baseUrl: `https://${config.adsb.rapidApiHost}`,
        headers: {
          "X-RapidAPI-Key": config.adsb.rapidApiKey,
          "X-RapidAPI-Host": config.adsb.rapidApiHost,
        },
        configured: Boolean(config.adsb.rapidApiKey),
        trailingSlash: true,
        hexPath: "icao",
      });

    case "adsbx_direct":
      return new HttpAdsbProvider({
        name: "adsbexchange-direct",
        baseUrl: config.adsb.directBaseUrl,
        headers: { "api-auth": config.adsb.directApiKey },
        configured: Boolean(config.adsb.directApiKey),
        trailingSlash: false,
        hexPath: "icao",
      });

    case "readsb":
      return new HttpAdsbProvider({
        name: `readsb (${new URL(config.adsb.readsbBaseUrl).host})`,
        baseUrl: config.adsb.readsbBaseUrl,
        headers: {},
        configured: Boolean(config.adsb.readsbBaseUrl),
        trailingSlash: false,
        hexPath: "hex",
      });

    case "demo":
      return new DemoAdsbProvider();

    default:
      return null;
  }
}

let chain: AdsbProvider[] | null = null;

/**
 * The ordered failover chain.
 *
 * Demo mode short-circuits it — simulated traffic must never be mixed with
 * real sources. Otherwise the chain is exactly ADSB_PROVIDER_ORDER, with any
 * provider that has no credentials left in place but reporting `configured:
 * false` so the health panel can show it as disabled rather than hiding it.
 */
export function getProviderChain(): AdsbProvider[] {
  if (chain) return chain;

  if (config.adsb.provider === "demo") {
    chain = [new DemoAdsbProvider()];
    return chain;
  }

  const built = config.providers.order
    .map(buildProvider)
    .filter((p): p is AdsbProvider => p !== null);

  // A deployment that explicitly selected one legacy provider still gets it,
  // appended so the new chain takes precedence but nothing is lost.
  const legacy = buildProvider(config.adsb.provider);
  if (legacy && !built.some((p) => p.name === legacy.name)) built.push(legacy);

  // Last resort. `usingOpenFeedFallback()` is only true when nothing above has
  // credentials, so this is the difference between a working map and an empty
  // one — it has to be a chain member, not just what single-aircraft lookups
  // fall back to, or the live feed would never reach it.
  if (usingOpenFeedFallback()) built.push(openFeedProvider());

  chain = built.length > 0 ? built : [new DemoAdsbProvider()];
  return chain;
}

let cached: AdsbProvider | null = null;

function openFeedProvider(): AdsbProvider {
  return new HttpAdsbProvider({
    name: `open feed (${new URL(config.adsb.openFeedUrl).host})`,
    baseUrl: config.adsb.openFeedUrl,
    headers: {},
    configured: true,
    trailingSlash: false,
    hexPath: "hex",
  });
}

/**
 * Resolve the configured ADS-B provider. ADS-B Exchange is the primary source;
 * `readsb` covers any tar1090-compatible endpoint and `demo` produces clearly
 * labelled simulated traffic for local UI work.
 */
export function getAdsbProvider(): AdsbProvider {
  if (cached) return cached;

  // An explicit ADSB_PROVIDER wins: naming a provider must actually select it,
  // not be quietly overridden by the head of the failover chain.
  if (config.adsb.providerExplicit) {
    const chosen = buildProvider(config.adsb.provider);
    if (chosen?.configured) {
      cached = chosen;
      return cached;
    }
  }

  // Otherwise single-provider callers (registration/hex/callsign lookups) use
  // the first configured member of the chain.
  const first = getProviderChain().find((p) => p.configured);
  if (first) {
    cached = first;
    return cached;
  }

  // A key that was never set is the single most common deployment mistake, and
  // an empty map teaches the operator nothing. Serve real traffic from the open
  // feed instead; the UI states which source is in use.
  if (usingOpenFeedFallback()) {
    cached = openFeedProvider();
    return cached;
  }

  switch (config.adsb.provider) {
    case "adsbexchange":
      cached = new HttpAdsbProvider({
        name: "adsbexchange",
        baseUrl: `https://${config.adsb.rapidApiHost}`,
        headers: {
          "X-RapidAPI-Key": config.adsb.rapidApiKey,
          "X-RapidAPI-Host": config.adsb.rapidApiHost,
        },
        configured: Boolean(config.adsb.rapidApiKey),
        trailingSlash: true,
        hexPath: "icao",
      });
      break;

    case "adsbx_direct":
      cached = new HttpAdsbProvider({
        name: "adsbexchange-direct",
        baseUrl: config.adsb.directBaseUrl,
        headers: { "api-auth": config.adsb.directApiKey },
        configured: Boolean(config.adsb.directApiKey),
        // The documented gateway paths carry no trailing slash:
        //   /api/aircraft/v2/icao/A465DF
        trailingSlash: false,
        hexPath: "icao",
      });
      break;

    case "readsb":
      cached = new HttpAdsbProvider({
        name: `readsb (${new URL(config.adsb.readsbBaseUrl).host})`,
        baseUrl: config.adsb.readsbBaseUrl,
        headers: {},
        configured: Boolean(config.adsb.readsbBaseUrl),
        trailingSlash: false,
        hexPath: "hex",
      });
      break;

    case "demo":
    default:
      cached = new DemoAdsbProvider();
      break;
  }

  return cached;
}


export * from "./types";
