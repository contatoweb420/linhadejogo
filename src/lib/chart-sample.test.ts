import { describe, expect, it } from "vitest";
import { recentChartMatches } from "./chart-sample";
import { summarizeTeam, type TeamSampleMatch } from "@/server/stats/team";

describe("chart sample", () => {
  const matches: TeamSampleMatch[] = Array.from({ length: 12 }, (_, i) => ({ utcDate: `2026-10-${String(i + 1).padStart(2, "0")}T18:00:00Z`, venue: i % 2 ? "away" : "home", goalsFor: i, goalsAgainst: 0 }));
  it("selects the newest ten chronologically without mutating the input or swapping scores", () => {
    const input = [...matches].reverse();
    const result = recentChartMatches(input);
    expect(result).toEqual(matches.slice(2));
    expect(input[0]).toEqual(matches[11]);
    expect(summarizeTeam(result).goalsFor).toBe(65);
    expect(summarizeTeam(result).played).toBe(10);
  });
  it("preserves real zeros and rejects missing, invalid and negative results", () => {
    const invalid = [null, undefined, NaN, Infinity, -1];
    const rows = invalid.map(goalsFor => ({ ...matches[0], goalsFor })) as TeamSampleMatch[];
    expect(recentChartMatches([...rows, { ...matches[0], utcDate: "invalid" }, matches[0]])).toEqual([matches[0]]);
    expect(recentChartMatches([])).toEqual([]);
  });
});
