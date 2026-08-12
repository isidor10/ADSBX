/**
 * Poreski kalkulatori (zahtev 10).
 *
 * Svaki kalkulator vraća korake u obliku formula → obračun → rezultat, plus
 * listu parametara sa pravnim osnovom. Nikada samo konačan broj — računovođa
 * mora da može da proveri svaki korak.
 */

import type { KorakObracuna, RezultatObracuna } from "../types";
import {
  napomeneOVerifikaciji,
  pripremiKontekst,
  procenat,
  uzmi,
  zaokruzi,
  type KontekstObracuna,
} from "./parametri";
import { srpskiBroj } from "../legal/normalize";

const RSD = (n: number) => `${srpskiBroj(n)} RSD`;

function korak(
  opis: string,
  formula: string,
  izracun: string,
  rezultat: number,
  jedinica = "RSD",
): KorakObracuna {
  return { opis, formula, izracun, rezultat: zaokruzi(rezultat), jedinica };
}

function spakuj(
  naziv: string,
  ctx: KontekstObracuna,
  koraci: KorakObracuna[],
  rezultat: Record<string, number>,
  napomene: string[] = [],
): RezultatObracuna {
  return {
    naziv,
    koraci,
    rezultat: Object.fromEntries(
      Object.entries(rezultat).map(([k, v]) => [k, zaokruzi(v)]),
    ),
    koriscenParametri: ctx.koriscen,
    napomene: [...napomene, ...napomeneOVerifikaciji(ctx)],
    ciljniDatum: ctx.datum.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  PDV
// ─────────────────────────────────────────────────────────────────────────────

export async function obracunPDV(ulaz: {
  iznos: number;
  stopa: "opsta" | "posebna";
  smer: "na_osnovicu" | "iz_bruto";
  datum: Date;
}): Promise<RezultatObracuna> {
  const kljuc =
    ulaz.stopa === "opsta" ? "pdv.opsta_stopa" : "pdv.posebna_stopa";
  const ctx = await pripremiKontekst([kljuc], ulaz.datum);
  const stopa = uzmi(ctx, kljuc);
  const p = stopa / 100;

  const koraci: KorakObracuna[] = [];
  let osnovica: number;
  let pdv: number;
  let ukupno: number;

  if (ulaz.smer === "na_osnovicu") {
    osnovica = ulaz.iznos;
    pdv = osnovica * p;
    ukupno = osnovica + pdv;

    koraci.push(
      korak(
        "Poreska osnovica (iznos bez PDV)",
        "osnovica = uneti iznos",
        RSD(osnovica),
        osnovica,
      ),
      korak(
        `Obračunati PDV po stopi od ${srpskiBroj(stopa, 0)}%`,
        "PDV = osnovica × stopa",
        `${RSD(osnovica)} × ${srpskiBroj(stopa, 0)}% = ${RSD(pdv)}`,
        pdv,
      ),
      korak(
        "Ukupno za naplatu",
        "ukupno = osnovica + PDV",
        `${RSD(osnovica)} + ${RSD(pdv)} = ${RSD(ukupno)}`,
        ukupno,
      ),
    );
  } else {
    ukupno = ulaz.iznos;
    osnovica = ukupno / (1 + p);
    pdv = ukupno - osnovica;

    koraci.push(
      korak(
        "Ukupan iznos sa PDV-om",
        "ukupno = uneti iznos",
        RSD(ukupno),
        ukupno,
      ),
      korak(
        "Izdvajanje osnovice iz bruto iznosa",
        "osnovica = ukupno ÷ (1 + stopa)",
        `${RSD(ukupno)} ÷ ${srpskiBroj(1 + p, 2)} = ${RSD(osnovica)}`,
        osnovica,
      ),
      korak(
        "Sadržani PDV",
        "PDV = ukupno − osnovica",
        `${RSD(ukupno)} − ${RSD(osnovica)} = ${RSD(pdv)}`,
        pdv,
      ),
    );
  }

  return spakuj("Obračun PDV-a", ctx, koraci, { osnovica, pdv, ukupno, stopa }, [
    "Obračunata stopa zavisi od vrste prometa. Posebna stopa primenjuje se samo na dobra i usluge taksativno navedene u Zakonu o PDV.",
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
//  ZARADE
// ─────────────────────────────────────────────────────────────────────────────

const KLJUCEVI_ZARADE = [
  "zarada.neoporezivi_iznos",
  "zarada.stopa_poreza",
  "doprinosi.pio.zaposleni",
  "doprinosi.pio.poslodavac",
  "doprinosi.zdravstvo.zaposleni",
  "doprinosi.zdravstvo.poslodavac",
  "doprinosi.nezaposlenost.zaposleni",
  "doprinosi.najniza_osnovica",
  "doprinosi.najvisa_osnovica",
];

interface RazradaZarade {
  bruto1: number;
  osnovicaDoprinosa: number;
  poreskaOsnovica: number;
  porez: number;
  pioZaposleni: number;
  zdravstvoZaposleni: number;
  nezaposlenost: number;
  ukupnoZaposleni: number;
  neto: number;
  pioPoslodavac: number;
  zdravstvoPoslodavac: number;
  ukupnoPoslodavac: number;
  bruto2: number;
  osnovicaOgranicena: "nema" | "najniza" | "najvisa";
}

/** Jedna funkcija istine za obračun zarade — i bruto→neto i neto→bruto je zovu. */
function razradiZaradu(ctx: KontekstObracuna, bruto1: number): RazradaZarade {
  const neoporezivi = uzmi(ctx, "zarada.neoporezivi_iznos");
  const stopaPoreza = procenat(ctx, "zarada.stopa_poreza");
  const najniza = uzmi(ctx, "doprinosi.najniza_osnovica");
  const najvisa = uzmi(ctx, "doprinosi.najvisa_osnovica");

  // Doprinosi se obračunavaju na bruto zaradu, ali osnovica je ograničena
  // odozdo i odozgo — neoporezivi iznos na doprinose NE utiče.
  let osnovicaDoprinosa = bruto1;
  let ogranicena: RazradaZarade["osnovicaOgranicena"] = "nema";
  if (osnovicaDoprinosa < najniza) {
    osnovicaDoprinosa = najniza;
    ogranicena = "najniza";
  } else if (osnovicaDoprinosa > najvisa) {
    osnovicaDoprinosa = najvisa;
    ogranicena = "najvisa";
  }

  const poreskaOsnovica = Math.max(0, bruto1 - neoporezivi);
  const porez = poreskaOsnovica * stopaPoreza;

  const pioZaposleni = osnovicaDoprinosa * procenat(ctx, "doprinosi.pio.zaposleni");
  const zdravstvoZaposleni =
    osnovicaDoprinosa * procenat(ctx, "doprinosi.zdravstvo.zaposleni");
  const nezaposlenost =
    osnovicaDoprinosa * procenat(ctx, "doprinosi.nezaposlenost.zaposleni");
  const ukupnoZaposleni = pioZaposleni + zdravstvoZaposleni + nezaposlenost;

  const pioPoslodavac =
    osnovicaDoprinosa * procenat(ctx, "doprinosi.pio.poslodavac");
  const zdravstvoPoslodavac =
    osnovicaDoprinosa * procenat(ctx, "doprinosi.zdravstvo.poslodavac");
  const ukupnoPoslodavac = pioPoslodavac + zdravstvoPoslodavac;

  return {
    bruto1,
    osnovicaDoprinosa,
    poreskaOsnovica,
    porez,
    pioZaposleni,
    zdravstvoZaposleni,
    nezaposlenost,
    ukupnoZaposleni,
    neto: bruto1 - porez - ukupnoZaposleni,
    pioPoslodavac,
    zdravstvoPoslodavac,
    ukupnoPoslodavac,
    bruto2: bruto1 + ukupnoPoslodavac,
    osnovicaOgranicena: ogranicena,
  };
}

function koraciZarade(
  ctx: KontekstObracuna,
  r: RazradaZarade,
): KorakObracuna[] {
  const neoporezivi = uzmi(ctx, "zarada.neoporezivi_iznos");
  const stopaPoreza = uzmi(ctx, "zarada.stopa_poreza");

  const koraci = [
    korak("Bruto zarada (bruto 1)", "bruto 1 = polazni iznos", RSD(r.bruto1), r.bruto1),
    korak(
      "Poreska osnovica",
      "osnovica = bruto 1 − neoporezivi iznos",
      `${RSD(r.bruto1)} − ${RSD(neoporezivi)} = ${RSD(r.poreskaOsnovica)}`,
      r.poreskaOsnovica,
    ),
    korak(
      `Porez na zaradu (${srpskiBroj(stopaPoreza, 0)}%)`,
      "porez = poreska osnovica × stopa",
      `${RSD(r.poreskaOsnovica)} × ${srpskiBroj(stopaPoreza, 0)}% = ${RSD(r.porez)}`,
      r.porez,
    ),
    korak(
      "Osnovica za doprinose",
      "osnovica doprinosa = bruto 1, ograničeno najnižom i najvišom osnovicom",
      r.osnovicaOgranicena === "nema"
        ? `${RSD(r.osnovicaDoprinosa)} (u okviru propisanih granica)`
        : `primenjena ${
            r.osnovicaOgranicena === "najniza" ? "najniža" : "najviša"
          } osnovica: ${RSD(r.osnovicaDoprinosa)}`,
      r.osnovicaDoprinosa,
    ),
    korak(
      `Doprinos za PIO na teret zaposlenog (${srpskiBroj(uzmi(ctx, "doprinosi.pio.zaposleni"), 2)}%)`,
      "PIO = osnovica × stopa",
      `${RSD(r.osnovicaDoprinosa)} × ${srpskiBroj(uzmi(ctx, "doprinosi.pio.zaposleni"), 2)}% = ${RSD(r.pioZaposleni)}`,
      r.pioZaposleni,
    ),
    korak(
      `Doprinos za zdravstvo na teret zaposlenog (${srpskiBroj(uzmi(ctx, "doprinosi.zdravstvo.zaposleni"), 2)}%)`,
      "zdravstvo = osnovica × stopa",
      `${RSD(r.osnovicaDoprinosa)} × ${srpskiBroj(uzmi(ctx, "doprinosi.zdravstvo.zaposleni"), 2)}% = ${RSD(r.zdravstvoZaposleni)}`,
      r.zdravstvoZaposleni,
    ),
    korak(
      `Doprinos za nezaposlenost (${srpskiBroj(uzmi(ctx, "doprinosi.nezaposlenost.zaposleni"), 2)}%)`,
      "nezaposlenost = osnovica × stopa",
      `${RSD(r.osnovicaDoprinosa)} × ${srpskiBroj(uzmi(ctx, "doprinosi.nezaposlenost.zaposleni"), 2)}% = ${RSD(r.nezaposlenost)}`,
      r.nezaposlenost,
    ),
    korak(
      "Neto zarada (za isplatu)",
      "neto = bruto 1 − porez − doprinosi na teret zaposlenog",
      `${RSD(r.bruto1)} − ${RSD(r.porez)} − ${RSD(r.ukupnoZaposleni)} = ${RSD(r.neto)}`,
      r.neto,
    ),
    korak(
      `Doprinosi na teret poslodavca (PIO ${srpskiBroj(uzmi(ctx, "doprinosi.pio.poslodavac"), 2)}% + zdravstvo ${srpskiBroj(uzmi(ctx, "doprinosi.zdravstvo.poslodavac"), 2)}%)`,
      "doprinosi poslodavca = osnovica × zbir stopa",
      `${RSD(r.pioPoslodavac)} + ${RSD(r.zdravstvoPoslodavac)} = ${RSD(r.ukupnoPoslodavac)}`,
      r.ukupnoPoslodavac,
    ),
    korak(
      "Ukupan trošak poslodavca (bruto 2)",
      "bruto 2 = bruto 1 + doprinosi na teret poslodavca",
      `${RSD(r.bruto1)} + ${RSD(r.ukupnoPoslodavac)} = ${RSD(r.bruto2)}`,
      r.bruto2,
    ),
  ];
  return koraci;
}

function rezultatZarade(r: RazradaZarade): Record<string, number> {
  return {
    bruto1: r.bruto1,
    neto: r.neto,
    porez: r.porez,
    doprinosiZaposleni: r.ukupnoZaposleni,
    doprinosiPoslodavac: r.ukupnoPoslodavac,
    bruto2: r.bruto2,
    ukupanTrosak: r.bruto2,
    osnovicaDoprinosa: r.osnovicaDoprinosa,
  };
}

export async function obracunBrutoUNeto(ulaz: {
  bruto: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const ctx = await pripremiKontekst(KLJUCEVI_ZARADE, ulaz.datum);
  const r = razradiZaradu(ctx, ulaz.bruto);
  return spakuj(
    "Obračun zarade: bruto → neto",
    ctx,
    koraciZarade(ctx, r),
    rezultatZarade(r),
    napomeneZarade(r),
  );
}

/**
 * Neto → bruto. Rešava se numerički nad istom funkcijom koja radi bruto → neto,
 * pa su dva smera po definiciji konzistentna i kad se aktivira ograničenje
 * najniže/najviše osnovice (gde zatvorena formula prestaje da važi).
 */
export async function obracunNetoUBruto(ulaz: {
  neto: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const ctx = await pripremiKontekst(KLJUCEVI_ZARADE, ulaz.datum);

  let donja = 0;
  let gornja = Math.max(ulaz.neto * 3, 1_000_000);
  let bruto = ulaz.neto;

  for (let i = 0; i < 200; i++) {
    bruto = (donja + gornja) / 2;
    const dobijenNeto = razradiZaradu(ctx, bruto).neto;
    if (Math.abs(dobijenNeto - ulaz.neto) < 0.005) break;
    if (dobijenNeto < ulaz.neto) donja = bruto;
    else gornja = bruto;
  }

  bruto = zaokruzi(bruto);
  const r = razradiZaradu(ctx, bruto);

  const koraci: KorakObracuna[] = [
    korak(
      "Tražena neto zarada",
      "neto = polazni iznos",
      RSD(ulaz.neto),
      ulaz.neto,
    ),
    korak(
      "Utvrđena bruto zarada",
      "bruto 1 se traži tako da nakon poreza i doprinosa da traženi neto iznos",
      `bruto 1 = ${RSD(bruto)} → neto ${RSD(r.neto)}`,
      bruto,
    ),
    ...koraciZarade(ctx, r).slice(1),
  ];

  return spakuj(
    "Obračun zarade: neto → bruto",
    ctx,
    koraci,
    rezultatZarade(r),
    napomeneZarade(r),
  );
}

function napomeneZarade(r: RazradaZarade): string[] {
  const n = [
    "Obračun je za zaradu iz radnog odnosa. Naknade koje se ne smatraju zaradom (prevoz, dnevnice, solidarna pomoć) obračunavaju se posebno.",
    "Neoporezivi iznos umanjuje osnovicu za porez, ali ne i osnovicu za doprinose.",
  ];
  if (r.osnovicaOgranicena === "najniza") {
    n.push(
      "Bruto zarada je ispod najniže mesečne osnovice doprinosa, pa su doprinosi obračunati na najnižu osnovicu — trošak poslodavca je zato srazmerno viši.",
    );
  }
  if (r.osnovicaOgranicena === "najvisa") {
    n.push(
      "Bruto zarada prelazi najvišu mesečnu osnovicu doprinosa, pa su doprinosi obračunati na najvišu osnovicu.",
    );
  }
  n.push(
    "Za zaposlene koji ispunjavaju uslove mogu se primeniti olakšice (npr. za novozaposlena lica) — one nisu uključene u ovaj obračun.",
  );
  return n;
}

/** Ukupan trošak zaposlenog na godišnjem nivou (predlog iz zahteva 27). */
export async function obracunTroskaZaposlenog(ulaz: {
  bruto: number;
  brojMeseci: number;
  mesecniPrevoz?: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const ctx = await pripremiKontekst(KLJUCEVI_ZARADE, ulaz.datum);
  const r = razradiZaradu(ctx, ulaz.bruto);
  const meseci = ulaz.brojMeseci || 12;
  const prevoz = ulaz.mesecniPrevoz ?? 0;

  const godisnjiTrosak = r.bruto2 * meseci + prevoz * meseci;

  const koraci = [
    ...koraciZarade(ctx, r),
    korak(
      "Mesečni trošak poslodavca",
      "mesečni trošak = bruto 2 + naknada troškova prevoza",
      `${RSD(r.bruto2)} + ${RSD(prevoz)} = ${RSD(r.bruto2 + prevoz)}`,
      r.bruto2 + prevoz,
    ),
    korak(
      `Godišnji trošak (${meseci} meseci)`,
      "godišnji trošak = mesečni trošak × broj meseci",
      `${RSD(r.bruto2 + prevoz)} × ${meseci} = ${RSD(godisnjiTrosak)}`,
      godisnjiTrosak,
    ),
  ];

  return spakuj(
    "Ukupan trošak zaposlenog",
    ctx,
    koraci,
    { ...rezultatZarade(r), mesecniTrosak: r.bruto2 + prevoz, godisnjiTrosak },
    [
      ...napomeneZarade(r),
      "Naknada troškova prevoza do propisanog neoporezivog iznosa ne ulazi u osnovicu za porez i doprinose; iznad tog iznosa ima tretman zarade.",
      "U trošak nisu uračunati regres, topli obrok ako se isplaćuje odvojeno, otpremnine, niti troškovi obuke i opreme.",
    ],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  POREZ NA DOBIT I POREZ PO ODBITKU
// ─────────────────────────────────────────────────────────────────────────────

export async function obracunPorezaNaDobit(ulaz: {
  oporezivaDobit: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const ctx = await pripremiKontekst(["dobit.stopa"], ulaz.datum);
  const stopa = uzmi(ctx, "dobit.stopa");
  const porez = ulaz.oporezivaDobit * (stopa / 100);
  const posleOporezivanja = ulaz.oporezivaDobit - porez;

  return spakuj(
    "Porez na dobit pravnih lica",
    ctx,
    [
      korak(
        "Oporeziva dobit (iz poreskog bilansa)",
        "oporeziva dobit = polazni iznos",
        RSD(ulaz.oporezivaDobit),
        ulaz.oporezivaDobit,
      ),
      korak(
        `Porez na dobit (${srpskiBroj(stopa, 0)}%)`,
        "porez = oporeziva dobit × stopa",
        `${RSD(ulaz.oporezivaDobit)} × ${srpskiBroj(stopa, 0)}% = ${RSD(porez)}`,
        porez,
      ),
      korak(
        "Dobit posle oporezivanja",
        "dobit posle poreza = oporeziva dobit − porez",
        `${RSD(ulaz.oporezivaDobit)} − ${RSD(porez)} = ${RSD(posleOporezivanja)}`,
        posleOporezivanja,
      ),
    ],
    { oporezivaDobit: ulaz.oporezivaDobit, porez, posleOporezivanja, stopa },
    [
      "Osnovica je oporeziva dobit iz poreskog bilansa, a ne računovodstvena dobit iz bilansa uspeha — razlikuju se za iznos poreski nepriznatih rashoda i usklađivanja.",
      "Nisu uzeti u obzir poreski krediti, prenos gubitka iz ranijih godina, niti poreske olakšice (npr. po osnovu ulaganja).",
      "Ako se dobit isplaćuje vlasniku kao dividenda, na isplatu se dodatno obračunava porez na prihode od kapitala.",
    ],
  );
}

export async function obracunPorezaPoOdbitku(ulaz: {
  bruto: number;
  preferencijalnaJurisdikcija?: boolean;
  stopaUgovora?: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const kljuc = ulaz.preferencijalnaJurisdikcija
    ? "po_odbitku.stopa_preferencijalne"
    : "po_odbitku.stopa";
  const ctx = await pripremiKontekst([kljuc], ulaz.datum);
  const domacaStopa = uzmi(ctx, kljuc);
  const primenjena = ulaz.stopaUgovora ?? domacaStopa;

  const porez = ulaz.bruto * (primenjena / 100);
  const neto = ulaz.bruto - porez;

  const koraci = [
    korak("Bruto naknada nerezidentu", "bruto = polazni iznos", RSD(ulaz.bruto), ulaz.bruto),
    korak(
      `Domaća stopa poreza po odbitku (${srpskiBroj(domacaStopa, 0)}%)`,
      "domaća stopa iz Zakona o porezu na dobit pravnih lica",
      `${srpskiBroj(domacaStopa, 0)}%`,
      domacaStopa,
      "%",
    ),
  ];

  if (ulaz.stopaUgovora !== undefined) {
    koraci.push(
      korak(
        `Snižena stopa po ugovoru o izbegavanju dvostrukog oporezivanja (${srpskiBroj(primenjena, 2)}%)`,
        "primenjuje se niža stopa iz ugovora, uz uslov dokaza o rezidentnosti",
        `${srpskiBroj(primenjena, 2)}%`,
        primenjena,
        "%",
      ),
    );
  }

  koraci.push(
    korak(
      "Porez po odbitku",
      "porez = bruto × primenjena stopa",
      `${RSD(ulaz.bruto)} × ${srpskiBroj(primenjena, 2)}% = ${RSD(porez)}`,
      porez,
    ),
    korak(
      "Neto isplata nerezidentu",
      "neto = bruto − porez po odbitku",
      `${RSD(ulaz.bruto)} − ${RSD(porez)} = ${RSD(neto)}`,
      neto,
    ),
  );

  return spakuj(
    "Porez po odbitku (nerezidenti)",
    ctx,
    koraci,
    { bruto: ulaz.bruto, porez, neto, primenjenaStopa: primenjena },
    [
      "Niža stopa iz ugovora o izbegavanju dvostrukog oporezivanja može se primeniti samo ako nerezident dostavi potvrdu o rezidentnosti i ako je stvarni vlasnik prihoda.",
      "Obračun se razlikuje po vrsti prihoda (dividende, kamate, autorske naknade, naknade za usluge) — proverite koja vrsta odgovara vašem slučaju.",
      ulaz.preferencijalnaJurisdikcija
        ? "Primenjena je povišena stopa za jurisdikcije sa preferencijalnim poreskim sistemom."
        : "Ako je primalac iz jurisdikcije sa preferencijalnim poreskim sistemom, primenjuje se povišena stopa.",
    ],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PREDUZETNICI
// ─────────────────────────────────────────────────────────────────────────────

export async function obracunPausalca(ulaz: {
  mesecniPausalniPrihod: number;
  godisnjiPromet?: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const ctx = await pripremiKontekst(
    [
      "pausal.stopa_poreza",
      "pausal.limit_prihoda",
      "doprinosi.pio.ukupno",
      "doprinosi.zdravstvo.ukupno",
      "doprinosi.najniza_osnovica",
    ],
    ulaz.datum,
  );

  const osnovica = ulaz.mesecniPausalniPrihod;
  const stopaPoreza = uzmi(ctx, "pausal.stopa_poreza");
  const porez = osnovica * (stopaPoreza / 100);
  const pio = osnovica * procenat(ctx, "doprinosi.pio.ukupno");
  const zdravstvo = osnovica * procenat(ctx, "doprinosi.zdravstvo.ukupno");
  const ukupno = porez + pio + zdravstvo;
  const limit = uzmi(ctx, "pausal.limit_prihoda");

  const koraci = [
    korak(
      "Paušalno utvrđen mesečni prihod (iz rešenja Poreske uprave)",
      "osnovica = paušalni prihod iz rešenja",
      RSD(osnovica),
      osnovica,
    ),
    korak(
      `Porez na paušalni prihod (${srpskiBroj(stopaPoreza, 0)}%)`,
      "porez = paušalni prihod × stopa",
      `${RSD(osnovica)} × ${srpskiBroj(stopaPoreza, 0)}% = ${RSD(porez)}`,
      porez,
    ),
    korak(
      `Doprinos za PIO (${srpskiBroj(uzmi(ctx, "doprinosi.pio.ukupno"), 2)}%)`,
      "PIO = paušalni prihod × stopa",
      `${RSD(osnovica)} × ${srpskiBroj(uzmi(ctx, "doprinosi.pio.ukupno"), 2)}% = ${RSD(pio)}`,
      pio,
    ),
    korak(
      `Doprinos za zdravstveno osiguranje (${srpskiBroj(uzmi(ctx, "doprinosi.zdravstvo.ukupno"), 2)}%)`,
      "zdravstvo = paušalni prihod × stopa",
      `${RSD(osnovica)} × ${srpskiBroj(uzmi(ctx, "doprinosi.zdravstvo.ukupno"), 2)}% = ${RSD(zdravstvo)}`,
      zdravstvo,
    ),
    korak(
      "Ukupna mesečna obaveza",
      "ukupno = porez + PIO + zdravstvo",
      `${RSD(porez)} + ${RSD(pio)} + ${RSD(zdravstvo)} = ${RSD(ukupno)}`,
      ukupno,
    ),
    korak(
      "Godišnja obaveza",
      "godišnje = mesečna obaveza × 12",
      `${RSD(ukupno)} × 12 = ${RSD(ukupno * 12)}`,
      ukupno * 12,
    ),
  ];

  const napomene = [
    "Paušalni prihod NIJE isto što i vaš stvarni promet — utvrđuje ga Poreska uprava rešenjem, na osnovu delatnosti, lokacije i drugih kriterijuma. Unesite iznos iz rešenja.",
    "Ovaj obračun ne zamenjuje rešenje Poreske uprave; služi za proveru i planiranje.",
    `Limit prihoda za paušalno oporezivanje iznosi ${RSD(limit)} godišnje.`,
  ];

  if (ulaz.godisnjiPromet !== undefined) {
    if (ulaz.godisnjiPromet > limit) {
      napomene.unshift(
        `UPOZORENJE: uneti godišnji promet (${RSD(ulaz.godisnjiPromet)}) prelazi limit za paušalno oporezivanje (${RSD(limit)}). Gubi se pravo na paušal i prelazi se na vođenje poslovnih knjiga.`,
      );
    } else if (ulaz.godisnjiPromet > limit * 0.8) {
      napomene.unshift(
        `Uneti godišnji promet (${RSD(ulaz.godisnjiPromet)}) je blizu limita od ${RSD(limit)}. Pratite promet da ne biste nenamerno izgubili pravo na paušal.`,
      );
    }
  }

  return spakuj(
    "Obračun za preduzetnika paušalca",
    ctx,
    koraci,
    { osnovica, porez, pio, zdravstvo, mesecno: ukupno, godisnje: ukupno * 12 },
    napomene,
  );
}

export async function obracunLicneZarade(ulaz: {
  licnaZarada: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const ctx = await pripremiKontekst(KLJUCEVI_ZARADE, ulaz.datum);
  const r = razradiZaradu(ctx, ulaz.licnaZarada);

  return spakuj(
    "Preduzetnik sa ličnom zaradom",
    ctx,
    koraciZarade(ctx, r),
    rezultatZarade(r),
    [
      "Lična zarada preduzetnika oporezuje se kao zarada — po istim stopama poreza i doprinosa.",
      "Isplaćena lična zarada priznaje se kao rashod u poreskom bilansu preduzetnika, pa umanjuje osnovicu poreza na prihod od samostalne delatnosti.",
      "Opredeljenje za isplatu lične zarade prijavljuje se Poreskoj upravi i važi za celu poslovnu godinu.",
    ],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  AMORTIZACIJA, KAPITALNI DOBITAK, DNEVNICE, AUTOMOBIL
// ─────────────────────────────────────────────────────────────────────────────

export async function obracunAmortizacije(ulaz: {
  nabavnaVrednost: number;
  grupa: 1 | 2 | 3 | 4 | 5;
  brojGodina: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const kljuc = `amortizacija.grupa${ulaz.grupa}.stopa`;
  const ctx = await pripremiKontekst([kljuc], ulaz.datum);
  const stopa = uzmi(ctx, kljuc);

  const koraci: KorakObracuna[] = [
    korak(
      "Nabavna vrednost sredstva",
      "osnovica = nabavna vrednost",
      RSD(ulaz.nabavnaVrednost),
      ulaz.nabavnaVrednost,
    ),
    korak(
      `Amortizaciona grupa ${ulaz.grupa} — stopa ${srpskiBroj(stopa, 1)}%`,
      "stopa propisana za amortizacionu grupu",
      `${srpskiBroj(stopa, 1)}%`,
      stopa,
      "%",
    ),
  ];

  // I grupa: proporcionalno na nabavnu vrednost. II–V: degresivno na
  // neotpisanu vrednost.
  let neotpisano = ulaz.nabavnaVrednost;
  let ukupno = 0;
  const godine = Math.max(1, Math.min(ulaz.brojGodina, 40));

  for (let g = 1; g <= godine; g++) {
    const osnovica = ulaz.grupa === 1 ? ulaz.nabavnaVrednost : neotpisano;
    const iznos = osnovica * (stopa / 100);
    neotpisano -= iznos;
    ukupno += iznos;
    koraci.push(
      korak(
        `Amortizacija — godina ${g}`,
        ulaz.grupa === 1
          ? "amortizacija = nabavna vrednost × stopa (proporcionalna metoda)"
          : "amortizacija = neotpisana vrednost × stopa (degresivna metoda)",
        `${RSD(osnovica)} × ${srpskiBroj(stopa, 1)}% = ${RSD(iznos)} → neotpisano ${RSD(Math.max(0, neotpisano))}`,
        iznos,
      ),
    );
    if (neotpisano <= 0) break;
  }

  return spakuj(
    "Poreska amortizacija",
    ctx,
    koraci,
    {
      nabavnaVrednost: ulaz.nabavnaVrednost,
      ukupnaAmortizacija: ukupno,
      neotpisanaVrednost: Math.max(0, neotpisano),
      stopa,
    },
    [
      "Ovo je PORESKA amortizacija za potrebe poreskog bilansa. Računovodstvena amortizacija po MRS/MSFI može biti drugačija i po pravilu se razlikuje.",
      "Za sredstva iz grupa II–V primenjuje se degresivna metoda na neotpisanu vrednost; za grupu I proporcionalna metoda po sredstvu.",
      "Razvrstavanje sredstva u grupu propisano je posebnim pravilnikom — proverite u koju grupu vaše sredstvo spada pre nego što se oslonite na obračun.",
    ],
  );
}

export async function obracunKapitalnogDobitka(ulaz: {
  prodajnaCena: number;
  nabavnaCena: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const ctx = await pripremiKontekst(["kapitalni_dobitak.stopa"], ulaz.datum);
  const stopa = uzmi(ctx, "kapitalni_dobitak.stopa");
  const dobitak = ulaz.prodajnaCena - ulaz.nabavnaCena;
  const porez = dobitak > 0 ? dobitak * (stopa / 100) : 0;

  return spakuj(
    "Porez na kapitalni dobitak",
    ctx,
    [
      korak("Prodajna cena", "prodajna cena = polazni iznos", RSD(ulaz.prodajnaCena), ulaz.prodajnaCena),
      korak("Nabavna cena", "nabavna cena = polazni iznos", RSD(ulaz.nabavnaCena), ulaz.nabavnaCena),
      korak(
        "Kapitalni dobitak",
        "dobitak = prodajna cena − nabavna cena",
        `${RSD(ulaz.prodajnaCena)} − ${RSD(ulaz.nabavnaCena)} = ${RSD(dobitak)}`,
        dobitak,
      ),
      korak(
        `Porez (${srpskiBroj(stopa, 0)}%)`,
        dobitak > 0
          ? "porez = kapitalni dobitak × stopa"
          : "nema kapitalnog dobitka — nema poreske obaveze",
        dobitak > 0
          ? `${RSD(dobitak)} × ${srpskiBroj(stopa, 0)}% = ${RSD(porez)}`
          : `gubitak ${RSD(Math.abs(dobitak))} — porez se ne plaća`,
        porez,
      ),
    ],
    { dobitak, porez, stopa },
    [
      "Nabavna cena se za potrebe utvrđivanja kapitalnog dobitka usklađuje na propisan način — realni iznos može biti drugačiji od knjigovodstvenog.",
      "Postoje zakonom propisana izuzimanja i oslobođenja (npr. po osnovu perioda držanja ili ulaganja u rešavanje stambenog pitanja) — proverite da li se odnose na vaš slučaj.",
      dobitak < 0
        ? "Kapitalni gubitak može se pod propisanim uslovima prebijati sa kapitalnim dobicima u narednim godinama."
        : "",
    ].filter(Boolean),
  );
}

export async function obracunSluzbenogPuta(ulaz: {
  brojDana: number;
  dnevnicaPoDanu?: number;
  predjeniKm?: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const ctx = await pripremiKontekst(
    ["dnevnica.neoporezivi_iznos", "sopstveni_auto.neoporezivi_po_km"],
    ulaz.datum,
  );

  const neoporezivaDnevnica = uzmi(ctx, "dnevnica.neoporezivi_iznos");
  const isplacena = ulaz.dnevnicaPoDanu ?? neoporezivaDnevnica;
  const ukupnoDnevnice = isplacena * ulaz.brojDana;
  const neoporezivoUkupno = Math.min(isplacena, neoporezivaDnevnica) * ulaz.brojDana;
  const oporezivoUkupno = Math.max(0, ukupnoDnevnice - neoporezivoUkupno);

  const koraci = [
    korak(
      "Broj dana službenog puta",
      "broj dana = polazni podatak",
      `${ulaz.brojDana} dana`,
      ulaz.brojDana,
      "dana",
    ),
    korak(
      "Isplaćena dnevnica po danu",
      "dnevnica = iznos koji poslodavac isplaćuje",
      RSD(isplacena),
      isplacena,
    ),
    korak(
      "Neoporezivi iznos dnevnice po danu",
      "neoporezivi iznos propisan zakonom",
      RSD(neoporezivaDnevnica),
      neoporezivaDnevnica,
    ),
    korak(
      "Ukupno isplaćene dnevnice",
      "ukupno = dnevnica × broj dana",
      `${RSD(isplacena)} × ${ulaz.brojDana} = ${RSD(ukupnoDnevnice)}`,
      ukupnoDnevnice,
    ),
    korak(
      "Neoporezivi deo",
      "neoporezivo = min(isplaćena, neoporezivi iznos) × broj dana",
      `${RSD(Math.min(isplacena, neoporezivaDnevnica))} × ${ulaz.brojDana} = ${RSD(neoporezivoUkupno)}`,
      neoporezivoUkupno,
    ),
    korak(
      "Oporezivi deo (ima tretman drugog primanja)",
      "oporezivo = ukupno − neoporezivo",
      `${RSD(ukupnoDnevnice)} − ${RSD(neoporezivoUkupno)} = ${RSD(oporezivoUkupno)}`,
      oporezivoUkupno,
    ),
  ];

  const dodatneNapomene: string[] = [];
  let naknadaKm = 0;

  if (ulaz.predjeniKm) {
    // Ovaj parametar namerno nije seed-ovan dok nije potvrđen prema zvaničnom
    // izvoru. Umesto da obračun radi sa nulom i tiho da pogrešan rezultat,
    // preskačemo taj deo i to jasno kažemo korisniku.
    try {
      const poKm = uzmi(ctx, "sopstveni_auto.neoporezivi_po_km");
      naknadaKm = ulaz.predjeniKm * poKm;
      koraci.push(
        korak(
          "Naknada za korišćenje sopstvenog automobila",
          "naknada = pređeni kilometri × neoporezivi iznos po kilometru",
          `${srpskiBroj(ulaz.predjeniKm, 0)} km × ${RSD(poKm)} = ${RSD(naknadaKm)}`,
          naknadaKm,
        ),
      );
    } catch {
      dodatneNapomene.push(
        "Naknada za korišćenje sopstvenog automobila NIJE obračunata: neoporezivi iznos po kilometru nije potvrđen u pravnoj bazi. Radije ostavljamo obračun nepotpunim nego da damo iznos koji ne možemo da potkrepimo izvorom. Dopunite parametar kroz admin panel ili pokretanjem ingesta.",
      );
    }
  }

  return spakuj(
    "Službeni put i dnevnice",
    ctx,
    koraci,
    {
      ukupnoDnevnice,
      neoporezivo: neoporezivoUkupno,
      oporezivo: oporezivoUkupno,
      naknadaKm,
      ukupno: ukupnoDnevnice + naknadaKm,
    },
    [
      ...dodatneNapomene,
      "Neoporezivi iznosi se usklađuju jednom godišnje — obračun koristi iznos koji je važio na traženi datum.",
      "Dnevnica za službeni put u inostranstvo utvrđuje se posebnim propisom i razlikuje se po zemljama.",
      "Za priznavanje rashoda potreban je uredan putni nalog sa obračunom i pratećom dokumentacijom.",
    ],
  );
}

export async function obracunTroskaAutomobila(ulaz: {
  nabavnaVrednost: number;
  pdvObveznik: boolean;
  koriscenjeIskljucivoPoslovno: boolean;
  godisnjiTroskoviGoriva?: number;
  godisnjiTroskoviOdrzavanja?: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const ctx = await pripremiKontekst(
    ["pdv.opsta_stopa", "amortizacija.grupa3.stopa", "dobit.stopa"],
    ulaz.datum,
  );

  const stopaPDV = uzmi(ctx, "pdv.opsta_stopa");
  const osnovica = ulaz.nabavnaVrednost / (1 + stopaPDV / 100);
  const pdv = ulaz.nabavnaVrednost - osnovica;

  const koraci = [
    korak(
      "Nabavna vrednost sa PDV-om",
      "nabavna vrednost = polazni iznos",
      RSD(ulaz.nabavnaVrednost),
      ulaz.nabavnaVrednost,
    ),
    korak(
      "Osnovica bez PDV-a",
      "osnovica = nabavna vrednost ÷ (1 + stopa PDV)",
      `${RSD(ulaz.nabavnaVrednost)} ÷ ${srpskiBroj(1 + stopaPDV / 100, 2)} = ${RSD(osnovica)}`,
      osnovica,
    ),
    korak(
      "Sadržani PDV",
      "PDV = nabavna vrednost − osnovica",
      `${RSD(ulaz.nabavnaVrednost)} − ${RSD(osnovica)} = ${RSD(pdv)}`,
      pdv,
    ),
  ];

  // Pravo na odbitak prethodnog poreza za putničke automobile je po pravilu
  // isključeno; izuzetak postoji samo za tačno određene delatnosti.
  const odbitakPDV = 0;
  koraci.push(
    korak(
      "Pravo na odbitak prethodnog poreza",
      "za putničke automobile pravo na odbitak je po pravilu isključeno, osim za taksativno navedene delatnosti",
      ulaz.pdvObveznik
        ? "PDV obveznik jeste, ali kod putničkog automobila odbitak po pravilu NIJE dozvoljen → 0,00 RSD"
        : "nije PDV obveznik → nema prava na odbitak → 0,00 RSD",
      odbitakPDV,
    ),
  );

  const stopaAmortizacije = uzmi(ctx, "amortizacija.grupa3.stopa");
  const prvaGodinaAmortizacije = ulaz.nabavnaVrednost * (stopaAmortizacije / 100);
  koraci.push(
    korak(
      `Poreska amortizacija — prva godina (${srpskiBroj(stopaAmortizacije, 1)}%)`,
      "amortizacija = nabavna vrednost × stopa grupe",
      `${RSD(ulaz.nabavnaVrednost)} × ${srpskiBroj(stopaAmortizacije, 1)}% = ${RSD(prvaGodinaAmortizacije)}`,
      prvaGodinaAmortizacije,
    ),
  );

  const gorivo = ulaz.godisnjiTroskoviGoriva ?? 0;
  const odrzavanje = ulaz.godisnjiTroskoviOdrzavanja ?? 0;
  const tekuciTroskovi = gorivo + odrzavanje;
  const ukupnoPrvaGodina = prvaGodinaAmortizacije + tekuciTroskovi;

  if (tekuciTroskovi > 0) {
    koraci.push(
      korak(
        "Godišnji tekući troškovi (gorivo i održavanje)",
        "tekući troškovi = gorivo + održavanje",
        `${RSD(gorivo)} + ${RSD(odrzavanje)} = ${RSD(tekuciTroskovi)}`,
        tekuciTroskovi,
      ),
    );
  }

  const stopaDobiti = uzmi(ctx, "dobit.stopa");
  const ustedaNaPorezu = ukupnoPrvaGodina * (stopaDobiti / 100);

  koraci.push(
    korak(
      "Ukupno poreski priznati rashodi u prvoj godini",
      "rashodi = amortizacija + tekući troškovi",
      `${RSD(prvaGodinaAmortizacije)} + ${RSD(tekuciTroskovi)} = ${RSD(ukupnoPrvaGodina)}`,
      ukupnoPrvaGodina,
    ),
    korak(
      `Efekat na porez na dobit (${srpskiBroj(stopaDobiti, 0)}%)`,
      "ušteda = poreski priznati rashodi × stopa poreza na dobit",
      `${RSD(ukupnoPrvaGodina)} × ${srpskiBroj(stopaDobiti, 0)}% = ${RSD(ustedaNaPorezu)}`,
      ustedaNaPorezu,
    ),
  );

  const napomene = [
    "Pravo na odbitak prethodnog poreza kod nabavke putničkog automobila po pravilu je isključeno. Izuzetak postoji samo ako se vozilo koristi isključivo za delatnosti koje su u zakonu taksativno navedene (npr. prevoz lica, iznajmljivanje vozila, obuka vozača).",
    "Isto isključenje po pravilu se odnosi i na gorivo, rezervne delove, održavanje i druge troškove povezane sa korišćenjem vozila.",
  ];

  if (!ulaz.koriscenjeIskljucivoPoslovno) {
    napomene.push(
      "UPOZORENJE: naveli ste da vozilo neće biti korišćeno isključivo poslovno. Korišćenje službenog vozila u privatne svrhe po pravilu predstavlja primanje zaposlenog/direktora i ima poreski tretman zarade, uz obavezu obračuna poreza i doprinosa. Ovaj obračun taj efekat NE uključuje jer zavisi od načina utvrđivanja vrednosti koristi.",
      "Deo troškova koji se odnosi na privatno korišćenje po pravilu se ne priznaje kao rashod u poreskom bilansu.",
    );
  }

  napomene.push(
    "Razvrstavanje vozila u amortizacionu grupu proverite u pravilniku o razvrstavanju stalnih sredstava — od grupe zavisi stopa.",
    "Obračun ne uključuje porez na upotrebu motornih vozila, osiguranje ni registraciju.",
  );

  return spakuj(
    "Trošak službenog automobila",
    ctx,
    koraci,
    {
      nabavnaVrednost: ulaz.nabavnaVrednost,
      osnovica,
      pdv,
      odbitakPDV,
      amortizacijaPrvaGodina: prvaGodinaAmortizacije,
      tekuciTroskovi,
      poreskiPriznatiRashodi: ukupnoPrvaGodina,
      ustedaNaPorezuNaDobit: ustedaNaPorezu,
    },
    napomene,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  "ŠTA AKO" — poređenje pravnih formi (zahtev 27)
// ─────────────────────────────────────────────────────────────────────────────

export async function uporediPravneForme(ulaz: {
  godisnjiPrihod: number;
  godisnjiTroskovi: number;
  mesecniPausalniPrihod?: number;
  datum: Date;
}): Promise<RezultatObracuna> {
  const ctx = await pripremiKontekst(
    [
      "pausal.stopa_poreza",
      "pausal.limit_prihoda",
      "doprinosi.pio.ukupno",
      "doprinosi.zdravstvo.ukupno",
      "doprinosi.najniza_osnovica",
      "dobit.stopa",
      ...KLJUCEVI_ZARADE,
    ],
    ulaz.datum,
  );

  const koraci: KorakObracuna[] = [];
  const limit = uzmi(ctx, "pausal.limit_prihoda");
  const dobitPreOporezivanja = ulaz.godisnjiPrihod - ulaz.godisnjiTroskovi;

  koraci.push(
    korak(
      "Godišnji prihod",
      "prihod = polazni iznos",
      RSD(ulaz.godisnjiPrihod),
      ulaz.godisnjiPrihod,
    ),
    korak(
      "Godišnji poslovni troškovi",
      "troškovi = polazni iznos",
      RSD(ulaz.godisnjiTroskovi),
      ulaz.godisnjiTroskovi,
    ),
    korak(
      "Dobit pre oporezivanja",
      "dobit = prihod − troškovi",
      `${RSD(ulaz.godisnjiPrihod)} − ${RSD(ulaz.godisnjiTroskovi)} = ${RSD(dobitPreOporezivanja)}`,
      dobitPreOporezivanja,
    ),
  );

  // Varijanta A — paušalac
  let ukupnoPausal = Number.NaN;
  const pausalMoguc = ulaz.godisnjiPrihod <= limit;
  if (pausalMoguc && ulaz.mesecniPausalniPrihod) {
    const o = ulaz.mesecniPausalniPrihod;
    const mesecno =
      o * (uzmi(ctx, "pausal.stopa_poreza") / 100) +
      o * procenat(ctx, "doprinosi.pio.ukupno") +
      o * procenat(ctx, "doprinosi.zdravstvo.ukupno");
    ukupnoPausal = mesecno * 12;
    koraci.push(
      korak(
        "Varijanta A — preduzetnik paušalac (godišnje davanje)",
        "godišnje = (porez + PIO + zdravstvo) na paušalni prihod × 12",
        `${RSD(mesecno)} × 12 = ${RSD(ukupnoPausal)}`,
        ukupnoPausal,
      ),
    );
  } else {
    koraci.push(
      korak(
        "Varijanta A — preduzetnik paušalac",
        pausalMoguc
          ? "za obračun je potreban paušalni prihod iz rešenja Poreske uprave"
          : "prihod prelazi limit za paušalno oporezivanje — varijanta nije moguća",
        pausalMoguc
          ? "nije obračunato (nedostaje paušalni prihod iz rešenja)"
          : `${RSD(ulaz.godisnjiPrihod)} > ${RSD(limit)}`,
        0,
      ),
    );
  }

  // Varijanta B — preduzetnik sa ličnom zaradom
  const mesecnaLicna = Math.max(
    uzmi(ctx, "doprinosi.najniza_osnovica"),
    dobitPreOporezivanja / 12 / 2,
  );
  const razrada = razradiZaradu(ctx, mesecnaLicna);
  const godisnjeDavanjeLicna =
    (razrada.porez + razrada.ukupnoZaposleni + razrada.ukupnoPoslodavac) * 12;
  const preostalaDobit = dobitPreOporezivanja - razrada.bruto2 * 12;
  const porezNaPreostalu = Math.max(0, preostalaDobit) * 0.1;
  const ukupnoLicna = godisnjeDavanjeLicna + porezNaPreostalu;

  koraci.push(
    korak(
      "Varijanta B — preduzetnik sa ličnom zaradom (orijentaciono)",
      "godišnje = (porez + doprinosi na ličnu zaradu) × 12 + porez na preostalu dobit",
      `${RSD(godisnjeDavanjeLicna)} + ${RSD(porezNaPreostalu)} = ${RSD(ukupnoLicna)}`,
      ukupnoLicna,
    ),
  );

  // Varijanta C — DOO
  const porezNaDobit = Math.max(0, dobitPreOporezivanja) * procenat(ctx, "dobit.stopa");
  koraci.push(
    korak(
      "Varijanta C — DOO, porez na dobit (bez isplate dividende)",
      "porez = oporeziva dobit × stopa poreza na dobit",
      `${RSD(Math.max(0, dobitPreOporezivanja))} × ${srpskiBroj(uzmi(ctx, "dobit.stopa"), 0)}% = ${RSD(porezNaDobit)}`,
      porezNaDobit,
    ),
  );

  return spakuj(
    "Poređenje pravnih formi — scenario „šta ako”",
    ctx,
    koraci,
    {
      dobitPreOporezivanja,
      pausalGodisnje: Number.isNaN(ukupnoPausal) ? 0 : ukupnoPausal,
      licnaZaradaGodisnje: ukupnoLicna,
      dooPorezNaDobit: porezNaDobit,
    },
    [
      "ORIJENTACIONO POREĐENJE. Služi za grubu procenu reda veličine, ne za odluku o pravnoj formi bez konsultacije sa računovođom.",
      "Varijanta B pretpostavlja ličnu zaradu u visini polovine mesečne dobiti (najmanje u visini najniže osnovice doprinosa) — stvarni iznos birate sami i on bitno menja rezultat.",
      "Varijanta C ne uključuje porez na dividendu pri isplati dobiti vlasniku, niti trošak obaveznog knjigovodstva i revizije.",
      "Nisu uzete u obzir poreske olakšice, prenos gubitka, ni obaveza ulaska u sistem PDV-a pri prelasku praga prometa.",
      "Izbor pravne forme ima i pravne i poslovne posledice koje nisu poreske (odgovornost, ugled kod klijenata, mogućnost zapošljavanja).",
    ],
  );
}
