/**
 * Poreski i računovodstveni rokovi (zahtev 15).
 *
 * Rokovi koji nisu provereni prema zvaničnom poreskom kalendaru nose
 * NEPOTVRDJENO — UI ih prikazuje sa oznakom i uputstvom da se provere na
 * portalu Poreske uprave.
 *
 * Dva roka su namerno ostavljena na DELIMICNO: propis ih vezuje za 180 dana od
 * isteka poreskog perioda, a ne za datum u kalendaru. Za poslovnu godinu jednaku
 * kalendarskoj to pada na kraj juna, ali tačan dan se pomera između 28. i 30.
 * zavisno od prestupne godine, pa fiksni `danUMesecu` ne može da bude tačan.
 */

export interface SeedRok {
  naziv: string;
  opis: string;
  vrsteObveznika: string[];
  ponavljanje: "MESECNO" | "KVARTALNO" | "GODISNJE" | "JEDNOKRATNO";
  danUMesecu?: number;
  mesec?: number;
  uslov?: string;
  obrazac?: string;
  propis?: string;
  izvorUrl: string;
  verifikacija: "POTVRDJENO" | "DELIMICNO" | "NEPOTVRDJENO";
}

const PU = "https://www.purs.gov.rs/";
const APR = "https://www.apr.gov.rs/";

