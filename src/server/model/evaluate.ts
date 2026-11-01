import { predictMatch, type GoalMatch } from "./poisson";

const LOG_LOSS_FLOOR = 1e-6;

export type EvalMatch = GoalMatch & { id: number };

export type ClassScores = {
  brier: number;
  logLoss: number;
};

export type CompetitionEvaluation = {
  evaluated: number;
  skipped: number;
  model: ClassScores | null;
  baseline: ClassScores | null;
};

function outcome(match: GoalMatch): "home" | "draw" | "away" {
  if (match.homeGoals > match.awayGoals) return "home";
  if (match.homeGoals < match.awayGoals) return "away";
  return "draw";
}

function brier(
  probabilities: { home: number; draw: number; away: number },
  actual: "home" | "draw" | "away",
) {
  const outcomes = ["home", "draw", "away"] as const;
  return outcomes.reduce((sum, key) => {
    const observed = key === actual ? 1 : 0;
    return sum + (probabilities[key] - observed) ** 2;
  }, 0);
}

function logLoss(
  probabilities: { home: number; draw: number; away: number },
  actual: "home" | "draw" | "away",
) {
  return -Math.log(Math.min(1, Math.max(LOG_LOSS_FLOOR, probabilities[actual])));
}

function baseline(history: GoalMatch[]) {
  const counts = { home: 0, draw: 0, away: 0 };
  for (const match of history) counts[outcome(match)] += 1;
  const total = history.length;
  return {
    home: counts.home / total,
    draw: counts.draw / total,
    away: counts.away / total,
  };
}

export function evaluateCompetition(matches: EvalMatch[]): CompetitionEvaluation {
  const ordered = [...matches].sort((a, b) => {
    const byDate = new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
    return byDate || a.id - b.id;
  });

  let evaluated = 0;
  let skipped = 0;
  let modelBrier = 0;
  let modelLog = 0;
  let baselineBrier = 0;
  let baselineLog = 0;

  for (const match of ordered) {
    const history = ordered.filter(
      (prior) => new Date(prior.utcDate).getTime() < new Date(match.utcDate).getTime(),
    );
    const prediction = predictMatch({
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      kickoff: match.utcDate,
      history,
    });
    if (prediction.insufficient) {
      skipped += 1;
      continue;
    }
    const actual = outcome(match);
    const reference = baseline(history);
    modelBrier += brier(prediction.probabilities, actual);
    modelLog += logLoss(prediction.probabilities, actual);
    baselineBrier += brier(reference, actual);
    baselineLog += logLoss(reference, actual);
    evaluated += 1;
  }

  if (evaluated === 0) {
    return { evaluated, skipped, model: null, baseline: null };
  }

  return {
    evaluated,
    skipped,
    model: { brier: modelBrier / evaluated, logLoss: modelLog / evaluated },
    baseline: { brier: baselineBrier / evaluated, logLoss: baselineLog / evaluated },
  };
}
