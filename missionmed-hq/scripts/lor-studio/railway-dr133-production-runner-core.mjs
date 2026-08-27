import { createHash, X509Certificate } from 'node:crypto';

export const DR133_RUNNER_CONTRACT = 'missionmed.lor.railway-dr133-production-runner.v1';
export const DR133_RUNTIME_LOGIN = 'lor_studio_runtime_login';
export const DR133_DATABASE_CA_ENV_KEY = 'LOR_DR133_RUNTIME_DATABASE_CA';
export const DR133_PRODUCTION_DATABASE_CA_DER_SHA256 =
  '819aeb9a89bc2728aaca019b7bd30f426fe5eef027a0ce201daf8fdf2ff1d897';
export const DR133_APPLICATION_ROLE = 'lor_studio_app';
export const DR133_COMMAND_OWNER_ROLE = 'lor_studio_command_owner';
export const DR133_TUNNEL_HOST = '127.0.0.1';

export const DR133_TARGET = Object.freeze({
  provider: 'railway-postgres',
  deploymentEnvironment: 'production',
  migrationLedger: 'lor_studio/migrations/production',
  projectId: '29afe885-b9b1-425d-8fd8-8611cd275409',
  environmentId: 'ed3353f7-bcc7-4e25-a000-3c9fc628a9a7',
  environmentName: 'production',
  // `railway run` executes this repository's command locally while importing
  // only the selected service variables; it does not execute inside this image.
  executionServiceId: '576520f5-a702-4343-a277-decdeeed57f6',
  applicationServiceId: '3d18b017-4fc9-4b22-b097-ba879816d374',
  databaseServiceId: '576520f5-a702-4343-a277-decdeeed57f6',
  databaseHost: 'postgres-3tcu.railway.internal',
  databaseName: 'railway',
  databaseAdmin: 'postgres',
  region: 'us-west2',
  decisionRecord: 'DR-133',
  dataCopied: 'false',
  sourceBaselineCommit: 'b44c18fa4c69e773f333221dda9c6cc6a42cbb85',
  sourceBaselineTree: '0f800ef984147c40cd6251ac1c79fb58351c7e32',
});

export const DR133_ARTIFACTS = Object.freeze([
  Object.freeze({
    id: 'foundation',
    purpose: 'forward',
    relativePath: 'migrations/20260826010000_f2_lor_1012_live_production_schema_foundation.sql',
    sha256: '2949e54da193ea99c66c6da32fa39a84671bc653beeb6b6691f351f79f66f879',
  }),
  Object.freeze({
    id: 'rls',
    purpose: 'forward',
    relativePath: 'migrations/20260826010100_f2_lor_1012_live_production_rls_projection_grants.sql',
    sha256: '292a4033dc223fa9781653b7cf18207cd6b8825e52e47e2f29607cb676e883e2',
  }),
  Object.freeze({
    id: 'foundation-rollback',
    purpose: 'recovery-custody',
    relativePath:
      'rollbacks/20260826010000_f2_lor_1012_live_production_schema_foundation.rollback.sql',
    sha256: '5b5b2298d14ead9d1be09487b04d6b2f6f29357e89b2bdde8b08cdcc7d54d96b',
  }),
  Object.freeze({
    id: 'rls-rollback',
    purpose: 'recovery-custody-and-guard-verification',
    relativePath:
      'rollbacks/20260826010100_f2_lor_1012_live_production_rls_projection_grants.rollback.sql',
    sha256: '16437bb4888121ee05a76e798ddf780013eadcfeb801457cc957646dd028a087',
  }),
  Object.freeze({
    id: 'identity-scope',
    purpose: 'forward-successor',
    relativePath:
      'migrations/20260826010300_f2_lor_1012_live_production_identity_scope_commands.sql',
    sha256: '66b3ab755591343aff9220a106bce92f58eb65e3ffb054586f38d9f2be017682',
  }),
  Object.freeze({
    id: 'identity-scope-rollback',
    purpose: 'recovery-custody-and-successor-guard-verification',
    relativePath:
      'rollbacks/20260826010300_f2_lor_1012_live_production_identity_scope_commands.rollback.sql',
    sha256: 'fbacfe8f808938c992adabab3b433afff9cc48838a1e2006ab1d342b91e0bf5d',
  }),
  Object.freeze({
    id: 'faculty-invitation',
    purpose: 'forward-successor',
    relativePath:
      'migrations/20260826010500_f2_lor_1012_live_production_faculty_invitation_commands.sql',
    sha256: '3551291c59177db338ff68b78a482fd7cbac6efc8e3299dcd556b804774d9fb8',
  }),
  Object.freeze({
    id: 'faculty-invitation-rollback',
    purpose: 'recovery-custody-and-successor-guard-verification',
    relativePath:
      'rollbacks/20260826010500_f2_lor_1012_live_production_faculty_invitation_commands.rollback.sql',
    sha256: 'd592c4247567e882c860d1d460218355dbf4cfb62cac58799a66f2dbbae63cb3',
  }),
  Object.freeze({
    id: 'faculty-private-export',
    purpose: 'forward-successor',
    relativePath:
      'migrations/20260826010700_f2_lor_1012_live_production_faculty_private_export_commands.sql',
    sha256: '6f9371c95505a59742df5e08841190b11a48dd3b505ddea3b7cfaf628d177fea',
  }),
  Object.freeze({
    id: 'faculty-private-export-rollback',
    purpose: 'recovery-custody-and-successor-guard-verification',
    relativePath:
      'rollbacks/20260826010700_f2_lor_1012_live_production_faculty_private_export_commands.rollback.sql',
    sha256: 'b2e05c2655dca83c8873f37f5ac6e62c3fd4ac99bd4977d5559c121a68d27bc0',
  }),
  Object.freeze({
    id: 'ai-proposal',
    purpose: 'forward-successor',
    relativePath:
      'migrations/20260826010900_f2_lor_1012_live_production_ai_proposal_commands.sql',
    sha256: 'ebf6a6a050f1311282eba2ef17d8a623d02f9a126022cf0f270a344b5788c9c1',
  }),
  Object.freeze({
    id: 'ai-proposal-rollback',
    purpose: 'recovery-custody-and-successor-guard-verification',
    relativePath:
      'rollbacks/20260826010900_f2_lor_1012_live_production_ai_proposal_commands.rollback.sql',
    sha256: '68c048f829a1e0179732eea0d7d0c4b030886a67c11453feff918b050edd9b77',
  }),
  Object.freeze({
    id: 'student-evidence',
    purpose: 'forward-successor',
    relativePath:
      'migrations/20260826011100_f2_lor_1012_live_production_student_evidence_commands.sql',
    sha256: 'cdafdd8e2d2076a5c6ec068e78e764a6f410a4576314605ecbae5e7c0ef76a63',
  }),
  Object.freeze({
    id: 'student-evidence-rollback',
    purpose: 'recovery-custody-and-successor-guard-verification',
    relativePath:
      'rollbacks/20260826011100_f2_lor_1012_live_production_student_evidence_commands.rollback.sql',
    sha256: '03a3ef7e9b1e9c391c8ad24ba4d4756901b24ba4f4398ebca28bba1705711a57',
  }),
  Object.freeze({
    id: 'encrypted-private-storage',
    purpose: 'forward-successor',
    relativePath:
      'migrations/20260826011300_f2_lor_1012_live_production_encrypted_private_storage_commands.sql',
    sha256: 'f727024a262524952afdcd5472a9b0188aa21e6cec0cec36529d549b37270220',
  }),
  Object.freeze({
    id: 'encrypted-private-storage-rollback',
    purpose: 'recovery-custody-and-successor-guard-verification',
    relativePath:
      'rollbacks/20260826011300_f2_lor_1012_live_production_encrypted_private_storage_commands.rollback.sql',
    sha256: '2ba4acfac228cb48e8bd11113e2f10924bbd8193820d21a107205ee51640e226',
  }),
  Object.freeze({
    id: 'faculty-candidate-auth-handoff',
    purpose: 'forward-successor',
    relativePath:
      'migrations/20260826011500_f2_lor_1012_faculty_candidate_auth_handoff_commands.sql',
    sha256: '187e13e78fa39f6b01420387488ca82e0beb0ccbe60ba82a5928c67b7f47eee0',
  }),
  Object.freeze({
    id: 'faculty-candidate-auth-handoff-rollback',
    purpose: 'recovery-custody-and-successor-guard-verification',
    relativePath:
      'rollbacks/20260826011500_f2_lor_1012_faculty_candidate_auth_handoff_commands.rollback.sql',
    sha256: 'e4521d638407b4785e83ccfd9f47a162324cbd5035dccda5b9c20b2803e37c51',
  }),
  Object.freeze({
    id: 'mentor-assignment',
    purpose: 'forward-successor',
    relativePath:
      'migrations/20260826011700_f2_lor_1012_live_production_mentor_assignment_commands.sql',
    sha256: 'b4f664ab9f968d6b625639fe8ab8819ff4a1f262fc4f8c0e3e2bab744f743431',
  }),
  Object.freeze({
    id: 'mentor-assignment-rollback',
    purpose: 'recovery-custody-and-successor-guard-verification',
    relativePath:
      'rollbacks/20260826011700_f2_lor_1012_live_production_mentor_assignment_commands.rollback.sql',
    sha256: '8c0953a5d3a5ff2443619aa670eedb2d47eac784b900177d705554235dbc3aa5',
  }),
  Object.freeze({
    id: 'private-storage-object-id-regex',
    purpose: 'forward-successor',
    relativePath:
      'migrations/20260826011900_f2_lor_1012_live_production_private_storage_object_id_regex.sql',
    sha256: 'b20496605c240c8a86ace6470faa079c7030b22c8cee661ff45ae24b2a825637',
  }),
  Object.freeze({
    id: 'private-storage-object-id-regex-rollback',
    purpose: 'recovery-custody-and-successor-guard-verification',
    relativePath:
      'rollbacks/20260826011900_f2_lor_1012_live_production_private_storage_object_id_regex.rollback.sql',
    sha256: '1a275b93d5e07a8d922d5b3da0bd4a5fd38a1eced805b4c8926a14a9d7d91f8f',
  }),
]);

