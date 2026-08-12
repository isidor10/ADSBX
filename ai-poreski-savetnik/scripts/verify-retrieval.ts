/**
 * Provera RAG sloja i temporalne logike. Ne zove model.
 * Pokretanje: npm run verify:retrieval
 */

import {
  prepoznajCiljniDatum,
  prepoznajReferencuClana,
  normalizuj,
  tokenizuj,
  uLatinicu,
} from "../src/lib/legal/normalize";
import { pretraziPoClanu, pretraziPravnuBazu } from "../src/lib/legal/retrieval";
import { statusNaDatum } from "../src/lib/legal/temporal";

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

async function main() {
  console.log("\nProvera pretrage pravne baze\n");

  // ── Normalizacija srpskog ─────────────────────────────────────────────────
  console.log("Normalizacija:");
  tvrdi(uLatinicu("Закон о ПДВ") === "Zakon o PDV", "ćirilica → latinica");
  tvrdi(
    normalizuj("Пореска управа") === "poreska uprava",
    "ćirilica + dijakritika + mala slova",
  );
  tvrdi(normalizuj("paušalac") === "pausalac", "uklanja dijakritiku");
  tvrdi(
    tokenizuj("PDV", true).some((t) => t.includes("dodat")),
    "sinonimi: PDV → porez na dodatu vrednost",
  );

  // ── Prepoznavanje reference člana ─────────────────────────────────────────
  console.log("\nPrepoznavanje člana:");
  const r1 = prepoznajReferencuClana("Šta kaže član 29 Zakona o PDV?");
  tvrdi(r1?.clan === "29", "prepoznaje 'član 29'", `dobijeno ${r1?.clan}`);
  tvrdi(
    (r1?.propisTekst ?? "").toLowerCase().includes("pdv"),
    "prepoznaje naziv propisa uz član",
  );
  const r2 = prepoznajReferencuClana("čl. 28 stav 1");
  tvrdi(r2?.clan === "28" && r2?.stav === "1", "prepoznaje 'čl. 28 stav 1'");
  tvrdi(
    prepoznajReferencuClana("koliki je PDV na hleb") === null,
    "ne izmišlja član kad ga nema u pitanju",
  );

  // ── Temporalno prepoznavanje ──────────────────────────────────────────────
  console.log("\nTemporalni kontekst:");
  const danas = new Date("2026-08-12T00:00:00.000Z");
  tvrdi(
    prepoznajCiljniDatum("koliki je bio porez 2023?", danas).getUTCFullYear() === 2023,
    "'porez 2023' → 2023. godina",
  );
  tvrdi(
    prepoznajCiljniDatum("šta važi od 1. januara 2026?", danas)
      .toISOString()
      .startsWith("2026-01-01"),
    "'od 1. januara 2026' → 01.01.2026.",
  );
  tvrdi(
    prepoznajCiljniDatum("01.02.2026.", danas).toISOString().startsWith("2026-02-01"),
    "'01.02.2026.' → 01.02.2026.",
  );
  tvrdi(
    prepoznajCiljniDatum("koliki je PDV?", danas).getTime() === danas.getTime(),
    "bez datuma u pitanju → današnji datum",
  );

  // ── Status važenja ────────────────────────────────────────────────────────
  console.log("\nStatus važenja:");
  tvrdi(
    statusNaDatum(
      { vaziOd: new Date("2020-01-01"), vaziDo: null },
      danas,
    ) === "VAZI",
    "odredba bez roka važenja → VAŽI",
  );
  tvrdi(
    statusNaDatum(
      { vaziOd: new Date("2020-01-01"), vaziDo: new Date("2024-01-01") },
      danas,
    ) === "PRESTAO_DA_VAZI",
    "odredba sa isteklim rokom → PRESTAO DA VAŽI",
  );
  tvrdi(
    statusNaDatum(
      { vaziOd: new Date("2027-01-01"), vaziDo: null },
      danas,
    ) === "JOS_NIJE_STUPIO_NA_SNAGU",
    "buduća odredba → JOŠ NIJE STUPIO NA SNAGU",
  );
  tvrdi(
    statusNaDatum(
      { vaziOd: new Date("2020-01-01"), vaziDo: null, tipPropisa: "NACRT" },
      danas,
    ) === "NIJE_PROPIS",
    "nacrt → NIJE PROPIS",
  );

  // ── Stvarna pretraga ──────────────────────────────────────────────────────
  console.log("\nPretraga baze:");
  const auto = await pretraziPravnuBazu({
    upit: "da li mogu da odbijem PDV na putnički automobil",
    ciljniDatum: danas,
  });
  tvrdi(auto.length > 0, "pretraga vraća rezultate", `${auto.length} odredbi`);
  tvrdi(
    auto.some((o) => o.clan === "29"),
    "pitanje o odbitku PDV za automobil nalazi član 29 ZPDV",
    `nađeni članovi: ${auto.map((o) => `${o.propisSkracenica} ${o.clan}`).join(", ")}`,
  );

  const clanUpit = await pretraziPravnuBazu({
    upit: "šta kaže član 33 Zakona o PDV",
    ciljniDatum: danas,
  });
  tvrdi(
    clanUpit[0]?.clan === "33" && clanUpit[0]?.propisSkracenica === "ZPDV",
    "direktan upit za član vraća taj član na prvom mestu",
    `prvi rezultat: ${clanUpit[0]?.propisSkracenica} čl. ${clanUpit[0]?.clan}`,
  );

  const pausal = await pretraziPravnuBazu({
    upit: "koji je limit za paušalno oporezivanje preduzetnika",
    ciljniDatum: danas,
  });
  tvrdi(
    pausal.some((o) => o.propisSkracenica === "ZPDG"),
    "pitanje o paušalu nalazi Zakon o porezu na dohodak građana",
  );

  const poClanu = await pretraziPoClanu("29", "PDV");
  tvrdi(poClanu.length >= 2, "pretraga po članu vraća sve stavove člana 29");

  // ── Temporalno filtriranje u pretrazi ─────────────────────────────────────
  console.log("\nTemporalno filtriranje:");
  const neoporeziviSad = await pretraziPravnuBazu({
    upit: "neoporezivi iznos zarade",
    ciljniDatum: danas,
  });
  const naSnazi = neoporeziviSad.filter((o) => o.statusVazenja === "VAZI");
  tvrdi(naSnazi.length > 0, "na današnji datum postoje odredbe koje važe");
  tvrdi(
    neoporeziviSad.every((o) => o.statusVazenja !== "JOS_NIJE_STUPIO_NA_SNAGU"),
    "pretraga za današnji datum ne vraća odredbe koje još nisu na snazi",
  );

  const rano = await pretraziPravnuBazu({
    upit: "neoporezivi iznos zarade",
    ciljniDatum: new Date("2020-06-01T00:00:00.000Z"),
  });
  tvrdi(
    !rano.some(
      (o) => o.clan === "15a" && o.statusVazenja === "VAZI",
    ),
    "odredba iz 2026. se ne prikazuje kao važeća za 2020. godinu",
  );

  // ── Izvori i verifikacija ─────────────────────────────────────────────────
  console.log("\nIzvori:");
  tvrdi(
    auto.every((o) => o.izvorUrl.startsWith("http")),
    "svaka pronađena odredba ima izvor",
  );
  tvrdi(
    auto.every((o) => typeof o.potvrdjenBrojClana === "boolean"),
    "svaka odredba nosi oznaku da li je broj člana potvrđen",
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
