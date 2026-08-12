/**
 * Semantički sloj pretrage.
 *
 * Provider je namerno pluggable i sme da bude `none`: ako korisnik nema ključ
 * za embeddinge, sistem pada na čistu leksičku pretragu umesto da odbije da
 * radi. Degradacija je vidljiva u UI-ju, ne prećutna.
 */

export type ProviderEmbeddinga = "voyage" | "openai" | "none";

export function aktivniProvider(): ProviderEmbeddinga {
  const p = (process.env.EMBEDDINGS_PROVIDER ?? "none").toLowerCase();
  if (p === "voyage" && process.env.VOYAGE_API_KEY) return "voyage";
  if (p === "openai" && process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

export function nazivModela(): string {
  switch (aktivniProvider()) {
    case "voyage":
      return "voyage-3";
    case "openai":
      return "text-embedding-3-small";
    default:
      return "none";
  }
}

/**
 * Vraća embeddinge za listu tekstova, ili null ako provider nije podešen.
 * Poziv je namerno batch — ingest zna da ima hiljade odredbi.
 */
export async function izracunajEmbeddinge(
  tekstovi: string[],
): Promise<number[][] | null> {
  const provider = aktivniProvider();
  if (provider === "none" || tekstovi.length === 0) return null;

  if (provider === "voyage") {
    const odgovor = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: tekstovi,
        model: "voyage-3",
        input_type: "document",
      }),
    });
    if (!odgovor.ok) {
      throw new Error(
        `Voyage embeddings greška ${odgovor.status}: ${await odgovor.text()}`,
      );
    }
    const podaci = (await odgovor.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };
    return podaci.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }

  const odgovor = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: tekstovi, model: "text-embedding-3-small" }),
  });
  if (!odgovor.ok) {
    throw new Error(
      `OpenAI embeddings greška ${odgovor.status}: ${await odgovor.text()}`,
    );
  }
  const podaci = (await odgovor.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };
  return podaci.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export function kosinusnaSlicnost(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let skalarni = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i++) {
    skalarni += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  const imenilac = Math.sqrt(normaA) * Math.sqrt(normaB);
  return imenilac === 0 ? 0 : skalarni / imenilac;
}
