"use client";

import { useEffect, useState } from "react";
import { Podnozje, Zaglavlje } from "@/components/Osnovno";
import { IkonaVeza } from "@/components/Ikone";

interface Izmena {
  id: string;
  naslov: string;
  propis: string;
  skracenica: string;
  kategorija: string;
  clan: string | null;
  staraOdredba: string | null;
  novaOdredba: string | null;
  odKadaSePrimenjuje: string;
  kogaPogadja: string;
  staTrebaUraditi: string;
  izvorUrl: string;
  sluzbeniGlasnik: string | null;
}

const OBLASTI = [
  { v: "PDV", n: "PDV" },
  { v: "DOBIT", n: "Porez na dobit" },
  { v: "DOHODAK", n: "Zarade i dohodak" },
  { v: "DOPRINOSI", n: "Doprinosi" },
  { v: "FISKALIZACIJA", n: "Fiskalizacija" },
  { v: "EFAKTURE", n: "eFakture" },
  { v: "RACUNOVODSTVO", n: "Računovodstvo" },
];

export default function StranaIzmena() {
  const [izmene, postaviIzmene] = useState<Izmena[]>([]);
  const [pracene, postaviPracene] = useState<string[]>([]);
  const [napomena, postaviNapomenu] = useState<string | null>(null);
  const [poruka, postaviPoruku] = useState<string | null>(null);

  async function ucitaj() {
    const odg = await fetch("/api/izmene");
    const p = await odg.json();
    postaviIzmene(p.izmene ?? []);
    postaviPracene(p.pracene ?? []);
    postaviNapomenu(p.napomena ?? null);
  }

  useEffect(() => {
    ucitaj();
  }, []);

  async function prebaci(kategorija: string) {
    const nove = pracene.includes(kategorija)
      ? pracene.filter((k) => k !== kategorija)
      : [...pracene, kategorija];
    postaviPracene(nove);

    const odg = await fetch("/api/izmene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kategorije: nove }),
    });
    if (odg.ok) {
      postaviPoruku("Praćenje je sačuvano.");
      setTimeout(() => postaviPoruku(null), 2500);
    } else {
      const p = await odg.json();
      postaviPoruku(p.greska ?? "Za praćenje izmena prijavite se.");
    }
  }

  return (
    <main className="glavna">
      <Zaglavlje
        naslov="Izmene propisa"
        opis="Šta se promenilo, od kada se primenjuje, koga pogađa i šta firma treba da uradi."
      />

      <div style={{ padding: "20px 24px", flex: 1 }}>
        <section className="kartica" style={{ padding: 20 }}>
          <div className="oznaka">Prati promene u oblastima</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {OBLASTI.map((o) => (
              <button
                key={o.v}
                onClick={() => prebaci(o.v)}
                className={`znacka znacka-dugme ${
                  pracene.includes(o.v) ? "znacka-zelena" : "znacka-siva"
                }`}
                aria-pressed={pracene.includes(o.v)}
              >
                {pracene.includes(o.v) && <span className="tacka" aria-hidden />}
                {o.n}
              </button>
            ))}
          </div>
          {poruka && (
            <p className="mali prigusen" style={{ margin: "10px 0 0" }}>
              {poruka}
            </p>
          )}
        </section>

        {napomena && (
          <div className="kartica" style={{ padding: 22, marginTop: 18 }}>
            <p className="prigusen" style={{ margin: 0 }}>
              {napomena}
            </p>
          </div>
        )}

        {izmene.length > 0 && (
          <section style={{ marginTop: 22 }} className="razmak-y">
            {izmene.map((i) => (
              <article key={i.id} className="kartica" style={{ padding: 20 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: 16 }}>{i.naslov}</h2>
                    <div className="sitni slab" style={{ marginTop: 4 }}>
                      {i.propis}
                      {i.clan && ` · ${i.clan}`}
                      {i.sluzbeniGlasnik && ` · ${i.sluzbeniGlasnik}`}
                    </div>
                  </div>
                  <span className="znacka znacka-zuta">
                    Od {new Date(i.odKadaSePrimenjuje).toLocaleDateString("sr-RS")}
                  </span>
                </div>

                {(i.staraOdredba || i.novaOdredba) && (
                  <div
                    style={{
                      marginTop: 14,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {i.staraOdredba && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          background: "var(--crvena-pozadina)",
                        }}
                      >
                        <div className="sitni" style={{ fontWeight: 700, marginBottom: 5 }}>
                          STARA ODREDBA
                        </div>
                        <div className="mali">{i.staraOdredba}</div>
                      </div>
                    )}
                    {i.novaOdredba && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          background: "var(--zelena-pozadina)",
                        }}
                      >
                        <div className="sitni" style={{ fontWeight: 700, marginBottom: 5 }}>
                          NOVA ODREDBA
                        </div>
                        <div className="mali">{i.novaOdredba}</div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 14 }} className="razmak-y-s">
                  <div>
                    <span className="oznaka" style={{ display: "inline" }}>
                      Koga pogađa:{" "}
                    </span>
                    <span className="mali">{i.kogaPogadja}</span>
                  </div>
                  <div>
                    <span className="oznaka" style={{ display: "inline" }}>
                      Šta treba uraditi:{" "}
                    </span>
                    <span className="mali">{i.staTrebaUraditi}</span>
                  </div>
                </div>

                <a
                  href={i.izvorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="osnov-radnja"
                  style={{ marginTop: 8 }}
                >
                  <IkonaVeza velicina={15} />
                  Izvor
                </a>
              </article>
            ))}
          </section>
        )}
      </div>

      <Podnozje />
    </main>
  );
}
