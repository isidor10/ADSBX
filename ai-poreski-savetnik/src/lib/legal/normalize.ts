/**
 * Normalizacija srpskog teksta za leksičku pretragu.
 *
 * Bez ovoga BM25 na srpskom praktično ne radi: propisi su pisani i ćirilicom i
 * latinicom, korisnici kucaju bez dijakritike ("pausalac", "clan"), a padeži
 * razbijaju poklapanje ("odbitak" / "odbitka" / "odbitku").
 */

const CIRILICA_LATINICA: Array<[string, string]> = [
  ["Љ", "Lj"], ["Њ", "Nj"], ["Џ", "Dž"], ["љ", "lj"], ["њ", "nj"], ["џ", "dž"],
  ["А", "A"], ["Б", "B"], ["В", "V"], ["Г", "G"], ["Д", "D"], ["Ђ", "Đ"],
  ["Е", "E"], ["Ж", "Ž"], ["З", "Z"], ["И", "I"], ["Ј", "J"], ["К", "K"],
  ["Л", "L"], ["М", "M"], ["Н", "N"], ["О", "O"], ["П", "P"], ["Р", "R"],
  ["С", "S"], ["Т", "T"], ["Ћ", "Ć"], ["У", "U"], ["Ф", "F"], ["Х", "H"],
  ["Ц", "C"], ["Ч", "Č"], ["Ш", "Š"],
  ["а", "a"], ["б", "b"], ["в", "v"], ["г", "g"], ["д", "d"], ["ђ", "đ"],
  ["е", "e"], ["ж", "ž"], ["з", "z"], ["и", "i"], ["ј", "j"], ["к", "k"],
  ["л", "l"], ["м", "m"], ["н", "n"], ["о", "o"], ["п", "p"], ["р", "r"],
  ["с", "s"], ["т", "t"], ["ћ", "ć"], ["у", "u"], ["ф", "f"], ["х", "h"],
  ["ц", "c"], ["ч", "č"], ["ш", "š"],
];

const DIJAKRITIKA: Record<string, string> = {
  č: "c", ć: "c", š: "s", ž: "z", đ: "dj",
  Č: "C", Ć: "C", Š: "S", Ž: "Z", Đ: "Dj",
};

/** Ćirilica → latinica. Propisi se objavljuju ćirilicom, aplikacija je latinična. */
export function uLatinicu(tekst: string): string {
  let rezultat = tekst;
  for (const [cir, lat] of CIRILICA_LATINICA) {
    rezultat = rezultat.split(cir).join(lat);
  }
  return rezultat;
}

/** Uklanja dijakritiku: "poreĐeno" → "poredjeno". */
export function bezDijakritike(tekst: string): string {
  return tekst.replace(/[čćšžđČĆŠŽĐ]/g, (z) => DIJAKRITIKA[z] ?? z);
}

/**
 * Lagani stemmer za srpski. Ne pokušava morfološku analizu — samo skida česte
 * nastavke da bi padeži i množina pali na isti koren. Namerno konzervativan:
 * bolje je propustiti poklapanje nego spojiti nepovezane reči.
 */
const NASTAVCI = [
  "ovima", "evima", "ijama", "ijima", "ostima",
  "ama", "ima", "oga", "omu", "ovi", "evi", "ost", "ima",
  "og", "om", "im", "ih", "ih", "em", "u", "e", "a", "i", "o",
];

export function koren(rec: string): string {
  if (rec.length <= 4) return rec;
  for (const nastavak of NASTAVCI) {
    if (rec.length - nastavak.length >= 4 && rec.endsWith(nastavak)) {
      return rec.slice(0, rec.length - nastavak.length);
    }
  }
  return rec;
}

/**
 * Sinonimi i skraćenice iz poreske prakse. Korisnik piše "pausalac", propis
 * kaže "paušalno utvrđen prihod" — bez ovog mapiranja se ne sretnu.
 */
const SINONIMI: Record<string, string[]> = {
  pdv: ["porez na dodatu vrednost", "porez dodatu vrednost"],
  zpdv: ["zakon o porezu na dodatu vrednost"],
  pausalac: ["pausalno oporezivanje", "pausalno utvrdjen prihod", "pausal"],
  pausal: ["pausalno oporezivanje", "pausalac"],
  doo: ["drustvo s ogranicenom odgovornoscu", "drustvo sa ogranicenom odgovornoscu"],
  pio: ["penzijsko i invalidsko osiguranje"],
  sef: ["sistem elektronskih faktura", "efaktura", "elektronska faktura"],
  efaktura: ["elektronska faktura", "sistem elektronskih faktura", "sef"],
  pu: ["poreska uprava"],
  mf: ["ministarstvo finansija"],
  apr: ["agencija za privredne registre"],
  msfi: ["medjunarodni standardi finansijskog izvestavanja"],
  zarada: ["plata", "primanje"],
  plata: ["zarada"],
  dnevnica: ["sluzbeno putovanje", "naknada troskova sluzbenog puta"],
  amortizacija: ["otpis stalnih sredstava"],
  prethodniporez: ["odbitak prethodnog poreza", "ulazni pdv"],
};

