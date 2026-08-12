import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5";

/** Prioritet izvora iz zahteva 5, preslikan na domene. */
export const DOMENI_PO_PRIORITETU: Array<{
  prioritet: number;
  institucija: string;
  domeni: string[];
}> = [
  {
    prioritet: 1,
    institucija: "Službeni glasnik Republike Srbije",
    domeni: ["pravno-informacioni-sistem.rs", "slglasnik.com", "slglasnik.rs"],
  },
  {
    prioritet: 2,
    institucija: "Ministarstvo finansija",
    domeni: ["mfin.gov.rs"],
  },
  {
    prioritet: 3,
    institucija: "Poreska uprava",
    domeni: ["purs.gov.rs", "poreskauprava.gov.rs", "eporezi.purs.gov.rs"],
  },
  {
    prioritet: 4,
    institucija: "Ministarstvo za rad / RFZO / PIO",
    domeni: ["minrzs.gov.rs", "rfzo.rs", "pio.rs", "croso.gov.rs"],
  },
  {
    prioritet: 5,
    institucija: "APR / NBS / eFakture",
    domeni: ["apr.gov.rs", "nbs.rs", "efaktura.gov.rs", "srbija.gov.rs"],
  },
  {
    prioritet: 6,
    institucija: "Paragraf Lex",
    domeni: ["paragraf.rs"],
  },
  {
    prioritet: 7,
    institucija: "Stručni izvori",
    domeni: [
      "cekos.rs",
      "ipc.rs",
      "porezionline.rs",
      "aktivasistem.com",
      "propisi.net",
      "neobilten.com",
    ],
  },
];

/** Domeni za prvi prolaz web pretrage — samo primarni/zvanični izvori. */
export const PRIMARNI_DOMENI = DOMENI_PO_PRIORITETU.filter(
  (d) => d.prioritet <= 5,
).flatMap((d) => d.domeni);

/** Domeni za drugi prolaz — dodaje Paragraf Lex i proverene stručne izvore. */
export const SVI_DOZVOLJENI_DOMENI = DOMENI_PO_PRIORITETU.flatMap(
  (d) => d.domeni,
);

export function prioritetZaUrl(url: string): {
  prioritet: number;
  institucija: string;
} {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return { prioritet: 9, institucija: "Nepoznat izvor" };
  }
  for (const grupa of DOMENI_PO_PRIORITETU) {
    if (grupa.domeni.some((d) => host === d || host.endsWith(`.${d}`))) {
      return { prioritet: grupa.prioritet, institucija: grupa.institucija };
    }
  }
  return { prioritet: 9, institucija: "Ostali izvor" };
}

let klijent: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!klijent) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY nije podešen. Kopirajte .env.example u .env i unesite ključ.",
      );
    }
    klijent = new Anthropic();
  }
  return klijent;
}

export type NivoTruda = "low" | "medium" | "high" | "xhigh" | "max";

export function nivoTruda(): NivoTruda {
  const e = (process.env.AI_EFFORT ?? "high").toLowerCase();
  if (["low", "medium", "high", "xhigh", "max"].includes(e)) {
    return e as NivoTruda;
  }
  return "high";
}

export function webPretragaUkljucena(): boolean {
  return (process.env.WEB_SEARCH_ENABLED ?? "true") !== "false";
}

export function maksWebPretraga(): number {
  const n = Number(process.env.WEB_SEARCH_MAX_USES ?? "8");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 8;
}
