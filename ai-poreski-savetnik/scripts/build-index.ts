/**
 * Izgradnja semantičkog indeksa nad odredbama.
 *
 * Pokretanje: npm run index
 *
 * Ako EMBEDDINGS_PROVIDER nije podešen, skripta to jasno kaže i izlazi bez
 * greške — sistem i dalje radi leksičkom pretragom.
 */

import { PrismaClient } from "@prisma/client";
import {
  aktivniProvider,
  izracunajEmbeddinge,
  nazivModela,
} from "../src/lib/legal/embeddings";

const db = new PrismaClient();
const VELICINA_GRUPE = 32;

async function main() {
  const provider = aktivniProvider();

  if (provider === "none") {
    console.log(
      "\nEMBEDDINGS_PROVIDER nije podešen (ili nedostaje API ključ).\n" +
        "Semantička pretraga je isključena; sistem koristi leksičku (BM25) pretragu.\n" +
        "Da uključite semantiku, podesite u .env:\n" +
        "  EMBEDDINGS_PROVIDER=voyage  i  VOYAGE_API_KEY=…\n" +
        "  ili\n" +
        "  EMBEDDINGS_PROVIDER=openai  i  OPENAI_API_KEY=…\n",
    );
    return;
  }

  const model = nazivModela();
  console.log(`\nIzgradnja semantičkog indeksa (${provider}, model ${model})\n`);

  const odredbe = await db.odredba.findMany({
    include: {
      vektor: { select: { model: true } },
      propis: { select: { naziv: true, skracenica: true } },
    },
  });

  // Preskačemo odredbe koje već imaju vektor iz istog modela.
  const zaObradu = odredbe.filter((o) => o.vektor?.model !== model);
  console.log(
    `  Odredbi ukupno: ${odredbe.length}, za obradu: ${zaObradu.length}\n`,
  );

  if (zaObradu.length === 0) {
    console.log("  Indeks je već aktuelan.\n");
    return;
  }

  let obradjeno = 0;
  for (let i = 0; i < zaObradu.length; i += VELICINA_GRUPE) {
    const grupa = zaObradu.slice(i, i + VELICINA_GRUPE);

    // Naziv propisa i naslov člana idu u tekst za embedding — bez toga
    // odredba izvučena iz konteksta gubi vezu sa propisom kom pripada.
    const tekstovi = grupa.map((o) =>
      [
        o.propis.naziv,
        o.naslov ?? "",
        `Član ${o.clan}${o.stav ? `, stav ${o.stav}` : ""}`,
        o.tekst,
      ]
        .filter(Boolean)
        .join("\n"),
    );

    const vektori = await izracunajEmbeddinge(tekstovi);
    if (!vektori) {
      console.error("  Provider nije vratio vektore — prekidam.");
      break;
    }

    for (let j = 0; j < grupa.length; j++) {
      await db.odredbaVektor.upsert({
        where: { odredbaId: grupa[j].id },
        create: {
          odredbaId: grupa[j].id,
          model,
          dimenzija: vektori[j].length,
          vektor: JSON.stringify(vektori[j]),
        },
        update: {
          model,
          dimenzija: vektori[j].length,
          vektor: JSON.stringify(vektori[j]),
        },
      });
    }

    obradjeno += grupa.length;
    process.stdout.write(`\r  Obrađeno: ${obradjeno}/${zaObradu.length}`);
  }

  console.log(`\n\nGotovo. Semantička pretraga je aktivna.\n`);
}

main()
  .catch((g) => {
    console.error("Greška pri izgradnji indeksa:", g);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
