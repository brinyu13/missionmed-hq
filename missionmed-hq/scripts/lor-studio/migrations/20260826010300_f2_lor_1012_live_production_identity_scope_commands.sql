-- Migration: 20260826010300_f2_lor_1012_live_production_identity_scope_commands.sql
-- Authority: F2-LOR-1012 / DR-133
-- Date: 2026-08-26
-- Depends on: 20260826010100_f2_lor_1012_live_production_rls_projection_grants.sql
-- Description: Add DB-owned WordPress identity bootstrap and actor-safe faculty/mentor scope resolution.
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
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000',
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
    RAISE EXCEPTION 'DR-133 identity/scope migration requires the exact sentinel-bound private Railway PostgreSQL target identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_proof_revocations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.mentor_case_assignment_revocations,
  lor_studio.mentor_case_assignments,
  lor_studio.student_auth_binding_revocations,
  lor_studio.student_auth_bindings
IN ACCESS EXCLUSIVE MODE;

DO $catalog_preflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  public_execute_count bigint;
  public_relation_acl_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO relation_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind = 'r';

  SELECT pg_catalog.count(*)
  INTO forced_rls_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind = 'r'
    AND class.relrowsecurity
    AND class.relforcerowsecurity;

  SELECT pg_catalog.count(*)
  INTO definer_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner';

  SELECT pg_catalog.count(*)
  INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  SELECT pg_catalog.count(*)
  INTO public_relation_acl_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind IN ('r', 'v')
    AND acl.grantee = 0;

  IF relation_count IS DISTINCT FROM 28
    OR forced_rls_count IS DISTINCT FROM 28
    OR definer_count IS DISTINCT FROM 8
    OR public_execute_count <> 0
    OR public_relation_acl_count <> 0
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = 'lor_studio_app'
        AND NOT rolsuper AND NOT rolinherit AND NOT rolcreaterole
        AND NOT rolcreatedb AND NOT rolcanlogin AND NOT rolreplication
        AND NOT rolbypassrls
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = 'lor_studio_command_owner'
        AND NOT rolsuper AND NOT rolinherit AND NOT rolcreaterole
        AND NOT rolcreatedb AND NOT rolcanlogin AND NOT rolreplication
        AND NOT rolbypassrls
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
      JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
      WHERE granted_role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
        OR member_role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'lor_studio'
        AND procedure.proname IN (
          'identity_bootstrap_context_allows',
          'actor_scope_resolution_context_allows',
          'ensure_student_auth_binding',
          'revoke_student_auth_binding',
          'resolve_faculty_case_scope',
          'resolve_mentor_case_scope'
        )
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND policy.polname IN (
          'student_auth_bindings_identity_command_select',
          'student_auth_bindings_identity_command_insert',
          'student_auth_binding_revocations_identity_command_select',
          'student_auth_binding_revocations_identity_command_insert',
          'faculty_invitations_scope_resolution_select',
          'faculty_otp_verification_scope_resolution_select',
          'faculty_otp_revocations_scope_resolution_select',
          'mentor_assignments_scope_resolution_select',
          'mentor_assignment_revocations_scope_resolution_select'
        )
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_command_owner', 'lor_studio.student_auth_bindings', 'INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_command_owner', 'lor_studio.student_auth_binding_revocations', 'INSERT'
    )
  THEN
    RAISE EXCEPTION 'DR-133 identity/scope migration preflight catalog mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_preflight$;

CREATE FUNCTION lor_studio.identity_bootstrap_context_allows(
  resource_subject text,
  allowed_operations text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    resource_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.length(resource_subject) <= 200
    AND pg_catalog.current_setting('transaction_isolation', true) = 'read committed'
    AND pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
    AND pg_catalog.current_setting('lor_studio.student_auth_subject', true) = resource_subject
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) = resource_subject
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (allowed_operations)
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'wordpress_verified_bootstrap'
    AND pg_catalog.current_setting('lor_studio.trusted_service_actor', true) = 'wordpress-admission-v2'
    AND pg_catalog.current_setting('lor_studio.identity_resolution_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true',
    false
  );
