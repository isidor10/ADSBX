"use client";

import { useEffect, useState } from "react";
import { Podnozje, Zaglavlje } from "@/components/Osnovno";

interface Firma {
  id: string;
  naziv: string;
  pib: string | null;
  maticniBroj: string | null;
  pravnaForma: string;
  sifraDelatnosti: string | null;
  nazivDelatnosti: string | null;
  pdvStatus: string;
  pdvPeriod: string | null;
  nacinOporezivanja: string | null;
  brojZaposlenih: number;
  sediste: string | null;
  poslovneJedinice: string[];
  napomena: string | null;
}

const PRAVNE_FORME = [
  { v: "PREDUZETNIK_PAUSALAC", n: "Preduzetnik paušalac" },
  { v: "PREDUZETNIK_KNJIGAS", n: "Preduzetnik koji vodi poslovne knjige" },
  { v: "PREDUZETNIK_LICNA_ZARADA", n: "Preduzetnik sa ličnom zaradom" },
  { v: "DOO", n: "Društvo s ograničenom odgovornošću (DOO)" },
  { v: "AD", n: "Akcionarsko društvo (AD)" },
  { v: "DRUGO_PRAVNO_LICE", n: "Drugo pravno lice" },
  { v: "FIZICKO_LICE", n: "Fizičko lice" },
];

const PDV_STATUSI = [
  { v: "VAN_SISTEMA", n: "Nije u sistemu PDV-a" },
  { v: "U_SISTEMU", n: "U sistemu PDV-a" },
  { v: "DOBROVOLJNO", n: "Dobrovoljno u sistemu PDV-a" },
];

const prazna = {
  naziv: "",
  pib: "",
  maticniBroj: "",
  pravnaForma: "DOO",
  sifraDelatnosti: "",
  nazivDelatnosti: "",
  pdvStatus: "VAN_SISTEMA",
  pdvPeriod: "",
  nacinOporezivanja: "",
  brojZaposlenih: 0,
  sediste: "",
  napomena: "",
};

