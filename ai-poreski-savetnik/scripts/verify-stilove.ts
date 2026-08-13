/**
 * Provera da stil ne dira pravni sadržaj i da se kod ozbiljnih tema utiša.
 * Determinističko — ne zove model.
 */
import { jeOzbiljnaTema, STILOVI, uputstvoStila } from "../src/lib/ai/stilovi";

let prosli = 0, pali = 0;
function proveri(naziv: string, uslov: boolean) {
  if (uslov) { prosli++; } else { pali++; console.log("  ✗", naziv); }
}

const OZBILJNA = [
  "Dobio sam rešenje poreske kontrole, šta sada?",
  "Firma je u blokadi, kako da isplatim zarade?",
  "Da li mogu da dam otkaz zaposlenom na bolovanju?",
  "Preti mi prinudna naplata poreskog duga",
  "Inspekcija je bila juče i napisala zapisnik",
  "Kolika je kazna za neprijavljen promet?",
  "Pokrenut je sudski spor protiv firme",
  "Da li je ovo poreska utaja?",
];
const OBICNA = [
  "Koja je stopa PDV na hleb?",
  "Kako se obračunava amortizacija?",
  "Koliko je neto od 120.000 bruto?",
  "Da li mogu da odbijem PDV na auto?",
];

for (const p of OZBILJNA) proveri(`ozbiljno: ${p}`, jeOzbiljnaTema(p));
for (const p of OBICNA) proveri(`obično: ${p}`, !jeOzbiljnaTema(p));

// Ćirilica i bez dijakritike moraju da se prepoznaju isto.
proveri("bez dijakritike", jeOzbiljnaTema("poreska kontrola i kazne"));
proveri("različit padež", jeOzbiljnaTema("stigla mi je opomena pred izvršenje"));

// Svaki stil nosi granicu koju ne prelazi.
for (const s of STILOVI) {
  const u = uputstvoStila(s, "Koja je stopa PDV?");
  proveri(`${s}: ima granicu stila`, u.includes("Stil menja kako odgovor zvuči"));
  proveri(`${s}: nema utišavanje na običnoj temi`, !u.includes("nije za šalu"));
}

// Ozbiljna tema utišava SVE stilove, ne samo mirandu.
for (const s of STILOVI) {
  const u = uputstvoStila(s, "Dobio sam rešenje o prinudnoj naplati");
  proveri(`${s}: utišan na ozbiljnoj temi`, u.includes("nije za šalu"));
}

// Ironija se pominje samo u miranda stilu.
proveri("ironija samo u miranda stilu",
  uputstvoStila("miranda", "test").includes("ironija") &&
  !uputstvoStila("professional", "test").includes("ironija") &&
  !uputstvoStila("accountant", "test").includes("ironija") &&
  !uputstvoStila("business", "test").includes("ironija") &&
  !uputstvoStila("legal", "test").includes("ironija"));

console.log(`\n─────────────────────────\nProšlo: ${prosli}   Palo: ${pali}\n─────────────────────────`);
if (pali) process.exit(1);
