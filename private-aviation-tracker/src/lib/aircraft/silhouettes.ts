/**
 * Aircraft silhouettes.
 *
 * Map markers are drawn as a plan-view outline of the actual airframe, so a
 * Global 7500 reads differently from a Citation CJ2 at a glance — planform is
 * what distinguishes aircraft from above, so that is what is modelled:
 * fuselage proportions, wing span and sweep, tailplane, engine placement and
 * count, propellers, rotors.
 *
 * Three layers, each independently extensible:
 *
 *   1. `AirframeSpec` — a parametric description of a planform.
 *   2. `FAMILIES` — one spec per aircraft family.
 *   3. `TYPE_FAMILY` — ICAO type designator (DOC 8643) to family.
 *
 * Adding an aircraft is one line in `TYPE_FAMILY`. Adding a shape that no
 * existing family captures is one entry in `FAMILIES`. Nothing else changes,
 * and the renderer never needs touching.
 *
 * Unmapped types fall back through their classified category, so an unknown
 * turboprop still draws as a turboprop rather than as a generic dart.
 *
 * Geometry is normalised: x and y run 0..1 over the icon box, the nose sits at
 * y=0 pointing "up" (map north before rotation) and the centreline is x=0.5.
 * The renderer scales this to whatever pixel size it wants, which is what
 * keeps the markers sharp when zoomed in.
 */

import type { AircraftCategory } from "@/lib/types";

export type Point = readonly [number, number];

export interface WingSpec {
  /** Leading edge at the root, as a fraction of body length. */
  rootY: number;
  /** Root chord. */
  rootChord: number;
  /** Full tip-to-tip span. */
  span: number;
  /** How far the tip trails the root, i.e. sweep. */
  sweep: number;
  /** Tip chord as a fraction of the root chord. */
  taper: number;
  /** Small upturned tip, drawn as a thickened outer section. */
  winglets?: boolean;
}

export interface EngineSpec {
  /** Centre of the nacelle. x is offset from the centreline (can be 0). */
  x: number;
  y: number;
  length: number;
  width: number;
}

export interface PropSpec {
  x: number;
  y: number;
  radius: number;
}

export interface AirframeSpec {
  /** Nose-to-tail length as a fraction of the icon box. */
  length: number;
  /** Widest point of the fuselage. */
  bodyWidth: number;
  /**
   * Width at the very tip. Zero gives a pointed nose (jets, props); a
   * helicopter cabin is blunt and looks wrong drawn as a spike.
   */
  noseWidth?: number;
  /** Where the fuselage reaches full width (fraction of length). */
  noseTaper: number;
  /** Where it starts narrowing towards the tail. */
  tailTaper: number;
  /** Fuselage width at the very tail. */
  tailWidth: number;
  wing: WingSpec;
  tailplane: WingSpec;
  engines?: EngineSpec[];
  props?: PropSpec[];
  /** Main rotor disc, for rotorcraft. */
  rotorRadius?: number;
  /** Tail rotor position, for rotorcraft. */
  tailRotor?: PropSpec;
}

export interface Silhouette {
  /** Filled outlines, drawn in order. */
  polygons: Point[][];
  /** Rotor and propeller discs, drawn as translucent circles. */
  discs: PropSpec[];
}

// ---------------------------------------------------------------- geometry

function mirrorX(points: Point[]): Point[] {
  return points.map(([x, y]) => [1 - x, y] as Point);
}

/** Symmetric fuselage outline, nose at the top. */
function fuselage(spec: AirframeSpec): Point[] {
  const { length: L, bodyWidth: w, noseTaper, tailTaper, tailWidth } = spec;
  const top = (1 - L) / 2;
  const y = (f: number) => top + f * L;
  const half = w / 2;
  const tailHalf = tailWidth / 2;

  const noseHalf = (spec.noseWidth ?? 0) / 2;

  const right: Point[] = [
    [0.5 + noseHalf, y(0)],
    [0.5 + Math.max(noseHalf, half * 0.55), y(noseTaper * 0.45)],
    [0.5 + half, y(noseTaper)],
    [0.5 + half, y(tailTaper)],
    [0.5 + tailHalf, y(1)],
  ];
  // Down the right side, back up the left.
  return [...right, ...mirrorX([...right].reverse())];
}

