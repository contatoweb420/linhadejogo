import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { clampConfig, DEFAULT_CONFIG } from "./policy";
import type { AgentArticle, AgentConfig, AgentStatus, RunLog } from "./types";

const DIR = "blog-agente";

function directory() {
  return path.join(process.cwd(), ".cache", DIR);
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(directory(), name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(name: string, value: unknown) {
  await mkdir(directory(), { recursive: true });
  await writeFile(path.join(directory(), name), JSON.stringify(value), "utf8");
}

export async function readConfig(): Promise<AgentConfig> {
  const stored = await readJson<Partial<AgentConfig>>("config.json", {});
  return clampConfig({ ...DEFAULT_CONFIG, ...stored });
}

export async function saveConfig(config: AgentConfig) {
  const next = clampConfig(config);
  await writeJson("config.json", next);
  return next;
}

export async function readAgentArticles(): Promise<AgentArticle[]> {
  const stored = await readJson<unknown>("artigos.json", []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isAgentArticle);
}

export async function saveAgentArticles(articles: AgentArticle[]) {
  const kept = articles.filter(isAgentArticle);
  const priority: Record<AgentStatus, number> = {
    rascunho: 0,
    "em-revisao": 1,
    agendado: 2,
    publicado: 3,
    rejeitado: 4,
  };
  const limited = [...kept]
    .sort((a, b) => priority[a.status] - priority[b.status] || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40);
  await writeJson("artigos.json", limited);
  return limited;
}

export async function readRuns(): Promise<RunLog[]> {
  const stored = await readJson<unknown>("execucoes.json", []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isRun).slice(0, 50);
}

export async function addRun(run: RunLog) {
  const runs = await readRuns();
  await writeJson("execucoes.json", [run, ...runs].slice(0, 50));
}

function isAgentArticle(value: unknown): value is AgentArticle {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AgentArticle>;
  return Boolean(item.id && item.slug && item.title && item.summary && item.createdAt && item.publishOn && item.status && item.blocks);
}

function isRun(value: unknown): value is RunLog {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RunLog>;
  return Boolean(item.id && item.at && item.origin && item.outcome && item.reason);
}
