import { readCache } from "@/lib/agents/shared/cache";
import { webzEndpoints } from "@/lib/agents/shared/webz";
import type { BlogDraft } from "@/lib/agents/blogs/types";

export const officialEndpoint = webzEndpoints.blogs;

function isDraft(value: unknown): value is BlogDraft {
  if (!value || typeof value !== "object") return false;
  const item = value as BlogDraft;
  return typeof item.id === "string" && typeof item.title === "string" && item.status === "rascunho";
}

export async function readDrafts() {
  const stored = await readCache<unknown[]>("blogs");
  if (!Array.isArray(stored)) return [];
  return stored.filter(isDraft);
}
