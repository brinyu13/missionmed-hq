-- Migration: 20260826010900_f2_lor_1012_live_production_ai_proposal_commands.sql
-- Authority: F2-LOR-1012 / DR-133
-- Date: 2026-08-26
-- Depends on: 20260826010700_f2_lor_1012_live_production_faculty_private_export_commands.sql
-- Description: Add durable, actor-safe, atomic AI proposal and one-decision commands.
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
    target_provider, target_project_id, target_environment_id, target_service_id,
    target_database_name, target_region, target_decision_record, target_data_copied
  );
  expected_sentinel := pg_catalog.format(
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000|identityScope=20260826010300|facultyInvitationCommands=20260826010500|facultyPrivateExportCommands=20260826010700',
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
      SELECT 1
      FROM pg_catalog.pg_stat_ssl AS ssl_session
      WHERE ssl_session.pid = pg_catalog.pg_backend_pid() AND ssl_session.ssl
    )
    OR observed_sentinel IS DISTINCT FROM expected_sentinel
  THEN
    RAISE EXCEPTION 'DR-133 AI proposal command migration requires the exact export-successor private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.ai_generation_runs,
  lor_studio.ai_letter_proposals,
  lor_studio.ai_proposal_decisions,
  lor_studio.faculty_invitations,
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_cases
IN ACCESS EXCLUSIVE MODE;

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
  IF relation_count IS DISTINCT FROM 30
    OR forced_rls_count IS DISTINCT FROM 30
    OR definer_count IS DISTINCT FROM 21
    OR EXISTS (SELECT 1 FROM lor_studio.ai_generation_runs)
    OR EXISTS (SELECT 1 FROM lor_studio.ai_letter_proposals)
    OR EXISTS (SELECT 1 FROM lor_studio.ai_proposal_decisions)
    OR pg_catalog.to_regclass('lor_studio.ai_proposal_command_receipts') IS NOT NULL
    OR pg_catalog.to_regclass(
      'lor_studio.ai_proposal_generation_reservation_receipts'
    ) IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relname IN ('ai_letter_proposals', 'ai_proposal_decisions')
        AND attribute.attname IN (
          'proposal_record', 'proposal_record_hash', 'provider_run_hash',
          'decision_record', 'accepted_content_record_hash'
        )
        AND NOT attribute.attisdropped
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'lor_studio'
        AND procedure.proname IN (
          'ai_proposal_record_is_complete',
          'ai_proposal_command_context_allows',
          'ai_proposal_scope_hash',
          'read_faculty_drafting_context',
          'transition_ai_proposal_generation_reservation',
          'persist_ai_provider_run_and_proposal_atomic',
          'read_actor_safe_ai_proposal',
          'attach_ai_proposal_decision_if_undecided_atomic'
        )
    )
  THEN
    RAISE EXCEPTION 'DR-133 AI proposal command migration preflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_preflight$;

