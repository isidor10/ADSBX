/**
 * Provera da li ANTHROPIC_API_KEY zaista radi.
 *
 * Ranije se proveravalo samo da li red u .env počinje sa `sk-ant-`. To ćuti
 * kada je ključ pod navodnicima, kada je nalepljen u pogrešan fajl, kada je
 * istekao ili kada na nalogu nema kredita — a korisnik u sva četiri slučaja
 * vidi isto: ništa. Zato ovde postoje dva koraka:
 *
 *   1. gde je ključ i kako izgleda (bez mreže),
 *   2. da li ga Anthropic prihvata (pravi poziv).
 *
 * Drugi korak je jedini koji zaista nešto dokazuje.
 *
 * Pokretanje: npm run kljuc
 */

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { MODEL } from "../src/lib/ai/client";

/** Vrednost `ANTHROPIC_API_KEY=sk-ant-...` iz .env.example, koju ne treba ostaviti. */
const SABLON = "sk-ant-...";

export type StanjeKljuca =
  | { stanje: "ok"; kljuc: string; izvor: string }
  | { stanje: "nema"; razlog: string; savet: string };

/**
 * Čita jednu vrednost iz .env fajla.
 *
 * Namerno tolerantno, jer greške koje pravimo pri lepljenju ključa su uvek
 * iste: navodnici, razmak posle znaka jednakosti, `export` ispred, komentar
 * u nastavku reda. Sve to `next dev` takođe podnosi, pa provera ne sme da
 * bude stroža od onoga što aplikacija zaista prihvata.
 */
