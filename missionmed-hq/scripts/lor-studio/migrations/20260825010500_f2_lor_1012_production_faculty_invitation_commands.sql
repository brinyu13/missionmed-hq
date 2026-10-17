-- Migration: 20260825010500_f2_lor_1012_production_faculty_invitation_commands.sql
-- Authority: F2-LOR-1012 / DR-120 / DR-133
-- Date: 2026-08-25
-- Depends on: 20260825010300_f2_lor_1012_production_identity_scope_commands.sql
-- Description: Add atomic faculty invitation, recipient-bound OTP, delivery receipt, and actor admission commands.
-- Exact target: MissionMed Railway project 29afe885 / lor-staging environment f5705d38 / Postgres service b49a52e7
-- Idempotent: NO

BEGIN;

DO $identity_guard$
DECLARE
  database_name text := pg_catalog.current_database();
  target_provider text := pg_catalog.current_setting('missionmed.lor.target_provider', true);
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
    'missionmed.lor.railway-postgres-target.v1|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260825010000|identityScope=20260825010300',
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
    OR target_provider IS DISTINCT FROM 'railway-postgres'
    OR target_project_id IS DISTINCT FROM '29afe885-b9b1-425d-8fd8-8611cd275409'
    OR target_environment_id IS DISTINCT FROM 'f5705d38-393c-4176-9cc2-0d1dbad42c93'
    OR target_service_id IS DISTINCT FROM 'b49a52e7-df15-4417-b67a-a64403aa5db7'
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
    RAISE EXCEPTION 'DR-133 invitation command migration requires the exact successor-bound private Railway PostgreSQL target identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_challenge_revocations,
  lor_studio.faculty_otp_challenges,
  lor_studio.faculty_otp_proof_revocations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.mentor_case_assignment_revocations,
  lor_studio.mentor_case_assignments,
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_case_protected_revision_states,
  lor_studio.recommendation_cases,
  lor_studio.student_auth_binding_revocations,
  lor_studio.student_auth_bindings
IN ACCESS EXCLUSIVE MODE;

DO $catalog_preflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO relation_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r';

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

  IF relation_count IS DISTINCT FROM 28
    OR forced_rls_count IS DISTINCT FROM 28
    OR definer_count IS DISTINCT FROM 12
    OR pg_catalog.to_regclass('lor_studio.faculty_invitation_command_receipts') IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'lor_studio'
        AND procedure.proname IN (
          'issue_faculty_invitation',
          'resend_faculty_invitation_otp',
          'revoke_faculty_invitation',
          'verify_faculty_invitation',
          'commit_faculty_invitation_delivery',
          'resolve_lor_actor_case_access'
        )
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
      JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
      WHERE granted_role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
        OR member_role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
    )
  THEN
    RAISE EXCEPTION 'DR-133 invitation command migration preflight catalog mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_preflight$;

CREATE TABLE lor_studio.faculty_invitation_command_receipts (
  receipt_id text PRIMARY KEY,
  action text NOT NULL,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  invitation_id text NOT NULL,
  delivery_action text,
  challenge_id_hash text,
  provider_message_ref_hash text,
  accepted_at timestamptz,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  result_hash text NOT NULL,
  audit_event_ref text NOT NULL,
  transaction_id text NOT NULL,
  committed_at timestamptz NOT NULL,
  CONSTRAINT faculty_invitation_command_receipts_invitation_fk
    FOREIGN KEY (invitation_id, case_id, student_auth_subject)
    REFERENCES lor_studio.faculty_invitations (invitation_id, case_id, student_auth_subject),
  CONSTRAINT faculty_invitation_command_receipts_audit_fk
    FOREIGN KEY (audit_event_ref, case_id, student_auth_subject)
    REFERENCES lor_studio.recommendation_case_audit_events (
      event_ref, case_id, student_auth_subject
    ),
  CONSTRAINT faculty_invitation_command_receipts_id_format CHECK (
    receipt_id ~ '^faculty_command_[a-f0-9]{64}$'
  ),
  CONSTRAINT faculty_invitation_command_receipts_subject_format CHECK (
    student_auth_subject ~ '^wp:[1-9][0-9]*$'
  ),
  CONSTRAINT faculty_invitation_command_receipts_action_known CHECK (action IN (
    'faculty.invitation.issue',
    'faculty.invitation.otp_resend',
    'faculty.invitation.revoke',
    'faculty.invitation.verify',
    'faculty.invitation.delivery_pending',
    'faculty.invitation.delivery_unknown',
    'faculty.invitation.delivery'
  )),
  CONSTRAINT faculty_invitation_command_receipts_key_bounds CHECK (
    pg_catalog.length(idempotency_key) BETWEEN 1 AND 240
    AND request_hash ~ '^[a-f0-9]{64}$'
    AND result_hash ~ '^[a-f0-9]{64}$'
    AND transaction_id ~ '^[0-9]+$'
  ),
  CONSTRAINT faculty_invitation_command_receipts_optional_hashes CHECK (
    (challenge_id_hash IS NULL OR challenge_id_hash ~ '^[a-f0-9]{64}$')
    AND (
      provider_message_ref_hash IS NULL
      OR provider_message_ref_hash ~ '^[a-f0-9]{64}$'
    )
  ),
  CONSTRAINT faculty_invitation_command_receipts_delivery_shape CHECK (
    (action IN (
      'faculty.invitation.delivery_pending',
      'faculty.invitation.delivery_unknown',
      'faculty.invitation.delivery'
    )) = (
      delivery_action IS NOT NULL AND delivery_action IN ('issue', 'resend')
    )
    AND (action = 'faculty.invitation.delivery') = (
      provider_message_ref_hash IS NOT NULL AND accepted_at IS NOT NULL
    )
  ),
  CONSTRAINT faculty_invitation_command_receipts_result_shape CHECK (
    pg_catalog.jsonb_typeof(result) = 'object'
    AND pg_catalog.octet_length(result::text) <= 4096
    AND result ?& ARRAY[
      'schemaVersion', 'receiptId', 'action', 'committed', 'replayed',
      'caseId', 'invitationId', 'challengeIdHash', 'invitationExpiresAt',
      'challengeExpiresAt', 'caseRevision',
      'invitationRevision', 'verified', 'reasonCode', 'auditEventRef',
      'transactionId'
    ]::text[]
    AND result - ARRAY[
      'schemaVersion', 'receiptId', 'action', 'committed', 'replayed',
      'caseId', 'invitationId', 'challengeIdHash', 'invitationExpiresAt',
      'challengeExpiresAt', 'caseRevision',
      'invitationRevision', 'verified', 'reasonCode', 'auditEventRef',
      'transactionId'
    ]::text[] = '{}'::jsonb
    AND result ->> 'schemaVersion' = 'missionmed.lor.faculty-invitation-command-receipt.v1'
    AND result ->> 'receiptId' = receipt_id
    AND result ->> 'action' = action
    AND result ->> 'committed' = 'true'
    AND result ->> 'replayed' = 'false'
    AND result ->> 'caseId' = case_id
    AND result ->> 'invitationId' = invitation_id
    AND result ->> 'auditEventRef' = audit_event_ref
    AND result ->> 'transactionId' = transaction_id
    AND (result ->> 'caseRevision') ~ '^(0|[1-9][0-9]*)$'
    AND (result ->> 'invitationRevision') ~ '^(0|[1-9][0-9]*)$'
    AND pg_catalog.jsonb_typeof(result -> 'verified') IN ('boolean', 'null')
    AND pg_catalog.jsonb_typeof(result -> 'reasonCode') IN ('string', 'null')
    AND pg_catalog.jsonb_typeof(result -> 'challengeIdHash') IN ('string', 'null')
    AND pg_catalog.jsonb_typeof(result -> 'invitationExpiresAt') IN ('string', 'null')
    AND pg_catalog.jsonb_typeof(result -> 'challengeExpiresAt') IN ('string', 'null')
    AND (
      (
        action IN ('faculty.invitation.issue', 'faculty.invitation.otp_resend')
        AND pg_catalog.jsonb_typeof(result -> 'invitationExpiresAt') = 'string'
        AND pg_catalog.jsonb_typeof(result -> 'challengeExpiresAt') = 'string'
        AND result ->> 'invitationExpiresAt' ~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
        AND result ->> 'challengeExpiresAt' ~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
      )
      OR (
        action NOT IN ('faculty.invitation.issue', 'faculty.invitation.otp_resend')
        AND pg_catalog.jsonb_typeof(result -> 'invitationExpiresAt') = 'null'
        AND pg_catalog.jsonb_typeof(result -> 'challengeExpiresAt') = 'null'
      )
    )
  ),
  CONSTRAINT faculty_invitation_command_receipts_result_hash_binding CHECK (
    result_hash = lor_studio.canonical_jsonb_sha256(result)
  ),
  CONSTRAINT faculty_invitation_command_receipts_idempotency_unique
    UNIQUE (action, idempotency_key),
  CONSTRAINT faculty_invitation_command_receipts_receipt_binding_unique
    UNIQUE (receipt_id, case_id, student_auth_subject, invitation_id),
  CONSTRAINT faculty_invitation_command_receipts_time_order CHECK (
    committed_at >= COALESCE(accepted_at, committed_at)
  )
);

CREATE INDEX faculty_invitation_command_receipts_case_idx
  ON lor_studio.faculty_invitation_command_receipts
  (case_id, student_auth_subject, invitation_id, committed_at);
CREATE INDEX faculty_invitation_command_receipts_audit_idx
  ON lor_studio.faculty_invitation_command_receipts
  (audit_event_ref, case_id, student_auth_subject);

ALTER TABLE lor_studio.faculty_invitation_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_invitation_command_receipts FORCE ROW LEVEL SECURITY;

CREATE TRIGGER faculty_invitation_command_receipts_append_only
BEFORE UPDATE OR DELETE ON lor_studio.faculty_invitation_command_receipts
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

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

ALTER TABLE lor_studio.faculty_otp_verification_receipts
  DROP CONSTRAINT faculty_otp_verification_receipts_proof_shape;
ALTER TABLE lor_studio.faculty_otp_verification_receipts
  ADD CONSTRAINT faculty_otp_verification_receipts_proof_shape CHECK (
    recipient_email_hash ~ '^[a-f0-9]{64}$'
    AND otp_proof_ref ~ '^[a-f0-9]{64}$'
    AND otp_revoked IS FALSE
    AND principal_authority = 'database_verified_otp_challenge'
    AND otp_verified_at <= invitation_used_at
    AND invitation_used_at < otp_expires_at
  );

CREATE OR REPLACE FUNCTION lor_studio.faculty_context_allows(
  resource_case_id text,
  resource_student_subject text,
  allowed_operations text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL RESTRICTED
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.current_setting('transaction_isolation', true) = 'read committed'
    AND pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) =
      resource_student_subject
    AND pg_catalog.current_setting('lor_studio.case_id', true) = resource_case_id
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (allowed_operations)
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
    AND EXISTS (
      SELECT 1
      FROM lor_studio.faculty_invitations AS invitation
      WHERE invitation.invitation_id = NULLIF(
          pg_catalog.current_setting('lor_studio.invitation_id', true), ''
        )
        AND invitation.case_id = resource_case_id
        AND invitation.student_auth_subject = resource_student_subject
        AND invitation.faculty_auth_subject = pg_catalog.current_setting(
          'lor_studio.student_auth_subject', true
        )
        AND invitation.faculty_auth_uid = NULLIF(
          pg_catalog.current_setting('request.jwt.claim.sub', true), ''
        )::uuid
        AND invitation.used_at IS NOT NULL
        AND invitation.revoked_at IS NULL
        AND invitation.used_at < invitation.expires_at
        AND EXISTS (
          SELECT 1
          FROM lor_studio.faculty_otp_verification_receipts AS verification
          WHERE verification.invitation_id = invitation.invitation_id
            AND verification.case_id = invitation.case_id
            AND verification.student_auth_subject = invitation.student_auth_subject
            AND verification.faculty_auth_subject = invitation.faculty_auth_subject
            AND verification.faculty_auth_uid = invitation.faculty_auth_uid
            AND verification.invitation_used_at = invitation.used_at
            AND verification.otp_revoked IS FALSE
            AND verification.otp_verified_at <= verification.invitation_used_at
            AND verification.invitation_used_at < verification.otp_expires_at
            AND NOT EXISTS (
              SELECT 1
              FROM lor_studio.faculty_otp_proof_revocations AS proof_revocation
              WHERE proof_revocation.receipt_id = verification.receipt_id
                AND proof_revocation.case_id = verification.case_id
                AND proof_revocation.student_auth_subject =
                  verification.student_auth_subject
            )
        )
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION lor_studio.enforce_recommendation_case_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  trusted_actor_role text := pg_catalog.current_setting('lor_studio.actor_role', true);
  trusted_operation text := pg_catalog.current_setting('lor_studio.operation', true);
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
    IF trusted_operation = 'issue_faculty_invitation' THEN
      IF OLD.status NOT IN ('draft', 'faculty_invited')
        OR NEW.status <> 'faculty_invited'
        OR NEW.record IS DISTINCT FROM OLD.record
        OR NEW.record_hash IS DISTINCT FROM OLD.record_hash THEN
        RAISE EXCEPTION 'student faculty invitation transition is invalid'
          USING ERRCODE = '42501';
      END IF;
    ELSIF OLD.status <> 'draft' OR NEW.status <> OLD.status THEN
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
      (trusted_operation = 'verify_faculty_invitation'
        AND OLD.status = 'faculty_invited' AND NEW.status = 'faculty_verified')
      OR (OLD.status = 'faculty_verified' AND NEW.status = 'faculty_review')
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
    IF trusted_operation <> 'save' THEN
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

CREATE POLICY recommendation_cases_invitation_command_select
ON lor_studio.recommendation_cases
FOR SELECT
TO lor_studio_command_owner
USING (
  lor_studio.student_context_allows(
    case_id,
    student_auth_subject,
    student_auth_uid,
    ARRAY[
      'issue_faculty_invitation',
      'resend_faculty_invitation_otp',
      'revoke_faculty_invitation'
    ]::text[]
  )
  OR (
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.operation', true) = 'verify_faculty_invitation'
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
    AND pg_catalog.current_setting('lor_studio.case_id', true) = case_id
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) = student_auth_subject
    AND (
      pg_catalog.current_setting('lor_studio.identity_resolution_verified', true) = 'true'
      OR pg_catalog.current_setting('lor_studio.operation', true) =
        'verify_faculty_invitation'
    )
    AND lor_studio.student_write_axes_satisfied()
  )
  OR (
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
    AND pg_catalog.current_setting('lor_studio.operation', true) = 'read'
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'actor_case_access_resolution'
    AND pg_catalog.current_setting('lor_studio.case_id', true) = case_id
    AND lor_studio.student_write_axes_satisfied()
  )
  OR (
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
      ARRAY[
        'reserve_faculty_invitation_delivery',
        'commit_faculty_invitation_delivery'
      ]::text[]
    )
    AND pg_catalog.current_setting('lor_studio.purpose', true) =
      'faculty_invitation_delivery'
    AND pg_catalog.current_setting('lor_studio.case_id', true) = case_id
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) = student_auth_subject
    AND lor_studio.student_write_axes_satisfied()
  )
);

