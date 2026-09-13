-- Migration: 20260911224524_autobilling_contract_closeout_5403b.sql
-- Authority: DR-241 / DR-242 / MX-MISSIONACCOUNTS-5403B
-- Date: 2026-09-12
-- Depends on: 20260911131140_sponsor_control.sql
-- Description: Add the enrollment, consent, durable post-rollout automatic-billing contract, and bounded provider-retry policy while dispatch remains disabled.
-- Idempotent: NO

BEGIN;

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
  ordinary_dispatch_delay interval not null default interval '24 hours'
    check (ordinary_dispatch_delay >= interval '24 hours' and ordinary_dispatch_delay <= interval '48 hours'),
  retry_delay interval not null default interval '12 hours'
    check (retry_delay > interval '0' and retry_delay <= interval '24 hours'),
  max_provider_attempts integer not null default 2
    check (max_provider_attempts = 2),
  live_dispatch_allowed boolean not null default false,
  initial_canary_requires_admin_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into missionaccounts.automatic_billing_contract(
  singleton, course_id, amount_per_day_cents, rollout_cutoff,
  enrollment_freshness, ordinary_dispatch_delay, retry_delay,
  max_provider_attempts, live_dispatch_allowed,
  initial_canary_requires_admin_approval
) values (
  true, 6357, 2500, transaction_timestamp(),
  interval '6 hours', interval '24 hours', interval '12 hours',
  2, false, true
)
on conflict (singleton) do nothing;

alter table missionaccounts.auto_charge_dispatch
  add column if not exists eligible_after timestamptz,
  add column if not exists rollout_cutoff timestamptz,
  add column if not exists attendance_finalized_at timestamptz,
  add column if not exists provenance jsonb not null default '{}'::jsonb,
  add column if not exists held_at timestamptz,
  add column if not exists hold_reason text,
  add column if not exists provider_failure_count integer not null default 0,
  add column if not exists late_fee_eligible_at timestamptz;

alter table missionaccounts.charge_attempt
  add column if not exists provider_ref text;

create unique index if not exists charge_attempt_provider_ref_unique
  on missionaccounts.charge_attempt(provider_ref)
  where provider_ref is not null;

