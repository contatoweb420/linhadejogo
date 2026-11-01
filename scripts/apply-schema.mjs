import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL em falta. Copia .env.example para .env.local.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const migrations = ["../drizzle/0001_init.sql", "../drizzle/0002_agent_cache.sql"];

function publicError(error) {
  const message = error instanceof Error ? error.message : "A migração falhou.";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://…");
}

try {
  for (const file of migrations) {
    const migration = readFileSync(new URL(file, import.meta.url), "utf8");
    await sql.unsafe(migration);
  }
  console.log("Esquema aplicado.");
} catch (error) {
  console.error(publicError(error));
  process.exitCode = 1;
} finally {
  await sql.end();
}