CREATE POLICY recommendation_cases_invitation_command_update
ON lor_studio.recommendation_cases
FOR UPDATE
TO lor_studio_command_owner
USING (
  lor_studio.student_context_allows(
    case_id, student_auth_subject, student_auth_uid,
    ARRAY[
      'issue_faculty_invitation',
      'resend_faculty_invitation_otp',
      'revoke_faculty_invitation'
    ]::text[]
  )
  OR (
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.operation', true) = 'verify_faculty_invitation'
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
    AND pg_catalog.current_setting('lor_studio.case_id', true) = case_id
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) = student_auth_subject
    AND (
      pg_catalog.current_setting('lor_studio.identity_resolution_verified', true) = 'true'
      OR pg_catalog.current_setting('lor_studio.operation', true) =
        'verify_faculty_invitation'
    )
    AND lor_studio.student_write_axes_satisfied()
  )
  OR (
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
      ARRAY[
        'reserve_faculty_invitation_delivery',
        'commit_faculty_invitation_delivery'
      ]::text[]
    )
    AND pg_catalog.current_setting('lor_studio.purpose', true) =
      'faculty_invitation_delivery'
    AND pg_catalog.current_setting('lor_studio.case_id', true) = case_id
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) =
      student_auth_subject
    AND lor_studio.student_write_axes_satisfied()
  )
)
WITH CHECK (
  lor_studio.student_context_allows(
    case_id, student_auth_subject, student_auth_uid,
    ARRAY['issue_faculty_invitation']::text[]
  )
  OR (
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.operation', true) = 'verify_faculty_invitation'
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
    AND pg_catalog.current_setting('lor_studio.case_id', true) = case_id
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) = student_auth_subject
    AND (
      pg_catalog.current_setting('lor_studio.identity_resolution_verified', true) = 'true'
      OR pg_catalog.current_setting('lor_studio.operation', true) =
        'verify_faculty_invitation'
    )
    AND lor_studio.student_write_axes_satisfied()
  )
);

CREATE POLICY consent_receipts_invitation_command_select
ON lor_studio.consent_receipts
FOR SELECT
TO lor_studio_command_owner
USING (
  (
    lor_studio.student_context_allows(
      case_id,
      student_auth_subject,
      student_auth_uid,
      ARRAY[
        'issue_faculty_invitation',
        'resend_faculty_invitation_otp'
      ]::text[]
    )
    OR (
      pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
      AND pg_catalog.current_setting('lor_studio.operation', true) =
        'reserve_faculty_invitation_delivery'
      AND pg_catalog.current_setting('lor_studio.purpose', true) =
        'faculty_invitation_delivery'
      AND pg_catalog.current_setting('lor_studio.trusted_service_actor', true) =
        'postmark-delivery-v1'
      AND pg_catalog.current_setting('lor_studio.case_id', true) = case_id
      AND pg_catalog.current_setting('lor_studio.resource_student_id', true) =
        student_auth_subject
    )
  )
  AND lor_studio.student_write_axes_satisfied()
);

CREATE POLICY protected_revision_states_invitation_command_select
ON lor_studio.recommendation_case_protected_revision_states
FOR SELECT
TO lor_studio_command_owner
USING (
  EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id =
      recommendation_case_protected_revision_states.case_id
      AND recommendation_case.student_auth_subject =
        recommendation_case_protected_revision_states.student_auth_subject
  )
);

CREATE POLICY protected_revision_states_invitation_command_insert
ON lor_studio.recommendation_case_protected_revision_states
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  lor_studio.student_write_axes_satisfied()
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY['issue_faculty_invitation', 'verify_faculty_invitation']::text[]
  )
);

CREATE POLICY recommendation_case_audit_events_invitation_command_select
ON lor_studio.recommendation_case_audit_events
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY[
      'issue_faculty_invitation',
      'resend_faculty_invitation_otp',
      'revoke_faculty_invitation',
      'verify_faculty_invitation',
      'reserve_faculty_invitation_delivery',
      'mark_faculty_invitation_delivery_unknown',
      'commit_faculty_invitation_delivery'
    ]::text[]
  )
);

CREATE POLICY recommendation_case_audit_events_invitation_command_insert
ON lor_studio.recommendation_case_audit_events
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY[
      'issue_faculty_invitation',
      'resend_faculty_invitation_otp',
      'revoke_faculty_invitation',
      'verify_faculty_invitation',
      'reserve_faculty_invitation_delivery',
      'mark_faculty_invitation_delivery_unknown',
      'commit_faculty_invitation_delivery'
    ]::text[]
  )
);

CREATE POLICY faculty_invitations_invitation_command_select
ON lor_studio.faculty_invitations
FOR SELECT
TO lor_studio_command_owner
USING (
  (
    case_id = pg_catalog.current_setting('lor_studio.case_id', true)
    AND (
      student_auth_subject = pg_catalog.current_setting(
        'lor_studio.resource_student_id', true
      )
      OR pg_catalog.current_setting('lor_studio.operation', true) = 'read'
    )
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
      ARRAY[
        'issue_faculty_invitation',
        'resend_faculty_invitation_otp',
        'revoke_faculty_invitation',
        'verify_faculty_invitation',
        'reserve_faculty_invitation_delivery',
        'commit_faculty_invitation_delivery',
        'read'
      ]::text[]
    )
  )
  OR (
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.operation', true) =
      'verify_faculty_invitation'
    AND pg_catalog.current_setting('lor_studio.purpose', true) =
      'faculty_private_edit'
    AND student_auth_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.current_setting('lor_studio.student_auth_subject', true) ~
      '^wp:[1-9][0-9]*$'
    AND invitation_id = pg_catalog.current_setting(
      'lor_studio.invitation_id', true
    )
    AND lor_studio.student_write_axes_satisfied()
  )
);

CREATE POLICY faculty_invitations_invitation_command_insert
ON lor_studio.faculty_invitations
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  lor_studio.student_write_axes_satisfied()
  AND lor_studio.student_context_allows(
    case_id,
    student_auth_subject,
    (
      SELECT recommendation_case.student_auth_uid
      FROM lor_studio.recommendation_cases AS recommendation_case
      WHERE recommendation_case.case_id = faculty_invitations.case_id
        AND recommendation_case.student_auth_subject =
          faculty_invitations.student_auth_subject
    ),
    ARRAY['issue_faculty_invitation']::text[]
  )
);

CREATE POLICY faculty_invitations_invitation_command_update
ON lor_studio.faculty_invitations
FOR UPDATE
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND invitation_id = pg_catalog.current_setting('lor_studio.invitation_id', true)
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY[
      'resend_faculty_invitation_otp',
      'revoke_faculty_invitation',
      'verify_faculty_invitation',
      'reserve_faculty_invitation_delivery',
      'commit_faculty_invitation_delivery'
    ]::text[]
  )
)
WITH CHECK (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND invitation_id = pg_catalog.current_setting('lor_studio.invitation_id', true)
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY[
      'resend_faculty_invitation_otp',
      'revoke_faculty_invitation',
      'verify_faculty_invitation'
    ]::text[]
  )
);

CREATE POLICY faculty_otp_challenges_invitation_command_select
ON lor_studio.faculty_otp_challenges
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY[
      'resend_faculty_invitation_otp',
      'revoke_faculty_invitation',
      'verify_faculty_invitation'
    ]::text[]
  )
);

CREATE POLICY faculty_otp_challenges_invitation_command_insert
ON lor_studio.faculty_otp_challenges
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY['issue_faculty_invitation', 'resend_faculty_invitation_otp']::text[]
  )
);

CREATE POLICY faculty_otp_challenge_revocations_invitation_command_select
ON lor_studio.faculty_otp_challenge_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY[
      'resend_faculty_invitation_otp',
      'revoke_faculty_invitation',
      'verify_faculty_invitation'
    ]::text[]
  )
);

CREATE POLICY faculty_otp_challenge_revocations_invitation_command_insert
ON lor_studio.faculty_otp_challenge_revocations
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY['resend_faculty_invitation_otp', 'revoke_faculty_invitation']::text[]
  )
);

CREATE POLICY faculty_otp_verification_receipts_invitation_command_select
ON lor_studio.faculty_otp_verification_receipts
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND (
    student_auth_subject = pg_catalog.current_setting(
      'lor_studio.resource_student_id', true
    )
    OR pg_catalog.current_setting('lor_studio.operation', true) = 'read'
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY['verify_faculty_invitation', 'read']::text[]
  )
);

CREATE POLICY faculty_otp_verification_receipts_invitation_command_insert
ON lor_studio.faculty_otp_verification_receipts
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) =
    'verify_faculty_invitation'
);

CREATE POLICY faculty_otp_proof_revocations_actor_access_select
ON lor_studio.faculty_otp_proof_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND (
    student_auth_subject = pg_catalog.current_setting(
      'lor_studio.resource_student_id', true
    )
    OR pg_catalog.current_setting('lor_studio.operation', true) = 'read'
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY['verify_faculty_invitation', 'read']::text[]
  )
);

CREATE POLICY faculty_invitation_command_receipts_command_select
ON lor_studio.faculty_invitation_command_receipts
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY[
      'issue_faculty_invitation',
      'resend_faculty_invitation_otp',
      'revoke_faculty_invitation',
      'verify_faculty_invitation',
      'reserve_faculty_invitation_delivery',
      'mark_faculty_invitation_delivery_unknown',
      'commit_faculty_invitation_delivery'
    ]::text[]
  )
);

CREATE POLICY faculty_invitation_command_receipts_command_insert
ON lor_studio.faculty_invitation_command_receipts
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (
    ARRAY[
      'issue_faculty_invitation',
      'resend_faculty_invitation_otp',
      'revoke_faculty_invitation',
      'verify_faculty_invitation',
      'reserve_faculty_invitation_delivery',
      'mark_faculty_invitation_delivery_unknown',
      'commit_faculty_invitation_delivery'
    ]::text[]
  )
);

CREATE POLICY student_auth_bindings_actor_access_select
ON lor_studio.student_auth_bindings
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'read'
  AND pg_catalog.current_setting('lor_studio.purpose', true) =
    'actor_case_access_resolution'
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND lor_studio.student_write_axes_satisfied()
);

CREATE POLICY student_auth_binding_revocations_actor_access_select
ON lor_studio.student_auth_binding_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'read'
  AND pg_catalog.current_setting('lor_studio.purpose', true) =
    'actor_case_access_resolution'
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND lor_studio.student_write_axes_satisfied()
);

CREATE POLICY mentor_case_assignments_actor_access_select
ON lor_studio.mentor_case_assignments
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'read'
  AND pg_catalog.current_setting('lor_studio.purpose', true) =
    'actor_case_access_resolution'
  AND mentor_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND lor_studio.student_write_axes_satisfied()
);

CREATE POLICY mentor_case_assignment_revocations_actor_access_select
ON lor_studio.mentor_case_assignment_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'read'
  AND pg_catalog.current_setting('lor_studio.purpose', true) =
    'actor_case_access_resolution'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND lor_studio.student_write_axes_satisfied()
);

