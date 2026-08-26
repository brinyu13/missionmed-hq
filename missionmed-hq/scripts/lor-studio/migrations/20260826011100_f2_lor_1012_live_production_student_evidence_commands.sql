-- Migration: 20260826011100_f2_lor_1012_live_production_student_evidence_commands.sql
-- Authority: F2-LOR-1012 / DR-133
-- Date: 2026-08-26
-- Depends on: 20260826010900_f2_lor_1012_live_production_ai_proposal_commands.sql
-- Description: Publish consented builder inputs as DB-derived, hash-bound evidence.
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
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000|identityScope=20260826010300|facultyInvitationCommands=20260826010500|facultyPrivateExportCommands=20260826010700|aiProposalCommands=20260826010900',
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
      pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
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
    RAISE EXCEPTION 'DR-133 evidence command migration requires the exact AI-successor private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.consent_receipts,
  lor_studio.faculty_invitations,
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_case_protected_revision_states,
  lor_studio.recommendation_case_write_receipts,
  lor_studio.recommendation_cases
IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE evidence_migration_preflight_counts (
  relation_count bigint NOT NULL,
  forced_rls_count bigint NOT NULL,
  definer_count bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO evidence_migration_preflight_counts
SELECT
  (SELECT pg_catalog.count(*)
   FROM pg_catalog.pg_class AS class
   JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
   WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r'),
  (SELECT pg_catalog.count(*)
   FROM pg_catalog.pg_class AS class
   JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
   WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r'
     AND class.relrowsecurity AND class.relforcerowsecurity),
  (SELECT pg_catalog.count(*)
   FROM pg_catalog.pg_proc AS procedure
   JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
   WHERE namespace.nspname = 'lor_studio' AND procedure.prosecdef
     AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner');

DO $catalog_preflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
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
  IF relation_count IS DISTINCT FROM 32
    OR forced_rls_count IS DISTINCT FROM 32
    OR definer_count IS DISTINCT FROM 26
    OR pg_catalog.to_regclass('lor_studio.ai_proposal_command_receipts') IS NULL
    OR pg_catalog.to_regprocedure('lor_studio.read_faculty_drafting_context()') IS NULL
    OR pg_catalog.to_regclass('lor_studio.student_evidence_records') IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.commit_student_evidence_publication(bigint,text,text,jsonb,text)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.student_evidence_record_is_complete(jsonb,jsonb)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.build_student_safe_case_state(text,text,bigint,text,timestamptz,timestamptz,timestamptz,jsonb)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.read_faculty_drafting_context_pre_evidence()'
    ) IS NOT NULL
  THEN
    RAISE EXCEPTION 'DR-133 evidence command migration preflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_preflight$;

CREATE FUNCTION lor_studio.student_evidence_record_is_complete(
  evidence_record jsonb,
  provenance jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $evidence_complete$
BEGIN
  RETURN COALESCE(
    pg_catalog.jsonb_typeof(evidence_record) = 'object'
    AND evidence_record ?& ARRAY[
      'id', 'caseId', 'text', 'contentHash', 'consentReceiptId'
    ]::text[]
    AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(evidence_record)) = 5
    AND evidence_record ->> 'id' ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND evidence_record ->> 'caseId' ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND pg_catalog.octet_length(evidence_record ->> 'text') BETWEEN 1 AND 40000
    AND pg_catalog.btrim(evidence_record ->> 'text') = evidence_record ->> 'text'
    AND evidence_record ->> 'contentHash' = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(evidence_record ->> 'text', 'UTF8')), 'hex'
    )
    AND evidence_record ->> 'consentReceiptId' ~
      '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND pg_catalog.jsonb_typeof(provenance) = 'object'
    AND provenance ?& ARRAY[
      'schemaVersion', 'sourceStepId', 'sourceField', 'sourceRevision',
      'publishedRevision', 'sourceRecordHash', 'sourceProtectedStateHash',
      'consentReceiptHash', 'transformVersion'
    ]::text[]
    AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(provenance)) = 9
    AND provenance ->> 'schemaVersion' =
      'missionmed.lor.student-evidence-provenance.v1'
    AND provenance ->> 'sourceStepId' = ANY (
      ARRAY['evidence_selection', 'timeline_highlights']::text[]
    )
    AND provenance ->> 'sourceField' = ANY (
      ARRAY['priorityEvidence', 'evidenceSummary', 'standoutMoment', 'timelineSummary']::text[]
    )
    AND provenance ->> 'sourceRevision' ~ '^(0|[1-9][0-9]*)$'
    AND provenance ->> 'publishedRevision' ~ '^[1-9][0-9]*$'
    AND (provenance ->> 'publishedRevision')::bigint =
      (provenance ->> 'sourceRevision')::bigint + 1
    AND provenance ->> 'sourceRecordHash' ~ '^[a-f0-9]{64}$'
    AND provenance ->> 'sourceProtectedStateHash' ~ '^[a-f0-9]{64}$'
    AND provenance ->> 'consentReceiptHash' ~ '^[a-f0-9]{64}$'
    AND provenance ->> 'transformVersion' =
      'missionmed.lor.direct-identifier-redaction.v1',
    false
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$evidence_complete$;

