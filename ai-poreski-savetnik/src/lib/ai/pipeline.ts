/**
 * Glavni tok odgovaranja.
 *
 * klasifikacija → RAG → web pretraga → sinteza → verifikacija → audit
 *
 * Namerno u tri poziva modela umesto jednog: klasifikacija bira šta tražiti,
 * istraživanje sme da koristi web alat, a sinteza radi sa `output_config.format`
 * (strukturirani izlaz), koji se ne kombinuje sa citatima dokumenata. Podela
 * takođe znači da verifikator dobija čist, mašinski čitljiv objekat.
 */

// Shema se ne šalje sirova: `jsonSchemaOutputFormat` je pretvara u dijalekt
// koji `output_config.format` prihvata. Ručno sastavljanje tog objekta je
// vraćalo 400, jer strukturirani izlaz ne podržava `enum` — helper ga premesti
// u opis polja, pa vrednosti čuva runtime validacija u schema.ts.
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

import type {
  PronadjenaOdredba,
  StrukturiraniOdgovor,
  WebIzvor,
} from "../types";
import { kontekstOdredbi } from "../legal/citations";
import { prepoznajCiljniDatum } from "../legal/normalize";
import { pretraziPravnuBazu } from "../legal/retrieval";
import {
  anthropic,
  maksWebPretraga,
  MODEL,
  nivoTruda,
  PRIMARNI_DOMENI,
  prioritetZaUrl,
  SVI_DOZVOLJENI_DOMENI,
  webPretragaUkljucena,
} from "./client";
import {
  kontekstDatuma,
  kontekstFirme,
  PROMPT_KLASIFIKACIJE,
  SISTEMSKI_PROMPT,
} from "./prompts";
import {
  SHEMA_KLASIFIKACIJE,
  SHEMA_ODGOVORA,
  validatorKlasifikacije,
  validatorOdgovora,
} from "./schema";
import { verifikuj, type RezultatVerifikacije } from "./verifier";

export interface UlazPipeline {
  pitanje: string;
  istorija?: Array<{ uloga: "korisnik" | "asistent"; sadrzaj: string }>;
  firma?: Parameters<typeof kontekstFirme>[0];
  /** Dodatni sistemski prompt — npr. za "drugo mišljenje" ili analizu dokumenta. */
  dodatniPrompt?: string;
  /** Ako je zadat, preskače se prepoznavanje datuma iz teksta. */
  ciljniDatum?: Date;
  /**
   * Javlja dokle se stiglo. Složeno pitanje sa web pretragom traje minutima, a
   * prazan spinner se ne razlikuje od zaglavljene aplikacije — ni za čoveka ni
   * za proxy, koji vezu bez saobraćaja prekine.
   */
  naFazu?: (faza: string) => void;
}

export interface IzlazPipeline extends RezultatVerifikacije {
  ciljniDatum: Date;
  kontekstOdredbi: PronadjenaOdredba[];
  oblasti: string[];
  koriscenaWebPretraga: boolean;
  trajanjeMs: number;
}

interface Klasifikacija {
  oblasti: string[];
  pretrazniUpiti: string[];
  webUpiti: string[];
  trebaWebPretraga: boolean;
  tipObveznika: string;
  nedostajePodataka: boolean;
}

