import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl, OFFICIAL_SITE_ORIGIN } from "./site-url";
import { availableLocales, seoAlternates, seoUrl } from "./seo";
import { contentPath } from "./seo-path";
import { localizedPath, locales } from "./i18n";

afterEach(() => vi.unstubAllEnvs());
describe("production SEO origin", () => {
  it.each([undefined, "", OFFICIAL_SITE_ORIGIN, `${OFFICIAL_SITE_ORIGIN}/`])("uses only the official origin with configuration %s", value => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_URL", "untrusted-preview.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
    expect(getSiteUrl().origin).toBe(OFFICIAL_SITE_ORIGIN);
    for (const locale of locales) {
      const alternate = seoAlternates("/noticias", locale);
      expect(alternate.canonical).toBe(`${OFFICIAL_SITE_ORIGIN}/${locale.toLowerCase()}/noticias`);
      for (const url of Object.values(alternate.languages)) expect(new URL(String(url)).origin).toBe(OFFICIAL_SITE_ORIGIN);
    }
  });
  it.each(["https://preview.vercel.app", "https://example.com", "http://www.linhadejogo.com", "https://www.linhadejogo.com/path", "https://user:password@www.linhadejogo.com", "http://localhost:3101"])("rejects incompatible configuration without exposing it", value => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
    expect(() => getSiteUrl()).toThrow(/^INVALID_PUBLIC_SITE_ORIGIN$/);
  });
  it("permits loopback only outside production", () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", "development"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3101");
    expect(getSiteUrl().origin).toBe("http://127.0.0.1:3101");
  });
  it.each(["//evil.test/a", "https://evil.test", "/\\evil.test"])("rejects non-local SEO paths %s", path => expect(() => seoUrl(path)).toThrow("INVALID_SEO_PATH"));
});
describe("localized paths and real article availability", () => {
  it.each(locales)("preserves navigation and filters for %s", locale => {
    const prefix = `/${locale.toLowerCase()}`;
    expect(contentPath("/competicoes/PL?tabela=HOME#table", locale)).toBe(`${prefix}/competicoes/PL?tabela=HOME#table`);
    expect(localizedPath(`${prefix}/jogos`, locale)).toBe(`${prefix}/jogos`);
    expect(contentPath("https://example.com/source", locale)).toBe("https://example.com/source");
    expect(contentPath("/api/recolha", locale)).toBe("/api/recolha");
  });
  it("never invents article translations", () => {
    expect(availableLocales("/pt-br/blog/forma-recente")).toEqual(["pt-PT"]);
    expect(contentPath("/en-us/blog/forma-recente?x=1#text", "en-US")).toBe("/pt-pt/blog/forma-recente?x=1#text");
    expect(seoAlternates("/blog/forma-recente", "en-US").languages).toEqual({});
  });
});
