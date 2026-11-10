import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { articles } from "./articles";
import { footballWeekArticles } from "./football-week-20261109";
import { queryArticles } from "./blog";
import { newsArticleSchema, serializeNewsSchema } from "@/lib/news-article-schema";

describe("verified newsroom publication", () => {
  it("adds exactly four unique articles to the existing registry and keeps earlier articles", () => {
    expect(footballWeekArticles).toHaveLength(4);
    expect(new Set(articles.map(article => article.slug)).size).toBe(articles.length);
    for (const article of footballWeekArticles) expect(articles).toContain(article);
    expect(articles.find(article => article.slug === "cristiano-ronaldo-despede-se-selecao-portuguesa")?.publishedAt).toBe("2026-11-05");
    const list = queryArticles({});
    expect([list.featured, ...list.items].slice(0, 4).map(article => article?.slug)).toEqual(footballWeekArticles.map(article => article.slug));
  });
  it.each(footballWeekArticles)("validates editorial content and provenance: $slug", article => {
    const words = article.blocks.map(block => block.type === "ul" ? block.items.join(" ") : block.text).join(" ").trim().split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(700); expect(words).toBeLessThanOrEqual(1000);
    expect(article.blocks.filter(block => block.type === "h2").length).toBeGreaterThanOrEqual(3);
    expect(article.blocks.some(block => block.type === "h3")).toBe(true);
    expect(article.referencePeriod).toEqual({ start: "2026-11-02", end: "2026-11-09" });
    expect(article.author).toBe("Redação Linha de Jogo"); expect(article.status).toBe("publicado");
    expect(Date.parse(article.publishedAt)).toBeLessThanOrEqual(Date.now());
    expect(article.sources.length).toBeGreaterThanOrEqual(4);
    for (const source of article.sources) expect(source.url).toMatch(/^https:\/\//);
    expect(article.relatedLinks?.every(link => link.href.startsWith("/pt-pt/"))).toBe(true);
    expect(article.seoDescription?.length).toBeGreaterThanOrEqual(100);
    expect(article.seoDescription?.length).toBeLessThanOrEqual(170);
    const image = article.coverImage;
    expect(image?.licenseVerified).toBe(true);
    if (!image?.licenseVerified) throw new Error("Verified commercial photo required");
    expect(image.license).toMatch(/^CC BY(?:-SA)? /); expect(image.license).not.toMatch(/NC|ND/);
    expect(image.width).toBeGreaterThanOrEqual(1200); expect(image.alt).toContain("arquivo");
    const records = JSON.parse(readFileSync(path.join(process.cwd(), "docs/editorial-images-20261109.json"), "utf8"));
    const record = records.find((item: { imageUrl: string }) => item.imageUrl === image.imageUrl);
    expect(record).toBeDefined();
    const bytes = readFileSync(path.join(process.cwd(), "public", image.imageUrl));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(record.sha256);
  });
  it.each(footballWeekArticles)("publishes complete, truthful NewsArticle metadata: $slug", article => {
    const schema = newsArticleSchema(article)!;
    expect(schema["@type"]).toBe("NewsArticle"); expect(schema.inLanguage).toBe("pt-PT");
    expect(schema.url).toBe(`https://www.linhadejogo.com/pt-pt/blog/${article.slug}`);
    expect(schema.datePublished).toBe(article.publishedAt); expect(schema.dateModified).toBe(article.updatedAt);
    expect(schema.wordCount).toBeGreaterThanOrEqual(700);
    expect(schema.image?.license).toBe(article.coverImage?.licenseVerified ? article.coverImage.licenseUrl : undefined);
    expect(schema.image?.url).toBe(`https://www.linhadejogo.com${article.coverImage?.imageUrl}`);
    expect(schema.citation).toEqual(article.sources.map(source => source.url));
    expect(serializeNewsSchema(schema)).not.toContain("vercel.app");
  });
  it("does not reclassify older articles and safely serializes script-like text", () => {
    const old = articles.find(article => article.slug === "cristiano-ronaldo-despede-se-selecao-portuguesa")!;
    expect(newsArticleSchema(old)).toBeNull();
    const article = { ...footballWeekArticles[0], title: "</script><script>alert(1)</script>" };
    const json = serializeNewsSchema(newsArticleSchema(article));
    expect(json).not.toContain("</script>"); expect(JSON.parse(json).headline).toBe(article.title);
  });
});
