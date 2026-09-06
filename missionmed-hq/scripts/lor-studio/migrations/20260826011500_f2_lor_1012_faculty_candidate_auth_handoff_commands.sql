-- Migration: 20260826011500_f2_lor_1012_faculty_candidate_auth_handoff_commands.sql
-- Authority: F2-LOR-1012 / DR-120 / DR-133
-- Date: 2026-08-26
-- Depends on: 20260826011300_f2_lor_1012_live_production_encrypted_private_storage_commands.sql
-- Description: Add database-clocked, opaque, single-use faculty candidate authentication handoffs.
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
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000|identityScope=20260826010300|facultyInvitationCommands=20260826010500|facultyPrivateExportCommands=20260826010700|aiProposalCommands=20260826010900|studentEvidenceCommands=20260826011100|encryptedPrivateStorage=20260826011300',
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
    RAISE EXCEPTION 'DR-133 faculty candidate handoff migration requires the exact successor-bound private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE lor_studio.faculty_invitations IN ACCESS EXCLUSIVE MODE;

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

  IF relation_count IS DISTINCT FROM 34
    OR forced_rls_count IS DISTINCT FROM 34
    OR definer_count IS DISTINCT FROM 30
    OR public_execute_count <> 0
    OR pg_catalog.to_regclass(
      'lor_studio.faculty_candidate_auth_handoff_reservations'
    ) IS NOT NULL
    OR pg_catalog.to_regclass(
      'lor_studio.faculty_candidate_auth_handoff_redemptions'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.reserve_faculty_candidate_auth_handoff(text,text,text,integer)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.redeem_faculty_candidate_auth_handoff(text,text,text,text,timestamp with time zone,timestamp with time zone)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.faculty_candidate_auth_context_allows(text,text[])'
    ) IS NOT NULL
  THEN
    RAISE EXCEPTION 'DR-133 faculty candidate handoff migration preflight catalog mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_preflight$;

