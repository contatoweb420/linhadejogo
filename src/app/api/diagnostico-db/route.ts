import { createHash, timingSafeEqual } from "node:crypto";
import postgres from "postgres";

export const runtime = "nodejs";
export const maxDuration = 15;

type Result = {
  connected: boolean;
  errorCode: string | null;
  hostname: string | null;
  port: number | null;
};

function respond(result: Result, status = 200) {
  return Response.json(result, {
    status,
    headers: { "Cache-Control": "no-store", "Vary": "Authorization" },
  });
}

function safeErrorCode(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error
    ? error.code
    : undefined;
  // Return SQLSTATE or known transport codes, never messages or connection details.
  if (typeof code === "string" && (/^[0-9A-Z]{5}$/.test(code) || [
    "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT",
    "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED",
    "CONNECTION_DESTROYED", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "ERR_TLS_CERT_ALTNAME_INVALID", "DIAGNOSTIC_TIMEOUT",
  ].includes(code))) return code;
  return "CONNECTION_FAILED";
}

export async function POST(request: Request) {
  const empty = { connected: false, hostname: null, port: null };
  // Read secrets and database credentials only in Vercel Production.
  if (process.env.VERCEL_ENV !== "production") {
    return respond({ ...empty, errorCode: "PRODUCTION_REQUIRED" }, 503);
  }
  const secret = process.env.DB_DIAGNOSTIC_SECRET;
  // Require a 32-byte random secret encoded as 64 hexadecimal characters.
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
    return respond({ ...empty, errorCode: "UNAVAILABLE" }, 503);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256").update(authorization).digest();
  if (!timingSafeEqual(expected, received)) {
    return respond({ ...empty, errorCode: "UNAUTHORIZED" }, 401);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return respond({ ...empty, errorCode: "DATABASE_URL_MISSING" }, 503);
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname || !url.username || url.pathname.length < 2) {
      return respond({ ...empty, errorCode: "DATABASE_URL_INVALID" }, 503);
    }
  } catch {
    return respond({ ...empty, errorCode: "DATABASE_URL_INVALID" }, 503);
  }

  const endpoint = { hostname: url.hostname, port: Number(url.port || 5432) };
  // Ignore URI driver overrides: enforce TLS and prevent session probes or logging.
  url.search = "";
  url.hash = "";
  let client: ReturnType<typeof postgres> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // This client is local to this request; never import or close the shared client.
    client = postgres(url.toString(), {
      max: 1,
      prepare: false,
      fetch_types: false,
      connect_timeout: 5,
      idle_timeout: 5,
      ssl: { rejectUnauthorized: true },
      debug: false,
      onnotice: () => {},
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(Object.assign(new Error(), { code: "DIAGNOSTIC_TIMEOUT" }));
      }, 8_000);
    });
    await Promise.race([client`SELECT 1`, timeout]);
    return respond({ connected: true, errorCode: null, ...endpoint });
  } catch (error) {
    return respond({ connected: false, errorCode: safeErrorCode(error), ...endpoint });
  } finally {
    if (timer) clearTimeout(timer);
    // Bound cleanup, including when the query times out; never expose cleanup errors.
    if (client) await client.end({ timeout: 1 }).catch(() => {});
  }
}
