-- Migration: 20260820180700_f2_lor_1012_schema_foundation.sql
-- Authority: F2-LOR-1012 / DR-120
-- Date: 2026-08-20
-- Depends on: none
-- Description: Create the private LOR Studio role, schema, normalized relations, constraints, indexes, and append-only guards.
-- Idempotent: NO

BEGIN;

DO $$
DECLARE
  database_name text := pg_catalog.current_database();
  administrator_name text := CURRENT_USER;
  harness_suffix text;
  data_directory_value text := pg_catalog.current_setting('data_directory');
  socket_directory_value text := pg_catalog.current_setting('unix_socket_directories');
  harness_root text;
  database_owner name;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(database.datdba)
  INTO database_owner
  FROM pg_catalog.pg_database AS database
  WHERE database.datname = database_name;

  IF pg_catalog.current_setting('server_version_num')::integer / 10000
     NOT IN (16, 18) THEN
    RAISE EXCEPTION 'foundation migration supports only disposable PostgreSQL 16 or 18'
      USING ERRCODE = '0A000';
  END IF;

  IF database_name !~ '^lorh_db_[a-f0-9]{20}$' THEN
    RAISE EXCEPTION 'foundation migration is restricted to the disposable lorh_db harness'
      USING ERRCODE = '42501';
  END IF;

  harness_suffix := pg_catalog.substring(database_name, '^lorh_db_([a-f0-9]{20})$');
  IF administrator_name IS DISTINCT FROM 'lorh_admin_' || harness_suffix
    OR session_user IS DISTINCT FROM current_user
    OR database_owner IS DISTINCT FROM current_user
    OR pg_catalog.inet_server_addr() IS NOT NULL
  THEN
    RAISE EXCEPTION 'foundation migration requires the matching disposable lorh_admin principal'
      USING ERRCODE = '42501';
  END IF;

  IF data_directory_value !~ '^/.+/f2lorpg-[A-Za-z0-9_-]{6,}/d$' THEN
    RAISE EXCEPTION 'foundation migration requires the disposable harness data directory'
      USING ERRCODE = '42501';
  END IF;
  harness_root := pg_catalog.left(data_directory_value, -2);

  IF harness_root = data_directory_value
     OR socket_directory_value IS DISTINCT FROM harness_root || '/s'
     OR socket_directory_value LIKE '%,%'
     OR pg_catalog.current_setting('listen_addresses') IS DISTINCT FROM '' THEN
    RAISE EXCEPTION 'foundation migration requires the socket-only disposable harness'
      USING ERRCODE = '42501';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'lor_studio_app'
  ) THEN
    RAISE EXCEPTION 'LOR roles already exist; disposable foundation requires fresh role ownership'
      USING ERRCODE = '42710';
  END IF;

  CREATE ROLE lor_studio_app
    NOLOGIN
    NOINHERIT
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    NOBYPASSRLS;
END
$$;

ALTER ROLE lor_studio_app SET search_path = pg_catalog;

CREATE SCHEMA lor_studio;
REVOKE ALL ON SCHEMA lor_studio FROM PUBLIC;

DO $$
DECLARE
  data_directory_value text := pg_catalog.current_setting('data_directory');
  harness_root text := pg_catalog.left(data_directory_value, -2);
  sentinel text;
BEGIN
  sentinel := 'missionmed.lor.disposable-postgres-harness.v1'
    || '|database=' || pg_catalog.current_database()
    || '|admin=' || CURRENT_USER
    || '|root=' || harness_root
    || '|foundation=20260820180700';
  EXECUTE pg_catalog.format('COMMENT ON SCHEMA lor_studio IS %L', sentinel);
END
$$;

ALTER DEFAULT PRIVILEGES IN SCHEMA lor_studio REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA lor_studio REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA lor_studio REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION lor_studio.canonical_jsonb_text(payload jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  payload_type text := pg_catalog.jsonb_typeof(payload);
  canonical_text text;
BEGIN
  IF payload_type IN ('null', 'boolean', 'number', 'string') THEN
    RETURN payload::text;
  END IF;

  IF payload_type = 'array' THEN
    SELECT '[' || COALESCE(
      pg_catalog.string_agg(
        lor_studio.canonical_jsonb_text(array_values.value),
        ',' ORDER BY array_values.ordinal_position
      ),
      ''
    ) || ']'
      INTO canonical_text
    FROM pg_catalog.jsonb_array_elements(payload)
      WITH ORDINALITY AS array_values(value, ordinal_position);
    RETURN canonical_text;
  END IF;

  IF payload_type = 'object' THEN
    SELECT '{' || COALESCE(
      pg_catalog.string_agg(
        pg_catalog.to_jsonb(object_values.key_name)::text || ':'
          || lor_studio.canonical_jsonb_text(object_values.value),
        ',' ORDER BY object_values.key_name COLLATE "C"
      ),
      ''
    ) || '}'
      INTO canonical_text
    FROM pg_catalog.jsonb_each(payload) AS object_values(key_name, value);
    RETURN canonical_text;
  END IF;

  RAISE EXCEPTION 'unsupported JSON value in canonical serializer'
    USING ERRCODE = '22023';
END;
$$;

CREATE FUNCTION lor_studio.canonical_jsonb_sha256(payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(lor_studio.canonical_jsonb_text(payload), 'UTF8')
    ),
    'hex'
  );
$$;

CREATE FUNCTION lor_studio.release_document_hash(
  document_content_hash text,
  document_id text,
  document_mime_type text,
  document_text text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
    'contentHash', document_content_hash,
    'id', document_id,
    'mimeType', document_mime_type,
    'text', document_text
  ));
$$;

CREATE FUNCTION lor_studio.protected_state_chain_hash(
  resource_case_id text,
  resource_student_subject text,
  resource_revision bigint,
  resource_previous_hash text,
  resource_event_hash text,
  resource_protected_state jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.protected-state-chain.v1',
    'caseId', resource_case_id,
    'studentAuthSubject', resource_student_subject,
    'revision', resource_revision,
    'previousHash', resource_previous_hash,
    'eventHash', resource_event_hash,
    'protectedState', resource_protected_state
  ));
$$;

CREATE FUNCTION lor_studio.student_record_is_safe(payload jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH RECURSIVE json_nodes(value, depth) AS (
    SELECT payload, 0
    UNION ALL
    SELECT descendants.value, node.depth + 1
    FROM json_nodes AS node
    CROSS JOIN LATERAL (
      SELECT object_values.value
      FROM pg_catalog.jsonb_each(
        CASE WHEN pg_catalog.jsonb_typeof(node.value) = 'object' THEN node.value ELSE '{}'::jsonb END
      ) AS object_values(key, value)
      UNION ALL
      SELECT array_values.value
      FROM pg_catalog.jsonb_array_elements(
        CASE WHEN pg_catalog.jsonb_typeof(node.value) = 'array' THEN node.value ELSE '[]'::jsonb END
      ) AS array_values(value)
    ) AS descendants
    WHERE node.depth <= 20
  )
  SELECT COALESCE(
    pg_catalog.jsonb_typeof(payload) = 'object'
    AND pg_catalog.octet_length(payload::text) <= 2097152
    AND payload ?& ARRAY[
      'builder', 'studentEvidence', 'applicantOptions', 'delivery'
    ]::text[]
    AND pg_catalog.jsonb_typeof(payload -> 'builder') = 'object'
    AND (payload -> 'builder') ?& ARRAY[
      'sessionId', 'totalSteps', 'completedStepIds', 'currentStepId',
      'stepData', 'autosavedAt'
    ]::text[]
    AND (
      SELECT pg_catalog.count(*) = 6
      FROM pg_catalog.jsonb_object_keys(payload -> 'builder')
    )
    AND pg_catalog.jsonb_typeof(payload -> 'builder' -> 'sessionId') = 'string'
    AND pg_catalog.length(payload -> 'builder' ->> 'sessionId') BETWEEN 1 AND 200
    AND (payload -> 'builder' ->> 'sessionId') ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND pg_catalog.jsonb_typeof(payload -> 'builder' -> 'totalSteps') = 'number'
    AND payload -> 'builder' ->> 'totalSteps' = '8'
    AND pg_catalog.jsonb_typeof(payload -> 'builder' -> 'completedStepIds') = 'array'
    AND pg_catalog.jsonb_array_length(payload -> 'builder' -> 'completedStepIds') BETWEEN 0 AND 8
    AND payload -> 'builder' -> 'completedStepIds' = CASE
      WHEN pg_catalog.jsonb_array_length(payload -> 'builder' -> 'completedStepIds') = 0
        THEN '[]'::jsonb
      ELSE pg_catalog.to_jsonb(
        (ARRAY[
          'case_basics', 'writer_relationship', 'evidence_selection',
          'timeline_highlights', 'writer_preferences', 'consent_and_waiver',
          'review', 'faculty_handoff'
        ]::text[])[1:pg_catalog.jsonb_array_length(payload -> 'builder' -> 'completedStepIds')]
      )
    END
    AND payload -> 'builder' -> 'currentStepId' = CASE
      pg_catalog.jsonb_array_length(payload -> 'builder' -> 'completedStepIds')
      WHEN 0 THEN '"case_basics"'::jsonb
      WHEN 1 THEN '"writer_relationship"'::jsonb
      WHEN 2 THEN '"evidence_selection"'::jsonb
      WHEN 3 THEN '"timeline_highlights"'::jsonb
      WHEN 4 THEN '"writer_preferences"'::jsonb
      WHEN 5 THEN '"consent_and_waiver"'::jsonb
      WHEN 6 THEN '"review"'::jsonb
      WHEN 7 THEN '"faculty_handoff"'::jsonb
      WHEN 8 THEN 'null'::jsonb
    END
    AND pg_catalog.jsonb_typeof(payload -> 'builder' -> 'stepData') = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(payload -> 'builder' -> 'stepData') AS step_keys(key_name)
      WHERE step_keys.key_name <> ALL (ARRAY[
        'case_basics', 'writer_relationship', 'evidence_selection',
        'timeline_highlights', 'writer_preferences', 'consent_and_waiver',
        'review', 'faculty_handoff'
      ]::text[])
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements_text(
        payload -> 'builder' -> 'completedStepIds'
      ) AS completed_steps(step_id)
      WHERE NOT ((payload -> 'builder' -> 'stepData') ? completed_steps.step_id)
    )
    AND (
      pg_catalog.jsonb_typeof(payload -> 'builder' -> 'autosavedAt') = 'null'
      OR (
        pg_catalog.jsonb_typeof(payload -> 'builder' -> 'autosavedAt') = 'string'
        AND (payload -> 'builder' ->> 'autosavedAt') ~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      )
    )
    AND pg_catalog.jsonb_typeof(payload -> 'studentEvidence') = 'array'
    AND pg_catalog.jsonb_array_length(payload -> 'studentEvidence') <= 500
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(payload -> 'studentEvidence') AS evidence_items(value)
      WHERE pg_catalog.jsonb_typeof(evidence_items.value) <> 'object'
    )
    AND pg_catalog.jsonb_typeof(payload -> 'applicantOptions') = 'array'
    AND pg_catalog.jsonb_array_length(payload -> 'applicantOptions') <= 500
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(payload -> 'applicantOptions') AS option_items(value)
      WHERE pg_catalog.jsonb_typeof(option_items.value) <> 'object'
    )
    AND pg_catalog.jsonb_typeof(payload -> 'delivery') = 'object'
    AND (payload -> 'delivery') ?& ARRAY['status', 'destinationClass', 'deliveredAt']::text[]
    AND pg_catalog.jsonb_typeof(payload -> 'delivery' -> 'status') = 'string'
    AND pg_catalog.length(payload -> 'delivery' ->> 'status') BETWEEN 1 AND 100
    AND (
      pg_catalog.jsonb_typeof(payload -> 'delivery' -> 'destinationClass') = 'null'
      OR (
        pg_catalog.jsonb_typeof(payload -> 'delivery' -> 'destinationClass') = 'string'
        AND pg_catalog.length(payload -> 'delivery' ->> 'destinationClass') BETWEEN 1 AND 200
      )
    )
    AND (
      pg_catalog.jsonb_typeof(payload -> 'delivery' -> 'deliveredAt') = 'null'
      OR (
        pg_catalog.jsonb_typeof(payload -> 'delivery' -> 'deliveredAt') = 'string'
        AND (payload -> 'delivery' ->> 'deliveredAt') ~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(payload) AS top_level_keys(key_name)
      WHERE top_level_keys.key_name <> ALL (ARRAY[
        'builder', 'studentEvidence', 'applicantOptions', 'delivery'
      ]::text[])
    )
    AND (SELECT pg_catalog.count(*) <= 10000 FROM json_nodes)
    AND NOT EXISTS (SELECT 1 FROM json_nodes WHERE depth > 20)
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(payload -> 'delivery') AS delivery_keys(key_name)
      WHERE delivery_keys.key_name <> ALL (
        ARRAY['status', 'destinationClass', 'deliveredAt']::text[]
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM json_nodes AS node
      CROSS JOIN LATERAL pg_catalog.jsonb_object_keys(
        CASE WHEN pg_catalog.jsonb_typeof(node.value) = 'object' THEN node.value ELSE '{}'::jsonb END
      ) AS keys(key_name)
      WHERE keys.key_name = ANY (ARRAY[
        'facultyPrivate', 'finalDocumentState', 'privateArtifacts',
        'rawInvitation', 'administrativeGrants', 'facultyAnswers',
        'facultyNotes', 'answers', 'notes', 'draftText', 'finalDocument',
        'finalDocumentText', 'approvalSignature', 'invitationId',
        'recipientEmailHash', 'facultyId', 'actorId', 'mentorIds',
        'faculty', 'strategyMetadata', 'versionHistory'
      ]::text[])
    ),
    false
  );
$$;

CREATE FUNCTION lor_studio.private_record_is_complete(payload jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.jsonb_typeof(payload) = 'object'
    AND pg_catalog.octet_length(payload::text) <= 2097152
    AND payload ?& ARRAY['facultyPrivate', 'finalDocumentState']::text[]
    AND (
      SELECT pg_catalog.count(*) = 2
      FROM pg_catalog.jsonb_object_keys(
        CASE WHEN pg_catalog.jsonb_typeof(payload) = 'object' THEN payload ELSE '{}'::jsonb END
      )
    )
    AND pg_catalog.jsonb_typeof(payload -> 'facultyPrivate') = 'object'
    AND (payload -> 'facultyPrivate') ?& ARRAY[
      'answers', 'notes', 'draftText', 'finalDocument'
    ]::text[]
    AND (
      SELECT pg_catalog.count(*) = 4
      FROM pg_catalog.jsonb_object_keys(
        CASE
          WHEN pg_catalog.jsonb_typeof(payload -> 'facultyPrivate') = 'object'
            THEN payload -> 'facultyPrivate'
          ELSE '{}'::jsonb
        END
      )
    )
    AND pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'answers') = 'array'
    AND pg_catalog.jsonb_array_length(payload -> 'facultyPrivate' -> 'answers') <= 500
    AND pg_catalog.octet_length((payload -> 'facultyPrivate' -> 'answers')::text) <= 1048576
    AND pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'notes') = 'array'
    AND pg_catalog.jsonb_array_length(payload -> 'facultyPrivate' -> 'notes') <= 500
    AND pg_catalog.octet_length((payload -> 'facultyPrivate' -> 'notes')::text) <= 1048576
    AND (
      pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'draftText') = 'null'
      OR (
        pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'draftText') = 'string'
        AND pg_catalog.octet_length(payload -> 'facultyPrivate' ->> 'draftText') <= 256000
      )
    )
    AND (
      pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'finalDocument') = 'null'
      OR (
        pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'finalDocument') = 'object'
        AND (payload -> 'facultyPrivate' -> 'finalDocument') ?& ARRAY[
          'id', 'text', 'contentHash', 'mimeType', 'releasedToStudentAt'
        ]::text[]
        AND (
          SELECT pg_catalog.count(*) = 5
          FROM pg_catalog.jsonb_object_keys(
            CASE
              WHEN pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'finalDocument') = 'object'
                THEN payload -> 'facultyPrivate' -> 'finalDocument'
              ELSE '{}'::jsonb
            END
          )
        )
        AND (
          pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'finalDocument' -> 'id') = 'null'
          OR (
            pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'finalDocument' -> 'id') = 'string'
            AND pg_catalog.length(payload -> 'facultyPrivate' -> 'finalDocument' ->> 'id') BETWEEN 1 AND 200
          )
        )
        AND (
          pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'finalDocument' -> 'text') = 'null'
          OR (
            pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'finalDocument' -> 'text') = 'string'
            AND pg_catalog.octet_length(payload -> 'facultyPrivate' -> 'finalDocument' ->> 'text') <= 256000
          )
        )
        AND pg_catalog.jsonb_typeof(
          payload -> 'facultyPrivate' -> 'finalDocument' -> 'contentHash'
        ) IN ('null', 'string')
        AND pg_catalog.jsonb_typeof(
          payload -> 'facultyPrivate' -> 'finalDocument' -> 'mimeType'
        ) IN ('null', 'string')
        AND (
          pg_catalog.jsonb_typeof(
            payload -> 'facultyPrivate' -> 'finalDocument' -> 'releasedToStudentAt'
          ) = 'null'
          OR (
            pg_catalog.jsonb_typeof(
              payload -> 'facultyPrivate' -> 'finalDocument' -> 'releasedToStudentAt'
            ) = 'string'
            AND (payload -> 'facultyPrivate' -> 'finalDocument' ->> 'releasedToStudentAt') ~
              '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
          )
        )
      )
    )
    AND pg_catalog.jsonb_typeof(payload -> 'finalDocumentState') = 'object'
    AND (payload -> 'finalDocumentState') ?& ARRAY[
      'documentState', 'facultyApproval', 'release'
    ]::text[]
    AND (
      SELECT pg_catalog.count(*) = 3
      FROM pg_catalog.jsonb_object_keys(
        CASE
          WHEN pg_catalog.jsonb_typeof(payload -> 'finalDocumentState') = 'object'
            THEN payload -> 'finalDocumentState'
          ELSE '{}'::jsonb
        END
      )
    )
    AND (
      pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'documentState') = 'null'
      OR (
        pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'documentState') = 'string'
        AND payload -> 'finalDocumentState' ->> 'documentState' IN ('ai_proposal', 'faculty_final')
      )
    )
    AND (
      pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'facultyApproval') = 'null'
      OR (
        pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'facultyApproval') = 'object'
        AND (payload -> 'finalDocumentState' -> 'facultyApproval') ?& ARRAY[
          'approved', 'approvedAt', 'facultyId', 'signatureAttested'
        ]::text[]
        AND (
          SELECT pg_catalog.count(*) = 4
          FROM pg_catalog.jsonb_object_keys(
            CASE
              WHEN pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'facultyApproval') = 'object'
                THEN payload -> 'finalDocumentState' -> 'facultyApproval'
              ELSE '{}'::jsonb
            END
          )
        )
        AND pg_catalog.jsonb_typeof(
          payload -> 'finalDocumentState' -> 'facultyApproval' -> 'approved'
        ) = 'boolean'
        AND pg_catalog.jsonb_typeof(
          payload -> 'finalDocumentState' -> 'facultyApproval' -> 'signatureAttested'
        ) = 'boolean'
        AND pg_catalog.jsonb_typeof(
          payload -> 'finalDocumentState' -> 'facultyApproval' -> 'approvedAt'
        ) = 'string'
        AND (payload -> 'finalDocumentState' -> 'facultyApproval' ->> 'approvedAt') ~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
        AND pg_catalog.jsonb_typeof(
          payload -> 'finalDocumentState' -> 'facultyApproval' -> 'facultyId'
        ) = 'string'
        AND pg_catalog.length(
          payload -> 'finalDocumentState' -> 'facultyApproval' ->> 'facultyId'
        ) BETWEEN 1 AND 200
      )
    )
    AND (
      pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'release') = 'null'
      OR (
        pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'release') = 'object'
        AND (payload -> 'finalDocumentState' -> 'release') ?& ARRAY[
          'documentHash', 'documentId', 'releasedAt', 'releasedAtRevision', 'waiverReceiptId'
        ]::text[]
        AND (
          SELECT pg_catalog.count(*) = 5
          FROM pg_catalog.jsonb_object_keys(
            CASE
              WHEN pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'release') = 'object'
                THEN payload -> 'finalDocumentState' -> 'release'
              ELSE '{}'::jsonb
            END
          )
        )
        AND pg_catalog.jsonb_typeof(
          payload -> 'finalDocumentState' -> 'release' -> 'documentHash'
        ) = 'string'
        AND (payload -> 'finalDocumentState' -> 'release' ->> 'documentHash') ~ '^[a-f0-9]{64}$'
        AND pg_catalog.jsonb_typeof(
          payload -> 'finalDocumentState' -> 'release' -> 'documentId'
        ) = 'string'
        AND pg_catalog.length(
          payload -> 'finalDocumentState' -> 'release' ->> 'documentId'
        ) BETWEEN 1 AND 200
        AND pg_catalog.jsonb_typeof(
          payload -> 'finalDocumentState' -> 'release' -> 'releasedAt'
        ) = 'string'
        AND (payload -> 'finalDocumentState' -> 'release' ->> 'releasedAt') ~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
        AND pg_catalog.jsonb_typeof(
          payload -> 'finalDocumentState' -> 'release' -> 'releasedAtRevision'
        ) = 'number'
        AND (payload -> 'finalDocumentState' -> 'release' ->> 'releasedAtRevision') ~
          '^(0|[1-9][0-9]*)$'
        AND pg_catalog.jsonb_typeof(
          payload -> 'finalDocumentState' -> 'release' -> 'waiverReceiptId'
        ) = 'string'
        AND pg_catalog.length(
          payload -> 'finalDocumentState' -> 'release' ->> 'waiverReceiptId'
        ) BETWEEN 1 AND 200
      )
    )
    AND (
      pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'finalDocument') <> 'null'
      OR (
        pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'documentState') = 'null'
        AND pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'facultyApproval') = 'null'
        AND pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'release') = 'null'
      )
    )
    AND (
      (
        pg_catalog.jsonb_typeof(payload -> 'finalDocumentState' -> 'release') = 'null'
        AND (
          pg_catalog.jsonb_typeof(payload -> 'facultyPrivate' -> 'finalDocument') = 'null'
          OR pg_catalog.jsonb_typeof(
            payload -> 'facultyPrivate' -> 'finalDocument' -> 'releasedToStudentAt'
          ) = 'null'
        )
      )
      OR (
        payload -> 'finalDocumentState' ->> 'documentState' = 'faculty_final'
        AND payload -> 'finalDocumentState' -> 'facultyApproval' ->> 'approved' = 'true'
        AND payload -> 'finalDocumentState' -> 'facultyApproval' ->> 'signatureAttested' = 'true'
        AND payload -> 'finalDocumentState' -> 'release' ->> 'documentId' =
          payload -> 'facultyPrivate' -> 'finalDocument' ->> 'id'
        AND payload -> 'finalDocumentState' -> 'release' ->> 'documentHash' =
          lor_studio.release_document_hash(
            payload -> 'facultyPrivate' -> 'finalDocument' ->> 'contentHash',
            payload -> 'facultyPrivate' -> 'finalDocument' ->> 'id',
            payload -> 'facultyPrivate' -> 'finalDocument' ->> 'mimeType',
            payload -> 'facultyPrivate' -> 'finalDocument' ->> 'text'
          )
        AND payload -> 'finalDocumentState' -> 'release' ->> 'releasedAt' =
          payload -> 'facultyPrivate' -> 'finalDocument' ->> 'releasedToStudentAt'
      )
    ),
    false
  );
