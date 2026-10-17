import assert from 'node:assert/strict';
import test from 'node:test';

import { PostmarkFacultyInvitationAdapter } from '../../lor-studio/adapters/faculty-otp-postmark-adapters.mjs';
import { HmacFacultyInvitationSecretDeriver } from '../../lor-studio/adapters/faculty-invitation-hmac-deriver.mjs';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import { PostmarkFacultyInvitationTransport } from '../../lor-studio/adapters/postmark-faculty-invitation-transport.mjs';
import { IntegrationDisabledError } from '../../lor-studio/domain/errors.js';
import { hashValue, sha256 } from '../../lor-studio/domain/value-utils.js';
import { hashFacultyEmail } from '../../lor-studio/security/faculty-invitations.js';
import { SupabaseDurableFacultyInvitationCommandRepository } from '../../lor-studio/repositories/supabase-durable-faculty-invitation-command-repository.mjs';
import {
  DurableFacultyInvitationLifecycleService,
  isAuthenticDurableFacultyInvitationLifecycleService,
} from '../../lor-studio/services/durable-faculty-invitation-lifecycle-service.mjs';

const T0 = new Date('2026-08-25T12:00:00.000Z');
const ACTOR = Object.freeze({ id: 'wp:41', role: 'student' });
const BINDING = Object.freeze({
  schemaVersion: 'missionmed.lor.faculty-invitation-secret-binding.v1',
  providerResourceBound: true,
  independentlyVerified: true,
  serverSideSecret: true,
  keyVersion: 'v1',
});
const KEY = Buffer.alloc(32, 0x5a);
const POSTMARK_ENDPOINT = 'https://api.postmarkapp.com/email/withTemplate';
const POSTMARK_TRANSPORT_BINDING = Object.freeze({
  schemaVersion: 'missionmed.lor.postmark-transport-binding.v1',
  provider: 'postmark',
  providerResourceBound: true,
  independentlyVerified: true,
  serverId: 'postmark-server-lifecycle-test',
  senderIdentityVerified: true,
  templateVerified: true,
  fromEmail: 'lor@missionmed.example',
  replyToEmail: '',
  invitationOrigin: 'https://missionmed.example',
  invitationRouteTemplate: '/lor-studio/invitations/{invitationId}',
  templateAlias: 'lor-faculty-invitation-v1',
  messageStream: 'outbound',
});
const POSTMARK_ADAPTER_BINDING = Object.freeze({
  providerResourceBound: true,
  independentlyVerified: true,
  provider: 'postmark',
  senderIdentityVerified: true,
  serverSideCredentials: true,
  invitationOrigin: 'https://missionmed.example',
  invitationRouteTemplate: '/lor-studio/invitations/{invitationId}',
  templateAlias: 'lor-faculty-invitation-v1',
});

const TARGET_BINDING = resolveLorTargetBinding({
  schemaVersion: LOR_TARGET_BINDING_SCHEMA,
  ratified: true,
  decisionRecord: 'DR-133',
  environment: 'production',
  provider: 'railway-postgres',
  projectId: 'project-lor-production',
  environmentId: 'environment-lor-production',
  serviceId: 'service-lor-postgres',
  databaseName: 'lor_studio_production',
  region: 'us-east-1',
  schema: 'lor_studio',
  migrationLedger: 'lor-studio/migrations/ledger',
  providerResourceBound: true,
  independentlyVerified: true,
  health: 'ready',
  environmentBound: true,
  dataCopied: false,
  productionDataBindingPassed: true,
});

function studentScope(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: 'c5f4618e-0bf5-4c8d-82cf-2a8940c84ee6',
    authenticatedSubject: 'wp:41',
    actorId: 'wp:41',
    actorRole: 'student',
    resourceStudentId: 'wp:41',
    caseId: 'case-1',
    operation: 'save',
    purpose: 'student_case_write',
    assignmentId: null,
    invitationId: null,
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
    ...overrides,
  };
}