export const DR133_RELATIONS = Object.freeze([
  'administrative_case_grant_revocations',
  'administrative_case_grants',
  'ai_generation_runs',
  'ai_letter_proposals',
  'ai_proposal_command_receipts',
  'ai_proposal_decisions',
  'ai_proposal_generation_reservation_receipts',
  'artifact_export_audit_events',
  'consent_receipts',
  'deletion_hold_releases',
  'deletion_intents',
  'deletion_receipts',
  'faculty_candidate_auth_handoff_redemptions',
  'faculty_candidate_auth_handoff_reservations',
  'faculty_invitations',
  'faculty_invitation_command_receipts',
  'faculty_otp_challenge_revocations',
  'faculty_otp_challenges',
  'faculty_otp_proof_revocations',
  'faculty_otp_verification_receipts',
  'faculty_private_content',
  'mentor_case_assignment_revocations',
  'mentor_case_assignments',
  'private_artifact_versions',
  'recommendation_case_audit_events',
  'recommendation_case_creation_reservations',
  'recommendation_case_private_write_receipts',
  'recommendation_case_protected_revision_states',
  'recommendation_case_write_receipts',
  'recommendation_cases',
  'released_student_documents',
  'student_auth_binding_revocations',
  'student_auth_bindings',
  'student_evidence_records',
  'waiver_receipts',
  'writer_depot_artifacts',
]);

export const DR133_APPROVED_DEFINER_IDENTITIES = Object.freeze([
  'commit_faculty_final_document_release(bigint,text,text,text,jsonb,text)',
  'commit_student_builder_autosave(jsonb,bigint,text,text,jsonb,text,jsonb)',
  'commit_student_builder_complete(jsonb,bigint,text,text,jsonb,text,jsonb)',
  'commit_student_case_create(jsonb,text,text,jsonb,text,jsonb)',
  'commit_student_consent_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
  'commit_student_waiver_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
  'read_faculty_case_projection()',
  'read_mentor_case_projection()',
]);

export const DR133_IDENTITY_SCOPE_DEFINER_IDENTITIES = Object.freeze([
  'ensure_student_auth_binding(text,text,text)',
  'resolve_faculty_case_scope(text,text,text)',
  'resolve_mentor_case_scope(text,text,text)',
  'revoke_student_auth_binding(text,text)',
]);

export const DR133_FACULTY_INVITATION_DEFINER_IDENTITIES = Object.freeze([
  'commit_faculty_invitation_delivery(text,text,text,text,text)',
  'issue_faculty_invitation(text,bigint,text,text,text,text,text,timestamp with time zone,timestamp with time zone,integer,bigint,bigint,text,text)',
  'resend_faculty_invitation_otp(text,text,text,text,timestamp with time zone,text,text)',
  'resolve_lor_actor_case_access(text,text)',
  'revoke_faculty_invitation(text,text,text)',
  'verify_faculty_invitation(text,text,text,text,text,text)',
]);

export const DR133_FACULTY_PRIVATE_EXPORT_DEFINER_IDENTITIES = Object.freeze([
  'append_artifact_export_audit(jsonb,text,text,text)',
  'commit_faculty_private_content(bigint,jsonb,text,text,jsonb,text)',
  'read_final_document_export()',
]);

export const DR133_AI_PROPOSAL_DEFINER_IDENTITIES = Object.freeze([
  'attach_ai_proposal_decision_if_undecided_atomic(text,text,text,text,text,text,text,text,text,text,text,jsonb)',
  'persist_ai_provider_run_and_proposal_atomic(text,text,text,text,text,text,text,text,text,jsonb)',
  'read_actor_safe_ai_proposal(text,text,text,text)',
  'read_faculty_drafting_context()',
  'transition_ai_proposal_generation_reservation(text,text,text,text,text,text)',
]);

export const DR133_STUDENT_EVIDENCE_DEFINER_IDENTITIES = Object.freeze([
  'commit_student_evidence_publication(bigint,text,text,jsonb,text)',
  'read_faculty_drafting_context_pre_evidence()',
]);

export const DR133_ENCRYPTED_PRIVATE_STORAGE_DEFINER_IDENTITIES = Object.freeze([
  'get_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,text,text)',
  'put_encrypted_private_artifact_version(text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,text,text,text,text)',
]);

export const DR133_FACULTY_CANDIDATE_AUTH_HANDOFF_DEFINER_IDENTITIES = Object.freeze([
  'redeem_faculty_candidate_auth_handoff(text,text,text,text,timestamp with time zone,timestamp with time zone)',
  'reserve_faculty_candidate_auth_handoff(text,text,text,integer)',
]);

export const DR133_MENTOR_ASSIGNMENT_DEFINER_IDENTITIES = Object.freeze([
  'assign_mentor_to_case(text,text,text,text,integer,text)',
  'revoke_mentor_case_assignment(text,text,text,text,text)',
]);

export const DR133_PRE_EVIDENCE_DEFINER_IDENTITY =
  'read_faculty_drafting_context_pre_evidence()';

export const DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES = Object.freeze([
  ...DR133_APPROVED_DEFINER_IDENTITIES,
  ...DR133_IDENTITY_SCOPE_DEFINER_IDENTITIES,
  ...DR133_FACULTY_INVITATION_DEFINER_IDENTITIES,
  ...DR133_FACULTY_PRIVATE_EXPORT_DEFINER_IDENTITIES,
  ...DR133_AI_PROPOSAL_DEFINER_IDENTITIES,
  ...DR133_STUDENT_EVIDENCE_DEFINER_IDENTITIES,
  ...DR133_ENCRYPTED_PRIVATE_STORAGE_DEFINER_IDENTITIES,
  ...DR133_FACULTY_CANDIDATE_AUTH_HANDOFF_DEFINER_IDENTITIES,
  ...DR133_MENTOR_ASSIGNMENT_DEFINER_IDENTITIES,
].sort());

export const DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES = Object.freeze(
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.filter(
    (identity) => identity !== DR133_PRE_EVIDENCE_DEFINER_IDENTITY,
  ),
);

export const DR133_SUCCESSOR_STAGES = Object.freeze([
  Object.freeze({
    id: 'identity-scope',
    rollbackId: 'identity-scope-rollback',
    sentinelSuffix: 'identityScope=20260826010300',
  }),
  Object.freeze({
    id: 'faculty-invitation',
    rollbackId: 'faculty-invitation-rollback',
    sentinelSuffix: 'facultyInvitationCommands=20260826010500',
  }),
  Object.freeze({
    id: 'faculty-private-export',
    rollbackId: 'faculty-private-export-rollback',
    sentinelSuffix: 'facultyPrivateExportCommands=20260826010700',
  }),
  Object.freeze({
    id: 'ai-proposal',
    rollbackId: 'ai-proposal-rollback',
    sentinelSuffix: 'aiProposalCommands=20260826010900',
  }),
  Object.freeze({
    id: 'student-evidence',
    rollbackId: 'student-evidence-rollback',
    sentinelSuffix: 'studentEvidenceCommands=20260826011100',
  }),
  Object.freeze({
    id: 'encrypted-private-storage',
    rollbackId: 'encrypted-private-storage-rollback',
    sentinelSuffix: 'encryptedPrivateStorage=20260826011300',
  }),
  Object.freeze({
    id: 'faculty-candidate-auth-handoff',
    rollbackId: 'faculty-candidate-auth-handoff-rollback',
    sentinelSuffix: 'facultyCandidateAuthHandoff=20260826011500',
  }),
  Object.freeze({
    id: 'mentor-assignment',
    rollbackId: 'mentor-assignment-rollback',
    sentinelSuffix: 'mentorAssignmentCommands=20260826011700',
  }),
  Object.freeze({
    id: 'private-storage-object-id-regex',
    rollbackId: 'private-storage-object-id-regex-rollback',
    sentinelSuffix: 'privateStorageObjectIdRegex=20260826011900',
  }),
]);

