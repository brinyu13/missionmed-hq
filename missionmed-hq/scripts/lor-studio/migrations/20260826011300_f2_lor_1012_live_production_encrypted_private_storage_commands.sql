-- Migration: 20260826011300_f2_lor_1012_live_production_encrypted_private_storage_commands.sql
-- Authority: F2-LOR-1012 / DR-133
-- Date: 2026-08-26
-- Depends on: 20260826011100_f2_lor_1012_live_production_student_evidence_commands.sql
-- Description: Add application-encrypted, immutable, actor/case-bound private artifact storage.
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
  SELECT pg_catalog.pg_get_userbyid(namespace.nspowner),
         pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO schema_owner, observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';
  target_identity_text := pg_catalog.concat_ws('|',
    target_provider, target_project_id, target_environment_id, target_service_id,
    target_database_name, target_region, target_decision_record, target_data_copied
  );
  expected_sentinel := pg_catalog.format(
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000|identityScope=20260826010300|facultyInvitationCommands=20260826010500|facultyPrivateExportCommands=20260826010700|aiProposalCommands=20260826010900|studentEvidenceCommands=20260826011100',
    target_provider, target_project_id, target_environment_id, target_service_id,
    target_database_name, current_user, target_region, target_decision_record,
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
      SELECT 1 FROM pg_catalog.pg_stat_ssl AS ssl_session
      WHERE ssl_session.pid = pg_catalog.pg_backend_pid() AND ssl_session.ssl
    )
    OR observed_sentinel IS DISTINCT FROM expected_sentinel
  THEN
    RAISE EXCEPTION 'DR-133 encrypted storage migration requires the exact successor-bound private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_proof_revocations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.recommendation_cases,
  lor_studio.released_student_documents,
  lor_studio.student_auth_binding_revocations,
  lor_studio.student_auth_bindings
IN ACCESS EXCLUSIVE MODE;

DO $catalog_preflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  public_execute_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO relation_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r';
  SELECT pg_catalog.count(*) INTO forced_rls_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r'
    AND class.relrowsecurity AND class.relforcerowsecurity;
  SELECT pg_catalog.count(*) INTO definer_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio' AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner';
  SELECT pg_catalog.count(*) INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio' AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';
  IF relation_count IS DISTINCT FROM 33
    OR forced_rls_count IS DISTINCT FROM 33
    OR definer_count IS DISTINCT FROM 28
    OR public_execute_count <> 0
    OR pg_catalog.to_regclass('lor_studio.private_artifact_versions') IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)'
    ) IS NOT NULL
  THEN
    RAISE EXCEPTION 'DR-133 encrypted storage migration preflight catalog mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_preflight$;