export function procitajIzEnv(sadrzaj: string, ime: string): string | null {
  for (const red of sadrzaj.split(/\r?\n/)) {
    const t = red.trim();
    if (!t || t.startsWith("#")) continue;

    const m = t.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || m[1] !== ime) continue;

    let v = m[2].trim();

    const podNavodnicima =
      v.length > 1 &&
      ((v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'")));

    if (podNavodnicima) {
      v = v.slice(1, -1);
    } else {
      // Komentar u nastavku reda važi samo kad vrednost nije pod navodnicima.
      const komentar = v.indexOf(" #");
      if (komentar !== -1) v = v.slice(0, komentar);
    }

    return v.trim();
  }
  return null;
}

/** Prikazuje ključ tako da se prepozna, a da se ne otkrije. */
export function maskiraj(kljuc: string): string {
  if (kljuc.length <= 14) return `${kljuc.slice(0, 4)}…`;
  return `${kljuc.slice(0, 10)}…${kljuc.slice(-4)} (${kljuc.length} znakova)`;
}

export function nadjiKljuc(koren: string): StanjeKljuca {
  const izOkruzenja = process.env.ANTHROPIC_API_KEY?.trim();
  if (izOkruzenja) {
    return { stanje: "ok", kljuc: izOkruzenja, izvor: "promenljive okruženja" };
  }

  const putanja = join(koren, ".env");
  if (!existsSync(putanja)) {
    return {
      stanje: "nema",
      razlog: "Fajl .env ne postoji.",
      savet: "Pokrenite `npm run kreni` — on ga pravi.",
    };
  }

  const vrednost = procitajIzEnv(readFileSync(putanja, "utf-8"), "ANTHROPIC_API_KEY");

  if (vrednost === null) {
    return {
      stanje: "nema",
      razlog: "U .env nema reda ANTHROPIC_API_KEY.",
      savet: "Dodajte red: ANTHROPIC_API_KEY=sk-ant-...",
    };
  }

  if (vrednost === "") {
    return {
      stanje: "nema",
      razlog: "Red ANTHROPIC_API_KEY postoji, ali je prazan.",
      savet: "Upišite ključ odmah iza znaka = i sačuvajte fajl (Ctrl+S).",
    };
  }

  if (vrednost === SABLON) {
    return {
      stanje: "nema",
      razlog: "U .env je ostala vrednost-šablon iz .env.example.",
      savet: "Zamenite `sk-ant-...` pravim ključem sa console.anthropic.com.",
    };
  }

  if (!vrednost.startsWith("sk-ant-")) {
    return {
      stanje: "nema",
      razlog: `Vrednost ne liči na Anthropic ključ — počinje sa „${vrednost.slice(0, 8)}…”, a treba sa „sk-ant-”.`,
      savet:
        "Proverite da niste nalepili nešto drugo (npr. ključ nekog drugog servisa).",
    };
  }

  return { stanje: "ok", kljuc: vrednost, izvor: ".env" };
}

export interface NalazProvere {
  radi: boolean;
  poruka: string;
  savet?: string;
}

/**
 * Pravi poziv prema Anthropic API-ju. Bira se `models.retrieve` jer proverava
 * i da ključ važi i da ima pristup baš modelu koji aplikacija koristi — a ne
 * troši tokene.
 */
export async function proveriKodAnthropic(
  kljuc: string,
  timeoutMs = 15000,
): Promise<NalazProvere> {
  const klijent = new Anthropic({ apiKey: kljuc, maxRetries: 1, timeout: timeoutMs });

  try {
    const model = await klijent.models.retrieve(MODEL);
    return { radi: true, poruka: `Anthropic je prihvatio ključ. Model: ${model.id}` };
  } catch (greska) {
    if (greska instanceof Anthropic.AuthenticationError) {
      return {
        radi: false,
        poruka: "Anthropic odbija ključ (401).",
        savet:
          "Ključ je pogrešan, obrisan ili nepotpun. Napravite nov na console.anthropic.com → API Keys → Create Key i nalepite ga ceo.",
      };
    }

    if (greska instanceof Anthropic.PermissionDeniedError) {
      return {
        radi: false,
        poruka: `Ključ važi, ali nema pristup modelu ${MODEL} (403).`,
        savet: "Proverite dozvole ključa u Anthropic konzoli.",
      };
    }

    if (greska instanceof Anthropic.NotFoundError) {
      return {
        radi: false,
        poruka: `Ključ važi, ali model ${MODEL} nije dostupan ovom nalogu (404).`,
        savet: "Proverite da li nalog ima pristup tom modelu.",
      };
    }

    // Ograničenje broja poziva znači da je ključ ispravan — samo je iskorišćen.
    if (greska instanceof Anthropic.RateLimitError) {
      return {
        radi: true,
        poruka: "Ključ je ispravan (dostignut je trenutni limit poziva).",
      };
    }

    if (greska instanceof Anthropic.APIError && greska.status === 400) {
      const tekst = String(greska.message ?? "");
      if (/credit|balance|billing/i.test(tekst)) {
        return {
          radi: false,
          poruka: "Ključ važi, ali na nalogu nema kredita.",
          savet:
            "Na console.anthropic.com → Billing dodajte način plaćanja i uplatite mali iznos.",
        };
      }
    }

    if (greska instanceof Anthropic.APIConnectionError) {
      return {
        radi: false,
        poruka: "Nije uspelo povezivanje sa Anthropic API-jem.",
        savet:
          "Ovo ne govori ništa o ispravnosti ključa — proverite mrežu pa pokušajte ponovo: npm run kljuc",
      };
    }

    return {
      radi: false,
      poruka: `Neočekivana greška: ${greska instanceof Error ? greska.message : String(greska)}`,
      savet: "Pokušajte ponovo: npm run kljuc",
    };
  }
}

// ── Pokretanje iz komandne linije ────────────────────────────────────────────

async function glavna() {
  const koren = process.cwd();

  console.log("\n\x1b[1mProvera ANTHROPIC_API_KEY\x1b[0m\n");

  const nalaz = nadjiKljuc(koren);

  if (nalaz.stanje === "nema") {
    console.log(`  \x1b[31m✗\x1b[0m ${nalaz.razlog}`);
    console.log(`    \x1b[2m${nalaz.savet}\x1b[0m`);
    console.log(
      "\n  \x1b[2mKalkulatori, Propisi, Rokovi i Moja firma rade i bez ključa.\x1b[0m\n",
    );
    process.exit(1);
  }

  console.log(`  \x1b[32m✓\x1b[0m Ključ pronađen u ${nalaz.izvor}`);
  console.log(`    \x1b[2m${maskiraj(nalaz.kljuc)}\x1b[0m`);
  console.log("\n  Proveravam ga kod Anthropic-a…");

  const provera = await proveriKodAnthropic(nalaz.kljuc);

  if (provera.radi) {
    console.log(`  \x1b[32m✓\x1b[0m ${provera.poruka}`);
    console.log("\n  \x1b[1mRazgovor i Analiza dokumenata su spremni.\x1b[0m\n");
    return;
  }

  console.log(`  \x1b[31m✗\x1b[0m ${provera.poruka}`);
  if (provera.savet) console.log(`    \x1b[2m${provera.savet}\x1b[0m`);
  console.log("");
  process.exit(1);
}

// tsx pokreće fajl direktno; kada se uvozi iz kreni.ts, ovo se ne izvršava.
if (process.argv[1] && process.argv[1].endsWith("kljuc.ts")) {
  glavna();
}
