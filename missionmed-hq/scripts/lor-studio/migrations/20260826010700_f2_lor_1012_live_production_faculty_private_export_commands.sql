-- Migration: 20260826010700_f2_lor_1012_live_production_faculty_private_export_commands.sql
-- Authority: F2-LOR-1012 / DR-133
-- Date: 2026-08-26
-- Depends on: 20260826010500_f2_lor_1012_live_production_faculty_invitation_commands.sql
-- Description: Add actor-safe final-document export and atomic faculty-private authoring.
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
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000|identityScope=20260826010300|facultyInvitationCommands=20260826010500',
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
      pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
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
    RAISE EXCEPTION 'DR-133 faculty-private/export migration requires the exact invitation-successor private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.faculty_private_content,
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_case_private_write_receipts,
  lor_studio.recommendation_case_protected_revision_states,
  lor_studio.recommendation_cases,
  lor_studio.released_student_documents,
  lor_studio.waiver_receipts
IN ACCESS EXCLUSIVE MODE;

DO $catalog_preflight$
DECLARE
  command_constraint text;
BEGIN
  SELECT pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
  INTO STRICT command_constraint
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname = 'recommendation_case_private_write_receipts'
    AND constraint_row.conname =
      'recommendation_case_private_write_receipts_command_type_known';

  IF command_constraint NOT LIKE '%command_type = %faculty.final_document_release%'
    OR command_constraint LIKE '%faculty.private_content_update%'
    OR pg_catalog.to_regprocedure(
      'lor_studio.read_final_document_export()'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.commit_faculty_private_content(bigint,jsonb,text,text,jsonb,text)'
    ) IS NOT NULL
    OR pg_catalog.to_regclass(
      'lor_studio.artifact_export_audit_events'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.append_artifact_export_audit(jsonb,text,text,text)'
    ) IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND policy.polname IN (
          'faculty_private_content_faculty_command_insert',
          'released_student_documents_student_export_select',
          'artifact_export_audit_events_command_insert',
          'artifact_export_audit_events_command_select'
        )
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.faculty_private_content',
      'INSERT'
    )
  THEN
    RAISE EXCEPTION 'DR-133 faculty-private/export migration catalog preflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_preflight$;

ALTER TABLE lor_studio.recommendation_case_private_write_receipts
  DROP CONSTRAINT recommendation_case_private_write_receipts_command_type_known,
  ADD CONSTRAINT recommendation_case_private_write_receipts_command_type_known CHECK (
    command_type IN (
      'faculty.final_document_release',
      'faculty.private_content_update'
    )
  );

GRANT INSERT ON TABLE lor_studio.faculty_private_content
TO lor_studio_command_owner;

CREATE POLICY faculty_private_content_faculty_command_insert
ON lor_studio.faculty_private_content
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  lor_studio.student_write_axes_satisfied()
  AND lor_studio.faculty_context_allows(
    case_id,
    student_auth_subject,
    ARRAY['save']::text[]
  )
);

CREATE POLICY released_student_documents_student_export_select
ON lor_studio.released_student_documents
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.operation', true) = 'read'
  AND pg_catalog.current_setting('lor_studio.purpose', true) = 'student_case_read'
  AND lor_studio.student_write_axes_satisfied()
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id',
    true
  )
  AND EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = released_student_documents.case_id
      AND recommendation_case.student_auth_subject =
        released_student_documents.student_auth_subject
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['read']::text[]
      )
  )
);

CREATE TABLE lor_studio.artifact_export_audit_events (
  event_id uuid PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  actor_auth_subject text NOT NULL,
  actor_role text NOT NULL,
  event_type text NOT NULL,
  outcome text NOT NULL,
  event_hash text NOT NULL,
  scope_hash text NOT NULL,
  target_binding_hash text NOT NULL,
  artifact_sha256 text,
  release_document_hash text,
  source_revision bigint,
  event jsonb NOT NULL,
  transaction_id text NOT NULL,
  committed_at timestamp with time zone NOT NULL,
  CONSTRAINT artifact_export_audit_events_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases(case_id, student_auth_subject),
  CONSTRAINT artifact_export_audit_events_case_id_format
    CHECK (case_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT artifact_export_audit_events_student_subject_format
    CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT artifact_export_audit_events_actor_subject_format
    CHECK (actor_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT artifact_export_audit_events_actor_role_known
    CHECK (actor_role IN ('student', 'faculty')),
  CONSTRAINT artifact_export_audit_events_type_known
    CHECK (event_type IN ('artifact.generated', 'artifact.denied')),
  CONSTRAINT artifact_export_audit_events_outcome_known
    CHECK (outcome IN ('success', 'denied')),
  CONSTRAINT artifact_export_audit_events_event_hash_format
    CHECK (event_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT artifact_export_audit_events_scope_hash_format
    CHECK (scope_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT artifact_export_audit_events_target_hash_format
    CHECK (target_binding_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT artifact_export_audit_events_artifact_binding CHECK (
    ((
      event_type = 'artifact.denied'
      AND artifact_sha256 IS NULL
      AND release_document_hash IS NULL
      AND source_revision IS NULL
      AND event ->> 'type' = event_type
      AND event ->> 'outcome' = outcome
      AND event ->> 'actorRole' = actor_role
      AND event -> 'metadata' = pg_catalog.jsonb_build_object(
        'action', 'export_final_document',
        'artifactFormat', 'docx',
        'reasonCode', event -> 'metadata' ->> 'reasonCode'
      )
      AND event -> 'metadata' ->> 'reasonCode'
        ~ '^[A-Za-z0-9_.:/ -]{1,120}$'
    )
    OR (
      event_type = 'artifact.generated'
      AND artifact_sha256 IS NOT NULL
      AND artifact_sha256 ~ '^[a-f0-9]{64}$'
      AND (
        (actor_role = 'faculty' AND release_document_hash IS NULL)
        OR release_document_hash ~ '^[a-f0-9]{64}$'
      )
      AND source_revision IS NOT NULL
      AND source_revision >= 0
      AND event ->> 'type' = event_type
      AND event ->> 'outcome' = outcome
      AND event ->> 'actorRole' = actor_role
      AND event -> 'metadata' = pg_catalog.jsonb_build_object(
        'action', 'export_final_document',
        'artifactFormat', 'docx',
        'result', CASE
          WHEN actor_role = 'student' THEN 'student_visible'
          ELSE 'faculty_owner'
        END,
        'artifactSha256', artifact_sha256,
        'releaseDocumentHash', COALESCE(
          pg_catalog.to_jsonb(release_document_hash), 'null'::jsonb
        ),
        'sourceRevision', source_revision
      )
    )) IS TRUE
    AND event_hash = lor_studio.canonical_jsonb_sha256(event)
  ),
  CONSTRAINT artifact_export_audit_events_event_object
    CHECK (pg_catalog.jsonb_typeof(event) = 'object'),
  CONSTRAINT artifact_export_audit_events_transaction_id_format
    CHECK (transaction_id ~ '^[0-9]+$')
);

ALTER TABLE lor_studio.artifact_export_audit_events
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.artifact_export_audit_events
  FORCE ROW LEVEL SECURITY;

CREATE POLICY artifact_export_audit_events_command_insert
ON lor_studio.artifact_export_audit_events
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  pg_catalog.current_setting('lor_studio.operation', true) = 'read'
  AND pg_catalog.current_setting('lor_studio.purpose', true)
    IN ('student_case_read', 'faculty_private_edit')
  AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
  AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
  AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id',
    true
  )
  AND actor_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject',
    true
  )
  AND actor_role = pg_catalog.current_setting('lor_studio.actor_role', true)
  AND (
    (
      actor_role = 'student'
      AND actor_auth_subject = student_auth_subject
      AND pg_catalog.current_setting('lor_studio.purpose', true) = 'student_case_read'
      AND NULLIF(pg_catalog.current_setting('lor_studio.invitation_id', true), '') IS NULL
      AND EXISTS (
        SELECT 1
        FROM lor_studio.recommendation_cases AS recommendation_case
        WHERE recommendation_case.case_id = artifact_export_audit_events.case_id
          AND recommendation_case.student_auth_subject =
            artifact_export_audit_events.student_auth_subject
          AND lor_studio.student_context_allows(
            recommendation_case.case_id,
            recommendation_case.student_auth_subject,
            recommendation_case.student_auth_uid,
            ARRAY['read']::text[]
          )
      )
    )
    OR (
      actor_role = 'faculty'
      AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
      AND pg_catalog.length(pg_catalog.btrim(
        pg_catalog.current_setting('lor_studio.invitation_id', true)
      )) BETWEEN 1 AND 200
      AND lor_studio.faculty_context_allows(
        case_id,
        student_auth_subject,
        ARRAY['read']::text[]
      )
    )
  )
);

CREATE POLICY artifact_export_audit_events_command_select
ON lor_studio.artifact_export_audit_events
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.operation', true) = 'read'
  AND pg_catalog.current_setting('lor_studio.purpose', true)
    IN ('student_case_read', 'faculty_private_edit')
  AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
  AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
  AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id',
    true
  )
  AND actor_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject',
    true
  )
  AND actor_role = pg_catalog.current_setting('lor_studio.actor_role', true)
  AND (
    (
      actor_role = 'student'
      AND actor_auth_subject = student_auth_subject
      AND pg_catalog.current_setting('lor_studio.purpose', true) = 'student_case_read'
      AND NULLIF(pg_catalog.current_setting('lor_studio.invitation_id', true), '') IS NULL
      AND EXISTS (
        SELECT 1
        FROM lor_studio.recommendation_cases AS recommendation_case
        WHERE recommendation_case.case_id = artifact_export_audit_events.case_id
          AND recommendation_case.student_auth_subject =
            artifact_export_audit_events.student_auth_subject
          AND lor_studio.student_context_allows(
            recommendation_case.case_id,
            recommendation_case.student_auth_subject,
            recommendation_case.student_auth_uid,
            ARRAY['read']::text[]
          )
      )
    )
    OR (
      actor_role = 'faculty'
      AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
      AND pg_catalog.length(pg_catalog.btrim(
        pg_catalog.current_setting('lor_studio.invitation_id', true)
      )) BETWEEN 1 AND 200
      AND lor_studio.faculty_context_allows(
        case_id,
        student_auth_subject,
        ARRAY['read']::text[]
      )
    )
  )
);