CREATE FUNCTION lor_studio.issue_faculty_invitation(
  candidate_case_id text,
  candidate_expected_revision bigint,
  candidate_invitation_id text,
  candidate_recipient_email_hash text,
  candidate_token_hash text,
  candidate_challenge_id text,
  candidate_otp_code_hash text,
  candidate_invitation_expires_at timestamptz,
  candidate_challenge_expires_at timestamptz,
  candidate_max_attempts integer,
  candidate_attempt_window_ms bigint,
  candidate_lockout_ms bigint,
  candidate_idempotency_key text,
  candidate_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $issue_invitation$
DECLARE
  current_case lor_studio.recommendation_cases%ROWTYPE;
  latest_consent_receipt lor_studio.consent_receipts%ROWTYPE;
  previous_protected lor_studio.recommendation_case_protected_revision_states%ROWTYPE;
  stored_receipt lor_studio.faculty_invitation_command_receipts%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.transaction_timestamp()
  );
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  student_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  actor_ref text;
  case_ref text;
  correlation_ref text;
  event_ref text;
  receipt_id text;
  event_record jsonb;
  event_hash text;
  version_entry jsonb;
  faculty_state jsonb;
  protected_state jsonb;
  new_protected_state_hash text;
  challenge_hash text;
  result_record jsonb;
  next_revision bigint;
