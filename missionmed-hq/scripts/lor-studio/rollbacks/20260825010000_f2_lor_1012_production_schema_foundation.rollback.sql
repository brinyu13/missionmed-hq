-- Rollback: 20260825010000_f2_lor_1012_production_schema_foundation.rollback.sql
-- Authority: F2-LOR-1012 / DR-133
-- Reverses: 20260825010000_f2_lor_1012_production_schema_foundation.sql
-- Boundary: exact sentinel-bound, empty Railway PostgreSQL LOR target only
-- Exact target: MissionMed Railway project 29afe885 / lor-staging environment f5705d38 / Postgres service b49a52e7. This artifact is not reusable for a later production-environment database.
-- Verification: Requires forward-ledger parity, empty-table proof, and the provider-native recovery point recorded before mutation.

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
    'missionmed.lor.railway-postgres-target.v1|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260825010000',
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
    RAISE EXCEPTION 'DR-133 rollback requires the exact sentinel-bound private Railway PostgreSQL target identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.administrative_case_grant_revocations,
  lor_studio.administrative_case_grants,
  lor_studio.ai_generation_runs,
  lor_studio.ai_letter_proposals,
  lor_studio.ai_proposal_decisions,
  lor_studio.consent_receipts,
  lor_studio.deletion_hold_releases,
  lor_studio.deletion_intents,
  lor_studio.deletion_receipts,
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_challenge_revocations,
  lor_studio.faculty_otp_challenges,
  lor_studio.faculty_otp_proof_revocations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.faculty_private_content,
  lor_studio.mentor_case_assignment_revocations,
  lor_studio.mentor_case_assignments,
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_case_creation_reservations,
  lor_studio.recommendation_case_private_write_receipts,
  lor_studio.recommendation_case_protected_revision_states,
  lor_studio.recommendation_case_write_receipts,
  lor_studio.recommendation_cases,
  lor_studio.released_student_documents,
  lor_studio.student_auth_binding_revocations,
  lor_studio.student_auth_bindings,
  lor_studio.waiver_receipts,
  lor_studio.writer_depot_artifacts
IN ACCESS EXCLUSIVE MODE;

