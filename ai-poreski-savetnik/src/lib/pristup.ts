/**
 * Ko sme da koristi aplikaciju.
 *
 * Ovo postoji zbog jedne činjenice: svako pitanje troši ANTHROPIC_API_KEY
 * vlasnika. Aplikacija objavljena na internetu bez ograničenja znači da svako
 * ko sazna adresu plaća račun tuđim novcem — i to se ne primeti dok ne stigne
 * faktura.
 *
 * Zato je podrazumevano stanje obrnuto od uobičajenog: na svom računaru
 * otvoreno (tamo ste sami), u produkciji zatvoreno. Zaboravljeno podešavanje
 * tada zaključava vrata umesto da ih ostavi otvorena.
 */

export type StanjePristupa = "otvoren" | "zatvoren";

export function stanjePristupa(): StanjePristupa {
  const zadato = (process.env.PRISTUP ?? "").toLowerCase();
  if (zadato === "otvoren") return "otvoren";
  if (zadato === "zatvoren") return "zatvoren";
  // Bez izričitog podešavanja: lokalno otvoreno, objavljeno zatvoreno.
  return process.env.NODE_ENV === "production" ? "zatvoren" : "otvoren";
}

export const PORUKA_PRIJAVA =
  "Za korišćenje je potrebna prijava. Otvorite stranicu „Moja firma” i prijavite se, ili se registrujte pozivnim kodom koji ste dobili.";

export interface OdlukaRegistracije {
  dozvoljeno: boolean;
  razlog?: string;
}

/**
 * Da li ovaj email sme da otvori nalog.
 *
 * Dva nezavisna filtera, oba opciona:
 *   KOD_ZA_REGISTRACIJU — zajednička šifra koju vlasnik deli zaposlenima,
 *   DOZVOLJENI_DOMENI   — spisak domena, npr. "firma.rs,firma.com".
 *
 * Prvi korisnik je izuzet: on postaje administrator, a u trenutku prvog
 * pokretanja još nema nikoga ko bi mu dao kod. Bez tog izuzetka bi sveže
 * objavljena aplikacija bila zaključana i za vlasnika.
 */
export function smeDaSeRegistruje(
  email: string,
  kod: string | undefined,
  prviKorisnik: boolean,
): OdlukaRegistracije {
  if (prviKorisnik) return { dozvoljeno: true };

  const trazeniKod = process.env.KOD_ZA_REGISTRACIJU?.trim();
  if (trazeniKod && kod?.trim() !== trazeniKod) {
    return {
      dozvoljeno: false,
      razlog:
        "Pozivni kod nije tačan. Kod dobijate od osobe koja je postavila aplikaciju.",
    };
  }

  const domeni = (process.env.DOZVOLJENI_DOMENI ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (domeni.length > 0) {
    const domen = email.split("@")[1]?.toLowerCase() ?? "";
    if (!domeni.includes(domen)) {
      return {
        dozvoljeno: false,
        razlog: `Nalog se može otvoriti samo sa službenom adresom (${domeni.join(", ")}).`,
      };
    }
  }

  return { dozvoljeno: true };
}

/** Da li je registracija uopšte moguća — za poruku na ekranu. */
export function opisRegistracije(): string {
  const kod = Boolean(process.env.KOD_ZA_REGISTRACIJU?.trim());
  const domeni = (process.env.DOZVOLJENI_DOMENI ?? "").trim();

  if (kod && domeni) {
    return `Za otvaranje naloga potrebni su pozivni kod i službena adresa (${domeni}).`;
  }
  if (kod) return "Za otvaranje naloga potreban je pozivni kod.";
  if (domeni) return `Nalog se otvara službenom adresom (${domeni}).`;
  return "";
}
