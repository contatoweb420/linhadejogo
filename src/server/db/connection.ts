import type postgres from "postgres";

function configurationError(code: string): never {
  // Never attach the URI or the original parsing error.
  throw Object.assign(new Error(code), { code });
}

export function connectionOptions(value: string) {
  if (!value.trim()) configurationError("DATABASE_URL_MISSING");
  let url: URL;
  try {
    url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname || !url.username || url.pathname.length < 2 || url.hash) {
      configurationError("DATABASE_URL_INVALID");
    }
    // URL accepts malformed percent escapes; the driver does not.
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
    decodeURIComponent(url.pathname);
  } catch {
    configurationError("DATABASE_URL_INVALID");
  }

  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const options = {
    max: 2,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 300,
    // Required for transaction poolers. Supabase shared transaction mode also
    // has a pipelining limitation: use its Session Pooler with this driver.
    prepare: false,
    fetch_types: false,
    ...(local ? {} : { ssl: { rejectUnauthorized: true } }),
    debug: false,
    onnotice: () => {},
  } satisfies postgres.Options<Record<string, never>>;

  return { url: url.toString(), options };
}

const transportCategories: Record<string, string> = {
  ENOTFOUND: "dns", EAI_AGAIN: "dns",
  ECONNREFUSED: "connectivity", ECONNRESET: "connectivity",
  ENETUNREACH: "connectivity", EHOSTUNREACH: "connectivity",
  CONNECTION_CLOSED: "connectivity", CONNECTION_ENDED: "connectivity",
  CONNECTION_DESTROYED: "connectivity",
  ETIMEDOUT: "timeout", CONNECT_TIMEOUT: "timeout",
  CERT_HAS_EXPIRED: "tls", CERT_NOT_YET_VALID: "tls",
  DEPTH_ZERO_SELF_SIGNED_CERT: "tls", SELF_SIGNED_CERT_IN_CHAIN: "tls",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "tls", UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "tls",
  ERR_TLS_CERT_ALTNAME_INVALID: "tls", ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION: "tls",
  DATABASE_URL_MISSING: "configuration", DATABASE_URL_INVALID: "configuration",
};

/** Drizzle wraps driver failures in `cause`. Return no messages or connection data. */
export function databaseFailure(error: unknown): { category: string; code: string } {
  let current = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === "string") {
      if (Object.hasOwn(transportCategories, code)) {
        return { category: transportCategories[code], code };
      }
      if (/^[0-9A-Z]{5}$/.test(code)) {
        const category = code.startsWith("28") ? "authentication"
          : code === "42501" ? "permissions"
          : ["42P01", "42703", "3F000"].includes(code) ? "schema"
          : ["26000", "42P05"].includes(code) ? "pooler"
          : code === "57014" ? "timeout"
          : code.startsWith("08") || code === "53300" ? "connectivity"
          : "database";
        return { category, code };
      }
    }
    current = cause;
  }
  return { category: "unknown", code: "DATABASE_CHECK_FAILED" };
}
