-- ============================================================================
-- MR-903A - MissionMed Command Center Phase 1 Schema
-- Root entity: crm.people
-- Schemas: core, crm, comms, ops, finance, content, tracking
-- ============================================================================

begin;
create extension if not exists pgcrypto;
create extension if not exists citext;
create schema if not exists core;
create schema if not exists crm;
create schema if not exists comms;
create schema if not exists ops;
create schema if not exists finance;
create schema if not exists content;
create schema if not exists tracking;
create or replace function core.touch_common_columns()
returns trigger
language plpgsql
as $$
begin
  if new.source_system is null or btrim(new.source_system) = '' then
    raise exception 'source_system is required on %.%', tg_table_schema, tg_table_name;
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
-- ============================================================================
-- crm root
-- ============================================================================

create table if not exists crm.people (
  id uuid primary key default gen_random_uuid(),
  owner_person_id uuid references crm.people(id) on delete set null,
  person_type text not null default 'lead'
    check (person_type in ('lead', 'student', 'alumni', 'staff', 'partner', 'other')),
  record_status text not null default 'active'
    check (record_status in ('active', 'inactive', 'archived', 'merged')),
  full_name text,
  first_name text,
  last_name text,
  email citext,
  phone text,
  timezone_name text,
  country_code text,
  lead_source text,
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'manual',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table crm.people is 'Canonical MissionMed person record. Every Phase 1 operational table links back to this table.';
create unique index if not exists ux_people_email
  on crm.people (email)
  where email is not null;
create unique index if not exists ux_people_source_record
  on crm.people (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_people_owner
  on crm.people (owner_person_id);
create index if not exists idx_people_record_status
  on crm.people (record_status, person_type);
drop trigger if exists trg_people_touch_common_columns on crm.people;
create trigger trg_people_touch_common_columns
before insert or update on crm.people
for each row execute function core.touch_common_columns();
-- ============================================================================
-- core
-- ============================================================================

create table if not exists core.divisions (
  id uuid primary key default gen_random_uuid(),
  leader_person_id uuid references crm.people(id) on delete set null,
  name text not null,
  slug text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'manual',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name),
  unique (slug)
);
create table if not exists core.staff_users (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  division_id uuid references core.divisions(id) on delete set null,
  role_key text not null default 'staff'
    check (role_key in ('admin', 'advisor', 'coach', 'operations', 'finance', 'content', 'support', 'staff')),
  job_title text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'manual',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id)
);
create unique index if not exists ux_divisions_source_record
  on core.divisions (source_system, source_record_id)
  where source_record_id is not null;
