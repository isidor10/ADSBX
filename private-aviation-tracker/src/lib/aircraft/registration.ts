/**
 * Registration (tail number) helpers: normalisation, country/registry
 * resolution and links to the official public registry for that country.
 */

export interface RegistryInfo {
  country: string;
  countryCode: string;
  authority: string;
  /** Public search page for this registry, deep-linked where possible. */
  searchUrl: (registration: string) => string;
  /** True when the registry publishes owner names in a free public search. */
  publishesOwner: boolean;
}

const FAA: RegistryInfo = {
  country: "United States",
  countryCode: "US",
  authority: "FAA Civil Aviation Registry",
  searchUrl: (r) =>
    `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${encodeURIComponent(
      r.replace(/^N/i, "").toUpperCase(),
    )}`,
  publishesOwner: true,
};

function simple(
  country: string,
  countryCode: string,
  authority: string,
  url: string,
  publishesOwner = false,
): RegistryInfo {
  return { country, countryCode, authority, searchUrl: () => url, publishesOwner };
}

/**
 * Registration prefix → registry. Ordered longest-prefix-first at lookup time.
 * Covers the jurisdictions that matter most for business aviation plus the
 * common national registers.
 */
const PREFIXES: Array<[string, RegistryInfo]> = [
  ["N", FAA],
  ["C-", simple("Canada", "CA", "Transport Canada", "https://wwwapps.tc.gc.ca/Saf-Sec-Sur/2/CCARCS-RIACC/RchSimp.aspx", true)],
  ["G-", simple("United Kingdom", "GB", "UK CAA G-INFO", "https://siteapps.caa.co.uk/g-info/", true)],
  ["M-", simple("Isle of Man", "IM", "Isle of Man Aircraft Registry", "https://www.iomaircraftregistry.com/aircraft-registry/register-search/")],
  ["2-", simple("Guernsey", "GG", "Guernsey Aircraft Registry", "https://www.aircraftregistry.gg/")],
  ["VP-B", simple("Bermuda", "BM", "Bermuda Civil Aviation Authority", "https://www.bcaa.bm/aircraft-registry")],
  ["VQ-B", simple("Bermuda", "BM", "Bermuda Civil Aviation Authority", "https://www.bcaa.bm/aircraft-registry")],
  ["VP-C", simple("Cayman Islands", "KY", "Cayman Islands CAA", "https://www.caacayman.com/aircraft-registry/")],
  ["T7-", simple("San Marino", "SM", "San Marino Aircraft Registry", "https://www.aviation.sm/")],
  ["9H-", simple("Malta", "MT", "Transport Malta", "https://www.transport.gov.mt/aviation")],
  ["P4-", simple("Aruba", "AW", "Department of Civil Aviation Aruba", "https://www.dca.aw/")],
  ["HB-", simple("Switzerland", "CH", "FOCA Swiss Aircraft Register", "https://www.aircraft-register.ch/", true)],
  ["D-", simple("Germany", "DE", "Luftfahrt-Bundesamt", "https://www.lba.de/")],
  ["F-", simple("France", "FR", "DGAC", "https://immat.aviation-civile.gouv.fr/immat/servlet/aeronef_liste.html", true)],
  ["OE-", simple("Austria", "AT", "Austro Control", "https://www.austrocontrol.at/")],
  ["LX-", simple("Luxembourg", "LU", "Direction de l'Aviation Civile", "https://dac.gouvernement.lu/")],
  ["PH-", simple("Netherlands", "NL", "ILT Dutch Aircraft Register", "https://www.ilent.nl/", true)],
  ["OO-", simple("Belgium", "BE", "BCAA", "https://mobilit.belgium.be/")],
  ["EI-", simple("Ireland", "IE", "Irish Aviation Authority", "https://www.iaa.ie/general-aviation/aircraft-registration")],
  ["CS-", simple("Portugal", "PT", "ANAC Portugal", "https://www.anac.pt/")],
  ["EC-", simple("Spain", "ES", "AESA", "https://www.seguridadaerea.gob.es/")],
  ["I-", simple("Italy", "IT", "ENAC", "https://www.enac.gov.it/")],
  ["SE-", simple("Sweden", "SE", "Transportstyrelsen", "https://www.transportstyrelsen.se/", true)],
  ["OY-", simple("Denmark", "DK", "Trafikstyrelsen", "https://www.trafikstyrelsen.dk/")],
  ["LN-", simple("Norway", "NO", "Luftfartstilsynet", "https://luftfartstilsynet.no/")],
  ["OH-", simple("Finland", "FI", "Traficom", "https://www.traficom.fi/")],
  ["SP-", simple("Poland", "PL", "ULC", "https://www.ulc.gov.pl/")],
  ["OK-", simple("Czech Republic", "CZ", "Civil Aviation Authority CZ", "https://www.caa.cz/")],
  ["OM-", simple("Slovakia", "SK", "Dopravný úrad", "https://letectvo.nsat.sk/")],
  ["HA-", simple("Hungary", "HU", "Nemzeti Közlekedési Hatóság", "https://www.nkh.gov.hu/")],
  ["YR-", simple("Romania", "RO", "Romanian CAA", "https://www.caa.ro/")],
  ["LZ-", simple("Bulgaria", "BG", "Bulgarian CAA", "https://www.caa.bg/")],
  ["SX-", simple("Greece", "GR", "Hellenic CAA", "https://www.hcaa.gr/")],
  ["TC-", simple("Türkiye", "TR", "DGCA Türkiye", "https://web.shgm.gov.tr/")],
  ["4X-", simple("Israel", "IL", "Israel CAA", "https://www.gov.il/en/departments/civil_aviation_authority")],
  ["A6-", simple("United Arab Emirates", "AE", "UAE GCAA", "https://www.gcaa.gov.ae/")],
  ["A7-", simple("Qatar", "QA", "Qatar CAA", "https://www.caa.gov.qa/")],
  ["A9C", simple("Bahrain", "BH", "Bahrain CAA", "https://www.bahrainairport.bh/")],
  ["HZ-", simple("Saudi Arabia", "SA", "GACA", "https://gaca.gov.sa/")],
  ["9K-", simple("Kuwait", "KW", "DGCA Kuwait", "https://www.dgca.gov.kw/")],
  ["A4O", simple("Oman", "OM", "Oman CAA", "https://www.caa.gov.om/")],
  ["VT-", simple("India", "IN", "DGCA India", "https://www.dgca.gov.in/", true)],
  ["B-", simple("China / Hong Kong / Taiwan", "CN", "CAAC / HKCAD", "https://www.caac.gov.cn/")],
  ["JA", simple("Japan", "JP", "JCAB", "https://www.mlit.go.jp/koku/")],
  ["HL", simple("South Korea", "KR", "MOLIT", "https://www.molit.go.kr/")],
  ["VH-", simple("Australia", "AU", "CASA Aircraft Register", "https://www.casa.gov.au/aircraft-register", true)],
  ["ZK-", simple("New Zealand", "NZ", "CAA New Zealand", "https://www.aviation.govt.nz/aircraft/aircraft-registration/", true)],
  ["ZS-", simple("South Africa", "ZA", "SACAA", "https://www.caa.co.za/")],
  ["5N-", simple("Nigeria", "NG", "NCAA", "https://ncaa.gov.ng/")],
  ["SU-", simple("Egypt", "EG", "ECAA", "https://www.civilaviation.gov.eg/")],
  ["XA-", simple("Mexico", "MX", "AFAC", "https://www.gob.mx/afac")],
  ["XB-", simple("Mexico", "MX", "AFAC", "https://www.gob.mx/afac")],
  ["PP-", simple("Brazil", "BR", "ANAC Brazil RAB", "https://sistemas.anac.gov.br/aeronaves/cons_rab.asp", true)],
  ["PR-", simple("Brazil", "BR", "ANAC Brazil RAB", "https://sistemas.anac.gov.br/aeronaves/cons_rab.asp", true)],
  ["PS-", simple("Brazil", "BR", "ANAC Brazil RAB", "https://sistemas.anac.gov.br/aeronaves/cons_rab.asp", true)],
  ["PT-", simple("Brazil", "BR", "ANAC Brazil RAB", "https://sistemas.anac.gov.br/aeronaves/cons_rab.asp", true)],
  ["PU-", simple("Brazil", "BR", "ANAC Brazil RAB", "https://sistemas.anac.gov.br/aeronaves/cons_rab.asp", true)],
  ["LV-", simple("Argentina", "AR", "ANAC Argentina", "https://www.argentina.gob.ar/anac")],
  ["CC-", simple("Chile", "CL", "DGAC Chile", "https://www.dgac.gob.cl/")],
  ["HK-", simple("Colombia", "CO", "Aerocivil", "https://www.aerocivil.gov.co/")],
  ["YV", simple("Venezuela", "VE", "INAC", "http://www.inac.gob.ve/")],
  ["RA-", simple("Russia", "RU", "Rosaviatsia", "https://favt.gov.ru/")],
  ["UR-", simple("Ukraine", "UA", "State Aviation Administration", "https://avia.gov.ua/")],
  ["4K-", simple("Azerbaijan", "AZ", "AZAL / SCAA", "https://www.caa.gov.az/")],
  ["UP-", simple("Kazakhstan", "KZ", "Aviation Administration of Kazakhstan", "https://caa.gov.kz/")],
  ["9V-", simple("Singapore", "SG", "CAAS", "https://www.caas.gov.sg/")],
  ["V8-", simple("Brunei", "BN", "DCA Brunei", "https://www.civil-aviation.gov.bn/")],
  ["T-7", simple("San Marino", "SM", "San Marino Aircraft Registry", "https://www.aviation.sm/")],
];

