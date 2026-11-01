import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { competitions, matches, players, seasons, sports, squadEntries, standings, teams } from "../db/schema";
import { sourceName, statNumber, storedMatch, type ParsedCompetition, type ParsedMatch, type ParsedStandings, type ParsedTeam } from "../providers/football-data";

const source = sourceName();

async function sportId() {
  const db = getDb();
  const [sport] = await db.select().from(sports).where(eq(sports.code, "football"));
  if (!sport) throw new Error("O desporto de futebol não está na base.");
  return sport.id;
}

async function upsertTeam(team: ParsedTeam) {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .insert(teams)
    .values({
      source,
      externalId: team.id,
      name: team.name,
      shortName: team.shortName ?? null,
      tla: team.tla ?? null,
      crestUrl: team.crest ?? null,
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: [teams.source, teams.externalId],
      set: {
        name: team.name,
        shortName: team.shortName ?? null,
        tla: team.tla ?? null,
        crestUrl: team.crest ?? null,
        fetchedAt: now,
      },
    })
    .returning({ id: teams.id });
  return row.id;
}

export async function saveCompetitions(items: ParsedCompetition[]) {
  const db = getDb();
  const footballId = await sportId();
  const now = new Date();
  for (const item of items) {
    const [competition] = await db
      .insert(competitions)
      .values({
        sportId: footballId,
        source,
        externalId: item.id,
        code: item.code,
        name: item.name,
        country: item.area?.name ?? null,
        emblemUrl: item.emblem ?? null,
        type: item.type ?? null,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [competitions.source, competitions.externalId],
        set: {
          code: item.code,
          name: item.name,
          country: item.area?.name ?? null,
          emblemUrl: item.emblem ?? null,
          type: item.type ?? null,
          fetchedAt: now,
        },
      })
      .returning({ id: competitions.id });
    if (!item.currentSeason) continue;
    await db
      .insert(seasons)
      .values({
        competitionId: competition.id,
        source,
        externalId: item.currentSeason.id,
        startDate: item.currentSeason.startDate ?? null,
        endDate: item.currentSeason.endDate ?? null,
        currentMatchday: item.currentSeason.currentMatchday ?? null,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [seasons.source, seasons.externalId],
        set: {
          competitionId: competition.id,
          startDate: item.currentSeason.startDate ?? null,
          endDate: item.currentSeason.endDate ?? null,
          currentMatchday: item.currentSeason.currentMatchday ?? null,
          fetchedAt: now,
        },
      });
  }
}

async function competitionRow(match: ParsedMatch) {
  const db = getDb();
  const footballId = await sportId();
  const now = new Date();
  const [competition] = await db
    .insert(competitions)
    .values({
      sportId: footballId,
      source,
      externalId: match.competition.id,
      code: match.competition.code,
      name: match.competition.name,
      country: match.area?.name ?? null,
      emblemUrl: match.competition.emblem ?? null,
      type: match.competition.type ?? null,
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: [competitions.source, competitions.externalId],
      set: {
        code: match.competition.code,
        name: match.competition.name,
        emblemUrl: match.competition.emblem ?? null,
        fetchedAt: now,
      },
    })
    .returning({ id: competitions.id });
  let seasonId: number | null = null;
  if (match.season) {
    const [season] = await db
      .insert(seasons)
      .values({
        competitionId: competition.id,
        source,
        externalId: match.season.id,
        startDate: match.season.startDate ?? null,
        endDate: match.season.endDate ?? null,
        currentMatchday: match.season.currentMatchday ?? null,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [seasons.source, seasons.externalId],
        set: {
          competitionId: competition.id,
          startDate: match.season.startDate ?? null,
          endDate: match.season.endDate ?? null,
          currentMatchday: match.season.currentMatchday ?? null,
          fetchedAt: now,
        },
      })
      .returning({ id: seasons.id });
    seasonId = season.id;
  }
  return { competitionId: competition.id, seasonId };
}

