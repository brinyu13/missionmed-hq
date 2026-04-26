-- DBOC Phase 1.1 Schema Creation
-- Source: (IV) DBOC_IV_OPERATOR_PLAYBOOK.html (Task 1.1)
-- SCHEMA RESOLUTION MODE: AUTHORITATIVE DERIVATION ENABLED
-- NOTE: Column types explicitly derived from playbook table purpose, naming conventions,
-- relationships, and Supabase-safe defaults where exact SQL types were not provided.

create extension if not exists pgcrypto;

-- 1) dboc_iv_questions (no foreign keys)
create table if not exists public.dboc_iv_questions (
  id uuid primary key default gen_random_uuid(), -- DERIVED: id -> uuid primary key
  category text not null, -- DERIVED: category -> text
  text text not null, -- DERIVED: text -> text
  difficulty text, -- DERIVED: difficulty -> text enum-like freeform
  created_at timestamptz not null default now(), -- DERIVED: timestamps -> timestamptz
  updated_at timestamptz not null default now(),
  last_used timestamptz,
  use_count integer not null default 0 -- DERIVED: count metric -> integer
);

-- 2) dboc_iv_sessions (FK: question_id -> questions)
create table if not exists public.dboc_iv_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, -- DERIVED: user_id -> uuid
  question_id uuid not null references public.dboc_iv_questions(id) on delete restrict,
  mode text not null, -- DERIVED: mode -> text
  status text not null default 'started', -- DERIVED: workflow status -> text
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

-- 3) dboc_iv_responses (FK: session_id -> sessions)
-- Includes PD-ready columns from playbook prompt: approved_for_sharing, visibility
create table if not exists public.dboc_iv_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.dboc_iv_sessions(id) on delete cascade,
  user_id uuid not null,
  video_url text, -- DERIVED: URL -> text
  transcript_text text,
  approved_for_sharing boolean not null default false, -- DERIVED: flag -> boolean
  visibility text not null default 'private', -- DERIVED: visibility state -> text
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dboc_iv_responses_visibility_chk check (visibility in ('private', 'coach', 'shared'))
);

-- 4) dboc_iv_response_metrics (FK: response_id -> responses)
create table if not exists public.dboc_iv_response_metrics (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.dboc_iv_responses(id) on delete cascade,
  pitch_sd numeric, -- DERIVED: metrics -> numeric
  volume_rms numeric,
  wpm integer,
  filler_count integer not null default 0,
  pause_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- 5) dboc_iv_saf_analysis (FK: response_id -> responses)
create table if not exists public.dboc_iv_saf_analysis (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.dboc_iv_responses(id) on delete cascade,
  s_score integer not null default 0,
  a_reasons integer not null default 0,
  f_focus integer not null default 0,
  e_closing integer not null default 0,
  feedback_text text,
  created_at timestamptz not null default now()
);

-- 6) dboc_iv_answer_vault (FK: question_id -> questions)
create table if not exists public.dboc_iv_answer_vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  question_id uuid references public.dboc_iv_questions(id) on delete set null,
  summary text,
  notes text,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7) dboc_iv_user_progress (unique on user_id)
create table if not exists public.dboc_iv_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  total_reps integer not null default 0,
  categories_covered text[] not null default '{}', -- DERIVED: multi-value category tracking -> text[]
  last_rep_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8) dboc_iv_review_queue (FK: response_id -> responses)
create table if not exists public.dboc_iv_review_queue (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.dboc_iv_responses(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'pending',
  reviewer_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9) dboc_iv_teaching_videos (FK: question_id -> questions)
create table if not exists public.dboc_iv_teaching_videos (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.dboc_iv_questions(id) on delete set null,
  video_url text not null,
  duration integer, -- DERIVED: duration seconds -> integer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10) dboc_iv_programs (V2 pre-wire, no FKs)
create table if not exists public.dboc_iv_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution text,
  cohort_size integer,
  created_at timestamptz not null default now()
);

