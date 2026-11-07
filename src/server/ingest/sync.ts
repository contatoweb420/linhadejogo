import { and, eq, gte } from "drizzle-orm";
import { getDb } from "../db/client";
import { apiCalls, syncState } from "../db/schema";
import { addCalendarDays } from "../format/pt";
import {
  fetchCompetitionMatches,
  fetchCompetitions,
  fetchHeadToHead,
  fetchMatch,
  fetchMatches,
  fetchStandings,
  fetchTeam,
  fetchTeamMatches,
  footballDataToken,
  ProviderError,
  sourceName,
} from "../providers/football-data";
import { saveCompetitions, saveMatches, saveSquad, saveStandings } from "./save";

const source = sourceName();
const FORCE_COOLDOWN_MS = 60_000;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRateLimit<T>(task: () => Promise<T>) {
  const db = getDb();
  let reserved = false;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const [inserted] = await db.insert(apiCalls).values({ calledAt: new Date() }).returning({ id: apiCalls.id });
    const since = new Date(Date.now() - 60_000);
    const recent = await db.select({ id: apiCalls.id }).from(apiCalls).where(gte(apiCalls.calledAt, since));
    if (recent.length <= 8) {
      reserved = true;
      break;
    }
    await db.delete(apiCalls).where(eq(apiCalls.id, inserted.id));
    await sleep(1500);
  }
  if (!reserved) {
    throw new ProviderError("Limite local de pedidos atingido. Os dados guardados mantêm-se.", 429);
  }
  return task();
}

async function isFresh(key: string, ttlMs: number) {
  const db = getDb();
  const [row] = await db.select().from(syncState).where(eq(syncState.key, key));
  if (!row?.ok) return false;
  return Date.now() - row.fetchedAt.getTime() < ttlMs;
}

async function skipIfFresh(key: string, force: boolean, ttlMs: number) {
  if (force && (await isFresh(key, FORCE_COOLDOWN_MS))) {
    return { ok: true, message: null as string | null };
  }
  if (!force && (await isFresh(key, ttlMs))) return { ok: true, message: null as string | null };
  return null;
}

async function mark(key: string, ok: boolean, message: string | null) {
  const db = getDb();
  const now = new Date();
  await db
    .insert(syncState)
    .values({ key, source, fetchedAt: now, ok, message })
    .onConflictDoUpdate({
      target: syncState.key,
      set: { fetchedAt: now, ok, message, source },
    });
}

function errorMessage(error: unknown) {
  if (error instanceof ProviderError) return error.message;
  return "Não foi possível atualizar os dados. São mostrados os registos guardados.";
}

function missingToken() {
  return { ok: false, message: "A recolha no servidor ainda não está configurada." };
}

export function windowKey(day: string) {
  return `window:${addCalendarDays(day, -3)}`;
}

export async function syncCompetitions(force = false) {
  if (!footballDataToken()) return missingToken();
  const cached = await skipIfFresh("competitions", force, 24 * 60 * 60 * 1000);
  if (cached) return cached;
  try {
    const competitions = await withRateLimit(() => fetchCompetitions());
    await saveCompetitions(competitions);
    await mark("competitions", true, null);
    return { ok: true, message: null };
  } catch (error) {
    const message = errorMessage(error);
    await mark("competitions", false, message);
    return { ok: false, message };
  }
}

export async function syncWindow(day: string, force = false) {
  if (!footballDataToken()) return missingToken();
  const key = windowKey(day);
  const cached = await skipIfFresh(key, force, 10 * 60 * 1000);
  if (cached) return cached;
  try {
    await syncCompetitions(false);
    const from = addCalendarDays(day, -3);
    const to = addCalendarDays(day, 4);
    const rows = await withRateLimit(() => fetchMatches(`dateFrom=${from}&dateTo=${to}`));
    await saveMatches(rows);
    await mark(key, true, null);
    return { ok: true, message: null };
  } catch (error) {
    const message = errorMessage(error);
    await mark(key, false, message);
    return { ok: false, message };
  }
}

export async function syncCompetitionSeason(code: string, force = false) {
  if (!footballDataToken()) return missingToken();
  const key = `season:${code}`;
  const cached = await skipIfFresh(key, force, 6 * 60 * 60 * 1000);
  if (cached) return cached;
  try {
    const rows = await withRateLimit(() => fetchCompetitionMatches(code));
    await saveMatches(rows);
    await mark(key, true, null);
    return { ok: true, message: null };
  } catch (error) {
    const message = errorMessage(error);
    await mark(key, false, message);
    return { ok: false, message };
  }
}

export async function syncStandings(code: string, force = false) {
  if (!footballDataToken()) return missingToken();
  const key = `standings:${code}`;
  const cached = await skipIfFresh(key, force, 60 * 60 * 1000);
  if (cached) return cached;
  try {
    const table = await withRateLimit(() => fetchStandings(code));
    await saveStandings(table);
    await mark(key, true, null);
    return { ok: true, message: null };
  } catch (error) {
    const message = errorMessage(error);
    await mark(key, false, message);
    return { ok: false, message };
  }
}

export async function syncMatch(externalId: number, force = false) {
  if (!footballDataToken()) return missingToken();
  const key = `match:${externalId}`;
  const cached = await skipIfFresh(key, force, 10 * 60 * 1000);
  if (cached) return cached;
  try {
    const match = await withRateLimit(() => fetchMatch(externalId));
    await saveMatches([match]);
    await mark(key, true, null);
    return { ok: true, message: null };
  } catch (error) {
    const message = errorMessage(error);
    await mark(key, false, message);
    return { ok: false, message };
  }
}

export async function syncHeadToHead(externalId: number, force = false) {
  if (!footballDataToken()) return missingToken();
  const key = `h2h:${externalId}`;
  const cached = await skipIfFresh(key, force, 24 * 60 * 60 * 1000);
  if (cached) return cached;
  try {
    const rows = await withRateLimit(() => fetchHeadToHead(externalId));
    await saveMatches(rows);
    await mark(key, true, null);
    return { ok: true, message: null };
  } catch (error) {
    const message = errorMessage(error);
    await mark(key, false, message);
    return { ok: false, message };
  }
}

export async function syncTeam(externalId: number, force = false) {
  if (!footballDataToken()) return missingToken();
  const key = `team:${externalId}`;
  const cached = await skipIfFresh(key, force, 24 * 60 * 60 * 1000);
  if (cached) return cached;
  try {
    const team = await withRateLimit(() => fetchTeam(externalId));
    const hasSquad = await saveSquad(externalId, team);
    const played = await withRateLimit(() => fetchTeamMatches(externalId));
    await saveMatches(played);
    await mark(key, true, hasSquad ? null : "O plano gratuito não devolveu o plantel.");
    return { ok: true, message: hasSquad ? null : "O plano gratuito não devolveu o plantel." };
  } catch (error) {
    const message = errorMessage(error);
    await mark(key, false, message);
    return { ok: false, message };
  }
}

export async function syncStateFor(key: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(syncState)
    .where(and(eq(syncState.key, key), eq(syncState.source, source)));
  return row ?? null;
}
