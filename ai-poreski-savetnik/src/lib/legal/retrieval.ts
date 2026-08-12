/**
 * RAG nad pravnom bazom.
 *
 * Hibrid: BM25 (leksički) + embeddings (semantički) + direktan pogodak člana +
 * temporalni filter. Rangiranje je namerno konzervativno — bolje je vratiti
 * odredbu previše nego propustiti onu koja je pravni osnov.
 */

import { db } from "../db";
import type { PronadjenaOdredba } from "../types";
import { LeksickiIndeks, normalizujSkorove } from "./bm25";
import {
  aktivniProvider,
  izracunajEmbeddinge,
  kosinusnaSlicnost,
} from "./embeddings";
import { prepoznajReferencuClana, uLatinicu } from "./normalize";
import { statusNaDatum, temporalniUslovSaIstorijom } from "./temporal";

const TEZINA_LEKSICKI = 0.55;
const TEZINA_SEMANTICKI = 0.45;
/** Direktan pogodak člana nadjačava sve ostalo — zahtev 31. */
const BONUS_DIREKTAN_CLAN = 2.0;
/** Zvanični izvori se rangiraju iznad stručnih — zahtev 5. */
const BONUS_PRIMARNI_IZVOR = 0.15;
/** Odredba koja ne važi na ciljni datum pada, ali se ne izbacuje. */
const PENAL_NE_VAZI = 0.4;

type OdredbaIzBaze = Awaited<ReturnType<typeof ucitajOdredbe>>[number];

async function ucitajOdredbe(ciljniDatum: Date, kategorije?: string[]) {
  return db.odredba.findMany({
    where: {
      ...temporalniUslovSaIstorijom(ciljniDatum),
      ...(kategorije?.length
        ? { propis: { kategorija: { in: kategorije } } }
        : {}),
    },
    include: {
      propis: {
        select: {
          naziv: true,
          skracenica: true,
          tip: true,
          kategorija: true,
          izvorInstitucija: true,
          prioritetIzvora: true,
          verifikacija: true,
        },
      },
      vektor: { select: { vektor: true } },
    },
  });
}

/** Keš indeksa — gradnja BM25 nad celim korpusom nije besplatna po zahtevu. */
let kesIndeksa: { indeks: LeksickiIndeks; kljuc: string; vreme: number } | null =
  null;
const TRAJANJE_KESA_MS = 5 * 60_000;

function dohvatiIndeks(odredbe: OdredbaIzBaze[], kljuc: string): LeksickiIndeks {
  if (
    kesIndeksa &&
    kesIndeksa.kljuc === kljuc &&
    Date.now() - kesIndeksa.vreme < TRAJANJE_KESA_MS
  ) {
    return kesIndeksa.indeks;
  }
  const indeks = new LeksickiIndeks(
    odredbe.map((o) => ({
      id: o.id,
      tekst: o.tekst,
      pojacanje: [
        o.naslov ?? "",
        o.propis.naziv,
        o.propis.skracenica,
        `clan ${o.clan}`,
      ].join(" "),
    })),
  );
  kesIndeksa = { indeks, kljuc, vreme: Date.now() };
  return indeks;
}

/** Poziva se posle ingesta — sledeći upit gradi svež indeks. */
export function ponistiKesIndeksa(): void {
  kesIndeksa = null;
}

export interface OpcijePretrage {
  upit: string;
  ciljniDatum?: Date;
  kategorije?: string[];
  limit?: number;
}

