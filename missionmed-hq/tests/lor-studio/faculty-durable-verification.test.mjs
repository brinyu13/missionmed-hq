import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveLorTargetBinding } from '../../lor-studio/adapters/lor-target-binding.mjs';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import {
  SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT,
  SupabaseDurableFacultyInvitationRepository,
} from '../../lor-studio/repositories/supabase-durable-faculty-invitation-repository.mjs';
import {
  DURABLE_FACULTY_VERIFICATION_SERVICE_CONTRACT,
  DurableFacultyInvitationVerificationService,
  isAuthenticDurableFacultyInvitationVerificationService,
} from '../../lor-studio/services/durable-faculty-invitation-verification-service.mjs';

const ACTOR = Object.freeze({ id: 'wp:43', role: 'faculty' });
const INVITATION_ID = 'invitation-faculty-1';
const RAW_TOKEN = 'a'.repeat(43);
const OTP_CODE = '538291';
const RECIPIENT_EMAIL = 'faculty@example.test';
const IDEMPOTENCY_KEY = 'verify-attempt-1';

function target() {
  return resolveLorTargetBinding({
    schemaVersion: 'missionmed.lor.target-binding.v2',
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'staging',
    provider: 'railway-postgres',
    projectId: 'lor-faculty-staging-project',
    environmentId: 'lor-faculty-staging-environment',
    serviceId: 'lor-faculty-staging-service',
    databaseName: 'railway',
    region: 'us-west2',
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

function candidateScope(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.faculty-invitation-candidate-scope.v1',
    authoritySource: 'server_verified_wordpress_invitation_candidate',
    authenticated: true,
    roleVerified: true,
    authUid: '6dbbd3bd-f9ba-5e14-8c28-824f20c81cd4',
    authenticatedSubject: ACTOR.id,
    actorId: ACTOR.id,
    actorRole: 'faculty',
    operation: 'verify_faculty_invitation',
    purpose: 'faculty_private_edit',
    invitationId: INVITATION_ID,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
    ...overrides,
  };
}

function candidateCredential(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.faculty-candidate-credential.v1',
    authoritySource: 'server_verified_sealed_candidate_cookie',
    authenticatedSubject: ACTOR.id,
    invitationId: INVITATION_ID,
    tokenHash: sha256(RAW_TOKEN),
    flowNonceHash: sha256('candidate-flow-nonce'),
    issuedAt: '2026-08-25T12:00:00.000Z',
    expiresAt: '2026-08-25T12:10:00.000Z',
    clientAsserted: false,
    ...overrides,
  };
}

function receipt(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.faculty-invitation-command-receipt.v1',
    receiptId: `faculty_command_${sha256('receipt')}`,
    action: 'faculty.invitation.verify',
    committed: true,
    replayed: false,
    caseId: 'case-faculty-1',
    invitationId: INVITATION_ID,
    challengeIdHash: sha256('challenge-id'),
    invitationExpiresAt: null,
    challengeExpiresAt: null,
    caseRevision: 4,
    invitationRevision: 2,
    verified: true,
    reasonCode: null,
    auditEventRef: `event_${sha256('audit-event')}`,
    transactionId: '42',
    ...overrides,
  };
}

function harness({
  rawReceipt = receipt(),
  scope = candidateScope(),
  credential = candidateCredential(),
  driverOverrides = {},
} = {}) {
  const calls = [];
  const scopeCalls = [];
  const credentialCalls = [];
  const driver = {
    rlsEnforced: true,
    serverOnly: true,
    databaseClock: true,
    atomicFacultyInvitationCommands: true,
    async verifyFacultyInvitationAtomic(command) {
      calls.push(structuredClone(command));
      return structuredClone(rawReceipt);
    },
    ...driverOverrides,
  };
  const repository = new SupabaseDurableFacultyInvitationRepository({
    binding: target(),
    driver,
    async candidateScopeProvider(request) {
      scopeCalls.push(structuredClone(request));
      return structuredClone(scope);
    },
    async candidateCredentialProvider(request) {
      credentialCalls.push(structuredClone(request));
      return structuredClone(credential);
    },
  });
  const service = new DurableFacultyInvitationVerificationService({ repository });
  return { calls, credentialCalls, driver, repository, scopeCalls, service };
}

