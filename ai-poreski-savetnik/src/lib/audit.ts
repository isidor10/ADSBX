/**
 * Audit trag (zahtev 33).
 *
 * Za svaki odgovor pamti se šta je pitano, koje su odredbe bile u kontekstu,
 * koje su citirane, koji su citati odbačeni i koja verzija propisa je važila.
 * Bez ovoga sistem nije upotrebljiv profesionalno — kad se za godinu dana
 * postavi pitanje „na osnovu čega je ovo rečeno", odgovor mora da postoji.
 */

import { db } from "./db";
import type { IzlazPipeline } from "./ai/pipeline";
import { MODEL } from "./ai/client";

export async function zapisiOdgovor(opcije: {
  razgovorId: string;
  pitanje: string;
  rezultat: IzlazPipeline;
  tekstOdgovora: string;
}): Promise<string> {
  const { razgovorId, pitanje, rezultat, tekstOdgovora } = opcije;

  const poruka = await db.poruka.create({
    data: {
      razgovorId,
      uloga: "asistent",
      sadrzaj: tekstOdgovora,
      strukturiraniOdgovor: JSON.stringify({
        odgovor: rezultat.odgovor,
        citati: rezultat.citati,
        webIzvori: rezultat.webIzvori,
        upozorenja: rezultat.dodataUpozorenja,
      }),
      nivoPouzdanosti: rezultat.nivoPouzdanosti,
    },
  });

  // Citati kao redovi, ne kao tekst — zato član u UI-ju ne može da bude
  // halucinacija ni posle ponovnog učitavanja razgovora.
  let redosled = 0;
  for (const c of rezultat.citati) {
    await db.citat.create({
      data: {
        porukaId: poruka.id,
        odredbaId: c.id,
        relevantnost: c.relevantnost,
        institucija: c.institucija,
        prioritet: c.prioritet,
        redosled: redosled++,
      },
    });
  }
  for (const w of rezultat.webIzvori.slice(0, 10)) {
    await db.citat.create({
      data: {
        porukaId: poruka.id,
        spoljniNaziv: w.naslov,
        spoljniUrl: w.url,
        institucija: w.institucija,
        prioritet: w.prioritet,
        redosled: redosled++,
      },
    });
  }

  await db.auditZapis.create({
    data: {
      porukaId: poruka.id,
      pitanje,
      koriscenIzvori: JSON.stringify([
        ...rezultat.citati.map((c) => ({
          tip: "ODREDBA",
          odredbaId: c.id,
          propis: c.propisPun,
          oznaka: c.oznaka,
          url: c.url,
          statusVazenja: c.status,
          vaziOd: c.vaziOd,
          vaziDo: c.vaziDo,
          verifikacija: c.verifikacija,
          pristupljeno: new Date().toISOString(),
        })),
        ...rezultat.webIzvori.map((w) => ({
          tip: "WEB",
          naziv: w.naslov,
          url: w.url,
          institucija: w.institucija,
          prioritet: w.prioritet,
          pristupljeno: new Date().toISOString(),
        })),
      ]),
      kontekstOdredbi: JSON.stringify(
        rezultat.kontekstOdredbi.map((o) => ({
          id: o.id,
          propis: o.propisSkracenica,
          clan: o.clan,
          stav: o.stav,
          skor: Number(o.skor.toFixed(3)),
        })),
      ),
      odbaceniCitati: JSON.stringify(rezultat.odbaceniCitati),
      webPretraga: rezultat.koriscenaWebPretraga,
      model: MODEL,
      ciljniDatum: rezultat.ciljniDatum,
      trajanjeMs: rezultat.trajanjeMs,
    },
  });

  // Pitanje bez pravnog osnova je ulaz za dopunu baze, ne tiha greška.
  if (rezultat.citati.length === 0) {
    const postojece = await db.neodgovorenoPitanje.findFirst({
      where: { pitanje },
    });
    if (postojece) {
      await db.neodgovorenoPitanje.update({
        where: { id: postojece.id },
        data: { brojPuta: { increment: 1 }, poslednji: new Date() },
      });
    } else {
      await db.neodgovorenoPitanje.create({
        data: {
          pitanje,
          razlog:
            rezultat.kontekstOdredbi.length === 0
              ? "Nema pronađenih odredbi u pravnoj bazi"
              : "Model nije mogao da veže odgovor za pronađene odredbe",
          oblast: rezultat.oblasti[0] ?? null,
        },
      });
    }
  }

  return poruka.id;
}
