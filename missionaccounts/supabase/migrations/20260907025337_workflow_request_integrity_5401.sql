-- MX-MISSIONACCOUNTS-5401R / DR-202, DR-203. Additive request-integrity repair.
-- Preserve old receipts, comp consumption, raw evidence, and applied migration history.
alter table missionaccounts.comp_allowance_change add column request_controls jsonb;

create or replace function missionaccounts.api_set_comp_allowance(
  p_student_id uuid,
  p_allowance integer,
  p_joined_on date,
  p_reason text,
  p_apply_retroactively boolean,
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
  existing_change missionaccounts.comp_allowance_change%rowtype;
  current_student missionaccounts.student%rowtype;
  updated_student missionaccounts.student%rowtype;
  change_id uuid;
  audit_id uuid;
  released_days integer := 0;
  recomputed jsonb;
  input_controls jsonb;
begin
  if p_actor_role is null or p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501', message = 'comp_admin_required';
  end if;
  if p_allowance is null or p_allowance < 0 or p_allowance > 365 then
    raise exception using errcode = '22023', message = 'invalid_comp_allowance';
  end if;
  if nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'comp_reason_actor_and_request_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:comp-request:' || p_request_id, 0));
  input_controls := jsonb_build_object('student_id',p_student_id,'allowance',p_allowance,'joined_on',p_joined_on,
    'reason',p_reason,'retroactive',p_apply_retroactively,'actor_id',p_actor_id,'actor_role',p_actor_role);
  select * into existing_change
  from missionaccounts.comp_allowance_change
  where request_id = p_request_id;

  if found then
    if existing_change.request_controls is not null and existing_change.request_controls <> input_controls then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    if existing_change.student_id <> p_student_id
       or existing_change.to_allowance <> p_allowance
       or existing_change.to_joined_at is distinct from coalesce(p_joined_on, existing_change.from_joined_at)
       or existing_change.reason <> p_reason
       or existing_change.apply_retroactively <> p_apply_retroactively
       or existing_change.actor_id <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select id into audit_id
    from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'comp_allowance.changed';
    select * into updated_student from missionaccounts.student where id = p_student_id;
    return jsonb_build_object(
      'student', to_jsonb(updated_student),
      'change_id', existing_change.id,
      'audit_event_id', audit_id,
      'released_days', 0,
      'duplicate', true
    );
  end if;

  select * into current_student
  from missionaccounts.student
  where id = p_student_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'student_not_found';
  end if;

  insert into missionaccounts.comp_allowance_change(
    student_id, from_allowance, to_allowance, from_joined_at, to_joined_at,
    apply_retroactively, reason, actor_id, request_id, request_controls
  ) values (
    p_student_id, current_student.comp_days_allowance, p_allowance, current_student.joined_at,
    coalesce(p_joined_on, current_student.joined_at), p_apply_retroactively, p_reason, p_actor_id, p_request_id, input_controls
  ) returning id into change_id;

  if p_apply_retroactively and p_allowance < current_student.comp_days_allowance then
    update missionaccounts.comp_day_consumption
    set released_by_change_id = change_id
    where student_id = p_student_id
      and released_by_change_id is null
      and comp_index > p_allowance;
    get diagnostics released_days = row_count;
  end if;

  update missionaccounts.student
  set comp_days_allowance = p_allowance,
      joined_at = coalesce(p_joined_on, joined_at),
      updated_at = now()
  where id = p_student_id
  returning * into updated_student;

  recomputed := missionaccounts.recompute_student_attendance(
    p_student_id,
    p_request_id || ':comp-allowance'
  );

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id,
    p_actor_role,
    p_student_id,
    'comp_allowance.changed',
    'Comp-day allowance changed',
    jsonb_build_object('allowance', current_student.comp_days_allowance, 'joined_on', current_student.joined_at),
    jsonb_build_object(
      'allowance', p_allowance,
      'joined_on', updated_student.joined_at,
      'apply_retroactively', p_apply_retroactively,
      'released_days', released_days,
      'attendance_recompute', recomputed
    ),
    p_reason,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'student', to_jsonb(updated_student),
    'change_id', change_id,
    'audit_event_id', audit_id,
    'released_days', released_days,
    'attendance_recompute', recomputed,
    'duplicate', false
  );
