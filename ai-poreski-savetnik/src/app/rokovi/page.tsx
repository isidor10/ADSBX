"use client";

import { useEffect, useState } from "react";
import { Podnozje, Zaglavlje } from "@/components/Osnovno";
import { IkonaUpozorenje, IkonaVeza } from "@/components/Ikone";

interface Rok {
  id: string;
  naziv: string;
  opis: string;
  datum: string;
  dan: number;
  ponavljanje: string;
  obrazac: string | null;
  propis: string | null;
  izvorUrl: string;
  verifikacija: string;
  vrsteObveznika: string[];
}

interface Firma {
  id: string;
  naziv: string;
  pravnaForma: string;
}

const MESECI = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

export default function StranaRokova() {
  const sada = new Date();
  const [mesec, postaviMesec] = useState(sada.getMonth() + 1);
  const [godina, postaviGodinu] = useState(sada.getFullYear());
  const [firmaId, postaviFirmuId] = useState("");
  const [firme, postaviFirme] = useState<Firma[]>([]);
  const [rokovi, postaviRokove] = useState<Rok[]>([]);
  const [upozorenje, postaviUpozorenje] = useState<string | null>(null);
  const [ucitavanje, postaviUcitavanje] = useState(true);

  useEffect(() => {
    fetch("/api/firma")
      .then((o) => o.json())
      .then((p) => postaviFirme(p.firme ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    postaviUcitavanje(true);
    const parametri = new URLSearchParams({
      mesec: String(mesec),
      godina: String(godina),
    });
    if (firmaId) parametri.set("firmaId", firmaId);

    fetch(`/api/rokovi?${parametri}`)
      .then((o) => o.json())
      .then((p) => {
        postaviRokove(p.rokovi ?? []);
        postaviUpozorenje(p.upozorenje ?? null);
      })
      .finally(() => postaviUcitavanje(false));
  }, [mesec, godina, firmaId]);

  const danas = new Date();
  const jeTekuciMesec =
    mesec === danas.getMonth() + 1 && godina === danas.getFullYear();

  return (
    <main className="glavna">
      <Zaglavlje
        naslov="Poreski kalendar"
        opis="Rokovi za izabrani mesec. Ako izaberete firmu, prikazuju se samo rokovi koji se odnose na njenu pravnu formu i PDV status."
      />

      <div style={{ padding: "20px 24px", flex: 1 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "flex-end",
            marginBottom: 20,
          }}
        >
          <div style={{ minWidth: 150 }}>
            <label className="oznaka" htmlFor="mesec">Mesec</label>
            <select
              id="mesec"
              className="polje"
              value={mesec}
              onChange={(e) => postaviMesec(Number(e.target.value))}
            >
              {MESECI.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 110 }}>
            <label className="oznaka" htmlFor="godina">Godina</label>
            <input
              id="godina"
              type="number"
              className="polje"
              value={godina}
              onChange={(e) => postaviGodinu(Number(e.target.value))}
            />
          </div>
          {firme.length > 0 && (
            <div style={{ minWidth: 200 }}>
              <label className="oznaka" htmlFor="firma">Filtriraj po firmi</label>
              <select
                id="firma"
                className="polje"
                value={firmaId}
                onChange={(e) => postaviFirmuId(e.target.value)}
              >
                <option value="">Svi obveznici</option>
                {firme.map((f) => (
                  <option key={f.id} value={f.id}>{f.naziv}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {upozorenje && (
          <div
            className="upozorenje red-ikone red-ikone-vrh"
            style={{ marginBottom: 18 }}
          >
            <IkonaUpozorenje velicina={16} className="ikona-nesabijena" />
            <span>{upozorenje}</span>
          </div>
        )}

        {ucitavanje ? (
          <p className="prigusen ucitavanje">Učitavam rokove…</p>
        ) : rokovi.length === 0 ? (
          <div className="kartica" style={{ padding: 26 }}>
            <p className="prigusen" style={{ margin: 0 }}>
              Za izabrani mesec i izabranog obveznika nema zabeleženih rokova u
              bazi. To ne znači da rokova nema — proverite zvanični poreski
              kalendar Poreske uprave.
            </p>
          </div>
        ) : (
          <div className="razmak-y-s">
            {rokovi.map((r) => {
              const datum = new Date(r.datum);
              const prosao = jeTekuciMesec && datum < danas;
              return (
                <article
                  key={r.id}
                  className="kartica"
                  style={{
                    padding: 16,
                    display: "flex",
                    gap: 16,
                    opacity: prosao ? 0.6 : 1,
                  }}
                >
                  <div
                    style={{
                      minWidth: 54,
                      textAlign: "center",
                      padding: "8px 4px",
                      borderRadius: 8,
                      background: prosao
                        ? "var(--povrsina-2)"
                        : "var(--akcenat-pozadina)",
                      alignSelf: "flex-start",
                    }}
                  >
                    <div
                      className="broj"
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: prosao ? "var(--tekst-slab)" : "var(--akcenat)",
                        lineHeight: 1.1,
                      }}
                    >
                      {r.dan}
                    </div>
                    <div className="sitni slab">{MESECI[mesec - 1].slice(0, 3)}</div>
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{r.naziv}</div>
                    <p className="mali prigusen" style={{ margin: "5px 0 0" }}>
                      {r.opis}
                    </p>
                    <div
                      style={{
                        marginTop: 9,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      {r.obrazac && (
                        <span className="znacka znacka-siva">Obrazac {r.obrazac}</span>
                      )}
                      <span className="znacka znacka-siva">
                        {r.ponavljanje === "MESECNO"
                          ? "Mesečno"
                          : r.ponavljanje === "KVARTALNO"
                            ? "Kvartalno"
                            : "Godišnje"}
                      </span>
                      {r.verifikacija !== "POTVRDJENO" && (
                        <span className="znacka znacka-zuta">
                          Rok nije potvrđen — proverite
                        </span>
                      )}
                      <a
                        href={r.izvorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="osnov-radnja"
                      >
                        <IkonaVeza velicina={14} />
                        Izvor
                      </a>
                    </div>
                    {r.propis && (
                      <div className="sitni slab" style={{ marginTop: 6 }}>
                        {r.propis}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Podnozje />
    </main>
  );
}
