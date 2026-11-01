import { collectNews } from "@/server/news/collect";
import { usageToday } from "@/server/news/scrapingbee";

export async function POST(request: Request) {
  const secret = process.env.RECOLHA_SEGREDO?.trim();
  if (!secret || request.headers.get("x-recolha-segredo") !== secret) {
    return new Response(null, { status: 404 });
  }
  const result = await collectNews();
  const usage = await usageToday();
  return Response.json({ ...result, requestsToday: usage.requests, creditsToday: usage.credits });
}
