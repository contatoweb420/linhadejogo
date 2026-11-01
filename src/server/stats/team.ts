export type Venue = "home" | "away";

export type TeamSampleMatch = {
  utcDate: string;
  venue: Venue;
  goalsFor: number;
  goalsAgainst: number;
};

export type RecordSummary = {
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type ResultMark = "V" | "E" | "D";

export type StreakSummary = {
  result: { mark: ResultMark; length: number } | null;
  goals: { kind: "over25" | "under25"; length: number } | null;
};

export type TeamSummary = {
  played: number;
  won: number;
  draw: number;
  lost: number;
  winRate: number | null;
  goalsFor: number;
  goalsAgainst: number;
  goalsPerGame: number | null;
  concededPerGame: number | null;
  cleanSheets: number;
  scoredIn: number;
  failedToScore: number;
  points: number;
  pointsPerGame: number | null;
  goalDifference: number;
  over15: number | null;
  over25: number | null;
  over35: number | null;
  bothScored: number | null;
  home: RecordSummary;
  away: RecordSummary;
  form5: ResultMark[];
  form10: ResultMark[];
  streaks: StreakSummary;
};

function emptyRecord(): RecordSummary {
  return { played: 0, won: 0, draw: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
}

function resultOf(match: TeamSampleMatch): ResultMark {
  if (match.goalsFor > match.goalsAgainst) return "V";
  if (match.goalsFor < match.goalsAgainst) return "D";
  return "E";
}

function add(record: RecordSummary, match: TeamSampleMatch) {
  record.played += 1;
  record.goalsFor += match.goalsFor;
  record.goalsAgainst += match.goalsAgainst;
  const result = resultOf(match);
  if (result === "V") record.won += 1;
  else if (result === "E") record.draw += 1;
  else record.lost += 1;
}

export function summarizeTeam(matches: TeamSampleMatch[]): TeamSummary {
  const ordered = [...matches].sort(
    (a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime(),
  );
  const home = emptyRecord();
  const away = emptyRecord();
  let won = 0;
  let draw = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let scoredIn = 0;
  let failedToScore = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let bothScored = 0;

  for (const match of ordered) {
    const result = resultOf(match);
    if (result === "V") won += 1;
    else if (result === "E") draw += 1;
    else lost += 1;
    goalsFor += match.goalsFor;
    goalsAgainst += match.goalsAgainst;
    const total = match.goalsFor + match.goalsAgainst;
    if (total >= 2) over15 += 1;
    if (total >= 3) over25 += 1;
    if (total >= 4) over35 += 1;
    if (match.goalsFor > 0 && match.goalsAgainst > 0) bothScored += 1;
    if (match.goalsAgainst === 0) cleanSheets += 1;
    if (match.goalsFor > 0) scoredIn += 1;
    else failedToScore += 1;
    add(match.venue === "home" ? home : away, match);
  }

  const played = ordered.length;
  const points = won * 3 + draw;
  return {
    played,
    won,
    draw,
    lost,
    winRate: played ? won / played : null,
    goalsFor,
    goalsAgainst,
    goalsPerGame: played ? goalsFor / played : null,
    concededPerGame: played ? goalsAgainst / played : null,
    cleanSheets,
    scoredIn,
    failedToScore,
    points,
    pointsPerGame: played ? points / played : null,
    goalDifference: goalsFor - goalsAgainst,
    over15: played ? over15 / played : null,
    over25: played ? over25 / played : null,
    over35: played ? over35 / played : null,
    bothScored: played ? bothScored / played : null,
    home,
    away,
    form5: ordered.slice(0, 5).map(resultOf),
    form10: ordered.slice(0, 10).map(resultOf),
    streaks: streaksOf(ordered),
  };
}

function streaksOf(orderedNewestFirst: TeamSampleMatch[]): StreakSummary {
  const latest = orderedNewestFirst[0];
  if (!latest) return { result: null, goals: null };
  const mark = resultOf(latest);
  const over = latest.goalsFor + latest.goalsAgainst >= 3;
  return {
    result: { mark, length: runLength(orderedNewestFirst, (match) => resultOf(match) === mark) },
    goals: {
      kind: over ? "over25" : "under25",
      length: runLength(orderedNewestFirst, (match) => (match.goalsFor + match.goalsAgainst >= 3) === over),
    },
  };
}

function runLength(matches: TeamSampleMatch[], same: (match: TeamSampleMatch) => boolean) {
  let length = 0;
  for (const match of matches) {
    if (!same(match)) break;
    length += 1;
  }
  return length;
}

export function seasonSummaries(matches: Array<TeamSampleMatch & { season: string }>) {
  const groups = new Map<string, TeamSampleMatch[]>();
  for (const match of matches) {
    const key = match.season || "Sem época";
    const rows = groups.get(key) ?? [];
    rows.push(match);
    groups.set(key, rows);
  }
  return [...groups.entries()]
    .map(([season, rows]) => ({ season, ...summarizeTeam(rows) }))
    .sort((a, b) => b.season.localeCompare(a.season));
}
