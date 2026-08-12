import { classify } from "@/lib/aircraft/classifier";
import { classifyOperation } from "@/lib/aircraft/operationalClass";
import { config } from "@/lib/config";
import type { LiveAircraft, LiveFeedResult, PositionSource } from "@/lib/types";
import { AdsbError, type AdsbProvider } from "./types";

/**
 * OpenSky Network.
 *
 * A genuinely independent fallback: different receivers, different funding,
 * different failure modes from the readsb-family feeds. When Airplanes.live is
 * rate-limited, OpenSky is usually fine.
 *
 * It speaks nothing like the others. The response is an array of positional
 * arrays rather than named fields, altitudes are metres, speeds are m/s, and —
 * the part that matters most for this product — **there is no registration and
 * no aircraft type**. A state vector carries the ICAO 24-bit address and the
 * callsign, nothing else identifying.
 *
 * That is a real limitation, not an implementation gap: private/business
 * classification is built on the ICAO type designator, so aircraft sourced from
 * OpenSky cannot be filtered by type. They are marked `identityDegraded` so the
 * feed manager can report it and the UI can say the filter is running blind
 * rather than silently showing the wrong set. Positions, though, are positions.
 */

const STATE_FIELDS = {
  icao24: 0,
  callsign: 1,
  originCountry: 2,
  timePosition: 3,
  lastContact: 4,
  longitude: 5,
  latitude: 6,
  baroAltitude: 7,
  onGround: 8,
  velocity: 9,
  trueTrack: 10,
  verticalRate: 11,
  geoAltitude: 13,
  squawk: 14,
  /** 0 ADS-B, 1 ASTERIX (radar), 2 MLAT, 3 FLARM. */
  positionSource: 16,
} as const;

/**
 * OpenSky states its reception method numerically. ASTERIX is a radar exchange
 * format and FLARM is a glider beacon; neither maps onto an ADS-B category, so
 * both are reported as "other" rather than being dressed up as something more
 * precise than they are.
 */
function openSkyPositionSource(value: unknown): PositionSource {
  switch (value) {
    case 0:
      return "ADSB";
    case 2:
      return "MLAT";
    case 1:
    case 3:
      return "OTHER";
    default:
      return "UNKNOWN";
  }
}

type StateVector = Array<number | string | boolean | null>;

const METRES_TO_FEET = 3.280839895;
const MPS_TO_KNOTS = 1.943844;
const MPS_TO_FPM = 196.8504;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normaliseState(state: StateVector, now: number): LiveAircraft | null {
  const icao24 = String(state[STATE_FIELDS.icao24] ?? "").trim().toLowerCase();
  const lat = num(state[STATE_FIELDS.latitude]);
  const lon = num(state[STATE_FIELDS.longitude]);
  if (!icao24 || lat === null || lon === null) return null;

  const callsign = String(state[STATE_FIELDS.callsign] ?? "").trim() || null;
  const baroM = num(state[STATE_FIELDS.baroAltitude]);
  const geoM = num(state[STATE_FIELDS.geoAltitude]);
  const velocityMps = num(state[STATE_FIELDS.velocity]);
  const verticalMps = num(state[STATE_FIELDS.verticalRate]);
  const lastContact = num(state[STATE_FIELDS.lastContact]);
  const onGround = state[STATE_FIELDS.onGround] === true;

  // No type code and no registration to classify from — only the callsign.
  const classification = classify({
    typeCode: null,
    callsign,
    registration: null,
    emitterCategory: null,
    dbFlags: null,
    operator: null,
  });

  const altBaroFt = baroM === null ? null : Math.round(baroM * METRES_TO_FEET);
  const verticalRateFpm = verticalMps === null ? null : Math.round(verticalMps * MPS_TO_FPM);

  const seenAt = lastContact !== null ? lastContact * 1000 : now;

  return {
    icao24,
    registration: null,
    callsign,
    typeCode: null,
    manufacturer: null,
    model: null,
    category: classification.category,
    feedOperator: null,
    lat,
    lon,
    altBaroFt: onGround ? null : altBaroFt,
    altGeomFt: geoM === null ? null : Math.round(geoM * METRES_TO_FEET),
    groundSpeedKt: velocityMps === null ? null : Math.round(velocityMps * MPS_TO_KNOTS * 10) / 10,
    trackDeg: num(state[STATE_FIELDS.trueTrack]),
    verticalRateFpm,
    squawk: (state[STATE_FIELDS.squawk] as string | null) ?? null,
    onGround,
    emergency: null,
    ageSec: lastContact !== null ? Math.max(0, Math.round((now - seenAt) / 1000)) : null,
    seenAt,
    isMilitary: classification.isMilitary,
    isSpecial: classification.isSpecial,
    isBlocked: classification.isBlocked,
    flightStatus: onGround
      ? "on_ground"
      : verticalRateFpm === null
        ? "unknown"
        : verticalRateFpm > 300
          ? "climbing"
          : verticalRateFpm < -300
            ? "descending"
            : "cruising",
    source: "opensky",
    positionSource: openSkyPositionSource(state[STATE_FIELDS.positionSource]),
    /** OpenSky state vectors carry no type or registration. */
    identityDegraded: true,
    ...(() => {
      // The engine still runs: a state vector carries a callsign, which is
      // enough to recognise an airline and keep it off the map even though the
      // airframe is unknown.
      const r = classifyOperation({
        registration: null,
        icao24,
        callsign,
        typeCode: null,
        airframe: classification.category,
        feedOperator: null,
        isMilitary: classification.isMilitary,
        isSpecial: classification.isSpecial,
        isBlocked: classification.isBlocked,
        identityDegraded: true,
      });
      return {
        operation: r.operation,
        dataStatus: r.dataStatus,
        statusConfidence: r.confidence,
        statusReasons: r.reasons,
      };
    })(),
  };
}

