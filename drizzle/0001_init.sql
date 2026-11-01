CREATE TABLE IF NOT EXISTS sports (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS competitions (
  id serial PRIMARY KEY,
  sport_id integer NOT NULL REFERENCES sports(id),
  source text NOT NULL,
  external_id integer NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  country text,
  emblem_url text,
  type text,
  fetched_at timestamptz NOT NULL,
  UNIQUE (source, external_id),
  UNIQUE (source, code)
);

CREATE TABLE IF NOT EXISTS seasons (
  id serial PRIMARY KEY,
  competition_id integer NOT NULL REFERENCES competitions(id),
  source text NOT NULL,
  external_id integer NOT NULL,
  start_date text,
  end_date text,
  current_matchday integer,
  fetched_at timestamptz NOT NULL,
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id serial PRIMARY KEY,
  source text NOT NULL,
  external_id integer NOT NULL,
  name text NOT NULL,
  short_name text,
  tla text,
  crest_url text,
  fetched_at timestamptz NOT NULL,
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id serial PRIMARY KEY,
  source text NOT NULL,
  external_id integer NOT NULL,
  competition_id integer NOT NULL REFERENCES competitions(id),
  season_id integer REFERENCES seasons(id),
  utc_date timestamptz NOT NULL,
  status text NOT NULL,
  matchday integer,
  stage text,
  group_name text,
  duration text,
  venue text,
  minute integer,
  home_team_id integer NOT NULL REFERENCES teams(id),
  away_team_id integer NOT NULL REFERENCES teams(id),
  ht_home integer,
  ht_away integer,
  regular_home integer,
  regular_away integer,
  ft_home integer,
  ft_away integer,
  et_home integer,
  et_away integer,
  pen_home integer,
  pen_away integer,
  winner text,
  home_shots integer,
  away_shots integer,
  home_shots_on integer,
  away_shots_on integer,
  home_possession integer,
  away_possession integer,
  home_corners integer,
  away_corners integer,
  home_fouls integer,
  away_fouls integer,
  home_yellow integer,
  away_yellow integer,
  home_red integer,
  away_red integer,
  odds_home real,
  odds_draw real,
  odds_away real,
  remote_updated_at timestamptz,
  fetched_at timestamptz NOT NULL,
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS matches_utc_date ON matches (utc_date);
CREATE INDEX IF NOT EXISTS matches_home_team ON matches (home_team_id);
CREATE INDEX IF NOT EXISTS matches_away_team ON matches (away_team_id);
CREATE INDEX IF NOT EXISTS matches_competition ON matches (competition_id);

CREATE TABLE IF NOT EXISTS standings (
  id serial PRIMARY KEY,
  competition_id integer NOT NULL REFERENCES competitions(id),
  season_id integer REFERENCES seasons(id),
  team_id integer NOT NULL REFERENCES teams(id),
  table_type text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  position integer NOT NULL,
  played integer NOT NULL,
  won integer NOT NULL,
  draw integer NOT NULL,
  lost integer NOT NULL,
  goals_for integer NOT NULL,
  goals_against integer NOT NULL,
  goal_difference integer NOT NULL,
  points integer NOT NULL,
  form text,
  fetched_at timestamptz NOT NULL,
  UNIQUE (competition_id, season_id, team_id, table_type, group_name)
);

CREATE TABLE IF NOT EXISTS players (
  id serial PRIMARY KEY,
  source text NOT NULL,
  external_id integer NOT NULL,
  name text NOT NULL,
  position text,
  nationality text,
  date_of_birth text,
  fetched_at timestamptz NOT NULL,
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS squad_entries (
  id serial PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id),
  player_id integer NOT NULL REFERENCES players(id),
  shirt_number integer,
  position text,
  fetched_at timestamptz NOT NULL,
  UNIQUE (team_id, player_id)
);

CREATE TABLE IF NOT EXISTS sync_state (
  key text PRIMARY KEY,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL,
  ok boolean NOT NULL,
  message text
);

CREATE TABLE IF NOT EXISTS api_calls (
  id serial PRIMARY KEY,
  called_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS predictions (
  id serial PRIMARY KEY,
  match_id integer NOT NULL REFERENCES matches(id),
  model_version text NOT NULL,
  created_at timestamptz NOT NULL,
  home_probability real NOT NULL,
  draw_probability real NOT NULL,
  away_probability real NOT NULL,
  lambda_home real NOT NULL,
  lambda_away real NOT NULL,
  sample_home integer NOT NULL,
  sample_away integer NOT NULL,
  sample_league integer NOT NULL,
  payload jsonb NOT NULL,
  UNIQUE (match_id, model_version)
);

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id serial PRIMARY KEY,
  model_version text NOT NULL,
  computed_at timestamptz NOT NULL,
  evaluated integer NOT NULL,
  skipped integer NOT NULL,
  model_brier real,
  model_log_loss real,
  baseline_brier real,
  baseline_log_loss real,
  payload jsonb NOT NULL
);

INSERT INTO sports (code, name)
VALUES ('football', 'Futebol')
ON CONFLICT (code) DO NOTHING;
