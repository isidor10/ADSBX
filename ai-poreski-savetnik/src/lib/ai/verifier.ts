/**
 * Verifikator citata — poslednja brana protiv halucinacije (zahtev 20).
 *
 * Radi POSLE generisanja i pre nego što odgovor izađe ka korisniku:
 *   1. odbacuje svaki citatId koji nije bio u kontekstu modela,
 *   2. odbacuje odredbe koje ne smeju da posluže kao osnov na traženi datum,
 *   3. obara nivo pouzdanosti kad su citati odbačeni ili kad ih uopšte nema,
 *   4. obara pouzdanost kad se odgovor oslanja samo na sekundarne izvore.
 *
 * Odbačeni citati se pamte u audit zapisu — to je merljiv pokazatelj kvaliteta
 * sistema kroz vreme.
 */

import type {
  NivoPouzdanosti,
  PronadjenaOdredba,
  StrukturiraniOdgovor,
  WebIzvor,
} from "../types";
import { renderujCitat, type RenderovanCitat } from "../legal/citations";
import { bezDijakritike, uLatinicu } from "../legal/normalize";
import { smeKaoOsnov, upozorenjeZaStatus } from "../legal/temporal";

export interface RezultatVerifikacije {
  odgovor: StrukturiraniOdgovor;
  citati: RenderovanCitat[];
  webIzvori: WebIzvor[];
  odbaceniCitati: string[];
  dodataUpozorenja: string[];
  nivoPouzdanosti: NivoPouzdanosti;
}

const REDOSLED_NIVOA: NivoPouzdanosti[] = [
  "VISOKA",
  "POTREBNA_PROVERA",
  "NEDOVOLJNO_PODATAKA",
];

/** Vraća niži (konzervativniji) od dva nivoa. */
function spustiNivo(
  a: NivoPouzdanosti,
  b: NivoPouzdanosti,
): NivoPouzdanosti {
  return REDOSLED_NIVOA.indexOf(a) >= REDOSLED_NIVOA.indexOf(b) ? a : b;
}

export function verifikuj(
  odgovor: StrukturiraniOdgovor,
  kontekst: PronadjenaOdredba[],
  webIzvori: WebIzvor[],
  ciljniDatum: Date,
): RezultatVerifikacije {
  const poId = new Map(kontekst.map((o) => [o.id, o]));

  const citati: RenderovanCitat[] = [];
  const odbaceni: string[] = [];
  const upozorenja: string[] = [];
  let nivo = odgovor.nivoPouzdanosti;

  for (const osnov of odgovor.pravniOsnov) {
    const odredba = poId.get(osnov.citatId);

    // 1. Citat koji nije bio u kontekstu = halucinacija. Ne prolazi.
    if (!odredba) {
      odbaceni.push(osnov.citatId);
      continue;
    }

    // 2. Odredba koja na traženi datum ne sme da bude osnov.
    if (!smeKaoOsnov(odredba.statusVazenja)) {
      odbaceni.push(osnov.citatId);
      const u = upozorenjeZaStatus(
        odredba.statusVazenja,
        odredba.vaziOd,
        odredba.vaziDo,
      );
      if (u) upozorenja.push(u);
      continue;
    }

    // 3. Odredba važi, ali je istorijska — prolazi uz jasnu oznaku perioda.
    if (odredba.statusVazenja === "PRESTAO_DA_VAZI") {
      const u = upozorenjeZaStatus(
        odredba.statusVazenja,
        odredba.vaziOd,
        odredba.vaziDo,
      );
      if (u) upozorenja.push(u);
    }

    // 4. Odredba čiji broj člana nije potvrđen ne može da nosi visoku pouzdanost.
    if (!odredba.potvrdjenBrojClana) {
      nivo = spustiNivo(nivo, "POTREBNA_PROVERA");
    }

    citati.push(
      renderujCitat(odredba, osnov.relevantnost, osnov.tipTvrdnje),
    );
  }

  // ── Posledice po pouzdanost ─────────────────────────────────────────────
  if (odbaceni.length > 0) {
    nivo = spustiNivo(nivo, "POTREBNA_PROVERA");
    upozorenja.push(
      `Sistem je odbacio ${odbaceni.length} navedenih izvora jer nisu potvrđeni u pravnoj bazi. Odgovor je zato označen kao "potrebna dodatna provera".`,
    );
  }

  if (citati.length === 0) {
    nivo = "NEDOVOLJNO_PODATAKA";
    if (webIzvori.length === 0) {
      upozorenja.push(
        "Nije pronađen potvrđen pravni osnov za ovaj odgovor. Ne mogu pouzdano da potvrdim ovu informaciju na osnovu trenutno dostupnih izvora.",
      );
    } else {
      upozorenja.push(
        "Odgovor se oslanja samo na izvore sa weba, bez potvrđene odredbe u pravnoj bazi. Obavezno proverite važeći tekst propisa.",
      );
    }
  }

  // Odgovor koji stoji samo na sekundarnim izvorima ne sme biti "visoka".
  const imaPrimarni =
    citati.some((c) => c.prioritet <= 5) ||
    webIzvori.some((i) => i.prioritet <= 5);
  if (!imaPrimarni && citati.length + webIzvori.length > 0) {
    nivo = spustiNivo(nivo, "POTREBNA_PROVERA");
    upozorenja.push(
      "Odgovor se oslanja na sekundarne izvore. Preporučuje se provera prema Službenom glasniku, Ministarstvu finansija ili Poreskoj upravi.",
    );
  }

  // Nepotvrđen zapis u bazi takođe obara nivo.
  if (citati.some((c) => c.verifikacija === "NEPOTVRDJENO")) {
    nivo = spustiNivo(nivo, "POTREBNA_PROVERA");
  }

  // Ako model traži dodatne podatke, odgovor po definiciji nije konačan.
  if (odgovor.potrebnaPitanja?.length) {
    nivo = spustiNivo(nivo, "POTREBNA_PROVERA");
  }

  return {
    odgovor: { ...odgovor, pravniOsnov: odgovor.pravniOsnov, nivoPouzdanosti: nivo },
    citati,
    webIzvori,
    odbaceniCitati: odbaceni,
    dodataUpozorenja: [...new Set(upozorenja)],
    nivoPouzdanosti: nivo,
  };
}

