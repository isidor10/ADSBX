import { NextResponse } from "next/server";
import { PORUKA_PRIJAVA, stanjePristupa } from "@/lib/pristup";
import { db } from "@/lib/db";
import { pokreniPipeline } from "@/lib/ai/pipeline";
import { PROMPT_ANALIZE_DOKUMENTA } from "@/lib/ai/prompts";
import { opisiGresku } from "@/lib/ai/greske";
import { kljucKlijenta, ogranici, trenutniKorisnik } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const DOZVOLJENI_TIPOVI = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
]);

function maksVelicina(): number {
  return Number(process.env.MAX_UPLOAD_MB ?? "20") * 1024 * 1024;
}

/** Izvlačenje teksta iz dokumenta. PDF ide direktno modelu kao dokument. */
async function izvuciTekst(
  bafer: Buffer,
  mimeTip: string,
  imeFajla: string,
): Promise<{ tekst: string | null; direktnoModelu: boolean }> {
  if (mimeTip === "application/pdf") {
    // PDF šaljemo modelu kao document blok — bolje čita tabele i raspored
    // nego bilo koje izvlačenje teksta u ovom sloju.
    return { tekst: null, direktnoModelu: true };
  }

  if (mimeTip.startsWith("image/")) {
    return { tekst: null, direktnoModelu: true };
  }

  if (
    mimeTip ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    imeFajla.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const rezultat = await mammoth.extractRawText({ buffer: bafer });
    return { tekst: rezultat.value, direktnoModelu: false };
  }

  if (
    mimeTip.includes("spreadsheet") ||
    mimeTip === "application/vnd.ms-excel" ||
    imeFajla.endsWith(".xlsx") ||
    imeFajla.endsWith(".xls")
  ) {
    const XLSX = await import("xlsx");
    const radnaKnjiga = XLSX.read(bafer, { type: "buffer" });
    const delovi: string[] = [];
    for (const naziv of radnaKnjiga.SheetNames) {
      delovi.push(`--- List: ${naziv} ---`);
      delovi.push(XLSX.utils.sheet_to_csv(radnaKnjiga.Sheets[naziv]));
    }
    return { tekst: delovi.join("\n"), direktnoModelu: false };
  }

  return {
    tekst: bafer.toString("utf-8").slice(0, 200_000),
    direktnoModelu: false,
  };
}

export async function POST(zahtev: Request) {
  const korisnik = await trenutniKorisnik();

  // Isto pravilo kao za razgovor: analiza dokumenta troši API ključ vlasnika.
  if (!korisnik && stanjePristupa() === "zatvoren") {
    return NextResponse.json({ greska: PORUKA_PRIJAVA }, { status: 401 });
  }

  const limit = ogranici(
    `dok:${kljucKlijenta(zahtev, korisnik?.id)}`,
    10,
    60 * 60 * 1000,
  );
  if (!limit.dozvoljeno) {
    return NextResponse.json(
      { greska: "Dostignut je limit broja analiza dokumenata za ovaj sat." },
      { status: 429 },
    );
  }

  let forma: FormData;
  try {
    forma = await zahtev.formData();
  } catch {
    return NextResponse.json(
      { greska: "Očekuje se multipart/form-data sa poljem 'fajl'." },
      { status: 400 },
    );
  }

  const fajl = forma.get("fajl");
  const pitanje = (forma.get("pitanje") as string | null)?.trim();

  if (!(fajl instanceof File)) {
    return NextResponse.json({ greska: "Nedostaje fajl." }, { status: 400 });
  }
  if (fajl.size > maksVelicina()) {
    return NextResponse.json(
      {
        greska: `Fajl je veći od dozvoljenih ${process.env.MAX_UPLOAD_MB ?? 20} MB.`,
      },
      { status: 413 },
    );
  }
  if (!DOZVOLJENI_TIPOVI.has(fajl.type) && fajl.type !== "") {
    return NextResponse.json(
      {
        greska: `Tip fajla "${fajl.type}" nije podržan. Podržani su PDF, Word, Excel, CSV, tekst i slike.`,
      },
      { status: 415 },
    );
  }

  try {
    const bafer = Buffer.from(await fajl.arrayBuffer());
    const { tekst, direktnoModelu } = await izvuciTekst(
      bafer,
      fajl.type,
      fajl.name,
    );

    const dokument = await db.dokument.create({
      data: {
        korisnikId: korisnik?.id ?? null,
        imeFajla: fajl.name,
        mimeTip: fajl.type || "application/octet-stream",
        velicina: fajl.size,
        izvuceniTekst: tekst?.slice(0, 500_000) ?? null,
      },
    });

    // PDF i slike model čita direktno; za ostalo šaljemo izvučen tekst.
    const opisZaAnalizu = direktnoModelu
      ? `Korisnik je otpremio dokument "${fajl.name}" (${fajl.type}). Sadržaj dokumenta nije mogao da se izvuče u ovom sloju, pa analiziraj na osnovu naziva i onoga što korisnik navede. Ako nemaš dovoljno podataka, jasno to reci umesto da pretpostavljaš.`
      : `Sadržaj dokumenta "${fajl.name}":\n\n${(tekst ?? "").slice(0, 60_000)}`;

    const rezultat = await pokreniPipeline({
      pitanje: [
        opisZaAnalizu,
        "",
        pitanje
          ? `Dodatno pitanje korisnika: ${pitanje}`
          : "Analiziraj dokument prema uputstvu.",
      ].join("\n"),
      dodatniPrompt: PROMPT_ANALIZE_DOKUMENTA,
    });

    await db.analizaDokumenta.create({
      data: {
        dokumentId: dokument.id,
        vrstaDokumenta: "NEPOZNATO",
        rezultat: JSON.stringify({
          odgovor: rezultat.odgovor,
          citati: rezultat.citati,
          upozorenja: rezultat.dodataUpozorenja,
        }),
        nivoPouzdanosti: rezultat.nivoPouzdanosti,
      },
    });

    return NextResponse.json({
      dokumentId: dokument.id,
      imeFajla: fajl.name,
      odgovor: rezultat.odgovor,
      citati: rezultat.citati,
      webIzvori: rezultat.webIzvori,
      upozorenja: [
        ...rezultat.dodataUpozorenja,
        "Analiza dokumenta ne predstavlja potvrdu njegove pravne ispravnosti. Za takvu ocenu potreban je uvid u celokupnu dokumentaciju i okolnosti posla.",
      ],
      nivoPouzdanosti: rezultat.nivoPouzdanosti,
    });
  } catch (greska) {
    console.error("[/api/dokumenti]", greska);
    const opis = opisiGresku(greska);
    return NextResponse.json(
      { greska: opis.poruka, ponoviti: opis.ponoviti },
      { status: opis.status },
    );
  }
}
