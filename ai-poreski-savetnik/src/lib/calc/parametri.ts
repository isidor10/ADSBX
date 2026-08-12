/**
 * Sloj između kalkulatora i pravne baze.
 *
 * Nijedna stopa, limit ni neoporezivi iznos ne sme da bude hardkodiran u
 * kalkulatoru. Sve se čita odavde, sa važenjem na traženi datum — zato
 * "koliko je bilo 2024?" radi bez ijednog `if` u obračunu, i zato promena
 * neoporezivog iznosa 1. februara znači izmenu jednog reda u bazi.
 */

import { dohvatiParametre } from "../legal/retrieval";
import type { RezultatObracuna } from "../types";

export class NedostajeParametar extends Error {
  constructor(public kljuc: string, public datum: Date) {
    super(
      `U pravnoj bazi nema parametra "${kljuc}" sa važenjem na dan ${datum
        .toISOString()
        .slice(0, 10)}. Obračun nije moguć bez potvrđene vrednosti — pokrenite "npm run seed" ili dopunite bazu.`,
    );
    this.name = "NedostajeParametar";
  }
}

export type UcitaniParametri = Awaited<ReturnType<typeof dohvatiParametre>>;

export interface KontekstObracuna {
  datum: Date;
  parametri: UcitaniParametri;
  koriscen: RezultatObracuna["koriscenParametri"];
}

export async function pripremiKontekst(
  kljucevi: string[],
  datum: Date,
): Promise<KontekstObracuna> {
  const parametri = await dohvatiParametre(kljucevi, datum);
  return { datum, parametri, koriscen: [] };
}

/**
 * Vraća brojčanu vrednost parametra i beleži ga kao korišćen, da bi rezultat
 * mogao da prikaže pravni osnov svakog broja koji je ušao u obračun.
 */
export function uzmi(ctx: KontekstObracuna, kljuc: string): number {
  const p = ctx.parametri.get(kljuc);
  if (!p) throw new NedostajeParametar(kljuc, ctx.datum);

  if (!ctx.koriscen.some((k) => k.kljuc === kljuc)) {
    ctx.koriscen.push({
      kljuc: p.kljuc,
      naziv: p.naziv,
      vrednost: p.vrednost,
      jedinica: p.jedinica,
      vaziOd: p.vaziOd.toISOString(),
      izvorUrl: p.izvorUrl,
      propis: p.propis?.naziv,
      clan: p.odredba
        ? `Član ${p.odredba.clan}${p.odredba.stav ? `, stav ${p.odredba.stav}` : ""}`
        : undefined,
      verifikacija: p.verifikacija,
    });
  }

  const broj = Number(p.vrednost);
  if (!Number.isFinite(broj)) {
    throw new Error(`Parametar "${kljuc}" nema brojčanu vrednost: ${p.vrednost}`);
  }
  return broj;
}

/** Postotak kao koeficijent: 20 → 0.20 */
export function procenat(ctx: KontekstObracuna, kljuc: string): number {
  return uzmi(ctx, kljuc) / 100;
}

/** Zaokruživanje na dve decimale bez akumulacije greške u prikazu. */
export function zaokruzi(n: number, decimala = 2): number {
  const f = 10 ** decimala;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function napomeneOVerifikaciji(
  ctx: KontekstObracuna,
): string[] {
  const nepotvrdjeni = ctx.koriscen.filter(
    (k) => k.verifikacija !== "POTVRDJENO",
  );
  if (nepotvrdjeni.length === 0) return [];
  return [
    `Sledeći parametri nisu potvrđeni prema zvaničnom izvoru i traže proveru: ${nepotvrdjeni
      .map((k) => k.naziv)
      .join(", ")}.`,
  ];
}
