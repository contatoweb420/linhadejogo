import { eq } from "drizzle-orm";
import { agentNames, type AgentName } from "@/lib/agents/shared/config";
import { AgentError } from "@/lib/agents/shared/errors";
import { getDb } from "@/server/db/client";
import { agentCache } from "@/server/db/schema";

function asList(value: unknown): unknown[] | null {
  if (value == null) return null;
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new AgentError("A cache local está ilegível.", "sem-dados");
    }
  }
  if (!Array.isArray(parsed)) {
    throw new AgentError("A cache local está ilegível.", "sem-dados");
  }
  return parsed;
}

export async function readCache<T>(agent: AgentName): Promise<T | null> {
  if (!agentNames.includes(agent)) {
    throw new AgentError("A cache local está ilegível.", "sem-dados");
  }
  try {
    const rows = await getDb()
      .select({ itens: agentCache.itens })
      .from(agentCache)
      .where(eq(agentCache.agent, agent))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return asList(row.itens) as T | null;
  } catch (error) {
    if (error instanceof AgentError) throw error;
    throw new AgentError("A cache na base de dados não está disponível.", "sem-dados");
  }
}