function verificationInput(overrides = {}) {
  return {
    actor: ACTOR,
    invitationId: INVITATION_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    otpCode: OTP_CODE,
    recipientEmail: RECIPIENT_EMAIL,
    ...overrides,
  };
}

test('only exact successfully constructed faculty verification services satisfy authenticity', () => {
  const { repository, service } = harness();
  assert.equal(isAuthenticDurableFacultyInvitationVerificationService(service), true);

  for (const lookalike of [
    null,
    {},
    { async verify() { return { verified: true }; } },
    Object.create(DurableFacultyInvitationVerificationService.prototype),
    new Proxy(service, {}),
  ]) {
    assert.equal(isAuthenticDurableFacultyInvitationVerificationService(lookalike), false);
  }

  class OverriddenVerificationService extends DurableFacultyInvitationVerificationService {
    async verify() { return { verified: true }; }
  }
  const overridden = new OverriddenVerificationService({ repository });
  assert.equal(
    isAuthenticDurableFacultyInvitationVerificationService(overridden),
    false,
    'subclass method replacement must not inherit production authenticity',
  );
});

test('candidate verification uses only the server-held token hash plus one prepared OTP value', async () => {
  const { calls, credentialCalls, scopeCalls, service } = harness();
  const result = await service.verify(verificationInput());

  assert.deepEqual(scopeCalls, [{
    invitationId: INVITATION_ID,
    operation: 'verify_faculty_invitation',
  }]);
  assert.deepEqual(credentialCalls, [{
    actorId: ACTOR.id,
    invitationId: INVITATION_ID,
  }]);
  assert.equal(calls.length, 1);
  const command = calls[0];
  assert.equal(command.candidateScope.actorId, ACTOR.id);
  assert.equal(command.invitationId, INVITATION_ID);
  assert.equal(command.otpCode, OTP_CODE);
  assert.equal(command.tokenHash, sha256(RAW_TOKEN));
  assert.match(command.recipientEmailHash, /^[a-f0-9]{64}$/u);
  assert.match(command.requestHash, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(command).includes(RAW_TOKEN), false);
  assert.equal(JSON.stringify(command).includes(RECIPIENT_EMAIL), false);
  assert.deepEqual(result, {
    schemaVersion: 'missionmed.lor.faculty-verification-result.v2',
    verified: true,
    reasonCode: null,
    caseId: 'case-faculty-1',
    invitationId: INVITATION_ID,
    caseRevision: 4,
    invitationRevision: 2,
    auditEventRef: `event_${sha256('audit-event')}`,
    idempotentReplay: false,
    privateSessionIssued: false,
    privateEditGranted: true,
  });
  assert.equal(JSON.stringify(result).includes(OTP_CODE), false);
  assert.equal(Object.isFrozen(result), true);
});

test('all credential, expiry, revocation, lockout, and replay denials are opaque to callers', async () => {
  for (const reasonCode of [
    'TOKEN_MISMATCH',
    'RECIPIENT_MISMATCH',
    'OTP_NOT_VERIFIED',
    'INVITATION_EXPIRED',
    'INVITATION_REVOKED',
    'INVITATION_LOCKED',
    'INVITATION_ALREADY_USED',
  ]) {
    const { service } = harness({
      rawReceipt: receipt({ verified: false, reasonCode, caseRevision: 3 }),
    });
    await assert.rejects(
      () => service.verify(verificationInput()),
      (error) => error.code === 'INVITATION_DENIED'
        && error.details.reasonCode === 'INVITATION_DENIED',
    );
  }
});

test('service rejects client-selected actor, case, challenge, purpose, and principal state', async () => {
  const { service } = harness();
  for (const forbidden of [
    { actorRole: 'faculty' },
    { caseId: 'case-other' },
    { challengeId: 'challenge-other' },
    { purpose: 'faculty_private_edit' },
    { verifiedPrincipalId: ACTOR.id },
  ]) {
    await assert.rejects(
      () => service.verify({ ...verificationInput(), ...forbidden }),
      (error) => error.code === 'VALIDATION_FAILED',
    );
  }
  await assert.rejects(
    () => service.verify(verificationInput({ actor: { id: ACTOR.id, role: 'student' } })),
    (error) => error.code === 'INVITATION_DENIED',
  );
});

