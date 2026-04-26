-- VDRL-080
-- Phase 2: Minimal drill registry schema + seed record for standalone drill loading.

create extension if not exists pgcrypto;
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'drill_status'
      and n.nspname = 'public'
  ) then
    create type public.drill_status as enum ('uploaded', 'ready', 'error');
  end if;
end
$$;
create table if not exists public.drill_registry (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  stream_uid text not null unique,
  vtt_path text,
  nodes_path text,
  duration integer,
  status public.drill_status not null default 'uploaded',
  created_at timestamptz not null default now()
);
create index if not exists idx_drill_registry_status
  on public.drill_registry (status);
alter table public.drill_registry enable row level security;
grant select on table public.drill_registry to anon, authenticated;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'drill_registry'
      and policyname = 'drill_registry_ready_read'
  ) then
    create policy drill_registry_ready_read
      on public.drill_registry
      for select
      to anon, authenticated
      using (status = 'ready');
  end if;
end
$$;
insert into public.drill_registry (
  title,
  stream_uid,
  vtt_path,
  nodes_path,
  duration,
  status
) values (
  'VDRL-002 - Dr J Interactive Drill MVP',
  'f73b003836014b1cc01fd2996ab4d1d9',
  'DrJdemofiles/GMT20260330-180641_Recording.transcript.vtt',
  'DrJdemofiles/GMT20260330-180641_Recording.nodes.json',
  3223,
  'ready'
)
on conflict (stream_uid) do update
set
  title = excluded.title,
  vtt_path = excluded.vtt_path,
  nodes_path = excluded.nodes_path,
  duration = excluded.duration,
  status = excluded.status;
