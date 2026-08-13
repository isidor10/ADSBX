import { NextResponse } from "next/server";
import { smeDaSeRegistruje } from "@/lib/pristup";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  hesirajLozinku,
  kljucKlijenta,
  napraviSesiju,
  odjavi,
  ogranici,
  proveriLozinku,
  trenutniKorisnik,
} from "@/lib/auth";

export const runtime = "nodejs";

const Prijava = z.object({
  akcija: z.enum(["registracija", "prijava", "odjava"]),
  /** Pozivni kod, kada je aplikacija objavljena i kod je podešen. */
  kod: z.string().max(200).optional(),
  email: z.string().email().optional(),
  lozinka: z.string().min(8).max(200).optional(),
  ime: z.string().max(120).optional(),
});

export async function GET() {
  const korisnik = await trenutniKorisnik();
  return NextResponse.json({ korisnik });
}

export async function POST(zahtev: Request) {
  const provera = Prijava.safeParse(await zahtev.json().catch(() => null));
  if (!provera.success) {
    return NextResponse.json(
      { greska: "Neispravan zahtev. Lozinka mora imati najmanje 8 znakova." },
      { status: 400 },
    );
  }
  const { akcija, email, lozinka, ime, kod } = provera.data;

  if (akcija === "odjava") {
    await odjavi();
    return NextResponse.json({ ok: true });
  }

  if (!email || !lozinka) {
    return NextResponse.json(
      { greska: "Email i lozinka su obavezni." },
      { status: 400 },
    );
  }

  // Ograničenje pokušaja prijave — usporava probanje lozinki.
  const limit = ogranici(`auth:${kljucKlijenta(zahtev)}`, 10, 15 * 60 * 1000);
  if (!limit.dozvoljeno) {
    return NextResponse.json(
      { greska: "Previše pokušaja. Pokušajte ponovo za 15 minuta." },
      { status: 429 },
    );
  }

  if (akcija === "registracija") {
    const postojeci = await db.korisnik.findUnique({ where: { email } });
    if (postojeci) {
      return NextResponse.json(
        { greska: "Korisnik sa tim email-om već postoji." },
        { status: 409 },
      );
    }

    // Prvi registrovani korisnik postaje administrator — inače admin panel
    // ne bi bio dostupan nikome pri prvom pokretanju.
    const brojKorisnika = await db.korisnik.count();

    // Objavljena aplikacija troši ključ vlasnika, pa nalog ne sme da otvori
    // bilo ko ko naiđe na adresu. Prvi korisnik je izuzet: njemu kod nema ko
    // da da, a bez njega bi aplikacija bila zaključana i za vlasnika.
    const odluka = smeDaSeRegistruje(email, kod, brojKorisnika === 0);
    if (!odluka.dozvoljeno) {
      return NextResponse.json({ greska: odluka.razlog }, { status: 403 });
    }

    const korisnik = await db.korisnik.create({
      data: {
        email,
        lozinkaHash: await hesirajLozinku(lozinka),
        ime: ime ?? null,
        uloga: brojKorisnika === 0 ? "ADMIN" : "KORISNIK",
      },
    });

    await napraviSesiju(korisnik.id);
    return NextResponse.json({
      korisnik: {
        id: korisnik.id,
        email: korisnik.email,
        ime: korisnik.ime,
        uloga: korisnik.uloga,
      },
    });
  }

  const korisnik = await db.korisnik.findUnique({ where: { email } });
  // Ista poruka i za nepostojeći email i za pogrešnu lozinku — ne otkrivamo
  // koji su email-ovi registrovani.
  const nevalidno = NextResponse.json(
    { greska: "Pogrešan email ili lozinka." },
    { status: 401 },
  );
  if (!korisnik) return nevalidno;
  if (!(await proveriLozinku(lozinka, korisnik.lozinkaHash))) return nevalidno;

  await napraviSesiju(korisnik.id);
  return NextResponse.json({
    korisnik: {
      id: korisnik.id,
      email: korisnik.email,
      ime: korisnik.ime,
      uloga: korisnik.uloga,
    },
  });
}
