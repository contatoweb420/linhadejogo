import { describe, expect, it } from "vitest";
import { evaluateCompetition } from "./evaluate";
import { predictMatch, presentShares } from "./poisson";

function season() {
  const matches = [];
  for (let index = 0; index < 40; index += 1) {
    matches.push({
      id: index + 1,
      utcDate: new Date(Date.UTC(2026, 0, 1 + index, 18, 0)).toISOString(),
      homeTeamId: (index % 8) + 1,
      awayTeamId: ((index + 3) % 8) + 1,
      homeGoals: index % 2,
      awayGoals: index % 5 === 0 ? 1 : 0,
    });
  }
  return matches;
}

describe("modelo de Poisson", () => {
  it("recusa uma amostra curta", () => {
    const result = predictMatch({
      homeTeamId: 1,
      awayTeamId: 2,
      kickoff: "2026-08-01T18:00:00Z",
      history: season().slice(0, 4),
    });
    expect(result.insufficient).toBe(true);
  });

  it("faz as três probabilidades somarem 1 e ignora jogos futuros", () => {
    const history = season();
    const before = predictMatch({
      homeTeamId: 1,
      awayTeamId: 4,
      kickoff: "2026-02-15T18:00:00Z",
      history,
    });
    const withFuture = predictMatch({
      homeTeamId: 1,
      awayTeamId: 4,
      kickoff: "2026-02-15T18:00:00Z",
      history: [
        ...history,
        {
          utcDate: "2026-05-01T18:00:00Z",
          homeTeamId: 1,
          awayTeamId: 4,
          homeGoals: 8,
          awayGoals: 0,
        },
      ],
    });
    expect(before.insufficient).toBe(false);
    expect(withFuture.insufficient).toBe(false);
    if (before.insufficient || withFuture.insufficient) return;
    const sum = before.probabilities.home + before.probabilities.draw + before.probabilities.away;
    expect(sum).toBeCloseTo(1, 8);
    expect(before.probabilities).toEqual(withFuture.probabilities);
    const tenths = presentShares([
      before.probabilities.home,
      before.probabilities.draw,
      before.probabilities.away,
    ]).map((value) => Math.round(value * 10));
    expect(tenths.reduce((total, value) => total + value, 0)).toBe(1000);
  });
});

describe("avaliação retrospectiva", () => {
  it("não avalia um jogo com a própria ficha", () => {
    const result = evaluateCompetition(season());
    expect(result.evaluated).toBeGreaterThan(0);
    expect(result.skipped).toBeGreaterThan(0);
    expect(result.model?.brier).toBeGreaterThan(0);
    expect(result.model?.logLoss).toBeGreaterThan(0);
  });
});
