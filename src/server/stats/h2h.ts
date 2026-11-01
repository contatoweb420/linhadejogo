export type H2HMatch = {
  utcDate: string;
  competitionCode: string;
  competitionName: string;
  homeTeamId: number;
  awayTeamId: number;
  regularHome: number | null;
  regularAway: number | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
  duration: string | null;
  externalId?: number;
  source?: string;
};

export type H2HFilter = {
  teamA: number;
  teamB: number;
  competitionCode?: string;
  sinceYear?: number;
  limit?: number;
  referenceDate?: string;
};

export type H2HSummary = {
  found: number;
  used: number;
  excludedWithoutRegulation: number;
  winsA: number;
  draws: number;
  winsB: number;
  goalsA: number;
  goalsB: number;
  goalsPerMatch: number | null;
  over15: number | null;
  over25: number | null;
  bothScored: number | null;
  homeWins: number;
  awayWins: number;
  venueDraws: number;
  extraTime: number;
  penalties: number;
  weightedWinShareA: number | null;
  lowSample: boolean;
  matches: H2HMatch[];
};

const HALF_LIFE_YEARS = 3;

function yearsBetween(laterIso: string, earlierIso: string) {
  const milliseconds = new Date(laterIso).getTime() - new Date(earlierIso).getTime();
  return milliseconds / (365.25 * 24 * 60 * 60 * 1000);
}

function wentBeyondRegulation(match: H2HMatch) {
  return match.duration === "EXTRA_TIME" || match.duration === "PENALTY_SHOOTOUT";
}

function hadPenalties(match: H2HMatch) {
  return (
    match.duration === "PENALTY_SHOOTOUT" ||
    (match.penaltyHome != null && match.penaltyAway != null)
  );
}

export function summarizeH2H(allMatches: H2HMatch[], filter: H2HFilter): H2HSummary {
  const filtered = allMatches
    .filter((match) => {
      const involves =
        (match.homeTeamId === filter.teamA && match.awayTeamId === filter.teamB) ||
        (match.homeTeamId === filter.teamB && match.awayTeamId === filter.teamA);
      if (!involves) return false;
      if (filter.competitionCode && match.competitionCode !== filter.competitionCode) return false;
      if (filter.sinceYear && Number(match.utcDate.slice(0, 4)) < filter.sinceYear) return false;
      return true;
    })
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());

  const limited = filter.limit ? filtered.slice(0, filter.limit) : filtered;
  const reference = filter.referenceDate ?? new Date().toISOString();

  let used = 0;
  let excluded = 0;
  let winsA = 0;
  let draws = 0;
  let winsB = 0;
  let goalsA = 0;
  let goalsB = 0;
  let over15 = 0;
  let over25 = 0;
  let both = 0;
  let homeWins = 0;
  let awayWins = 0;
  let venueDraws = 0;
  let weightSum = 0;
  let weightedA = 0;

  for (const match of limited) {
    if (match.regularHome == null || match.regularAway == null) {
      excluded += 1;
      continue;
    }
    used += 1;
    const goalsForA = match.homeTeamId === filter.teamA ? match.regularHome : match.regularAway;
    const goalsForB = match.homeTeamId === filter.teamB ? match.regularHome : match.regularAway;
    goalsA += goalsForA;
    goalsB += goalsForB;
    if (goalsForA > goalsForB) winsA += 1;
    else if (goalsForA < goalsForB) winsB += 1;
    else draws += 1;

    const total = match.regularHome + match.regularAway;
    if (total >= 2) over15 += 1;
    if (total >= 3) over25 += 1;
    if (match.regularHome > 0 && match.regularAway > 0) both += 1;
    if (match.regularHome > match.regularAway) homeWins += 1;
    else if (match.regularHome < match.regularAway) awayWins += 1;
    else venueDraws += 1;

    const weight = Math.exp(
      (-Math.LN2 * Math.max(0, yearsBetween(reference, match.utcDate))) / HALF_LIFE_YEARS,
    );
    weightSum += weight;
    if (goalsForA > goalsForB) weightedA += weight;
  }

  return {
    found: filtered.length,
    used,
    excludedWithoutRegulation: excluded,
    winsA,
    draws,
    winsB,
    goalsA,
    goalsB,
    goalsPerMatch: used ? (goalsA + goalsB) / used : null,
    over15: used ? over15 / used : null,
    over25: used ? over25 / used : null,
    bothScored: used ? both / used : null,
    homeWins,
    awayWins,
    venueDraws,
    extraTime: limited.filter(wentBeyondRegulation).length,
    penalties: limited.filter(hadPenalties).length,
    weightedWinShareA: weightSum ? weightedA / weightSum : null,
    lowSample: used < 5,
    matches: limited,
  };
}
