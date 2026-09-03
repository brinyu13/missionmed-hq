-- Migration: 20260820180800_f2_lor_1012_rls_projection_grants.sql
-- Authority: F2-LOR-1012 / DR-120
-- Date: 2026-08-20
-- Depends on: 20260820180700_f2_lor_1012_schema_foundation.sql
-- Description: Force RLS, add exact resource-bound policies, publish safe projections, and grant the non-owner app role.
-- Idempotent: NO

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
  database_suffix := substring(
    pg_catalog.current_database()
    FROM '^lorh_db_([a-f0-9]{20})$'
  );
  admin_suffix := substring(current_user FROM '^lorh_admin_([a-f0-9]{20})$');
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
    'missionmed.lor.disposable-postgres-harness.v1|database=%s|admin=%s|root=%s|foundation=20260820180700',
    pg_catalog.current_database(),
    current_user,
    harness_root
  );

  IF database_suffix IS NULL
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
    RAISE EXCEPTION 'DR-120 RLS migration requires the exact sentinel-bound disposable Unix-socket harness identity'
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

DO $foundation_preflight$
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
    RAISE EXCEPTION 'DR-120 RLS foundation preflight role inventory mismatch'
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

  -- Bind forward custody to the full disposable schema semantics, not only
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
    RAISE EXCEPTION 'DR-120 RLS foundation preflight catalog or owner inventory mismatch'
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
    RAISE EXCEPTION 'DR-120 RLS foundation preflight ACL inventory mismatch'
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
      RAISE EXCEPTION 'DR-120 RLS foundation preflight refuses nonempty relation lor_studio.%', relation.relation_name
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
END
$foundation_preflight$;

REVOKE ALL ON SCHEMA lor_studio FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'lor_studio_command_owner'
  ) THEN
    RAISE EXCEPTION 'LOR command owner already exists; disposable RLS migration requires fresh custody'
      USING ERRCODE = '42710';
  END IF;

  CREATE ROLE lor_studio_command_owner
    NOLOGIN
    NOINHERIT
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    NOBYPASSRLS;
END
$$;

ALTER ROLE lor_studio_command_owner SET search_path = pg_catalog;

CREATE FUNCTION lor_studio.student_context_allows(
  resource_case_id text,
  resource_student_subject text,
  resource_student_uid uuid,
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
    AND pg_catalog.current_setting('lor_studio.actor_role', true) = 'student'
    AND pg_catalog.current_setting('lor_studio.student_auth_subject', true) = resource_student_subject
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) = resource_student_subject
    AND pg_catalog.current_setting('lor_studio.case_id', true) = resource_case_id
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (allowed_operations)
    -- UUID claims use the fail-closed shape NULLIF(current_setting_value /* absent or '' */, '')::uuid.
    AND NULLIF(
      pg_catalog.current_setting('request.jwt.claim.sub', true), ''
    )::uuid = resource_student_uid
    AND EXISTS (
      SELECT 1
      FROM lor_studio.student_auth_bindings AS binding
      WHERE binding.student_auth_subject = resource_student_subject
        AND binding.student_auth_uid = resource_student_uid
        AND binding.bound_at <= pg_catalog.statement_timestamp()
        AND (binding.expires_at IS NULL OR binding.expires_at > pg_catalog.statement_timestamp())
        AND NOT EXISTS (
          SELECT 1
          FROM lor_studio.student_auth_binding_revocations AS revocation
          WHERE revocation.binding_id = binding.binding_id
            AND revocation.student_auth_subject = binding.student_auth_subject
            AND revocation.student_auth_uid = binding.student_auth_uid
        )
    ),
    false
  );
$$;

CREATE FUNCTION lor_studio.student_write_axes_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true',
    false
  );
$$;

CREATE FUNCTION lor_studio.faculty_context_allows(
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

CREATE FUNCTION lor_studio.mentor_context_allows(
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
    AND pg_catalog.current_setting('lor_studio.actor_role', true) = 'mentor'
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) = resource_student_subject
    AND pg_catalog.current_setting('lor_studio.case_id', true) = resource_case_id
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (allowed_operations)
    AND EXISTS (
      SELECT 1
      FROM lor_studio.mentor_case_assignments AS assignment
      WHERE assignment.assignment_id = NULLIF(
          pg_catalog.current_setting('lor_studio.assignment_id', true), ''
        )
        AND assignment.case_id = resource_case_id
        AND assignment.student_auth_subject = resource_student_subject
        AND assignment.mentor_auth_subject = pg_catalog.current_setting(
          'lor_studio.student_auth_subject', true
        )
        AND assignment.mentor_auth_uid = NULLIF(
          pg_catalog.current_setting('request.jwt.claim.sub', true), ''
        )::uuid
        AND assignment.operation = pg_catalog.current_setting('lor_studio.operation', true)
        AND assignment.purpose = pg_catalog.current_setting('lor_studio.purpose', true)
        AND assignment.assigned_at <= pg_catalog.statement_timestamp()
        AND assignment.expires_at > pg_catalog.statement_timestamp()
        AND NOT EXISTS (
          SELECT 1
          FROM lor_studio.mentor_case_assignment_revocations AS revocation
          WHERE revocation.assignment_id = assignment.assignment_id
            AND revocation.case_id = assignment.case_id
            AND revocation.student_auth_subject = assignment.student_auth_subject
        )
    ),
    false
  );
$$;

CREATE FUNCTION lor_studio.operational_content_context_allows(
  resource_case_id text,
  resource_student_subject text,
  allowed_operations text[],
  allowed_grant_operations text[]
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
    AND pg_catalog.current_setting('lor_studio.actor_role', true) = ANY (
      ARRAY['admin', 'founder', 'support', 'service']::text[]
    )
    AND pg_catalog.current_setting('lor_studio.resource_student_id', true) = resource_student_subject
    AND pg_catalog.current_setting('lor_studio.case_id', true) = resource_case_id
    AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (allowed_operations)
    AND EXISTS (
      SELECT 1
      FROM lor_studio.administrative_case_grants AS administrative_grant
      WHERE administrative_grant.grant_id = NULLIF(
          pg_catalog.current_setting('lor_studio.administrative_grant_id', true), ''
        )
        AND administrative_grant.case_id = resource_case_id
        AND administrative_grant.student_auth_subject = resource_student_subject
        AND administrative_grant.grantee_auth_subject = pg_catalog.current_setting(
          'lor_studio.student_auth_subject', true
        )
        AND administrative_grant.grantee_auth_uid = NULLIF(
          pg_catalog.current_setting('request.jwt.claim.sub', true), ''
        )::uuid
        AND administrative_grant.purpose = pg_catalog.current_setting('lor_studio.purpose', true)
        -- The policy, not the caller, binds each relation/action to the exact
        -- named administrative capability classes that may reach it.  Never
        -- collapse a legal-hold, delivery-investigation, privacy, restore, or
        -- AI grant into a generic read/save content capability.
        AND administrative_grant.operation = ANY (allowed_grant_operations)
        AND administrative_grant.issued_at <= pg_catalog.statement_timestamp()
        AND administrative_grant.expires_at > pg_catalog.statement_timestamp()
        AND NOT EXISTS (
          SELECT 1
          FROM lor_studio.administrative_case_grant_revocations AS revocation
          WHERE revocation.grant_id = administrative_grant.grant_id
            AND revocation.case_id = administrative_grant.case_id
            AND revocation.student_auth_subject = administrative_grant.student_auth_subject
            AND revocation.grant_hash = administrative_grant.grant_hash
        )
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION lor_studio.student_context_allows(text, text, uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.student_write_axes_satisfied() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.faculty_context_allows(text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.mentor_context_allows(text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.operational_content_context_allows(text, text, text[], text[]) FROM PUBLIC;

ALTER TABLE lor_studio.student_auth_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.student_auth_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.student_auth_binding_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.student_auth_binding_revocations FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_cases FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_creation_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_creation_reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_protected_revision_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_protected_revision_states FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_write_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_write_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_challenge_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_challenge_revocations FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_verification_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_verification_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_proof_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_proof_revocations FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.consent_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.consent_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.waiver_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.waiver_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_private_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_private_content FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.released_student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.released_student_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_private_write_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_private_write_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.administrative_case_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.administrative_case_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.administrative_case_grant_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.administrative_case_grant_revocations FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.mentor_case_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.mentor_case_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.mentor_case_assignment_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.mentor_case_assignment_revocations FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.writer_depot_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.writer_depot_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_generation_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_letter_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_letter_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_proposal_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_proposal_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_intents FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_hold_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_hold_releases FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY student_auth_bindings_student_select
ON lor_studio.student_auth_bindings
FOR SELECT
TO lor_studio_app
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'student'
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
  AND student_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
);

CREATE POLICY student_auth_binding_revocations_student_select
ON lor_studio.student_auth_binding_revocations
FOR SELECT
TO lor_studio_app
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'student'
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
  AND student_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
);

CREATE POLICY recommendation_cases_student_select
ON lor_studio.recommendation_cases
FOR SELECT
TO lor_studio_app
USING (lor_studio.student_context_allows(
  case_id, student_auth_subject, student_auth_uid, ARRAY['read', 'create', 'save']::text[]
));

CREATE POLICY recommendation_cases_faculty_command_select
ON lor_studio.recommendation_cases
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY recommendation_cases_operational_select
ON lor_studio.recommendation_cases
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup',
    'create_ai_generation'
  ]::text[]
));

CREATE POLICY recommendation_cases_faculty_command_update
ON lor_studio.recommendation_cases
FOR UPDATE
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
))
WITH CHECK (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
));

CREATE POLICY recommendation_cases_operational_update
ON lor_studio.recommendation_cases
FOR UPDATE
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
))
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
));

CREATE POLICY case_creation_reservations_student_select
ON lor_studio.recommendation_case_creation_reservations
FOR SELECT
TO lor_studio_app
USING (
  pg_catalog.current_setting('transaction_isolation', true) = 'read committed'
  AND pg_catalog.current_setting('lor_studio.actor_role', true) = 'student'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'create'
  AND creation_ref = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
  AND student_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
  AND EXISTS (
    SELECT 1
    FROM lor_studio.student_auth_bindings AS binding
    WHERE binding.student_auth_subject = recommendation_case_creation_reservations.student_auth_subject
      AND binding.student_auth_uid = recommendation_case_creation_reservations.student_auth_uid
      AND binding.bound_at <= pg_catalog.statement_timestamp()
      AND (binding.expires_at IS NULL OR binding.expires_at > pg_catalog.statement_timestamp())
      AND NOT EXISTS (
        SELECT 1
        FROM lor_studio.student_auth_binding_revocations AS revocation
        WHERE revocation.binding_id = binding.binding_id
      )
  )
);

CREATE POLICY case_creation_reservations_student_insert
ON lor_studio.recommendation_case_creation_reservations
FOR INSERT
TO lor_studio_app
WITH CHECK (
  pg_catalog.current_setting('transaction_isolation', true) = 'read committed'
  AND pg_catalog.current_setting('lor_studio.actor_role', true) = 'student'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'create'
  AND creation_ref = pg_catalog.current_setting('lor_studio.case_id', true)
  AND lor_studio.student_write_axes_satisfied()
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
  AND student_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
  AND creation_ref = 'case_creation_' || lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.case-creation-key.v1',
      'actorId', student_auth_subject,
      'idempotencyKey', idempotency_key
    )
  )
  AND actor_ref = 'actor_' || pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to('lor-studio:actor:' || student_auth_subject, 'UTF8')
    ),
    'hex'
  )
  AND request_hash = lor_studio.canonical_jsonb_sha256(
    pg_catalog.jsonb_build_object(
      'operation', 'case.create',
      'actorId', student_auth_subject,
      'payload', '{}'::jsonb
    )
  )
  AND transaction_id = pg_catalog.pg_current_xact_id()::text
  AND reserved_at = pg_catalog.statement_timestamp()
  AND case_id <> builder_session_id
  AND EXISTS (
    SELECT 1
    FROM lor_studio.student_auth_bindings AS binding
    WHERE binding.student_auth_subject = recommendation_case_creation_reservations.student_auth_subject
      AND binding.student_auth_uid = recommendation_case_creation_reservations.student_auth_uid
      AND binding.bound_at <= pg_catalog.statement_timestamp()
      AND (binding.expires_at IS NULL OR binding.expires_at > pg_catalog.statement_timestamp())
      AND NOT EXISTS (
        SELECT 1
        FROM lor_studio.student_auth_binding_revocations AS revocation
        WHERE revocation.binding_id = binding.binding_id
      )
  )
);

CREATE POLICY protected_revision_states_faculty_command_select
ON lor_studio.recommendation_case_protected_revision_states
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY protected_revision_states_operational_select
ON lor_studio.recommendation_case_protected_revision_states
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup'
  ]::text[]
));

CREATE POLICY protected_revision_states_faculty_command_insert
ON lor_studio.recommendation_case_protected_revision_states
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
));

CREATE POLICY protected_revision_states_operational_insert
ON lor_studio.recommendation_case_protected_revision_states
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
));

CREATE POLICY faculty_invitations_faculty_command_select
ON lor_studio.faculty_invitations
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
  AND invitation_id = NULLIF(
    pg_catalog.current_setting('lor_studio.invitation_id', true), ''
  )
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
  AND faculty_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND faculty_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
  AND used_at IS NOT NULL
  AND revoked_at IS NULL
  AND expires_at > pg_catalog.statement_timestamp()
);

CREATE POLICY faculty_otp_verification_receipts_faculty_command_select
ON lor_studio.faculty_otp_verification_receipts
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
  AND invitation_id = NULLIF(
    pg_catalog.current_setting('lor_studio.invitation_id', true), ''
  )
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
  AND faculty_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND faculty_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
);

CREATE POLICY faculty_otp_proof_revocations_faculty_command_select
ON lor_studio.faculty_otp_proof_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
);

CREATE POLICY consent_receipts_student_select
ON lor_studio.consent_receipts
FOR SELECT
TO lor_studio_app
USING (lor_studio.student_context_allows(
  case_id, student_auth_subject, student_auth_uid, ARRAY['read', 'create', 'save']::text[]
));

