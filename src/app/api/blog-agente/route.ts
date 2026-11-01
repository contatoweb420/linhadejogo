import { tick } from "@/server/blog-agent/run";

export async function POST(request: Request) {
  const secret = process.env.RECOLHA_SEGREDO?.trim();
  if (!secret || request.headers.get("x-recolha-segredo") !== secret) {
    return new Response(null, { status: 404 });
  }
  const result = await tick("manual");
  return Response.json(result);
}
