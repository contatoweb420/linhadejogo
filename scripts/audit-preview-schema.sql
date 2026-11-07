-- Reviewed SELECT-only audit for eoroljcefsurgsxegfzp (linhadejogo-preview).
-- Run only with: supabase db query --remote=eoroljcefsurgsxegfzp --read-only
-- Only aggregates and filtered metadata; no credentials or complete data rows.
WITH audited_tables(table_name, allowed_columns) AS (
  VALUES
    ('agent_cache', ARRAY['agent', 'itens', 'updated_at']::pg_catalog.text[]),
    ('api_calls', ARRAY['id', 'called_at']::pg_catalog.text[]),
    ('competitions', ARRAY['id', 'sport_id', 'source', 'external_id', 'code', 'name', 'country', 'emblem_url', 'type', 'fetched_at']::pg_catalog.text[]),
    ('evaluation_runs', ARRAY['id', 'model_version', 'computed_at', 'evaluated', 'skipped', 'model_brier', 'model_log_loss', 'baseline_brier', 'baseline_log_loss', 'payload']::pg_catalog.text[]),
    ('matches', ARRAY['id', 'source', 'external_id', 'competition_id', 'season_id', 'utc_date', 'status', 'matchday', 'stage', 'group_name', 'duration', 'venue', 'minute', 'home_team_id', 'away_team_id', 'ht_home', 'ht_away', 'regular_home', 'regular_away', 'ft_home', 'ft_away', 'et_home', 'et_away', 'pen_home', 'pen_away', 'winner', 'home_shots', 'away_shots', 'home_shots_on', 'away_shots_on', 'home_possession', 'away_possession', 'home_corners', 'away_corners', 'home_fouls', 'away_fouls', 'home_yellow', 'away_yellow', 'home_red', 'away_red', 'odds_home', 'odds_draw', 'odds_away', 'remote_updated_at', 'fetched_at']::pg_catalog.text[]),
    ('players', ARRAY['id', 'source', 'external_id', 'name', 'position', 'nationality', 'date_of_birth', 'fetched_at']::pg_catalog.text[]),
    ('predictions', ARRAY['id', 'match_id', 'model_version', 'created_at', 'home_probability', 'draw_probability', 'away_probability', 'lambda_home', 'lambda_away', 'sample_home', 'sample_away', 'sample_league', 'payload']::pg_catalog.text[]),
    ('seasons', ARRAY['id', 'competition_id', 'source', 'external_id', 'start_date', 'end_date', 'current_matchday', 'fetched_at']::pg_catalog.text[]),
    ('sports', ARRAY['id', 'code', 'name']::pg_catalog.text[]),
    ('squad_entries', ARRAY['id', 'team_id', 'player_id', 'shirt_number', 'position', 'fetched_at']::pg_catalog.text[]),
    ('standings', ARRAY['id', 'competition_id', 'season_id', 'team_id', 'table_type', 'group_name', 'position', 'played', 'won', 'draw', 'lost', 'goals_for', 'goals_against', 'goal_difference', 'points', 'form', 'fetched_at']::pg_catalog.text[]),
    ('sync_state', ARRAY['key', 'source', 'fetched_at', 'ok', 'message']::pg_catalog.text[]),
    ('teams', ARRAY['id', 'source', 'external_id', 'name', 'short_name', 'tla', 'crest_url', 'fetched_at']::pg_catalog.text[])
)
SELECT pg_catalog.jsonb_build_object(
  'read_only', pg_catalog.current_setting('transaction_read_only'),
  'counts', pg_catalog.jsonb_build_object(
    'sports', (SELECT pg_catalog.count(*) FROM public.sports),
    'competitions', (SELECT pg_catalog.count(*) FROM public.competitions),
    'seasons', (SELECT pg_catalog.count(*) FROM public.seasons),
    'teams', (SELECT pg_catalog.count(*) FROM public.teams),
    'matches', (SELECT pg_catalog.count(*) FROM public.matches),
    'standings', (SELECT pg_catalog.count(*) FROM public.standings),
    'players', (SELECT pg_catalog.count(*) FROM public.players),
    'predictions', (SELECT pg_catalog.count(*) FROM public.predictions),
    'agent_cache', (SELECT pg_catalog.count(*) FROM public.agent_cache),
    'sync_state', (SELECT pg_catalog.count(*) FROM public.sync_state)
  ),
  'match_groups', (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(g) ORDER BY g.source, g.status), '[]'::pg_catalog.jsonb)
    FROM (
      SELECT
        CASE WHEN m.source IN ('football-data.org', 'openfootball') THEN m.source ELSE '[other]' END AS source,
        CASE WHEN m.status IN ('SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'SUSPENDED', 'CANCELED', 'AWARDED')
          THEN m.status ELSE '[other]' END AS status,
        pg_catalog.count(*) AS total,
        pg_catalog.count(*) FILTER (WHERE m.utc_date >= pg_catalog.now() AND m.status IN ('SCHEDULED', 'TIMED')) AS future,
        pg_catalog.count(*) FILTER (WHERE m.status = 'FINISHED' AND m.regular_home IS NOT NULL AND m.regular_away IS NOT NULL) AS usable_results,
        pg_catalog.min(m.utc_date) AS earliest, pg_catalog.max(m.utc_date) AS latest, pg_catalog.max(m.fetched_at) AS last_fetch
      FROM public.matches AS m GROUP BY 1, 2
    ) AS g
  ),
  'columns', (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'table', t.table_name,
      'column', CASE WHEN c.column_name = ANY(t.allowed_columns) THEN c.column_name ELSE '[other_column]' END,
      'type', CASE WHEN c.data_type IN ('boolean', 'integer', 'real', 'jsonb', 'text', 'timestamp with time zone')
        THEN c.data_type ELSE '[other_type]' END,
      'udt', CASE WHEN c.udt_schema = 'pg_catalog' AND c.udt_name IN ('bool', 'int4', 'float4', 'jsonb', 'text', 'timestamptz')
        THEN c.udt_name ELSE '[other_type]' END,
      'nullable', c.is_nullable = 'YES',
      'has_default', c.column_default IS NOT NULL, 'identity', c.is_identity = 'YES'
    ) ORDER BY t.table_name, c.ordinal_position), '[]'::pg_catalog.jsonb)
    FROM information_schema.columns AS c
    JOIN audited_tables AS t ON c.table_name = t.table_name
    WHERE c.table_schema = 'public'
  ),
  'constraints', (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'table', t.table_name,
      'kind', CASE WHEN co.contype IN ('p', 'u', 'f', 'c', 'x', 'n', 't') THEN co.contype::pg_catalog.text ELSE '[other]' END,
      'columns', ARRAY(
        SELECT CASE WHEN a.attname = ANY(t.allowed_columns) THEN a.attname::pg_catalog.text ELSE '[other_column]' END
        FROM pg_catalog.unnest(co.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_catalog.pg_attribute AS a ON a.attrelid = r.oid AND a.attnum = k.attnum ORDER BY k.ord
      ),
      'references_schema', CASE WHEN rn.nspname = 'public' THEN 'public' WHEN rn.oid IS NULL THEN NULL ELSE '[other_schema]' END,
      'references_table', CASE WHEN rr.oid IS NULL THEN NULL
        WHEN rn.nspname = 'public' AND rr.relname IN (SELECT table_name FROM audited_tables)
        THEN rr.relname::pg_catalog.text ELSE '[other_table]' END
    ) ORDER BY t.table_name, co.contype, co.oid), '[]'::pg_catalog.jsonb)
    FROM pg_catalog.pg_constraint AS co
    JOIN pg_catalog.pg_class AS r ON r.oid = co.conrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = r.relnamespace
    JOIN audited_tables AS t ON r.relname = t.table_name
    LEFT JOIN pg_catalog.pg_class AS rr ON rr.oid = co.confrelid
    LEFT JOIN pg_catalog.pg_namespace AS rn ON rn.oid = rr.relnamespace
    WHERE n.nspname = 'public'
  ),
  'indexes', (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'table', t.table_name, 'unique', i.indisunique, 'primary', i.indisprimary,
      'valid', i.indisvalid, 'partial', i.indpred IS NOT NULL,
      'columns', ARRAY(
        SELECT CASE WHEN a.attname = ANY(t.allowed_columns) THEN a.attname::pg_catalog.text ELSE '[other_column]' END
        FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_catalog.pg_attribute AS a ON a.attrelid = r.oid AND a.attnum = k.attnum ORDER BY k.ord
      )
    ) ORDER BY t.table_name, i.indexrelid), '[]'::pg_catalog.jsonb)
    FROM pg_catalog.pg_index AS i
    JOIN pg_catalog.pg_class AS r ON r.oid = i.indrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = r.relnamespace
    JOIN audited_tables AS t ON r.relname = t.table_name
    WHERE n.nspname = 'public'
  ),
  'migration_history', pg_catalog.jsonb_build_object(
    'supabase', pg_catalog.to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
    'drizzle', pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NOT NULL,
    'public_drizzle', pg_catalog.to_regclass('public.__drizzle_migrations') IS NOT NULL
  ),
  'sync_status', (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) ORDER BY s.fetched_at DESC), '[]'::pg_catalog.jsonb)
    FROM (
      SELECT CASE WHEN source IN ('football-data.org', 'openfootball') THEN source ELSE '[other]' END AS source,
        ok, fetched_at
      FROM public.sync_state ORDER BY fetched_at DESC LIMIT 30
    ) AS s
  )
) AS preview_audit;
