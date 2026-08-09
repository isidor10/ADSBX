import type { OwnershipSource } from "@/lib/types";

type SourceKind = OwnershipSource["kind"];

interface Authority {
  label: string;
  kind: SourceKind;
  /** 0-1 multiplier applied to evidence found on this host. */
  weight: number;
}

/**
 * Source-authority table. Official registers outrank aggregators, which
 * outrank general web pages. Anything not listed gets a low default weight so
 * a single blog post can never on its own produce a "high confidence" result.
 */
const AUTHORITIES: Array<[RegExp, Authority]> = [
  [/(^|\.)registry\.faa\.gov$/i, { label: "FAA Registry", kind: "official_registry", weight: 1.0 }],
  [/(^|\.)faa\.gov$/i, { label: "FAA", kind: "official_registry", weight: 0.95 }],
  [/(^|\.)caa\.co\.uk$/i, { label: "UK CAA", kind: "official_registry", weight: 0.95 }],
  [/(^|\.)tc\.gc\.ca$/i, { label: "Transport Canada", kind: "official_registry", weight: 0.95 }],
  [/(^|\.)casa\.gov\.au$/i, { label: "CASA", kind: "official_registry", weight: 0.95 }],
  [/(^|\.)aircraft-register\.ch$/i, { label: "FOCA Switzerland", kind: "official_registry", weight: 0.95 }],
  [/(^|\.)iomaircraftregistry\.com$/i, { label: "Isle of Man Registry", kind: "official_registry", weight: 0.9 }],
  [/(^|\.)bcaa\.bm$/i, { label: "Bermuda CAA", kind: "official_registry", weight: 0.9 }],
  [/(^|\.)aviation-civile\.gouv\.fr$/i, { label: "DGAC France", kind: "official_registry", weight: 0.9 }],
  [/(^|\.)anac\.gov\.br$/i, { label: "ANAC Brazil", kind: "official_registry", weight: 0.9 }],
  [/(^|\.)sec\.gov$/i, { label: "SEC EDGAR", kind: "corporate_filing", weight: 0.85 }],
  [/(^|\.)opencorporates\.com$/i, { label: "OpenCorporates", kind: "corporate_filing", weight: 0.8 }],
  [/(^|\.)companieshouse\.gov\.uk$/i, { label: "Companies House", kind: "corporate_filing", weight: 0.85 }],
  [/(^|\.)planespotters\.net$/i, { label: "Planespotters", kind: "aviation_database", weight: 0.75 }],
  [/(^|\.)rzjets\.net$/i, { label: "rzjets", kind: "aviation_database", weight: 0.7 }],
  [/(^|\.)airfleets\.net$/i, { label: "Airfleets", kind: "aviation_database", weight: 0.7 }],
  [/(^|\.)aerotransport\.org$/i, { label: "AeroTransport", kind: "aviation_database", weight: 0.65 }],
  [/(^|\.)jetphotos\.com$/i, { label: "JetPhotos", kind: "aviation_database", weight: 0.6 }],
  [/(^|\.)flightaware\.com$/i, { label: "FlightAware", kind: "aviation_database", weight: 0.6 }],
  [/(^|\.)flightradar24\.com$/i, { label: "Flightradar24", kind: "aviation_database", weight: 0.55 }],
  [/(^|\.)airport-data\.com$/i, { label: "Airport-Data", kind: "aviation_database", weight: 0.55 }],
  [/(^|\.)airhistory\.net$/i, { label: "AirHistory", kind: "aviation_database", weight: 0.55 }],
  [/(^|\.)wikipedia\.org$/i, { label: "Wikipedia", kind: "news", weight: 0.5 }],
  [/(^|\.)ainonline\.com$/i, { label: "AIN", kind: "news", weight: 0.5 }],
  [/(^|\.)corporatejetinvestor\.com$/i, { label: "Corporate Jet Investor", kind: "news", weight: 0.5 }],
  [/(^|\.)flightglobal\.com$/i, { label: "FlightGlobal", kind: "news", weight: 0.5 }],
  [/(^|\.)reuters\.com$/i, { label: "Reuters", kind: "news", weight: 0.5 }],
  [/(^|\.)bloomberg\.com$/i, { label: "Bloomberg", kind: "news", weight: 0.5 }],
];

const DEFAULT_AUTHORITY: Authority = {
  label: "Web",
  kind: "search_result",
  weight: 0.3,
};

export function authorityFor(host: string): Authority {
  const clean = host.replace(/^www\./i, "").toLowerCase();
  for (const [pattern, authority] of AUTHORITIES) {
    if (pattern.test(clean)) return authority;
  }
  return { ...DEFAULT_AUTHORITY, label: clean || "Web" };
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/** True for aggregators whose own corporate name must never be read as an owner. */
export function isAggregatorName(name: string): boolean {
  const n = name.toLowerCase();
  return [
    "planespotters",
    "jetphotos",
    "flightaware",
    "flightradar",
    "airport-data",
    "airfleets",
    "rzjets",
    "aerotransport",
    "wikipedia",
    "adsb",
    "ads-b exchange",
    "opencorporates",
    "aviation safety network",
    "google",
    "youtube",
    "facebook",
    "instagram",
    "twitter",
    "linkedin",
    "reddit",
    "pinterest",
  ].some((bad) => n.includes(bad));
}