-- 11) dboc_iv_stories (V2 pre-wire, no FKs)
-- Includes tags from playbook system schema block.
create table if not exists public.dboc_iv_stories (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  text text not null,
  tags text[] not null default '{}', -- DERIVED from playbook Story Schema block
  created_at timestamptz not null default now()
);

-- 12) dboc_iv_teaching_videos_meta (V2 pre-wire, FK: teaching_video_id -> teaching_videos)
create table if not exists public.dboc_iv_teaching_videos_meta (
  id uuid primary key default gen_random_uuid(),
  teaching_video_id uuid not null references public.dboc_iv_teaching_videos(id) on delete cascade,
  topic text,
  duration_sec integer,
  created_at timestamptz not null default now()
);

-- INDEX STRATEGY (IF NOT EXISTS) -------------------------------------------
-- Every user_id column
create index if not exists idx_dboc_iv_sessions_user_id on public.dboc_iv_sessions(user_id);
create index if not exists idx_dboc_iv_responses_user_id on public.dboc_iv_responses(user_id);
create index if not exists idx_dboc_iv_answer_vault_user_id on public.dboc_iv_answer_vault(user_id);
create index if not exists idx_dboc_iv_user_progress_user_id on public.dboc_iv_user_progress(user_id);
create index if not exists idx_dboc_iv_review_queue_user_id on public.dboc_iv_review_queue(user_id);

-- Every created_at column
create index if not exists idx_dboc_iv_questions_created on public.dboc_iv_questions(created_at);
create index if not exists idx_dboc_iv_sessions_created on public.dboc_iv_sessions(created_at);
create index if not exists idx_dboc_iv_responses_created on public.dboc_iv_responses(created_at);
create index if not exists idx_dboc_iv_response_metrics_created on public.dboc_iv_response_metrics(created_at);
create index if not exists idx_dboc_iv_saf_analysis_created on public.dboc_iv_saf_analysis(created_at);
create index if not exists idx_dboc_iv_answer_vault_created on public.dboc_iv_answer_vault(created_at);
create index if not exists idx_dboc_iv_user_progress_created on public.dboc_iv_user_progress(created_at);
create index if not exists idx_dboc_iv_review_queue_created on public.dboc_iv_review_queue(created_at);
create index if not exists idx_dboc_iv_teaching_videos_created on public.dboc_iv_teaching_videos(created_at);
create index if not exists idx_dboc_iv_programs_created on public.dboc_iv_programs(created_at);
create index if not exists idx_dboc_iv_stories_created on public.dboc_iv_stories(created_at);
create index if not exists idx_dboc_iv_teaching_videos_meta_created on public.dboc_iv_teaching_videos_meta(created_at);

-- Playbook-specific named indexes
create index if not exists idx_questions_category on public.dboc_iv_questions(category);
create index if not exists idx_sessions_mode on public.dboc_iv_sessions(mode);
create index if not exists idx_responses_session on public.dboc_iv_responses(session_id);

-- FK-support indexes
create index if not exists idx_dboc_iv_sessions_question_id on public.dboc_iv_sessions(question_id);
create index if not exists idx_dboc_iv_response_metrics_response_id on public.dboc_iv_response_metrics(response_id);
create index if not exists idx_dboc_iv_saf_analysis_response_id on public.dboc_iv_saf_analysis(response_id);
create index if not exists idx_dboc_iv_answer_vault_question_id on public.dboc_iv_answer_vault(question_id);
create index if not exists idx_dboc_iv_review_queue_response_id on public.dboc_iv_review_queue(response_id);
create index if not exists idx_dboc_iv_teaching_videos_question_id on public.dboc_iv_teaching_videos(question_id);
create index if not exists idx_dboc_iv_teaching_videos_meta_tvid on public.dboc_iv_teaching_videos_meta(teaching_video_id);
create index if not exists idx_stories_category on public.dboc_iv_stories(category);