DO $catalog_guard$
DECLARE
  relation record;
  relation_has_rows boolean;
  migration_admin_oid oid := (
    SELECT role.oid FROM pg_catalog.pg_roles AS role WHERE role.rolname = current_user
  );
  app_role_oid oid := (
    SELECT role.oid FROM pg_catalog.pg_roles AS role WHERE role.rolname = 'lor_studio_app'
  );
  command_owner_oid oid := (
    SELECT role.oid
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = 'lor_studio_command_owner'
  );
  postgres_major constant integer := (
    pg_catalog.current_setting('server_version_num')::integer / 10000
  );
  expected_index_count constant bigint := 115;
  expected_index_fingerprint constant text := CASE postgres_major
    WHEN 16 THEN '6486aa57aebe29f7dd19f48611f4a24958bffbbbe5bf95ff603c16bad2a8f8d6'
    WHEN 18 THEN '6486aa57aebe29f7dd19f48611f4a24958bffbbbe5bf95ff603c16bad2a8f8d6'
    ELSE NULL
  END;
  expected_constraint_count constant bigint := CASE postgres_major
    WHEN 16 THEN 306
    WHEN 18 THEN 616
    ELSE NULL
  END;
  expected_constraint_fingerprint constant text := CASE postgres_major
    WHEN 16 THEN 'aa251174fe7dd624049a0a45c46b279cad5757f46e2a355f85b466b53ac1a002'
    WHEN 18 THEN '80aebb352dba03810b876597b83b4224cc391bc9e7688f5ccbac1e3eeae78c8f'
    ELSE NULL
  END;
  expected_semantic_count constant bigint := 714;
  expected_semantic_fingerprint constant text := CASE postgres_major
    WHEN 16 THEN 'b6942b230a0a5d30724dc288af63a77a38246077872135fd4aa787919a30a423'
    WHEN 18 THEN 'fe9208eff3644eeb4a7b484b2309fecea4c1c268324c2fdb8c2237a0ebd7aec7'
    ELSE NULL
  END;
  observed_relations text[];
  observed_views text[];
  observed_functions text[];
  observed_policies text[];
  observed_triggers text[];
  observed_rls text[];
  observed_default_acl_types text[];
  observed_index_count bigint;
  observed_index_fingerprint text;
  observed_constraint_count bigint;
  observed_constraint_fingerprint text;
  observed_semantic_count bigint;
  observed_semantic_fingerprint text;
  unexpected_acl_count bigint;
  unexpected_column_acl_count bigint;
  unexpected_default_acl_entry_count bigint;
  expected_relations constant text[] := ARRAY[
    'administrative_case_grant_revocations',
    'administrative_case_grants',
    'ai_generation_runs',
    'ai_letter_proposals',
    'ai_proposal_decisions',
    'consent_receipts',
    'deletion_hold_releases',
    'deletion_intents',
    'deletion_receipts',
    'faculty_invitations',
    'faculty_otp_challenge_revocations',
    'faculty_otp_challenges',
    'faculty_otp_proof_revocations',
    'faculty_otp_verification_receipts',
    'faculty_private_content',
    'mentor_case_assignment_revocations',
    'mentor_case_assignments',
    'recommendation_case_audit_events',
    'recommendation_case_creation_reservations',
    'recommendation_case_private_write_receipts',
    'recommendation_case_protected_revision_states',
    'recommendation_case_write_receipts',
    'recommendation_cases',
    'released_student_documents',
    'student_auth_binding_revocations',
    'student_auth_bindings',
    'waiver_receipts',
    'writer_depot_artifacts'
  ]::text[];
  expected_functions constant text[] := ARRAY[
    'ai_grounding_manifest_is_complete(jsonb)@migration_admin:false',
    'audit_event_is_metadata(jsonb)@migration_admin:false',
    'canonical_jsonb_sha256(jsonb)@migration_admin:false',
    'canonical_jsonb_text(jsonb)@migration_admin:false',
    'enforce_ai_generation_run_insert()@migration_admin:false',
    'enforce_ai_letter_proposal_insert()@migration_admin:false',
    'enforce_ai_proposal_decision_insert()@migration_admin:false',
    'enforce_case_write_receipt_insert()@migration_admin:false',
    'enforce_deletion_hold_release_audit_consumed()@migration_admin:false',
    'enforce_deletion_hold_release_insert()@migration_admin:false',
    'enforce_deletion_intent_insert()@migration_admin:false',
    'enforce_deletion_receipt_insert()@migration_admin:false',
    'enforce_faculty_invitation_update()@migration_admin:false',
    'enforce_faculty_otp_challenge_insert()@migration_admin:false',
    'enforce_faculty_otp_verification_receipt_insert()@migration_admin:false',
    'enforce_faculty_private_content_insert()@migration_admin:false',
    'enforce_faculty_private_content_update()@migration_admin:false',
    'enforce_private_write_receipt_insert()@migration_admin:false',
    'enforce_protected_revision_state_insert()@migration_admin:false',
    'enforce_recommendation_case_insert()@migration_admin:false',
    'enforce_recommendation_case_update()@migration_admin:false',
    'enforce_released_student_document_insert()@migration_admin:false',
    'enforce_revision_bound_student_receipt_insert()@migration_admin:false',
    'private_record_is_complete(jsonb)@migration_admin:false',
    'protected_case_state_is_complete(jsonb,bigint)@migration_admin:false',
    'protected_state_chain_hash(text,text,bigint,text,text,jsonb)@migration_admin:false',
    'reject_append_only_mutation()@migration_admin:false',
    'reject_waiver_after_student_release()@migration_admin:false',
    'release_document_hash(text,text,text,text)@migration_admin:false',
    'student_record_is_safe(jsonb)@migration_admin:false',
    'text_array_is_sorted_unique(text[])@migration_admin:false'
  ]::text[];
  expected_triggers constant text[] := ARRAY[
    'administrative_case_grant_revocations_append_only@administrative_case_grant_revocations:reject_append_only_mutation',
    'administrative_case_grants_append_only@administrative_case_grants:reject_append_only_mutation',
    'ai_generation_runs_append_only@ai_generation_runs:reject_append_only_mutation',
    'ai_generation_runs_insert_guard@ai_generation_runs:enforce_ai_generation_run_insert',
    'ai_letter_proposals_append_only@ai_letter_proposals:reject_append_only_mutation',
    'ai_letter_proposals_insert_guard@ai_letter_proposals:enforce_ai_letter_proposal_insert',
    'ai_proposal_decisions_append_only@ai_proposal_decisions:reject_append_only_mutation',
    'ai_proposal_decisions_insert_guard@ai_proposal_decisions:enforce_ai_proposal_decision_insert',
    'consent_receipts_append_only@consent_receipts:reject_append_only_mutation',
    'consent_receipts_revision_guard@consent_receipts:enforce_revision_bound_student_receipt_insert',
    'deletion_hold_release_audit_consumption_guard@recommendation_case_audit_events:enforce_deletion_hold_release_audit_consumed',
    'deletion_hold_releases_append_only@deletion_hold_releases:reject_append_only_mutation',
    'deletion_hold_releases_insert_guard@deletion_hold_releases:enforce_deletion_hold_release_insert',
    'deletion_intents_append_only@deletion_intents:reject_append_only_mutation',
    'deletion_intents_insert_guard@deletion_intents:enforce_deletion_intent_insert',
    'deletion_receipts_append_only@deletion_receipts:reject_append_only_mutation',
    'deletion_receipts_insert_guard@deletion_receipts:enforce_deletion_receipt_insert',
    'faculty_invitations_update_guard@faculty_invitations:enforce_faculty_invitation_update',
    'faculty_otp_challenge_revocations_append_only@faculty_otp_challenge_revocations:reject_append_only_mutation',
    'faculty_otp_challenges_append_only@faculty_otp_challenges:reject_append_only_mutation',
    'faculty_otp_challenges_insert_guard@faculty_otp_challenges:enforce_faculty_otp_challenge_insert',
    'faculty_otp_proof_revocations_append_only@faculty_otp_proof_revocations:reject_append_only_mutation',
    'faculty_otp_verification_receipts_append_only@faculty_otp_verification_receipts:reject_append_only_mutation',
    'faculty_otp_verification_receipts_insert_guard@faculty_otp_verification_receipts:enforce_faculty_otp_verification_receipt_insert',
    'faculty_private_content_insert_guard@faculty_private_content:enforce_faculty_private_content_insert',
    'faculty_private_content_update_guard@faculty_private_content:enforce_faculty_private_content_update',
    'mentor_case_assignment_revocations_append_only@mentor_case_assignment_revocations:reject_append_only_mutation',
    'mentor_case_assignments_append_only@mentor_case_assignments:reject_append_only_mutation',
    'recommendation_case_audit_events_append_only@recommendation_case_audit_events:reject_append_only_mutation',
    'recommendation_case_creation_reservations_append_only@recommendation_case_creation_reservations:reject_append_only_mutation',
    'recommendation_case_private_write_receipts_append_only@recommendation_case_private_write_receipts:reject_append_only_mutation',
    'recommendation_case_private_write_receipts_insert_guard@recommendation_case_private_write_receipts:enforce_private_write_receipt_insert',
    'recommendation_case_protected_revision_states_append_only@recommendation_case_protected_revision_states:reject_append_only_mutation',
    'recommendation_case_protected_revision_states_insert_guard@recommendation_case_protected_revision_states:enforce_protected_revision_state_insert',
    'recommendation_case_write_receipts_append_only@recommendation_case_write_receipts:reject_append_only_mutation',
    'recommendation_case_write_receipts_insert_guard@recommendation_case_write_receipts:enforce_case_write_receipt_insert',
    'recommendation_cases_insert_guard@recommendation_cases:enforce_recommendation_case_insert',
    'recommendation_cases_update_guard@recommendation_cases:enforce_recommendation_case_update',
    'released_student_documents_append_only@released_student_documents:reject_append_only_mutation',
    'released_student_documents_insert_guard@released_student_documents:enforce_released_student_document_insert',
    'student_auth_binding_revocations_append_only@student_auth_binding_revocations:reject_append_only_mutation',
    'student_auth_bindings_append_only@student_auth_bindings:reject_append_only_mutation',
    'waiver_receipts_append_only@waiver_receipts:reject_append_only_mutation',
    'waiver_receipts_post_release_guard@waiver_receipts:reject_waiver_after_student_release',
    'waiver_receipts_revision_guard@waiver_receipts:enforce_revision_bound_student_receipt_insert',
    'writer_depot_artifacts_append_only@writer_depot_artifacts:reject_append_only_mutation'
  ]::text[];
