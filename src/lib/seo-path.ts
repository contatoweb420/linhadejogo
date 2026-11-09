import { localizedPath, type Locale } from "./i18n";
import { ORIGINAL_ARTICLE_LOCALE } from "@/content/article-locales";

export function routePath(path: string) {
  return path.replace(/^\/(pt-br|pt-pt|en-us)(?=\/|$)/i, "") || "/";
}
export function contentPath(path: string, locale: Locale) {
  const route = routePath(path);
  if (route.startsWith("/blog/")) return localizedPath(route, ORIGINAL_ARTICLE_LOCALE);
  return localizedPath(path, locale);
}
