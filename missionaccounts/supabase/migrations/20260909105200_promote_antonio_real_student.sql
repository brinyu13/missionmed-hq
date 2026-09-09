-- MX-MISSIONACCOUNTS-5401R
-- Founder-authorized promotion of Antonio Patterson's existing verified,
-- Matrix-linked student record from an unresolved device alias to a real
-- student. Preserve the source alias as superseded evidence and do not touch
-- identity, attendance, Stripe customer, payment method, consent, invoice, or
-- charge custody.

do $$
declare
  promoted_student_id uuid;
  source_device_alias missionaccounts.identity_alias%rowtype;
  promoted_alias_id uuid := gen_random_uuid();
  changed_rows integer;
  repair_request_id constant text := 'MX-MISSIONACCOUNTS-5401R:antonio-real-student:1';
begin
  if exists (
    select 1 from missionaccounts.audit_event
    where request_id = repair_request_id and kind = 'identity.student_promoted'
  ) then
    if exists (
      select 1
      from missionaccounts.student student
      join missionaccounts.identity_alias alias on alias.student_id = student.id
      where student.display_name = 'Antonio Patterson'
        and student.identity_state = 'verified'
        and student.matrix_user_ref is not null
        and alias.relationship_state = 'verified'
        and alias.superseded_by_id is null
        and alias.source_key = 'founder-person-promotion:5401r:' || student.id::text
    ) and not exists (
      select 1
      from missionaccounts.student student
      join missionaccounts.identity_alias alias on alias.student_id = student.id
      where student.display_name = 'Antonio Patterson'
        and student.identity_state = 'verified'
        and student.matrix_user_ref is not null
        and alias.relationship_state = 'device'
        and alias.superseded_by_id is null
    ) then
      return;
    end if;
    raise exception using errcode = '23514', message = 'antonio_real_student_repair_state_mismatch';
  end if;

  select student.id into strict promoted_student_id
  from missionaccounts.student student
  where student.display_name = 'Antonio Patterson'
    and student.identity_state = 'verified'
    and student.matrix_user_ref is not null
    and exists (
      select 1 from missionaccounts.stripe_customer_private customer
      where customer.student_id = student.id
    )
    and exists (
      select 1 from missionaccounts.payment_method_private method
      where method.student_id = student.id and method.status = 'on_file'
    );

  select alias.* into strict source_device_alias
  from missionaccounts.identity_alias alias
  where alias.student_id = promoted_student_id
    and alias.relationship_state = 'device'
    and alias.superseded_by_id is null
  for update;

  if exists (
    select 1 from missionaccounts.device_identity_decision decision
    where decision.source_student_id = promoted_student_id
      and decision.superseded_by_id is null
  ) then
    raise exception using errcode = '23514', message = 'antonio_device_identity_decision_already_exists';
  end if;
  if exists (
    select 1
    from missionaccounts.identity_cluster cluster_row
    join missionaccounts.identity_cluster_member member on member.cluster_ref = cluster_row.ref
    where cluster_row.state = 'open'
      and member.identity_alias_id = source_device_alias.id
  ) then
    raise exception using errcode = '23514', message = 'antonio_device_alias_requires_cluster_review';
  end if;

  insert into missionaccounts.identity_alias(
    id, student_id, source_artifact_id, source_key, display_value,
    relationship_state, confidence, approved_by, approved_at
  ) values (
    promoted_alias_id, promoted_student_id, source_device_alias.source_artifact_id,
    'founder-person-promotion:5401r:' || promoted_student_id::text,
    source_device_alias.display_value, 'verified', 1.0000,
    'founder', now()
  );

  update missionaccounts.identity_alias
  set superseded_by_id = promoted_alias_id
  where id = source_device_alias.id and superseded_by_id is null;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception using errcode = '40001', message = 'antonio_device_alias_changed_concurrently';
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text,
    from_val, to_val, reason, request_id
  ) values (
    'founder:MX-MISSIONACCOUNTS-5401R', 'founder', promoted_student_id,
    'identity.student_promoted',
    'Promoted the existing verified Matrix-linked Antonio Patterson record to a real MissionAccounts student',
    jsonb_build_object('alias_id', source_device_alias.id, 'classification', 'device'),
    jsonb_build_object('alias_id', promoted_alias_id, 'classification', 'person'),
    'Founder explicitly confirmed Antonio is a real student and authorized adding him to the real-student list',
    repair_request_id
  );
end;
$$;
