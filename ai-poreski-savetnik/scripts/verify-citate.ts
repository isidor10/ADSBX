/**
 * Provera zaštite od halucinacija.
 *
 * Ovo je najvažniji test u projektu: simulira odgovore modela — uključujući
 * one koji izmišljaju citate — i proverava da verifikator zaista blokira ono
 * što treba da blokira. Ne zove model, pa je determinističan.
 *
 * Pokretanje: npm run verify:citati
 */

import { formatirajOznakuClana } from "../src/lib/legal/citations";
import { proveriClanoveUTekstu, verifikuj } from "../src/lib/ai/verifier";
import type {
  PronadjenaOdredba,
  StrukturiraniOdgovor,
  WebIzvor,
} from "../src/lib/types";

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

const DANAS = new Date("2026-08-12T00:00:00.000Z");

function odredba(over: Partial<PronadjenaOdredba> = {}): PronadjenaOdredba {
  return {
    id: "odr_vazeca",
    propisNaziv: "Zakon o porezu na dodatu vrednost",
    propisSkracenica: "ZPDV",
    propisTip: "ZAKON",
    kategorija: "PDV",
    clan: "29",
    stav: "1",
    tacka: null,
    podtacka: null,
    naslov: "Isključenje prava na odbitak",
    tekst: "Obveznik nema pravo na odbitak prethodnog poreza…",
    doslovanTekst: false,
    potvrdjenBrojClana: true,
    vaziOd: new Date("2005-01-01"),
    vaziDo: null,
    izvorUrl: "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dodatu-vrednost.html",
    deepLink: null,
    institucija: "Paragraf Lex",
    prioritetIzvora: 3,
    verifikacija: "POTVRDJENO",
    statusVazenja: "VAZI",
    skor: 1,
    ...over,
  };
}

function odgovor(over: Partial<StrukturiraniOdgovor> = {}): StrukturiraniOdgovor {
  return {
    kratakOdgovor: "Ne, po pravilu nemate pravo na odbitak.",
    objasnjenje: "Objašnjenje…",
    pravniOsnov: [
      { citatId: "odr_vazeca", relevantnost: "Isključuje odbitak", tipTvrdnje: "ZAKON" },
    ],
    vazno: ["Postoje izuzeci."],
    nivoPouzdanosti: "VISOKA",
    obrazlozenjePouzdanosti: "Direktno potvrđeno odredbom.",
    ...over,
  };
}

