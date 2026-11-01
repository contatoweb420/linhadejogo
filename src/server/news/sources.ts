export type NewsSourceKind = "rss" | "page";

export type NewsSource = {
  id: string;
  name: string;
  url: string;
  kind: NewsSourceKind;
  termsUrl: string;
  licenseNote: string;
};

/** Configure only feeds whose terms have been checked for this use. */
export function newsSources(): NewsSource[] {
  const raw = process.env.NEWS_RSS_SOURCES_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value): NewsSource[] => {
      if (!value || typeof value !== "object") return [];
      const item = value as Partial<NewsSource>;
      if (
        typeof item.id !== "string" || !item.id.trim() ||
        typeof item.name !== "string" || !item.name.trim() ||
        typeof item.url !== "string" || !isHttps(item.url) ||
        typeof item.termsUrl !== "string" || !isHttps(item.termsUrl) ||
        typeof item.licenseNote !== "string" || !item.licenseNote.trim() ||
        item.kind !== "rss"
      ) return [];
      return [{
        id: item.id.trim().slice(0, 80),
        name: item.name.trim().slice(0, 120),
        url: item.url,
        kind: "rss",
        termsUrl: item.termsUrl,
        licenseNote: item.licenseNote.trim().slice(0, 500),
      }];
    });
  } catch {
    return [];
  }
}

export function isAllowedSourceUrl(value: string) {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    return false;
  }
  if (target.protocol !== "https:") return false;
  return newsSources().some((source) => source.url === target.toString() || source.url === value);
}

export function sourceForUrl(value: string) {
  return newsSources().find((source) => source.url === value) ?? null;
}

function isHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
