/**
 * Odredbe koje ulaze u početnu bazu.
 *
 * `potvrdjenBrojClana: true` znači da je broj člana proveren prema izvoru i da
 * sme da se prikaže kao potvrđen. Gde je `false`, aplikacija umesto broja člana
 * ispisuje da član nije potvrđen — to je zahtev 3 i drži se doslovno.
 *
 * `doslovanTekst: false` znači da je tekst sažetak sadržine odredbe, a ne
 * doslovan tekst propisa; sažetak se nikada ne prikazuje pod navodnicima kao
 * tekst zakona. Doslovne tekstove popunjava `npm run ingest`.
 */

export interface SeedOdredba {
  propis: string;
  clan: string;
  stav?: string;
  tacka?: string;
  naslov?: string;
  tekst: string;
  potvrdjenBrojClana: boolean;
  doslovanTekst: boolean;
  vaziOd: string;
  vaziDo?: string;
  izvorUrl: string;
  deepLink?: string;
}

export const ODREDBE: SeedOdredba[] = [
  // ── ZPDV ──────────────────────────────────────────────────────────────────
  {
    propis: "ZPDV",
    clan: "23",
    stav: "1",
    naslov: "Opšta stopa PDV",
    tekst:
      "Opšta stopa PDV za oporezivi promet dobara i usluga ili uvoz dobara iznosi 20%. Ova stopa primenjuje se na sav promet koji nije izričito obuhvaćen posebnom stopom.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dodatu-vrednost.html",
  },
  {
    propis: "ZPDV",
    clan: "23",
    stav: "2",
    naslov: "Posebna (snižena) stopa PDV",
    tekst:
      "Po posebnoj stopi PDV od 10% oporezuje se promet dobara i usluga, odnosno uvoz dobara koji su taksativno navedeni u ovom stavu — između ostalog hleb i drugi pekarski proizvodi, mleko i mlečni proizvodi, brašno, šećer, jestiva ulja od suncokreta, kukuruza, uljane repice, soje i masline, jestive masti biljnog i životinjskog porekla i med. Posebna stopa primenjuje se isključivo na dobra i usluge sa te liste.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dodatu-vrednost.html",
  },
  {
    propis: "ZPDV",
    clan: "28",
    stav: "1",
    naslov: "Pravo na odbitak prethodnog poreza",
    tekst:
      "Obveznik može da odbije prethodni porez od PDV koji duguje, i to: obračunati i iskazani PDV za promet dobara i usluga koji mu je izvršio ili će mu izvršiti drugi obveznik PDV, kao i PDV koji je plaćen pri uvozu dobara. Pravo na odbitak postoji ako se nabavljena dobra ili primljene usluge koriste ili će se koristiti za promet dobara i usluga obveznika, uz ispunjenje formalnih uslova propisanih zakonom.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2005-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dodatu-vrednost.html",
  },
  {
    propis: "ZPDV",
    clan: "29",
    stav: "1",
    naslov: "Isključenje prava na odbitak prethodnog poreza",
    tekst:
      "Obveznik nema pravo na odbitak prethodnog poreza po osnovu nabavke, proizvodnje i uvoza putničkih automobila, motocikala, motocikala sa bočnim sedištem, tricikala, četvorocikala, jahti, čamaca i vazduhoplova, objekata za smeštaj tih dobara, rezervnih delova, goriva i potrošnog materijala za njihove potrebe, kao ni po osnovu iznajmljivanja, održavanja, popravki i drugih usluga koje su povezane sa korišćenjem tih prevoznih sredstava.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2005-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dodatu-vrednost.html",
  },
  {
    propis: "ZPDV",
    clan: "29",
    stav: "2",
    naslov: "Izuzetak od isključenja prava na odbitak",
    tekst:
      "Izuzetno, obveznik ima pravo na odbitak prethodnog poreza ako navedena prevozna sredstva koristi isključivo za obavljanje delatnosti: prometa i iznajmljivanja tih prevoznih sredstava i drugih dobara, odnosno prevoza lica i dobara ili obuke vozača za upravljanje tim prevoznim sredstvima. Time su obuhvaćene, između ostalog, auto-škole, rent-a-car agencije, taksi prevoz i druga privredna društva koja se bave prometom i izdavanjem putničkih automobila odnosno prevozom lica i dobara.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2005-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dodatu-vrednost.html",
  },
  {
    propis: "ZPDV",
    clan: "33",
    naslov: "Mali poreski obveznici",
    tekst:
      "Malim obveznikom smatra se lice koje vrši promet dobara i usluga na teritoriji Republike i/ili u inostranstvu, a čiji ukupan promet dobara i usluga u prethodnih 12 meseci nije veći od 8.000.000 dinara, odnosno koje pri otpočinjanju obavljanja delatnosti procenjuje da u narednih 12 meseci neće ostvariti ukupan promet veći od 8.000.000 dinara. Mali obveznik ne obračunava PDV za izvršeni promet, nema pravo iskazivanja PDV u računima i nema pravo na odbitak prethodnog poreza. Obveznik koji u prethodnih 12 meseci ostvari ukupan promet veći od 8.000.000 dinara dužan je da podnese evidencionu prijavu u roku od pet dana od dana ostvarivanja tog prometa. Mali obveznik može se dobrovoljno opredeliti za plaćanje PDV, uz obavezu da u tom sistemu ostane najmanje dve godine.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2017-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/clanovi/clan-33-zakona-o-pdv.html",
    deepLink:
      "https://www.paragraf.rs/propisi/clanovi/clan-33-zakona-o-pdv.html",
  },

  // ── ZPDPL ─────────────────────────────────────────────────────────────────
  {
    propis: "ZPDPL",
    clan: "39",
    naslov: "Stopa poreza na dobit pravnih lica",
    tekst:
      "Stopa poreza na dobit pravnih lica je proporcionalna i jednoobrazna i iznosi 15%. Primenjuje se na oporezivu dobit utvrđenu u poreskom bilansu, a ne na računovodstvenu dobit iz bilansa uspeha.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_porezu_na_dobit_pravnih_lica.html",
  },
  {
    propis: "ZPDPL",
    clan: "40",
    naslov: "Porez po odbitku na prihode nerezidentnih pravnih lica",
    tekst:
      "Porez na dobit po odbitku po stopi od 20% obračunava se i plaća na prihode koje ostvari nerezidentno pravno lice od rezidentnog pravnog lica, po osnovu dividendi, naknada od autorskog i srodnih prava i prava industrijske svojine, kamata, naknada po osnovu zakupa i naknada po osnovu određenih usluga. Na prihode koje po tim osnovima ostvari nerezidentno pravno lice iz jurisdikcije sa preferencijalnim poreskim sistemom obračunava se porez po odbitku po stopi od 25%. Ako je zaključen ugovor o izbegavanju dvostrukog oporezivanja, može se primeniti niža stopa iz ugovora, pod uslovom da nerezident dokaže status rezidenta druge države i svojstvo stvarnog vlasnika prihoda.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_porezu_na_dobit_pravnih_lica.html",
  },
  {
    propis: "ZPDPL",
    clan: "10b",
    stav: "3",
    naslov: "Amortizacione grupe i stope poreske amortizacije",
    tekst:
      "Stalna sredstva razvrstavaju se u amortizacione grupe i amortizuju po stopama propisanim ovim stavom. Prva amortizaciona grupa amortizuje se po stopi od 2,5% proporcionalnom metodom po sredstvu, dok se za ostale grupe primenjuju stope od 10%, 15%, 20% i 30% degresivnom metodom na neotpisanu vrednost. Razvrstavanje pojedinačnih sredstava u grupe uređeno je posebnim pravilnikom.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2019-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/pravilnik-o-poreskoj-amortizaciji.html",
  },

  // ── ZPDG ──────────────────────────────────────────────────────────────────
  {
    propis: "ZPDG",
    clan: "15a",
    naslov: "Neoporezivi iznos zarade",
    tekst:
      "Osnovicu poreza na zarade čini isplaćena, odnosno ostvarena zarada umanjena za propisani neoporezivi iznos. Neoporezivi iznos usklađuje se godišnje indeksom potrošačkih cena. Za period od 1. februara 2026. do 31. januara 2027. godine neoporezivi iznos zarade iznosi 34.221 dinar mesečno, na osnovu Zakona o izmenama i dopunama Zakona o porezu na dohodak građana objavljenog u „Sl. glasniku RS” br. 109/2025.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2026-02-01",
    vaziDo: "2027-02-01",
    izvorUrl:
      "https://www.paragraf.rs/statistika/pregled_uskladjenih_neoporezivih_iznosa_po_zakonu_o_porezu_na_dohodak_gradjana.html",
  },
  {
    propis: "ZPDG",
    clan: "40",
    naslov: "Paušalno oporezivanje preduzetnika",
    tekst:
      "Preduzetnik koji ispunjava propisane uslove ima pravo da porez na prihode od samostalne delatnosti plaća na paušalno utvrđen prihod, umesto na osnovu poslovnih knjiga. Paušalni prihod utvrđuje Poreska uprava rešenjem, polazeći od prosečne mesečne zarade po zaposlenom ostvarene u Republici, gradu, opštini odnosno gradskoj opštini, koja se koriguje koeficijentom delatnosti i korektivnim koeficijentima. Pravo na paušalno oporezivanje uslovljeno je, između ostalog, time da godišnji promet ne prelazi propisani limit.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2020-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dohodak-gradjana.html",
  },
  {
    propis: "ZPDG",
    clan: "33",
    naslov: "Poreska osnovica prihoda od samostalne delatnosti",
    tekst:
      "Oporezivi prihod od samostalne delatnosti je oporeziva dobit utvrđena u poreskom bilansu, a za preduzetnika koji se paušalno oporezuje — paušalno utvrđen prihod. Preduzetnik se može opredeliti za isplatu lične zarade, koja se u tom slučaju priznaje kao rashod u poreskom bilansu.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2020-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dohodak-gradjana.html",
  },
  {
    propis: "ZPDG",
    clan: "—",
    naslov: "Stopa poreza na zarade",
    tekst:
      "Stopa poreza na zarade iznosi 10% i primenjuje se na poresku osnovicu, koju čini bruto zarada umanjena za neoporezivi iznos. Napomena sistema: stopa je proverena prema više izvora, ali broj člana kojim je propisana NIJE potvrđen prema zvaničnom tekstu zakona u ovoj verziji baze.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2007-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dohodak-gradjana.html",
  },
  {
    propis: "ZPDG",
    clan: "—",
    naslov: "Godišnji porez na dohodak građana",
    tekst:
      "Godišnji porez na dohodak građana plaćaju fizička lica čiji je dohodak u kalendarskoj godini veći od trostrukog iznosa prosečne godišnje zarade po zaposlenom isplaćene u Republici. Za dohodak ostvaren u 2025. godini neoporezivi iznos iznosi 5.439.096 dinara. Na oporezivi dohodak primenjuje se stopa od 10% do iznosa od 10.878.192 dinara, a na deo iznad tog iznosa stopa od 15%. Prijava se podnosi elektronski, na obrascu PP GPDG, do 15. maja. Napomena sistema: iznosi su provereni, ali broj člana nije potvrđen u ovoj verziji baze.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2026-01-01",
    izvorUrl:
      "https://kpmg.com/rs/sr/analize-i-istrazivanja/poreske-vesti/2026/02/godisnji-porez-na-dohodak-gradjana-ostvaren-u-2025-godini.html",
  },

  {
    propis: "ZPDG",
    clan: "18",
    naslov:
      "Neoporezivi iznosi primanja zaposlenih koja nemaju karakter zarade",
    tekst:
      "Ne plaća se porez na zarade na primanja zaposlenog do propisanih iznosa, i to po osnovu naknade troškova prevoza za dolazak i odlazak sa rada, dnevnice za službeno putovanje u zemlji, solidarne pomoći, jubilarne nagrade, poklona deci zaposlenih, naknade za korišćenje sopstvenog automobila u službene svrhe i drugih primanja navedenih u ovom članu. Iznosi se usklađuju jednom godišnje i primenjuju od 1. februara. Za period od 1. februara 2026. do 31. januara 2027. godine neoporezivi iznos naknade troškova prevoza iznosi 5.782 dinara mesečno, a dnevnice za službeno putovanje u zemlji 3.471 dinar. Iznos isplaćen preko neoporezivog dela ima poreski tretman drugog primanja.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2026-02-01",
    vaziDo: "2027-02-01",
    izvorUrl: "https://www.paragraf.rs/dnevne-vesti/280126/280126-vest5.html",
  },

  // ── ZDOSO ─────────────────────────────────────────────────────────────────
  {
    propis: "ZDOSO",
    clan: "44",
    naslov: "Stope doprinosa za obavezno socijalno osiguranje",
    tekst:
      "Doprinos za obavezno penzijsko i invalidsko osiguranje obračunava se po stopi od 24%, doprinos za obavezno zdravstveno osiguranje po stopi od 10,30%, a doprinos za osiguranje za slučaj nezaposlenosti po stopi od 0,75%. Kod zarada iz radnog odnosa doprinosi se dele na deo na teret zaposlenog (PIO 14%, zdravstvo 5,15%, nezaposlenost 0,75% — ukupno 19,90%) i deo na teret poslodavca (PIO 10%, zdravstvo 5,15% — ukupno 15,15%).",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2020-01-01",
    izvorUrl:
      "https://purs.gov.rs/upload/media/2025/12/15/760519/Zakon_o_doprinosima_za_obavezno_socijalno_osiguranje_-_u_primeni_od_01012026.pdf",
  },
  {
    propis: "ZDOSO",
    clan: "—",
    naslov: "Najniža i najviša mesečna osnovica doprinosa za 2026. godinu",
    tekst:
      "Najniža mesečna osnovica doprinosa za obavezno socijalno osiguranje za 2026. godinu iznosi 51.297 dinara, a najviša mesečna osnovica 732.820 dinara. Najviša godišnja osnovica doprinosa za 2026. godinu iznosi 8.793.840 dinara. Napomena sistema: iznosi su provereni, ali broj člana kojim su propisani nije potvrđen u ovoj verziji baze.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2026-01-01",
    vaziDo: "2027-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/iznos-najvise-mesecne-osnovice-doprinosa-za-obavezno-socijalno-osiguranje-za-2026-godinu.html",
  },

  // ── Minimalna cena rada ───────────────────────────────────────────────────
  {
    propis: "ODLUKA-MIN-CENA-RADA-2026",
    clan: "1",
    naslov: "Visina minimalne cene rada za 2026. godinu",
    tekst:
      "Minimalna cena rada, bez poreza i doprinosa, za period januar–decembar 2026. godine iznosi 371,00 dinar neto po radnom času. Primenjuje se počev od 1. januara 2026. godine. Mesečni iznos minimalne zarade zavisi od broja radnih časova u konkretnom mesecu.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2026-01-01",
    vaziDo: "2027-01-01",
    izvorUrl:
      "https://ipc.rs/vest/minimalna-cena-rada-za-2026-godinu-iznosice-37100-dinar-neto-po-radnom-casu_v2346",
  },

  // ── eFakture ──────────────────────────────────────────────────────────────
  {
    propis: "PRAVILNIK-EF",
    clan: "—",
    naslov: "Rok za elektronsko evidentiranje obračuna PDV u SEF-u",
    tekst:
      "Elektronsko evidentiranje obračuna PDV u sistemu elektronskih faktura vrši se za poreski period, u roku od deset dana po isteku poreskog perioda. Ako deseti dan pada u neradni dan, rok se pomera na prvi naredni radni dan. Evidentiranje se može vršiti zbirno za sve obaveze u poreskom periodu ili pojedinačno po transakciji. Napomena sistema: broj člana pravilnika nije potvrđen u ovoj verziji baze.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2023-01-01",
    izvorUrl:
      "https://www.paragraf.rs/baza-znanja/knjigovodstvo/rokovi-evidentiranja-pdv-i-ispravke-evidentiranog-pdv-u-sef-popdv.html",
  },
];