BEGIN
  IF migration_admin_oid IS NULL
    OR app_role_oid IS NULL
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname LIKE 'lor_studio_%'
    ) <> 1
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = 'lor_studio_app'
        AND role.rolsuper IS FALSE
        AND role.rolinherit IS FALSE
        AND role.rolcreaterole IS FALSE
        AND role.rolcreatedb IS FALSE
        AND role.rolcanlogin IS FALSE
        AND role.rolreplication IS FALSE
        AND role.rolbypassrls IS FALSE
        AND role.rolconnlimit = -1
        AND role.rolvaliduntil IS NULL
        AND role.rolconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
    ) <> 1
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_auth_members AS membership
      WHERE membership.roleid = app_role_oid OR membership.member = app_role_oid
    ) <> 0
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_default_acl AS default_acl
      WHERE default_acl.defaclrole = app_role_oid
    ) <> 0
  THEN
    RAISE EXCEPTION 'DR-120 rollback role inventory mismatch'
      USING ERRCODE = '55000';
  END IF;

  SELECT COALESCE(
    pg_catalog.array_agg(class.relname::text ORDER BY class.relname),
    ARRAY[]::text[]
  )
  INTO observed_relations
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind = 'r';

  SELECT COALESCE(
    pg_catalog.array_agg(class.relname::text ORDER BY class.relname),
    ARRAY[]::text[]
  )
  INTO observed_views
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind IN ('v', 'm');

  SELECT COALESCE(
    pg_catalog.array_agg(
      pg_catalog.format(
        '%s(%s)@%s:%s',
        procedure.proname,
        pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ' ', ''),
        CASE
          WHEN procedure.proowner = migration_admin_oid THEN 'migration_admin'
          ELSE pg_catalog.pg_get_userbyid(procedure.proowner)::text
        END,
        procedure.prosecdef::text
      )
      ORDER BY procedure.proname, procedure.proargtypes::text
    ),
    ARRAY[]::text[]
  )
  INTO observed_functions
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio';

  SELECT COALESCE(
    pg_catalog.array_agg(policy.policyname::text ORDER BY policy.policyname),
    ARRAY[]::text[]
  )
  INTO observed_policies
  FROM pg_catalog.pg_policies AS policy
  WHERE policy.schemaname = 'lor_studio';

  SELECT COALESCE(
    pg_catalog.array_agg(
      pg_catalog.format('%s@%s:%s', trigger.tgname, relation_class.relname, trigger_function.proname)
      ORDER BY trigger.tgname
    ),
    ARRAY[]::text[]
  )
  INTO observed_triggers
  FROM pg_catalog.pg_trigger AS trigger
  JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = trigger.tgrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation_class.relnamespace
  JOIN pg_catalog.pg_proc AS trigger_function ON trigger_function.oid = trigger.tgfoid
  WHERE namespace.nspname = 'lor_studio'
    AND trigger.tgisinternal IS FALSE;

  SELECT COALESCE(
    pg_catalog.array_agg(
      pg_catalog.format(
        '%s:%s:%s',
        class.relname,
        class.relrowsecurity::text,
        class.relforcerowsecurity::text
      )
      ORDER BY class.relname
    ),
    ARRAY[]::text[]
  )
  INTO observed_rls
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind = 'r';

  WITH index_inventory AS (
    SELECT
      index_class.relname::text AS object_name,
      relation_class.relname::text AS relation_name,
      pg_catalog.pg_get_indexdef(index_class.oid, 0, false) AS definition
    FROM pg_catalog.pg_class AS index_class
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = index_class.relnamespace
    JOIN pg_catalog.pg_index AS index_record
      ON index_record.indexrelid = index_class.oid
    JOIN pg_catalog.pg_class AS relation_class
      ON relation_class.oid = index_record.indrelid
    WHERE namespace.nspname = 'lor_studio'
      AND index_class.relkind = 'i'
  )
  SELECT
    pg_catalog.count(*),
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      COALESCE(pg_catalog.string_agg(
        pg_catalog.format(
          '%s:%s|%s:%s|%s:%s',
          pg_catalog.octet_length(pg_catalog.convert_to(object_name, 'UTF8')),
          object_name,
          pg_catalog.octet_length(pg_catalog.convert_to(relation_name, 'UTF8')),
          relation_name,
          pg_catalog.octet_length(pg_catalog.convert_to(definition, 'UTF8')),
          definition
        ),
        E'\n' ORDER BY object_name, relation_name, definition
      ), ''),
      'UTF8'
    )), 'hex')
  INTO observed_index_count, observed_index_fingerprint
  FROM index_inventory;

  WITH constraint_inventory AS (
    SELECT
      constraint_record.conname::text AS object_name,
      constraint_record.contype::text AS object_type,
      COALESCE(relation_class.relname::text, '') AS relation_name,
      pg_catalog.pg_get_constraintdef(constraint_record.oid, false) AS definition
    FROM pg_catalog.pg_constraint AS constraint_record
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = constraint_record.connamespace
    LEFT JOIN pg_catalog.pg_class AS relation_class
      ON relation_class.oid = constraint_record.conrelid
    WHERE namespace.nspname = 'lor_studio'
  )
  SELECT
    pg_catalog.count(*),
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      COALESCE(pg_catalog.string_agg(
        pg_catalog.format(
          '%s:%s|%s:%s|%s:%s|%s:%s',
          pg_catalog.octet_length(pg_catalog.convert_to(object_name, 'UTF8')),
          object_name,
          pg_catalog.octet_length(pg_catalog.convert_to(object_type, 'UTF8')),
          object_type,
          pg_catalog.octet_length(pg_catalog.convert_to(relation_name, 'UTF8')),
          relation_name,
          pg_catalog.octet_length(pg_catalog.convert_to(definition, 'UTF8')),
          definition
        ),
        E'\n' ORDER BY object_name, object_type, relation_name, definition
      ), ''),
      'UTF8'
    )), 'hex')
  INTO observed_constraint_count, observed_constraint_fingerprint
  FROM constraint_inventory;

  -- Bind rollback custody to the full disposable schema semantics, not only
  -- object names.  Harness-generated role identities are normalized before
  -- hashing so independently created disposable clusters remain comparable.
  WITH semantic_inventory AS (
    SELECT
      'schema'::text AS category,
      namespace.nspname::text AS identity,
      pg_catalog.jsonb_build_object(
        'owner', CASE
          WHEN namespace.nspowner = migration_admin_oid THEN 'migration_admin'
          WHEN namespace.nspowner = command_owner_oid THEN 'command_owner'
          WHEN namespace.nspowner = app_role_oid THEN 'app'
          ELSE pg_catalog.pg_get_userbyid(namespace.nspowner)::text
        END,
        'aclIsNull', namespace.nspacl IS NULL,
        'acl', (
          SELECT pg_catalog.jsonb_agg(normalized_acl.acl_entry ORDER BY normalized_acl.acl_entry::text)
          FROM (
            SELECT pg_catalog.jsonb_build_object(
                'grantor', CASE
                  WHEN acl.grantor = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantor = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantor = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantor)::text
                END,
                'grantee', CASE
                  WHEN acl.grantee = 0 THEN 'PUBLIC'
                  WHEN acl.grantee = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantee = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantee = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text
                END,
                'privilege', acl.privilege_type,
                'grantable', acl.is_grantable
              ) AS acl_entry
            FROM pg_catalog.aclexplode(namespace.nspacl) AS acl
          ) AS normalized_acl
        )
      )::text AS definition
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'table'::text AS category,
      class.relname::text AS identity,
      pg_catalog.jsonb_build_object(
        'kind', class.relkind,
        'owner', CASE
          WHEN class.relowner = migration_admin_oid THEN 'migration_admin'
          WHEN class.relowner = command_owner_oid THEN 'command_owner'
          WHEN class.relowner = app_role_oid THEN 'app'
          ELSE pg_catalog.pg_get_userbyid(class.relowner)::text
        END,
        'persistence', class.relpersistence,
        'replicaIdentity', class.relreplident,
        'options', pg_catalog.to_jsonb(class.reloptions),
        'accessMethod', access_method.amname,
        'aclIsNull', class.relacl IS NULL,
        'acl', (
          SELECT pg_catalog.jsonb_agg(normalized_acl.acl_entry ORDER BY normalized_acl.acl_entry::text)
          FROM (
            SELECT pg_catalog.jsonb_build_object(
                'grantor', CASE
                  WHEN acl.grantor = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantor = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantor = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantor)::text
                END,
                'grantee', CASE
                  WHEN acl.grantee = 0 THEN 'PUBLIC'
                  WHEN acl.grantee = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantee = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantee = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text
                END,
                'privilege', acl.privilege_type,
                'grantable', acl.is_grantable
              ) AS acl_entry
            FROM pg_catalog.aclexplode(class.relacl) AS acl
          ) AS normalized_acl
        )
      )::text AS definition
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = class.relam
    WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r'
    UNION ALL
    SELECT
      'row_type',
      type.typname,
      pg_catalog.jsonb_build_object(
        'owner', CASE
          WHEN type.typowner = migration_admin_oid THEN 'migration_admin'
          WHEN type.typowner = command_owner_oid THEN 'command_owner'
          WHEN type.typowner = app_role_oid THEN 'app'
          ELSE pg_catalog.pg_get_userbyid(type.typowner)::text
        END,
        'relation', class.relname,
        'relationKind', class.relkind,
        'arrayType', array_type.typname,
        'arrayOwner', CASE
          WHEN array_type.typowner = migration_admin_oid THEN 'migration_admin'
          WHEN array_type.typowner = command_owner_oid THEN 'command_owner'
          WHEN array_type.typowner = app_role_oid THEN 'app'
          ELSE pg_catalog.pg_get_userbyid(array_type.typowner)::text
        END,
        'arrayAclIsNull', array_type.typacl IS NULL,
        'arrayAcl', (
          SELECT pg_catalog.jsonb_agg(normalized_acl.acl_entry ORDER BY normalized_acl.acl_entry::text)
          FROM (
            SELECT pg_catalog.jsonb_build_object(
                'grantor', CASE
                  WHEN acl.grantor = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantor = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantor = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantor)::text
                END,
                'grantee', CASE
                  WHEN acl.grantee = 0 THEN 'PUBLIC'
                  WHEN acl.grantee = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantee = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantee = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text
                END,
                'privilege', acl.privilege_type,
                'grantable', acl.is_grantable
              ) AS acl_entry
            FROM pg_catalog.aclexplode(array_type.typacl) AS acl
          ) AS normalized_acl
        ),
        'arrayComment', pg_catalog.obj_description(array_type.oid, 'pg_type'),
        'aclIsNull', type.typacl IS NULL,
        'acl', (
          SELECT pg_catalog.jsonb_agg(normalized_acl.acl_entry ORDER BY normalized_acl.acl_entry::text)
          FROM (
            SELECT pg_catalog.jsonb_build_object(
                'grantor', CASE
                  WHEN acl.grantor = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantor = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantor = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantor)::text
                END,
                'grantee', CASE
                  WHEN acl.grantee = 0 THEN 'PUBLIC'
                  WHEN acl.grantee = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantee = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantee = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text
                END,
                'privilege', acl.privilege_type,
                'grantable', acl.is_grantable
              ) AS acl_entry
            FROM pg_catalog.aclexplode(type.typacl) AS acl
          ) AS normalized_acl
        ),
        'comment', pg_catalog.obj_description(type.oid, 'pg_type')
      )::text
    FROM pg_catalog.pg_type AS type
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = type.typnamespace
    JOIN pg_catalog.pg_class AS class ON class.oid = type.typrelid
    JOIN pg_catalog.pg_type AS array_type ON array_type.oid = type.typarray
    WHERE namespace.nspname = 'lor_studio'
      AND type.typtype = 'c'
      AND class.relkind IN ('r', 'v', 'm')
    UNION ALL
    SELECT
      'column',
      class.relname || '.' || attribute.attnum::text || '.' || attribute.attname,
      pg_catalog.jsonb_build_object(
        'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
        'notNull', attribute.attnotnull,
        'default', pg_catalog.pg_get_expr(attribute_default.adbin, attribute_default.adrelid, false),
        'identity', attribute.attidentity,
        'generated', attribute.attgenerated,
        'collation', CASE WHEN attribute.attcollation = 0 THEN NULL ELSE
          collation_namespace.nspname || '.' || collation_record.collname END,
        'storage', attribute.attstorage,
        'compression', attribute.attcompression,
        'statistics', attribute.attstattarget,
        'options', pg_catalog.to_jsonb(attribute.attoptions),
        'fdwOptions', pg_catalog.to_jsonb(attribute.attfdwoptions)
      )::text
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    LEFT JOIN pg_catalog.pg_attrdef AS attribute_default
      ON attribute_default.adrelid = attribute.attrelid
     AND attribute_default.adnum = attribute.attnum
    LEFT JOIN pg_catalog.pg_collation AS collation_record
      ON collation_record.oid = attribute.attcollation
    LEFT JOIN pg_catalog.pg_namespace AS collation_namespace
      ON collation_namespace.oid = collation_record.collnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relkind IN ('r', 'v', 'm')
      AND attribute.attnum > 0
      AND attribute.attisdropped IS FALSE
    UNION ALL
    SELECT
      'function',
      procedure.proname || '(' ||
        pg_catalog.replace(pg_catalog.pg_get_function_identity_arguments(procedure.oid), ' ', '') || ')',
      pg_catalog.jsonb_build_object(
        'owner', CASE
          WHEN procedure.proowner = migration_admin_oid THEN 'migration_admin'
          WHEN procedure.proowner = command_owner_oid THEN 'command_owner'
          WHEN procedure.proowner = app_role_oid THEN 'app'
          ELSE pg_catalog.pg_get_userbyid(procedure.proowner)::text
        END,
        'definition', pg_catalog.pg_get_functiondef(procedure.oid),
        'aclIsNull', procedure.proacl IS NULL,
        'acl', (
          SELECT pg_catalog.jsonb_agg(normalized_acl.acl_entry ORDER BY normalized_acl.acl_entry::text)
          FROM (
            SELECT pg_catalog.jsonb_build_object(
                'grantor', CASE
                  WHEN acl.grantor = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantor = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantor = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantor)::text
                END,
                'grantee', CASE
                  WHEN acl.grantee = 0 THEN 'PUBLIC'
                  WHEN acl.grantee = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantee = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantee = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text
                END,
                'privilege', acl.privilege_type,
                'grantable', acl.is_grantable
              ) AS acl_entry
            FROM pg_catalog.aclexplode(procedure.proacl) AS acl
          ) AS normalized_acl
        )
      )::text
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'policy',
      policy.tablename || '.' || policy.policyname,
      pg_catalog.jsonb_build_object(
        'permissive', policy.permissive,
        'roles', pg_catalog.to_jsonb(policy.roles),
        'command', policy.cmd,
        'using', policy.qual,
        'withCheck', policy.with_check
      )::text
    FROM pg_catalog.pg_policies AS policy
    WHERE policy.schemaname = 'lor_studio'
    UNION ALL
    SELECT
      'trigger',
      relation_class.relname || '.' || trigger.tgname,
      pg_catalog.jsonb_build_object(
        'enabled', trigger.tgenabled,
        'type', trigger.tgtype,
        'definition', pg_catalog.pg_get_triggerdef(trigger.oid, false)
      )::text
    FROM pg_catalog.pg_trigger AS trigger
    JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = trigger.tgrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation_class.relnamespace
    WHERE namespace.nspname = 'lor_studio' AND trigger.tgisinternal IS FALSE
    UNION ALL
    SELECT
      'constraint_trigger',
      relation_class.relname || '.' || constraint_record.conname || '.' ||
        trigger_function.proname || '(' ||
        pg_catalog.replace(
          pg_catalog.pg_get_function_identity_arguments(trigger_function.oid),
          ' ',
          ''
        ) || ')',
      pg_catalog.jsonb_build_object(
        'enabled', trigger.tgenabled,
        'type', trigger.tgtype,
        'definition', pg_catalog.regexp_replace(
          pg_catalog.pg_get_triggerdef(trigger.oid, false),
          '^CREATE CONSTRAINT TRIGGER [^ ]+',
          'CREATE CONSTRAINT TRIGGER <internal>'
        )
      )::text
    FROM pg_catalog.pg_trigger AS trigger
    JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = trigger.tgrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation_class.relnamespace
    JOIN pg_catalog.pg_constraint AS constraint_record ON constraint_record.oid = trigger.tgconstraint
    JOIN pg_catalog.pg_proc AS trigger_function ON trigger_function.oid = trigger.tgfoid
    WHERE namespace.nspname = 'lor_studio'
      AND trigger.tgisinternal IS TRUE
      AND trigger.tgconstraint <> 0
    UNION ALL
    SELECT
      'rewrite_rule',
      relation_class.relkind::text || ':' || relation_class.relname || '.' || rewrite_rule.rulename,
      pg_catalog.jsonb_build_object(
        'eventType', rewrite_rule.ev_type,
        'enabled', rewrite_rule.ev_enabled,
        'instead', rewrite_rule.is_instead,
        'definition', pg_catalog.pg_get_ruledef(rewrite_rule.oid, false)
      )::text
    FROM pg_catalog.pg_rewrite AS rewrite_rule
    JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = rewrite_rule.ev_class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation_class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND NOT (
        relation_class.relkind IN ('v', 'm')
        AND rewrite_rule.rulename = '_RETURN'
      )
    UNION ALL
    SELECT
      'comment',
      CASE
        WHEN description.objsubid = 0
          THEN 'relation:' || class.relkind::text || ':' || class.relname
        ELSE 'relation-subobject:' || class.relkind::text || ':' || class.relname || '.' ||
          description.objsubid::text || '.' || COALESCE(attribute.attname::text, '<missing>')
      END,
      pg_catalog.jsonb_build_object('description', description.description)::text
    FROM pg_catalog.pg_description AS description
    JOIN pg_catalog.pg_class AS class
      ON description.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
     AND class.oid = description.objoid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    LEFT JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = class.oid
     AND attribute.attnum = description.objsubid
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'comment',
      'constraint:' || COALESCE(
        'relation:' || relation_class.relname,
        'type:' || constrained_type.typname,
        '<unbound>'
      ) || '.' || constraint_record.contype::text || '.' || constraint_record.conname || '.' ||
        description.objsubid::text,
      pg_catalog.jsonb_build_object('description', description.description)::text
    FROM pg_catalog.pg_description AS description
    JOIN pg_catalog.pg_constraint AS constraint_record
      ON description.classoid = 'pg_catalog.pg_constraint'::pg_catalog.regclass
     AND constraint_record.oid = description.objoid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = constraint_record.connamespace
    LEFT JOIN pg_catalog.pg_class AS relation_class
      ON relation_class.oid = constraint_record.conrelid
    LEFT JOIN pg_catalog.pg_type AS constrained_type
      ON constrained_type.oid = constraint_record.contypid
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'comment',
      'function:' || procedure.proname || '(' ||
        pg_catalog.replace(
          pg_catalog.pg_get_function_identity_arguments(procedure.oid),
          ' ',
          ''
        ) || ').' || description.objsubid::text,
      pg_catalog.jsonb_build_object('description', description.description)::text
    FROM pg_catalog.pg_description AS description
    JOIN pg_catalog.pg_proc AS procedure
      ON description.classoid = 'pg_catalog.pg_proc'::pg_catalog.regclass
     AND procedure.oid = description.objoid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'comment',
      'policy:' || relation_class.relname || '.' || policy.polname || '.' ||
        description.objsubid::text,
      pg_catalog.jsonb_build_object('description', description.description)::text
    FROM pg_catalog.pg_description AS description
    JOIN pg_catalog.pg_policy AS policy
      ON description.classoid = 'pg_catalog.pg_policy'::pg_catalog.regclass
     AND policy.oid = description.objoid
    JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation_class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'comment',
      'trigger:' || CASE
        WHEN trigger.tgisinternal THEN
          'internal:' || relation_class.relname || '.' ||
          COALESCE(constraint_record.conname::text, '<unbound>') || '.' ||
          trigger_function.proname || '(' ||
          pg_catalog.replace(
            pg_catalog.pg_get_function_identity_arguments(trigger_function.oid),
            ' ',
            ''
          ) || ').' || trigger.tgtype::text
        ELSE 'user:' || relation_class.relname || '.' || trigger.tgname
      END || '.' || description.objsubid::text,
      pg_catalog.jsonb_build_object('description', description.description)::text
    FROM pg_catalog.pg_description AS description
    JOIN pg_catalog.pg_trigger AS trigger
      ON description.classoid = 'pg_catalog.pg_trigger'::pg_catalog.regclass
     AND trigger.oid = description.objoid
    JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = trigger.tgrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation_class.relnamespace
    JOIN pg_catalog.pg_proc AS trigger_function ON trigger_function.oid = trigger.tgfoid
    LEFT JOIN pg_catalog.pg_constraint AS constraint_record
      ON constraint_record.oid = trigger.tgconstraint
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'comment',
      'role:' || CASE
        WHEN role.oid = app_role_oid THEN 'app'
        WHEN role.oid = command_owner_oid THEN 'command_owner'
        ELSE role.rolname::text
      END,
      pg_catalog.jsonb_build_object('description', description.description)::text
    FROM pg_catalog.pg_shdescription AS description
    JOIN pg_catalog.pg_roles AS role
      ON description.classoid = 'pg_catalog.pg_authid'::pg_catalog.regclass
     AND role.oid = description.objoid
    WHERE role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
    UNION ALL
    SELECT
      'security_label',
      'schema:' || namespace.nspname || '.' || security_label.objsubid::text,
      pg_catalog.jsonb_build_object(
        'provider', security_label.provider,
        'label', security_label.label
      )::text
    FROM pg_catalog.pg_seclabel AS security_label
    JOIN pg_catalog.pg_namespace AS namespace
      ON security_label.classoid = 'pg_catalog.pg_namespace'::pg_catalog.regclass
     AND namespace.oid = security_label.objoid
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'security_label',
      CASE
        WHEN security_label.objsubid = 0
          THEN 'relation:' || class.relkind::text || ':' || class.relname
        ELSE 'relation-subobject:' || class.relkind::text || ':' || class.relname || '.' ||
          security_label.objsubid::text || '.' || COALESCE(attribute.attname::text, '<missing>')
      END,
      pg_catalog.jsonb_build_object(
        'provider', security_label.provider,
        'label', security_label.label
      )::text
    FROM pg_catalog.pg_seclabel AS security_label
    JOIN pg_catalog.pg_class AS class
      ON security_label.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
     AND class.oid = security_label.objoid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    LEFT JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = class.oid
     AND attribute.attnum = security_label.objsubid
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'security_label',
      'function:' || procedure.proname || '(' ||
        pg_catalog.replace(
          pg_catalog.pg_get_function_identity_arguments(procedure.oid),
          ' ',
          ''
        ) || ').' || security_label.objsubid::text,
      pg_catalog.jsonb_build_object(
        'provider', security_label.provider,
        'label', security_label.label
      )::text
    FROM pg_catalog.pg_seclabel AS security_label
    JOIN pg_catalog.pg_proc AS procedure
      ON security_label.classoid = 'pg_catalog.pg_proc'::pg_catalog.regclass
     AND procedure.oid = security_label.objoid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'security_label',
      'constraint:' || COALESCE(
        'relation:' || relation_class.relname,
        'type:' || constrained_type.typname,
        '<unbound>'
      ) || '.' || constraint_record.contype::text || '.' || constraint_record.conname || '.' ||
        security_label.objsubid::text,
      pg_catalog.jsonb_build_object(
        'provider', security_label.provider,
        'label', security_label.label
      )::text
    FROM pg_catalog.pg_seclabel AS security_label
    JOIN pg_catalog.pg_constraint AS constraint_record
      ON security_label.classoid = 'pg_catalog.pg_constraint'::pg_catalog.regclass
     AND constraint_record.oid = security_label.objoid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = constraint_record.connamespace
    LEFT JOIN pg_catalog.pg_class AS relation_class
      ON relation_class.oid = constraint_record.conrelid
    LEFT JOIN pg_catalog.pg_type AS constrained_type
      ON constrained_type.oid = constraint_record.contypid
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'security_label',
      'policy:' || relation_class.relname || '.' || policy.polname || '.' ||
        security_label.objsubid::text,
      pg_catalog.jsonb_build_object(
        'provider', security_label.provider,
        'label', security_label.label
      )::text
    FROM pg_catalog.pg_seclabel AS security_label
    JOIN pg_catalog.pg_policy AS policy
      ON security_label.classoid = 'pg_catalog.pg_policy'::pg_catalog.regclass
     AND policy.oid = security_label.objoid
    JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation_class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'security_label',
      'trigger:' || CASE
        WHEN trigger.tgisinternal THEN
          'internal:' || relation_class.relname || '.' ||
          COALESCE(constraint_record.conname::text, '<unbound>') || '.' ||
          trigger_function.proname || '(' ||
          pg_catalog.replace(
            pg_catalog.pg_get_function_identity_arguments(trigger_function.oid),
            ' ',
            ''
          ) || ').' || trigger.tgtype::text
        ELSE 'user:' || relation_class.relname || '.' || trigger.tgname
      END || '.' || security_label.objsubid::text,
      pg_catalog.jsonb_build_object(
        'provider', security_label.provider,
        'label', security_label.label
      )::text
    FROM pg_catalog.pg_seclabel AS security_label
    JOIN pg_catalog.pg_trigger AS trigger
      ON security_label.classoid = 'pg_catalog.pg_trigger'::pg_catalog.regclass
     AND trigger.oid = security_label.objoid
    JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = trigger.tgrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation_class.relnamespace
    JOIN pg_catalog.pg_proc AS trigger_function ON trigger_function.oid = trigger.tgfoid
    LEFT JOIN pg_catalog.pg_constraint AS constraint_record
      ON constraint_record.oid = trigger.tgconstraint
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'security_label',
      'type:' || type.typtype::text || ':' || type.typname || '.' || security_label.objsubid::text,
      pg_catalog.jsonb_build_object(
        'provider', security_label.provider,
        'label', security_label.label
      )::text
    FROM pg_catalog.pg_seclabel AS security_label
    JOIN pg_catalog.pg_type AS type
      ON security_label.classoid = 'pg_catalog.pg_type'::pg_catalog.regclass
     AND type.oid = security_label.objoid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'security_label',
      'role:' || CASE
        WHEN role.oid = app_role_oid THEN 'app'
        WHEN role.oid = command_owner_oid THEN 'command_owner'
        ELSE role.rolname::text
      END,
      pg_catalog.jsonb_build_object(
        'provider', security_label.provider,
        'label', security_label.label
      )::text
    FROM pg_catalog.pg_shseclabel AS security_label
    JOIN pg_catalog.pg_roles AS role
      ON security_label.classoid = 'pg_catalog.pg_authid'::pg_catalog.regclass
     AND role.oid = security_label.objoid
    WHERE role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
    UNION ALL
    SELECT
      'publication_relation',
      publication.pubname || '.' || relation_class.relname,
      pg_catalog.jsonb_build_object(
        'rowFilter', pg_catalog.pg_get_expr(
          publication_relation.prqual,
          publication_relation.prrelid,
          false
        ),
        'columns', (
          SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY published_column.ordinality)
          FROM pg_catalog.unnest(publication_relation.prattrs::smallint[])
            WITH ORDINALITY AS published_column(attnum, ordinality)
          JOIN pg_catalog.pg_attribute AS attribute
            ON attribute.attrelid = publication_relation.prrelid
           AND attribute.attnum = published_column.attnum
        )
      )::text
    FROM pg_catalog.pg_publication_rel AS publication_relation
    JOIN pg_catalog.pg_publication AS publication
      ON publication.oid = publication_relation.prpubid
    JOIN pg_catalog.pg_class AS relation_class
      ON relation_class.oid = publication_relation.prrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation_class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'extended_statistics',
      relation_class.relname || '.' || statistics.stxname,
      pg_catalog.jsonb_build_object(
        'owner', CASE
          WHEN statistics.stxowner = migration_admin_oid THEN 'migration_admin'
          WHEN statistics.stxowner = command_owner_oid THEN 'command_owner'
          WHEN statistics.stxowner = app_role_oid THEN 'app'
          ELSE pg_catalog.pg_get_userbyid(statistics.stxowner)::text
        END,
        'target', statistics.stxstattarget,
        'kinds', pg_catalog.to_jsonb(statistics.stxkind),
        'keys', (
          SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY statistics_key.ordinality)
          FROM pg_catalog.unnest(statistics.stxkeys::smallint[])
            WITH ORDINALITY AS statistics_key(attnum, ordinality)
          JOIN pg_catalog.pg_attribute AS attribute
            ON attribute.attrelid = statistics.stxrelid
           AND attribute.attnum = statistics_key.attnum
        ),
        'definition', pg_catalog.pg_get_statisticsobjdef(statistics.oid)
      )::text
    FROM pg_catalog.pg_statistic_ext AS statistics
    JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = statistics.stxrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = statistics.stxnamespace
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'view',
      class.relname,
      pg_catalog.jsonb_build_object(
        'kind', class.relkind,
        'owner', CASE
          WHEN class.relowner = migration_admin_oid THEN 'migration_admin'
          WHEN class.relowner = command_owner_oid THEN 'command_owner'
          WHEN class.relowner = app_role_oid THEN 'app'
          ELSE pg_catalog.pg_get_userbyid(class.relowner)::text
        END,
        'options', pg_catalog.to_jsonb(class.reloptions),
        'definition', pg_catalog.pg_get_viewdef(class.oid, false),
        'aclIsNull', class.relacl IS NULL,
        'acl', (
          SELECT pg_catalog.jsonb_agg(normalized_acl.acl_entry ORDER BY normalized_acl.acl_entry::text)
          FROM (
            SELECT pg_catalog.jsonb_build_object(
                'grantor', CASE
                  WHEN acl.grantor = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantor = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantor = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantor)::text
                END,
                'grantee', CASE
                  WHEN acl.grantee = 0 THEN 'PUBLIC'
                  WHEN acl.grantee = migration_admin_oid THEN 'migration_admin'
                  WHEN acl.grantee = command_owner_oid THEN 'command_owner'
                  WHEN acl.grantee = app_role_oid THEN 'app'
                  ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text
                END,
                'privilege', acl.privilege_type,
                'grantable', acl.is_grantable
              ) AS acl_entry
            FROM pg_catalog.aclexplode(class.relacl) AS acl
          ) AS normalized_acl
        )
      )::text
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio' AND class.relkind IN ('v', 'm')
  )
  SELECT
    pg_catalog.count(*),
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      COALESCE(pg_catalog.string_agg(pg_catalog.format(
        '%s:%s|%s:%s|%s:%s',
        pg_catalog.octet_length(pg_catalog.convert_to(category, 'UTF8')), category,
        pg_catalog.octet_length(pg_catalog.convert_to(identity, 'UTF8')), identity,
        pg_catalog.octet_length(pg_catalog.convert_to(definition, 'UTF8')), definition
      ), E'\n' ORDER BY category, identity, definition), ''),
      'UTF8'
    )), 'hex')
  INTO observed_semantic_count, observed_semantic_fingerprint
  FROM semantic_inventory;

  IF expected_index_fingerprint IS NULL
    OR expected_semantic_fingerprint IS NULL
    OR expected_constraint_count IS NULL
    OR expected_constraint_fingerprint IS NULL
    OR observed_semantic_count <> expected_semantic_count
    OR observed_semantic_fingerprint IS DISTINCT FROM expected_semantic_fingerprint
    OR observed_index_count <> expected_index_count
    OR observed_index_fingerprint IS DISTINCT FROM expected_index_fingerprint
    OR observed_constraint_count <> expected_constraint_count
    OR observed_constraint_fingerprint IS DISTINCT FROM expected_constraint_fingerprint
    OR observed_relations IS DISTINCT FROM expected_relations
    OR observed_views IS DISTINCT FROM ARRAY[]::text[]
    OR observed_functions IS DISTINCT FROM expected_functions
    OR observed_policies IS DISTINCT FROM ARRAY[]::text[]
    OR observed_triggers IS DISTINCT FROM expected_triggers
    OR observed_rls IS DISTINCT FROM (
      SELECT pg_catalog.array_agg(
        relation_name || ':false:false' ORDER BY relation_name COLLATE "C"
      )
      FROM pg_catalog.unnest(expected_relations) AS relation_name
    )
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relkind NOT IN ('r', 'i')
    ) <> 0
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relowner <> migration_admin_oid
    ) <> 0
  THEN
    RAISE EXCEPTION 'DR-120 rollback catalog or owner inventory mismatch'
      USING ERRCODE = '55000';
  END IF;

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
  )
  SELECT pg_catalog.count(*)
  INTO unexpected_acl_count
  FROM acl_entries
  WHERE grantee <> owner_oid;

  SELECT pg_catalog.count(*)
  INTO unexpected_column_acl_count
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND attribute.attnum > 0
    AND attribute.attacl IS NOT NULL;

  SELECT COALESCE(
    pg_catalog.array_agg(default_acl.defaclobjtype::text ORDER BY default_acl.defaclobjtype),
    ARRAY[]::text[]
  )
  INTO observed_default_acl_types
  FROM pg_catalog.pg_default_acl AS default_acl
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = default_acl.defaclnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND default_acl.defaclrole = migration_admin_oid;

  SELECT pg_catalog.count(*)
  INTO unexpected_default_acl_entry_count
  FROM pg_catalog.pg_default_acl AS default_acl
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = default_acl.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(default_acl.defaclacl) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND default_acl.defaclrole = migration_admin_oid
    AND (
      default_acl.defaclobjtype <> 'f'
      OR acl.grantee <> migration_admin_oid
      OR acl.grantor <> migration_admin_oid
      OR acl.privilege_type <> 'EXECUTE'
      OR acl.is_grantable
    );

  IF unexpected_acl_count <> 0
    OR unexpected_column_acl_count <> 0
    OR observed_default_acl_types IS DISTINCT FROM ARRAY[]::text[]
    OR unexpected_default_acl_entry_count <> 0
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_default_acl AS default_acl
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = default_acl.defaclnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND default_acl.defaclrole <> migration_admin_oid
    ) <> 0
  THEN
    RAISE EXCEPTION 'DR-120 rollback ACL inventory mismatch'
      USING ERRCODE = '55000';
  END IF;

  FOR relation IN
    SELECT relation_name
    FROM pg_catalog.unnest(expected_relations) AS relation_name
    ORDER BY relation_name
  LOOP
    EXECUTE pg_catalog.format(
      'SELECT pg_catalog.count(*) <> 0 FROM lor_studio.%I',
      relation.relation_name
    ) INTO relation_has_rows;
    IF relation_has_rows THEN
      RAISE EXCEPTION 'DR-120 rollback refuses nonempty relation lor_studio.%', relation.relation_name
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
END
$catalog_guard$;

