import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { publicArticles } from "@/server/blog-agent/public";
import { competitionTable, listCompetitions } from "@/server/queries";
import { localePrefixes, locales } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const publicPaths = [
  "/",
  "/jogos",
  "/competicoes",
  "/analise",
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
    const languageAlternates = Object.fromEntries([
      ...locales.map((locale) => [locale, new URL(`/${localePrefixes[locale]}${path === "/" ? "" : path}`, base).toString()]),
      ["x-default", new URL(`/pt-br${path === "/" ? "" : path}`, base).toString()],
    ]);
    return locales.map((locale) => ({
      url: new URL(`/${localePrefixes[locale]}${path === "/" ? "" : path}`, base).toString(),
      alternates: { languages: languageAlternates },
      ...(path.startsWith("/blog/") ? { lastModified: articles.find((article) => path === `/blog/${article.slug}`)?.updatedAt } : {}),
    }));
  });
}
