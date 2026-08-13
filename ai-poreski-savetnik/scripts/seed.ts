/**
 * Popunjavanje pravne baze početnim podacima.
 *
 * Idempotentno — može se pokretati više puta. Ne briše korisničke podatke
 * (razgovore, firme, dokumenta), samo osvežava pravni sadržaj.
 *
 * Pokretanje: npm run seed
 */

import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PROPISI } from "../src/data/seed/propisi";
import { ODREDBE } from "../src/data/seed/odredbe";
import { PARAMETRI } from "../src/data/seed/parametri";
import { ROKOVI } from "../src/data/seed/rokovi";

const db = new PrismaClient();

function datum(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function hash(tekst: string): string {
  return createHash("sha256").update(tekst).digest("hex").slice(0, 32);
}

async function main() {
  console.log("Popunjavanje pravne baze…\n");

  // Seed se pokreće i u Vercel build-u, na svakom deployu. Bezbedno je jer sve
  // ide kroz upsert po prirodnom ključu i dira isključivo pravni sadržaj —
  // korisnici, firme, razgovori i audit trag se ne diraju.

  // ── Propisi ───────────────────────────────────────────────────────────────
  const idPropisa = new Map<string, string>();
  for (const p of PROPISI) {
    const zapis = await db.propis.upsert({
      where: { skracenica: p.skracenica },
      create: {
        naziv: p.naziv,
        skracenica: p.skracenica,
        tip: p.tip,
        kategorija: p.kategorija,
        donosilac: p.donosilac,
        sluzbeniGlasnik: JSON.stringify(p.sluzbeniGlasnik ?? []),
        izvorInstitucija: p.izvorInstitucija,
        izvorUrl: p.izvorUrl,
        prioritetIzvora: p.prioritetIzvora,
        verifikacija: p.verifikacija,
        napomena: p.napomena,
        poslednjaProvera: new Date(),
      },
      update: {
        naziv: p.naziv,
        tip: p.tip,
        kategorija: p.kategorija,
        donosilac: p.donosilac,
        sluzbeniGlasnik: JSON.stringify(p.sluzbeniGlasnik ?? []),
        izvorInstitucija: p.izvorInstitucija,
        izvorUrl: p.izvorUrl,
        prioritetIzvora: p.prioritetIzvora,
        verifikacija: p.verifikacija,
        napomena: p.napomena,
        poslednjaProvera: new Date(),
      },
    });
    idPropisa.set(p.skracenica, zapis.id);
  }
  console.log(`  Propisi:    ${PROPISI.length}`);

  // ── Odredbe ───────────────────────────────────────────────────────────────
  const idOdredbe = new Map<string, string>();
  let noveOdredbe = 0;
  let azurirane = 0;

  for (const o of ODREDBE) {
    const propisId = idPropisa.get(o.propis);
    if (!propisId) {
      console.warn(`  ! Propis "${o.propis}" ne postoji — odredba preskočena.`);
      continue;
    }

    // Naslov ulazi u identitet namerno: odredbe kojima broj člana nije potvrđen
    // svi nose clan "—", pa bi se bez naslova međusobno pregazile.
    const postojeca = await db.odredba.findFirst({
      where: {
        propisId,
        clan: o.clan,
        stav: o.stav ?? null,
        tacka: o.tacka ?? null,
        naslov: o.naslov ?? null,
      },
    });

    const podaci = {
      propisId,
      clan: o.clan,
      stav: o.stav ?? null,
      tacka: o.tacka ?? null,
      naslov: o.naslov ?? null,
      tekst: o.tekst,
      vaziOd: datum(o.vaziOd),
      vaziDo: o.vaziDo ? datum(o.vaziDo) : null,
      izvorUrl: o.izvorUrl,
      deepLink: o.deepLink ?? null,
      potvrdjenBrojClana: o.potvrdjenBrojClana,
      doslovanTekst: o.doslovanTekst,
      hash: hash(o.tekst),
    };

    const zapis = postojeca
      ? await db.odredba.update({ where: { id: postojeca.id }, data: podaci })
      : await db.odredba.create({ data: podaci });

    if (postojeca) azurirane++;
    else noveOdredbe++;

    idOdredbe.set(
      `${o.propis}|${o.clan}${o.stav ? `|${o.stav}` : ""}`,
      zapis.id,
    );
  }
  /*
   * Uklanjanje zastarelih rezervisanih zapisa.
   *
   * Kada se odredbi naknadno potvrdi broj člana, u seed-u nestaje stari zapis
   * sa clan: "—", ali u bazi ostaje — pa korisnik na isto pitanje dobije i
   * potvrđen član i njegov nepotvrđeni duplikat. To je gore nego da ispravke
   * nije ni bilo: dva odgovora, jedan sa upozorenjem, o istoj stvari.
   *
   * Briše se usko i samo ono što je sigurno seed-ov trag: zapisi bez broja
   * člana koje seed više ne sadrži. Ingest uvek upisuje stvaran broj člana i
   * potvrdjenBrojClana: true, pa ovo ne može da dohvati ono što je on doneo.
   * Citati u istoriji razgovora preživljavaju — veza je onDelete: SetNull.
   */
  const uSeedu = new Set(
    ODREDBE.map((o) => `${o.propis}|${o.clan}|${o.naslov ?? ""}`),
  );
  const rezervisani = await db.odredba.findMany({
    where: { clan: "—", potvrdjenBrojClana: false },
    select: { id: true, naslov: true, propis: { select: { skracenica: true } } },
  });
  const zaBrisanje = rezervisani
    .filter(
      (o) => !uSeedu.has(`${o.propis.skracenica}|—|${o.naslov ?? ""}`),
    )
    .map((o) => o.id);

  if (zaBrisanje.length > 0) {
    await db.odredba.deleteMany({ where: { id: { in: zaBrisanje } } });
  }

  console.log(
    `  Odredbe:    ${noveOdredbe} novih, ${azurirane} ažuriranih` +
      (zaBrisanje.length > 0
        ? `, ${zaBrisanje.length} zastarelih uklonjeno`
        : ""),
  );

  // ── Parametri ─────────────────────────────────────────────────────────────
  let noviParametri = 0;
  for (const p of PARAMETRI) {
    const propisId = p.propis ? idPropisa.get(p.propis) : undefined;
    // Ključ je "SKRACENICA|clan" ili "SKRACENICA|clan|stav" — isti oblik u koji
    // se odredbe upisuju iznad.
    const odredbaId = p.odredba
      ? idOdredbe.get(`${p.propis}|${p.odredba}`)
      : undefined;

    const postojeci = await db.poreskiParametar.findFirst({
      where: { kljuc: p.kljuc, vaziOd: datum(p.vaziOd) },
    });

    const podaci = {
      kljuc: p.kljuc,
      naziv: p.naziv,
      vrednost: p.vrednost,
      jedinica: p.jedinica,
      vaziOd: datum(p.vaziOd),
      vaziDo: p.vaziDo ? datum(p.vaziDo) : null,
      propisId: propisId ?? null,
      odredbaId: odredbaId ?? null,
      izvorUrl: p.izvorUrl,
      napomena: p.napomena ?? null,
      verifikacija: p.verifikacija,
    };

    if (postojeci) {
      await db.poreskiParametar.update({ where: { id: postojeci.id }, data: podaci });
    } else {
      await db.poreskiParametar.create({ data: podaci });
      noviParametri++;
    }
  }
  console.log(
    `  Parametri:  ${PARAMETRI.length} (${noviParametri} novih)`,
  );

  // ── Rokovi ────────────────────────────────────────────────────────────────
  let noviRokovi = 0;
  for (const r of ROKOVI) {
    const postojeci = await db.rok.findFirst({ where: { naziv: r.naziv } });
    const podaci = {
      naziv: r.naziv,
      opis: r.opis,
      vrsteObveznika: JSON.stringify(r.vrsteObveznika),
      ponavljanje: r.ponavljanje,
      danUMesecu: r.danUMesecu ?? null,
      mesec: r.mesec ?? null,
      uslov: r.uslov ?? null,
      obrazac: r.obrazac ?? null,
      propisId: r.propis ? (idPropisa.get(r.propis) ?? null) : null,
      izvorUrl: r.izvorUrl,
      verifikacija: r.verifikacija,
    };
    if (postojeci) {
      await db.rok.update({ where: { id: postojeci.id }, data: podaci });
    } else {
      await db.rok.create({ data: podaci });
      noviRokovi++;
    }
  }
  console.log(`  Rokovi:     ${ROKOVI.length} (${noviRokovi} novih)`);

  // ── Izveštaj o verifikaciji ───────────────────────────────────────────────
  const nepotvrdjeneOdredbe = await db.odredba.count({
    where: { potvrdjenBrojClana: false },
  });
  const nepotvrdjeniParametri = await db.poreskiParametar.count({
    where: { verifikacija: "NEPOTVRDJENO" },
  });

  console.log("\n─────────────────────────────────────────────────────────");
  console.log("Stanje verifikacije:");
  console.log(
    `  Odredbe sa NEPOTVRĐENIM brojem člana: ${nepotvrdjeneOdredbe}`,
  );
  console.log(`  Parametri sa statusom NEPOTVRĐENO:    ${nepotvrdjeniParametri}`);
  console.log(
    "\nOve stavke se korisniku prikazuju sa upozorenjem i ne mogu da nose",
  );
  console.log("visoku pouzdanost odgovora. Dopunite ih komandom:");
  console.log("  npm run ingest");
  console.log("─────────────────────────────────────────────────────────\n");
  console.log("Gotovo.");
}

main()
  .catch((greska) => {
    console.error("Greška pri popunjavanju baze:", greska);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
