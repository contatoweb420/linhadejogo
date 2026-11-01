import { describe, expect, it } from "vitest";
import { createdThisWeek, decideTick, DEFAULT_CONFIG, isPublicStatus, promoteDue, titlesAreSimilar } from "./policy";
import type { AgentArticle, StandingFact } from "./types";
import { writeFromTable } from "./write";

const now = new Date("2026-10-21T12:00:00.000Z");

function article(partial: Partial<AgentArticle>): AgentArticle {
  return {
    id: "id",
    title: "Título",
    slug: "titulo",
    summary: "Resumo",
    blocks: [],
    cover: "competicao",
    category: "Campeonatos",
    tags: [],
    author: "Linha de Jogo",
    createdAt: now.toISOString(),
    publishOn: "2026-10-21",
    seoTitle: "Título",
    seoDescription: "Resumo",
    sources: [],
    status: "rascunho",
    reason: "teste",
    kind: "classificacao",
    subject: "PPL",
    ...partial,
  };
}

function fact(count = 8): StandingFact {
  return {
    competitionName: "Primeira Liga",
    competitionCode: "PPL",
    country: "Portugal",
    rows: Array.from({ length: count }, (_, index) => ({
      position: index + 1,
      teamName: `Equipa ${index + 1}`,
      played: 10,
      won: Math.max(0, 8 - index),
      draw: 1,
      lost: index,
      goalsFor: 20 - index,
      goalsAgainst: 8 + index,
      goalDifference: 12 - index * 2,
      points: 25 - index * 3,
    })),
  };
}

describe("agente do blog", () => {
  it("respeita pausa, limite semanal e intervalo", () => {
    expect(decideTick({ config: { ...DEFAULT_CONFIG, paused: true }, createdThisWeek: 0, lastAttemptAt: null, now, origin: "agenda" }).ok).toBe(false);
    expect(decideTick({ config: DEFAULT_CONFIG, createdThisWeek: 3, lastAttemptAt: null, now, origin: "manual" }).ok).toBe(false);
    expect(
      decideTick({ config: DEFAULT_CONFIG, createdThisWeek: 0, lastAttemptAt: now.toISOString(), now, origin: "agenda" }).ok,
    ).toBe(false);
    expect(
      decideTick({ config: DEFAULT_CONFIG, createdThisWeek: 0, lastAttemptAt: now.toISOString(), now, origin: "manual" }).ok,
    ).toBe(true);
  });

  it("evita títulos parecidos e esconde rascunhos", () => {
    expect(titlesAreSimilar("A classificação guardada da Primeira Liga", "A classificação guardada da Primeira Liga")).toBe(true);
    expect(titlesAreSimilar("Como ler uma estimativa", "A classificação guardada da Primeira Liga")).toBe(false);
    expect(isPublicStatus("rascunho", "2026-10-21", "2026-10-21")).toBe(false);
    expect(isPublicStatus("agendado", "2026-10-22", "2026-10-21")).toBe(false);
    expect(isPublicStatus("publicado", "2026-10-21", "2026-10-21")).toBe(true);
    const promoted = promoteDue([article({ status: "agendado", publishOn: "2026-10-21" })], "2026-10-21");
    expect(promoted.articles[0]?.status).toBe("publicado");
  });

  it("escreve só com números reais e recusa uma tabela curta", () => {
    const short = writeFromTable(fact(7), "classificacao", [], now);
    expect(short.ok).toBe(false);
    const written = writeFromTable(fact(), "classificacao", [], now);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    const text = JSON.stringify(written.article.blocks);
    expect(text).toContain("Equipa 1");
    expect(text).toContain("25");
    expect(text).toContain("10");
    expect(text).toContain("não");
    expect(written.article.kind).toBe("classificacao");
    expect(createdThisWeek([article({})], now)).toBe(1);
  });
});