CREATE TRIGGER artifact_export_audit_events_append_only
BEFORE UPDATE OR DELETE ON lor_studio.artifact_export_audit_events
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE FUNCTION lor_studio.append_artifact_export_audit(
  candidate_event jsonb,
  candidate_event_hash text,
  candidate_scope_hash text,
  candidate_target_binding_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $artifact_export_audit$
DECLARE
  scope_case_id text := pg_catalog.current_setting('lor_studio.case_id', true);
  scope_student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id',
    true
  );
  actor_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject',
    true
  );
  actor_role text := pg_catalog.current_setting('lor_studio.actor_role', true);
  actor_uid_text text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  purpose text := pg_catalog.current_setting('lor_studio.purpose', true);
  invitation_id text := pg_catalog.current_setting('lor_studio.invitation_id', true);
  actor_uid uuid;
  resource_uid uuid;
  candidate_event_id uuid;
  event_timestamp timestamp with time zone;
  event_key_count bigint;
  metadata_key_count bigint;
  expected_actor_ref text;
  expected_case_ref text;
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  stored_event lor_studio.artifact_export_audit_events%ROWTYPE;
  replayed boolean := false;
BEGIN
  IF NOT COALESCE(
    pg_catalog.current_setting('lor_studio.operation', true) = 'read'
    AND actor_role = ANY (ARRAY['student', 'faculty']::text[])
    AND purpose = ANY (ARRAY['student_case_read', 'faculty_private_edit']::text[])
    AND pg_catalog.length(pg_catalog.btrim(scope_case_id)) BETWEEN 1 AND 200
    AND scope_case_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND scope_student_subject ~ '^wp:[1-9][0-9]*$'
    AND actor_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true'
    AND NULLIF(
      pg_catalog.current_setting('lor_studio.assignment_id', true),
      ''
    ) IS NULL
    AND NULLIF(
      pg_catalog.current_setting('lor_studio.administrative_grant_id', true),
      ''
    ) IS NULL,
    false
  ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  BEGIN
    actor_uid := NULLIF(actor_uid_text, '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END;

  IF actor_uid IS NULL THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  SELECT candidate.student_auth_uid
  INTO resource_uid
  FROM lor_studio.recommendation_cases AS candidate
  WHERE candidate.case_id = scope_case_id
    AND candidate.student_auth_subject = scope_student_subject;

  IF NOT FOUND
    OR (
      actor_role = 'student'
      AND (
        purpose <> 'student_case_read'
        OR actor_subject <> scope_student_subject
        OR actor_uid IS DISTINCT FROM resource_uid
        OR NULLIF(invitation_id, '') IS NOT NULL
        OR NOT lor_studio.student_context_allows(
          scope_case_id,
          scope_student_subject,
          resource_uid,
          ARRAY['read']::text[]
        )
      )
    )
    OR (
      actor_role = 'faculty'
      AND (
        purpose <> 'faculty_private_edit'
        OR pg_catalog.length(pg_catalog.btrim(invitation_id)) NOT BETWEEN 1 AND 200
        OR NOT lor_studio.faculty_context_allows(
          scope_case_id,
          scope_student_subject,
          ARRAY['read']::text[]
        )
      )
    )
  THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  IF pg_catalog.jsonb_typeof(candidate_event) IS DISTINCT FROM 'object'
    OR candidate_event_hash !~ '^[a-f0-9]{64}$'
    OR candidate_scope_hash !~ '^[a-f0-9]{64}$'
    OR candidate_target_binding_hash !~ '^[a-f0-9]{64}$'
    OR lor_studio.canonical_jsonb_sha256(candidate_event)
      IS DISTINCT FROM candidate_event_hash
  THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  SELECT pg_catalog.count(*)
  INTO event_key_count
  FROM pg_catalog.jsonb_object_keys(candidate_event);

  IF event_key_count <> 10
    OR NOT candidate_event ?& ARRAY[
      'schemaVersion',
      'eventId',
      'type',
      'at',
      'actorRole',
      'actorRef',
      'caseRef',
      'targetRef',
      'outcome',
      'metadata'
    ]::text[]
    OR pg_catalog.jsonb_typeof(candidate_event -> 'schemaVersion') <> 'number'
    OR candidate_event ->> 'schemaVersion' <> '1'
    OR pg_catalog.jsonb_typeof(candidate_event -> 'eventId') <> 'string'
    OR candidate_event ->> 'eventId'
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR pg_catalog.jsonb_typeof(candidate_event -> 'type') <> 'string'
    OR candidate_event ->> 'type'
      <> ALL (ARRAY['artifact.generated', 'artifact.denied']::text[])
    OR pg_catalog.jsonb_typeof(candidate_event -> 'at') <> 'string'
    OR pg_catalog.jsonb_typeof(candidate_event -> 'actorRole') <> 'string'
    OR candidate_event ->> 'actorRole' <> actor_role
    OR pg_catalog.jsonb_typeof(candidate_event -> 'actorRef') <> 'string'
    OR pg_catalog.jsonb_typeof(candidate_event -> 'caseRef') <> 'string'
    OR pg_catalog.jsonb_typeof(candidate_event -> 'targetRef') <> 'string'
    OR pg_catalog.jsonb_typeof(candidate_event -> 'outcome') <> 'string'
    OR pg_catalog.jsonb_typeof(candidate_event -> 'metadata') <> 'object'
  THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  candidate_event_id := (candidate_event ->> 'eventId')::uuid;
  expected_actor_ref := pg_catalog.substring(
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        'lor-studio:actor:' || actor_subject,
        'UTF8'
      )),
      'hex'
    ),
    1,
    24
  );
  expected_case_ref := pg_catalog.substring(
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        'lor-studio:case:' || scope_case_id,
        'UTF8'
      )),
      'hex'
    ),
    1,
    24
  );

  IF candidate_event ->> 'actorRef' IS DISTINCT FROM expected_actor_ref
    OR candidate_event ->> 'caseRef' IS DISTINCT FROM expected_case_ref
    OR NOT (
      candidate_event ->> 'targetRef' = ''
      OR candidate_event ->> 'targetRef' ~ '^[a-f0-9]{24}$'
    )
    OR (
      candidate_event ->> 'type' = 'artifact.generated'
      AND (
        candidate_event ->> 'outcome' <> 'success'
        OR candidate_event ->> 'targetRef' !~ '^[a-f0-9]{24}$'
      )
    )
    OR (
      candidate_event ->> 'type' = 'artifact.denied'
      AND candidate_event ->> 'outcome' <> 'denied'
    )
  THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  SELECT pg_catalog.count(*)
  INTO metadata_key_count
  FROM pg_catalog.jsonb_object_keys(candidate_event -> 'metadata');

  IF metadata_key_count <> (CASE
      WHEN candidate_event ->> 'type' = 'artifact.generated' THEN 6
      ELSE 3
    END)
    OR NOT (candidate_event -> 'metadata') ?& ARRAY[
      'action',
      'artifactFormat',
      CASE
        WHEN candidate_event ->> 'type' = 'artifact.generated' THEN 'result'
        ELSE 'reasonCode'
      END
    ]::text[]
    OR candidate_event -> 'metadata' ->> 'action'
      IS DISTINCT FROM 'export_final_document'
    OR candidate_event -> 'metadata' ->> 'artifactFormat'
      IS DISTINCT FROM 'docx'
    OR (
      candidate_event ->> 'type' = 'artifact.generated'
      AND (
        NOT (candidate_event -> 'metadata') ?& ARRAY[
          'artifactSha256', 'releaseDocumentHash', 'sourceRevision'
        ]::text[]
        OR candidate_event -> 'metadata' ->> 'result'
          IS DISTINCT FROM CASE
            WHEN actor_role = 'student' THEN 'student_visible'
            ELSE 'faculty_owner'
          END
        OR pg_catalog.jsonb_typeof(
          candidate_event -> 'metadata' -> 'artifactSha256'
        ) <> 'string'
        OR candidate_event -> 'metadata' ->> 'artifactSha256'
          !~ '^[a-f0-9]{64}$'
        OR NOT (
          candidate_event -> 'metadata' -> 'releaseDocumentHash' = 'null'::jsonb
          OR (
            pg_catalog.jsonb_typeof(
              candidate_event -> 'metadata' -> 'releaseDocumentHash'
            ) = 'string'
            AND candidate_event -> 'metadata' ->> 'releaseDocumentHash'
              ~ '^[a-f0-9]{64}$'
          )
        )
        OR (
          actor_role = 'student'
          AND candidate_event -> 'metadata' -> 'releaseDocumentHash' = 'null'::jsonb
        )
        OR pg_catalog.jsonb_typeof(
          candidate_event -> 'metadata' -> 'sourceRevision'
        ) <> 'number'
        OR candidate_event -> 'metadata' ->> 'sourceRevision'
          !~ '^(0|[1-9][0-9]*)$'
      )
    )
    OR (
      candidate_event ->> 'type' = 'artifact.denied'
      AND (
        candidate_event -> 'metadata' ?| ARRAY[
          'artifactSha256', 'releaseDocumentHash', 'sourceRevision'
        ]::text[]
        OR candidate_event -> 'metadata' ->> 'reasonCode'
          !~ '^[A-Za-z0-9_.:/ -]{1,120}$'
      )
    )
  THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  BEGIN
    event_timestamp := (candidate_event ->> 'at')::timestamp with time zone;
  EXCEPTION
    WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END;

  IF candidate_event ->> 'at' IS DISTINCT FROM pg_catalog.to_char(
    event_timestamp AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ) THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  SELECT existing.*
  INTO stored_event
  FROM lor_studio.artifact_export_audit_events AS existing
  WHERE existing.event_id = candidate_event_id;

  IF FOUND THEN
    replayed := true;
  ELSE
    IF event_timestamp < pg_catalog.statement_timestamp() - interval '15 minutes'
      OR event_timestamp > pg_catalog.statement_timestamp() + interval '1 minute'
    THEN
      RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
    END IF;

    INSERT INTO lor_studio.artifact_export_audit_events (
      event_id,
      case_id,
      student_auth_subject,
      actor_auth_subject,
      actor_role,
      event_type,
      outcome,
      event_hash,
      scope_hash,
      target_binding_hash,
      artifact_sha256,
      release_document_hash,
      source_revision,
      event,
      transaction_id,
      committed_at
    )
    VALUES (
      candidate_event_id,
      scope_case_id,
      scope_student_subject,
      actor_subject,
      actor_role,
      candidate_event ->> 'type',
      candidate_event ->> 'outcome',
      candidate_event_hash,
      candidate_scope_hash,
      candidate_target_binding_hash,
      CASE WHEN candidate_event ->> 'type' = 'artifact.generated'
        THEN candidate_event -> 'metadata' ->> 'artifactSha256' ELSE NULL END,
      CASE WHEN candidate_event ->> 'type' = 'artifact.generated'
        THEN NULLIF(candidate_event -> 'metadata' ->> 'releaseDocumentHash', '')
        ELSE NULL END,
      CASE WHEN candidate_event ->> 'type' = 'artifact.generated'
        THEN (candidate_event -> 'metadata' ->> 'sourceRevision')::bigint
        ELSE NULL END,
      candidate_event,
      transaction_id,
      pg_catalog.statement_timestamp()
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING * INTO stored_event;

    IF NOT FOUND THEN
      SELECT existing.*
      INTO stored_event
      FROM lor_studio.artifact_export_audit_events AS existing
      WHERE existing.event_id = candidate_event_id;
      replayed := true;
    END IF;
  END IF;

  IF stored_event.event_id IS NULL
    OR stored_event.case_id IS DISTINCT FROM scope_case_id
    OR stored_event.student_auth_subject IS DISTINCT FROM scope_student_subject
    OR stored_event.actor_auth_subject IS DISTINCT FROM actor_subject
    OR stored_event.actor_role IS DISTINCT FROM actor_role
    OR stored_event.event_type IS DISTINCT FROM candidate_event ->> 'type'
    OR stored_event.outcome IS DISTINCT FROM candidate_event ->> 'outcome'
    OR stored_event.event_hash IS DISTINCT FROM candidate_event_hash
    OR stored_event.scope_hash IS DISTINCT FROM candidate_scope_hash
    OR stored_event.target_binding_hash IS DISTINCT FROM candidate_target_binding_hash
    OR stored_event.artifact_sha256 IS DISTINCT FROM (CASE
      WHEN candidate_event ->> 'type' = 'artifact.generated'
        THEN candidate_event -> 'metadata' ->> 'artifactSha256'
      ELSE NULL
    END)
    OR stored_event.release_document_hash IS DISTINCT FROM (CASE
      WHEN candidate_event ->> 'type' = 'artifact.generated'
        THEN NULLIF(candidate_event -> 'metadata' ->> 'releaseDocumentHash', '')
      ELSE NULL
    END)
    OR stored_event.source_revision IS DISTINCT FROM (CASE
      WHEN candidate_event ->> 'type' = 'artifact.generated'
        THEN (candidate_event -> 'metadata' ->> 'sourceRevision')::bigint
      ELSE NULL
    END)
    OR stored_event.event IS DISTINCT FROM candidate_event
  THEN
    RAISE EXCEPTION 'LOR_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1002';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.artifact-audit-receipt.v1',
    'accepted', true,
    'replayed', replayed,
    'caseId', stored_event.case_id,
    'eventId', stored_event.event_id::text,
    'eventType', stored_event.event_type,
    'outcome', stored_event.outcome,
    'eventHash', stored_event.event_hash,
    'scopeHash', stored_event.scope_hash,
    'targetBindingHash', stored_event.target_binding_hash,
    'artifactSha256', stored_event.artifact_sha256,
    'releaseDocumentHash', stored_event.release_document_hash,
    'sourceRevision', stored_event.source_revision,
    'transactionRef', 'txn_' || pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        stored_event.transaction_id || ':' || stored_event.event_id::text
          || ':' || stored_event.event_hash,
        'UTF8'
      )),
      'hex'
    ),
    'committedAt', pg_catalog.to_char(
      stored_event.committed_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );
