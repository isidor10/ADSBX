import type { Metadata, Viewport } from "next";
import { Ljuska } from "@/components/Ljuska";
import { Navigacija } from "@/components/Osnovno";
import "./globals.css";

export const metadata: Metadata = {
  title: "Miranda 👠 — poreski savetnik za Republiku Srbiju",
  description:
    "Poreski savetnik, računovođa i finansijsko-administrativni asistent za poslovanje u Republici Srbiji. Odgovori sa tačnim pravnim osnovom i proverom važenja propisa.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#14161a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr-Latn-RS">
      <body>
        <Ljuska>
          <Navigacija />
          {children}
        </Ljuska>
      </body>
    </html>
  );
}
