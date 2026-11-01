export function getSiteUrl(): URL | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const deployment = process.env.VERCEL_URL?.trim();
  const candidate = configured || (deployment ? `https://${deployment}` : null);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return new URL(`${url.origin}/`);
  } catch {
    return null;
  }
}
