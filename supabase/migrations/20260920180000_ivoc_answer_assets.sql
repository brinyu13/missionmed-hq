begin;

create table public.ivoc_answer_asset_versions (
  asset_id uuid not null,
  version integer not null check (version > 0),
  schema_name text not null default 'ivoc.answer_asset.v1'
    check (schema_name = 'ivoc.answer_asset.v1'),
  owner_subject text not null check (owner_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  session_id uuid not null references public.ivoc_sessions(id),
  recording_id uuid not null references public.ivoc_recordings(id),
  answer_segment_id text not null references public.ivoc_answer_segments(segment_id),
  question_id text not null check (char_length(question_id) between 1 and 120),
  title text not null check (char_length(title) between 3 and 160),
  start_ms bigint not null check (start_ms >= 0),
  end_ms bigint not null check (end_ms > start_ms),
  status text not null check (status in ('private', 'match_bridge_ready', 'revoked')),
  audiences text[] not null default array['student']::text[]
    check (cardinality(audiences) <= 3
      and audiences <@ array['student', 'mentor', 'match_bridge']::text[]),
  consent jsonb not null default '{}'::jsonb check (jsonb_typeof(consent) = 'object'),
  strongest_answer boolean not null default false,
  change_reason text not null check (char_length(change_reason) between 3 and 400),
  changed_by text not null check (changed_by ~ '^wp:[1-9][0-9]{0,19}$'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (asset_id, version)
);

create index ivoc_answer_asset_versions_owner_latest_idx
  on public.ivoc_answer_asset_versions (owner_subject, asset_id, version desc);
create index ivoc_answer_asset_versions_session_idx
  on public.ivoc_answer_asset_versions (session_id, created_at desc);

create or replace function public.ivoc_write_answer_asset(
  p_asset_id uuid,
  p_expected_version integer,
  p_owner_subject text,
  p_session_id uuid,
  p_recording_id uuid,
  p_answer_segment_id text,
  p_question_id text,
  p_title text,
  p_start_ms bigint,
  p_end_ms bigint,
  p_status text,
  p_audiences text[],
  p_consent jsonb,
  p_strongest_answer boolean,
  p_change_reason text,
  p_actor text
) returns table (
  asset_id uuid,
  version integer,
  schema_name text,
  owner_subject text,
  session_id uuid,
  recording_id uuid,
  answer_segment_id text,
  question_id text,
  title text,
  start_ms bigint,
  end_ms bigint,
  status text,
  audiences text[],
  consent jsonb,
  strongest_answer boolean,
  change_reason text,
  changed_by text,
  created_at timestamptz
) language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  current_asset public.ivoc_answer_asset_versions%rowtype;
  current_exists boolean;
  next_version integer;
  source_valid boolean;
begin
  if p_asset_id is null
     or p_expected_version is null or p_expected_version < 0
     or p_owner_subject is null or p_owner_subject !~ '^wp:[1-9][0-9]{0,19}$'
     or p_session_id is null or p_recording_id is null
     or p_answer_segment_id is null or char_length(p_answer_segment_id) not between 1 and 160
     or p_question_id is null or char_length(p_question_id) not between 1 and 120
     or p_title is null or char_length(btrim(p_title)) not between 3 and 160
     or p_start_ms is null or p_start_ms < 0
     or p_end_ms is null or p_end_ms <= p_start_ms
     or p_status is null or p_status not in ('private', 'match_bridge_ready', 'revoked')
     or p_audiences is null or cardinality(p_audiences) > 3
     or not (p_audiences <@ array['student', 'mentor', 'match_bridge']::text[])
     or p_consent is null or jsonb_typeof(p_consent) <> 'object'
     or p_strongest_answer is null
     or p_change_reason is null or char_length(btrim(p_change_reason)) not between 3 and 400
     or p_actor is null or p_actor !~ '^wp:[1-9][0-9]{0,19}$'
     or p_actor <> p_owner_subject then
    raise exception 'ivoc_answer_asset_input_invalid' using errcode = '22023';
  end if;

  if p_status = 'private' and (
       not ('student' = any(p_audiences)) or 'match_bridge' = any(p_audiences)
     ) then
    raise exception 'ivoc_answer_asset_private_audience_invalid' using errcode = '22023';
  end if;
  if p_status = 'match_bridge_ready' and (
       not ('student' = any(p_audiences))
       or not ('match_bridge' = any(p_audiences))
       or p_consent->>'granted' <> 'true'
       or p_consent->>'scope' <> 'bounded_clip'
       or coalesce(p_consent->>'granted_at', '') = ''
     ) then
    raise exception 'ivoc_answer_asset_consent_required' using errcode = '22023';
  end if;
  if p_status = 'revoked' and cardinality(p_audiences) <> 0 then
    raise exception 'ivoc_answer_asset_revoked_audience_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_asset_id::text, 4903));
  select versions.* into current_asset
  from public.ivoc_answer_asset_versions versions
  where versions.asset_id = p_asset_id
  order by versions.version desc
  limit 1;
  current_exists := found;

  if not current_exists then
    if p_expected_version <> 0 then
      raise exception 'ivoc_answer_asset_version_conflict' using errcode = 'P0001';
    end if;
  elsif current_asset.version <> p_expected_version then
    raise exception 'ivoc_answer_asset_version_conflict' using errcode = 'P0001';
  elsif current_asset.status = 'revoked' then
    raise exception 'ivoc_answer_asset_revoked' using errcode = 'P0001';
  elsif current_asset.owner_subject <> p_owner_subject
     or current_asset.session_id <> p_session_id
     or current_asset.recording_id <> p_recording_id
     or current_asset.answer_segment_id <> p_answer_segment_id then
    raise exception 'ivoc_answer_asset_source_immutable' using errcode = 'P0001';
  elsif current_asset.status = 'match_bridge_ready' and p_status <> 'revoked' then
    raise exception 'ivoc_answer_asset_ready_requires_revocation' using errcode = 'P0001';
  end if;

  -- Revocation must remain available even if private media later becomes
  -- unavailable. Every creation/promotion still revalidates the bounded source.
  if p_status <> 'revoked' or not current_exists then
    select exists (
      select 1
      from public.ivoc_sessions session_row
      join public.ivoc_recordings recording
        on recording.id = p_recording_id
       and recording.session_id = session_row.id
       and recording.owner_subject = session_row.owner_subject
       and recording.status = 'saved'
      join public.ivoc_answer_segments segment
        on segment.segment_id = p_answer_segment_id
       and segment.session_id = session_row.id
       and segment.subject_id = session_row.owner_subject
       and segment.media_ref = 'recording:' || p_recording_id::text
      where session_row.id = p_session_id
        and session_row.owner_subject = p_owner_subject
        and p_start_ms >= (segment.answer->>'t_start_ms')::bigint
        and p_end_ms <= (segment.answer->>'t_end_ms')::bigint
        and p_end_ms <= recording.duration_ms
        and coalesce(segment.question->>'canonical_question_id', session_row.question_id) = p_question_id
    ) into source_valid;
    if source_valid is not true then
      raise exception 'ivoc_answer_asset_source_invalid' using errcode = 'P0001';
    end if;
  end if;

  next_version := coalesce(current_asset.version, 0) + 1;
  insert into public.ivoc_answer_asset_versions (
    asset_id, version, owner_subject, session_id, recording_id,
    answer_segment_id, question_id, title, start_ms, end_ms, status,
    audiences, consent, strongest_answer, change_reason, changed_by
  ) values (
    p_asset_id, next_version, p_owner_subject, p_session_id, p_recording_id,
    p_answer_segment_id, p_question_id, btrim(p_title), p_start_ms, p_end_ms,
    p_status, p_audiences, p_consent, p_strongest_answer,
    btrim(p_change_reason), p_actor
  );

  return query
  select written.asset_id, written.version, written.schema_name,
    written.owner_subject, written.session_id, written.recording_id,
    written.answer_segment_id, written.question_id, written.title,
    written.start_ms, written.end_ms, written.status, written.audiences,
    written.consent, written.strongest_answer, written.change_reason,
    written.changed_by, written.created_at
  from public.ivoc_answer_asset_versions written
  where written.asset_id = p_asset_id and written.version = next_version;
end;
$$;

alter table public.ivoc_answer_asset_versions enable row level security;
alter table public.ivoc_answer_asset_versions force row level security;

revoke all on table public.ivoc_answer_asset_versions from public, anon, authenticated, service_role;
grant select, insert on table public.ivoc_answer_asset_versions to service_role;

revoke all on function public.ivoc_write_answer_asset(
  uuid, integer, text, uuid, uuid, text, text, text, bigint, bigint,
  text, text[], jsonb, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.ivoc_write_answer_asset(
  uuid, integer, text, uuid, uuid, text, text, text, bigint, bigint,
  text, text[], jsonb, boolean, text, text
) to service_role;

comment on table public.ivoc_answer_asset_versions is
  'Append-only owner-consented bounded IVOC AnswerAsset versions; whole recordings are never shared by default.';

commit;
