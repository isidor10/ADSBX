import type { Metadata, Viewport } from "next";
import { EB_Garamond, Inter } from "next/font/google";
import { Ljuska } from "@/components/Ljuska";
import { Navigacija } from "@/components/Osnovno";
import "./globals.css";

/*
 * Dva pisma i ništa više.
 *
 * Inter nosi sve što se čita — ima pun latinično proširenje (č, ć, š, ž, đ) i
 * na iPhone-u ostaje oštar u malim veličinama, što je ovde bitnije od karaktera.
 * EB Garamond stoji samo na naslovima: daje onaj ton koji se traži, ali je
 * pretanak za tekst koji se zaista čita, pa tamo i ne ide.
 *
 * Prvo je ovde bio Cormorant Garamond — lepši u engleskom uzorku, ali mu je
 * kvačica na „š" i „č" tanka i podignuta skoro do visine velikog slova, pa na
 * naslovu od 46px izgleda kao da lebdi odvojeno od slova. Na srpskom naslovu to
 * nije sitnica: „Dobro došli." je prvo što se u aplikaciji pročita. EB Garamond
 * crta istu Garamond liniju, a kvačicu drži uz slovo i daje joj težinu.
 *
 * Fontovi se serviraju sa našeg domena (next/font ih ugrađuje), pa nema poziva
 * ka Google-u, nema skoka u rasporedu pri učitavanju i nema trećeg servisa u
 * putanji do korisnika.
 */

const sans = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
});

const serif = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Miranda 👠 — poreski savetnik za Republiku Srbiju",
  description:
    "Poreski savetnik, računovođa i finansijsko-administrativni asistent za poslovanje u Republici Srbiji. Odgovori sa tačnim pravnim osnovom i proverom važenja propisa.",
  manifest: "/manifest.webmanifest",
  applicationName: "Miranda",
  appleWebApp: {
    capable: true,
    title: "Miranda",
    // Providna traka stanja: sadržaj ide ispod sata i Dynamic Island-a, a
    // sigurne zone u CSS-u ga vraćaju tamo gde treba. Tako se dobija osećaj
    // aplikacije, a ne sajta sa belom trakom na vrhu.
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Bez ovoga iOS ostavlja bele pojase oko zaobljenih uglova i Dynamic Island-a.
  viewportFit: "cover",
  // Zumiranje ostaje dozvoljeno. Zabrana bi popravila jedan sitan problem sa
  // iOS tastaturom, a oduzela pristupačnost onome kome je zum jedini način da
  // pročita tekst — to nije razmena koju vredi napraviti.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#161512" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr-Latn-RS" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <Ljuska>
          <Navigacija />
          {children}
        </Ljuska>
      </body>
    </html>
  );
}
