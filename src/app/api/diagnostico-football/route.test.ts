import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Importing any database/synchronization module must fail these tests.
vi.mock("@/server/db/client", () => { throw new Error("Database import forbidden"); });
vi.mock("@/server/ingest/sync", () => { throw new Error("Synchronization import forbidden"); });
import { POST } from "./route";

const diagnosticSecret = "ab".repeat(32); // Synthetic fixture only.
const providerKey = "synthetic-provider-key";
const fetchMock = vi.fn<typeof fetch>();

function request(authorization: string | null = `Bearer ${diagnosticSecret}`) {
  return new Request("https://preview.example.test/api/diagnostico-football", {
    method: "POST",
    headers: authorization === null ? {} : { Authorization: authorization },
  });
}

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_GIT_COMMIT_REF", "preview/linhadejogo-2026-11-05");
  vi.stubEnv("FOOTBALL_DATA_DIAGNOSTIC_SECRET", diagnosticSecret);
  vi.stubEnv("FOOTBALL_DATA_API_KEY", providerKey);
  vi.stubEnv("FOOTBALL_DATA_TOKEN", "");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Preview-only football diagnostic", () => {
  it.each(["production", "development", ""])("blocks %s before any provider call", async environment => {
    vi.stubEnv("VERCEL_ENV", environment);
    expect((await POST(request())).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["master", "another-preview", ""])("blocks branch %s", async branch => {
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", branch);
    expect((await POST(request())).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["", "short", "x".repeat(64)])("fails closed for invalid diagnostic credentials", async secret => {
    vi.stubEnv("FOOTBALL_DATA_DIAGNOSTIC_SECRET", secret);
    expect((await POST(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([null, "Bearer incorrect", `Bearer ${providerKey}`])("rejects unauthorized requests", async authorization => {
    expect((await POST(request(authorization))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls only the real read-only provider and returns an aggregate with no secrets", async () => {
    fetchMock.mockResolvedValue(Response.json({ competitions: [
      { id: 1, name: "Private fixture name", code: "TEST" },
    ], extra: providerKey }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, httpStatus: 200, responseValid: true, competitionCount: 1 });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("https://api.football-data.org/v4/competitions", {
      headers: { "X-Auth-Token": providerKey }, cache: "no-store",
      signal: expect.any(AbortSignal), redirect: "error",
    });
    expect(console.error).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it("accepts a valid empty response", async () => {
    fetchMock.mockResolvedValue(Response.json({ competitions: [] }));
    expect(await (await POST(request())).json()).toEqual({ success: true, httpStatus: 200, responseValid: true, competitionCount: 0 });
  });

  it("uses the existing legacy key fallback", async () => {
    vi.stubEnv("FOOTBALL_DATA_API_KEY", " ");
    vi.stubEnv("FOOTBALL_DATA_TOKEN", providerKey);
    fetchMock.mockResolvedValue(Response.json({ competitions: [] }));
    expect((await POST(request())).status).toBe(200);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ "X-Auth-Token": providerKey });
  });

  it("fails without calling the network when the provider key is missing", async () => {
    vi.stubEnv("FOOTBALL_DATA_API_KEY", "");
    expect((await POST(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 429, 500])("does not expose the body of provider HTTP %s errors", async status => {
    fetchMock.mockResolvedValue(new Response(providerKey + diagnosticSecret, { status }));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ success: false, httpStatus: status, responseValid: null, competitionCount: null });
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each(["invalid-json", JSON.stringify({ competitions: [{ name: providerKey }] })])("rejects invalid API responses without leaking details", async body => {
    fetchMock.mockResolvedValue(new Response(body));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ success: false, httpStatus: 502, responseValid: false, competitionCount: null });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("sanitizes network failures", async () => {
    fetchMock.mockRejectedValue(new Error(providerKey + diagnosticSecret));
    const response = await POST(request());
    expect(await response.json()).toEqual({ success: false, httpStatus: 502, responseValid: null, competitionCount: null });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("bounds the real provider request to eight seconds without leaking timeout errors", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(async (_url, options) => {
        const signal = options?.signal;
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal?.aborted).toBe(false);
        throw new DOMException("synthetic timeout", "TimeoutError");
      });
      const timeout = vi.spyOn(AbortSignal, "timeout");
      const response = await POST(request());
      expect(timeout).toHaveBeenCalledWith(8_000);
      expect(await response.json()).toEqual({ success: false, httpStatus: 502, responseValid: null, competitionCount: null });
      expect(console.error).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