export async function pretraziPravnuBazu(
  opcije: OpcijePretrage,
): Promise<PronadjenaOdredba[]> {
  const ciljniDatum = opcije.ciljniDatum ?? new Date();
  const limit = opcije.limit ?? 12;

  const odredbe = await ucitajOdredbe(ciljniDatum, opcije.kategorije);
  if (odredbe.length === 0) return [];

  const kljucKesa = `${ciljniDatum.toISOString().slice(0, 10)}|${(
    opcije.kategorije ?? []
  ).join(",")}|${odredbe.length}`;

  // ── 1. Leksički sloj ────────────────────────────────────────────────────
  const indeks = dohvatiIndeks(odredbe, kljucKesa);
  const leksicki = normalizujSkorove(indeks.pretrazi(opcije.upit, 60));

  // ── 2. Semantički sloj (ako je podešen provider) ────────────────────────
  const semanticki = new Map<string, number>();
  if (aktivniProvider() !== "none") {
    try {
      const vektori = await izracunajEmbeddinge([opcije.upit]);
      if (vektori?.[0]) {
        const upitVektor = vektori[0];
        for (const o of odredbe) {
          if (!o.vektor) continue;
          const v = JSON.parse(o.vektor.vektor) as number[];
          semanticki.set(o.id, kosinusnaSlicnost(upitVektor, v));
        }
      }
    } catch (greska) {
      // Semantika je pojačanje, ne preduslov. Ako otkaže, leksička pretraga
      // i dalje daje upotrebljiv rezultat — bolje nego prazan odgovor.
      console.error("[retrieval] semantički sloj nedostupan:", greska);
    }
  }

  // ── 3. Direktan pogodak člana ───────────────────────────────────────────
  const referenca = prepoznajReferencuClana(opcije.upit);

  // ── 4. Spajanje i rangiranje ────────────────────────────────────────────
  const rangirane = odredbe
    .map((o) => {
      const lex = leksicki.get(o.id) ?? 0;
      const sem = semanticki.get(o.id) ?? 0;

      let skor =
        semanticki.size > 0
          ? TEZINA_LEKSICKI * lex + TEZINA_SEMANTICKI * sem
          : lex;

      if (referenca && o.clan === referenca.clan) {
        const propisOdgovara =
          !referenca.propisTekst ||
          uLatinicu(o.propis.naziv)
            .toLowerCase()
            .includes(uLatinicu(referenca.propisTekst).toLowerCase()) ||
          uLatinicu(o.propis.skracenica)
            .toLowerCase()
            .includes(uLatinicu(referenca.propisTekst).toLowerCase());
        if (propisOdgovara) {
          skor += BONUS_DIREKTAN_CLAN;
          if (referenca.stav && o.stav === referenca.stav) skor += 0.5;
        }
      }

      if (o.propis.prioritetIzvora <= 5) skor += BONUS_PRIMARNI_IZVOR;

      const status = statusNaDatum(
        { vaziOd: o.vaziOd, vaziDo: o.vaziDo, tipPropisa: o.propis.tip },
        ciljniDatum,
      );
      if (status !== "VAZI") skor -= PENAL_NE_VAZI;

      const rezultat: PronadjenaOdredba = {
        id: o.id,
        propisNaziv: o.propis.naziv,
        propisSkracenica: o.propis.skracenica,
        propisTip: o.propis.tip,
        kategorija: o.propis.kategorija,
        clan: o.clan,
        stav: o.stav,
        tacka: o.tacka,
        podtacka: o.podtacka,
        naslov: o.naslov,
        tekst: o.tekst,
        doslovanTekst: o.doslovanTekst,
        potvrdjenBrojClana: o.potvrdjenBrojClana,
        vaziOd: o.vaziOd,
        vaziDo: o.vaziDo,
        izvorUrl: o.izvorUrl,
        deepLink: o.deepLink,
        institucija: o.propis.izvorInstitucija,
        prioritetIzvora: o.propis.prioritetIzvora,
        verifikacija: o.propis.verifikacija,
        statusVazenja: status,
        skor,
      };
      return rezultat;
    })
    .filter((o) => o.skor > 0.02)
    .sort((a, b) => b.skor - a.skor);

  return rangirane.slice(0, limit);
}

/**
 * Pretraga po tačnom članu — koristi je stranica "Pretraži propise" i pitanje
 * tipa "šta kaže član 29 Zakona o PDV". Ako više propisa ima taj član, vraćamo
 * sve i UI pita korisnika na koji je mislio (zahtev 31).
 */
export async function pretraziPoClanu(
  clan: string,
  propisTekst?: string,
): Promise<PronadjenaOdredba[]> {
  const odredbe = await db.odredba.findMany({
    where: { clan },
    include: {
      propis: {
        select: {
          naziv: true,
          skracenica: true,
          tip: true,
          kategorija: true,
          izvorInstitucija: true,
          prioritetIzvora: true,
          verifikacija: true,
        },
      },
    },
    orderBy: [{ stav: "asc" }],
  });

  const danas = new Date();
  return odredbe
    .filter((o) => {
      if (!propisTekst) return true;
      const t = uLatinicu(propisTekst).toLowerCase();
      return (
        uLatinicu(o.propis.naziv).toLowerCase().includes(t) ||
        uLatinicu(o.propis.skracenica).toLowerCase().includes(t)
      );
    })
    .map((o) => ({
      id: o.id,
      propisNaziv: o.propis.naziv,
      propisSkracenica: o.propis.skracenica,
      propisTip: o.propis.tip,
      kategorija: o.propis.kategorija,
      clan: o.clan,
      stav: o.stav,
      tacka: o.tacka,
      podtacka: o.podtacka,
      naslov: o.naslov,
      tekst: o.tekst,
      doslovanTekst: o.doslovanTekst,
      potvrdjenBrojClana: o.potvrdjenBrojClana,
      vaziOd: o.vaziOd,
      vaziDo: o.vaziDo,
      izvorUrl: o.izvorUrl,
      deepLink: o.deepLink,
      institucija: o.propis.izvorInstitucija,
      prioritetIzvora: o.propis.prioritetIzvora,
      verifikacija: o.propis.verifikacija,
      statusVazenja: statusNaDatum(
        { vaziOd: o.vaziOd, vaziDo: o.vaziDo, tipPropisa: o.propis.tip },
        danas,
      ),
      skor: 1,
    }));
}

/**
 * Poreski parametar koji je važio na dati datum. Kalkulatori zovu ovo umesto
 * da imaju stopu u kodu — zato "koliko je bilo 2024" radi bez grananja.
 */
export async function dohvatiParametar(kljuc: string, ciljniDatum: Date) {
  return db.poreskiParametar.findFirst({
    where: {
      kljuc,
      vaziOd: { lte: ciljniDatum },
      OR: [{ vaziDo: null }, { vaziDo: { gt: ciljniDatum } }],
    },
    orderBy: { vaziOd: "desc" },
    include: {
      odredba: { select: { clan: true, stav: true } },
      propis: { select: { naziv: true, skracenica: true } },
    },
  });
}

export async function dohvatiParametre(kljucevi: string[], ciljniDatum: Date) {
  const rezultat = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof dohvatiParametar>>>
  >();
  for (const kljuc of kljucevi) {
    const p = await dohvatiParametar(kljuc, ciljniDatum);
    if (p) rezultat.set(kljuc, p);
  }
  return rezultat;
}
