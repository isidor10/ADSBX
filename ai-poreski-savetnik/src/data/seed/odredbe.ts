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

  {
    propis: "ZPDV",
    clan: "24",
    naslov: "Poreska oslobođenja SA pravom na odbitak prethodnog poreza",
    tekst:
      "PDV se ne plaća na taksativno naveden promet dobara i usluga iz ovog člana, pri čemu obveznik ZADRŽAVA pravo na odbitak prethodnog poreza. Tu spadaju, između ostalog, izvoz dobara, prevozne i druge usluge neposredno povezane sa izvozom i uvozom, promet dobara koja se unose u slobodnu zonu, kao i promet po međunarodnim ugovorima. Ovo je ključna razlika u odnosu na oslobođenja iz člana 25, kod kojih se pravo na odbitak gubi.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2005-01-01",
    izvorUrl: "https://www.paragraf.rs/propisi/clanovi/clan-24-zakona-o-pdv.html",
    deepLink: "https://www.paragraf.rs/propisi/clanovi/clan-24-zakona-o-pdv.html",
  },
  {
    propis: "ZPDV",
    clan: "25",
    naslov: "Poreska oslobođenja BEZ prava na odbitak prethodnog poreza",
    tekst:
      "Za promet dobara i usluga naveden u ovom članu PDV se ne obračunava, ali obveznik NEMA pravo na odbitak prethodnog poreza po osnovu nabavki povezanih sa tim prometom. Praktična posledica je da ulazni PDV postaje trošak. Kod obveznika koji ima i oporezivi i oslobođeni promet bez prava na odbitak primenjuje se srazmerni odbitak prethodnog poreza.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2005-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-porezu-na-dodatu-vrednost.html",
  },
  {
    propis: "ZPDV",
    clan: "48",
    naslov: "Poreski period",
    tekst:
      "Poreski period za koji se obračunava PDV, podnosi poreska prijava i plaća PDV jeste kalendarsko tromesečje za obveznika koji je u prethodnih 12 meseci ostvario ukupan promet manji od 50.000.000 dinara. Za ostale obveznike poreski period je kalendarski mesec. Obveznik kome je poreski period tromesečje može podneti zahtev za prelazak na mesečni period; prema izmenama, zahtev se podnosi u periodu od 20. do 31. decembra tekuće godine za narednu godinu.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl:
      "https://www.purs.gov.rs/sr/odnosi-s-javnoscu/novosti/10384/izmenjen-rok-za-promenu-pdv-poreskog-perioda-.html",
  },
  {
    propis: "ZPDV",
    clan: "—",
    naslov: "Podnošenje poreske prijave PDV i plaćanje poreza",
    tekst:
      "Obveznik PDV podnosi poresku prijavu (Obrazac PPPDV) nadležnom poreskom organu i plaća utvrđenu obavezu u roku od 15 dana po isteku poreskog perioda. Prijava se podnosi elektronski, preko portala ePorezi. Napomena sistema: rok je proveren prema više izvora i poreskoj praksi, ali broj člana kojim je propisan NIJE potvrđen u ovoj verziji baze.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl: "https://www.purs.gov.rs/",
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

  {
    propis: "ZPDPL",
    clan: "15",
    stav: "6",
    naslov: "Troškovi reprezentacije",
    tekst:
      "Troškovi reprezentacije priznaju se kao rashod u poreskom bilansu najviše do 0,5% ukupnog prihoda. Deo troškova reprezentacije iznad tog limita ne priznaje se kao rashod i iskazuje se na posebnoj poziciji poreskog bilansa. Za razliku od reprezentacije, troškovi reklame i propagande priznaju se bez ograničenja, po opštim pravilima, počev od utvrđivanja poreza na dobit za 2019. godinu.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2019-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_porezu_na_dobit_pravnih_lica.html",
  },
  {
    propis: "ZPDPL",
    clan: "59",
    naslov: "Transferne cene — pojam",
    tekst:
      "Transfernom cenom smatra se cena nastala u vezi sa transakcijama sredstvima ili stvaranjem obaveza među povezanim licima. Obveznik je dužan da transakcije sa povezanim licima posebno iskaže u poreskom bilansu i da uz poreski bilans dostavi dokumentaciju o transfernim cenama, u obliku izveštaja ili izveštaja u skraćenom obliku.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_porezu_na_dobit_pravnih_lica.html",
  },
  {
    propis: "ZPDPL",
    clan: "60",
    naslov: "Metode utvrđivanja cene po principu „van dohvata ruke”",
    tekst:
      "Pri utvrđivanju cene transakcije među povezanim licima po principu „van dohvata ruke” primenjuju se propisane metode. Oblik i sadržina dokumentacije o transfernim cenama, kao i izbor i primena metoda, bliže su uređeni Pravilnikom o transfernim cenama, donetim u skladu sa članovima 59—61 ovog zakona.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/pravilnik_o_transfernim_cenama_i_metodama_koje_se_po_principu_van_dohvata_ruke_primenjuju_kod_utvrdjivanja_cene_transakcija_medju_povezanim_licima.html",
  },
  {
    propis: "ZPDPL",
    clan: "—",
    naslov: "Rok za podnošenje poreske prijave i poreskog bilansa",
    tekst:
      "Poreska prijava za porez na dobit pravnih lica sa poreskim bilansom podnosi se u roku od 180 dana od isteka poreskog perioda za koji se utvrđuje porez. U istom roku dostavlja se i dokumentacija o transfernim cenama. Ako obveznik ne dostavi izveštaj o transfernim cenama u propisanom roku, predviđena je novčana kazna od 100.000 do 2.000.000 dinara. Napomena sistema: rok je proveren, ali broj člana nije potvrđen u ovoj verziji baze.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl:
      "https://biznis.rs/preduzetnik/kompanije-mogu-da-budu-ostro-kaznjene-ako-ne-dostave-izvestaj-o-transfernim-cenama/",
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

  {
    propis: "ZPDG",
    clan: "—",
    naslov: "Porez na prihode od kapitala — dividende",
    tekst:
      "Dividenda koja se isplaćuje fizičkom licu oporezuje se po stopi od 15% na bruto iznos dividende. Isto važi za rezidente i nerezidente, uz mogućnost primene niže stope iz ugovora o izbegavanju dvostrukog oporezivanja kod nerezidenata. U poreskom sistemu Srbije ne postoji razlika između „kvalifikovanih” i „običnih” dividendi — sve se tretiraju jednako. Napomena sistema: stopa je potvrđena prema više izvora, broj člana nije.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl: "https://zuniclaw.com/porez-po-odbitku-u-srbiji/",
  },
  {
    propis: "ZPDG",
    clan: "—",
    naslov: "Porez na kapitalni dobitak",
    tekst:
      "Kapitalni dobitak nastaje kada se imovina proda po ceni višoj od nabavne vrednosti. Za fizička lica stopa iznosi 15% na ostvarenu razliku između prodajne i nabavne cene. Postoje zakonom propisana oslobođenja i izuzimanja (npr. po osnovu perioda držanja imovine ili ulaganja u rešavanje stambenog pitanja), a nabavna cena se za poreske svrhe usklađuje na propisan način. Napomena sistema: stopa je potvrđena prema više izvora, broj člana nije.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2013-01-01",
    izvorUrl: "https://mnp.rs/porez-na-kapitalnu-dobit-od-prodaje-akcija-i-porez-na-dividendu/",
  },

  // ── Zakon o radu ──────────────────────────────────────────────────────────
  {
    propis: "ZOR",
    clan: "—",
    naslov: "Godišnji odmor — zakonski minimum",
    tekst:
      "Zaposleni ima pravo na godišnji odmor u trajanju od najmanje 20 radnih dana u kalendarskoj godini. Pravo na godišnji odmor stiče se posle mesec dana neprekidnog rada. Minimum od 20 dana može se uvećati po osnovu doprinosa na radu, uslova rada, radnog iskustva, stručne spreme i drugih kriterijuma utvrđenih opštim aktom poslodavca ili kolektivnim ugovorom. Napomena sistema: sadržina je proverena, broj člana nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/dnevne-vesti/270126/270126-vest4.html",
  },
  {
    propis: "ZOR",
    clan: "—",
    naslov: "Prekovremeni rad i uvećana zarada",
    tekst:
      "Poslodavac može uvesti prekovremeni rad samo u slučaju više sile, iznenadnog povećanja obima posla i u drugim hitnim okolnostima. Zaposleni ima pravo na uvećanu zaradu za prekovremeni rad u iznosu od najmanje 26% osnovice. Ako se istovremeno stiče više osnova za uvećanje zarade, procenti se sabiraju. Napomena sistema: sadržina je proverena, broj člana nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/dnevne-vesti/270126/270126-vest4.html",
  },
  {
    propis: "ZOR",
    clan: "—",
    naslov: "Naknada zarade za vreme privremene sprečenosti za rad (bolovanje)",
    tekst:
      "Za privremenu sprečenost za rad do 30 dana naknadu zarade isplaćuje poslodavac, u visini od najmanje 65% osnovice. Počev od 31. dana naknadu snosi Republički fond za zdravstveno osiguranje. Za pojedine osnove sprečenosti (npr. povreda na radu ili profesionalna bolest) propisan je viši procenat. Napomena sistema: sadržina je proverena, broj člana nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.pozakonu.rs/blog/radni-odnosi/kompletan-vodic-kroz-zakon-o-radu",
  },

  // ── Zakon o računovodstvu ─────────────────────────────────────────────────
  {
    propis: "ZOR-RAC",
    clan: "—",
    naslov: "Razvrstavanje pravnih lica po veličini",
    tekst:
      "Pravno lice i preduzetnik razvrstavaju se u mikro, malo, srednje ili veliko pravno lice ako na dan sastavljanja redovnog godišnjeg finansijskog izveštaja ispunjavaju najmanje DVA od TRI kriterijuma: prosečan broj zaposlenih, poslovni prihod i vrednost ukupne aktive. Od razvrstavanja zavise obim finansijskih izveštaja, obaveza revizije i primenjivi računovodstveni okvir (MSFI ili MSFI za MSP). Napomena sistema: sadržina je proverena, broj člana i granične vrednosti nisu potvrđeni — granične vrednosti proveriti na sajtu APR.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2021-01-01",
    izvorUrl:
      "https://www.apr.gov.rs/registri/finansijski-izve%C5%A1taji/uputstva-za-dostavljanje-finansijskih-izve%C5%A1taja-za-2018-godinu/razvrstavanje-pravnih-lica-prema-veli%C4%8Dini.2116.html",
  },
  {
    propis: "ZOR-RAC",
    clan: "—",
    naslov: "Rokovi za dostavljanje finansijskih izveštaja Agenciji za privredne registre",
    tekst:
      "Redovan godišnji finansijski izveštaj dostavlja se Agenciji za privredne registre do 31. marta naredne godine. Dokumentacija uz redovan godišnji finansijski izveštaj (uključujući revizorski izveštaj za obveznike revizije) dostavlja se do 30. juna, a konsolidovani godišnji finansijski izveštaj do 31. jula. Obavezu podnošenja imaju sva pravna lica i preduzetnici koji vode poslovne knjige, uključujući mikro pravna lica, zadruge, ustanove i ogranke stranih pravnih lica. Napomena sistema: rokovi su provereni, broj člana nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2021-01-01",
    izvorUrl: "https://www.paragraf.rs/dnevne-vesti/180325/180325-vest4.html",
  },

  // ── ZPPPA ─────────────────────────────────────────────────────────────────
  {
    propis: "ZPPPA",
    clan: "75",
    naslov: "Kamata za neblagovremeno plaćene javne prihode",
    tekst:
      "Na iznos manje ili više plaćenog poreza i sporednih poreskih davanja obračunava se i plaća kamata po stopi jednakoj godišnjoj referentnoj stopi Narodne banke Srbije uvećanoj za deset procentnih poena. Kamata se obračunava počev od narednog dana od dana dospelosti obaveze, primenom prostog interesnog računa od sto.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2003-01-01",
    izvorUrl:
      "https://www.kamata.rs/kamata-za-neplacene-i-neblagovremeno-placene-javne-prihode-zakonska-uredenost",
  },

  // ── eFakture ──────────────────────────────────────────────────────────────
  {
    propis: "ZEF",
    clan: "—",
    naslov: "Rok za prihvatanje ili odbijanje elektronske fakture",
    tekst:
      "Primalac elektronske fakture proverava poslatu e-fakturu pristupom Sistemu elektronskih faktura i prihvata je ili odbija u roku od 15 dana od dana prijema. Ako primalac iz privatnog sektora u tom roku ne prihvati niti odbije fakturu, ponovo se obaveštava da je e-faktura izdata; ako ne postupi ni u roku od pet dana od ponovnog obaveštenja, e-faktura se po isteku tog roka smatra ODBIJENOM. Napomena sistema: rokovi su provereni, broj člana nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2022-07-01",
    izvorUrl:
      "https://www.paragraf.rs/kancelarko/obaveza-izdavanje-e-fakture-cesto-postavljana-pitanja.html",
  },

  // ── Fiskalizacija ─────────────────────────────────────────────────────────
  {
    propis: "ZOF",
    clan: "—",
    naslov: "Obveznik fiskalizacije i obaveza evidentiranja prometa na malo",
    tekst:
      "Obveznik fiskalizacije je obveznik poreza na prihode od samostalne delatnosti i obveznik poreza na dobit pravnih lica koji vrši promet dobara i usluga na malo. Obveznik je dužan da svaki pojedinačno ostvareni promet na malo evidentira preko elektronskog fiskalnog uređaja i izda fiskalni račun u trenutku prometa, bez obzira na način plaćanja (gotovina, instant prenos, ček, platna kartica, drugi bezgotovinski način), uključujući i primljene avanse za budući promet na malo. Vlada može uredbom odrediti delatnosti kod kojih ta obaveza ne postoji. Napomena sistema: sadržina je proverena, broj člana nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2022-05-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-fiskalizaciji-republike-srbije.html",
  },
  {
    propis: "UREDBA-FISKALIZACIJA-IZUZECI",
    clan: "—",
    naslov: "Delatnosti izuzete od obaveze fiskalizacije",
    tekst:
      "Uredbom su određene delatnosti kod čijeg obavljanja ne postoji obaveza evidentiranja prometa na malo preko elektronskog fiskalnog uređaja. Spisak delatnosti utvrđuje se prema šiframa delatnosti i podložan je izmenama — pre oslanjanja na izuzeće obavezno proveriti aktuelan tekst uredbe na sajtu Ministarstva finansija. Napomena sistema: pun spisak delatnosti nije unet u ovu verziju baze.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2022-05-01",
    izvorUrl:
      "https://mfin.gov.rs/sr/aktivnosti-1/uredba-o-odredjivanju-delatnosti-kod-cijeg-obavljanja-ne-postoji-obaveza-evidentiranja-prometa-na-malo-preko-elektronskog-fiskalnog-uredjaja-1",
  },

  // ── Porezi na imovinu ─────────────────────────────────────────────────────
  {
    propis: "ZPI",
    clan: "—",
    naslov: "Porez na prenos apsolutnih prava — stopa",
    tekst:
      "Stopa poreza na prenos apsolutnih prava je jedinstvena i iznosi 2,5% od poreske osnovice. Zakon uređuje tri odvojena poreska oblika: porez na imovinu (godišnji), porez na nasleđe i poklon, i porez na prenos apsolutnih prava — svaki sa sopstvenim pravilima, osnovicom i oslobođenjima. Od 1. januara 2025. godine jedinice lokalne samouprave u celosti utvrđuju, naplaćuju i kontrolišu porez na nasleđe i poklon i porez na prenos apsolutnih prava. Napomena sistema: stopa je potvrđena, broj člana nije.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2025-01-01",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_porezima_na_imovinu.html",
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