/** Puna normalizacija za indeksiranje i upit. */
export function normalizuj(tekst: string): string {
  return bezDijakritike(uLatinicu(tekst))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenizacija + stemming + proširenje sinonimima. */
export function tokenizuj(tekst: string, prosiriSinonime = false): string[] {
  const normalizovan = normalizuj(tekst);
  const tokeni = normalizovan.split(" ").filter((t) => t.length > 1);

  if (!prosiriSinonime) return tokeni.map(koren);

  const prosireni = [...tokeni];
  for (const token of tokeni) {
    const sinonimi = SINONIMI[token];
    if (sinonimi) {
      for (const s of sinonimi) prosireni.push(...normalizuj(s).split(" "));
    }
  }
  return prosireni.filter((t) => t.length > 1).map(koren);
}

/**
 * Prepoznaje da li korisnik traži konkretan član ("šta kaže član 29 Zakona o
 * PDV"). Direktan pogodak člana ima prednost nad semantičkom sličnošću —
 * zahtev 31.
 */
export interface ReferencaClana {
  clan: string;
  stav?: string;
  propisTekst?: string;
}

export function prepoznajReferencuClana(upit: string): ReferencaClana | null {
  // Dijakritika se skida PRE poklapanja: `\b` u JS regexu ne radi ispred
  // ne-ASCII slova, pa bi "\bčlan" nikad ne pogodilo "član".
  const t = bezDijakritike(uLatinicu(upit)).toLowerCase();

  // "član 28", "clan 28.", "čl. 28", "član 28 stav 1", "član 10b"
  const m = t.match(
    /\b(?:clan|cl\.)\s*(\d+[a-z]?)\s*(?:\.|,)?\s*(?:stav\s*(\d+))?/,
  );
  if (!m) return null;

  // Pokušaj da izvučemo naziv propisa iza broja člana.
  const posle = t.slice((m.index ?? 0) + m[0].length);
  const propisMatch = posle.match(
    /(?:zakona?|pravilnika?|uredbe?)\s+(?:o\s+)?([a-z\s]{3,60})/,
  );

  return {
    clan: m[1],
    stav: m[2],
    propisTekst: propisMatch ? propisMatch[1].trim() : undefined,
  };
}

/**
 * Izvlači ciljni datum iz pitanja. Zahtev 32 — "koliko je bilo 2023" ne sme da
 * se odgovori današnjim zakonom.
 */
export function prepoznajCiljniDatum(upit: string, danas = new Date()): Date {
  const t = uLatinicu(upit).toLowerCase();

  // "od 1. januara 2026", "1.1.2026", "01.01.2026."
  const pun = t.match(/\b(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/);
  if (pun) {
    const d = new Date(Date.UTC(+pun[3], +pun[2] - 1, +pun[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }

  const MESECI: Record<string, number> = {
    januar: 0, februar: 1, mart: 2, april: 3, maj: 4, jun: 5,
    jul: 6, avgust: 7, septembar: 8, oktobar: 9, novembar: 10, decembar: 11,
  };
  const slovima = t.match(
    /\b(\d{1,2})\.?\s*(januar|februar|mart|april|maj|jun|jul|avgust|septembar|oktobar|novembar|decembar)\w*\s*(\d{4})/,
  );
  if (slovima) {
    return new Date(Date.UTC(+slovima[3], MESECI[slovima[2]], +slovima[1]));
  }

  // Samo godina: "porez 2023", "u 2024. godini"
  const godina = t.match(/\b(19|20)(\d{2})\b/);
  if (godina) {
    const g = +`${godina[1]}${godina[2]}`;
    const tekuca = danas.getUTCFullYear();
    if (g >= 1990 && g <= tekuca + 5) {
      // Za prošlu godinu uzimamo 31.12. te godine (kraj poreskog perioda),
      // za tekuću i buduće — 1. januar.
      return g < tekuca
        ? new Date(Date.UTC(g, 11, 31))
        : new Date(Date.UTC(g, 0, 1));
    }
  }

  return danas;
}

/** Formatira datum u srpski zapis: 12.08.2026. */
export function srpskiDatum(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const datum = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(datum.getTime())) return "—";
  const dan = String(datum.getUTCDate()).padStart(2, "0");
  const mesec = String(datum.getUTCMonth() + 1).padStart(2, "0");
  return `${dan}.${mesec}.${datum.getUTCFullYear()}.`;
}

/** Formatira broj u srpski zapis: 1.234.567,89 */
export function srpskiBroj(n: number, decimala = 2): string {
  return n.toLocaleString("sr-RS", {
    minimumFractionDigits: decimala,
    maximumFractionDigits: decimala,
  });
}
