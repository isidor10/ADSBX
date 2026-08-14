# Miranda 👠 — poreski savetnik za Republiku Srbiju

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

### Najlakše — u pregledaču, bez ičega instaliranog

1. Otvorite repozitorijum na GitHub-u → zeleno dugme **Code** → kartica
   **Codespaces** → **Create codespace on main**
2. Sačekajte da se okruženje podigne (2–3 minuta, instalacija ide sama)
3. U terminalu na dnu ekrana otkucajte:

```bash
cd ai-poreski-savetnik && npm run kreni
```

4. Kliknite **Open in Browser** kada iskoči

Nema instalacije, baze, naloga ni podešavanja. Bez API ključa odmah rade
**Kalkulatori, Propisi, Rokovi i Moja firma**; za **Razgovor** i **Analizu
dokumenata** otvorite `.env` i upišite `ANTHROPIC_API_KEY=sk-ant-...`.

### Da li ključ radi

```bash
npm run kljuc
```

Pita Anthropic, ne gleda samo u fajl — pa razlikuje ključ pod navodnicima,
ključ u pogrešnom fajlu, istekao ključ i nalog bez kredita, umesto da za sve
ćuti isto. `npm run kreni` pokreće istu proveru kao četvrti korak.

### Na svom računaru

Potreban je Node.js 20+:

```bash
git clone https://github.com/isidor10/ADSBX.git
cd ADSBX/ai-poreski-savetnik
npm install
npm run kreni
```

`npm run kreni` napravi `.env` sa nasumičnim `SESSION_SECRET`, kreira SQLite
bazu, napuni je proverenim propisima i pokrene aplikaciju na
`http://localhost:3000`. Idempotentno je — ponovno pokretanje ne briše podatke.

### Ručno, korak po korak

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

### Lični ingest sa Paragraf Lex-a

Za vlasnika pretplate koji puni **sopstvenu, lokalnu** bazu:

```bash
npm run ingest:paragraf                  # svi propisi čiji je izvor Paragraf
npm run ingest:paragraf -- --propis=ZOR  # samo jedan
npm run ingest:paragraf -- --ocisti      # briše sve što je ovaj ingest upisao
```

Pristupni podaci idu u `.env`, koji `.gitignore` isključuje iz repozitorijuma:

```
PARAGRAF_KORISNIK=vas.email@primer.rs
PARAGRAF_LOZINKA=vasa-lozinka
```

**Ovo je namerno ograničeno na jednog korisnika.** Paragraf se plaća po nalogu,
a prečišćeni tekstovi i baza kao celina su njihov rad — jedan pretplatnik koji
puni svoju bazu za svoju upotrebu je jedno, posluživanje istog sadržaja
zaposlenima je nešto sasvim drugo. Zato skripta ima dve ograde koje se ne mogu
zaobići zaboravom:

1. **Odbija da radi ako `DATABASE_URL` nije lokalni SQLite** (`file:…`). Nad
   produkcijskim Postgresom se neće pokrenuti.
2. **Piše samo u bazu, nikada u `src/data/seed/*`.** Seed fajlovi su jedino
   što odlazi na Vercel, pa ovaj sadržaj ne može da procuri kroz git.

Spisak upisanog čuva se u `.paragraf-ingest.json` (van gita), pa `--ocisti`
vraća bazu u pređašnje stanje jednom komandom — izlaz ako licenca ne dođe.

Pre nego što aplikaciji pristupi bilo ko osim vlasnika pretplate, za ovaj izvor
treba pribaviti poslovnu licencu od Paragrafa. Za produkciju je predviđen
`npm run ingest`, koji koristi zvanične i besplatne izvore.

---

## Deploy na Vercel

Repozitorijum sadrži **više projekata** (Python scraper u korenu, plus dva
Next.js projekta). Vercel zato mora da zna gde da gleda — inače pokupi koren
ili prethodno podešen projekat.

### 1. Root Directory — ovo je ključno

Pri kreiranju Vercel projekta, u koraku **Configure Project**:

> **Root Directory** → `ai-poreski-savetnik`

