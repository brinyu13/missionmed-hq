-- Migration: 20260514120412_mm_sched_012_scheduler_v1_foundation.sql
-- Target Worktree: /Users/brianb/MissionMed_worktrees/mm-sched-012-schema-api-foundation
-- Authority: MM-SCHED-012
-- Date: 2026-05-14
-- Depends on: 20260507143000_stat_diagnostic_snapshot_job_layer.sql
-- Description: Draft MissionMed Scheduler V1/V1.5 foundation schema, RLS, indexes, audit, and conflict constraints.
-- Idempotent: YES

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION public.mm_scheduler_jwt()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_claims text;
BEGIN
  v_claims := current_setting('request.jwt.claims', true);
  IF v_claims IS NULL OR btrim(v_claims) = '' THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN v_claims::jsonb;
EXCEPTION WHEN OTHERS THEN
  RETURN '{}'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH claims AS (
    SELECT public.mm_scheduler_jwt() AS jwt
  )
  SELECT
    COALESCE(jwt -> 'app_metadata' ->> 'mm_role', '') IN ('admin', 'hq_admin', 'coordinator', 'missionmed_admin')
    OR COALESCE(jwt -> 'user_metadata' ->> 'mm_role', '') IN ('admin', 'hq_admin', 'coordinator', 'missionmed_admin')
    OR COALESCE(jwt ->> 'role', '') IN ('admin', 'administrator', 'service_role')
    OR COALESCE(jwt -> 'app_metadata' ->> 'role', '') IN ('admin', 'administrator')
  FROM claims;
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.mm_schedule_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_user_id integer,
  supabase_user_id uuid,
  display_name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'provider',
  timezone text NOT NULL DEFAULT 'America/New_York',
  status text NOT NULL DEFAULT 'active',
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_schedule_providers_role_chk CHECK (role IN ('provider', 'coach', 'admin_provider', 'support')),
  CONSTRAINT mm_schedule_providers_status_chk CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.mm_schedule_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  resource_type text NOT NULL DEFAULT 'generic',
  capacity integer NOT NULL DEFAULT 1,
  timezone text NOT NULL DEFAULT 'America/New_York',
  status text NOT NULL DEFAULT 'active',
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_schedule_resources_capacity_chk CHECK (capacity > 0),
  CONSTRAINT mm_schedule_resources_status_chk CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.mm_appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL,
  buffer_before_minutes integer NOT NULL DEFAULT 0,
  buffer_after_minutes integer NOT NULL DEFAULT 0,
  min_notice_minutes integer NOT NULL DEFAULT 1440,
  max_booking_window_days integer NOT NULL DEFAULT 60,
  capacity integer,
  group_enabled boolean NOT NULL DEFAULT false,
  meeting_mode text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'draft',
  active boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_appointment_types_duration_chk CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  CONSTRAINT mm_appointment_types_buffers_chk CHECK (buffer_before_minutes >= 0 AND buffer_after_minutes >= 0),
  CONSTRAINT mm_appointment_types_notice_chk CHECK (min_notice_minutes >= 0 AND max_booking_window_days >= 0),
  CONSTRAINT mm_appointment_types_capacity_chk CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT mm_appointment_types_meeting_mode_chk CHECK (meeting_mode IN ('none', 'manual', 'zoom', 'google_meet')),
  CONSTRAINT mm_appointment_types_status_chk CHECK (status IN ('draft', 'active', 'paused', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.mm_provider_appointment_types (
  provider_id uuid NOT NULL REFERENCES public.mm_schedule_providers(id) ON DELETE RESTRICT,
  appointment_type_id uuid NOT NULL REFERENCES public.mm_appointment_types(id) ON DELETE RESTRICT,
  priority integer NOT NULL DEFAULT 100,
  assignment_weight integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, appointment_type_id),
  CONSTRAINT mm_provider_appointment_types_weight_chk CHECK (assignment_weight > 0)
);

CREATE TABLE IF NOT EXISTS public.mm_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.mm_schedule_providers(id) ON DELETE RESTRICT,
  appointment_type_id uuid REFERENCES public.mm_appointment_types(id) ON DELETE RESTRICT,
  resource_id uuid REFERENCES public.mm_schedule_resources(id) ON DELETE RESTRICT,
  rule_type text NOT NULL DEFAULT 'recurring',
  day_of_week integer[] NOT NULL DEFAULT '{}',
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  effective_start date NOT NULL DEFAULT CURRENT_DATE,
  effective_end date,
  rrule text,
  status text NOT NULL DEFAULT 'active',
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_availability_rules_type_chk CHECK (rule_type IN ('recurring', 'one_off')),
  CONSTRAINT mm_availability_rules_time_chk CHECK (end_time > start_time),
  CONSTRAINT mm_availability_rules_effective_chk CHECK (effective_end IS NULL OR effective_end >= effective_start),
  CONSTRAINT mm_availability_rules_status_chk CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.mm_blackout_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.mm_schedule_providers(id) ON DELETE RESTRICT,
  resource_id uuid REFERENCES public.mm_schedule_resources(id) ON DELETE RESTRICT,
  appointment_type_id uuid REFERENCES public.mm_appointment_types(id) ON DELETE RESTRICT,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  reason text,
  created_by uuid,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_blackout_windows_range_chk CHECK (end_at > start_at),
  CONSTRAINT mm_blackout_windows_status_chk CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.mm_schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id uuid REFERENCES public.mm_appointment_types(id) ON DELETE RESTRICT,
  provider_id uuid REFERENCES public.mm_schedule_providers(id) ON DELETE RESTRICT,
  resource_id uuid REFERENCES public.mm_schedule_resources(id) ON DELETE RESTRICT,
  event_kind text NOT NULL DEFAULT 'group_session',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  capacity integer,
  reserved_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_schedule_events_kind_chk CHECK (event_kind IN ('group_session', 'class', 'provider_block', 'resource_block')),
  CONSTRAINT mm_schedule_events_range_chk CHECK (end_at > start_at),
  CONSTRAINT mm_schedule_events_capacity_chk CHECK (
    capacity IS NULL
    OR (capacity > 0 AND reserved_count >= 0 AND reserved_count <= capacity)
  ),
  CONSTRAINT mm_schedule_events_status_chk CHECK (status IN ('scheduled', 'completed', 'canceled', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.mm_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  student_wp_user_id integer,
  appointment_type_id uuid NOT NULL REFERENCES public.mm_appointment_types(id) ON DELETE RESTRICT,
  provider_id uuid REFERENCES public.mm_schedule_providers(id) ON DELETE RESTRICT,
  resource_id uuid REFERENCES public.mm_schedule_resources(id) ON DELETE RESTRICT,
  schedule_event_id uuid REFERENCES public.mm_schedule_events(id) ON DELETE RESTRICT,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  buffer_before_minutes integer NOT NULL DEFAULT 0,
  buffer_after_minutes integer NOT NULL DEFAULT 0,
  blocked_range tstzrange NOT NULL,
  status text NOT NULL DEFAULT 'booked',
  idempotency_key text,
  meeting_url text,
  external_event_status text NOT NULL DEFAULT 'not_configured',
  rescheduled_from_id uuid REFERENCES public.mm_appointments(id) ON DELETE SET NULL,
  canceled_at timestamptz,
  canceled_by uuid,
  no_show_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_appointments_range_chk CHECK (end_at > start_at),
  CONSTRAINT mm_appointments_buffers_chk CHECK (buffer_before_minutes >= 0 AND buffer_after_minutes >= 0),
  CONSTRAINT mm_appointments_status_chk CHECK (status IN ('held', 'booked', 'confirmed', 'completed', 'canceled', 'no_show', 'rescheduled', 'archived')),
  CONSTRAINT mm_appointments_external_status_chk CHECK (external_event_status IN ('not_configured', 'pending', 'created', 'failed', 'suppressed'))
);

CREATE TABLE IF NOT EXISTS public.mm_appointment_private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.mm_appointments(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.mm_schedule_providers(id) ON DELETE SET NULL,
  author_user_id uuid,
  note_text text NOT NULL,
  visibility text NOT NULL DEFAULT 'staff_only',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_appointment_private_notes_visibility_chk CHECK (visibility IN ('staff_only', 'admin_only'))
);

CREATE TABLE IF NOT EXISTS public.mm_appointment_intake_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id uuid NOT NULL REFERENCES public.mm_appointment_types(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  visibility text NOT NULL DEFAULT 'student_and_staff',
  conditional_logic jsonb,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (appointment_type_id, field_key),
  CONSTRAINT mm_appointment_intake_fields_type_chk CHECK (field_type IN ('text', 'textarea', 'select', 'checkbox', 'date', 'number', 'email', 'phone')),
  CONSTRAINT mm_appointment_intake_fields_visibility_chk CHECK (visibility IN ('student_and_staff', 'staff_only', 'admin_only'))
);

CREATE TABLE IF NOT EXISTS public.mm_appointment_intake_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.mm_appointments(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.mm_appointment_intake_fields(id) ON DELETE RESTRICT,
  answer_json jsonb,
  answer_text text,
  protected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, field_id)
);

CREATE TABLE IF NOT EXISTS public.mm_appointment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.mm_appointments(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  template_key text NOT NULL,
  recipient_role text NOT NULL DEFAULT 'student',
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  idempotency_key text,
  last_error text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mm_appointment_notifications_channel_chk CHECK (channel IN ('email', 'sms')),
  CONSTRAINT mm_appointment_notifications_recipient_chk CHECK (recipient_role IN ('student', 'provider', 'admin', 'support')),
  CONSTRAINT mm_appointment_notifications_status_chk CHECK (status IN ('pending', 'sent', 'failed', 'suppressed', 'canceled')),
  CONSTRAINT mm_appointment_notifications_attempt_chk CHECK (attempt_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.mm_appointment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  actor_wp_user_id integer,
  request_id uuid,
  idempotency_key text,
  before_json jsonb,
  after_json jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mm_appointment_audit_log_actor_chk CHECK (actor_type IN ('student', 'provider', 'admin', 'support', 'system', 'service_role'))
);

CREATE OR REPLACE FUNCTION public.mm_scheduler_prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mm_appointment_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS mm_appointment_audit_log_append_only ON public.mm_appointment_audit_log;
CREATE TRIGGER mm_appointment_audit_log_append_only
BEFORE UPDATE OR DELETE ON public.mm_appointment_audit_log
FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_prevent_audit_mutation();

CREATE TABLE IF NOT EXISTS public.mm_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.mm_schedule_providers(id) ON DELETE CASCADE,
  integration text NOT NULL DEFAULT 'google_calendar',
  account_email text,
  scopes text[] NOT NULL DEFAULT '{}',
  token_ref text,
  status text NOT NULL DEFAULT 'not_configured',
  last_sync_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_calendar_connections_integration_chk CHECK (integration IN ('google_calendar')),
  CONSTRAINT mm_calendar_connections_status_chk CHECK (status IN ('not_configured', 'active', 'disconnected', 'error', 'revoked'))
);

CREATE TABLE IF NOT EXISTS public.mm_external_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.mm_calendar_connections(id) ON DELETE CASCADE,
  external_event_id text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.mm_schedule_providers(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  busy boolean NOT NULL DEFAULT true,
  event_hash text,
  sync_state text NOT NULL DEFAULT 'current',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_external_calendar_events_range_chk CHECK (end_at > start_at),
  CONSTRAINT mm_external_calendar_events_state_chk CHECK (sync_state IN ('current', 'stale', 'deleted', 'error')),
  UNIQUE (connection_id, external_event_id)
);

CREATE TABLE IF NOT EXISTS public.mm_scheduler_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global',
  scope_id uuid,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mm_scheduler_settings_scope_chk CHECK (scope IN ('global', 'provider', 'appointment_type')),
  UNIQUE (scope, scope_id, setting_key)
);

