import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import test from 'node:test';
import { rootCertificates } from 'node:tls';

import {
  IntegrationDisabledError,
  InvitationDeniedError,
} from '../../lor-studio/domain/errors.js';
import { hashValue, sha256 } from '../../lor-studio/domain/value-utils.js';
import {
  PRODUCTION_POSTGRES_RUNTIME_CONTRACT,
  createProductionPostgresRuntimeDependencies,
} from '../../lor-studio/adapters/production-postgres-runtime.mjs';
import {
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  TRUSTED_REQUEST_CONTEXT_SCHEMA_VERSION,
  runWithTrustedRequestContext,
} from '../../lor-studio/security/trusted-request-context.mjs';
import {
  DR133_RELATIONS,
  DR133_PRE_EVIDENCE_DEFINER_IDENTITY,
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES,
  DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES,
  expectedDr133SuccessorSentinel,
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
  expectedDr133Sentinel,
} from '../../scripts/lor-studio/railway-dr133-runner-core.mjs';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const BINDING_ID = `binding_${'c'.repeat(64)}`;
const AUTH_UID = '00000000-0000-4000-8000-000000000001';
const DEPLOYMENT_ID = '00000000-0000-4000-8000-000000000002';
const PASSWORD = 'd'.repeat(43);
const TEST_CA = rootCertificates.find((candidate) => {
  try {
    const certificate = new X509Certificate(candidate);
    const now = Date.now();
    return certificate.ca === true && certificate.checkIssued(certificate)
      && certificate.verify(certificate.publicKey)
      && Date.parse(certificate.validFrom) <= now && now < Date.parse(certificate.validTo);
  } catch {
    return false;
  }
});
if (!TEST_CA) throw new Error('Node runtime has no valid self-signed test root CA');
const DEFINERS = DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES;
const APP_EXECUTABLE_DEFINERS = DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES;
const APP_RELATION_PRIVILEGES = [
  'administrative_case_grant_revocations:SELECT:false',
  'administrative_case_grants:SELECT:false',
  'consent_receipts:SELECT:false',
  'deletion_hold_releases:INSERT:false',
  'deletion_hold_releases:SELECT:false',
  'deletion_intents:INSERT:false',
  'deletion_intents:SELECT:false',
  'deletion_receipts:INSERT:false',
  'deletion_receipts:SELECT:false',
  'recommendation_case_audit_events:INSERT:false',
  'recommendation_case_audit_events:SELECT:false',
  'recommendation_case_creation_reservations:INSERT:false',
  'recommendation_case_creation_reservations:SELECT:false',
  'recommendation_cases:SELECT:false',
  'released_student_documents:SELECT:false',
  'student_auth_binding_revocations:SELECT:false',
  'student_auth_bindings:SELECT:false',
  'student_recommendation_case_projection:SELECT:false',
  'waiver_receipts:SELECT:false',
  'writer_depot_artifacts:SELECT:false',
].sort();
const APP_FUNCTION_PRIVILEGES = [
  ...APP_EXECUTABLE_DEFINERS,
  'ai_grounding_manifest_is_complete(jsonb)',
  'audit_event_is_metadata(jsonb)',
  'canonical_jsonb_sha256(jsonb)',
  'canonical_jsonb_text(jsonb)',
  'operational_content_context_allows(text,text,text[],text[])',
  'student_context_allows(text,text,uuid,text[])',
  'student_write_axes_satisfied()',
].map((identity) => `${identity}:EXECUTE:false`).sort();

function result(rows = []) {
  return { rows, fields: [] };
}

class FakePool {
  static instances = [];

  static behavior = {};

  constructor(options) {
    this.options = options;
    this.calls = [];
    this.connections = 0;
    this.releases = [];
    this.endCalls = 0;
    this.listeners = new Map();
    FakePool.instances.push(this);
  }

  on(event, listener) {
    this.listeners.set(event, listener);
    return this;
  }

  removeListener(event, listener) {
    if (this.listeners.get(event) === listener) this.listeners.delete(event);
    return this;
  }

  emit(event, error) {
    this.listeners.get(event)?.(error);
  }

  async connect() {
    if (FakePool.behavior.connectError) throw FakePool.behavior.connectError;
    this.connections += 1;
    const pool = this;
    return {
      async query(input) {
        pool.calls.push(input);
        if (FakePool.behavior.query) return FakePool.behavior.query(input, pool);
        return result();
      },
      release(...args) {
        pool.releases.push(args);
      },
    };
  }

  async end() {
    this.endCalls += 1;
    if (FakePool.behavior.end) return FakePool.behavior.end(this);
    return undefined;
  }
}

function resetPool(behavior = {}) {
  FakePool.instances = [];
  FakePool.behavior = behavior;
}

function binding() {
  return resolveLorTargetBinding({
    schemaVersion: 'missionmed.lor.target-binding.v2',
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'staging',
    provider: DR133_TARGET.provider,
    projectId: DR133_TARGET.projectId,
    environmentId: DR133_TARGET.environmentId,
    serviceId: DR133_TARGET.databaseServiceId,
    databaseName: DR133_TARGET.databaseName,
    region: DR133_TARGET.region,
    schema: 'lor_studio',
    migrationLedger: 'lor_studio/migrations/staging',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: false,
  });
}

function environment(overrides = {}) {
  return {
    LOR_DR133_RUNTIME_DATABASE_CA: TEST_CA,
    LOR_DR133_RUNTIME_DATABASE_URL:
      `postgresql://${DR133_RUNTIME_LOGIN}:${PASSWORD}`
      + `@${DR133_TARGET.databaseHost}:5432/${DR133_TARGET.databaseName}?sslmode=require`,
    RAILWAY_DEPLOYMENT_ID: DEPLOYMENT_ID,
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
    RAILWAY_REPLICA_REGION: DR133_TARGET.region,
    RAILWAY_SERVICE_ID: DR133_TARGET.executionServiceId,
    ...overrides,
  };
}

function runtime() {
  return createProductionPostgresRuntimeDependencies(binding(), {
    environment: environment(),
    PoolClass: FakePool,
  });
}

