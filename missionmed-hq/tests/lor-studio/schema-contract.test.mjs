import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ATOMIC_RLS_CASE_DRIVER_CONTRACT,
} from '../../lor-studio/adapters/atomic-rls-case-driver.mjs';
import {
  DR133_RELATIONS,
  DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES,
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const scriptDirectory = path.resolve(testDirectory, '..', '..', 'scripts', 'lor-studio');

const FORWARD_LEDGER = Object.freeze([
  'missionmed-hq/scripts/lor-studio/migrations/20260820180700_f2_lor_1012_schema_foundation.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260820180800_f2_lor_1012_rls_projection_grants.sql',
]);

const ROLLBACK_LEDGER = Object.freeze([
  'missionmed-hq/scripts/lor-studio/rollbacks/20260820180800_f2_lor_1012_rls_projection_grants.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260820180700_f2_lor_1012_schema_foundation.rollback.sql',
]);

const SUCCESSOR_FORWARD_LEDGER = Object.freeze([
  'missionmed-hq/scripts/lor-studio/migrations/20260825010200_f2_lor_1012_identity_scope_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260825010400_f2_lor_1012_faculty_invitation_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260825010600_f2_lor_1012_faculty_private_export_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260825010800_f2_lor_1012_ai_proposal_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260825011000_f2_lor_1012_student_evidence_commands.sql',
]);

const SUCCESSOR_ROLLBACK_LEDGER = Object.freeze([
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825011000_f2_lor_1012_student_evidence_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825010800_f2_lor_1012_ai_proposal_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825010600_f2_lor_1012_faculty_private_export_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825010400_f2_lor_1012_faculty_invitation_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825010200_f2_lor_1012_identity_scope_commands.rollback.sql',
]);

const PRODUCTION_FORWARD_LEDGER = Object.freeze([
  'missionmed-hq/scripts/lor-studio/migrations/20260825010000_f2_lor_1012_production_schema_foundation.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260825010100_f2_lor_1012_production_rls_projection_grants.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260825010300_f2_lor_1012_production_identity_scope_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260825010500_f2_lor_1012_production_faculty_invitation_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260825010700_f2_lor_1012_production_faculty_private_export_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260825010900_f2_lor_1012_production_ai_proposal_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260825011100_f2_lor_1012_production_student_evidence_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260826011300_f2_lor_1012_live_production_encrypted_private_storage_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260826011500_f2_lor_1012_faculty_candidate_auth_handoff_commands.sql',
  'missionmed-hq/scripts/lor-studio/migrations/20260826011700_f2_lor_1012_live_production_mentor_assignment_commands.sql',
]);

const PRODUCTION_ROLLBACK_LEDGER = Object.freeze([
  'missionmed-hq/scripts/lor-studio/rollbacks/20260826011700_f2_lor_1012_live_production_mentor_assignment_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260826011500_f2_lor_1012_faculty_candidate_auth_handoff_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260826011300_f2_lor_1012_live_production_encrypted_private_storage_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825011100_f2_lor_1012_production_student_evidence_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825010900_f2_lor_1012_production_ai_proposal_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825010700_f2_lor_1012_production_faculty_private_export_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825010500_f2_lor_1012_production_faculty_invitation_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825010300_f2_lor_1012_production_identity_scope_commands.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825010100_f2_lor_1012_production_rls_projection_grants.rollback.sql',
  'missionmed-hq/scripts/lor-studio/rollbacks/20260825010000_f2_lor_1012_production_schema_foundation.rollback.sql',
]);

const FACULTY_INVITATION_DEFINERS = Object.freeze([
  'issue_faculty_invitation(text,bigint,text,text,text,text,text,timestamp with time zone,timestamp with time zone,integer,bigint,bigint,text,text)',
  'resend_faculty_invitation_otp(text,text,text,text,timestamp with time zone,text,text)',
  'revoke_faculty_invitation(text,text,text)',
  'verify_faculty_invitation(text,text,text,text,text,text)',
  'commit_faculty_invitation_delivery(text,text,text,text,text)',
  'resolve_lor_actor_case_access(text,text)',
]);

const EXECUTABLE_RELATIONS = DR133_RELATIONS;
const APPROVED_SECURITY_DEFINER_FUNCTIONS = DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES;
const APPLICATION_EXECUTABLE_SECURITY_DEFINER_FUNCTIONS =
  DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES;

const COMMAND_OWNER_POLICY_SURFACE = Object.freeze([
  'student_auth_bindings_command_select@student_auth_bindings:SELECT',
  'student_auth_binding_revocations_command_select@student_auth_binding_revocations:SELECT',
  'recommendation_cases_student_command_select@recommendation_cases:SELECT',
  'recommendation_cases_student_command_insert@recommendation_cases:INSERT',
  'recommendation_cases_student_command_update@recommendation_cases:UPDATE',
  'case_creation_reservations_student_command_select@recommendation_case_creation_reservations:SELECT',
  'case_creation_reservations_student_command_lock@recommendation_case_creation_reservations:UPDATE',
  'recommendation_case_audit_events_student_command_select@recommendation_case_audit_events:SELECT',
  'recommendation_case_audit_events_student_command_insert@recommendation_case_audit_events:INSERT',
  'protected_revision_states_student_command_select@recommendation_case_protected_revision_states:SELECT',
  'protected_revision_states_student_command_insert@recommendation_case_protected_revision_states:INSERT',
  'recommendation_case_write_receipts_student_command_select@recommendation_case_write_receipts:SELECT',
  'recommendation_case_write_receipts_student_command_insert@recommendation_case_write_receipts:INSERT',
  'consent_receipts_student_command_select@consent_receipts:SELECT',
  'consent_receipts_student_command_insert@consent_receipts:INSERT',
  'waiver_receipts_student_command_select@waiver_receipts:SELECT',
  'waiver_receipts_student_command_insert@waiver_receipts:INSERT',
  'released_student_documents_student_command_select@released_student_documents:SELECT',
  'recommendation_cases_mentor_command_select@recommendation_cases:SELECT',
  'protected_revision_states_mentor_command_select@recommendation_case_protected_revision_states:SELECT',
  'mentor_case_assignments_command_select@mentor_case_assignments:SELECT',
  'mentor_case_assignment_revocations_command_select@mentor_case_assignment_revocations:SELECT',
  'recommendation_cases_faculty_command_select@recommendation_cases:SELECT',
  'recommendation_cases_faculty_command_update@recommendation_cases:UPDATE',
  'faculty_invitations_faculty_command_select@faculty_invitations:SELECT',
  'faculty_otp_verification_receipts_faculty_command_select@faculty_otp_verification_receipts:SELECT',
  'faculty_otp_proof_revocations_faculty_command_select@faculty_otp_proof_revocations:SELECT',
  'consent_receipts_faculty_command_select@consent_receipts:SELECT',
  'waiver_receipts_faculty_command_select@waiver_receipts:SELECT',
  'faculty_private_content_faculty_command_select@faculty_private_content:SELECT',
  'faculty_private_content_faculty_command_update@faculty_private_content:UPDATE',
  'released_student_documents_faculty_command_select@released_student_documents:SELECT',
  'released_student_documents_faculty_command_insert@released_student_documents:INSERT',
  'private_write_receipts_faculty_command_select@recommendation_case_private_write_receipts:SELECT',
  'private_write_receipts_faculty_command_insert@recommendation_case_private_write_receipts:INSERT',
  'recommendation_case_audit_events_faculty_command_select@recommendation_case_audit_events:SELECT',
  'recommendation_case_audit_events_faculty_command_insert@recommendation_case_audit_events:INSERT',
  'protected_revision_states_faculty_command_select@recommendation_case_protected_revision_states:SELECT',
  'protected_revision_states_faculty_command_insert@recommendation_case_protected_revision_states:INSERT',
  'writer_depot_artifacts_faculty_select@writer_depot_artifacts:SELECT',
  'writer_depot_artifacts_faculty_insert@writer_depot_artifacts:INSERT',
  'ai_generation_runs_faculty_select@ai_generation_runs:SELECT',
  'ai_generation_runs_faculty_insert@ai_generation_runs:INSERT',
  'ai_letter_proposals_faculty_select@ai_letter_proposals:SELECT',
  'ai_letter_proposals_faculty_insert@ai_letter_proposals:INSERT',
  'ai_proposal_decisions_faculty_select@ai_proposal_decisions:SELECT',
  'ai_proposal_decisions_faculty_insert@ai_proposal_decisions:INSERT',
]);

const SUCCESSOR_COMMAND_OWNER_POLICY_SURFACE = Object.freeze([
  'student_auth_bindings_identity_command_select@student_auth_bindings:SELECT',
  'student_auth_bindings_identity_command_insert@student_auth_bindings:INSERT',
  'student_auth_binding_revocations_identity_command_select@student_auth_binding_revocations:SELECT',
  'student_auth_binding_revocations_identity_command_insert@student_auth_binding_revocations:INSERT',
  'faculty_invitations_scope_resolution_select@faculty_invitations:SELECT',
  'faculty_otp_verification_scope_resolution_select@faculty_otp_verification_receipts:SELECT',
  'faculty_otp_revocations_scope_resolution_select@faculty_otp_proof_revocations:SELECT',
  'mentor_assignments_scope_resolution_select@mentor_case_assignments:SELECT',
  'mentor_assignment_revocations_scope_resolution_select@mentor_case_assignment_revocations:SELECT',
  'recommendation_cases_invitation_command_select@recommendation_cases:SELECT',
  'recommendation_cases_invitation_command_update@recommendation_cases:UPDATE',
  'protected_revision_states_invitation_command_select@recommendation_case_protected_revision_states:SELECT',
  'protected_revision_states_invitation_command_insert@recommendation_case_protected_revision_states:INSERT',
  'recommendation_case_audit_events_invitation_command_select@recommendation_case_audit_events:SELECT',
  'recommendation_case_audit_events_invitation_command_insert@recommendation_case_audit_events:INSERT',
  'faculty_invitations_invitation_command_select@faculty_invitations:SELECT',
  'faculty_invitations_invitation_command_insert@faculty_invitations:INSERT',
  'faculty_invitations_invitation_command_update@faculty_invitations:UPDATE',
  'faculty_otp_challenges_invitation_command_select@faculty_otp_challenges:SELECT',
  'faculty_otp_challenges_invitation_command_insert@faculty_otp_challenges:INSERT',
  'faculty_otp_challenge_revocations_invitation_command_select@faculty_otp_challenge_revocations:SELECT',
  'faculty_otp_challenge_revocations_invitation_command_insert@faculty_otp_challenge_revocations:INSERT',
  'faculty_otp_verification_receipts_invitation_command_select@faculty_otp_verification_receipts:SELECT',
  'faculty_otp_verification_receipts_invitation_command_insert@faculty_otp_verification_receipts:INSERT',
  'faculty_otp_proof_revocations_actor_access_select@faculty_otp_proof_revocations:SELECT',
  'faculty_invitation_command_receipts_command_select@faculty_invitation_command_receipts:SELECT',
  'faculty_invitation_command_receipts_command_insert@faculty_invitation_command_receipts:INSERT',
  'student_auth_bindings_actor_access_select@student_auth_bindings:SELECT',
  'student_auth_binding_revocations_actor_access_select@student_auth_binding_revocations:SELECT',
  'mentor_case_assignments_actor_access_select@mentor_case_assignments:SELECT',
  'mentor_case_assignment_revocations_actor_access_select@mentor_case_assignment_revocations:SELECT',
  'faculty_private_content_faculty_command_insert@faculty_private_content:INSERT',
  'released_student_documents_student_export_select@released_student_documents:SELECT',
  'artifact_export_audit_events_command_insert@artifact_export_audit_events:INSERT',
  'artifact_export_audit_events_command_select@artifact_export_audit_events:SELECT',
  'recommendation_cases_ai_command_service_select@recommendation_cases:SELECT',
  'ai_generation_runs_ai_command_service_select@ai_generation_runs:SELECT',
  'ai_generation_runs_ai_command_service_insert@ai_generation_runs:INSERT',
  'ai_letter_proposals_ai_command_service_insert@ai_letter_proposals:INSERT',
  'ai_proposal_command_receipts_faculty_select@ai_proposal_command_receipts:SELECT',
  'ai_proposal_command_receipts_faculty_insert@ai_proposal_command_receipts:INSERT',
  'ai_proposal_generation_reservations_faculty_select@ai_proposal_generation_reservation_receipts:SELECT',
  'ai_proposal_generation_reservations_faculty_insert@ai_proposal_generation_reservation_receipts:INSERT',
  'student_evidence_records_command_select@student_evidence_records:SELECT',
  'student_evidence_records_student_command_insert@student_evidence_records:INSERT',
  'private_artifact_versions_storage_select@private_artifact_versions:SELECT',
  'private_artifact_versions_storage_insert@private_artifact_versions:INSERT',
  'released_student_documents_private_storage_select@released_student_documents:SELECT',
  'faculty_invitations_candidate_handoff_select@faculty_invitations:SELECT',
  'faculty_invitations_candidate_handoff_lock@faculty_invitations:UPDATE',
  'faculty_candidate_auth_handoff_reservations_command_select@faculty_candidate_auth_handoff_reservations:SELECT',
  'faculty_candidate_auth_handoff_reservations_command_insert@faculty_candidate_auth_handoff_reservations:INSERT',
  'faculty_candidate_auth_handoff_redemptions_command_select@faculty_candidate_auth_handoff_redemptions:SELECT',
  'faculty_candidate_auth_handoff_redemptions_command_insert@faculty_candidate_auth_handoff_redemptions:INSERT',
  'recommendation_cases_mentor_assignment_service_select@recommendation_cases:SELECT',
  'mentor_case_assignments_service_select@mentor_case_assignments:SELECT',
  'mentor_case_assignments_service_insert@mentor_case_assignments:INSERT',
  'mentor_case_assignment_revocations_service_select@mentor_case_assignment_revocations:SELECT',
  'mentor_case_assignment_revocations_service_insert@mentor_case_assignment_revocations:INSERT',
  'recommendation_case_audit_mentor_assignment_service_select@recommendation_case_audit_events:SELECT',
  'recommendation_case_audit_mentor_assignment_service_insert@recommendation_case_audit_events:INSERT',
]);

const COMMAND_OWNER_EXECUTE_HELPERS = Object.freeze([
  'canonical_jsonb_text(jsonb)',
  'canonical_jsonb_sha256(jsonb)',
  'release_document_hash(text,text,text,text)',
  'protected_state_chain_hash(text,text,bigint,text,text,jsonb)',
  'student_record_is_safe(jsonb)',
  'private_record_is_complete(jsonb)',
  'protected_case_state_is_complete(jsonb,bigint)',
  'audit_event_is_metadata(jsonb)',
  'text_array_is_sorted_unique(text[])',
  'student_context_allows(text,text,uuid,text[])',
  'student_write_axes_satisfied()',
  'commit_student_case_command(jsonb,bigint,text,text,text,text,jsonb,text,jsonb,text,jsonb)',
  'mentor_context_allows(text,text,text[])',
  'faculty_context_allows(text,text,text[])',
  'identity_bootstrap_context_allows(text,text[])',
  'actor_scope_resolution_context_allows(text,text,text[],text)',
  'ai_proposal_record_is_complete(jsonb)',
  'ai_grounding_manifest_is_complete(jsonb)',
  'ai_proposal_command_context_allows(text,text)',
  'ai_proposal_scope_hash(text,text)',
  'student_evidence_record_is_complete(jsonb,jsonb)',
  'build_student_safe_case_state(text,text,bigint,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,jsonb)',
  'private_storage_context_allows(text,text,text[])',
  'faculty_candidate_auth_context_allows(text,text[])',
  'mentor_assignment_command_context_allows(text,text,text,text)',
]);

const ORIGINAL_DESIGN_RELATIONS = Object.freeze([
  'recommendation_cases',
  'case_revisions',
  'builder_sessions',
  'evidence_links',
  'letter_variants',
  'consent_receipts',
  'waiver_receipts',
  'faculty_invitations',
  'faculty_private_content',
  'writer_depot_artifacts',
  'idempotency_records',
  'audit_events',
  'deletion_intents',
]);

async function readContract() {
  return JSON.parse(await readFile(path.join(scriptDirectory, 'schema-design.contract.json'), 'utf8'));
}

test('schema contract records DR-133 staging target authority without claiming remote apply', async () => {
  const contract = await readContract();
  assert.equal(contract.schemaVersion, 'missionmed.lor.schema-design.v3');
  assert.equal(contract.status, 'DR133_RAILWAY_STAGING_TARGET_BOUND_ARTIFACTS_VALIDATED');
  assert.equal(contract.authorityDecision, 'DR-133');
  assert.equal(contract.sourceDesignStatus, 'DESIGN_ONLY_NOT_EXECUTABLE');
  assert.equal(contract.targetProject, '29afe885-b9b1-425d-8fd8-8611cd275409');
  assert.equal(contract.targetEnvironment, 'f5705d38-393c-4176-9cc2-0d1dbad42c93');
  assert.equal(contract.targetEnvironmentName, 'lor-staging');
  assert.equal(contract.targetDatabaseService, 'b49a52e7-df15-4417-b67a-a64403aa5db7');
  assert.equal(contract.targetDatabaseName, 'railway');
  assert.equal(contract.targetRegion, 'us-west2');
  assert.equal(contract.targetSchema, 'lor_studio');
  assert.equal(contract.migrationFileAuthorized, true);
  assert.equal(contract.rootSupabaseMigrationAuthorized, false);
  assert.equal(contract.remoteMigrationAuthorized, true);
  assert.equal(contract.externalTargetBindingAuthorized, true);
  assert.equal(contract.remoteApplicationEvidence, 'NO_REMOTE_APPLY_CLAIM');
  assert.match(contract.blockingDecision, /does not claim remote apply/u);
  assert.deepEqual(contract.migrationLedger, FORWARD_LEDGER);
  assert.deepEqual(contract.rollbackLedger, ROLLBACK_LEDGER);
  assert.equal(
    contract.rollbackVerificationStatus,
    'POSTGRESQL_16_18_APPLY_RLS_ROLLBACK_REAPPLY_VERIFIED_NO_REMOTE_APPLY_CLAIM',
  );
});

test('schema contract binds the complete ordered successor ledgers', async () => {
  const contract = await readContract();
  assert.deepEqual(contract.successorMigrationLedger, SUCCESSOR_FORWARD_LEDGER);
  assert.deepEqual(contract.successorRollbackLedger, SUCCESSOR_ROLLBACK_LEDGER);
  assert.deepEqual(contract.productionMigrationLedger, PRODUCTION_FORWARD_LEDGER);
  assert.deepEqual(contract.productionRollbackLedger, PRODUCTION_ROLLBACK_LEDGER);
  assert.deepEqual(contract.identityScopeSuccessorCatalog, {
    relationCount: 28,
    functionCount: 51,
    securityDefinerCount: 12,
    policyCount: 100,
  });
  assert.deepEqual(contract.facultyInvitationCommandContract, {
    receiptRelation: 'faculty_invitation_command_receipts',
    receiptSchemaVersion: 'missionmed.lor.faculty-invitation-command-receipt.v1',
    receiptKeys: [
      'schemaVersion',
      'receiptId',
      'action',
      'committed',
      'replayed',
      'caseId',
      'invitationId',
      'challengeIdHash',
      'invitationExpiresAt',
      'challengeExpiresAt',
      'caseRevision',
      'invitationRevision',
      'verified',
      'reasonCode',
      'auditEventRef',
      'transactionId',
    ],
    securityDefinerFunctions: FACULTY_INVITATION_DEFINERS,
    issueExpectedRevisionSqlState: 'P1306',
    studentInvitationResolution: 'DATABASE_RESOLVES_SINGLE_ACTIVE_INVITATION_FOR_RESEND_AND_REVOKE',
    actorAdmissionSchemaVersion: 'missionmed.lor.actor-case-access.v1',
    actorAdmissionAuthoritySource: 'database_verified_case_access',
    otpProofAuthority: 'database_verified_otp_challenge',
    facultyUidAuthority: 'database_derived_from_canonical_wordpress_subject_v1',
    verifiedFacultyAccessLifetime:
      'DURABLE_UNTIL_EXPLICIT_INVITATION_OR_OTP_PROOF_REVOCATION',
    postVerificationAccessRequiresFutureInvitationOrOtpExpiry: false,
    facultyContextRollbackRestoresPredecessorExpirySemantics: true,
    storesRawRecipientTokenOrOtp: false,
    verificationCreatesFacultyPrivateContent: false,
    localSentinelSuffix: 'facultyInvitationCommands=20260825010400',
    productionSentinelSuffix: 'facultyInvitationCommands=20260825010500',
  });
  assert.deepEqual(contract.facultyInvitationSuccessorCatalog, {
    relationCount: 29,
    functionCount: 57,
    securityDefinerCount: 18,
    policyCount: 123,
    triggerCount: 47,
    indexCount: 120,
    nonownerAclEntryCount: 107,
    constraintCountByPostgresMajor: { 16: 320, 18: 642 },
    indexFingerprintByPostgresMajor: {
      16: 'e6db9894469dc8759bf744b393d5d88b1bd61c86b2ba0d08b9d397b191d81baf',
      18: 'e6db9894469dc8759bf744b393d5d88b1bd61c86b2ba0d08b9d397b191d81baf',
    },
    constraintFingerprintByPostgresMajor: {
      16: 'bdc8bca57a1493d625085e944cf8b4eff365b392f75603268d30c06fbae440da',
      18: '7a1ef59607cd5f5ca598e9e149410c593cfb406981cdab1e22bca8c269c756eb',
    },
  });
  assert.deepEqual(contract.baseSchemaCatalog, {
    relationCount: 28,
    functionCount: 45,
    securityDefinerFunctions: [
      'commit_student_case_create(jsonb,text,text,jsonb,text,jsonb)',
      'commit_student_builder_autosave(jsonb,bigint,text,text,jsonb,text,jsonb)',
      'commit_student_builder_complete(jsonb,bigint,text,text,jsonb,text,jsonb)',
      'commit_student_consent_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
      'commit_student_waiver_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
      'read_mentor_case_projection()',
      'read_faculty_case_projection()',
      'commit_faculty_final_document_release(bigint,text,text,text,jsonb,text)',
    ],
    policyCount: 91,
    triggerCount: 46,
    indexCount: 115,
    nonownerAclEntryCount: 84,
    indexFingerprintByPostgresMajor: {
      16: '6486aa57aebe29f7dd19f48611f4a24958bffbbbe5bf95ff603c16bad2a8f8d6',
      18: '6486aa57aebe29f7dd19f48611f4a24958bffbbbe5bf95ff603c16bad2a8f8d6',
    },
    constraintCountByPostgresMajor: { 16: 306, 18: 616 },
    constraintFingerprintByPostgresMajor: {
      16: 'aa251174fe7dd624049a0a45c46b279cad5757f46e2a355f85b466b53ac1a002',
      18: '80aebb352dba03810b876597b83b4224cc391bc9e7688f5ccbac1e3eeae78c8f',
    },
  });
  assert.deepEqual(contract.cumulativeSuccessorCatalog, {
    relationCount: 33,
    functionCount: 72,
    securityDefinerCount: 28,
    policyCount: 136,
    triggerCount: 51,
    indexCount: 131,
    nonownerAclEntryCount: 132,
    indexFingerprintByPostgresMajor: {
      16: 'b93d24e65bb08e6423d1b56e96f276250642e327d7835b8b06806401b05b17a2',
      18: 'b93d24e65bb08e6423d1b56e96f276250642e327d7835b8b06806401b05b17a2',
    },
    constraintCountByPostgresMajor: { 16: 368, 18: 761 },
    constraintFingerprintByPostgresMajor: {
      16: '8d9e49869620997840b714faa1eedfdac6a31ae9770c8ad3c42383fc99ad4737',
      18: 'aa4c3019497933a3602e9c1ee7a65bef9598722ecefb7056edd13d064a7818b4',
    },
  });
});

test('schema contract freezes encrypted storage and faculty candidate handoff custody', async () => {
  const contract = await readContract();
  assert.deepEqual(contract.encryptedPrivateStorageContract, {
    relation: 'private_artifact_versions',
    securityDefinerFunctions: [
      'get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)',
      'put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)',
    ],
    encryption: 'application_aes_256_gcm_per_version_hkdf_sha256',
    databaseContent: 'ciphertext_only',
    authorization: 'trusted_request_context_plus_database_actor_case_scope',
    directApplicationTableDml: false,
    immutable: true,
    idempotency: 'database_serialized_exact_request_replay',
    rollback: 'exact_no_cascade_refuses_nonempty_artifact_custody',
    productionSentinelSuffix: 'encryptedPrivateStorage=20260826011300',
  });
  assert.deepEqual(contract.facultyCandidateAuthHandoffContract, {
    relations: [
      'faculty_candidate_auth_handoff_reservations',
      'faculty_candidate_auth_handoff_redemptions',
    ],
    securityDefinerFunctions: [
      'reserve_faculty_candidate_auth_handoff(text,text,text,integer)',
      'redeem_faculty_candidate_auth_handoff(text,text,text,text,timestamp with time zone,timestamp with time zone)',
    ],
    helperFunction: 'faculty_candidate_auth_context_allows(text,text[])',
    databaseClocked: true,
    maximumLifetimeSeconds: 900,
    storesRawInvitationToken: false,
    directApplicationTableDml: false,
    singleUseRedemption: true,
    rollback: 'exact_no_cascade_refuses_nonempty_handoff_custody',
    productionSentinelSuffix: 'facultyCandidateAuthHandoff=20260826011500',
  });
  assert.deepEqual(contract.liveProductionSuccessorCatalog, {
    artifactCount: 20,
    rollbackCount: 10,
    relationCount: 36,
    forcedRlsCount: 36,
    securityDefinerCount: 34,
    applicationExecutableSecurityDefinerCount: 33,
    productionSentinelSuffix: 'mentorAssignmentCommands=20260826011700',
  });
  assert.deepEqual(contract.mentorAssignmentCommandContract, {
    securityDefinerFunctions: [
      'assign_mentor_to_case(text,text,text,text,integer,text)',
      'revoke_mentor_case_assignment(text,text,text,text,text)',
    ],
    helperFunction: 'mentor_assignment_command_context_allows(text,text,text,text)',
    receiptSchemaVersion: 'missionmed.lor.mentor-assignment-command-receipt.v1',
    trustedServiceActor: 'lor-mentor-assignment-operator-v1',
    operation: 'read',
    minimumLifetimeSeconds: 300,
    maximumLifetimeSeconds: 15_552_000,
    databaseComputedHashes: true,
    databaseComputedMentorUid: true,
    appendOnlyAssignmentAndRevocation: true,
    atomicMetadataAudit: true,
    directApplicationTableDml: false,
    browserRoute: false,
    rollback: 'exact_no_cascade_refuses_nonempty_command_custody',
    productionSentinelSuffix: 'mentorAssignmentCommands=20260826011700',
  });
});

test('schema contract freezes the narrow actor-safe faculty drafting context', async () => {
  const contract = await readContract();
  assert.deepEqual(contract.aiDraftingContextContract, {
    schemaVersion: 'missionmed.lor.faculty-drafting-context.v1',
    securityDefinerFunction: 'read_faculty_drafting_context()',
    topLevelKeys: [
      'schemaVersion', 'id', 'studentId', 'status', 'faculty',
      'consentReceipts', 'studentEvidence',
    ],
    facultyKeys: ['facultyId', 'verifiedAt', 'recipientEmailHash'],
    consentReceiptKeys: ['id'],
    evidenceKeys: ['id', 'caseId', 'text', 'contentHash', 'consentReceiptId'],
    requiredConsentScopes: ['ai_drafting', 'evidence_grounding'],
    hashAuthority: 'database_recomputed_sha256_over_exact_evidence_text',
    authorization: 'exact_faculty_subject_uid_invitation_case_student_and_nonrevoked_otp_proof',
    excludes: [
      'builder', 'applicantOptions', 'facultyPrivate', 'delivery',
      'waiverReceipts', 'fullAggregate',
    ],
    localSentinelSuffix: 'aiProposalCommands=20260825010800',
    productionSentinelSuffix: 'aiProposalCommands=20260825010900',
  });
});

test('schema contract reserves AI provider side effects before IO and seals unknown outcomes', async () => {
  const contract = await readContract();
  assert.deepEqual(contract.aiProviderSideEffectIdempotencyContract, {
    reservationRelation: 'ai_proposal_generation_reservation_receipts',
    reservationReceiptSchemaVersion:
      'missionmed.lor.ai-proposal-generation-reservation-receipt.v1',
    securityDefinerTransitionFunction:
      'transition_ai_proposal_generation_reservation(text,text,text,text,text,text)',
    reservationKey: ['caseId', 'studentSubject', 'facultySubject', 'idempotencyKey'],
    requestBinding: 'server_computed_request_hash',
    durableStates: ['pending', 'accepted', 'unknown'],
    providerCallRule: 'ONLY_NEW_PENDING_RESERVATION_WINNER',
    pendingReplayRule: 'NO_PROVIDER_CALL',
    acceptedReplayRule: 'RETURN_HASH_VALIDATED_STORED_PROPOSAL_WITHOUT_PROVIDER_CALL',
    unknownReplayRule: 'NO_AUTOMATIC_RETRY_OR_FAKE_SUCCESS',
    finalization:
      'provider_run_proposal_audit_and_final_receipt_one_database_transaction',
    directApplicationTableDml: false,
    publicExecute: false,
    rollback: 'exact_no_cascade_and_refuses_nonempty_reservation_or_ai_custody',
  });
});

test('canonical owner and application role remain fail-closed', async () => {
  const contract = await readContract();
  assert.deepEqual(contract.canonicalOwnerIdentity, {
    subjectColumn: 'student_auth_subject',
    subjectPattern: '^wp:[1-9][0-9]*$',
    supplementalJwtColumn: 'student_auth_uid',
    ownershipRule: 'The textual WordPress subject is canonical; the JWT UUID is a bound supplemental identity and never replaces the owner subject.',
  });
  assert.deepEqual(contract.applicationRole, {
    name: 'lor_studio_app',
    login: false,
    inherit: false,
    bypassRls: false,
    ownsSchema: false,
  });
  assert.deepEqual(contract.commandOwnerRole, {
    name: 'lor_studio_command_owner',
    login: false,
    inherit: false,
    superuser: false,
    createDatabase: false,
    createRole: false,
    replication: false,
    bypassRls: false,
    searchPath: 'pg_catalog',
    memberships: [],
    defaultPrivileges: [],
    ownsSchema: false,
    ownsTables: false,
    ownsOnlyApprovedSecurityDefinerFunctions: true,
  });
  assert.deepEqual(
    contract.approvedSecurityDefinerFunctions,
    APPROVED_SECURITY_DEFINER_FUNCTIONS,
  );
  assert.deepEqual(
    contract.applicationExecutableSecurityDefinerFunctions,
    APPLICATION_EXECUTABLE_SECURITY_DEFINER_FUNCTIONS,
  );
  assert.deepEqual(contract.predecessorSecurityDefinerDeny, {
    identity: 'read_faculty_drafting_context_pre_evidence()',
    applicationExecute: false,
    publicExecute: false,
  });
  assert.deepEqual(contract.commandOwnerPrivileges, {
    schema: ['USAGE@lor_studio'],
    selectInsertUpdateRelations: [
      'recommendation_cases',
      'faculty_invitations',
      'faculty_private_content',
    ],
    selectInsertRelations: [
      'recommendation_case_protected_revision_states',
      'recommendation_case_audit_events',
      'recommendation_case_write_receipts',
      'consent_receipts',
      'waiver_receipts',
      'released_student_documents',
      'recommendation_case_private_write_receipts',
      'student_auth_bindings',
      'student_auth_binding_revocations',
      'faculty_otp_challenges',
      'faculty_otp_challenge_revocations',
      'faculty_otp_verification_receipts',
      'faculty_invitation_command_receipts',
      'artifact_export_audit_events',
      'ai_generation_runs',
      'ai_letter_proposals',
      'ai_proposal_decisions',
      'ai_proposal_command_receipts',
      'ai_proposal_generation_reservation_receipts',
      'student_evidence_records',
      'private_artifact_versions',
      'faculty_candidate_auth_handoff_reservations',
      'faculty_candidate_auth_handoff_redemptions',
      'mentor_case_assignments',
      'mentor_case_assignment_revocations',
    ],
    selectUpdateRelations: ['recommendation_case_creation_reservations'],
    selectRelations: ['faculty_otp_proof_revocations'],
    executeHelpers: COMMAND_OWNER_EXECUTE_HELPERS,
    columnPrivileges: [],
  });
  assert.deepEqual(contract.finalApplicationSharedTablePrivileges, {
    student_auth_bindings: ['SELECT'],
    student_auth_binding_revocations: ['SELECT'],
    administrative_case_grants: ['SELECT'],
    administrative_case_grant_revocations: ['SELECT'],
    recommendation_cases: ['SELECT'],
    released_student_documents: ['SELECT'],
    consent_receipts: ['SELECT'],
    waiver_receipts: ['SELECT'],
    student_recommendation_case_projection: ['SELECT'],
    recommendation_case_audit_events: ['SELECT', 'INSERT'],
    recommendation_case_creation_reservations: ['SELECT', 'INSERT'],
    writer_depot_artifacts: ['SELECT'],
    deletion_intents: ['SELECT', 'INSERT'],
    deletion_hold_releases: ['SELECT', 'INSERT'],
    deletion_receipts: ['SELECT', 'INSERT'],
  });
  assert.deepEqual(contract.finalApplicationPolicyHelperExecutePrivileges, [
    'student_context_allows(text,text,uuid,text[])',
    'student_write_axes_satisfied()',
    'operational_content_context_allows(text,text,text[],text[])',
    'audit_event_is_metadata(jsonb)',
    'ai_grounding_manifest_is_complete(jsonb)',
    'canonical_jsonb_text(jsonb)',
    'canonical_jsonb_sha256(jsonb)',
  ]);
  assert.deepEqual(contract.operationalCaseSerializationProtocol, {
    keyFraming: "hashtextextended(jsonb_build_array('missionmed.lor.case-lock.v1',case_id,student_auth_subject)::text,0)",
    transactionOrder: 'BEGIN_READ_COMMITTED_THEN_BIND_SCOPE_THEN_MUTATE',
    aiTriggerEnforcement: 'READ_COMMITTED_AND_VOLATILE_TRIGGER_ACQUIRES_EXACT_TRANSACTION_ADVISORY_LOCK_BEFORE_RELEASE_STATE_QUERY',
    reason: 'At READ COMMITTED a VOLATILE PL/pgSQL trigger obtains a fresh snapshot for each query it executes, so the release-state query after the blocking lock observes a concurrent release; other isolation levels fail closed.',
  });
  assert.deepEqual(contract.intentionallyInertOperationalPolicySurfaces, {
    status: 'FAIL_CLOSED_POLICY_ONLY_NO_APPLICATION_ACL',
    reason: 'Unsafe direct protected/private restore and privacy DML remains revoked until a successor actor-safe command or projection architecture is ratified.',
    policies: [
      'recommendation_cases_operational_update',
      'protected_revision_states_operational_select',
      'protected_revision_states_operational_insert',
      'faculty_private_content_operational_select',
      'faculty_private_content_operational_insert',
      'faculty_private_content_operational_update',
      'released_student_documents_operational_insert',
      'private_write_receipts_operational_select',
      'private_write_receipts_operational_insert',
      'writer_depot_artifacts_operational_insert',
      'ai_proposal_decisions_operational_insert',
    ],
  });
  assert.deepEqual(contract.commandOwnerPolicySurface, [
    ...COMMAND_OWNER_POLICY_SURFACE,
    ...SUCCESSOR_COMMAND_OWNER_POLICY_SURFACE,
  ]);
  assert.equal(contract.expectedFoundationFunctionCount, 31);
  assert.equal(contract.expectedFinalFunctionCount, 45);
  assert.equal(contract.expectedFinalPolicyCount, 91);
  assert.equal(contract.expectedFinalTriggerCount, 46);
  assert.equal(contract.expectedFinalIndexCount, 115);
  assert.deepEqual(contract.expectedIndexFingerprintByPostgresMajor, {
    16: '6486aa57aebe29f7dd19f48611f4a24958bffbbbe5bf95ff603c16bad2a8f8d6',
    18: '6486aa57aebe29f7dd19f48611f4a24958bffbbbe5bf95ff603c16bad2a8f8d6',
  });
  assert.deepEqual(contract.expectedConstraintCountByPostgresMajor, {
    16: 306,
    18: 616,
  });
  assert.deepEqual(contract.expectedConstraintFingerprintByPostgresMajor, {
    16: 'aa251174fe7dd624049a0a45c46b279cad5757f46e2a355f85b466b53ac1a002',
    18: '80aebb352dba03810b876597b83b4224cc391bc9e7688f5ccbac1e3eeae78c8f',
  });
  assert.deepEqual(contract.rollbackCustody, {
    sentinelStorage: 'COMMENT_ON_SCHEMA',
    sentinelSchema: 'missionmed.lor.disposable-postgres-harness.v1',
    requiresSharedDatabaseAndAdminSuffix: true,
    requiresCommonDataAndSocketRoot: true,
    requiresExactRelationLocks: true,
    requiresExactCatalogInventory: true,
    expectedFinalNonownerAclEntryCount: 84,
    requiresEmptyRelations: true,
    allowsCascade: false,
    allowsDynamicDrop: false,
    allowsBroadAllObjectRevoke: false,
  });
  assert.deepEqual(contract.driverRelations, [
    'student_recommendation_case_projection',
    'recommendation_case_creation_reservations',
    'consent_receipts',
    'waiver_receipts',
  ]);
  assert.deepEqual(
    [...contract.driverRelations].sort(),
    Object.values(ATOMIC_RLS_CASE_DRIVER_CONTRACT.relations)
      .map((qualifiedName) => qualifiedName.split('.')[1])
      .sort(),
  );
  assert.deepEqual(contract.projectionViews, ['student_recommendation_case_projection']);
  assert.deepEqual(contract.studentProjectionArchitecture, {
    mode: 'SECURITY_INVOKER_OVER_STUDENT_SAFE_BASE_AND_RELEASE_SNAPSHOT',
    supersedesDesignDefinerProjection: true,
    reason: 'The executable schema removes faculty private and unreleased letter content from the base case relation, isolates it behind separate FORCE RLS relations with no student policy, and therefore does not require a bypassing projection owner.',
  });
  assert.deepEqual(contract.studentWritePrerequisites, [
    'server_verified_360_entitlement',
    'lor_feature_enabled',
    'active_canary_authorization',
  ]);
  assert.deepEqual(contract.studentWriteTrustedGucs, [
    'lor_studio.entitlement_verified',
    'lor_studio.lor_enabled',
    'lor_studio.canary_authorized',
  ]);
});

test('every executable and original design relation has an explicit disposition', async () => {
  const contract = await readContract();
  assert.deepEqual(contract.executableRelations, EXECUTABLE_RELATIONS);
  assert.deepEqual(Object.keys(contract.designRelationDisposition), ORIGINAL_DESIGN_RELATIONS);
  for (const relation of ORIGINAL_DESIGN_RELATIONS) {
    assert.match(contract.designRelationDisposition[relation], /^(?:implemented|superseded_by_)/u);
  }
});

test('security contract keeps private data, role-only privilege, and remote apply closed', async () => {
  const contract = await readContract();
  const requirements = contract.requiredSecurityProperties.join('\n');
  for (const required of [
    'row level security enabled and forced',
    'role alone grants nothing',
    'append only ledgers reject update and delete',
    'student projections omit faculty private data',
    'student writes additionally require trusted transaction local entitlement',
    'same transaction audit and replay truth',
    'exact DR-133 target recovery plan artifact hashes least privilege and provider native receipts',
  ]) {
    assert.match(requirements, new RegExp(required, 'u'));
  }
});

test('historical design SQL remains inert while executable migrations are separate', async () => {
  const sql = await readFile(path.join(scriptDirectory, 'schema-design.sql'), 'utf8');
  assert.match(sql, /RAISE EXCEPTION 'F2-LOR-1009 schema design is non-executable/u);
  for (const line of sql.split(/\r?\n/u)) {
    if (/\b(create|alter|drop|truncate|insert|update|delete|grant|revoke)\b/iu.test(line)) {
      assert.match(line, /^\s*--/u, `historical design DDL/DML must remain commented: ${line}`);
    }
  }
});
