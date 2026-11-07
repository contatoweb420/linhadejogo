-- Origin: scripts/import-openfootball.mjs and the original PostgreSQL 16 dump.
-- Apply only after verifying the target and existing object definitions.
-- This file is not automatically applied by scripts/apply-schema.mjs.
ALTER TABLE public.teams ADD COLUMN provider_key text;
ALTER TABLE public.seasons ADD COLUMN provider_key text;
ALTER TABLE public.matches ADD COLUMN provider_key text;

CREATE UNIQUE INDEX teams_source_provider_key
  ON public.teams USING btree (source, provider_key)
  WHERE provider_key IS NOT NULL;
CREATE UNIQUE INDEX seasons_source_provider_key
  ON public.seasons USING btree (source, provider_key)
  WHERE provider_key IS NOT NULL;
CREATE UNIQUE INDEX matches_source_provider_key
  ON public.matches USING btree (source, provider_key)
  WHERE provider_key IS NOT NULL;

CREATE SEQUENCE public.archive_external_id_seq
  AS bigint INCREMENT BY 1 NO MINVALUE NO MAXVALUE
  START WITH 900000001 CACHE 1 NO CYCLE;