BEGIN
  IF candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_expected_revision IS NULL
    OR candidate_expected_revision < 0
    OR candidate_invitation_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_challenge_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_recipient_email_hash !~ '^[a-f0-9]{64}$'
    OR candidate_token_hash !~ '^[a-f0-9]{64}$'
    OR candidate_otp_code_hash !~ '^[a-f0-9]{64}$'
    OR candidate_request_hash !~ '^[a-f0-9]{64}$'
    OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 240
    OR candidate_max_attempts NOT BETWEEN 1 AND 20
    OR candidate_attempt_window_ms NOT BETWEEN 1000 AND 86400000
    OR candidate_lockout_ms NOT BETWEEN 1000 AND 86400000
    OR candidate_invitation_expires_at <= command_at
    OR candidate_invitation_expires_at > command_at + INTERVAL '30 days'
    OR candidate_challenge_expires_at <= command_at
    OR candidate_challenge_expires_at > candidate_invitation_expires_at
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
  END IF;

  IF pg_catalog.current_setting('transaction_isolation', true) <> 'read committed'
    OR pg_catalog.current_setting('lor_studio.actor_role', true) <> 'student'
    OR pg_catalog.current_setting('lor_studio.operation', true) <>
      'issue_faculty_invitation'
    OR pg_catalog.current_setting('lor_studio.case_id', true) <> candidate_case_id
    OR pg_catalog.current_setting('lor_studio.resource_student_id', true) <>
      student_subject
    OR NOT lor_studio.student_write_axes_satisfied()
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  END IF;

  PERFORM pg_catalog.set_config(
    'lor_studio.invitation_id', candidate_invitation_id, true
  );

  SELECT recommendation_case.* INTO current_case
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = candidate_case_id
    AND recommendation_case.student_auth_subject = student_subject
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_CASE_NOT_FOUND' USING ERRCODE = 'P1303';
  END IF;

  SELECT receipt.* INTO latest_consent_receipt
  FROM lor_studio.consent_receipts AS receipt
  WHERE receipt.case_id = current_case.case_id
    AND receipt.student_auth_subject = current_case.student_auth_subject
    AND receipt.student_auth_uid = current_case.student_auth_uid
    AND receipt.case_revision <= current_case.revision
  ORDER BY receipt.case_revision DESC, receipt.recorded_at DESC, receipt.receipt_id DESC
  LIMIT 1;
  IF NOT FOUND OR NOT (
    latest_consent_receipt.policy_version = 'dr-133-identified-education-record-v1'
    AND latest_consent_receipt.scopes = ARRAY[
      'ai_drafting', 'builder_autosave', 'evidence_grounding', 'faculty_handoff'
    ]::text[]
    AND NOT ('consent_withdrawn' = ANY (latest_consent_receipt.scopes))
  ) THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  END IF;

  SELECT receipt.* INTO stored_receipt
  FROM lor_studio.faculty_invitation_command_receipts AS receipt
  WHERE receipt.action = 'faculty.invitation.issue'
    AND receipt.idempotency_key = candidate_idempotency_key;
  IF FOUND THEN
    IF stored_receipt.case_id <> candidate_case_id
      OR stored_receipt.student_auth_subject <> student_subject
      OR stored_receipt.invitation_id <> candidate_invitation_id
      OR stored_receipt.request_hash <> candidate_request_hash THEN
      RAISE EXCEPTION 'LOR_FACULTY_INVITATION_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = 'P1302';
    END IF;
    RETURN pg_catalog.jsonb_set(stored_receipt.result, '{replayed}', 'true'::jsonb);
  END IF;

  IF current_case.revision IS DISTINCT FROM candidate_expected_revision THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STALE_REVISION'
      USING ERRCODE = 'P1306';
  END IF;

  IF current_case.status NOT IN ('draft', 'faculty_invited')
    OR command_at <= current_case.updated_at
    OR pg_catalog.jsonb_typeof(current_case.record -> 'builder' -> 'completedStepIds')
      <> 'array'
    OR pg_catalog.jsonb_array_length(
      current_case.record -> 'builder' -> 'completedStepIds'
    ) <> 8
    OR NOT (
      current_case.record -> 'builder' -> 'completedStepIds' @>
      '["case_basics","writer_relationship","evidence_selection","timeline_highlights","writer_preferences","consent_and_waiver","review","faculty_handoff"]'::jsonb
    )
    OR EXISTS (
      SELECT 1
      FROM lor_studio.faculty_invitations AS invitation
      WHERE invitation.case_id = current_case.case_id
        AND invitation.student_auth_subject = current_case.student_auth_subject
        AND invitation.used_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expires_at > command_at
    )
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
  END IF;

  SELECT protected.* INTO previous_protected
  FROM lor_studio.recommendation_case_protected_revision_states AS protected
  WHERE protected.case_id = current_case.case_id
    AND protected.student_auth_subject = current_case.student_auth_subject
    AND protected.revision = current_case.revision
    AND protected.protected_state_hash = current_case.protected_state_hash;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
  END IF;

  next_revision := current_case.revision + 1;
  actor_ref := 'actor_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('actorId', student_subject)
  );
  case_ref := 'case_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('caseId', candidate_case_id)
  );
  correlation_ref := 'correlation_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'action', 'faculty.invitation.issue',
      'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  event_ref := 'event_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'correlationRef', correlation_ref,
      'outcome', 'success'
    )
  );
  receipt_id := 'faculty_command_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'action', 'faculty.invitation.issue',
      'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  faculty_state := pg_catalog.jsonb_build_object(
    'invitationId', candidate_invitation_id,
    'facultyId', NULL,
    'recipientEmailHash', candidate_recipient_email_hash,
    'verifiedAt', NULL
  );
  version_entry := pg_catalog.jsonb_build_object(
    'revision', next_revision,
    'eventType', 'faculty.invited',
    'actorId', student_subject,
    'occurredAt', pg_catalog.to_char(
      command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'changedFields', '["faculty","status"]'::jsonb,
    'changeHash', lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'faculty', faculty_state,
        'status', 'faculty_invited'
      )
    )
  );
  protected_state := pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(
      previous_protected.protected_state,
      '{faculty}', faculty_state, false
    ),
    '{versionHistory}',
    previous_protected.protected_state -> 'versionHistory'
      || pg_catalog.jsonb_build_array(version_entry),
    false
  );
  event_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.service-event.v1',
    'eventRef', event_ref,
    'eventType', 'faculty.invited',
    'caseRef', case_ref,
    'actorRef', actor_ref,
    'actorRole', 'student',
    'correlationRef', correlation_ref,
    'outcome', 'success',
    'revision', next_revision,
    'occurredAt', pg_catalog.to_char(
      command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );
  event_hash := lor_studio.canonical_jsonb_sha256(event_record);
  new_protected_state_hash := lor_studio.protected_state_chain_hash(
    current_case.case_id,
    current_case.student_auth_subject,
    next_revision,
    previous_protected.protected_state_hash,
    event_hash,
    protected_state
  );

  UPDATE lor_studio.recommendation_cases AS recommendation_case
  SET revision = next_revision,
      status = 'faculty_invited',
      updated_at = command_at,
      protected_state_hash = new_protected_state_hash
  WHERE recommendation_case.case_id = current_case.case_id
    AND recommendation_case.student_auth_subject = current_case.student_auth_subject
    AND recommendation_case.revision = current_case.revision;

  INSERT INTO lor_studio.recommendation_case_audit_events (
    event_ref, case_id, student_auth_subject, case_ref, actor_ref, actor_role,
    correlation_ref, event_type, outcome, revision, occurred_at, event,
    event_hash, transaction_id
  ) VALUES (
    event_ref, current_case.case_id, current_case.student_auth_subject,
    case_ref, actor_ref, 'student', correlation_ref, 'faculty.invited',
    'success', next_revision, command_at, event_record, event_hash, transaction_id
  );

  INSERT INTO lor_studio.recommendation_case_protected_revision_states (
    case_id, student_auth_subject, revision, previous_revision,
    previous_protected_state_hash, protected_state, protected_state_hash,
    event_hash, audit_event_ref, transaction_id, committed_at
  ) VALUES (
    current_case.case_id, current_case.student_auth_subject, next_revision,
    current_case.revision, previous_protected.protected_state_hash,
    protected_state, new_protected_state_hash, event_hash, event_ref,
    transaction_id, pg_catalog.transaction_timestamp()
  );

  INSERT INTO lor_studio.faculty_invitations (
    invitation_id, case_id, student_auth_subject, recipient_email_hash,
    token_hash, revision, failed_attempts, max_attempts, attempt_window_ms,
    lockout_ms, created_at, expires_at, updated_at
  ) VALUES (
    candidate_invitation_id, current_case.case_id, current_case.student_auth_subject,
    candidate_recipient_email_hash, candidate_token_hash, 0, 0,
    candidate_max_attempts, candidate_attempt_window_ms, candidate_lockout_ms,
    command_at, candidate_invitation_expires_at, command_at
  );

  challenge_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'challengeId', candidate_challenge_id,
      'invitationId', candidate_invitation_id,
      'caseId', current_case.case_id,
      'studentAuthSubject', current_case.student_auth_subject,
      'recipientEmailHash', candidate_recipient_email_hash,
      'otpCodeHash', candidate_otp_code_hash,
      'issuedAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'expiresAt', pg_catalog.to_char(
        candidate_challenge_expires_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    )
  );
  INSERT INTO lor_studio.faculty_otp_challenges (
    challenge_id, invitation_id, case_id, student_auth_subject,
    recipient_email_hash, otp_code_hash, issued_at, expires_at, challenge_hash
  ) VALUES (
    candidate_challenge_id, candidate_invitation_id, current_case.case_id,
    current_case.student_auth_subject, candidate_recipient_email_hash,
    candidate_otp_code_hash, command_at, candidate_challenge_expires_at,
    challenge_hash
  );

  result_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.faculty-invitation-command-receipt.v1',
    'receiptId', receipt_id,
    'action', 'faculty.invitation.issue',
    'committed', true,
    'replayed', false,
    'caseId', current_case.case_id,
    'invitationId', candidate_invitation_id,
    'challengeIdHash', lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('challengeId', candidate_challenge_id)
    ),
    'invitationExpiresAt', pg_catalog.to_char(
      candidate_invitation_expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'challengeExpiresAt', pg_catalog.to_char(
      candidate_challenge_expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'caseRevision', next_revision,
    'invitationRevision', 0,
    'verified', NULL,
    'reasonCode', NULL,
    'auditEventRef', event_ref,
    'transactionId', transaction_id
  );

  INSERT INTO lor_studio.faculty_invitation_command_receipts (
    receipt_id, action, case_id, student_auth_subject, invitation_id,
    challenge_id_hash, idempotency_key, request_hash, result, result_hash,
    audit_event_ref, transaction_id, committed_at
  ) VALUES (
    receipt_id, 'faculty.invitation.issue', current_case.case_id,
    current_case.student_auth_subject, candidate_invitation_id,
    result_record ->> 'challengeIdHash', candidate_idempotency_key,
    candidate_request_hash, result_record,
    lor_studio.canonical_jsonb_sha256(result_record), event_ref,
    transaction_id, pg_catalog.transaction_timestamp()
  );

  RETURN result_record;
EXCEPTION
  WHEN SQLSTATE 'P1301' OR SQLSTATE 'P1302' OR SQLSTATE 'P1303'
    OR SQLSTATE 'P1304' OR SQLSTATE 'P1305' OR SQLSTATE 'P1306' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
END;
$issue_invitation$;

CREATE FUNCTION lor_studio.resend_faculty_invitation_otp(
  candidate_case_id text,
  candidate_recipient_email_hash text,
  candidate_challenge_id text,
  candidate_otp_code_hash text,
  candidate_challenge_expires_at timestamptz,
  candidate_idempotency_key text,
  candidate_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $resend_otp$
DECLARE
  current_case lor_studio.recommendation_cases%ROWTYPE;
  latest_consent_receipt lor_studio.consent_receipts%ROWTYPE;
  current_invitation lor_studio.faculty_invitations%ROWTYPE;
  stored_receipt lor_studio.faculty_invitation_command_receipts%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.transaction_timestamp()
  );
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  student_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  actor_ref text;
  case_ref text;
  correlation_ref text;
  event_ref text;
  receipt_id text;
  event_record jsonb;
  event_hash text;
  result_record jsonb;
  challenge_id_hash text;
  active_invitation_count bigint;
BEGIN
  IF candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_recipient_email_hash !~ '^[a-f0-9]{64}$'
    OR candidate_challenge_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_otp_code_hash !~ '^[a-f0-9]{64}$'
    OR candidate_request_hash !~ '^[a-f0-9]{64}$'
    OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 240
    OR candidate_challenge_expires_at <= command_at
    OR candidate_challenge_expires_at > command_at + INTERVAL '30 minutes'
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
  END IF;
  IF pg_catalog.current_setting('transaction_isolation', true) <> 'read committed'
    OR pg_catalog.current_setting('lor_studio.actor_role', true) <> 'student'
    OR pg_catalog.current_setting('lor_studio.operation', true) <>
      'resend_faculty_invitation_otp'
    OR pg_catalog.current_setting('lor_studio.case_id', true) <> candidate_case_id
    OR pg_catalog.current_setting('lor_studio.resource_student_id', true) <>
      student_subject
    OR NOT lor_studio.student_write_axes_satisfied()
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  END IF;
  SELECT recommendation_case.* INTO current_case
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = candidate_case_id
    AND recommendation_case.student_auth_subject = student_subject
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_CASE_NOT_FOUND' USING ERRCODE = 'P1303';
  END IF;

  SELECT receipt.* INTO latest_consent_receipt
  FROM lor_studio.consent_receipts AS receipt
  WHERE receipt.case_id = current_case.case_id
    AND receipt.student_auth_subject = current_case.student_auth_subject
    AND receipt.student_auth_uid = current_case.student_auth_uid
    AND receipt.case_revision <= current_case.revision
  ORDER BY receipt.case_revision DESC, receipt.recorded_at DESC, receipt.receipt_id DESC
  LIMIT 1;
  IF NOT FOUND OR NOT (
    latest_consent_receipt.policy_version = 'dr-133-identified-education-record-v1'
    AND latest_consent_receipt.scopes = ARRAY[
      'ai_drafting', 'builder_autosave', 'evidence_grounding', 'faculty_handoff'
    ]::text[]
    AND NOT ('consent_withdrawn' = ANY (latest_consent_receipt.scopes))
  ) THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  END IF;

  SELECT receipt.* INTO stored_receipt
  FROM lor_studio.faculty_invitation_command_receipts AS receipt
  WHERE receipt.action = 'faculty.invitation.otp_resend'
    AND receipt.idempotency_key = candidate_idempotency_key;
  IF FOUND THEN
    IF stored_receipt.case_id <> candidate_case_id
      OR stored_receipt.student_auth_subject <> student_subject
      OR stored_receipt.request_hash <> candidate_request_hash THEN
      RAISE EXCEPTION 'LOR_FACULTY_INVITATION_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = 'P1302';
    END IF;
    RETURN pg_catalog.jsonb_set(stored_receipt.result, '{replayed}', 'true'::jsonb);
  END IF;
  SELECT pg_catalog.count(*) INTO active_invitation_count
  FROM lor_studio.faculty_invitations AS invitation
  WHERE invitation.case_id = current_case.case_id
    AND invitation.student_auth_subject = current_case.student_auth_subject
    AND invitation.used_at IS NULL
    AND invitation.revoked_at IS NULL
    AND invitation.expires_at > command_at;
  IF active_invitation_count IS DISTINCT FROM 1::bigint THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
  END IF;
  SELECT invitation.* INTO current_invitation
  FROM lor_studio.faculty_invitations AS invitation
  WHERE invitation.case_id = current_case.case_id
    AND invitation.student_auth_subject = current_case.student_auth_subject
    AND invitation.used_at IS NULL
    AND invitation.revoked_at IS NULL
    AND invitation.expires_at > command_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_CASE_NOT_FOUND' USING ERRCODE = 'P1303';
  END IF;
  PERFORM pg_catalog.set_config(
    'lor_studio.invitation_id', current_invitation.invitation_id, true
  );
  IF current_case.status <> 'faculty_invited'
    OR current_invitation.recipient_email_hash <>
      candidate_recipient_email_hash
    OR candidate_challenge_expires_at > current_invitation.expires_at THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
  END IF;

  actor_ref := 'actor_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('actorId', student_subject)
  );
  case_ref := 'case_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('caseId', candidate_case_id)
  );
  correlation_ref := 'correlation_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'action', 'faculty.invitation.otp_resend',
      'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  event_ref := 'event_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('correlationRef', correlation_ref, 'outcome', 'success')
  );
  receipt_id := 'faculty_command_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'action', 'faculty.invitation.otp_resend',
      'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  event_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.service-event.v1',
    'eventRef', event_ref,
    'eventType', 'faculty.invitation_otp_resent',
    'caseRef', case_ref,
    'actorRef', actor_ref,
    'actorRole', 'student',
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
    event_ref, current_case.case_id, current_case.student_auth_subject,
    case_ref, actor_ref, 'student', correlation_ref,
    'faculty.invitation_otp_resent', 'success', current_case.revision,
    command_at, event_record, event_hash, transaction_id
  );

  INSERT INTO lor_studio.faculty_otp_challenge_revocations (
    challenge_id, invitation_id, case_id, student_auth_subject,
    revoked_at, reason_code, audit_event_ref, revocation_hash
  )
  SELECT
    challenge.challenge_id,
    challenge.invitation_id,
    challenge.case_id,
    challenge.student_auth_subject,
    command_at,
    'OTP_RESENT',
    event_ref,
    lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
      'challengeId', challenge.challenge_id,
      'reasonCode', 'OTP_RESENT',
      'revokedAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'auditEventRef', event_ref
    ))
  FROM lor_studio.faculty_otp_challenges AS challenge
  WHERE challenge.invitation_id = current_invitation.invitation_id
    AND challenge.case_id = current_invitation.case_id
    AND challenge.student_auth_subject = current_invitation.student_auth_subject
    AND NOT EXISTS (
      SELECT 1
      FROM lor_studio.faculty_otp_challenge_revocations AS revocation
      WHERE revocation.challenge_id = challenge.challenge_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM lor_studio.faculty_otp_verification_receipts AS verification
      WHERE verification.challenge_id = challenge.challenge_id
    );

  UPDATE lor_studio.faculty_invitations AS invitation
  SET revision = current_invitation.revision + 1,
      failed_attempts = 0,
      attempt_window_started_at = NULL,
      locked_until = NULL,
      last_failure_code = NULL,
      updated_at = command_at
  WHERE invitation.invitation_id = current_invitation.invitation_id
    AND invitation.case_id = current_invitation.case_id
    AND invitation.student_auth_subject = current_invitation.student_auth_subject
    AND invitation.revision = current_invitation.revision;

  INSERT INTO lor_studio.faculty_otp_challenges (
    challenge_id, invitation_id, case_id, student_auth_subject,
    recipient_email_hash, otp_code_hash, issued_at, expires_at, challenge_hash
  ) VALUES (
    candidate_challenge_id, current_invitation.invitation_id,
    current_invitation.case_id, current_invitation.student_auth_subject,
    current_invitation.recipient_email_hash, candidate_otp_code_hash,
    command_at, candidate_challenge_expires_at,
    lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
      'challengeId', candidate_challenge_id,
      'invitationId', current_invitation.invitation_id,
      'caseId', current_invitation.case_id,
      'studentAuthSubject', current_invitation.student_auth_subject,
      'recipientEmailHash', current_invitation.recipient_email_hash,
      'otpCodeHash', candidate_otp_code_hash,
      'issuedAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'expiresAt', pg_catalog.to_char(
        candidate_challenge_expires_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    ))
  );

  challenge_id_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('challengeId', candidate_challenge_id)
  );
  result_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.faculty-invitation-command-receipt.v1',
    'receiptId', receipt_id,
    'action', 'faculty.invitation.otp_resend',
    'committed', true,
    'replayed', false,
    'caseId', current_case.case_id,
    'invitationId', current_invitation.invitation_id,
    'challengeIdHash', challenge_id_hash,
    'invitationExpiresAt', pg_catalog.to_char(
      current_invitation.expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'challengeExpiresAt', pg_catalog.to_char(
      candidate_challenge_expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'caseRevision', current_case.revision,
    'invitationRevision', current_invitation.revision + 1,
    'verified', NULL,
    'reasonCode', NULL,
    'auditEventRef', event_ref,
    'transactionId', transaction_id
  );
  INSERT INTO lor_studio.faculty_invitation_command_receipts (
    receipt_id, action, case_id, student_auth_subject, invitation_id,
    challenge_id_hash, idempotency_key, request_hash, result, result_hash,
    audit_event_ref, transaction_id, committed_at
  ) VALUES (
    receipt_id, 'faculty.invitation.otp_resend', current_case.case_id,
    current_case.student_auth_subject, current_invitation.invitation_id,
    challenge_id_hash, candidate_idempotency_key, candidate_request_hash,
    result_record, lor_studio.canonical_jsonb_sha256(result_record),
    event_ref, transaction_id, pg_catalog.transaction_timestamp()
  );
  RETURN result_record;
EXCEPTION
  WHEN SQLSTATE 'P1301' OR SQLSTATE 'P1302' OR SQLSTATE 'P1303'
    OR SQLSTATE 'P1304' OR SQLSTATE 'P1305' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
END;
$resend_otp$;

CREATE FUNCTION lor_studio.revoke_faculty_invitation(
  candidate_case_id text,
  candidate_idempotency_key text,
  candidate_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $revoke_invitation$
DECLARE
  current_case lor_studio.recommendation_cases%ROWTYPE;
  current_invitation lor_studio.faculty_invitations%ROWTYPE;
  stored_receipt lor_studio.faculty_invitation_command_receipts%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.transaction_timestamp()
  );
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  student_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  actor_ref text;
  case_ref text;
  correlation_ref text;
  event_ref text;
  receipt_id text;
  event_record jsonb;
  event_hash text;
  result_record jsonb;
  active_invitation_count bigint;
BEGIN
  IF candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_request_hash !~ '^[a-f0-9]{64}$'
    OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
  END IF;
  IF pg_catalog.current_setting('transaction_isolation', true) <> 'read committed'
    OR pg_catalog.current_setting('lor_studio.actor_role', true) <> 'student'
    OR pg_catalog.current_setting('lor_studio.operation', true) <>
      'revoke_faculty_invitation'
    OR pg_catalog.current_setting('lor_studio.case_id', true) <> candidate_case_id
    OR pg_catalog.current_setting('lor_studio.resource_student_id', true) <>
      student_subject
    OR NOT lor_studio.student_write_axes_satisfied()
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  END IF;
  SELECT receipt.* INTO stored_receipt
  FROM lor_studio.faculty_invitation_command_receipts AS receipt
  WHERE receipt.action = 'faculty.invitation.revoke'
    AND receipt.idempotency_key = candidate_idempotency_key;
  IF FOUND THEN
    IF stored_receipt.case_id <> candidate_case_id
      OR stored_receipt.student_auth_subject <> student_subject
      OR stored_receipt.request_hash <> candidate_request_hash THEN
      RAISE EXCEPTION 'LOR_FACULTY_INVITATION_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = 'P1302';
    END IF;
    RETURN pg_catalog.jsonb_set(stored_receipt.result, '{replayed}', 'true'::jsonb);
  END IF;

  SELECT recommendation_case.* INTO current_case
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = candidate_case_id
    AND recommendation_case.student_auth_subject = student_subject
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_CASE_NOT_FOUND' USING ERRCODE = 'P1303';
  END IF;
  SELECT pg_catalog.count(*) INTO active_invitation_count
  FROM lor_studio.faculty_invitations AS invitation
  WHERE invitation.case_id = current_case.case_id
    AND invitation.student_auth_subject = current_case.student_auth_subject
    AND invitation.used_at IS NULL
    AND invitation.revoked_at IS NULL
    AND invitation.expires_at > command_at;
  IF active_invitation_count IS DISTINCT FROM 1::bigint THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
  END IF;
  SELECT invitation.* INTO current_invitation
  FROM lor_studio.faculty_invitations AS invitation
  WHERE invitation.case_id = current_case.case_id
    AND invitation.student_auth_subject = current_case.student_auth_subject
    AND invitation.used_at IS NULL
    AND invitation.revoked_at IS NULL
    AND invitation.expires_at > command_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_CASE_NOT_FOUND' USING ERRCODE = 'P1303';
  END IF;
  PERFORM pg_catalog.set_config(
    'lor_studio.invitation_id', current_invitation.invitation_id, true
  );
  IF current_case.status <> 'faculty_invited'
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
  END IF;

  actor_ref := 'actor_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('actorId', student_subject)
  );
  case_ref := 'case_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('caseId', candidate_case_id)
  );
  correlation_ref := 'correlation_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'action', 'faculty.invitation.revoke',
      'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  event_ref := 'event_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('correlationRef', correlation_ref, 'outcome', 'success')
  );
  receipt_id := 'faculty_command_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'action', 'faculty.invitation.revoke',
      'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  event_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.service-event.v1',
    'eventRef', event_ref,
    'eventType', 'faculty.invitation_revoked',
    'caseRef', case_ref,
    'actorRef', actor_ref,
    'actorRole', 'student',
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
    event_ref, current_case.case_id, current_case.student_auth_subject,
    case_ref, actor_ref, 'student', correlation_ref,
    'faculty.invitation_revoked', 'success', current_case.revision,
    command_at, event_record, event_hash, transaction_id
  );

  INSERT INTO lor_studio.faculty_otp_challenge_revocations (
    challenge_id, invitation_id, case_id, student_auth_subject,
    revoked_at, reason_code, audit_event_ref, revocation_hash
  )
  SELECT
    challenge.challenge_id,
    challenge.invitation_id,
    challenge.case_id,
    challenge.student_auth_subject,
    command_at,
    'INVITATION_REVOKED',
    event_ref,
    lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
      'challengeId', challenge.challenge_id,
      'reasonCode', 'INVITATION_REVOKED',
      'revokedAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'auditEventRef', event_ref
    ))
  FROM lor_studio.faculty_otp_challenges AS challenge
  WHERE challenge.invitation_id = current_invitation.invitation_id
    AND challenge.case_id = current_invitation.case_id
    AND challenge.student_auth_subject = current_invitation.student_auth_subject
    AND NOT EXISTS (
      SELECT 1
      FROM lor_studio.faculty_otp_challenge_revocations AS revocation
      WHERE revocation.challenge_id = challenge.challenge_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM lor_studio.faculty_otp_verification_receipts AS verification
      WHERE verification.challenge_id = challenge.challenge_id
    );

  UPDATE lor_studio.faculty_invitations AS invitation
  SET revision = current_invitation.revision + 1,
      revoked_at = command_at,
      updated_at = command_at
  WHERE invitation.invitation_id = current_invitation.invitation_id
    AND invitation.case_id = current_invitation.case_id
    AND invitation.student_auth_subject = current_invitation.student_auth_subject
    AND invitation.revision = current_invitation.revision;

  result_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.faculty-invitation-command-receipt.v1',
    'receiptId', receipt_id,
    'action', 'faculty.invitation.revoke',
    'committed', true,
    'replayed', false,
    'caseId', current_case.case_id,
    'invitationId', current_invitation.invitation_id,
    'challengeIdHash', NULL,
    'invitationExpiresAt', NULL,
    'challengeExpiresAt', NULL,
    'caseRevision', current_case.revision,
    'invitationRevision', current_invitation.revision + 1,
    'verified', NULL,
    'reasonCode', NULL,
    'auditEventRef', event_ref,
    'transactionId', transaction_id
  );
  INSERT INTO lor_studio.faculty_invitation_command_receipts (
    receipt_id, action, case_id, student_auth_subject, invitation_id,
    idempotency_key, request_hash, result, result_hash,
    audit_event_ref, transaction_id, committed_at
  ) VALUES (
    receipt_id, 'faculty.invitation.revoke', current_case.case_id,
    current_case.student_auth_subject, current_invitation.invitation_id,
    candidate_idempotency_key, candidate_request_hash, result_record,
    lor_studio.canonical_jsonb_sha256(result_record), event_ref,
    transaction_id, pg_catalog.transaction_timestamp()
  );
  RETURN result_record;
