import type postgres from "postgres";

type Identity = { database: string; username: string; session_username: string;
  read_only: string; backend_pid: number };

function requireIdentity(identity: Identity | undefined, expectedPid?: number) {
  const checks = [
    [identity?.database === "postgres", "DATABASE_MISMATCH"],
    [identity?.username === "postgres", "CURRENT_USER_MISMATCH"],
    [identity?.session_username === "postgres", "SESSION_USER_MISMATCH"],
    [identity?.read_only === "on", "READ_ONLY_OFF"],
    [Number.isInteger(identity?.backend_pid) &&
      (expectedPid === undefined || identity?.backend_pid === expectedPid), "SESSION_CHANGED"],
  ] as const;
  for (const [ok, code] of checks) {
    if (!ok) throw Object.assign(new Error(code), { code });
  }
}

async function identity(sql: postgres.ReservedSql) {
  const [row] = await sql<Identity[]>`SELECT
    pg_catalog.current_database() AS database,
    current_user AS username, session_user AS session_username,
    pg_catalog.current_setting('transaction_read_only') AS read_only,
    pg_catalog.pg_backend_pid() AS backend_pid`;
  return row;
}

export type PreviewReadOnlySession = {
  sql: postgres.ReservedSql;
  backendPid: number;
};

// The caller validates the exact Preview host/login/TLS before constructing the
// client. Reserve pins all Drizzle queries and checks to one physical connection.
export async function beginPreviewReadOnlySession(
  client: Pick<postgres.Sql, "reserve" | "options">,
): Promise<PreviewReadOnlySession> {
  const sql = await client.reserve();
  try {
    // postgres.js 3.4.9 reserve() omits options at runtime despite ReservedSql
    // extending Sql in its types. Drizzle 0.45.4 needs the original parser and
    // serializer maps. Keep the reserved executor (and its physical connection).
    Object.assign(sql, { options: client.options });
    await sql`BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
    await sql`SET LOCAL statement_timeout = '15s'`;
    const row = await identity(sql);
    requireIdentity(row);
    return { sql, backendPid: row.backend_pid };
  } catch (error) {
    try { await sql`ROLLBACK`; }
    catch { /* Preserve the original validation error if the connection closed. */ }
    finally { sql.release(); }
    throw error;
  }
}

export async function verifyPreviewReadOnlySession(session: PreviewReadOnlySession) {
  requireIdentity(await identity(session.sql), session.backendPid);
}

export async function endPreviewReadOnlySession(session: PreviewReadOnlySession) {
  try { await session.sql`ROLLBACK`; } finally { session.sql.release(); }
}
