import { articles, BLOG_CATEGORIES, type Article, type BlogCategory } from "@/content/articles";

export const BLOG_PAGE_SIZE = 4;

export type BlogQuery = {
  q?: string;
  category?: string;
  page?: number;
};

export type BlogListing = {
  featured: Article | null;
  items: Article[];
  page: number;
  pages: number;
  total: number;
  unknownCategory: boolean;
};

export function isBlogCategory(value: string): value is BlogCategory {
  return BLOG_CATEGORIES.some((category) => category === value);
}

export function listPublished() {
  return articles
    .filter((article) => article.status === "publicado")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getPublishedArticle(slug: string) {
  return listPublished().find((article) => article.slug === slug) ?? null;
}

export function queryArticles({ q, category, page }: BlogQuery, source?: Article[]): BlogListing {
  const published = source ?? listPublished();
  const unknownCategory = Boolean(category) && !isBlogCategory(category ?? "");
  const needle = q?.trim().toLocaleLowerCase("pt-PT") ?? "";
  const matched = published.filter((article) => {
    if (unknownCategory) return false;
    if (category && article.category !== category) return false;
    if (!needle) return true;
    return `${article.title} ${article.summary}`.toLocaleLowerCase("pt-PT").includes(needle);
  });
  const narrowed = Boolean(needle || category);
  const requestedPage = page && Number.isFinite(page) ? Math.trunc(page) : 1;
  const featuredArticle = narrowed ? null : matched[0] ?? null;
  const featured = requestedPage > 1 ? null : featuredArticle;
  const rest = featuredArticle ? matched.slice(1) : matched;
  const pages = Math.max(1, Math.ceil(rest.length / BLOG_PAGE_SIZE));
  const current = Math.min(Math.max(1, page && Number.isFinite(page) ? Math.trunc(page) : 1), pages);
  const start = (current - 1) * BLOG_PAGE_SIZE;
  return {
    featured,
    items: rest.slice(start, start + BLOG_PAGE_SIZE),
    page: current,
    pages,
    total: rest.length,
    unknownCategory,
  };
}

export function formatArticleDate(day: string) {
  const [year, month, date] = day.slice(0, 10).split("-");
  if (!year || !month || !date) return "Data não disponível";
  return `${date}/${month}/${year}`;
}

export function blogHref(input: { q?: string; category?: string; page?: number }) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.category) params.set("categoria", input.category);
  if (input.page && input.page > 1) params.set("pagina", String(input.page));
  const query = params.toString();
  return query ? `/blog?${query}` : "/blog";
}
