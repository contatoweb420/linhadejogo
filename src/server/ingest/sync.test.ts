import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: vi.fn(), fetch: vi.fn() }));
vi.mock("../db/client", () => ({ getDb: mocks.db }));
import {
  syncCompetitions, syncCompetitionSeason, syncHeadToHead, syncMatch,
  syncStandings, syncTeam, syncWindow,
} from "./sync";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("missing provider configuration", () => {
  const operations = [
    () => syncCompetitions(), () => syncWindow("2026-11-06"),
    () => syncCompetitionSeason("PPL"), () => syncStandings("PPL"),
    () => syncMatch(1), () => syncHeadToHead(1), () => syncTeam(1),
  ];

  it.each(operations)("reports the configuration failure without touching the database or network", async operation => {
    vi.stubEnv("FOOTBALL_DATA_API_KEY", " ");
    vi.stubEnv("FOOTBALL_DATA_TOKEN", "");
    vi.stubGlobal("fetch", mocks.fetch);
    expect(await operation()).toEqual({
      ok: false, message: "A recolha no servidor ainda não está configurada.",
    });
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
