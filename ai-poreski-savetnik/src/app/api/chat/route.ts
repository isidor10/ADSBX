import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { pokreniPipeline } from "@/lib/ai/pipeline";
import { opisiGresku } from "@/lib/ai/greske";
import { PROMPT_DRUGO_MISLJENJE } from "@/lib/ai/prompts";
import { zapisiOdgovor } from "@/lib/audit";
import {
  idGosta,
  kljucKlijenta,
  ogranici,
  trenutniKorisnik,
} from "@/lib/auth";
import { proveriClanoveUTekstu } from "@/lib/ai/verifier";
import { PODRAZUMEVANI_STIL, STILOVI } from "@/lib/ai/stilovi";
import { PORUKA_PRIJAVA, stanjePristupa } from "@/lib/pristup";

export const runtime = "nodejs";
export const maxDuration = 300;

const Ulaz = z.object({
  pitanje: z.string().min(3).max(8000),
  razgovorId: z.string().optional(),
  firmaId: z.string().optional(),
  /** "drugo_misljenje" prebacuje na prompt za proveru tuđeg saveta. */
  rezim: z.enum(["standard", "drugo_misljenje"]).optional(),
  /** Stil odgovaranja. Nepoznata vrednost pada na podrazumevani, ne na grešku. */
  stil: z.enum(STILOVI).catch(PODRAZUMEVANI_STIL).optional(),
});

export async function POST(zahtev: Request) {
  // Sve je unutar try bloka, uključujući čitanje sesije i ograničavanje broja
  // zahteva. Ranije su ta dva koraka stajala izvan njega: kada bi tamo nešto
  // puklo, Next bi vratio svoju HTML stranicu greške, klijent u njoj ne bi
  // našao objašnjenje i korisnik bi dobio golo „Došlo je do greške”, bez traga
  // u odgovoru o tome šta se desilo.
  try {
    const korisnik = await trenutniKorisnik();
    // Neprijavljeni posetilac svejedno dobija svoju istoriju — vezanu za
    // pregledač, ne za nalog.
    const gost = korisnik ? null : await idGosta();

    // Svako pitanje troši API ključ vlasnika. Kada je aplikacija objavljena,
    // neprijavljen posetilac ne sme da ga troši.
    if (!korisnik && stanjePristupa() === "zatvoren") {
      return NextResponse.json({ greska: PORUKA_PRIJAVA }, { status: 401 });
    }

    const limit = ogranici(
      kljucKlijenta(zahtev, korisnik?.id),
      30,
      60 * 60 * 1000,
    );
    if (!limit.dozvoljeno) {
      return NextResponse.json(
        {
          greska:
            "Dostignut je limit od 30 pitanja na sat. Sačekajte i pokušajte ponovo.",
        },
        { status: 429 },
      );
    }

    let ulaz: z.infer<typeof Ulaz>;
    try {
      ulaz = Ulaz.parse(await zahtev.json());
    } catch {
      return NextResponse.json(
        {
          greska:
            "Neispravan zahtev. Pitanje mora imati između 3 i 8000 znakova.",
        },
        { status: 400 },
      );
    }

    // ── Profil firme ────────────────────────────────────────────────────────
    let firma = null;
    if (ulaz.firmaId && korisnik) {
      firma = await db.firma.findFirst({
        where: { id: ulaz.firmaId, korisnikId: korisnik.id },
      });
    }

    // ── Razgovor ────────────────────────────────────────────────────────────
    let razgovorId = ulaz.razgovorId;
    if (razgovorId) {
      const postojeci = await db.razgovor.findFirst({
        where: {
          id: razgovorId,
          ...(korisnik ? { korisnikId: korisnik.id } : { gostId: gost }),
        },
      });
      if (!postojeci) razgovorId = undefined;
    }
    if (!razgovorId) {
      const novi = await db.razgovor.create({
        data: {
          korisnikId: korisnik?.id ?? null,
          gostId: gost,
          firmaId: firma?.id ?? null,
          naslov: ulaz.pitanje.slice(0, 80),
        },
      });
      razgovorId = novi.id;
    }

    const istorija = await db.poruka.findMany({
      where: { razgovorId },
      orderBy: { kreirana: "asc" },
      take: 12,
      select: { uloga: true, sadrzaj: true },
    });

    await db.poruka.create({
      data: { razgovorId, uloga: "korisnik", sadrzaj: ulaz.pitanje },
    });

    // ── Glavni tok ──────────────────────────────────────────────────────────
    // Odgovor se šalje kao tok NDJSON redova umesto kao jedan JSON na kraju.
    // Razlog nije lepota nego opstanak veze: složeno pitanje sa web pretragom
    // traje minutima, a POST bez ijednog bajta u međuvremenu proxy (Codespaces,
    // Vercel, nginx) prekine — korisnik dobije „nije moguće doći do servera”
    // iako je odgovor uredno nastajao. Uz to, faze daju i vidljiv napredak.
    const kodirac = new TextEncoder();
    const konacniRazgovorId = razgovorId;

    const tok = new ReadableStream<Uint8Array>({
      async start(kontroler) {
        let zatvoren = false;
        const posalji = (dogadjaj: Record<string, unknown>) => {
          if (zatvoren) return;
          kontroler.enqueue(kodirac.encode(`${JSON.stringify(dogadjaj)}\n`));
        };

        // Puls drži vezu živom i kada jedna faza traje dugo (npr. web pretraga).
        const puls = setInterval(() => posalji({ tip: "puls" }), 10_000);

        try {
          const rezultat = await izracunaj(
            ulaz,
            firma,
            istorija,
            konacniRazgovorId,
            (tekst) => posalji({ tip: "faza", tekst }),
          );
          posalji({ tip: "gotovo", ...rezultat });
        } catch (greska) {
          console.error("[/api/chat]", greska);
          const opis = opisiGresku(greska);
          posalji({
            tip: "greska",
            greska: opis.poruka,
            ponoviti: opis.ponoviti,
          });
        } finally {
          clearInterval(puls);
          zatvoren = true;
          kontroler.close();
        }
      },
    });

    return new Response(tok, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        // Bez ovoga nginx bafferuje odgovor i puls nikad ne stigne do klijenta.
        "X-Accel-Buffering": "no",
      },
    });
  } catch (greska) {
    console.error("[/api/chat]", greska);
    const opis = opisiGresku(greska);
    return NextResponse.json(
      { greska: opis.poruka, ponoviti: opis.ponoviti },
      { status: opis.status },
    );
  }
}