CREATE TABLE lor_studio.private_artifact_versions (
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  object_id text NOT NULL,
  version_id text NOT NULL,
  private_object_key text NOT NULL,
  content_class text NOT NULL,
  purpose text NOT NULL,
  content_type text NOT NULL,
  content_hash text NOT NULL,
  plaintext_byte_length bigint NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  created_by_actor_ref text NOT NULL,
  storage_identity_ref text NOT NULL,
  encryption_profile text NOT NULL,
  encryption_key_version text NOT NULL,
  hkdf_salt bytea NOT NULL,
  aes_gcm_iv bytea NOT NULL,
  aes_gcm_auth_tag bytea NOT NULL,
  ciphertext bytea NOT NULL,
  aad_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT private_artifact_versions_pk PRIMARY KEY (case_id, object_id, version_id),
  CONSTRAINT private_artifact_versions_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT private_artifact_versions_idempotency_unique
    UNIQUE (case_id, created_by_actor_ref, idempotency_key),
  CONSTRAINT private_artifact_versions_identifiers CHECK (
    case_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND student_auth_subject ~ '^wp:[1-9][0-9]*$'
    AND object_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$'
    AND version_id ~ '^version_[a-f0-9]{64}$'
    AND created_by_actor_ref ~ '^actor_[a-f0-9]{64}$'
  ),
  CONSTRAINT private_artifact_versions_object_key CHECK (
    pg_catalog.length(private_object_key) BETWEEN 1 AND 1024
    AND private_object_key !~ '(^/|(^|/)\.\.(/|$)|://)'
  ),
  CONSTRAINT private_artifact_versions_content_class CHECK (
    content_class = ANY (ARRAY[
      'student_prepared', 'faculty_private', 'released_final', 'structural_waiver_material'
    ]::text[])
  ),
  CONSTRAINT private_artifact_versions_purpose CHECK (
    purpose = ANY (ARRAY[
      'case_workflow', 'faculty_review', 'final_delivery', 'privacy_request',
      'restore_rehearsal'
    ]::text[])
  ),
  CONSTRAINT private_artifact_versions_content CHECK (
    pg_catalog.length(content_type) BETWEEN 1 AND 160
    AND content_type ~ '^[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*(; ?[a-z0-9][a-z0-9!#$&^_.+-]*=[A-Za-z0-9][A-Za-z0-9!#$&^_.+:-]*)*$'
    AND content_hash ~ '^[a-f0-9]{64}$'
    AND plaintext_byte_length BETWEEN 1 AND 52428800
    AND pg_catalog.octet_length(ciphertext) = plaintext_byte_length
  ),
  CONSTRAINT private_artifact_versions_command CHECK (
    pg_catalog.length(idempotency_key) BETWEEN 1 AND 200
    AND request_hash ~ '^[a-f0-9]{64}$'
    AND storage_identity_ref ~ '^[a-f0-9]{64}$'
    AND aad_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT private_artifact_versions_encryption CHECK (
    encryption_profile = 'aes-256-gcm+hkdf-sha256.v1'
    AND encryption_key_version ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$'
    AND pg_catalog.octet_length(hkdf_salt) = 32
    AND pg_catalog.octet_length(aes_gcm_iv) = 12
    AND pg_catalog.octet_length(aes_gcm_auth_tag) = 16
  )
);

CREATE INDEX private_artifact_versions_case_object_idx
ON lor_studio.private_artifact_versions (case_id, student_auth_subject, object_id, created_at);

ALTER TABLE lor_studio.private_artifact_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.private_artifact_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE lor_studio.private_artifact_versions FROM PUBLIC;
REVOKE ALL ON TABLE lor_studio.private_artifact_versions FROM lor_studio_app;

CREATE FUNCTION lor_studio.private_storage_context_allows(
  resource_case_id text,
  resource_student_subject text,
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
    resource_case_id = pg_catalog.current_setting('lor_studio.case_id', true)
    AND resource_student_subject =
      pg_catalog.current_setting('lor_studio.resource_student_id', true)
    AND pg_catalog.current_setting('lor_studio.student_auth_subject', true)
      ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.current_setting('lor_studio.actor_role', true)
      = ANY (ARRAY['student', 'faculty']::text[])
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (allowed_operations)
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'private_storage'
    AND pg_catalog.current_setting('lor_studio.trusted_service_actor', true)
      = 'lor-private-storage-v1'
    AND pg_catalog.current_setting('lor_studio.identity_resolution_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true',
    false
  );
$$;

REVOKE ALL ON FUNCTION lor_studio.private_storage_context_allows(text, text, text[])
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lor_studio.private_storage_context_allows(text, text, text[])
TO lor_studio_command_owner;

CREATE POLICY private_artifact_versions_storage_select
ON lor_studio.private_artifact_versions
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.private_storage_context_allows(
  case_id, student_auth_subject, ARRAY['private_storage_put', 'private_storage_get']::text[]
));

CREATE POLICY private_artifact_versions_storage_insert
ON lor_studio.private_artifact_versions
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (lor_studio.private_storage_context_allows(
  case_id, student_auth_subject, ARRAY['private_storage_put']::text[]
));

CREATE POLICY released_student_documents_private_storage_select
ON lor_studio.released_student_documents
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.private_storage_context_allows(
  case_id, student_auth_subject, ARRAY['private_storage_put', 'private_storage_get']::text[]
));

