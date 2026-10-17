begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.ivoc_3528c_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.ivoc_3528c_touch_updated_at() from public, anon, authenticated;

create table public.ivoc_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_subject text not null check (owner_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  owner_display_name text,
  session_type text not null default 'question' check (session_type in ('question', 'quick', 'mock')),
  question_id text,
  question_text text,
  title text not null,
  interviewer_provider text not null default 'missionmed-static' check (char_length(interviewer_provider) between 1 and 80),
  state text not null default 'active' check (state in ('active', 'processing', 'saved', 'abandoned', 'error')),
  analytics_schema text not null default 'ivoc.analytics.v1',
  recording_enabled boolean not null default true,
  calibration_snapshot jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ivoc_recordings (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.ivoc_sessions(id),
  owner_subject text not null check (owner_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  storage_object_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'uploading', 'saved', 'error')),
  mime_type text not null default 'video/webm',
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  paused_spans jsonb not null default '[]'::jsonb,
  etag text,
  sealed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ivoc_results (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null unique references public.ivoc_sessions(id),
  owner_subject text not null check (owner_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  schema_name text not null check (schema_name = 'ivoc.analytics.v1'),
  schema_version integer not null default 1 check (schema_version = 1),
  payload jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ivoc_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.ivoc_sessions(id),
  owner_subject text not null check (owner_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  mentor_subject text not null check (mentor_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  assigned_by_subject text not null check (assigned_by_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  status text not null default 'assigned' check (status in ('assigned', 'in_review', 'reviewed', 'revoked')),
  notes jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, mentor_subject)
);

create table public.ivoc_preferences (
  owner_subject text primary key check (owner_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  calibration jsonb not null default '{}'::jsonb,
  visibility jsonb not null default '{}'::jsonb,
  coaching_enabled boolean not null default true,
  recording_default boolean not null default true,
  schema_version integer not null default 1 check (schema_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ivoc_access_log (
  id bigint generated always as identity primary key,
  actor_subject text,
  owner_subject text,
  session_id uuid references public.ivoc_sessions(id),
  recording_id uuid references public.ivoc_recordings(id),
  action text not null check (char_length(action) between 1 and 80),
  decision text not null check (decision in ('allow', 'deny')),
  reason text not null check (char_length(reason) between 1 and 160),
  request_id uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index ivoc_sessions_owner_created_idx on public.ivoc_sessions (owner_subject, created_at desc);
create index ivoc_sessions_state_idx on public.ivoc_sessions (state, updated_at desc);
create index ivoc_recordings_session_idx on public.ivoc_recordings (session_id);
create index ivoc_recordings_owner_created_idx on public.ivoc_recordings (owner_subject, created_at desc);
create index ivoc_results_owner_created_idx on public.ivoc_results (owner_subject, created_at desc);
create index ivoc_reviews_mentor_status_idx on public.ivoc_reviews (mentor_subject, status, created_at desc);
create index ivoc_access_log_session_created_idx on public.ivoc_access_log (session_id, created_at desc);
create index ivoc_access_log_actor_created_idx on public.ivoc_access_log (actor_subject, created_at desc);

create trigger ivoc_sessions_touch_updated_at before update on public.ivoc_sessions
for each row execute function public.ivoc_3528c_touch_updated_at();
create trigger ivoc_recordings_touch_updated_at before update on public.ivoc_recordings
for each row execute function public.ivoc_3528c_touch_updated_at();
create trigger ivoc_results_touch_updated_at before update on public.ivoc_results
for each row execute function public.ivoc_3528c_touch_updated_at();
create trigger ivoc_reviews_touch_updated_at before update on public.ivoc_reviews
for each row execute function public.ivoc_3528c_touch_updated_at();
create trigger ivoc_preferences_touch_updated_at before update on public.ivoc_preferences
for each row execute function public.ivoc_3528c_touch_updated_at();

alter table public.ivoc_sessions enable row level security;
alter table public.ivoc_recordings enable row level security;
alter table public.ivoc_results enable row level security;
alter table public.ivoc_reviews enable row level security;
alter table public.ivoc_preferences enable row level security;
alter table public.ivoc_access_log enable row level security;

revoke all on table public.ivoc_sessions from public, anon, authenticated;
revoke all on table public.ivoc_recordings from public, anon, authenticated;
revoke all on table public.ivoc_results from public, anon, authenticated;
revoke all on table public.ivoc_reviews from public, anon, authenticated;
revoke all on table public.ivoc_preferences from public, anon, authenticated;
revoke all on table public.ivoc_access_log from public, anon, authenticated;
revoke all on sequence public.ivoc_access_log_id_seq from public, anon, authenticated;

grant select, insert, update on table public.ivoc_sessions to service_role;
grant select, insert, update on table public.ivoc_recordings to service_role;
grant select, insert, update on table public.ivoc_results to service_role;
grant select, insert, update on table public.ivoc_reviews to service_role;
grant select, insert, update on table public.ivoc_preferences to service_role;
grant select, insert on table public.ivoc_access_log to service_role;
grant usage, select on sequence public.ivoc_access_log_id_seq to service_role;

comment on table public.ivoc_recordings is
  'Private IV Prep On-Call recording metadata. Media bytes remain in private MissionMed object storage; storage_object_key is server-only.';
comment on table public.ivoc_results is
  'Versioned structured IV Prep analytics results. No rendered DOM or biometric identity template.';

commit;
