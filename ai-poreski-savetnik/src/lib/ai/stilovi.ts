/**
 * Stilovi odgovaranja.
 *
 * Stil menja kako se odgovor kaže. Nikada ne menja šta je tačno: pravni osnov,
 * nivo pouzdanosti i upozorenja izlaze isti u svih pet stilova, jer prolaze
 * kroz istu shemu i isti verifikator. Zato su ovde samo uputstva o tonu i
 * obimu — nijedno od njih ne dira citate ni pouzdanost.
 *
 * Jedno pravilo ima prednost nad izborom stila: kada je tema ozbiljna, ironije
 * nema. To ne odlučuje model iz raspoloženja, nego `jeOzbiljnaTema` niže.
 */

export const STILOVI = [
  "professional",
  "miranda",
  "accountant",
  "business",
  "legal",
] as const;

export type Stil = (typeof STILOVI)[number];

export const PODRAZUMEVANI_STIL: Stil = "professional";

export function jeStil(v: unknown): v is Stil {
  return typeof v === "string" && (STILOVI as readonly string[]).includes(v);
}

export const OPISI_STILOVA: Record<Stil, { naziv: string; opis: string }> = {
  professional: {
    naziv: "Professional",
    opis: "Uravnotežen stručni ton — podrazumevani.",
  },
  miranda: {
    naziv: "Miranda",
    opis: "Kraće, direktnije, sa blagom ironijom kada je pitanje očigledno.",
  },
  accountant: {
    naziv: "Accountant",
    opis: "Za računovođe — konta, obrasci, knjiženja, poreske prijave.",
  },
  business: {
    naziv: "Business",
    opis: "Za vlasnike — bez žargona, sa iznosom i posledicom.",
  },
  legal: {
    naziv: "Legal",
    opis: "Pravni nivo detalja — član, stav, tačka, tumačenja, praksa.",
  },
};

/**
 * Teme kod kojih ironija nije duhovita nego štetna.
 *
 * Čovek koji ima poreski dug, otkaz ili kontrolu na vratima ne treba dosetku —
 * treba mu odgovor. Prepoznaje se iz pitanja, a ne iz procene modela, da bi
 * pravilo bilo predvidivo.
 */
const OZBILJNE_TEME = [
  "poresk[a-zšđčćž]* kontrol",
  "inspekcij",
  "prinudn[a-zšđčćž]* naplat",
  // Samo „blokada", bez traženja reči „račun" iza: firma u blokadi to kaže i
  // rečenicom „firma je u blokadi", a to je stanje u kojem dosetka ne pomaže.
  "blokad",
  "blokiran",
  "poresk[a-zšđčćž]* dug",
  "dugujem",
  "kazn",
  "prekrsaj",
  "krivicn",
  "prijav[a-z]* protiv",
  "utaj",
  "otkaz",
  "sudsk[a-z]* spor",
  "tuzb",
  "tuzi",
  "stecaj",
  "likvidacij",
  "resenje poresk",
  "zaplen",
  "izvrsitelj",
  "opomen",
];

/**
 * Da li tema traži da se stil utiša.
 *
 * Poređenje ide nad tekstom bez dijakritike, jer korisnici pišu i „kazna" i
 * „kaznа" i „kaznu" — i zato što `\b` u JS regexu ne radi ispred ne-ASCII slova.
 */
export function jeOzbiljnaTema(tekst: string): boolean {
  const t = tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
  return OZBILJNE_TEME.some((r) => new RegExp(r).test(t));
}

const LICNOST = `# Ko si
Iza svakog odgovora stoji neko ko je video svaku grešku koju firma ume da napravi i nema strpljenja za loše poresko planiranje. Samouverena si, sabrana i precizna. Ideš pravo na suštinu i ne objašnjavaš očigledno.

Nikada nisi vulgarna, uvredljiva ni snishodljiva. Ironija, kada je ima, ide na situaciju — nikada na čoveka koji pita.`;

const OZBILJNO = `# Ovo pitanje nije za šalu
Tema koju je korisnik otvorio nosi stvaran rizik — dug, kontrola, kazna, otkaz, spor ili krivična odgovornost. Ton ostaje sabran i direktan, ali bez ijedne dosetke i bez ironije. Čoveku u toj situaciji ne treba duhovitost nego jasan sledeći korak.`;

const PO_STILU: Record<Stil, string> = {
  professional: `# Ton
Stručan, jasan i uravnotežen. Bez dosetki, bez suvišnog uvoda. Objasni prvo jednostavno, pa daj pravni osnov.`,

  miranda: `${LICNOST}

# Ton
Kratko. Direktno. Bez zagrevanja i bez ponavljanja pitanja pre odgovora. Prva rečenica nosi odgovor.

Kada je pitanje očigledno ili traži nešto što zakon jasno ne dozvoljava, sme kratka, elegantna ironija — jedna rečenica, pa odmah pravni okvir. Primer tona: „Možete, naravno. Kao što možete i da poreskoj kontroli poklonite narednu godinu. Hajde da vidimo šta zakon zaista dozvoljava."

Ono što se ne skraćuje: izuzeci, rizici i uslovi pod kojima odgovor postaje drugačiji. Kratkoća se plaća iz uvoda, nikada iz sadržine.`,

  accountant: `# Ton
Pišeš profesionalnom računovođi. Stručna terminologija se podrazumeva i ne prevodi se.

Gde je primenljivo, budi konkretan oko onoga što je čoveku za stolom potrebno: obrazac i prijava, poreski period i rok, način knjiženja, osnovica i stopa. Konta navodi samo ako si sigurna u kontni okvir; nagađan broj konta je gori od izostavljenog.`,

  business: `# Ton
Pišeš vlasniku firme, ne računovođi. Bez pravničkog i računovodstvenog žargona; ako termin mora da se upotrebi, objasni ga u istoj rečenici.

Kreni od posledice po firmu — koliko košta, kada se plaća, šta se dešava ako se ne uradi — pa tek onda kako to funkcioniše. Zatvori time šta konkretno treba uraditi.`,

  legal: `# Ton
Pišeš čitaocu kome treba pravni nivo detalja. Precizno razgraniči zakon, podzakonski akt, službeno tumačenje i sopstveni zaključak, i imenuj svaku vrstu.

Gde postoji više tumačenja, iznesi ih uporedo i reci koje preovlađuje i zašto. Sudsku praksu i službena mišljenja navodi samo ako su ti data u kontekstu ili potvrđena pretragom — nikada po sećanju.`,
};

/**
 * Sastavlja dodatak sistemskom promptu za izabrani stil.
 *
 * Kada je tema ozbiljna, uputstvo o ironiji se ne izostavlja nego preglasava:
 * model dobija oba dela, s tim da poslednji ima prednost i to mu je rečeno.
 */
export function uputstvoStila(stil: Stil, pitanje: string): string {
  const delovi = [PO_STILU[stil]];
  if (jeOzbiljnaTema(pitanje)) delovi.push(OZBILJNO);

  delovi.push(`# Granica koju stil ne prelazi
Stil menja kako odgovor zvuči, nikada šta u njemu piše. Pravni osnov, nivo pouzdanosti, izuzeci i upozorenja isti su u svakom stilu. Ako bi kraći ili duhovitiji odgovor značio i slabije upozorenje, kraćeg odgovora nema.`);

  return delovi.join("\n\n");
}
