-- MX-MISSIONACCOUNTS-5403B: bounded automatic-billing contract closeout.
-- This migration is additive and intentionally leaves live dispatch disabled.
-- It publishes no billing terms and creates no Stripe object or charge.

alter table missionaccounts.billing_terms
  add column if not exists body_text text;

create function missionaccounts.enforce_billing_terms_body()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts, extensions
as $$
begin
  if new.status = 'approved' then
    if nullif(btrim(new.body_text), '') is null then
      raise exception using errcode = '23514', message = 'approved_billing_terms_body_required';
    end if;
    if encode(extensions.digest(convert_to(new.body_text, 'UTF8'), 'sha256'), 'hex') <> new.body_sha256 then
      raise exception using errcode = '23514', message = 'billing_terms_body_hash_mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists billing_terms_body_integrity on missionaccounts.billing_terms;
create trigger billing_terms_body_integrity
before insert or update of body_text, body_sha256, status
on missionaccounts.billing_terms
for each row execute function missionaccounts.enforce_billing_terms_body();

create table missionaccounts.program_enrollment_projection (
  student_id uuid not null references missionaccounts.student(id),
  program_key text not null check (program_key = 'examprep'),
  provider text not null check (provider = 'learndash'),
  course_id bigint not null check (course_id = 6357),
  enrolled boolean not null,
  source_subject text not null,
  source_observed_at timestamptz not null,
  verified_at timestamptz not null,
  valid_until timestamptz not null,
  last_request_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, program_key),
  check (valid_until > source_observed_at)
);

create index program_enrollment_projection_fresh_idx
  on missionaccounts.program_enrollment_projection(program_key, enrolled, valid_until, student_id);

