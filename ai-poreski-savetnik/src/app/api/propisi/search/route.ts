import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  pretraziPoClanu,
  pretraziPravnuBazu,
} from "@/lib/legal/retrieval";
import {
  prepoznajCiljniDatum,
  prepoznajReferencuClana,
} from "@/lib/legal/normalize";
import { formatirajOznakuClana } from "@/lib/legal/citations";
import { OPIS_STATUSA } from "@/lib/legal/temporal";
import type { PronadjenaOdredba } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(zahtev: Request) {
  const url = new URL(zahtev.url);
  const upit = (url.searchParams.get("q") ?? "").trim();
  const kategorija = url.searchParams.get("kategorija") ?? undefined;
  const datumParam = url.searchParams.get("datum");

  if (upit.length < 2) {
    // Bez upita — pregled propisa u bazi, da stranica nikad ne bude prazna.
    const propisi = await db.propis.findMany({
      orderBy: [{ prioritetIzvora: "asc" }, { naziv: "asc" }],
      select: {
        id: true,
        naziv: true,
        skracenica: true,
        tip: true,
        kategorija: true,
        izvorInstitucija: true,
        izvorUrl: true,
        verifikacija: true,
        sluzbeniGlasnik: true,
        _count: { select: { odredbe: true } },
      },
    });
    return NextResponse.json({
      rezim: "pregled",
      propisi: propisi.map((p) => ({
        ...p,
        brojOdredbi: p._count.odredbe,
        sluzbeniGlasnik: JSON.parse(p.sluzbeniGlasnik) as string[],
      })),
      rezultati: [],
    });
  }

  const ciljniDatum = datumParam
    ? new Date(datumParam)
    : prepoznajCiljniDatum(upit);

  // Ako korisnik traži konkretan član, prvo probamo tačan pogodak.
  const referenca = prepoznajReferencuClana(upit);
  let rezultati: PronadjenaOdredba[] = [];
  let rezim = "pretraga";

  if (referenca) {
    const poClanu = await pretraziPoClanu(referenca.clan, referenca.propisTekst);
    if (poClanu.length > 0) {
      rezultati = poClanu;
      rezim = "po_clanu";
    }
  }

  if (rezultati.length === 0) {
    rezultati = await pretraziPravnuBazu({
      upit,
      ciljniDatum,
      kategorije: kategorija ? [kategorija] : undefined,
      limit: 25,
    });
  }

  // Više propisa sa istim brojem člana — UI pita korisnika na koji misli.
  const razliciti = new Set(rezultati.map((r) => r.propisSkracenica));
  const visestrukoTumacenje = rezim === "po_clanu" && razliciti.size > 1;

  return NextResponse.json({
    rezim,
    upit,
    ciljniDatum: ciljniDatum.toISOString(),
    visestrukoTumacenje,
    propisiSaTimClanom: visestrukoTumacenje ? [...razliciti] : [],
    rezultati: rezultati.map((r) => ({
      id: r.id,
      propis: r.propisNaziv,
      skracenica: r.propisSkracenica,
      tip: r.propisTip,
      kategorija: r.kategorija,
      oznaka: formatirajOznakuClana(r),
      potvrdjen: r.potvrdjenBrojClana,
      naslov: r.naslov,
      tekst: r.tekst,
      doslovanTekst: r.doslovanTekst,
      status: r.statusVazenja,
      statusOznaka: OPIS_STATUSA[r.statusVazenja],
      vaziOd: r.vaziOd.toISOString(),
      vaziDo: r.vaziDo?.toISOString() ?? null,
      izvorUrl: r.deepLink ?? r.izvorUrl,
      institucija: r.institucija,
      verifikacija: r.verifikacija,
      skor: Number(r.skor.toFixed(3)),
    })),
  });
}