function commandReceipt({
  action,
  caseId = 'case-1',
  invitationId,
  challengeId = null,
  caseRevision = 9,
  invitationRevision = 0,
  replayed = false,
  invitationExpiresAt = null,
  challengeExpiresAt = null,
} = {}) {
  return {
    schemaVersion: 'missionmed.lor.faculty-invitation-command-receipt.v1',
    receiptId: `faculty_command_${sha256(`${action}:receipt`)}`,
    action,
    committed: true,
    replayed,
    caseId,
    invitationId,
    challengeIdHash: challengeId === null ? null : hashValue({ challengeId }),
    caseRevision,
    invitationRevision,
    verified: null,
    reasonCode: null,
    auditEventRef: `event_${sha256(`${action}:audit`)}`,
    transactionId: '8821',
    invitationExpiresAt,
    challengeExpiresAt,
  };
}

function deliveryReservationReceipt({
  caseId = 'case-1',
  invitationId,
  deliveryAction = 'issue',
  idempotencyKey,
  requestHash,
  status = 'pending',
  dispatchGranted = status === 'pending',
  replayed = !dispatchGranted,
  providerMessageRefHash = status === 'accepted' ? sha256('provider-message') : null,
  auditEventRef = status === 'accepted' ? `event_${sha256('delivery:audit')}` : null,
} = {}) {
  return {
    schemaVersion: 'missionmed.lor.faculty-invitation-delivery-reservation-receipt.v1',
    reservationId: `faculty_delivery_reservation_${sha256(`${caseId}:${invitationId}:${idempotencyKey}`)}`,
    caseId,
    invitationId,
    deliveryAction,
    status,
    dispatchGranted,
    replayed,
    requestHash,
    providerMessageRefHash,
    auditEventRef,
    reservedAt: T0.toISOString(),
    settledAt: status === 'pending' ? null : T0.toISOString(),
    transactionId: status === 'pending' ? '8820' : '8821',
  };
}

function genuineEmail(calls, { failTransport = false } = {}) {
  const transport = new PostmarkFacultyInvitationTransport({
    binding: POSTMARK_TRANSPORT_BINDING,
    credentialProvider: {
      serverOnly: true,
      async getServerToken() { return 'postmark-lifecycle-test-token'; },
    },
    clock: () => T0,
    timeoutMs: 100,
    async fetchImplementation(url, options) {
      if (failTransport) throw new Error('simulated transport failure');
      assert.equal(url, POSTMARK_ENDPOINT);
      const body = JSON.parse(options.body);
      const invitationUrl = new URL(body.TemplateModel.invitation_url);
      calls.push({
        invitationId: decodeURIComponent(invitationUrl.pathname.split('/').at(-1)),
        invitationToken: new URLSearchParams(invitationUrl.hash.slice(1)).get('token'),
        invitationUrl: `${invitationUrl.origin}${invitationUrl.pathname}`,
        oneTimeCode: body.TemplateModel.one_time_code,
        otpExpiresAt: body.TemplateModel.otp_expires_at,
        expiresAt: body.TemplateModel.invitation_expires_at,
        recipientEmail: body.To,
        recipientEmailHash: hashFacultyEmail(body.To),
        templateAlias: body.TemplateAlias,
      });
      const payload = JSON.stringify({
        ErrorCode: 0,
        Message: 'OK',
        MessageID: `postmark-lifecycle-message-${calls.length}`,
        SubmittedAt: T0.toISOString(),
        To: body.To,
      });
      return {
        url: POSTMARK_ENDPOINT,
        status: 200,
        ok: true,
        headers: {
          get(name) {
            if (String(name).toLowerCase() === 'content-type') return 'application/json';
            if (String(name).toLowerCase() === 'content-length') {
              return String(Buffer.byteLength(payload, 'utf8'));
            }
            return null;
          },
        },
        async text() { return payload; },
      };
    },
  });
  return new PostmarkFacultyInvitationAdapter({
    binding: POSTMARK_ADAPTER_BINDING,
    transport,
    clock: () => T0,
  });
}

