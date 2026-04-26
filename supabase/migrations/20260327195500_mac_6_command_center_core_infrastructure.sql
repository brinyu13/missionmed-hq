-- ============================================================================
-- MAC-6 - MissionMed Command Center Core Infrastructure
-- Locked architecture: WordPress shell + Supabase backend + event-driven APIs
-- Tables: students, leads, events, tasks, payments, email_drafts, notes,
-- alerts, lead_scores
-- ============================================================================

begin;
create extension if not exists pgcrypto;
create extension if not exists citext;
create schema if not exists command_center;
create or replace function command_center.touch_record()
returns trigger
language plpgsql
as $$
begin
  if new.source_system is null or btrim(new.source_system) = '' then
    raise exception 'source_system is required on command_center.%', tg_table_name;
  end if;

  if tg_op = 'INSERT' and new.created_at is null then
    new.created_at := now();
  end if;

  if new.last_synced_at is null then
    new.last_synced_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;
create table if not exists command_center.leads (
  id uuid primary key default gen_random_uuid(),
  assigned_to text not null default 'brian'
    check (assigned_to in ('brian', 'dr_j', 'phil', 'system', 'unassigned')),
  full_name text,
  first_name text,
  last_name text,
  email citext,
  phone text,
  country text,
  timezone_name text,
  lead_source text,
  lead_source_detail text,
  campaign_name text,
  lead_status text not null default 'new'
    check (lead_status in (
      'new',
      'engaged',
      'qualified',
      'call_booked',
      'offer_sent',
      'payment_pending',
      'converted',
      'lost',
      'disqualified'
    )),
  funnel_stage text not null default 'lead_captured'
    check (funnel_stage in (
      'lead_captured',
      'strategy_call_booked',
      'strategy_call_completed',
      'offer_sent',
      'payment_pending',
      'converted',
      'lost',
      'disqualified'
    )),
  intake_summary text,
  last_contact_at timestamptz,
  last_engagement_at timestamptz,
  source_system text not null default 'manual',
  source_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists command_center.students (
  id uuid primary key default gen_random_uuid(),
  originating_lead_id uuid references command_center.leads(id) on delete set null,
  assigned_to text not null default 'brian'
    check (assigned_to in ('brian', 'dr_j', 'phil', 'system', 'unassigned')),
  full_name text not null,
  preferred_name text,
  email citext,
  phone text,
  country text,
  timezone_name text,
  visa_status text,
  yog integer,
  medical_school text,
  match_cycle_year integer,
  program_tier text not null default 'mission_residency'
    check (program_tier in (
      'mission_residency',
      'usmle_drills',
      'usce',
      'membership',
      'other'
    )),
  student_status text not null default 'active'
    check (student_status in (
      'onboarding',
      'active',
      'at_risk',
      'payment_hold',
      'matched',
      'alumni',
      'paused',
      'archived'
    )),
  funnel_stage text not null default 'enrollment_pending'
    check (funnel_stage in (
      'enrollment_pending',
      'onboarding',
      'active_training',
      'interview_season',
      'rank_list',
      'matched',
      'alumni',
      'cancelled'
    )),
  enrollment_date date,
  last_activity_at timestamptz,
  last_payment_at timestamptz,
  risk_level text not null default 'info'
    check (risk_level in ('critical', 'warning', 'info', 'none')),
  source_system text not null default 'manual',
  source_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists command_center.events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references command_center.leads(id) on delete cascade,
  student_id uuid references command_center.students(id) on delete cascade,
  aggregate_type text not null
    check (aggregate_type in (
      'lead',
      'student',
      'task',
      'payment',
      'email_draft',
      'note',
      'alert',
      'lead_score',
      'system'
    )),
  aggregate_id uuid,
  event_family text not null default 'integration'
    check (event_family in ('integration', 'workflow', 'user_action', 'system')),
  event_type text not null,
  source_system text not null,
  source_record_id text,
  external_event_id text,
  correlation_id text,
  causation_event_id uuid references command_center.events(id) on delete set null,
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    lead_id is not null
    or student_id is not null
    or aggregate_type = 'system'
  )
);
create table if not exists command_center.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references command_center.leads(id) on delete cascade,
  student_id uuid references command_center.students(id) on delete cascade,
  source_event_id uuid references command_center.events(id) on delete set null,
  assigned_to text not null default 'brian'
    check (assigned_to in ('brian', 'dr_j', 'phil', 'system', 'unassigned')),
  created_by text not null default 'system',
  title text not null,
  description text,
  priority integer not null default 3
    check (priority between 1 and 5),
  task_status text not null default 'open'
    check (task_status in ('open', 'in_progress', 'complete', 'verified', 'cancelled')),
  auto_generated boolean not null default false,
  due_at timestamptz,
  completed_at timestamptz,
  source_system text not null default 'manual',
  source_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or student_id is not null)
);
create table if not exists command_center.payments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references command_center.leads(id) on delete set null,
  student_id uuid references command_center.students(id) on delete set null,
  source_event_id uuid references command_center.events(id) on delete set null,
  assigned_to text not null default 'phil'
    check (assigned_to in ('brian', 'dr_j', 'phil', 'system', 'unassigned')),
  processor_name text not null default 'stripe'
    check (processor_name in ('stripe', 'woocommerce', 'manual', 'other')),
  stripe_account text,
  processor_payment_id text,
  processor_invoice_id text,
  payment_type text not null default 'charge'
    check (payment_type in ('charge', 'refund', 'subscription', 'installment', 'retry', 'adjustment')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'succeeded', 'failed', 'refunded', 'disputed', 'cancelled')),
  amount numeric(12,2) not null,
  currency text not null default 'usd',
  payment_at timestamptz not null default now(),
  source_system text not null default 'manual',
  source_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or student_id is not null)
);
create table if not exists command_center.email_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references command_center.leads(id) on delete cascade,
  student_id uuid references command_center.students(id) on delete cascade,
  source_event_id uuid references command_center.events(id) on delete set null,
  assigned_to text not null default 'brian'
    check (assigned_to in ('brian', 'dr_j', 'phil', 'system', 'unassigned')),
  gmail_thread_id text,
  gmail_message_id text,
  subject text not null,
  preview_text text,
  body_draft text not null,
  ai_confidence numeric(4,3)
    check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  ai_model text,
  draft_status text not null default 'draft'
    check (draft_status in ('draft', 'review', 'edited', 'approved', 'sent', 'rejected')),
  edited_by text,
  sent_at timestamptz,
  source_system text not null default 'system',
  source_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or student_id is not null)
);
create table if not exists command_center.notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references command_center.leads(id) on delete cascade,
  student_id uuid references command_center.students(id) on delete cascade,
  source_event_id uuid references command_center.events(id) on delete set null,
  author text not null default 'brian'
    check (author in ('brian', 'dr_j', 'phil', 'system')),
  note_kind text not null default 'internal'
    check (note_kind in ('internal', 'coaching', 'payment', 'email', 'enrollment', 'system')),
  content text not null,
  pinned boolean not null default false,
  created_by_ai boolean not null default false,
  source_system text not null default 'manual',
  source_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or student_id is not null)
);
create table if not exists command_center.lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references command_center.leads(id) on delete cascade,
  source_event_id uuid references command_center.events(id) on delete set null,
  score integer not null check (score between 0 and 100),
  confidence numeric(4,3)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  summary text,
  model_name text,
  signals jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  source_system text not null default 'system',
  source_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists command_center.alerts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references command_center.leads(id) on delete cascade,
  student_id uuid references command_center.students(id) on delete cascade,
  task_id uuid references command_center.tasks(id) on delete set null,
  source_event_id uuid references command_center.events(id) on delete set null,
  assigned_to text not null default 'brian'
    check (assigned_to in ('brian', 'dr_j', 'phil', 'system', 'unassigned')),
  alert_type text not null,
  severity text not null default 'warning'
    check (severity in ('critical', 'warning', 'info')),
  message text not null,
  alert_status text not null default 'open'
    check (alert_status in ('open', 'acknowledged', 'resolved', 'expired')),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  expires_at timestamptz,
  dedupe_key text,
  source_system text not null default 'system',
  source_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or student_id is not null or task_id is not null)
);
comment on table command_center.leads is 'Pre-enrollment operators view. Captures lead state before conversion.';
comment on table command_center.students is 'Canonical student record for enrolled or post-conversion MissionMed participants.';
comment on table command_center.events is 'Append-only event log. All ingestion connectors write here before or alongside read-model updates.';
comment on table command_center.tasks is 'Operational work queue for Brian, Dr. J, Phil, and system-generated actions.';
comment on table command_center.payments is 'Normalized Stripe and WooCommerce payment ledger.';
comment on table command_center.email_drafts is 'Human-reviewed AI draft layer for Gmail replies.';
comment on table command_center.notes is 'Internal note stream for operational and advising context.';
comment on table command_center.alerts is 'Urgency model for payment, engagement, and workflow exceptions.';
comment on table command_center.lead_scores is 'Lead conversion probability snapshots generated from event data.';
create unique index if not exists ux_command_center_leads_email
  on command_center.leads (email)
  where email is not null;
