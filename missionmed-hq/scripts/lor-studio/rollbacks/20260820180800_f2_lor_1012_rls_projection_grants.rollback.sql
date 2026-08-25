-- Rollback: 20260820180800_f2_lor_1012_rls_projection_grants.rollback.sql
-- Authority: F2-LOR-1012 / DR-120
-- Reverses: 20260820180800_f2_lor_1012_rls_projection_grants.sql
-- Boundary: empty synthetic disposable local PostgreSQL harness only
-- Verification: TARGET SPECIFICATION ONLY until final forward-ledger parity and a disposable real-PostgreSQL round trip pass.

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
    RAISE EXCEPTION 'DR-120 rollback requires the exact sentinel-bound disposable Unix-socket harness identity'
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
  expected_semantic_count constant bigint := 844;
  expected_semantic_fingerprint constant text := CASE postgres_major
    WHEN 16 THEN '3da853a0b89d62335398c33f3e14d81b4c8505675935fa014f3bfd11355d06e4'
    WHEN 18 THEN 'a87dcb9e67299d06c119c1b8885dd7f60a4a2234bcf6cee012280ba05b679696'
    ELSE NULL
  END;
  observed_relations text[];
  observed_views text[];
  observed_functions text[];
  observed_policies text[];
  observed_triggers text[];
  observed_rls text[];
  observed_nonowner_acls text[];
  observed_index_count bigint;
  observed_index_fingerprint text;
  observed_constraint_count bigint;
  observed_constraint_fingerprint text;
  observed_semantic_count bigint;
  observed_semantic_fingerprint text;
  observed_default_acl_types text[];
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
    'commit_faculty_final_document_release(bigint,text,text,text,jsonb,text)@command_owner:true',
    'commit_student_builder_autosave(jsonb,bigint,text,text,jsonb,text,jsonb)@command_owner:true',
    'commit_student_builder_complete(jsonb,bigint,text,text,jsonb,text,jsonb)@command_owner:true',
    'commit_student_case_command(jsonb,bigint,text,text,text,text,jsonb,text,jsonb,text,jsonb)@migration_admin:false',
    'commit_student_case_create(jsonb,text,text,jsonb,text,jsonb)@command_owner:true',
    'commit_student_consent_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)@command_owner:true',
    'commit_student_waiver_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)@command_owner:true',
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
    'faculty_context_allows(text,text,text[])@migration_admin:false',
    'mentor_context_allows(text,text,text[])@migration_admin:false',
    'operational_content_context_allows(text,text,text[],text[])@migration_admin:false',
    'private_record_is_complete(jsonb)@migration_admin:false',
    'protected_case_state_is_complete(jsonb,bigint)@migration_admin:false',
    'protected_state_chain_hash(text,text,bigint,text,text,jsonb)@migration_admin:false',
    'read_faculty_case_projection()@command_owner:true',
    'read_mentor_case_projection()@command_owner:true',
    'reject_append_only_mutation()@migration_admin:false',
    'reject_waiver_after_student_release()@migration_admin:false',
    'release_document_hash(text,text,text,text)@migration_admin:false',
    'student_context_allows(text,text,uuid,text[])@migration_admin:false',
    'student_record_is_safe(jsonb)@migration_admin:false',
    'student_write_axes_satisfied()@migration_admin:false',
    'text_array_is_sorted_unique(text[])@migration_admin:false'
  ]::text[];
  expected_policies constant text[] := ARRAY[
    'administrative_case_grant_revocations_bound_principal_select@administrative_case_grant_revocations:SELECT:app',
    'administrative_case_grants_bound_principal_select@administrative_case_grants:SELECT:app',
    'ai_generation_runs_faculty_insert@ai_generation_runs:INSERT:command_owner',
    'ai_generation_runs_faculty_select@ai_generation_runs:SELECT:command_owner',
    'ai_generation_runs_operational_insert@ai_generation_runs:INSERT:app',
    'ai_generation_runs_operational_select@ai_generation_runs:SELECT:app',
    'ai_letter_proposals_faculty_insert@ai_letter_proposals:INSERT:command_owner',
    'ai_letter_proposals_faculty_select@ai_letter_proposals:SELECT:command_owner',
    'ai_letter_proposals_operational_insert@ai_letter_proposals:INSERT:app',
    'ai_letter_proposals_operational_select@ai_letter_proposals:SELECT:app',
    'ai_proposal_decisions_faculty_insert@ai_proposal_decisions:INSERT:command_owner',
    'ai_proposal_decisions_faculty_select@ai_proposal_decisions:SELECT:command_owner',
    'ai_proposal_decisions_operational_insert@ai_proposal_decisions:INSERT:app',
    'ai_proposal_decisions_operational_select@ai_proposal_decisions:SELECT:app',
    'case_creation_reservations_student_command_lock@recommendation_case_creation_reservations:UPDATE:command_owner',
    'case_creation_reservations_student_command_select@recommendation_case_creation_reservations:SELECT:command_owner',
    'case_creation_reservations_student_insert@recommendation_case_creation_reservations:INSERT:app',
    'case_creation_reservations_student_select@recommendation_case_creation_reservations:SELECT:app',
    'consent_receipts_faculty_command_select@consent_receipts:SELECT:command_owner',
    'consent_receipts_operational_select@consent_receipts:SELECT:app',
    'consent_receipts_student_command_insert@consent_receipts:INSERT:command_owner',
    'consent_receipts_student_command_select@consent_receipts:SELECT:command_owner',
    'consent_receipts_student_select@consent_receipts:SELECT:app',
    'deletion_hold_releases_operational_insert@deletion_hold_releases:INSERT:app',
    'deletion_hold_releases_operational_select@deletion_hold_releases:SELECT:app',
    'deletion_intents_operational_insert@deletion_intents:INSERT:app',
    'deletion_intents_operational_select@deletion_intents:SELECT:app',
    'deletion_intents_student_insert@deletion_intents:INSERT:app',
    'deletion_intents_student_select@deletion_intents:SELECT:app',
    'deletion_receipts_operational_insert@deletion_receipts:INSERT:app',
    'deletion_receipts_operational_select@deletion_receipts:SELECT:app',
    'deletion_receipts_student_select@deletion_receipts:SELECT:app',
    'faculty_invitations_faculty_command_select@faculty_invitations:SELECT:command_owner',
    'faculty_otp_proof_revocations_faculty_command_select@faculty_otp_proof_revocations:SELECT:command_owner',
    'faculty_otp_verification_receipts_faculty_command_select@faculty_otp_verification_receipts:SELECT:command_owner',
    'faculty_private_content_faculty_command_select@faculty_private_content:SELECT:command_owner',
    'faculty_private_content_faculty_command_update@faculty_private_content:UPDATE:command_owner',
    'faculty_private_content_operational_insert@faculty_private_content:INSERT:app',
    'faculty_private_content_operational_select@faculty_private_content:SELECT:app',
    'faculty_private_content_operational_update@faculty_private_content:UPDATE:app',
    'mentor_case_assignment_revocations_bound_principal_select@mentor_case_assignment_revocations:SELECT:app',
    'mentor_case_assignment_revocations_command_select@mentor_case_assignment_revocations:SELECT:command_owner',
    'mentor_case_assignments_bound_principal_select@mentor_case_assignments:SELECT:app',
    'mentor_case_assignments_command_select@mentor_case_assignments:SELECT:command_owner',
    'private_write_receipts_faculty_command_insert@recommendation_case_private_write_receipts:INSERT:command_owner',
    'private_write_receipts_faculty_command_select@recommendation_case_private_write_receipts:SELECT:command_owner',
    'private_write_receipts_operational_insert@recommendation_case_private_write_receipts:INSERT:app',
    'private_write_receipts_operational_select@recommendation_case_private_write_receipts:SELECT:app',
    'protected_revision_states_faculty_command_insert@recommendation_case_protected_revision_states:INSERT:command_owner',
    'protected_revision_states_faculty_command_select@recommendation_case_protected_revision_states:SELECT:command_owner',
    'protected_revision_states_mentor_command_select@recommendation_case_protected_revision_states:SELECT:command_owner',
    'protected_revision_states_operational_insert@recommendation_case_protected_revision_states:INSERT:app',
    'protected_revision_states_operational_select@recommendation_case_protected_revision_states:SELECT:app',
    'protected_revision_states_student_command_insert@recommendation_case_protected_revision_states:INSERT:command_owner',
    'protected_revision_states_student_command_select@recommendation_case_protected_revision_states:SELECT:command_owner',
    'recommendation_case_audit_events_faculty_command_insert@recommendation_case_audit_events:INSERT:command_owner',
    'recommendation_case_audit_events_faculty_command_select@recommendation_case_audit_events:SELECT:command_owner',
    'recommendation_case_audit_events_legal_hold_insert@recommendation_case_audit_events:INSERT:app',
    'recommendation_case_audit_events_legal_hold_select@recommendation_case_audit_events:SELECT:app',
    'recommendation_case_audit_events_student_command_insert@recommendation_case_audit_events:INSERT:command_owner',
    'recommendation_case_audit_events_student_command_select@recommendation_case_audit_events:SELECT:command_owner',
    'recommendation_case_write_receipts_student_command_insert@recommendation_case_write_receipts:INSERT:command_owner',
    'recommendation_case_write_receipts_student_command_select@recommendation_case_write_receipts:SELECT:command_owner',
    'recommendation_cases_faculty_command_select@recommendation_cases:SELECT:command_owner',
    'recommendation_cases_faculty_command_update@recommendation_cases:UPDATE:command_owner',
    'recommendation_cases_mentor_command_select@recommendation_cases:SELECT:command_owner',
    'recommendation_cases_operational_select@recommendation_cases:SELECT:app',
    'recommendation_cases_operational_update@recommendation_cases:UPDATE:app',
    'recommendation_cases_student_command_insert@recommendation_cases:INSERT:command_owner',
    'recommendation_cases_student_command_select@recommendation_cases:SELECT:command_owner',
    'recommendation_cases_student_command_update@recommendation_cases:UPDATE:command_owner',
    'recommendation_cases_student_select@recommendation_cases:SELECT:app',
    'released_student_documents_faculty_command_insert@released_student_documents:INSERT:command_owner',
    'released_student_documents_faculty_command_select@released_student_documents:SELECT:command_owner',
    'released_student_documents_operational_insert@released_student_documents:INSERT:app',
    'released_student_documents_operational_select@released_student_documents:SELECT:app',
    'released_student_documents_student_command_select@released_student_documents:SELECT:command_owner',
    'released_student_documents_student_select@released_student_documents:SELECT:app',
    'student_auth_binding_revocations_command_select@student_auth_binding_revocations:SELECT:command_owner',
    'student_auth_binding_revocations_student_select@student_auth_binding_revocations:SELECT:app',
    'student_auth_bindings_command_select@student_auth_bindings:SELECT:command_owner',
    'student_auth_bindings_student_select@student_auth_bindings:SELECT:app',
    'waiver_receipts_faculty_command_select@waiver_receipts:SELECT:command_owner',
    'waiver_receipts_operational_select@waiver_receipts:SELECT:app',
    'waiver_receipts_student_command_insert@waiver_receipts:INSERT:command_owner',
    'waiver_receipts_student_command_select@waiver_receipts:SELECT:command_owner',
    'waiver_receipts_student_select@waiver_receipts:SELECT:app',
    'writer_depot_artifacts_faculty_insert@writer_depot_artifacts:INSERT:command_owner',
    'writer_depot_artifacts_faculty_select@writer_depot_artifacts:SELECT:command_owner',
    'writer_depot_artifacts_operational_insert@writer_depot_artifacts:INSERT:app',
    'writer_depot_artifacts_operational_select@writer_depot_artifacts:SELECT:app'
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
  expected_nonowner_acls constant text[] := ARRAY[
    'function:ai_grounding_manifest_is_complete(jsonb):app:EXECUTE:false',
    'function:audit_event_is_metadata(jsonb):app:EXECUTE:false',
    'function:audit_event_is_metadata(jsonb):command_owner:EXECUTE:false',
    'function:canonical_jsonb_sha256(jsonb):app:EXECUTE:false',
    'function:canonical_jsonb_sha256(jsonb):command_owner:EXECUTE:false',
    'function:canonical_jsonb_text(jsonb):app:EXECUTE:false',
    'function:canonical_jsonb_text(jsonb):command_owner:EXECUTE:false',
    'function:commit_faculty_final_document_release(bigint,text,text,text,jsonb,text):app:EXECUTE:false',
    'function:commit_student_builder_autosave(jsonb,bigint,text,text,jsonb,text,jsonb):app:EXECUTE:false',
    'function:commit_student_builder_complete(jsonb,bigint,text,text,jsonb,text,jsonb):app:EXECUTE:false',
    'function:commit_student_case_command(jsonb,bigint,text,text,text,text,jsonb,text,jsonb,text,jsonb):command_owner:EXECUTE:false',
    'function:commit_student_case_create(jsonb,text,text,jsonb,text,jsonb):app:EXECUTE:false',
    'function:commit_student_consent_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb):app:EXECUTE:false',
    'function:commit_student_waiver_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb):app:EXECUTE:false',
    'function:faculty_context_allows(text,text,text[]):command_owner:EXECUTE:false',
    'function:mentor_context_allows(text,text,text[]):command_owner:EXECUTE:false',
    'function:operational_content_context_allows(text,text,text[],text[]):app:EXECUTE:false',
    'function:private_record_is_complete(jsonb):command_owner:EXECUTE:false',
    'function:protected_case_state_is_complete(jsonb,bigint):command_owner:EXECUTE:false',
    'function:protected_state_chain_hash(text,text,bigint,text,text,jsonb):command_owner:EXECUTE:false',
    'function:read_faculty_case_projection():app:EXECUTE:false',
    'function:read_mentor_case_projection():app:EXECUTE:false',
    'function:release_document_hash(text,text,text,text):command_owner:EXECUTE:false',
    'function:student_context_allows(text,text,uuid,text[]):app:EXECUTE:false',
    'function:student_context_allows(text,text,uuid,text[]):command_owner:EXECUTE:false',
    'function:student_record_is_safe(jsonb):command_owner:EXECUTE:false',
    'function:student_write_axes_satisfied():app:EXECUTE:false',
    'function:student_write_axes_satisfied():command_owner:EXECUTE:false',
    'function:text_array_is_sorted_unique(text[]):command_owner:EXECUTE:false',
    'relation:administrative_case_grant_revocations:app:SELECT:false',
    'relation:administrative_case_grants:app:SELECT:false',
    'relation:ai_generation_runs:app:INSERT:false',
    'relation:ai_generation_runs:app:SELECT:false',
    'relation:ai_letter_proposals:app:INSERT:false',
    'relation:ai_letter_proposals:app:SELECT:false',
    'relation:ai_proposal_decisions:app:SELECT:false',
    'relation:consent_receipts:app:SELECT:false',
    'relation:consent_receipts:command_owner:INSERT:false',
    'relation:consent_receipts:command_owner:SELECT:false',
    'relation:deletion_hold_releases:app:INSERT:false',
    'relation:deletion_hold_releases:app:SELECT:false',
    'relation:deletion_intents:app:INSERT:false',
    'relation:deletion_intents:app:SELECT:false',
    'relation:deletion_receipts:app:INSERT:false',
    'relation:deletion_receipts:app:SELECT:false',
    'relation:faculty_invitations:command_owner:SELECT:false',
    'relation:faculty_otp_proof_revocations:command_owner:SELECT:false',
    'relation:faculty_otp_verification_receipts:command_owner:SELECT:false',
    'relation:faculty_private_content:command_owner:SELECT:false',
    'relation:faculty_private_content:command_owner:UPDATE:false',
    'relation:mentor_case_assignment_revocations:command_owner:SELECT:false',
    'relation:mentor_case_assignments:command_owner:SELECT:false',
    'relation:recommendation_case_audit_events:app:INSERT:false',
    'relation:recommendation_case_audit_events:app:SELECT:false',
    'relation:recommendation_case_audit_events:command_owner:INSERT:false',
    'relation:recommendation_case_audit_events:command_owner:SELECT:false',
    'relation:recommendation_case_creation_reservations:app:INSERT:false',
    'relation:recommendation_case_creation_reservations:app:SELECT:false',
    'relation:recommendation_case_creation_reservations:command_owner:SELECT:false',
    'relation:recommendation_case_creation_reservations:command_owner:UPDATE:false',
    'relation:recommendation_case_private_write_receipts:command_owner:INSERT:false',
    'relation:recommendation_case_private_write_receipts:command_owner:SELECT:false',
    'relation:recommendation_case_protected_revision_states:command_owner:INSERT:false',
    'relation:recommendation_case_protected_revision_states:command_owner:SELECT:false',
    'relation:recommendation_case_write_receipts:command_owner:INSERT:false',
    'relation:recommendation_case_write_receipts:command_owner:SELECT:false',
    'relation:recommendation_cases:app:SELECT:false',
    'relation:recommendation_cases:command_owner:INSERT:false',
    'relation:recommendation_cases:command_owner:SELECT:false',
    'relation:recommendation_cases:command_owner:UPDATE:false',
    'relation:released_student_documents:app:SELECT:false',
    'relation:released_student_documents:command_owner:INSERT:false',
    'relation:released_student_documents:command_owner:SELECT:false',
    'relation:student_auth_binding_revocations:app:SELECT:false',
    'relation:student_auth_binding_revocations:command_owner:SELECT:false',
    'relation:student_auth_bindings:app:SELECT:false',
    'relation:student_auth_bindings:command_owner:SELECT:false',
    'relation:student_recommendation_case_projection:app:SELECT:false',
    'relation:waiver_receipts:app:SELECT:false',
    'relation:waiver_receipts:command_owner:INSERT:false',
    'relation:waiver_receipts:command_owner:SELECT:false',
    'relation:writer_depot_artifacts:app:SELECT:false',
    'schema:lor_studio:app:USAGE:false',
    'schema:lor_studio:command_owner:USAGE:false'
  ]::text[];
BEGIN
  IF migration_admin_oid IS NULL
    OR app_role_oid IS NULL
    OR command_owner_oid IS NULL
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname LIKE 'lor_studio_%'
    ) <> 2
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
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
    ) <> 2
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_auth_members AS membership
      WHERE membership.roleid IN (app_role_oid, command_owner_oid)
        OR membership.member IN (app_role_oid, command_owner_oid)
    ) <> 0
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_default_acl AS default_acl
      WHERE default_acl.defaclrole IN (app_role_oid, command_owner_oid)
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
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r';

  SELECT COALESCE(
    pg_catalog.array_agg(
      pg_catalog.format('%s@%s', class.relname, pg_catalog.pg_get_userbyid(class.relowner))
      ORDER BY class.relname
    ),
    ARRAY[]::text[]
  )
  INTO observed_views
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind IN ('v', 'm');

  SELECT COALESCE(
    pg_catalog.array_agg(
      pg_catalog.format(
        '%s(%s)@%s:%s',
        procedure.proname,
        pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ' ', ''),
        CASE
          WHEN procedure.proowner = migration_admin_oid THEN 'migration_admin'
          WHEN procedure.proowner = command_owner_oid THEN 'command_owner'
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
    pg_catalog.array_agg(
      pg_catalog.format(
        '%s@%s:%s:%s',
        policy.policyname,
        policy.tablename,
        policy.cmd,
        CASE
          WHEN policy.roles = ARRAY['lor_studio_app']::name[] THEN 'app'
          WHEN policy.roles = ARRAY['lor_studio_command_owner']::name[] THEN 'command_owner'
          ELSE pg_catalog.array_to_string(policy.roles, ',')
        END
      )
      ORDER BY policy.policyname
    ),
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
  WHERE namespace.nspname = 'lor_studio' AND trigger.tgisinternal IS FALSE;

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
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r';

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
    OR observed_views IS DISTINCT FROM ARRAY[
      'student_recommendation_case_projection@' || current_user
    ]::text[]
    OR observed_functions IS DISTINCT FROM expected_functions
    OR observed_policies IS DISTINCT FROM expected_policies
    OR observed_triggers IS DISTINCT FROM expected_triggers
    OR observed_rls IS DISTINCT FROM (
      SELECT pg_catalog.array_agg(relation_name || ':true:true' ORDER BY relation_name)
      FROM pg_catalog.unnest(expected_relations) AS relation_name
    )
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relkind NOT IN ('r', 'i', 'v')
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
    SELECT pg_catalog.format(
      'schema:%s:%s:%s:%s',
      namespace.nspname,
      CASE
        WHEN acl.grantee = app_role_oid THEN 'app'
        WHEN acl.grantee = command_owner_oid THEN 'command_owner'
        WHEN acl.grantee = 0 THEN 'PUBLIC'
        ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text
      END,
      acl.privilege_type,
      acl.is_grantable::text
    ) AS acl_entry
    FROM pg_catalog.pg_namespace AS namespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
    ) AS acl
    WHERE namespace.nspname = 'lor_studio' AND acl.grantee <> namespace.nspowner
    UNION ALL
    SELECT pg_catalog.format(
      'relation:%s:%s:%s:%s',
      class.relname,
      CASE
        WHEN acl.grantee = app_role_oid THEN 'app'
        WHEN acl.grantee = command_owner_oid THEN 'command_owner'
        WHEN acl.grantee = 0 THEN 'PUBLIC'
        ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text
      END,
      acl.privilege_type,
      acl.is_grantable::text
    )
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))
    ) AS acl
    WHERE namespace.nspname = 'lor_studio' AND acl.grantee <> class.relowner
    UNION ALL
    SELECT pg_catalog.format(
      'function:%s(%s):%s:%s:%s',
      procedure.proname,
      pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ' ', ''),
      CASE
        WHEN acl.grantee = app_role_oid THEN 'app'
        WHEN acl.grantee = command_owner_oid THEN 'command_owner'
        WHEN acl.grantee = 0 THEN 'PUBLIC'
        ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text
      END,
      acl.privilege_type,
      acl.is_grantable::text
    )
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
    ) AS acl
    WHERE namespace.nspname = 'lor_studio' AND acl.grantee <> procedure.proowner
    UNION ALL
    SELECT pg_catalog.format(
      'column:%s.%s:%s:%s:%s',
      class.relname,
      attribute.attname,
      CASE
        WHEN acl.grantee = app_role_oid THEN 'app'
        WHEN acl.grantee = command_owner_oid THEN 'command_owner'
        WHEN acl.grantee = 0 THEN 'PUBLIC'
        ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text
      END,
      acl.privilege_type,
      acl.is_grantable::text
    )
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
    WHERE namespace.nspname = 'lor_studio'
      AND attribute.attnum > 0
      AND attribute.attacl IS NOT NULL
      AND acl.grantee <> class.relowner
  )
  SELECT COALESCE(
    pg_catalog.array_agg(acl_entry ORDER BY acl_entry),
    ARRAY[]::text[]
  )
  INTO observed_nonowner_acls
  FROM acl_entries;

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

  IF observed_nonowner_acls IS DISTINCT FROM expected_nonowner_acls
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

