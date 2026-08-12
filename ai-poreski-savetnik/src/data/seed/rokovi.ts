/**
 * Poreski i računovodstveni rokovi (zahtev 15).
 *
 * Rokovi koji nisu provereni prema zvaničnom poreskom kalendaru nose
 * NEPOTVRDJENO — UI ih prikazuje sa oznakom i uputstvom da se provere na
 * portalu Poreske uprave.
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

export const ROKOVI: SeedRok[] = [
  {
    naziv: "PDV prijava i plaćanje PDV-a (mesečni obveznik)",
    opis:
      "Podnošenje poreske prijave PDV i plaćanje obaveze za prethodni mesec. Prijava se podnosi elektronski preko portala ePorezi.",
    vrsteObveznika: ["DOO", "AD", "PREDUZETNIK_KNJIGAS", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "MESECNO",
    danUMesecu: 15,
    uslov: "pdvObveznik",
    obrazac: "PPPDV",
    propis: "ZPDV",
    izvorUrl: PU,
    verifikacija: "DELIMICNO",
  },
  {
    naziv: "Elektronsko evidentiranje obračuna PDV u SEF-u",
    opis:
      "Evidentiranje obračuna PDV u Sistemu elektronskih faktura za prethodni poreski period. Ako deseti dan pada u neradni dan, rok se pomera na prvi naredni radni dan.",
    vrsteObveznika: ["DOO", "AD", "PREDUZETNIK_KNJIGAS", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "MESECNO",
    danUMesecu: 10,
    uslov: "pdvObveznik",
    propis: "PRAVILNIK-EF",
    izvorUrl: "https://www.efaktura.gov.rs/",
    verifikacija: "DELIMICNO",
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
    verifikacija: "DELIMICNO",
  },
  {
    naziv: "Akontacija poreza na dobit pravnih lica",
    opis:
      "Plaćanje mesečne akontacije poreza na dobit za prethodni mesec, u visini utvrđenoj poslednjom poreskom prijavom.",
    vrsteObveznika: ["DOO", "AD", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "MESECNO",
    danUMesecu: 15,
    propis: "ZPDPL",
    izvorUrl: PU,
    verifikacija: "DELIMICNO",
  },
  {
    naziv: "Paušalni porez i doprinosi",
    opis:
      "Plaćanje mesečnog paušalnog poreza i doprinosa po rešenju Poreske uprave.",
    vrsteObveznika: ["PREDUZETNIK_PAUSALAC"],
    ponavljanje: "MESECNO",
    danUMesecu: 15,
    propis: "ZPDG",
    izvorUrl: PU,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    naziv: "Godišnji finansijski izveštaj — APR",
    opis:
      "Dostavljanje redovnog godišnjeg finansijskog izveštaja Agenciji za privredne registre radi javnog objavljivanja.",
    vrsteObveznika: ["DOO", "AD", "PREDUZETNIK_KNJIGAS", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "GODISNJE",
    danUMesecu: 31,
    mesec: 3,
    propis: "ZOR-RAC",
    izvorUrl: "https://www.apr.gov.rs/",
    verifikacija: "NEPOTVRDJENO",
  },
  {
    naziv: "Poreska prijava i poreski bilans — porez na dobit",
    opis:
      "Podnošenje godišnje poreske prijave za porez na dobit pravnih lica sa poreskim bilansom, za prethodnu poslovnu godinu.",
    vrsteObveznika: ["DOO", "AD", "DRUGO_PRAVNO_LICE"],
    ponavljanje: "GODISNJE",
    mesec: 6,
    danUMesecu: 29,
    obrazac: "PDP + PB 1",
    propis: "ZPDPL",
    izvorUrl: PU,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    naziv: "Poreska prijava preduzetnika — prihod od samostalne delatnosti",
    opis:
      "Podnošenje godišnje poreske prijave za utvrđivanje poreza i doprinosa na prihod od samostalne delatnosti, sa poreskim bilansom.",
    vrsteObveznika: ["PREDUZETNIK_KNJIGAS", "PREDUZETNIK_LICNA_ZARADA"],
    ponavljanje: "GODISNJE",
    mesec: 4,
    danUMesecu: 15,
    obrazac: "PPDG-1S + PB 2",
    propis: "ZPDG",
    izvorUrl: PU,
    verifikacija: "NEPOTVRDJENO",
  },
  {
    naziv: "Godišnji porez na dohodak građana",
    opis:
      "Podnošenje prijave za godišnji porez na dohodak građana za dohodak ostvaren u prethodnoj kalendarskoj godini. Prijava se podnosi elektronski, samooporezivanjem.",
    vrsteObveznika: ["FIZICKO_LICE", "ZAPOSLENI"],
    ponavljanje: "GODISNJE",
    mesec: 5,
    danUMesecu: 15,
    obrazac: "PP GPDG",
    propis: "ZPDG",
    izvorUrl: PU,
    verifikacija: "DELIMICNO",
  },
];
