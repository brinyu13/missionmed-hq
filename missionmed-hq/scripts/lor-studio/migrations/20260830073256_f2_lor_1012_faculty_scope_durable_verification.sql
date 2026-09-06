-- Migration: 20260830073256_f2_lor_1012_faculty_scope_durable_verification.sql
-- Authority: F2-LOR-1012 / DR-120 / DR-133 / DR-140
-- Date: 2026-08-30
-- Depends on: 20260826011900_f2_lor_1012_live_production_private_storage_object_id_regex.sql
-- Description: Keep a faculty case authorization durable after a successfully used
-- one-time OTP expires, while preserving invitation-use, revocation, actor, case,
-- student, and faculty bindings.
-- Exact target: MissionMed Railway project 29afe885 / production environment ed3353f7 / Postgres service 576520f5
-- Idempotent: NO

BEGIN;

DO $identity_guard$
DECLARE
  database_name text := pg_catalog.current_database();
  target_provider text := pg_catalog.current_setting('missionmed.lor.target_provider', true);
  target_deployment_environment text := pg_catalog.current_setting('missionmed.lor.target_deployment_environment', true);
  target_migration_ledger text := pg_catalog.current_setting('missionmed.lor.target_migration_ledger', true);
  target_project_id text := pg_catalog.current_setting('missionmed.lor.target_project_id', true);
  target_environment_id text := pg_catalog.current_setting('missionmed.lor.target_environment_id', true);
  target_service_id text := pg_catalog.current_setting('missionmed.lor.target_service_id', true);
  target_database_name text := pg_catalog.current_setting('missionmed.lor.target_database_name', true);
  target_region text := pg_catalog.current_setting('missionmed.lor.target_region', true);
  target_decision_record text := pg_catalog.current_setting('missionmed.lor.target_decision_record', true);
  target_data_copied text := pg_catalog.current_setting('missionmed.lor.target_data_copied', true);
  target_identity_text text;
  expected_sentinel text;
  observed_sentinel text;
  database_owner name;
  schema_owner name;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(database.datdba)
  INTO database_owner
  FROM pg_catalog.pg_database AS database
  WHERE database.datname = database_name;

  SELECT
    pg_catalog.pg_get_userbyid(namespace.nspowner),
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO schema_owner, observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';

  target_identity_text := pg_catalog.concat_ws('|',
    target_provider,
    target_project_id,
    target_environment_id,
    target_service_id,
    target_database_name,
    target_region,
    target_decision_record,
    target_data_copied
  );

  expected_sentinel := pg_catalog.format(
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000|identityScope=20260826010300|facultyInvitationCommands=20260826010500|facultyPrivateExportCommands=20260826010700|aiProposalCommands=20260826010900|studentEvidenceCommands=20260826011100|encryptedPrivateStorage=20260826011300|facultyCandidateAuthHandoff=20260826011500|mentorAssignmentCommands=20260826011700|privateStorageObjectIdRegex=20260826011900',
    target_provider,
    target_project_id,
    target_environment_id,
    target_service_id,
    target_database_name,
    current_user,
    target_region,
    target_decision_record,
    target_data_copied
  );

  IF pg_catalog.current_setting('server_version_num')::integer / 10000 NOT IN (16, 18)
    OR target_identity_text LIKE '%mftguikkftmrxjxrkdln%'
    OR target_identity_text LIKE '%fglyvdykwgbuivikqoah%'
    OR target_deployment_environment IS DISTINCT FROM 'production'
    OR target_migration_ledger IS DISTINCT FROM 'lor_studio/migrations/production'
    OR target_provider IS DISTINCT FROM 'railway-postgres'
    OR target_project_id IS DISTINCT FROM '29afe885-b9b1-425d-8fd8-8611cd275409'
    OR target_environment_id IS DISTINCT FROM 'ed3353f7-bcc7-4e25-a000-3c9fc628a9a7'
    OR target_service_id IS DISTINCT FROM '576520f5-a702-4343-a277-decdeeed57f6'
    OR target_database_name IS DISTINCT FROM 'railway'
    OR target_database_name IS DISTINCT FROM database_name
    OR target_region IS DISTINCT FROM 'us-west2'
    OR target_decision_record IS DISTINCT FROM 'DR-133'
    OR target_data_copied IS DISTINCT FROM 'false'
    OR current_user IS DISTINCT FROM 'postgres'
    OR session_user IS DISTINCT FROM current_user
    OR database_owner IS DISTINCT FROM current_user
    OR schema_owner IS DISTINCT FROM current_user
    OR pg_catalog.inet_server_addr() IS NULL
    OR NOT (
      pg_catalog.inet_server_addr() << pg_catalog.inet '127.0.0.0/8'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '::1/128'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '172.16.0.0/12'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '192.168.0.0/16'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '100.64.0.0/10'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet 'fc00::/7'
    )
    OR pg_catalog.current_setting('ssl') IS DISTINCT FROM 'on'
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_stat_ssl AS ssl_session
      WHERE ssl_session.pid = pg_catalog.pg_backend_pid()
        AND ssl_session.ssl
    )
    OR observed_sentinel IS DISTINCT FROM expected_sentinel
  THEN
    RAISE EXCEPTION 'DR-133 faculty-scope repair requires the exact successor-bound private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.faculty_otp_proof_revocations