CREATE POLICY consent_receipts_faculty_command_select
ON lor_studio.consent_receipts
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY consent_receipts_operational_select
ON lor_studio.consent_receipts
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup',
    'create_ai_generation'
  ]::text[]
));

CREATE POLICY waiver_receipts_student_select
ON lor_studio.waiver_receipts
FOR SELECT
TO lor_studio_app
USING (lor_studio.student_context_allows(
  case_id, student_auth_subject, student_auth_uid, ARRAY['read', 'create', 'save']::text[]
));

CREATE POLICY waiver_receipts_faculty_command_select
ON lor_studio.waiver_receipts
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY waiver_receipts_operational_select
ON lor_studio.waiver_receipts
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup',
    'create_ai_generation'
  ]::text[]
));

CREATE POLICY faculty_private_content_faculty_command_select
ON lor_studio.faculty_private_content
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY faculty_private_content_operational_select
ON lor_studio.faculty_private_content
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup'
  ]::text[]
));

CREATE POLICY faculty_private_content_operational_insert
ON lor_studio.faculty_private_content
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
));

CREATE POLICY faculty_private_content_faculty_command_update
ON lor_studio.faculty_private_content
FOR UPDATE
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
))
WITH CHECK (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
));

CREATE POLICY faculty_private_content_operational_update
ON lor_studio.faculty_private_content
FOR UPDATE
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
))
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
));

CREATE POLICY released_student_documents_student_select
ON lor_studio.released_student_documents
FOR SELECT
TO lor_studio_app
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
  AND EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = released_student_documents.case_id
      AND recommendation_case.student_auth_subject = released_student_documents.student_auth_subject
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['read', 'create', 'save']::text[]
      )
  )
);

-- The student waiver command owns no released-document mutation capability;
-- it receives this exact read only so the append trigger can prove that waiver
-- history is frozen once a student-visible document exists.
CREATE POLICY released_student_documents_student_command_select
ON lor_studio.released_student_documents
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = released_student_documents.case_id
      AND recommendation_case.student_auth_subject =
        released_student_documents.student_auth_subject
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['save']::text[]
      )
  )
);

CREATE POLICY released_student_documents_faculty_command_select
ON lor_studio.released_student_documents
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY released_student_documents_operational_select
ON lor_studio.released_student_documents
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'investigate_delivery_failure',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup'
  ]::text[]
));

CREATE POLICY released_student_documents_faculty_command_insert
ON lor_studio.released_student_documents
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
));

CREATE POLICY released_student_documents_operational_insert
ON lor_studio.released_student_documents
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
));

CREATE POLICY private_write_receipts_faculty_command_select
ON lor_studio.recommendation_case_private_write_receipts
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY private_write_receipts_operational_select
ON lor_studio.recommendation_case_private_write_receipts
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup'
  ]::text[]
));

CREATE POLICY private_write_receipts_faculty_command_insert
ON lor_studio.recommendation_case_private_write_receipts
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
));

CREATE POLICY recommendation_case_audit_events_faculty_command_select
ON lor_studio.recommendation_case_audit_events
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY recommendation_case_audit_events_faculty_command_insert
ON lor_studio.recommendation_case_audit_events
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
));

-- A legal-hold release is an operational, case-scoped transaction rather than
-- one of the frozen eight public command surfaces.  The app role may see and
-- create only the one metadata audit row that the same-transaction release
-- trigger consumes, under the exact named privacy-authority grant.
CREATE POLICY recommendation_case_audit_events_legal_hold_select
ON lor_studio.recommendation_case_audit_events
FOR SELECT
TO lor_studio_app
USING (
  event_type = 'deletion.hold_released'
  AND actor_role = pg_catalog.current_setting('lor_studio.actor_role', true)
  AND actor_ref = 'actor_' || pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      'lor-studio:actor:' || pg_catalog.current_setting(
        'lor_studio.student_auth_subject', true
      ),
      'UTF8'
    )),
    'hex'
  )
  AND transaction_id = pg_catalog.pg_current_xact_id()::text
  AND lor_studio.operational_content_context_allows(
    case_id,
    student_auth_subject,
    ARRAY['read', 'save']::text[],
    ARRAY['release_deletion_legal_hold']::text[]
  )
);

CREATE POLICY recommendation_case_audit_events_legal_hold_insert
ON lor_studio.recommendation_case_audit_events
FOR INSERT
TO lor_studio_app
WITH CHECK (
  event_type = 'deletion.hold_released'
  AND outcome = 'success'
  -- Operational retention events do not advance the recommendation-case
  -- aggregate revision.  Zero is the only truthful non-aggregate sentinel;
  -- arbitrary or stale case revisions are rejected.
  AND revision = 0
  AND actor_role = pg_catalog.current_setting('lor_studio.actor_role', true)
  AND actor_ref = 'actor_' || pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      'lor-studio:actor:' || pg_catalog.current_setting(
        'lor_studio.student_auth_subject', true
      ),
      'UTF8'
    )),
    'hex'
  )
  AND case_ref = 'case_' || pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to('lor-studio:case:' || case_id, 'UTF8')),
    'hex'
  )
  AND transaction_id = pg_catalog.pg_current_xact_id()::text
  AND event_hash = lor_studio.canonical_jsonb_sha256(event)
  AND occurred_at <= pg_catalog.statement_timestamp()
  AND lor_studio.operational_content_context_allows(
    case_id,
    student_auth_subject,
    ARRAY['save']::text[],
    ARRAY['release_deletion_legal_hold']::text[]
  )
);

CREATE POLICY private_write_receipts_operational_insert
ON lor_studio.recommendation_case_private_write_receipts
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
));

-- Authority-ledger policies are deliberately direct GUC predicates. The context
-- helpers query these FORCE-RLS tables, so calling the corresponding helper here
-- would recurse and fail closed for every otherwise-authorized request.
CREATE POLICY administrative_case_grants_bound_principal_select
ON lor_studio.administrative_case_grants
FOR SELECT
TO lor_studio_app
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = ANY (
    ARRAY['admin', 'founder', 'support', 'service']::text[]
  )
  AND grant_id = NULLIF(
    pg_catalog.current_setting('lor_studio.administrative_grant_id', true), ''
  )
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
  AND grantee_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND grantee_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
  AND purpose = pg_catalog.current_setting('lor_studio.purpose', true)
  AND (
    (
      pg_catalog.current_setting('lor_studio.operation', true) = 'read'
      AND operation IN (
        'export_case_for_privacy_request',
        'investigate_delivery_failure',
        'read_case_content_for_privacy_request',
        'read_operational_case_metadata',
        'emergency_operational_case_metadata_break_glass'
      )
    )
    OR (
      pg_catalog.current_setting('lor_studio.operation', true) = 'save'
      AND operation IN (
        'restore_case_from_verified_backup',
        'release_deletion_legal_hold',
        'create_ai_generation'
      )
    )
  )
  AND issued_at <= pg_catalog.statement_timestamp()
  AND expires_at > pg_catalog.statement_timestamp()
);

CREATE POLICY administrative_case_grant_revocations_bound_principal_select
ON lor_studio.administrative_case_grant_revocations
FOR SELECT
TO lor_studio_app
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = ANY (
    ARRAY['admin', 'founder', 'support', 'service']::text[]
  )
  AND grant_id = NULLIF(
    pg_catalog.current_setting('lor_studio.administrative_grant_id', true), ''
  )
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
);

CREATE POLICY mentor_case_assignments_bound_principal_select
ON lor_studio.mentor_case_assignments
FOR SELECT
TO lor_studio_app
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'mentor'
  AND assignment_id = NULLIF(
    pg_catalog.current_setting('lor_studio.assignment_id', true), ''
  )
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
  AND mentor_auth_subject = pg_catalog.current_setting('lor_studio.student_auth_subject', true)
  AND mentor_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
  AND operation = pg_catalog.current_setting('lor_studio.operation', true)
  AND purpose = pg_catalog.current_setting('lor_studio.purpose', true)
  AND assigned_at <= pg_catalog.statement_timestamp()
  AND expires_at > pg_catalog.statement_timestamp()
);

CREATE POLICY mentor_case_assignment_revocations_bound_principal_select
ON lor_studio.mentor_case_assignment_revocations
FOR SELECT
TO lor_studio_app
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'mentor'
  AND assignment_id = NULLIF(
    pg_catalog.current_setting('lor_studio.assignment_id', true), ''
  )
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting('lor_studio.resource_student_id', true)
);

CREATE POLICY writer_depot_artifacts_faculty_select
ON lor_studio.writer_depot_artifacts
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY writer_depot_artifacts_operational_select
ON lor_studio.writer_depot_artifacts
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup'
  ]::text[]
));

CREATE POLICY writer_depot_artifacts_faculty_insert
ON lor_studio.writer_depot_artifacts
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
));

CREATE POLICY writer_depot_artifacts_operational_insert
ON lor_studio.writer_depot_artifacts
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
));

CREATE POLICY ai_generation_runs_faculty_select
ON lor_studio.ai_generation_runs
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY ai_generation_runs_operational_select
ON lor_studio.ai_generation_runs
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup',
    'create_ai_generation'
  ]::text[]
));

CREATE POLICY ai_generation_runs_faculty_insert
ON lor_studio.ai_generation_runs
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
));

CREATE POLICY ai_generation_runs_operational_insert
ON lor_studio.ai_generation_runs
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY[
    'restore_case_from_verified_backup',
    'create_ai_generation'
  ]::text[]
));

CREATE POLICY ai_letter_proposals_faculty_select
ON lor_studio.ai_letter_proposals
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY ai_letter_proposals_operational_select
ON lor_studio.ai_letter_proposals
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup',
    'create_ai_generation'
  ]::text[]
));

CREATE POLICY ai_letter_proposals_faculty_insert
ON lor_studio.ai_letter_proposals
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
));

CREATE POLICY ai_letter_proposals_operational_insert
ON lor_studio.ai_letter_proposals
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY[
    'restore_case_from_verified_backup',
    'create_ai_generation'
  ]::text[]
));

CREATE POLICY ai_proposal_decisions_faculty_select
ON lor_studio.ai_proposal_decisions
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['read', 'save']::text[]
));

CREATE POLICY ai_proposal_decisions_operational_select
ON lor_studio.ai_proposal_decisions
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup'
  ]::text[]
));

CREATE POLICY ai_proposal_decisions_faculty_insert
ON lor_studio.ai_proposal_decisions
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (lor_studio.faculty_context_allows(
  case_id, student_auth_subject, ARRAY['save']::text[]
));

CREATE POLICY ai_proposal_decisions_operational_insert
ON lor_studio.ai_proposal_decisions
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
));

CREATE POLICY deletion_intents_student_select
ON lor_studio.deletion_intents
FOR SELECT
TO lor_studio_app
USING (
  EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = deletion_intents.case_id
      AND recommendation_case.student_auth_subject = deletion_intents.student_auth_subject
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['read', 'save']::text[]
      )
  )
);

CREATE POLICY deletion_intents_operational_select
ON lor_studio.deletion_intents
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup',
    'release_deletion_legal_hold'
  ]::text[]
));

CREATE POLICY deletion_intents_student_insert
ON lor_studio.deletion_intents
FOR INSERT
TO lor_studio_app
WITH CHECK (
  lor_studio.student_write_axes_satisfied()
  AND EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = deletion_intents.case_id
      AND recommendation_case.student_auth_subject = deletion_intents.student_auth_subject
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['save']::text[]
      )
  )
);

CREATE POLICY deletion_intents_operational_insert
ON lor_studio.deletion_intents
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
));

CREATE POLICY deletion_hold_releases_operational_select
ON lor_studio.deletion_hold_releases
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup',
    'release_deletion_legal_hold'
  ]::text[]
));

CREATE POLICY deletion_hold_releases_operational_insert
ON lor_studio.deletion_hold_releases
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['release_deletion_legal_hold']::text[]
));

CREATE POLICY deletion_receipts_student_select
ON lor_studio.deletion_receipts
FOR SELECT
TO lor_studio_app
USING (
  EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = deletion_receipts.case_id
      AND recommendation_case.student_auth_subject = deletion_receipts.student_auth_subject
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['read', 'save']::text[]
      )
  )
);

CREATE POLICY deletion_receipts_operational_select
ON lor_studio.deletion_receipts
FOR SELECT
TO lor_studio_app
USING (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['read', 'save']::text[],
  ARRAY[
    'export_case_for_privacy_request',
    'read_case_content_for_privacy_request',
    'restore_case_from_verified_backup'
  ]::text[]
));

CREATE POLICY deletion_receipts_operational_insert
ON lor_studio.deletion_receipts
FOR INSERT
TO lor_studio_app
WITH CHECK (lor_studio.operational_content_context_allows(
  case_id,
  student_auth_subject,
  ARRAY['save']::text[],
  ARRAY['restore_case_from_verified_backup']::text[]
));

-- The five student commands share one invoker helper so their public ABI stays
-- small and reviewable.  The helper is not granted to the application role;
-- it executes as lor_studio_command_owner only when one of the allowlisted
-- SECURITY DEFINER wrappers invokes it.  Exact replay is resolved before any
-- candidate validation so a valid retry cannot be invalidated by later client
-- reconstruction, while a reused key with different bytes fails closed.
CREATE POLICY student_auth_bindings_command_select
ON lor_studio.student_auth_bindings
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'student'
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND student_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
  AND bound_at <= pg_catalog.statement_timestamp()
  AND (expires_at IS NULL OR expires_at > pg_catalog.statement_timestamp())
);

CREATE POLICY student_auth_binding_revocations_command_select
ON lor_studio.student_auth_binding_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'student'
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND student_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
);

CREATE POLICY recommendation_cases_student_command_select
ON lor_studio.recommendation_cases
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.student_context_allows(
  case_id,
  student_auth_subject,
  student_auth_uid,
  ARRAY['read', 'create', 'save']::text[]
));

CREATE POLICY recommendation_cases_student_command_insert
ON lor_studio.recommendation_cases
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  lor_studio.student_write_axes_satisfied()
  AND lor_studio.student_context_allows(
    case_id, student_auth_subject, student_auth_uid, ARRAY['create']::text[]
  )
);

