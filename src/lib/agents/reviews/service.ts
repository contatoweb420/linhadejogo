import { readReviews } from "@/lib/agents/reviews/client";

const offline = "Não existem críticas em cache. Nenhum pedido foi enviado à Webz.io.";

export async function listReviews() {
  const items = await readReviews();
  return { items, requested: false, reason: items.length === 0 ? offline : null };
}