IN SHARE MODE;

DO $catalog_preflight$
DECLARE
  function_count bigint;
  function_source_hash text;
  public_execute_count bigint;
BEGIN
  SELECT
    pg_catalog.count(*),
    pg_catalog.max(pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(procedure.prosrc, 'UTF8')),
      'hex'
    ))
  INTO function_count, function_source_hash
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE procedure.oid = pg_catalog.to_regprocedure(
    'lor_studio.resolve_faculty_case_scope(text,text,text)'
  )::oid
    AND namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner'
    AND procedure.proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]
    AND pg_catalog.has_function_privilege(
      'lor_studio_app',
      procedure.oid,
      'EXECUTE'
    );

  SELECT pg_catalog.count(*) INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE procedure.oid = pg_catalog.to_regprocedure(
    'lor_studio.resolve_faculty_case_scope(text,text,text)'
  )::oid
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  IF function_count IS DISTINCT FROM 1
    OR function_source_hash IS DISTINCT FROM
      '64914c2f1293644c1da045e0ae8bc6ca61ed80cd835aea882a9fdb3426b055ea'
    OR public_execute_count <> 0
  THEN
    RAISE EXCEPTION 'DR-133 faculty-scope repair predecessor custody mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_preflight$;

CREATE OR REPLACE FUNCTION lor_studio.resolve_faculty_case_scope(
  candidate_faculty_subject text,
  candidate_case_id text,
  candidate_operation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $faculty_scope$
DECLARE
  eligible_count bigint;
  resolved_invitation_id text;
  resolved_student_subject text;
  resolved_faculty_uid uuid;
BEGIN
  IF candidate_faculty_subject !~ '^wp:[1-9][0-9]*$'
    OR pg_catalog.length(candidate_faculty_subject) > 200
    OR candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_operation <> ALL (ARRAY['read', 'save']::text[])
  THEN
    RAISE EXCEPTION 'LOR_SCOPE_INPUT_INVALID' USING ERRCODE = 'P1205';
  END IF;

  IF pg_catalog.current_setting('lor_studio.case_id', true) IS DISTINCT FROM candidate_case_id
    OR pg_catalog.current_setting('lor_studio.operation', true) IS DISTINCT FROM candidate_operation
    OR NOT lor_studio.actor_scope_resolution_context_allows(
      candidate_faculty_subject,
      'faculty',
      ARRAY['read', 'save']::text[],
      'faculty_scope_resolution'
    )
  THEN
    RAISE EXCEPTION 'LOR_SCOPE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1201';
  END IF;

  WITH eligible AS (
    SELECT DISTINCT
      invitation.invitation_id,
      invitation.student_auth_subject,
      invitation.faculty_auth_uid
    FROM lor_studio.faculty_invitations AS invitation
    JOIN lor_studio.faculty_otp_verification_receipts AS verification
      ON verification.invitation_id = invitation.invitation_id
      AND verification.case_id = invitation.case_id
      AND verification.student_auth_subject = invitation.student_auth_subject
      AND verification.faculty_auth_subject = invitation.faculty_auth_subject
      AND verification.faculty_auth_uid = invitation.faculty_auth_uid
      AND verification.invitation_used_at = invitation.used_at
    WHERE invitation.case_id = candidate_case_id
      AND invitation.faculty_auth_subject = candidate_faculty_subject
      AND pg_catalog.length(invitation.student_auth_subject) <= 200
      AND invitation.used_at IS NOT NULL
      AND invitation.revoked_at IS NULL
      AND invitation.used_at < invitation.expires_at
      AND verification.otp_revoked IS FALSE
      AND verification.otp_verified_at <= verification.invitation_used_at
      AND verification.invitation_used_at < verification.otp_expires_at
      AND NOT EXISTS (
        SELECT 1
        FROM lor_studio.faculty_otp_proof_revocations AS revocation
        WHERE revocation.receipt_id = verification.receipt_id
          AND revocation.case_id = verification.case_id
          AND revocation.student_auth_subject = verification.student_auth_subject
      )
  )
  SELECT
    pg_catalog.count(*),
    pg_catalog.min(eligible.invitation_id),
    pg_catalog.min(eligible.student_auth_subject),
    pg_catalog.min(eligible.faculty_auth_uid::text)::uuid
  INTO eligible_count, resolved_invitation_id, resolved_student_subject, resolved_faculty_uid
  FROM eligible;

  IF eligible_count = 0 THEN
    RETURN NULL;
  END IF;
  IF eligible_count <> 1 THEN
    RAISE EXCEPTION 'LOR_SCOPE_AMBIGUOUS' USING ERRCODE = 'P1202';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.server-query-scope.v1',
    'authoritySource', 'server_verified_session_crosswalk',
    'authenticated', true,
    'roleVerified', true,
    'authUid', resolved_faculty_uid::text,
    'authenticatedSubject', candidate_faculty_subject,
    'actorId', candidate_faculty_subject,
    'actorRole', 'faculty',
    'resourceStudentId', resolved_student_subject,
    'caseId', candidate_case_id,
    'operation', candidate_operation,
    'purpose', 'faculty_private_edit',
    'assignmentId', NULL,
    'invitationId', resolved_invitation_id,
    'administrativeGrantId', NULL,
    'entitlementVerified', true,
    'lorEnabled', true,
    'canaryAuthorized', true
  );
