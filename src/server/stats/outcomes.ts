export type Outcome = "home" | "draw" | "away";

export type SettledCall = {
  home: number;
  draw: number;
  away: number;
  goalsHome: number;
  goalsAway: number;
};

export function actualOutcome(goalsHome: number, goalsAway: number): Outcome {
  if (goalsHome > goalsAway) return "home";
  if (goalsHome < goalsAway) return "away";
  return "draw";
}

export function predictedOutcome(home: number, draw: number, away: number): Outcome {
  if (home >= draw && home >= away) return "home";
  if (draw >= away) return "draw";
  return "away";
}

export function hitRate(rows: SettledCall[]) {
  if (rows.length === 0) return { settled: 0, hits: 0, rate: null as number | null };
  let hits = 0;
  for (const row of rows) {
    if (predictedOutcome(row.home, row.draw, row.away) === actualOutcome(row.goalsHome, row.goalsAway)) {
      hits += 1;
    }
  }
  return { settled: rows.length, hits, rate: hits / rows.length };
}