$$;

CREATE FUNCTION lor_studio.protected_case_state_is_complete(
  payload jsonb,
  expected_revision bigint
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    expected_revision >= 0
    AND pg_catalog.jsonb_typeof(payload) = 'object'
    AND pg_catalog.octet_length(payload::text) <= 2097152
    AND payload ?& ARRAY['faculty', 'strategyMetadata', 'versionHistory']::text[]
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(payload) AS protected_keys(key_name)
      WHERE protected_keys.key_name <> ALL (
        ARRAY['faculty', 'strategyMetadata', 'versionHistory']::text[]
      )
    )
    AND pg_catalog.jsonb_typeof(payload -> 'faculty') = 'object'
    AND (payload -> 'faculty') ?& ARRAY[
      'invitationId', 'facultyId', 'recipientEmailHash', 'verifiedAt'
    ]::text[]
    AND (
      SELECT pg_catalog.count(*) = 4
      FROM pg_catalog.jsonb_object_keys(payload -> 'faculty')
    )
    AND (
      (
        pg_catalog.jsonb_typeof(payload -> 'faculty' -> 'invitationId') = 'null'
        AND pg_catalog.jsonb_typeof(payload -> 'faculty' -> 'recipientEmailHash') = 'null'
      )
      OR (
        pg_catalog.jsonb_typeof(payload -> 'faculty' -> 'invitationId') = 'string'
        AND pg_catalog.length(payload -> 'faculty' ->> 'invitationId') BETWEEN 1 AND 200
        AND (payload -> 'faculty' ->> 'invitationId') ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
        AND pg_catalog.jsonb_typeof(payload -> 'faculty' -> 'recipientEmailHash') = 'string'
        AND (payload -> 'faculty' ->> 'recipientEmailHash') ~ '^[a-f0-9]{64}$'
      )
    )
    AND (
      (
        pg_catalog.jsonb_typeof(payload -> 'faculty' -> 'facultyId') = 'null'
        AND pg_catalog.jsonb_typeof(payload -> 'faculty' -> 'verifiedAt') = 'null'
      )
      OR (
        pg_catalog.jsonb_typeof(payload -> 'faculty' -> 'facultyId') = 'string'
        AND (payload -> 'faculty' ->> 'facultyId') ~ '^wp:[1-9][0-9]*$'
        AND pg_catalog.jsonb_typeof(payload -> 'faculty' -> 'verifiedAt') = 'string'
        AND (payload -> 'faculty' ->> 'verifiedAt') ~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
        AND pg_catalog.jsonb_typeof(payload -> 'faculty' -> 'invitationId') = 'string'
      )
    )
    AND pg_catalog.jsonb_typeof(payload -> 'strategyMetadata') = 'object'
    AND (
      (
        SELECT pg_catalog.count(*) = 0
        FROM pg_catalog.jsonb_object_keys(payload -> 'strategyMetadata')
      )
      OR (
        (payload -> 'strategyMetadata') ?& ARRAY[
          'mentorIds', 'strategyStatus', 'nextMilestone'
        ]::text[]
        AND (
          SELECT pg_catalog.count(*) = 3
          FROM pg_catalog.jsonb_object_keys(payload -> 'strategyMetadata')
        )
        AND pg_catalog.jsonb_typeof(payload -> 'strategyMetadata' -> 'mentorIds') = 'array'
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(
            payload -> 'strategyMetadata' -> 'mentorIds'
          ) AS mentor_values(value)
          WHERE pg_catalog.jsonb_typeof(mentor_values.value) <> 'string'
            OR pg_catalog.length(mentor_values.value #>> '{}') NOT BETWEEN 1 AND 200
        )
        AND (
          SELECT pg_catalog.count(*) = pg_catalog.count(DISTINCT mentor_values.value #>> '{}')
          FROM pg_catalog.jsonb_array_elements(
            payload -> 'strategyMetadata' -> 'mentorIds'
          ) AS mentor_values(value)
        )
        AND (
          pg_catalog.jsonb_typeof(payload -> 'strategyMetadata' -> 'strategyStatus') = 'null'
          OR (
            pg_catalog.jsonb_typeof(payload -> 'strategyMetadata' -> 'strategyStatus') = 'string'
            AND payload -> 'strategyMetadata' ->> 'strategyStatus' IN (
              'not_started', 'writer_selected', 'writer_invited', 'faculty_review',
              'approved', 'delivered', 'closed', 'blocked'
            )
          )
        )
        AND (
          pg_catalog.jsonb_typeof(payload -> 'strategyMetadata' -> 'nextMilestone') = 'null'
          OR (
            pg_catalog.jsonb_typeof(payload -> 'strategyMetadata' -> 'nextMilestone') = 'string'
            AND payload -> 'strategyMetadata' ->> 'nextMilestone' IN (
              'complete_builder', 'invite_faculty', 'faculty_verification',
              'faculty_review', 'faculty_approval', 'delivery', 'closure'
            )
          )
        )
      )
    )
    AND pg_catalog.jsonb_typeof(payload -> 'versionHistory') = 'array'
    AND pg_catalog.jsonb_array_length(payload -> 'versionHistory') = expected_revision + 1
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(payload -> 'versionHistory')
        WITH ORDINALITY AS version_entries(entry, ordinal_position)
      WHERE pg_catalog.jsonb_typeof(version_entries.entry) <> 'object'
        OR NOT version_entries.entry ?& ARRAY[
          'revision', 'eventType', 'actorId', 'occurredAt', 'changedFields', 'changeHash'
        ]::text[]
        OR (
          SELECT pg_catalog.count(*) <> 6
          FROM pg_catalog.jsonb_object_keys(version_entries.entry)
        )
        OR pg_catalog.jsonb_typeof(version_entries.entry -> 'revision') <> 'number'
        OR (version_entries.entry ->> 'revision') !~ '^(0|[1-9][0-9]*)$'
        OR (version_entries.entry ->> 'revision')::bigint <> version_entries.ordinal_position - 1
        OR pg_catalog.jsonb_typeof(version_entries.entry -> 'eventType') <> 'string'
        OR version_entries.entry ->> 'eventType' NOT IN (
          'ai.proposal_decision_recorded', 'ai.proposal_generated', 'case.created',
          'builder.autosaved', 'builder.step_completed', 'consent.recorded',
          'faculty.final_document_released', 'faculty.invited',
          'faculty.private_content_updated', 'faculty.verification_denied',
          'faculty.verified', 'strategy.metadata_updated', 'student.material_updated',
          'waiver.recorded', 'case.draft', 'case.faculty_invited',
          'case.faculty_verified', 'case.faculty_review', 'case.faculty_approved',
          'case.delivered', 'case.closed', 'case.cancelled'
        )
        OR pg_catalog.jsonb_typeof(version_entries.entry -> 'actorId') <> 'string'
        OR pg_catalog.length(version_entries.entry ->> 'actorId') NOT BETWEEN 1 AND 200
        OR pg_catalog.jsonb_typeof(version_entries.entry -> 'occurredAt') <> 'string'
        OR (version_entries.entry ->> 'occurredAt') !~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
        OR pg_catalog.jsonb_typeof(version_entries.entry -> 'changedFields') <> 'array'
        OR pg_catalog.jsonb_array_length(version_entries.entry -> 'changedFields') = 0
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(
            version_entries.entry -> 'changedFields'
          ) AS changed_field_values(value)
          WHERE pg_catalog.jsonb_typeof(changed_field_values.value) <> 'string'
            OR pg_catalog.length(changed_field_values.value #>> '{}') NOT BETWEEN 1 AND 160
        )
        OR pg_catalog.jsonb_typeof(version_entries.entry -> 'changeHash') <> 'string'
        OR (version_entries.entry ->> 'changeHash') !~ '^[a-f0-9]{64}$'
    ),
    false
  );
$$;

CREATE FUNCTION lor_studio.audit_event_is_metadata(payload jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.jsonb_typeof(payload) = 'object'
    AND pg_catalog.octet_length(payload::text) <= 2048
    AND payload ?& ARRAY[
      'schemaVersion', 'eventRef', 'eventType', 'caseRef', 'actorRef',
      'actorRole', 'correlationRef', 'outcome', 'revision', 'occurredAt'
    ]::text[]
    AND pg_catalog.jsonb_typeof(payload -> 'schemaVersion') = 'string'
    AND pg_catalog.jsonb_typeof(payload -> 'eventRef') = 'string'
    AND pg_catalog.jsonb_typeof(payload -> 'eventType') = 'string'
    AND pg_catalog.jsonb_typeof(payload -> 'caseRef') = 'string'
    AND pg_catalog.jsonb_typeof(payload -> 'actorRef') = 'string'
    AND pg_catalog.jsonb_typeof(payload -> 'actorRole') = 'string'
    AND pg_catalog.jsonb_typeof(payload -> 'correlationRef') = 'string'
    AND pg_catalog.jsonb_typeof(payload -> 'outcome') = 'string'
    AND pg_catalog.jsonb_typeof(payload -> 'revision') = 'number'
    AND pg_catalog.jsonb_typeof(payload -> 'occurredAt') = 'string'
    AND payload ->> 'schemaVersion' = 'missionmed.lor.service-event.v1'
    AND (payload ->> 'eventRef') ~ '^event_[a-f0-9]{64}$'
    AND (payload ->> 'caseRef') ~ '^case_[a-f0-9]{64}$'
    AND (payload ->> 'actorRef') ~ '^actor_[a-f0-9]{64}$'
    AND (payload ->> 'correlationRef') ~ '^correlation_[a-f0-9]{64}$'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(payload) AS keys(key_name)
      WHERE key_name <> ALL (ARRAY[
        'schemaVersion', 'eventRef', 'eventType', 'caseRef', 'actorRef',
        'actorRole', 'correlationRef', 'outcome', 'revision', 'occurredAt'
      ]::text[])
    ),
    false
  );
$$;

CREATE FUNCTION lor_studio.ai_grounding_manifest_is_complete(payload jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.jsonb_typeof(payload) = 'object'
    AND pg_catalog.octet_length(payload::text) <= 1048576
    AND payload ?& ARRAY[
      'schemaVersion', 'attestationHash', 'factualSegmentCount',
      'connectiveSegmentCount', 'supportIds', 'attestations'
    ]::text[]
    AND (
      SELECT pg_catalog.count(*) = 6
      FROM pg_catalog.jsonb_object_keys(
        CASE WHEN pg_catalog.jsonb_typeof(payload) = 'object' THEN payload ELSE '{}'::jsonb END
      )
    )
    AND payload ->> 'schemaVersion' = 'missionmed.lor.grounding-model.v1'
    AND pg_catalog.jsonb_typeof(payload -> 'attestationHash') = 'string'
    AND (payload ->> 'attestationHash') ~ '^[a-f0-9]{64}$'
    AND pg_catalog.jsonb_typeof(payload -> 'factualSegmentCount') = 'number'
    AND (payload ->> 'factualSegmentCount') ~ '^[1-9][0-9]{0,2}$'
    AND (payload ->> 'factualSegmentCount')::integer BETWEEN 1 AND 400
    AND pg_catalog.jsonb_typeof(payload -> 'connectiveSegmentCount') = 'number'
    AND (payload ->> 'connectiveSegmentCount') ~ '^(0|[1-9][0-9]{0,2})$'
    AND (payload ->> 'connectiveSegmentCount')::integer BETWEEN 0 AND 400
    AND pg_catalog.jsonb_typeof(payload -> 'supportIds') = 'array'
    AND pg_catalog.jsonb_array_length(payload -> 'supportIds') BETWEEN 1 AND 500
    AND payload -> 'supportIds' = pg_catalog.to_jsonb(ARRAY(
      SELECT DISTINCT support_values.value
      FROM pg_catalog.jsonb_array_elements_text(
        CASE
          WHEN pg_catalog.jsonb_typeof(payload -> 'supportIds') = 'array'
            THEN payload -> 'supportIds'
          ELSE '[]'::jsonb
        END
      ) AS support_values(value)
      WHERE pg_catalog.length(support_values.value) BETWEEN 1 AND 200
      ORDER BY support_values.value
    ))
    AND pg_catalog.jsonb_typeof(payload -> 'attestations') = 'array'
    AND pg_catalog.jsonb_array_length(payload -> 'attestations') BETWEEN 1 AND 400
    AND pg_catalog.jsonb_array_length(payload -> 'attestations') =
      (payload ->> 'factualSegmentCount')::integer
      + (payload ->> 'connectiveSegmentCount')::integer
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(
        CASE
          WHEN pg_catalog.jsonb_typeof(payload -> 'attestations') = 'array'
            THEN payload -> 'attestations'
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS attestation_rows(attestation, ordinal_position)
      WHERE pg_catalog.jsonb_typeof(attestation_rows.attestation) <> 'object'
        OR NOT attestation_rows.attestation ?& ARRAY[
          'index', 'kind', 'supportIds', 'status', 'verifierId',
          'rationaleCode', 'sourceHashes'
        ]::text[]
        OR (
          SELECT pg_catalog.count(*) <> 7
          FROM pg_catalog.jsonb_object_keys(
            CASE
              WHEN pg_catalog.jsonb_typeof(attestation_rows.attestation) = 'object'
                THEN attestation_rows.attestation
              ELSE '{}'::jsonb
            END
          )
        )
        OR pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'index') <> 'number'
        OR (attestation_rows.attestation ->> 'index') !~ '^(0|[1-9][0-9]{0,2})$'
        OR (attestation_rows.attestation ->> 'index')::integer <>
          attestation_rows.ordinal_position - 1
        OR pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'kind') <> 'string'
        OR attestation_rows.attestation ->> 'kind' NOT IN ('factual', 'connective')
        OR pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'supportIds') <> 'array'
        OR pg_catalog.jsonb_array_length(attestation_rows.attestation -> 'supportIds') > 32
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(
            CASE
              WHEN pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'supportIds') = 'array'
                THEN attestation_rows.attestation -> 'supportIds'
              ELSE '[]'::jsonb
            END
          ) AS attestation_support_values(value)
          WHERE pg_catalog.jsonb_typeof(attestation_support_values.value) <> 'string'
            OR pg_catalog.length(attestation_support_values.value #>> '{}') NOT BETWEEN 1 AND 200
        )
        OR pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'status') <> 'string'
        OR pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'sourceHashes') <> 'array'
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(
            CASE
              WHEN pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'sourceHashes') = 'array'
                THEN attestation_rows.attestation -> 'sourceHashes'
              ELSE '[]'::jsonb
            END
          ) AS source_hash_values(value)
          WHERE pg_catalog.jsonb_typeof(source_hash_values.value) <> 'string'
            OR (source_hash_values.value #>> '{}') !~ '^[a-f0-9]{64}$'
        )
        OR (
          attestation_rows.attestation ->> 'kind' = 'connective'
          AND NOT (
            pg_catalog.jsonb_array_length(attestation_rows.attestation -> 'supportIds') = 0
            AND attestation_rows.attestation ->> 'status' = 'NO_MATERIAL_ASSERTION'
            AND pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'verifierId') = 'null'
            AND attestation_rows.attestation ->> 'rationaleCode' = 'CONNECTIVE_GUARD_CLEAR'
            AND pg_catalog.jsonb_array_length(attestation_rows.attestation -> 'sourceHashes') = 0
          )
        )
        OR (
          attestation_rows.attestation ->> 'kind' = 'factual'
          AND NOT (
            pg_catalog.jsonb_array_length(attestation_rows.attestation -> 'supportIds') BETWEEN 1 AND 32
            AND attestation_rows.attestation ->> 'status' = 'ENTAILED'
            AND pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'verifierId') = 'string'
            AND pg_catalog.length(attestation_rows.attestation ->> 'verifierId') BETWEEN 1 AND 200
            AND (
              pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'rationaleCode') = 'null'
              OR (
                pg_catalog.jsonb_typeof(attestation_rows.attestation -> 'rationaleCode') = 'string'
                AND pg_catalog.length(attestation_rows.attestation ->> 'rationaleCode') BETWEEN 1 AND 200
              )
            )
            AND pg_catalog.jsonb_array_length(attestation_rows.attestation -> 'sourceHashes') =
              pg_catalog.jsonb_array_length(attestation_rows.attestation -> 'supportIds')
          )
        )
    )
    AND payload -> 'supportIds' = pg_catalog.to_jsonb(ARRAY(
      SELECT DISTINCT attestation_support_values.value
      FROM pg_catalog.jsonb_array_elements(
        CASE
          WHEN pg_catalog.jsonb_typeof(payload -> 'attestations') = 'array'
            THEN payload -> 'attestations'
          ELSE '[]'::jsonb
        END
      ) AS manifest_attestations(attestation)
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(
        CASE
          WHEN pg_catalog.jsonb_typeof(manifest_attestations.attestation -> 'supportIds') = 'array'
            THEN manifest_attestations.attestation -> 'supportIds'
          ELSE '[]'::jsonb
        END
      ) AS attestation_support_values(value)
      ORDER BY attestation_support_values.value
    )),
    false
  );
$$;