CREATE POLICY recommendation_cases_student_command_update
ON lor_studio.recommendation_cases
FOR UPDATE
TO lor_studio_command_owner
USING (lor_studio.student_context_allows(
  case_id, student_auth_subject, student_auth_uid, ARRAY['save']::text[]
))
WITH CHECK (
  lor_studio.student_write_axes_satisfied()
  AND lor_studio.student_context_allows(
    case_id, student_auth_subject, student_auth_uid, ARRAY['save']::text[]
  )
);

CREATE POLICY case_creation_reservations_student_command_select
ON lor_studio.recommendation_case_creation_reservations
FOR SELECT
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'student'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'create'
  AND lor_studio.student_write_axes_satisfied()
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND student_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
);

-- PostgreSQL applies UPDATE RLS visibility to SELECT ... FOR UPDATE.  This
-- policy exposes the exact trusted reservation solely for serialization while
-- making every attempted replacement row fail its WITH CHECK predicate.
CREATE POLICY case_creation_reservations_student_command_lock
ON lor_studio.recommendation_case_creation_reservations
FOR UPDATE
TO lor_studio_command_owner
USING (
  pg_catalog.current_setting('lor_studio.actor_role', true) = 'student'
  AND pg_catalog.current_setting('lor_studio.operation', true) = 'create'
  AND lor_studio.student_write_axes_satisfied()
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND student_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
)
WITH CHECK (false);

CREATE POLICY recommendation_case_audit_events_student_command_select
ON lor_studio.recommendation_case_audit_events
FOR SELECT
TO lor_studio_command_owner
USING (
  actor_role = 'student'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = recommendation_case_audit_events.case_id
      AND recommendation_case.student_auth_subject =
        recommendation_case_audit_events.student_auth_subject
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['create', 'save']::text[]
      )
  )
);

CREATE POLICY recommendation_case_audit_events_student_command_insert
ON lor_studio.recommendation_case_audit_events
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  actor_role = 'student'
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = recommendation_case_audit_events.case_id
      AND recommendation_case.student_auth_subject =
        recommendation_case_audit_events.student_auth_subject
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['create', 'save']::text[]
      )
  )
);

CREATE POLICY protected_revision_states_student_command_select
ON lor_studio.recommendation_case_protected_revision_states
FOR SELECT
TO lor_studio_command_owner
USING (
  EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = recommendation_case_protected_revision_states.case_id
      AND recommendation_case.student_auth_subject =
        recommendation_case_protected_revision_states.student_auth_subject
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['create', 'save']::text[]
      )
  )
);

CREATE POLICY protected_revision_states_student_command_insert
ON lor_studio.recommendation_case_protected_revision_states
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  lor_studio.student_write_axes_satisfied()
  AND EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = recommendation_case_protected_revision_states.case_id
      AND recommendation_case.student_auth_subject =
        recommendation_case_protected_revision_states.student_auth_subject
      AND recommendation_case.revision = recommendation_case_protected_revision_states.revision
      AND recommendation_case.protected_state_hash =
        recommendation_case_protected_revision_states.protected_state_hash
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['create', 'save']::text[]
      )
  )
);

CREATE POLICY recommendation_case_write_receipts_student_command_select
ON lor_studio.recommendation_case_write_receipts
FOR SELECT
TO lor_studio_command_owner
USING (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND student_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
  AND EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = recommendation_case_write_receipts.case_id
      AND recommendation_case.student_auth_subject =
        recommendation_case_write_receipts.student_auth_subject
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['create', 'save']::text[]
      )
  )
);

CREATE POLICY recommendation_case_write_receipts_student_command_insert
ON lor_studio.recommendation_case_write_receipts
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND student_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
  AND lor_studio.student_write_axes_satisfied()
  AND EXISTS (
    SELECT 1
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = recommendation_case_write_receipts.case_id
      AND recommendation_case.student_auth_subject =
        recommendation_case_write_receipts.student_auth_subject
      AND recommendation_case.revision = recommendation_case_write_receipts.revision
      AND lor_studio.student_context_allows(
        recommendation_case.case_id,
        recommendation_case.student_auth_subject,
        recommendation_case.student_auth_uid,
        ARRAY['create', 'save']::text[]
      )
  )
);

CREATE POLICY consent_receipts_student_command_select
ON lor_studio.consent_receipts
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.student_context_allows(
  case_id,
  student_auth_subject,
  student_auth_uid,
  ARRAY['create', 'save']::text[]
));

CREATE POLICY consent_receipts_student_command_insert
ON lor_studio.consent_receipts
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  lor_studio.student_write_axes_satisfied()
  AND lor_studio.student_context_allows(
    case_id, student_auth_subject, student_auth_uid, ARRAY['save']::text[]
  )
);

CREATE POLICY waiver_receipts_student_command_select
ON lor_studio.waiver_receipts
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.student_context_allows(
  case_id,
  student_auth_subject,
  student_auth_uid,
  ARRAY['create', 'save']::text[]
));

CREATE POLICY waiver_receipts_student_command_insert
ON lor_studio.waiver_receipts
FOR INSERT
TO lor_studio_command_owner
WITH CHECK (
  lor_studio.student_write_axes_satisfied()
  AND lor_studio.student_context_allows(
    case_id, student_auth_subject, student_auth_uid, ARRAY['save']::text[]
  )
);

CREATE POLICY recommendation_cases_mentor_command_select
ON lor_studio.recommendation_cases
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.mentor_context_allows(
  case_id, student_auth_subject, ARRAY['read']::text[]
));

CREATE POLICY protected_revision_states_mentor_command_select
ON lor_studio.recommendation_case_protected_revision_states
FOR SELECT
TO lor_studio_command_owner
USING (lor_studio.mentor_context_allows(
  case_id, student_auth_subject, ARRAY['read']::text[]
));

CREATE POLICY mentor_case_assignments_command_select
ON lor_studio.mentor_case_assignments
FOR SELECT
TO lor_studio_command_owner
USING (
  assignment_id = pg_catalog.current_setting('lor_studio.assignment_id', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
  AND mentor_auth_subject = pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  )
  AND mentor_auth_uid = NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid
  AND operation = pg_catalog.current_setting('lor_studio.operation', true)
  AND purpose = pg_catalog.current_setting('lor_studio.purpose', true)
);

CREATE POLICY mentor_case_assignment_revocations_command_select
ON lor_studio.mentor_case_assignment_revocations
FOR SELECT
TO lor_studio_command_owner
USING (
  assignment_id = pg_catalog.current_setting('lor_studio.assignment_id', true)
  AND case_id = pg_catalog.current_setting('lor_studio.case_id', true)
  AND student_auth_subject = pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  )
);

CREATE FUNCTION lor_studio.commit_student_case_command(
  candidate_state jsonb,
  candidate_expected_revision bigint,
  candidate_command_type text,
  candidate_action text,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_event jsonb,
  candidate_event_hash text,
  candidate_version_entry jsonb,
  candidate_receipt_type text,
  candidate_receipt jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $student_command$
DECLARE
  scope_case_id text := pg_catalog.current_setting('lor_studio.case_id', true);
  scope_student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  );
  scope_student_uid uuid := NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true), ''
  )::uuid;
  command_operation text;
  expected_event_type text;
  replay_receipt lor_studio.recommendation_case_write_receipts%ROWTYPE;
  creation_reservation lor_studio.recommendation_case_creation_reservations%ROWTYPE;
  current_case lor_studio.recommendation_cases%ROWTYPE;
  previous_protected lor_studio.recommendation_case_protected_revision_states%ROWTYPE;
  safe_record jsonb;
  safe_record_hash text;
  protected_state jsonb;
  new_protected_state_hash text;
  persisted_consent_receipts jsonb;
  persisted_waiver_receipts jsonb;
  persisted_state jsonb;
  expected_version_changes jsonb;
  expected_changed_fields jsonb;
  derived_creation_ref text;
  derived_actor_ref text;
  transaction_id text := pg_catalog.pg_current_xact_id()::text;
  event_revision bigint;
  candidate_revision bigint;
  candidate_created_at timestamptz;
  candidate_updated_at timestamptz;
  candidate_closed_at timestamptz;
  receipt_recorded_at timestamptz;
  released_snapshot_hash text;