function context(overrides = {}) {
  return {
    schemaVersion: TRUSTED_REQUEST_CONTEXT_SCHEMA_VERSION,
    authenticatedSubject: 'wp:123',
    actorRole: 'student',
    sourceReferenceHash: HASH_A,
    proofHash: HASH_B,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
    clientAsserted: false,
    ...overrides,
  };
}

function receipt(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.student-auth-binding-receipt.v1',
    studentAuthSubject: 'wp:123',
    studentAuthUid: AUTH_UID,
    bindingId: BINDING_ID,
    bindingSource: 'wordpress_verified_bootstrap',
    sourceReferenceHash: HASH_A,
    boundAt: '2026-08-25T12:00:00.000Z',
    expiresAt: null,
    replayed: false,
    ...overrides,
  };
}

function facultyScope(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: AUTH_UID,
    authenticatedSubject: 'wp:456',
    actorId: 'wp:456',
    actorRole: 'faculty',
    resourceStudentId: 'wp:123',
    caseId: 'case-1',
    operation: 'save',
    purpose: 'faculty_private_edit',
    assignmentId: null,
    invitationId: 'invitation-1',
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
    ...overrides,
  };
}

function studentScope(overrides = {}) {
  return {
    ...facultyScope(),
    authenticatedSubject: 'wp:123',
    actorId: 'wp:123',
    actorRole: 'student',
    resourceStudentId: 'wp:123',
    purpose: 'student_case_write',
    assignmentId: null,
    invitationId: null,
    ...overrides,
  };
}

