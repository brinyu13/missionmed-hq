-- MX-MISSIONACCOUNTS-5301P
-- Additive, feature-off schema candidate. Do not apply to production until the
-- mission registration, Matrix runtime lock, restore point, and release gates pass.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to service_role;

create schema if not exists missionaccounts;
revoke all on schema missionaccounts from public, anon;
grant usage on schema missionaccounts to authenticated, service_role;

create table missionaccounts.source_artifact (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null,
  source_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_count bigint not null check (byte_count >= 0),
  observed_at timestamptz not null,
  imported_at timestamptz not null default now(),
  unique (source_kind, sha256)
);

create table missionaccounts.import_run (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references missionaccounts.source_artifact(id),
  state text not null check (state in ('pending','validated','applied','failed')),
  source_controls jsonb not null default '{}'::jsonb,
  result_controls jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

create table missionaccounts.student (
  id uuid primary key default gen_random_uuid(),
  matrix_user_ref text unique,
  display_name text not null,
  source_name text,
  email text,
  phone text,
  joined_at date,
  comp_days_allowance integer not null default 0 check (comp_days_allowance >= 0),
  identity_state text not null default 'verified' check (identity_state in ('verified','needs_review','excluded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table missionaccounts.identity_alias (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references missionaccounts.student(id),
  source_artifact_id uuid not null references missionaccounts.source_artifact(id),
  source_key text not null,
  display_value text not null,
  relationship_state text not null check (relationship_state in ('verified','candidate','rejected','device','excluded')),
  confidence numeric(5,4),
  approved_by text,
  approved_at timestamptz,
  superseded_by_id uuid references missionaccounts.identity_alias(id),
  created_at timestamptz not null default now(),
  unique (source_artifact_id, source_key)
);

create table missionaccounts.cycle (
  key text primary key,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  state text not null default 'estimate' check (state in ('estimate','review','approved','closed')),
  check (ends_on >= starts_on)
);

create table missionaccounts.session (
  id uuid primary key default gen_random_uuid(),
  cycle_key text not null references missionaccounts.cycle(key),
  source_artifact_id uuid not null references missionaccounts.source_artifact(id),
  provider text not null,
  provider_meeting_id text not null,
  provider_instance_id text not null,
  starts_at timestamptz not null,
  held_on date not null,
  time_zone text not null default 'America/New_York',
  step text check (step in ('s1','s23','unknown')),
  state text not null check (state in ('candidate','confirmed','rejected','needs_review')),
  source_payload jsonb not null default '{}'::jsonb,
  superseded_by_id uuid references missionaccounts.session(id),
  created_at timestamptz not null default now(),
  unique (provider, provider_instance_id)
);

create table missionaccounts.attendance_source_row (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references missionaccounts.import_run(id),
  session_id uuid not null references missionaccounts.session(id),
  provider_source_id text not null,
  participant_source_id text,
  display_name text not null,
  joined_at timestamptz,
  left_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (import_run_id, provider_source_id)
);

create table missionaccounts.attendance_event (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  session_id uuid not null references missionaccounts.session(id),
  cycle_key text not null references missionaccounts.cycle(key),
  local_day date not null,
  step text check (step in ('s1','s23','unknown')),
  interpretation_state text not null check (interpretation_state in ('effective','removed','needs_review')),
  provenance jsonb not null default '{}'::jsonb,
  superseded_by_id uuid references missionaccounts.attendance_event(id),
  created_at timestamptz not null default now(),
  unique (student_id, session_id)
);

create table missionaccounts.attendance_event_source_row (
  attendance_event_id uuid not null references missionaccounts.attendance_event(id),
  source_row_id uuid not null references missionaccounts.attendance_source_row(id),
  primary key (attendance_event_id, source_row_id)
);

create table missionaccounts.attendance_correction (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  attendance_event_id uuid references missionaccounts.attendance_event(id),
  session_id uuid references missionaccounts.session(id),
  type text not null check (type in ('add','remove','relink','step_relabel','name','note')),
  from_val jsonb,
  to_val jsonb,
  reason text not null check (length(btrim(reason)) > 0),
  actor_id text not null,
  request_id text not null,
  reverts_id uuid references missionaccounts.attendance_correction(id),
  reverted_by_id uuid references missionaccounts.attendance_correction(id),
  created_at timestamptz not null default now(),
  unique (request_id)
);

create table missionaccounts.engine_run (
  id uuid primary key default gen_random_uuid(),
  engine_version text not null,
  source_digest text not null,
  state text not null check (state in ('running','succeeded','failed')),
  controls jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

create table missionaccounts.attendance_day (
  id uuid primary key default gen_random_uuid(),
  engine_run_id uuid not null references missionaccounts.engine_run(id),
  student_id uuid not null references missionaccounts.student(id),
  cycle_key text not null references missionaccounts.cycle(key),
  day date not null,
  kind text not null check (kind in ('billable','comped','grace','handled','needs_review')),
  comp_index integer,
  same_day_multiple_events boolean not null default false,
  engine_version text not null,
  source_digest text not null,
  superseded_at timestamptz,
  computed_at timestamptz not null default now(),
  unique (engine_run_id, student_id, day)
);

create unique index attendance_day_one_current
  on missionaccounts.attendance_day(student_id, day)
  where superseded_at is null;

create table missionaccounts.attendance_day_event (
  attendance_day_id uuid not null references missionaccounts.attendance_day(id),
  attendance_event_id uuid not null references missionaccounts.attendance_event(id),
  primary key (attendance_day_id, attendance_event_id)
);

create table missionaccounts.historical_account_source (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  cycle_key text not null references missionaccounts.cycle(key),
  artifact_id uuid not null references missionaccounts.source_artifact(id),
  source_events integer not null,
  source_amount_cents integer not null,
  source_tier text,
  source_state text not null default 'preserved',
  unique (student_id, cycle_key, artifact_id)
);

create table missionaccounts.full_cycle_ceiling (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  cycle_key text not null references missionaccounts.cycle(key),
  status text not null check (status in ('candidate','verified','rejected')),
  ceiling_cents integer not null default 30000 check (ceiling_cents > 0),
  basis jsonb not null,
  decided_by text,
  decided_at timestamptz,
  superseded_by_id uuid references missionaccounts.full_cycle_ceiling(id),
  created_at timestamptz not null default now()
);

create unique index full_cycle_ceiling_one_current
  on missionaccounts.full_cycle_ceiling(student_id, cycle_key)
  where superseded_by_id is null;

create table missionaccounts.comp_allowance_change (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  from_allowance integer not null,
  to_allowance integer not null check (to_allowance >= 0),
  from_joined_at date,
  to_joined_at date,
  apply_retroactively boolean not null default false,
  reason text not null check (length(btrim(reason)) > 0),
  actor_id text not null,
  request_id text not null unique,
  created_at timestamptz not null default now()
);

create table missionaccounts.comp_day_consumption (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  day date not null,
  comp_index integer not null check (comp_index > 0),
  source_change_id uuid references missionaccounts.comp_allowance_change(id),
  released_by_change_id uuid references missionaccounts.comp_allowance_change(id),
  created_at timestamptz not null default now(),
  unique (student_id, day)
);

create table missionaccounts.exam_plan (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  step text not null check (step in ('s1','s2','s3')),
  exam_on date not null,
  state text not null check (state in ('pending','approved','speak','denied','followup','passed')),
  result text check (result in ('passed','not_passed','no_result')),
  submitted_by text not null,
  submitted_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  passed_on date,
  note text,
  suggested_on date,
  superseded_by_id uuid references missionaccounts.exam_plan(id)
);

create unique index exam_plan_one_current
  on missionaccounts.exam_plan(student_id)
  where superseded_by_id is null;

create table missionaccounts.exam_transition (
  id uuid primary key default gen_random_uuid(),
  exam_plan_id uuid not null references missionaccounts.exam_plan(id),
  student_id uuid not null references missionaccounts.student(id),
  from_state text,
  to_state text not null,
  result text check (result in ('passed','not_passed','no_result')),
  accepted boolean not null,
  reason text,
  actor_id text not null,
  request_id text not null unique,
  created_at timestamptz not null default now()
);

create table missionaccounts.grace_window (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  exam_plan_id uuid not null references missionaccounts.exam_plan(id),
  from_on date not null,
  to_on date,
  closed_reason text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (to_on is null or to_on >= from_on)
);

create unique index grace_window_one_open_per_plan
  on missionaccounts.grace_window(exam_plan_id)
  where to_on is null;

create table missionaccounts.reminder (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  exam_plan_id uuid not null references missionaccounts.exam_plan(id),
  kind text not null check (kind = 'exam_result_checkin'),
  due_on date not null,
  state text not null check (state in ('scheduled','sent','cancelled','due')),
  cancelled_reason text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table missionaccounts.billing_decision (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  cycle_key text not null references missionaccounts.cycle(key),
  treatment text not null check (treatment in ('confirm','fullcycle','other','special','ucc','mul','waived','prepaid','already_paid','already_invoiced')),
  amount_cents integer not null check (amount_cents >= 0),
  note text,
  basis jsonb not null,
  basis_sha256 text not null check (basis_sha256 ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('estimate','needs_review','approved','stale','superseded')),
  decided_by text,
  decided_at timestamptz,
  request_id text not null unique,
  superseded_by_id uuid references missionaccounts.billing_decision(id),
  created_at timestamptz not null default now()
);

create unique index billing_decision_one_current
  on missionaccounts.billing_decision(student_id, cycle_key)
  where superseded_by_id is null;

create table missionaccounts.cycle_policy (
  cycle_key text not null references missionaccounts.cycle(key),
  key text not null,
  value jsonb not null,
  set_by text not null,
  set_at timestamptz not null default now(),
  primary key (cycle_key, key)
);

create table missionaccounts.rule_decision (
  id uuid primary key default gen_random_uuid(),
  rule text not null,
  mode text not null check (mode in ('retroactive','prospective')),
  effective_from date not null,
  basis jsonb not null,
  decided_by text,
  decided_at timestamptz not null default now(),
  superseded_by_id uuid references missionaccounts.rule_decision(id)
);

create unique index rule_decision_one_current
  on missionaccounts.rule_decision(rule)
  where superseded_by_id is null;

create table missionaccounts.invoice (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  cycle_key text not null references missionaccounts.cycle(key),
  decision_id uuid not null references missionaccounts.billing_decision(id),
  state text not null check (state in ('draft','ready','sent','paid','void')),
  amount_cents integer not null check (amount_cents >= 0),
  lines jsonb not null,
  provider_ref text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table missionaccounts.stripe_customer_private (
  student_id uuid primary key references missionaccounts.student(id),
  provider text not null check (provider = 'stripe'),
  provider_customer_ref text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table missionaccounts.payment_method_private (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references missionaccounts.student(id),
  provider text not null check (provider = 'stripe'),
  provider_customer_ref text not null references missionaccounts.stripe_customer_private(provider_customer_ref),
  provider_pm_ref text not null,
  brand text,
  last4 text check (last4 is null or last4 ~ '^\d{4}$'),
  exp_month integer check (exp_month between 1 and 12),
  exp_year integer,
  status text not null check (status in ('none','on_file','expired','failed')),
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create view missionaccounts.payment_method
with (security_invoker = true)
as select id, student_id, provider, brand, last4, exp_month, exp_year, status, verified_at, updated_at
from missionaccounts.payment_method_private;

create table missionaccounts.billing_terms (
  version text primary key,
  summary text not null,
  body_sha256 text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('draft','approved','retired')),
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table missionaccounts.billing_consent (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  terms_version text not null references missionaccounts.billing_terms(version),
  accepted_at timestamptz,
  accepted_ip inet,
  revoked_at timestamptz,
  state text not null check (state in ('none','authorized','revoked')),
  actor_id text not null,
  request_id text not null unique,
  superseded_by_id uuid references missionaccounts.billing_consent(id),
  created_at timestamptz not null default now()
);

create unique index billing_consent_one_current
  on missionaccounts.billing_consent(student_id)
  where superseded_by_id is null;

create table missionaccounts.charge (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  attendance_day_id uuid not null unique references missionaccounts.attendance_day(id),
  amount_cents integer not null check (amount_cents = 2500),
  provider_ref text unique,
  state text not null check (state in ('eligible','pending','succeeded','failed','refunded')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table missionaccounts.charge_attempt (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references missionaccounts.charge(id),
  provider_request_id text,
  state text not null check (state in ('started','succeeded','failed')),
  explicit_retry boolean not null default false,
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now()
);

create table missionaccounts.provider_event_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  provider_object_id text,
  event_type text not null,
  payload jsonb not null,
  signature_verified boolean not null,
  state text not null check (state in ('received','processed','ignored','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create index provider_event_object_idx
  on missionaccounts.provider_event_inbox(provider, provider_object_id);

create table missionaccounts.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references missionaccounts.student(id),
  channel text not null,
  event_kind text not null,
  payload jsonb not null,
  state text not null check (state in ('pending','sending','sent','failed','cancelled')),
  idempotency_key text not null unique,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create function missionaccounts.api_submit_exam_plan(
  p_student_id uuid,
  p_step text,
  p_exam_on date,
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
begin
  if p_step not in ('s1','s2','s3') or p_exam_on is null then
    raise exception using errcode = '22023', message = 'invalid_exam_plan';
  end if;
  if nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'exam_plan_actor_and_request_required';
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

  insert into missionaccounts.exam_transition(
    exam_plan_id, student_id, from_state, to_state, accepted, reason, actor_id, request_id
  ) values (
    new_plan.id, p_student_id, null, 'pending', true, 'submitted', p_actor_id, p_request_id
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
    to_jsonb(new_plan),
    'submitted',
    p_request_id
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, event_kind, payload, state, idempotency_key
  ) values (
    p_student_id,
    'matrix',
    'exam_plan.submitted',
    jsonb_build_object('student_id', p_student_id, 'exam_plan_id', new_plan.id, 'audience', 'missionaccounts_admin'),
    'pending',
    p_request_id || ':exam-plan-submitted'
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object('plan', to_jsonb(new_plan), 'audit_event_id', audit_id, 'duplicate', false);
end;
$$;

revoke execute on function missionaccounts.api_submit_exam_plan(uuid, text, date, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_submit_exam_plan(uuid, text, date, text, text, text) to service_role;

create function missionaccounts.api_set_comp_allowance(
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
begin
  if p_allowance is null or p_allowance < 0 or p_allowance > 365 then
    raise exception using errcode = '22023', message = 'invalid_comp_allowance';
  end if;
  if nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'comp_reason_actor_and_request_required';
  end if;

  select * into existing_change
  from missionaccounts.comp_allowance_change
  where request_id = p_request_id;

  if found then
    if existing_change.student_id <> p_student_id
       or existing_change.to_allowance <> p_allowance
       or existing_change.to_joined_at is distinct from p_joined_on
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
    apply_retroactively, reason, actor_id, request_id
  ) values (
    p_student_id, current_student.comp_days_allowance, p_allowance, current_student.joined_at,
    coalesce(p_joined_on, current_student.joined_at), p_apply_retroactively, p_reason, p_actor_id, p_request_id
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

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id,
    p_actor_role,
    p_student_id,
    'comp_allowance.changed',
    'Comp-day allowance changed',
    jsonb_build_object('allowance', current_student.comp_days_allowance, 'joined_on', current_student.joined_at),
    jsonb_build_object('allowance', p_allowance, 'joined_on', updated_student.joined_at, 'apply_retroactively', p_apply_retroactively, 'released_days', released_days),
    p_reason,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'student', to_jsonb(updated_student),
    'change_id', change_id,
    'audit_event_id', audit_id,
    'released_days', released_days,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_set_comp_allowance(uuid, integer, date, text, boolean, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_set_comp_allowance(uuid, integer, date, text, boolean, text, text, text) to service_role;

create function missionaccounts.api_transition_exam_plan(
  p_plan_id uuid,
  p_to_state text,
  p_result text,
  p_note text,
  p_today date,
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
  current_plan missionaccounts.exam_plan%rowtype;
  prior_transition missionaccounts.exam_transition%rowtype;
  transition_id uuid;
  audit_id uuid;
  transition_allowed boolean := false;
  first_wednesday_offset integer;
  reminder_due date;
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

  select * into prior_transition
  from missionaccounts.exam_transition
  where request_id = p_request_id;
  if found then
    if prior_transition.exam_plan_id <> p_plan_id
       or prior_transition.to_state <> p_to_state
       or prior_transition.result is distinct from p_result
       or prior_transition.actor_id <> p_actor_id
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

  insert into missionaccounts.exam_transition(
    exam_plan_id, student_id, from_state, to_state, result, accepted, reason, actor_id, request_id
  ) values (
    current_plan.id, current_plan.student_id, current_plan.state, p_to_state,
    p_result, transition_allowed, p_note, p_actor_id, p_request_id
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
    set to_on = p_today,
        closed_reason = case when p_to_state = 'passed' then 'passed' else coalesce(p_result, p_to_state) end,
        closed_at = now()
    where exam_plan_id = current_plan.id and to_on is null;
    update missionaccounts.reminder
    set state = 'cancelled',
        cancelled_reason = case when p_to_state = 'passed' then 'result_recorded' else 'plan_changed' end,
        updated_at = now()
    where exam_plan_id = current_plan.id and state in ('scheduled','due');
  end if;

  update missionaccounts.exam_plan
  set state = p_to_state,
      result = case when p_to_state = 'passed' then 'passed' when p_to_state = 'followup' then p_result else null end,
      note = p_note,
      decided_by = p_actor_id,
      decided_at = now(),
      passed_on = case
        when p_to_state = 'passed' then p_today
        when current_plan.state = 'passed' and p_to_state = 'pending' then null
        else passed_on
      end
  where id = current_plan.id
  returning * into current_plan;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, current_plan.student_id, 'exam_plan.transition',
    'Exam plan state changed',
    jsonb_build_object('state', (select from_state from missionaccounts.exam_transition where id = transition_id)),
    jsonb_build_object('state', p_to_state, 'result', p_result, 'today', p_today),
    p_note, p_request_id
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, event_kind, payload, state, idempotency_key
  ) values (
    current_plan.student_id,
    'matrix',
    'exam_plan.' || p_to_state,
    jsonb_build_object('student_id', current_plan.student_id, 'exam_plan_id', current_plan.id, 'state', p_to_state, 'result', p_result),
    'pending',
    p_request_id || ':exam-plan-transition'
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'accepted', true,
    'plan', to_jsonb(current_plan),
    'transition_id', transition_id,
    'audit_event_id', audit_id,
    'reminder_due', reminder_due,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_transition_exam_plan(uuid, text, text, text, date, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_transition_exam_plan(uuid, text, text, text, date, text, text, text) to service_role;

create function missionaccounts.api_approve_billing_decision(
  p_student_id uuid,
  p_cycle_key text,
  p_treatment text,
  p_requested_amount_cents integer,
  p_note text,
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
  student_row missionaccounts.student%rowtype;
  cycle_row missionaccounts.cycle%rowtype;
  cap_row missionaccounts.full_cycle_ceiling%rowtype;
  prior_decision missionaccounts.billing_decision%rowtype;
  existing_decision missionaccounts.billing_decision%rowtype;
  new_decision missionaccounts.billing_decision%rowtype;
  invoice_row missionaccounts.invoice%rowtype;
  decision_id uuid := gen_random_uuid();
  audit_id uuid;
  billable_count integer := 0;
  comped_count integer := 0;
  grace_count integer := 0;
  review_count integer := 0;
  day_count integer := 0;
  event_count integer := 0;
  candidate_cap_count integer := 0;
  amount_cents integer := 0;
  raw_amount_cents integer := 0;
  basis jsonb;
  basis_sha256 text;
  rejection_reason text;
  request_fingerprint jsonb;
  existing_rejection jsonb;
begin
  if p_treatment is null
     or p_treatment not in ('confirm','fullcycle','other','special','ucc','mul','waived','prepaid','already_paid','already_invoiced')
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_billing_decision_request';
  end if;
  if p_treatment in ('other','special')
     and (p_requested_amount_cents is null or p_requested_amount_cents < 0 or nullif(btrim(p_note), '') is null) then
    raise exception using errcode = '22023', message = 'custom_billing_amount_and_note_required';
  end if;

  request_fingerprint := jsonb_build_object(
    'student_id', p_student_id,
    'cycle_key', p_cycle_key,
    'treatment', p_treatment,
    'requested_amount_cents', p_requested_amount_cents,
    'note', p_note,
    'actor_id', p_actor_id
  );

  select * into existing_decision
  from missionaccounts.billing_decision
  where request_id = p_request_id;
  if found then
    if existing_decision.student_id <> p_student_id
       or existing_decision.cycle_key <> p_cycle_key
       or existing_decision.treatment <> p_treatment
       or (existing_decision.basis->>'requested_amount_cents')::integer is distinct from p_requested_amount_cents
       or existing_decision.note is distinct from p_note
       or existing_decision.decided_by <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select * into invoice_row
    from missionaccounts.invoice inv where inv.decision_id = existing_decision.id
    order by inv.created_at desc limit 1;
    select id into audit_id from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'billing_decision.approved';
    return jsonb_build_object(
      'accepted', true,
      'decision', to_jsonb(existing_decision),
      'invoice', case when invoice_row.id is null then null else to_jsonb(invoice_row) end,
      'audit_event_id', audit_id,
      'duplicate', true
    );
  end if;

  select to_val into existing_rejection
  from missionaccounts.audit_event
  where request_id = p_request_id and kind = 'billing_decision.rejected';
  if found then
    if existing_rejection->'request' <> request_fingerprint then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    return jsonb_build_object(
      'accepted', false,
      'reason', existing_rejection->>'reason',
      'audit_event_id', (select id from missionaccounts.audit_event where request_id = p_request_id and kind = 'billing_decision.rejected'),
      'duplicate', true
    );
  end if;

  select * into student_row from missionaccounts.student where id = p_student_id for update;
  if not found then raise exception using errcode = '23503', message = 'student_not_found'; end if;
  select * into cycle_row from missionaccounts.cycle where key = p_cycle_key;
  if not found then raise exception using errcode = '23503', message = 'cycle_not_found'; end if;

  select
    count(*)::integer,
    count(*) filter (where ad.kind = 'billable')::integer,
    count(*) filter (where ad.kind = 'comped')::integer,
    count(*) filter (where ad.kind = 'grace')::integer,
    count(*) filter (where ad.kind = 'needs_review')::integer,
    coalesce(sum(ev.events), 0)::integer
  into day_count, billable_count, comped_count, grace_count, review_count, event_count
  from missionaccounts.attendance_day ad
  left join lateral (
    select count(*)::integer as events
    from missionaccounts.attendance_day_event ade
    where ade.attendance_day_id = ad.id
  ) ev on true
  where ad.student_id = p_student_id
    and ad.cycle_key = p_cycle_key
    and ad.superseded_at is null;

  raw_amount_cents := billable_count * 2500;
  select count(*)::integer into candidate_cap_count
  from missionaccounts.full_cycle_ceiling
  where student_id = p_student_id and cycle_key = p_cycle_key
    and status = 'candidate' and superseded_by_id is null;
  select * into cap_row
  from missionaccounts.full_cycle_ceiling
  where student_id = p_student_id and cycle_key = p_cycle_key
    and status = 'verified' and superseded_by_id is null
  order by decided_at desc nulls last limit 1;

  if student_row.identity_state <> 'verified' then rejection_reason := 'student_identity_requires_review';
  elsif review_count > 0 then rejection_reason := 'attendance_requires_review';
  elsif not exists (
    select 1 from missionaccounts.rule_decision
    where rule = 'one_charge_per_calendar_day' and mode = 'retroactive'
      and effective_from <= cycle_row.starts_on and superseded_by_id is null
  ) then rejection_reason := 'authoritative_rule_decision_missing';
  elsif p_treatment = 'fullcycle' and cap_row.id is null then rejection_reason := 'verified_full_cycle_ceiling_required';
  elsif candidate_cap_count > 0 and cap_row.id is null and raw_amount_cents > 30000 then rejection_reason := 'cap_candidate_requires_review';
  end if;

  if rejection_reason is not null then
    insert into missionaccounts.audit_event(
      actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
    ) values (
      p_actor_id, p_actor_role, p_student_id, 'billing_decision.rejected',
      'Billing approval rejected by server authority',
      jsonb_build_object('request', request_fingerprint, 'reason', rejection_reason),
      rejection_reason, p_request_id
    ) returning id into audit_id;
    return jsonb_build_object('accepted', false, 'reason', rejection_reason, 'audit_event_id', audit_id, 'duplicate', false);
  end if;

  amount_cents := case
    when p_treatment in ('ucc','mul','waived','prepaid','already_paid','already_invoiced') then 0
    when p_treatment in ('other','special') then p_requested_amount_cents
    else raw_amount_cents
  end;
  if cap_row.id is not null then amount_cents := least(amount_cents, cap_row.ceiling_cents); end if;

  basis := jsonb_build_object(
    'rule', 'one_charge_per_calendar_day',
    'units', 'calendar_days',
    'dayCount', day_count,
    'att', event_count,
    'billable', billable_count,
    'comped', comped_count,
    'grace', grace_count,
    'treatment', p_treatment,
    'requested_amount_cents', p_requested_amount_cents,
    'amount_cents', amount_cents,
    'rate_cents', 2500,
    'cap', case when cap_row.id is null then null else jsonb_build_object('id', cap_row.id, 'status', cap_row.status, 'ceiling_cents', cap_row.ceiling_cents) end,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'day', day, 'kind', kind) order by day, id)
      from missionaccounts.attendance_day
      where student_id = p_student_id and cycle_key = p_cycle_key and superseded_at is null
    ), '[]'::jsonb)
  );
  basis_sha256 := encode(digest(basis::text, 'sha256'), 'hex');

  select * into prior_decision
  from missionaccounts.billing_decision
  where student_id = p_student_id and cycle_key = p_cycle_key and superseded_by_id is null
  for update;
  if found then
    insert into missionaccounts.billing_decision(
      id, student_id, cycle_key, treatment, amount_cents, note, basis, basis_sha256,
      state, decided_by, decided_at, request_id, superseded_by_id
    ) values (
      decision_id, p_student_id, p_cycle_key, p_treatment, amount_cents, p_note, basis, basis_sha256,
      'approved', p_actor_id, now(), p_request_id, prior_decision.id
    );
    update missionaccounts.billing_decision set superseded_by_id = decision_id, state = 'superseded' where id = prior_decision.id;
    update missionaccounts.billing_decision set superseded_by_id = null where id = decision_id returning * into new_decision;
  else
    insert into missionaccounts.billing_decision(
      id, student_id, cycle_key, treatment, amount_cents, note, basis, basis_sha256,
      state, decided_by, decided_at, request_id
    ) values (
      decision_id, p_student_id, p_cycle_key, p_treatment, amount_cents, p_note, basis, basis_sha256,
      'approved', p_actor_id, now(), p_request_id
    ) returning * into new_decision;
  end if;

  update missionaccounts.invoice set state = 'void'
  where student_id = p_student_id and cycle_key = p_cycle_key and state in ('draft','ready');
  if amount_cents > 0 then
    insert into missionaccounts.invoice(student_id, cycle_key, decision_id, state, amount_cents, lines)
    values (
      p_student_id, p_cycle_key, new_decision.id, 'draft', amount_cents,
      jsonb_build_object(
        'description', 'Dr J Live Drills attendance',
        'billable_days', billable_count,
        'rate_cents', 2500,
        'subtotal_cents', raw_amount_cents,
        'verified_cap_cents', case when cap_row.id is null then null else cap_row.ceiling_cents end,
        'total_cents', amount_cents
      )
    ) returning * into invoice_row;
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'billing_decision.approved',
    'Billing decision approved from server-derived attendance days',
    case when prior_decision.id is null then null else to_jsonb(prior_decision) end,
    to_jsonb(new_decision), p_note, p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'decision', to_jsonb(new_decision),
    'invoice', case when invoice_row.id is null then null else to_jsonb(invoice_row) end,
    'audit_event_id', audit_id,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_approve_billing_decision(uuid, text, text, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_approve_billing_decision(uuid, text, text, integer, text, text, text, text) to service_role;

create function missionaccounts.api_append_attendance_correction(
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
  session_row missionaccounts.session%rowtype;
  event_row missionaccounts.attendance_event%rowtype;
  correction_row missionaccounts.attendance_correction%rowtype;
  latest_effect text;
  audit_id uuid;
  stale_decisions integer := 0;
begin
  if p_type is null or p_type not in ('add','remove','step_relabel','name','note')
     or nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_attendance_correction_request';
  end if;

  select * into existing_correction
  from missionaccounts.attendance_correction
  where request_id = p_request_id;
  if found then
    if existing_correction.student_id <> p_student_id
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
    select id into audit_id from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'attendance_correction.appended';
    return jsonb_build_object(
      'accepted', true,
      'correction', to_jsonb(existing_correction),
      'attendance_event_id', existing_correction.attendance_event_id,
      'audit_event_id', audit_id,
      'duplicate', true
    );
  end if;

  perform 1 from missionaccounts.student where id = p_student_id for update;
  if not found then raise exception using errcode = '23503', message = 'student_not_found'; end if;

  if p_session_id is not null then
    select * into session_row from missionaccounts.session where id = p_session_id;
    if not found then raise exception using errcode = '23503', message = 'session_not_found'; end if;
  end if;
  if p_attendance_event_id is not null then
    select * into event_row
    from missionaccounts.attendance_event
    where id = p_attendance_event_id and student_id = p_student_id and superseded_by_id is null
    for update;
    if not found then raise exception using errcode = '23503', message = 'attendance_event_not_found'; end if;
    if p_session_id is not null and event_row.session_id <> p_session_id then
      raise exception using errcode = '22023', message = 'attendance_event_session_mismatch';
    end if;
    if p_session_id is null then
      p_session_id := event_row.session_id;
      select * into session_row from missionaccounts.session where id = p_session_id;
    end if;
  elsif p_session_id is not null then
    select * into event_row
    from missionaccounts.attendance_event
    where student_id = p_student_id and session_id = p_session_id and superseded_by_id is null
    for update;
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
    else
      select type into latest_effect
      from missionaccounts.attendance_correction
      where attendance_event_id = event_row.id and type in ('add','remove')
      order by created_at desc, id desc limit 1;
      if latest_effect is distinct from 'remove' then
        raise exception using errcode = '23505', message = 'attendance_already_effective';
      end if;
    end if;
  elsif p_type in ('remove','step_relabel') and event_row.id is null then
    raise exception using errcode = '23503', message = 'attendance_event_required';
  end if;

  if p_type = 'remove' then
    select type into latest_effect
    from missionaccounts.attendance_correction
    where attendance_event_id = event_row.id and type in ('add','remove')
    order by created_at desc, id desc limit 1;
    if latest_effect = 'remove' then
      raise exception using errcode = '23505', message = 'attendance_already_removed';
    end if;
  end if;
  if p_type = 'step_relabel'
     and coalesce(p_to_val->>'step', '') not in ('s1','s23','unknown') then
    raise exception using errcode = '22023', message = 'invalid_step_relabel';
  end if;
  if p_reverts_id is not null and not exists (
    select 1 from missionaccounts.attendance_correction
    where id = p_reverts_id and student_id = p_student_id
  ) then
    raise exception using errcode = '23503', message = 'reverted_correction_not_found';
  end if;

  insert into missionaccounts.attendance_correction(
    student_id, attendance_event_id, session_id, type, from_val, to_val,
    reason, actor_id, request_id, reverts_id
  ) values (
    p_student_id, event_row.id, p_session_id, p_type, p_from_val, p_to_val,
    p_reason, p_actor_id, p_request_id, p_reverts_id
  ) returning * into correction_row;

  if p_type in ('add','remove','step_relabel') then
    update missionaccounts.billing_decision
    set state = 'stale'
    where student_id = p_student_id
      and cycle_key = session_row.cycle_key
      and superseded_by_id is null
      and state = 'approved';
    get diagnostics stale_decisions = row_count;
    update missionaccounts.invoice inv
    set state = 'void'
    where inv.student_id = p_student_id
      and inv.cycle_key = session_row.cycle_key
      and inv.state in ('draft','ready')
      and exists (
        select 1 from missionaccounts.billing_decision bd
        where bd.id = inv.decision_id and bd.state = 'stale'
      );
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'attendance_correction.appended',
    'Attendance correction appended without changing source evidence',
    p_from_val,
    jsonb_build_object('correction', to_jsonb(correction_row), 'stale_decisions', stale_decisions),
    p_reason,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'correction', to_jsonb(correction_row),
    'attendance_event_id', event_row.id,
    'stale_decisions', stale_decisions,
    'audit_event_id', audit_id,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_append_attendance_correction(uuid, uuid, uuid, text, jsonb, jsonb, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_append_attendance_correction(uuid, uuid, uuid, text, jsonb, jsonb, text, uuid, text, text, text) to service_role;

create function missionaccounts.api_set_billing_consent(
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
  if p_action is null or p_action not in ('authorize','revoke')
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
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

  perform 1 from missionaccounts.student where id = p_student_id for update;
  if not found then raise exception using errcode = '23503', message = 'student_not_found'; end if;
  select * into current_consent
  from missionaccounts.billing_consent
  where student_id = p_student_id and superseded_by_id is null
  for update;

  if p_action = 'authorize' then
    effective_terms_version := nullif(btrim(p_terms_version), '');
    if effective_terms_version is null or not exists (
      select 1 from missionaccounts.billing_terms where version = effective_terms_version and status = 'approved'
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
      case when p_action = 'authorize' then now() else current_consent.accepted_at end,
      case when p_action = 'authorize' then p_accepted_ip else current_consent.accepted_ip end,
      case when p_action = 'revoke' then now() else null end,
      case when p_action = 'authorize' then 'authorized' else 'revoked' end,
      p_actor_id, p_request_id, current_consent.id
    );
    update missionaccounts.billing_consent set superseded_by_id = consent_id where id = current_consent.id;
    update missionaccounts.billing_consent set superseded_by_id = null where id = consent_id returning * into new_consent;
  else
    insert into missionaccounts.billing_consent(
      id, student_id, terms_version, accepted_at, accepted_ip, revoked_at, state, actor_id, request_id
    ) values (
      consent_id, p_student_id, effective_terms_version, now(), p_accepted_ip, null, 'authorized', p_actor_id, p_request_id
    ) returning * into new_consent;
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'billing_consent.changed',
    case when p_action = 'authorize' then 'Automatic Drills billing authorized' else 'Automatic Drills billing revoked' end,
    case when current_consent.id is null then null else to_jsonb(current_consent) end,
    to_jsonb(new_consent), p_reason, p_request_id
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, event_kind, payload, state, idempotency_key
  ) values (
    p_student_id, 'matrix', 'billing_consent.' || p_action,
    jsonb_build_object('student_id', p_student_id, 'state', new_consent.state, 'terms_version', new_consent.terms_version),
    'pending', p_request_id || ':billing-consent'
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object('accepted', true, 'consent', to_jsonb(new_consent), 'audit_event_id', audit_id, 'duplicate', false);
end;
$$;

revoke execute on function missionaccounts.api_set_billing_consent(uuid, text, text, inet, text, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_set_billing_consent(uuid, text, text, inet, text, text, text, text) to service_role;

create function missionaccounts.api_process_stripe_setup_intent(
  p_provider_event_id text,
  p_student_id uuid,
  p_customer_ref text,
  p_payment_method_ref text,
  p_brand text,
  p_last4 text,
  p_exp_month integer,
  p_exp_year integer
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  event_row missionaccounts.provider_event_inbox%rowtype;
  customer_row missionaccounts.stripe_customer_private%rowtype;
  payment_row missionaccounts.payment_method_private%rowtype;
  audit_id uuid;
  event_student_id text;
  event_customer_ref text;
  event_payment_method_ref text;
begin
  if nullif(btrim(p_provider_event_id), '') is null
     or p_student_id is null
     or p_customer_ref !~ '^cus_[A-Za-z0-9_]+$'
     or p_payment_method_ref !~ '^pm_[A-Za-z0-9_]+$'
     or p_last4 !~ '^\d{4}$'
     or p_exp_month not between 1 and 12
     or p_exp_year < 2026 then
    raise exception using errcode = '22023', message = 'invalid_setup_intent_result';
  end if;

  select * into event_row
  from missionaccounts.provider_event_inbox
  where provider = 'stripe' and provider_event_id = p_provider_event_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'stripe_event_not_found'; end if;

  if event_row.state = 'processed' then
    select * into payment_row from missionaccounts.payment_method_private where student_id = p_student_id;
    return jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'payment_method', jsonb_build_object(
        'id', payment_row.id, 'student_id', payment_row.student_id, 'brand', payment_row.brand,
        'last4', payment_row.last4, 'exp_month', payment_row.exp_month,
        'exp_year', payment_row.exp_year, 'status', payment_row.status,
        'verified_at', payment_row.verified_at
      )
    );
  end if;

  event_student_id := event_row.payload #>> '{data,object,metadata,student_id}';
  event_customer_ref := event_row.payload #>> '{data,object,customer}';
  event_payment_method_ref := event_row.payload #>> '{data,object,payment_method}';
  if event_row.signature_verified is not true
     or event_row.event_type <> 'setup_intent.succeeded'
     or event_student_id is distinct from p_student_id::text
     or event_customer_ref is distinct from p_customer_ref
     or event_payment_method_ref is distinct from p_payment_method_ref then
    raise exception using errcode = '22023', message = 'stripe_event_binding_mismatch';
  end if;

  select * into customer_row
  from missionaccounts.stripe_customer_private
  where student_id = p_student_id
  for update;
  if customer_row.provider_customer_ref is distinct from p_customer_ref then
    raise exception using errcode = '22023', message = 'stripe_customer_binding_mismatch';
  end if;

  insert into missionaccounts.payment_method_private(
    student_id, provider, provider_customer_ref, provider_pm_ref, brand, last4,
    exp_month, exp_year, status, verified_at, updated_at
  ) values (
    p_student_id, 'stripe', p_customer_ref, p_payment_method_ref,
    nullif(btrim(p_brand), ''), p_last4, p_exp_month, p_exp_year,
    'on_file', now(), now()
  )
  on conflict (student_id) do update set
    provider = excluded.provider,
    provider_customer_ref = excluded.provider_customer_ref,
    provider_pm_ref = excluded.provider_pm_ref,
    brand = excluded.brand,
    last4 = excluded.last4,
    exp_month = excluded.exp_month,
    exp_year = excluded.exp_year,
    status = 'on_file',
    verified_at = excluded.verified_at,
    updated_at = excluded.updated_at
  returning * into payment_row;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
  ) values (
    'stripe:' || p_provider_event_id, 'provider', p_student_id, 'payment_method.verified',
    'Stripe confirmed a saved payment method',
    jsonb_build_object(
      'id', payment_row.id, 'brand', payment_row.brand, 'last4', payment_row.last4,
      'exp_month', payment_row.exp_month, 'exp_year', payment_row.exp_year,
      'status', payment_row.status, 'verified_at', payment_row.verified_at
    ),
    'setup_intent.succeeded', 'stripe:' || p_provider_event_id || ':payment-method'
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, event_kind, payload, state, idempotency_key
  ) values (
    p_student_id, 'matrix', 'payment_method.added',
    jsonb_build_object('brand', payment_row.brand, 'last4', payment_row.last4),
    'pending', 'stripe:' || p_provider_event_id || ':payment-method-notification'
  ) on conflict (idempotency_key) do nothing;

  update missionaccounts.provider_event_inbox
  set state = 'processed', processed_at = now()
  where id = event_row.id;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'audit_event_id', audit_id,
    'payment_method', jsonb_build_object(
      'id', payment_row.id, 'student_id', payment_row.student_id, 'brand', payment_row.brand,
      'last4', payment_row.last4, 'exp_month', payment_row.exp_month,
      'exp_year', payment_row.exp_year, 'status', payment_row.status,
      'verified_at', payment_row.verified_at
    )
  );
end;
$$;

revoke execute on function missionaccounts.api_process_stripe_setup_intent(text, uuid, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function missionaccounts.api_process_stripe_setup_intent(text, uuid, text, text, text, text, integer, integer) to service_role;

create table missionaccounts.sync_run (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'zoom'),
  window_from timestamptz not null,
  window_to timestamptz not null,
  state text not null check (state in ('ok','partial','failed','not_connected')),
  stats jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check (window_to >= window_from)
);

create table missionaccounts.audit_event (
  id uuid primary key default gen_random_uuid(),
  actor_id text,
  actor_role text not null,
  subject_student_id uuid references missionaccounts.student(id),
  kind text not null,
  text text not null,
  from_val jsonb,
  to_val jsonb,
  reason text,
  request_id text not null,
  created_at timestamptz not null default now(),
  unique (request_id, kind)
);

create table missionaccounts.feature_flag (
  key text primary key,
  enabled boolean not null default false,
  scope jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into missionaccounts.feature_flag(key, enabled) values
  ('missionaccounts_route', false),
  ('billing_decisions', false),
  ('attendance_corrections', false),
  ('exam_plans', false),
  ('comp_days', false),
  ('auto_billing', false),
  ('zoom_sync', false)
on conflict (key) do nothing;

insert into missionaccounts.cycle(key, label, starts_on, ends_on) values
  ('2026-cycle-1', 'June 8 – July 13, 2026', '2026-06-08', '2026-07-13'),
  ('2026-cycle-2', 'July 14 – August 11, 2026', '2026-07-14', '2026-08-11'),
  ('2026-cycle-3', 'August 12 – September 4, 2026', '2026-08-12', '2026-09-04')
on conflict (key) do nothing;

-- The active Founder brief resolves the historical effective-date decision.
insert into missionaccounts.rule_decision(rule, mode, effective_from, basis)
values (
  'one_charge_per_calendar_day',
  'retroactive',
  '2026-06-08',
  jsonb_build_object('ticket','MX-MISSIONACCOUNTS-5301P','decision','D1')
)
on conflict do nothing;

create function missionaccounts.reject_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'immutable MissionAccounts evidence cannot be updated or deleted';
end;
$$;

revoke execute on function missionaccounts.reject_immutable_change() from public, anon, authenticated;
grant execute on function missionaccounts.reject_immutable_change() to service_role;

create trigger attendance_source_row_immutable
before update or delete on missionaccounts.attendance_source_row
for each row execute function missionaccounts.reject_immutable_change();

create trigger audit_event_immutable
before update or delete on missionaccounts.audit_event
for each row execute function missionaccounts.reject_immutable_change();

create trigger exam_transition_immutable
before update or delete on missionaccounts.exam_transition
for each row execute function missionaccounts.reject_immutable_change();

create trigger attendance_correction_immutable
before update or delete on missionaccounts.attendance_correction
for each row execute function missionaccounts.reject_immutable_change();

-- Every personal or financial table is RLS-protected even though browser writes
-- are intentionally unavailable. Server-side service role access remains private.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'student','identity_alias','session','attendance_source_row','attendance_event',
    'attendance_event_source_row','attendance_correction','attendance_day',
    'attendance_day_event','historical_account_source','full_cycle_ceiling',
    'comp_allowance_change','comp_day_consumption','exam_plan','exam_transition',
    'grace_window','reminder','billing_decision','invoice','payment_method_private',
    'stripe_customer_private','billing_terms','billing_consent','charge','charge_attempt','notification_outbox','audit_event'
  ] loop
    execute format('alter table missionaccounts.%I enable row level security', table_name);
    execute format('alter table missionaccounts.%I force row level security', table_name);
    execute format('revoke all on table missionaccounts.%I from anon, authenticated', table_name);
  end loop;
end $$;

grant select on missionaccounts.student,
  missionaccounts.attendance_event,
  missionaccounts.attendance_day,
  missionaccounts.exam_plan,
  missionaccounts.grace_window,
  missionaccounts.reminder,
  missionaccounts.billing_decision,
  missionaccounts.invoice,
  missionaccounts.billing_consent,
  missionaccounts.charge
to authenticated;

grant select (version, summary, body_sha256, status)
on missionaccounts.billing_terms to authenticated;

grant select (id, student_id, brand, last4, exp_month, exp_year, status, verified_at, updated_at)
on missionaccounts.payment_method_private to authenticated;

create policy student_select_self_or_admin on missionaccounts.student
for select to authenticated
using (
  matrix_user_ref = (select auth.uid())::text
  or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb) ?| array['missionaccounts_admin','founder']
);

create policy billing_terms_select_approved on missionaccounts.billing_terms
for select to authenticated
using (status = 'approved');

create policy attendance_event_select_self_or_admin on missionaccounts.attendance_event
for select to authenticated
using (
  exists (select 1 from missionaccounts.student s where s.id = student_id and s.matrix_user_ref = (select auth.uid())::text)
  or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb) ?| array['missionaccounts_admin','founder']
);

create policy attendance_day_select_self_or_admin on missionaccounts.attendance_day
for select to authenticated
using (
  exists (select 1 from missionaccounts.student s where s.id = student_id and s.matrix_user_ref = (select auth.uid())::text)
  or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb) ?| array['missionaccounts_admin','founder']
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'exam_plan','grace_window','reminder','billing_decision','invoice',
    'billing_consent','charge','payment_method_private'
  ] loop
    execute format($policy$
      create policy %I on missionaccounts.%I
      for select to authenticated
      using (
        exists (
          select 1 from missionaccounts.student s
          where s.id = student_id and s.matrix_user_ref = (select auth.uid())::text
        )
        or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb)
          ?| array['missionaccounts_admin','founder']
      )
    $policy$, table_name || '_select_self_or_admin', table_name);
  end loop;
end $$;

revoke all on missionaccounts.payment_method_private from anon;
revoke all on all tables in schema missionaccounts from anon;
grant all on all tables in schema missionaccounts to service_role;
grant usage, select on all sequences in schema missionaccounts to service_role;

comment on schema missionaccounts is
  'MissionAccounts isolated domain. Browser mutations go through authenticated app APIs; production activation is feature-gated.';
