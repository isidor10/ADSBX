/**
 * Aircraft performance and cost reference data.
 *
 * Figures are typical published/industry values for the type — cruise fuel
 * burn, cruise speed, range, MTOW and an hourly maintenance reserve. They are
 * *class* figures, not the specific airframe's: actual burn varies with weight,
 * altitude, temperature, winds, engine standard and how the operator flies it.
 * Everything computed from this table is therefore labelled an estimate and
 * presented as a range, never as a quoted price.
 *
 * `confidence` records how well-established the numbers for that type are, and
 * feeds the width of the range the calculator produces.
 *
 * Adding a type is one entry keyed by ICAO type designator. Types absent from
 * the table fall back to their category profile rather than to zero, and the
 * result says which was used.
 */

export type CostCategory =
  | "very_light_jet"
  | "light_jet"
  | "midsize_jet"
  | "super_mid_jet"
  | "large_jet"
  | "ultra_long_jet"
  | "bizliner"
  | "turboprop_single"
  | "turboprop_twin"
  | "helicopter"
  | "piston";

export interface PerformanceProfile {
  /** Display name for the type. */
  name: string;
  category: CostCategory;
  /** Typical cruise fuel burn, litres per hour. */
  fuelBurnLph: number;
  /** Typical long-range cruise, knots true airspeed. */
  cruiseKt: number;
  /** Typical NBAA IFR range, nautical miles. */
  rangeNm: number;
  /** Usable fuel capacity, litres. */
  fuelCapacityL: number;
  /** Maximum take-off weight, kg — drives landing and handling fees. */
  mtowKg: number;
  /** Typical flight crew. */
  crew: number;
  /** Industry maintenance reserve, EUR per flight hour. */
  maintenanceEurPerHour: number;
  /** How well established these numbers are for this type. */
  confidence: "high" | "medium" | "low";
}

/** Jet-A is ~0.8 kg/L; used to convert published kg/h figures. */
export const JET_A_KG_PER_LITRE = 0.8;
export const LITRES_PER_US_GALLON = 3.785411784;

/**
 * Class fallbacks. Used when the exact type is unknown, and deliberately
 * conservative — a wrong number in the middle of a class beats a zero.
 */
export const CATEGORY_PROFILES: Record<CostCategory, PerformanceProfile> = {
  very_light_jet: { name: "Very light jet", category: "very_light_jet", fuelBurnLph: 380, cruiseKt: 380, rangeNm: 1200, fuelCapacityL: 1600, mtowKg: 4800, crew: 1, maintenanceEurPerHour: 450, confidence: "low" },
  light_jet: { name: "Light jet", category: "light_jet", fuelBurnLph: 570, cruiseKt: 420, rangeNm: 1900, fuelCapacityL: 2600, mtowKg: 7800, crew: 2, maintenanceEurPerHour: 700, confidence: "low" },
  midsize_jet: { name: "Midsize jet", category: "midsize_jet", fuelBurnLph: 800, cruiseKt: 440, rangeNm: 2600, fuelCapacityL: 4200, mtowKg: 10500, crew: 2, maintenanceEurPerHour: 950, confidence: "low" },
  super_mid_jet: { name: "Super-midsize jet", category: "super_mid_jet", fuelBurnLph: 1050, cruiseKt: 460, rangeNm: 3400, fuelCapacityL: 6400, mtowKg: 17000, crew: 2, maintenanceEurPerHour: 1200, confidence: "low" },
  large_jet: { name: "Large-cabin jet", category: "large_jet", fuelBurnLph: 1450, cruiseKt: 470, rangeNm: 4200, fuelCapacityL: 9500, mtowKg: 22000, crew: 2, maintenanceEurPerHour: 1500, confidence: "low" },
  ultra_long_jet: { name: "Ultra-long-range jet", category: "ultra_long_jet", fuelBurnLph: 1750, cruiseKt: 488, rangeNm: 6500, fuelCapacityL: 20000, mtowKg: 45000, crew: 2, maintenanceEurPerHour: 1900, confidence: "low" },
  bizliner: { name: "VIP airliner", category: "bizliner", fuelBurnLph: 2900, cruiseKt: 450, rangeNm: 5500, fuelCapacityL: 26000, mtowKg: 78000, crew: 3, maintenanceEurPerHour: 2600, confidence: "low" },
  turboprop_single: { name: "Single turboprop", category: "turboprop_single", fuelBurnLph: 230, cruiseKt: 270, rangeNm: 1500, fuelCapacityL: 1200, mtowKg: 4700, crew: 1, maintenanceEurPerHour: 350, confidence: "low" },
  turboprop_twin: { name: "Twin turboprop", category: "turboprop_twin", fuelBurnLph: 380, cruiseKt: 290, rangeNm: 1700, fuelCapacityL: 2000, mtowKg: 7000, crew: 2, maintenanceEurPerHour: 500, confidence: "low" },
  helicopter: { name: "Helicopter", category: "helicopter", fuelBurnLph: 250, cruiseKt: 135, rangeNm: 350, fuelCapacityL: 800, mtowKg: 3000, crew: 1, maintenanceEurPerHour: 800, confidence: "low" },
  piston: { name: "Piston aircraft", category: "piston", fuelBurnLph: 65, cruiseKt: 150, rangeNm: 700, fuelCapacityL: 300, mtowKg: 1600, crew: 1, maintenanceEurPerHour: 120, confidence: "low" },
};

