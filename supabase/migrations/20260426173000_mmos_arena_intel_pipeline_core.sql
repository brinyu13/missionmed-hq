-- MMOS-ARENA-INTEL-01 P1 pipeline core
-- Additive migration: async inbox + jobs + watermarks + queue helper functions.
-- Scope: NEW tables/functions only. No existing table/function mutation.

begin;

create extension if not exists pgcrypto;

create table if not exists public.intel_event_inbox (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_event_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint intel_event_inbox_source_event_uk unique (source, source_event_id)
);

create index if not exists idx_intel_event_inbox_unprocessed
  on public.intel_event_inbox (received_at)
  where processed_at is null;

create index if not exists idx_intel_event_inbox_user_received
  on public.intel_event_inbox (user_id, received_at desc);

create table if not exists public.intel_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  dedupe_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0 and max_attempts <= 100),
  run_after timestamptz not null default now(),
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_intel_jobs_claim
  on public.intel_jobs (status, run_after);

create index if not exists idx_intel_jobs_type_status
  on public.intel_jobs (job_type, status, run_after);

create table if not exists public.intel_watermarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  pipeline_stage text not null,
  last_event_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, pipeline_stage)
);

create index if not exists idx_intel_watermarks_stage_updated
  on public.intel_watermarks (pipeline_stage, updated_at desc);

create or replace function public.intel_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_intel_jobs_set_updated_at'
      and tgrelid = 'public.intel_jobs'::regclass
  ) then
    create trigger trg_intel_jobs_set_updated_at
      before update on public.intel_jobs
      for each row
      execute function public.intel_set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_intel_watermarks_set_updated_at'
      and tgrelid = 'public.intel_watermarks'::regclass
  ) then
    create trigger trg_intel_watermarks_set_updated_at
      before update on public.intel_watermarks
      for each row
      execute function public.intel_set_updated_at();
  end if;
end
$$;

create or replace function public.claim_jobs(
  p_job_type text default null,
  p_limit integer default 10
)
returns setof public.intel_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 500));
begin
  return query
  with candidates as (
    select j.id
    from public.intel_jobs j
    where j.status in ('pending', 'failed')
      and j.run_after <= now()
      and j.attempts < j.max_attempts
      and (p_job_type is null or j.job_type = p_job_type)
    order by j.run_after asc, j.id asc
    for update skip locked
    limit v_limit
  )
  update public.intel_jobs j
  set
    status = 'running',
    attempts = j.attempts + 1,
    updated_at = now()
  from candidates c
  where j.id = c.id
  returning j.*;
end;
$$;

create or replace function public.ack_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.intel_jobs
  set
    status = 'succeeded',
    last_error = null,
    updated_at = now()
  where id = p_job_id
    and status = 'running';

  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    return true;
  end if;

  if exists (
    select 1
    from public.intel_jobs
    where id = p_job_id
      and status = 'succeeded'
  ) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.fail_job(
  p_job_id uuid,
  p_error text,
  p_base_backoff_seconds integer default 30,
  p_max_backoff_seconds integer default 3600
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
  v_max_attempts integer;
  v_delay_seconds integer;
begin
  select attempts, max_attempts
    into v_attempts, v_max_attempts
  from public.intel_jobs
  where id = p_job_id
    and status = 'running'
  for update;

  if not found then
    return null;
  end if;

  if v_attempts >= v_max_attempts then
    update public.intel_jobs
    set
      status = 'dead',
      last_error = left(coalesce(p_error, 'unknown error'), 4000),
      updated_at = now()
    where id = p_job_id;

    return 'dead';
  end if;

  v_delay_seconds := least(
    greatest(coalesce(p_max_backoff_seconds, 3600), 1),
    greatest(
      coalesce(p_base_backoff_seconds, 30),
      1
    ) * (power(2, greatest(v_attempts - 1, 0))::integer)
  );

  update public.intel_jobs
  set
    status = 'failed',
    run_after = now() + make_interval(secs => v_delay_seconds),
    last_error = left(coalesce(p_error, 'unknown error'), 4000),
    updated_at = now()
  where id = p_job_id;

  return 'failed';
end;
$$;

alter table public.intel_event_inbox enable row level security;
alter table public.intel_jobs enable row level security;
alter table public.intel_watermarks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'intel_event_inbox'
      and policyname = 'intel_event_inbox_service_role_all'
  ) then
    create policy intel_event_inbox_service_role_all
      on public.intel_event_inbox
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'intel_jobs'
      and policyname = 'intel_jobs_service_role_all'
  ) then
    create policy intel_jobs_service_role_all
      on public.intel_jobs
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'intel_watermarks'
      and policyname = 'intel_watermarks_service_role_all'
  ) then
    create policy intel_watermarks_service_role_all
      on public.intel_watermarks
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

grant select, insert, update, delete on public.intel_event_inbox to service_role;
grant select, insert, update, delete on public.intel_jobs to service_role;
grant select, insert, update, delete on public.intel_watermarks to service_role;

revoke all on public.intel_event_inbox from anon, authenticated;
revoke all on public.intel_jobs from anon, authenticated;
revoke all on public.intel_watermarks from anon, authenticated;

grant execute on function public.claim_jobs(text, integer) to service_role;
grant execute on function public.ack_job(uuid) to service_role;
grant execute on function public.fail_job(uuid, text, integer, integer) to service_role;

revoke all on function public.claim_jobs(text, integer) from anon, authenticated;
revoke all on function public.ack_job(uuid) from anon, authenticated;
revoke all on function public.fail_job(uuid, text, integer, integer) from anon, authenticated;

commit;