type Istorija = Array<{ uloga: string; sadrzaj: string }>;

/** Sve posle pripreme razgovora — izdvojeno da tok može da ga pozove. */
async function izracunaj(
  ulaz: z.infer<typeof Ulaz>,
  firma: Awaited<ReturnType<typeof db.firma.findFirst>>,
  istorija: Istorija,
  razgovorId: string,
  naFazu: (tekst: string) => void,
) {
  const rezultat = await pokreniPipeline({
    pitanje: ulaz.pitanje,
    naFazu,
    istorija: istorija.map((p) => ({
      uloga: p.uloga as "korisnik" | "asistent",
      sadrzaj: p.sadrzaj,
    })),
    firma: firma
      ? {
          naziv: firma.naziv,
          pravnaForma: firma.pravnaForma,
          pdvStatus: firma.pdvStatus,
          pdvPeriod: firma.pdvPeriod,
          sifraDelatnosti: firma.sifraDelatnosti,
          nazivDelatnosti: firma.nazivDelatnosti,
          brojZaposlenih: firma.brojZaposlenih,
          sediste: firma.sediste,
          nacinOporezivanja: firma.nacinOporezivanja,
        }
      : undefined,
    stil: ulaz.stil ?? PODRAZUMEVANI_STIL,
    dodatniPrompt:
      ulaz.rezim === "drugo_misljenje" ? PROMPT_DRUGO_MISLJENJE : undefined,
  });

  // Poslednja provera: brojevi članova napisani u slobodnom tekstu koje ne
  // pokriva nijedan citat.
  const sumnjiviClanovi = proveriClanoveUTekstu(
    `${rezultat.odgovor.kratakOdgovor} ${rezultat.odgovor.objasnjenje}`,
    rezultat.citati,
  );
  const upozorenja = [...rezultat.dodataUpozorenja];
  if (sumnjiviClanovi.length > 0) {
    upozorenja.push(
      `U tekstu odgovora pominju se ${sumnjiviClanovi.join(", ")} bez potvrđenog izvora u pravnoj bazi. Proverite ove navode pre nego što se na njih oslonite.`,
    );
  }

  const porukaId = await zapisiOdgovor({
    razgovorId,
    pitanje: ulaz.pitanje,
    rezultat,
    tekstOdgovora: rezultat.odgovor.kratakOdgovor,
  });

  return {
    porukaId,
    razgovorId,
    odgovor: rezultat.odgovor,
    citati: rezultat.citati,
    webIzvori: rezultat.webIzvori,
    upozorenja,
    nivoPouzdanosti: rezultat.nivoPouzdanosti,
    ciljniDatum: rezultat.ciljniDatum.toISOString(),
    koriscenaWebPretraga: rezultat.koriscenaWebPretraga,
    odbacenoCitata: rezultat.odbaceniCitati.length,
    trajanjeMs: rezultat.trajanjeMs,
  };
}