CREATE FUNCTION lor_studio.ai_proposal_record_is_complete(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $record_complete$
DECLARE
  provenance jsonb;
  grounding jsonb;
  decision_record jsonb;
  accepted_content jsonb;
  expected_claims jsonb;
  expected_support_ids jsonb;
  reconstructed_grounding jsonb;
  composed_text text;
  proposal_state text;
BEGIN
  IF pg_catalog.jsonb_typeof(payload) IS DISTINCT FROM 'object'
    OR pg_catalog.octet_length(payload::text) > 2097152
    OR NOT payload ?& ARRAY[
      'schemaVersion', 'id', 'caseId', 'requestedBy', 'requestedAt',
      'state', 'humanDecisionRequired', 'text', 'segments', 'claims',
      'grounding', 'provenance', 'fallbackUsed', 'decision', 'acceptedContent'
    ]::text[]
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(payload)) <> 15
    OR payload ->> 'schemaVersion' <> 'missionmed.lor.ai-proposal-record.v1'
    OR (payload ->> 'id') !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR (payload ->> 'caseId') !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR pg_catalog.length(payload ->> 'requestedBy') NOT BETWEEN 1 AND 200
    OR (payload ->> 'requestedAt') !~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
    OR pg_catalog.jsonb_typeof(payload -> 'text') IS DISTINCT FROM 'string'
    OR pg_catalog.octet_length(payload ->> 'text') NOT BETWEEN 1 AND 40000
    OR pg_catalog.jsonb_typeof(payload -> 'fallbackUsed') IS DISTINCT FROM 'boolean'
    OR pg_catalog.jsonb_typeof(payload -> 'segments') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(payload -> 'segments') NOT BETWEEN 1 AND 400
    OR pg_catalog.jsonb_typeof(payload -> 'claims') IS DISTINCT FROM 'array'
  THEN
    RETURN false;
  END IF;

  provenance := payload -> 'provenance';
  grounding := payload -> 'grounding';
  IF pg_catalog.jsonb_typeof(provenance) IS DISTINCT FROM 'object'
    OR NOT provenance ?& ARRAY[
      'schemaVersion', 'id', 'caseId', 'state', 'provider', 'model',
      'templateVersion', 'templateHash', 'sourceReferences', 'sourceSetHash',
      'outputHash', 'generatedAt'
    ]::text[]
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(provenance)) <> 12
    OR provenance ->> 'schemaVersion' <> 'missionmed.lor.ai-proposal-provenance.v1'
    OR provenance ->> 'id' <> payload ->> 'id'
    OR provenance ->> 'caseId' <> payload ->> 'caseId'
    OR provenance ->> 'state' <> 'proposal'
    OR provenance ->> 'provider' <> 'openai'
    OR provenance ->> 'model' <> 'gpt-5.6-terra'
    OR pg_catalog.length(provenance ->> 'templateVersion') NOT BETWEEN 1 AND 200
    OR provenance ->> 'templateHash' <> pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(provenance ->> 'templateVersion', 'UTF8')),
      'hex'
    )
    OR provenance ->> 'outputHash' <> pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(payload ->> 'text', 'UTF8')), 'hex'
    )
    OR (provenance ->> 'generatedAt') !~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
    OR pg_catalog.jsonb_typeof(provenance -> 'sourceReferences') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(provenance -> 'sourceReferences') NOT BETWEEN 1 AND 500
    OR provenance ->> 'sourceSetHash' <>
      lor_studio.canonical_jsonb_sha256(provenance -> 'sourceReferences')
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(provenance -> 'sourceReferences') AS source(reference)
      WHERE pg_catalog.jsonb_typeof(source.reference) <> 'object'
        OR NOT source.reference ?& ARRAY['id', 'contentHash']::text[]
        OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(source.reference)) <> 2
        OR (source.reference ->> 'id') !~
          '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
        OR (source.reference ->> 'contentHash') !~ '^[a-f0-9]{64}$'
    )
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.jsonb_array_elements(provenance -> 'sourceReferences') AS source(reference)
    ) <> (
      SELECT pg_catalog.count(DISTINCT source.reference ->> 'id')
      FROM pg_catalog.jsonb_array_elements(provenance -> 'sourceReferences') AS source(reference)
    )
    OR NOT lor_studio.ai_grounding_manifest_is_complete(grounding)
  THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(payload -> 'segments')
      WITH ORDINALITY AS segment_rows(segment, ordinal_position)
    WHERE pg_catalog.jsonb_typeof(segment_rows.segment) <> 'object'
      OR NOT segment_rows.segment ?& ARRAY['kind', 'text', 'separator', 'supportIds']::text[]
      OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(segment_rows.segment)) <> 4
      OR segment_rows.segment ->> 'kind' NOT IN ('factual', 'connective')
      OR pg_catalog.jsonb_typeof(segment_rows.segment -> 'text') <> 'string'
      OR pg_catalog.octet_length(segment_rows.segment ->> 'text') NOT BETWEEN 1 AND 4000
      OR pg_catalog.btrim(segment_rows.segment ->> 'text') <> segment_rows.segment ->> 'text'
      OR segment_rows.segment ->> 'separator' NOT IN ('paragraph', 'line', 'inline')
      OR (segment_rows.ordinal_position = 1 AND segment_rows.segment ->> 'separator' = 'inline')
      OR pg_catalog.jsonb_typeof(segment_rows.segment -> 'supportIds') <> 'array'
      OR pg_catalog.jsonb_array_length(segment_rows.segment -> 'supportIds') > 32
      OR (
        segment_rows.segment ->> 'kind' = 'factual'
        AND pg_catalog.jsonb_array_length(segment_rows.segment -> 'supportIds') = 0
      )
      OR (
        segment_rows.segment ->> 'kind' = 'connective'
        AND pg_catalog.jsonb_array_length(segment_rows.segment -> 'supportIds') <> 0
      )
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(segment_rows.segment -> 'supportIds') AS support(value)
        WHERE pg_catalog.jsonb_typeof(support.value) <> 'string'
          OR pg_catalog.length(support.value #>> '{}') NOT BETWEEN 1 AND 200
          OR NOT EXISTS (
            SELECT 1
            FROM pg_catalog.jsonb_array_elements(
              provenance -> 'sourceReferences'
            ) AS source(reference)
            WHERE source.reference ->> 'id' = support.value #>> '{}'
          )
      )
      OR (
        SELECT pg_catalog.count(*)
        FROM pg_catalog.jsonb_array_elements(segment_rows.segment -> 'supportIds')
      ) <> (
        SELECT pg_catalog.count(DISTINCT support.value #>> '{}')
        FROM pg_catalog.jsonb_array_elements(
          segment_rows.segment -> 'supportIds'
        ) AS support(value)
      )
  ) THEN
    RETURN false;
  END IF;

  SELECT pg_catalog.string_agg(
    CASE
      WHEN segment_rows.ordinal_position = 1 THEN ''
      WHEN segment_rows.segment ->> 'separator' = 'paragraph' THEN E'\n\n'
      WHEN segment_rows.segment ->> 'separator' = 'line' THEN E'\n'
      ELSE ' '
    END || (segment_rows.segment ->> 'text'),
    '' ORDER BY segment_rows.ordinal_position
  )
  INTO composed_text
  FROM pg_catalog.jsonb_array_elements(payload -> 'segments')
    WITH ORDINALITY AS segment_rows(segment, ordinal_position);
  IF composed_text IS DISTINCT FROM payload ->> 'text' THEN
    RETURN false;
  END IF;

  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'text', segment_rows.segment ->> 'text',
        'supportIds', segment_rows.segment -> 'supportIds'
      ) ORDER BY segment_rows.ordinal_position
    ) FILTER (WHERE segment_rows.segment ->> 'kind' = 'factual'),
    '[]'::jsonb
  )
  INTO expected_claims
  FROM pg_catalog.jsonb_array_elements(payload -> 'segments')
    WITH ORDINALITY AS segment_rows(segment, ordinal_position);
  IF expected_claims IS DISTINCT FROM payload -> 'claims' THEN
    RETURN false;
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(support_id ORDER BY support_id), '[]'::jsonb)
  INTO expected_support_ids
  FROM (
    SELECT DISTINCT support.value AS support_id
    FROM pg_catalog.jsonb_array_elements(payload -> 'segments') AS segment_rows(segment)
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      segment_rows.segment -> 'supportIds'
    ) AS support(value)
  ) AS unique_support;
  IF expected_support_ids IS DISTINCT FROM grounding -> 'supportIds'
    OR (grounding ->> 'factualSegmentCount')::integer <>
      (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_array_elements(payload -> 'segments') AS segment_rows(segment)
       WHERE segment_rows.segment ->> 'kind' = 'factual')
    OR (grounding ->> 'connectiveSegmentCount')::integer <>
      (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_array_elements(payload -> 'segments') AS segment_rows(segment)
       WHERE segment_rows.segment ->> 'kind' = 'connective')
  THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(grounding -> 'attestations')
      WITH ORDINALITY AS attestation_rows(attestation, ordinal_position)
    JOIN LATERAL (
      SELECT payload -> 'segments' -> (attestation_rows.ordinal_position - 1)::integer AS segment
    ) AS matched ON true
    WHERE attestation_rows.attestation ->> 'kind' <> matched.segment ->> 'kind'
      OR attestation_rows.attestation -> 'supportIds' IS DISTINCT FROM
        matched.segment -> 'supportIds'
      OR (
        matched.segment ->> 'kind' = 'factual'
        AND (
          attestation_rows.attestation ->> 'status' <> 'ENTAILED'
          OR pg_catalog.length(attestation_rows.attestation ->> 'verifierId') = 0
          OR pg_catalog.jsonb_typeof(
            attestation_rows.attestation -> 'rationaleCode'
          ) <> 'string'
          OR pg_catalog.length(
            attestation_rows.attestation ->> 'rationaleCode'
          ) NOT BETWEEN 1 AND 200
          OR attestation_rows.attestation -> 'sourceHashes' IS DISTINCT FROM (
            SELECT pg_catalog.jsonb_agg(source.reference -> 'contentHash' ORDER BY support.ordinal_position)
            FROM pg_catalog.jsonb_array_elements_text(matched.segment -> 'supportIds')
              WITH ORDINALITY AS support(id, ordinal_position)
            JOIN pg_catalog.jsonb_array_elements(provenance -> 'sourceReferences')
              AS source(reference) ON source.reference ->> 'id' = support.id
          )
        )
      )
      OR (
        matched.segment ->> 'kind' = 'connective'
        AND (
          attestation_rows.attestation ->> 'status' <> 'NO_MATERIAL_ASSERTION'
          OR pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'verifierId') <> 'null'
          OR attestation_rows.attestation ->> 'rationaleCode' <> 'CONNECTIVE_GUARD_CLEAR'
          OR attestation_rows.attestation -> 'sourceHashes' <> '[]'::jsonb
        )
      )
  ) THEN
    RETURN false;
  END IF;

  reconstructed_grounding := pg_catalog.jsonb_build_object(
    'schemaVersion', grounding ->> 'schemaVersion',
    'valid', true,
    'claimCount', (grounding ->> 'factualSegmentCount')::integer,
    'segmentCount', pg_catalog.jsonb_array_length(payload -> 'segments'),
    'factualSegmentCount', (grounding ->> 'factualSegmentCount')::integer,
    'connectiveSegmentCount', (grounding ->> 'connectiveSegmentCount')::integer,
    'supportIds', grounding -> 'supportIds',
    'segments', payload -> 'segments',
    'attestations', grounding -> 'attestations'
  );
  IF grounding ->> 'attestationHash' <>
    lor_studio.canonical_jsonb_sha256(reconstructed_grounding)
  THEN
    RETURN false;
  END IF;

  proposal_state := payload ->> 'state';
  IF proposal_state = 'proposal' THEN
    RETURN payload -> 'humanDecisionRequired' = 'true'::jsonb
      AND pg_catalog.jsonb_typeof(payload -> 'decision') = 'null'
      AND pg_catalog.jsonb_typeof(payload -> 'acceptedContent') = 'null';
  END IF;
  IF proposal_state <> 'decided'
    OR payload -> 'humanDecisionRequired' <> 'false'::jsonb
  THEN
    RETURN false;
  END IF;

  decision_record := payload -> 'decision';
  accepted_content := payload -> 'acceptedContent';
  IF pg_catalog.jsonb_typeof(decision_record) <> 'object'
    OR NOT decision_record ?& ARRAY[
      'schemaVersion', 'id', 'caseId', 'proposalId', 'proposalOutputHash',
      'facultyId', 'action', 'resultingTextHash', 'decidedAt'
    ]::text[]
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(decision_record)) <> 9
    OR decision_record ->> 'schemaVersion' <> 'missionmed.lor.human-decision.v1'
    OR (decision_record ->> 'id') !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR decision_record ->> 'caseId' <> payload ->> 'caseId'
    OR decision_record ->> 'proposalId' <> payload ->> 'id'
    OR decision_record ->> 'proposalOutputHash' <> provenance ->> 'outputHash'
    OR (decision_record ->> 'facultyId') !~ '^wp:[1-9][0-9]*$'
    OR decision_record ->> 'action' NOT IN ('accepted', 'edited', 'rejected')
    OR (decision_record ->> 'decidedAt') !~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
  THEN
    RETURN false;
  END IF;
  IF decision_record ->> 'action' = 'rejected' THEN
    RETURN pg_catalog.jsonb_typeof(decision_record -> 'resultingTextHash') = 'null'
      AND pg_catalog.jsonb_typeof(accepted_content) = 'null';
  END IF;

  IF pg_catalog.jsonb_typeof(accepted_content) <> 'object'
    OR NOT accepted_content ?& ARRAY[
      'origin', 'text', 'textHash', 'supportIds', 'groundingAttestationHash',
      'groundedAsAttested', 'proposalId', 'decisionId', 'decidedAt'
    ]::text[]
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(accepted_content)) <> 9
    OR pg_catalog.octet_length(accepted_content ->> 'text') NOT BETWEEN 1 AND 40000
    OR accepted_content ->> 'textHash' <> pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(accepted_content ->> 'text', 'UTF8')), 'hex'
    )
    OR accepted_content ->> 'textHash' <> decision_record ->> 'resultingTextHash'
    OR accepted_content -> 'supportIds' IS DISTINCT FROM grounding -> 'supportIds'
    OR accepted_content ->> 'groundingAttestationHash' <>
      grounding ->> 'attestationHash'
    OR accepted_content ->> 'proposalId' <> payload ->> 'id'
    OR accepted_content ->> 'decisionId' <> decision_record ->> 'id'
    OR accepted_content ->> 'decidedAt' <> decision_record ->> 'decidedAt'
  THEN
    RETURN false;
  END IF;
  IF decision_record ->> 'action' = 'accepted' THEN
    RETURN accepted_content ->> 'origin' = 'ai_proposal_accepted'
      AND accepted_content -> 'groundedAsAttested' = 'true'::jsonb
      AND accepted_content ->> 'text' = payload ->> 'text'
      AND accepted_content ->> 'textHash' = provenance ->> 'outputHash';
  END IF;
  RETURN accepted_content ->> 'origin' = 'human_edited'
    AND accepted_content -> 'groundedAsAttested' = 'false'::jsonb;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$record_complete$;

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
  scope_invitation_id text := pg_catalog.current_setting(
    'lor_studio.invitation_id', true
  );
  faculty_uid uuid;
  recommendation_case lor_studio.recommendation_cases%ROWTYPE;
  recipient_email_hash text;
  verified_at timestamptz;
  evidence_projection jsonb;
  consent_projection jsonb;
BEGIN
  IF NOT COALESCE(
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.operation', true) = 'read'
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
    AND pg_catalog.length(pg_catalog.btrim(scope_case_id)) BETWEEN 1 AND 200
    AND pg_catalog.length(pg_catalog.btrim(scope_student_subject)) BETWEEN 1 AND 200
    AND scope_student_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.length(pg_catalog.btrim(faculty_subject)) BETWEEN 1 AND 200
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
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END;

  IF faculty_uid IS NULL OR NOT lor_studio.faculty_context_allows(
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

  WITH evidence_candidates AS (
    SELECT item.value, item.ordinality
    FROM pg_catalog.jsonb_array_elements(
      recommendation_case.record -> 'studentEvidence'
    ) WITH ORDINALITY AS item(value, ordinality)
  ),
  approved_evidence AS (
    SELECT DISTINCT ON (candidate.value ->> 'id')
      candidate.value ->> 'id' AS evidence_id,
      candidate.value ->> 'text' AS evidence_text,
      candidate.value ->> 'contentHash' AS content_hash,
      candidate.value ->> 'consentReceiptId' AS consent_receipt_id,
      candidate.ordinality
    FROM evidence_candidates AS candidate
    JOIN lor_studio.consent_receipts AS receipt
      ON receipt.receipt_id = candidate.value ->> 'consentReceiptId'
     AND receipt.case_id = scope_case_id
     AND receipt.student_auth_subject = scope_student_subject
     AND receipt.case_revision <= recommendation_case.revision
     AND receipt.scopes @> ARRAY['ai_drafting', 'evidence_grounding']::text[]
    WHERE pg_catalog.jsonb_typeof(candidate.value) = 'object'
      AND candidate.value ?& ARRAY[
        'id', 'caseId', 'text', 'contentHash', 'consentReceiptId'
      ]::text[]
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_object_keys(candidate.value) AS evidence_key(key_name)
        WHERE evidence_key.key_name <> ALL (ARRAY[
          'id', 'caseId', 'text', 'contentHash', 'consentReceiptId'
        ]::text[])
      )
      AND candidate.value ->> 'id' ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
      AND candidate.value ->> 'caseId' = scope_case_id
      AND pg_catalog.octet_length(candidate.value ->> 'text') BETWEEN 1 AND 40000
      AND pg_catalog.btrim(candidate.value ->> 'text') = candidate.value ->> 'text'
      AND candidate.value ->> 'contentHash' ~ '^[a-f0-9]{64}$'
      AND candidate.value ->> 'contentHash' = pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(candidate.value ->> 'text', 'UTF8')
        ),
        'hex'
      )
      AND candidate.value ->> 'consentReceiptId' ~
        '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    ORDER BY candidate.value ->> 'id', candidate.ordinality
  ),
  referenced_consents AS (
    SELECT consent_receipt_id, pg_catalog.min(ordinality) AS first_ordinality
    FROM approved_evidence
    GROUP BY consent_receipt_id
  )
  SELECT
    COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', approved.evidence_id,
          'caseId', scope_case_id,
          'text', approved.evidence_text,
          'contentHash', approved.content_hash,
          'consentReceiptId', approved.consent_receipt_id
        )
        ORDER BY approved.ordinality, approved.evidence_id
      )
      FROM approved_evidence AS approved
    ), '[]'::jsonb),
    COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('id', referenced.consent_receipt_id)
        ORDER BY referenced.first_ordinality, referenced.consent_receipt_id
      )
      FROM referenced_consents AS referenced
    ), '[]'::jsonb)
  INTO evidence_projection, consent_projection;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.faculty-drafting-context.v1',
    'id', recommendation_case.case_id,
    'studentId', recommendation_case.student_auth_subject,
    'status', recommendation_case.status,
    'faculty', pg_catalog.jsonb_build_object(
      'facultyId', faculty_subject,
      'verifiedAt', pg_catalog.to_char(
        verified_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'recipientEmailHash', recipient_email_hash
    ),
    'consentReceipts', consent_projection,
    'studentEvidence', evidence_projection
  );
