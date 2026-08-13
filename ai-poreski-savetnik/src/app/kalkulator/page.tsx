"use client";

import { useState } from "react";
import { Podnozje, Zaglavlje } from "@/components/Osnovno";
import { IkonaVeza } from "@/components/Ikone";

interface Polje {
  kljuc: string;
  naziv: string;
  tip: "broj" | "izbor" | "prekidac";
  opcije?: Array<{ vrednost: string | number; naziv: string }>;
  podrazumevano?: string | number | boolean;
  pomoc?: string;
  obavezno?: boolean;
}

interface Kalkulator {
  kljuc: string;
  naziv: string;
  opis: string;
  polja: Polje[];
}

const KALKULATORI: Kalkulator[] = [
  {
    kljuc: "pdv",
    naziv: "PDV",
    opis: "Obračun PDV-a na osnovicu ili izdvajanje PDV-a iz bruto iznosa.",
    polja: [
      { kljuc: "iznos", naziv: "Iznos (RSD)", tip: "broj", obavezno: true },
      {
        kljuc: "stopa",
        naziv: "Stopa",
        tip: "izbor",
        opcije: [
          { vrednost: "opsta", naziv: "Opšta (20%)" },
          { vrednost: "posebna", naziv: "Posebna (10%)" },
        ],
        podrazumevano: "opsta",
      },
      {
        kljuc: "smer",
        naziv: "Smer obračuna",
        tip: "izbor",
        opcije: [
          { vrednost: "na_osnovicu", naziv: "Na osnovicu (dodaj PDV)" },
          { vrednost: "iz_bruto", naziv: "Iz bruto iznosa (izdvoji PDV)" },
        ],
        podrazumevano: "na_osnovicu",
      },
    ],
  },
  {
    kljuc: "bruto-neto",
    naziv: "Zarada: bruto → neto",
    opis: "Porez, doprinosi i neto iznos za isplatu, sa troškom poslodavca.",
    polja: [{ kljuc: "bruto", naziv: "Bruto zarada (RSD)", tip: "broj", obavezno: true }],
  },
  {
    kljuc: "neto-bruto",
    naziv: "Zarada: neto → bruto",
    opis: "Koliko treba bruto da bi se isplatio traženi neto iznos.",
    polja: [{ kljuc: "neto", naziv: "Neto zarada (RSD)", tip: "broj", obavezno: true }],
  },
  {
    kljuc: "trosak-zaposlenog",
    naziv: "Ukupan trošak zaposlenog",
    opis: "Mesečni i godišnji trošak, uključujući naknadu za prevoz.",
    polja: [
      { kljuc: "bruto", naziv: "Bruto zarada (RSD)", tip: "broj", obavezno: true },
      { kljuc: "brojMeseci", naziv: "Broj meseci", tip: "broj", podrazumevano: 12 },
      { kljuc: "mesecniPrevoz", naziv: "Mesečna naknada za prevoz (RSD)", tip: "broj" },
    ],
  },
  {
    kljuc: "dobit",
    naziv: "Porez na dobit",
    opis: "Porez na oporezivu dobit iz poreskog bilansa.",
    polja: [
      { kljuc: "oporezivaDobit", naziv: "Oporeziva dobit (RSD)", tip: "broj", obavezno: true },
    ],
  },
  {
    kljuc: "po-odbitku",
    naziv: "Porez po odbitku",
    opis: "Porez na prihode nerezidentnih pravnih lica.",
    polja: [
      { kljuc: "bruto", naziv: "Bruto naknada (RSD)", tip: "broj", obavezno: true },
      {
        kljuc: "preferencijalnaJurisdikcija",
        naziv: "Primalac je iz jurisdikcije sa preferencijalnim poreskim sistemom",
        tip: "prekidac",
      },
      {
        kljuc: "stopaUgovora",
        naziv: "Stopa iz ugovora o izbegavanju dvostrukog oporezivanja (%)",
        tip: "broj",
        pomoc: "Ostavite prazno ako se primenjuje domaća stopa.",
      },
    ],
  },
  {
    kljuc: "pausal",
    naziv: "Preduzetnik paušalac",
    opis: "Porez i doprinosi na paušalno utvrđen prihod iz rešenja Poreske uprave.",
    polja: [
      {
        kljuc: "mesecniPausalniPrihod",
        naziv: "Paušalno utvrđen mesečni prihod (RSD)",
        tip: "broj",
        obavezno: true,
        pomoc: "Iznos iz rešenja Poreske uprave, a ne vaš stvarni promet.",
      },
      { kljuc: "godisnjiPromet", naziv: "Godišnji promet (RSD)", tip: "broj",
        pomoc: "Radi provere da li prelazite limit za paušal." },
    ],
  },
  {
    kljuc: "licna-zarada",
    naziv: "Lična zarada preduzetnika",
    opis: "Obračun poreza i doprinosa na ličnu zaradu.",
    polja: [
      { kljuc: "licnaZarada", naziv: "Lična zarada — bruto (RSD)", tip: "broj", obavezno: true },
    ],
  },
  {
    kljuc: "amortizacija",
    naziv: "Poreska amortizacija",
    opis: "Amortizacija po grupama za potrebe poreskog bilansa.",
    polja: [
      { kljuc: "nabavnaVrednost", naziv: "Nabavna vrednost (RSD)", tip: "broj", obavezno: true },
      {
        kljuc: "grupa",
        naziv: "Amortizaciona grupa",
        tip: "izbor",
        opcije: [
          { vrednost: 1, naziv: "I grupa (2,5%) — nepokretnosti" },
          { vrednost: 2, naziv: "II grupa (10%)" },
          { vrednost: 3, naziv: "III grupa (15%)" },
          { vrednost: 4, naziv: "IV grupa (20%)" },
          { vrednost: 5, naziv: "V grupa (30%)" },
        ],
        podrazumevano: 3,
      },
      { kljuc: "brojGodina", naziv: "Broj godina prikaza", tip: "broj", podrazumevano: 5 },
    ],
  },
  {
    kljuc: "kapitalni-dobitak",
    naziv: "Kapitalni dobitak",
    opis: "Porez na razliku između prodajne i nabavne cene.",
    polja: [
      { kljuc: "prodajnaCena", naziv: "Prodajna cena (RSD)", tip: "broj", obavezno: true },
      { kljuc: "nabavnaCena", naziv: "Nabavna cena (RSD)", tip: "broj", obavezno: true },
    ],
  },
  {
    kljuc: "sluzbeni-put",
    naziv: "Službeni put i dnevnice",
    opis: "Neoporezivi i oporezivi deo dnevnica.",
    polja: [
      { kljuc: "brojDana", naziv: "Broj dana", tip: "broj", obavezno: true },
      { kljuc: "dnevnicaPoDanu", naziv: "Isplaćena dnevnica po danu (RSD)", tip: "broj",
        pomoc: "Ostavite prazno za neoporezivi iznos." },
      { kljuc: "predjeniKm", naziv: "Pređeni kilometri sopstvenim autom", tip: "broj" },
    ],
  },
  {
    kljuc: "automobil",
    naziv: "Trošak službenog automobila",
    opis: "PDV, amortizacija i efekat na porez na dobit.",
    polja: [
      { kljuc: "nabavnaVrednost", naziv: "Nabavna vrednost sa PDV-om (RSD)", tip: "broj", obavezno: true },
      { kljuc: "pdvObveznik", naziv: "Firma je u sistemu PDV-a", tip: "prekidac" },
      {
        kljuc: "koriscenjeIskljucivoPoslovno",
        naziv: "Vozilo se koristi isključivo poslovno",
        tip: "prekidac",
      },
      { kljuc: "godisnjiTroskoviGoriva", naziv: "Godišnji troškovi goriva (RSD)", tip: "broj" },
      { kljuc: "godisnjiTroskoviOdrzavanja", naziv: "Godišnji troškovi održavanja (RSD)", tip: "broj" },
    ],
  },
  {
    kljuc: "sta-ako",
    naziv: "Poređenje pravnih formi („šta ako”)",
    opis: "Orijentaciono poređenje paušalca, preduzetnika sa ličnom zaradom i DOO.",
    polja: [
      { kljuc: "godisnjiPrihod", naziv: "Godišnji prihod (RSD)", tip: "broj", obavezno: true },
      { kljuc: "godisnjiTroskovi", naziv: "Godišnji poslovni troškovi (RSD)", tip: "broj", obavezno: true },
      { kljuc: "mesecniPausalniPrihod", naziv: "Paušalno utvrđen mesečni prihod (RSD)", tip: "broj" },
    ],
  },
];

