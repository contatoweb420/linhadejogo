import { articles } from "@/content/articles";
import { lisbonToday } from "@/server/format/pt";
import { competitionTable, listCompetitions } from "@/server/queries";
import { createdThisWeek, decideTick, promoteDue } from "./policy";
import { addRun, readAgentArticles, readConfig, readRuns, saveAgentArticles } from "./store";
import type { AgentArticle, RunOrigin, StandingFact, StandingRow } from "./types";
import { writeFromTable } from "./write";
import { searchImages } from "@/server/images/providers";

export async function tick(origin: RunOrigin) {
  const now = new Date();
  try {
    const config = await readConfig();
    const promoted = promoteDue(await readAgentArticles(), lisbonToday(now));
    let stored = promoted.promoted.length > 0 ? await saveAgentArticles(promoted.articles) : promoted.articles;
    if (!config.paused) {
      const refreshed = await refreshPublishedArticles(stored, now, config.intervalHours);
      if (refreshed.changed) stored = await saveAgentArticles(refreshed.articles);
    }
    const runs = await readRuns();
    const decision = decideTick({
      config,
      createdThisWeek: createdThisWeek(stored, now),
      lastAttemptAt: runs.find((run) => run.origin === "agenda" && run.outcome !== "pausa" && run.outcome !== "limite")?.at ?? null,
      now,
      origin,
    });
    if (!decision.ok) {
      if (origin === "manual") await log(origin, decision.outcome, decision.reason);
      return { ok: true as const, outcome: decision.outcome, reason: decision.reason };
    }

    const created = await createDraft(stored, now);
    if (!created.ok) {
      await log(origin, "ignorado", created.reason);
      return { ok: true as const, outcome: "ignorado" as const, reason: created.reason };
    }
    await saveAgentArticles([created.article, ...stored]);
    await log(origin, created.article.status === "publicado" ? "publicado" : "rascunho", created.article.reason, created.article.id);
    return { ok: true as const, outcome: created.article.status, reason: created.article.reason, articleId: created.article.id };
  } catch {
    const reason = "A geração falhou antes de gravar um artigo. Nenhum texto foi inventado para a substituir.";
    await log(origin, "erro", reason).catch(() => undefined);
    return { ok: false as const, outcome: "erro" as const, reason };
  }
}

async function refreshPublishedArticles(articles: AgentArticle[], now: Date, intervalHours: number) {
  const intervalMs = intervalHours * 3_600_000;
  const due = articles.filter((article) => {
    if (article.status !== "publicado") return false;
    const lastUpdated = new Date(article.updatedAt ?? article.createdAt).getTime();
    return Number.isFinite(lastUpdated) && now.getTime() - lastUpdated >= intervalMs;
  });
  if (due.length === 0) return { articles, changed: false };

  const competitions = new Map((await listCompetitions()).map((competition) => [competition.code, competition]));
  const facts = new Map<string, StandingFact | null>();
  const next = [...articles];
  let changed = false;

  for (const article of due) {
    const competition = competitions.get(article.subject);
    if (!competition) continue;
    let fact = facts.get(competition.code);
    if (fact === undefined) {
      const rows = (await competitionTable(competition.id, "TOTAL")).map(completeRow).filter((row): row is StandingRow => row !== null);
      fact = {
        competitionName: competition.name,
        competitionCode: competition.code,
        country: competition.country ?? "Não disponível",
        rows,
      };
      facts.set(competition.code, fact);
    }
    if (!fact) continue;
    const latest = writeFromTable(fact, article.kind, [], now);
    if (!latest.ok) continue;
    const contentChanged = article.title !== latest.article.title
      || article.summary !== latest.article.summary
      || JSON.stringify(article.blocks) !== JSON.stringify(latest.article.blocks)
      || article.seoTitle !== latest.article.seoTitle
      || article.seoDescription !== latest.article.seoDescription
      || article.cover !== latest.article.cover
      || article.category !== latest.article.category
      || JSON.stringify(article.tags) !== JSON.stringify(latest.article.tags);
    if (!contentChanged) continue;

    const index = next.findIndex((item) => item.id === article.id);
    if (index < 0) continue;
    next[index] = {
      ...article,
      ...latest.article,
      id: article.id,
      slug: article.slug,
      createdAt: article.createdAt,
      coverImage: article.coverImage,
      publishOn: article.publishOn,
      status: article.status,
      reason: "Artigo atualizado com a classificação mais recente guardada na Linha de Jogo.",
      updatedAt: now.toISOString(),
    };
    changed = true;
  }

  return { articles: next, changed };
}

