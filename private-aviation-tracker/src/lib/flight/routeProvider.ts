import { cache } from "@/lib/cache";
import { config } from "@/lib/config";
import type { AirportRef } from "@/lib/types";

/**
 * Filed-route lookup by callsign.
 *
 * ADS-B carries no destination — the transponder broadcasts where an aircraft
 * *is*, never where it is going. A route therefore has to come from a separate
 * dataset keyed on the callsign, which is what this provides.
 *
 * Business aviation is a hard case on purpose: most private flights use the
 * registration as the callsign and file no publicly-published route, so the
 * honest answer is usually "no route known". Charter and fractional operators
 * flying under an ICAO callsign (EJA, VJT, NJE…) are the ones that resolve.
 *
 * Swapping the source is one class and one case in the factory, matching the
 * ADS-B and search provider abstractions.
 */

export interface FlightRoute {
  callsign: string;
  origin: AirportRef | null;
  destination: AirportRef | null;
  provider: string;
}

export interface RouteProvider {
  readonly name: string;
  readonly configured: boolean;
  lookup(callsign: string): Promise<FlightRoute | null>;
}

const REQUEST_TIMEOUT_MS = 6000;

class NullRouteProvider implements RouteProvider {
  readonly name = "none";
  readonly configured = false;
  async lookup(): Promise<FlightRoute | null> {
    return null;
  }
}

interface AdsbdbAirport {
  icao_code?: string;
  iata_code?: string;
  name?: string;
  municipality?: string;
  country_iso_name?: string;
  latitude?: number;
  longitude?: number;
}

function toRef(raw: AdsbdbAirport | undefined): AirportRef | null {
  if (!raw || typeof raw.latitude !== "number" || typeof raw.longitude !== "number") return null;
  return {
    icao: raw.icao_code ?? null,
    iata: raw.iata_code ?? null,
    name: raw.name ?? raw.icao_code ?? "Unknown",
    city: raw.municipality ?? null,
    country: raw.country_iso_name ?? null,
    lat: raw.latitude,
    lon: raw.longitude,
  };
}

/**
 * adsbdb.com — a free public API over an open route database. No key needed.
 * Check its terms before running heavy volume through it; results are cached
 * for a day here because a callsign's route does not change minute to minute.
 */
class AdsbdbRouteProvider implements RouteProvider {
  readonly name = "adsbdb";
  readonly configured = true;

  constructor(private baseUrl: string) {}

  async lookup(callsign: string): Promise<FlightRoute | null> {
    const cs = callsign.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(cs)) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/callsign/${cs}`, {
        headers: { accept: "application/json", "user-agent": config.adsb.userAgent },
        signal: controller.signal,
        cache: "no-store",
      });
      // 404 is the normal answer for a private flight with no published route.
      if (!res.ok) return null;

      const body = (await res.json()) as {
        response?: {
          flightroute?: {
            callsign?: string;
            origin?: AdsbdbAirport;
            destination?: AdsbdbAirport;
          };
        };
      };
      const route = body.response?.flightroute;
      if (!route) return null;

      const origin = toRef(route.origin);
      const destination = toRef(route.destination);
      if (!origin && !destination) return null;

      return { callsign: cs, origin, destination, provider: this.name };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

let cached: RouteProvider | null = null;

export function getRouteProvider(): RouteProvider {
  if (cached) return cached;
  switch (config.route.provider) {
    case "adsbdb":
      cached = new AdsbdbRouteProvider(config.route.baseUrl);
      break;
    default:
      cached = new NullRouteProvider();
      break;
  }
  return cached;
}

/**
 * Cached route lookup. Negative results are cached too, at a shorter TTL —
 * most private callsigns will never resolve and re-asking on every poll would
 * be pure waste.
 */
export async function lookupRoute(callsign: string | null): Promise<FlightRoute | null> {
  if (!callsign) return null;
  const provider = getRouteProvider();
  if (!provider.configured) return null;

  const cs = callsign.trim().toUpperCase();
  if (!cs) return null;

  const key = `route:${provider.name}:${cs}`;
  const hit = await cache.getJson<FlightRoute | { miss: true }>(key);
  if (hit) return "miss" in hit ? null : hit;

  const route = await provider.lookup(cs);
  await cache.setJson(
    key,
    route ?? { miss: true },
    (route ? config.route.ttlHours : config.route.missTtlHours) * 3600,
  );
  return route;
}
