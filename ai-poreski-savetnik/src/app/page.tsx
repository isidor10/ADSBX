"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  Citat,
  DISCLAIMER,
  jeVisokorizicno,
  KarticaPravnogOsnova,
  Pouzdanost,
  Upozorenja,
} from "@/components/Osnovno";

interface WebIzvor {
  naslov: string;
  url: string;
  institucija: string;
  prioritet: number;
}

interface Odgovor {
  kratakOdgovor: string;
  objasnjenje: string;
  poreskiTretman?: Record<string, string | undefined>;
  vazno: string[];
  nivoPouzdanosti: string;
  obrazlozenjePouzdanosti: string;
  potrebnaPitanja?: string[];
  aiZakljucak?: string;
}

interface Poruka {
  uloga: "korisnik" | "asistent";
  tekst?: string;
  odgovor?: Odgovor;
  citati?: Citat[];
  webIzvori?: WebIzvor[];
  upozorenja?: string[];
  ciljniDatum?: string;
  koriscenaWebPretraga?: boolean;
  greska?: string;
}

const BRZE_OPCIJE = [
  { ikona: "💰", tekst: "Porezi", upit: "Koje poreze plaća DOO u Srbiji i po kojim stopama?" },
  { ikona: "📚", tekst: "Zakoni", upit: "Šta kaže član 29 Zakona o PDV?" },
  { ikona: "🧾", tekst: "Fakture", upit: "Koji su rokovi za evidentiranje PDV u sistemu elektronskih faktura?" },
  { ikona: "👨‍💼", tekst: "Zarade", upit: "Kako se obračunava zarada — koji su porez i doprinosi na bruto zaradu?" },
  { ikona: "📊", tekst: "Kalkulator", upit: "Koliko je neto zarada ako je bruto 120.000 dinara?" },
  { ikona: "📅", tekst: "Rokovi", upit: "Koji su moji poreski rokovi ovog meseca?" },
  { ikona: "🔍", tekst: "Proveri propis", upit: "Da li je limit za paušalno oporezivanje i dalje 6.000.000 dinara?" },
];

const PRIMER =
  "Imam DOO, nisam u PDV-u, kupujem automobil od 30.000 EUR. Direktor će ga koristiti privatno i poslovno. Kakav je poreski i računovodstveni tretman?";

export default function StranaRazgovora() {
  return (
    <Suspense fallback={<main className="glavna glavna-razgovor" />}>
      <Razgovor />
    </Suspense>
  );
}