test('repository enforces exact six-digit OTP and exact request keys before the driver', async () => {
  const { calls, repository } = harness();
  const base = {
    actorId: ACTOR.id,
    invitationId: INVITATION_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    otpCode: OTP_CODE,
    recipientEmail: RECIPIENT_EMAIL,
  };
  for (const otpCode of ['12345', '1234567', 'abcdef', '１２３４５６']) {
    await assert.rejects(
      () => repository.verifyAndCommit({ ...base, otpCode }),
      (error) => error.code === 'VALIDATION_FAILED',
    );
  }
  await assert.rejects(
    () => repository.verifyAndCommit({ ...base, caseId: 'case-client' }),
    (error) => error.code === 'VALIDATION_FAILED',
  );
  assert.equal(calls.length, 0);
});

test('repository rejects forged candidate scope and malformed or secret-bearing receipts', async () => {
  const request = {
    actorId: ACTOR.id,
    invitationId: INVITATION_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    otpCode: OTP_CODE,
    recipientEmail: RECIPIENT_EMAIL,
  };
  const forged = harness({ scope: candidateScope({ actorRole: 'student' }) });
  await assert.rejects(
    () => forged.repository.verifyAndCommit(request),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );

  for (const rawReceipt of [
    receipt({ committed: false }),
    receipt({ action: 'faculty.invitation.issue' }),
    receipt({ verified: true, reasonCode: 'OTP_NOT_VERIFIED' }),
    { ...receipt(), otpCode: OTP_CODE },
  ]) {
    const invalid = harness({ rawReceipt });
    await assert.rejects(
      () => invalid.repository.verifyAndCommit(request),
      (error) => error.code === 'INTEGRATION_DISABLED',
    );
  }
});

test('idempotent replay remains safe and does not synthesize a browser session', async () => {
  const { service } = harness({ rawReceipt: receipt({ replayed: true }) });
  const result = await service.verify(verificationInput());
  assert.equal(result.idempotentReplay, true);
  assert.equal(result.privateSessionIssued, false);
  assert.equal(result.privateEditGranted, true);
});

test('constructor fails closed without validated target, atomic driver, scope, or credential provider', () => {
  const validDriver = {
    rlsEnforced: true,
    serverOnly: true,
    databaseClock: true,
    atomicFacultyInvitationCommands: true,
    verifyFacultyInvitationAtomic: async () => receipt(),
  };
  assert.throws(
    () => new SupabaseDurableFacultyInvitationRepository({
      binding: {},
      driver: validDriver,
      candidateScopeProvider: async () => candidateScope(),
      candidateCredentialProvider: async () => candidateCredential(),
    }),
    (error) => error.code === 'INTEGRATION_DISABLED',
  );
  assert.throws(
    () => new SupabaseDurableFacultyInvitationRepository({
      binding: target(),
      driver: { ...validDriver, databaseClock: false },
      candidateScopeProvider: async () => candidateScope(),
      candidateCredentialProvider: async () => candidateCredential(),
    }),
    (error) => error.code === 'INTEGRATION_DISABLED',
  );
  assert.throws(
    () => new SupabaseDurableFacultyInvitationRepository({
      binding: target(),
      driver: validDriver,
    }),
    (error) => error.code === 'INTEGRATION_DISABLED',
  );
  assert.throws(
    () => new SupabaseDurableFacultyInvitationRepository({
      binding: target(),
      driver: validDriver,
      candidateScopeProvider: async () => candidateScope(),
    }),
    (error) => error.code === 'INTEGRATION_DISABLED',
  );
});

test('published contract exposes no default target and grants no private access before DB commit', () => {
  assert.equal(SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT.defaultTarget, null);
  assert.equal(
    SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT.rawOtpBoundary,
    'single_prepared_parameter_to_database_command_never_persisted_or_returned',
  );
  assert.equal(SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT.privateEditGrantedOnlyAfterCommit, true);
  assert.deepEqual(SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT.clientAcceptedFields, [
    'recipientEmail', 'otpCode',
  ]);
  assert.equal(DURABLE_FACULTY_VERIFICATION_SERVICE_CONTRACT.privateSessionIssued, false);
  assert.equal(
    DURABLE_FACULTY_VERIFICATION_SERVICE_CONTRACT.privateEditGranted,
    'only_after_atomic_database_commit',
  );
});
