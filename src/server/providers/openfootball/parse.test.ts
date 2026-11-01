import { describe, expect, it } from "vitest";
import { parseFootballTxt, resolveTeam, signature, zonedToUtc } from "../../../../scripts/football-txt.mjs";

const SAMPLE = `= Portuguese Primeira Liga 2024/25

▪ Matchday 1
Fri Aug 9 2024
  20:15 Sporting Clube de Portugal v Rio Ave FC 3-1 (2-0)
Sat Aug 10
  15:30 AVS v CD Nacional 1-1
Mon Dec 30
  20:15 FC Famalicão v CD Santa Clara
Fri Jan 3 2025
  20:15 Vitória Guimarães v Sporting Clube de Portugal 4-4 (1-2)
`;

describe("ficheiro football.txt", () => {
  it("lê resultados, intervalo e jogos sem marcador", () => {
    const parsed = parseFootballTxt(SAMPLE);
    expect(parsed.rejected).toBe(0);
    expect(parsed.seasonStart).toBe(2024);
    expect(parsed.fixtures).toHaveLength(4);
    expect(parsed.fixtures[0]).toMatchObject({
      date: "2024-08-09",
      time: "20:15",
      home: "Sporting Clube de Portugal",
      away: "Rio Ave FC",
      homeGoals: 3,
      awayGoals: 1,
      htHome: 2,
      htAway: 0,
      status: "FINISHED",
      matchday: 1,
    });
    expect(parsed.fixtures[1].htHome).toBeNull();
    expect(parsed.fixtures[2]).toMatchObject({ date: "2024-12-30", status: "SCHEDULED", homeGoals: null });
    expect(parsed.fixtures[3].date).toBe("2025-01-03");
  });

  it("herda a hora e lê o marcador antigo e o prolongamento", () => {
    const parsed = parseFootballTxt(`= English Premier League 2024/25
Sat Aug 17 2024
  15:00  Arsenal FC              v Wolverhampton Wanderers FC  2-0 (1-0)
         Everton FC              v Brighton & Hove Albion FC  0-3 (0-1)
  15:00  Blackburn Rovers         1-2 (1-1)  Wolverhampton Wanderers
         Fulham FC                0-0  Aston Villa
  20:00  Sunderland AFC          v Coventry City FC         1-1 a.e.t. (0-1, 0-0)
`);
    expect(parsed.rejected).toBe(0);
    expect(parsed.fixtures.map((fixture) => [fixture.home, fixture.time, fixture.homeGoals, fixture.awayGoals, fixture.duration])).toEqual([
      ["Arsenal FC", "15:00", 2, 0, "REGULAR"],
      ["Everton FC", "15:00", 0, 3, "REGULAR"],
      ["Blackburn Rovers", "15:00", 1, 2, "REGULAR"],
      ["Fulham FC", "15:00", 0, 0, "REGULAR"],
      ["Sunderland AFC", "20:00", 0, 1, "EXTRA_TIME"],
    ]);
    expect(parsed.fixtures[4]).toMatchObject({ htHome: 0, htAway: 0, etHome: 1, etAway: 1, away: "Coventry City FC" });
  });

  it("marca um jogo cancelado sem o guardar como resultado", () => {
    const parsed = parseFootballTxt(`= Eredivisie 2019/20
Sat Mar 7 2020
  20:00  Willem II               v sc Heerenveen            [cancelled]
`);
    expect(parsed.rejected).toBe(0);
    expect(parsed.fixtures[0]).toMatchObject({
      home: "Willem II",
      away: "sc Heerenveen",
      status: "POSTPONED",
      homeGoals: null,
    });
  });

  it("rejeita uma linha de jogo sem data", () => {
    const parsed = parseFootballTxt("20:15 Casa v Visita 1-0\n");
    expect(parsed.fixtures).toHaveLength(0);
    expect(parsed.rejected).toBe(1);
  });
});

describe("hora local", () => {
  it("converte o horário de Lisboa para UTC", () => {
    expect(zonedToUtc("2024-08-09", "20:15", "Europe/Lisbon").toISOString()).toBe("2024-08-09T19:15:00.000Z");
    expect(zonedToUtc("2025-01-03", "20:15", "Europe/Lisbon").toISOString()).toBe("2025-01-03T20:15:00.000Z");
  });
});

describe("ligação de equipas", () => {
  const teams = [
    { id: 1, name: "Sport Lisboa e Benfica", shortName: "SL Benfica" },
    { id: 2, name: "Vitória SC", shortName: "Vitória SC" },
    { id: 3, name: "FC Porto", shortName: "Porto" },
  ];
  const aliases = {
    [signature("Vitória Guimarães")]: "Vitória SC",
    [signature("Benfica")]: "Sport Lisboa e Benfica",
  };

  it("aceita o nome oficial, a abreviatura explícita e recusa um nome desconhecido", () => {
    expect(resolveTeam("FC Porto", teams, aliases)?.id).toBe(3);
    expect(resolveTeam("Benfica", teams, aliases)?.id).toBe(1);
    expect(resolveTeam("Vitória Guimarães", teams, aliases)?.id).toBe(2);
    expect(resolveTeam("Boavista FC", teams, aliases)).toBeNull();
  });

  it("não escolhe quando duas equipas ficam com a mesma assinatura", () => {
    const ambiguous = [
      { id: 1, name: "Vitória SC", shortName: "Vitória" },
      { id: 2, name: "Vitória FC", shortName: "Vitória" },
    ];
    expect(resolveTeam("Vitória", ambiguous, {})).toBeNull();
  });
});