CREATE FUNCTION lor_studio.build_student_safe_case_state(
  resource_case_id text,
  resource_student_subject text,
  resource_revision bigint,
  resource_status text,
  resource_created_at timestamptz,
  resource_updated_at timestamptz,
  resource_closed_at timestamptz,
  resource_record jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $student_safe_state$
DECLARE
  consent_projection jsonb;
  waiver_projection jsonb;
BEGIN
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.consent-receipt.v1',
    'id', receipt.receipt_id,
    'caseId', receipt.case_id,
    'actorId', receipt.student_auth_subject,
    'scopes', pg_catalog.to_jsonb(receipt.scopes),
    'policyVersion', receipt.policy_version,
    'recordedAt', pg_catalog.to_char(
      receipt.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'receiptHash', receipt.receipt_hash
  ) ORDER BY receipt.case_revision, receipt.recorded_at, receipt.receipt_id), '[]'::jsonb)
  INTO consent_projection
  FROM lor_studio.consent_receipts AS receipt
  WHERE receipt.case_id = resource_case_id
    AND receipt.student_auth_subject = resource_student_subject
    AND receipt.case_revision <= resource_revision;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.waiver-receipt.v1',
    'id', receipt.receipt_id,
    'caseId', receipt.case_id,
    'actorId', receipt.student_auth_subject,
    'waived', receipt.waived,
    'policyVersion', receipt.policy_version,
    'priorReceiptId', receipt.prior_receipt_id,
    'acknowledgment', receipt.acknowledgment,
    'recordedAt', pg_catalog.to_char(
      receipt.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'receiptHash', receipt.receipt_hash
  ) ORDER BY receipt.case_revision, receipt.recorded_at, receipt.receipt_id), '[]'::jsonb)
  INTO waiver_projection
  FROM lor_studio.waiver_receipts AS receipt
  WHERE receipt.case_id = resource_case_id
    AND receipt.student_auth_subject = resource_student_subject
    AND receipt.case_revision <= resource_revision;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.student-safe-case.v1',
    'id', resource_case_id,
    'studentId', resource_student_subject,
    'status', resource_status,
    'revision', resource_revision,
    'createdAt', pg_catalog.to_char(
      resource_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'updatedAt', pg_catalog.to_char(
      resource_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'closedAt', CASE WHEN resource_closed_at IS NULL THEN NULL ELSE pg_catalog.to_char(
      resource_closed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ) END,
    'builder', resource_record -> 'builder',
    'studentEvidence', resource_record -> 'studentEvidence',
    'applicantOptions', resource_record -> 'applicantOptions',
    'consentReceipts', consent_projection,
    'waiverReceipts', waiver_projection,
    'delivery', resource_record -> 'delivery',
    'releasedDocument', NULL
  );
END;
$student_safe_state$;

CREATE TABLE lor_studio.student_evidence_records (
  evidence_id text PRIMARY KEY,
  case_id text NOT NULL,
  source_step_id text NOT NULL,
  source_field text NOT NULL,
  source_revision bigint NOT NULL,
  published_revision bigint NOT NULL,
  consent_receipt_id text NOT NULL,
  consent_receipt_hash text NOT NULL,
  -- Legacy column ABI: the value has direct identifiers redacted; it does not
  -- claim removal of every identifying signal.
  deidentified_text text NOT NULL,
  content_hash text NOT NULL,
  provenance jsonb NOT NULL,
  provenance_hash text NOT NULL,
  evidence_record jsonb NOT NULL,
  evidence_record_hash text NOT NULL,
  audit_event_ref text NOT NULL,
  transaction_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT student_evidence_records_case_fk
    FOREIGN KEY (case_id) REFERENCES lor_studio.recommendation_cases (case_id),
  CONSTRAINT student_evidence_records_consent_fk
    FOREIGN KEY (consent_receipt_id) REFERENCES lor_studio.consent_receipts (receipt_id),
  CONSTRAINT student_evidence_records_audit_fk
    FOREIGN KEY (audit_event_ref) REFERENCES lor_studio.recommendation_case_audit_events (event_ref),
  CONSTRAINT student_evidence_records_id_format
    CHECK (evidence_id ~ '^evidence_[a-f0-9]{64}$'),
  CONSTRAINT student_evidence_records_source_known CHECK (
    (source_step_id = 'evidence_selection'
      AND source_field = ANY (ARRAY['priorityEvidence', 'evidenceSummary']::text[]))
    OR (source_step_id = 'timeline_highlights'
      AND source_field = ANY (ARRAY['standoutMoment', 'timelineSummary']::text[]))
  ),
  CONSTRAINT student_evidence_records_revision_binding CHECK (
    source_revision >= 0 AND published_revision = source_revision + 1
  ),
  CONSTRAINT student_evidence_records_text_bound CHECK (
    pg_catalog.octet_length(deidentified_text) BETWEEN 1 AND 40000
    AND pg_catalog.btrim(deidentified_text) = deidentified_text
  ),
  CONSTRAINT student_evidence_records_hash_formats CHECK (
    consent_receipt_hash ~ '^[a-f0-9]{64}$'
    AND content_hash ~ '^[a-f0-9]{64}$'
    AND provenance_hash ~ '^[a-f0-9]{64}$'
    AND evidence_record_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT student_evidence_records_integrity CHECK (
    lor_studio.student_evidence_record_is_complete(evidence_record, provenance)
    AND evidence_record ->> 'id' = evidence_id
    AND evidence_record ->> 'caseId' = case_id
    AND evidence_record ->> 'text' = deidentified_text
    AND evidence_record ->> 'contentHash' = content_hash
    AND evidence_record ->> 'consentReceiptId' = consent_receipt_id
    AND provenance ->> 'sourceStepId' = source_step_id
    AND provenance ->> 'sourceField' = source_field
    AND (provenance ->> 'sourceRevision')::bigint = source_revision
    AND (provenance ->> 'publishedRevision')::bigint = published_revision
    AND provenance ->> 'consentReceiptHash' = consent_receipt_hash
    AND content_hash = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(deidentified_text, 'UTF8')), 'hex'
    )
    AND provenance_hash = lor_studio.canonical_jsonb_sha256(provenance)
    AND evidence_record_hash = lor_studio.canonical_jsonb_sha256(evidence_record)
  ),
  CONSTRAINT student_evidence_records_case_source_revision_unique
    UNIQUE (case_id, source_step_id, source_field, source_revision),
  CONSTRAINT student_evidence_records_transaction_format
    CHECK (transaction_id ~ '^[0-9]+$')
);

