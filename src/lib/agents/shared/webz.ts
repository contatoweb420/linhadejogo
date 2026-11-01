import { AgentError } from "@/lib/agents/shared/errors";

export const webzEndpoints = {
  news: "https://api.webz.io/api/news",
  blogs: "https://api.webz.io/api/blogs",
  forums: "https://api.webz.io/api/forums",
  reviews: "https://api.webz.io/reviewFilter",
} as const;

export type WebzProduct = keyof typeof webzEndpoints;

const maxQuery = 300;
const maxSize = 10;

export function validateWebzQuery(input: { q?: string; size?: number }) {
  const q = input.q?.trim() ?? "";
  if (!q || q.length > maxQuery) {
    throw new AgentError("A consulta está vazia ou é demasiado longa.", "pedido-invalido");
  }
  const size = input.size ?? maxSize;
  if (!Number.isInteger(size) || size < 1 || size > maxSize) {
    throw new AgentError("O número de resultados tem de ficar entre 1 e 10.", "pedido-invalido");
  }
  return { q, size };
}

export function webzRequest(product: WebzProduct, query: { q: string; size: number }) {
  const token = process.env.WEBZ_API_TOKEN?.trim() ?? "";
  if (!token) {
    throw new AgentError("A chave Webz.io não está configurada neste servidor.", "nao-autorizado");
  }
  const url = new URL(webzEndpoints[product]);
  url.searchParams.set("q", query.q);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (product === "reviews") {
    url.searchParams.set("token", token);
  } else {
    url.searchParams.set("size", String(query.size));
    headers.Authorization = `Bearer ${token}`;
  }
  return { url, headers };
}

export async function fetchWebz(product: WebzProduct, input: { q?: string; size?: number }) {
  const query = validateWebzQuery(input);
  if (process.env.WEBZ_LIVE !== "1") {
    throw new AgentError("A ligação à Webz.io está desligada.", "sem-fonte");
  }
  const limit = Number(process.env.WEBZ_DAILY_LIMIT ?? "0");
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new AgentError("O limite diário de pedidos à Webz.io está em zero.", "limite");
  }
  const request = webzRequest(product, query);
  const response = await fetch(request.url, { headers: request.headers });
  if (!response.ok) {
    throw new AgentError("A Webz.io recusou o pedido.", "sem-dados");
  }
  return response.json() as Promise<unknown>;
}
