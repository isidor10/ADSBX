/**
 * Provera kalkulatora.
 *
 * Ne zove model — proverava aritmetiku, temporalno čitanje parametara i to da
 * svaki obračun nosi pravni osnov. Pokretanje: npm run verify:kalkulatori
 */

import {
  obracunAmortizacije,
  obracunBrutoUNeto,
  obracunLicneZarade,
  obracunNetoUBruto,
  obracunPausalca,
  obracunPDV,
  obracunPorezaNaDobit,
  obracunPorezaPoOdbitku,
  obracunSluzbenogPuta,
  obracunTroskaZaposlenog,
  obracunTroskaAutomobila,
  uporediPravneForme,
} from "../src/lib/calc";
import { srpskiBroj } from "../src/lib/legal/normalize";

let prosli = 0;
let pali = 0;

function tvrdi(uslov: boolean, opis: string, detalj?: string) {
  if (uslov) {
    prosli++;
    console.log(`  ✓ ${opis}`);
  } else {
    pali++;
    console.log(`  ✗ ${opis}${detalj ? ` — ${detalj}` : ""}`);
  }
}

function blizu(a: number, b: number, tolerancija = 0.02): boolean {
  return Math.abs(a - b) <= tolerancija;
}

const DATUM = new Date("2026-08-12T00:00:00.000Z");

