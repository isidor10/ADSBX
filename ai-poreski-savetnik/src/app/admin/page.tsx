"use client";

import { useEffect, useState } from "react";
import { Podnozje, Pouzdanost, Zaglavlje } from "@/components/Osnovno";

interface Podaci {
  statistika: Record<string, number>;
  kvalitet: {
    poPouzdanosti: Array<{ nivo: string; broj: number }>;
    ukupnoOdbacenihCitata: number;
    odgovoraSaOdbacenimCitatom: number;
    procenatSaOdbacenim: number;
    prosecnoTrajanjeMs: number;
    udeoSaWebPretragom: number;
  };
  pravnaBaza: {
    nepotvrdjeneOdredbe: number;
    nepotvrdjeniParametri: number;
    poslednjeAzuriranje: string | null;
  };
  najcesciPropisi: Array<{ naziv: string; broj: number }>;
  neodgovorenaPitanja: Array<{
    id: string;
    pitanje: string;
    razlog: string;
    oblast: string | null;
    brojPuta: number;
  }>;
  zaProveru: Array<{
    id: string;
    sadrzaj: string;
    nivoPouzdanosti: string | null;
    razgovor: string;
    kreirana: string;
  }>;
}

export default function StranaAdmina() {
  const [podaci, postaviPodatke] = useState<Podaci | null>(null);
  const [greska, postaviGresku] = useState<string | null>(null);
  const [ocenjeni, postaviOcenjene] = useState<Record<string, string>>({});

  async function ucitaj() {
    const odg = await fetch("/api/admin");
    const p = await odg.json();
    if (!odg.ok) {
      postaviGresku(p.greska ?? "Nema pristupa.");
      return;
    }
    postaviPodatke(p);
  }

  useEffect(() => {
    ucitaj();
  }, []);

  async function oceni(porukaId: string, ocena: string) {
    const odg = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ porukaId, ocena }),
    });
    if (odg.ok) postaviOcenjene({ ...ocenjeni, [porukaId]: ocena });
  }

  if (greska) {
    return (
      <main className="glavna">
        <Zaglavlje naslov="Administracija" />
        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div className="opasnost">{greska}</div>
          <p className="mali prigusen" style={{ marginTop: 12 }}>
            Administratorska prava dobija prvi registrovani korisnik. Registrujte
            se na stranici „Moja firma".
          </p>
        </div>
        <Podnozje />
      </main>
    );
  }

  if (!podaci) {
    return (
      <main className="glavna">
        <Zaglavlje naslov="Administracija" />
        <div style={{ padding: "20px 24px", flex: 1 }}>
          <p className="prigusen ucitavanje">Učitavam…</p>
        </div>
      </main>
    );
  }

  const k = podaci.kvalitet;

  return (
    <main className="glavna">
      <Zaglavlje
        naslov="Administracija"
        opis="Kvalitet odgovora, stanje pravne baze i pitanja za koja sistem nije pronašao pravni osnov."
      />

      <div style={{ padding: "20px 24px", flex: 1 }} className="razmak-y">
        <section>
          <div className="oznaka">Upotreba</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            {[
              ["Korisnika", podaci.statistika.brojKorisnika],
              ["Razgovora", podaci.statistika.brojRazgovora],
              ["Odgovora", podaci.statistika.brojOdgovora],
              ["Dokumenata", podaci.statistika.brojDokumenata],
              ["Propisa u bazi", podaci.statistika.brojPropisa],
              ["Odredbi u bazi", podaci.statistika.brojOdredbi],
            ].map(([naziv, broj]) => (
              <div key={String(naziv)} className="kartica" style={{ padding: 14 }}>
                <div className="sitni slab">{naziv}</div>
                <div className="broj" style={{ fontSize: 21, fontWeight: 700, marginTop: 3 }}>
                  {broj}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="oznaka">Kvalitet odgovora</div>
          <div className="kartica" style={{ padding: 18 }}>
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              {k.poPouzdanosti.map((p) => (
                <div key={p.nivo} style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <Pouzdanost nivo={p.nivo} />
                  <span className="broj" style={{ fontWeight: 700 }}>{p.broj}</span>
                </div>
              ))}
            </div>

            <table className="tabela-obracuna">
              <tbody>
                <tr>
                  <td style={{ fontWeight: 550 }}>
                    Odbačenih citata (blokirane halucinacije)
                    <div className="sitni slab">
                      Citati koje je verifikator uklonio jer ne postoje u pravnoj bazi.
                    </div>
                  </td>
                  <td className="desno broj" style={{ fontWeight: 700 }}>
                    {k.ukupnoOdbacenihCitata}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 550 }}>Odgovora sa bar jednim odbačenim citatom</td>
                  <td className="desno broj" style={{ fontWeight: 700 }}>
                    {k.odgovoraSaOdbacenimCitatom} ({k.procenatSaOdbacenim}%)
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 550 }}>Udeo odgovora sa web proverom</td>
                  <td className="desno broj" style={{ fontWeight: 700 }}>
                    {k.udeoSaWebPretragom}%
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 550 }}>Prosečno trajanje odgovora</td>
                  <td className="desno broj" style={{ fontWeight: 700 }}>
                    {(k.prosecnoTrajanjeMs / 1000).toFixed(1)} s
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="oznaka">Stanje pravne baze</div>
          <div className="kartica" style={{ padding: 18 }}>
            <table className="tabela-obracuna">
              <tbody>
                <tr>
                  <td style={{ fontWeight: 550 }}>Odredbe sa nepotvrđenim brojem člana</td>
                  <td className="desno broj" style={{ fontWeight: 700 }}>
                    {podaci.pravnaBaza.nepotvrdjeneOdredbe}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 550 }}>Parametri sa statusom „nepotvrđeno”</td>
                  <td className="desno broj" style={{ fontWeight: 700 }}>
                    {podaci.pravnaBaza.nepotvrdjeniParametri}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 550 }}>Poslednje ažuriranje propisa</td>
                  <td className="desno mali">
                    {podaci.pravnaBaza.poslednjeAzuriranje
                      ? new Date(
                          podaci.pravnaBaza.poslednjeAzuriranje,
                        ).toLocaleString("sr-RS")
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
            {(podaci.pravnaBaza.nepotvrdjeneOdredbe > 0 ||
              podaci.pravnaBaza.nepotvrdjeniParametri > 0) && (
              <div className="upozorenje" style={{ marginTop: 14 }}>
                Nepotvrđene stavke se korisniku prikazuju sa upozorenjem i ne mogu
                da nose visoku pouzdanost. Dopunite ih komandom{" "}
                <code>npm run ingest</code>.
              </div>
            )}
          </div>
        </section>

        {podaci.najcesciPropisi.length > 0 && (
          <section>
            <div className="oznaka">Najčešće korišćeni propisi</div>
            <div className="kartica" style={{ padding: 18 }}>
              {podaci.najcesciPropisi.map((p) => (
                <div
                  key={p.naziv}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "6px 0",
                  }}
                >
                  <span className="mali">{p.naziv}</span>
                  <span className="broj mali" style={{ fontWeight: 700 }}>
                    {p.broj}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {podaci.neodgovorenaPitanja.length > 0 && (
          <section>
            <div className="oznaka">
              Pitanja bez pravnog osnova — kandidati za dopunu baze
            </div>
            <div className="razmak-y-s">
              {podaci.neodgovorenaPitanja.map((n) => (
                <div key={n.id} className="kartica" style={{ padding: 14 }}>
                  <div className="mali" style={{ fontWeight: 550 }}>
                    {n.pitanje}
                  </div>
                  <div className="sitni slab" style={{ marginTop: 5 }}>
                    {n.razlog}
                    {n.oblast && ` · ${n.oblast}`}
                    {n.brojPuta > 1 && ` · postavljeno ${n.brojPuta} puta`}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {podaci.zaProveru.length > 0 && (
          <section>
            <div className="oznaka">Odgovori za stručnu ocenu</div>
            <div className="razmak-y-s">
              {podaci.zaProveru.map((p) => (
                <div key={p.id} className="kartica" style={{ padding: 15 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    {p.nivoPouzdanosti && <Pouzdanost nivo={p.nivoPouzdanosti} />}
                    <span className="sitni slab">
                      {new Date(p.kreirana).toLocaleString("sr-RS")}
                    </span>
                  </div>
                  <div className="mali">{p.sadrzaj}</div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {ocenjeni[p.id] ? (
                      <span className="znacka znacka-zelena">
                        Ocenjeno:{" "}
                        {ocenjeni[p.id] === "POUZDAN"
                          ? "Pouzdan odgovor"
                          : "Potrebna stručna provera"}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => oceni(p.id, "POUZDAN")}
                          className="dugme dugme-tiho"
                          style={{ minHeight: 36, fontSize: 13 }}
                        >
                          ✓ Pouzdan odgovor
                        </button>
                        <button
                          onClick={() => oceni(p.id, "POTREBNA_STRUCNA_PROVERA")}
                          className="dugme dugme-tiho"
                          style={{ minHeight: 36, fontSize: 13 }}
                        >
                          ⚠︎ Potrebna stručna provera
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Podnozje />
    </main>
  );
}