BEGIN
  IF candidate_command_type = 'student.case.create'
     AND candidate_action = 'case.create' THEN
    command_operation := 'create';
    expected_event_type := 'case.created';
  ELSIF candidate_command_type = 'student.builder.autosave'
        AND candidate_action = 'builder.autosave' THEN
    command_operation := 'save';
    expected_event_type := 'builder.autosaved';
  ELSIF candidate_command_type = 'student.builder.complete'
        AND candidate_action = 'builder.complete_step' THEN
    command_operation := 'save';
    expected_event_type := 'builder.step_completed';
  ELSIF candidate_command_type = 'student.consent.record'
        AND candidate_action = 'consent.record' THEN
    command_operation := 'save';
    expected_event_type := 'consent.recorded';
  ELSIF candidate_command_type = 'student.waiver.record'
        AND candidate_action = 'waiver.record' THEN
    command_operation := 'save';
    expected_event_type := 'waiver.recorded';
  ELSE
    RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
  END IF;

  -- Authorization is established from trusted transaction-local state before
  -- an idempotency lookup can disclose whether a receipt exists.  Candidate
  -- bytes remain intentionally unexamined until after an exact replay check.
  IF scope_case_id IS NULL
     OR scope_student_subject IS NULL
     OR scope_student_uid IS NULL
     OR pg_catalog.current_setting('lor_studio.actor_role', true) <> 'student'
     OR pg_catalog.current_setting('lor_studio.operation', true) <> command_operation
     OR NOT lor_studio.student_write_axes_satisfied()
     OR NOT lor_studio.student_context_allows(
       scope_case_id,
       scope_student_subject,
       scope_student_uid,
       ARRAY[command_operation]::text[]
     ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P1004', MESSAGE = 'LOR_AUTHORIZATION_DENIED';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1', scope_case_id, scope_student_subject
    )::text,
    0
  ));

  SELECT receipt.*
    INTO replay_receipt
  FROM lor_studio.recommendation_case_write_receipts AS receipt
  WHERE receipt.case_id = scope_case_id
    AND receipt.student_auth_subject = scope_student_subject
    AND receipt.idempotency_key = candidate_idempotency_key;

  IF FOUND THEN
    IF replay_receipt.request_hash IS DISTINCT FROM candidate_request_hash
       OR replay_receipt.command_type IS DISTINCT FROM candidate_command_type THEN
      RAISE EXCEPTION USING ERRCODE = 'P1003', MESSAGE = 'LOR_IDEMPOTENCY_CONFLICT';
    END IF;

    SELECT COALESCE(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.consent-receipt.v1',
        'id', consent.receipt_id,
        'caseId', consent.case_id,
        'actorId', consent.student_auth_subject,
        'scopes', pg_catalog.to_jsonb(consent.scopes),
        'policyVersion', consent.policy_version,
        'recordedAt', pg_catalog.to_char(
          consent.recorded_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'receiptHash', consent.receipt_hash
      ) ORDER BY consent.case_revision, consent.recorded_at, consent.receipt_id
    ), '[]'::jsonb)
      INTO persisted_consent_receipts
    FROM lor_studio.consent_receipts AS consent
    WHERE consent.case_id = replay_receipt.case_id
      AND consent.student_auth_subject = replay_receipt.student_auth_subject
      AND consent.case_revision <= replay_receipt.revision;

    SELECT COALESCE(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.waiver-receipt.v1',
        'id', waiver.receipt_id,
        'caseId', waiver.case_id,
        'actorId', waiver.student_auth_subject,
        'waived', waiver.waived,
        'policyVersion', waiver.policy_version,
        'priorReceiptId', waiver.prior_receipt_id,
        'acknowledgment', waiver.acknowledgment,
        'recordedAt', pg_catalog.to_char(
          waiver.recorded_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'receiptHash', waiver.receipt_hash
      ) ORDER BY waiver.case_revision, waiver.recorded_at, waiver.receipt_id
    ), '[]'::jsonb)
      INTO persisted_waiver_receipts
    FROM lor_studio.waiver_receipts AS waiver
    WHERE waiver.case_id = replay_receipt.case_id
      AND waiver.student_auth_subject = replay_receipt.student_auth_subject
      AND waiver.case_revision <= replay_receipt.revision;

    persisted_state := pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.student-safe-case.v1',
      'id', replay_receipt.case_id,
      'studentId', replay_receipt.student_auth_subject,
      'status', replay_receipt.status,
      'revision', replay_receipt.revision,
      'createdAt', pg_catalog.to_char(
        replay_receipt.created_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'updatedAt', pg_catalog.to_char(
        replay_receipt.updated_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'closedAt', CASE WHEN replay_receipt.closed_at IS NULL THEN NULL ELSE pg_catalog.to_char(
        replay_receipt.closed_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) END,
      'builder', replay_receipt.record -> 'builder',
      'studentEvidence', replay_receipt.record -> 'studentEvidence',
      'applicantOptions', replay_receipt.record -> 'applicantOptions',
      'consentReceipts', persisted_consent_receipts,
      'waiverReceipts', persisted_waiver_receipts,
      'delivery', replay_receipt.record -> 'delivery',
      'releasedDocument', NULL
    );

    RETURN pg_catalog.jsonb_build_object(
      'schemaVersion', 'missionmed.lor.atomic-command-receipt.v2',
      'action', candidate_action,
      'committed', true,
      'replayed', true,
      'sameTransaction', true,
      'caseId', replay_receipt.case_id,
      'studentId', replay_receipt.student_auth_subject,
      'revision', replay_receipt.revision,
      'idempotencyKey', replay_receipt.idempotency_key,
      'requestHash', replay_receipt.request_hash,
      'safeRecordHash', replay_receipt.record_hash,
      'protectedStateHash', replay_receipt.protected_state_hash,
      'eventHash', replay_receipt.event_hash,
      'auditEventRef', replay_receipt.audit_event_ref,
      'transactionId', replay_receipt.transaction_id,
      'state', persisted_state
    );
  END IF;

  IF pg_catalog.jsonb_typeof(candidate_state) <> 'object'
     OR candidate_state ->> 'schemaVersion' <> 'missionmed.lor.student-safe-case.v1'
     OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(candidate_state)) <> 15
     OR NOT candidate_state ?& ARRAY[
       'schemaVersion', 'id', 'studentId', 'status', 'revision', 'createdAt',
       'updatedAt', 'closedAt', 'builder', 'studentEvidence', 'applicantOptions',
       'consentReceipts', 'waiverReceipts', 'delivery', 'releasedDocument'
     ]::text[]
     OR candidate_state ->> 'id' IS DISTINCT FROM scope_case_id
     OR candidate_state ->> 'studentId' IS DISTINCT FROM scope_student_subject
     OR pg_catalog.jsonb_typeof(candidate_state -> 'revision') <> 'number'
     OR (candidate_state ->> 'revision') !~ '^(0|[1-9][0-9]*)$'
     OR candidate_state -> 'releasedDocument' <> 'null'::jsonb
     OR pg_catalog.jsonb_typeof(candidate_event) <> 'object'
     OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(candidate_event)) <> 10
     OR NOT candidate_event ?& ARRAY[
       'schemaVersion', 'eventRef', 'eventType', 'caseRef', 'actorRef',
       'actorRole', 'correlationRef', 'outcome', 'revision', 'occurredAt'
     ]::text[]
     OR pg_catalog.jsonb_typeof(candidate_version_entry) <> 'object'
     OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(candidate_version_entry)) <> 6
     OR NOT candidate_version_entry ?& ARRAY[
       'revision', 'eventType', 'actorId', 'occurredAt', 'changedFields', 'changeHash'
     ]::text[]
     OR candidate_request_hash !~ '^[a-f0-9]{64}$'
     OR candidate_event_hash !~ '^[a-f0-9]{64}$'
     OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
  END IF;

  candidate_revision := (candidate_state ->> 'revision')::bigint;
  candidate_created_at := (candidate_state ->> 'createdAt')::timestamptz;
  candidate_updated_at := (candidate_state ->> 'updatedAt')::timestamptz;
  candidate_closed_at := CASE
    WHEN candidate_state -> 'closedAt' = 'null'::jsonb THEN NULL
    ELSE (candidate_state ->> 'closedAt')::timestamptz
  END;
  event_revision := (candidate_event ->> 'revision')::bigint;

  safe_record := pg_catalog.jsonb_build_object(
    'builder', candidate_state -> 'builder',
    'studentEvidence', candidate_state -> 'studentEvidence',
    'applicantOptions', candidate_state -> 'applicantOptions',
    'delivery', candidate_state -> 'delivery'
  );
  safe_record_hash := lor_studio.canonical_jsonb_sha256(safe_record);

  expected_version_changes := CASE candidate_command_type
    WHEN 'student.case.create' THEN pg_catalog.jsonb_build_object(
      'status', 'draft', 'studentId', scope_student_subject
    )
    WHEN 'student.builder.autosave' THEN pg_catalog.jsonb_build_object(
      'builder', candidate_state -> 'builder'
    )
    WHEN 'student.builder.complete' THEN pg_catalog.jsonb_build_object(
      'builder', candidate_state -> 'builder'
    )
    WHEN 'student.consent.record' THEN pg_catalog.jsonb_build_object(
      'consentReceipts', candidate_state -> 'consentReceipts'
    )
    WHEN 'student.waiver.record' THEN pg_catalog.jsonb_build_object(
      'waiverReceipts', candidate_state -> 'waiverReceipts'
    )
  END;
  expected_changed_fields := CASE candidate_command_type
    WHEN 'student.case.create' THEN '["status", "studentId"]'::jsonb
    WHEN 'student.builder.autosave' THEN '["builder"]'::jsonb
    WHEN 'student.builder.complete' THEN '["builder"]'::jsonb
    WHEN 'student.consent.record' THEN '["consentReceipts"]'::jsonb
    WHEN 'student.waiver.record' THEN '["waiverReceipts"]'::jsonb
  END;

  IF NOT lor_studio.student_record_is_safe(safe_record)
     OR lor_studio.canonical_jsonb_sha256(candidate_event) <> candidate_event_hash
     OR candidate_event ->> 'schemaVersion' <> 'missionmed.lor.service-event.v1'
     OR candidate_event ->> 'eventType' <> expected_event_type
     OR candidate_event ->> 'actorRole' <> 'student'
     OR candidate_event ->> 'outcome' <> 'success'
     OR event_revision <> candidate_revision
     OR (candidate_event ->> 'occurredAt')::timestamptz <> candidate_updated_at
     OR candidate_event ->> 'caseRef' <> 'case_' || pg_catalog.encode(
       pg_catalog.sha256(pg_catalog.convert_to('lor-studio:case:' || scope_case_id, 'UTF8')),
       'hex'
     )
     OR candidate_event ->> 'actorRef' <> 'actor_' || pg_catalog.encode(
       pg_catalog.sha256(
         pg_catalog.convert_to('lor-studio:actor:' || scope_student_subject, 'UTF8')
       ),
       'hex'
     )
     OR candidate_version_entry ->> 'eventType' <> expected_event_type
     OR candidate_version_entry ->> 'actorId' <> scope_student_subject
     OR (candidate_version_entry ->> 'revision')::bigint <> candidate_revision
     OR (candidate_version_entry ->> 'occurredAt')::timestamptz <> candidate_updated_at
     OR candidate_version_entry -> 'changedFields' IS DISTINCT FROM expected_changed_fields
     OR candidate_version_entry ->> 'changeHash'
        IS DISTINCT FROM lor_studio.canonical_jsonb_sha256(expected_version_changes) THEN
    RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
  END IF;

  IF command_operation = 'create' THEN
    IF candidate_expected_revision IS NOT NULL
       OR candidate_revision <> 0
       OR candidate_state ->> 'status' <> 'draft'
       OR candidate_created_at <> candidate_updated_at
       OR candidate_closed_at IS NOT NULL
       OR candidate_state -> 'builder' -> 'completedStepIds' <> '[]'::jsonb
       OR candidate_state -> 'builder' ->> 'currentStepId' <> 'case_basics'
       OR candidate_state -> 'builder' -> 'stepData' <> '{}'::jsonb
       OR candidate_state -> 'builder' -> 'autosavedAt' <> 'null'::jsonb
       OR candidate_state -> 'studentEvidence' <> '[]'::jsonb
       OR candidate_state -> 'applicantOptions' <> '[]'::jsonb
       OR candidate_state -> 'consentReceipts' <> '[]'::jsonb
       OR candidate_state -> 'waiverReceipts' <> '[]'::jsonb
       OR candidate_state -> 'delivery' IS DISTINCT FROM pg_catalog.jsonb_build_object(
         'status', 'not_started',
         'destinationClass', NULL,
         'deliveredAt', NULL
       )
       OR candidate_receipt_type IS NOT NULL
       OR candidate_receipt IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
    END IF;

    derived_actor_ref := 'actor_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to('lor-studio:actor:' || scope_student_subject, 'UTF8')
      ),
      'hex'
    );
    derived_creation_ref := 'case_creation_' || lor_studio.canonical_jsonb_sha256(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.case-creation-key.v1',
        'actorId', scope_student_subject,
        'idempotencyKey', candidate_idempotency_key
      )
    );

    -- Serialize every create using the exact durable reservation that minted
    -- the identifiers.  The reservation request hash intentionally describes
    -- the reservation request, not the later commit candidate.
    SELECT reservation.*
      INTO creation_reservation
    FROM lor_studio.recommendation_case_creation_reservations AS reservation
    WHERE reservation.creation_ref = derived_creation_ref
      AND reservation.student_auth_subject = scope_student_subject
      AND reservation.student_auth_uid = scope_student_uid
      AND reservation.actor_ref = derived_actor_ref
      AND reservation.idempotency_key = candidate_idempotency_key
    FOR UPDATE;

    IF NOT FOUND
       OR creation_reservation.case_id IS DISTINCT FROM scope_case_id
       OR creation_reservation.builder_session_id
          IS DISTINCT FROM candidate_state -> 'builder' ->> 'sessionId'
       OR creation_reservation.created_at IS DISTINCT FROM candidate_created_at THEN
      RAISE EXCEPTION USING ERRCODE = 'P1004', MESSAGE = 'LOR_AUTHORIZATION_DENIED';
    END IF;

    -- A competing commit may have completed while this transaction waited for
    -- the reservation lock.  Re-enter once so the pre-validation replay path
    -- reconstructs the exact stored receipt rather than surfacing a collision.
    SELECT receipt.*
      INTO replay_receipt
    FROM lor_studio.recommendation_case_write_receipts AS receipt
    WHERE receipt.case_id = scope_case_id
      AND receipt.student_auth_subject = scope_student_subject
      AND receipt.idempotency_key = candidate_idempotency_key;
    IF FOUND THEN
      RETURN lor_studio.commit_student_case_command(
        candidate_state, candidate_expected_revision, candidate_command_type,
        candidate_action, candidate_idempotency_key, candidate_request_hash,
        candidate_event, candidate_event_hash, candidate_version_entry,
        candidate_receipt_type, candidate_receipt
      );
    END IF;

    IF EXISTS (
      SELECT 1
      FROM lor_studio.recommendation_cases AS existing_case
      WHERE existing_case.case_id = scope_case_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P1003', MESSAGE = 'LOR_IDEMPOTENCY_CONFLICT';
    END IF;

    protected_state := pg_catalog.jsonb_build_object(
      'faculty', pg_catalog.jsonb_build_object(
        'invitationId', NULL,
        'facultyId', NULL,
        'recipientEmailHash', NULL,
        'verifiedAt', NULL
      ),
      'strategyMetadata', '{}'::jsonb,
      'versionHistory', pg_catalog.jsonb_build_array(candidate_version_entry)
    );
    new_protected_state_hash := lor_studio.protected_state_chain_hash(
      scope_case_id,
      scope_student_subject,
      0,
      NULL,
      candidate_event_hash,
      protected_state
    );

    INSERT INTO lor_studio.recommendation_cases (
      case_id, student_auth_subject, student_auth_uid, revision, status,
      created_at, updated_at, closed_at, record, record_hash, protected_state_hash
    ) VALUES (
      scope_case_id, scope_student_subject, scope_student_uid, candidate_revision,
      candidate_state ->> 'status', candidate_created_at, candidate_updated_at,
      candidate_closed_at, safe_record, safe_record_hash, new_protected_state_hash
    );
  ELSE
    SELECT recommendation_case.*
      INTO current_case
    FROM lor_studio.recommendation_cases AS recommendation_case
    WHERE recommendation_case.case_id = scope_case_id
      AND recommendation_case.student_auth_subject = scope_student_subject
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P1001', MESSAGE = 'LOR_CASE_NOT_FOUND';
    END IF;

    -- Close the idempotency race after the case row lock.  Under READ
    -- COMMITTED this statement sees a receipt committed by a prior lock holder.
    SELECT receipt.*
      INTO replay_receipt
    FROM lor_studio.recommendation_case_write_receipts AS receipt
    WHERE receipt.case_id = scope_case_id
      AND receipt.student_auth_subject = scope_student_subject
      AND receipt.idempotency_key = candidate_idempotency_key;
    IF FOUND THEN
      RETURN lor_studio.commit_student_case_command(
        candidate_state, candidate_expected_revision, candidate_command_type,
        candidate_action, candidate_idempotency_key, candidate_request_hash,
        candidate_event, candidate_event_hash, candidate_version_entry,
        candidate_receipt_type, candidate_receipt
      );
    END IF;

    IF current_case.revision IS DISTINCT FROM candidate_expected_revision THEN
      RAISE EXCEPTION USING ERRCODE = 'P1002', MESSAGE = 'LOR_STALE_REVISION';
    END IF;
    IF candidate_expected_revision IS NULL
       OR candidate_revision <> candidate_expected_revision + 1
       OR current_case.student_auth_uid <> scope_student_uid
       OR candidate_created_at <> current_case.created_at
       OR candidate_updated_at <= current_case.updated_at
       OR candidate_state ->> 'status' <> current_case.status
       OR safe_record -> 'delivery' IS DISTINCT FROM current_case.record -> 'delivery'
       OR safe_record -> 'studentEvidence' IS DISTINCT FROM current_case.record -> 'studentEvidence'
       OR safe_record -> 'applicantOptions' IS DISTINCT FROM current_case.record -> 'applicantOptions' THEN
      RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
    END IF;

    SELECT protected_revision.*
      INTO previous_protected
    FROM lor_studio.recommendation_case_protected_revision_states AS protected_revision
    WHERE protected_revision.case_id = scope_case_id
      AND protected_revision.student_auth_subject = scope_student_subject
      AND protected_revision.revision = candidate_expected_revision
      AND protected_revision.protected_state_hash = current_case.protected_state_hash;
    -- The recommendation-case row above is the serialization root for every
    -- revision of this case.  A second row lock here would require a mutable
    -- protected-state RLS surface even though this ledger is append-only.
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
    END IF;

    SELECT COALESCE(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.consent-receipt.v1',
        'id', consent.receipt_id,
        'caseId', consent.case_id,
        'actorId', consent.student_auth_subject,
        'scopes', pg_catalog.to_jsonb(consent.scopes),
        'policyVersion', consent.policy_version,
        'recordedAt', pg_catalog.to_char(
          consent.recorded_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'receiptHash', consent.receipt_hash
      ) ORDER BY consent.case_revision, consent.recorded_at, consent.receipt_id
    ), '[]'::jsonb)
      INTO persisted_consent_receipts
    FROM lor_studio.consent_receipts AS consent
    WHERE consent.case_id = scope_case_id
      AND consent.student_auth_subject = scope_student_subject
      AND consent.case_revision <= candidate_expected_revision;

    SELECT COALESCE(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.waiver-receipt.v1',
        'id', waiver.receipt_id,
        'caseId', waiver.case_id,
        'actorId', waiver.student_auth_subject,
        'waived', waiver.waived,
        'policyVersion', waiver.policy_version,
        'priorReceiptId', waiver.prior_receipt_id,
        'acknowledgment', waiver.acknowledgment,
        'recordedAt', pg_catalog.to_char(
          waiver.recorded_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'receiptHash', waiver.receipt_hash
      ) ORDER BY waiver.case_revision, waiver.recorded_at, waiver.receipt_id
    ), '[]'::jsonb)
      INTO persisted_waiver_receipts
    FROM lor_studio.waiver_receipts AS waiver
    WHERE waiver.case_id = scope_case_id
      AND waiver.student_auth_subject = scope_student_subject
      AND waiver.case_revision <= candidate_expected_revision;

    IF candidate_command_type = 'student.builder.autosave' THEN
      IF current_case.status <> 'draft'
         OR candidate_state -> 'builder' -> 'sessionId'
            IS DISTINCT FROM current_case.record -> 'builder' -> 'sessionId'
         OR candidate_state -> 'builder' -> 'totalSteps'
            IS DISTINCT FROM current_case.record -> 'builder' -> 'totalSteps'
         OR candidate_state -> 'builder' -> 'completedStepIds'
            IS DISTINCT FROM current_case.record -> 'builder' -> 'completedStepIds'
         OR candidate_state -> 'builder' -> 'currentStepId'
            IS DISTINCT FROM current_case.record -> 'builder' -> 'currentStepId'
         OR (candidate_state -> 'builder' ->> 'autosavedAt')::timestamptz
            IS DISTINCT FROM candidate_updated_at
         OR EXISTS (
           SELECT 1
           FROM pg_catalog.jsonb_object_keys(
             current_case.record -> 'builder' -> 'stepData'
           ) AS previous_step(key_name)
           WHERE NOT (candidate_state -> 'builder' -> 'stepData') ? previous_step.key_name
         )
         OR (
           SELECT pg_catalog.count(*)
           FROM (
             SELECT key_name
             FROM pg_catalog.jsonb_object_keys(
               current_case.record -> 'builder' -> 'stepData'
             ) AS previous_keys(key_name)
             UNION
             SELECT key_name
             FROM pg_catalog.jsonb_object_keys(
               candidate_state -> 'builder' -> 'stepData'
             ) AS candidate_keys(key_name)
           ) AS all_keys
           WHERE current_case.record -> 'builder' -> 'stepData' -> all_keys.key_name
             IS DISTINCT FROM candidate_state -> 'builder' -> 'stepData' -> all_keys.key_name
         ) > 1
         OR EXISTS (
           SELECT 1
           FROM pg_catalog.jsonb_object_keys(
             candidate_state -> 'builder' -> 'stepData'
           ) AS candidate_step(key_name)
           WHERE NOT candidate_step.key_name = ANY (
             (ARRAY[
               'case_basics', 'writer_relationship', 'evidence_selection',
               'timeline_highlights', 'writer_preferences', 'consent_and_waiver',
               'review', 'faculty_handoff'
             ]::text[])[1:pg_catalog.jsonb_array_length(
               current_case.record -> 'builder' -> 'completedStepIds'
             ) + 1]
           )
         )
         OR candidate_state -> 'consentReceipts' IS DISTINCT FROM persisted_consent_receipts
         OR candidate_state -> 'waiverReceipts' IS DISTINCT FROM persisted_waiver_receipts
         OR candidate_receipt_type IS NOT NULL
         OR candidate_receipt IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
      END IF;
    ELSIF candidate_command_type = 'student.builder.complete' THEN
      IF current_case.status <> 'draft'
         OR current_case.record -> 'builder' -> 'currentStepId' = 'null'::jsonb
         OR NOT (current_case.record -> 'builder' -> 'stepData') ? (
           current_case.record -> 'builder' ->> 'currentStepId'
         )
         OR candidate_state -> 'builder' -> 'sessionId'
            IS DISTINCT FROM current_case.record -> 'builder' -> 'sessionId'
         OR candidate_state -> 'builder' -> 'totalSteps'
            IS DISTINCT FROM current_case.record -> 'builder' -> 'totalSteps'
         OR candidate_state -> 'builder' -> 'stepData'
            IS DISTINCT FROM current_case.record -> 'builder' -> 'stepData'
         OR candidate_state -> 'builder' -> 'completedStepIds'
            IS DISTINCT FROM (
              current_case.record -> 'builder' -> 'completedStepIds'
              || pg_catalog.jsonb_build_array(
                current_case.record -> 'builder' -> 'currentStepId'
              )
            )
         OR (candidate_state -> 'builder' ->> 'autosavedAt')::timestamptz
            IS DISTINCT FROM candidate_updated_at
         OR candidate_state -> 'consentReceipts' IS DISTINCT FROM persisted_consent_receipts
         OR candidate_state -> 'waiverReceipts' IS DISTINCT FROM persisted_waiver_receipts
         OR candidate_receipt_type IS NOT NULL
         OR candidate_receipt IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
      END IF;
    ELSIF candidate_command_type IN ('student.consent.record', 'student.waiver.record') THEN
      IF candidate_state -> 'builder' IS DISTINCT FROM current_case.record -> 'builder' THEN
        RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
      END IF;

      IF candidate_receipt IS NULL
         OR pg_catalog.jsonb_typeof(candidate_receipt) <> 'object'
         OR (candidate_receipt ->> 'recordedAt')::timestamptz
            IS DISTINCT FROM candidate_updated_at
         OR EXISTS (
           SELECT 1 FROM lor_studio.consent_receipts AS prior_consent
           WHERE prior_consent.receipt_id = candidate_receipt ->> 'id'
             AND prior_consent.case_id = scope_case_id
             AND prior_consent.student_auth_subject = scope_student_subject
           UNION ALL
           SELECT 1 FROM lor_studio.waiver_receipts AS prior_waiver
           WHERE prior_waiver.receipt_id = candidate_receipt ->> 'id'
             AND prior_waiver.case_id = scope_case_id
             AND prior_waiver.student_auth_subject = scope_student_subject
         ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
      END IF;

      IF candidate_receipt_type = 'consent' THEN
        IF (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(candidate_receipt)) <> 8
           OR NOT candidate_receipt ?& ARRAY[
             'schemaVersion', 'id', 'caseId', 'actorId', 'scopes',
             'policyVersion', 'recordedAt', 'receiptHash'
           ]::text[]
           OR candidate_state -> 'waiverReceipts' IS DISTINCT FROM persisted_waiver_receipts
           OR candidate_state -> 'consentReceipts'
              IS DISTINCT FROM persisted_consent_receipts || pg_catalog.jsonb_build_array(candidate_receipt)
           OR candidate_receipt ->> 'schemaVersion' <> 'missionmed.lor.consent-receipt.v1'
           OR candidate_receipt ->> 'caseId' <> scope_case_id
           OR candidate_receipt ->> 'actorId' <> scope_student_subject
           OR lor_studio.canonical_jsonb_sha256(candidate_receipt - 'receiptHash')
              <> candidate_receipt ->> 'receiptHash' THEN
          RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
        END IF;
      ELSIF candidate_receipt_type = 'waiver' THEN
        IF (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(candidate_receipt)) <> 10
           OR NOT candidate_receipt ?& ARRAY[
             'schemaVersion', 'id', 'caseId', 'actorId', 'waived',
             'policyVersion', 'priorReceiptId', 'acknowledgment', 'recordedAt',
             'receiptHash'
           ]::text[]
           OR candidate_state -> 'consentReceipts' IS DISTINCT FROM persisted_consent_receipts
           OR candidate_state -> 'waiverReceipts'
              IS DISTINCT FROM persisted_waiver_receipts || pg_catalog.jsonb_build_array(candidate_receipt)
           OR candidate_receipt ->> 'schemaVersion' <> 'missionmed.lor.waiver-receipt.v1'
           OR candidate_receipt ->> 'caseId' <> scope_case_id
           OR candidate_receipt ->> 'actorId' <> scope_student_subject
           OR candidate_receipt ->> 'priorReceiptId' IS DISTINCT FROM (CASE
             WHEN pg_catalog.jsonb_array_length(persisted_waiver_receipts) = 0 THEN NULL
             ELSE persisted_waiver_receipts -> -1 ->> 'id'
           END)
           OR (
             pg_catalog.jsonb_array_length(persisted_waiver_receipts) > 0
             AND (candidate_receipt ->> 'recordedAt')::timestamptz <=
               (persisted_waiver_receipts -> -1 ->> 'recordedAt')::timestamptz
           )
           OR lor_studio.canonical_jsonb_sha256(candidate_receipt - 'receiptHash')
              <> candidate_receipt ->> 'receiptHash' THEN
          RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
        END IF;
      ELSE
        RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
      END IF;
    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
    END IF;

    protected_state := pg_catalog.jsonb_set(
      previous_protected.protected_state,
      '{versionHistory}',
      previous_protected.protected_state -> 'versionHistory'
        || pg_catalog.jsonb_build_array(candidate_version_entry),
      false
    );
    new_protected_state_hash := lor_studio.protected_state_chain_hash(
      scope_case_id,
      scope_student_subject,
      candidate_revision,
      previous_protected.protected_state_hash,
      candidate_event_hash,
      protected_state
    );

    UPDATE lor_studio.recommendation_cases AS recommendation_case
    SET revision = candidate_revision,
        status = candidate_state ->> 'status',
        updated_at = candidate_updated_at,
        closed_at = candidate_closed_at,
        record = safe_record,
        record_hash = safe_record_hash,
        protected_state_hash = new_protected_state_hash
    WHERE recommendation_case.case_id = scope_case_id
      AND recommendation_case.student_auth_subject = scope_student_subject
      AND recommendation_case.revision = candidate_expected_revision;
  END IF;

  INSERT INTO lor_studio.recommendation_case_audit_events (
    event_ref, case_id, student_auth_subject, case_ref, actor_ref, actor_role,
    correlation_ref, event_type, outcome, revision, occurred_at, event,
    event_hash, transaction_id
  ) VALUES (
    candidate_event ->> 'eventRef', scope_case_id, scope_student_subject,
    candidate_event ->> 'caseRef', candidate_event ->> 'actorRef',
    candidate_event ->> 'actorRole', candidate_event ->> 'correlationRef',
    candidate_event ->> 'eventType', candidate_event ->> 'outcome',
    candidate_revision, (candidate_event ->> 'occurredAt')::timestamptz,
    candidate_event, candidate_event_hash, transaction_id
  );

  INSERT INTO lor_studio.recommendation_case_protected_revision_states (
    case_id, student_auth_subject, revision, previous_revision,
    previous_protected_state_hash, protected_state, protected_state_hash,
    event_hash, audit_event_ref, transaction_id, committed_at
  ) VALUES (
    scope_case_id, scope_student_subject, candidate_revision,
    CASE WHEN candidate_revision = 0 THEN NULL ELSE candidate_revision - 1 END,
    CASE WHEN candidate_revision = 0 THEN NULL ELSE previous_protected.protected_state_hash END,
    protected_state, new_protected_state_hash, candidate_event_hash,
    candidate_event ->> 'eventRef', transaction_id, pg_catalog.transaction_timestamp()
  );

  IF candidate_receipt_type = 'consent' THEN
    receipt_recorded_at := (candidate_receipt ->> 'recordedAt')::timestamptz;
    INSERT INTO lor_studio.consent_receipts (
      receipt_id, case_id, student_auth_subject, student_auth_uid, case_revision,
      scopes, policy_version, recorded_at, receipt_hash
    ) VALUES (
      candidate_receipt ->> 'id', scope_case_id, scope_student_subject, scope_student_uid,
      candidate_revision,
      ARRAY(SELECT value FROM pg_catalog.jsonb_array_elements_text(
        candidate_receipt -> 'scopes'
      ) AS scope_values(value)),
      candidate_receipt ->> 'policyVersion', receipt_recorded_at,
      candidate_receipt ->> 'receiptHash'
    );
  ELSIF candidate_receipt_type = 'waiver' THEN
    receipt_recorded_at := (candidate_receipt ->> 'recordedAt')::timestamptz;
    INSERT INTO lor_studio.waiver_receipts (
      receipt_id, case_id, student_auth_subject, student_auth_uid, case_revision,
      prior_receipt_id, waived, policy_version, acknowledgment, recorded_at, receipt_hash
    ) VALUES (
      candidate_receipt ->> 'id', scope_case_id, scope_student_subject, scope_student_uid,
      candidate_revision, candidate_receipt ->> 'priorReceiptId',
      (candidate_receipt ->> 'waived')::boolean,
      candidate_receipt ->> 'policyVersion', candidate_receipt ->> 'acknowledgment',
      receipt_recorded_at, candidate_receipt ->> 'receiptHash'
    );
  END IF;

  INSERT INTO lor_studio.recommendation_case_write_receipts (
    case_id, student_auth_subject, student_auth_uid, idempotency_key, request_hash,
    command_type, operation, revision, status, created_at, updated_at, closed_at,
    record, record_hash, protected_state_hash, released_snapshot_hash, event_hash,
    audit_event_ref, transaction_id, committed_at
  ) VALUES (
    scope_case_id, scope_student_subject, scope_student_uid, candidate_idempotency_key,
    candidate_request_hash, candidate_command_type, command_operation, candidate_revision,
    candidate_state ->> 'status', candidate_created_at, candidate_updated_at,
    candidate_closed_at, safe_record, safe_record_hash, new_protected_state_hash,
    released_snapshot_hash, candidate_event_hash, candidate_event ->> 'eventRef',
    transaction_id, pg_catalog.transaction_timestamp()
  );

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.atomic-command-receipt.v2',
    'action', candidate_action,
    'committed', true,
    'replayed', false,
    'sameTransaction', true,
    'caseId', scope_case_id,
    'studentId', scope_student_subject,
    'revision', candidate_revision,
    'idempotencyKey', candidate_idempotency_key,
    'requestHash', candidate_request_hash,
    'safeRecordHash', safe_record_hash,
    'protectedStateHash', new_protected_state_hash,
    'eventHash', candidate_event_hash,
    'auditEventRef', candidate_event ->> 'eventRef',
    'transactionId', transaction_id,
    'state', candidate_state
  );
