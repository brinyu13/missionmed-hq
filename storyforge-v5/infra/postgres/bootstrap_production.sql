\set ON_ERROR_STOP on

-- Authority: B1-502M / DR-011
-- Target: Railway project 875e7c17-d06f-4301-a4bb-e61016f153cf
-- Database service: a4a66362-c3ba-475a-ae21-2aa46624bafe
-- Scope: least-privilege roles and a StoryForge-owned migration ledger.
-- Preconditions: verified pre-migration backup and exact target-ID checks.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'storyforge_app') THEN
    CREATE ROLE storyforge_app NOLOGIN;
  END IF;
END
$$;

ALTER ROLE anon NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
ALTER ROLE authenticated NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
ALTER ROLE storyforge_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;

GRANT authenticated TO storyforge_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.sf_schema_migrations (
  version text PRIMARY KEY CHECK (version ~ '^[0-9]{14}$'),
  file_name text NOT NULL UNIQUE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  git_commit text NOT NULL CHECK (git_commit ~ '^[a-f0-9]{40}$'),
  backup_id text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.sf_schema_migrations FROM PUBLIC, anon, authenticated, storyforge_app;

COMMIT;
