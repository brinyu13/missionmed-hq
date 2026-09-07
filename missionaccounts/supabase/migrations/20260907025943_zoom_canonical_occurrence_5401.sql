alter table missionaccounts.session
  add column canonical_status text not null default 'active'
  check (canonical_status in ('active', 'duplicate', 'review'));

create table missionaccounts.zoom_session_canonicalization (
  id uuid primary key default gen_random_uuid(),
  source_session_id uuid not null references missionaccounts.session(id),
  canonical_session_id uuid references missionaccounts.session(id),
  disposition text not null
    check (disposition in ('active', 'duplicate', 'review')),
  rule_version text not null,
  evidence jsonb not null default '{}'::jsonb,
  request_id text not null unique,
  superseded_by_id uuid
    references missionaccounts.zoom_session_canonicalization(id),
  created_at timestamptz not null default now(),
  check (
    (
      disposition = 'active'
      and canonical_session_id is not null
      and canonical_session_id = source_session_id
    )
    or (
      disposition = 'duplicate'
      and canonical_session_id is not null
      and canonical_session_id <> source_session_id
    )
    or (
      disposition = 'review'
      and canonical_session_id is null
    )
  )
);

create unique index zoom_session_one_current_canonicalization
on missionaccounts.zoom_session_canonicalization(source_session_id)
where superseded_by_id is null;

create table missionaccounts.zoom_source_corroboration (
  id uuid primary key default gen_random_uuid(),
  source_row_id uuid not null
    references missionaccounts.attendance_source_row(id),
  canonicalization_id uuid not null
    references missionaccounts.zoom_session_canonicalization(id),
  canonical_session_id uuid not null references missionaccounts.session(id),
  counterpart_source_row_id uuid
    references missionaccounts.attendance_source_row(id),
  attendance_event_id uuid references missionaccounts.attendance_event(id),
  disposition text not null
    check (disposition in ('exact_occurrence', 'unresolved_occurrence')),
  evidence jsonb not null default '{}'::jsonb,
  request_id text not null unique,
  superseded_by_id uuid
    references missionaccounts.zoom_source_corroboration(id),
  created_at timestamptz not null default now(),
  check (
    (
      disposition = 'exact_occurrence'
      and counterpart_source_row_id is not null
      and attendance_event_id is not null
    )
    or (
      disposition = 'unresolved_occurrence'
      and counterpart_source_row_id is null
      and attendance_event_id is null
    )
  )
);

create unique index zoom_source_one_current_corroboration
on missionaccounts.zoom_source_corroboration(source_row_id)
where superseded_by_id is null;

create table missionaccounts.zoom_shadow_retirement (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  reason text not null
    check (reason = 'duplicate_canonicalization_artifact'),
  reversed_at timestamptz,
  reversal_request_id text,
  check ((reversed_at is null) = (reversal_request_id is null)),
  evidence jsonb not null,
  request_id text not null unique,
  superseded_by_id uuid
    references missionaccounts.zoom_shadow_retirement(id),
  created_at timestamptz not null default now()
);

create unique index zoom_shadow_one_current_retirement
on missionaccounts.zoom_shadow_retirement(student_id)
where superseded_by_id is null and reversed_at is null;

alter table missionaccounts.zoom_session_canonicalization
  enable row level security;
alter table missionaccounts.zoom_session_canonicalization
  force row level security;
alter table missionaccounts.zoom_source_corroboration
  enable row level security;
alter table missionaccounts.zoom_source_corroboration
  force row level security;
alter table missionaccounts.zoom_shadow_retirement
  enable row level security;
alter table missionaccounts.zoom_shadow_retirement
  force row level security;

revoke all on
  missionaccounts.zoom_session_canonicalization,
  missionaccounts.zoom_source_corroboration,
  missionaccounts.zoom_shadow_retirement
from public, anon, authenticated;

grant select, insert, update on
  missionaccounts.zoom_session_canonicalization,
  missionaccounts.zoom_source_corroboration,
  missionaccounts.zoom_shadow_retirement
to service_role;

create function missionaccounts.zoom_occurrence_name(p_name text)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select lower(btrim(regexp_replace(p_name, '[[:space:]]+', ' ', 'g')))
$$;

