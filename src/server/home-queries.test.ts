import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn<(sql: string, params: unknown[]) => Promise<{ rows: unknown[][] }>>(async () => ({ rows: [] })));
vi.mock("./db/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return { getDb: () => drizzle(execute) };
});
import { homeDaySummary, homeStandings, listHomeMatches } from "./queries";

const now = new Date("2026-10-13T12:00:00Z");
beforeEach(() => execute.mockClear());

describe("home presentation SQL", () => {
  it("limits recent results in SQL and keeps zero scores eligible", async () => {
    await listHomeMatches("finished", now);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain('"regular_home" is not null');
    expect(sql).toContain('"regular_away" is not null');
    expect(sql).not.toContain('"regular_home" >');
    expect(sql).toContain('"utc_date" <');
    expect(sql).toContain('order by "matches"."utc_date" desc, "matches"."id" asc limit');
    expect(sql).not.toContain('"home_shots"');
    expect(params).toEqual(["football-data.org", "FINISHED", now.toISOString(), 6]);
  });

  it("includes live games across midnight without a lower history cutoff", async () => {
    await listHomeMatches("live", now);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain('"status" in');
    expect(sql).not.toContain('\"utc_date\" >=');
    expect(sql).toContain('\"utc_date\" <=');
    expect(params).toEqual(["football-data.org", "IN_PLAY", "PAUSED", now.toISOString(), 6]);
  });

  it("excludes past scheduled games without applying a season or history cutoff", async () => {
    await listHomeMatches("upcoming", now);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain('"utc_date" >=');
    expect(sql).not.toContain('"season_id"');
    expect(params).toEqual(["football-data.org", "SCHEDULED", "TIMED", now.toISOString(), 6]);
  });

  it("counts the whole day in SQL independently of the six-row lists", async () => {
    expect(await homeDaySummary("2026-10-13")).toEqual({ live: 0, upcoming: 0, finished: 0 });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain("count(*) filter");
    expect(sql).not.toContain("limit");
    expect(params).toEqual(["football-data.org", "2026-10-12T23:00:00.000Z", "2026-10-13T23:00:00.000Z"]);
  });
});

it("isolates the homepage table to the most recent known season", async () => {
  execute.mockResolvedValueOnce({ rows: [[2026]] });
  await homeStandings(7);
  expect(execute.mock.calls[0][0]).toContain('"start_date" desc nulls last');
  expect(execute.mock.calls[1][0]).toContain('"season_id" =');
  expect(execute.mock.calls[1][1]).toEqual([7, "TOTAL", 2026]);
});
it("preserves standings with no season without mixing them into known seasons", async () => {
  execute.mockResolvedValueOnce({ rows: [[null]] });
  await homeStandings(7);
  expect(execute.mock.calls[1][0]).toContain('"season_id" is null');
});
