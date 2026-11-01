import { lisbonToday } from "@/server/format/pt";
import type { AgentArticle, AgentConfig, AgentStatus, RunOrigin } from "./types";

export const DEFAULT_CONFIG: AgentConfig = {
  paused: false,
  maxPerWeek: 3,
  autoPublish: false,
  intervalHours: 24,
};

export function clampConfig(input: Partial<AgentConfig>): AgentConfig {
  const max = Number(input.maxPerWeek);
  const interval = Number(input.intervalHours);
  return {
    paused: input.paused === true,
    maxPerWeek: Number.isFinite(max) ? Math.min(7, Math.max(0, Math.trunc(max))) : DEFAULT_CONFIG.maxPerWeek,
    autoPublish: false,
    intervalHours: Number.isFinite(interval) ? Math.min(168, Math.max(1, Math.trunc(interval))) : DEFAULT_CONFIG.intervalHours,
  };
}

export function lisbonWeekKey(now = new Date()) {
  const [year, month, day] = lisbonToday(now).split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const start = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - start.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function tokens(value: string) {
  return new Set(slugify(value).split("-").filter((token) => token.length > 2));
}

export function titlesAreSimilar(left: string, right: string) {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared) >= 0.55;
}

export function createdThisWeek(articles: AgentArticle[], now = new Date()) {
  const week = lisbonWeekKey(now);
  return articles.filter((article) => lisbonWeekKey(new Date(article.createdAt)) === week).length;
}

export function decideTick(input: {
  config: AgentConfig;
  createdThisWeek: number;
  lastAttemptAt: string | null;
  now: Date;
  origin: RunOrigin;
}): { ok: true } | { ok: false; outcome: "pausa" | "limite" | "espera"; reason: string } {
  if (input.config.paused) return { ok: false, outcome: "pausa", reason: "O agente está em pausa." };
  if (input.createdThisWeek >= input.config.maxPerWeek) {
    return { ok: false, outcome: "limite", reason: "O limite semanal de rascunhos já foi atingido." };
  }
  if (input.origin === "agenda" && input.lastAttemptAt) {
    const elapsed = input.now.getTime() - new Date(input.lastAttemptAt).getTime();
    if (elapsed < input.config.intervalHours * 3_600_000) {
      return { ok: false, outcome: "espera", reason: "Ainda não passou o intervalo configurado." };
    }
  }
  return { ok: true };
}

export function isPublicStatus(status: AgentStatus, publishOn: string, today = lisbonToday()) {
  return status === "publicado" && publishOn <= today;
}

export function promoteDue(articles: AgentArticle[], today = lisbonToday()) {
  const promoted: string[] = [];
  const next = articles.map((article) => {
    if (article.status === "agendado" && article.publishOn <= today) {
      promoted.push(article.id);
      return { ...article, status: "publicado" as const, reason: "A data prevista chegou e a revisão já tinha agendado a publicação." };
    }
    return article;
  });
  return { articles: next, promoted };
}
