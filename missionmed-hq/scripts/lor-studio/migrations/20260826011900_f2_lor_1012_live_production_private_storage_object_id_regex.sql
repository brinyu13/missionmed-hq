-- Migration: 20260826011900_f2_lor_1012_live_production_private_storage_object_id_regex.sql
-- Authority: F2-LOR-1012 / DR-120 / DR-133
-- Date: 2026-08-26
-- Depends on: 20260826011700_f2_lor_1012_live_production_mentor_assignment_commands.sql
-- Description: Preserve the 300-character private-storage object-id contract without
-- PostgreSQL's 255-count regular-expression repetition ceiling.
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
    RAISE EXCEPTION 'DR-133 private-storage object-id repair requires the exact successor-bound private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE lor_studio.private_artifact_versions IN ACCESS EXCLUSIVE MODE;

DO $catalog_preflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  app_execute_count bigint;
  policy_count bigint;
  public_execute_count bigint;
  identifier_constraint_count bigint;
  identifier_constraint_valid boolean;
  identifier_constraint_definition text;
  put_source_hash text;
  get_source_hash text;
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

  SELECT pg_catalog.count(*) INTO app_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.has_function_privilege('lor_studio_app', procedure.oid, 'EXECUTE');

  SELECT pg_catalog.count(*) INTO policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio';

  SELECT pg_catalog.count(*) INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  SELECT
    pg_catalog.count(*),
    COALESCE(pg_catalog.bool_and(constraint_record.convalidated), false),
    pg_catalog.max(pg_catalog.pg_get_constraintdef(constraint_record.oid, true))
  INTO
    identifier_constraint_count,
    identifier_constraint_valid,
    identifier_constraint_definition
  FROM pg_catalog.pg_constraint AS constraint_record
  WHERE constraint_record.conrelid =
      pg_catalog.to_regclass('lor_studio.private_artifact_versions')
    AND constraint_record.conname = 'private_artifact_versions_identifiers'
    AND constraint_record.contype = 'c';

  SELECT pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(procedure.prosrc, 'UTF8')),
    'hex'
  )
  INTO put_source_hash
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = pg_catalog.to_regprocedure(
    'lor_studio.put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)'
  )::oid
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner'
    AND procedure.proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[];

  SELECT pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(procedure.prosrc, 'UTF8')),
    'hex'
  )
  INTO get_source_hash
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = pg_catalog.to_regprocedure(
    'lor_studio.get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)'
  )::oid
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner'
    AND procedure.proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[];

  IF relation_count IS DISTINCT FROM 36
    OR forced_rls_count IS DISTINCT FROM 36
    OR definer_count IS DISTINCT FROM 34
    OR app_execute_count IS DISTINCT FROM 33
    OR policy_count IS DISTINCT FROM 155
    OR public_execute_count <> 0
    OR identifier_constraint_count IS DISTINCT FROM 1
    OR NOT identifier_constraint_valid
    OR pg_catalog.strpos(
      identifier_constraint_definition,
      $predecessor_pattern$object_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$'$predecessor_pattern$
    ) = 0
    OR pg_catalog.strpos(identifier_constraint_definition, 'length(object_id)') <> 0
    OR put_source_hash IS DISTINCT FROM
      '0007cdc60ee8c18a0c62aebf7661eba160f8e6de6d69e9a339cdadff517b8bc2'
    OR get_source_hash IS DISTINCT FROM
      'afe336d992bfe9e66b230ff7c87add9805370ae5581c26be1000a3138c6992ca'
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'DR-133 private-storage object-id repair predecessor custody mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_preflight$;

ALTER TABLE lor_studio.private_artifact_versions
  DROP CONSTRAINT private_artifact_versions_identifiers;
ALTER TABLE lor_studio.private_artifact_versions
  ADD CONSTRAINT private_artifact_versions_identifiers CHECK (
    case_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    AND student_auth_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.length(object_id) BETWEEN 1 AND 300
    AND object_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'
    AND version_id ~ '^version_[a-f0-9]{64}$'
    AND created_by_actor_ref ~ '^actor_[a-f0-9]{64}$'
  );