EXCEPTION
  WHEN SQLSTATE 'P1001' OR SQLSTATE 'P1004' OR SQLSTATE 'P1005' THEN
    RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
END;
$read_drafting_context$;

CREATE FUNCTION lor_studio.ai_proposal_command_context_allows(
  candidate_case_id text,
  candidate_operation text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    candidate_operation = ANY (ARRAY['read', 'save']::text[])
    AND pg_catalog.current_setting('transaction_isolation', true) = 'read committed'
    AND pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.operation', true) = candidate_operation
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
    AND pg_catalog.current_setting('lor_studio.trusted_service_actor', true) =
      'lor-ai-proposal-store-v1'
    AND pg_catalog.current_setting('lor_studio.case_id', true) = candidate_case_id
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.current_setting('lor_studio.student_auth_subject', true) ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.current_setting('request.jwt.claim.sub', true) ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND pg_catalog.current_setting('lor_studio.invitation_id', true) <> ''
    AND pg_catalog.current_setting('lor_studio.assignment_id', true) = ''
    AND pg_catalog.current_setting('lor_studio.administrative_grant_id', true) = ''
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true'
    AND lor_studio.faculty_context_allows(
      candidate_case_id,
      pg_catalog.current_setting('lor_studio.resource_student_id', true),
      ARRAY[candidate_operation]::text[]
    ),
    false
  );
$$;

CREATE FUNCTION lor_studio.ai_proposal_scope_hash(
  candidate_case_id text,
  candidate_operation text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.server-query-scope.v1',
    'authoritySource', 'server_verified_session_crosswalk',
    'authenticated', true,
    'roleVerified', true,
    'authUid', pg_catalog.current_setting('request.jwt.claim.sub', true),
    'authenticatedSubject', pg_catalog.current_setting(
      'lor_studio.student_auth_subject', true
    ),
    'actorId', pg_catalog.current_setting('lor_studio.student_auth_subject', true),
    'actorRole', 'faculty',
    'resourceStudentId', pg_catalog.current_setting(
      'lor_studio.resource_student_id', true
    ),
    'caseId', candidate_case_id,
    'operation', candidate_operation,
    'purpose', 'faculty_private_edit',
    'assignmentId', NULL,
    'invitationId', pg_catalog.current_setting('lor_studio.invitation_id', true),
    'administrativeGrantId', NULL,
    'entitlementVerified', true,
    'lorEnabled', true,
    'canaryAuthorized', true
  ));
$$;

ALTER TABLE lor_studio.ai_letter_proposals
  ADD COLUMN proposal_record jsonb NOT NULL,
  ADD COLUMN proposal_record_hash text NOT NULL,
  ADD COLUMN provider_run_hash text NOT NULL,
  ADD CONSTRAINT ai_letter_proposals_record_complete CHECK (
    lor_studio.ai_proposal_record_is_complete(proposal_record)
    AND proposal_record ->> 'state' = 'proposal'
    AND proposal_record ->> 'id' = proposal_id
    AND proposal_record ->> 'caseId' = case_id
    AND proposal_record ->> 'text' = proposal_text
    AND proposal_record -> 'grounding' = grounding_manifest
  ),
  ADD CONSTRAINT ai_letter_proposals_record_hashes CHECK (
    proposal_record_hash = lor_studio.canonical_jsonb_sha256(proposal_record)
    AND provider_run_hash = lor_studio.canonical_jsonb_sha256(
      proposal_record -> 'provenance'
    )
    AND proposal_output_hash = proposal_record -> 'provenance' ->> 'outputHash'
  );

ALTER TABLE lor_studio.ai_proposal_decisions
  ADD COLUMN proposal_record jsonb NOT NULL,
  ADD COLUMN proposal_record_hash text NOT NULL,
  ADD COLUMN decision_record jsonb NOT NULL,
  ADD COLUMN accepted_content_record_hash text,
  ADD CONSTRAINT ai_proposal_decisions_record_complete CHECK (
    lor_studio.ai_proposal_record_is_complete(proposal_record)
    AND proposal_record ->> 'state' = 'decided'
    AND proposal_record ->> 'id' = proposal_id
    AND proposal_record ->> 'caseId' = case_id
    AND proposal_record -> 'decision' = decision_record
    AND proposal_record ->> 'text' = proposal_text
  ),
  ADD CONSTRAINT ai_proposal_decisions_record_hashes CHECK (
    proposal_record_hash = lor_studio.canonical_jsonb_sha256(proposal_record)
    AND decision_hash = lor_studio.canonical_jsonb_sha256(decision_record)
    AND (
      (proposal_record -> 'acceptedContent') = 'null'::jsonb
      AND accepted_content_record_hash IS NULL
      OR
      (proposal_record -> 'acceptedContent') <> 'null'::jsonb
      AND accepted_content_record_hash = lor_studio.canonical_jsonb_sha256(
        proposal_record -> 'acceptedContent'
      )
    )
  );

CREATE TABLE lor_studio.ai_proposal_command_receipts (
  receipt_id text PRIMARY KEY,
  operation text NOT NULL,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  submitted_proposal_id text NOT NULL,
  proposal_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  scope_hash text NOT NULL,
  target_binding_hash text NOT NULL,
  submitted_record_hash text NOT NULL,
  record_hash text NOT NULL,
  provider_run_hash text NOT NULL,
  output_hash text NOT NULL,
  decision_hash text,
  accepted_content_hash text,
  transaction_ref text NOT NULL,
  committed_at timestamptz NOT NULL,
  audit_event_ref text NOT NULL,
  result jsonb NOT NULL,
  result_hash text NOT NULL,
  CONSTRAINT ai_proposal_command_receipts_proposal_fk
    FOREIGN KEY (proposal_id, case_id, student_auth_subject)
    REFERENCES lor_studio.ai_letter_proposals (
      proposal_id, case_id, student_auth_subject
    ),
  CONSTRAINT ai_proposal_command_receipts_audit_fk
    FOREIGN KEY (audit_event_ref, case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_case_audit_events (
      event_ref, case_id, student_auth_subject
    ),
  CONSTRAINT ai_proposal_command_receipts_idempotency_unique
    UNIQUE (case_id, student_auth_subject, idempotency_key),
  CONSTRAINT ai_proposal_command_receipts_id_format CHECK (
    receipt_id ~ '^ai_command_[a-f0-9]{64}$'
  ),
  CONSTRAINT ai_proposal_command_receipts_operation_known CHECK (
    operation IN ('put_proposal', 'attach_decision')
  ),
  CONSTRAINT ai_proposal_command_receipts_identifiers CHECK (
    student_auth_subject ~ '^wp:[1-9][0-9]*$'
    AND submitted_proposal_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND proposal_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND pg_catalog.length(idempotency_key) BETWEEN 1 AND 200
  ),
  CONSTRAINT ai_proposal_command_receipts_hashes CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
    AND scope_hash ~ '^[a-f0-9]{64}$'
    AND target_binding_hash ~ '^[a-f0-9]{64}$'
    AND submitted_record_hash ~ '^[a-f0-9]{64}$'
    AND record_hash ~ '^[a-f0-9]{64}$'
    AND provider_run_hash ~ '^[a-f0-9]{64}$'
    AND output_hash ~ '^[a-f0-9]{64}$'
    AND (decision_hash IS NULL OR decision_hash ~ '^[a-f0-9]{64}$')
    AND (
      accepted_content_hash IS NULL
      OR accepted_content_hash ~ '^[a-f0-9]{64}$'
    )
    AND transaction_ref ~ '^txn_[a-f0-9]{64}$'
    AND result_hash = lor_studio.canonical_jsonb_sha256(result)
  ),
  CONSTRAINT ai_proposal_command_receipts_result_shape CHECK (
    pg_catalog.jsonb_typeof(result) = 'object'
    AND pg_catalog.octet_length(result::text) <= 2359296
    AND result ?& ARRAY[
      'schemaVersion', 'operation', 'outcome', 'writeApplied', 'replayed',
      'sameTransaction', 'databaseClockUsed', 'caseId', 'submittedProposalId',
      'proposalId', 'idempotencyKey', 'requestHash', 'scopeHash',
      'targetBindingHash', 'submittedRecordHash', 'recordHash',
      'providerRunHash', 'outputHash', 'decisionHash', 'acceptedContentHash',
      'transactionRef', 'committedAt', 'record'
    ]::text[]
    AND result - ARRAY[
      'schemaVersion', 'operation', 'outcome', 'writeApplied', 'replayed',
      'sameTransaction', 'databaseClockUsed', 'caseId', 'submittedProposalId',
      'proposalId', 'idempotencyKey', 'requestHash', 'scopeHash',
      'targetBindingHash', 'submittedRecordHash', 'recordHash',
      'providerRunHash', 'outputHash', 'decisionHash', 'acceptedContentHash',
      'transactionRef', 'committedAt', 'record'
    ]::text[] = '{}'::jsonb
    AND result ->> 'schemaVersion' =
      'missionmed.lor.ai-proposal-write-receipt.v1'
    AND result ->> 'operation' = operation
    AND result ->> 'outcome' = 'committed'
    AND result -> 'writeApplied' = 'true'::jsonb
    AND result -> 'replayed' = 'false'::jsonb
    AND result -> 'sameTransaction' = 'true'::jsonb
    AND result -> 'databaseClockUsed' = 'true'::jsonb
    AND result ->> 'caseId' = case_id
    AND result ->> 'submittedProposalId' = submitted_proposal_id
    AND result ->> 'proposalId' = proposal_id
    AND result ->> 'idempotencyKey' = idempotency_key
    AND result ->> 'requestHash' = request_hash
    AND result ->> 'scopeHash' = scope_hash
    AND result ->> 'targetBindingHash' = target_binding_hash
    AND result ->> 'submittedRecordHash' = submitted_record_hash
    AND result ->> 'recordHash' = record_hash
    AND result ->> 'providerRunHash' = provider_run_hash
    AND result ->> 'outputHash' = output_hash
    AND result ->> 'decisionHash' IS NOT DISTINCT FROM decision_hash
    AND result ->> 'acceptedContentHash' IS NOT DISTINCT FROM accepted_content_hash
    AND result ->> 'transactionRef' = transaction_ref
    AND (result ->> 'committedAt')::timestamptz = committed_at
    AND lor_studio.ai_proposal_record_is_complete(result -> 'record')
    AND lor_studio.canonical_jsonb_sha256(result -> 'record') = record_hash
  )
);

