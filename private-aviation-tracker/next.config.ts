import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Aircraft photos are fetched from public photo services (Planespotters CDN by
  // default). Remote patterns are intentionally narrow.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.planespotters.net" },
      { protocol: "https", hostname: "**.jetphotos.com" },
    ],
  },
  serverExternalPackages: ["ioredis"],
  // `next dev` binds to localhost and rejects dev-asset requests carrying any
  // other Origin with a 403. Chunk <script> tags are crossorigin, so opening
  // the dev server by IP — 127.0.0.1, or a LAN address to test on a phone —
  // makes every chunk 403 and the map never mounts. These are dev-only.
  allowedDevOrigins: ["127.0.0.1", "localhost", "0.0.0.0", "*.local"],
  // The dev tools indicator defaults to bottom-left, directly over the
  // data-source health button, and swallows clicks on it. `false` no longer
  // removes it in 16.3, so move it to the one corner the app leaves free.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
