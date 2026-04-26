-- MMOS-ARENA-INTEL-01 P0 metadata foundation
-- Additive migration: question metadata table + indexes + RLS + updated_at trigger

begin;

create table if not exists public.question_metadata (
  question_id text primary key,
  topic text not null,
  subtopic text,
  concept_id text,
  source text default 'STAT',
  dataset_version text default '1.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_qmeta_topic
  on public.question_metadata (topic);

create index if not exists idx_qmeta_subtopic
  on public.question_metadata (topic, subtopic);

create index if not exists idx_qmeta_concept
  on public.question_metadata (concept_id);

create index if not exists idx_qmeta_source
  on public.question_metadata (source);

alter table public.question_metadata enable row level security;

-- Read policy for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'question_metadata'
      AND policyname = 'qmeta_select_authenticated'
  ) THEN
    CREATE POLICY qmeta_select_authenticated
      ON public.question_metadata
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

-- Write policies restricted to service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'question_metadata'
      AND policyname = 'qmeta_insert_service_role'
  ) THEN
    CREATE POLICY qmeta_insert_service_role
      ON public.question_metadata
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'question_metadata'
      AND policyname = 'qmeta_update_service_role'
  ) THEN
    CREATE POLICY qmeta_update_service_role
      ON public.question_metadata
      FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'question_metadata'
      AND policyname = 'qmeta_delete_service_role'
  ) THEN
    CREATE POLICY qmeta_delete_service_role
      ON public.question_metadata
      FOR DELETE
      TO service_role
      USING (true);
  END IF;
END
$$;

-- Table privileges aligned with RLS policies
grant select on public.question_metadata to authenticated;
grant select, insert, update, delete on public.question_metadata to service_role;

-- Dedicated updated_at trigger function for this table
create or replace function public.question_metadata_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_question_metadata_updated_at'
  ) THEN
    CREATE TRIGGER trg_question_metadata_updated_at
      BEFORE UPDATE ON public.question_metadata
      FOR EACH ROW
      EXECUTE FUNCTION public.question_metadata_set_updated_at();
  END IF;
END
$$;

commit;