function Razgovor() {
  const parametri = useSearchParams();
  const [poruke, postaviPoruke] = useState<Poruka[]>([]);
  const [unos, postaviUnos] = useState("");
  const [ucitavanje, postaviUcitavanje] = useState(false);
  const [razgovorId, postaviRazgovorId] = useState<string | undefined>();
  const [rezim, postaviRezim] = useState<"standard" | "drugo_misljenje">("standard");
  const [panelOtvoren, postaviPanel] = useState(false);
  const dno = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dno.current?.scrollIntoView({ behavior: "smooth" });
  }, [poruke, ucitavanje]);

  // Dolazak sa strane „Propisi" preko dugmeta „Pitaj AI o ovom članu" —
  // pitanje se prenosi kroz URL i unosi u polje, ali se NE šalje samo od sebe:
  // korisnik treba da vidi i po potrebi dopuni pitanje pre slanja.
  useEffect(() => {
    const iz = parametri.get("pitanje");
    if (iz) postaviUnos(iz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poslednji = [...poruke].reverse().find((p) => p.uloga === "asistent");
  const citati = poslednji?.citati ?? [];
  const webIzvori = poslednji?.webIzvori ?? [];

  async function posalji(tekst: string) {
    const pitanje = tekst.trim();
    if (!pitanje || ucitavanje) return;

    postaviPoruke((p) => [...p, { uloga: "korisnik", tekst: pitanje }]);
    postaviUnos("");
    postaviUcitavanje(true);

    try {
      const odgovor = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitanje, razgovorId, rezim }),
      });
      const podaci = await odgovor.json();

      if (!odgovor.ok) {
        postaviPoruke((p) => [
          ...p,
          { uloga: "asistent", greska: podaci.greska ?? "Došlo je do greške." },
        ]);
        return;
      }

      postaviRazgovorId(podaci.razgovorId);
      postaviPoruke((p) => [
        ...p,
        {
          uloga: "asistent",
          odgovor: podaci.odgovor,
          citati: podaci.citati,
          webIzvori: podaci.webIzvori,
          upozorenja: podaci.upozorenja,
          ciljniDatum: podaci.ciljniDatum,
          koriscenaWebPretraga: podaci.koriscenaWebPretraga,
        },
      ]);
      if (podaci.citati?.length > 0) postaviPanel(true);
    } catch {
      postaviPoruke((p) => [
        ...p,
        {
          uloga: "asistent",
          greska:
            "Nije moguće doći do servera. Proverite vezu i pokušajte ponovo.",
        },
      ]);
    } finally {
      postaviUcitavanje(false);
    }
  }

  return (
    <>
      <main className="glavna glavna-razgovor">
        <div style={{ flex: 1, overflowY: "auto", padding: "0 0 20px" }}>
          {poruke.length === 0 ? (
            <PocetniEkran naPitanje={posalji} />
          ) : (
            <div
              style={{
                maxWidth: 780,
                margin: "0 auto",
                padding: "24px 20px 0",
              }}
              className="razmak-y"
            >
              {poruke.map((p, i) =>
                p.uloga === "korisnik" ? (
                  <PitanjeKorisnika key={i} tekst={p.tekst ?? ""} />
                ) : (
                  <OdgovorAsistenta key={i} poruka={p} />
                ),
              )}
              {ucitavanje && <Ucitavanje />}
              <div ref={dno} />
            </div>
          )}
        </div>

        <UnosPitanja
          vrednost={unos}
          naPromenu={postaviUnos}
          naSlanje={() => posalji(unos)}
          ucitavanje={ucitavanje}
          rezim={rezim}
          naRezim={postaviRezim}
          brojIzvora={citati.length + webIzvori.length}
          naPanel={() => postaviPanel(true)}
        />
      </main>

      <PanelIzvora
        citati={citati}
        webIzvori={webIzvori}
        otvoren={panelOtvoren}
        naZatvaranje={() => postaviPanel(false)}
      />
    </>
  );
}

function PocetniEkran({ naPitanje }: { naPitanje: (t: string) => void }) {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "64px 20px 0",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 30 }}>
        Miranda{" "}
        <span role="img" aria-label="štikla">
          👠
        </span>
      </h1>
      <p className="prigusen" style={{ marginTop: 10, fontSize: 16 }}>
        Kako mogu da vam pomognem?
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginTop: 30,
        }}
      >
        {BRZE_OPCIJE.map((o) => (
          <button
            key={o.tekst}
            onClick={() => naPitanje(o.upit)}
            className="kartica"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 14px",
              minHeight: 44,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <span aria-hidden>{o.ikona}</span>
            {o.tekst}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/firma"
          className="kartica"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "10px 14px",
            minHeight: 44,
            fontSize: 14,
            fontWeight: 500,
            color: "var(--tekst)",
          }}
        >
          <span aria-hidden>🏢</span> Moja firma
        </Link>
        <Link
          href="/dokument"
          className="kartica"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "10px 14px",
            minHeight: 44,
            fontSize: 14,
            fontWeight: 500,
            color: "var(--tekst)",
          }}
        >
          <span aria-hidden>📄</span> Analiziraj dokument
        </Link>
      </div>

      <button
        onClick={() => naPitanje(PRIMER)}
        className="kartica"
        style={{
          marginTop: 26,
          padding: "16px 18px",
          textAlign: "left",
          cursor: "pointer",
          width: "100%",
          background: "var(--povrsina-2)",
        }}
      >
        <div className="sitni slab" style={{ marginBottom: 6, fontWeight: 600 }}>
          PRIMER SLOŽENOG PITANJA
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{PRIMER}</div>
      </button>

      <p className="sitni slab" style={{ marginTop: 30, lineHeight: 1.55 }}>
        {DISCLAIMER}
      </p>
    </div>
  );
}

function PitanjeKorisnika({ tekst }: { tekst: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          maxWidth: "84%",
          padding: "12px 16px",
          borderRadius: "14px 14px 4px 14px",
          background: "var(--akcenat-pozadina)",
          color: "var(--tekst)",
          fontSize: 15,
        }}
      >
        {tekst}
      </div>
    </div>
  );
}

