import assert from 'node:assert/strict';
import test from 'node:test';

import { hashValue, sha256 } from '../../lor-studio/domain/value-utils.js';
import { createFacultyInvitation, hashFacultyEmail } from '../../lor-studio/security/faculty-invitations.js';
import { InMemoryFacultyInvitationRepository } from '../../lor-studio/repositories/in-memory-faculty-invitation-repository.js';
import {
  SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT,
  SupabaseDurableFacultyInvitationRepository,
} from '../../lor-studio/repositories/supabase-durable-faculty-invitation-repository.mjs';
import {
  DURABLE_FACULTY_VERIFICATION_SERVICE_CONTRACT,
  DurableFacultyInvitationVerificationService,
} from '../../lor-studio/services/durable-faculty-invitation-verification-service.mjs';

const T0 = new Date('2026-08-13T12:00:00.000Z');
const T1 = '2026-08-13T12:01:00.000Z';
const FACULTY_EMAIL = 'faculty@example.test';
const OTP_CODE = '538291';
const CHALLENGE_ID = 'otp_challenge_server_1';

const STAGING_BINDING = Object.freeze({
  providerResourceBound: true,
  independentlyVerified: true,
  health: 'ready',
  environment: 'staging',
  environmentBound: true,
  projectRef: 'mftguikkftmrxjxrkdln',
  parentProjectRef: 'fglyvdykwgbuivikqoah',
  branchName: 'lor-staging',
  branchId: 'mftguikkftmrxjxrkdln',
  schema: 'lor_studio',
  dataCopied: false,
});

const PRODUCTION_BINDING = Object.freeze({
  providerResourceBound: true,
  independentlyVerified: true,
  health: 'ready',
  environment: 'production',
  environmentBound: true,
  projectRef: 'fglyvdykwgbuivikqoah',
  branchName: 'main',
  branchId: 'fglyvdykwgbuivikqoah',
  schema: 'lor_studio',
  productionDataBindingPassed: true,
});

function metadataRef(namespace, value) {
  return `${namespace}_${sha256(`lor-studio:${namespace}:${value}`)}`;
}

function verifiedContext(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.verified-faculty-context.v1',
    authoritySource: 'server_verified_wordpress_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    clientAsserted: false,
    actorRole: 'faculty',
    authenticatedSubject: 'wp:43',
    caseId: 'case-faculty-1',
    operation: 'verify_faculty_invitation',
    purpose: 'faculty_private_edit',
    bindingRef: sha256('test-only-verified-context-binding'),
    ...overrides,
  };
}

function verificationScope(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.faculty-verification-scope.v1',
    authoritySource: 'server_resolved_faculty_invitation_challenge',
    clientAsserted: false,
    actorRole: 'faculty',
    authenticatedSubject: 'wp:43',
    caseId: 'case-faculty-1',
    invitationId: 'invitation-faculty-1',
    challengeId: CHALLENGE_ID,
    recipientEmailHash: hashFacultyEmail(FACULTY_EMAIL),
    operation: 'verify_faculty_invitation',
    purpose: 'faculty_private_edit',
    bindingRef: sha256('test-only-verified-context-binding'),
    ...overrides,
  };
}

function issuedInvitation(invitationOverrides = {}) {
  const issued = createFacultyInvitation({
    id: 'invitation-faculty-1',
    caseId: 'case-faculty-1',
    recipientEmail: FACULTY_EMAIL,
    expiresAt: '2026-08-14T12:00:00.000Z',
    now: T0,
    tokenFactory: () => Buffer.alloc(32, 0x5a),
  });
  return {
    rawToken: issued.rawToken,
    invitation: {
      ...structuredClone(issued.invitation),
      ...invitationOverrides,
    },
  };
}

function driverAuthorizationBinding(command, { verified = true, overrides = {} } = {}) {
  return {
    schemaVersion: 'missionmed.lor.faculty-verification-driver-binding.v1',
    authoritySource: 'atomic_durable_otp_invitation_transaction',
    actorRole: 'faculty',
    authenticatedSubject: command.scope.authenticatedSubject,
    caseId: command.scope.caseId,
    invitationId: command.scope.invitationId,
    challengeRef: sha256(`lor-studio:challenge:${command.scope.challengeId}`),
    contextBindingRef: command.scope.bindingRef,
    recipientEmailHash: command.scope.recipientEmailHash,
    operation: command.scope.operation,
    purpose: command.scope.purpose,
    verifiedPrincipalId: verified ? 'wp:43' : null,
    otpProofRef: verified ? sha256('test-only-durable-otp-provider-proof') : null,
    otpVerifiedAt: verified ? T1 : null,
    otpExpiresAt: verified ? '2026-08-13T12:10:00.000Z' : null,
    otpRevoked: verified ? false : null,
    principalAuthority: verified ? 'durable_otp_provider_proof' : null,
    ...overrides,
  };
}

function attemptState(invitation) {
  return {
    schemaVersion: 'missionmed.lor.faculty-attempt-state.v1',
    revision: invitation.revision,
    failedAttempts: invitation.failedAttempts,
    attemptWindowStartedAt: invitation.attemptWindowStartedAt,
    lockedUntil: invitation.lockedUntil,
    lastFailureCode: invitation.lastFailureCode,
    revokedAt: invitation.revokedAt,
    usedAt: invitation.usedAt,
    verifiedFacultyId: invitation.verifiedFacultyId,
  };
}