export const ROKOVI: SeedRok[] = [
  {
    naziv: "PDV prijava i plaćanje PDV-a (mesečni obveznik)",
    opis:
      "Podnošenje poreske prijave PDV i plaćanje obaveze za prethodni mesec. Prijava se podnosi elektronski preko portala ePorezi. Ako 15. pada u neradni dan, rok se pomera na prvi naredni radni dan. Prijava se podnosi za svaki poreski period dok ste u sistemu PDV-a — i kada nije bilo prometa, podnosi se „nulta” prijava.",
    vrsteObveznika: ["DOO", "AD", "PREDUZETNIK_KNJIGAS", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "MESECNO",
    danUMesecu: 15,
    uslov: "pdvObveznik",
    obrazac: "PPPDV",
    propis: "ZPDV",
    izvorUrl: PU,
    verifikacija: "POTVRDJENO",
  },
  {
    naziv: "Elektronsko evidentiranje obračuna PDV u SEF-u",
    opis:
      "Elektronsko evidentiranje obračuna PDV i prethodnog poreza u Sistemu elektronskih faktura, u roku od 12 dana po isteku poreskog perioda. Do 10. dana se u praksi preporučuje da bude završeno evidentiranje nabavki, jer se tada prethodni porez automatski učitava u Evidenciju prethodnog poreza — ali zakonski rok je 12 dana, ne 10.",
    vrsteObveznika: ["DOO", "AD", "PREDUZETNIK_KNJIGAS", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "MESECNO",
    danUMesecu: 12,
    uslov: "pdvObveznik",
    propis: "PRAVILNIK-EF",
    izvorUrl:
      "https://www.paragraf.rs/baza-znanja/e-fakture/novi-pravilnik-o-elektronskom-fakturisanju-elektronsko-evidentiranje-pdv.html",
    verifikacija: "POTVRDJENO",
  },
  {
    naziv: "PPP-PD — poreska prijava za poreze i doprinose po odbitku",
    opis:
      "Pojedinačna poreska prijava o obračunatim porezima i doprinosima podnosi se pre svake isplate zarade, odnosno najkasnije na dan isplate. Za neisplaćene zarade prijava se podnosi i doprinosi plaćaju najkasnije poslednjeg dana u mesecu za prethodni mesec.",
    vrsteObveznika: [
      "DOO",
      "AD",
      "PREDUZETNIK_KNJIGAS",
      "PREDUZETNIK_LICNA_ZARADA",
      "DRUGO_PRAVNO_LICE",
      "POSLODAVAC",
    ],
    ponavljanje: "MESECNO",
    danUMesecu: 31,
    obrazac: "PPP-PD",
    propis: "ZPDG",
    izvorUrl: PU,
    verifikacija: "POTVRDJENO",
  },
  {
    naziv: "Akontacija poreza na dobit pravnih lica",
    opis:
      "Plaćanje mesečne akontacije poreza na dobit za prethodni mesec, u visini utvrđenoj poslednjom poreskom prijavom. Ako u toku godine dođe do bitne promene u poslovanju, akontacija se može izmeniti podnošenjem prijave sa poreskim bilansom.",
    vrsteObveznika: ["DOO", "AD", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "MESECNO",
    danUMesecu: 15,
    propis: "ZPDPL",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_porezu_na_dobit_pravnih_lica.html",
    verifikacija: "POTVRDJENO",
  },
  {
    naziv: "Paušalni porez i doprinosi",
    opis:
      "Plaćanje mesečnog paušalnog poreza i doprinosa po rešenju Poreske uprave, za prethodni mesec.",
    vrsteObveznika: ["PREDUZETNIK_PAUSALAC"],
    ponavljanje: "MESECNO",
    danUMesecu: 15,
    propis: "ZPDG",
    izvorUrl: PU,
    verifikacija: "POTVRDJENO",
  },
  {
    naziv: "Godišnji finansijski izveštaj — APR",
    opis:
      "Dostavljanje redovnog godišnjeg finansijskog izveštaja Agenciji za privredne registre radi javnog objavljivanja. Izveštaj se može dostaviti i posle roka, do kraja godine, ali uz uvećanu naknadu za neblagovremeno dostavljanje.",
    vrsteObveznika: ["DOO", "AD", "PREDUZETNIK_KNJIGAS", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "GODISNJE",
    danUMesecu: 31,
    mesec: 3,
    propis: "ZOR-RAC",
    izvorUrl: APR,
    verifikacija: "POTVRDJENO",
  },
  {
    naziv: "Poreska prijava i poreski bilans — porez na dobit",
    opis:
      "Podnošenje godišnje poreske prijave za porez na dobit pravnih lica sa poreskim bilansom, za prethodnu poslovnu godinu. Zakonski rok je 180 dana od isteka poreskog perioda — za poslovnu godinu jednaku kalendarskoj to je kraj juna, ali tačan dan se pomera između 28. i 30. juna zavisno od godine. Proverite tekući poreski kalendar Poreske uprave.",
    vrsteObveznika: ["DOO", "AD", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "GODISNJE",
    mesec: 6,
    danUMesecu: 30,
    obrazac: "PDP + PB 1",
    propis: "ZPDPL",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_porezu_na_dobit_pravnih_lica.html",
    verifikacija: "DELIMICNO",
  },
  {
    naziv: "Poreska prijava preduzetnika — prihod od samostalne delatnosti",
    opis:
      "Podnošenje godišnje poreske prijave za utvrđivanje poreza i doprinosa na prihod od samostalne delatnosti, sa poreskim bilansom, i plaćanje razlike poreza po konačnom obračunu. Prijava se podnosi isključivo elektronski preko portala ePorezi.",
    vrsteObveznika: ["PREDUZETNIK_KNJIGAS", "PREDUZETNIK_LICNA_ZARADA"],
    ponavljanje: "GODISNJE",
    mesec: 4,
    danUMesecu: 15,
    obrazac: "PPDG-1S + PB 2",
    propis: "ZPDG",
    izvorUrl: "https://www.paragraf.rs/dnevne-vesti/140426/140426-vest6.html",
    verifikacija: "POTVRDJENO",
  },
  {
    naziv: "Izveštaj o transfernim cenama",
    opis:
      "Dostavljanje dokumentacije o transfernim cenama uz poreski bilans, u roku od 180 dana od isteka poreskog perioda — dakle istovremeno sa poreskom prijavom za porez na dobit. Tačan dan se pomera između 28. i 30. juna zavisno od godine. Za nedostavljanje je propisana novčana kazna od 100.000 do 2.000.000 dinara.",
    vrsteObveznika: ["DOO", "AD", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "GODISNJE",
    mesec: 6,
    danUMesecu: 30,
    propis: "ZPDPL",
    izvorUrl:
      "https://www.paragraf.rs/propisi/zakon_o_porezu_na_dobit_pravnih_lica.html",
    verifikacija: "DELIMICNO",
  },
  {
    naziv: "Dokumentacija uz redovan godišnji finansijski izveštaj — APR",
    opis:
      "Dostavljanje dokumentacije uz redovan godišnji finansijski izveštaj, uključujući revizorski izveštaj za obveznike revizije. Dokumentacija se dostavlja tek pošto je izveštaj javno objavljen kao potpun i računski tačan. Posle roka moguće je dostaviti do kraja godine, uz uvećanu naknadu.",
    vrsteObveznika: ["DOO", "AD", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "GODISNJE",
    mesec: 6,
    danUMesecu: 30,
    propis: "ZOR-RAC",
    izvorUrl:
      "https://www.apr.gov.rs/registri/finansijski-izvestaji/uputstva-za-sastavl%D1%98anje-i-dostavl%D1%98anje-finansijskih-izvestaja-odnosno-dokumentacije-za-2021-godinu/vrste-zahteva-u-pis-fi-agencije/redovan-godisnji--finansijski-izvestaj-i-dokumentacija.2107.html",
    verifikacija: "POTVRDJENO",
  },
  {
    naziv: "Konsolidovani godišnji finansijski izveštaj — APR",
    opis:
      "Dostavljanje dokumentacije uz konsolidovani godišnji finansijski izveštaj Agenciji za privredne registre, za matična pravna lica koja sastavljaju konsolidovane izveštaje. Posle roka moguće je dostaviti do kraja godine, uz uvećanu naknadu.",
    vrsteObveznika: ["DOO", "AD", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "GODISNJE",
    mesec: 7,
    danUMesecu: 31,
    propis: "ZOR-RAC",
    izvorUrl: APR,
    verifikacija: "POTVRDJENO",
  },
  {
    naziv: "Godišnji porez na dohodak građana",
    opis:
      "Podnošenje prijave i plaćanje godišnjeg poreza na dohodak građana za dohodak ostvaren u prethodnoj kalendarskoj godini. Porez se plaća samooporezivanjem — utvrđuje se i plaća po podnetoj prijavi, bez rešenja Poreske uprave. Obveznik je rezident čiji dohodak prelazi neoporezivi iznos, koji se objavljuje za svaku godinu posebno.",
    vrsteObveznika: ["FIZICKO_LICE", "ZAPOSLENI"],
    ponavljanje: "GODISNJE",
    mesec: 5,
    danUMesecu: 15,
    obrazac: "PP GPDG",
    propis: "ZPDG",
    izvorUrl:
      "https://aktivasistem.com/news/godisnji-porez-na-dohodak-gradana-za-2024-godinu/",
    verifikacija: "POTVRDJENO",
  },
];
