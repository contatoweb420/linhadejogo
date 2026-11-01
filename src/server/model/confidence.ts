import type { ModelResult } from "./poisson";

export const DATA_LEAGUE_COMFORT = 80;
export const DATA_TEAM_COMFORT = 15;
export const SHARPNESS_TIGHT = 8;
export const SHARPNESS_CLEAR = 18;

export type DataQuality = "insuficiente" | "limitada" | "suficiente";
export type Sharpness = "indisponivel" | "apertada" | "moderada" | "separada";

export type ConfidenceReading = {
  data: DataQuality;
  dataReasons: string[];
  sharpness: Sharpness;
  gapPoints: number | null;
};

export function readConfidence(result: ModelResult): ConfidenceReading {
  if (result.insufficient) {
    return {
      data: "insuficiente",
      dataReasons: [result.reason],
      sharpness: "indisponivel",
      gapPoints: null,
    };
  }

  const dataReasons: string[] = [];
  if (result.sample.league < DATA_LEAGUE_COMFORT) {
    dataReasons.push(
      `A liga tem ${result.sample.league} jogos anteriores. O patamar confortável é ${DATA_LEAGUE_COMFORT}.`,
    );
  }
  if (result.sample.home < DATA_TEAM_COMFORT) {
    dataReasons.push(
      `A equipa da casa tem ${result.sample.home} jogos anteriores. O patamar confortável é ${DATA_TEAM_COMFORT}.`,
    );
  }
  if (result.sample.away < DATA_TEAM_COMFORT) {
    dataReasons.push(
      `A equipa visitante tem ${result.sample.away} jogos anteriores. O patamar confortável é ${DATA_TEAM_COMFORT}.`,
    );
  }
  if (result.sample.homePooled) {
    dataReasons.push("A taxa da casa foi agregada porque havia menos de 3 jogos em casa.");
  }
  if (result.sample.awayPooled) {
    dataReasons.push("A taxa da visita foi agregada porque havia menos de 3 jogos fora.");
  }

  const values = [result.probabilities.home, result.probabilities.draw, result.probabilities.away].sort(
    (a, b) => b - a,
  );
  const gapPoints = (values[0] - values[1]) * 100;

  return {
    data: dataReasons.length > 0 ? "limitada" : "suficiente",
    dataReasons,
    sharpness: sharpnessOf(gapPoints),
    gapPoints,
  };
}

function sharpnessOf(gapPoints: number): Sharpness {
  if (gapPoints < SHARPNESS_TIGHT) return "apertada";
  if (gapPoints < SHARPNESS_CLEAR) return "moderada";
  return "separada";
}