function repository(overrides = {}) {
  const reservations = new Map();
  const durable = {
    isDurable: true,
    atomicInvitationOtpAndAudit: true,
    databaseClock: true,
    async issueAndCommit() { throw new Error('unexpected issue'); },
    async resendOtpAndCommit() { throw new Error('unexpected resend'); },
    async revokeAndCommit() { throw new Error('unexpected revoke'); },
    async reserveDelivery(request) {
      const stored = reservations.get(request.idempotencyKey);
      if (stored) {
        return deliveryReservationReceipt({
          ...request,
          ...stored,
          dispatchGranted: false,
          replayed: true,
        });
      }
      const state = {
        status: 'pending',
        deliveryAction: request.deliveryAction,
        providerMessageRefHash: null,
        auditEventRef: null,
      };
      reservations.set(request.idempotencyKey, state);
      return deliveryReservationReceipt({ ...request, ...state });
    },
    async commitDelivery(request) {
      const stored = reservations.get(request.idempotencyKey);
      if (stored) {
        reservations.set(request.idempotencyKey, {
          ...stored,
          status: 'accepted',
          providerMessageRefHash: request.providerMessageRefHash,
          auditEventRef: `event_${sha256('faculty.invitation.delivery:audit')}`,
        });
      }
      return commandReceipt({
        action: 'faculty.invitation.delivery',
        caseId: request.caseId,
        invitationId: request.invitationId,
        caseRevision: 9,
      });
    },
    async markDeliveryUnknown(request) {
      const stored = reservations.get(request.idempotencyKey);
      if (stored?.status === 'pending') {
        reservations.set(request.idempotencyKey, {
          ...stored,
          status: 'unknown',
          providerMessageRefHash: null,
          auditEventRef: null,
        });
      }
      return deliveryReservationReceipt({
        ...request,
        ...(reservations.get(request.idempotencyKey) ?? stored),
        dispatchGranted: false,
        replayed: false,
      });
    },
    ...overrides,
  };
  return durable;
}

function service(options = {}) {
  return new DurableFacultyInvitationLifecycleService({
    repository: options.repository,
    emailPort: options.emailPort,
    secretDeriver: options.secretDeriver ?? new HmacFacultyInvitationSecretDeriver({ binding: BINDING, key: KEY }),
    invitationOrigin: 'https://missionmed.example',
    clock: () => T0,
  });
}

test('only exact successfully constructed invitation lifecycle services satisfy authenticity', () => {
  const dependencies = {
    repository: repository(),
    emailPort: genuineEmail([]),
    secretDeriver: new HmacFacultyInvitationSecretDeriver({ binding: BINDING, key: KEY }),
    invitationOrigin: 'https://missionmed.example',
    clock: () => T0,
  };
  const genuine = new DurableFacultyInvitationLifecycleService(dependencies);
  assert.equal(isAuthenticDurableFacultyInvitationLifecycleService(genuine), true);

  for (const lookalike of [
    null,
    {},
    { async issue() {}, async resendOtp() {}, async revoke() {} },
    Object.create(DurableFacultyInvitationLifecycleService.prototype),
    new Proxy(genuine, {}),
  ]) {
    assert.equal(isAuthenticDurableFacultyInvitationLifecycleService(lookalike), false);
  }

  class OverriddenLifecycleService extends DurableFacultyInvitationLifecycleService {
    async issue() { return { delivered: true }; }
  }
  const overridden = new OverriddenLifecycleService(dependencies);
  assert.equal(
    isAuthenticDurableFacultyInvitationLifecycleService(overridden),
    false,
    'subclass method replacement must not inherit production authenticity',
  );
  assert.throws(
    () => new DurableFacultyInvitationLifecycleService({
      ...dependencies,
      emailPort: { async sendFacultyInvitation() {} },
    }),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'EMAIL_PORT_REQUIRED',
  );
});

