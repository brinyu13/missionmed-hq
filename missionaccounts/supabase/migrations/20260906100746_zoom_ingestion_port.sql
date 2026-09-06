-- MX-MISSIONACCOUNTS-5301P: default-off ZoomAttendanceProvider persistence port.
-- This migration stores normalized provider evidence only. It never merges an
-- identity, creates an attendance_event, approves billing, or charges a student.

alter table missionaccounts.sync_run
  add column request_id text;
create unique index sync_run_request_unique
  on missionaccounts.sync_run(request_id)
  where request_id is not null;

create function missionaccounts.api_ingest_zoom_batch(
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

  request_controls := jsonb_build_object(
    'provider', 'zoom',
    'window_from', p_window_from,
    'window_to', p_window_to,
    'artifact_sha256', p_artifact->>'sha256',
    'sessions', jsonb_array_length(p_sessions),
    'source_rows', jsonb_array_length(p_source_rows)
  );

  select * into existing_run
  from missionaccounts.import_run
  where request_id = p_request_id;
  if found then
    if existing_run.source_controls <> request_controls then
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
    provider_instance_id, starts_at, held_on, time_zone, step, state, source_payload
  )
  select
    item->>'cycle_key', artifact_row.id, 'zoom',
    item->>'provider_meeting_id', item->>'provider_instance_id',
    (item->>'starts_at')::timestamptz, (item->>'held_on')::date,
    coalesce(nullif(item->>'time_zone', ''), 'America/New_York'),
    coalesce(nullif(item->>'step', ''), 'unknown'),
    coalesce(nullif(item->>'state', ''), 'candidate'),
    coalesce(item->'source_payload', '{}'::jsonb)
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

revoke execute on function missionaccounts.api_ingest_zoom_batch(text, timestamptz, timestamptz, jsonb, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function missionaccounts.api_ingest_zoom_batch(text, timestamptz, timestamptz, jsonb, jsonb, jsonb)
to service_role;

create function missionaccounts.api_record_zoom_sync_failure(
  p_request_id text,
  p_window_from timestamptz,
  p_window_to timestamptz,
  p_error text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  sync_row missionaccounts.sync_run%rowtype;
  exception_id uuid;
begin
  if nullif(btrim(p_request_id), '') is null
     or p_window_from is null or p_window_to is null or p_window_to < p_window_from
     or nullif(btrim(p_error), '') is null or p_now is null then
    raise exception using errcode = '22023', message = 'invalid_zoom_sync_failure';
  end if;

  select * into sync_row from missionaccounts.sync_run where request_id = p_request_id;
  if found then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'sync_run_id', sync_row.id, 'state', sync_row.state);
  end if;

  insert into missionaccounts.sync_run(
    provider, window_from, window_to, state, stats, error, started_at, finished_at, request_id
  ) values (
    'zoom', p_window_from, p_window_to, 'failed', '{}'::jsonb,
    left(p_error, 2000), p_now, p_now, p_request_id
  ) returning * into sync_row;

  insert into missionaccounts.integration_exception(
    provider, kind, details, idempotency_key
  ) values (
    'zoom', 'zoom_sync_failed',
    jsonb_build_object(
      'sync_run_id', sync_row.id, 'window_from', p_window_from,
      'window_to', p_window_to, 'error', left(p_error, 2000)
    ),
    'missionaccounts:zoom-sync-failure:' || p_request_id
  ) on conflict (idempotency_key) do update
    set details = excluded.details
  returning id into exception_id;

  return jsonb_build_object(
    'accepted', true, 'duplicate', false, 'sync_run_id', sync_row.id,
    'exception_id', exception_id, 'state', sync_row.state
  );
end;
$$;

revoke execute on function missionaccounts.api_record_zoom_sync_failure(text, timestamptz, timestamptz, text, timestamptz)
from public, anon, authenticated;
grant execute on function missionaccounts.api_record_zoom_sync_failure(text, timestamptz, timestamptz, text, timestamptz)
to service_role;

alter table missionaccounts.source_artifact enable row level security;
alter table missionaccounts.source_artifact force row level security;
alter table missionaccounts.import_run enable row level security;
alter table missionaccounts.import_run force row level security;
alter table missionaccounts.sync_run enable row level security;
alter table missionaccounts.sync_run force row level security;
revoke all on missionaccounts.source_artifact, missionaccounts.import_run, missionaccounts.sync_run
from public, anon, authenticated;
grant all on missionaccounts.source_artifact, missionaccounts.import_run, missionaccounts.sync_run
to service_role;

comment on function missionaccounts.api_ingest_zoom_batch(text, timestamptz, timestamptz, jsonb, jsonb, jsonb) is
  'Persists normalized Zoom source evidence only; downstream identity and billing decisions remain separate.';
