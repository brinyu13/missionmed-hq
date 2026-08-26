-- Rollback: 20260826010500_f2_lor_1012_live_production_faculty_invitation_commands.rollback.sql
-- Authority: F2-LOR-1012 / DR-120 / DR-133
-- Reverses: 20260826010500_f2_lor_1012_live_production_faculty_invitation_commands.sql
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
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260826010000|identityScope=20260826010300|facultyInvitationCommands=20260826010500',
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
    RAISE EXCEPTION 'DR-133 invitation command rollback requires the exact successor-bound private Railway PostgreSQL target identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.consent_receipts,
  lor_studio.faculty_invitation_command_receipts,
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

DO $catalog_guard$
DECLARE
  postgres_major integer := pg_catalog.current_setting('server_version_num')::integer / 10000;
  relation_count bigint;
  forced_rls_count bigint;
  function_count bigint;
  definer_count bigint;
  policy_count bigint;
  trigger_count bigint;
  index_count bigint;
  constraint_count bigint;
  catalog_fingerprint text;
  exact_custody_fingerprint text;
  observed_index_fingerprint text;
  observed_constraint_fingerprint text;
  dependency_fingerprint text;
  nonowner_acl_count bigint;
  invitation_policy_count bigint;
  faculty_context_source text;
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
  expected_catalog_fingerprint constant text := CASE postgres_major
    WHEN 16 THEN 'eb4b7791ae16854bc303071d5f9e2e77d929a4c1e803a309404c48e348bf346f'
    WHEN 18 THEN 'b4c7bbeb5d49c651d5ad0378a3bf946e74f20eaf7ede416763c17f881e813628'
    ELSE NULL
  END;
  expected_index_fingerprint constant text :=
    'e6db9894469dc8759bf744b393d5d88b1bd61c86b2ba0d08b9d397b191d81baf';
  expected_constraint_fingerprint constant text := CASE postgres_major
    WHEN 16 THEN 'a8aa002c39963b9748571999ab10ec8c65cc06d575e7b9a52ff09247720e0c92'
    WHEN 18 THEN 'c8351d93dc16910d294ec6ef511e645bcda0c8017908bbba2fb2e00e8877fc33'
    ELSE NULL
  END;
  expected_dependency_fingerprint constant text :=
    '6d48ee2035eb01e1f2515746d55e3a1dcbdee5f14df4b20da85145edb4bb95d8';
  expected_exact_custody_fingerprint constant text := CASE postgres_major
    WHEN 16 THEN 'da75dfc13713b48af9ae9b9fef2180e250c150f9eaa22c50f0fb1d51c73ae001'
    WHEN 18 THEN '7c0c453eb5cf36497b093c921da7e648d9f660be0ab6dccabac7e3a22d9bb7be'
    ELSE NULL
  END;
