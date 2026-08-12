/**
 * Citiranje članova (zahtevi 2, 3, 9).
 *
 * Ključna odluka: model NE piše broj člana kao slobodan tekst. Model vraća
 * `citatId` — identifikator odredbe koja mu je bila u kontekstu — a aplikacija
 * sama renderuje naziv propisa, član, stav i link iz baze. Broj člana zato ne
 * može da bude halucinacija; najgore što model može je da pokaže na pogrešnu
 * odredbu, a to je vidljivo jer se uz citat prikazuje i tekst odredbe.
 */

import type { PronadjenaOdredba } from "../types";
import { OPIS_STATUSA } from "./temporal";

export interface RenderovanCitat {
  id: string;
  propis: string;
  propisPun: string;
  /** Formatirana oznaka: "Član 29, stav 1, tačka 1)" ili poruka o nepotvrđenom članu. */
  oznaka: string;
  potvrdjen: boolean;
  tekst: string;
  doslovanTekst: boolean;
  status: string;
  statusOznaka: string;
  institucija: string;
  url: string;
  prioritet: number;
  verifikacija: string;
  vaziOd: string;
  vaziDo: string | null;
  relevantnost?: string;
  tipTvrdnje?: string;
}

const PORUKA_NEPOTVRDJEN =
  "Nisam uspeo da potvrdim tačan član propisa. Potrebno je proveriti važeću verziju zakona.";

/** "Član 29, stav 1, tačka 1)" — ili poruka o nepotvrđenom broju člana. */
export function formatirajOznakuClana(o: {
  clan: string;
  stav: string | null;
  tacka: string | null;
  podtacka: string | null;
  potvrdjenBrojClana: boolean;
}): string {
  if (!o.potvrdjenBrojClana) return PORUKA_NEPOTVRDJEN;

  const delovi = [`Član ${o.clan}`];
  if (o.stav) delovi.push(`stav ${o.stav}`);
  if (o.tacka) delovi.push(`tačka ${o.tacka})`);
  if (o.podtacka) delovi.push(`podtačka ${o.podtacka}`);
  return delovi.join(", ");
}

function iso(d: Date | string): string {
  return (typeof d === "string" ? new Date(d) : d).toISOString();
}

export function renderujCitat(
  odredba: PronadjenaOdredba,
  relevantnost?: string,
  tipTvrdnje?: string,
): RenderovanCitat {
  return {
    id: odredba.id,
    propis: odredba.propisSkracenica,
    propisPun: odredba.propisNaziv,
    oznaka: formatirajOznakuClana(odredba),
    potvrdjen: odredba.potvrdjenBrojClana,
    tekst: odredba.tekst,
    doslovanTekst: odredba.doslovanTekst,
    status: odredba.statusVazenja,
    statusOznaka: OPIS_STATUSA[odredba.statusVazenja],
    institucija: odredba.institucija,
    url: odredba.deepLink ?? odredba.izvorUrl,
    prioritet: odredba.prioritetIzvora,
    verifikacija: odredba.verifikacija,
    vaziOd: iso(odredba.vaziOd),
    vaziDo: odredba.vaziDo ? iso(odredba.vaziDo) : null,
    relevantnost,
    tipTvrdnje,
  };
}

/**
 * Kompaktan prikaz odredbe za kontekst modela. `citatId` je jedini identifikator
 * koji model sme da vrati u polju pravnog osnova.
 */
export function odredbaZaKontekst(o: PronadjenaOdredba): string {
  const oznaka = o.potvrdjenBrojClana
    ? formatirajOznakuClana(o)
    : `Član ${o.clan} (BROJ ČLANA NIJE POTVRĐEN — ne tvrdi da je potvrđen)`;

  const linije = [
    `<odredba citatId="${o.id}">`,
    `Propis: ${o.propisNaziv} (${o.propisSkracenica})`,
    `Vrsta propisa: ${o.propisTip}`,
    `Oznaka: ${oznaka}`,
    o.naslov ? `Naslov člana: ${o.naslov}` : null,
    `Status na traženi datum: ${OPIS_STATUSA[o.statusVazenja]}`,
    `Važi od: ${iso(o.vaziOd).slice(0, 10)}${
      o.vaziDo ? ` do ${iso(o.vaziDo).slice(0, 10)}` : " (bez roka)"
    }`,
    `Izvor: ${o.institucija} — ${o.deepLink ?? o.izvorUrl}`,
    `Status verifikacije u bazi: ${o.verifikacija}`,
    o.doslovanTekst
      ? "Tekst ispod je DOSLOVAN tekst propisa."
      : "Tekst ispod je SAŽETAK odredbe, ne doslovan tekst — ne citiraj ga pod navodnicima kao tekst zakona.",
    "Tekst:",
    o.tekst,
    `</odredba>`,
  ].filter(Boolean);

  return linije.join("\n");
}

export function kontekstOdredbi(odredbe: PronadjenaOdredba[]): string {
  if (odredbe.length === 0) {
    return "<pravna_baza>\nNema pronađenih odredbi u pravnoj bazi za ovaj upit.\n</pravna_baza>";
  }
  return [
    "<pravna_baza>",
    "Sledeće odredbe su pronađene u pravnoj bazi. U polju pravniOsnov smeš da",
    "koristiš ISKLJUČIVO citatId vrednosti navedene ovde. Ne izmišljaj citatId.",
    "",
    ...odredbe.map(odredbaZaKontekst),
    "</pravna_baza>",
  ].join("\n");
}
