/**
 * Scheduled-airline and cargo operator codes.
 *
 * This exists because the app kept showing SunExpress. Airframe alone cannot
 * decide the question — a 737 can be an airliner or a BBJ, and an unrecognised
 * type code left an airline classified as "unknown", which the charter
 * promotion rule then happily upgraded onto the private-aviation map.
 *
 * Identifying the *operator* settles it. These are ICAO three-letter operator
 * designators, the code that prefixes a flight callsign (THY1846 is Turkish
 * Airlines). An aircraft flying under an airline's callsign is doing airline
 * work, whatever it is made of.
 *
 * The list is not, and cannot be, exhaustive — there are thousands of
 * operators worldwide. It is a strong positive signal, not the only test:
 * `operationalClass.ts` also matches operator names and falls back to airframe
 * and fleet-size heuristics, so an airline missing from here is still caught.
 */

export type AirlineKind = "airline" | "cargo";

interface AirlineEntry {
  name: string;
  kind: AirlineKind;
}

function airlines(kind: AirlineKind, entries: Record<string, string>): Record<string, AirlineEntry> {
  return Object.fromEntries(
    Object.entries(entries).map(([code, name]) => [code, { name, kind }]),
  );
}

export const AIRLINE_CALLSIGNS: Record<string, AirlineEntry> = {
  ...airlines("airline", {
    // --- Turkey / Balkans / eastern Mediterranean ------------------------
    SXS: "SunExpress",
    THY: "Turkish Airlines",
    AJA: "AJet",
    PGT: "Pegasus Airlines",
    CAI: "Corendon Airlines",
    ASL: "Air Serbia",
    MGX: "Air Montenegro",
    CTN: "Croatia Airlines",
    JAT: "Air Serbia (legacy)",
    AEE: "Aegean Airlines",
    OAL: "Olympic Air",
    SEH: "Sky Express",
    LZB: "Bulgaria Air",
    ROT: "TAROM",
    ABN: "Air Albania",
    BMM: "Air Bosna",
    MAK: "Air Macedonia",

    // --- Europe ----------------------------------------------------------
    WZZ: "Wizz Air",
    WAU: "Wizz Air Abu Dhabi",
    WMT: "Wizz Air Malta",
    RYR: "Ryanair",
    RUK: "Ryanair UK",
    RYS: "Ryanair (Buzz)",
    DLH: "Lufthansa",
    CLH: "Lufthansa CityLine",
    EWG: "Eurowings",
    CFG: "Condor",
    EZY: "easyJet",
    EJU: "easyJet Europe",
    EZS: "easyJet Switzerland",
    BAW: "British Airways",
    SHT: "British Airways Shuttle",
    KLM: "KLM",
    AFR: "Air France",
    HOP: "Air France Hop",
    TRA: "Transavia",
    TVF: "Transavia France",
    AUA: "Austrian Airlines",
    SWR: "Swiss International Air Lines",
    EDW: "Edelweiss Air",
    BEL: "Brussels Airlines",
    LOT: "LOT Polish Airlines",
    CSA: "Smartwings / CSA",
    TVS: "Smartwings",
    SAS: "SAS",
    FIN: "Finnair",
    NAX: "Norwegian",
    NSZ: "Norwegian Air Sweden",
    ICE: "Icelandair",
    IBE: "Iberia",
    IBS: "Iberia Express",
    VLG: "Vueling",
    AEA: "Air Europa",
    VOE: "Volotea",
    TAP: "TAP Air Portugal",
    EXS: "Jet2",
    EIN: "Aer Lingus",
    LOG: "Loganair",
    TOM: "TUI Airways",
    TFL: "TUI fly Netherlands",
    BLX: "TUI fly Nordic",
    AUI: "Ukraine International",
    AFL: "Aeroflot",
    SBI: "S7 Airlines",
    UTA: "UTair",
    SDM: "Rossiya",
    MSR: "EgyptAir",
    RAM: "Royal Air Maroc",
    TAR: "Tunisair",
    LBT: "Nouvelair",

    // --- Middle East / Gulf ---------------------------------------------
    UAE: "Emirates",
    QTR: "Qatar Airways",
    ETD: "Etihad Airways",
    FDB: "flydubai",
    ABY: "Air Arabia",
    GFA: "Gulf Air",
    KAC: "Kuwait Airways",
    SVA: "Saudia",
    XSP: "flynas",
    MEA: "Middle East Airlines",
    RJA: "Royal Jordanian",
    ELY: "El Al",
    IZZ: "Arkia",
    ISR: "Israir",
    OMA: "Oman Air",

    // --- North America ---------------------------------------------------
    AAL: "American Airlines",
    DAL: "Delta Air Lines",
    UAL: "United Airlines",
    SWA: "Southwest Airlines",
    JBU: "JetBlue",
    ASA: "Alaska Airlines",
    FFT: "Frontier Airlines",
    NKS: "Spirit Airlines",
    HAL: "Hawaiian Airlines",
    SKW: "SkyWest",
    RPA: "Republic Airways",
    EDV: "Endeavor Air",
    JIA: "PSA Airlines",
    ENY: "Envoy Air",
    ACA: "Air Canada",
    JZA: "Jazz Aviation",
    WJA: "WestJet",
    TSC: "Air Transat",
    POE: "Porter Airlines",
    AMX: "Aeroméxico",
    VOI: "Volaris",
    VIV: "Viva Aerobus",

    // --- Asia / Pacific ---------------------------------------------------
    SIA: "Singapore Airlines",
    CPA: "Cathay Pacific",
    CES: "China Eastern",
    CSN: "China Southern",
    CCA: "Air China",
    CHH: "Hainan Airlines",
    CXA: "Xiamen Air",
    JAL: "Japan Airlines",
    ANA: "All Nippon Airways",
    KAL: "Korean Air",
    AAR: "Asiana Airlines",
    QFA: "Qantas",
    JST: "Jetstar",
    ANZ: "Air New Zealand",
    VOZ: "Virgin Australia",
    THA: "Thai Airways",
    AIQ: "Thai AirAsia",
    AXM: "AirAsia",
    MAS: "Malaysia Airlines",
    GIA: "Garuda Indonesia",
    LNI: "Lion Air",
    PAL: "Philippine Airlines",
    IGO: "IndiGo",
    AIC: "Air India",
    AXB: "Air India Express",
    VTI: "Vistara",
    SEJ: "SpiceJet",
    HVN: "Vietnam Airlines",
    VJC: "VietJet Air",

    // --- Africa / South America ------------------------------------------
    ETH: "Ethiopian Airlines",
    KQA: "Kenya Airways",
    SAA: "South African Airways",
    RWD: "RwandAir",
    TAM: "LATAM Brasil",
    LAN: "LATAM Airlines",
    GLO: "GOL",
    AZU: "Azul",
    ARG: "Aerolíneas Argentinas",
    AVA: "Avianca",
    CMP: "Copa Airlines",
  }),

  ...airlines("cargo", {
    FDX: "FedEx Express",
    UPS: "UPS Airlines",
    GTI: "Atlas Air",
    ABW: "AirBridgeCargo",
    CLX: "Cargolux",
    GEC: "Lufthansa Cargo",
    CKS: "Kalitta Air",
    ABX: "ABX Air",
    ATN: "Air Transport International",
    MPH: "Martinair Cargo",
    TAY: "ASL Airlines Belgium",
    NCA: "Nippon Cargo Airlines",
    CAO: "Air China Cargo",
    CKK: "China Cargo Airlines",
    SQC: "Singapore Airlines Cargo",
    QTR8: "Qatar Airways Cargo",
    UAE9: "Emirates SkyCargo",
    SVW9: "Silk Way West",
    AZG: "Silk Way West Airlines",
    BOX: "AeroLogic",
    LTG: "LATAM Cargo",
    ETH9: "Ethiopian Cargo",
    TSU: "Turkish Cargo",
    MSX: "Egyptair Cargo",
    SWN: "West Air Sweden",
    NPT: "West Atlantic UK",
    SWT: "Swiftair",
  }),
};