async function main() {
  console.log("\nProvera kalkulatora\n");

  // ── PDV ───────────────────────────────────────────────────────────────────
  console.log("PDV:");
  const pdv = await obracunPDV({
    iznos: 100_000,
    stopa: "opsta",
    smer: "na_osnovicu",
    datum: DATUM,
  });
  tvrdi(blizu(pdv.rezultat.pdv, 20_000), "20% na 100.000 = 20.000 RSD",
    `dobijeno ${srpskiBroj(pdv.rezultat.pdv)}`);
  tvrdi(blizu(pdv.rezultat.ukupno, 120_000), "ukupno sa PDV = 120.000 RSD");
  tvrdi(pdv.koriscenParametri.length > 0, "obračun nosi pravni osnov");
  tvrdi(
    pdv.koriscenParametri.some((p) => p.clan?.includes("23")),
    "stopa je vezana za član 23 ZPDV",
  );

  const pdvIz = await obracunPDV({
    iznos: 120_000,
    stopa: "opsta",
    smer: "iz_bruto",
    datum: DATUM,
  });
  tvrdi(blizu(pdvIz.rezultat.osnovica, 100_000), "iz bruto 120.000 → osnovica 100.000");
  tvrdi(blizu(pdvIz.rezultat.pdv, 20_000), "iz bruto 120.000 → PDV 20.000");

  // ── Zarade ────────────────────────────────────────────────────────────────
  console.log("\nZarade:");
  const bruto = 100_000;
  const z = await obracunBrutoUNeto({ bruto, datum: DATUM });

  // Kontrolni obračun: (100.000 − 34.221) × 10% = 6.577,90 poreza
  //                    100.000 × 19,90% = 19.900 doprinosa zaposlenog
  //                    neto = 100.000 − 6.577,90 − 19.900 = 73.522,10
  tvrdi(blizu(z.rezultat.porez, 6_577.9, 0.05), "porez na 100.000 bruto = 6.577,90",
    `dobijeno ${srpskiBroj(z.rezultat.porez)}`);
  tvrdi(blizu(z.rezultat.doprinosiZaposleni, 19_900, 0.05),
    "doprinosi zaposlenog (19,90%) = 19.900",
    `dobijeno ${srpskiBroj(z.rezultat.doprinosiZaposleni)}`);
  tvrdi(blizu(z.rezultat.neto, 73_522.1, 0.05), "neto = 73.522,10",
    `dobijeno ${srpskiBroj(z.rezultat.neto)}`);
  tvrdi(blizu(z.rezultat.doprinosiPoslodavac, 15_150, 0.05),
    "doprinosi poslodavca (15,15%) = 15.150");
  tvrdi(blizu(z.rezultat.bruto2, 115_150, 0.05), "bruto 2 = 115.150");
  tvrdi(z.koraci.length >= 9, "prikazani su svi koraci obračuna");
  tvrdi(
    z.koraci.every((k) => k.formula.length > 0 && k.izracun.length > 0),
    "svaki korak ima i formulu i obračun",
  );

  // Neto → bruto mora da bude tačan inverz bruto → neto.
  const nb = await obracunNetoUBruto({ neto: z.rezultat.neto, datum: DATUM });
  tvrdi(
    blizu(nb.rezultat.bruto1, bruto, 1),
    "neto → bruto je inverz od bruto → neto",
    `polazni bruto ${srpskiBroj(bruto)}, vraćeno ${srpskiBroj(nb.rezultat.bruto1)}`,
  );

  // Ograničenje najnižom osnovicom mora da se aktivira ispod praga.
  const niska = await obracunBrutoUNeto({ bruto: 30_000, datum: DATUM });
  tvrdi(
    blizu(niska.rezultat.osnovicaDoprinosa, 51_297, 1),
    "ispod najniže osnovice doprinosi se računaju na 51.297",
    `dobijeno ${srpskiBroj(niska.rezultat.osnovicaDoprinosa)}`,
  );
  tvrdi(
    niska.napomene.some((n) => n.includes("najniže mesečne osnovice")),
    "korisnik je upozoren na primenu najniže osnovice",
  );

  // Ograničenje najvišom osnovicom.
  const visoka = await obracunBrutoUNeto({ bruto: 1_000_000, datum: DATUM });
  tvrdi(
    blizu(visoka.rezultat.osnovicaDoprinosa, 732_820, 1),
    "iznad najviše osnovice doprinosi se računaju na 732.820",
  );

  // ── Temporalno čitanje ────────────────────────────────────────────────────
  console.log("\nTemporalna ispravnost:");
  const zStari = await obracunBrutoUNeto({
    bruto: 100_000,
    datum: new Date("2025-06-15T00:00:00.000Z"),
  });
  const neoporeziviSad = z.koriscenParametri.find(
    (p) => p.kljuc === "zarada.neoporezivi_iznos",
  );
  const neoporeziviPre = zStari.koriscenParametri.find(
    (p) => p.kljuc === "zarada.neoporezivi_iznos",
  );
  tvrdi(
    neoporeziviSad?.vrednost === "34221",
    "za 2026. koristi neoporezivi iznos 34.221",
    `dobijeno ${neoporeziviSad?.vrednost}`,
  );
  tvrdi(
    neoporeziviPre?.vrednost === "28423",
    "za 2025. koristi tada važeći iznos 28.423 (ne današnji)",
    `dobijeno ${neoporeziviPre?.vrednost}`,
  );
  tvrdi(
    zStari.rezultat.porez !== z.rezultat.porez,
    "obračun za raniji period daje drugačiji rezultat",
  );

  // ── Ostali kalkulatori ────────────────────────────────────────────────────
  console.log("\nOstali obračuni:");
  const dobit = await obracunPorezaNaDobit({
    oporezivaDobit: 1_000_000,
    datum: DATUM,
  });
  tvrdi(blizu(dobit.rezultat.porez, 150_000), "porez na dobit 15% od 1.000.000 = 150.000");

  const odbitak = await obracunPorezaPoOdbitku({ bruto: 100_000, datum: DATUM });
  tvrdi(blizu(odbitak.rezultat.porez, 20_000), "porez po odbitku 20% = 20.000");

  const odbitakUgovor = await obracunPorezaPoOdbitku({
    bruto: 100_000,
    stopaUgovora: 10,
    datum: DATUM,
  });
  tvrdi(blizu(odbitakUgovor.rezultat.porez, 10_000), "snižena stopa iz UIDO 10% = 10.000");

  const pausal = await obracunPausalca({
    mesecniPausalniPrihod: 60_000,
    godisnjiPromet: 7_000_000,
    datum: DATUM,
  });
  tvrdi(
    pausal.napomene.some((n) => n.includes("UPOZORENJE")),
    "prekoračen limit paušala pokreće upozorenje",
  );

  const amort = await obracunAmortizacije({
    nabavnaVrednost: 1_000_000,
    grupa: 3,
    brojGodina: 2,
    datum: DATUM,
  });
  tvrdi(blizu(amort.koraci[2].rezultat, 150_000), "III grupa, prva godina 15% = 150.000");
  tvrdi(blizu(amort.koraci[3].rezultat, 127_500),
    "druga godina degresivno: 850.000 × 15% = 127.500");

  const put = await obracunSluzbenogPuta({ brojDana: 3, datum: DATUM });
  tvrdi(blizu(put.rezultat.ukupnoDnevnice, 10_413), "3 dnevnice × 3.471 = 10.413");
  tvrdi(blizu(put.rezultat.oporezivo, 0), "dnevnica u neoporezivom iznosu → nema poreza");

  const putVeca = await obracunSluzbenogPuta({
    brojDana: 2,
    dnevnicaPoDanu: 5_000,
    datum: DATUM,
  });
  tvrdi(blizu(putVeca.rezultat.oporezivo, 3_058),
    "isplata iznad neoporezivog: 2 × (5.000 − 3.471) = 3.058");

  // Parametar koji namerno nije potvrđen mora da prijavi nedostatak,
  // a ne da tiho izračuna nulu.
  const putKm = await obracunSluzbenogPuta({
    brojDana: 1,
    predjeniKm: 100,
    datum: DATUM,
  });
  tvrdi(
    putKm.napomene.some((n) => n.includes("NIJE obračunata")),
    "nepotvrđen parametar se prijavljuje umesto da se računa sa nulom",
  );

  const auto = await obracunTroskaAutomobila({
    nabavnaVrednost: 5_000_000,
    pdvObveznik: true,
    koriscenjeIskljucivoPoslovno: false,
    datum: DATUM,
  });
  tvrdi(blizu(auto.rezultat.odbitakPDV, 0),
    "putnički automobil: nema odbitka prethodnog poreza ni za PDV obveznika");
  tvrdi(
    auto.napomene.some((n) => n.includes("privatne svrhe")),
    "privatno korišćenje pokreće upozorenje o primanju zaposlenog",
  );

  const trosak = await obracunTroskaZaposlenog({
    bruto: 100_000,
    brojMeseci: 12,
    mesecniPrevoz: 5_782,
    datum: DATUM,
  });
  tvrdi(
    blizu(trosak.rezultat.godisnjiTrosak, (115_150 + 5_782) * 12, 1),
    "godišnji trošak zaposlenog uključuje prevoz",
  );

  const licna = await obracunLicneZarade({ licnaZarada: 100_000, datum: DATUM });
  tvrdi(blizu(licna.rezultat.neto, 73_522.1, 0.05),
    "lična zarada se oporezuje kao zarada");

  const poredjenje = await uporediPravneForme({
    godisnjiPrihod: 5_000_000,
    godisnjiTroskovi: 1_000_000,
    mesecniPausalniPrihod: 60_000,
    datum: DATUM,
  });
  tvrdi(poredjenje.rezultat.dooPorezNaDobit > 0, "poređenje pravnih formi daje rezultat");
  tvrdi(
    poredjenje.napomene.some((n) => n.includes("ORIJENTACIONO")),
    "poređenje je jasno označeno kao orijentaciono",
  );

  // ── Pravni osnov uz svaki obračun ─────────────────────────────────────────
  console.log("\nPravni osnov:");
  const svi = [pdv, z, dobit, odbitak, pausal, amort, put, auto, licna];
  tvrdi(
    svi.every((r) => r.koriscenParametri.length > 0),
    "svaki obračun navodi parametre sa izvorom",
  );
  tvrdi(
    svi.every((r) => r.koriscenParametri.every((p) => p.izvorUrl.startsWith("http"))),
    "svaki parametar ima klikabilan izvor",
  );
  tvrdi(
    svi.every((r) => r.napomene.length > 0),
    "svaki obračun nosi napomene o ograničenjima",
  );

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Prošlo: ${prosli}   Palo: ${pali}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(pali > 0 ? 1 : 0);
}

main().catch((g) => {
  console.error("Greška:", g);
  process.exit(1);
});
