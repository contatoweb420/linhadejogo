import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["100.81.198.123", "osos"],
  distDir: process.env.E2E_TEST_MODE === "1" ? ".next-e2e" : ".next",
  // Opt-in for environments that block child processes. Type checking stays enabled.
  ...(process.env.LINHA_BUILD_IN_PROCESS === "1" ? {
    experimental: {
      useTypeScriptCli: false,
      webpackBuildWorker: false,
      workerThreads: true,
      cpus: 1,
    },
  } : {}),
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
