-- Rollback: 20260826011500_f2_lor_1012_faculty_candidate_auth_handoff_commands.rollback.sql
-- Authority: F2-LOR-1012 / DR-120 / DR-133
-- Reverses: 20260826011500_f2_lor_1012_faculty_candidate_auth_handoff_commands.sql
-- Exact target: MissionMed Railway project 29afe885 / production environment ed3353f7 / Postgres service 576520f5

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
    RAISE EXCEPTION 'DR-133 faculty candidate handoff rollback requires the exact successor-bound private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.faculty_otp_proof_revocations,
  lor_studio.faculty_candidate_auth_handoff_reservations,
  lor_studio.faculty_candidate_auth_handoff_redemptions
IN ACCESS EXCLUSIVE MODE;

DO $catalog_guard$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  public_execute_count bigint;
  candidate_policy_count bigint;
  candidate_trigger_count bigint;
  reservation_columns text[];
  redemption_columns text[];
  reservation_constraints text[];
  redemption_constraints text[];
  candidate_indexes text[];
  command_owner_oid oid;
BEGIN
  SELECT oid INTO STRICT command_owner_oid
  FROM pg_catalog.pg_roles
  WHERE rolname = 'lor_studio_command_owner';

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
    AND procedure.proowner = command_owner_oid;

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

  SELECT pg_catalog.array_agg(attribute.attname::text ORDER BY attribute.attnum)
  INTO reservation_columns
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid =
      'lor_studio.faculty_candidate_auth_handoff_reservations'::pg_catalog.regclass
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT pg_catalog.array_agg(attribute.attname::text ORDER BY attribute.attnum)
  INTO redemption_columns
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid =
      'lor_studio.faculty_candidate_auth_handoff_redemptions'::pg_catalog.regclass
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT pg_catalog.array_agg(constraint_record.conname::text ORDER BY constraint_record.conname)
  INTO reservation_constraints
  FROM pg_catalog.pg_constraint AS constraint_record
  WHERE constraint_record.conrelid =
    'lor_studio.faculty_candidate_auth_handoff_reservations'::pg_catalog.regclass
    -- PostgreSQL 18 materializes NOT NULL constraints in pg_constraint;
    -- named semantic custody is identical across the supported 16/18 matrix.
    AND constraint_record.contype <> 'n';

  SELECT pg_catalog.array_agg(constraint_record.conname::text ORDER BY constraint_record.conname)
  INTO redemption_constraints
  FROM pg_catalog.pg_constraint AS constraint_record
  WHERE constraint_record.conrelid =
    'lor_studio.faculty_candidate_auth_handoff_redemptions'::pg_catalog.regclass
    AND constraint_record.contype <> 'n';

  SELECT pg_catalog.array_agg(index_class.relname::text ORDER BY index_class.relname)
  INTO candidate_indexes
  FROM pg_catalog.pg_index AS index_record
  JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index_record.indexrelid
  WHERE index_record.indrelid = ANY (ARRAY[
    'lor_studio.faculty_candidate_auth_handoff_reservations'::pg_catalog.regclass,
    'lor_studio.faculty_candidate_auth_handoff_redemptions'::pg_catalog.regclass
  ]::oid[]);

  IF relation_count IS DISTINCT FROM 36
    OR forced_rls_count IS DISTINCT FROM 36
    OR definer_count IS DISTINCT FROM 32
    OR public_execute_count <> 0
    OR candidate_policy_count IS DISTINCT FROM 8
    OR candidate_trigger_count IS DISTINCT FROM 2
    OR EXISTS (
      SELECT 1
      FROM lor_studio.faculty_candidate_auth_handoff_reservations
    )
    OR EXISTS (
      SELECT 1
      FROM lor_studio.faculty_candidate_auth_handoff_redemptions
    )
    OR reservation_columns IS DISTINCT FROM ARRAY[
      'flow_nonce_hash',
      'invitation_id',
      'case_id',
      'student_auth_subject',
      'recipient_email_hash',
      'token_hash',
      'invitation_revision',
      'issued_at',
      'expires_at',
      'transaction_id',
      'reservation_hash',
      'created_at'
    ]::text[]
    OR redemption_columns IS DISTINCT FROM ARRAY[
      'flow_nonce_hash',
      'invitation_id',
      'case_id',
      'student_auth_subject',
      'recipient_email_hash',
      'token_hash',
      'invitation_revision',
      'issued_at',
      'expires_at',
      'authenticated_subject',
      'redeemed_at',
      'transaction_id',
      'redemption_hash',
      'created_at'
    ]::text[]
    OR reservation_constraints IS DISTINCT FROM ARRAY[
      'faculty_candidate_auth_handoff_reservations_binding_unique',
      'faculty_candidate_auth_handoff_reservations_hash_binding',
      'faculty_candidate_auth_handoff_reservations_hashes',
      'faculty_candidate_auth_handoff_reservations_identity',
      'faculty_candidate_auth_handoff_reservations_invitation_fk',
      'faculty_candidate_auth_handoff_reservations_lifetime',
      'faculty_candidate_auth_handoff_reservations_pkey'
    ]::text[]
    OR redemption_constraints IS DISTINCT FROM ARRAY[
      'faculty_candidate_auth_handoff_redemptions_hash_binding',
      'faculty_candidate_auth_handoff_redemptions_hashes',
      'faculty_candidate_auth_handoff_redemptions_identity',
      'faculty_candidate_auth_handoff_redemptions_pkey',
      'faculty_candidate_auth_handoff_redemptions_reservation_fk',
      'faculty_candidate_auth_handoff_redemptions_time_order'
    ]::text[]
    OR candidate_indexes IS DISTINCT FROM ARRAY[
      'faculty_candidate_auth_handoff_redemptions_case_idx',
      'faculty_candidate_auth_handoff_redemptions_pkey',
      'faculty_candidate_auth_handoff_reservations_binding_unique',
      'faculty_candidate_auth_handoff_reservations_case_idx',
      'faculty_candidate_auth_handoff_reservations_pkey'
    ]::text[]
    OR pg_catalog.to_regprocedure(
      'lor_studio.reserve_faculty_candidate_auth_handoff(text,text,text,integer)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.redeem_faculty_candidate_auth_handoff(text,text,text,text,timestamp with time zone,timestamp with time zone)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.faculty_candidate_auth_context_allows(text,text[])'
    ) IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      WHERE procedure.oid =
        'lor_studio.reserve_faculty_candidate_auth_handoff(text,text,text,integer)'::pg_catalog.regprocedure
        AND procedure.proowner = command_owner_oid
        AND procedure.prosecdef
        AND procedure.provolatile = 'v'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      WHERE procedure.oid =
        'lor_studio.redeem_faculty_candidate_auth_handoff(text,text,text,text,timestamp with time zone,timestamp with time zone)'::pg_catalog.regprocedure
        AND procedure.proowner = command_owner_oid
        AND procedure.prosecdef
        AND procedure.provolatile = 'v'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      WHERE procedure.oid =
        'lor_studio.faculty_candidate_auth_context_allows(text,text[])'::pg_catalog.regprocedure
        AND procedure.proowner = command_owner_oid
        AND NOT procedure.prosecdef
        AND procedure.provolatile = 's'
    )
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
    OR pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.faculty_candidate_auth_context_allows(text,text[])',
      'EXECUTE'
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
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = ANY (ARRAY[
        'lor_studio.faculty_candidate_auth_handoff_reservations'::pg_catalog.regclass,
        'lor_studio.faculty_candidate_auth_handoff_redemptions'::pg_catalog.regclass
      ]::oid[])
        AND attribute.attnum > 0
        AND attribute.attacl IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_publication_rel AS publication_relation
      WHERE publication_relation.prrelid = ANY (ARRAY[
        'lor_studio.faculty_candidate_auth_handoff_reservations'::pg_catalog.regclass,
        'lor_studio.faculty_candidate_auth_handoff_redemptions'::pg_catalog.regclass
      ]::oid[])
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS class
      WHERE class.oid = ANY (ARRAY[
        'lor_studio.faculty_candidate_auth_handoff_reservations'::pg_catalog.regclass,
        'lor_studio.faculty_candidate_auth_handoff_redemptions'::pg_catalog.regclass
      ]::oid[])
        AND (
          class.reloptions IS NOT NULL
          OR class.relreplident <> 'd'
          OR class.relispartition
        )
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_inherits AS inheritance
      WHERE inheritance.inhrelid = ANY (ARRAY[
        'lor_studio.faculty_candidate_auth_handoff_reservations'::pg_catalog.regclass,
        'lor_studio.faculty_candidate_auth_handoff_redemptions'::pg_catalog.regclass
      ]::oid[])
        OR inheritance.inhparent = ANY (ARRAY[
          'lor_studio.faculty_candidate_auth_handoff_reservations'::pg_catalog.regclass,
          'lor_studio.faculty_candidate_auth_handoff_redemptions'::pg_catalog.regclass
        ]::oid[])
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_seclabel AS security_label
      WHERE security_label.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
        AND security_label.objoid = ANY (ARRAY[
          'lor_studio.faculty_candidate_auth_handoff_reservations'::pg_catalog.regclass,
          'lor_studio.faculty_candidate_auth_handoff_redemptions'::pg_catalog.regclass
        ]::oid[])
    )
  THEN
    RAISE EXCEPTION 'DR-133 faculty candidate handoff rollback refuses live or divergent custody'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_guard$;

