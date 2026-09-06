-- Migration: 20260826011700_f2_lor_1012_live_production_mentor_assignment_commands.sql
-- Authority: F2-LOR-1012 / DR-120 / DR-133
-- Date: 2026-08-26
-- Depends on: 20260826011500_f2_lor_1012_faculty_candidate_auth_handoff_commands.sql
-- Description: Add trusted-service-only, append-only mentor assignment and revocation commands.
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
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000|identityScope=20260826010300|facultyInvitationCommands=20260826010500|facultyPrivateExportCommands=20260826010700|aiProposalCommands=20260826010900|studentEvidenceCommands=20260826011100|encryptedPrivateStorage=20260826011300|facultyCandidateAuthHandoff=20260826011500',
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
    RAISE EXCEPTION 'DR-133 mentor assignment migration requires the exact successor-bound private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.recommendation_cases,
  lor_studio.recommendation_case_audit_events,
  lor_studio.mentor_case_assignments,
  lor_studio.mentor_case_assignment_revocations
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
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind = 'r'
    AND class.relrowsecurity
    AND class.relforcerowsecurity;

  SELECT pg_catalog.count(*) INTO definer_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner';

  SELECT pg_catalog.count(*) INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  IF relation_count IS DISTINCT FROM 36
    OR forced_rls_count IS DISTINCT FROM 36
    OR definer_count IS DISTINCT FROM 32
    OR public_execute_count <> 0
    OR pg_catalog.to_regprocedure(
      'lor_studio.mentor_assignment_command_context_allows(text,text,text,text)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.assign_mentor_to_case(text,text,text,text,integer,text)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.revoke_mentor_case_assignment(text,text,text,text,text)'
    ) IS NOT NULL
  THEN
    RAISE EXCEPTION 'DR-133 mentor assignment migration preflight catalog mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_preflight$;

ALTER TABLE lor_studio.recommendation_case_audit_events
  DROP CONSTRAINT recommendation_case_audit_events_event_type_known;
ALTER TABLE lor_studio.recommendation_case_audit_events
  ADD CONSTRAINT recommendation_case_audit_events_event_type_known CHECK (event_type IN (
    'ai.proposal_decision_recorded',
    'ai.proposal_generated',
    'case.created',
    'builder.autosaved',
    'builder.step_completed',
    'consent.recorded',
    'deletion.hold_released',
    'faculty.final_document_released',
    'faculty.invitation_delivered',
    'faculty.invitation_delivery_pending',
    'faculty.invitation_delivery_unknown',
    'faculty.invitation_otp_resent',
    'faculty.invitation_revoked',
    'faculty.invited',
    'faculty.private_content_updated',
    'faculty.verification_denied',
    'faculty.verified',
    'mentor.assignment_issued',
    'mentor.assignment_revoked',
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
  ));

CREATE FUNCTION lor_studio.mentor_assignment_command_context_allows(
  candidate_case_id text,
  candidate_student_subject text,
  candidate_assignment_id text,
  allowed_operation text
)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $mentor_assignment_context$
  SELECT COALESCE(
    CURRENT_USER = 'lor_studio_command_owner'
    AND candidate_case_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND candidate_student_subject ~ '^wp:[1-9][0-9]*$'
    AND allowed_operation = ANY (
      ARRAY['assign_mentor_case', 'revoke_mentor_assignment']::text[]
    )
    AND pg_catalog.current_setting('transaction_isolation', true) = 'read committed'
    AND pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
    AND pg_catalog.current_setting('lor_studio.student_auth_subject', true) =
      'service:lor-mentor-assignment-operator-v1'
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) =
      candidate_student_subject
    AND pg_catalog.current_setting('lor_studio.case_id', true) = candidate_case_id
    AND pg_catalog.current_setting('lor_studio.operation', true) = allowed_operation
    AND pg_catalog.current_setting('lor_studio.purpose', true) =
      'mentor_assignment_administration'
    AND NULLIF(pg_catalog.current_setting('lor_studio.invitation_id', true), '') IS NULL
    AND NULLIF(
      pg_catalog.current_setting('lor_studio.administrative_grant_id', true), ''
    ) IS NULL
    AND NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '') IS NULL
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.trusted_service_actor', true) =
      'lor-mentor-assignment-operator-v1'
    AND pg_catalog.current_setting('lor_studio.identity_resolution_verified', true) = 'true'
    AND (
      (
        allowed_operation = 'assign_mentor_case'
        AND NULLIF(pg_catalog.current_setting('lor_studio.assignment_id', true), '') IS NULL
        AND candidate_assignment_id IS NULL
      )
      OR (
        allowed_operation = 'revoke_mentor_assignment'
        AND candidate_assignment_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
        AND pg_catalog.current_setting('lor_studio.assignment_id', true) =
          candidate_assignment_id
      )
    ),
    false
  );