EXCEPTION
  WHEN SQLSTATE 'P1002' OR SQLSTATE 'P1004' OR SQLSTATE 'P1005' THEN
    RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
END;
$artifact_export_audit$;

CREATE FUNCTION lor_studio.read_final_document_export()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $final_document_export$
DECLARE
  scope_case_id text := pg_catalog.current_setting('lor_studio.case_id', true);
  scope_student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id',
    true
  );
  actor_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject',
    true
  );
  actor_role text := pg_catalog.current_setting('lor_studio.actor_role', true);
  actor_uid_text text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  scope_invitation_id text := pg_catalog.current_setting(
    'lor_studio.invitation_id',
    true
  );
  actor_uid uuid;
  recommendation_case lor_studio.recommendation_cases%ROWTYPE;
  private_content lor_studio.faculty_private_content%ROWTYPE;
  released_document lor_studio.released_student_documents%ROWTYPE;
  waiver_projection jsonb;
  private_record jsonb;
  released_snapshot jsonb;
  actor_reference text;
  faculty_reference text;
BEGIN
  IF NOT COALESCE(
    actor_role = ANY (ARRAY['student', 'faculty']::text[])
    AND pg_catalog.current_setting('lor_studio.operation', true) = 'read'
    AND pg_catalog.length(pg_catalog.btrim(scope_case_id)) BETWEEN 1 AND 200
    AND scope_student_subject ~ '^wp:[1-9][0-9]*$'
    AND actor_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true'
    AND NULLIF(
      pg_catalog.current_setting('lor_studio.assignment_id', true),
      ''
    ) IS NULL
    AND NULLIF(
      pg_catalog.current_setting('lor_studio.administrative_grant_id', true),
      ''
    ) IS NULL,
    false
  ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  BEGIN
    actor_uid := NULLIF(actor_uid_text, '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END;

  IF actor_uid IS NULL THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  actor_reference := 'actor_' || pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      'lor-studio:actor:' || actor_subject,
      'UTF8'
    )),
    'hex'
  );

  IF actor_role = 'student' THEN
    IF actor_subject <> scope_student_subject
       OR pg_catalog.current_setting('lor_studio.purpose', true)
         <> 'student_case_read'
       OR NULLIF(scope_invitation_id, '') IS NOT NULL THEN
      RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
    END IF;

    SELECT candidate.*
    INTO recommendation_case
    FROM lor_studio.recommendation_cases AS candidate
    WHERE candidate.case_id = scope_case_id
      AND candidate.student_auth_subject = scope_student_subject
      AND candidate.student_auth_uid = actor_uid
      AND lor_studio.student_context_allows(
        candidate.case_id,
        candidate.student_auth_subject,
        candidate.student_auth_uid,
        ARRAY['read']::text[]
      );

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    SELECT candidate.*
    INTO released_document
    FROM lor_studio.released_student_documents AS candidate
    WHERE candidate.case_id = scope_case_id
      AND candidate.student_auth_subject = scope_student_subject;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    released_snapshot := pg_catalog.jsonb_build_object(
      'finalDocument', pg_catalog.jsonb_build_object(
        'id', released_document.final_document_id,
        'text', released_document.final_document_text,
        'contentHash', released_document.final_document_content_hash,
        'mimeType', released_document.final_document_mime_type,
        'releasedToStudentAt', pg_catalog.to_char(
          released_document.released_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      ),
      'facultyApproval', pg_catalog.jsonb_build_object(
        'approved', released_document.approval_approved,
        'approvedAt', pg_catalog.to_char(
          released_document.approval_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'facultyRef', released_document.approval_faculty_ref,
        'signatureAttested', released_document.approval_signature_attested
      ),
      'release', pg_catalog.jsonb_build_object(
        'documentId', released_document.release_document_id,
        'documentHash', released_document.release_document_hash,
        'releasedAt', pg_catalog.to_char(
          released_document.released_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'releasedAtRevision', released_document.released_at_revision,
        'waiverReceiptId', released_document.waiver_receipt_id
      )
    );

    IF released_document.snapshot_hash
       <> lor_studio.canonical_jsonb_sha256(released_snapshot)
       OR released_document.release_document_hash
         <> lor_studio.release_document_hash(
           released_document.final_document_content_hash,
           released_document.final_document_id,
           released_document.final_document_mime_type,
           released_document.final_document_text
         ) THEN
      RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.final-document-export.v1',
      'caseId', recommendation_case.case_id,
      'studentId', recommendation_case.student_auth_subject,
      'actorRef', actor_reference,
      'actorRole', 'student',
      'revision', recommendation_case.revision,
      'finalDocument', released_snapshot -> 'finalDocument',
      'documentState', 'faculty_final',
      'facultyApproval', released_snapshot -> 'facultyApproval',
      'waiverState', pg_catalog.jsonb_build_object(
        'decided', true,
        'receiptId', released_document.waiver_receipt_id,
        'waived', false
      ),
      'release', released_snapshot -> 'release',
      'exportProjection', 'student_visible'
    );
  END IF;

  IF pg_catalog.current_setting('lor_studio.purpose', true)
       <> 'faculty_private_edit'
     OR pg_catalog.length(pg_catalog.btrim(scope_invitation_id))
       NOT BETWEEN 1 AND 200
     OR NOT lor_studio.faculty_context_allows(
       scope_case_id,
       scope_student_subject,
       ARRAY['read']::text[]
     ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  SELECT candidate.*
  INTO recommendation_case
  FROM lor_studio.recommendation_cases AS candidate
  WHERE candidate.case_id = scope_case_id
    AND candidate.student_auth_subject = scope_student_subject;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT candidate.*
  INTO private_content
  FROM lor_studio.faculty_private_content AS candidate
  WHERE candidate.case_id = scope_case_id
    AND candidate.student_auth_subject = scope_student_subject
    AND candidate.faculty_auth_subject = actor_subject
    AND candidate.faculty_auth_uid = actor_uid
    AND candidate.invitation_id = scope_invitation_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  private_record := pg_catalog.jsonb_build_object(
    'facultyPrivate', pg_catalog.jsonb_build_object(
      'answers', private_content.answers,
      'notes', private_content.notes,
      'draftText', private_content.draft_text,
      'finalDocument', CASE
        WHEN private_content.final_document_id IS NULL THEN NULL::jsonb
        ELSE pg_catalog.jsonb_build_object(
          'contentHash', private_content.final_document_content_hash,
          'id', private_content.final_document_id,
          'mimeType', private_content.final_document_mime_type,
          'text', private_content.final_document_text,
          'releasedToStudentAt', CASE
            WHEN private_content.released_at IS NULL THEN NULL
            ELSE pg_catalog.to_char(
              private_content.released_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            )
          END
        )
      END
    ),
    'finalDocumentState', pg_catalog.jsonb_build_object(
      'documentState', private_content.document_state,
      'facultyApproval', CASE
        WHEN private_content.approval_approved IS NULL THEN NULL::jsonb
        ELSE pg_catalog.jsonb_build_object(
          'approved', private_content.approval_approved,
          'approvedAt', pg_catalog.to_char(
            private_content.approval_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
          'facultyId', private_content.approval_faculty_auth_subject,
          'signatureAttested', private_content.approval_signature_attested
        )
      END,
      'release', CASE
        WHEN private_content.released_at IS NULL THEN NULL::jsonb
        ELSE pg_catalog.jsonb_build_object(
          'documentHash', private_content.release_document_hash,
          'documentId', private_content.release_document_id,
          'releasedAt', pg_catalog.to_char(
            private_content.released_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
          'releasedAtRevision', private_content.released_at_revision,
          'waiverReceiptId', private_content.release_waiver_receipt_id
        )
      END
    )
  );

  IF NOT lor_studio.private_record_is_complete(private_record)
     OR private_content.private_record_hash
       <> lor_studio.canonical_jsonb_sha256(private_record) THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'decided', true,
    'receiptId', receipt.receipt_id,
    'waived', receipt.waived
  )
  INTO waiver_projection
  FROM lor_studio.waiver_receipts AS receipt
  WHERE receipt.case_id = scope_case_id
    AND receipt.student_auth_subject = scope_student_subject
    AND receipt.case_revision <= recommendation_case.revision
    AND NOT EXISTS (
      SELECT 1
      FROM lor_studio.waiver_receipts AS successor
      WHERE successor.prior_receipt_id = receipt.receipt_id
        AND successor.case_id = receipt.case_id
        AND successor.student_auth_subject = receipt.student_auth_subject
        AND successor.case_revision <= recommendation_case.revision
    )
  ORDER BY receipt.case_revision DESC, receipt.recorded_at DESC, receipt.receipt_id DESC
  LIMIT 1;

  IF waiver_projection IS NULL THEN
    waiver_projection := pg_catalog.jsonb_build_object(
      'decided', false,
      'receiptId', NULL,
      'waived', NULL
    );
  END IF;

  faculty_reference := CASE
    WHEN private_content.approval_faculty_auth_subject IS NULL THEN NULL
    ELSE 'faculty_' || pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        'lor-studio:faculty:' || private_content.approval_faculty_auth_subject,
        'UTF8'
      )),
      'hex'
    )
  END;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.final-document-export.v1',
    'caseId', recommendation_case.case_id,
    'studentId', recommendation_case.student_auth_subject,
    'actorRef', actor_reference,
    'actorRole', 'faculty',
    'revision', recommendation_case.revision,
    'finalDocument', private_record -> 'facultyPrivate' -> 'finalDocument',
    'documentState', private_record -> 'finalDocumentState' -> 'documentState',
    'facultyApproval', CASE
      WHEN private_record -> 'finalDocumentState' -> 'facultyApproval' = 'null'::jsonb
        THEN NULL::jsonb
      ELSE pg_catalog.jsonb_build_object(
        'approved', private_content.approval_approved,
        'approvedAt', pg_catalog.to_char(
          private_content.approval_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'facultyRef', faculty_reference,
        'signatureAttested', private_content.approval_signature_attested
      )
    END,
    'waiverState', waiver_projection,
    'release', private_record -> 'finalDocumentState' -> 'release',
    'exportProjection', 'faculty_owner'
  );
EXCEPTION
  WHEN SQLSTATE 'P1004' OR SQLSTATE 'P1005' THEN
    RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
END;
$final_document_export$;

CREATE FUNCTION lor_studio.commit_faculty_private_content(
  candidate_expected_revision bigint,
  candidate_content jsonb,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_event jsonb,
  candidate_event_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $faculty_private_content$
DECLARE
  scope_case_id text := pg_catalog.current_setting('lor_studio.case_id', true);
  scope_student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id',
    true
  );
  faculty_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject',
    true
  );
  faculty_uid_text text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  scope_invitation_id text := pg_catalog.current_setting(
    'lor_studio.invitation_id',
    true
  );
  faculty_uid uuid;
  recommendation_case lor_studio.recommendation_cases%ROWTYPE;
  private_content lor_studio.faculty_private_content%ROWTYPE;
  previous_protected lor_studio.recommendation_case_protected_revision_states%ROWTYPE;
  stored_receipt lor_studio.recommendation_case_private_write_receipts%ROWTYPE;
  replayed boolean := false;
  receipt_found boolean := false;
  private_found boolean := false;
  event_occurred_at timestamptz;
  event_occurred_at_iso text;
  candidate_approval_at timestamptz;
  candidate_approval_at_iso text;
  next_revision bigint;
  transaction_id text;
  expected_request_hash text;
  expected_event_ref text;
  expected_case_ref text;
  expected_actor_ref text;
  expected_correlation_ref text;
  safe_record_hash text;
  new_private_record jsonb;
  new_private_record_hash text;
  protected_changes jsonb;
  version_entry jsonb;
  new_protected_state jsonb;
  new_protected_state_hash text;
  consent_projection jsonb;
  waiver_projection jsonb;
  state_projection jsonb;
  affected_rows integer;
