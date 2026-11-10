import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type EditorialImage = {
  provider: "pexels" | "wikimedia";
  imageUrl: string;
  sourceUrl: string;
  alt: string;
  credit: string;
  creditUrl: string;
  license: string;
  licenseUrl: string;
  licenseVerified: true;
  checkedAt: string;
  caption?: string;
  width?: number;
  height?: number;
};

/** Manually supplied artwork; it does not claim photographic provenance or a stock licence. */
export type LocalEditorialIllustration = {
  provider: "local-ai";
  imageUrl: `/${string}`;
  alt: string;
  caption: string;
  width: number;
  height: number;
  licenseVerified: false;
};

export type ArticleImage = EditorialImage | LocalEditorialIllustration;

type ImageSearchResult = { items: EditorialImage[]; limited: boolean };

const CACHE_TTL_MS = 30 * 60_000;
const cache = new Map<string, { expiresAt: number; value: ImageSearchResult }>();
let dailyCount = 0;
let dailyKey = "";
let budgetQueue: Promise<void> = Promise.resolve();

export function searchImages(query: string): Promise<ImageSearchResult> {
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!normalized) return Promise.resolve({ items: [], limited: false });
  const key = normalized.toLocaleLowerCase("pt-PT");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);

  return reserveSearch().then(async (allowed) => {
    if (!allowed) return { items: [], limited: true };
    const value = await searchProviders(normalized);
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  });
}

function reserveSearch() {
  let allowed = false;
  const task = budgetQueue.then(async () => {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
    if (day !== dailyKey) {
      dailyKey = day;
      dailyCount = 0;
    }
    const file = path.join(process.cwd(), ".cache", "image-usage.json");
    try {
      const usage = JSON.parse(await readFile(file, "utf8")) as { day?: string; requests?: number };
      if (usage.day === day && Number.isInteger(usage.requests) && Number(usage.requests) >= dailyCount) dailyCount = Number(usage.requests);
    } catch {
      // A missing or unreadable usage file starts a new local counter.
    }
    const limit = positiveInteger(process.env.IMAGE_SEARCH_DAILY_LIMIT, 30);
    if (dailyCount >= limit) return;
    dailyCount += 1;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ day, requests: dailyCount }), "utf8");
    allowed = true;
  });
  budgetQueue = task.catch(() => undefined);
  return task.then(() => allowed, () => false);
}

async function searchProviders(query: string): Promise<ImageSearchResult> {
  const [commons, pexels] = await Promise.all([searchWikimedia(query), searchPexels(query)]);
  const unique = new Map<string, EditorialImage>();
  for (const image of [...commons, ...pexels]) unique.set(image.sourceUrl, image);
  return { items: [...unique.values()].slice(0, 12), limited: false };
}

async function searchWikimedia(query: string): Promise<EditorialImage[]> {
  const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");
  endpoint.searchParams.set("generator", "search");
  endpoint.searchParams.set("gsrsearch", `filetype:bitmap ${query}`);
  endpoint.searchParams.set("gsrnamespace", "6");
  endpoint.searchParams.set("gsrlimit", "20");
  endpoint.searchParams.set("prop", "info|imageinfo");
  endpoint.searchParams.set("inprop", "url");
  endpoint.searchParams.set("iiprop", "url|extmetadata");
  endpoint.searchParams.set("iiurlwidth", "1200");
  const response = await safeFetch(endpoint, "LinhaDeJogo/1.0 (editorial image search)");
  if (!response?.ok) return [];
  const payload = await response.json().catch(() => null) as CommonsResponse | null;
  const pages = Object.values(payload?.query?.pages ?? {});
  const images: EditorialImage[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata;
    const license = plain(meta?.LicenseShortName?.value);
    const licenseUrl = safeHttpsUrl(meta?.LicenseUrl?.value);
    const imageUrl = safeHttpsUrl(info?.thumburl ?? info?.url);
    const sourceUrl = safeHttpsUrl(page.canonicalurl);
    const credit = plain(meta?.Artist?.value) || plain(meta?.Credit?.value) || "Autor indicado no Wikimedia Commons";
    const alt = plain(meta?.ImageDescription?.value) || page.title.replace(/^File:/, "");
    if (!imageUrl || !sourceUrl || !licenseUrl) continue;
    if (!licenseAllowed(license, licenseUrl)) continue;
    const creditUrl = safeHttpsUrl(meta?.Artist?.source ?? page.canonicalurl) ?? sourceUrl;
    images.push({
      provider: "wikimedia",
      imageUrl,
      sourceUrl,
      alt: alt.slice(0, 240),
      credit: credit.slice(0, 240),
      creditUrl,
      license,
      licenseUrl,
      licenseVerified: true,
      checkedAt: new Date().toISOString(),
    });
  }
  return images;
}

async function searchPexels(query: string): Promise<EditorialImage[]> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return [];
  const endpoint = new URL("https://api.pexels.com/v1/search");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("per_page", "12");
  endpoint.searchParams.set("orientation", "landscape");
  const response = await safeFetch(endpoint, undefined, { Authorization: key });
  if (!response?.ok) return [];
  const payload = await response.json().catch(() => null) as PexelsResponse | null;
  return (payload?.photos ?? []).flatMap((photo): EditorialImage[] => {
    const imageUrl = safeHttpsUrl(photo.src?.large ?? photo.src?.original);
    const sourceUrl = safeHttpsUrl(photo.url);
    const creditUrl = safeHttpsUrl(photo.photographer_url);
    if (!imageUrl || !sourceUrl || !creditUrl || !photo.photographer) return [];
    return [{
      provider: "pexels",
      imageUrl,
      sourceUrl,
      alt: (photo.alt || query).slice(0, 240),
      credit: photo.photographer.slice(0, 240),
      creditUrl,
      license: "Pexels License",
      licenseUrl: "https://www.pexels.com/license/",
      licenseVerified: true,
      checkedAt: new Date().toISOString(),
    }];
  });
}

async function safeFetch(url: URL, userAgent?: string, headers?: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, {
      headers: { ...(userAgent ? { "User-Agent": userAgent } : {}), ...headers },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function licenseAllowed(name: string, url: string) {
  const normalized = name.toLowerCase().replace(/\s+/g, " ").trim();
  const recognized = normalized === "public domain" || normalized === "cc0" || /^cc by(?:-sa)?(?: 2\.0| 3\.0| 4\.0)?$/.test(normalized);
  return recognized && /creativecommons\.org\/licenses\/(by|by-sa)\/(2\.0|3\.0|4\.0)|creativecommons\.org\/publicdomain\/zero\/1\.0|creativecommons\.org\/publicdomain\/mark\/1\.0|wikimedia\.org\/wiki\/Template:PD-/i.test(url);
}

function plain(value?: string) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function safeHttpsUrl(value?: string) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

type CommonsResponse = {
  query?: { pages?: Record<string, { title: string; canonicalurl?: string; imageinfo?: Array<{ url?: string; thumburl?: string; extmetadata?: Record<string, { value?: string; source?: string }> }> }> };
};

type PexelsResponse = {
  photos?: Array<{
    url?: string;
    photographer?: string;
    photographer_url?: string;
    alt?: string | null;
    src?: { original?: string; large?: string };
  }>;
};