test('HMAC invitation derivation is retry-stable, scoped, and keeps the injected key private', () => {
  const deriver = new HmacFacultyInvitationSecretDeriver({ binding: BINDING, key: KEY });
  const input = {
    caseId: 'case-1',
    expectedRevision: 8,
    recipientEmailHash: hashFacultyEmail('writer@example.test'),
    idempotencyKey: 'issue-1',
  };
  const first = deriver.deriveIssue(input);
  const replay = deriver.deriveIssue(input);
  const other = deriver.deriveIssue({ ...input, idempotencyKey: 'issue-2' });
  assert.deepEqual(replay, first);
  assert.notEqual(other.invitationId, first.invitationId);
  assert.notEqual(other.rawToken, first.rawToken);
  assert.match(first.invitationId, /^invite_[a-f0-9]{64}$/u);
  assert.match(first.challengeId, /^challenge_[a-f0-9]{64}$/u);
  assert.match(first.otpCode, /^[0-9]{6}$/u);
  assert.equal(first.tokenHash, sha256(first.rawToken));
  assert.equal(
    first.otpCodeHash,
    sha256(`lor-studio:otp-attempt:${first.challengeId}:${first.otpCode}`),
  );
  assert.equal(deriver.tokenForInvitation(first.invitationId), first.rawToken);
  assert.doesNotMatch(JSON.stringify(deriver), /5a5a5a5a/u);
});

test('secret derivation refuses unverified bindings and undersized keys without echoing secrets', () => {
  assert.throws(
    () => new HmacFacultyInvitationSecretDeriver({
      binding: { ...BINDING, independentlyVerified: false },
      key: KEY,
    }),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'VERIFIED_SECRET_BINDING_REQUIRED',
  );
  assert.throws(
    () => new HmacFacultyInvitationSecretDeriver({ binding: BINDING, key: Buffer.from('short') }),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'BOUND_SECRET_KEY_REQUIRED'
      && !error.message.includes('short'),
  );
});

test('durable invitation repository binds exact student scope and sends only hashes to atomic commands', async () => {
  const scopeRequests = [];
  const driverCalls = [];
  const driver = {
    rlsEnforced: true,
    serverOnly: true,
    databaseClock: true,
    atomicFacultyInvitationCommands: true,
    async issueFacultyInvitationAtomic(command) {
      driverCalls.push(['issue', structuredClone(command)]);
      return commandReceipt({
        action: 'faculty.invitation.issue',
        invitationId: command.invitationId,
        challengeId: command.challengeId,
        invitationExpiresAt: command.invitationExpiresAt,
        challengeExpiresAt: command.challengeExpiresAt,
      });
    },
    async resendFacultyInvitationOtpAtomic() { throw new Error('unused'); },
    async revokeFacultyInvitationAtomic() { throw new Error('unused'); },
    async reserveFacultyInvitationDeliveryAtomic(command) {
      driverCalls.push(['reserve', structuredClone(command)]);
      return deliveryReservationReceipt(command);
    },
    async commitFacultyInvitationDeliveryAtomic(command) {
      driverCalls.push(['delivery', structuredClone(command)]);
      return commandReceipt({
        action: 'faculty.invitation.delivery',
        invitationId: command.invitationId,
      });
    },
    async markFacultyInvitationDeliveryUnknownAtomic() { throw new Error('unused'); },
  };
  const durable = new SupabaseDurableFacultyInvitationCommandRepository({
    binding: TARGET_BINDING,
    driver,
    async scopeProvider(request) {
      scopeRequests.push(structuredClone(request));
      return studentScope();
    },
  });
  const invitationId = `invite_${'c'.repeat(64)}`;
  const challengeId = `challenge_${'d'.repeat(64)}`;
  await durable.issueAndCommit({
    actorId: 'wp:41',
    caseId: 'case-1',
    expectedRevision: 8,
    invitationId,
    recipientEmailHash: sha256('writer@example.test'),
    tokenHash: sha256('raw-token-never-crosses-this-boundary'),
    challengeId,
    otpCodeHash: sha256('raw-otp-never-crosses-this-boundary'),
    invitationExpiresAt: '2026-09-01T12:00:00.000Z',
    challengeExpiresAt: '2026-08-25T12:10:00.000Z',
    maxAttempts: 5,
    attemptWindowMs: 900_000,
    lockoutMs: 1_800_000,
    idempotencyKey: 'issue-1',
    requestHash: sha256('issue-request'),
  });
  await durable.commitDelivery({
    resourceStudentId: 'wp:41',
    caseId: 'case-1',
    invitationId,
    providerMessageRefHash: sha256('provider-message'),
    idempotencyKey: 'delivery-1',
    requestHash: sha256('delivery-request'),
  });
  await durable.reserveDelivery({
    resourceStudentId: 'wp:41',
    caseId: 'case-1',
    invitationId,
    deliveryAction: 'issue',
    idempotencyKey: 'delivery-reservation-1',
    requestHash: sha256('delivery-reservation-request'),
  });
  assert.deepEqual(scopeRequests, [
    { caseId: 'case-1', operation: 'save', resourceStudentId: 'wp:41' },
    { caseId: 'case-1', operation: 'save', resourceStudentId: 'wp:41' },
    { caseId: 'case-1', operation: 'save', resourceStudentId: 'wp:41' },
  ]);
  assert.equal(driverCalls[0][1].scope.authenticatedSubject, 'wp:41');
  assert.equal(driverCalls[1][1].studentScope.authenticatedSubject, 'wp:41');
  assert.equal(driverCalls[2][1].studentScope.authenticatedSubject, 'wp:41');
  for (const [, command] of driverCalls) {
    assert.equal('recipientEmail' in command, false);
    assert.equal('rawToken' in command, false);
    assert.equal('otpCode' in command, false);
  }
});

