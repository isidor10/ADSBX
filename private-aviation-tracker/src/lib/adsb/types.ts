import type { LiveAircraft, LiveFeedResult } from "@/lib/types";

/**
 * Raw aircraft record in the readsb / tar1090 JSON schema. ADS-B Exchange v2,
 * adsb.fi, adsb.lol, airplanes.live and self-hosted readsb feeds all emit this
 * shape, so one parser covers every supported provider.
 */
export interface RawAircraft {
  hex?: string;
  type?: string;
  flight?: string;
  /** Registration. */
  r?: string;
  /** ICAO type designator. */
  t?: string;
  /** Description of the type, e.g. "Gulfstream Aerospace G-VI". */
  desc?: string;
  /** Owner/operator string, present on some feeds. */
  ownOp?: string;
  year?: string | number;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number;
  ias?: number;
  tas?: number;
  mach?: number;
  track?: number;
  true_heading?: number;
  mag_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  emergency?: string;
  /** ADS-B emitter category, e.g. "A2", "A7". */
  category?: string;
  nav_qnh?: number;
  nav_altitude_mcp?: number;
  lat?: number;
  lon?: number;
  nic?: number;
  rc?: number;
  seen_pos?: number;
  seen?: number;
  messages?: number;
  rssi?: number;
  /** Bitfield: 1 military, 2 interesting, 4 PIA, 8 LADD. */
  dbFlags?: number;
  gpsOkBefore?: number;
  alert?: number;
  spi?: number;
}

export interface RawFeedResponse {
  ac?: RawAircraft[] | null;
  aircraft?: RawAircraft[] | null;
  total?: number;
  now?: number;
  ctime?: number;
  ptime?: number;
  msg?: string;
}

export interface AdsbProvider {
  readonly name: string;
  readonly configured: boolean;
  /** True when this provider returns simulated data. */
  readonly simulated: boolean;
  fetchArea(lat: number, lon: number, radiusNm: number): Promise<LiveFeedResult>;
  fetchByRegistration(registration: string): Promise<LiveAircraft | null>;
  fetchByIcao(icao24: string): Promise<LiveAircraft | null>;
  fetchByCallsign(callsign: string): Promise<LiveAircraft[]>;
}

export class AdsbError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly provider?: string,
  ) {
    super(message);
    this.name = "AdsbError";
  }
}

export type { LiveAircraft, LiveFeedResult };
