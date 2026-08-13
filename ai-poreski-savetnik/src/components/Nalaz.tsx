"use client";

/**
 * Poreski nalaz — verzija odgovora namenjena štampi i slanju na proveru.
 *
 * Ovo nije isti dokument kao ono na ekranu, i namerno. Na ekranu čitalac ima
 * kontekst razgovora i može da klikne. Onaj ko nalaz dobije mejlom nema ništa
 * osim papira: zato je pitanje otisnuto uz odgovor, svaki citat nosi ispisan
 * URL pored linka, a nepotvrđene stavke su označene rečima, ne bojom — jer boja
 * na crno-belom štampaču nestaje.
 *
 * PDF se dobija kroz štampu pregledača (odredište „Save as PDF"). Tako srpska
 * dijakritika izlazi ispravno bez ugrađivanja fontova, linkovi ostaju klikabilni,
 * a aplikacija ne nosi biblioteku za generisanje PDF-a.
 */

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Citat, DISCLAIMER, opisTipaTvrdnje } from "./Osnovno";

export interface PodaciNalaza {
  pitanje: string;
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
  webIzvori: Array<{ naslov: string; url: string; institucija: string }>;
  upozorenja: string[];
  ciljniDatum?: string;
}

const NAZIV_POUZDANOSTI: Record<string, string> = {
  VISOKA: "Visoka",
  POTREBNA_PROVERA: "Potrebna dodatna provera",
  NEDOVOLJNO_PODATAKA: "Nedovoljno podataka",
};

const NAZIV_POLJA: Record<string, string> = {
  poreziKojiSePlacaju: "Porezi koji se plaćaju",
  osnovica: "Osnovica",
  stopa: "Stopa",
  rok: "Rok",
  prijava: "Prijava",
  knjizenje: "Knjiženje",
};

function datum(d?: string) {
  const v = d ? new Date(d) : new Date();
  return v.toLocaleDateString("sr-Latn-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Naslov({ deca }: { deca: string }) {
  return <h2 className="nalaz-naslov">{deca}</h2>;
}

export function Nalaz({ podaci }: { podaci: PodaciNalaza }) {
  const [montiran, postaviMontiran] = useState(false);
  useEffect(() => postaviMontiran(true), []);
  if (!montiran) return null;

  const o = podaci.odgovor;
  const tretman = Object.entries(o.poreskiTretman ?? {}).filter(
    ([, v]) => v && String(v).trim(),
  );
  const nepotvrdjeni = podaci.citati.filter((c) => !c.potvrdjen).length;

  return createPortal(
    <div id="nalaz" lang="sr-Latn-RS">
      <header className="nalaz-zaglavlje">
        <div>
          <div className="nalaz-brend">Miranda 👠</div>
          <div className="nalaz-podbrend">
            Poreski savetnik · Republika Srbija
          </div>
        </div>
        <div className="nalaz-meta">
          <div>
            <strong>Nalaz sastavljen:</strong> {datum()}
          </div>
          <div>
            <strong>Pravno stanje na dan:</strong> {datum(podaci.ciljniDatum)}
          </div>
          <div>
            <strong>Pouzdanost:</strong>{" "}
            {NAZIV_POUZDANOSTI[o.nivoPouzdanosti] ?? o.nivoPouzdanosti}
          </div>
        </div>
      </header>

      <Naslov deca="Pitanje" />
      <p className="nalaz-pitanje">{podaci.pitanje}</p>

      <Naslov deca="Kratak odgovor" />
      <p className="nalaz-vodeci">{o.kratakOdgovor}</p>

      <Naslov deca="Objašnjenje" />
      <p>{o.objasnjenje}</p>

      {tretman.length > 0 && (
        <>
          <Naslov deca="Poreski tretman" />
          <table className="nalaz-tabela">
            <tbody>
              {tretman.map(([k, v]) => (
                <tr key={k}>
                  <th>{NAZIV_POLJA[k] ?? k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <Naslov deca="Pravni osnov" />
      {podaci.citati.length === 0 ? (
        <p className="nalaz-prazno">
          Za ovaj odgovor nije pronađen nijedan potvrđen propis u pravnoj bazi.
          Odgovor zato treba uzeti kao polazište za proveru, ne kao utvrđeno
          pravno stanje.
        </p>
      ) : (
        <ol className="nalaz-osnov">
          {podaci.citati.map((c) => (
            <li key={c.id}>
              <div className="nalaz-propis">
                {c.propisPun} — {c.oznaka}
              </div>
              <div className="nalaz-oznake">
                {opisTipaTvrdnje(c.tipTvrdnje)} · {c.statusOznaka} · važi od{" "}
                {datum(c.vaziOd)}
                {c.vaziDo ? ` do ${datum(c.vaziDo)}` : ""}
                {!c.potvrdjen && " · BROJ ČLANA NIJE POTVRĐEN"}
              </div>
              {c.relevantnost && <div>{c.relevantnost}</div>}
              {c.tekst && <blockquote>{c.tekst}</blockquote>}
              <div className="nalaz-url">
                {c.institucija}: <a href={c.url}>{c.url}</a>
              </div>
            </li>
          ))}
        </ol>
      )}

      {o.vazno.length > 0 && (
        <>
          <Naslov deca="Važno" />
          <ul>
            {o.vazno.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </>
      )}

      {o.potrebnaPitanja && o.potrebnaPitanja.length > 0 && (
        <>
          <Naslov deca="Podaci koji nedostaju" />
          <ul>
            {o.potrebnaPitanja.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}

      {o.aiZakljucak && (
        <>
          <Naslov deca="AI zaključak — nije napisan u propisu" />
          <p className="nalaz-zakljucak">{o.aiZakljucak}</p>
        </>
      )}

      {podaci.upozorenja.length > 0 && (
        <>
          <Naslov deca="Upozorenja" />
          <ul>
            {podaci.upozorenja.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </>
      )}

      {podaci.webIzvori.length > 0 && (
        <>
          <Naslov deca="Konsultovani izvori sa interneta" />
          <ul className="nalaz-web">
            {podaci.webIzvori.map((w) => (
              <li key={w.url}>
                {w.naslov} ({w.institucija}) — <a href={w.url}>{w.url}</a>
              </li>
            ))}
          </ul>
        </>
      )}

      <Naslov deca="Za onoga ko proverava" />
      <p className="nalaz-uputstvo">
        Nivo pouzdanosti ovog nalaza je{" "}
        <strong>
          {NAZIV_POUZDANOSTI[o.nivoPouzdanosti] ?? o.nivoPouzdanosti}
        </strong>{" "}
        — {o.obrazlozenjePouzdanosti}
        {nepotvrdjeni > 0 && (
          <>
            {" "}
            Kod {nepotvrdjeni}{" "}
            {nepotvrdjeni === 1
              ? "odredbe broj člana nije"
              : "odredbi brojevi članova nisu"}{" "}
            potvrđen prema izvoru i posebno {nepotvrdjeni === 1 ? "ga" : "ih"}{" "}
            treba proveriti u važećoj verziji propisa.
          </>
        )}
      </p>

      <table className="nalaz-potpis">
        <tbody>
          <tr>
            <td>Proverio (ime i prezime)</td>
            <td>Datum provere</td>
          </tr>
          <tr>
            <td className="nalaz-linija" />
            <td className="nalaz-linija" />
          </tr>
        </tbody>
      </table>

      <p className="nalaz-disklejmer">{DISCLAIMER}</p>
    </div>,
    document.body,
  );
}