$$;

CREATE FUNCTION lor_studio.actor_scope_resolution_context_allows(
  actor_subject text,
  required_actor_role text,
  allowed_operations text[],
  required_purpose text
)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    actor_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.length(actor_subject) <= 200
    AND required_actor_role = ANY (ARRAY['faculty', 'mentor']::text[])
    AND pg_catalog.current_setting('transaction_isolation', true) = 'read committed'
    AND pg_catalog.current_setting('lor_studio.actor_role', true) = required_actor_role
    AND pg_catalog.current_setting('lor_studio.student_auth_subject', true) = actor_subject
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (allowed_operations)
    AND pg_catalog.current_setting('lor_studio.purpose', true) = required_purpose
    AND pg_catalog.current_setting('lor_studio.identity_resolution_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true',
    false
  );
$$;

CREATE POLICY student_auth_bindings_identity_command_select
ON lor_studio.student_auth_bindings
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.identity_bootstrap_context_allows(
  student_auth_subject,
  ARRAY['ensure_student_binding', 'revoke_student_binding']::text[]
));

CREATE POLICY student_auth_bindings_identity_command_insert
ON lor_studio.student_auth_bindings
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  binding_source = 'wordpress_verified_bootstrap'
  AND lor_studio.identity_bootstrap_context_allows(
    student_auth_subject,
    ARRAY['ensure_student_binding']::text[]
  )
);

CREATE POLICY student_auth_binding_revocations_identity_command_select
ON lor_studio.student_auth_binding_revocations
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.identity_bootstrap_context_allows(
  student_auth_subject,
  ARRAY['ensure_student_binding', 'revoke_student_binding']::text[]
));

CREATE POLICY student_auth_binding_revocations_identity_command_insert
ON lor_studio.student_auth_binding_revocations
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (lor_studio.identity_bootstrap_context_allows(
  student_auth_subject,
  ARRAY['revoke_student_binding']::text[]
));

CREATE POLICY faculty_invitations_scope_resolution_select
ON lor_studio.faculty_invitations
FOR SELECT
TO lor_studio_command_owner
USING (
  faculty_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND lor_studio.actor_scope_resolution_context_allows(
    faculty_auth_subject,
    'faculty',
    ARRAY['read', 'save']::text[],
    'faculty_scope_resolution'
  )
);

CREATE POLICY faculty_otp_verification_scope_resolution_select
ON lor_studio.faculty_otp_verification_receipts
FOR SELECT
TO lor_studio_command_owner
USING (
  faculty_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND lor_studio.actor_scope_resolution_context_allows(
    faculty_auth_subject,
    'faculty',
    ARRAY['read', 'save']::text[],
    'faculty_scope_resolution'
  )
);

CREATE POLICY faculty_otp_revocations_scope_resolution_select
ON lor_studio.faculty_otp_proof_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND lor_studio.actor_scope_resolution_context_allows(
    pg_catalog.current_setting('lor_studio.student_auth_subject', true),
    'faculty',
    ARRAY['read', 'save']::text[],
    'faculty_scope_resolution'
  )
);

CREATE POLICY mentor_assignments_scope_resolution_select
ON lor_studio.mentor_case_assignments
FOR SELECT
TO lor_studio_command_owner
USING (
  mentor_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND lor_studio.actor_scope_resolution_context_allows(
    mentor_auth_subject,
    'mentor',
    ARRAY['read']::text[],
    'mentor_scope_resolution'
  )
);

CREATE POLICY mentor_assignment_revocations_scope_resolution_select
ON lor_studio.mentor_case_assignment_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND lor_studio.actor_scope_resolution_context_allows(
    pg_catalog.current_setting('lor_studio.student_auth_subject', true),
    'mentor',
    ARRAY['read']::text[],
    'mentor_scope_resolution'
  )
);

