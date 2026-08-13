/**
 * Jedna komanda koja pripremi sve i pokrene aplikaciju: `npm run kreni`
 *
 * Namenjeno onome ko samo želi da vidi da stvar radi, bez podešavanja.
 * Radi sve što treba i preskače ono što je već urađeno:
 *   1. napravi .env ako ne postoji (sa nasumičnim SESSION_SECRET),
 *   2. kreira SQLite bazu,
 *   3. napuni pravnu bazu,
 *   4. proveri da li API ključ zaista radi,
 *   5. pokrene aplikaciju.
 *
 * Idempotentno je — ponovno pokretanje ne kvari ništa i ne briše podatke.
 */

import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

import { maskiraj, nadjiKljuc, proveriKodAnthropic } from "./kljuc";

const KOREN = process.cwd();
const ENV = join(KOREN, ".env");

function naslov(tekst: string) {
  console.log(`\n\x1b[1m${tekst}\x1b[0m`);
}

function uredu(tekst: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${tekst}`);
}

function pazi(tekst: string) {
  console.log(`  \x1b[33m✗\x1b[0m ${tekst}`);
}

function info(tekst: string) {
  console.log(`  \x1b[2m${tekst}\x1b[0m`);
}

function pokreni(komanda: string) {
  execSync(komanda, { stdio: "pipe", cwd: KOREN });
}

function prekini(sta: string, greska: unknown): never {
  console.error(
    `\n  Greška pri ${sta}:\n`,
    greska instanceof Error ? greska.message : greska,
  );
  process.exit(1);
}

// ── 1. .env ──────────────────────────────────────────────────────────────────

function podesiEnv() {
  naslov("1/5  Podešavanja");

  if (existsSync(ENV)) {
    uredu(".env već postoji — ne diram ga");
    return;
  }

  const sablon = existsSync(join(KOREN, ".env.example"))
    ? readFileSync(join(KOREN, ".env.example"), "utf-8")
    : "";

  const sadrzaj = sablon
    .replace(/^ANTHROPIC_API_KEY=.*$/m, "ANTHROPIC_API_KEY=")
    .replace(
      /^SESSION_SECRET=.*$/m,
      `SESSION_SECRET=${randomBytes(32).toString("hex")}`,
    )
    .replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL="file:./pravna-baza.db"');

  writeFileSync(ENV, sadrzaj, "utf-8");
  uredu(".env napravljen, sa nasumičnim SESSION_SECRET");
}

// ── 2. Baza ──────────────────────────────────────────────────────────────────

function podesiBazu() {
  naslov("2/5  Baza podataka");
  try {
    pokreni("npx prisma generate");
    pokreni("npx prisma db push --skip-generate");
    uredu("SQLite baza spremna (pravna-baza.db)");
  } catch (greska) {
    prekini("kreiranju baze", greska);
  }
}

// ── 3. Pravna baza ───────────────────────────────────────────────────────────

function napuniPravnuBazu() {
  naslov("3/5  Punjenje pravne baze");
  try {
    const izlaz = execSync("npx tsx --env-file-if-exists=.env scripts/seed.ts", {
      cwd: KOREN,
      encoding: "utf-8",
    });
    for (const red of izlaz.split("\n")) {
      if (/Propisi:|Odredbe:|Parametri:|Rokovi:/.test(red)) info(red.trim());
    }
    uredu("pravna baza napunjena");
  } catch (greska) {
    prekini("punjenju baze", greska);
  }
}

// ── 4. Ključ ─────────────────────────────────────────────────────────────────

/**
 * Jedini korak koji dodiruje mrežu, i namerno je takav: da li ključ radi ne
 * može se utvrditi gledanjem u fajl. Pod navodnicima, istekao, bez kredita i
 * nalepljen u pogrešan fajl — sve to izgleda isto. Zato se pita Anthropic.
 */
async function proveriKljuc(): Promise<boolean> {
  naslov("4/5  Provera API ključa");

  const nalaz = nadjiKljuc(KOREN);

  if (nalaz.stanje === "nema") {
    pazi(nalaz.razlog);
    info(`  ${nalaz.savet}`);
    return false;
  }

  info(`ključ pronađen u ${nalaz.izvor}: ${maskiraj(nalaz.kljuc)}`);

  const provera = await proveriKodAnthropic(nalaz.kljuc);

  if (provera.radi) {
    uredu(provera.poruka);
    return true;
  }

  pazi(provera.poruka);
  if (provera.savet) info(`  ${provera.savet}`);
  return false;
}

function bezKljuca() {
  console.log(
    [
      "",
      "  \x1b[33m┌──────────────────────────────────────────────────────────┐\x1b[0m",
      "  \x1b[33m│\x1b[0m  Aplikacija se svejedno pokreće. Sada rade:               \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m    • Kalkulatori   • Propisi   • Rokovi   • Firma         \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m                                                          \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m  Za Razgovor i Analizu dokumenata:                        \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m    1. ključ sa console.anthropic.com → API Keys           \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m    2. u .env: ANTHROPIC_API_KEY=sk-ant-…  pa Ctrl+S       \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m    3. ponovna provera, bez restarta:  npm run kljuc       \x1b[33m│\x1b[0m",
      "  \x1b[33m└──────────────────────────────────────────────────────────┘\x1b[0m",
    ].join("\n"),
  );
}

// ── 5. Pokretanje ────────────────────────────────────────────────────────────

/** Da li se na portu može slušati. Jedini pouzdan način je — pokušati. */
function portSlobodan(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probni = createServer();
    probni.once("error", () => resolve(false));
    probni.once("listening", () => probni.close(() => resolve(true)));
    probni.listen(port, "0.0.0.0");
  });
}

async function nadjiSlobodanPort(od = 3000, koliko = 10): Promise<number | null> {
  for (let p = od; p < od + koliko; p += 1) {
    if (await portSlobodan(p)) return p;
  }
  return null;
}

async function pokreniAplikaciju() {
  naslov("5/5  Pokretanje aplikacije");

  // Adresa se ispisuje tek kada se zna da port zaista može da se zauzme.
  // Ranije je ispisivana unapred, pa je zauzet port 3000 značio da poslednje
  // što korisnik pročita bude adresa koja ne radi, praćena EADDRINUSE.
  const port = await nadjiSlobodanPort();

  if (port === null) {
    console.error(
      [
        "  \x1b[31m✗\x1b[0m Portovi 3000–3009 su svi zauzeti.",
        "",
        "  \x1b[2mNajverovatnije je u pitanju ranije pokretanje koje još radi.",
        "  Oslobodite port pa pokušajte ponovo:\x1b[0m",
        "      \x1b[36mnpx kill-port 3000\x1b[0m",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  if (port !== 3000) {
    console.log(
      [
        `  \x1b[33m!\x1b[0m Port 3000 je zauzet — verovatno raniji \x1b[2mnpm run kreni\x1b[0m koji još radi.`,
        `    Pokrećem na portu ${port}. Da oslobodite 3000: \x1b[36mnpx kill-port 3000\x1b[0m`,
        "",
      ].join("\n"),
    );
  }

  // U Codespaces-u localhost ne znači ništa korisniku — aplikacija je dostupna
  // preko prosleđenog porta. Sastavljamo tačnu adresu da ne mora da je traži.
  const codespace = process.env.CODESPACE_NAME;
  const domen = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

  if (codespace && domen) {
    console.log(
      [
        "  \x1b[1mOtvorite ovu adresu:\x1b[0m",
        `  \x1b[36mhttps://${codespace}-${port}.${domen}\x1b[0m`,
        "",
        `  \x1b[2mAko se ne otvori sama: dole kartica PORTS → red ${port} →\x1b[0m`,
        "  \x1b[2mpređite mišem i kliknite ikonicu globusa.\x1b[0m",
      ].join("\n"),
    );
  } else {
    console.log(`  Otvorite: \x1b[36mhttp://localhost:${port}\x1b[0m`);
  }

  console.log("  Zaustavljanje: Ctrl+C\n");

  // `--hostname 0.0.0.0` je bitan: vezivanje samo za localhost ume da spreči
  // prosleđivanje porta u Codespaces-u i sličnim udaljenim okruženjima.
  const dete = spawn(
    "npx",
    ["next", "dev", "--hostname", "0.0.0.0", "--port", String(port)],
    { stdio: "inherit", cwd: KOREN, shell: true },
  );

  // Ako server padne, poslednje što korisnik vidi ne sme da bude adresa.
  dete.on("exit", (kod, signal) => {
    if (signal || kod === 0 || kod === null) return;
    console.error(
      [
        "",
        `  \x1b[31m✗\x1b[0m Server se ugasio (izlazni kod ${kod}).`,
        "  \x1b[2mAdresa iznad više ne radi. Greška je ispisana neposredno pre ove poruke.\x1b[0m",
        "",
      ].join("\n"),
    );
    process.exit(kod);
  });
}

async function glavna() {
  podesiEnv();
  podesiBazu();
  napuniPravnuBazu();
  if (!(await proveriKljuc())) bezKljuca();
  await pokreniAplikaciju();
}

glavna();
