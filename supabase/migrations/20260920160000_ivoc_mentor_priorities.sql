begin;

create table public.ivoc_mentor_priority_sets (
  subject_id text not null check (subject_id ~ '^wp:[1-9][0-9]{0,19}$'),
  version integer not null check (version > 0),
  priorities jsonb not null default '[]'::jsonb
    check (jsonb_typeof(priorities) = 'array' and jsonb_array_length(priorities) <= 3),
  mentor_notes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(mentor_notes) = 'array' and jsonb_array_length(mentor_notes) <= 12),
  set_by text not null check (set_by ~ '^wp:[1-9][0-9]{0,19}$'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (subject_id, version)
);

create index ivoc_mentor_priority_sets_subject_latest_idx
  on public.ivoc_mentor_priority_sets (subject_id, version desc);

create or replace function public.ivoc_write_mentor_priorities(
  p_subject_id text,
  p_expected_version integer,
  p_priorities jsonb,
  p_mentor_notes jsonb,
  p_actor text
) returns table (
  subject_id text,
  version integer,
  priorities jsonb,
  mentor_notes jsonb,
  set_by text,
  created_at timestamptz
) language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  current_version integer;
  next_version integer;
begin
  if p_subject_id is null or p_subject_id !~ '^wp:[1-9][0-9]{0,19}$'
     or p_expected_version is null or p_expected_version < 0
     or p_actor is null or p_actor !~ '^wp:[1-9][0-9]{0,19}$'
     or p_priorities is null or jsonb_typeof(p_priorities) <> 'array'
     or jsonb_array_length(p_priorities) > 3
     or p_mentor_notes is null or jsonb_typeof(p_mentor_notes) <> 'array'
     or jsonb_array_length(p_mentor_notes) > 12 then
    raise exception 'ivoc_mentor_priorities_input_invalid' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_priorities) item
    where jsonb_typeof(item) <> 'object'
       or coalesce(item->>'id', '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
       or char_length(btrim(coalesce(item->>'text', ''))) not between 3 and 500
       or coalesce(item->>'rank', '') !~ '^[1-3]$'
  ) or (
    select count(*) <> count(distinct item->>'id')
    from jsonb_array_elements(p_priorities) item
  ) or (
    select count(*) <> count(distinct item->>'rank')
    from jsonb_array_elements(p_priorities) item
  ) then
    raise exception 'ivoc_mentor_priorities_input_invalid' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_mentor_notes) item
    where jsonb_typeof(item) <> 'object'
       or coalesce(item->>'id', '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
       or char_length(btrim(coalesce(item->>'text', ''))) not between 3 and 500
       or coalesce(item->>'visibility', '') not in ('shared', 'mentor_only')
  ) or (
    select count(*) <> count(distinct item->>'id')
    from jsonb_array_elements(p_mentor_notes) item
  ) then
    raise exception 'ivoc_mentor_priorities_input_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_subject_id, 4901));

  select max(existing.version) into current_version
  from public.ivoc_mentor_priority_sets existing
  where existing.subject_id = p_subject_id;
  current_version := coalesce(current_version, 0);
  if current_version <> p_expected_version then
    raise exception 'ivoc_mentor_priorities_version_conflict' using errcode = 'P0001';
  end if;

  next_version := current_version + 1;
  insert into public.ivoc_mentor_priority_sets (
    subject_id, version, priorities, mentor_notes, set_by
  ) values (
    p_subject_id, next_version, p_priorities, p_mentor_notes, p_actor
  );

  return query
  select current.subject_id, current.version, current.priorities,
    current.mentor_notes, current.set_by, current.created_at
  from public.ivoc_mentor_priority_sets current
  where current.subject_id = p_subject_id and current.version = next_version;
end;
$$;

alter table public.ivoc_mentor_priority_sets enable row level security;
alter table public.ivoc_mentor_priority_sets force row level security;

revoke all on table public.ivoc_mentor_priority_sets from public, anon, authenticated, service_role;
grant select, insert on table public.ivoc_mentor_priority_sets to service_role;

revoke all on function public.ivoc_write_mentor_priorities(
  text, integer, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.ivoc_write_mentor_priorities(
  text, integer, jsonb, jsonb, text
) to service_role;

comment on table public.ivoc_mentor_priority_sets is
  'Append-only, versioned IVOC-owned Mentor Top 3 and bounded mentor-note projections.';

commit;