BEGIN
  IF NOT COALESCE(
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.operation', true) = 'save'
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
    AND pg_catalog.length(pg_catalog.btrim(scope_case_id)) BETWEEN 1 AND 200
    AND scope_student_subject ~ '^wp:[1-9][0-9]*$'
    AND faculty_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.length(pg_catalog.btrim(scope_invitation_id)) BETWEEN 1 AND 200
    AND NULLIF(
      pg_catalog.current_setting('lor_studio.assignment_id', true),
      ''
    ) IS NULL
    AND NULLIF(
      pg_catalog.current_setting('lor_studio.administrative_grant_id', true),
      ''
    ) IS NULL
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true',
    false
  ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  BEGIN
    faculty_uid := NULLIF(faculty_uid_text, '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END;

  IF faculty_uid IS NULL
     OR NOT lor_studio.student_write_axes_satisfied()
     OR NOT lor_studio.faculty_context_allows(
       scope_case_id,
       scope_student_subject,
       ARRAY['save']::text[]
     ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1',
      scope_case_id,
      scope_student_subject
    )::text,
    0
  ));

  IF candidate_idempotency_key IS NULL
     OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 240
     OR pg_catalog.length(pg_catalog.btrim(candidate_idempotency_key)) = 0
     OR candidate_request_hash IS NULL
     OR candidate_request_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  SELECT receipt.*
  INTO stored_receipt
  FROM lor_studio.recommendation_case_private_write_receipts AS receipt
  WHERE receipt.case_id = scope_case_id
    AND receipt.student_auth_subject = scope_student_subject
    AND receipt.idempotency_key = candidate_idempotency_key;
  receipt_found := FOUND;

  IF receipt_found THEN
    IF stored_receipt.command_type <> 'faculty.private_content_update'
       OR stored_receipt.operation <> 'save'
       OR stored_receipt.request_hash <> candidate_request_hash
       OR stored_receipt.faculty_auth_subject <> faculty_subject
       OR stored_receipt.faculty_auth_uid <> faculty_uid THEN
      RAISE EXCEPTION 'LOR_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1003';
    END IF;
    replayed := true;
  ELSE
    SELECT candidate.*
    INTO recommendation_case
    FROM lor_studio.recommendation_cases AS candidate
    WHERE candidate.case_id = scope_case_id
      AND candidate.student_auth_subject = scope_student_subject
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'LOR_CASE_NOT_FOUND' USING ERRCODE = 'P1001';
    END IF;

    SELECT receipt.*
    INTO stored_receipt
    FROM lor_studio.recommendation_case_private_write_receipts AS receipt
    WHERE receipt.case_id = scope_case_id
      AND receipt.student_auth_subject = scope_student_subject
      AND receipt.idempotency_key = candidate_idempotency_key;
    receipt_found := FOUND;

    IF receipt_found THEN
      IF stored_receipt.command_type <> 'faculty.private_content_update'
         OR stored_receipt.operation <> 'save'
         OR stored_receipt.request_hash <> candidate_request_hash
         OR stored_receipt.faculty_auth_subject <> faculty_subject
         OR stored_receipt.faculty_auth_uid <> faculty_uid THEN
        RAISE EXCEPTION 'LOR_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1003';
      END IF;
      replayed := true;
    ELSE
      IF candidate_expected_revision IS NULL
         OR candidate_expected_revision < 0
         OR candidate_expected_revision <> recommendation_case.revision THEN
        RAISE EXCEPTION 'LOR_STALE_REVISION' USING ERRCODE = 'P1002';
      END IF;

      IF recommendation_case.status <> ALL (
           ARRAY['faculty_verified', 'faculty_review', 'faculty_approved']::text[]
         )
         OR recommendation_case.released_at IS NOT NULL
         OR recommendation_case.release_document_id IS NOT NULL
         OR recommendation_case.release_document_hash IS NOT NULL
         OR recommendation_case.released_at_revision IS NOT NULL
         OR recommendation_case.release_waiver_receipt_id IS NOT NULL THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      SELECT candidate.*
      INTO private_content
      FROM lor_studio.faculty_private_content AS candidate
      WHERE candidate.case_id = scope_case_id
        AND candidate.student_auth_subject = scope_student_subject
        AND candidate.faculty_auth_subject = faculty_subject
        AND candidate.faculty_auth_uid = faculty_uid
        AND candidate.invitation_id = scope_invitation_id
      FOR UPDATE;
      private_found := FOUND;

      IF private_found AND (
        private_content.private_revision <> recommendation_case.revision
        OR private_content.release_document_hash IS NOT NULL
        OR private_content.release_document_id IS NOT NULL
        OR private_content.released_at IS NOT NULL
        OR private_content.released_at_revision IS NOT NULL
        OR private_content.release_waiver_receipt_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      SELECT protected.*
      INTO previous_protected
      FROM lor_studio.recommendation_case_protected_revision_states AS protected
      WHERE protected.case_id = scope_case_id
        AND protected.student_auth_subject = scope_student_subject
        AND protected.revision = recommendation_case.revision
        AND protected.protected_state_hash =
          recommendation_case.protected_state_hash;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      IF NOT COALESCE(
        pg_catalog.jsonb_typeof(candidate_content) = 'object'
        AND pg_catalog.octet_length(candidate_content::text) <= 524288
        AND candidate_content ?& ARRAY[
          'answers',
          'notes',
          'draftText',
          'finalDocument',
          'documentState',
          'facultyApproval'
        ]::text[]
        AND (
          SELECT pg_catalog.count(*) = 6
          FROM pg_catalog.jsonb_object_keys(candidate_content)
        )
        AND pg_catalog.jsonb_typeof(candidate_content -> 'answers') = 'array'
        AND pg_catalog.jsonb_array_length(candidate_content -> 'answers') <= 500
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(
            candidate_content -> 'answers'
          ) AS answer(value)
          WHERE pg_catalog.jsonb_typeof(answer.value) <> 'object'
        )
        AND pg_catalog.jsonb_typeof(candidate_content -> 'notes') = 'array'
        AND pg_catalog.jsonb_array_length(candidate_content -> 'notes') <= 500
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(
            candidate_content -> 'notes'
          ) AS note(value)
          WHERE pg_catalog.jsonb_typeof(note.value) <> 'object'
        )
        AND (
          pg_catalog.jsonb_typeof(candidate_content -> 'draftText') = 'null'
          OR (
            pg_catalog.jsonb_typeof(candidate_content -> 'draftText') = 'string'
            AND pg_catalog.octet_length(candidate_content ->> 'draftText') <= 256000
          )
        )
        AND (
          pg_catalog.jsonb_typeof(candidate_content -> 'finalDocument') = 'null'
          OR (
            pg_catalog.jsonb_typeof(candidate_content -> 'finalDocument') = 'object'
            AND (candidate_content -> 'finalDocument') ?& ARRAY[
              'contentHash',
              'id',
              'mimeType',
              'text'
            ]::text[]
            AND (
              SELECT pg_catalog.count(*) = 4
              FROM pg_catalog.jsonb_object_keys(
                candidate_content -> 'finalDocument'
              )
            )
            AND pg_catalog.jsonb_typeof(
              candidate_content -> 'finalDocument' -> 'id'
            ) = 'string'
            AND pg_catalog.length(
              candidate_content -> 'finalDocument' ->> 'id'
            ) BETWEEN 1 AND 200
            AND pg_catalog.jsonb_typeof(
              candidate_content -> 'finalDocument' -> 'text'
            ) = 'string'
            AND pg_catalog.octet_length(
              candidate_content -> 'finalDocument' ->> 'text'
            ) BETWEEN 1 AND 256000
            AND (
              pg_catalog.jsonb_typeof(
                candidate_content -> 'finalDocument' -> 'contentHash'
              ) = 'null'
              OR (
                pg_catalog.jsonb_typeof(
                  candidate_content -> 'finalDocument' -> 'contentHash'
                ) = 'string'
                AND (
                  candidate_content -> 'finalDocument' ->> 'contentHash'
                ) ~ '^[a-f0-9]{64}$'
              )
            )
            AND (
              pg_catalog.jsonb_typeof(
                candidate_content -> 'finalDocument' -> 'mimeType'
              ) = 'null'
              OR (
                pg_catalog.jsonb_typeof(
                  candidate_content -> 'finalDocument' -> 'mimeType'
                ) = 'string'
                AND pg_catalog.length(
                  candidate_content -> 'finalDocument' ->> 'mimeType'
                ) BETWEEN 1 AND 160
              )
            )
          )
        )
        AND (
          pg_catalog.jsonb_typeof(candidate_content -> 'documentState') = 'null'
          OR (
            pg_catalog.jsonb_typeof(candidate_content -> 'documentState') = 'string'
            AND candidate_content ->> 'documentState'
              IN ('ai_proposal', 'faculty_final')
          )
        )
        AND (
          pg_catalog.jsonb_typeof(candidate_content -> 'facultyApproval') = 'null'
          OR (
            pg_catalog.jsonb_typeof(candidate_content -> 'facultyApproval') = 'object'
            AND (candidate_content -> 'facultyApproval') ?& ARRAY[
              'approved',
              'approvedAt',
              'facultyId',
              'signatureAttested'
            ]::text[]
            AND (
              SELECT pg_catalog.count(*) = 4
              FROM pg_catalog.jsonb_object_keys(
                candidate_content -> 'facultyApproval'
              )
            )
            AND pg_catalog.jsonb_typeof(
              candidate_content -> 'facultyApproval' -> 'approved'
            ) = 'boolean'
            AND pg_catalog.jsonb_typeof(
              candidate_content -> 'facultyApproval' -> 'signatureAttested'
            ) = 'boolean'
            AND candidate_content -> 'facultyApproval' ->> 'approved' = 'true'
            AND candidate_content -> 'facultyApproval'
              ->> 'signatureAttested' = 'true'
            AND pg_catalog.jsonb_typeof(
              candidate_content -> 'facultyApproval' -> 'approvedAt'
            ) = 'string'
            AND (
              candidate_content -> 'facultyApproval' ->> 'approvedAt'
            ) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
            AND candidate_content -> 'facultyApproval' ->> 'facultyId'
              = faculty_subject
          )
        )
        AND (
          pg_catalog.jsonb_typeof(candidate_content -> 'finalDocument') <> 'null'
          OR (
            pg_catalog.jsonb_typeof(candidate_content -> 'documentState') = 'null'
            AND pg_catalog.jsonb_typeof(
              candidate_content -> 'facultyApproval'
            ) = 'null'
          )
        ),
        false
      ) THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      IF candidate_event IS NULL
         OR NOT lor_studio.audit_event_is_metadata(candidate_event)
         OR candidate_event_hash IS NULL
         OR candidate_event_hash !~ '^[a-f0-9]{64}$'
         OR candidate_event_hash
           <> lor_studio.canonical_jsonb_sha256(candidate_event)
         OR candidate_event ->> 'eventType'
           <> 'faculty.private_content_updated'
         OR candidate_event ->> 'actorRole' <> 'faculty'
         OR candidate_event ->> 'outcome' <> 'success'
         OR candidate_event ->> 'revision' !~ '^(0|[1-9][0-9]*)$'
         OR candidate_event ->> 'occurredAt' !~
           '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      next_revision := recommendation_case.revision + 1;
      event_occurred_at_iso := candidate_event ->> 'occurredAt';
      event_occurred_at := event_occurred_at_iso::timestamptz;

      IF pg_catalog.jsonb_typeof(
           candidate_content -> 'facultyApproval'
         ) <> 'null' THEN
        candidate_approval_at_iso :=
          candidate_content -> 'facultyApproval' ->> 'approvedAt';
        candidate_approval_at := candidate_approval_at_iso::timestamptz;
      END IF;

      expected_case_ref := 'case_' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          'lor-studio:case:' || scope_case_id,
          'UTF8'
        )),
        'hex'
      );
      expected_actor_ref := 'actor_' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          'lor-studio:actor:' || faculty_subject,
          'UTF8'
        )),
        'hex'
      );
      expected_event_ref := 'event_' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          'lor-studio:event:event_' || pg_catalog.substr(
            pg_catalog.encode(
              pg_catalog.sha256(pg_catalog.convert_to(
                scope_case_id || ':faculty.private_content_updated:'
                  || candidate_idempotency_key,
                'UTF8'
              )),
              'hex'
            ),
            1,
            32
          ),
          'UTF8'
        )),
        'hex'
      );
      expected_correlation_ref := 'correlation_' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          'lor-studio:correlation:' || pg_catalog.substr(
            pg_catalog.encode(
              pg_catalog.sha256(pg_catalog.convert_to(
                candidate_idempotency_key,
                'UTF8'
              )),
              'hex'
            ),
            1,
            32
          ),
          'UTF8'
        )),
        'hex'
      );
      expected_request_hash := lor_studio.canonical_jsonb_sha256(
        pg_catalog.jsonb_build_object(
          'operation', 'faculty.private_content_update',
          'caseId', scope_case_id,
          'actorId', faculty_subject,
          'payload', candidate_content
        )
      );

      IF candidate_event ->> 'eventRef' <> expected_event_ref
         OR candidate_event ->> 'caseRef' <> expected_case_ref
         OR candidate_event ->> 'actorRef' <> expected_actor_ref
         OR candidate_event ->> 'correlationRef'
           <> expected_correlation_ref
         OR (candidate_event ->> 'revision')::bigint <> next_revision
         OR candidate_request_hash <> expected_request_hash
         OR event_occurred_at > pg_catalog.statement_timestamp()
         OR event_occurred_at < recommendation_case.updated_at
         OR (
           private_found
           AND event_occurred_at < private_content.updated_at
         )
         OR (
           candidate_approval_at IS NOT NULL
           AND (
             candidate_approval_at_iso <> event_occurred_at_iso
             OR candidate_approval_at > pg_catalog.statement_timestamp()
             OR candidate_approval_at <> pg_catalog.date_trunc(
               'milliseconds',
               candidate_approval_at
             )
           )
         ) THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      safe_record_hash :=
        lor_studio.canonical_jsonb_sha256(recommendation_case.record);
      IF safe_record_hash <> recommendation_case.record_hash THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      new_private_record := pg_catalog.jsonb_build_object(
        'facultyPrivate', pg_catalog.jsonb_build_object(
          'answers', candidate_content -> 'answers',
          'notes', candidate_content -> 'notes',
          'draftText', candidate_content -> 'draftText',
          'finalDocument', CASE
            WHEN pg_catalog.jsonb_typeof(
              candidate_content -> 'finalDocument'
            ) = 'null' THEN NULL::jsonb
            ELSE (candidate_content -> 'finalDocument')
              || pg_catalog.jsonb_build_object(
                'releasedToStudentAt',
                NULL
              )
          END
        ),
        'finalDocumentState', pg_catalog.jsonb_build_object(
          'documentState', candidate_content -> 'documentState',
          'facultyApproval', candidate_content -> 'facultyApproval',
          'release', NULL
        )
      );

      IF NOT lor_studio.private_record_is_complete(new_private_record) THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;
      new_private_record_hash :=
        lor_studio.canonical_jsonb_sha256(new_private_record);

      protected_changes := pg_catalog.jsonb_build_object(
        'facultyPrivate', new_private_record -> 'facultyPrivate',
        'finalDocumentState', new_private_record -> 'finalDocumentState'
      );
      version_entry := pg_catalog.jsonb_build_object(
        'revision', next_revision,
        'eventType', 'faculty.private_content_updated',
        'actorId', faculty_subject,
        'occurredAt', event_occurred_at_iso,
        'changedFields', pg_catalog.jsonb_build_array(
          'facultyPrivate',
          'finalDocumentState'
        ),
        'changeHash',
          lor_studio.canonical_jsonb_sha256(protected_changes)
      );
      new_protected_state := pg_catalog.jsonb_set(
        previous_protected.protected_state,
        ARRAY['versionHistory']::text[],
        (previous_protected.protected_state -> 'versionHistory')
          || pg_catalog.jsonb_build_array(version_entry),
        false
      );

      IF NOT lor_studio.protected_case_state_is_complete(
        new_protected_state,
        next_revision
      ) THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      new_protected_state_hash := lor_studio.protected_state_chain_hash(
        scope_case_id,
        scope_student_subject,
        next_revision,
        previous_protected.protected_state_hash,
        candidate_event_hash,
        new_protected_state
      );
      transaction_id := pg_catalog.pg_current_xact_id()::text;

      UPDATE lor_studio.recommendation_cases AS candidate
      SET revision = next_revision,
          updated_at = event_occurred_at,
          record_hash = safe_record_hash,
          protected_state_hash = new_protected_state_hash
      WHERE candidate.case_id = scope_case_id
        AND candidate.student_auth_subject = scope_student_subject
        AND candidate.revision = candidate_expected_revision
        AND candidate.status = ANY (
          ARRAY['faculty_verified', 'faculty_review', 'faculty_approved']::text[]
        )
        AND candidate.released_at IS NULL;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN
        RAISE EXCEPTION 'LOR_STALE_REVISION' USING ERRCODE = 'P1002';
      END IF;

      IF private_found THEN
        UPDATE lor_studio.faculty_private_content AS candidate
        SET private_revision = next_revision,
            answers = candidate_content -> 'answers',
            notes = candidate_content -> 'notes',
            draft_text = candidate_content ->> 'draftText',
            final_document_id =
              candidate_content -> 'finalDocument' ->> 'id',
            final_document_text =
              candidate_content -> 'finalDocument' ->> 'text',
            final_document_content_hash =
              candidate_content -> 'finalDocument' ->> 'contentHash',
            final_document_mime_type =
              candidate_content -> 'finalDocument' ->> 'mimeType',
            document_state = candidate_content ->> 'documentState',
            approval_approved = CASE
              WHEN pg_catalog.jsonb_typeof(
                candidate_content -> 'facultyApproval'
              ) = 'null' THEN NULL
              ELSE (
                candidate_content -> 'facultyApproval' ->> 'approved'
              )::boolean
            END,
            approval_at = candidate_approval_at,
            approval_faculty_auth_subject = CASE
              WHEN candidate_approval_at IS NULL THEN NULL
              ELSE faculty_subject
            END,
            approval_signature_attested = CASE
              WHEN candidate_approval_at IS NULL THEN NULL
              ELSE (
                candidate_content -> 'facultyApproval'
                  ->> 'signatureAttested'
              )::boolean
            END,
            private_record_hash = new_private_record_hash,
            updated_at = event_occurred_at
        WHERE candidate.case_id = scope_case_id
          AND candidate.student_auth_subject = scope_student_subject
          AND candidate.faculty_auth_subject = faculty_subject
          AND candidate.faculty_auth_uid = faculty_uid
          AND candidate.invitation_id = scope_invitation_id
          AND candidate.private_revision = candidate_expected_revision
          AND candidate.released_at IS NULL;
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        IF affected_rows <> 1 THEN
          RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
        END IF;
      ELSE
        INSERT INTO lor_studio.faculty_private_content (
          case_id,
          student_auth_subject,
          faculty_auth_subject,
          faculty_auth_uid,
          invitation_id,
          private_revision,
          answers,
          notes,
          draft_text,
          final_document_id,
          final_document_text,
          final_document_content_hash,
          final_document_mime_type,
          document_state,
          approval_approved,
          approval_at,
          approval_faculty_auth_subject,
          approval_signature_attested,
          private_record_hash,
          created_at,
          updated_at
        ) VALUES (
          scope_case_id,
          scope_student_subject,
          faculty_subject,
          faculty_uid,
          scope_invitation_id,
          next_revision,
          candidate_content -> 'answers',
          candidate_content -> 'notes',
          candidate_content ->> 'draftText',
          candidate_content -> 'finalDocument' ->> 'id',
          candidate_content -> 'finalDocument' ->> 'text',
          candidate_content -> 'finalDocument' ->> 'contentHash',
          candidate_content -> 'finalDocument' ->> 'mimeType',
          candidate_content ->> 'documentState',
          CASE
            WHEN candidate_approval_at IS NULL THEN NULL
            ELSE (
              candidate_content -> 'facultyApproval' ->> 'approved'
            )::boolean
          END,
          candidate_approval_at,
          CASE WHEN candidate_approval_at IS NULL THEN NULL ELSE faculty_subject END,
          CASE
            WHEN candidate_approval_at IS NULL THEN NULL
            ELSE (
              candidate_content -> 'facultyApproval'
                ->> 'signatureAttested'
            )::boolean
          END,
          new_private_record_hash,
          event_occurred_at,
          event_occurred_at
        );
      END IF;

      INSERT INTO lor_studio.recommendation_case_audit_events (
        event_ref,
        case_id,
        student_auth_subject,
        case_ref,
        actor_ref,
        actor_role,
        correlation_ref,
        event_type,
        outcome,
        revision,
        occurred_at,
        event,
        event_hash,
        transaction_id
      ) VALUES (
        candidate_event ->> 'eventRef',
        scope_case_id,
        scope_student_subject,
        candidate_event ->> 'caseRef',
        candidate_event ->> 'actorRef',
        'faculty',
        candidate_event ->> 'correlationRef',
        'faculty.private_content_updated',
        'success',
        next_revision,
        event_occurred_at,
        candidate_event,
        candidate_event_hash,
        transaction_id
      );

      INSERT INTO lor_studio.recommendation_case_protected_revision_states (
        case_id,
        student_auth_subject,
        revision,
        previous_revision,
        previous_protected_state_hash,
        protected_state,
        protected_state_hash,
        event_hash,
        audit_event_ref,
        transaction_id,
        committed_at
      ) VALUES (
        scope_case_id,
        scope_student_subject,
        next_revision,
        recommendation_case.revision,
        previous_protected.protected_state_hash,
        new_protected_state,
        new_protected_state_hash,
        candidate_event_hash,
        candidate_event ->> 'eventRef',
        transaction_id,
        pg_catalog.transaction_timestamp()
      );

      INSERT INTO lor_studio.recommendation_case_private_write_receipts (
        case_id,
        student_auth_subject,
        faculty_auth_subject,
        faculty_auth_uid,
        idempotency_key,
        request_hash,
        command_type,
        operation,
        revision,
        status,
        created_at,
        updated_at,
        closed_at,
        safe_record,
        private_record,
        private_record_hash,
        safe_record_hash,
        protected_state_hash,
        released_snapshot_hash,
        event_hash,
        audit_event_ref,
        transaction_id,
        committed_at
      ) VALUES (
        scope_case_id,
        scope_student_subject,
        faculty_subject,
        faculty_uid,
        candidate_idempotency_key,
        candidate_request_hash,
        'faculty.private_content_update',
        'save',
        next_revision,
        recommendation_case.status,
        recommendation_case.created_at,
        event_occurred_at,
        recommendation_case.closed_at,
        recommendation_case.record,
        new_private_record,
        new_private_record_hash,
        safe_record_hash,
        new_protected_state_hash,
        NULL,
        candidate_event_hash,
        candidate_event ->> 'eventRef',
        transaction_id,
        pg_catalog.transaction_timestamp()
      )
      RETURNING * INTO stored_receipt;
    END IF;
  END IF;

  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.consent-receipt.v1',
        'id', receipt.receipt_id,
        'caseId', receipt.case_id,
        'actorId', receipt.student_auth_subject,
        'scopes', pg_catalog.to_jsonb(receipt.scopes),
        'policyVersion', receipt.policy_version,
        'recordedAt', pg_catalog.to_char(
          receipt.recorded_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'receiptHash', receipt.receipt_hash
      )
      ORDER BY receipt.case_revision, receipt.recorded_at, receipt.receipt_id
    ),
    '[]'::jsonb
  )
  INTO consent_projection
  FROM lor_studio.consent_receipts AS receipt
  WHERE receipt.case_id = stored_receipt.case_id
    AND receipt.student_auth_subject = stored_receipt.student_auth_subject
    AND receipt.case_revision <= stored_receipt.revision;

  SELECT pg_catalog.jsonb_build_object(
    'decided', true,
    'receiptId', receipt.receipt_id,
    'waived', receipt.waived
  )
  INTO waiver_projection
  FROM lor_studio.waiver_receipts AS receipt
  WHERE receipt.case_id = stored_receipt.case_id
    AND receipt.student_auth_subject = stored_receipt.student_auth_subject
    AND receipt.case_revision <= stored_receipt.revision
    AND NOT EXISTS (
      SELECT 1
      FROM lor_studio.waiver_receipts AS successor
      WHERE successor.prior_receipt_id = receipt.receipt_id
        AND successor.case_id = receipt.case_id
        AND successor.student_auth_subject = receipt.student_auth_subject
        AND successor.case_revision <= stored_receipt.revision
    )
  ORDER BY receipt.case_revision DESC, receipt.recorded_at DESC, receipt.receipt_id DESC
  LIMIT 1;

  IF waiver_projection IS NULL THEN
    waiver_projection := pg_catalog.jsonb_build_object(
      'decided', false,
      'receiptId', NULL,
      'waived', NULL
    );
  END IF;

  state_projection := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.faculty-projection.v1',
    'caseId', stored_receipt.case_id,
    'revision', stored_receipt.revision,
    'status', stored_receipt.status,
    'studentShared', pg_catalog.jsonb_build_object(
      'evidence', stored_receipt.safe_record -> 'studentEvidence',
      'applicantOptions', stored_receipt.safe_record -> 'applicantOptions',
      'consentReceipts', consent_projection,
      'waiverState', waiver_projection
    ),
    'facultyPrivate', stored_receipt.private_record -> 'facultyPrivate',
    'delivery', stored_receipt.safe_record -> 'delivery'
  );

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.atomic-command-receipt.v2',
    'action', 'faculty.private_content_update',
    'committed', true,
    'replayed', replayed,
    'sameTransaction', true,
    'caseId', stored_receipt.case_id,
    'studentId', stored_receipt.student_auth_subject,
    'revision', stored_receipt.revision,
    'idempotencyKey', stored_receipt.idempotency_key,
    'requestHash', stored_receipt.request_hash,
    'safeRecordHash', stored_receipt.safe_record_hash,
    'protectedStateHash', stored_receipt.protected_state_hash,
    'eventHash', stored_receipt.event_hash,
    'auditEventRef', stored_receipt.audit_event_ref,
    'transactionId', stored_receipt.transaction_id,
    'state', state_projection
  );
