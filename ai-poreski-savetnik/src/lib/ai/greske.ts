/**
 * Prevođenje grešaka Claude API-ja u poruke koje korisniku govore šta da uradi.
 *
 * "Došlo je do greške" ne pomaže nikome. Administrator koji nije uneo ključ
 * treba to da sazna iz poruke, a ne iz logova servera.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface OpisGreske {
  poruka: string;
  status: number;
  /** Da li ponovni pokušaj ima smisla. */
  ponoviti: boolean;
}

export function opisiGresku(greska: unknown): OpisGreske {
  if (greska instanceof Anthropic.AuthenticationError) {
    return {
      poruka:
        "Podešeni ANTHROPIC_API_KEY nije prihvaćen. Proverite ključ u .env fajlu — ako ste kopirali .env.example, tamo stoji vrednost-šablon koju treba zameniti pravim ključem.",
      status: 503,
      ponoviti: false,
    };
  }

  if (greska instanceof Anthropic.PermissionDeniedError) {
    return {
      poruka:
        "Podešeni API ključ nema pristup traženom modelu. Proverite dozvole ključa u Anthropic konzoli.",
      status: 503,
      ponoviti: false,
    };
  }

  if (greska instanceof Anthropic.RateLimitError) {
    return {
      poruka:
        "Dostignut je limit poziva prema AI servisu. Sačekajte kratko pa pokušajte ponovo.",
      status: 429,
      ponoviti: true,
    };
  }

  if (greska instanceof Anthropic.APIConnectionError) {
    return {
      poruka:
        "Nije moguće uspostaviti vezu sa AI servisom. Proverite mrežnu vezu servera i pokušajte ponovo.",
      status: 503,
      ponoviti: true,
    };
  }

  // APIConnectionError se proverava iznad — u TypeScript SDK-u je podklasa
  // APIError, pa bi ga širi uslov ovde progutao.
  if (greska instanceof Anthropic.APIError) {
    const status = greska.status ?? 0;
    if (status >= 500) {
      return {
        poruka:
          "AI servis je trenutno preopterećen. Pokušajte ponovo za nekoliko trenutaka.",
        status: 503,
        ponoviti: true,
      };
    }
    return {
      poruka: `AI servis je odbio zahtev (${status || "bez statusa"}). Ako se ponavlja, proverite podešavanja u .env fajlu.`,
      status: 502,
      ponoviti: false,
    };
  }

  if (greska instanceof Error && greska.message.includes("ANTHROPIC_API_KEY")) {
    return {
      poruka:
        "Nije podešen ANTHROPIC_API_KEY. Kopirajte .env.example u .env i unesite ključ, pa ponovo pokrenite aplikaciju.",
      status: 503,
      ponoviti: false,
    };
  }

  // Greška u shemi strukturiranog odgovora — model je vratio nešto što ne
  // prolazi validaciju. Ne prikazujemo tehnički detalj, ali ga logujemo.
  if (greska instanceof Error && greska.name === "ZodError") {
    return {
      poruka:
        "Odgovor nije prošao proveru strukture i zato nije prikazan. Radije ne prikazujemo odgovor u koji ne možemo da budemo sigurni — pokušajte da preformulišete pitanje.",
      status: 502,
      ponoviti: true,
    };
  }

  return {
    poruka: "Došlo je do greške pri obradi zahteva. Pokušajte ponovo.",
    status: 500,
    ponoviti: true,
  };
}