CREATE INDEX student_evidence_records_case_revision_idx
  ON lor_studio.student_evidence_records (case_id, published_revision, evidence_id);
CREATE INDEX student_evidence_records_consent_idx
  ON lor_studio.student_evidence_records (consent_receipt_id, case_id);

ALTER TABLE lor_studio.student_evidence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.student_evidence_records FORCE ROW LEVEL SECURITY;

CREATE TRIGGER student_evidence_records_append_only
BEFORE UPDATE OR DELETE ON lor_studio.student_evidence_records
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE POLICY student_evidence_records_command_select
ON lor_studio.student_evidence_records
FOR SELECT
TO lor_studio_command_owner
USING (EXISTS (
  SELECT 1
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = student_evidence_records.case_id
    AND (
      lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['read', 'save']::text[]
      )
      OR lor_studio.faculty_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        ARRAY['read']::text[]
      )
    )
));

CREATE POLICY student_evidence_records_student_command_insert
ON lor_studio.student_evidence_records
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  lor_studio.student_write_axes_satisfied()
  AND EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = student_evidence_records.case_id
      AND recommendation_case.revision = student_evidence_records.published_revision
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['save']::text[]
      )
  )
);

ALTER TABLE lor_studio.recommendation_case_write_receipts
  DROP CONSTRAINT recommendation_case_write_receipts_command_type_known,
  ADD CONSTRAINT recommendation_case_write_receipts_command_type_known CHECK (
    command_type IN (
      'student.case.create',
      'student.builder.autosave',
      'student.builder.complete',
      'student.consent.record',
      'student.waiver.record',
      'student.evidence.publish'
    )
  );