CREATE INDEX ai_proposal_command_receipts_proposal_idx
  ON lor_studio.ai_proposal_command_receipts (
    proposal_id, case_id, student_auth_subject, committed_at
  );

ALTER TABLE lor_studio.ai_proposal_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_proposal_command_receipts FORCE ROW LEVEL SECURITY;

CREATE TRIGGER ai_proposal_command_receipts_append_only
BEFORE UPDATE OR DELETE ON lor_studio.ai_proposal_command_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TABLE lor_studio.ai_proposal_generation_reservation_receipts (
  receipt_id text PRIMARY KEY,
  reservation_id text NOT NULL,
  phase text NOT NULL,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  faculty_auth_subject text NOT NULL,
  faculty_auth_uid uuid NOT NULL,
  invitation_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  scope_hash text NOT NULL,
  target_binding_hash text NOT NULL,
  transaction_ref text NOT NULL,
  reserved_at timestamptz NOT NULL,
  settled_at timestamptz,
  result jsonb NOT NULL,
  result_hash text NOT NULL,
  CONSTRAINT ai_proposal_generation_reservation_receipts_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT ai_proposal_generation_reservation_receipts_invitation_fk
    FOREIGN KEY (
      invitation_id, case_id, student_auth_subject,
      faculty_auth_subject, faculty_auth_uid
    ) REFERENCES lor_studio.faculty_invitations (
      invitation_id, case_id, student_auth_subject,
      faculty_auth_subject, faculty_auth_uid
    ),
  CONSTRAINT ai_proposal_generation_reservation_receipts_phase_unique
    UNIQUE (
      case_id, student_auth_subject, faculty_auth_subject,
      idempotency_key, phase
    ),
  CONSTRAINT ai_proposal_generation_reservation_receipts_id_formats CHECK (
    receipt_id ~ '^ai_generation_state_[a-f0-9]{64}$'
    AND reservation_id ~ '^ai_generation_reservation_[a-f0-9]{64}$'
    AND student_auth_subject ~ '^wp:[1-9][0-9]*$'
    AND faculty_auth_subject ~ '^wp:[1-9][0-9]*$'
    AND invitation_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND pg_catalog.length(idempotency_key) BETWEEN 1 AND 200
    AND transaction_ref ~ '^txn_[a-f0-9]{64}$'
  ),
  CONSTRAINT ai_proposal_generation_reservation_receipts_phase_known CHECK (
    phase IN ('pending', 'unknown')
  ),
  CONSTRAINT ai_proposal_generation_reservation_receipts_hashes CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
    AND scope_hash ~ '^[a-f0-9]{64}$'
    AND target_binding_hash ~ '^[a-f0-9]{64}$'
    AND result_hash = lor_studio.canonical_jsonb_sha256(result)
  ),
  CONSTRAINT ai_proposal_generation_reservation_receipts_time_order CHECK (
    (phase = 'pending' AND settled_at IS NULL)
    OR (phase = 'unknown' AND settled_at IS NOT NULL AND settled_at >= reserved_at)
  ),
  CONSTRAINT ai_proposal_generation_reservation_receipts_result_shape CHECK (
    pg_catalog.jsonb_typeof(result) = 'object'
    AND pg_catalog.octet_length(result::text) <= 8192
    AND result ?& ARRAY[
      'schemaVersion', 'reservationId', 'caseId', 'idempotencyKey',
      'requestHash', 'scopeHash', 'targetBindingHash', 'status',
      'providerCallAuthorized', 'replayed', 'proposalId', 'record',
      'transactionRef', 'reservedAt', 'settledAt'
    ]::text[]
    AND result - ARRAY[
      'schemaVersion', 'reservationId', 'caseId', 'idempotencyKey',
      'requestHash', 'scopeHash', 'targetBindingHash', 'status',
      'providerCallAuthorized', 'replayed', 'proposalId', 'record',
      'transactionRef', 'reservedAt', 'settledAt'
    ]::text[] = '{}'::jsonb
    AND result ->> 'schemaVersion' =
      'missionmed.lor.ai-proposal-generation-reservation-receipt.v1'
    AND result ->> 'reservationId' = reservation_id
    AND result ->> 'caseId' = case_id
    AND result ->> 'idempotencyKey' = idempotency_key
    AND result ->> 'requestHash' = request_hash
    AND result ->> 'scopeHash' = scope_hash
    AND result ->> 'targetBindingHash' = target_binding_hash
    AND result ->> 'status' = phase
    AND result -> 'providerCallAuthorized' =
      CASE WHEN phase = 'pending' THEN 'true'::jsonb ELSE 'false'::jsonb END
    AND result -> 'replayed' = 'false'::jsonb
    AND result -> 'proposalId' = 'null'::jsonb
    AND result -> 'record' = 'null'::jsonb
    AND result ->> 'transactionRef' = transaction_ref
    AND (result ->> 'reservedAt')::timestamptz = reserved_at
    AND (
      settled_at IS NULL AND result -> 'settledAt' = 'null'::jsonb
      OR settled_at IS NOT NULL
      AND (result ->> 'settledAt')::timestamptz = settled_at
    )
  )
);

CREATE INDEX ai_proposal_generation_reservation_receipts_lookup_idx
  ON lor_studio.ai_proposal_generation_reservation_receipts (
    case_id, student_auth_subject, faculty_auth_subject,
    idempotency_key, phase
  );

ALTER TABLE lor_studio.ai_proposal_generation_reservation_receipts
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_proposal_generation_reservation_receipts
  FORCE ROW LEVEL SECURITY;

CREATE TRIGGER ai_proposal_generation_reservation_receipts_append_only
BEFORE UPDATE OR DELETE ON lor_studio.ai_proposal_generation_reservation_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE POLICY recommendation_cases_ai_command_service_select
ON lor_studio.recommendation_cases
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'save'
  AND pg_catalog.current_setting('lor_studio.purpose', true) = 'ai_generation'
  AND pg_catalog.current_setting('lor_studio.trusted_service_actor', true) =
    'lor-ai-proposal-store-v1'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
);

CREATE POLICY ai_generation_runs_ai_command_service_select
ON lor_studio.ai_generation_runs
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'save'
  AND pg_catalog.current_setting('lor_studio.purpose', true) = 'ai_generation'
  AND pg_catalog.current_setting('lor_studio.trusted_service_actor', true) =
    'lor-ai-proposal-store-v1'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
);

CREATE POLICY ai_generation_runs_ai_command_service_insert
ON lor_studio.ai_generation_runs
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
  AND pg_catalog.current_setting('lor_studio.action', true) = 'ai.provider_run.create'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'save'
  AND pg_catalog.current_setting('lor_studio.purpose', true) = 'ai_generation'
  AND pg_catalog.current_setting('lor_studio.trusted_service_actor', true) =
    'lor-ai-proposal-store-v1'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
);

CREATE POLICY ai_letter_proposals_ai_command_service_insert
ON lor_studio.ai_letter_proposals
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
  AND pg_catalog.current_setting('lor_studio.action', true) =
    'ai.letter_proposal.create'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'save'
  AND pg_catalog.current_setting('lor_studio.purpose', true) = 'ai_generation'
  AND pg_catalog.current_setting('lor_studio.trusted_service_actor', true) =
    'lor-ai-proposal-store-v1'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
);

CREATE POLICY ai_proposal_command_receipts_faculty_select
ON lor_studio.ai_proposal_command_receipts
FOR SELECT
TO lor_studio_command_owner
USING (
  lor_studio.ai_proposal_command_context_allows(case_id, 'save')
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
);

CREATE POLICY ai_proposal_command_receipts_faculty_insert
ON lor_studio.ai_proposal_command_receipts
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  lor_studio.ai_proposal_command_context_allows(case_id, 'save')
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
);

CREATE POLICY ai_proposal_generation_reservations_faculty_select
ON lor_studio.ai_proposal_generation_reservation_receipts
FOR SELECT
TO lor_studio_command_owner
USING (
  lor_studio.ai_proposal_command_context_allows(case_id, 'save')
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND faculty_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND faculty_auth_uid::text = pg_catalog.current_setting(
    'request.jwt.claim.sub', true
  )
  AND invitation_id = pg_catalog.current_setting(
    'lor_studio.invitation_id', true
  )
);

CREATE POLICY ai_proposal_generation_reservations_faculty_insert
ON lor_studio.ai_proposal_generation_reservation_receipts
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  lor_studio.ai_proposal_command_context_allows(case_id, 'save')
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND faculty_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND faculty_auth_uid::text = pg_catalog.current_setting(
    'request.jwt.claim.sub', true
  )
  AND invitation_id = pg_catalog.current_setting(
    'lor_studio.invitation_id', true
  )
);

CREATE FUNCTION lor_studio.transition_ai_proposal_generation_reservation(
  candidate_case_id text,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_scope_hash text,
  candidate_target_binding_hash text,
  candidate_operation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $transition_generation$
DECLARE
  current_case lor_studio.recommendation_cases%ROWTYPE;
  pending_receipt lor_studio.ai_proposal_generation_reservation_receipts%ROWTYPE;
  unknown_receipt lor_studio.ai_proposal_generation_reservation_receipts%ROWTYPE;
  accepted_receipt lor_studio.ai_proposal_command_receipts%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.statement_timestamp()
  );
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  );
  faculty_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  faculty_uid uuid := pg_catalog.current_setting(
    'request.jwt.claim.sub', true
  )::uuid;
  scope_invitation_id text := pg_catalog.current_setting(
    'lor_studio.invitation_id', true
  );
  reservation_id text;
  receipt_id text;
  transaction_ref text;
  result_record jsonb;
