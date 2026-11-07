import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ competitions: vi.fn(), window: vi.fn() }));
vi.mock("@/server/ingest/sync", () => ({
  syncCompetitions: mocks.competitions, syncWindow: mocks.window,
}));
import { POST } from "./route";

beforeEach(() => {
  vi.stubEnv("RECOLHA_SEGREDO", "synthetic-collection-secret");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe("collection result reporting (synchronization mocked)", () => {
  it.each([undefined, "incorrect"])("does not call synchronization for unauthorized requests", async secret => {
    const response = await POST(new Request("https://example.test/api/recolha", {
      method: "POST", headers: secret ? { "x-recolha-segredo": secret } : {},
    }));
    expect(response.status).toBe(404);
    expect(mocks.competitions).not.toHaveBeenCalled();
    expect(mocks.window).not.toHaveBeenCalled();
  });

  it.each([[true, true], [false, true], [true, false], [false, false]])(
    "reports competition=%s and window=%s truthfully without exposing messages",
    async (competitionsOk, windowOk) => {
      mocks.competitions.mockResolvedValue({ ok: competitionsOk, message: "private-error-fixture" });
      mocks.window.mockResolvedValue({ ok: windowOk, message: "private-error-fixture" });
      const response = await POST(new Request("https://example.test/api/recolha", {
        method: "POST", headers: { "x-recolha-segredo": "synthetic-collection-secret" },
      }));
      const ok = competitionsOk && windowOk;
      expect(response.status).toBe(ok ? 200 : 502);
      expect(await response.json()).toEqual({ ok });
    },
  );
});
