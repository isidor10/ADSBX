"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  { put: "/", naziv: "Razgovor", ikona: "💬", mobilni: "Chat" },
  { put: "/firma", naziv: "Moja firma", ikona: "🏢", mobilni: "Firma" },
  {
    put: "/kalkulator",
    naziv: "Kalkulatori",
    ikona: "📊",
    mobilni: "Kalkulator",
  },
  { put: "/propisi", naziv: "Propisi", ikona: "📚", mobilni: "Propisi" },
  { put: "/rokovi", naziv: "Rokovi", ikona: "📅", mobilni: "Rokovi" },
];

const DODATNE = [
  { put: "/dokument", naziv: "Analiziraj dokument", ikona: "📄" },
  { put: "/izmene", naziv: "Izmene propisa", ikona: "🔔" },
  { put: "/admin", naziv: "Administracija", ikona: "⚙️" },
];

export function Navigacija() {
  const putanja = usePathname();
  const [tema, postaviTemu] = useState<string | null>(null);

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
            <span role="img" aria-label="štikla" style={{ fontSize: 18 }}>
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
              <span aria-hidden>{s.ikona}</span>
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
              <span aria-hidden>{s.ikona}</span>
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
            <span aria-hidden>{tema === "tamna" ? "☀️" : "🌙"}</span>
            {tema === "tamna" ? "Svetla tema" : "Tamna tema"}
          </button>
        </div>

        <p className="sitni slab" style={{ marginTop: 24, lineHeight: 1.5 }}>
          {DISCLAIMER}
        </p>
      </nav>

      <nav className="donja-nav">
        {STRANE.map((s) => (
          <Link
            key={s.put}
            href={s.put}
            className={putanja === s.put ? "aktivna" : ""}
          >
            <span className="ikona" aria-hidden>
              {s.ikona}
            </span>
            {s.mobilni}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function Pouzdanost({ nivo }: { nivo: string }) {
  const mapa: Record<string, { tekst: string; klasa: string }> = {
    VISOKA: { tekst: "🟢 Visoka pouzdanost", klasa: "znacka-zelena" },
    POTREBNA_PROVERA: {
      tekst: "🟡 Potrebna dodatna provera",
      klasa: "znacka-zuta",
    },
    NEDOVOLJNO_PODATAKA: {
      tekst: "🔴 Nedovoljno podataka",
      klasa: "znacka-crvena",
    },
  };
  const p = mapa[nivo] ?? { tekst: nivo, klasa: "znacka-siva" };
  return <span className={`znacka ${p.klasa}`}>{p.tekst}</span>;
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
          📚 PRAVNI OSNOV{redni !== undefined ? ` ${redni}` : ""}
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
        {citat.potvrdjen ? citat.oznaka : `⚠︎ ${citat.oznaka}`}
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

      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <a
          href={citat.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mali"
          style={{ fontWeight: 600 }}
        >
          🔗 Otvori propis
        </a>
        <button
          onClick={() => postaviOtvoren(!otvoren)}
          className="mali"
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "var(--tekst-prigusen)",
            textDecoration: "underline",
          }}
        >
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
        <div key={i} className="upozorenje">
          ⚠︎ {p}
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
