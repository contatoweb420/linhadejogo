import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/server/blog-agent/public", () => ({ publicArticles: async () => [{ slug: "original", updatedAt: "2026-11-09" }] }));
vi.mock("@/server/queries", () => ({ listCompetitions: async () => [{ id: 1, code: "PL" }], competitionTable: async () => [{ teamExternalId: 57 }] }));
import sitemap from "./sitemap";
import robots from "./robots";
afterEach(() => vi.unstubAllEnvs());
it("publishes only official canonical sitemap entries, with real article variants", async () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined); vi.stubEnv("VERCEL_URL", "preview.vercel.app");
  const entries = await sitemap();
  expect(entries.filter(entry => entry.url.includes("/blog/"))).toEqual([expect.objectContaining({ url: "https://www.linhadejogo.com/pt-pt/blog/original" })]);
  expect(entries.some(entry => entry.url.endsWith("/analise"))).toBe(false);
  for (const entry of entries) {
    expect(new URL(entry.url).origin).toBe("https://www.linhadejogo.com");
    for (const url of Object.values(entry.alternates?.languages ?? {})) expect(new URL(String(url)).origin).toBe("https://www.linhadejogo.com");
  }
  expect(robots().sitemap).toBe("https://www.linhadejogo.com/sitemap.xml");
});
it("does not advertise a preview sitemap", () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
});
