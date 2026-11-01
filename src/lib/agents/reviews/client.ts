import { readCache } from "@/lib/agents/shared/cache";
import { webzEndpoints } from "@/lib/agents/shared/webz";
import type { ReviewRecord } from "@/lib/agents/reviews/types";

export const officialEndpoint = webzEndpoints.reviews;

function isReview(value: unknown): value is ReviewRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as ReviewRecord;
  return typeof item.id === "string" && typeof item.subject === "string" && typeof item.text === "string";
}

export async function readReviews() {
  const stored = await readCache<unknown[]>("reviews");
  if (!Array.isArray(stored)) return [];
  return stored.filter(isReview);
}
