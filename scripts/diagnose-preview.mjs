#!/usr/bin/env node
/**
 * Read-only, fail-closed Preview audit. No deployment, synchronization, secret
 * rotation, credential prompts, dependency installation or automatic retries.
 * Run explicitly from the authenticated NUC terminal; never run via env run.
 * Existing secrets are read only into memory. Nothing is printed from CLI/API
 * responses except allowlisted metadata and aggregates.
 */
import { execFile } from "node:child_process";
import { createHash, randomUUID, X509Certificate } from "node:crypto";
import { readFile, stat, writeFile, access } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSecureContext } from "node:tls";
import { fileURLToPath } from "node:url";
import { parseEnv, promisify } from "node:util";

const runFile = promisify(execFile);
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BRANCH = "preview/linhadejogo-2026-11-05";
const PROJECT = "linhadejogo";
const TEAM = "pablo-9d33";
const REF = "eoroljcefsurgsxegfzp";
const HOST = "aws-0-eu-west-1.pooler.supabase.com";
// Pin the source version reviewed for read-only page behavior. A different
// deployed revision requires a fresh source review, not relaxed checks.
const AUDITED_COMMIT = "0a214fe56041ab838a42c2ca57f398c06a304268";
const SQL_PATH = "/home/pablo/linha-preview-build-m8xcybul/preview-readonly-audit.sql";
const SQL_SHA256 = "28176e74a4341483c8365b59740a6c4a5462db3eec0e2116c233427aac2556cf";
const CA_PATH = "/home/pablo/Downloads/prod-ca-2021-novo.crt";
const REQUIRED = ["DATABASE_URL", "SUPABASE_DB_CA_PEM", "FOOTBALL_DATA_API_KEY", "FOOTBALL_DATA_DIAGNOSTIC_SECRET"];
const PUBLIC_PAGES = ["/pt-pt/sobre", "/pt-pt/privacidade", "/pt-pt/condicoes"];
const DATABASE_PAGES = ["/pt-pt", "/pt-pt/pesquisa?q=a", "/pt-pt/pesquisa?q=Benfica", "/pt-pt/avaliacao?competicao=PPL"];
const PAGE_MARKERS = {
  "/pt-pt/sobre": /<h1\b[^>]*>\s*Sobre a Linha de Jogo\s*<\/h1>/u,
  "/pt-pt/privacidade": /<h1\b[^>]*>\s*Privacidade\s*<\/h1>/u,
  "/pt-pt/condicoes": /<h1\b[^>]*>\s*Condições de utilização\s*<\/h1>/u,
  "/pt-pt": /CENTRO DE JOGO/u,
  "/pt-pt/pesquisa?q=a": /<h1\b[^>]*>\s*Pesquisa\s*<\/h1>/u,
  "/pt-pt/pesquisa?q=Benfica": /<h1\b[^>]*>\s*Pesquisa\s*<\/h1>/u,
  "/pt-pt/avaliacao?competicao=PPL": /<h1\b[^>]*>\s*Estatísticas\s*<\/h1>/u,
};

class AuditFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
function requireSafe(condition, code) {
  if (!condition) throw new AuditFailure(code);
}
function failureCode(error) {
  if (error instanceof AuditFailure) return error.code;
  const code = error?.code;
  return typeof code === "string" && /^(?:[0-9A-Z]{5}|E[A-Z_]+|CONNECT_TIMEOUT)$/.test(code)
    ? code : "UNCLASSIFIED_FAILURE";
}
function childEnvironment() {
  // No application DATABASE_URL/provider keys are inherited by CLI/Git children.
  const allowed = ["PATH", "HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "LANG", "LC_ALL", "TMPDIR",
    "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy",
    "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "VERCEL_TOKEN"];
  return Object.fromEntries(allowed.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
}
async function command(program, args) {
  try {
    return (await runFile(program, args, {
      cwd: ROOT, env: childEnvironment(), encoding: "utf8", timeout: 45_000, maxBuffer: 8 * 1024 * 1024,
    })).stdout;
  } catch (error) {
    // Never forward stdout/stderr/error.message: they can contain credentials.
    let code = "CLI_COMMAND_FAILED";
    try {
      const payload = JSON.parse(error.stdout);
      if (["network_error", "unexpected_error", "not_authenticated", "unauthorized"].includes(payload.reason)) {
        code = `CLI_${payload.reason.toUpperCase()}`;
      }
    } catch { /* Keep the safe generic code. */ }
    throw new AuditFailure(code);
  }
}
async function vercelCommand() {
  // Use only an existing installation. Never invoke npx and install implicitly.
  const installed = path.join(process.env.HOME ?? "/home/pablo", ".npm/_npx/69f9afb961c37556/node_modules/vercel/dist/vc.js");
  try { await access(installed); return [process.execPath, installed]; }
  catch { return ["vercel"]; }
}
async function api(cli, endpoint, query = {}) {
  requireSafe(/^\/v(?:2\/teams|9\/projects\/|7\/deployments|13\/deployments\/|10\/projects\/)/.test(endpoint), "API_PATH_NOT_ALLOWLISTED");
  requireSafe(query.decrypt !== "true", "REMOTE_SECRET_DOWNLOAD_FORBIDDEN");
  const suffix = new URLSearchParams(query).toString();
  const output = await command(cli[0], [...cli.slice(1), "api", endpoint + (suffix ? `?${suffix}` : ""),
    "--method", "GET", "--scope", TEAM, "--raw"]);
  try {
    const data = JSON.parse(output);
    requireSafe(data && !data.error && data.status !== "error", "VERCEL_API_REJECTED_REQUEST");
    return data;
  } catch (error) {
    if (error instanceof AuditFailure) throw error;
    throw new AuditFailure("VERCEL_JSON_NOT_RECOGNIZED");
  }
}
function previewDatabase(value) {
  try {
    const u = new URL(value);
    if (!["postgres:", "postgresql:"].includes(u.protocol) || u.hostname !== HOST || u.port !== "5432" ||
        u.pathname !== "/postgres" || decodeURIComponent(u.username) !== `postgres.${REF}` || !u.password || u.hash) return null;
    // Do not pass URI options to the driver; avoid host/options/TLS overrides.
    for (const [key, val] of u.searchParams) {
      if (key !== "sslmode" || !["require", "verify-ca", "verify-full"].includes(val)) return null;
    }
    return { password: decodeURIComponent(u.password) };
  } catch { return null; }
}
async function existingLocalSecrets() {
  const sources = [{ label: "process_environment", values: process.env }];
  // Explicitly parse known files; never source shell text or start Next.js.
  for (const name of [".env.preview.local", ".vercel/.env.preview.local", ".env.local"]) {
    try {
      const file = path.join(ROOT, name);
      const metadata = await stat(file);
      if (metadata.uid !== process.getuid() || (metadata.mode & 0o022)) continue;
      sources.push({ label: name, values: parseEnv(await readFile(file, "utf8")) });
    } catch { /* Missing/unusable file is not a reason to solicit a credential. */ }
  }
  return sources;
}
function uniqueSecret(sources, name, accepts) {
  const candidates = sources.map(source => source.values[name]).filter(value => typeof value === "string" && accepts(value));
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : null;
}
function asTime(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
    const date = Date.parse(value);
    if (Number.isFinite(date)) return date;
  }
  return null;
}
async function preflight(report, cli, suppliedDeployment) {
  const branch = (await command("git", ["branch", "--show-current"])).trim();
  requireSafe(branch === BRANCH, "LOCAL_BRANCH_MISMATCH");
  const remote = (await command("git", ["remote", "get-url", "origin"])).trim();
  requireSafe(["https://github.com/contatoweb420/linhadejogo.git", "git@github.com:contatoweb420/linhadejogo.git"].includes(remote), "LOCAL_REPOSITORY_MISMATCH");
  const sha = (await command("git", ["rev-parse", "HEAD"])).trim();
  requireSafe(sha === AUDITED_COMMIT, "LOCAL_SOURCE_REVISION_REQUIRES_REVIEW");
  const state = await command("git", ["status", "--porcelain=v1", "-z"]);
  report.git = { branch, commit: sha, workingTreeClean: state.length === 0, localChangesAreNotDeploymentEvidence: true };

  const teams = await api(cli, "/v2/teams", { limit: "100" });
  const matches = teams.teams?.filter(team => team.slug === TEAM) ?? [];
  requireSafe(matches.length === 1 && typeof matches[0].id === "string", "TEAM_NOT_UNAMBIGUOUS");
  const teamId = matches[0].id;
  const project = await api(cli, `/v9/projects/${PROJECT}`, { teamId });
  requireSafe(project.name === PROJECT && project.accountId === teamId && /^prj_[A-Za-z0-9]+$/.test(project.id), "PROJECT_OWNER_MISMATCH");
  requireSafe(project.link?.org === "contatoweb420" && project.link?.repo === PROJECT, "VERCEL_GIT_REPOSITORY_MISMATCH");
  requireSafe(project.link.productionBranch && project.link.productionBranch !== BRANCH, "PRODUCTION_BRANCH_NOT_CONFIRMED_SEPARATE");
  requireSafe(project.autoExposeSystemEnvs === true, "SYSTEM_ENVIRONMENT_VARIABLES_NOT_CONFIRMED");
  report.project = { name: PROJECT, team: TEAM, repositoryConfirmed: true, systemVariablesEnabled: true };

  let id = suppliedDeployment;
  if (!id) {
    const list = await api(cli, "/v7/deployments", { teamId, projectId: project.id, target: "preview", branch: BRANCH, sha, state: "READY", limit: "20" });
    requireSafe(Array.isArray(list.deployments) && list.deployments.length > 0, "NO_MATCHING_READY_PREVIEW_DEPLOYMENT");
    id = list.deployments[0].uid ?? list.deployments[0].id;
  }
  requireSafe(typeof id === "string", "DEPLOYMENT_ID_MISSING");
  if (id.startsWith("https://")) id = new URL(id).hostname;
  requireSafe(/^(?:dpl_[A-Za-z0-9]+|[a-z0-9-]+\.vercel\.app)$/.test(id), "DEPLOYMENT_ARGUMENT_REJECTED");
  const deployment = await api(cli, `/v13/deployments/${id}`, { teamId, withGitRepoInfo: "true" });
  requireSafe(deployment.projectId === project.id && deployment.name === PROJECT, "DEPLOYMENT_PROJECT_MISMATCH");
  requireSafe((deployment.ownerId ?? deployment.teamId) === teamId, "DEPLOYMENT_TEAM_NOT_CONFIRMED");
  // Vercel documents target:null as Preview; missing target is not accepted.
  requireSafe(Object.hasOwn(deployment, "target") && [null, "preview"].includes(deployment.target), "DEPLOYMENT_IS_NOT_PREVIEW");
  requireSafe(!deployment.customEnvironmentId && !deployment.customEnvironment, "CUSTOM_ENVIRONMENT_NOT_ALLOWED");
  requireSafe(deployment.readyState === "READY", "DEPLOYMENT_NOT_READY");
  const refs = [deployment.meta?.githubCommitRef, deployment.gitSource?.ref].filter(Boolean);
  requireSafe(refs.length > 0 && refs.every(ref => ref === BRANCH), "DEPLOYMENT_BRANCH_NOT_CONFIRMED");
  const commits = [deployment.meta?.githubCommitSha, deployment.gitSource?.sha].filter(Boolean);
  requireSafe(commits.length > 0 && commits.every(commit => commit === sha), "DEPLOYMENT_COMMIT_MISMATCH");
  requireSafe(typeof deployment.url === "string" && /^[a-z0-9-]+\.vercel\.app$/.test(deployment.url), "CANONICAL_DEPLOYMENT_URL_REJECTED");
  const base = `https://${deployment.url}`;
  report.deployment = { id: deployment.id, url: base, environment: "preview", branch: BRANCH, commit: sha, state: "READY" };

  const payload = await api(cli, `/v10/projects/${project.id}/env`, { teamId, gitBranch: BRANCH, decrypt: "false" });
  const envs = Array.isArray(payload) ? payload : payload.envs;
  requireSafe(Array.isArray(envs), "ENVIRONMENT_METADATA_NOT_RECOGNIZED");
  const created = asTime(deployment.createdAt ?? deployment.created);
  requireSafe(created !== null, "DEPLOYMENT_TIMESTAMP_MISSING");
  const selected = {};
  report.variables = [];
  for (const key of REQUIRED) {
    const entries = envs.filter(entry => entry.key === key && entry.gitBranch === BRANCH);
    requireSafe(entries.length === 1, "REQUIRED_BRANCH_VARIABLE_MISSING_OR_DUPLICATED");
    const entry = entries[0];
    const targets = Array.isArray(entry.target) ? entry.target : [entry.target];
    requireSafe(targets.length === 1 && targets[0] === "preview" && !entry.customEnvironmentIds?.length, "VARIABLE_SCOPE_NOT_EXCLUSIVELY_PREVIEW");
    const updated = asTime(entry.updatedAt ?? entry.createdAt);
    requireSafe(updated !== null && updated <= created, "DEPLOYMENT_PREDATES_VARIABLE_CONFIGURATION");
    selected[key] = entry;
    report.variables.push({ name: key, environment: "preview", branch: BRANCH, configuredBeforeDeployment: true });
  }
  // No request for decrypted secrets. Check only an already-readable Config
  // value, if provided by the metadata API; otherwise do not claim runtime DB
  // isolation and do not load any page that opens a DB connection.
  const databaseEntry = selected.DATABASE_URL;
  const readableConfig = databaseEntry.type === "plain" && databaseEntry.visibility !== "secret";
  const runtimeValue = deployment.env && !Array.isArray(deployment.env) ? deployment.env.DATABASE_URL : null;
  const runtimeDbTargetConfirmed = readableConfig && !!previewDatabase(databaseEntry.value) && !!previewDatabase(runtimeValue);
  report.applicationDatabaseTarget = runtimeDbTargetConfirmed ? "PREVIEW_TARGET_CONFIRMED" : "NOT_PROVABLE_FROM_DEPLOYMENT_METADATA";
  return { base, runtimeDbTargetConfirmed };
}

function sanitizedRows(rows) {
  const names = new Set(["competitions", "seasons", "teams", "matches", "standings", "predictions", "evaluation_runs"]);
  const sources = new Set(["football-data.org", "openfootball"]);
  const statuses = new Set(["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED", "FINISHED", "POSTPONED", "SUSPENDED", "CANCELED", "AWARDED"]);
  const codes = new Set(["PPL", "PL", "CL", "PD", "SA", "BL1", "FL1", "DED", "ELC", "BSA", "WC", "EC"]);
  const numbers = new Set(["total", "future", "usable_results", "rows", "eligible_for_accuracy"]);
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (numbers.has(key)) return [key, /^\d+$/.test(String(value)) ? String(value) : null];
    if (["oldest", "newest", "last_fetch", "fetched_at"].includes(key)) {
      const time = value == null ? null : asTime(value instanceof Date ? value.toISOString() : value);
      return [key, time === null ? null : new Date(time).toISOString()];
    }
    if (key === "ok") return [key, value === true];
    const allowed = key === "relation" ? names : key === "source" ? sources : key === "status" ? statuses : key === "code" ? codes
      : key === "table_type" ? new Set(["TOTAL", "HOME", "AWAY"]) : key === "model_version" ? new Set(["quadrante-poisson-v1"]) : null;
    if (allowed) return [key, allowed.has(value) ? value : "[other]"];
    if (key === "key") return [key, /^(competitions|window:\d{4}-\d{2}-\d{2}|(?:season|standings):(?:PPL|PL|CL|PD|SA|BL1|FL1|DED|ELC|BSA|WC|EC)|(?:team|match|h2h):\d+)$/.test(value) ? value : "[other]"];
    return [key, null];
  })));
}
async function databaseAudit(report, sources, sqlText) {
  const url = uniqueSecret(sources, "DATABASE_URL", value => !!previewDatabase(value));
  if (!url) {
    report.supabase = { state: "BLOCKED", code: "UNIQUE_LOCAL_PREVIEW_DATABASE_CREDENTIAL_UNAVAILABLE", queriesExecuted: false };
    return;
  }
  let client;
  let auditSqlSubmitted = false;
  let readOnlyVerified = false;
  try {
    const ca = await readFile(CA_PATH, "utf8");
    requireSafe(/^-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\s]+-----END CERTIFICATE-----$/.test(ca.trim()), "LOCAL_CA_FORMAT_INVALID");
    const certificate = new X509Certificate(ca);
    requireSafe(certificate.ca && Date.now() >= Date.parse(certificate.validFrom) && Date.now() <= Date.parse(certificate.validTo), "LOCAL_CA_NOT_VALID");
    createSecureContext({ ca });
    const { default: postgres } = await import("postgres");
    const credential = previewDatabase(url);
    // Fixed endpoint and startup read-only mode. Never pass URI query options,
    // application modules, or any sync/import functions to the driver.
    client = postgres({ host: HOST, port: 5432, user: `postgres.${REF}`, password: credential.password, database: "postgres",
      ssl: { ca, rejectUnauthorized: true }, max: 1, prepare: false, fetch_types: false, connect_timeout: 8, idle_timeout: 5,
      debug: false, onnotice: () => {}, connection: { application_name: "linha_preview_readonly_audit",
        default_transaction_read_only: "on", statement_timeout: "10000", lock_timeout: "3000" } });
    const mode = await client.unsafe("SHOW transaction_read_only");
    requireSafe(mode[0]?.transaction_read_only === "on", "READ_ONLY_SESSION_NOT_CONFIRMED");
    readOnlyVerified = true;
    auditSqlSubmitted = true;
    const results = await client.unsafe(sqlText).simple();
    const tables = results.filter(result => Array.isArray(result) && result.columns?.length);
    requireSafe(tables.length === 5, "AUDIT_RESULT_STRUCTURE_NOT_RECOGNIZED");
    report.supabase = { state: "PASS", projectRef: REF, verifiedTls: true, rejectUnauthorized: true, readOnly: true, auditSqlSubmitted,
      tableCounts: sanitizedRows(tables[0]), matchGroups: sanitizedRows(tables[1]), standings: sanitizedRows(tables[2]),
      predictions: sanitizedRows(tables[3]), synchronization: sanitizedRows(tables[4]) };
  } catch (error) {
    report.supabase = { state: "FAIL", projectRef: REF, auditSqlSubmitted, readOnlyVerified, code: failureCode(error) };
  } finally {
    if (client) await client.end({ timeout: 2 }).catch(() => {});
  }
}
function protectionHeaders(sources) {
  const oidc = uniqueSecret(sources, "VERCEL_OIDC_TOKEN", value => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value));
  if (oidc) return { "x-vercel-trusted-oidc-idp-token": oidc };
  const bypass = uniqueSecret(sources, "VERCEL_AUTOMATION_BYPASS_SECRET", value => value.length >= 16 && !/[\r\n]/.test(value));
  return bypass ? { "x-vercel-protection-bypass": bypass } : {};
}
function httpRequest(base, requestPath, method, headers) {
  requireSafe(PUBLIC_PAGES.includes(requestPath) || DATABASE_PAGES.includes(requestPath) ||
    (requestPath === "/api/diagnostico-football" && method === "POST"), "HTTP_PATH_NOT_ALLOWLISTED");
  requireSafe(method === "GET" || requestPath === "/api/diagnostico-football", "HTTP_METHOD_REJECTED");
  return new Promise((resolve, reject) => {
    // Native HTTPS: no redirect following, retry, prefetch, resource loading,
    // protection-token generation, cookie persistence or browser navigation.
    const req = https.request(new URL(requestPath, base), { method,
      headers: { Accept: method === "POST" ? "application/json" : "text/html", "Accept-Encoding": "identity", ...headers },
      rejectUnauthorized: true, signal: AbortSignal.timeout(20_000) }, response => {
      const chunks = [];
      let length = 0;
      response.on("data", chunk => {
        length += chunk.length;
        if (length > 8 * 1024 * 1024) req.destroy(new AuditFailure("HTTP_RESPONSE_TOO_LARGE"));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      response.on("error", reject);
    });
    req.setTimeout(20_000, () => req.destroy(new AuditFailure("HTTP_TIMEOUT")));
    req.on("error", reject);
    req.end();
  });
}
async function footballAudit(report, sources, base, protection) {
  const secret = uniqueSecret(sources, "FOOTBALL_DATA_DIAGNOSTIC_SECRET", value => /^[a-f0-9]{64}$/i.test(value));
  if (!secret) {
    report.football = { state: "BLOCKED", code: "UNIQUE_LOCAL_DIAGNOSTIC_SECRET_UNAVAILABLE", requests: 0 };
    return;
  }
  report.football = { state: "FAIL", requests: 1 };
  try {
    // Exactly one POST. This script never transmits the provider API key.
    const response = await httpRequest(base, "/api/diagnostico-football", "POST", { ...protection, Authorization: `Bearer ${secret}` });
    let body;
    try { body = JSON.parse(response.body); } catch { /* Do not print HTML, errors, or unexpected bodies. */ }
    const expectedKeys = ["competitionCount", "httpStatus", "responseValid", "success"];
    const shape = body && typeof body === "object" && JSON.stringify(Object.keys(body).sort()) === JSON.stringify(expectedKeys);
    const validCount = shape && Number.isSafeInteger(body.competitionCount) && body.competitionCount >= 0;
    const ok = response.status === 200 && shape && body.success === true && body.httpStatus === 200 && body.responseValid === true && validCount;
    report.football = { state: ok ? "PASS" : "FAIL", requests: 1, httpStatus: response.status,
      diagnosticResponseRecognized: !!shape, responseValid: shape && typeof body.responseValid === "boolean" ? body.responseValid : null,
      competitionCount: validCount ? body.competitionCount : null,
      note: "httpStatus is the diagnostic HTTP status, not separately captured upstream headers" };
  } catch (error) { report.football.code = failureCode(error); }
}
async function pageAudit(report, base, protection, runtimeDbTargetConfirmed) {
  report.pages = [];
  for (const requestPath of [...PUBLIC_PAGES, ...DATABASE_PAGES]) {
    if (DATABASE_PAGES.includes(requestPath) && !runtimeDbTargetConfirmed) {
      report.pages.push({ path: requestPath, state: "BLOCKED", code: "APPLICATION_DATABASE_TARGET_NOT_PROVABLE" });
      continue;
    }
    try {
      const response = await httpRequest(base, requestPath, "GET", protection);
      const hasPage = /<html[\s>]/i.test(response.body) && PAGE_MARKERS[requestPath].test(response.body);
      const databaseUnavailable = response.body.includes("Base de dados em falta");
      const pingMarker = requestPath !== "/pt-pt/pesquisa?q=a" || response.body.includes("Escreve pelo menos duas letras.");
      report.pages.push({ path: requestPath, state: response.status === 200 && hasPage && !databaseUnavailable && pingMarker ? "PASS" : "FAIL",
        httpStatus: response.status, expectedPageRendered: hasPage, databaseUnavailable, databasePingConfirmed: requestPath === "/pt-pt/pesquisa?q=a" ? pingMarker : null });
    } catch (error) { report.pages.push({ path: requestPath, state: "FAIL", code: failureCode(error) }); }
  }
  report.pageTestLimitations = { mode: "HTTP_ONLY_NO_JAVASCRIPT", consoleAndInteractiveNavigationTested: false,
    redirectsFollowed: false, synchronizationRoutesRequested: false,
    excludedRoutes: ["/competicoes", "/competicoes/[code]", "/jogos", "/jogos/[id]", "/equipas/[id]", "/api/recolha"] };
}
async function main() {
  const report = { startedAt: new Date().toISOString(), scope: { project: PROJECT, team: TEAM, branch: BRANCH, supabasePreview: REF },
    constraints: { variableChanges: false, deployments: false, gitWrites: false, databaseWrites: false, realSynchronization: false } };
  try {
    const args = process.argv.slice(2);
    requireSafe(args.length === 0 || (args.length === 2 && args[0] === "--deployment"), "USAGE_NODE_SCRIPT_OPTIONAL_DEPLOYMENT_ID_OR_URL");
    const sqlText = await readFile(SQL_PATH, "utf8");
    requireSafe(createHash("sha256").update(sqlText).digest("hex") === SQL_SHA256, "PREPARED_SQL_CHANGED_REQUIRES_REVIEW");
    report.sql = { reviewedHashMatches: true, readOnlyTransaction: true, executed: false };
    const cli = await vercelCommand();
    const { base, runtimeDbTargetConfirmed } = await preflight(report, cli, args[1]);
    const sources = await existingLocalSecrets();
    await databaseAudit(report, sources, sqlText);
    report.sql.executed = report.supabase.auditSqlSubmitted === true;
    report.sql.completed = report.supabase.state === "PASS";
    const protection = protectionHeaders(sources);
    report.deploymentProtection = { existingCredentialAvailable: Object.keys(protection).length > 0, createdOrChanged: false };
    await footballAudit(report, sources, base, protection);
    await pageAudit(report, base, protection, runtimeDbTargetConfirmed);
    const checks = [report.supabase.state, report.football.state, ...report.pages.map(page => page.state)];
    report.overall = checks.includes("FAIL") ? "FAIL" : checks.includes("BLOCKED") ? "INCOMPLETE" : "PASS_SAFE_CHECKS";
  } catch (error) {
    report.overall = "BLOCKED";
    report.blockingCode = failureCode(error);
  }
  report.finishedAt = new Date().toISOString();
  const output = JSON.stringify(report, null, 2);
  // New private report only; never overwrite or remove existing files/caches.
  const reportPath = path.join(tmpdir(), `linha-preview-report-${randomUUID()}.json`);
  try {
    await writeFile(reportPath, output + "\n", { mode: 0o600, flag: "wx" });
    process.stdout.write(output + `\nReport: ${reportPath}\n`);
  } catch { process.stdout.write(output + "\nReport file could not be created; sanitized report shown above.\n"); }
  process.exitCode = report.overall === "PASS_SAFE_CHECKS" ? 0 : report.overall === "FAIL" ? 1 : 2;
}

// Merely importing/reviewing this file must never start an audit.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
