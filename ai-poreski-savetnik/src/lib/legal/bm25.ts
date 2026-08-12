/**
 * BM25 nad odredbama. Namerno u procesu, bez spoljne pretraživačke
 * infrastrukture: korpus propisa je reda veličine desetina hiljada odredbi, što
 * staje u memoriju, a jedna zavisnost manje znači jedno mesto manje gde sistem
 * može da otkaže.
 *
 * Za veći korpus na Postgresu — zameniti `tsvector` GIN indeksom; interfejs
 * `pretraziLeksicki` ostaje isti.
 */

import { tokenizuj } from "./normalize";

export interface DokumentIndeksa {
  id: string;
  tekst: string;
  /** Naslov i oznaka člana nose više signala od tela teksta. */
  pojacanje?: string;
}

interface Zapis {
  id: string;
  duzina: number;
  frekvencije: Map<string, number>;
}

const K1 = 1.5;
const B = 0.75;
/** Tokeni iz naslova i oznake člana broje se višestruko. */
const TEZINA_POJACANJA = 3;

export class LeksickiIndeks {
  private zapisi: Zapis[] = [];
  private df = new Map<string, number>();
  private prosecnaDuzina = 0;

  constructor(dokumenti: DokumentIndeksa[]) {
    for (const dok of dokumenti) {
      const tokeni = tokenizuj(dok.tekst);
      if (dok.pojacanje) {
        const pojacani = tokenizuj(dok.pojacanje);
        for (let i = 0; i < TEZINA_POJACANJA; i++) tokeni.push(...pojacani);
      }

      const frekvencije = new Map<string, number>();
      for (const token of tokeni) {
        frekvencije.set(token, (frekvencije.get(token) ?? 0) + 1);
      }
      for (const token of frekvencije.keys()) {
        this.df.set(token, (this.df.get(token) ?? 0) + 1);
      }

      this.zapisi.push({ id: dok.id, duzina: tokeni.length, frekvencije });
    }

    const ukupno = this.zapisi.reduce((s, z) => s + z.duzina, 0);
    this.prosecnaDuzina = this.zapisi.length ? ukupno / this.zapisi.length : 0;
  }

  private idf(token: string): number {
    const n = this.zapisi.length;
    const df = this.df.get(token) ?? 0;
    // BM25+ varijanta IDF-a — ne postaje negativan za vrlo česte reči.
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /** Vraća parove [id, skor], sortirano opadajuće, samo pozitivni skorovi. */
  pretrazi(upit: string, limit = 40): Array<{ id: string; skor: number }> {
    if (this.zapisi.length === 0) return [];
    const tokeni = tokenizuj(upit, true);
    if (tokeni.length === 0) return [];

    const rezultati: Array<{ id: string; skor: number }> = [];

    for (const zapis of this.zapisi) {
      let skor = 0;
      for (const token of tokeni) {
        const tf = zapis.frekvencije.get(token);
        if (!tf) continue;
        const norm =
          tf * (K1 + 1) /
          (tf + K1 * (1 - B + (B * zapis.duzina) / (this.prosecnaDuzina || 1)));
        skor += this.idf(token) * norm;
      }
      if (skor > 0) rezultati.push({ id: zapis.id, skor });
    }

    rezultati.sort((a, b) => b.skor - a.skor);
    return rezultati.slice(0, limit);
  }

  get velicina(): number {
    return this.zapisi.length;
  }
}

/** Min-max normalizacija skorova na [0,1] radi spajanja sa kosinusnom sličnošću. */
export function normalizujSkorove(
  rezultati: Array<{ id: string; skor: number }>,
): Map<string, number> {
  const mapa = new Map<string, number>();
  if (rezultati.length === 0) return mapa;

  const maks = rezultati[0].skor;
  const min = rezultati[rezultati.length - 1].skor;
  const raspon = maks - min || 1;

  for (const r of rezultati) {
    mapa.set(r.id, (r.skor - min) / raspon);
  }
  return mapa;
}
