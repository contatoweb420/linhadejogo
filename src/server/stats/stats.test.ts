import { describe, expect, it } from "vitest";
import { summarizeH2H } from "./h2h";
import { hitRate, predictedOutcome } from "./outcomes";
import { summarizeTeam } from "./team";

describe("resumo da equipa", () => {
  it("separa percentagem de vitórias da amostra", () => {
    const summary = summarizeTeam([
      { utcDate: "2026-08-01T18:00:00Z", venue: "home", goalsFor: 2, goalsAgainst: 0 },
      { utcDate: "2026-08-08T18:00:00Z", venue: "away", goalsFor: 1, goalsAgainst: 1 },
      { utcDate: "2026-08-15T18:00:00Z", venue: "home", goalsFor: 0, goalsAgainst: 1 },
    ]);
    expect(summary.played).toBe(3);
    expect(summary.won).toBe(1);
    expect(summary.winRate).toBeCloseTo(1 / 3);
    expect(summary.cleanSheets).toBe(1);
    expect(summary.failedToScore).toBe(1);
    expect(summary.points).toBe(4);
    expect(summary.pointsPerGame).toBeCloseTo(4 / 3);
    expect(summary.goalDifference).toBe(1);
    expect(summary.over15).toBeCloseTo(2 / 3);
    expect(summary.over25).toBe(0);
    expect(summary.over35).toBe(0);
    expect(summary.bothScored).toBeCloseTo(1 / 3);
    expect(summary.form5).toEqual(["D", "E", "V"]);
    expect(summary.streaks.result).toEqual({ mark: "D", length: 1 });
    expect(summary.streaks.goals).toEqual({ kind: "under25", length: 3 });
  });

  it("conta a sequência a partir do jogo mais recente", () => {
    const summary = summarizeTeam([
      { utcDate: "2026-09-01T18:00:00Z", venue: "home", goalsFor: 0, goalsAgainst: 2 },
      { utcDate: "2026-09-08T18:00:00Z", venue: "away", goalsFor: 3, goalsAgainst: 1 },
      { utcDate: "2026-09-15T18:00:00Z", venue: "home", goalsFor: 2, goalsAgainst: 1 },
    ]);
    expect(summary.streaks.result).toEqual({ mark: "V", length: 2 });
    expect(summary.streaks.goals).toEqual({ kind: "over25", length: 2 });
  });

  it("deixa as sequências vazias sem jogos", () => {
    expect(summarizeTeam([]).streaks).toEqual({ result: null, goals: null });
  });
});

describe("taxa de acerto", () => {
  it("compara o resultado mais provável com o marcador regulamentar", () => {
    expect(predictedOutcome(0.45, 0.29, 0.26)).toBe("home");
    expect(
      hitRate([
        { home: 0.45, draw: 0.29, away: 0.26, goalsHome: 0, goalsAway: 0 },
        { home: 0.27, draw: 0.3, away: 0.43, goalsHome: 0, goalsAway: 2 },
      ]),
    ).toEqual({ settled: 2, hits: 1, rate: 0.5 });
  });

  it("não devolve taxa quando não há jogos terminados", () => {
    expect(hitRate([])).toEqual({ settled: 0, hits: 0, rate: null });
  });
});

describe("confrontos diretos", () => {
  it("trata penáltis como empate no tempo regulamentar", () => {
    const summary = summarizeH2H(
      [
        {
          utcDate: "2024-05-01T19:00:00Z",
          competitionCode: "PPL",
          competitionName: "Primeira Liga",
          homeTeamId: 1,
          awayTeamId: 2,
          regularHome: 1,
          regularAway: 1,
          penaltyHome: 5,
          penaltyAway: 4,
          duration: "PENALTY_SHOOTOUT",
        },
      ],
      { teamA: 1, teamB: 2, referenceDate: "2026-10-13T18:00:00Z" },
    );
    expect(summary.used).toBe(1);
    expect(summary.draws).toBe(1);
    expect(summary.winsA).toBe(0);
    expect(summary.penalties).toBe(1);
    expect(summary.lowSample).toBe(true);
  });
});