Ako ste projekat već napravili: **Settings → General → Root Directory** →
`ai-poreski-savetnik` → Save, pa **Deployments → Redeploy**.

Bez toga Vercel gleda u koren repozitorijuma, gde je Python projekat i nema
šta da se builduje, ili nastavlja sa podešavanjima prethodnog projekta.

Napravite **poseban Vercel projekat** za ovu aplikaciju — nemojte menjati Root
Directory na postojećem projektu `private-aviation-tracker`, jer biste time
preusmerili njegov deploy.

### 2. Baza podataka — SQLite ne radi na Vercelu

Ovo je najvažnija stavka. Vercel funkcije imaju **efemeran fajl-sistem**: sve
što se upiše nestaje pri sledećem pozivu. Sa SQLite bazom biste izgubili
korisnike, profile firmi, razgovore i audit trag.

Za produkciju je potreban **Postgres** (Vercel Postgres, Neon, Supabase ili
bilo koji drugi). U Vercel projektu podesite `DATABASE_URL` na
`postgres://...` i to je sve — `prisma/schema.prisma` se automatski usklađuje.

Prisma ne dozvoljava `provider = env(...)`, pa bi inače morala da postoje dva
schema fajla koja bi se s vremenom razišla. Umesto toga, `scripts/podesi-bazu.ts`
pre svakog build-a postavi `provider` prema obliku `DATABASE_URL`-a. Skripta je
idempotentna, menja tačno jednu liniju i ispisuje šta je uradila.

### 3. Ko sme da koristi objavljenu aplikaciju

**Ovo pročitajte pre nego što podelite adresu.** Svako pitanje troši vaš
`ANTHROPIC_API_KEY`. Aplikacija objavljena bez ograničenja znači da svako ko
sazna adresu troši vaš novac — a to se ne primeti dok ne stigne faktura.

Zato je podrazumevano stanje obrnuto od uobičajenog: **lokalno otvoreno, u
produkciji zatvoreno.** Zaboravljeno podešavanje zaključava vrata umesto da ih
ostavi otvorena.

| Promenljiva | Šta radi |
|---|---|
| `PRISTUP` | `zatvoren` traži prijavu (podrazumevano u produkciji), `otvoren` ne traži |
| `KOD_ZA_REGISTRACIJU` | pozivni kod koji delite zaposlenima |
| `DOZVOLJENI_DOMENI` | npr. `firma.rs` — nalog samo sa službene adrese |

**Prvi korisnik je izuzet od oba filtera i postaje administrator.** Njemu kod
nema ko da da, a bez tog izuzetka bi sveže objavljena aplikacija bila zaključana
i za vlasnika. Zato prvo registrujte sebe, pa tek onda podelite adresu.

### 4. Promenljive okruženja u Vercelu

`.env` nije u gitu, pa ih unesite u **Settings → Environment Variables**:

| Promenljiva | Vrednost |
|---|---|
| `ANTHROPIC_API_KEY` | vaš ključ |
| `DATABASE_URL` | `postgres://…` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `AI_EFFORT` | `high` (opciono) |
| `WEB_SEARCH_ENABLED` | `true` (opciono) |
| `KOD_ZA_REGISTRACIJU` | pozivni kod za zaposlene |
| `DOZVOLJENI_DOMENI` | `firma.rs` (opciono) |

> ⚠️ **Promenljiva mora da se zove tačno `DATABASE_URL`.** Vercel Postgres i
> neke integracije kreiraju `POSTGRES_PRISMA_URL` ili `POSTGRES_URL` — to nije
> dovoljno. Dodajte `DATABASE_URL` sa istom vrednošću. Ako to propustite, build
> staje sa porukom koja vam kaže tačno šta nedostaje.
>
> Proverite i da je promenljiva označena za okruženje u kojem se build izvršava
> (Production / Preview / Development).

### 5. Build komanda — pravna baza se puni sama

Vercel sam pokupi `vercel-build` iz `package.json`:

```
podesi-bazu → prisma generate → prisma db push → seed → next build
```