-- Literal reverse operations follow. This marker is consumed by static custody tests.

REVOKE EXECUTE ON FUNCTION lor_studio.commit_student_case_create(jsonb, text, text, jsonb, text, jsonb) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.commit_student_builder_autosave(jsonb, bigint, text, text, jsonb, text, jsonb) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.commit_student_builder_complete(jsonb, bigint, text, text, jsonb, text, jsonb) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.commit_student_consent_receipt(jsonb, bigint, text, text, jsonb, text, jsonb, jsonb) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.commit_student_waiver_receipt(jsonb, bigint, text, text, jsonb, text, jsonb, jsonb) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.read_mentor_case_projection() FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.read_faculty_case_projection() FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.commit_faculty_final_document_release(bigint, text, text, text, jsonb, text) FROM lor_studio_app;

DROP POLICY administrative_case_grant_revocations_bound_principal_select ON lor_studio.administrative_case_grant_revocations;
DROP POLICY administrative_case_grants_bound_principal_select ON lor_studio.administrative_case_grants;
DROP POLICY ai_generation_runs_faculty_insert ON lor_studio.ai_generation_runs;
DROP POLICY ai_generation_runs_faculty_select ON lor_studio.ai_generation_runs;
DROP POLICY ai_generation_runs_operational_insert ON lor_studio.ai_generation_runs;
DROP POLICY ai_generation_runs_operational_select ON lor_studio.ai_generation_runs;
DROP POLICY ai_letter_proposals_faculty_insert ON lor_studio.ai_letter_proposals;
DROP POLICY ai_letter_proposals_faculty_select ON lor_studio.ai_letter_proposals;
DROP POLICY ai_letter_proposals_operational_insert ON lor_studio.ai_letter_proposals;
DROP POLICY ai_letter_proposals_operational_select ON lor_studio.ai_letter_proposals;
DROP POLICY ai_proposal_decisions_faculty_insert ON lor_studio.ai_proposal_decisions;
DROP POLICY ai_proposal_decisions_faculty_select ON lor_studio.ai_proposal_decisions;
DROP POLICY ai_proposal_decisions_operational_insert ON lor_studio.ai_proposal_decisions;
DROP POLICY ai_proposal_decisions_operational_select ON lor_studio.ai_proposal_decisions;
DROP POLICY case_creation_reservations_student_command_lock ON lor_studio.recommendation_case_creation_reservations;
DROP POLICY case_creation_reservations_student_command_select ON lor_studio.recommendation_case_creation_reservations;
DROP POLICY case_creation_reservations_student_insert ON lor_studio.recommendation_case_creation_reservations;
DROP POLICY case_creation_reservations_student_select ON lor_studio.recommendation_case_creation_reservations;
DROP POLICY consent_receipts_faculty_command_select ON lor_studio.consent_receipts;
DROP POLICY consent_receipts_operational_select ON lor_studio.consent_receipts;
DROP POLICY consent_receipts_student_command_insert ON lor_studio.consent_receipts;
DROP POLICY consent_receipts_student_command_select ON lor_studio.consent_receipts;
DROP POLICY consent_receipts_student_select ON lor_studio.consent_receipts;
DROP POLICY deletion_hold_releases_operational_insert ON lor_studio.deletion_hold_releases;
DROP POLICY deletion_hold_releases_operational_select ON lor_studio.deletion_hold_releases;
DROP POLICY deletion_intents_operational_insert ON lor_studio.deletion_intents;
DROP POLICY deletion_intents_operational_select ON lor_studio.deletion_intents;
DROP POLICY deletion_intents_student_insert ON lor_studio.deletion_intents;
DROP POLICY deletion_intents_student_select ON lor_studio.deletion_intents;
DROP POLICY deletion_receipts_operational_insert ON lor_studio.deletion_receipts;
DROP POLICY deletion_receipts_operational_select ON lor_studio.deletion_receipts;
DROP POLICY deletion_receipts_student_select ON lor_studio.deletion_receipts;
DROP POLICY faculty_invitations_faculty_command_select ON lor_studio.faculty_invitations;
DROP POLICY faculty_otp_proof_revocations_faculty_command_select ON lor_studio.faculty_otp_proof_revocations;
DROP POLICY faculty_otp_verification_receipts_faculty_command_select ON lor_studio.faculty_otp_verification_receipts;
DROP POLICY faculty_private_content_faculty_command_select ON lor_studio.faculty_private_content;
DROP POLICY faculty_private_content_faculty_command_update ON lor_studio.faculty_private_content;
DROP POLICY faculty_private_content_operational_insert ON lor_studio.faculty_private_content;
DROP POLICY faculty_private_content_operational_select ON lor_studio.faculty_private_content;
DROP POLICY faculty_private_content_operational_update ON lor_studio.faculty_private_content;
DROP POLICY mentor_case_assignment_revocations_bound_principal_select ON lor_studio.mentor_case_assignment_revocations;
DROP POLICY mentor_case_assignment_revocations_command_select ON lor_studio.mentor_case_assignment_revocations;
DROP POLICY mentor_case_assignments_bound_principal_select ON lor_studio.mentor_case_assignments;
DROP POLICY mentor_case_assignments_command_select ON lor_studio.mentor_case_assignments;
DROP POLICY private_write_receipts_faculty_command_insert ON lor_studio.recommendation_case_private_write_receipts;
DROP POLICY private_write_receipts_faculty_command_select ON lor_studio.recommendation_case_private_write_receipts;
DROP POLICY private_write_receipts_operational_insert ON lor_studio.recommendation_case_private_write_receipts;
DROP POLICY private_write_receipts_operational_select ON lor_studio.recommendation_case_private_write_receipts;
DROP POLICY protected_revision_states_faculty_command_insert ON lor_studio.recommendation_case_protected_revision_states;
DROP POLICY protected_revision_states_faculty_command_select ON lor_studio.recommendation_case_protected_revision_states;
DROP POLICY protected_revision_states_mentor_command_select ON lor_studio.recommendation_case_protected_revision_states;
DROP POLICY protected_revision_states_operational_insert ON lor_studio.recommendation_case_protected_revision_states;
DROP POLICY protected_revision_states_operational_select ON lor_studio.recommendation_case_protected_revision_states;
DROP POLICY protected_revision_states_student_command_insert ON lor_studio.recommendation_case_protected_revision_states;
DROP POLICY protected_revision_states_student_command_select ON lor_studio.recommendation_case_protected_revision_states;
DROP POLICY recommendation_case_audit_events_faculty_command_insert ON lor_studio.recommendation_case_audit_events;
DROP POLICY recommendation_case_audit_events_faculty_command_select ON lor_studio.recommendation_case_audit_events;
DROP POLICY recommendation_case_audit_events_legal_hold_insert ON lor_studio.recommendation_case_audit_events;
DROP POLICY recommendation_case_audit_events_legal_hold_select ON lor_studio.recommendation_case_audit_events;
DROP POLICY recommendation_case_audit_events_student_command_insert ON lor_studio.recommendation_case_audit_events;
DROP POLICY recommendation_case_audit_events_student_command_select ON lor_studio.recommendation_case_audit_events;
DROP POLICY recommendation_case_write_receipts_student_command_insert ON lor_studio.recommendation_case_write_receipts;
DROP POLICY recommendation_case_write_receipts_student_command_select ON lor_studio.recommendation_case_write_receipts;
DROP POLICY recommendation_cases_faculty_command_select ON lor_studio.recommendation_cases;
DROP POLICY recommendation_cases_faculty_command_update ON lor_studio.recommendation_cases;
DROP POLICY recommendation_cases_mentor_command_select ON lor_studio.recommendation_cases;
DROP POLICY recommendation_cases_operational_select ON lor_studio.recommendation_cases;
DROP POLICY recommendation_cases_operational_update ON lor_studio.recommendation_cases;
DROP POLICY recommendation_cases_student_command_insert ON lor_studio.recommendation_cases;
DROP POLICY recommendation_cases_student_command_select ON lor_studio.recommendation_cases;
DROP POLICY recommendation_cases_student_command_update ON lor_studio.recommendation_cases;
DROP POLICY recommendation_cases_student_select ON lor_studio.recommendation_cases;
DROP POLICY released_student_documents_faculty_command_insert ON lor_studio.released_student_documents;
DROP POLICY released_student_documents_faculty_command_select ON lor_studio.released_student_documents;
DROP POLICY released_student_documents_operational_insert ON lor_studio.released_student_documents;
DROP POLICY released_student_documents_operational_select ON lor_studio.released_student_documents;
DROP POLICY released_student_documents_student_command_select ON lor_studio.released_student_documents;
DROP POLICY released_student_documents_student_select ON lor_studio.released_student_documents;
DROP POLICY student_auth_binding_revocations_command_select ON lor_studio.student_auth_binding_revocations;
DROP POLICY student_auth_binding_revocations_student_select ON lor_studio.student_auth_binding_revocations;
DROP POLICY student_auth_bindings_command_select ON lor_studio.student_auth_bindings;
DROP POLICY student_auth_bindings_student_select ON lor_studio.student_auth_bindings;
DROP POLICY waiver_receipts_faculty_command_select ON lor_studio.waiver_receipts;
DROP POLICY waiver_receipts_operational_select ON lor_studio.waiver_receipts;
DROP POLICY waiver_receipts_student_command_insert ON lor_studio.waiver_receipts;
DROP POLICY waiver_receipts_student_command_select ON lor_studio.waiver_receipts;
DROP POLICY waiver_receipts_student_select ON lor_studio.waiver_receipts;
DROP POLICY writer_depot_artifacts_faculty_insert ON lor_studio.writer_depot_artifacts;
DROP POLICY writer_depot_artifacts_faculty_select ON lor_studio.writer_depot_artifacts;
DROP POLICY writer_depot_artifacts_operational_insert ON lor_studio.writer_depot_artifacts;
DROP POLICY writer_depot_artifacts_operational_select ON lor_studio.writer_depot_artifacts;

