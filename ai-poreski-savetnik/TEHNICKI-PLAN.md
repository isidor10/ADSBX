# AI Poreski savetnik — tehnički plan sistema

> Verzija plana: 1.0 · Datum: 12.08.2026.
> Prioritet sistema: **TAČNOST PROPISA → POUZDANOST ODGOVORA → CITIRANOST IZVORA → OBRAČUNI → DIZAJN**

---

## 0. Osnovna projektantska odluka

Model **ne zna zakone**. Model **čita** zakone iz pravne baze i sa weba, i sme da tvrdi
samo ono što može da veže za konkretan zapis u bazi ili za konkretan dohvaćen izvor.

Iz toga sledi tri stvari koje su ugrađene u arhitekturu:

1. **Pravna baza je odvojena od modela.** Ažurira se skriptama, bez ponovnog treniranja.
2. **Citat je podatak, ne tekst.** Model vraća `citatId` koji pokazuje na red u bazi;
   aplikacija sama renderuje naziv propisa, član, stav i link. Model nikada ne piše
   broj člana kao slobodan tekst u polje pravnog osnova.
3. **Postoji verifikator posle generisanja.** Svaki citat se proverava; nepostojeći
   citati se uklanjaju, a pouzdanost odgovora se automatski obara.

To je odgovor na zahteve 2, 3, 18, 19, 20 i 33 iz specifikacije.

---

## 1. Arhitektura

```
┌──────────────────────────────────────────────────────────────────────┐
│  FRONTEND — Next.js App Router (React 19, Tailwind v4)               │
│  Chat · Izvori panel · Kalkulatori · Pretraga propisa · Firma        │
│  Rokovi · Izmene propisa · Admin                                      │
└───────────────┬──────────────────────────────────────────────────────┘
                │  REST (/api/*), SSE stream za chat
┌───────────────▼──────────────────────────────────────────────────────┐
│  APLIKATIVNI SLOJ (Next.js Route Handlers, Node runtime)             │
│                                                                       │
│  ┌─────────────────────── ODGOVORNI TOK ─────────────────────────┐   │
│  │ 1. Klasifikacija upita   → oblast, tip lica, temporalni okvir │   │
│  │ 2. Retrieval (RAG)       → hybrid: BM25 + vektori, temporalno │   │
│  │ 3. Web pretraga          → samo dozvoljeni domeni, po redu    │   │
│  │ 4. Sinteza (LLM)         → strukturirani JSON sa citatId      │   │
│  │ 5. VERIFIKATOR CITATA    → odbacuje nepostojeće, spušta nivo  │   │
│  │ 6. Skoring pouzdanosti   → 🟢 / 🟡 / 🔴                        │   │
│  │ 7. Audit trail           → pitanje, izvori, verzije, odgovor  │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Kalkulatori (čiste funkcije, parametri iz baze — ne hardkodirani)    │
│  Analiza dokumenata · Second opinion · Rokovi · Praćenje izmena       │
└───────────────┬───────────────────────────┬──────────────────────────┘
                │                           │
┌───────────────▼─────────────┐  ┌──────────▼───────────────────────────┐
│  PRAVNA BAZA (Prisma)       │  │  Claude API (claude-opus-5)          │
│  SQLite (dev) / Postgres    │  │  · adaptive thinking                 │
│  + pgvector (prod)          │  │  · server-side web_search_20260209   │
│                             │  │    sa allowed_domains (prioritet)    │
│  Propis → Verzija → Odredba │  │  · structured outputs (json_schema)  │
│  Parametar (temporalno)     │  │  · document input za PDF analizu     │
│  Izmena · Rok · Mišljenje   │  │  · prompt caching za pravni kontekst │
└─────────────────────────────┘  └──────────────────────────────────────┘
```

### Zašto Next.js
Isti jezik na frontu i backu (manje mesta za grešku u modelu podataka), Route
Handlers pokrivaju REST + SSE, a projekat se poklapa sa stekom koji već postoji
u ovom repozitorijumu (`private-aviation-tracker`).