export class OpenSkyProvider implements AdsbProvider {
  readonly name = "opensky";
  readonly simulated = false;

  /** Anonymous access works; credentials only raise the rate limit. */
  get configured(): boolean {
    return config.opensky.enabled;
  }

  private token: { value: string; expiresAt: number } | null = null;

  /**
   * OAuth2 client-credentials, used only when credentials are configured.
   * Anonymous requests work without this but have a much lower quota.
   */
  private async accessToken(): Promise<string | null> {
    const { clientId, clientSecret } = config.opensky;
    if (!clientId || !clientSecret) return null;
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;

    try {
      const res = await fetch(config.opensky.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!body.access_token) return null;
      this.token = {
        value: body.access_token,
        expiresAt: Date.now() + (body.expires_in ?? 1800) * 1000,
      };
      return this.token.value;
    } catch {
      return null;
    }
  }

  async fetchArea(lat: number, lon: number, radiusNm: number): Promise<LiveFeedResult> {
    // OpenSky takes a bounding box, not a radius.
    const latDelta = radiusNm / 60;
    const lonDelta = latDelta / Math.max(0.15, Math.cos((lat * Math.PI) / 180));

    const url = new URL(`${config.opensky.baseUrl.replace(/\/+$/, "")}/states/all`);
    url.searchParams.set("lamin", (lat - latDelta).toFixed(4));
    url.searchParams.set("lamax", (lat + latDelta).toFixed(4));
    url.searchParams.set("lomin", (lon - lonDelta).toFixed(4));
    url.searchParams.set("lomax", (lon + lonDelta).toFixed(4));

    const token = await this.accessToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.adsb.requestTimeoutMs);

    try {
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": config.adsb.userAgent,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.status === 429) {
        throw new AdsbError(
          "OpenSky rate limit reached. Anonymous access has a low quota — set OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET to raise it.",
          429,
          this.name,
          url.toString(),
        );
      }
      if (!res.ok) {
        throw new AdsbError(
          `OpenSky request failed (${res.status})`,
          res.status,
          this.name,
          url.toString(),
        );
      }

      const body = (await res.json()) as { time?: number; states?: StateVector[] | null };
      // OpenSky reports its clock in seconds.
      const now = body.time ? body.time * 1000 : Date.now();
      const states = body.states ?? [];
      const aircraft = states
        .map((state) => normaliseState(state, now))
        .filter((a): a is LiveAircraft => a !== null);

      return {
        aircraft,
        totalObserved: states.length,
        updatedAt: Math.abs(Date.now() - now) > 24 * 3600 * 1000 ? Date.now() : now,
        source: this.name,
        simulated: false,
        stale: false,
      };
    } catch (error) {
      if (error instanceof AdsbError) throw error;
      throw new AdsbError(
        (error as Error).name === "AbortError"
          ? "OpenSky request timed out"
          : `OpenSky request failed: ${(error as Error).message}`,
        undefined,
        this.name,
        url.toString(),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // OpenSky has no registration or callsign index over the public API, so
  // these are honestly unsupported rather than faked with a full-world scan.
  async fetchByRegistration(): Promise<LiveAircraft | null> {
    return null;
  }

  async fetchByIcao(icao24: string): Promise<LiveAircraft | null> {
    const url = new URL(`${config.opensky.baseUrl.replace(/\/+$/, "")}/states/all`);
    url.searchParams.set("icao24", icao24.toLowerCase());
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": config.adsb.userAgent },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { time?: number; states?: StateVector[] | null };
      const state = body.states?.[0];
      return state ? normaliseState(state, (body.time ?? Date.now() / 1000) * 1000) : null;
    } catch {
      return null;
    }
  }

  async fetchByCallsign(): Promise<LiveAircraft[]> {
    return [];
  }
}