REVOKE SELECT, INSERT, UPDATE ON TABLE lor_studio.recommendation_cases FROM lor_studio_command_owner;
REVOKE SELECT, INSERT ON TABLE
  lor_studio.recommendation_case_protected_revision_states,
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_case_write_receipts,
  lor_studio.consent_receipts,
  lor_studio.waiver_receipts,
  lor_studio.released_student_documents,
  lor_studio.recommendation_case_private_write_receipts
FROM lor_studio_command_owner;
REVOKE SELECT, UPDATE ON TABLE
  lor_studio.faculty_private_content,
  lor_studio.recommendation_case_creation_reservations
FROM lor_studio_command_owner;
REVOKE SELECT ON TABLE
  lor_studio.student_auth_bindings,
  lor_studio.student_auth_binding_revocations,
  lor_studio.mentor_case_assignments,
  lor_studio.mentor_case_assignment_revocations,
  lor_studio.faculty_invitations,
  lor_studio.faculty_otp_verification_receipts,
  lor_studio.faculty_otp_proof_revocations
FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.canonical_jsonb_text(jsonb) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.canonical_jsonb_sha256(jsonb) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.release_document_hash(text, text, text, text) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.protected_state_chain_hash(text, text, bigint, text, text, jsonb) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.student_record_is_safe(jsonb) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.private_record_is_complete(jsonb) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.protected_case_state_is_complete(jsonb, bigint) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.audit_event_is_metadata(jsonb) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.text_array_is_sorted_unique(text[]) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.student_context_allows(text, text, uuid, text[]) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.student_write_axes_satisfied() FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.commit_student_case_command(jsonb, bigint, text, text, text, text, jsonb, text, jsonb, text, jsonb) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.mentor_context_allows(text, text, text[]) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.faculty_context_allows(text, text, text[]) FROM lor_studio_command_owner;
REVOKE USAGE ON SCHEMA lor_studio FROM lor_studio_command_owner;

