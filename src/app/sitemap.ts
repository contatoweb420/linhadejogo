import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { publicArticles } from "@/server/blog-agent/public";
import { competitionTable, listCompetitions } from "@/server/queries";
import { availableLocales, seoAlternates, seoUrl, contentPath } from "@/lib/seo";

export const dynamic = "force-dynamic";

const publicPaths = [
  "/",
  "/jogos",
  "/competicoes",
  "/avaliacao",
  "/blog",
  "/noticias",
  "/sobre",
  "/privacidade",
  "/condicoes",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  if (!base) return [];
  const [articles, competitions] = await Promise.all([
    publicArticles(),
    listCompetitions().catch(() => []),
  ]);
  const standings = await Promise.all(competitions.map((competition) => competitionTable(competition.id, "TOTAL").catch(() => [])));
  const teamIds = new Set(standings.flat().map((row) => row.teamExternalId).filter((id): id is number => Number.isInteger(id)));
  const paths = [
    ...publicPaths,
    ...competitions.map((competition) => `/competicoes/${competition.code}`),
    ...[...teamIds].map((id) => `/equipas/${id}`),
    ...articles.map((article) => `/blog/${article.slug}`),
  ];
  return paths.flatMap((path) => {
    return availableLocales(path).map((locale) => ({
      url: seoUrl(contentPath(path, locale)),
      alternates: { languages: seoAlternates(path, locale).languages },
      ...(path.startsWith("/blog/") ? { lastModified: articles.find((article) => path === `/blog/${article.slug}`)?.updatedAt } : {}),
    }));
  });
}
