import { readCache } from "@/lib/agents/shared/cache";
import { webzEndpoints } from "@/lib/agents/shared/webz";
import type { ForumThread } from "@/lib/agents/forums/types";

export const officialEndpoint = webzEndpoints.forums;

function isThread(value: unknown): value is ForumThread {
  if (!value || typeof value !== "object") return false;
  const item = value as ForumThread;
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.body === "string";
}

export async function readThreads() {
  const stored = await readCache<unknown[]>("forums");
  if (!Array.isArray(stored)) return [];
  return stored.filter(isThread);
}
