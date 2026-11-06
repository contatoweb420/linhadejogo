import { X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";
import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { connectionOptions, databaseFailure } from "./connection";

// Public Node trust-store certificate used only as a valid PEM test fixture.
const ca = rootCertificates.find(pem => {
  const certificate = new X509Certificate(pem);
  return certificate.ca && Date.parse(certificate.validFrom) <= Date.now() &&
    Date.parse(certificate.validTo) > Date.now();
})!;

describe("database connection configuration", () => {
  it.each(["", "   "])("identifies missing configuration", value => {
    expect(() => connectionOptions(value)).toThrow("DATABASE_URL_MISSING");
  });

  it.each([
    "not a URI", "https://user:secret@example.test/db",
    "postgres://example.test/db", "postgres://user:secret@example.test/",
    "postgres://user:bad%escape@example.test/db", "postgres://user:secret@example.test/db#fragment",
  ])("rejects invalid configuration without echoing its contents", value => {
    try {
      connectionOptions(value);
      expect.fail("Expected validation failure");
    } catch (error) {
      expect((error as Error).message).toBe("DATABASE_URL_INVALID");
      expect(error).not.toHaveProperty("cause");
    }
  });

  it.each([5432, 6543])("enforces verified TLS and bounded pooling on port %s despite URI overrides", async port => {
    const config = connectionOptions(`postgres://user:secret@example.test:${port}/postgres?sslmode=disable&max=99&prepare=true&debug=true`, ca);
    // Parse through the installed driver, without opening a network connection.
    const client = postgres(config.url, config.options);
    try {
      expect(client.options.ssl).toEqual({ ca, rejectUnauthorized: true });
      expect(client.options.ssl).not.toHaveProperty("checkServerIdentity");
      expect(client.options.ssl).not.toHaveProperty("servername");
      expect(client.options.max).toBe(2);
      expect(client.options.prepare).toBe(false);
      expect(client.options.fetch_types).toBe(false);
      expect(client.options.debug).toBe(false);
      expect(client.options.idle_timeout).toBe(20);
      expect(client.options.max_lifetime).toBe(300);
      expect(client.options.connect_timeout).toBe(10);
      expect(client.options.port).toEqual([port]);
    } finally {
      await client.end();
    }
  });

  it.each([undefined, "", "   "])("requires a CA for remote connections (%s)", caPem => {
    expect(() => connectionOptions("postgres://user:secret@example.test/db", caPem))
      .toThrow("SUPABASE_DB_CA_PEM_MISSING");
  });

  it.each(["private-invalid-certificate", "-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----"])(
    "rejects invalid PEM without leaking it", caPem => {
      try {
        connectionOptions("postgres://user:secret@example.test/db", caPem);
        expect.fail("Expected validation failure");
      } catch (error) {
        expect((error as Error).message).toBe("SUPABASE_DB_CA_PEM_INVALID");
        expect(error).not.toHaveProperty("cause");
        expect(JSON.stringify(databaseFailure(error))).not.toContain(caPem);
      }
    },
  );

  it.each(["localhost", "127.0.0.1", "[::1]"])("preserves local development on %s without requiring TLS", host => {
    const url = `postgres://user:secret@${host}:5432/db`;
    expect(connectionOptions(url).options).not.toHaveProperty("ssl");
    expect(connectionOptions(url, "invalid-but-unused").options).not.toHaveProperty("ssl");
  });
});

describe("safe database diagnostics", () => {
  it.each([
    ["SUPABASE_DB_CA_PEM_MISSING", "configuration"], ["SUPABASE_DB_CA_PEM_INVALID", "configuration"],
    ["DATABASE_URL_MISSING", "configuration"], ["DATABASE_URL_INVALID", "configuration"],
    ["28P01", "authentication"], ["28000", "authentication"],
    ["SELF_SIGNED_CERT_IN_CHAIN", "tls"], ["ERR_TLS_CERT_ALTNAME_INVALID", "tls"],
    ["ENOTFOUND", "dns"], ["EAI_AGAIN", "dns"], ["ECONNREFUSED", "connectivity"],
    ["CONNECT_TIMEOUT", "timeout"], ["57014", "timeout"],
    ["42501", "permissions"], ["42P01", "schema"], ["42703", "schema"],
    ["42P05", "pooler"], ["26000", "pooler"], ["53300", "connectivity"],
  ])("classifies wrapped %s errors as %s", (code, category) => {
    const secret = "postgres://private:password@example.test/database";
    const failure = databaseFailure({ message: secret, query: secret,
      cause: { code, message: secret, password: secret, hostname: secret } });
    expect(failure).toEqual({ code, category });
    expect(JSON.stringify(failure)).not.toContain(secret);
  });

  it("does not echo unknown codes, messages, or cyclic causes", () => {
    const error = { code: "secret-password", message: "private URI", cause: null as unknown };
    error.cause = error;
    expect(databaseFailure(error)).toEqual({ category: "unknown", code: "DATABASE_CHECK_FAILED" });
  });
});