function facultyAuthUid(subject) {
  const value = sha256(`missionmed.lor.faculty-auth-uid.v1:${subject}`);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-5${value.slice(13, 16)}`
    + `-8${value.slice(17, 20)}-${value.slice(20, 32)}`;
}

function mentorScope(overrides = {}) {
  return {
    ...facultyScope(),
    authenticatedSubject: 'wp:789',
    actorId: 'wp:789',
    actorRole: 'mentor',
    operation: 'read',
    purpose: 'assigned_mentor_review',
    assignmentId: 'assignment-1',
    invitationId: null,
    ...overrides,
  };
}

function readinessRow(overrides = {}) {
  return {
    database_name: DR133_TARGET.databaseName,
    postgres_major: 16,
    current_user: 'lor_studio_app',
    session_user: DR133_RUNTIME_LOGIN,
    private_server_address: true,
    ssl_active: true,
    schema_sentinel: expectedDr133SuccessorSentinel(),
    schema_owner: DR133_TARGET.databaseAdmin,
    relation_names: [...DR133_RELATIONS].sort(),
    relation_count: String(DR133_RELATIONS.length),
    forced_rls_count: String(DR133_RELATIONS.length),
    definer_identities: DEFINERS,
    definer_count: String(DEFINERS.length),
    definer_custody_safe: true,
    app_execute_count: String(APP_EXECUTABLE_DEFINERS.length),
    app_execute_identities: APP_EXECUTABLE_DEFINERS,
    pre_evidence_app_execute_denied: true,
    pre_evidence_public_execute_denied: true,
    public_function_execute_count: '0',
    public_relation_privilege_count: '0',
    view_count: '1',
    view_identity: 'student_recommendation_case_projection@postgres',
    security_invoker_view_count: '1',
    security_barrier_view_count: '1',
    app_role_safe: true,
    command_owner_role_safe: true,
    runtime_role_safe: true,
    runtime_membership_safe: true,
    runtime_membership_count: '1',
    runtime_owned_object_count: '0',
    app_owned_object_count: '0',
    runtime_default_acl_count: '0',
    app_relation_privileges: APP_RELATION_PRIVILEGES,
    runtime_relation_acl_count: '0',
    app_function_privileges: APP_FUNCTION_PRIVILEGES,
    runtime_function_acl_count: '0',
    unexpected_sequence_acl_count: '0',
    unexpected_column_acl_count: '0',
    app_schema_privileges: ['USAGE:false'],
    unexpected_schema_acl_count: '0',
    unexpected_acl_grantee_count: '0',
    app_schema_create_denied: true,
    runtime_schema_create_denied: true,
    app_schema_usage: true,
    ...overrides,
  };
}

function statusIs(status) {
  return (error) => error instanceof IntegrationDisabledError
    && error.details?.status === status;
}

function queryObjects(pool) {
  return pool.calls.filter((entry) => entry && typeof entry === 'object');
}

test('constructs one closure-private pool and exposes only the frozen runtime surface', async () => {
  resetPool();
  const dependencies = runtime();
  const pool = FakePool.instances[0];

  assert.deepEqual(
    Object.keys(dependencies),
    ['driver', 'scopeProvider', 'candidateScopeProvider', 'actorResolver', 'readiness', 'close'],
  );
  assert.equal(Object.isFrozen(dependencies), true);
  assert.equal(Object.isFrozen(dependencies.driver), true);
  assert.equal(typeof dependencies.driver.readFinalDocumentExport, 'function');
  assert.equal(typeof dependencies.driver.commitFacultyPrivateContent, 'function');
  assert.equal(typeof dependencies.driver.commitStudentEvidencePublication, 'function');
  for (const flag of [
    'databaseClock', 'actorSafeReads', 'atomicFacultyInvitationCommands',
    'atomicProviderRunAndProposal', 'conditionalAtomicOneDecision',
    'appendOnlyArtifactAudit',
  ]) assert.equal(dependencies.driver[flag], true);
  for (const method of [
    'issueFacultyInvitationAtomic', 'resendFacultyInvitationOtpAtomic',
    'revokeFacultyInvitationAtomic', 'reserveFacultyInvitationDeliveryAtomic',
    'commitFacultyInvitationDeliveryAtomic', 'markFacultyInvitationDeliveryUnknownAtomic',
    'verifyFacultyInvitationAtomic', 'persistProviderRunAndProposalAtomic',
    'readActorSafeAiProposal', 'attachDecisionIfUndecidedAtomic',
    'appendArtifactExportAuditAtomic',
  ]) assert.equal(typeof dependencies.driver[method], 'function');
  assert.equal(typeof dependencies.candidateScopeProvider, 'function');
  assert.equal(Object.isFrozen(dependencies.actorResolver), true);
  assert.equal(Object.hasOwn(dependencies, 'pool'), false);
  assert.equal(Object.hasOwn(dependencies, 'executor'), false);
  assert.equal(pool.options.connectionString.includes(PASSWORD), true);
  assert.equal(pool.options.ssl.ca, new X509Certificate(TEST_CA).toString());
  assert.equal(pool.options.ssl.rejectUnauthorized, true);
  assert.equal(pool.options.ssl.minVersion, 'TLSv1.2');
  assert.equal(pool.options.enableChannelBinding, true);
  assert.equal(pool.options.max, 10);
  assert.equal(pool.listeners.has('error'), true);
  assert.doesNotMatch(JSON.stringify(dependencies), new RegExp(PASSWORD, 'u'));
  assert.equal(Object.isFrozen(PRODUCTION_POSTGRES_RUNTIME_CONTRACT.publicSurface), true);
  assert.equal(PRODUCTION_POSTGRES_RUNTIME_CONTRACT.securityDefinerCount, DEFINERS.length);
  assert.equal(
    PRODUCTION_POSTGRES_RUNTIME_CONTRACT.appExecutableSecurityDefinerCount,
    APP_EXECUTABLE_DEFINERS.length,
  );
  assert.equal(
    PRODUCTION_POSTGRES_RUNTIME_CONTRACT.nonAppExecutableSecurityDefiner,
    DR133_PRE_EVIDENCE_DEFINER_IDENTITY,
  );

  await dependencies.close();
});

test('candidate scope is derived only from the active verified faculty context', async () => {
  resetPool();
  const dependencies = runtime();
  const request = { invitationId: 'invitation-1', operation: 'verify_faculty_invitation' };

  await assert.rejects(
    dependencies.candidateScopeProvider(request),
    statusIs('TRUSTED_REQUEST_CONTEXT_REQUIRED'),
  );
  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.candidateScopeProvider(request)),
    (error) => error instanceof InvitationDeniedError,
  );
  const scope = await runWithTrustedRequestContext(
    context({
      authenticatedSubject: 'wp:456',
      actorRole: 'faculty',
      sourceReferenceHash: null,
      proofHash: null,
    }),
    () => dependencies.candidateScopeProvider(request),
  );
  assert.deepEqual(scope, {
    schemaVersion: 'missionmed.lor.faculty-invitation-candidate-scope.v1',
    authoritySource: 'server_verified_wordpress_invitation_candidate',
    authenticated: true,
    roleVerified: true,
    authUid: facultyAuthUid('wp:456'),
    authenticatedSubject: 'wp:456',
    actorId: 'wp:456',
    actorRole: 'faculty',
    operation: 'verify_faculty_invitation',
    purpose: 'faculty_private_edit',
    invitationId: 'invitation-1',
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
  });
  assert.equal(Object.isFrozen(scope), true);
  assert.equal(FakePool.instances[0].connections, 0);
  await dependencies.close();
});

test('invitation facade binds all fixed ABIs and maps P1303 to an opaque denial', async () => {
  let denyVerification = false;
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('verify_faculty_invitation(')
        && denyVerification) {
        const error = new Error('LOR_FACULTY_INVITATION_CASE_NOT_FOUND');
        error.code = 'P1303';
        throw error;
      }
      if (typeof input !== 'string' && /faculty_invitation|faculty_invitation_otp/u.test(input.text)) {
        return result([{ result: { accepted: true } }]);
      }
      return result();
    },
  });
  const targetBinding = binding();
  const dependencies = createProductionPostgresRuntimeDependencies(targetBinding, {
    environment: environment(),
    PoolClass: FakePool,
  });
  const scope = studentScope();
  const common = { binding: targetBinding, actorId: 'wp:123', caseId: 'case-1' };
  const issue = {
    ...common,
    scope,
    expectedRevision: 1,
    invitationId: 'invitation-1',
    recipientEmailHash: HASH_A,
    tokenHash: HASH_B,
    challengeId: 'challenge-1',
    otpCodeHash: 'c'.repeat(64),
    invitationExpiresAt: '2026-08-26T12:00:00.000Z',
    challengeExpiresAt: '2026-08-25T12:15:00.000Z',
    maxAttempts: 5,
    attemptWindowMs: 60_000,
    lockoutMs: 300_000,
    idempotencyKey: 'issue-key',
    requestHash: 'd'.repeat(64),
  };
  assert.deepEqual(await dependencies.driver.issueFacultyInvitationAtomic(issue), { accepted: true });
  assert.deepEqual(await dependencies.driver.resendFacultyInvitationOtpAtomic({
    ...common,
    scope,
    recipientEmailHash: HASH_A,
    challengeId: 'challenge-2',
    otpCodeHash: HASH_B,
    challengeExpiresAt: '2026-08-25T12:20:00.000Z',
    idempotencyKey: 'resend-key',
    requestHash: 'e'.repeat(64),
  }), { accepted: true });
  assert.deepEqual(await dependencies.driver.revokeFacultyInvitationAtomic({
    ...common,
    scope,
    idempotencyKey: 'revoke-key',
    requestHash: 'f'.repeat(64),
  }), { accepted: true });
  assert.deepEqual(await dependencies.driver.reserveFacultyInvitationDeliveryAtomic({
    binding: targetBinding,
    studentScope: scope,
    caseId: 'case-1',
    invitationId: 'invitation-1',
    deliveryAction: 'issue',
    idempotencyKey: 'delivery-key',
    requestHash: HASH_B,
  }), { accepted: true });
  assert.deepEqual(await dependencies.driver.commitFacultyInvitationDeliveryAtomic({
    binding: targetBinding,
    studentScope: scope,
    caseId: 'case-1',
    invitationId: 'invitation-1',
    providerMessageRefHash: HASH_A,
    idempotencyKey: 'delivery-key',
    requestHash: HASH_B,
  }), { accepted: true });
  assert.deepEqual(await dependencies.driver.markFacultyInvitationDeliveryUnknownAtomic({
    binding: targetBinding,
    studentScope: scope,
    caseId: 'case-1',
    invitationId: 'invitation-1',
    idempotencyKey: 'delivery-unknown-key',
    requestHash: HASH_B,
  }), { accepted: true });
  const candidateScope = await runWithTrustedRequestContext(
    context({
      authenticatedSubject: 'wp:456', actorRole: 'faculty',
      sourceReferenceHash: null, proofHash: null,
    }),
    () => dependencies.candidateScopeProvider({
      invitationId: 'invitation-1', operation: 'verify_faculty_invitation',
    }),
  );
  const verify = {
    binding: targetBinding,
    candidateScope,
    invitationId: 'invitation-1',
    recipientEmailHash: HASH_A,
    tokenHash: HASH_B,
    otpCode: '123456',
    idempotencyKey: 'verify-key',
    requestHash: 'c'.repeat(64),
  };
  assert.deepEqual(await dependencies.driver.verifyFacultyInvitationAtomic(verify), { accepted: true });

  const objects = queryObjects(FakePool.instances[0]);
  const commands = {
    issue: objects.find((entry) => entry.text.includes('issue_faculty_invitation(')),
    resend: objects.find((entry) => entry.text.includes('resend_faculty_invitation_otp(')),
    revoke: objects.find((entry) => entry.text.includes('revoke_faculty_invitation(')),
    verify: objects.find((entry) => entry.text.includes('verify_faculty_invitation(')),
  };
  const [reserveDelivery, commitDelivery, unknownDelivery] = objects.filter(
    (entry) => entry.text.includes('commit_faculty_invitation_delivery('),
  );
  assert.deepEqual(commands.issue.values, [
    'case-1', 1, 'invitation-1', HASH_A, HASH_B, 'challenge-1', 'c'.repeat(64),
    '2026-08-26T12:00:00.000Z', '2026-08-25T12:15:00.000Z', 5, 60_000, 300_000,
    'issue-key', 'd'.repeat(64),
  ]);
  assert.deepEqual(commands.resend.values, [
    'case-1', HASH_A, 'challenge-2', HASH_B, '2026-08-25T12:20:00.000Z',
    'resend-key', 'e'.repeat(64),
  ]);
  assert.deepEqual(commands.revoke.values, ['case-1', 'revoke-key', 'f'.repeat(64)]);
  assert.deepEqual(reserveDelivery.values, [
    'case-1', 'invitation-1', 'issue', 'delivery-key', HASH_B,
  ]);
  assert.deepEqual(commitDelivery.values, [
    'case-1', 'invitation-1', HASH_A, 'delivery-key', HASH_B,
  ]);
  assert.deepEqual(unknownDelivery.values, [
    'case-1', 'invitation-1', 'unknown', 'delivery-unknown-key', HASH_B,
  ]);
  assert.deepEqual(commands.verify.values, [
    'invitation-1', HASH_A, HASH_B, '123456', 'verify-key', 'c'.repeat(64),
  ]);
  const gucs = objects.filter((entry) => entry.text.includes("request.jwt.claim.sub"));
  assert.deepEqual(gucs[3].values, [
    AUTH_UID, 'wp:123', 'service', 'wp:123', 'case-1',
    'reserve_faculty_invitation_delivery', 'faculty_invitation_delivery', 'invitation-1',
    '', '', 'true', 'true', 'true', 'postmark-delivery-v1', 'true',
  ]);
  assert.deepEqual(gucs[4].values, [
    AUTH_UID, 'wp:123', 'service', 'wp:123', 'case-1',
    'commit_faculty_invitation_delivery', 'faculty_invitation_delivery', 'invitation-1',
    '', '', 'true', 'true', 'true', 'postmark-delivery-v1', 'true',
  ]);
  assert.deepEqual(gucs[5].values, [
    AUTH_UID, 'wp:123', 'service', 'wp:123', 'case-1',
    'mark_faculty_invitation_delivery_unknown', 'faculty_invitation_delivery', 'invitation-1',
    '', '', 'true', 'true', 'true', 'postmark-delivery-v1', 'true',
  ]);
  assert.deepEqual(gucs[6].values, [
    facultyAuthUid('wp:456'), 'wp:456', 'faculty', '', '', 'verify_faculty_invitation',
    'faculty_private_edit', 'invitation-1', '', '', 'true', 'true', 'true', '', 'true',
  ]);

  denyVerification = true;
  await assert.rejects(
    dependencies.driver.verifyFacultyInvitationAtomic(verify),
    (error) => error instanceof InvitationDeniedError
      && error.code === 'INVITATION_DENIED'
      && error.details?.reasonCode === 'INVITATION_DENIED'
      && !error.message.includes('CASE_NOT_FOUND'),
  );
  assert.equal(FakePool.instances[0].calls.includes('ROLLBACK'), true);
  await dependencies.close();
});

test('AI facade binds the fixed provider-run/read/one-decision ABIs under faculty RLS scope', async () => {
  resetPool({
    query(input) {
      if (typeof input !== 'string' && /transition_ai_proposal|ai_provider_run|actor_safe_ai|ai_proposal_decision/u.test(input.text)) {
        return result([{ result: { accepted: true } }]);
      }
      return result();
    },
  });
  const targetBinding = binding();
  const dependencies = createProductionPostgresRuntimeDependencies(targetBinding, {
    environment: environment(),
    PoolClass: FakePool,
  });
  const targetBindingHash = hashValue(targetBinding);
  const saveScope = facultyScope();
  const readScope = facultyScope({ operation: 'read' });
  const record = { id: 'proposal-1', caseId: 'case-1' };
  const baseWrite = {
    schemaVersion: 'missionmed.lor.ai-proposal-driver-command.v1',
    binding: structuredClone(targetBinding),
    targetBindingHash,
    scope: saveScope,
    scopeHash: hashValue(saveScope),
    caseId: 'case-1',
    proposalId: 'proposal-1',
    idempotencyKey: 'ai-key',
    requestHash: HASH_A,
    recordHash: HASH_B,
    providerRunHash: 'c'.repeat(64),
    outputHash: 'd'.repeat(64),
    expectedDecisionHash: null,
    record,
  };
  const reservation = {
    schemaVersion: 'missionmed.lor.ai-proposal-driver-command.v1',
    binding: structuredClone(targetBinding),
    targetBindingHash,
    scope: saveScope,
    scopeHash: hashValue(saveScope),
    caseId: 'case-1',
    idempotencyKey: 'ai-key',
    requestHash: HASH_A,
  };
  assert.deepEqual(await dependencies.driver.reserveAiProposalGenerationAtomic({
    ...reservation,
    operation: 'reserve_generation',
  }), { accepted: true });
  assert.deepEqual(await dependencies.driver.markAiProposalGenerationUnknownAtomic({
    ...reservation,
    operation: 'mark_generation_unknown',
  }), { accepted: true });
  assert.deepEqual(await dependencies.driver.persistProviderRunAndProposalAtomic({
    ...baseWrite,
    operation: 'put_proposal',
    decisionHash: null,
    acceptedContentHash: null,
    expectedState: 'absent_or_same_idempotency',
    expectedOutputHash: null,
  }), { accepted: true });
  assert.deepEqual(await dependencies.driver.readActorSafeAiProposal({
    schemaVersion: 'missionmed.lor.ai-proposal-driver-command.v1',
    operation: 'get_proposal',
    binding: structuredClone(targetBinding),
    targetBindingHash,
    scope: readScope,
    scopeHash: hashValue(readScope),
    caseId: 'case-1',
    proposalId: 'proposal-1',
  }), { accepted: true });
  assert.deepEqual(await dependencies.driver.attachDecisionIfUndecidedAtomic({
    ...baseWrite,
    operation: 'attach_decision',
    decisionHash: 'e'.repeat(64),
    acceptedContentHash: null,
    expectedState: 'proposal',
    expectedOutputHash: 'd'.repeat(64),
  }), { accepted: true });

  const objects = queryObjects(FakePool.instances[0]);
  const transitions = objects.filter((entry) => entry.text.includes(
    'transition_ai_proposal_generation_reservation',
  ));
  const persist = objects.find((entry) => entry.text.includes(
    'persist_ai_provider_run_and_proposal_atomic',
  ));
  const read = objects.find((entry) => entry.text.includes('read_actor_safe_ai_proposal'));
  const attach = objects.find((entry) => entry.text.includes(
    'attach_ai_proposal_decision_if_undecided_atomic',
  ));
  assert.deepEqual(transitions.map((entry) => entry.values), [
    ['case-1', 'ai-key', HASH_A, hashValue(saveScope), targetBindingHash, 'reserve_generation'],
    ['case-1', 'ai-key', HASH_A, hashValue(saveScope), targetBindingHash, 'mark_generation_unknown'],
  ]);
  assert.deepEqual(persist.values, [
    'case-1', 'proposal-1', 'ai-key', HASH_A, hashValue(saveScope), targetBindingHash,
    HASH_B, 'c'.repeat(64), 'd'.repeat(64), record,
  ]);
  assert.deepEqual(read.values, [
    'case-1', 'proposal-1', hashValue(readScope), targetBindingHash,
  ]);
  assert.deepEqual(attach.values, [
    'case-1', 'proposal-1', 'ai-key', HASH_A, hashValue(saveScope), targetBindingHash,
    HASH_B, 'c'.repeat(64), 'd'.repeat(64), 'e'.repeat(64), null, record,
  ]);
  const gucs = objects.filter((entry) => entry.text.includes("request.jwt.claim.sub"));
  assert.deepEqual(gucs[0].values, [
    AUTH_UID, 'wp:456', 'faculty', 'wp:123', 'case-1', 'save', 'faculty_private_edit',
    'invitation-1', '', '', 'true', 'true', 'true', 'lor-ai-proposal-store-v1', 'true',
  ]);
  assert.deepEqual(gucs[1].values, gucs[0].values);
  assert.equal(persist.text.includes(HASH_A), false);
  assert.equal(attach.text.includes('wp:456'), false);
  await dependencies.close();
});

test('artifact audit facade binds exact event hashes to actor/case read scope and fixed SQL', async () => {
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('append_artifact_export_audit')) {
        return result([{ result: { accepted: true } }]);
      }
      return result();
    },
  });
  const targetBinding = binding();
  const dependencies = createProductionPostgresRuntimeDependencies(targetBinding, {
    environment: environment(),
    PoolClass: FakePool,
  });
  const scope = facultyScope({ operation: 'read' });
  const event = {
    schemaVersion: 1,
    eventId: '00000000-0000-4000-8000-000000000003',
    type: 'artifact.generated',
    at: '2026-08-26T12:00:00.000Z',
    actorRole: 'faculty',
    actorRef: sha256('lor-studio:actor:wp:456').slice(0, 24),
    caseRef: sha256('lor-studio:case:case-1').slice(0, 24),
    targetRef: sha256('lor-studio:target:document-final-1').slice(0, 24),
    outcome: 'success',
    metadata: {
      action: 'export_final_document',
      artifactFormat: 'docx',
      result: 'faculty_owner',
      artifactSha256: HASH_A,
      releaseDocumentHash: null,
      sourceRevision: 7,
    },
  };
  const command = {
    schemaVersion: 'missionmed.lor.artifact-audit-command.v1',
    binding: structuredClone(targetBinding),
    targetBindingHash: hashValue(targetBinding),
    scope,
    scopeHash: hashValue(scope),
    caseId: 'case-1',
    event,
    eventHash: hashValue(event),
  };

  assert.deepEqual(
    await dependencies.driver.appendArtifactExportAuditAtomic(command),
    { accepted: true },
  );
  const studentReadScope = studentScope({
    operation: 'read',
    purpose: 'student_case_read',
  });
  const studentEvent = {
    ...event,
    eventId: '00000000-0000-4000-8000-000000000004',
    actorRole: 'student',
    actorRef: sha256('lor-studio:actor:wp:123').slice(0, 24),
    outcome: 'success',
    metadata: {
      ...event.metadata,
      result: 'student_visible',
      releaseDocumentHash: HASH_B,
    },
  };
  assert.deepEqual(
    await dependencies.driver.appendArtifactExportAuditAtomic({
      ...command,
      scope: studentReadScope,
      scopeHash: hashValue(studentReadScope),
      event: studentEvent,
      eventHash: hashValue(studentEvent),
    }),
    { accepted: true },
  );
  const connectionsBeforeMissingReleaseBinding = FakePool.instances[0].connections;
  const missingReleaseBinding = {
    ...studentEvent,
    metadata: { ...studentEvent.metadata, releaseDocumentHash: null },
  };
  await assert.rejects(
    dependencies.driver.appendArtifactExportAuditAtomic({
      ...command,
      scope: studentReadScope,
      scopeHash: hashValue(studentReadScope),
      event: missingReleaseBinding,
      eventHash: hashValue(missingReleaseBinding),
    }),
    statusIs('ARTIFACT_AUDIT_COMMAND_INVALID'),
  );
  assert.equal(FakePool.instances[0].connections, connectionsBeforeMissingReleaseBinding);
  const objects = queryObjects(FakePool.instances[0]);
  const gucs = objects.filter((entry) => entry.text.includes('request.jwt.claim.sub'));
  const appends = objects.filter((entry) => entry.text.includes('append_artifact_export_audit'));
  assert.deepEqual(gucs[0].values, [
    AUTH_UID, 'wp:456', 'faculty', 'wp:123', 'case-1', 'read', 'faculty_private_edit',
    'invitation-1', '', '', 'true', 'true', 'true', '', 'true',
  ]);
  assert.deepEqual(gucs[1].values, [
    AUTH_UID, 'wp:123', 'student', 'wp:123', 'case-1', 'read', 'student_case_read',
    '', '', '', 'true', 'true', 'true', '', 'true',
  ]);
  assert.deepEqual(appends[0].values, [
    event, hashValue(event), hashValue(scope), hashValue(targetBinding),
  ]);
  assert.deepEqual(appends[1].values, [
    studentEvent, hashValue(studentEvent), hashValue(studentReadScope), hashValue(targetBinding),
  ]);
  assert.equal(appends[0].text.includes('wp:456'), false);

  const connections = FakePool.instances[0].connections;
  await assert.rejects(
    dependencies.driver.appendArtifactExportAuditAtomic({
      ...command,
      eventHash: HASH_A,
    }),
    statusIs('ARTIFACT_AUDIT_COMMAND_INVALID'),
  );
  assert.equal(FakePool.instances[0].connections, connections);
  await dependencies.close();
});

test('actor access is resolved only by the exact database function under server-bound GUCs', async () => {
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('resolve_lor_actor_case_access')) {
        return result([{ result: {
          schemaVersion: 'missionmed.lor.actor-case-access.v1',
          authoritySource: 'database_verified_case_access',
          actorId: 'wp:456',
          actorRole: 'faculty',
          resourceStudentId: 'wp:123',
          caseId: 'case-1',
        } }]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const access = await dependencies.actorResolver.resolve({
    authenticatedSubject: 'wp:456',
    caseId: 'case-1',
  });
  assert.deepEqual(access, {
    schemaVersion: 'missionmed.lor.actor-case-access.v1',
    authoritySource: 'database_verified_case_access',
    actorId: 'wp:456',
    actorRole: 'faculty',
    resourceStudentId: 'wp:123',
    caseId: 'case-1',
  });
  assert.equal(Object.isFrozen(access), true);
  const objects = queryObjects(FakePool.instances[0]);
  const gucs = objects.find((entry) => entry.text.includes("request.jwt.claim.sub"));
  const command = objects.find((entry) => entry.text.includes('resolve_lor_actor_case_access'));
  assert.deepEqual(gucs.values, [
    '', 'wp:456', 'service', '', 'case-1', 'read', 'actor_case_access_resolution',
    '', '', '', 'true', 'true', 'true', 'actor-access-v1', 'true',
  ]);
  assert.deepEqual(command.values, ['wp:456', 'case-1']);
  await dependencies.close();
});

test('actor access denies absent, ambiguous, malformed, cross-subject, and accessor input without details', async () => {
  const cases = [
    null,
    {
      schemaVersion: 'missionmed.lor.actor-case-access.v1',
      authoritySource: 'database_verified_case_access',
      actorId: 'wp:999',
      actorRole: 'faculty',
      resourceStudentId: 'wp:123',
      caseId: 'case-1',
    },
    {
      schemaVersion: 'missionmed.lor.actor-case-access.v1',
      authoritySource: 'database_verified_case_access',
      actorId: 'wp:456',
      actorRole: 'admin',
      resourceStudentId: 'wp:123',
      caseId: 'case-1',
    },
  ];
  for (const value of cases) {
    resetPool({
      query(input) {
        if (typeof input !== 'string' && input.text.includes('resolve_lor_actor_case_access')) {
          return result([{ result: value }]);
        }
        return result();
      },
    });
    const dependencies = runtime();
    await assert.rejects(
      dependencies.actorResolver.resolve({ authenticatedSubject: 'wp:456', caseId: 'case-1' }),
      (error) => error instanceof IntegrationDisabledError
        || error?.code === 'AUTHORIZATION_DENIED',
    );
    await dependencies.close();
  }

  resetPool();
  const dependencies = runtime();
  const accessor = { authenticatedSubject: 'wp:456' };
  Object.defineProperty(accessor, 'caseId', {
    enumerable: true,
    get() { throw new Error('must not execute'); },
  });
  await assert.rejects(
    dependencies.actorResolver.resolve(accessor),
    statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED'),
  );
  assert.equal(FakePool.instances[0].connections, 0);
  await dependencies.close();
});

test('rejects wrong Railway identity, extra LOR keys, malformed URL, and forged binding pre-pool', () => {
  resetPool();
  const cases = [
    environment({ RAILWAY_SERVICE_ID: DR133_TARGET.databaseServiceId }),
    environment({ LOR_DR133_DATABASE_URL: 'forbidden' }),
    environment({ LOR_DR133_RUNTIME_DATABASE_CA: 'not-a-certificate' }),
    environment({
      LOR_DR133_RUNTIME_DATABASE_URL:
        `postgresql://${DR133_RUNTIME_LOGIN}:${PASSWORD}@localhost:5432/railway?sslmode=require`,
    }),
  ];
  for (const candidate of cases) {
    assert.throws(
      () => createProductionPostgresRuntimeDependencies(binding(), {
        environment: candidate,
        PoolClass: FakePool,
      }),
      (error) => error instanceof IntegrationDisabledError,
    );
  }
  assert.throws(
    () => createProductionPostgresRuntimeDependencies({ ...binding() }, {
      environment: environment(),
      PoolClass: FakePool,
    }),
    statusIs('VALIDATED_TARGET_BINDING_REQUIRED'),
  );
  assert.equal(FakePool.instances.length, 0);
});

