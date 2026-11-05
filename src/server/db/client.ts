import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { connectionOptions, databaseFailure } from "./connection";

type Database = PostgresJsDatabase<typeof schema>;

const globalForSql = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
  db?: Database;
};

export function databaseUrl() {
  return process.env.DATABASE_URL ?? "";
}

export function getDb() {
  if (!globalForSql.sql) {
    const { url, options } = connectionOptions(databaseUrl());
    globalForSql.sql = postgres(url, options);
  }
  if (!globalForSql.db) {
    globalForSql.db = drizzle(globalForSql.sql, { schema });
  }
  return globalForSql.db!;
}

export async function pingDatabase() {
  try {
    const db = getDb();
    await db.execute(sql`select id from sports limit 1`);
    return true;
  } catch (error) {
    // Log only allowlisted codes, including Drizzle's wrapped driver cause.
    // Never log the error object, message, SQL, URI, or credentials.
    console.error("[database] health check failed", databaseFailure(error));
    return false;
  }
}
