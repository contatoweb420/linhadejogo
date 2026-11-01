import { and, asc, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db/client";
import {
  competitions,
  evaluationRuns,
  matches,
  players,
  predictions,
  seasons,
  squadEntries,
  standings,
  teams,
} from "./db/schema";
import { lisbonDayBounds } from "./format/pt";
import { SOURCE_ID } from "./providers/catalog";
import { MODEL_VERSION, type InsufficientPrediction, type Prediction } from "./model/poisson";

export async function listCompetitions() {
  const db = getDb();
  return db
    .select()
    .from(competitions)
    .where(eq(competitions.source, SOURCE_ID))
    .orderBy(asc(competitions.country), asc(competitions.name));
}

const homeSide = alias(teams, "home_side");
const awaySide = alias(teams, "away_side");

export async function listMatchesForDay(day: string, competitionCode?: string, country?: string) {
  const db = getDb();
  const bounds = lisbonDayBounds(day);
  const filters = [gte(matches.utcDate, bounds.start), lt(matches.utcDate, bounds.end), eq(matches.source, SOURCE_ID)];
  if (competitionCode) filters.push(eq(competitions.code, competitionCode));
  if (country) filters.push(eq(competitions.country, country));

  return db
    .select({
      externalId: matches.externalId,
      utcDate: matches.utcDate,
      status: matches.status,
      minute: matches.minute,
      duration: matches.duration,
      regularHome: matches.regularHome,
      regularAway: matches.regularAway,
      penHome: matches.penHome,
      penAway: matches.penAway,
      fetchedAt: matches.fetchedAt,
      source: matches.source,
      competitionId: competitions.id,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      competitionCode: competitions.code,
      competitionName: competitions.name,
      country: competitions.country,
      homeExternalId: homeSide.externalId,
      homeName: homeSide.name,
      homeShort: homeSide.shortName,
      homeCrest: homeSide.crestUrl,
      awayExternalId: awaySide.externalId,
      awayName: awaySide.name,
      awayShort: awaySide.shortName,
      awayCrest: awaySide.crestUrl,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .innerJoin(homeSide, eq(matches.homeTeamId, homeSide.id))
    .innerJoin(awaySide, eq(matches.awayTeamId, awaySide.id))
    .where(and(...filters))
    .orderBy(asc(matches.utcDate));
}

export async function getMatchBundle(externalId: number) {
  const db = getDb();
  const [match] = await db
    .select()
    .from(matches)
    .where(and(eq(matches.source, SOURCE_ID), eq(matches.externalId, externalId)));
  if (!match) return null;
  const [home, away, competition, season] = await Promise.all([
    db.select().from(teams).where(eq(teams.id, match.homeTeamId)).then((rows) => rows[0]),
    db.select().from(teams).where(eq(teams.id, match.awayTeamId)).then((rows) => rows[0]),
    db.select().from(competitions).where(eq(competitions.id, match.competitionId)).then((rows) => rows[0]),
    match.seasonId
      ? db.select().from(seasons).where(eq(seasons.id, match.seasonId)).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);
  return { match, home, away, competition, season };
}

export async function competitionHistory(competitionId: number) {
  const db = getDb();
  return db
    .select()
    .from(matches)
    .where(and(eq(matches.competitionId, competitionId), eq(matches.status, "FINISHED")))
    .orderBy(asc(matches.utcDate));
}

export async function headToHeadMatches(homeTeamId: number, awayTeamId: number) {
  const db = getDb();
  return db
    .select({
      utcDate: matches.utcDate,
      competitionCode: competitions.code,
      competitionName: competitions.name,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      regularHome: matches.regularHome,
      regularAway: matches.regularAway,
      penaltyHome: matches.penHome,
      penaltyAway: matches.penAway,
      duration: matches.duration,
      externalId: matches.externalId,
      source: matches.source,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      or(
        and(eq(matches.homeTeamId, homeTeamId), eq(matches.awayTeamId, awayTeamId)),
        and(eq(matches.homeTeamId, awayTeamId), eq(matches.awayTeamId, homeTeamId)),
      ),
    )
    .orderBy(desc(matches.utcDate));
}

export async function getCompetition(code: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.source, SOURCE_ID), eq(competitions.code, code)));
  return row ?? null;
}

export async function competitionHasMatches(competitionId: number) {
  const db = getDb();
  const [row] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.competitionId, competitionId))
    .limit(1);
  return Boolean(row);
}

