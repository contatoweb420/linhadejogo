import { readThreads } from "@/lib/agents/forums/client";

const offline = "Não existem discussões em cache. Nenhum pedido foi enviado à Webz.io.";

export async function listThreads() {
  const items = await readThreads();
  return { items, requested: false, reason: items.length === 0 ? offline : null };
}
