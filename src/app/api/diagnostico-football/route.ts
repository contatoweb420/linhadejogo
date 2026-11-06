import { createHash, timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { fetchCompetitions, ProviderError } from "@/server/providers/football-data";

export const runtime = "nodejs";
export const maxDuration = 15;

function respond(httpStatus: number, responseValid: boolean | null = null, competitionCount: number | null = null) {
  return Response.json({
    success: httpStatus === 200,
    httpStatus,
    responseValid,
    competitionCount,
  }, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store", "Vary": "Authorization" },
  });
}

export async function POST(request: Request) {
  // Fail closed before reading credentials or contacting the provider.
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "preview/linhadejogo-2026-11-05") {
    return respond(404);
  }

  // Dedicated credential, independent of the provider key and database secrets.
  const secret = process.env.FOOTBALL_DATA_DIAGNOSTIC_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) return respond(503);
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256").update(request.headers.get("authorization") ?? "").digest();
  if (!timingSafeEqual(expected, received)) return respond(401);

  try {
    const competitions = await fetchCompetitions();
    return respond(200, true, competitions.length);
  } catch (error) {
    // Never return or log messages, response bodies, validation issues or headers.
    if (error instanceof ProviderError) {
      const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
        ? error.status : 503;
      return respond(status);
    }
    return respond(502, error instanceof ZodError || error instanceof SyntaxError ? false : null);
  }
}
