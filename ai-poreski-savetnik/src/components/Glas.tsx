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
import { IkonaMikrofon, IkonaStop } from "./Ikone";
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
  /** Objašnjenje zašto glas ne radi — prikazuje se tek kad se zatraži. */
  objasnjenjeVidljivo: boolean;
  objasniNedostupnost: () => void;
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
  const [objasnjenjeVidljivo, postaviObjasnjenje] = useState(false);

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
    objasnjenjeVidljivo,
    objasniNedostupnost: () => postaviObjasnjenje((v) => !v),
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
  /*
   * Kada pregledač ne podržava govor, dugme ostaje na svom mestu — ali nije
   * `disabled`.
   *
   * Isključeno dugme na telefonu ne prima ni dodir ni hover, pa objašnjenje u
   * `title` nikada niko ne pročita. Zbog toga je razlog ranije stajao ispisan
   * ispod polja, stalno, i na iPhone SE trošio tri reda za rečenicu koja se
   * pročita jednom u životu. Sada dugme prima dodir i tek tada kaže zašto ne
   * radi: objašnjenje postoji, ali ne zauzima ekran dok se ne zatraži.
   */
  if (!glas.dostupno) {
    return (
      <button
        type="button"
        aria-disabled
        onClick={glas.objasniNedostupnost}
        title="Prepoznavanje govora radi u Chrome-u i Edge-u. Otvorite aplikaciju tamo."
        aria-label="Zašto glas nije dostupan"
        className="dugme-glas dugme-glas-neaktivno"
      >
        <IkonaMikrofon velicina={20} />
      </button>
    );
  }

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
      {glas.stanje === "govorim" ? (
        <IkonaStop velicina={20} />
      ) : (
        <IkonaMikrofon velicina={20} />
      )}
    </button>
  );
}

export function TrakaGlasa({ glas }: { glas: UpravljanjeGlasom }) {
  /*
   * Ova traka se pojavljuje samo kada ima šta da kaže.
   *
   * Ranije su napomena o glasu i prekidač za neprekidan razgovor stajali ispod
   * polja stalno — tri reda teksta koja na iPhone SE pojedu petinu ekrana, a
   * čitaju se jednom u životu. Sada se prikazuje stanje dok razgovor traje,
   * greška kad je ima, i napomena samo dok korisnik nije počeo.
   */
  // Bez podrške nema šta da se prikaže dok korisnik sam ne pita — a pita tako
  // što dodirne mikrofon.
  if (!glas.dostupno) {
    if (!glas.objasnjenjeVidljivo) return null;
    return (
      <p className="glas-napomena" role="status">
        Prepoznavanje govora radi u Chrome-u i Edge-u. U Safariju i Firefox-u ga
        nema, pa pitanje ovde treba otkucati.
      </p>
    );
  }

  const uToku =
    glas.stanje === "slusam" ||
    glas.stanje === "obradjujem" ||
    glas.stanje === "govorim";

  if (!uToku && !glas.greska) return null;

  return (
    <div className="razmak-y-s" style={{ marginTop: 8 }}>
      {(glas.stanje === "slusam" ||
        glas.stanje === "obradjujem" ||
        glas.stanje === "govorim") && (
        <div className="traka-glasa">
          <span className="glas-stanje">
            <span className="glas-tacka" aria-hidden />
            {glas.stanje === "slusam"
              ? "Slušam"
              : glas.stanje === "obradjujem"
                ? "Razmišljam"
                : "Odgovaram"}
          </span>
          {glas.stanje === "slusam" && glas.cujem && (
            <span className="glas-prepis">{glas.cujem}</span>
          )}
        </div>
      )}

      {uToku && (
        <label className="glas-neprekidno">
          <input
            type="checkbox"
            checked={glas.neprekidno}
            onChange={(e) => glas.postaviNeprekidno(e.target.checked)}
          />
          Nastavi razgovor bez klika
        </label>
      )}

      {/*
        Napomena o glasu stoji uz razgovor koji je u toku, ne pre njega.
        Ranije je bilo obrnuto — tri reda o tome da na uređaju nema srpskog
        glasa dočekivala su svakoga ko otvori aplikaciju, uključujući sve one
        koji glas nikada neće ni dodirnuti. Sada se pojavi kada je važna: u
        trenutku kada je čovek pritisnuo mikrofon i čeka da čuje odgovor.
      */}
      {glas.napomena && uToku && (
        <p className="glas-napomena">{glas.napomena}</p>
      )}
      {glas.greska && <div className="upozorenje mali">{glas.greska}</div>}
    </div>
  );
}