DROP TRIGGER administrative_case_grant_revocations_append_only ON lor_studio.administrative_case_grant_revocations;
DROP TRIGGER administrative_case_grants_append_only ON lor_studio.administrative_case_grants;
DROP TRIGGER ai_generation_runs_append_only ON lor_studio.ai_generation_runs;
DROP TRIGGER ai_generation_runs_insert_guard ON lor_studio.ai_generation_runs;
DROP TRIGGER ai_letter_proposals_append_only ON lor_studio.ai_letter_proposals;
DROP TRIGGER ai_letter_proposals_insert_guard ON lor_studio.ai_letter_proposals;
DROP TRIGGER ai_proposal_decisions_append_only ON lor_studio.ai_proposal_decisions;
DROP TRIGGER ai_proposal_decisions_insert_guard ON lor_studio.ai_proposal_decisions;
DROP TRIGGER consent_receipts_append_only ON lor_studio.consent_receipts;
DROP TRIGGER consent_receipts_revision_guard ON lor_studio.consent_receipts;
DROP TRIGGER deletion_hold_release_audit_consumption_guard ON lor_studio.recommendation_case_audit_events;
DROP TRIGGER deletion_hold_releases_append_only ON lor_studio.deletion_hold_releases;
DROP TRIGGER deletion_hold_releases_insert_guard ON lor_studio.deletion_hold_releases;
DROP TRIGGER deletion_intents_append_only ON lor_studio.deletion_intents;
DROP TRIGGER deletion_intents_insert_guard ON lor_studio.deletion_intents;
DROP TRIGGER deletion_receipts_append_only ON lor_studio.deletion_receipts;
DROP TRIGGER deletion_receipts_insert_guard ON lor_studio.deletion_receipts;
DROP TRIGGER faculty_invitations_update_guard ON lor_studio.faculty_invitations;
DROP TRIGGER faculty_otp_challenge_revocations_append_only ON lor_studio.faculty_otp_challenge_revocations;
DROP TRIGGER faculty_otp_challenges_append_only ON lor_studio.faculty_otp_challenges;
DROP TRIGGER faculty_otp_challenges_insert_guard ON lor_studio.faculty_otp_challenges;
DROP TRIGGER faculty_otp_proof_revocations_append_only ON lor_studio.faculty_otp_proof_revocations;
DROP TRIGGER faculty_otp_verification_receipts_append_only ON lor_studio.faculty_otp_verification_receipts;
DROP TRIGGER faculty_otp_verification_receipts_insert_guard ON lor_studio.faculty_otp_verification_receipts;
DROP TRIGGER faculty_private_content_insert_guard ON lor_studio.faculty_private_content;
DROP TRIGGER faculty_private_content_update_guard ON lor_studio.faculty_private_content;
DROP TRIGGER mentor_case_assignment_revocations_append_only ON lor_studio.mentor_case_assignment_revocations;
DROP TRIGGER mentor_case_assignments_append_only ON lor_studio.mentor_case_assignments;
DROP TRIGGER recommendation_case_audit_events_append_only ON lor_studio.recommendation_case_audit_events;
DROP TRIGGER recommendation_case_creation_reservations_append_only ON lor_studio.recommendation_case_creation_reservations;
DROP TRIGGER recommendation_case_private_write_receipts_append_only ON lor_studio.recommendation_case_private_write_receipts;
DROP TRIGGER recommendation_case_private_write_receipts_insert_guard ON lor_studio.recommendation_case_private_write_receipts;
DROP TRIGGER recommendation_case_protected_revision_states_append_only ON lor_studio.recommendation_case_protected_revision_states;
DROP TRIGGER recommendation_case_protected_revision_states_insert_guard ON lor_studio.recommendation_case_protected_revision_states;
DROP TRIGGER recommendation_case_write_receipts_append_only ON lor_studio.recommendation_case_write_receipts;
DROP TRIGGER recommendation_case_write_receipts_insert_guard ON lor_studio.recommendation_case_write_receipts;
DROP TRIGGER recommendation_cases_insert_guard ON lor_studio.recommendation_cases;
DROP TRIGGER recommendation_cases_update_guard ON lor_studio.recommendation_cases;
DROP TRIGGER released_student_documents_append_only ON lor_studio.released_student_documents;
DROP TRIGGER released_student_documents_insert_guard ON lor_studio.released_student_documents;
DROP TRIGGER student_auth_binding_revocations_append_only ON lor_studio.student_auth_binding_revocations;
DROP TRIGGER student_auth_bindings_append_only ON lor_studio.student_auth_bindings;
DROP TRIGGER waiver_receipts_append_only ON lor_studio.waiver_receipts;
DROP TRIGGER waiver_receipts_post_release_guard ON lor_studio.waiver_receipts;
DROP TRIGGER waiver_receipts_revision_guard ON lor_studio.waiver_receipts;
DROP TRIGGER writer_depot_artifacts_append_only ON lor_studio.writer_depot_artifacts;