create function missionaccounts.zoom_is_custodied_history(p_session_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, missionaccounts
as $$
  select exists (
    select 1
    from missionaccounts.session s
    join missionaccounts.source_artifact source_artifact
      on source_artifact.id = s.source_artifact_id
    where s.id = p_session_id
      and s.provider = 'zoom'
      and s.source_payload @>
        '{"historical_import":true,"confirmed_by_5000b":true}'::jsonb
      and source_artifact.source_kind = 'zoom_csv'
      and exists (
        select 1
        from missionaccounts.attendance_source_row r
        join missionaccounts.import_run imported
          on imported.id = r.import_run_id
        join missionaccounts.source_artifact ledger
          on ledger.id = imported.artifact_id
        where r.session_id = s.id
          and imported.state = 'applied'
          and ledger.source_kind = 'reconciled_ledger'
          and ledger.sha256 =
            '6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108'
      )
  )
$$;

create function missionaccounts.assert_student_not_zoom_retired(
  p_student_id uuid
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
begin
  -- Serialize new dependent writes with the bounded retirement lock.
  perform 1 from missionaccounts.student s where s.id=p_student_id for key share;
  if exists (
    select 1
    from missionaccounts.zoom_shadow_retirement retirement
    where retirement.student_id = p_student_id
      and retirement.superseded_by_id is null and retirement.reversed_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'student_is_retired_technical_projection';
  end if;
end;
$$;

revoke execute on function
  missionaccounts.zoom_occurrence_name(text),
  missionaccounts.zoom_is_custodied_history(uuid),
  missionaccounts.assert_student_not_zoom_retired(uuid)
from public, anon, authenticated;

grant execute on function
  missionaccounts.zoom_occurrence_name(text),
  missionaccounts.zoom_is_custodied_history(uuid),
  missionaccounts.assert_student_not_zoom_retired(uuid)
to service_role;

create function missionaccounts.api_canonicalize_zoom_import(
  p_import_run_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  import_row missionaccounts.import_run%rowtype;
  source_session missionaccounts.session%rowtype;
  mapping missionaccounts.zoom_session_canonicalization%rowtype;
  source_row missionaccounts.attendance_source_row%rowtype;

  source_is_history boolean;
  mapping_found boolean;
  history_exact_count integer;
  history_strong_count integer;
  exact_peer_exists boolean;
  strong_peer_exists boolean;
  duplicate_target uuid;
  new_disposition text;
  new_target uuid;

  counterpart_rows integer;
  counterpart_events integer;
  counterpart_row_id uuid;
  counterpart_event_id uuid;
  is_exact_occurrence boolean;
  inserted_count integer;

  mappings_created integer := 0;
  corroborations_created integer := 0;
  unresolved_created integer := 0;
  active_sources integer := 0;
  duplicate_sources integer := 0;
  review_sources integer := 0;
  controls jsonb;
begin
  if p_import_run_id is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using
      errcode = '22023',
      message = 'zoom_canonicalization_import_and_request_required';
  end if;

  select * into import_row
  from missionaccounts.import_run
  where id = p_import_run_id
  for update;

  if not found or import_row.state <> 'applied' then
    raise exception using
      errcode = '23503',
      message = 'applied_zoom_import_not_found';
  end if;

  if not exists (
    select 1
    from missionaccounts.source_artifact artifact
    where artifact.id = import_row.artifact_id
      and artifact.source_kind = 'zoom_api_window'
  ) then
    raise exception using
      errcode = '22023',
      message = 'zoom_canonicalization_requires_zoom_artifact';
  end if;

  for source_session in
    select s.*
    from missionaccounts.session s
    where s.provider = 'zoom'
      and exists (
        select 1
        from missionaccounts.attendance_source_row r
        where r.import_run_id = p_import_run_id
          and r.session_id = s.id
      )
    order by s.held_on, s.step, s.starts_at, s.id
  loop
    -- One configured MissionAccounts Drills provider context. Cross-key
    -- automatic merging below is restricted to the bound historical ledger.
    perform pg_advisory_xact_lock(hashtextextended(
      'missionaccounts:zoom-class:drills:' ||
      source_session.held_on::text || ':' ||
      coalesce(source_session.step, 'unknown'),
      0
    ));

    -- Refresh after acquiring the class lock.
    select * into source_session
    from missionaccounts.session
    where id = source_session.id
    for no key update;

    source_is_history :=
      missionaccounts.zoom_is_custodied_history(source_session.id);

    select * into mapping
    from missionaccounts.zoom_session_canonicalization
    where source_session_id = source_session.id
      and superseded_by_id is null
    for update;
    mapping_found := found;

    if not mapping_found then
      if source_session.superseded_by_id is not null then
        raise exception using
          errcode = '23514',
          message = 'unmapped_superseded_zoom_source';
      end if;

      new_disposition := null;
      new_target := null;
      duplicate_target := null;
      history_exact_count := 0;
      history_strong_count := 0;
      exact_peer_exists := false;
      strong_peer_exists := false;

      if source_session.state <> 'confirmed'
         or source_session.step not in ('s1', 's23') then
        new_disposition := 'review';

      elsif source_is_history then
        -- An API observation can hit an existing historical provider key.
        -- The class remains active, but its API rows are corroboration only.
        new_disposition := 'active';
        new_target := source_session.id;

      else
        with incoming_rows as (
          select distinct
            r.joined_at,
            r.left_at,
            missionaccounts.zoom_occurrence_name(r.display_name) as norm_name
          from missionaccounts.attendance_source_row r
          where r.import_run_id = p_import_run_id
            and r.session_id = source_session.id
        ),
        incoming_intervals as (
          select distinct joined_at, left_at
          from incoming_rows
        ),
        peers as (
          select
            p.id,
            p.starts_at,
            missionaccounts.zoom_is_custodied_history(p.id) as historical
          from missionaccounts.session p
          where p.id <> source_session.id
            and p.provider = 'zoom'
            and p.cycle_key = source_session.cycle_key
            and p.held_on = source_session.held_on
            and p.step = source_session.step
            and p.state = 'confirmed'
            and p.canonical_status = 'active'
            and p.superseded_by_id is null
        ),
        peer_rows as (
          select distinct
            p.id as session_id,
            r.joined_at,
            r.left_at,
            missionaccounts.zoom_occurrence_name(r.display_name) as norm_name
          from peers p
          join missionaccounts.attendance_source_row r
            on r.session_id = p.id
          join missionaccounts.import_run imported
            on imported.id = r.import_run_id
          join missionaccounts.source_artifact artifact
            on artifact.id = imported.artifact_id
          where not p.historical
             or (
               artifact.source_kind = 'reconciled_ledger'
               and artifact.sha256 =
                 '6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108'
             )
        ),
        peer_intervals as (
          select distinct session_id, joined_at, left_at
          from peer_rows
        ),
        evaluated as (
          select
            p.*,
            (
              (select count(*) from incoming_intervals) >= 16
              and not exists (
                select 1
                from incoming_intervals i
                where i.joined_at is null
                   or i.left_at is null
                   or i.left_at < i.joined_at
              )
              and not exists (
                select joined_at, left_at from incoming_intervals
                except
                select joined_at, left_at
                from peer_intervals
                where session_id = p.id
              )
              and not exists (
                select joined_at, left_at
                from peer_intervals
                where session_id = p.id
                except
                select joined_at, left_at from incoming_intervals
              )
              and (
                select count(*)
                from incoming_rows i
                where exists (
                  select 1
                  from peer_rows h
                  where h.session_id = p.id
                    and h.joined_at = i.joined_at
                    and h.left_at = i.left_at
                    and h.norm_name = i.norm_name
                )
              ) * 10 >=
                (select count(*) from incoming_rows) * 9
            ) as strong_occurrence_set
          from peers p
        )
        select
          count(*) filter (
            where historical
              and starts_at = source_session.starts_at
          )::integer,
          count(*) filter (
            where historical
              and starts_at = source_session.starts_at
              and strong_occurrence_set
          )::integer,
          min(case
            when historical
              and starts_at = source_session.starts_at
              and strong_occurrence_set
            then id::text
          end)::uuid,
          coalesce(bool_or(
            starts_at = source_session.starts_at
          ), false),
          coalesce(bool_or(strong_occurrence_set), false)
        into
          history_exact_count,
          history_strong_count,
          duplicate_target,
          exact_peer_exists,
          strong_peer_exists
        from evaluated;

        if history_exact_count = 1
           and history_strong_count = 1
           and source_session.source_payload
             ->'classification'->>'rule' =
             'weekday_11_45_to_16_00_et_and_participants_over_15_ignore_duration'
        then
          new_disposition := 'duplicate';
          new_target := duplicate_target;

        elsif exact_peer_exists or strong_peer_exists then
          -- Includes multiple historical candidates, timestamp-shifted
          -- occurrence matches and unproven API/API equivalence.
          new_disposition := 'review';

        else
          new_disposition := 'active';
          new_target := source_session.id;
        end if;
      end if;

      insert into missionaccounts.zoom_session_canonicalization(
        source_session_id,
        canonical_session_id,
        disposition,
        rule_version,
        evidence,
        request_id
      ) values (
        source_session.id,
        new_target,
        new_disposition,
        '5401r-exact-historical-v1',
        jsonb_build_object(
          'import_run_id', p_import_run_id,
          'historical_exact_candidates', history_exact_count,
          'historical_strong_candidates', history_strong_count,
          'exact_peer_exists', exact_peer_exists,
          'strong_peer_exists', strong_peer_exists,
          'minimum_distinct_intervals', 16,
          'minimum_exact_name_ratio', 0.9,
          'automatic_person_identity_decision', false
        ),
        p_request_id || ':session:' || source_session.id::text
      ) returning * into mapping;

      update missionaccounts.session
      set canonical_status = new_disposition,
          superseded_by_id = case
            when new_disposition = 'duplicate' then new_target
            else null
          end
      where id = source_session.id;

      mappings_created := mappings_created + 1;
    end if;

    if mapping.disposition = 'active' then
      active_sources := active_sources + 1;
    elsif mapping.disposition = 'duplicate' then
      duplicate_sources := duplicate_sources + 1;
    else
      review_sources := review_sources + 1;
    end if;

    if mapping.disposition = 'review' then
      continue;
    end if;

    if not exists (
      select 1
      from missionaccounts.session canonical
      where canonical.id = mapping.canonical_session_id
        and canonical.state = 'confirmed'
        and canonical.canonical_status = 'active'
        and canonical.superseded_by_id is null
    ) then
      raise exception using
        errcode = '23514',
        message = 'zoom_canonical_target_is_not_active';
    end if;

    for source_row in
      select r.*
      from missionaccounts.attendance_source_row r
      where r.import_run_id = p_import_run_id
        and r.session_id = source_session.id
      order by r.id
    loop
      if exists (
        select 1
        from missionaccounts.zoom_source_corroboration existing
        where existing.source_row_id = source_row.id
          and existing.superseded_by_id is null
      ) then
        continue;
      end if;

      -- Only prior-import, event-linked evidence can corroborate an
      -- occurrence. Excluding this import prevents self-corroboration.
      select
        count(distinct h.id)::integer,
        count(distinct event.id)::integer,
        min(h.id::text)::uuid,
        min(event.id::text)::uuid
      into
        counterpart_rows,
        counterpart_events,
        counterpart_row_id,
        counterpart_event_id
      from missionaccounts.attendance_source_row h
      join missionaccounts.attendance_event_source_row link
        on link.source_row_id = h.id
      join missionaccounts.attendance_event event
        on event.id = link.attendance_event_id
       and event.session_id = mapping.canonical_session_id
       and event.superseded_by_id is null
       and event.interpretation_state in ('effective', 'needs_review')
      join missionaccounts.import_run imported
        on imported.id = h.import_run_id
      join missionaccounts.source_artifact artifact
        on artifact.id = imported.artifact_id
      where h.session_id = mapping.canonical_session_id
        and h.import_run_id <> p_import_run_id
        and h.joined_at = source_row.joined_at
        and h.left_at = source_row.left_at
        and missionaccounts.zoom_occurrence_name(h.display_name) =
          missionaccounts.zoom_occurrence_name(source_row.display_name)
        and (
          not missionaccounts.zoom_is_custodied_history(
            mapping.canonical_session_id
          )
          or (
            artifact.source_kind = 'reconciled_ledger'
            and artifact.sha256 =
              '6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108'
          )
        );

      is_exact_occurrence :=
        counterpart_rows = 1 and counterpart_events = 1;

      -- For a new canonical API class, a row with no prior occurrence is
      -- left for normal identity reconciliation. Duplicate/historical
      -- sources never create new identities, even without a name match.
      if not is_exact_occurrence
         and counterpart_events = 0
         and mapping.disposition = 'active'
         and not source_is_history
         and (
           not exists (
             select 1 from missionaccounts.attendance_source_row prior_observation
             where prior_observation.session_id = mapping.canonical_session_id
               and prior_observation.import_run_id <> p_import_run_id
           ) or (
             source_row.joined_at is not null and source_row.left_at > source_row.joined_at
             and nullif(btrim(source_row.participant_source_id),'') is not null
             and exists (
               select 1 from missionaccounts.attendance_source_row prior_row
               join missionaccounts.attendance_event_source_row link on link.source_row_id=prior_row.id
               where prior_row.session_id=mapping.canonical_session_id and prior_row.import_run_id<>p_import_run_id
                 and prior_row.participant_source_id=source_row.participant_source_id
                 and missionaccounts.zoom_occurrence_name(prior_row.display_name)=missionaccounts.zoom_occurrence_name(source_row.display_name)
             )
             and not exists (
               select 1 from missionaccounts.attendance_source_row prior_row
               join missionaccounts.attendance_event_source_row link on link.source_row_id=prior_row.id
               where prior_row.session_id=mapping.canonical_session_id and prior_row.id<>source_row.id
                 and prior_row.participant_source_id=source_row.participant_source_id
                 and (prior_row.joined_at is null or prior_row.left_at is null or
                   (source_row.joined_at<prior_row.left_at and source_row.left_at>prior_row.joined_at))
             )
             and not exists (
               select 1 from missionaccounts.attendance_source_row peer_row
               where peer_row.import_run_id=p_import_run_id and peer_row.id<>source_row.id
                 and peer_row.participant_source_id=source_row.participant_source_id
                 and (peer_row.joined_at is null or peer_row.left_at is null or
                   (source_row.joined_at<peer_row.left_at and source_row.left_at>peer_row.joined_at))
             )
           )
         ) then
        continue;
      end if;

      insert into missionaccounts.zoom_source_corroboration(
        source_row_id,
        canonicalization_id,
        canonical_session_id,
        counterpart_source_row_id,
        attendance_event_id,
        disposition,
        evidence,
        request_id
      ) values (
        source_row.id,
        mapping.id,
        mapping.canonical_session_id,
        case when is_exact_occurrence then counterpart_row_id end,
        case when is_exact_occurrence then counterpart_event_id end,
        case
          when is_exact_occurrence then 'exact_occurrence'
          else 'unresolved_occurrence'
        end,
        jsonb_build_object(
          'matching_prior_source_rows', counterpart_rows,
          'matching_prior_events', counterpart_events,
          'match_basis', 'normalized_name_join_leave_canonical_class',
          'automatic_person_identity_decision', false,
          'affects_duration_or_billing', false
        ),
        p_request_id || ':source:' || source_row.id::text
      )
      on conflict (source_row_id)
        where superseded_by_id is null
      do nothing;

      get diagnostics inserted_count = row_count;
      if is_exact_occurrence then
        corroborations_created :=
          corroborations_created + inserted_count;
      else
        unresolved_created := unresolved_created + inserted_count;
      end if;
    end loop;
  end loop;

  controls := jsonb_build_object(
    'accepted', true,
    'new_session_mappings', mappings_created,
    'active_source_sessions', active_sources,
    'duplicate_source_sessions', duplicate_sources,
    'review_source_sessions', review_sources,
    'new_exact_corroborations', corroborations_created,
    'new_unresolved_corroborations', unresolved_created,
    'identity_decisions_created', 0,
    'historical_students_recomputed', 0,
    'billing_mutations', 0
  );

  if mappings_created + corroborations_created + unresolved_created > 0 then
    insert into missionaccounts.audit_event(
      actor_id, actor_role, kind, text, to_val, reason, request_id
    ) values (
      'missionaccounts:zoom-canonicalization',
      'system',
      'zoom_sync.canonicalized',
      'Zoom source classes and occurrence corroboration classified before identity reconciliation',
      controls,
      'MX-MISSIONACCOUNTS-5401R exact historical custody rule',
      p_request_id || ':canonicalization:audit'
    );
  end if;

  return controls;
end;
$$;

revoke execute on function
  missionaccounts.api_canonicalize_zoom_import(uuid, text)
from public, anon, authenticated;

grant execute on function
  missionaccounts.api_canonicalize_zoom_import(uuid, text)
to service_role;

create or replace function missionaccounts.api_ingest_zoom_batch(
  p_request_id text,
  p_window_from timestamptz,
  p_window_to timestamptz,
  p_artifact jsonb,
  p_sessions jsonb,
  p_source_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  artifact_row missionaccounts.source_artifact%rowtype;
  import_row missionaccounts.import_run%rowtype;
  existing_run missionaccounts.import_run%rowtype;
  sync_id uuid;
  session_count integer;
  source_row_count integer;
  request_controls jsonb;
  v_result_controls jsonb;
begin
  if nullif(btrim(p_request_id), '') is null
     or p_window_from is null or p_window_to is null
     or p_window_to < p_window_from
     or p_window_to > p_window_from + interval '31 days'
     or jsonb_typeof(p_artifact) <> 'object'
     or coalesce(p_artifact->>'sha256', '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_artifact->>'source_path', '') !~ '^zoom-api://'
     or coalesce((p_artifact->>'byte_count')::bigint, -1) < 0
     or (p_artifact->>'observed_at') is null
     or jsonb_typeof(p_sessions) <> 'array'
     or jsonb_typeof(p_source_rows) <> 'array'
     or jsonb_array_length(p_sessions) > 1000
     or jsonb_array_length(p_source_rows) > 200000 then
    raise exception using errcode = '22023', message = 'invalid_zoom_ingestion_batch';
  end if;

  if exists (select 1 from jsonb_array_elements(p_source_rows) r
    where not exists (select 1 from jsonb_array_elements(p_sessions) s
      where s->>'provider_instance_id'=r->>'provider_instance_id')) then
    raise exception using errcode='22023',message='zoom_source_session_not_in_batch';
  end if;

  request_controls := jsonb_build_object(
    'provider', 'zoom',
    'window_from', p_window_from,
    'window_to', p_window_to,
    'artifact_sha256', p_artifact->>'sha256',
    'sessions', jsonb_array_length(p_sessions),
    'source_rows', jsonb_array_length(p_source_rows),
    'payload_fingerprint', encode(extensions.digest(jsonb_build_object(
      'sessions',(select coalesce(jsonb_agg(v order by v::text),'[]') from jsonb_array_elements(p_sessions) v),
      'source_rows',(select coalesce(jsonb_agg(v order by v::text),'[]') from jsonb_array_elements(p_source_rows) v)
    )::text,'sha256'),'hex')
  );

  select * into existing_run
  from missionaccounts.import_run
  where request_id = p_request_id;
  if found then
    if existing_run.source_controls is distinct from (case when existing_run.source_controls ? 'payload_fingerprint' then request_controls else request_controls - 'payload_fingerprint' end) then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    return existing_run.result_controls || jsonb_build_object(
      'accepted', existing_run.state = 'applied',
      'duplicate', true,
      'import_run_id', existing_run.id
    );
  end if;

  insert into missionaccounts.source_artifact(
    source_kind, source_path, sha256, byte_count, observed_at
  ) values (
    'zoom_api_window',
    p_artifact->>'source_path',
    p_artifact->>'sha256',
    (p_artifact->>'byte_count')::bigint,
    (p_artifact->>'observed_at')::timestamptz
  ) on conflict (source_kind, sha256) do nothing;

  select * into artifact_row
  from missionaccounts.source_artifact
  where source_kind = 'zoom_api_window' and sha256 = p_artifact->>'sha256';
  if not found then raise exception using errcode = '23503', message = 'zoom_source_artifact_not_found'; end if;
  if artifact_row.byte_count is distinct from (p_artifact->>'byte_count')::bigint then
    raise exception using errcode = '22023', message = 'zoom_source_artifact_binding_conflict';
  end if;

  insert into missionaccounts.import_run(
    artifact_id, request_id, state, source_controls
  ) values (
    artifact_row.id, p_request_id, 'validated', request_controls
  ) returning * into import_row;

  insert into missionaccounts.session(
    cycle_key, source_artifact_id, provider, provider_meeting_id,
    provider_instance_id, starts_at, held_on, time_zone, step, state, source_payload, canonical_status
  )
  select
    item->>'cycle_key', artifact_row.id, 'zoom',
    item->>'provider_meeting_id', item->>'provider_instance_id',
    (item->>'starts_at')::timestamptz, (item->>'held_on')::date,
    coalesce(nullif(item->>'time_zone', ''), 'America/New_York'),
    coalesce(nullif(item->>'step', ''), 'unknown'),
    coalesce(nullif(item->>'state', ''), 'candidate'),
    coalesce(item->'source_payload', '{}'::jsonb),
    'review'
  from jsonb_array_elements(p_sessions) item
  join missionaccounts.cycle c
    on c.key = item->>'cycle_key'
   and (item->>'held_on')::date between c.starts_on and c.ends_on
  on conflict (provider, provider_instance_id) do nothing;

  if exists (
    select 1
    from jsonb_array_elements(p_sessions) item
    left join missionaccounts.session s
      on s.provider = 'zoom' and s.provider_instance_id = item->>'provider_instance_id'
    where s.id is null
       or s.provider_meeting_id is distinct from item->>'provider_meeting_id'
       or s.cycle_key is distinct from item->>'cycle_key'
       or s.starts_at is distinct from (item->>'starts_at')::timestamptz
       or s.held_on is distinct from (item->>'held_on')::date
       or s.time_zone is distinct from coalesce(nullif(item->>'time_zone', ''), 'America/New_York')
       or s.step is distinct from coalesce(nullif(item->>'step', ''), 'unknown')
       or s.state is distinct from coalesce(nullif(item->>'state', ''), 'candidate')
  ) then
    raise exception using errcode = '22023', message = 'zoom_session_binding_conflict';
  end if;

  insert into missionaccounts.attendance_source_row(
    import_run_id, session_id, provider_source_id, participant_source_id,
    display_name, joined_at, left_at, duration_seconds, payload, payload_sha256
  )
  select
    import_row.id, s.id,
    item->>'provider_source_id', nullif(item->>'participant_source_id', ''),
    item->>'display_name',
    nullif(item->>'joined_at', '')::timestamptz,
    nullif(item->>'left_at', '')::timestamptz,
    nullif(item->>'duration_seconds', '')::integer,
    coalesce(item->'payload', '{}'::jsonb),
    item->>'payload_sha256'
  from jsonb_array_elements(p_source_rows) item
  join missionaccounts.session s
    on s.provider = 'zoom' and s.provider_instance_id = item->>'provider_instance_id';

  select count(*)::integer into session_count
  from missionaccounts.session s
  where s.provider = 'zoom'
    and exists (
      select 1 from jsonb_array_elements(p_sessions) item
      where item->>'provider_instance_id' = s.provider_instance_id
    );
  select count(*)::integer into source_row_count
  from missionaccounts.attendance_source_row
  where import_run_id = import_row.id;

  if session_count <> jsonb_array_length(p_sessions)
     or source_row_count <> jsonb_array_length(p_source_rows) then
    raise exception using errcode = '22023', message = 'zoom_ingestion_control_mismatch';
  end if;

  v_result_controls := jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'artifact_id', artifact_row.id,
    'import_run_id', import_row.id,
    'sessions', session_count,
    'source_rows', source_row_count,
    'attendance_events_created', 0,
    'identity_decisions_created', 0,
    'charges_created', 0
  );

  update missionaccounts.import_run
  set state = 'applied', result_controls = v_result_controls, finished_at = now()
  where id = import_row.id;

  insert into missionaccounts.sync_run(
    provider, window_from, window_to, state, stats, started_at, finished_at, request_id
  ) values (
    'zoom', p_window_from, p_window_to, 'ok', v_result_controls,
    coalesce((p_artifact->>'observed_at')::timestamptz, now()), now(), p_request_id
  ) returning id into sync_id;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, kind, text, to_val, reason, request_id
  ) values (
    'missionaccounts:zoom-sync', 'system', 'zoom_sync.ingested',
    'Zoom provider evidence batch ingested without identity or billing mutation',
    v_result_controls || jsonb_build_object('sync_run_id', sync_id),
    'Normalized ZoomAttendanceProvider batch', p_request_id || ':audit'
  );

  return v_result_controls || jsonb_build_object('sync_run_id', sync_id);
end;
$$;

create or replace function missionaccounts.api_reconcile_zoom_import(
  p_import_run_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, extensions, missionaccounts
as $$
declare
  import_row missionaccounts.import_run%rowtype;
  reconciliation_row missionaccounts.zoom_reconciliation_run%rowtype;
  source_record record;
  alias_row missionaccounts.identity_alias%rowtype;
  alias_found boolean;
  retired_alias_id uuid;
  canonicalization_controls jsonb;
  source_student missionaccounts.student%rowtype;
  source_key_value text;
  shadow_student_id uuid;
  event_id uuid;
  resolution_record record;
  recompute_student_id uuid;
  recompute_student_ids uuid[] := '{}'::uuid[];
  recompute_result jsonb;
  events_created integer := 0;
  source_links_created integer := 0;
  identities_created integer := 0;
  exact_identities_reused integer := 0;
  matched_source_rows integer := 0;
  review_source_rows integer := 0;
  excluded_source_rows integer := 0;
  nonconfirmed_source_rows integer := 0;
  recomputed_students integer := 0;
  stale_decisions integer := 0;
  v_result jsonb;
begin
  if p_import_run_id is null or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'zoom_reconciliation_import_and_request_required';
  end if;

  canonicalization_controls :=
    missionaccounts.api_canonicalize_zoom_import(
      p_import_run_id, p_request_id
    );

  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:zoom-reconciliation:request:' || p_request_id,
    0
  ));

  select * into reconciliation_row
  from missionaccounts.zoom_reconciliation_run
  where request_id = p_request_id or import_run_id = p_import_run_id
  order by (request_id = p_request_id) desc
  limit 1;
  if found then
    if reconciliation_row.import_run_id <> p_import_run_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    if reconciliation_row.state <> 'applied' then
      raise exception using errcode = '55000', message = 'zoom_reconciliation_not_applied';
    end if;
    return reconciliation_row.result_controls || jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'reconciliation_run_id', reconciliation_row.id,
      'canonicalization', canonicalization_controls
    );
  end if;

  select * into import_row
  from missionaccounts.import_run
  where id = p_import_run_id
  for update;
  if not found or import_row.state <> 'applied' then
    raise exception using errcode = '23503', message = 'applied_zoom_import_not_found';
  end if;
  if not exists (
    select 1 from missionaccounts.source_artifact artifact
    where artifact.id = import_row.artifact_id and artifact.source_kind = 'zoom_api_window'
  ) then
    raise exception using errcode = '22023', message = 'zoom_reconciliation_requires_zoom_artifact';
  end if;

  insert into missionaccounts.zoom_reconciliation_run(import_run_id, request_id, state)
  values (p_import_run_id, p_request_id, 'running')
  returning * into reconciliation_row;

  for source_record in
    select
      source_row.*,
      session.cycle_key,
      session.held_on,
      session.step,
      session.state as session_state,
      session.canonical_status as canonical_status,
      session.superseded_by_id as session_superseded_by_id,
      missionaccounts.zoom_is_custodied_history(session.id) as historical_source,
      session.provider_instance_id,
      session.source_artifact_id as session_artifact_id
    from missionaccounts.attendance_source_row source_row
    join missionaccounts.session session on session.id = source_row.session_id
    where source_row.import_run_id = p_import_run_id
      and session.provider = 'zoom'
    order by source_row.id
  loop
    -- Corroborated or ambiguous repeated occurrences do not create aliases,
    -- events, days, or unnecessary recomputations.
    if exists (
      select 1
      from missionaccounts.zoom_source_corroboration corroboration
      where corroboration.source_row_id = source_record.id
        and corroboration.superseded_by_id is null
    ) then
      continue;
    end if;

    -- Near misses and other non-confirmed sessions remain immutable provider
    -- evidence and do not create identity or attendance projections.
    if source_record.session_state <> 'confirmed' then
      nonconfirmed_source_rows := nonconfirmed_source_rows + 1;
      review_source_rows := review_source_rows + 1;
      continue;
    end if;

    if source_record.canonical_status <> 'active' or source_record.session_superseded_by_id is not null or source_record.historical_source then
      if source_record.canonical_status = 'review' then review_source_rows := review_source_rows + 1; end if;
      continue;
    end if;

    if nullif(btrim(source_record.participant_source_id), '') is not null then
      source_key_value := 'zoom:user:' || encode(
        digest(btrim(source_record.participant_source_id), 'sha256'),
        'hex'
      );
    else
      -- No provider identity means no cross-row or cross-session name match.
      source_key_value := 'zoom:anonymous:' || encode(digest(
        source_record.provider_instance_id || '|' ||
        source_record.provider_source_id || '|' ||
        lower(btrim(source_record.display_name)),
        'sha256'
      ), 'hex');
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
      'missionaccounts:zoom-identity:' || source_key_value,
      0
    ));

    select * into alias_row
    from missionaccounts.identity_alias
    where source_key = source_key_value and superseded_by_id is null
    for update;
    alias_found := found;
    retired_alias_id := null;

    if alias_found then
      if alias_row.student_id is null
         or alias_row.relationship_state <> 'device' then
        raise exception using
          errcode = '23514',
          message = 'zoom_identity_binding_conflict';
      end if;

      if exists (
        select 1
        from missionaccounts.zoom_shadow_retirement retirement
        where retirement.student_id = alias_row.student_id
          and retirement.superseded_by_id is null and retirement.reversed_at is null
      ) then
        retired_alias_id := alias_row.id;
      end if;
    end if;

    if not alias_found or retired_alias_id is not null then
      insert into missionaccounts.student(
        display_name, source_name, joined_at, identity_state
      ) values (
        source_record.display_name,
        source_record.display_name,
        source_record.held_on,
        'needs_review'
      ) returning id into shadow_student_id;

      -- Stage the successor as non-current before switching the unique
      -- current source-key binding. No human identity is inferred.
      insert into missionaccounts.identity_alias(
        student_id, source_artifact_id, source_key, display_value,
        relationship_state, confidence, superseded_by_id
      ) values (
        shadow_student_id,
        import_row.artifact_id,
        source_key_value,
        source_record.display_name,
        'device',
        null,
        retired_alias_id
      ) returning * into alias_row;

      if retired_alias_id is not null then
        update missionaccounts.identity_alias
        set superseded_by_id = alias_row.id
        where id = retired_alias_id
          and superseded_by_id is null;

        if not found then
          raise exception using
            errcode = '23514',
            message = 'retired_zoom_alias_changed';
        end if;

        update missionaccounts.identity_alias
        set superseded_by_id = null
        where id = alias_row.id
        returning * into alias_row;
      end if;

      identities_created := identities_created + 1;
    else
      exact_identities_reused := exact_identities_reused + 1;
    end if;

    select * into source_student
    from missionaccounts.student
    where id = alias_row.student_id;
    if not found then
      raise exception using errcode = '23503', message = 'zoom_identity_student_not_found';
    end if;

    select
      resolution.canonical_student_id,
      resolution.excluded,
      canonical.identity_state as canonical_identity_state
    into resolution_record
    from missionaccounts.identity_student_resolution resolution
    left join missionaccounts.student canonical
      on canonical.id = resolution.canonical_student_id
    where resolution.source_student_id = alias_row.student_id;
    if not found then
      raise exception using errcode = '23503', message = 'zoom_identity_resolution_not_found';
    end if;

    if resolution_record.excluded or resolution_record.canonical_student_id is null then
      excluded_source_rows := excluded_source_rows + 1;
      continue;
    end if;

    event_id := null;
    insert into missionaccounts.attendance_event(
      student_id, session_id, cycle_key, local_day, step,
      interpretation_state, provenance
    ) values (
      alias_row.student_id,
      source_record.session_id,
      source_record.cycle_key,
      source_record.held_on,
      source_record.step,
      'effective',
      jsonb_build_object(
        'origin', 'zoom_reconciliation',
        'identity_alias_id', alias_row.id,
        'source_key_sha256', split_part(source_key_value, ':', 3)
      )
    ) on conflict (student_id, session_id) do nothing
    returning id into event_id;
    if event_id is not null then
      events_created := events_created + 1;
    else
      select attendance.id into event_id
      from missionaccounts.attendance_event attendance
      where attendance.student_id = alias_row.student_id
        and attendance.session_id = source_record.session_id;
    end if;
    if event_id is null then
      raise exception using errcode = '23503', message = 'zoom_attendance_event_not_found';
    end if;

    insert into missionaccounts.attendance_event_source_row(attendance_event_id, source_row_id)
    values (event_id, source_record.id)
    on conflict do nothing;
    if found then source_links_created := source_links_created + 1; end if;

    if resolution_record.canonical_identity_state = 'verified' then
      matched_source_rows := matched_source_rows + 1;
    else
      review_source_rows := review_source_rows + 1;
    end if;
    if not resolution_record.canonical_student_id = any(recompute_student_ids) then
      recompute_student_ids := array_append(recompute_student_ids, resolution_record.canonical_student_id);
    end if;
  end loop;

  foreach recompute_student_id in array recompute_student_ids loop
    recompute_result := missionaccounts.recompute_student_attendance(
      recompute_student_id,
      'zoom-reconciliation:' || reconciliation_row.id::text
    );
    recomputed_students := recomputed_students + 1;
    stale_decisions := stale_decisions + coalesce((recompute_result->>'stale_decisions')::integer, 0);
  end loop;

  v_result := jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'import_run_id', p_import_run_id,
    'reconciliation_run_id', reconciliation_row.id,
    'attendance_events_created', events_created,
    'attendance_source_links_created', source_links_created,
    'review_identities_created', identities_created,
    'exact_identities_reused', exact_identities_reused,
    'matched_source_rows', matched_source_rows,
    'review_source_rows', review_source_rows,
    'excluded_source_rows', excluded_source_rows,
    'nonconfirmed_source_rows', nonconfirmed_source_rows,
    'students_recomputed', recomputed_students,
    'billing_decisions_staled', stale_decisions,
    'identity_decisions_created', 0,
    'billing_decisions_approved', 0,
    'invoices_created', 0,
    'charges_created', 0,
    'charges_submitted', 0
  );

  v_result := v_result || jsonb_build_object(
    'canonicalization', canonicalization_controls
  );

  update missionaccounts.zoom_reconciliation_run
  set state = 'applied', result_controls = v_result, finished_at = now()
  where id = reconciliation_row.id;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, kind, text, to_val, reason, request_id
  ) values (
    'missionaccounts:zoom-reconciliation',
    'system',
    'zoom_sync.reconciled',
    'Confirmed Zoom evidence reconciled without automatic identity decisions, billing approval, invoices, or charges',
    v_result,
    'Exact provider identity reuse with isolated review identities for unresolved participants',
    p_request_id
  );

  return v_result;