export async function competitionMatches(competitionId: number, range?: { from: Date; to: Date }) {
  const db = getDb();
  const filters = [eq(matches.competitionId, competitionId), eq(matches.source, SOURCE_ID)];
  if (range) filters.push(gte(matches.utcDate, range.from), lt(matches.utcDate, range.to));
  return db
    .select({
      externalId: matches.externalId,
      utcDate: matches.utcDate,
      status: matches.status,
      regularHome: matches.regularHome,
      regularAway: matches.regularAway,
      homeName: homeSide.name,
      homeCrest: homeSide.crestUrl,
      homeExternalId: homeSide.externalId,
      awayName: awaySide.name,
      awayCrest: awaySide.crestUrl,
      awayExternalId: awaySide.externalId,
    })
    .from(matches)
    .innerJoin(homeSide, eq(matches.homeTeamId, homeSide.id))
    .innerJoin(awaySide, eq(matches.awayTeamId, awaySide.id))
    .where(and(...filters))
    .orderBy(asc(matches.utcDate));
}

export async function competitionTable(competitionId: number, tableType: string) {
  const db = getDb();
  return db
    .select({
      position: standings.position,
      played: standings.played,
      won: standings.won,
      draw: standings.draw,
      lost: standings.lost,
      goalsFor: standings.goalsFor,
      goalsAgainst: standings.goalsAgainst,
      goalDifference: standings.goalDifference,
      points: standings.points,
      form: standings.form,
      groupName: standings.groupName,
      fetchedAt: standings.fetchedAt,
      teamName: teams.name,
      teamExternalId: teams.externalId,
      crestUrl: teams.crestUrl,
    })
    .from(standings)
    .innerJoin(teams, eq(standings.teamId, teams.id))
    .where(and(eq(standings.competitionId, competitionId), eq(standings.tableType, tableType)))
    .orderBy(asc(standings.groupName), asc(standings.position));
}

export async function competitionRecentForm(competitionId: number, limit = 5) {
  const db = getDb();
  const rows = await db
    .select({
      homeExternalId: homeSide.externalId,
      awayExternalId: awaySide.externalId,
      regularHome: matches.regularHome,
      regularAway: matches.regularAway,
    })
    .from(matches)
    .innerJoin(homeSide, eq(matches.homeTeamId, homeSide.id))
    .innerJoin(awaySide, eq(matches.awayTeamId, awaySide.id))
    .where(
      and(
        eq(matches.competitionId, competitionId),
        eq(matches.source, SOURCE_ID),
        eq(matches.status, "FINISHED"),
      ),
    )
    .orderBy(desc(matches.utcDate));

  const newestFirst = new Map<number, Array<"V" | "E" | "D">>();
  for (const row of rows) {
    if (row.regularHome == null || row.regularAway == null) continue;
    const homeMark = markOf(row.regularHome, row.regularAway);
    const awayMark = markOf(row.regularAway, row.regularHome);
    rememberMark(newestFirst, row.homeExternalId, homeMark, limit);
    rememberMark(newestFirst, row.awayExternalId, awayMark, limit);
  }
  return new Map([...newestFirst].map(([teamId, marks]) => [teamId, [...marks].reverse()]));
}

function markOf(goalsFor: number, goalsAgainst: number): "V" | "E" | "D" {
  if (goalsFor > goalsAgainst) return "V";
  if (goalsFor < goalsAgainst) return "D";
  return "E";
}

function rememberMark(
  marks: Map<number, Array<"V" | "E" | "D">>,
  teamId: number,
  mark: "V" | "E" | "D",
  limit: number,
) {
  const current = marks.get(teamId) ?? [];
  if (current.length >= limit) return;
  current.push(mark);
  marks.set(teamId, current);
}

export async function getTeamByExternalId(externalId: number) {
  const db = getDb();
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.source, SOURCE_ID), eq(teams.externalId, externalId)));
  return team ?? null;
}