CREATE FUNCTION lor_studio.commit_student_evidence_publication(
  candidate_expected_revision bigint,
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
AS $publish_evidence$
DECLARE
  scope_case_id text := pg_catalog.current_setting('lor_studio.case_id', true);
  scope_student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  );
  scope_uid_text text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  scope_student_uid uuid;
  current_case lor_studio.recommendation_cases%ROWTYPE;
  previous_protected lor_studio.recommendation_case_protected_revision_states%ROWTYPE;
  replay_receipt lor_studio.recommendation_case_write_receipts%ROWTYPE;
  consent_receipt lor_studio.consent_receipts%ROWTYPE;
  source_row record;
  source_value jsonb;
  source_text text;
  deidentified_text text;
  evidence_id text;
  evidence_record jsonb;
  provenance jsonb;
  evidence_rows jsonb := '[]'::jsonb;
  evidence_projection jsonb := '[]'::jsonb;
  safe_record jsonb;
  safe_record_hash text;
  version_entry jsonb;
  protected_state jsonb;
  new_protected_state_hash text;
  persisted_state jsonb;
  expected_request_hash text;
  event_occurred_at timestamptz;
  next_revision bigint;
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
BEGIN
  BEGIN
    scope_student_uid := NULLIF(scope_uid_text, '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END;
  IF scope_case_id IS NULL
    OR scope_student_subject IS NULL
    OR scope_student_uid IS NULL
    OR pg_catalog.current_setting('lor_studio.actor_role', true) <> 'student'
    OR pg_catalog.current_setting('lor_studio.operation', true) <> 'save'
    OR NOT lor_studio.student_write_axes_satisfied()
    OR NOT lor_studio.student_context_allows(
      scope_case_id, scope_student_subject, scope_student_uid, ARRAY['save']::text[]
    )
  THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1', scope_case_id, scope_student_subject
    )::text, 0
  ));

  SELECT receipt.* INTO replay_receipt
  FROM lor_studio.recommendation_case_write_receipts AS receipt
  WHERE receipt.case_id = scope_case_id
    AND receipt.student_auth_subject = scope_student_subject
    AND receipt.idempotency_key = candidate_idempotency_key;
  IF FOUND THEN
    IF replay_receipt.command_type <> 'student.evidence.publish'
      OR replay_receipt.request_hash <> candidate_request_hash
    THEN
      RAISE EXCEPTION 'LOR_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1003';
    END IF;
    persisted_state := lor_studio.build_student_safe_case_state(
      replay_receipt.case_id, replay_receipt.student_auth_subject,
      replay_receipt.revision, replay_receipt.status, replay_receipt.created_at,
      replay_receipt.updated_at, replay_receipt.closed_at, replay_receipt.record
    );
    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.atomic-command-receipt.v2',
      'action', 'student.evidence.publish',
      'committed', true,
      'replayed', true,
      'sameTransaction', true,
      'caseId', replay_receipt.case_id,
      'studentId', replay_receipt.student_auth_subject,
      'revision', replay_receipt.revision,
      'idempotencyKey', replay_receipt.idempotency_key,
      'requestHash', replay_receipt.request_hash,
      'safeRecordHash', replay_receipt.record_hash,
      'protectedStateHash', replay_receipt.protected_state_hash,
      'eventHash', replay_receipt.event_hash,
      'auditEventRef', replay_receipt.audit_event_ref,
      'transactionId', replay_receipt.transaction_id,
      'state', persisted_state
    );
  END IF;

  expected_request_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'operation', 'student.evidence.publish',
      'caseId', scope_case_id,
      'actorId', scope_student_subject,
      'payload', '{}'::jsonb
    )
  );
  IF candidate_expected_revision IS NULL OR candidate_expected_revision < 0
    OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 240
    OR candidate_request_hash !~ '^[a-f0-9]{64}$'
    OR candidate_request_hash <> expected_request_hash
    OR candidate_event_hash !~ '^[a-f0-9]{64}$'
    OR candidate_event_hash <> lor_studio.canonical_jsonb_sha256(candidate_event)
    OR pg_catalog.jsonb_typeof(candidate_event) <> 'object'
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(candidate_event)) <> 10
    OR NOT candidate_event ?& ARRAY[
      'schemaVersion', 'eventRef', 'eventType', 'caseRef', 'actorRef',
      'actorRole', 'correlationRef', 'outcome', 'revision', 'occurredAt'
    ]::text[]
    OR candidate_event ->> 'schemaVersion' <> 'missionmed.lor.service-event.v1'
    OR candidate_event ->> 'eventType' <> 'student.material_updated'
    OR candidate_event ->> 'actorRole' <> 'student'
    OR candidate_event ->> 'outcome' <> 'success'
    OR (candidate_event ->> 'revision')::bigint <> candidate_expected_revision + 1
    OR candidate_event ->> 'caseRef' <> 'case_' || pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to('lor-studio:case:' || scope_case_id, 'UTF8')),
      'hex'
    )
    OR candidate_event ->> 'actorRef' <> 'actor_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to('lor-studio:actor:' || scope_student_subject, 'UTF8')
      ), 'hex'
    )
  THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;
  BEGIN
    event_occurred_at := (candidate_event ->> 'occurredAt')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END;

  SELECT recommendation_case.* INTO current_case
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = scope_case_id
    AND recommendation_case.student_auth_subject = scope_student_subject
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_CASE_NOT_FOUND' USING ERRCODE = 'P1001';
  END IF;

  SELECT receipt.* INTO replay_receipt
  FROM lor_studio.recommendation_case_write_receipts AS receipt
  WHERE receipt.case_id = scope_case_id
    AND receipt.student_auth_subject = scope_student_subject
    AND receipt.idempotency_key = candidate_idempotency_key;
  IF FOUND THEN
    RETURN lor_studio.commit_student_evidence_publication(
      candidate_expected_revision, candidate_idempotency_key, candidate_request_hash,
      candidate_event, candidate_event_hash
    );
  END IF;

  IF current_case.revision <> candidate_expected_revision THEN
    RAISE EXCEPTION 'LOR_STALE_REVISION' USING ERRCODE = 'P1002';
  END IF;
  next_revision := candidate_expected_revision + 1;
  IF current_case.student_auth_uid <> scope_student_uid
    OR current_case.status <> 'draft'
    OR current_case.released_at IS NOT NULL
    OR event_occurred_at <= current_case.updated_at
    OR event_occurred_at > pg_catalog.statement_timestamp()
    OR current_case.record -> 'builder' -> 'completedStepIds' IS NULL
    OR NOT (current_case.record -> 'builder' -> 'completedStepIds') @>
      '["evidence_selection","timeline_highlights","consent_and_waiver"]'::jsonb
    OR pg_catalog.jsonb_typeof(
      current_case.record -> 'builder' -> 'stepData' -> 'consent_and_waiver' -> 'understanding'
    ) <> 'string'
    OR pg_catalog.octet_length(pg_catalog.btrim(
      current_case.record -> 'builder' -> 'stepData' -> 'consent_and_waiver' ->> 'understanding'
    )) NOT BETWEEN 1 AND 20000
  THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  SELECT protected.* INTO previous_protected
  FROM lor_studio.recommendation_case_protected_revision_states AS protected
  WHERE protected.case_id = scope_case_id
    AND protected.student_auth_subject = scope_student_subject
    AND protected.revision = candidate_expected_revision
    AND protected.protected_state_hash = current_case.protected_state_hash;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  SELECT receipt.* INTO consent_receipt
  FROM lor_studio.consent_receipts AS receipt
  WHERE receipt.case_id = scope_case_id
    AND receipt.student_auth_subject = scope_student_subject
    AND receipt.student_auth_uid = scope_student_uid
    AND receipt.case_revision <= candidate_expected_revision
  ORDER BY receipt.case_revision DESC, receipt.recorded_at DESC, receipt.receipt_id DESC
  LIMIT 1;
  IF NOT FOUND OR NOT (
    consent_receipt.policy_version = 'dr-133-identified-education-record-v1'
    AND consent_receipt.scopes @> ARRAY['ai_drafting', 'evidence_grounding']::text[]
    AND NOT ('consent_withdrawn' = ANY (consent_receipt.scopes))
  ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  FOR source_row IN
    SELECT * FROM (VALUES
      ('evidence_selection'::text, 'priorityEvidence'::text),
      ('evidence_selection'::text, 'evidenceSummary'::text),
      ('timeline_highlights'::text, 'standoutMoment'::text),
      ('timeline_highlights'::text, 'timelineSummary'::text)
    ) AS source(source_step_id, source_field)
  LOOP
    source_value := current_case.record -> 'builder' -> 'stepData'
      -> source_row.source_step_id -> source_row.source_field;
    IF source_value IS NULL OR source_value = 'null'::jsonb
      OR (pg_catalog.jsonb_typeof(source_value) = 'string'
        AND pg_catalog.btrim(source_value #>> '{}') = '')
    THEN
      CONTINUE;
    END IF;
    IF pg_catalog.jsonb_typeof(source_value) <> 'string'
      OR pg_catalog.octet_length(pg_catalog.btrim(source_value #>> '{}')) > 20000
    THEN
      RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
    END IF;
    source_text := pg_catalog.btrim(source_value #>> '{}');
    deidentified_text := pg_catalog.replace(source_text, scope_student_subject, '[redacted-actor]');
    deidentified_text := pg_catalog.regexp_replace(
      deidentified_text,
      '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}',
      '[redacted-email]', 'gi'
    );
    deidentified_text := pg_catalog.regexp_replace(
      deidentified_text, '(https?://|www\.)[^[:space:]]+', '[redacted-url]', 'gi'
    );
    deidentified_text := pg_catalog.regexp_replace(
      deidentified_text, '\m[0-9]{3}-[0-9]{2}-[0-9]{4}\M',
      '[redacted-identifier]', 'g'
    );
    deidentified_text := pg_catalog.regexp_replace(
      deidentified_text,
      '\m(\+?1[-. ]?)?\(?[0-9]{3}\)?[-. ][0-9]{3}[-. ][0-9]{4}\M',
      '[redacted-phone]', 'g'
    );
    deidentified_text := pg_catalog.btrim(deidentified_text);
    IF pg_catalog.octet_length(deidentified_text) NOT BETWEEN 1 AND 40000 THEN
      RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
    END IF;

    evidence_id := 'evidence_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'caseId', scope_case_id,
        'sourceStepId', source_row.source_step_id,
        'sourceField', source_row.source_field,
        'sourceRevision', candidate_expected_revision,
        'consentReceiptId', consent_receipt.receipt_id,
        'text', deidentified_text
      )
    );
    evidence_record := pg_catalog.jsonb_build_object(
      'id', evidence_id,
      'caseId', scope_case_id,
      'text', deidentified_text,
      'contentHash', pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(deidentified_text, 'UTF8')), 'hex'
      ),
      'consentReceiptId', consent_receipt.receipt_id
    );
    provenance := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.student-evidence-provenance.v1',
      'sourceStepId', source_row.source_step_id,
      'sourceField', source_row.source_field,
      'sourceRevision', candidate_expected_revision,
      'publishedRevision', next_revision,
      'sourceRecordHash', current_case.record_hash,
      'sourceProtectedStateHash', current_case.protected_state_hash,
      'consentReceiptHash', consent_receipt.receipt_hash,
      'transformVersion', 'missionmed.lor.direct-identifier-redaction.v1'
    );
    evidence_projection := evidence_projection || pg_catalog.jsonb_build_array(evidence_record);
    evidence_rows := evidence_rows || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'evidenceRecord', evidence_record,
      'provenance', provenance,
      'sourceStepId', source_row.source_step_id,
      'sourceField', source_row.source_field
    ));
  END LOOP;
  IF pg_catalog.jsonb_array_length(evidence_projection) = 0 THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  safe_record := pg_catalog.jsonb_set(
    current_case.record, '{studentEvidence}', evidence_projection, false
  );
  IF NOT lor_studio.student_record_is_safe(safe_record) THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;
  safe_record_hash := lor_studio.canonical_jsonb_sha256(safe_record);
  version_entry := pg_catalog.jsonb_build_object(
    'revision', next_revision,
    'eventType', 'student.material_updated',
    'actorId', scope_student_subject,
    'occurredAt', candidate_event ->> 'occurredAt',
    'changedFields', '["studentEvidence"]'::jsonb,
    'changeHash', lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('studentEvidence', evidence_projection)
    )
  );
  protected_state := pg_catalog.jsonb_set(
    previous_protected.protected_state,
    '{versionHistory}',
    previous_protected.protected_state -> 'versionHistory'
      || pg_catalog.jsonb_build_array(version_entry),
    false
  );
  new_protected_state_hash := lor_studio.protected_state_chain_hash(
    scope_case_id, scope_student_subject, next_revision,
    previous_protected.protected_state_hash, candidate_event_hash, protected_state
  );

  UPDATE lor_studio.recommendation_cases AS recommendation_case
  SET revision = next_revision,
      updated_at = event_occurred_at,
      record = safe_record,
      record_hash = safe_record_hash,
      protected_state_hash = new_protected_state_hash
  WHERE recommendation_case.case_id = scope_case_id
    AND recommendation_case.student_auth_subject = scope_student_subject
    AND recommendation_case.revision = candidate_expected_revision;

  INSERT INTO lor_studio.recommendation_case_audit_events (
    event_ref, case_id, student_auth_subject, case_ref, actor_ref, actor_role,
    correlation_ref, event_type, outcome, revision, occurred_at, event,
    event_hash, transaction_id
  ) VALUES (
    candidate_event ->> 'eventRef', scope_case_id, scope_student_subject,
    candidate_event ->> 'caseRef', candidate_event ->> 'actorRef', 'student',
    candidate_event ->> 'correlationRef', 'student.material_updated', 'success',
    next_revision, event_occurred_at, candidate_event, candidate_event_hash,
    transaction_id
  );

  INSERT INTO lor_studio.student_evidence_records (
    evidence_id, case_id, source_step_id, source_field, source_revision,
    published_revision, consent_receipt_id, consent_receipt_hash,
    deidentified_text, content_hash, provenance, provenance_hash,
    evidence_record, evidence_record_hash, audit_event_ref, transaction_id, created_at
  )
  SELECT
    row_value -> 'evidenceRecord' ->> 'id',
    scope_case_id,
    row_value ->> 'sourceStepId',
    row_value ->> 'sourceField',
    candidate_expected_revision,
    next_revision,
    consent_receipt.receipt_id,
    consent_receipt.receipt_hash,
    row_value -> 'evidenceRecord' ->> 'text',
    row_value -> 'evidenceRecord' ->> 'contentHash',
    row_value -> 'provenance',
    lor_studio.canonical_jsonb_sha256(row_value -> 'provenance'),
    row_value -> 'evidenceRecord',
    lor_studio.canonical_jsonb_sha256(row_value -> 'evidenceRecord'),
    candidate_event ->> 'eventRef',
    transaction_id,
    event_occurred_at
  FROM pg_catalog.jsonb_array_elements(evidence_rows) AS evidence_row(row_value);

  INSERT INTO lor_studio.recommendation_case_protected_revision_states (
    case_id, student_auth_subject, revision, previous_revision,
    previous_protected_state_hash, protected_state, protected_state_hash,
    event_hash, audit_event_ref, transaction_id, committed_at
  ) VALUES (
    scope_case_id, scope_student_subject, next_revision, candidate_expected_revision,
    previous_protected.protected_state_hash, protected_state,
    new_protected_state_hash, candidate_event_hash,
    candidate_event ->> 'eventRef', transaction_id,
    pg_catalog.transaction_timestamp()
  );

  INSERT INTO lor_studio.recommendation_case_write_receipts (
    case_id, student_auth_subject, student_auth_uid, idempotency_key, request_hash,
    command_type, operation, revision, status, created_at, updated_at, closed_at,
    record, record_hash, protected_state_hash, released_snapshot_hash, event_hash,
    audit_event_ref, transaction_id, committed_at
  ) VALUES (
    scope_case_id, scope_student_subject, scope_student_uid,
    candidate_idempotency_key, candidate_request_hash,
    'student.evidence.publish', 'save', next_revision, current_case.status,
    current_case.created_at, event_occurred_at, current_case.closed_at,
    safe_record, safe_record_hash, new_protected_state_hash, NULL,
    candidate_event_hash, candidate_event ->> 'eventRef', transaction_id,
    pg_catalog.transaction_timestamp()
  );

  persisted_state := lor_studio.build_student_safe_case_state(
    scope_case_id, scope_student_subject, next_revision, current_case.status,
    current_case.created_at, event_occurred_at, current_case.closed_at, safe_record
  );
  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.atomic-command-receipt.v2',
    'action', 'student.evidence.publish',
    'committed', true,
    'replayed', false,
    'sameTransaction', true,
    'caseId', scope_case_id,
    'studentId', scope_student_subject,
    'revision', next_revision,
    'idempotencyKey', candidate_idempotency_key,
    'requestHash', candidate_request_hash,
    'safeRecordHash', safe_record_hash,
    'protectedStateHash', new_protected_state_hash,
    'eventHash', candidate_event_hash,
    'auditEventRef', candidate_event ->> 'eventRef',
    'transactionId', transaction_id,
    'state', persisted_state
  );
