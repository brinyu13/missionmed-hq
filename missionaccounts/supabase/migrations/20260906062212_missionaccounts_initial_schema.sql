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
  request_id text not null unique,
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

create table missionaccounts.account_link_change (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  from_matrix_user_ref text,
  to_matrix_user_ref text not null check (
    to_matrix_user_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  from_joined_at date,
  to_joined_at date not null,
  from_comp_days_allowance integer not null,
  to_comp_days_allowance integer not null,
  reason text not null check (length(btrim(reason)) > 0),
  actor_id text not null,
  actor_role text not null check (actor_role in ('missionaccounts_admin','founder')),
  request_id text not null unique,
  created_at timestamptz not null default now()
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

create table missionaccounts.identity_cluster (
  ref text primary key,
  source_artifact_id uuid not null references missionaccounts.source_artifact(id),
  state text not null default 'open' check (state in ('open','resolved')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table missionaccounts.identity_cluster_member (
  cluster_ref text not null references missionaccounts.identity_cluster(ref),
  identity_alias_id uuid not null references missionaccounts.identity_alias(id),
  created_at timestamptz not null default now(),
  primary key (cluster_ref, identity_alias_id)
);

create table missionaccounts.identity_decision (
  id uuid primary key default gen_random_uuid(),
  cluster_ref text not null references missionaccounts.identity_cluster(ref),
  decision text not null check (decision in ('same','different','unsure')),
  canonical_student_id uuid references missionaccounts.student(id),
  note text,
  decided_by text not null,
  request_id text not null unique,
  superseded_by_id uuid references missionaccounts.identity_decision(id),
  decided_at timestamptz not null default now(),
  check (decision <> 'same' or canonical_student_id is not null)
);

create unique index identity_decision_one_current
  on missionaccounts.identity_decision(cluster_ref)
  where superseded_by_id is null;

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

create view missionaccounts.attendance_event_projection
with (security_invoker = true)
as
select
  ae.id,
  ae.student_id,
  ae.session_id,
  ae.cycle_key,
  ae.local_day,
  ae.step,
  ae.interpretation_state,
  ae.superseded_by_id,
  case
    when count(aesr.source_row_id) = 0 then null
    else round(sum(coalesce(asr.duration_seconds, 0))::numeric / 60)::integer
  end as duration_minutes,
  count(aesr.source_row_id)::integer as source_row_count,
  min(asr.display_name) as source_display_name
from missionaccounts.attendance_event ae
left join missionaccounts.attendance_event_source_row aesr
  on aesr.attendance_event_id = ae.id
left join missionaccounts.attendance_source_row asr
  on asr.id = aesr.source_row_id
group by ae.id;

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
  request_id text unique,
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
  id uuid primary key default gen_random_uuid(),
  cycle_key text not null references missionaccounts.cycle(key),
  key text not null,
  value jsonb not null,
  set_by text not null,
  reason text not null check (length(btrim(reason)) > 0),
  request_id text not null unique,
  set_at timestamptz not null default now(),
  superseded_by_id uuid references missionaccounts.cycle_policy(id)
);

create unique index cycle_policy_one_current
  on missionaccounts.cycle_policy(cycle_key, key)
  where superseded_by_id is null;

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
  status text not null check (status in ('none','on_file','removal_pending','removed','expired','failed')),
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

create unique index charge_attempt_request_unique
  on missionaccounts.charge_attempt(charge_id, provider_request_id)
  where provider_request_id is not null;

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
  locked_by text,
  locked_at timestamptz,
  provider_ref text,
  last_error text,
  created_at timestamptz not null default now()
);

create function missionaccounts.recompute_student_attendance(
  p_student_id uuid,
  p_trigger text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, extensions, missionaccounts
as $$
declare
  student_row missionaccounts.student%rowtype;
  run_id uuid := gen_random_uuid();
  new_day_id uuid;
  day_record record;
  source_digest text;
  day_kind text;
  day_comp_index integer;
  active_comp_count integer := 0;
  created_days integer := 0;
  review_days integer := 0;
  billable_days integer := 0;
  comped_days integer := 0;
  grace_days integer := 0;
  stale_decisions integer := 0;
begin
  if p_student_id is null or nullif(btrim(p_trigger), '') is null then
    raise exception using errcode = '22023', message = 'attendance_recompute_student_and_trigger_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:attendance:' || p_student_id::text, 0));
  select * into student_row from missionaccounts.student where id = p_student_id for update;
  if not found then raise exception using errcode = '23503', message = 'student_not_found'; end if;

  select encode(digest(
    p_student_id::text || '|' || p_trigger || '|' || student_row.identity_state || '|' || student_row.comp_days_allowance::text || '|' ||
    coalesce((select string_agg(ae.id::text || ':' || ae.interpretation_state, ',' order by ae.id) from missionaccounts.attendance_event ae where ae.student_id = p_student_id and ae.superseded_by_id is null), '') || '|' ||
    coalesce((select string_agg(ac.id::text || ':' || ac.type || ':' || coalesce(ac.reverts_id::text, '') || ':' || coalesce(ac.reverted_by_id::text, ''), ',' order by ac.created_at, ac.id) from missionaccounts.attendance_correction ac where ac.student_id = p_student_id), '') || '|' ||
    coalesce((select string_agg(gw.id::text || ':' || gw.from_on::text || ':' || coalesce(gw.to_on::text, ''), ',' order by gw.from_on, gw.id) from missionaccounts.grace_window gw where gw.student_id = p_student_id), ''),
    'sha256'
  ), 'hex') into source_digest;

  insert into missionaccounts.engine_run(id, engine_version, source_digest, state, controls)
  values (run_id, 'missionaccounts-billing-v1', source_digest, 'running', jsonb_build_object('trigger', p_trigger, 'student_id', p_student_id));

  update missionaccounts.attendance_day
  set superseded_at = now()
  where student_id = p_student_id and superseded_at is null;

  select count(*)::integer into active_comp_count
  from missionaccounts.comp_day_consumption
  where student_id = p_student_id and released_by_change_id is null;

  for day_record in
    with latest_effect as (
      select distinct on (attendance_event_id)
        attendance_event_id,
        type
      from missionaccounts.attendance_correction
      where student_id = p_student_id
        and attendance_event_id is not null
        and type in ('add','remove')
        and reverted_by_id is null
        and not exists (
          select 1 from missionaccounts.attendance_correction reversing
          where reversing.reverts_id = attendance_correction.id
        )
      order by attendance_event_id, created_at desc, id desc
    ), interpreted as (
      select
        ae.id,
        ae.cycle_key,
        ae.local_day,
        ae.interpretation_state
      from missionaccounts.attendance_event ae
      join missionaccounts.session s on s.id = ae.session_id
      left join latest_effect le on le.attendance_event_id = ae.id
      where ae.student_id = p_student_id
        and ae.superseded_by_id is null
        and s.superseded_by_id is null
        and s.state = 'confirmed'
        and le.type is distinct from 'remove'
        and ae.interpretation_state in ('effective','needs_review')
    )
    select
      local_day as day,
      min(cycle_key) as cycle_key,
      count(distinct cycle_key) as cycle_count,
      bool_or(interpretation_state = 'needs_review') as event_needs_review,
      array_agg(id order by id) as event_ids
    from interpreted
    group by local_day
    order by local_day
  loop
    if day_record.cycle_count <> 1 then
      raise exception using errcode = '22023', message = 'attendance_day_crosses_cycle_boundary';
    end if;
    day_kind := 'billable';
    day_comp_index := null;
    if student_row.identity_state <> 'verified' or day_record.event_needs_review then
      day_kind := 'needs_review';
    else
      select comp_index into day_comp_index
      from missionaccounts.comp_day_consumption
      where student_id = p_student_id and day = day_record.day and released_by_change_id is null;
      if found then
        day_kind := 'comped';
      elsif exists (
        select 1 from missionaccounts.grace_window
        where student_id = p_student_id
          and day_record.day > from_on
          and (to_on is null or day_record.day <= to_on)
      ) then
        day_kind := 'grace';
      elsif active_comp_count < student_row.comp_days_allowance then
        active_comp_count := active_comp_count + 1;
        day_comp_index := active_comp_count;
        day_kind := 'comped';
        insert into missionaccounts.comp_day_consumption(student_id, day, comp_index, source_change_id)
        values (
          p_student_id,
          day_record.day,
          day_comp_index,
          (select id from missionaccounts.comp_allowance_change where student_id = p_student_id order by created_at desc, id desc limit 1)
        ) on conflict (student_id, day) do update
          set comp_index = excluded.comp_index,
              source_change_id = excluded.source_change_id,
              released_by_change_id = null;
      end if;
    end if;

    insert into missionaccounts.attendance_day(
      engine_run_id, student_id, cycle_key, day, kind, comp_index,
      same_day_multiple_events, engine_version, source_digest
    ) values (
      run_id, p_student_id, day_record.cycle_key, day_record.day, day_kind, day_comp_index,
      cardinality(day_record.event_ids) > 1, 'missionaccounts-billing-v1', source_digest
    ) returning id into new_day_id;
    insert into missionaccounts.attendance_day_event(attendance_day_id, attendance_event_id)
    select new_day_id, event_id
    from unnest(day_record.event_ids) as event_id;

    created_days := created_days + 1;
    if day_kind = 'needs_review' then review_days := review_days + 1;
    elsif day_kind = 'billable' then billable_days := billable_days + 1;
    elsif day_kind = 'comped' then comped_days := comped_days + 1;
    elsif day_kind = 'grace' then grace_days := grace_days + 1;
    end if;
  end loop;

  update missionaccounts.billing_decision
  set state = 'stale'
  where student_id = p_student_id and superseded_by_id is null and state = 'approved';
  get diagnostics stale_decisions = row_count;
  update missionaccounts.invoice inv
  set state = 'void'
  where inv.student_id = p_student_id
    and inv.state in ('draft','ready')
    and exists (select 1 from missionaccounts.billing_decision bd where bd.id = inv.decision_id and bd.state = 'stale');

  update missionaccounts.engine_run
  set state = 'succeeded',
      controls = jsonb_build_object(
        'trigger', p_trigger,
        'student_id', p_student_id,
        'days', created_days,
        'billable', billable_days,
        'comped', comped_days,
        'grace', grace_days,
        'needs_review', review_days,
        'stale_decisions', stale_decisions
      ),
      finished_at = now()
  where id = run_id;

  return jsonb_build_object(
    'engine_run_id', run_id,
    'days', created_days,
    'billable', billable_days,
    'comped', comped_days,
    'grace', grace_days,
    'needs_review', review_days,
    'stale_decisions', stale_decisions
  );
end;
$$;

revoke execute on function missionaccounts.recompute_student_attendance(uuid, text) from public, anon, authenticated;
grant execute on function missionaccounts.recompute_student_attendance(uuid, text) to service_role;

create function missionaccounts.api_link_student_account(
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
    when current_student.comp_days_allowance > 0 then current_student.comp_days_allowance
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

revoke execute on function missionaccounts.api_link_student_account(uuid, text, date, date, text, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_link_student_account(uuid, text, date, date, text, text, text, text) to service_role;

create function missionaccounts.api_decide_full_cycle_ceiling(
  p_student_id uuid,
  p_cycle_key text,
  p_status text,
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
  existing_by_request missionaccounts.full_cycle_ceiling%rowtype;
  current_ceiling missionaccounts.full_cycle_ceiling%rowtype;
  new_ceiling missionaccounts.full_cycle_ceiling%rowtype;
  audit_id uuid;
  stale_decisions integer := 0;
  void_invoices integer := 0;
begin
  if p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501', message = 'full_cycle_ceiling_admin_required';
  end if;
  if p_status not in ('candidate','verified','rejected')
     or nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'full_cycle_ceiling_fields_invalid';
  end if;

  select * into existing_by_request
  from missionaccounts.full_cycle_ceiling
  where request_id = p_request_id;
  if found then
    if existing_by_request.student_id <> p_student_id
       or existing_by_request.cycle_key <> p_cycle_key
       or existing_by_request.status <> p_status
       or existing_by_request.decided_by <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select id into audit_id
    from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'full_cycle_ceiling.decided';
    return jsonb_build_object(
      'ceiling', to_jsonb(existing_by_request),
      'audit_event_id', audit_id,
      'stale_decisions', 0,
      'void_invoices', 0,
      'duplicate', true
    );
  end if;

  perform 1 from missionaccounts.student where id = p_student_id;
  if not found then
    raise exception using errcode = '23503', message = 'student_not_found';
  end if;
  perform 1 from missionaccounts.cycle where key = p_cycle_key;
  if not found then
    raise exception using errcode = '23503', message = 'cycle_not_found';
  end if;
  if exists (
    select 1 from missionaccounts.invoice
    where student_id = p_student_id and cycle_key = p_cycle_key and state in ('sent','paid')
  ) then
    raise exception using errcode = '23514', message = 'full_cycle_ceiling_locked_after_invoice';
  end if;

  select * into current_ceiling
  from missionaccounts.full_cycle_ceiling
  where student_id = p_student_id
    and cycle_key = p_cycle_key
    and superseded_by_id is null
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'full_cycle_ceiling_candidate_not_found';
  end if;
  if current_ceiling.status = p_status then
    raise exception using errcode = '23514', message = 'full_cycle_ceiling_state_unchanged';
  end if;

  insert into missionaccounts.full_cycle_ceiling(
    student_id, cycle_key, status, ceiling_cents, basis,
    request_id, decided_by, decided_at, superseded_by_id
  ) values (
    p_student_id,
    p_cycle_key,
    p_status,
    30000,
    current_ceiling.basis || jsonb_build_object(
      'decision_reason', p_reason,
      'prior_ceiling_id', current_ceiling.id,
      'decision_request_id', p_request_id
    ),
    p_request_id,
    p_actor_id,
    now(),
    current_ceiling.id
  ) returning * into new_ceiling;

  update missionaccounts.full_cycle_ceiling
  set superseded_by_id = new_ceiling.id
  where id = current_ceiling.id;

  update missionaccounts.full_cycle_ceiling
  set superseded_by_id = null
  where id = new_ceiling.id
  returning * into new_ceiling;

  update missionaccounts.billing_decision
  set state = 'stale'
  where student_id = p_student_id
    and cycle_key = p_cycle_key
    and superseded_by_id is null
    and state = 'approved';
  get diagnostics stale_decisions = row_count;

  update missionaccounts.invoice
  set state = 'void'
  where student_id = p_student_id
    and cycle_key = p_cycle_key
    and state in ('draft','ready');
  get diagnostics void_invoices = row_count;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id,
    p_actor_role,
    p_student_id,
    'full_cycle_ceiling.decided',
    'Historical full-cycle ceiling adjudicated',
    jsonb_build_object(
      'id', current_ceiling.id,
      'cycle_key', current_ceiling.cycle_key,
      'status', current_ceiling.status,
      'ceiling_cents', current_ceiling.ceiling_cents
    ),
    jsonb_build_object(
      'id', new_ceiling.id,
      'cycle_key', new_ceiling.cycle_key,
      'status', new_ceiling.status,
      'ceiling_cents', new_ceiling.ceiling_cents,
      'stale_decisions', stale_decisions,
      'void_invoices', void_invoices
    ),
    p_reason,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'ceiling', to_jsonb(new_ceiling),
    'audit_event_id', audit_id,
    'stale_decisions', stale_decisions,
    'void_invoices', void_invoices,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_decide_full_cycle_ceiling(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_decide_full_cycle_ceiling(uuid, text, text, text, text, text, text) to service_role;

create function missionaccounts.api_submit_exam_plan(
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
    jsonb_build_object(
      'plan', to_jsonb(new_plan),
      'closed_grace_windows', closed_grace_windows,
      'attendance_recompute', recomputed
    ),
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
  recomputed jsonb;
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

  if p_actor_role = 'student' and (
    p_to_state <> 'passed'
    or p_result is distinct from 'passed'
    or not exists (
      select 1 from missionaccounts.student s
      where s.id = current_plan.student_id and s.matrix_user_ref = p_actor_id
    )
  ) then
    transition_allowed := false;
  end if;

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
      'today', p_today,
      'attendance_recompute', recomputed
    ),
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
    'attendance_recompute', recomputed,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_transition_exam_plan(uuid, text, text, text, date, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_transition_exam_plan(uuid, text, text, text, date, text, text, text) to service_role;

create function missionaccounts.api_set_cycle_policy(
  p_cycle_key text,
  p_decision text,
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
  existing_policy missionaccounts.cycle_policy%rowtype;
  current_policy missionaccounts.cycle_policy%rowtype;
  new_policy missionaccounts.cycle_policy%rowtype;
  new_policy_id uuid := gen_random_uuid();
  audit_id uuid;
  stale_decisions integer := 0;
begin
  if p_decision not in ('cap','per','pending')
     or nullif(btrim(p_cycle_key), '') is null
     or nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_cycle_policy_request';
  end if;

  select * into existing_policy
  from missionaccounts.cycle_policy
  where request_id = p_request_id;
  if found then
    if existing_policy.cycle_key <> p_cycle_key
       or existing_policy.key <> 'cap_13_15'
       or existing_policy.value->>'decision' <> p_decision
       or existing_policy.reason <> p_reason
       or existing_policy.set_by <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select id into audit_id from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'cycle_policy.changed';
    return jsonb_build_object(
      'accepted', true,
      'policy', to_jsonb(existing_policy),
      'audit_event_id', audit_id,
      'duplicate', true
    );
  end if;

  perform 1 from missionaccounts.cycle where key = p_cycle_key for update;
  if not found then raise exception using errcode = '23503', message = 'cycle_not_found'; end if;

  select * into current_policy
  from missionaccounts.cycle_policy
  where cycle_key = p_cycle_key and key = 'cap_13_15' and superseded_by_id is null
  for update;

  if current_policy.id is null then
    insert into missionaccounts.cycle_policy(
      id, cycle_key, key, value, set_by, reason, request_id
    ) values (
      new_policy_id, p_cycle_key, 'cap_13_15', jsonb_build_object('decision', p_decision),
      p_actor_id, p_reason, p_request_id
    ) returning * into new_policy;
  else
    insert into missionaccounts.cycle_policy(
      id, cycle_key, key, value, set_by, reason, request_id, superseded_by_id
    ) values (
      new_policy_id, p_cycle_key, 'cap_13_15', jsonb_build_object('decision', p_decision),
      p_actor_id, p_reason, p_request_id, current_policy.id
    );
    update missionaccounts.cycle_policy
    set superseded_by_id = new_policy_id
    where id = current_policy.id;
    update missionaccounts.cycle_policy
    set superseded_by_id = null
    where id = new_policy_id
    returning * into new_policy;
  end if;

  update missionaccounts.billing_decision
  set state = 'stale'
  where cycle_key = p_cycle_key and superseded_by_id is null and state = 'approved';
  get diagnostics stale_decisions = row_count;
  update missionaccounts.invoice inv
  set state = 'void'
  where inv.cycle_key = p_cycle_key
    and inv.state in ('draft','ready')
    and exists (
      select 1 from missionaccounts.billing_decision bd
      where bd.id = inv.decision_id and bd.state = 'stale'
    );

  insert into missionaccounts.audit_event(
    actor_id, actor_role, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, 'cycle_policy.changed',
    'Cycle 13–15-day billing policy changed',
    case when current_policy.id is null then null else to_jsonb(current_policy) end,
    jsonb_build_object('policy', to_jsonb(new_policy), 'stale_decisions', stale_decisions),
    p_reason, p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'policy', to_jsonb(new_policy),
    'stale_decisions', stale_decisions,
    'audit_event_id', audit_id,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_set_cycle_policy(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_set_cycle_policy(text, text, text, text, text, text) to service_role;

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
  cycle_cap_decision text;
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
  select value->>'decision' into cycle_cap_decision
  from missionaccounts.cycle_policy
  where cycle_key = p_cycle_key and key = 'cap_13_15' and superseded_by_id is null;
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
  elsif p_treatment = 'confirm'
        and billable_count between 13 and 15
        and coalesce(cycle_cap_decision, 'pending') = 'pending'
    then rejection_reason := 'cycle_cap_policy_requires_review';
  elsif candidate_cap_count > 0
        and cap_row.id is null
        and raw_amount_cents > 30000
        and not (billable_count between 13 and 15 and cycle_cap_decision = 'cap')
    then rejection_reason := 'cap_candidate_requires_review';
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
    when p_treatment = 'confirm' and billable_count between 13 and 15 and cycle_cap_decision = 'cap' then 30000
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
    'cycle_cap_13_15', cycle_cap_decision,
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
  recomputed jsonb;
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
      where attendance_event_id = event_row.id
        and type in ('add','remove')
        and reverted_by_id is null
        and not exists (
          select 1 from missionaccounts.attendance_correction reversing
          where reversing.reverts_id = attendance_correction.id
        )
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
    where attendance_event_id = event_row.id
      and type in ('add','remove')
      and reverted_by_id is null
      and not exists (
        select 1 from missionaccounts.attendance_correction reversing
        where reversing.reverts_id = attendance_correction.id
      )
    order by created_at desc, id desc limit 1;
    if latest_effect = 'remove' then
      raise exception using errcode = '23505', message = 'attendance_already_removed';
    end if;
  end if;
  if p_type = 'step_relabel'
     and coalesce(p_to_val->>'step', '') not in ('s1','s23','unknown') then
    raise exception using errcode = '22023', message = 'invalid_step_relabel';
  end if;
  if p_reverts_id is not null then
    perform 1
    from missionaccounts.attendance_correction
    where id = p_reverts_id and student_id = p_student_id
    for update;
    if not found then
      raise exception using errcode = '23503', message = 'reverted_correction_not_found';
    end if;
    if exists (
      select 1 from missionaccounts.attendance_correction
      where reverts_id = p_reverts_id
    ) then
      raise exception using errcode = '23505', message = 'correction_already_reverted';
    end if;
  end if;

  insert into missionaccounts.attendance_correction(
    student_id, attendance_event_id, session_id, type, from_val, to_val,
    reason, actor_id, request_id, reverts_id
  ) values (
    p_student_id, event_row.id, p_session_id, p_type, p_from_val, p_to_val,
    p_reason, p_actor_id, p_request_id, p_reverts_id
  ) returning * into correction_row;

  if p_type in ('add','remove','step_relabel') then
    recomputed := missionaccounts.recompute_student_attendance(
      p_student_id,
      p_request_id || ':attendance-correction'
    );
    stale_decisions := coalesce((recomputed->>'stale_decisions')::integer, 0);
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'attendance_correction.appended',
    'Attendance correction appended without changing source evidence',
    p_from_val,
    jsonb_build_object(
      'correction', to_jsonb(correction_row),
      'stale_decisions', stale_decisions,
      'attendance_recompute', recomputed
    ),
    p_reason,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'correction', to_jsonb(correction_row),
    'attendance_event_id', event_row.id,
    'stale_decisions', stale_decisions,
    'attendance_recompute', recomputed,
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

create function missionaccounts.api_prepare_payment_method_removal(
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
  if student_row.matrix_user_ref is distinct from p_actor_id then
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

create function missionaccounts.api_finish_payment_method_removal(
  p_student_id uuid,
  p_request_id text,
  p_succeeded boolean,
  p_error text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  method_row missionaccounts.payment_method_private%rowtype;
  prepared_audit_id uuid;
  prepared_student_id uuid;
  result_audit_id uuid;
  result_kind text := case when p_succeeded then 'payment_method.removed' else 'payment_method.removal_failed' end;
begin
  if p_student_id is null or nullif(btrim(p_request_id), '') is null or p_succeeded is null then
    raise exception using errcode = '22023', message = 'invalid_payment_method_removal_result';
  end if;
  select id, subject_student_id into prepared_audit_id, prepared_student_id
  from missionaccounts.audit_event
  where request_id = p_request_id and kind = 'payment_method.removal_prepared';
  if not found or prepared_student_id is distinct from p_student_id then
    raise exception using errcode = '23503', message = 'payment_method_removal_not_prepared';
  end if;
  select id into result_audit_id
  from missionaccounts.audit_event
  where request_id = p_request_id and kind = result_kind;
  if found then
    select * into method_row from missionaccounts.payment_method_private where student_id = p_student_id;
    return jsonb_build_object(
      'accepted', true, 'duplicate', true, 'audit_event_id', result_audit_id,
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
  if not found then raise exception using errcode = '23503', message = 'payment_method_not_found'; end if;
  if method_row.status <> 'removal_pending' then
    raise exception using errcode = '22023', message = 'payment_method_removal_state_mismatch';
  end if;

  update missionaccounts.payment_method_private
  set status = case when p_succeeded then 'removed' else 'on_file' end,
      updated_at = now()
  where id = method_row.id returning * into method_row;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    case when p_succeeded then 'stripe' else 'missionaccounts' end,
    case when p_succeeded then 'provider' else 'system' end,
    p_student_id, result_kind,
    case when p_succeeded then 'Stripe payment method removed' else 'Stripe payment method removal failed; method remains on file with authorization revoked' end,
    jsonb_build_object('status', 'removal_pending'),
    jsonb_build_object('id', method_row.id, 'brand', method_row.brand, 'last4', method_row.last4, 'status', method_row.status),
    case when p_succeeded then 'Provider removal confirmed' else left(coalesce(p_error, 'Provider removal failed'), 2000) end,
    p_request_id
  ) returning id into result_audit_id;

  if p_succeeded then
    insert into missionaccounts.notification_outbox(
      student_id, channel, event_kind, payload, state, idempotency_key
    ) values (
      p_student_id, 'matrix', 'payment_method.removed',
      jsonb_build_object('brand', method_row.brand, 'last4', method_row.last4),
      'pending', p_request_id || ':payment-method-removed'
    ) on conflict (idempotency_key) do nothing;
  end if;

  return jsonb_build_object(
    'accepted', true, 'duplicate', false, 'audit_event_id', result_audit_id,
    'payment_method', jsonb_build_object(
      'id', method_row.id, 'brand', method_row.brand, 'last4', method_row.last4,
      'exp_month', method_row.exp_month, 'exp_year', method_row.exp_year,
      'status', method_row.status, 'verified_at', method_row.verified_at
    )
  );
end;
$$;

revoke execute on function missionaccounts.api_finish_payment_method_removal(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_finish_payment_method_removal(uuid, text, boolean, text) to service_role;

create function missionaccounts.api_prepare_day_charge(
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
    return jsonb_build_object(
      'accepted', true, 'duplicate', true,
      'charge', jsonb_build_object(
        'id', charge_row.id, 'student_id', charge_row.student_id,
        'attendance_day_id', charge_row.attendance_day_id, 'amount_cents', charge_row.amount_cents,
        'state', charge_row.state, 'idempotency_key', charge_row.idempotency_key
      ),
      'customer_ref', method_row.provider_customer_ref,
      'payment_method_ref', method_row.provider_pm_ref
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
    select * into decision_row
    from missionaccounts.billing_decision
    where student_id = day_row.student_id and cycle_key = day_row.cycle_key
      and superseded_by_id is null and state = 'approved'
    for update;
    if not found then rejection_reason := 'approved_billing_decision_required';
    elsif decision_row.treatment <> 'confirm' then rejection_reason := 'per_day_billing_decision_required';
    elsif not exists (
      select 1
      from jsonb_array_elements(coalesce(decision_row.basis->'days', '[]'::jsonb)) as approved_day
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
    'payment_method_ref', method_row.provider_pm_ref
  );
end;
$$;

revoke execute on function missionaccounts.api_prepare_day_charge(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function missionaccounts.api_prepare_day_charge(uuid, text, text, text, boolean) to service_role;

create function missionaccounts.api_process_stripe_payment_intent(
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
  audit_id uuid;
  next_state text;
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
     or charge_row.student_id <> p_student_id
     or (charge_row.provider_ref is not null and charge_row.provider_ref <> p_payment_intent_ref) then
    raise exception using errcode = '22023', message = 'stripe_charge_event_binding_mismatch';
  end if;

  next_state := case when p_event_type = 'payment_intent.succeeded' then 'succeeded' else 'failed' end;
  update missionaccounts.charge
  set provider_ref = p_payment_intent_ref, state = next_state, updated_at = now()
  where id = charge_row.id
  returning * into charge_row;

  update missionaccounts.charge_attempt
  set state = next_state, error_code = p_failure_code, error_message = left(p_failure_message, 2000)
  where id = (
    select id from missionaccounts.charge_attempt
    where charge_id = charge_row.id and state = 'started'
    order by attempted_at desc limit 1
  );

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
  ) values (
    'stripe:' || p_provider_event_id, 'provider', p_student_id,
    case when next_state = 'succeeded' then 'charge.succeeded' else 'charge.failed' end,
    case when next_state = 'succeeded' then 'Stripe confirmed a $25 attendance-day charge' else 'Stripe reported an attendance-day charge failure' end,
    jsonb_build_object(
      'charge_id', charge_row.id, 'attendance_day_id', charge_row.attendance_day_id,
      'amount_cents', charge_row.amount_cents, 'state', charge_row.state
    ),
    case when next_state = 'succeeded' then 'payment_intent.succeeded' else coalesce(p_failure_code, 'payment_intent.payment_failed') end,
    'stripe:' || p_provider_event_id || ':charge'
  ) returning id into audit_id;

  insert into missionaccounts.notification_outbox(
    student_id, channel, event_kind, payload, state, idempotency_key
  ) values (
    p_student_id, 'matrix',
    case when next_state = 'succeeded' then 'charge.succeeded' else 'charge.failed' end,
    jsonb_build_object(
      'attendance_day_id', p_attendance_day_id, 'amount_cents', charge_row.amount_cents,
      'state', charge_row.state
    ),
    'pending', 'stripe:' || p_provider_event_id || ':charge-notification'
  ) on conflict (idempotency_key) do nothing;

  update missionaccounts.provider_event_inbox
  set state = 'processed', processed_at = now()
  where id = event_row.id;

  return jsonb_build_object('accepted', true, 'duplicate', false, 'audit_event_id', audit_id, 'charge', to_jsonb(charge_row));
end;
$$;

revoke execute on function missionaccounts.api_process_stripe_payment_intent(text, text, text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_process_stripe_payment_intent(text, text, text, uuid, uuid, text, text) to service_role;

create function missionaccounts.api_claim_notifications(
  p_worker_id text,
  p_limit integer default 10,
  p_now timestamptz default now()
)
returns setof missionaccounts.notification_outbox
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
begin
  if nullif(btrim(p_worker_id), '') is null or p_limit < 1 or p_limit > 25 or p_now is null then
    raise exception using errcode = '22023', message = 'invalid_notification_claim';
  end if;
  return query
  with claimable as (
    select id
    from missionaccounts.notification_outbox
    where state in ('pending','failed')
      and available_at <= p_now
      and attempt_count < 5
      and (locked_at is null or locked_at < p_now - interval '10 minutes')
    order by available_at, created_at, id
    for update skip locked
    limit p_limit
  )
  update missionaccounts.notification_outbox n
  set state = 'sending',
      attempt_count = n.attempt_count + 1,
      locked_by = p_worker_id,
      locked_at = p_now,
      last_error = null
  from claimable c
  where n.id = c.id
  returning n.*;
end;
$$;

revoke execute on function missionaccounts.api_claim_notifications(text, integer, timestamptz) from public, anon, authenticated;
grant execute on function missionaccounts.api_claim_notifications(text, integer, timestamptz) to service_role;

create function missionaccounts.api_finish_notification(
  p_notification_id uuid,
  p_worker_id text,
  p_succeeded boolean,
  p_provider_ref text default null,
  p_error text default null,
  p_now timestamptz default now()
)
returns missionaccounts.notification_outbox
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  row_out missionaccounts.notification_outbox%rowtype;
begin
  select * into row_out
  from missionaccounts.notification_outbox
  where id = p_notification_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'notification_not_found'; end if;
  if row_out.state <> 'sending' or row_out.locked_by is distinct from p_worker_id then
    raise exception using errcode = '22023', message = 'notification_claim_mismatch';
  end if;
  if p_succeeded and nullif(btrim(p_provider_ref), '') is null then
    raise exception using errcode = '22023', message = 'notification_provider_ref_required';
  end if;
  if not p_succeeded and nullif(btrim(p_error), '') is null then
    raise exception using errcode = '22023', message = 'notification_error_required';
  end if;

  update missionaccounts.notification_outbox
  set state = case when p_succeeded then 'sent' else 'failed' end,
      sent_at = case when p_succeeded then p_now else null end,
      provider_ref = case when p_succeeded then p_provider_ref else provider_ref end,
      last_error = case when p_succeeded then null else left(p_error, 2000) end,
      available_at = case when p_succeeded then available_at else p_now + (interval '1 minute' * least(60, power(2, row_out.attempt_count)::integer)) end,
      locked_by = null,
      locked_at = null
  where id = p_notification_id
  returning * into row_out;
  return row_out;
end;
$$;

revoke execute on function missionaccounts.api_finish_notification(uuid, text, boolean, text, text, timestamptz) from public, anon, authenticated;
grant execute on function missionaccounts.api_finish_notification(uuid, text, boolean, text, text, timestamptz) to service_role;

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
  ('notifications', false),
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

create trigger account_link_change_immutable
before update or delete on missionaccounts.account_link_change
for each row execute function missionaccounts.reject_immutable_change();

-- Every personal or financial table is RLS-protected even though browser writes
-- are intentionally unavailable. Server-side service role access remains private.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'student','account_link_change','identity_alias','identity_cluster','identity_cluster_member','identity_decision',
    'cycle_policy','rule_decision',
    'session','attendance_source_row','attendance_event',
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

revoke all on missionaccounts.attendance_event_projection from anon, authenticated;

create policy student_select_self_or_admin on missionaccounts.student
for select to authenticated
using (
  matrix_user_ref = (select auth.uid())::text
  or coalesce((select auth.jwt()) ->> 'app_role', '') in ('missionaccounts_admin','founder')
  or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb) ?| array['missionaccounts_admin','founder']
);

create policy billing_terms_select_approved on missionaccounts.billing_terms
for select to authenticated
using (status = 'approved');

create policy attendance_event_select_self_or_admin on missionaccounts.attendance_event
for select to authenticated
using (
  exists (select 1 from missionaccounts.student s where s.id = student_id and s.matrix_user_ref = (select auth.uid())::text)
  or coalesce((select auth.jwt()) ->> 'app_role', '') in ('missionaccounts_admin','founder')
  or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb) ?| array['missionaccounts_admin','founder']
);

create policy attendance_day_select_self_or_admin on missionaccounts.attendance_day
for select to authenticated
using (
  exists (select 1 from missionaccounts.student s where s.id = student_id and s.matrix_user_ref = (select auth.uid())::text)
  or coalesce((select auth.jwt()) ->> 'app_role', '') in ('missionaccounts_admin','founder')
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
        or coalesce((select auth.jwt()) ->> 'app_role', '')
          in ('missionaccounts_admin','founder')
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
