import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { predictMatch, presentShares } from "@/server/model/poisson";
import { ProbabilityTiles } from "./probability-tiles";
import { ProbabilityPanel } from "./probability-panel";
import { MatchCard, type MatchCardData } from "./match-card";

vi.mock("@/lib/get-locale", () => ({ getLocale: async () => "pt-PT" }));

function modelResult() {
  return predictMatch({ homeTeamId: 1, awayTeamId: 4, kickoff: "2026-08-01T18:00:00Z", history:
    Array.from({ length: 40 }, (_, index) => ({
      utcDate: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      homeTeamId: (index % 8) + 1, awayTeamId: ((index + 3) % 8) + 1,
      homeGoals: index % 3, awayGoals: index % 5 === 0 ? 1 : 0,
    })),
  });
}

function displayedShares(html: string) {
  return [...html.matchAll(/<dd>([\d.,]+)<span>%<\/span><\/dd>/g)]
    .map(match => Number(match[1].replace(",", ".")));
}

it.each(["pt-PT", "pt-BR", "en-US"] as const)("renders the model's three rounded outcomes in order in %s", locale => {
  const result = modelResult();
  expect(result.insufficient).toBe(false);
  if (result.insufficient) throw new Error("Invalid model fixture");
  const [home, draw, away] = presentShares([result.probabilities.home, result.probabilities.draw, result.probabilities.away]);
  const html = renderToStaticMarkup(<ProbabilityTiles shares={{ home, draw, away }} locale={locale} />);
  expect(displayedShares(html)).toEqual([home, draw, away]);
  expect(displayedShares(html).reduce((sum, value) => sum + Math.round(value * 10), 0)).toBe(1000);
  expect([...html.matchAll(/data-outcome="(.*?)"/g)].map(match => match[1])).toEqual(["home", "draw", "away"]);
  expect(html).toContain(locale === "en-US" ? "Home win" : "Vitória casa");
  expect(html).toContain(locale === "en-US" ? "Draw" : "Empate");
  expect(html).toContain(locale === "en-US" ? "Away win" : "Vitória visitante");
});

it("preserves the original rounding of thirds to exactly 100%", () => {
  const [home, draw, away] = presentShares([1 / 3, 1 / 3, 1 / 3]);
  const html = renderToStaticMarkup(<ProbabilityTiles shares={{ home, draw, away }} locale="pt-PT" />);
  expect(displayedShares(html)).toEqual([33.4, 33.3, 33.3]);
});

it("connects the detail panel to the unchanged model and retains its context", async () => {
  const result = modelResult();
  const html = renderToStaticMarkup(await ProbabilityPanel({ result, recordedAt: null, retrospective: true }));
  expect(displayedShares(html)).toHaveLength(3);
  expect(html).not.toContain('class="reveal');
  expect(html).toContain("retrospectivo");
  expect(html).toContain("O que entrou no cálculo");
  expect(html).toContain("Resultados exactos mais prováveis");
});

describe("games list", () => {
  const match = {
    externalId: 42, utcDate: new Date("2026-01-01T18:00:00Z"), status: "FINISHED",
    homeName: "Casa", awayName: "Visitante", regularHome: 1, regularAway: 0,
    homeCrest: null, awayCrest: null, minute: null, duration: null,
    penHome: null, penAway: null, competitionCode: "PPL", competitionName: "Liga", country: "Portugal",
  } satisfies MatchCardData;
  it("shows the actual list estimates as tiles and retains the match link", async () => {
    const html = renderToStaticMarkup(await MatchCard({ match: { ...match, estimate: { home: 53.1, draw: 22.4, away: 24.5 } } }));
    expect(displayedShares(html)).toEqual([53.1, 22.4, 24.5]);
    expect(html).toContain('href="/jogos/42"');
    expect(html).toContain("1–0");
  });
  it("never invents percentages for an insufficient model sample", async () => {
    const result = predictMatch({ homeTeamId: 1, awayTeamId: 2, kickoff: "2026-01-01", history: [] });
    const detail = renderToStaticMarkup(await ProbabilityPanel({ result, recordedAt: null, retrospective: true }));
    const list = renderToStaticMarkup(await MatchCard({ match: { ...match, estimate: null } }));
    expect(detail).toContain("Não disponível");
    expect(list).toContain("Estimativa indisponível");
    expect(displayedShares(detail)).toEqual([]);
    expect(displayedShares(list)).toEqual([]);
  });
});
