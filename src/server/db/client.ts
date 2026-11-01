import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

const globalForSql = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
  db?: Database;
};

export function databaseUrl() {
  return process.env.DATABASE_URL ?? "";
}

export function getDb() {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL em falta");
  }
  if (!globalForSql.sql) {
    globalForSql.sql = postgres(url, { max: 8, connect_timeout: 5 });
    globalForSql.db = drizzle(globalForSql.sql, { schema });
  }
  return globalForSql.db!;
}

export async function pingDatabase() {
  const url = databaseUrl();
  if (!url) return false;
  try {
    const db = getDb();
    await db.execute(sql`select id from sports limit 1`);
    return true;
  } catch {
    return false;
  }
}
