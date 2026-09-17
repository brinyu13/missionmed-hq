-- Migration: 20260715193625_i1q_1008a_identity_runtime_contract.sql
-- Ticket: I1Q-1008A
-- Authority: MissionMed OS DR-006; MR-078A; MR-078B
-- Target: RANKLISTIQ preview or staging only; additive schema i1q
-- Date: 2026-07-15
-- Depends on: 20260715122434_i1q_1007x_question_platform.sql
-- Dependencies: PostgreSQL 15+, auth.uid(), roles anon, authenticated, and migration owner
-- Description: Adds separate deny-by-default app-runtime and browser-safe identity-capability roles, the current-identity RPC, and locked-off 1008A feature flags.
-- Idempotent: YES
-- Risk: HIGH; preview or staging application only after project pin, backup, and MR-078A checks pass.
-- Rollback/Compensation: Apply the later I1Q-1008A forward compensation migration; never drop the schema or rewrite history.

BEGIN;

DO $dependency_guard$
BEGIN
  IF pg_catalog.to_regclass('i1q.schema_versions') IS NULL
     OR NOT EXISTS (
       SELECT 1
         FROM i1q.schema_versions version
        WHERE version.version = '20260715122434'
          AND version.target_project = 'RANKLISTIQ'
     ) THEN
    RAISE EXCEPTION 'i1q_1008a_base_migration_required'
      USING ERRCODE = '55000';
  END IF;
  IF pg_catalog.to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'i1q_auth_uid_dependency_missing'
      USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'i1q_authenticated_role_dependency_missing'
      USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    RAISE EXCEPTION 'i1q_anon_role_dependency_missing'
      USING ERRCODE = '55000';
  END IF;
END
$dependency_guard$;

DO $identity_capability_role$
DECLARE
  existing_role pg_catalog.pg_roles%ROWTYPE;
BEGIN
  SELECT * INTO existing_role
    FROM pg_catalog.pg_roles
   WHERE rolname = 'i1q_identity_profile_reader';

  IF existing_role.rolname IS NULL THEN
    CREATE ROLE i1q_identity_profile_reader
      NOLOGIN
      NOINHERIT
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  ELSIF existing_role.rolcanlogin
     OR existing_role.rolinherit
     OR existing_role.rolsuper
     OR existing_role.rolcreatedb
     OR existing_role.rolcreaterole
     OR existing_role.rolreplication
     OR existing_role.rolbypassrls THEN
    RAISE EXCEPTION 'i1q_identity_profile_role_is_not_unprivileged'
      USING ERRCODE = '55000';
  END IF;
END
$identity_capability_role$;

DO $application_runtime_role$
DECLARE
  existing_role pg_catalog.pg_roles%ROWTYPE;
BEGIN
  SELECT * INTO existing_role
    FROM pg_catalog.pg_roles
   WHERE rolname = 'i1q_app_runtime';

  IF existing_role.rolname IS NULL THEN
    CREATE ROLE i1q_app_runtime
      NOLOGIN
      NOINHERIT
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  ELSIF existing_role.rolcanlogin
     OR existing_role.rolinherit
     OR existing_role.rolsuper
     OR existing_role.rolcreatedb
     OR existing_role.rolcreaterole
     OR existing_role.rolreplication
     OR existing_role.rolbypassrls THEN
    RAISE EXCEPTION 'i1q_app_runtime_role_is_not_unprivileged'
      USING ERRCODE = '55000';
  END IF;
END
$application_runtime_role$;

DO $preexisting_safety_flag_guard$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM i1q.feature_flags flag
     WHERE flag.key IN (
       'transcript_batch_extraction_enabled',
       'physician_approval_enabled',
       'public_access_enabled',
       'automated_release_publication_enabled'
     )
       AND flag.enabled
  ) THEN
    RAISE EXCEPTION 'i1q_1008a_preexisting_safety_flag_enabled'
      USING ERRCODE = '55000';
  END IF;
END
$preexisting_safety_flag_guard$;

INSERT INTO i1q.feature_flags (id, key, enabled, changed_by_authority)
VALUES
  ('flag_transcript_batch_extraction', 'transcript_batch_extraction_enabled', false, 'migration:I1Q-1008A'),
  ('flag_physician_approval', 'physician_approval_enabled', false, 'migration:I1Q-1008A'),
  ('flag_public_access', 'public_access_enabled', false, 'migration:I1Q-1008A'),
  ('flag_automated_release_publication', 'automated_release_publication_enabled', false, 'migration:I1Q-1008A')
ON CONFLICT (key) DO NOTHING;