test('durable invitation repository rejects cross-subject and non-atomic scopes', async () => {
  const driver = {
    rlsEnforced: true,
    serverOnly: true,
    databaseClock: true,
    atomicFacultyInvitationCommands: true,
    async issueFacultyInvitationAtomic() { return {}; },
    async resendFacultyInvitationOtpAtomic() { return {}; },
    async revokeFacultyInvitationAtomic() { return {}; },
    async reserveFacultyInvitationDeliveryAtomic() { return {}; },
    async commitFacultyInvitationDeliveryAtomic() { return {}; },
    async markFacultyInvitationDeliveryUnknownAtomic() { return {}; },
  };
  const durable = new SupabaseDurableFacultyInvitationCommandRepository({
    binding: TARGET_BINDING,
    driver,
    scopeProvider: async () => studentScope({ resourceStudentId: 'wp:99' }),
  });
  await assert.rejects(
    () => durable.revokeAndCommit({
      actorId: 'wp:41',
      caseId: 'case-1',
      idempotencyKey: 'revoke-cross-subject',
      requestHash: sha256('revoke-cross-subject'),
    }),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );
  assert.throws(
    () => new SupabaseDurableFacultyInvitationCommandRepository({
      binding: TARGET_BINDING,
      driver: { ...driver, atomicFacultyInvitationCommands: false },
      scopeProvider: async () => studentScope(),
    }),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'ATOMIC_COMMAND_DRIVER_REQUIRED',
  );
});

