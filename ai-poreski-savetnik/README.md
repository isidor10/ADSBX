# AI Poreski savetnik — Republika Srbija

Poreski savetnik, računovođa i finansijsko-administrativni asistent za poslovanje
u Republici Srbiji. Sistem je građen po principu **LLM + RAG + web pretraga +
pravna baza** — model ne pamti zakone, nego ih čita iz baze i sa zvaničnih
izvora, i sme da tvrdi samo ono što može da veže za konkretan zapis.

Tehnički plan sistema: [`TEHNICKI-PLAN.md`](./TEHNICKI-PLAN.md)

---

## Zašto se broj člana ne može izmisliti

Ovo je centralna odluka celog projekta, pa je vredi razumeti pre svega ostalog.

Model **nema polje** u koje bi upisao broj člana kao slobodan tekst. U
strukturiranom odgovoru vraća samo `citatId` — identifikator odredbe koja mu je
bila u kontekstu. Naziv propisa, član, stav i link renderuje aplikacija iz baze.

Posle generisanja radi **verifikator** (`src/lib/ai/verifier.ts`), koji:

1. odbacuje svaki `citatId` koji nije bio u kontekstu,
2. odbacuje odredbe koje na traženi datum ne smeju da budu pravni osnov
   (prestale da važe, još nisu na snazi, nacrt),
3. obara nivo pouzdanosti kad je bilo odbacivanja, kad citata nema, ili kad se
   odgovor oslanja samo na sekundarne izvore,
4. pamti odbačene citate u audit zapis — to je merljiv pokazatelj kvaliteta.

Odredba kojoj broj člana **nije potvrđen** prema izvoru nosi
`potvrdjenBrojClana: false`, i UI umesto broja ispisuje:

> „Nisam uspeo da potvrdim tačan član propisa. Potrebno je proveriti važeću
> verziju zakona."

Isto načelo važi za obračune: parametar koji nije potvrđen se **ne** zamenjuje
nulom niti procenom — kalkulator prijavi da parametar nedostaje i obračun ostaje
nepotpun. Radije nepotpuno nego pogrešno.

---

## Pokretanje

```bash
npm install
cp .env.example .env         # unesite ANTHROPIC_API_KEY
npm run db:push              # kreira SQLite bazu
npm run seed                 # puni proverene propise, parametre i rokove
npm run dev                  # http://localhost:3000
```

Prvi registrovani korisnik automatski dobija ulogu `ADMIN` (inače admin panel ne
bi bio dostupan nikome pri prvom pokretanju). Registracija je na strani
**Moja firma**.

### Dopuna pravne baze

```bash
npm run ingest      # povlači pune tekstove propisa sa zvaničnih izvora
npm run index       # gradi semantički indeks (ako je podešen embedding ključ)
npm run izmene      # otkriva izmene i priprema obaveštenja
```

`npm run ingest` **ništa ne upisuje ako dohvat ne uspe** i ne menja status
verifikacije — neuspešan dohvat ostavlja bazu tačnom, samo nepotpunom.

### Provere

```bash
npm run typecheck
npm run verify:kalkulatori   # aritmetika, temporalno čitanje, pravni osnov
npm run verify:retrieval     # normalizacija srpskog, pretraga, važenje propisa
npm run verify:citati        # zaštita od halucinacija — najvažniji test
```

Sve tri provere rade bez poziva modela, pa su determinističke i brze.

---

## Konfiguracija (`.env`)

| Promenljiva | Obavezno | Podrazumevano | Opis |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | da | — | Ključ za Claude API |
| `AI_EFFORT` | ne | `high` | `low`…`max`; za poreska pitanja preporuka `high` |
| `DATABASE_URL` | da | `file:./pravna-baza.db` | SQLite (dev) ili Postgres (prod) |
| `EMBEDDINGS_PROVIDER` | ne | `none` | `voyage` \| `openai` \| `none` |
| `WEB_SEARCH_ENABLED` | ne | `true` | Pretraga zvaničnih izvora u realnom vremenu |
| `WEB_SEARCH_MAX_USES` | ne | `8` | Najviše pretraga po pitanju |
| `SESSION_SECRET` | da (prod) | — | `openssl rand -hex 32` |
| `MAX_UPLOAD_MB` | ne | `20` | Ograničenje veličine dokumenta |

Bez embedding ključa sistem radi **leksičkom (BM25) pretragom** — slabije, ali
radi. Degradacija je namerna i vidljiva, ne prećutna.

---

## Šta sistem radi