function metadataEvent(command, { verified, invitation, databaseNow }) {
  return {
    schemaVersion: 'missionmed.lor.service-event.v1',
    eventRef: verified
      ? command.auditBindings.successEventRef
      : command.auditBindings.deniedEventRef,
    eventType: verified ? 'faculty.verified' : 'faculty.verification_denied',
    caseRef: command.auditBindings.caseRef,
    actorRef: command.auditBindings.actorRef,
    actorRole: 'service',
    correlationRef: command.auditBindings.correlationRef,
    outcome: verified ? 'success' : 'denied',
    revision: invitation.revision,
    occurredAt: databaseNow,
  };
}

function atomicReceipt(command, {
  invitation,
  verified,
  reasonCode,
  replayed = false,
  databaseNow = T1,
  priorAttemptState,
  overrides = {},
  bindingOverrides = {},
} = {}) {
  const event = metadataEvent(command, { verified, invitation, databaseNow });
  return {
    schemaVersion: 'missionmed.lor.atomic-faculty-verification-receipt.v1',
    committed: true,
    databaseTime: {
      schemaVersion: 'missionmed.lor.database-transaction-time.v1',
      source: 'database_transaction_timestamp',
      transactionTimestamp: databaseNow,
    },
    durable: true,
    sameTransaction: true,
    invitationStateCommitted: true,
    otpChallengeCommitted: true,
    auditCommitted: true,
    privateSessionIssued: false,
    priorAttemptState,
    nextAttemptState: attemptState(invitation),
    transactionRef: `transaction_${sha256('faculty-verification-transaction-1')}`,
    replayed,
    verified,
    reasonCode,
    challengeConsumed: verified,
    caseId: command.scope.caseId,
    invitationId: command.scope.invitationId,
    purpose: command.scope.purpose,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    invitation,
    event,
    recordHash: hashValue(invitation),
    eventHash: hashValue(event),
    auditEventRef: event.eventRef,
    authorizationBinding: driverAuthorizationBinding(command, {
      verified,
      overrides: bindingOverrides,
    }),
    ...overrides,
  };
}

function persistentAtomicFacultyDriver({
  bypassCredentialChecks = false,
  databaseNow = T1,
  invitationOverrides = {},
  mutateReceipt = (receipt) => receipt,
  verifiedPrincipalId = 'wp:43',
} = {}) {
  const issued = issuedInvitation(invitationOverrides);
  let invitation = structuredClone(issued.invitation);
  const commits = new Map();
  let calls = 0;
  return {
    atomicInvitationOtpAndAudit: true,
    databaseClock: true,
    rlsEnforced: true,
    serverOnly: true,
    rawToken: issued.rawToken,
    async executeAtomicFacultyVerification(command) {
      calls += 1;
      if (
        command.scope.caseId !== invitation.caseId
        || command.scope.invitationId !== invitation.id
        || command.scope.challengeId !== CHALLENGE_ID
        || command.scope.recipientEmailHash !== invitation.recipientEmailHash
      ) {
        return { errorCode: 'SCOPE_BINDING_MISMATCH' };
      }
      const prior = commits.get(command.idempotencyKey);
      if (prior) {
        if (prior.requestHash !== command.requestHash) {
          return { errorCode: 'IDEMPOTENCY_CONFLICT' };
        }
        return mutateReceipt({ ...structuredClone(prior.receipt), replayed: true }, command);
      }
      const priorAttemptState = attemptState(invitation);
      const databaseNowMs = Date.parse(databaseNow);
      let reasonCode = null;
      if (invitation.revokedAt) reasonCode = 'INVITATION_REVOKED';
      else if (invitation.usedAt) reasonCode = 'INVITATION_ALREADY_USED';
      else if (Date.parse(invitation.expiresAt) <= databaseNowMs) reasonCode = 'INVITATION_EXPIRED';
      else if (invitation.lockedUntil && databaseNowMs < Date.parse(invitation.lockedUntil)) {
        reasonCode = 'INVITATION_LOCKED';
      }
      else if (!bypassCredentialChecks && command.presentedTokenHash !== invitation.tokenHash) reasonCode = 'TOKEN_MISMATCH';
      else if (!bypassCredentialChecks && command.presentedRecipientEmailHash !== invitation.recipientEmailHash) reasonCode = 'RECIPIENT_MISMATCH';
      else if (command.challengeId !== CHALLENGE_ID || command.otpCode !== OTP_CODE) reasonCode = 'OTP_NOT_VERIFIED';

      const verified = reasonCode === null;
      if (verified) {
        invitation = {
          ...invitation,
          usedAt: databaseNow,
          verifiedFacultyId: verifiedPrincipalId,
          failedAttempts: 0,
          attemptWindowStartedAt: null,
          lockedUntil: null,
          lastFailureCode: null,
          revision: invitation.revision + 1,
        };
      } else if (['TOKEN_MISMATCH', 'RECIPIENT_MISMATCH', 'OTP_NOT_VERIFIED'].includes(reasonCode)) {
        const previousWindow = invitation.attemptWindowStartedAt
          ? Date.parse(invitation.attemptWindowStartedAt)
          : null;
        const withinWindow = previousWindow !== null
          && databaseNowMs - previousWindow < invitation.attemptWindowMs;
        const failedAttempts = withinWindow
          ? Math.min(invitation.failedAttempts + 1, invitation.maxAttempts)
          : 1;
        invitation = {
          ...invitation,
          failedAttempts,
          attemptWindowStartedAt: withinWindow
            ? invitation.attemptWindowStartedAt
            : databaseNow,
          lockedUntil: failedAttempts >= invitation.maxAttempts
            ? new Date(databaseNowMs + invitation.lockoutMs).toISOString()
            : null,
          lastFailureCode: reasonCode,
          revision: invitation.revision + 1,
        };
      }
      const receipt = atomicReceipt(command, {
        invitation: structuredClone(invitation),
        verified,
        reasonCode,
        databaseNow,
        priorAttemptState,
        bindingOverrides: verified
          ? {
            verifiedPrincipalId,
            otpVerifiedAt: databaseNow,
            otpExpiresAt: new Date(databaseNowMs + 10 * 60 * 1_000).toISOString(),
          }
          : {},
      });
      commits.set(command.idempotencyKey, {
        requestHash: command.requestHash,
        receipt: structuredClone(receipt),
      });
      return mutateReceipt(receipt, command);
    },
    stats() {
      return {
        calls,
        commitRows: commits.size,
        invitationRevision: invitation.revision,
      };
    },
    snapshot() {
      return structuredClone(invitation);
    },
  };
}