DROP TABLE
  lor_studio.administrative_case_grant_revocations,
  lor_studio.administrative_case_grants,
  lor_studio.ai_generation_runs,
  lor_studio.ai_letter_proposals,
  lor_studio.ai_proposal_decisions,
  lor_studio.consent_receipts,
  lor_studio.deletion_hold_releases,
  lor_studio.deletion_intents,
  lor_studio.deletion_receipts,
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_challenge_revocations,
  lor_studio.faculty_otp_challenges,
  lor_studio.faculty_otp_proof_revocations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.faculty_private_content,
  lor_studio.mentor_case_assignment_revocations,
  lor_studio.mentor_case_assignments,
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_case_creation_reservations,
  lor_studio.recommendation_case_private_write_receipts,
  lor_studio.recommendation_case_protected_revision_states,
  lor_studio.recommendation_case_write_receipts,
  lor_studio.recommendation_cases,
  lor_studio.released_student_documents,
  lor_studio.student_auth_binding_revocations,
  lor_studio.student_auth_bindings,
  lor_studio.waiver_receipts,
  lor_studio.writer_depot_artifacts;

DROP FUNCTION
  lor_studio.ai_grounding_manifest_is_complete(jsonb),
  lor_studio.audit_event_is_metadata(jsonb),
  lor_studio.canonical_jsonb_sha256(jsonb),
  lor_studio.canonical_jsonb_text(jsonb),
  lor_studio.enforce_ai_generation_run_insert(),
  lor_studio.enforce_ai_letter_proposal_insert(),
  lor_studio.enforce_ai_proposal_decision_insert(),
  lor_studio.enforce_case_write_receipt_insert(),
  lor_studio.enforce_deletion_hold_release_audit_consumed(),
  lor_studio.enforce_deletion_hold_release_insert(),
  lor_studio.enforce_deletion_intent_insert(),
  lor_studio.enforce_deletion_receipt_insert(),
  lor_studio.enforce_faculty_invitation_update(),
  lor_studio.enforce_faculty_otp_challenge_insert(),
  lor_studio.enforce_faculty_otp_verification_receipt_insert(),
  lor_studio.enforce_faculty_private_content_insert(),
  lor_studio.enforce_faculty_private_content_update(),
  lor_studio.enforce_private_write_receipt_insert(),
  lor_studio.enforce_protected_revision_state_insert(),
  lor_studio.enforce_recommendation_case_insert(),
  lor_studio.enforce_recommendation_case_update(),
  lor_studio.enforce_released_student_document_insert(),
  lor_studio.enforce_revision_bound_student_receipt_insert(),
  lor_studio.private_record_is_complete(jsonb),
  lor_studio.protected_case_state_is_complete(jsonb, bigint),
  lor_studio.protected_state_chain_hash(text, text, bigint, text, text, jsonb),
  lor_studio.reject_append_only_mutation(),
  lor_studio.reject_waiver_after_student_release(),
  lor_studio.release_document_hash(text, text, text, text),
  lor_studio.student_record_is_safe(jsonb),
  lor_studio.text_array_is_sorted_unique(text[]);

DROP SCHEMA lor_studio;
DROP ROLE lor_studio_app;

DO $postcondition$
DECLARE
  migration_admin_oid oid := (
    SELECT role.oid FROM pg_catalog.pg_roles AS role WHERE role.rolname = current_user
  );
BEGIN
  IF (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'
  ) <> 0
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname LIKE 'lor_studio_%'
    ) <> 0
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_default_acl AS default_acl
      WHERE default_acl.defaclrole = migration_admin_oid
    ) <> 0
  THEN
    RAISE EXCEPTION 'DR-120 foundation rollback postcondition failed'
      USING ERRCODE = '55000';
  END IF;
END
$postcondition$;

COMMIT;
