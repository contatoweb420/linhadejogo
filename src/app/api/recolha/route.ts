import { lisbonToday } from "@/server/format/pt";
import { syncCompetitions, syncWindow } from "@/server/ingest/sync";

export async function POST(request: Request) {
  const secret = process.env.RECOLHA_SEGREDO?.trim();
  if (!secret || request.headers.get("x-recolha-segredo") !== secret) {
    return new Response(null, { status: 404 });
  }
  const day = lisbonToday();
  const competitions = await syncCompetitions(false);
  const window = await syncWindow(day, false);
  const ok = competitions.ok && window.ok;
  return Response.json({ ok }, { status: ok ? 200 : 502 });
}
