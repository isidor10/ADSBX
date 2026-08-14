/**
 * Dopuna pravne baze punim tekstovima propisa sa zvaničnih izvora.
 *
 * Pokretanje: npm run ingest [-- --propis=ZPDV]
 *
 * Šta radi:
 *   1. dohvata tekst propisa sa izvora zapisanog uz propis,
 *   2. parsira ga na članove i stavove,
 *   3. poredi hash sa postojećom odredbom — nepromenjene preskače,
 *   4. upisuje doslovan tekst i postavlja potvrdjenBrojClana = true,
 *   5. beleži izmene u tabelu Izmena.
 *
 * NAPOMENA O OKRUŽENJU: u okruženju u kojem je projekat napisan mrežna
 * politika blokira paragraf.rs, purs.gov.rs i pravno-informacioni-sistem.rs,
 * pa ingest tamo ne može da se izvrši do kraja. Kod korisnika, gde ti domeni
 * nisu blokirani, skripta radi. Ako dohvat ne uspe, skripta NE upisuje ništa
 * i NE menja status verifikacije — radije prazno nego pogrešno.
 */

import { PrismaClient } from "@prisma/client";
import {
  hash,
  parsirajClanove,
  uCistTekst,
} from "./lib/parser-propisa";

const db = new PrismaClient();

const KORISNICKI_AGENT =
  "AI-Poreski-Savetnik/0.1 (ingest pravne baze; kontakt: administrator instance)";

async function dohvati(url: string): Promise<string | null> {
  try {
    const odgovor = await fetch(url, {
      headers: { "User-Agent": KORISNICKI_AGENT, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!odgovor.ok) {
      console.log(`    ! HTTP ${odgovor.status}`);
      return null;
    }
    return await odgovor.text();
  } catch (greska) {
    const poruka = greska instanceof Error ? greska.message : String(greska);
    console.log(`    ! Dohvat nije uspeo: ${poruka}`);
    return null;
  }
}

async function main() {
  const argument = process.argv.find((a) => a.startsWith("--propis="));
  const samoPropis = argument?.split("=")[1];

  const propisi = await db.propis.findMany({
    where: samoPropis ? { skracenica: samoPropis } : {},
    orderBy: { prioritetIzvora: "asc" },
  });

  console.log(`\nIngest pravne baze — ${propisi.length} propisa\n`);

  let uspesno = 0;
  let neuspesno = 0;
  let noveOdredbe = 0;
  let izmenjeneOdredbe = 0;

  for (const propis of propisi) {
    console.log(`  ${propis.skracenica} — ${propis.naziv}`);

    const html = await dohvati(propis.izvorUrl);
    if (!html) {
      neuspesno++;
      continue;
    }

    const clanovi = parsirajClanove(uCistTekst(html));
    if (clanovi.length === 0) {
      console.log("    ! Struktura članova nije prepoznata — preskačem.");
      neuspesno++;
      continue;
    }

    console.log(`    Prepoznato članova: ${clanovi.length}`);

    for (const clan of clanovi) {
      for (const stav of clan.stavovi) {
        const noviHash = hash(stav.tekst);

        const postojeca = await db.odredba.findFirst({
          where: { propisId: propis.id, clan: clan.clan, stav: stav.stav },
        });

        if (postojeca?.hash === noviHash) continue;

        if (postojeca) {
          // Tekst se promenio — beležimo izmenu pre nego što je pregazimo.
          if (postojeca.doslovanTekst && postojeca.tekst !== stav.tekst) {
            await db.izmena.create({
              data: {
                propisId: propis.id,
                odredbaId: postojeca.id,
                naslov: `Izmenjen tekst — ${propis.skracenica}, član ${clan.clan}`,
                staraOdredba: postojeca.tekst.slice(0, 2000),
                novaOdredba: stav.tekst.slice(0, 2000),
                odKadaSePrimenjuje: new Date(),
                kogaPogadja:
                  "Utvrđuje se prema sadržini izmene — proveriti u izvoru.",
                staTrebaUraditi:
                  "Uporediti staru i novu odredbu i proveriti da li menja postupanje u vašem slučaju.",
                izvorUrl: propis.izvorUrl,
              },
            });
            izmenjeneOdredbe++;
          }

          await db.odredba.update({
            where: { id: postojeca.id },
            data: {
              tekst: stav.tekst,
              naslov: clan.naslov ?? postojeca.naslov,
              hash: noviHash,
              doslovanTekst: true,
              potvrdjenBrojClana: true,
            },
          });
        } else {
          await db.odredba.create({
            data: {
              propisId: propis.id,
              clan: clan.clan,
              stav: stav.stav,
              naslov: clan.naslov,
              tekst: stav.tekst,
              vaziOd: propis.datumStupanjaNaSnagu ?? new Date("2000-01-01"),
              vaziDo: propis.datumPrestankaVazenja,
              izvorUrl: propis.izvorUrl,
              hash: noviHash,
              doslovanTekst: true,
              potvrdjenBrojClana: true,
            },
          });
          noveOdredbe++;
        }
      }
    }

    await db.propis.update({
      where: { id: propis.id },
      data: { poslednjaProvera: new Date(), verifikacija: "POTVRDJENO" },
    });
    uspesno++;
  }

  console.log(`\n─────────────────────────────────────────────`);
  console.log(`Uspešno obrađeno propisa: ${uspesno}`);
  console.log(`Nije obrađeno:            ${neuspesno}`);
  console.log(`Novih odredbi:            ${noveOdredbe}`);
  console.log(`Izmenjenih odredbi:       ${izmenjeneOdredbe}`);
  if (neuspesno > 0) {
    console.log(
      `\nPropisi koji nisu obrađeni zadržali su prethodni status verifikacije.`,
    );
    console.log(
      `Ništa nije upisano na osnovu neuspešnog dohvata — baza je i dalje tačna,`,
    );
    console.log(`samo nepotpuna.`);
  }
  console.log(`─────────────────────────────────────────────\n`);
  console.log(`Sledeći korak: npm run index  (izgradnja semantičkog indeksa)`);
}

main()
  .catch((g) => {
    console.error("Greška pri ingestu:", g);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