end;
$$;

create or replace function missionaccounts.recompute_student_attendance(
  p_student_id uuid,
  p_trigger text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, extensions, missionaccounts
as $$
declare
  student_row missionaccounts.student%rowtype;
  run_id uuid := gen_random_uuid();
  new_day_id uuid;
  day_record record;
  source_digest text;
  day_kind text;
  day_comp_index integer;
  active_comp_count integer := 0;
  created_days integer := 0;
  review_days integer := 0;
  billable_days integer := 0;
  comped_days integer := 0;
  grace_days integer := 0;
  stale_decisions integer := 0;
  component_size integer := 0;
begin
  if p_student_id is null or nullif(btrim(p_trigger), '') is null then
    raise exception using errcode = '22023', message = 'attendance_recompute_student_and_trigger_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:attendance:' || p_student_id::text, 0));
  select * into student_row from missionaccounts.student where id = p_student_id for update;
  if not found then raise exception using errcode = '23503', message = 'student_not_found'; end if;
  if exists (
    select 1 from missionaccounts.identity_student_resolution
    where source_student_id = p_student_id and canonical_student_id <> p_student_id
  ) then
    raise exception using errcode = '22023', message = 'attendance_recompute_requires_canonical_student';
  end if;

  select count(*)::integer into component_size
  from missionaccounts.identity_student_resolution
  where canonical_student_id = p_student_id;

  select encode(digest(
    p_student_id::text || '|' || p_trigger || '|' || student_row.identity_state || '|' || student_row.comp_days_allowance::text || '|' ||
    coalesce((
      select string_agg(attendance.id::text || ':' || attendance.interpretation_state, ',' order by attendance.id)
      from missionaccounts.attendance_event attendance
      join missionaccounts.identity_student_resolution resolution on resolution.source_student_id = attendance.student_id
      where resolution.canonical_student_id = p_student_id and attendance.superseded_by_id is null
    ), '') || '|' ||
    coalesce((
      select string_agg(correction.id::text || ':' || correction.type || ':' || coalesce(correction.reverts_id::text, '') || ':' || coalesce(correction.reverted_by_id::text, ''), ',' order by correction.created_at, correction.id)
      from missionaccounts.attendance_correction correction
      join missionaccounts.identity_student_resolution resolution on resolution.source_student_id = correction.student_id
      where resolution.canonical_student_id = p_student_id
    ), '') || '|' ||
    coalesce((
      select string_agg(grace.id::text || ':' || grace.from_on::text || ':' || coalesce(grace.to_on::text, ''), ',' order by grace.from_on, grace.id)
      from missionaccounts.grace_window_projection grace
      join missionaccounts.identity_student_resolution resolution on resolution.source_student_id = grace.student_id
      where resolution.canonical_student_id = p_student_id
    ), ''),
    'sha256'
  ), 'hex') into source_digest;

  insert into missionaccounts.engine_run(id, engine_version, source_digest, state, controls)
  values (
    run_id, 'missionaccounts-billing-v2-identity', source_digest, 'running',
    jsonb_build_object('trigger', p_trigger, 'student_id', p_student_id, 'identity_component_size', component_size)
  );

  update missionaccounts.attendance_day day
  set superseded_at = now()
  where day.superseded_at is null
    and day.student_id in (
      select source_student_id from missionaccounts.identity_student_resolution
      where canonical_student_id = p_student_id
    );

  select count(*)::integer into active_comp_count
  from missionaccounts.comp_day_consumption
  where student_id = p_student_id and released_by_change_id is null;

  for day_record in
    with component_students as (
      select source_student_id
      from missionaccounts.identity_student_resolution
      where canonical_student_id = p_student_id
    ), latest_effect as (
      select distinct on (correction.attendance_event_id)
        correction.attendance_event_id,
        correction.type
      from missionaccounts.attendance_correction correction
      where correction.student_id in (select source_student_id from component_students)
        and correction.attendance_event_id is not null
        and correction.type in ('add','remove')
        and correction.reverted_by_id is null
        and not exists (
          select 1 from missionaccounts.attendance_correction reversing
          where reversing.reverts_id = correction.id
        )
      order by correction.attendance_event_id, correction.created_at desc, correction.id desc
    ), interpreted as (
      select
        attendance.id,
        attendance.cycle_key,
        attendance.local_day,
        attendance.interpretation_state
      from missionaccounts.attendance_event attendance
      join missionaccounts.session session on session.id = attendance.session_id
      left join latest_effect effect on effect.attendance_event_id = attendance.id
      where attendance.student_id in (select source_student_id from component_students)
        and attendance.superseded_by_id is null
        and session.superseded_by_id is null
        and session.canonical_status = 'active'
        and session.state = 'confirmed'
        and effect.type is distinct from 'remove'
        and attendance.interpretation_state in ('effective','needs_review')
    )
    select
      local_day as day,
      min(cycle_key) as cycle_key,
      count(distinct cycle_key) as cycle_count,
      bool_or(interpretation_state = 'needs_review') as event_needs_review,
      array_agg(id order by id) as event_ids
    from interpreted
    group by local_day
    order by local_day
  loop
    if day_record.cycle_count <> 1 then
      raise exception using errcode = '22023', message = 'attendance_day_crosses_cycle_boundary';
    end if;
    day_kind := 'billable';
    day_comp_index := null;
    if student_row.identity_state <> 'verified' or day_record.event_needs_review then
      day_kind := 'needs_review';
    else
      select comp_index into day_comp_index
      from missionaccounts.comp_day_consumption
      where student_id = p_student_id and day = day_record.day and released_by_change_id is null;
      if found then
        day_kind := 'comped';
      elsif exists (
        select 1
        from missionaccounts.grace_window_projection grace
        join missionaccounts.identity_student_resolution resolution on resolution.source_student_id = grace.student_id
        where resolution.canonical_student_id = p_student_id
          and day_record.day > grace.from_on
          and (grace.to_on is null or day_record.day <= grace.to_on)
      ) then
        day_kind := 'grace';
      elsif active_comp_count < student_row.comp_days_allowance then
        active_comp_count := active_comp_count + 1;
        day_comp_index := active_comp_count;
        day_kind := 'comped';
        insert into missionaccounts.comp_day_consumption(student_id, day, comp_index, source_change_id)
        values (
          p_student_id,
          day_record.day,
          day_comp_index,
          (select id from missionaccounts.comp_allowance_change where student_id = p_student_id order by created_at desc, id desc limit 1)
        ) on conflict (student_id, day) do update
          set comp_index = excluded.comp_index,
              source_change_id = excluded.source_change_id,
              released_by_change_id = null;
      end if;
    end if;

    insert into missionaccounts.attendance_day(
      engine_run_id, student_id, cycle_key, day, kind, comp_index,
      same_day_multiple_events, engine_version, source_digest
    ) values (
      run_id, p_student_id, day_record.cycle_key, day_record.day, day_kind, day_comp_index,
      cardinality(day_record.event_ids) > 1, 'missionaccounts-billing-v2-identity', source_digest
    ) returning id into new_day_id;
    insert into missionaccounts.attendance_day_event(attendance_day_id, attendance_event_id)
    select new_day_id, event_id from unnest(day_record.event_ids) as event_id;

    created_days := created_days + 1;
    if day_kind = 'needs_review' then review_days := review_days + 1;
    elsif day_kind = 'billable' then billable_days := billable_days + 1;
    elsif day_kind = 'comped' then comped_days := comped_days + 1;
    elsif day_kind = 'grace' then grace_days := grace_days + 1;
    end if;
  end loop;

  perform 1 from missionaccounts.invoice invoice
  where invoice.student_id in (select source_student_id from missionaccounts.identity_student_resolution where canonical_student_id=p_student_id)
  order by invoice.id for update;

  update missionaccounts.billing_decision decision
  set state = 'stale'
  where decision.superseded_by_id is null
    and decision.state = 'approved'
    and decision.student_id in (
      select source_student_id from missionaccounts.identity_student_resolution
      where canonical_student_id = p_student_id
    );
  get diagnostics stale_decisions = row_count;
  update missionaccounts.invoice invoice
  set state = 'void'
  where invoice.student_id in (
      select source_student_id from missionaccounts.identity_student_resolution
      where canonical_student_id = p_student_id
    )
    and invoice.state in ('draft','ready')
    and invoice.provider_ref is null
    and not exists (select 1 from missionaccounts.stripe_invoice_dispatch dispatch where dispatch.invoice_id=invoice.id)
    and exists (
      select 1 from missionaccounts.billing_decision decision
      where decision.id = invoice.decision_id and decision.state = 'stale'
    );

  update missionaccounts.engine_run
  set state = 'succeeded',
      controls = jsonb_build_object(
        'trigger', p_trigger,
        'student_id', p_student_id,
        'identity_component_size', component_size,
        'days', created_days,
        'billable', billable_days,
        'comped', comped_days,
        'grace', grace_days,
        'needs_review', review_days,
        'stale_decisions', stale_decisions
      ),
      finished_at = now()
  where id = run_id;

  return jsonb_build_object(
    'engine_run_id', run_id,
    'identity_component_size', component_size,
    'days', created_days,
    'billable', billable_days,
    'comped', comped_days,
    'grace', grace_days,
    'needs_review', review_days,
    'stale_decisions', stale_decisions
  );
