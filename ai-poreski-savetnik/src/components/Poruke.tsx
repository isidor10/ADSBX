"use client";

/**
 * Prikaz jedne razmene — pitanje i odgovor sa pravnim osnovom.
 *
 * Živi ovde, a ne u strani razgovora, jer isti odgovor prikazuju dva mesta:
 * tekući razgovor i istorija. Dve kopije istog prikaza bi se s vremenom
 * razišle, a upravo tu razliku korisnik ne sme da vidi — odgovor iz istorije
 * mora da nosi ista upozorenja i isti pravni osnov kao kad je prvi put dat.
 */

import { Nalaz, type PodaciNalaza } from "@/components/Nalaz";
import {
  Citat,
  jeVisokorizicno,
  KarticaPravnogOsnova,
  Pouzdanost,
  Upozorenja,
} from "@/components/Osnovno";

export interface WebIzvor {
  naslov: string;
  url: string;
  institucija: string;
  prioritet: number;
}

export interface Odgovor {
  kratakOdgovor: string;
  objasnjenje: string;
  poreskiTretman?: Record<string, string | undefined>;
  vazno: string[];
  nivoPouzdanosti: string;
  obrazlozenjePouzdanosti: string;
  potrebnaPitanja?: string[];
  aiZakljucak?: string;
}

export interface Poruka {
  uloga: "korisnik" | "asistent";
  tekst?: string;
  odgovor?: Odgovor;
  citati?: Citat[];
  webIzvori?: WebIzvor[];
  upozorenja?: string[];
  ciljniDatum?: string;
  koriscenaWebPretraga?: boolean;
  greska?: string;
}

export function PitanjeKorisnika({ tekst }: { tekst: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          maxWidth: "84%",
          padding: "12px 16px",
          borderRadius: "14px 14px 4px 14px",
          background: "var(--akcenat-pozadina)",
          color: "var(--tekst)",
          fontSize: 15,
        }}
      >
        {tekst}
      </div>
    </div>
  );
}

function Odeljak({
  naslov,
  children,
}: {
  naslov: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 18 }}>
      <div className="oznaka">{naslov}</div>
      {children}
    </section>
  );
}

export function OdgovorAsistenta({
  poruka,
  naPdf,
}: {
  poruka: Poruka;
  naPdf: () => void;
}) {
  if (poruka.greska) {
    return <div className="opasnost">{poruka.greska}</div>;
  }
  const o = poruka.odgovor;
  if (!o) return null;

  const rizicno =
    jeVisokorizicno(o.kratakOdgovor) || jeVisokorizicno(o.objasnjenje);

  return (
    <article className="kartica" style={{ padding: "20px 22px" }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <Pouzdanost nivo={o.nivoPouzdanosti} />
        {poruka.koriscenaWebPretraga && (
          <span className="znacka znacka-siva">🌐 Provereno na webu</span>
        )}
        {poruka.ciljniDatum && (
          <span className="sitni slab">
            Pravno stanje na dan{" "}
            {new Date(poruka.ciljniDatum).toLocaleDateString("sr-RS")}
          </span>
        )}
      </div>

      <p
        style={{ fontSize: 16.5, fontWeight: 550, margin: 0, lineHeight: 1.55 }}
      >
        {o.kratakOdgovor}
      </p>

      <Odeljak naslov="Objašnjenje">
        <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
          {o.objasnjenje}
        </p>
      </Odeljak>

      {o.poreskiTretman && Object.values(o.poreskiTretman).some(Boolean) && (
        <Odeljak naslov="Poreski i računovodstveni tretman">
          <div className="kartica" style={{ padding: 0, overflow: "hidden" }}>
            <table className="tabela-obracuna">
              <tbody>
                {(
                  [
                    ["poreziKojiSePlacaju", "Porezi"],
                    ["osnovica", "Osnovica"],
                    ["stopa", "Stopa"],
                    ["rok", "Rok"],
                    ["prijava", "Prijava"],
                    ["knjizenje", "Knjiženje"],
                  ] as const
                ).map(([kljuc, naziv]) =>
                  o.poreskiTretman?.[kljuc] ? (
                    <tr key={kljuc}>
                      <td
                        style={{
                          width: 130,
                          fontWeight: 600,
                          color: "var(--tekst-prigusen)",
                        }}
                      >
                        {naziv}
                      </td>
                      <td>{o.poreskiTretman[kljuc]}</td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
        </Odeljak>
      )}

      {poruka.citati && poruka.citati.length > 0 && (
        <Odeljak naslov="Pravni osnov">
          <div className="razmak-y-s">
            {poruka.citati.map((c, i) => (
              <KarticaPravnogOsnova key={c.id + i} citat={c} redni={i + 1} />
            ))}
          </div>
        </Odeljak>
      )}

      {o.aiZakljucak && (
        <Odeljak naslov="AI zaključak — nije sadržina propisa">
          <div
            className="kartica"
            style={{
              padding: "12px 14px",
              background: "var(--povrsina-2)",
              fontSize: 14,
            }}
          >
            {o.aiZakljucak}
          </div>
        </Odeljak>
      )}

      {o.vazno.length > 0 && (
        <Odeljak naslov="Važno">
          <ul style={{ margin: 0, paddingLeft: 20 }} className="razmak-y-s">
            {o.vazno.map((v, i) => (
              <li key={i} style={{ fontSize: 14.5 }}>
                {v}
              </li>
            ))}
          </ul>
        </Odeljak>
      )}

      {o.potrebnaPitanja && o.potrebnaPitanja.length > 0 && (
        <Odeljak naslov="Da bih dao precizniji odgovor, potrebno je da znam">
          <ol style={{ margin: 0, paddingLeft: 20 }} className="razmak-y-s">
            {o.potrebnaPitanja.map((p, i) => (
              <li key={i} style={{ fontSize: 14.5 }}>
                {p}
              </li>
            ))}
          </ol>
        </Odeljak>
      )}

      <div style={{ marginTop: 16 }} className="razmak-y-s">
        <Upozorenja poruke={poruka.upozorenja ?? []} />
        {rizicno && (
          <div className="opasnost">
            ⚠︎ Ovo je oblast povišenog poreskog rizika. Pre postupanja obavezno
            proverite konkretan slučaj sa ovlašćenim poreskim savetnikom —
            posledice pogrešnog tretmana mogu biti značajne.
          </div>
        )}
      </div>

      <p className="sitni slab" style={{ marginTop: 14, marginBottom: 0 }}>
        Pouzdanost: {o.obrazlozenjePouzdanosti}
      </p>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid var(--ivica)",
        }}
      >
        <button type="button" className="dugme-tiho" onClick={naPdf}>
          📄 Sačuvaj kao PDF
        </button>
        <span className="sitni slab" style={{ marginLeft: 10 }}>
          Nalaz sa pitanjem, pravnim osnovom i mestom za potpis onoga ko
          proverava. U prozoru za štampu izaberite odredište{" "}
          <strong>Save as PDF</strong>.
        </span>
      </div>
    </article>
  );
}
