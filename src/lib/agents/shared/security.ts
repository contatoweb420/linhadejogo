import { agentSecret } from "@/lib/agents/shared/config";

export function unauthorized(request: Request) {
  const secret = agentSecret();
  if (!secret) {
    return Response.json({ error: "nao-configurado" }, { status: 401 });
  }
  if (request.headers.get("x-recolha-segredo") !== secret) {
    return Response.json({ error: "nao-autorizado" }, { status: 401 });
  }
  return null;
}
