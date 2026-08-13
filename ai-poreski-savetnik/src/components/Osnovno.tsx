"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IkonaAdmin,
  IkonaDokument,
  IkonaFirma,
  IkonaIstorija,
  IkonaIzmene,
  IkonaKalkulator,
  IkonaMesec,
  IkonaOko,
  IkonaPropisi,
  IkonaRazgovor,
  IkonaRokovi,
  IkonaSunce,
  IkonaUpozorenje,
  IkonaVeza,
  IkonaVise,
  IkonaZatvori,
} from "./Ikone";

export const DISCLAIMER =
  "Informacije koje pruža AI predstavljaju informativnu i stručnu podršku i ne predstavljaju zamenu za individualni savet ovlašćenog poreskog savetnika, računovođe, advokata ili nadležnog državnog organa.";

/** Teme visokog rizika — traže dodatno upozorenje uz odgovor (zahtev 26). */
const VISOKORIZICNE = [
  "transferne cene",
  "poreska optimizacija",
  "optimizacij",
  "utaj",
  "nekretnin",
  "prenos apsolutnih prava",
  "restrukturiranj",
  "statusna promena",
  "poresk[ai] kontrol",
  "reorganizacij",
];

export function jeVisokorizicno(tekst: string): boolean {
  const t = tekst.toLowerCase();
  return VISOKORIZICNE.some((r) => new RegExp(r).test(t));
}

const STRANE = [
  { put: "/", naziv: "Razgovor", Ikona: IkonaRazgovor, mobilni: "Chat" },
  { put: "/firma", naziv: "Moja firma", Ikona: IkonaFirma, mobilni: "Firma" },
  {
    put: "/kalkulator",
    naziv: "Kalkulatori",
    Ikona: IkonaKalkulator,
    mobilni: "Kalkulator",
  },
  { put: "/propisi", naziv: "Propisi", Ikona: IkonaPropisi, mobilni: "Propisi" },
  { put: "/rokovi", naziv: "Rokovi", Ikona: IkonaRokovi, mobilni: "Rokovi" },
];

const DODATNE = [
  { put: "/istorija", naziv: "Istorija", Ikona: IkonaIstorija },
  { put: "/dokument", naziv: "Analiziraj dokument", Ikona: IkonaDokument },
  { put: "/izmene", naziv: "Izmene propisa", Ikona: IkonaIzmene },
  { put: "/admin", naziv: "Administracija", Ikona: IkonaAdmin },
];

/*
 * Donja navigacija nosi četiri stavke i „Više".
 *
 * Pet ikonica u redu na iPhone SE daje po ~64px svaka — dovoljno za prst, ali
 * tek. Zato ovde stoje samo one koje se koriste svakodnevno, a ostalo ide u
 * fioku: bolje jedan dodatni dodir do „Rokova" nego četiri stešnjene mete.
 * Razgovor je prvi jer je centar aplikacije.
 */
const DONJE = STRANE.slice(0, 4);
const U_FIOCI = [STRANE[4], ...DODATNE];

