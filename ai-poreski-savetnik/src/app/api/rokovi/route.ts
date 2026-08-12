import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trenutniKorisnik } from "@/lib/auth";

export const runtime = "nodejs";

const MESECI = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];

/**
 * Rokovi za zadati mesec, filtrirani prema profilu firme.
 * ?mesec=1-12 &godina=YYYY &firmaId=…
 */
export async function GET(zahtev: Request) {
  const url = new URL(zahtev.url);
  const sada = new Date();
  const mesec = Number(url.searchParams.get("mesec") ?? sada.getUTCMonth() + 1);
  const godina = Number(url.searchParams.get("godina") ?? sada.getUTCFullYear());
  const firmaId = url.searchParams.get("firmaId");

  if (!Number.isInteger(mesec) || mesec < 1 || mesec > 12) {
    return NextResponse.json({ greska: "Neispravan mesec." }, { status: 400 });
  }

  const korisnik = await trenutniKorisnik();
  let firma = null;
  if (firmaId && korisnik) {
    firma = await db.firma.findFirst({
      where: { id: firmaId, korisnikId: korisnik.id },
    });
  }

  const svi = await db.rok.findMany({
    include: { propis: { select: { naziv: true, skracenica: true } } },
  });

  const primenjivi = svi.filter((r) => {
    // Filtriranje po pravnoj formi iz profila firme.
    if (firma) {
      const vrste = JSON.parse(r.vrsteObveznika) as string[];
      if (vrste.length > 0 && !vrste.includes(firma.pravnaForma)) return false;
      // Rokovi vezani za PDV se ne prikazuju firmi van sistema PDV-a.
      if (r.uslov === "pdvObveznik" && firma.pdvStatus === "VAN_SISTEMA") {
        return false;
      }
    }
    // Filtriranje po mesecu.
    if (r.ponavljanje === "MESECNO") return true;
    if (r.ponavljanje === "KVARTALNO") return [1, 4, 7, 10].includes(mesec);
    if (r.ponavljanje === "GODISNJE") return r.mesec === mesec;
    return false;
  });

  const stavke = primenjivi
    .map((r) => {
      const dan = Math.min(
        r.danUMesecu ?? 1,
        new Date(Date.UTC(godina, mesec, 0)).getUTCDate(),
      );
      return {
        id: r.id,
        naziv: r.naziv,
        opis: r.opis,
        datum: new Date(Date.UTC(godina, mesec - 1, dan)).toISOString(),
        dan,
        ponavljanje: r.ponavljanje,
        obrazac: r.obrazac,
        propis: r.propis?.naziv ?? null,
        izvorUrl: r.izvorUrl,
        verifikacija: r.verifikacija,
        vrsteObveznika: JSON.parse(r.vrsteObveznika) as string[],
      };
    })
    .sort((a, b) => a.dan - b.dan);

  const nepotvrdjeni = stavke.filter((s) => s.verifikacija !== "POTVRDJENO");

  return NextResponse.json({
    mesec,
    godina,
    nazivMeseca: MESECI[mesec - 1],
    filtriranoZaFirmu: firma
      ? { naziv: firma.naziv, pravnaForma: firma.pravnaForma, pdvStatus: firma.pdvStatus }
      : null,
    rokovi: stavke,
    upozorenje:
      nepotvrdjeni.length > 0
        ? `${nepotvrdjeni.length} od ${stavke.length} prikazanih rokova nije potvrđeno prema zvaničnom poreskom kalendaru. Obavezno proverite datume na portalu Poreske uprave pre nego što se na njih oslonite.`
        : null,
  });
}
