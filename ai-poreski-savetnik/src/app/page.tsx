"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Nalaz, type PodaciNalaza } from "@/components/Nalaz";
import {
  OdgovorAsistenta,
  PitanjeKorisnika,
  type Poruka,
  type WebIzvor,
} from "@/components/Poruke";
import { Citat, DISCLAIMER, KarticaPravnogOsnova } from "@/components/Osnovno";
import { DugmeGlasa, TrakaGlasa, useGlas } from "@/components/Glas";
import {
  IkonaDokument,
  IkonaFirma,
  IkonaKalkulator,
  IkonaPropisi,
  IkonaRokovi,
  IkonaPosalji,
  IkonaStrelicaDesno,
  IkonaZatvori,
} from "@/components/Ikone";
import { tekstZaIzgovor } from "@/lib/glas";
import {
  jeStil,
  OPISI_STILOVA,
  PODRAZUMEVANI_STIL,
  STILOVI,
  type Stil,
} from "@/lib/ai/stilovi";

/*
 * Predlozi su cela pitanja, ne kategorije.
 *
 * „Porezi" ne kaže ništa o tome šta se sme pitati ni koliko detaljno. Napisano
 * pitanje istovremeno pokazuje obim, ton i to da se sme pitati svakodnevnim
 * jezikom — a klik na njega je prvi odgovor koji čovek dobije.
 */
const PREDLOZI = [
  "Da li mogu da odbijem PDV za automobil?",
  "Koliki je ukupan trošak zaposlenog sa neto platom od 120.000 dinara?",
  "Da li je ovaj račun poreski priznat rashod?",
  "Koji poreski rok imam ovog meseca?",
];

