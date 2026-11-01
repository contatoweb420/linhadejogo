import { describe, expect, it } from "vitest";
import { formatDuration, formatModelVersion, formatPosition, formatStage, formatWinner, lisbonDayBounds, lisbonToday, matchGroup, parseStandingForm } from "./pt";

describe("fuso de Lisboa", () => {
  it("coloca a meia-noite de outubro de 2026 em UTC+1", () => {
    const bounds = lisbonDayBounds("2026-10-13");
    expect(bounds.start.toISOString()).toBe("2026-10-12T23:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-10-13T23:00:00.000Z");
  });

  it("coloca a meia-noite de janeiro em UTC", () => {
    const bounds = lisbonDayBounds("2026-01-13");
    expect(bounds.start.toISOString()).toBe("2026-01-13T00:00:00.000Z");
  });

  it("traduz os códigos da origem", () => {
    expect(formatWinner("HOME_TEAM")).toBe("Equipa da casa");
    expect(formatDuration("PENALTY_SHOOTOUT")).toBe("Desempate por penáltis");
    expect(formatStage("QUARTER_FINALS")).toBe("Quartos de final");
    expect(formatPosition("Goalkeeper")).toBe("Guarda-redes");
    expect(formatStage("CODIGO_DESCONHECIDO")).toBe("Fase não disponível");
    expect(formatModelVersion("quadrante-poisson-v1")).toBe("Linha de Jogo, versão 1");
    expect(matchGroup("IN_PLAY")).toBe("live");
    expect(matchGroup("TIMED")).toBe("upcoming");
    expect(matchGroup("FINISHED")).toBe("finished");
    expect(matchGroup("POSTPONED")).toBe("other");
  });

  it("traduz a forma WDL enviada pela origem", () => {
    expect(parseStandingForm("W,D,L,W")).toEqual(["V", "E", "D", "V"]);
    expect(parseStandingForm(null)).toEqual([]);
    expect(parseStandingForm("???")).toEqual([]);
  });

  it("formata o dia de Lisboa", () => {
    expect(lisbonToday(new Date("2026-10-13T23:30:00Z"))).toBe("2026-10-14");
  });
});
