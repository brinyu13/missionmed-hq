-- Isolated rehearsal only. Production rollback leaves migration 008 dormant.

BEGIN;

DROP TRIGGER IF EXISTS rise_research_control_audit_immutable ON rise_runtime.research_control_audit_events;
DROP TRIGGER IF EXISTS rise_research_attempts_immutable ON rise_runtime.research_job_attempts;
DROP TABLE IF EXISTS rise_runtime.research_control_audit_events;
DROP TABLE IF EXISTS rise_runtime.research_job_attempts;
DROP TABLE IF EXISTS rise_runtime.research_jobs;
DROP TABLE IF EXISTS rise_runtime.research_quota_ledgers;
DROP TABLE IF EXISTS rise_runtime.research_router_settings;
DROP TABLE IF EXISTS rise_runtime.research_provider_routes;
DROP FUNCTION IF EXISTS rise_runtime.reject_research_audit_mutation();

COMMIT;
