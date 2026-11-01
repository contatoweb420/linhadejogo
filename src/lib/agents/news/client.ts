import { readCache } from "@/lib/agents/shared/cache";
import { webzEndpoints } from "@/lib/agents/shared/webz";
import type { NewsRecord } from "@/lib/agents/news/types";

export const officialEndpoint = webzEndpoints.news;

function isNews(value: unknown): value is NewsRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as NewsRecord;
  return typeof item.id === "string" && typeof item.title === "string" && item.confirmed === false && typeof item.url === "string";
}

export async function readNews() {
  const stored = await readCache<unknown[]>("news");
  if (!Array.isArray(stored)) return [];
  return stored.filter(isNews);
}
