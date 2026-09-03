-- Rollback: 20260825010200_f2_lor_1012_identity_scope_commands.rollback.sql
-- Authority: F2-LOR-1012 / DR-133
-- Reverses: 20260825010200_f2_lor_1012_identity_scope_commands.sql
-- Boundary: exact sentinel-bound disposable PostgreSQL 16/18 harness only
-- Data custody: preserves all relation rows; drops only the successor ABI, policies, and grants

BEGIN;

DO $identity_guard$
DECLARE
  database_suffix text;
  admin_suffix text;
  data_directory text := pg_catalog.current_setting('data_directory');
  socket_directories text := pg_catalog.current_setting('unix_socket_directories');
  harness_root text;
  expected_sentinel text;
  observed_sentinel text;
  database_owner name;
  schema_owner name;
BEGIN
  database_suffix := pg_catalog.substring(
    pg_catalog.current_database(), '^lorh_db_([a-f0-9]{20})$'
  );
  admin_suffix := pg_catalog.substring(current_user, '^lorh_admin_([a-f0-9]{20})$');
  harness_root := pg_catalog.regexp_replace(data_directory, '/d$', '');

  SELECT pg_catalog.pg_get_userbyid(database.datdba)
  INTO database_owner
  FROM pg_catalog.pg_database AS database
  WHERE database.datname = pg_catalog.current_database();

  SELECT
    pg_catalog.pg_get_userbyid(namespace.nspowner),
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO schema_owner, observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';

  expected_sentinel := pg_catalog.format(
    'missionmed.lor.disposable-postgres-harness.v1|database=%s|admin=%s|root=%s|foundation=20260820180700|identityScope=20260825010200',
    pg_catalog.current_database(),
    current_user,
    harness_root
  );

  IF pg_catalog.current_setting('server_version_num')::integer / 10000 NOT IN (16, 18)
    OR database_suffix IS NULL
    OR admin_suffix IS DISTINCT FROM database_suffix
    OR session_user IS DISTINCT FROM current_user
    OR database_owner IS DISTINCT FROM current_user
    OR schema_owner IS DISTINCT FROM current_user
    OR pg_catalog.inet_server_addr() IS NOT NULL
    OR pg_catalog.current_setting('listen_addresses') <> ''
    OR data_directory !~ '^/.+/f2lorpg-[A-Za-z0-9_-]{6,}/d$'
    OR harness_root = data_directory
    OR socket_directories IS DISTINCT FROM harness_root || '/s'
    OR socket_directories LIKE '%,%'
    OR observed_sentinel IS DISTINCT FROM expected_sentinel
  THEN
    RAISE EXCEPTION 'DR-133 identity/scope rollback requires the exact successor sentinel-bound disposable harness identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_proof_revocations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.mentor_case_assignment_revocations,
  lor_studio.mentor_case_assignments,
  lor_studio.student_auth_binding_revocations,
  lor_studio.student_auth_bindings
IN ACCESS EXCLUSIVE MODE;

-- Exact successor custody: names and counts alone are insufficient because a
-- same-name overload or altered policy predicate could otherwise survive while
-- the schema sentinel is restored to the base state.  Normalize only the
-- per-harness migration owner, frame the complete catalog records as jsonb,
-- order with the C collation, and fingerprint definitions, configuration,
-- ownership, ACLs, policy expressions, and every touched relation ACL.
DO $semantic_catalog_guard$
DECLARE
  postgres_major constant integer :=
    pg_catalog.current_setting('server_version_num')::integer / 10000;
  expected_inventory_count constant bigint := 22;
  expected_function_count constant bigint := 51;
  expected_definer_count constant bigint := 12;
  expected_policy_count constant bigint := 100;
  expected_nonowner_relation_acl_count constant bigint := 11;
  expected_column_acl_count constant bigint := 0;
  expected_fingerprint constant text := CASE postgres_major
    WHEN 16 THEN '99b0910c25caa8c6b5e16bdee2fbb6dcef3000a4360880f86e73f3c134fb409c'
    WHEN 18 THEN 'b161095ce9d6529ed1e2ddacb2a86d5b59bff455400f51b927bd569dd7e66705'
    ELSE NULL
  END;
  observed_inventory_count bigint;
  observed_function_count bigint;
  observed_definer_count bigint;
  observed_policy_count bigint;
  observed_nonowner_relation_acl_count bigint;
  observed_column_acl_count bigint;
  observed_fingerprint text;