EXCEPTION
  WHEN SQLSTATE 'P1001'
    OR SQLSTATE 'P1002'
    OR SQLSTATE 'P1003'
    OR SQLSTATE 'P1004'
    OR SQLSTATE 'P1005' THEN
    RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
END;
$faculty_private_content$;

REVOKE ALL ON TABLE lor_studio.artifact_export_audit_events
FROM PUBLIC;
REVOKE ALL ON TABLE lor_studio.artifact_export_audit_events
FROM lor_studio_app;
GRANT SELECT, INSERT ON TABLE lor_studio.artifact_export_audit_events
TO lor_studio_command_owner;

REVOKE ALL ON FUNCTION lor_studio.append_artifact_export_audit(
  jsonb,
  text,
  text,
  text
)
FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.read_final_document_export()
FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.commit_faculty_private_content(
  bigint,
  jsonb,
  text,
  text,
  jsonb,
  text
)
FROM PUBLIC;

ALTER FUNCTION lor_studio.append_artifact_export_audit(
  jsonb,
  text,
  text,
  text
)
OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.read_final_document_export()
OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.commit_faculty_private_content(
  bigint,
  jsonb,
  text,
  text,
  jsonb,
  text
)
OWNER TO lor_studio_command_owner;

GRANT EXECUTE ON FUNCTION lor_studio.append_artifact_export_audit(
  jsonb,
  text,
  text,
  text
)
TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.read_final_document_export()
TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.commit_faculty_private_content(
  bigint,
  jsonb,
  text,
  text,
  jsonb,
  text
)
TO lor_studio_app;

