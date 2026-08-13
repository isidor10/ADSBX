/**
 * Glas — prepoznavanje govora i izgovor odgovora.
 *
 * Radi na Web Speech API-ju pregledača: bez dodatnog ključa, bez slanja zvuka
 * trećem servisu i bez troška po minutu. Cena toga je što kvalitet zavisi od
 * pregledača i od glasova instaliranih na računaru — pa se ovde ništa ne
 * pretpostavlja, nego se proverava i, kada srpskog glasa nema, to se i kaže.
 *
 * Ono što se izgovara nije ceo odgovor. Član i stav pročitani naglas su
 * neupotrebljivi — broj se ne pamti na sluh. Zato glas nosi zaključak, a ekran
 * istovremeno nosi pravni osnov, sa linkom koji se može otvoriti.
 */

export type StanjeGlasa =
  | "nedostupno"
  | "spreman"
  | "slusam"
  | "obradjujem"
  | "govorim";

/** Jezici po redu prihvatljivosti kada srpskog glasa nema. */
const SRODNI_JEZICI = ["sr", "hr", "bs", "sh", "me"];

export interface PodrskaGlasa {
  prepoznavanje: boolean;
  sinteza: boolean;
  /** Glas kojim će se govoriti; null znači da nijedan nije prikladan. */
  glas: SpeechSynthesisVoice | null;
  /** Kada glas nije srpski ni srodan — razlog za poruku korisniku. */
  napomena?: string;
}

function konstruktorPrepoznavanja(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Bira glas za srpski.
 *
 * Ako srpskog nema, uzima se srodan (hrvatski, bosanski) — izgovor je blizak i
 * razumljiv. Engleski glas koji čita srpski tekst se NE uzima: to zvuči kao
 * kvar i teže se razume nego čitanje sa ekrana.
 */
export function izaberiGlas(glasovi: SpeechSynthesisVoice[]): {
  glas: SpeechSynthesisVoice | null;
  napomena?: string;
} {
  const jezik = (g: SpeechSynthesisVoice) =>
    g.lang.toLowerCase().replace("_", "-");

  const srpski = glasovi.find((g) => jezik(g).startsWith("sr"));
  if (srpski) return { glas: srpski };

  const srodan = glasovi.find((g) =>
    SRODNI_JEZICI.some((j) => jezik(g).startsWith(j)),
  );
  if (srodan) {
    return {
      glas: srodan,
      napomena: `Na ovom uređaju nema srpskog glasa, pa se koristi najbliži dostupan (${srodan.name}). Izgovor pojedinih reči može da odstupa.`,
    };
  }

  return {
    glas: null,
    napomena:
      "Na ovom uređaju nema nijednog srpskog ni srodnog glasa, pa čitanje naglas nije uključeno — odgovor se prikazuje kao tekst. Diktiranje pitanja i dalje radi.",
  };
}

export function proveriPodrsku(): PodrskaGlasa {
  if (typeof window === "undefined") {
    return { prepoznavanje: false, sinteza: false, glas: null };
  }

  const prepoznavanje = konstruktorPrepoznavanja() !== null;
  const sinteza = typeof window.speechSynthesis !== "undefined";
  if (!sinteza) return { prepoznavanje, sinteza, glas: null };

  const { glas, napomena } = izaberiGlas(window.speechSynthesis.getVoices());
  return { prepoznavanje, sinteza, glas, napomena };
}

/**
 * Lista glasova se u pregledačima puni asinhrono — prvi `getVoices()` posle
 * učitavanja strane ume da vrati prazan niz. Zato se čeka i događaj.
 */
export function naGlasoveSpremne(pozovi: () => void): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};
  const s = window.speechSynthesis;
  s.addEventListener("voiceschanged", pozovi);
  if (s.getVoices().length > 0) pozovi();
  return () => s.removeEventListener("voiceschanged", pozovi);
}

/** Prekida izgovor. Poziva se pre svakog novog govora i na svaki prekid. */
export function ućutkaj() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export interface OpcijeGovora {
  glas: SpeechSynthesisVoice | null;
  naKraj?: () => void;
}

/**
 * Izgovara tekst. Vraća funkciju za prekid.
 *
 * Duži tekst se deli na rečenice: pregledači imaju granicu dužine posle koje
 * izgovor tiho stane na sredini, a odgovor koji se prekine u pola rečenice je
 * gori nego da ga nije ni bilo.
 */
export function izgovori(tekst: string, opcije: OpcijeGovora): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};

  ućutkaj();

  const recenice = tekst
    .split(/(?<=[.!?])\s+/)
    .map((r) => r.trim())
    .filter(Boolean);

  if (recenice.length === 0) {
    opcije.naKraj?.();
    return () => {};
  }

  let prekinuto = false;

  recenice.forEach((recenica, i) => {
    const iskaz = new SpeechSynthesisUtterance(recenica);
    if (opcije.glas) {
      iskaz.voice = opcije.glas;
      iskaz.lang = opcije.glas.lang;
    } else {
      iskaz.lang = "sr-RS";
    }
    iskaz.rate = 1.0;
    iskaz.pitch = 1.0;
    if (i === recenice.length - 1) {
      iskaz.onend = () => {
        if (!prekinuto) opcije.naKraj?.();
      };
    }
    window.speechSynthesis.speak(iskaz);
  });

  return () => {
    prekinuto = true;
    ućutkaj();
  };
}