function Ucitavanje() {
  return (
    <div className="kartica" style={{ padding: "16px 18px" }}>
      <div className="ucitavanje prigusen mali">
        Pretražujem pravnu bazu i proveravam važeće propise…
      </div>
    </div>
  );
}

function Odeljak({
  naslov,
  children,
}: {
  naslov: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 18 }}>
      <div className="oznaka">{naslov}</div>
      {children}
    </section>
  );
}

function OdgovorAsistenta({ poruka }: { poruka: Poruka }) {
  if (poruka.greska) {
    return <div className="opasnost">{poruka.greska}</div>;
  }
  const o = poruka.odgovor;
  if (!o) return null;

  const rizicno =
    jeVisokorizicno(o.kratakOdgovor) || jeVisokorizicno(o.objasnjenje);

  return (
    <article className="kartica" style={{ padding: "20px 22px" }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <Pouzdanost nivo={o.nivoPouzdanosti} />
        {poruka.koriscenaWebPretraga && (
          <span className="znacka znacka-siva">🌐 Provereno na webu</span>
        )}
        {poruka.ciljniDatum && (
          <span className="sitni slab">
            Pravno stanje na dan{" "}
            {new Date(poruka.ciljniDatum).toLocaleDateString("sr-RS")}
          </span>
        )}
      </div>

      <p style={{ fontSize: 16.5, fontWeight: 550, margin: 0, lineHeight: 1.55 }}>
        {o.kratakOdgovor}
      </p>

      <Odeljak naslov="Objašnjenje">
        <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
          {o.objasnjenje}
        </p>
      </Odeljak>

      {o.poreskiTretman &&
        Object.values(o.poreskiTretman).some(Boolean) && (
          <Odeljak naslov="Poreski i računovodstveni tretman">
            <div className="kartica" style={{ padding: 0, overflow: "hidden" }}>
              <table className="tabela-obracuna">
                <tbody>
                  {(
                    [
                      ["poreziKojiSePlacaju", "Porezi"],
                      ["osnovica", "Osnovica"],
                      ["stopa", "Stopa"],
                      ["rok", "Rok"],
                      ["prijava", "Prijava"],
                      ["knjizenje", "Knjiženje"],
                    ] as const
                  ).map(([kljuc, naziv]) =>
                    o.poreskiTretman?.[kljuc] ? (
                      <tr key={kljuc}>
                        <td
                          style={{
                            width: 130,
                            fontWeight: 600,
                            color: "var(--tekst-prigusen)",
                          }}
                        >
                          {naziv}
                        </td>
                        <td>{o.poreskiTretman[kljuc]}</td>
                      </tr>
                    ) : null,
                  )}
                </tbody>
              </table>
            </div>
          </Odeljak>
        )}

      {poruka.citati && poruka.citati.length > 0 && (
        <Odeljak naslov="Pravni osnov">
          <div className="razmak-y-s">
            {poruka.citati.map((c, i) => (
              <KarticaPravnogOsnova key={c.id + i} citat={c} redni={i + 1} />
            ))}
          </div>
        </Odeljak>
      )}

      {o.aiZakljucak && (
        <Odeljak naslov="AI zaključak — nije sadržina propisa">
          <div
            className="kartica"
            style={{
              padding: "12px 14px",
              background: "var(--povrsina-2)",
              fontSize: 14,
            }}
          >
            {o.aiZakljucak}
          </div>
        </Odeljak>
      )}

      {o.vazno.length > 0 && (
        <Odeljak naslov="Važno">
          <ul style={{ margin: 0, paddingLeft: 20 }} className="razmak-y-s">
            {o.vazno.map((v, i) => (
              <li key={i} style={{ fontSize: 14.5 }}>
                {v}
              </li>
            ))}
          </ul>
        </Odeljak>
      )}

      {o.potrebnaPitanja && o.potrebnaPitanja.length > 0 && (
        <Odeljak naslov="Da bih dao precizniji odgovor, potrebno je da znam">
          <ol style={{ margin: 0, paddingLeft: 20 }} className="razmak-y-s">
            {o.potrebnaPitanja.map((p, i) => (
              <li key={i} style={{ fontSize: 14.5 }}>
                {p}
              </li>
            ))}
          </ol>
        </Odeljak>
      )}

      <div style={{ marginTop: 16 }} className="razmak-y-s">
        <Upozorenja poruke={poruka.upozorenja ?? []} />
        {rizicno && (
          <div className="opasnost">
            ⚠︎ Ovo je oblast povišenog poreskog rizika. Pre postupanja obavezno
            proverite konkretan slučaj sa ovlašćenim poreskim savetnikom —
            posledice pogrešnog tretmana mogu biti značajne.
          </div>
        )}
      </div>

      <p className="sitni slab" style={{ marginTop: 14, marginBottom: 0 }}>
        Pouzdanost: {o.obrazlozenjePouzdanosti}
      </p>
    </article>
  );
}

function UnosPitanja({
  vrednost,
  naPromenu,
  naSlanje,
  ucitavanje,
  rezim,
  naRezim,
  brojIzvora,
  naPanel,
}: {
  vrednost: string;
  naPromenu: (v: string) => void;
  naSlanje: () => void;
  ucitavanje: boolean;
  rezim: "standard" | "drugo_misljenje";
  naRezim: (r: "standard" | "drugo_misljenje") => void;
  brojIzvora: number;
  naPanel: () => void;
}) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--ivica)",
        background: "var(--povrsina)",
        padding: "12px 20px 16px",
      }}
    >
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() =>
              naRezim(rezim === "standard" ? "drugo_misljenje" : "standard")
            }
            className={`znacka ${
              rezim === "drugo_misljenje" ? "znacka-zuta" : "znacka-siva"
            }`}
            style={{ border: "none", cursor: "pointer", minHeight: 30 }}
          >
            {rezim === "drugo_misljenje"
              ? "✓ Režim: proveri moj odgovor"
              : "Proveri moj odgovor"}
          </button>

          {brojIzvora > 0 && (
            <button
              onClick={naPanel}
              className="znacka znacka-siva"
              style={{ border: "none", cursor: "pointer", minHeight: 30 }}
            >
              📚 Izvori ({brojIzvora})
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={vrednost}
            onChange={(e) => naPromenu(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                naSlanje();
              }
            }}
            placeholder={
              rezim === "drugo_misljenje"
                ? "Unesite savet koji ste dobili, pa ću proveriti pravni osnov…"
                : "Postavite pitanje…"
            }
            rows={2}
            className="polje"
            style={{ resize: "none", flex: 1, minHeight: 52 }}
          />
          <button
            onClick={naSlanje}
            disabled={ucitavanje || vrednost.trim().length < 3}
            className="dugme"
            style={{ minHeight: 52, paddingInline: 20 }}
          >
            {ucitavanje ? "…" : "Pošalji"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelIzvora({
  citati,
  webIzvori,
  otvoren,
  naZatvaranje,
}: {
  citati: Citat[];
  webIzvori: WebIzvor[];
  otvoren: boolean;
  naZatvaranje: () => void;
}) {
  return (
    <aside className={`panel-izvora ${otvoren ? "panel-izvora-otvoren" : ""}`}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontSize: 15, letterSpacing: "0.04em" }}>IZVORI</h2>
        <button
          onClick={naZatvaranje}
          className="mali prigusen"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            minHeight: 32,
          }}
          aria-label="Zatvori panel izvora"
        >
          ✕
        </button>
      </div>

      {citati.length === 0 && webIzvori.length === 0 ? (
        <p className="mali slab">
          Izvori korišćeni u odgovoru pojaviće se ovde, sa članom propisa,
          statusom važenja i linkom ka originalu.
        </p>
      ) : (
        <div className="razmak-y">
          {citati.map((c, i) => (
            <div key={c.id + i}>
              <div className="sitni slab" style={{ marginBottom: 5 }}>
                {i + 1}. IZ PRAVNE BAZE
              </div>
              <KarticaPravnogOsnova citat={c} />
            </div>
          ))}

          {webIzvori.length > 0 && (
            <div style={{ paddingTop: 6 }}>
              <div className="oznaka">Provereno na webu</div>
              <div className="razmak-y-s">
                {webIzvori.map((w, i) => (
                  <a
                    key={i}
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="kartica"
                    style={{ display: "block", padding: "10px 12px" }}
                  >
                    <div className="mali" style={{ fontWeight: 600 }}>
                      {w.naslov}
                    </div>
                    <div className="sitni slab" style={{ marginTop: 3 }}>
                      {w.institucija} · prioritet izvora {w.prioritet}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
