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
};

export default nextConfig;
