/**
 * Usklađuje Prisma `provider` sa onim što stvarno stoji u DATABASE_URL.
 *
 * Zašto ovo postoji: Prisma ne dozvoljava `provider = env("...")` — mora da
 * bude statičan string u schema.prisma. Bez ovoga bi za lokalni rad (SQLite) i
 * za produkciju (Postgres) morala da postoje dva schema fajla, koja bi pre ili
 * kasnije razišla.
 *
 * Skripta menja isključivo jednu liniju, idempotentna je i ispisuje šta je
 * uradila. Pokreće se automatski pre svakog build-a.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PUTANJA = join(process.cwd(), "prisma", "schema.prisma");

function providerZaUrl(url: string): "sqlite" | "postgresql" {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  }
  if (url.startsWith("file:")) return "sqlite";
  throw new Error(
    `DATABASE_URL ima nepoznat oblik: "${url.slice(0, 24)}…".\n` +
      `Podržano je "file:./..." (SQLite, lokalni rad) ili "postgres://..." (produkcija).`,
  );
}

/**
 * Vercel Postgres i pojedine integracije ne kreiraju `DATABASE_URL` nego svoje
 * nazive. Ako nađemo neki od njih, korisniku tačno kažemo šta da uradi umesto
 * da ga pustimo u nerazumljivu Prisma grešku.
 */
const POZNATI_ALIJASI = [
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "NEON_DATABASE_URL",
];

function prijaviNedostatak(): never {
  const nadjeni = POZNATI_ALIJASI.filter((n) => process.env[n]);

  const linije = [
    "",
    "═══════════════════════════════════════════════════════════════",
    " DATABASE_URL nije podešen — build ne može da nastavi.",
    "═══════════════════════════════════════════════════════════════",
    "",
  ];

  if (nadjeni.length > 0) {
    linije.push(
      ` Pronađena je druga promenljiva sa vezom ka bazi: ${nadjeni.join(", ")}.`,
      "",
      " Aplikacija očekuje da se promenljiva zove tačno DATABASE_URL.",
      " U Vercelu: Settings → Environment Variables → Add New",
      `   Key:   DATABASE_URL`,
      `   Value: ista vrednost koju ima ${nadjeni[0]}`,
      " pa Deployments → Redeploy.",
    );
  } else {
    linije.push(
      " U Vercelu: Settings → Environment Variables → Add New",
      "   Key:   DATABASE_URL",
      "   Value: postgres://... (connection string vaše baze)",
      " pa Deployments → Redeploy.",
      "",
      " Proverite i da je promenljiva označena za okruženje u kojem se",
      " build izvršava (Production / Preview / Development).",
      "",
      " Za lokalni rad: kopirajte .env.example u .env i unesite vrednost.",
    );
  }

  linije.push("═══════════════════════════════════════════════════════════════", "");
  console.error(linije.join("\n"));
  process.exit(1);
}

function main() {
  const url = process.env.DATABASE_URL;

  // Ranije je ovde stajalo samo upozorenje, pa je build išao dalje i pucao na
  // `prisma db push` sa porukom P1012 koja ne kaže šta korisnik treba da uradi.
  // Bolje je stati odmah, na mestu gde znamo tačan uzrok.
  if (!url) prijaviNedostatak();

  const zeljeni = providerZaUrl(url);
  const sema = readFileSync(PUTANJA, "utf-8");

  const regex = /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"(\w+)"/s;
  const poklapanje = sema.match(regex);

  if (!poklapanje) {
    throw new Error(
      "Nije pronađen `provider` u datasource bloku u prisma/schema.prisma.",
    );
  }

  const trenutni = poklapanje[2];
  if (trenutni === zeljeni) {
    console.log(`[podesi-bazu] provider je već "${zeljeni}" — nema izmena.`);
    return;
  }

  writeFileSync(PUTANJA, sema.replace(regex, `$1"${zeljeni}"`), "utf-8");
  console.log(
    `[podesi-bazu] provider promenjen: "${trenutni}" → "${zeljeni}" (prema DATABASE_URL).`,
  );
}

try {
  main();
} catch (greska) {
  console.error(
    `[podesi-bazu] ${greska instanceof Error ? greska.message : greska}`,
  );
  process.exit(1);
}