function repository({
  binding = STAGING_BINDING,
  context = verifiedContext(),
  driver = persistentAtomicFacultyDriver(),
  scope = verificationScope(),
  scopeProvider,
  verifiedContextProvider,
} = {}) {
  return new SupabaseDurableFacultyInvitationRepository({
    binding,
    driver,
    scopeProvider: scopeProvider ?? (async () => scope),
    verifiedContextProvider: verifiedContextProvider ?? (async () => context),
  });
}

function validRequest(driver, overrides = {}) {
  return {
    rawToken: driver.rawToken,
    recipientEmail: FACULTY_EMAIL,
    otpCode: OTP_CODE,
    idempotencyKey: 'faculty-verify-idempotency-1',
    ...overrides,
  };
}

test('durable faculty repository fails closed without exact target, atomic driver, and server-resolved scope', async () => {
  assert.throws(() => new SupabaseDurableFacultyInvitationRepository(), /integration is unavailable/u);
  assert.throws(
    () => repository({
      driver: { ...persistentAtomicFacultyDriver(), atomicInvitationOtpAndAudit: false },
    }),
    /integration is unavailable/u,
  );
  assert.throws(
    () => new SupabaseDurableFacultyInvitationRepository({
      binding: STAGING_BINDING,
      driver: persistentAtomicFacultyDriver(),
    }),
    /integration is unavailable/u,
  );
  assert.throws(
    () => new SupabaseDurableFacultyInvitationRepository({
      binding: STAGING_BINDING,
      driver: persistentAtomicFacultyDriver(),
      scopeProvider: async () => verificationScope(),
    }),
    /integration is unavailable/u,
  );
  for (const binding of [
    { ...STAGING_BINDING, branchName: 'arbitrary-preview' },
    { ...STAGING_BINDING, projectRef: 'fglyvdykwgbuivikqoah' },
    { ...PRODUCTION_BINDING, productionDataBindingPassed: false },
  ]) {
    assert.throws(() => repository({ binding }), /integration is unavailable/u);
  }

  const staging = repository();
  assert.equal(staging.describePersistence().productionEligible, false);
  assert.equal(staging.describePersistence().privateSessionIssued, false);
  assert.throws(() => staging.assertProductionReady(), /integration is unavailable/u);
  await assert.rejects(() => staging.create(), /integration is unavailable/u);
  await assert.rejects(() => staging.getById(), /integration is unavailable/u);
  await assert.rejects(() => staging.save(), /integration is unavailable/u);

  const production = repository({ binding: PRODUCTION_BINDING });
  assert.equal(production.assertProductionReady().productionEligible, true);
  assert.equal(SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT.privateSessionIssued, false);
  assert.throws(
    () => new DurableFacultyInvitationVerificationService({
      repository: new InMemoryFacultyInvitationRepository(),
    }),
    /durable atomic/u,
  );
});