EXCEPTION
  WHEN SQLSTATE 'P1001' OR SQLSTATE 'P1002' OR SQLSTATE 'P1003'
    OR SQLSTATE 'P1004' OR SQLSTATE 'P1005' THEN
    RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION USING ERRCODE = 'P1004', MESSAGE = 'LOR_AUTHORIZATION_DENIED';
  WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'LOR_COMMAND_INVALID';
END;
$student_command$;

REVOKE ALL ON FUNCTION lor_studio.commit_student_case_command(
  jsonb, bigint, text, text, text, text, jsonb, text, jsonb, text, jsonb
) FROM PUBLIC;

CREATE FUNCTION lor_studio.commit_student_case_create(
  candidate_state jsonb,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_event jsonb,
  candidate_event_hash text,
  candidate_version_entry jsonb
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT lor_studio.commit_student_case_command(
    candidate_state, NULL, 'student.case.create', 'case.create',
    candidate_idempotency_key, candidate_request_hash, candidate_event,
    candidate_event_hash, candidate_version_entry, NULL, NULL
  );
$$;

CREATE FUNCTION lor_studio.commit_student_builder_autosave(
  candidate_state jsonb,
  candidate_expected_revision bigint,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_event jsonb,
  candidate_event_hash text,
  candidate_version_entry jsonb
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT lor_studio.commit_student_case_command(
    candidate_state, candidate_expected_revision,
    'student.builder.autosave', 'builder.autosave', candidate_idempotency_key,
    candidate_request_hash, candidate_event, candidate_event_hash,
    candidate_version_entry, NULL, NULL
  );
$$;

CREATE FUNCTION lor_studio.commit_student_builder_complete(
  candidate_state jsonb,
  candidate_expected_revision bigint,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_event jsonb,
  candidate_event_hash text,
  candidate_version_entry jsonb
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT lor_studio.commit_student_case_command(
    candidate_state, candidate_expected_revision,
    'student.builder.complete', 'builder.complete_step', candidate_idempotency_key,
    candidate_request_hash, candidate_event, candidate_event_hash,
    candidate_version_entry, NULL, NULL
  );
$$;

CREATE FUNCTION lor_studio.commit_student_consent_receipt(
  candidate_state jsonb,
  candidate_expected_revision bigint,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_event jsonb,
  candidate_event_hash text,
  candidate_version_entry jsonb,
  candidate_receipt jsonb
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT lor_studio.commit_student_case_command(
    candidate_state, candidate_expected_revision,
    'student.consent.record', 'consent.record', candidate_idempotency_key,
    candidate_request_hash, candidate_event, candidate_event_hash,
    candidate_version_entry, 'consent', candidate_receipt
  );
$$;

CREATE FUNCTION lor_studio.commit_student_waiver_receipt(
  candidate_state jsonb,
  candidate_expected_revision bigint,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_event jsonb,
  candidate_event_hash text,
  candidate_version_entry jsonb,
  candidate_receipt jsonb
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT lor_studio.commit_student_case_command(
    candidate_state, candidate_expected_revision,
    'student.waiver.record', 'waiver.record', candidate_idempotency_key,
    candidate_request_hash, candidate_event, candidate_event_hash,
    candidate_version_entry, 'waiver', candidate_receipt
  );
$$;

CREATE FUNCTION lor_studio.read_mentor_case_projection()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'caseId', recommendation_case.case_id,
    'status', recommendation_case.status,
    'strategyStatus', protected_revision.protected_state -> 'strategyMetadata'
      ->> 'strategyStatus',
    'nextMilestone', protected_revision.protected_state -> 'strategyMetadata'
      ->> 'nextMilestone',
    'deliveryStatus', recommendation_case.record -> 'delivery' ->> 'status'
  )
  FROM lor_studio.recommendation_cases AS recommendation_case
  JOIN lor_studio.recommendation_case_protected_revision_states AS protected_revision
    ON protected_revision.case_id = recommendation_case.case_id
   AND protected_revision.student_auth_subject = recommendation_case.student_auth_subject
   AND protected_revision.revision = recommendation_case.revision
   AND protected_revision.protected_state_hash = recommendation_case.protected_state_hash
  WHERE recommendation_case.case_id = pg_catalog.current_setting(
      'lor_studio.case_id', true
    )
    AND recommendation_case.student_auth_subject = pg_catalog.current_setting(
      'lor_studio.resource_student_id', true
    );
$$;

CREATE FUNCTION lor_studio.read_faculty_case_projection()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $faculty_read$
DECLARE
  scope_case_id text := pg_catalog.current_setting('lor_studio.case_id', true);
  scope_student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  );
  faculty_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  faculty_uid_text text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  scope_invitation_id text := pg_catalog.current_setting(
    'lor_studio.invitation_id', true
  );
  faculty_uid uuid;
  recommendation_case lor_studio.recommendation_cases%ROWTYPE;
  private_content lor_studio.faculty_private_content%ROWTYPE;
  consent_projection jsonb;
  waiver_projection jsonb;
  private_projection jsonb;
  private_found boolean := false;
BEGIN
  IF NOT COALESCE(
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.operation', true) = 'read'
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
    AND pg_catalog.length(pg_catalog.btrim(scope_case_id)) BETWEEN 1 AND 200
    AND pg_catalog.length(pg_catalog.btrim(scope_student_subject)) BETWEEN 1 AND 200
    AND scope_student_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.length(pg_catalog.btrim(faculty_subject)) BETWEEN 1 AND 200
    AND faculty_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.length(pg_catalog.btrim(scope_invitation_id)) BETWEEN 1 AND 200
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true',
    false
  ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  BEGIN
    faculty_uid := NULLIF(faculty_uid_text, '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END;

  IF faculty_uid IS NULL OR NOT lor_studio.faculty_context_allows(
    scope_case_id,
    scope_student_subject,
    ARRAY['read']::text[]
  ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  SELECT candidate.*
    INTO recommendation_case
  FROM lor_studio.recommendation_cases AS candidate
  WHERE candidate.case_id = scope_case_id
    AND candidate.student_auth_subject = scope_student_subject;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOR_CASE_NOT_FOUND' USING ERRCODE = 'P1001';
  END IF;

  SELECT candidate.*
    INTO private_content
  FROM lor_studio.faculty_private_content AS candidate
  WHERE candidate.case_id = scope_case_id
    AND candidate.student_auth_subject = scope_student_subject
    AND candidate.faculty_auth_subject = faculty_subject
    AND candidate.faculty_auth_uid = faculty_uid
    AND candidate.invitation_id = scope_invitation_id;
  private_found := FOUND;

  SELECT COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'schemaVersion', 'missionmed.lor.consent-receipt.v1',
          'id', receipt.receipt_id,
          'caseId', receipt.case_id,
          'actorId', receipt.student_auth_subject,
          'scopes', pg_catalog.to_jsonb(receipt.scopes),
          'policyVersion', receipt.policy_version,
          'recordedAt', pg_catalog.to_char(
            receipt.recorded_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
          'receiptHash', receipt.receipt_hash
        ) ORDER BY receipt.case_revision, receipt.recorded_at, receipt.receipt_id
      ),
      '[]'::jsonb
    )
    INTO consent_projection
  FROM lor_studio.consent_receipts AS receipt
  WHERE receipt.case_id = scope_case_id
    AND receipt.student_auth_subject = scope_student_subject
    AND receipt.case_revision <= recommendation_case.revision;

  SELECT pg_catalog.jsonb_build_object(
      'decided', true,
      'waived', receipt.waived,
      'receiptId', receipt.receipt_id
    )
    INTO waiver_projection
  FROM lor_studio.waiver_receipts AS receipt
  WHERE receipt.case_id = scope_case_id
    AND receipt.student_auth_subject = scope_student_subject
    AND receipt.case_revision <= recommendation_case.revision
    AND NOT EXISTS (
      SELECT 1
      FROM lor_studio.waiver_receipts AS successor
      WHERE successor.prior_receipt_id = receipt.receipt_id
        AND successor.case_id = receipt.case_id
        AND successor.student_auth_subject = receipt.student_auth_subject
        AND successor.case_revision <= recommendation_case.revision
    )
  ORDER BY receipt.case_revision DESC, receipt.recorded_at DESC, receipt.receipt_id DESC
  LIMIT 1;

  IF waiver_projection IS NULL THEN
    waiver_projection := pg_catalog.jsonb_build_object(
      'decided', false,
      'waived', NULL,
      'receiptId', NULL
    );
  END IF;

  IF private_found THEN
    private_projection := pg_catalog.jsonb_build_object(
      'answers', private_content.answers,
      'notes', private_content.notes,
      'draftText', private_content.draft_text,
      'finalDocument', CASE
        WHEN private_content.final_document_id IS NULL THEN NULL::jsonb
        ELSE pg_catalog.jsonb_build_object(
          'contentHash', private_content.final_document_content_hash,
          'id', private_content.final_document_id,
          'mimeType', private_content.final_document_mime_type,
          'text', private_content.final_document_text,
          'releasedToStudentAt', CASE
            WHEN private_content.released_at IS NULL THEN NULL
            ELSE pg_catalog.to_char(
              private_content.released_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            )
          END
        )
      END
    );
  ELSE
    private_projection := pg_catalog.jsonb_build_object(
      'answers', '[]'::jsonb,
      'notes', '[]'::jsonb,
      'draftText', NULL,
      'finalDocument', NULL
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.faculty-projection.v1',
    'caseId', recommendation_case.case_id,
    'revision', recommendation_case.revision,
    'status', recommendation_case.status,
    'studentShared', pg_catalog.jsonb_build_object(
      'evidence', recommendation_case.record -> 'studentEvidence',
      'applicantOptions', recommendation_case.record -> 'applicantOptions',
      'consentReceipts', consent_projection,
      'waiverState', waiver_projection
    ),
    'facultyPrivate', private_projection,
    'delivery', recommendation_case.record -> 'delivery'
  );
EXCEPTION
  WHEN SQLSTATE 'P1001' OR SQLSTATE 'P1004' OR SQLSTATE 'P1005' THEN
    RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
END;
$faculty_read$;

CREATE FUNCTION lor_studio.commit_faculty_final_document_release(
  candidate_expected_revision bigint,
  candidate_document_id text,
  candidate_idempotency_key text,
  candidate_request_hash text,
  candidate_event jsonb,
  candidate_event_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $faculty_release$
DECLARE
  scope_case_id text := pg_catalog.current_setting('lor_studio.case_id', true);
  scope_student_subject text := pg_catalog.current_setting(
    'lor_studio.resource_student_id', true
  );
  faculty_subject text := pg_catalog.current_setting(
    'lor_studio.student_auth_subject', true
  );
  faculty_uid_text text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  scope_invitation_id text := pg_catalog.current_setting(
    'lor_studio.invitation_id', true
  );
  faculty_uid uuid;
  recommendation_case lor_studio.recommendation_cases%ROWTYPE;
  private_content lor_studio.faculty_private_content%ROWTYPE;
  previous_protected lor_studio.recommendation_case_protected_revision_states%ROWTYPE;
  current_waiver lor_studio.waiver_receipts%ROWTYPE;
  stored_receipt lor_studio.recommendation_case_private_write_receipts%ROWTYPE;
  replayed boolean := false;
  receipt_found boolean := false;
  event_occurred_at timestamptz;
  event_occurred_at_iso text;
  approval_at_iso text;
  next_revision bigint;
  transaction_id text;
  expected_request_hash text;
  expected_event_ref text;
  expected_case_ref text;
  expected_actor_ref text;
  expected_correlation_ref text;
  safe_record_hash text;
  new_release_document_hash text;
  faculty_reference text;
  new_private_record jsonb;
  new_private_record_hash text;
  protected_changes jsonb;
  version_entry jsonb;
  new_protected_state jsonb;
  new_protected_state_hash text;
  released_snapshot jsonb;
  released_snapshot_hash text;
  consent_projection jsonb;
  state_projection jsonb;
  affected_rows integer;
BEGIN
  -- Authorization is deliberately resolved before the idempotency ledger so a
  -- valid key cannot become a faculty-private receipt oracle.
  IF NOT COALESCE(
    pg_catalog.current_setting('lor_studio.actor_role', true) = 'faculty'
    AND pg_catalog.current_setting('lor_studio.operation', true) = 'save'
    AND pg_catalog.current_setting('lor_studio.purpose', true) = 'faculty_private_edit'
    AND pg_catalog.length(pg_catalog.btrim(scope_case_id)) BETWEEN 1 AND 200
    AND pg_catalog.length(pg_catalog.btrim(scope_student_subject)) BETWEEN 1 AND 200
    AND scope_student_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.length(pg_catalog.btrim(faculty_subject)) BETWEEN 1 AND 200
    AND faculty_subject ~ '^wp:[1-9][0-9]*$'
    AND pg_catalog.length(pg_catalog.btrim(scope_invitation_id)) BETWEEN 1 AND 200
    AND pg_catalog.current_setting('lor_studio.entitlement_verified', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.lor_enabled', true) = 'true'
    AND pg_catalog.current_setting('lor_studio.canary_authorized', true) = 'true',
    false
  ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  BEGIN
    faculty_uid := NULLIF(faculty_uid_text, '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END;

  IF faculty_uid IS NULL
     OR NOT lor_studio.student_write_axes_satisfied()
     OR NOT lor_studio.faculty_context_allows(
       scope_case_id,
       scope_student_subject,
       ARRAY['save']::text[]
     ) THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      'missionmed.lor.case-lock.v1', scope_case_id, scope_student_subject
    )::text,
    0
  ));

  -- Only replay-key syntax is checked before the exact-key lookup. Candidate
  -- document, revision, event, and hash semantics remain after replay.
  IF candidate_idempotency_key IS NULL
     OR pg_catalog.length(candidate_idempotency_key) NOT BETWEEN 1 AND 240
     OR pg_catalog.length(pg_catalog.btrim(candidate_idempotency_key)) = 0
     OR candidate_request_hash IS NULL
     OR candidate_request_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
  END IF;

  SELECT receipt.*
    INTO stored_receipt
  FROM lor_studio.recommendation_case_private_write_receipts AS receipt
  WHERE receipt.case_id = scope_case_id
    AND receipt.student_auth_subject = scope_student_subject
    AND receipt.idempotency_key = candidate_idempotency_key;
  receipt_found := FOUND;

  IF receipt_found THEN
    IF stored_receipt.command_type <> 'faculty.final_document_release'
       OR stored_receipt.operation <> 'save'
       OR stored_receipt.request_hash <> candidate_request_hash
       OR stored_receipt.faculty_auth_subject <> faculty_subject
       OR stored_receipt.faculty_auth_uid <> faculty_uid THEN
      RAISE EXCEPTION 'LOR_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1003';
    END IF;
    replayed := true;
  ELSE
    SELECT candidate.*
      INTO recommendation_case
    FROM lor_studio.recommendation_cases AS candidate
    WHERE candidate.case_id = scope_case_id
      AND candidate.student_auth_subject = scope_student_subject
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'LOR_CASE_NOT_FOUND' USING ERRCODE = 'P1001';
    END IF;

    -- The case lock closes the same-key race. A concurrent winner is replayed;
    -- a different request on the same key remains a stable conflict.
    SELECT receipt.*
      INTO stored_receipt
    FROM lor_studio.recommendation_case_private_write_receipts AS receipt
    WHERE receipt.case_id = scope_case_id
      AND receipt.student_auth_subject = scope_student_subject
      AND receipt.idempotency_key = candidate_idempotency_key;
    receipt_found := FOUND;

    IF receipt_found THEN
      IF stored_receipt.command_type <> 'faculty.final_document_release'
         OR stored_receipt.operation <> 'save'
         OR stored_receipt.request_hash <> candidate_request_hash
         OR stored_receipt.faculty_auth_subject <> faculty_subject
         OR stored_receipt.faculty_auth_uid <> faculty_uid THEN
        RAISE EXCEPTION 'LOR_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1003';
      END IF;
      replayed := true;
    ELSE
      IF candidate_expected_revision IS NULL
         OR candidate_expected_revision < 0
         OR candidate_expected_revision <> recommendation_case.revision THEN
        RAISE EXCEPTION 'LOR_STALE_REVISION' USING ERRCODE = 'P1002';
      END IF;

      IF recommendation_case.status <> ALL (
           ARRAY['faculty_verified', 'faculty_review', 'faculty_approved', 'delivered']::text[]
         )
         OR recommendation_case.released_at IS NOT NULL
         OR recommendation_case.release_document_id IS NOT NULL
         OR recommendation_case.release_document_hash IS NOT NULL
         OR recommendation_case.released_at_revision IS NOT NULL
         OR recommendation_case.release_waiver_receipt_id IS NOT NULL THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      SELECT candidate.*
        INTO private_content
      FROM lor_studio.faculty_private_content AS candidate
      WHERE candidate.case_id = scope_case_id
        AND candidate.student_auth_subject = scope_student_subject
        AND candidate.faculty_auth_subject = faculty_subject
        AND candidate.faculty_auth_uid = faculty_uid
        AND candidate.invitation_id = scope_invitation_id
      FOR UPDATE;

      IF NOT FOUND
         OR private_content.private_revision <> recommendation_case.revision
         OR private_content.final_document_id IS NULL
         OR private_content.final_document_text IS NULL
         OR pg_catalog.length(pg_catalog.btrim(private_content.final_document_text)) = 0
         OR private_content.final_document_id IS DISTINCT FROM candidate_document_id
         OR private_content.document_state IS DISTINCT FROM 'faculty_final'
         OR private_content.approval_approved IS DISTINCT FROM true
         OR private_content.approval_signature_attested IS DISTINCT FROM true
         OR private_content.approval_at IS NULL
         OR private_content.approval_faculty_auth_subject IS DISTINCT FROM faculty_subject
         OR private_content.release_document_hash IS NOT NULL
         OR private_content.release_document_id IS NOT NULL
         OR private_content.released_at IS NOT NULL
         OR private_content.released_at_revision IS NOT NULL
         OR private_content.release_waiver_receipt_id IS NOT NULL THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      -- The case row is the serialization root for every revision append.  The
      -- protected predecessor is immutable, so a second row lock would add an
      -- unusable UPDATE-policy requirement without strengthening the chain.
      SELECT protected.*
        INTO previous_protected
      FROM lor_studio.recommendation_case_protected_revision_states AS protected
      WHERE protected.case_id = scope_case_id
        AND protected.student_auth_subject = scope_student_subject
        AND protected.revision = recommendation_case.revision
        AND protected.protected_state_hash = recommendation_case.protected_state_hash;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      -- The already-held case lock also serializes waiver changes: the waiver
      -- insert guard locks this same case row before accepting a successor.
      SELECT receipt.*
        INTO current_waiver
      FROM lor_studio.waiver_receipts AS receipt
      WHERE receipt.case_id = scope_case_id
        AND receipt.student_auth_subject = scope_student_subject
        AND receipt.case_revision <= recommendation_case.revision
        AND NOT EXISTS (
          SELECT 1
          FROM lor_studio.waiver_receipts AS successor
          WHERE successor.prior_receipt_id = receipt.receipt_id
            AND successor.case_id = receipt.case_id
            AND successor.student_auth_subject = receipt.student_auth_subject
      )
      ORDER BY receipt.case_revision DESC, receipt.recorded_at DESC, receipt.receipt_id DESC
      LIMIT 1;

      IF NOT FOUND OR current_waiver.waived IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      IF candidate_document_id IS NULL
         OR pg_catalog.length(candidate_document_id) NOT BETWEEN 1 AND 200
         OR pg_catalog.length(pg_catalog.btrim(candidate_document_id)) = 0
         OR candidate_event IS NULL
         OR NOT lor_studio.audit_event_is_metadata(candidate_event)
         OR candidate_event_hash IS NULL
         OR candidate_event_hash !~ '^[a-f0-9]{64}$'
         OR candidate_event_hash <> lor_studio.canonical_jsonb_sha256(candidate_event)
         OR candidate_event ->> 'eventType' <> 'faculty.final_document_released'
         OR candidate_event ->> 'actorRole' <> 'faculty'
         OR candidate_event ->> 'outcome' <> 'success'
         OR candidate_event ->> 'revision' !~ '^(0|[1-9][0-9]*)$'
         OR candidate_event ->> 'occurredAt' !~
           '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      next_revision := recommendation_case.revision + 1;
      event_occurred_at_iso := candidate_event ->> 'occurredAt';
      event_occurred_at := event_occurred_at_iso::timestamptz;
      approval_at_iso := pg_catalog.to_char(
        private_content.approval_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      );

      expected_case_ref := 'case_' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          'lor-studio:case:' || scope_case_id,
          'UTF8'
        )),
        'hex'
      );
      expected_actor_ref := 'actor_' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          'lor-studio:actor:' || faculty_subject,
          'UTF8'
        )),
        'hex'
      );
      expected_event_ref := 'event_' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          'lor-studio:event:event_' || pg_catalog.substr(
            pg_catalog.encode(
              pg_catalog.sha256(pg_catalog.convert_to(
                scope_case_id || ':faculty.final_document_released:'
                  || candidate_idempotency_key,
                'UTF8'
              )),
              'hex'
            ),
            1,
            32
          ),
          'UTF8'
        )),
        'hex'
      );
      expected_correlation_ref := 'correlation_' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          'lor-studio:correlation:' || pg_catalog.substr(
            pg_catalog.encode(
              pg_catalog.sha256(pg_catalog.convert_to(candidate_idempotency_key, 'UTF8')),
              'hex'
            ),
            1,
            32
          ),
          'UTF8'
        )),
        'hex'
      );
      expected_request_hash := lor_studio.canonical_jsonb_sha256(
        pg_catalog.jsonb_build_object(
          'operation', 'faculty.final_document_release',
          'caseId', scope_case_id,
          'actorId', faculty_subject,
          'payload', pg_catalog.jsonb_build_object('documentId', candidate_document_id)
        )
      );

      IF candidate_event ->> 'eventRef' <> expected_event_ref
         OR candidate_event ->> 'caseRef' <> expected_case_ref
         OR candidate_event ->> 'actorRef' <> expected_actor_ref
         OR candidate_event ->> 'correlationRef' <> expected_correlation_ref
         OR (candidate_event ->> 'revision')::bigint <> next_revision
         OR candidate_request_hash <> expected_request_hash
         OR event_occurred_at > pg_catalog.statement_timestamp()
         OR event_occurred_at < recommendation_case.updated_at
         OR event_occurred_at < private_content.updated_at
         OR event_occurred_at < private_content.approval_at
         OR event_occurred_at < current_waiver.recorded_at
         OR private_content.approval_at <> pg_catalog.date_trunc(
           'milliseconds', private_content.approval_at
         ) THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      safe_record_hash := lor_studio.canonical_jsonb_sha256(recommendation_case.record);
      IF safe_record_hash <> recommendation_case.record_hash THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      new_release_document_hash := lor_studio.release_document_hash(
        private_content.final_document_content_hash,
        private_content.final_document_id,
        private_content.final_document_mime_type,
        private_content.final_document_text
      );

      new_private_record := pg_catalog.jsonb_build_object(
        'facultyPrivate', pg_catalog.jsonb_build_object(
          'answers', private_content.answers,
          'notes', private_content.notes,
          'draftText', private_content.draft_text,
          'finalDocument', pg_catalog.jsonb_build_object(
            'contentHash', private_content.final_document_content_hash,
            'id', private_content.final_document_id,
            'mimeType', private_content.final_document_mime_type,
            'text', private_content.final_document_text,
            'releasedToStudentAt', event_occurred_at_iso
          )
        ),
        'finalDocumentState', pg_catalog.jsonb_build_object(
          'documentState', private_content.document_state,
          'facultyApproval', pg_catalog.jsonb_build_object(
            'approved', private_content.approval_approved,
            'approvedAt', approval_at_iso,
            'facultyId', private_content.approval_faculty_auth_subject,
            'signatureAttested', private_content.approval_signature_attested
          ),
          'release', pg_catalog.jsonb_build_object(
            'documentHash', new_release_document_hash,
            'documentId', private_content.final_document_id,
            'releasedAt', event_occurred_at_iso,
            'releasedAtRevision', next_revision,
            'waiverReceiptId', current_waiver.receipt_id
          )
        )
      );

      IF NOT lor_studio.private_record_is_complete(new_private_record) THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;
      new_private_record_hash := lor_studio.canonical_jsonb_sha256(new_private_record);

      protected_changes := pg_catalog.jsonb_build_object(
        'facultyPrivate', new_private_record -> 'facultyPrivate',
        'finalDocumentState', new_private_record -> 'finalDocumentState'
      );
      version_entry := pg_catalog.jsonb_build_object(
        'revision', next_revision,
        'eventType', 'faculty.final_document_released',
        'actorId', faculty_subject,
        'occurredAt', event_occurred_at_iso,
        'changedFields', pg_catalog.jsonb_build_array(
          'facultyPrivate',
          'finalDocumentState'
        ),
        'changeHash', lor_studio.canonical_jsonb_sha256(protected_changes)
      );
      new_protected_state := pg_catalog.jsonb_set(
        previous_protected.protected_state,
        ARRAY['versionHistory']::text[],
        (previous_protected.protected_state -> 'versionHistory')
          || pg_catalog.jsonb_build_array(version_entry),
        false
      );

      IF NOT lor_studio.protected_case_state_is_complete(
        new_protected_state,
        next_revision
      ) THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      new_protected_state_hash := lor_studio.protected_state_chain_hash(
        scope_case_id,
        scope_student_subject,
        next_revision,
        previous_protected.protected_state_hash,
        candidate_event_hash,
        new_protected_state
      );
      faculty_reference := 'faculty_' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          'lor-studio:faculty:' || faculty_subject,
          'UTF8'
        )),
        'hex'
      );
      released_snapshot := pg_catalog.jsonb_build_object(
        'finalDocument', pg_catalog.jsonb_build_object(
          'id', private_content.final_document_id,
          'text', private_content.final_document_text,
          'contentHash', private_content.final_document_content_hash,
          'mimeType', private_content.final_document_mime_type,
          'releasedToStudentAt', event_occurred_at_iso
        ),
        'facultyApproval', pg_catalog.jsonb_build_object(
          'approved', private_content.approval_approved,
          'approvedAt', approval_at_iso,
          'facultyRef', faculty_reference,
          'signatureAttested', private_content.approval_signature_attested
        ),
        'release', pg_catalog.jsonb_build_object(
          'documentId', private_content.final_document_id,
          'documentHash', new_release_document_hash,
          'releasedAt', event_occurred_at_iso,
          'releasedAtRevision', next_revision,
          'waiverReceiptId', current_waiver.receipt_id
        )
      );
      released_snapshot_hash := lor_studio.canonical_jsonb_sha256(released_snapshot);
      transaction_id := pg_catalog.pg_current_xact_id()::text;

      UPDATE lor_studio.recommendation_cases AS candidate
      SET revision = next_revision,
          updated_at = event_occurred_at,
          record_hash = safe_record_hash,
          protected_state_hash = new_protected_state_hash,
          release_document_id = private_content.final_document_id,
          release_document_hash = new_release_document_hash,
          released_at = event_occurred_at,
          released_at_revision = next_revision,
          release_waiver_receipt_id = current_waiver.receipt_id
      WHERE candidate.case_id = scope_case_id
        AND candidate.student_auth_subject = scope_student_subject
        AND candidate.revision = candidate_expected_revision
        AND candidate.released_at IS NULL;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN
        RAISE EXCEPTION 'LOR_STALE_REVISION' USING ERRCODE = 'P1002';
      END IF;

      UPDATE lor_studio.faculty_private_content AS candidate
      SET private_revision = next_revision,
          release_document_hash = new_release_document_hash,
          release_document_id = private_content.final_document_id,
          released_at = event_occurred_at,
          released_at_revision = next_revision,
          release_waiver_receipt_id = current_waiver.receipt_id,
          private_record_hash = new_private_record_hash,
          updated_at = event_occurred_at
      WHERE candidate.case_id = scope_case_id
        AND candidate.student_auth_subject = scope_student_subject
        AND candidate.faculty_auth_subject = faculty_subject
        AND candidate.faculty_auth_uid = faculty_uid
        AND candidate.invitation_id = scope_invitation_id
        AND candidate.private_revision = candidate_expected_revision
        AND candidate.released_at IS NULL;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN
        RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
      END IF;

      INSERT INTO lor_studio.recommendation_case_audit_events (
        event_ref,
        case_id,
        student_auth_subject,
        case_ref,
        actor_ref,
        actor_role,
        correlation_ref,
        event_type,
        outcome,
        revision,
        occurred_at,
        event,
        event_hash,
        transaction_id
      ) VALUES (
        candidate_event ->> 'eventRef',
        scope_case_id,
        scope_student_subject,
        candidate_event ->> 'caseRef',
        candidate_event ->> 'actorRef',
        'faculty',
        candidate_event ->> 'correlationRef',
        'faculty.final_document_released',
        'success',
        next_revision,
        event_occurred_at,
        candidate_event,
        candidate_event_hash,
        transaction_id
      );

      INSERT INTO lor_studio.recommendation_case_protected_revision_states (
        case_id,
        student_auth_subject,
        revision,
        previous_revision,
        previous_protected_state_hash,
        protected_state,
        protected_state_hash,
        event_hash,
        audit_event_ref,
        transaction_id,
        committed_at
      ) VALUES (
        scope_case_id,
        scope_student_subject,
        next_revision,
        recommendation_case.revision,
        previous_protected.protected_state_hash,
        new_protected_state,
        new_protected_state_hash,
        candidate_event_hash,
        candidate_event ->> 'eventRef',
        transaction_id,
        pg_catalog.transaction_timestamp()
      );

      INSERT INTO lor_studio.released_student_documents (
        case_id,
        student_auth_subject,
        final_document_id,
        final_document_text,
        final_document_content_hash,
        final_document_mime_type,
        approval_approved,
        approval_at,
        approval_faculty_ref,
        approval_signature_attested,
        release_document_id,
        release_document_hash,
        released_at,
        released_at_revision,
        waiver_receipt_id,
        snapshot_hash
      ) VALUES (
        scope_case_id,
        scope_student_subject,
        private_content.final_document_id,
        private_content.final_document_text,
        private_content.final_document_content_hash,
        private_content.final_document_mime_type,
        private_content.approval_approved,
        private_content.approval_at,
        faculty_reference,
        private_content.approval_signature_attested,
        private_content.final_document_id,
        new_release_document_hash,
        event_occurred_at,
        next_revision,
        current_waiver.receipt_id,
        released_snapshot_hash
      );

      INSERT INTO lor_studio.recommendation_case_private_write_receipts (
        case_id,
        student_auth_subject,
        faculty_auth_subject,
        faculty_auth_uid,
        idempotency_key,
        request_hash,
        command_type,
        operation,
        revision,
        status,
        created_at,
        updated_at,
        closed_at,
        safe_record,
        private_record,
        private_record_hash,
        safe_record_hash,
        protected_state_hash,
        released_snapshot_hash,
        event_hash,
        audit_event_ref,
        transaction_id,
        committed_at
      ) VALUES (
        scope_case_id,
        scope_student_subject,
        faculty_subject,
        faculty_uid,
        candidate_idempotency_key,
        candidate_request_hash,
        'faculty.final_document_release',
        'save',
        next_revision,
        recommendation_case.status,
        recommendation_case.created_at,
        event_occurred_at,
        recommendation_case.closed_at,
        recommendation_case.record,
        new_private_record,
        new_private_record_hash,
        safe_record_hash,
        new_protected_state_hash,
        released_snapshot_hash,
        candidate_event_hash,
        candidate_event ->> 'eventRef',
        transaction_id,
        pg_catalog.transaction_timestamp()
      )
      RETURNING * INTO stored_receipt;
    END IF;
  END IF;

  SELECT COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'schemaVersion', 'missionmed.lor.consent-receipt.v1',
          'id', receipt.receipt_id,
          'caseId', receipt.case_id,
          'actorId', receipt.student_auth_subject,
          'scopes', pg_catalog.to_jsonb(receipt.scopes),
          'policyVersion', receipt.policy_version,
          'recordedAt', pg_catalog.to_char(
            receipt.recorded_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
          'receiptHash', receipt.receipt_hash
        ) ORDER BY receipt.case_revision, receipt.recorded_at, receipt.receipt_id
      ),
      '[]'::jsonb
    )
    INTO consent_projection
  FROM lor_studio.consent_receipts AS receipt
  WHERE receipt.case_id = stored_receipt.case_id
    AND receipt.student_auth_subject = stored_receipt.student_auth_subject
    AND receipt.case_revision <= stored_receipt.revision;

  state_projection := pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.faculty-projection.v1',
    'caseId', stored_receipt.case_id,
    'revision', stored_receipt.revision,
    'status', stored_receipt.status,
    'studentShared', pg_catalog.jsonb_build_object(
      'evidence', stored_receipt.safe_record -> 'studentEvidence',
      'applicantOptions', stored_receipt.safe_record -> 'applicantOptions',
      'consentReceipts', consent_projection,
      'waiverState', pg_catalog.jsonb_build_object(
        'decided', true,
        'waived', false,
        'receiptId', stored_receipt.private_record
          -> 'finalDocumentState' -> 'release' ->> 'waiverReceiptId'
      )
    ),
    'facultyPrivate', stored_receipt.private_record -> 'facultyPrivate',
    'delivery', stored_receipt.safe_record -> 'delivery'
  );

  RETURN pg_catalog.jsonb_build_object(
    'schemaVersion', 'missionmed.lor.atomic-command-receipt.v2',
    'action', 'faculty.final_document_release',
    'committed', true,
    'replayed', replayed,
    'sameTransaction', true,
    'caseId', stored_receipt.case_id,
    'studentId', stored_receipt.student_auth_subject,
    'revision', stored_receipt.revision,
    'idempotencyKey', stored_receipt.idempotency_key,
    'requestHash', stored_receipt.request_hash,
    'safeRecordHash', stored_receipt.safe_record_hash,
    'protectedStateHash', stored_receipt.protected_state_hash,
    'eventHash', stored_receipt.event_hash,
    'auditEventRef', stored_receipt.audit_event_ref,
    'transactionId', stored_receipt.transaction_id,
    'state', state_projection
  );
