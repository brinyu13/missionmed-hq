-- Migration: 20260715193955_i1q_1008a_runtime_reapply.sql
-- Ticket: I1Q-1008A
-- Authority: MissionMed OS DR-006; MR-078A; MR-078B
-- Target: RANKLISTIQ preview or staging only; additive schema i1q
-- Date: 2026-07-15
-- Depends on: 20260715193845_i1q_1008a_compensating_disable.sql
-- Dependencies: roles authenticated, i1q_identity_profile_reader, and i1q_app_runtime; i1q.resolve_current_identity(); i1q.assert_1008a_role_contract(boolean); all I1Q feature flags disabled
-- Description: Reapplies only the reviewed I1Q identity capability after compensation while keeping every behavior and release flag disabled.
-- Idempotent: YES
-- Risk: MEDIUM; restores authenticated identity resolution only and does not enable platform, review, consumer, or publication behavior.
-- Rollback/Compensation: Reapply 20260715193845_i1q_1008a_compensating_disable.sql through a new forward compensation version if another rollback is required.

BEGIN;

DO $reapply_guard$
DECLARE
  identity_role pg_catalog.pg_roles%ROWTYPE;
  app_runtime_role pg_catalog.pg_roles%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM i1q.schema_versions version
     WHERE version.version = '20260715193625'
       AND version.target_project = 'RANKLISTIQ'
  ) OR NOT EXISTS (
    SELECT 1
      FROM i1q.schema_versions version
     WHERE version.version = '20260715193845'
       AND version.target_project = 'RANKLISTIQ'
  ) THEN
    RAISE EXCEPTION 'i1q_1008a_compensation_history_required'
      USING ERRCODE = '55000';
  END IF;

  SELECT * INTO identity_role
    FROM pg_catalog.pg_roles
   WHERE rolname = 'i1q_identity_profile_reader';
  SELECT * INTO app_runtime_role
    FROM pg_catalog.pg_roles
   WHERE rolname = 'i1q_app_runtime';
  IF identity_role.rolname IS NULL
     OR identity_role.rolcanlogin
     OR identity_role.rolinherit
     OR identity_role.rolsuper
     OR identity_role.rolcreatedb
     OR identity_role.rolcreaterole
     OR identity_role.rolreplication
     OR identity_role.rolbypassrls
     OR app_runtime_role.rolname IS NULL
     OR app_runtime_role.rolcanlogin
     OR app_runtime_role.rolinherit
     OR app_runtime_role.rolsuper
     OR app_runtime_role.rolcreatedb
     OR app_runtime_role.rolcreaterole
     OR app_runtime_role.rolreplication
     OR app_runtime_role.rolbypassrls
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')
     OR pg_catalog.to_regprocedure('i1q.resolve_current_identity()') IS NULL
     OR pg_catalog.to_regprocedure('i1q.assert_1008a_role_contract(boolean)') IS NULL THEN
    RAISE EXCEPTION 'i1q_1008a_runtime_contract_not_safe_to_reapply'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (SELECT 1 FROM i1q.feature_flags flag WHERE flag.enabled) THEN
    RAISE EXCEPTION 'i1q_1008a_reapply_requires_all_flags_off'
      USING ERRCODE = '55000';
  END IF;
END
$reapply_guard$;

REVOKE ALL ON FUNCTION i1q.resolve_current_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION i1q.resolve_current_identity() FROM anon;
REVOKE ALL ON FUNCTION i1q.resolve_current_identity() FROM authenticated;
GRANT USAGE ON SCHEMA i1q TO i1q_identity_profile_reader;
GRANT EXECUTE ON FUNCTION i1q.resolve_current_identity() TO i1q_identity_profile_reader;
GRANT i1q_identity_profile_reader TO authenticated;

SELECT i1q.assert_1008a_role_contract(true);

INSERT INTO i1q.schema_versions (version, migration_filename, authority, target_project)
VALUES (
  '20260715193955',
  '20260715193955_i1q_1008a_runtime_reapply.sql',
  'I1Q-1008A; DR-006; MR-078A; MR-078B',
  'RANKLISTIQ'
)
ON CONFLICT (version) DO NOTHING;

DO $reapply_audit$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM i1q.audit_events event
     WHERE event.action = 'identity_runtime_contract_reapplied'
       AND event.entity_type = 'schema_version'
       AND event.entity_id = '20260715193955'
  ) THEN
    PERFORM i1q.append_audit_event(
      'identity_runtime_contract_reapplied',
      'schema_version',
      '20260715193955',
      pg_catalog.jsonb_build_object(
        'identity_contract_version', 'i1q.identity.v1',
        'identity_capability_role', 'i1q_identity_profile_reader',
        'application_runtime_role', 'i1q_app_runtime',
        'application_runtime_grants', 'deny_all_pending_target_authority',
        'all_feature_flags_off', true,
        'data_preserved', true,
        'history_preserved', true
      )
    );
  END IF;
END
$reapply_audit$;

COMMIT;