$mentor_assignment_context$;

REVOKE ALL ON FUNCTION lor_studio.mentor_assignment_command_context_allows(
  text, text, text, text
) FROM PUBLIC;

CREATE POLICY recommendation_cases_mentor_assignment_service_select
ON lor_studio.recommendation_cases
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND lor_studio.mentor_assignment_command_context_allows(
    case_id,
    student_auth_subject,
    NULLIF(pg_catalog.current_setting('lor_studio.assignment_id', true), ''),
    pg_catalog.current_setting('lor_studio.operation', true)
  )
);

CREATE POLICY mentor_case_assignments_service_select
ON lor_studio.mentor_case_assignments
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND lor_studio.mentor_assignment_command_context_allows(
    case_id,
    student_auth_subject,
    CASE
      WHEN pg_catalog.current_setting('lor_studio.operation', true) =
        'revoke_mentor_assignment'
      THEN assignment_id
      ELSE NULL
    END,
    pg_catalog.current_setting('lor_studio.operation', true)
  )
  AND (
    pg_catalog.current_setting('lor_studio.operation', true) = 'assign_mentor_case'
    OR assignment_id = pg_catalog.current_setting('lor_studio.assignment_id', true)
  )
);

CREATE POLICY mentor_case_assignments_service_insert
ON lor_studio.mentor_case_assignments
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  assignment_id ~ '^mentor_service_assignment_[a-f0-9]{64}$'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND operation = 'read'
  AND lor_studio.mentor_assignment_command_context_allows(
    case_id, student_auth_subject, NULL, 'assign_mentor_case'
  )
);

CREATE POLICY mentor_case_assignment_revocations_service_select
ON lor_studio.mentor_case_assignment_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND (
    (
      pg_catalog.current_setting('lor_studio.operation', true) =
        'assign_mentor_case'
      AND lor_studio.mentor_assignment_command_context_allows(
        case_id, student_auth_subject, NULL, 'assign_mentor_case'
      )
    )
    OR (
      assignment_id = pg_catalog.current_setting('lor_studio.assignment_id', true)
      AND lor_studio.mentor_assignment_command_context_allows(
        case_id, student_auth_subject, assignment_id, 'revoke_mentor_assignment'
      )
    )
  )
);

CREATE POLICY mentor_case_assignment_revocations_service_insert
ON lor_studio.mentor_case_assignment_revocations
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  assignment_id = pg_catalog.current_setting('lor_studio.assignment_id', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND lor_studio.mentor_assignment_command_context_allows(
    case_id, student_auth_subject, assignment_id, 'revoke_mentor_assignment'
  )
);

CREATE POLICY recommendation_case_audit_mentor_assignment_service_select
ON lor_studio.recommendation_case_audit_events
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND event_type = ANY (
    ARRAY['mentor.assignment_issued', 'mentor.assignment_revoked']::text[]
  )
  AND lor_studio.mentor_assignment_command_context_allows(
    case_id,
    student_auth_subject,
    NULLIF(pg_catalog.current_setting('lor_studio.assignment_id', true), ''),
    pg_catalog.current_setting('lor_studio.operation', true)
  )
);

CREATE POLICY recommendation_case_audit_mentor_assignment_service_insert
ON lor_studio.recommendation_case_audit_events
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND actor_role = 'service'
  AND event_type = ANY (
    ARRAY['mentor.assignment_issued', 'mentor.assignment_revoked']::text[]
  )
  AND lor_studio.mentor_assignment_command_context_allows(
    case_id,
    student_auth_subject,
    NULLIF(pg_catalog.current_setting('lor_studio.assignment_id', true), ''),
    pg_catalog.current_setting('lor_studio.operation', true)
  )
);