test('issue commits hashes first, delivers recoverable raw secrets, commits metadata receipt, and returns no secret', async () => {
  const emailCalls = [];
  const databaseCalls = [];
  const deriver = new HmacFacultyInvitationSecretDeriver({ binding: BINDING, key: KEY });
  const expectedSecret = deriver.deriveIssue({
    caseId: 'case-1',
    expectedRevision: 8,
    recipientEmailHash: hashFacultyEmail('writer@example.test'),
    idempotencyKey: 'issue-1',
  });
  const durable = repository({
    async issueAndCommit(request) {
      databaseCalls.push(['issue', structuredClone(request)]);
      return commandReceipt({
        action: 'faculty.invitation.issue',
        invitationId: request.invitationId,
        challengeId: request.challengeId,
        caseRevision: 9,
        invitationExpiresAt: '2026-09-01T12:00:00.000Z',
        challengeExpiresAt: '2026-08-25T12:10:00.000Z',
      });
    },
    async reserveDelivery(request) {
      databaseCalls.push(['reserve', structuredClone(request)]);
      return deliveryReservationReceipt(request);
    },
    async commitDelivery(request) {
      databaseCalls.push(['delivery', structuredClone(request)]);
      return commandReceipt({
        action: 'faculty.invitation.delivery',
        invitationId: request.invitationId,
        caseRevision: 9,
      });
    },
  });
  const result = await service({
    repository: durable,
    emailPort: genuineEmail(emailCalls),
    secretDeriver: deriver,
  }).issue({
    actor: ACTOR,
    caseId: 'case-1',
    expectedRevision: 8,
    idempotencyKey: 'issue-1',
    recipientEmail: 'Writer@Example.Test',
  });

  assert.equal(databaseCalls[0][0], 'issue');
  assert.equal(databaseCalls[1][0], 'reserve');
  assert.equal(databaseCalls[2][0], 'delivery');
  assert.equal(databaseCalls[0][1].tokenHash, expectedSecret.tokenHash);
  assert.equal(databaseCalls[0][1].otpCodeHash, expectedSecret.otpCodeHash);
  assert.doesNotMatch(JSON.stringify(databaseCalls[0][1]), new RegExp(expectedSecret.rawToken, 'u'));
  assert.doesNotMatch(JSON.stringify(databaseCalls[0][1]), new RegExp(expectedSecret.otpCode, 'u'));
  assert.equal(emailCalls[0].invitationToken, expectedSecret.rawToken);
  assert.equal(emailCalls[0].oneTimeCode, expectedSecret.otpCode);
  assert.equal(emailCalls[0].expiresAt, '2026-09-01T12:00:00.000Z');
  assert.equal(emailCalls[0].otpExpiresAt, '2026-08-25T12:10:00.000Z');
  assert.equal(result.delivered, true);
  assert.equal(result.caseRevision, 9);
  assert.doesNotMatch(JSON.stringify(result), /Writer@Example|482901|invitationToken|oneTimeCode/u);
  assert.equal('invitationId' in result, false);
});

test('same issue idempotency input regenerates identical secrets while using stored committed expiry', async () => {
  const emailCalls = [];
  let issueCalls = 0;
  const durable = repository({
    async issueAndCommit(request) {
      issueCalls += 1;
      return commandReceipt({
        action: 'faculty.invitation.issue',
        invitationId: request.invitationId,
        challengeId: request.challengeId,
        replayed: issueCalls > 1,
        caseRevision: 9,
        invitationExpiresAt: '2026-09-01T12:00:00.000Z',
        challengeExpiresAt: '2026-08-25T12:10:00.000Z',
      });
    },
  });
  const lifecycle = service({ repository: durable, emailPort: genuineEmail(emailCalls) });
  const input = {
    actor: ACTOR,
    caseId: 'case-1',
    expectedRevision: 8,
    idempotencyKey: 'issue-replay',
    recipientEmail: 'writer@example.test',
  };
  await lifecycle.issue(input);
  const replay = await lifecycle.issue(input);
  assert.equal(emailCalls.length, 1);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.deliveryStatus, 'accepted');
});

