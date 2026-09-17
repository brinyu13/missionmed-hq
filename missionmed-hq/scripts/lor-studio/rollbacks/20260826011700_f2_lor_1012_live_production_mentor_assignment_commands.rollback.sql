-- Rollback: 20260826011700_f2_lor_1012_live_production_mentor_assignment_commands.rollback.sql
-- Authority: F2-LOR-1012 / DR-120 / DR-133
-- Reverses: 20260826011700_f2_lor_1012_live_production_mentor_assignment_commands.sql
-- Exact rollback: explicit object removal only; command-owned rows must remain absent.

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
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000|identityScope=20260826010300|facultyInvitationCommands=20260826010500|facultyPrivateExportCommands=20260826010700|aiProposalCommands=20260826010900|studentEvidenceCommands=20260826011100|encryptedPrivateStorage=20260826011300|facultyCandidateAuthHandoff=20260826011500|mentorAssignmentCommands=20260826011700',
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
    RAISE EXCEPTION 'DR-133 mentor assignment rollback requires the exact successor-bound private Railway PostgreSQL identity'
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

DO $catalog_guard$
DECLARE
  owned_assignment_count bigint;
  owned_revocation_count bigint;
  owned_audit_count bigint;
  definer_count bigint;
  policy_count bigint;
  public_execute_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO owned_assignment_count
  FROM lor_studio.mentor_case_assignments AS assignment
  WHERE assignment.assignment_id ~ '^mentor_service_assignment_[a-f0-9]{64}$';

  SELECT pg_catalog.count(*) INTO owned_revocation_count
  FROM lor_studio.mentor_case_assignment_revocations AS revocation
  WHERE revocation.assignment_id ~ '^mentor_service_assignment_[a-f0-9]{64}$';

  SELECT pg_catalog.count(*) INTO owned_audit_count
  FROM lor_studio.recommendation_case_audit_events AS audit
  WHERE audit.event_type = ANY (
    ARRAY['mentor.assignment_issued', 'mentor.assignment_revoked']::text[]
  );

  SELECT pg_catalog.count(*) INTO definer_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner';

  SELECT pg_catalog.count(*) INTO policy_count
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

  SELECT pg_catalog.count(*) INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  IF owned_assignment_count <> 0
    OR owned_revocation_count <> 0
    OR owned_audit_count <> 0
    OR definer_count IS DISTINCT FROM 34
    OR policy_count IS DISTINCT FROM 7
    OR public_execute_count <> 0
    OR pg_catalog.to_regprocedure(
      'lor_studio.mentor_assignment_command_context_allows(text,text,text,text)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.assign_mentor_to_case(text,text,text,text,integer,text)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.revoke_mentor_case_assignment(text,text,text,text,text)'
    ) IS NULL
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
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_command_owner', 'lor_studio.mentor_case_assignments', 'INSERT'
    )
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.mentor_case_assignment_revocations',
      'INSERT'
    )
  THEN
    RAISE EXCEPTION 'DR-133 mentor assignment rollback catalog or data custody mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_guard$;

-- Literal reverse operations follow. This marker is consumed by static custody tests.
REVOKE EXECUTE ON FUNCTION lor_studio.assign_mentor_to_case(
  text, text, text, text, integer, text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.revoke_mentor_case_assignment(
  text, text, text, text, text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.mentor_assignment_command_context_allows(
  text, text, text, text
) FROM lor_studio_command_owner;
REVOKE INSERT ON TABLE
  lor_studio.mentor_case_assignments,
  lor_studio.mentor_case_assignment_revocations
FROM lor_studio_command_owner;

DROP FUNCTION lor_studio.assign_mentor_to_case(
  text, text, text, text, integer, text
);
DROP FUNCTION lor_studio.revoke_mentor_case_assignment(
  text, text, text, text, text
);

DROP POLICY recommendation_case_audit_mentor_assignment_service_insert
  ON lor_studio.recommendation_case_audit_events;
DROP POLICY recommendation_case_audit_mentor_assignment_service_select
  ON lor_studio.recommendation_case_audit_events;
DROP POLICY mentor_case_assignment_revocations_service_insert
  ON lor_studio.mentor_case_assignment_revocations;
DROP POLICY mentor_case_assignment_revocations_service_select
  ON lor_studio.mentor_case_assignment_revocations;
DROP POLICY mentor_case_assignments_service_insert
  ON lor_studio.mentor_case_assignments;
DROP POLICY mentor_case_assignments_service_select
  ON lor_studio.mentor_case_assignments;
DROP POLICY recommendation_cases_mentor_assignment_service_select
  ON lor_studio.recommendation_cases;

DROP FUNCTION lor_studio.mentor_assignment_command_context_allows(
  text, text, text, text
);

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

DO $restore_sentinel$
DECLARE
  observed_sentinel text;
  suffix text := '|mentorAssignmentCommands=20260826011700';
BEGIN
  SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO STRICT observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';
  IF pg_catalog.right(observed_sentinel, pg_catalog.length(suffix)) IS DISTINCT FROM suffix THEN
    RAISE EXCEPTION 'DR-133 mentor assignment rollback sentinel mismatch'
      USING ERRCODE = '55000';
  END IF;
  EXECUTE pg_catalog.format(
    'COMMENT ON SCHEMA lor_studio IS %L',
    pg_catalog.left(
      observed_sentinel,
      pg_catalog.length(observed_sentinel) - pg_catalog.length(suffix)
    )
  );
END
$restore_sentinel$;

DO $catalog_postflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  policy_count bigint;
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

  SELECT pg_catalog.count(*) INTO policy_count
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
    OR policy_count <> 0
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
    OR pg_catalog.has_table_privilege(
      'lor_studio_command_owner', 'lor_studio.mentor_case_assignments', 'INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.mentor_case_assignment_revocations',
      'INSERT'
    )
  THEN
    RAISE EXCEPTION 'DR-133 mentor assignment rollback postflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_postflight$;

COMMIT;
