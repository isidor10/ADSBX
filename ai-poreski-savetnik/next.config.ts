import type { NextConfig } from "next";

// React u razvojnom režimu koristi eval() da rekonstruiše stack trace-ove i
// prikaže gde je greška nastala. U produkciji ga ne koristi. Zato se
// `'unsafe-eval'` dodaje isključivo dok radi `next dev` — bez toga pregledač
// blokira React i konzola prijavljuje „eval() is not supported”.
// Videti node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
const razvoj = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${razvoj ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Turbopack u razvoju drži WebSocket za osvežavanje stranice.
  `connect-src 'self'${razvoj ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "mammoth", "xlsx"],
  // `next dev` propušta svoje razvojne resurse samo kada domen odgovara onom sa
  // kojim je pokrenut — podrazumevano `localhost`. U GitHub Codespaces-u strana
  // se otvara preko prosleđenog porta na *.app.github.dev, pa server odbija
  // sopstvene chunk-ove i WebSocket sa 403 („Blocked cross-origin request”).
  // Posledica je da osvežavanje posle izmene koda ne radi.
  // Vrednost važi isključivo u razvoju; produkcijski build je ne koristi.
  allowedDevOrigins: [
    "127.0.0.1",
    "*.app.github.dev",
    "*.githubpreview.dev",
    "*.gitpod.io",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