-- The handoff contains only opaque hashes and database-owned timestamps.  It
-- does not mutate the recommendation case or its protected revision chain.
-- These two append-only relations are the audit continuity for the pre-auth
-- exchange and the single authenticated redemption.
CREATE TABLE lor_studio.faculty_candidate_auth_handoff_reservations (
  flow_nonce_hash text PRIMARY KEY,
  invitation_id text NOT NULL,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  recipient_email_hash text NOT NULL,
  token_hash text NOT NULL,
  invitation_revision bigint NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  transaction_id text NOT NULL,
  reservation_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT faculty_candidate_auth_handoff_reservations_invitation_fk
    FOREIGN KEY (
      invitation_id, case_id, student_auth_subject, recipient_email_hash
    )
    REFERENCES lor_studio.faculty_invitations (
      invitation_id, case_id, student_auth_subject, recipient_email_hash
    ),
  CONSTRAINT faculty_candidate_auth_handoff_reservations_binding_unique
    UNIQUE (
      flow_nonce_hash,
      invitation_id,
      case_id,
      student_auth_subject,
      recipient_email_hash,
      token_hash,
      invitation_revision,
      issued_at,
      expires_at
    ),
  CONSTRAINT faculty_candidate_auth_handoff_reservations_hashes CHECK (
    flow_nonce_hash ~ '^[a-f0-9]{64}$'
    AND recipient_email_hash ~ '^[a-f0-9]{64}$'
    AND token_hash ~ '^[a-f0-9]{64}$'
    AND reservation_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT faculty_candidate_auth_handoff_reservations_identity CHECK (
    invitation_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND case_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND student_auth_subject ~ '^wp:[1-9][0-9]*$'
    AND invitation_revision >= 0
    AND transaction_id ~ '^[0-9]+$'
  ),
  CONSTRAINT faculty_candidate_auth_handoff_reservations_lifetime CHECK (
    expires_at > issued_at
    AND expires_at <= issued_at + pg_catalog.make_interval(secs => 900)
    AND created_at >= issued_at
  ),
  CONSTRAINT faculty_candidate_auth_handoff_reservations_hash_binding CHECK (
    reservation_hash = lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.faculty-candidate-auth-reservation.v1',
        'invitationId', invitation_id,
        'caseId', case_id,
        'studentAuthSubject', student_auth_subject,
        'recipientEmailHash', recipient_email_hash,
        'tokenHash', token_hash,
        'flowNonceHash', flow_nonce_hash,
        'invitationRevision', invitation_revision,
        'issuedAt', pg_catalog.to_char(
          issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'expiresAt', pg_catalog.to_char(
          expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'transactionId', transaction_id
      )
    )
  )
);

CREATE INDEX faculty_candidate_auth_handoff_reservations_case_idx
  ON lor_studio.faculty_candidate_auth_handoff_reservations
  (case_id, student_auth_subject, invitation_id, expires_at);

CREATE TABLE lor_studio.faculty_candidate_auth_handoff_redemptions (
  flow_nonce_hash text PRIMARY KEY,
  invitation_id text NOT NULL,
  case_id text NOT NULL,
  student_auth_subject text NOT NULL,
  recipient_email_hash text NOT NULL,
  token_hash text NOT NULL,
  invitation_revision bigint NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  authenticated_subject text NOT NULL,
  redeemed_at timestamptz NOT NULL,
  transaction_id text NOT NULL,
  redemption_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT faculty_candidate_auth_handoff_redemptions_reservation_fk
    FOREIGN KEY (
      flow_nonce_hash,
      invitation_id,
      case_id,
      student_auth_subject,
      recipient_email_hash,
      token_hash,
      invitation_revision,
      issued_at,
      expires_at
    )
    REFERENCES lor_studio.faculty_candidate_auth_handoff_reservations (
      flow_nonce_hash,
      invitation_id,
      case_id,
      student_auth_subject,
      recipient_email_hash,
      token_hash,
      invitation_revision,
      issued_at,
      expires_at
    ),
  CONSTRAINT faculty_candidate_auth_handoff_redemptions_hashes CHECK (
    flow_nonce_hash ~ '^[a-f0-9]{64}$'
    AND recipient_email_hash ~ '^[a-f0-9]{64}$'
    AND token_hash ~ '^[a-f0-9]{64}$'
    AND redemption_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT faculty_candidate_auth_handoff_redemptions_identity CHECK (
    invitation_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND case_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND student_auth_subject ~ '^wp:[1-9][0-9]*$'
    AND authenticated_subject ~ '^wp:[1-9][0-9]*$'
    AND authenticated_subject <> student_auth_subject
    AND invitation_revision >= 0
    AND transaction_id ~ '^[0-9]+$'
  ),
  CONSTRAINT faculty_candidate_auth_handoff_redemptions_time_order CHECK (
    expires_at > issued_at
    AND redeemed_at >= issued_at
    AND redeemed_at < expires_at
    AND created_at >= redeemed_at
  ),
  CONSTRAINT faculty_candidate_auth_handoff_redemptions_hash_binding CHECK (
    redemption_hash = lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.faculty-candidate-auth-redemption.v1',
        'invitationId', invitation_id,
        'caseId', case_id,
        'studentAuthSubject', student_auth_subject,
        'recipientEmailHash', recipient_email_hash,
        'tokenHash', token_hash,
        'flowNonceHash', flow_nonce_hash,
        'invitationRevision', invitation_revision,
        'authenticatedSubject', authenticated_subject,
        'issuedAt', pg_catalog.to_char(
          issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'expiresAt', pg_catalog.to_char(
          expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'redeemedAt', pg_catalog.to_char(
          redeemed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'transactionId', transaction_id
      )
    )
  )
);

CREATE INDEX faculty_candidate_auth_handoff_redemptions_case_idx
  ON lor_studio.faculty_candidate_auth_handoff_redemptions
  (case_id, student_auth_subject, invitation_id, authenticated_subject, redeemed_at);

ALTER TABLE lor_studio.faculty_candidate_auth_handoff_reservations
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_candidate_auth_handoff_reservations
  FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_candidate_auth_handoff_redemptions
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_candidate_auth_handoff_redemptions
  FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  lor_studio.faculty_candidate_auth_handoff_reservations,
  lor_studio.faculty_candidate_auth_handoff_redemptions
FROM PUBLIC;
REVOKE ALL ON TABLE
  lor_studio.faculty_candidate_auth_handoff_reservations,
  lor_studio.faculty_candidate_auth_handoff_redemptions
FROM lor_studio_app;

CREATE TRIGGER faculty_candidate_auth_handoff_reservations_append_only
BEFORE UPDATE OR DELETE ON lor_studio.faculty_candidate_auth_handoff_reservations
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE TRIGGER faculty_candidate_auth_handoff_redemptions_append_only
BEFORE UPDATE OR DELETE ON lor_studio.faculty_candidate_auth_handoff_redemptions
FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation();

CREATE FUNCTION lor_studio.faculty_candidate_auth_context_allows(
  candidate_invitation_id text,
  allowed_operations text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $candidate_auth_context$
  SELECT COALESCE(
    CURRENT_USER = 'lor_studio_command_owner'
    AND candidate_invitation_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND pg_catalog.current_setting('transaction_isolation', true) = 'read committed'
    AND pg_catalog.current_setting('lor_studio.actor_role', true) = 'service'
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (allowed_operations)
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_candidate_auth'
    AND pg_catalog.current_setting('lor_studio.invitation_id', true) = candidate_invitation_id
    AND NULLIF(pg_catalog.current_setting('lor_studio.assignment_id', true), '') IS NULL
    AND NULLIF(
      pg_catalog.current_setting('lor_studio.administrative_grant_id', true), ''
    ) IS NULL
    AND NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '') IS NULL
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'false'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.trusted_service_actor', true) =
      'lor-candidate-auth-v1'
    AND pg_catalog.current_setting('lor_studio.identity_resolution_verified', true) = 'true'
    AND (
      (
        pg_catalog.current_setting('lor_studio.operation', true) =
          'reserve_faculty_candidate_auth_handoff'
        AND NULLIF(
          pg_catalog.current_setting('lor_studio.student_auth_subject', true), ''
        ) IS NULL
      )
      OR (
        pg_catalog.current_setting('lor_studio.operation', true) =
          'redeem_faculty_candidate_auth_handoff'
        AND pg_catalog.current_setting('lor_studio.student_auth_subject', true) ~
          '^wp:[1-9][0-9]*$'
      )
    ),
    false
  );
$candidate_auth_context$;

REVOKE ALL ON FUNCTION lor_studio.faculty_candidate_auth_context_allows(
  text, text[]
) FROM PUBLIC;

CREATE POLICY faculty_invitations_candidate_handoff_select
ON lor_studio.faculty_invitations
FOR SELECT
TO lor_studio_command_owner
USING (
  invitation_id = pg_catalog.current_setting('lor_studio.invitation_id', true)
  AND lor_studio.faculty_candidate_auth_context_allows(
    invitation_id,
    ARRAY[
      'reserve_faculty_candidate_auth_handoff',
      'redeem_faculty_candidate_auth_handoff'
    ]::text[]
  )
  AND (
    NULLIF(pg_catalog.current_setting('lor_studio.case_id', true), '') IS NULL
    OR case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  )
  AND (
    NULLIF(
      pg_catalog.current_setting('lor_studio.resource_student_id', true), ''
    ) IS NULL
    OR student_auth_subject = pg_catalog.current_setting(
      'lor_studio.resource_student_id', true
    )
  )
);

-- PostgreSQL applies UPDATE visibility to SELECT ... FOR UPDATE.  This policy
-- permits only the row lock; the replacement row is always rejected.
CREATE POLICY faculty_invitations_candidate_handoff_lock
ON lor_studio.faculty_invitations
FOR UPDATE
TO lor_studio_command_owner
USING (
  invitation_id = pg_catalog.current_setting('lor_studio.invitation_id', true)
  AND lor_studio.faculty_candidate_auth_context_allows(
    invitation_id,
    ARRAY[
      'reserve_faculty_candidate_auth_handoff',
      'redeem_faculty_candidate_auth_handoff'
    ]::text[]
  )
  AND (
    NULLIF(pg_catalog.current_setting('lor_studio.case_id', true), '') IS NULL
    OR case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  )
  AND (
    NULLIF(
      pg_catalog.current_setting('lor_studio.resource_student_id', true), ''
    ) IS NULL
    OR student_auth_subject = pg_catalog.current_setting(
      'lor_studio.resource_student_id', true
    )
  )
)
WITH CHECK (false);

-- Re-entry remains anchored to the durable OTP verification and its revocation
-- ledger. These policies expose only the exact invitation/case/student rows to
-- the trusted candidate-auth command context; the application role receives no
-- direct table privilege.
CREATE POLICY faculty_otp_verification_receipts_candidate_handoff_select
ON lor_studio.faculty_otp_verification_receipts
FOR SELECT
TO lor_studio_command_owner
USING (
  invitation_id = pg_catalog.current_setting('lor_studio.invitation_id', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND lor_studio.faculty_candidate_auth_context_allows(
    invitation_id,
    ARRAY[
      'reserve_faculty_candidate_auth_handoff',
      'redeem_faculty_candidate_auth_handoff'
    ]::text[]
  )
);

CREATE POLICY faculty_otp_proof_revocations_candidate_handoff_select
ON lor_studio.faculty_otp_proof_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND lor_studio.faculty_candidate_auth_context_allows(
    pg_catalog.current_setting('lor_studio.invitation_id', true),
    ARRAY[
      'reserve_faculty_candidate_auth_handoff',
      'redeem_faculty_candidate_auth_handoff'
    ]::text[]
  )
);

CREATE POLICY faculty_candidate_auth_handoff_reservations_command_select
ON lor_studio.faculty_candidate_auth_handoff_reservations
FOR SELECT
TO lor_studio_command_owner
USING (
  invitation_id = pg_catalog.current_setting('lor_studio.invitation_id', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND lor_studio.faculty_candidate_auth_context_allows(
    invitation_id,
    ARRAY[
      'reserve_faculty_candidate_auth_handoff',
      'redeem_faculty_candidate_auth_handoff'
    ]::text[]
  )
);

CREATE POLICY faculty_candidate_auth_handoff_reservations_command_insert
ON lor_studio.faculty_candidate_auth_handoff_reservations
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  invitation_id = pg_catalog.current_setting('lor_studio.invitation_id', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND lor_studio.faculty_candidate_auth_context_allows(
    invitation_id,
    ARRAY['reserve_faculty_candidate_auth_handoff']::text[]
  )
);

CREATE POLICY faculty_candidate_auth_handoff_redemptions_command_select
ON lor_studio.faculty_candidate_auth_handoff_redemptions
FOR SELECT
TO lor_studio_command_owner
USING (
  invitation_id = pg_catalog.current_setting('lor_studio.invitation_id', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND authenticated_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND lor_studio.faculty_candidate_auth_context_allows(
    invitation_id,
    ARRAY['redeem_faculty_candidate_auth_handoff']::text[]
  )
);

CREATE POLICY faculty_candidate_auth_handoff_redemptions_command_insert
ON lor_studio.faculty_candidate_auth_handoff_redemptions
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  invitation_id = pg_catalog.current_setting('lor_studio.invitation_id', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND authenticated_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND lor_studio.faculty_candidate_auth_context_allows(
    invitation_id,
    ARRAY['redeem_faculty_candidate_auth_handoff']::text[]
  )
);

CREATE FUNCTION lor_studio.reserve_faculty_candidate_auth_handoff(
  candidate_invitation_id text,
  candidate_token_hash text,
  candidate_flow_nonce_hash text,
  candidate_maximum_lifetime_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $reserve_candidate_handoff$
DECLARE
  current_invitation lor_studio.faculty_invitations%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.transaction_timestamp()
  );
  handoff_expires_at timestamptz;
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  reservation_hash text;
  active_reservation_count bigint;
  recent_reservation_count bigint;
  requires_otp_verification boolean;
BEGIN
  IF candidate_invitation_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_token_hash !~ '^[a-f0-9]{64}$'
    OR candidate_flow_nonce_hash !~ '^[a-f0-9]{64}$'
    OR candidate_maximum_lifetime_seconds NOT BETWEEN 60 AND 900
    OR NOT lor_studio.faculty_candidate_auth_context_allows(
      candidate_invitation_id,
      ARRAY['reserve_faculty_candidate_auth_handoff']::text[]
    )
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'missionmed.lor.faculty-candidate-auth.invitation.v1:' ||
        candidate_invitation_id,
      0
    )
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'missionmed.lor.faculty-candidate-auth.nonce.v1:' ||
        candidate_flow_nonce_hash,
      0
    )
  );

  SELECT invitation.*
  INTO current_invitation
  FROM lor_studio.faculty_invitations AS invitation
  WHERE invitation.invitation_id = candidate_invitation_id
  FOR UPDATE;

  IF NOT FOUND
    OR current_invitation.token_hash IS DISTINCT FROM candidate_token_hash
    OR current_invitation.revoked_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  END IF;

  PERFORM pg_catalog.set_config(
    'lor_studio.case_id', current_invitation.case_id, true
  );
  PERFORM pg_catalog.set_config(
    'lor_studio.resource_student_id', current_invitation.student_auth_subject, true
  );

  requires_otp_verification := current_invitation.used_at IS NULL;
  IF requires_otp_verification THEN
    IF current_invitation.expires_at <= command_at
      OR (
        current_invitation.locked_until IS NOT NULL
        AND current_invitation.locked_until > command_at
      )
    THEN
      RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
        USING ERRCODE = 'P1311';
    END IF;
  ELSIF current_invitation.faculty_auth_subject IS NULL
    OR current_invitation.faculty_auth_uid IS NULL
    OR current_invitation.used_at >= current_invitation.expires_at
    OR NOT EXISTS (
      SELECT 1
      FROM lor_studio.faculty_otp_verification_receipts AS verification
      WHERE verification.invitation_id = current_invitation.invitation_id
        AND verification.case_id = current_invitation.case_id
        AND verification.student_auth_subject = current_invitation.student_auth_subject
        AND verification.faculty_auth_subject = current_invitation.faculty_auth_subject
        AND verification.faculty_auth_uid = current_invitation.faculty_auth_uid
        AND verification.invitation_used_at = current_invitation.used_at
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
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  END IF;

  SELECT
    pg_catalog.count(*) FILTER (
      WHERE reservation.created_at > command_at - pg_catalog.make_interval(hours => 24)
    ),
    pg_catalog.count(*) FILTER (WHERE reservation.expires_at > command_at)
  INTO recent_reservation_count, active_reservation_count
  FROM lor_studio.faculty_candidate_auth_handoff_reservations AS reservation
  WHERE reservation.invitation_id = current_invitation.invitation_id
    AND reservation.case_id = current_invitation.case_id
    AND reservation.student_auth_subject = current_invitation.student_auth_subject;
  IF recent_reservation_count >= 20 OR active_reservation_count >= 5 THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  END IF;

  handoff_expires_at := CASE
    WHEN requires_otp_verification THEN LEAST(
      current_invitation.expires_at,
      command_at + pg_catalog.make_interval(
        secs => candidate_maximum_lifetime_seconds
      )
    )
    ELSE command_at + pg_catalog.make_interval(
      secs => candidate_maximum_lifetime_seconds
    )
  END;
  IF handoff_expires_at <= command_at THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  END IF;

  reservation_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.faculty-candidate-auth-reservation.v1',
      'invitationId', current_invitation.invitation_id,
      'caseId', current_invitation.case_id,
      'studentAuthSubject', current_invitation.student_auth_subject,
      'recipientEmailHash', current_invitation.recipient_email_hash,
      'tokenHash', current_invitation.token_hash,
      'flowNonceHash', candidate_flow_nonce_hash,
      'invitationRevision', current_invitation.revision,
      'issuedAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'expiresAt', pg_catalog.to_char(
        handoff_expires_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'transactionId', transaction_id
    )
  );

  INSERT INTO lor_studio.faculty_candidate_auth_handoff_reservations (
    flow_nonce_hash,
    invitation_id,
    case_id,
    student_auth_subject,
    recipient_email_hash,
    token_hash,
    invitation_revision,
    issued_at,
    expires_at,
    transaction_id,
    reservation_hash,
    created_at
  ) VALUES (
    candidate_flow_nonce_hash,
    current_invitation.invitation_id,
    current_invitation.case_id,
    current_invitation.student_auth_subject,
    current_invitation.recipient_email_hash,
    current_invitation.token_hash,
    current_invitation.revision,
    command_at,
    handoff_expires_at,
    transaction_id,
    reservation_hash,
    command_at
  );

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion',
      'missionmed.lor.faculty-candidate-auth-reservation-receipt.v1',
    'action', 'faculty.candidate_handoff.reserve',
    'reserved', true,
    'replayed', false,
    'invitationId', current_invitation.invitation_id,
    'caseId', current_invitation.case_id,
    'requiresOtpVerification', requires_otp_verification,
    'tokenHash', current_invitation.token_hash,
    'flowNonceHash', candidate_flow_nonce_hash,
    'issuedAt', pg_catalog.to_char(
      command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'expiresAt', pg_catalog.to_char(
      handoff_expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'transactionId', transaction_id
  );
EXCEPTION
  WHEN SQLSTATE 'P1311' THEN RAISE;
  WHEN unique_violation OR insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_COMMAND_FAILED'
      USING ERRCODE = 'P1312';
END;
$reserve_candidate_handoff$;

CREATE FUNCTION lor_studio.redeem_faculty_candidate_auth_handoff(
  candidate_invitation_id text,
  candidate_token_hash text,
  candidate_flow_nonce_hash text,
  candidate_authenticated_subject text,
  candidate_issued_at timestamptz,
  candidate_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $redeem_candidate_handoff$
DECLARE
  current_invitation lor_studio.faculty_invitations%ROWTYPE;
  current_reservation
    lor_studio.faculty_candidate_auth_handoff_reservations%ROWTYPE;
  command_at timestamptz := pg_catalog.date_trunc(
    'milliseconds', pg_catalog.transaction_timestamp()
  );
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  redemption_hash text;
  requires_otp_verification boolean;
BEGIN
  IF candidate_invitation_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR candidate_token_hash !~ '^[a-f0-9]{64}$'
    OR candidate_flow_nonce_hash !~ '^[a-f0-9]{64}$'
    OR candidate_authenticated_subject !~ '^wp:[1-9][0-9]*$'
    OR candidate_issued_at IS NULL
    OR candidate_expires_at IS NULL
    OR candidate_expires_at <= candidate_issued_at
    OR candidate_expires_at > candidate_issued_at + pg_catalog.make_interval(secs => 900)
    OR NOT lor_studio.faculty_candidate_auth_context_allows(
      candidate_invitation_id,
      ARRAY['redeem_faculty_candidate_auth_handoff']::text[]
    )
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'missionmed.lor.faculty-candidate-auth.invitation.v1:' ||
        candidate_invitation_id,
      0
    )
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'missionmed.lor.faculty-candidate-auth.nonce.v1:' ||
        candidate_flow_nonce_hash,
      0
    )
  );

  SELECT invitation.*
  INTO current_invitation
  FROM lor_studio.faculty_invitations AS invitation
  WHERE invitation.invitation_id = candidate_invitation_id
  FOR UPDATE;

  IF NOT FOUND
    OR current_invitation.token_hash IS DISTINCT FROM candidate_token_hash
    OR current_invitation.revoked_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  END IF;

  PERFORM pg_catalog.set_config(
    'lor_studio.case_id', current_invitation.case_id, true
  );
  PERFORM pg_catalog.set_config(
    'lor_studio.resource_student_id', current_invitation.student_auth_subject, true
  );

  requires_otp_verification := current_invitation.used_at IS NULL;
  IF requires_otp_verification THEN
    IF current_invitation.expires_at <= command_at
      OR (
        current_invitation.locked_until IS NOT NULL
        AND current_invitation.locked_until > command_at
      )
    THEN
      RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
        USING ERRCODE = 'P1311';
    END IF;
  ELSIF current_invitation.faculty_auth_subject IS DISTINCT FROM
      candidate_authenticated_subject
    OR current_invitation.faculty_auth_uid IS NULL
    OR current_invitation.used_at >= current_invitation.expires_at
    OR NOT EXISTS (
      SELECT 1
      FROM lor_studio.faculty_otp_verification_receipts AS verification
      WHERE verification.invitation_id = current_invitation.invitation_id
        AND verification.case_id = current_invitation.case_id
        AND verification.student_auth_subject = current_invitation.student_auth_subject
        AND verification.faculty_auth_subject = candidate_authenticated_subject
        AND verification.faculty_auth_uid = current_invitation.faculty_auth_uid
        AND verification.invitation_used_at = current_invitation.used_at
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
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  END IF;

  SELECT reservation.*
  INTO current_reservation
  FROM lor_studio.faculty_candidate_auth_handoff_reservations AS reservation
  WHERE reservation.flow_nonce_hash = candidate_flow_nonce_hash
    AND reservation.invitation_id = candidate_invitation_id;

  IF NOT FOUND
    OR current_reservation.token_hash IS DISTINCT FROM candidate_token_hash
    OR current_reservation.case_id IS DISTINCT FROM current_invitation.case_id
    OR current_reservation.student_auth_subject IS DISTINCT FROM
      current_invitation.student_auth_subject
    OR current_reservation.recipient_email_hash IS DISTINCT FROM
      current_invitation.recipient_email_hash
    OR current_reservation.invitation_revision IS DISTINCT FROM
      current_invitation.revision
    OR current_reservation.issued_at IS DISTINCT FROM candidate_issued_at
    OR current_reservation.expires_at IS DISTINCT FROM candidate_expires_at
    OR command_at < current_reservation.issued_at
    OR command_at >= current_reservation.expires_at
    OR candidate_authenticated_subject = current_reservation.student_auth_subject
    OR EXISTS (
      SELECT 1
      FROM lor_studio.faculty_candidate_auth_handoff_redemptions AS redemption
      WHERE redemption.flow_nonce_hash = candidate_flow_nonce_hash
    )
  THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  END IF;

  redemption_hash := lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.faculty-candidate-auth-redemption.v1',
      'invitationId', current_reservation.invitation_id,
      'caseId', current_reservation.case_id,
      'studentAuthSubject', current_reservation.student_auth_subject,
      'recipientEmailHash', current_reservation.recipient_email_hash,
      'tokenHash', current_reservation.token_hash,
      'flowNonceHash', current_reservation.flow_nonce_hash,
      'invitationRevision', current_reservation.invitation_revision,
      'authenticatedSubject', candidate_authenticated_subject,
      'issuedAt', pg_catalog.to_char(
        current_reservation.issued_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'expiresAt', pg_catalog.to_char(
        current_reservation.expires_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'redeemedAt', pg_catalog.to_char(
        command_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'transactionId', transaction_id
    )
  );

  INSERT INTO lor_studio.faculty_candidate_auth_handoff_redemptions (
    flow_nonce_hash,
    invitation_id,
    case_id,
    student_auth_subject,
    recipient_email_hash,
    token_hash,
    invitation_revision,
    issued_at,
    expires_at,
    authenticated_subject,
    redeemed_at,
    transaction_id,
    redemption_hash,
    created_at
  ) VALUES (
    current_reservation.flow_nonce_hash,
    current_reservation.invitation_id,
    current_reservation.case_id,
    current_reservation.student_auth_subject,
    current_reservation.recipient_email_hash,
    current_reservation.token_hash,
    current_reservation.invitation_revision,
    current_reservation.issued_at,
    current_reservation.expires_at,
    candidate_authenticated_subject,
    command_at,
    transaction_id,
    redemption_hash,
    command_at
  );

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion',
      'missionmed.lor.faculty-candidate-auth-redemption-receipt.v1',
    'action', 'faculty.candidate_handoff.redeem',
    'redeemed', true,
    'replayed', false,
    'invitationId', current_reservation.invitation_id,
    'caseId', current_reservation.case_id,
    'requiresOtpVerification', requires_otp_verification,
    'tokenHash', current_reservation.token_hash,
    'flowNonceHash', current_reservation.flow_nonce_hash,
    'authenticatedSubject', candidate_authenticated_subject,
    'issuedAt', pg_catalog.to_char(
      current_reservation.issued_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'expiresAt', pg_catalog.to_char(
      current_reservation.expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'transactionId', transaction_id
  );
EXCEPTION
  WHEN SQLSTATE 'P1311' THEN RAISE;
  WHEN unique_violation OR insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_DENIED'
      USING ERRCODE = 'P1311';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_FACULTY_CANDIDATE_HANDOFF_COMMAND_FAILED'
      USING ERRCODE = 'P1312';
END;
$redeem_candidate_handoff$;

REVOKE ALL ON FUNCTION lor_studio.reserve_faculty_candidate_auth_handoff(
  text, text, text, integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.redeem_faculty_candidate_auth_handoff(
  text, text, text, text, timestamptz, timestamptz
) FROM PUBLIC;

ALTER FUNCTION lor_studio.faculty_candidate_auth_context_allows(text, text[])
OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.reserve_faculty_candidate_auth_handoff(
  text, text, text, integer
) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.redeem_faculty_candidate_auth_handoff(
  text, text, text, text, timestamptz, timestamptz
) OWNER TO lor_studio_command_owner;

GRANT EXECUTE ON FUNCTION lor_studio.faculty_candidate_auth_context_allows(
  text, text[]
) TO lor_studio_command_owner;
GRANT SELECT, INSERT ON TABLE
  lor_studio.faculty_candidate_auth_handoff_reservations,
  lor_studio.faculty_candidate_auth_handoff_redemptions
TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.reserve_faculty_candidate_auth_handoff(
  text, text, text, integer
) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.redeem_faculty_candidate_auth_handoff(
  text, text, text, text, timestamptz, timestamptz
) TO lor_studio_app;

DO $catalog_postflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  public_execute_count bigint;
  candidate_policy_count bigint;
  candidate_trigger_count bigint;
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

  SELECT pg_catalog.count(*) INTO candidate_policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND policy.polname = ANY (ARRAY[
      'faculty_invitations_candidate_handoff_select',
      'faculty_invitations_candidate_handoff_lock',
      'faculty_otp_verification_receipts_candidate_handoff_select',
      'faculty_otp_proof_revocations_candidate_handoff_select',
      'faculty_candidate_auth_handoff_reservations_command_select',
      'faculty_candidate_auth_handoff_reservations_command_insert',
      'faculty_candidate_auth_handoff_redemptions_command_select',
      'faculty_candidate_auth_handoff_redemptions_command_insert'
    ]::text[]);

  SELECT pg_catalog.count(*) INTO candidate_trigger_count
  FROM pg_catalog.pg_trigger AS trigger
  JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND NOT trigger.tgisinternal
    AND trigger.tgname = ANY (ARRAY[
      'faculty_candidate_auth_handoff_reservations_append_only',
      'faculty_candidate_auth_handoff_redemptions_append_only'
    ]::text[]);

  IF relation_count IS DISTINCT FROM 36
    OR forced_rls_count IS DISTINCT FROM 36
    OR definer_count IS DISTINCT FROM 32
    OR public_execute_count <> 0
    OR candidate_policy_count IS DISTINCT FROM 8
    OR candidate_trigger_count IS DISTINCT FROM 2
    OR pg_catalog.has_table_privilege(
      'lor_studio_app',
      'lor_studio.faculty_candidate_auth_handoff_reservations',
      'SELECT,INSERT,UPDATE,DELETE'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_app',
      'lor_studio.faculty_candidate_auth_handoff_redemptions',
      'SELECT,INSERT,UPDATE,DELETE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.reserve_faculty_candidate_auth_handoff(text,text,text,integer)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.redeem_faculty_candidate_auth_handoff(text,text,text,text,timestamp with time zone,timestamp with time zone)',
      'EXECUTE'
    )
    OR pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.faculty_candidate_auth_context_allows(text,text[])',
      'EXECUTE'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.faculty_candidate_auth_handoff_reservations',
      'UPDATE,DELETE'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.faculty_candidate_auth_handoff_redemptions',
      'UPDATE,DELETE'
    )
  THEN
    RAISE EXCEPTION 'DR-133 faculty candidate handoff migration postflight catalog mismatch'
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
    observed_sentinel || '|facultyCandidateAuthHandoff=20260826011500'
  );
END
$advance_sentinel$;

COMMIT;
