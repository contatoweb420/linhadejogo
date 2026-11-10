import { describe, expect, it } from "vitest";
import { articles } from "./articles";
import { footballWeekArticles } from "./football-week-20261109";
import { getPublishedArticle, listPublished, queryArticles } from "./blog";

describe("blog local", () => {
  it("esconde rascunhos da lista pública", () => {
    const slugs = listPublished().map((article) => article.slug);
    expect(slugs).not.toContain("notas-internas");
    expect(getPublishedArticle("notas-internas")).toBeNull();
    expect(getPublishedArticle("como-ler-uma-estimativa")?.status).toBe("publicado");
  });

  it("destaca o mais recente e pagina o resto", () => {
    const newSlugs = new Set(footballWeekArticles.map(article => article.slug));
    const historical = articles.filter(article => !newSlugs.has(article.slug));
    const listing = queryArticles({}, historical.filter(article => article.status === "publicado").sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
    expect(listing.featured?.slug).toBe("cristiano-ronaldo-despede-se-selecao-portuguesa");
    expect(listing.items).toHaveLength(4);
    expect(listing.pages).toBe(2);
    const second = queryArticles({ page: 2 }, historical.filter(article => article.status === "publicado").sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
    expect(second.featured).toBeNull();
    expect(second.items).toHaveLength(2);
    expect(second.items.some((article) => article.slug === listing.featured?.slug)).toBe(false);
  });

  it("filtra por título e por categoria sem inventar resultados", () => {
    const found = queryArticles({ q: "tamanho da amostra" });
    expect(found.featured).toBeNull();
    expect(found.items.map((article) => article.slug)).toEqual(["tamanho-da-amostra"]);
    const category = queryArticles({ category: "Campeonatos" });
    expect(category.items.every((article) => article.category === "Campeonatos")).toBe(true);
    const missing = queryArticles({ category: "Liga imaginária" });
    expect(missing.unknownCategory).toBe(true);
    expect(missing.items).toHaveLength(0);
  });
});
