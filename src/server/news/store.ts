import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NewsItem } from "./types";

const FILE = "noticias.json";

function cacheDir() {
  return path.join(process.cwd(), ".cache");
}

function filePath() {
  return path.join(cacheDir(), FILE);
}

export function newsId(url: string) {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export async function readNews(): Promise<NewsItem[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNewsItem);
  } catch {
    return [];
  }
}

export async function saveNews(items: NewsItem[]) {
  await mkdir(cacheDir(), { recursive: true });
  const unique = new Map<string, NewsItem>();
  for (const item of items) {
    if (!isNewsItem(item)) continue;
    unique.set(item.id, item);
  }
  const stored = [...unique.values()].sort((a, b) => (b.publishedAt ?? b.collectedAt).localeCompare(a.publishedAt ?? a.collectedAt));
  await writeFile(filePath(), JSON.stringify(stored), "utf8");
  return stored;
}

export function filterNews(
  items: NewsItem[],
  query: { team?: string; competition?: string; day?: string },
) {
  const team = query.team?.trim().toLocaleLowerCase("pt-PT") ?? "";
  const competition = query.competition?.trim().toLocaleLowerCase("pt-PT") ?? "";
  const day = query.day?.trim() ?? "";
  return items.filter((item) => {
    if (team && !`${item.title} ${item.teams.join(" ")}`.toLocaleLowerCase("pt-PT").includes(team)) return false;
    if (competition && !`${item.title} ${item.competitions.join(" ")}`.toLocaleLowerCase("pt-PT").includes(competition)) return false;
    if (day && !(item.publishedAt ?? "").startsWith(day)) return false;
    return true;
  });
}

export function newsForMatch(items: NewsItem[], names: string[]) {
  const needles = names.map((name) => name.trim().toLocaleLowerCase("pt-PT")).filter((name) => name.length > 2);
  return items.filter((item) => {
    const haystack = `${item.title} ${item.summary} ${item.teams.join(" ")} ${item.competitions.join(" ")}`.toLocaleLowerCase("pt-PT");
    return needles.some((name) => haystack.includes(name));
  });
}

function isNewsItem(value: unknown): value is NewsItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<NewsItem>;
  return Boolean(
    item.id &&
      item.url &&
      item.title &&
      item.summary &&
      item.sourceName &&
      item.collectedAt &&
      item.confirmed === false &&
      (item.relevance === "alta" || item.relevance === "media" || item.relevance === "baixa"),
  );
}
