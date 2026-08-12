/**
 * Shema strukturiranog odgovora.
 *
 * Ovo je ugovor između modela i aplikacije. Sve što je pravno obavezujuće ide
 * kroz `citatId` — model ne dobija polje u koje bi mogao da upiše broj člana
 * kao slobodan tekst.
 */

import { z } from "zod";

export const TIPOVI_TVRDNJE = [
  "ZAKON",
  "PODZAKONSKI_AKT",
  "SLUZBENO_TUMACENJE",
  "STRUCNO_MISLJENJE",
  "AI_ZAKLJUCAK",
] as const;

export const NIVOI_POUZDANOSTI = [
  "VISOKA",
  "POTREBNA_PROVERA",
  "NEDOVOLJNO_PODATAKA",
] as const;

/** JSON Schema koju šaljemo Claude API-ju kroz output_config.format. */
export const SHEMA_ODGOVORA = {
  type: "object",
  properties: {
    kratakOdgovor: {
      type: "string",
      description:
        "Jasan odgovor u 1-3 rečenice, na srpskom jeziku, latinicom. Bez pravnih citata.",
    },
    objasnjenje: {
      type: "string",
      description:
        "Detaljno objašnjenje kako se pravilo primenjuje u praksi, razumljivo laiku ali korisno računovođi. Ne prepisuj tekst zakona.",
    },
    poreskiTretman: {
      type: "object",
      description:
        "Popuni samo ako pitanje ima finansijski efekat. Ako nema, izostavi ceo objekat.",
      properties: {
        poreziKojiSePlacaju: { type: "string" },
        osnovica: { type: "string" },
        stopa: { type: "string" },
        rok: { type: "string" },
        prijava: { type: "string" },
        knjizenje: { type: "string" },
      },
      additionalProperties: false,
    },
    pravniOsnov: {
      type: "array",
      description:
        "Pravni osnov. citatId MORA biti jedna od vrednosti iz <pravna_baza> konteksta. Ako nemaš nijedan validan citatId, vrati prazan niz i postavi nivoPouzdanosti na NEDOVOLJNO_PODATAKA.",
      items: {
        type: "object",
        properties: {
          citatId: {
            type: "string",
            description:
              "Tačan citatId iz konteksta. Nikada ne izmišljaj ovu vrednost.",
          },
          relevantnost: {
            type: "string",
            description:
              "Jedna rečenica: zašto je baš ova odredba osnov za tvrdnju.",
          },
          tipTvrdnje: { type: "string", enum: [...TIPOVI_TVRDNJE] },
        },
        required: ["citatId", "relevantnost", "tipTvrdnje"],
        additionalProperties: false,
      },
    },
    vazno: {
      type: "array",
      description:
        "Izuzeci, rizici i situacije u kojima bi odgovor bio drugačiji. Bar jedna stavka kod ozbiljnih poreskih pitanja.",
      items: { type: "string" },
    },
    nivoPouzdanosti: {
      type: "string",
      enum: [...NIVOI_POUZDANOSTI],
      description:
        "VISOKA samo ako je tvrdnja direktno potvrđena važećom odredbom iz konteksta. POTREBNA_PROVERA ako ima više tumačenja ili je izvor sekundarni. NEDOVOLJNO_PODATAKA ako nedostaju informacije o slučaju ili nema pravnog osnova.",
    },
    obrazlozenjePouzdanosti: {
      type: "string",
      description: "Jedna rečenica: zašto baš taj nivo pouzdanosti.",
    },
    potrebnaPitanja: {
      type: "array",
      description:
        "Ako odgovor zavisi od statusa korisnika ili podataka koje nemaš — pitanja koja treba postaviti pre preciznog odgovora.",
      items: { type: "string" },
    },
    aiZakljucak: {
      type: "string",
      description:
        "Opciono. Tvoje zaključivanje koje NIJE direktno napisano u propisu. Sve što ide ovde biće korisniku prikazano kao AI zaključak, a ne kao zakon.",
    },
  },
  required: [
    "kratakOdgovor",
    "objasnjenje",
    "pravniOsnov",
    "vazno",
    "nivoPouzdanosti",
    "obrazlozenjePouzdanosti",
  ],
  additionalProperties: false,
} as const;

/** Runtime validacija — ne verujemo ni shemi bez provere. */
export const validatorOdgovora = z.object({
  kratakOdgovor: z.string().min(1),
  objasnjenje: z.string().min(1),
  poreskiTretman: z
    .object({
      poreziKojiSePlacaju: z.string().optional(),
      osnovica: z.string().optional(),
      stopa: z.string().optional(),
      rok: z.string().optional(),
      prijava: z.string().optional(),
      knjizenje: z.string().optional(),
    })
    .optional(),
  pravniOsnov: z.array(
    z.object({
      citatId: z.string(),
      relevantnost: z.string(),
      tipTvrdnje: z.enum(TIPOVI_TVRDNJE),
    }),
  ),
  vazno: z.array(z.string()),
  nivoPouzdanosti: z.enum(NIVOI_POUZDANOSTI),
  obrazlozenjePouzdanosti: z.string(),
  potrebnaPitanja: z.array(z.string()).optional(),
  aiZakljucak: z.string().optional(),
});

/** Shema za klasifikaciju upita (prvi prolaz pipeline-a). */
export const SHEMA_KLASIFIKACIJE = {
  type: "object",
  properties: {
    oblasti: {
      type: "array",
      description: "Poreske/pravne oblasti na koje se pitanje odnosi.",
      items: {
        type: "string",
        enum: [
          "PDV", "DOBIT", "DOHODAK", "DOPRINOSI", "RAD", "RACUNOVODSTVO",
          "EFAKTURE", "FISKALIZACIJA", "POSTUPAK", "IMOVINA", "PRIVREDA",
          "DEVIZNO", "OSTALO",
        ],
      },
    },
    pretrazniUpiti: {
      type: "array",
      description:
        "2-4 ciljana upita za pretragu pravne baze, na srpskom, sa stručnim terminima iz propisa (ne prepisuj korisnikovo pitanje doslovno).",
      items: { type: "string" },
    },
    webUpiti: {
      type: "array",
      description:
        "0-3 upita za web pretragu zvaničnih izvora. Postavi ih samo ako pitanje traži aktuelne iznose, stope, rokove, limite ili skorašnje izmene propisa.",
      items: { type: "string" },
    },
    trebaWebPretraga: {
      type: "boolean",
      description:
        "true ako odgovor zavisi od aktuelnih iznosa/stopa/rokova ili skorašnjih izmena propisa.",
    },
    tipObveznika: {
      type: "string",
      description:
        "Ako se iz pitanja ili profila firme vidi status obveznika, upiši ga. Inače 'NEPOZNATO'.",
    },
    nedostajePodataka: {
      type: "boolean",
      description:
        "true ako odgovor bitno zavisi od podatka koji korisnik nije dao (npr. da li je u sistemu PDV-a).",
    },
  },
  required: ["oblasti", "pretrazniUpiti", "webUpiti", "trebaWebPretraga", "tipObveznika", "nedostajePodataka"],
  additionalProperties: false,
} as const;

export const validatorKlasifikacije = z.object({
  oblasti: z.array(z.string()),
  pretrazniUpiti: z.array(z.string()),
  webUpiti: z.array(z.string()),
  trebaWebPretraga: z.boolean(),
  tipObveznika: z.string(),
  nedostajePodataka: z.boolean(),
});