function main() {
  console.log("\nProvera zaštite od halucinacija\n");

  // ── Formatiranje oznake člana ─────────────────────────────────────────────
  console.log("Oznaka člana:");
  tvrdi(
    formatirajOznakuClana({
      clan: "29", stav: "1", tacka: null, podtacka: null, potvrdjenBrojClana: true,
    }) === "Član 29, stav 1",
    "potvrđen član se formatira normalno",
  );
  tvrdi(
    formatirajOznakuClana({
      clan: "29", stav: "1", tacka: "2", podtacka: null, potvrdjenBrojClana: true,
    }) === "Član 29, stav 1, tačka 2)",
    "tačka se dodaje u oznaku",
  );
  const nepotvrdjen = formatirajOznakuClana({
    clan: "29", stav: null, tacka: null, podtacka: null, potvrdjenBrojClana: false,
  });
  tvrdi(
    nepotvrdjen.includes("Nisam uspeo da potvrdim tačan član"),
    "NEPOTVRĐEN član se NE prikazuje kao broj, već kao poruka",
    nepotvrdjen,
  );
  tvrdi(!nepotvrdjen.includes("29"), "nepotvrđen broj člana se uopšte ne ispisuje");

  // ── Halucinirani citat ────────────────────────────────────────────────────
  console.log("\nHalucinirani citati:");
  const halucinacija = verifikuj(
    odgovor({
      pravniOsnov: [
        { citatId: "odr_vazeca", relevantnost: "Stvarna", tipTvrdnje: "ZAKON" },
        { citatId: "odr_IZMISLJENA", relevantnost: "Izmišljena", tipTvrdnje: "ZAKON" },
      ],
    }),
    [odredba()],
    [],
    DANAS,
  );
  tvrdi(halucinacija.citati.length === 1, "izmišljen citat je uklonjen iz odgovora");
  tvrdi(
    halucinacija.odbaceniCitati.includes("odr_IZMISLJENA"),
    "izmišljen citat je zabeležen u audit tragu",
  );
  tvrdi(
    halucinacija.nivoPouzdanosti === "POTREBNA_PROVERA",
    "pouzdanost je oborena zbog odbačenog citata",
    halucinacija.nivoPouzdanosti,
  );
  tvrdi(
    halucinacija.dodataUpozorenja.some((u) => u.includes("odbacio")),
    "korisnik je obavešten da su izvori odbačeni",
  );

  // ── Odgovor bez ijednog validnog citata ───────────────────────────────────
  const bezOsnova = verifikuj(
    odgovor({
      pravniOsnov: [
        { citatId: "odr_NEPOSTOJECA", relevantnost: "x", tipTvrdnje: "ZAKON" },
      ],
    }),
    [odredba()],
    [],
    DANAS,
  );
  tvrdi(
    bezOsnova.nivoPouzdanosti === "NEDOVOLJNO_PODATAKA",
    "odgovor bez ijednog validnog citata → NEDOVOLJNO PODATAKA",
  );
  tvrdi(
    bezOsnova.dodataUpozorenja.some((u) =>
      u.includes("Ne mogu pouzdano da potvrdim"),
    ),
    "prikazuje se propisana poruka o nemogućnosti potvrde",
  );

  // ── Propis koji više ne važi ──────────────────────────────────────────────
  console.log("\nVaženje propisa:");
  const istekao = verifikuj(
    odgovor(),
    [
      odredba({
        statusVazenja: "PRESTAO_DA_VAZI",
        vaziDo: new Date("2024-01-01"),
      }),
    ],
    [],
    DANAS,
  );
  tvrdi(
    istekao.dodataUpozorenja.some((u) => u.includes("više nije na snazi")),
    "odredba koja je prestala da važi nosi jasno upozorenje",
  );

  const buduci = verifikuj(
    odgovor(),
    [odredba({ statusVazenja: "JOS_NIJE_STUPIO_NA_SNAGU" })],
    [],
    DANAS,
  );
  tvrdi(
    buduci.citati.length === 0,
    "odredba koja još nije na snazi se NE koristi kao pravni osnov",
  );
  tvrdi(
    buduci.dodataUpozorenja.some((u) => u.includes("primenjuje tek od")),
    "korisnik je obavešten od kada se odredba primenjuje",
  );

  const nacrt = verifikuj(
    odgovor(),
    [odredba({ statusVazenja: "NIJE_PROPIS" })],
    [],
    DANAS,
  );
  tvrdi(nacrt.citati.length === 0, "nacrt zakona se NE koristi kao pravni osnov");
  tvrdi(
    nacrt.dodataUpozorenja.some((u) => u.includes("NE predstavlja važeći propis")),
    "nacrt je jasno označen kao nevažeći",
  );

  // ── Nepotvrđen broj člana obara pouzdanost ────────────────────────────────
  console.log("\nStatus verifikacije:");
  const nepotvrdjenClan = verifikuj(
    odgovor(),
    [odredba({ potvrdjenBrojClana: false })],
    [],
    DANAS,
  );
  tvrdi(
    nepotvrdjenClan.nivoPouzdanosti === "POTREBNA_PROVERA",
    "nepotvrđen broj člana ne može da nosi visoku pouzdanost",
  );
  tvrdi(
    !nepotvrdjenClan.citati[0].potvrdjen,
    "citat je označen kao nepotvrđen za prikaz",
  );

  const nepotvrdjenZapis = verifikuj(
    odgovor(),
    [odredba({ verifikacija: "NEPOTVRDJENO" })],
    [],
    DANAS,
  );
  tvrdi(
    nepotvrdjenZapis.nivoPouzdanosti === "POTREBNA_PROVERA",
    "nepotvrđen zapis u bazi obara pouzdanost",
  );

  // ── Prioritet izvora ──────────────────────────────────────────────────────
  console.log("\nPrioritet izvora:");
  const sekundarni = verifikuj(
    odgovor(),
    [odredba({ prioritetIzvora: 7 })],
    [],
    DANAS,
  );
  tvrdi(
    sekundarni.nivoPouzdanosti === "POTREBNA_PROVERA",
    "odgovor samo iz sekundarnih izvora ne može biti visoke pouzdanosti",
  );
  tvrdi(
    sekundarni.dodataUpozorenja.some((u) => u.includes("Službenom glasniku")),
    "preporučuje se provera prema zvaničnom izvoru",
  );

  const primarni = verifikuj(odgovor(), [odredba({ prioritetIzvora: 2 })], [], DANAS);
  tvrdi(
    primarni.nivoPouzdanosti === "VISOKA",
    "potvrđena odredba iz primarnog izvora zadržava visoku pouzdanost",
    primarni.nivoPouzdanosti,
  );

  // ── Pitanja korisniku obaraju konačnost ───────────────────────────────────
  const saPitanjima = verifikuj(
    odgovor({ potrebnaPitanja: ["Da li ste u sistemu PDV-a?"] }),
    [odredba()],
    [],
    DANAS,
  );
  tvrdi(
    saPitanjima.nivoPouzdanosti === "POTREBNA_PROVERA",
    "odgovor koji traži dodatne podatke nije konačan",
  );

  // ── Brojevi članova u slobodnom tekstu ────────────────────────────────────
  console.log("\nČlanovi u slobodnom tekstu:");
  const citatiVazeci = verifikuj(odgovor(), [odredba()], [], DANAS).citati;
  tvrdi(
    proveriClanoveUTekstu(
      "Prema članu 29 nemate pravo na odbitak.",
      citatiVazeci,
    ).length === 0,
    "član pokriven citatom ne pravi upozorenje",
  );
  const sumnjivi = proveriClanoveUTekstu(
    "Prema članu 47 imate pravo na povraćaj.",
    citatiVazeci,
  );
  tvrdi(
    sumnjivi.length === 1,
    "član koji NIJE pokriven citatom se detektuje",
    JSON.stringify(sumnjivi),
  );

  // ── Web izvori ────────────────────────────────────────────────────────────
  console.log("\nWeb izvori:");
  const web: WebIzvor[] = [
    {
      naslov: "Poreska uprava",
      url: "https://www.purs.gov.rs/",
      institucija: "Poreska uprava",
      prioritet: 3,
    },
  ];
  const samoWeb = verifikuj(
    odgovor({ pravniOsnov: [] }),
    [],
    web,
    DANAS,
  );
  tvrdi(
    samoWeb.nivoPouzdanosti === "NEDOVOLJNO_PODATAKA",
    "odgovor bez odredbe iz baze, samo sa weba → nedovoljno podataka",
  );
  tvrdi(
    samoWeb.dodataUpozorenja.some((u) => u.includes("samo na izvore sa weba")),
    "korisnik zna da odgovor stoji samo na web izvorima",
  );

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Prošlo: ${prosli}   Palo: ${pali}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(pali > 0 ? 1 : 0);
}

main();
