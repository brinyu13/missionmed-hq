-- Rollback: 20260826011300_f2_lor_1012_live_production_encrypted_private_storage_commands.rollback.sql
-- Authority: F2-LOR-1012 / DR-133
-- Reverses: 20260826011300_f2_lor_1012_live_production_encrypted_private_storage_commands.sql
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
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000|identityScope=20260826010300|facultyInvitationCommands=20260826010500|facultyPrivateExportCommands=20260826010700|aiProposalCommands=20260826010900|studentEvidenceCommands=20260826011100|encryptedPrivateStorage=20260826011300',
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
    RAISE EXCEPTION 'DR-133 encrypted storage rollback requires the exact successor-bound private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.private_artifact_versions,
  lor_studio.released_student_documents
IN ACCESS EXCLUSIVE MODE;

DO $catalog_guard$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  target_policy_count bigint;
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
  SELECT pg_catalog.count(*) INTO target_policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND policy.polname = ANY (ARRAY[
      'private_artifact_versions_storage_select',
      'private_artifact_versions_storage_insert',
      'released_student_documents_private_storage_select'
    ]::text[]);
  IF relation_count IS DISTINCT FROM 34
    OR forced_rls_count IS DISTINCT FROM 34
    OR definer_count IS DISTINCT FROM 30
    OR target_policy_count IS DISTINCT FROM 3
    OR EXISTS (SELECT 1 FROM lor_studio.private_artifact_versions)
    OR pg_catalog.to_regprocedure(
      'lor_studio.put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.private_storage_context_allows(text,text,text[])'
    ) IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_trigger AS trigger
      JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relname = 'private_artifact_versions'
        AND trigger.tgname = 'private_artifact_versions_append_only'
        AND NOT trigger.tgisinternal
    )
  THEN
    RAISE EXCEPTION 'DR-133 encrypted storage rollback refuses non-empty or divergent custody'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_guard$;

REVOKE EXECUTE ON FUNCTION lor_studio.put_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.get_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,text,text
) FROM lor_studio_app;

ALTER FUNCTION lor_studio.put_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text
) OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.get_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,text,text
) OWNER TO CURRENT_USER;
DROP FUNCTION lor_studio.put_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text
);
DROP FUNCTION lor_studio.get_encrypted_private_artifact_version(
  text,text,text,text,text,text,text,text,text,text,text
);

DROP POLICY released_student_documents_private_storage_select
ON lor_studio.released_student_documents;
DROP POLICY private_artifact_versions_storage_insert
ON lor_studio.private_artifact_versions;
DROP POLICY private_artifact_versions_storage_select
ON lor_studio.private_artifact_versions;
DROP TRIGGER private_artifact_versions_append_only
ON lor_studio.private_artifact_versions;
REVOKE SELECT, INSERT ON TABLE lor_studio.private_artifact_versions
FROM lor_studio_command_owner;
DROP TABLE lor_studio.private_artifact_versions;

REVOKE EXECUTE ON FUNCTION lor_studio.private_storage_context_allows(text,text,text[])
FROM lor_studio_command_owner;
DROP FUNCTION lor_studio.private_storage_context_allows(text,text,text[]);

DO $catalog_postflight$
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
  IF relation_count IS DISTINCT FROM 33
    OR forced_rls_count IS DISTINCT FROM 33
    OR definer_count IS DISTINCT FROM 28
    OR pg_catalog.to_regclass('lor_studio.private_artifact_versions') IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)'
    ) IS NOT NULL
  THEN
    RAISE EXCEPTION 'DR-133 encrypted storage rollback postflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_postflight$;

DO $restore_sentinel$
DECLARE observed_sentinel text;
BEGIN
  SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO STRICT observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';
  EXECUTE pg_catalog.format(
    'COMMENT ON SCHEMA lor_studio IS %L',
    pg_catalog.regexp_replace(
      observed_sentinel, '\|encryptedPrivateStorage=20260826011300$', ''
    )
  );
END
$restore_sentinel$;

COMMIT;