BEGIN
  WITH successor_inventory AS (
    SELECT
      'function:' || procedure.oid::pg_catalog.regprocedure::text AS sort_key,
      pg_catalog.jsonb_build_object(
        'kind', 'function',
        'identity', procedure.oid::pg_catalog.regprocedure::text,
        'owner', CASE
          WHEN pg_catalog.pg_get_userbyid(procedure.proowner) = current_user
            THEN 'migration_admin'
          ELSE pg_catalog.pg_get_userbyid(procedure.proowner)
        END,
        'functionKind', procedure.prokind,
        'securityDefiner', procedure.prosecdef,
        'leakproof', procedure.proleakproof,
        'strict', procedure.proisstrict,
        'returnsSet', procedure.proretset,
        'volatility', procedure.provolatile,
        'parallel', procedure.proparallel,
        'language', language.lanname,
        'config', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            configuration ORDER BY configuration COLLATE "C"
          )
          FROM pg_catalog.unnest(procedure.proconfig) AS configuration
        ), '[]'::pg_catalog.jsonb),
        'definition', pg_catalog.pg_get_functiondef(procedure.oid),
        'aclIsNull', procedure.proacl IS NULL,
        'acl', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'grantor', CASE
                WHEN acl.grantor = procedure.proowner THEN 'function_owner'
                WHEN pg_catalog.pg_get_userbyid(acl.grantor) = current_user
                  THEN 'migration_admin'
                ELSE pg_catalog.pg_get_userbyid(acl.grantor)
              END,
              'grantee', CASE
                WHEN acl.grantee = 0 THEN 'PUBLIC'
                WHEN acl.grantee = procedure.proowner THEN 'function_owner'
                WHEN pg_catalog.pg_get_userbyid(acl.grantee) = current_user
                  THEN 'migration_admin'
                ELSE pg_catalog.pg_get_userbyid(acl.grantee)
              END,
              'privilege', acl.privilege_type,
              'grantable', acl.is_grantable
            ) ORDER BY
              CASE
                WHEN acl.grantee = 0 THEN 'PUBLIC'
                WHEN acl.grantee = procedure.proowner THEN 'function_owner'
                WHEN pg_catalog.pg_get_userbyid(acl.grantee) = current_user
                  THEN 'migration_admin'
                ELSE pg_catalog.pg_get_userbyid(acl.grantee)
              END COLLATE "C",
              acl.privilege_type COLLATE "C",
              acl.is_grantable
          )
          FROM pg_catalog.aclexplode(COALESCE(
            procedure.proacl,
            pg_catalog.acldefault('f', procedure.proowner)
          )) AS acl
        ), '[]'::pg_catalog.jsonb)
      ) AS entry
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE namespace.nspname = 'lor_studio'
      AND procedure.proname = ANY (ARRAY[
        'identity_bootstrap_context_allows',
        'actor_scope_resolution_context_allows',
        'ensure_student_auth_binding',
        'revoke_student_auth_binding',
        'resolve_faculty_case_scope',
        'resolve_mentor_case_scope'
      ]::text[])

    UNION ALL

    SELECT
      'policy:' || policy.polname || '@' || class.relname,
      pg_catalog.jsonb_build_object(
        'kind', 'policy',
        'name', policy.polname,
        'relation', class.relname,
        'command', policy.polcmd,
        'permissive', policy.polpermissive,
        'roles', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            CASE
              WHEN role_oid = 0 THEN 'PUBLIC'
              ELSE pg_catalog.pg_get_userbyid(role_oid)
            END ORDER BY
              CASE
                WHEN role_oid = 0 THEN 'PUBLIC'
                ELSE pg_catalog.pg_get_userbyid(role_oid)
              END COLLATE "C"
          )
          FROM pg_catalog.unnest(policy.polroles) AS role_oid
        ), '[]'::pg_catalog.jsonb),
        'qualifier', pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, false),
        'check', pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid, false)
      )
    FROM pg_catalog.pg_policy AS policy
    JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND policy.polname = ANY (ARRAY[
        'student_auth_bindings_identity_command_select',
        'student_auth_bindings_identity_command_insert',
        'student_auth_binding_revocations_identity_command_select',
        'student_auth_binding_revocations_identity_command_insert',
        'faculty_invitations_scope_resolution_select',
        'faculty_otp_verification_scope_resolution_select',
        'faculty_otp_revocations_scope_resolution_select',
        'mentor_assignments_scope_resolution_select',
        'mentor_assignment_revocations_scope_resolution_select'
      ]::text[])

    UNION ALL

    SELECT
      'relation:' || class.relname,
      pg_catalog.jsonb_build_object(
        'kind', 'relation',
        'name', class.relname,
        'owner', CASE
          WHEN pg_catalog.pg_get_userbyid(class.relowner) = current_user
            THEN 'migration_admin'
          ELSE pg_catalog.pg_get_userbyid(class.relowner)
        END,
        'relationKind', class.relkind,
        'rowSecurity', class.relrowsecurity,
        'forceRowSecurity', class.relforcerowsecurity,
        'aclIsNull', class.relacl IS NULL,
        'acl', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'grantor', CASE
                WHEN acl.grantor = class.relowner THEN 'relation_owner'
                ELSE pg_catalog.pg_get_userbyid(acl.grantor)
              END,
              'grantee', CASE
                WHEN acl.grantee = 0 THEN 'PUBLIC'
                WHEN acl.grantee = class.relowner THEN 'relation_owner'
                ELSE pg_catalog.pg_get_userbyid(acl.grantee)
              END,
              'privilege', acl.privilege_type,
              'grantable', acl.is_grantable
            ) ORDER BY
              CASE
                WHEN acl.grantee = 0 THEN 'PUBLIC'
                WHEN acl.grantee = class.relowner THEN 'relation_owner'
                ELSE pg_catalog.pg_get_userbyid(acl.grantee)
              END COLLATE "C",
              acl.privilege_type COLLATE "C",
              acl.is_grantable
          )
          FROM pg_catalog.aclexplode(COALESCE(
            class.relacl,
            pg_catalog.acldefault('r', class.relowner)
          )) AS acl
        ), '[]'::pg_catalog.jsonb)
      )
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relname = ANY (ARRAY[
        'faculty_invitations',
        'faculty_otp_proof_revocations',
        'faculty_otp_verification_receipts',
        'mentor_case_assignment_revocations',
        'mentor_case_assignments',
        'student_auth_binding_revocations',
        'student_auth_bindings'
      ]::text[])
  )
  SELECT
    pg_catalog.count(*),
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.string_agg(entry::text, E'\n' ORDER BY sort_key COLLATE "C"),
      'UTF8'
    )), 'hex')
  INTO observed_inventory_count, observed_fingerprint
  FROM successor_inventory;

  SELECT
    pg_catalog.count(*),
    pg_catalog.count(*) FILTER (WHERE procedure.prosecdef)
  INTO observed_function_count, observed_definer_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio';

  SELECT pg_catalog.count(*)
  INTO observed_policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio';

  SELECT pg_catalog.count(*)
  INTO observed_nonowner_relation_acl_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(
    class.relacl,
    pg_catalog.acldefault('r', class.relowner)
  )) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname = ANY (ARRAY[
      'faculty_invitations',
      'faculty_otp_proof_revocations',
      'faculty_otp_verification_receipts',
      'mentor_case_assignment_revocations',
      'mentor_case_assignments',
      'student_auth_binding_revocations',
      'student_auth_bindings'
    ]::text[])
    AND acl.grantee <> class.relowner;

  SELECT pg_catalog.count(*)
  INTO observed_column_acl_count
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname = ANY (ARRAY[
      'faculty_invitations',
      'faculty_otp_proof_revocations',
      'faculty_otp_verification_receipts',
      'mentor_case_assignment_revocations',
      'mentor_case_assignments',
      'student_auth_binding_revocations',
      'student_auth_bindings'
    ]::text[])
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF expected_fingerprint IS NULL
    OR observed_inventory_count IS DISTINCT FROM expected_inventory_count
    OR observed_function_count IS DISTINCT FROM expected_function_count
    OR observed_definer_count IS DISTINCT FROM expected_definer_count
    OR observed_policy_count IS DISTINCT FROM expected_policy_count
    OR observed_nonowner_relation_acl_count
      IS DISTINCT FROM expected_nonowner_relation_acl_count
    OR observed_column_acl_count IS DISTINCT FROM expected_column_acl_count
    OR observed_fingerprint IS DISTINCT FROM expected_fingerprint
  THEN
    RAISE EXCEPTION 'DR-133 identity/scope rollback semantic catalog mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$semantic_catalog_guard$;

