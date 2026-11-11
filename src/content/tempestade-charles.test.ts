import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { articles } from "./articles";
import { getPublishedArticle, queryArticles } from "./blog";
import { tempestadeCharlesArticle as article } from "./tempestade-charles";
import { newsArticleSchema } from "@/lib/news-article-schema";

describe("Tempestade Charles publication", () => {
  it("registers the approved article and category exactly once", () => {
    expect(articles.filter(item => item.slug === article.slug)).toEqual([article]);
    expect(getPublishedArticle(article.slug)).toEqual(article);
    const listing = queryArticles({ category: "Futebol feminino / Internacional" });
    expect(listing.unknownCategory).toBe(false);
    expect(listing.items).toContain(article);
  });

  it("keeps the original cover bytes and publishes complete metadata", () => {
    const image = article.coverImage!;
    expect(image.imageUrl).toBe("/editorial/2026-11/tempestade-charles-estadio-chuva.png");
    expect(image.alt).toContain("chuva intensa e relâmpagos");
    const digest = createHash("sha256").update(readFileSync(`public${image.imageUrl}`)).digest("hex");
    expect(digest).toBe("9a70fba7688d3eb635e896645304fc42f2b0d3431c6c58f36bb3e93d5ac11485");
    const schema = newsArticleSchema(article)!;
    expect(schema.url).toBe(`https://www.linhadejogo.com/pt-pt/blog/${article.slug}`);
    expect(schema.image?.url).toBe(`https://www.linhadejogo.com${image.imageUrl}`);
    expect(schema.headline).toBe(article.title);
    expect(schema.articleSection).toBe(article.category);
    expect(article.seoTitle).toBeTruthy();
    expect(article.seoDescription!.length).toBeLessThanOrEqual(170);
    expect(article.tags).toContain("Futebol feminino");
  });

  it("attributes the updated date and both times to Zerozero", () => {
    const update = article.blocks.find(block => block.type === "p" && block.text.startsWith("Segundo informação posterior"));
    expect(update).toMatchObject({
      text: expect.stringContaining("Zerozero"),
    });
    if (!update || update.type !== "p") throw new Error("Missing update paragraph");
    expect(update.text).toContain("12 de novembro de 2026");
    expect(update.text).toContain("Torreense x Sparta Praha às 17h00");
    expect(update.text).toContain("Benfica x Austria Wien às 20h00");
    expect(article.sources.find(source => source.name === "Zerozero")?.url).toContain("/1258526");
  });
});