create unique index if not exists ux_staff_users_source_record
  on core.staff_users (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_divisions_leader_person
  on core.divisions (leader_person_id);
create index if not exists idx_staff_users_division_active
  on core.staff_users (division_id, is_active);
drop trigger if exists trg_divisions_touch_common_columns on core.divisions;
create trigger trg_divisions_touch_common_columns
before insert or update on core.divisions
for each row execute function core.touch_common_columns();
drop trigger if exists trg_staff_users_touch_common_columns on core.staff_users;
create trigger trg_staff_users_touch_common_columns
before insert or update on core.staff_users
for each row execute function core.touch_common_columns();
-- ============================================================================
-- crm
-- ============================================================================

create table if not exists crm.student_profiles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  match_cycle_year integer,
  medical_school text,
  graduation_year integer,
  candidate_track text
    check (candidate_track in ('img', 'usmd', 'do', 'caribbean', 'other')),
  visa_status text,
  ecfmg_status text,
  specialty_interest text,
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'manual',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id)
);
create table if not exists crm.enrollments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  owner_person_id uuid references crm.people(id) on delete set null,
  student_profile_id uuid references crm.student_profiles(id) on delete set null,
  program_name text not null,
  program_category text not null default 'consulting'
    check (program_category in ('consulting', 'course', 'membership', 'rotation', 'coaching', 'other')),
  pipeline_stage text not null default 'lead_captured'
    check (pipeline_stage in (
      'lead_captured',
      'qualified',
      'strategy_call_booked',
      'strategy_call_completed',
      'offer_sent',
      'payment_pending',
      'enrolled',
      'lost'
    )),
  enrollment_status text not null default 'open'
    check (enrollment_status in ('open', 'enrolled', 'active', 'completed', 'lost', 'cancelled', 'refunded')),
  booked_call_at timestamptz,
  enrollment_date date,
  expected_start_date date,
  expected_end_date date,
  closed_at timestamptz,
  amount_quoted numeric(12,2),
  amount_collected numeric(12,2) not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'manual',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists crm.pipeline_stage_history (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  enrollment_id uuid not null references crm.enrollments(id) on delete cascade,
  from_stage text
    check (
      from_stage is null or from_stage in (
        'lead_captured',
        'qualified',
        'strategy_call_booked',
        'strategy_call_completed',
        'offer_sent',
        'payment_pending',
        'enrolled',
        'lost'
      )
    ),
  to_stage text not null
    check (to_stage in (
      'lead_captured',
      'qualified',
      'strategy_call_booked',
      'strategy_call_completed',
      'offer_sent',
      'payment_pending',
      'enrolled',
      'lost'
    )),
  changed_by_person_id uuid references crm.people(id) on delete set null,
  change_reason text,
  changed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'manual',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_student_profiles_source_record
  on crm.student_profiles (source_system, source_record_id)
  where source_record_id is not null;
create unique index if not exists ux_enrollments_source_record
  on crm.enrollments (source_system, source_record_id)
  where source_record_id is not null;
create unique index if not exists ux_pipeline_stage_history_source_record
  on crm.pipeline_stage_history (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_student_profiles_person
  on crm.student_profiles (person_id);
create index if not exists idx_enrollments_person
  on crm.enrollments (person_id, enrollment_status);
create index if not exists idx_enrollments_pipeline_stage
  on crm.enrollments (pipeline_stage, enrollment_status);
create index if not exists idx_enrollments_owner
  on crm.enrollments (owner_person_id, pipeline_stage, enrollment_status);
create index if not exists idx_pipeline_stage_history_person
  on crm.pipeline_stage_history (person_id, changed_at desc);
create index if not exists idx_pipeline_stage_history_stage
  on crm.pipeline_stage_history (to_stage, changed_at desc);
drop trigger if exists trg_student_profiles_touch_common_columns on crm.student_profiles;
create trigger trg_student_profiles_touch_common_columns
before insert or update on crm.student_profiles
for each row execute function core.touch_common_columns();
drop trigger if exists trg_enrollments_touch_common_columns on crm.enrollments;
create trigger trg_enrollments_touch_common_columns
before insert or update on crm.enrollments
for each row execute function core.touch_common_columns();
drop trigger if exists trg_pipeline_stage_history_touch_common_columns on crm.pipeline_stage_history;
create trigger trg_pipeline_stage_history_touch_common_columns
before insert or update on crm.pipeline_stage_history
for each row execute function core.touch_common_columns();
-- ============================================================================
-- comms
-- ============================================================================

create table if not exists comms.email_threads (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  owner_person_id uuid references crm.people(id) on delete set null,
  external_thread_id text,
  subject text,
  thread_status text not null default 'open'
    check (thread_status in ('open', 'waiting_on_team', 'waiting_on_person', 'closed', 'archived')),
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  message_count integer not null default 0 check (message_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'gmail',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists comms.email_messages (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  thread_id uuid not null references comms.email_threads(id) on delete cascade,
  owner_person_id uuid references crm.people(id) on delete set null,
  direction text not null
    check (direction in ('inbound', 'outbound', 'internal')),
  message_status text not null default 'received'
    check (message_status in ('draft', 'queued', 'sent', 'received', 'failed', 'bounced')),
  external_message_id text,
  from_email citext,
  to_emails jsonb not null default '[]'::jsonb,
  cc_emails jsonb not null default '[]'::jsonb,
  subject text,
  snippet text,
  body_text text,
  sent_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'gmail',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_email_threads_external_thread
  on comms.email_threads (source_system, external_thread_id)
  where external_thread_id is not null;
create unique index if not exists ux_email_threads_source_record
  on comms.email_threads (source_system, source_record_id)
  where source_record_id is not null;
create unique index if not exists ux_email_messages_external_message
  on comms.email_messages (source_system, external_message_id)
  where external_message_id is not null;
create unique index if not exists ux_email_messages_source_record
  on comms.email_messages (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_email_threads_person
  on comms.email_threads (person_id, last_message_at desc);
create index if not exists idx_email_threads_owner
  on comms.email_threads (owner_person_id, thread_status, last_message_at desc);
create index if not exists idx_email_messages_thread
  on comms.email_messages (thread_id, sent_at desc);
create index if not exists idx_email_messages_person
  on comms.email_messages (person_id, sent_at desc);
drop trigger if exists trg_email_threads_touch_common_columns on comms.email_threads;
create trigger trg_email_threads_touch_common_columns
before insert or update on comms.email_threads
for each row execute function core.touch_common_columns();
drop trigger if exists trg_email_messages_touch_common_columns on comms.email_messages;
create trigger trg_email_messages_touch_common_columns
before insert or update on comms.email_messages
for each row execute function core.touch_common_columns();
-- ============================================================================
-- finance
-- ============================================================================

create table if not exists finance.orders (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  enrollment_id uuid references crm.enrollments(id) on delete set null,
  owner_person_id uuid references crm.people(id) on delete set null,
  order_number text,
  program_name text not null,
  order_status text not null default 'draft'
    check (order_status in ('draft', 'pending', 'paid', 'partially_paid', 'refunded', 'cancelled')),
  currency_code char(3) not null default 'USD',
  subtotal_amount numeric(12,2) not null default 0 check (subtotal_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  ordered_at timestamptz not null default now(),
  paid_in_full_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'woocommerce',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists finance.payments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  order_id uuid not null references finance.orders(id) on delete cascade,
  enrollment_id uuid references crm.enrollments(id) on delete set null,
  owner_person_id uuid references crm.people(id) on delete set null,
  payment_kind text not null default 'payment'
    check (payment_kind in ('payment', 'refund', 'chargeback', 'adjustment')),
  payment_status text not null default 'posted'
    check (payment_status in ('pending', 'posted', 'failed', 'voided')),
  payment_method text,
  processor_name text,
  processor_transaction_id text,
  amount numeric(12,2) not null check (amount >= 0),
  currency_code char(3) not null default 'USD',
  paid_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'woocommerce',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_orders_order_number
  on finance.orders (order_number)
  where order_number is not null;
create unique index if not exists ux_orders_source_record
  on finance.orders (source_system, source_record_id)
  where source_record_id is not null;
create unique index if not exists ux_payments_processor_transaction
  on finance.payments (processor_name, processor_transaction_id)
  where processor_transaction_id is not null;
create unique index if not exists ux_payments_source_record
  on finance.payments (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_orders_person
  on finance.orders (person_id, ordered_at desc);
create index if not exists idx_orders_owner
  on finance.orders (owner_person_id, order_status, ordered_at desc);
create index if not exists idx_payments_order
  on finance.payments (order_id, paid_at desc);
create index if not exists idx_payments_person
  on finance.payments (person_id, paid_at desc);
drop trigger if exists trg_orders_touch_common_columns on finance.orders;
create trigger trg_orders_touch_common_columns
before insert or update on finance.orders
for each row execute function core.touch_common_columns();
drop trigger if exists trg_payments_touch_common_columns on finance.payments;
create trigger trg_payments_touch_common_columns
before insert or update on finance.payments
for each row execute function core.touch_common_columns();
-- ============================================================================
-- ops
-- ============================================================================

create table if not exists ops.tasks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  enrollment_id uuid references crm.enrollments(id) on delete set null,
  owner_person_id uuid references crm.people(id) on delete set null,
  created_by_person_id uuid references crm.people(id) on delete set null,
  title text not null,
  description text,
  task_type text not null default 'follow_up'
    check (task_type in ('follow_up', 'call', 'email', 'document', 'finance', 'content', 'admin', 'other')),
  task_status text not null default 'open'
    check (task_status in ('open', 'in_progress', 'blocked', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'manual',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists ops.notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  enrollment_id uuid references crm.enrollments(id) on delete set null,
  task_id uuid references ops.tasks(id) on delete set null,
  thread_id uuid references comms.email_threads(id) on delete set null,
  author_person_id uuid references crm.people(id) on delete set null,
  note_type text not null default 'internal'
    check (note_type in ('internal', 'call_summary', 'email_summary', 'finance', 'student_profile', 'system')),
  visibility text not null default 'internal'
    check (visibility in ('internal', 'private', 'shared')),
  body text not null,
  noted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'manual',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists ops.alerts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  enrollment_id uuid references crm.enrollments(id) on delete set null,
  task_id uuid references ops.tasks(id) on delete set null,
  thread_id uuid references comms.email_threads(id) on delete set null,
  owner_person_id uuid references crm.people(id) on delete set null,
  alert_type text not null
    check (alert_type in ('pipeline_risk', 'no_reply', 'payment_risk', 'deadline_risk', 'data_sync', 'content_blocker', 'other')),
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  alert_status text not null default 'open'
    check (alert_status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  title text not null,
  message text,
  dedupe_key text,
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'system_rule',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_tasks_source_record
  on ops.tasks (source_system, source_record_id)
  where source_record_id is not null;
create unique index if not exists ux_notes_source_record
  on ops.notes (source_system, source_record_id)
  where source_record_id is not null;
create unique index if not exists ux_alerts_source_record
  on ops.alerts (source_system, source_record_id)
  where source_record_id is not null;
create unique index if not exists ux_alerts_open_dedupe_key
  on ops.alerts (dedupe_key)
  where dedupe_key is not null and alert_status in ('open', 'acknowledged');
create index if not exists idx_tasks_person
  on ops.tasks (person_id, due_at);
create index if not exists idx_tasks_owner
  on ops.tasks (owner_person_id, task_status, due_at);
create index if not exists idx_notes_person
  on ops.notes (person_id, noted_at desc);
create index if not exists idx_alerts_person
  on ops.alerts (person_id, triggered_at desc);
create index if not exists idx_alerts_owner
  on ops.alerts (owner_person_id, alert_status, triggered_at desc);
create index if not exists idx_alerts_severity
  on ops.alerts (severity, alert_status, triggered_at desc);
drop trigger if exists trg_tasks_touch_common_columns on ops.tasks;
create trigger trg_tasks_touch_common_columns
before insert or update on ops.tasks
for each row execute function core.touch_common_columns();
drop trigger if exists trg_notes_touch_common_columns on ops.notes;
create trigger trg_notes_touch_common_columns
before insert or update on ops.notes
for each row execute function core.touch_common_columns();
drop trigger if exists trg_alerts_touch_common_columns on ops.alerts;
create trigger trg_alerts_touch_common_columns
before insert or update on ops.alerts
for each row execute function core.touch_common_columns();
-- ============================================================================
-- content
-- ============================================================================

create table if not exists content.video_assets (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  owner_person_id uuid references crm.people(id) on delete set null,
  title text not null,
  video_type text not null default 'testimonial'
    check (video_type in ('testimonial', 'promo', 'webinar', 'lesson', 'social', 'other')),
  asset_status text not null default 'draft'
    check (asset_status in ('draft', 'review', 'approved', 'published', 'archived')),
  video_url text,
  thumbnail_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'content_studio',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_video_assets_source_record
  on content.video_assets (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_video_assets_person
  on content.video_assets (person_id, published_at desc);
create index if not exists idx_video_assets_owner
  on content.video_assets (owner_person_id, asset_status, published_at desc);
drop trigger if exists trg_video_assets_touch_common_columns on content.video_assets;
create trigger trg_video_assets_touch_common_columns
before insert or update on content.video_assets
for each row execute function core.touch_common_columns();
-- ============================================================================
-- tracking
-- ============================================================================

create table if not exists tracking.funnel_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete cascade,
  enrollment_id uuid references crm.enrollments(id) on delete set null,
  event_name text not null,
  event_category text,
  session_id text,
  anonymous_id text,
  page_path text,
  page_url text,
  referrer_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  event_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  source_record_id text,
  source_system text not null default 'website',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_funnel_events_source_record
  on tracking.funnel_events (source_system, source_record_id)
  where source_record_id is not null;
create index if not exists idx_funnel_events_person
  on tracking.funnel_events (person_id, event_at desc);
create index if not exists idx_funnel_events_event_name
  on tracking.funnel_events (event_name, event_at desc);
drop trigger if exists trg_funnel_events_touch_common_columns on tracking.funnel_events;
create trigger trg_funnel_events_touch_common_columns
before insert or update on tracking.funnel_events
for each row execute function core.touch_common_columns();
commit;