/** Per-type figures, keyed by ICAO type designator. */
export const PERFORMANCE: Record<string, PerformanceProfile> = {
  // ---- Gulfstream --------------------------------------------------------
  GLF5: { name: "Gulfstream G550", category: "ultra_long_jet", fuelBurnLph: 1590, cruiseKt: 488, rangeNm: 6750, fuelCapacityL: 20800, mtowKg: 41277, crew: 2, maintenanceEurPerHour: 1800, confidence: "high" },
  GLF6: { name: "Gulfstream G650 / G650ER", category: "ultra_long_jet", fuelBurnLph: 1750, cruiseKt: 516, rangeNm: 7000, fuelCapacityL: 22600, mtowKg: 45178, crew: 2, maintenanceEurPerHour: 2000, confidence: "high" },
  GA5C: { name: "Gulfstream G500", category: "ultra_long_jet", fuelBurnLph: 1500, cruiseKt: 496, rangeNm: 5300, fuelCapacityL: 17500, mtowKg: 35528, crew: 2, maintenanceEurPerHour: 1700, confidence: "medium" },
  GA6C: { name: "Gulfstream G600", category: "ultra_long_jet", fuelBurnLph: 1600, cruiseKt: 500, rangeNm: 6600, fuelCapacityL: 20000, mtowKg: 42000, crew: 2, maintenanceEurPerHour: 1850, confidence: "medium" },
  GA7C: { name: "Gulfstream G700", category: "ultra_long_jet", fuelBurnLph: 1900, cruiseKt: 516, rangeNm: 7750, fuelCapacityL: 25000, mtowKg: 48000, crew: 2, maintenanceEurPerHour: 2200, confidence: "medium" },
  GLF4: { name: "Gulfstream G450 / GIV", category: "large_jet", fuelBurnLph: 1500, cruiseKt: 459, rangeNm: 4350, fuelCapacityL: 15800, mtowKg: 33838, crew: 2, maintenanceEurPerHour: 1600, confidence: "high" },
  G280: { name: "Gulfstream G280", category: "super_mid_jet", fuelBurnLph: 1000, cruiseKt: 459, rangeNm: 3600, fuelCapacityL: 7200, mtowKg: 17962, crew: 2, maintenanceEurPerHour: 1150, confidence: "high" },
  GALX: { name: "Gulfstream G200 / Galaxy", category: "super_mid_jet", fuelBurnLph: 1080, cruiseKt: 447, rangeNm: 3400, fuelCapacityL: 7100, mtowKg: 16080, crew: 2, maintenanceEurPerHour: 1100, confidence: "medium" },
  G150: { name: "Gulfstream G150", category: "midsize_jet", fuelBurnLph: 790, cruiseKt: 459, rangeNm: 3000, fuelCapacityL: 4400, mtowKg: 11839, crew: 2, maintenanceEurPerHour: 950, confidence: "medium" },

  // ---- Bombardier --------------------------------------------------------
  GL7T: { name: "Bombardier Global 7500", category: "ultra_long_jet", fuelBurnLph: 1850, cruiseKt: 516, rangeNm: 7700, fuelCapacityL: 26000, mtowKg: 51250, crew: 2, maintenanceEurPerHour: 2100, confidence: "high" },
  GL6T: { name: "Bombardier Global 6500", category: "ultra_long_jet", fuelBurnLph: 1680, cruiseKt: 500, rangeNm: 6600, fuelCapacityL: 21500, mtowKg: 45132, crew: 2, maintenanceEurPerHour: 1900, confidence: "high" },
  GL5T: { name: "Bombardier Global 5500", category: "ultra_long_jet", fuelBurnLph: 1550, cruiseKt: 500, rangeNm: 5900, fuelCapacityL: 19000, mtowKg: 41957, crew: 2, maintenanceEurPerHour: 1800, confidence: "medium" },
  GLEX: { name: "Bombardier Global Express / 6000", category: "ultra_long_jet", fuelBurnLph: 1700, cruiseKt: 488, rangeNm: 6000, fuelCapacityL: 21000, mtowKg: 45132, crew: 2, maintenanceEurPerHour: 1900, confidence: "high" },
  CL60: { name: "Bombardier Challenger 604 / 605 / 650", category: "large_jet", fuelBurnLph: 1300, cruiseKt: 459, rangeNm: 4000, fuelCapacityL: 11500, mtowKg: 21863, crew: 2, maintenanceEurPerHour: 1450, confidence: "high" },
  CL30: { name: "Bombardier Challenger 300", category: "super_mid_jet", fuelBurnLph: 1050, cruiseKt: 459, rangeNm: 3100, fuelCapacityL: 6900, mtowKg: 17600, crew: 2, maintenanceEurPerHour: 1150, confidence: "high" },
  CL35: { name: "Bombardier Challenger 350", category: "super_mid_jet", fuelBurnLph: 1030, cruiseKt: 459, rangeNm: 3200, fuelCapacityL: 6900, mtowKg: 18416, crew: 2, maintenanceEurPerHour: 1200, confidence: "high" },
  CL3T: { name: "Bombardier Challenger 3500", category: "super_mid_jet", fuelBurnLph: 1030, cruiseKt: 459, rangeNm: 3400, fuelCapacityL: 6900, mtowKg: 18416, crew: 2, maintenanceEurPerHour: 1200, confidence: "medium" },
  LJ45: { name: "Learjet 45", category: "light_jet", fuelBurnLph: 620, cruiseKt: 445, rangeNm: 1710, fuelCapacityL: 3100, mtowKg: 9752, crew: 2, maintenanceEurPerHour: 750, confidence: "medium" },
  LJ60: { name: "Learjet 60", category: "midsize_jet", fuelBurnLph: 830, cruiseKt: 456, rangeNm: 2400, fuelCapacityL: 4400, mtowKg: 10659, crew: 2, maintenanceEurPerHour: 900, confidence: "medium" },
  LJ75: { name: "Learjet 75", category: "light_jet", fuelBurnLph: 640, cruiseKt: 456, rangeNm: 2040, fuelCapacityL: 3300, mtowKg: 9752, crew: 2, maintenanceEurPerHour: 800, confidence: "medium" },

  // ---- Cessna Citation ---------------------------------------------------
  C56X: { name: "Cessna Citation Excel / XLS / XLS+", category: "midsize_jet", fuelBurnLph: 730, cruiseKt: 433, rangeNm: 2100, fuelCapacityL: 3900, mtowKg: 9163, crew: 2, maintenanceEurPerHour: 850, confidence: "high" },
  C68A: { name: "Cessna Citation Latitude", category: "super_mid_jet", fuelBurnLph: 840, cruiseKt: 446, rangeNm: 2700, fuelCapacityL: 5300, mtowKg: 13971, crew: 2, maintenanceEurPerHour: 1000, confidence: "high" },
  C700: { name: "Cessna Citation Longitude", category: "super_mid_jet", fuelBurnLph: 950, cruiseKt: 476, rangeNm: 3500, fuelCapacityL: 6500, mtowKg: 17917, crew: 2, maintenanceEurPerHour: 1150, confidence: "high" },
  C680: { name: "Cessna Citation Sovereign", category: "super_mid_jet", fuelBurnLph: 900, cruiseKt: 458, rangeNm: 3200, fuelCapacityL: 5900, mtowKg: 13971, crew: 2, maintenanceEurPerHour: 1050, confidence: "high" },
  C750: { name: "Cessna Citation X", category: "super_mid_jet", fuelBurnLph: 1180, cruiseKt: 525, rangeNm: 3400, fuelCapacityL: 6900, mtowKg: 16375, crew: 2, maintenanceEurPerHour: 1250, confidence: "high" },
  C25A: { name: "Cessna Citation CJ2", category: "light_jet", fuelBurnLph: 450, cruiseKt: 410, rangeNm: 1600, fuelCapacityL: 2200, mtowKg: 5670, crew: 2, maintenanceEurPerHour: 600, confidence: "high" },
  C25B: { name: "Cessna Citation CJ3", category: "light_jet", fuelBurnLph: 490, cruiseKt: 416, rangeNm: 1900, fuelCapacityL: 2500, mtowKg: 6291, crew: 2, maintenanceEurPerHour: 650, confidence: "high" },
  C25C: { name: "Cessna Citation CJ4", category: "light_jet", fuelBurnLph: 560, cruiseKt: 451, rangeNm: 2165, fuelCapacityL: 2900, mtowKg: 7761, crew: 2, maintenanceEurPerHour: 700, confidence: "high" },
  C25M: { name: "Cessna Citation M2", category: "very_light_jet", fuelBurnLph: 400, cruiseKt: 404, rangeNm: 1550, fuelCapacityL: 1800, mtowKg: 4944, crew: 1, maintenanceEurPerHour: 500, confidence: "medium" },
  C510: { name: "Cessna Citation Mustang", category: "very_light_jet", fuelBurnLph: 320, cruiseKt: 340, rangeNm: 1150, fuelCapacityL: 1400, mtowKg: 3921, crew: 1, maintenanceEurPerHour: 420, confidence: "medium" },
  C560: { name: "Cessna Citation V / Ultra / Encore", category: "light_jet", fuelBurnLph: 620, cruiseKt: 420, rangeNm: 1900, fuelCapacityL: 3100, mtowKg: 7633, crew: 2, maintenanceEurPerHour: 750, confidence: "medium" },

  // ---- Dassault ----------------------------------------------------------
  FA7X: { name: "Dassault Falcon 7X", category: "ultra_long_jet", fuelBurnLph: 1350, cruiseKt: 488, rangeNm: 5950, fuelCapacityL: 16000, mtowKg: 31751, crew: 2, maintenanceEurPerHour: 1700, confidence: "high" },
  FA8X: { name: "Dassault Falcon 8X", category: "ultra_long_jet", fuelBurnLph: 1400, cruiseKt: 488, rangeNm: 6450, fuelCapacityL: 17500, mtowKg: 33113, crew: 2, maintenanceEurPerHour: 1800, confidence: "high" },
  F900: { name: "Dassault Falcon 900", category: "large_jet", fuelBurnLph: 1250, cruiseKt: 470, rangeNm: 4500, fuelCapacityL: 12000, mtowKg: 22226, crew: 2, maintenanceEurPerHour: 1500, confidence: "high" },
  F2TH: { name: "Dassault Falcon 2000", category: "large_jet", fuelBurnLph: 1100, cruiseKt: 470, rangeNm: 3350, fuelCapacityL: 9000, mtowKg: 16238, crew: 2, maintenanceEurPerHour: 1300, confidence: "high" },
  FA6X: { name: "Dassault Falcon 6X", category: "ultra_long_jet", fuelBurnLph: 1400, cruiseKt: 488, rangeNm: 5500, fuelCapacityL: 16500, mtowKg: 35150, crew: 2, maintenanceEurPerHour: 1750, confidence: "medium" },
  FA50: { name: "Dassault Falcon 50", category: "large_jet", fuelBurnLph: 1150, cruiseKt: 450, rangeNm: 3000, fuelCapacityL: 8900, mtowKg: 18500, crew: 2, maintenanceEurPerHour: 1350, confidence: "medium" },

  // ---- Embraer -----------------------------------------------------------
  E55P: { name: "Embraer Phenom 300", category: "light_jet", fuelBurnLph: 520, cruiseKt: 453, rangeNm: 2010, fuelCapacityL: 2700, mtowKg: 8150, crew: 2, maintenanceEurPerHour: 680, confidence: "high" },
  E50P: { name: "Embraer Phenom 100", category: "very_light_jet", fuelBurnLph: 360, cruiseKt: 390, rangeNm: 1178, fuelCapacityL: 1600, mtowKg: 4800, crew: 1, maintenanceEurPerHour: 450, confidence: "medium" },
  E545: { name: "Embraer Praetor 500", category: "super_mid_jet", fuelBurnLph: 900, cruiseKt: 466, rangeNm: 3340, fuelCapacityL: 5900, mtowKg: 17085, crew: 2, maintenanceEurPerHour: 1100, confidence: "medium" },
  E550: { name: "Embraer Praetor 600", category: "super_mid_jet", fuelBurnLph: 980, cruiseKt: 466, rangeNm: 4018, fuelCapacityL: 6800, mtowKg: 19000, crew: 2, maintenanceEurPerHour: 1200, confidence: "medium" },
  E35L: { name: "Embraer Legacy 600 / 650", category: "large_jet", fuelBurnLph: 1250, cruiseKt: 447, rangeNm: 3900, fuelCapacityL: 10800, mtowKg: 24300, crew: 2, maintenanceEurPerHour: 1450, confidence: "high" },

  // ---- Hawker / other jets ----------------------------------------------
  H25B: { name: "Hawker 800 / 850XP", category: "midsize_jet", fuelBurnLph: 820, cruiseKt: 447, rangeNm: 2540, fuelCapacityL: 4600, mtowKg: 12700, crew: 2, maintenanceEurPerHour: 900, confidence: "medium" },
  PC24: { name: "Pilatus PC-24", category: "light_jet", fuelBurnLph: 560, cruiseKt: 425, rangeNm: 2000, fuelCapacityL: 2900, mtowKg: 8300, crew: 2, maintenanceEurPerHour: 700, confidence: "medium" },
  HDJT: { name: "HondaJet HA-420", category: "very_light_jet", fuelBurnLph: 300, cruiseKt: 422, rangeNm: 1223, fuelCapacityL: 1400, mtowKg: 4853, crew: 1, maintenanceEurPerHour: 420, confidence: "medium" },
  SF50: { name: "Cirrus Vision Jet SF50", category: "very_light_jet", fuelBurnLph: 250, cruiseKt: 305, rangeNm: 1275, fuelCapacityL: 1200, mtowKg: 3310, crew: 1, maintenanceEurPerHour: 350, confidence: "medium" },

  // ---- Turboprops --------------------------------------------------------
  PC12: { name: "Pilatus PC-12", category: "turboprop_single", fuelBurnLph: 250, cruiseKt: 280, rangeNm: 1800, fuelCapacityL: 1540, mtowKg: 4740, crew: 1, maintenanceEurPerHour: 380, confidence: "high" },
  TBM9: { name: "Daher TBM 900 series", category: "turboprop_single", fuelBurnLph: 220, cruiseKt: 330, rangeNm: 1730, fuelCapacityL: 1100, mtowKg: 3354, crew: 1, maintenanceEurPerHour: 340, confidence: "medium" },
  B350: { name: "Beechcraft King Air 350", category: "turboprop_twin", fuelBurnLph: 420, cruiseKt: 312, rangeNm: 1800, fuelCapacityL: 2000, mtowKg: 6804, crew: 2, maintenanceEurPerHour: 520, confidence: "high" },
  BE20: { name: "Beechcraft King Air 200", category: "turboprop_twin", fuelBurnLph: 380, cruiseKt: 290, rangeNm: 1580, fuelCapacityL: 1900, mtowKg: 5670, crew: 2, maintenanceEurPerHour: 480, confidence: "high" },
  P180: { name: "Piaggio Avanti", category: "turboprop_twin", fuelBurnLph: 340, cruiseKt: 320, rangeNm: 1470, fuelCapacityL: 1500, mtowKg: 5488, crew: 2, maintenanceEurPerHour: 550, confidence: "medium" },
  C208: { name: "Cessna Caravan", category: "turboprop_single", fuelBurnLph: 210, cruiseKt: 185, rangeNm: 1070, fuelCapacityL: 1260, mtowKg: 3985, crew: 1, maintenanceEurPerHour: 300, confidence: "medium" },
};

