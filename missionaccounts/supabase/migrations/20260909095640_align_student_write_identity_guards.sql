-- MX-MISSIONACCOUNTS-5401R: align student-owned write guards with the
-- server-authoritative identity model. The authenticated server resolves each
-- student token subject directly to missionaccounts.student.id and passes that
-- exact subject as p_actor_id. Legacy matrix_user_ref values are nullable or
-- different for every verified production student, so they cannot authorize
-- student-owned writes. Preserve SECURITY INVOKER and service_role-only RPC
-- execution while requiring the exact student row id for student actions.

begin;

create or replace function missionaccounts.api_submit_exam_plan(
  p_student_id uuid,
  p_step text,
  p_exam_on date,
  p_today date,
  p_actor_id text,
  p_actor_role text,
  p_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, extensions, missionaccounts
as $$
declare
  existing_plan missionaccounts.exam_plan%rowtype;
  prior_plan missionaccounts.exam_plan%rowtype;
  new_plan missionaccounts.exam_plan%rowtype;
  new_plan_id uuid := gen_random_uuid();
  audit_id uuid;
  closed_grace_windows integer := 0;
  recomputed jsonb;
begin
  if p_step not in ('s1','s2','s3') or p_exam_on is null or p_today is null then
    raise exception using errcode = '22023', message = 'invalid_exam_plan';
  end if;
  if nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'exam_plan_actor_and_request_required';
  end if;
  if p_actor_role not in ('student','missionaccounts_admin','founder')
     or (p_actor_role = 'student' and not exists (
       select 1 from missionaccounts.student s
       where s.id = p_student_id and s.id::text = p_actor_id
     )) then
    raise exception using errcode = '42501', message = 'exam_plan_submission_forbidden';
  end if;

  select ep.* into existing_plan
  from missionaccounts.exam_transition et
  join missionaccounts.exam_plan ep on ep.id = et.exam_plan_id
  where et.request_id = p_request_id;

  if found then
    if existing_plan.student_id <> p_student_id
       or existing_plan.step <> p_step
       or existing_plan.exam_on <> p_exam_on
       or existing_plan.submitted_by <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select id into audit_id
    from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'exam_plan.submitted';
    return jsonb_build_object('plan', to_jsonb(existing_plan), 'audit_event_id', audit_id, 'duplicate', true);
  end if;

  perform 1 from missionaccounts.student where id = p_student_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'student_not_found';
  end if;

  select * into prior_plan
  from missionaccounts.exam_plan
  where student_id = p_student_id and superseded_by_id is null
  for update;

  if found then
    update missionaccounts.grace_window
    set to_on = greatest(from_on, p_today),
        closed_reason = 'plan_replaced',
        closed_at = now()
    where exam_plan_id = prior_plan.id and to_on is null;
    get diagnostics closed_grace_windows = row_count;
    update missionaccounts.reminder
    set state = 'cancelled',
        cancelled_reason = 'plan_replaced',
        updated_at = now()
    where exam_plan_id = prior_plan.id and state in ('scheduled','due');
    update missionaccounts.notification_outbox
    set state = 'cancelled',
        locked_by = null,
        locked_at = null,
        last_error = 'plan_replaced'
    where reminder_id in (
      select id from missionaccounts.reminder where exam_plan_id = prior_plan.id
    ) and state in ('pending','failed','sending');

    insert into missionaccounts.exam_plan(
      id, student_id, step, exam_on, state, submitted_by, superseded_by_id
    ) values (
      new_plan_id, p_student_id, p_step, p_exam_on, 'pending', p_actor_id, prior_plan.id
    );
    update missionaccounts.exam_plan set superseded_by_id = new_plan_id where id = prior_plan.id;
    update missionaccounts.exam_plan set superseded_by_id = null where id = new_plan_id returning * into new_plan;
  else
    insert into missionaccounts.exam_plan(
      id, student_id, step, exam_on, state, submitted_by
    ) values (
      new_plan_id, p_student_id, p_step, p_exam_on, 'pending', p_actor_id
    ) returning * into new_plan;
  end if;

  if closed_grace_windows > 0 then
    recomputed := missionaccounts.recompute_student_attendance(
      p_student_id,
      p_request_id || ':exam-plan-replaced'
    );
  end if;

  insert into missionaccounts.exam_transition(
    exam_plan_id, student_id, from_state, to_state, accepted, reason, actor_id, actor_role, request_id
  ) values (
    new_plan.id, p_student_id, null, 'pending', true, 'submitted', p_actor_id, p_actor_role, p_request_id
  );

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id,
    p_actor_role,
    p_student_id,
    'exam_plan.submitted',
    'Exam plan submitted',
    case when prior_plan.id is null then null else to_jsonb(prior_plan) end,
    jsonb_build_object(
      'plan', to_jsonb(new_plan),
      'closed_grace_windows', closed_grace_windows,
      'attendance_recompute', recomputed
    ),
    'submitted',
    p_request_id
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, audience, event_kind, payload, state, idempotency_key
  ) values (
    p_student_id,
    'matrix',
    case when p_actor_role = 'student' then 'missionaccounts_admin' else 'student' end,
    'exam_plan.submitted',
    jsonb_build_object('student_id', p_student_id, 'exam_plan_id', new_plan.id, 'audience', 'missionaccounts_admin'),
    'pending',
    p_request_id || ':exam-plan-submitted'
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'plan', to_jsonb(new_plan),
    'closed_grace_windows', closed_grace_windows,
    'attendance_recompute', recomputed,
    'audit_event_id', audit_id,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_submit_exam_plan(uuid, text, date, date, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_submit_exam_plan(uuid, text, date, date, text, text, text) to service_role;

create or replace function missionaccounts.api_transition_exam_plan(
  p_plan_id uuid,
  p_to_state text,
  p_result text,
  p_note text,
  p_today date,
  p_actor_id text,
  p_actor_role text,
  p_request_id text,
  p_suggested_on date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  current_plan missionaccounts.exam_plan%rowtype;
  prior_transition missionaccounts.exam_transition%rowtype;
  transition_id uuid;
  audit_id uuid;
  transition_allowed boolean := false;
  first_wednesday_offset integer;
  reminder_due date;
  recomputed jsonb;
begin
  if p_to_state is null
     or p_to_state not in ('pending','approved','speak','denied','followup','passed')
     or p_today is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_exam_transition_request';
  end if;
  if p_result is not null and p_result not in ('passed','not_passed','no_result') then
    raise exception using errcode = '22023', message = 'invalid_exam_result';
  end if;
  if p_actor_role not in ('student','missionaccounts_admin','founder') then
    raise exception using errcode = '42501', message = 'exam_transition_forbidden';
  end if;
  if p_suggested_on is not null and p_to_state <> 'denied' then
    raise exception using errcode = '22023', message = 'suggested_date_requires_denial';
  end if;

  select * into prior_transition
  from missionaccounts.exam_transition
  where request_id = p_request_id;
  if found then
    if prior_transition.exam_plan_id <> p_plan_id
       or prior_transition.to_state <> p_to_state
       or prior_transition.result is distinct from p_result
       or prior_transition.suggested_on is distinct from p_suggested_on
       or prior_transition.actor_id <> p_actor_id
       or prior_transition.actor_role <> p_actor_role
       or prior_transition.reason is distinct from p_note then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select * into current_plan from missionaccounts.exam_plan where id = p_plan_id;
    select id into audit_id
    from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'exam_plan.transition';
    return jsonb_build_object(
      'accepted', prior_transition.accepted,
      'plan', to_jsonb(current_plan),
      'transition_id', prior_transition.id,
      'audit_event_id', audit_id,
      'duplicate', true
    );
  end if;

  select * into current_plan
  from missionaccounts.exam_plan
  where id = p_plan_id and superseded_by_id is null
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'current_exam_plan_not_found';
  end if;

  transition_allowed := case current_plan.state
    when 'pending' then p_to_state in ('approved','speak','denied')
    when 'speak' then p_to_state in ('approved','denied')
    when 'denied' then p_to_state in ('pending','approved')
    when 'approved' then p_to_state in ('passed','followup','denied','pending')
    when 'followup' then p_to_state in ('approved','passed','followup','pending')
    when 'passed' then p_to_state = 'pending'
    else false
  end;

  if p_actor_role = 'student' and (
    p_to_state <> 'passed'
    or p_result is distinct from 'passed'
    or not exists (
      select 1 from missionaccounts.student s
      where s.id = current_plan.student_id and s.id::text = p_actor_id
    )
  ) then
    transition_allowed := false;
  end if;

  insert into missionaccounts.exam_transition(
    exam_plan_id, student_id, from_state, to_state, result, accepted, reason, actor_id, actor_role, suggested_on, request_id
  ) values (
    current_plan.id, current_plan.student_id, current_plan.state, p_to_state,
    p_result, transition_allowed, p_note, p_actor_id, p_actor_role, p_suggested_on, p_request_id
  ) returning id into transition_id;

  if not transition_allowed then
    insert into missionaccounts.audit_event(
      actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
    ) values (
      p_actor_id, p_actor_role, current_plan.student_id, 'exam_plan.transition',
      'Rejected invalid exam-plan transition', to_jsonb(current_plan.state), to_jsonb(p_to_state),
      coalesce(p_note, 'transition_not_allowed'), p_request_id
    ) returning id into audit_id;
    return jsonb_build_object(
      'accepted', false,
      'plan', to_jsonb(current_plan),
      'transition_id', transition_id,
      'audit_event_id', audit_id,
      'duplicate', false
    );
  end if;

  if p_to_state = 'approved' then
    insert into missionaccounts.grace_window(student_id, exam_plan_id, from_on)
    values (current_plan.student_id, current_plan.id, current_plan.exam_on)
    on conflict do nothing;

    first_wednesday_offset := (3 - extract(dow from current_plan.exam_on)::integer + 7) % 7;
    if first_wednesday_offset = 0 then first_wednesday_offset := 7; end if;
    reminder_due := current_plan.exam_on + first_wednesday_offset + 14;
    insert into missionaccounts.reminder(
      student_id, exam_plan_id, kind, due_on, state, idempotency_key
    ) values (
      current_plan.student_id, current_plan.id, 'exam_result_checkin', reminder_due,
      'scheduled', current_plan.id::text || ':exam-result-checkin'
    ) on conflict (idempotency_key) do update
      set due_on = excluded.due_on,
          state = 'scheduled',
          cancelled_reason = null,
          updated_at = now();
  end if;

  if p_to_state = 'passed'
     or (current_plan.state in ('approved','followup') and p_to_state in ('denied','pending'))
     or (p_to_state = 'followup' and p_result is not null) then
    update missionaccounts.grace_window
    set to_on = greatest(from_on, p_today),
        closed_reason = case when p_to_state = 'passed' then 'passed' else coalesce(p_result, p_to_state) end,
        closed_at = now()
    where exam_plan_id = current_plan.id and to_on is null;
    update missionaccounts.reminder
    set state = 'cancelled',
        cancelled_reason = case when p_to_state = 'passed' then 'result_recorded' else 'plan_changed' end,
        updated_at = now()
    where exam_plan_id = current_plan.id and state in ('scheduled','due');
    update missionaccounts.notification_outbox
    set state = 'cancelled',
        locked_by = null,
        locked_at = null,
        last_error = case when p_to_state = 'passed' then 'result_recorded' else 'plan_changed' end
    where reminder_id in (
      select id from missionaccounts.reminder where exam_plan_id = current_plan.id
    ) and state in ('pending','failed','sending');
  end if;

  update missionaccounts.exam_plan
  set state = p_to_state,
      result = case when p_to_state = 'passed' then 'passed' when p_to_state = 'followup' then p_result else null end,
      note = p_note,
      suggested_on = case
        when p_to_state = 'denied' then p_suggested_on
        when p_to_state in ('approved','pending') then null
        else suggested_on
      end,
      decided_by = p_actor_id,
      decided_at = now(),
      passed_on = case
        when p_to_state = 'passed' then p_today
        when current_plan.state = 'passed' and p_to_state = 'pending' then null
        else passed_on
      end
  where id = current_plan.id
  returning * into current_plan;

  recomputed := missionaccounts.recompute_student_attendance(
    current_plan.student_id,
    p_request_id || ':exam-transition'
  );

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, current_plan.student_id, 'exam_plan.transition',
    'Exam plan state changed',
    jsonb_build_object('state', (select from_state from missionaccounts.exam_transition where id = transition_id)),
    jsonb_build_object(
      'state', p_to_state,
      'result', p_result,
      'suggested_on', p_suggested_on,
      'today', p_today,
      'attendance_recompute', recomputed
    ),
    p_note, p_request_id
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, audience, event_kind, payload, state, idempotency_key
  ) values (
    current_plan.student_id,
    'matrix',
    case when p_actor_role = 'student' then 'missionaccounts_admin' else 'student' end,
    'exam_plan.' || p_to_state,
    jsonb_build_object('student_id', current_plan.student_id, 'exam_plan_id', current_plan.id, 'state', p_to_state, 'result', p_result, 'suggested_on', p_suggested_on),
    'pending',
    p_request_id || ':exam-plan-transition'
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'accepted', true,
    'plan', to_jsonb(current_plan),
    'transition_id', transition_id,
    'audit_event_id', audit_id,
    'reminder_due', reminder_due,
    'attendance_recompute', recomputed,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_transition_exam_plan(uuid, text, text, text, date, text, text, text, date) from public, anon, authenticated;
grant execute on function missionaccounts.api_transition_exam_plan(uuid, text, text, text, date, text, text, text, date) to service_role;

create or replace function missionaccounts.api_withdraw_exam_plan(
  p_plan_id uuid,
  p_today date,
  p_actor_id text,
  p_actor_role text,
  p_reason text,
  p_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  current_plan missionaccounts.exam_plan%rowtype;
  prior_transition missionaccounts.exam_transition%rowtype;
  transition_id uuid;
  audit_id uuid;
  transition_allowed boolean := false;
  closed_grace_windows integer := 0;
  recomputed jsonb;
begin
  if p_today is null
     or nullif(btrim(p_actor_id), '') is null
     or p_actor_role not in ('student','missionaccounts_admin','founder')
     or nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_exam_withdrawal_request';
  end if;

  select * into prior_transition
  from missionaccounts.exam_transition
  where request_id = p_request_id;
  if found then
    if prior_transition.exam_plan_id <> p_plan_id
       or prior_transition.to_state <> 'withdrawn'
       or prior_transition.actor_id <> p_actor_id
       or prior_transition.actor_role <> p_actor_role
       or prior_transition.reason is distinct from p_reason then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select * into current_plan from missionaccounts.exam_plan where id = p_plan_id;
    select id into audit_id
    from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'exam_plan.withdrawn';
    return jsonb_build_object(
      'accepted', prior_transition.accepted,
      'plan', to_jsonb(current_plan),
      'transition_id', prior_transition.id,
      'audit_event_id', audit_id,
      'duplicate', true
    );
  end if;

  select * into current_plan
  from missionaccounts.exam_plan
  where id = p_plan_id and superseded_by_id is null and withdrawn_at is null
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'current_exam_plan_not_found';
  end if;

  transition_allowed := current_plan.state <> 'passed' and (
    p_actor_role in ('missionaccounts_admin','founder')
    or exists (
      select 1 from missionaccounts.student s
      where s.id = current_plan.student_id and s.id::text = p_actor_id
    )
  );

  insert into missionaccounts.exam_transition(
    exam_plan_id, student_id, from_state, to_state, accepted, reason,
    actor_id, actor_role, request_id
  ) values (
    current_plan.id, current_plan.student_id, current_plan.state, 'withdrawn',
    transition_allowed, p_reason, p_actor_id, p_actor_role, p_request_id
  ) returning id into transition_id;

  if not transition_allowed then
    insert into missionaccounts.audit_event(
      actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
    ) values (
      p_actor_id, p_actor_role, current_plan.student_id, 'exam_plan.withdrawn',
      'Rejected exam-plan withdrawal', to_jsonb(current_plan.state), to_jsonb('withdrawn'::text),
      p_reason, p_request_id
    ) returning id into audit_id;
    return jsonb_build_object(
      'accepted', false,
      'plan', to_jsonb(current_plan),
      'transition_id', transition_id,
      'audit_event_id', audit_id,
      'duplicate', false
    );
  end if;

  update missionaccounts.grace_window
  set to_on = greatest(from_on, p_today),
      closed_reason = 'withdrawn',
      closed_at = now()
  where exam_plan_id = current_plan.id and to_on is null;
  get diagnostics closed_grace_windows = row_count;

  update missionaccounts.reminder
  set state = 'cancelled', cancelled_reason = 'plan_withdrawn', updated_at = now()
  where exam_plan_id = current_plan.id and state in ('scheduled','due');
  update missionaccounts.notification_outbox
  set state = 'cancelled', locked_by = null, locked_at = null, last_error = 'plan_withdrawn'
  where reminder_id in (
    select id from missionaccounts.reminder where exam_plan_id = current_plan.id
  ) and state in ('pending','failed','sending');

  update missionaccounts.exam_plan
  set withdrawn_at = now(), withdrawn_by = p_actor_id
  where id = current_plan.id
  returning * into current_plan;

  if closed_grace_windows > 0 then
    recomputed := missionaccounts.recompute_student_attendance(
      current_plan.student_id,
      p_request_id || ':exam-plan-withdrawn'
    );
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, current_plan.student_id, 'exam_plan.withdrawn',
    'Exam plan withdrawn',
    jsonb_build_object('state', current_plan.state, 'exam_on', current_plan.exam_on),
    jsonb_build_object('withdrawn_at', current_plan.withdrawn_at, 'closed_grace_windows', closed_grace_windows, 'attendance_recompute', recomputed),
    p_reason, p_request_id
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, audience, event_kind, payload, state, idempotency_key
  ) values (
    current_plan.student_id, 'matrix',
    case when p_actor_role = 'student' then 'missionaccounts_admin' else 'student' end,
    'exam_plan.withdrawn',
    jsonb_build_object('student_id', current_plan.student_id, 'exam_plan_id', current_plan.id),
    'pending', p_request_id || ':exam-plan-withdrawn'
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'accepted', true,
    'plan', to_jsonb(current_plan),
    'transition_id', transition_id,
    'audit_event_id', audit_id,
    'closed_grace_windows', closed_grace_windows,
    'attendance_recompute', recomputed,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_withdraw_exam_plan(uuid, date, text, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_withdraw_exam_plan(uuid, date, text, text, text, text) to service_role;

create or replace function missionaccounts.api_prepare_payment_method_removal(
  p_student_id uuid,
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
  student_row missionaccounts.student%rowtype;
  method_row missionaccounts.payment_method_private%rowtype;
  consent_result jsonb;
  audit_id uuid;
  existing_audit_id uuid;
  existing_subject_student_id uuid;
  existing_actor_id text;
begin
  if p_student_id is null
     or nullif(btrim(p_actor_id), '') is null
     or p_actor_role <> 'student'
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_payment_method_removal_request';
  end if;

  select * into student_row from missionaccounts.student where id = p_student_id for update;
  if not found then raise exception using errcode = '23503', message = 'student_not_found'; end if;
  if student_row.id::text is distinct from p_actor_id then
    raise exception using errcode = '42501', message = 'payment_method_removal_forbidden';
  end if;

  select id, subject_student_id, actor_id
  into existing_audit_id, existing_subject_student_id, existing_actor_id
  from missionaccounts.audit_event
  where request_id = p_request_id and kind = 'payment_method.removal_prepared';
  if found then
    if existing_subject_student_id is distinct from p_student_id
       or existing_actor_id is distinct from p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select * into method_row
    from missionaccounts.payment_method_private
    where student_id = p_student_id
    for update;
    if method_row.status = 'on_file' then
      update missionaccounts.payment_method_private
      set status = 'removal_pending', updated_at = now()
      where id = method_row.id returning * into method_row;
    end if;
    return jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'provider_payment_method_ref', method_row.provider_pm_ref,
      'payment_method', jsonb_build_object(
        'id', method_row.id, 'brand', method_row.brand, 'last4', method_row.last4,
        'exp_month', method_row.exp_month, 'exp_year', method_row.exp_year,
        'status', method_row.status, 'verified_at', method_row.verified_at
      )
    );
  end if;

  select * into method_row
  from missionaccounts.payment_method_private
  where student_id = p_student_id
  for update;
  if not found or method_row.status <> 'on_file' then
    return jsonb_build_object('accepted', false, 'reason', 'payment_method_not_on_file', 'duplicate', false);
  end if;

  if exists (
    select 1 from missionaccounts.billing_consent
    where student_id = p_student_id and superseded_by_id is null and state = 'authorized'
  ) then
    consent_result := missionaccounts.api_set_billing_consent(
      p_student_id, 'revoke', null, null,
      'Automatic billing authorization revoked because the payment method was removed',
      p_actor_id, p_actor_role, p_request_id || ':consent'
    );
    if consent_result->>'accepted' is distinct from 'true' then
      raise exception using errcode = '22023', message = 'payment_method_consent_revocation_failed';
    end if;
  end if;

  update missionaccounts.payment_method_private
  set status = 'removal_pending', updated_at = now()
  where id = method_row.id returning * into method_row;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'payment_method.removal_prepared',
    'Payment method removal prepared; automatic charges are disabled',
    jsonb_build_object('status', 'on_file'),
    jsonb_build_object('id', method_row.id, 'brand', method_row.brand, 'last4', method_row.last4, 'status', method_row.status),
    'Student requested payment method removal', p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'audit_event_id', audit_id,
    'provider_payment_method_ref', method_row.provider_pm_ref,
    'payment_method', jsonb_build_object(
      'id', method_row.id, 'brand', method_row.brand, 'last4', method_row.last4,
      'exp_month', method_row.exp_month, 'exp_year', method_row.exp_year,
      'status', method_row.status, 'verified_at', method_row.verified_at
    )
  );
end;
$$;

revoke execute on function missionaccounts.api_prepare_payment_method_removal(uuid, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_prepare_payment_method_removal(uuid, text, text, text) to service_role;

create or replace function missionaccounts.api_submit_attendance_issue(
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
  where id = p_student_id and id::text = p_actor_id;
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

revoke execute on function missionaccounts.api_submit_attendance_issue(uuid, text, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function missionaccounts.api_submit_attendance_issue(uuid, text, jsonb, text, text, text)
  to service_role;

commit;