BEGIN
  -- Exact full-catalog custody.  This includes column ACLs, comments,
  -- security labels, internal trigger state, publication/extended-statistics
  -- membership, and every dependency edge involving an invitation successor
  -- object.  Counts alone cannot authorize a destructive reverse.
  SELECT
    fingerprint.catalog_fingerprint,
    fingerprint.index_count::bigint,
    fingerprint.index_fingerprint,
    fingerprint.constraint_count::bigint,
    fingerprint.constraint_fingerprint,
    fingerprint.dependency_fingerprint
  INTO STRICT
    catalog_fingerprint,
    index_count,
    observed_index_fingerprint,
    constraint_count,
    observed_constraint_fingerprint,
    dependency_fingerprint
  FROM (
    WITH role_ids AS (
      SELECT
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user) AS migration_admin_oid,
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'lor_studio_command_owner')
          AS command_owner_oid,
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'lor_studio_app') AS app_role_oid
    ),
    catalog_rows AS (
      SELECT
        'schema'::text AS category,
        namespace.nspname::text AS identity,
        pg_catalog.jsonb_build_object(
          'owner', CASE
            WHEN namespace.nspowner = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN namespace.nspowner = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN namespace.nspowner = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(namespace.nspowner)
          END,
          'aclIsNull', namespace.nspacl IS NULL,
          'acl', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'grantor', CASE
                WHEN acl.grantor = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
                WHEN acl.grantor = roles.command_owner_oid THEN 'COMMAND_OWNER'
                WHEN acl.grantor = roles.app_role_oid THEN 'APP'
                ELSE pg_catalog.pg_get_userbyid(acl.grantor)
              END,
              'grantee', CASE
                WHEN acl.grantee = 0 THEN 'PUBLIC'
                WHEN acl.grantee = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
                WHEN acl.grantee = roles.command_owner_oid THEN 'COMMAND_OWNER'
                WHEN acl.grantee = roles.app_role_oid THEN 'APP'
                ELSE pg_catalog.pg_get_userbyid(acl.grantee)
              END,
              'privilege', acl.privilege_type,
              'grantable', acl.is_grantable
            ) ORDER BY acl.grantee, acl.privilege_type, acl.is_grantable)
            FROM pg_catalog.aclexplode(namespace.nspacl) AS acl
          ), '[]'::jsonb),
          'securityLabels', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'provider', security_label.provider,
              'label', security_label.label,
              'subId', security_label.objsubid
            ) ORDER BY security_label.provider, security_label.objsubid)
            FROM pg_catalog.pg_seclabel AS security_label
            WHERE security_label.classoid = 'pg_catalog.pg_namespace'::pg_catalog.regclass
              AND security_label.objoid = namespace.oid
          ), '[]'::jsonb)
        ) AS definition
      FROM pg_catalog.pg_namespace AS namespace
      CROSS JOIN role_ids AS roles
      WHERE namespace.nspname = 'lor_studio'

      UNION ALL

      SELECT
        'class',
        class.relkind::text || ':' || class.relname,
        pg_catalog.jsonb_build_object(
          'kind', class.relkind,
          'owner', CASE
            WHEN class.relowner = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN class.relowner = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN class.relowner = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(class.relowner)
          END,
          'persistence', class.relpersistence,
          'rowSecurity', class.relrowsecurity,
          'forceRowSecurity', class.relforcerowsecurity,
          'replicaIdentity', class.relreplident,
          'isPartition', class.relispartition,
          'hasIndex', class.relhasindex,
          'checks', class.relchecks,
          'hasRules', class.relhasrules,
          'hasTriggers', class.relhastriggers,
          'natts', (
            SELECT pg_catalog.count(*)
            FROM pg_catalog.pg_attribute AS live_attribute
            WHERE live_attribute.attrelid = class.oid
              AND live_attribute.attnum > 0
              AND NOT live_attribute.attisdropped
          ),
          'options', pg_catalog.to_jsonb(class.reloptions),
          'accessMethod', access_method.amname,
          'partitionBound', pg_catalog.pg_get_expr(class.relpartbound, class.oid, true),
          'indexDefinition', CASE WHEN class.relkind = 'i'
            THEN pg_catalog.pg_get_indexdef(class.oid, 0, true) ELSE NULL END,
          'viewDefinition', CASE WHEN class.relkind IN ('v', 'm')
            THEN pg_catalog.pg_get_viewdef(class.oid, true) ELSE NULL END,
          'aclIsNull', class.relacl IS NULL,
          'acl', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'grantor', CASE
                WHEN acl.grantor = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
                WHEN acl.grantor = roles.command_owner_oid THEN 'COMMAND_OWNER'
                WHEN acl.grantor = roles.app_role_oid THEN 'APP'
                ELSE pg_catalog.pg_get_userbyid(acl.grantor)
              END,
              'grantee', CASE
                WHEN acl.grantee = 0 THEN 'PUBLIC'
                WHEN acl.grantee = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
                WHEN acl.grantee = roles.command_owner_oid THEN 'COMMAND_OWNER'
                WHEN acl.grantee = roles.app_role_oid THEN 'APP'
                ELSE pg_catalog.pg_get_userbyid(acl.grantee)
              END,
              'privilege', acl.privilege_type,
              'grantable', acl.is_grantable
            ) ORDER BY acl.grantee, acl.privilege_type, acl.is_grantable)
            FROM pg_catalog.aclexplode(class.relacl) AS acl
          ), '[]'::jsonb),
          'comment', pg_catalog.obj_description(class.oid, 'pg_class'),
          'securityLabels', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'provider', security_label.provider,
              'label', security_label.label,
              'subId', security_label.objsubid
            ) ORDER BY security_label.provider, security_label.objsubid)
            FROM pg_catalog.pg_seclabel AS security_label
            WHERE security_label.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
              AND security_label.objoid = class.oid
              AND security_label.objsubid = 0
          ), '[]'::jsonb)
        )
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = class.relam
      CROSS JOIN role_ids AS roles
      WHERE namespace.nspname = 'lor_studio'

      UNION ALL

      SELECT
        'column',
        class.relkind::text || ':' || class.relname || '.' ||
          attribute.attnum::text || '.' || attribute.attname,
        pg_catalog.jsonb_build_object(
          'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
          'notNull', attribute.attnotnull,
          'default', pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid, true),
          'identity', attribute.attidentity,
          'generated', attribute.attgenerated,
          'collation', CASE WHEN attribute.attcollation = 0 THEN NULL ELSE
            pg_catalog.format('%I.%I', collation_namespace.nspname, collation_row.collname) END,
          'storage', attribute.attstorage,
          'compression', attribute.attcompression,
          'statistics', attribute.attstattarget,
          'options', pg_catalog.to_jsonb(attribute.attoptions),
          'fdwOptions', pg_catalog.to_jsonb(attribute.attfdwoptions),
          'aclIsNull', attribute.attacl IS NULL,
          'acl', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'grantor', CASE
                WHEN acl.grantor = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
                WHEN acl.grantor = roles.command_owner_oid THEN 'COMMAND_OWNER'
                WHEN acl.grantor = roles.app_role_oid THEN 'APP'
                ELSE pg_catalog.pg_get_userbyid(acl.grantor)
              END,
              'grantee', CASE
                WHEN acl.grantee = 0 THEN 'PUBLIC'
                WHEN acl.grantee = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
                WHEN acl.grantee = roles.command_owner_oid THEN 'COMMAND_OWNER'
                WHEN acl.grantee = roles.app_role_oid THEN 'APP'
                ELSE pg_catalog.pg_get_userbyid(acl.grantee)
              END,
              'privilege', acl.privilege_type,
              'grantable', acl.is_grantable
            ) ORDER BY acl.grantee, acl.privilege_type, acl.is_grantable)
            FROM pg_catalog.aclexplode(attribute.attacl) AS acl
          ), '[]'::jsonb),
          'comment', pg_catalog.col_description(class.oid, attribute.attnum),
          'securityLabels', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'provider', security_label.provider,
              'label', security_label.label
            ) ORDER BY security_label.provider)
            FROM pg_catalog.pg_seclabel AS security_label
            WHERE security_label.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
              AND security_label.objoid = class.oid
              AND security_label.objsubid = attribute.attnum
          ), '[]'::jsonb)
        )
      FROM pg_catalog.pg_attribute AS attribute
      JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      LEFT JOIN pg_catalog.pg_attrdef AS default_value
        ON default_value.adrelid = attribute.attrelid
       AND default_value.adnum = attribute.attnum
      LEFT JOIN pg_catalog.pg_collation AS collation_row
        ON collation_row.oid = attribute.attcollation
      LEFT JOIN pg_catalog.pg_namespace AS collation_namespace
        ON collation_namespace.oid = collation_row.collnamespace
      CROSS JOIN role_ids AS roles
      WHERE namespace.nspname = 'lor_studio'
        AND class.relkind IN ('r', 'v', 'm')
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped

      UNION ALL

      SELECT
        'function',
        procedure.proname || '(' ||
          pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')',
        pg_catalog.jsonb_build_object(
          'definition', pg_catalog.pg_get_functiondef(procedure.oid),
          'owner', CASE
            WHEN procedure.proowner = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN procedure.proowner = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN procedure.proowner = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(procedure.proowner)
          END,
          'aclIsNull', procedure.proacl IS NULL,
          'acl', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'grantor', CASE
                WHEN acl.grantor = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
                WHEN acl.grantor = roles.command_owner_oid THEN 'COMMAND_OWNER'
                WHEN acl.grantor = roles.app_role_oid THEN 'APP'
                ELSE pg_catalog.pg_get_userbyid(acl.grantor)
              END,
              'grantee', CASE
                WHEN acl.grantee = 0 THEN 'PUBLIC'
                WHEN acl.grantee = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
                WHEN acl.grantee = roles.command_owner_oid THEN 'COMMAND_OWNER'
                WHEN acl.grantee = roles.app_role_oid THEN 'APP'
                ELSE pg_catalog.pg_get_userbyid(acl.grantee)
              END,
              'privilege', acl.privilege_type,
              'grantable', acl.is_grantable
            ) ORDER BY acl.grantee, acl.privilege_type, acl.is_grantable)
            FROM pg_catalog.aclexplode(procedure.proacl) AS acl
          ), '[]'::jsonb),
          'comment', pg_catalog.obj_description(procedure.oid, 'pg_proc'),
          'securityLabels', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'provider', security_label.provider,
              'label', security_label.label,
              'subId', security_label.objsubid
            ) ORDER BY security_label.provider, security_label.objsubid)
            FROM pg_catalog.pg_seclabel AS security_label
            WHERE security_label.classoid = 'pg_catalog.pg_proc'::pg_catalog.regclass
              AND security_label.objoid = procedure.oid
          ), '[]'::jsonb)
        )
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      CROSS JOIN role_ids AS roles
      WHERE namespace.nspname = 'lor_studio'

      UNION ALL

      SELECT
        'policy',
        class.relname || '.' || policy.polname,
        pg_catalog.jsonb_build_object(
          'command', policy.polcmd,
          'permissive', policy.polpermissive,
          'roles', COALESCE((
            SELECT pg_catalog.jsonb_agg(COALESCE(role.rolname, 'PUBLIC')
              ORDER BY COALESCE(role.rolname, 'PUBLIC'))
            FROM pg_catalog.unnest(policy.polroles) AS policy_role(role_oid)
            LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = policy_role.role_oid
          ), '[]'::jsonb),
          'qualifier', pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, true),
          'withCheck', pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid, true),
          'comment', pg_catalog.obj_description(policy.oid, 'pg_policy'),
          'securityLabels', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'provider', security_label.provider,
              'label', security_label.label,
              'subId', security_label.objsubid
            ) ORDER BY security_label.provider, security_label.objsubid)
            FROM pg_catalog.pg_seclabel AS security_label
            WHERE security_label.classoid = 'pg_catalog.pg_policy'::pg_catalog.regclass
              AND security_label.objoid = policy.oid
          ), '[]'::jsonb)
        )
      FROM pg_catalog.pg_policy AS policy
      JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'

      UNION ALL

      SELECT
        'trigger',
        class.relname || '.' || CASE WHEN trigger.tgisinternal THEN
          'internal:' || COALESCE(constraint_row.conname, '<unbound>') || ':' ||
          function_row.proname || '(' ||
          pg_catalog.pg_get_function_identity_arguments(function_row.oid) || '):' ||
          trigger.tgtype::text
        ELSE 'user:' || trigger.tgname END,
        pg_catalog.jsonb_build_object(
          'internal', trigger.tgisinternal,
          'enabled', trigger.tgenabled,
          'type', trigger.tgtype,
          'constraint', constraint_row.conname,
          'function', function_row.proname || '(' ||
            pg_catalog.pg_get_function_identity_arguments(function_row.oid) || ')',
          'definition', CASE WHEN trigger.tgisinternal THEN
            pg_catalog.regexp_replace(
              pg_catalog.pg_get_triggerdef(trigger.oid, true),
              '^CREATE CONSTRAINT TRIGGER [^ ]+',
              'CREATE CONSTRAINT TRIGGER <internal>'
            )
          ELSE pg_catalog.pg_get_triggerdef(trigger.oid, true) END,
          'comment', pg_catalog.obj_description(trigger.oid, 'pg_trigger'),
          'securityLabels', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'provider', security_label.provider,
              'label', security_label.label,
              'subId', security_label.objsubid
            ) ORDER BY security_label.provider, security_label.objsubid)
            FROM pg_catalog.pg_seclabel AS security_label
            WHERE security_label.classoid = 'pg_catalog.pg_trigger'::pg_catalog.regclass
              AND security_label.objoid = trigger.oid
          ), '[]'::jsonb)
        )
      FROM pg_catalog.pg_trigger AS trigger
      JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      JOIN pg_catalog.pg_proc AS function_row ON function_row.oid = trigger.tgfoid
      LEFT JOIN pg_catalog.pg_constraint AS constraint_row
        ON constraint_row.oid = trigger.tgconstraint
      WHERE namespace.nspname = 'lor_studio'

      UNION ALL

      SELECT
        'constraint',
        COALESCE(class.relname, '<type>') || '.' || constraint_row.contype::text || '.' ||
          constraint_row.conname,
        pg_catalog.jsonb_build_object(
          'type', constraint_row.contype,
          'deferrable', constraint_row.condeferrable,
          'deferred', constraint_row.condeferred,
          'validated', constraint_row.convalidated,
          'noInherit', constraint_row.connoinherit,
          'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true),
          'comment', pg_catalog.obj_description(constraint_row.oid, 'pg_constraint'),
          'securityLabels', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'provider', security_label.provider,
              'label', security_label.label,
              'subId', security_label.objsubid
            ) ORDER BY security_label.provider, security_label.objsubid)
            FROM pg_catalog.pg_seclabel AS security_label
            WHERE security_label.classoid = 'pg_catalog.pg_constraint'::pg_catalog.regclass
              AND security_label.objoid = constraint_row.oid
          ), '[]'::jsonb)
        )
      FROM pg_catalog.pg_constraint AS constraint_row
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = constraint_row.connamespace
      LEFT JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
      WHERE namespace.nspname = 'lor_studio'

      UNION ALL

      SELECT
        'type',
        type.typtype::text || ':' || type.typname,
        pg_catalog.jsonb_build_object(
          'owner', CASE
            WHEN type.typowner = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN type.typowner = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN type.typowner = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(type.typowner)
          END,
          'kind', type.typtype,
          'category', type.typcategory,
          'notNull', type.typnotnull,
          'byValue', type.typbyval,
          'length', type.typlen,
          'alignment', type.typalign,
          'storage', type.typstorage,
          'elementType', CASE WHEN type.typelem = 0 THEN NULL
            ELSE pg_catalog.format_type(type.typelem, NULL) END,
          'arrayType', CASE WHEN type.typarray = 0 THEN NULL
            ELSE pg_catalog.format_type(type.typarray, NULL) END,
          'aclIsNull', type.typacl IS NULL,
          'comment', pg_catalog.obj_description(type.oid, 'pg_type'),
          'securityLabels', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'provider', security_label.provider,
              'label', security_label.label,
              'subId', security_label.objsubid
            ) ORDER BY security_label.provider, security_label.objsubid)
            FROM pg_catalog.pg_seclabel AS security_label
            WHERE security_label.classoid = 'pg_catalog.pg_type'::pg_catalog.regclass
              AND security_label.objoid = type.oid
          ), '[]'::jsonb)
        )
      FROM pg_catalog.pg_type AS type
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = type.typnamespace
      CROSS JOIN role_ids AS roles
      WHERE namespace.nspname = 'lor_studio'

      UNION ALL

      SELECT
        'publication_relation',
        publication.pubname || '.' || class.relname,
        pg_catalog.jsonb_build_object(
          'rowFilter', pg_catalog.pg_get_expr(
            publication_relation.prqual,
            publication_relation.prrelid,
            true
          ),
          'columns', COALESCE((
            SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY published.ordinality)
            FROM pg_catalog.unnest(publication_relation.prattrs::smallint[])
              WITH ORDINALITY AS published(attnum, ordinality)
            JOIN pg_catalog.pg_attribute AS attribute
              ON attribute.attrelid = publication_relation.prrelid
             AND attribute.attnum = published.attnum
          ), '[]'::jsonb)
        )
      FROM pg_catalog.pg_publication_rel AS publication_relation
      JOIN pg_catalog.pg_publication AS publication
        ON publication.oid = publication_relation.prpubid
      JOIN pg_catalog.pg_class AS class ON class.oid = publication_relation.prrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'

      UNION ALL

      SELECT
        'extended_statistics',
        class.relname || '.' || statistics.stxname,
        pg_catalog.jsonb_build_object(
          'owner', CASE
            WHEN statistics.stxowner = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN statistics.stxowner = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN statistics.stxowner = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(statistics.stxowner)
          END,
          'target', statistics.stxstattarget,
          'kinds', pg_catalog.to_jsonb(statistics.stxkind),
          'keys', COALESCE((
            SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY statistic_key.ordinality)
            FROM pg_catalog.unnest(statistics.stxkeys::smallint[])
              WITH ORDINALITY AS statistic_key(attnum, ordinality)
            JOIN pg_catalog.pg_attribute AS attribute
              ON attribute.attrelid = statistics.stxrelid
             AND attribute.attnum = statistic_key.attnum
          ), '[]'::jsonb),
          'definition', pg_catalog.pg_get_statisticsobjdef(statistics.oid)
        )
      FROM pg_catalog.pg_statistic_ext AS statistics
      JOIN pg_catalog.pg_class AS class ON class.oid = statistics.stxrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = statistics.stxnamespace
      CROSS JOIN role_ids AS roles
      WHERE namespace.nspname = 'lor_studio'
    ),
    catalog_fingerprint AS (
      SELECT lor_studio.canonical_jsonb_sha256(COALESCE(
        pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'category', category,
          'identity', identity,
          'definition', definition
        ) ORDER BY category, identity),
        '[]'::jsonb
      )) AS value
      FROM catalog_rows
    ),
    index_inventory AS (
      SELECT
        index_class.relname::text AS object_name,
        relation_class.relname::text AS relation_name,
        pg_catalog.pg_get_indexdef(index_class.oid, 0, false) AS definition
      FROM pg_catalog.pg_class AS index_class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
      JOIN pg_catalog.pg_index AS index_row ON index_row.indexrelid = index_class.oid
      JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = index_row.indrelid
      WHERE namespace.nspname = 'lor_studio' AND index_class.relkind = 'i'
    ),
    index_fingerprint AS (
      SELECT
        pg_catalog.count(*) AS object_count,
        pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
          COALESCE(pg_catalog.string_agg(pg_catalog.format(
            '%s:%s|%s:%s|%s:%s',
            pg_catalog.octet_length(pg_catalog.convert_to(object_name, 'UTF8')), object_name,
            pg_catalog.octet_length(pg_catalog.convert_to(relation_name, 'UTF8')), relation_name,
            pg_catalog.octet_length(pg_catalog.convert_to(definition, 'UTF8')), definition
          ), E'\n' ORDER BY object_name, relation_name, definition), ''),
          'UTF8'
        )), 'hex') AS value
      FROM index_inventory
    ),
    constraint_inventory AS (
      SELECT
        constraint_row.conname::text AS object_name,
        constraint_row.contype::text AS object_type,
        COALESCE(class.relname::text, '') AS relation_name,
        pg_catalog.pg_get_constraintdef(constraint_row.oid, false) AS definition
      FROM pg_catalog.pg_constraint AS constraint_row
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = constraint_row.connamespace
      LEFT JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
      WHERE namespace.nspname = 'lor_studio'
    ),
    constraint_fingerprint AS (
      SELECT
        pg_catalog.count(*) AS object_count,
        pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
          COALESCE(pg_catalog.string_agg(pg_catalog.format(
            '%s:%s|%s:%s|%s:%s|%s:%s',
            pg_catalog.octet_length(pg_catalog.convert_to(object_name, 'UTF8')), object_name,
            pg_catalog.octet_length(pg_catalog.convert_to(object_type, 'UTF8')), object_type,
            pg_catalog.octet_length(pg_catalog.convert_to(relation_name, 'UTF8')), relation_name,
            pg_catalog.octet_length(pg_catalog.convert_to(definition, 'UTF8')), definition
          ), E'\n' ORDER BY object_name, object_type, relation_name, definition), ''),
          'UTF8'
        )), 'hex') AS value
      FROM constraint_inventory
    ),
    dependency_targets AS (
      SELECT
        'class:' || class.relname AS target_name,
        'pg_catalog.pg_class'::pg_catalog.regclass::oid AS catalog_id,
        class.oid AS object_id
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relname = 'faculty_invitation_command_receipts'
      UNION ALL
      SELECT
        'function:' || procedure.proname || '(' ||
          pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')',
        'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
        procedure.oid
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'lor_studio'
        AND procedure.proname IN (
          'commit_faculty_invitation_delivery',
          'enforce_recommendation_case_update',
          'faculty_context_allows',
          'issue_faculty_invitation',
          'resend_faculty_invitation_otp',
          'resolve_lor_actor_case_access',
          'revoke_faculty_invitation',
          'verify_faculty_invitation'
        )
      UNION ALL
      SELECT
        'constraint:' || class.relname || '.' || constraint_row.conname,
        'pg_catalog.pg_constraint'::pg_catalog.regclass::oid,
        constraint_row.oid
      FROM pg_catalog.pg_constraint AS constraint_row
      JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND (
          class.relname = 'faculty_invitation_command_receipts'
          OR constraint_row.conname IN (
            'recommendation_case_audit_events_event_type_known',
            'faculty_otp_verification_receipts_proof_shape'
          )
        )
      UNION ALL
      SELECT
        'policy:' || class.relname || '.' || policy.polname,
        'pg_catalog.pg_policy'::pg_catalog.regclass::oid,
        policy.oid
      FROM pg_catalog.pg_policy AS policy
      JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND policy.polname IN (
          'consent_receipts_invitation_command_select',
          'faculty_invitation_command_receipts_command_insert',
          'faculty_invitation_command_receipts_command_select',
          'faculty_invitations_invitation_command_insert',
          'faculty_invitations_invitation_command_select',
          'faculty_invitations_invitation_command_update',
          'faculty_otp_challenge_revocations_invitation_command_insert',
          'faculty_otp_challenge_revocations_invitation_command_select',
          'faculty_otp_challenges_invitation_command_insert',
          'faculty_otp_challenges_invitation_command_select',
          'faculty_otp_proof_revocations_actor_access_select',
          'faculty_otp_verification_receipts_invitation_command_insert',
          'faculty_otp_verification_receipts_invitation_command_select',
          'mentor_case_assignment_revocations_actor_access_select',
          'mentor_case_assignments_actor_access_select',
          'protected_revision_states_invitation_command_insert',
          'protected_revision_states_invitation_command_select',
          'recommendation_case_audit_events_invitation_command_insert',
          'recommendation_case_audit_events_invitation_command_select',
          'recommendation_cases_invitation_command_select',
          'recommendation_cases_invitation_command_update',
          'student_auth_binding_revocations_actor_access_select',
          'student_auth_bindings_actor_access_select'
        )
    ),
    dependency_groups AS (
      SELECT
        target.target_name,
        dependency.classid::pg_catalog.regclass::text AS object_catalog,
        dependency.refclassid::pg_catalog.regclass::text AS referenced_catalog,
        dependency.deptype,
        dependency.objsubid,
        dependency.refobjsubid,
        pg_catalog.count(*) AS edge_count
      FROM dependency_targets AS target
      JOIN pg_catalog.pg_depend AS dependency ON (
        dependency.classid = target.catalog_id AND dependency.objid = target.object_id
      ) OR (
        dependency.refclassid = target.catalog_id AND dependency.refobjid = target.object_id
      )
      WHERE NOT (
        dependency.classid = 'pg_catalog.pg_constraint'::pg_catalog.regclass::oid
        AND EXISTS (
          SELECT 1 FROM pg_catalog.pg_constraint AS implicit_constraint
          WHERE implicit_constraint.oid = dependency.objid
            AND implicit_constraint.contype = 'n'
        )
      )
        AND NOT (
          dependency.refclassid = 'pg_catalog.pg_constraint'::pg_catalog.regclass::oid
          AND EXISTS (
            SELECT 1 FROM pg_catalog.pg_constraint AS implicit_constraint
            WHERE implicit_constraint.oid = dependency.refobjid
              AND implicit_constraint.contype = 'n'
          )
        )
      GROUP BY target.target_name, dependency.classid, dependency.refclassid,
        dependency.deptype, dependency.objsubid, dependency.refobjsubid
    ),
    dependency_fingerprint AS (
      SELECT lor_studio.canonical_jsonb_sha256(COALESCE(
        pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'target', target_name,
          'objectCatalog', object_catalog,
          'referencedCatalog', referenced_catalog,
          'dependencyType', deptype,
          'objectSubId', objsubid,
          'referencedSubId', refobjsubid,
          'edgeCount', edge_count
        ) ORDER BY target_name, object_catalog, referenced_catalog, deptype,
          objsubid, refobjsubid),
        '[]'::jsonb
      )) AS value
      FROM dependency_groups
    )
    SELECT
      (SELECT value FROM catalog_fingerprint) AS catalog_fingerprint,
      (SELECT object_count::text FROM index_fingerprint) AS index_count,
      (SELECT value FROM index_fingerprint) AS index_fingerprint,
      (SELECT object_count::text FROM constraint_fingerprint) AS constraint_count,
      (SELECT value FROM constraint_fingerprint) AS constraint_fingerprint,
      (SELECT value FROM dependency_fingerprint) AS dependency_fingerprint
  ) AS fingerprint;

  -- Exact touched-object custody supplements the cumulative catalog guard with
  -- full catalog rows, TOAST/index state, type ACLs, rules, inheritance,
  -- direct publication/statistics membership, and named dependency edges.
  SELECT exact.exact_custody_fingerprint
  INTO STRICT exact_custody_fingerprint
  FROM (
    WITH target_relations AS (
      SELECT class.oid, class.relname, class.reltoastrelid, class.reltype
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relname = ANY (ARRAY[
          'faculty_invitation_command_receipts',
          'faculty_invitations',
          'faculty_otp_challenge_revocations',
          'faculty_otp_challenges',
          'faculty_otp_proof_revocations',
          'faculty_otp_verification_receipts',
          'mentor_case_assignment_revocations',
          'mentor_case_assignments',
          'recommendation_case_audit_events',
          'recommendation_case_protected_revision_states',
          'recommendation_cases',
          'student_auth_binding_revocations',
          'student_auth_bindings'
        ]::text[])
        AND class.relkind IN ('r', 'p')
    ),
    target_toast AS (
      SELECT relation.relname AS base_relation, toast.*
      FROM target_relations AS relation
      JOIN pg_catalog.pg_class AS toast ON toast.oid = relation.reltoastrelid
    ),
    index_relations AS (
      SELECT relation.oid, relation.relname AS relation_key
      FROM target_relations AS relation
      UNION ALL
      SELECT toast.oid, 'toast:' || toast.base_relation
      FROM target_toast AS toast
    ),
    target_indexes AS (
      SELECT index_row AS index_catalog, index_class AS class_catalog,
        index_row.indexrelid, index_row.indrelid, index_row.indexprs,
        index_row.indpred, index_class.relname, index_class.relowner,
        relation.relation_key, access_method.amname AS access_method_name,
        tablespace.spcname AS tablespace_name
      FROM index_relations AS relation
      JOIN pg_catalog.pg_index AS index_row ON index_row.indrelid = relation.oid
      JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index_row.indexrelid
      LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = index_class.relam
      LEFT JOIN pg_catalog.pg_tablespace AS tablespace
        ON tablespace.oid = index_class.reltablespace
    ),
    target_functions AS (
      SELECT procedure.oid, procedure.proname
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'lor_studio'
        AND procedure.proname || '(' ||
          pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')' = ANY (ARRAY[
            'commit_faculty_invitation_delivery(text,text,text,text,text)',
            'enforce_recommendation_case_update()',
            'faculty_context_allows(text,text,text[])',
            'issue_faculty_invitation(text,bigint,text,text,text,text,text,timestamp with time zone,timestamp with time zone,integer,bigint,bigint,text,text)',
            'resend_faculty_invitation_otp(text,text,text,text,timestamp with time zone,text,text)',
            'resolve_lor_actor_case_access(text,text)',
            'revoke_faculty_invitation(text,text,text)',
            'verify_faculty_invitation(text,text,text,text,text,text)'
          ]::text[])
    ),
    target_policies AS (
      SELECT policy.oid, policy.polname, policy.polrelid, class.relname
      FROM pg_catalog.pg_policy AS policy
      JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND policy.polname = ANY (ARRAY[
          'consent_receipts_invitation_command_select',
          'faculty_invitation_command_receipts_command_insert',
          'faculty_invitation_command_receipts_command_select',
          'faculty_invitations_invitation_command_insert',
          'faculty_invitations_invitation_command_select',
          'faculty_invitations_invitation_command_update',
          'faculty_otp_challenge_revocations_invitation_command_insert',
          'faculty_otp_challenge_revocations_invitation_command_select',
          'faculty_otp_challenges_invitation_command_insert',
          'faculty_otp_challenges_invitation_command_select',
          'faculty_otp_proof_revocations_actor_access_select',
          'faculty_otp_verification_receipts_invitation_command_insert',
          'faculty_otp_verification_receipts_invitation_command_select',
          'mentor_case_assignment_revocations_actor_access_select',
          'mentor_case_assignments_actor_access_select',
          'protected_revision_states_invitation_command_insert',
          'protected_revision_states_invitation_command_select',
          'recommendation_case_audit_events_invitation_command_insert',
          'recommendation_case_audit_events_invitation_command_select',
          'recommendation_cases_invitation_command_select',
          'recommendation_cases_invitation_command_update',
          'student_auth_binding_revocations_actor_access_select',
          'student_auth_bindings_actor_access_select'
        ]::text[])
    ),
    target_types AS (
      SELECT type.*
      FROM pg_catalog.pg_type AS type
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = type.typnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND (
          type.typrelid IN (SELECT relation.oid FROM target_relations AS relation)
          OR type.typelem IN (SELECT relation.reltype FROM target_relations AS relation)
        )
    ),
    object_targets AS (
      SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::oid AS class_id,
        relation.oid AS object_id, 0::integer AS object_sub_id,
        'relation:' || relation.relname AS target_name
      FROM target_relations AS relation
      UNION ALL
      SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::oid,
        relation.oid, attribute.attnum,
        'column:' || relation.relname || '.' || attribute.attname
      FROM target_relations AS relation
      JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = relation.oid
      WHERE attribute.attnum > 0 AND NOT attribute.attisdropped
      UNION ALL
      SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::oid,
        toast.oid, 0, 'toast:' || toast.base_relation
      FROM target_toast AS toast
      UNION ALL
      SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::oid,
        index_row.indexrelid, 0,
        'index:' || index_row.relation_key || ':' || pg_catalog.regexp_replace(
          index_row.relname, '^pg_toast_[0-9]+', 'pg_toast_*'
        )
      FROM target_indexes AS index_row
      UNION ALL
      SELECT 'pg_catalog.pg_constraint'::pg_catalog.regclass::oid,
        constraint_row.oid, 0,
        'constraint:' || relation.relname || ':' || constraint_row.conname
      FROM target_relations AS relation
      JOIN pg_catalog.pg_constraint AS constraint_row ON constraint_row.conrelid = relation.oid
      UNION ALL
      SELECT 'pg_catalog.pg_trigger'::pg_catalog.regclass::oid,
        trigger_row.oid, 0,
        'trigger:' || relation.relname || ':' || pg_catalog.regexp_replace(
          trigger_row.tgname, '^RI_ConstraintTrigger_[a-z]_[0-9]+$',
          'RI_ConstraintTrigger_*'
        )
      FROM target_relations AS relation
      JOIN pg_catalog.pg_trigger AS trigger_row ON trigger_row.tgrelid = relation.oid
      UNION ALL
      SELECT 'pg_catalog.pg_policy'::pg_catalog.regclass::oid,
        policy.oid, 0, 'policy:' || policy.relname || ':' || policy.polname
      FROM target_policies AS policy
      UNION ALL
      SELECT 'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
        procedure.oid, 0, 'function:' || procedure.proname || '(' ||
          pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')'
      FROM target_functions AS procedure
      UNION ALL
      SELECT 'pg_catalog.pg_type'::pg_catalog.regclass::oid,
        type.oid, 0, 'type:' || type.typname
      FROM target_types AS type
      UNION ALL
      SELECT 'pg_catalog.pg_rewrite'::pg_catalog.regclass::oid,
        rule.oid, 0, 'rule:' || relation.relname || ':' || rule.rulename
      FROM target_relations AS relation
      JOIN pg_catalog.pg_rewrite AS rule ON rule.ev_class = relation.oid
      UNION ALL
      SELECT 'pg_catalog.pg_statistic_ext'::pg_catalog.regclass::oid,
        statistics.oid, 0,
        'statistics:' || relation.relname || ':' || statistics.stxname
      FROM target_relations AS relation
      JOIN pg_catalog.pg_statistic_ext AS statistics ON statistics.stxrelid = relation.oid
    ),
    snapshot AS (
      SELECT pg_catalog.jsonb_build_object(
        'relations', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'relation', relation.relname,
              'catalog', (
                pg_catalog.to_jsonb(class) - ARRAY[
                  'oid', 'relnamespace', 'reltype', 'reloftype', 'relowner', 'relam',
                  'relfilenode', 'reltablespace', 'relpages', 'reltuples',
                  'relallvisible', 'reltoastrelid', 'relfrozenxid', 'relminmxid',
                  'relacl', 'relrewrite', 'relpartbound'
                ]::text[]
              ) || pg_catalog.jsonb_build_object(
                'owner', CASE pg_catalog.pg_get_userbyid(class.relowner)
                  WHEN current_user THEN 'MIGRATION_ADMIN'
                  ELSE pg_catalog.pg_get_userbyid(class.relowner)
                END,
                'accessMethod', access_method.amname,
                'tablespace', COALESCE(tablespace.spcname, 'DATABASE_DEFAULT'),
                'partitionBound', pg_catalog.pg_get_expr(class.relpartbound, class.oid, true)
              )
            ) ORDER BY relation.relname
          )
          FROM target_relations AS relation
          JOIN pg_catalog.pg_class AS class ON class.oid = relation.oid
          LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = class.relam
          LEFT JOIN pg_catalog.pg_tablespace AS tablespace
            ON tablespace.oid = class.reltablespace
        ), '[]'::jsonb),
        'toast', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'baseRelation', toast.base_relation,
              'catalog', (
                pg_catalog.to_jsonb(toast) - ARRAY[
                  'oid', 'relname', 'relnamespace', 'reltype', 'reloftype', 'relowner',
                  'relam', 'relfilenode', 'reltablespace', 'relpages', 'reltuples',
                  'relallvisible', 'reltoastrelid', 'relfrozenxid', 'relminmxid',
                  'relacl', 'relrewrite', 'relpartbound'
                ]::text[]
              ) || pg_catalog.jsonb_build_object(
                'owner', CASE pg_catalog.pg_get_userbyid(toast.relowner)
                  WHEN current_user THEN 'MIGRATION_ADMIN'
                  ELSE pg_catalog.pg_get_userbyid(toast.relowner)
                END,
                'accessMethod', access_method.amname,
                'tablespace', COALESCE(tablespace.spcname, 'DATABASE_DEFAULT')
              )
            ) ORDER BY toast.base_relation
          )
          FROM target_toast AS toast
          LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = toast.relam
          LEFT JOIN pg_catalog.pg_tablespace AS tablespace
            ON tablespace.oid = toast.reltablespace
        ), '[]'::jsonb),
        'columns', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'relation', relation.relname,
              'catalog', (
                pg_catalog.to_jsonb(attribute) - ARRAY[
                  'attrelid', 'atttypid', 'attcollation', 'attacl', 'attmissingval'
                ]::text[]
              ) || pg_catalog.jsonb_build_object(
                'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                'collation', CASE WHEN attribute.attcollation = 0 THEN NULL ELSE
                  pg_catalog.format('%I.%I', collation_namespace.nspname,
                    collation_row.collname) END,
                'default', pg_catalog.pg_get_expr(default_value.adbin,
                  default_value.adrelid, true),
                'missingValue', pg_catalog.to_jsonb(attribute.attmissingval)
              )
            ) ORDER BY relation.relname, attribute.attnum
          )
          FROM target_relations AS relation
          JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = relation.oid
          LEFT JOIN pg_catalog.pg_attrdef AS default_value
            ON default_value.adrelid = attribute.attrelid
           AND default_value.adnum = attribute.attnum
          LEFT JOIN pg_catalog.pg_collation AS collation_row
            ON collation_row.oid = attribute.attcollation
          LEFT JOIN pg_catalog.pg_namespace AS collation_namespace
            ON collation_namespace.oid = collation_row.collnamespace
          WHERE attribute.attnum > 0 AND NOT attribute.attisdropped
        ), '[]'::jsonb),
        'constraints', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'relation', relation.relname,
              'catalog', (
                pg_catalog.to_jsonb(constraint_row) - ARRAY[
                  'oid', 'connamespace', 'conrelid', 'contypid', 'conindid',
                  'conparentid', 'confrelid', 'conpfeqop', 'conppeqop', 'conffeqop',
                  'conexclop', 'conbin'
                ]::text[]
              ) || pg_catalog.jsonb_build_object(
                'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true),
                'referencedRelation', referenced_class.relname,
                'backingIndex', index_class.relname,
                'parentConstraint', parent_constraint.conname
              )
            ) ORDER BY relation.relname, constraint_row.conname,
              constraint_row.contype
          )
          FROM target_relations AS relation
          JOIN pg_catalog.pg_constraint AS constraint_row
            ON constraint_row.conrelid = relation.oid
          LEFT JOIN pg_catalog.pg_class AS referenced_class
            ON referenced_class.oid = constraint_row.confrelid
          LEFT JOIN pg_catalog.pg_class AS index_class
            ON index_class.oid = constraint_row.conindid
          LEFT JOIN pg_catalog.pg_constraint AS parent_constraint
            ON parent_constraint.oid = constraint_row.conparentid
        ), '[]'::jsonb),
        'indexes', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'relation', target.relation_key,
              'name', pg_catalog.regexp_replace(target.relname,
                '^pg_toast_[0-9]+', 'pg_toast_*'),
              'index', (
                pg_catalog.to_jsonb(target.index_catalog) - ARRAY[
                  'indexrelid', 'indrelid', 'indcollation', 'indclass',
                  'indexprs', 'indpred'
                ]::text[]
              ) || pg_catalog.jsonb_build_object(
                'expression', pg_catalog.pg_get_expr(target.indexprs,
                  target.indrelid, true),
                'predicate', pg_catalog.pg_get_expr(target.indpred,
                  target.indrelid, true)
              ),
              'class', (
                pg_catalog.to_jsonb(target.class_catalog) - ARRAY[
                  'oid', 'relname', 'relnamespace', 'reltype', 'reloftype',
                  'relowner', 'relam', 'relfilenode', 'reltablespace', 'relpages',
                  'reltuples', 'relallvisible', 'reltoastrelid', 'relfrozenxid',
                  'relminmxid', 'relacl', 'relrewrite', 'relpartbound'
                ]::text[]
              ) || pg_catalog.jsonb_build_object(
                'owner', CASE pg_catalog.pg_get_userbyid(target.relowner)
                  WHEN current_user THEN 'MIGRATION_ADMIN'
                  ELSE pg_catalog.pg_get_userbyid(target.relowner)
                END,
                'accessMethod', target.access_method_name,
                'tablespace', COALESCE(target.tablespace_name, 'DATABASE_DEFAULT')
              ),
              'definition', pg_catalog.regexp_replace(
                pg_catalog.pg_get_indexdef(target.indexrelid),
                'pg_toast_[0-9]+', 'pg_toast_*', 'g'
              )
            ) ORDER BY target.relation_key,
              pg_catalog.regexp_replace(target.relname, '^pg_toast_[0-9]+', 'pg_toast_*')
          )
          FROM target_indexes AS target
        ), '[]'::jsonb),
        'triggers', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'relation', relation.relname,
              'catalog', (
                pg_catalog.to_jsonb(trigger_row) - ARRAY[
                  'oid', 'tgname', 'tgrelid', 'tgparentid', 'tgfoid', 'tgconstraint',
                  'tgconstrrelid', 'tgconstrindid', 'tgqual'
                ]::text[]
              ) || pg_catalog.jsonb_build_object(
                'name', pg_catalog.regexp_replace(trigger_row.tgname,
                  '^RI_ConstraintTrigger_[a-z]_[0-9]+$', 'RI_ConstraintTrigger_*'),
                'function', pg_catalog.format('%I.%I(%s)',
                  function_namespace.nspname, function_row.proname,
                  pg_catalog.pg_get_function_identity_arguments(function_row.oid)),
                'constraint', constraint_row.conname,
                'constraintRelation', constraint_relation.relname,
                'constraintIndex', CASE WHEN constraint_index.oid IS NULL THEN NULL ELSE
                  pg_catalog.format('%I.%I', constraint_index_namespace.nspname,
                    constraint_index.relname) END,
                'qualifier', pg_catalog.pg_get_expr(trigger_row.tgqual,
                  trigger_row.tgrelid, true),
                'definition', pg_catalog.regexp_replace(
                  pg_catalog.pg_get_triggerdef(trigger_row.oid, true),
                  'RI_ConstraintTrigger_[a-z]_[0-9]+',
                  'RI_ConstraintTrigger_*', 'g'
                )
              )
            ) ORDER BY relation.relname, trigger_row.tgisinternal,
              constraint_row.conname, function_namespace.nspname,
              function_row.proname, trigger_row.tgtype,
              pg_catalog.regexp_replace(trigger_row.tgname,
                '^RI_ConstraintTrigger_[a-z]_[0-9]+$', 'RI_ConstraintTrigger_*')
          )
          FROM target_relations AS relation
          JOIN pg_catalog.pg_trigger AS trigger_row ON trigger_row.tgrelid = relation.oid
          JOIN pg_catalog.pg_proc AS function_row ON function_row.oid = trigger_row.tgfoid
          JOIN pg_catalog.pg_namespace AS function_namespace
            ON function_namespace.oid = function_row.pronamespace
          LEFT JOIN pg_catalog.pg_constraint AS constraint_row
            ON constraint_row.oid = trigger_row.tgconstraint
          LEFT JOIN pg_catalog.pg_class AS constraint_relation
            ON constraint_relation.oid = trigger_row.tgconstrrelid
          LEFT JOIN pg_catalog.pg_class AS constraint_index
            ON constraint_index.oid = trigger_row.tgconstrindid
          LEFT JOIN pg_catalog.pg_namespace AS constraint_index_namespace
            ON constraint_index_namespace.oid = constraint_index.relnamespace
        ), '[]'::jsonb),
        'types', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'name', type.typname,
              'catalog', (
                pg_catalog.to_jsonb(type) - ARRAY[
                  'oid', 'typnamespace', 'typowner', 'typrelid', 'typelem',
                  'typarray', 'typbasetype', 'typcollation', 'typacl'
                ]::text[]
              ) || pg_catalog.jsonb_build_object(
                'owner', CASE pg_catalog.pg_get_userbyid(type.typowner)
                  WHEN current_user THEN 'MIGRATION_ADMIN'
                  ELSE pg_catalog.pg_get_userbyid(type.typowner)
                END,
                'relation', relation.relname,
                'elementType', CASE WHEN type.typelem = 0 THEN NULL ELSE
                  pg_catalog.format_type(type.typelem, NULL) END,
                'arrayType', CASE WHEN type.typarray = 0 THEN NULL ELSE
                  pg_catalog.format_type(type.typarray, NULL) END,
                'baseType', CASE WHEN type.typbasetype = 0 THEN NULL ELSE
                  pg_catalog.format_type(type.typbasetype, type.typtypmod) END,
                'collation', CASE WHEN type.typcollation = 0 THEN NULL ELSE
                  pg_catalog.format('%I.%I', collation_namespace.nspname,
                    collation_row.collname) END
              )
            ) ORDER BY type.typname
          )
          FROM target_types AS type
          LEFT JOIN target_relations AS relation ON relation.oid = type.typrelid
          LEFT JOIN pg_catalog.pg_collation AS collation_row
            ON collation_row.oid = type.typcollation
          LEFT JOIN pg_catalog.pg_namespace AS collation_namespace
            ON collation_namespace.oid = collation_row.collnamespace
        ), '[]'::jsonb),
        'typeAcl', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'type', type.typname,
              'grantor', CASE grantor.rolname WHEN current_user THEN 'MIGRATION_ADMIN'
                ELSE grantor.rolname END,
              'grantee', CASE COALESCE(grantee.rolname, 'PUBLIC')
                WHEN current_user THEN 'MIGRATION_ADMIN'
                ELSE COALESCE(grantee.rolname, 'PUBLIC') END,
              'privilege', acl.privilege_type,
              'grantable', acl.is_grantable
            ) ORDER BY type.typname, COALESCE(grantee.rolname, 'PUBLIC'),
              acl.privilege_type, acl.is_grantable
          )
          FROM target_types AS type
          CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(
            type.typacl, pg_catalog.acldefault('T', type.typowner)
          )) AS acl
          LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = acl.grantor
          LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
        ), '[]'::jsonb),
        'rules', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'relation', relation.relname,
              'catalog', pg_catalog.to_jsonb(rule) - ARRAY[
                'oid', 'ev_class', 'ev_action', 'ev_qual'
              ]::text[],
              'definition', pg_catalog.pg_get_ruledef(rule.oid, true)
            ) ORDER BY relation.relname, rule.rulename
          )
          FROM target_relations AS relation
          JOIN pg_catalog.pg_rewrite AS rule ON rule.ev_class = relation.oid
        ), '[]'::jsonb),
        'inheritance', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'child', child_namespace.nspname || '.' || child.relname,
              'parent', parent_namespace.nspname || '.' || parent.relname,
              'catalog', pg_catalog.to_jsonb(inheritance) - ARRAY[
                'inhrelid', 'inhparent'
              ]::text[]
            ) ORDER BY child_namespace.nspname, child.relname,
              parent_namespace.nspname, parent.relname
          )
          FROM pg_catalog.pg_inherits AS inheritance
          JOIN pg_catalog.pg_class AS child ON child.oid = inheritance.inhrelid
          JOIN pg_catalog.pg_namespace AS child_namespace
            ON child_namespace.oid = child.relnamespace
          JOIN pg_catalog.pg_class AS parent ON parent.oid = inheritance.inhparent
          JOIN pg_catalog.pg_namespace AS parent_namespace
            ON parent_namespace.oid = parent.relnamespace
          WHERE inheritance.inhrelid IN (SELECT relation.oid FROM target_relations AS relation)
             OR inheritance.inhparent IN (SELECT relation.oid FROM target_relations AS relation)
        ), '[]'::jsonb),
        'publications', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'publication', publication.pubname,
              'relation', relation.relname,
              'catalog', pg_catalog.to_jsonb(publication_relation) - ARRAY[
                'oid', 'prpubid', 'prrelid', 'prattrs', 'prqual'
              ]::text[],
              'columns', COALESCE((
                SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY member.ordinality)
                FROM pg_catalog.unnest(publication_relation.prattrs::smallint[])
                  WITH ORDINALITY AS member(attnum, ordinality)
                JOIN pg_catalog.pg_attribute AS attribute
                  ON attribute.attrelid = publication_relation.prrelid
                 AND attribute.attnum = member.attnum
              ), '[]'::jsonb),
              'qualifier', pg_catalog.pg_get_expr(publication_relation.prqual,
                publication_relation.prrelid, true)
            ) ORDER BY publication.pubname, relation.relname
          )
          FROM target_relations AS relation
          JOIN pg_catalog.pg_publication_rel AS publication_relation
            ON publication_relation.prrelid = relation.oid
          JOIN pg_catalog.pg_publication AS publication
            ON publication.oid = publication_relation.prpubid
        ), '[]'::jsonb),
        'statistics', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'relation', relation.relname,
              'catalog', (
                pg_catalog.to_jsonb(statistics) - ARRAY[
                  'oid', 'stxrelid', 'stxnamespace', 'stxowner', 'stxkeys', 'stxexprs'
                ]::text[]
              ) || pg_catalog.jsonb_build_object(
                'owner', CASE pg_catalog.pg_get_userbyid(statistics.stxowner)
                  WHEN current_user THEN 'MIGRATION_ADMIN'
                  ELSE pg_catalog.pg_get_userbyid(statistics.stxowner)
                END,
                'definition', pg_catalog.pg_get_statisticsobjdef(statistics.oid)
              )
            ) ORDER BY relation.relname, statistics.stxname
          )
          FROM target_relations AS relation
          JOIN pg_catalog.pg_statistic_ext AS statistics
            ON statistics.stxrelid = relation.oid
        ), '[]'::jsonb),
        'dependencies', COALESCE((
          SELECT pg_catalog.jsonb_agg(dependency_row.value ORDER BY dependency_row.sort_key)
          FROM (
            SELECT DISTINCT
              target.target_name || ':' || dependency.deptype::text || ':' ||
                pg_catalog.regexp_replace(pg_catalog.regexp_replace(
                  pg_catalog.pg_describe_object(dependency.classid,
                    dependency.objid, dependency.objsubid),
                  'RI_ConstraintTrigger_[a-z]_[0-9]+',
                  'RI_ConstraintTrigger_*', 'g'),
                  'pg_toast_[0-9]+', 'pg_toast_*', 'g') || '->' ||
                pg_catalog.regexp_replace(pg_catalog.regexp_replace(
                  pg_catalog.pg_describe_object(dependency.refclassid,
                    dependency.refobjid, dependency.refobjsubid),
                  'RI_ConstraintTrigger_[a-z]_[0-9]+',
                  'RI_ConstraintTrigger_*', 'g'),
                  'pg_toast_[0-9]+', 'pg_toast_*', 'g') AS sort_key,
              pg_catalog.jsonb_build_object(
                'target', target.target_name,
                'type', dependency.deptype,
                'object', pg_catalog.regexp_replace(pg_catalog.regexp_replace(
                  pg_catalog.pg_describe_object(dependency.classid,
                    dependency.objid, dependency.objsubid),
                  'RI_ConstraintTrigger_[a-z]_[0-9]+',
                  'RI_ConstraintTrigger_*', 'g'),
                  'pg_toast_[0-9]+', 'pg_toast_*', 'g'),
                'referenced', pg_catalog.regexp_replace(pg_catalog.regexp_replace(
                  pg_catalog.pg_describe_object(dependency.refclassid,
                    dependency.refobjid, dependency.refobjsubid),
                  'RI_ConstraintTrigger_[a-z]_[0-9]+',
                  'RI_ConstraintTrigger_*', 'g'),
                  'pg_toast_[0-9]+', 'pg_toast_*', 'g')
              ) AS value
            FROM object_targets AS target
            JOIN pg_catalog.pg_depend AS dependency ON (
              dependency.classid = target.class_id
              AND dependency.objid = target.object_id
              AND dependency.objsubid = target.object_sub_id
            ) OR (
              dependency.refclassid = target.class_id
              AND dependency.refobjid = target.object_id
              AND dependency.refobjsubid = target.object_sub_id
            )
          ) AS dependency_row
        ), '[]'::jsonb)
      ) AS value
    )
    SELECT lor_studio.canonical_jsonb_sha256(snapshot.value)
      AS exact_custody_fingerprint
    FROM snapshot
  ) AS exact;

  SELECT pg_catalog.count(*) INTO relation_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r';
  SELECT pg_catalog.count(*) INTO forced_rls_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind = 'r' AND class.relrowsecurity AND class.relforcerowsecurity;
  SELECT pg_catalog.count(*) INTO definer_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner';
  SELECT pg_catalog.count(*) INTO function_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio';
  SELECT pg_catalog.count(*) INTO policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio';
  SELECT pg_catalog.count(*) INTO trigger_count
  FROM pg_catalog.pg_trigger AS trigger
  JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND NOT trigger.tgisinternal;
  SELECT pg_catalog.count(*) INTO index_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'i';
  SELECT pg_catalog.count(*) INTO constraint_count
  FROM pg_catalog.pg_constraint AS constraint_record
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = constraint_record.connamespace
  WHERE namespace.nspname = 'lor_studio';
  SELECT pg_catalog.array_agg(identity ORDER BY identity)
  INTO observed_definers
  FROM (
    SELECT procedure.proname || '(' || pg_catalog.replace(
      pg_catalog.oidvectortypes(procedure.proargtypes), ', ', ','
    ) || ')' AS identity
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'lor_studio'
      AND procedure.prosecdef
      AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner'
  ) AS definer_inventory;
  WITH acl_entries AS (
    SELECT namespace.nspowner AS owner_oid, acl.grantee
    FROM pg_catalog.pg_namespace AS namespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
    ) AS acl
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT class.relowner, acl.grantee
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))
    ) AS acl
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT procedure.proowner, acl.grantee
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
    ) AS acl
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT class.relowner, acl.grantee
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
    WHERE namespace.nspname = 'lor_studio'
      AND attribute.attnum > 0
      AND attribute.attacl IS NOT NULL
  )
  SELECT pg_catalog.count(*) INTO nonowner_acl_count
  FROM acl_entries
  WHERE grantee <> owner_oid;
  SELECT pg_catalog.count(*) INTO invitation_policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND policy.polname = ANY (ARRAY[
      'consent_receipts_invitation_command_select',
      'recommendation_cases_invitation_command_select',
      'recommendation_cases_invitation_command_update',
      'protected_revision_states_invitation_command_select',
      'protected_revision_states_invitation_command_insert',
      'recommendation_case_audit_events_invitation_command_select',
      'recommendation_case_audit_events_invitation_command_insert',
      'faculty_invitations_invitation_command_select',
      'faculty_invitations_invitation_command_insert',
      'faculty_invitations_invitation_command_update',
      'faculty_otp_challenges_invitation_command_select',
      'faculty_otp_challenges_invitation_command_insert',
      'faculty_otp_challenge_revocations_invitation_command_select',
      'faculty_otp_challenge_revocations_invitation_command_insert',
      'faculty_otp_verification_receipts_invitation_command_select',
      'faculty_otp_verification_receipts_invitation_command_insert',
      'faculty_otp_proof_revocations_actor_access_select',
      'faculty_invitation_command_receipts_command_select',
      'faculty_invitation_command_receipts_command_insert',
      'student_auth_bindings_actor_access_select',
      'student_auth_binding_revocations_actor_access_select',
      'mentor_case_assignments_actor_access_select',
      'mentor_case_assignment_revocations_actor_access_select'
    ]::text[]);
  SELECT procedure.prosrc INTO faculty_context_source
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.oid = 'lor_studio.faculty_context_allows(text,text,text[])'::pg_catalog.regprocedure;

  IF expected_catalog_fingerprint IS NULL
    OR expected_constraint_fingerprint IS NULL
    OR expected_exact_custody_fingerprint IS NULL
    OR catalog_fingerprint IS DISTINCT FROM expected_catalog_fingerprint
    OR exact_custody_fingerprint IS DISTINCT FROM expected_exact_custody_fingerprint
    OR observed_index_fingerprint IS DISTINCT FROM expected_index_fingerprint
    OR observed_constraint_fingerprint IS DISTINCT FROM expected_constraint_fingerprint
    OR dependency_fingerprint IS DISTINCT FROM expected_dependency_fingerprint
    OR relation_count IS DISTINCT FROM 29
    OR forced_rls_count IS DISTINCT FROM 29
    OR function_count IS DISTINCT FROM 57
    OR definer_count IS DISTINCT FROM 18
    OR observed_definers IS DISTINCT FROM expected_definers
    OR policy_count IS DISTINCT FROM 123
    OR trigger_count IS DISTINCT FROM 47
    OR index_count IS DISTINCT FROM 120
    OR constraint_count IS DISTINCT FROM (CASE postgres_major
      WHEN 16 THEN 320::bigint
      WHEN 18 THEN 642::bigint
      ELSE NULL::bigint
    END)
    OR nonowner_acl_count IS DISTINCT FROM 107
    OR invitation_policy_count IS DISTINCT FROM 23
    OR faculty_context_source IS NULL
    OR faculty_context_source LIKE '%invitation.expires_at > pg_catalog.statement_timestamp()%'
    OR faculty_context_source LIKE '%verification.otp_expires_at > pg_catalog.statement_timestamp()%'
    OR faculty_context_source NOT LIKE '%proof_revocation.case_id = verification.case_id%'
    OR EXISTS (SELECT 1 FROM lor_studio.faculty_invitation_command_receipts)
    OR EXISTS (
      SELECT 1
      FROM lor_studio.recommendation_case_audit_events AS audit_event
      WHERE audit_event.event_type IN (
        'faculty.invitation_delivered',
        'faculty.invitation_delivery_pending',
        'faculty.invitation_delivery_unknown',
        'faculty.invitation_otp_resent',
        'faculty.invitation_revoked'
      )
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger AS trigger
      JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relname = 'faculty_invitation_command_receipts'
        AND trigger.tgname = 'faculty_invitation_command_receipts_append_only'
        AND NOT trigger.tgisinternal
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
      ) AS acl
      WHERE namespace.nspname = 'lor_studio'
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'DR-133 invitation command rollback catalog or emptiness guard mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_guard$;