### Runtime napomena
Svi API rutovi koji diraju bazu ili Anthropic SDK rade u Node runtime-u
(`export const runtime = "nodejs"`), ne u Edge — zbog Prisma klijenta.

---

## 2. Struktura baze podataka

Ključna ideja: **odredba (član/stav/tačka) je jedinica citiranja i jedinica
pretrage**, i ima svoj period važenja. Bez toga nema ni tačnog citata ni
temporalnog pretraživanja (zahtev 32).

```
Propis                          jedan propis (zakon, pravilnik, uputstvo…)
 ├─ id, naziv, skracenica, tip (ZAKON | PODZAKONSKI_AKT | UPUTSTVO |
 │   MISLJENJE | SUDSKA_PRAKSA), kategorija, donosilac
 ├─ sluzbeniGlasnik[]           lista brojeva "Sl. glasnika" sa izmenama
 ├─ datumDonosenja, datumStupanjaNaSnagu, datumPrestankaVazenja
 ├─ izvorInstitucija, izvorUrl, prioritetIzvora (1 = Sl. glasnik … 9 = ostalo)
 └─ verifikacija (POTVRDJENO | DELIMICNO | NEPOTVRDJENO), poslednjaProvera

PropisVerzija                   snapshot propisa kroz vreme (istorija, zahtev 25)
 └─ propisId, oznakaVerzije, vaziOd, vaziDo, sluzbeniGlasnik, opisIzmene

Odredba                         ← JEDINICA CITIRANJA
 ├─ propisId, verzijaId
 ├─ clan, stav, tacka, podtacka   (nullable — hijerarhija)
 ├─ naslov, tekst                 (doslovan tekst propisa)
 ├─ vaziOd, vaziDo                (temporalno)
 ├─ izvorUrl, deepLink            (link direktno na član kad postoji)
 ├─ potvrdjenBrojClana: boolean   ← ako je false, UI piše
 │                                  „Nije potvrđen tačan član"
 └─ hash                          (detekcija promene teksta pri re-ingestu)

OdredbaVektor                    embedding (JSON blob / pgvector)
 └─ odredbaId, model, dimenzija, vektor

Izmena                           zahtev 16 — notifikacije o promenama
 └─ propisId, odredbaId?, staraOdredba, novaOdredba, odKadaSePrimenjuje,
    kogaPogadja, staTrebaUraditi, izvorUrl, objavljeno

PoreskiParametar                 ← KALKULATORI ČITAJU ODAVDE, NE IZ KODA
 ├─ kljuc  (npr. "pdv.opsta_stopa", "zarada.neoporezivi_iznos")
 ├─ vrednost (Decimal), jedinica (PROCENAT | RSD | EUR | DANA)
 ├─ vaziOd, vaziDo                ← temporalno; "koliko je bilo 2024?" radi
 ├─ odredbaId?                    ← pravni osnov parametra
 └─ izvorUrl, napomena, verifikacija

Rok                              zahtev 15 — poreski kalendar
 └─ naziv, opis, vrstaObveznika[], ponavljanje (MESECNO | KVARTALNO |
    GODISNJE | JEDNOKRATNO), danUMesecu, mesec, obrazac, odredbaId?, izvorUrl

Firma (profil)                   zahtev 12
 └─ korisnikId, naziv, pib, maticniBroj, pravnaForma, sifraDelatnosti,
    pdvStatus, nacinOporezivanja, brojZaposlenih, sediste, poslovneJedinice[]

Korisnik / Sesija                autentifikacija
Razgovor / Poruka / Citat        istorija + veza poruke ↔ odredbe
Dokument / AnalizaDokumenta      zahtev 13
Pracenje                         zahtev 16 — na koje oblasti je korisnik pretplaćen
AuditZapis                       zahtev 33 — pitanje, izvori, URL, datum, verzija
AdminOcena                       zahtev 34 — „Pouzdan odgovor" / „Potrebna provera"
```

