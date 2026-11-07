import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "./schema";
import { beginPreviewReadOnlySession, endPreviewReadOnlySession,
  verifyPreviewReadOnlySession, type PreviewReadOnlySession } from "./preview-readonly-session";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("./client", () => ({ getDb: () => {
  if (!state.db) throw new Error("Read-only database not initialized");
  return state.db;
} }));
import { competitionTable, getMatchBundle, getTeamByExternalId,
  listCompetitions, listHomeMatches, settledPredictions, teamMatches } from "../queries";

const enabled = process.env.LDJ_PREVIEW_VALIDATION === "1";
let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;
let session: PreviewReadOnlySession | undefined;

async function diagnose(phase: string, operation: () => Promise<void>) {
  try {
    if (phase !== "SETUP" && phase !== "SESSION_IDENTITY") {
      if (!session) throw Object.assign(new Error(), { code: "SESSION_CHANGED" });
      await verifyPreviewReadOnlySession(session);
    }
    await operation();
  } catch (error) {
    let current: unknown = error;
    let code = "UNCLASSIFIED";
    for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
      const item = current as { code?: unknown; name?: unknown; cause?: unknown };
      if (typeof item.code === "string" && /^(?:[0-9A-Z]{5}|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|CONNECT_TIMEOUT|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|ERR_TLS_CERT_ALTNAME_INVALID|ENOENT|DATABASE_MISMATCH|CURRENT_USER_MISMATCH|SESSION_USER_MISMATCH|READ_ONLY_OFF|SESSION_CHANGED)$/.test(item.code)) {
        code = item.code;
        break;
      }
      if (item.name === "AssertionError") code = "ASSERTION_FAILED";
      current = item.cause;
    }
    // No original message, cause, SQL, arguments or response rows escape.
    throw new Error(`[LDJ_PHASE=${phase} CODE=${code}]`);
  }
}

describe.skipIf(!enabled)("restored Preview real read-only queries", () => {
  beforeAll(async () => {
    await diagnose("SETUP", async () => {
    if (process.env.PGHOST !== "aws-0-eu-west-1.pooler.supabase.com" ||
        process.env.PGPORT !== "5432" ||
        process.env.PGUSER !== "postgres.eoroljcefsurgsxegfzp" ||
        process.env.PGDATABASE !== "postgres" || process.env.PGSSLMODE !== "verify-full" ||
        process.env.PGSSLROOTCERT !== "/home/pablo/Downloads/prod-ca-2021-novo.crt") {
      throw new Error("Exclusive Preview connection required");
    }
    client = postgres({
      host: process.env.PGHOST, port: 5432, username: process.env.PGUSER,
      password: process.env.PGPASSWORD, database: "postgres", max: 1,
      // Keep postgres.js's default type fetch: reserve() on a cold connection
      // stalls in 3.4.9 when fetch_types is false (ReadyForQuery initial path).
      prepare: false, connect_timeout: 10,
      ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.PGSSLROOTCERT, "utf8") },
      debug: false, onnotice: () => {},
    });
    });
    await diagnose("SESSION_IDENTITY", async () => {
    session = await beginPreviewReadOnlySession(client);
    db = drizzle(session.sql, { schema });
    state.db = db;
    });
  }, 30_000);

  afterAll(async () => {
    state.db = null;
    try { if (session) await endPreviewReadOnlySession(session); }
    finally { if (client) await client.end({ timeout: 2 }); }
  });

  it("homepage results use restored matches", async () => {
    await diagnose("HOMEPAGE", async () => {
    const matches = await listHomeMatches("finished", new Date());
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(6);
    expect(matches.every(m => m.regularHome !== null && m.regularAway !== null)).toBe(true);
    });
  });

  it("agent competitions and standings use existing access layer", async () => {
    await diagnose("AGENT_DATA", async () => {
    const catalog = await listCompetitions();
    expect(catalog.length).toBeGreaterThan(0);
    let rows = 0;
    for (const league of catalog.filter(c => ["PPL", "PL"].includes(c.code))) {
      rows += (await competitionTable(league.id, "TOTAL")).length;
    }
    expect(rows).toBeGreaterThan(0);
    });
  });

  it("match and team detail queries preserve restored identity", async () => {
    await diagnose("MATCH_TEAM", async () => {
    const [match] = await db.select().from(schema.matches)
      .where(eq(schema.matches.source, "football-data.org")).limit(1);
    expect(match).toBeDefined();
    expect(await getMatchBundle(match.externalId)).not.toBeNull();
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, match.homeTeamId));
    expect(await getTeamByExternalId(team.externalId)).toBeDefined();
    expect((await teamMatches(team.id)).length).toBeGreaterThan(0);
    });
  });

  it("historical predictions remain readable without recalculation", async () => {
    await diagnose("PREDICTIONS", async () => {
    expect(Array.isArray(await settledPredictions())).toBe(true);
    const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.predictions);
    expect(count.total).toBe(9);
    });
  });
});