export async function teamMatches(teamId: number) {
  const db = getDb();
  return db
    .select({
      utcDate: matches.utcDate,
      status: matches.status,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      regularHome: matches.regularHome,
      regularAway: matches.regularAway,
      homeShots: matches.homeShots,
      awayShots: matches.awayShots,
      homeShotsOn: matches.homeShotsOn,
      awayShotsOn: matches.awayShotsOn,
      homePossession: matches.homePossession,
      awayPossession: matches.awayPossession,
      homeCorners: matches.homeCorners,
      awayCorners: matches.awayCorners,
      homeYellow: matches.homeYellow,
      awayYellow: matches.awayYellow,
      homeRed: matches.homeRed,
      awayRed: matches.awayRed,
      seasonId: matches.seasonId,
      seasonStart: seasons.startDate,
      competitionName: competitions.name,
      competitionCode: competitions.code,
      externalId: matches.externalId,
      source: matches.source,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(seasons, eq(matches.seasonId, seasons.id))
    .where(or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId)))
    .orderBy(desc(matches.utcDate));
}

export async function teamStandings(teamId: number) {
  const db = getDb();
  return db
    .select({
      position: standings.position,
      played: standings.played,
      points: standings.points,
      tableType: standings.tableType,
      fetchedAt: standings.fetchedAt,
      competitionName: competitions.name,
      competitionCode: competitions.code,
    })
    .from(standings)
    .innerJoin(competitions, eq(standings.competitionId, competitions.id))
    .where(and(eq(standings.teamId, teamId), eq(standings.tableType, "TOTAL")));
}

export async function teamSquad(teamId: number) {
  const db = getDb();
  return db
    .select({
      name: players.name,
      position: squadEntries.position,
      shirtNumber: squadEntries.shirtNumber,
      nationality: players.nationality,
      dateOfBirth: players.dateOfBirth,
      fetchedAt: squadEntries.fetchedAt,
    })
    .from(squadEntries)
    .innerJoin(players, eq(squadEntries.playerId, players.id))
    .where(eq(squadEntries.teamId, teamId))
    .orderBy(asc(squadEntries.shirtNumber));
}

export async function searchCatalog(term: string) {
  const db = getDb();
  const pattern = `%${term.replace(/[%_]/g, "").trim()}%`;
  const [teamRows, competitionRows] = await Promise.all([
    db.select().from(teams).where(and(eq(teams.source, SOURCE_ID), ilike(teams.name, pattern))).limit(20),
    db
      .select()
      .from(competitions)
      .where(and(eq(competitions.source, SOURCE_ID), or(ilike(competitions.name, pattern), ilike(competitions.code, pattern))))
      .limit(20),
  ]);
  return { teams: teamRows, competitions: competitionRows };
}

export async function rememberUpcomingPrediction(
  utcDate: Date,
  matchId: number,
  prediction: Prediction | InsufficientPrediction,
) {
  const kickoffPassed = utcDate.getTime() <= Date.now();
  if (!prediction.insufficient && !kickoffPassed) {
    await rememberPrediction(matchId, prediction);
  }
  const stored = await storedPrediction(matchId);
  return { stored, retrospective: !stored && kickoffPassed };
}

export async function rememberPrediction(matchId: number, prediction: Prediction) {
  const db = getDb();
  await db
    .insert(predictions)
    .values({
      matchId,
      modelVersion: MODEL_VERSION,
      createdAt: new Date(),
      homeProbability: prediction.probabilities.home,
      drawProbability: prediction.probabilities.draw,
      awayProbability: prediction.probabilities.away,
      lambdaHome: prediction.lambdas.home,
      lambdaAway: prediction.lambdas.away,
      sampleHome: prediction.sample.home,
      sampleAway: prediction.sample.away,
      sampleLeague: prediction.sample.league,
      payload: prediction,
    })
    .onConflictDoNothing();
}

export async function storedPrediction(matchId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(predictions)
    .where(and(eq(predictions.matchId, matchId), eq(predictions.modelVersion, MODEL_VERSION)));
  return row ?? null;
}

function asCount(value: unknown) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

export async function competitionsWithResults() {
  const db = getDb();
  return db
    .selectDistinct({
      id: competitions.id,
      code: competitions.code,
      name: competitions.name,
    })
    .from(competitions)
    .innerJoin(
      matches,
      and(eq(matches.competitionId, competitions.id), eq(matches.status, "FINISHED")),
    )
    .where(eq(competitions.source, SOURCE_ID))
    .orderBy(asc(competitions.name));
}