EXCEPTION
  WHEN SQLSTATE 'P1301' OR SQLSTATE 'P1302' OR SQLSTATE 'P1303'
    OR SQLSTATE 'P1304' OR SQLSTATE 'P1305' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
END;
$revoke_invitation$;

CREATE FUNCTION lor_studio.verify_faculty_invitation(
  candidate_invitation_id text,
  candidate_recipient_email_hash text,
  candidate_token_hash text,
  candidate_otp_code text,
  candidate_idempotency_key text,
  candidate_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $verify_invitation$
DECLARE
  current_case lor_studio.recommendation_cases%ROWTYPE;
  current_invitation lor_studio.faculty_invitations%ROWTYPE;
  current_challenge lor_studio.faculty_otp_challenges%ROWTYPE;
  previous_protected lor_studio.recommendation_case_protected_revision_states%ROWTYPE;
  stored_receipt lor_studio.faculty_invitation_command_receipts%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.transaction_timestamp()
  );
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  faculty_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  faculty_uid uuid;
  faculty_uid_hex text;
  reason_code text;
  retryable_denial boolean := false;
  next_failed_attempts integer;
  next_window_started_at timestamptz;
  next_locked_until timestamptz;
  invitation_revision bigint;
  next_case_revision bigint;
  actor_ref text;
  case_ref text;
  correlation_ref text;
  event_ref text;
  receipt_id text;
  verification_receipt_id text;
  event_record jsonb;
  event_hash text;
  version_entry jsonb;
  faculty_state jsonb;
  protected_state jsonb;
  new_protected_state_hash text;
  challenge_id_hash text;
  database_otp_proof_ref text;
  result_record jsonb;
BEGIN
  IF candidate_invitation_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_recipient_email_hash !~ '^[a-f0-9]{64}$'
    OR candidate_token_hash !~ '^[a-f0-9]{64}$'
    OR candidate_otp_code !~ '^[0-9]{6}$'
    OR candidate_request_hash !~ '^[a-f0-9]{64}$'
    OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 240
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
  END IF;
  IF pg_catalog.current_setting('transaction_isolation', true) <> 'read committed'
    OR pg_catalog.current_setting('lor_studio.actor_role', true) <> 'faculty'
    OR faculty_subject !~ '^wp:[1-9][0-9]*$'
    OR pg_catalog.current_setting('lor_studio.operation', true) <>
      'verify_faculty_invitation'
    OR pg_catalog.current_setting('lor_studio.purpose', true) <> 'faculty_private_edit'
    OR NOT lor_studio.student_write_axes_satisfied()
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'lor-studio:faculty.invitation.verify:idempotency:' ||
        candidate_idempotency_key,
      0
    )
  );
  faculty_uid_hex := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    'missionmed.lor.faculty-auth-uid.v1:' || faculty_subject,
    'UTF8'
  )), 'hex');
  faculty_uid := (
    pg_catalog.substr(faculty_uid_hex, 1, 8) || '-' ||
    pg_catalog.substr(faculty_uid_hex, 9, 4) || '-5' ||
    pg_catalog.substr(faculty_uid_hex, 14, 3) || '-8' ||
    pg_catalog.substr(faculty_uid_hex, 18, 3) || '-' ||
    pg_catalog.substr(faculty_uid_hex, 21, 12)
  )::uuid;
  PERFORM pg_catalog.set_config(
    'lor_studio.invitation_id', candidate_invitation_id, true
  );

  SELECT invitation.* INTO current_invitation
  FROM lor_studio.faculty_invitations AS invitation
  WHERE invitation.invitation_id = candidate_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_CASE_NOT_FOUND' USING ERRCODE = 'P1303';
  END IF;
  PERFORM pg_catalog.set_config(
    'lor_studio.case_id', current_invitation.case_id, true
  );
  PERFORM pg_catalog.set_config(
    'lor_studio.resource_student_id', current_invitation.student_auth_subject, true
  );

  SELECT recommendation_case.* INTO current_case
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = current_invitation.case_id
    AND recommendation_case.student_auth_subject =
      current_invitation.student_auth_subject
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_CASE_NOT_FOUND' USING ERRCODE = 'P1303';
  END IF;
  SELECT invitation.* INTO current_invitation
  FROM lor_studio.faculty_invitations AS invitation
  WHERE invitation.invitation_id = candidate_invitation_id
    AND invitation.case_id = current_case.case_id
    AND invitation.student_auth_subject = current_case.student_auth_subject
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_CASE_NOT_FOUND' USING ERRCODE = 'P1303';
  END IF;

  IF faculty_subject = current_case.student_auth_subject THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  END IF;

  SELECT receipt.* INTO stored_receipt
  FROM lor_studio.faculty_invitation_command_receipts AS receipt
  WHERE receipt.action = 'faculty.invitation.verify'
    AND receipt.idempotency_key = candidate_idempotency_key;
  IF FOUND THEN
    IF stored_receipt.case_id <> current_invitation.case_id
      OR stored_receipt.invitation_id <> current_invitation.invitation_id
      OR stored_receipt.request_hash <> candidate_request_hash THEN
      RAISE EXCEPTION 'LOR_FACULTY_INVITATION_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = 'P1302';
    END IF;
    RETURN pg_catalog.jsonb_set(stored_receipt.result, '{replayed}', 'true'::jsonb);
  END IF;

  SELECT challenge.* INTO current_challenge
  FROM lor_studio.faculty_otp_challenges AS challenge
  WHERE challenge.invitation_id = current_invitation.invitation_id
    AND challenge.case_id = current_invitation.case_id
    AND challenge.student_auth_subject = current_invitation.student_auth_subject
    AND NOT EXISTS (
      SELECT 1
      FROM lor_studio.faculty_otp_challenge_revocations AS revocation
      WHERE revocation.challenge_id = challenge.challenge_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM lor_studio.faculty_otp_verification_receipts AS verification
      WHERE verification.challenge_id = challenge.challenge_id
    )
  ORDER BY challenge.issued_at DESC, challenge.challenge_id DESC
  LIMIT 1;

  IF current_invitation.revoked_at IS NOT NULL THEN
    reason_code := 'INVITATION_REVOKED';
  ELSIF current_invitation.used_at IS NOT NULL THEN
    reason_code := 'INVITATION_ALREADY_USED';
  ELSIF current_invitation.expires_at <= command_at THEN
    reason_code := 'INVITATION_EXPIRED';
  ELSIF current_invitation.locked_until IS NOT NULL
    AND current_invitation.locked_until > command_at THEN
    reason_code := 'INVITATION_LOCKED';
  ELSIF current_challenge.challenge_id IS NULL
    OR current_challenge.expires_at <= command_at
    OR command_at < current_challenge.issued_at THEN
    reason_code := 'OTP_NOT_VERIFIED';
    retryable_denial := true;
  ELSIF candidate_recipient_email_hash <> current_invitation.recipient_email_hash THEN
    reason_code := 'RECIPIENT_MISMATCH';
    retryable_denial := true;
  ELSIF candidate_token_hash <> current_invitation.token_hash THEN
    reason_code := 'TOKEN_MISMATCH';
    retryable_denial := true;
  ELSIF pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    'lor-studio:otp-attempt:' || current_challenge.challenge_id || ':' ||
      candidate_otp_code,
    'UTF8'
  )), 'hex') <> current_challenge.otp_code_hash THEN
    reason_code := 'OTP_NOT_VERIFIED';
    retryable_denial := true;
  END IF;

  actor_ref := 'actor_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('actorId', faculty_subject)
  );
  case_ref := 'case_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('caseId', current_case.case_id)
  );
  correlation_ref := 'correlation_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'action', 'faculty.invitation.verify',
      'caseId', current_case.case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  event_ref := 'event_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'correlationRef', correlation_ref,
      'outcome', CASE WHEN reason_code IS NULL THEN 'success' ELSE 'denied' END
    )
  );
  receipt_id := 'faculty_command_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'action', 'faculty.invitation.verify',
      'caseId', current_case.case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  challenge_id_hash := CASE
    WHEN current_challenge.challenge_id IS NULL THEN NULL
    ELSE lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('challengeId', current_challenge.challenge_id)
    )
  END;

  IF reason_code IS NOT NULL THEN
    invitation_revision := current_invitation.revision;
    IF retryable_denial THEN
      IF current_invitation.attempt_window_started_at IS NULL
        OR command_at >= current_invitation.attempt_window_started_at
          + pg_catalog.make_interval(
            secs => current_invitation.attempt_window_ms::double precision / 1000.0
          ) THEN
        next_window_started_at := command_at;
        next_failed_attempts := 1;
      ELSE
        next_window_started_at := current_invitation.attempt_window_started_at;
        next_failed_attempts := current_invitation.failed_attempts + 1;
      END IF;
      next_failed_attempts := LEAST(
        next_failed_attempts, current_invitation.max_attempts
      );
      next_locked_until := CASE
        WHEN next_failed_attempts = current_invitation.max_attempts
        THEN command_at + pg_catalog.make_interval(
          secs => current_invitation.lockout_ms::double precision / 1000.0
        )
        ELSE NULL
      END;
      UPDATE lor_studio.faculty_invitations AS invitation
      SET revision = current_invitation.revision + 1,
          failed_attempts = next_failed_attempts,
          attempt_window_started_at = next_window_started_at,
          locked_until = next_locked_until,
          last_failure_code = reason_code,
          updated_at = command_at
      WHERE invitation.invitation_id = current_invitation.invitation_id
        AND invitation.case_id = current_invitation.case_id
        AND invitation.student_auth_subject = current_invitation.student_auth_subject
        AND invitation.revision = current_invitation.revision;
      invitation_revision := current_invitation.revision + 1;
    END IF;

    event_record := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.service-event.v1',
      'eventRef', event_ref,
      'eventType', 'faculty.verification_denied',
      'caseRef', case_ref,
      'actorRef', actor_ref,
      'actorRole', 'faculty',
      'correlationRef', correlation_ref,
      'outcome', 'denied',
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
      event_ref, current_case.case_id, current_case.student_auth_subject,
      case_ref, actor_ref, 'faculty', correlation_ref,
      'faculty.verification_denied', 'denied', current_case.revision,
      command_at, event_record, event_hash, transaction_id
    );
    result_record := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.faculty-invitation-command-receipt.v1',
      'receiptId', receipt_id,
      'action', 'faculty.invitation.verify',
      'committed', true,
      'replayed', false,
      'caseId', current_case.case_id,
      'invitationId', current_invitation.invitation_id,
      'challengeIdHash', challenge_id_hash,
      'invitationExpiresAt', NULL,
      'challengeExpiresAt', NULL,
      'caseRevision', current_case.revision,
      'invitationRevision', invitation_revision,
      'verified', false,
      'reasonCode', reason_code,
      'auditEventRef', event_ref,
      'transactionId', transaction_id
    );
  ELSE
    IF current_case.status <> 'faculty_invited' OR command_at <= current_case.updated_at THEN
      RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
    END IF;
    SELECT protected.* INTO previous_protected
    FROM lor_studio.recommendation_case_protected_revision_states AS protected
    WHERE protected.case_id = current_case.case_id
      AND protected.student_auth_subject = current_case.student_auth_subject
      AND protected.revision = current_case.revision
      AND protected.protected_state_hash = current_case.protected_state_hash;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
    END IF;

    UPDATE lor_studio.faculty_invitations AS invitation
    SET revision = current_invitation.revision + 1,
        faculty_auth_subject = faculty_subject,
        faculty_auth_uid = faculty_uid,
        failed_attempts = 0,
        attempt_window_started_at = NULL,
        locked_until = NULL,
        last_failure_code = NULL,
        used_at = command_at,
        updated_at = command_at
    WHERE invitation.invitation_id = current_invitation.invitation_id
      AND invitation.case_id = current_invitation.case_id
      AND invitation.student_auth_subject = current_invitation.student_auth_subject
      AND invitation.revision = current_invitation.revision;

    next_case_revision := current_case.revision + 1;
    invitation_revision := current_invitation.revision + 1;
    faculty_state := pg_catalog.jsonb_build_object(
      'invitationId', current_invitation.invitation_id,
      'facultyId', faculty_subject,
      'recipientEmailHash', current_invitation.recipient_email_hash,
      'verifiedAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    );
    version_entry := pg_catalog.jsonb_build_object(
      'revision', next_case_revision,
      'eventType', 'faculty.verified',
      'actorId', faculty_subject,
      'occurredAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'changedFields', '["faculty","status"]'::jsonb,
      'changeHash', lor_studio.canonical_jsonb_sha256(
        pg_catalog.jsonb_build_object(
          'faculty', faculty_state,
          'status', 'faculty_verified'
        )
      )
    );
    protected_state := pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(
        previous_protected.protected_state,
        '{faculty}', faculty_state, false
      ),
      '{versionHistory}',
      previous_protected.protected_state -> 'versionHistory'
        || pg_catalog.jsonb_build_array(version_entry),
      false
    );
    event_record := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.service-event.v1',
      'eventRef', event_ref,
      'eventType', 'faculty.verified',
      'caseRef', case_ref,
      'actorRef', actor_ref,
      'actorRole', 'faculty',
      'correlationRef', correlation_ref,
      'outcome', 'success',
      'revision', next_case_revision,
      'occurredAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    );
    event_hash := lor_studio.canonical_jsonb_sha256(event_record);
    new_protected_state_hash := lor_studio.protected_state_chain_hash(
      current_case.case_id, current_case.student_auth_subject,
      next_case_revision, previous_protected.protected_state_hash,
      event_hash, protected_state
    );
    UPDATE lor_studio.recommendation_cases AS recommendation_case
    SET revision = next_case_revision,
        status = 'faculty_verified',
        updated_at = command_at,
        protected_state_hash = new_protected_state_hash
    WHERE recommendation_case.case_id = current_case.case_id
      AND recommendation_case.student_auth_subject = current_case.student_auth_subject
      AND recommendation_case.revision = current_case.revision;
    INSERT INTO lor_studio.recommendation_case_audit_events (
      event_ref, case_id, student_auth_subject, case_ref, actor_ref, actor_role,
      correlation_ref, event_type, outcome, revision, occurred_at, event,
      event_hash, transaction_id
    ) VALUES (
      event_ref, current_case.case_id, current_case.student_auth_subject,
      case_ref, actor_ref, 'faculty', correlation_ref, 'faculty.verified',
      'success', next_case_revision, command_at, event_record, event_hash,
      transaction_id
    );
    INSERT INTO lor_studio.recommendation_case_protected_revision_states (
      case_id, student_auth_subject, revision, previous_revision,
      previous_protected_state_hash, protected_state, protected_state_hash,
      event_hash, audit_event_ref, transaction_id, committed_at
    ) VALUES (
      current_case.case_id, current_case.student_auth_subject,
      next_case_revision, current_case.revision,
      previous_protected.protected_state_hash, protected_state,
      new_protected_state_hash, event_hash, event_ref, transaction_id,
      pg_catalog.transaction_timestamp()
    );
    verification_receipt_id := 'otp_receipt_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'challengeId', current_challenge.challenge_id,
        'facultyAuthSubject', faculty_subject,
        'transactionId', transaction_id
      )
    );
    database_otp_proof_ref := lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.database-otp-proof.v1',
        'challengeId', current_challenge.challenge_id,
        'invitationId', current_invitation.invitation_id,
        'facultyAuthSubject', faculty_subject,
        'transactionId', transaction_id,
        'verifiedAt', pg_catalog.to_char(
          command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
    );
    INSERT INTO lor_studio.faculty_otp_verification_receipts (
      receipt_id, challenge_id, invitation_id, case_id, student_auth_subject,
      faculty_auth_subject, faculty_auth_uid, recipient_email_hash,
      otp_proof_ref, otp_verified_at, otp_expires_at, otp_revoked,
      principal_authority, invitation_used_at, audit_event_ref,
      transaction_id, receipt_hash, committed_at
    ) VALUES (
      verification_receipt_id, current_challenge.challenge_id,
      current_invitation.invitation_id, current_case.case_id,
      current_case.student_auth_subject, faculty_subject, faculty_uid,
      current_invitation.recipient_email_hash, database_otp_proof_ref,
      command_at, current_challenge.expires_at, false,
      'database_verified_otp_challenge', command_at, event_ref, transaction_id,
      lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
        'receiptId', verification_receipt_id,
        'challengeId', current_challenge.challenge_id,
        'invitationId', current_invitation.invitation_id,
        'caseId', current_case.case_id,
        'studentAuthSubject', current_case.student_auth_subject,
        'facultyAuthSubject', faculty_subject,
        'facultyAuthUid', faculty_uid::text,
        'recipientEmailHash', current_invitation.recipient_email_hash,
        'otpProofRef', database_otp_proof_ref,
        'otpVerifiedAt', pg_catalog.to_char(
          command_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'otpExpiresAt', pg_catalog.to_char(
          current_challenge.expires_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'principalAuthority', 'database_verified_otp_challenge',
        'invitationUsedAt', pg_catalog.to_char(
          command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'auditEventRef', event_ref,
        'transactionId', transaction_id
      )),
      pg_catalog.transaction_timestamp()
    );
    result_record := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.faculty-invitation-command-receipt.v1',
      'receiptId', receipt_id,
      'action', 'faculty.invitation.verify',
      'committed', true,
      'replayed', false,
      'caseId', current_case.case_id,
      'invitationId', current_invitation.invitation_id,
      'challengeIdHash', challenge_id_hash,
      'invitationExpiresAt', NULL,
      'challengeExpiresAt', NULL,
      'caseRevision', next_case_revision,
      'invitationRevision', invitation_revision,
      'verified', true,
      'reasonCode', NULL,
      'auditEventRef', event_ref,
      'transactionId', transaction_id
    );
  END IF;

  INSERT INTO lor_studio.faculty_invitation_command_receipts (
    receipt_id, action, case_id, student_auth_subject, invitation_id,
    challenge_id_hash, idempotency_key, request_hash, result, result_hash,
    audit_event_ref, transaction_id, committed_at
  ) VALUES (
    receipt_id, 'faculty.invitation.verify', current_case.case_id,
    current_case.student_auth_subject, current_invitation.invitation_id,
    challenge_id_hash, candidate_idempotency_key, candidate_request_hash,
    result_record, lor_studio.canonical_jsonb_sha256(result_record),
    event_ref, transaction_id, pg_catalog.transaction_timestamp()
  );
  RETURN result_record;
