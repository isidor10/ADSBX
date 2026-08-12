/**
 * Provera važenja propisa na zadati datum (zahtevi 4 i 32).
 *
 * Ovo je razlog zašto odredba ima `vaziOd`/`vaziDo`, a ne samo tekst: pitanje
 * "koliki je bio porez 2023?" mora da vrati propis koji je tada važio, a ne
 * današnji.
 */

import type { StatusVazenja } from "../types";

export interface TemporalniPodaci {
  vaziOd: Date;
  vaziDo: Date | null;
  tipPropisa?: string;
}

export function statusNaDatum(
  podaci: TemporalniPodaci,
  ciljniDatum: Date,
): StatusVazenja {
  if (podaci.tipPropisa === "NACRT" || podaci.tipPropisa === "PREDLOG") {
    return "NIJE_PROPIS";
  }
  if (podaci.vaziOd.getTime() > ciljniDatum.getTime()) {
    return "JOS_NIJE_STUPIO_NA_SNAGU";
  }
  if (podaci.vaziDo && podaci.vaziDo.getTime() <= ciljniDatum.getTime()) {
    return "PRESTAO_DA_VAZI";
  }
  return "VAZI";
}

export const OPIS_STATUSA: Record<StatusVazenja, string> = {
  VAZI: "Važeći propis",
  PRESTAO_DA_VAZI: "Prestao da važi",
  JOS_NIJE_STUPIO_NA_SNAGU: "Još nije stupio na snagu",
  NIJE_PROPIS: "Nacrt / predlog — nije važeći propis",
};

/**
 * Da li odredba sme da posluži kao pravni osnov za odgovor.
 * Odredba koja je prestala da važi sme — ali samo ako je korisnik pitao za
 * period u kome je važila, i uvek sa jasnom oznakom perioda.
 */
export function smeKaoOsnov(status: StatusVazenja): boolean {
  return status === "VAZI" || status === "PRESTAO_DA_VAZI";
}

/**
 * Upozorenje koje ide uz odgovor kada kontekst nije čist — npr. korisnik pita o
 * budućem periodu, ili je propis u međuvremenu prestao da važi.
 */
export function upozorenjeZaStatus(
  status: StatusVazenja,
  vaziOd: Date,
  vaziDo: Date | null,
): string | null {
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}.${String(
      d.getUTCMonth() + 1,
    ).padStart(2, "0")}.${d.getUTCFullYear()}.`;

  switch (status) {
    case "PRESTAO_DA_VAZI":
      return `Ova odredba je važila u periodu ${fmt(vaziOd)}${
        vaziDo ? fmt(vaziDo) : "—"
      } i više nije na snazi. Za tekući period proverite važeću verziju propisa.`;
    case "JOS_NIJE_STUPIO_NA_SNAGU":
      return `Ova odredba se primenjuje tek od ${fmt(
        vaziOd,
      )}. Za period pre tog datuma važi prethodna verzija propisa.`;
    case "NIJE_PROPIS":
      return "Ovo je nacrt odnosno predlog propisa i NE predstavlja važeći propis. Ne sme se koristiti kao pravni osnov.";
    default:
      return null;
  }
}

/** SQL-friendly uslov: odredbe koje su bile na snazi na dati datum. */
export function temporalniUslov(ciljniDatum: Date) {
  return {
    vaziOd: { lte: ciljniDatum },
    OR: [{ vaziDo: null }, { vaziDo: { gt: ciljniDatum } }],
  };
}

/**
 * Kada korisnik pita o prošlom periodu, uzimamo i odredbe koje su u
 * međuvremenu prestale da važe — inače bismo na pitanje o 2023. odgovorili
 * praznim skupom.
 */
export function temporalniUslovSaIstorijom(ciljniDatum: Date, danas = new Date()) {
  const pitaOProslosti = ciljniDatum.getTime() < danas.getTime() - 86_400_000;
  if (!pitaOProslosti) return temporalniUslov(ciljniDatum);
  return { vaziOd: { lte: ciljniDatum } };
}
