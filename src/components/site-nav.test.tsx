import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./site-nav";
import { StadiumHero } from "./stadium-hero";
import { HomeSidebar } from "./home-sidebar";
import { localePrefix, type Locale } from "@/lib/i18n";

const navigation = vi.hoisted(() => ({ pathname: "/pt-br", push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => navigation }));
vi.mock("./brand-mark", () => ({ BrandMark: () => <span data-brand-mark="true" /> }));

function render(locale: Locale, path: string) {
  const prefix = localePrefix(locale);
  navigation.pathname = `${prefix}${path}`;
  return renderToStaticMarkup(
    <AppShell locale={locale} homeHero={<StadiumHero locale={locale} />} homeSidebar={<HomeSidebar locale={locale} />}>
      <div data-home-ready><h1>Saved overview</h1><p>Existing page content</p></div>
    </AppShell>,
  );
}

describe("premium structure without duplicate branding", () => {
  it.each(["pt-BR", "pt-PT", "en-US"] as const)("keeps one logo, home content and localized links in %s", locale => {
    const html = render(locale, "");
    const prefix = localePrefix(locale);
    expect(html.match(/data-brand-mark=/g)).toHaveLength(1);
    expect(html).toContain('class="site-header chrome"');
    expect(html).toContain('id="hero-title"');
    expect(html).toContain('class="home-sidebar"');
    expect(html).toContain('id="conteudo"');
    expect(html).toContain("Existing page content");
    expect(html).toContain(`href="${prefix}/jogos"`);
    expect(html).toContain(`href="${prefix}/avaliacao"`);
    expect(html).toContain(`href="${prefix}/noticias"`);
    expect(html).toContain(`href="${prefix}/blog"`);
    expect(html).toContain(`href="${prefix}/privacidade"`);
    expect(html).toContain(`href="${prefix}/condicoes"`);
    expect(html.match(/class="home-stadium-backdrop"/g)).toHaveLength(1);
    expect(html).toContain('sizes="100vw"');
    if (locale === "pt-BR") expect(html).toContain("Explore os números de cada partida.");
    if (locale === "pt-PT") expect(html).toContain("Explora os números de cada jogo.");
    if (locale === "en-US") expect(html).toContain("Explore the numbers behind each game.");
    expect(html).not.toContain("nav-aside");
    expect(html).not.toContain("hud-loader--full");
    expect(html).not.toContain("stadium-hero__signature");
  });

  it.each(["pt-BR", "pt-PT", "en-US"] as const)("preserves internal navigation and one logo in %s", locale => {
    const html = render(locale, "/jogos");
    expect(html.match(/data-brand-mark=/g)).toHaveLength(1);
    expect(html).toContain("site-content--inside");
    expect(html).toContain("nav-aside");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Existing page content");
    expect(html).not.toContain('id="hero-title"');
    expect(html).not.toContain('class="home-sidebar"');
    expect(html).not.toContain("hud-loader--full");
  });

  it("keeps viewport rules and respects explicitly sized article headlines", () => {
    const css = readFileSync(new URL("../app/premium.css", import.meta.url), "utf8");
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain(".desktop-nav { display: none; }");
    expect(css).toContain(".home-grid--overview { grid-template-columns: minmax(0, 1fr); }");
    expect(css).toContain(".site-content--inside h1:not([class])");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
