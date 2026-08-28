-- P1-RISE-5007 recoverable application rollback.
-- Preserve every submission and audit record; remove runtime access so an older
-- application release cannot partially operate the new feature.

BEGIN;

REVOKE ALL ON rise_runtime.beta_notice_acknowledgments FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.student_intel_submitter_identities FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.student_intel_submissions FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.student_intel_sources FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.student_intel_moderation_events FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.student_intel_verification_runs FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.student_intel_corroborations FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.student_intel_canonical_promotions FROM rise_app_runtime;
REVOKE ALL ON SEQUENCE rise_runtime.student_intel_moderation_events_event_id_seq FROM rise_app_runtime;

COMMIT;