/** Uppercase, trim and strip stray whitespace. Hyphens are preserved. */
export function normalizeRegistration(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const reg = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (reg.length < 2 || reg.length > 12) return null;
  if (!/^[A-Z0-9-]+$/.test(reg)) return null;
  return reg;
}

/** Loose validity check used to decide whether a search term is a tail number. */
export function looksLikeRegistration(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,10}$/.test(v)) return false;
  if (/^N\d/.test(v)) return true;
  if (/^[A-Z]{1,2}-[A-Z0-9]{3,5}$/.test(v)) return true;
  if (/^\d[A-Z]-[A-Z]{3}$/.test(v)) return true;
  return /^[A-Z]{1,2}\d/.test(v);
}

export function registryFor(registration: string): RegistryInfo | null {
  const reg = normalizeRegistration(registration);
  if (!reg) return null;
  const sorted = [...PREFIXES].sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, info] of sorted) {
    if (reg.startsWith(prefix)) return info;
  }
  return null;
}

export function isUsRegistration(registration: string): boolean {
  const reg = normalizeRegistration(registration);
  return !!reg && /^N\d/.test(reg);
}

/** ICAO 24-bit address sanity check. */
export function normalizeIcao24(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hex = raw.trim().toLowerCase().replace(/^0x/, "").replace(/[^0-9a-f]/g, "");
  if (hex.length !== 6) return null;
  return hex;
}