DO $replace_function_definitions$
DECLARE
  predecessor_fragment text := $predecessor_fragment$    OR candidate_object_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$'$predecessor_fragment$;
  successor_fragment text := $successor_fragment$    OR pg_catalog.length(candidate_object_id) NOT BETWEEN 1 AND 300
    OR candidate_object_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'$successor_fragment$;
  function_identity text;
  function_definition text;
  replacement_count integer;
BEGIN
  FOREACH function_identity IN ARRAY ARRAY[
    'lor_studio.put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)',
    'lor_studio.get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)'
  ]::text[]
  LOOP
    SELECT pg_catalog.pg_get_functiondef(procedure.oid)
    INTO STRICT function_definition
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = pg_catalog.to_regprocedure(function_identity)::oid;

    replacement_count := (
      pg_catalog.length(function_definition)
      - pg_catalog.length(pg_catalog.replace(
        function_definition,
        predecessor_fragment,
        ''
      ))
    ) / pg_catalog.length(predecessor_fragment);

    IF replacement_count IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'DR-133 private-storage object-id repair function definition drifted'
        USING ERRCODE = '55000';
    END IF;

    EXECUTE pg_catalog.replace(
      function_definition,
      predecessor_fragment,
      successor_fragment
    );
  END LOOP;
END
$replace_function_definitions$;

DO $catalog_postflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  app_execute_count bigint;
  policy_count bigint;
  public_execute_count bigint;
  identifier_constraint_count bigint;
  identifier_constraint_valid boolean;
  identifier_constraint_definition text;
  put_source_hash text;
  get_source_hash text;
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

  SELECT pg_catalog.count(*) INTO app_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.has_function_privilege('lor_studio_app', procedure.oid, 'EXECUTE');

  SELECT pg_catalog.count(*) INTO policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio';

  SELECT pg_catalog.count(*) INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  SELECT
    pg_catalog.count(*),
    COALESCE(pg_catalog.bool_and(constraint_record.convalidated), false),
    pg_catalog.max(pg_catalog.pg_get_constraintdef(constraint_record.oid, true))
  INTO
    identifier_constraint_count,
    identifier_constraint_valid,
    identifier_constraint_definition
  FROM pg_catalog.pg_constraint AS constraint_record
  WHERE constraint_record.conrelid =
      pg_catalog.to_regclass('lor_studio.private_artifact_versions')
    AND constraint_record.conname = 'private_artifact_versions_identifiers'
    AND constraint_record.contype = 'c';

  SELECT pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(procedure.prosrc, 'UTF8')),
    'hex'
  )
  INTO put_source_hash
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = pg_catalog.to_regprocedure(
    'lor_studio.put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)'
  )::oid;

  SELECT pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(procedure.prosrc, 'UTF8')),
    'hex'
  )
  INTO get_source_hash
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = pg_catalog.to_regprocedure(
    'lor_studio.get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)'
  )::oid;

  IF relation_count IS DISTINCT FROM 36
    OR forced_rls_count IS DISTINCT FROM 36
    OR definer_count IS DISTINCT FROM 34
    OR app_execute_count IS DISTINCT FROM 33
    OR policy_count IS DISTINCT FROM 155
    OR public_execute_count <> 0
    OR identifier_constraint_count IS DISTINCT FROM 1
    OR NOT identifier_constraint_valid
    OR pg_catalog.strpos(identifier_constraint_definition, 'length(object_id)') = 0
    OR pg_catalog.strpos(identifier_constraint_definition, '300') = 0
    OR pg_catalog.strpos(
      identifier_constraint_definition,
      $successor_pattern$object_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'$successor_pattern$
    ) = 0
    OR pg_catalog.strpos(identifier_constraint_definition, '{0,299}') <> 0
    OR put_source_hash IS DISTINCT FROM
      'c6df77935587bb0b8e344273aff916db9fe4590f8833afc266a94317eb8958cb'
    OR get_source_hash IS DISTINCT FROM
      '2d7e6ca11ee0499361ce065cc6557eea82d65764a4b81ed89707599d8c2eebaf'
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'DR-133 private-storage object-id repair postflight mismatch'
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
    observed_sentinel || '|privateStorageObjectIdRegex=20260826011900'
  );
END
$advance_sentinel$;

COMMIT;
