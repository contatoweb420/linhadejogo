import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isAllowedSourceUrl } from "./sources";

const ENDPOINT = "https://app.scrapingbee.com/api/v1/";
const TIMEOUT_MS = 15_000;

export function scrapingBeeConfigured() {
  return Boolean(process.env.SCRAPINGBEE_API_KEY?.trim());
}

export function dailyLimit() {
  const parsed = Number(process.env.SCRAPINGBEE_DAILY_LIMIT ?? "5");
  if (!Number.isFinite(parsed) || parsed < 0) return 5;
  return Math.floor(parsed);
}

export function redactSecrets(value: string) {
  const key = process.env.SCRAPINGBEE_API_KEY?.trim();
  let text = value.replace(/api_key=[^&\s]+/gi, "api_key=oculto");
  if (key && key.length > 8) text = text.split(key).join("oculto");
  return text;
}

type Usage = { day: string; requests: number; credits: number };

function usagePath() {
  return path.join(process.cwd(), ".cache", "scrapingbee-usage.json");
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}

async function readUsage(): Promise<Usage> {
  try {
    const parsed = JSON.parse(await readFile(usagePath(), "utf8")) as Partial<Usage>;
    if (parsed.day !== todayKey()) return { day: todayKey(), requests: 0, credits: 0 };
    return {
      day: todayKey(),
      requests: Number(parsed.requests) || 0,
      credits: Number(parsed.credits) || 0,
    };
  } catch {
    return { day: todayKey(), requests: 0, credits: 0 };
  }
}

export async function usageToday() {
  return readUsage();
}

export async function fetchAllowedPage(url: string): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  if (!isAllowedSourceUrl(url)) return { ok: false, reason: "Este endereço não está na lista de fontes autorizadas." };
  const key = process.env.SCRAPINGBEE_API_KEY?.trim();
  if (!key) return { ok: false, reason: "A recolha externa não está configurada." };
  const usage = await readUsage();
  if (usage.requests >= dailyLimit()) return { ok: false, reason: "O limite diário de recolha foi atingido." };

  const endpoint = new URL(ENDPOINT);
  endpoint.searchParams.set("api_key", key);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("render_js", "false");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return { ok: false, reason: "A recolha externa falhou." };
    const cost = Number(response.headers.get("spb-cost") ?? "1");
    await writeUsage({
      day: todayKey(),
      requests: usage.requests + 1,
      credits: usage.credits + (Number.isFinite(cost) && cost > 0 ? cost : 1),
    });
    return { ok: true, text: (await response.text()).slice(0, 20_000) };
  } catch {
    return { ok: false, reason: "A recolha externa falhou." };
  } finally {
    clearTimeout(timer);
  }
}

async function writeUsage(usage: Usage) {
  const file = usagePath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(usage), "utf8");
}