EXCEPTION
  WHEN SQLSTATE 'P1301' OR SQLSTATE 'P1302' OR SQLSTATE 'P1303'
    OR SQLSTATE 'P1304' OR SQLSTATE 'P1305' THEN RAISE;
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
END;
$verify_invitation$;

CREATE FUNCTION lor_studio.commit_faculty_invitation_delivery(
  candidate_case_id text,
  candidate_invitation_id text,
  candidate_delivery_value text,
  candidate_idempotency_key text,
  candidate_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $commit_delivery$
DECLARE
  current_case lor_studio.recommendation_cases%ROWTYPE;
  latest_consent_receipt lor_studio.consent_receipts%ROWTYPE;
  current_invitation lor_studio.faculty_invitations%ROWTYPE;
  stored_pending lor_studio.faculty_invitation_command_receipts%ROWTYPE;
  stored_unknown lor_studio.faculty_invitation_command_receipts%ROWTYPE;
  stored_delivery lor_studio.faculty_invitation_command_receipts%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.transaction_timestamp()
  );
  command_operation text := pg_catalog.current_setting('lor_studio.operation', true);
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  delivery_action text;
  delivery_status text;
  reservation_id text;
  reservation_provider_message_ref_hash text;
  reservation_audit_event_ref text;
  reservation_settled_at timestamptz;
  reservation_transaction_id text;
  actor_ref text;
  case_ref text;
  correlation_ref text;
  event_ref text;
  receipt_id text;
  event_record jsonb;
  event_hash text;
  result_record jsonb;