create unique index if not exists ux_command_center_leads_source_record
  on command_center.leads (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_command_center_leads_assignment
  on command_center.leads (assigned_to, lead_status, funnel_stage, created_at desc);
create index if not exists idx_command_center_leads_engagement
  on command_center.leads (last_engagement_at desc nulls last);
create unique index if not exists ux_command_center_students_email
  on command_center.students (email)
  where email is not null;
create unique index if not exists ux_command_center_students_source_record
  on command_center.students (source_system, source_record_id)
  where source_record_id is not null;
create unique index if not exists ux_command_center_students_originating_lead
  on command_center.students (originating_lead_id)
  where originating_lead_id is not null;
create index if not exists idx_command_center_students_assignment
  on command_center.students (assigned_to, student_status, funnel_stage, last_activity_at desc nulls last);
create index if not exists idx_command_center_students_risk
  on command_center.students (risk_level, last_activity_at desc nulls last);
create unique index if not exists ux_command_center_events_dedupe
  on command_center.events (dedupe_key)
  where dedupe_key is not null;
create unique index if not exists ux_command_center_events_external
  on command_center.events (source_system, external_event_id)
  where external_event_id is not null;
create index if not exists idx_command_center_events_lead
  on command_center.events (lead_id, occurred_at desc);
create index if not exists idx_command_center_events_student
  on command_center.events (student_id, occurred_at desc);
create index if not exists idx_command_center_events_type
  on command_center.events (event_type, occurred_at desc);
create unique index if not exists ux_command_center_tasks_source_record
  on command_center.tasks (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_command_center_tasks_assignee
  on command_center.tasks (assigned_to, task_status, priority, due_at);
create index if not exists idx_command_center_tasks_student
  on command_center.tasks (student_id, task_status, due_at);
create index if not exists idx_command_center_tasks_lead
  on command_center.tasks (lead_id, task_status, due_at);
create unique index if not exists ux_command_center_payments_processor
  on command_center.payments (processor_name, processor_payment_id)
  where processor_payment_id is not null;
create unique index if not exists ux_command_center_payments_source_record
  on command_center.payments (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_command_center_payments_student
  on command_center.payments (student_id, payment_at desc);
create index if not exists idx_command_center_payments_lead
  on command_center.payments (lead_id, payment_at desc);
create index if not exists idx_command_center_payments_status
  on command_center.payments (payment_status, payment_at desc);
create unique index if not exists ux_command_center_email_drafts_source_record
  on command_center.email_drafts (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_command_center_email_drafts_queue
  on command_center.email_drafts (assigned_to, draft_status, created_at desc);
create index if not exists idx_command_center_email_drafts_student
  on command_center.email_drafts (student_id, created_at desc);
create unique index if not exists ux_command_center_notes_source_record
  on command_center.notes (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_command_center_notes_student
  on command_center.notes (student_id, created_at desc);
create index if not exists idx_command_center_notes_lead
  on command_center.notes (lead_id, created_at desc);
create index if not exists idx_command_center_notes_pinned
  on command_center.notes (pinned, created_at desc);
create unique index if not exists ux_command_center_lead_scores_source_record
  on command_center.lead_scores (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_command_center_lead_scores_latest
  on command_center.lead_scores (lead_id, computed_at desc);
create unique index if not exists ux_command_center_alerts_source_record
  on command_center.alerts (source_system, source_record_id)
  where source_record_id is not null;
create unique index if not exists ux_command_center_alerts_open_dedupe
  on command_center.alerts (dedupe_key)
  where dedupe_key is not null and alert_status in ('open', 'acknowledged');
create index if not exists idx_command_center_alerts_assignee
  on command_center.alerts (assigned_to, alert_status, severity, created_at desc);
create index if not exists idx_command_center_alerts_student
  on command_center.alerts (student_id, alert_status, created_at desc);
create index if not exists idx_command_center_alerts_lead
  on command_center.alerts (lead_id, alert_status, created_at desc);
drop trigger if exists trg_command_center_leads_touch on command_center.leads;
create trigger trg_command_center_leads_touch
before insert or update on command_center.leads
for each row execute function command_center.touch_record();
drop trigger if exists trg_command_center_students_touch on command_center.students;
create trigger trg_command_center_students_touch
before insert or update on command_center.students
for each row execute function command_center.touch_record();
drop trigger if exists trg_command_center_events_touch on command_center.events;
create trigger trg_command_center_events_touch
before insert or update on command_center.events
for each row execute function command_center.touch_record();
drop trigger if exists trg_command_center_tasks_touch on command_center.tasks;
create trigger trg_command_center_tasks_touch
before insert or update on command_center.tasks
for each row execute function command_center.touch_record();
drop trigger if exists trg_command_center_payments_touch on command_center.payments;
create trigger trg_command_center_payments_touch
before insert or update on command_center.payments
for each row execute function command_center.touch_record();
drop trigger if exists trg_command_center_email_drafts_touch on command_center.email_drafts;
create trigger trg_command_center_email_drafts_touch
before insert or update on command_center.email_drafts
for each row execute function command_center.touch_record();
drop trigger if exists trg_command_center_notes_touch on command_center.notes;
create trigger trg_command_center_notes_touch
before insert or update on command_center.notes
for each row execute function command_center.touch_record();
drop trigger if exists trg_command_center_lead_scores_touch on command_center.lead_scores;
create trigger trg_command_center_lead_scores_touch
before insert or update on command_center.lead_scores
for each row execute function command_center.touch_record();
drop trigger if exists trg_command_center_alerts_touch on command_center.alerts;
create trigger trg_command_center_alerts_touch
before insert or update on command_center.alerts
for each row execute function command_center.touch_record();
create or replace function command_center.append_event(
  p_event_type text,
  p_source_system text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_lead_id uuid default null,
  p_student_id uuid default null,
  p_event_family text default 'integration',
  p_external_event_id text default null,
  p_source_record_id text default null,
  p_dedupe_key text default null,
  p_correlation_id text default null,
  p_causation_event_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
as $$
declare
  v_event_id uuid;
begin
  insert into command_center.events (
    lead_id,
    student_id,
    aggregate_type,
    aggregate_id,
    event_family,
    event_type,
    source_system,
    source_record_id,
    external_event_id,
    correlation_id,
    causation_event_id,
    dedupe_key,
    payload,
    occurred_at,
    processed_at
  )
  values (
    p_lead_id,
    p_student_id,
    p_aggregate_type,
    p_aggregate_id,
    p_event_family,
    p_event_type,
    p_source_system,
    p_source_record_id,
    p_external_event_id,
    p_correlation_id,
    p_causation_event_id,
    p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_occurred_at, now()),
    now()
  )
  on conflict (dedupe_key) where dedupe_key is not null
  do update set
    payload = excluded.payload,
    processed_at = now(),
    updated_at = now()
  returning id into v_event_id;

  return v_event_id;
end;
$$;
create or replace view command_center.latest_lead_scores_v1 as
select distinct on (ls.lead_id)
  ls.id,
  ls.lead_id,
  ls.score,
  ls.confidence,
  ls.summary,
  ls.model_name,
  ls.signals,
  ls.computed_at
from command_center.lead_scores ls
order by ls.lead_id, ls.computed_at desc, ls.created_at desc;
create or replace view command_center.student_directory_v1 as
with task_rollup as (
  select
    t.student_id,
    count(*) filter (where t.task_status in ('open', 'in_progress'))::integer as open_task_count,
    min(t.due_at) filter (where t.task_status in ('open', 'in_progress')) as next_due_at
  from command_center.tasks t
  where t.student_id is not null
  group by t.student_id
),
alert_rollup as (
  select
    a.student_id,
    count(*) filter (where a.alert_status in ('open', 'acknowledged'))::integer as open_alert_count,
    max(
      case a.severity
        when 'critical' then 3
        when 'warning' then 2
        when 'info' then 1
        else 0
      end
    ) as highest_severity_rank
  from command_center.alerts a
  where a.student_id is not null
  group by a.student_id
),
payment_rollup as (
  select distinct on (p.student_id)
    p.student_id,
    p.payment_status as latest_payment_status,
    p.amount as latest_payment_amount,
    p.payment_at as latest_payment_at
  from command_center.payments p
  where p.student_id is not null
  order by p.student_id, p.payment_at desc, p.created_at desc
),
event_rollup as (
  select
    e.student_id,
    max(e.occurred_at) as last_event_at
  from command_center.events e
  where e.student_id is not null
  group by e.student_id
)
select
  s.id as student_id,
  s.originating_lead_id as lead_id,
  s.full_name,
  s.preferred_name,
  s.email::text as email,
  s.phone,
  s.program_tier,
  s.student_status,
  s.funnel_stage,
  s.assigned_to,
  s.risk_level,
  s.match_cycle_year,
  s.medical_school,
  s.last_activity_at,
  coalesce(tr.open_task_count, 0) as open_task_count,
  coalesce(ar.open_alert_count, 0) as open_alert_count,
  case ar.highest_severity_rank
    when 3 then 'critical'
    when 2 then 'warning'
    when 1 then 'info'
    else 'none'
  end as highest_alert_severity,
  pr.latest_payment_status,
  pr.latest_payment_amount,
  pr.latest_payment_at,
  ls.score as latest_lead_score,
  ls.summary as latest_lead_score_summary,
  coalesce(ev.last_event_at, s.updated_at) as last_event_at,
  tr.next_due_at
from command_center.students s
left join task_rollup tr
  on tr.student_id = s.id
left join alert_rollup ar
  on ar.student_id = s.id
left join payment_rollup pr
  on pr.student_id = s.id
left join event_rollup ev
  on ev.student_id = s.id
left join command_center.latest_lead_scores_v1 ls
  on ls.lead_id = s.originating_lead_id;
create or replace view command_center.student_profile_v1 as
select
  s.id as student_id,
  s.full_name,
  s.preferred_name,
  s.email::text as email,
  s.phone,
  s.country,
  s.timezone_name,
  s.visa_status,
  s.yog,
  s.medical_school,
  s.match_cycle_year,
  s.program_tier,
  s.student_status,
  s.funnel_stage,
  s.enrollment_date,
  s.last_activity_at,
  s.last_payment_at,
  s.risk_level,
  s.assigned_to,
  s.metadata as student_metadata,
  l.id as lead_id,
  l.lead_source,
  l.lead_status,
  l.funnel_stage as lead_funnel_stage,
  l.campaign_name,
  l.intake_summary,
  ls.score as latest_lead_score,
  ls.confidence as latest_lead_score_confidence,
  ls.summary as latest_lead_score_summary,
  ls.signals as latest_lead_score_signals
from command_center.students s
left join command_center.leads l
  on l.id = s.originating_lead_id
left join command_center.latest_lead_scores_v1 ls
  on ls.lead_id = s.originating_lead_id;
create or replace view command_center.task_queue_v1 as
select
  t.id as task_id,
  t.student_id,
  t.lead_id,
  coalesce(s.full_name, l.full_name, 'Unassigned record') as person_name,
  s.program_tier,
  t.assigned_to,
  t.created_by,
  t.title,
  t.description,
  t.priority,
  t.task_status,
  t.auto_generated,
  t.due_at,
  t.completed_at,
  t.created_at,
  t.updated_at
from command_center.tasks t
left join command_center.students s
  on s.id = t.student_id
left join command_center.leads l
  on l.id = t.lead_id;
create or replace view command_center.payment_feed_v1 as
select
  p.id as payment_id,
  p.student_id,
  p.lead_id,
  coalesce(s.full_name, l.full_name, 'Unknown') as person_name,
  s.program_tier,
  p.assigned_to,
  p.processor_name,
  p.stripe_account,
  p.processor_payment_id,
  p.processor_invoice_id,
  p.payment_type,
  p.payment_status,
  p.amount,
  p.currency,
  p.payment_at,
  p.metadata
from command_center.payments p
left join command_center.students s
  on s.id = p.student_id
left join command_center.leads l
  on l.id = p.lead_id;
create or replace view command_center.email_queue_v1 as
select
  e.id as email_draft_id,
  e.student_id,
  e.lead_id,
  coalesce(s.full_name, l.full_name, 'Unknown') as person_name,
  s.program_tier,
  e.assigned_to,
  e.gmail_thread_id,
  e.gmail_message_id,
  e.subject,
  e.preview_text,
  e.ai_confidence,
  e.ai_model,
  e.draft_status,
  e.edited_by,
  e.sent_at,
  e.created_at
from command_center.email_drafts e
left join command_center.students s
  on s.id = e.student_id
left join command_center.leads l
  on l.id = e.lead_id;
grant usage on schema command_center to authenticated, service_role;
grant select on
  command_center.latest_lead_scores_v1,
  command_center.student_directory_v1,
  command_center.student_profile_v1,
  command_center.task_queue_v1,
  command_center.payment_feed_v1,
  command_center.email_queue_v1
to authenticated, service_role;
comment on function command_center.append_event(text, text, text, uuid, uuid, uuid, text, text, text, text, text, uuid, jsonb, timestamptz)
  is 'Append-only event writer for webhook and action handlers. Use this as the canonical write path for external connectors.';
commit;
