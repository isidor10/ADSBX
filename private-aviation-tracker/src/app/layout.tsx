import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private Aviation Tracker",
  description:
    "Live tracking and ownership intelligence for private and business aviation, built on ADS-B data and public registries.",
};

export const viewport: Viewport = {
  themeColor: "#04060c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-full bg-ground text-ink antialiased">{children}</body>
    </html>
  );
}