REVOKE EXECUTE ON FUNCTION lor_studio.reserve_faculty_candidate_auth_handoff(
  text, text, text, integer
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.redeem_faculty_candidate_auth_handoff(
  text, text, text, text, timestamptz, timestamptz
) FROM lor_studio_app;

ALTER FUNCTION lor_studio.reserve_faculty_candidate_auth_handoff(
  text, text, text, integer
) OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.redeem_faculty_candidate_auth_handoff(
  text, text, text, text, timestamptz, timestamptz
) OWNER TO CURRENT_USER;

DROP FUNCTION lor_studio.reserve_faculty_candidate_auth_handoff(
  text, text, text, integer
);
DROP FUNCTION lor_studio.redeem_faculty_candidate_auth_handoff(
  text, text, text, text, timestamptz, timestamptz
);

DROP POLICY faculty_invitations_candidate_handoff_lock
ON lor_studio.faculty_invitations;
DROP POLICY faculty_invitations_candidate_handoff_select
ON lor_studio.faculty_invitations;
DROP POLICY faculty_otp_verification_receipts_candidate_handoff_select
ON lor_studio.faculty_otp_verification_receipts;
DROP POLICY faculty_otp_proof_revocations_candidate_handoff_select
ON lor_studio.faculty_otp_proof_revocations;
DROP POLICY faculty_candidate_auth_handoff_redemptions_command_insert
ON lor_studio.faculty_candidate_auth_handoff_redemptions;
DROP POLICY faculty_candidate_auth_handoff_redemptions_command_select
ON lor_studio.faculty_candidate_auth_handoff_redemptions;
DROP POLICY faculty_candidate_auth_handoff_reservations_command_insert
ON lor_studio.faculty_candidate_auth_handoff_reservations;
DROP POLICY faculty_candidate_auth_handoff_reservations_command_select
ON lor_studio.faculty_candidate_auth_handoff_reservations;

DROP TRIGGER faculty_candidate_auth_handoff_redemptions_append_only
ON lor_studio.faculty_candidate_auth_handoff_redemptions;
DROP TRIGGER faculty_candidate_auth_handoff_reservations_append_only
ON lor_studio.faculty_candidate_auth_handoff_reservations;

REVOKE SELECT, INSERT ON TABLE
  lor_studio.faculty_candidate_auth_handoff_redemptions,
  lor_studio.faculty_candidate_auth_handoff_reservations
FROM lor_studio_command_owner;

DROP TABLE lor_studio.faculty_candidate_auth_handoff_redemptions;
DROP TABLE lor_studio.faculty_candidate_auth_handoff_reservations;

REVOKE EXECUTE ON FUNCTION lor_studio.faculty_candidate_auth_context_allows(
  text, text[]
) FROM lor_studio_command_owner;
ALTER FUNCTION lor_studio.faculty_candidate_auth_context_allows(text, text[])
OWNER TO CURRENT_USER;
DROP FUNCTION lor_studio.faculty_candidate_auth_context_allows(text, text[]);

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
    RAISE EXCEPTION 'DR-133 faculty candidate handoff rollback postflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_postflight$;

DO $restore_sentinel$
DECLARE
  observed_sentinel text;
BEGIN
  SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO STRICT observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';
  EXECUTE pg_catalog.format(
    'COMMENT ON SCHEMA lor_studio IS %L',
    pg_catalog.regexp_replace(
      observed_sentinel,
      '\|facultyCandidateAuthHandoff=20260826011500$',
      ''
    )
  );
END
$restore_sentinel$;

COMMIT;