test('requires active trusted context and rejects request accessors before a connection', async () => {
  resetPool();
  const dependencies = runtime();
  const pool = FakePool.instances[0];

  await assert.rejects(
    dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
    }),
    statusIs('TRUSTED_REQUEST_CONTEXT_REQUIRED'),
  );

  const accessor = { operation: 'read', resourceStudentId: 'wp:123' };
  Object.defineProperty(accessor, 'caseId', {
    enumerable: true,
    get() {
      throw new Error('must not execute');
    },
  });
  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.scopeProvider(accessor)),
    statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED'),
  );
  assert.equal(pool.connections, 0);
  await dependencies.close();
});

test('student binding uses exact 15-GUC ordering and returns a detached frozen scope', async () => {
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('ensure_student_auth_binding')) {
        return result([{ result: receipt() }]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const scope = await runWithTrustedRequestContext(context(), () => dependencies.scopeProvider({
    caseId: 'case-1', operation: 'create', resourceStudentId: 'wp:123',
  }));
  const pool = FakePool.instances[0];
  const objects = queryObjects(pool);
  const gucs = objects.find((entry) => entry.text.includes("request.jwt.claim.sub"));
  const command = objects.find((entry) => entry.text.includes('ensure_student_auth_binding'));

  assert.deepEqual(gucs.values, [
    '', 'wp:123', 'service', 'wp:123', '', 'ensure_student_binding',
    'wordpress_verified_bootstrap', '', '', '', 'true', 'true', 'true',
    'wordpress-admission-v2', 'true',
  ]);
  assert.deepEqual(command.values, ['wp:123', HASH_A, HASH_B]);
  assert.equal(gucs.text.includes('wp:123'), false);
  assert.equal(command.text.includes(HASH_A), false);
  assert.equal(scope.actorRole, 'student');
  assert.equal(scope.resourceStudentId, 'wp:123');
  assert.equal(scope.purpose, 'student_case_write');
  assert.equal(Object.isFrozen(scope), true);
  assert.deepEqual(pool.calls.filter((entry) => typeof entry === 'string'), [
    'BEGIN ISOLATION LEVEL READ COMMITTED',
    'SET LOCAL ROLE lor_studio_app',
    'COMMIT',
  ]);
  assert.deepEqual(pool.releases, [[]]);
  await dependencies.close();
});

test('student subject mismatch and malformed database receipt fail closed', async () => {
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('ensure_student_auth_binding')) {
        return result([{ result: receipt({ unexpected: true }) }]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const request = { caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:999' };
  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.scopeProvider(request)),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );
  assert.equal(FakePool.instances[0].connections, 0);

  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
    })),
    statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED'),
  );
  assert.equal(FakePool.instances[0].calls.includes('ROLLBACK'), true);
  assert.equal(FakePool.instances[0].calls.includes('COMMIT'), false);
  await dependencies.close();
});

