import { NextResponse } from "next/server";
import { z } from "zod";
import {
  obracunAmortizacije,
  obracunBrutoUNeto,
  obracunKapitalnogDobitka,
  obracunLicneZarade,
  obracunNetoUBruto,
  obracunPausalca,
  obracunPDV,
  obracunPorezaNaDobit,
  obracunPorezaPoOdbitku,
  obracunSluzbenogPuta,
  obracunTroskaAutomobila,
  obracunTroskaZaposlenog,
  uporediPravneForme,
} from "@/lib/calc";
import { NedostajeParametar } from "@/lib/calc/parametri";

export const runtime = "nodejs";

const broj = z.coerce.number().finite();
const pozitivan = broj.nonnegative();

/** Katalog kalkulatora — shema ulaza + izvršenje na jednom mestu. */
const KALKULATORI = {
  pdv: {
    naziv: "PDV",
    shema: z.object({
      iznos: pozitivan,
      stopa: z.enum(["opsta", "posebna"]).default("opsta"),
      smer: z.enum(["na_osnovicu", "iz_bruto"]).default("na_osnovicu"),
    }),
    izvrsi: obracunPDV,
  },
  "bruto-neto": {
    naziv: "Bruto → neto",
    shema: z.object({ bruto: pozitivan }),
    izvrsi: obracunBrutoUNeto,
  },
  "neto-bruto": {
    naziv: "Neto → bruto",
    shema: z.object({ neto: pozitivan }),
    izvrsi: obracunNetoUBruto,
  },
  "trosak-zaposlenog": {
    naziv: "Ukupan trošak zaposlenog",
    shema: z.object({
      bruto: pozitivan,
      brojMeseci: broj.int().min(1).max(12).default(12),
      mesecniPrevoz: pozitivan.optional(),
    }),
    izvrsi: obracunTroskaZaposlenog,
  },
  dobit: {
    naziv: "Porez na dobit",
    shema: z.object({ oporezivaDobit: broj }),
    izvrsi: obracunPorezaNaDobit,
  },
  "po-odbitku": {
    naziv: "Porez po odbitku",
    shema: z.object({
      bruto: pozitivan,
      preferencijalnaJurisdikcija: z.boolean().optional(),
      stopaUgovora: broj.min(0).max(100).optional(),
    }),
    izvrsi: obracunPorezaPoOdbitku,
  },
  pausal: {
    naziv: "Paušalac",
    shema: z.object({
      mesecniPausalniPrihod: pozitivan,
      godisnjiPromet: pozitivan.optional(),
    }),
    izvrsi: obracunPausalca,
  },
  "licna-zarada": {
    naziv: "Lična zarada preduzetnika",
    shema: z.object({ licnaZarada: pozitivan }),
    izvrsi: obracunLicneZarade,
  },
  amortizacija: {
    naziv: "Poreska amortizacija",
    shema: z.object({
      nabavnaVrednost: pozitivan,
      grupa: z.union([
        z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
      ]),
      brojGodina: broj.int().min(1).max(40).default(5),
    }),
    izvrsi: obracunAmortizacije,
  },
  "kapitalni-dobitak": {
    naziv: "Kapitalni dobitak",
    shema: z.object({ prodajnaCena: pozitivan, nabavnaCena: pozitivan }),
    izvrsi: obracunKapitalnogDobitka,
  },
  "sluzbeni-put": {
    naziv: "Službeni put i dnevnice",
    shema: z.object({
      brojDana: broj.int().min(1).max(365),
      dnevnicaPoDanu: pozitivan.optional(),
      predjeniKm: pozitivan.optional(),
    }),
    izvrsi: obracunSluzbenogPuta,
  },
  automobil: {
    naziv: "Trošak službenog automobila",
    shema: z.object({
      nabavnaVrednost: pozitivan,
      pdvObveznik: z.boolean().default(false),
      koriscenjeIskljucivoPoslovno: z.boolean().default(false),
      godisnjiTroskoviGoriva: pozitivan.optional(),
      godisnjiTroskoviOdrzavanja: pozitivan.optional(),
    }),
    izvrsi: obracunTroskaAutomobila,
  },
  "sta-ako": {
    naziv: "Poređenje pravnih formi",
    shema: z.object({
      godisnjiPrihod: pozitivan,
      godisnjiTroskovi: pozitivan,
      mesecniPausalniPrihod: pozitivan.optional(),
    }),
    izvrsi: uporediPravneForme,
  },
} as const;

export type VrstaKalkulatora = keyof typeof KALKULATORI;

export async function GET() {
  return NextResponse.json({
    kalkulatori: Object.entries(KALKULATORI).map(([kljuc, k]) => ({
      kljuc,
      naziv: k.naziv,
    })),
  });
}

export async function POST(
  zahtev: Request,
  { params }: { params: Promise<{ vrsta: string }> },
) {
  const { vrsta } = await params;
  const kalkulator = KALKULATORI[vrsta as VrstaKalkulatora];

  if (!kalkulator) {
    return NextResponse.json(
      {
        greska: `Nepoznat kalkulator "${vrsta}".`,
        dostupni: Object.keys(KALKULATORI),
      },
      { status: 404 },
    );
  }

  let telo: unknown;
  try {
    telo = await zahtev.json();
  } catch {
    return NextResponse.json({ greska: "Neispravan JSON." }, { status: 400 });
  }

  const sa = z
    .object({ datum: z.string().optional() })
    .passthrough()
    .safeParse(telo);
  const datum =
    sa.success && sa.data.datum ? new Date(sa.data.datum) : new Date();
  if (Number.isNaN(datum.getTime())) {
    return NextResponse.json({ greska: "Neispravan datum." }, { status: 400 });
  }

  const provera = kalkulator.shema.safeParse(telo);
  if (!provera.success) {
    return NextResponse.json(
      {
        greska: "Neispravni ulazni podaci.",
        detalji: provera.error.issues.map((i) => ({
          polje: i.path.join("."),
          poruka: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    // Union tipova ulaza po kalkulatoru je namerno zatvoren u katalogu iznad;
    // ovde je jedini cast u lancu, posle uspešne Zod validacije.
    const izvrsi = kalkulator.izvrsi as (u: unknown) => Promise<unknown>;
    const rezultat = await izvrsi({ ...provera.data, datum });
    return NextResponse.json(rezultat);
  } catch (greska) {
    if (greska instanceof NedostajeParametar) {
      // Nedostatak potvrđenog parametra nije tehnička greška nego pravna —
      // korisniku se kaže šta tačno nedostaje, umesto da dobije pogrešan broj.
      return NextResponse.json(
        {
          greska: greska.message,
          kljucParametra: greska.kljuc,
          tip: "NEDOSTAJE_PARAMETAR",
        },
        { status: 422 },
      );
    }
    console.error(`[/api/kalkulator/${vrsta}]`, greska);
    return NextResponse.json(
      { greska: "Greška pri obračunu." },
      { status: 500 },
    );
  }
}