test('a post-provider commit failure remains pending and replay never dispatches again', async () => {
  const emailCalls = [];
  let issueCalls = 0;
  const durable = repository({
    async issueAndCommit(request) {
      issueCalls += 1;
      return commandReceipt({
        action: 'faculty.invitation.issue',
        invitationId: request.invitationId,
        challengeId: request.challengeId,
        replayed: issueCalls > 1,
        caseRevision: 9,
        invitationExpiresAt: '2026-09-01T12:00:00.000Z',
        challengeExpiresAt: '2026-08-25T12:10:00.000Z',
      });
    },
    async commitDelivery() { throw new Error('database unavailable after provider acceptance'); },
  });
  const lifecycle = service({ repository: durable, emailPort: genuineEmail(emailCalls) });
  const input = {
    actor: ACTOR,
    caseId: 'case-1',
    expectedRevision: 8,
    idempotencyKey: 'issue-pending-replay',
    recipientEmail: 'writer@example.test',
  };
  await assert.rejects(
    () => lifecycle.issue(input),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'DELIVERY_COMMIT_UNAVAILABLE',
  );
  const replay = await lifecycle.issue(input);
  assert.equal(emailCalls.length, 1);
  assert.equal(replay.delivered, false);
  assert.equal(replay.deliveryStatus, 'pending');
  assert.equal(replay.idempotentReplay, true);
});

test('a transport failure is durably marked unknown and replay never dispatches again', async () => {
  const emailCalls = [];
  let issueCalls = 0;
  const durable = repository({
    async issueAndCommit(request) {
      issueCalls += 1;
      return commandReceipt({
        action: 'faculty.invitation.issue',
        invitationId: request.invitationId,
        challengeId: request.challengeId,
        replayed: issueCalls > 1,
        caseRevision: 9,
        invitationExpiresAt: '2026-09-01T12:00:00.000Z',
        challengeExpiresAt: '2026-08-25T12:10:00.000Z',
      });
    },
  });
  const lifecycle = service({
    repository: durable,
    emailPort: genuineEmail(emailCalls, { failTransport: true }),
  });
  const input = {
    actor: ACTOR,
    caseId: 'case-1',
    expectedRevision: 8,
    idempotencyKey: 'issue-unknown-replay',
    recipientEmail: 'writer@example.test',
  };
  await assert.rejects(
    () => lifecycle.issue(input),
    (error) => error instanceof IntegrationDisabledError,
  );
  const replay = await lifecycle.issue(input);
  assert.equal(emailCalls.length, 0);
  assert.equal(replay.delivered, false);
  assert.equal(replay.deliveryStatus, 'unknown');
  assert.equal(replay.idempotentReplay, true);
});

test('concurrent delivery attempts grant exactly one provider dispatch', async () => {
  const emailCalls = [];
  let issueCalls = 0;
  const durable = repository({
    async issueAndCommit(request) {
      issueCalls += 1;
      return commandReceipt({
        action: 'faculty.invitation.issue',
        invitationId: request.invitationId,
        challengeId: request.challengeId,
        replayed: issueCalls > 1,
        caseRevision: 9,
        invitationExpiresAt: '2026-09-01T12:00:00.000Z',
        challengeExpiresAt: '2026-08-25T12:10:00.000Z',
      });
    },
  });
  const lifecycle = service({ repository: durable, emailPort: genuineEmail(emailCalls) });
  const input = {
    actor: ACTOR,
    caseId: 'case-1',
    expectedRevision: 8,
    idempotencyKey: 'issue-concurrent-replay',
    recipientEmail: 'writer@example.test',
  };
  const results = await Promise.all([lifecycle.issue(input), lifecycle.issue(input)]);
  assert.equal(emailCalls.length, 1);
  assert.deepEqual(results.map((result) => result.deliveryStatus).sort(), ['accepted', 'pending']);
});