test('faculty and mentor use database-resolved resource scope with exact GUCs', async () => {
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('resolve_faculty_case_scope')) {
        return result([{ result: facultyScope() }]);
      }
      if (typeof input !== 'string' && input.text.includes('resolve_mentor_case_scope')) {
        return result([{ result: mentorScope() }]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const faculty = await runWithTrustedRequestContext(
    context({
      authenticatedSubject: 'wp:456',
      actorRole: 'faculty',
      sourceReferenceHash: null,
      proofHash: null,
    }),
    () => dependencies.scopeProvider({ caseId: 'case-1', operation: 'save' }),
  );
  const mentor = await runWithTrustedRequestContext(
    context({
      authenticatedSubject: 'wp:789',
      actorRole: 'mentor',
      sourceReferenceHash: null,
      proofHash: null,
    }),
    () => dependencies.scopeProvider({ caseId: 'case-1', operation: 'read' }),
  );
  const gucs = queryObjects(FakePool.instances[0])
    .filter((entry) => entry.text.includes("request.jwt.claim.sub"));

  assert.deepEqual(gucs[0].values, [
    '', 'wp:456', 'faculty', '', 'case-1', 'save', 'faculty_scope_resolution',
    '', '', '', 'true', 'true', 'true', '', 'true',
  ]);
  assert.deepEqual(gucs[1].values, [
    '', 'wp:789', 'mentor', '', 'case-1', 'read', 'mentor_scope_resolution',
    '', '', '', 'true', 'true', 'true', '', 'true',
  ]);
  assert.equal(faculty.resourceStudentId, 'wp:123');
  assert.equal(mentor.resourceStudentId, 'wp:123');
  assert.equal(faculty.invitationId, 'invitation-1');
  assert.equal(mentor.assignmentId, 'assignment-1');

  await assert.rejects(
    runWithTrustedRequestContext(
      context({
        authenticatedSubject: 'wp:456',
        actorRole: 'faculty',
        sourceReferenceHash: null,
        proofHash: null,
      }),
      () => dependencies.scopeProvider({
        caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
      }),
    ),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );
  await dependencies.close();
});

test('actor scopes reject null, malformed, mismatched, and forbidden operations', async () => {
  let returnedScope = null;
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('resolve_faculty_case_scope')) {
        return result([{ result: returnedScope }]);
      }
      if (typeof input !== 'string' && input.text.includes('resolve_mentor_case_scope')) {
        return result([{ result: returnedScope }]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const facultyContext = context({
    authenticatedSubject: 'wp:456',
    actorRole: 'faculty',
    sourceReferenceHash: null,
    proofHash: null,
  });
  await assert.rejects(
    runWithTrustedRequestContext(facultyContext, () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read',
    })),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );

  returnedScope = facultyScope({ unexpected: true });
  await assert.rejects(
    runWithTrustedRequestContext(facultyContext, () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'save',
    })),
    statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED'),
  );

  returnedScope = facultyScope();
  const mentorContext = context({
    authenticatedSubject: 'wp:789',
    actorRole: 'mentor',
    sourceReferenceHash: null,
    proofHash: null,
  });
  await assert.rejects(
    runWithTrustedRequestContext(mentorContext, () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read',
    })),
    statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED'),
  );

  const connectionsBeforeForbiddenOperations = FakePool.instances[0].connections;
  await assert.rejects(
    runWithTrustedRequestContext(facultyContext, () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'create',
    })),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );
  await assert.rejects(
    runWithTrustedRequestContext(mentorContext, () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'save',
    })),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );
  assert.equal(FakePool.instances[0].connections, connectionsBeforeForbiddenOperations);
  assert.equal(
    FakePool.instances[0].calls.filter((entry) => entry === 'ROLLBACK').length,
    3,
  );
  assert.equal(FakePool.instances[0].calls.includes('COMMIT'), false);
  await dependencies.close();
});