EXCEPTION
  WHEN SQLSTATE 'P1001'
    OR SQLSTATE 'P1002'
    OR SQLSTATE 'P1003'
    OR SQLSTATE 'P1004'
    OR SQLSTATE 'P1005' THEN
    RAISE;
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'LOR_AUTHORIZATION_DENIED' USING ERRCODE = 'P1004';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'LOR_COMMAND_INVALID' USING ERRCODE = 'P1005';
END;
$faculty_release$;

REVOKE ALL ON FUNCTION lor_studio.commit_student_case_create(
  jsonb, text, text, jsonb, text, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.commit_student_builder_autosave(
  jsonb, bigint, text, text, jsonb, text, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.commit_student_builder_complete(
  jsonb, bigint, text, text, jsonb, text, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.commit_student_consent_receipt(
  jsonb, bigint, text, text, jsonb, text, jsonb, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.commit_student_waiver_receipt(
  jsonb, bigint, text, text, jsonb, text, jsonb, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.read_mentor_case_projection() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.read_faculty_case_projection() FROM PUBLIC;
REVOKE ALL ON FUNCTION lor_studio.commit_faculty_final_document_release(
  bigint, text, text, text, jsonb, text
) FROM PUBLIC;

ALTER FUNCTION lor_studio.commit_student_case_create(jsonb, text, text, jsonb, text, jsonb) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.commit_student_builder_autosave(jsonb, bigint, text, text, jsonb, text, jsonb) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.commit_student_builder_complete(jsonb, bigint, text, text, jsonb, text, jsonb) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.commit_student_consent_receipt(jsonb, bigint, text, text, jsonb, text, jsonb, jsonb) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.commit_student_waiver_receipt(jsonb, bigint, text, text, jsonb, text, jsonb, jsonb) OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.read_mentor_case_projection() OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.read_faculty_case_projection() OWNER TO lor_studio_command_owner;
ALTER FUNCTION lor_studio.commit_faculty_final_document_release(bigint, text, text, text, jsonb, text) OWNER TO lor_studio_command_owner;

CREATE VIEW lor_studio.student_recommendation_case_projection
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  recommendation_case.case_id,
  recommendation_case.student_auth_subject,
  recommendation_case.revision,
  recommendation_case.status,
  recommendation_case.created_at,
  recommendation_case.updated_at,
  recommendation_case.closed_at,
  recommendation_case.record,
  recommendation_case.record_hash,
  released_document.final_document_id,
  released_document.final_document_text,
  released_document.final_document_content_hash,
  released_document.final_document_mime_type,
  released_document.approval_approved,
  released_document.approval_at,
  released_document.approval_faculty_ref,
  released_document.approval_signature_attested,
  released_document.release_document_id,
  released_document.release_document_hash,
  released_document.released_at,
  released_document.released_at_revision,
  released_document.waiver_receipt_id,
  released_document.snapshot_hash
FROM lor_studio.recommendation_cases AS recommendation_case
LEFT JOIN lor_studio.released_student_documents AS released_document
  ON released_document.case_id = recommendation_case.case_id
  AND released_document.student_auth_subject = recommendation_case.student_auth_subject;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA lor_studio FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA lor_studio FROM PUBLIC;

GRANT USAGE ON SCHEMA lor_studio TO lor_studio_app;
GRANT USAGE ON SCHEMA lor_studio TO lor_studio_command_owner;

GRANT SELECT, INSERT, UPDATE ON TABLE
  lor_studio.recommendation_cases
TO lor_studio_command_owner;

GRANT SELECT, INSERT ON TABLE
  lor_studio.recommendation_case_protected_revision_states,
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_case_write_receipts,
  lor_studio.consent_receipts,
  lor_studio.waiver_receipts,
  lor_studio.released_student_documents,
  lor_studio.recommendation_case_private_write_receipts
TO lor_studio_command_owner;

GRANT SELECT, UPDATE ON TABLE
  lor_studio.faculty_private_content
TO lor_studio_command_owner;

-- PostgreSQL requires UPDATE ACL for SELECT ... FOR UPDATE.  The command role
-- receives that ACL solely to serialize on the immutable creation reservation;
-- no UPDATE RLS policy exists and the append-only trigger remains authoritative.
GRANT SELECT, UPDATE ON TABLE
  lor_studio.recommendation_case_creation_reservations
TO lor_studio_command_owner;

GRANT SELECT ON TABLE
  lor_studio.student_auth_bindings,
  lor_studio.student_auth_binding_revocations,
  lor_studio.mentor_case_assignments,
  lor_studio.mentor_case_assignment_revocations,
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.faculty_otp_proof_revocations
TO lor_studio_command_owner;

GRANT EXECUTE ON FUNCTION lor_studio.canonical_jsonb_text(jsonb) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.canonical_jsonb_sha256(jsonb) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.release_document_hash(text, text, text, text) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.protected_state_chain_hash(text, text, bigint, text, text, jsonb) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.student_record_is_safe(jsonb) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.private_record_is_complete(jsonb) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.protected_case_state_is_complete(jsonb, bigint) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.audit_event_is_metadata(jsonb) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.text_array_is_sorted_unique(text[]) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.student_context_allows(text, text, uuid, text[]) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.student_write_axes_satisfied() TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.commit_student_case_command(jsonb, bigint, text, text, text, text, jsonb, text, jsonb, text, jsonb) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.mentor_context_allows(text, text, text[]) TO lor_studio_command_owner;
GRANT EXECUTE ON FUNCTION lor_studio.faculty_context_allows(text, text, text[]) TO lor_studio_command_owner;

GRANT SELECT ON TABLE
  lor_studio.student_auth_bindings,
  lor_studio.student_auth_binding_revocations,
  lor_studio.administrative_case_grants,
  lor_studio.administrative_case_grant_revocations,
  lor_studio.recommendation_cases,
  lor_studio.released_student_documents,
  lor_studio.consent_receipts,
  lor_studio.waiver_receipts,
  lor_studio.student_recommendation_case_projection
TO lor_studio_app;

GRANT SELECT, INSERT ON TABLE
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_case_creation_reservations,
  lor_studio.ai_generation_runs,
  lor_studio.ai_letter_proposals,
  lor_studio.deletion_intents,
  lor_studio.deletion_hold_releases,
  lor_studio.deletion_receipts
TO lor_studio_app;

-- The corresponding operational INSERT policies remain policy-only and inert:
-- these private restore surfaces require a successor actor-safe command and
-- immutable receipt before the application role may mint either record.
GRANT SELECT ON TABLE
  lor_studio.writer_depot_artifacts,
  lor_studio.ai_proposal_decisions
TO lor_studio_app;

GRANT EXECUTE ON FUNCTION lor_studio.commit_student_case_create(jsonb, text, text, jsonb, text, jsonb) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.commit_student_builder_autosave(jsonb, bigint, text, text, jsonb, text, jsonb) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.commit_student_builder_complete(jsonb, bigint, text, text, jsonb, text, jsonb) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.commit_student_consent_receipt(jsonb, bigint, text, text, jsonb, text, jsonb, jsonb) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.commit_student_waiver_receipt(jsonb, bigint, text, text, jsonb, text, jsonb, jsonb) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.read_mentor_case_projection() TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.read_faculty_case_projection() TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.commit_faculty_final_document_release(bigint, text, text, text, jsonb, text) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.student_context_allows(text, text, uuid, text[]) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.student_write_axes_satisfied() TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.operational_content_context_allows(text, text, text[], text[]) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.audit_event_is_metadata(jsonb) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.ai_grounding_manifest_is_complete(jsonb) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.canonical_jsonb_text(jsonb) TO lor_studio_app;
GRANT EXECUTE ON FUNCTION lor_studio.canonical_jsonb_sha256(jsonb) TO lor_studio_app;

COMMIT;
