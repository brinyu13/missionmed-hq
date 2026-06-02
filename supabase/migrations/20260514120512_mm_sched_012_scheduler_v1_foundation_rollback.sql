-- Migration: 20260514120512_mm_sched_012_scheduler_v1_foundation_rollback.sql
-- Target Worktree: /Users/brianb/MissionMed_worktrees/mm-sched-012-schema-api-foundation
-- Authority: MM-SCHED-012
-- Date: 2026-05-14
-- Depends on: 20260514120412_mm_sched_012_scheduler_v1_foundation.sql
-- Description: Draft rollback for MissionMed Scheduler V1/V1.5 foundation objects. Apply manually only if rollback is explicitly approved.
-- Idempotent: YES

BEGIN;

DROP TRIGGER IF EXISTS mm_appointment_audit_log_append_only ON public.mm_appointment_audit_log;
DROP TRIGGER IF EXISTS mm_schedule_providers_set_updated_at ON public.mm_schedule_providers;
DROP TRIGGER IF EXISTS mm_schedule_resources_set_updated_at ON public.mm_schedule_resources;
DROP TRIGGER IF EXISTS mm_appointment_types_set_updated_at ON public.mm_appointment_types;
DROP TRIGGER IF EXISTS mm_provider_appointment_types_set_updated_at ON public.mm_provider_appointment_types;
DROP TRIGGER IF EXISTS mm_availability_rules_set_updated_at ON public.mm_availability_rules;
DROP TRIGGER IF EXISTS mm_blackout_windows_set_updated_at ON public.mm_blackout_windows;
DROP TRIGGER IF EXISTS mm_schedule_events_set_updated_at ON public.mm_schedule_events;
DROP TRIGGER IF EXISTS mm_appointments_set_updated_at ON public.mm_appointments;
DROP TRIGGER IF EXISTS mm_appointments_set_blocked_range ON public.mm_appointments;
DROP TRIGGER IF EXISTS mm_appointment_private_notes_set_updated_at ON public.mm_appointment_private_notes;
DROP TRIGGER IF EXISTS mm_appointment_intake_fields_set_updated_at ON public.mm_appointment_intake_fields;
DROP TRIGGER IF EXISTS mm_appointment_intake_answers_set_updated_at ON public.mm_appointment_intake_answers;
DROP TRIGGER IF EXISTS mm_appointment_notifications_set_updated_at ON public.mm_appointment_notifications;
DROP TRIGGER IF EXISTS mm_calendar_connections_set_updated_at ON public.mm_calendar_connections;
DROP TRIGGER IF EXISTS mm_external_calendar_events_set_updated_at ON public.mm_external_calendar_events;
DROP TRIGGER IF EXISTS mm_scheduler_settings_set_updated_at ON public.mm_scheduler_settings;
DROP TRIGGER IF EXISTS mm_provider_assignment_rules_set_updated_at ON public.mm_provider_assignment_rules;
DROP TRIGGER IF EXISTS mm_appointment_type_eligibility_rules_set_updated_at ON public.mm_appointment_type_eligibility_rules;
DROP TRIGGER IF EXISTS mm_scheduler_idempotency_keys_set_updated_at ON public.mm_scheduler_idempotency_keys;

DROP FUNCTION IF EXISTS public.mm_scheduler_cancel_appointment(jsonb);
DROP FUNCTION IF EXISTS public.mm_scheduler_reschedule_appointment(jsonb);
DROP FUNCTION IF EXISTS public.mm_scheduler_book_appointment(jsonb);
DROP FUNCTION IF EXISTS public.mm_scheduler_actor_type(jsonb);
DROP FUNCTION IF EXISTS public.mm_scheduler_complete_idempotency(text, jsonb);
DROP FUNCTION IF EXISTS public.mm_scheduler_claim_idempotency(text, text, uuid, text, text);
DROP FUNCTION IF EXISTS public.mm_scheduler_payload_fingerprint(jsonb);
DROP FUNCTION IF EXISTS public.mm_scheduler_payload_timestamptz(jsonb, text, text[]);
DROP FUNCTION IF EXISTS public.mm_scheduler_payload_uuid(jsonb, text, text[]);
DROP FUNCTION IF EXISTS public.mm_scheduler_payload_text(jsonb, text[]);

DROP TABLE IF EXISTS public.mm_scheduler_idempotency_keys;
DROP TABLE IF EXISTS public.mm_appointment_type_eligibility_rules;
DROP TABLE IF EXISTS public.mm_provider_assignment_rules;
DROP TABLE IF EXISTS public.mm_scheduler_settings;
DROP TABLE IF EXISTS public.mm_external_calendar_events;
DROP TABLE IF EXISTS public.mm_calendar_connections;
DROP TABLE IF EXISTS public.mm_appointment_audit_log;
DROP TABLE IF EXISTS public.mm_appointment_notifications;
DROP TABLE IF EXISTS public.mm_appointment_intake_answers;
DROP TABLE IF EXISTS public.mm_appointment_intake_fields;
DROP TABLE IF EXISTS public.mm_appointment_private_notes;
DROP TABLE IF EXISTS public.mm_appointments;
DROP TABLE IF EXISTS public.mm_schedule_events;
DROP TABLE IF EXISTS public.mm_blackout_windows;
DROP TABLE IF EXISTS public.mm_availability_rules;
DROP TABLE IF EXISTS public.mm_provider_appointment_types;
DROP TABLE IF EXISTS public.mm_appointment_types;
DROP TABLE IF EXISTS public.mm_schedule_resources;
DROP TABLE IF EXISTS public.mm_schedule_providers;

DROP FUNCTION IF EXISTS public.mm_scheduler_provider_id_for_auth();
DROP FUNCTION IF EXISTS public.mm_scheduler_set_appointment_blocked_range();
DROP FUNCTION IF EXISTS public.mm_scheduler_prevent_audit_mutation();
DROP FUNCTION IF EXISTS public.mm_scheduler_set_updated_at();
DROP FUNCTION IF EXISTS public.mm_scheduler_is_admin();
DROP FUNCTION IF EXISTS public.mm_scheduler_jwt();

-- Extensions are intentionally not dropped because pgcrypto and btree_gist may be shared.

COMMIT;
