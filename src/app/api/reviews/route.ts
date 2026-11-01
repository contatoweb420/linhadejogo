import { listReviews } from "@/lib/agents/reviews/service";
import { AgentError } from "@/lib/agents/shared/errors";
import { unauthorized } from "@/lib/agents/shared/security";

async function respond(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;
  try {
    return Response.json(await listReviews());
  } catch (error) {
    if (error instanceof AgentError) return Response.json({ items: [], requested: false, reason: error.message }, { status: 422 });
    throw error;
  }
}

export function GET(request: Request) {
  return respond(request);
}

export function POST(request: Request) {
  return respond(request);
}
