/**
 * Otkrivanje izmena propisa i priprema obaveštenja (zahtev 16).
 *
 * Pokretanje: npm run izmene
 *
 * Radi nad onim što je već u bazi: poredi tekuće odredbe sa snimljenim
 * verzijama i pravi zapise „šta se promenilo / od kada / koga pogađa / šta
 * treba uraditi". Predviđeno je da se pokreće cron-om posle `npm run ingest`.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("\nOtkrivanje izmena propisa\n");

  // 1. Parametri koji prestaju da važe uskoro — najčešći izvor tihe greške
  //    u obračunima (npr. neoporezivi iznos koji se menja 1. februara).
  const zaMesecDana = new Date(Date.now() + 30 * 86_400_000);
  const isticu = await db.poreskiParametar.findMany({
    where: { vaziDo: { not: null, lte: zaMesecDana, gte: new Date() } },
    include: { propis: { select: { naziv: true } } },
  });

  console.log(`  Parametara koji ističu u narednih 30 dana: ${isticu.length}`);
  for (const p of isticu) {
    console.log(
      `    · ${p.naziv} = ${p.vrednost} — važi do ${p.vaziDo?.toISOString().slice(0, 10)}`,
    );
  }

  // 2. Odredbe koje su prestale da važe, a nemaju zabeleženu izmenu.
  const danas = new Date();
  const prestale = await db.odredba.findMany({
    where: { vaziDo: { not: null, lt: danas }, izmene: { none: {} } },
    include: { propis: true },
  });

  let napravljeno = 0;
  for (const o of prestale) {
    await db.izmena.create({
      data: {
        propisId: o.propisId,
        odredbaId: o.id,
        naslov: `Prestala da važi — ${o.propis.skracenica}, član ${o.clan}`,
        staraOdredba: o.tekst.slice(0, 2000),
        novaOdredba: null,
        odKadaSePrimenjuje: o.vaziDo ?? danas,
        kogaPogadja:
          "Sve obveznike koji su primenjivali ovu odredbu — utvrditi prema sadržini.",
        staTrebaUraditi:
          "Proveriti koja odredba je zamenila ovu i uskladiti postupanje sa važećim tekstom propisa.",
        izvorUrl: o.izvorUrl,
      },
    });
    napravljeno++;
  }
  console.log(`  Novih zapisa o prestanku važenja: ${napravljeno}`);

  // 3. Propisi koji dugo nisu provereni — kandidati za ponovni ingest.
  const pre60Dana = new Date(Date.now() - 60 * 86_400_000);
  const zastareli = await db.propis.findMany({
    where: {
      OR: [{ poslednjaProvera: null }, { poslednjaProvera: { lt: pre60Dana } }],
    },
    select: { skracenica: true, naziv: true, poslednjaProvera: true },
  });

  console.log(`\n  Propisa koji nisu provereni duže od 60 dana: ${zastareli.length}`);
  for (const p of zastareli.slice(0, 15)) {
    console.log(
      `    · ${p.skracenica} — poslednja provera: ${
        p.poslednjaProvera?.toISOString().slice(0, 10) ?? "nikad"
      }`,
    );
  }

  const ukupnoIzmena = await db.izmena.count();
  console.log(`\n─────────────────────────────────────────────`);
  console.log(`Ukupno zabeleženih izmena u bazi: ${ukupnoIzmena}`);
  console.log(`Za dopunu punih tekstova pokrenite: npm run ingest`);
  console.log(`─────────────────────────────────────────────\n`);
}

main()
  .catch((g) => {
    console.error("Greška:", g);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
