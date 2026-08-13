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
  /*
   * Radno pravo je za računovođu poreska tema.
   *
   * Skoro svaki obračun zarade oslanja se na neki član ovog zakona: minuli rad
   * i prekovremeni na 108, bolovanje na 115, prevoz i dnevnice na 118,
   * otpremnina na 119 i 158. Ranije su ovde stajale tri odredbe bez ijednog
   * potvrđenog broja člana, pa je aplikacija na pitanje o zaradi umela da
   * odgovori tačno po sadržini, a bez osnova koji se sme citirati.
   *
   * Brojevi članova ispod provereni su prema stručnim pravnim izvorima koji
   * broj navode zajedno sa sadržinom odredbe. Tekstovi su sažeci, ne doslovan
   * tekst zakona — otud `doslovanTekst: false` na svakom zapisu.
   */
  {
    propis: "ZOR",
    clan: "33",
    naslov: "Sadržina ugovora o radu",
    tekst:
      "Ugovor o radu sadrži naziv i sedište poslodavca, lične podatke zaposlenog, vrstu i stepen stručne spreme, naziv i opis posla, mesto rada, vrstu radnog odnosa (na neodređeno ili određeno vreme), trajanje ugovora na određeno vreme, dan početka rada, radno vreme, novčani iznos osnovne zarade i elemente za utvrđivanje radnog učinka, naknade zarade, uvećane zarade i druga primanja, rokove za isplatu i trajanje dnevnog i nedeljnog odmora. Ugovor ne mora da sadrži elemente koji su utvrđeni zakonom, kolektivnim ugovorom ili pravilnikom o radu — u tom slučaju mora da uputi na akt kojim su ta prava utvrđena.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "36",
    naslov: "Probni rad",
    tekst:
      "Ugovorom o radu može da se ugovori probni rad za obavljanje jednog ili više povezanih, odnosno srodnih poslova utvrđenih ugovorom o radu. Probni rad može da traje najduže šest meseci. Pre isteka vremena za koje je ugovoren probni rad, poslodavac ili zaposleni može da otkaže ugovor o radu uz otkazni rok koji ne može biti kraći od pet radnih dana; poslodavac je dužan da obrazloži otkaz.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "51",
    naslov: "Puno radno vreme",
    tekst:
      "Puno radno vreme iznosi 40 časova nedeljno, ako ovim zakonom nije drukčije određeno. Opštim aktom može da se odredi da puno radno vreme bude kraće od 40 časova nedeljno, ali ne kraće od 36 časova nedeljno. Zaposleni koji radi kraće od 40 časova u tom slučaju ostvaruje sva prava iz radnog odnosa kao da radi puno radno vreme.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "53",
    naslov: "Prekovremeni rad — uslovi i ograničenja",
    tekst:
      "Na zahtev poslodavca zaposleni je dužan da radi duže od punog radnog vremena u slučaju više sile, iznenadnog povećanja obima posla i u drugim slučajevima kada je neophodno da se u određenom roku završi posao koji nije planiran. Prekovremeni rad ne može da traje duže od osam časova nedeljno, niti duže od 12 časova dnevno uključujući i redovan rad. Uvećanje zarade po osnovu prekovremenog rada uređeno je članom 108.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "69",
    naslov: "Godišnji odmor — zakonski minimum",
    tekst:
      "Zaposleni ima pravo na godišnji odmor u svakoj kalendarskoj godini u trajanju utvrđenom opštim aktom i ugovorom o radu, a najmanje 20 radnih dana. Dužina godišnjeg odmora utvrđuje se tako što se zakonski minimum od 20 radnih dana uvećava po osnovu doprinosa na radu, uslova rada, radnog iskustva, stručne spreme zaposlenog i drugih kriterijuma utvrđenih opštim aktom ili ugovorom o radu.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "108",
    naslov: "Uvećana zarada — osnovi i procenti",
    tekst:
      "Zaposleni ima pravo na uvećanu zaradu u visini utvrđenoj opštim aktom i ugovorom o radu, i to: za rad na dan praznika koji je neradni dan — najmanje 110% od osnovice; za rad noću, ako takav rad nije vrednovan pri utvrđivanju osnovne zarade — najmanje 26% od osnovice; za prekovremeni rad — najmanje 26% od osnovice; po osnovu vremena provedenog na radu za svaku punu godinu rada ostvarenu u radnom odnosu kod poslodavca (minuli rad) — najmanje 0,4% od osnovice. Ako se istovremeno steknu uslovi po više osnova, procenat uvećane zarade ne može biti niži od zbira procenata po svakom od osnova. Osnovicu čini osnovna zarada utvrđena u skladu sa zakonom, opštim aktom i ugovorom o radu.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "111",
    naslov: "Pravo na minimalnu zaradu",
    tekst:
      "Zaposleni ima pravo na minimalnu zaradu za standardni učinak i vreme provedeno na radu. Minimalna zarada određuje se na osnovu minimalne cene rada utvrđene u skladu sa ovim zakonom, vremena provedenog na radu i poreza i doprinosa koji se plaćaju iz zarade. Zaposleni koji prima minimalnu zaradu ima pravo i na uvećanu zaradu iz člana 108, na naknadu troškova iz člana 118 i na druga primanja iz člana 119.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "112",
    naslov: "Utvrđivanje minimalne cene rada",
    tekst:
      "Minimalna cena rada utvrđuje se odlukom socijalno-ekonomskog saveta osnovanog za teritoriju Republike Srbije. Utvrđuje se po radnom času bez poreza i doprinosa, za kalendarsku godinu, najkasnije do 15. septembra tekuće godine, a primenjuje se od 1. januara naredne godine. Ako socijalno-ekonomski savet ne donese odluku u roku od 15 dana od dana početka pregovora, odluku donosi Vlada u narednom roku od 15 dana. Odluka o minimalnoj ceni rada objavljuje se u „Službenom glasniku Republike Srbije”.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "115",
    naslov: "Naknada zarade za vreme privremene sprečenosti za rad (bolovanje)",
    tekst:
      "Zaposleni ima pravo na naknadu zarade za vreme odsustvovanja sa rada zbog privremene sprečenosti za rad do 30 dana, i to: najmanje 65% prosečne zarade u prethodnih 12 meseci pre meseca u kojem je nastupila sprečenost, ako je sprečenost prouzrokovana bolešću ili povredom van rada; najmanje 100% prosečne zarade u prethodnih 12 meseci, ako je sprečenost prouzrokovana povredom na radu ili profesionalnom bolešću. Naknada ne može biti niža od minimalne zarade utvrđene u skladu sa ovim zakonom. Počev od 31. dana naknadu snosi Republički fond za zdravstveno osiguranje, osim kod povrede na radu i profesionalne bolesti, gde je snosi poslodavac.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "118",
    naslov: "Naknada troškova — prevoz, službeni put, ishrana, regres",
    tekst:
      "Zaposleni ima pravo na naknadu troškova u skladu sa opštim aktom i ugovorom o radu, i to: za dolazak i odlazak sa rada, u visini cene prevozne karte u javnom saobraćaju (stav 1 tačka 1); za vreme provedeno na službenom putu u zemlji i u inostranstvu; za smeštaj i ishranu za rad i boravak na terenu; za ishranu u toku rada i za regres za korišćenje godišnjeg odmora, ako ti troškovi nisu već uračunati u osnovnu zaradu. Poreski tretman ovih naknada (neoporezivi iznosi) uređen je Zakonom o porezu na dohodak građana.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "119",
    naslov: "Druga primanja — otpremnina za penziju, pomoć, jubilarna nagrada",
    tekst:
      "Poslodavac je dužan da isplati zaposlenom otpremninu pri odlasku u penziju, najmanje u visini dve prosečne zarade u Republici Srbiji prema poslednjem objavljenom podatku republičkog organa nadležnog za statistiku (stav 1 tačka 1), kao i naknadu troškova pogrebnih usluga i naknadu štete zbog povrede na radu ili profesionalne bolesti. Poslodavac može zaposlenom da isplati i jubilarnu nagradu, solidarnu pomoć i druga primanja u skladu sa opštim aktom, pri čemu zaposleni koji prima minimalnu zaradu ima pravo na ta primanja pod istim uslovima.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "158",
    naslov: "Otpremnina zbog prestanka radnog odnosa (tehnološki višak)",
    tekst:
      "Poslodavac je dužan da pre otkaza ugovora o radu zbog prestanka potrebe za radom zaposlenog usled tehnoloških, ekonomskih ili organizacionih promena isplati zaposlenom otpremninu. Visina otpremnine utvrđuje se opštim aktom ili ugovorom o radu, s tim što ne može biti niža od zbira trećine zarade zaposlenog za svaku navršenu godinu rada u radnom odnosu kod poslodavca kod koga ostvaruje pravo na otpremninu.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "178",
    naslov: "Otkaz ugovora o radu od strane zaposlenog",
    tekst:
      "Zaposleni ima pravo da poslodavcu otkaže ugovor o radu. Otkaz se dostavlja poslodavcu u pisanom obliku, najmanje 15 dana pre dana koji je zaposleni naveo kao dan prestanka radnog odnosa. Opštim aktom ili ugovorom o radu može se utvrditi duži otkazni rok, ali ne duži od 30 dana.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "179",
    naslov: "Otkaz ugovora o radu od strane poslodavca",
    tekst:
      "Poslodavac može zaposlenom da otkaže ugovor o radu ako za to postoji opravdani razlog koji se odnosi na radnu sposobnost zaposlenog i njegovo ponašanje — ako ne ostvaruje rezultate rada ili nema potrebna znanja i sposobnosti za obavljanje poslova na kojima radi (stav 1 tačka 1), kao i u slučajevima povrede radne obaveze, nepoštovanja radne discipline i drugih zakonom propisanih razloga. Kod otkaza iz stava 1 tačke 1 poslodavac je dužan da zaposlenom prethodno dâ pisano obaveštenje o nedostacima u radu, uputstva i primeren rok za poboljšanje.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "189",
    naslov: "Otkazni rok kod otkaza zbog neostvarivanja rezultata rada",
    tekst:
      "Zaposleni kome je ugovor o radu otkazan zato što ne ostvaruje potrebne rezultate rada, odnosno nema potrebna znanja i sposobnosti, ima pravo na otkazni rok koji se utvrđuje opštim aktom ili ugovorom o radu, u zavisnosti od staža osiguranja, a koji ne može biti kraći od osam niti duži od 30 dana. Otkazni rok počinje da teče narednog dana od dana dostavljanja rešenja o otkazu ugovora o radu.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "196",
    naslov: "Zastarelost novčanih potraživanja iz radnog odnosa",
    tekst:
      "Sva novčana potraživanja iz radnog odnosa zastarevaju u roku od tri godine od dana nastanka obaveze. Kod neisplaćene zarade dan nastanka obaveze je dan kada je zarada po ugovoru ili opštem aktu trebalo da bude isplaćena, i to za svaki mesec posebno. U slučaju prestanka radnog odnosa poslodavac je dužan da najkasnije u roku od 30 dana od dana prestanka radnog odnosa isplati sve neisplaćene zarade, naknade zarade i druga primanja, pa rok zastarelosti počinje da teče tek po isteku tog roka.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "197",
    naslov: "Ugovor o privremenim i povremenim poslovima",
    tekst:
      "Poslodavac može za obavljanje poslova koji su po svojoj prirodi takvi da ne traju duže od 120 radnih dana u kalendarskoj godini da zaključi ugovor o obavljanju privremenih i povremenih poslova sa nezaposlenim licem, zaposlenim koji radi nepuno radno vreme (do punog radnog vremena) i korisnikom starosne penzije. Ugovor se zaključuje u pisanom obliku i njime se ne zasniva radni odnos. Rad van radnog odnosa uređen je članovima 197 do 202.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
  },
  {
    propis: "ZOR",
    clan: "199",
    naslov: "Ugovor o delu",
    tekst:
      "Poslodavac može sa određenim licem da zaključi ugovor o delu radi obavljanja poslova koji su van delatnosti poslodavca, a koji imaju za predmet samostalnu izradu ili opravku određene stvari, samostalno izvršenje određenog fizičkog ili intelektualnog posla. Ugovor o delu može da se zaključi i sa licem koje obavlja umetničku ili drugu delatnost u oblasti kulture, u skladu sa zakonom. Ugovor se zaključuje u pisanom obliku. Uslov da poslovi budu van delatnosti poslodavca je bitno obeležje ovog ugovora — poslovi koji su sistematizovani kod poslodavca ne mogu biti predmet ugovora o delu.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2014-07-29",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_radu.html",
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
  // ── Poreski postupak — zastarelost ────────────────────────────────────────
  /*
   * Dva roka koja odlučuju da li poreski dug uopšte postoji.
   *
   * Relativna zastarelost se prekida svakom radnjom poreskog organa, pa se u
   * praksi pomera godinama; apsolutna ne. Ko pita „da li ovaj dug još važi",
   * pita o jednom od ova dva roka — i pogrešan odgovor košta tačno onoliko
   * koliko dug iznosi.
   */
  {
    propis: "ZPPPA",
    clan: "114",
    naslov: "Zastarelost prava na utvrđivanje i naplatu poreza (relativna)",
    tekst:
      "Pravo Poreske uprave na utvrđivanje i naplatu poreza i sporednih poreskih davanja zastareva za pet godina od dana kada je zastarelost počela da teče. Zastarelost prava na utvrđivanje počinje da teče od prvog dana naredne godine od godine u kojoj je trebalo utvrditi porez, a zastarelost prava na naplatu od prvog dana naredne godine od godine u kojoj je obaveza dospela za plaćanje. Rok se prekida svakom radnjom poreskog organa preduzetom radi utvrđivanja ili naplate, pa posle prekida počinje da teče iznova.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2003-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-poreskom-postupku-i-poreskoj-administraciji.html",
  },
  {
    propis: "ZPPPA",
    clan: "114ž",
    naslov: "Apsolutna zastarelost poreske obaveze",
    tekst:
      "Pravo na utvrđivanje, naplatu, povraćaj, poreski kredit, refakciju, refundaciju i namirenje dospelih obaveza putem preknjižavanja poreza uvek zastareva u roku od deset godina od isteka godine u kojoj je porez trebalo utvrditi ili naplatiti, odnosno u kojoj je izvršena preplata. Za razliku od relativne zastarelosti, ovaj rok se ne prekida radnjama poreskog organa. Po isteku deset godina nadležni poreski organ po službenoj dužnosti donosi rešenje o prestanku poreske obaveze zbog zastarelosti.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2003-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-poreskom-postupku-i-poreskoj-administraciji.html",
  },

  // ── Porezi na imovinu ─────────────────────────────────────────────────────
  {
    propis: "ZPI",
    clan: "—",
    naslov: "Stopa poreza na prenos apsolutnih prava",
    tekst:
      "Stopa poreza na prenos apsolutnih prava je proporcionalna i iznosi 2,5%. Porez se plaća kod prenosa uz naknadu prava svojine na nepokretnosti i drugih apsolutnih prava propisanih zakonom, ako na taj prenos nije plaćen PDV. Napomena sistema: stopa je proverena, broj člana nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2005-01-01",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_porezima_na_imovinu.html",
  },
  {
    propis: "ZPI",
    clan: "—",
    naslov: "Stope poreza na nasleđe i poklon",
    tekst:
      "Obveznici koji su u odnosu na ostavioca, odnosno poklonodavca, u drugom naslednom redu plaćaju porez na nasleđe i poklon po stopi od 1,5%. Obveznici koji su u trećem i daljem naslednom redu, kao i obveznici koji sa ostaviocem odnosno poklonodavcem nisu u srodstvu, plaćaju porez po stopi od 2,5%. Naslednici i poklonoprimci prvog naslednog reda, kao i supružnik, po pravilu su oslobođeni. Napomena sistema: stope su proverene, broj člana nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2005-01-01",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon_o_porezima_na_imovinu.html",
  },

  // ── Rokovi plaćanja u komercijalnim transakcijama ─────────────────────────
  {
    propis: "ZRINO",
    clan: "—",
    naslov: "Najduži ugovoreni rokovi plaćanja",
    tekst:
      "Kada je dužnik javni sektor, rok za izmirenje novčane obaveze ne može biti duži od 45 dana. Kada je dužnik Republički fond za zdravstveno osiguranje ili korisnik njegovih sredstava, može se ugovoriti rok do 90 dana. Kada je dužnik privredni subjekt, rok ne može biti duži od 60 dana; izuzetno se između privrednih subjekata može ugovoriti duži rok ako ugovorene obaveze zahtevaju plaćanje u ratama, ali ni tada duže od 90 dana. Napomena sistema: rokovi su provereni, brojevi članova nisu potvrđeni.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2013-03-31",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_rokovima_izmirenja_novcanih_obaveza_u_komercijalnim_transakcijama.html",
  },

  // ── Privredna društva ─────────────────────────────────────────────────────
  {
    propis: "ZPD",
    clan: "—",
    naslov: "Minimalni osnovni kapital društva sa ograničenom odgovornošću",
    tekst:
      "Minimalni osnovni kapital društva sa ograničenom odgovornošću iznosi 100 dinara, osim ako posebnim zakonom za određenu delatnost nije propisan veći iznos. Osnovni kapital je novčana vrednost upisanih uloga članova društva koja se registruje u skladu sa zakonom o registraciji. Ulog može biti novčani i nenovčani. Napomena sistema: iznos je proveren, broj člana nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2012-02-01",
    izvorUrl: "https://www.paragraf.rs/propisi/zakon-o-privrednim-drustvima.html",
  },

  // ── Sprečavanje pranja novca ──────────────────────────────────────────────
  /*
   * Ovo je jedini propis u bazi po kome je sam korisnik aplikacije obveznik:
   * računovođa koji pruža usluge trećima ima obaveze poznavanja stranke i
   * prijavljivanja sumnjivih transakcija. Zato stoji ovde, a ne kao tuđa tema.
   */
  {
    propis: "ZSPNFT",
    clan: "4",
    naslov: "Obveznici zakona — računovođe, revizori i poreski savetnici",
    tekst:
      "Obveznici primene ovog zakona su finansijske i nefinansijske institucije taksativno navedene u ovom članu. Među njima su, pored ostalih, revizorska društva i samostalni revizori, preduzetnici i pravna lica koja se bave pružanjem računovodstvenih usluga, kao i poreski savetnici. Obveznik je dužan da sprovodi radnje i mere poznavanja i praćenja stranke, da odredi ovlašćeno lice i njegovog zamenika, izradi analizu rizika i prijavljuje gotovinske i sumnjive transakcije Upravi za sprečavanje pranja novca.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "2018-04-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_sprecavanju_pranja_novca_i_finansiranja_terorizma.html",
  },

  // ── Arhivska građa ────────────────────────────────────────────────────────
  {
    propis: "ZAG",
    clan: "—",
    naslov: "Arhivska knjiga i rok za dostavljanje prepisa",
    tekst:
      "Stvaralac i imalac arhivske i dokumentarne građe dužan je da vodi arhivsku knjigu — evidenciju o celokupnoj dokumentarnoj građi koja nastaje u njegovom radu. Prepis arhivske knjige za dokumentarnu građu nastalu u prethodnoj kalendarskoj godini dostavlja se nadležnom javnom arhivu najkasnije do 30. aprila tekuće godine. Obaveza se odnosi na pravna i fizička lica koja se mogu smatrati stvaraocima odnosno imaocima građe, uključujući privredna društva. Napomena sistema: rok i obaveza su provereni, brojevi članova nisu potvrđeni.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2021-02-02",
    izvorUrl:
      "https://www.paragraf.rs/100pitanja/posao/prikaz-obaveza-iz-zakona-o-arhivskoj-gradji-i-arhivskoj-delatnosti.html",
  },
  {
    propis: "ZAG",
    clan: "—",
    naslov: "Kazne za nepostupanje po obavezama arhiviranja",
    tekst:
      "Za nepostupanje po obavezama iz ovog zakona propisana je novčana kazna za pravno lice u rasponu od 50.000 do 2.000.000 dinara, a za odgovorno lice u pravnom licu od 5.000 do 150.000 dinara. Ovo je obaveza koju firme najčešće previde jer se ne vezuje za poreski kalendar, a kontroliše je nadležni javni arhiv, ne Poreska uprava. Napomena sistema: rasponi kazni su provereni, brojevi članova nisu potvrđeni.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2021-02-02",
    izvorUrl:
      "https://www.ekapija.com/news/3531141/sve-o-primeni-zakona-o-arhivskoj-gradji-preduzetnici-za-sada-bez-obaveze",
  },

  // ── Finansijska podrška porodici sa decom ─────────────────────────────────
  {
    propis: "ZFPPD",
    clan: "—",
    naslov: "Osnovica naknade zarade za vreme porodiljskog odsustva",
    tekst:
      "Osnovica naknade zarade za vreme porodiljskog odsustva, odsustva sa rada radi nege deteta i odsustva radi posebne nege deteta utvrđuje se tako što se saberu mesečne osnovice na koje su plaćeni doprinosi na primanja koja imaju karakter zarade, za poslednjih 18 meseci koji prethode prvom mesecu otpočinjanja odsustva. Pravo ostvaruju zaposleni kod pravnih i fizičkih lica, a pod propisanim uslovima i otac, usvojitelj, hranitelj odnosno staratelj deteta kada koristi odsustvo. Napomena sistema: način obračuna je proveren, brojevi članova nisu potvrđeni.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2018-07-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon-o-finansijskoj-podrsci-porodici-sa-decom.html",
  },

  // ── PDV evidencija ────────────────────────────────────────────────────────
  {
    propis: "PRAVILNIK-POPDV",
    clan: "—",
    naslov: "Pregled obračuna PDV — obrazac POPDV",
    tekst:
      "Obveznik PDV podnosi nadležnom poreskom organu pregled obračuna PDV na Obrascu POPDV — Pregled obračuna PDV za poreski period, zajedno sa poreskom prijavom PDV. Pravilnik propisuje oblik, sadržinu i način vođenja evidencije o PDV iz koje se podaci za POPDV crpe. U primeni je od 1. januara 2018. godine. Napomena sistema: obaveza je proverena, broj člana pravilnika nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2018-01-01",
    izvorUrl:
      "https://www.neobilten.com/pravilnik-o-obliku-sadrzini-i-nacinu-vodjenja-evidencije-o-pdv-i-o-obliku-i-sadrzini-pregleda-obracuna-pdv-8/?lang=lat",
  },
  // ── Obligacioni odnosi — zastarelost ──────────────────────────────────────
  /*
   * Zastarelost fakture između firmi je jedno od najčešćih pitanja u
   * računovodstvu, i skoro uvek se pogrešno pamti kao opštih deset godina.
   * Za promet robe i usluga između pravnih lica rok je tri godine, i teče
   * posebno za svaku isporuku — što je razlika koja odlučuje da li se
   * potraživanje još može naplatiti ili se otpisuje.
   */
  {
    propis: "ZOO",
    clan: "371",
    naslov: "Opšti rok zastarelosti potraživanja",
    tekst:
      "Potraživanja zastarevaju za deset godina, ako zakonom nije određen neki drugi rok zastarelosti. Ovaj rok je opšte pravilo — primenjuje se samo kada za konkretnu vrstu potraživanja nije propisan poseban, po pravilu kraći rok.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "1978-10-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_obligacionim_odnosima.html",
  },
  {
    propis: "ZOO",
    clan: "374",
    naslov:
      "Zastarelost međusobnih potraživanja pravnih lica iz prometa robe i usluga",
    tekst:
      "Međusobna potraživanja pravnih lica iz ugovora o prometu robe i usluga, kao i potraživanja naknade za izdatke učinjene u vezi sa tim ugovorima, zastarevaju za tri godine. Zastarevanje teče odvojeno za svaku isporuku robe, izvršeni rad ili uslugu. Ovo je rok koji se u praksi primenjuje na fakture između privrednih subjekata, a ne opšti rok od deset godina.",
    potvrdjenBrojClana: true,
    doslovanTekst: false,
    vaziOd: "1978-10-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_obligacionim_odnosima.html",
  },

  // ── Razvrstavanje stalnih sredstava ───────────────────────────────────────
  {
    propis: "PRAVILNIK-RAZVRSTAVANJE-SREDSTAVA",
    clan: "—",
    naslov: "Razvrstavanje stalnih sredstava u amortizacione grupe",
    tekst:
      "Stalna sredstva koja podležu obračunu amortizacije za poreske svrhe, osim nematerijalnih sredstava, razvrstavaju se u pet grupa, sa stopama propisanim članom 10b stav 3 Zakona o porezu na dobit pravnih lica: I grupa 2,5%, II grupa 10%, III grupa 15%, IV grupa 20%, V grupa 30%. Za sredstva razvrstana u I grupu amortizacija se utvrđuje proporcionalnom metodom, a za sredstva iz II do V grupe degresivnom metodom. Pravilnik propisuje koje se konkretno sredstvo svrstava u koju grupu. Napomena sistema: grupe i metode su provereni, broj člana pravilnika nije potvrđen.",
    potvrdjenBrojClana: false,
    doslovanTekst: false,
    vaziOd: "2019-01-01",
    izvorUrl:
      "https://www.paragraf.rs/propisi/pravilnik_o_nacinu_razvrstavanja_stalnih_sredstava_po_grupama_i_nacinu_utvrdjivanja_amortizacije_za_poreske_svrhe.html",
  },
];
