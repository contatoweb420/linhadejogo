import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const sports = pgTable("sports", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

export const competitions = pgTable(
  "competitions",
  {
    id: serial("id").primaryKey(),
    sportId: integer("sport_id")
      .notNull()
      .references(() => sports.id),
    source: text("source").notNull(),
    externalId: integer("external_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    country: text("country"),
    emblemUrl: text("emblem_url"),
    type: text("type"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("competitions_source_external").on(table.source, table.externalId),
    unique("competitions_source_code").on(table.source, table.code),
  ],
);

export const seasons = pgTable(
  "seasons",
  {
    id: serial("id").primaryKey(),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id),
    source: text("source").notNull(),
    externalId: integer("external_id").notNull(),
    startDate: text("start_date"),
    endDate: text("end_date"),
    currentMatchday: integer("current_matchday"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("seasons_source_external").on(table.source, table.externalId),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    externalId: integer("external_id").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    tla: text("tla"),
    crestUrl: text("crest_url"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [unique("teams_source_external").on(table.source, table.externalId)],
);

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    externalId: integer("external_id").notNull(),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id),
    seasonId: integer("season_id").references(() => seasons.id),
    utcDate: timestamp("utc_date", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    matchday: integer("matchday"),
    stage: text("stage"),
    groupName: text("group_name"),
    duration: text("duration"),
    venue: text("venue"),
    minute: integer("minute"),
    homeTeamId: integer("home_team_id")
      .notNull()
      .references(() => teams.id),
    awayTeamId: integer("away_team_id")
      .notNull()
      .references(() => teams.id),
    htHome: integer("ht_home"),
    htAway: integer("ht_away"),
    regularHome: integer("regular_home"),
    regularAway: integer("regular_away"),
    ftHome: integer("ft_home"),
    ftAway: integer("ft_away"),
    etHome: integer("et_home"),
    etAway: integer("et_away"),
    penHome: integer("pen_home"),
    penAway: integer("pen_away"),
    winner: text("winner"),
    homeShots: integer("home_shots"),
    awayShots: integer("away_shots"),
    homeShotsOn: integer("home_shots_on"),
    awayShotsOn: integer("away_shots_on"),
    homePossession: integer("home_possession"),
    awayPossession: integer("away_possession"),
    homeCorners: integer("home_corners"),
    awayCorners: integer("away_corners"),
    homeFouls: integer("home_fouls"),
    awayFouls: integer("away_fouls"),
    homeYellow: integer("home_yellow"),
    awayYellow: integer("away_yellow"),
    homeRed: integer("home_red"),
    awayRed: integer("away_red"),
    oddsHome: real("odds_home"),
    oddsDraw: real("odds_draw"),
    oddsAway: real("odds_away"),
    remoteUpdatedAt: timestamp("remote_updated_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("matches_source_external").on(table.source, table.externalId),
    index("matches_utc_date").on(table.utcDate),
    index("matches_home_team").on(table.homeTeamId),
    index("matches_away_team").on(table.awayTeamId),
    index("matches_competition").on(table.competitionId),
  ],
);

export const standings = pgTable(
  "standings",
  {
    id: serial("id").primaryKey(),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id),
    seasonId: integer("season_id").references(() => seasons.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    tableType: text("table_type").notNull(),
    groupName: text("group_name").notNull().default(""),
    position: integer("position").notNull(),
    played: integer("played").notNull(),
    won: integer("won").notNull(),
    draw: integer("draw").notNull(),
    lost: integer("lost").notNull(),
    goalsFor: integer("goals_for").notNull(),
    goalsAgainst: integer("goals_against").notNull(),
    goalDifference: integer("goal_difference").notNull(),
    points: integer("points").notNull(),
    form: text("form"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("standings_identity").on(
      table.competitionId,
      table.seasonId,
      table.teamId,
      table.tableType,
      table.groupName,
    ),
  ],
);

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    externalId: integer("external_id").notNull(),
    name: text("name").notNull(),
    position: text("position"),
    nationality: text("nationality"),
    dateOfBirth: text("date_of_birth"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [unique("players_source_external").on(table.source, table.externalId)],
);

export const squadEntries = pgTable(
  "squad_entries",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    shirtNumber: integer("shirt_number"),
    position: text("position"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [unique("squad_team_player").on(table.teamId, table.playerId)],
);

export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  source: text("source").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  ok: boolean("ok").notNull(),
  message: text("message"),
});

export const apiCalls = pgTable("api_calls", {
  id: serial("id").primaryKey(),
  calledAt: timestamp("called_at", { withTimezone: true }).notNull(),
});

export const predictions = pgTable(
  "predictions",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    modelVersion: text("model_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    homeProbability: real("home_probability").notNull(),
    drawProbability: real("draw_probability").notNull(),
    awayProbability: real("away_probability").notNull(),
    lambdaHome: real("lambda_home").notNull(),
    lambdaAway: real("lambda_away").notNull(),
    sampleHome: integer("sample_home").notNull(),
    sampleAway: integer("sample_away").notNull(),
    sampleLeague: integer("sample_league").notNull(),
    payload: jsonb("payload").notNull(),
  },
  (table) => [
    unique("predictions_match_model").on(table.matchId, table.modelVersion),
  ],
);

export const agentCache = pgTable(
  "agent_cache",
  {
    agent: text("agent").primaryKey(),
    itens: jsonb("itens").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("agent_cache_agent", sql`${table.agent} in ('news', 'blogs', 'forums', 'reviews')`)],
);

export const evaluationRuns = pgTable("evaluation_runs", {
  id: serial("id").primaryKey(),
  modelVersion: text("model_version").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
  evaluated: integer("evaluated").notNull(),
  skipped: integer("skipped").notNull(),
  modelBrier: real("model_brier"),
  modelLogLoss: real("model_log_loss"),
  baselineBrier: real("baseline_brier"),
  baselineLogLoss: real("baseline_log_loss"),
  payload: jsonb("payload").notNull(),
});