/** One wing pair as a single polygon spanning the centreline. */
function wingPolygon(spec: AirframeSpec, wing: WingSpec): Point[] {
  const { length: L } = spec;
  const top = (1 - L) / 2;
  const y = (f: number) => top + f * L;

  const halfSpan = wing.span / 2;
  const tipChord = wing.rootChord * wing.taper;
  const tipLeadY = wing.rootY + wing.sweep;

  const right: Point[] = [
    [0.5, y(wing.rootY)],
    [0.5 + halfSpan, y(tipLeadY)],
    [0.5 + halfSpan, y(tipLeadY + tipChord)],
    [0.5, y(wing.rootY + wing.rootChord)],
  ];

  if (wing.winglets) {
    // A blended tip reads as a small forward hook at the outer edge.
    right.splice(2, 0, [0.5 + halfSpan * 1.02, y(tipLeadY - 0.012)]);
  }

  return [...right, ...mirrorX([...right].reverse()).slice(1)];
}

function nacelle(spec: AirframeSpec, engine: EngineSpec): Point[] {
  const { length: L } = spec;
  const top = (1 - L) / 2;
  const y = (f: number) => top + f * L;
  const halfW = engine.width / 2;
  const cx = 0.5 + engine.x;
  return [
    [cx - halfW, y(engine.y)],
    [cx + halfW, y(engine.y)],
    [cx + halfW * 0.8, y(engine.y + engine.length)],
    [cx - halfW * 0.8, y(engine.y + engine.length)],
  ];
}

/** Turn a parametric airframe into drawable geometry. */
export function buildSilhouette(spec: AirframeSpec): Silhouette {
  const top = (1 - spec.length) / 2;
  const toY = (f: number) => top + f * spec.length;

  const polygons: Point[][] = [];

  // Wings before the fuselage so the body reads as sitting on top of them.
  polygons.push(wingPolygon(spec, spec.wing));
  polygons.push(wingPolygon(spec, spec.tailplane));
  for (const engine of spec.engines ?? []) {
    polygons.push(nacelle(spec, engine));
    if (engine.x !== 0) polygons.push(mirrorX(nacelle(spec, engine)));
  }
  polygons.push(fuselage(spec));

  const discs: PropSpec[] = [];
  for (const prop of spec.props ?? []) {
    discs.push({ x: 0.5 + prop.x, y: toY(prop.y), radius: prop.radius });
    if (prop.x !== 0) discs.push({ x: 0.5 - prop.x, y: toY(prop.y), radius: prop.radius });
  }
  if (spec.rotorRadius) {
    discs.push({ x: 0.5, y: toY(0.42), radius: spec.rotorRadius });
  }
  if (spec.tailRotor) {
    discs.push({
      x: 0.5 + spec.tailRotor.x,
      y: toY(spec.tailRotor.y),
      radius: spec.tailRotor.radius,
    });
  }

  return { polygons, discs };
}

// ----------------------------------------------------------------- families

export type FamilyKey =
  | "ultra_long_jet"
  | "large_jet"
  | "super_mid_jet"
  | "midsize_jet"
  | "light_jet"
  | "very_light_jet"
  | "overwing_light_jet"
  | "trijet"
  | "bizliner"
  | "airliner"
  | "regional_jet"
  | "regional_turboprop"
  | "twin_turboprop"
  | "single_turboprop"
  | "piston_twin"
  | "piston_single"
  | "helicopter"
  | "light_helicopter"
  | "military_jet"
  | "military_transport"
  | "glider"
  | "generic";

/**
 * Rear-fuselage engine pair, the defining feature of most business jets. The
 * offset has to clear the fuselage or the nacelles merge into the body and the
 * silhouette loses the one thing that says "business jet" from above.
 */
function rearEngines(y: number, size = 1): EngineSpec[] {
  return [{ x: 0.105 * size, y, length: 0.19 * size, width: 0.07 * size }];
}