BEGIN
  IF candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 200
    OR candidate_request_hash !~ '^[a-f0-9]{64}$'
    OR candidate_scope_hash !~ '^[a-f0-9]{64}$'
    OR candidate_target_binding_hash !~ '^[a-f0-9]{64}$'
    OR candidate_operation <> ALL (ARRAY[
      'reserve_generation', 'mark_generation_unknown'
    ]::text[])
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_COMMAND_INVALID' USING ERRCODE = 'P1405';
  END IF;
  IF NOT lor_studio.ai_proposal_command_context_allows(candidate_case_id, 'save')
    OR candidate_scope_hash <>
      lor_studio.ai_proposal_scope_hash(candidate_case_id, 'save')
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1401';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.ai-generation-reservation.v1', candidate_case_id,
      student_subject, faculty_subject, candidate_idempotency_key
    )::text,
    0
  ));

  SELECT receipt.* INTO pending_receipt
  FROM lor_studio.ai_proposal_generation_reservation_receipts AS receipt
  WHERE receipt.case_id = candidate_case_id
    AND receipt.student_auth_subject = student_subject
    AND receipt.faculty_auth_subject = faculty_subject
    AND receipt.idempotency_key = candidate_idempotency_key
    AND receipt.phase = 'pending';
  SELECT receipt.* INTO unknown_receipt
  FROM lor_studio.ai_proposal_generation_reservation_receipts AS receipt
  WHERE receipt.case_id = candidate_case_id
    AND receipt.student_auth_subject = student_subject
    AND receipt.faculty_auth_subject = faculty_subject
    AND receipt.idempotency_key = candidate_idempotency_key
    AND receipt.phase = 'unknown';
  SELECT receipt.* INTO accepted_receipt
  FROM lor_studio.ai_proposal_command_receipts AS receipt
  WHERE receipt.case_id = candidate_case_id
    AND receipt.student_auth_subject = student_subject
    AND receipt.idempotency_key = candidate_idempotency_key
    AND receipt.operation = 'put_proposal';

  IF pending_receipt.receipt_id IS NOT NULL
      AND pending_receipt.request_hash <> candidate_request_hash
    OR unknown_receipt.receipt_id IS NOT NULL
      AND unknown_receipt.request_hash <> candidate_request_hash
    OR accepted_receipt.receipt_id IS NOT NULL
      AND accepted_receipt.request_hash <> candidate_request_hash
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_IDEMPOTENCY_CONFLICT'
      USING ERRCODE = 'P1402';
  END IF;

  reservation_id := 'ai_generation_reservation_' ||
    lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
      'caseId', candidate_case_id,
      'studentSubject', student_subject,
      'facultySubject', faculty_subject,
      'idempotencyKey', candidate_idempotency_key
    ));

  IF pending_receipt.receipt_id IS NOT NULL THEN
    IF accepted_receipt.receipt_id IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'schemaVersion',
          'missionmed.lor.ai-proposal-generation-reservation-receipt.v1',
        'reservationId', reservation_id,
        'caseId', candidate_case_id,
        'idempotencyKey', candidate_idempotency_key,
        'requestHash', candidate_request_hash,
        'scopeHash', candidate_scope_hash,
        'targetBindingHash', candidate_target_binding_hash,
        'status', 'accepted',
        'providerCallAuthorized', false,
        'replayed', true,
        'proposalId', accepted_receipt.proposal_id,
        'record', accepted_receipt.result -> 'record',
        'transactionRef', accepted_receipt.transaction_ref,
        'reservedAt', pg_catalog.to_char(
          pending_receipt.reserved_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'settledAt', pg_catalog.to_char(
          accepted_receipt.committed_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      );
    END IF;
    IF unknown_receipt.receipt_id IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'schemaVersion',
          'missionmed.lor.ai-proposal-generation-reservation-receipt.v1',
        'reservationId', reservation_id,
        'caseId', candidate_case_id,
        'idempotencyKey', candidate_idempotency_key,
        'requestHash', candidate_request_hash,
        'scopeHash', candidate_scope_hash,
        'targetBindingHash', candidate_target_binding_hash,
        'status', 'unknown',
        'providerCallAuthorized', false,
        'replayed', true,
        'proposalId', NULL,
        'record', NULL,
        'transactionRef', unknown_receipt.transaction_ref,
        'reservedAt', pg_catalog.to_char(
          pending_receipt.reserved_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'settledAt', pg_catalog.to_char(
          unknown_receipt.settled_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      );
    END IF;
    IF candidate_operation = 'reserve_generation' THEN
      RETURN pg_catalog.jsonb_build_object(
        'schemaVersion',
          'missionmed.lor.ai-proposal-generation-reservation-receipt.v1',
        'reservationId', reservation_id,
        'caseId', candidate_case_id,
        'idempotencyKey', candidate_idempotency_key,
        'requestHash', candidate_request_hash,
        'scopeHash', candidate_scope_hash,
        'targetBindingHash', candidate_target_binding_hash,
        'status', 'pending',
        'providerCallAuthorized', false,
        'replayed', true,
        'proposalId', NULL,
        'record', NULL,
        'transactionRef', pending_receipt.transaction_ref,
        'reservedAt', pg_catalog.to_char(
          pending_receipt.reserved_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'settledAt', NULL
      );
    END IF;
  END IF;

  IF candidate_operation = 'mark_generation_unknown'
    AND pending_receipt.receipt_id IS NULL
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_STATE_INVALID' USING ERRCODE = 'P1404';
  END IF;

  IF candidate_operation = 'reserve_generation' THEN
    SELECT recommendation_case.* INTO current_case
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = candidate_case_id
      AND recommendation_case.student_auth_subject = student_subject;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LOR_AI_PROPOSAL_NOT_FOUND' USING ERRCODE = 'P1403';
    END IF;
    IF current_case.status IN ('delivered', 'closed', 'cancelled')
      OR current_case.released_at IS NOT NULL
    THEN
      RAISE EXCEPTION 'LOR_AI_PROPOSAL_STATE_INVALID' USING ERRCODE = 'P1404';
    END IF;
    receipt_id := 'ai_generation_state_' ||
      lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
        'reservationId', reservation_id, 'phase', 'pending'
      ));
    transaction_ref := 'txn_' ||
      lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
        'receiptId', receipt_id, 'transactionId', transaction_id
      ));
    result_record := pg_catalog.jsonb_build_object(
      'schemaVersion',
        'missionmed.lor.ai-proposal-generation-reservation-receipt.v1',
      'reservationId', reservation_id,
      'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key,
      'requestHash', candidate_request_hash,
      'scopeHash', candidate_scope_hash,
      'targetBindingHash', candidate_target_binding_hash,
      'status', 'pending',
      'providerCallAuthorized', true,
      'replayed', false,
      'proposalId', NULL,
      'record', NULL,
      'transactionRef', transaction_ref,
      'reservedAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'settledAt', NULL
    );
    INSERT INTO lor_studio.ai_proposal_generation_reservation_receipts (
      receipt_id, reservation_id, phase, case_id, student_auth_subject,
      faculty_auth_subject, faculty_auth_uid, invitation_id, idempotency_key,
      request_hash, scope_hash, target_binding_hash, transaction_ref,
      reserved_at, settled_at, result, result_hash
    ) VALUES (
      receipt_id, reservation_id, 'pending', candidate_case_id, student_subject,
      faculty_subject, faculty_uid, scope_invitation_id, candidate_idempotency_key,
      candidate_request_hash, candidate_scope_hash, candidate_target_binding_hash,
      transaction_ref, command_at, NULL, result_record,
      lor_studio.canonical_jsonb_sha256(result_record)
    );
    RETURN result_record;
  END IF;

  receipt_id := 'ai_generation_state_' ||
    lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
      'reservationId', reservation_id, 'phase', 'unknown'
    ));
  transaction_ref := 'txn_' ||
    lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
      'receiptId', receipt_id, 'transactionId', transaction_id
    ));
  result_record := pg_catalog.jsonb_build_object(
    'schemaVersion',
      'missionmed.lor.ai-proposal-generation-reservation-receipt.v1',
    'reservationId', reservation_id,
    'caseId', candidate_case_id,
    'idempotencyKey', candidate_idempotency_key,
    'requestHash', candidate_request_hash,
    'scopeHash', candidate_scope_hash,
    'targetBindingHash', candidate_target_binding_hash,
    'status', 'unknown',
    'providerCallAuthorized', false,
    'replayed', false,
    'proposalId', NULL,
    'record', NULL,
    'transactionRef', transaction_ref,
    'reservedAt', pg_catalog.to_char(
      pending_receipt.reserved_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'settledAt', pg_catalog.to_char(
      command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );
  INSERT INTO lor_studio.ai_proposal_generation_reservation_receipts (
    receipt_id, reservation_id, phase, case_id, student_auth_subject,
    faculty_auth_subject, faculty_auth_uid, invitation_id, idempotency_key,
    request_hash, scope_hash, target_binding_hash, transaction_ref,
    reserved_at, settled_at, result, result_hash
  ) VALUES (
    receipt_id, reservation_id, 'unknown', candidate_case_id, student_subject,
    faculty_subject, faculty_uid, scope_invitation_id, candidate_idempotency_key,
    candidate_request_hash, candidate_scope_hash, candidate_target_binding_hash,
    transaction_ref, pending_receipt.reserved_at, command_at, result_record,
    lor_studio.canonical_jsonb_sha256(result_record)
  );
  RETURN result_record;
EXCEPTION
  WHEN SQLSTATE 'P1401' OR SQLSTATE 'P1402' OR SQLSTATE 'P1403'
    OR SQLSTATE 'P1404' OR SQLSTATE 'P1405' THEN RAISE;
  WHEN invalid_text_representation OR insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_AUTHORIZATION_DENIED' USING ERRCODE = 'P1401';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_COMMAND_INVALID' USING ERRCODE = 'P1405';
END;
$transition_generation$;

CREATE FUNCTION lor_studio.persist_ai_provider_run_and_proposal_atomic(
  candidate_case_id text,
  candidate_proposal_id text,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_scope_hash text,
  candidate_target_binding_hash text,
  candidate_submitted_record_hash text,
  candidate_provider_run_hash text,
  candidate_output_hash text,
  candidate_record jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $persist_proposal$
DECLARE
  current_case lor_studio.recommendation_cases%ROWTYPE;
  pending_reservation lor_studio.ai_proposal_generation_reservation_receipts%ROWTYPE;
  unknown_reservation lor_studio.ai_proposal_generation_reservation_receipts%ROWTYPE;
  stored_receipt lor_studio.ai_proposal_command_receipts%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.statement_timestamp()
  );
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  );
  faculty_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  run_id text := 'run_' || candidate_provider_run_hash;
  actor_ref text;
  case_ref text;
  correlation_ref text;
  event_ref text;
  receipt_id text;
  transaction_ref text;
  event_record jsonb;
  event_hash text;
  result_record jsonb;
  expected_request_hash text;
BEGIN
  expected_request_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'operation', 'ai.proposal.generate',
      'caseId', candidate_case_id,
      'actorId', faculty_subject,
      'templateVersion', candidate_record -> 'provenance' ->> 'templateVersion',
      'factIds', COALESCE((
        SELECT pg_catalog.jsonb_agg(source.reference -> 'id' ORDER BY source.ordinal_position)
        FROM pg_catalog.jsonb_array_elements(
          candidate_record -> 'provenance' -> 'sourceReferences'
        ) WITH ORDINALITY AS source(reference, ordinal_position)
      ), '[]'::jsonb)
    )
  );
  IF candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_proposal_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 200
    OR candidate_request_hash !~ '^[a-f0-9]{64}$'
    OR candidate_request_hash IS DISTINCT FROM expected_request_hash
    OR candidate_scope_hash !~ '^[a-f0-9]{64}$'
    OR candidate_target_binding_hash !~ '^[a-f0-9]{64}$'
    OR candidate_submitted_record_hash !~ '^[a-f0-9]{64}$'
    OR candidate_provider_run_hash !~ '^[a-f0-9]{64}$'
    OR candidate_output_hash !~ '^[a-f0-9]{64}$'
    OR NOT lor_studio.ai_proposal_record_is_complete(candidate_record)
    OR candidate_record ->> 'state' <> 'proposal'
    OR candidate_record ->> 'id' <> candidate_proposal_id
    OR candidate_record ->> 'caseId' <> candidate_case_id
    OR candidate_record ->> 'requestedBy' <> faculty_subject
    OR candidate_submitted_record_hash <>
      lor_studio.canonical_jsonb_sha256(candidate_record)
    OR candidate_provider_run_hash <>
      lor_studio.canonical_jsonb_sha256(candidate_record -> 'provenance')
    OR candidate_output_hash <>
      candidate_record -> 'provenance' ->> 'outputHash'
    OR (candidate_record ->> 'requestedAt')::timestamptz > command_at
    OR (candidate_record -> 'provenance' ->> 'generatedAt')::timestamptz > command_at
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_COMMAND_INVALID' USING ERRCODE = 'P1405';
  END IF;
  IF NOT lor_studio.ai_proposal_command_context_allows(candidate_case_id, 'save')
    OR candidate_scope_hash <>
      lor_studio.ai_proposal_scope_hash(candidate_case_id, 'save')
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1401';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1', candidate_case_id, student_subject
    )::text,
    0
  ));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.ai-generation-reservation.v1', candidate_case_id,
      student_subject, faculty_subject, candidate_idempotency_key
    )::text,
    0
  ));

  SELECT reservation.* INTO pending_reservation
  FROM lor_studio.ai_proposal_generation_reservation_receipts AS reservation
  WHERE reservation.case_id = candidate_case_id
    AND reservation.student_auth_subject = student_subject
    AND reservation.faculty_auth_subject = faculty_subject
    AND reservation.idempotency_key = candidate_idempotency_key
    AND reservation.phase = 'pending';
  SELECT reservation.* INTO unknown_reservation
  FROM lor_studio.ai_proposal_generation_reservation_receipts AS reservation
  WHERE reservation.case_id = candidate_case_id
    AND reservation.student_auth_subject = student_subject
    AND reservation.faculty_auth_subject = faculty_subject
    AND reservation.idempotency_key = candidate_idempotency_key
    AND reservation.phase = 'unknown';
  IF pending_reservation.receipt_id IS NULL THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_STATE_INVALID' USING ERRCODE = 'P1404';
  END IF;
  IF pending_reservation.request_hash <> candidate_request_hash THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_IDEMPOTENCY_CONFLICT'
      USING ERRCODE = 'P1402';
  END IF;
  IF unknown_reservation.receipt_id IS NOT NULL THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_STATE_INVALID' USING ERRCODE = 'P1404';
  END IF;

  SELECT receipt.* INTO stored_receipt
  FROM lor_studio.ai_proposal_command_receipts AS receipt
  WHERE receipt.case_id = candidate_case_id
    AND receipt.student_auth_subject = student_subject
    AND receipt.idempotency_key = candidate_idempotency_key;
  IF FOUND THEN
    IF stored_receipt.operation <> 'put_proposal'
      OR stored_receipt.request_hash <> candidate_request_hash
    THEN
      RAISE EXCEPTION 'LOR_AI_PROPOSAL_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = 'P1402';
    END IF;
    RETURN stored_receipt.result || pg_catalog.jsonb_build_object(
      'outcome', 'replayed',
      'writeApplied', false,
      'replayed', true,
      'submittedProposalId', candidate_proposal_id,
      'submittedRecordHash', candidate_submitted_record_hash
    );
  END IF;

  SELECT recommendation_case.* INTO current_case
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = candidate_case_id
    AND recommendation_case.student_auth_subject = student_subject;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_NOT_FOUND' USING ERRCODE = 'P1403';
  END IF;
  IF current_case.status IN ('delivered', 'closed', 'cancelled')
    OR current_case.released_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_STATE_INVALID' USING ERRCODE = 'P1404';
  END IF;

  PERFORM pg_catalog.set_config('lor_studio.actor_role', 'service', true);
  PERFORM pg_catalog.set_config('lor_studio.operation', 'save', true);
  PERFORM pg_catalog.set_config('lor_studio.purpose', 'ai_generation', true);
  PERFORM pg_catalog.set_config(
    'lor_studio.action', 'ai.provider_run.create', true
  );
  INSERT INTO lor_studio.ai_generation_runs (
    run_id, case_id, student_auth_subject, requested_by_actor_ref,
    provider_kind, provider_configuration_hash, input_hash,
    grounding_manifest_hash, status, started_at, completed_at, error_code,
    run_hash
  ) VALUES (
    run_id,
    candidate_case_id,
    student_subject,
    'actor_' || pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      'lor-studio:actor:' || faculty_subject, 'UTF8'
    )), 'hex'),
    'configured_external',
    lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
      'provider', candidate_record -> 'provenance' ->> 'provider',
      'model', candidate_record -> 'provenance' ->> 'model'
    )),
    candidate_request_hash,
    candidate_record -> 'grounding' ->> 'attestationHash',
    'succeeded', command_at, command_at, NULL, candidate_provider_run_hash
  );

  PERFORM pg_catalog.set_config(
    'lor_studio.action', 'ai.letter_proposal.create', true
  );
  INSERT INTO lor_studio.ai_letter_proposals (
    proposal_id, run_id, case_id, student_auth_subject, idempotency_key,
    request_hash, proposal_text, proposal_output_hash, grounding_manifest,
    grounding_manifest_hash, created_at, proposal_record,
    proposal_record_hash, provider_run_hash
  ) VALUES (
    candidate_proposal_id, run_id, candidate_case_id, student_subject,
    candidate_idempotency_key, candidate_request_hash,
    candidate_record ->> 'text', candidate_output_hash,
    candidate_record -> 'grounding',
    candidate_record -> 'grounding' ->> 'attestationHash',
    command_at, candidate_record, candidate_submitted_record_hash,
    candidate_provider_run_hash
  );

  PERFORM pg_catalog.set_config('lor_studio.actor_role', 'faculty', true);
  PERFORM pg_catalog.set_config('lor_studio.operation', 'save', true);
  PERFORM pg_catalog.set_config('lor_studio.purpose', 'faculty_private_edit', true);
  PERFORM pg_catalog.set_config('lor_studio.action', '', true);

  actor_ref := 'actor_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('actorId', faculty_subject)
  );
  case_ref := 'case_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('caseId', candidate_case_id)
  );
  correlation_ref := 'correlation_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'operation', 'put_proposal', 'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  event_ref := 'event_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('correlationRef', correlation_ref, 'outcome', 'success')
  );
  receipt_id := 'ai_command_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'operation', 'put_proposal', 'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  transaction_ref := 'txn_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('receiptId', receipt_id, 'transactionId', transaction_id)
  );
  event_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.service-event.v1',
    'eventRef', event_ref,
    'eventType', 'ai.proposal_generated',
    'caseRef', case_ref,
    'actorRef', actor_ref,
    'actorRole', 'faculty',
    'correlationRef', correlation_ref,
    'outcome', 'success',
    'revision', current_case.revision,
    'occurredAt', pg_catalog.to_char(
      command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );
  event_hash := lor_studio.canonical_jsonb_sha256(event_record);
  INSERT INTO lor_studio.recommendation_case_audit_events (
    event_ref, case_id, student_auth_subject, case_ref, actor_ref, actor_role,
    correlation_ref, event_type, outcome, revision, occurred_at, event,
    event_hash, transaction_id
  ) VALUES (
    event_ref, candidate_case_id, student_subject, case_ref, actor_ref,
    'faculty', correlation_ref, 'ai.proposal_generated', 'success',
    current_case.revision, command_at, event_record, event_hash, transaction_id
  );

  result_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.ai-proposal-write-receipt.v1',
    'operation', 'put_proposal',
    'outcome', 'committed',
    'writeApplied', true,
    'replayed', false,
    'sameTransaction', true,
    'databaseClockUsed', true,
    'caseId', candidate_case_id,
    'submittedProposalId', candidate_proposal_id,
    'proposalId', candidate_proposal_id,
    'idempotencyKey', candidate_idempotency_key,
    'requestHash', candidate_request_hash,
    'scopeHash', candidate_scope_hash,
    'targetBindingHash', candidate_target_binding_hash,
    'submittedRecordHash', candidate_submitted_record_hash,
    'recordHash', candidate_submitted_record_hash,
    'providerRunHash', candidate_provider_run_hash,
    'outputHash', candidate_output_hash,
    'decisionHash', NULL,
    'acceptedContentHash', NULL,
    'transactionRef', transaction_ref,
    'committedAt', pg_catalog.to_char(
      command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'record', candidate_record
  );
  INSERT INTO lor_studio.ai_proposal_command_receipts (
    receipt_id, operation, case_id, student_auth_subject,
    submitted_proposal_id, proposal_id, idempotency_key, request_hash,
    scope_hash, target_binding_hash, submitted_record_hash, record_hash,
    provider_run_hash, output_hash, decision_hash, accepted_content_hash,
    transaction_ref, committed_at, audit_event_ref, result, result_hash
  ) VALUES (
    receipt_id, 'put_proposal', candidate_case_id, student_subject,
    candidate_proposal_id, candidate_proposal_id, candidate_idempotency_key,
    candidate_request_hash, candidate_scope_hash, candidate_target_binding_hash,
    candidate_submitted_record_hash, candidate_submitted_record_hash,
    candidate_provider_run_hash, candidate_output_hash, NULL, NULL,
    transaction_ref, command_at, event_ref, result_record,
    lor_studio.canonical_jsonb_sha256(result_record)
  );
  RETURN result_record;