end;
$$;

create or replace view missionaccounts.identity_student_resolution
with (security_invoker = true)
as
select
  student_row.id as source_student_id,
  case
    when retirement.student_id is not null then null::uuid
    when current_merge.canonical_student_id is not null then current_merge.canonical_student_id
    when current_device.decision = 'match' then current_device.target_student_id
    when current_device.decision = 'not_student' then null::uuid
    else student_row.id
  end as canonical_student_id,
  current_merge.cluster_ref,
  current_merge.decision_id,
  case
    when current_merge.canonical_student_id is not null then current_merge.canonical_student_id <> student_row.id
    when current_device.decision = 'match' then current_device.target_student_id <> student_row.id
    else false
  end as absorbed,
  current_device.identity_alias_id as device_alias_id,
  current_device.id as device_decision_id,
  (
    retirement.student_id is not null
    or coalesce(current_device.decision = 'not_student' and current_merge.canonical_student_id is null, false)
  ) as excluded
from missionaccounts.student student_row
left join missionaccounts.zoom_shadow_retirement retirement
  on retirement.student_id = student_row.id
 and retirement.superseded_by_id is null and retirement.reversed_at is null
left join lateral (
  select
    decision.canonical_student_id,
    decision.cluster_ref,
    decision.id as decision_id
  from missionaccounts.identity_decision decision
  where decision.superseded_by_id is null
    and decision.decision = 'same'
    and student_row.id = any(decision.member_student_ids)
  order by decision.decided_at desc, decision.id desc
  limit 1
) current_merge on true
left join lateral (
  select decision.*
  from missionaccounts.device_identity_decision decision
  where decision.superseded_by_id is null
    and decision.source_student_id = student_row.id
  order by decision.decided_at desc, decision.id desc
  limit 1
) current_device on true;