test('database denials do not enumerate and all other failures are redacted', async () => {
  for (const code of ['P1101', 'P1201', 'P1102', 'P1205', '08006']) {
    const secret = `database-secret-${code}`;
    resetPool({
      query(input) {
        if (typeof input !== 'string' && input.text.includes('ensure_student_auth_binding')) {
          const error = new Error(secret);
          error.code = code;
          throw error;
        }
        return result();
      },
    });
    const dependencies = runtime();
    const operation = runWithTrustedRequestContext(context(), () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
    }));
    if (['P1101', 'P1201'].includes(code)) {
      await assert.rejects(operation, (error) => error.code === 'AUTHORIZATION_DENIED'
        && !error.message.includes(secret));
    } else {
      await assert.rejects(operation, (error) => statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED')(error)
        && !error.message.includes(secret));
    }
    const pool = FakePool.instances[0];
    assert.equal(pool.calls.includes('ROLLBACK'), true);
    assert.equal(pool.calls.includes('COMMIT'), false);
    assert.deepEqual(pool.releases, [[]]);
    await dependencies.close();
  }
});

test('readiness requires the exact DR-133 catalog fingerprint', async () => {
  let row = readinessRow();
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('missionmed:dr133:lor-runtime-readiness')) {
        return result([row]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const ready = await dependencies.readiness.probe();
  assert.equal(ready.ready, true);
  assert.equal(ready.reasonCode, 'READY');
  assert.equal(Object.isFrozen(ready), true);
  assert.equal(Object.isFrozen(ready.checks), true);
  assert.equal(Object.isFrozen(ready.groups), true);
  assert.equal(Object.values(ready.checks).every(Boolean), true);
  assert.deepEqual(ready.groups, {
    auditCatalog: true,
    database: true,
    repository: true,
    rls: true,
  });

  const drifts = [
    { postgres_major: 17 },
    { schema_sentinel: expectedDr133Sentinel() },
    { relation_names: [...DR133_RELATIONS].sort().slice(1) },
    { definer_custody_safe: false },
    { app_execute_count: String(DEFINERS.length) },
    { app_execute_identities: DEFINERS },
    { pre_evidence_app_execute_denied: false },
    { pre_evidence_public_execute_denied: false },
    { security_barrier_view_count: '0' },
    { runtime_membership_count: '2' },
    { runtime_owned_object_count: '1' },
    { app_owned_object_count: '1' },
    { app_schema_privileges: ['CREATE:false', 'USAGE:false'] },
    { unexpected_schema_acl_count: '1' },
    { unexpected_acl_grantee_count: '1' },
    { app_schema_create_denied: false },
    { app_relation_privileges: [...APP_RELATION_PRIVILEGES, 'faculty_private_content:SELECT:false'] },
    { runtime_relation_acl_count: '1' },
    { app_function_privileges: [...APP_FUNCTION_PRIVILEGES, 'unsafe_helper():EXECUTE:true'] },
    { runtime_function_acl_count: '1' },
    { unexpected_sequence_acl_count: '1' },
    { unexpected_column_acl_count: '1' },
  ];
  for (const drift of drifts) {
    row = readinessRow(drift);
    const observed = await dependencies.readiness.probe();
    assert.equal(observed.ready, false);
    assert.equal(observed.reasonCode, 'CATALOG_FINGERPRINT_MISMATCH');
    assert.equal(observed.groups.database, false);
    assert.equal(
      Object.values(observed.groups).every((value) => typeof value === 'boolean'),
      true,
    );
  }
  await dependencies.close();
});

test('pool errors poison new work without exposing their message', async () => {
  resetPool();
  const dependencies = runtime();
  const pool = FakePool.instances[0];
  const secret = 'pool-secret-that-must-not-escape';
  pool.emit('error', new Error(secret));

  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
    })),
    (error) => statusIs('RUNTIME_DATABASE_UNAVAILABLE')(error)
      && !error.message.includes(secret),
  );
  assert.equal(pool.connections, 0);
  assert.throws(
    () => dependencies.driver.selectCase({}),
    statusIs('RUNTIME_DATABASE_UNAVAILABLE'),
  );
  const readiness = await dependencies.readiness.probe();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.reasonCode, 'DATABASE_UNAVAILABLE');
  await dependencies.close();
});