EXCEPTION
  WHEN SQLSTATE 'P1401' OR SQLSTATE 'P1402' OR SQLSTATE 'P1403'
    OR SQLSTATE 'P1404' OR SQLSTATE 'P1405' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_AUTHORIZATION_DENIED' USING ERRCODE = 'P1401';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_COMMAND_INVALID' USING ERRCODE = 'P1405';
END;
$persist_proposal$;

CREATE FUNCTION lor_studio.read_actor_safe_ai_proposal(
  candidate_case_id text,
  candidate_proposal_id text,
  candidate_scope_hash text,
  candidate_target_binding_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $read_proposal$
DECLARE
  stored_proposal lor_studio.ai_letter_proposals%ROWTYPE;
  stored_decision lor_studio.ai_proposal_decisions%ROWTYPE;
  selected_record jsonb;
  selected_record_hash text;
  selected_decision_hash text;
  selected_accepted_content_hash text;
BEGIN
  IF candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_proposal_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_scope_hash !~ '^[a-f0-9]{64}$'
    OR candidate_target_binding_hash !~ '^[a-f0-9]{64}$'
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_COMMAND_INVALID' USING ERRCODE = 'P1405';
  END IF;
  IF NOT lor_studio.ai_proposal_command_context_allows(candidate_case_id, 'read')
    OR candidate_scope_hash <>
      lor_studio.ai_proposal_scope_hash(candidate_case_id, 'read')
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1401';
  END IF;
  SELECT proposal.* INTO stored_proposal
  FROM lor_studio.ai_letter_proposals AS proposal
  WHERE proposal.case_id = candidate_case_id
    AND proposal.student_auth_subject = pg_catalog.current_setting(
      'lor_studio.resource_student_id', true
    )
    AND proposal.proposal_id = candidate_proposal_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.ai-proposal-read-receipt.v1',
      'found', false,
      'caseId', candidate_case_id,
      'proposalId', candidate_proposal_id,
      'scopeHash', candidate_scope_hash,
      'targetBindingHash', candidate_target_binding_hash,
      'recordHash', NULL,
      'providerRunHash', NULL,
      'outputHash', NULL,
      'decisionHash', NULL,
      'acceptedContentHash', NULL,
      'record', NULL
    );
  END IF;
  SELECT decision.* INTO stored_decision
  FROM lor_studio.ai_proposal_decisions AS decision
  WHERE decision.proposal_id = stored_proposal.proposal_id
    AND decision.case_id = stored_proposal.case_id
    AND decision.student_auth_subject = stored_proposal.student_auth_subject;
  IF FOUND THEN
    selected_record := stored_decision.proposal_record;
    selected_record_hash := stored_decision.proposal_record_hash;
    selected_decision_hash := stored_decision.decision_hash;
    selected_accepted_content_hash := stored_decision.accepted_content_record_hash;
  ELSE
    selected_record := stored_proposal.proposal_record;
    selected_record_hash := stored_proposal.proposal_record_hash;
    selected_decision_hash := NULL;
    selected_accepted_content_hash := NULL;
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.ai-proposal-read-receipt.v1',
    'found', true,
    'caseId', candidate_case_id,
    'proposalId', candidate_proposal_id,
    'scopeHash', candidate_scope_hash,
    'targetBindingHash', candidate_target_binding_hash,
    'recordHash', selected_record_hash,
    'providerRunHash', stored_proposal.provider_run_hash,
    'outputHash', stored_proposal.proposal_output_hash,
    'decisionHash', selected_decision_hash,
    'acceptedContentHash', selected_accepted_content_hash,
    'record', selected_record
  );
