begin;

create table public.ivoc_question_registry (
  question_id text primary key
    check (question_id ~ '^[A-Z0-9][A-Z0-9._:-]{1,119}$'),
  status text not null default 'active'
    check (status in ('active', 'hidden', 'retired')),
  current_version integer not null check (current_version > 0),
  created_by text not null check (created_by ~ '^wp:[1-9][0-9]{0,19}$'),
  updated_by text not null check (updated_by ~ '^wp:[1-9][0-9]{0,19}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.ivoc_question_versions (
  question_id text not null references public.ivoc_question_registry(question_id) on delete restrict,
  version integer not null check (version > 0),
  canonical_text text not null check (char_length(canonical_text) between 3 and 1000),
  category text not null check (char_length(category) between 1 and 120),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  source text not null check (source ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  change_reason text not null check (char_length(change_reason) between 3 and 400),
  changed_by text not null check (changed_by ~ '^wp:[1-9][0-9]{0,19}$'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (question_id, version)
);

create index ivoc_question_registry_status_updated_idx
  on public.ivoc_question_registry (status, updated_at desc);
create index ivoc_question_versions_changed_by_created_idx
  on public.ivoc_question_versions (changed_by, created_at desc);

create view public.ivoc_question_catalog
with (security_invoker = true) as
select
  registry.question_id,
  registry.status,
  registry.current_version,
  registry.created_by,
  registry.updated_by,
  registry.created_at,
  registry.updated_at,
  version.canonical_text,
  version.category,
  version.tags,
  version.source,
  version.change_reason,
  version.changed_by,
  version.created_at as version_created_at
from public.ivoc_question_registry registry
join public.ivoc_question_versions version
  on version.question_id = registry.question_id
 and version.version = registry.current_version;

create or replace function public.ivoc_write_question_version(
  p_question_id text,
  p_expected_version integer,
  p_status text,
  p_canonical_text text,
  p_category text,
  p_tags jsonb,
  p_source text,
  p_change_reason text,
  p_actor text
) returns table (
  question_id text,
  status text,
  current_version integer,
  canonical_text text,
  category text,
  tags jsonb,
  source text,
  change_reason text,
  changed_by text,
  updated_at timestamptz
) language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  existing public.ivoc_question_registry%rowtype;
  next_version integer;
begin
  if p_question_id is null or p_question_id !~ '^[A-Z0-9][A-Z0-9._:-]{1,119}$'
     or p_expected_version is null or p_expected_version < 0
     or p_status not in ('active', 'hidden', 'retired')
     or p_canonical_text is null or char_length(btrim(p_canonical_text)) not between 3 and 1000
     or p_category is null or char_length(btrim(p_category)) not between 1 and 120
     or p_tags is null or jsonb_typeof(p_tags) <> 'array' or jsonb_array_length(p_tags) > 24
     or p_source is null or p_source !~ '^[a-z0-9][a-z0-9_-]{0,79}$'
     or p_change_reason is null or char_length(btrim(p_change_reason)) not between 3 and 400
     or p_actor is null or p_actor !~ '^wp:[1-9][0-9]{0,19}$' then
    raise exception 'ivoc_question_input_invalid' using errcode = '22023';
  end if;

  select * into existing
  from public.ivoc_question_registry registry
  where registry.question_id = p_question_id
  for update;

  if found then
    if existing.current_version <> p_expected_version then
      raise exception 'ivoc_question_version_conflict' using errcode = '40001';
    end if;
    if existing.status = 'retired' and p_status <> 'retired' then
      raise exception 'ivoc_question_retired' using errcode = '22023';
    end if;
    next_version := existing.current_version + 1;
    update public.ivoc_question_registry registry
    set status = p_status, current_version = next_version,
        updated_by = p_actor, updated_at = clock_timestamp()
    where registry.question_id = p_question_id;
  else
    if p_expected_version <> 0 then
      raise exception 'ivoc_question_version_conflict' using errcode = '40001';
    end if;
    next_version := 1;
    insert into public.ivoc_question_registry (
      question_id, status, current_version, created_by, updated_by
    ) values (
      p_question_id, p_status, next_version, p_actor, p_actor
    );
  end if;

  insert into public.ivoc_question_versions (
    question_id, version, canonical_text, category, tags, source,
    change_reason, changed_by
  ) values (
    p_question_id, next_version, btrim(p_canonical_text), btrim(p_category),
    p_tags, p_source, btrim(p_change_reason), p_actor
  );

  return query
  select catalog.question_id, catalog.status, catalog.current_version,
    catalog.canonical_text, catalog.category, catalog.tags, catalog.source,
    catalog.change_reason, catalog.changed_by, catalog.updated_at
  from public.ivoc_question_catalog catalog
  where catalog.question_id = p_question_id;
end;
$$;

alter table public.ivoc_question_registry enable row level security;
alter table public.ivoc_question_registry force row level security;
alter table public.ivoc_question_versions enable row level security;
alter table public.ivoc_question_versions force row level security;

revoke all on table public.ivoc_question_registry from public, anon, authenticated, service_role;
revoke all on table public.ivoc_question_versions from public, anon, authenticated, service_role;
revoke all on table public.ivoc_question_catalog from public, anon, authenticated, service_role;
grant select, insert, update on table public.ivoc_question_registry to service_role;
grant select, insert on table public.ivoc_question_versions to service_role;
grant select on table public.ivoc_question_catalog to service_role;

revoke all on function public.ivoc_write_question_version(
  text, integer, text, text, text, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.ivoc_write_question_version(
  text, integer, text, text, text, jsonb, text, text, text
) to service_role;

comment on table public.ivoc_question_registry is
  'Stable IVOC question identities and current lifecycle state; destructive deletion is intentionally unsupported.';
comment on table public.ivoc_question_versions is
  'Append-only snapshots for every Admin question add, edit, hide, and retirement.';

commit;
