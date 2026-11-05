import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  locale: vi.fn(), sync: vi.fn(), ping: vi.fn(), matches: vi.fn(), summary: vi.fn(),
  catalog: vi.fn(), table: vi.fn(), news: vi.fn(), articles: vi.fn(),
}));
vi.mock("@/server/ingest/sync", () => ({ syncWindow: mocks.sync }));
vi.mock("@/server/db/client", () => ({ pingDatabase: mocks.ping }));
vi.mock("@/lib/get-locale", () => ({ getLocale: mocks.locale }));
vi.mock("@/server/queries", () => ({
  listHomeMatches: mocks.matches, homeDaySummary: mocks.summary,
  listCompetitions: mocks.catalog, homeStandings: mocks.table,
}));
vi.mock("@/server/news/store", () => ({ readNews: mocks.news }));
vi.mock("@/server/blog-agent/public", () => ({ publicArticles: mocks.articles }));
import HomePage from "./page";

// Expand only the page's synchronous server components, without executing client hooks.
function contents(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(contents).join(" ");
  if (!isValidElement<{ children?: ReactNode; label?: string; value?: number }>(node)) return String(node);
  if (typeof node.type === "function" && ["Count", "Lead", "Team", "MatchSection", "SectionHead"].includes(node.type.name)) {
    return contents((node.type as (props: unknown) => ReactNode)(node.props));
  }
  return [node.props.label, node.props.value, contents(node.props.children)].join(" ");
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.locale.mockResolvedValue("pt-PT");
  mocks.ping.mockResolvedValue(true);
  mocks.matches.mockResolvedValue([]);
  mocks.summary.mockResolvedValue({ live: 12, upcoming: 24, finished: 36 });
  mocks.catalog.mockResolvedValue([]);
  mocks.table.mockResolvedValue([]);
  mocks.news.mockResolvedValue([]);
  mocks.articles.mockResolvedValue([]);
});

describe("inicial com dados guardados", () => {
  it.each(["unavailable", "pending"])("presents stored games when the external API is %s", async (mode) => {
    mocks.sync.mockImplementation(() => mode === "pending" ? new Promise(() => {}) : Promise.reject(new Error("API unavailable")));
    mocks.matches.mockImplementation(async (group) => group === "finished" ? [{
      externalId: 42, utcDate: new Date("2026-11-03T20:00:00Z"), status: "FINISHED",
      regularHome: 0, regularAway: 0, fetchedAt: new Date("2026-11-03T22:00:00Z"),
      competitionName: "Liga guardada", homeName: "Casa guardada", awayName: "Fora guardada",
      homeCrest: null, awayCrest: null,
    }] : []);
    const result = contents(await HomePage());
    expect(result).toContain("Casa guardada");
    expect(result).toContain("0–0");
    expect(result).toContain("03/11/2026");
    expect(result).toContain("Resultados recentes");
    expect(result).toContain("Próximos jogos");
    expect(result).toContain("12");
    expect(result).toContain("24");
    expect(result).toContain("36");
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.matches.mock.calls.map(([group]) => group)).toEqual(["finished", "live", "upcoming"]);
  });

  it("does not await editorial or standings reads before returning the primary content", async () => {
    mocks.news.mockImplementation(() => new Promise(() => {}));
    mocks.articles.mockImplementation(() => new Promise(() => {}));
    mocks.table.mockImplementation(() => new Promise(() => {}));
    expect(contents(await HomePage())).toContain("Resultados recentes");
    expect(mocks.news).not.toHaveBeenCalled();
    expect(mocks.articles).not.toHaveBeenCalled();
    expect(mocks.table).not.toHaveBeenCalled();
  });

  it("retains the setup panel when the database is unavailable", async () => {
    mocks.ping.mockResolvedValue(false);
    const page = await HomePage();
    expect(page.props.children.props).toEqual({ database: false });
    expect(mocks.matches).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});

// This bypasses the proxy intentionally; the proxy's request forwarding is tested separately.
it.each(["pt-BR", "pt-PT", "en-US"])("renders home sections in %s", async (locale) => {
  mocks.locale.mockResolvedValue(locale);
  const result = contents(await HomePage());
  expect(result).toContain(locale === "en-US" ? "Recent results" : "Resultados recentes");
  expect(result).toContain(locale === "en-US" ? "Daily schedule by league" : "Quadro do dia, por competição");
});

// Check the real page tree without starting a browser or running background reads.
function elements(node: ReactNode): import("react").ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

it.each(["pt-BR", "pt-PT", "en-US"])("connects premium panels to saved data and real routes in %s", async locale => {
  mocks.locale.mockResolvedValue(locale);
  mocks.matches.mockImplementation(async group => group === "upcoming" ? [{
    externalId: 73, utcDate: new Date("2026-11-10T20:00:00Z"), status: "TIMED",
    regularHome: null, regularAway: null, fetchedAt: new Date("2026-11-05T10:00:00Z"),
    competitionName: "Saved league", homeName: "Saved home", awayName: "Saved away",
    homeCrest: null, awayCrest: null,
  }] : []);
  const page = await HomePage();
  const nodes = elements(page);
  const classes = nodes.map(node => node.props.className).join(" ");
  const hrefs = nodes.map(node => node.props.href);
  expect(classes).toContain("home-dashboard");
  expect(classes).toContain("premium-panel daily-board");
  expect(classes).not.toContain("led-board");
  expect(hrefs).toContain(`/${locale.toLowerCase()}/jogos/73`);
  expect(contents(page)).toContain("Saved home");
  expect(contents(page)).toContain("Saved away");
  expect(nodes.some(node => typeof node.type === "function" && node.type.name === "SetupPanel")).toBe(false);
  expect(mocks.matches).toHaveBeenCalledTimes(3);
  expect(mocks.sync).not.toHaveBeenCalled();
});