/**
 * Words that mark an operator name as a scheduled carrier. Deliberately
 * conservative: "Air" alone is far too common in business-aviation names
 * ("Air Hamburg", "Prince Aviation") to be usable as a signal.
 */
const AIRLINE_NAME_PATTERNS: RegExp[] = [
  /\bairlines?\b/i,
  /\bairways\b/i,
  /\bair\s+lines\b/i,
  /\bskycargo\b/i,
  /\bcargo\s+airlines?\b/i,
  /\blínea[s]?\s+aérea[s]?\b/i,
  /\blinhas\s+aéreas\b/i,
];

const CARGO_NAME_PATTERNS: RegExp[] = [/\bcargo\b/i, /\bfreight\b/i, /\blogistics\b/i];

export function lookupAirlineCallsign(callsign: string | null | undefined): AirlineEntry | null {
  if (!callsign) return null;
  const cs = callsign.trim().toUpperCase();
  // ICAO callsigns are three letters followed by a flight number.
  const match = /^([A-Z]{3})\d{1,4}[A-Z]{0,2}$/.exec(cs);
  if (!match) return null;
  return AIRLINE_CALLSIGNS[match[1]] ?? null;
}

/** Match an operator/owner *name* against the same database, then by pattern. */
export function lookupAirlineName(name: string | null | undefined): AirlineEntry | null {
  if (!name) return null;
  const clean = name.trim();
  if (clean.length < 3) return null;
  const lower = clean.toLowerCase();

  for (const entry of Object.values(AIRLINE_CALLSIGNS)) {
    const known = entry.name.toLowerCase();
    if (lower === known || lower.startsWith(`${known} `) || lower.includes(known)) {
      return entry;
    }
  }

  if (CARGO_NAME_PATTERNS.some((re) => re.test(clean))) {
    return { name: clean, kind: "cargo" };
  }
  if (AIRLINE_NAME_PATTERNS.some((re) => re.test(clean))) {
    return { name: clean, kind: "airline" };
  }
  return null;
}