DO $safety_flag_invariant$
BEGIN
  IF (
    SELECT pg_catalog.count(*)
      FROM i1q.feature_flags flag
     WHERE flag.key IN (
       'transcript_batch_extraction_enabled',
       'physician_approval_enabled',
       'public_access_enabled',
       'automated_release_publication_enabled'
     )
       AND NOT flag.enabled
  ) <> 4 THEN
    RAISE EXCEPTION 'i1q_1008a_safety_flag_invariant_failed'
      USING ERRCODE = '55000';
  END IF;
END
$safety_flag_invariant$;

CREATE OR REPLACE FUNCTION i1q.resolve_current_identity()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  actor uuid := i1q.current_actor_id();
  active_memberships jsonb;
  membership_count integer;
  reviewer_credential_status text;
  reviewer_credential_verification_id text;
  reviewer_credential_expires_at timestamptz;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'authenticated_actor_required'
      USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.count(*),
         COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'name', membership.role_name,
               'valid_from', membership.valid_from,
               'valid_until', membership.valid_until,
               'revoked_at', membership.revoked_at
             ) ORDER BY membership.role_name
           ) FILTER (
             WHERE membership.revoked_at IS NULL
               AND membership.valid_from <= pg_catalog.clock_timestamp()
               AND (membership.valid_until IS NULL OR membership.valid_until > pg_catalog.clock_timestamp())
           ),
           '[]'::jsonb
         )
    INTO membership_count, active_memberships
    FROM i1q.actor_role_memberships membership
   WHERE membership.actor_id = actor;

  SELECT reviewer.credential_status,
         reviewer.credential_verification_id,
         reviewer.credential_expires_at
    INTO reviewer_credential_status,
         reviewer_credential_verification_id,
         reviewer_credential_expires_at
    FROM i1q.reviewers reviewer
   WHERE reviewer.actor_id = actor
     AND reviewer.active;

  RETURN pg_catalog.jsonb_build_object(
    'identity_contract_version', 'i1q.identity.v1',
    'actor_id', actor,
    'active', pg_catalog.jsonb_array_length(active_memberships) > 0,
    'revoked', membership_count > 0 AND pg_catalog.jsonb_array_length(active_memberships) = 0,
    'memberships', active_memberships,
    'credential_status', COALESCE(reviewer_credential_status, 'not_applicable'),
    'credential_verification_id', reviewer_credential_verification_id,
    'credential_expires_at', reviewer_credential_expires_at
  );
END
$function$;

CREATE OR REPLACE FUNCTION i1q.assert_1008a_role_contract(expected_identity_membership boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, i1q
AS $role_contract$
DECLARE
  identity_role_oid oid := (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'i1q_identity_profile_reader');
  app_runtime_role_oid oid := (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'i1q_app_runtime');
  authenticated_role_oid oid := (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated');
  identity_function_oid oid := pg_catalog.to_regprocedure('i1q.resolve_current_identity()');
  actual_identity_membership boolean;
BEGIN
  IF identity_role_oid IS NULL OR app_runtime_role_oid IS NULL
     OR authenticated_role_oid IS NULL OR identity_function_oid IS NULL THEN
    RAISE EXCEPTION 'i1q_1008a_role_contract_dependency_missing'
      USING ERRCODE = '55000';
  END IF;

  actual_identity_membership := EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members membership
     WHERE membership.roleid = identity_role_oid
       AND membership.member = authenticated_role_oid
       AND NOT membership.admin_option
  );
  IF actual_identity_membership IS DISTINCT FROM expected_identity_membership
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_auth_members membership
        WHERE membership.roleid = identity_role_oid
          AND (membership.member <> authenticated_role_oid OR membership.admin_option)
     )
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_auth_members membership
        WHERE membership.roleid = app_runtime_role_oid
           OR membership.member IN (identity_role_oid, app_runtime_role_oid)
     ) THEN
    RAISE EXCEPTION 'i1q_1008a_role_membership_graph_invalid'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace namespace
     WHERE namespace.nspowner IN (identity_role_oid, app_runtime_role_oid)
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_class relation
     WHERE relation.relowner IN (identity_role_oid, app_runtime_role_oid)
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc procedure
     WHERE procedure.proowner IN (identity_role_oid, app_runtime_role_oid)
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_type type_record
     WHERE type_record.typowner IN (identity_role_oid, app_runtime_role_oid)
  ) THEN
    RAISE EXCEPTION 'i1q_1008a_role_ownership_invalid'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_class relation
      CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) privilege
     WHERE relation.relacl IS NOT NULL
       AND privilege.grantee IN (identity_role_oid, app_runtime_role_oid)
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.pg_database database_record
      CROSS JOIN LATERAL pg_catalog.aclexplode(database_record.datacl) privilege
     WHERE database_record.datacl IS NOT NULL
       AND privilege.grantee IN (identity_role_oid, app_runtime_role_oid)
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.pg_type type_record
      CROSS JOIN LATERAL pg_catalog.aclexplode(type_record.typacl) privilege
     WHERE type_record.typacl IS NOT NULL
       AND privilege.grantee IN (identity_role_oid, app_runtime_role_oid)
  ) THEN
    RAISE EXCEPTION 'i1q_1008a_role_direct_privilege_invalid'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_namespace namespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) privilege
     WHERE namespace.nspacl IS NOT NULL
       AND (privilege.grantee = app_runtime_role_oid
        OR (
          privilege.grantee = identity_role_oid
          AND NOT (
            expected_identity_membership
            AND namespace.nspname = 'i1q'
            AND privilege.privilege_type = 'USAGE'
            AND NOT privilege.is_grantable
          )
        ))
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc procedure
      CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) privilege
     WHERE procedure.proacl IS NOT NULL
       AND (privilege.grantee = app_runtime_role_oid
        OR (
          privilege.grantee = identity_role_oid
          AND NOT (
            expected_identity_membership
            AND procedure.oid = identity_function_oid
            AND privilege.privilege_type = 'EXECUTE'
            AND NOT privilege.is_grantable
          )
        ))
  ) THEN
    RAISE EXCEPTION 'i1q_1008a_role_allowlist_invalid'
      USING ERRCODE = '55000';
  END IF;