CREATE TRIGGER private_artifact_versions_append_only
BEFORE UPDATE OR DELETE ON lor_studio.private_artifact_versions
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE FUNCTION lor_studio.put_encrypted_private_artifact_version(
  candidate_actor_subject text,
  candidate_actor_role text,
  candidate_case_id text,
  candidate_object_id text,
  candidate_object_key text,
  candidate_content_class text,
  candidate_purpose text,
  candidate_content_type text,
  candidate_content_hash text,
  candidate_byte_length bigint,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_storage_identity text,
  candidate_key_version text,
  candidate_capability_id text,
  candidate_evidence_id text,
  candidate_salt_base64 text,
  candidate_iv_base64 text,
  candidate_auth_tag_base64 text,
  candidate_ciphertext_base64 text,
  candidate_aad_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $put_encrypted_storage$
DECLARE
  access_record jsonb;
  resource_student_subject text;
  actor_ref text;
  storage_identity_ref text;
  candidate_version_id text;
  existing_version lor_studio.private_artifact_versions%ROWTYPE;
  inserted_version lor_studio.private_artifact_versions%ROWTYPE;
  replayed boolean := false;
  receipt_id text;
BEGIN
  IF candidate_actor_subject !~ '^wp:[1-9][0-9]*$'
    OR candidate_actor_role <> ALL (ARRAY['student', 'faculty']::text[])
    OR candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_object_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$'
    OR pg_catalog.length(candidate_object_key) NOT BETWEEN 1 AND 1024
    OR candidate_object_key ~ '(^/|(^|/)\.\.(/|$)|://)'
    OR candidate_content_class <> ALL (ARRAY[
      'student_prepared', 'faculty_private', 'released_final', 'structural_waiver_material'
    ]::text[])
    OR candidate_purpose <> ALL (ARRAY[
      'case_workflow', 'faculty_review', 'final_delivery', 'privacy_request',
      'restore_rehearsal'
    ]::text[])
    OR pg_catalog.length(candidate_content_type) NOT BETWEEN 1 AND 160
    OR candidate_content_type !~ '^[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*(; ?[a-z0-9][a-z0-9!#$&^_.+-]*=[A-Za-z0-9][A-Za-z0-9!#$&^_.+:-]*)*$'
    OR candidate_content_hash !~ '^[a-f0-9]{64}$'
    OR candidate_byte_length NOT BETWEEN 1 AND 52428800
    OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 200
    OR candidate_request_hash !~ '^[a-f0-9]{64}$'
    OR pg_catalog.length(candidate_storage_identity) NOT BETWEEN 1 AND 300
    OR candidate_key_version !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$'
    OR candidate_capability_id !~ '^capability_[a-f0-9]{64}$'
    OR candidate_evidence_id !~ '^evidence_[a-f0-9]{64}$'
    OR candidate_aad_hash !~ '^[a-f0-9]{64}$'
    OR pg_catalog.encode(pg_catalog.decode(candidate_salt_base64, 'base64'), 'base64')
      IS DISTINCT FROM candidate_salt_base64
    OR pg_catalog.octet_length(pg_catalog.decode(candidate_salt_base64, 'base64')) <> 32
    OR pg_catalog.encode(pg_catalog.decode(candidate_iv_base64, 'base64'), 'base64')
      IS DISTINCT FROM candidate_iv_base64
    OR pg_catalog.octet_length(pg_catalog.decode(candidate_iv_base64, 'base64')) <> 12
    OR pg_catalog.encode(pg_catalog.decode(candidate_auth_tag_base64, 'base64'), 'base64')
      IS DISTINCT FROM candidate_auth_tag_base64
    OR pg_catalog.octet_length(pg_catalog.decode(candidate_auth_tag_base64, 'base64')) <> 16
    OR pg_catalog.encode(pg_catalog.decode(candidate_ciphertext_base64, 'base64'), 'base64')
      IS DISTINCT FROM candidate_ciphertext_base64
    OR pg_catalog.octet_length(pg_catalog.decode(candidate_ciphertext_base64, 'base64'))
      <> candidate_byte_length
  THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_INPUT_INVALID' USING ERRCODE = 'P1505';
  END IF;

  IF pg_catalog.current_setting('lor_studio.actor_role', true) <> 'service'
    OR pg_catalog.current_setting('lor_studio.student_auth_subject', true)
      <> candidate_actor_subject
    OR pg_catalog.current_setting('lor_studio.case_id', true) <> candidate_case_id
    OR pg_catalog.current_setting('lor_studio.operation', true) <> 'read'
    OR pg_catalog.current_setting('lor_studio.purpose', true)
      <> 'actor_case_access_resolution'
  THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1501';
  END IF;

  access_record := lor_studio.resolve_lor_actor_case_access(
    candidate_actor_subject, candidate_case_id
  );
  IF access_record IS NULL
    OR access_record ->> 'actorId' IS DISTINCT FROM candidate_actor_subject
    OR access_record ->> 'actorRole' IS DISTINCT FROM candidate_actor_role
    OR access_record ->> 'caseId' IS DISTINCT FROM candidate_case_id
  THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1501';
  END IF;
  resource_student_subject := access_record ->> 'resourceStudentId';

  IF (candidate_actor_role = 'student' AND candidate_content_class <> 'student_prepared')
    OR (candidate_actor_role = 'faculty'
      AND candidate_content_class <> ALL (ARRAY['faculty_private', 'released_final']::text[]))
  THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1501';
  END IF;

  PERFORM pg_catalog.set_config('lor_studio.actor_role', candidate_actor_role, true);
  PERFORM pg_catalog.set_config(
    'lor_studio.resource_student_id', resource_student_subject, true
  );
  PERFORM pg_catalog.set_config('lor_studio.operation', 'private_storage_put', true);
  PERFORM pg_catalog.set_config('lor_studio.purpose', 'private_storage', true);
  PERFORM pg_catalog.set_config(
    'lor_studio.trusted_service_actor', 'lor-private-storage-v1', true
  );

  IF candidate_content_class = 'released_final' AND NOT EXISTS (
    SELECT 1 FROM lor_studio.released_student_documents AS released
    WHERE released.case_id = candidate_case_id
      AND released.student_auth_subject = resource_student_subject
      AND released.final_document_id = candidate_object_id
      AND released.final_document_content_hash IS NOT NULL
      AND released.final_document_content_hash = candidate_content_hash
      AND released.final_document_mime_type IS NOT NULL
      AND released.final_document_mime_type = candidate_content_type
  ) THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_RELEASE_NOT_FOUND' USING ERRCODE = 'P1503';
  END IF;

  actor_ref := 'actor_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('actorId', candidate_actor_subject)
  );
  storage_identity_ref := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('storageIdentity', candidate_storage_identity)
  );
  candidate_version_id := 'version_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.encrypted-private-artifact-version.v1',
      'caseId', candidate_case_id,
      'objectId', candidate_object_id,
      'contentClass', candidate_content_class,
      'purpose', candidate_purpose,
      'contentHash', candidate_content_hash,
      'idempotencyKey', candidate_idempotency_key,
      'requestHash', candidate_request_hash
    )
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      lor_studio.canonical_jsonb_text(pg_catalog.jsonb_build_array(
        'missionmed.lor.private-storage-lock.v1', candidate_case_id,
        actor_ref, candidate_idempotency_key
      )), 0
    )
  );

  SELECT version.* INTO existing_version
  FROM lor_studio.private_artifact_versions AS version
  WHERE version.case_id = candidate_case_id
    AND version.created_by_actor_ref = actor_ref
    AND version.idempotency_key = candidate_idempotency_key;

  IF FOUND THEN
    IF existing_version.request_hash IS DISTINCT FROM candidate_request_hash
      OR existing_version.object_id IS DISTINCT FROM candidate_object_id
      OR existing_version.content_hash IS DISTINCT FROM candidate_content_hash
      OR existing_version.content_class IS DISTINCT FROM candidate_content_class
      OR existing_version.purpose IS DISTINCT FROM candidate_purpose
      OR existing_version.storage_identity_ref IS DISTINCT FROM storage_identity_ref
    THEN
      RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1502';
    END IF;
    inserted_version := existing_version;
    replayed := true;
  ELSE
    INSERT INTO lor_studio.private_artifact_versions (
      case_id, student_auth_subject, object_id, version_id, private_object_key,
      content_class, purpose, content_type, content_hash, plaintext_byte_length,
      idempotency_key, request_hash, created_by_actor_ref, storage_identity_ref,
      encryption_profile, encryption_key_version, hkdf_salt, aes_gcm_iv,
      aes_gcm_auth_tag, ciphertext, aad_hash, created_at
    ) VALUES (
      candidate_case_id, resource_student_subject, candidate_object_id,
      candidate_version_id, candidate_object_key, candidate_content_class,
      candidate_purpose, candidate_content_type, candidate_content_hash,
      candidate_byte_length, candidate_idempotency_key, candidate_request_hash,
      actor_ref, storage_identity_ref, 'aes-256-gcm+hkdf-sha256.v1',
      candidate_key_version, pg_catalog.decode(candidate_salt_base64, 'base64'),
      pg_catalog.decode(candidate_iv_base64, 'base64'),
      pg_catalog.decode(candidate_auth_tag_base64, 'base64'),
      pg_catalog.decode(candidate_ciphertext_base64, 'base64'),
      candidate_aad_hash, pg_catalog.statement_timestamp()
    ) RETURNING * INTO STRICT inserted_version;
  END IF;

  receipt_id := 'receipt_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'operation', 'put', 'caseId', inserted_version.case_id,
      'objectId', inserted_version.object_id, 'versionId', inserted_version.version_id,
      'capabilityId', candidate_capability_id,
      'requestHash', inserted_version.request_hash
    )
  );
  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.private-storage-database-receipt.v1',
    'operation', 'put', 'storageIdentity', candidate_storage_identity,
    'bucket', 'lor-writer-depot', 'caseId', inserted_version.case_id,
    'objectId', inserted_version.object_id, 'objectKey', inserted_version.private_object_key,
    'versionId', inserted_version.version_id, 'contentClass', inserted_version.content_class,
    'purpose', inserted_version.purpose, 'contentType', inserted_version.content_type,
    'checksum', inserted_version.content_hash,
    'byteLength', inserted_version.plaintext_byte_length,
    'capabilityId', candidate_capability_id,
    'evidenceId', candidate_evidence_id,
    'receiptId', receipt_id, 'occurredAt', inserted_version.created_at,
    'private', true, 'versionImmutable', true, 'policyChecked', true,
    'replayed', replayed
  );
