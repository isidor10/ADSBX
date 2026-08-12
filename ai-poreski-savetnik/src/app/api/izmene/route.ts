import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { trenutniKorisnik } from "@/lib/auth";

export const runtime = "nodejs";

/** Feed izmena propisa (zahtev 16) + istorija verzija (zahtev 25). */
export async function GET(zahtev: Request) {
  const url = new URL(zahtev.url);
  const kategorija = url.searchParams.get("kategorija");
  const korisnik = await trenutniKorisnik();

  const pracenja = korisnik
    ? await db.pracenje.findMany({ where: { korisnikId: korisnik.id } })
    : [];
  const pracene = pracenja.map((p) => p.kategorija);

  const izmene = await db.izmena.findMany({
    where: kategorija ? { propis: { kategorija } } : {},
    include: {
      propis: { select: { naziv: true, skracenica: true, kategorija: true } },
      odredba: { select: { clan: true, stav: true, potvrdjenBrojClana: true } },
    },
    orderBy: { odKadaSePrimenjuje: "desc" },
    take: 100,
  });

  // Istorija verzija propisa — osnov za prikaz "2024 → 2025 → 2026".
  const verzije = await db.propisVerzija.findMany({
    include: { propis: { select: { naziv: true, skracenica: true } } },
    orderBy: { vaziOd: "desc" },
    take: 50,
  });

  return NextResponse.json({
    pracene,
    izmene: izmene.map((i) => ({
      id: i.id,
      naslov: i.naslov,
      propis: i.propis.naziv,
      skracenica: i.propis.skracenica,
      kategorija: i.propis.kategorija,
      clan:
        i.odredba && i.odredba.potvrdjenBrojClana
          ? `Član ${i.odredba.clan}${i.odredba.stav ? `, stav ${i.odredba.stav}` : ""}`
          : null,
      staraOdredba: i.staraOdredba,
      novaOdredba: i.novaOdredba,
      odKadaSePrimenjuje: i.odKadaSePrimenjuje.toISOString(),
      kogaPogadja: i.kogaPogadja,
      staTrebaUraditi: i.staTrebaUraditi,
      izvorUrl: i.izvorUrl,
      sluzbeniGlasnik: i.sluzbeniGlasnik,
      objavljena: i.objavljena.toISOString(),
    })),
    verzije: verzije.map((v) => ({
      propis: v.propis.naziv,
      skracenica: v.propis.skracenica,
      oznaka: v.oznakaVerzije,
      vaziOd: v.vaziOd.toISOString(),
      vaziDo: v.vaziDo?.toISOString() ?? null,
      opisIzmene: v.opisIzmene,
      sluzbeniGlasnik: v.sluzbeniGlasnik,
    })),
    napomena:
      izmene.length === 0
        ? "Nema zabeleženih izmena propisa. Praćenje izmena se popunjava pokretanjem komande „npm run izmene”, koja poredi tekuće tekstove propisa sa prethodno sačuvanim verzijama."
        : null,
  });
}

const Pretplata = z.object({
  kategorije: z.array(z.string()).max(20),
});

/** Pretplata na praćenje izmena po oblastima. */
export async function POST(zahtev: Request) {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) {
    return NextResponse.json(
      { greska: "Za praćenje izmena potrebno je da budete prijavljeni." },
      { status: 401 },
    );
  }

  const provera = Pretplata.safeParse(await zahtev.json().catch(() => null));
  if (!provera.success) {
    return NextResponse.json({ greska: "Neispravan zahtev." }, { status: 400 });
  }

  await db.pracenje.deleteMany({ where: { korisnikId: korisnik.id } });
  for (const kategorija of provera.data.kategorije) {
    await db.pracenje.create({
      data: { korisnikId: korisnik.id, kategorija },
    });
  }

  return NextResponse.json({ pracene: provera.data.kategorije });
}
