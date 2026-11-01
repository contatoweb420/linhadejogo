import { readDrafts } from "@/lib/agents/blogs/client";

const offline = "Não existem rascunhos em cache. Nenhum pedido foi enviado à Webz.io.";

export async function listDrafts() {
  const items = await readDrafts();
  return { items, requested: false, reason: items.length === 0 ? offline : null };
}
