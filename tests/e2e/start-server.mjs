import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Never reuse the developer's database, editorial files or integration keys.
const root = fileURLToPath(new URL("../../", import.meta.url));
const dataDir = await mkdtemp(path.join(tmpdir(), "linha-e2e-"));
await writeFile(path.join(dataDir, "artigos.json"), "[]");
await writeFile(path.join(dataDir, "execucoes.json"), "[]");
const child = spawn(process.execPath, [
  path.join(root, "node_modules/next/dist/bin/next"),
  "dev", "--hostname", "127.0.0.1", "--port", "3101",
], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    E2E_TEST_MODE: "1",
    BLOG_AGENT_DATA_DIR: dataDir,
    DATABASE_URL: "",
    FOOTBALL_DATA_API_KEY: "",
    FOOTBALL_DATA_TOKEN: "",
    SCRAPINGBEE_API_KEY: "",
    PEXELS_API_KEY: "",
    WEBZ_API_TOKEN: "",
    WEBZ_DAILY_LIMIT: "0",
    NEWS_RSS_SOURCES_JSON: "[]",
    RECOLHA_SEGREDO: "local-playwright-only-not-a-real-secret",
    DB_DIAGNOSTIC_SECRET: "",
    VERCEL_ENV: "development",
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3101",
    NEXT_PUBLIC_INSTAGRAM_URL: "",
    NEXT_PUBLIC_TIKTOK_URL: "",
    NEXT_TELEMETRY_DISABLED: "1",
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.once("error", async (error) => {
  console.error(error.message);
  await rm(dataDir, { recursive: true, force: true });
  process.exitCode = 1;
});
child.once("exit", async (code, signal) => {
  await rm(dataDir, { recursive: true, force: true });
  process.exitCode = signal ? 1 : (code ?? 1);
});