export const FAMILIES: Record<FamilyKey, AirframeSpec> = {
  // G650/G700, Global 6000-7500, Falcon 8X: long body, big swept wing, T-tail.
  ultra_long_jet: {
    length: 0.94,
    bodyWidth: 0.1,
    noseTaper: 0.14,
    tailTaper: 0.74,
    tailWidth: 0.045,
    wing: { rootY: 0.44, rootChord: 0.22, span: 0.94, sweep: 0.2, taper: 0.4, winglets: true },
    tailplane: { rootY: 0.9, rootChord: 0.09, span: 0.4, sweep: 0.055, taper: 0.55 },
    engines: rearEngines(0.66),
  },

  // G450/G550, Global Express, Legacy 600, Challenger 605.
  large_jet: {
    length: 0.88,
    bodyWidth: 0.105,
    noseTaper: 0.15,
    tailTaper: 0.72,
    tailWidth: 0.046,
    wing: { rootY: 0.44, rootChord: 0.21, span: 0.84, sweep: 0.17, taper: 0.42, winglets: true },
    tailplane: { rootY: 0.89, rootChord: 0.085, span: 0.38, sweep: 0.05, taper: 0.55 },
    engines: rearEngines(0.65, 0.96),
  },

  // Challenger 300/350, G280, Citation Longitude, Praetor 600.
  super_mid_jet: {
    length: 0.82,
    bodyWidth: 0.108,
    noseTaper: 0.16,
    tailTaper: 0.7,
    tailWidth: 0.048,
    wing: { rootY: 0.45, rootChord: 0.2, span: 0.76, sweep: 0.14, taper: 0.45, winglets: true },
    tailplane: { rootY: 0.88, rootChord: 0.08, span: 0.36, sweep: 0.04, taper: 0.56 },
    engines: rearEngines(0.64, 0.92),
  },

  // Citation XLS/Sovereign, Hawker 800, Learjet 60/75.
  midsize_jet: {
    length: 0.76,
    bodyWidth: 0.1,
    noseTaper: 0.16,
    tailTaper: 0.68,
    tailWidth: 0.045,
    wing: { rootY: 0.46, rootChord: 0.18, span: 0.7, sweep: 0.1, taper: 0.46 },
    tailplane: { rootY: 0.87, rootChord: 0.075, span: 0.33, sweep: 0.03, taper: 0.58 },
    engines: rearEngines(0.63, 0.88),
  },

  // CJ series, Phenom 300, Learjet 45, Citation 560.
  light_jet: {
    length: 0.68,
    bodyWidth: 0.095,
    noseTaper: 0.17,
    tailTaper: 0.66,
    tailWidth: 0.042,
    wing: { rootY: 0.47, rootChord: 0.16, span: 0.64, sweep: 0.05, taper: 0.5 },
    tailplane: { rootY: 0.86, rootChord: 0.07, span: 0.3, sweep: 0.02, taper: 0.6 },
    engines: rearEngines(0.62, 0.82),
  },

  // Mustang, Phenom 100, Eclipse, Vision Jet.
  very_light_jet: {
    length: 0.6,
    bodyWidth: 0.095,
    noseTaper: 0.18,
    tailTaper: 0.64,
    tailWidth: 0.04,
    wing: { rootY: 0.47, rootChord: 0.15, span: 0.58, sweep: 0.03, taper: 0.52 },
    tailplane: { rootY: 0.85, rootChord: 0.065, span: 0.27, sweep: 0.015, taper: 0.6 },
    engines: rearEngines(0.6, 0.76),
  },

  // HondaJet: nacelles pylon-mounted above the wing, not on the fuselage.
  overwing_light_jet: {
    length: 0.64,
    bodyWidth: 0.098,
    noseTaper: 0.17,
    tailTaper: 0.68,
    tailWidth: 0.04,
    wing: { rootY: 0.46, rootChord: 0.16, span: 0.62, sweep: 0.06, taper: 0.5 },
    tailplane: { rootY: 0.87, rootChord: 0.07, span: 0.28, sweep: 0.02, taper: 0.6 },
    engines: [{ x: 0.17, y: 0.44, length: 0.16, width: 0.058 }],
  },

  // Falcon 900/7X/8X and the Falcon 50: three engines, one on the centreline.
  trijet: {
    length: 0.9,
    bodyWidth: 0.105,
    noseTaper: 0.15,
    tailTaper: 0.72,
    tailWidth: 0.05,
    wing: { rootY: 0.44, rootChord: 0.21, span: 0.86, sweep: 0.17, taper: 0.4, winglets: true },
    tailplane: { rootY: 0.89, rootChord: 0.085, span: 0.38, sweep: 0.05, taper: 0.55 },
    engines: [
      { x: 0.108, y: 0.64, length: 0.19, width: 0.068 },
      // The centre engine is the whole point of a trijet: it has to run past
      // the tail cone to be visible against the fuselage behind it.
      { x: 0, y: 0.82, length: 0.22, width: 0.082 },
    ],
  },

  // BBJ / ACJ / Global-liner conversions: airliner airframe, wing engines.
  bizliner: {
    length: 0.96,
    bodyWidth: 0.13,
    noseTaper: 0.12,
    tailTaper: 0.8,
    tailWidth: 0.05,
    wing: { rootY: 0.4, rootChord: 0.26, span: 0.96, sweep: 0.22, taper: 0.32, winglets: true },
    tailplane: { rootY: 0.88, rootChord: 0.1, span: 0.42, sweep: 0.06, taper: 0.5 },
    engines: [{ x: 0.2, y: 0.46, length: 0.16, width: 0.07 }],
  },

  airliner: {
    length: 0.98,
    bodyWidth: 0.14,
    noseTaper: 0.11,
    tailTaper: 0.82,
    tailWidth: 0.052,
    wing: { rootY: 0.39, rootChord: 0.28, span: 1.0, sweep: 0.24, taper: 0.3 },
    tailplane: { rootY: 0.89, rootChord: 0.1, span: 0.44, sweep: 0.07, taper: 0.48 },
    engines: [{ x: 0.21, y: 0.45, length: 0.17, width: 0.072 }],
  },

  regional_jet: {
    length: 0.86,
    bodyWidth: 0.11,
    noseTaper: 0.13,
    tailTaper: 0.76,
    tailWidth: 0.046,
    wing: { rootY: 0.44, rootChord: 0.2, span: 0.78, sweep: 0.15, taper: 0.38 },
    tailplane: { rootY: 0.9, rootChord: 0.085, span: 0.36, sweep: 0.05, taper: 0.52 },
    engines: rearEngines(0.66, 0.95),
  },

  // ATR / Dash 8: long straight wing, engines on the wing driving props.
  regional_turboprop: {
    length: 0.82,
    bodyWidth: 0.115,
    noseTaper: 0.14,
    tailTaper: 0.76,
    tailWidth: 0.045,
    wing: { rootY: 0.32, rootChord: 0.16, span: 0.92, sweep: 0.02, taper: 0.62 },
    tailplane: { rootY: 0.88, rootChord: 0.085, span: 0.4, sweep: 0.02, taper: 0.55 },
    engines: [{ x: 0.16, y: 0.28, length: 0.2, width: 0.055 }],
    props: [{ x: 0.16, y: 0.26, radius: 0.11 }],
  },

  // King Air, Piaggio Avanti, Merlin: twin wing-mounted turboprops.
  twin_turboprop: {
    length: 0.72,
    bodyWidth: 0.1,
    noseTaper: 0.16,
    tailTaper: 0.7,
    tailWidth: 0.04,
    wing: { rootY: 0.4, rootChord: 0.16, span: 0.8, sweep: 0.03, taper: 0.55 },
    tailplane: { rootY: 0.87, rootChord: 0.08, span: 0.36, sweep: 0.02, taper: 0.55 },
    engines: [{ x: 0.14, y: 0.36, length: 0.18, width: 0.05 }],
    props: [{ x: 0.14, y: 0.34, radius: 0.1 }],
  },

  // PC-12, TBM, Caravan, Kodiak, Epic: single nose-mounted turboprop.
  single_turboprop: {
    length: 0.7,
    bodyWidth: 0.095,
    noseTaper: 0.2,
    tailTaper: 0.7,
    tailWidth: 0.038,
    wing: { rootY: 0.42, rootChord: 0.16, span: 0.78, sweep: 0.01, taper: 0.6 },
    tailplane: { rootY: 0.88, rootChord: 0.08, span: 0.34, sweep: 0.01, taper: 0.58 },
    props: [{ x: 0, y: 0.02, radius: 0.13 }],
  },

  piston_twin: {
    length: 0.64,
    bodyWidth: 0.09,
    noseTaper: 0.18,
    tailTaper: 0.68,
    tailWidth: 0.035,
    wing: { rootY: 0.42, rootChord: 0.15, span: 0.72, sweep: 0.01, taper: 0.62 },
    tailplane: { rootY: 0.87, rootChord: 0.075, span: 0.32, sweep: 0.01, taper: 0.58 },
    engines: [{ x: 0.13, y: 0.38, length: 0.15, width: 0.045 }],
    props: [{ x: 0.13, y: 0.36, radius: 0.085 }],
  },

  piston_single: {
    length: 0.58,
    bodyWidth: 0.085,
    noseTaper: 0.2,
    tailTaper: 0.66,
    tailWidth: 0.032,
    wing: { rootY: 0.4, rootChord: 0.15, span: 0.68, sweep: 0, taper: 0.66 },
    tailplane: { rootY: 0.86, rootChord: 0.07, span: 0.3, sweep: 0, taper: 0.6 },
    props: [{ x: 0, y: 0.02, radius: 0.11 }],
  },

  // Rotorcraft: cabin and tail boom under a rotor disc.
  // Cabin plus tail boom under a rotor disc. The disc is deliberately smaller
  // than scale: a true-size disc covers the airframe entirely and every
  // helicopter becomes an identical circle.
  helicopter: {
    length: 0.9,
    bodyWidth: 0.2,
    noseWidth: 0.11,
    noseTaper: 0.18,
    tailTaper: 0.46,
    tailWidth: 0.04,
    wing: { rootY: 0.5, rootChord: 0.001, span: 0.001, sweep: 0, taper: 1 },
    tailplane: { rootY: 0.84, rootChord: 0.055, span: 0.26, sweep: 0, taper: 0.7 },
    rotorRadius: 0.34,
    tailRotor: { x: 0.035, y: 0.95, radius: 0.09 },
  },

  light_helicopter: {
    length: 0.84,
    bodyWidth: 0.17,
    noseWidth: 0.095,
    noseTaper: 0.22,
    tailTaper: 0.4,
    tailWidth: 0.03,
    wing: { rootY: 0.5, rootChord: 0.001, span: 0.001, sweep: 0, taper: 1 },
    tailplane: { rootY: 0.82, rootChord: 0.045, span: 0.2, sweep: 0, taper: 0.7 },
    rotorRadius: 0.28,
    tailRotor: { x: 0.03, y: 0.94, radius: 0.075 },
  },

  // Fast jet: sharply swept delta-ish planform, no separate tailplane sweep.
  military_jet: {
    length: 0.8,
    bodyWidth: 0.1,
    noseTaper: 0.22,
    tailTaper: 0.62,
    tailWidth: 0.07,
    wing: { rootY: 0.4, rootChord: 0.32, span: 0.62, sweep: 0.26, taper: 0.22 },
    tailplane: { rootY: 0.8, rootChord: 0.12, span: 0.38, sweep: 0.08, taper: 0.35 },
  },

  military_transport: {
    length: 0.94,
    bodyWidth: 0.15,
    noseTaper: 0.14,
    tailTaper: 0.72,
    tailWidth: 0.07,
    wing: { rootY: 0.3, rootChord: 0.2, span: 1.0, sweep: 0.04, taper: 0.5 },
    tailplane: { rootY: 0.87, rootChord: 0.1, span: 0.44, sweep: 0.03, taper: 0.55 },
    engines: [
      { x: 0.14, y: 0.28, length: 0.2, width: 0.05 },
      { x: 0.28, y: 0.3, length: 0.2, width: 0.05 },
    ],
    props: [
      { x: 0.14, y: 0.26, radius: 0.1 },
      { x: 0.28, y: 0.28, radius: 0.1 },
    ],
  },

  glider: {
    length: 0.62,
    bodyWidth: 0.06,
    noseTaper: 0.16,
    tailTaper: 0.6,
    tailWidth: 0.025,
    wing: { rootY: 0.34, rootChord: 0.1, span: 1.0, sweep: 0.02, taper: 0.5 },
    tailplane: { rootY: 0.9, rootChord: 0.06, span: 0.26, sweep: 0, taper: 0.6 },
  },

  // Deliberately neutral: used only when the type is genuinely unknown.
  generic: {
    length: 0.74,
    bodyWidth: 0.1,
    noseTaper: 0.17,
    tailTaper: 0.7,
    tailWidth: 0.045,
    wing: { rootY: 0.45, rootChord: 0.18, span: 0.72, sweep: 0.1, taper: 0.48 },
    tailplane: { rootY: 0.88, rootChord: 0.08, span: 0.34, sweep: 0.03, taper: 0.55 },
    engines: rearEngines(0.64, 0.88),
  },
};

