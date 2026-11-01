import { describe, expect, it } from "vitest";
import { readConfidence } from "./confidence";
import type { ModelResult } from "./poisson";

function prediction(probabilities: { home: number; draw: number; away: number }, sample?: Partial<Extract<ModelResult, { insufficient: false }>["sample"]>): ModelResult {
  return {
    version: "quadrante-poisson-v1",
    insufficient: false,
    lambdas: { home: 1.2, away: 0.9 },
    probabilities,
    totals: { over15: 0.7, under15: 0.3, over25: 0.5, under25: 0.5, over35: 0.3, under35: 0.7 },
    btts: { yes: 0.45, no: 0.55 },
    scorelines: [],
    sample: {
      league: 100,
      home: 40,
      away: 40,
      homeVenue: 20,
      awayVenue: 20,
      homePooled: false,
      awayPooled: false,
      ...sample,
    },
    rates: {
      leagueHome: 1.4,
      leagueAway: 1.1,
      homeScored: 1.6,
      homeConceded: 0.9,
      awayScored: 1.1,
      awayConceded: 1.2,
    },
  };
}

describe("radar de confiança", () => {
  it("recusa nitidez quando o modelo não estima", () => {
    const reading = readConfidence({
      version: "quadrante-poisson-v1",
      insufficient: true,
      reason: "Amostra curta.",
      sample: { league: 4, home: 1, away: 1 },
    });
    expect(reading.data).toBe("insuficiente");
    expect(reading.sharpness).toBe("indisponivel");
    expect(reading.gapPoints).toBeNull();
    expect(reading.dataReasons).toEqual(["Amostra curta."]);
  });

  it("marca a amostra como limitada quando falta conforto ou a taxa foi agregada", () => {
    const reading = readConfidence(
      prediction(
        { home: 0.5, draw: 0.3, away: 0.2 },
        { league: 30, home: 10, away: 40, homePooled: true },
      ),
    );
    expect(reading.data).toBe("limitada");
    expect(reading.dataReasons).toHaveLength(3);
    expect(reading.sharpness).toBe("separada");
    expect(reading.gapPoints).toBeCloseTo(20);
  });

  it("separa qualidade suficiente de uma estimativa apertada", () => {
    const reading = readConfidence(prediction({ home: 0.4, draw: 0.35, away: 0.25 }));
    expect(reading.data).toBe("suficiente");
    expect(reading.dataReasons).toEqual([]);
    expect(reading.sharpness).toBe("apertada");
    expect(reading.gapPoints).toBeCloseTo(5);
  });

  it("classifica os limites de 8 e 18 pontos", () => {
    expect(readConfidence(prediction({ home: 0.4, draw: 0.32, away: 0.28 })).sharpness).toBe("moderada");
    expect(readConfidence(prediction({ home: 0.46, draw: 0.32, away: 0.22 })).sharpness).toBe("moderada");
    expect(readConfidence(prediction({ home: 0.5, draw: 0.32, away: 0.18 })).sharpness).toBe("separada");
  });
});