| Oblast | Stanje |
|---|---|
| Razgovor sa pravnim osnovom uz svaku tvrdnju | ✅ |
| Provera važenja propisa na zadati datum | ✅ |
| Temporalna pretraga („koliko je bilo 2024?") | ✅ |
| Pretraga po tačnom članu | ✅ |
| Web pretraga zvaničnih izvora po prioritetu | ✅ |
| Nivoi pouzdanosti 🟢 / 🟡 / 🔴 | ✅ |
| Razdvajanje zakona / podzakonskog akta / tumačenja / AI zaključka | ✅ |
| 13 kalkulatora sa formulom, koracima i pravnim osnovom | ✅ |
| Profil firme koji ulazi u kontekst odgovora | ✅ |
| Analiza dokumenata (PDF, Word, Excel, CSV, slike) | ✅ |
| „Proveri moj odgovor" (drugo mišljenje) | ✅ |
| Poreski kalendar filtriran po profilu firme | ✅ |
| Praćenje izmena propisa i pretplata po oblastima | ✅ |
| Audit trag svakog odgovora | ✅ |
| Admin panel sa merenjem kvaliteta | ✅ |
| Autentifikacija, uloge, ograničavanje zahteva | ✅ |
| Baza mišljenja MF/PU, sudska praksa | shema spremna, puni tekstovi kroz ingest |

### Kalkulatori

PDV · bruto→neto · neto→bruto · ukupan trošak zaposlenog · porez na dobit ·
porez po odbitku · paušalac · lična zarada preduzetnika · poreska amortizacija ·
kapitalni dobitak · službeni put i dnevnice · trošak službenog automobila ·
poređenje pravnih formi („šta ako")

Svaki obračun čita stope i iznose iz baze prema datumu, i uz rezultat prikazuje
propis, član i link za svaki upotrebljeni parametar.

---

## Stanje pravne baze u ovom repozitorijumu

Baza je seed-ovana **proverenim ključnim odredbama i parametrima**, ne punim
korpusom propisa. Razlog je opisan u tehničkom planu: u okruženju u kojem je
projekat pisan mrežna politika blokira `paragraf.rs`, `purs.gov.rs` i
`pravno-informacioni-sistem.rs`, pa puni tekstovi nisu mogli da se povuku.

Provereno i uneto (sa izvorom i datumom važenja):

- PDV: opšta stopa 20%, posebna 10% (ZPDV čl. 23), odbitak prethodnog poreza
  (čl. 28), isključenje za putničke automobile i izuzeci (čl. 29), mali obveznik
  i prag od 8.000.000 RSD (čl. 33)
- Porez na dobit 15% (ZPDPL čl. 39), porez po odbitku 20% / 25% (čl. 40),
  amortizacione grupe (čl. 10b st. 3)
- Zarade: neoporezivi iznos 34.221 RSD (od 1.2.2026), stopa 10%,
  neoporezivi iznosi naknada — prevoz 5.782 RSD, dnevnica 3.471 RSD (ZPDG čl. 18)
- Doprinosi: PIO 24% (14 + 10), zdravstvo 10,30% (5,15 + 5,15), nezaposlenost
  0,75% (ZDOSO čl. 44); osnovice za 2026: najniža 51.297, najviša 732.820 RSD
- Minimalna cena rada 2026: 371,00 RSD neto po radnom času
- Paušal: limit 6.000.000 RSD (ZPDG čl. 40)
- Istorijske vrednosti za 2025. godinu — da obračuni za raniji period rade

Označeno kao **nepotvrđeno** (prikazuje se korisniku sa upozorenjem):

- broj člana za stopu poreza na zarade, godišnji porez na dohodak, osnovice
  doprinosa i rok evidentiranja u SEF-u
- stopa poreza na kapitalni dobitak
- naknada za korišćenje sopstvenog automobila po kilometru — **namerno nije
  seed-ovana**, pa taj deo obračuna prijavi da parametar nedostaje

Pokretanje `npm run ingest` kod korisnika, gde ti domeni nisu blokirani, popunjava
doslovne tekstove i potvrđuje brojeve članova.

---

## Arhitektura ukratko

```
src/lib/legal/     pravna baza: normalizacija srpskog, BM25, embeddings,
                   temporalna logika, retrieval, citiranje
src/lib/ai/        klijent, prompt, shema, pipeline, verifikator, greške
src/lib/calc/      kalkulatori (čiste funkcije, parametri iz baze)
src/app/api/       REST rutovi
src/app/           strane: razgovor, firma, kalkulator, propisi, rokovi,
                   dokument, izmene, admin
scripts/           seed, ingest, index, detect-izmene, tri provere
prisma/schema.prisma   model podataka
```

Produkcija: prebaciti `provider` u `prisma/schema.prisma` na `postgresql` i
zameniti in-process BM25 GIN indeksom, a `OdredbaVektor` pgvector kolonom.
Interfejsi `pretraziPravnuBazu` i `dohvatiParametar` ostaju isti.

---

## Ograničenja

1. Pravna baza je seed, ne pun korpus — pun korpus kroz `npm run ingest`.
2. Semantička pretraga traži embedding ključ; bez njega radi leksička.
3. Rokovi u kalendaru su većinom označeni kao nepotvrđeni — proverite ih prema
   zvaničnom poreskom kalendaru pre nego što se na njih oslonite.
4. Sistem je stručna podrška, ne zamena za ovlašćenog savetnika.

> Informacije koje pruža AI predstavljaju informativnu i stručnu podršku i ne
> predstavljaju zamenu za individualni savet ovlašćenog poreskog savetnika,
> računovođe, advokata ili nadležnog državnog organa.