async function createDraft(stored: AgentArticle[], now: Date) {
  const titles = [...articles.map((article) => article.title), ...stored.map((article) => article.title)];
  const recent = new Set(
    stored
      .filter((article) => now.getTime() - new Date(article.createdAt).getTime() < 21 * 86_400_000)
      .map((article) => `${article.kind}:${article.subject}`),
  );
  const lastKind = [...stored].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.kind;
  const competitions = [...(await listCompetitions())].sort((a, b) => rank(a) - rank(b));
  const reasons: string[] = [];
  for (const competition of competitions.slice(0, 6)) {
    if (recent.has(`classificacao:${competition.code}`) && recent.has(`comparacao:${competition.code}`)) {
      reasons.push(`${competition.name} já teve os dois tipos de artigo neste período.`);
      continue;
    }
    const rows = (await competitionTable(competition.id, "TOTAL")).map(completeRow).filter((row): row is StandingRow => row !== null);
    const fact: StandingFact = {
      competitionName: competition.name,
      competitionCode: competition.code,
      country: competition.country ?? "Não disponível",
      rows,
    };
    const kinds: AgentArticle["kind"][] = lastKind === "classificacao" ? ["comparacao", "classificacao"] : ["classificacao", "comparacao"];
    for (const kind of kinds) {
      if (recent.has(`${kind}:${competition.code}`)) continue;
      const written = writeFromTable(fact, kind, titles, now);
      if (!written.ok) {
        reasons.push(written.reason);
        continue;
      }
      const article: AgentArticle = {
        ...written.article,
        id: written.article.slug,
        coverImage: (await searchImages(`football ${competition.name} ${competition.country ?? ""}`)).items[0],
        status: "rascunho",
        reason: "Rascunho criado para revisão humana. A publicação exige aprovação na redação.",
      };
      return { ok: true as const, article };
    }
  }
  return {
    ok: false as const,
    reason: reasons[0] ?? "Não há um tema com classificação suficiente para um artigo original.",
  };
}

function rank(competition: { code: string; country: string | null }) {
  const country = competition.country?.toLocaleLowerCase("pt-PT") ?? "";
  return competition.code === "PPL" || country.includes("portug") ? 0 : 1;
}

function completeRow(row: {
  position: number | null;
  teamName: string | null;
  played: number | null;
  won: number | null;
  draw: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDifference: number | null;
  points: number | null;
}): StandingRow | null {
  if (!row.teamName) return null;
  const numbers = [row.position, row.played, row.won, row.draw, row.lost, row.goalsFor, row.goalsAgainst, row.goalDifference, row.points];
  if (numbers.some((value) => typeof value !== "number")) return null;
  return {
    position: row.position as number,
    teamName: row.teamName,
    played: row.played as number,
    won: row.won as number,
    draw: row.draw as number,
    lost: row.lost as number,
    goalsFor: row.goalsFor as number,
    goalsAgainst: row.goalsAgainst as number,
    goalDifference: row.goalDifference as number,
    points: row.points as number,
  };
}

async function log(origin: RunOrigin, outcome: "rascunho" | "publicado" | "ignorado" | "erro" | "pausa" | "limite" | "espera", reason: string, articleId?: string) {
  await addRun({ id: `${Date.now().toString(36)}-${origin}`, at: new Date().toISOString(), origin, outcome, reason, articleId });
}