DROP FUNCTION lor_studio.commit_student_case_create(jsonb, text, text, jsonb, text, jsonb);
DROP FUNCTION lor_studio.commit_student_builder_autosave(jsonb, bigint, text, text, jsonb, text, jsonb);
DROP FUNCTION lor_studio.commit_student_builder_complete(jsonb, bigint, text, text, jsonb, text, jsonb);
DROP FUNCTION lor_studio.commit_student_consent_receipt(jsonb, bigint, text, text, jsonb, text, jsonb, jsonb);
DROP FUNCTION lor_studio.commit_student_waiver_receipt(jsonb, bigint, text, text, jsonb, text, jsonb, jsonb);
DROP FUNCTION lor_studio.read_mentor_case_projection();
DROP FUNCTION lor_studio.read_faculty_case_projection();
DROP FUNCTION lor_studio.commit_faculty_final_document_release(bigint, text, text, text, jsonb, text);
DROP FUNCTION lor_studio.commit_student_case_command(jsonb, bigint, text, text, text, text, jsonb, text, jsonb, text, jsonb);

REVOKE SELECT ON TABLE
  lor_studio.student_auth_bindings,
  lor_studio.student_auth_binding_revocations,
  lor_studio.administrative_case_grants,
  lor_studio.administrative_case_grant_revocations,
  lor_studio.recommendation_cases,
  lor_studio.released_student_documents,
  lor_studio.consent_receipts,
  lor_studio.waiver_receipts,
  lor_studio.student_recommendation_case_projection
