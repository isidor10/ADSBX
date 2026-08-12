/**
 * Početna pravna baza.
 *
 * Pravilo koje važi za svaki zapis ovde: ono što nije provereno prema izvoru
 * nosi verifikacija: "NEPOTVRDJENO" i potvrdjenBrojClana: false, i UI to
 * prikazuje korisniku. Radije prazno polje nego izmišljen broj člana.
 *
 * `ingest-propise.ts` popunjava doslovne tekstove i potvrđuje brojeve članova
 * kod korisnika, gde zvanični domeni nisu blokirani mrežnom politikom.
 */

export interface SeedPropis {
  skracenica: string;
  naziv: string;
  tip:
    | "ZAKON"
    | "PODZAKONSKI_AKT"
    | "UPUTSTVO"
    | "MISLJENJE"
    | "SUDSKA_PRAKSA";
  kategorija: string;
  donosilac?: string;
  sluzbeniGlasnik?: string[];
  izvorInstitucija: string;
  izvorUrl: string;
  prioritetIzvora: number;
  verifikacija: "POTVRDJENO" | "DELIMICNO" | "NEPOTVRDJENO";
  napomena?: string;
}

const PARAGRAF = "https://www.paragraf.rs/propisi";
const PIS = "https://www.pravno-informacioni-sistem.rs";

