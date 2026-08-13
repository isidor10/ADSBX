/**
 * Poreski parametri sa temporalnim važenjem.
 *
 * Kalkulatori čitaju isključivo odavde. Zato promena stope znači izmenu reda u
 * bazi, a ne izmenu koda, i zato pitanje "koliko je bilo 2024?" radi bez
 * grananja u obračunu.
 *
 * Svaka vrednost nosi izvor i status verifikacije. Ono što nije provereno
 * prema izvoru u ovoj sesiji nosi NEPOTVRDJENO i UI to prikazuje uz rezultat.
 */

export interface SeedParametar {
  kljuc: string;
  naziv: string;
  vrednost: string;
  jedinica:
    | "PROCENAT"
    | "RSD"
    | "EUR"
    | "DANA"
    | "CASOVA"
    | "MESECI"
    | "GODINA"
    | "KOEFICIJENT";
  vaziOd: string;
  vaziDo?: string;
  propis?: string;
  /** "clan" ili "clan|stav" — vezuje parametar za odredbu radi pravnog osnova. */
  odredba?: string;
  izvorUrl: string;
  napomena?: string;
  verifikacija: "POTVRDJENO" | "DELIMICNO" | "NEPOTVRDJENO";
}

const PDV_URL =
  "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dodatu-vrednost.html";
const DOBIT_URL =
  "https://www.paragraf.rs/propisi/zakon_o_porezu_na_dobit_pravnih_lica.html";
const DOPRINOSI_URL =
  "https://purs.gov.rs/upload/media/2025/12/15/760519/Zakon_o_doprinosima_za_obavezno_socijalno_osiguranje_-_u_primeni_od_01012026.pdf";
const NEOPOREZIVI_URL =
  "https://www.paragraf.rs/statistika/pregled_uskladjenih_neoporezivih_iznosa_po_zakonu_o_porezu_na_dohodak_gradjana.html";
const RAD_URL = "https://www.paragraf.rs/propisi/zakon_o_radu.html";