create or replace view missionaccounts.student_identity_projection
with (security_invoker = true)
as
select
  student.id,
  student.display_name,
  student.email,
  student.phone,
  student.joined_at,
  student.comp_days_allowance,
  student.identity_state,
  resolution.canonical_student_id,
  resolution.absorbed,
  exists (
    select 1 from missionaccounts.identity_alias alias
    where alias.student_id = student.id
      and alias.relationship_state = 'device'
      and alias.superseded_by_id is null
  ) as device_source,
  resolution.excluded,
  resolution.device_decision_id,
  resolution.decision_id as cluster_decision_id
from missionaccounts.student student
join missionaccounts.identity_student_resolution resolution
  on resolution.source_student_id = student.id
where not exists (
  select 1
  from missionaccounts.zoom_shadow_retirement retirement
  where retirement.student_id = student.id
    and retirement.superseded_by_id is null and retirement.reversed_at is null
);

create or replace view missionaccounts.identity_alias_projection
with (security_invoker = true)
as
select
  alias.id,
  coalesce(resolution.canonical_student_id, alias.student_id) as student_id,
  alias.student_id as source_student_id,
  alias.source_key,
  alias.display_value,
  alias.relationship_state,
  alias.confidence,
  alias.superseded_by_id,
  alias.created_at
