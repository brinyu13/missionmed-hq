-- MX-MISSIONACCOUNTS-5301P: student-owned attendance issue reporting.
-- Reports are submitted through the authenticated MissionAccounts server. The
-- browser has no direct table or RPC privilege, and source attendance remains
-- immutable until Dr J records a separate correction.

create table missionaccounts.attendance_issue (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  issue_text text not null check (char_length(btrim(issue_text)) between 3 and 2000),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  state text not null default 'open' check (state in ('open','resolved','dismissed')),
  submitted_by text not null,
  request_id text not null unique,
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  check ((state = 'open' and resolved_at is null and resolved_by is null)
    or (state in ('resolved','dismissed') and resolved_at is not null and resolved_by is not null))
);

create index attendance_issue_open_idx
  on missionaccounts.attendance_issue(submitted_at, student_id)
  where state = 'open';

create function missionaccounts.api_submit_attendance_issue(
  p_student_id uuid,
  p_issue_text text,
  p_context jsonb,
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
  audit_id uuid;
  clean_text text := btrim(coalesce(p_issue_text, ''));
  clean_context jsonb := coalesce(p_context, '{}'::jsonb);
begin
  if p_student_id is null
     or p_actor_role is distinct from 'student'
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_request_id), '') is null
     or char_length(clean_text) < 3
     or char_length(clean_text) > 2000
     or jsonb_typeof(clean_context) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_attendance_issue_request';
  end if;

  perform 1
  from missionaccounts.student
  where id = p_student_id and matrix_user_ref = p_actor_id;
  if not found then
    raise exception using errcode = '42501', message = 'attendance_issue_student_binding_mismatch';
  end if;

  insert into missionaccounts.attendance_issue(
    student_id, issue_text, context, submitted_by, request_id
  ) values (
    p_student_id, clean_text, clean_context, p_actor_id, p_request_id
  )
  on conflict (request_id) do nothing
  returning * into issue_row;

  if issue_row.id is null then
    select * into issue_row
    from missionaccounts.attendance_issue
    where request_id = p_request_id;
    if issue_row.student_id is distinct from p_student_id
       or issue_row.submitted_by is distinct from p_actor_id
       or issue_row.issue_text is distinct from clean_text
       or issue_row.context is distinct from clean_context then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select id into audit_id
    from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'attendance_issue.submitted';
    return jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'issue', to_jsonb(issue_row),
      'audit_event_id', audit_id
    );
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
  ) values (
    p_actor_id, 'student', p_student_id, 'attendance_issue.submitted',
    'Student reported an attendance issue for Dr J review',
    jsonb_build_object('issue_id', issue_row.id, 'issue_text', clean_text, 'context', clean_context),
    'student_reported_attendance_issue', p_request_id
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, audience, event_kind, payload, state, idempotency_key
  ) values (
    p_student_id, 'matrix', 'missionaccounts_admin', 'attendance.issue_reported',
    jsonb_build_object(
      'issue_id', issue_row.id,
      'student_id', p_student_id,
      'issue_preview', left(clean_text, 300),
      'context', clean_context
    ),
    'pending', p_request_id || ':attendance-issue-admin'
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'issue', to_jsonb(issue_row),
    'audit_event_id', audit_id
  );
end;
$$;

alter table missionaccounts.attendance_issue enable row level security;
alter table missionaccounts.attendance_issue force row level security;

revoke all on missionaccounts.attendance_issue from public, anon, authenticated;
grant all on missionaccounts.attendance_issue to service_role;

revoke execute on function missionaccounts.api_submit_attendance_issue(uuid, text, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function missionaccounts.api_submit_attendance_issue(uuid, text, jsonb, text, text, text)
  to service_role;

comment on table missionaccounts.attendance_issue is
  'Immutable student-submitted attendance concerns awaiting a separate Dr J correction or disposition.';