export const PARAMETRI: SeedParametar[] = [
  // ── PDV ───────────────────────────────────────────────────────────────────
  {
    kljuc: "pdv.opsta_stopa",
    naziv: "Opšta stopa PDV",
    vrednost: "20",
    jedinica: "PROCENAT",
    vaziOd: "2013-01-01",
    propis: "ZPDV",
    odredba: "23|1",
    izvorUrl: PDV_URL,
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "pdv.posebna_stopa",
    naziv: "Posebna (snižena) stopa PDV",
    vrednost: "10",
    jedinica: "PROCENAT",
    vaziOd: "2013-01-01",
    propis: "ZPDV",
    odredba: "23|2",
    izvorUrl: PDV_URL,
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "pdv.prag_evidentiranja",
    naziv: "Prag ukupnog prometa za obavezno evidentiranje u sistem PDV",
    vrednost: "8000000",
    jedinica: "RSD",
    vaziOd: "2017-01-01",
    propis: "ZPDV",
    odredba: "33",
    izvorUrl: "https://www.paragraf.rs/propisi/clanovi/clan-33-zakona-o-pdv.html",
    napomena: "Posmatra se ukupan promet u prethodnih 12 meseci.",
    verifikacija: "POTVRDJENO",
  },

  // ── Zarade ────────────────────────────────────────────────────────────────
  {
    kljuc: "zarada.neoporezivi_iznos",
    naziv: "Neoporezivi iznos zarade (mesečno)",
    vrednost: "34221",
    jedinica: "RSD",
    vaziOd: "2026-02-01",
    vaziDo: "2027-02-01",
    propis: "ZPDG",
    odredba: "15a",
    izvorUrl: NEOPOREZIVI_URL,
    napomena:
      'Uvećan Zakonom o izmenama i dopunama ZPDG, „Sl. glasnik RS" br. 109/2025. Usklađuje se jednom godišnje.',
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "zarada.neoporezivi_iznos",
    naziv: "Neoporezivi iznos zarade (mesečno) — prethodni period",
    vrednost: "28423",
    jedinica: "RSD",
    vaziOd: "2024-02-01",
    vaziDo: "2026-02-01",
    propis: "ZPDG",
    odredba: "15a",
    izvorUrl: NEOPOREZIVI_URL,
    napomena:
      "Istorijska vrednost — služi za obračune za ranije periode. Tačan datum početka primene proveriti kroz ingest.",
    verifikacija: "NEPOTVRDJENO",
  },
  {
    kljuc: "zarada.stopa_poreza",
    naziv: "Stopa poreza na zarade",
    vrednost: "10",
    jedinica: "PROCENAT",
    vaziOd: "2007-01-01",
    propis: "ZPDG",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dohodak-gradjana.html",
    napomena:
      "Stopa je proverena prema više izvora; broj člana kojim je propisana nije potvrđen u ovoj verziji baze.",
    verifikacija: "DELIMICNO",
  },

  // ── Doprinosi ─────────────────────────────────────────────────────────────
  {
    kljuc: "doprinosi.pio.ukupno",
    naziv: "Doprinos za PIO — ukupna stopa",
    vrednost: "24",
    jedinica: "PROCENAT",
    vaziOd: "2020-01-01",
    propis: "ZDOSO",
    odredba: "44",
    izvorUrl: DOPRINOSI_URL,
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "doprinosi.pio.zaposleni",
    naziv: "Doprinos za PIO — na teret zaposlenog",
    vrednost: "14",
    jedinica: "PROCENAT",
    vaziOd: "2020-01-01",
    propis: "ZDOSO",
    odredba: "44",
    izvorUrl: DOPRINOSI_URL,
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "doprinosi.pio.poslodavac",
    naziv: "Doprinos za PIO — na teret poslodavca",
    vrednost: "10",
    jedinica: "PROCENAT",
    vaziOd: "2020-01-01",
    propis: "ZDOSO",
    odredba: "44",
    izvorUrl: DOPRINOSI_URL,
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "doprinosi.zdravstvo.ukupno",
    naziv: "Doprinos za zdravstveno osiguranje — ukupna stopa",
    vrednost: "10.30",
    jedinica: "PROCENAT",
    vaziOd: "2020-01-01",
    propis: "ZDOSO",
    odredba: "44",
    izvorUrl: DOPRINOSI_URL,
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "doprinosi.zdravstvo.zaposleni",
    naziv: "Doprinos za zdravstvo — na teret zaposlenog",
    vrednost: "5.15",
    jedinica: "PROCENAT",
    vaziOd: "2020-01-01",
    propis: "ZDOSO",
    odredba: "44",
    izvorUrl: DOPRINOSI_URL,
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "doprinosi.zdravstvo.poslodavac",
    naziv: "Doprinos za zdravstvo — na teret poslodavca",
    vrednost: "5.15",
    jedinica: "PROCENAT",
    vaziOd: "2020-01-01",
    propis: "ZDOSO",
    odredba: "44",
    izvorUrl: DOPRINOSI_URL,
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "doprinosi.nezaposlenost.zaposleni",
    naziv: "Doprinos za osiguranje za slučaj nezaposlenosti",
    vrednost: "0.75",
    jedinica: "PROCENAT",
    vaziOd: "2020-01-01",
    propis: "ZDOSO",
    odredba: "44",
    izvorUrl: DOPRINOSI_URL,
    napomena: "Plaća se na teret zaposlenog.",
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "doprinosi.najniza_osnovica",
    naziv: "Najniža mesečna osnovica doprinosa",
    vrednost: "51297",
    jedinica: "RSD",
    vaziOd: "2026-01-01",
    vaziDo: "2027-01-01",
    propis: "ZDOSO",
    izvorUrl:
      "https://ipc.rs/vest/najniza-mesecna-osnovica-za-placanje-doprinosa-za-2026-godinu-iznosi-51297-dinara_v2386",
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "doprinosi.najvisa_osnovica",
    naziv: "Najviša mesečna osnovica doprinosa",
    vrednost: "732820",
    jedinica: "RSD",
    vaziOd: "2026-01-01",
    vaziDo: "2027-01-01",
    propis: "ZDOSO",
    izvorUrl:
      "https://www.paragraf.rs/propisi/iznos-najvise-mesecne-osnovice-doprinosa-za-obavezno-socijalno-osiguranje-za-2026-godinu.html",
    verifikacija: "POTVRDJENO",
  },
  // Istorijske vrednosti — bez njih obračun za raniji period ne bi bio moguć
  // (sistem bi ispravno odbio da računa, ali korisniku to ne pomaže).
  {
    kljuc: "doprinosi.najniza_osnovica",
    naziv: "Najniža mesečna osnovica doprinosa — 2025. godina",
    vrednost: "45950",
    jedinica: "RSD",
    vaziOd: "2025-01-01",
    vaziDo: "2026-01-01",
    propis: "ZDOSO",
    izvorUrl:
      "https://www.ipc.rs/vest/najvisa-mesecna-osnovica-za-placanje-doprinosa-za-2026-godinu-iznosi-732820-dinara_v2387",
    napomena: "Istorijska vrednost, za obračune koji se odnose na 2025. godinu.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "doprinosi.najvisa_osnovica",
    naziv: "Najviša mesečna osnovica doprinosa — 2025. godina",
    vrednost: "656425",
    jedinica: "RSD",
    vaziOd: "2025-01-01",
    vaziDo: "2026-01-01",
    propis: "ZDOSO",
    izvorUrl:
      "https://www.ipc.rs/vest/najvisa-mesecna-osnovica-za-placanje-doprinosa-za-2026-godinu-iznosi-732820-dinara_v2387",
    napomena: "Istorijska vrednost, za obračune koji se odnose na 2025. godinu.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "doprinosi.najvisa_godisnja_osnovica",
    naziv: "Najviša godišnja osnovica doprinosa",
    vrednost: "8793840",
    jedinica: "RSD",
    vaziOd: "2026-01-01",
    vaziDo: "2027-01-01",
    propis: "ZDOSO",
    izvorUrl:
      "https://www.bizsrbija.rs/vesti/u-2026-najvisa-osnovica-za-socijalno-osiguranje-samostalaca-51297-dinara",
    verifikacija: "DELIMICNO",
  },

  // ── Minimalna zarada ──────────────────────────────────────────────────────
  {
    kljuc: "minimalna.cena_rada_po_casu",
    naziv: "Minimalna cena rada (neto) po radnom času",
    vrednost: "371",
    jedinica: "RSD",
    vaziOd: "2026-01-01",
    vaziDo: "2027-01-01",
    propis: "ODLUKA-MIN-CENA-RADA-2026",
    odredba: "1",
    izvorUrl:
      "https://ipc.rs/vest/minimalna-cena-rada-za-2026-godinu-iznosice-37100-dinar-neto-po-radnom-casu_v2346",
    verifikacija: "POTVRDJENO",
  },

  // ── Porez na dobit i po odbitku ───────────────────────────────────────────
  {
    kljuc: "dobit.stopa",
    naziv: "Stopa poreza na dobit pravnih lica",
    vrednost: "15",
    jedinica: "PROCENAT",
    vaziOd: "2013-01-01",
    propis: "ZPDPL",
    odredba: "39",
    izvorUrl: DOBIT_URL,
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "po_odbitku.stopa",
    naziv: "Stopa poreza po odbitku na prihode nerezidenata",
    vrednost: "20",
    jedinica: "PROCENAT",
    vaziOd: "2013-01-01",
    propis: "ZPDPL",
    odredba: "40",
    izvorUrl: DOBIT_URL,
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "po_odbitku.stopa_preferencijalne",
    naziv:
      "Stopa poreza po odbitku — jurisdikcije sa preferencijalnim poreskim sistemom",
    vrednost: "25",
    jedinica: "PROCENAT",
    vaziOd: "2013-01-01",
    propis: "ZPDPL",
    odredba: "40",
    izvorUrl: DOBIT_URL,
    verifikacija: "POTVRDJENO",
  },

  // ── Paušal ────────────────────────────────────────────────────────────────
  {
    kljuc: "pausal.limit_prihoda",
    naziv: "Limit godišnjeg prihoda za paušalno oporezivanje",
    vrednost: "6000000",
    jedinica: "RSD",
    vaziOd: "2020-01-01",
    propis: "ZPDG",
    odredba: "40",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dohodak-gradjana.html",
    napomena:
      "Limit se odnosi na promet u kalendarskoj godini. Razlikovati od praga od 8.000.000 RSD za ulazak u sistem PDV, koji se posmatra za bilo kojih 12 uzastopnih meseci.",
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "pausal.stopa_poreza",
    naziv: "Stopa poreza na paušalno utvrđen prihod",
    vrednost: "10",
    jedinica: "PROCENAT",
    vaziOd: "2020-01-01",
    propis: "ZPDG",
    odredba: "40",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dohodak-gradjana.html",
    napomena: "Broj člana kojim je stopa propisana nije potvrđen.",
    verifikacija: "DELIMICNO",
  },

  // ── Godišnji porez na dohodak ─────────────────────────────────────────────
  {
    kljuc: "godisnji.neoporezivi_iznos",
    naziv: "Neoporezivi iznos za godišnji porez na dohodak (dohodak iz 2025)",
    vrednost: "5439096",
    jedinica: "RSD",
    vaziOd: "2026-01-01",
    vaziDo: "2027-01-01",
    propis: "ZPDG",
    izvorUrl:
      "https://kpmg.com/rs/sr/analize-i-istrazivanja/poreske-vesti/2026/02/godisnji-porez-na-dohodak-gradjana-ostvaren-u-2025-godini.html",
    napomena:
      "Trostruki iznos prosečne godišnje zarade po zaposlenom isplaćene u 2025. godini.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "godisnji.prag_vise_stope",
    naziv: "Prag za primenu više stope godišnjeg poreza",
    vrednost: "10878192",
    jedinica: "RSD",
    vaziOd: "2026-01-01",
    vaziDo: "2027-01-01",
    propis: "ZPDG",
    izvorUrl:
      "https://kpmg.com/rs/sr/analize-i-istrazivanja/poreske-vesti/2026/02/godisnji-porez-na-dohodak-gradjana-ostvaren-u-2025-godini.html",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "godisnji.stopa_niza",
    naziv: "Niža stopa godišnjeg poreza na dohodak",
    vrednost: "10",
    jedinica: "PROCENAT",
    vaziOd: "2023-01-01",
    propis: "ZPDG",
    izvorUrl:
      "https://kpmg.com/rs/sr/analize-i-istrazivanja/poreske-vesti/2026/02/godisnji-porez-na-dohodak-gradjana-ostvaren-u-2025-godini.html",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "godisnji.stopa_visa",
    naziv: "Viša stopa godišnjeg poreza na dohodak",
    vrednost: "15",
    jedinica: "PROCENAT",
    vaziOd: "2023-01-01",
    propis: "ZPDG",
    izvorUrl:
      "https://kpmg.com/rs/sr/analize-i-istrazivanja/poreske-vesti/2026/02/godisnji-porez-na-dohodak-gradjana-ostvaren-u-2025-godini.html",
    verifikacija: "DELIMICNO",
  },

  // ── Amortizacija ──────────────────────────────────────────────────────────
  {
    kljuc: "amortizacija.grupa1.stopa",
    naziv: "Stopa poreske amortizacije — I amortizaciona grupa",
    vrednost: "2.5",
    jedinica: "PROCENAT",
    vaziOd: "2019-01-01",
    propis: "ZPDPL",
    odredba: "10b|3",
    izvorUrl:
      "https://www.paragraf.rs/propisi/pravilnik-o-poreskoj-amortizaciji.html",
    napomena: "Proporcionalna metoda, po sredstvu (nepokretnosti).",
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "amortizacija.grupa2.stopa",
    naziv: "Stopa poreske amortizacije — II amortizaciona grupa",
    vrednost: "10",
    jedinica: "PROCENAT",
    vaziOd: "2019-01-01",
    propis: "ZPDPL",
    odredba: "10b|3",
    izvorUrl:
      "https://www.paragraf.rs/propisi/pravilnik-o-poreskoj-amortizaciji.html",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "amortizacija.grupa3.stopa",
    naziv: "Stopa poreske amortizacije — III amortizaciona grupa",
    vrednost: "15",
    jedinica: "PROCENAT",
    vaziOd: "2019-01-01",
    propis: "ZPDPL",
    odredba: "10b|3",
    izvorUrl:
      "https://www.paragraf.rs/propisi/pravilnik-o-poreskoj-amortizaciji.html",
    napomena:
      "Razvrstavanje sredstva u grupu proveriti u pravilniku o razvrstavanju stalnih sredstava.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "amortizacija.grupa4.stopa",
    naziv: "Stopa poreske amortizacije — IV amortizaciona grupa",
    vrednost: "20",
    jedinica: "PROCENAT",
    vaziOd: "2019-01-01",
    propis: "ZPDPL",
    odredba: "10b|3",
    izvorUrl:
      "https://www.paragraf.rs/propisi/pravilnik-o-poreskoj-amortizaciji.html",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "amortizacija.grupa5.stopa",
    naziv: "Stopa poreske amortizacije — V amortizaciona grupa",
    vrednost: "30",
    jedinica: "PROCENAT",
    vaziOd: "2019-01-01",
    propis: "ZPDPL",
    odredba: "10b|3",
    izvorUrl:
      "https://www.paragraf.rs/propisi/pravilnik-o-poreskoj-amortizaciji.html",
    verifikacija: "DELIMICNO",
  },

  // ── Kapitalni dobitak ─────────────────────────────────────────────────────
  {
    kljuc: "kapitalni_dobitak.stopa",
    naziv: "Stopa poreza na kapitalni dobitak",
    vrednost: "15",
    jedinica: "PROCENAT",
    vaziOd: "2013-01-01",
    propis: "ZPDG",
    izvorUrl:
      "https://mnp.rs/porez-na-kapitalnu-dobit-od-prodaje-akcija-i-porez-na-dividendu/",
    napomena:
      "Stopa potvrđena prema više izvora; broj člana kojim je propisana nije potvrđen.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "dividenda.stopa",
    naziv: "Stopa poreza na dividendu (fizička lica)",
    vrednost: "15",
    jedinica: "PROCENAT",
    vaziOd: "2013-01-01",
    propis: "ZPDG",
    izvorUrl: "https://zuniclaw.com/porez-po-odbitku-u-srbiji/",
    napomena:
      "Obračunava se na bruto iznos dividende. Kod nerezidenata može se primeniti niža stopa iz ugovora o izbegavanju dvostrukog oporezivanja.",
    verifikacija: "DELIMICNO",
  },

  // ── PDV: poreski period i prijava ─────────────────────────────────────────
  {
    kljuc: "pdv.prag_tromesecnog_perioda",
    naziv:
      "Prag ukupnog prometa ispod kojeg je poreski period za PDV kalendarsko tromesečje",
    vrednost: "50000000",
    jedinica: "RSD",
    vaziOd: "2013-01-01",
    propis: "ZPDV",
    odredba: "48",
    izvorUrl:
      "https://www.purs.gov.rs/sr/odnosi-s-javnoscu/novosti/10384/izmenjen-rok-za-promenu-pdv-poreskog-perioda-.html",
    napomena: "Posmatra se ukupan promet u prethodnih 12 meseci.",
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "pdv.rok_prijave_dana",
    naziv: "Rok za podnošenje PDV prijave i plaćanje po isteku poreskog perioda",
    vrednost: "15",
    jedinica: "DANA",
    vaziOd: "2013-01-01",
    propis: "ZPDV",
    izvorUrl: "https://www.purs.gov.rs/",
    verifikacija: "DELIMICNO",
  },

  // ── Porez na dobit: reprezentacija, transferne cene, rok ──────────────────
  {
    kljuc: "reprezentacija.limit",
    naziv:
      "Limit priznavanja troškova reprezentacije (procenat ukupnog prihoda)",
    vrednost: "0.5",
    jedinica: "PROCENAT",
    vaziOd: "2019-01-01",
    propis: "ZPDPL",
    odredba: "15|6",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_porezu_na_dobit_pravnih_lica.html",
    napomena:
      "Troškovi reklame i propagande priznaju se bez ovog ograničenja, po opštim pravilima.",
    verifikacija: "POTVRDJENO",
  },
  {
    kljuc: "dobit.rok_prijave_dana",
    naziv:
      "Rok za podnošenje poreske prijave, poreskog bilansa i dokumentacije o transfernim cenama",
    vrednost: "180",
    jedinica: "DANA",
    vaziOd: "2013-01-01",
    propis: "ZPDPL",
    izvorUrl:
      "https://biznis.rs/preduzetnik/kompanije-mogu-da-budu-ostro-kaznjene-ako-ne-dostave-izvestaj-o-transfernim-cenama/",
    napomena: "Računa se od isteka poreskog perioda.",
    verifikacija: "DELIMICNO",
  },

  // ── Rad ───────────────────────────────────────────────────────────────────
  {
    kljuc: "godisnji_odmor.minimum_dana",
    naziv: "Zakonski minimum godišnjeg odmora (radnih dana)",
    vrednost: "20",
    jedinica: "DANA",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "69",
    izvorUrl: RAD_URL,
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "radno_vreme.puno_casova_nedeljno",
    naziv: "Puno radno vreme (časova nedeljno)",
    vrednost: "40",
    jedinica: "CASOVA",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "51",
    izvorUrl: RAD_URL,
    napomena:
      "Opštim aktom može biti kraće od 40, ali ne kraće od 36 časova nedeljno.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "prekovremeni.max_casova_nedeljno",
    naziv: "Najviše prekovremenog rada (časova nedeljno)",
    vrednost: "8",
    jedinica: "CASOVA",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "53",
    izvorUrl: RAD_URL,
    napomena:
      "Uz to, prekovremeni rad ne sme preći 12 časova dnevno uključujući i redovan rad.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "prekovremeni.uvecanje_min",
    naziv: "Najmanje uvećanje zarade za prekovremeni rad",
    vrednost: "26",
    jedinica: "PROCENAT",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "108",
    izvorUrl: RAD_URL,
    napomena:
      "Ako se istovremeno stiče više osnova za uvećanje zarade, procenti se sabiraju.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "nocni_rad.uvecanje_min",
    naziv: "Najmanje uvećanje zarade za rad noću",
    vrednost: "26",
    jedinica: "PROCENAT",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "108",
    izvorUrl: RAD_URL,
    napomena:
      "Primenjuje se ako rad noću nije već vrednovan pri utvrđivanju osnovne zarade.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "rad_na_praznik.uvecanje_min",
    naziv: "Najmanje uvećanje zarade za rad na dan praznika koji je neradni dan",
    vrednost: "110",
    jedinica: "PROCENAT",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "108",
    izvorUrl: RAD_URL,
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "minuli_rad.uvecanje_po_godini",
    naziv:
      "Najmanje uvećanje zarade po osnovu minulog rada, za svaku punu godinu kod poslodavca",
    vrednost: "0.4",
    jedinica: "PROCENAT",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "108",
    izvorUrl: RAD_URL,
    napomena:
      "Računa se za godine rada ostvarene u radnom odnosu kod poslodavca, u skladu sa zakonom.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "bolovanje.procenat_do_30_dana",
    naziv:
      "Naknada zarade za privremenu sprečenost za rad do 30 dana (na teret poslodavca)",
    vrednost: "65",
    jedinica: "PROCENAT",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "115",
    izvorUrl: RAD_URL,
    napomena:
      "Osnovica je prosečna zarada u prethodnih 12 meseci; naknada ne može biti niža od minimalne zarade. Od 31. dana naknadu snosi RFZO.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "bolovanje.procenat_povreda_na_radu",
    naziv:
      "Naknada zarade za sprečenost prouzrokovanu povredom na radu ili profesionalnom bolešću",
    vrednost: "100",
    jedinica: "PROCENAT",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "115",
    izvorUrl: RAD_URL,
    napomena:
      "Kod povrede na radu i profesionalne bolesti naknadu snosi poslodavac za ceo period, a ne samo prvih 30 dana.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "otpremnina.penzija_prosecnih_zarada",
    naziv: "Otpremnina pri odlasku u penziju (broj prosečnih zarada u RS)",
    vrednost: "2",
    jedinica: "KOEFICIJENT",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "119|1",
    izvorUrl: RAD_URL,
    napomena:
      "Prema poslednjem objavljenom podatku republičkog organa nadležnog za statistiku. Do izmena iz 2014. minimum je bio tri prosečne zarade.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "otpremnina.tehnoloski_visak_deo_zarade",
    naziv:
      "Otpremnina za tehnološki višak — najmanji deo zarade po navršenoj godini rada kod poslodavca",
    vrednost: "0.3333",
    jedinica: "KOEFICIJENT",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "158",
    izvorUrl: RAD_URL,
    napomena:
      "Zakon propisuje trećinu zarade za svaku navršenu godinu rada u radnom odnosu kod poslodavca kod koga se ostvaruje pravo na otpremninu.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "probni_rad.max_meseci",
    naziv: "Najduže trajanje probnog rada (meseci)",
    vrednost: "6",
    jedinica: "MESECI",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "36",
    izvorUrl: RAD_URL,
    napomena:
      "Otkazni rok tokom probnog rada ne može biti kraći od pet radnih dana.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "ppp.max_radnih_dana_godisnje",
    naziv:
      "Najviše radnih dana po ugovoru o privremenim i povremenim poslovima (godišnje)",
    vrednost: "120",
    jedinica: "DANA",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "197",
    izvorUrl: RAD_URL,
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "zastarelost.potrazivanja_radni_odnos_godina",
    naziv: "Zastarelost novčanih potraživanja iz radnog odnosa (godina)",
    vrednost: "3",
    jedinica: "GODINA",
    vaziOd: "2014-07-29",
    propis: "ZOR",
    odredba: "196",
    izvorUrl: RAD_URL,
    napomena:
      "Rok teče od dana nastanka obaveze. Kod prestanka radnog odnosa poslodavac isplaćuje sva dugovanja u roku od 30 dana, pa rok počinje tek po isteku tog roka.",
    verifikacija: "DELIMICNO",
  },

  // ── Poreski postupak ──────────────────────────────────────────────────────
  {
    kljuc: "kamata.uvecanje_procentnih_poena",
    naziv:
      "Uvećanje referentne stope NBS za obračun kamate na neblagovremeno plaćene javne prihode",
    vrednost: "10",
    jedinica: "PROCENAT",
    vaziOd: "2013-01-01",
    propis: "ZPPPA",
    odredba: "75",
    izvorUrl:
      "https://www.kamata.rs/kamata-za-neplacene-i-neblagovremeno-placene-javne-prihode-zakonska-uredenost",
    napomena:
      "Kamatna stopa = godišnja referentna stopa NBS + 10 procentnih poena. Referentna stopa se menja — proveriti aktuelnu vrednost na sajtu NBS.",
    verifikacija: "POTVRDJENO",
  },

  // ── eFakture ──────────────────────────────────────────────────────────────
  {
    kljuc: "efaktura.rok_prihvatanja_dana",
    naziv: "Rok za prihvatanje ili odbijanje elektronske fakture",
    vrednost: "15",
    jedinica: "DANA",
    vaziOd: "2022-07-01",
    propis: "ZEF",
    izvorUrl:
      "https://www.paragraf.rs/kancelarko/obaveza-izdavanje-e-fakture-cesto-postavljana-pitanja.html",
    napomena:
      "Po isteku roka sledi ponovno obaveštenje; ako se ni tada ne postupi u roku od pet dana, faktura se smatra odbijenom.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "efaktura.rok_evidentiranja_pdv_dana",
    naziv: "Rok za elektronsko evidentiranje obračuna PDV u SEF-u",
    vrednost: "10",
    jedinica: "DANA",
    vaziOd: "2023-01-01",
    propis: "PRAVILNIK-EF",
    izvorUrl:
      "https://www.paragraf.rs/baza-znanja/knjigovodstvo/rokovi-evidentiranja-pdv-i-ispravke-evidentiranog-pdv-u-sef-popdv.html",
    napomena:
      "Računa se po isteku poreskog perioda; ako deseti dan pada u neradni dan, rok se pomera na prvi naredni radni dan.",
    verifikacija: "DELIMICNO",
  },

  // ── Imovina ───────────────────────────────────────────────────────────────
  {
    kljuc: "prenos_apsolutnih_prava.stopa",
    naziv: "Stopa poreza na prenos apsolutnih prava",
    vrednost: "2.5",
    jedinica: "PROCENAT",
    vaziOd: "2013-01-01",
    propis: "ZPI",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_porezima_na_imovinu.html",
    napomena:
      "Stopa je jedinstvena. Od 1.1.2025. porez utvrđuju i naplaćuju jedinice lokalne samouprave.",
    verifikacija: "DELIMICNO",
  },

  // ── Neoporezivi iznosi naknada ────────────────────────────────────────────
  {
    kljuc: "dnevnica.neoporezivi_iznos",
    naziv: "Neoporezivi iznos dnevnice za službeno putovanje u zemlji",
    vrednost: "3471",
    jedinica: "RSD",
    vaziOd: "2026-02-01",
    vaziDo: "2027-02-01",
    propis: "ZPDG",
    odredba: "18",
    izvorUrl:
      "https://www.paragraf.rs/dnevne-vesti/280126/280126-vest5.html",
    napomena:
      "Iznos iznad neoporezivog dela ima poreski tretman drugog primanja — obračunavaju se porez i doprinosi na razliku.",
    verifikacija: "DELIMICNO",
  },
  {
    kljuc: "prevoz.neoporezivi_iznos",
    naziv:
      "Neoporezivi iznos naknade troškova prevoza za dolazak i odlazak sa rada (mesečno)",
    vrednost: "5782",
    jedinica: "RSD",
    vaziOd: "2026-02-01",
    vaziDo: "2027-02-01",
    propis: "ZPDG",
    odredba: "18",
    izvorUrl:
      "https://www.paragraf.rs/dnevne-vesti/280126/280126-vest5.html",
    verifikacija: "DELIMICNO",
  },

  // NAPOMENA: parametar "sopstveni_auto.neoporezivi_po_km" namerno NIJE
  // seed-ovan. Neoporezivi iznos naknade za korišćenje sopstvenog automobila
  // vezan je za cenu goriva i mesečni limit, i nije potvrđen prema zvaničnom
  // izvoru u ovoj verziji baze. Umesto da obračun radi sa izmišljenom ili
  // nultom vrednošću, kalkulator prijavljuje da parametar nedostaje i upućuje
  // na dopunu baze. Popunjava se kroz „npm run ingest" ili admin panel.
];
