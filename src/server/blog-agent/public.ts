import { articles, type Article } from "@/content/articles";
import { lisbonToday } from "@/server/format/pt";
import { isPublicStatus } from "./policy";
import { readAgentArticles } from "./store";
import type { AgentArticle } from "./types";

export async function publicArticles(): Promise<Article[]> {
  const extras = (await readAgentArticles()).filter((article) => isPublicStatus(article.status, article.publishOn)).map(toArticle);
  return [...extras, ...articles.filter((article) => article.status === "publicado")].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function publicArticle(slug: string) {
  return (await publicArticles()).find((article) => article.slug === slug) ?? null;
}

function toArticle(article: AgentArticle): Article {
  return {
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    blocks: article.blocks,
    cover: article.cover,
    coverImage: article.coverImage,
    category: article.category,
    author: article.author,
    publishedAt: article.publishOn || lisbonToday(),
    updatedAt: article.updatedAt || article.createdAt,
    status: "publicado",
    sources: article.sources,
    example: false,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    tags: article.tags,
  };
}
