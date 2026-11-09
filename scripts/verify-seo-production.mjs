import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, request } from "@playwright/test";

// No inherited service credentials or developer .env files. Run only in the isolated worktree.
const origin = "https://www.linhadejogo.com";
const base = "http://127.0.0.1:3102";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3102"], {
  env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_URL: "regression-preview.vercel.app", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: "", FOOTBALL_DATA_API_KEY: "", FOOTBALL_DATA_TOKEN: "", BLOG_AGENT_DATA_DIR: `${process.cwd()}/.cache/seo-empty-editorial` },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { serverOutput = (serverOutput + chunk).slice(-4000); });
let browser;
const api = await request.newContext({ baseURL: base, userAgent: "Twitterbot/1.0" });
// Retry only network resets, never failed HTTP status assertions.
const get = (url, options = {}) => api.get(url, { maxRetries: 2, ...options });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Local server exited: ${child.exitCode}`);
    try { if ((await get("/robots.txt")).ok()) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Local production server must start");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage();
  let checked = 0;
  for (const locale of ["pt-br", "pt-pt", "en-us"]) {
    for (const path of ["", "/competicoes", "/noticias", "/blog", "/jogos", "/avaliacao", "/pesquisa", "/sobre", "/privacidade", "/condicoes", "/analise"]) {
      const target = `/${locale}${path}`;
      const response = await get(target);
      assert.equal(response.status(), 200, target);
      const html = await response.text();
      assert.doesNotMatch(html.match(/<(?:link|meta)\b[^>]*>/g)?.join("\n") ?? "", /vercel\.app/, target);
      const data = await page.evaluate(html => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return { canonical: [...doc.querySelectorAll('link[rel="canonical"]')].map(x => x.getAttribute("href")), alternates: [...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map(x => [x.getAttribute("hreflang"), x.getAttribute("href")]), links: [...doc.querySelectorAll("a[href]")].map(x => x.getAttribute("href")), lang: doc.documentElement.lang };
      }, html);
      assert.deepEqual(data.canonical, [origin + target], target);
      assert.equal(data.alternates.length, 4, target);
      for (const [language, url] of data.alternates) assert.equal(url, `${origin}/${language === "x-default" ? "pt-br" : language.toLowerCase()}${path}`);
      for (const href of data.links.filter(href => href.startsWith("/") && !href.startsWith("//"))) assert.match(href, /^\/(pt-br|pt-pt|en-us)(?:\/|$|[?#])/, `${target}: ${href}`);
      checked++;
    }
  }
  const slug = "cristiano-ronaldo-despede-se-selecao-portuguesa";
  await page.goto(`${base}/pt-pt/blog/${slug}`);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("article figure img").first().evaluate(image => getComputedStyle(image.parentElement).position), "relative", "Tailwind must be processed by the production bundler");
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `${origin}/pt-pt/blog/${slug}`);
  assert.equal(await page.locator('link[rel="alternate"][hreflang]').count(), 0);
  assert.equal(await page.locator("html").getAttribute("lang"), "pt-PT");
  for (const locale of ["pt-br", "en-us"]) {
    const response = await get(`/${locale}/blog/${slug}`, { maxRedirects: 0 });
    assert.equal(response.status(), 308);
    assert.equal(response.headers().location, `/pt-pt/blog/${slug}`);
    await page.goto(`${base}/${locale}/blog/${slug}`);
    await page.waitForURL(`**/pt-pt/blog/${slug}`);
  }
  // Explicit language switching remains functional after hydration.
  await page.goto(`${base}/pt-br/sobre`);
  await page.getByRole("button", { name: /Portugal/ }).click();
  await page.waitForURL("**/pt-pt/sobre");
  await page.getByRole("button", { name: /United States/ }).click();
  await page.waitForURL("**/en-us/sobre");
  for (const cookie of ["", "linha-de-jogo-locale=en-us"]) {
    const response = await get("/noticias?equipa=Portugal", { maxRedirects: 0, headers: { cookie } });
    assert.equal(response.status(), 308);
    assert.equal(response.headers().location, "/pt-br/noticias?equipa=Portugal");
  }
  const missing = await get("/pt-pt/blog/seo-nonexistent-article");
  // Next.js can stream a not-found page with HTTP 200; require noindex and no canonical in either case.
  assert.ok([200, 404].includes(missing.status()));
  const missingHtml = await missing.text();
  assert.doesNotMatch(missingHtml, /<link[^>]+rel="canonical"/);
  assert.match(missingHtml, /name="robots"[^>]+content="[^"]*noindex/);
  const sitemap = await (await get("/sitemap.xml")).text();
  const entries = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return [...doc.getElementsByTagName("url")].map(x => ({ url: x.getElementsByTagName("loc")[0].textContent, alternates: [...x.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "link")].map(a => a.getAttribute("href")) }));
  }, sitemap);
  assert.ok(entries.length >= 30);
  for (const entry of entries) {
    assert.equal(new URL(entry.url).origin, origin);
    for (const url of entry.alternates) assert.equal(new URL(url).origin, origin);
    if (entry.url.includes("/blog/")) { assert.match(entry.url, /\/pt-pt\/blog\//); assert.equal(entry.alternates.length, 0); }
  }
  const robots = await (await get("/robots.txt")).text();
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  assert.ok(!sitemap.includes("vercel.app") && !robots.includes("vercel.app"));
  console.log(JSON.stringify({ result: "PASS", productionHtmlPages: checked, sitemapEntries: entries.length, articleRedirects: 2, browserLanguageSwitches: 2, legacyRedirectCookieCases: 2, missingArticleStatus: missing.status(), missingArticleNoindex: true, deploymentUrlsInSeo: 0 }));
} finally {
  await api.dispose();
  await browser?.close();
  child.kill("SIGTERM");
  if (child.exitCode === null) await once(child, "exit");
}