/**
 * Traži brojeve članova koje je model napisao u slobodnom tekstu, a koji nisu
 * potkrepljeni nijednim citatom. Ne briše tekst — obeležava ga, jer brisanje
 * usred rečenice pravi nečitljiv odgovor. UI prikazuje upozorenje.
 */
export function proveriClanoveUTekstu(
  tekst: string,
  citati: RenderovanCitat[],
): string[] {
  // Poklapanje ide nad tekstom bez dijakritike — `\b` u JS regexu ne radi
  // ispred ne-ASCII slova, pa bi "\bčlan" promašilo svaki "član".
  const normalizovan = bezDijakritike(uLatinicu(tekst)).toLowerCase();

  const potvrdjeniBrojevi = new Set(
    citati
      .filter((c) => c.potvrdjen)
      .map((c) => bezDijakritike(c.oznaka).toLowerCase())
      .map((o) => o.match(/clan\s*(\d+[a-z]?)/)?.[1])
      .filter((b): b is string => Boolean(b)),
  );

  const sumnjivi: string[] = [];
  for (const m of normalizovan.matchAll(/\bclan(?:a|u|om)?\s*(\d+[a-z]?)/g)) {
    if (!potvrdjeniBrojevi.has(m[1])) sumnjivi.push(`član ${m[1]}`);
  }
  return [...new Set(sumnjivi)];
}

export const OPIS_POUZDANOSTI: Record<
  NivoPouzdanosti,
  { oznaka: string; boja: string; opis: string }
> = {
  VISOKA: {
    oznaka: "Visoka pouzdanost",
    boja: "zelena",
    opis: "Direktno potvrđeno važećim propisom iz zvaničnog izvora.",
  },
  POTREBNA_PROVERA: {
    oznaka: "Potrebna dodatna provera",
    boja: "zuta",
    opis:
      "Postoji više relevantnih propisa, moguće različito tumačenje ili sekundarni izvor.",
  },
  NEDOVOLJNO_PODATAKA: {
    oznaka: "Nedovoljno podataka",
    boja: "crvena",
    opis:
      "Ne može se dati pouzdan odgovor bez dodatnih informacija ili potvrđenog pravnog osnova.",
  },
};