**Zašto `PoreskiParametar` kao tabela, a ne konstante u kodu:** kad se 1. februara
promeni neoporezivi iznos, menja se jedan red u bazi — ne deploy. Svaki obračun
uz rezultat vraća i `vaziOd` parametra koji je upotrebio, pa korisnik vidi po
kojoj verziji propisa je računato.

---

## 3. RAG sistem

**Indeksiranje.** Svaka odredba je jedan chunk. Član se ne seče na proizvoljne
delove — granica chunk-a je pravna granica (stav/tačka). Time citat uvek pokazuje
na tačno onu jedinicu koja je i pronađena.

**Pretraga je hibridna:**

| Sloj | Tehnika | Zašto |
|---|---|---|
| Leksički | BM25 nad normalizovanim tekstom | „član 28 PDV" mora da pogodi doslovno |
| Semantički | kosinusna sličnost embeddinga | „ručak sa klijentom" → reprezentacija |
| Strukturni | parser upita (`član 29 Zakona o PDV`) | direktan pogodak, zahtev 31 |
| Temporalni | filter `vaziOd ≤ datum < vaziDo` | zahtev 32 |

**Srpska normalizacija** (`src/lib/legal/normalize.ts`): transliteracija ćirilica→latinica,
uklanjanje dijakritika (č/ć/š/ž/đ), lagani stemming srpskih nastavaka
(`-ima`, `-ovi`, `-ama`, `-ost`…) i rečnik sinonima
(`PDV` ↔ `porez na dodatu vrednost`, `paušalac` ↔ `paušalno oporezivanje`).
Bez ovoga BM25 na srpskom praktično ne radi.

**Embeddings su opcioni.** Provider je pluggable (`voyage` | `openai` | `none`).
Ako ključ nije podešen, sistem radi čisto leksički — degradira, ali ne pada.

**Rangiranje:** `score = 0.55·bm25_norm + 0.45·cos_sim`, uz bonus za direktan
pogodak člana i penal za propis koji više ne važi na traženi datum.

---

## 4. Web-search sistem

Koristi se **server-side alat `web_search_20260209`** iz Claude API-ja, sa
`allowed_domains` postavljenim po prioritetu iz zahteva 5:

```
1. pravno-informacioni-sistem.rs, slglasnik.com   (Službeni glasnik)
2. mfin.gov.rs                                    (Ministarstvo finansija)
3. purs.gov.rs / poreskauprava.gov.rs             (Poreska uprava)
4. minrzs.gov.rs, rfzo.rs, apr.gov.rs, nbs.rs
5. efaktura.gov.rs, eporezi.purs.gov.rs
6. paragraf.rs                                    (Paragraf Lex)
7. ostali proveren stručni izvori (whitelist)
```

Pretraga ide **u dva prolaza**: prvo samo primarni izvori (nivoi 1–5); ako se ne
nađe dovoljno, drugi prolaz uključuje Paragraf Lex i stručne izvore. Svaki
pronađeni izvor dobija `prioritetIzvora`, i odgovor koji se oslanja isključivo na
izvore prioriteta ≥ 6 **ne može dobiti zelenu pouzdanost**.

Upiti se ne prosleđuju sirovi — generišu se ciljano po oblasti
(`"PDV odbitak prethodnog poreza putnički automobil član 29 izmene 2026"`),
i uvek se dodaje provera aktuelnosti („poslednje izmene", „važeći tekst").

---

## 5. Sistem za proveru važećih propisa

Pre nego što odgovor izađe, radi se `temporalnaProvera(odredbe, ciljniDatum)`:

