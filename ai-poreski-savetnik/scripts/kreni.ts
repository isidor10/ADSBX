/**
 * Jedna komanda koja pripremi sve i pokrene aplikaciju: `npm run kreni`
 *
 * Namenjeno onome ko samo želi da vidi da stvar radi, bez podešavanja.
 * Radi sve što treba i preskače ono što je već urađeno:
 *   1. napravi .env ako ne postoji (sa nasumičnim SESSION_SECRET),
 *   2. kreira SQLite bazu,
 *   3. napuni pravnu bazu,
 *   4. pokrene aplikaciju.
 *
 * Idempotentno je — ponovno pokretanje ne kvari ništa i ne briše podatke.
 */

import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KOREN = process.cwd();
const ENV = join(KOREN, ".env");

function naslov(tekst: string) {
  console.log(`\n\x1b[1m${tekst}\x1b[0m`);
}

function uredu(tekst: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${tekst}`);
}

function info(tekst: string) {
  console.log(`  \x1b[2m${tekst}\x1b[0m`);
}

function pokreni(komanda: string) {
  execSync(komanda, { stdio: "pipe", cwd: KOREN });
}

// ── 1. .env ──────────────────────────────────────────────────────────────────
naslov("1/4  Podešavanja");

if (!existsSync(ENV)) {
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
} else {
  uredu(".env već postoji — ne diram ga");
}

const env = readFileSync(ENV, "utf-8");
const imaKljuc = /^ANTHROPIC_API_KEY=\s*sk-ant-/m.test(env);

// ── 2. Baza ──────────────────────────────────────────────────────────────────
naslov("2/4  Baza podataka");
try {
  pokreni("npx prisma generate");
  pokreni("npx prisma db push --skip-generate");
  uredu("SQLite baza spremna (pravna-baza.db)");
} catch (greska) {
  console.error(
    "\n  Greška pri kreiranju baze:\n",
    greska instanceof Error ? greska.message : greska,
  );
  process.exit(1);
}

// ── 3. Pravna baza ───────────────────────────────────────────────────────────
naslov("3/4  Punjenje pravne baze");
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
  console.error(
    "\n  Greška pri punjenju baze:\n",
    greska instanceof Error ? greska.message : greska,
  );
  process.exit(1);
}

// ── 4. Pokretanje ────────────────────────────────────────────────────────────
naslov("4/4  Pokretanje aplikacije");

if (!imaKljuc) {
  console.log(
    [
      "",
      "  \x1b[33m┌──────────────────────────────────────────────────────────┐\x1b[0m",
      "  \x1b[33m│\x1b[0m  ANTHROPIC_API_KEY nije unet.                            \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m                                                          \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m  Aplikacija se pokreće i sada rade:                       \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m    • Kalkulatori   • Propisi   • Rokovi   • Firma         \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m                                                          \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m  Za Razgovor i Analizu dokumenata treba ključ:            \x1b[33m│\x1b[0m",
      "  \x1b[33m│\x1b[0m  otvorite .env i upišite ANTHROPIC_API_KEY=sk-ant-...     \x1b[33m│\x1b[0m",
      "  \x1b[33m└──────────────────────────────────────────────────────────┘\x1b[0m",
      "",
    ].join("\n"),
  );
} else {
  uredu("ANTHROPIC_API_KEY pronađen — radi i Razgovor");
}

console.log("  Otvorite: \x1b[36mhttp://localhost:3000\x1b[0m");
console.log("  Zaustavljanje: Ctrl+C\n");

spawn("npx", ["next", "dev"], { stdio: "inherit", cwd: KOREN, shell: true });
