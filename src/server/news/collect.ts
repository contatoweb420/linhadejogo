import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchAllowedPage } from "./scrapingbee";
import { newsSources, type NewsSource } from "./sources";
import { newsId, readNews, saveNews } from "./store";
import type { NewsItem } from "./types";

const COLLECT_COOLDOWN_MS = 5 * 60_000;

function collectionStatePath() {
  return path.join(process.cwd(), ".cache", "news-collection.json");
}

export async function collectNews() {
  const sources = newsSources();
  if (sources.length === 0) {
    return { ok: true as const, collected: 0, skipped: 0, message: "Não há fontes autorizadas." };
  }
  const statePath = collectionStatePath();
  try {
    const state = JSON.parse(await readFile(statePath, "utf8")) as { collectedAt?: string };
    const elapsed = Date.now() - new Date(state.collectedAt ?? "").getTime();
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < COLLECT_COOLDOWN_MS) {
      return { ok: true as const, collected: 0, skipped: sources.length, message: "A recolha está em cache e aguarda o intervalo mínimo." };
    }
  } catch {
    // First collection, or an unreadable state file: continue with the configured sources.
  }
  const existing = await readNews();
  const known = new Set(existing.map((item) => item.id));
  const incoming: NewsItem[] = [];
  let skipped = 0;
  for (const source of sources) {
    const result = source.kind === "rss" ? await fetchRss(source) : await fetchPage(source);
    if (!result.ok) {
      skipped += 1;
      continue;
    }
    for (const item of result.items) {
      if (known.has(item.id)) continue;
      known.add(item.id);
      incoming.push(item);
    }
  }
  await saveNews([...incoming, ...existing]);
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ collectedAt: new Date().toISOString() }), "utf8");
  return { ok: true as const, collected: incoming.length, skipped, message: null };
}

async function fetchRss(source: NewsSource): Promise<{ ok: true; items: NewsItem[] } | { ok: false }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(source.url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return { ok: false };
    return { ok: true, items: parseRss(await response.text(), source) };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPage(source: NewsSource): Promise<{ ok: true; items: NewsItem[] } | { ok: false }> {
  const result = await fetchAllowedPage(source.url);
  if (!result.ok) return { ok: false };
  const title = result.text.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  if (!title) return { ok: false };
  const item = makeItem({ title, url: source.url, summary: title, sourceName: source.name, sourceTermsUrl: source.termsUrl, sourceLicenseNote: source.licenseNote, publishedAt: null });
  return item ? { ok: true, items: [item] } : { ok: false };
}

export function parseRss(xml: string, source: NewsSource | string) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const items: NewsItem[] = [];
  for (const block of blocks) {
    const title = clean(tag(block, "title"));
    const url = clean(tag(block, "link"));
    const summary = clean(tag(block, "description")).slice(0, 280);
    const publishedAt = toIso(clean(tag(block, "pubDate")));
    const item = makeItem({
      title,
      url,
      summary,
      sourceName: typeof source === "string" ? source : source.name,
      sourceTermsUrl: typeof source === "string" ? undefined : source.termsUrl,
      sourceLicenseNote: typeof source === "string" ? undefined : source.licenseNote,
      publishedAt,
    });
    if (item) items.push(item);
  }
  return items;
}

function makeItem(input: {
  title: string;
  url: string;
  summary: string;
  sourceName: string;
  sourceTermsUrl?: string;
  sourceLicenseNote?: string;
  publishedAt: string | null;
}): NewsItem | null {
  if (!input.title || !input.summary || !isHttps(input.url)) return null;
  return {
    id: newsId(input.url),
    url: input.url,
    title: input.title,
    summary: input.summary,
    sourceName: input.sourceName,
    sourceTermsUrl: input.sourceTermsUrl,
    sourceLicenseNote: input.sourceLicenseNote,
    publishedAt: input.publishedAt,
    collectedAt: new Date().toISOString(),
    teams: [],
    competitions: [],
    relevance: "baixa",
    confirmed: false,
  };
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match?.[1] ?? "";
}

function clean(value: string) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