1. `vaziOd ≤ ciljniDatum` i (`vaziDo` je null ili `> ciljniDatum`) → **VAŽI**
2. `vaziDo ≤ ciljniDatum` → **PRESTAO DA VAŽI** (odredba se ne sme koristiti kao
   osnov; ako je korisnik pitao za prošli period — koristi se, ali sa oznakom
   „važilo u periodu X–Y")
3. `vaziOd > ciljniDatum` → **NIJE JOŠ STUPILO NA SNAGU** (jasna oznaka)
4. `tip = NACRT | PREDLOG` → **NIJE PROPIS**, obavezno upozorenje

Datum se izvlači iz pitanja (`"koliko je bilo 2023"`, `"šta važi od 1. januara 2026"`);
podrazumevano je današnji datum. Za pitanja o budućnosti sistem eksplicitno
razdvaja „važeći propis" od „usvojenih izmena koje se primenjuju od…".

Uz svaki odgovor ide `datumPoslednjeProvere` — kad je propis poslednji put
verifikovan prema izvoru.

---

## 6. Način citiranja članova

Model **ne piše** broj člana slobodno. Shema strukturiranog izlaza traži:

```jsonc
{
  "kratakOdgovor": "…",
  "objasnjenje": "…",
  "poreskiTretman": { "osnovica": "…", "stopa": "…", "rok": "…", "prijava": "…" },
  "pravniOsnov": [
    { "citatId": "odr_7f3a", "relevantnost": "Isključuje pravo na odbitak" }
  ],
  "vazno": ["…"],
  "nivoPouzdanosti": "VISOKA | POTREBNA_PROVERA | NEDOVOLJNO_PODATAKA",
  "tipTvrdnje": "ZAKON | PODZAKONSKI_AKT | SLUZBENO_TUMACENJE | STRUCNO_MISLJENJE | AI_ZAKLJUCAK"
}
```

`citatId` je ID odredbe koja je bila u kontekstu. Aplikacija ga razrešava i sama
renderuje karticu:

```
┌──────────────────────────────────┐
│ 📚 PRAVNI OSNOV                  │
│ Zakon o PDV                      │
│ Član 29, stav 1, tačka 1)        │
│ 🟢 Važeći propis · provereno …   │
│ 🔗 Otvori propis                 │
└──────────────────────────────────┘
```

Ako je `potvrdjenBrojClana = false`, kartica umesto broja člana prikazuje:
**„Nisam uspeo da potvrdim tačan član propisa. Potrebno je proveriti važeću
verziju zakona."** — doslovno kako traži zahtev 3.

**Verifikator** (`src/lib/ai/verifier.ts`) odbacuje svaki `citatId` koji ne
postoji u kontekstu koji je poslat modelu, i ako je bilo odbacivanja, obara
pouzdanost na 🟡 i dodaje napomenu. Halucinirani član ne može da prođe do UI-ja.

---

## 7. Ažuriranje zakona

```
scripts/ingest-propise.ts   → dohvat sa zvaničnih izvora, parsiranje na članove,
                              hash-diff protiv postojećih odredbi
scripts/build-index.ts      → embeddings za nove/izmenjene odredbe
scripts/detect-izmene.ts    → poređenje verzija → zapis u tabelu Izmena
                              (šta, staro, novo, od kada, koga pogađa, šta uraditi)
```

Pokreće se cron-om (dnevno). Nijedna izmena ne dira model — samo bazu.
Kad diff nađe promenu, korisnici pretplaćeni na tu oblast (`Pracenje`) dobijaju
zapis u feed `/izmene`.

> **Napomena o okruženju:** u ovoj sesiji mrežna politika blokira direktan pristup
> ka `paragraf.rs`, `purs.gov.rs` i `pravno-informacioni-sistem.rs`, pa puni
> tekstovi propisa nisu mogli da se povuku ovde. Zato je baza seed-ovana
> **proverenim ključnim odredbama i parametrima sa označenim izvorom i statusom
> verifikacije**, a ingest-pipeline je napisan da povuče pune tekstove kod
> korisnika, gde ti domeni nisu blokirani. Sve što nije potvrđeno nosi
> `verifikacija: NEPOTVRDJENO` i UI to prikazuje.

---

## 8. Backend — API

| Ruta | Metod | Opis |
|---|---|---|
| `/api/chat` | POST (SSE) | Glavni tok: klasifikacija → RAG → web → sinteza → verifikacija |
| `/api/propisi/search` | GET | Pretraga propisa (leksička + semantička + po članu) |
| `/api/propisi/[id]` | GET | Odredbe propisa, verzije, istorija izmena |
| `/api/kalkulator/[vrsta]` | POST | 13 kalkulatora; vraća formulu, korake, rezultat, osnov |
| `/api/firma` | GET/POST/PUT | Profil firme |
| `/api/dokumenti` | POST | Upload + analiza (PDF/Word/Excel/slika) |
| `/api/rokovi` | GET | Rokovi za mesec/period prema profilu firme |
| `/api/izmene` | GET | Feed izmena propisa + pretplate |
| `/api/drugo-misljenje` | POST | „Proveri moj odgovor" |
| `/api/admin/*` | GET/POST | Statistika, neodgovorena pitanja, ocene |

**Autentifikacija:** sesijski kolačić (HttpOnly, SameSite=Lax, Secure), lozinke
hešovane `scrypt`-om, sesije u bazi sa rokom trajanja i rotacijom. Uloge:
`KORISNIK` / `ADMIN`. Rate-limit po korisniku i po IP-u na `/api/chat` i
`/api/dokumenti`.

**Sigurnost:** Zod validacija svakog ulaza; upload ograničen tipom i veličinom
(20 MB) i nikad se ne izvršava; Prisma parametrizovani upiti; CSP bez `unsafe-eval`;
API ključ samo server-side; audit zapis za svaki odgovor; brisanje dokumenata na
zahtev korisnika.

---

## 9. Frontend

- **Desktop:** trokolonski layout — navigacija · chat · panel IZVORI.
- **Mobilni (iPhone prioritet):** bottom navigacija `Chat · Firma · Kalkulator ·
  Propisi · Profil`, izvori kao bottom-sheet, touch mete ≥ 44 px,
  `safe-area-inset` za notch, dark/light preko `prefers-color-scheme` + prekidač.
- **Dizajn:** poslovni i miran — tamna paleta sa jednim akcentom, serif za
  naslove, tabelarni brojevi za obračune. Bez „chat igračaka".
- Disclaimer u podnožju svake strane; dodatno upozorenje kod visokorizičnih tema
  (transferne cene, poreska optimizacija, PDV kod nekretnina).

---

## 10. Šta još predlažem (zahtev 27) i šta je implementirano

| Funkcija | Status |
|---|---|
| Kalkulator ukupnog troška zaposlenog | ✅ implementirano |
| Kalkulator troška službenog automobila | ✅ implementirano |
| „Šta ako" simulacija (paušalac vs knjigaš vs DOO) | ✅ implementirano |
| Checklist poreskih obaveza po tipu firme | ✅ implementirano |
| Poreski kalendar sa filtriranjem po profilu | ✅ implementirano |
| Kontrola PDV tretmana fakture | ✅ implementirano (analiza dokumenta) |
| Predlog konta i knjiženja | ✅ implementirano (uz obavezan disclaimer) |
| Detekcija mogućih grešaka u obračunu zarade | ✅ implementirano |
| Export razgovora (Markdown/PDF-ready HTML) | ✅ implementirano |
| Baza mišljenja MF/PU | ⏳ shema + ingest spremni, puni tekstovi kroz pipeline |
| Sudska praksa | ⏳ shema spremna, van obima prve verzije |

---

## 11. Poznata ograničenja (namerno navedena)

1. Pravna baza u ovom repozitorijumu je **seed sa proverenim ključnim odredbama**,
   ne pun korpus. Pun korpus se dobija pokretanjem `npm run ingest` kod korisnika.
2. Brojevi članova koje nisam mogao da potvrdim označeni su
   `potvrdjenBrojClana: false` i UI ih ne prikazuje kao potvrđene.
3. Semantička pretraga zahteva embedding ključ; bez njega radi leksička.
4. Sistem je stručna podrška, ne zamena za ovlašćenog savetnika — disclaimer je
   deo proizvoda, ne fusnota.
