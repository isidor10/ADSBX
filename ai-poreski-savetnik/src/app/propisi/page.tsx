"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Podnozje, StatusPropisa, Zaglavlje } from "@/components/Osnovno";

interface Rezultat {
  id: string;
  propis: string;
  skracenica: string;
  tip: string;
  kategorija: string;
  oznaka: string;
  potvrdjen: boolean;
  naslov: string | null;
  tekst: string;
  doslovanTekst: boolean;
  status: string;
  statusOznaka: string;
  vaziOd: string;
  vaziDo: string | null;
  izvorUrl: string;
  institucija: string;
  verifikacija: string;
}

interface Propis {
  id: string;
  naziv: string;
  skracenica: string;
  tip: string;
  kategorija: string;
  izvorInstitucija: string;
  izvorUrl: string;
  verifikacija: string;
  sluzbeniGlasnik: string[];
  brojOdredbi: number;
}

const PRIMERI = [
  "PDV automobil",
  "član 28 PDV",
  "rok poreske prijave",
  "lična zarada preduzetnika",
  "paušalno oporezivanje limit",
  "e-faktura evidentiranje PDV",
];

export default function StranaPropisa() {
  const [upit, postaviUpit] = useState("");
  const [rezultati, postaviRezultate] = useState<Rezultat[]>([]);
  const [propisi, postaviPropise] = useState<Propis[]>([]);
  const [rezim, postaviRezim] = useState("pregled");
  const [visestruko, postaviVisestruko] = useState<string[]>([]);
  const [ucitavanje, postaviUcitavanje] = useState(false);

  async function pretrazi(q: string) {
    postaviUcitavanje(true);
    try {
      const odg = await fetch(`/api/propisi/search?q=${encodeURIComponent(q)}`);
      const podaci = await odg.json();
      postaviRezim(podaci.rezim);
      postaviRezultate(podaci.rezultati ?? []);
      postaviVisestruko(
        podaci.visestrukoTumacenje ? podaci.propisiSaTimClanom : [],
      );
      if (podaci.propisi) postaviPropise(podaci.propisi);
    } finally {
      postaviUcitavanje(false);
    }
  }

  useEffect(() => {
    pretrazi("");
  }, []);

  return (
    <main className="glavna">
      <Zaglavlje
        naslov="Pretraži propise"
        opis="Pretraga radi i po smislu i po tačnom članu. Uz svaki rezultat stoji status važenja i link ka izvoru."
      />

      <div style={{ padding: "20px 24px", flex: 1 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            pretrazi(upit);
          }}
          style={{ display: "flex", gap: 8, maxWidth: 620 }}
        >
          <input
            className="polje"
            placeholder="npr. član 29 PDV, ili: odbitak poreza automobil"
            value={upit}
            onChange={(e) => postaviUpit(e.target.value)}
          />
          <button className="dugme" type="submit" disabled={ucitavanje}>
            {ucitavanje ? "…" : "Traži"}
          </button>
        </form>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {PRIMERI.map((p) => (
            <button
              key={p}
              onClick={() => {
                postaviUpit(p);
                pretrazi(p);
              }}
              className="znacka znacka-siva"
              style={{ border: "none", cursor: "pointer", minHeight: 30 }}
            >
              {p}
            </button>
          ))}
        </div>

        {visestruko.length > 1 && (
          <div className="upozorenje" style={{ marginTop: 16 }}>
            Taj broj člana postoji u više propisa:{" "}
            <strong>{visestruko.join(", ")}</strong>. Precizirajte na koji propis
            mislite — npr. „član 29 Zakona o PDV".
          </div>
        )}

        {rezim === "pregled" && propisi.length > 0 && (
          <section style={{ marginTop: 26 }}>
            <div className="oznaka">Propisi u bazi ({propisi.length})</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 10,
              }}
            >
              {propisi.map((p) => (
                <div key={p.id} className="kartica" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.naziv}</div>
                  <div className="sitni slab" style={{ marginTop: 4 }}>
                    {p.skracenica} · {p.kategorija} · {p.brojOdredbi} odredbi u bazi
                  </div>
                  {p.sluzbeniGlasnik.length > 0 && (
                    <div className="sitni prigusen" style={{ marginTop: 5 }}>
                      {p.sluzbeniGlasnik.join("; ")}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 9,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <a
                      href={p.izvorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sitni"
                      style={{ fontWeight: 600 }}
                    >
                      🔗 Izvor
                    </a>
                    {p.verifikacija !== "POTVRDJENO" && (
                      <span className="znacka znacka-zuta">
                        {p.verifikacija === "DELIMICNO"
                          ? "Delimično potvrđen"
                          : "Nije potvrđen"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {rezultati.length > 0 && (
          <section style={{ marginTop: 26 }}>
            <div className="oznaka">
              {rezim === "po_clanu"
                ? "Tačan pogodak po članu"
                : `Rezultati pretrage (${rezultati.length})`}
            </div>
            <div className="razmak-y">
              {rezultati.map((r) => (
                <article key={r.id} className="kartica" style={{ padding: 18 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.propis}</div>
                      <div
                        style={{
                          marginTop: 3,
                          fontWeight: r.potvrdjen ? 600 : 400,
                          color: r.potvrdjen ? "var(--tekst)" : "var(--zuta)",
                          fontSize: r.potvrdjen ? 15 : 13.5,
                        }}
                      >
                        {r.potvrdjen ? r.oznaka : `⚠︎ ${r.oznaka}`}
                      </div>
                      {r.naslov && (
                        <div className="mali prigusen" style={{ marginTop: 3 }}>
                          {r.naslov}
                        </div>
                      )}
                    </div>
                    <StatusPropisa status={r.status} />
                  </div>

                  <p
                    className="mali"
                    style={{
                      marginTop: 12,
                      color: "var(--tekst-prigusen)",
                      lineHeight: 1.6,
                    }}
                  >
                    {r.tekst}
                  </p>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <a
                      href={r.izvorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mali"
                      style={{ fontWeight: 600 }}
                    >
                      🔗 Otvori propis
                    </a>
                    <Link
                      href={`/?pitanje=${encodeURIComponent(
                        `Objasni mi ${r.potvrdjen ? r.oznaka : "ovu odredbu"} ${r.propis} i kako se primenjuje u praksi.`,
                      )}`}
                      className="mali"
                      style={{ fontWeight: 600 }}
                    >
                      💬 Pitaj AI o ovom članu
                    </Link>
                    <span className="sitni slab">
                      Važi od {new Date(r.vaziOd).toLocaleDateString("sr-RS")}
                      {r.vaziDo
                        ? ` do ${new Date(r.vaziDo).toLocaleDateString("sr-RS")}`
                        : ""}
                    </span>
                    {!r.doslovanTekst && (
                      <span className="znacka znacka-siva">Sažetak odredbe</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {!ucitavanje && rezim !== "pregled" && rezultati.length === 0 && (
          <div className="kartica" style={{ padding: 26, marginTop: 22 }}>
            <p className="prigusen" style={{ margin: 0 }}>
              Nema rezultata za taj upit u pravnoj bazi. Pravna baza sadrži
              proverene ključne odredbe; pun korpus se dobija pokretanjem
              ingesta. Možete i da postavite pitanje u razgovoru — tamo se uz
              bazu koristi i pretraga zvaničnih izvora.
            </p>
          </div>
        )}
      </div>

      <Podnozje />
    </main>
  );
}
