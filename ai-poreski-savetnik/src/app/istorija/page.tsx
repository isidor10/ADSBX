"use client";

/**
 * Istorija razgovora.
 *
 * Spisak levo, izabrani razgovor desno. Odgovor se prikazuje istom komponentom
 * kao u tekućem razgovoru, pa iz istorije ide i isti PDF nalaz — sa članom,
 * statusom važenja i upozorenjima kakvi su bili u trenutku odgovora.
 */

import { useCallback, useEffect, useState } from "react";
import { Pouzdanost } from "@/components/Osnovno";
import {
  OdgovorAsistenta,
  PitanjeKorisnika,
  type Poruka,
} from "@/components/Poruke";
import { Nalaz, type PodaciNalaza } from "@/components/Nalaz";

interface StavkaSpiska {
  id: string;
  naslov: string;
  kreiran: string;
  azuriran: string;
  brojPoruka: number;
  nivoPouzdanosti: string | null;
  izvod: string | null;
}

function kada(iso: string) {
  const d = new Date(iso);
  const danas = new Date();
  const isti =
    d.getFullYear() === danas.getFullYear() &&
    d.getMonth() === danas.getMonth() &&
    d.getDate() === danas.getDate();

  const vreme = d.toLocaleTimeString("sr-Latn-RS", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isti) return `danas u ${vreme}`;

  return `${d.toLocaleDateString("sr-Latn-RS", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} u ${vreme}`;
}

export default function StranaIstorije() {
  const [spisak, postaviSpisak] = useState<StavkaSpiska[] | null>(null);
  const [izabran, postaviIzabran] = useState<string | null>(null);
  const [poruke, postaviPoruke] = useState<Poruka[] | null>(null);
  const [greska, postaviGresku] = useState<string | null>(null);
  const [nalaz, postaviNalaz] = useState<PodaciNalaza | null>(null);

  const ucitajSpisak = useCallback(async () => {
    try {
      const o = await fetch("/api/razgovori");
      const p = await o.json();
      if (!o.ok) throw new Error(p.greska);
      postaviSpisak(p.razgovori);
    } catch {
      postaviGresku("Nije moguće učitati istoriju.");
      postaviSpisak([]);
    }
  }, []);

  useEffect(() => {
    ucitajSpisak();
  }, [ucitajSpisak]);

  async function otvori(id: string) {
    postaviIzabran(id);
    postaviPoruke(null);
    try {
      const o = await fetch(`/api/razgovori?id=${encodeURIComponent(id)}`);
      const p = await o.json();
      if (!o.ok) throw new Error(p.greska);
      postaviPoruke(p.razgovor.poruke);
    } catch {
      postaviGresku("Nije moguće učitati taj razgovor.");
      postaviPoruke([]);
    }
  }

  async function obrisi(id: string) {
    if (
      !confirm(
        "Obrisati ovaj razgovor iz istorije? Zajedno sa njim nestaju i sačuvani odgovori sa pravnim osnovom.",
      )
    ) {
      return;
    }
    await fetch(`/api/razgovori?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (izabran === id) {
      postaviIzabran(null);
      postaviPoruke(null);
    }
    ucitajSpisak();
  }

  function odstampaj(indeks: number) {
    if (!poruke) return;
    const p = poruke[indeks];
    if (!p.odgovor) return;
    postaviNalaz({
      pitanje:
        poruke
          .slice(0, indeks)
          .reverse()
          .find((r) => r.uloga === "korisnik")?.tekst ?? "",
      odgovor: p.odgovor,
      citati: p.citati ?? [],
      webIzvori: p.webIzvori ?? [],
      upozorenja: p.upozorenja ?? [],
      ciljniDatum: p.ciljniDatum,
    });
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  return (
    <>
      {nalaz && <Nalaz podaci={nalaz} />}
      <main className="glavna">
        <h1>Istorija</h1>
        <p className="prigusen" style={{ marginTop: 8 }}>
          Svaki odgovor se čuva onakav kakav je dat — sa pravnim osnovom i
          upozorenjima iz tog trenutka. Ako se propis u međuvremenu izmeni,
          stari nalaz se ne menja, jer je po njemu možda već postupano.
        </p>

        {greska && (
          <div className="opasnost" style={{ marginTop: 16 }}>
            {greska}
          </div>
        )}

        <div className="istorija-raspored">
          <section>
            {spisak === null ? (
              <p className="prigusen ucitavanje" style={{ marginTop: 20 }}>
                Učitavam…
              </p>
            ) : spisak.length === 0 ? (
              <div className="kartica" style={{ marginTop: 20, padding: 18 }}>
                <p style={{ margin: 0 }}>Još nema sačuvanih razgovora.</p>
                <p className="mali prigusen" style={{ marginTop: 8 }}>
                  Postavite pitanje na strani <strong>Razgovor</strong> — svaki
                  odgovor se sam čuva ovde.
                </p>
              </div>
            ) : (
              <div className="razmak-y-s" style={{ marginTop: 20 }}>
                {spisak.map((s) => (
                  <div
                    key={s.id}
                    className={`kartica istorija-stavka ${
                      izabran === s.id ? "istorija-stavka-aktivna" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => otvori(s.id)}
                      className="istorija-dugme"
                    >
                      <div style={{ fontWeight: 550 }}>{s.naslov}</div>
                      <div
                        className="sitni slab"
                        style={{ marginTop: 4, marginBottom: 6 }}
                      >
                        {kada(s.azuriran)} · {s.brojPoruka}{" "}
                        {s.brojPoruka === 1 ? "poruka" : "poruka"}
                      </div>
                      {s.nivoPouzdanosti && (
                        <Pouzdanost nivo={s.nivoPouzdanosti} />
                      )}
                    </button>
                    <button
                      type="button"
                      className="dugme-tiho sitni"
                      onClick={() => obrisi(s.id)}
                      aria-label={`Obriši razgovor: ${s.naslov}`}
                    >
                      Obriši
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            {izabran === null ? (
              <p className="prigusen" style={{ marginTop: 20 }}>
                Izaberite razgovor sa spiska.
              </p>
            ) : poruke === null ? (
              <p className="prigusen ucitavanje" style={{ marginTop: 20 }}>
                Učitavam razgovor…
              </p>
            ) : (
              <div className="razmak-y" style={{ marginTop: 20 }}>
                {poruke.map((p, i) =>
                  p.uloga === "korisnik" ? (
                    <PitanjeKorisnika key={i} tekst={p.tekst ?? ""} />
                  ) : (
                    <OdgovorAsistenta
                      key={i}
                      poruka={p}
                      naPdf={() => odstampaj(i)}
                    />
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
