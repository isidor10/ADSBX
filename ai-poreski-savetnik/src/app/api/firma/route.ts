import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { trenutniKorisnik } from "@/lib/auth";

export const runtime = "nodejs";

const PRAVNE_FORME = [
  "FIZICKO_LICE",
  "PREDUZETNIK_PAUSALAC",
  "PREDUZETNIK_KNJIGAS",
  "PREDUZETNIK_LICNA_ZARADA",
  "DOO",
  "AD",
  "DRUGO_PRAVNO_LICE",
] as const;

const Firma = z.object({
  naziv: z.string().min(1).max(200),
  pib: z.string().regex(/^\d{9}$/, "PIB mora imati 9 cifara.").optional().or(z.literal("")),
  maticniBroj: z
    .string()
    .regex(/^\d{8}$/, "Matični broj mora imati 8 cifara.")
    .optional()
    .or(z.literal("")),
  pravnaForma: z.enum(PRAVNE_FORME),
  sifraDelatnosti: z.string().max(10).optional().or(z.literal("")),
  nazivDelatnosti: z.string().max(200).optional().or(z.literal("")),
  pdvStatus: z.enum(["U_SISTEMU", "VAN_SISTEMA", "DOBROVOLJNO"]),
  pdvPeriod: z.enum(["MESECNI", "KVARTALNI"]).optional().or(z.literal("")),
  nacinOporezivanja: z.string().max(100).optional().or(z.literal("")),
  brojZaposlenih: z.coerce.number().int().min(0).max(100000).default(0),
  sediste: z.string().max(200).optional().or(z.literal("")),
  poslovneJedinice: z.array(z.string().max(200)).default([]),
  napomena: z.string().max(2000).optional().or(z.literal("")),
});

function prazniUNull(v: string | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

export async function GET() {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) {
    return NextResponse.json({ firme: [], prijavljen: false });
  }
  const firme = await db.firma.findMany({
    where: { korisnikId: korisnik.id },
    orderBy: { kreirana: "asc" },
  });
  return NextResponse.json({
    prijavljen: true,
    firme: firme.map((f) => ({
      ...f,
      poslovneJedinice: JSON.parse(f.poslovneJedinice) as string[],
    })),
  });
}

export async function POST(zahtev: Request) {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) {
    return NextResponse.json(
      { greska: "Za čuvanje profila firme potrebno je da budete prijavljeni." },
      { status: 401 },
    );
  }

  const provera = Firma.safeParse(await zahtev.json().catch(() => null));
  if (!provera.success) {
    return NextResponse.json(
      {
        greska: "Neispravni podaci o firmi.",
        detalji: provera.error.issues.map((i) => ({
          polje: i.path.join("."),
          poruka: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const d = provera.data;
  const firma = await db.firma.create({
    data: {
      korisnikId: korisnik.id,
      naziv: d.naziv,
      pib: prazniUNull(d.pib),
      maticniBroj: prazniUNull(d.maticniBroj),
      pravnaForma: d.pravnaForma,
      sifraDelatnosti: prazniUNull(d.sifraDelatnosti),
      nazivDelatnosti: prazniUNull(d.nazivDelatnosti),
      pdvStatus: d.pdvStatus,
      pdvPeriod: prazniUNull(d.pdvPeriod),
      nacinOporezivanja: prazniUNull(d.nacinOporezivanja),
      brojZaposlenih: d.brojZaposlenih,
      sediste: prazniUNull(d.sediste),
      poslovneJedinice: JSON.stringify(d.poslovneJedinice),
      napomena: prazniUNull(d.napomena),
    },
  });

  return NextResponse.json({
    firma: { ...firma, poslovneJedinice: d.poslovneJedinice },
  });
}

export async function PUT(zahtev: Request) {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) {
    return NextResponse.json({ greska: "Niste prijavljeni." }, { status: 401 });
  }

  const telo = await zahtev.json().catch(() => null);
  const id = (telo as { id?: string })?.id;
  if (!id) {
    return NextResponse.json({ greska: "Nedostaje id firme." }, { status: 400 });
  }

  const postojeca = await db.firma.findFirst({
    where: { id, korisnikId: korisnik.id },
  });
  if (!postojeca) {
    return NextResponse.json({ greska: "Firma nije pronađena." }, { status: 404 });
  }

  const provera = Firma.safeParse(telo);
  if (!provera.success) {
    return NextResponse.json(
      { greska: "Neispravni podaci o firmi." },
      { status: 400 },
    );
  }

  const d = provera.data;
  const firma = await db.firma.update({
    where: { id },
    data: {
      naziv: d.naziv,
      pib: prazniUNull(d.pib),
      maticniBroj: prazniUNull(d.maticniBroj),
      pravnaForma: d.pravnaForma,
      sifraDelatnosti: prazniUNull(d.sifraDelatnosti),
      nazivDelatnosti: prazniUNull(d.nazivDelatnosti),
      pdvStatus: d.pdvStatus,
      pdvPeriod: prazniUNull(d.pdvPeriod),
      nacinOporezivanja: prazniUNull(d.nacinOporezivanja),
      brojZaposlenih: d.brojZaposlenih,
      sediste: prazniUNull(d.sediste),
      poslovneJedinice: JSON.stringify(d.poslovneJedinice),
      napomena: prazniUNull(d.napomena),
    },
  });

  return NextResponse.json({
    firma: { ...firma, poslovneJedinice: d.poslovneJedinice },
  });
}
