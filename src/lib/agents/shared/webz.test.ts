import { describe, expect, it, vi } from "vitest";
import { AgentError } from "@/lib/agents/shared/errors";
import { fetchWebz, validateWebzQuery, webzEndpoints, webzRequest } from "@/lib/agents/shared/webz";

describe("webz", () => {
  it("usa os endpoints oficiais e não põe o token no endereço de notícias, blogs e fóruns", () => {
    process.env.WEBZ_API_TOKEN = "token-de-teste";
    for (const product of ["news", "blogs", "forums"] as const) {
      const request = webzRequest(product, { q: "futebol", size: 5 });
      expect(request.url.origin + request.url.pathname).toBe(webzEndpoints[product]);
      expect(request.url.searchParams.get("token")).toBeNull();
      expect(request.url.searchParams.get("q")).toBe("futebol");
      expect(request.url.searchParams.get("size")).toBe("5");
      expect(request.headers.Authorization).toBe("Bearer token-de-teste");
    }
    delete process.env.WEBZ_API_TOKEN;
  });

  it("autentica as críticas com o token na query, como a documentação indica", () => {
    process.env.WEBZ_API_TOKEN = "token-de-teste";
    const request = webzRequest("reviews", { q: "futebol", size: 5 });
    expect(request.url.origin + request.url.pathname).toBe("https://api.webz.io/reviewFilter");
    expect(request.url.searchParams.get("token")).toBe("token-de-teste");
    expect(request.headers.Authorization).toBeUndefined();
    delete process.env.WEBZ_API_TOKEN;
  });

  it("recusa uma consulta vazia e não chama a rede quando a ligação está desligada", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(() => validateWebzQuery({ q: "  " })).toThrow(AgentError);
    delete process.env.WEBZ_LIVE;
    await expect(fetchWebz("news", { q: "futebol" })).rejects.toMatchObject({ code: "sem-fonte" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