END
$role_contract$;

REVOKE ALL ON FUNCTION i1q.resolve_current_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION i1q.resolve_current_identity() FROM anon;
REVOKE ALL ON FUNCTION i1q.resolve_current_identity() FROM authenticated;
GRANT USAGE ON SCHEMA i1q TO i1q_identity_profile_reader;
GRANT EXECUTE ON FUNCTION i1q.resolve_current_identity() TO i1q_identity_profile_reader;
GRANT i1q_identity_profile_reader TO authenticated;

REVOKE ALL ON FUNCTION i1q.assert_1008a_role_contract(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION i1q.assert_1008a_role_contract(boolean) FROM anon;
REVOKE ALL ON FUNCTION i1q.assert_1008a_role_contract(boolean) FROM authenticated;
REVOKE ALL ON FUNCTION i1q.assert_1008a_role_contract(boolean) FROM i1q_identity_profile_reader;
REVOKE ALL ON FUNCTION i1q.assert_1008a_role_contract(boolean) FROM i1q_app_runtime;

SELECT i1q.assert_1008a_role_contract(true);

INSERT INTO i1q.schema_versions (version, migration_filename, authority, target_project)
VALUES (
  '20260715193625',
  '20260715193625_i1q_1008a_identity_runtime_contract.sql',
  'I1Q-1008A; DR-006; MR-078A; MR-078B',
  'RANKLISTIQ'
)
ON CONFLICT (version) DO NOTHING;

COMMENT ON ROLE i1q_identity_profile_reader IS
  'NOLOGIN, NOINHERIT, NOBYPASSRLS capability role. It exposes only the caller-scoped identity profile RPC to authenticated Supabase users.';
COMMENT ON ROLE i1q_app_runtime IS
  'NOLOGIN, NOINHERIT, NOBYPASSRLS application role. It remains deny-all until exact staging grants and an actor binder are owner-approved.';
COMMENT ON FUNCTION i1q.resolve_current_identity() IS
  'Returns only the current auth.uid actor app memberships and credential status. Browser role claims are not inputs.';

DO $initial_audit$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM i1q.audit_events event
     WHERE event.action = 'identity_runtime_contract_initialized'
       AND event.entity_type = 'schema_version'
       AND event.entity_id = '20260715193625'
  ) THEN
    PERFORM i1q.append_audit_event(
      'identity_runtime_contract_initialized',
      'schema_version',
      '20260715193625',
      pg_catalog.jsonb_build_object(
        'identity_contract_version', 'i1q.identity.v1',
        'identity_capability_role', 'i1q_identity_profile_reader',
        'application_runtime_role', 'i1q_app_runtime',
        'application_runtime_grants', 'deny_all_pending_target_authority',
        'runtime_login', false,
        'runtime_inherit', false,
        'runtime_bypassrls', false,
        'all_release_flags_off', true
      )
    );
  END IF;
END
$initial_audit$;

COMMIT;
