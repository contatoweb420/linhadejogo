import { predictMatch, presentShares } from "./model/poisson";
import { competitionHistory } from "./queries";

export type ShareEstimate = {
  home: number;
  draw: number;
  away: number;
};

export async function estimatesForMatches(
  rows: Array<{
    externalId: number;
    competitionId: number;
    homeTeamId: number;
    awayTeamId: number;
    utcDate: Date;
  }>,
) {
  const result = new Map<number, ShareEstimate | null>();
  const groups = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = groups.get(row.competitionId) ?? [];
    list.push(row);
    groups.set(row.competitionId, list);
  }

  for (const [competitionId, matches] of groups) {
    const history = await competitionHistory(competitionId);
    const goalHistory = history.flatMap((match) => {
      if (match.regularHome == null || match.regularAway == null) return [];
      return [
        {
          utcDate: match.utcDate.toISOString(),
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeGoals: match.regularHome,
          awayGoals: match.regularAway,
        },
      ];
    });
    for (const match of matches) {
      const calculated = predictMatch({
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        kickoff: match.utcDate.toISOString(),
        history: goalHistory,
      });
      if (calculated.insufficient) {
        result.set(match.externalId, null);
        continue;
      }
      const [home, draw, away] = presentShares([
        calculated.probabilities.home,
        calculated.probabilities.draw,
        calculated.probabilities.away,
      ]);
      result.set(match.externalId, { home, draw, away });
    }
  }

  return result;
}