// ----------------------------------------------- ICAO type code → family map

/**
 * ICAO DOC 8643 type designators mapped to the family whose planform they
 * share. Grouped by manufacturer so additions land in an obvious place.
 */
export const TYPE_FAMILY: Record<string, FamilyKey> = {
  // --- Gulfstream ---
  GLF2: "large_jet",
  GLF3: "large_jet",
  GLF4: "large_jet",
  GLF5: "ultra_long_jet",
  GLF6: "ultra_long_jet",
  GA5C: "ultra_long_jet", // G500
  GA6C: "ultra_long_jet", // G600
  GA7C: "ultra_long_jet", // G700
  GA8C: "ultra_long_jet", // G800
  G280: "super_mid_jet",
  GALX: "super_mid_jet", // Galaxy / G200
  G150: "midsize_jet",
  ASTR: "midsize_jet",

  // --- Bombardier ---
  CL30: "super_mid_jet", // Challenger 300
  CL35: "super_mid_jet", // Challenger 350
  CL3T: "super_mid_jet", // Challenger 3500
  CL60: "large_jet", // Challenger 600/604/605/650
  GLEX: "ultra_long_jet", // Global Express
  GL5T: "ultra_long_jet", // Global 5500
  GL6T: "ultra_long_jet", // Global 6500
  GL7T: "ultra_long_jet", // Global 7500
  GL8T: "ultra_long_jet", // Global 8000
  LJ23: "very_light_jet",
  LJ24: "very_light_jet",
  LJ25: "light_jet",
  LJ28: "light_jet",
  LJ31: "light_jet",
  LJ35: "light_jet",
  LJ36: "light_jet",
  LJ40: "light_jet",
  LJ45: "light_jet",
  LJ55: "midsize_jet",
  LJ60: "midsize_jet",
  LJ70: "midsize_jet",
  LJ75: "midsize_jet",

  // --- Cessna Citation ---
  C500: "very_light_jet",
  C501: "very_light_jet",
  C510: "very_light_jet", // Mustang
  C525: "light_jet", // CJ1
  C25A: "light_jet", // CJ2
  C25B: "light_jet", // CJ3
  C25C: "light_jet", // CJ4
  C25M: "light_jet", // M2
  C550: "light_jet",
  C551: "light_jet",
  C560: "light_jet", // Citation V/Ultra/Encore
  C56X: "midsize_jet", // Excel / XLS / XLS+
  C650: "midsize_jet", // Citation III/VI/VII
  C680: "super_mid_jet", // Sovereign
  C68A: "super_mid_jet", // Latitude
  C700: "super_mid_jet", // Longitude
  C750: "super_mid_jet", // Citation X

  // --- Dassault Falcon ---
  FA10: "light_jet",
  FA20: "midsize_jet",
  FA50: "trijet",
  F2TH: "large_jet", // Falcon 2000
  F900: "trijet",
  FA7X: "trijet",
  FA8X: "trijet",
  FA6X: "large_jet",

  // --- Embraer ---
  E50P: "very_light_jet", // Phenom 100
  E55P: "light_jet", // Phenom 300
  E545: "super_mid_jet", // Praetor 500
  E550: "super_mid_jet", // Praetor 600
  E35L: "large_jet", // Legacy 600/650
  E135: "regional_jet",
  E190: "regional_jet",

  // --- Hawker / Beechcraft jets ---
  H25A: "midsize_jet",
  H25B: "midsize_jet",
  H25C: "midsize_jet",
  HA4T: "midsize_jet", // Hawker 4000
  BE40: "light_jet", // Beechjet 400
  PRM1: "light_jet", // Premier

  // --- Other jets ---
  PC24: "light_jet",
  HDJT: "overwing_light_jet", // HondaJet
  SF50: "very_light_jet", // Vision Jet
  EA50: "very_light_jet", // Eclipse
  EA55: "very_light_jet",
  WW24: "midsize_jet", // Westwind
  MU30: "light_jet", // Diamond
  SBR1: "midsize_jet", // Sabreliner
  JCOM: "light_jet", // Jet Commander
  BE4W: "light_jet",
  T134: "regional_jet",

  // --- Turboprops ---
  PC12: "single_turboprop",
  TBM7: "single_turboprop",
  TBM8: "single_turboprop",
  TBM9: "single_turboprop",
  P180: "twin_turboprop", // Piaggio Avanti
  BE20: "twin_turboprop", // King Air 200
  B350: "twin_turboprop", // King Air 350
  BE30: "twin_turboprop",
  BE9L: "twin_turboprop",
  BE10: "twin_turboprop",
  BE99: "twin_turboprop",
  C441: "twin_turboprop",
  C425: "twin_turboprop",
  P46T: "single_turboprop", // Piper Meridian
  PAY1: "twin_turboprop",
  PAY2: "twin_turboprop",
  PAY3: "twin_turboprop",
  PAY4: "twin_turboprop",
  MU2: "twin_turboprop",
  EPIC: "single_turboprop",
  SW4: "twin_turboprop",
  JS31: "regional_turboprop",
  JS32: "regional_turboprop",
  C208: "single_turboprop",
  C08T: "single_turboprop",
  KODI: "single_turboprop",
  DHC6: "regional_turboprop",

  // --- Piston ---
  C172: "piston_single",
  C152: "piston_single",
  C182: "piston_single",
  C206: "piston_single",
  C210: "piston_single",
  C310: "piston_twin",
  C337: "piston_twin",
  C402: "piston_twin",
  C404: "piston_twin",
  C414: "piston_twin",
  C421: "piston_twin",
  P28A: "piston_single",
  P28R: "piston_single",
  PA31: "piston_twin",
  PA32: "piston_single",
  PA34: "piston_twin",
  PA44: "piston_twin",
  PA46: "piston_single",
  SR20: "piston_single",
  SR22: "piston_single",
  S22T: "piston_single",
  DA40: "piston_single",
  DA42: "piston_twin",
  DA62: "piston_twin",
  BE33: "piston_single",
  BE35: "piston_single",
  BE36: "piston_single",
  BE58: "piston_twin",
  M20P: "piston_single",
  GLID: "glider",
  ULAC: "piston_single",

  // --- Rotorcraft ---
  A109: "helicopter",
  A119: "light_helicopter",
  A139: "helicopter",
  A169: "helicopter",
  A189: "helicopter",
  EC20: "light_helicopter",
  EC25: "helicopter",
  EC30: "light_helicopter",
  EC35: "helicopter",
  EC45: "helicopter",
  EC55: "helicopter",
  H160: "helicopter",
  AS50: "light_helicopter",
  AS55: "light_helicopter",
  AS65: "helicopter",
  B06: "light_helicopter",
  B06T: "light_helicopter",
  B407: "light_helicopter",
  B412: "helicopter",
  B429: "helicopter",
  B505: "light_helicopter",
  R22: "light_helicopter",
  R44: "light_helicopter",
  R66: "light_helicopter",
  S76: "helicopter",
  S92: "helicopter",
  H500: "light_helicopter",
  EN28: "light_helicopter",
  H60: "helicopter",

  // --- Airliners (shown under "All aircraft") ---
  A19N: "airliner",
  A20N: "airliner",
  A21N: "airliner",
  A318: "airliner",
  A319: "airliner",
  A320: "airliner",
  A321: "airliner",
  A332: "airliner",
  A333: "airliner",
  A339: "airliner",
  A342: "airliner",
  A343: "airliner",
  A345: "airliner",
  A346: "airliner",
  A359: "airliner",
  A35K: "airliner",
  A388: "airliner",
  B712: "airliner",
  B733: "airliner",
  B734: "airliner",
  B735: "airliner",
  B736: "airliner",
  B737: "airliner",
  B738: "airliner",
  B739: "airliner",
  B38M: "airliner",
  B39M: "airliner",
  B37M: "airliner",
  B752: "airliner",
  B753: "airliner",
  B762: "airliner",
  B763: "airliner",
  B764: "airliner",
  B772: "airliner",
  B77L: "airliner",
  B77W: "airliner",
  B788: "airliner",
  B789: "airliner",
  B78X: "airliner",
  B741: "airliner",
  B744: "airliner",
  B748: "airliner",
  E145: "regional_jet",
  E170: "regional_jet",
  E75L: "regional_jet",
  E195: "regional_jet",
  E290: "regional_jet",
  E295: "regional_jet",
  CRJ2: "regional_jet",
  CRJ7: "regional_jet",
  CRJ9: "regional_jet",
  CRJX: "regional_jet",
  BCS1: "airliner",
  BCS3: "airliner",
  AT43: "regional_turboprop",
  AT45: "regional_turboprop",
  AT72: "regional_turboprop",
  AT75: "regional_turboprop",
  AT76: "regional_turboprop",
  DH8A: "regional_turboprop",
  DH8D: "regional_turboprop",
  MD11: "airliner",
  MD82: "regional_jet",
  MD83: "regional_jet",
  MD88: "regional_jet",
  B190: "twin_turboprop",
  SF34: "regional_turboprop",
  SB20: "regional_turboprop",
  F100: "regional_jet",
  F70: "regional_jet",
  RJ85: "regional_jet",
  B461: "regional_jet",

  // --- Military ---
  C130: "military_transport",
  C30J: "military_transport",
  C17: "military_transport",
  C5M: "military_transport",
  K35R: "airliner",
  KC46: "airliner",
  A400: "military_transport",
  E3TF: "airliner",
  P8: "airliner",
  F16: "military_jet",
  F15: "military_jet",
  F18S: "military_jet",
  F35: "military_jet",
  EUFI: "military_jet",
  V22: "twin_turboprop",
  T38: "military_jet",
  T6: "piston_single",
  U2: "glider",
};