export const PROPISI: SeedPropis[] = [
  // ── Poreski propisi ───────────────────────────────────────────────────────
  {
    skracenica: "ZPDV",
    naziv: "Zakon o porezu na dodatu vrednost",
    tip: "ZAKON",
    kategorija: "PDV",
    donosilac: "Narodna skupština Republike Srbije",
    izvorInstitucija: "Paragraf Lex",
    izvorUrl: `${PARAGRAF}/zakon-o-porezu-na-dodatu-vrednost.html`,
    prioritetIzvora: 6,
    verifikacija: "DELIMICNO",
    napomena:
      "Ključne odredbe (stope, odbitak prethodnog poreza, mali obveznik) provereni. Pun tekst se dobija kroz ingest.",
  },
  {
    skracenica: "ZPDPL",
    naziv: "Zakon o porezu na dobit pravnih lica",
    tip: "ZAKON",
    kategorija: "DOBIT",
    donosilac: "Narodna skupština Republike Srbije",
    izvorInstitucija: "Paragraf Lex",
    izvorUrl: `${PARAGRAF}/zakon_o_porezu_na_dobit_pravnih_lica.html`,
    prioritetIzvora: 6,
    verifikacija: "DELIMICNO",
  },
  {
    skracenica: "ZPDG",
    naziv: "Zakon o porezu na dohodak građana",
    tip: "ZAKON",
    kategorija: "DOHODAK",
    donosilac: "Narodna skupština Republike Srbije",
    sluzbeniGlasnik: ["109/2025 (izmene i dopune)"],
    izvorInstitucija: "Paragraf Lex",
    izvorUrl: `${PARAGRAF}/zakon-o-porezu-na-dohodak-gradjana.html`,
    prioritetIzvora: 6,
    verifikacija: "DELIMICNO",
  },
  {
    skracenica: "ZPPPA",
    naziv: "Zakon o poreskom postupku i poreskoj administraciji",
    tip: "ZAKON",
    kategorija: "POSTUPAK",
    donosilac: "Narodna skupština Republike Srbije",
    izvorInstitucija: "Poreska uprava Republike Srbije",
    izvorUrl: "https://www.purs.gov.rs/",
    prioritetIzvora: 3,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    skracenica: "ZOA",
    naziv: "Zakon o akcizama",
    tip: "ZAKON",
    kategorija: "OSTALO",
    izvorInstitucija: "Paragraf Lex",
    izvorUrl: `${PARAGRAF}/zakon-o-akcizama.html`,
    prioritetIzvora: 6,
    verifikacija: "NEPOTVRDJENO",
  },

  // ── Doprinosi i rad ───────────────────────────────────────────────────────
  {
    skracenica: "ZDOSO",
    naziv: "Zakon o doprinosima za obavezno socijalno osiguranje",
    tip: "ZAKON",
    kategorija: "DOPRINOSI",
    donosilac: "Narodna skupština Republike Srbije",
    izvorInstitucija: "Poreska uprava Republike Srbije",
    izvorUrl:
      "https://purs.gov.rs/upload/media/2025/12/15/760519/Zakon_o_doprinosima_za_obavezno_socijalno_osiguranje_-_u_primeni_od_01012026.pdf",
    prioritetIzvora: 3,
    verifikacija: "DELIMICNO",
    napomena:
      "Poreska uprava objavila prečišćen tekst u primeni od 01.01.2026.",
  },
  {
    skracenica: "ZPIO",
    naziv: "Zakon o penzijskom i invalidskom osiguranju",
    tip: "ZAKON",
    kategorija: "DOPRINOSI",
    izvorInstitucija: "Paragraf Lex",
    izvorUrl: `${PARAGRAF}/zakon-o-penzijskom-i-invalidskom-osiguranju.html`,
    prioritetIzvora: 6,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    skracenica: "ZZO",
    naziv: "Zakon o zdravstvenom osiguranju",
    tip: "ZAKON",
    kategorija: "DOPRINOSI",
    izvorInstitucija: "RFZO",
    izvorUrl: "https://www.rfzo.rs/",
    prioritetIzvora: 4,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    skracenica: "ZOR",
    naziv: "Zakon o radu",
    tip: "ZAKON",
    kategorija: "RAD",
    izvorInstitucija: "Ministarstvo za rad, zapošljavanje, boračka i socijalna pitanja",
    izvorUrl: "https://www.minrzs.gov.rs/",
    prioritetIzvora: 4,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    skracenica: "ODLUKA-MIN-CENA-RADA-2026",
    naziv:
      "Odluka o visini minimalne cene rada za period januar–decembar 2026. godine",
    tip: "PODZAKONSKI_AKT",
    kategorija: "RAD",
    donosilac: "Vlada Republike Srbije",
    izvorInstitucija: "Ministarstvo finansija",
    izvorUrl:
      "https://www.mfin.gov.rs/sr/aktivnosti-1/mali-vlada-u-etvrtak-donosi-odluku-o-redovnom-poveanju-minimalne-zarade-na-551-evro-od-1-januara-2026-godine-1",
    prioritetIzvora: 2,
    verifikacija: "POTVRDJENO",
  },

  // ── Računovodstvo ─────────────────────────────────────────────────────────
  {
    skracenica: "ZOR-RAC",
    naziv: "Zakon o računovodstvu",
    tip: "ZAKON",
    kategorija: "RACUNOVODSTVO",
    izvorInstitucija: "Agencija za privredne registre",
    izvorUrl: "https://www.apr.gov.rs/",
    prioritetIzvora: 5,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    skracenica: "PRAVILNIK-AMORTIZACIJA",
    naziv:
      "Pravilnik o amortizaciji stalnih sredstava koja se priznaje za poreske svrhe",
    tip: "PODZAKONSKI_AKT",
    kategorija: "DOBIT",
    donosilac: "Ministar finansija",
    sluzbeniGlasnik: ['"Sl. glasnik RS", br. 93/19'],
    izvorInstitucija: "Paragraf Lex",
    izvorUrl: `${PARAGRAF}/pravilnik-o-poreskoj-amortizaciji.html`,
    prioritetIzvora: 6,
    verifikacija: "DELIMICNO",
  },
  {
    skracenica: "PRAVILNIK-RAZVRSTAVANJE-SREDSTAVA",
    naziv:
      "Pravilnik o načinu razvrstavanja stalnih sredstava po grupama i načinu utvrđivanja amortizacije za poreske svrhe",
    tip: "PODZAKONSKI_AKT",
    kategorija: "DOBIT",
    donosilac: "Ministar finansija",
    izvorInstitucija: "Paragraf Lex",
    izvorUrl: `${PARAGRAF}/pravilnik_o_nacinu_razvrstavanja_stalnih_sredstava_po_grupama_i_nacinu_utvrdjivanja_amortizacije_za_poreske_svrhe.html`,
    prioritetIzvora: 6,
    verifikacija: "DELIMICNO",
  },

  // ── Digitalno poslovanje ──────────────────────────────────────────────────
  {
    skracenica: "ZEF",
    naziv: "Zakon o elektronskom fakturisanju",
    tip: "ZAKON",
    kategorija: "EFAKTURE",
    izvorInstitucija: "Ministarstvo finansija — eFakture",
    izvorUrl: "https://www.efaktura.gov.rs/",
    prioritetIzvora: 5,
    verifikacija: "DELIMICNO",
  },
  {
    skracenica: "PRAVILNIK-EF",
    naziv: "Pravilnik o elektronskom fakturisanju",
    tip: "PODZAKONSKI_AKT",
    kategorija: "EFAKTURE",
    donosilac: "Ministar finansija",
    izvorInstitucija: "Ministarstvo finansija — eFakture",
    izvorUrl: "https://www.efaktura.gov.rs/",
    prioritetIzvora: 5,
    verifikacija: "DELIMICNO",
  },
  {
    skracenica: "ZOF",
    naziv: "Zakon o fiskalizaciji",
    tip: "ZAKON",
    kategorija: "FISKALIZACIJA",
    izvorInstitucija: "Poreska uprava Republike Srbije",
    izvorUrl: "https://www.purs.gov.rs/",
    prioritetIzvora: 3,
    verifikacija: "NEPOTVRDJENO",
  },

  // ── Dodatni propisi ───────────────────────────────────────────────────────
  {
    skracenica: "ZPD",
    naziv: "Zakon o privrednim društvima",
    tip: "ZAKON",
    kategorija: "PRIVREDA",
    izvorInstitucija: "Agencija za privredne registre",
    izvorUrl: "https://www.apr.gov.rs/",
    prioritetIzvora: 5,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    skracenica: "ZOO",
    naziv: "Zakon o obligacionim odnosima",
    tip: "ZAKON",
    kategorija: "OSTALO",
    izvorInstitucija: "Pravno-informacioni sistem RS",
    izvorUrl: PIS,
    prioritetIzvora: 1,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    skracenica: "ZZP",
    naziv: "Zakon o zaštiti potrošača",
    tip: "ZAKON",
    kategorija: "OSTALO",
    izvorInstitucija: "Pravno-informacioni sistem RS",
    izvorUrl: PIS,
    prioritetIzvora: 1,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    skracenica: "ZOT",
    naziv: "Zakon o trgovini",
    tip: "ZAKON",
    kategorija: "OSTALO",
    izvorInstitucija: "Pravno-informacioni sistem RS",
    izvorUrl: PIS,
    prioritetIzvora: 1,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    skracenica: "ZDP",
    naziv: "Zakon o deviznom poslovanju",
    tip: "ZAKON",
    kategorija: "DEVIZNO",
    izvorInstitucija: "Narodna banka Srbije",
    izvorUrl: "https://www.nbs.rs/",
    prioritetIzvora: 5,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    skracenica: "ZPI",
    naziv: "Zakon o porezima na imovinu",
    tip: "ZAKON",
    kategorija: "IMOVINA",
    izvorInstitucija: "Paragraf Lex",
    izvorUrl: `${PARAGRAF}/zakon-o-porezima-na-imovinu.html`,
    prioritetIzvora: 6,
    verifikacija: "NEPOTVRDJENO",
  },
];