const DENIED_IDENTIFIERS = Object.freeze([
  'fglyvdykwgbuivikqoah',
  'mftguikkftmrxjxrkdln',
]);
const POSTGRES_CODE_PATTERN = /^[0-9A-Z]{5}$/u;
const POSTGRES_CODE_CLASSES = new Set([
  '00', '01', '02', '03', '08', '09', '0A', '0B', '0F', '0L', '0P', '0Z',
  '20', '21', '22', '23', '24', '25', '26', '27', '28', '2B', '2D', '2F',
  '34', '38', '39', '3B', '3D', '3F', '40', '42', '44', '53', '54', '55',
  '57', '58', '72', 'F0', 'HV', 'P0', 'P1', 'XX',
]);
const SAFE_ERROR_CODE_PATTERN = /^[A-Z0-9_]{3,80}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RUNTIME_PASSWORD_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const ROLLBACK_LITERAL_MARKER =
  '-- Literal reverse operations follow. This marker is consumed by static custody tests.';
const IDENTITY_SCOPE_ROLLBACK_FIRST_DESTRUCTIVE_STATEMENT = [
  'REVOKE EXECUTE ON FUNCTION lor_studio.ensure_student_auth_binding(text, text, text)',
  'FROM lor_studio_app;',
].join('\n');
const SUCCESSOR_ROLLBACK_GUARD_BOUNDARIES = Object.freeze({
  'identity-scope-rollback': Object.freeze({
    firstDestructiveStatement: IDENTITY_SCOPE_ROLLBACK_FIRST_DESTRUCTIVE_STATEMENT,
    guardTerminator: 'END\n$catalog_guard$;',
  }),
  'faculty-invitation-rollback': Object.freeze({
    firstDestructiveStatement:
      'REVOKE EXECUTE ON FUNCTION lor_studio.issue_faculty_invitation(',
    guardTerminator: 'END\n$catalog_guard$;',
    literalMarker: ROLLBACK_LITERAL_MARKER,
  }),
  'faculty-private-export-rollback': Object.freeze({
    firstDestructiveStatement:
      'REVOKE EXECUTE ON FUNCTION lor_studio.append_artifact_export_audit(',
    guardTerminator: 'END\n$exact_catalog_guard$;',
  }),
  'ai-proposal-rollback': Object.freeze({
    firstDestructiveStatement:
      'REVOKE EXECUTE ON FUNCTION lor_studio.read_faculty_drafting_context()',
    guardTerminator: 'END\n$catalog_guard$;',
    literalMarker:
      '-- Literal reverse operations follow; every dependency is removed explicitly.',
  }),
  'student-evidence-rollback': Object.freeze({
    firstDestructiveStatement:
      'REVOKE EXECUTE ON FUNCTION lor_studio.commit_student_evidence_publication(',
    guardTerminator: 'END\n$catalog_guard$;',
  }),
  'encrypted-private-storage-rollback': Object.freeze({
    firstDestructiveStatement:
      'REVOKE EXECUTE ON FUNCTION lor_studio.put_encrypted_private_artifact_version(',
    guardTerminator: 'END\n$catalog_guard$;',
  }),
  'faculty-candidate-auth-handoff-rollback': Object.freeze({
    firstDestructiveStatement:
      'REVOKE EXECUTE ON FUNCTION lor_studio.reserve_faculty_candidate_auth_handoff(',
    guardTerminator: 'END\n$catalog_guard$;',
  }),
  'mentor-assignment-rollback': Object.freeze({
    firstDestructiveStatement:
      'REVOKE EXECUTE ON FUNCTION lor_studio.assign_mentor_to_case(',
    guardTerminator: 'END\n$catalog_guard$;',
    literalMarker: ROLLBACK_LITERAL_MARKER,
  }),
  'private-storage-object-id-regex-rollback': Object.freeze({
    firstDestructiveStatement: [
      'ALTER TABLE lor_studio.private_artifact_versions',
      '  DROP CONSTRAINT private_artifact_versions_identifiers;',
    ].join('\n'),
    guardTerminator: 'END\n$catalog_guard$;',
    literalMarker: ROLLBACK_LITERAL_MARKER,
  }),
});
const DR133_RECEIPT_KEYS = Object.freeze([
  'aiProposalRollbackSha256',
  'aiProposalSha256',
  'contract',
  'definerCount',
  'encryptedPrivateStorageRollbackSha256',
  'encryptedPrivateStorageSha256',
  'facultyCandidateAuthHandoffRollbackSha256',
  'facultyCandidateAuthHandoffSha256',
  'facultyInvitationRollbackSha256',
  'facultyInvitationSha256',
  'facultyPrivateExportRollbackSha256',
  'facultyPrivateExportSha256',
  'foundationSha256',
  'identityScopeRollbackSha256',
  'identityScopeSha256',
  'mentorAssignmentRollbackSha256',
  'mentorAssignmentSha256',
  'mode',
  'postgresCode',
  'postgresMajor',
  'privateStorageObjectIdRegexRollbackSha256',
  'privateStorageObjectIdRegexSha256',
  'relationCount',
  'result',
  'rlsSha256',
  'runnerCode',
  'runtimeDeprovisionGuardRollbackSha256',
  'runtimeDeprovisionGuardStage',
  'studentEvidenceRollbackSha256',
  'studentEvidenceSha256',
]);
const DR133_RECEIPT_MODES = Object.freeze([
  'migration',
  'successor-migration',
  'schema-verifier',
  'runtime-login',
  'runtime-login-deprovision',
]);
const DR133_RECEIPT_RESULTS_BY_MODE = Object.freeze({
  migration: Object.freeze([
    'NO_MUTATION',
    'FOUNDATION_ROLLED_BACK',
    'FOUNDATION_OUTCOME_UNKNOWN',
    'FOUNDATION_ONLY_COMMITTED',
    'RLS_OUTCOME_UNKNOWN',
    'BASE_SCHEMA_ONLY_COMMITTED',
    'SUCCESSOR_PROGRESS_PRESERVED',
    'SUCCESSOR_PROGRESS_OUTCOME_UNKNOWN',
    'CUMULATIVE_SCHEMA_COMMITTED_POSTFLIGHT_REJECTED',
    'CUMULATIVE_SCHEMA_COMMITTED_VERIFICATION_UNKNOWN',
    'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED_CLEANUP_FAILED',
    'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED',
  ]),
  'successor-migration': Object.freeze([
    'NO_MUTATION',
    'SUCCESSOR_NEXT_STEP_ROLLED_BACK',
    'SUCCESSOR_NEXT_STEP_OUTCOME_UNKNOWN',
    'SUCCESSOR_COMMITTED_POSTFLIGHT_REJECTED',
    'SUCCESSOR_COMMITTED_VERIFICATION_UNKNOWN',
    'SUCCESSOR_COMMITTED_VERIFIED_CLEANUP_FAILED',
    'SUCCESSOR_COMMITTED_VERIFIED',
    'SUCCESSOR_ALREADY_COMMITTED_VERIFIED_CLEANUP_FAILED',
    'SUCCESSOR_ALREADY_COMMITTED_VERIFIED',
  ]),
  'schema-verifier': Object.freeze([
    'NO_MUTATION',
    'SCHEMA_VERIFIED_NO_MUTATION',
    'SCHEMA_VERIFIED_NO_MUTATION_CLEANUP_FAILED',
  ]),
  'runtime-login': Object.freeze([
    'NO_MUTATION',
    'RUNTIME_LOGIN_ROLLED_BACK',
    'RUNTIME_LOGIN_OUTCOME_UNKNOWN',
    'RUNTIME_LOGIN_COMMITTED_POSTFLIGHT_REJECTED',
    'RUNTIME_LOGIN_COMMITTED_VERIFICATION_UNKNOWN',
    'RUNTIME_LOGIN_COMMITTED_VERIFIED_CLEANUP_FAILED',
    'RUNTIME_LOGIN_COMMITTED_VERIFIED',
  ]),
  'runtime-login-deprovision': Object.freeze([
    'NO_MUTATION',
    'RUNTIME_LOGIN_DEPROVISION_ROLLED_BACK',
    'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_OUTCOME_UNKNOWN',
    'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_COMMITTED_POSTFLIGHT_REJECTED',
    'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_COMMITTED_VERIFICATION_UNKNOWN',
    'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_SESSIONS_ACTIVE',
    'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_ONLY',
    'RUNTIME_LOGIN_DEPROVISION_OUTCOME_UNKNOWN',
    'RUNTIME_LOGIN_DEPROVISION_COMMITTED_POSTFLIGHT_REJECTED',
    'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFICATION_UNKNOWN',
    'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED_CLEANUP_FAILED',
    'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
  ]),
});

