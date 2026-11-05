import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("localized proxy", () => {
  it.each(["pt-br", "pt-pt", "en-us"])("forwards %s as request metadata and preserves search parameters", (locale) => {
    const response = proxy(new NextRequest(`https://example.test/${locale}/jogos?data=2026-11-04&competicao=PPL&x=1&x=2`));
    expect(response.headers.get("x-middleware-request-x-site-locale")).toBe(locale);
    expect(response.headers.get("x-middleware-request-x-site-path")).toBe(`/${locale}/jogos`);
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://example.test/jogos?data=2026-11-04&competicao=PPL&x=1&x=2");
  });
  it("preserves a loopback host instead of rewriting to a different origin", () => {
    const request = new NextRequest("http://127.0.0.1:3101/en-us", { headers: { host: "127.0.0.1:3101" } });
    expect(proxy(request).headers.get("x-middleware-rewrite")).toBe("http://127.0.0.1:3101/");
  });
  it("redirects with the locale cookie and keeps all parameters", () => {
    const response = proxy(new NextRequest("https://example.test/jogos?data=2026-11-04", { headers: { cookie: "linha-de-jogo-locale=en-us" } }));
    expect(response.headers.get("location")).toBe("https://example.test/en-us/jogos?data=2026-11-04");
  });
  it("overwrites a conflicting locale header with the URL locale", () => {
    const response = proxy(new NextRequest("https://example.test/pt-pt", { headers: { "x-site-locale": "en-us" } }));
    expect(response.headers.get("x-middleware-request-x-site-locale")).toBe("pt-pt");
  });
  it("leaves collection API requests untouched", () => {
    expect(proxy(new NextRequest("https://example.test/api/recolha")).headers.get("x-middleware-rewrite")).toBeNull();
  });
});

it("does not redirect a validated second internal rewrite pass", () => {
  const response = proxy(new NextRequest("https://example.test/jogos?x=1", { headers: { "x-site-locale": "en-us", "x-site-path": "/en-us/jogos" } }));
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
});
it("does not trust a mismatched forwarded path", () => {
  const response = proxy(new NextRequest("https://example.test/jogos", { headers: { "x-site-locale": "en-us", "x-site-path": "/en-us/blog" } }));
  expect(response.headers.get("location")).toBe("https://example.test/pt-br/jogos");
});