end;
$$;

create or replace function missionaccounts.api_link_student_account(
  p_student_id uuid,
  p_matrix_user_ref text,
  p_joined_on date,
  p_today date,
  p_reason text,
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
  existing_change missionaccounts.account_link_change%rowtype;
  current_student missionaccounts.student%rowtype;
  updated_student missionaccounts.student%rowtype;
  change_id uuid;
  audit_id uuid;
  effective_joined_on date;
  effective_allowance integer;
  recomputed jsonb;
begin
  if p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501', message = 'account_link_admin_required';
  end if;
  if p_matrix_user_ref is null
     or p_matrix_user_ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_today is null
     or nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'account_link_fields_invalid';
  end if;

  select * into existing_change
  from missionaccounts.account_link_change
  where request_id = p_request_id;

  if found then
    if existing_change.student_id <> p_student_id
       or existing_change.to_matrix_user_ref <> lower(p_matrix_user_ref)
       or existing_change.reason <> p_reason
       or existing_change.actor_id <> p_actor_id
       or existing_change.actor_role <> p_actor_role
       or (p_joined_on is not null and existing_change.to_joined_at <> p_joined_on) then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select * into updated_student from missionaccounts.student where id = p_student_id;
    select id into audit_id
    from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'account_link.changed';
    return jsonb_build_object(
      'student', to_jsonb(updated_student),
      'change_id', existing_change.id,
      'audit_event_id', audit_id,
      'attendance_recompute', null,
      'duplicate', true
    );
  end if;

  select * into current_student
  from missionaccounts.student
  where id = p_student_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'student_not_found';
  end if;
  if current_student.matrix_user_ref is not null then
    raise exception using errcode = '23505', message = 'student_account_already_linked';
  end if;
  if exists (
    select 1 from missionaccounts.student
    where matrix_user_ref = lower(p_matrix_user_ref) and id <> p_student_id
  ) then
    raise exception using errcode = '23505', message = 'matrix_account_already_linked';
  end if;

  select coalesce(
    p_joined_on,
    current_student.joined_at,
    min(ae.local_day),
    p_today
  ) into effective_joined_on
  from missionaccounts.attendance_event ae
  where ae.student_id = p_student_id;

  effective_allowance := case
    when current_student.comp_days_allowance > 0 or exists (select 1 from missionaccounts.comp_allowance_change where student_id = p_student_id) then current_student.comp_days_allowance
    when effective_joined_on > date '2026-09-05' then 5
    else 0
  end;

  insert into missionaccounts.account_link_change(
    student_id, from_matrix_user_ref, to_matrix_user_ref,
    from_joined_at, to_joined_at,
    from_comp_days_allowance, to_comp_days_allowance,
    reason, actor_id, actor_role, request_id
  ) values (
    p_student_id, current_student.matrix_user_ref, lower(p_matrix_user_ref),
    current_student.joined_at, effective_joined_on,
    current_student.comp_days_allowance, effective_allowance,
    p_reason, p_actor_id, p_actor_role, p_request_id
  ) returning id into change_id;

  update missionaccounts.student
  set matrix_user_ref = lower(p_matrix_user_ref),
      joined_at = effective_joined_on,
      comp_days_allowance = effective_allowance,
      updated_at = now()
  where id = p_student_id
  returning * into updated_student;

  recomputed := missionaccounts.recompute_student_attendance(
    p_student_id,
    p_request_id || ':account-link'
  );

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id,
    p_actor_role,
    p_student_id,
    'account_link.changed',
    'MissionAccounts Matrix identity linked',
    jsonb_build_object(
      'matrix_user_ref', current_student.matrix_user_ref,
      'joined_on', current_student.joined_at,
      'comp_days_allowance', current_student.comp_days_allowance
    ),
    jsonb_build_object(
      'matrix_user_ref', updated_student.matrix_user_ref,
      'joined_on', updated_student.joined_at,
      'comp_days_allowance', updated_student.comp_days_allowance,
      'default_comp_applied', current_student.comp_days_allowance = 0 and effective_allowance = 5
    ),
    p_reason,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'student', to_jsonb(updated_student),
    'change_id', change_id,
    'audit_event_id', audit_id,
    'attendance_recompute', recomputed,
    'duplicate', false
  );
end;
$$;
