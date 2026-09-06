-- MX-MISSIONACCOUNTS-5301P: admin review custody for student attendance reports.
-- Resolution is a separate audited decision. It does not edit source attendance,
-- derived attendance days, invoices, billing decisions, or charges.

alter table missionaccounts.attendance_issue
  add column resolved_request_id text;

create unique index attendance_issue_resolved_request_idx
  on missionaccounts.attendance_issue(resolved_request_id)
  where resolved_request_id is not null;

create function missionaccounts.attendance_issue_submission_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'attendance_issue_submission_immutable';
  end if;
  if new.student_id is distinct from old.student_id
     or new.issue_text is distinct from old.issue_text
     or new.context is distinct from old.context
     or new.submitted_by is distinct from old.submitted_by
     or new.request_id is distinct from old.request_id
     or new.submitted_at is distinct from old.submitted_at then
    raise exception using errcode = '55000', message = 'attendance_issue_submission_immutable';
  end if;
  return new;
end;
$$;

create trigger attendance_issue_submission_immutable
before update or delete on missionaccounts.attendance_issue
for each row execute function missionaccounts.attendance_issue_submission_immutable();

create function missionaccounts.api_resolve_attendance_issue(
  p_issue_id uuid,
  p_state text,
  p_resolution_note text,
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
  issue_row missionaccounts.attendance_issue%rowtype;
  request_row missionaccounts.attendance_issue%rowtype;
  audit_id uuid;
  clean_note text := btrim(coalesce(p_resolution_note, ''));
begin
  if p_issue_id is null
     or p_state not in ('resolved', 'dismissed')
     or p_actor_role not in ('missionaccounts_admin', 'founder')
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_request_id), '') is null
     or char_length(clean_note) < 3
     or char_length(clean_note) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_attendance_issue_resolution';
  end if;

  select * into request_row
  from missionaccounts.attendance_issue
  where resolved_request_id = p_request_id;

  if request_row.id is not null then
    if request_row.id is distinct from p_issue_id
       or request_row.state is distinct from p_state
       or request_row.resolution_note is distinct from clean_note
       or request_row.resolved_by is distinct from p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select id into audit_id
    from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'attendance_issue.reviewed';
    return jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'issue', to_jsonb(request_row),
      'audit_event_id', audit_id
    );
  end if;

  select * into issue_row
  from missionaccounts.attendance_issue
  where id = p_issue_id
  for update;
  if issue_row.id is null then
    raise exception using errcode = 'P0002', message = 'attendance_issue_not_found';
  end if;
  if issue_row.state <> 'open' then
    raise exception using errcode = '55000', message = 'attendance_issue_already_reviewed';
  end if;

  update missionaccounts.attendance_issue
  set state = p_state,
      resolved_at = now(),
      resolved_by = p_actor_id,
      resolution_note = clean_note,
      resolved_request_id = p_request_id
  where id = p_issue_id
  returning * into issue_row;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, issue_row.student_id, 'attendance_issue.reviewed',
    'Dr J reviewed a student attendance issue without changing attendance evidence',
    jsonb_build_object('issue_id', issue_row.id, 'state', 'open'),
    jsonb_build_object('issue_id', issue_row.id, 'state', p_state),
    clean_note, p_request_id
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, audience, event_kind, payload, state, idempotency_key
  ) values (
    issue_row.student_id, 'matrix', 'student', 'attendance.issue_reviewed',
    jsonb_build_object(
      'issue_id', issue_row.id,
      'state', p_state,
      'resolution_note', clean_note
    ),
    'pending', p_request_id || ':attendance-issue-student'
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'issue', to_jsonb(issue_row),
    'audit_event_id', audit_id
  );
end;
$$;

revoke execute on function missionaccounts.api_resolve_attendance_issue(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function missionaccounts.api_resolve_attendance_issue(uuid, text, text, text, text, text)
  to service_role;

comment on table missionaccounts.attendance_issue is
  'Student-submitted report content is immutable; only audited admin review state may transition through the service-role RPC.';
