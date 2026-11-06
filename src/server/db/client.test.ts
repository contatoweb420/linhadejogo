import { X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ postgres: vi.fn(), drizzle: vi.fn(), execute: vi.fn() }));
vi.mock("postgres", () => ({ default: mocks.postgres }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: mocks.drizzle }));
import { getDb, pingDatabase } from "./client";

const ca = rootCertificates.find(pem => {
  const certificate = new X509Certificate(pem);
  return certificate.ca && Date.parse(certificate.validFrom) <= Date.now() &&
    Date.parse(certificate.validTo) > Date.now();
})!;

const globals = globalThis as typeof globalThis & { sql?: unknown; db?: unknown };

beforeEach(() => {
  delete globals.sql;
  delete globals.db;
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgres://user:private-password@example.test:5432/postgres");
  vi.stubEnv("SUPABASE_DB_CA_PEM", ca);
  mocks.postgres.mockReturnValue({});
  mocks.drizzle.mockReturnValue({ execute: mocks.execute });
  mocks.execute.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete globals.sql;
  delete globals.db;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("shared database client and readiness", () => {
  it("reuses one driver and Drizzle instance across concurrent checks and module reloads", async () => {
    const db = getDb();
    expect(await Promise.all([pingDatabase(), pingDatabase()])).toEqual([true, true]);
    vi.resetModules();
    const reloaded = await import("./client");
    expect(reloaded.getDb()).toBe(db);
    expect(mocks.postgres).toHaveBeenCalledTimes(1);
    expect(mocks.postgres).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      ssl: { ca, rejectUnauthorized: true },
    }));
    expect(mocks.drizzle).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("recognizes an empty sports table as available", async () => {
    expect(await pingDatabase()).toBe(true);
    expect(mocks.execute).toHaveBeenCalledOnce();
  });

  it("distinguishes missing configuration without creating a client", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await pingDatabase()).toBe(false);
    expect(mocks.postgres).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("[database] health check failed", {
      category: "configuration", code: "DATABASE_URL_MISSING",
    });
  });

  it.each([
    [undefined, "SUPABASE_DB_CA_PEM_MISSING"],
    ["invalid-private-pem", "SUPABASE_DB_CA_PEM_INVALID"],
  ])("rejects missing or invalid CA before creating a client", async (pem, code) => {
    vi.stubEnv("SUPABASE_DB_CA_PEM", pem);
    expect(await pingDatabase()).toBe(false);
    expect(mocks.postgres).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[database] health check failed", {
      category: "configuration", code,
    });
  });

  it("retains the fallback while logging only a wrapped driver code", async () => {
    mocks.execute.mockRejectedValueOnce({
      message: process.env.DATABASE_URL,
      cause: { code: "28P01", message: "private-password", query: "private query" },
    });
    expect(await pingDatabase()).toBe(false);
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[database] health check failed", {
      category: "authentication", code: "28P01",
    });
    expect(await pingDatabase()).toBe(true);
    expect(mocks.postgres).toHaveBeenCalledTimes(1);
  });
});
