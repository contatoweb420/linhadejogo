import { z } from "zod";
import { SOURCE_ID } from "./catalog";
import { pairOrNull, regulationScore } from "./regulation";

const BASE_URL = "https://api.football-data.org/v4";

const scorePair = z
  .object({
    home: z.number().nullable().optional(),
    away: z.number().nullable().optional(),
  })
  .nullable()
  .optional();

const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().nullable().optional(),
  tla: z.string().nullable().optional(),
  crest: z.string().nullable().optional(),
  statistics: z.record(z.string(), z.number().nullable()).optional(),
  squad: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        position: z.string().nullable().optional(),
        dateOfBirth: z.string().nullable().optional(),
        nationality: z.string().nullable().optional(),
        shirtNumber: z.number().nullable().optional(),
      }),
    )
    .optional(),
});

const competitionSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  type: z.string().optional(),
  emblem: z.string().nullable().optional(),
});

export const matchSchema = z.object({
  area: z.object({ name: z.string().optional() }).optional(),
  competition: competitionSchema,
  season: z
    .object({
      id: z.number(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      currentMatchday: z.number().nullable().optional(),
    })
    .optional(),
  id: z.number(),
  utcDate: z.string(),
  status: z.string(),
  minute: z.number().nullable().optional(),
  venue: z.string().nullable().optional(),
  matchday: z.number().nullable().optional(),
  stage: z.string().nullable().optional(),
  group: z.string().nullable().optional(),
  lastUpdated: z.string().optional(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  score: z
    .object({
      winner: z.string().nullable().optional(),
      duration: z.string().nullable().optional(),
      fullTime: scorePair,
      halfTime: scorePair,
      regularTime: scorePair,
      extraTime: scorePair,
      penalties: scorePair,
    })
    .optional(),
  odds: z
    .object({
      homeWin: z.number().nullable().optional(),
      draw: z.number().nullable().optional(),
      awayWin: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const competitionListSchema = z.object({
  competitions: z.array(
    competitionSchema.extend({
      area: z.object({ name: z.string().optional() }).optional(),
      currentSeason: z
        .object({
          id: z.number(),
          startDate: z.string().nullable().optional(),
          endDate: z.string().nullable().optional(),
          currentMatchday: z.number().nullable().optional(),
        })
        .nullable()
        .optional(),
    }),
  ),
});

const matchListSchema = z.object({
  matches: z.array(matchSchema),
});

const standingRowSchema = z.object({
  position: z.number(),
  playedGames: z.number(),
  won: z.number(),
  draw: z.number(),
  lost: z.number(),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  goalDifference: z.number(),
  points: z.number(),
  form: z.string().nullable().optional(),
  team: teamSchema,
});

const standingsSchema = z.object({
  competition: competitionSchema,
  season: z
    .object({
      id: z.number(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      currentMatchday: z.number().nullable().optional(),
    })
    .optional(),
  standings: z.array(
    z.object({
      type: z.string(),
      group: z.string().nullable().optional(),
      table: z.array(standingRowSchema),
    }),
  ),
});

export type ParsedMatch = z.infer<typeof matchSchema>;
export type ParsedCompetition = z.infer<typeof competitionListSchema>["competitions"][number];
export type ParsedStandings = z.infer<typeof standingsSchema>;
export type ParsedTeam = z.infer<typeof teamSchema> & {
  area?: { name?: string };
  coach?: { name?: string };
};

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function footballDataToken() {
  return process.env.FOOTBALL_DATA_API_KEY?.trim() || process.env.FOOTBALL_DATA_TOKEN?.trim() || "";
}

export function sourceName() {
  return SOURCE_ID;
}

export async function footballDataGet(path: string) {
  const token = footballDataToken();
  if (!token) {
    throw new ProviderError("A recolha no servidor ainda não está configurada.", 0);
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
    // Bound the diagnostic/provider request and never forward the API key
    // to a redirected destination.
    signal: AbortSignal.timeout(8_000),
    redirect: "error",
  });
  if (response.status === 400) {
    throw new ProviderError("A origem recusou o pedido. A configuração no servidor precisa de ser confirmada.", 400);
  }
  if (response.status === 429) {
    throw new ProviderError("A origem atingiu o limite de pedidos. Os dados guardados mantêm-se.", 429);
  }
  if (response.status === 403) {
    throw new ProviderError("Este pedido não está incluído no plano gratuito.", 403);
  }
  if (!response.ok) {
    throw new ProviderError(`A origem dos dados respondeu com o código ${response.status}.`, response.status);
  }
  return response.json() as Promise<unknown>;
}

export async function fetchCompetitions() {
  return competitionListSchema.parse(await footballDataGet("/competitions")).competitions;
}

export async function fetchMatches(query: string) {
  return matchListSchema.parse(await footballDataGet(`/matches?${query}`)).matches;
}

export async function fetchCompetitionMatches(code: string) {
  return matchListSchema.parse(await footballDataGet(`/competitions/${encodeURIComponent(code)}/matches`)).matches;
}

export async function fetchMatch(externalId: number) {
  return matchSchema.parse(await footballDataGet(`/matches/${externalId}`));
}

export async function fetchHeadToHead(externalId: number) {
  const json = await footballDataGet(`/matches/${externalId}/head2head?limit=50`);
  const parsed = z.object({ matches: z.array(matchSchema).optional() }).parse(json);
  return parsed.matches ?? [];
}

export async function fetchStandings(code: string) {
  return standingsSchema.parse(await footballDataGet(`/competitions/${encodeURIComponent(code)}/standings`));
}

export async function fetchTeam(externalId: number) {
  return teamSchema.parse(await footballDataGet(`/teams/${externalId}`));
}

export async function fetchTeamMatches(externalId: number) {
  return matchListSchema.parse(
    await footballDataGet(`/teams/${externalId}/matches?status=FINISHED&limit=80`),
  ).matches;
}

export function statNumber(statistics: Record<string, number | null> | undefined, key: string) {
  const value = statistics?.[key];
  return typeof value === "number" ? value : null;
}

export function storedMatch(match: ParsedMatch) {
  const regular = regulationScore(match.score?.duration, match.score?.regularTime, match.score?.fullTime);
  const half = pairOrNull(match.score?.halfTime);
  const full = pairOrNull(match.score?.fullTime);
  const extra = pairOrNull(match.score?.extraTime);
  const penalties = pairOrNull(match.score?.penalties);
  return { regular, half, full, extra, penalties };
}
