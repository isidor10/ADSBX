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
  jedinica: "PROCENAT" | "RSD" | "EUR" | "DANA" | "KOEFICIJENT";
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
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dohodak-gradjana.html",
    napomena:
      "NIJE potvrđeno prema zvaničnom izvoru u ovoj verziji baze — obavezno proveriti pre oslanjanja na obračun.",
    verifikacija: "NEPOTVRDJENO",
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