BEGIN
  IF candidate_case_id IS NULL
    OR candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_invitation_id IS NULL
    OR candidate_invitation_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_request_hash IS NULL
    OR candidate_request_hash !~ '^[a-f0-9]{64}$'
    OR candidate_idempotency_key IS NULL
    OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 240
    OR command_operation IS NULL
    OR command_operation <> ALL (ARRAY[
      'reserve_faculty_invitation_delivery',
      'commit_faculty_invitation_delivery',
      'mark_faculty_invitation_delivery_unknown'
    ]::text[])
    OR (
      command_operation = 'reserve_faculty_invitation_delivery'
      AND (
        candidate_delivery_value IS NULL
        OR candidate_delivery_value <> ALL (ARRAY['issue', 'resend']::text[])
      )
    )
    OR (
      command_operation = 'commit_faculty_invitation_delivery'
      AND (
        candidate_delivery_value IS NULL
        OR candidate_delivery_value !~ '^[a-f0-9]{64}$'
      )
    )
    OR (
      command_operation = 'mark_faculty_invitation_delivery_unknown'
      AND candidate_delivery_value IS DISTINCT FROM 'unknown'
    ) THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
  END IF;
  IF pg_catalog.current_setting('transaction_isolation', true) IS DISTINCT FROM 'read committed'
    OR pg_catalog.current_setting('lor_studio.actor_role', true) IS DISTINCT FROM 'service'
    OR pg_catalog.current_setting('lor_studio.operation', true) IS DISTINCT FROM command_operation
    OR pg_catalog.current_setting('lor_studio.purpose', true) IS DISTINCT FROM
      'faculty_invitation_delivery'
    OR pg_catalog.current_setting('lor_studio.trusted_service_actor', true) IS DISTINCT FROM
      'postmark-delivery-v1'
    OR pg_catalog.current_setting('lor_studio.case_id', true) IS DISTINCT FROM candidate_case_id
    OR NOT lor_studio.student_write_axes_satisfied()
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  END IF;
  PERFORM pg_catalog.set_config(
    'lor_studio.invitation_id', candidate_invitation_id, true
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'lor-studio:faculty-invitation-delivery:' || candidate_idempotency_key,
      0
    )
  );

  SELECT receipt.* INTO stored_pending
  FROM lor_studio.faculty_invitation_command_receipts AS receipt
  WHERE receipt.action = 'faculty.invitation.delivery_pending'
    AND receipt.idempotency_key = candidate_idempotency_key;
  SELECT receipt.* INTO stored_unknown
  FROM lor_studio.faculty_invitation_command_receipts AS receipt
  WHERE receipt.action = 'faculty.invitation.delivery_unknown'
    AND receipt.idempotency_key = candidate_idempotency_key;
  SELECT receipt.* INTO stored_delivery
  FROM lor_studio.faculty_invitation_command_receipts AS receipt
  WHERE receipt.action = 'faculty.invitation.delivery'
    AND receipt.idempotency_key = candidate_idempotency_key;

  IF (stored_pending.receipt_id IS NOT NULL AND (
      stored_pending.case_id IS DISTINCT FROM candidate_case_id
      OR stored_pending.invitation_id IS DISTINCT FROM candidate_invitation_id
      OR stored_pending.request_hash IS DISTINCT FROM candidate_request_hash
    ))
    OR (stored_unknown.receipt_id IS NOT NULL AND (
      stored_unknown.case_id IS DISTINCT FROM candidate_case_id
      OR stored_unknown.invitation_id IS DISTINCT FROM candidate_invitation_id
      OR stored_unknown.request_hash IS DISTINCT FROM candidate_request_hash
    ))
    OR (stored_delivery.receipt_id IS NOT NULL AND (
      stored_delivery.case_id IS DISTINCT FROM candidate_case_id
      OR stored_delivery.invitation_id IS DISTINCT FROM candidate_invitation_id
      OR stored_delivery.request_hash IS DISTINCT FROM candidate_request_hash
    )) THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_IDEMPOTENCY_CONFLICT'
      USING ERRCODE = 'P1302';
  END IF;

  IF stored_pending.receipt_id IS NOT NULL THEN
    delivery_action := stored_pending.delivery_action;
    IF (stored_unknown.receipt_id IS NOT NULL
      AND stored_unknown.delivery_action IS DISTINCT FROM delivery_action)
      OR (stored_delivery.receipt_id IS NOT NULL
      AND stored_delivery.delivery_action IS DISTINCT FROM delivery_action) THEN
      RAISE EXCEPTION 'LOR_FACULTY_INVITATION_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = 'P1302';
    END IF;
  END IF;

  IF (
      stored_pending.receipt_id IS NULL
      AND (
        stored_unknown.receipt_id IS NOT NULL
        OR stored_delivery.receipt_id IS NOT NULL
      )
    )
    OR (
      stored_unknown.receipt_id IS NOT NULL
      AND stored_delivery.receipt_id IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
  END IF;

  reservation_id := 'faculty_delivery_reservation_' ||
    lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
      'caseId', candidate_case_id,
      'invitationId', candidate_invitation_id,
      'idempotencyKey', candidate_idempotency_key
    ));

  IF command_operation = 'reserve_faculty_invitation_delivery'
    AND stored_pending.receipt_id IS NOT NULL THEN
    IF delivery_action IS DISTINCT FROM candidate_delivery_value THEN
      RAISE EXCEPTION 'LOR_FACULTY_INVITATION_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = 'P1302';
    END IF;
    IF stored_delivery.receipt_id IS NOT NULL THEN
      delivery_status := 'accepted';
      reservation_provider_message_ref_hash := stored_delivery.provider_message_ref_hash;
      reservation_audit_event_ref := stored_delivery.audit_event_ref;
      reservation_settled_at := stored_delivery.accepted_at;
      reservation_transaction_id := stored_delivery.transaction_id;
    ELSIF stored_unknown.receipt_id IS NOT NULL THEN
      delivery_status := 'unknown';
      reservation_provider_message_ref_hash := NULL;
      reservation_audit_event_ref := NULL;
      reservation_settled_at := stored_unknown.committed_at;
      reservation_transaction_id := stored_unknown.transaction_id;
    ELSE
      delivery_status := 'pending';
      reservation_provider_message_ref_hash := NULL;
      reservation_audit_event_ref := NULL;
      reservation_settled_at := NULL;
      reservation_transaction_id := stored_pending.transaction_id;
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion',
        'missionmed.lor.faculty-invitation-delivery-reservation-receipt.v1',
      'reservationId', reservation_id,
      'caseId', candidate_case_id,
      'invitationId', candidate_invitation_id,
      'deliveryAction', delivery_action,
      'status', delivery_status,
      'dispatchGranted', false,
      'replayed', true,
      'requestHash', candidate_request_hash,
      'providerMessageRefHash', reservation_provider_message_ref_hash,
      'auditEventRef', reservation_audit_event_ref,
      'reservedAt', pg_catalog.to_char(
        stored_pending.committed_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'settledAt', CASE WHEN reservation_settled_at IS NULL THEN NULL ELSE
        pg_catalog.to_char(
          reservation_settled_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) END,
      'transactionId', reservation_transaction_id
    );
  END IF;

  IF command_operation <> 'reserve_faculty_invitation_delivery'
    AND stored_pending.receipt_id IS NULL THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
  END IF;

  IF command_operation = 'mark_faculty_invitation_delivery_unknown' THEN
    IF stored_delivery.receipt_id IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'schemaVersion',
          'missionmed.lor.faculty-invitation-delivery-reservation-receipt.v1',
        'reservationId', reservation_id,
        'caseId', candidate_case_id,
        'invitationId', candidate_invitation_id,
        'deliveryAction', delivery_action,
        'status', 'accepted',
        'dispatchGranted', false,
        'replayed', true,
        'requestHash', candidate_request_hash,
        'providerMessageRefHash', stored_delivery.provider_message_ref_hash,
        'auditEventRef', stored_delivery.audit_event_ref,
        'reservedAt', pg_catalog.to_char(
          stored_pending.committed_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'settledAt', pg_catalog.to_char(
          stored_delivery.accepted_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'transactionId', stored_delivery.transaction_id
      );
    END IF;
    IF stored_unknown.receipt_id IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'schemaVersion',
          'missionmed.lor.faculty-invitation-delivery-reservation-receipt.v1',
        'reservationId', reservation_id,
        'caseId', candidate_case_id,
        'invitationId', candidate_invitation_id,
        'deliveryAction', delivery_action,
        'status', 'unknown',
        'dispatchGranted', false,
        'replayed', true,
        'requestHash', candidate_request_hash,
        'providerMessageRefHash', NULL,
        'auditEventRef', NULL,
        'reservedAt', pg_catalog.to_char(
          stored_pending.committed_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'settledAt', pg_catalog.to_char(
          stored_unknown.committed_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'transactionId', stored_unknown.transaction_id
      );
    END IF;

    actor_ref := 'actor_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('actorId', 'service:postmark-delivery-v1')
    );
    case_ref := 'case_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('caseId', candidate_case_id)
    );
    correlation_ref := 'correlation_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'action', 'faculty.invitation.delivery_unknown',
        'caseId', candidate_case_id,
        'idempotencyKey', candidate_idempotency_key
      )
    );
    event_ref := 'event_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('correlationRef', correlation_ref, 'outcome', 'failed')
    );
    receipt_id := 'faculty_command_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'action', 'faculty.invitation.delivery_unknown',
        'caseId', candidate_case_id,
        'idempotencyKey', candidate_idempotency_key
      )
    );
    event_record := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.service-event.v1',
      'eventRef', event_ref,
      'eventType', 'faculty.invitation_delivery_unknown',
      'caseRef', case_ref,
      'actorRef', actor_ref,
      'actorRole', 'service',
      'correlationRef', correlation_ref,
      'outcome', 'failed',
      'revision', (stored_pending.result ->> 'caseRevision')::bigint,
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
      event_ref, stored_pending.case_id, stored_pending.student_auth_subject,
      case_ref, actor_ref, 'service', correlation_ref,
      'faculty.invitation_delivery_unknown', 'failed',
      (stored_pending.result ->> 'caseRevision')::bigint,
      command_at, event_record, event_hash, transaction_id
    );
    result_record := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.faculty-invitation-command-receipt.v1',
      'receiptId', receipt_id,
      'action', 'faculty.invitation.delivery_unknown',
      'committed', true,
      'replayed', false,
      'caseId', stored_pending.case_id,
      'invitationId', stored_pending.invitation_id,
      'challengeIdHash', NULL,
      'invitationExpiresAt', NULL,
      'challengeExpiresAt', NULL,
      'caseRevision', (stored_pending.result ->> 'caseRevision')::bigint,
      'invitationRevision', (stored_pending.result ->> 'invitationRevision')::bigint,
      'verified', NULL,
      'reasonCode', NULL,
      'auditEventRef', event_ref,
      'transactionId', transaction_id
    );
    INSERT INTO lor_studio.faculty_invitation_command_receipts (
      receipt_id, action, case_id, student_auth_subject, invitation_id,
      delivery_action, idempotency_key, request_hash, result, result_hash,
      audit_event_ref, transaction_id, committed_at
    ) VALUES (
      receipt_id, 'faculty.invitation.delivery_unknown', stored_pending.case_id,
      stored_pending.student_auth_subject, stored_pending.invitation_id,
      delivery_action, candidate_idempotency_key, candidate_request_hash,
      result_record, lor_studio.canonical_jsonb_sha256(result_record),
      event_ref, transaction_id, command_at
    );
    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion',
        'missionmed.lor.faculty-invitation-delivery-reservation-receipt.v1',
      'reservationId', reservation_id,
      'caseId', candidate_case_id,
      'invitationId', candidate_invitation_id,
      'deliveryAction', delivery_action,
      'status', 'unknown',
      'dispatchGranted', false,
      'replayed', false,
      'requestHash', candidate_request_hash,
      'providerMessageRefHash', NULL,
      'auditEventRef', NULL,
      'reservedAt', pg_catalog.to_char(
        stored_pending.committed_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'settledAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'transactionId', transaction_id
    );
  END IF;

  IF command_operation = 'commit_faculty_invitation_delivery' THEN
    IF stored_delivery.receipt_id IS NOT NULL THEN
      IF stored_delivery.provider_message_ref_hash IS DISTINCT FROM candidate_delivery_value THEN
        RAISE EXCEPTION 'LOR_FACULTY_INVITATION_IDEMPOTENCY_CONFLICT'
          USING ERRCODE = 'P1302';
      END IF;
      RETURN pg_catalog.jsonb_set(stored_delivery.result, '{replayed}', 'true'::jsonb);
    END IF;
    IF stored_unknown.receipt_id IS NOT NULL THEN
      RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
    END IF;
  END IF;

  SELECT recommendation_case.* INTO current_case
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = candidate_case_id
    AND recommendation_case.student_auth_subject =
      pg_catalog.current_setting('lor_studio.resource_student_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_CASE_NOT_FOUND' USING ERRCODE = 'P1303';
  END IF;
  SELECT invitation.* INTO current_invitation
  FROM lor_studio.faculty_invitations AS invitation
  WHERE invitation.invitation_id = candidate_invitation_id
    AND invitation.case_id = current_case.case_id
    AND invitation.student_auth_subject = current_case.student_auth_subject
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_CASE_NOT_FOUND' USING ERRCODE = 'P1303';
  END IF;
  IF current_case.status <> 'faculty_invited'
    OR current_invitation.used_at IS NOT NULL
    OR current_invitation.revoked_at IS NOT NULL
    OR current_invitation.expires_at <= command_at THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_STATE_INVALID' USING ERRCODE = 'P1304';
  END IF;

  IF command_operation = 'reserve_faculty_invitation_delivery' THEN
    SELECT receipt.* INTO latest_consent_receipt
    FROM lor_studio.consent_receipts AS receipt
    WHERE receipt.case_id = current_case.case_id
      AND receipt.student_auth_subject = current_case.student_auth_subject
      AND receipt.student_auth_uid = current_case.student_auth_uid
      AND receipt.case_revision <= current_case.revision
    ORDER BY receipt.case_revision DESC, receipt.recorded_at DESC, receipt.receipt_id DESC
    LIMIT 1;
    IF NOT FOUND OR NOT (
      latest_consent_receipt.policy_version = 'dr-133-identified-education-record-v1'
      AND latest_consent_receipt.scopes = ARRAY[
        'ai_drafting', 'builder_autosave', 'evidence_grounding', 'faculty_handoff'
      ]::text[]
      AND NOT ('consent_withdrawn' = ANY (latest_consent_receipt.scopes))
    ) THEN
      RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
        USING ERRCODE = 'P1301';
    END IF;

    actor_ref := 'actor_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('actorId', 'service:postmark-delivery-v1')
    );
    case_ref := 'case_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('caseId', candidate_case_id)
    );
    correlation_ref := 'correlation_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'action', 'faculty.invitation.delivery_pending',
        'caseId', candidate_case_id,
        'idempotencyKey', candidate_idempotency_key
      )
    );
    event_ref := 'event_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object('correlationRef', correlation_ref, 'outcome', 'success')
    );
    receipt_id := 'faculty_command_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'action', 'faculty.invitation.delivery_pending',
        'caseId', candidate_case_id,
        'idempotencyKey', candidate_idempotency_key
      )
    );
    event_record := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.service-event.v1',
      'eventRef', event_ref,
      'eventType', 'faculty.invitation_delivery_pending',
      'caseRef', case_ref,
      'actorRef', actor_ref,
      'actorRole', 'service',
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
      event_ref, current_case.case_id, current_case.student_auth_subject,
      case_ref, actor_ref, 'service', correlation_ref,
      'faculty.invitation_delivery_pending', 'success', current_case.revision,
      command_at, event_record, event_hash, transaction_id
    );
    result_record := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.faculty-invitation-command-receipt.v1',
      'receiptId', receipt_id,
      'action', 'faculty.invitation.delivery_pending',
      'committed', true,
      'replayed', false,
      'caseId', current_case.case_id,
      'invitationId', current_invitation.invitation_id,
      'challengeIdHash', NULL,
      'invitationExpiresAt', NULL,
      'challengeExpiresAt', NULL,
      'caseRevision', current_case.revision,
      'invitationRevision', current_invitation.revision,
      'verified', NULL,
      'reasonCode', NULL,
      'auditEventRef', event_ref,
      'transactionId', transaction_id
    );
    INSERT INTO lor_studio.faculty_invitation_command_receipts (
      receipt_id, action, case_id, student_auth_subject, invitation_id,
      delivery_action, idempotency_key, request_hash, result, result_hash,
      audit_event_ref, transaction_id, committed_at
    ) VALUES (
      receipt_id, 'faculty.invitation.delivery_pending', current_case.case_id,
      current_case.student_auth_subject, current_invitation.invitation_id,
      candidate_delivery_value, candidate_idempotency_key, candidate_request_hash,
      result_record, lor_studio.canonical_jsonb_sha256(result_record),
      event_ref, transaction_id, command_at
    );
    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion',
        'missionmed.lor.faculty-invitation-delivery-reservation-receipt.v1',
      'reservationId', reservation_id,
      'caseId', current_case.case_id,
      'invitationId', current_invitation.invitation_id,
      'deliveryAction', candidate_delivery_value,
      'status', 'pending',
      'dispatchGranted', true,
      'replayed', false,
      'requestHash', candidate_request_hash,
      'providerMessageRefHash', NULL,
      'auditEventRef', NULL,
      'reservedAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'settledAt', NULL,
      'transactionId', transaction_id
    );
  END IF;

  actor_ref := 'actor_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('actorId', 'service:postmark-delivery-v1')
  );
  case_ref := 'case_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('caseId', candidate_case_id)
  );
  correlation_ref := 'correlation_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'action', 'faculty.invitation.delivery',
      'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  event_ref := 'event_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object('correlationRef', correlation_ref, 'outcome', 'success')
  );
  receipt_id := 'faculty_command_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'action', 'faculty.invitation.delivery',
      'caseId', candidate_case_id,
      'idempotencyKey', candidate_idempotency_key
    )
  );
  event_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.service-event.v1',
    'eventRef', event_ref,
    'eventType', 'faculty.invitation_delivered',
    'caseRef', case_ref,
    'actorRef', actor_ref,
    'actorRole', 'service',
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
    event_ref, current_case.case_id, current_case.student_auth_subject,
    case_ref, actor_ref, 'service', correlation_ref,
    'faculty.invitation_delivered', 'success', current_case.revision,
    command_at, event_record, event_hash, transaction_id
  );
  result_record := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.faculty-invitation-command-receipt.v1',
    'receiptId', receipt_id,
    'action', 'faculty.invitation.delivery',
    'committed', true,
    'replayed', false,
    'caseId', current_case.case_id,
    'invitationId', current_invitation.invitation_id,
    'challengeIdHash', NULL,
    'invitationExpiresAt', NULL,
    'challengeExpiresAt', NULL,
    'caseRevision', current_case.revision,
    'invitationRevision', current_invitation.revision,
    'verified', NULL,
    'reasonCode', NULL,
    'auditEventRef', event_ref,
    'transactionId', transaction_id
  );
  INSERT INTO lor_studio.faculty_invitation_command_receipts (
    receipt_id, action, case_id, student_auth_subject, invitation_id,
    delivery_action, provider_message_ref_hash, accepted_at, idempotency_key, request_hash,
    result, result_hash, audit_event_ref, transaction_id, committed_at
  ) VALUES (
    receipt_id, 'faculty.invitation.delivery', current_case.case_id,
    current_case.student_auth_subject, current_invitation.invitation_id,
    delivery_action, candidate_delivery_value, command_at, candidate_idempotency_key,
    candidate_request_hash, result_record,
    lor_studio.canonical_jsonb_sha256(result_record), event_ref,
    transaction_id, pg_catalog.transaction_timestamp()
  );
  RETURN result_record;