CREATE FUNCTION lor_studio.text_array_is_sorted_unique(values_to_check text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.cardinality(values_to_check) > 0
    AND values_to_check = ARRAY(
      SELECT DISTINCT scope_value COLLATE "C"
      FROM pg_catalog.unnest(values_to_check) AS scopes(scope_value)
      WHERE scope_value IS NOT NULL
        AND pg_catalog.length(pg_catalog.btrim(scope_value)) > 0
      ORDER BY scope_value COLLATE "C"
    ),
    false
  );
$$;

CREATE FUNCTION lor_studio.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'append-only relation % rejects %', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;

CREATE FUNCTION lor_studio.enforce_recommendation_case_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  trusted_actor_role text := pg_catalog.current_setting('lor_studio.actor_role', true);
BEGIN
  IF OLD.status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'terminal recommendation case is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF ROW(NEW.case_id, NEW.student_auth_subject, NEW.student_auth_uid, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.case_id, OLD.student_auth_subject, OLD.student_auth_uid, OLD.created_at) THEN
    RAISE EXCEPTION 'recommendation case identity and creation time are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'recommendation case revision must advance by exactly one'
      USING ERRCODE = '40001';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'draft' AND NEW.status IN ('faculty_invited', 'cancelled'))
    OR (OLD.status = 'faculty_invited' AND NEW.status IN ('faculty_verified', 'cancelled'))
    OR (OLD.status = 'faculty_verified' AND NEW.status IN ('faculty_review', 'cancelled'))
    OR (OLD.status = 'faculty_review' AND NEW.status IN ('faculty_approved', 'cancelled'))
    OR (OLD.status = 'faculty_approved' AND NEW.status IN ('delivered', 'cancelled'))
    OR (OLD.status = 'delivered' AND NEW.status = 'closed')
  ) THEN
    RAISE EXCEPTION 'recommendation case lifecycle transition rejected'
      USING ERRCODE = '55000';
  END IF;

  IF trusted_actor_role = 'student' THEN
    IF OLD.status <> 'draft' OR NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'student case updates are limited to the active draft workspace'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.record -> 'delivery' IS DISTINCT FROM OLD.record -> 'delivery' THEN
      RAISE EXCEPTION 'student case updates cannot rewrite delivery state'
        USING ERRCODE = '42501';
    END IF;
    IF ROW(
        NEW.release_document_id,
        NEW.release_document_hash,
        NEW.released_at,
        NEW.released_at_revision,
        NEW.release_waiver_receipt_id
      ) IS DISTINCT FROM ROW(
        OLD.release_document_id,
        OLD.release_document_hash,
        OLD.released_at,
        OLD.released_at_revision,
        OLD.release_waiver_receipt_id
      ) THEN
      RAISE EXCEPTION 'student case updates cannot write release metadata'
        USING ERRCODE = '42501';
    END IF;
  ELSIF trusted_actor_role = 'faculty' THEN
    IF NEW.record IS DISTINCT FROM OLD.record THEN
      RAISE EXCEPTION 'faculty case updates cannot rewrite the student-safe workspace'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.record_hash IS DISTINCT FROM OLD.record_hash
       AND ROW(
         NEW.release_document_id,
         NEW.release_document_hash,
         NEW.released_at,
         NEW.released_at_revision,
         NEW.release_waiver_receipt_id
       ) IS NOT DISTINCT FROM ROW(
         OLD.release_document_id,
         OLD.release_document_hash,
         OLD.released_at,
         OLD.released_at_revision,
         OLD.release_waiver_receipt_id
       ) THEN
      RAISE EXCEPTION 'faculty case hash changes require an exact release transition'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status <> OLD.status AND NOT (
      (OLD.status = 'faculty_verified' AND NEW.status = 'faculty_review')
      OR (OLD.status = 'faculty_review' AND NEW.status = 'faculty_approved')
    ) THEN
      RAISE EXCEPTION 'faculty case lifecycle transition is not faculty-owned'
        USING ERRCODE = '42501';
    END IF;
    IF ROW(
        NEW.release_document_id,
        NEW.release_document_hash,
        NEW.released_at,
        NEW.released_at_revision,
        NEW.release_waiver_receipt_id
      ) IS DISTINCT FROM ROW(
        OLD.release_document_id,
        OLD.release_document_hash,
        OLD.released_at,
        OLD.released_at_revision,
        OLD.release_waiver_receipt_id
      ) AND NOT (
        OLD.released_at IS NULL
        AND NEW.status = OLD.status
        AND NEW.status = ANY (
          ARRAY['faculty_verified', 'faculty_review', 'faculty_approved', 'delivered']::text[]
        )
        AND NEW.release_document_id IS NOT NULL
        AND NEW.release_document_hash IS NOT NULL
        AND NEW.released_at IS NOT NULL
        AND NEW.released_at_revision = NEW.revision
        AND NEW.release_waiver_receipt_id IS NOT NULL
      ) THEN
      RAISE EXCEPTION 'faculty release metadata must be a complete faculty-approved release'
        USING ERRCODE = '42501';
    END IF;
  ELSIF trusted_actor_role = ANY (ARRAY['admin', 'founder', 'support', 'service']::text[]) THEN
    IF pg_catalog.current_setting('lor_studio.operation', true) <> 'save' THEN
      RAISE EXCEPTION 'operational case updates require an exact save capability'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'actor role cannot update recommendation cases'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.released_at IS NOT NULL AND ROW(
      NEW.release_document_id,
      NEW.release_document_hash,
      NEW.released_at,
      NEW.released_at_revision,
      NEW.release_waiver_receipt_id
    ) IS DISTINCT FROM ROW(
      OLD.release_document_id,
      OLD.release_document_hash,
      OLD.released_at,
      OLD.released_at_revision,
      OLD.release_waiver_receipt_id
    ) THEN
    RAISE EXCEPTION 'released recommendation case metadata is immutable'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_recommendation_case_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF pg_catalog.current_setting('lor_studio.actor_role', true) <> 'student'
     OR NEW.revision <> 0
     OR NEW.status <> 'draft'
     OR NEW.created_at <> NEW.updated_at
     OR NEW.closed_at IS NOT NULL
     OR NEW.release_document_id IS NOT NULL
     OR NEW.release_document_hash IS NOT NULL
     OR NEW.released_at IS NOT NULL
     OR NEW.released_at_revision IS NOT NULL
     OR NEW.release_waiver_receipt_id IS NOT NULL
     OR NEW.record -> 'builder' -> 'completedStepIds' <> '[]'::jsonb
     OR NEW.record -> 'builder' -> 'stepData' <> '{}'::jsonb
     OR NEW.record -> 'builder' -> 'autosavedAt' <> 'null'::jsonb
     OR NEW.record -> 'delivery' <> pg_catalog.jsonb_build_object(
       'status', 'not_started',
       'destinationClass', NULL,
       'deliveredAt', NULL
     ) THEN
    RAISE EXCEPTION 'new recommendation case must be an empty student-owned draft'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_faculty_private_content_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = NEW.case_id
      AND recommendation_case.student_auth_subject = NEW.student_auth_subject
      AND recommendation_case.revision = NEW.private_revision
      AND recommendation_case.status NOT IN ('closed', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'faculty-private revision must equal the current mutable case revision'
      USING ERRCODE = '40001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_faculty_private_content_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF ROW(
      NEW.case_id,
      NEW.student_auth_subject,
      NEW.faculty_auth_subject,
      NEW.faculty_auth_uid,
      NEW.invitation_id,
      NEW.created_at
    ) IS DISTINCT FROM ROW(
      OLD.case_id,
      OLD.student_auth_subject,
      OLD.faculty_auth_subject,
      OLD.faculty_auth_uid,
      OLD.invitation_id,
      OLD.created_at
    ) THEN
    RAISE EXCEPTION 'faculty-private identity, invitation, and creation time are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.private_revision <= OLD.private_revision THEN
    RAISE EXCEPTION 'faculty-private revision must advance to a later case revision'
      USING ERRCODE = '40001';
  END IF;

  IF NEW.updated_at < OLD.updated_at OR NOT EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = NEW.case_id
      AND recommendation_case.student_auth_subject = NEW.student_auth_subject
      AND recommendation_case.revision = NEW.private_revision
      AND recommendation_case.status NOT IN ('closed', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'faculty-private state must bind a later current mutable case revision'
      USING ERRCODE = '40001';
  END IF;

  IF OLD.released_at IS NOT NULL AND ROW(
      NEW.final_document_id,
      NEW.final_document_text,
      NEW.final_document_content_hash,
      NEW.final_document_mime_type,
      NEW.approval_approved,
      NEW.approval_at,
      NEW.approval_faculty_auth_subject,
      NEW.approval_signature_attested,
      NEW.release_document_hash,
      NEW.release_document_id,
      NEW.released_at,
      NEW.released_at_revision,
      NEW.release_waiver_receipt_id
    ) IS DISTINCT FROM ROW(
      OLD.final_document_id,
      OLD.final_document_text,
      OLD.final_document_content_hash,
      OLD.final_document_mime_type,
      OLD.approval_approved,
      OLD.approval_at,
      OLD.approval_faculty_auth_subject,
      OLD.approval_signature_attested,
      OLD.release_document_hash,
      OLD.release_document_id,
      OLD.released_at,
      OLD.released_at_revision,
      OLD.release_waiver_receipt_id
    ) THEN
    RAISE EXCEPTION 'released faculty-private content is immutable'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION lor_studio.student_record_is_safe(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.canonical_jsonb_text(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.canonical_jsonb_sha256(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.release_document_hash(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.protected_state_chain_hash(text, text, bigint, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.ai_grounding_manifest_is_complete(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.private_record_is_complete(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.protected_case_state_is_complete(jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.audit_event_is_metadata(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.text_array_is_sorted_unique(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.reject_append_only_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_recommendation_case_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_recommendation_case_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_faculty_private_content_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_faculty_private_content_update() FROM PUBLIC;

CREATE TABLE lor_studio.student_auth_bindings (
  binding_id text PRIMARY KEY,
  student_auth_subject text NOT NULL,
  student_auth_uid uuid NOT NULL,
  binding_source text NOT NULL,
  source_reference_hash text NOT NULL,
  proof_hash text NOT NULL,
  bound_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT student_auth_bindings_identity_unique UNIQUE (student_auth_subject, student_auth_uid),
  CONSTRAINT student_auth_bindings_exact_identity_unique
    UNIQUE (binding_id, student_auth_subject, student_auth_uid),
  CONSTRAINT student_auth_bindings_id_format CHECK (binding_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT student_auth_bindings_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT student_auth_bindings_source_known CHECK (binding_source = 'wordpress_verified_bootstrap'),
  CONSTRAINT student_auth_bindings_hash_formats CHECK (
    source_reference_hash ~ '^[a-f0-9]{64}$' AND proof_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT student_auth_bindings_time_order CHECK (
    created_at >= bound_at AND (expires_at IS NULL OR expires_at > bound_at)
  )
);

CREATE INDEX student_auth_bindings_active_subject_idx
  ON lor_studio.student_auth_bindings (student_auth_subject)
  WHERE expires_at IS NULL;

CREATE INDEX student_auth_bindings_subject_uid_idx
  ON lor_studio.student_auth_bindings (student_auth_subject, student_auth_uid, binding_id, expires_at);

CREATE TABLE lor_studio.student_auth_binding_revocations (
  binding_id text PRIMARY KEY,
  student_auth_subject text NOT NULL,
  student_auth_uid uuid NOT NULL,
  revoked_at timestamptz NOT NULL,
  authority_ref text NOT NULL,
  revocation_hash text NOT NULL,
  CONSTRAINT student_auth_binding_revocations_binding_fk
    FOREIGN KEY (binding_id, student_auth_subject, student_auth_uid)
    REFERENCES lor_studio.student_auth_bindings (binding_id, student_auth_subject, student_auth_uid),
  CONSTRAINT student_auth_binding_revocations_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT student_auth_binding_revocations_authority_ref_format CHECK (authority_ref ~ '^authority_[a-f0-9]{64}$'),
  CONSTRAINT student_auth_binding_revocations_hash_format CHECK (revocation_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX student_auth_binding_revocations_identity_idx
  ON lor_studio.student_auth_binding_revocations (student_auth_subject, student_auth_uid, binding_id);

CREATE TABLE lor_studio.recommendation_cases (
  case_id text PRIMARY KEY,
  student_auth_subject text NOT NULL,
  student_auth_uid uuid NOT NULL,
  revision bigint NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  closed_at timestamptz,
  record jsonb NOT NULL,
  record_hash text NOT NULL,
  protected_state_hash text NOT NULL,
  release_document_id text,
  release_document_hash text,
  released_at timestamptz,
  released_at_revision bigint,
  release_waiver_receipt_id text,
  release_waiver_allows_student_view boolean GENERATED ALWAYS AS (
    CASE WHEN release_waiver_receipt_id IS NULL THEN NULL ELSE false END
  ) STORED,
  CONSTRAINT recommendation_cases_case_id_format CHECK (case_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT recommendation_cases_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT recommendation_cases_student_binding_fk
    FOREIGN KEY (student_auth_subject, student_auth_uid)
    REFERENCES lor_studio.student_auth_bindings (student_auth_subject, student_auth_uid),
  CONSTRAINT recommendation_cases_revision_nonnegative CHECK (revision >= 0),
  CONSTRAINT recommendation_cases_status_known CHECK (status IN (
    'draft', 'faculty_invited', 'faculty_verified', 'faculty_review',
    'faculty_approved', 'delivered', 'closed', 'cancelled'
  )),
  CONSTRAINT recommendation_cases_time_order CHECK (
    updated_at >= created_at
    AND (closed_at IS NULL OR closed_at >= created_at)
    AND ((status = 'closed') = (closed_at IS NOT NULL))
  ),
  CONSTRAINT recommendation_cases_safe_record CHECK (lor_studio.student_record_is_safe(record)),
  CONSTRAINT recommendation_cases_record_hash_format CHECK (record_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT recommendation_cases_protected_state_hash_format
    CHECK (protected_state_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT recommendation_cases_release_shape CHECK (
    (
      release_document_id IS NULL
      AND release_document_hash IS NULL
      AND released_at IS NULL
      AND released_at_revision IS NULL
      AND release_waiver_receipt_id IS NULL
    )
    OR
    (
      release_document_id IS NOT NULL
      AND release_document_hash IS NOT NULL
      AND release_document_hash ~ '^[a-f0-9]{64}$'
      AND released_at IS NOT NULL
      AND released_at_revision IS NOT NULL
      AND released_at_revision >= 0
      AND released_at_revision <= revision
      AND release_waiver_receipt_id IS NOT NULL
      AND released_at >= created_at
    )
  ),
  CONSTRAINT recommendation_cases_case_owner_unique UNIQUE (case_id, student_auth_subject),
  CONSTRAINT recommendation_cases_case_owner_uid_unique UNIQUE (case_id, student_auth_subject, student_auth_uid)
);

CREATE INDEX recommendation_cases_student_scope_idx
  ON lor_studio.recommendation_cases (student_auth_subject, student_auth_uid, case_id);
CREATE INDEX recommendation_cases_status_updated_idx
  ON lor_studio.recommendation_cases (status, updated_at DESC);

CREATE TABLE lor_studio.recommendation_case_creation_reservations (
  creation_ref text PRIMARY KEY,
  student_auth_subject text NOT NULL,
  student_auth_uid uuid NOT NULL,
  actor_ref text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  case_id text NOT NULL,
  builder_session_id text NOT NULL,
  created_at timestamptz NOT NULL,
  transaction_id text NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT case_creation_reservations_creation_ref_format CHECK (creation_ref ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT case_creation_reservations_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT case_creation_reservations_student_binding_fk
    FOREIGN KEY (student_auth_subject, student_auth_uid)
    REFERENCES lor_studio.student_auth_bindings (student_auth_subject, student_auth_uid),
  CONSTRAINT case_creation_reservations_actor_ref_format CHECK (actor_ref ~ '^actor_[a-f0-9]{64}$'),
  CONSTRAINT case_creation_reservations_idempotency_key_nonempty CHECK (pg_catalog.length(idempotency_key) BETWEEN 1 AND 240),
  CONSTRAINT case_creation_reservations_request_hash_format CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT case_creation_reservations_case_id_format CHECK (case_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT case_creation_reservations_builder_id_format CHECK (builder_session_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT case_creation_reservations_transaction_id_format CHECK (transaction_id ~ '^[0-9]+$'),
  CONSTRAINT case_creation_reservations_time_order CHECK (reserved_at >= created_at),
  CONSTRAINT case_creation_reservations_owner_key_unique UNIQUE (student_auth_subject, idempotency_key)
);

CREATE INDEX case_creation_reservations_owner_lookup_idx
  ON lor_studio.recommendation_case_creation_reservations
  (student_auth_subject, student_auth_uid, creation_ref, actor_ref);

CREATE TABLE lor_studio.recommendation_case_audit_events (
  event_ref text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  case_ref text NOT NULL,
  actor_ref text NOT NULL,
  actor_role text NOT NULL,
  correlation_ref text NOT NULL,
  event_type text NOT NULL,
  outcome text NOT NULL,
  revision bigint NOT NULL,
  occurred_at timestamptz NOT NULL,
  event jsonb NOT NULL,
  event_hash text NOT NULL,
  transaction_id text NOT NULL,
  inserted_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT recommendation_case_audit_events_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT recommendation_case_audit_events_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT recommendation_case_audit_events_reference_formats CHECK (
    event_ref ~ '^event_[a-f0-9]{64}$'
    AND case_ref ~ '^case_[a-f0-9]{64}$'
    AND actor_ref ~ '^actor_[a-f0-9]{64}$'
    AND correlation_ref ~ '^correlation_[a-f0-9]{64}$'
  ),
  CONSTRAINT recommendation_case_audit_events_actor_role_known CHECK (actor_role IN (
    'student', 'faculty', 'mentor', 'admin', 'founder', 'support', 'service'
  )),
  CONSTRAINT recommendation_case_audit_events_event_type_known CHECK (event_type IN (
    'ai.proposal_decision_recorded',
    'ai.proposal_generated',
    'case.created',
    'builder.autosaved',
    'builder.step_completed',
    'consent.recorded',
    'deletion.hold_released',
    'faculty.final_document_released',
    'faculty.invited',
    'faculty.private_content_updated',
    'faculty.verification_denied',
    'faculty.verified',
    'strategy.metadata_updated',
    'student.material_updated',
    'waiver.recorded',
    'case.draft',
    'case.faculty_invited',
    'case.faculty_verified',
    'case.faculty_review',
    'case.faculty_approved',
    'case.delivered',
    'case.closed',
    'case.cancelled'
  )),
  CONSTRAINT recommendation_case_audit_events_outcome_known CHECK (outcome IN ('success', 'denied', 'failed', 'idempotent_replay')),
  CONSTRAINT recommendation_case_audit_events_revision_nonnegative CHECK (revision >= 0),
  CONSTRAINT recommendation_case_audit_events_metadata_only CHECK (lor_studio.audit_event_is_metadata(event)),
  CONSTRAINT recommendation_case_audit_events_event_binding CHECK (
    event ->> 'eventRef' = event_ref
    AND event ->> 'eventType' = event_type
    AND event ->> 'caseRef' = case_ref
    AND event ->> 'actorRef' = actor_ref
    AND event ->> 'actorRole' = actor_role
    AND event ->> 'correlationRef' = correlation_ref
    AND event ->> 'outcome' = outcome
    AND event ->> 'revision' = revision::text
    AND (event ->> 'occurredAt')::timestamptz = occurred_at
  ),
  CONSTRAINT recommendation_case_audit_events_event_hash_format CHECK (event_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT recommendation_case_audit_events_transaction_id_format CHECK (transaction_id ~ '^[0-9]+$'),
  CONSTRAINT recommendation_case_audit_events_time_order CHECK (inserted_at >= occurred_at),
  CONSTRAINT recommendation_case_audit_events_case_identity_unique
    UNIQUE (event_ref, case_id, student_auth_subject),
  CONSTRAINT recommendation_case_audit_events_receipt_binding_unique
    UNIQUE (
      event_ref,
      case_id,
      student_auth_subject,
      revision,
      event_hash,
      transaction_id
    )
);

CREATE INDEX recommendation_case_audit_events_case_revision_idx
  ON lor_studio.recommendation_case_audit_events (case_id, student_auth_subject, revision, occurred_at);
CREATE INDEX recommendation_case_audit_events_actor_idx
  ON lor_studio.recommendation_case_audit_events (actor_ref, occurred_at);

CREATE TABLE lor_studio.recommendation_case_protected_revision_states (
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  revision bigint NOT NULL,
  previous_revision bigint,
  previous_protected_state_hash text,
  protected_state jsonb NOT NULL,
  protected_state_hash text NOT NULL,
  event_hash text NOT NULL,
  audit_event_ref text NOT NULL,
  transaction_id text NOT NULL,
  committed_at timestamptz NOT NULL,
  CONSTRAINT recommendation_case_protected_revision_states_pk
    PRIMARY KEY (case_id, student_auth_subject, revision),
  CONSTRAINT recommendation_case_protected_revision_states_hash_identity_unique
    UNIQUE (case_id, student_auth_subject, revision, protected_state_hash),
  CONSTRAINT recommendation_case_protected_revision_states_predecessor_shape CHECK (
    (
      revision = 0
      AND previous_revision IS NULL
      AND previous_protected_state_hash IS NULL
    )
    OR (
      revision > 0
      AND previous_revision = revision - 1
      AND previous_protected_state_hash IS NOT NULL
      AND previous_protected_state_hash ~ '^[a-f0-9]{64}$'
    )
  ),
  CONSTRAINT recommendation_case_protected_revision_states_predecessor_fk
    FOREIGN KEY (
      case_id,
      student_auth_subject,
      previous_revision,
      previous_protected_state_hash
    )
    REFERENCES lor_studio.recommendation_case_protected_revision_states (
      case_id,
      student_auth_subject,
      revision,
      protected_state_hash
    )
    MATCH SIMPLE,
  CONSTRAINT recommendation_case_protected_revision_states_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT recommendation_case_protected_revision_states_audit_fk
    FOREIGN KEY (
      audit_event_ref,
      case_id,
      student_auth_subject,
      revision,
      event_hash,
      transaction_id
    )
    REFERENCES lor_studio.recommendation_case_audit_events (
      event_ref,
      case_id,
      student_auth_subject,
      revision,
      event_hash,
      transaction_id
    ),
  CONSTRAINT recommendation_case_protected_revision_states_subject_format
    CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT recommendation_case_protected_revision_states_revision_nonnegative
    CHECK (revision >= 0),
  CONSTRAINT recommendation_case_protected_revision_states_shape
    CHECK (lor_studio.protected_case_state_is_complete(protected_state, revision)),
  CONSTRAINT recommendation_case_protected_revision_states_hash_formats CHECK (
    protected_state_hash ~ '^[a-f0-9]{64}$'
    AND event_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT recommendation_case_protected_revision_states_transaction_id_format
    CHECK (transaction_id ~ '^[0-9]+$')
);

CREATE INDEX recommendation_case_protected_revision_states_audit_idx
  ON lor_studio.recommendation_case_protected_revision_states
  (audit_event_ref, case_id, student_auth_subject, revision);
CREATE INDEX recommendation_case_protected_revision_states_predecessor_idx
  ON lor_studio.recommendation_case_protected_revision_states
  (case_id, student_auth_subject, previous_revision, previous_protected_state_hash)
  WHERE previous_revision IS NOT NULL;

ALTER TABLE lor_studio.recommendation_cases
  ADD CONSTRAINT recommendation_cases_current_protected_state_fk
  FOREIGN KEY (case_id, student_auth_subject, revision, protected_state_hash)
  REFERENCES lor_studio.recommendation_case_protected_revision_states (
    case_id, student_auth_subject, revision, protected_state_hash
  )
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE lor_studio.recommendation_case_write_receipts (
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  student_auth_uid uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  command_type text NOT NULL,
  operation text NOT NULL,
  revision bigint NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  closed_at timestamptz,
  record jsonb NOT NULL,
  record_hash text NOT NULL,
  protected_state_hash text NOT NULL,
  released_snapshot_hash text,
  event_hash text NOT NULL,
  audit_event_ref text NOT NULL,
  transaction_id text NOT NULL,
  committed_at timestamptz NOT NULL,
  CONSTRAINT recommendation_case_write_receipts_pk
    PRIMARY KEY (case_id, student_auth_subject, idempotency_key),
  CONSTRAINT recommendation_case_write_receipts_case_fk
    FOREIGN KEY (case_id, student_auth_subject, student_auth_uid)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject, student_auth_uid),
  CONSTRAINT recommendation_case_write_receipts_audit_fk
    FOREIGN KEY (
      audit_event_ref,
      case_id,
      student_auth_subject,
      revision,
      event_hash,
      transaction_id
    )
    REFERENCES lor_studio.recommendation_case_audit_events (
      event_ref,
      case_id,
      student_auth_subject,
      revision,
      event_hash,
      transaction_id
    ),
  CONSTRAINT recommendation_case_write_receipts_protected_state_fk
    FOREIGN KEY (case_id, student_auth_subject, revision, protected_state_hash)
    REFERENCES lor_studio.recommendation_case_protected_revision_states (
      case_id, student_auth_subject, revision, protected_state_hash
    ),
  CONSTRAINT recommendation_case_write_receipts_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT recommendation_case_write_receipts_idempotency_key_nonempty CHECK (pg_catalog.length(idempotency_key) BETWEEN 1 AND 240),
  CONSTRAINT recommendation_case_write_receipts_request_hash_format CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT recommendation_case_write_receipts_command_type_known CHECK (command_type IN (
    'student.case.create',
    'student.builder.autosave',
    'student.builder.complete',
    'student.consent.record',
    'student.waiver.record'
  )),
  CONSTRAINT recommendation_case_write_receipts_operation_known CHECK (operation IN ('create', 'save')),
  CONSTRAINT recommendation_case_write_receipts_operation_revision CHECK (
    (command_type = 'student.case.create' AND operation = 'create' AND revision = 0)
    OR (command_type <> 'student.case.create' AND operation = 'save' AND revision > 0)
  ),
  CONSTRAINT recommendation_case_write_receipts_revision_nonnegative CHECK (revision >= 0),
  CONSTRAINT recommendation_case_write_receipts_status_known CHECK (status IN (
    'draft', 'faculty_invited', 'faculty_verified', 'faculty_review',
    'faculty_approved', 'delivered', 'closed', 'cancelled'
  )),
  CONSTRAINT recommendation_case_write_receipts_time_order CHECK (
    updated_at >= created_at
    AND (closed_at IS NULL OR closed_at >= created_at)
    AND ((status = 'closed') = (closed_at IS NOT NULL))
  ),
  CONSTRAINT recommendation_case_write_receipts_safe_record CHECK (lor_studio.student_record_is_safe(record)),
  CONSTRAINT recommendation_case_write_receipts_record_hash_format CHECK (
    record_hash ~ '^[a-f0-9]{64}$'
    AND protected_state_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT recommendation_case_write_receipts_released_snapshot_hash_format CHECK (
    released_snapshot_hash IS NULL OR released_snapshot_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT recommendation_case_write_receipts_event_hash_format CHECK (event_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT recommendation_case_write_receipts_transaction_id_format CHECK (transaction_id ~ '^[0-9]+$')
);

CREATE INDEX recommendation_case_write_receipts_owner_lookup_idx
  ON lor_studio.recommendation_case_write_receipts
  (student_auth_subject, student_auth_uid, case_id, idempotency_key);
CREATE INDEX recommendation_case_write_receipts_audit_event_idx
  ON lor_studio.recommendation_case_write_receipts (audit_event_ref);

CREATE TABLE lor_studio.faculty_invitations (
  invitation_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  faculty_auth_subject text,
  faculty_auth_uid uuid,
  recipient_email_hash text NOT NULL,
  token_hash text NOT NULL,
  revision bigint NOT NULL DEFAULT 0,
  failed_attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL,
  attempt_window_ms bigint NOT NULL,
  lockout_ms bigint NOT NULL,
  attempt_window_started_at timestamptz,
  locked_until timestamptz,
  last_failure_code text,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL,
  CONSTRAINT faculty_invitations_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT faculty_invitations_case_identity_unique UNIQUE (invitation_id, case_id, student_auth_subject),
  CONSTRAINT faculty_invitations_recipient_identity_unique
    UNIQUE (invitation_id, case_id, student_auth_subject, faculty_auth_subject, faculty_auth_uid),
  CONSTRAINT faculty_invitations_email_identity_unique
    UNIQUE (invitation_id, case_id, student_auth_subject, recipient_email_hash),
  CONSTRAINT faculty_invitations_exact_recipient_identity_unique
    UNIQUE (
      invitation_id,
      case_id,
      student_auth_subject,
      recipient_email_hash,
      faculty_auth_subject,
      faculty_auth_uid
    ),
  CONSTRAINT faculty_invitations_id_format CHECK (invitation_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT faculty_invitations_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT faculty_invitations_faculty_identity_pair CHECK (
    (faculty_auth_subject IS NULL AND faculty_auth_uid IS NULL)
    OR (
      faculty_auth_subject IS NOT NULL
      AND faculty_auth_subject ~ '^wp:[1-9][0-9]*$'
      AND faculty_auth_uid IS NOT NULL
    )
  ),
  CONSTRAINT faculty_invitations_hash_formats CHECK (
    recipient_email_hash ~ '^[a-f0-9]{64}$'
    AND token_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT faculty_invitations_attempt_bounds CHECK (
    revision >= 0
    AND failed_attempts >= 0
    AND max_attempts BETWEEN 1 AND 20
    AND failed_attempts <= max_attempts
    AND attempt_window_ms BETWEEN 1000 AND 86400000
    AND lockout_ms BETWEEN 1000 AND 86400000
  ),
  CONSTRAINT faculty_invitations_time_order CHECK (
    expires_at > created_at
    AND updated_at >= created_at
    AND (used_at IS NULL OR (used_at >= created_at AND used_at < expires_at))
    AND (revoked_at IS NULL OR revoked_at >= created_at)
    AND (attempt_window_started_at IS NULL OR attempt_window_started_at >= created_at)
    AND (locked_until IS NULL OR (
      attempt_window_started_at IS NOT NULL AND locked_until > attempt_window_started_at
    ))
  ),
  CONSTRAINT faculty_invitations_state_shape CHECK (
    (used_at IS NULL) = (faculty_auth_subject IS NULL AND faculty_auth_uid IS NULL)
    AND NOT (used_at IS NOT NULL AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT faculty_invitations_attempt_shape CHECK (
    (
      failed_attempts = 0
      AND attempt_window_started_at IS NULL
      AND last_failure_code IS NULL
      AND locked_until IS NULL
    )
    OR
    (
      failed_attempts > 0
      AND attempt_window_started_at IS NOT NULL
      AND last_failure_code IS NOT NULL
      AND last_failure_code IN ('OTP_NOT_VERIFIED', 'RECIPIENT_MISMATCH', 'TOKEN_MISMATCH')
      AND ((failed_attempts = max_attempts) = (locked_until IS NOT NULL))
    )
  )
);

CREATE INDEX faculty_invitations_case_lookup_idx
  ON lor_studio.faculty_invitations (case_id, student_auth_subject, invitation_id);
CREATE INDEX faculty_invitations_faculty_scope_idx
  ON lor_studio.faculty_invitations
  (faculty_auth_subject, faculty_auth_uid, invitation_id, case_id, student_auth_subject)
  WHERE used_at IS NOT NULL AND revoked_at IS NULL;
CREATE INDEX faculty_invitations_expiry_idx
  ON lor_studio.faculty_invitations (expires_at)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE TABLE lor_studio.faculty_otp_challenges (
  challenge_id text PRIMARY KEY,
  invitation_id text NOT NULL,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  recipient_email_hash text NOT NULL,
  otp_code_hash text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  challenge_hash text NOT NULL,
  CONSTRAINT faculty_otp_challenges_invitation_fk
    FOREIGN KEY (invitation_id, case_id, student_auth_subject, recipient_email_hash)
    REFERENCES lor_studio.faculty_invitations (
      invitation_id, case_id, student_auth_subject, recipient_email_hash
    ),
  CONSTRAINT faculty_otp_challenges_case_identity_unique
    UNIQUE (challenge_id, invitation_id, case_id, student_auth_subject),
  CONSTRAINT faculty_otp_challenges_recipient_identity_unique
    UNIQUE (challenge_id, invitation_id, case_id, student_auth_subject, recipient_email_hash),
  CONSTRAINT faculty_otp_challenges_id_format CHECK (challenge_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT faculty_otp_challenges_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT faculty_otp_challenges_hash_formats CHECK (
    recipient_email_hash ~ '^[a-f0-9]{64}$'
    AND otp_code_hash ~ '^[a-f0-9]{64}$'
    AND challenge_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT faculty_otp_challenges_time_order CHECK (expires_at > issued_at)
);

CREATE INDEX faculty_otp_challenges_invitation_idx
  ON lor_studio.faculty_otp_challenges (invitation_id, case_id, student_auth_subject, challenge_id);

CREATE TABLE lor_studio.faculty_otp_challenge_revocations (
  challenge_id text PRIMARY KEY,
  invitation_id text NOT NULL,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  revoked_at timestamptz NOT NULL,
  reason_code text NOT NULL,
  audit_event_ref text NOT NULL,
  revocation_hash text NOT NULL,
  CONSTRAINT faculty_otp_challenge_revocations_challenge_fk
    FOREIGN KEY (challenge_id, invitation_id, case_id, student_auth_subject)
    REFERENCES lor_studio.faculty_otp_challenges (
      challenge_id, invitation_id, case_id, student_auth_subject
    ),
  CONSTRAINT faculty_otp_challenge_revocations_audit_fk
    FOREIGN KEY (audit_event_ref, case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_case_audit_events (event_ref, case_id, student_auth_subject),
  CONSTRAINT faculty_otp_challenge_revocations_reason_format CHECK (
    reason_code ~ '^[A-Z][A-Z0-9_]{1,99}$'
  ),
  CONSTRAINT faculty_otp_challenge_revocations_hash_format CHECK (revocation_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX faculty_otp_challenge_revocations_case_idx
  ON lor_studio.faculty_otp_challenge_revocations
  (case_id, student_auth_subject, invitation_id, challenge_id);

CREATE TABLE lor_studio.faculty_otp_verification_receipts (
  receipt_id text PRIMARY KEY,
  challenge_id text NOT NULL,
  invitation_id text NOT NULL,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  faculty_auth_subject text NOT NULL,
  faculty_auth_uid uuid NOT NULL,
  recipient_email_hash text NOT NULL,
  otp_proof_ref text NOT NULL,
  otp_verified_at timestamptz NOT NULL,
  otp_expires_at timestamptz NOT NULL,
  otp_revoked boolean NOT NULL,
  principal_authority text NOT NULL,
  invitation_used_at timestamptz NOT NULL,
  audit_event_ref text NOT NULL,
  transaction_id text NOT NULL,
  receipt_hash text NOT NULL,
  committed_at timestamptz NOT NULL,
  CONSTRAINT faculty_otp_verification_receipts_challenge_fk
    FOREIGN KEY (
      challenge_id, invitation_id, case_id, student_auth_subject, recipient_email_hash
    )
    REFERENCES lor_studio.faculty_otp_challenges (
      challenge_id, invitation_id, case_id, student_auth_subject, recipient_email_hash
    ),
  CONSTRAINT faculty_otp_verification_receipts_invitation_fk
    FOREIGN KEY (
      invitation_id,
      case_id,
      student_auth_subject,
      recipient_email_hash,
      faculty_auth_subject,
      faculty_auth_uid
    )
    REFERENCES lor_studio.faculty_invitations (
      invitation_id,
      case_id,
      student_auth_subject,
      recipient_email_hash,
      faculty_auth_subject,
      faculty_auth_uid
    ),
  CONSTRAINT faculty_otp_verification_receipts_audit_fk
    FOREIGN KEY (audit_event_ref, case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_case_audit_events (event_ref, case_id, student_auth_subject),
  CONSTRAINT faculty_otp_verification_receipts_case_identity_unique
    UNIQUE (receipt_id, case_id, student_auth_subject),
  CONSTRAINT faculty_otp_verification_receipts_challenge_once UNIQUE (challenge_id),
  CONSTRAINT faculty_otp_verification_receipts_id_format
    CHECK (receipt_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT faculty_otp_verification_receipts_student_subject_format
    CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT faculty_otp_verification_receipts_faculty_subject_format
    CHECK (faculty_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT faculty_otp_verification_receipts_proof_shape CHECK (
    recipient_email_hash ~ '^[a-f0-9]{64}$'
    AND otp_proof_ref ~ '^[a-f0-9]{64}$'
    AND otp_revoked IS FALSE
    AND principal_authority = 'durable_otp_provider_proof'
    AND otp_verified_at <= invitation_used_at
    AND invitation_used_at < otp_expires_at
  ),
  CONSTRAINT faculty_otp_verification_receipts_transaction_id_format CHECK (transaction_id ~ '^[0-9]+$'),
  CONSTRAINT faculty_otp_verification_receipts_hash_format CHECK (receipt_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX faculty_otp_verification_receipts_faculty_scope_idx
  ON lor_studio.faculty_otp_verification_receipts
  (faculty_auth_subject, faculty_auth_uid, invitation_id, case_id, student_auth_subject);
CREATE INDEX faculty_otp_verification_receipts_audit_idx
  ON lor_studio.faculty_otp_verification_receipts (audit_event_ref, case_id, student_auth_subject);

CREATE TABLE lor_studio.faculty_otp_proof_revocations (
  receipt_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  revoked_at timestamptz NOT NULL,
  reason_code text NOT NULL,
  audit_event_ref text NOT NULL,
  revocation_hash text NOT NULL,
  CONSTRAINT faculty_otp_proof_revocations_receipt_fk
    FOREIGN KEY (receipt_id, case_id, student_auth_subject)
    REFERENCES lor_studio.faculty_otp_verification_receipts (receipt_id, case_id, student_auth_subject),
  CONSTRAINT faculty_otp_proof_revocations_audit_fk
    FOREIGN KEY (audit_event_ref, case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_case_audit_events (event_ref, case_id, student_auth_subject),
  CONSTRAINT faculty_otp_proof_revocations_reason_format CHECK (
    reason_code ~ '^[A-Z][A-Z0-9_]{1,99}$'
  ),
  CONSTRAINT faculty_otp_proof_revocations_hash_format CHECK (revocation_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX faculty_otp_proof_revocations_case_idx
  ON lor_studio.faculty_otp_proof_revocations (case_id, student_auth_subject, receipt_id);

CREATE TABLE lor_studio.consent_receipts (
  receipt_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  student_auth_uid uuid NOT NULL,
  case_revision bigint NOT NULL,
  scopes text[] NOT NULL,
  policy_version text NOT NULL,
  recorded_at timestamptz NOT NULL,
  receipt_hash text NOT NULL,
  CONSTRAINT consent_receipts_case_fk
    FOREIGN KEY (case_id, student_auth_subject, student_auth_uid)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject, student_auth_uid),
  CONSTRAINT consent_receipts_protected_revision_fk
    FOREIGN KEY (case_id, student_auth_subject, case_revision)
    REFERENCES lor_studio.recommendation_case_protected_revision_states (
      case_id, student_auth_subject, revision
    )
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT consent_receipts_case_identity_unique UNIQUE (receipt_id, case_id, student_auth_subject),
  CONSTRAINT consent_receipts_id_format CHECK (receipt_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT consent_receipts_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT consent_receipts_case_revision_positive CHECK (case_revision > 0),
  CONSTRAINT consent_receipts_scopes_nonempty CHECK (
    lor_studio.text_array_is_sorted_unique(scopes)
  ),
  CONSTRAINT consent_receipts_policy_version_nonempty CHECK (
    pg_catalog.length(policy_version) BETWEEN 1 AND 200
  ),
  CONSTRAINT consent_receipts_hash_format CHECK (receipt_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX consent_receipts_student_case_idx
  ON lor_studio.consent_receipts (student_auth_subject, student_auth_uid, case_id, recorded_at);
CREATE INDEX consent_receipts_case_fk_idx
  ON lor_studio.consent_receipts
  (case_id, student_auth_subject, case_revision, student_auth_uid);

CREATE TABLE lor_studio.waiver_receipts (
  receipt_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  student_auth_uid uuid NOT NULL,
  case_revision bigint NOT NULL,
  prior_receipt_id text,
  waived boolean NOT NULL,
  policy_version text NOT NULL,
  acknowledgment text NOT NULL,
  recorded_at timestamptz NOT NULL,
  receipt_hash text NOT NULL,
  CONSTRAINT waiver_receipts_case_fk
    FOREIGN KEY (case_id, student_auth_subject, student_auth_uid)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject, student_auth_uid),
  CONSTRAINT waiver_receipts_protected_revision_fk
    FOREIGN KEY (case_id, student_auth_subject, case_revision)
    REFERENCES lor_studio.recommendation_case_protected_revision_states (
      case_id, student_auth_subject, revision
    )
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT waiver_receipts_case_identity_unique UNIQUE (receipt_id, case_id, student_auth_subject),
  CONSTRAINT waiver_receipts_disclosure_identity_unique
    UNIQUE (receipt_id, case_id, student_auth_subject, waived),
  CONSTRAINT waiver_receipts_prior_receipt_fk
    FOREIGN KEY (prior_receipt_id, case_id, student_auth_subject)
    REFERENCES lor_studio.waiver_receipts (receipt_id, case_id, student_auth_subject),
  CONSTRAINT waiver_receipts_id_format CHECK (receipt_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT waiver_receipts_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT waiver_receipts_case_revision_positive CHECK (case_revision > 0),
  CONSTRAINT waiver_receipts_no_self_reference CHECK (prior_receipt_id IS NULL OR prior_receipt_id <> receipt_id),
  CONSTRAINT waiver_receipts_policy_version_nonempty CHECK (
    pg_catalog.length(policy_version) BETWEEN 1 AND 200
  ),
  CONSTRAINT waiver_receipts_acknowledgment_bound CHECK (
    pg_catalog.length(acknowledgment) BETWEEN 1 AND 2000
  ),
  CONSTRAINT waiver_receipts_hash_format CHECK (receipt_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX waiver_receipts_student_case_idx
  ON lor_studio.waiver_receipts (student_auth_subject, student_auth_uid, case_id, recorded_at DESC);
CREATE INDEX waiver_receipts_case_fk_idx
  ON lor_studio.waiver_receipts
  (case_id, student_auth_subject, case_revision, student_auth_uid);
CREATE INDEX waiver_receipts_prior_receipt_idx
  ON lor_studio.waiver_receipts (prior_receipt_id, case_id, student_auth_subject)
  WHERE prior_receipt_id IS NOT NULL;
CREATE UNIQUE INDEX waiver_receipts_single_successor_idx
  ON lor_studio.waiver_receipts (prior_receipt_id)
  WHERE prior_receipt_id IS NOT NULL;
CREATE UNIQUE INDEX waiver_receipts_single_root_per_case_idx
  ON lor_studio.waiver_receipts (case_id, student_auth_subject)
  WHERE prior_receipt_id IS NULL;

ALTER TABLE lor_studio.recommendation_cases
  ADD CONSTRAINT recommendation_cases_release_waiver_fk
  FOREIGN KEY (
    release_waiver_receipt_id,
    case_id,
    student_auth_subject,
    release_waiver_allows_student_view
  )
  REFERENCES lor_studio.waiver_receipts (
    receipt_id,
    case_id,
    student_auth_subject,
    waived
  );

CREATE TABLE lor_studio.faculty_private_content (
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  faculty_auth_subject text NOT NULL,
  faculty_auth_uid uuid NOT NULL,
  invitation_id text NOT NULL,
  private_revision bigint NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  draft_text text,
  final_document_id text,
  final_document_text text,
  final_document_content_hash text,
  final_document_mime_type text,
  document_state text,
  approval_approved boolean,
  approval_at timestamptz,
  approval_faculty_auth_subject text,
  approval_signature_attested boolean,
  release_document_hash text,
  release_document_id text,
  released_at timestamptz,
  released_at_revision bigint,
  release_waiver_receipt_id text,
  release_waiver_allows_student_view boolean GENERATED ALWAYS AS (
    CASE WHEN release_waiver_receipt_id IS NULL THEN NULL ELSE false END
  ) STORED,
  private_record_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT faculty_private_content_pk PRIMARY KEY (case_id, student_auth_subject),
  CONSTRAINT faculty_private_content_exact_identity_unique
    UNIQUE (case_id, student_auth_subject, faculty_auth_subject, faculty_auth_uid),
  CONSTRAINT faculty_private_content_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT faculty_private_content_invitation_fk
    FOREIGN KEY (
      invitation_id, case_id, student_auth_subject, faculty_auth_subject, faculty_auth_uid
    )
    REFERENCES lor_studio.faculty_invitations (
      invitation_id, case_id, student_auth_subject, faculty_auth_subject, faculty_auth_uid
    ),
  CONSTRAINT faculty_private_content_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT faculty_private_content_faculty_subject_format CHECK (faculty_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT faculty_private_content_revision_nonnegative CHECK (private_revision >= 0),
  CONSTRAINT faculty_private_content_array_shapes CHECK (
    pg_catalog.jsonb_typeof(answers) = 'array'
    AND pg_catalog.jsonb_typeof(notes) = 'array'
    AND pg_catalog.jsonb_array_length(answers) <= 500
    AND pg_catalog.jsonb_array_length(notes) <= 500
    AND pg_catalog.octet_length(answers::text) <= 1048576
    AND pg_catalog.octet_length(notes::text) <= 1048576
  ),
  CONSTRAINT faculty_private_content_draft_text_bound CHECK (
    draft_text IS NULL OR pg_catalog.octet_length(draft_text) <= 256000
  ),
  CONSTRAINT faculty_private_content_final_document_shape CHECK (
    (
      final_document_id IS NULL
      AND final_document_text IS NULL
      AND final_document_content_hash IS NULL
      AND final_document_mime_type IS NULL
    )
    OR
    (
      final_document_id IS NOT NULL
      AND final_document_text IS NOT NULL
      AND pg_catalog.octet_length(final_document_text) BETWEEN 1 AND 256000
      AND (
        final_document_content_hash IS NULL
        OR final_document_content_hash ~ '^[a-f0-9]{64}$'
      )
      AND (
        final_document_mime_type IS NULL
        OR pg_catalog.length(final_document_mime_type) BETWEEN 1 AND 160
      )
    )
  ),
  CONSTRAINT faculty_private_content_document_state_known CHECK (
    document_state IS NULL OR document_state IN ('ai_proposal', 'faculty_final')
  ),
  CONSTRAINT faculty_private_content_approval_shape CHECK (
    (
      approval_approved IS NULL
      AND approval_at IS NULL
      AND approval_faculty_auth_subject IS NULL
      AND approval_signature_attested IS NULL
    )
    OR
    (
      approval_approved IS NOT NULL
      AND approval_at IS NOT NULL
      AND approval_faculty_auth_subject IS NOT NULL
      AND approval_faculty_auth_subject = faculty_auth_subject
      AND approval_signature_attested IS NOT NULL
      AND final_document_id IS NOT NULL
    )
  ),
  CONSTRAINT faculty_private_content_release_shape CHECK (
    (
      release_document_hash IS NULL
      AND release_document_id IS NULL
      AND released_at IS NULL
      AND released_at_revision IS NULL
      AND release_waiver_receipt_id IS NULL
    )
    OR
    (
      document_state = 'faculty_final'
      AND approval_approved IS TRUE
      AND approval_signature_attested IS TRUE
      AND approval_at IS NOT NULL
      AND release_document_hash IS NOT NULL
      AND release_document_id IS NOT NULL
      AND released_at IS NOT NULL
      AND released_at_revision IS NOT NULL
      AND release_waiver_receipt_id IS NOT NULL
      AND approval_at <= released_at
      AND release_document_hash = lor_studio.release_document_hash(
        final_document_content_hash,
        final_document_id,
        final_document_mime_type,
        final_document_text
      )
      AND release_document_id = final_document_id
      AND released_at_revision >= 0
    )
  ),
  CONSTRAINT faculty_private_content_waiver_fk
    FOREIGN KEY (
      release_waiver_receipt_id,
      case_id,
      student_auth_subject,
      release_waiver_allows_student_view
    )
    REFERENCES lor_studio.waiver_receipts (
      receipt_id,
      case_id,
      student_auth_subject,
      waived
    ),
  CONSTRAINT faculty_private_content_private_record_hash_format CHECK (private_record_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT faculty_private_content_time_order CHECK (updated_at >= created_at)
);

CREATE INDEX faculty_private_content_faculty_scope_idx
  ON lor_studio.faculty_private_content
  (faculty_auth_subject, faculty_auth_uid, invitation_id, case_id, student_auth_subject);
CREATE INDEX faculty_private_content_invitation_idx
  ON lor_studio.faculty_private_content (invitation_id, case_id, student_auth_subject);

CREATE TABLE lor_studio.released_student_documents (
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  final_document_id text NOT NULL,
  final_document_text text NOT NULL,
  final_document_content_hash text,
  final_document_mime_type text,
  approval_approved boolean NOT NULL,
  approval_at timestamptz NOT NULL,
  approval_faculty_ref text NOT NULL,
  approval_signature_attested boolean NOT NULL,
  release_document_id text NOT NULL,
  release_document_hash text NOT NULL,
  released_at timestamptz NOT NULL,
  released_at_revision bigint NOT NULL,
  waiver_receipt_id text NOT NULL,
  waiver_allows_student_view boolean GENERATED ALWAYS AS (false) STORED,
  snapshot_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT released_student_documents_pk PRIMARY KEY (case_id, student_auth_subject),
  CONSTRAINT released_student_documents_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT released_student_documents_waiver_fk
    FOREIGN KEY (waiver_receipt_id, case_id, student_auth_subject, waiver_allows_student_view)
    REFERENCES lor_studio.waiver_receipts (receipt_id, case_id, student_auth_subject, waived),
  CONSTRAINT released_student_documents_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT released_student_documents_text_bound CHECK (
    pg_catalog.length(final_document_id) BETWEEN 1 AND 200
    AND pg_catalog.octet_length(final_document_text) BETWEEN 1 AND 256000
    AND (
      final_document_mime_type IS NULL
      OR pg_catalog.length(final_document_mime_type) BETWEEN 1 AND 160
    )
  ),
  CONSTRAINT released_student_documents_hash_formats CHECK (
    (final_document_content_hash IS NULL OR final_document_content_hash ~ '^[a-f0-9]{64}$')
    AND release_document_hash ~ '^[a-f0-9]{64}$'
    AND snapshot_hash ~ '^[a-f0-9]{64}$'
    AND approval_faculty_ref ~ '^faculty_[a-f0-9]{64}$'
  ),
  CONSTRAINT released_student_documents_truthful_approval CHECK (
    approval_approved IS TRUE
    AND approval_signature_attested IS TRUE
    AND approval_at <= released_at
  ),
  CONSTRAINT released_student_documents_release_binding CHECK (
    final_document_id = release_document_id
    AND release_document_hash = lor_studio.release_document_hash(
      final_document_content_hash,
      final_document_id,
      final_document_mime_type,
      final_document_text
    )
    AND released_at_revision >= 0
  ),
  CONSTRAINT released_student_documents_time_order CHECK (created_at >= released_at)
);

CREATE INDEX released_student_documents_student_scope_idx
  ON lor_studio.released_student_documents (student_auth_subject, case_id);
CREATE UNIQUE INDEX released_student_documents_snapshot_hash_idx
  ON lor_studio.released_student_documents (snapshot_hash);
ALTER TABLE lor_studio.released_student_documents
  ADD CONSTRAINT released_student_documents_receipt_binding_unique
  UNIQUE (case_id, student_auth_subject, snapshot_hash);
ALTER TABLE lor_studio.released_student_documents
  ADD CONSTRAINT released_student_documents_artifact_binding_unique
  UNIQUE (
    case_id,
    student_auth_subject,
    snapshot_hash,
    final_document_id,
    final_document_content_hash
  );

ALTER TABLE lor_studio.recommendation_case_write_receipts
  ADD CONSTRAINT recommendation_case_write_receipts_released_snapshot_fk
  FOREIGN KEY (case_id, student_auth_subject, released_snapshot_hash)
  REFERENCES lor_studio.released_student_documents (
    case_id, student_auth_subject, snapshot_hash
  );

CREATE TABLE lor_studio.recommendation_case_private_write_receipts (
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  faculty_auth_subject text NOT NULL,
  faculty_auth_uid uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  command_type text NOT NULL,
  operation text NOT NULL,
  revision bigint NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  closed_at timestamptz,
  safe_record jsonb NOT NULL,
  private_record jsonb NOT NULL,
  private_record_hash text NOT NULL,
  safe_record_hash text NOT NULL,
  protected_state_hash text NOT NULL,
  released_snapshot_hash text,
  event_hash text NOT NULL,
  audit_event_ref text NOT NULL,
  transaction_id text NOT NULL,
  committed_at timestamptz NOT NULL,
  CONSTRAINT recommendation_case_private_write_receipts_pk
    PRIMARY KEY (case_id, student_auth_subject, idempotency_key),
  CONSTRAINT recommendation_case_private_write_receipts_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT recommendation_case_private_write_receipts_private_content_fk
    FOREIGN KEY (case_id, student_auth_subject, faculty_auth_subject, faculty_auth_uid)
    REFERENCES lor_studio.faculty_private_content (
      case_id, student_auth_subject, faculty_auth_subject, faculty_auth_uid
    ),
  CONSTRAINT recommendation_case_private_write_receipts_released_snapshot_fk
    FOREIGN KEY (case_id, student_auth_subject, released_snapshot_hash)
    REFERENCES lor_studio.released_student_documents (
      case_id, student_auth_subject, snapshot_hash
    ),
  CONSTRAINT recommendation_case_private_write_receipts_protected_state_fk
    FOREIGN KEY (case_id, student_auth_subject, revision, protected_state_hash)
    REFERENCES lor_studio.recommendation_case_protected_revision_states (
      case_id, student_auth_subject, revision, protected_state_hash
    ),
  CONSTRAINT recommendation_case_private_write_receipts_audit_fk
    FOREIGN KEY (
      audit_event_ref,
      case_id,
      student_auth_subject,
      revision,
      event_hash,
      transaction_id
    )
    REFERENCES lor_studio.recommendation_case_audit_events (
      event_ref,
      case_id,
      student_auth_subject,
      revision,
      event_hash,
      transaction_id
    ),
  CONSTRAINT recommendation_case_private_write_receipts_student_subject_format
    CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT recommendation_case_private_write_receipts_faculty_subject_format CHECK (faculty_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT recommendation_case_private_write_receipts_idempotency_key_nonempty CHECK (pg_catalog.length(idempotency_key) BETWEEN 1 AND 240),
  CONSTRAINT recommendation_case_private_write_receipts_hash_formats CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
    AND private_record_hash ~ '^[a-f0-9]{64}$'
    AND safe_record_hash ~ '^[a-f0-9]{64}$'
    AND protected_state_hash ~ '^[a-f0-9]{64}$'
    AND event_hash ~ '^[a-f0-9]{64}$'
    AND (released_snapshot_hash IS NULL OR released_snapshot_hash ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT recommendation_case_private_write_receipts_operation_known CHECK (operation = 'save'),
  CONSTRAINT recommendation_case_private_write_receipts_command_type_known CHECK (
    command_type = 'faculty.final_document_release'
  ),
  CONSTRAINT recommendation_case_private_write_receipts_revision_nonnegative CHECK (revision >= 0),
  CONSTRAINT recommendation_case_private_write_receipts_status_known CHECK (status IN (
    'draft', 'faculty_invited', 'faculty_verified', 'faculty_review',
    'faculty_approved', 'delivered', 'closed', 'cancelled'
  )),
  CONSTRAINT recommendation_case_private_write_receipts_time_order CHECK (
    updated_at >= created_at
    AND (closed_at IS NULL OR closed_at >= created_at)
    AND ((status = 'closed') = (closed_at IS NOT NULL))
  ),
  CONSTRAINT recommendation_case_private_write_receipts_safe_record
    CHECK (lor_studio.student_record_is_safe(safe_record)),
  CONSTRAINT recommendation_case_private_write_receipts_record_shape CHECK (lor_studio.private_record_is_complete(private_record)),
  CONSTRAINT recommendation_case_private_write_receipts_transaction_id_format CHECK (transaction_id ~ '^[0-9]+$')
);

CREATE INDEX recommendation_case_private_write_receipts_faculty_scope_idx
  ON lor_studio.recommendation_case_private_write_receipts
  (faculty_auth_subject, faculty_auth_uid, case_id, student_auth_subject, idempotency_key);
CREATE INDEX recommendation_case_private_write_receipts_audit_event_idx
  ON lor_studio.recommendation_case_private_write_receipts (audit_event_ref);

CREATE TABLE lor_studio.administrative_case_grants (
  grant_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  grantee_auth_subject text NOT NULL,
  grantee_auth_uid uuid NOT NULL,
  operation text NOT NULL,
  purpose text NOT NULL,
  privacy_authority text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  audit_event_ref text NOT NULL,
  grant_hash text NOT NULL,
  CONSTRAINT administrative_case_grants_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT administrative_case_grants_audit_fk
    FOREIGN KEY (audit_event_ref, case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_case_audit_events (event_ref, case_id, student_auth_subject),
  CONSTRAINT administrative_case_grants_case_identity_unique
    UNIQUE (grant_id, case_id, student_auth_subject),
  CONSTRAINT administrative_case_grants_exact_identity_unique
    UNIQUE (grant_id, case_id, student_auth_subject, grant_hash),
  CONSTRAINT administrative_case_grants_subject_format CHECK (
    grantee_auth_subject ~ '^wp:[1-9][0-9]*$' OR grantee_auth_subject ~ '^service:[A-Za-z0-9_.:-]{1,160}$'
  ),
  CONSTRAINT administrative_case_grants_id_format CHECK (
    grant_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
  ),
  CONSTRAINT administrative_case_grants_operation_known CHECK (operation IN (
    'export_case_for_privacy_request',
    'investigate_delivery_failure',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup',
    'release_deletion_legal_hold',
    'create_ai_generation',
    'read_operational_case_metadata',
    'emergency_operational_case_metadata_break_glass'
  )),
  CONSTRAINT administrative_case_grants_privacy_authority_format CHECK (
    privacy_authority ~ '^privacy-authority:[A-Za-z0-9_.:-]{1,120}$'
  ),
  CONSTRAINT administrative_case_grants_purpose_bound CHECK (
    pg_catalog.length(purpose) BETWEEN 1 AND 500
    AND purpose = pg_catalog.btrim(purpose)
  ),
  CONSTRAINT administrative_case_grants_time_order CHECK (expires_at > issued_at),
  CONSTRAINT administrative_case_grants_hash_format CHECK (grant_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX administrative_case_grants_active_scope_idx
  ON lor_studio.administrative_case_grants
  (grantee_auth_subject, grantee_auth_uid, grant_id, case_id, student_auth_subject, operation, purpose, expires_at);
CREATE INDEX administrative_case_grants_case_idx
  ON lor_studio.administrative_case_grants (case_id, student_auth_subject, grant_id);

CREATE TABLE lor_studio.administrative_case_grant_revocations (
  grant_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  grant_hash text NOT NULL,
  revoked_at timestamptz NOT NULL,
  revoked_by_authority text NOT NULL,
  reason_code text NOT NULL,
  audit_event_ref text NOT NULL,
  revocation_hash text NOT NULL,
  CONSTRAINT administrative_case_grant_revocations_grant_fk
    FOREIGN KEY (grant_id, case_id, student_auth_subject, grant_hash)
    REFERENCES lor_studio.administrative_case_grants (
      grant_id, case_id, student_auth_subject, grant_hash
    ),
  CONSTRAINT administrative_case_grant_revocations_audit_fk
    FOREIGN KEY (audit_event_ref, case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_case_audit_events (event_ref, case_id, student_auth_subject),
  CONSTRAINT administrative_case_grant_revocations_hash_formats CHECK (
    grant_hash ~ '^[a-f0-9]{64}$' AND revocation_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT administrative_case_grant_revocations_authority_format CHECK (
    revoked_by_authority ~ '^privacy-authority:[A-Za-z0-9_.:-]{1,120}$'
  ),
  CONSTRAINT administrative_case_grant_revocations_reason_format CHECK (
    reason_code ~ '^[A-Z0-9_:-]{1,120}$'
  )
);

CREATE INDEX administrative_case_grant_revocations_case_idx
  ON lor_studio.administrative_case_grant_revocations (case_id, student_auth_subject, grant_id);

CREATE TABLE lor_studio.mentor_case_assignments (
  assignment_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  mentor_auth_subject text NOT NULL,
  mentor_auth_uid uuid NOT NULL,
  operation text NOT NULL,
  purpose text NOT NULL,
  assigned_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  assignment_hash text NOT NULL,
  CONSTRAINT mentor_case_assignments_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT mentor_case_assignments_case_identity_unique
    UNIQUE (assignment_id, case_id, student_auth_subject),
  CONSTRAINT mentor_case_assignments_subject_format CHECK (mentor_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT mentor_case_assignments_id_format CHECK (
    assignment_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
  ),
  CONSTRAINT mentor_case_assignments_operation_known CHECK (operation = 'read'),
  CONSTRAINT mentor_case_assignments_time_order CHECK (expires_at > assigned_at),
  CONSTRAINT mentor_case_assignments_purpose_bound CHECK (
    pg_catalog.length(purpose) BETWEEN 1 AND 500
    AND purpose = pg_catalog.btrim(purpose)
  ),
  CONSTRAINT mentor_case_assignments_hash_format CHECK (assignment_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX mentor_case_assignments_active_scope_idx
  ON lor_studio.mentor_case_assignments
  (mentor_auth_subject, mentor_auth_uid, assignment_id, case_id, student_auth_subject, operation, purpose, expires_at);
CREATE INDEX mentor_case_assignments_case_idx
  ON lor_studio.mentor_case_assignments (case_id, student_auth_subject, assignment_id);

CREATE TABLE lor_studio.mentor_case_assignment_revocations (
  assignment_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  revoked_at timestamptz NOT NULL,
  revocation_hash text NOT NULL,
  CONSTRAINT mentor_case_assignment_revocations_assignment_fk
    FOREIGN KEY (assignment_id, case_id, student_auth_subject)
    REFERENCES lor_studio.mentor_case_assignments (assignment_id, case_id, student_auth_subject),
  CONSTRAINT mentor_case_assignment_revocations_hash_format CHECK (revocation_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX mentor_case_assignment_revocations_case_idx
  ON lor_studio.mentor_case_assignment_revocations (case_id, student_auth_subject, assignment_id);

CREATE TABLE lor_studio.writer_depot_artifacts (
  artifact_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  created_by_actor_ref text NOT NULL,
  artifact_kind text NOT NULL,
  storage_bucket text NOT NULL,
  private_object_key text NOT NULL,
  storage_version_id text NOT NULL,
  content_hash text NOT NULL,
  mime_type text NOT NULL,
  byte_length bigint NOT NULL,
  privacy_class text NOT NULL,
  released_snapshot_hash text,
  released_document_id text,
  encryption_profile text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT writer_depot_artifacts_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT writer_depot_artifacts_case_identity_unique
    UNIQUE (artifact_id, case_id, student_auth_subject),
  CONSTRAINT writer_depot_artifacts_version_identity_unique
    UNIQUE (artifact_id, case_id, student_auth_subject, storage_version_id),
  CONSTRAINT writer_depot_artifacts_id_format CHECK (artifact_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT writer_depot_artifacts_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT writer_depot_artifacts_actor_ref_format CHECK (created_by_actor_ref ~ '^actor_[a-f0-9]{64}$'),
  CONSTRAINT writer_depot_artifacts_kind_known CHECK (artifact_kind IN (
    'evidence_source', 'student_draft', 'faculty_draft', 'faculty_final', 'released_document'
  )),
  CONSTRAINT writer_depot_artifacts_private_location CHECK (
    storage_bucket = 'lor-writer-depot'
    AND pg_catalog.length(private_object_key) BETWEEN 1 AND 1024
    AND private_object_key !~ '(^/|(^|/)\.\.(/|$)|://)'
    AND pg_catalog.length(storage_version_id) BETWEEN 1 AND 512
  ),
  CONSTRAINT writer_depot_artifacts_hash_format CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT writer_depot_artifacts_size_bound CHECK (byte_length BETWEEN 1 AND 52428800),
  CONSTRAINT writer_depot_artifacts_privacy_known CHECK (privacy_class IN (
    'student_private', 'faculty_private', 'waived_faculty_private', 'nonwaived_student_visible'
  )),
  CONSTRAINT writer_depot_artifacts_kind_privacy_binding CHECK (
    (artifact_kind IN ('evidence_source', 'student_draft') AND privacy_class = 'student_private')
    OR (artifact_kind = 'faculty_draft' AND privacy_class = 'faculty_private')
    OR (
      artifact_kind = 'faculty_final'
      AND privacy_class IN ('faculty_private', 'waived_faculty_private')
    )
    OR (artifact_kind = 'released_document' AND privacy_class = 'nonwaived_student_visible')
  ),
  CONSTRAINT writer_depot_artifacts_released_shape CHECK (
    (
      artifact_kind <> 'released_document'
      AND released_snapshot_hash IS NULL
      AND released_document_id IS NULL
    )
    OR
    (
      artifact_kind = 'released_document'
      AND released_snapshot_hash IS NOT NULL
      AND released_snapshot_hash ~ '^[a-f0-9]{64}$'
      AND released_document_id IS NOT NULL
    )
  ),
  CONSTRAINT writer_depot_artifacts_released_snapshot_fk
    FOREIGN KEY (
      case_id,
      student_auth_subject,
      released_snapshot_hash,
      released_document_id,
      content_hash
    )
    REFERENCES lor_studio.released_student_documents (
      case_id,
      student_auth_subject,
      snapshot_hash,
      final_document_id,
      final_document_content_hash
    ),
  CONSTRAINT writer_depot_artifacts_encryption_profile_nonempty
    CHECK (pg_catalog.length(encryption_profile) BETWEEN 1 AND 160)
);

CREATE INDEX writer_depot_artifacts_case_idx
  ON lor_studio.writer_depot_artifacts (case_id, student_auth_subject, artifact_id);
CREATE INDEX writer_depot_artifacts_privacy_idx
  ON lor_studio.writer_depot_artifacts (privacy_class, case_id, student_auth_subject, created_at);

CREATE TABLE lor_studio.ai_generation_runs (
  run_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  requested_by_actor_ref text NOT NULL,
  provider_kind text NOT NULL,
  provider_configuration_hash text NOT NULL,
  input_hash text NOT NULL,
  grounding_manifest_hash text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  error_code text,
  run_hash text NOT NULL,
  CONSTRAINT ai_generation_runs_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT ai_generation_runs_case_identity_unique UNIQUE (run_id, case_id, student_auth_subject),
  CONSTRAINT ai_generation_runs_id_format CHECK (run_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT ai_generation_runs_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT ai_generation_runs_actor_ref_format CHECK (requested_by_actor_ref ~ '^actor_[a-f0-9]{64}$'),
  CONSTRAINT ai_generation_runs_provider_known CHECK (provider_kind IN ('deterministic_test', 'configured_external')),
  CONSTRAINT ai_generation_runs_hash_formats CHECK (
    provider_configuration_hash ~ '^[a-f0-9]{64}$'
    AND input_hash ~ '^[a-f0-9]{64}$'
    AND grounding_manifest_hash ~ '^[a-f0-9]{64}$'
    AND run_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT ai_generation_runs_status_known CHECK (status IN ('succeeded', 'failed', 'cancelled')),
  CONSTRAINT ai_generation_runs_time_order CHECK (completed_at >= started_at),
  CONSTRAINT ai_generation_runs_error_shape CHECK (
    (
      status = 'failed'
      AND error_code IS NOT NULL
      AND error_code ~ '^[A-Z][A-Z0-9_]{1,99}$'
    )
    OR (status <> 'failed' AND error_code IS NULL)
  )
);

CREATE INDEX ai_generation_runs_case_idx
  ON lor_studio.ai_generation_runs (case_id, student_auth_subject, run_id, completed_at);

CREATE TABLE lor_studio.ai_letter_proposals (
  proposal_id text PRIMARY KEY,
  run_id text NOT NULL,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  proposal_text text NOT NULL,
  proposal_output_hash text NOT NULL,
  grounding_manifest jsonb NOT NULL,
  grounding_manifest_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT ai_letter_proposals_run_fk
    FOREIGN KEY (run_id, case_id, student_auth_subject)
    REFERENCES lor_studio.ai_generation_runs (run_id, case_id, student_auth_subject),
  CONSTRAINT ai_letter_proposals_case_identity_unique
    UNIQUE (proposal_id, case_id, student_auth_subject),
  CONSTRAINT ai_letter_proposals_run_once UNIQUE (run_id),
  CONSTRAINT ai_letter_proposals_output_identity_unique
    UNIQUE (proposal_id, case_id, student_auth_subject, proposal_output_hash),
  CONSTRAINT ai_letter_proposals_idempotency_unique
    UNIQUE (case_id, student_auth_subject, idempotency_key),
  CONSTRAINT ai_letter_proposals_id_format CHECK (proposal_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT ai_letter_proposals_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT ai_letter_proposals_text_bound CHECK (pg_catalog.octet_length(proposal_text) BETWEEN 1 AND 256000),
  CONSTRAINT ai_letter_proposals_hash_formats CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
    AND proposal_output_hash ~ '^[a-f0-9]{64}$'
    AND grounding_manifest_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT ai_letter_proposals_idempotency_nonempty CHECK (
    pg_catalog.length(idempotency_key) BETWEEN 1 AND 240
  ),
  CONSTRAINT ai_letter_proposals_grounding_shape CHECK (
    lor_studio.ai_grounding_manifest_is_complete(grounding_manifest)
  )
);

CREATE INDEX ai_letter_proposals_run_idx
  ON lor_studio.ai_letter_proposals (run_id, case_id, student_auth_subject);
CREATE INDEX ai_letter_proposals_case_idx
  ON lor_studio.ai_letter_proposals (case_id, student_auth_subject, proposal_id);

CREATE TABLE lor_studio.ai_proposal_decisions (
  decision_id text PRIMARY KEY,
  proposal_id text NOT NULL,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  faculty_auth_subject text NOT NULL,
  faculty_auth_uid uuid NOT NULL,
  invitation_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  action text NOT NULL,
  proposal_output_hash text NOT NULL,
  proposal_text text NOT NULL,
  resulting_text_hash text,
  accepted_content_origin text,
  accepted_content_text text,
  accepted_content_hash text,
  accepted_support_ids text[],
  accepted_grounding_attestation_hash text,
  grounded_as_attested boolean,
  reason_code text,
  decided_at timestamptz NOT NULL,
  decision_hash text NOT NULL,
  CONSTRAINT ai_proposal_decisions_proposal_fk
    FOREIGN KEY (proposal_id, case_id, student_auth_subject, proposal_output_hash)
    REFERENCES lor_studio.ai_letter_proposals (
      proposal_id, case_id, student_auth_subject, proposal_output_hash
    ),
  CONSTRAINT ai_proposal_decisions_invitation_fk
    FOREIGN KEY (
      invitation_id, case_id, student_auth_subject, faculty_auth_subject, faculty_auth_uid
    )
    REFERENCES lor_studio.faculty_invitations (
      invitation_id, case_id, student_auth_subject, faculty_auth_subject, faculty_auth_uid
    ),
  CONSTRAINT ai_proposal_decisions_id_format CHECK (decision_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT ai_proposal_decisions_proposal_once UNIQUE (proposal_id),
  CONSTRAINT ai_proposal_decisions_idempotency_unique UNIQUE (proposal_id, idempotency_key),
  CONSTRAINT ai_proposal_decisions_idempotency_nonempty CHECK (
    pg_catalog.length(idempotency_key) BETWEEN 1 AND 240
  ),
  CONSTRAINT ai_proposal_decisions_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT ai_proposal_decisions_faculty_subject_format CHECK (faculty_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT ai_proposal_decisions_action_known CHECK (action IN ('accepted', 'edited', 'rejected')),
  CONSTRAINT ai_proposal_decisions_hash_formats CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
    AND proposal_output_hash ~ '^[a-f0-9]{64}$'
    AND (resulting_text_hash IS NULL OR resulting_text_hash ~ '^[a-f0-9]{64}$')
    AND (accepted_content_hash IS NULL OR accepted_content_hash ~ '^[a-f0-9]{64}$')
    AND (
      accepted_grounding_attestation_hash IS NULL
      OR accepted_grounding_attestation_hash ~ '^[a-f0-9]{64}$'
    )
    AND decision_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT ai_proposal_decisions_accepted_content_shape CHECK (
    (
      action = 'rejected'
      AND resulting_text_hash IS NULL
      AND accepted_content_origin IS NULL
      AND accepted_content_text IS NULL
      AND accepted_content_hash IS NULL
      AND accepted_support_ids IS NULL
      AND accepted_grounding_attestation_hash IS NULL
      AND grounded_as_attested IS NULL
    )
    OR
    (
      action = 'accepted'
      AND resulting_text_hash IS NOT NULL
      AND resulting_text_hash = proposal_output_hash
      AND accepted_content_origin = 'ai_proposal_accepted'
      AND accepted_content_text IS NOT NULL
      AND accepted_content_text = proposal_text
      AND pg_catalog.octet_length(accepted_content_text) BETWEEN 1 AND 256000
      AND accepted_content_hash IS NOT NULL
      AND accepted_content_hash = resulting_text_hash
      AND accepted_support_ids IS NOT NULL
      AND lor_studio.text_array_is_sorted_unique(accepted_support_ids)
      AND accepted_grounding_attestation_hash IS NOT NULL
      AND grounded_as_attested IS TRUE
    )
    OR
    (
      action = 'edited'
      AND resulting_text_hash IS NOT NULL
      AND accepted_content_origin = 'human_edited'
      AND accepted_content_text IS NOT NULL
      AND pg_catalog.octet_length(accepted_content_text) BETWEEN 1 AND 256000
      AND accepted_content_hash IS NOT NULL
      AND accepted_content_hash = resulting_text_hash
      AND accepted_support_ids IS NOT NULL
      AND lor_studio.text_array_is_sorted_unique(accepted_support_ids)
      AND accepted_grounding_attestation_hash IS NOT NULL
      AND grounded_as_attested IS FALSE
    )
  ),
  CONSTRAINT ai_proposal_decisions_reason_shape CHECK (
    reason_code IS NULL OR reason_code ~ '^[A-Z][A-Z0-9_]{1,99}$'
  ),
  CONSTRAINT ai_proposal_decisions_decision_hash_format CHECK (decision_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX ai_proposal_decisions_proposal_idx
  ON lor_studio.ai_proposal_decisions (proposal_id, case_id, student_auth_subject);
CREATE INDEX ai_proposal_decisions_faculty_scope_idx
  ON lor_studio.ai_proposal_decisions
  (faculty_auth_subject, faculty_auth_uid, invitation_id, case_id, student_auth_subject);

CREATE TABLE lor_studio.deletion_intents (
  intent_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  requested_by_actor_ref text NOT NULL,
  deletion_scope text NOT NULL,
  reason_code text NOT NULL,
  legal_hold boolean NOT NULL,
  requested_at timestamptz NOT NULL,
  due_by timestamptz NOT NULL,
  intent_hash text NOT NULL,
  CONSTRAINT deletion_intents_case_fk
    FOREIGN KEY (case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_cases (case_id, student_auth_subject),
  CONSTRAINT deletion_intents_case_identity_unique UNIQUE (intent_id, case_id, student_auth_subject),
  CONSTRAINT deletion_intents_id_format CHECK (intent_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT deletion_intents_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT deletion_intents_actor_ref_format CHECK (requested_by_actor_ref ~ '^actor_[a-f0-9]{64}$'),
  CONSTRAINT deletion_intents_scope_known CHECK (deletion_scope IN ('artifact', 'case_private_content', 'case_all')),
  CONSTRAINT deletion_intents_reason_format CHECK (reason_code ~ '^[A-Z][A-Z0-9_]{1,99}$'),
  CONSTRAINT deletion_intents_time_order CHECK (due_by >= requested_at),
  CONSTRAINT deletion_intents_hash_format CHECK (intent_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX deletion_intents_case_idx
  ON lor_studio.deletion_intents (case_id, student_auth_subject, intent_id, due_by);

CREATE TABLE lor_studio.deletion_hold_releases (
  intent_id text PRIMARY KEY,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  released_at timestamptz NOT NULL,
  released_by_authority text NOT NULL,
  audit_event_ref text NOT NULL,
  release_hash text NOT NULL,
  CONSTRAINT deletion_hold_releases_intent_fk
    FOREIGN KEY (intent_id, case_id, student_auth_subject)
    REFERENCES lor_studio.deletion_intents (intent_id, case_id, student_auth_subject),
  CONSTRAINT deletion_hold_releases_audit_fk
    FOREIGN KEY (audit_event_ref, case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_case_audit_events (event_ref, case_id, student_auth_subject),
  CONSTRAINT deletion_hold_releases_audit_exactly_once UNIQUE (audit_event_ref),
  CONSTRAINT deletion_hold_releases_authority_format CHECK (
    released_by_authority ~ '^privacy-authority:[A-Za-z0-9_.:-]{1,120}$'
  ),
  CONSTRAINT deletion_hold_releases_hash_format CHECK (release_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX deletion_hold_releases_case_idx
  ON lor_studio.deletion_hold_releases (case_id, student_auth_subject, intent_id);

CREATE TABLE lor_studio.deletion_receipts (
  receipt_id text PRIMARY KEY,
  intent_id text NOT NULL,
  deletion_scope text NOT NULL,
  artifact_id text,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  storage_version_id text,
  verifier_ref text NOT NULL,
  deleted_at timestamptz NOT NULL,
  deletion_hash text NOT NULL,
  CONSTRAINT deletion_receipts_intent_fk
    FOREIGN KEY (intent_id, case_id, student_auth_subject)
    REFERENCES lor_studio.deletion_intents (intent_id, case_id, student_auth_subject),
  CONSTRAINT deletion_receipts_artifact_fk
    FOREIGN KEY (artifact_id, case_id, student_auth_subject, storage_version_id)
    REFERENCES lor_studio.writer_depot_artifacts (
      artifact_id, case_id, student_auth_subject, storage_version_id
    ),
  CONSTRAINT deletion_receipts_scope_shape CHECK (
    (
      deletion_scope = 'artifact'
      AND artifact_id IS NOT NULL
      AND storage_version_id IS NOT NULL
    )
    OR
    (
      deletion_scope IN ('case_private_content', 'case_all')
      AND artifact_id IS NULL
      AND storage_version_id IS NULL
    )
  ),
  CONSTRAINT deletion_receipts_id_format CHECK (receipt_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'),
  CONSTRAINT deletion_receipts_student_subject_format CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$'),
  CONSTRAINT deletion_receipts_verifier_ref_format CHECK (verifier_ref ~ '^verifier_[a-f0-9]{64}$'),
  CONSTRAINT deletion_receipts_hash_format CHECK (deletion_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT deletion_receipts_artifact_once UNIQUE (intent_id, artifact_id, storage_version_id)
);

CREATE INDEX deletion_receipts_intent_idx
  ON lor_studio.deletion_receipts (intent_id, case_id, student_auth_subject);
CREATE INDEX deletion_receipts_artifact_idx
  ON lor_studio.deletion_receipts (artifact_id, case_id, student_auth_subject, storage_version_id);

CREATE FUNCTION lor_studio.enforce_faculty_otp_challenge_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.faculty_invitations AS invitation
    WHERE invitation.invitation_id = NEW.invitation_id
      AND invitation.case_id = NEW.case_id
      AND invitation.student_auth_subject = NEW.student_auth_subject
      AND invitation.recipient_email_hash = NEW.recipient_email_hash
      AND invitation.used_at IS NULL
      AND invitation.revoked_at IS NULL
      AND NEW.issued_at >= invitation.created_at
      AND NEW.issued_at < invitation.expires_at
      AND NEW.expires_at <= invitation.expires_at
  ) THEN
    RAISE EXCEPTION 'OTP challenge is not bound to an active recipient invitation window'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_faculty_otp_verification_receipt_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.faculty_otp_challenges AS challenge
    JOIN lor_studio.faculty_invitations AS invitation
      ON invitation.invitation_id = challenge.invitation_id
     AND invitation.case_id = challenge.case_id
     AND invitation.student_auth_subject = challenge.student_auth_subject
     AND invitation.recipient_email_hash = challenge.recipient_email_hash
    WHERE challenge.challenge_id = NEW.challenge_id
      AND challenge.invitation_id = NEW.invitation_id
      AND challenge.case_id = NEW.case_id
      AND challenge.student_auth_subject = NEW.student_auth_subject
      AND challenge.recipient_email_hash = NEW.recipient_email_hash
      AND invitation.faculty_auth_subject = NEW.faculty_auth_subject
      AND invitation.faculty_auth_uid = NEW.faculty_auth_uid
      AND invitation.used_at = NEW.invitation_used_at
      AND invitation.revoked_at IS NULL
      AND NEW.otp_verified_at >= challenge.issued_at
      AND NEW.otp_verified_at < challenge.expires_at
      AND NEW.otp_expires_at = challenge.expires_at
      AND NEW.invitation_used_at < challenge.expires_at
      AND NOT EXISTS (
        SELECT 1
        FROM lor_studio.faculty_otp_challenge_revocations AS revocation
        WHERE revocation.challenge_id = challenge.challenge_id
      )
  ) THEN
    RAISE EXCEPTION 'OTP verification receipt is not bound to the exact live challenge and invitation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_ai_generation_run_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF pg_catalog.current_setting('lor_studio.actor_role', true) IS DISTINCT FROM 'service'
     OR pg_catalog.current_setting('lor_studio.action', true) IS DISTINCT FROM
       'ai.provider_run.create'
     OR pg_catalog.current_setting('lor_studio.operation', true) IS DISTINCT FROM 'save'
     OR pg_catalog.current_setting('lor_studio.purpose', true) IS DISTINCT FROM 'ai_generation'
     OR pg_catalog.current_setting('transaction_isolation', true) IS DISTINCT FROM 'read committed'
     OR pg_catalog.current_setting('lor_studio.case_id', true) IS DISTINCT FROM NEW.case_id
     OR pg_catalog.current_setting('lor_studio.resource_student_id', true) IS DISTINCT FROM
       NEW.student_auth_subject
     OR NEW.requested_by_actor_ref IS DISTINCT FROM 'actor_' || pg_catalog.encode(
       pg_catalog.sha256(pg_catalog.convert_to(
         'lor-studio:actor:' || pg_catalog.current_setting(
           'lor_studio.student_auth_subject', true
         ),
         'UTF8'
       )),
       'hex'
     )
     OR NEW.started_at > pg_catalog.statement_timestamp()
     OR NEW.completed_at > pg_catalog.statement_timestamp() THEN
    RAISE EXCEPTION 'AI provider runs require the exact trusted-service generation action'
      USING ERRCODE = '42501';
  END IF;

  -- These trigger functions are VOLATILE. Under the required READ COMMITTED
  -- isolation level, the case query after this blocking call obtains a fresh
  -- snapshot and therefore observes a concurrent release that won the lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1', NEW.case_id, NEW.student_auth_subject
    )::text,
    0
  ));

  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = NEW.case_id
      AND recommendation_case.student_auth_subject = NEW.student_auth_subject
      AND recommendation_case.status NOT IN ('delivered', 'closed', 'cancelled')
      AND recommendation_case.released_at IS NULL
      AND recommendation_case.release_document_id IS NULL
      AND recommendation_case.release_document_hash IS NULL
      AND recommendation_case.released_at_revision IS NULL
      AND recommendation_case.release_waiver_receipt_id IS NULL
  ) THEN
    RAISE EXCEPTION 'AI provider runs require the exact trusted-service generation action'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_ai_letter_proposal_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  provider_run_status text;
  provider_run_manifest_hash text;
  provider_run_completed_at timestamptz;
BEGIN
  IF pg_catalog.current_setting('lor_studio.actor_role', true) IS DISTINCT FROM 'service'
     OR pg_catalog.current_setting('lor_studio.action', true) IS DISTINCT FROM
       'ai.letter_proposal.create'
     OR pg_catalog.current_setting('lor_studio.operation', true) IS DISTINCT FROM 'save'
     OR pg_catalog.current_setting('lor_studio.purpose', true) IS DISTINCT FROM 'ai_generation'
     OR pg_catalog.current_setting('transaction_isolation', true) IS DISTINCT FROM 'read committed'
     OR pg_catalog.current_setting('lor_studio.case_id', true) IS DISTINCT FROM NEW.case_id
     OR pg_catalog.current_setting('lor_studio.resource_student_id', true) IS DISTINCT FROM
       NEW.student_auth_subject
     OR NEW.grounding_manifest_hash IS DISTINCT FROM
       NEW.grounding_manifest ->> 'attestationHash' THEN
    RAISE EXCEPTION 'AI proposals require the exact trusted-service grounded-proposal action'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.proposal_output_hash IS DISTINCT FROM pg_catalog.encode(
       pg_catalog.sha256(pg_catalog.convert_to(NEW.proposal_text, 'UTF8')),
       'hex'
     ) THEN
    RAISE EXCEPTION 'AI proposal output hash does not bind the exact proposal wording'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1', NEW.case_id, NEW.student_auth_subject
    )::text,
    0
  ));

  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = NEW.case_id
      AND recommendation_case.student_auth_subject = NEW.student_auth_subject
      AND recommendation_case.status NOT IN ('delivered', 'closed', 'cancelled')
      AND recommendation_case.released_at IS NULL
      AND recommendation_case.release_document_id IS NULL
      AND recommendation_case.release_document_hash IS NULL
      AND recommendation_case.released_at_revision IS NULL
      AND recommendation_case.release_waiver_receipt_id IS NULL
  ) THEN
    RAISE EXCEPTION 'AI proposals are closed after delivery or terminal case state'
      USING ERRCODE = '42501';
  END IF;

  SELECT
      provider_run.status,
      provider_run.grounding_manifest_hash,
      provider_run.completed_at
    INTO
      provider_run_status,
      provider_run_manifest_hash,
      provider_run_completed_at
  FROM lor_studio.ai_generation_runs AS provider_run
  WHERE provider_run.run_id = NEW.run_id
    AND provider_run.case_id = NEW.case_id
    AND provider_run.student_auth_subject = NEW.student_auth_subject;

  IF NOT FOUND
     OR provider_run_status IS DISTINCT FROM 'succeeded'
     OR provider_run_manifest_hash IS DISTINCT FROM NEW.grounding_manifest_hash
     OR NEW.created_at < provider_run_completed_at
     OR NEW.created_at > pg_catalog.statement_timestamp() THEN
    RAISE EXCEPTION 'AI proposal requires the exact completed successful provider run and grounding manifest'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_ai_proposal_decision_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  stored_grounding_manifest jsonb;
  stored_support_ids text[];
BEGIN
  IF NEW.proposal_output_hash IS DISTINCT FROM pg_catalog.encode(
       pg_catalog.sha256(pg_catalog.convert_to(NEW.proposal_text, 'UTF8')),
       'hex'
     )
     OR (
       NEW.action IN ('accepted', 'edited')
       AND (
         NEW.resulting_text_hash IS DISTINCT FROM pg_catalog.encode(
           pg_catalog.sha256(pg_catalog.convert_to(NEW.accepted_content_text, 'UTF8')),
           'hex'
         )
         OR NEW.accepted_content_hash IS DISTINCT FROM pg_catalog.encode(
           pg_catalog.sha256(pg_catalog.convert_to(NEW.accepted_content_text, 'UTF8')),
           'hex'
         )
       )
     ) THEN
    RAISE EXCEPTION 'AI decision hashes do not bind the exact proposal and resulting wording'
      USING ERRCODE = '23514';
  END IF;

  SELECT proposal.grounding_manifest
    INTO stored_grounding_manifest
  FROM lor_studio.ai_letter_proposals AS proposal
  WHERE proposal.proposal_id = NEW.proposal_id
    AND proposal.case_id = NEW.case_id
    AND proposal.student_auth_subject = NEW.student_auth_subject
    AND proposal.proposal_output_hash = NEW.proposal_output_hash
    AND proposal.proposal_text = NEW.proposal_text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI decision does not bind the exact stored proposal output'
      USING ERRCODE = '23514';
  END IF;

  SELECT ARRAY(
    SELECT support_values.value
    FROM pg_catalog.jsonb_array_elements_text(
      stored_grounding_manifest -> 'supportIds'
    ) AS support_values(value)
    ORDER BY support_values.value
  ) INTO stored_support_ids;

  IF NEW.action IN ('accepted', 'edited') AND (
    NEW.accepted_support_ids IS DISTINCT FROM stored_support_ids
    OR NEW.accepted_grounding_attestation_hash IS DISTINCT FROM
      stored_grounding_manifest ->> 'attestationHash'
    OR NEW.grounded_as_attested IS DISTINCT FROM (NEW.action = 'accepted')
  ) THEN
    RAISE EXCEPTION 'AI decision grounding does not bind the stored proposal manifest'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_deletion_intent_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Serialize every case transition without granting an operational actor
  -- SELECT access to the case's student content.  The exact same case-scoped
  -- advisory lock is acquired by the student command and faculty release
  -- paths before either can mutate protected state.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1', NEW.case_id, NEW.student_auth_subject
    )::text,
    0
  ));

  PERFORM 1
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = NEW.case_id
    AND recommendation_case.student_auth_subject = NEW.student_auth_subject
  ;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deletion intent case does not exist'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.legal_hold IS NOT TRUE THEN
    RAISE EXCEPTION 'deletion intent must enter the serialized legal-hold workflow'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.requested_by_actor_ref IS DISTINCT FROM 'actor_' || pg_catalog.encode(
       pg_catalog.sha256(pg_catalog.convert_to(
         'lor-studio:actor:' || pg_catalog.current_setting(
           'lor_studio.student_auth_subject', true
         ),
         'UTF8'
       )),
       'hex'
     )
     OR NEW.requested_at > pg_catalog.statement_timestamp() THEN
    RAISE EXCEPTION 'deletion intent principal or request time is not trusted'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_deletion_hold_release_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  intent_requested_at timestamptz;
  intent_has_legal_hold boolean;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1', NEW.case_id, NEW.student_auth_subject
    )::text,
    0
  ));

  SELECT deletion_intent.requested_at, deletion_intent.legal_hold
    INTO intent_requested_at, intent_has_legal_hold
  FROM lor_studio.deletion_intents AS deletion_intent
  WHERE deletion_intent.intent_id = NEW.intent_id
    AND deletion_intent.case_id = NEW.case_id
    AND deletion_intent.student_auth_subject = NEW.student_auth_subject
  ;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'legal-hold release is not bound to an exact deletion intent'
      USING ERRCODE = '23503';
  END IF;

  IF intent_has_legal_hold IS NOT TRUE OR NEW.released_at < intent_requested_at THEN
    RAISE EXCEPTION 'legal-hold release is not a truthful held-intent transition'
      USING ERRCODE = '23514';
  END IF;

  IF pg_catalog.current_setting('lor_studio.actor_role', true) <> ALL (
       ARRAY['admin', 'founder', 'support', 'service']::text[]
     )
     OR pg_catalog.current_setting('lor_studio.operation', true) IS DISTINCT FROM 'save'
     OR NOT EXISTS (
       SELECT 1
       FROM lor_studio.administrative_case_grants AS administrative_grant
       WHERE administrative_grant.grant_id = NULLIF(
           pg_catalog.current_setting('lor_studio.administrative_grant_id', true), ''
         )
         AND administrative_grant.case_id = NEW.case_id
         AND administrative_grant.student_auth_subject = NEW.student_auth_subject
         AND administrative_grant.grantee_auth_subject = pg_catalog.current_setting(
           'lor_studio.student_auth_subject', true
         )
         AND administrative_grant.grantee_auth_uid = NULLIF(
           pg_catalog.current_setting('request.jwt.claim.sub', true), ''
         )::uuid
         AND administrative_grant.operation = 'release_deletion_legal_hold'
         AND administrative_grant.purpose = pg_catalog.current_setting(
           'lor_studio.purpose', true
         )
         AND administrative_grant.privacy_authority = NEW.released_by_authority
         AND administrative_grant.issued_at <= NEW.released_at
         AND administrative_grant.expires_at > NEW.released_at
         AND NOT EXISTS (
           SELECT 1
           FROM lor_studio.administrative_case_grant_revocations AS revocation
           WHERE revocation.grant_id = administrative_grant.grant_id
             AND revocation.case_id = administrative_grant.case_id
             AND revocation.student_auth_subject = administrative_grant.student_auth_subject
             AND revocation.grant_hash = administrative_grant.grant_hash
         )
     ) THEN
    RAISE EXCEPTION 'legal-hold release lacks exact active privacy authority'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_case_audit_events AS audit_event
    WHERE audit_event.event_ref = NEW.audit_event_ref
      AND audit_event.case_id = NEW.case_id
      AND audit_event.student_auth_subject = NEW.student_auth_subject
      AND audit_event.event_type = 'deletion.hold_released'
      AND audit_event.actor_role = pg_catalog.current_setting(
        'lor_studio.actor_role', true
      )
      AND audit_event.occurred_at = NEW.released_at
      AND audit_event.transaction_id = pg_catalog.pg_current_xact_id()::text
  ) THEN
    RAISE EXCEPTION 'legal-hold release lacks same-transaction audit authority'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_deletion_receipt_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  intent_has_legal_hold boolean;
  intent_requested_at timestamptz;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1', NEW.case_id, NEW.student_auth_subject
    )::text,
    0
  ));

  SELECT deletion_intent.legal_hold, deletion_intent.requested_at
    INTO intent_has_legal_hold, intent_requested_at
  FROM lor_studio.deletion_intents AS deletion_intent
  WHERE deletion_intent.intent_id = NEW.intent_id
    AND deletion_intent.case_id = NEW.case_id
    AND deletion_intent.student_auth_subject = NEW.student_auth_subject
    AND deletion_intent.deletion_scope = NEW.deletion_scope
  ;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deletion receipt is not bound to its exact intent'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.deleted_at < intent_requested_at THEN
    RAISE EXCEPTION 'deletion receipt cannot predate its intent'
      USING ERRCODE = '23514';
  END IF;

  IF intent_has_legal_hold AND NOT EXISTS (
    SELECT 1
    FROM lor_studio.deletion_hold_releases AS hold_release
    WHERE hold_release.intent_id = NEW.intent_id
      AND hold_release.case_id = NEW.case_id
      AND hold_release.student_auth_subject = NEW.student_auth_subject
      AND hold_release.released_at <= NEW.deleted_at
  ) THEN
    RAISE EXCEPTION 'deletion receipt rejected while legal hold remains active'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.deletion_scope <> 'artifact' THEN
    RAISE EXCEPTION 'database-only case-wide deletion is unsupported and fails closed'
      USING ERRCODE = '0A000';
  END IF;

  RETURN NEW;
END;
$$;

-- The operational legal-hold path inserts its metadata event before the
-- release row so the existing FK and release trigger can validate it.  This
-- deferred reverse-binding guard prevents that narrow audit INSERT surface
-- from committing a forged or orphaned "hold released" event.
CREATE FUNCTION lor_studio.enforce_deletion_hold_release_audit_consumed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.event_type <> 'deletion.hold_released' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.deletion_hold_releases AS hold_release
    WHERE hold_release.audit_event_ref = NEW.event_ref
      AND hold_release.case_id = NEW.case_id
      AND hold_release.student_auth_subject = NEW.student_auth_subject
      AND hold_release.released_at = NEW.occurred_at
  ) THEN
    RAISE EXCEPTION 'legal-hold release audit must be consumed by the same transaction'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_case_write_receipt_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.transaction_id <> pg_catalog.pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'case write receipt transaction does not match the current transaction'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.committed_at <> pg_catalog.transaction_timestamp() THEN
    RAISE EXCEPTION 'case write receipt commit time must be the current transaction time'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = NEW.case_id
      AND recommendation_case.student_auth_subject = NEW.student_auth_subject
      AND recommendation_case.student_auth_uid = NEW.student_auth_uid
      AND recommendation_case.revision = NEW.revision
      AND recommendation_case.status = NEW.status
      AND recommendation_case.created_at = NEW.created_at
      AND recommendation_case.updated_at = NEW.updated_at
      AND recommendation_case.closed_at IS NOT DISTINCT FROM NEW.closed_at
      AND recommendation_case.record = NEW.record
      AND recommendation_case.record_hash = NEW.record_hash
      AND recommendation_case.protected_state_hash = NEW.protected_state_hash
      AND (
        (recommendation_case.released_at IS NULL AND NEW.released_snapshot_hash IS NULL)
        OR (recommendation_case.released_at IS NOT NULL AND NEW.released_snapshot_hash IS NOT NULL)
      )
  ) THEN
    RAISE EXCEPTION 'case write receipt does not match the exact committed safe case state'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_private_write_receipt_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.transaction_id <> pg_catalog.pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'private write receipt transaction does not match the current transaction'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.committed_at <> pg_catalog.transaction_timestamp() THEN
    RAISE EXCEPTION 'private write receipt commit time must be the current transaction time'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    JOIN lor_studio.faculty_private_content AS private_content
      ON private_content.case_id = recommendation_case.case_id
     AND private_content.student_auth_subject = recommendation_case.student_auth_subject
    WHERE recommendation_case.case_id = NEW.case_id
      AND recommendation_case.student_auth_subject = NEW.student_auth_subject
      AND recommendation_case.revision = NEW.revision
      AND recommendation_case.status = NEW.status
      AND recommendation_case.created_at = NEW.created_at
      AND recommendation_case.updated_at = NEW.updated_at
      AND recommendation_case.closed_at IS NOT DISTINCT FROM NEW.closed_at
      AND recommendation_case.record = NEW.safe_record
      AND recommendation_case.record_hash = NEW.safe_record_hash
      AND recommendation_case.protected_state_hash = NEW.protected_state_hash
      AND private_content.faculty_auth_subject = NEW.faculty_auth_subject
      AND private_content.faculty_auth_uid = NEW.faculty_auth_uid
      AND private_content.private_revision = NEW.revision
      AND private_content.private_record_hash = NEW.private_record_hash
      AND NEW.private_record -> 'facultyPrivate' -> 'answers' = private_content.answers
      AND NEW.private_record -> 'facultyPrivate' -> 'notes' = private_content.notes
      AND NEW.private_record -> 'facultyPrivate' ->> 'draftText'
        IS NOT DISTINCT FROM private_content.draft_text
      AND (
        (
          pg_catalog.jsonb_typeof(
            NEW.private_record -> 'facultyPrivate' -> 'finalDocument'
          ) = 'null'
          AND private_content.final_document_id IS NULL
          AND private_content.final_document_text IS NULL
          AND private_content.final_document_content_hash IS NULL
          AND private_content.final_document_mime_type IS NULL
          AND private_content.released_at IS NULL
        )
        OR (
          pg_catalog.jsonb_typeof(
            NEW.private_record -> 'facultyPrivate' -> 'finalDocument'
          ) = 'object'
          AND (
            private_content.final_document_id IS NOT NULL
            OR private_content.final_document_text IS NOT NULL
            OR private_content.final_document_content_hash IS NOT NULL
            OR private_content.final_document_mime_type IS NOT NULL
          )
          AND NEW.private_record -> 'facultyPrivate' -> 'finalDocument' ->> 'id'
            IS NOT DISTINCT FROM private_content.final_document_id
          AND NEW.private_record -> 'facultyPrivate' -> 'finalDocument' ->> 'text'
            IS NOT DISTINCT FROM private_content.final_document_text
          AND NEW.private_record -> 'facultyPrivate' -> 'finalDocument' ->> 'contentHash'
            IS NOT DISTINCT FROM private_content.final_document_content_hash
          AND NEW.private_record -> 'facultyPrivate' -> 'finalDocument' ->> 'mimeType'
            IS NOT DISTINCT FROM private_content.final_document_mime_type
          AND (
            NEW.private_record -> 'facultyPrivate' -> 'finalDocument' ->> 'releasedToStudentAt'
          )::timestamptz IS NOT DISTINCT FROM private_content.released_at
        )
      )
      AND NEW.private_record -> 'finalDocumentState' ->> 'documentState'
        IS NOT DISTINCT FROM private_content.document_state
      AND (
        (
          pg_catalog.jsonb_typeof(
            NEW.private_record -> 'finalDocumentState' -> 'facultyApproval'
          ) = 'null'
          AND private_content.approval_approved IS NULL
          AND private_content.approval_at IS NULL
          AND private_content.approval_faculty_auth_subject IS NULL
          AND private_content.approval_signature_attested IS NULL
        )
        OR (
          pg_catalog.jsonb_typeof(
            NEW.private_record -> 'finalDocumentState' -> 'facultyApproval'
          ) = 'object'
          AND (
            NEW.private_record -> 'finalDocumentState' -> 'facultyApproval' ->> 'approved'
          )::boolean = private_content.approval_approved
          AND (
            NEW.private_record -> 'finalDocumentState' -> 'facultyApproval' ->> 'approvedAt'
          )::timestamptz = private_content.approval_at
          AND NEW.private_record -> 'finalDocumentState' -> 'facultyApproval' ->> 'facultyId'
            = private_content.approval_faculty_auth_subject
          AND (
            NEW.private_record -> 'finalDocumentState' -> 'facultyApproval' ->> 'signatureAttested'
          )::boolean = private_content.approval_signature_attested
        )
      )
      AND (
        (
          pg_catalog.jsonb_typeof(
            NEW.private_record -> 'finalDocumentState' -> 'release'
          ) = 'null'
          AND private_content.release_document_hash IS NULL
          AND private_content.release_document_id IS NULL
          AND private_content.released_at IS NULL
          AND private_content.released_at_revision IS NULL
          AND private_content.release_waiver_receipt_id IS NULL
        )
        OR (
          pg_catalog.jsonb_typeof(
            NEW.private_record -> 'finalDocumentState' -> 'release'
          ) = 'object'
          AND NEW.private_record -> 'finalDocumentState' -> 'release' ->> 'documentHash'
            = private_content.release_document_hash
          AND NEW.private_record -> 'finalDocumentState' -> 'release' ->> 'documentId'
            = private_content.release_document_id
          AND (
            NEW.private_record -> 'finalDocumentState' -> 'release' ->> 'releasedAt'
          )::timestamptz = private_content.released_at
          AND (
            NEW.private_record -> 'finalDocumentState' -> 'release' ->> 'releasedAtRevision'
          )::bigint = private_content.released_at_revision
          AND NEW.private_record -> 'finalDocumentState' -> 'release' ->> 'waiverReceiptId'
            = private_content.release_waiver_receipt_id
        )
      )
      AND (
        (recommendation_case.released_at IS NULL AND NEW.released_snapshot_hash IS NULL)
        OR (recommendation_case.released_at IS NOT NULL AND NEW.released_snapshot_hash IS NOT NULL)
      )
  ) THEN
    RAISE EXCEPTION 'private write receipt does not match exact safe and faculty-private state'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_protected_revision_state_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  last_version_entry jsonb;
  trusted_actor_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  predecessor_revision bigint;
  predecessor_hash text;
BEGIN
  IF NEW.transaction_id <> pg_catalog.pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'protected revision transaction does not match the current transaction'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.committed_at <> pg_catalog.transaction_timestamp() THEN
    RAISE EXCEPTION 'protected revision commit time must be the current transaction time'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.revision = 0 THEN
    NEW.previous_revision := NULL;
    NEW.previous_protected_state_hash := NULL;
  ELSE
    SELECT previous_state.revision, previous_state.protected_state_hash
      INTO predecessor_revision, predecessor_hash
    FROM lor_studio.recommendation_case_protected_revision_states AS previous_state
    WHERE previous_state.case_id = NEW.case_id
      AND previous_state.student_auth_subject = NEW.student_auth_subject
      AND previous_state.revision = NEW.revision - 1;
    -- Command functions serialize the append-only chain by locking its owning
    -- recommendation-case row.  Re-locking a predecessor would incorrectly
    -- require UPDATE visibility over immutable protected history.

    IF NOT FOUND THEN
      RAISE EXCEPTION 'protected revision predecessor is missing'
        USING ERRCODE = '23503';
    END IF;

    NEW.previous_revision := predecessor_revision;
    NEW.previous_protected_state_hash := predecessor_hash;
  END IF;

  NEW.protected_state_hash := lor_studio.protected_state_chain_hash(
    NEW.case_id,
    NEW.student_auth_subject,
    NEW.revision,
    NEW.previous_protected_state_hash,
    NEW.event_hash,
    NEW.protected_state
  );

  last_version_entry := NEW.protected_state -> 'versionHistory' -> NEW.revision::integer;

  IF last_version_entry ->> 'actorId' IS DISTINCT FROM
     trusted_actor_subject THEN
    RAISE EXCEPTION 'protected revision actor does not match the trusted transaction principal'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_case_audit_events AS audit_event
    JOIN lor_studio.recommendation_cases AS recommendation_case
      ON recommendation_case.case_id = audit_event.case_id
     AND recommendation_case.student_auth_subject = audit_event.student_auth_subject
    WHERE audit_event.event_ref = NEW.audit_event_ref
      AND audit_event.case_id = NEW.case_id
      AND audit_event.student_auth_subject = NEW.student_auth_subject
      AND audit_event.revision = NEW.revision
      AND audit_event.event_hash = NEW.event_hash
      AND audit_event.transaction_id = NEW.transaction_id
      AND audit_event.actor_role = pg_catalog.current_setting('lor_studio.actor_role', true)
      AND audit_event.event_type = last_version_entry ->> 'eventType'
      AND audit_event.occurred_at = (last_version_entry ->> 'occurredAt')::timestamptz
      AND recommendation_case.revision = NEW.revision
      AND recommendation_case.protected_state_hash = NEW.protected_state_hash
      AND NEW.committed_at >= audit_event.occurred_at
  ) THEN
    RAISE EXCEPTION 'protected revision does not bind the exact current case and audit event'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_revision_bound_student_receipt_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = NEW.case_id
      AND recommendation_case.student_auth_subject = NEW.student_auth_subject
      AND recommendation_case.student_auth_uid = NEW.student_auth_uid
      AND recommendation_case.revision = NEW.case_revision
      AND NEW.recorded_at >= recommendation_case.created_at
      AND NEW.recorded_at <= recommendation_case.updated_at
  ) THEN
    RAISE EXCEPTION '% is not bound to the current case revision', TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION lor_studio.enforce_faculty_otp_challenge_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_faculty_otp_verification_receipt_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_ai_generation_run_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_ai_letter_proposal_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_ai_proposal_decision_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_deletion_intent_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_deletion_hold_release_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_deletion_hold_release_audit_consumed() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_deletion_receipt_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_case_write_receipt_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_private_write_receipt_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_protected_revision_state_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_revision_bound_student_receipt_insert() FROM PUBLIC;

CREATE TRIGGER faculty_otp_challenges_insert_guard
BEFORE INSERT ON lor_studio.faculty_otp_challenges
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_faculty_otp_challenge_insert();

CREATE TRIGGER faculty_otp_verification_receipts_insert_guard
BEFORE INSERT ON lor_studio.faculty_otp_verification_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_faculty_otp_verification_receipt_insert();

CREATE TRIGGER ai_generation_runs_insert_guard
BEFORE INSERT ON lor_studio.ai_generation_runs
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_ai_generation_run_insert();

CREATE TRIGGER ai_letter_proposals_insert_guard
BEFORE INSERT ON lor_studio.ai_letter_proposals
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_ai_letter_proposal_insert();

CREATE TRIGGER ai_proposal_decisions_insert_guard
BEFORE INSERT ON lor_studio.ai_proposal_decisions
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_ai_proposal_decision_insert();

CREATE TRIGGER deletion_intents_insert_guard
BEFORE INSERT ON lor_studio.deletion_intents
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_deletion_intent_insert();

CREATE TRIGGER deletion_hold_releases_insert_guard
BEFORE INSERT ON lor_studio.deletion_hold_releases
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_deletion_hold_release_insert();

CREATE CONSTRAINT TRIGGER deletion_hold_release_audit_consumption_guard
AFTER INSERT ON lor_studio.recommendation_case_audit_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_deletion_hold_release_audit_consumed();

CREATE TRIGGER deletion_receipts_insert_guard
BEFORE INSERT ON lor_studio.deletion_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_deletion_receipt_insert();

CREATE TRIGGER recommendation_case_write_receipts_insert_guard
BEFORE INSERT ON lor_studio.recommendation_case_write_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_case_write_receipt_insert();

CREATE TRIGGER recommendation_case_private_write_receipts_insert_guard
BEFORE INSERT ON lor_studio.recommendation_case_private_write_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_private_write_receipt_insert();

CREATE TRIGGER recommendation_case_protected_revision_states_insert_guard
BEFORE INSERT ON lor_studio.recommendation_case_protected_revision_states
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_protected_revision_state_insert();

CREATE TRIGGER consent_receipts_revision_guard
BEFORE INSERT ON lor_studio.consent_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_revision_bound_student_receipt_insert();

CREATE TRIGGER waiver_receipts_revision_guard
BEFORE INSERT ON lor_studio.waiver_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_revision_bound_student_receipt_insert();

CREATE FUNCTION lor_studio.enforce_faculty_invitation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF ROW(
      NEW.invitation_id,
      NEW.case_id,
      NEW.student_auth_subject,
      NEW.recipient_email_hash,
      NEW.token_hash,
      NEW.max_attempts,
      NEW.attempt_window_ms,
      NEW.lockout_ms,
      NEW.created_at,
      NEW.expires_at
    ) IS DISTINCT FROM ROW(
      OLD.invitation_id,
      OLD.case_id,
      OLD.student_auth_subject,
      OLD.recipient_email_hash,
      OLD.token_hash,
      OLD.max_attempts,
      OLD.attempt_window_ms,
      OLD.lockout_ms,
      OLD.created_at,
      OLD.expires_at
    ) THEN
    RAISE EXCEPTION 'faculty invitation identity and verification material are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'faculty invitation revision must advance by exactly one'
      USING ERRCODE = '40001';
  END IF;

  IF OLD.faculty_auth_subject IS NOT NULL AND ROW(NEW.faculty_auth_subject, NEW.faculty_auth_uid)
     IS DISTINCT FROM ROW(OLD.faculty_auth_subject, OLD.faculty_auth_uid) THEN
    RAISE EXCEPTION 'consumed faculty invitation recipient binding is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.used_at IS NOT NULL AND NEW.used_at IS DISTINCT FROM OLD.used_at THEN
    RAISE EXCEPTION 'faculty invitation consumption timestamp is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION 'faculty invitation revocation timestamp is immutable'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.enforce_released_student_document_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = NEW.case_id
    AND recommendation_case.student_auth_subject = NEW.student_auth_subject
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'released student document case does not exist'
      USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.waiver_receipts AS waiver
    WHERE waiver.receipt_id = NEW.waiver_receipt_id
      AND waiver.case_id = NEW.case_id
      AND waiver.student_auth_subject = NEW.student_auth_subject
      AND waiver.waived IS FALSE
      AND waiver.recorded_at <= NEW.released_at
      AND NOT EXISTS (
        SELECT 1
        FROM lor_studio.waiver_receipts AS successor
        WHERE successor.prior_receipt_id = waiver.receipt_id
      )
  ) THEN
    RAISE EXCEPTION 'released student document requires the current non-waived receipt'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.release_document_hash IS DISTINCT FROM lor_studio.release_document_hash(
       NEW.final_document_content_hash,
       NEW.final_document_id,
       NEW.final_document_mime_type,
       NEW.final_document_text
     )
     OR NEW.snapshot_hash IS DISTINCT FROM lor_studio.canonical_jsonb_sha256(
       pg_catalog.jsonb_build_object(
         'finalDocument', pg_catalog.jsonb_build_object(
           'id', NEW.final_document_id,
           'text', NEW.final_document_text,
           'contentHash', NEW.final_document_content_hash,
           'mimeType', NEW.final_document_mime_type,
           'releasedToStudentAt', pg_catalog.to_char(
            NEW.released_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
         ),
         'facultyApproval', pg_catalog.jsonb_build_object(
           'approved', NEW.approval_approved,
           'approvedAt', pg_catalog.to_char(
            NEW.approval_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
           'facultyRef', NEW.approval_faculty_ref,
           'signatureAttested', NEW.approval_signature_attested
         ),
         'release', pg_catalog.jsonb_build_object(
           'documentId', NEW.release_document_id,
           'documentHash', NEW.release_document_hash,
           'releasedAt', pg_catalog.to_char(
            NEW.released_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
           'releasedAtRevision', NEW.released_at_revision,
           'waiverReceiptId', NEW.waiver_receipt_id
         )
       )
     ) THEN
    RAISE EXCEPTION 'released student document hash bindings are not database canonical'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    JOIN lor_studio.faculty_private_content AS private_content
      ON private_content.case_id = recommendation_case.case_id
     AND private_content.student_auth_subject = recommendation_case.student_auth_subject
    WHERE recommendation_case.case_id = NEW.case_id
      AND recommendation_case.student_auth_subject = NEW.student_auth_subject
      AND recommendation_case.release_document_id = NEW.release_document_id
      AND recommendation_case.release_document_hash = NEW.release_document_hash
      AND recommendation_case.released_at = NEW.released_at
      AND recommendation_case.released_at_revision = NEW.released_at_revision
      AND NEW.released_at_revision = recommendation_case.revision
      AND recommendation_case.release_waiver_receipt_id = NEW.waiver_receipt_id
      AND private_content.final_document_id = NEW.final_document_id
      AND private_content.final_document_text = NEW.final_document_text
      AND private_content.final_document_content_hash IS NOT DISTINCT FROM
        NEW.final_document_content_hash
      AND private_content.final_document_mime_type IS NOT DISTINCT FROM
        NEW.final_document_mime_type
      AND private_content.approval_approved IS TRUE
      AND private_content.approval_at = NEW.approval_at
      AND private_content.approval_signature_attested IS TRUE
      AND private_content.release_document_id = NEW.release_document_id
      AND private_content.release_document_hash = NEW.release_document_hash
      AND private_content.released_at = NEW.released_at
      AND private_content.released_at_revision = NEW.released_at_revision
      AND private_content.release_waiver_receipt_id = NEW.waiver_receipt_id
  ) THEN
    RAISE EXCEPTION 'released student document does not match the committed case and faculty-private release'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION lor_studio.reject_waiver_after_student_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  prior_recorded_at timestamptz;
BEGIN
  PERFORM 1
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = NEW.case_id
    AND recommendation_case.student_auth_subject = NEW.student_auth_subject
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'waiver receipt case does not exist'
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM lor_studio.released_student_documents AS released_document
    WHERE released_document.case_id = NEW.case_id
      AND released_document.student_auth_subject = NEW.student_auth_subject
  ) THEN
    RAISE EXCEPTION 'waiver history is frozen after student-visible release'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.prior_receipt_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM lor_studio.waiver_receipts AS existing_waiver
      WHERE existing_waiver.case_id = NEW.case_id
        AND existing_waiver.student_auth_subject = NEW.student_auth_subject
    ) THEN
      RAISE EXCEPTION 'waiver receipt root already exists for case'
        USING ERRCODE = '23505';
    END IF;
  ELSE
    SELECT prior_waiver.recorded_at
      INTO prior_recorded_at
    FROM lor_studio.waiver_receipts AS prior_waiver
    WHERE prior_waiver.receipt_id = NEW.prior_receipt_id
      AND prior_waiver.case_id = NEW.case_id
      AND prior_waiver.student_auth_subject = NEW.student_auth_subject;

    IF prior_recorded_at IS NULL THEN
      RAISE EXCEPTION 'waiver predecessor does not exist in the same case and owner scope'
        USING ERRCODE = '23503';
    END IF;

    IF NEW.recorded_at <= prior_recorded_at THEN
      RAISE EXCEPTION 'waiver successor must be recorded strictly after its predecessor'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM lor_studio.waiver_receipts AS successor
      WHERE successor.prior_receipt_id = NEW.prior_receipt_id
    ) THEN
      RAISE EXCEPTION 'waiver predecessor already has a successor'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION lor_studio.enforce_faculty_invitation_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.enforce_released_student_document_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.reject_waiver_after_student_release() FROM PUBLIC;

CREATE TRIGGER recommendation_cases_insert_guard
BEFORE INSERT ON lor_studio.recommendation_cases
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_recommendation_case_insert();

CREATE TRIGGER recommendation_cases_update_guard
BEFORE UPDATE ON lor_studio.recommendation_cases
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_recommendation_case_update();

CREATE TRIGGER faculty_invitations_update_guard
BEFORE UPDATE ON lor_studio.faculty_invitations
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_faculty_invitation_update();

CREATE TRIGGER faculty_private_content_insert_guard
BEFORE INSERT ON lor_studio.faculty_private_content
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_faculty_private_content_insert();

CREATE TRIGGER faculty_private_content_update_guard
BEFORE UPDATE ON lor_studio.faculty_private_content
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_faculty_private_content_update();

CREATE TRIGGER released_student_documents_insert_guard
BEFORE INSERT ON lor_studio.released_student_documents
FOR EACH ROW EXECUTE FUNCTION lor_studio.enforce_released_student_document_insert();

CREATE TRIGGER waiver_receipts_post_release_guard
BEFORE INSERT ON lor_studio.waiver_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_waiver_after_student_release();

CREATE TRIGGER student_auth_bindings_append_only
BEFORE UPDATE OR DELETE ON lor_studio.student_auth_bindings
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER student_auth_binding_revocations_append_only
BEFORE UPDATE OR DELETE ON lor_studio.student_auth_binding_revocations
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER faculty_otp_challenges_append_only
BEFORE UPDATE OR DELETE ON lor_studio.faculty_otp_challenges
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER faculty_otp_challenge_revocations_append_only
BEFORE UPDATE OR DELETE ON lor_studio.faculty_otp_challenge_revocations
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER faculty_otp_verification_receipts_append_only
BEFORE UPDATE OR DELETE ON lor_studio.faculty_otp_verification_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER faculty_otp_proof_revocations_append_only
BEFORE UPDATE OR DELETE ON lor_studio.faculty_otp_proof_revocations
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER recommendation_case_creation_reservations_append_only
BEFORE UPDATE OR DELETE ON lor_studio.recommendation_case_creation_reservations
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER recommendation_case_audit_events_append_only
BEFORE UPDATE OR DELETE ON lor_studio.recommendation_case_audit_events
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER recommendation_case_write_receipts_append_only
BEFORE UPDATE OR DELETE ON lor_studio.recommendation_case_write_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER recommendation_case_protected_revision_states_append_only
BEFORE UPDATE OR DELETE ON lor_studio.recommendation_case_protected_revision_states
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER consent_receipts_append_only
BEFORE UPDATE OR DELETE ON lor_studio.consent_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER waiver_receipts_append_only
BEFORE UPDATE OR DELETE ON lor_studio.waiver_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER released_student_documents_append_only
BEFORE UPDATE OR DELETE ON lor_studio.released_student_documents
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER recommendation_case_private_write_receipts_append_only
BEFORE UPDATE OR DELETE ON lor_studio.recommendation_case_private_write_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER administrative_case_grants_append_only
BEFORE UPDATE OR DELETE ON lor_studio.administrative_case_grants
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER administrative_case_grant_revocations_append_only
BEFORE UPDATE OR DELETE ON lor_studio.administrative_case_grant_revocations
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER mentor_case_assignments_append_only
BEFORE UPDATE OR DELETE ON lor_studio.mentor_case_assignments
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER mentor_case_assignment_revocations_append_only
BEFORE UPDATE OR DELETE ON lor_studio.mentor_case_assignment_revocations
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER writer_depot_artifacts_append_only
BEFORE UPDATE OR DELETE ON lor_studio.writer_depot_artifacts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER ai_generation_runs_append_only
BEFORE UPDATE OR DELETE ON lor_studio.ai_generation_runs
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER ai_letter_proposals_append_only
BEFORE UPDATE OR DELETE ON lor_studio.ai_letter_proposals
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER ai_proposal_decisions_append_only
BEFORE UPDATE OR DELETE ON lor_studio.ai_proposal_decisions
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER deletion_intents_append_only
BEFORE UPDATE OR DELETE ON lor_studio.deletion_intents
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER deletion_hold_releases_append_only
BEFORE UPDATE OR DELETE ON lor_studio.deletion_hold_releases
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER deletion_receipts_append_only
BEFORE UPDATE OR DELETE ON lor_studio.deletion_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

-- Materialize the built-in owner schema and relation ACLs instead of leaving
-- nspacl/relacl NULL. RLS rollback can then restore this foundation state
-- exactly through ordinary GRANT/REVOKE DDL; PostgreSQL has no supported DDL
-- that turns an instantiated ACL back into the catalog NULL/default form.
GRANT ALL PRIVILEGES ON SCHEMA lor_studio TO CURRENT_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA lor_studio TO CURRENT_USER;

COMMIT;
