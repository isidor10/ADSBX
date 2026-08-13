/**
 * Autentifikacija — sesijski kolačić + scrypt heš lozinke.
 *
 * Namerno bez spoljne biblioteke: potrebe su male (email + lozinka, dve uloge),
 * a scrypt i timingSafeEqual iz standardne biblioteke pokrivaju ono što je
 * bitno — spor heš i poređenje otporno na merenje vremena.
 */

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db } from "./db";

const scryptAsync = promisify(scrypt);

const NAZIV_KOLACICA = "aps_sesija";
const TRAJANJE_SESIJE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dana

const KOLACIC_GOSTA = "aps_gost";
const TRAJANJE_GOSTA_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Oznaka pregledača za neprijavljenog posetioca.
 *
 * Razgovori vođeni bez naloga svi imaju `korisnikId: null`. Da istorija ne bi
 * jednom posetiocu pokazala tuđa pitanja — a poreska pitanja su po pravilu
 * poverljiva — svaki pregledač dobija nasumičnu oznaku i vidi samo svoje.
 * Nije zamena za nalog: ko obriše kolačiće, izgubi pristup toj istoriji.
 */
export async function idGosta(): Promise<string> {
  const kolacici = await cookies();
  const postojeci = kolacici.get(KOLACIC_GOSTA)?.value;
  if (postojeci) return postojeci;

  const nov = randomBytes(16).toString("hex");
  kolacici.set(KOLACIC_GOSTA, nov, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TRAJANJE_GOSTA_MS / 1000,
  });
  return nov;
}

/** Čita oznaku gosta bez postavljanja — za rute koje samo čitaju. */
export async function idGostaBezStvaranja(): Promise<string | null> {
  const kolacici = await cookies();
  return kolacici.get(KOLACIC_GOSTA)?.value ?? null;
}

export async function hesirajLozinku(lozinka: string): Promise<string> {
  const so = randomBytes(16);
  const izvedeni = (await scryptAsync(lozinka, so, 64)) as Buffer;
  return `${so.toString("hex")}:${izvedeni.toString("hex")}`;
}

export async function proveriLozinku(
  lozinka: string,
  hes: string,
): Promise<boolean> {
  const [soHex, kljucHex] = hes.split(":");
  if (!soHex || !kljucHex) return false;
  const izvedeni = (await scryptAsync(
    lozinka,
    Buffer.from(soHex, "hex"),
    64,
  )) as Buffer;
  const ocekivani = Buffer.from(kljucHex, "hex");
  if (ocekivani.length !== izvedeni.length) return false;
  return timingSafeEqual(izvedeni, ocekivani);
}

/** U bazi se čuva samo heš tokena — krađa baze ne daje upotrebljive sesije. */
function hesTokena(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function napraviSesiju(korisnikId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.sesija.create({
    data: {
      korisnikId,
      tokenHash: hesTokena(token),
      istice: new Date(Date.now() + TRAJANJE_SESIJE_MS),
    },
  });

  const kolacici = await cookies();
  kolacici.set(NAZIV_KOLACICA, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TRAJANJE_SESIJE_MS / 1000,
  });

  return token;
}

export interface TrenutniKorisnik {
  id: string;
  email: string;
  ime: string | null;
  uloga: string;
}

export async function trenutniKorisnik(): Promise<TrenutniKorisnik | null> {
  const kolacici = await cookies();
  const token = kolacici.get(NAZIV_KOLACICA)?.value;
  if (!token) return null;

  const sesija = await db.sesija.findUnique({
    where: { tokenHash: hesTokena(token) },
    include: { korisnik: true },
  });

  if (!sesija || sesija.istice.getTime() < Date.now()) {
    if (sesija) await db.sesija.delete({ where: { id: sesija.id } }).catch(() => {});
    return null;
  }

  return {
    id: sesija.korisnik.id,
    email: sesija.korisnik.email,
    ime: sesija.korisnik.ime,
    uloga: sesija.korisnik.uloga,
  };
}

export async function odjavi(): Promise<void> {
  const kolacici = await cookies();
  const token = kolacici.get(NAZIV_KOLACICA)?.value;
  if (token) {
    await db.sesija
      .deleteMany({ where: { tokenHash: hesTokena(token) } })
      .catch(() => {});
  }
  kolacici.delete(NAZIV_KOLACICA);
}

export async function zahtevajAdmina(): Promise<TrenutniKorisnik> {
  const korisnik = await trenutniKorisnik();
  if (!korisnik || korisnik.uloga !== "ADMIN") {
    throw new GreskaPristupa("Potrebna su administratorska prava.");
  }
  return korisnik;
}

export class GreskaPristupa extends Error {
  constructor(poruka: string) {
    super(poruka);
    this.name = "GreskaPristupa";
  }
}

// ── Ograničavanje broja zahteva ─────────────────────────────────────────────
// Prost brojač u memoriji. Za više instanci — zameniti Redis-om; interfejs
// ostaje isti.
const brojaci = new Map<string, { broj: number; resetUMs: number }>();

export function ogranici(
  kljuc: string,
  maksZahteva: number,
  prozorMs: number,
): { dozvoljeno: boolean; preostalo: number; resetZa: number } {
  const sada = Date.now();
  const zapis = brojaci.get(kljuc);

  if (!zapis || zapis.resetUMs < sada) {
    brojaci.set(kljuc, { broj: 1, resetUMs: sada + prozorMs });
    return { dozvoljeno: true, preostalo: maksZahteva - 1, resetZa: prozorMs };
  }

  zapis.broj++;
  return {
    dozvoljeno: zapis.broj <= maksZahteva,
    preostalo: Math.max(0, maksZahteva - zapis.broj),
    resetZa: zapis.resetUMs - sada,
  };
}

export function kljucKlijenta(zahtev: Request, korisnikId?: string): string {
  if (korisnikId) return `k:${korisnikId}`;
  const ip =
    zahtev.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    zahtev.headers.get("x-real-ip") ??
    "nepoznat";
  return `ip:${ip}`;
}