create table missionaccounts.automatic_billing_contract (
  singleton boolean primary key default true check (singleton),
  course_id bigint not null default 6357 check (course_id = 6357),
  amount_per_day_cents integer not null default 2500 check (amount_per_day_cents = 2500),
  rollout_cutoff timestamptz not null,
  enrollment_freshness interval not null default interval '6 hours'
    check (enrollment_freshness > interval '0' and enrollment_freshness <= interval '24 hours'),
  eligible_delay interval not null default interval '24 hours'
    check (eligible_delay >= interval '24 hours'),
  live_dispatch_allowed boolean not null default false,
  initial_canary_requires_admin_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into missionaccounts.automatic_billing_contract(
  singleton, course_id, amount_per_day_cents, rollout_cutoff,
  enrollment_freshness, eligible_delay, live_dispatch_allowed,
  initial_canary_requires_admin_approval
) values (
  true, 6357, 2500, transaction_timestamp(),
  interval '6 hours', interval '24 hours', false, true
)
on conflict (singleton) do nothing;

alter table missionaccounts.auto_charge_dispatch
  add column if not exists eligible_after timestamptz,
  add column if not exists rollout_cutoff timestamptz,
  add column if not exists attendance_finalized_at timestamptz,
  add column if not exists provenance jsonb not null default '{}'::jsonb,
  add column if not exists held_at timestamptz,
  add column if not exists hold_reason text;

alter table missionaccounts.auto_charge_dispatch
  drop constraint if exists auto_charge_dispatch_state_check;
alter table missionaccounts.auto_charge_dispatch
  add constraint auto_charge_dispatch_state_check check (
    state in ('eligible','claimed','submitted','failed','expired','pending','held','excluded','reversed')
  );

create index auto_charge_dispatch_pending_idx
  on missionaccounts.auto_charge_dispatch(eligible_after, created_at, id)
  where state = 'pending';

create function missionaccounts.api_sync_program_enrollment(
  p_student_id uuid,
  p_program_key text,
  p_course_id bigint,
  p_enrolled boolean,
  p_source_subject text,
  p_source_observed_at timestamptz,
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
  contract_row missionaccounts.automatic_billing_contract%rowtype;
  projection_row missionaccounts.program_enrollment_projection%rowtype;
  existing_event missionaccounts.audit_event%rowtype;
  audit_id uuid;
  fingerprint jsonb;
begin
  if p_student_id is null
     or p_program_key <> 'examprep'
     or p_course_id <> 6357
     or p_enrolled is null
     or nullif(btrim(p_source_subject), '') is null
     or p_source_observed_at is null
     or nullif(btrim(p_actor_id), '') is null
     or p_actor_role <> 'student'
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_program_enrollment_projection';
  end if;

  fingerprint := jsonb_build_object(
    'student_id', p_student_id,
    'program_key', p_program_key,
    'course_id', p_course_id,
    'enrolled', p_enrolled,
    'source_subject', p_source_subject,
    'source_observed_at', p_source_observed_at,
    'actor_id', p_actor_id
  );

  select * into existing_event
  from missionaccounts.audit_event
  where request_id = p_request_id and kind = 'program_enrollment.observed';
  if found then
    if existing_event.to_val->'request' <> fingerprint then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select * into projection_row
    from missionaccounts.program_enrollment_projection
    where student_id = p_student_id and program_key = p_program_key;
    return jsonb_build_object(
      'accepted', true, 'duplicate', true,
      'projection', to_jsonb(projection_row), 'audit_event_id', existing_event.id
    );
  end if;

  select * into student_row
  from missionaccounts.student
  where id = p_student_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'student_not_found';
  end if;
  if student_row.identity_state <> 'verified'
     or student_row.matrix_user_ref is distinct from p_actor_id
     or p_source_subject is distinct from p_actor_id then
    raise exception using errcode = '42501', message = 'student_enrollment_subject_mismatch';
  end if;

  select * into contract_row
  from missionaccounts.automatic_billing_contract
  where singleton = true;
  if not found or contract_row.course_id <> p_course_id then
    raise exception using errcode = '55000', message = 'automatic_billing_contract_unavailable';
  end if;
  if p_source_observed_at < clock_timestamp() - interval '15 minutes'
     or p_source_observed_at > clock_timestamp() + interval '1 minute' then
    raise exception using errcode = '22023', message = 'program_enrollment_observation_stale';
  end if;

  insert into missionaccounts.program_enrollment_projection(
    student_id, program_key, provider, course_id, enrolled,
    source_subject, source_observed_at, verified_at, valid_until,
    last_request_id, updated_at
  ) values (
    p_student_id, p_program_key, 'learndash', p_course_id, p_enrolled,
    p_source_subject, p_source_observed_at, clock_timestamp(),
    p_source_observed_at + contract_row.enrollment_freshness,
    p_request_id, clock_timestamp()
  )
  on conflict (student_id, program_key) do update set
    provider = excluded.provider,
    course_id = excluded.course_id,
    enrolled = excluded.enrolled,
    source_subject = excluded.source_subject,
    source_observed_at = excluded.source_observed_at,
    verified_at = excluded.verified_at,
    valid_until = excluded.valid_until,
    last_request_id = excluded.last_request_id,
    updated_at = excluded.updated_at
  returning * into projection_row;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'program_enrollment.observed',
    'Observed signed LearnDash ExamPrep access for automatic-billing eligibility',
    jsonb_build_object(
      'request', fingerprint,
      'projection', jsonb_build_object(
        'program_key', projection_row.program_key,
        'provider', projection_row.provider,
        'course_id', projection_row.course_id,
        'enrolled', projection_row.enrolled,
        'source_observed_at', projection_row.source_observed_at,
        'valid_until', projection_row.valid_until
      )
    ),
    case when p_enrolled then 'signed_course_access_active' else 'signed_course_access_inactive' end,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true, 'duplicate', false,
    'projection', to_jsonb(projection_row), 'audit_event_id', audit_id
  );
end;
$$;

create function missionaccounts.api_refresh_auto_charge_candidates(p_now timestamptz)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  contract_row missionaccounts.automatic_billing_contract%rowtype;
  inserted_count integer := 0;
begin
  if p_now is null then
    raise exception using errcode = '22023', message = 'invalid_auto_charge_refresh';
  end if;
  select * into contract_row
  from missionaccounts.automatic_billing_contract
  where singleton = true;
  if not found then
    raise exception using errcode = '55000', message = 'automatic_billing_contract_unavailable';
  end if;

  insert into missionaccounts.auto_charge_dispatch(
    attendance_day_id, state, idempotency_key, eligible_after,
    rollout_cutoff, attendance_finalized_at, provenance
  )
  select
    ad.id,
    'pending',
    'missionaccounts:auto-charge:' || ad.id::text || ':v2',
    ad.computed_at + contract_row.eligible_delay,
    contract_row.rollout_cutoff,
    ad.computed_at,
    jsonb_build_object(
      'contract', 'MX-MISSIONACCOUNTS-5403B',
      'course_id', contract_row.course_id,
      'rollout_cutoff', contract_row.rollout_cutoff,
      'attendance_day', ad.day,
      'attendance_finalized_at', ad.computed_at,
      'created_without_provider_action', true
    )
  from missionaccounts.attendance_day ad
  join missionaccounts.student s
    on s.id = ad.student_id
   and s.identity_state = 'verified'
   and coalesce(s.sponsor_type, 'DIRECT') = 'DIRECT'
  join missionaccounts.program_enrollment_projection ep
    on ep.student_id = ad.student_id
   and ep.program_key = 'examprep'
   and ep.provider = 'learndash'
   and ep.course_id = contract_row.course_id
   and ep.enrolled is true
   and ep.valid_until > p_now
  join missionaccounts.billing_decision bd
    on bd.student_id = ad.student_id
   and bd.cycle_key = ad.cycle_key
   and bd.superseded_by_id is null
   and bd.state = 'approved'
   and bd.treatment = 'confirm'
  join missionaccounts.payment_method_private pm
    on pm.student_id = ad.student_id and pm.status = 'on_file'
  join missionaccounts.billing_consent bc
    on bc.student_id = ad.student_id
   and bc.superseded_by_id is null
   and bc.state = 'authorized'
  where ad.superseded_at is null
    and ad.kind = 'billable'
    and ad.day >= (contract_row.rollout_cutoff at time zone 'America/New_York')::date
    and ad.computed_at >= contract_row.rollout_cutoff
    and exists (
      select 1 from missionaccounts.rule_decision rd
      where rd.rule = 'one_charge_per_calendar_day'
        and rd.superseded_by_id is null and rd.effective_from <= ad.day
    )
    and exists (
      select 1
      from jsonb_array_elements(coalesce(bd.basis->'days', bd.basis->'day_states', '[]'::jsonb)) approved_day
      where approved_day->>'id' = ad.id::text and approved_day->>'kind' = 'billable'
    )
    and not exists (
      select 1 from missionaccounts.charge c
      where c.attendance_day_id = ad.id
    )
  on conflict (attendance_day_id) do nothing;
  get diagnostics inserted_count = row_count;

  return jsonb_build_object(
    'accepted', true,
    'inserted', inserted_count,
    'rollout_cutoff', contract_row.rollout_cutoff,
    'live_dispatch_allowed', contract_row.live_dispatch_allowed,
    'live_money_moved_cents', 0,
    'now', p_now
  );
end;
$$;

create or replace function missionaccounts.api_set_billing_consent(
  p_student_id uuid,
  p_action text,
  p_terms_version text,
  p_accepted_ip inet,
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
  student_row missionaccounts.student%rowtype;
  current_consent missionaccounts.billing_consent%rowtype;
  existing_consent missionaccounts.billing_consent%rowtype;
  new_consent missionaccounts.billing_consent%rowtype;
  consent_id uuid := gen_random_uuid();
  audit_id uuid;
  rejection_reason text;
  effective_terms_version text;
  request_fingerprint jsonb;
  existing_rejection jsonb;
begin
  if p_student_id is null
     or p_action is null or p_action not in ('authorize','revoke')
     or nullif(btrim(p_actor_id), '') is null
     or p_actor_role <> 'student'
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_billing_consent_request';
  end if;

  request_fingerprint := jsonb_build_object(
    'student_id', p_student_id,
    'action', p_action,
    'terms_version', p_terms_version,
    'reason', p_reason,
    'actor_id', p_actor_id
  );

  select * into existing_consent
  from missionaccounts.billing_consent
  where request_id = p_request_id;
  if found then
    if existing_consent.student_id <> p_student_id
       or existing_consent.actor_id <> p_actor_id
       or (p_action = 'authorize' and (existing_consent.state <> 'authorized' or existing_consent.terms_version is distinct from p_terms_version))
       or (p_action = 'revoke' and existing_consent.state <> 'revoked') then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select id into audit_id from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'billing_consent.changed';
    return jsonb_build_object('accepted', true, 'consent', to_jsonb(existing_consent), 'audit_event_id', audit_id, 'duplicate', true);
  end if;

  select to_val into existing_rejection
  from missionaccounts.audit_event
  where request_id = p_request_id and kind = 'billing_consent.rejected';
  if found then
    if existing_rejection->'request' <> request_fingerprint then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    return jsonb_build_object(
      'accepted', false,
      'reason', existing_rejection->>'reason',
      'audit_event_id', (select id from missionaccounts.audit_event where request_id = p_request_id and kind = 'billing_consent.rejected'),
      'duplicate', true
    );
  end if;

  select * into student_row
  from missionaccounts.student
  where id = p_student_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'student_not_found';
  end if;
  if student_row.identity_state <> 'verified'
     or student_row.matrix_user_ref is null
     or student_row.matrix_user_ref is distinct from p_actor_id then
    raise exception using errcode = '42501', message = 'student_consent_subject_mismatch';
  end if;

  select * into current_consent
  from missionaccounts.billing_consent
  where student_id = p_student_id and superseded_by_id is null
  for update;

  if p_action = 'authorize' then
    effective_terms_version := nullif(btrim(p_terms_version), '');
    if coalesce(student_row.sponsor_type, 'DIRECT') <> 'DIRECT' then
      rejection_reason := 'sponsored_direct_liability_blocked';
    elsif not exists (
      select 1
      from missionaccounts.program_enrollment_projection ep
      join missionaccounts.automatic_billing_contract contract on contract.singleton = true
      where ep.student_id = p_student_id
        and ep.program_key = 'examprep'
        and ep.provider = 'learndash'
        and ep.course_id = contract.course_id
        and ep.enrolled is true
        and ep.valid_until > clock_timestamp()
    ) then rejection_reason := 'active_examprep_enrollment_required';
    elsif effective_terms_version is null or not exists (
      select 1 from missionaccounts.billing_terms
      where version = effective_terms_version
        and status = 'approved'
        and nullif(btrim(body_text), '') is not null
        and encode(extensions.digest(convert_to(body_text, 'UTF8'), 'sha256'), 'hex') = body_sha256
    ) then rejection_reason := 'approved_billing_terms_required';
    elsif not exists (
      select 1 from missionaccounts.payment_method_private
      where student_id = p_student_id and status = 'on_file'
    ) then rejection_reason := 'payment_method_required';
    elsif current_consent.id is not null
       and current_consent.state = 'authorized'
       and current_consent.terms_version = effective_terms_version then
      rejection_reason := 'authorization_already_active';
    end if;
  else
    effective_terms_version := current_consent.terms_version;
    if current_consent.id is null or current_consent.state <> 'authorized' then
      rejection_reason := 'active_authorization_not_found';
    end if;
  end if;

  if rejection_reason is not null then
    insert into missionaccounts.audit_event(
      actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
    ) values (
      p_actor_id, p_actor_role, p_student_id, 'billing_consent.rejected',
      'Automatic billing consent change rejected by server authority',
      jsonb_build_object('request', request_fingerprint, 'reason', rejection_reason),
      rejection_reason, p_request_id
    ) returning id into audit_id;
    return jsonb_build_object('accepted', false, 'reason', rejection_reason, 'audit_event_id', audit_id, 'duplicate', false);
  end if;

  if current_consent.id is not null then
    insert into missionaccounts.billing_consent(
      id, student_id, terms_version, accepted_at, accepted_ip, revoked_at, state,
      actor_id, request_id, superseded_by_id
    ) values (
      consent_id, p_student_id, effective_terms_version,
      case when p_action = 'authorize' then clock_timestamp() else current_consent.accepted_at end,
      case when p_action = 'authorize' then p_accepted_ip else current_consent.accepted_ip end,
      case when p_action = 'revoke' then clock_timestamp() else null end,
      case when p_action = 'authorize' then 'authorized' else 'revoked' end,
      p_actor_id, p_request_id, current_consent.id
    );
    update missionaccounts.billing_consent
    set superseded_by_id = consent_id
    where id = current_consent.id;
    update missionaccounts.billing_consent
    set superseded_by_id = null
    where id = consent_id
    returning * into new_consent;
  else
    insert into missionaccounts.billing_consent(
      id, student_id, terms_version, accepted_at, accepted_ip, revoked_at,
      state, actor_id, request_id
    ) values (
      consent_id, p_student_id, effective_terms_version, clock_timestamp(),
      p_accepted_ip, null, 'authorized', p_actor_id, p_request_id
    ) returning * into new_consent;
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'billing_consent.changed',
    case when p_action = 'authorize'
      then 'Automatic Drills billing authorized by the authenticated student'
      else 'Automatic Drills billing revoked by the authenticated student'
    end,
    case when current_consent.id is null then null else to_jsonb(current_consent) end,
    to_jsonb(new_consent), p_reason, p_request_id
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, audience, event_kind, payload, state, idempotency_key
  ) values (
    p_student_id, 'matrix', 'missionaccounts_admin', 'billing_consent.' || p_action,
    jsonb_build_object('student_id', p_student_id, 'state', new_consent.state, 'terms_version', new_consent.terms_version),
    'pending', p_request_id || ':billing-consent'
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object('accepted', true, 'consent', to_jsonb(new_consent), 'audit_event_id', audit_id, 'duplicate', false);
end;
$$;
create or replace function missionaccounts.api_prepare_day_charge(
  p_attendance_day_id uuid,
  p_actor_id text,
  p_actor_role text,
  p_request_id text,
  p_explicit_retry boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  day_row missionaccounts.attendance_day%rowtype;
  student_row missionaccounts.student%rowtype;
  decision_row missionaccounts.billing_decision%rowtype;
  method_row missionaccounts.payment_method_private%rowtype;
  consent_row missionaccounts.billing_consent%rowtype;
  contract_row missionaccounts.automatic_billing_contract%rowtype;
  dispatch_row missionaccounts.auto_charge_dispatch%rowtype;
  charge_row missionaccounts.charge%rowtype;
  attempt_row missionaccounts.charge_attempt%rowtype;
  reserved_amount_cents integer := 0;
  audit_id uuid;
  rejection_reason text;
  request_fingerprint jsonb;
  existing_rejection jsonb;
begin
  if p_attendance_day_id is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_day_charge_request';
  end if;

  if p_actor_role <> 'service' or p_actor_id <> 'missionaccounts:auto-charge' then
    raise exception using errcode = '42501', message = 'automatic_billing_service_authority_required';
  end if;

  request_fingerprint := jsonb_build_object(
    'attendance_day_id', p_attendance_day_id,
    'actor_id', p_actor_id,
    'explicit_retry', p_explicit_retry
  );

  select ca.* into attempt_row
  from missionaccounts.charge_attempt ca
  join missionaccounts.charge c on c.id = ca.charge_id
  where ca.provider_request_id = p_request_id;
  if found then
    select * into charge_row from missionaccounts.charge where id = attempt_row.charge_id;
    if charge_row.attendance_day_id <> p_attendance_day_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select * into method_row from missionaccounts.payment_method_private where student_id = charge_row.student_id;
    select * into student_row from missionaccounts.student where id = charge_row.student_id;
    return jsonb_build_object(
      'accepted', true, 'duplicate', true,
      'charge', jsonb_build_object(
        'id', charge_row.id, 'student_id', charge_row.student_id,
        'attendance_day_id', charge_row.attendance_day_id, 'amount_cents', charge_row.amount_cents,
        'state', charge_row.state, 'idempotency_key', charge_row.idempotency_key
      ),
      'customer_ref', method_row.provider_customer_ref,
      'payment_method_ref', method_row.provider_pm_ref,
      'receipt_email', student_row.email
    );
  end if;

  select to_val into existing_rejection
  from missionaccounts.audit_event
  where request_id = p_request_id and kind = 'charge.rejected';
  if found then
    if existing_rejection->'request' <> request_fingerprint then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    return jsonb_build_object(
      'accepted', false, 'duplicate', true,
      'reason', existing_rejection->>'reason',
      'audit_event_id', (select id from missionaccounts.audit_event where request_id = p_request_id and kind = 'charge.rejected')
    );
  end if;

  select * into day_row
  from missionaccounts.attendance_day
  where id = p_attendance_day_id and superseded_at is null
  for update;
  if not found then rejection_reason := 'current_attendance_day_not_found'; end if;

  if rejection_reason is null then
    select * into student_row from missionaccounts.student where id = day_row.student_id for update;
    if student_row.identity_state <> 'verified' then rejection_reason := 'student_identity_requires_review'; end if;
  end if;
  if rejection_reason is null and day_row.kind <> 'billable' then rejection_reason := 'attendance_day_not_billable'; end if;

  if rejection_reason is null then
    select * into contract_row
    from missionaccounts.automatic_billing_contract
    where singleton = true;
    if not found or contract_row.live_dispatch_allowed is not true then
      rejection_reason := 'automatic_billing_dispatch_disabled';
    elsif day_row.day < (contract_row.rollout_cutoff at time zone 'America/New_York')::date
       or day_row.computed_at < contract_row.rollout_cutoff then
      rejection_reason := 'pre_rollout_attendance_not_chargeable';
    end if;
  end if;

  if rejection_reason is null then
    select * into dispatch_row
    from missionaccounts.auto_charge_dispatch
    where attendance_day_id = day_row.id
    for update;
    if not found
       or dispatch_row.state <> 'claimed'
       or dispatch_row.idempotency_key is distinct from p_request_id
       or dispatch_row.eligible_after is null
       or dispatch_row.eligible_after > clock_timestamp()
       or dispatch_row.rollout_cutoff is distinct from contract_row.rollout_cutoff
       or dispatch_row.attendance_finalized_at is distinct from day_row.computed_at then
      rejection_reason := 'durable_charge_candidate_required';
    end if;
  end if;

  if rejection_reason is null and coalesce(student_row.sponsor_type, 'DIRECT') <> 'DIRECT' then
    rejection_reason := 'sponsored_direct_liability_blocked';
  end if;

  if rejection_reason is null and not exists (
    select 1
    from missionaccounts.program_enrollment_projection ep
    where ep.student_id = day_row.student_id
      and ep.program_key = 'examprep'
      and ep.provider = 'learndash'
      and ep.course_id = contract_row.course_id
      and ep.enrolled is true
      and ep.valid_until > clock_timestamp()
  ) then rejection_reason := 'active_examprep_enrollment_required'; end if;

  if rejection_reason is null then
    select * into decision_row
    from missionaccounts.billing_decision
    where student_id = day_row.student_id and cycle_key = day_row.cycle_key
      and superseded_by_id is null and state = 'approved'
    for update;
    if not found then rejection_reason := 'approved_billing_decision_required';
    elsif decision_row.treatment <> 'confirm' then rejection_reason := 'per_day_billing_decision_required';
    elsif not exists (
      select 1
      from jsonb_array_elements(coalesce(decision_row.basis->'days', decision_row.basis->'day_states', '[]'::jsonb)) as approved_day
      where approved_day->>'id' = day_row.id::text and approved_day->>'kind' = 'billable'
    ) then rejection_reason := 'attendance_day_not_in_approved_basis';
    end if;
  end if;

  if rejection_reason is null then
    select * into method_row
    from missionaccounts.payment_method_private
    where student_id = day_row.student_id
    for update;
    if method_row.id is null or method_row.status <> 'on_file' then rejection_reason := 'payment_method_required'; end if;
  end if;

  if rejection_reason is null then
    select * into consent_row
    from missionaccounts.billing_consent
    where student_id = day_row.student_id and superseded_by_id is null
    for update;
    if consent_row.id is null or consent_row.state <> 'authorized' then rejection_reason := 'billing_authorization_required'; end if;
  end if;

  if rejection_reason is null and not exists (
    select 1 from missionaccounts.billing_terms bt
    where bt.version = consent_row.terms_version
      and bt.status = 'approved'
      and nullif(btrim(bt.body_text), '') is not null
      and encode(extensions.digest(convert_to(bt.body_text, 'UTF8'), 'sha256'), 'hex') = bt.body_sha256
  ) then rejection_reason := 'approved_billing_terms_required'; end if;

  if rejection_reason is null and (
    nullif(btrim(student_row.email), '') is null
    or lower(btrim(student_row.email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then rejection_reason := 'student_receipt_email_required'; end if;

  if rejection_reason is null then
    select * into charge_row
    from missionaccounts.charge
    where attendance_day_id = day_row.id
    for update;
    if charge_row.id is not null then
      if charge_row.state = 'failed' and p_explicit_retry is not true then rejection_reason := 'explicit_retry_required';
      elsif charge_row.state = 'failed' then null;
      elsif charge_row.state = 'succeeded' then rejection_reason := 'charge_already_succeeded';
      elsif charge_row.state = 'refunded' then rejection_reason := 'refunded_day_requires_review';
      else rejection_reason := 'charge_already_pending';
      end if;
    end if;
  end if;

  if rejection_reason is null then
    select coalesce(sum(c.amount_cents), 0)::integer into reserved_amount_cents
    from missionaccounts.charge c
    join missionaccounts.attendance_day ad on ad.id = c.attendance_day_id
    where ad.student_id = day_row.student_id and ad.cycle_key = day_row.cycle_key
      and c.state in ('pending','succeeded')
      and (charge_row.id is null or c.id <> charge_row.id);
    if reserved_amount_cents + 2500 > decision_row.amount_cents then
      rejection_reason := 'approved_amount_exhausted';
    end if;
  end if;

  if rejection_reason is not null then
    insert into missionaccounts.audit_event(
      actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
    ) values (
      p_actor_id, p_actor_role, day_row.student_id, 'charge.rejected',
      'Automatic day charge rejected by server authority',
      jsonb_build_object('request', request_fingerprint, 'reason', rejection_reason),
      rejection_reason, p_request_id
    ) returning id into audit_id;
    return jsonb_build_object('accepted', false, 'duplicate', false, 'reason', rejection_reason, 'audit_event_id', audit_id);
  end if;

  if charge_row.id is null then
    insert into missionaccounts.charge(
      student_id, attendance_day_id, amount_cents, state, idempotency_key
    ) values (
      day_row.student_id, day_row.id, 2500, 'pending',
      'missionaccounts:billable-day:' || day_row.id::text || ':v1'
    ) returning * into charge_row;
  else
    update missionaccounts.charge set state = 'pending', updated_at = now()
    where id = charge_row.id returning * into charge_row;
  end if;

  insert into missionaccounts.charge_attempt(
    charge_id, provider_request_id, state, explicit_retry
  ) values (charge_row.id, p_request_id, 'started', p_explicit_retry)
  returning * into attempt_row;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, day_row.student_id, 'charge.started',
    'Authorized a single $25 attendance-day charge for Stripe dispatch',
    jsonb_build_object(
      'charge_id', charge_row.id, 'attendance_day_id', charge_row.attendance_day_id,
      'amount_cents', charge_row.amount_cents, 'state', charge_row.state,
      'explicit_retry', p_explicit_retry
    ),
    'server_authorized_day_charge', p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true, 'duplicate', false, 'audit_event_id', audit_id,
    'charge', jsonb_build_object(
      'id', charge_row.id, 'student_id', charge_row.student_id,
      'attendance_day_id', charge_row.attendance_day_id, 'amount_cents', charge_row.amount_cents,
      'state', charge_row.state, 'idempotency_key', charge_row.idempotency_key
    ),
    'customer_ref', method_row.provider_customer_ref,
    'payment_method_ref', method_row.provider_pm_ref,
    'receipt_email', lower(btrim(student_row.email))
  );
end;
$$;

revoke execute on function missionaccounts.api_prepare_day_charge(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function missionaccounts.api_prepare_day_charge(uuid, text, text, text, boolean) to service_role;

create or replace function missionaccounts.api_claim_due_day_charges(
  p_now timestamptz,
  p_worker_id text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  contract_row missionaccounts.automatic_billing_contract%rowtype;
  candidate record;
  prepared jsonb;
  refresh_result jsonb;
  claimed_items jsonb := '[]'::jsonb;
  held_count integer := 0;
begin
  if p_now is null
     or nullif(btrim(p_worker_id), '') is null
     or p_limit < 1 or p_limit > 25 then
    raise exception using errcode = '22023', message = 'invalid_auto_charge_claim';
  end if;

  refresh_result := missionaccounts.api_refresh_auto_charge_candidates(p_now);
  select * into contract_row
  from missionaccounts.automatic_billing_contract
  where singleton = true;
  if not found or contract_row.live_dispatch_allowed is not true then
    return jsonb_build_object(
      'claimed', claimed_items,
      'held', 0,
      'refresh', refresh_result,
      'reason', 'automatic_billing_dispatch_disabled',
      'now', p_now
    );
  end if;

  -- A worker that disappeared after claiming may have contacted the provider.
  -- Hold that row for human review; never reclaim it silently.
  update missionaccounts.auto_charge_dispatch
  set state = 'held', worker_id = null, locked_at = null,
      held_at = p_now, hold_reason = 'stale_claim_requires_review',
      last_error = 'stale_claim_requires_review', updated_at = p_now
  where state = 'claimed' and locked_at < p_now - interval '10 minutes';
  get diagnostics held_count = row_count;

  for candidate in
    select d.id, d.attendance_day_id, d.idempotency_key
    from missionaccounts.auto_charge_dispatch d
    join missionaccounts.attendance_day ad on ad.id = d.attendance_day_id
    where d.state = 'pending'
      and d.eligible_after is not null
      and d.eligible_after <= p_now
      and d.rollout_cutoff = contract_row.rollout_cutoff
      and d.attendance_finalized_at = ad.computed_at
      and ad.superseded_at is null
      and ad.day >= (contract_row.rollout_cutoff at time zone 'America/New_York')::date
      and ad.computed_at >= contract_row.rollout_cutoff
    order by d.eligible_after, d.created_at, d.id
    for update of d skip locked
    limit p_limit
  loop
    update missionaccounts.auto_charge_dispatch
    set state = 'claimed', worker_id = p_worker_id, locked_at = p_now,
        attempt_count = attempt_count + 1, last_error = null,
        hold_reason = null, held_at = null, updated_at = p_now
    where id = candidate.id;

    prepared := missionaccounts.api_prepare_day_charge(
      candidate.attendance_day_id,
      'missionaccounts:auto-charge',
      'service',
      candidate.idempotency_key,
      false
    );

    if coalesce((prepared->>'accepted')::boolean, false) then
      claimed_items := claimed_items || jsonb_build_array(jsonb_build_object(
        'dispatch_id', candidate.id,
        'attendance_day_id', candidate.attendance_day_id,
        'customer_ref', prepared->>'customer_ref',
        'payment_method_ref', prepared->>'payment_method_ref',
        'receipt_email', prepared->>'receipt_email',
        'charge', prepared->'charge'
      ));
    else
      update missionaccounts.auto_charge_dispatch
      set state = 'held', worker_id = null, locked_at = null,
          held_at = p_now,
          hold_reason = coalesce(prepared->>'reason', 'charge_preparation_rejected'),
          last_error = coalesce(prepared->>'reason', 'charge_preparation_rejected'),
          updated_at = p_now
      where id = candidate.id;
      held_count := held_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'claimed', claimed_items,
    'held', held_count,
    'refresh', refresh_result,
    'now', p_now
  );
end;
$$;

revoke execute on function missionaccounts.api_sync_program_enrollment(uuid, text, bigint, boolean, text, timestamptz, text, text, text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_sync_program_enrollment(uuid, text, bigint, boolean, text, timestamptz, text, text, text)
to service_role;

revoke execute on function missionaccounts.api_refresh_auto_charge_candidates(timestamptz)
from public, anon, authenticated;
grant execute on function missionaccounts.api_refresh_auto_charge_candidates(timestamptz)
to service_role;

revoke execute on function missionaccounts.api_claim_due_day_charges(timestamptz, text, integer)
from public, anon, authenticated;
grant execute on function missionaccounts.api_claim_due_day_charges(timestamptz, text, integer)
to service_role;

revoke execute on function missionaccounts.api_set_billing_consent(uuid, text, text, inet, text, text, text, text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_set_billing_consent(uuid, text, text, inet, text, text, text, text)
to service_role;

revoke execute on function missionaccounts.enforce_billing_terms_body()
from public, anon, authenticated;

alter table missionaccounts.program_enrollment_projection enable row level security;
alter table missionaccounts.program_enrollment_projection force row level security;
alter table missionaccounts.automatic_billing_contract enable row level security;
alter table missionaccounts.automatic_billing_contract force row level security;

revoke all on missionaccounts.program_enrollment_projection,
  missionaccounts.automatic_billing_contract
from public, anon, authenticated;
grant all on missionaccounts.program_enrollment_projection,
  missionaccounts.automatic_billing_contract
to service_role;

grant select (version, summary, body_sha256, body_text, status)
on missionaccounts.billing_terms to authenticated;

comment on table missionaccounts.program_enrollment_projection is
  'Fresh fail-closed projection of signed LearnDash course-6357 ExamPrep access; LearnDash remains canonical.';
comment on table missionaccounts.automatic_billing_contract is
  '5403B rollout cutoff and fail-closed automatic-billing controls. Live dispatch defaults off.';
comment on column missionaccounts.auto_charge_dispatch.eligible_after is
  'Earliest eligible claim time. Rows do not auto-expire after this time.';
