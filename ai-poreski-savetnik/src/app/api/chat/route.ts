import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { pokreniPipeline } from "@/lib/ai/pipeline";
import { opisiGresku } from "@/lib/ai/greske";
import { PROMPT_DRUGO_MISLJENJE } from "@/lib/ai/prompts";
import { zapisiOdgovor } from "@/lib/audit";
import { kljucKlijenta, ogranici, trenutniKorisnik } from "@/lib/auth";
import { proveriClanoveUTekstu } from "@/lib/ai/verifier";

export const runtime = "nodejs";
export const maxDuration = 300;

const Ulaz = z.object({
  pitanje: z.string().min(3).max(8000),
  razgovorId: z.string().optional(),
  firmaId: z.string().optional(),
  /** "drugo_misljenje" prebacuje na prompt za proveru tuđeg saveta. */
  rezim: z.enum(["standard", "drugo_misljenje"]).optional(),
});

export async function POST(zahtev: Request) {
  const korisnik = await trenutniKorisnik();

  const limit = ogranici(kljucKlijenta(zahtev, korisnik?.id), 30, 60 * 60 * 1000);
  if (!limit.dozvoljeno) {
    return NextResponse.json(
      {
        greska:
          "Dostignut je limit broja pitanja. Pokušajte ponovo za nekoliko minuta.",
      },
      { status: 429 },
    );
  }

  let ulaz: z.infer<typeof Ulaz>;
  try {
    ulaz = Ulaz.parse(await zahtev.json());
  } catch {
    return NextResponse.json(
      { greska: "Neispravan zahtev. Pitanje mora imati između 3 i 8000 znakova." },
      { status: 400 },
    );
  }

  try {
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
          ...(korisnik ? { korisnikId: korisnik.id } : { korisnikId: null }),
        },
      });
      if (!postojeci) razgovorId = undefined;
    }
    if (!razgovorId) {
      const novi = await db.razgovor.create({
        data: {
          korisnikId: korisnik?.id ?? null,
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
    const rezultat = await pokreniPipeline({
      pitanje: ulaz.pitanje,
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

    return NextResponse.json({
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
