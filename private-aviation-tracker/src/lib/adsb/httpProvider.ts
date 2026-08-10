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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.adsb.requestTimeoutMs);
    try {
      const res = await fetch(this.url(path), {
        headers: { accept: "application/json", ...this.opts.headers },
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new AdsbError(
          `Upstream ADS-B request failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
          res.status,
          this.name,
        );
      }
      return (await res.json()) as RawFeedResponse;
    } catch (error) {
      if (error instanceof AdsbError) throw error;
      const message =
        (error as Error).name === "AbortError"
          ? "Upstream ADS-B request timed out"
          : `Upstream ADS-B request failed: ${(error as Error).message}`;
      throw new AdsbError(message, undefined, this.name);
    } finally {
      clearTimeout(timer);
    }
  }

  private records(payload: RawFeedResponse) {
    return payload.ac ?? payload.aircraft ?? [];
  }

  async fetchArea(lat: number, lon: number, radiusNm: number): Promise<LiveFeedResult> {
    const dist = Math.min(Math.max(Math.round(radiusNm), 1), config.adsb.maxRadiusNm);
    const payload = await this.request(
      `v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${dist}`,
    );
    const raws = this.records(payload);
    const now = payload.now ?? Date.now();
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