DO $postflight$
DECLARE
  command_constraint text;
BEGIN
  SELECT pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
  INTO STRICT command_constraint
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname = 'recommendation_case_private_write_receipts'
    AND constraint_row.conname =
      'recommendation_case_private_write_receipts_command_type_known';

  IF command_constraint NOT LIKE '%faculty.final_document_release%'
    OR command_constraint NOT LIKE '%faculty.private_content_update%'
    OR pg_catalog.to_regclass('lor_studio.artifact_export_audit_events') IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relname = 'artifact_export_audit_events'
        AND class.relrowsecurity
        AND class.relforcerowsecurity
    )
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.artifact_export_audit_events',
      'SELECT,INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_app',
      'lor_studio.artifact_export_audit_events',
      'SELECT,INSERT,UPDATE,DELETE'
    )
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.faculty_private_content',
      'INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_app',
      'lor_studio.faculty_private_content',
      'INSERT'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.read_final_document_export()',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.commit_faculty_private_content(bigint,jsonb,text,text,jsonb,text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.append_artifact_export_audit(jsonb,text,text,text)',
      'EXECUTE'
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = procedure.pronamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )) AS acl
      WHERE namespace.nspname = 'lor_studio'
        AND procedure.proname IN (
          'append_artifact_export_audit',
          'read_final_document_export',
          'commit_faculty_private_content'
        )
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'lor_studio'
        AND procedure.proname IN (
          'append_artifact_export_audit',
          'read_final_document_export',
          'commit_faculty_private_content'
        )
        AND (
          NOT procedure.prosecdef
          OR pg_catalog.pg_get_userbyid(procedure.proowner)
            <> 'lor_studio_command_owner'
          OR NOT COALESCE(
            procedure.proconfig @> ARRAY['search_path=""']::text[],
            false
          )
        )
    )
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_policy AS policy
      JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relname = 'artifact_export_audit_events'
        AND policy.polname IN (
          'artifact_export_audit_events_command_insert',
          'artifact_export_audit_events_command_select'
        )
    ) <> 2
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger AS trigger
      JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relname = 'artifact_export_audit_events'
        AND trigger.tgname = 'artifact_export_audit_events_append_only'
        AND NOT trigger.tgisinternal
    )
  THEN
    RAISE EXCEPTION 'DR-133 faculty-private/export migration postflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$postflight$;

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
    observed_sentinel || '|facultyPrivateExportCommands=20260826010700'
  );
END
$advance_sentinel$;

COMMIT;