Seed je deo build-a, pa **nema ručnog koraka posle deploya**. Bezbedno je da se
izvršava svaki put: sve ide kroz `upsert` po prirodnom ključu i dira isključivo
pravni sadržaj — korisnici, profili firmi, razgovori i audit trag se ne diraju.
Provereno sa tri uzastopna pokretanja: pravni sadržaj ostaje stabilan
(`0 novih, 39 ažuriranih`), korisnički podaci netaknuti.

`prisma db push` je namerno **bez** `--accept-data-loss`. Ako bi izmena šeme
zahtevala brisanje podataka, build će pući sa jasnom porukom umesto da tiho
obriše korisničke podatke. Kada do toga dođe, migraciju uradite svesno.

Ako baš želite da seed pokrenete ručno sa svog računara:

```bash
DATABASE_URL="postgres://…" npm run seed:prod
```

### 6. Ograničenja koja treba znati

- `maxDuration` za `/api/chat` i `/api/dokumenti` je 300 s. Na **Hobby** planu
  limit je 60 s, pa složena pitanja sa web pretragom mogu da isteknu — za
  ozbiljnu upotrebu potreban je Pro plan.
- Region je podešen na `fra1` (Frankfurt), najbliži Srbiji.
- Ograničavanje broja zahteva radi u memoriji instance. Na više instanci nije
  deljeno — za produkciju sa više saobraćaja zamenite ga Redisom.

---

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

Trenutno stanje: **24 propisa, 39 odredbi, 48 poreskih parametara, 12 rokova.**

Sa **potvrđenim brojem člana** (član proveren prema izvoru):

| Propis | Članovi | Sadržaj |
|---|---|---|
| ZPDV | 23, 24, 25, 28, 29, 33, 48 | stope 20/10%, oslobođenja sa i bez prava na odbitak, odbitak prethodnog poreza, isključenje za putničke automobile i izuzeci, mali obveznik (prag 8.000.000), poreski period (prag 50.000.000) |
| ZPDPL | 10b st. 3, 15 st. 6, 39, 40, 59, 60 | amortizacione grupe, reprezentacija 0,5%, stopa 15%, porez po odbitku 20/25%, transferne cene |
| ZPDG | 15a, 18, 33, 40 | neoporezivi iznos zarade 34.221 RSD, neoporezive naknade (prevoz 5.782, dnevnica 3.471), osnovica samostalne delatnosti, paušal |
| ZDOSO | 44 | PIO 24% (14+10), zdravstvo 10,30% (5,15+5,15), nezaposlenost 0,75% |
| ZPPPA | 75 | kamata = referentna stopa NBS + 10 procentnih poena |
| Odluka o min. ceni rada | 1 | 371,00 RSD neto po radnom času za 2026. |

Sa **potvrđenom sadržinom, ali nepotvrđenim brojem člana** — prikazuje se uz
poruku da član nije potvrđen:

- stopa poreza na zarade 10%, godišnji porez na dohodak (prag 5.439.096 RSD,
  stope 10/15%), dividende 15%, kapitalni dobitak 15%
- rok PDV prijave (15 dana), rok prijave poreza na dobit i transfernih cena
  (180 dana), rok evidentiranja PDV u SEF-u (10 dana), rok prihvatanja
  e-fakture (15 dana, pa 5 dana → smatra se odbijenom)
- Zakon o radu: godišnji odmor min. 20 radnih dana, prekovremeni rad min. +26%,
  bolovanje do 30 dana 65% na teret poslodavca
- Zakon o računovodstvu: razvrstavanje po 2 od 3 kriterijuma, rokovi APR
  (31. mart / 30. jun / 31. jul)
- fiskalizacija: ko je obveznik i obaveza evidentiranja svakog prometa na malo
- porez na prenos apsolutnih prava 2,5%
- osnovice doprinosa za 2026. (51.297 / 732.820 RSD)

**Namerno nije uneto:** neoporezivi iznos naknade za korišćenje sopstvenog
automobila po kilometru. Taj deo obračuna prijavi da parametar nedostaje umesto
da izračuna iznos koji ne možemo da potkrepimo izvorom.

Istorijske vrednosti za 2025. godinu su unete, pa obračuni za raniji period rade.

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
