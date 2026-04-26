-- VDRL-081
-- Phase 3 correction: create an independent control table for Arena drill visibility.
-- Safety rule: do not alter public.drill_registry or ingestion-owned schema.

create extension if not exists pgcrypto;
create table if not exists public.drill_registry_control (
  id uuid primary key default gen_random_uuid(),
  video_id text not null unique,
  active boolean not null default true,
  exam text,
  system text,
  tags text[],
  difficulty text,
  created_at timestamptz default now(),
  updated_at timestamptz
);
create index if not exists idx_drill_registry_control_active
  on public.drill_registry_control (active);
alter table public.drill_registry_control enable row level security;
grant select on table public.drill_registry_control to anon, authenticated;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'drill_registry_control'
      and policyname = 'drill_registry_control_read_all'
  ) then
    create policy drill_registry_control_read_all
      on public.drill_registry_control
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;