from missionaccounts.identity_alias alias
left join missionaccounts.identity_student_resolution resolution
  on resolution.source_student_id = alias.student_id
where not exists (
  select 1
  from missionaccounts.zoom_shadow_retirement retirement
  where retirement.student_id = alias.student_id
    and retirement.superseded_by_id is null and retirement.reversed_at is null
);

create or replace view missionaccounts.attendance_event_projection
with (security_invoker = true)
as
select
  attendance.id,
  resolution.canonical_student_id as student_id,
  attendance.session_id,
  attendance.cycle_key,
  attendance.local_day,
  attendance.step,
  attendance.interpretation_state,
  attendance.superseded_by_id,
  case
    when count(event_source.source_row_id) = 0 then null
    else round(sum(coalesce(source_row.duration_seconds, 0))::numeric / 60)::integer
  end as duration_minutes,
  count(event_source.source_row_id)::integer as source_row_count,
  min(source_row.display_name) as source_display_name,
  attendance.student_id as source_student_id
from missionaccounts.attendance_event attendance
join missionaccounts.session canonical_session
  on canonical_session.id = attendance.session_id
 and canonical_session.state = 'confirmed'
 and canonical_session.canonical_status = 'active'
 and canonical_session.superseded_by_id is null
join missionaccounts.identity_student_resolution resolution
  on resolution.source_student_id = attendance.student_id