CREATE TABLE IF NOT EXISTS public.mm_provider_assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id uuid NOT NULL REFERENCES public.mm_appointment_types(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'manual',
  provider_pool uuid[] NOT NULL DEFAULT '{}',
  weights jsonb,
  last_assigned_provider_id uuid REFERENCES public.mm_schedule_providers(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_provider_assignment_rules_mode_chk CHECK (mode IN ('manual', 'selected', 'single', 'random', 'round_robin', 'all_team'))
);

CREATE TABLE IF NOT EXISTS public.mm_appointment_type_eligibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id uuid NOT NULL REFERENCES public.mm_appointment_types(id) ON DELETE CASCADE,
  rule_kind text NOT NULL DEFAULT 'none',
  wp_product_ids integer[],
  learndash_course_ids integer[],
  role_requirements text[],
  metadata jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mm_appointment_type_eligibility_rules_kind_chk CHECK (rule_kind IN ('none', 'enrollment', 'product', 'role', 'custom'))
);

CREATE TABLE IF NOT EXISTS public.mm_scheduler_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  actor_type text NOT NULL,
  actor_id uuid,
  route text NOT NULL,
  payload_fingerprint text NOT NULL,
  result_json jsonb,
  status text NOT NULL DEFAULT 'processing',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mm_scheduler_idempotency_keys_status_chk CHECK (status IN ('processing', 'completed', 'failed', 'expired'))
);

CREATE OR REPLACE FUNCTION public.mm_scheduler_set_appointment_blocked_range()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.end_at > NEW.start_at THEN
    NEW.blocked_range = tstzrange(
      NEW.start_at - (NEW.buffer_before_minutes * interval '1 minute'),
      NEW.end_at + (NEW.buffer_after_minutes * interval '1 minute'),
      '[)'
    );
  ELSE
    NEW.blocked_range = tstzrange(NEW.start_at, NEW.start_at, '[)');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mm_appointments_set_blocked_range ON public.mm_appointments;
CREATE TRIGGER mm_appointments_set_blocked_range
BEFORE INSERT OR UPDATE OF start_at, end_at, buffer_before_minutes, buffer_after_minutes
ON public.mm_appointments
FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_appointment_blocked_range();

ALTER TABLE public.mm_appointments DROP CONSTRAINT IF EXISTS mm_appointments_provider_no_overlap;
ALTER TABLE public.mm_appointments
  ADD CONSTRAINT mm_appointments_provider_no_overlap
  EXCLUDE USING gist (
    provider_id WITH =,
    blocked_range WITH &&
  )
  WHERE (provider_id IS NOT NULL AND deleted_at IS NULL AND status IN ('held', 'booked', 'confirmed'));