export default function StranaFirme() {
  const [prijavljen, postaviPrijavljen] = useState<boolean | null>(null);
  const [firme, postaviFirme] = useState<Firma[]>([]);
  const [obrazac, postaviObrazac] = useState<typeof prazna & { id?: string }>(
    prazna,
  );
  const [poruka, postaviPoruku] = useState<string | null>(null);
  const [greska, postaviGresku] = useState<string | null>(null);
  const [cuva, postaviCuva] = useState(false);

  async function ucitaj() {
    const odg = await fetch("/api/firma");
    const podaci = await odg.json();
    postaviPrijavljen(podaci.prijavljen);
    postaviFirme(podaci.firme ?? []);
  }

  useEffect(() => {
    ucitaj();
  }, []);

  async function sacuvaj(e: React.FormEvent) {
    e.preventDefault();
    postaviCuva(true);
    postaviGresku(null);
    postaviPoruku(null);

    try {
      const odg = await fetch("/api/firma", {
        method: obrazac.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...obrazac, poslovneJedinice: [] }),
      });
      const podaci = await odg.json();
      if (!odg.ok) {
        postaviGresku(
          podaci.detalji
            ? podaci.detalji.map((d: { poruka: string }) => d.poruka).join(" ")
            : (podaci.greska ?? "Greška pri čuvanju."),
        );
        return;
      }
      postaviPoruku("Profil firme je sačuvan. Ubuduće se koristi u razgovoru.");
      postaviObrazac(prazna);
      await ucitaj();
    } finally {
      postaviCuva(false);
    }
  }

  if (prijavljen === false) {
    return (
      <main className="glavna">
        <Zaglavlje naslov="Moja firma" />
        <div style={{ padding: "20px 24px", flex: 1 }}>
          <Prijava naUspeh={ucitaj} />
        </div>
        <Podnozje />
      </main>
    );
  }

  return (
    <main className="glavna">
      <Zaglavlje
        naslov="Moja firma"
        opis="Kada unesete profil firme, savetnik ga koristi u svakom odgovoru i ne mora da vas svaki put pita isto."
      />

      <div style={{ padding: "20px 24px", flex: 1 }}>
        {firme.length > 0 && (
          <section style={{ marginBottom: 26 }}>
            <div className="oznaka">Sačuvane firme</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 10,
              }}
            >
              {firme.map((f) => (
                <div key={f.id} className="kartica" style={{ padding: 15 }}>
                  <div style={{ fontWeight: 600 }}>{f.naziv}</div>
                  <div className="sitni slab" style={{ marginTop: 4 }}>
                    {PRAVNE_FORME.find((p) => p.v === f.pravnaForma)?.n ??
                      f.pravnaForma}
                  </div>
                  <div
                    style={{
                      marginTop: 9,
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className={`znacka ${
                        f.pdvStatus === "VAN_SISTEMA"
                          ? "znacka-siva"
                          : "znacka-zelena"
                      }`}
                    >
                      {PDV_STATUSI.find((p) => p.v === f.pdvStatus)?.n}
                    </span>
                    {f.brojZaposlenih > 0 && (
                      <span className="znacka znacka-siva">
                        {f.brojZaposlenih} zaposlenih
                      </span>
                    )}
                  </div>
                  {f.pib && (
                    <div className="sitni slab" style={{ marginTop: 8 }}>
                      PIB {f.pib}
                      {f.maticniBroj && ` · MB ${f.maticniBroj}`}
                    </div>
                  )}
                  <button
                    onClick={() =>
                      postaviObrazac({
                        id: f.id,
                        naziv: f.naziv,
                        pib: f.pib ?? "",
                        maticniBroj: f.maticniBroj ?? "",
                        pravnaForma: f.pravnaForma,
                        sifraDelatnosti: f.sifraDelatnosti ?? "",
                        nazivDelatnosti: f.nazivDelatnosti ?? "",
                        pdvStatus: f.pdvStatus,
                        pdvPeriod: f.pdvPeriod ?? "",
                        nacinOporezivanja: f.nacinOporezivanja ?? "",
                        brojZaposlenih: f.brojZaposlenih,
                        sediste: f.sediste ?? "",
                        napomena: f.napomena ?? "",
                      })
                    }
                    className="mali"
                    style={{
                      marginTop: 10,
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "var(--akcenat)",
                      fontWeight: 600,
                    }}
                  >
                    Izmeni
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <form
          onSubmit={sacuvaj}
          className="kartica"
          style={{ padding: 22, maxWidth: 720 }}
        >
          <h2 style={{ fontSize: 17 }}>
            {obrazac.id ? "Izmena profila firme" : "Novi profil firme"}
          </h2>

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <Polje
              oznaka="Naziv firme *"
              vrednost={obrazac.naziv}
              naPromenu={(v) => postaviObrazac({ ...obrazac, naziv: v })}
            />
            <div>
              <label className="oznaka">Pravna forma *</label>
              <select
                className="polje"
                value={obrazac.pravnaForma}
                onChange={(e) =>
                  postaviObrazac({ ...obrazac, pravnaForma: e.target.value })
                }
              >
                {PRAVNE_FORME.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.n}
                  </option>
                ))}
              </select>
            </div>
            <Polje
              oznaka="PIB"
              vrednost={obrazac.pib}
              naPromenu={(v) => postaviObrazac({ ...obrazac, pib: v })}
              pomoc="9 cifara"
            />
            <Polje
              oznaka="Matični broj"
              vrednost={obrazac.maticniBroj}
              naPromenu={(v) => postaviObrazac({ ...obrazac, maticniBroj: v })}
              pomoc="8 cifara"
            />
            <div>
              <label className="oznaka">PDV status *</label>
              <select
                className="polje"
                value={obrazac.pdvStatus}
                onChange={(e) =>
                  postaviObrazac({ ...obrazac, pdvStatus: e.target.value })
                }
              >
                {PDV_STATUSI.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="oznaka">Poreski period za PDV</label>
              <select
                className="polje"
                value={obrazac.pdvPeriod}
                onChange={(e) =>
                  postaviObrazac({ ...obrazac, pdvPeriod: e.target.value })
                }
              >
                <option value="">—</option>
                <option value="MESECNI">Mesečni</option>
                <option value="KVARTALNI">Kvartalni</option>
              </select>
            </div>
            <Polje
              oznaka="Šifra delatnosti"
              vrednost={obrazac.sifraDelatnosti}
              naPromenu={(v) =>
                postaviObrazac({ ...obrazac, sifraDelatnosti: v })
              }
            />
            <Polje
              oznaka="Naziv delatnosti"
              vrednost={obrazac.nazivDelatnosti}
              naPromenu={(v) =>
                postaviObrazac({ ...obrazac, nazivDelatnosti: v })
              }
            />
            <Polje
              oznaka="Broj zaposlenih"
              tip="number"
              vrednost={String(obrazac.brojZaposlenih)}
              naPromenu={(v) =>
                postaviObrazac({ ...obrazac, brojZaposlenih: Number(v) || 0 })
              }
            />
            <Polje
              oznaka="Mesto sedišta"
              vrednost={obrazac.sediste}
              naPromenu={(v) => postaviObrazac({ ...obrazac, sediste: v })}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="oznaka">Napomena</label>
            <textarea
              className="polje"
              rows={3}
              style={{ resize: "vertical" }}
              value={obrazac.napomena}
              onChange={(e) =>
                postaviObrazac({ ...obrazac, napomena: e.target.value })
              }
            />
          </div>

          {greska && (
            <div className="opasnost" style={{ marginTop: 14 }}>
              {greska}
            </div>
          )}
          {poruka && (
            <div
              className="znacka znacka-zelena"
              style={{ marginTop: 14, display: "block", padding: "10px 12px" }}
            >
              {poruka}
            </div>
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
            <button className="dugme" disabled={cuva || !obrazac.naziv}>
              {cuva
                ? "Čuvam…"
                : obrazac.id
                  ? "Sačuvaj izmene"
                  : "Sačuvaj firmu"}
            </button>
            {obrazac.id && (
              <button
                type="button"
                className="dugme dugme-tiho"
                onClick={() => postaviObrazac(prazna)}
              >
                Odustani
              </button>
            )}
          </div>
        </form>
      </div>

      <Podnozje />
    </main>
  );
}

function Polje({
  oznaka,
  vrednost,
  naPromenu,
  tip = "text",
  pomoc,
}: {
  oznaka: string;
  vrednost: string;
  naPromenu: (v: string) => void;
  tip?: string;
  pomoc?: string;
}) {
  return (
    <div>
      <label className="oznaka">{oznaka}</label>
      <input
        className="polje"
        type={tip}
        value={vrednost}
        onChange={(e) => naPromenu(e.target.value)}
      />
      {pomoc && (
        <p className="sitni slab" style={{ margin: "4px 0 0" }}>
          {pomoc}
        </p>
      )}
    </div>
  );
}

function Prijava({ naUspeh }: { naUspeh: () => void }) {
  const [akcija, postaviAkciju] = useState<"prijava" | "registracija">(
    "prijava",
  );
  const [email, postaviEmail] = useState("");
  const [lozinka, postaviLozinku] = useState("");
  const [kod, postaviKod] = useState("");
  const [greska, postaviGresku] = useState<string | null>(null);
  const [radi, postaviRadi] = useState(false);

  async function posalji(e: React.FormEvent) {
    e.preventDefault();
    postaviRadi(true);
    postaviGresku(null);
    try {
      const odg = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ akcija, email, lozinka, kod }),
      });
      const podaci = await odg.json();
      if (!odg.ok) {
        postaviGresku(podaci.greska ?? "Greška.");
        return;
      }
      naUspeh();
    } finally {
      postaviRadi(false);
    }
  }

  return (
    <form
      onSubmit={posalji}
      className="kartica"
      style={{ padding: 24, maxWidth: 420 }}
    >
      <h2 style={{ fontSize: 17 }}>
        {akcija === "prijava" ? "Prijava" : "Registracija"}
      </h2>
      <p className="mali prigusen" style={{ marginTop: 6 }}>
        Profil firme, praćenje izmena propisa i istorija razgovora čuvaju se uz
        korisnički nalog.
      </p>

      <div style={{ marginTop: 18 }} className="razmak-y">
        <div>
          <label className="oznaka">Email</label>
          <input
            className="polje"
            type="email"
            required
            value={email}
            onChange={(e) => postaviEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="oznaka">Lozinka</label>
          <input
            className="polje"
            type="password"
            required
            minLength={8}
            value={lozinka}
            onChange={(e) => postaviLozinku(e.target.value)}
          />
          <p className="sitni slab" style={{ margin: "4px 0 0" }}>
            Najmanje 8 znakova.
          </p>
        </div>

        {akcija === "registracija" && (
          <div>
            <label className="oznaka">Pozivni kod</label>
            <input
              className="polje"
              type="text"
              value={kod}
              onChange={(e) => postaviKod(e.target.value)}
              autoComplete="off"
            />
            <p className="sitni slab" style={{ margin: "4px 0 0" }}>
              Popunite samo ako ste ga dobili. Na objavljenoj aplikaciji kod
              sprečava da nalog otvori bilo ko ko naiđe na adresu.
            </p>
          </div>
        )}

        {greska && <div className="opasnost">{greska}</div>}

        <button className="dugme" style={{ width: "100%" }} disabled={radi}>
          {radi ? "…" : akcija === "prijava" ? "Prijavi se" : "Registruj se"}
        </button>

        <button
          type="button"
          onClick={() =>
            postaviAkciju(akcija === "prijava" ? "registracija" : "prijava")
          }
          className="mali"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--akcenat)",
            width: "100%",
          }}
        >
          {akcija === "prijava"
            ? "Nemate nalog? Registrujte se"
            : "Već imate nalog? Prijavite se"}
        </button>
      </div>
    </form>
  );
}
