import { describe, expect, it } from "vitest";
import { collectNews, parseRss } from "./collect";
import { fetchAllowedPage, redactSecrets } from "./scrapingbee";
import { isAllowedSourceUrl } from "./sources";
import { filterNews, newsForMatch, newsId, saveNews, readNews } from "./store";
import type { NewsItem } from "./types";

describe("notícias", () => {
  it("recusa endereços que não estão autorizados", () => {
    expect(isAllowedSourceUrl("https://www.rtp.pt/noticias/rss/desporto")).toBe(false);
    expect(isAllowedSourceUrl("https://www.zerozero.pt/")).toBe(false);
    expect(isAllowedSourceUrl("nao-e-url")).toBe(false);
  });

  it("oculta a chave se ela aparecer numa mensagem", () => {
    process.env.SCRAPINGBEE_API_KEY = "chave-de-teste-longa";
    expect(redactSecrets("falhou api_key=chave-de-teste-longa&url=https://exemplo")).toBe("falhou api_key=oculto&url=https://exemplo");
    delete process.env.SCRAPINGBEE_API_KEY;
  });

  it("fica só com o título e rejeita um item sem ligação", () => {
    const items = parseRss(
      `<rss><channel><item><title><![CDATA[Jogo adiado]]></title><link>https://exemplo.pt/a</link><description><p>O calendário mudou.</p></description><pubDate>Sun, 18 Oct 2026 10:00:00 GMT</pubDate></item><item><title>Sem ligação</title><description>Texto</description></item></channel></rss>`,
      "Fonte de teste",
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.summary).toBe("O calendário mudou.");
    expect(items[0]?.confirmed).toBe(false);
    expect(items[0]?.relevance).toBe("baixa");
  });

  it("não recolhe nada quando a lista de fontes está vazia", async () => {
    const result = await collectNews();
    expect(result).toEqual({ ok: true, collected: 0, skipped: 0, message: "Não há fontes autorizadas." });
  });

  it("não consulta um endereço fora da lista", async () => {
    const result = await fetchAllowedPage("https://exemplo.pt/jogo");
    expect(result.ok).toBe(false);
  });

  it("não repete a mesma ligação e filtra pela equipa", async () => {
    const first = item("https://exemplo.pt/a", "Benfica confirma ausência");
    const second = item("https://exemplo.pt/a", "Benfica confirma ausência");
    const other = item("https://exemplo.pt/b", "Outro assunto");
    await saveNews([first, second, other]);
    const stored = await readNews();
    expect(stored.filter((entry) => entry.id === newsId("https://exemplo.pt/a"))).toHaveLength(1);
    expect(filterNews(stored, { team: "benfica" }).map((entry) => entry.url)).toEqual(["https://exemplo.pt/a"]);
    expect(newsForMatch(stored, ["Benfica", "FC Porto"])).toHaveLength(1);
    await saveNews([]);
  });
});

function item(url: string, title: string): NewsItem {
  return {
    id: newsId(url),
    url,
    title,
    summary: title,
    sourceName: "Teste",
    publishedAt: "2026-10-18T10:00:00.000Z",
    collectedAt: "2026-10-18T10:05:00.000Z",
    teams: [],
    competitions: [],
    relevance: "baixa",
    confirmed: false,
  };
}
