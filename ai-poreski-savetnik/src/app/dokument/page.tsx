"use client";

import { useState } from "react";
import {
  Citat,
  KarticaPravnogOsnova,
  Podnozje,
  Pouzdanost,
  Upozorenja,
  Zaglavlje,
} from "@/components/Osnovno";

interface Analiza {
  imeFajla: string;
  odgovor: {
    kratakOdgovor: string;
    objasnjenje: string;
    poreskiTretman?: Record<string, string | undefined>;
    vazno: string[];
    nivoPouzdanosti: string;
    obrazlozenjePouzdanosti: string;
    potrebnaPitanja?: string[];
    aiZakljucak?: string;
  };
  citati: Citat[];
  upozorenja: string[];
  nivoPouzdanosti: string;
}

const PODRZANI =
  ".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg";

export default function StranaDokumenta() {
  const [fajl, postaviFajl] = useState<File | null>(null);
  const [pitanje, postaviPitanje] = useState("");
  const [analiza, postaviAnalizu] = useState<Analiza | null>(null);
  const [greska, postaviGresku] = useState<string | null>(null);
  const [radi, postaviRadi] = useState(false);

  async function posalji(e: React.FormEvent) {
    e.preventDefault();
    if (!fajl) return;

    postaviRadi(true);
    postaviGresku(null);
    postaviAnalizu(null);

    const forma = new FormData();
    forma.append("fajl", fajl);
    if (pitanje.trim()) forma.append("pitanje", pitanje.trim());

    try {
      const odg = await fetch("/api/dokumenti", { method: "POST", body: forma });
      const podaci = await odg.json();
      if (!odg.ok) {
        postaviGresku(podaci.greska ?? "Greška pri analizi dokumenta.");
        return;
      }
      postaviAnalizu(podaci);
    } catch {
      postaviGresku("Nije moguće doći do servera.");
    } finally {
      postaviRadi(false);
    }
  }

  return (
    <main className="glavna">
      <Zaglavlje
        naslov="Analiza dokumenta"
        opis="Otpremite fakturu, ugovor, obračun zarade, poresku prijavu ili rešenje Poreske uprave. Sistem utvrđuje šta dokument predstavlja, koji se propisi primenjuju i šta treba uraditi."
      />

      <div style={{ padding: "20px 24px", flex: 1 }} className="razmak-y">
        <form onSubmit={posalji} className="kartica" style={{ padding: 22, maxWidth: 640 }}>
          <label className="oznaka" htmlFor="fajl">
            Dokument
          </label>
          <input
            id="fajl"
            type="file"
            accept={PODRZANI}
            className="polje"
            onChange={(e) => postaviFajl(e.target.files?.[0] ?? null)}
            style={{ paddingTop: 10 }}
          />
          <p className="sitni slab" style={{ margin: "6px 0 0" }}>
            Podržani formati: PDF, Word, Excel, CSV, tekst i slike. Najviše 20 MB.
          </p>

          <div style={{ marginTop: 16 }}>
            <label className="oznaka" htmlFor="pitanje">
              Dodatno pitanje (opciono)
            </label>
            <textarea
              id="pitanje"
              className="polje"
              rows={3}
              style={{ resize: "vertical" }}
              placeholder="npr. Da li je PDV pravilno obračunat na ovoj fakturi?"
              value={pitanje}
              onChange={(e) => postaviPitanje(e.target.value)}
            />
          </div>

          <button
            className="dugme"
            style={{ marginTop: 16, width: "100%" }}
            disabled={!fajl || radi}
          >
            {radi ? "Analiziram…" : "Analiziraj dokument"}
          </button>

          <p className="sitni slab" style={{ marginTop: 12, marginBottom: 0 }}>
            Analiza ne predstavlja potvrdu pravne ispravnosti dokumenta. Za takvu
            ocenu potreban je uvid u celokupnu dokumentaciju i okolnosti posla.
          </p>
        </form>

        {greska && <div className="opasnost">{greska}</div>}

        {radi && (
          <div className="kartica" style={{ padding: 18 }}>
            <p className="ucitavanje prigusen mali" style={{ margin: 0 }}>
              Čitam dokument, tražim relevantne propise i proveravam važenje…
            </p>
          </div>
        )}

        {analiza && (
          <article className="kartica" style={{ padding: 22 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <Pouzdanost nivo={analiza.nivoPouzdanosti} />
              <span className="sitni slab">{analiza.imeFajla}</span>
            </div>

            <p style={{ fontSize: 16.5, fontWeight: 550, margin: 0, lineHeight: 1.55 }}>
              {analiza.odgovor.kratakOdgovor}
            </p>

            <section style={{ marginTop: 18 }}>
              <div className="oznaka">Nalaz</div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                {analiza.odgovor.objasnjenje}
              </p>
            </section>

            {analiza.odgovor.poreskiTretman &&
              Object.values(analiza.odgovor.poreskiTretman).some(Boolean) && (
                <section style={{ marginTop: 18 }}>
                  <div className="oznaka">Poreski tretman</div>
                  <table className="tabela-obracuna">
                    <tbody>
                      {Object.entries(analiza.odgovor.poreskiTretman)
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <tr key={k}>
                            <td style={{ width: 130, fontWeight: 600 }}>{k}</td>
                            <td>{v}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </section>
              )}

            {analiza.citati.length > 0 && (
              <section style={{ marginTop: 18 }}>
                <div className="oznaka">Pravni osnov</div>
                <div className="razmak-y-s">
                  {analiza.citati.map((c, i) => (
                    <KarticaPravnogOsnova key={c.id + i} citat={c} redni={i + 1} />
                  ))}
                </div>
              </section>
            )}

            {analiza.odgovor.vazno.length > 0 && (
              <section style={{ marginTop: 18 }}>
                <div className="oznaka">Važno</div>
                <ul style={{ margin: 0, paddingLeft: 20 }} className="razmak-y-s">
                  {analiza.odgovor.vazno.map((v, i) => (
                    <li key={i} style={{ fontSize: 14.5 }}>
                      {v}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {analiza.odgovor.potrebnaPitanja &&
              analiza.odgovor.potrebnaPitanja.length > 0 && (
                <section style={{ marginTop: 18 }}>
                  <div className="oznaka">Nedostaje za potpunu ocenu</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }} className="razmak-y-s">
                    {analiza.odgovor.potrebnaPitanja.map((p, i) => (
                      <li key={i} style={{ fontSize: 14.5 }}>
                        {p}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

            <div style={{ marginTop: 18 }}>
              <Upozorenja poruke={analiza.upozorenja} />
            </div>
          </article>
        )}
      </div>

      <Podnozje />
    </main>
  );
}