GRANT INSERT ON TABLE
  lor_studio.student_auth_bindings,
  lor_studio.student_auth_binding_revocations
TO lor_studio_command_owner;

GRANT EXECUTE ON FUNCTION lor_studio.identity_bootstrap_context_allows(text, text[])
TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.actor_scope_resolution_context_allows(
  text, text, text[], text
) TO lor_studio_command_owner;

CREATE FUNCTION lor_studio.ensure_student_auth_binding(
  candidate_subject text,
  candidate_source_reference_hash text,
  candidate_proof_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $ensure_binding$
DECLARE
  existing_binding lor_studio.student_auth_bindings%ROWTYPE;
  canonical_uid uuid;
  candidate_binding_id text;
  active_count bigint;
  historical_count bigint;
  replayed boolean := false;
BEGIN
  IF candidate_subject !~ '^wp:[1-9][0-9]*$'
    OR pg_catalog.length(candidate_subject) > 200
    OR candidate_source_reference_hash !~ '^[a-f0-9]{64}$'
    OR candidate_proof_hash !~ '^[a-f0-9]{64}$'
  THEN
    RAISE EXCEPTION 'LOR_IDENTITY_INPUT_INVALID' USING ERRCODE = 'P1105';
  END IF;

  IF NOT lor_studio.identity_bootstrap_context_allows(
    candidate_subject,
    ARRAY['ensure_student_binding']::text[]
  ) THEN
    RAISE EXCEPTION 'LOR_IDENTITY_AUTHORIZATION_DENIED' USING ERRCODE = 'P1101';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      lor_studio.canonical_jsonb_text(pg_catalog.jsonb_build_array(
        'missionmed.lor.identity-binding-lock.v1', candidate_subject
      )),
      0
    )
  );

  SELECT pg_catalog.count(*)
  INTO active_count
  FROM lor_studio.student_auth_bindings AS binding
  WHERE binding.student_auth_subject = candidate_subject
    AND binding.bound_at <= pg_catalog.statement_timestamp()
    AND (binding.expires_at IS NULL OR binding.expires_at > pg_catalog.statement_timestamp())
    AND NOT EXISTS (
      SELECT 1
      FROM lor_studio.student_auth_binding_revocations AS revocation
      WHERE revocation.binding_id = binding.binding_id
        AND revocation.student_auth_subject = binding.student_auth_subject
        AND revocation.student_auth_uid = binding.student_auth_uid
    );

  IF active_count > 1 THEN
    RAISE EXCEPTION 'LOR_IDENTITY_CATALOG_AMBIGUOUS' USING ERRCODE = 'P1102';
  END IF;

  IF active_count = 1 THEN
    SELECT binding.*
    INTO STRICT existing_binding
    FROM lor_studio.student_auth_bindings AS binding
    WHERE binding.student_auth_subject = candidate_subject
      AND binding.bound_at <= pg_catalog.statement_timestamp()
      AND (binding.expires_at IS NULL OR binding.expires_at > pg_catalog.statement_timestamp())
      AND NOT EXISTS (
        SELECT 1
        FROM lor_studio.student_auth_binding_revocations AS revocation
        WHERE revocation.binding_id = binding.binding_id
          AND revocation.student_auth_subject = binding.student_auth_subject
          AND revocation.student_auth_uid = binding.student_auth_uid
      );

    IF existing_binding.binding_source IS DISTINCT FROM 'wordpress_verified_bootstrap'
      OR existing_binding.source_reference_hash IS DISTINCT FROM candidate_source_reference_hash
      OR existing_binding.proof_hash IS DISTINCT FROM candidate_proof_hash
    THEN
      RAISE EXCEPTION 'LOR_IDENTITY_BINDING_CONFLICT' USING ERRCODE = 'P1102';
    END IF;
    replayed := true;
  ELSE
    SELECT pg_catalog.count(*)
    INTO historical_count
    FROM lor_studio.student_auth_bindings AS binding
    WHERE binding.student_auth_subject = candidate_subject;

    IF historical_count <> 0 THEN
      RAISE EXCEPTION 'LOR_IDENTITY_REBIND_REQUIRES_SUCCESSOR_AUTHORITY'
        USING ERRCODE = 'P1102';
    END IF;

    -- The opaque database identity is generated once and persisted. It is not
    -- caller supplied and cannot be dictionary-mapped from the WordPress ID.
    canonical_uid := pg_catalog.gen_random_uuid();
    candidate_binding_id := 'binding_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.student-auth-binding.v1',
        'studentAuthSubject', candidate_subject,
        'studentAuthUid', canonical_uid::text,
        'bindingSource', 'wordpress_verified_bootstrap',
        'sourceReferenceHash', candidate_source_reference_hash,
        'proofHash', candidate_proof_hash
      )
    );

    INSERT INTO lor_studio.student_auth_bindings (
      binding_id,
      student_auth_subject,
      student_auth_uid,
      binding_source,
      source_reference_hash,
      proof_hash,
      bound_at,
      expires_at
    ) VALUES (
      candidate_binding_id,
      candidate_subject,
      canonical_uid,
      'wordpress_verified_bootstrap',
      candidate_source_reference_hash,
      candidate_proof_hash,
      pg_catalog.statement_timestamp(),
      NULL
    )
    RETURNING * INTO STRICT existing_binding;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.student-auth-binding-receipt.v1',
    'studentAuthSubject', existing_binding.student_auth_subject,
    'studentAuthUid', existing_binding.student_auth_uid::text,
    'bindingId', existing_binding.binding_id,
    'bindingSource', existing_binding.binding_source,
    'sourceReferenceHash', existing_binding.source_reference_hash,
    'boundAt', existing_binding.bound_at,
    'expiresAt', existing_binding.expires_at,
    'replayed', replayed
  );