FROM lor_studio_app;
REVOKE SELECT, INSERT ON TABLE
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_case_creation_reservations,
  lor_studio.writer_depot_artifacts,
  lor_studio.ai_generation_runs,
  lor_studio.ai_letter_proposals,
  lor_studio.ai_proposal_decisions,
  lor_studio.deletion_intents,
  lor_studio.deletion_hold_releases,
  lor_studio.deletion_receipts
FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.student_context_allows(text, text, uuid, text[]) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.student_write_axes_satisfied() FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.operational_content_context_allows(text, text, text[], text[]) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.audit_event_is_metadata(jsonb) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.ai_grounding_manifest_is_complete(jsonb) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.canonical_jsonb_text(jsonb) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.canonical_jsonb_sha256(jsonb) FROM lor_studio_app;
REVOKE USAGE ON SCHEMA lor_studio FROM lor_studio_app;

DROP VIEW lor_studio.student_recommendation_case_projection;

ALTER TABLE lor_studio.administrative_case_grant_revocations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.administrative_case_grant_revocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.administrative_case_grants NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.administrative_case_grants DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_generation_runs NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_generation_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_letter_proposals NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_letter_proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_proposal_decisions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.ai_proposal_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.consent_receipts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.consent_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_hold_releases NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_hold_releases DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_intents NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_intents DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_receipts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.deletion_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_invitations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_challenge_revocations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_challenge_revocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_challenges NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_proof_revocations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_proof_revocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_verification_receipts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_otp_verification_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_private_content NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.faculty_private_content DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.mentor_case_assignment_revocations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.mentor_case_assignment_revocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.mentor_case_assignments NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.mentor_case_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_audit_events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_audit_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_creation_reservations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_creation_reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_private_write_receipts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_private_write_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_protected_revision_states NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_protected_revision_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_write_receipts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_case_write_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_cases NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.recommendation_cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.released_student_documents NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.released_student_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.student_auth_binding_revocations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.student_auth_binding_revocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.student_auth_bindings NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.student_auth_bindings DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.waiver_receipts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.waiver_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.writer_depot_artifacts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lor_studio.writer_depot_artifacts DISABLE ROW LEVEL SECURITY;