EXCEPTION
  WHEN SQLSTATE 'P1001' OR SQLSTATE 'P1002' OR SQLSTATE 'P1003'
    OR SQLSTATE 'P1004' OR SQLSTATE 'P1005' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
END;
$publish_evidence$;

REVOKE EXECUTE ON FUNCTION lor_studio.read_faculty_drafting_context()
FROM lor_studio_app;
ALTER FUNCTION lor_studio.read_faculty_drafting_context()
RENAME TO read_faculty_drafting_context_pre_evidence;
REVOKE ALL ON FUNCTION lor_studio.read_faculty_drafting_context_pre_evidence()
FROM PUBLIC;

CREATE FUNCTION lor_studio.read_faculty_drafting_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $read_drafting_context$
DECLARE
  scope_case_id text := pg_catalog.current_setting('lor_studio.case_id', true);
  scope_student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  );
  faculty_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  faculty_uid_text text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  scope_invitation_id text := pg_catalog.current_setting('lor_studio.invitation_id', true);
  faculty_uid uuid;
  recommendation_case lor_studio.recommendation_cases%ROWTYPE;
  latest_consent_receipt lor_studio.consent_receipts%ROWTYPE;
  recipient_email_hash text;
  verified_at timestamptz;
  evidence_projection jsonb;
  consent_projection jsonb;
  expected_evidence_count bigint;
  approved_evidence_count bigint;
