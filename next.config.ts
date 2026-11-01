import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Páginas leem a base de dados e a data pedida em cada visita.
  // A cache por componente do Next.js 16 obrigaria a adiar tudo com Suspense
  // e falharia na compilação por causa de `new Date()`.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "crests.football-data.org" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
