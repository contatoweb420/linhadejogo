import { beforeEach, describe, expect, it, vi } from "vitest";

const readCache = vi.fn();

vi.mock("@/lib/agents/shared/cache", () => ({
  readCache: (...args: unknown[]) => readCache(...args),
}));

import { listDrafts } from "@/lib/agents/blogs/service";
import { listThreads } from "@/lib/agents/forums/service";
import { listNews } from "@/lib/agents/news/service";
import { listReviews } from "@/lib/agents/reviews/service";

describe("agentes Webz.io em cache", () => {
  beforeEach(() => {
    readCache.mockReset();
    process.env.WEBZ_LIVE = "1";
    process.env.WEBZ_DAILY_LIMIT = "10";
    process.env.WEBZ_API_TOKEN = "token-de-teste";
    vi.stubGlobal("fetch", vi.fn());
  });

  it("devolve vazio e não chama a rede quando a cache não existe", async () => {
    readCache.mockResolvedValue(null);
    const [news, blogs, forums, reviews] = await Promise.all([listNews(), listDrafts(), listThreads(), listReviews()]);
    expect(news).toMatchObject({ items: [], requested: false });
    expect(blogs).toMatchObject({ items: [], requested: false });
    expect(forums).toMatchObject({ items: [], requested: false });
    expect(reviews).toMatchObject({ items: [], requested: false });
    expect(news.reason).toContain("cache");
    expect(blogs.reason).toContain("cache");
    expect(forums.reason).toContain("cache");
    expect(reviews.reason).toContain("cache");
    expect(fetch).not.toHaveBeenCalled();
    delete process.env.WEBZ_LIVE;
    delete process.env.WEBZ_DAILY_LIMIT;
    delete process.env.WEBZ_API_TOKEN;
  });

  it("entrega só o que já está guardado", async () => {
    readCache.mockImplementation(async (agent: string) => {
      if (agent === "news") {
        return [{ id: "n1", title: "Jogo guardado", url: "https://example.test/n", confirmed: false }];
      }
      return [];
    });
    const news = await listNews();
    expect(news.items).toHaveLength(1);
    expect(news.requested).toBe(false);
    expect(news.reason).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    delete process.env.WEBZ_LIVE;
    delete process.env.WEBZ_DAILY_LIMIT;
    delete process.env.WEBZ_API_TOKEN;
  });
});