/* Prečice ka onome što nije pitanje nego alat — tiho, u jednom redu. */
const BRZE_AKCIJE: Array<{
  tekst: string;
  Ikona: typeof IkonaKalkulator;
  put?: string;
  upit?: string;
}> = [
  { tekst: "Izračunaj", Ikona: IkonaKalkulator, put: "/kalkulator" },
  { tekst: "Propisi", Ikona: IkonaPropisi, put: "/propisi" },
  { tekst: "Rokovi", Ikona: IkonaRokovi, put: "/rokovi" },
  { tekst: "Dokument", Ikona: IkonaDokument, put: "/dokument" },
  { tekst: "Moja firma", Ikona: IkonaFirma, put: "/firma" },
];

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
  // Tekst faze iz toka — bez njega je čekanje od par minuta nerazlučivo od kvara.
  const [faza, postaviFazu] = useState("");
  const [razgovorId, postaviRazgovorId] = useState<string | undefined>();
  const [rezim, postaviRezim] = useState<"standard" | "drugo_misljenje">(
    "standard",
  );
  const [panelOtvoren, postaviPanel] = useState(false);
  // Nalaz ostaje montiran i posle štampe. Uklanjanje na `afterprint` je trka
  // koju dokument gubi: pregledači taj događaj umeju da okinu pre nego što
  // otisnu stranu, pa je izlazio prazan PDF. Na ekranu ga ionako nema.
  const [nalaz, postaviNalaz] = useState<PodaciNalaza | null>(null);
  // Stil se pamti između poseta: ko jednom bira „Accountant", po pravilu to
  // želi i sledeći put, a ponovno biranje pri svakom otvaranju je trošak.
  const [stil, postaviStil] = useState<Stil>(PODRAZUMEVANI_STIL);
  const dno = useRef<HTMLDivElement>(null);
  const glasRef = useRef<ReturnType<typeof useGlas> | null>(null);

  useEffect(() => {
    dno.current?.scrollIntoView({ behavior: "smooth" });
  }, [poruke, ucitavanje]);

  // Dolazak sa strane „Propisi" preko dugmeta „Pitaj AI o ovom članu" —
  // pitanje se prenosi kroz URL i unosi u polje, ali se NE šalje samo od sebe:
  // korisnik treba da vidi i po potrebi dopuni pitanje pre slanja.
  useEffect(() => {
    const sacuvan = localStorage.getItem("stil");
    if (jeStil(sacuvan)) postaviStil(sacuvan);
  }, []);

  function promeniStil(s: Stil) {
    postaviStil(s);
    localStorage.setItem("stil", s);
  }

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
    postaviFazu("Šaljem pitanje…");

    try {
      const odgovor = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitanje, razgovorId, rezim, stil }),
      });

      // Odgovor stiže kao tok NDJSON redova: faze dok traje, pa „gotovo" ili
      // „greska". Kad tok pukne pre završnog reda, to se ovde i vidi — ranije
      // se svaki takav slučaj svodio na „nije moguće doći do servera".
      if (!odgovor.ok || !odgovor.body) {
        // Server je odbio zahtev pre nego što je tok počeo. Ako uz odbijanje
        // nije poslao objašnjenje, ovde se ranije ispisivalo samo „Došlo je do
        // greške” — što ne kaže ništa ni korisniku ni onome ko to popravlja.
        // Zato se prikazuje bar HTTP status i početak onoga što je stiglo.
        const sirovo = await odgovor.text().catch(() => "");
        let nasa = "";
        let tudja = "";
        try {
          nasa = (JSON.parse(sirovo) as { greska?: string }).greska ?? "";
        } catch {
          tudja = sirovo
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 200);
        }

        postaviPoruke((p) => [
          ...p,
          {
            uloga: "asistent",
            greska:
              // Poruku koju je aplikacija sama sastavila treba pokazati kakva
              // jeste — ona već kaže šta da se uradi. Sve ostalo znači da je
              // odgovor stigao mimo aplikacije, pa uz njega ide i putokaz.
              nasa ||
              [
                `Server je odbio zahtev (HTTP ${odgovor.status}).`,
                tudja && `Odgovor servera: „${tudja}”.`,
                "Uzrok piše u terminalu u kojem radi „npm run kreni” — potražite red koji počinje sa [/api/chat].",
              ]
                .filter(Boolean)
                .join(" "),
          },
        ]);
        return;
      }

      const citac = odgovor.body.getReader();
      const dekoder = new TextDecoder();
      let ostatak = "";
      let zavrseno = false;

      while (true) {
        const { value, done } = await citac.read();
        if (done) break;

        ostatak += dekoder.decode(value, { stream: true });
        const redovi = ostatak.split("\n");
        ostatak = redovi.pop() ?? "";

        for (const red of redovi) {
          if (!red.trim()) continue;
          let dogadjaj: Record<string, never>;
          try {
            dogadjaj = JSON.parse(red);
          } catch {
            continue;
          }

          if (dogadjaj.tip === "faza") {
            postaviFazu(dogadjaj.tekst);
          } else if (dogadjaj.tip === "greska") {
            zavrseno = true;
            postaviPoruke((p) => [
              ...p,
              { uloga: "asistent", greska: dogadjaj.greska },
            ]);
          } else if (dogadjaj.tip === "gotovo") {
            zavrseno = true;
            postaviRazgovorId(dogadjaj.razgovorId);
            postaviPoruke((p) => [
              ...p,
              {
                uloga: "asistent",
                odgovor: dogadjaj.odgovor,
                citati: dogadjaj.citati,
                webIzvori: dogadjaj.webIzvori,
                upozorenja: dogadjaj.upozorenja,
                ciljniDatum: dogadjaj.ciljniDatum,
                koriscenaWebPretraga: dogadjaj.koriscenaWebPretraga,
              },
            ]);
            if (
              Array.isArray(dogadjaj.citati) &&
              (dogadjaj.citati as unknown[]).length > 0
            ) {
              postaviPanel(true);
            }
            // Govori se tek pošto je odgovor iscrtan: dok se čuje zaključak,
            // pravni osnov sa članom i linkom već stoji na ekranu.
            if (glasRef.current?.stanje === "obradjujem") {
              glasRef.current.izgovoriOdgovor(
                tekstZaIzgovor(
                  dogadjaj.odgovor as never,
                  (dogadjaj.citati as unknown[] | undefined)?.length ?? 0,
                  (dogadjaj.upozorenja as unknown[] | undefined)?.length ?? 0,
                ),
              );
            }
          }
        }
      }

      if (!zavrseno) {
        postaviPoruke((p) => [
          ...p,
          {
            uloga: "asistent",
            greska:
              "Veza je prekinuta pre nego što je odgovor stigao do kraja. Pokušajte ponovo — ako se ponavlja, pitanje je verovatno preobimno za jedan zahtev, pa ga podelite na dva.",
          },
        ]);
      }
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
      postaviFazu("");
    }
  }

  // Glas koristi isti `posalji` — pitanje izgovoreno naglas prolazi kroz isti
  // tok kao otkucano, uključujući verifikator citata.
  const glas = useGlas(posalji, ucitavanje);
  // `posalji` je definisan pre hook-a, pa do glasa dolazi kroz ref — inače bi
  // se u toku čitanja odgovora zvao glas iz prvog rendera.
  glasRef.current = glas;

  /**
   * Priprema nalaz pa otvara štampu. React mora prvo da ga iscrta, inače bi
   * `print()` uhvatio prazan dokument — otud čekanje na sledeći okvir.
   */
  function odstampajNalaz(pitanje: string, poruka: Poruka) {
    if (!poruka.odgovor) return;
    postaviNalaz({
      pitanje,
      odgovor: poruka.odgovor,
      citati: poruka.citati ?? [],
      webIzvori: poruka.webIzvori ?? [],
      upozorenja: poruka.upozorenja ?? [],
      ciljniDatum: poruka.ciljniDatum,
    });
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  return (
    <>
      {nalaz && <Nalaz podaci={nalaz} />}
      <main className="glavna glavna-razgovor">
        <header className="zaglavlje-razgovora">
          <div className="ime">
            Miranda{" "}
            <span role="img" aria-label="štikla" className="stikla">
              👠
            </span>
          </div>
          <div className="uloga">Poreski savetnik za Republiku Srbiju</div>
        </header>

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
                  <OdgovorAsistenta
                    key={i}
                    poruka={p}
                    // Nalaz nosi i pitanje, jer onaj ko ga dobije nema razgovor
                    // pred sobom. Pitanje je poslednja poruka korisnika pre
                    // ovog odgovora.
                    naPdf={() =>
                      odstampajNalaz(
                        poruke
                          .slice(0, i)
                          .reverse()
                          .find((r) => r.uloga === "korisnik")?.tekst ?? "",
                        p,
                      )
                    }
                  />
                ),
              )}
              {ucitavanje && <Ucitavanje faza={faza} />}
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
          stil={stil}
          naStil={promeniStil}
          glas={glas}
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
    <div className="pocetni">
      <header className="pocetni-zaglavlje">
        <h1 className="pocetni-naslov">Dobro došli.</h1>
        <p className="pocetni-podnaslov">Šta danas rešavamo?</p>
      </header>

      {/*
        Primeri pitanja, ne dugmad sa ikonicama. Čovek koji prvi put otvori
        aplikaciju ne zna šta sme da pita — a videti tuđe pitanje napisano do
        kraja vredi više od kategorije koja mu ne kaže ništa o obimu.
      */}
      <ul className="predlozi">
        {PREDLOZI.map((tekst) => (
          <li key={tekst}>
            <button type="button" onClick={() => naPitanje(tekst)}>
              <span>{tekst}</span>
              <IkonaStrelicaDesno velicina={16} className="predlog-strelica" />
            </button>
          </li>
        ))}
      </ul>

      <nav className="brze-akcije" aria-label="Brze akcije">
        {BRZE_AKCIJE.map((a) =>
          a.put ? (
            <Link key={a.tekst} href={a.put}>
              <a.Ikona velicina={17} />
              {a.tekst}
            </Link>
          ) : (
            <button
              key={a.tekst}
              type="button"
              onClick={() => naPitanje(a.upit!)}
            >
              <a.Ikona velicina={17} />
              {a.tekst}
            </button>
          ),
        )}
      </nav>

      <p className="pocetni-disklejmer">{DISCLAIMER}</p>
    </div>
  );
}