ALTER TABLE public.mm_appointments DROP CONSTRAINT IF EXISTS mm_appointments_resource_no_overlap;
ALTER TABLE public.mm_appointments
  ADD CONSTRAINT mm_appointments_resource_no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    blocked_range WITH &&
  )
  WHERE (resource_id IS NOT NULL AND deleted_at IS NULL AND status IN ('held', 'booked', 'confirmed'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_mm_appointments_idempotency_key
  ON public.mm_appointments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mm_appointment_notifications_idempotency_key
  ON public.mm_appointment_notifications(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mm_schedule_providers_wp_user_id ON public.mm_schedule_providers(wp_user_id);
CREATE INDEX IF NOT EXISTS idx_mm_schedule_providers_supabase_user_id ON public.mm_schedule_providers(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_mm_schedule_providers_status ON public.mm_schedule_providers(status, active);
CREATE INDEX IF NOT EXISTS idx_mm_schedule_resources_type_status ON public.mm_schedule_resources(resource_type, status, active);
CREATE INDEX IF NOT EXISTS idx_mm_appointment_types_status ON public.mm_appointment_types(status, active);
CREATE INDEX IF NOT EXISTS idx_mm_provider_appointment_types_type ON public.mm_provider_appointment_types(appointment_type_id, active);
CREATE INDEX IF NOT EXISTS idx_mm_availability_rules_provider ON public.mm_availability_rules(provider_id, active, effective_start, effective_end);
CREATE INDEX IF NOT EXISTS idx_mm_availability_rules_type ON public.mm_availability_rules(appointment_type_id, active);
CREATE INDEX IF NOT EXISTS idx_mm_blackout_windows_provider_range ON public.mm_blackout_windows USING gist (provider_id, tstzrange(start_at, end_at, '[)'));
CREATE INDEX IF NOT EXISTS idx_mm_blackout_windows_resource_range ON public.mm_blackout_windows USING gist (resource_id, tstzrange(start_at, end_at, '[)'));
CREATE INDEX IF NOT EXISTS idx_mm_blackout_windows_type_range ON public.mm_blackout_windows USING gist (appointment_type_id, tstzrange(start_at, end_at, '[)'));
CREATE INDEX IF NOT EXISTS idx_mm_schedule_events_type_start ON public.mm_schedule_events(appointment_type_id, start_at, status);
CREATE INDEX IF NOT EXISTS idx_mm_schedule_events_provider_range ON public.mm_schedule_events USING gist (provider_id, tstzrange(start_at, end_at, '[)'));
CREATE INDEX IF NOT EXISTS idx_mm_schedule_events_resource_range ON public.mm_schedule_events USING gist (resource_id, tstzrange(start_at, end_at, '[)'));
CREATE INDEX IF NOT EXISTS idx_mm_appointments_student_status_start ON public.mm_appointments(student_user_id, status, start_at);
CREATE INDEX IF NOT EXISTS idx_mm_appointments_type_start ON public.mm_appointments(appointment_type_id, start_at);
CREATE INDEX IF NOT EXISTS idx_mm_appointments_provider_range ON public.mm_appointments USING gist (provider_id, blocked_range);
CREATE INDEX IF NOT EXISTS idx_mm_appointments_resource_range ON public.mm_appointments USING gist (resource_id, blocked_range);
CREATE INDEX IF NOT EXISTS idx_mm_intake_fields_type_order ON public.mm_appointment_intake_fields(appointment_type_id, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_mm_intake_answers_appointment ON public.mm_appointment_intake_answers(appointment_id);
CREATE INDEX IF NOT EXISTS idx_mm_notifications_schedule ON public.mm_appointment_notifications(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_mm_notifications_appointment ON public.mm_appointment_notifications(appointment_id);
CREATE INDEX IF NOT EXISTS idx_mm_audit_entity_created ON public.mm_appointment_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mm_audit_actor_created ON public.mm_appointment_audit_log(actor_type, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mm_calendar_connections_provider ON public.mm_calendar_connections(provider_id, integration, status);
CREATE INDEX IF NOT EXISTS idx_mm_external_calendar_events_provider_range ON public.mm_external_calendar_events USING gist (provider_id, tstzrange(start_at, end_at, '[)'));
CREATE INDEX IF NOT EXISTS idx_mm_external_calendar_events_connection_external ON public.mm_external_calendar_events(connection_id, external_event_id);
CREATE INDEX IF NOT EXISTS idx_mm_scheduler_settings_scope_key ON public.mm_scheduler_settings(scope, scope_id, setting_key);
CREATE INDEX IF NOT EXISTS idx_mm_provider_assignment_rules_type ON public.mm_provider_assignment_rules(appointment_type_id, active);
CREATE INDEX IF NOT EXISTS idx_mm_eligibility_rules_type ON public.mm_appointment_type_eligibility_rules(appointment_type_id, active);
CREATE INDEX IF NOT EXISTS idx_mm_scheduler_idempotency_expires ON public.mm_scheduler_idempotency_keys(expires_at, status);

DROP TRIGGER IF EXISTS mm_schedule_providers_set_updated_at ON public.mm_schedule_providers;
CREATE TRIGGER mm_schedule_providers_set_updated_at BEFORE UPDATE ON public.mm_schedule_providers FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_schedule_resources_set_updated_at ON public.mm_schedule_resources;
CREATE TRIGGER mm_schedule_resources_set_updated_at BEFORE UPDATE ON public.mm_schedule_resources FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_appointment_types_set_updated_at ON public.mm_appointment_types;
CREATE TRIGGER mm_appointment_types_set_updated_at BEFORE UPDATE ON public.mm_appointment_types FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_provider_appointment_types_set_updated_at ON public.mm_provider_appointment_types;
CREATE TRIGGER mm_provider_appointment_types_set_updated_at BEFORE UPDATE ON public.mm_provider_appointment_types FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_availability_rules_set_updated_at ON public.mm_availability_rules;
CREATE TRIGGER mm_availability_rules_set_updated_at BEFORE UPDATE ON public.mm_availability_rules FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_blackout_windows_set_updated_at ON public.mm_blackout_windows;
CREATE TRIGGER mm_blackout_windows_set_updated_at BEFORE UPDATE ON public.mm_blackout_windows FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_schedule_events_set_updated_at ON public.mm_schedule_events;
CREATE TRIGGER mm_schedule_events_set_updated_at BEFORE UPDATE ON public.mm_schedule_events FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_appointments_set_updated_at ON public.mm_appointments;
CREATE TRIGGER mm_appointments_set_updated_at BEFORE UPDATE ON public.mm_appointments FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_appointment_private_notes_set_updated_at ON public.mm_appointment_private_notes;
CREATE TRIGGER mm_appointment_private_notes_set_updated_at BEFORE UPDATE ON public.mm_appointment_private_notes FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_appointment_intake_fields_set_updated_at ON public.mm_appointment_intake_fields;
CREATE TRIGGER mm_appointment_intake_fields_set_updated_at BEFORE UPDATE ON public.mm_appointment_intake_fields FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_appointment_intake_answers_set_updated_at ON public.mm_appointment_intake_answers;
CREATE TRIGGER mm_appointment_intake_answers_set_updated_at BEFORE UPDATE ON public.mm_appointment_intake_answers FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_appointment_notifications_set_updated_at ON public.mm_appointment_notifications;
CREATE TRIGGER mm_appointment_notifications_set_updated_at BEFORE UPDATE ON public.mm_appointment_notifications FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_calendar_connections_set_updated_at ON public.mm_calendar_connections;
CREATE TRIGGER mm_calendar_connections_set_updated_at BEFORE UPDATE ON public.mm_calendar_connections FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_external_calendar_events_set_updated_at ON public.mm_external_calendar_events;
CREATE TRIGGER mm_external_calendar_events_set_updated_at BEFORE UPDATE ON public.mm_external_calendar_events FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_scheduler_settings_set_updated_at ON public.mm_scheduler_settings;
CREATE TRIGGER mm_scheduler_settings_set_updated_at BEFORE UPDATE ON public.mm_scheduler_settings FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_provider_assignment_rules_set_updated_at ON public.mm_provider_assignment_rules;
CREATE TRIGGER mm_provider_assignment_rules_set_updated_at BEFORE UPDATE ON public.mm_provider_assignment_rules FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_appointment_type_eligibility_rules_set_updated_at ON public.mm_appointment_type_eligibility_rules;
CREATE TRIGGER mm_appointment_type_eligibility_rules_set_updated_at BEFORE UPDATE ON public.mm_appointment_type_eligibility_rules FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();
DROP TRIGGER IF EXISTS mm_scheduler_idempotency_keys_set_updated_at ON public.mm_scheduler_idempotency_keys;
CREATE TRIGGER mm_scheduler_idempotency_keys_set_updated_at BEFORE UPDATE ON public.mm_scheduler_idempotency_keys FOR EACH ROW EXECUTE FUNCTION public.mm_scheduler_set_updated_at();

CREATE OR REPLACE FUNCTION public.mm_scheduler_provider_id_for_auth()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id
  FROM public.mm_schedule_providers p
  WHERE p.supabase_user_id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.active = true
    AND p.status = 'active'
  ORDER BY p.created_at ASC
  LIMIT 1;
$$;

ALTER TABLE public.mm_schedule_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_schedule_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_provider_appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_blackout_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_appointment_private_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_appointment_intake_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_appointment_intake_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_appointment_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_appointment_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_external_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_scheduler_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_provider_assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_appointment_type_eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_scheduler_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mm_schedule_providers_select_self_or_admin ON public.mm_schedule_providers;
CREATE POLICY mm_schedule_providers_select_self_or_admin ON public.mm_schedule_providers
  FOR SELECT TO authenticated
  USING (supabase_user_id = auth.uid() OR public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_schedule_providers_admin_all ON public.mm_schedule_providers;
CREATE POLICY mm_schedule_providers_admin_all ON public.mm_schedule_providers
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_schedule_resources_admin_all ON public.mm_schedule_resources;
CREATE POLICY mm_schedule_resources_admin_all ON public.mm_schedule_resources
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_appointment_types_select_active_or_admin ON public.mm_appointment_types;
CREATE POLICY mm_appointment_types_select_active_or_admin ON public.mm_appointment_types
  FOR SELECT TO authenticated
  USING ((active = true AND status = 'active' AND deleted_at IS NULL) OR public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_appointment_types_admin_all ON public.mm_appointment_types;
CREATE POLICY mm_appointment_types_admin_all ON public.mm_appointment_types
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_provider_appointment_types_select_provider_or_admin ON public.mm_provider_appointment_types;
CREATE POLICY mm_provider_appointment_types_select_provider_or_admin ON public.mm_provider_appointment_types
  FOR SELECT TO authenticated
  USING (provider_id = public.mm_scheduler_provider_id_for_auth() OR public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_provider_appointment_types_admin_all ON public.mm_provider_appointment_types;
CREATE POLICY mm_provider_appointment_types_admin_all ON public.mm_provider_appointment_types
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_availability_rules_select_provider_or_admin ON public.mm_availability_rules;
CREATE POLICY mm_availability_rules_select_provider_or_admin ON public.mm_availability_rules
  FOR SELECT TO authenticated
  USING (provider_id = public.mm_scheduler_provider_id_for_auth() OR public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_availability_rules_admin_all ON public.mm_availability_rules;
CREATE POLICY mm_availability_rules_admin_all ON public.mm_availability_rules
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_blackout_windows_select_provider_or_admin ON public.mm_blackout_windows;
CREATE POLICY mm_blackout_windows_select_provider_or_admin ON public.mm_blackout_windows
  FOR SELECT TO authenticated
  USING (provider_id = public.mm_scheduler_provider_id_for_auth() OR public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_blackout_windows_admin_all ON public.mm_blackout_windows;
CREATE POLICY mm_blackout_windows_admin_all ON public.mm_blackout_windows
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_schedule_events_select_bookable_or_admin ON public.mm_schedule_events;
CREATE POLICY mm_schedule_events_select_bookable_or_admin ON public.mm_schedule_events
  FOR SELECT TO authenticated
  USING (
    public.mm_scheduler_is_admin()
    OR provider_id = public.mm_scheduler_provider_id_for_auth()
    OR (
      status = 'scheduled'
      AND deleted_at IS NULL
      AND event_kind IN ('group_session', 'class')
      AND metadata @> '{"student_visible": true}'::jsonb
    )
  );

DROP POLICY IF EXISTS mm_schedule_events_admin_all ON public.mm_schedule_events;
CREATE POLICY mm_schedule_events_admin_all ON public.mm_schedule_events
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_appointments_select_actor_scope ON public.mm_appointments;
CREATE POLICY mm_appointments_select_actor_scope ON public.mm_appointments
  FOR SELECT TO authenticated
  USING (
    student_user_id = auth.uid()
    OR provider_id = public.mm_scheduler_provider_id_for_auth()
    OR public.mm_scheduler_is_admin()
  );

DROP POLICY IF EXISTS mm_appointment_private_notes_select_provider_or_admin ON public.mm_appointment_private_notes;
CREATE POLICY mm_appointment_private_notes_select_provider_or_admin ON public.mm_appointment_private_notes
  FOR SELECT TO authenticated
  USING (
    provider_id = public.mm_scheduler_provider_id_for_auth()
    OR public.mm_scheduler_is_admin()
  );

DROP POLICY IF EXISTS mm_appointment_private_notes_provider_insert ON public.mm_appointment_private_notes;
CREATE POLICY mm_appointment_private_notes_provider_insert ON public.mm_appointment_private_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.mm_scheduler_is_admin()
    OR (
      provider_id = public.mm_scheduler_provider_id_for_auth()
      AND author_user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.mm_appointments a
        WHERE a.id = mm_appointment_private_notes.appointment_id
          AND a.provider_id = public.mm_scheduler_provider_id_for_auth()
          AND a.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS mm_intake_fields_select_active_or_admin ON public.mm_appointment_intake_fields;
CREATE POLICY mm_intake_fields_select_active_or_admin ON public.mm_appointment_intake_fields
  FOR SELECT TO authenticated
  USING ((active = true AND deleted_at IS NULL AND visibility = 'student_and_staff') OR public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_intake_fields_admin_all ON public.mm_appointment_intake_fields;
CREATE POLICY mm_intake_fields_admin_all ON public.mm_appointment_intake_fields
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_intake_answers_select_actor_scope ON public.mm_appointment_intake_answers;
CREATE POLICY mm_intake_answers_select_actor_scope ON public.mm_appointment_intake_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.mm_appointments a
      WHERE a.id = mm_appointment_intake_answers.appointment_id
        AND (
          (a.student_user_id = auth.uid() AND mm_appointment_intake_answers.protected = false)
          OR a.provider_id = public.mm_scheduler_provider_id_for_auth()
          OR public.mm_scheduler_is_admin()
        )
    )
  );

DROP POLICY IF EXISTS mm_notifications_select_actor_scope ON public.mm_appointment_notifications;
CREATE POLICY mm_notifications_select_actor_scope ON public.mm_appointment_notifications
  FOR SELECT TO authenticated
  USING (
    public.mm_scheduler_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.mm_appointments a
      WHERE a.id = mm_appointment_notifications.appointment_id
        AND (a.student_user_id = auth.uid() OR a.provider_id = public.mm_scheduler_provider_id_for_auth())
    )
  );

DROP POLICY IF EXISTS mm_audit_log_admin_select ON public.mm_appointment_audit_log;
CREATE POLICY mm_audit_log_admin_select ON public.mm_appointment_audit_log
  FOR SELECT TO authenticated
  USING (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_calendar_connections_select_provider_or_admin ON public.mm_calendar_connections;
CREATE POLICY mm_calendar_connections_select_provider_or_admin ON public.mm_calendar_connections
  FOR SELECT TO authenticated
  USING (provider_id = public.mm_scheduler_provider_id_for_auth() OR public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_external_calendar_events_select_provider_or_admin ON public.mm_external_calendar_events;
CREATE POLICY mm_external_calendar_events_select_provider_or_admin ON public.mm_external_calendar_events
  FOR SELECT TO authenticated
  USING (provider_id = public.mm_scheduler_provider_id_for_auth() OR public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_scheduler_settings_admin_all ON public.mm_scheduler_settings;
CREATE POLICY mm_scheduler_settings_admin_all ON public.mm_scheduler_settings
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_provider_assignment_rules_admin_all ON public.mm_provider_assignment_rules;
CREATE POLICY mm_provider_assignment_rules_admin_all ON public.mm_provider_assignment_rules
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_eligibility_rules_admin_all ON public.mm_appointment_type_eligibility_rules;
CREATE POLICY mm_eligibility_rules_admin_all ON public.mm_appointment_type_eligibility_rules
  FOR ALL TO authenticated
  USING (public.mm_scheduler_is_admin())
  WITH CHECK (public.mm_scheduler_is_admin());

DROP POLICY IF EXISTS mm_scheduler_idempotency_admin_select ON public.mm_scheduler_idempotency_keys;
CREATE POLICY mm_scheduler_idempotency_admin_select ON public.mm_scheduler_idempotency_keys
  FOR SELECT TO authenticated
  USING (public.mm_scheduler_is_admin());

CREATE OR REPLACE FUNCTION public.mm_scheduler_payload_text(p_payload jsonb, VARIADIC p_keys text[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_value text;
BEGIN
  FOREACH v_key IN ARRAY p_keys LOOP
    IF p_payload ? v_key THEN
      v_value := nullif(btrim(p_payload ->> v_key), '');
      IF v_value IS NOT NULL THEN
        RETURN v_value;
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_payload_uuid(p_payload jsonb, p_error text, VARIADIC p_keys text[])
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_text text;
BEGIN
  v_text := public.mm_scheduler_payload_text(p_payload, VARIADIC p_keys);
  IF v_text IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION '%', p_error USING ERRCODE = 'P0001';
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_payload_timestamptz(p_payload jsonb, p_error text, VARIADIC p_keys text[])
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_text text;
BEGIN
  v_text := public.mm_scheduler_payload_text(p_payload, VARIADIC p_keys);
  IF v_text IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_text::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR invalid_text_representation THEN
    RAISE EXCEPTION '%', p_error USING ERRCODE = 'P0001';
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_payload_fingerprint(p_payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(extensions.digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_claim_idempotency(
  p_key text,
  p_actor_type text,
  p_actor_id uuid,
  p_route text,
  p_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.mm_scheduler_idempotency_keys%ROWTYPE;
BEGIN
  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.mm_scheduler_idempotency_keys (
    idempotency_key,
    actor_type,
    actor_id,
    route,
    payload_fingerprint,
    status
  )
  VALUES (
    p_key,
    p_actor_type,
    p_actor_id,
    p_route,
    p_fingerprint,
    'processing'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF FOUND THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.mm_scheduler_idempotency_keys
  WHERE idempotency_key = p_key
  FOR UPDATE;

  IF v_existing.payload_fingerprint <> p_fingerprint THEN
    RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = 'P0001';
  END IF;

  IF v_existing.status = 'completed' AND v_existing.result_json IS NOT NULL THEN
    RETURN jsonb_set(v_existing.result_json, '{idempotency_replay}', 'true'::jsonb, true);
  END IF;

  RAISE EXCEPTION 'idempotency_replay' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_complete_idempotency(p_key text, p_result jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mm_scheduler_idempotency_keys
  SET
    result_json = p_result,
    status = 'completed',
    updated_at = now()
  WHERE idempotency_key = p_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_actor_type(p_payload jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_actor_type text;
BEGIN
  v_actor_type := coalesce(public.mm_scheduler_payload_text(p_payload, 'actor_type', 'actorType'), 'student');
  IF v_actor_type = 'service' THEN
    v_actor_type := 'service_role';
  END IF;
  IF v_actor_type NOT IN ('student', 'provider', 'admin', 'support', 'system', 'service_role') THEN
    RAISE EXCEPTION 'invalid_actor_type' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_actor_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_book_appointment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idempotency_key text;
  v_actor_type text;
  v_actor_id uuid;
  v_actor_wp_user_id integer;
  v_student_user_id uuid;
  v_student_wp_user_id integer;
  v_appointment_type_id uuid;
  v_provider_id uuid;
  v_resource_id uuid;
  v_schedule_event_id uuid;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_timezone text;
  v_type public.mm_appointment_types%ROWTYPE;
  v_provider public.mm_schedule_providers%ROWTYPE;
  v_resource public.mm_schedule_resources%ROWTYPE;
  v_schedule_event public.mm_schedule_events%ROWTYPE;
  v_request_range tstzrange;
  v_fingerprint text;
  v_replay jsonb;
  v_appointment public.mm_appointments%ROWTYPE;
  v_answer jsonb;
  v_field_id uuid;
  v_result jsonb;
BEGIN
  p_payload := coalesce(p_payload, '{}'::jsonb);
  v_idempotency_key := public.mm_scheduler_payload_text(p_payload, 'idempotency_key', 'idempotencyKey');
  v_actor_type := public.mm_scheduler_actor_type(p_payload);
  v_actor_id := public.mm_scheduler_payload_uuid(p_payload, 'unauthenticated', 'actor_user_id', 'actorUserId', 'student_user_id', 'studentUserId');
  v_actor_wp_user_id := nullif(public.mm_scheduler_payload_text(p_payload, 'actor_wp_user_id', 'actorWpUserId', 'student_wp_user_id', 'studentWpUserId'), '')::integer;
  v_student_user_id := public.mm_scheduler_payload_uuid(p_payload, 'unauthenticated', 'student_user_id', 'studentUserId', 'actor_user_id', 'actorUserId');
  v_student_wp_user_id := nullif(public.mm_scheduler_payload_text(p_payload, 'student_wp_user_id', 'studentWpUserId'), '')::integer;
  v_appointment_type_id := public.mm_scheduler_payload_uuid(p_payload, 'appointment_type_not_found', 'appointment_type_id', 'appointmentTypeId');
  v_provider_id := public.mm_scheduler_payload_uuid(p_payload, 'provider_not_found', 'provider_id', 'providerId');
  v_resource_id := public.mm_scheduler_payload_uuid(p_payload, 'resource_not_found', 'resource_id', 'resourceId');
  v_schedule_event_id := public.mm_scheduler_payload_uuid(p_payload, 'schedule_event_not_found', 'schedule_event_id', 'scheduleEventId');
  v_start_at := public.mm_scheduler_payload_timestamptz(p_payload, 'invalid_time_range', 'start_at', 'startAt');
  v_end_at := public.mm_scheduler_payload_timestamptz(p_payload, 'invalid_time_range', 'end_at', 'endAt');
  v_timezone := coalesce(public.mm_scheduler_payload_text(p_payload, 'timezone'), 'America/New_York');

  IF v_actor_id IS NULL OR v_student_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'P0001';
  END IF;
  IF v_appointment_type_id IS NULL OR v_provider_id IS NULL THEN
    RAISE EXCEPTION 'provider_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_start_at IS NULL OR v_end_at IS NULL OR v_end_at <= v_start_at THEN
    RAISE EXCEPTION 'invalid_time_range' USING ERRCODE = 'P0001';
  END IF;
  IF v_timezone IS NULL OR btrim(v_timezone) = '' THEN
    RAISE EXCEPTION 'invalid_timezone' USING ERRCODE = 'P0001';
  END IF;

  v_fingerprint := public.mm_scheduler_payload_fingerprint(jsonb_build_object(
    'route', 'scheduler/book',
    'student_user_id', v_student_user_id,
    'appointment_type_id', v_appointment_type_id,
    'provider_id', v_provider_id,
    'resource_id', v_resource_id,
    'schedule_event_id', v_schedule_event_id,
    'start_at', v_start_at,
    'end_at', v_end_at,
    'timezone', v_timezone,
    'intake_answers', coalesce(p_payload -> 'intake_answers', p_payload -> 'intakeAnswers', '[]'::jsonb)
  ));
  v_replay := public.mm_scheduler_claim_idempotency(v_idempotency_key, v_actor_type, v_actor_id, 'scheduler/book', v_fingerprint);
  IF v_replay IS NOT NULL THEN
    RETURN v_replay;
  END IF;

  SELECT *
  INTO v_type
  FROM public.mm_appointment_types
  WHERE id = v_appointment_type_id
    AND active = true
    AND status = 'active'
    AND deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_type_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_provider
  FROM public.mm_schedule_providers
  WHERE id = v_provider_id
    AND active = true
    AND status = 'active'
    AND deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.mm_provider_appointment_types pat
    WHERE pat.provider_id = v_provider_id
      AND pat.appointment_type_id = v_appointment_type_id
      AND pat.active = true
  ) THEN
    RAISE EXCEPTION 'provider_not_eligible' USING ERRCODE = 'P0001';
  END IF;

  IF v_resource_id IS NOT NULL THEN
    SELECT *
    INTO v_resource
    FROM public.mm_schedule_resources
    WHERE id = v_resource_id
      AND active = true
      AND status = 'active'
      AND deleted_at IS NULL
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'resource_not_found' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_schedule_event_id IS NOT NULL THEN
    SELECT *
    INTO v_schedule_event
    FROM public.mm_schedule_events
    WHERE id = v_schedule_event_id
      AND status = 'scheduled'
      AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'schedule_event_not_found' USING ERRCODE = 'P0001';
    END IF;
    IF v_schedule_event.appointment_type_id IS DISTINCT FROM v_appointment_type_id
      OR v_schedule_event.provider_id IS DISTINCT FROM v_provider_id
      OR v_schedule_event.start_at IS DISTINCT FROM v_start_at
      OR v_schedule_event.end_at IS DISTINCT FROM v_end_at THEN
      RAISE EXCEPTION 'schedule_event_mismatch' USING ERRCODE = 'P0001';
    END IF;
    IF v_schedule_event.resource_id IS NOT NULL AND v_schedule_event.resource_id IS DISTINCT FROM v_resource_id THEN
      RAISE EXCEPTION 'resource_conflict' USING ERRCODE = 'P0001';
    END IF;
    IF v_schedule_event.capacity IS NOT NULL AND v_schedule_event.reserved_count >= v_schedule_event.capacity THEN
      RAISE EXCEPTION 'capacity_full' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_request_range := tstzrange(
    v_start_at - (v_type.buffer_before_minutes * interval '1 minute'),
    v_end_at + (v_type.buffer_after_minutes * interval '1 minute'),
    '[)'
  );

  IF EXISTS (
    SELECT 1
    FROM public.mm_blackout_windows b
    WHERE b.status = 'active'
      AND b.deleted_at IS NULL
      AND (b.provider_id IS NULL OR b.provider_id = v_provider_id)
      AND (b.resource_id IS NULL OR b.resource_id IS NOT DISTINCT FROM v_resource_id)
      AND (b.appointment_type_id IS NULL OR b.appointment_type_id = v_appointment_type_id)
      AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(v_start_at, v_end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'blackout_conflict' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mm_appointments a
    WHERE a.provider_id = v_provider_id
      AND a.deleted_at IS NULL
      AND a.status IN ('held', 'booked', 'confirmed')
      AND a.blocked_range && v_request_range
  ) THEN
    RAISE EXCEPTION 'provider_conflict' USING ERRCODE = 'P0001';
  END IF;

  IF v_resource_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.mm_appointments a
    WHERE a.resource_id = v_resource_id
      AND a.deleted_at IS NULL
      AND a.status IN ('held', 'booked', 'confirmed')
      AND a.blocked_range && v_request_range
  ) THEN
    RAISE EXCEPTION 'resource_conflict' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.mm_appointments (
    student_user_id,
    student_wp_user_id,
    appointment_type_id,
    provider_id,
    resource_id,
    schedule_event_id,
    start_at,
    end_at,
    timezone,
    buffer_before_minutes,
    buffer_after_minutes,
    status,
    idempotency_key,
    metadata
  )
  VALUES (
    v_student_user_id,
    v_student_wp_user_id,
    v_appointment_type_id,
    v_provider_id,
    v_resource_id,
    v_schedule_event_id,
    v_start_at,
    v_end_at,
    v_timezone,
    v_type.buffer_before_minutes,
    v_type.buffer_after_minutes,
    'booked',
    v_idempotency_key,
    jsonb_build_object('source', 'scheduler_rpc', 'meeting_mode', v_type.meeting_mode)
  )
  RETURNING * INTO v_appointment;

  IF jsonb_typeof(coalesce(p_payload -> 'intake_answers', p_payload -> 'intakeAnswers', '[]'::jsonb)) = 'array' THEN
    FOR v_answer IN SELECT * FROM jsonb_array_elements(coalesce(p_payload -> 'intake_answers', p_payload -> 'intakeAnswers', '[]'::jsonb)) LOOP
      v_field_id := public.mm_scheduler_payload_uuid(v_answer, 'intake_field_not_found', 'field_id', 'fieldId');
      IF v_field_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.mm_appointment_intake_fields f
          WHERE f.id = v_field_id
            AND f.appointment_type_id = v_appointment_type_id
            AND f.active = true
            AND f.deleted_at IS NULL
        ) THEN
          RAISE EXCEPTION 'intake_field_not_found' USING ERRCODE = 'P0001';
        END IF;
        INSERT INTO public.mm_appointment_intake_answers (
          appointment_id,
          field_id,
          answer_json,
          answer_text,
          protected
        )
        VALUES (
          v_appointment.id,
          v_field_id,
          coalesce(v_answer -> 'answer_json', v_answer -> 'answerJson'),
          public.mm_scheduler_payload_text(v_answer, 'answer_text', 'answerText'),
          coalesce((v_answer ->> 'protected')::boolean, false)
        );
      END IF;
    END LOOP;
  END IF;

  IF v_schedule_event_id IS NOT NULL THEN
    UPDATE public.mm_schedule_events
    SET reserved_count = reserved_count + 1
    WHERE id = v_schedule_event_id;
  END IF;

  INSERT INTO public.mm_appointment_audit_log (
    entity_type,
    entity_id,
    action,
    actor_type,
    actor_id,
    actor_wp_user_id,
    idempotency_key,
    after_json,
    metadata
  )
  VALUES (
    'appointment',
    v_appointment.id,
    'appointment.booked',
    v_actor_type,
    v_actor_id,
    v_actor_wp_user_id,
    v_idempotency_key,
    to_jsonb(v_appointment),
    jsonb_build_object('source', 'scheduler_rpc')
  );

  INSERT INTO public.mm_appointment_notifications (
    appointment_id,
    channel,
    template_key,
    recipient_role,
    scheduled_at,
    status,
    idempotency_key,
    metadata
  )
  VALUES (
    v_appointment.id,
    'email',
    'scheduler_booking_confirmation',
    'student',
    now(),
    'pending',
    v_idempotency_key || ':booking_confirmation',
    jsonb_build_object('source', 'scheduler_rpc_placeholder')
  );

  v_result := jsonb_build_object(
    'ok', true,
    'action', 'book',
    'appointment_id', v_appointment.id,
    'status', v_appointment.status,
    'idempotency_key', v_idempotency_key,
    'idempotency_replay', false
  );
  PERFORM public.mm_scheduler_complete_idempotency(v_idempotency_key, v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_reschedule_appointment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idempotency_key text;
  v_actor_type text;
  v_actor_id uuid;
  v_actor_provider_id uuid;
  v_actor_wp_user_id integer;
  v_appointment_id uuid;
  v_new_type_id uuid;
  v_new_provider_id uuid;
  v_new_resource_id uuid;
  v_new_schedule_event_id uuid;
  v_new_start_at timestamptz;
  v_new_end_at timestamptz;
  v_new_timezone text;
  v_existing public.mm_appointments%ROWTYPE;
  v_type public.mm_appointment_types%ROWTYPE;
  v_schedule_event public.mm_schedule_events%ROWTYPE;
  v_request_range tstzrange;
  v_fingerprint text;
  v_replay jsonb;
  v_updated public.mm_appointments%ROWTYPE;
  v_result jsonb;
BEGIN
  p_payload := coalesce(p_payload, '{}'::jsonb);
  v_idempotency_key := public.mm_scheduler_payload_text(p_payload, 'idempotency_key', 'idempotencyKey');
  v_actor_type := public.mm_scheduler_actor_type(p_payload);
  v_actor_id := public.mm_scheduler_payload_uuid(p_payload, 'unauthenticated', 'actor_user_id', 'actorUserId', 'student_user_id', 'studentUserId');
  v_actor_provider_id := public.mm_scheduler_payload_uuid(p_payload, 'provider_not_configured', 'actor_provider_id', 'actorProviderId', 'provider_id', 'providerId');
  v_actor_wp_user_id := nullif(public.mm_scheduler_payload_text(p_payload, 'actor_wp_user_id', 'actorWpUserId', 'student_wp_user_id', 'studentWpUserId'), '')::integer;
  v_appointment_id := public.mm_scheduler_payload_uuid(p_payload, 'appointment_not_found', 'appointment_id', 'appointmentId', 'id');
  v_new_start_at := public.mm_scheduler_payload_timestamptz(p_payload, 'invalid_time_range', 'start_at', 'startAt');
  v_new_end_at := public.mm_scheduler_payload_timestamptz(p_payload, 'invalid_time_range', 'end_at', 'endAt');
  v_new_timezone := coalesce(public.mm_scheduler_payload_text(p_payload, 'timezone'), 'America/New_York');

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'P0001';
  END IF;
  IF v_appointment_id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_new_start_at IS NULL OR v_new_end_at IS NULL OR v_new_end_at <= v_new_start_at THEN
    RAISE EXCEPTION 'invalid_time_range' USING ERRCODE = 'P0001';
  END IF;

  v_fingerprint := public.mm_scheduler_payload_fingerprint(jsonb_build_object(
    'route', 'scheduler/reschedule',
    'appointment_id', v_appointment_id,
    'actor_id', v_actor_id,
    'start_at', v_new_start_at,
    'end_at', v_new_end_at,
    'timezone', v_new_timezone,
    'provider_id', public.mm_scheduler_payload_text(p_payload, 'provider_id', 'providerId'),
    'resource_id', public.mm_scheduler_payload_text(p_payload, 'resource_id', 'resourceId')
  ));
  v_replay := public.mm_scheduler_claim_idempotency(v_idempotency_key, v_actor_type, v_actor_id, 'scheduler/reschedule', v_fingerprint);
  IF v_replay IS NOT NULL THEN
    RETURN v_replay;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.mm_appointments
  WHERE id = v_appointment_id
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_existing.status NOT IN ('held', 'booked', 'confirmed') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;
  IF v_actor_type NOT IN ('admin', 'support', 'system', 'service_role')
    AND NOT (v_actor_type = 'student' AND v_existing.student_user_id = v_actor_id)
    AND NOT (v_actor_type = 'provider' AND v_existing.provider_id IS NOT DISTINCT FROM v_actor_provider_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;

  v_new_type_id := coalesce(public.mm_scheduler_payload_uuid(p_payload, 'appointment_type_not_found', 'appointment_type_id', 'appointmentTypeId'), v_existing.appointment_type_id);
  v_new_provider_id := coalesce(public.mm_scheduler_payload_uuid(p_payload, 'provider_not_found', 'provider_id', 'providerId'), v_existing.provider_id);
  v_new_resource_id := coalesce(public.mm_scheduler_payload_uuid(p_payload, 'resource_not_found', 'resource_id', 'resourceId'), v_existing.resource_id);
  v_new_schedule_event_id := coalesce(public.mm_scheduler_payload_uuid(p_payload, 'schedule_event_not_found', 'schedule_event_id', 'scheduleEventId'), v_existing.schedule_event_id);

  SELECT *
  INTO v_type
  FROM public.mm_appointment_types
  WHERE id = v_new_type_id
    AND active = true
    AND status = 'active'
    AND deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_type_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.mm_schedule_providers p
    WHERE p.id = v_new_provider_id
      AND p.active = true
      AND p.status = 'active'
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'provider_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.mm_provider_appointment_types pat
    WHERE pat.provider_id = v_new_provider_id
      AND pat.appointment_type_id = v_new_type_id
      AND pat.active = true
  ) THEN
    RAISE EXCEPTION 'provider_not_eligible' USING ERRCODE = 'P0001';
  END IF;

  IF v_new_resource_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.mm_schedule_resources r
    WHERE r.id = v_new_resource_id
      AND r.active = true
      AND r.status = 'active'
      AND r.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'resource_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_new_schedule_event_id IS NOT NULL THEN
    SELECT *
    INTO v_schedule_event
    FROM public.mm_schedule_events
    WHERE id = v_new_schedule_event_id
      AND status = 'scheduled'
      AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'schedule_event_not_found' USING ERRCODE = 'P0001';
    END IF;
    IF v_schedule_event.appointment_type_id IS DISTINCT FROM v_new_type_id
      OR v_schedule_event.provider_id IS DISTINCT FROM v_new_provider_id
      OR v_schedule_event.start_at IS DISTINCT FROM v_new_start_at
      OR v_schedule_event.end_at IS DISTINCT FROM v_new_end_at THEN
      RAISE EXCEPTION 'schedule_event_mismatch' USING ERRCODE = 'P0001';
    END IF;
    IF v_new_schedule_event_id IS DISTINCT FROM v_existing.schedule_event_id
      AND v_schedule_event.capacity IS NOT NULL
      AND v_schedule_event.reserved_count >= v_schedule_event.capacity THEN
      RAISE EXCEPTION 'capacity_full' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_request_range := tstzrange(
    v_new_start_at - (v_type.buffer_before_minutes * interval '1 minute'),
    v_new_end_at + (v_type.buffer_after_minutes * interval '1 minute'),
    '[)'
  );

  IF EXISTS (
    SELECT 1
    FROM public.mm_blackout_windows b
    WHERE b.status = 'active'
      AND b.deleted_at IS NULL
      AND (b.provider_id IS NULL OR b.provider_id = v_new_provider_id)
      AND (b.resource_id IS NULL OR b.resource_id IS NOT DISTINCT FROM v_new_resource_id)
      AND (b.appointment_type_id IS NULL OR b.appointment_type_id = v_new_type_id)
      AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(v_new_start_at, v_new_end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'blackout_conflict' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mm_appointments a
    WHERE a.id <> v_appointment_id
      AND a.provider_id = v_new_provider_id
      AND a.deleted_at IS NULL
      AND a.status IN ('held', 'booked', 'confirmed')
      AND a.blocked_range && v_request_range
  ) THEN
    RAISE EXCEPTION 'provider_conflict' USING ERRCODE = 'P0001';
  END IF;

  IF v_new_resource_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.mm_appointments a
    WHERE a.id <> v_appointment_id
      AND a.resource_id = v_new_resource_id
      AND a.deleted_at IS NULL
      AND a.status IN ('held', 'booked', 'confirmed')
      AND a.blocked_range && v_request_range
  ) THEN
    RAISE EXCEPTION 'resource_conflict' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.mm_appointments
  SET
    appointment_type_id = v_new_type_id,
    provider_id = v_new_provider_id,
    resource_id = v_new_resource_id,
    schedule_event_id = v_new_schedule_event_id,
    start_at = v_new_start_at,
    end_at = v_new_end_at,
    timezone = v_new_timezone,
    buffer_before_minutes = v_type.buffer_before_minutes,
    buffer_after_minutes = v_type.buffer_after_minutes,
    status = 'booked',
    idempotency_key = v_idempotency_key,
    updated_at = now()
  WHERE id = v_appointment_id
  RETURNING * INTO v_updated;

  IF v_existing.schedule_event_id IS DISTINCT FROM v_new_schedule_event_id THEN
    IF v_existing.schedule_event_id IS NOT NULL THEN
      UPDATE public.mm_schedule_events
      SET reserved_count = greatest(0, reserved_count - 1)
      WHERE id = v_existing.schedule_event_id;
    END IF;
    IF v_new_schedule_event_id IS NOT NULL THEN
      UPDATE public.mm_schedule_events
      SET reserved_count = reserved_count + 1
      WHERE id = v_new_schedule_event_id;
    END IF;
  END IF;

  INSERT INTO public.mm_appointment_audit_log (
    entity_type,
    entity_id,
    action,
    actor_type,
    actor_id,
    actor_wp_user_id,
    idempotency_key,
    before_json,
    after_json,
    metadata
  )
  VALUES (
    'appointment',
    v_updated.id,
    'appointment.rescheduled',
    v_actor_type,
    v_actor_id,
    v_actor_wp_user_id,
    v_idempotency_key,
    to_jsonb(v_existing),
    to_jsonb(v_updated),
    jsonb_build_object('source', 'scheduler_rpc')
  );

  INSERT INTO public.mm_appointment_notifications (
    appointment_id,
    channel,
    template_key,
    recipient_role,
    scheduled_at,
    status,
    idempotency_key,
    metadata
  )
  VALUES (
    v_updated.id,
    'email',
    'scheduler_reschedule_confirmation',
    'student',
    now(),
    'pending',
    v_idempotency_key || ':reschedule_confirmation',
    jsonb_build_object('source', 'scheduler_rpc_placeholder')
  );

  v_result := jsonb_build_object(
    'ok', true,
    'action', 'reschedule',
    'appointment_id', v_updated.id,
    'status', v_updated.status,
    'idempotency_key', v_idempotency_key,
    'idempotency_replay', false
  );
  PERFORM public.mm_scheduler_complete_idempotency(v_idempotency_key, v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_scheduler_cancel_appointment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idempotency_key text;
  v_actor_type text;
  v_actor_id uuid;
  v_actor_provider_id uuid;
  v_actor_wp_user_id integer;
  v_appointment_id uuid;
  v_existing public.mm_appointments%ROWTYPE;
  v_updated public.mm_appointments%ROWTYPE;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  p_payload := coalesce(p_payload, '{}'::jsonb);
  v_idempotency_key := public.mm_scheduler_payload_text(p_payload, 'idempotency_key', 'idempotencyKey');
  v_actor_type := public.mm_scheduler_actor_type(p_payload);
  v_actor_id := public.mm_scheduler_payload_uuid(p_payload, 'unauthenticated', 'actor_user_id', 'actorUserId', 'student_user_id', 'studentUserId');
  v_actor_provider_id := public.mm_scheduler_payload_uuid(p_payload, 'provider_not_configured', 'actor_provider_id', 'actorProviderId', 'provider_id', 'providerId');
  v_actor_wp_user_id := nullif(public.mm_scheduler_payload_text(p_payload, 'actor_wp_user_id', 'actorWpUserId', 'student_wp_user_id', 'studentWpUserId'), '')::integer;
  v_appointment_id := public.mm_scheduler_payload_uuid(p_payload, 'appointment_not_found', 'appointment_id', 'appointmentId', 'id');

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'P0001';
  END IF;
  IF v_appointment_id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = 'P0001';
  END IF;

  v_fingerprint := public.mm_scheduler_payload_fingerprint(jsonb_build_object(
    'route', 'scheduler/cancel',
    'appointment_id', v_appointment_id,
    'actor_id', v_actor_id,
    'reason', public.mm_scheduler_payload_text(p_payload, 'reason')
  ));
  v_replay := public.mm_scheduler_claim_idempotency(v_idempotency_key, v_actor_type, v_actor_id, 'scheduler/cancel', v_fingerprint);
  IF v_replay IS NOT NULL THEN
    RETURN v_replay;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.mm_appointments
  WHERE id = v_appointment_id
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_existing.status NOT IN ('held', 'booked', 'confirmed') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;
  IF v_actor_type NOT IN ('admin', 'support', 'system', 'service_role')
    AND NOT (v_actor_type = 'student' AND v_existing.student_user_id = v_actor_id)
    AND NOT (v_actor_type = 'provider' AND v_existing.provider_id IS NOT DISTINCT FROM v_actor_provider_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.mm_appointments
  SET
    status = 'canceled',
    canceled_at = now(),
    canceled_by = v_actor_id,
    idempotency_key = v_idempotency_key,
    updated_at = now()
  WHERE id = v_appointment_id
  RETURNING * INTO v_updated;

  IF v_existing.schedule_event_id IS NOT NULL THEN
    UPDATE public.mm_schedule_events
    SET reserved_count = greatest(0, reserved_count - 1)
    WHERE id = v_existing.schedule_event_id;
  END IF;

  INSERT INTO public.mm_appointment_audit_log (
    entity_type,
    entity_id,
    action,
    actor_type,
    actor_id,
    actor_wp_user_id,
    idempotency_key,
    before_json,
    after_json,
    metadata
  )
  VALUES (
    'appointment',
    v_updated.id,
    'appointment.canceled',
    v_actor_type,
    v_actor_id,
    v_actor_wp_user_id,
    v_idempotency_key,
    to_jsonb(v_existing),
    to_jsonb(v_updated),
    jsonb_build_object('source', 'scheduler_rpc', 'reason', public.mm_scheduler_payload_text(p_payload, 'reason'))
  );

  INSERT INTO public.mm_appointment_notifications (
    appointment_id,
    channel,
    template_key,
    recipient_role,
    scheduled_at,
    status,
    idempotency_key,
    metadata
  )
  VALUES (
    v_updated.id,
    'email',
    'scheduler_cancellation_confirmation',
    'student',
    now(),
    'pending',
    v_idempotency_key || ':cancel_confirmation',
    jsonb_build_object('source', 'scheduler_rpc_placeholder')
  );

  v_result := jsonb_build_object(
    'ok', true,
    'action', 'cancel',
    'appointment_id', v_updated.id,
    'status', v_updated.status,
    'idempotency_key', v_idempotency_key,
    'idempotency_replay', false
  );
  PERFORM public.mm_scheduler_complete_idempotency(v_idempotency_key, v_result);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mm_scheduler_book_appointment(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mm_scheduler_reschedule_appointment(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mm_scheduler_cancel_appointment(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_scheduler_book_appointment(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mm_scheduler_reschedule_appointment(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mm_scheduler_cancel_appointment(jsonb) TO service_role;

COMMENT ON TABLE public.mm_appointments IS 'MissionMed Scheduler appointment source of truth. Mutations must be server-mediated through Railway; authenticated users only get scoped reads.';
COMMENT ON TABLE public.mm_appointment_private_notes IS 'Staff/provider private notes separated from student-readable appointment rows.';
COMMENT ON TABLE public.mm_appointment_audit_log IS 'Append-only audit log. Trigger blocks update/delete; service role should insert through Railway.';
COMMENT ON TABLE public.mm_scheduler_idempotency_keys IS 'Server-side mutation idempotency registry for booking, reschedule, cancel, admin override, and worker operations.';

COMMIT;