-- Literal reverse operations follow. This marker is consumed by static custody tests.
REVOKE EXECUTE ON FUNCTION lor_studio.issue_faculty_invitation(
  text, bigint, text, text, text, text, text, timestamptz, timestamptz,
  integer, bigint, bigint, text, text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.resend_faculty_invitation_otp(
  text, text, text, text, timestamptz, text, text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.revoke_faculty_invitation(
  text, text, text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.verify_faculty_invitation(
  text, text, text, text, text, text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.commit_faculty_invitation_delivery(
  text, text, text, text, text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.resolve_lor_actor_case_access(text, text)
FROM lor_studio_app;

ALTER FUNCTION lor_studio.issue_faculty_invitation(
  text, bigint, text, text, text, text, text, timestamptz, timestamptz,
  integer, bigint, bigint, text, text
) OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.resend_faculty_invitation_otp(
  text, text, text, text, timestamptz, text, text
) OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.revoke_faculty_invitation(text, text, text)
OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.verify_faculty_invitation(
  text, text, text, text, text, text
) OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.commit_faculty_invitation_delivery(
  text, text, text, text, text
) OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.resolve_lor_actor_case_access(text, text)
OWNER TO CURRENT_USER;

DROP FUNCTION lor_studio.issue_faculty_invitation(
  text, bigint, text, text, text, text, text, timestamptz, timestamptz,
  integer, bigint, bigint, text, text
);
DROP FUNCTION lor_studio.resend_faculty_invitation_otp(
  text, text, text, text, timestamptz, text, text
);
DROP FUNCTION lor_studio.revoke_faculty_invitation(text, text, text);
DROP FUNCTION lor_studio.verify_faculty_invitation(
  text, text, text, text, text, text
);
DROP FUNCTION lor_studio.commit_faculty_invitation_delivery(
  text, text, text, text, text
);
DROP FUNCTION lor_studio.resolve_lor_actor_case_access(text, text);

DROP POLICY consent_receipts_invitation_command_select
  ON lor_studio.consent_receipts;
DROP POLICY recommendation_cases_invitation_command_select
  ON lor_studio.recommendation_cases;
DROP POLICY recommendation_cases_invitation_command_update
  ON lor_studio.recommendation_cases;
DROP POLICY protected_revision_states_invitation_command_select
  ON lor_studio.recommendation_case_protected_revision_states;
DROP POLICY protected_revision_states_invitation_command_insert
  ON lor_studio.recommendation_case_protected_revision_states;
DROP POLICY recommendation_case_audit_events_invitation_command_select
  ON lor_studio.recommendation_case_audit_events;
DROP POLICY recommendation_case_audit_events_invitation_command_insert
  ON lor_studio.recommendation_case_audit_events;
DROP POLICY faculty_invitations_invitation_command_select
  ON lor_studio.faculty_invitations;
DROP POLICY faculty_invitations_invitation_command_insert
  ON lor_studio.faculty_invitations;
DROP POLICY faculty_invitations_invitation_command_update
  ON lor_studio.faculty_invitations;
DROP POLICY faculty_otp_challenges_invitation_command_select
  ON lor_studio.faculty_otp_challenges;
DROP POLICY faculty_otp_challenges_invitation_command_insert
  ON lor_studio.faculty_otp_challenges;
DROP POLICY faculty_otp_challenge_revocations_invitation_command_select
  ON lor_studio.faculty_otp_challenge_revocations;
DROP POLICY faculty_otp_challenge_revocations_invitation_command_insert
  ON lor_studio.faculty_otp_challenge_revocations;
DROP POLICY faculty_otp_verification_receipts_invitation_command_select
  ON lor_studio.faculty_otp_verification_receipts;
DROP POLICY faculty_otp_verification_receipts_invitation_command_insert
  ON lor_studio.faculty_otp_verification_receipts;
DROP POLICY faculty_otp_proof_revocations_actor_access_select
  ON lor_studio.faculty_otp_proof_revocations;
DROP POLICY faculty_invitation_command_receipts_command_select
  ON lor_studio.faculty_invitation_command_receipts;
DROP POLICY faculty_invitation_command_receipts_command_insert
  ON lor_studio.faculty_invitation_command_receipts;
DROP POLICY student_auth_bindings_actor_access_select
  ON lor_studio.student_auth_bindings;
DROP POLICY student_auth_binding_revocations_actor_access_select
  ON lor_studio.student_auth_binding_revocations;
DROP POLICY mentor_case_assignments_actor_access_select
  ON lor_studio.mentor_case_assignments;
DROP POLICY mentor_case_assignment_revocations_actor_access_select
  ON lor_studio.mentor_case_assignment_revocations;

REVOKE SELECT, INSERT, UPDATE ON TABLE lor_studio.faculty_invitations
FROM lor_studio_command_owner;
GRANT SELECT ON TABLE lor_studio.faculty_invitations
TO lor_studio_command_owner;
REVOKE SELECT, INSERT ON TABLE
  lor_studio.faculty_otp_challenges,
  lor_studio.faculty_otp_challenge_revocations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.faculty_invitation_command_receipts
FROM lor_studio_command_owner;
GRANT SELECT ON TABLE lor_studio.faculty_otp_verification_receipts
TO lor_studio_command_owner;

DROP TRIGGER faculty_invitation_command_receipts_append_only
  ON lor_studio.faculty_invitation_command_receipts;
DROP TABLE lor_studio.faculty_invitation_command_receipts;

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
    AND principal_authority = 'durable_otp_provider_proof'
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
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) = resource_student_subject
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
        AND invitation.expires_at > pg_catalog.statement_timestamp()
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
            AND verification.otp_verified_at <= pg_catalog.statement_timestamp()
            AND verification.otp_expires_at > pg_catalog.statement_timestamp()
            AND NOT EXISTS (
              SELECT 1
              FROM lor_studio.faculty_otp_proof_revocations AS proof_revocation
              WHERE proof_revocation.receipt_id = verification.receipt_id
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
      '\|facultyInvitationCommands=20260826010500$',
      ''
    )
  );
END
$restore_sentinel$;

COMMIT;
