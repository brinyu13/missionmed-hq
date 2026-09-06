-- MX-MISSIONACCOUNTS-5301P: reconcile persisted Zoom evidence into attendance.
--
-- Safety properties:
--   * only sessions already classified as confirmed can create attendance;
--   * only an exact, hashed Zoom participant identifier reuses an identity;
--   * names and email addresses are evidence, never automatic match keys;
--   * a new identifier receives an isolated needs_review student/alias;
--   * attendance recomputation can stale prior approvals, but this path never
--     approves billing, creates an invoice, or creates/submits a charge.

create table missionaccounts.zoom_reconciliation_run (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null unique references missionaccounts.import_run(id),
  request_id text not null unique,
  state text not null check (state in ('running','applied','failed')),
  result_controls jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table missionaccounts.zoom_reconciliation_run enable row level security;
alter table missionaccounts.zoom_reconciliation_run force row level security;
revoke all on table missionaccounts.zoom_reconciliation_run from public, anon, authenticated;
grant select, insert, update on table missionaccounts.zoom_reconciliation_run to service_role;

-- A Zoom identity is account-scoped by the single configured provider account.
-- The key contains only a SHA-256 digest, never a provider identifier or email.
create unique index identity_alias_one_current_zoom_source
  on missionaccounts.identity_alias(source_key)
  where source_key like 'zoom:%' and superseded_by_id is null;

create function missionaccounts.api_reconcile_zoom_import(
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
      'reconciliation_run_id', reconciliation_row.id
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
      session.provider_instance_id,
      session.source_artifact_id as session_artifact_id
    from missionaccounts.attendance_source_row source_row
    join missionaccounts.session session on session.id = source_row.session_id
    where source_row.import_run_id = p_import_run_id
      and session.provider = 'zoom'
    order by source_row.id
  loop
    -- Near misses and other non-confirmed sessions remain immutable provider
    -- evidence and do not create identity or attendance projections.
    if source_record.session_state <> 'confirmed' then
      nonconfirmed_source_rows := nonconfirmed_source_rows + 1;
      review_source_rows := review_source_rows + 1;
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

    if not found then
      insert into missionaccounts.student(
        display_name, source_name, joined_at, identity_state
      ) values (
        source_record.display_name,
        source_record.display_name,
        source_record.held_on,
        'needs_review'
      ) returning id into shadow_student_id;

      insert into missionaccounts.identity_alias(
        student_id, source_artifact_id, source_key, display_value,
        relationship_state, confidence
      ) values (
        shadow_student_id,
        source_record.session_artifact_id,
        source_key_value,
        source_record.display_name,
        'device',
        null
      ) returning * into alias_row;
      identities_created := identities_created + 1;
    else
      if alias_row.student_id is null or alias_row.relationship_state <> 'device' then
        raise exception using errcode = '23514', message = 'zoom_identity_binding_conflict';
      end if;
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

revoke execute on function missionaccounts.api_reconcile_zoom_import(uuid, text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_reconcile_zoom_import(uuid, text)
to service_role;

-- The application uses this wrapper so source persistence and reconciliation
-- are one database transaction. A reconciliation error rolls back the source
-- batch instead of leaving an apparently successful sync behind.
create function missionaccounts.api_ingest_and_reconcile_zoom_batch(
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
begin
  ingestion := missionaccounts.api_ingest_zoom_batch(
    p_request_id, p_window_from, p_window_to,
    p_artifact, p_sessions, p_source_rows
  );
  reconciliation := missionaccounts.api_reconcile_zoom_import(
    (ingestion->>'import_run_id')::uuid,
    p_request_id || ':reconciliation'
  );
  return jsonb_build_object(
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
end;
$$;

revoke execute on function missionaccounts.api_ingest_and_reconcile_zoom_batch(
  text, timestamptz, timestamptz, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function missionaccounts.api_ingest_and_reconcile_zoom_batch(
  text, timestamptz, timestamptz, jsonb, jsonb, jsonb
) to service_role;

comment on function missionaccounts.api_reconcile_zoom_import(uuid, text) is
  'Exact-identity Zoom reconciliation. Unknown participants become isolated review identities; no billing approval, invoice, or charge is created.';
comment on function missionaccounts.api_ingest_and_reconcile_zoom_batch(text, timestamptz, timestamptz, jsonb, jsonb, jsonb) is
  'Atomic Zoom source ingestion and fail-closed attendance reconciliation for the MissionAccounts scheduler.';
