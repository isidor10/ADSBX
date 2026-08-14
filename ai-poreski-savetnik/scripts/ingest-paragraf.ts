/**
 * Lični ingest sa Paragraf Lex-a — SAMO za lokalnu bazu jednog korisnika.
 *
 * Pokretanje:
 *   npm run ingest:paragraf                 — svi propisi čiji izvor je Paragraf
 *   npm run ingest:paragraf -- --propis=ZOR — samo jedan
 *   npm run ingest:paragraf -- --ocisti     — briše sve što je ovaj skript upisao
 *
 * ── Zašto je ovo odvojena skripta, a ne opcija u `ingest-propise.ts` ────────
 *
 * Paragraf Lex je pretplata koja se plaća po nalogu. Tekst zakona sam po sebi
 * nije predmet autorskog prava, ali prečišćeni tekstovi, komentari i baza kao
 * celina jesu njihov rad, a uslovi korišćenja zabranjuju automatski pristup.
 * Sve to je podnošljivo dok jedan pretplatnik puni sopstvenu bazu za sopstvenu
 * upotrebu; postaje nešto sasvim drugo čim se isti sadržaj posluži drugima.
 *
 * Zato ova skripta ima dve tvrde ograde koje se ne mogu zaobići zaboravom:
 *
 *   1. Odbija da radi ako DATABASE_URL nije lokalni SQLite fajl. Nad
 *      produkcijskim Postgresom se neće pokrenuti ni slučajno ni namerno.
 *   2. Piše isključivo u bazu, nikada u `src/data/seed/*`. Seed fajlovi su
 *      jedino što odlazi na Vercel, pa ono što ovde uđe ne može da procuri
 *      kroz git u deployovanu aplikaciju.
 *
 * Uz to vodi spisak svega što je upisala (`.paragraf-ingest.json`, van gita),
 * pa `--ocisti` vraća bazu u stanje pre ingesta jednom komandom. To nije
 * uredno vođenje evidencije radi urednosti — to je izlaz ako se ispostavi da
 * licenca ne dođe.
 *
 * ── Zašto pravi pregledač, a ne fetch ───────────────────────────────────────
 *
 * Prijava na Paragraf ide kroz formu sa kolačićima i verovatno CSRF tokenom.
 * Pogađanje imena polja i endpointa iz koda koji ne mogu da probam bilo bi
 * nagađanje; pravi pregledač te stvari rešava sam. Skripta zato traži formu po
 * obliku (polje za lozinku, pa najbliže tekstualno polje iznad njega), a ne po
 * imenima klasa koja se menjaju sa svakim redizajnom.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { chromium, type Browser, type Page } from "playwright";
import { hash, parsirajClanove, uCistTekst } from "./lib/parser-propisa";

const db = new PrismaClient();

const SPISAK = ".paragraf-ingest.json";
const PRIJAVA = "https://www.paragraf.rs/login.html";
/** Pauza između stranica — pretplata nije razlog da se izvor gnjavi. */
const PAUZA_MS = 2500;

interface Spisak {
  odredbe: string[];
  poslednjiPut: string;
}

function ucitajSpisak(): Spisak {
  if (!existsSync(SPISAK)) return { odredbe: [], poslednjiPut: "" };
  try {
    return JSON.parse(readFileSync(SPISAK, "utf8")) as Spisak;
  } catch {
    return { odredbe: [], poslednjiPut: "" };
  }
}

function sacuvajSpisak(s: Spisak): void {
  writeFileSync(SPISAK, JSON.stringify(s, null, 2), "utf8");
}

/**
 * Prva ograda: samo lokalni SQLite.
 *
 * Provera je namerno gruba — sve što nije `file:` odbija se bez rasprave.
 * Bolje da skripta odbije da radi u nekom neočekivanom ali bezopasnom slučaju
 * nego da jednom prođe tamo gde ne sme.
 */
