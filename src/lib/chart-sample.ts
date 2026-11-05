import type { TeamSampleMatch } from "@/server/stats/team";

/** Latest ten dated results, displayed chronologically. Never coerce missing scores to zero. */
export function recentChartMatches(matches: TeamSampleMatch[]) {
  return matches.filter(match => Number.isFinite(Date.parse(match.utcDate)) && Number.isInteger(match.goalsFor) && match.goalsFor >= 0 && Number.isInteger(match.goalsAgainst) && match.goalsAgainst >= 0)
    .sort((a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate)).slice(-10);
}
