/** Zajednički tipovi sistema. */

export type NivoPouzdanosti =
  | "VISOKA"
  | "POTREBNA_PROVERA"
  | "NEDOVOLJNO_PODATAKA";

/** Zahtev 18 — korisnik u svakom trenutku mora da zna šta čita. */
export type TipTvrdnje =
  | "ZAKON"
  | "PODZAKONSKI_AKT"
  | "SLUZBENO_TUMACENJE"
  | "STRUCNO_MISLJENJE"
  | "AI_ZAKLJUCAK";

export type VrstaObveznika =
  | "FIZICKO_LICE"
  | "PREDUZETNIK_PAUSALAC"
  | "PREDUZETNIK_KNJIGAS"
  | "PREDUZETNIK_LICNA_ZARADA"
  | "DOO"
  | "AD"
  | "DRUGO_PRAVNO_LICE"
  | "ZAPOSLENI"
  | "POSLODAVAC";

export const OPIS_OBVEZNIKA: Record<VrstaObveznika, string> = {
  FIZICKO_LICE: "Fizičko lice",
  PREDUZETNIK_PAUSALAC: "Preduzetnik paušalac",
  PREDUZETNIK_KNJIGAS: "Preduzetnik koji vodi poslovne knjige",
  PREDUZETNIK_LICNA_ZARADA: "Preduzetnik sa ličnom zaradom",
  DOO: "Društvo s ograničenom odgovornošću (DOO)",
  AD: "Akcionarsko društvo (AD)",
  DRUGO_PRAVNO_LICE: "Drugo pravno lice",
  ZAPOSLENI: "Zaposleni",
  POSLODAVAC: "Poslodavac",
};

export type Kategorija =
  | "PDV"
  | "DOBIT"
  | "DOHODAK"
  | "DOPRINOSI"
  | "RAD"
  | "RACUNOVODSTVO"
  | "EFAKTURE"
  | "FISKALIZACIJA"
  | "POSTUPAK"
  | "IMOVINA"
  | "PRIVREDA"
  | "DEVIZNO"
  | "OSTALO";

export const OPIS_KATEGORIJE: Record<Kategorija, string> = {
  PDV: "Porez na dodatu vrednost",
  DOBIT: "Porez na dobit pravnih lica",
  DOHODAK: "Porez na dohodak građana",
  DOPRINOSI: "Doprinosi za obavezno socijalno osiguranje",
  RAD: "Radni odnosi i zarade",
  RACUNOVODSTVO: "Računovodstvo i finansijski izveštaji",
  EFAKTURE: "Elektronsko fakturisanje (SEF)",
  FISKALIZACIJA: "Fiskalizacija",
  POSTUPAK: "Poreski postupak i administracija",
  IMOVINA: "Porezi na imovinu",
  PRIVREDA: "Privredna društva",
  DEVIZNO: "Devizno poslovanje",
  OSTALO: "Ostalo",
};

/** Rezultat pretrage pravne baze — ono što ulazi u kontekst modela. */
export interface PronadjenaOdredba {
  id: string;
  propisNaziv: string;
  propisSkracenica: string;
  propisTip: string;
  kategorija: string;
  clan: string;
  stav: string | null;
  tacka: string | null;
  podtacka: string | null;
  naslov: string | null;
  tekst: string;
  doslovanTekst: boolean;
  potvrdjenBrojClana: boolean;
  vaziOd: Date;
  vaziDo: Date | null;
  izvorUrl: string;
  deepLink: string | null;
  institucija: string;
  prioritetIzvora: number;
  verifikacija: string;
  /** Rezultat temporalne provere u odnosu na ciljni datum. */
  statusVazenja: StatusVazenja;
  skor: number;
}

export type StatusVazenja =
  | "VAZI"
  | "PRESTAO_DA_VAZI"
  | "JOS_NIJE_STUPIO_NA_SNAGU"
  | "NIJE_PROPIS";

export interface WebIzvor {
  naslov: string;
  url: string;
  isecak?: string;
  institucija: string;
  prioritet: number;
}

/** Strukturirani odgovor koji model vraća — vidi src/lib/ai/schema.ts. */
export interface StrukturiraniOdgovor {
  kratakOdgovor: string;
  objasnjenje: string;
  poreskiTretman?: {
    poreziKojiSePlacaju?: string;
    osnovica?: string;
    stopa?: string;
    rok?: string;
    prijava?: string;
    knjizenje?: string;
  };
  pravniOsnov: Array<{
    citatId: string;
    relevantnost: string;
    tipTvrdnje: TipTvrdnje;
  }>;
  vazno: string[];
  nivoPouzdanosti: NivoPouzdanosti;
  obrazlozenjePouzdanosti: string;
  potrebnaPitanja?: string[];
  aiZakljucak?: string;
}

/** Jedan korak obračuna: formula → obračun → rezultat (zahtev 10). */
export interface KorakObracuna {
  opis: string;
  formula: string;
  izracun: string;
  rezultat: number;
  jedinica?: string;
}

export interface RezultatObracuna {
  naziv: string;
  koraci: KorakObracuna[];
  rezultat: Record<string, number>;
  /** Ključevi parametara iz baze koji su korišćeni — za prikaz pravnog osnova. */
  koriscenParametri: Array<{
    kljuc: string;
    naziv: string;
    vrednost: string;
    jedinica: string;
    vaziOd: string;
    izvorUrl: string;
    propis?: string;
    clan?: string;
    verifikacija: string;
  }>;
  napomene: string[];
  ciljniDatum: string;
}