export function Navigacija() {
  const putanja = usePathname();
  const [tema, postaviTemu] = useState<string | null>(null);
  const [fiokaOtvorena, postaviFioku] = useState(false);

  // Fioka se zatvara pri promeni strane — inače ostane otvorena preko sadržaja
  // na koji je korisnik upravo otišao.
  useEffect(() => postaviFioku(false), [putanja]);

  useEffect(() => {
    const sacuvana = localStorage.getItem("tema");
    if (sacuvana) {
      document.documentElement.setAttribute("data-tema", sacuvana);
      postaviTemu(sacuvana);
    }
  }, []);

  function promeniTemu() {
    const nova = tema === "tamna" ? "svetla" : "tamna";
    document.documentElement.setAttribute("data-tema", nova);
    localStorage.setItem("tema", nova);
    postaviTemu(nova);
  }

  return (
    <>
      <nav className="bocna">
        <Link href="/" style={{ display: "block", marginBottom: 22 }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 22,
              fontWeight: 650,
              color: "var(--tekst)",
              lineHeight: 1.25,
            }}
          >
            Miranda{" "}
            <span role="img" aria-label="štikla" className="stikla">
              👠
            </span>
          </div>
          <div className="sitni slab" style={{ marginTop: 4 }}>
            Poreski savetnik · Republika Srbija
          </div>
        </Link>

        <div className="razmak-y-s">
          {STRANE.map((s) => (
            <Link
              key={s.put}
              href={s.put}
              className={`nav-stavka ${putanja === s.put ? "nav-stavka-aktivna" : ""}`}
            >
              <s.Ikona velicina={18} />
              {s.naziv}
            </Link>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            paddingTop: 14,
            borderTop: "1px solid var(--ivica)",
          }}
          className="razmak-y-s"
        >
          {DODATNE.map((s) => (
            <Link
              key={s.put}
              href={s.put}
              className={`nav-stavka ${putanja === s.put ? "nav-stavka-aktivna" : ""}`}
            >
              <s.Ikona velicina={18} />
              {s.naziv}
            </Link>
          ))}
          <button
            onClick={promeniTemu}
            className="nav-stavka"
            style={{
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {tema === "tamna" ? (
              <IkonaSunce velicina={18} />
            ) : (
              <IkonaMesec velicina={18} />
            )}
            {tema === "tamna" ? "Svetla tema" : "Tamna tema"}
          </button>
        </div>

        <p className="sitni slab" style={{ marginTop: 24, lineHeight: 1.5 }}>
          {DISCLAIMER}
        </p>
      </nav>

      {fiokaOtvorena && (
        <div
          className="fioka-zastor"
          onClick={() => postaviFioku(false)}
          aria-hidden
        />
      )}

      <div
        className={`fioka ${fiokaOtvorena ? "fioka-otvorena" : ""}`}
        role="dialog"
        aria-label="Više"
        aria-hidden={!fiokaOtvorena}
      >
        <div className="fioka-rucka" aria-hidden />
        {U_FIOCI.map((s) => (
          <Link
            key={s.put}
            href={s.put}
            className={`fioka-stavka ${putanja === s.put ? "fioka-stavka-aktivna" : ""}`}
            tabIndex={fiokaOtvorena ? 0 : -1}
          >
            <s.Ikona velicina={19} />
            {s.naziv}
          </Link>
        ))}
        <button
          type="button"
          className="fioka-stavka"
          onClick={promeniTemu}
          tabIndex={fiokaOtvorena ? 0 : -1}
        >
          {tema === "tamna" ? (
            <IkonaSunce velicina={19} />
          ) : (
            <IkonaMesec velicina={19} />
          )}
          {tema === "tamna" ? "Svetla tema" : "Tamna tema"}
        </button>
      </div>

      <nav className="donja-nav">
        {DONJE.map((s) => (
          <Link
            key={s.put}
            href={s.put}
            className={putanja === s.put ? "aktivna" : ""}
          >
            <span className="ikona">
              <s.Ikona velicina={21} />
            </span>
            {s.mobilni}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => postaviFioku((v) => !v)}
          className={fiokaOtvorena || U_FIOCI.some((s) => s.put === putanja) ? "aktivna" : ""}
          aria-expanded={fiokaOtvorena}
        >
          <span className="ikona">
            {fiokaOtvorena ? (
              <IkonaZatvori velicina={21} />
            ) : (
              <IkonaVise velicina={21} />
            )}
          </span>
          Više
        </button>
      </nav>
    </>
  );
}

export function Pouzdanost({ nivo }: { nivo: string }) {
  const mapa: Record<string, { tekst: string; klasa: string }> = {
    VISOKA: { tekst: "Visoka pouzdanost", klasa: "znacka-zelena" },
    POTREBNA_PROVERA: {
      tekst: "Potrebna dodatna provera",
      klasa: "znacka-zuta",
    },
    NEDOVOLJNO_PODATAKA: {
      tekst: "Nedovoljno podataka",
      klasa: "znacka-crvena",
    },
  };
  const p = mapa[nivo] ?? { tekst: nivo, klasa: "znacka-siva" };
  // Tačka umesto semafora u emoji. Boju uzima od značke, pa nivo pouzdanosti i
  // dalje ima svoju boju — samo prigušenu do nivoa ostatka interfejsa.
  return (
    <span className={`znacka ${p.klasa}`}>
      <span className="tacka" aria-hidden />
      {p.tekst}
    </span>
  );
}

export function StatusPropisa({ status }: { status: string }) {
  const mapa: Record<string, { tekst: string; klasa: string }> = {
    VAZI: { tekst: "Važeći propis", klasa: "znacka-zelena" },
    PRESTAO_DA_VAZI: { tekst: "Prestao da važi", klasa: "znacka-crvena" },
    JOS_NIJE_STUPIO_NA_SNAGU: {
      tekst: "Još nije na snazi",
      klasa: "znacka-zuta",
    },
    NIJE_PROPIS: { tekst: "Nacrt — nije propis", klasa: "znacka-crvena" },
  };
  const s = mapa[status] ?? { tekst: status, klasa: "znacka-siva" };
  return <span className={`znacka ${s.klasa}`}>{s.tekst}</span>;
}

export interface Citat {
  id: string;
  propis: string;
  propisPun: string;
  oznaka: string;
  potvrdjen: boolean;
  tekst: string;
  doslovanTekst: boolean;
  status: string;
  statusOznaka: string;
  institucija: string;
  url: string;
  prioritet: number;
  verifikacija: string;
  vaziOd: string;
  vaziDo: string | null;
  relevantnost?: string;
  tipTvrdnje?: string;
}

/** Isti nazivi vrsta tvrdnje koriste se i na ekranu i u nalazu za štampu. */
export function opisTipaTvrdnje(tip?: string): string {
  if (!tip) return "Nesvrstano";
  return OPIS_TIPA[tip] ?? tip;
}

const OPIS_TIPA: Record<string, string> = {
  ZAKON: "Zakon",
  PODZAKONSKI_AKT: "Podzakonski akt",
  SLUZBENO_TUMACENJE: "Službeno tumačenje",
  STRUCNO_MISLJENJE: "Stručno mišljenje",
  AI_ZAKLJUCAK: "AI zaključak",
};

/** Vizuelni element pravnog osnova (zahtev 9). */
export function KarticaPravnogOsnova({
  citat,
  redni,
}: {
  citat: Citat;
  redni?: number;
}) {
  const [otvoren, postaviOtvoren] = useState(false);

  return (
    <div
      className={`pravni-osnov ${!citat.potvrdjen ? "pravni-osnov-nepotvrdjen" : ""}`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          className="sitni"
          style={{ fontWeight: 700, letterSpacing: "0.04em" }}
        >
          PRAVNI OSNOV{redni !== undefined ? ` ${redni}` : ""}
        </span>
        {citat.tipTvrdnje && (
          <span className="znacka znacka-siva">
            {OPIS_TIPA[citat.tipTvrdnje] ?? citat.tipTvrdnje}
          </span>
        )}
      </div>

      <div style={{ marginTop: 8, fontWeight: 600 }}>{citat.propisPun}</div>

      <div
        style={{
          marginTop: 3,
          fontWeight: citat.potvrdjen ? 600 : 400,
          color: citat.potvrdjen ? "var(--tekst)" : "var(--zuta)",
          fontSize: citat.potvrdjen ? 15 : 13.5,
        }}
      >
        {citat.potvrdjen ? (
          citat.oznaka
        ) : (
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <IkonaUpozorenje velicina={14} />
            {citat.oznaka}
          </span>
        )}
      </div>

      {citat.relevantnost && (
        <p className="mali prigusen" style={{ margin: "8px 0 0" }}>
          {citat.relevantnost}
        </p>
      )}

      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <StatusPropisa status={citat.status} />
        {citat.verifikacija !== "POTVRDJENO" && (
          <span className="znacka znacka-zuta">Zapis nije potvrđen</span>
        )}
        {!citat.doslovanTekst && (
          <span className="znacka znacka-siva">Sažetak, ne doslovan tekst</span>
        )}
      </div>

      <div className="osnov-radnje">
        <a
          href={citat.url}
          target="_blank"
          rel="noopener noreferrer"
          className="osnov-radnja"
        >
          <IkonaVeza velicina={15} />
          Otvori propis
        </a>
        <button
          type="button"
          onClick={() => postaviOtvoren(!otvoren)}
          className="osnov-radnja osnov-radnja-tiha"
          aria-expanded={otvoren}
        >
          <IkonaOko velicina={15} />
          {otvoren ? "Sakrij tekst odredbe" : "Prikaži tekst odredbe"}
        </button>
        <span className="sitni slab">{citat.institucija}</span>
      </div>

      {otvoren && (
        <div
          className="mali"
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--ivica)",
            color: "var(--tekst-prigusen)",
            whiteSpace: "pre-wrap",
          }}
        >
          {citat.tekst}
        </div>
      )}
    </div>
  );
}

export function Upozorenja({ poruke }: { poruke: string[] }) {
  if (poruke.length === 0) return null;
  return (
    <div className="razmak-y-s">
      {poruke.map((p, i) => (
        <div
          key={i}
          className="upozorenje"
          style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
        >
          <IkonaUpozorenje velicina={16} className="ikona-nesabijena" />
          <span>{p}</span>
        </div>
      ))}
    </div>
  );
}

export function Zaglavlje({
  naslov,
  opis,
  akcija,
}: {
  naslov: string;
  opis?: string;
  akcija?: React.ReactNode;
}) {
  return (
    <header
      style={{
        padding: "22px 24px 18px",
        borderBottom: "1px solid var(--ivica)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h1 style={{ fontSize: 22 }}>{naslov}</h1>
        {opis && (
          <p
            className="mali prigusen"
            style={{ margin: "5px 0 0", maxWidth: "62ch" }}
          >
            {opis}
          </p>
        )}
      </div>
      {akcija}
    </header>
  );
}

export function Podnozje() {
  return (
    <footer
      style={{
        padding: "18px 24px",
        borderTop: "1px solid var(--ivica)",
        marginTop: "auto",
      }}
    >
      <p className="sitni slab" style={{ margin: 0, maxWidth: "80ch" }}>
        {DISCLAIMER}
      </p>
    </footer>
  );
}