left join missionaccounts.attendance_event_source_row event_source
  on event_source.attendance_event_id = attendance.id
left join missionaccounts.attendance_source_row source_row
  on source_row.id = event_source.source_row_id
where not exists (
  select 1
  from missionaccounts.zoom_shadow_retirement retirement
  where retirement.student_id = attendance.student_id
    and retirement.superseded_by_id is null and retirement.reversed_at is null
)
group by attendance.id, resolution.canonical_student_id;

create or replace function missionaccounts.api_append_attendance_correction(
  p_student_id uuid,
  p_session_id uuid,
  p_attendance_event_id uuid,
  p_type text,
  p_from_val jsonb,
  p_to_val jsonb,
  p_reason text,
  p_reverts_id uuid,
  p_actor_id text,
  p_actor_role text,
  p_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  existing_correction missionaccounts.attendance_correction%rowtype;
  existing_audit missionaccounts.audit_event%rowtype;
  reversed_correction missionaccounts.attendance_correction%rowtype;
  session_row missionaccounts.session%rowtype;
  event_row missionaccounts.attendance_event%rowtype;
  correction_row missionaccounts.attendance_correction%rowtype;
  physical_student_id uuid;
  latest_effect text;
  audit_id uuid;
  stale_decisions integer := 0;
  recomputed jsonb;
  projected_correction jsonb;
begin
  if p_type is null or p_type not in ('add','remove','step_relabel','name','note')
     or nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_attendance_correction_request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:attendance-correction:request:' || p_request_id,
    0
  ));
  select * into existing_correction
  from missionaccounts.attendance_correction
  where request_id = p_request_id;
  if found then
    select * into existing_audit
    from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'attendance_correction.appended';
    if existing_audit.subject_student_id is distinct from p_student_id
       or existing_correction.session_id is distinct from p_session_id
       or (p_attendance_event_id is not null and existing_correction.attendance_event_id is distinct from p_attendance_event_id)
       or existing_correction.type <> p_type
       or existing_correction.from_val is distinct from p_from_val
       or existing_correction.to_val is distinct from p_to_val
       or existing_correction.reason <> p_reason
       or existing_correction.reverts_id is distinct from p_reverts_id
       or existing_correction.actor_id <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    projected_correction := to_jsonb(existing_correction) || jsonb_build_object(
      'student_id', p_student_id,
      'source_student_id', existing_correction.student_id
    );
    return jsonb_build_object(
      'accepted', true,
      'correction', projected_correction,
      'attendance_event_id', existing_correction.attendance_event_id,
      'audit_event_id', existing_audit.id,
      'duplicate', true
    );
  end if;

  perform 1
  from missionaccounts.student student
  join missionaccounts.identity_student_resolution resolution
    on resolution.source_student_id = student.id
  where student.id = p_student_id
    and resolution.canonical_student_id = p_student_id
    and not resolution.excluded
  for update of student;
  if not found then
    raise exception using errcode = '23503', message = 'canonical_student_not_found';
  end if;

  if p_session_id is not null then
    select * into session_row
    from missionaccounts.session
    where id = p_session_id;
    if not found then raise exception using errcode = '23503', message = 'session_not_found'; end if;
  end if;

  if p_attendance_event_id is not null then
    select attendance.* into event_row
    from missionaccounts.attendance_event attendance
    join missionaccounts.identity_student_resolution resolution
      on resolution.source_student_id = attendance.student_id
    where attendance.id = p_attendance_event_id
      and resolution.canonical_student_id = p_student_id
      and not resolution.excluded
      and attendance.superseded_by_id is null
    for update of attendance;
    if not found then raise exception using errcode = '23503', message = 'attendance_event_not_found'; end if;
    if p_session_id is not null and event_row.session_id <> p_session_id then
      raise exception using errcode = '22023', message = 'attendance_event_session_mismatch';
    end if;
    if p_session_id is null then
      p_session_id := event_row.session_id;
      select * into session_row from missionaccounts.session where id = p_session_id;
    end if;
  elsif p_session_id is not null then
    select attendance.* into event_row
    from missionaccounts.attendance_event attendance
    join missionaccounts.identity_student_resolution resolution
      on resolution.source_student_id = attendance.student_id
    where resolution.canonical_student_id = p_student_id
      and not resolution.excluded
      and attendance.session_id = p_session_id
      and attendance.superseded_by_id is null
    order by attendance.id
    limit 1
    for update of attendance;
  end if;

  if session_row.id is not null and (session_row.state <> 'confirmed' or
      session_row.canonical_status <> 'active' or session_row.superseded_by_id is not null) then
    raise exception using errcode = '23514', message = 'active_canonical_class_required';
  end if;

  if p_reverts_id is not null then
    select correction.* into reversed_correction
    from missionaccounts.attendance_correction correction
    join missionaccounts.identity_student_resolution resolution
      on resolution.source_student_id = correction.student_id
    where correction.id = p_reverts_id
      and resolution.canonical_student_id = p_student_id
      and not resolution.excluded
    for update of correction;
    if not found then
      raise exception using errcode = '23503', message = 'reverted_correction_not_found';
    end if;
    if reversed_correction.reverted_by_id is not null or exists (
      select 1 from missionaccounts.attendance_correction
      where reverts_id = p_reverts_id
    ) then
      raise exception using errcode = '23505', message = 'correction_already_reverted';
    end if;
    if p_attendance_event_id is not null
       and reversed_correction.attendance_event_id is distinct from p_attendance_event_id then
      raise exception using errcode = '22023', message = 'reverted_correction_event_mismatch';
    end if;
    physical_student_id := reversed_correction.student_id;
  elsif event_row.id is not null then
    physical_student_id := event_row.student_id;
  else
    physical_student_id := p_student_id;
  end if;

  if p_type = 'add' then
    if p_session_id is null then raise exception using errcode = '22023', message = 'session_required_for_add'; end if;
    if event_row.id is null then
      insert into missionaccounts.attendance_event(
        student_id, session_id, cycle_key, local_day, step, interpretation_state, provenance
      ) values (
        p_student_id, session_row.id, session_row.cycle_key, session_row.held_on,
        session_row.step, 'effective',
        jsonb_build_object('source', 'manual_correction', 'request_id', p_request_id)
      ) returning * into event_row;
      physical_student_id := event_row.student_id;
    else
      select correction.type into latest_effect
      from missionaccounts.attendance_correction correction
      where correction.attendance_event_id = event_row.id
        and correction.type in ('add','remove')
        and correction.reverted_by_id is null
        and not exists (
          select 1 from missionaccounts.attendance_correction reversing
          where reversing.reverts_id = correction.id
        )
      order by correction.created_at desc, correction.id desc limit 1;
      if latest_effect is distinct from 'remove' and p_reverts_id is null then
        raise exception using errcode = '23505', message = 'attendance_already_effective';
      end if;
    end if;
  elsif p_type in ('remove','step_relabel') and event_row.id is null then
    raise exception using errcode = '23503', message = 'attendance_event_required';
  end if;

  if p_type = 'remove' then
    select correction.type into latest_effect
    from missionaccounts.attendance_correction correction
    where correction.attendance_event_id = event_row.id
      and correction.type in ('add','remove')
      and correction.reverted_by_id is null
      and not exists (
        select 1 from missionaccounts.attendance_correction reversing
        where reversing.reverts_id = correction.id
      )
    order by correction.created_at desc, correction.id desc limit 1;
    if latest_effect = 'remove' and p_reverts_id is null then
      raise exception using errcode = '23505', message = 'attendance_already_removed';
    end if;
  end if;
  if p_type = 'step_relabel'
     and coalesce(p_to_val->>'step', '') not in ('s1','s23','unknown') then
    raise exception using errcode = '22023', message = 'invalid_step_relabel';
  end if;

  insert into missionaccounts.attendance_correction(
    student_id, attendance_event_id, session_id, type, from_val, to_val,
    reason, actor_id, request_id, reverts_id
  ) values (
    physical_student_id, event_row.id, p_session_id, p_type, p_from_val, p_to_val,
    p_reason, p_actor_id, p_request_id, p_reverts_id
  ) returning * into correction_row;

  if p_type in ('add','remove','step_relabel') then
    recomputed := missionaccounts.recompute_student_attendance(
      p_student_id,
      p_request_id || ':attendance-correction'
    );
    stale_decisions := coalesce((recomputed->>'stale_decisions')::integer, 0);
  end if;

  projected_correction := to_jsonb(correction_row) || jsonb_build_object(
    'student_id', p_student_id,
    'source_student_id', physical_student_id
  );
  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'attendance_correction.appended',
    'Attendance correction appended without changing source evidence',
    p_from_val,
    jsonb_build_object(
      'correction', projected_correction,
      'source_student_id', physical_student_id,
      'stale_decisions', stale_decisions,
      'attendance_recompute', recomputed
    ),
    p_reason,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'correction', projected_correction,
    'attendance_event_id', event_row.id,
    'stale_decisions', stale_decisions,
    'attendance_recompute', recomputed,
    'audit_event_id', audit_id,
    'duplicate', false
  );