EXCEPTION
  WHEN SQLSTATE 'P1101' OR SQLSTATE 'P1102' OR SQLSTATE 'P1105' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_IDENTITY_AUTHORIZATION_DENIED' USING ERRCODE = 'P1101';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_IDENTITY_COMMAND_INVALID' USING ERRCODE = 'P1105';
END;
$ensure_binding$;

CREATE FUNCTION lor_studio.revoke_student_auth_binding(
  candidate_subject text,
  candidate_reason_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $revoke_binding$
DECLARE
  existing_binding lor_studio.student_auth_bindings%ROWTYPE;
  existing_revocation lor_studio.student_auth_binding_revocations%ROWTYPE;
  authority_ref text;
  candidate_revocation_hash text;
  binding_count bigint;
  replayed boolean := false;
BEGIN
  IF candidate_subject !~ '^wp:[1-9][0-9]*$'
    OR pg_catalog.length(candidate_subject) > 200
    OR candidate_reason_code !~ '^[A-Z][A-Z0-9_]{1,99}$'
  THEN
    RAISE EXCEPTION 'LOR_IDENTITY_INPUT_INVALID' USING ERRCODE = 'P1105';
  END IF;

  IF NOT lor_studio.identity_bootstrap_context_allows(
    candidate_subject,
    ARRAY['revoke_student_binding']::text[]
  ) THEN
    RAISE EXCEPTION 'LOR_IDENTITY_AUTHORIZATION_DENIED' USING ERRCODE = 'P1101';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      lor_studio.canonical_jsonb_text(pg_catalog.jsonb_build_array(
        'missionmed.lor.identity-binding-lock.v1', candidate_subject
      )),
      0
    )
  );

  SELECT pg_catalog.count(*)
  INTO binding_count
  FROM lor_studio.student_auth_bindings AS binding
  WHERE binding.student_auth_subject = candidate_subject;

  IF binding_count = 0 THEN
    RAISE EXCEPTION 'LOR_IDENTITY_BINDING_NOT_FOUND' USING ERRCODE = 'P1103';
  END IF;
  IF binding_count <> 1 THEN
    RAISE EXCEPTION 'LOR_IDENTITY_CATALOG_AMBIGUOUS' USING ERRCODE = 'P1102';
  END IF;

  SELECT binding.*
  INTO STRICT existing_binding
  FROM lor_studio.student_auth_bindings AS binding
  WHERE binding.student_auth_subject = candidate_subject;

  authority_ref := 'authority_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.identity-revocation-authority.v1',
      'trustedServiceActor', pg_catalog.current_setting(
        'lor_studio.trusted_service_actor', true
      )
    )
  );
  candidate_revocation_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.student-auth-binding-revocation.v1',
      'bindingId', existing_binding.binding_id,
      'studentAuthSubject', existing_binding.student_auth_subject,
      'studentAuthUid', existing_binding.student_auth_uid::text,
      'reasonCode', candidate_reason_code,
      'authorityRef', authority_ref
    )
  );

  SELECT revocation.*
  INTO existing_revocation
  FROM lor_studio.student_auth_binding_revocations AS revocation
  WHERE revocation.binding_id = existing_binding.binding_id
    AND revocation.student_auth_subject = existing_binding.student_auth_subject
    AND revocation.student_auth_uid = existing_binding.student_auth_uid;

  IF FOUND THEN
    IF existing_revocation.authority_ref IS DISTINCT FROM authority_ref
      OR existing_revocation.revocation_hash IS DISTINCT FROM candidate_revocation_hash
    THEN
      RAISE EXCEPTION 'LOR_IDENTITY_REVOCATION_CONFLICT' USING ERRCODE = 'P1102';
    END IF;
    replayed := true;
  ELSE
    INSERT INTO lor_studio.student_auth_binding_revocations (
      binding_id,
      student_auth_subject,
      student_auth_uid,
      revoked_at,
      authority_ref,
      revocation_hash
    ) VALUES (
      existing_binding.binding_id,
      existing_binding.student_auth_subject,
      existing_binding.student_auth_uid,
      pg_catalog.statement_timestamp(),
      authority_ref,
      candidate_revocation_hash
    )
    RETURNING * INTO STRICT existing_revocation;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.student-auth-binding-revocation-receipt.v1',
    'studentAuthSubject', existing_revocation.student_auth_subject,
    'studentAuthUid', existing_revocation.student_auth_uid::text,
    'bindingId', existing_revocation.binding_id,
    'authorityRef', existing_revocation.authority_ref,
    'reasonCode', candidate_reason_code,
    'revokedAt', existing_revocation.revoked_at,
    'revocationHash', existing_revocation.revocation_hash,
    'replayed', replayed
  );