EXCEPTION
  WHEN SQLSTATE 'P1301' OR SQLSTATE 'P1302' OR SQLSTATE 'P1303'
    OR SQLSTATE 'P1304' OR SQLSTATE 'P1305' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'
      USING ERRCODE = 'P1301';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_FACULTY_INVITATION_COMMAND_INVALID' USING ERRCODE = 'P1305';
END;
$commit_delivery$;

CREATE FUNCTION lor_studio.resolve_lor_actor_case_access(
  candidate_authenticated_subject text,
  candidate_case_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $resolve_actor_access$
DECLARE
  matched_case lor_studio.recommendation_cases%ROWTYPE;
  student_eligible boolean := false;
  faculty_eligible boolean := false;
  mentor_eligible boolean := false;
  eligible_role_count integer;
  resolved_role text;
BEGIN
  IF candidate_authenticated_subject !~ '^wp:[1-9][0-9]*$'
    OR pg_catalog.length(candidate_authenticated_subject) > 200
    OR candidate_case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$' THEN
    RAISE EXCEPTION 'LOR_SCOPE_INPUT_INVALID' USING ERRCODE = 'P1205';
  END IF;
  IF pg_catalog.current_setting('transaction_isolation', true) <> 'read committed'
    OR pg_catalog.current_setting('lor_studio.actor_role', true) <> 'service'
    OR pg_catalog.current_setting('lor_studio.student_auth_subject', true) <>
      candidate_authenticated_subject
    OR pg_catalog.current_setting('lor_studio.case_id', true) <> candidate_case_id
    OR pg_catalog.current_setting('lor_studio.operation', true) <> 'read'
    OR pg_catalog.current_setting('lor_studio.purpose', true) <>
      'actor_case_access_resolution'
    OR NOT lor_studio.student_write_axes_satisfied()
  THEN
    RAISE EXCEPTION 'LOR_SCOPE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1201';
  END IF;

  SELECT recommendation_case.* INTO matched_case
  FROM lor_studio.recommendation_cases AS recommendation_case
  WHERE recommendation_case.case_id = candidate_case_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  student_eligible := matched_case.student_auth_subject = candidate_authenticated_subject
    AND EXISTS (
      SELECT 1
      FROM lor_studio.student_auth_bindings AS binding
      WHERE binding.student_auth_subject = candidate_authenticated_subject
        AND binding.student_auth_uid = matched_case.student_auth_uid
        AND binding.bound_at <= pg_catalog.statement_timestamp()
        AND (binding.expires_at IS NULL OR binding.expires_at > pg_catalog.statement_timestamp())
        AND NOT EXISTS (
          SELECT 1
          FROM lor_studio.student_auth_binding_revocations AS revocation
          WHERE revocation.binding_id = binding.binding_id
            AND revocation.student_auth_subject = binding.student_auth_subject
            AND revocation.student_auth_uid = binding.student_auth_uid
        )
    );

  faculty_eligible := EXISTS (
    SELECT 1
    FROM lor_studio.faculty_invitations AS invitation
    JOIN lor_studio.faculty_otp_verification_receipts AS verification
      ON verification.invitation_id = invitation.invitation_id
      AND verification.case_id = invitation.case_id
      AND verification.student_auth_subject = invitation.student_auth_subject
      AND verification.faculty_auth_subject = invitation.faculty_auth_subject
      AND verification.faculty_auth_uid = invitation.faculty_auth_uid
      AND verification.invitation_used_at = invitation.used_at
    WHERE invitation.case_id = candidate_case_id
      AND invitation.student_auth_subject = matched_case.student_auth_subject
      AND invitation.faculty_auth_subject = candidate_authenticated_subject
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
  );

  mentor_eligible := EXISTS (
    SELECT 1
    FROM lor_studio.mentor_case_assignments AS assignment
    WHERE assignment.case_id = candidate_case_id
      AND assignment.student_auth_subject = matched_case.student_auth_subject
      AND assignment.mentor_auth_subject = candidate_authenticated_subject
      AND assignment.operation = 'read'
      AND assignment.assigned_at <= pg_catalog.statement_timestamp()
      AND assignment.expires_at > pg_catalog.statement_timestamp()
      AND NOT EXISTS (
        SELECT 1
        FROM lor_studio.mentor_case_assignment_revocations AS revocation
        WHERE revocation.assignment_id = assignment.assignment_id
          AND revocation.case_id = assignment.case_id
          AND revocation.student_auth_subject = assignment.student_auth_subject
      )
  );

  eligible_role_count := student_eligible::integer
    + faculty_eligible::integer
    + mentor_eligible::integer;
  IF eligible_role_count = 0 THEN
    RETURN NULL;
  END IF;
  IF eligible_role_count <> 1 THEN
    RAISE EXCEPTION 'LOR_SCOPE_AMBIGUOUS' USING ERRCODE = 'P1202';
  END IF;
  resolved_role := CASE
    WHEN student_eligible THEN 'student'
    WHEN faculty_eligible THEN 'faculty'
    ELSE 'mentor'
  END;
  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.actor-case-access.v1',
    'authoritySource', 'database_verified_case_access',
    'actorId', candidate_authenticated_subject,
    'actorRole', resolved_role,
    'resourceStudentId', matched_case.student_auth_subject,
    'caseId', matched_case.case_id
  );
EXCEPTION
  WHEN SQLSTATE 'P1201' OR SQLSTATE 'P1202' OR SQLSTATE 'P1205' THEN RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_SCOPE_AUTHORIZATION_DENIED' USING ERRCODE = 'P1201';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_SCOPE_RESOLUTION_INVALID' USING ERRCODE = 'P1205';
END;
$resolve_actor_access$;

REVOKE ALL ON TABLE lor_studio.faculty_invitation_command_receipts FROM PUBLIC;
REVOKE ALL ON TABLE lor_studio.faculty_invitation_command_receipts FROM lor_studio_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_challenges,
  lor_studio.faculty_otp_challenge_revocations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.faculty_otp_proof_revocations
FROM lor_studio_app;

GRANT SELECT, INSERT, UPDATE ON TABLE lor_studio.faculty_invitations
TO lor_studio_command_owner;
GRANT SELECT, INSERT ON TABLE
  lor_studio.faculty_otp_challenges,
  lor_studio.faculty_otp_challenge_revocations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.faculty_invitation_command_receipts
TO lor_studio_command_owner;

REVOKE ALL ON FUNCTION lor_studio.issue_faculty_invitation(
  text, bigint, text, text, text, text, text, timestamptz, timestamptz,
  integer, bigint, bigint, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.resend_faculty_invitation_otp(
  text, text, text, text, timestamptz, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.revoke_faculty_invitation(
  text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.verify_faculty_invitation(
  text, text, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.commit_faculty_invitation_delivery(
  text, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.resolve_lor_actor_case_access(text, text)
FROM PUBLIC;

ALTER FUNCTION lor_studio.issue_faculty_invitation(
  text, bigint, text, text, text, text, text, timestamptz, timestamptz,
  integer, bigint, bigint, text, text
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.resend_faculty_invitation_otp(
  text, text, text, text, timestamptz, text, text
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.revoke_faculty_invitation(text, text, text)
OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.verify_faculty_invitation(
  text, text, text, text, text, text
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.commit_faculty_invitation_delivery(
  text, text, text, text, text
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.resolve_lor_actor_case_access(text, text)
OWNER TO lor_studio_command_owner;

GRANT EXECUTE ON FUNCTION lor_studio.issue_faculty_invitation(
  text, bigint, text, text, text, text, text, timestamptz, timestamptz,
  integer, bigint, bigint, text, text
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.resend_faculty_invitation_otp(
  text, text, text, text, timestamptz, text, text
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.revoke_faculty_invitation(
  text, text, text
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.verify_faculty_invitation(
  text, text, text, text, text, text
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.commit_faculty_invitation_delivery(
  text, text, text, text, text
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.resolve_lor_actor_case_access(text, text)
TO lor_studio_app;

DO $catalog_postflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  app_execute_count bigint;
  public_execute_count bigint;
  expected_definers constant text[] := ARRAY[
    'commit_faculty_final_document_release(bigint,text,text,text,jsonb,text)',
    'commit_faculty_invitation_delivery(text,text,text,text,text)',
    'commit_student_builder_autosave(jsonb,bigint,text,text,jsonb,text,jsonb)',
    'commit_student_builder_complete(jsonb,bigint,text,text,jsonb,text,jsonb)',
    'commit_student_case_create(jsonb,text,text,jsonb,text,jsonb)',
    'commit_student_consent_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
    'commit_student_waiver_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
    'ensure_student_auth_binding(text,text,text)',
    'issue_faculty_invitation(text,bigint,text,text,text,text,text,timestamp with time zone,timestamp with time zone,integer,bigint,bigint,text,text)',
    'read_faculty_case_projection()',
    'read_mentor_case_projection()',
    'resend_faculty_invitation_otp(text,text,text,text,timestamp with time zone,text,text)',
    'resolve_faculty_case_scope(text,text,text)',
    'resolve_lor_actor_case_access(text,text)',
    'resolve_mentor_case_scope(text,text,text)',
    'revoke_faculty_invitation(text,text,text)',
    'revoke_student_auth_binding(text,text)',
    'verify_faculty_invitation(text,text,text,text,text,text)'
  ]::text[];
  observed_definers text[];
BEGIN
  SELECT pg_catalog.count(*) INTO relation_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r';
  SELECT pg_catalog.count(*) INTO forced_rls_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind = 'r' AND class.relrowsecurity AND class.relforcerowsecurity;
  SELECT
    pg_catalog.count(*),
    pg_catalog.array_agg(
      pg_catalog.format(
        '%s(%s)', procedure.proname,
        pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ', ', ',')
      ) ORDER BY procedure.proname, procedure.proargtypes::text
    )
  INTO definer_count, observed_definers
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner';
  SELECT pg_catalog.count(*) INTO app_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.has_function_privilege(
      'lor_studio_app', procedure.oid, 'EXECUTE'
    );
  SELECT pg_catalog.count(*) INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  IF relation_count IS DISTINCT FROM 29
    OR forced_rls_count IS DISTINCT FROM 29
    OR definer_count IS DISTINCT FROM 18
    OR app_execute_count IS DISTINCT FROM 18
    OR public_execute_count <> 0
    OR observed_definers IS DISTINCT FROM expected_definers
    OR pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.faculty_invitations', 'INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.faculty_invitations', 'UPDATE'
    )
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.faculty_invitation_command_receipts',
      'SELECT,INSERT'
    )
  THEN
    RAISE EXCEPTION 'DR-133 invitation command migration postflight catalog mismatch'
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
    observed_sentinel || '|facultyInvitationCommands=20260825010500'
  );
END
$advance_sentinel$;

COMMIT;
