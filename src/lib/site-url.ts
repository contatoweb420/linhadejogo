export const OFFICIAL_SITE_ORIGIN = "https://www.linhadejogo.com";

export function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const local = process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production";
  if (local && configured) {
    try {
      const url = new URL(configured);
      if (["localhost", "127.0.0.1"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return new URL(url.origin);
    } catch { /* Invalid public configuration is rejected below. */ }
  }
  if (configured && configured !== OFFICIAL_SITE_ORIGIN && configured !== `${OFFICIAL_SITE_ORIGIN}/`) {
    throw new Error("INVALID_PUBLIC_SITE_ORIGIN");
  }
  return new URL(OFFICIAL_SITE_ORIGIN);
}
