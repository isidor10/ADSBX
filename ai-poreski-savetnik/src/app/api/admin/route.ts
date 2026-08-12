import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { GreskaPristupa, zahtevajAdmina } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await zahtevajAdmina();
  } catch (greska) {
    if (greska instanceof GreskaPristupa) {
      return NextResponse.json({ greska: greska.message }, { status: 403 });
    }
    throw greska;
  }

  const [
    brojKorisnika,
    brojRazgovora,
    brojPoruka,
    brojDokumenata,
    brojPropisa,
    brojOdredbi,
    nepotvrdjeneOdredbe,
    nepotvrdjeniParametri,
  ] = await Promise.all([
    db.korisnik.count(),
    db.razgovor.count(),
    db.poruka.count({ where: { uloga: "asistent" } }),
    db.dokument.count(),
    db.propis.count(),
    db.odredba.count(),
    db.odredba.count({ where: { potvrdjenBrojClana: false } }),
    db.poreskiParametar.count({ where: { verifikacija: "NEPOTVRDJENO" } }),
  ]);

  // Raspodela pouzdanosti — glavni pokazatelj kvaliteta sistema.
  const poPouzdanosti = await db.poruka.groupBy({
    by: ["nivoPouzdanosti"],
    where: { uloga: "asistent", nivoPouzdanosti: { not: null } },
    _count: true,
  });

  // Najčešće korišćeni propisi — pokazuje gde treba prvo dopuniti bazu.
  const citati = await db.citat.findMany({
    where: { odredbaId: { not: null } },
    include: {
      odredba: {
        include: { propis: { select: { naziv: true, skracenica: true } } },
      },
    },
    take: 2000,
  });
  const brojacPropisa = new Map<string, number>();
  for (const c of citati) {
    const naziv = c.odredba?.propis.naziv;
    if (naziv) brojacPropisa.set(naziv, (brojacPropisa.get(naziv) ?? 0) + 1);
  }

  const auditi = await db.auditZapis.findMany({
    orderBy: { kreiran: "desc" },
    take: 500,
    select: {
      odbaceniCitati: true,
      webPretraga: true,
      trajanjeMs: true,
      pitanje: true,
      kreiran: true,
    },
  });

  const ukupnoOdbacenih = auditi.reduce(
    (s, a) => s + (JSON.parse(a.odbaceniCitati) as string[]).length,
    0,
  );
  const saOdbacenim = auditi.filter(
    (a) => (JSON.parse(a.odbaceniCitati) as string[]).length > 0,
  ).length;

  const neodgovorena = await db.neodgovorenoPitanje.findMany({
    orderBy: [{ brojPuta: "desc" }, { poslednji: "desc" }],
    take: 50,
  });

  const zaProveru = await db.poruka.findMany({
    where: { uloga: "asistent", ocena: null },
    orderBy: { kreirana: "desc" },
    take: 25,
    select: {
      id: true,
      sadrzaj: true,
      nivoPouzdanosti: true,
      kreirana: true,
      razgovor: { select: { naslov: true } },
    },
  });

  const poslednjeAzuriranje = await db.propis.findFirst({
    orderBy: { poslednjaProvera: "desc" },
    select: { poslednjaProvera: true, naziv: true },
  });

  return NextResponse.json({
    statistika: {
      brojKorisnika,
      brojRazgovora,
      brojOdgovora: brojPoruka,
      brojDokumenata,
      brojPropisa,
      brojOdredbi,
    },
    kvalitet: {
      poPouzdanosti: poPouzdanosti.map((p) => ({
        nivo: p.nivoPouzdanosti,
        broj: p._count,
      })),
      ukupnoOdbacenihCitata: ukupnoOdbacenih,
      odgovoraSaOdbacenimCitatom: saOdbacenim,
      procenatSaOdbacenim:
        auditi.length > 0
          ? Number(((saOdbacenim / auditi.length) * 100).toFixed(1))
          : 0,
      prosecnoTrajanjeMs:
        auditi.length > 0
          ? Math.round(
              auditi.reduce((s, a) => s + (a.trajanjeMs ?? 0), 0) / auditi.length,
            )
          : 0,
      udeoSaWebPretragom:
        auditi.length > 0
          ? Number(
              (
                (auditi.filter((a) => a.webPretraga).length / auditi.length) *
                100
              ).toFixed(1),
            )
          : 0,
    },
    pravnaBaza: {
      nepotvrdjeneOdredbe,
      nepotvrdjeniParametri,
      poslednjeAzuriranje: poslednjeAzuriranje?.poslednjaProvera?.toISOString() ?? null,
    },
    najcesciPropisi: [...brojacPropisa.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([naziv, broj]) => ({ naziv, broj })),
    neodgovorenaPitanja: neodgovorena.map((n) => ({
      id: n.id,
      pitanje: n.pitanje,
      razlog: n.razlog,
      oblast: n.oblast,
      brojPuta: n.brojPuta,
      poslednji: n.poslednji.toISOString(),
    })),
    zaProveru: zaProveru.map((p) => ({
      id: p.id,
      sadrzaj: p.sadrzaj,
      nivoPouzdanosti: p.nivoPouzdanosti,
      razgovor: p.razgovor.naslov,
      kreirana: p.kreirana.toISOString(),
    })),
  });
}

const Ocena = z.object({
  porukaId: z.string(),
  ocena: z.enum(["POUZDAN", "POTREBNA_STRUCNA_PROVERA"]),
  komentar: z.string().max(2000).optional(),
});

/** Ručna ocena odgovora (zahtev 34). */
export async function POST(zahtev: Request) {
  let admin;
  try {
    admin = await zahtevajAdmina();
  } catch (greska) {
    if (greska instanceof GreskaPristupa) {
      return NextResponse.json({ greska: greska.message }, { status: 403 });
    }
    throw greska;
  }

  const provera = Ocena.safeParse(await zahtev.json().catch(() => null));
  if (!provera.success) {
    return NextResponse.json({ greska: "Neispravan zahtev." }, { status: 400 });
  }

  const { porukaId, ocena, komentar } = provera.data;
  const zapis = await db.adminOcena.upsert({
    where: { porukaId },
    create: { porukaId, ocena, komentar: komentar ?? null, ocenio: admin.email },
    update: { ocena, komentar: komentar ?? null, ocenio: admin.email },
  });

  return NextResponse.json({ ocena: zapis });
}