EXCEPTION
  WHEN SQLSTATE 'P1101' OR SQLSTATE 'P1102' OR SQLSTATE 'P1103' OR SQLSTATE 'P1105' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_IDENTITY_AUTHORIZATION_DENIED' USING ERRCODE = 'P1101';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_IDENTITY_COMMAND_INVALID' USING ERRCODE = 'P1105';
END;
$revoke_binding$;

CREATE FUNCTION lor_studio.resolve_faculty_case_scope(
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
      AND invitation.expires_at > pg_catalog.statement_timestamp()
      AND verification.otp_revoked IS FALSE
      AND verification.otp_verified_at <= pg_catalog.statement_timestamp()
      AND verification.otp_expires_at > pg_catalog.statement_timestamp()
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

CREATE FUNCTION lor_studio.resolve_mentor_case_scope(
  candidate_mentor_subject text,
  candidate_case_id text,
  candidate_operation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $mentor_scope$
DECLARE
  eligible_count bigint;
  resolved_assignment_id text;
  resolved_student_subject text;
  resolved_mentor_uid uuid;
  resolved_purpose text;
BEGIN
  IF candidate_mentor_subject !~ '^wp:[1-9][0-9]*$'
    OR pg_catalog.length(candidate_mentor_subject) > 200
    OR candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_operation IS DISTINCT FROM 'read'
  THEN
    RAISE EXCEPTION 'LOR_SCOPE_INPUT_INVALID' USING ERRCODE = 'P1205';
  END IF;

  IF pg_catalog.current_setting('lor_studio.case_id', true) IS DISTINCT FROM candidate_case_id
    OR NOT lor_studio.actor_scope_resolution_context_allows(
      candidate_mentor_subject,
      'mentor',
      ARRAY['read']::text[],
      'mentor_scope_resolution'
    )
  THEN
    RAISE EXCEPTION 'LOR_SCOPE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1201';
  END IF;

  WITH eligible AS (
    SELECT assignment.*
    FROM lor_studio.mentor_case_assignments AS assignment
    WHERE assignment.case_id = candidate_case_id
      AND assignment.mentor_auth_subject = candidate_mentor_subject
      AND pg_catalog.length(assignment.student_auth_subject) <= 200
      AND pg_catalog.length(assignment.purpose) BETWEEN 1 AND 160
      AND assignment.operation = candidate_operation
      AND assignment.assigned_at <= pg_catalog.statement_timestamp()
      AND assignment.expires_at > pg_catalog.statement_timestamp()
      AND NOT EXISTS (
        SELECT 1
        FROM lor_studio.mentor_case_assignment_revocations AS revocation
        WHERE revocation.assignment_id = assignment.assignment_id
          AND revocation.case_id = assignment.case_id
          AND revocation.student_auth_subject = assignment.student_auth_subject
      )
  )
  SELECT
    pg_catalog.count(*),
    pg_catalog.min(eligible.assignment_id),
    pg_catalog.min(eligible.student_auth_subject),
    pg_catalog.min(eligible.mentor_auth_uid::text)::uuid,
    pg_catalog.min(eligible.purpose)
  INTO
    eligible_count,
    resolved_assignment_id,
    resolved_student_subject,
    resolved_mentor_uid,
    resolved_purpose
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
    'authUid', resolved_mentor_uid::text,
    'authenticatedSubject', candidate_mentor_subject,
    'actorId', candidate_mentor_subject,
    'actorRole', 'mentor',
    'resourceStudentId', resolved_student_subject,
    'caseId', candidate_case_id,
    'operation', candidate_operation,
    'purpose', resolved_purpose,
    'assignmentId', resolved_assignment_id,
    'invitationId', NULL,
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
$mentor_scope$;

REVOKE ALL ON FUNCTION lor_studio.identity_bootstrap_context_allows(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.actor_scope_resolution_context_allows(
  text, text, text[], text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.ensure_student_auth_binding(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.revoke_student_auth_binding(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.resolve_faculty_case_scope(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.resolve_mentor_case_scope(text, text, text) FROM PUBLIC;

ALTER FUNCTION lor_studio.ensure_student_auth_binding(text, text, text)
OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.revoke_student_auth_binding(text, text)
OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.resolve_faculty_case_scope(text, text, text)
OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.resolve_mentor_case_scope(text, text, text)
OWNER TO lor_studio_command_owner;

GRANT EXECUTE ON FUNCTION lor_studio.ensure_student_auth_binding(text, text, text)
TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.revoke_student_auth_binding(text, text)
TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.resolve_faculty_case_scope(text, text, text)
TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.resolve_mentor_case_scope(text, text, text)
TO lor_studio_app;

DO $advance_sentinel$
DECLARE
  observed_sentinel text;
BEGIN
  SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO STRICT observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';

  EXECUTE pg_catalog.format(
    'COMMENT ON SCHEMA lor_studio IS %L',
    observed_sentinel || '|identityScope=20260826010300'
  );
END
$advance_sentinel$;

COMMIT;
