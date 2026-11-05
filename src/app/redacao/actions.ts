"use server";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clampConfig } from "@/server/blog-agent/policy";
import { tick } from "@/server/blog-agent/run";
import { readAgentArticles, readConfig, saveAgentArticles, saveConfig } from "@/server/blog-agent/store";
import type { AgentStatus } from "@/server/blog-agent/types";
import { lisbonToday } from "@/server/format/pt";

const COOKIE = "quadrante.redacao";

function token() {
  const secret = process.env.RECOLHA_SEGREDO?.trim();
  if (!secret) return null;
  return createHash("sha256").update(`redacao:${secret}`).digest("hex");
}

export async function redacaoOpen() {
  const expected = token();
  if (!expected) return false;
  const jar = await cookies();
  return jar.get(COOKIE)?.value === expected;
}

export async function configured() {
  return Boolean(process.env.RECOLHA_SEGREDO?.trim());
}

export async function unlock(formData: FormData) {
  const secret = process.env.RECOLHA_SEGREDO?.trim();
  const expected = token();
  const given = String(formData.get("segredo") ?? "");
  if (!secret || !expected || given !== secret) redirect("/redacao?acesso=recusado");
  const jar = await cookies();
  jar.set(COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  redirect("/redacao");
}

async function guard() {
  if (!(await redacaoOpen())) redirect("/redacao");
}

export async function saveSettings(formData: FormData) {
  await guard();
  const current = await readConfig();
  await saveConfig(
    clampConfig({
      ...current,
      paused: formData.get("paused") === "sim",
      maxPerWeek: Number(formData.get("maxPerWeek")),
      intervalHours: Number(formData.get("intervalHours")),
      autoPublish: formData.get("autoPublish") === "sim",
    }),
  );
  redirect("/redacao");
}

export async function setPaused(formData: FormData) {
  await guard();
  const current = await readConfig();
  await saveConfig({ ...current, paused: formData.get("paused") === "sim" });
  redirect("/redacao");
}

export async function runNow() {
  await guard();
  await tick("manual");
  redirect("/redacao");
}

export async function review(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("acao") ?? "");
  const articles = await readAgentArticles();
  const next = articles.map((article) => {
    if (article.id !== id) return article;
    const title = text(formData.get("title"), article.title);
    const summary = text(formData.get("summary"), article.summary);
    const seoTitle = text(formData.get("seoTitle"), article.seoTitle);
    const seoDescription = text(formData.get("seoDescription"), article.seoDescription);
    const edited = { ...article, title, summary, seoTitle, seoDescription };
    if (action === "rejeitar") return { ...edited, status: "rejeitado" as const, reason: "Rejeitado na revisão." };
    if (action === "agendar") {
      const publishOn = String(formData.get("publishOn") ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(publishOn)) return article;
      return { ...edited, status: "agendado" as const, publishOn, reason: "Agendado na revisão para a data prevista." };
    }
    if (action === "aprovar") {
      return { ...edited, status: "publicado" as const, publishOn: article.publishOn || lisbonToday(), reason: "Aprovado na revisão." };
    }
    return { ...edited, status: article.status as AgentStatus, reason: "Texto revisto na redação." };
  });
  await saveAgentArticles(next);
  redirect("/redacao");
}

function text(value: FormDataEntryValue | null, fallback: string) {
  const next = String(value ?? "").trim();
  return next || fallback;
}
