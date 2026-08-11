import { classify } from "@/lib/aircraft/classifier";
import { lookupType } from "@/lib/aircraft/typeDatabase";
import type { LiveAircraft, LiveFeedResult } from "@/lib/types";
import type { AdsbProvider } from "./types";

/**
 * Deterministic *simulated* traffic for local UI development when no ADS-B
 * credentials are available.
 *
 * Every registration produced here is deliberately invalid under the FAA
 * scheme (an N-number cannot have a leading zero) so simulated aircraft can
 * never be mistaken for a real airframe, and the UI shows a permanent
 * "SIMULATED DATA" banner whenever this provider is active. No ownership data
 * is ever fabricated — the ownership pipeline runs unchanged and will report
 * "no reliable public source" for these tails.
 */

interface DemoTemplate {
  reg: string;
  type: string;
  callsign: string;
  /** Great-circle bearing the aircraft tracks, degrees. */
  heading: number;
  altitude: number;
  speed: number;
  /** Offset from the viewport centre in degrees. */
  dLat: number;
  dLon: number;
}

/**
 * Every registration below is structurally invalid in its own national scheme
 * — each one carries a digit where that registry only permits letters (a US
 * N-number cannot have a leading zero, a UK registration is G- plus four
 * letters, and so on) — so a simulated contact can never be mistaken for a
 * real airframe. The registry mix is deliberate: business aviation is not a
 * US-only phenomenon, and an all-N-number demo fleet gives a false impression.
 */
const TEMPLATES: DemoTemplate[] = [
  { reg: "N0GLF6", type: "GLF6", callsign: "N0GLF6", heading: 82, altitude: 45000, speed: 488, dLat: 0.42, dLon: -0.71 },
  { reg: "OE-0CL", type: "CL35", callsign: "LXJ001", heading: 271, altitude: 41000, speed: 452, dLat: -0.58, dLon: 0.33 },
  { reg: "N0C56X", type: "C56X", callsign: "EJA002", heading: 15, altitude: 33000, speed: 388, dLat: 0.13, dLon: 0.95 },
  { reg: "I-0AVA", type: "E55P", callsign: "I-0AVA", heading: 190, altitude: 27000, speed: 351, dLat: -0.87, dLon: -0.24 },
  { reg: "D-0FA7", type: "FA7X", callsign: "VJT003", heading: 305, altitude: 43000, speed: 471, dLat: 0.76, dLon: 0.62 },
  { reg: "9H-0VJ", type: "GL7T", callsign: "VJT004", heading: 118, altitude: 47000, speed: 503, dLat: -0.31, dLon: -1.02 },
  { reg: "HB-0PC", type: "PC12", callsign: "HB-0PC", heading: 233, altitude: 19000, speed: 241, dLat: 0.22, dLon: -0.18 },
  { reg: "N0B350", type: "B350", callsign: "N0B350", heading: 47, altitude: 21000, speed: 268, dLat: -0.66, dLon: 0.84 },
  { reg: "M-0AVI", type: "C700", callsign: "M-0AVI", heading: 356, altitude: 39000, speed: 441, dLat: 0.95, dLon: -0.44 },
  { reg: "VP-C0G", type: "HDJT", callsign: "VP-C0G", heading: 143, altitude: 28000, speed: 359, dLat: -0.11, dLon: 0.47 },
  { reg: "G-0LEX", type: "GLEX", callsign: "G-0LEX", heading: 205, altitude: 44000, speed: 484, dLat: 0.53, dLon: 1.11 },
  { reg: "F-H0TB", type: "TBM9", callsign: "F-H0TB", heading: 68, altitude: 16000, speed: 288, dLat: -0.94, dLon: -0.65 },
];

const CYCLE_MS = 45 * 60 * 1000;

function moveAlong(lat: number, lon: number, headingDeg: number, distanceNm: number) {
  const rad = (headingDeg * Math.PI) / 180;
  const dLat = (distanceNm / 60) * Math.cos(rad);
  const dLon = (distanceNm / 60) * Math.sin(rad) / Math.cos((lat * Math.PI) / 180 || 1);
  return { lat: lat + dLat, lon: lon + dLon };
}

function build(t: DemoTemplate, centerLat: number, centerLon: number, now: number): LiveAircraft {
  // Position advances along the template heading and wraps every cycle so the
  // aircraft stays near the requested viewport.
  const phase = ((now % CYCLE_MS) / CYCLE_MS) * 2 - 1;
  const travelledNm = phase * (t.speed * 0.4);
  const origin = { lat: centerLat + t.dLat, lon: centerLon + t.dLon };
  const pos = moveAlong(origin.lat, origin.lon, t.heading, travelledNm);

  const verticalRate = Math.round(Math.sin((now / 60000) + t.heading) * 900);
  const typeInfo = lookupType(t.type);
  const classification = classify({
    typeCode: t.type,
    callsign: t.callsign,
    registration: t.reg,
    emitterCategory: "A2",
    dbFlags: 0,
    operator: null,
  });

  return {
    // Stable pseudo-hex per template; hyphenated registrations are not valid
    // hex, so derive it from the index instead of the registration text.
    icao24: `f0${(TEMPLATES.indexOf(t) + 1).toString(16).padStart(4, "0")}`,
    registration: t.reg,
    callsign: t.callsign,
    typeCode: t.type,
    manufacturer: typeInfo?.manufacturer ?? null,
    model: typeInfo?.model ?? null,
    category: classification.category,
    feedOperator: classification.bizavOperator,
    lat: Math.max(-85, Math.min(85, pos.lat)),
    lon: ((pos.lon + 540) % 360) - 180,
    altBaroFt: t.altitude,
    altGeomFt: t.altitude + 120,
    groundSpeedKt: t.speed,
    trackDeg: t.heading,
    verticalRateFpm: verticalRate,
    squawk: "1200",
    onGround: false,
    emergency: null,
    ageSec: 1,
    seenAt: now,
    isMilitary: false,
    isSpecial: false,
    isBlocked: false,
    flightStatus: verticalRate > 300 ? "climbing" : verticalRate < -300 ? "descending" : "cruising",
    source: "demo",
    positionSource: "ADSB",
    simulated: true,
  };
}

export class DemoAdsbProvider implements AdsbProvider {
  readonly name = "demo";
  readonly configured = true;
  readonly simulated = true;

  async fetchArea(lat: number, lon: number): Promise<LiveFeedResult> {
    const now = Date.now();
    const aircraft = TEMPLATES.map((t) => build(t, lat, lon, now));
    return {
      aircraft,
      totalObserved: aircraft.length,
      updatedAt: now,
      source: "demo",
      simulated: true,
      stale: false,
    };
  }

  async fetchByRegistration(registration: string): Promise<LiveAircraft | null> {
    const t = TEMPLATES.find((x) => x.reg === registration.toUpperCase());
    return t ? build(t, 47, 8, Date.now()) : null;
  }

  async fetchByIcao(icao24: string): Promise<LiveAircraft | null> {
    const now = Date.now();
    return TEMPLATES.map((t) => build(t, 47, 8, now)).find((a) => a.icao24 === icao24.toLowerCase()) ?? null;
  }

  async fetchByCallsign(callsign: string): Promise<LiveAircraft[]> {
    const now = Date.now();
    return TEMPLATES.filter((t) => t.callsign === callsign.toUpperCase()).map((t) => build(t, 47, 8, now));
  }
}
