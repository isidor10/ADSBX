/**
 * Ikone — tanke linije, jedan stil, bez boje.
 *
 * Emoji su bili najjeftiniji element celog interfejsa: svaki dolazi iz drugog
 * crteža, nose sopstvene boje koje se tuku sa paletom, i na svakom uređaju
 * izgledaju drugačije. Ovde je sve jedan potez debljine 1.5, u `currentColor`,
 * pa ikonica preuzima boju teksta pored sebe i menja se sa temom bez ijedne
 * dodatne linije koda.
 *
 * Namerno ih je malo i namerno su neutralne — ikonica treba da pokaže gde se
 * klika, ne da bude ukras.
 */

interface Props {
  /** Ivica kvadrata u pikselima. Nasleđuje boju teksta. */
  velicina?: number;
  className?: string;
}

function Omot({
  velicina = 20,
  className,
  deca,
}: Props & { deca: React.ReactNode }) {
  return (
    <svg
      width={velicina}
      height={velicina}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {deca}
    </svg>
  );
}

export const IkonaRazgovor = (p: Props) => (
  <Omot {...p} deca={<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.8-4.4A8.3 8.3 0 0 1 3.6 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.4 8.4Z" />} />
);

export const IkonaFirma = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M14 21V9h4a1 1 0 0 1 1 1v11" />
        <path d="M8 8h3M8 12h3M8 16h3" />
      </>
    }
  />
);

export const IkonaKalkulator = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <rect x="5" y="2.5" width="14" height="19" rx="2" />
        <path d="M8.5 6.5h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01" />
      </>
    }
  />
);

export const IkonaPropisi = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H18a1 1 0 0 1 1 1v13" />
        <path d="M4 4.5V19a2 2 0 0 0 2 2h13" />
        <path d="M19 17H6a2 2 0 0 0-2 2" />
        <path d="M8 7.5h7M8 11h7" />
      </>
    }
  />
);

export const IkonaRokovi = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <rect x="3.5" y="5" width="17" height="16" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
        <path d="M8 14h3" />
      </>
    }
  />
);

export const IkonaVise = (p: Props) => (
  <Omot {...p} deca={<path d="M5 12h.01M12 12h.01M19 12h.01" />} />
);

export const IkonaZatvori = (p: Props) => (
  <Omot {...p} deca={<path d="M6 6l12 12M18 6L6 18" />} />
);

export const IkonaIstorija = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
        <path d="M3.5 4.5V9H8" />
        <path d="M12 8v4.5l3 1.8" />
      </>
    }
  />
);

export const IkonaDokument = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </>
    }
  />
);

export const IkonaIzmene = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
        <path d="M10.5 19a1.8 1.8 0 0 0 3 0" />
      </>
    }
  />
);

export const IkonaAdmin = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.4 15H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.3 1.1Z" />
      </>
    }
  />
);

export const IkonaSunce = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    }
  />
);

export const IkonaMesec = (p: Props) => (
  <Omot {...p} deca={<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />} />
);

export const IkonaMikrofon = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" />
      </>
    }
  />
);

export const IkonaStop = (p: Props) => (
  <Omot {...p} deca={<rect x="6.5" y="6.5" width="11" height="11" rx="2" />} />
);

export const IkonaPosalji = (p: Props) => (
  <Omot {...p} deca={<path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />} />
);

export const IkonaStrelicaDesno = (p: Props) => (
  <Omot {...p} deca={<path d="M5 12h13M12.5 6l6 6-6 6" />} />
);

export const IkonaVeza = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <path d="M10.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7" />
        <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7" />
      </>
    }
  />
);

export const IkonaUpozorenje = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <path d="M10.7 3.8 2.6 17.5A1.5 1.5 0 0 0 3.9 19.8h16.2a1.5 1.5 0 0 0 1.3-2.3L13.3 3.8a1.5 1.5 0 0 0-2.6 0Z" />
        <path d="M12 9v4M12 16.5h.01" />
      </>
    }
  />
);

export const IkonaOko = (p: Props) => (
  <Omot
    {...p}
    deca={
      <>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    }
  />
);