export async function saveMatches(items: ParsedMatch[]) {
  const db = getDb();
  const now = new Date();
  for (const item of items) {
    const { competitionId, seasonId } = await competitionRow(item);
    const homeTeamId = await upsertTeam(item.homeTeam);
    const awayTeamId = await upsertTeam(item.awayTeam);
    const scores = storedMatch(item);
    const values = {
      source,
      externalId: item.id,
      competitionId,
      seasonId,
      utcDate: new Date(item.utcDate),
      status: item.status,
      matchday: item.matchday ?? null,
      stage: item.stage ?? null,
      groupName: item.group ?? null,
      duration: item.score?.duration ?? null,
      venue: item.venue ?? null,
      minute: item.minute ?? null,
      homeTeamId,
      awayTeamId,
      htHome: scores.half.home,
      htAway: scores.half.away,
      regularHome: scores.regular.home,
      regularAway: scores.regular.away,
      ftHome: scores.full.home,
      ftAway: scores.full.away,
      etHome: scores.extra.home,
      etAway: scores.extra.away,
      penHome: scores.penalties.home,
      penAway: scores.penalties.away,
      winner: item.score?.winner ?? null,
      homeShots: statNumber(item.homeTeam.statistics, "shots"),
      awayShots: statNumber(item.awayTeam.statistics, "shots"),
      homeShotsOn: statNumber(item.homeTeam.statistics, "shots_on_goal"),
      awayShotsOn: statNumber(item.awayTeam.statistics, "shots_on_goal"),
      homePossession: statNumber(item.homeTeam.statistics, "ball_possession"),
      awayPossession: statNumber(item.awayTeam.statistics, "ball_possession"),
      homeCorners: statNumber(item.homeTeam.statistics, "corners"),
      awayCorners: statNumber(item.awayTeam.statistics, "corners"),
      homeFouls: statNumber(item.homeTeam.statistics, "fouls"),
      awayFouls: statNumber(item.awayTeam.statistics, "fouls"),
      homeYellow: statNumber(item.homeTeam.statistics, "yellow_cards"),
      awayYellow: statNumber(item.awayTeam.statistics, "yellow_cards"),
      homeRed: statNumber(item.homeTeam.statistics, "red_cards"),
      awayRed: statNumber(item.awayTeam.statistics, "red_cards"),
      oddsHome: item.odds?.homeWin ?? null,
      oddsDraw: item.odds?.draw ?? null,
      oddsAway: item.odds?.awayWin ?? null,
      remoteUpdatedAt: item.lastUpdated ? new Date(item.lastUpdated) : null,
      fetchedAt: now,
    };
    await db
      .insert(matches)
      .values(values)
      .onConflictDoUpdate({
        target: [matches.source, matches.externalId],
        set: values,
      });
  }
}

export async function saveStandings(payload: ParsedStandings) {
  const db = getDb();
  const now = new Date();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.source, source), eq(competitions.externalId, payload.competition.id)));
  if (!competition) return;
  let seasonId: number | null = null;
  if (payload.season) {
    const [season] = await db
      .insert(seasons)
      .values({
        competitionId: competition.id,
        source,
        externalId: payload.season.id,
        startDate: payload.season.startDate ?? null,
        endDate: payload.season.endDate ?? null,
        currentMatchday: payload.season.currentMatchday ?? null,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [seasons.source, seasons.externalId],
        set: { fetchedAt: now, currentMatchday: payload.season.currentMatchday ?? null },
      })
      .returning({ id: seasons.id });
    seasonId = season.id;
  }
  const types = [...new Set(payload.standings.map((table) => table.type))];
  for (const type of types) {
    await db.delete(standings).where(and(eq(standings.competitionId, competition.id), eq(standings.tableType, type)));
  }
  for (const table of payload.standings) {
    for (const row of table.table) {
      const teamId = await upsertTeam(row.team);
      await db.insert(standings).values({
        competitionId: competition.id,
        seasonId,
        teamId,
        tableType: table.type,
        groupName: table.group ?? "",
        position: row.position,
        played: row.playedGames,
        won: row.won,
        draw: row.draw,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
        form: row.form ?? null,
        fetchedAt: now,
      });
    }
  }
}

export async function saveSquad(teamExternalId: number, payload: ParsedTeam) {
  if (!payload.squad?.length) return false;
  const db = getDb();
  const now = new Date();
  const teamId = await upsertTeam({ ...payload, id: teamExternalId });
  for (const player of payload.squad) {
    const [stored] = await db
      .insert(players)
      .values({
        source,
        externalId: player.id,
        name: player.name,
        position: player.position ?? null,
        nationality: player.nationality ?? null,
        dateOfBirth: player.dateOfBirth ?? null,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [players.source, players.externalId],
        set: {
          name: player.name,
          position: player.position ?? null,
          nationality: player.nationality ?? null,
          dateOfBirth: player.dateOfBirth ?? null,
          fetchedAt: now,
        },
      })
      .returning({ id: players.id });
    await db
      .insert(squadEntries)
      .values({
        teamId,
        playerId: stored.id,
        shirtNumber: player.shirtNumber ?? null,
        position: player.position ?? null,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [squadEntries.teamId, squadEntries.playerId],
        set: { shirtNumber: player.shirtNumber ?? null, position: player.position ?? null, fetchedAt: now },
      });
  }
  return true;
}
