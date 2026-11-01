import { readNews } from "@/lib/agents/news/client";

const offline = "Não existem notícias em cache. Nenhum pedido foi enviado à Webz.io.";

export async function listNews() {
  const items = await readNews();
  return { items, requested: false, reason: items.length === 0 ? offline : null };
}