EXCEPTION
  WHEN SQLSTATE 'P1401' OR SQLSTATE 'P1405' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_AUTHORIZATION_DENIED' USING ERRCODE = 'P1401';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_COMMAND_INVALID' USING ERRCODE = 'P1405';
END;
$read_proposal$;

CREATE FUNCTION lor_studio.attach_ai_proposal_decision_if_undecided_atomic(
  candidate_case_id text,
  candidate_proposal_id text,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_scope_hash text,
  candidate_target_binding_hash text,
  candidate_submitted_record_hash text,
  candidate_provider_run_hash text,
  candidate_output_hash text,
  candidate_decision_hash text,
  candidate_accepted_content_hash text,
  candidate_record jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $attach_decision$
DECLARE
  current_case lor_studio.recommendation_cases%ROWTYPE;
  stored_proposal lor_studio.ai_letter_proposals%ROWTYPE;
  existing_decision lor_studio.ai_proposal_decisions%ROWTYPE;
  stored_receipt lor_studio.ai_proposal_command_receipts%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.statement_timestamp()
  );
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  );
  faculty_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  decision_record jsonb := candidate_record -> 'decision';
  accepted_content jsonb := candidate_record -> 'acceptedContent';
  actor_ref text;
  case_ref text;
  correlation_ref text;
  event_ref text;
  receipt_id text;
  transaction_ref text;
  event_record jsonb;
  event_hash text;
  result_record jsonb;
  expected_request_hash text;