test('close is idempotent, rejects new work, and retains the listener through pool.end', async () => {
  let listenerPresentDuringEnd = false;
  resetPool({
    async end(pool) {
      listenerPresentDuringEnd = pool.listeners.has('error');
    },
  });
  const dependencies = runtime();
  const pool = FakePool.instances[0];
  const first = dependencies.close();
  const second = dependencies.close();
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.equal(listenerPresentDuringEnd, true);
  assert.equal(pool.listeners.has('error'), false);
  assert.equal(pool.endCalls, 1);
  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
    })),
    statusIs('RUNTIME_DATABASE_UNAVAILABLE'),
  );
  assert.equal(pool.connections, 0);
});

test('pool close and construction failures are redacted and clean up once', async () => {
  const secret = 'close-secret-that-must-not-escape';
  resetPool({
    async end() {
      throw new Error(secret);
    },
  });
  const dependencies = runtime();
  await assert.rejects(
    dependencies.close(),
    (error) => statusIs('POOL_CLOSE_FAILED')(error) && !error.message.includes(secret),
  );
  assert.equal(FakePool.instances[0].endCalls, 1);

  let ends = 0;
  class InvalidPool {
    connect() {}

    on() {}

    async end() {
      ends += 1;
    }
  }
  assert.throws(
    () => createProductionPostgresRuntimeDependencies(binding(), {
      environment: environment(),
      PoolClass: InvalidPool,
    }),
    statusIs('RUNTIME_DEPENDENCY_CONSTRUCTION_FAILED'),
  );
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(ends, 1);
});