CREATE FUNCTION lor_studio.assign_mentor_to_case(
  candidate_case_id text,
  candidate_student_subject text,
  candidate_mentor_subject text,
  candidate_purpose text,
  candidate_maximum_lifetime_seconds integer,
  candidate_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $assign_mentor$
DECLARE
  current_case lor_studio.recommendation_cases%ROWTYPE;
  current_assignment lor_studio.mentor_case_assignments%ROWTYPE;
  current_audit lor_studio.recommendation_case_audit_events%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.transaction_timestamp()
  );
  assignment_expires_at timestamptz;
  assignment_id_value text;
  mentor_uid_digest text;
  mentor_uid_value uuid;
  idempotency_key_hash text;
  assignment_hash_value text;
  event_ref_value text;
  case_ref_value text;
  actor_ref_value text;
  correlation_ref_value text;
  event_value jsonb;
  event_hash_value text;
  transaction_id_value text := pg_catalog.pg_current_xact_id()::text;
  replayed_value boolean := false;
BEGIN
  IF candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_student_subject !~ '^wp:[1-9][0-9]*$'
    OR candidate_mentor_subject !~ '^wp:[1-9][0-9]*$'
    OR candidate_mentor_subject = candidate_student_subject
    OR candidate_purpose IS NULL
    OR pg_catalog.length(candidate_purpose) NOT BETWEEN 1 AND 160
    OR candidate_purpose IS DISTINCT FROM pg_catalog.btrim(candidate_purpose)
    OR candidate_purpose ~ '[[:cntrl:]]'
    OR candidate_maximum_lifetime_seconds NOT BETWEEN 300 AND 15552000
    OR candidate_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR NOT lor_studio.mentor_assignment_command_context_allows(
      candidate_case_id,
      candidate_student_subject,
      NULL,
      'assign_mentor_case'
    )
  THEN
    RAISE EXCEPTION 'LOR_MENTOR_ASSIGNMENT_COMMAND_DENIED'
      USING ERRCODE = 'P1601';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'missionmed.lor.mentor-assignment.idempotency.v1:' ||
        candidate_idempotency_key,
      0
    )
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'missionmed.lor.mentor-assignment.case.v1:' || candidate_case_id,
      0
    )
  );

  SELECT case_row.*
  INTO current_case
  FROM lor_studio.recommendation_cases AS case_row
  WHERE case_row.case_id = candidate_case_id
    AND case_row.student_auth_subject = candidate_student_subject;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_MENTOR_ASSIGNMENT_COMMAND_DENIED'
      USING ERRCODE = 'P1601';
  END IF;

  idempotency_key_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.mentor-assignment-idempotency.v1',
      'operator', 'lor-mentor-assignment-operator-v1',
      'action', 'mentor.assignment_issued',
      'idempotencyKey', candidate_idempotency_key
    )
  );
  assignment_id_value := 'mentor_service_assignment_' || idempotency_key_hash;
  mentor_uid_digest := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.mentor-auth-uid.v1',
      'subject', candidate_mentor_subject
    )
  );
  mentor_uid_value := (
    pg_catalog.substr(mentor_uid_digest, 1, 8) || '-' ||
    pg_catalog.substr(mentor_uid_digest, 9, 4) || '-5' ||
    pg_catalog.substr(mentor_uid_digest, 14, 3) || '-8' ||
    pg_catalog.substr(mentor_uid_digest, 18, 3) || '-' ||
    pg_catalog.substr(mentor_uid_digest, 21, 12)
  )::uuid;

  SELECT assignment.*
  INTO current_assignment
  FROM lor_studio.mentor_case_assignments AS assignment
  WHERE assignment.assignment_id = assignment_id_value;

  IF FOUND THEN
    assignment_hash_value := lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.mentor-assignment.v1',
        'assignmentId', current_assignment.assignment_id,
        'caseId', candidate_case_id,
        'studentAuthSubject', candidate_student_subject,
        'mentorAuthSubject', candidate_mentor_subject,
        'mentorAuthUid', mentor_uid_value::text,
        'operation', 'read',
        'purpose', candidate_purpose,
        'assignedAt', pg_catalog.to_char(
          current_assignment.assigned_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'expiresAt', pg_catalog.to_char(
          current_assignment.expires_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'idempotencyKeyHash', idempotency_key_hash
      )
    );
    IF current_assignment.case_id IS DISTINCT FROM candidate_case_id
      OR current_assignment.student_auth_subject IS DISTINCT FROM
        candidate_student_subject
      OR current_assignment.mentor_auth_subject IS DISTINCT FROM
        candidate_mentor_subject
      OR current_assignment.mentor_auth_uid IS DISTINCT FROM mentor_uid_value
      OR current_assignment.operation IS DISTINCT FROM 'read'
      OR current_assignment.purpose IS DISTINCT FROM candidate_purpose
      OR current_assignment.expires_at IS DISTINCT FROM
        current_assignment.assigned_at + pg_catalog.make_interval(
          secs => candidate_maximum_lifetime_seconds
        )
      OR current_assignment.assignment_hash IS DISTINCT FROM assignment_hash_value
    THEN
      RAISE EXCEPTION 'LOR_MENTOR_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = 'P1602';
    END IF;
    replayed_value := true;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM lor_studio.mentor_case_assignments AS assignment
      WHERE assignment.case_id = candidate_case_id
        AND assignment.student_auth_subject = candidate_student_subject
        AND assignment.mentor_auth_subject = candidate_mentor_subject
        AND assignment.operation = 'read'
        AND assignment.expires_at > command_at
        AND NOT EXISTS (
          SELECT 1
          FROM lor_studio.mentor_case_assignment_revocations AS revocation
          WHERE revocation.assignment_id = assignment.assignment_id
            AND revocation.case_id = assignment.case_id
            AND revocation.student_auth_subject = assignment.student_auth_subject
        )
    ) THEN
      RAISE EXCEPTION 'LOR_MENTOR_ASSIGNMENT_ALREADY_ACTIVE'
        USING ERRCODE = 'P1604';
    END IF;

    assignment_expires_at := command_at + pg_catalog.make_interval(
      secs => candidate_maximum_lifetime_seconds
    );
    assignment_hash_value := lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.mentor-assignment.v1',
        'assignmentId', assignment_id_value,
        'caseId', candidate_case_id,
        'studentAuthSubject', candidate_student_subject,
        'mentorAuthSubject', candidate_mentor_subject,
        'mentorAuthUid', mentor_uid_value::text,
        'operation', 'read',
        'purpose', candidate_purpose,
        'assignedAt', pg_catalog.to_char(
          command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'expiresAt', pg_catalog.to_char(
          assignment_expires_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'idempotencyKeyHash', idempotency_key_hash
      )
    );

    INSERT INTO lor_studio.mentor_case_assignments (
      assignment_id, case_id, student_auth_subject, mentor_auth_subject,
      mentor_auth_uid, operation, purpose, assigned_at, expires_at, assignment_hash
    ) VALUES (
      assignment_id_value, candidate_case_id, candidate_student_subject,
      candidate_mentor_subject, mentor_uid_value, 'read', candidate_purpose,
      command_at, assignment_expires_at, assignment_hash_value
    )
    RETURNING * INTO current_assignment;
  END IF;

  event_ref_value := 'event_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.mentor-assignment-event-ref.v1',
      'action', 'mentor.assignment_issued',
      'assignmentHash', current_assignment.assignment_hash
    )
  );

  SELECT audit.*
  INTO current_audit
  FROM lor_studio.recommendation_case_audit_events AS audit
  WHERE audit.event_ref = event_ref_value;

  IF NOT FOUND THEN
    case_ref_value := 'case_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('namespace', 'case', 'value', candidate_case_id)
    );
    actor_ref_value := 'actor_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'namespace', 'actor', 'value', 'lor-mentor-assignment-operator-v1'
      )
    );
    correlation_ref_value := 'correlation_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'namespace', 'correlation', 'value', idempotency_key_hash
      )
    );
    event_value := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.service-event.v1',
      'eventRef', event_ref_value,
      'eventType', 'mentor.assignment_issued',
      'caseRef', case_ref_value,
      'actorRef', actor_ref_value,
      'actorRole', 'service',
      'correlationRef', correlation_ref_value,
      'outcome', 'success',
      'revision', current_case.revision,
      'occurredAt', pg_catalog.to_char(
        current_assignment.assigned_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    );
    event_hash_value := lor_studio.canonical_jsonb_sha256(event_value);
    INSERT INTO lor_studio.recommendation_case_audit_events (
      event_ref, case_id, student_auth_subject, case_ref, actor_ref, actor_role,
      correlation_ref, event_type, outcome, revision, occurred_at, event,
      event_hash, transaction_id, inserted_at
    ) VALUES (
      event_ref_value, candidate_case_id, candidate_student_subject,
      case_ref_value, actor_ref_value, 'service', correlation_ref_value,
      'mentor.assignment_issued', 'success', current_case.revision,
      current_assignment.assigned_at, event_value, event_hash_value,
      transaction_id_value, current_assignment.assigned_at
    ) RETURNING * INTO current_audit;
  END IF;

  IF current_audit.case_id IS DISTINCT FROM candidate_case_id
    OR current_audit.student_auth_subject IS DISTINCT FROM candidate_student_subject
    OR current_audit.event_type IS DISTINCT FROM 'mentor.assignment_issued'
    OR current_audit.occurred_at IS DISTINCT FROM current_assignment.assigned_at
    OR current_audit.event_hash IS DISTINCT FROM
      lor_studio.canonical_jsonb_sha256(current_audit.event)
  THEN
    RAISE EXCEPTION 'LOR_MENTOR_ASSIGNMENT_AUDIT_CUSTODY_INVALID'
      USING ERRCODE = 'P1605';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.mentor-assignment-command-receipt.v1',
    'action', 'mentor.assignment_issued',
    'committed', true,
    'replayed', replayed_value,
    'assignmentId', current_assignment.assignment_id,
    'caseId', current_assignment.case_id,
    'studentAuthSubject', current_assignment.student_auth_subject,
    'mentorAuthSubject', current_assignment.mentor_auth_subject,
    'mentorAuthUid', current_assignment.mentor_auth_uid::text,
    'operation', current_assignment.operation,
    'purpose', current_assignment.purpose,
    'assignedAt', pg_catalog.to_char(
      current_assignment.assigned_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'expiresAt', pg_catalog.to_char(
      current_assignment.expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'revokedAt', NULL,
    'assignmentHash', current_assignment.assignment_hash,
    'revocationHash', NULL,
    'auditEventRef', current_audit.event_ref,
    'eventHash', current_audit.event_hash,
    'transactionId', current_audit.transaction_id
  );
EXCEPTION
  WHEN SQLSTATE 'P1601' OR SQLSTATE 'P1602' OR SQLSTATE 'P1604'
    OR SQLSTATE 'P1605' THEN RAISE;
  WHEN unique_violation THEN
    RAISE EXCEPTION 'LOR_MENTOR_IDEMPOTENCY_CONFLICT'
      USING ERRCODE = 'P1602';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_MENTOR_ASSIGNMENT_COMMAND_FAILED'
      USING ERRCODE = 'P1605';
END;
$assign_mentor$;

CREATE FUNCTION lor_studio.revoke_mentor_case_assignment(
  candidate_case_id text,
  candidate_student_subject text,
  candidate_assignment_id text,
  candidate_reason_code text,
  candidate_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $revoke_mentor$
DECLARE
  current_case lor_studio.recommendation_cases%ROWTYPE;
  current_assignment lor_studio.mentor_case_assignments%ROWTYPE;
  current_revocation lor_studio.mentor_case_assignment_revocations%ROWTYPE;
  current_audit lor_studio.recommendation_case_audit_events%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.transaction_timestamp()
  );
  idempotency_key_hash text;
  reason_code_hash text;
  revocation_hash_value text;
  event_ref_value text;
  case_ref_value text;
  actor_ref_value text;
  correlation_ref_value text;
  event_value jsonb;
  event_hash_value text;
  transaction_id_value text := pg_catalog.pg_current_xact_id()::text;
  replayed_value boolean := false;
BEGIN
  IF candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_student_subject !~ '^wp:[1-9][0-9]*$'
    OR candidate_assignment_id !~ '^mentor_service_assignment_[a-f0-9]{64}$'
    OR candidate_reason_code !~ '^[A-Z0-9_:-]{1,120}$'
    OR candidate_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR NOT lor_studio.mentor_assignment_command_context_allows(
      candidate_case_id,
      candidate_student_subject,
      candidate_assignment_id,
      'revoke_mentor_assignment'
    )
  THEN
    RAISE EXCEPTION 'LOR_MENTOR_ASSIGNMENT_COMMAND_DENIED'
      USING ERRCODE = 'P1601';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'missionmed.lor.mentor-revocation.idempotency.v1:' ||
        candidate_idempotency_key,
      0
    )
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'missionmed.lor.mentor-assignment.case.v1:' || candidate_case_id,
      0
    )
  );

  SELECT case_row.*
  INTO current_case
  FROM lor_studio.recommendation_cases AS case_row
  WHERE case_row.case_id = candidate_case_id
    AND case_row.student_auth_subject = candidate_student_subject;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_MENTOR_ASSIGNMENT_COMMAND_DENIED'
      USING ERRCODE = 'P1601';
  END IF;

  SELECT assignment.*
  INTO current_assignment
  FROM lor_studio.mentor_case_assignments AS assignment
  WHERE assignment.assignment_id = candidate_assignment_id
    AND assignment.case_id = candidate_case_id
    AND assignment.student_auth_subject = candidate_student_subject;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_MENTOR_ASSIGNMENT_NOT_FOUND'
      USING ERRCODE = 'P1603';
  END IF;

  idempotency_key_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.mentor-revocation-idempotency.v1',
      'operator', 'lor-mentor-assignment-operator-v1',
      'action', 'mentor.assignment_revoked',
      'idempotencyKey', candidate_idempotency_key
    )
  );
  reason_code_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.mentor-revocation-reason.v1',
      'reasonCode', candidate_reason_code
    )
  );

  SELECT revocation.*
  INTO current_revocation
  FROM lor_studio.mentor_case_assignment_revocations AS revocation
  WHERE revocation.assignment_id = candidate_assignment_id;

  IF FOUND THEN
    revocation_hash_value := lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.mentor-assignment-revocation.v1',
        'assignmentId', current_assignment.assignment_id,
        'caseId', current_assignment.case_id,
        'studentAuthSubject', current_assignment.student_auth_subject,
        'assignmentHash', current_assignment.assignment_hash,
        'revokedAt', pg_catalog.to_char(
          current_revocation.revoked_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'reasonCodeHash', reason_code_hash,
        'idempotencyKeyHash', idempotency_key_hash
      )
    );
    IF current_revocation.case_id IS DISTINCT FROM candidate_case_id
      OR current_revocation.student_auth_subject IS DISTINCT FROM
        candidate_student_subject
      OR current_revocation.revocation_hash IS DISTINCT FROM revocation_hash_value
    THEN
      RAISE EXCEPTION 'LOR_MENTOR_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = 'P1602';
    END IF;
    replayed_value := true;
  ELSE
    revocation_hash_value := lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.mentor-assignment-revocation.v1',
        'assignmentId', current_assignment.assignment_id,
        'caseId', current_assignment.case_id,
        'studentAuthSubject', current_assignment.student_auth_subject,
        'assignmentHash', current_assignment.assignment_hash,
        'revokedAt', pg_catalog.to_char(
          command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'reasonCodeHash', reason_code_hash,
        'idempotencyKeyHash', idempotency_key_hash
      )
    );
    INSERT INTO lor_studio.mentor_case_assignment_revocations (
      assignment_id, case_id, student_auth_subject, revoked_at, revocation_hash
    ) VALUES (
      current_assignment.assignment_id,
      current_assignment.case_id,
      current_assignment.student_auth_subject,
      command_at,
      revocation_hash_value
    ) RETURNING * INTO current_revocation;
  END IF;

  event_ref_value := 'event_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.mentor-assignment-event-ref.v1',
      'action', 'mentor.assignment_revoked',
      'revocationHash', current_revocation.revocation_hash
    )
  );
  SELECT audit.*
  INTO current_audit
  FROM lor_studio.recommendation_case_audit_events AS audit
  WHERE audit.event_ref = event_ref_value;

  IF NOT FOUND THEN
    case_ref_value := 'case_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('namespace', 'case', 'value', candidate_case_id)
    );
    actor_ref_value := 'actor_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'namespace', 'actor', 'value', 'lor-mentor-assignment-operator-v1'
      )
    );
    correlation_ref_value := 'correlation_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'namespace', 'correlation', 'value', idempotency_key_hash
      )
    );
    event_value := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.service-event.v1',
      'eventRef', event_ref_value,
      'eventType', 'mentor.assignment_revoked',
      'caseRef', case_ref_value,
      'actorRef', actor_ref_value,
      'actorRole', 'service',
      'correlationRef', correlation_ref_value,
      'outcome', 'success',
      'revision', current_case.revision,
      'occurredAt', pg_catalog.to_char(
        current_revocation.revoked_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    );
    event_hash_value := lor_studio.canonical_jsonb_sha256(event_value);
    INSERT INTO lor_studio.recommendation_case_audit_events (
      event_ref, case_id, student_auth_subject, case_ref, actor_ref, actor_role,
      correlation_ref, event_type, outcome, revision, occurred_at, event,
      event_hash, transaction_id, inserted_at
    ) VALUES (
      event_ref_value, candidate_case_id, candidate_student_subject,
      case_ref_value, actor_ref_value, 'service', correlation_ref_value,
      'mentor.assignment_revoked', 'success', current_case.revision,
      current_revocation.revoked_at, event_value, event_hash_value,
      transaction_id_value, current_revocation.revoked_at
    ) RETURNING * INTO current_audit;
  END IF;

  IF current_audit.case_id IS DISTINCT FROM candidate_case_id
    OR current_audit.student_auth_subject IS DISTINCT FROM candidate_student_subject
    OR current_audit.event_type IS DISTINCT FROM 'mentor.assignment_revoked'
    OR current_audit.occurred_at IS DISTINCT FROM current_revocation.revoked_at
    OR current_audit.event_hash IS DISTINCT FROM
      lor_studio.canonical_jsonb_sha256(current_audit.event)
  THEN
    RAISE EXCEPTION 'LOR_MENTOR_ASSIGNMENT_AUDIT_CUSTODY_INVALID'
      USING ERRCODE = 'P1605';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.mentor-assignment-command-receipt.v1',
    'action', 'mentor.assignment_revoked',
    'committed', true,
    'replayed', replayed_value,
    'assignmentId', current_assignment.assignment_id,
    'caseId', current_assignment.case_id,
    'studentAuthSubject', current_assignment.student_auth_subject,
    'mentorAuthSubject', current_assignment.mentor_auth_subject,
    'mentorAuthUid', current_assignment.mentor_auth_uid::text,
    'operation', current_assignment.operation,
    'purpose', current_assignment.purpose,
    'assignedAt', pg_catalog.to_char(
      current_assignment.assigned_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'expiresAt', pg_catalog.to_char(
      current_assignment.expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'revokedAt', pg_catalog.to_char(
      current_revocation.revoked_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'assignmentHash', current_assignment.assignment_hash,
    'revocationHash', current_revocation.revocation_hash,
    'auditEventRef', current_audit.event_ref,
    'eventHash', current_audit.event_hash,
    'transactionId', current_audit.transaction_id
  );
EXCEPTION
  WHEN SQLSTATE 'P1601' OR SQLSTATE 'P1602' OR SQLSTATE 'P1603'
    OR SQLSTATE 'P1605' THEN RAISE;
  WHEN unique_violation THEN
    RAISE EXCEPTION 'LOR_MENTOR_IDEMPOTENCY_CONFLICT'
      USING ERRCODE = 'P1602';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_MENTOR_ASSIGNMENT_COMMAND_FAILED'
      USING ERRCODE = 'P1605';
END;
$revoke_mentor$;

REVOKE ALL ON FUNCTION lor_studio.assign_mentor_to_case(
  text, text, text, text, integer, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.revoke_mentor_case_assignment(
  text, text, text, text, text
) FROM PUBLIC;

ALTER FUNCTION lor_studio.mentor_assignment_command_context_allows(
  text, text, text, text
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.assign_mentor_to_case(
  text, text, text, text, integer, text
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.revoke_mentor_case_assignment(
  text, text, text, text, text
) OWNER TO lor_studio_command_owner;

GRANT EXECUTE ON FUNCTION lor_studio.mentor_assignment_command_context_allows(
  text, text, text, text
) TO lor_studio_command_owner;
GRANT INSERT ON TABLE
  lor_studio.mentor_case_assignments,
  lor_studio.mentor_case_assignment_revocations
TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.assign_mentor_to_case(
  text, text, text, text, integer, text
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.revoke_mentor_case_assignment(
  text, text, text, text, text
) TO lor_studio_app;

REVOKE INSERT, UPDATE, DELETE ON TABLE
  lor_studio.mentor_case_assignments,
  lor_studio.mentor_case_assignment_revocations
FROM lor_studio_app;

DO $catalog_postflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  public_execute_count bigint;
  mentor_policy_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO relation_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r';

  SELECT pg_catalog.count(*) INTO forced_rls_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind = 'r'
    AND class.relrowsecurity
    AND class.relforcerowsecurity;

  SELECT pg_catalog.count(*) INTO definer_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner';

  SELECT pg_catalog.count(*) INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  SELECT pg_catalog.count(*) INTO mentor_policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND policy.polname = ANY (ARRAY[
      'recommendation_cases_mentor_assignment_service_select',
      'mentor_case_assignments_service_select',
      'mentor_case_assignments_service_insert',
      'mentor_case_assignment_revocations_service_select',
      'mentor_case_assignment_revocations_service_insert',
      'recommendation_case_audit_mentor_assignment_service_select',
      'recommendation_case_audit_mentor_assignment_service_insert'
    ]::text[]);

  IF relation_count IS DISTINCT FROM 36
    OR forced_rls_count IS DISTINCT FROM 36
    OR definer_count IS DISTINCT FROM 34
    OR public_execute_count <> 0
    OR mentor_policy_count IS DISTINCT FROM 7
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.assign_mentor_to_case(text,text,text,text,integer,text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.revoke_mentor_case_assignment(text,text,text,text,text)',
      'EXECUTE'
    )
    OR pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.mentor_assignment_command_context_allows(text,text,text,text)',
      'EXECUTE'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.mentor_case_assignments', 'INSERT,UPDATE,DELETE'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_app',
      'lor_studio.mentor_case_assignment_revocations',
      'INSERT,UPDATE,DELETE'
    )
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_command_owner', 'lor_studio.mentor_case_assignments', 'INSERT'
    )
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.mentor_case_assignment_revocations',
      'INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.mentor_case_assignments',
      'UPDATE,DELETE'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.mentor_case_assignment_revocations',
      'UPDATE,DELETE'
    )
  THEN
    RAISE EXCEPTION 'DR-133 mentor assignment migration postflight catalog mismatch: relations=%, forced_rls=%, definers=%, public_execute=%, policies=%, app_assign=%, app_revoke=%, app_context=%, app_assignment_dml=%, app_revocation_dml=%, owner_assignment_insert=%, owner_revocation_insert=%, owner_assignment_mutation=%, owner_revocation_mutation=%',
      relation_count,
      forced_rls_count,
      definer_count,
      public_execute_count,
      mentor_policy_count,
      pg_catalog.has_function_privilege(
        'lor_studio_app',
        'lor_studio.assign_mentor_to_case(text,text,text,text,integer,text)',
        'EXECUTE'
      ),
      pg_catalog.has_function_privilege(
        'lor_studio_app',
        'lor_studio.revoke_mentor_case_assignment(text,text,text,text,text)',
        'EXECUTE'
      ),
      pg_catalog.has_function_privilege(
        'lor_studio_app',
        'lor_studio.mentor_assignment_command_context_allows(text,text,text,text)',
        'EXECUTE'
      ),
      pg_catalog.has_table_privilege(
        'lor_studio_app', 'lor_studio.mentor_case_assignments',
        'INSERT,UPDATE,DELETE'
      ),
      pg_catalog.has_table_privilege(
        'lor_studio_app', 'lor_studio.mentor_case_assignment_revocations',
        'INSERT,UPDATE,DELETE'
      ),
      pg_catalog.has_table_privilege(
        'lor_studio_command_owner', 'lor_studio.mentor_case_assignments', 'INSERT'
      ),
      pg_catalog.has_table_privilege(
        'lor_studio_command_owner',
        'lor_studio.mentor_case_assignment_revocations', 'INSERT'
      ),
      pg_catalog.has_table_privilege(
        'lor_studio_command_owner', 'lor_studio.mentor_case_assignments',
        'UPDATE,DELETE'
      ),
      pg_catalog.has_table_privilege(
        'lor_studio_command_owner',
        'lor_studio.mentor_case_assignment_revocations', 'UPDATE,DELETE'
      )
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
    observed_sentinel || '|mentorAssignmentCommands=20260826011700'
  );
END
$advance_sentinel$;

COMMIT;