DO $catalog_guard$
DECLARE
  successor_definer_count bigint;
  successor_policy_count bigint;
  public_execute_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO successor_definer_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.proname IN (
      'ensure_student_auth_binding',
      'revoke_student_auth_binding',
      'resolve_faculty_case_scope',
      'resolve_mentor_case_scope'
    )
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner';

  SELECT pg_catalog.count(*)
  INTO successor_policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND policy.polname IN (
      'student_auth_bindings_identity_command_select',
      'student_auth_bindings_identity_command_insert',
      'student_auth_binding_revocations_identity_command_select',
      'student_auth_binding_revocations_identity_command_insert',
      'faculty_invitations_scope_resolution_select',
      'faculty_otp_verification_scope_resolution_select',
      'faculty_otp_revocations_scope_resolution_select',
      'mentor_assignments_scope_resolution_select',
      'mentor_assignment_revocations_scope_resolution_select'
    )
    AND policy.polroles = ARRAY[(
      SELECT role.oid FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = 'lor_studio_command_owner'
    )]::oid[];

  SELECT pg_catalog.count(*)
  INTO public_execute_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  IF successor_definer_count IS DISTINCT FROM 4
    OR successor_policy_count IS DISTINCT FROM 9
    OR public_execute_count <> 0
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = 'lor_studio_app'
        AND NOT rolsuper AND NOT rolinherit AND NOT rolcreaterole
        AND NOT rolcreatedb AND NOT rolcanlogin AND NOT rolreplication
        AND NOT rolbypassrls
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = 'lor_studio_command_owner'
        AND NOT rolsuper AND NOT rolinherit AND NOT rolcreaterole
        AND NOT rolcreatedb AND NOT rolcanlogin AND NOT rolreplication
        AND NOT rolbypassrls
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
      JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
      WHERE granted_role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
        OR member_role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
    )
    OR pg_catalog.to_regprocedure(
      'lor_studio.identity_bootstrap_context_allows(text,text[])'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.actor_scope_resolution_context_allows(text,text,text[],text)'
    ) IS NULL
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_command_owner', 'lor_studio.student_auth_bindings', 'INSERT'
    )
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.student_auth_binding_revocations',
      'INSERT'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.ensure_student_auth_binding(text,text,text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.revoke_student_auth_binding(text,text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.resolve_faculty_case_scope(text,text,text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.resolve_mentor_case_scope(text,text,text)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'DR-133 identity/scope rollback catalog mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_guard$;

REVOKE EXECUTE ON FUNCTION lor_studio.ensure_student_auth_binding(text, text, text)
FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.revoke_student_auth_binding(text, text)
FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.resolve_faculty_case_scope(text, text, text)
FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.resolve_mentor_case_scope(text, text, text)
FROM lor_studio_app;

DROP POLICY student_auth_bindings_identity_command_select
ON lor_studio.student_auth_bindings;
DROP POLICY student_auth_bindings_identity_command_insert
ON lor_studio.student_auth_bindings;
DROP POLICY student_auth_binding_revocations_identity_command_select
ON lor_studio.student_auth_binding_revocations;
DROP POLICY student_auth_binding_revocations_identity_command_insert
ON lor_studio.student_auth_binding_revocations;
DROP POLICY faculty_invitations_scope_resolution_select
ON lor_studio.faculty_invitations;
DROP POLICY faculty_otp_verification_scope_resolution_select
ON lor_studio.faculty_otp_verification_receipts;
DROP POLICY faculty_otp_revocations_scope_resolution_select
ON lor_studio.faculty_otp_proof_revocations;
DROP POLICY mentor_assignments_scope_resolution_select
ON lor_studio.mentor_case_assignments;
DROP POLICY mentor_assignment_revocations_scope_resolution_select
ON lor_studio.mentor_case_assignment_revocations;

DROP FUNCTION lor_studio.ensure_student_auth_binding(text, text, text);
DROP FUNCTION lor_studio.revoke_student_auth_binding(text, text);
DROP FUNCTION lor_studio.resolve_faculty_case_scope(text, text, text);
DROP FUNCTION lor_studio.resolve_mentor_case_scope(text, text, text);

REVOKE EXECUTE ON FUNCTION lor_studio.identity_bootstrap_context_allows(text, text[])
FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.actor_scope_resolution_context_allows(
  text, text, text[], text
) FROM lor_studio_command_owner;

DROP FUNCTION lor_studio.identity_bootstrap_context_allows(text, text[]);
DROP FUNCTION lor_studio.actor_scope_resolution_context_allows(text, text, text[], text);

REVOKE INSERT ON TABLE
  lor_studio.student_auth_bindings,
  lor_studio.student_auth_binding_revocations
FROM lor_studio_command_owner;

DO $restore_sentinel$
DECLARE
  observed_sentinel text;
  base_sentinel text;
BEGIN
  SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO STRICT observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';

  base_sentinel := pg_catalog.regexp_replace(
    observed_sentinel,
    '\|identityScope=20260825010200$',
    ''
  );
  IF base_sentinel IS NOT DISTINCT FROM observed_sentinel THEN
    RAISE EXCEPTION 'DR-133 identity/scope rollback sentinel suffix missing'
      USING ERRCODE = '55000';
  END IF;

  EXECUTE pg_catalog.format('COMMENT ON SCHEMA lor_studio IS %L', base_sentinel);
END
$restore_sentinel$;

COMMIT;