export const DR133_RUNNER_ENV_KEYS = Object.freeze([
  'LOR_DR133_ADMIN_DATABASE_URL',
  DR133_DATABASE_CA_ENV_KEY,
  'LOR_DR133_MODE',
  'LOR_DR133_TUNNEL_HOST',
  'LOR_DR133_TUNNEL_PORT',
  'RAILWAY_ENVIRONMENT_ID',
  'RAILWAY_ENVIRONMENT_NAME',
  'RAILWAY_PROJECT_ID',
  'RAILWAY_SERVICE_ID',
]);

export const DR133_RUNTIME_ENV_KEYS = Object.freeze([
  ...DR133_RUNNER_ENV_KEYS,
  'LOR_DR133_RUNTIME_DATABASE_URL',
]);

export class Dr133RunnerError extends Error {
  constructor(code) {
    super(`DR-133 Railway runner failed: ${code}`);
    this.name = 'Dr133RunnerError';
    this.code = code;
  }
}

export function failDr133(code) {
  throw new Dr133RunnerError(code);
}

function requiredString(value, code) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 4_096
    || CONTROL_CHARACTER_PATTERN.test(value)
  ) failDr133(code);
  return value;
}

function assertExact(value, expected, code) {
  if (requiredString(value, code) !== expected) failDr133(code);
  return value;
}

function assertNoDeniedIdentifier(value) {
  const normalized = String(value).toLowerCase();
  if (DENIED_IDENTIFIERS.some((denied) => normalized.includes(denied))) {
    failDr133('DENIED_TARGET_IDENTIFIER');
  }
}

export function parsePrivateDatabaseUrl(rawValue, expectedUser) {
  if (![DR133_TARGET.databaseAdmin, DR133_RUNTIME_LOGIN].includes(expectedUser)) {
    failDr133('DATABASE_USER_EXPECTATION_INVALID');
  }
  const raw = requiredString(rawValue, 'DATABASE_URL_REQUIRED');
  assertNoDeniedIdentifier(raw);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    failDr133('DATABASE_URL_INVALID');
  }

  let databasePath;
  let username;
  let password;
  try {
    databasePath = decodeURIComponent(parsed.pathname);
    username = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    failDr133('DATABASE_URL_INVALID');
  }
  if (
    CONTROL_CHARACTER_PATTERN.test(databasePath)
    || CONTROL_CHARACTER_PATTERN.test(username)
    || CONTROL_CHARACTER_PATTERN.test(password)
  ) failDr133('DATABASE_URL_INVALID');
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) failDr133('DATABASE_URL_INVALID');
  if (parsed.hostname !== DR133_TARGET.databaseHost) failDr133('DATABASE_HOST_INVALID');
  if (parsed.port !== '5432') failDr133('DATABASE_PORT_INVALID');
  if (databasePath !== `/${DR133_TARGET.databaseName}`) failDr133('DATABASE_NAME_INVALID');
  if (username !== expectedUser) failDr133('DATABASE_USER_INVALID');
  if (password.length < 32 || password.length > 512) failDr133('DATABASE_PASSWORD_INVALID');
  if (parsed.hash !== '') failDr133('DATABASE_URL_INVALID');
  const queryKeys = [...parsed.searchParams.keys()];
  if (
    queryKeys.length !== 1
    || queryKeys[0] !== 'sslmode'
    || parsed.searchParams.getAll('sslmode').length !== 1
    || parsed.searchParams.get('sslmode') !== 'require'
  ) failDr133('DATABASE_SSLMODE_INVALID');
  parsed.search = '';
  return Object.freeze({
    pgConnectionString: parsed.toString(),
    password,
  });
}

export function rewriteDr133TunnelConnectionString(
  privateConnectionString,
  rawHost,
  rawPort,
) {
  if (requiredString(rawHost, 'TUNNEL_HOST_REQUIRED') !== DR133_TUNNEL_HOST) {
    failDr133('TUNNEL_HOST_INVALID');
  }
  const port = requiredString(rawPort, 'TUNNEL_PORT_REQUIRED');
  if (!/^[1-9][0-9]{3,4}$/u.test(port)) failDr133('TUNNEL_PORT_INVALID');
  const numericPort = Number(port);
  if (
    !Number.isSafeInteger(numericPort)
    || numericPort < 1_024
    || numericPort > 65_535
    || numericPort === 5_432
  ) {
    failDr133('TUNNEL_PORT_INVALID');
  }
  let parsed;
  try {
    parsed = new URL(privateConnectionString);
  } catch {
    failDr133('DATABASE_URL_INVALID');
  }
  if (parsed.hostname !== DR133_TARGET.databaseHost || parsed.port !== '5432') {
    failDr133('DATABASE_URL_INVALID');
  }
  parsed.hostname = DR133_TUNNEL_HOST;
  parsed.port = port;
  return Object.freeze({
    connectionString: parsed.toString(),
    tlsServername: DR133_TARGET.databaseHost,
    tunnelHost: DR133_TUNNEL_HOST,
    tunnelPort: numericPort,
  });
}

export function resolveDr133RunnerEnvironment(rawEnvironment, { mode }) {
  if (!rawEnvironment || typeof rawEnvironment !== 'object') failDr133('ENVIRONMENT_REQUIRED');
  if (![
    'connectivity-preflight',
    'migration',
    'successor-migration',
    'schema-verifier',
    'runtime-login',
    'runtime-login-deprovision',
  ].includes(mode)) {
    failDr133('MODE_INVALID');
  }
  const expectedKeys = mode === 'runtime-login' ? DR133_RUNTIME_ENV_KEYS : DR133_RUNNER_ENV_KEYS;
  for (const key of expectedKeys) {
    if (key !== DR133_DATABASE_CA_ENV_KEY) {
      requiredString(rawEnvironment[key], `${key}_REQUIRED`);
    }
  }

  const expectedLorKeys = expectedKeys.filter((key) => key.startsWith('LOR_DR133_')).sort();
  const observedLorKeys = Object.keys(rawEnvironment)
    .filter((key) => key.startsWith('LOR_DR133_'))
    .sort();
  if (JSON.stringify(observedLorKeys) !== JSON.stringify(expectedLorKeys)) {
    failDr133('UNEXPECTED_LOR_ENVIRONMENT_KEY');
  }

  assertExact(rawEnvironment.LOR_DR133_MODE, mode, 'MODE_MISMATCH');
  assertExact(rawEnvironment.RAILWAY_PROJECT_ID, DR133_TARGET.projectId, 'PROJECT_ID_MISMATCH');
  assertExact(
    rawEnvironment.RAILWAY_ENVIRONMENT_ID,
    DR133_TARGET.environmentId,
    'ENVIRONMENT_ID_MISMATCH',
  );
  assertExact(
    rawEnvironment.RAILWAY_ENVIRONMENT_NAME,
    DR133_TARGET.environmentName,
    'ENVIRONMENT_NAME_MISMATCH',
  );
  assertExact(
    rawEnvironment.RAILWAY_SERVICE_ID,
    DR133_TARGET.executionServiceId,
    'EXECUTION_SERVICE_ID_MISMATCH',
  );
  const admin = parsePrivateDatabaseUrl(
    rawEnvironment.LOR_DR133_ADMIN_DATABASE_URL,
    DR133_TARGET.databaseAdmin,
  );
  const runtime = mode === 'runtime-login'
    ? parsePrivateDatabaseUrl(rawEnvironment.LOR_DR133_RUNTIME_DATABASE_URL, DR133_RUNTIME_LOGIN)
    : null;
  if (runtime && runtime.password === admin.password) failDr133('RUNTIME_PASSWORD_NOT_SEPARATE');
  if (runtime && !RUNTIME_PASSWORD_PATTERN.test(runtime.password)) {
    failDr133('RUNTIME_PASSWORD_FORMAT_INVALID');
  }
  const adminTunnel = rewriteDr133TunnelConnectionString(
    admin.pgConnectionString,
    rawEnvironment.LOR_DR133_TUNNEL_HOST,
    rawEnvironment.LOR_DR133_TUNNEL_PORT,
  );
  const runtimeTunnel = runtime
    ? rewriteDr133TunnelConnectionString(
      runtime.pgConnectionString,
      rawEnvironment.LOR_DR133_TUNNEL_HOST,
      rawEnvironment.LOR_DR133_TUNNEL_PORT,
    )
    : null;
  const databaseCa = verifiedDr133DatabaseCa(rawEnvironment[DR133_DATABASE_CA_ENV_KEY]);

  return Object.freeze({
    mode,
    adminPgConnectionString: adminTunnel.connectionString,
    runtimePgConnectionString: runtimeTunnel?.connectionString ?? null,
    runtimePassword: runtime?.password ?? null,
    databaseCa,
    databaseTlsServername: adminTunnel.tlsServername,
    tunnelHost: adminTunnel.tunnelHost,
    tunnelPort: adminTunnel.tunnelPort,
  });
}

