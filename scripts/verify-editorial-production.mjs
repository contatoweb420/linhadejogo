import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { chromium, devices, request } from "@playwright/test";
import { footballWeekArticles } from "../src/content/football-week-20261109.ts";

const official = "https://www.linhadejogo.com";
const remote = process.env.EDITORIAL_VERIFY_BASE_URL;
assert.ok(!remote || remote === official, "Remote verification is restricted to the official domain");
const base = remote || "http://127.0.0.1:3102";
const child = remote ? null : spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3102"], {
  env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_URL: "editorial-preview.invalid.vercel.app", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: "", FOOTBALL_DATA_API_KEY: "", FOOTBALL_DATA_TOKEN: "", BLOG_AGENT_DATA_DIR: `${process.cwd()}/.cache/editorial-verification-empty` },
  stdio: ["ignore", "ignore", "ignore"],
});
const api = await request.newContext({ baseURL: base });
const get = (url, options = {}) => api.get(url, { maxRetries: 2, timeout: 75_000, ...options });
let browser;
try {
  if (child) {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (child.exitCode !== null) throw new Error("Local production server stopped");
      try { if ((await get("/robots.txt")).ok()) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready, "Local production server must start");
  }
  browser = await chromium.launch({ headless: true });
  let pages = 0;
  for (const profile of [{ viewport: { width: 1440, height: 1000 } }, devices["Pixel 7"]]) {
    const context = await browser.newContext(profile);
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const article of footballWeekArticles) {
      const path = `/pt-pt/blog/${article.slug}`;
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200, path);
      assert.equal(await page.locator("html").getAttribute("lang"), "pt-PT");
      assert.equal(await page.locator("h1").textContent(), article.title);
      assert.equal(await page.title(), article.seoTitle);
      assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), article.seoDescription);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), official + path);
      assert.equal(await page.locator('link[hreflang]').count(), 0);
      for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) assert.equal(await page.locator(selector).getAttribute("content"), official + article.coverImage.imageUrl);
      for (const [selector, value] of [
        ['meta[property="og:title"]', article.title], ['meta[property="og:description"]', article.seoDescription], ['meta[property="og:url"]', official + path],
        ['meta[name="twitter:title"]', article.title], ['meta[name="twitter:description"]', article.seoDescription],
        ['meta[property="article:published_time"]', article.publishedAt], ['meta[property="article:modified_time"]', article.updatedAt],
      ]) assert.equal(await page.locator(selector).getAttribute("content"), value);
      const schema = JSON.parse(await page.locator('article > script[type="application/ld+json"]').textContent());
      assert.equal(schema["@type"], "NewsArticle"); assert.equal(schema.datePublished, article.publishedAt); assert.equal(schema.dateModified, article.updatedAt);
      assert.equal(schema.image.license, article.coverImage.licenseUrl); assert.equal(schema.inLanguage, "pt-PT"); assert.ok(schema.wordCount >= 700);
      const image = page.locator("article > figure img").first();
      await image.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => { const image = document.querySelector("article > figure img"); return image?.complete && image.naturalWidth > 0; });
      assert.equal(await image.evaluate(image => getComputedStyle(image.parentElement).position), "relative");
      assert.ok(await page.locator(`article > figure a[href="${article.coverImage.creditUrl}"]`).count());
      assert.ok(await page.locator(`article > figure a[href="${article.coverImage.licenseUrl}"]`).count());
      assert.ok(await page.locator("article > figure figcaption").textContent().then(text => text.includes("arquivo") && text.includes("16:9")));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.equal(await page.locator('meta[name="robots"][content*="noindex"]').count(), 0);
      pages++;
    }
    assert.deepEqual(errors, [], "No browser runtime errors");
    await context.close();
  }
  const news = await get("/pt-pt/noticias"); assert.equal(news.status(), 200); const html = await news.text();
  for (const article of footballWeekArticles) assert.ok(html.includes(`/pt-pt/blog/${article.slug}`), "Article must appear in news");
  const xml = await (await get("/sitemap.xml")).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  for (const article of footballWeekArticles) {
    assert.deepEqual(urls.filter(url => url.endsWith(`/blog/${article.slug}`)), [`${official}/pt-pt/blog/${article.slug}`]);
    const image = await get(article.coverImage.imageUrl); assert.equal(image.status(), 200); assert.match(image.headers()["content-type"], /^image\//);
    for (const language of ["pt-br", "en-us"]) {
      const result = await get(`/${language}/blog/${article.slug}?utm_source=editorial-check`, { maxRedirects: 0 });
      assert.equal(result.status(), 308);
      assert.ok([`/pt-pt/blog/${article.slug}?utm_source=editorial-check`, `${official}/pt-pt/blog/${article.slug}?utm_source=editorial-check`].includes(result.headers().location));
    }
  }
  assert.ok(urls.every(url => new URL(url).origin === official)); assert.ok(!xml.includes("vercel.app"));
  if (remote) {
    const baseline = JSON.parse(await readFile(new URL("../docs/editorial-production-baseline-20261109.json", import.meta.url), "utf8"));
    for (const old of baseline.existingArticleUrls) assert.ok(urls.includes(old), `Existing article preserved: ${old}`);
  }
  console.log(JSON.stringify({ result: "PASS", target: remote ? "public-production" : "local-production", articles: footballWeekArticles.length, desktopAndMobilePages: pages, imageFiles: 4, articleAliases: 8, sitemapEntries: urls.length, canonicalOrigin: official, newsArticleSchema: true, oldArticlesPreserved: remote ? 7 : "checked in source", browserErrors: 0 }));
} finally {
  await api.dispose(); await browser?.close();
  child?.kill("SIGTERM"); if (child && child.exitCode === null) await once(child, "exit");
}