EXCEPTION
  WHEN SQLSTATE 'P1501' OR SQLSTATE 'P1502' OR SQLSTATE 'P1503'
    OR SQLSTATE 'P1505' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1501';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_COMMAND_INVALID' USING ERRCODE = 'P1505';
END;
$put_encrypted_storage$;

CREATE FUNCTION lor_studio.get_encrypted_private_artifact_version(
  candidate_actor_subject text,
  candidate_actor_role text,
  candidate_case_id text,
  candidate_object_id text,
  candidate_version_id text,
  candidate_object_key text,
  candidate_content_class text,
  candidate_purpose text,
  candidate_storage_identity text,
  candidate_capability_id text,
  candidate_evidence_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $get_encrypted_storage$
DECLARE
  access_record jsonb;
  resource_student_subject text;
  stored_version lor_studio.private_artifact_versions%ROWTYPE;
  receipt_id text;
BEGIN
  IF candidate_actor_subject !~ '^wp:[1-9][0-9]*$'
    OR candidate_actor_role <> ALL (ARRAY['student', 'faculty']::text[])
    OR candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_object_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$'
    OR candidate_version_id !~ '^version_[a-f0-9]{64}$'
    OR pg_catalog.length(candidate_object_key) NOT BETWEEN 1 AND 1024
    OR candidate_content_class <> ALL (ARRAY[
      'student_prepared', 'faculty_private', 'released_final', 'structural_waiver_material'
    ]::text[])
    OR candidate_purpose <> ALL (ARRAY[
      'case_workflow', 'faculty_review', 'final_delivery', 'privacy_request',
      'restore_rehearsal'
    ]::text[])
    OR pg_catalog.length(candidate_storage_identity) NOT BETWEEN 1 AND 300
    OR candidate_capability_id !~ '^capability_[a-f0-9]{64}$'
    OR candidate_evidence_id !~ '^evidence_[a-f0-9]{64}$'
  THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_INPUT_INVALID' USING ERRCODE = 'P1505';
  END IF;
  IF pg_catalog.current_setting('lor_studio.actor_role', true) <> 'service'
    OR pg_catalog.current_setting('lor_studio.student_auth_subject', true)
      <> candidate_actor_subject
    OR pg_catalog.current_setting('lor_studio.case_id', true) <> candidate_case_id
    OR pg_catalog.current_setting('lor_studio.operation', true) <> 'read'
    OR pg_catalog.current_setting('lor_studio.purpose', true)
      <> 'actor_case_access_resolution'
  THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1501';
  END IF;

  access_record := lor_studio.resolve_lor_actor_case_access(
    candidate_actor_subject, candidate_case_id
  );
  IF access_record IS NULL
    OR access_record ->> 'actorId' IS DISTINCT FROM candidate_actor_subject
    OR access_record ->> 'actorRole' IS DISTINCT FROM candidate_actor_role
    OR access_record ->> 'caseId' IS DISTINCT FROM candidate_case_id
  THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1501';
  END IF;
  resource_student_subject := access_record ->> 'resourceStudentId';
  IF (candidate_actor_role = 'student'
      AND candidate_content_class <> ALL (ARRAY['student_prepared', 'released_final']::text[]))
    OR (candidate_actor_role = 'faculty'
      AND candidate_content_class <> ALL (ARRAY['faculty_private', 'released_final']::text[]))
  THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1501';
  END IF;

  PERFORM pg_catalog.set_config('lor_studio.actor_role', candidate_actor_role, true);
  PERFORM pg_catalog.set_config(
    'lor_studio.resource_student_id', resource_student_subject, true
  );
  PERFORM pg_catalog.set_config('lor_studio.operation', 'private_storage_get', true);
  PERFORM pg_catalog.set_config('lor_studio.purpose', 'private_storage', true);
  PERFORM pg_catalog.set_config(
    'lor_studio.trusted_service_actor', 'lor-private-storage-v1', true
  );

  SELECT version.* INTO stored_version
  FROM lor_studio.private_artifact_versions AS version
  WHERE version.case_id = candidate_case_id
    AND version.student_auth_subject = resource_student_subject
    AND version.object_id = candidate_object_id
    AND version.version_id = candidate_version_id
    AND version.private_object_key = candidate_object_key
    AND version.content_class = candidate_content_class
    AND version.purpose = candidate_purpose
    AND version.storage_identity_ref = lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('storageIdentity', candidate_storage_identity)
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_NOT_FOUND' USING ERRCODE = 'P1503';
  END IF;
  IF candidate_actor_role = 'student' AND candidate_content_class = 'released_final'
    AND NOT EXISTS (
      SELECT 1 FROM lor_studio.released_student_documents AS released
      WHERE released.case_id = stored_version.case_id
        AND released.student_auth_subject = stored_version.student_auth_subject
        AND released.final_document_id = stored_version.object_id
        AND released.final_document_content_hash IS NOT NULL
        AND released.final_document_content_hash = stored_version.content_hash
        AND released.final_document_mime_type IS NOT NULL
        AND released.final_document_mime_type = stored_version.content_type
    )
  THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1501';
  END IF;

  receipt_id := 'receipt_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'operation', 'get', 'caseId', stored_version.case_id,
      'objectId', stored_version.object_id, 'versionId', stored_version.version_id,
      'capabilityId', candidate_capability_id, 'evidenceId', candidate_evidence_id
    )
  );
  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.private-storage-database-receipt.v1',
    'operation', 'get', 'storageIdentity', candidate_storage_identity,
    'bucket', 'lor-writer-depot', 'caseId', stored_version.case_id,
    'objectId', stored_version.object_id, 'objectKey', stored_version.private_object_key,
    'versionId', stored_version.version_id, 'contentClass', stored_version.content_class,
    'purpose', stored_version.purpose, 'contentType', stored_version.content_type,
    'checksum', stored_version.content_hash,
    'byteLength', stored_version.plaintext_byte_length,
    'capabilityId', candidate_capability_id, 'evidenceId', candidate_evidence_id,
    'receiptId', receipt_id, 'occurredAt', pg_catalog.statement_timestamp(),
    'private', true, 'versionImmutable', true, 'policyChecked', true,
    'keyVersion', stored_version.encryption_key_version,
    'hkdfSaltBase64', pg_catalog.encode(stored_version.hkdf_salt, 'base64'),
    'ivBase64', pg_catalog.encode(stored_version.aes_gcm_iv, 'base64'),
    'authTagBase64', pg_catalog.encode(stored_version.aes_gcm_auth_tag, 'base64'),
    'ciphertextBase64', pg_catalog.encode(stored_version.ciphertext, 'base64'),
    'aadHash', stored_version.aad_hash,
    'idempotencyKey', stored_version.idempotency_key
  );