export async function outcomeDistribution(code: string | null) {
  const db = getDb();
  const filters = [
    eq(matches.status, "FINISHED"),
    sql`${matches.regularHome} is not null`,
    sql`${matches.regularAway} is not null`,
  ];
  if (code) {
    filters.push(eq(competitions.source, SOURCE_ID), eq(competitions.code, code));
  }
  const base = db
    .select({
      home: sql<number>`count(*) filter (where ${matches.regularHome} > ${matches.regularAway})`,
      draw: sql<number>`count(*) filter (where ${matches.regularHome} = ${matches.regularAway})`,
      away: sql<number>`count(*) filter (where ${matches.regularHome} < ${matches.regularAway})`,
    })
    .from(matches);
  const [row] = code
    ? await base.innerJoin(competitions, eq(matches.competitionId, competitions.id)).where(and(...filters))
    : await base.where(and(...filters));
  return {
    home: asCount(row?.home),
    draw: asCount(row?.draw),
    away: asCount(row?.away),
  };
}

export async function currentStandings(code: string) {
  const db = getDb();
  const [latest] = await db
    .select({ seasonId: standings.seasonId })
    .from(standings)
    .innerJoin(competitions, eq(standings.competitionId, competitions.id))
    .leftJoin(seasons, eq(standings.seasonId, seasons.id))
    .where(
      and(eq(competitions.source, SOURCE_ID), eq(competitions.code, code), eq(standings.tableType, "TOTAL")),
    )
    .orderBy(desc(seasons.startDate))
    .limit(1);
  if (!latest?.seasonId) return [];
  return db
    .select({
      position: standings.position,
      played: standings.played,
      won: standings.won,
      draw: standings.draw,
      lost: standings.lost,
      goalsFor: standings.goalsFor,
      goalsAgainst: standings.goalsAgainst,
      points: standings.points,
      groupName: standings.groupName,
      teamName: teams.name,
      teamExternalId: teams.externalId,
    })
    .from(standings)
    .innerJoin(teams, eq(standings.teamId, teams.id))
    .innerJoin(competitions, eq(standings.competitionId, competitions.id))
    .where(
      and(
        eq(competitions.source, SOURCE_ID),
        eq(competitions.code, code),
        eq(standings.seasonId, latest.seasonId),
        eq(standings.tableType, "TOTAL"),
      ),
    )
    .orderBy(asc(standings.groupName), asc(standings.position));
}

export async function settledPredictions() {
  const db = getDb();
  return db
    .select({
      homeProbability: predictions.homeProbability,
      drawProbability: predictions.drawProbability,
      awayProbability: predictions.awayProbability,
      utcDate: matches.utcDate,
      regularHome: matches.regularHome,
      regularAway: matches.regularAway,
      homeName: homeSide.name,
      awayName: awaySide.name,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(homeSide, eq(matches.homeTeamId, homeSide.id))
    .innerJoin(awaySide, eq(matches.awayTeamId, awaySide.id))
    .where(
      and(
        eq(predictions.modelVersion, MODEL_VERSION),
        eq(matches.status, "FINISHED"),
        sql`${predictions.createdAt} < ${matches.utcDate}`,
        sql`${matches.regularHome} is not null`,
        sql`${matches.regularAway} is not null`,
      ),
    )
    .orderBy(desc(matches.utcDate));
}

export async function finishedMatchesForEvaluation() {
  const db = getDb();
  return db
    .select({
      id: matches.id,
      utcDate: matches.utcDate,
      competitionId: matches.competitionId,
      competitionName: competitions.name,
      competitionCode: competitions.code,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      regularHome: matches.regularHome,
      regularAway: matches.regularAway,
      status: matches.status,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.status, "FINISHED"))
    .orderBy(asc(matches.utcDate));
}

export async function saveEvaluation(run: {
  evaluated: number;
  skipped: number;
  modelBrier: number | null;
  modelLogLoss: number | null;
  baselineBrier: number | null;
  baselineLogLoss: number | null;
  payload: unknown;
}) {
  const db = getDb();
  await db.insert(evaluationRuns).values({
    modelVersion: MODEL_VERSION,
    computedAt: new Date(),
    evaluated: run.evaluated,
    skipped: run.skipped,
    modelBrier: run.modelBrier,
    modelLogLoss: run.modelLogLoss,
    baselineBrier: run.baselineBrier,
    baselineLogLoss: run.baselineLogLoss,
    payload: run.payload,
  });
}

export async function recentEvaluations() {
  const db = getDb();
  return db.select().from(evaluationRuns).orderBy(desc(evaluationRuns.computedAt)).limit(8);
}
