-- ============================================================================
-- MR-904A — MissionMed CRM + Email Automation Schema
-- Production-ready Supabase/Postgres schema for CRM operations, lifecycle
-- tracking, red-flag taxonomy, email sequences, and automation scheduling.
-- ============================================================================

begin;
create extension if not exists pgcrypto;
do $$
begin
  create type public.crm_risk_level as enum ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_student_stage as enum (
    'PRE_USMLE',
    'STUDYING_FOR_STEP',
    'PASSED_STEP',
    'APPLYING_THIS_CYCLE',
    'UNMATCHED',
    'REAPPLYING'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_service_need as enum (
    'GENERAL_GUIDANCE',
    'USMLE_TUTORING',
    'USCE_ROTATIONS',
    'MATCH_STRATEGY',
    'INTERVIEW_PREP',
    'CV_ERAS_HELP'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_owner as enum ('Michelle', 'Dr J', 'Phil', 'Brian');
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_lifecycle_stage as enum (
    'NEW_INQUIRY',
    'ENGAGED',
    'CONSIDERING',
    'HIGH_PROBABILITY',
    'ENROLLMENT_READY',
    'ENROLLED',
    'LOST',
    'DORMANT'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_pipeline_stage as enum (
    'NEW_ANALYZER_LEAD',
    'QUALIFIED_NEEDS_NURTURE',
    'WARM_CALL_PUSH',
    'STRATEGY_CALL_BOOKED',
    'STRATEGY_CALL_COMPLETED',
    'OFFER_RECOMMENDED',
    'ENROLLED',
    'LOST_DORMANT'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_lead_score_band as enum (
    'COLD',
    'LOW_INTEREST',
    'CONSIDERING',
    'ENGAGED',
    'HIGH_PROBABILITY',
    'ENROLLMENT_READY'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_confidence_level as enum (
    'INSUFFICIENT',
    'LOW',
    'MEDIUM',
    'HIGH'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_lor_quality as enum (
    'STRONG',
    'AVERAGE',
    'WEAK',
    'UNKNOWN'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_interaction_channel as enum (
    'EMAIL',
    'PHONE',
    'SMS',
    'WHATSAPP',
    'CALENDLY',
    'WEB',
    'FORM',
    'ANALYZER',
    'PAYMENT',
    'INTERNAL',
    'OTHER'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_interaction_direction as enum (
    'INBOUND',
    'OUTBOUND',
    'SYSTEM'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_interaction_type as enum (
    'FORM_SUBMISSION',
    'ANALYZER_COMPLETED',
    'EMAIL_SENT',
    'EMAIL_DELIVERED',
    'EMAIL_OPENED',
    'EMAIL_CLICKED',
    'EMAIL_REPLIED',
    'PHONE_CALL',
    'SMS_SENT',
    'WHATSAPP_MESSAGE',
    'NOTE_ADDED',
    'CALL_BOOKED',
    'CALL_COMPLETED',
    'CALL_NO_SHOW',
    'OFFER_SENT',
    'PAYMENT_LINK_SENT',
    'ENROLLMENT_CONFIRMED',
    'TAG_APPLIED',
    'TAG_REMOVED',
    'STAGE_CHANGED',
    'SCORE_UPDATED',
    'TASK_CREATED',
    'OTHER'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_automation_event_type as enum (
    'TRIGGER_RECEIVED',
    'SEQUENCE_ENROLLED',
    'STEP_SCHEDULED',
    'STEP_READY',
    'STEP_SENT',
    'STEP_SKIPPED',
    'STEP_COMPLETED',
    'STEP_FAILED',
    'SEGMENT_ENTERED',
    'SEGMENT_EXITED',
    'SCORE_CHANGED',
    'LIFECYCLE_CHANGED',
    'PIPELINE_CHANGED',
    'TAG_SYNCED',
    'WEBHOOK_RECEIVED',
    'WEBHOOK_DELIVERED',
    'WEBHOOK_FAILED',
    'RETRY_SCHEDULED',
    'SUPPRESSION_APPLIED',
    'SUPPRESSION_REMOVED'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_event_status as enum (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'SKIPPED',
    'CANCELLED'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_sequence_status as enum (
    'DRAFT',
    'ACTIVE',
    'PAUSED',
    'ARCHIVED'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_sequence_step_action as enum (
    'SEND_EMAIL',
    'SEND_SMS',
    'SEND_WHATSAPP',
    'CREATE_TASK',
    'APPLY_TAG',
    'REMOVE_TAG',
    'WAIT',
    'INTERNAL_NOTIFICATION'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_enrollment_status as enum (
    'PENDING',
    'ACTIVE',
    'PAUSED',
    'COMPLETED',
    'EXITED',
    'SUPPRESSED',
    'ERRORED'
  );
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create type public.crm_segment_type as enum (
    'SYSTEM',
    'DYNAMIC',
    'STATIC'
  );
exception
  when duplicate_object then null;
end $$;
create table if not exists public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  source_system text not null default 'missionmed.crm',
  last_synced_at timestamptz,
  owner_id uuid,
  sequence_family text not null default 'crm',
  status public.crm_sequence_status not null default 'DRAFT',
  priority_tier smallint not null default 3 check (priority_tier between 1 and 9),
  entry_source text,
  entry_rules jsonb not null default '{}'::jsonb,
  exit_rules jsonb not null default '{}'::jsonb,
  goal_lifecycle_stage public.crm_lifecycle_stage,
  goal_pipeline_stage public.crm_pipeline_stage,
  default_sender_name text,
  default_sender_email text,
  default_reply_to_email text,
  active_window jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);
comment on table public.email_sequences is 'Sequence-level metadata for nurture, pre-call, post-call, and call-push automations.';
create table if not exists public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  step_key text not null,
  step_name text not null,
  action_type public.crm_sequence_step_action not null default 'SEND_EMAIL',
  channel public.crm_interaction_channel not null default 'EMAIL',
  delay_minutes integer not null default 0 check (delay_minutes >= 0),
  send_window_start time,
  send_window_end time,
  send_timezone text not null default 'America/New_York',
  subject_template text,
  preheader text,
  body_text_template text,
  body_html_template text,
  from_name text,
  from_email text,
  reply_to_email text,
  skip_rules jsonb not null default '{}'::jsonb,
  goal_rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source_system text not null default 'missionmed.crm',
  last_synced_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sequence_steps_sequence_order_key unique (sequence_id, step_order),
  constraint sequence_steps_sequence_step_key unique (sequence_id, step_key)
);
comment on table public.sequence_steps is 'Ordered actions inside each email/CRM automation sequence.';
create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  segment_type public.crm_segment_type not null default 'DYNAMIC',
  category text not null,
  priority smallint not null default 100 check (priority between 1 and 999),
  rule_definition jsonb not null default '{}'::jsonb,
  entry_trigger_enabled boolean not null default false,
  owner_id uuid,
  source_system text not null default 'missionmed.crm',
  last_synced_at timestamptz,
  is_active boolean not null default true,
  is_seeded boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.segments is 'Dynamic and system segments used to route leads into automations and reporting cohorts.';
create table if not exists public.segment_sequences (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.segments(id) on delete cascade,
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  enrollment_priority smallint not null default 100 check (enrollment_priority between 1 and 999),
  auto_enroll boolean not null default true,
  exit_on_segment_leave boolean not null default false,
  source_system text not null default 'missionmed.crm',
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint segment_sequences_segment_sequence_key unique (segment_id, sequence_id)
);
comment on table public.segment_sequences is 'Optional M:M mapping from segments to sequences for auto-enrollment and routing priority.';
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  first_name text,
  last_name text,
  full_name text generated always as (nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')) stored,
  phone text,
  whatsapp_number text,
  source_system text not null default 'missionmed.crm',
  last_synced_at timestamptz,
  source text not null default 'unknown',
  source_detail text,
  source_url text,
  referral_source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  student_stage public.crm_student_stage,
  primary_service_need public.crm_service_need,
  secondary_service_need public.crm_service_need,
  owner_id uuid,
  owner_assigned_at timestamptz,
  owner_assignment_source text not null default 'manual',
  assigned_owner public.crm_owner not null default 'Michelle',
  handled_by text,
  lifecycle_stage public.crm_lifecycle_stage not null default 'NEW_INQUIRY',
  lifecycle_stage_manual_override boolean not null default false,
  lifecycle_stage_manual_override_at timestamptz,
  lifecycle_stage_manual_override_reason text,
  pipeline_stage public.crm_pipeline_stage,
  primary_offer_interest text,
  recommended_tier text,
  recommended_program text,
  enrolled_program text,
  payment_method text,
  cohort_code text,
  tags text[] not null default '{}'::text[],
  financially_constrained boolean not null default false,
  matchfirst_candidate boolean not null default false,
  do_not_contact boolean not null default false,
  opted_out_at timestamptz,
  step1_score smallint check (step1_score between 0 and 300),
  step2_ck_score smallint check (step2_ck_score between 0 and 300),
  failed_attempts smallint not null default 0 check (failed_attempts >= 0),
  graduation_year smallint check (graduation_year between 1900 and 2100),
  years_since_graduation smallint check (years_since_graduation >= 0),
  previous_match_cycles smallint not null default 0 check (previous_match_cycles >= 0),
  usce_months smallint not null default 0 check (usce_months >= 0),
  needs_visa boolean not null default false,
  visa_type text,
  ecfmg_status text,
  lor_quality public.crm_lor_quality,
  specialty_competitive boolean not null default false,
  target_specialty text,
  country_of_graduation text,
  research_publications smallint not null default 0 check (research_publications >= 0),
  applying_late boolean not null default false,
  red_flag_codes text[] not null default '{}'::text[],
  red_flag_taxonomy jsonb not null default '[]'::jsonb,
  red_flag_count smallint not null default 0 check (red_flag_count >= 0),
  red_flag_severity public.crm_risk_level not null default 'LOW',
  red_flag_summary text,
  red_flag_context jsonb not null default '{}'::jsonb,
  triggered_compounds text[] not null default '{}'::text[],
  analyzer_score smallint check (analyzer_score between 0 and 100),
  analyzer_flag_count smallint not null default 0 check (analyzer_flag_count >= 0),
  analyzer_risk_level public.crm_risk_level,
  analyzer_completed_at timestamptz,
  lead_score numeric(5, 2) not null default 25.00 check (lead_score between 0 and 100),
  lead_score_manual_override boolean not null default false,
  lead_score_manual_override_value numeric(5, 2) check (lead_score_manual_override_value between 0 and 100),
  lead_score_manual_override_at timestamptz,
  lead_score_manual_override_reason text,
  lead_score_band public.crm_lead_score_band not null default 'LOW_INTEREST',
  conversion_probability numeric(5, 2) not null default 25.00 check (conversion_probability between 0 and 100),
  score_confidence public.crm_confidence_level not null default 'INSUFFICIENT',
  engagement_score integer not null default 0 check (engagement_score between 0 and 200),
  score_components jsonb not null default '{}'::jsonb,
  score_last_calculated_at timestamptz,
  score_last_changed_at timestamptz,
  interaction_count integer not null default 0,
  inbound_count integer not null default 0,
  outbound_count integer not null default 0,
  email_open_count integer not null default 0,
  email_click_count integer not null default 0,
  email_reply_count integer not null default 0,
  call_count integer not null default 0,
  first_touch_at timestamptz not null default timezone('utc', now()),
  first_response_at timestamptz,
  last_response_at timestamptz,
  last_activity_at timestamptz,
  next_action_at timestamptz,
  call_booked_at timestamptz,
  call_completed_at timestamptz,
  offer_recommended_at timestamptz,
  enrolled_at timestamptz,
  lost_at timestamptz,
  dormant_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leads_red_flag_taxonomy_is_array check (jsonb_typeof(red_flag_taxonomy) = 'array'),
  constraint leads_manual_score_requires_value check (
    lead_score_manual_override = false
    or lead_score_manual_override_value is not null
  )
);
comment on table public.leads is 'Primary CRM record for every MissionMed lead, enriched with red-flag taxonomy, lifecycle state, and scoring.';
create table if not exists public.lead_sequence_enrollment (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sequence_id uuid not null references public.email_sequences(id) on delete restrict,
  source_segment_id uuid references public.segments(id) on delete set null,
  owner_id uuid,
  current_step_id uuid references public.sequence_steps(id) on delete set null,
  current_step_order integer,
  status public.crm_enrollment_status not null default 'ACTIVE',
  manual_status_override boolean not null default false,
  manual_status_override_at timestamptz,
  manual_status_override_reason text,
  manual_current_step_override boolean not null default false,
  manual_current_step_override_at timestamptz,
  manual_current_step_override_reason text,
  entry_source text,
  enrollment_reason text,
  source_system text not null default 'missionmed.crm',
  last_synced_at timestamptz,
  started_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  completed_at timestamptz,
  exited_at timestamptz,
  suppressed_at timestamptz,
  next_step_due_at timestamptz,
  manual_next_step_due_at timestamptz,
  manual_next_step_override_at timestamptz,
  manual_next_step_override_reason text,
  last_step_processed_at timestamptz,
  last_event_at timestamptz,
  exit_reason text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.lead_sequence_enrollment is 'Join table tracking a lead''s state inside a given automation sequence.';
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sequence_id uuid references public.email_sequences(id) on delete set null,
  sequence_step_id uuid references public.sequence_steps(id) on delete set null,
  sequence_enrollment_id uuid references public.lead_sequence_enrollment(id) on delete set null,
  owner_id uuid,
  channel public.crm_interaction_channel not null,
  direction public.crm_interaction_direction not null,
  interaction_type public.crm_interaction_type not null,
  status public.crm_event_status not null default 'COMPLETED',
  is_human_touch boolean not null default false,
  handled_by text,
  subject text,
  content_summary text,
  source_system text not null default 'missionmed.crm',
  last_synced_at timestamptz,
  external_event_id text,
  external_message_id text,
  correlation_id text,
  requires_follow_up boolean not null default false,
  follow_up_due_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.interactions is 'Immutable interaction log for emails, calls, notes, analyzer submissions, and enrollment touches.';
create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  source_interaction_id uuid references public.interactions(id) on delete set null,
  source_segment_id uuid references public.segments(id) on delete set null,
  sequence_id uuid references public.email_sequences(id) on delete set null,
  sequence_step_id uuid references public.sequence_steps(id) on delete set null,
  sequence_enrollment_id uuid references public.lead_sequence_enrollment(id) on delete set null,
  event_type public.crm_automation_event_type not null,
  status public.crm_event_status not null default 'PENDING',
  priority smallint not null default 100 check (priority between 1 and 999),
  source_system text not null default 'missionmed.crm',
  last_synced_at timestamptz,
  trigger_source text not null default 'system',
  idempotency_key text,
  scheduled_for timestamptz not null default timezone('utc', now()),
  occurred_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.automation_events is 'Automation queue and event ledger for triggers, retries, state changes, and scheduled sequence steps.';
create unique index if not exists idx_leads_email_normalized on public.leads (email_normalized);
create index if not exists idx_leads_created_at on public.leads (created_at desc);
create index if not exists idx_leads_lifecycle_stage on public.leads (lifecycle_stage);
create index if not exists idx_leads_pipeline_stage on public.leads (pipeline_stage);
create index if not exists idx_leads_owner_id on public.leads (owner_id);
create index if not exists idx_leads_assigned_owner on public.leads (assigned_owner);
create index if not exists idx_leads_source on public.leads (source);
create index if not exists idx_leads_lead_score on public.leads (lead_score desc);
create index if not exists idx_leads_analyzer_risk on public.leads (analyzer_risk_level);
create index if not exists idx_leads_red_flag_severity on public.leads (red_flag_severity);
create index if not exists idx_leads_last_activity on public.leads (last_activity_at desc nulls last);
create index if not exists idx_leads_next_action on public.leads (next_action_at nulls last);
create index if not exists idx_leads_call_booked on public.leads (call_booked_at desc nulls last);
create index if not exists idx_leads_enrolled on public.leads (enrolled_at desc nulls last);
create index if not exists idx_leads_tags_gin on public.leads using gin (tags);
create index if not exists idx_leads_red_flag_codes_gin on public.leads using gin (red_flag_codes);
create index if not exists idx_leads_red_flag_taxonomy_gin on public.leads using gin (red_flag_taxonomy);
create index if not exists idx_leads_metadata_gin on public.leads using gin (metadata);
create index if not exists idx_leads_worklist on public.leads (owner_id, lifecycle_stage, lead_score desc, next_action_at)
  where do_not_contact = false and lifecycle_stage <> 'ENROLLED';
create index if not exists idx_email_sequences_created_at on public.email_sequences (created_at desc);
create index if not exists idx_email_sequences_owner_id on public.email_sequences (owner_id);
create index if not exists idx_email_sequences_status on public.email_sequences (status, is_active, priority_tier);
create index if not exists idx_sequence_steps_created_at on public.sequence_steps (created_at desc);
create index if not exists idx_sequence_steps_sequence_order on public.sequence_steps (sequence_id, step_order);
create index if not exists idx_sequence_steps_active on public.sequence_steps (sequence_id, is_active, step_order);
create index if not exists idx_segments_created_at on public.segments (created_at desc);
create index if not exists idx_segments_owner_id on public.segments (owner_id);
create index if not exists idx_segments_category_active on public.segments (category, is_active, priority);
create index if not exists idx_segments_rules_gin on public.segments using gin (rule_definition);
create index if not exists idx_segment_sequences_created_at on public.segment_sequences (created_at desc);
create index if not exists idx_segment_sequences_segment on public.segment_sequences (segment_id, auto_enroll, enrollment_priority);
create index if not exists idx_segment_sequences_sequence on public.segment_sequences (sequence_id, auto_enroll, enrollment_priority);
create index if not exists idx_enrollment_created_at on public.lead_sequence_enrollment (created_at desc);
create index if not exists idx_enrollment_lead_status on public.lead_sequence_enrollment (lead_id, status);
create index if not exists idx_enrollment_owner_id on public.lead_sequence_enrollment (owner_id);
create index if not exists idx_enrollment_sequence_status on public.lead_sequence_enrollment (sequence_id, status);
create index if not exists idx_enrollment_due_queue on public.lead_sequence_enrollment (next_step_due_at)
  where status in ('PENDING', 'ACTIVE');
create unique index if not exists idx_enrollment_single_active on public.lead_sequence_enrollment (lead_id, sequence_id)
  where status in ('PENDING', 'ACTIVE', 'PAUSED');
create index if not exists idx_interactions_created_at on public.interactions (created_at desc);
create index if not exists idx_interactions_lead_occurred on public.interactions (lead_id, occurred_at desc);
create index if not exists idx_interactions_type on public.interactions (interaction_type, occurred_at desc);
create index if not exists idx_interactions_channel on public.interactions (channel, occurred_at desc);
create index if not exists idx_interactions_owner_id on public.interactions (owner_id);
create index if not exists idx_interactions_follow_up on public.interactions (follow_up_due_at)
  where requires_follow_up = true;
create index if not exists idx_interactions_enrollment on public.interactions (sequence_enrollment_id, occurred_at desc);
create unique index if not exists idx_interactions_external_event on public.interactions (channel, external_event_id)
  where external_event_id is not null;
create index if not exists idx_automation_events_created_at on public.automation_events (created_at desc);
create index if not exists idx_automation_events_lead on public.automation_events (lead_id, occurred_at desc);
create index if not exists idx_automation_events_status_schedule on public.automation_events (status, scheduled_for, priority);
create index if not exists idx_automation_events_pending_queue on public.automation_events (scheduled_for, priority)
  where status in ('PENDING', 'PROCESSING');
create index if not exists idx_automation_events_enrollment on public.automation_events (sequence_enrollment_id, scheduled_for);
create unique index if not exists idx_automation_events_idempotency on public.automation_events (idempotency_key)
  where idempotency_key is not null;
create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;
create or replace function public.crm_compute_score_band(p_score numeric)
returns public.crm_lead_score_band
language plpgsql
immutable
as $$
begin
  if coalesce(p_score, 0) >= 85 then
    return 'ENROLLMENT_READY';
  elsif coalesce(p_score, 0) >= 70 then
    return 'HIGH_PROBABILITY';
  elsif coalesce(p_score, 0) >= 50 then
    return 'ENGAGED';
  elsif coalesce(p_score, 0) >= 30 then
    return 'CONSIDERING';
  elsif coalesce(p_score, 0) >= 15 then
    return 'LOW_INTEREST';
  end if;

  return 'COLD';
end;
$$;
create or replace function public.crm_compute_red_flag_severity(
  p_flag_count integer,
  p_analyzer_score integer default null,
  p_analyzer_risk_level public.crm_risk_level default null
)
returns public.crm_risk_level
language plpgsql
immutable
as $$
begin
  if p_analyzer_risk_level is not null then
    return p_analyzer_risk_level;
  elsif coalesce(p_analyzer_score, 0) >= 70 or coalesce(p_flag_count, 0) >= 3 then
    return 'CRITICAL';
  elsif coalesce(p_analyzer_score, 0) >= 45 or coalesce(p_flag_count, 0) = 2 then
    return 'HIGH';
  elsif coalesce(p_analyzer_score, 0) >= 25 or coalesce(p_flag_count, 0) = 1 then
    return 'MODERATE';
  end if;

  return 'LOW';
end;
$$;
create or replace function public.crm_prepare_lead_defaults()
returns trigger
language plpgsql
as $$
declare
  v_flag_count integer;
begin
  new.email := lower(btrim(new.email));
  new.source_system := coalesce(nullif(btrim(new.source_system), ''), 'missionmed.crm');
  new.owner_assignment_source := coalesce(nullif(btrim(new.owner_assignment_source), ''), 'manual');
  new.tags := coalesce(new.tags, '{}'::text[]);
  new.red_flag_codes := coalesce(new.red_flag_codes, '{}'::text[]);
  new.red_flag_taxonomy := coalesce(new.red_flag_taxonomy, '[]'::jsonb);
  new.triggered_compounds := coalesce(new.triggered_compounds, '{}'::text[]);
  new.red_flag_context := coalesce(new.red_flag_context, '{}'::jsonb);
  new.score_components := coalesce(new.score_components, '{}'::jsonb);
  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  if jsonb_typeof(new.red_flag_taxonomy) <> 'array' then
    raise exception 'red_flag_taxonomy must be a JSON array';
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id is not null and new.owner_assigned_at is null then
      new.owner_assigned_at := timezone('utc', now());
    end if;

    if new.lifecycle_stage_manual_override = true then
      new.lifecycle_stage_manual_override_at := coalesce(
        new.lifecycle_stage_manual_override_at,
        timezone('utc', now())
      );
    end if;

    if new.lead_score_manual_override = true then
      if new.lead_score_manual_override_value is null then
        raise exception 'lead_score_manual_override_value is required when lead_score_manual_override is true';
      end if;

      new.lead_score := new.lead_score_manual_override_value;
      new.lead_score_manual_override_at := coalesce(
        new.lead_score_manual_override_at,
        timezone('utc', now())
      );
    end if;

    new.score_last_changed_at := coalesce(new.score_last_changed_at, timezone('utc', now()));
  else
    if new.owner_id is distinct from old.owner_id and new.owner_id is not null and new.owner_assigned_at is null then
      new.owner_assigned_at := timezone('utc', now());
    end if;

    if new.lifecycle_stage_manual_override = true
       and (
         new.lifecycle_stage_manual_override is distinct from old.lifecycle_stage_manual_override
         or new.lifecycle_stage is distinct from old.lifecycle_stage
         or new.lifecycle_stage_manual_override_reason is distinct from old.lifecycle_stage_manual_override_reason
       ) then
      new.lifecycle_stage_manual_override_at := timezone('utc', now());
    end if;

    if new.lead_score_manual_override = true then
      if new.lead_score_manual_override_value is null then
        raise exception 'lead_score_manual_override_value is required when lead_score_manual_override is true';
      end if;

      new.lead_score := new.lead_score_manual_override_value;

      if new.lead_score_manual_override is distinct from old.lead_score_manual_override
         or new.lead_score_manual_override_value is distinct from old.lead_score_manual_override_value
         or new.lead_score_manual_override_reason is distinct from old.lead_score_manual_override_reason then
        new.lead_score_manual_override_at := timezone('utc', now());
      end if;
    end if;
  end if;

  new.lead_score := coalesce(new.lead_score, 25.00);

  v_flag_count := greatest(
    coalesce(cardinality(new.red_flag_codes), 0),
    coalesce(jsonb_array_length(new.red_flag_taxonomy), 0)
  );
  new.red_flag_count := greatest(coalesce(new.red_flag_count, 0), v_flag_count);

  if new.analyzer_flag_count is null or new.analyzer_flag_count = 0 then
    new.analyzer_flag_count := new.red_flag_count;
  end if;

  new.red_flag_severity := public.crm_compute_red_flag_severity(
    new.red_flag_count,
    new.analyzer_score,
    new.analyzer_risk_level
  );

  if new.analyzer_risk_level is null and (new.analyzer_score is not null or new.red_flag_count > 0) then
    new.analyzer_risk_level := new.red_flag_severity;
  end if;

  new.lead_score_band := public.crm_compute_score_band(coalesce(new.lead_score, 0));

  if new.conversion_probability is null then
    new.conversion_probability := coalesce(new.lead_score, 0);
  end if;

  if new.first_touch_at is null then
    new.first_touch_at := timezone('utc', now());
  end if;

  if new.last_activity_at is null then
    new.last_activity_at := new.first_touch_at;
  end if;

  if tg_op = 'UPDATE'
     and (
       new.lead_score is distinct from old.lead_score
     or new.analyzer_score is distinct from old.analyzer_score
     or new.engagement_score is distinct from old.engagement_score
     or new.conversion_probability is distinct from old.conversion_probability
     or new.lead_score_manual_override is distinct from old.lead_score_manual_override
     or new.lead_score_manual_override_value is distinct from old.lead_score_manual_override_value
     ) then
    new.score_last_changed_at := timezone('utc', now());
  end if;

  if new.matchfirst_candidate = false and (new.red_flag_severity = 'CRITICAL' or new.financially_constrained = true) then
    new.matchfirst_candidate := true;
  end if;

  if new.enrolled_at is not null then
    new.lifecycle_stage := 'ENROLLED';
    new.pipeline_stage := 'ENROLLED';
  elsif new.lifecycle_stage_manual_override = false and new.lost_at is not null then
    new.lifecycle_stage := 'LOST';
    if new.pipeline_stage is null then
      new.pipeline_stage := 'LOST_DORMANT';
    end if;
  elsif new.lifecycle_stage_manual_override = false and new.dormant_at is not null and new.lifecycle_stage <> 'ENROLLED' then
    new.lifecycle_stage := 'DORMANT';
    if new.pipeline_stage is null then
      new.pipeline_stage := 'LOST_DORMANT';
    end if;
  elsif new.offer_recommended_at is not null and new.pipeline_stage is null then
    new.pipeline_stage := 'OFFER_RECOMMENDED';
  elsif new.call_completed_at is not null and new.pipeline_stage is null then
    new.pipeline_stage := 'STRATEGY_CALL_COMPLETED';
  elsif new.call_booked_at is not null and new.pipeline_stage is null then
    new.pipeline_stage := 'STRATEGY_CALL_BOOKED';
  end if;

  return new;
end;
$$;
create or replace function public.crm_prepare_enrollment()
returns trigger
language plpgsql
as $$
declare
  v_lead_owner_id uuid;
  v_step_id uuid;
  v_step_order integer;
  v_delay_minutes integer;
  v_step_sequence_id uuid;
begin
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.source_system := coalesce(nullif(btrim(new.source_system), ''), 'missionmed.crm');

  if new.started_at is null then
    new.started_at := timezone('utc', now());
  end if;

  if new.owner_id is null then
    select l.owner_id
    into v_lead_owner_id
    from public.leads l
    where l.id = new.lead_id;

    new.owner_id := v_lead_owner_id;
  end if;

  if tg_op = 'INSERT' then
    if new.manual_status_override = true then
      new.manual_status_override_at := coalesce(new.manual_status_override_at, timezone('utc', now()));
    end if;

    if new.manual_current_step_override = true and new.current_step_id is not null then
      new.manual_current_step_override_at := coalesce(
        new.manual_current_step_override_at,
        timezone('utc', now())
      );
    end if;

    if new.manual_next_step_due_at is not null then
      new.manual_next_step_override_at := coalesce(
        new.manual_next_step_override_at,
        timezone('utc', now())
      );
    end if;
  else
    if new.manual_status_override = true
       and (
         new.manual_status_override is distinct from old.manual_status_override
         or new.status is distinct from old.status
         or new.manual_status_override_reason is distinct from old.manual_status_override_reason
       ) then
      new.manual_status_override_at := timezone('utc', now());
    end if;

    if new.manual_current_step_override = true
       and new.current_step_id is not null
       and (
         new.manual_current_step_override is distinct from old.manual_current_step_override
         or new.current_step_id is distinct from old.current_step_id
         or new.manual_current_step_override_reason is distinct from old.manual_current_step_override_reason
       ) then
      new.manual_current_step_override_at := timezone('utc', now());
    end if;

    if new.manual_next_step_due_at is not null
       and (
         new.manual_next_step_due_at is distinct from old.manual_next_step_due_at
         or new.manual_next_step_override_reason is distinct from old.manual_next_step_override_reason
       ) then
      new.manual_next_step_override_at := timezone('utc', now());
    end if;
  end if;

  if new.current_step_id is null and new.status in ('PENDING', 'ACTIVE') then
    select ss.id, ss.step_order, ss.delay_minutes
    into v_step_id, v_step_order, v_delay_minutes
    from public.sequence_steps ss
    where ss.sequence_id = new.sequence_id
      and ss.is_active = true
    order by ss.step_order asc
    limit 1;

    if v_step_id is not null then
      new.current_step_id := v_step_id;
      new.current_step_order := v_step_order;

      if new.next_step_due_at is null and new.manual_next_step_due_at is null then
        new.next_step_due_at := new.started_at + make_interval(mins => coalesce(v_delay_minutes, 0));
      end if;
    end if;
  elsif new.current_step_id is not null then
    select ss.sequence_id, ss.step_order, ss.delay_minutes
    into v_step_sequence_id, v_step_order, v_delay_minutes
    from public.sequence_steps ss
    where ss.id = new.current_step_id;

    if v_step_sequence_id is not null and v_step_sequence_id <> new.sequence_id then
      raise exception 'Sequence step % does not belong to sequence %', new.current_step_id, new.sequence_id;
    end if;

    if v_step_order is not null then
      new.current_step_order := v_step_order;

      if new.next_step_due_at is null and new.manual_next_step_due_at is null and new.status in ('PENDING', 'ACTIVE') then
        new.next_step_due_at := new.started_at + make_interval(mins => coalesce(v_delay_minutes, 0));
      end if;
    end if;
  end if;

  if new.manual_next_step_due_at is not null then
    new.next_step_due_at := new.manual_next_step_due_at;
  end if;

  if new.status = 'ACTIVE' and new.activated_at is null then
    new.activated_at := timezone('utc', now());
  end if;

  if new.status = 'COMPLETED' and new.completed_at is null then
    new.completed_at := timezone('utc', now());
  end if;

  if new.status = 'SUPPRESSED' and new.suppressed_at is null then
    new.suppressed_at := timezone('utc', now());
  end if;

  if new.status in ('EXITED', 'ERRORED') and new.exited_at is null then
    new.exited_at := timezone('utc', now());
  end if;

  if new.status in ('COMPLETED', 'EXITED', 'SUPPRESSED', 'ERRORED') then
    new.next_step_due_at := null;
  end if;

  return new;
end;
$$;
create or replace function public.crm_rollup_lead_activity()
returns trigger
language plpgsql
as $$
begin
  update public.leads
  set last_activity_at = greatest(coalesce(last_activity_at, new.occurred_at), new.occurred_at),
      interaction_count = interaction_count + 1,
      inbound_count = inbound_count + case when new.direction = 'INBOUND' then 1 else 0 end,
      outbound_count = outbound_count + case when new.direction = 'OUTBOUND' then 1 else 0 end,
      email_open_count = email_open_count + case when new.interaction_type = 'EMAIL_OPENED' then 1 else 0 end,
      email_click_count = email_click_count + case when new.interaction_type = 'EMAIL_CLICKED' then 1 else 0 end,
      email_reply_count = email_reply_count + case when new.interaction_type = 'EMAIL_REPLIED' then 1 else 0 end,
      call_count = call_count + case when new.interaction_type in ('PHONE_CALL', 'CALL_BOOKED', 'CALL_COMPLETED', 'CALL_NO_SHOW') then 1 else 0 end,
      first_touch_at = coalesce(first_touch_at, new.occurred_at),
      first_response_at = case when new.direction = 'INBOUND' then coalesce(first_response_at, new.occurred_at) else first_response_at end,
      last_response_at = case when new.direction = 'INBOUND' then new.occurred_at else last_response_at end,
      analyzer_completed_at = case when new.interaction_type = 'ANALYZER_COMPLETED' then coalesce(analyzer_completed_at, new.occurred_at) else analyzer_completed_at end,
      call_booked_at = case when new.interaction_type = 'CALL_BOOKED' then coalesce(call_booked_at, new.occurred_at) else call_booked_at end,
      call_completed_at = case when new.interaction_type = 'CALL_COMPLETED' then coalesce(call_completed_at, new.occurred_at) else call_completed_at end,
      offer_recommended_at = case when new.interaction_type = 'OFFER_SENT' then coalesce(offer_recommended_at, new.occurred_at) else offer_recommended_at end,
      enrolled_at = case when new.interaction_type = 'ENROLLMENT_CONFIRMED' then coalesce(enrolled_at, new.occurred_at) else enrolled_at end,
      lifecycle_stage = case
        when new.interaction_type = 'ENROLLMENT_CONFIRMED' then 'ENROLLED'
        when lifecycle_stage_manual_override = true then lifecycle_stage
        when new.interaction_type = 'CALL_COMPLETED' then 'ENROLLMENT_READY'
        when new.interaction_type = 'CALL_BOOKED' then 'HIGH_PROBABILITY'
        when new.interaction_type = 'EMAIL_REPLIED' and lifecycle_stage = 'NEW_INQUIRY' then 'ENGAGED'
        else lifecycle_stage
      end,
      pipeline_stage = case
        when new.interaction_type = 'ENROLLMENT_CONFIRMED' then 'ENROLLED'
        when new.interaction_type = 'OFFER_SENT' then 'OFFER_RECOMMENDED'
        when new.interaction_type = 'CALL_COMPLETED' then 'STRATEGY_CALL_COMPLETED'
        when new.interaction_type = 'CALL_BOOKED' then 'STRATEGY_CALL_BOOKED'
        when new.interaction_type = 'EMAIL_REPLIED' and pipeline_stage is null then 'WARM_CALL_PUSH'
        else pipeline_stage
      end
  where id = new.lead_id;

  return new;
end;
$$;
create or replace function public.crm_log_lead_state_changes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.automation_events (
      lead_id,
      event_type,
      status,
      priority,
      trigger_source,
      scheduled_for,
      occurred_at,
      context
    )
    values (
      new.id,
      'TRIGGER_RECEIVED',
      'COMPLETED',
      100,
      coalesce(new.source, 'system'),
      coalesce(new.analyzer_completed_at, new.created_at, timezone('utc', now())),
      coalesce(new.analyzer_completed_at, new.created_at, timezone('utc', now())),
      jsonb_build_object(
        'source', new.source,
        'lifecycle_stage', new.lifecycle_stage,
        'pipeline_stage', new.pipeline_stage,
        'lead_score', new.lead_score,
        'red_flag_severity', new.red_flag_severity
      )
    );

    return new;
  end if;

  if new.lifecycle_stage is distinct from old.lifecycle_stage then
    insert into public.automation_events (
      lead_id,
      event_type,
      status,
      priority,
      trigger_source,
      scheduled_for,
      occurred_at,
      context
    )
    values (
      new.id,
      'LIFECYCLE_CHANGED',
      'COMPLETED',
      60,
      'lead_trigger',
      timezone('utc', now()),
      timezone('utc', now()),
      jsonb_build_object('from', old.lifecycle_stage, 'to', new.lifecycle_stage)
    );
  end if;

  if new.pipeline_stage is distinct from old.pipeline_stage then
    insert into public.automation_events (
      lead_id,
      event_type,
      status,
      priority,
      trigger_source,
      scheduled_for,
      occurred_at,
      context
    )
    values (
      new.id,
      'PIPELINE_CHANGED',
      'COMPLETED',
      50,
      'lead_trigger',
      timezone('utc', now()),
      timezone('utc', now()),
      jsonb_build_object('from', old.pipeline_stage, 'to', new.pipeline_stage)
    );
  end if;

  if new.lead_score is distinct from old.lead_score
     or new.analyzer_score is distinct from old.analyzer_score
     or new.engagement_score is distinct from old.engagement_score
     or new.conversion_probability is distinct from old.conversion_probability then
    insert into public.automation_events (
      lead_id,
      event_type,
      status,
      priority,
      trigger_source,
      scheduled_for,
      occurred_at,
      context
    )
    values (
      new.id,
      'SCORE_CHANGED',
      'COMPLETED',
      70,
      'lead_trigger',
      timezone('utc', now()),
      timezone('utc', now()),
      jsonb_build_object(
        'lead_score_from', old.lead_score,
        'lead_score_to', new.lead_score,
        'analyzer_score_from', old.analyzer_score,
        'analyzer_score_to', new.analyzer_score,
        'engagement_score_from', old.engagement_score,
        'engagement_score_to', new.engagement_score,
        'conversion_probability_from', old.conversion_probability,
        'conversion_probability_to', new.conversion_probability
      )
    );
  end if;

  return new;
end;
$$;
create or replace function public.crm_enqueue_enrollment_events()
returns trigger
language plpgsql
as $$
declare
  v_sequence_slug text;
  v_step_key text;
  v_idempotency_key text;
begin
  select es.slug into v_sequence_slug
  from public.email_sequences es
  where es.id = new.sequence_id;

  if tg_op = 'INSERT' then
    insert into public.automation_events (
      lead_id,
      source_segment_id,
      sequence_id,
      sequence_step_id,
      sequence_enrollment_id,
      event_type,
      status,
      priority,
      trigger_source,
      scheduled_for,
      occurred_at,
      context
    )
    values (
      new.lead_id,
      new.source_segment_id,
      new.sequence_id,
      new.current_step_id,
      new.id,
      'SEQUENCE_ENROLLED',
      'COMPLETED',
      45,
      coalesce(new.entry_source, 'system'),
      new.started_at,
      new.started_at,
      jsonb_build_object(
        'sequence_slug', v_sequence_slug,
        'entry_source', new.entry_source,
        'enrollment_reason', new.enrollment_reason
      )
    );
  end if;

  if new.status in ('PENDING', 'ACTIVE')
     and new.current_step_id is not null
     and new.next_step_due_at is not null
     and tg_op = 'INSERT' then
    select ss.step_key into v_step_key
    from public.sequence_steps ss
    where ss.id = new.current_step_id;

    v_idempotency_key := concat_ws(
      ':',
      'step_scheduled',
      new.id::text,
      coalesce(new.current_step_id::text, 'none'),
      to_char(new.next_step_due_at at time zone 'utc', 'YYYYMMDDHH24MISS')
    );

    insert into public.automation_events (
      lead_id,
      source_segment_id,
      sequence_id,
      sequence_step_id,
      sequence_enrollment_id,
      event_type,
      status,
      priority,
      trigger_source,
      idempotency_key,
      scheduled_for,
      occurred_at,
      context
    )
    values (
      new.lead_id,
      new.source_segment_id,
      new.sequence_id,
      new.current_step_id,
      new.id,
      'STEP_SCHEDULED',
      'PENDING',
      40,
      coalesce(new.entry_source, 'sequence_trigger'),
      v_idempotency_key,
      new.next_step_due_at,
      timezone('utc', now()),
      jsonb_build_object(
        'sequence_slug', v_sequence_slug,
        'step_key', v_step_key,
        'step_order', new.current_step_order,
        'enrollment_status', new.status
      )
    )
    on conflict do nothing;
  end if;

  if new.status in ('PENDING', 'ACTIVE')
     and new.current_step_id is not null
     and new.next_step_due_at is not null
     and tg_op = 'UPDATE'
     and (
       new.current_step_id is distinct from old.current_step_id
       or new.next_step_due_at is distinct from old.next_step_due_at
       or new.status is distinct from old.status
     ) then
    select ss.step_key into v_step_key
    from public.sequence_steps ss
    where ss.id = new.current_step_id;

    v_idempotency_key := concat_ws(
      ':',
      'step_scheduled',
      new.id::text,
      coalesce(new.current_step_id::text, 'none'),
      to_char(new.next_step_due_at at time zone 'utc', 'YYYYMMDDHH24MISS')
    );

    insert into public.automation_events (
      lead_id,
      source_segment_id,
      sequence_id,
      sequence_step_id,
      sequence_enrollment_id,
      event_type,
      status,
      priority,
      trigger_source,
      idempotency_key,
      scheduled_for,
      occurred_at,
      context
    )
    values (
      new.lead_id,
      new.source_segment_id,
      new.sequence_id,
      new.current_step_id,
      new.id,
      'STEP_SCHEDULED',
      'PENDING',
      40,
      coalesce(new.entry_source, 'sequence_trigger'),
      v_idempotency_key,
      new.next_step_due_at,
      timezone('utc', now()),
      jsonb_build_object(
        'sequence_slug', v_sequence_slug,
        'step_key', v_step_key,
        'step_order', new.current_step_order,
        'enrollment_status', new.status
      )
    )
    on conflict do nothing;
  end if;

  if tg_op = 'UPDATE' and new.status = 'SUPPRESSED' and new.status is distinct from old.status then
    insert into public.automation_events (
      lead_id,
      source_segment_id,
      sequence_id,
      sequence_step_id,
      sequence_enrollment_id,
      event_type,
      status,
      priority,
      trigger_source,
      scheduled_for,
      occurred_at,
      context
    )
    values (
      new.lead_id,
      new.source_segment_id,
      new.sequence_id,
      new.current_step_id,
      new.id,
      'SUPPRESSION_APPLIED',
      'COMPLETED',
      20,
      'sequence_enrollment',
      timezone('utc', now()),
      timezone('utc', now()),
      jsonb_build_object('exit_reason', new.exit_reason)
    );
  end if;

  return new;
end;
$$;
create or replace function public.crm_enroll_lead_in_sequence(
  p_lead_id uuid,
  p_sequence_slug text,
  p_entry_source text default 'system',
  p_source_segment_slug text default null,
  p_enrollment_reason text default null
)
returns uuid
language plpgsql
as $$
declare
  v_sequence_id uuid;
  v_segment_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
  v_owner_id uuid;
begin
  select es.id
  into v_sequence_id
  from public.email_sequences es
  where es.slug = p_sequence_slug
    and es.is_active = true
    and es.status = 'ACTIVE'
  limit 1;

  if v_sequence_id is null then
    raise exception 'Sequence "%" not found or not active', p_sequence_slug;
  end if;

  if p_source_segment_slug is not null then
    select s.id
    into v_segment_id
    from public.segments s
    where s.slug = p_source_segment_slug
      and s.is_active = true
    limit 1;
  end if;

  select l.owner_id
  into v_owner_id
  from public.leads l
  where l.id = p_lead_id;

  select lse.id
  into v_existing_id
  from public.lead_sequence_enrollment lse
  where lse.lead_id = p_lead_id
    and lse.sequence_id = v_sequence_id
    and lse.status in ('PENDING', 'ACTIVE', 'PAUSED')
  order by lse.created_at desc
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into public.lead_sequence_enrollment (
    lead_id,
    sequence_id,
    source_segment_id,
    owner_id,
    status,
    entry_source,
    enrollment_reason
  )
  values (
    p_lead_id,
    v_sequence_id,
    v_segment_id,
    v_owner_id,
    'ACTIVE',
    coalesce(p_entry_source, 'system'),
    p_enrollment_reason
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;
drop trigger if exists trg_email_sequences_set_updated_at on public.email_sequences;
create trigger trg_email_sequences_set_updated_at
before update on public.email_sequences
for each row
execute function public.crm_set_updated_at();
drop trigger if exists trg_sequence_steps_set_updated_at on public.sequence_steps;
create trigger trg_sequence_steps_set_updated_at
before update on public.sequence_steps
for each row
execute function public.crm_set_updated_at();
drop trigger if exists trg_segments_set_updated_at on public.segments;
create trigger trg_segments_set_updated_at
before update on public.segments
for each row
execute function public.crm_set_updated_at();
drop trigger if exists trg_segment_sequences_set_updated_at on public.segment_sequences;
create trigger trg_segment_sequences_set_updated_at
before update on public.segment_sequences
for each row
execute function public.crm_set_updated_at();
drop trigger if exists trg_leads_prepare_defaults on public.leads;
create trigger trg_leads_prepare_defaults
before insert or update on public.leads
for each row
execute function public.crm_prepare_lead_defaults();
drop trigger if exists trg_leads_set_updated_at on public.leads;
create trigger trg_leads_set_updated_at
before update on public.leads
for each row
execute function public.crm_set_updated_at();
drop trigger if exists trg_leads_log_state_changes on public.leads;
create trigger trg_leads_log_state_changes
after insert or update on public.leads
for each row
execute function public.crm_log_lead_state_changes();
drop trigger if exists trg_lead_sequence_enrollment_prepare on public.lead_sequence_enrollment;
create trigger trg_lead_sequence_enrollment_prepare
before insert or update on public.lead_sequence_enrollment
for each row
execute function public.crm_prepare_enrollment();
drop trigger if exists trg_lead_sequence_enrollment_set_updated_at on public.lead_sequence_enrollment;
create trigger trg_lead_sequence_enrollment_set_updated_at
before update on public.lead_sequence_enrollment
for each row
execute function public.crm_set_updated_at();
drop trigger if exists trg_lead_sequence_enrollment_queue_events on public.lead_sequence_enrollment;
create trigger trg_lead_sequence_enrollment_queue_events
after insert or update on public.lead_sequence_enrollment
for each row
execute function public.crm_enqueue_enrollment_events();
drop trigger if exists trg_interactions_set_updated_at on public.interactions;
create trigger trg_interactions_set_updated_at
before update on public.interactions
for each row
execute function public.crm_set_updated_at();
drop trigger if exists trg_interactions_rollup on public.interactions;
create trigger trg_interactions_rollup
after insert on public.interactions
for each row
execute function public.crm_rollup_lead_activity();
drop trigger if exists trg_automation_events_set_updated_at on public.automation_events;
create trigger trg_automation_events_set_updated_at
before update on public.automation_events
for each row
execute function public.crm_set_updated_at();
create or replace view public.crm_pending_automation_queue as
select
  ae.id,
  ae.lead_id,
  l.email,
  l.full_name,
  ae.event_type,
  ae.priority,
  ae.trigger_source,
  ae.scheduled_for,
  ae.sequence_id,
  es.slug as sequence_slug,
  ae.sequence_step_id,
  ss.step_order,
  ss.step_key,
  ae.sequence_enrollment_id,
  ae.context
from public.automation_events ae
join public.leads l on l.id = ae.lead_id
left join public.email_sequences es on es.id = ae.sequence_id
left join public.sequence_steps ss on ss.id = ae.sequence_step_id
where ae.status = 'PENDING'
  and ae.scheduled_for <= timezone('utc', now())
order by ae.priority asc, ae.scheduled_for asc, ae.created_at asc;
alter table public.email_sequences enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.segments enable row level security;
alter table public.segment_sequences enable row level security;
alter table public.leads enable row level security;
alter table public.lead_sequence_enrollment enable row level security;
alter table public.interactions enable row level security;
alter table public.automation_events enable row level security;
drop policy if exists "service_role_all_email_sequences" on public.email_sequences;
create policy "service_role_all_email_sequences"
on public.email_sequences
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
drop policy if exists "service_role_all_sequence_steps" on public.sequence_steps;
create policy "service_role_all_sequence_steps"
on public.sequence_steps
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
drop policy if exists "service_role_all_segments" on public.segments;
create policy "service_role_all_segments"
on public.segments
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
drop policy if exists "service_role_all_segment_sequences" on public.segment_sequences;
create policy "service_role_all_segment_sequences"
on public.segment_sequences
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
drop policy if exists "service_role_all_leads" on public.leads;
create policy "service_role_all_leads"
on public.leads
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
drop policy if exists "service_role_all_lead_sequence_enrollment" on public.lead_sequence_enrollment;
create policy "service_role_all_lead_sequence_enrollment"
on public.lead_sequence_enrollment
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
drop policy if exists "service_role_all_interactions" on public.interactions;
create policy "service_role_all_interactions"
on public.interactions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
drop policy if exists "service_role_all_automation_events" on public.automation_events;
create policy "service_role_all_automation_events"
on public.automation_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
drop policy if exists "authenticated_read_reference_sequences" on public.email_sequences;
create policy "authenticated_read_reference_sequences"
on public.email_sequences
for select
using (auth.role() = 'authenticated');
drop policy if exists "authenticated_read_reference_steps" on public.sequence_steps;
create policy "authenticated_read_reference_steps"
on public.sequence_steps
for select
using (auth.role() = 'authenticated');
drop policy if exists "authenticated_read_reference_segments" on public.segments;
create policy "authenticated_read_reference_segments"
on public.segments
for select
using (auth.role() = 'authenticated');
drop policy if exists "authenticated_read_reference_segment_sequences" on public.segment_sequences;
create policy "authenticated_read_reference_segment_sequences"
on public.segment_sequences
for select
using (auth.role() = 'authenticated');
commit;
