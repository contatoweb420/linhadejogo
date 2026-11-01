import { formatNumber } from "@/server/format/pt";
import { slugify, titlesAreSimilar } from "./policy";
import type { AgentArticle, StandingFact, StandingRow } from "./types";

const SOURCE = {
  name: "Classificação guardada na Linha de Jogo",
  note: "Números da tabela local recolhida da origem desportiva. O texto não copia um artigo externo e não acrescenta estatísticas que não estejam nesta tabela.",
};

export function writeFromTable(
  fact: StandingFact,
  kind: AgentArticle["kind"],
  existingTitles: string[],
  now = new Date(),
): { ok: true; article: Omit<AgentArticle, "id" | "status" | "reason"> } | { ok: false; reason: string } {
  const rows = [...fact.rows].sort((a, b) => a.position - b.position);
  if (rows.length < 8) {
    return { ok: false, reason: `${fact.competitionName} tem menos de 8 equipas com números completos na classificação guardada.` };
  }
  const draft = kind === "comparacao" ? comparison(fact, rows) : standings(fact, rows);
  if (!draft) return { ok: false, reason: `${fact.competitionName} não tem duas equipas comparáveis na mesma tabela.` };
  if (existingTitles.some((title) => titlesAreSimilar(title, draft.title))) {
    return { ok: false, reason: `Já existe um artigo parecido com «${draft.title}».` };
  }
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return {
    ok: true,
    article: {
      ...draft,
      slug: `${slugify(draft.title)}-${fact.competitionCode.toLowerCase()}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      publishOn: day,
      author: "Linha de Jogo",
      sources: [SOURCE],
      subject: fact.competitionCode,
    },
  };
}

function count(value: number, singular: string, plural: string) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`;
}

function standings(fact: StandingFact, rows: StandingRow[]) {
  const top = rows.slice(0, 3);
  const leader = top[0];
  const title = `A classificação guardada de ${fact.competitionName}`;
  const summary = `${fact.competitionName} tem ${formatNumber(rows.length)} equipas com números completos na tabela guardada. ${leader.teamName} soma ${formatNumber(leader.points)} pontos em ${formatNumber(leader.played)} jogos. Esta leitura descreve a tabela e não prevê o jogo seguinte.`;
  return {
    title,
    summary,
    seoTitle: title,
    seoDescription: summary.slice(0, 160),
    cover: "competicao" as const,
    category: "Campeonatos" as const,
    tags: [fact.competitionName, fact.country, "classificação"],
    kind: "classificacao" as const,
    blocks: [
      {
        type: "p" as const,
        text: `Este texto usa apenas a classificação de ${fact.competitionName} guardada na Linha de Jogo. São ${formatNumber(rows.length)} equipas com jogos, resultados, golos e pontos preenchidos. Não é uma antevisão nem uma probabilidade.`,
      },
      { type: "h2" as const, text: "Os três primeiros lugares da tabela guardada" },
      {
        type: "ul" as const,
        items: top.map(
          (row) =>
            `${formatNumber(row.position)}. ${row.teamName}: ${count(row.points, "ponto", "pontos")}, ${count(row.played, "jogo", "jogos")}, ${count(row.won, "vitória", "vitórias")}, ${count(row.draw, "empate", "empates")}, ${count(row.lost, "derrota", "derrotas")}, ${count(row.goalsFor, "golo marcado", "golos marcados")} e ${count(row.goalsAgainst, "golo sofrido", "golos sofridos")}.`,
        ),
      },
      { type: "h2" as const, text: "O que estes pontos não dizem" },
      {
        type: "p" as const,
        text: `${leader.teamName} lidera esta tabela com ${formatNumber(leader.points)} pontos e uma diferença de golos de ${formatNumber(leader.goalDifference)}. Estar à frente descreve os jogos já registados. Não indica o vencedor do próximo encontro, nem entra no modelo de probabilidades da Linha de Jogo.`,
      },
    ],
  };
}

function comparison(fact: StandingFact, rows: StandingRow[]) {
  const home = rows[0];
  const away = rows[Math.min(rows.length - 1, 7)];
  if (!home || !away || home.teamName === away.teamName) return null;
  const title = `${home.teamName} e ${away.teamName} na tabela de ${fact.competitionName}`;
  const summary = `Na classificação guardada de ${fact.competitionName}, ${home.teamName} tem ${formatNumber(home.points)} pontos em ${formatNumber(home.played)} jogos e ${away.teamName} tem ${formatNumber(away.points)} pontos em ${formatNumber(away.played)} jogos. A comparação é descritiva.`;
  return {
    title,
    summary,
    seoTitle: title,
    seoDescription: summary.slice(0, 160),
    cover: "analise" as const,
    category: "Análise estatística" as const,
    tags: [fact.competitionName, home.teamName, away.teamName],
    kind: "comparacao" as const,
    blocks: [
      {
        type: "p" as const,
        text: `A comparação usa a mesma classificação guardada de ${fact.competitionName}. ${home.teamName} aparece no lugar ${formatNumber(home.position)} e ${away.teamName} no lugar ${formatNumber(away.position)}. Não há aqui uma estimativa de resultado.`,
      },
      { type: "h2" as const, text: "Números já registados" },
      {
        type: "ul" as const,
        items: [home, away].map(
          (row) =>
            `${row.teamName}: ${count(row.played, "jogo", "jogos")}, ${count(row.won, "vitória", "vitórias")}, ${count(row.draw, "empate", "empates")}, ${count(row.lost, "derrota", "derrotas")}, ${formatNumber(row.goalsFor)}-${formatNumber(row.goalsAgainst)} em golos e ${count(row.points, "ponto", "pontos")}.`,
        ),
      },
      { type: "h2" as const, text: "Como ler a diferença" },
      {
        type: "p" as const,
        text: `A distância na tabela é de ${formatNumber(Math.abs(home.points - away.points))} pontos. As amostras têm ${formatNumber(home.played)} e ${formatNumber(away.played)} jogos. Médias ou percentagens feitas com amostras diferentes não se comparam como se fossem a mesma prova, e estes pontos não são a probabilidade do próximo jogo.`,
      },
    ],
  };
}