end;
$$;

-- Retired technical projections cannot be revived through an old URL or a domain RPC.
-- Audit/retirement ledgers remain writable so rejected attempts and reversals can be recorded.
create function missionaccounts.guard_zoom_retired_reference()
returns trigger language plpgsql security invoker set search_path = pg_catalog, missionaccounts as $$
declare
  field_name text;
  reference_value text;
begin
  if tg_table_name = 'identity_alias' and tg_op = 'UPDATE'
     and (to_jsonb(new) - 'superseded_by_id') = (to_jsonb(old) - 'superseded_by_id') then
    return new; -- Only the lineage pointer may move to a fresh unresolved successor.
  end if;
  foreach field_name in array tg_argv loop
    reference_value := to_jsonb(new)->>field_name;
    if reference_value is not null then
      perform missionaccounts.assert_student_not_zoom_retired(reference_value::uuid);
    end if;
  end loop;
  if tg_table_name = 'identity_decision' then
    for reference_value in select jsonb_array_elements_text(to_jsonb(new)->'member_student_ids') loop
      perform missionaccounts.assert_student_not_zoom_retired(reference_value::uuid);
    end loop;
  end if;
  return new;
end;
$$;
revoke execute on function missionaccounts.guard_zoom_retired_reference() from public, anon, authenticated;
grant execute on function missionaccounts.guard_zoom_retired_reference() to service_role;

-- Catalog enumeration is restricted to this product schema and direct student FKs.
do $$
declare record_row record;
begin
  for record_row in
    select relation.relname as table_name,
      string_agg(quote_literal(attribute.attname), ',' order by attribute.attname) as fields
    from pg_constraint constraint_row
    join pg_class relation on relation.oid=constraint_row.conrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    join pg_attribute attribute on attribute.attrelid=relation.oid and attribute.attnum=any(constraint_row.conkey)
    where constraint_row.contype='f' and constraint_row.confrelid='missionaccounts.student'::regclass
      and namespace.nspname='missionaccounts'
      and relation.relname not in ('audit_event','zoom_shadow_retirement')
    group by relation.relname
  loop
    execute format('create trigger zoom_retired_reference_guard before insert or update on missionaccounts.%I for each row execute function missionaccounts.guard_zoom_retired_reference(%s)',record_row.table_name,record_row.fields);
  end loop;
end;
$$;
create trigger zoom_retired_student_guard before update on missionaccounts.student
for each row execute function missionaccounts.guard_zoom_retired_reference('id');

create or replace function missionaccounts.api_ingest_and_reconcile_zoom_batch(
  p_request_id text,
  p_window_from timestamptz,
  p_window_to timestamptz,
  p_artifact jsonb,
  p_sessions jsonb,
  p_source_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  ingestion jsonb;
  reconciliation jsonb;
  result jsonb;
begin
  ingestion := missionaccounts.api_ingest_zoom_batch(
    p_request_id, p_window_from, p_window_to,
    p_artifact, p_sessions, p_source_rows
  );
  reconciliation := missionaccounts.api_reconcile_zoom_import(
    (ingestion->>'import_run_id')::uuid,
    p_request_id || ':reconciliation'
  );
  result := jsonb_build_object(
    'accepted', true,
    'duplicate', coalesce((ingestion->>'duplicate')::boolean, false)
      and coalesce((reconciliation->>'duplicate')::boolean, false),
    'source_duplicate', coalesce((ingestion->>'duplicate')::boolean, false),
    'reconciliation_duplicate', coalesce((reconciliation->>'duplicate')::boolean, false),
    'artifact_id', ingestion->>'artifact_id',
    'import_run_id', ingestion->>'import_run_id',
    'sync_run_id', ingestion->>'sync_run_id',
    'sessions', (ingestion->>'sessions')::integer,
    'source_rows', (ingestion->>'source_rows')::integer
  ) || (reconciliation - 'accepted' - 'duplicate' - 'import_run_id');
  update missionaccounts.sync_run set stats=result,
    finished_at=coalesce(finished_at,now()) where request_id=p_request_id;
  return result;
end;
$$;

-- Service-only source review: raw occurrences remain separate from effective attendance.
create view missionaccounts.zoom_class_source_projection with (security_invoker=true) as
select m.id,m.source_session_id,m.canonical_session_id,m.disposition,m.rule_version,m.created_at,
 s.held_on,s.starts_at,s.step,s.provider_meeting_id,
 (select count(*) from missionaccounts.zoom_source_corroboration c join missionaccounts.attendance_source_row r on r.id=c.source_row_id where r.session_id=s.id and c.superseded_by_id is null and c.disposition='exact_occurrence') as exact_occurrences,
 (select count(*) from missionaccounts.zoom_source_corroboration c join missionaccounts.attendance_source_row r on r.id=c.source_row_id where r.session_id=s.id and c.superseded_by_id is null and c.disposition='unresolved_occurrence') as unresolved_occurrences
from missionaccounts.zoom_session_canonicalization m join missionaccounts.session s on s.id=m.source_session_id
where m.superseded_by_id is null;
create view missionaccounts.zoom_occurrence_review_projection with (security_invoker=true) as
select c.id,c.source_row_id,c.canonical_session_id,c.disposition,r.session_id as source_session_id,
 r.display_name,r.joined_at,r.left_at,s.held_on,s.starts_at,s.step,s.provider_meeting_id,c.created_at
from missionaccounts.zoom_source_corroboration c join missionaccounts.attendance_source_row r on r.id=c.source_row_id
join missionaccounts.session s on s.id=r.session_id
where c.superseded_by_id is null and c.disposition='unresolved_occurrence';
revoke all on missionaccounts.zoom_class_source_projection,missionaccounts.zoom_occurrence_review_projection from public,anon,authenticated;
grant select on missionaccounts.zoom_class_source_projection,missionaccounts.zoom_occurrence_review_projection to service_role;