interface KoriscenParametar {
  kljuc: string;
  naziv: string;
  vrednost: string;
  jedinica: string;
  vaziOd: string;
  izvorUrl: string;
  propis?: string;
  clan?: string;
  verifikacija: string;
}

interface Rezultat {
  naziv: string;
  koraci: Array<{
    opis: string;
    formula: string;
    izracun: string;
    rezultat: number;
    jedinica?: string;
  }>;
  rezultat: Record<string, number>;
  koriscenParametri: KoriscenParametar[];
  napomene: string[];
  ciljniDatum: string;
}

function formatirajBroj(n: number): string {
  return n.toLocaleString("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function StranaKalkulatora() {
  const [izabran, postaviIzabran] = useState<Kalkulator>(KALKULATORI[0]);
  const [unosi, postaviUnose] = useState<Record<string, string | boolean>>({});
  const [datum, postaviDatum] = useState(new Date().toISOString().slice(0, 10));
  const [rezultat, postaviRezultat] = useState<Rezultat | null>(null);
  const [greska, postaviGresku] = useState<string | null>(null);
  const [ucitavanje, postaviUcitavanje] = useState(false);

  function izaberi(k: Kalkulator) {
    postaviIzabran(k);
    postaviRezultat(null);
    postaviGresku(null);
    const pocetni: Record<string, string | boolean> = {};
    for (const p of k.polja) {
      if (p.podrazumevano !== undefined) {
        pocetni[p.kljuc] =
          typeof p.podrazumevano === "boolean"
            ? p.podrazumevano
            : String(p.podrazumevano);
      }
    }
    postaviUnose(pocetni);
  }

  async function izracunaj() {
    postaviUcitavanje(true);
    postaviGresku(null);
    postaviRezultat(null);

    const telo: Record<string, unknown> = { datum };
    for (const polje of izabran.polja) {
      const v = unosi[polje.kljuc];
      if (v === undefined || v === "") continue;
      if (polje.tip === "prekidac") telo[polje.kljuc] = Boolean(v);
      else if (polje.tip === "broj") telo[polje.kljuc] = Number(v);
      else telo[polje.kljuc] = polje.kljuc === "grupa" ? Number(v) : v;
    }

    try {
      const odg = await fetch(`/api/kalkulator/${izabran.kljuc}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(telo),
      });
      const podaci = await odg.json();
      if (!odg.ok) {
        postaviGresku(podaci.greska ?? "Greška pri obračunu.");
        return;
      }
      postaviRezultat(podaci);
    } catch {
      postaviGresku("Nije moguće doći do servera.");
    } finally {
      postaviUcitavanje(false);
    }
  }

  const nedostajeObavezno = izabran.polja.some(
    (p) => p.obavezno && !unosi[p.kljuc],
  );

  return (
    <main className="glavna">
      <Zaglavlje
        naslov="Poreski kalkulatori"
        opis="Svaki obračun prikazuje formulu, korake i pravni osnov svakog parametra. Datum određuje koja verzija propisa se primenjuje."
      />

      <div style={{ padding: "20px 24px", flex: 1 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 7,
            marginBottom: 20,
          }}
        >
          {KALKULATORI.map((k) => (
            <button
              key={k.kljuc}
              onClick={() => izaberi(k)}
              aria-pressed={izabran.kljuc === k.kljuc}
              className={`znacka znacka-dugme ${
                izabran.kljuc === k.kljuc ? "znacka-zelena" : "znacka-siva"
              }`}
              style={{ fontSize: 12.5 }}
            >
              {k.naziv}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)",
            gap: 22,
            alignItems: "start",
          }}
          className="kalkulator-mreza"
        >
          <div className="kartica" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 17 }}>{izabran.naziv}</h2>
            <p className="mali prigusen" style={{ marginTop: 5 }}>
              {izabran.opis}
            </p>

            <div style={{ marginTop: 18 }} className="razmak-y">
              {izabran.polja.map((polje) => (
                <div key={polje.kljuc}>
                  {polje.tip === "prekidac" ? (
                    <label
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        cursor: "pointer",
                        minHeight: 44,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(unosi[polje.kljuc])}
                        onChange={(e) =>
                          postaviUnose({ ...unosi, [polje.kljuc]: e.target.checked })
                        }
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ fontSize: 14 }}>{polje.naziv}</span>
                    </label>
                  ) : (
                    <>
                      <label className="oznaka" htmlFor={polje.kljuc}>
                        {polje.naziv}
                        {polje.obavezno && " *"}
                      </label>
                      {polje.tip === "izbor" ? (
                        <select
                          id={polje.kljuc}
                          className="polje"
                          value={String(unosi[polje.kljuc] ?? "")}
                          onChange={(e) =>
                            postaviUnose({ ...unosi, [polje.kljuc]: e.target.value })
                          }
                        >
                          {polje.opcije?.map((o) => (
                            <option key={String(o.vrednost)} value={String(o.vrednost)}>
                              {o.naziv}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={polje.kljuc}
                          type="number"
                          inputMode="decimal"
                          className="polje"
                          value={String(unosi[polje.kljuc] ?? "")}
                          onChange={(e) =>
                            postaviUnose({ ...unosi, [polje.kljuc]: e.target.value })
                          }
                        />
                      )}
                      {polje.pomoc && (
                        <p className="sitni slab" style={{ margin: "5px 0 0" }}>
                          {polje.pomoc}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}

              <div>
                <label className="oznaka" htmlFor="datum">
                  Pravno stanje na dan
                </label>
                <input
                  id="datum"
                  type="date"
                  className="polje"
                  value={datum}
                  onChange={(e) => postaviDatum(e.target.value)}
                />
                <p className="sitni slab" style={{ margin: "5px 0 0" }}>
                  Obračun koristi stope i iznose koji su važili na taj datum.
                </p>
              </div>

              <button
                onClick={izracunaj}
                disabled={ucitavanje || nedostajeObavezno}
                className="dugme"
                style={{ width: "100%" }}
              >
                {ucitavanje ? "Računam…" : "Izračunaj"}
              </button>
            </div>
          </div>

          <div>
            {greska && <div className="opasnost">{greska}</div>}

            {!rezultat && !greska && (
              <div className="kartica" style={{ padding: 28, textAlign: "center" }}>
                <p className="prigusen mali" style={{ margin: 0 }}>
                  Unesite podatke i pokrenite obračun. Rezultat prikazuje formulu,
                  svaki korak i pravni osnov svakog parametra.
                </p>
              </div>
            )}

            {rezultat && <PrikazRezultata rezultat={rezultat} />}
          </div>
        </div>
      </div>

      <Podnozje />

      <style>{`
        @media (max-width: 900px) {
          .kalkulator-mreza { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </main>
  );
}

function PrikazRezultata({ rezultat }: { rezultat: Rezultat }) {
  return (
    <div className="razmak-y">
      <div className="kartica" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 17 }}>{rezultat.naziv}</h2>
        <p className="sitni slab" style={{ marginTop: 4 }}>
          Pravno stanje na dan{" "}
          {new Date(rezultat.ciljniDatum).toLocaleDateString("sr-RS")}
        </p>

        <div className="oznaka" style={{ marginTop: 18 }}>
          Formula → obračun → rezultat
        </div>
        <div className="skrol-x">
          <table className="tabela-obracuna">
            <tbody>
              {rezultat.koraci.map((k, i) => (
                <tr key={i}>
                  <td style={{ minWidth: 190 }}>
                    <div style={{ fontWeight: 550 }}>{k.opis}</div>
                    <div className="sitni slab" style={{ marginTop: 3 }}>
                      {k.formula}
                    </div>
                  </td>
                  <td className="sitni prigusen broj">{k.izracun}</td>
                  <td className="desno broj" style={{ fontWeight: 650 }}>
                    {formatirajBroj(k.rezultat)}
                    {k.jedinica && k.jedinica !== "RSD" ? ` ${k.jedinica}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="oznaka" style={{ marginTop: 20 }}>
          Rezultat
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
          }}
        >
          {Object.entries(rezultat.rezultat).map(([kljuc, vrednost]) => (
            <div
              key={kljuc}
              style={{
                padding: "11px 13px",
                background: "var(--povrsina-2)",
                borderRadius: 8,
              }}
            >
              <div className="sitni slab">{kljuc}</div>
              <div className="broj" style={{ fontSize: 16, fontWeight: 650, marginTop: 3 }}>
                {formatirajBroj(vrednost)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="kartica" style={{ padding: 20 }}>
        <div className="oznaka">Pravni osnov obračuna</div>
        <div className="razmak-y-s">
          {rezultat.koriscenParametri.map((p) => (
            <div
              key={p.kljuc}
              className={`pravni-osnov ${
                p.verifikacija !== "POTVRDJENO" ? "pravni-osnov-nepotvrdjen" : ""
              }`}
              style={{ padding: "11px 13px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.naziv}</span>
                <span className="broj" style={{ fontWeight: 650, whiteSpace: "nowrap" }}>
                  {p.vrednost}
                  {p.jedinica === "PROCENAT" ? "%" : p.jedinica === "RSD" ? " RSD" : ""}
                </span>
              </div>
              <div className="sitni slab" style={{ marginTop: 5 }}>
                {p.propis && `${p.propis}`}
                {p.clan && ` · ${p.clan}`}
                {" · važi od "}
                {new Date(p.vaziOd).toLocaleDateString("sr-RS")}
              </div>
              <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <a
                  href={p.izvorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="osnov-radnja"
                >
                  <IkonaVeza velicina={14} />
                  Otvori izvor
                </a>
                {p.verifikacija !== "POTVRDJENO" && (
                  <span className="znacka znacka-zuta">Nije potvrđeno</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {rezultat.napomene.length > 0 && (
        <div className="kartica" style={{ padding: 20 }}>
          <div className="oznaka">Napomene i ograničenja</div>
          <ul style={{ margin: 0, paddingLeft: 20 }} className="razmak-y-s">
            {rezultat.napomene.map((n, i) => (
              <li
                key={i}
                className="mali"
                style={{
                  color: n.startsWith("UPOZORENJE") || n.includes("NIJE obračunata")
                    ? "var(--zuta)"
                    : "var(--tekst-prigusen)",
                  fontWeight: n.startsWith("UPOZORENJE") ? 600 : 400,
                }}
              >
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