function proveriDaJeLokalnaBaza(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) {
    console.error(
      [
        "",
        "ZAUSTAVLJENO: ovo nije lokalna baza.",
        "",
        `DATABASE_URL počinje sa "${url.slice(0, 12)}…", a ova skripta radi`,
        "isključivo nad lokalnim SQLite fajlom (file:…).",
        "",
        "Sadržaj sa Paragrafa sme da stoji samo u vašoj ličnoj bazi, dok je",
        "koristite sami. Nad produkcijskom bazom koju čitaju drugi korisnici",
        "to bi bilo posluživanje tuđeg sadržaja trećim licima.",
        "",
        "Za produkciju koristite: npm run ingest  (zvanični, besplatni izvori)",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}

function proveriPristupnePodatke(): { korisnik: string; lozinka: string } {
  const korisnik = process.env.PARAGRAF_KORISNIK ?? "";
  const lozinka = process.env.PARAGRAF_LOZINKA ?? "";
  if (!korisnik || !lozinka) {
    console.error(
      [
        "",
        "Nedostaju podaci za prijavu na Paragraf.",
        "",
        "U fajl .env (koji .gitignore već isključuje iz repozitorijuma) upišite:",
        "",
        "  PARAGRAF_KORISNIK=vas.email@primer.rs",
        "  PARAGRAF_LOZINKA=vasa-lozinka",
        "",
        "Ti podaci ostaju na vašem računaru. Ne odlaze ni u git ni na Vercel.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
  return { korisnik, lozinka };
}

/**
 * Prijava kroz formu koja se traži po obliku, ne po imenima polja.
 *
 * Vraća true samo ako je posle slanja forme polje za lozinku nestalo sa
 * stranice. To je jedini pouzdan znak koji ne zavisi od toga kako izgleda
 * njihov interfejs: dok god se vidi polje za lozinku, prijava nije prošla.
 */
async function prijaviSe(
  stranica: Page,
  korisnik: string,
  lozinka: string,
): Promise<boolean> {
  await stranica.goto(PRIJAVA, { waitUntil: "domcontentloaded" });

  const poljeLozinke = stranica.locator('input[type="password"]').first();
  if ((await poljeLozinke.count()) === 0) {
    console.error("    ! Na stranici za prijavu nema polja za lozinku.");
    return false;
  }

  // Korisničko ime je po pravilu polje neposredno pre lozinke.
  const poljeKorisnika = stranica
    .locator('input[type="text"], input[type="email"], input:not([type])')
    .first();
  if ((await poljeKorisnika.count()) === 0) {
    console.error("    ! Nije pronađeno polje za korisničko ime.");
    return false;
  }

  await poljeKorisnika.fill(korisnik);
  await poljeLozinke.fill(lozinka);
  await poljeLozinke.press("Enter");

  await stranica
    .waitForLoadState("networkidle", { timeout: 30_000 })
    .catch(() => {});

  const josTraziLozinku =
    (await stranica.locator('input[type="password"]').count()) > 0;
  return !josTraziLozinku;
}

async function preuzmiTekst(
  stranica: Page,
  url: string,
): Promise<string | null> {
  try {
    const odgovor = await stranica.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    if (odgovor && odgovor.status() >= 400) {
      console.log(`    ! HTTP ${odgovor.status()}`);
      return null;
    }
    await stranica.waitForTimeout(900);
    return await stranica.content();
  } catch (greska) {
    console.log(
      `    ! Dohvat nije uspeo: ${greska instanceof Error ? greska.message : String(greska)}`,
    );
    return null;
  }
}

async function ocisti(): Promise<void> {
  const spisak = ucitajSpisak();
  if (spisak.odredbe.length === 0) {
    console.log("\nNema zapisa iz ličnog ingesta — baza je već čista.\n");
    return;
  }
  const rezultat = await db.odredba.deleteMany({
    where: { id: { in: spisak.odredbe } },
  });
  sacuvajSpisak({ odredbe: [], poslednjiPut: "" });
  console.log(
    `\nUklonjeno ${rezultat.count} odredbi koje je upisao lični ingest.`,
  );
  console.log(
    "Odredbe iz seed-a nisu dirane, kao ni istorija razgovora (citati ostaju bez veze).\n",
  );
}

async function main() {
  proveriDaJeLokalnaBaza();

  if (process.argv.includes("--ocisti")) {
    await ocisti();
    return;
  }

  const { korisnik, lozinka } = proveriPristupnePodatke();
  const samoPropis = process.argv
    .find((a) => a.startsWith("--propis="))
    ?.split("=")[1];

  const propisi = await db.propis.findMany({
    where: {
      izvorUrl: { contains: "paragraf.rs" },
      ...(samoPropis ? { skracenica: samoPropis } : {}),
    },
    orderBy: { skracenica: "asc" },
  });

  if (propisi.length === 0) {
    console.log("\nNema propisa čiji je izvor Paragraf. Nema šta da se radi.\n");
    return;
  }

  console.log(`\nLični ingest sa Paragrafa — ${propisi.length} propisa`);
  console.log("Baza: lokalni SQLite. Sadržaj ne odlazi u git ni na Vercel.\n");

  let pregledac: Browser | null = null;
  const spisak = ucitajSpisak();
  let noveOdredbe = 0;
  let azurirane = 0;
  let neuspesno = 0;

  try {
    pregledac = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
    });
    const kontekst = await pregledac.newContext();
    const stranica = await kontekst.newPage();

    process.stdout.write("  Prijava… ");
    if (!(await prijaviSe(stranica, korisnik, lozinka))) {
      console.error(
        [
          "neuspešna.",
          "",
          "Prijava nije prošla. Mogući razlozi: pogrešni podaci, dvofaktorska",
          "potvrda, ili je stranica za prijavu promenjena.",
          "",
          "Ništa nije upisano u bazu.",
          "",
        ].join("\n"),
      );
      process.exit(1);
    }
    console.log("uspešna.\n");

    for (const propis of propisi) {
      console.log(`  ${propis.skracenica} — ${propis.naziv.slice(0, 58)}`);

      const html = await preuzmiTekst(stranica, propis.izvorUrl);
      await stranica.waitForTimeout(PAUZA_MS);

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

          const podaci = {
            naslov: clan.naslov ?? postojeca?.naslov ?? null,
            tekst: stav.tekst,
            hash: noviHash,
            doslovanTekst: true,
            potvrdjenBrojClana: true,
            izvorUrl: propis.izvorUrl,
          };

          if (postojeca) {
            await db.odredba.update({
              where: { id: postojeca.id },
              data: podaci,
            });
            azurirane++;
            // Odredba koja je postojala pre ingesta ostaje i posle čišćenja —
            // u spisak ide samo ono što je ovaj skript stvorio.
          } else {
            const nova = await db.odredba.create({
              data: {
                propisId: propis.id,
                clan: clan.clan,
                stav: stav.stav,
                vaziOd: propis.datumStupanjaNaSnagu ?? new Date("2000-01-01"),
                vaziDo: propis.datumPrestankaVazenja,
                ...podaci,
              },
            });
            spisak.odredbe.push(nova.id);
            noveOdredbe++;
          }
        }
      }
    }

    spisak.poslednjiPut = new Date().toISOString();
    sacuvajSpisak(spisak);
  } finally {
    await pregledac?.close();
  }

  console.log("\n─────────────────────────────────────────────");
  console.log(`Novih odredbi:      ${noveOdredbe}`);
  console.log(`Ažuriranih odredbi: ${azurirane}`);
  console.log(`Nije obrađeno:      ${neuspesno}`);
  console.log("─────────────────────────────────────────────");
  console.log(
    "\nSve upisano stoji SAMO u lokalnoj bazi. Za povratak na pređašnje stanje:",
  );
  console.log("  npm run ingest:paragraf -- --ocisti\n");
  console.log("Sledeći korak: npm run index  (izgradnja semantičkog indeksa)\n");
}

main()
  .catch((g) => {
    console.error("Greška pri ličnom ingestu:", g);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