export function verifiedDr133DatabaseCa(rawValue) {
  if (typeof rawValue !== 'string' || rawValue.length < 256 || rawValue.length > 16_384
    || rawValue.includes('PRIVATE KEY')
    || rawValue.match(/-----BEGIN CERTIFICATE-----/gu)?.length !== 1
    || rawValue.match(/-----END CERTIFICATE-----/gu)?.length !== 1
    || !rawValue.startsWith('-----BEGIN CERTIFICATE-----')) {
    failDr133('DATABASE_CA_REJECTED');
  }
  try {
    const certificate = new X509Certificate(rawValue);
    const now = Date.now();
    if (certificate.ca !== true || !certificate.checkIssued(certificate)
      || !certificate.verify(certificate.publicKey)
      || !(Date.parse(certificate.validFrom) <= now && now < Date.parse(certificate.validTo))
      || createHash('sha256').update(certificate.raw).digest('hex')
        !== DR133_PRODUCTION_DATABASE_CA_DER_SHA256) {
      failDr133('DATABASE_CA_REJECTED');
    }
    const canonical = certificate.toString();
    const railwayNormalized = canonical.endsWith('\n') ? canonical.slice(0, -1) : canonical;
    if (rawValue !== canonical && rawValue !== railwayNormalized) {
      failDr133('DATABASE_CA_REJECTED');
    }
    return canonical;
  } catch (error) {
    if (error instanceof Dr133RunnerError) throw error;
    failDr133('DATABASE_CA_REJECTED');
  }
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function expectedDr133Sentinel() {
  return [
    'missionmed.lor.railway-postgres-target.v2|deploymentEnvironment=production|migrationLedger=lor_studio/migrations/production',
    `provider=${DR133_TARGET.provider}`,
    `project=${DR133_TARGET.projectId}`,
    `environment=${DR133_TARGET.environmentId}`,
    `service=${DR133_TARGET.databaseServiceId}`,
    `database=${DR133_TARGET.databaseName}`,
    `admin=${DR133_TARGET.databaseAdmin}`,
    `region=${DR133_TARGET.region}`,
    `decision=${DR133_TARGET.decisionRecord}`,
    `dataCopied=${DR133_TARGET.dataCopied}`,
    'foundation=20260826010000',
  ].join('|');
}

export function expectedDr133SuccessorSentinel() {
  return DR133_SUCCESSOR_STAGES.reduce(
    (sentinel, stage) => `${sentinel}|${stage.sentinelSuffix}`,
    expectedDr133Sentinel(),
  );
}

export function expectedDr133SuccessorSentinelAt(stageCount) {
  if (!Number.isInteger(stageCount) || stageCount < 0 || stageCount > DR133_SUCCESSOR_STAGES.length) {
    failDr133('SUCCESSOR_STAGE_INVALID');
  }
  return DR133_SUCCESSOR_STAGES.slice(0, stageCount).reduce(
    (sentinel, stage) => `${sentinel}|${stage.sentinelSuffix}`,
    expectedDr133Sentinel(),
  );
}

export function dr133RuntimeDeprovisionRollbackArtifactId(stageCount) {
  if (!Number.isInteger(stageCount) || stageCount < 0
    || stageCount > DR133_SUCCESSOR_STAGES.length) {
    failDr133('SUCCESSOR_STAGE_INVALID');
  }
  return stageCount === 0
    ? 'rls-rollback'
    : DR133_SUCCESSOR_STAGES[stageCount - 1].rollbackId;
}

export function targetGucEntries() {
  return Object.freeze([
    Object.freeze(['missionmed.lor.target_provider', DR133_TARGET.provider]),
    Object.freeze(['missionmed.lor.target_deployment_environment', DR133_TARGET.deploymentEnvironment]),
    Object.freeze(['missionmed.lor.target_migration_ledger', DR133_TARGET.migrationLedger]),
    Object.freeze(['missionmed.lor.target_project_id', DR133_TARGET.projectId]),
    Object.freeze(['missionmed.lor.target_environment_id', DR133_TARGET.environmentId]),
    Object.freeze(['missionmed.lor.target_service_id', DR133_TARGET.databaseServiceId]),
    Object.freeze(['missionmed.lor.target_database_name', DR133_TARGET.databaseName]),
    Object.freeze(['missionmed.lor.target_region', DR133_TARGET.region]),
    Object.freeze(['missionmed.lor.target_decision_record', DR133_TARGET.decisionRecord]),
    Object.freeze(['missionmed.lor.target_data_copied', DR133_TARGET.dataCopied]),
  ]);
}

export function classifySafeFailure(error) {
  const runnerCode = error instanceof Dr133RunnerError && SAFE_ERROR_CODE_PATTERN.test(error.code)
    ? error.code
    : 'UNEXPECTED_FAILURE';
  const postgresCode = typeof error?.code === 'string'
    && POSTGRES_CODE_PATTERN.test(error.code)
    && POSTGRES_CODE_CLASSES.has(error.code.slice(0, 2))
    ? error.code
    : null;
  return Object.freeze({ runnerCode, postgresCode });
}

export function postgresOutcomeIsUnknown(error) {
  const { postgresCode: code } = classifySafeFailure(error);
  return code === null
    || code.startsWith('08')
    || ['57P01', '57P02', '57P03', '57P04'].includes(code);
}

function isCanonicalInteger(value, { minimum = 0, maximum = 100_000 } = {}) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export function writeDr133Receipt(stream, payload) {
  if (!stream || typeof stream.write !== 'function') failDr133('OUTPUT_STREAM_INVALID');
  if (
    !payload
    || typeof payload !== 'object'
    || Array.isArray(payload)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(payload))
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  const descriptors = Object.getOwnPropertyDescriptors(payload);
  if (Object.values(descriptors).some((descriptor) => !('value' in descriptor))) {
    failDr133('OUTPUT_RECEIPT_INVALID');
  }
  const keys = Object.keys(payload).sort();
  if (keys.some((key) => !DR133_RECEIPT_KEYS.includes(key))) {
    failDr133('OUTPUT_RECEIPT_INVALID');
  }
  if (
    payload.contract !== DR133_RUNNER_CONTRACT
    || !DR133_RECEIPT_MODES.includes(payload.mode)
    || !DR133_RECEIPT_RESULTS_BY_MODE[payload.mode]?.includes(payload.result)
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  if (
    payload.runnerCode !== undefined
    && (typeof payload.runnerCode !== 'string'
      || !SAFE_ERROR_CODE_PATTERN.test(payload.runnerCode))
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  if (
    payload.postgresCode !== undefined
    && payload.postgresCode !== null
    && (typeof payload.postgresCode !== 'string'
      || !POSTGRES_CODE_PATTERN.test(payload.postgresCode)
      || !POSTGRES_CODE_CLASSES.has(payload.postgresCode.slice(0, 2)))
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  for (const hashKey of [
    'aiProposalRollbackSha256',
    'aiProposalSha256',
    'encryptedPrivateStorageRollbackSha256',
    'encryptedPrivateStorageSha256',
    'facultyCandidateAuthHandoffRollbackSha256',
    'facultyCandidateAuthHandoffSha256',
    'facultyInvitationRollbackSha256',
    'facultyInvitationSha256',
    'facultyPrivateExportRollbackSha256',
    'facultyPrivateExportSha256',
    'foundationSha256',
    'identityScopeRollbackSha256',
    'identityScopeSha256',
    'mentorAssignmentRollbackSha256',
    'mentorAssignmentSha256',
    'privateStorageObjectIdRegexRollbackSha256',
    'privateStorageObjectIdRegexSha256',
    'rlsSha256',
    'runtimeDeprovisionGuardRollbackSha256',
    'studentEvidenceRollbackSha256',
    'studentEvidenceSha256',
  ]) {
    if (payload[hashKey] !== undefined && !SHA256_PATTERN.test(payload[hashKey])) {
      failDr133('OUTPUT_RECEIPT_INVALID');
    }
  }
  for (const integerKey of [
    'definerCount',
    'postgresMajor',
    'relationCount',
    'runtimeDeprovisionGuardStage',
  ]) {
    if (payload[integerKey] !== undefined && !isCanonicalInteger(payload[integerKey])) {
      failDr133('OUTPUT_RECEIPT_INVALID');
    }
  }
  const has = (key) => Object.hasOwn(payload, key);
  const requireKeys = (requiredKeys) => {
    if (requiredKeys.some((key) => !has(key))) failDr133('OUTPUT_RECEIPT_INVALID');
  };
  const successResults = new Set([
    'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED',
    'SUCCESSOR_COMMITTED_VERIFIED',
    'SUCCESSOR_ALREADY_COMMITTED_VERIFIED',
    'RUNTIME_LOGIN_COMMITTED_VERIFIED',
    'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
    'SCHEMA_VERIFIED_NO_MUTATION',
  ]);
  if (payload.mode === 'migration') {
    requireKeys([
      'aiProposalRollbackSha256',
      'aiProposalSha256',
      'encryptedPrivateStorageRollbackSha256',
      'encryptedPrivateStorageSha256',
      'facultyCandidateAuthHandoffRollbackSha256',
      'facultyCandidateAuthHandoffSha256',
      'facultyInvitationRollbackSha256',
      'facultyInvitationSha256',
      'facultyPrivateExportRollbackSha256',
      'facultyPrivateExportSha256',
      'foundationSha256',
      'identityScopeRollbackSha256',
      'identityScopeSha256',
      'mentorAssignmentRollbackSha256',
      'mentorAssignmentSha256',
      'privateStorageObjectIdRegexRollbackSha256',
      'privateStorageObjectIdRegexSha256',
      'rlsSha256',
      'studentEvidenceRollbackSha256',
      'studentEvidenceSha256',
    ]);
    if (payload.result === 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED') {
      requireKeys(['definerCount', 'postgresMajor', 'relationCount']);
    }
  }
  if (payload.mode === 'successor-migration') {
    requireKeys([
      'aiProposalRollbackSha256',
      'aiProposalSha256',
      'encryptedPrivateStorageRollbackSha256',
      'encryptedPrivateStorageSha256',
      'facultyCandidateAuthHandoffRollbackSha256',
      'facultyCandidateAuthHandoffSha256',
      'facultyInvitationRollbackSha256',
      'facultyInvitationSha256',
      'facultyPrivateExportRollbackSha256',
      'facultyPrivateExportSha256',
      'foundationSha256',
      'identityScopeRollbackSha256',
      'identityScopeSha256',
      'mentorAssignmentRollbackSha256',
      'mentorAssignmentSha256',
      'privateStorageObjectIdRegexRollbackSha256',
      'privateStorageObjectIdRegexSha256',
      'rlsSha256',
      'studentEvidenceRollbackSha256',
      'studentEvidenceSha256',
    ]);
    if ([
      'SUCCESSOR_COMMITTED_VERIFIED',
      'SUCCESSOR_ALREADY_COMMITTED_VERIFIED',
    ].includes(payload.result)) {
      requireKeys(['definerCount', 'postgresMajor', 'relationCount']);
    }
  }
  if (payload.mode === 'schema-verifier') {
    requireKeys([
      'aiProposalRollbackSha256',
      'aiProposalSha256',
      'encryptedPrivateStorageRollbackSha256',
      'encryptedPrivateStorageSha256',
      'facultyCandidateAuthHandoffRollbackSha256',
      'facultyCandidateAuthHandoffSha256',
      'facultyInvitationRollbackSha256',
      'facultyInvitationSha256',
      'facultyPrivateExportRollbackSha256',
      'facultyPrivateExportSha256',
      'foundationSha256',
      'identityScopeRollbackSha256',
      'identityScopeSha256',
      'mentorAssignmentRollbackSha256',
      'mentorAssignmentSha256',
      'privateStorageObjectIdRegexRollbackSha256',
      'privateStorageObjectIdRegexSha256',
      'rlsSha256',
      'studentEvidenceRollbackSha256',
      'studentEvidenceSha256',
    ]);
    if (payload.result === 'SCHEMA_VERIFIED_NO_MUTATION') {
      requireKeys(['definerCount', 'postgresMajor', 'relationCount']);
    }
  }
  if (
    payload.mode === 'runtime-login'
    && payload.result !== 'NO_MUTATION'
  ) requireKeys(['privateStorageObjectIdRegexRollbackSha256']);
  if (
    payload.mode === 'runtime-login-deprovision'
    && payload.result !== 'NO_MUTATION'
  ) requireKeys([
    'runtimeDeprovisionGuardRollbackSha256',
    'runtimeDeprovisionGuardStage',
  ]);
  if (
    payload.runtimeDeprovisionGuardStage !== undefined
    && payload.runtimeDeprovisionGuardStage > DR133_SUCCESSOR_STAGES.length
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  const hasGuardStage = has('runtimeDeprovisionGuardStage');
  const hasGuardHash = has('runtimeDeprovisionGuardRollbackSha256');
  if (hasGuardStage !== hasGuardHash
    || ((hasGuardStage || hasGuardHash) && payload.mode !== 'runtime-login-deprovision')) {
    failDr133('OUTPUT_RECEIPT_INVALID');
  }
  if (hasGuardStage) {
    const artifactId = dr133RuntimeDeprovisionRollbackArtifactId(
      payload.runtimeDeprovisionGuardStage,
    );
    const expectedHash = DR133_ARTIFACTS.find((artifact) => artifact.id === artifactId)?.sha256;
    if (payload.runtimeDeprovisionGuardRollbackSha256 !== expectedHash) {
      failDr133('OUTPUT_RECEIPT_INVALID');
    }
  }
  if (payload.result === 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED') {
    requireKeys(['postgresMajor']);
  }
  if (successResults.has(payload.result)) {
    if (has('runnerCode') || has('postgresCode')) failDr133('OUTPUT_RECEIPT_INVALID');
  } else {
    requireKeys(['runnerCode', 'postgresCode']);
  }
  stream.write(`${JSON.stringify(payload)}\n`);
}

export function assertPreflightRow(row) {
  if (!row || typeof row !== 'object') failDr133('PREFLIGHT_RESULT_INVALID');
  if (
    row.database_name !== DR133_TARGET.databaseName
    || row.current_user !== DR133_TARGET.databaseAdmin
    || row.session_user !== DR133_TARGET.databaseAdmin
    || row.database_owner !== DR133_TARGET.databaseAdmin
    || ![16, 18].includes(row.postgres_major)
    || row.private_server_address !== true
    || row.ssl_active !== true
    || typeof row.ssl_version !== 'string'
    || row.ssl_version.length === 0
    || typeof row.ssl_cipher !== 'string'
    || row.ssl_cipher.length === 0
    || row.schema_count !== '0'
    || row.app_role_count !== '0'
    || row.command_owner_count !== '0'
    || row.runtime_login_count !== '0'
  ) failDr133('PREFLIGHT_TARGET_INVALID');
}

export function assertFoundationSentinelRow(row) {
  if (!row || row.schema_sentinel !== expectedDr133Sentinel()) {
    failDr133('FOUNDATION_SENTINEL_INVALID');
  }
}

export function assertSuccessorSchemaPreflightRow(row) {
  if (!row || typeof row !== 'object') failDr133('SUCCESSOR_PREFLIGHT_RESULT_INVALID');
  if (
    row.database_name !== DR133_TARGET.databaseName
    || row.current_user !== DR133_TARGET.databaseAdmin
    || row.session_user !== DR133_TARGET.databaseAdmin
    || row.database_owner !== DR133_TARGET.databaseAdmin
    || ![16, 18].includes(row.postgres_major)
    || row.private_server_address !== true
    || row.ssl_active !== true
    || typeof row.ssl_version !== 'string'
    || row.ssl_version.length === 0
    || typeof row.ssl_cipher !== 'string'
    || row.ssl_cipher.length === 0
    || row.schema_sentinel !== expectedDr133SuccessorSentinel()
    || row.schema_owner !== DR133_TARGET.databaseAdmin
    || row.schema_count !== '1'
    || row.app_role_count !== '1'
    || row.command_owner_count !== '1'
    || row.runtime_login_count !== '0'
  ) failDr133('SUCCESSOR_PREFLIGHT_TARGET_INVALID');
}

export function assertBaseSchemaPreflightRow(row) {
  if (!row || typeof row !== 'object') failDr133('BASE_SCHEMA_PREFLIGHT_RESULT_INVALID');
  if (
    row.database_name !== DR133_TARGET.databaseName
    || row.current_user !== DR133_TARGET.databaseAdmin
    || row.session_user !== DR133_TARGET.databaseAdmin
    || row.database_owner !== DR133_TARGET.databaseAdmin
    || ![16, 18].includes(row.postgres_major)
    || row.private_server_address !== true
    || row.ssl_active !== true
    || typeof row.ssl_version !== 'string'
    || row.ssl_version.length === 0
    || typeof row.ssl_cipher !== 'string'
    || row.ssl_cipher.length === 0
    || row.schema_sentinel !== expectedDr133Sentinel()
    || row.schema_owner !== DR133_TARGET.databaseAdmin
    || row.schema_count !== '1'
    || row.app_role_count !== '1'
    || row.command_owner_count !== '1'
    || row.runtime_login_count !== '0'
  ) failDr133('BASE_SCHEMA_PREFLIGHT_TARGET_INVALID');
}

export function assertPostflightRow(row) {
  if (!row || typeof row !== 'object') failDr133('POSTFLIGHT_RESULT_INVALID');
  const observedDefiners = Array.isArray(row.definer_identities) ? row.definer_identities : [];
  const observedAppDefiners = Array.isArray(row.app_execute_identities)
    ? row.app_execute_identities
    : [];
  const observedRelations = Array.isArray(row.relation_names) ? row.relation_names : [];
  if (
    row.schema_sentinel !== expectedDr133SuccessorSentinel()
    || row.schema_owner !== DR133_TARGET.databaseAdmin
    || row.relation_count !== String(DR133_RELATIONS.length)
    || row.forced_rls_count !== String(DR133_RELATIONS.length)
    || row.definer_count !== String(DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length)
    || row.app_execute_count !== String(
      DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES.length
    )
    || row.pre_evidence_app_execute_denied !== true
    || row.pre_evidence_public_execute_denied !== true
    || row.public_function_execute_count !== '0'
    || row.public_table_privilege_count !== '0'
    || row.nonempty_relation_count !== '0'
    || row.view_count !== '1'
    || row.view_identity !== 'student_recommendation_case_projection@postgres'
    || row.app_role_safe !== true
    || row.command_owner_safe !== true
    || row.definer_custody_safe !== true
    || row.nologin_role_membership_count !== '0'
    || JSON.stringify(observedRelations) !== JSON.stringify([...DR133_RELATIONS].sort())
    || JSON.stringify(observedDefiners)
      !== JSON.stringify([...DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES].sort())
    || JSON.stringify(observedAppDefiners)
      !== JSON.stringify([...DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES].sort())
  ) failDr133('POSTFLIGHT_CATALOG_INVALID');
}

export function assertRuntimeAdminRow(row) {
  if (
    !row
    || row.runtime_role_safe !== true
    || row.membership_safe !== true
    || row.membership_count !== '1'
    || row.runtime_owned_object_count !== '0'
    || row.runtime_default_acl_count !== '0'
  ) failDr133('RUNTIME_LOGIN_CATALOG_INVALID');
}

function parseCanonicalCountText(value, code) {
  if (!/^(?:0|[1-9][0-9]{0,9})$/u.test(value)) failDr133(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 100_000) failDr133(code);
  return parsed;
}

function assertCanonicalOidText(value, code) {
  if (!/^[1-9][0-9]{0,9}$/u.test(value)) failDr133(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 4_294_967_295) failDr133(code);
  return value;
}

function runtimeDeprovisionRoleState(row, code) {
  const activeRoleSafe = row?.runtime_role_active_safe;
  const quarantinedRoleSafe = row?.runtime_role_quarantined_safe;
  if (
    !row
    || typeof row !== 'object'
    || row.database_name !== DR133_TARGET.databaseName
    || row.current_user !== DR133_TARGET.databaseAdmin
    || row.session_user !== DR133_TARGET.databaseAdmin
    || row.database_owner !== DR133_TARGET.databaseAdmin
    || ![16, 18].includes(row.postgres_major)
    || row.private_server_address !== true
    || row.ssl_active !== true
    || typeof row.ssl_version !== 'string'
    || row.ssl_version.length === 0
    || typeof row.ssl_cipher !== 'string'
    || row.ssl_cipher.length === 0
    || !Array.from(
      { length: DR133_SUCCESSOR_STAGES.length + 1 },
      (_, index) => expectedDr133SuccessorSentinelAt(index),
    ).includes(row.schema_sentinel)
    || row.app_role_count !== '1'
    || row.command_owner_count !== '1'
    || row.runtime_login_count !== '1'
    || row.lor_role_count !== '3'
    || typeof activeRoleSafe !== 'boolean'
    || typeof quarantinedRoleSafe !== 'boolean'
    || activeRoleSafe === quarantinedRoleSafe
    || row.membership_safe !== true
    || row.membership_count !== '1'
    || row.runtime_owned_object_count !== '0'
    || row.runtime_default_acl_count !== '0'
    || row.runtime_unsafe_dependency_count !== '0'
  ) failDr133(code);
  const runtimeRoleOid = assertCanonicalOidText(row.runtime_role_oid, code);
  const activeSessionCount = parseCanonicalCountText(row.runtime_active_session_count, code);
  const startingClientBackendCount = parseCanonicalCountText(
    row.starting_unauthenticated_client_backend_count,
    code,
  );
  const authenticationTimeoutSeconds = parseCanonicalCountText(
    row.authentication_timeout_seconds,
    code,
  );
  const successorStageIndex = Array.from(
    { length: DR133_SUCCESSOR_STAGES.length + 1 },
    (_, index) => index,
  ).find((index) => row.schema_sentinel === expectedDr133SuccessorSentinelAt(index));
  if (successorStageIndex === undefined) failDr133(code);
  if (
    authenticationTimeoutSeconds < 1
    || authenticationTimeoutSeconds > 120
    || row.pre_auth_delay_seconds !== '0'
    || row.post_auth_delay_seconds !== '0'
  ) failDr133(code);
  return Object.freeze({
    runtimeRoleOid,
    activeSessionCount,
    startingClientBackendCount,
    authenticationTimeoutSeconds,
    successorStageIndex,
    roleState: activeRoleSafe ? 'active' : 'quarantined',
  });
}

export function assertRuntimeDeprovisionPreflightRow(row) {
  return runtimeDeprovisionRoleState(row, 'RUNTIME_LOGIN_DEPROVISION_PREFLIGHT_INVALID');
}

export function assertRuntimeDeprovisionQuarantinedRow(
  row,
  expectedRuntimeRoleOid,
  { requireNoSessions = false } = {},
) {
  const expectedOid = assertCanonicalOidText(
    expectedRuntimeRoleOid,
    'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_INVALID',
  );
  const state = runtimeDeprovisionRoleState(
    row,
    'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_INVALID',
  );
  if (
    state.runtimeRoleOid !== expectedOid
    || state.roleState !== 'quarantined'
    || (requireNoSessions && (
      state.activeSessionCount !== 0
      || state.startingClientBackendCount !== 0
    ))
  ) failDr133('RUNTIME_LOGIN_DEPROVISION_QUARANTINE_INVALID');
  return state;
}

export function assertRuntimeDeprovisionAbsentRow(row, expectedRuntimeRoleOid) {
  const expectedOid = assertCanonicalOidText(
    expectedRuntimeRoleOid,
    'RUNTIME_LOGIN_DEPROVISION_ABSENCE_INVALID',
  );
  if (
    !row
    || typeof row !== 'object'
    || row.checked_runtime_oid !== expectedOid
    || row.runtime_name_count !== '0'
    || row.runtime_oid_count !== '0'
    || row.membership_count !== '0'
    || row.runtime_active_session_count !== '0'
    || row.starting_unauthenticated_client_backend_count !== '0'
    || row.runtime_owned_object_count !== '0'
    || row.runtime_default_acl_count !== '0'
    || row.runtime_unsafe_dependency_count !== '0'
  ) failDr133('RUNTIME_LOGIN_DEPROVISION_ABSENCE_INVALID');
}

export function assertRuntimeDeprovisionRevokedRow(row, expectedRuntimeRoleOid) {
  const expectedOid = assertCanonicalOidText(
    expectedRuntimeRoleOid,
    'RUNTIME_LOGIN_DEPROVISION_REVOKE_INVALID',
  );
  if (
    !row
    || typeof row !== 'object'
    || row.checked_runtime_oid !== expectedOid
    || row.runtime_name_count !== '1'
    || row.runtime_oid_count !== '1'
    || row.membership_count !== '0'
    || row.runtime_active_session_count !== '0'
    || row.starting_unauthenticated_client_backend_count !== '0'
    || row.runtime_owned_object_count !== '0'
    || row.runtime_default_acl_count !== '0'
    || row.runtime_unsafe_dependency_count !== '0'
  ) failDr133('RUNTIME_LOGIN_DEPROVISION_REVOKE_INVALID');
}

export function assertRuntimeIdentityRow(row) {
  if (
    !row
    || row.database_name !== DR133_TARGET.databaseName
    || row.current_user !== DR133_RUNTIME_LOGIN
    || row.session_user !== DR133_RUNTIME_LOGIN
    || row.private_server_address !== true
    || row.ssl_active !== true
    || typeof row.ssl_version !== 'string'
    || row.ssl_version.length === 0
    || typeof row.ssl_cipher !== 'string'
    || row.ssl_cipher.length === 0
  ) failDr133('RUNTIME_LOGIN_IDENTITY_INVALID');
}

export function assertRuntimeSetRoleRow(row) {
  if (
    !row
    || row.current_user !== DR133_APPLICATION_ROLE
    || row.session_user !== DR133_RUNTIME_LOGIN
    || row.visible_case_count !== '0'
  ) failDr133('RUNTIME_SET_ROLE_INVALID');
}

export function assertRuntimeCleanupRow(row) {
  if (
    !row
    || row.current_user !== DR133_RUNTIME_LOGIN
    || row.session_user !== DR133_RUNTIME_LOGIN
  ) failDr133('RUNTIME_ROLE_CLEANUP_INVALID');
}

export function quoteFixedIdentifier(identifier) {
  if (!DR133_RELATIONS.includes(identifier)) failDr133('RELATION_IDENTIFIER_INVALID');
  return `"${identifier}"`;
}

export function buildNonemptyRelationsSql() {
  const branches = DR133_RELATIONS.map(
    (relation) => `SELECT 1 AS present WHERE EXISTS (SELECT 1 FROM lor_studio.${quoteFixedIdentifier(relation)})`,
  );
  return [
    'SELECT pg_catalog.count(*)::text AS nonempty_relation_count',
    'FROM (',
    branches.join('\nUNION ALL\n'),
    ') AS nonempty_relations',
  ].join('\n');
}

function splitVerifiedRollbackGuard(source) {
  if (typeof source !== 'string') failDr133('ROLLBACK_GUARD_SOURCE_INVALID');
  const rollbackArtifact = DR133_ARTIFACTS.find((artifact) => artifact.id === 'rls-rollback');
  if (sha256Bytes(source) !== rollbackArtifact.sha256) failDr133('ROLLBACK_ARTIFACT_HASH_MISMATCH');
  const markerIndex = source.indexOf(ROLLBACK_LITERAL_MARKER);
  if (
    markerIndex < 0
    || markerIndex !== source.lastIndexOf(ROLLBACK_LITERAL_MARKER)
  ) failDr133('ROLLBACK_GUARD_MARKER_INVALID');
  const prefix = source.slice(0, markerIndex).trimEnd();
  const destructiveTail = source.slice(markerIndex + ROLLBACK_LITERAL_MARKER.length).trimStart();
  if (
    !prefix.endsWith('END\n$catalog_guard$;')
    || !destructiveTail.startsWith(
      'REVOKE EXECUTE ON FUNCTION lor_studio.commit_student_case_create',
    )
  ) failDr133('ROLLBACK_GUARD_BOUNDARY_INVALID');
  return Object.freeze({ prefix, destructiveTail });
}

function splitVerifiedSuccessorRollbackGuard(source, rollbackArtifactId) {
  if (typeof source !== 'string') failDr133('SUCCESSOR_ROLLBACK_GUARD_SOURCE_INVALID');
  const boundary = SUCCESSOR_ROLLBACK_GUARD_BOUNDARIES[rollbackArtifactId];
  const rollbackArtifact = DR133_ARTIFACTS.find(
    (artifact) => artifact.id === rollbackArtifactId,
  );
  if (!boundary || !rollbackArtifact) failDr133('SUCCESSOR_ROLLBACK_ARTIFACT_INVALID');
  if (sha256Bytes(source) !== rollbackArtifact.sha256) {
    failDr133('SUCCESSOR_ROLLBACK_ARTIFACT_HASH_MISMATCH');
  }
  const boundaryIndex = source.indexOf(boundary.firstDestructiveStatement);
  if (
    boundaryIndex < 0
    || boundaryIndex !== source.lastIndexOf(boundary.firstDestructiveStatement)
  ) failDr133('SUCCESSOR_ROLLBACK_GUARD_BOUNDARY_INVALID');
  let prefix = source.slice(0, boundaryIndex).trimEnd();
  const destructiveTail = source.slice(boundaryIndex).trimStart();
  if (boundary.literalMarker) {
    if (!prefix.endsWith(boundary.literalMarker)) {
      failDr133('SUCCESSOR_ROLLBACK_GUARD_BOUNDARY_INVALID');
    }
    prefix = prefix.slice(0, -boundary.literalMarker.length).trimEnd();
  }
  if (
    !prefix.endsWith(boundary.guardTerminator)
    || !destructiveTail.startsWith(boundary.firstDestructiveStatement)
  ) failDr133('SUCCESSOR_ROLLBACK_GUARD_BOUNDARY_INVALID');
  return Object.freeze({ prefix, destructiveTail, boundary });
}

export function extractRollbackGuardVerificationSql(source) {
  const { prefix } = splitVerifiedRollbackGuard(source);
  return `${prefix}\n\nROLLBACK;\n`;
}

export function extractRollbackGuardTransactionBodySql(source) {
  const { prefix } = splitVerifiedRollbackGuard(source);
  const outerBegin = '\nBEGIN;\n\n';
  const beginIndex = prefix.indexOf(outerBegin);
  if (beginIndex < 0 || beginIndex !== prefix.lastIndexOf(outerBegin)) {
    failDr133('ROLLBACK_GUARD_TRANSACTION_BOUNDARY_INVALID');
  }
  const body = prefix.slice(beginIndex + outerBegin.length);
  if (
    !body.startsWith('DO $identity_guard$\n')
    || !body.endsWith('END\n$catalog_guard$;')
    || body.includes(ROLLBACK_LITERAL_MARKER)
  ) failDr133('ROLLBACK_GUARD_TRANSACTION_BOUNDARY_INVALID');
  return `${body}\n`;
}

export function extractIdentityScopeRollbackGuardVerificationSql(source) {
  return extractSuccessorRollbackGuardVerificationSql(source, 'identity-scope-rollback');
}

export function extractSuccessorRollbackGuardVerificationSql(source, rollbackArtifactId) {
  const { prefix } = splitVerifiedSuccessorRollbackGuard(source, rollbackArtifactId);
  return `${prefix}\n\nROLLBACK;\n`;
}

export function extractIdentityScopeRollbackGuardTransactionBodySql(source) {
  return extractSuccessorRollbackGuardTransactionBodySql(source, 'identity-scope-rollback');
}

export function extractSuccessorRollbackGuardTransactionBodySql(source, rollbackArtifactId) {
  const { prefix, boundary } = splitVerifiedSuccessorRollbackGuard(source, rollbackArtifactId);
  const outerBegin = '\nBEGIN;\n\n';
  const beginIndex = prefix.indexOf(outerBegin);
  if (beginIndex < 0 || beginIndex !== prefix.lastIndexOf(outerBegin)) {
    failDr133('SUCCESSOR_ROLLBACK_GUARD_TRANSACTION_BOUNDARY_INVALID');
  }
  const body = prefix.slice(beginIndex + outerBegin.length);
  if (
    !body.startsWith('DO $identity_guard$\n')
    || !body.endsWith(boundary.guardTerminator)
    || body.includes(boundary.firstDestructiveStatement)
  ) failDr133('SUCCESSOR_ROLLBACK_GUARD_TRANSACTION_BOUNDARY_INVALID');
  return `${body}\n`;
}
