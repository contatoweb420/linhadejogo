import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("backups", { recursive: true });
const target = `backups/quadrante-${stamp}.sql`;
const dump = execFileSync(
  "docker",
  ["compose", "exec", "-T", "postgres", "pg_dump", "-U", "quadrante", "--no-owner", "quadrante"],
  { encoding: "utf8" },
);
await import("node:fs").then((fs) => fs.writeFileSync(target, dump));
console.log(`Cópia guardada em ${target}`);