EXCEPTION
  WHEN SQLSTATE 'P1501' OR SQLSTATE 'P1503' OR SQLSTATE 'P1505' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1501';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_PRIVATE_STORAGE_COMMAND_INVALID' USING ERRCODE = 'P1505';
END;
$get_encrypted_storage$;

REVOKE ALL ON FUNCTION lor_studio.put_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.get_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,text,text
) FROM PUBLIC;
ALTER FUNCTION lor_studio.put_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.get_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,text,text
) OWNER TO lor_studio_command_owner;
GRANT SELECT, INSERT ON TABLE lor_studio.private_artifact_versions
TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.put_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.get_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,text,text
) TO lor_studio_app;

DO $catalog_postflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  public_execute_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO relation_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r';
  SELECT pg_catalog.count(*) INTO forced_rls_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r'
    AND class.relrowsecurity AND class.relforcerowsecurity;
  SELECT pg_catalog.count(*) INTO definer_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio' AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner';
  SELECT pg_catalog.count(*) INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio' AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';
  IF relation_count IS DISTINCT FROM 34
    OR forced_rls_count IS DISTINCT FROM 34
    OR definer_count IS DISTINCT FROM 30
    OR public_execute_count <> 0
    OR pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.private_artifact_versions',
      'SELECT,INSERT,UPDATE,DELETE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'DR-133 encrypted storage migration postflight mismatch'
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
    observed_sentinel || '|encryptedPrivateStorage=20260826011300'
  );
END
$advance_sentinel$;

COMMIT;