/** Last-resort mapping when the type designator is unknown or absent. */
const CATEGORY_FAMILY: Record<AircraftCategory, FamilyKey> = {
  private_jet: "midsize_jet",
  business_jet: "midsize_jet",
  bizliner: "bizliner",
  turboprop: "twin_turboprop",
  vip: "large_jet",
  charter: "midsize_jet",
  helicopter: "helicopter",
  military: "military_jet",
  airliner: "airliner",
  light_ga: "piston_single",
  special: "generic",
  unknown: "generic",
};

export interface SilhouetteChoice {
  family: FamilyKey;
  /** True when the family came from the type code rather than a fallback. */
  exact: boolean;
}

/**
 * Resolve the silhouette for an aircraft. Prefers the ICAO type designator;
 * falls back to the classified category so the shape is still in the right
 * family rather than arbitrary.
 */
export function silhouetteFor(
  typeCode: string | null | undefined,
  category: AircraftCategory,
): SilhouetteChoice {
  const code = typeCode?.trim().toUpperCase();
  if (code && TYPE_FAMILY[code]) {
    return { family: TYPE_FAMILY[code], exact: true };
  }
  return { family: CATEGORY_FAMILY[category] ?? "generic", exact: false };
}

/** Type codes covered by an exact silhouette, for diagnostics. */
export function silhouetteCoverage(): { types: number; families: number } {
  return {
    types: Object.keys(TYPE_FAMILY).length,
    families: Object.keys(FAMILIES).length,
  };
}
