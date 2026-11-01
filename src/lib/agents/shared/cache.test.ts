import { beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn();

vi.mock("@/server/db/client", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (clause: unknown) => ({
          limit: () => limit(clause),
        }),
      }),
    }),
  }),
}));

import { readCache } from "@/lib/agents/shared/cache";
import { AgentError } from "@/lib/agents/shared/errors";

function askedAgent(clause: unknown) {
  const found: unknown[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 8 || value == null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const record = value as { value?: unknown; queryChunks?: unknown };
    if ("value" in record && !Array.isArray(record.queryChunks)) found.push(record.value);
    if (Array.isArray(record.queryChunks)) visit(record.queryChunks, depth + 1);
  };
  visit(clause, 0);
  return found.find((item) => item === "news" || item === "blogs" || item === "forums" || item === "reviews");
}

describe("cache dos agentes na base de dados", () => {
  const table = new Map<string, unknown>();

  beforeEach(() => {
    table.clear();
    limit.mockReset();
    limit.mockImplementation(async (clause: unknown) => {
      const agent = askedAgent(clause);
      if (typeof agent !== "string" || !table.has(agent)) return [];
      return [{ itens: table.get(agent) }];
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("devolve vazio quando o agente não tem linha", async () => {
    await expect(readCache("news")).resolves.toBeNull();
    table.set("blogs", null);
    await expect(readCache("blogs")).resolves.toBeNull();
    table.set("forums", []);
    await expect(readCache("forums")).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("devolve só os itens do agente pedido", async () => {
    table.set("news", [{ id: "n1" }]);
    table.set("blogs", [{ id: "b1" }]);
    table.set("forums", [{ id: "f1" }]);
    table.set("reviews", [{ id: "r1" }]);
    await expect(readCache("news")).resolves.toEqual([{ id: "n1" }]);
    await expect(readCache("blogs")).resolves.toEqual([{ id: "b1" }]);
    await expect(readCache("forums")).resolves.toEqual([{ id: "f1" }]);
    await expect(readCache("reviews")).resolves.toEqual([{ id: "r1" }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("recusa JSON que não é uma lista", async () => {
    table.set("news", "{isto não é json");
    await expect(readCache("news")).rejects.toMatchObject({ name: "AgentError", code: "sem-dados" });
    table.set("blogs", { titulo: "objeto" });
    await expect(readCache("blogs")).rejects.toBeInstanceOf(AgentError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("esconde a ligação quando a base falha", async () => {
    limit.mockRejectedValue(new Error("connect ECONNREFUSED postgresql://quadrante:segredo@localhost:5432/quadrante"));
    await expect(readCache("reviews")).rejects.toMatchObject({
      message: "A cache na base de dados não está disponível.",
      code: "sem-dados",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