test('atomic faculty verification emits only pseudonymous metadata and keeps private session/edit closed', async () => {
  const driver = persistentAtomicFacultyDriver();
  const service = new DurableFacultyInvitationVerificationService({ repository: repository({ driver }) });
  const request = validRequest(driver);
  const result = await service.verify(request);
  assert.equal(result.verified, true);
  assert.equal(result.reasonCode, null);
  assert.equal(result.purpose, 'faculty_private_edit');
  assert.equal(result.revision, 1);
  assert.equal(result.verifiedAt, T1);
  assert.equal(result.privateSessionIssued, false);
  assert.equal(result.privateEditGranted, false);
  assert.match(result.caseRef, /^case_[a-f0-9]{64}$/u);
  assert.match(result.invitationRef, /^invitation_[a-f0-9]{64}$/u);
  assert.match(result.facultyRef, /^faculty_[a-f0-9]{64}$/u);
  assert.equal(result.facultyRef, metadataRef('faculty', 'wp:43'));
  const serialized = JSON.stringify(result);
  for (const secret of [
    request.rawToken,
    request.otpCode,
    request.recipientEmail,
    'invitation-faculty-1',
    CHALLENGE_ID,
    'case-faculty-1',
    'wp:43',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
  assert.deepEqual(driver.stats(), { calls: 1, commitRows: 1, invitationRevision: 1 });
});

test('server resolvers receive no client locator and bind invitation and challenge to verified context', async () => {
  const driver = persistentAtomicFacultyDriver();
  const context = verifiedContext();
  const scope = verificationScope();
  let contextCalls = 0;
  let scopeCalls = 0;
  const candidate = repository({
    driver,
    verifiedContextProvider: async (...args) => {
      contextCalls += 1;
      assert.equal(args.length, 0);
      return context;
    },
    scopeProvider: async (request) => {
      scopeCalls += 1;
      assert.deepEqual(request, {
        bindingRef: context.bindingRef,
        operation: 'verify_faculty_invitation',
        purpose: 'faculty_private_edit',
      });
      assert.equal('invitationId' in request, false);
      assert.equal('challengeId' in request, false);
      return scope;
    },
  });
  const result = await candidate.verifyAndCommit(validRequest(driver));
  assert.equal(result.verified, true);
  assert.equal(result.facultyRef, metadataRef('faculty', context.authenticatedSubject));
  assert.equal(contextCalls, 1);
  assert.equal(scopeCalls, 1);
  assert.deepEqual(DURABLE_FACULTY_VERIFICATION_SERVICE_CONTRACT.clientAcceptedFields, [
    'idempotencyKey',
    'otpCode',
    'rawToken',
    'recipientEmail',
  ]);
  assert.deepEqual(DURABLE_FACULTY_VERIFICATION_SERVICE_CONTRACT.serverResolvedFields, [
    'authenticatedSubject',
    'caseId',
    'actorRole',
    'purpose',
    'invitationId',
    'challengeId',
    'verifiedPrincipalId',
  ]);
});

test('foreign subject, case, or context binding from a server resolver fails before durable access', async () => {
  for (const { context, scope } of [
    {
      context: verifiedContext({ authenticatedSubject: 'wp:44' }),
      scope: verificationScope(),
    },
    {
      context: verifiedContext({ caseId: 'case-foreign' }),
      scope: verificationScope(),
    },
    {
      context: verifiedContext({ bindingRef: sha256('context-foreign') }),
      scope: verificationScope(),
    },
    {
      context: verifiedContext(),
      scope: verificationScope({ authenticatedSubject: 'wp:44' }),
    },
    {
      context: verifiedContext(),
      scope: verificationScope({ caseId: 'case-foreign' }),
    },
  ]) {
    const driver = persistentAtomicFacultyDriver();
    await assert.rejects(
      () => repository({ context, driver, scope }).verifyAndCommit(validRequest(driver)),
      /integration is unavailable/u,
    );
    assert.deepEqual(driver.stats(), { calls: 0, commitRows: 0, invitationRevision: 0 });
  }
});

test('durable idempotency survives service restart and repeated cross-instance verification', async () => {
  const driver = persistentAtomicFacultyDriver();
  const makeService = () => new DurableFacultyInvitationVerificationService({
    repository: repository({ driver }),
  });
  const first = makeService();
  const restarted = makeService();
  const request = validRequest(driver);
  const initial = await first.verify(request);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const replay = await (attempt % 2 === 0 ? restarted : first).verify(request);
    assert.equal(replay.invitationRef, initial.invitationRef);
    assert.equal(replay.facultyRef, initial.facultyRef);
    assert.equal(replay.revision, initial.revision);
    assert.equal(replay.idempotentReplay, true);
  }
  assert.deepEqual(driver.stats(), { calls: 201, commitRows: 1, invitationRevision: 1 });
  for (const service of [first, restarted]) {
    assert.equal(
      Reflect.ownKeys(service).some((key) => Reflect.get(service, key) instanceof Map),
      false,
      'service instances must not retain process-local idempotency state',
    );
  }
  await assert.rejects(
    () => restarted.verify(validRequest(driver, { otpCode: '000000' })),
    (error) => {
      assert.equal(error.code, 'IDEMPOTENCY_CONFLICT');
      assert.match(error.details.idempotencyKey, /^idempotency_[a-f0-9]{64}$/u);
      assert.doesNotMatch(JSON.stringify(error.details), /faculty-verify-idempotency-1/u);
      return true;
    },
  );
  assert.deepEqual(driver.stats(), { calls: 202, commitRows: 1, invitationRevision: 1 });
});

test('case, invitation, challenge, recipient, role, and purpose bindings fail closed before access can advance', async () => {
  for (const { scopeOverride, expectedDriverCalls } of [
    { scopeOverride: { caseId: 'case-other' }, expectedDriverCalls: 0 },
    { scopeOverride: { invitationId: 'invitation-other' }, expectedDriverCalls: 1 },
    { scopeOverride: { challengeId: 'challenge-other' }, expectedDriverCalls: 1 },
    { scopeOverride: { recipientEmailHash: sha256('other-recipient') }, expectedDriverCalls: 1 },
    { scopeOverride: { actorRole: 'student' }, expectedDriverCalls: 0 },
    { scopeOverride: { authenticatedSubject: 'wp:44' }, expectedDriverCalls: 0 },
    { scopeOverride: { bindingRef: sha256('foreign-context') }, expectedDriverCalls: 0 },
    { scopeOverride: { purpose: 'case_workflow' }, expectedDriverCalls: 0 },
    { scopeOverride: { operation: 'read' }, expectedDriverCalls: 0 },
    { scopeOverride: { authoritySource: 'client_request' }, expectedDriverCalls: 0 },
    { scopeOverride: { clientAsserted: true }, expectedDriverCalls: 0 },
    { scopeOverride: { clientAsserted: 'false' }, expectedDriverCalls: 0 },
    { scopeOverride: { clientAsserted: null }, expectedDriverCalls: 0 },
    { scopeOverride: { debug: 'unexpected-scope-field' }, expectedDriverCalls: 0 },
  ]) {
    const driver = persistentAtomicFacultyDriver();
    const candidate = repository({ driver, scope: verificationScope(scopeOverride) });
    await assert.rejects(
      () => candidate.verifyAndCommit(validRequest(driver)),
      /integration is unavailable|Access denied/u,
    );
    assert.deepEqual(driver.stats(), {
      calls: expectedDriverCalls,
      commitRows: 0,
      invitationRevision: 0,
    });
  }
});

test('atomic receipt rejects split commits, altered hashes, unbound principals, raw secrets, and session claims', async () => {
  const mutations = [
    (receipt) => ({ ...receipt, sameTransaction: false }),
    (receipt) => ({ ...receipt, otpChallengeCommitted: false }),
    (receipt) => ({ ...receipt, auditCommitted: false }),
    (receipt) => ({ ...receipt, privateSessionIssued: true }),
    (receipt) => ({ ...receipt, transactionRef: 'raw-transaction-locator' }),
    (receipt) => ({ ...receipt, recordHash: sha256('tampered-record') }),
    (receipt) => ({ ...receipt, eventHash: sha256('tampered-event') }),
    (receipt) => ({
      ...receipt,
      databaseTime: {
        ...receipt.databaseTime,
        source: 'application_clock',
      },
    }),
    (receipt) => ({
      ...receipt,
      priorAttemptState: {
        ...receipt.priorAttemptState,
        revision: receipt.priorAttemptState.revision + 1,
        failedAttempts: 1,
        attemptWindowStartedAt: T1,
        lastFailureCode: 'OTP_NOT_VERIFIED',
      },
    }),
    (receipt) => ({
      ...receipt,
      nextAttemptState: {
        ...receipt.nextAttemptState,
        lockedUntil: '2026-08-13T12:31:00.000Z',
      },
    }),
    (receipt) => ({ ...receipt, rawToken: 'forbidden-secret' }),
    (receipt) => ({ ...receipt, debug: 'unreviewed-provider-output' }),
    (receipt) => {
      const invitation = {
        ...receipt.invitation,
        expiresAt: '2026-08-13T12:00:30.000Z',
      };
      return { ...receipt, invitation, recordHash: hashValue(invitation) };
    },
    (receipt) => ({
      ...receipt,
      authorizationBinding: {
        ...receipt.authorizationBinding,
        otpRevoked: true,
      },
    }),
    (receipt) => ({
      ...receipt,
      authorizationBinding: {
        ...receipt.authorizationBinding,
        otpVerifiedAt: '2026-08-13T11:59:59.999Z',
      },
    }),
    (receipt) => ({
      ...receipt,
      authorizationBinding: {
        ...receipt.authorizationBinding,
        purpose: 'different-purpose',
      },
    }),
    (receipt) => ({
      ...receipt,
      authorizationBinding: {
        ...receipt.authorizationBinding,
        verifiedPrincipalId: 'attacker-selected-principal',
      },
    }),
  ];
  for (const [mutationIndex, mutation] of mutations.entries()) {
    const driver = persistentAtomicFacultyDriver({ mutateReceipt: mutation });
    const candidate = repository({ driver });
    await assert.rejects(
      () => candidate.verifyAndCommit(validRequest(driver)),
      /integration is unavailable/u,
      `mutation ${mutationIndex} must fail closed`,
    );
  }
});

test('canonical WordPress faculty identity cannot be forged on both atomic receipt sides', async () => {
  for (const forgedPrincipal of [
    'attacker-selected-principal',
    'wp:44',
    'wp:0',
    'wp:01',
    'wp:-1',
    'WP:43',
    'wp:43\ncontrol',
  ]) {
    const driver = persistentAtomicFacultyDriver({
      mutateReceipt(receipt) {
        const invitation = {
          ...receipt.invitation,
          verifiedFacultyId: forgedPrincipal,
        };
        return {
          ...receipt,
          invitation,
          nextAttemptState: {
            ...receipt.nextAttemptState,
            verifiedFacultyId: forgedPrincipal,
          },
          recordHash: hashValue(invitation),
          authorizationBinding: {
            ...receipt.authorizationBinding,
            verifiedPrincipalId: forgedPrincipal,
          },
        };
      },
    });
    await assert.rejects(
      () => repository({ driver }).verifyAndCommit(validRequest(driver)),
      (error) => {
        assert.equal(error.code, 'INTEGRATION_DISABLED');
        assert.doesNotMatch(
          `${error.message} ${JSON.stringify(error.details)}`,
          /attacker-selected|wp:44|wp:0|wp:01|wp:-1|WP:43|control/u,
        );
        return true;
      },
    );
  }
});

test('database-clock attempt transitions enforce reset, lockout, active lock, and post-lock expiry', async () => {
  const scenarios = [
    {
      name: 'attempt window resets after expiry',
      databaseNow: '2026-08-13T12:20:00.000Z',
      invitationOverrides: {
        revision: 2,
        failedAttempts: 2,
        attemptWindowStartedAt: '2026-08-13T12:04:00.000Z',
        lockedUntil: null,
        lastFailureCode: 'TOKEN_MISMATCH',
      },
      requestOverrides: { otpCode: '000000' },
      expected: {
        revision: 3,
        failedAttempts: 1,
        attemptWindowStartedAt: '2026-08-13T12:20:00.000Z',
        lockedUntil: null,
        lastFailureCode: 'OTP_NOT_VERIFIED',
        reasonCode: 'OTP_NOT_VERIFIED',
      },
    },
    {
      name: 'maximum attempt creates lockout from database time',
      invitationOverrides: {
        revision: 4,
        failedAttempts: 4,
        attemptWindowStartedAt: '2026-08-13T12:00:30.000Z',
        lockedUntil: null,
        lastFailureCode: 'OTP_NOT_VERIFIED',
      },
      requestOverrides: { otpCode: '000000' },
      expected: {
        revision: 5,
        failedAttempts: 5,
        attemptWindowStartedAt: '2026-08-13T12:00:30.000Z',
        lockedUntil: '2026-08-13T12:31:00.000Z',
        lastFailureCode: 'OTP_NOT_VERIFIED',
        reasonCode: 'OTP_NOT_VERIFIED',
      },
    },
    {
      name: 'active lock denies without changing attempt state',
      invitationOverrides: {
        revision: 5,
        failedAttempts: 5,
        attemptWindowStartedAt: '2026-08-13T12:00:00.000Z',
        lockedUntil: '2026-08-13T12:10:00.000Z',
        lastFailureCode: 'OTP_NOT_VERIFIED',
      },
      requestOverrides: {},
      expected: {
        revision: 5,
        failedAttempts: 5,
        attemptWindowStartedAt: '2026-08-13T12:00:00.000Z',
        lockedUntil: '2026-08-13T12:10:00.000Z',
        lastFailureCode: 'OTP_NOT_VERIFIED',
        reasonCode: 'INVITATION_LOCKED',
      },
    },
    {
      name: 'expired lock and attempt window restart from database time',
      databaseNow: '2026-08-13T12:20:00.000Z',
      invitationOverrides: {
        revision: 5,
        failedAttempts: 5,
        attemptWindowStartedAt: '2026-08-13T12:00:00.000Z',
        lockedUntil: '2026-08-13T12:10:00.000Z',
        lastFailureCode: 'OTP_NOT_VERIFIED',
      },
      requestOverrides: { otpCode: '000000' },
      expected: {
        revision: 6,
        failedAttempts: 1,
        attemptWindowStartedAt: '2026-08-13T12:20:00.000Z',
        lockedUntil: null,
        lastFailureCode: 'OTP_NOT_VERIFIED',
        reasonCode: 'OTP_NOT_VERIFIED',
      },
    },
  ];
  for (const scenario of scenarios) {
    const driver = persistentAtomicFacultyDriver({
      databaseNow: scenario.databaseNow,
      invitationOverrides: scenario.invitationOverrides,
    });
    const result = await repository({ driver }).verifyAndCommit(validRequest(driver, {
      idempotencyKey: `transition-${scenario.name}`,
      ...scenario.requestOverrides,
    }));
    assert.equal(result.verified, false, scenario.name);
    assert.equal(result.reasonCode, scenario.expected.reasonCode, scenario.name);
    assert.equal(result.privateSessionIssued, false, scenario.name);
    assert.equal(result.privateEditGranted, false, scenario.name);
    const snapshot = driver.snapshot();
    for (const field of [
      'revision',
      'failedAttempts',
      'attemptWindowStartedAt',
      'lockedUntil',
      'lastFailureCode',
    ]) {
      assert.equal(snapshot[field], scenario.expected[field], `${scenario.name}: ${field}`);
    }
    assert.deepEqual(driver.stats(), {
      calls: 1,
      commitRows: 1,
      invitationRevision: scenario.expected.revision,
    });
  }
});

test('maximum attempts without a durable lock cannot be forged into success or another denial', async () => {
  for (const requestOverrides of [
    {},
    { otpCode: '000000' },
  ]) {
    const driver = persistentAtomicFacultyDriver({
      invitationOverrides: {
        revision: 5,
        failedAttempts: 5,
        attemptWindowStartedAt: '2026-08-13T11:30:00.000Z',
        lockedUntil: null,
        lastFailureCode: 'OTP_NOT_VERIFIED',
      },
    });
    await assert.rejects(
      () => repository({ driver }).verifyAndCommit(validRequest(driver, {
        idempotencyKey: requestOverrides.otpCode
          ? 'forged-max-null-denial'
          : 'forged-max-null-success',
        ...requestOverrides,
      })),
      /integration is unavailable/u,
    );
    assert.deepEqual(driver.stats(), {
      calls: 1,
      commitRows: 1,
      invitationRevision: 6,
    });
  }
});

test('prior attempt chronology is enforced before success and terminal denial branches', async () => {
  const scenarios = [
    {
      name: 'future window success',
      invitationOverrides: {
        revision: 1,
        failedAttempts: 1,
        attemptWindowStartedAt: '2026-08-13T12:02:00.000Z',
        lockedUntil: null,
        lastFailureCode: 'OTP_NOT_VERIFIED',
      },
      requestOverrides: {},
      expectedRevision: 2,
    },
    {
      name: 'future window terminal lock denial',
      invitationOverrides: {
        revision: 5,
        failedAttempts: 5,
        attemptWindowStartedAt: '2026-08-13T12:02:00.000Z',
        lockedUntil: '2026-08-13T12:10:00.000Z',
        lastFailureCode: 'OTP_NOT_VERIFIED',
      },
      requestOverrides: {},
      expectedRevision: 5,
    },
    {
      name: 'precreation window success',
      invitationOverrides: {
        revision: 1,
        failedAttempts: 1,
        attemptWindowStartedAt: '2026-08-13T11:59:59.999Z',
        lockedUntil: null,
        lastFailureCode: 'OTP_NOT_VERIFIED',
      },
      requestOverrides: {},
      expectedRevision: 2,
    },
    {
      name: 'precreation window terminal revocation denial',
      invitationOverrides: {
        revision: 2,
        failedAttempts: 1,
        attemptWindowStartedAt: '2026-08-13T11:59:59.999Z',
        lockedUntil: null,
        lastFailureCode: 'OTP_NOT_VERIFIED',
        revokedAt: '2026-08-13T12:00:30.000Z',
      },
      requestOverrides: {},
      expectedRevision: 2,
    },
    {
      name: 'expired incoherent lock success',
      invitationOverrides: {
        revision: 5,
        failedAttempts: 5,
        attemptWindowStartedAt: '2026-08-13T12:00:30.000Z',
        lockedUntil: '2026-08-13T12:00:20.000Z',
        lastFailureCode: 'OTP_NOT_VERIFIED',
      },
      requestOverrides: {},
      expectedRevision: 6,
    },
    {
      name: 'active incoherent lock terminal denial',
      invitationOverrides: {
        revision: 5,
        failedAttempts: 5,
        attemptWindowStartedAt: '2026-08-13T12:20:00.000Z',
        lockedUntil: '2026-08-13T12:10:00.000Z',
        lastFailureCode: 'OTP_NOT_VERIFIED',
      },
      requestOverrides: {},
      expectedRevision: 5,
    },
  ];
  for (const scenario of scenarios) {
    const driver = persistentAtomicFacultyDriver({
      invitationOverrides: scenario.invitationOverrides,
    });
    await assert.rejects(
      () => repository({ driver }).verifyAndCommit(validRequest(driver, {
        idempotencyKey: `invalid-chronology-${scenario.name}`,
        ...scenario.requestOverrides,
      })),
      /integration is unavailable/u,
      scenario.name,
    );
    assert.deepEqual(driver.stats(), {
      calls: 1,
      commitRows: 1,
      invitationRevision: scenario.expectedRevision,
    }, scenario.name);
  }
});

test('repository independently rejects fabricated success for mismatched token or recipient', async () => {
  for (const requestOverride of [
    { rawToken: 'wrong-token-that-the-driver-must-not-accept' },
    { recipientEmail: 'wrong-faculty@example.test' },
  ]) {
    const driver = persistentAtomicFacultyDriver({ bypassCredentialChecks: true });
    await assert.rejects(
      () => repository({ driver }).verifyAndCommit(validRequest(driver, requestOverride)),
      /integration is unavailable/u,
    );
  }
});

test('denied attempts commit metadata-only audit and expose only a fixed denial', async () => {
  const driver = persistentAtomicFacultyDriver();
  const service = new DurableFacultyInvitationVerificationService({ repository: repository({ driver }) });
  const request = validRequest(driver, {
    rawToken: 'attacker-token-that-must-not-escape',
    idempotencyKey: 'faculty-denied-idempotency-1',
  });
  await assert.rejects(() => service.verify(request), (error) => {
    assert.equal(error.code, 'INVITATION_DENIED');
    assert.deepEqual(error.details, { reasonCode: 'INVITATION_DENIED' });
    const serialized = `${error.message} ${JSON.stringify(error.details)}`;
    assert.doesNotMatch(serialized, /attacker-token|faculty@example|538291|case-faculty|invitation-faculty/u);
    return true;
  });
  assert.deepEqual(driver.stats(), { calls: 1, commitRows: 1, invitationRevision: 1 });

});

test('service rejects client invitation, challenge, protected identifiers, and authority assertions', async () => {
  const driver = persistentAtomicFacultyDriver();
  const service = new DurableFacultyInvitationVerificationService({ repository: repository({ driver }) });
  for (const forbidden of [
    { caseId: 'case-client-selected' },
    { invitationId: 'invitation-client-selected' },
    { challengeId: 'challenge-client-selected' },
    { studentId: 'wp:777' },
    { facultyId: 'wp:778' },
    { actorRole: 'faculty' },
    { principalId: 'wp:999' },
    { purpose: 'faculty_private_edit' },
    { sessionToken: 'client-session-secret' },
  ]) {
    await assert.rejects(
      () => service.verify({ ...validRequest(driver), ...forbidden }),
      (error) => {
        assert.equal(error.code, 'VALIDATION_FAILED');
        assert.doesNotMatch(
          error.message,
          /case-client-selected|invitation-client-selected|challenge-client-selected|wp:777|wp:778|wp:999|client-session-secret/u,
        );
        return true;
      },
    );
  }
  assert.deepEqual(driver.stats(), { calls: 0, commitRows: 0, invitationRevision: 0 });
});

test('scope, driver, and malformed receipt failures suppress raw boundary errors', async () => {
  const scopeDriver = persistentAtomicFacultyDriver();
  const scopeFailureRepository = new SupabaseDurableFacultyInvitationRepository({
    binding: STAGING_BINDING,
    driver: scopeDriver,
    verifiedContextProvider: async () => verifiedContext(),
    async scopeProvider() {
      throw new Error('SCOPE_SECRET faculty@example.test');
    },
  });
  await assert.rejects(
    () => scopeFailureRepository.verifyAndCommit(validRequest(scopeDriver)),
    (error) => {
      assert.equal(error.code, 'INTEGRATION_DISABLED');
      assert.doesNotMatch(`${error.message} ${JSON.stringify(error.details)}`, /SCOPE_SECRET|faculty@example/u);
      return true;
    },
  );

  const malformedScopeDriver = persistentAtomicFacultyDriver();
  const malformedScopeRepository = new SupabaseDurableFacultyInvitationRepository({
    binding: STAGING_BINDING,
    driver: malformedScopeDriver,
    verifiedContextProvider: async () => verifiedContext(),
    async scopeProvider() {
      return new Proxy({}, {
        ownKeys() {
          throw new Error('SCOPE_OBJECT_SECRET faculty@example.test');
        },
      });
    },
  });
  await assert.rejects(
    () => malformedScopeRepository.verifyAndCommit(validRequest(malformedScopeDriver)),
    (error) => {
      assert.equal(error.code, 'INTEGRATION_DISABLED');
      assert.doesNotMatch(`${error.message} ${JSON.stringify(error.details)}`, /SCOPE_OBJECT_SECRET|faculty@example/u);
      return true;
    },
  );

  const contextFailureDriver = persistentAtomicFacultyDriver();
  const contextFailureRepository = new SupabaseDurableFacultyInvitationRepository({
    binding: STAGING_BINDING,
    driver: contextFailureDriver,
    scopeProvider: async () => verificationScope(),
    async verifiedContextProvider() {
      throw new Error('CONTEXT_SECRET wp:43');
    },
  });
  await assert.rejects(
    () => contextFailureRepository.verifyAndCommit(validRequest(contextFailureDriver)),
    (error) => {
      assert.equal(error.code, 'INTEGRATION_DISABLED');
      assert.doesNotMatch(`${error.message} ${JSON.stringify(error.details)}`, /CONTEXT_SECRET|wp:43/u);
      return true;
    },
  );

  const driverFailure = persistentAtomicFacultyDriver();
  driverFailure.executeAtomicFacultyVerification = async () => {
    throw new Error('DRIVER_SECRET 538291');
  };
  await assert.rejects(
    () => repository({ driver: driverFailure }).verifyAndCommit(validRequest(driverFailure)),
    (error) => {
      assert.equal(error.code, 'INTEGRATION_DISABLED');
      assert.doesNotMatch(`${error.message} ${JSON.stringify(error.details)}`, /DRIVER_SECRET|538291/u);
      return true;
    },
  );

  const malformedReceiptDriver = persistentAtomicFacultyDriver({
    mutateReceipt() {
      return new Proxy({}, {
        ownKeys() {
          throw new Error('RECEIPT_SECRET invitation-faculty-1');
        },
      });
    },
  });
  await assert.rejects(
    () => repository({ driver: malformedReceiptDriver }).verifyAndCommit(validRequest(malformedReceiptDriver)),
    (error) => {
      assert.equal(error.code, 'INTEGRATION_DISABLED');
      assert.doesNotMatch(`${error.message} ${JSON.stringify(error.details)}`, /RECEIPT_SECRET|invitation-faculty/u);
      return true;
    },
  );
});