export interface OpcijeSlusanja {
  naDelimicno?: (tekst: string) => void;
  naKonacno: (tekst: string) => void;
  naGresku?: (poruka: string) => void;
  naKraj?: () => void;
}

const PORUKE_GRESAKA: Record<string, string> = {
  "not-allowed":
    "Pristup mikrofonu nije dozvoljen za ovu stranu. U adresnoj traci kliknite " +
    "ikonicu levo od adrese i dozvolite mikrofon, pa osvežite stranu.",
  // Ova greška najčešće NE znači pogrešan pregledač — u Chrome-u je gotovo
  // uvek dozvola koju operativni sistem nije dao samom pregledaču. Poruka koja
  // je slala „probajte u Chrome-u" bila je beskorisna čoveku koji je već u
  // Chrome-u, pa prvo ide sistemska dozvola, a tek onda pregledač.
  "service-not-allowed":
    "Sistem nije dao mikrofon pregledaču. Na Mac-u: Podešavanja sistema → " +
    "Privatnost i bezbednost → Mikrofon → uključite Chrome, pa zatvorite " +
    "pregledač sa Cmd+Q i otvorite ga ponovo. Na Windows-u: Settings → " +
    "Privacy → Microphone. U Safariju i Firefox-u prepoznavanje govora ne radi " +
    "ni uz dozvolu.",
  "audio-capture":
    "Mikrofon nije pronađen. Proverite da li je priključen i izabran u podešavanjima sistema.",
  network:
    "Prepoznavanje govora zahteva vezu sa internetom i trenutno je nedostupno.",
  "no-speech": "Nisam ništa čula. Pokušajte ponovo.",
};

/**
 * Sluša govor na srpskom. Vraća funkciju za zaustavljanje.
 *
 * `interimResults` je uključen da korisnik vidi da ga aplikacija čuje dok
 * govori — bez toga se dugme ne razlikuje od zaglavljenog.
 */
export function slusaj(opcije: OpcijeSlusanja): () => void {
  const Konstruktor = konstruktorPrepoznavanja();
  if (!Konstruktor) {
    opcije.naGresku?.(
      "Ovaj pregledač ne podržava prepoznavanje govora. Radi u Chrome-u i Edge-u.",
    );
    return () => {};
  }

  const prepoznavanje = new Konstruktor();
  prepoznavanje.lang = "sr-RS";
  prepoznavanje.interimResults = true;
  prepoznavanje.continuous = false;
  prepoznavanje.maxAlternatives = 1;

  let konacno = "";

  prepoznavanje.onresult = (dogadjaj: SpeechRecognitionEvent) => {
    let delimicno = "";
    for (let i = dogadjaj.resultIndex; i < dogadjaj.results.length; i += 1) {
      const rezultat = dogadjaj.results[i];
      if (rezultat.isFinal) konacno += rezultat[0].transcript;
      else delimicno += rezultat[0].transcript;
    }
    if (delimicno) opcije.naDelimicno?.(konacno + delimicno);
  };

  prepoznavanje.onerror = (dogadjaj: SpeechRecognitionErrorEvent) => {
    // „aborted" nastaje kada mi sami zaustavimo slušanje — nije greška.
    if (dogadjaj.error === "aborted") return;
    opcije.naGresku?.(
      PORUKE_GRESAKA[dogadjaj.error] ??
        `Prepoznavanje govora je prekinuto (${dogadjaj.error}).`,
    );
  };

  prepoznavanje.onend = () => {
    const tekst = konacno.trim();
    if (tekst) opcije.naKonacno(tekst);
    opcije.naKraj?.();
  };

  prepoznavanje.start();
  return () => prepoznavanje.abort();
}

/**
 * Sastavlja ono što se izgovara.
 *
 * Namerno ne čita član i stav: broj propisa na sluh se ne pamti, a pogrešno
 * zapamćen broj je gori od nijednog. Umesto toga kaže odakle odgovor dolazi i
 * upućuje na ekran, gde stoji ceo pravni osnov sa linkom.
 */
export function tekstZaIzgovor(
  odgovor: {
    kratakOdgovor: string;
    objasnjenje: string;
    nivoPouzdanosti: string;
    potrebnaPitanja?: string[];
  },
  brojCitata: number,
  brojUpozorenja: number,
): string {
  const delovi = [odgovor.kratakOdgovor, odgovor.objasnjenje];

  if (odgovor.potrebnaPitanja?.length) {
    delovi.push(
      `Da bih odgovorila preciznije, treba mi još ovo: ${odgovor.potrebnaPitanja.join(" ")}`,
    );
  }

  if (odgovor.nivoPouzdanosti === "NEDOVOLJNO_PODATAKA") {
    delovi.push(
      "Ovo nisam mogla da potvrdim propisom, pa uzmite kao polazište za proveru, ne kao utvrđeno pravno stanje.",
    );
  } else if (odgovor.nivoPouzdanosti === "POTREBNA_PROVERA") {
    delovi.push("Ovde je potrebna dodatna provera pre nego što postupite.");
  }

  if (brojCitata > 0) {
    delovi.push(
      `Pravni osnov, ${brojCitata === 1 ? "jedna odredba" : `${brojCitata} odredbi`}, stoji na ekranu sa linkom ka izvoru.`,
    );
  }
  if (brojUpozorenja > 0) {
    delovi.push("Pročitajte i upozorenja iznad odgovora.");
  }

  return delovi.join(" ");
}
