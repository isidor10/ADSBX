"use client";

/**
 * Glasovni razgovor.
 *
 * Držimo se jednog pravila: glas je drugi način da se postavi isto pitanje i
 * čuje isti odgovor — nikada kraći put koji preskače proveru. Pitanje ide kroz
 * isti tok (RAG, web pretraga, verifikator), a dok Miranda govori, na ekranu
 * stoji pun pravni osnov sa članom i linkom. Ono što se čuje sme da se zaboravi;
 * ono što se proverava mora da ostane napisano.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  izgovori,
  naGlasoveSpremne,
  proveriPodrsku,
  slusaj,
  ućutkaj,
  type PodrskaGlasa,
  type StanjeGlasa,
} from "@/lib/glas";

export interface UpravljanjeGlasom {
  stanje: StanjeGlasa;
  /** Tekst koji se upravo diktira — prikazuje se dok korisnik govori. */
  cujem: string;
  napomena: string | null;
  greska: string | null;
  neprekidno: boolean;
  postaviNeprekidno: (v: boolean) => void;
  pocniSlusanje: () => void;
  prekini: () => void;
  izgovoriOdgovor: (tekst: string) => void;
  dostupno: boolean;
}

export function useGlas(
  posaljiPitanje: (tekst: string) => void,
  zauzet: boolean,
): UpravljanjeGlasom {
  const [podrska, postaviPodrsku] = useState<PodrskaGlasa | null>(null);
  const [stanje, postaviStanje] = useState<StanjeGlasa>("nedostupno");
  const [cujem, postaviCujem] = useState("");
  const [greska, postaviGresku] = useState<string | null>(null);
  const [neprekidno, postaviNeprekidno] = useState(false);

  const zaustaviSlusanje = useRef<(() => void) | null>(null);
  const zaustaviGovor = useRef<(() => void) | null>(null);
  // Neprekidni režim čita se iz ref-a, jer se odluka o nastavku donosi u
  // callback-u koji je nastao pre poslednje promene stanja.
  const neprekidnoRef = useRef(neprekidno);
  neprekidnoRef.current = neprekidno;

  useEffect(() => {
    const osvezi = () => {
      const p = proveriPodrsku();
      postaviPodrsku(p);
      postaviStanje(p.prepoznavanje ? "spreman" : "nedostupno");
    };
    const otkaci = naGlasoveSpremne(osvezi);
    osvezi();
    return otkaci;
  }, []);

  const pocniSlusanje = useCallback(() => {
    // Novo pitanje uvek prekida odgovor koji je u toku. To je i smisao
    // prekidanja: čovek koji je već čuo dovoljno ne treba da čeka kraj.
    zaustaviGovor.current?.();
    ućutkaj();
    postaviGresku(null);
    postaviCujem("");
    postaviStanje("slusam");

    zaustaviSlusanje.current = slusaj({
      naDelimicno: postaviCujem,
      naKonacno: (tekst) => {
        postaviCujem("");
        postaviStanje("obradjujem");
        posaljiPitanje(tekst);
      },
      naGresku: (poruka) => {
        postaviGresku(poruka);
        postaviStanje("spreman");
      },
      naKraj: () => {
        postaviStanje((s) => (s === "slusam" ? "spreman" : s));
      },
    });
  }, [posaljiPitanje]);

  const prekini = useCallback(() => {
    zaustaviSlusanje.current?.();
    zaustaviGovor.current?.();
    ućutkaj();
    postaviCujem("");
    postaviNeprekidno(false);
    postaviStanje(podrska?.prepoznavanje ? "spreman" : "nedostupno");
  }, [podrska]);

  const izgovoriOdgovor = useCallback(
    (tekst: string) => {
      if (!podrska?.sinteza || !podrska.glas) {
        // Bez upotrebljivog glasa se ne govori engleskim izgovorom srpskog
        // teksta — u neprekidnom režimu se samo prelazi na sledeće pitanje.
        postaviStanje("spreman");
        if (neprekidnoRef.current) setTimeout(pocniSlusanje, 300);
        return;
      }

      postaviStanje("govorim");
      zaustaviGovor.current = izgovori(tekst, {
        glas: podrska.glas,
        naKraj: () => {
          postaviStanje("spreman");
          // Neprekidan razgovor: čim odgovor prestane, mikrofon se sam otvara,
          // pa korisnik može da nastavi bez klika — kao u pravom razgovoru.
          if (neprekidnoRef.current) setTimeout(pocniSlusanje, 400);
        },
      });
    },
    [podrska, pocniSlusanje],
  );

  // Kada tok padne ili se odgovor ne pojavi, stanje ne sme da ostane na
  // „obrađujem" — inače dugme izgleda zaglavljeno.
  useEffect(() => {
    if (!zauzet) postaviStanje((s) => (s === "obradjujem" ? "spreman" : s));
  }, [zauzet]);

  useEffect(() => () => ućutkaj(), []);

  return {
    stanje,
    cujem,
    napomena: podrska?.napomena ?? null,
    greska,
    neprekidno,
    postaviNeprekidno,
    pocniSlusanje,
    prekini,
    izgovoriOdgovor,
    dostupno: Boolean(podrska?.prepoznavanje),
  };
}

const NATPIS: Record<StanjeGlasa, string> = {
  nedostupno: "Glas nije dostupan",
  spreman: "Pitajte glasom",
  slusam: "Slušam… (kliknite da zaustavite)",
  obradjujem: "Obrađujem…",
  govorim: "Govorim… (kliknite da prekinete)",
};

export function DugmeGlasa({ glas }: { glas: UpravljanjeGlasom }) {
  if (!glas.dostupno) return null;

  const aktivno = glas.stanje === "slusam" || glas.stanje === "govorim";

  return (
    <button
      type="button"
      onClick={aktivno ? glas.prekini : glas.pocniSlusanje}
      disabled={glas.stanje === "obradjujem"}
      title={NATPIS[glas.stanje]}
      aria-label={NATPIS[glas.stanje]}
      className={`dugme-glas ${aktivno ? "dugme-glas-aktivno" : ""}`}
    >
      {glas.stanje === "govorim" ? "⏹" : "🎙️"}
    </button>
  );
}

export function TrakaGlasa({ glas }: { glas: UpravljanjeGlasom }) {
  if (!glas.dostupno) return null;

  return (
    <div className="razmak-y-s" style={{ marginTop: 8 }}>
      {glas.stanje === "slusam" && (
        <div className="traka-glasa">
          <span className="ucitavanje">● </span>
          {glas.cujem || "Slušam…"}
        </div>
      )}

      <label
        className="sitni slab"
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        <input
          type="checkbox"
          checked={glas.neprekidno}
          onChange={(e) => glas.postaviNeprekidno(e.target.checked)}
        />
        Neprekidan razgovor — mikrofon se sam otvara posle odgovora
      </label>

      {glas.napomena && <div className="sitni slab">⚠︎ {glas.napomena}</div>}
      {glas.greska && <div className="upozorenje mali">{glas.greska}</div>}
    </div>
  );
}