export interface ProfileLookup {
  profile: PerformanceProfile;
  /** True when the figures are for this exact type rather than its class. */
  exact: boolean;
  typeCode: string | null;
}

/** Category of last resort when nothing at all is known about the aircraft. */
const CATEGORY_BY_AIRCRAFT_CATEGORY: Record<string, CostCategory> = {
  business_jet: "midsize_jet",
  private_jet: "midsize_jet",
  bizliner: "bizliner",
  turboprop: "turboprop_twin",
  vip: "large_jet",
  charter: "midsize_jet",
  helicopter: "helicopter",
  light_ga: "piston",
  airliner: "bizliner",
  military: "large_jet",
  special: "midsize_jet",
  unknown: "midsize_jet",
};

export function performanceFor(
  typeCode: string | null | undefined,
  aircraftCategory: string | null | undefined,
): ProfileLookup {
  const code = typeCode?.trim().toUpperCase() ?? null;
  if (code && PERFORMANCE[code]) {
    return { profile: PERFORMANCE[code], exact: true, typeCode: code };
  }
  const category = CATEGORY_BY_AIRCRAFT_CATEGORY[aircraftCategory ?? "unknown"] ?? "midsize_jet";
  return { profile: CATEGORY_PROFILES[category], exact: false, typeCode: code };
}

export function typesCovered(): number {
  return Object.keys(PERFORMANCE).length;
}