BEGIN
  IF NOT COALESCE(
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.operation', true) = 'read'
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
    AND pg_catalog.length(pg_catalog.btrim(scope_case_id)) BETWEEN 1 AND 200
    AND scope_student_subject ~ '^wp:[1-9][0-9]*$'
    AND faculty_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.length(pg_catalog.btrim(scope_invitation_id)) BETWEEN 1 AND 200
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true',
    false
  ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;
  BEGIN
    faculty_uid := NULLIF(faculty_uid_text, '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END;
  IF faculty_uid IS NULL OR NOT lor_studio.faculty_context_allows(
    scope_case_id, scope_student_subject, ARRAY['read']::text[]
  ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  SELECT candidate.* INTO recommendation_case
  FROM lor_studio.recommendation_cases AS candidate
  WHERE candidate.case_id = scope_case_id
    AND candidate.student_auth_subject = scope_student_subject;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_CASE_NOT_FOUND' USING ERRCODE = 'P1001';
  END IF;

  SELECT invitation.recipient_email_hash, verification.otp_verified_at
  INTO recipient_email_hash, verified_at
  FROM lor_studio.faculty_invitations AS invitation
  JOIN lor_studio.faculty_otp_verification_receipts AS verification
    ON verification.invitation_id = invitation.invitation_id
   AND verification.case_id = invitation.case_id
   AND verification.student_auth_subject = invitation.student_auth_subject
   AND verification.faculty_auth_subject = invitation.faculty_auth_subject
   AND verification.faculty_auth_uid = invitation.faculty_auth_uid
   AND verification.invitation_used_at = invitation.used_at
  WHERE invitation.invitation_id = scope_invitation_id
    AND invitation.case_id = scope_case_id
    AND invitation.student_auth_subject = scope_student_subject
    AND invitation.faculty_auth_subject = faculty_subject
    AND invitation.faculty_auth_uid = faculty_uid
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
  ORDER BY verification.otp_verified_at DESC, verification.receipt_id DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  SELECT receipt.* INTO latest_consent_receipt
  FROM lor_studio.consent_receipts AS receipt
  WHERE receipt.case_id = scope_case_id
    AND receipt.student_auth_subject = scope_student_subject
    AND receipt.student_auth_uid = recommendation_case.student_auth_uid
    AND receipt.case_revision <= recommendation_case.revision
  ORDER BY receipt.case_revision DESC, receipt.recorded_at DESC, receipt.receipt_id DESC
  LIMIT 1;
  IF NOT FOUND OR NOT (
    latest_consent_receipt.policy_version = 'dr-133-identified-education-record-v1'
    AND latest_consent_receipt.scopes @> ARRAY['ai_drafting', 'evidence_grounding']::text[]
    AND NOT ('consent_withdrawn' = ANY (latest_consent_receipt.scopes))
  ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  WITH expected_evidence AS (
    SELECT item.value, item.ordinality
    FROM pg_catalog.jsonb_array_elements(
      recommendation_case.record -> 'studentEvidence'
    ) WITH ORDINALITY AS item(value, ordinality)
  ),
  approved_evidence AS (
    SELECT expected.ordinality, evidence.evidence_record
    FROM expected_evidence AS expected
    JOIN lor_studio.student_evidence_records AS evidence
      ON evidence.evidence_id = expected.value ->> 'id'
     AND evidence.case_id = scope_case_id
     AND evidence.published_revision <= recommendation_case.revision
     AND evidence.evidence_record IS NOT DISTINCT FROM expected.value
     AND evidence.evidence_record_hash =
       lor_studio.canonical_jsonb_sha256(evidence.evidence_record)
     AND evidence.provenance_hash =
       lor_studio.canonical_jsonb_sha256(evidence.provenance)
     AND lor_studio.student_evidence_record_is_complete(
       evidence.evidence_record, evidence.provenance
     )
    JOIN lor_studio.consent_receipts AS receipt
      ON receipt.receipt_id = evidence.consent_receipt_id
     AND receipt.case_id = scope_case_id
     AND receipt.student_auth_subject = scope_student_subject
     AND receipt.case_revision <= evidence.source_revision
     AND receipt.receipt_hash = evidence.consent_receipt_hash
     AND receipt.scopes @> ARRAY['ai_drafting', 'evidence_grounding']::text[]
  )
  SELECT
    COALESCE((SELECT pg_catalog.jsonb_agg(
      approved.evidence_record ORDER BY approved.ordinality
    ) FROM approved_evidence AS approved), '[]'::jsonb),
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id', latest_consent_receipt.receipt_id
    )),
    (SELECT pg_catalog.count(*) FROM expected_evidence),
    (SELECT pg_catalog.count(*) FROM approved_evidence)
  INTO evidence_projection, consent_projection,
    expected_evidence_count, approved_evidence_count;
  IF expected_evidence_count IS DISTINCT FROM approved_evidence_count THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.faculty-drafting-context.v1',
    'id', recommendation_case.case_id,
    'studentId', recommendation_case.student_auth_subject,
    'status', recommendation_case.status,
    'faculty', pg_catalog.jsonb_build_object(
      'facultyId', faculty_subject,
      'verifiedAt', pg_catalog.to_char(
        verified_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'recipientEmailHash', recipient_email_hash
    ),
    'consentReceipts', consent_projection,
    'studentEvidence', evidence_projection
  );
EXCEPTION
  WHEN SQLSTATE 'P1001' OR SQLSTATE 'P1004' OR SQLSTATE 'P1005' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
END;
$read_drafting_context$;

REVOKE ALL ON TABLE lor_studio.student_evidence_records FROM PUBLIC;
REVOKE ALL ON TABLE lor_studio.student_evidence_records FROM lor_studio_app;
GRANT SELECT, INSERT ON TABLE lor_studio.student_evidence_records
TO lor_studio_command_owner;

REVOKE ALL ON FUNCTION lor_studio.student_evidence_record_is_complete(jsonb, jsonb)
FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.build_student_safe_case_state(
  text, text, bigint, text, timestamptz, timestamptz, timestamptz, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.commit_student_evidence_publication(
  bigint, text, text, jsonb, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lor_studio.student_evidence_record_is_complete(jsonb, jsonb)
TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.build_student_safe_case_state(
  text, text, bigint, text, timestamptz, timestamptz, timestamptz, jsonb
) TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.commit_student_evidence_publication(
  bigint, text, text, jsonb, text
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.read_faculty_drafting_context()
OWNER TO lor_studio_command_owner;
REVOKE ALL ON FUNCTION lor_studio.read_faculty_drafting_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lor_studio.read_faculty_drafting_context()
TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.commit_student_evidence_publication(
  bigint, text, text, jsonb, text
) TO lor_studio_app;

DO $catalog_postflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  public_execute_count bigint;
  predecessor_relation_count bigint;
  predecessor_forced_rls_count bigint;
  predecessor_definer_count bigint;
BEGIN
  SELECT counts.relation_count, counts.forced_rls_count, counts.definer_count
  INTO STRICT predecessor_relation_count, predecessor_forced_rls_count,
    predecessor_definer_count
  FROM evidence_migration_preflight_counts AS counts;
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
  IF relation_count IS DISTINCT FROM predecessor_relation_count + 1
    OR forced_rls_count IS DISTINCT FROM predecessor_forced_rls_count + 1
    OR definer_count IS DISTINCT FROM predecessor_definer_count + 2
    OR public_execute_count <> 0
    OR pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.student_evidence_records', 'SELECT,INSERT,UPDATE,DELETE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.commit_student_evidence_publication(bigint,text,text,jsonb,text)',
      'EXECUTE'
    )
    OR pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.read_faculty_drafting_context_pre_evidence()',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'DR-133 evidence command migration postflight mismatch'
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
    observed_sentinel || '|studentEvidenceCommands=20260826011100'
  );
END
$advance_sentinel$;

COMMIT;
