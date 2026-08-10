import { config } from "@/lib/config";
import type { LiveAircraft, LiveFeedResult } from "@/lib/types";
import { normalizeMany } from "./normalize";
import { AdsbError, type AdsbProvider, type RawFeedResponse } from "./types";

export interface HttpProviderOptions {
  name: string;
  baseUrl: string;
  headers: Record<string, string>;
  configured: boolean;
  /** Some deployments require a trailing slash on every path. */
  trailingSlash: boolean;
  /** Path segment used for hex lookups: "hex" (adsb.lol) or "icao" (ADSBX). */
  hexPath: "hex" | "icao";
}

/**
 * ADS-B provider speaking the readsb/tar1090 v2 HTTP API. Used for ADS-B
 * Exchange (RapidAPI and direct) and any compatible feed.
 */
export class HttpAdsbProvider implements AdsbProvider {
  readonly simulated = false;

  constructor(private opts: HttpProviderOptions) {}

  get name(): string {
    return this.opts.name;
  }

  get configured(): boolean {
    return this.opts.configured;
  }

  private url(path: string): string {
    const base = this.opts.baseUrl.replace(/\/+$/, "");
    let rel = path.replace(/^\/+/, "");
    // Every provider documents its endpoint with the API version already in the
    // URL — https://opendata.adsb.fi/api/v2, https://api.adsb.lol/v2 — so that
    // is what people paste into ADSB_BASE_URL. Appending our own "v2/" segment
    // to such a base yields /v2/v2/... and 404s everything, so drop the
    // duplicate rather than making the correct value the surprising one.
    if (/\/v2$/i.test(base) && rel.toLowerCase().startsWith("v2/")) {
      rel = rel.slice(3);
    }
    const suffix = this.opts.trailingSlash && !rel.endsWith("/") ? "/" : "";
    return `${base}/${rel}${suffix}`;
  }

  private async request(path: string): Promise<RawFeedResponse> {
    if (!this.configured) {
      throw new AdsbError(
        `ADS-B provider "${this.name}" is missing credentials`,
        401,
        this.name,
      );
    }

    const url = this.url(path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.adsb.requestTimeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          // Community feeds ask clients to identify themselves, and an absent
          // or generic agent is a common reason for a flat rejection.
          "user-agent": config.adsb.userAgent,
          ...this.opts.headers,
        },
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.status === 429) {
        // Rate limited. Honour Retry-After when the feed sends one so the
        // backoff matches what the operator actually asked for.
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitSec = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 0;
        throw new AdsbError(
          `Upstream rate limit reached at ${new URL(url).host}. ` +
            (waitSec
              ? `The feed asked us to wait ${waitSec}s.`
              : "Polling will back off automatically."),
          429,
          this.name,
          url,
        );
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new AdsbError(
          `Upstream ADS-B request failed (${res.status}) for ${url}` +
            (body ? `: ${body.slice(0, 200)}` : " — empty response body"),
          res.status,
          this.name,
          url,
        );
      }
      return (await res.json()) as RawFeedResponse;
    } catch (error) {
      if (error instanceof AdsbError) throw error;
      const message =
        (error as Error).name === "AbortError"
          ? `Upstream ADS-B request timed out for ${url}`
          : `Upstream ADS-B request failed for ${url}: ${(error as Error).message}`;
      throw new AdsbError(message, undefined, this.name, url);
    } finally {
      clearTimeout(timer);
    }
  }

  private records(payload: RawFeedResponse) {
    return payload.ac ?? payload.aircraft ?? [];
  }

  /**
   * Normalise the feed's clock to epoch milliseconds.
   *
   * ADS-B Exchange v2 reports `now` in milliseconds; readsb/tar1090 feeds
   * (adsb.fi, adsb.lol, airplanes.live) report it in seconds. Taking the
   * value at face value put every readsb timestamp in January 1970, which
   * showed as "20655d ago", flagged a perfectly healthy feed as STALE and
   * wrote nonsense observation times into the position history.
   */
  private clock(payload: RawFeedResponse): number {
    const raw = payload.now;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return Date.now();
    // Anything below this is far too small to be milliseconds since 1970.
    const asMs = raw < 1e12 ? raw * 1000 : raw;
    // A clock more than a day out is not usable either way.
    return Math.abs(Date.now() - asMs) > 24 * 3600 * 1000 ? Date.now() : asMs;
  }

  async fetchArea(lat: number, lon: number, radiusNm: number): Promise<LiveFeedResult> {
    const dist = Math.min(Math.max(Math.round(radiusNm), 1), config.adsb.maxRadiusNm);
    const payload = await this.request(
      `v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${dist}`,
    );
    const raws = this.records(payload);
    const now = this.clock(payload);
    const aircraft = normalizeMany(raws, this.name, now);
    return {
      aircraft,
      totalObserved: raws.length,
      updatedAt: now,
      source: this.name,
      simulated: false,
      stale: false,
    };
  }

  async fetchByRegistration(registration: string): Promise<LiveAircraft | null> {
    const payload = await this.request(`v2/registration/${encodeURIComponent(registration)}`);
    return normalizeMany(this.records(payload), this.name)[0] ?? null;
  }

  async fetchByIcao(icao24: string): Promise<LiveAircraft | null> {
    const payload = await this.request(
      `v2/${this.opts.hexPath}/${encodeURIComponent(icao24.toLowerCase())}`,
    );
    return normalizeMany(this.records(payload), this.name)[0] ?? null;
  }

  async fetchByCallsign(callsign: string): Promise<LiveAircraft[]> {
    const payload = await this.request(`v2/callsign/${encodeURIComponent(callsign.toUpperCase())}`);
    return normalizeMany(this.records(payload), this.name);
  }
}
