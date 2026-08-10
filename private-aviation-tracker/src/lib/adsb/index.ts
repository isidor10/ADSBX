import { config, usingOpenFeedFallback } from "@/lib/config";
import { DemoAdsbProvider } from "./demoProvider";
import { HttpAdsbProvider } from "./httpProvider";
import type { AdsbProvider } from "./types";

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
