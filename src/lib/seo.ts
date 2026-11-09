import { getSiteUrl } from "./site-url";
import { locales, localizedPath, type Locale } from "./i18n";
import { articleLocales } from "@/content/article-locales";

import { routePath, contentPath } from "./seo-path";
export { routePath, contentPath } from "./seo-path";

export function availableLocales(path: string): readonly Locale[] {
  return routePath(path).split(/[?#]/)[0].startsWith("/blog/") ? articleLocales() : locales;
}
export function seoUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) throw new Error("INVALID_SEO_PATH");
  const url = new URL(path, getSiteUrl());
  if (url.origin !== getSiteUrl().origin || url.username || url.password) throw new Error("INVALID_SEO_PATH");
  url.hash = "";
  return url.toString();
}
export function seoAlternates(path: string, locale: Locale) {
  const route = routePath(path);
  const available = availableLocales(route);
  const canonical = seoUrl(contentPath(route, locale));
  if (available.length === 1) return { canonical, languages: {} };
  return {
    canonical,
    languages: Object.fromEntries([
      ...available.map(language => [language, seoUrl(localizedPath(route, language))]),
      ["x-default", seoUrl(localizedPath(route, available.includes("pt-BR") ? "pt-BR" : available[0]))],
    ]),
  };
}
