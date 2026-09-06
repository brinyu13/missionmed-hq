-- MX-MISSIONACCOUNTS-5301P
-- Additive, feature-off schema candidate. Do not apply to production until the
-- mission registration, Matrix runtime lock, restore point, and release gates pass.

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
  matrix_user_ref uuid unique,
  display_name text not null,
  email text,
  joined_at timestamptz,
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
  approved_by uuid,
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
  actor_id uuid not null,
  request_id text not null,
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
  decided_by uuid,
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
  apply_retroactively boolean not null default false,
  reason text not null check (length(btrim(reason)) > 0),
  actor_id uuid not null,
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
  submitted_by uuid not null,
  submitted_at timestamptz not null default now(),
  decided_by uuid,
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
  accepted boolean not null,
  reason text,
  actor_id uuid not null,
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
  decided_by uuid,
  decided_at timestamptz,
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
  set_by uuid not null,
  set_at timestamptz not null default now(),
  primary key (cycle_key, key)
);

create table missionaccounts.rule_decision (
  id uuid primary key default gen_random_uuid(),
  rule text not null,
  mode text not null check (mode in ('retroactive','prospective')),
  effective_from date not null,
  basis jsonb not null,
  decided_by uuid,
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

create table missionaccounts.payment_method_private (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references missionaccounts.student(id),
  provider text not null check (provider = 'stripe'),
  provider_customer_ref text not null,
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

create table missionaccounts.billing_consent (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  terms_version text not null,
  accepted_at timestamptz,
  accepted_ip inet,
  revoked_at timestamptz,
  state text not null check (state in ('none','authorized','revoked')),
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
  actor_id uuid,
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
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into missionaccounts.feature_flag(key, enabled) values
  ('missionaccounts_route', false),
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
    'billing_consent','charge','charge_attempt','notification_outbox','audit_event'
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

grant select (id, student_id, brand, last4, exp_month, exp_year, status, verified_at, updated_at)
on missionaccounts.payment_method_private to authenticated;

create policy student_select_self_or_admin on missionaccounts.student
for select to authenticated
using (
  matrix_user_ref = (select auth.uid())
  or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb) ?| array['missionaccounts_admin','founder']
);

create policy attendance_event_select_self_or_admin on missionaccounts.attendance_event
for select to authenticated
using (
  exists (select 1 from missionaccounts.student s where s.id = student_id and s.matrix_user_ref = (select auth.uid()))
  or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb) ?| array['missionaccounts_admin','founder']
);

create policy attendance_day_select_self_or_admin on missionaccounts.attendance_day
for select to authenticated
using (
  exists (select 1 from missionaccounts.student s where s.id = student_id and s.matrix_user_ref = (select auth.uid()))
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
          where s.id = student_id and s.matrix_user_ref = (select auth.uid())
        )
        or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb)
          ?| array['missionaccounts_admin','founder']
      )
    $policy$, table_name || '_select_self_or_admin', table_name);
  end loop;
end $$;

revoke all on missionaccounts.payment_method_private from anon, authenticated;
revoke all on all tables in schema missionaccounts from anon;
grant all on all tables in schema missionaccounts to service_role;
grant usage, select on all sequences in schema missionaccounts to service_role;

comment on schema missionaccounts is
  'MissionAccounts isolated domain. Browser mutations go through authenticated app APIs; production activation is feature-gated.';
