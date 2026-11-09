import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import Link from "./localized-link";
import { LocaleProvider } from "./locale-context";
import { locales } from "@/lib/i18n";

it.each(locales)("localizes actual SSR anchors in %s without removing links or their attributes", locale => {
  const html = renderToStaticMarkup(<LocaleProvider locale={locale}>
    <Link href="/jogos/42?data=2024-01-15#stats" aria-label="Saved game">Game</Link>
    <Link href="/en-us/blog/forma-recente">Original article</Link>
    <Link href="https://example.com/source" target="_blank" rel="noreferrer">Source</Link>
    <Link href={{ pathname: "/competicoes/PL", query: { tabela: "HOME" } }}>Table</Link>
  </LocaleProvider>);
  expect(html).toContain(`href="/${locale.toLowerCase()}/jogos/42?data=2024-01-15#stats"`);
  expect(html).toContain('href="/pt-pt/blog/forma-recente"');
  expect(html).toContain('href="https://example.com/source"');
  expect(html).toContain(`href="/${locale.toLowerCase()}/competicoes/PL?tabela=HOME"`);
  expect(html).toContain('aria-label="Saved game"');
  expect(html).toContain('rel="noreferrer"');
});