function Ucitavanje({ faza }: { faza?: string }) {
  return (
    <div className="kartica" style={{ padding: "16px 18px" }}>
      <div className="ucitavanje prigusen mali">
        {faza || "Pretražujem pravnu bazu i proveravam važeće propise…"}
      </div>
      <div className="sitni slab" style={{ marginTop: 6 }}>
        Složeno pitanje sa proverom zvaničnih izvora ume da traje i par minuta.
      </div>
    </div>
  );
}

function UnosPitanja({
  vrednost,
  naPromenu,
  naSlanje,
  ucitavanje,
  rezim,
  naRezim,
  stil,
  naStil,
  glas,
  brojIzvora,
  naPanel,
}: {
  vrednost: string;
  naPromenu: (v: string) => void;
  naSlanje: () => void;
  ucitavanje: boolean;
  rezim: "standard" | "drugo_misljenje";
  naRezim: (r: "standard" | "drugo_misljenje") => void;
  stil: Stil;
  naStil: (s: Stil) => void;
  glas: ReturnType<typeof useGlas>;
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
          <label className="izbor-stila-omot">
            <span className="sr-samo">Stil odgovora</span>
            <select
              value={stil}
              onChange={(e) => naStil(e.target.value as Stil)}
              className="izbor-stila"
              title={OPISI_STILOVA[stil].opis}
            >
              {STILOVI.map((s) => (
                <option key={s} value={s}>
                  {OPISI_STILOVA[s].naziv}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() =>
              naRezim(rezim === "standard" ? "drugo_misljenje" : "standard")
            }
            aria-pressed={rezim === "drugo_misljenje"}
            className={`znacka znacka-dugme ${
              rezim === "drugo_misljenje" ? "znacka-zuta" : "znacka-siva"
            }`}
          >
            {rezim === "drugo_misljenje" && <span className="tacka" aria-hidden />}
            Proveri moj odgovor
          </button>

          {brojIzvora > 0 && (
            <button
              type="button"
              onClick={naPanel}
              className="znacka znacka-dugme znacka-siva"
            >
              <IkonaPropisi velicina={14} />
              Izvori ({brojIzvora})
            </button>
          )}
        </div>

        <div className="unos-red">
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
            rows={1}
            className="polje unos-polje"
            /* enterKeyHint menja natpis na iOS tastaturi sa „return" na
               „Pošalji" — sitnica koja se na telefonu odmah oseti. */
            enterKeyHint="send"
            autoCapitalize="sentences"
          />
          <DugmeGlasa glas={glas} />

          <button
            onClick={naSlanje}
            disabled={ucitavanje || vrednost.trim().length < 3}
            className="dugme dugme-posalji"
            aria-label="Pošalji pitanje"
          >
            <IkonaPosalji velicina={19} />
          </button>
        </div>

        <TrakaGlasa glas={glas} />
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
          type="button"
          onClick={naZatvaranje}
          className="dugme-zatvori"
          aria-label="Zatvori panel izvora"
        >
          <IkonaZatvori velicina={19} />
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