BEGIN
  expected_request_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'operation', 'ai.proposal.decide',
      'caseId', candidate_case_id,
      'proposalId', candidate_proposal_id,
      'actorId', faculty_subject,
      'action', decision_record ->> 'action',
      'resultingTextHash', decision_record -> 'resultingTextHash'
    )
  );
  IF candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_proposal_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 200
    OR candidate_request_hash !~ '^[a-f0-9]{64}$'
    OR candidate_request_hash IS DISTINCT FROM expected_request_hash
    OR candidate_scope_hash !~ '^[a-f0-9]{64}$'
    OR candidate_target_binding_hash !~ '^[a-f0-9]{64}$'
    OR candidate_submitted_record_hash !~ '^[a-f0-9]{64}$'
    OR candidate_provider_run_hash !~ '^[a-f0-9]{64}$'
    OR candidate_output_hash !~ '^[a-f0-9]{64}$'
    OR candidate_decision_hash !~ '^[a-f0-9]{64}$'
    OR (
      candidate_accepted_content_hash IS NOT NULL
      AND candidate_accepted_content_hash !~ '^[a-f0-9]{64}$'
    )
    OR NOT lor_studio.ai_proposal_record_is_complete(candidate_record)
    OR candidate_record ->> 'state' <> 'decided'
    OR candidate_record ->> 'id' <> candidate_proposal_id
    OR candidate_record ->> 'caseId' <> candidate_case_id
    OR decision_record ->> 'facultyId' <> faculty_subject
    OR candidate_submitted_record_hash <>
      lor_studio.canonical_jsonb_sha256(candidate_record)
    OR candidate_provider_run_hash <>
      lor_studio.canonical_jsonb_sha256(candidate_record -> 'provenance')
    OR candidate_output_hash <>
      candidate_record -> 'provenance' ->> 'outputHash'
    OR candidate_decision_hash <>
      lor_studio.canonical_jsonb_sha256(decision_record)
    OR candidate_accepted_content_hash IS DISTINCT FROM (CASE
      WHEN pg_catalog.jsonb_typeof(accepted_content) = 'null' THEN NULL::text
      ELSE lor_studio.canonical_jsonb_sha256(accepted_content)
    END)
    OR (decision_record ->> 'decidedAt')::timestamptz > command_at
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_COMMAND_INVALID' USING ERRCODE = 'P1405';
  END IF;
  IF NOT lor_studio.ai_proposal_command_context_allows(candidate_case_id, 'save')
    OR candidate_scope_hash <>
      lor_studio.ai_proposal_scope_hash(candidate_case_id, 'save')
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1401';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1', candidate_case_id, student_subject
    )::text,
    0
  ));
  SELECT receipt.* INTO stored_receipt
  FROM lor_studio.ai_proposal_command_receipts AS receipt
  WHERE receipt.case_id = candidate_case_id
    AND receipt.student_auth_subject = student_subject
    AND receipt.idempotency_key = candidate_idempotency_key;
  IF FOUND THEN
    IF stored_receipt.operation <> 'attach_decision'
      OR stored_receipt.proposal_id <> candidate_proposal_id
      OR stored_receipt.request_hash <> candidate_request_hash
    THEN
      RAISE EXCEPTION 'LOR_AI_PROPOSAL_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = 'P1402';
    END IF;
    RETURN stored_receipt.result || pg_catalog.jsonb_build_object(
      'outcome', 'replayed',
      'writeApplied', false,
      'replayed', true,
      'submittedProposalId', candidate_proposal_id,
      'submittedRecordHash', candidate_submitted_record_hash
    );
  END IF;

  SELECT proposal.* INTO stored_proposal
  FROM lor_studio.ai_letter_proposals AS proposal
  WHERE proposal.proposal_id = candidate_proposal_id
    AND proposal.case_id = candidate_case_id
    AND proposal.student_auth_subject = student_subject;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_NOT_FOUND' USING ERRCODE = 'P1403';
  END IF;
  IF stored_proposal.provider_run_hash <> candidate_provider_run_hash
    OR stored_proposal.proposal_output_hash <> candidate_output_hash
    OR stored_proposal.proposal_text <> candidate_record ->> 'text'
    OR stored_proposal.grounding_manifest <> candidate_record -> 'grounding'
    OR stored_proposal.proposal_record -> 'provenance' <>
      candidate_record -> 'provenance'
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_STATE_INVALID' USING ERRCODE = 'P1404';
  END IF;
  SELECT decision.* INTO existing_decision
  FROM lor_studio.ai_proposal_decisions AS decision
  WHERE decision.proposal_id = candidate_proposal_id;
  IF FOUND THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_ALREADY_DECIDED' USING ERRCODE = 'P1404';
  END IF;
  SELECT recommendation_case.* INTO current_case
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = candidate_case_id
    AND recommendation_case.student_auth_subject = student_subject;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_NOT_FOUND' USING ERRCODE = 'P1403';
  END IF;
  IF current_case.status IN ('delivered', 'closed', 'cancelled')
    OR current_case.released_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_STATE_INVALID' USING ERRCODE = 'P1404';
  END IF;

  INSERT INTO lor_studio.ai_proposal_decisions (
    decision_id, proposal_id, case_id, student_auth_subject,
    faculty_auth_subject, faculty_auth_uid, invitation_id, idempotency_key,
    request_hash, action, proposal_output_hash, proposal_text,
    resulting_text_hash, accepted_content_origin, accepted_content_text,
    accepted_content_hash, accepted_support_ids,
    accepted_grounding_attestation_hash, grounded_as_attested, reason_code,
    decided_at, decision_hash, proposal_record, proposal_record_hash,
    decision_record, accepted_content_record_hash
  ) VALUES (
    decision_record ->> 'id', candidate_proposal_id, candidate_case_id,
    student_subject, faculty_subject,
    pg_catalog.current_setting('request.jwt.claim.sub', true)::uuid,
    pg_catalog.current_setting('lor_studio.invitation_id', true),
    candidate_idempotency_key, candidate_request_hash,
    decision_record ->> 'action', candidate_output_hash,
    candidate_record ->> 'text', decision_record ->> 'resultingTextHash',
    accepted_content ->> 'origin', accepted_content ->> 'text',
    accepted_content ->> 'textHash',
    CASE WHEN pg_catalog.jsonb_typeof(accepted_content) = 'null' THEN NULL
      ELSE ARRAY(
        SELECT support.value
        FROM pg_catalog.jsonb_array_elements_text(
          accepted_content -> 'supportIds'
        ) AS support(value)
      )
    END,
    accepted_content ->> 'groundingAttestationHash',
    CASE WHEN pg_catalog.jsonb_typeof(accepted_content) = 'null' THEN NULL
      ELSE (accepted_content ->> 'groundedAsAttested')::boolean
    END,
    NULL, (decision_record ->> 'decidedAt')::timestamptz,
    candidate_decision_hash, candidate_record,
    candidate_submitted_record_hash, decision_record,
    candidate_accepted_content_hash
  );

  actor_ref := 'actor_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('actorId', faculty_subject)
  );
  case_ref := 'case_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('caseId', candidate_case_id)
  );
  correlation_ref := 'correlation_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'operation', 'attach_decision', 'caseId', candidate_case_id,
      'proposalId', candidate_proposal_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  event_ref := 'event_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('correlationRef', correlation_ref, 'outcome', 'success')
  );
  receipt_id := 'ai_command_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'operation', 'attach_decision', 'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  transaction_ref := 'txn_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('receiptId', receipt_id, 'transactionId', transaction_id)
  );
  event_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.service-event.v1',
    'eventRef', event_ref,
    'eventType', 'ai.proposal_decision_recorded',
    'caseRef', case_ref,
    'actorRef', actor_ref,
    'actorRole', 'faculty',
    'correlationRef', correlation_ref,
    'outcome', 'success',
    'revision', current_case.revision,
    'occurredAt', pg_catalog.to_char(
      command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );
  event_hash := lor_studio.canonical_jsonb_sha256(event_record);
  INSERT INTO lor_studio.recommendation_case_audit_events (
    event_ref, case_id, student_auth_subject, case_ref, actor_ref, actor_role,
    correlation_ref, event_type, outcome, revision, occurred_at, event,
    event_hash, transaction_id
  ) VALUES (
    event_ref, candidate_case_id, student_subject, case_ref, actor_ref,
    'faculty', correlation_ref, 'ai.proposal_decision_recorded', 'success',
    current_case.revision, command_at, event_record, event_hash, transaction_id
  );
  result_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.ai-proposal-write-receipt.v1',
    'operation', 'attach_decision',
    'outcome', 'committed',
    'writeApplied', true,
    'replayed', false,
    'sameTransaction', true,
    'databaseClockUsed', true,
    'caseId', candidate_case_id,
    'submittedProposalId', candidate_proposal_id,
    'proposalId', candidate_proposal_id,
    'idempotencyKey', candidate_idempotency_key,
    'requestHash', candidate_request_hash,
    'scopeHash', candidate_scope_hash,
    'targetBindingHash', candidate_target_binding_hash,
    'submittedRecordHash', candidate_submitted_record_hash,
    'recordHash', candidate_submitted_record_hash,
    'providerRunHash', candidate_provider_run_hash,
    'outputHash', candidate_output_hash,
    'decisionHash', candidate_decision_hash,
    'acceptedContentHash', candidate_accepted_content_hash,
    'transactionRef', transaction_ref,
    'committedAt', pg_catalog.to_char(
      command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'record', candidate_record
  );
  INSERT INTO lor_studio.ai_proposal_command_receipts (
    receipt_id, operation, case_id, student_auth_subject,
    submitted_proposal_id, proposal_id, idempotency_key, request_hash,
    scope_hash, target_binding_hash, submitted_record_hash, record_hash,
    provider_run_hash, output_hash, decision_hash, accepted_content_hash,
    transaction_ref, committed_at, audit_event_ref, result, result_hash
  ) VALUES (
    receipt_id, 'attach_decision', candidate_case_id, student_subject,
    candidate_proposal_id, candidate_proposal_id, candidate_idempotency_key,
    candidate_request_hash, candidate_scope_hash, candidate_target_binding_hash,
    candidate_submitted_record_hash, candidate_submitted_record_hash,
    candidate_provider_run_hash, candidate_output_hash,
    candidate_decision_hash, candidate_accepted_content_hash,
    transaction_ref, command_at, event_ref, result_record,
    lor_studio.canonical_jsonb_sha256(result_record)
  );
  RETURN result_record;
EXCEPTION
  WHEN SQLSTATE 'P1401' OR SQLSTATE 'P1402' OR SQLSTATE 'P1403'
    OR SQLSTATE 'P1404' OR SQLSTATE 'P1405' THEN RAISE;
  WHEN unique_violation THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_ALREADY_DECIDED' USING ERRCODE = 'P1404';
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_AUTHORIZATION_DENIED' USING ERRCODE = 'P1401';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_AI_PROPOSAL_COMMAND_INVALID' USING ERRCODE = 'P1405';
END;
$attach_decision$;

REVOKE ALL ON TABLE lor_studio.ai_proposal_command_receipts FROM PUBLIC;
REVOKE ALL ON TABLE lor_studio.ai_proposal_command_receipts FROM lor_studio_app;
REVOKE ALL ON TABLE lor_studio.ai_proposal_generation_reservation_receipts
FROM PUBLIC;
REVOKE ALL ON TABLE lor_studio.ai_proposal_generation_reservation_receipts
FROM lor_studio_app;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE
  lor_studio.ai_generation_runs,
  lor_studio.ai_letter_proposals,
  lor_studio.ai_proposal_decisions
FROM lor_studio_app;

GRANT SELECT, INSERT ON TABLE
  lor_studio.ai_generation_runs,
  lor_studio.ai_letter_proposals,
  lor_studio.ai_proposal_decisions,
  lor_studio.ai_proposal_command_receipts,
  lor_studio.ai_proposal_generation_reservation_receipts
TO lor_studio_command_owner;

REVOKE ALL ON FUNCTION lor_studio.ai_proposal_record_is_complete(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.ai_proposal_command_context_allows(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.ai_proposal_scope_hash(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.read_faculty_drafting_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.transition_ai_proposal_generation_reservation(
  text, text, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.persist_ai_provider_run_and_proposal_atomic(
  text, text, text, text, text, text, text, text, text, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.read_actor_safe_ai_proposal(
  text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.attach_ai_proposal_decision_if_undecided_atomic(
  text, text, text, text, text, text, text, text, text, text, text, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION lor_studio.ai_proposal_record_is_complete(jsonb)
TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.ai_grounding_manifest_is_complete(jsonb)
TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.ai_proposal_command_context_allows(text, text)
TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.ai_proposal_scope_hash(text, text)
TO lor_studio_command_owner;

ALTER FUNCTION lor_studio.transition_ai_proposal_generation_reservation(
  text, text, text, text, text, text
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.persist_ai_provider_run_and_proposal_atomic(
  text, text, text, text, text, text, text, text, text, jsonb
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.read_faculty_drafting_context()
OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.read_actor_safe_ai_proposal(text, text, text, text)
OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.attach_ai_proposal_decision_if_undecided_atomic(
  text, text, text, text, text, text, text, text, text, text, text, jsonb
) OWNER TO lor_studio_command_owner;

GRANT EXECUTE ON FUNCTION lor_studio.transition_ai_proposal_generation_reservation(
  text, text, text, text, text, text
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.persist_ai_provider_run_and_proposal_atomic(
  text, text, text, text, text, text, text, text, text, jsonb
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.read_faculty_drafting_context()
TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.read_actor_safe_ai_proposal(
  text, text, text, text
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.attach_ai_proposal_decision_if_undecided_atomic(
  text, text, text, text, text, text, text, text, text, text, text, jsonb
) TO lor_studio_app;

DO $catalog_postflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  public_execute_count bigint;
  ai_policy_count bigint;
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
  SELECT pg_catalog.count(*) INTO ai_policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND policy.polname = ANY (ARRAY[
      'recommendation_cases_ai_command_service_select',
      'ai_generation_runs_ai_command_service_select',
      'ai_generation_runs_ai_command_service_insert',
      'ai_letter_proposals_ai_command_service_insert',
      'ai_proposal_command_receipts_faculty_select',
      'ai_proposal_command_receipts_faculty_insert',
      'ai_proposal_generation_reservations_faculty_select',
      'ai_proposal_generation_reservations_faculty_insert'
    ]::text[]);
  IF relation_count IS DISTINCT FROM 32
    OR forced_rls_count IS DISTINCT FROM 32
    OR definer_count IS DISTINCT FROM 26
    OR public_execute_count <> 0
    OR ai_policy_count IS DISTINCT FROM 8
    OR pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.ai_generation_runs', 'SELECT,INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.ai_letter_proposals', 'SELECT,INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.ai_proposal_decisions', 'SELECT'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_app',
      'lor_studio.ai_proposal_generation_reservation_receipts',
      'SELECT,INSERT,UPDATE,DELETE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.transition_ai_proposal_generation_reservation(text,text,text,text,text,text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.persist_ai_provider_run_and_proposal_atomic(text,text,text,text,text,text,text,text,text,jsonb)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.read_faculty_drafting_context()',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.read_actor_safe_ai_proposal(text,text,text,text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.attach_ai_proposal_decision_if_undecided_atomic(text,text,text,text,text,text,text,text,text,text,text,jsonb)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'DR-133 AI proposal command migration postflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_postflight$;

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
    observed_sentinel || '|aiProposalCommands=20260826010900'
  );
END
$advance_sentinel$;

COMMIT;
