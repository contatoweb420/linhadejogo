import { test, expect } from "./fixtures.mjs";
import { footballWeekArticles } from "../../src/content/football-week-20261109.ts";
const origin = process.env.E2E_PRODUCTION_BUILD === "1" ? "https://www.linhadejogo.com" : "http://127.0.0.1:3101";

for (const article of footballWeekArticles) {
  test(`published newsroom article: ${article.slug}`, async ({ page }, testInfo) => {
    const path = `/pt-pt/blog/${article.slug}`;
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
    await expect(page.getByRole("heading", { name: article.title, level: 1, exact: true })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", origin + path);
    await expect(page.locator('link[hreflang]')).toHaveCount(0);
    await expect(page).toHaveTitle(article.seoTitle);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", article.seoDescription);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", article.title);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", origin + article.coverImage.imageUrl);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", origin + article.coverImage.imageUrl);
    const schema = JSON.parse(await page.locator('article > script[type="application/ld+json"]').textContent());
    expect(schema["@type"]).toBe("NewsArticle"); expect(schema.datePublished).toBe(article.publishedAt);
    expect(schema.inLanguage).toBe("pt-PT"); expect(schema.wordCount).toBeGreaterThanOrEqual(700);
    const image = page.locator("article > figure img").first();
    await expect(image).toHaveAttribute("alt", article.coverImage.alt);
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await image.evaluate(img => getComputedStyle(img.parentElement).position)).toBe("relative");
    await expect(page.locator("article > figure figcaption")).toContainText(article.coverImage.credit);
    await expect(page.locator("article > figure figcaption")).toContainText(article.coverImage.license);
    for (const source of article.sources) await expect(page.locator(`a[href="${source.url}"]`).last()).toHaveCount(1);
    for (const related of article.relatedLinks) await expect(page.locator(`article a[href="${related.href}"]`).last()).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Recusar analytics", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath("article.png"), fullPage: true });
  });
}
test("newsroom stories appear in news and remain searchable", async ({ page }) => {
  await page.goto("/pt-pt/noticias");
  const newsroom = page.getByRole("region", { name: "Artigos da redação" });
  for (const article of footballWeekArticles) await expect(newsroom.getByRole("link", { name: article.title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fontes externas", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Equipa", exact: true }).fill("Barcelona");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(newsroom.getByRole("link", { name: footballWeekArticles[1].title, exact: true })).toBeVisible();
  await expect(newsroom.getByRole("link", { name: footballWeekArticles[3].title, exact: true })).toHaveCount(0);
});
test("sitemap uses only available article locales and legacy aliases redirect", async ({ request, page }) => {
  const response = await request.get("/sitemap.xml"); expect(response.status()).toBe(200);
  const xml = await response.text();
  const urls = await page.evaluate(xml => [...new DOMParser().parseFromString(xml, "application/xml").getElementsByTagName("loc")].map(node => node.textContent), xml);
  for (const article of footballWeekArticles) {
    expect(urls.filter(url => url.endsWith(`/blog/${article.slug}`))).toEqual([`${origin}/pt-pt/blog/${article.slug}`]);
    for (const language of ["pt-br", "en-us"]) {
      const redirect = await request.get(`/${language}/blog/${article.slug}`, { maxRedirects: 0 });
      expect(redirect.status()).toBe(308); expect(redirect.headers().location).toBe(`/pt-pt/blog/${article.slug}`);
    }
  }
  expect(xml).not.toContain("vercel.app");
});