DROP FUNCTION lor_studio.student_context_allows(text, text, uuid, text[]);
DROP FUNCTION lor_studio.student_write_axes_satisfied();
DROP FUNCTION lor_studio.faculty_context_allows(text, text, text[]);
DROP FUNCTION lor_studio.mentor_context_allows(text, text, text[]);
DROP FUNCTION lor_studio.operational_content_context_allows(text, text, text[], text[]);

DROP ROLE lor_studio_command_owner;

DO $postcondition$
DECLARE
  app_role_oid oid := (
    SELECT role.oid FROM pg_catalog.pg_roles AS role WHERE role.rolname = 'lor_studio_app'
  );
  unexpected_acl_count bigint;
  owner_schema_relation_acl_mismatch_count bigint;
BEGIN
  IF app_role_oid IS NULL
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = 'lor_studio_command_owner'
    ) <> 0
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r'
    ) <> 28
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio' AND class.relkind IN ('v', 'm')
    ) <> 0
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'lor_studio'
    ) <> 31
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'lor_studio'
        AND (procedure.proowner <> (
          SELECT role.oid FROM pg_catalog.pg_roles AS role WHERE role.rolname = current_user
        ) OR procedure.prosecdef)
    ) <> 0
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_policies AS policy
      WHERE policy.schemaname = 'lor_studio'
    ) <> 0
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_trigger AS trigger
      JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio' AND trigger.tgisinternal IS FALSE
    ) <> 46
    OR (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relkind = 'r'
        AND (class.relrowsecurity OR class.relforcerowsecurity)
    ) <> 0
  THEN
    RAISE EXCEPTION 'DR-120 rollback postcondition catalog mismatch'
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
  SELECT pg_catalog.count(*)
  INTO unexpected_acl_count
  FROM acl_entries
  WHERE grantee = 0 OR grantee <> owner_oid;

  WITH object_acls AS (
    SELECT
      'schema'::text AS object_kind,
      namespace.nspname::text AS object_name,
      namespace.nspowner AS owner_oid,
      namespace.nspacl AS object_acl,
      'n'::"char" AS acl_kind
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT
      'relation',
      class.relname,
      class.relowner,
      class.relacl,
      'r'::"char"
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r'
  ), normalized_acls AS (
    SELECT
      object_acl IS NULL AS acl_is_null,
      COALESCE((
        SELECT pg_catalog.array_agg(
          pg_catalog.format(
            '%s:%s:%s:%s',
            acl.grantor,
            acl.grantee,
            acl.privilege_type,
            acl.is_grantable
          ) ORDER BY acl.grantor, acl.grantee, acl.privilege_type, acl.is_grantable
        )
        FROM pg_catalog.aclexplode(object_acl) AS acl
      ), ARRAY[]::text[]) AS actual_acl,
      COALESCE((
        SELECT pg_catalog.array_agg(
          pg_catalog.format(
            '%s:%s:%s:%s',
            acl.grantor,
            acl.grantee,
            acl.privilege_type,
            acl.is_grantable
          ) ORDER BY acl.grantor, acl.grantee, acl.privilege_type, acl.is_grantable
        )
        FROM pg_catalog.aclexplode(
          pg_catalog.acldefault(object_acls.acl_kind, object_acls.owner_oid)
        ) AS acl
      ), ARRAY[]::text[]) AS expected_acl
    FROM object_acls
  )
  SELECT pg_catalog.count(*)
  INTO owner_schema_relation_acl_mismatch_count
  FROM normalized_acls
  WHERE acl_is_null OR actual_acl IS DISTINCT FROM expected_acl;

  IF unexpected_acl_count <> 0
    OR owner_schema_relation_acl_mismatch_count <> 0
  THEN
    RAISE EXCEPTION 'DR-120 rollback postcondition ACL mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$postcondition$;

COMMIT;