EXCEPTION
  WHEN SQLSTATE 'P1201' OR SQLSTATE 'P1202' OR SQLSTATE 'P1205' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_SCOPE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1201';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_SCOPE_RESOLUTION_INVALID' USING ERRCODE = 'P1205';
END;
$faculty_scope$;

REVOKE ALL ON FUNCTION lor_studio.resolve_faculty_case_scope(text, text, text) FROM PUBLIC;
ALTER FUNCTION lor_studio.resolve_faculty_case_scope(text, text, text)
OWNER TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.resolve_faculty_case_scope(text, text, text)
TO lor_studio_app;

DO $catalog_postflight$
DECLARE
  function_count bigint;
  function_source text;
  function_source_hash text;
  public_execute_count bigint;
BEGIN
  SELECT
    pg_catalog.count(*),
    pg_catalog.max(procedure.prosrc),
    pg_catalog.max(pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(procedure.prosrc, 'UTF8')),
      'hex'
    ))
  INTO function_count, function_source, function_source_hash
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE procedure.oid = pg_catalog.to_regprocedure(
    'lor_studio.resolve_faculty_case_scope(text,text,text)'
  )::oid
    AND namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner'
    AND procedure.proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]
    AND pg_catalog.has_function_privilege(
      'lor_studio_app',
      procedure.oid,
      'EXECUTE'
    );

  SELECT pg_catalog.count(*) INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE procedure.oid = pg_catalog.to_regprocedure(
    'lor_studio.resolve_faculty_case_scope(text,text,text)'
  )::oid
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  IF function_count IS DISTINCT FROM 1
    OR function_source_hash IS DISTINCT FROM
      '29468d5e551725d858b0d64c5f0bd89083a6599a549dd4cfdefc376535f7c45a'
    OR pg_catalog.strpos(
      function_source,
      'invitation.expires_at > pg_catalog.statement_timestamp()'
    ) <> 0
    OR pg_catalog.strpos(
      function_source,
      'verification.otp_expires_at > pg_catalog.statement_timestamp()'
    ) <> 0
    OR pg_catalog.strpos(
      function_source,
      'verification.otp_verified_at <= verification.invitation_used_at'
    ) = 0
    OR pg_catalog.strpos(
      function_source,
      'verification.invitation_used_at < verification.otp_expires_at'
    ) = 0
    OR public_execute_count <> 0
  THEN
    RAISE EXCEPTION 'DR-133 faculty-scope repair postflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_postflight$;

DO $advance_sentinel$
DECLARE observed_sentinel text;
BEGIN
  SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO STRICT observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';

  EXECUTE pg_catalog.format(
    'COMMENT ON SCHEMA lor_studio IS %L',
    observed_sentinel || '|facultyScopeDurableVerification=20260830073256'
  );
END
$advance_sentinel$;

COMMIT;