alter table missionaccounts.auto_charge_dispatch
  add constraint auto_charge_dispatch_provider_failure_count_check
    check (provider_failure_count >= 0 and provider_failure_count <= 2),
  add constraint auto_charge_dispatch_late_fee_state_check
    check (
      late_fee_eligible_at is null
      or (state = 'held' and provider_failure_count = 2 and hold_reason = 'late_fee_eligible_review')
    );

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
     or student_row.id::text is distinct from p_actor_id
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
    ad.computed_at + contract_row.ordinary_dispatch_delay,
    contract_row.rollout_cutoff,
    ad.computed_at,
    jsonb_build_object(
      'contract', 'MX-MISSIONACCOUNTS-5403B',
      'course_id', contract_row.course_id,
      'rollout_cutoff', contract_row.rollout_cutoff,
      'attendance_day', ad.day,
      'attendance_finalized_at', ad.computed_at,
      'consent_id', bc.id,
      'consent_terms_version', bc.terms_version,
      'consent_accepted_at', bc.accepted_at,
      'ordinary_dispatch_target', ad.computed_at + contract_row.ordinary_dispatch_delay,
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
    and (
      contract_row.initial_canary_requires_admin_approval is not true
      or exists (
        select 1
        from missionaccounts.billing_decision bd,
          jsonb_array_elements(coalesce(bd.basis->'days', bd.basis->'day_states', '[]'::jsonb)) approved_day
        where bd.student_id = ad.student_id
          and bd.cycle_key = ad.cycle_key
          and bd.superseded_by_id is null
          and bd.state = 'approved'
          and bd.treatment = 'confirm'
          and approved_day->>'id' = ad.id::text
          and approved_day->>'kind' = 'billable'
      )
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
     or student_row.id::text is distinct from p_actor_id then
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
       or p_request_id is distinct from (
         dispatch_row.idempotency_key || ':attempt:' || (dispatch_row.provider_failure_count + 1)::text
       )
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

  if rejection_reason is null and contract_row.initial_canary_requires_admin_approval is true then
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

  if rejection_reason is null and contract_row.initial_canary_requires_admin_approval is true then
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
    select d.id, d.attendance_day_id, d.idempotency_key, d.provider_failure_count
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
      candidate.idempotency_key || ':attempt:' || (candidate.provider_failure_count + 1)::text,
      candidate.provider_failure_count > 0
    );

    if coalesce((prepared->>'accepted')::boolean, false) then
      claimed_items := claimed_items || jsonb_build_array(jsonb_build_object(
        'dispatch_id', candidate.id,
        'attendance_day_id', candidate.attendance_day_id,
        'provider_attempt_number', candidate.provider_failure_count + 1,
        'provider_idempotency_key', candidate.idempotency_key || ':attempt:' || (candidate.provider_failure_count + 1)::text,
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

create or replace function missionaccounts.api_finish_auto_charge_dispatch(
  p_dispatch_id uuid,
  p_worker_id text,
  p_succeeded boolean,
  p_provider_ref text default null,
  p_error text default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  dispatch_row missionaccounts.auto_charge_dispatch%rowtype;
  charge_row missionaccounts.charge%rowtype;
  day_row missionaccounts.attendance_day%rowtype;
  contract_row missionaccounts.automatic_billing_contract%rowtype;
  attempt_row missionaccounts.charge_attempt%rowtype;
  audit_id uuid;
  next_failure_count integer;
  definite_failure boolean;
  next_state text;
  event_suffix text;
begin
  if p_dispatch_id is null or nullif(btrim(p_worker_id), '') is null or p_now is null then
    raise exception using errcode = '22023', message = 'invalid_auto_charge_finish';
  end if;

  select * into dispatch_row
  from missionaccounts.auto_charge_dispatch
  where id = p_dispatch_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'auto_charge_dispatch_not_found'; end if;

  select * into charge_row
  from missionaccounts.charge
  where attendance_day_id = dispatch_row.attendance_day_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'auto_charge_not_found'; end if;
  select * into day_row from missionaccounts.attendance_day where id = dispatch_row.attendance_day_id;
  select * into contract_row from missionaccounts.automatic_billing_contract where singleton = true;
  if not found then raise exception using errcode = '55000', message = 'automatic_billing_contract_unavailable'; end if;
  select * into attempt_row
  from missionaccounts.charge_attempt
  where charge_id = charge_row.id
    and ((p_provider_ref is not null and provider_ref = p_provider_ref) or state = 'started')
  order by (provider_ref is not distinct from p_provider_ref) desc, attempted_at desc, id desc
  limit 1
  for update;
  if not found then raise exception using errcode = '23503', message = 'auto_charge_attempt_not_found'; end if;
  if attempt_row.state = 'succeeded' and p_succeeded
     and attempt_row.provider_ref is not distinct from p_provider_ref then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'dispatch', to_jsonb(dispatch_row));
  end if;
  if attempt_row.state = 'failed' and not p_succeeded
     and attempt_row.provider_ref is not distinct from p_provider_ref then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'dispatch', to_jsonb(dispatch_row));
  end if;
  if attempt_row.state <> 'started' then
    raise exception using errcode = '22023', message = 'auto_charge_attempt_terminal_state_mismatch';
  end if;
  if dispatch_row.state <> 'claimed' or dispatch_row.worker_id is distinct from p_worker_id then
    raise exception using errcode = '22023', message = 'auto_charge_claim_mismatch';
  end if;
  if p_provider_ref is not null and p_provider_ref !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception using errcode = '22023', message = 'auto_charge_provider_ref_invalid';
  end if;
  if p_succeeded and p_provider_ref is null then
    raise exception using errcode = '22023', message = 'auto_charge_provider_ref_required';
  end if;
  if not p_succeeded and nullif(btrim(p_error), '') is null then
    raise exception using errcode = '22023', message = 'auto_charge_error_required';
  end if;

  if p_succeeded then
    update missionaccounts.charge_attempt
    set provider_ref = p_provider_ref
    where id = attempt_row.id returning * into attempt_row;
    update missionaccounts.auto_charge_dispatch
    set state = 'submitted', provider_ref = p_provider_ref, submitted_at = p_now,
        worker_id = null, locked_at = null, last_error = null,
        hold_reason = null, held_at = null, updated_at = p_now
    where id = dispatch_row.id returning * into dispatch_row;
    update missionaccounts.charge
    set provider_ref = p_provider_ref, updated_at = p_now
    where id = charge_row.id returning * into charge_row;
    event_suffix := 'submitted';
  else
    -- A Stripe HTTP error is a definite provider response. A network/transport
    -- error carries no marker and must be reconciled before any retry.
    definite_failure := p_provider_ref is not null;
    if definite_failure then
      next_failure_count := dispatch_row.provider_failure_count + 1;
      next_state := case when next_failure_count < contract_row.max_provider_attempts then 'pending' else 'held' end;
      update missionaccounts.auto_charge_dispatch
      set state = next_state,
          provider_failure_count = next_failure_count,
          eligible_after = case when next_state = 'pending' then p_now + contract_row.retry_delay else eligible_after end,
          worker_id = null, locked_at = null,
          held_at = case when next_state = 'held' then p_now else null end,
          hold_reason = case when next_state = 'held' then 'late_fee_eligible_review' else null end,
          late_fee_eligible_at = case when next_state = 'held' then p_now else null end,
          last_error = left(p_error, 2000), updated_at = p_now
      where id = dispatch_row.id returning * into dispatch_row;
      update missionaccounts.charge
      set provider_ref = null, state = 'failed', updated_at = p_now
      where id = charge_row.id returning * into charge_row;
      update missionaccounts.charge_attempt
      set provider_ref = p_provider_ref, state = 'failed',
          error_code = 'stripe_submission_failed', error_message = left(p_error, 2000)
      where id = attempt_row.id;
      event_suffix := case when next_state = 'pending' then 'retry-scheduled' else 'late-fee-eligible-review' end;
    else
      update missionaccounts.auto_charge_dispatch
      set state = 'held', worker_id = null, locked_at = null,
          held_at = p_now, hold_reason = 'provider_outcome_unknown_requires_reconciliation',
          last_error = left(p_error, 2000), updated_at = p_now
      where id = dispatch_row.id returning * into dispatch_row;
      event_suffix := 'provider-outcome-unknown';
    end if;

    insert into missionaccounts.integration_exception(
      provider, kind, student_id, attendance_day_id, details, idempotency_key
    ) values (
      'stripe',
      case when definite_failure then 'automatic_charge_submission_failed' else 'automatic_charge_outcome_unknown' end,
      charge_row.student_id, charge_row.attendance_day_id,
      jsonb_build_object(
        'charge_id', charge_row.id,
        'provider_attempt_number', dispatch_row.provider_failure_count + case when definite_failure then 0 else 1 end,
        'provider_ref', case when p_provider_ref ~ '^pi_[A-Za-z0-9_]+$' then p_provider_ref else null end,
        'error', left(p_error, 2000),
        'automatic_retry_scheduled', definite_failure and dispatch_row.state = 'pending',
        'late_fee_amount_cents', null
      ),
      dispatch_row.idempotency_key || ':' || event_suffix
    ) on conflict (idempotency_key) do nothing;

    if definite_failure then
      insert into missionaccounts.notification_outbox(
        student_id, channel, audience, event_kind, payload, state, idempotency_key
      )
      select
        charge_row.student_id, 'matrix', audience, 'charge.failed',
        jsonb_build_object(
          'attendance_day_id', charge_row.attendance_day_id,
          'amount_cents', charge_row.amount_cents,
          'state', 'failed',
          'provider_attempt_number', dispatch_row.provider_failure_count,
          'automatic_retry_scheduled', dispatch_row.state = 'pending',
          'late_fee_eligible_review', dispatch_row.state = 'held',
          'late_fee_amount_cents', null
        ),
        'pending', dispatch_row.idempotency_key || ':attempt:' || dispatch_row.provider_failure_count::text || ':charge-failed-' || audience
      from unnest(array['student','missionaccounts_admin']) audience
      on conflict (idempotency_key) do nothing;
    end if;
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
  ) values (
    p_worker_id, 'system', charge_row.student_id,
    case
      when p_succeeded then 'auto_charge.submitted'
      when definite_failure and dispatch_row.state = 'pending' then 'auto_charge.retry_scheduled'
      when definite_failure then 'auto_charge.late_fee_eligible_review'
      else 'auto_charge.provider_outcome_unknown'
    end,
    case
      when p_succeeded then 'Automatic attendance-day charge submitted to Stripe'
      when definite_failure and dispatch_row.state = 'pending' then 'First automatic payment attempt failed; one bounded retry was scheduled'
      when definite_failure then 'Second automatic payment attempt failed; automatic retry stopped for late-fee eligibility review'
      else 'Automatic payment outcome is unknown and requires reconciliation before retry'
    end,
    jsonb_build_object(
      'dispatch_id', dispatch_row.id, 'charge_id', charge_row.id,
      'attendance_day_id', charge_row.attendance_day_id, 'day', day_row.day,
      'amount_cents', charge_row.amount_cents, 'state', dispatch_row.state,
      'provider_ref', case when p_provider_ref ~ '^pi_[A-Za-z0-9_]+$' then p_provider_ref else null end,
      'provider_failure_count', dispatch_row.provider_failure_count,
      'late_fee_eligible_at', dispatch_row.late_fee_eligible_at,
      'late_fee_amount_cents', null
    ),
    case when p_succeeded then 'stripe_payment_intent_submitted' else left(p_error, 2000) end,
    dispatch_row.idempotency_key || ':' || event_suffix || ':finish'
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true, 'duplicate', false, 'audit_event_id', audit_id,
    'dispatch', to_jsonb(dispatch_row), 'charge', to_jsonb(charge_row)
  );
end;
$$;

create or replace function missionaccounts.api_process_stripe_payment_intent(
  p_provider_event_id text,
  p_event_type text,
  p_payment_intent_ref text,
  p_student_id uuid,
  p_attendance_day_id uuid,
  p_failure_code text default null,
  p_failure_message text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  event_row missionaccounts.provider_event_inbox%rowtype;
  charge_row missionaccounts.charge%rowtype;
  dispatch_row missionaccounts.auto_charge_dispatch%rowtype;
  contract_row missionaccounts.automatic_billing_contract%rowtype;
  attempt_row missionaccounts.charge_attempt%rowtype;
  audit_id uuid;
  next_state text;
  next_failure_count integer;
  event_provider_request_id text;
  event_provider_attempt_number integer;
begin
  if p_event_type not in ('payment_intent.succeeded','payment_intent.payment_failed')
     or p_payment_intent_ref !~ '^pi_[A-Za-z0-9_]+$'
     or p_student_id is null or p_attendance_day_id is null then
    raise exception using errcode = '22023', message = 'invalid_payment_intent_event';
  end if;

  select * into event_row
  from missionaccounts.provider_event_inbox
  where provider = 'stripe' and provider_event_id = p_provider_event_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'stripe_event_not_found'; end if;

  select * into charge_row
  from missionaccounts.charge
  where attendance_day_id = p_attendance_day_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'charge_not_found'; end if;

  if event_row.state = 'processed' then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'charge', to_jsonb(charge_row));
  end if;

  if event_row.signature_verified is not true
     or event_row.event_type <> p_event_type
     or event_row.provider_object_id is distinct from p_payment_intent_ref
     or event_row.payload #>> '{data,object,id}' is distinct from p_payment_intent_ref
     or event_row.payload #>> '{data,object,metadata,student_id}' is distinct from p_student_id::text
     or event_row.payload #>> '{data,object,metadata,attendance_day_id}' is distinct from p_attendance_day_id::text
     or charge_row.student_id <> p_student_id then
    raise exception using errcode = '22023', message = 'stripe_charge_event_binding_mismatch';
  end if;

  select * into dispatch_row
  from missionaccounts.auto_charge_dispatch
  where attendance_day_id = p_attendance_day_id
  for update;
  select * into contract_row
  from missionaccounts.automatic_billing_contract
  where singleton = true;
  event_provider_request_id := event_row.payload #>> '{data,object,metadata,provider_request_id}';
  begin
    event_provider_attempt_number := (event_row.payload #>> '{data,object,metadata,provider_attempt_number}')::integer;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'stripe_charge_event_attempt_binding_mismatch';
  end;
  if dispatch_row.id is null
     or event_provider_attempt_number not in (1, 2)
     or event_provider_request_id is distinct from
       dispatch_row.idempotency_key || ':attempt:' || event_provider_attempt_number::text then
    raise exception using errcode = '22023', message = 'stripe_charge_event_attempt_binding_mismatch';
  end if;
  select * into attempt_row
  from missionaccounts.charge_attempt
  where charge_id = charge_row.id and provider_request_id = event_provider_request_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'stripe_charge_attempt_not_found';
  end if;

  next_state := case when p_event_type = 'payment_intent.succeeded' then 'succeeded' else 'failed' end;
  if attempt_row.provider_ref is not null and attempt_row.provider_ref <> p_payment_intent_ref then
    raise exception using errcode = '22023', message = 'stripe_charge_event_attempt_binding_mismatch';
  end if;
  if attempt_row.state <> 'started' then
    if attempt_row.state <> next_state then
      raise exception using errcode = '22023', message = 'stripe_attempt_terminal_state_mismatch';
    end if;
    update missionaccounts.provider_event_inbox
    set state = 'processed', processed_at = now()
    where id = event_row.id;
    return jsonb_build_object(
      'accepted', true, 'duplicate', true, 'charge', to_jsonb(charge_row),
      'dispatch', to_jsonb(dispatch_row), 'attempt', to_jsonb(attempt_row)
    );
  end if;

  update missionaccounts.charge
  set provider_ref = case when next_state = 'succeeded' then p_payment_intent_ref else null end,
      state = next_state,
      updated_at = now()
  where id = charge_row.id
  returning * into charge_row;

  update missionaccounts.charge_attempt
  set provider_ref = p_payment_intent_ref, state = next_state,
      error_code = p_failure_code, error_message = left(p_failure_message, 2000)
  where id = attempt_row.id
  returning * into attempt_row;

  if dispatch_row.id is not null then
    if next_state = 'succeeded' then
      update missionaccounts.auto_charge_dispatch
      set state = 'submitted', provider_ref = p_payment_intent_ref,
          submitted_at = coalesce(submitted_at, now()), worker_id = null, locked_at = null,
          held_at = null, hold_reason = null, last_error = null, updated_at = now()
      where id = dispatch_row.id returning * into dispatch_row;
    else
      next_failure_count := dispatch_row.provider_failure_count + 1;
      update missionaccounts.auto_charge_dispatch
      set provider_ref = null,
          provider_failure_count = next_failure_count,
          state = case when next_failure_count < contract_row.max_provider_attempts then 'pending' else 'held' end,
          eligible_after = case
            when next_failure_count < contract_row.max_provider_attempts then now() + contract_row.retry_delay
            else eligible_after
          end,
          worker_id = null, locked_at = null,
          held_at = case when next_failure_count >= contract_row.max_provider_attempts then now() else null end,
          hold_reason = case when next_failure_count >= contract_row.max_provider_attempts then 'late_fee_eligible_review' else null end,
          late_fee_eligible_at = case when next_failure_count >= contract_row.max_provider_attempts then now() else null end,
          last_error = left(coalesce(p_failure_message, p_failure_code, 'Stripe reported payment failure'), 2000),
          updated_at = now()
      where id = dispatch_row.id returning * into dispatch_row;

      insert into missionaccounts.integration_exception(
        provider, kind, student_id, attendance_day_id, details, idempotency_key
      ) values (
        'stripe', 'automatic_charge_payment_failed', charge_row.student_id, charge_row.attendance_day_id,
        jsonb_build_object(
          'charge_id', charge_row.id,
          'provider_ref', p_payment_intent_ref,
          'provider_attempt_number', event_provider_attempt_number,
          'automatic_retry_scheduled', dispatch_row.state = 'pending',
          'late_fee_eligible_review', dispatch_row.state = 'held',
          'late_fee_amount_cents', null
        ),
        event_provider_request_id || ':payment-failed'
      ) on conflict (idempotency_key) do nothing;
    end if;
  end if;

  update missionaccounts.provider_event_inbox
  set state = 'processed', processed_at = now()
  where id = event_row.id;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
  ) values (
    'stripe:' || p_provider_event_id, 'provider', p_student_id,
    case when next_state = 'succeeded' then 'charge.succeeded' else 'charge.failed' end,
    case when next_state = 'succeeded'
      then 'Stripe confirmed a $25 attendance-day charge'
      else 'Stripe reported an attendance-day charge failure'
    end,
    jsonb_build_object(
      'charge_id', charge_row.id,
      'attendance_day_id', charge_row.attendance_day_id,
      'provider_ref', p_payment_intent_ref,
      'state', charge_row.state,
      'provider_failure_count', case when dispatch_row.id is null then null else dispatch_row.provider_failure_count end,
      'automatic_retry_scheduled', dispatch_row.state = 'pending',
      'late_fee_eligible_review', dispatch_row.state = 'held' and dispatch_row.hold_reason = 'late_fee_eligible_review',
      'late_fee_amount_cents', null
    ),
    p_failure_message,
    'stripe:' || p_provider_event_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true, 'duplicate', false, 'audit_event_id', audit_id,
    'charge', to_jsonb(charge_row),
    'dispatch', case when dispatch_row.id is null then null else to_jsonb(dispatch_row) end
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

revoke execute on function missionaccounts.api_finish_auto_charge_dispatch(uuid, text, boolean, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function missionaccounts.api_finish_auto_charge_dispatch(uuid, text, boolean, text, text, timestamptz)
  to service_role;

revoke execute on function missionaccounts.api_process_stripe_payment_intent(text, text, text, uuid, uuid, text, text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_process_stripe_payment_intent(text, text, text, uuid, uuid, text, text)
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
  '5403B rollout cutoff, ordinary 24-48 hour cadence, and fail-closed automatic-billing controls. Live dispatch defaults off.';
comment on column missionaccounts.auto_charge_dispatch.eligible_after is
  'Operational next-attempt schedule. It is not a consumer cooling-off hold or expiry.';
comment on column missionaccounts.auto_charge_dispatch.provider_failure_count is
  'Count of definite unsuccessful provider attempts; at most two before automatic retry stops.';
comment on column missionaccounts.auto_charge_dispatch.late_fee_eligible_at is
  'Review eligibility after two definite failures. No late-fee amount is encoded or assessed.';

COMMIT;