test('OTP resend resolves the invitation and requires a new explicit key for another dispatch', async () => {
  const emailCalls = [];
  const calls = [];
  const invitationId = `invite_${'a'.repeat(64)}`;
  const durable = repository({
    async resendOtpAndCommit(request) {
      calls.push(structuredClone(request));
      return commandReceipt({
        action: 'faculty.invitation.otp_resend',
        invitationId,
        challengeId: request.challengeId,
        caseRevision: 9,
        invitationRevision: 2,
        invitationExpiresAt: '2026-09-01T12:00:00.000Z',
        challengeExpiresAt: '2026-08-25T12:10:00.000Z',
      });
    },
  });
  const deriver = new HmacFacultyInvitationSecretDeriver({ binding: BINDING, key: KEY });
  const result = await service({
    repository: durable,
    emailPort: genuineEmail(emailCalls),
    secretDeriver: deriver,
  }).resendOtp({
    actor: ACTOR,
    caseId: 'case-1',
    idempotencyKey: 'resend-1',
    recipientEmail: 'writer@example.test',
  });
  assert.equal('invitationId' in calls[0], false);
  assert.equal(calls[0].recipientEmailHash, hashFacultyEmail('writer@example.test'));
  assert.equal(emailCalls[0].invitationToken, deriver.tokenForInvitation(invitationId));
  assert.equal(result.action, 'otp_resent');
  assert.equal(result.invitationRevision, 2);
  const replay = await service({
    repository: durable,
    emailPort: genuineEmail(emailCalls),
    secretDeriver: deriver,
  }).resendOtp({
    actor: ACTOR,
    caseId: 'case-1',
    idempotencyKey: 'resend-1',
    recipientEmail: 'writer@example.test',
  });
  assert.equal(replay.deliveryStatus, 'accepted');
  assert.equal(emailCalls.length, 1);
  await service({
    repository: durable,
    emailPort: genuineEmail(emailCalls),
    secretDeriver: deriver,
  }).resendOtp({
    actor: ACTOR,
    caseId: 'case-1',
    idempotencyKey: 'resend-2',
    recipientEmail: 'writer@example.test',
  });
  assert.equal(emailCalls.length, 2);
});

test('revoke sends no client invitation locator and returns only an opaque reference', async () => {
  const calls = [];
  const invitationId = `invite_${'b'.repeat(64)}`;
  const durable = repository({
    async revokeAndCommit(request) {
      calls.push(structuredClone(request));
      return commandReceipt({
        action: 'faculty.invitation.revoke',
        invitationId,
        caseRevision: 9,
        invitationRevision: 3,
      });
    },
  });
  const result = await service({ repository: durable, emailPort: genuineEmail([]) }).revoke({
    actor: ACTOR,
    caseId: 'case-1',
    idempotencyKey: 'revoke-1',
  });
  assert.equal('invitationId' in calls[0], false);
  assert.equal(result.action, 'revoked');
  assert.equal(result.delivered, false);
  assert.equal(result.invitationRef, sha256(`lor-studio:invitation:${invitationId}`));
});

test('hostile receipts, expired committed windows, and raw-secret provider receipts fail closed', async () => {
  const baseInput = {
    actor: ACTOR,
    caseId: 'case-1',
    expectedRevision: 8,
    idempotencyKey: 'issue-hostile',
    recipientEmail: 'writer@example.test',
  };
  const hostile = repository({
    async issueAndCommit(request) {
      return { ...commandReceipt({
        action: 'faculty.invitation.issue',
        invitationId: request.invitationId,
        challengeId: request.challengeId,
        invitationExpiresAt: '2026-09-01T12:00:00.000Z',
        challengeExpiresAt: '2026-08-25T12:10:00.000Z',
      }), attackerSecret: 'do-not-accept' };
    },
  });
  await assert.rejects(
    () => service({ repository: hostile, emailPort: genuineEmail([]) }).issue(baseInput),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'ATOMIC_COMMAND_RECEIPT_INVALID',
  );

  const expired = repository({
    async issueAndCommit(request) {
      return commandReceipt({
        action: 'faculty.invitation.issue',
        invitationId: request.invitationId,
        challengeId: request.challengeId,
        invitationExpiresAt: '2026-08-25T11:59:59.000Z',
        challengeExpiresAt: '2026-08-25T11:59:58.000Z',
      });
    },
  });
  await assert.rejects(
    () => service({ repository: expired, emailPort: genuineEmail([]) }).issue(baseInput),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'COMMITTED_INVITATION_WINDOW_UNUSABLE',
  );
});
