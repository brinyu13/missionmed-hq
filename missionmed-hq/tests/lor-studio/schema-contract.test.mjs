import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ATOMIC_RLS_CASE_DRIVER_CONTRACT,
} from '../../lor-studio/adapters/atomic-rls-case-driver.mjs';

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

const EXECUTABLE_RELATIONS = Object.freeze([
  'student_auth_bindings',
  'student_auth_binding_revocations',
  'recommendation_cases',
  'recommendation_case_protected_revision_states',
  'recommendation_case_creation_reservations',
  'recommendation_case_audit_events',
  'recommendation_case_write_receipts',
  'faculty_invitations',
  'faculty_otp_challenges',
  'faculty_otp_challenge_revocations',
  'faculty_otp_verification_receipts',
  'faculty_otp_proof_revocations',
  'consent_receipts',
  'waiver_receipts',
  'faculty_private_content',
  'released_student_documents',
  'recommendation_case_private_write_receipts',
  'administrative_case_grants',
  'administrative_case_grant_revocations',
  'mentor_case_assignments',
  'mentor_case_assignment_revocations',
  'writer_depot_artifacts',
  'ai_generation_runs',
  'ai_letter_proposals',
  'ai_proposal_decisions',
  'deletion_intents',
  'deletion_hold_releases',
  'deletion_receipts',
]);

const APPROVED_SECURITY_DEFINER_FUNCTIONS = Object.freeze([
  'commit_student_case_create(jsonb,text,text,jsonb,text,jsonb)',
  'commit_student_builder_autosave(jsonb,bigint,text,text,jsonb,text,jsonb)',
  'commit_student_builder_complete(jsonb,bigint,text,text,jsonb,text,jsonb)',
  'commit_student_consent_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
  'commit_student_waiver_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
  'read_mentor_case_projection()',
  'read_faculty_case_projection()',
  'commit_faculty_final_document_release(bigint,text,text,text,jsonb,text)',
]);

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

test('schema contract authorizes only the DR-120 disposable local lifecycle', async () => {
  const contract = await readContract();
  assert.equal(contract.schemaVersion, 'missionmed.lor.schema-design.v2');
  assert.equal(contract.status, 'EXECUTABLE_DISPOSABLE_LOCAL_ONLY');
  assert.equal(contract.authorityDecision, 'DR-120');
  assert.equal(contract.sourceDesignStatus, 'DESIGN_ONLY_NOT_EXECUTABLE');
  assert.equal(contract.targetProject, null);
  assert.equal(contract.targetEnvironment, 'DISPOSABLE_SYNTHETIC_LOCAL_POSTGRESQL_ONLY');
  assert.equal(contract.targetSchema, 'lor_studio');
  assert.equal(contract.migrationFileAuthorized, true);
  assert.equal(contract.rootSupabaseMigrationAuthorized, false);
  assert.equal(contract.remoteMigrationAuthorized, false);
  assert.equal(contract.externalTargetBindingAuthorized, false);
  assert.match(contract.blockingDecision, /Founder Gate A/u);
  assert.deepEqual(contract.migrationLedger, FORWARD_LEDGER);
  assert.deepEqual(contract.rollbackLedger, ROLLBACK_LEDGER);
  assert.equal(
    contract.rollbackVerificationStatus,
    'DISPOSABLE_LOCAL_POSTGRESQL_16_18_APPLY_RLS_ROLLBACK_REAPPLY_VERIFIED_NO_REMOTE_EVIDENCE',
  );
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
  assert.deepEqual(contract.commandOwnerPrivileges, {
    schema: ['USAGE@lor_studio'],
    selectInsertUpdateRelations: ['recommendation_cases'],
    selectInsertRelations: [
      'recommendation_case_protected_revision_states',
      'recommendation_case_audit_events',
      'recommendation_case_write_receipts',
      'consent_receipts',
      'waiver_receipts',
      'released_student_documents',
      'recommendation_case_private_write_receipts',
    ],
    selectUpdateRelations: [
      'faculty_private_content',
      'recommendation_case_creation_reservations',
    ],
    selectRelations: [
      'student_auth_bindings',
      'student_auth_binding_revocations',
      'mentor_case_assignments',
      'mentor_case_assignment_revocations',
      'faculty_invitations',
      'faculty_otp_verification_receipts',
      'faculty_otp_proof_revocations',
    ],
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
    ai_generation_runs: ['SELECT', 'INSERT'],
    ai_letter_proposals: ['SELECT', 'INSERT'],
    ai_proposal_decisions: ['SELECT'],
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
  assert.deepEqual(contract.commandOwnerPolicySurface, COMMAND_OWNER_POLICY_SURFACE);
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
    'disposable synthetic local PostgreSQL harness until Founder Gate A',
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
