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

function main() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    // Bez URL-a ne diramo šemu — build će ionako pući na jasnijem mestu.
    console.log(
      "[podesi-bazu] DATABASE_URL nije podešen; ostavljam schema.prisma kakva jeste.",
    );
    return;
  }

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
