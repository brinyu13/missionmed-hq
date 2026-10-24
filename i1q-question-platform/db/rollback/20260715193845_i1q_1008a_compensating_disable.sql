-- Migration: 20260715193845_i1q_1008a_compensating_disable.sql
-- Ticket: I1Q-1008A
-- Authority: MissionMed OS DR-006; MR-078A; MR-078B
-- Target: RANKLISTIQ preview or staging only; additive schema i1q
-- Date: 2026-07-15
-- Depends on: 20260715193625_i1q_1008a_identity_runtime_contract.sql
-- Dependencies: i1q.disable_i1q_behavior(text, text), i1q.assert_1008a_role_contract(boolean), roles authenticated, i1q_identity_profile_reader, and i1q_app_runtime
-- Description: Disables every I1Q flag and removes the authenticated identity-profile capability while preserving all records and schema objects.
-- Idempotent: YES
-- Risk: LOW; authenticated I1Q access is intentionally disabled and retained data remains unchanged.
-- Rollback/Compensation: Forward-only compensation. Re-enable only with the later reviewed 1008A reapplication migration.

BEGIN;

DO $dependency_guard$
BEGIN
  IF pg_catalog.to_regprocedure('i1q.disable_i1q_behavior(text,text)') IS NULL
     OR pg_catalog.to_regprocedure('i1q.assert_1008a_role_contract(boolean)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'i1q_identity_profile_reader')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'i1q_app_runtime')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'i1q_1008a_compensation_dependency_missing'
      USING ERRCODE = '55000';
  END IF;
END
$dependency_guard$;

REVOKE i1q_identity_profile_reader FROM authenticated;
REVOKE ALL ON SCHEMA i1q FROM i1q_identity_profile_reader, i1q_app_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA i1q FROM i1q_identity_profile_reader, i1q_app_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA i1q FROM i1q_identity_profile_reader, i1q_app_runtime;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA i1q FROM i1q_identity_profile_reader, i1q_app_runtime;

SELECT i1q.assert_1008a_role_contract(false);

SELECT i1q.disable_i1q_behavior(
  '20260715193845',
  'I1Q-1008A preview or staging compensation; disable identity capability and preserve all data and immutable history'
);

INSERT INTO i1q.schema_versions (version, migration_filename, authority, target_project)
VALUES (
  '20260715193845',
  '20260715193845_i1q_1008a_compensating_disable.sql',
  'I1Q-1008A; DR-006; MR-078A; MR-078B',
  'RANKLISTIQ'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
