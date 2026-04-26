-- MMOS-ARENA-INTEL-01 P0 enrollment persistence layer
-- Additive, idempotent migration for public.student_profiles enrollment fields.
-- Scope: student_profiles table + related indexes/policies/trigger only.

begin;

-- Stop early if a conflicting table exists without user_id.
do $$
begin
  if to_regclass('public.student_profiles') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'student_profiles'
         and column_name = 'user_id'
     ) then
    raise exception 'student_profiles schema conflict: table exists but user_id column is missing';
  end if;
end
$$;

create table if not exists public.student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enrollment_tier text[] not null default array['free']::text[],
  enrollment_status text not null default 'stale',
  enrollment_verified_at timestamptz,
  enrollment_source_version text default 'ld-v1',
  enrollment_grace_expires_at timestamptz,
  last_enrollment_sync_attempt_at timestamptz,
  last_enrollment_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_profiles
  add column if not exists enrollment_tier text[] not null default array['free']::text[];

alter table public.student_profiles
  add column if not exists enrollment_status text not null default 'stale';

alter table public.student_profiles
  add column if not exists enrollment_verified_at timestamptz;

alter table public.student_profiles
  add column if not exists enrollment_source_version text default 'ld-v1';

alter table public.student_profiles
  add column if not exists enrollment_grace_expires_at timestamptz;

alter table public.student_profiles
  add column if not exists last_enrollment_sync_attempt_at timestamptz;

alter table public.student_profiles
  add column if not exists last_enrollment_error text;

alter table public.student_profiles
  add column if not exists created_at timestamptz not null default now();

alter table public.student_profiles
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_profiles_enrollment_status_chk'
      and conrelid = 'public.student_profiles'::regclass
  ) then
    alter table public.student_profiles
      add constraint student_profiles_enrollment_status_chk
      check (enrollment_status in ('active', 'inactive', 'stale'));
  end if;
end
$$;

create index if not exists idx_student_profiles_enrollment_tier_gin
  on public.student_profiles using gin (enrollment_tier);

create index if not exists idx_student_profiles_enrollment_status_verified_desc
  on public.student_profiles (enrollment_status, enrollment_verified_at desc);

create or replace function public.student_profiles_set_updated_at()
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
    select 1
    from pg_trigger
    where tgname = 'trg_student_profiles_set_updated_at'
      and tgrelid = 'public.student_profiles'::regclass
  ) then
    create trigger trg_student_profiles_set_updated_at
      before update on public.student_profiles
      for each row
      execute function public.student_profiles_set_updated_at();
  end if;
end
$$;

alter table public.student_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'student_profiles'
      and policyname = 'student_profiles_select_own'
  ) then
    create policy student_profiles_select_own
      on public.student_profiles
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'student_profiles'
      and policyname = 'student_profiles_service_role_all'
  ) then
    create policy student_profiles_service_role_all
      on public.student_profiles
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

grant select on public.student_profiles to authenticated;
grant select, insert, update, delete on public.student_profiles to service_role;
revoke insert, update, delete on public.student_profiles from authenticated;

commit;
