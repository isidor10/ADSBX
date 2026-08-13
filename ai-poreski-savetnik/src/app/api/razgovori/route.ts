/**
 * Istorija razgovora.
 *
 * Bez `id` vraća spisak razgovora, sa `id` ceo razgovor sa odgovorima.
 *
 * Odgovori se ne sastavljaju ponovo — čitaju se iz `strukturiraniOdgovor`,
 * onakvi kakvi su bili kad su dati. To je i smisao istorije: ako se u
 * međuvremenu propis promenio, stari nalaz mora da ostane onakav kakav je
 * poslat računovođi, a ne da se tiho preračuna po novom stanju.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { idGostaBezStvaranja, trenutniKorisnik } from "@/lib/auth";

export const runtime = "nodejs";

/** Uslov koji razgovor vezuje za onoga ko gleda — nalog ili pregledač. */
async function ciji() {
  const korisnik = await trenutniKorisnik();
  if (korisnik) return { korisnikId: korisnik.id };

  const gost = await idGostaBezStvaranja();
  // Bez kolačića nema ni istorije. Vraćamo uslov koji ništa ne pogađa umesto
  // da izostavimo filter — inače bi posetilac bez kolačića video sve tuđe.
  return gost ? { gostId: gost } : { id: "__nema__" };
}

export async function GET(zahtev: Request) {
  try {
    const uslov = await ciji();
    const id = new URL(zahtev.url).searchParams.get("id");

    if (!id) {
      const razgovori = await db.razgovor.findMany({
        where: uslov,
        orderBy: { azuriran: "desc" },
        take: 100,
        select: {
          id: true,
          naslov: true,
          kreiran: true,
          azuriran: true,
          _count: { select: { poruke: true } },
          poruke: {
            where: { uloga: "asistent" },
            orderBy: { kreirana: "desc" },
            take: 1,
            select: { nivoPouzdanosti: true, sadrzaj: true },
          },
        },
      });

      return NextResponse.json({
        razgovori: razgovori.map((r) => ({
          id: r.id,
          naslov: r.naslov,
          kreiran: r.kreiran.toISOString(),
          azuriran: r.azuriran.toISOString(),
          brojPoruka: r._count.poruke,
          nivoPouzdanosti: r.poruke[0]?.nivoPouzdanosti ?? null,
          izvod: r.poruke[0]?.sadrzaj ?? null,
        })),
      });
    }

    const razgovor = await db.razgovor.findFirst({
      where: { id, ...uslov },
      select: {
        id: true,
        naslov: true,
        kreiran: true,
        poruke: {
          orderBy: { kreirana: "asc" },
          select: {
            id: true,
            uloga: true,
            sadrzaj: true,
            strukturiraniOdgovor: true,
            kreirana: true,
          },
        },
      },
    });

    if (!razgovor) {
      return NextResponse.json(
        { greska: "Razgovor nije pronađen ili vam nije dostupan." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      razgovor: {
        id: razgovor.id,
        naslov: razgovor.naslov,
        kreiran: razgovor.kreiran.toISOString(),
        poruke: razgovor.poruke.map((p) => {
          if (p.uloga === "korisnik") {
            return { uloga: "korisnik", tekst: p.sadrzaj };
          }
          // Zapis koji se ne da pročitati ne sme da obori celu istoriju —
          // prikazuje se bar sažetak koji je sačuvan kao običan tekst.
          try {
            const s = JSON.parse(p.strukturiraniOdgovor ?? "{}");
            return {
              uloga: "asistent",
              odgovor: s.odgovor,
              citati: s.citati ?? [],
              webIzvori: s.webIzvori ?? [],
              upozorenja: s.upozorenja ?? [],
              ciljniDatum: p.kreirana.toISOString(),
            };
          } catch {
            return {
              uloga: "asistent",
              greska: `Sačuvani odgovor nije moguće prikazati u celini. Sažetak: ${p.sadrzaj}`,
            };
          }
        }),
      },
    });
  } catch (greska) {
    console.error("[/api/razgovori]", greska);
    return NextResponse.json(
      { greska: "Nije moguće učitati istoriju." },
      { status: 500 },
    );
  }
}

/** Brisanje jednog razgovora iz istorije. */
export async function DELETE(zahtev: Request) {
  try {
    const uslov = await ciji();
    const id = new URL(zahtev.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ greska: "Nedostaje id." }, { status: 400 });
    }

    // Brisanje ide kroz `deleteMany` sa istim uslovom vlasništva: tako tuđi
    // razgovor ne može da se obriše ni slučajno ni namerno.
    const { count } = await db.razgovor.deleteMany({ where: { id, ...uslov } });
    if (count === 0) {
      return NextResponse.json(
        { greska: "Razgovor nije pronađen ili vam nije dostupan." },
        { status: 404 },
      );
    }
    return NextResponse.json({ obrisano: count });
  } catch (greska) {
    console.error("[/api/razgovori DELETE]", greska);
    return NextResponse.json(
      { greska: "Brisanje nije uspelo." },
      { status: 500 },
    );
  }
}