/** Korak 1 — šta uopšte tražimo. Jeftin poziv, niži trud. */
async function klasifikuj(
  pitanje: string,
  firmaKontekst: string,
): Promise<Klasifikacija> {
  try {
    const odgovor = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: PROMPT_KLASIFIKACIJE,
      output_config: {
        effort: "low",
        format: jsonSchemaOutputFormat(SHEMA_KLASIFIKACIJE),
      },
      messages: [
        {
          role: "user",
          content: [firmaKontekst, `Pitanje korisnika: ${pitanje}`]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    const blok = (
      odgovor as { content: Array<{ type: string; text?: string }> }
    ).content.find((b) => b.type === "text");
    if (!blok?.text) throw new Error("prazan odgovor klasifikacije");
    return validatorKlasifikacije.parse(JSON.parse(blok.text));
  } catch (greska) {
    // Klasifikacija je optimizacija, ne preduslov. Ako otkaže, tražimo po
    // sirovom pitanju kroz sve oblasti — sporije, ali sistem ostaje u funkciji.
    console.error("[pipeline] klasifikacija otkazala, fallback:", greska);
    return {
      oblasti: [],
      pretrazniUpiti: [pitanje],
      webUpiti: [pitanje],
      trebaWebPretraga: true,
      tipObveznika: "NEPOZNATO",
      nedostajePodataka: false,
    };
  }
}

/** Korak 2 — RAG. Više upita, spajanje po najboljem skoru. */
async function pretrazi(
  upiti: string[],
  oblasti: string[],
  ciljniDatum: Date,
): Promise<PronadjenaOdredba[]> {
  const spojeno = new Map<string, PronadjenaOdredba>();

  for (const upit of upiti.slice(0, 4)) {
    const rezultati = await pretraziPravnuBazu({
      upit,
      ciljniDatum,
      kategorije: oblasti.length ? oblasti : undefined,
      limit: 10,
    });
    for (const r of rezultati) {
      const postojeci = spojeno.get(r.id);
      if (!postojeci || r.skor > postojeci.skor) spojeno.set(r.id, r);
    }
  }

  // Ako filtriranje po oblasti nije dalo ništa, probaj bez filtera — bolje
  // široko nego prazno.
  if (spojeno.size === 0 && oblasti.length > 0) {
    for (const upit of upiti.slice(0, 2)) {
      const rezultati = await pretraziPravnuBazu({
        upit,
        ciljniDatum,
        limit: 10,
      });
      for (const r of rezultati) spojeno.set(r.id, r);
    }
  }

  return [...spojeno.values()].sort((a, b) => b.skor - a.skor).slice(0, 14);
}

/** Korak 3 — web pretraga zvaničnih izvora, u dva prolaza po prioritetu. */
async function pretraziWeb(
  upiti: string[],
  ciljniDatum: Date,
): Promise<{ izvori: WebIzvor[]; beleske: string }> {
  if (!webPretragaUkljucena() || upiti.length === 0) {
    return { izvori: [], beleske: "" };
  }

  const uputstvo = [
    "Pretraži zvanične srpske izvore i utvrdi AKTUELNO pravno stanje.",
    "",
    "Za svaku pronađenu informaciju navedi:",
    "- tačan iznos/stopu/rok,",
    "- od kada se primenjuje,",
    "- naziv propisa i broj Službenog glasnika ako je vidljiv,",
    "- URL izvora.",
    "",
    "Posebno proveri da li je propis u međuvremenu izmenjen i razlikuj važeći",
    "tekst od nacrta ili predloga zakona.",
    "",
    `Pravno stanje se traži na datum: ${ciljniDatum.toISOString().slice(0, 10)}`,
    "",
    "Upiti:",
    ...upiti.slice(0, 3).map((u) => `- ${u}`),
  ].join("\n");

  try {
    // Streaming, a ne obično čekanje: pretraga zvaničnih izvora ume da traje
    // minutima, a veza bez ijednog bajta se u međuvremenu prekida — i kod API-ja
    // i kroz proxy. `finalMessage()` svejedno vraća ceo odgovor.
    const odgovor = await anthropic()
      .messages.stream({
        model: MODEL,
        max_tokens: 8000,
        system:
          "Ti si istraživač propisa Republike Srbije. Sažimaš nalaze činjenično, bez tumačenja, i uz svaki podatak navodiš izvor. Ako podatak ne možeš da nađeš na zvaničnom izvoru, to jasno napišeš.",
        output_config: { effort: "medium" },
        tools: [
          {
            type: "web_search_20260209",
            name: "web_search",
            max_uses: maksWebPretraga(),
            // Prvi prolaz: zvanični izvori imaju prednost, ali dozvoljavamo i
            // Paragraf Lex jer jedini pouzdano prati prečišćene tekstove.
            allowed_domains: [...PRIMARNI_DOMENI, ...SVI_DOZVOLJENI_DOMENI],
          },
        ],
        messages: [{ role: "user", content: uputstvo }],
      })
      .finalMessage();

    const sadrzaj = (
      odgovor as {
        content: Array<{
          type: string;
          text?: string;
          content?: Array<{ url?: string; title?: string; page_age?: string }>;
        }>;
      }
    ).content;

    const izvori: WebIzvor[] = [];
    const tekstovi: string[] = [];

    for (const blok of sadrzaj) {
      if (blok.type === "text" && blok.text) tekstovi.push(blok.text);
      if (
        blok.type === "web_search_tool_result" &&
        Array.isArray(blok.content)
      ) {
        for (const rezultat of blok.content) {
          if (!rezultat.url) continue;
          const { prioritet, institucija } = prioritetZaUrl(rezultat.url);
          izvori.push({
            naslov: rezultat.title ?? rezultat.url,
            url: rezultat.url,
            institucija,
            prioritet,
          });
        }
      }
    }

    // Deduplikacija po URL-u, sortiranje po prioritetu izvora.
    const jedinstveni = new Map<string, WebIzvor>();
    for (const i of izvori)
      if (!jedinstveni.has(i.url)) jedinstveni.set(i.url, i);

    return {
      izvori: [...jedinstveni.values()].sort(
        (a, b) => a.prioritet - b.prioritet,
      ),
      beleske: tekstovi.join("\n\n"),
    };
  } catch (greska) {
    // Web je dopuna pravnoj bazi. Ako otkaže, odgovaramo iz baze i to se vidi
    // u nivou pouzdanosti — ne rušimo ceo zahtev.
    console.error("[pipeline] web pretraga otkazala:", greska);
    return { izvori: [], beleske: "" };
  }
}

/** Korak 4 — sinteza sa strukturiranim izlazom. */
async function sintetizuj(
  pitanje: string,
  odredbe: PronadjenaOdredba[],
  webBeleske: string,
  webIzvori: WebIzvor[],
  ciljniDatum: Date,
  firmaKontekst: string,
  dodatniPrompt: string | undefined,
  istorija: UlazPipeline["istorija"],
): Promise<StrukturiraniOdgovor> {
  const delovi = [
    kontekstDatuma(ciljniDatum),
    firmaKontekst,
    kontekstOdredbi(odredbe),
  ];

  if (webBeleske.trim()) {
    delovi.push(
      [
        "<nalazi_sa_weba>",
        "Ovo su nalazi pretrage zvaničnih izvora. Koristi ih za aktuelne iznose,",
        "stope i rokove. Za njih NEMAŠ citatId — pominji ih u tekstu uz naziv",
        "institucije, a u pravniOsnov stavljaj samo odredbe iz pravne baze.",
        "",
        webBeleske,
        "",
        "Izvori:",
        ...webIzvori.map(
          (i) =>
            `- [${i.institucija}, prioritet ${i.prioritet}] ${i.naslov} — ${i.url}`,
        ),
        "</nalazi_sa_weba>",
      ].join("\n"),
    );
  }

  delovi.push(`<pitanje_korisnika>\n${pitanje}\n</pitanje_korisnika>`);

  const poruke: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const p of (istorija ?? []).slice(-6)) {
    poruke.push({
      role: p.uloga === "korisnik" ? "user" : "assistant",
      content: p.sadrzaj,
    });
  }
  poruke.push({ role: "user", content: delovi.filter(Boolean).join("\n\n") });

  const sistem = dodatniPrompt
    ? `${SISTEMSKI_PROMPT}\n\n# Poseban zadatak\n${dodatniPrompt}`
    : SISTEMSKI_PROMPT;

  // Isto i ovde, sa jačim razlogom: 16.000 tokena uz razmišljanje je najduži
  // poziv u celom toku, a upravo se on ranije završavao prekinutom vezom.
  const odgovor = await anthropic()
    .messages.stream({
      model: MODEL,
      max_tokens: 16000,
      // Stabilan prefiks se kešira — sistemski prompt se ne menja između upita.
      system: [
        { type: "text", text: sistem, cache_control: { type: "ephemeral" } },
      ],
      thinking: { type: "adaptive" },
      output_config: {
        effort: nivoTruda(),
        format: jsonSchemaOutputFormat(SHEMA_ODGOVORA),
      },
      messages: poruke,
    })
    .finalMessage();

  const blokovi = (
    odgovor as { content: Array<{ type: string; text?: string }> }
  ).content;
  const tekst = blokovi.find((b) => b.type === "text")?.text;
  if (!tekst) {
    throw new Error("Model nije vratio strukturirani odgovor.");
  }

  return validatorOdgovora.parse(JSON.parse(tekst)) as StrukturiraniOdgovor;
}

export async function pokreniPipeline(
  ulaz: UlazPipeline,
): Promise<IzlazPipeline> {
  const pocetak = Date.now();
  const faza = ulaz.naFazu ?? (() => {});
  const ciljniDatum = ulaz.ciljniDatum ?? prepoznajCiljniDatum(ulaz.pitanje);
  const firmaKontekst = kontekstFirme(ulaz.firma ?? null);

  faza("Razumevam pitanje…");
  const klasifikacija = await klasifikuj(ulaz.pitanje, firmaKontekst);

  faza(
    klasifikacija.trebaWebPretraga
      ? "Tražim odredbe u pravnoj bazi i proveravam zvanične izvore…"
      : "Tražim odredbe u pravnoj bazi…",
  );
  const [odredbe, web] = await Promise.all([
    pretrazi(
      [ulaz.pitanje, ...klasifikacija.pretrazniUpiti],
      klasifikacija.oblasti,
      ciljniDatum,
    ),
    klasifikacija.trebaWebPretraga
      ? pretraziWeb(klasifikacija.webUpiti, ciljniDatum)
      : Promise.resolve({ izvori: [] as WebIzvor[], beleske: "" }),
  ]);

  faza(
    `Sastavljam odgovor — ${odredbe.length} ${odredbe.length === 1 ? "odredba" : "odredbi"} u kontekstu${
      web.izvori.length ? `, ${web.izvori.length} sa weba` : ""
    }…`,
  );
  const sirovOdgovor = await sintetizuj(
    ulaz.pitanje,
    odredbe,
    web.beleske,
    web.izvori,
    ciljniDatum,
    firmaKontekst,
    ulaz.dodatniPrompt,
    ulaz.istorija,
  );

  faza("Proveravam citate…");
  const verifikovan = verifikuj(sirovOdgovor, odredbe, web.izvori, ciljniDatum);

  return {
    ...verifikovan,
    ciljniDatum,
    kontekstOdredbi: odredbe,
    oblasti: klasifikacija.oblasti,
    koriscenaWebPretraga: web.izvori.length > 0,
    trajanjeMs: Date.now() - pocetak,
  };
}
