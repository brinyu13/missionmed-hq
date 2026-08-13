import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AllowlistedOperationalLogger,
  BackupRestoreCheckAdapter,
  DependencyAwareMetadataHealthAdapter,
  OPERATIONAL_READINESS_CONTRACT,
} from '../../lor-studio/adapters/operational-readiness-adapters.mjs';
import {
  PostmarkFacultyInvitationAdapter,
  RecipientBoundOtpAdapter,
} from '../../lor-studio/adapters/faculty-otp-postmark-adapters.mjs';
import { PrivateVersionedStorageAdapter } from '../../lor-studio/adapters/private-versioned-storage-adapter.mjs';
import { ProductionHydrationAdapter } from '../../lor-studio/adapters/production-hydration-adapter.mjs';
import { WordPressEntitlementConsumer } from '../../lor-studio/adapters/wordpress-entitlement-consumer.mjs';
import { createWaiverReceipt } from '../../lor-studio/domain/receipts.js';
import {
  autosaveBuilderStep,
  createRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import { hashValue, sha256 } from '../../lor-studio/domain/value-utils.js';
import {
  ImmutableAdministrativeGrantRepository,
  createAdministrativeGrant,
  validateAdministrativeGrant,
} from '../../lor-studio/repositories/immutable-administrative-grant-repository.mjs';
import { SupabaseDurableRecommendationCaseRepository } from '../../lor-studio/repositories/supabase-durable-recommendation-case-repository.mjs';
import { hashFacultyEmail } from '../../lor-studio/security/faculty-invitations.js';
import { createMetadataServiceEvent } from '../../lor-studio/services/metadata-events.js';
import { RecommendationCaseService } from '../../lor-studio/services/recommendation-case-service.js';

const T0 = new Date('2026-08-09T12:00:00.000Z');

const SUPABASE_BINDING = Object.freeze({
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

const SUPABASE_PRODUCTION_BINDING = Object.freeze({
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

function serverScope(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: 'auth-uid-test-only',
    authenticatedSubject: 'wp:42',
    actorId: 'wp:42',
    actorRole: 'student',
    resourceStudentId: 'wp:42',
    caseId: 'case-1',
    operation: 'read',
    purpose: 'case_workflow',
    ...overrides,
  };
}

const WP_BINDING = Object.freeze({
  independentlyVerified: true,
  liveProducerVerified: true,
  configurationVerified: true,
  courseIdentifiersVerified: true,
  producerContract: 'mmhq_cam_build_entitlement',
});

const OTP_BINDING = Object.freeze({
  providerResourceBound: true,
  independentlyVerified: true,
  durableChallengeStore: true,
  oneTimeConsumption: true,
  invitationBound: true,
  recipientHashBound: true,
  challengeIdBound: true,
  challengeExpiryBound: true,
  challengeRevocationBound: true,
});

const POSTMARK_BINDING = Object.freeze({
  providerResourceBound: true,
  independentlyVerified: true,
  provider: 'postmark',
  senderIdentityVerified: true,
  serverSideCredentials: true,
  invitationOrigin: 'https://example.test',
  invitationRouteTemplate: '/lor-studio/invitations/{invitationId}',
  templateAlias: 'lor-faculty-invitation-v1',
});

const STORAGE_BINDING = Object.freeze({
  providerResourceBound: true,
  independentlyVerified: true,
  bucket: 'lor-writer-depot',
  private: true,
  versioned: true,
  serverMediated: true,
  policyVerified: true,
  storageIdentity: 'storage-test-only',
});

function caseRecord() {
  return createRecommendationCase({
    id: 'case-1',
    studentId: 'wp:42',
    actorId: 'wp:42',
    now: T0,
    idFactory: () => 'case-1-session',
  });
}

function caseCreatedEvent() {
  return createMetadataServiceEvent({
    eventId: 'case-1-created',
    eventType: 'case.created',
    caseId: 'case-1',
    actorId: 'wp:42',
    actorRole: 'student',
    correlationId: 'case-1-create',
    revision: 0,
    occurredAt: T0,
  });
}

function atomicCommand(record = caseRecord()) {
  return {
    operation: 'create',
    record,
    expectedRevision: null,
    idempotencyKey: 'create-case-1',
    requestHash: sha256('create-case-1-request'),
    event: caseCreatedEvent(),
  };
}

function savedCaseRecord({
  studentId = 'wp:42',
  actorId = studentId,
  specialty = 'Internal Medicine',
} = {}) {
  const created = createRecommendationCase({
    id: 'case-1',
    studentId,
    actorId,
    now: T0,
    idFactory: () => `${studentId.replace(':', '-')}-session`,
  });
  return autosaveBuilderStep(created, {
    actorId,
    stepId: 'case_basics',
    stepData: { specialty },
    now: new Date('2026-08-09T12:01:00.000Z'),
  });
}

function atomicSaveCommand(record = savedCaseRecord()) {
  return {
    operation: 'save',
    record,
    expectedRevision: 0,
    idempotencyKey: 'save-case-1-revision-1',
    requestHash: sha256('save-case-1-revision-1-request'),
    event: createMetadataServiceEvent({
      eventId: 'case-1-builder-autosaved',
      eventType: 'builder.autosaved',
      caseId: record.id,
      actorId: 'wp:42',
      actorRole: 'student',
      correlationId: 'case-1-save-revision-1',
      revision: record.revision,
      occurredAt: record.updatedAt,
    }),
  };
}

function atomicCommitReceipt(command, overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.atomic-commit-receipt.v1',
    committed: true,
    stateCommitted: true,
    auditCommitted: true,
    sameTransaction: true,
    operation: command.operation,
    caseId: command.record.id,
    revision: command.record.revision,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    recordHash: hashValue(command.record),
    eventHash: hashValue(command.event),
    auditEventRef: command.event.eventRef,
    authorizationBinding: driverAuthorizationBinding(command.scope),
    transactionId: 'transaction-test-only',
    record: command.record,
    ...overrides,
  };
}

function creationReservationReceipt(command, overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.case-creation-reservation-receipt.v1',
    reserved: true,
    durable: true,
    sameTransaction: true,
    transactionId: 'creation-reservation-transaction-test-only',
    replayed: false,
    creationRef: command.creationRef,
    actorRef: command.actorRef,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    caseId: command.proposedIdentifiers.caseId,
    builderSessionId: command.proposedIdentifiers.builderSessionId,
    createdAt: command.proposedIdentifiers.createdAt,
    authorizationBinding: driverAuthorizationBinding(command.scope),
    ...overrides,
  };
}

function durableDriver(overrides = {}) {
  const record = caseRecord();
  return {
    atomicStateAndAudit: true,
    rlsEnforced: true,
    serverOnly: true,
    async selectCase(command) {
      return {
        found: true,
        authorizationBinding: driverAuthorizationBinding(command.scope),
        record,
      };
    },
    async reserveCaseCreation(command) {
      return creationReservationReceipt(command);
    },
    async executeAtomicCaseCommand(command) {
      return atomicCommitReceipt(command);
    },
    ...overrides,
  };
}

function persistentDurableCreationDriver() {
  const reservations = new Map();
  const records = new Map();
  const commits = new Map();
  let reservationCalls = 0;
  return durableDriver({
    async reserveCaseCreation(command) {
      reservationCalls += 1;
      const prior = reservations.get(command.creationRef);
      if (prior) {
        return creationReservationReceipt(command, {
          ...prior,
          replayed: true,
          authorizationBinding: driverAuthorizationBinding(command.scope),
        });
      }
      const reserved = {
        caseId: command.proposedIdentifiers.caseId,
        builderSessionId: command.proposedIdentifiers.builderSessionId,
        createdAt: command.proposedIdentifiers.createdAt,
        transactionId: `creation-reservation-${reservations.size + 1}`,
      };
      reservations.set(command.creationRef, reserved);
      return creationReservationReceipt(command, reserved);
    },
    async selectCase(command) {
      const record = records.get(command.caseId);
      return record
        ? {
          found: true,
          authorizationBinding: driverAuthorizationBinding(command.scope),
          record,
        }
        : { found: false };
    },
    async executeAtomicCaseCommand(command) {
      const commitKey = `${command.operation}:${command.record.id}:${command.idempotencyKey}`;
      const prior = commits.get(commitKey);
      if (prior) {
        return atomicCommitReceipt(command, {
          transactionId: prior.transactionId,
          record: prior.record,
          recordHash: hashValue(prior.record),
          eventHash: hashValue(prior.event),
          auditEventRef: prior.event.eventRef,
        });
      }
      const stored = {
        transactionId: `case-transaction-${commits.size + 1}`,
        record: structuredClone(command.record),
        event: structuredClone(command.event),
      };
      commits.set(commitKey, stored);
      records.set(command.record.id, stored.record);
      return atomicCommitReceipt(command, { transactionId: stored.transactionId });
    },
    stats() {
      return {
        reservationCalls,
        reservationRows: reservations.size,
        recordRows: records.size,
        commitRows: commits.size,
      };
    },
  });
}

function driverAuthorizationBinding(scope, overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.driver-authorization-binding.v1',
    authUid: scope.authUid,
    authenticatedSubject: scope.authenticatedSubject,
    actorId: scope.actorId,
    actorRole: scope.actorRole,
    resourceStudentId: scope.resourceStudentId,
    caseId: scope.caseId,
    operation: scope.operation,
    purpose: scope.purpose,
    invitationId: scope.invitationId,
    assignmentId: scope.assignmentId,
    administrativeGrantId: scope.administrativeGrantId,
    ...overrides,
  };
}

function validProducer(overrides = {}) {
  return {
    available: true,
    verified: true,
    producerContract: 'mmhq_cam_build_entitlement',
    studentId: 'wp:42',
    evaluatedAt: '2026-08-09T11:59:00.000Z',
    restricted: false,
    revoked: false,
    active: true,
    expiryStatus: 'expires',
    accessExpiresAt: '2026-08-10T12:00:00.000Z',
    purchaseEvidence: {
      valid: true,
      status: 'completed',
      evaluatedAt: '2026-08-09T11:59:00.000Z',
    },
    programTier: 'tier3_360',
    ...overrides,
  };
}

function validAdmission(overrides = {}) {
  return {
    source: 'lor_owned_server_record',
    verified: true,
    studentId: 'wp:42',
    evaluatedAt: '2026-08-09T11:59:00.000Z',
    revoked: false,
    lorEnabled: true,
    canaryEnabled: true,
    canaryConsented: true,
    ...overrides,
  };
}

function otpProviderProof(request, overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.otp-proof.v1',
    verified: true,
    consumed: true,
    principalId: 'faculty-1',
    challengeId: request.challengeId,
    invitationId: request.invitationId,
    recipientEmailHash: request.recipientEmailHash,
    proofId: sha256('otp-provider-proof'),
    verifiedAt: T0.toISOString(),
    expiresAt: '2026-08-09T13:00:00.000Z',
    revoked: false,
    ...overrides,
  };
}

function authenticatedSubjectContext(overrides = {}) {
  return {
    schemaVersion: 'missionmed.authenticated-subject.v1',
    authoritySource: 'validated_hq_session',
    authenticated: true,
    clientAsserted: false,
    subject: 'wp:42',
    ...overrides,
  };
}

function entitlementConsumer(
  producerProjection = validProducer(),
  admission = validAdmission(),
  { subjectContext = authenticatedSubjectContext(), onProducerRead = () => {} } = {},
) {
  return new WordPressEntitlementConsumer({
    binding: WP_BINDING,
    authenticatedSubjectProvider: {
      async getAuthenticatedSubject() { return subjectContext; },
    },
    entitlementProducer: {
      async readVerifiedEntitlement(request) {
        onProducerRead(request);
        return producerProjection;
      },
    },
    lorAdmissionReader: {
      async readAdmission() { return admission; },
    },
    clock: () => T0,
  });
}

test('durable repository constructors fail closed until exact binding, atomicity, RLS, and scope are injected', () => {
  assert.throws(
    () => new SupabaseDurableRecommendationCaseRepository(),
    /integration is unavailable/u,
  );
  assert.throws(
    () => new SupabaseDurableRecommendationCaseRepository({
      binding: SUPABASE_BINDING,
      driver: durableDriver({ atomicStateAndAudit: false }),
      scopeProvider: ({ operation }) => serverScope({ operation }),
    }),
    /integration is unavailable/u,
  );
  assert.throws(
    () => new SupabaseDurableRecommendationCaseRepository({
      binding: SUPABASE_BINDING,
      driver: durableDriver({ reserveCaseCreation: undefined }),
      scopeProvider: ({ operation }) => serverScope({ operation }),
    }),
    /integration is unavailable/u,
  );
  assert.throws(
    () => new SupabaseDurableRecommendationCaseRepository({
      binding: SUPABASE_BINDING,
      driver: durableDriver(),
    }),
    /integration is unavailable/u,
  );
});

test('durable repository accepts only the exact environment-bound staging child or independently bound RankListIQ production main', () => {
  for (const binding of [
    { ...SUPABASE_BINDING, environmentBound: false },
    { ...SUPABASE_BINDING, parentProjectRef: 'different-parent' },
    { ...SUPABASE_BINDING, projectRef: 'fglyvdykwgbuivikqoah' },
    { ...SUPABASE_BINDING, branchId: 'different-child' },
    { ...SUPABASE_BINDING, branchName: 'arbitrary-preview' },
    { ...SUPABASE_PRODUCTION_BINDING, productionDataBindingPassed: false },
    { ...SUPABASE_PRODUCTION_BINDING, branchName: 'lor-staging' },
  ]) {
    assert.throws(
      () => new SupabaseDurableRecommendationCaseRepository({
        binding,
        driver: durableDriver(),
        scopeProvider: ({ operation }) => serverScope({ operation }),
      }),
      /integration is unavailable/u,
    );
  }

  const staging = new SupabaseDurableRecommendationCaseRepository({
    binding: SUPABASE_BINDING,
    driver: durableDriver(),
    scopeProvider: ({ operation }) => serverScope({ operation }),
  });
  assert.equal(staging.describePersistence().environment, 'staging');
  assert.equal(staging.describePersistence().productionEligible, false);
  assert.throws(() => staging.assertProductionReady(), /integration is unavailable/u);

  const production = new SupabaseDurableRecommendationCaseRepository({
    binding: SUPABASE_PRODUCTION_BINDING,
    driver: durableDriver(),
    scopeProvider: ({ operation }) => serverScope({ operation }),
  });
  assert.equal(production.assertProductionReady().environment, 'production');
  assert.equal(production.assertProductionReady().productionEligible, true);
});

test('durable server-only creation reservation survives service restart and cross-instance retries without process-local growth', async () => {
  const driver = persistentDurableCreationDriver();
  const repository = () => new SupabaseDurableRecommendationCaseRepository({
    binding: SUPABASE_BINDING,
    driver,
    scopeProvider: ({ caseId, operation, resourceStudentId = 'wp:42' }) => serverScope({
      caseId,
      operation,
      authUid: 'auth-uid-student-42',
      authenticatedSubject: resourceStudentId,
      actorId: resourceStudentId,
      resourceStudentId,
    }),
  });
  const entitlementPort = {
    async getStudentEntitlement({ studentId }) {
      return {
        studentId,
        active: true,
        tier: 'tier3_360',
        lorEnabled: true,
        revoked: false,
        canaryEnabled: true,
        canaryConsented: true,
        producerStatus: 'VERIFIED_TEST_FIXTURE',
      };
    },
  };
  let firstCaseSequence = 0;
  let firstProtectedSequence = 0;
  let firstClock = T0.valueOf();
  const firstInstance = new RecommendationCaseService({
    repository: repository(),
    entitlementPort,
    clock: () => new Date(firstClock += 1_000),
    caseIdFactory: () => `case_first_${++firstCaseSequence}`,
    protectedIdFactory: () => `first_${++firstProtectedSequence}`,
  });
  let secondCaseSequence = 0;
  let secondProtectedSequence = 0;
  let secondClock = T0.valueOf() + 86_400_000;
  const restartedInstance = new RecommendationCaseService({
    repository: repository(),
    entitlementPort,
    clock: () => new Date(secondClock += 1_000),
    caseIdFactory: () => `case_restarted_${++secondCaseSequence}`,
    protectedIdFactory: () => `restarted_${++secondProtectedSequence}`,
  });
  const request = {
    actor: { id: 'wp:42', role: 'student' },
    idempotencyKey: 'restart-stable-create',
  };
  const created = await firstInstance.createCase(request);
  const afterRestart = await restartedInstance.createCase(request);
  assert.equal(afterRestart.id, created.id);
  assert.equal(afterRestart.builder.sessionId, created.builder.sessionId);
  assert.equal(afterRestart.createdAt, created.createdAt);
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const replay = await (attempt % 2 === 0 ? firstInstance : restartedInstance).createCase(request);
    assert.equal(replay.id, created.id);
  }
  assert.deepEqual(driver.stats(), {
    reservationCalls: 252,
    reservationRows: 1,
    recordRows: 1,
    commitRows: 1,
  });
  for (const service of [firstInstance, restartedInstance]) {
    assert.equal(
      Reflect.ownKeys(service).some((key) => Reflect.get(service, key) instanceof Map),
      false,
      'service instances must not retain idempotency maps',
    );
  }
});

test('durable creation reservation rejects non-atomic, cross-subject, or unbound identifier receipts', async () => {
  const request = {
    actorId: 'wp:42',
    idempotencyKey: 'create-receipt-binding',
    requestHash: sha256('logical-create-request'),
    proposedIdentifiers: {
      caseId: 'case_server_proposed',
      builderSessionId: 'builder_server_proposed',
      createdAt: T0,
    },
  };
  const receiptOverrides = [
    { schemaVersion: 'missionmed.lor.case-creation-reservation-receipt.invalid' },
    { durable: false },
    { sameTransaction: false },
    { transactionId: '' },
    { replayed: 'yes' },
    { creationRef: 'case_creation_unbound' },
    { actorRef: `actor_${sha256('different-actor')}` },
    { idempotencyKey: 'different-idempotency-key' },
    { requestHash: sha256('different-logical-request') },
    { caseId: 'same-identifier', builderSessionId: 'same-identifier' },
    { caseId: 'case_not_the_nonreplay_proposal' },
    { builderSessionId: 'builder_not_the_nonreplay_proposal' },
    { createdAt: '2026-08-09T12:01:00.000Z' },
  ];
  for (const receiptOverride of receiptOverrides) {
    const repository = new SupabaseDurableRecommendationCaseRepository({
      binding: SUPABASE_BINDING,
      driver: durableDriver({
        async reserveCaseCreation(command) {
          return creationReservationReceipt(command, receiptOverride);
        },
      }),
      scopeProvider: ({ caseId, operation, resourceStudentId = 'wp:42' }) => serverScope({
        caseId,
        operation,
        authenticatedSubject: resourceStudentId,
        actorId: resourceStudentId,
        resourceStudentId,
      }),
    });
    await assert.rejects(() => repository.reserveCaseCreation(request), /integration is unavailable/u);
  }
  const crossSubjectRepository = new SupabaseDurableRecommendationCaseRepository({
    binding: SUPABASE_BINDING,
    driver: durableDriver({
      async reserveCaseCreation(command) {
        return creationReservationReceipt(command, {
          authorizationBinding: driverAuthorizationBinding(command.scope, { actorId: 'wp:99' }),
        });
      },
    }),
    scopeProvider: ({ caseId, operation, resourceStudentId = 'wp:42' }) => serverScope({
      caseId,
      operation,
      authenticatedSubject: resourceStudentId,
      actorId: resourceStudentId,
      resourceStudentId,
    }),
  });
  await assert.rejects(
    () => crossSubjectRepository.reserveCaseCreation(request),
    /integration is unavailable/u,
  );
});

test('durable repository binds reads and atomic state-plus-audit writes to the verified RLS request scope', async () => {
  const calls = [];
  const driver = durableDriver({
    async selectCase(command) {
      calls.push({ type: 'read', command });
      return {
        found: true,
        authorizationBinding: driverAuthorizationBinding(command.scope),
        record: caseRecord(),
      };
    },
    async executeAtomicCaseCommand(command) {
      calls.push({ type: 'write', command });
      return atomicCommitReceipt(command, { transactionId: 'transaction-1' });
    },
  });
  const repository = new SupabaseDurableRecommendationCaseRepository({
    binding: SUPABASE_BINDING,
    driver,
    scopeProvider: ({ operation }) => serverScope({ operation }),
  });
  assert.equal(repository.isDurable, true);
  assert.equal(repository.atomicStateAndEvent, true);
  assert.equal((await repository.getById('case-1')).id, 'case-1');
  assert.equal((await repository.commitWithEvent(atomicCommand())).revision, 0);
  assert.equal(calls[0].command.scope.authUid, 'auth-uid-test-only');
  assert.equal(calls[0].command.scope.caseId, 'case-1');
  assert.equal(calls[1].command.event.schemaVersion, 'missionmed.lor.service-event.v1');
  assert.equal(calls[1].command.binding.schema, 'lor_studio');
  assert.equal(calls[1].command.binding.projectRef, 'mftguikkftmrxjxrkdln');
  assert.equal(calls[1].command.binding.parentProjectRef, 'fglyvdykwgbuivikqoah');
});

test('durable repository denies cross-case scope and any receipt that cannot prove one atomic transaction', async () => {
  const crossCase = new SupabaseDurableRecommendationCaseRepository({
    binding: SUPABASE_BINDING,
    driver: durableDriver(),
    scopeProvider: ({ operation }) => serverScope({ caseId: 'case-other', operation }),
  });
  await assert.rejects(() => crossCase.getById('case-1'), /requested case and operation/u);

  const splitReceipt = new SupabaseDurableRecommendationCaseRepository({
    binding: SUPABASE_BINDING,
    driver: durableDriver({
      async executeAtomicCaseCommand(command) {
        return {
          committed: true,
          stateCommitted: true,
          auditCommitted: false,
          sameTransaction: false,
          transactionId: 'split-transaction',
          record: command.record,
        };
      },
    }),
    scopeProvider: ({ operation }) => serverScope({ operation }),
  });
  await assert.rejects(
    () => splitReceipt.commitWithEvent(atomicCommand()),
    /integration is unavailable/u,
  );
  const mismatchedAudit = atomicCommand();
  await assert.rejects(
    () => splitReceipt.commitWithEvent({
      ...mismatchedAudit,
      event: {
        ...mismatchedAudit.event,
        actorRef: `actor_${sha256('different-actor')}`,
      },
    }),
    /bound to the scoped actor/u,
  );
  await assert.rejects(() => splitReceipt.create(caseRecord()), /commitWithEvent/u);
});

test('durable repository rejects create and save commit receipts whose returned record crosses the authorized resource student', async () => {
  const wrongCreateRecord = createRecommendationCase({
    id: 'case-1',
    studentId: 'wp:99',
    actorId: 'wp:99',
    now: T0,
    idFactory: () => 'wrong-student-create-session',
  });
  const cases = [
    { command: atomicCommand(), returnedRecord: wrongCreateRecord },
    {
      command: atomicSaveCommand(),
      returnedRecord: savedCaseRecord({ studentId: 'wp:99' }),
    },
  ];

  for (const { command, returnedRecord } of cases) {
    const repository = new SupabaseDurableRecommendationCaseRepository({
      binding: SUPABASE_BINDING,
      driver: durableDriver({
        async executeAtomicCaseCommand(driverCommand) {
          return atomicCommitReceipt(driverCommand, {
            transactionId: `transaction-wrong-student-${driverCommand.operation}`,
            record: returnedRecord,
          });
        },
      }),
      scopeProvider: ({ operation }) => serverScope({ operation }),
    });
    await assert.rejects(() => repository.commitWithEvent(command), /Access denied/u);
  }
});

test('durable repository cryptographically rejects same-student record tampering and unbound atomic audit receipts', async () => {
  const createCommand = atomicCommand();
  const alternateBuilderRecord = createRecommendationCase({
    id: 'case-1',
    studentId: 'wp:42',
    actorId: 'wp:42',
    now: T0,
    idFactory: () => 'same-student-alternate-builder-session',
  });
  const statusTamperedRecord = {
    ...structuredClone(createCommand.record),
    status: 'cancelled',
  };
  const timestampTamperedRecord = {
    ...structuredClone(createCommand.record),
    updatedAt: '2026-08-09T12:05:00.000Z',
  };
  const saveCommand = atomicSaveCommand();
  const contentTamperedSaveRecord = savedCaseRecord({ specialty: 'Family Medicine' });

  for (const { command, returnedRecord } of [
    { command: createCommand, returnedRecord: alternateBuilderRecord },
    { command: createCommand, returnedRecord: statusTamperedRecord },
    { command: createCommand, returnedRecord: timestampTamperedRecord },
    { command: saveCommand, returnedRecord: contentTamperedSaveRecord },
  ]) {
    const repository = new SupabaseDurableRecommendationCaseRepository({
      binding: SUPABASE_BINDING,
      driver: durableDriver({
        async executeAtomicCaseCommand(driverCommand) {
          return atomicCommitReceipt(driverCommand, { record: returnedRecord });
        },
      }),
      scopeProvider: ({ operation }) => serverScope({ operation }),
    });
    await assert.rejects(() => repository.commitWithEvent(command), /integration is unavailable/u);
  }

  for (const receiptOverride of [
    { schemaVersion: 'missionmed.lor.atomic-commit-receipt.invalid' },
    { operation: 'save' },
    { caseId: 'case-other' },
    { revision: 99 },
    { idempotencyKey: 'different-idempotency-key' },
    { requestHash: sha256('different-request') },
    { recordHash: sha256('different-record') },
    { eventHash: sha256('different-event') },
    { auditEventRef: `event_${sha256('different-audit-event')}` },
  ]) {
    const repository = new SupabaseDurableRecommendationCaseRepository({
      binding: SUPABASE_BINDING,
      driver: durableDriver({
        async executeAtomicCaseCommand(driverCommand) {
          return atomicCommitReceipt(driverCommand, receiptOverride);
        },
      }),
      scopeProvider: ({ operation }) => serverScope({ operation }),
    });
    await assert.rejects(() => repository.commitWithEvent(createCommand), /integration is unavailable/u);
  }
});

test('durable repository rejects mismatched operation, authenticated subject, role, resource subject, and driver authorization binding', async () => {
  for (const scope of [
    serverScope({ operation: 'save' }),
    serverScope({ authenticatedSubject: 'wp:99' }),
    serverScope({ actorRole: 'faculty' }),
    serverScope({ resourceStudentId: 'wp:99' }),
  ]) {
    const repository = new SupabaseDurableRecommendationCaseRepository({
      binding: SUPABASE_BINDING,
      driver: durableDriver(),
      scopeProvider: () => scope,
    });
    await assert.rejects(() => repository.getById('case-1'));
  }

  const wrongDriverRole = new SupabaseDurableRecommendationCaseRepository({
    binding: SUPABASE_BINDING,
    driver: durableDriver({
      async selectCase(command) {
        return {
          found: true,
          authorizationBinding: driverAuthorizationBinding(command.scope, { actorRole: 'faculty' }),
          record: caseRecord(),
        };
      },
    }),
    scopeProvider: ({ operation }) => serverScope({ operation }),
  });
  await assert.rejects(() => wrongDriverRole.getById('case-1'), /integration is unavailable/u);
});

test('durable repository authorization receipts bind purpose and the exact role-specific invitation, assignment, or grant evidence', async () => {
  const roleCases = [
    {
      scope: serverScope({
        authUid: 'faculty-auth',
        authenticatedSubject: 'wp:43',
        actorId: 'wp:43',
        actorRole: 'faculty',
        invitationId: 'invitation-1',
      }),
      evidenceField: 'invitationId',
    },
    {
      scope: serverScope({
        authUid: 'mentor-auth',
        authenticatedSubject: 'wp:44',
        actorId: 'wp:44',
        actorRole: 'mentor',
        assignmentId: 'assignment-1',
      }),
      evidenceField: 'assignmentId',
    },
    {
      scope: serverScope({
        authUid: 'founder-auth',
        authenticatedSubject: 'wp:45',
        actorId: 'wp:45',
        actorRole: 'founder',
        administrativeGrantId: 'grant-1',
      }),
      evidenceField: 'administrativeGrantId',
    },
  ];

  for (const { scope, evidenceField } of roleCases) {
    for (const receiptOverrides of [
      { purpose: undefined },
      { purpose: 'different-purpose' },
      { [evidenceField]: undefined },
      { [evidenceField]: 'different-evidence' },
    ]) {
      const repository = new SupabaseDurableRecommendationCaseRepository({
        binding: SUPABASE_BINDING,
        driver: durableDriver({
          async selectCase(command) {
            return {
              found: true,
              authorizationBinding: driverAuthorizationBinding(command.scope, receiptOverrides),
              record: caseRecord(),
            };
          },
        }),
        scopeProvider: () => scope,
      });
      await assert.rejects(() => repository.getById('case-1'), /integration is unavailable/u);
    }
  }

  const crossRoleEvidence = new SupabaseDurableRecommendationCaseRepository({
    binding: SUPABASE_BINDING,
    driver: durableDriver(),
    scopeProvider: () => serverScope({ invitationId: 'caller-selected-invitation' }),
  });
  await assert.rejects(() => crossRoleEvidence.getById('case-1'), /scope evidence invalid|Access denied/u);
});

test('WordPress entitlement consumer accepts only fresh verified producer evidence plus separate LOR-owned admission', async () => {
  const consumer = entitlementConsumer();
  assert.deepEqual(await consumer.getStudentEntitlement({ studentId: 'wp:42' }), {
    available: true,
    sourceVerified: true,
    studentId: 'wp:42',
    actorId: 'wp:42',
    role: 'student',
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    revoked: false,
    canaryEnabled: true,
    canaryConsented: true,
    producerStatus: 'VERIFIED_SERVER_CONSUMER',
    evaluatedAt: T0.toISOString(),
  });
  await assert.rejects(
    () => consumer.getStudentEntitlement({ studentId: 'wp:42', role: 'admin' }),
    /assertions are forbidden/u,
  );
  await assert.rejects(
    () => consumer.resolve({ subject: 'wp:42', consent: true }),
    /assertions are forbidden/u,
  );
  assert.throws(() => new WordPressEntitlementConsumer(), /integration is unavailable/u);
});

test('WordPress entitlement identity is selected only by the trusted authenticated-subject provider', async () => {
  const producerReads = [];
  const consumer = entitlementConsumer(validProducer(), validAdmission(), {
    onProducerRead: (request) => producerReads.push(request),
  });

  const withoutHint = await consumer.getStudentEntitlement({});
  assert.equal(withoutHint.studentId, 'wp:42');
  assert.equal(producerReads.at(-1).wordpressSubject, 'wp:42');

  const readsBeforeAttacks = producerReads.length;
  await assert.rejects(
    () => consumer.getStudentEntitlement({ studentId: 'wp:99' }),
    /Access denied/u,
  );
  await assert.rejects(
    () => consumer.resolve({ subject: 'wp:99' }),
    /Access denied/u,
  );
  await assert.rejects(
    () => consumer.getStudentEntitlement({ studentId: 'wp:42', subject: 'wp:99' }),
    /Access denied/u,
  );
  assert.equal(producerReads.length, readsBeforeAttacks, 'caller identity hints must never drive a lookup');

  for (const subjectContext of [
    authenticatedSubjectContext({ authenticated: false }),
    authenticatedSubjectContext({ authoritySource: 'caller_request' }),
    authenticatedSubjectContext({ subject: 'wp:99', clientAsserted: true }),
  ]) {
    await assert.rejects(
      () => entitlementConsumer(validProducer(), validAdmission(), { subjectContext })
        .getStudentEntitlement({ studentId: 'wp:42' }),
      /integration is unavailable/u,
    );
  }

  assert.throws(
    () => new WordPressEntitlementConsumer({
      binding: WP_BINDING,
      entitlementProducer: { async readVerifiedEntitlement() {} },
      lorAdmissionReader: { async readAdmission() {} },
    }),
    /integration is unavailable/u,
  );
});

test('WordPress entitlement consumer fails closed for every missing, stale, unverified, inactive, restricted, revoked, expired, and purchase-invalid state', async () => {
  const cases = [
    [null, 'ENTITLEMENT_MISSING'],
    [validProducer({ available: false }), 'ENTITLEMENT_UNAVAILABLE'],
    [validProducer({ verified: false }), 'ENTITLEMENT_UNVERIFIED'],
    [validProducer({ studentId: 'wp:99' }), 'ENTITLEMENT_SUBJECT_MISMATCH'],
    [validProducer({ evaluatedAt: '2026-08-09T11:00:00.000Z' }), 'ENTITLEMENT_STALE'],
    [validProducer({ restricted: undefined }), 'ENTITLEMENT_EVIDENCE_INCOMPLETE'],
    [validProducer({ active: false }), 'ENTITLEMENT_INACTIVE'],
    [validProducer({ restricted: true }), 'ENTITLEMENT_RESTRICTED'],
    [validProducer({ revoked: true }), 'ENTITLEMENT_REVOKED'],
    [validProducer({ accessExpiresAt: '2026-08-09T11:59:59.000Z' }), 'ENTITLEMENT_EXPIRED_OR_UNPROVEN'],
    [validProducer({ purchaseEvidence: { valid: false, status: 'refunded', evaluatedAt: '2026-08-09T11:59:00.000Z' } }), 'ENTITLEMENT_PURCHASE_INVALID'],
  ];
  for (const [projection, reason] of cases) {
    const result = await entitlementConsumer(projection).getStudentEntitlement({ studentId: 'wp:42' });
    assert.equal(result.active, false, reason);
    assert.equal(result.denialReason, reason);
  }
  const noConsent = await entitlementConsumer(validProducer(), validAdmission({ lorEnabled: false })).getStudentEntitlement({ studentId: 'wp:42' });
  assert.equal(noConsent.denialReason, 'LOR_NOT_EXPLICITLY_ENABLED');
});

test('WordPress LOR admission requires every authoritative boolean, including explicit revoked false', async () => {
  for (const admissionOverride of [
    { verified: undefined },
    { verified: 'true' },
    { revoked: undefined },
    { revoked: 'false' },
    { lorEnabled: undefined },
    { lorEnabled: 'true' },
    { canaryEnabled: undefined },
    { canaryEnabled: 'false' },
    { canaryConsented: undefined },
    { canaryConsented: 'false' },
  ]) {
    const result = await entitlementConsumer(
      validProducer(),
      validAdmission(admissionOverride),
    ).getStudentEntitlement({ studentId: 'wp:42' });
    assert.equal(result.active, false);
    assert.equal(result.denialReason, 'LOR_ADMISSION_EVIDENCE_INCOMPLETE');
  }

  const unprovenRevocation = await entitlementConsumer(
    validProducer(),
    validAdmission({ revoked: undefined }),
  ).getStudentEntitlement({ studentId: 'wp:42' });
  assert.equal(unprovenRevocation.revoked, null);
  assert.equal(unprovenRevocation.canaryEnabled, null);
  assert.equal(unprovenRevocation.canaryConsented, null);

  const explicitlyFalseCanary = await entitlementConsumer(
    validProducer(),
    validAdmission({ canaryEnabled: false, canaryConsented: false }),
  ).getStudentEntitlement({ studentId: 'wp:42' });
  assert.equal(explicitlyFalseCanary.active, true);
  assert.equal(explicitlyFalseCanary.canaryEnabled, false);
  assert.equal(explicitlyFalseCanary.canaryConsented, false);

  const revokedAdmission = await entitlementConsumer(
    validProducer(),
    validAdmission({ revoked: true }),
  ).getStudentEntitlement({ studentId: 'wp:42' });
  assert.equal(revokedAdmission.denialReason, 'LOR_ADMISSION_REVOKED');
});

test('OTP proof is one-time, recipient- and invitation-bound and never accepts a caller principal', async () => {
  const recipientEmailHash = hashFacultyEmail('writer@example.test');
  const adapter = new RecipientBoundOtpAdapter({
    binding: OTP_BINDING,
    clock: () => T0,
    challengeRepository: {
      async verifyAndConsumeOnce(request) {
        return otpProviderProof(request);
      },
    },
  });
  const request = {
    challengeId: 'challenge-1',
    code: '123456',
    recipientEmailHash,
    invitationId: 'invitation-1',
  };
  const proof = await adapter.verify(request);
  assert.equal(proof.verified, true);
  assert.equal(proof.principalId, 'faculty-1');
  assert.equal(proof.challengeId, 'challenge-1');
  assert.equal(proof.expiresAt, '2026-08-09T13:00:00.000Z');
  assert.equal(proof.revoked, false);
  await assert.rejects(() => adapter.verify({ ...request, principalId: 'attacker' }), /forbidden fields/u);

  const mismatched = new RecipientBoundOtpAdapter({
    binding: OTP_BINDING,
    clock: () => T0,
    challengeRepository: {
      async verifyAndConsumeOnce(providerRequest) {
        return otpProviderProof(providerRequest, { invitationId: 'other-invitation' });
      },
    },
  });
  await assert.rejects(() => mismatched.verify(request), /integration is unavailable/u);
});

test('OTP proof requires current non-revoked expiry evidence and a trusted clock', async () => {
  const recipientEmailHash = hashFacultyEmail('writer@example.test');
  const request = {
    challengeId: 'challenge-time-bound',
    code: '123456',
    recipientEmailHash,
    invitationId: 'invitation-time-bound',
  };
  const invalidProofOverrides = [
    { challengeId: 'different-challenge' },
    { expiresAt: '2026-08-09T11:59:59.000Z' },
    { revoked: true },
    { verifiedAt: '2026-08-09T12:00:01.000Z' },
    { verifiedAt: '2026-08-09 12:00:00Z' },
    { expiresAt: '2026-08-09 13:00:00Z' },
  ];
  for (const overrides of invalidProofOverrides) {
    const adapter = new RecipientBoundOtpAdapter({
      binding: OTP_BINDING,
      clock: () => T0,
      challengeRepository: {
        async verifyAndConsumeOnce(providerRequest) {
          return otpProviderProof(providerRequest, overrides);
        },
      },
    });
    await assert.rejects(() => adapter.verify(request), (error) => {
      assert.equal(error.code, 'INTEGRATION_DISABLED');
      assert.equal(error.details.status, 'BOUND_PROVIDER_PROOF_INVALID');
      return true;
    });
  }

  assert.throws(
    () => new RecipientBoundOtpAdapter({
      binding: OTP_BINDING,
      challengeRepository: { async verifyAndConsumeOnce() {} },
    }),
    /integration is unavailable/u,
  );
  assert.throws(
    () => new RecipientBoundOtpAdapter({
      binding: { ...OTP_BINDING, challengeRevocationBound: false },
      clock: () => T0,
      challengeRepository: { async verifyAndConsumeOnce() {} },
    }),
    /integration is unavailable/u,
  );
});

test('OTP store failures and attacker-selected request keys produce only fixed generic adapter errors', async () => {
  const recipientEmailHash = hashFacultyEmail('writer@example.test');
  const request = {
    challengeId: 'challenge-error-boundary',
    code: '123456',
    recipientEmailHash,
    invitationId: 'invitation-error-boundary',
  };
  const adapter = new RecipientBoundOtpAdapter({
    binding: OTP_BINDING,
    clock: () => T0,
    challengeRepository: {
      async verifyAndConsumeOnce() {
        throw new Error('STORE_SECRET challenge-error-boundary 123456');
      },
    },
  });
  await assert.rejects(() => adapter.verify(request), (error) => {
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    assert.deepEqual(error.details, {
      integration: 'lor_otp',
      status: 'OTP_PROVIDER_UNAVAILABLE',
    });
    assert.doesNotMatch(`${error.message} ${JSON.stringify(error.details)}`, /STORE_SECRET|123456/u);
    return true;
  });

  const attackerKey = 'attacker_secret_challenge_key';
  await assert.rejects(() => adapter.verify({ ...request, [attackerKey]: 'do-not-echo' }), (error) => {
    assert.equal(error.code, 'VALIDATION_FAILED');
    assert.equal(error.details, undefined);
    assert.doesNotMatch(error.message, new RegExp(attackerKey, 'u'));
    assert.doesNotMatch(error.message, /do-not-echo/u);
    return true;
  });
});

test('Postmark adapter requires a verified binding and returns only a recipient/invitation-bound metadata receipt', async () => {
  const recipientEmail = 'writer@example.test';
  const recipientEmailHash = hashFacultyEmail(recipientEmail);
  let sent;
  const adapter = new PostmarkFacultyInvitationAdapter({
    binding: POSTMARK_BINDING,
    clock: () => T0,
    transport: {
      async sendBoundInvitation(request) {
        sent = request;
        return {
          accepted: true,
          invitationId: request.invitationId,
          recipientEmailHash: request.recipientEmailHash,
          invitationPath: new URL(request.invitationUrl).pathname,
          templateAlias: request.templateAlias,
          messageId: 'provider-message-1',
          acceptedAt: T0.toISOString(),
        };
      },
    },
  });
  const receipt = await adapter.sendFacultyInvitation({
    invitationId: 'invitation-1',
    recipientEmail,
    recipientEmailHash,
    invitationUrl: 'https://example.test/lor-studio/invitations/invitation-1',
    expiresAt: '2026-08-09T13:00:00.000Z',
    templateAlias: 'lor-faculty-invitation-v1',
  });
  assert.equal(sent.protectedLetterContent, null);
  assert.equal(receipt.recipientAndInvitationBound, true);
  assert.doesNotMatch(JSON.stringify(receipt), /writer@example\.test|invitation-1|provider-message-1/u);
  for (const requestOverride of [
    { invitationUrl: 'https://example.test/lor-studio/invitations/invitation-1?token=secret' },
    { invitationUrl: 'https://example.test/other/invitation-1' },
    { templateAlias: 'unbound-template' },
  ]) {
    await assert.rejects(
      () => adapter.sendFacultyInvitation({
        invitationId: 'invitation-1',
        recipientEmail,
        recipientEmailHash,
        invitationUrl: 'https://example.test/lor-studio/invitations/invitation-1',
        expiresAt: '2026-08-09T13:00:00.000Z',
        templateAlias: 'lor-faculty-invitation-v1',
        ...requestOverride,
      }),
      /exact verified invitation route|template alias/u,
    );
  }
  const unboundProviderProof = new PostmarkFacultyInvitationAdapter({
    binding: POSTMARK_BINDING,
    clock: () => T0,
    transport: {
      async sendBoundInvitation(request) {
        return {
          accepted: true,
          invitationId: request.invitationId,
          recipientEmailHash: request.recipientEmailHash,
          invitationPath: new URL(request.invitationUrl).pathname,
          templateAlias: 'wrong-template',
          messageId: 'provider-message-2',
          acceptedAt: T0.toISOString(),
        };
      },
    },
  });
  await assert.rejects(
    () => unboundProviderProof.sendFacultyInvitation({
      invitationId: 'invitation-1',
      recipientEmail,
      recipientEmailHash,
      invitationUrl: 'https://example.test/lor-studio/invitations/invitation-1',
      expiresAt: '2026-08-09T13:00:00.000Z',
      templateAlias: 'lor-faculty-invitation-v1',
    }),
    /integration is unavailable/u,
  );
  assert.throws(
    () => new PostmarkFacultyInvitationAdapter({ binding: POSTMARK_BINDING, transport: {} }),
    /integration is unavailable/u,
  );
});

test('Postmark transport failures and attacker-selected request keys produce only fixed generic adapter errors', async () => {
  const recipientEmail = 'writer@example.test';
  const recipientEmailHash = hashFacultyEmail(recipientEmail);
  const request = {
    invitationId: 'invitation-error-boundary',
    recipientEmail,
    recipientEmailHash,
    invitationUrl: 'https://example.test/lor-studio/invitations/invitation-error-boundary',
    expiresAt: '2026-08-09T13:00:00.000Z',
    templateAlias: 'lor-faculty-invitation-v1',
  };
  const adapter = new PostmarkFacultyInvitationAdapter({
    binding: POSTMARK_BINDING,
    clock: () => T0,
    transport: {
      async sendBoundInvitation() {
        throw new Error('POSTMARK_SECRET writer@example.test invitation-error-boundary');
      },
    },
  });
  await assert.rejects(() => adapter.sendFacultyInvitation(request), (error) => {
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    assert.deepEqual(error.details, {
      integration: 'postmark',
      status: 'DELIVERY_TRANSPORT_UNAVAILABLE',
    });
    assert.doesNotMatch(
      `${error.message} ${JSON.stringify(error.details)}`,
      /POSTMARK_SECRET|writer@example\.test|invitation-error-boundary/u,
    );
    return true;
  });

  const attackerKey = 'attacker_secret_transport_key';
  await assert.rejects(
    () => adapter.sendFacultyInvitation({ ...request, [attackerKey]: 'do-not-echo' }),
    (error) => {
      assert.equal(error.code, 'VALIDATION_FAILED');
      assert.equal(error.details, undefined);
      assert.doesNotMatch(error.message, new RegExp(attackerKey, 'u'));
      assert.doesNotMatch(error.message, /do-not-echo/u);
      return true;
    },
  );
});

function storageObjectKey(request) {
  return `cases/${request.caseId}/${request.contentClass}/${request.objectId}`;
}

function facultyStorageCapability(request, overrides = {}) {
  const base = {
    schemaVersion: 'missionmed.lor.storage-capability.v1',
    authoritySource: 'trusted_server_capability_provider',
    authorized: true,
    capabilityId: `faculty-capability-${request.operation}-${request.objectId}`,
    evidenceId: 'invitation-1',
    actorId: 'faculty-1',
    actorRole: 'faculty',
    caseId: request.caseId,
    objectId: request.objectId,
    objectKey: storageObjectKey(request),
    versionId: request.versionId ?? null,
    operation: request.operation,
    purpose: request.purpose,
    contentClass: request.contentClass,
    invitationId: 'invitation-1',
    issuedAt: '2026-08-09T11:00:00.000Z',
    expiresAt: '2026-08-09T13:00:00.000Z',
    revokedAt: null,
    invitationProof: {
      schemaVersion: 'missionmed.lor.faculty-invitation-capability.v1',
      verified: true,
      invitationId: 'invitation-1',
      facultyId: 'faculty-1',
      caseId: request.caseId,
      operation: request.operation,
      purpose: request.purpose,
      issuedAt: '2026-08-09T11:00:00.000Z',
      expiresAt: '2026-08-09T13:00:00.000Z',
      revokedAt: null,
    },
  };
  return {
    ...base,
    ...overrides,
    invitationProof: {
      ...base.invitationProof,
      ...(overrides.invitationProof || {}),
    },
  };
}

function studentStorageCapability(request, overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.storage-capability.v1',
    authoritySource: 'trusted_server_capability_provider',
    authorized: true,
    capabilityId: `student-capability-${request.operation}-${request.objectId}`,
    evidenceId: `student-evidence-${request.objectId}`,
    actorId: 'wp:42',
    actorRole: 'student',
    studentId: 'wp:42',
    caseId: request.caseId,
    objectId: request.objectId,
    objectKey: storageObjectKey(request),
    versionId: request.versionId ?? null,
    operation: request.operation,
    purpose: request.purpose,
    contentClass: request.contentClass,
    issuedAt: '2026-08-09T11:00:00.000Z',
    expiresAt: '2026-08-09T13:00:00.000Z',
    revokedAt: null,
    ...overrides,
  };
}

function privateStorageAdapter(driver, resolveStorageCapability = (request) => facultyStorageCapability(request)) {
  return new PrivateVersionedStorageAdapter({
    binding: STORAGE_BINDING,
    driver,
    capabilityProvider: { resolveStorageCapability },
    clock: () => T0,
  });
}

function storageDriverReceipt(request, {
  versionId = request.versionId ?? 'version-1',
  checksum = request.checksum,
  receiptId = `${request.capability.operation}-receipt-1`,
  ...overrides
} = {}) {
  return {
    private: true,
    versionImmutable: true,
    policyChecked: true,
    storageIdentity: request.binding.storageIdentity,
    bucket: request.binding.bucket,
    caseId: request.caseId,
    objectId: request.objectId,
    objectKey: request.capability.objectKey,
    contentClass: request.capability.contentClass,
    purpose: request.capability.purpose,
    operation: request.capability.operation,
    capabilityId: request.capability.capabilityId,
    evidenceId: request.capability.evidenceId,
    versionId,
    checksum,
    receiptId,
    occurredAt: T0.toISOString(),
    ...overrides,
  };
}

test('private storage uses a trusted capability provider, immutable versions, policy receipts, and no public locator', async () => {
  const content = Buffer.from('faculty-private-fixture');
  const checksum = sha256(content);
  const driver = {
    privateOnly: true,
    immutableVersions: true,
    serverOnly: true,
    async putImmutable(request) {
      return storageDriverReceipt(request, { receiptId: 'put-receipt-1' });
    },
    async getImmutable(request) {
      return {
        ...storageDriverReceipt(request, { checksum, receiptId: 'get-receipt-1' }),
        content,
      };
    },
  };
  const adapter = privateStorageAdapter(driver);
  const putReceipt = await adapter.put({
    caseId: 'case-1',
    objectId: 'object-1',
    contentClass: 'faculty_private',
    purpose: 'faculty_review',
    content,
    contentType: 'text/plain',
    checksum,
    idempotencyKey: 'put-object-1',
  });
  assert.equal(putReceipt.private, true);
  assert.equal(putReceipt.immutableVersion, true);
  assert.equal('url' in putReceipt, false);
  const loaded = await adapter.get({
    caseId: 'case-1',
    objectId: 'object-1',
    versionId: 'version-1',
    contentClass: 'faculty_private',
    purpose: 'faculty_review',
  });
  assert.equal(loaded.content.toString('utf8'), 'faculty-private-fixture');
  assert.equal(loaded.receipt.operation, 'get');

  const studentAdapter = privateStorageAdapter(
    driver,
    (request) => studentStorageCapability(request),
  );
  await assert.rejects(
    () => studentAdapter.get({
      caseId: 'case-1',
      objectId: 'object-1',
      versionId: 'version-1',
      contentClass: 'faculty_private',
      purpose: 'faculty_review',
    }),
    /Access denied/u,
  );
  await assert.rejects(
    () => studentAdapter.get({
      caseId: 'case-1',
      objectId: 'object-1',
      versionId: 'version-1',
      contentClass: 'structural_waiver_material',
      purpose: 'privacy_request',
    }),
    /Access denied/u,
  );
  await assert.rejects(
    () => adapter.get({
      caseId: 'case-1',
      objectId: 'object-1',
      versionId: 'version-1',
      contentClass: 'faculty_private',
      purpose: 'faculty_review',
      scope: { authorized: true },
    }),
    /forbidden fields/u,
  );
});

test('private storage rejects invitation and administrative capabilities with mismatched case, actor, operation, purpose, expiry, or revocation', async () => {
  const driver = {
    privateOnly: true,
    immutableVersions: true,
    serverOnly: true,
    async putImmutable() { throw new Error('must not run'); },
    async getImmutable() { throw new Error('must not run'); },
  };
  const request = {
    caseId: 'case-1',
    objectId: 'object-1',
    versionId: 'version-1',
    contentClass: 'faculty_private',
    purpose: 'faculty_review',
  };
  const invitationMismatches = [
    { versionId: 'other-version' },
    { objectKey: 'cases/case-other/faculty_private/object-1' },
    { invitationProof: { caseId: 'case-other' } },
    { invitationProof: { facultyId: 'faculty-other' } },
    { invitationProof: { operation: 'put' } },
    { invitationProof: { purpose: 'privacy_request' } },
    { invitationProof: { expiresAt: '2026-08-09T11:59:59.000Z' } },
    { invitationProof: { revokedAt: '2026-08-09T11:30:00.000Z' } },
    { invitationProof: { revokedAt: undefined } },
  ];
  for (const mismatch of invitationMismatches) {
    const adapter = privateStorageAdapter(
      driver,
      (capabilityRequest) => facultyStorageCapability(capabilityRequest, mismatch),
    );
    await assert.rejects(() => adapter.get(request), /Access denied/u);
  }

  const administrativeCapability = (capabilityRequest, grantOverrides = {}) => ({
    schemaVersion: 'missionmed.lor.storage-capability.v1',
    authoritySource: 'trusted_server_capability_provider',
    authorized: true,
    capabilityId: `administrative-capability-${capabilityRequest.operation}-${capabilityRequest.objectId}`,
    evidenceId: 'grant-1',
    actorId: 'service:privacy-reviewer',
    actorRole: 'service',
    caseId: capabilityRequest.caseId,
    objectId: capabilityRequest.objectId,
    objectKey: storageObjectKey(capabilityRequest),
    versionId: capabilityRequest.versionId ?? null,
    operation: capabilityRequest.operation,
    purpose: capabilityRequest.purpose,
    contentClass: capabilityRequest.contentClass,
    administrativeGrantId: 'grant-1',
    issuedAt: '2026-08-09T11:00:00.000Z',
    expiresAt: '2026-08-09T13:00:00.000Z',
    revokedAt: null,
    administrativeGrant: {
      schemaVersion: 'missionmed.lor.administrative-grant-capability.v1',
      verified: true,
      grantId: 'grant-1',
      granteeId: 'service:privacy-reviewer',
      caseId: capabilityRequest.caseId,
      operation: capabilityRequest.operation,
      purpose: capabilityRequest.purpose,
      issuedAt: '2026-08-09T11:00:00.000Z',
      expiresAt: '2026-08-09T13:00:00.000Z',
      revokedAt: null,
      ...grantOverrides,
    },
  });
  for (const mismatch of [
    { caseId: 'case-other' },
    { granteeId: 'service:other' },
    { operation: 'put' },
    { purpose: 'restore_rehearsal' },
    { expiresAt: '2026-08-09T11:59:59.000Z' },
    { revokedAt: '2026-08-09T11:30:00.000Z' },
    { revokedAt: undefined },
  ]) {
    const adapter = privateStorageAdapter(
      driver,
      (capabilityRequest) => administrativeCapability(capabilityRequest, mismatch),
    );
    await assert.rejects(() => adapter.get(request), /Access denied/u);
  }
});

test('private storage rejects public URLs and mismatched immutable version receipts', async () => {
  const content = Buffer.from('fixture');
  const checksum = sha256(content);
  const driver = {
    privateOnly: true,
    immutableVersions: true,
    serverOnly: true,
    async putImmutable() { throw new Error('unused'); },
    async getImmutable() {
      return {
        private: true,
        versionImmutable: true,
        policyChecked: true,
        versionId: 'other-version',
        checksum,
        receiptId: 'receipt-1',
        occurredAt: T0.toISOString(),
        content,
        publicUrl: 'https://public.invalid/object',
      };
    },
  };
  const adapter = privateStorageAdapter(driver);
  await assert.rejects(
    () => adapter.get({
      caseId: 'case-1',
      objectId: 'object-1',
      versionId: 'version-1',
      contentClass: 'faculty_private',
      purpose: 'faculty_review',
    }),
    /may not return object URLs/u,
  );
});

test('private storage rejects any put or get receipt not exactly bound to storage, resource, capability, version, and checksum', async () => {
  const content = Buffer.from('receipt-binding-fixture');
  const checksum = sha256(content);
  const mismatches = [
    { storageIdentity: 'storage-other' },
    { bucket: 'public-bucket' },
    { caseId: 'case-other' },
    { objectId: 'object-other' },
    { objectKey: 'cases/case-other/faculty_private/object-other' },
    { contentClass: 'student_prepared' },
    { purpose: 'privacy_request' },
    { operation: 'different-operation' },
    { capabilityId: 'capability-other' },
    { evidenceId: 'evidence-other' },
    { checksum: sha256('different-content') },
  ];

  for (const operation of ['put', 'get']) {
    for (const mismatch of mismatches) {
      const driver = {
        privateOnly: true,
        immutableVersions: true,
        serverOnly: true,
        async putImmutable(driverRequest) {
          return storageDriverReceipt(driverRequest, mismatch);
        },
        async getImmutable(driverRequest) {
          return {
            ...storageDriverReceipt(driverRequest, { checksum, ...mismatch }),
            content,
          };
        },
      };
      const adapter = privateStorageAdapter(driver);
      if (operation === 'put') {
        await assert.rejects(
          () => adapter.put({
            caseId: 'case-1',
            objectId: 'object-1',
            contentClass: 'faculty_private',
            purpose: 'faculty_review',
            content,
            contentType: 'text/plain',
            checksum,
            idempotencyKey: 'put-object-1',
          }),
          /integration is unavailable/u,
        );
      } else {
        await assert.rejects(
          () => adapter.get({
            caseId: 'case-1',
            objectId: 'object-1',
            versionId: 'version-1',
            contentClass: 'faculty_private',
            purpose: 'faculty_review',
          }),
          /integration is unavailable/u,
        );
      }
    }
  }

  const wrongVersionDriver = {
    privateOnly: true,
    immutableVersions: true,
    serverOnly: true,
    async putImmutable() { throw new Error('unused'); },
    async getImmutable(driverRequest) {
      return {
        ...storageDriverReceipt(driverRequest, { versionId: 'version-other', checksum }),
        content,
      };
    },
  };
  await assert.rejects(
    () => privateStorageAdapter(wrongVersionDriver).get({
      caseId: 'case-1',
      objectId: 'object-1',
      versionId: 'version-1',
      contentClass: 'faculty_private',
      purpose: 'faculty_review',
    }),
    /integration is unavailable/u,
  );
});

test('administrative grants are immutable, case/operation/purpose/authority/audit-bound, expiring, and append-only revocable', async () => {
  const records = new Map();
  const revocations = new Map();
  const driver = {
    appendOnly: true,
    async appendGrant(grant) {
      records.set(grant.grantId, structuredClone(grant));
      return { appended: true, auditBound: true, immutable: true, grant };
    },
    async appendRevocation(revocation) {
      revocations.set(revocation.grantId, structuredClone(revocation));
      return { appended: true, auditBound: true, immutable: true, revocation };
    },
    async readGrantWithRevocation({ grantId }) {
      return { grant: records.get(grantId), revocation: revocations.get(grantId) ?? null };
    },
  };
  const binding = {
    providerResourceBound: true,
    independentlyVerified: true,
    appendOnly: true,
    auditBound: true,
    revocationLedger: true,
  };
  const grant = createAdministrativeGrant({
    grantId: 'grant-1',
    granteeId: 'privacy-reviewer-1',
    caseId: 'case-1',
    operation: 'read_case_content_for_privacy_request',
    purpose: 'investigate-subject-request',
    privacyAuthority: 'privacy-authority:founder-approved-case-review',
    issuedAt: '2026-08-09T11:00:00.000Z',
    expiresAt: '2026-08-09T13:00:00.000Z',
    auditEventRef: sha256('grant-audit-event'),
  });
  assert.equal(validateAdministrativeGrant(grant), true);
  const repository = new ImmutableAdministrativeGrantRepository({ binding, driver, clock: () => T0 });
  await repository.create(grant);
  const active = await repository.getActiveGrant({
    grantId: 'grant-1',
    granteeId: 'privacy-reviewer-1',
    caseId: 'case-1',
    operation: 'read_case_content_for_privacy_request',
    purpose: 'investigate-subject-request',
  });
  assert.equal(active.grantHash, grant.grantHash);
  await assert.rejects(
    () => repository.getActiveGrant({
      grantId: 'grant-1',
      granteeId: 'privacy-reviewer-1',
      caseId: 'case-other',
      operation: 'read_case_content_for_privacy_request',
      purpose: 'investigate-subject-request',
    }),
    /Access denied/u,
  );
  await repository.revoke({
    grantId: 'grant-1',
    revokedByAuthority: 'privacy-authority:founder-approved-case-review',
    reasonCode: 'AUTHORITY_REVOKED',
    auditEventRef: sha256('grant-revocation-audit-event'),
  });
  await assert.rejects(
    () => repository.getActiveGrant({
      grantId: 'grant-1',
      granteeId: 'privacy-reviewer-1',
      caseId: 'case-1',
      operation: 'read_case_content_for_privacy_request',
      purpose: 'investigate-subject-request',
    }),
    /Access denied/u,
  );
});

function healthDependencies(overrides = {}) {
  return Object.fromEntries(OPERATIONAL_READINESS_CONTRACT.dependencies.map((name) => [
    name,
    overrides[name] ?? { async probe() { return { state: 'ready', errorCode: '' }; } },
  ]));
}

test('health is dependency-aware and metadata-only, with feature-off and kill-switch truth preserved', async () => {
  const ready = new DependencyAwareMetadataHealthAdapter({
    dependencies: healthDependencies(),
    flags: { enabled: true, killSwitch: false, requireCanary: true },
    clock: () => T0,
  });
  const readySnapshot = await ready.snapshot();
  assert.equal(readySnapshot.status, 'ready');
  assert.equal(readySnapshot.productionOperational, true);

  const blocked = new DependencyAwareMetadataHealthAdapter({
    dependencies: healthDependencies({
      storage: {
        async probe() {
          return { state: 'unavailable', errorCode: 'POLICY_UNVERIFIED', email: 'protected@example.test' };
        },
      },
    }),
    flags: { enabled: true, killSwitch: false, requireCanary: true },
    clock: () => T0,
  });
  const blockedSnapshot = await blocked.snapshot();
  assert.equal(blockedSnapshot.status, 'blocked');
  assert.equal(blockedSnapshot.dependencies.storage.errorCode, 'DEPENDENCY_POLICY_UNVERIFIED');
  assert.doesNotMatch(JSON.stringify(blockedSnapshot), /protected@example\.test/u);

  const arbitraryProviderCode = new DependencyAwareMetadataHealthAdapter({
    dependencies: healthDependencies({
      email: {
        async probe() {
          return { state: 'unavailable', errorCode: 'TOKEN_ABC123' };
        },
      },
    }),
    flags: { enabled: true, killSwitch: false, requireCanary: true },
    clock: () => T0,
  });
  const mappedSnapshot = await arbitraryProviderCode.snapshot();
  assert.equal(mappedSnapshot.dependencies.email.errorCode, 'DEPENDENCY_FAILURE');
  assert.doesNotMatch(JSON.stringify(mappedSnapshot), /TOKEN_ABC123/u);

  const featureOff = new DependencyAwareMetadataHealthAdapter({
    dependencies: healthDependencies(),
    flags: { enabled: false, killSwitch: true, requireCanary: true },
    clock: () => T0,
  });
  assert.equal((await featureOff.snapshot()).status, 'closed');
});

test('health accepts both explicit canary modes and denies missing or nonboolean requireCanary state', async () => {
  for (const requireCanary of [true, false]) {
    const health = new DependencyAwareMetadataHealthAdapter({
      dependencies: healthDependencies(),
      flags: { enabled: true, killSwitch: false, requireCanary },
      clock: () => T0,
    });
    const snapshot = await health.snapshot();
    assert.equal(snapshot.status, 'ready');
    assert.equal(snapshot.reason, 'all_dependencies_ready');
    assert.equal(snapshot.productionOperational, true);
  }

  const invalidFlagVariants = [
    { enabled: true, killSwitch: false },
    { enabled: true, killSwitch: false, requireCanary: 'true' },
    { enabled: true, killSwitch: false, requireCanary: 1 },
    { enabled: true, killSwitch: false, requireCanary: null },
  ];
  for (const flags of invalidFlagVariants) {
    const health = new DependencyAwareMetadataHealthAdapter({
      dependencies: healthDependencies(),
      flags,
      clock: () => T0,
    });
    const snapshot = await health.snapshot();
    assert.equal(snapshot.status, 'blocked');
    assert.equal(snapshot.reason, 'canary_configuration_invalid');
    assert.equal(snapshot.productionOperational, false);
  }
});

test('operational logger accepts only allowlisted metadata and hashes all case/correlation references', async () => {
  const events = [];
  const logger = new AllowlistedOperationalLogger({
    sink: {
      async writeMetadataEvent(event) {
        events.push(event);
        return { accepted: true, metadataOnly: true };
      },
    },
    clock: () => T0,
  });
  const event = await logger.log({
    eventType: 'transaction.commit',
    outcome: 'success',
    correlationId: 'correlation-raw',
    caseId: 'case-raw',
    metadata: { operation: 'case_create', result: 'committed' },
  });
  assert.equal(events.length, 1);
  assert.doesNotMatch(JSON.stringify(event), /correlation-raw|case-raw/u);
  await assert.rejects(
    () => logger.log({
      eventType: 'transaction.commit',
      outcome: 'success',
      correlationId: 'correlation-raw',
      metadata: { email: 'protected@example.test' },
    }),
    /not allowlisted/u,
  );
  await assert.rejects(
    () => logger.log({
      eventType: 'transaction.commit',
      outcome: 'success',
      correlationId: 'correlation-raw',
      metadata: { operation: 'arbitrary_regex_safe_value' },
    }),
    /finite enum/u,
  );
});

test('backup/restore adapter describes and runs only synthetic metadata checks across database, audit, RLS, Storage versions, and rollback', async () => {
  const checks = [];
  const adapter = new BackupRestoreCheckAdapter({
    binding: {
      providerResourceBound: true,
      independentlyVerified: true,
      syntheticOnly: true,
      isolatedRestoreTarget: true,
      databaseAndAuditTogether: true,
      storageVersionManifest: true,
    },
    checker: {
      async runCheck(request) {
        checks.push(request);
        return { passed: true, errorCode: '' };
      },
    },
    clock: () => T0,
  });
  const plan = adapter.describePlan();
  assert.equal(plan.protectedContentPermitted, false);
  assert.equal(plan.checks.includes('case_and_audit_atomic_restore'), true);
  assert.equal(plan.checks.includes('object_version_manifest_checksums'), true);
  const result = await adapter.runSyntheticRehearsal();
  assert.equal(result.passed, true);
  assert.equal(checks.every((check) => check.syntheticOnly && check.metadataOnly), true);

  const unknownCode = new BackupRestoreCheckAdapter({
    binding: {
      providerResourceBound: true,
      independentlyVerified: true,
      syntheticOnly: true,
      isolatedRestoreTarget: true,
      databaseAndAuditTogether: true,
      storageVersionManifest: true,
    },
    checker: {
      async runCheck() { return { passed: false, errorCode: 'TOKEN_ABC123' }; },
    },
    clock: () => T0,
  });
  const unknownResult = await unknownCode.runSyntheticRehearsal();
  assert.equal(unknownResult.passed, false);
  assert.equal(unknownResult.results.every((entry) => entry.errorCode === 'CHECK_FAILED'), true);
  assert.doesNotMatch(JSON.stringify(unknownResult), /TOKEN_ABC123/u);
  assert.throws(() => new BackupRestoreCheckAdapter(), /integration is unavailable/u);
});

function liveHealth() {
  return {
    schemaVersion: 'missionmed.lor.dependency-health.v1',
    status: 'ready',
    productionOperational: true,
    dependencies: Object.fromEntries(
      OPERATIONAL_READINESS_CONTRACT.dependencies.map((name) => [name, { state: 'ready', errorCode: '' }]),
    ),
  };
}

const HYDRATION_NOW = new Date('2026-08-09T13:00:00.000Z');
const HYDRATION_CLOCK = () => HYDRATION_NOW;

const HYDRATION_SCHEMAS = Object.freeze({
  admin: 'missionmed.lor.operational-projection.v1',
  faculty: 'missionmed.lor.faculty-projection.v1',
  founder: 'missionmed.lor.operational-projection.v1',
  mentor: 'missionmed.lor.mentor-projection.v1',
  service: 'missionmed.lor.service-projection.v1',
  student: 'missionmed.lor.student-projection.v1',
  support: 'missionmed.lor.operational-projection.v1',
});

function liveBootstrap(overrides = {}) {
  const actorRole = overrides.actorRole ?? 'student';
  return {
    operational: true,
    runtimeMode: 'live',
    storageMode: 'durable',
    providersReady: true,
    allDependenciesReady: true,
    fixtureBacked: false,
    authenticated: true,
    authorizationSource: 'server_verified_session_crosswalk',
    actorId: actorRole === 'service' ? 'service:hydration' : `wp:${{
      student: 42,
      faculty: 43,
      mentor: 44,
    }[actorRole] ?? 45}`,
    actorRole,
    caseId: 'case-1',
    projectionSchema: HYDRATION_SCHEMAS[actorRole],
    ...overrides,
  };
}

function validHydrationProjection(binding) {
  const common = {
    schemaVersion: binding.projectionSchema,
    caseId: binding.caseId,
  };
  if (binding.actorRole === 'student') {
    return {
      ...common,
      revision: 1,
      status: 'draft',
      builder: {
        sessionId: 'builder-session-1',
        totalSteps: 8,
        completedStepIds: [],
        currentStepId: 'case_basics',
        stepData: {},
        autosavedAt: null,
      },
      studentEvidence: [],
      applicantOptions: [],
      consentReceipts: [],
      waiverReceipts: [],
      delivery: { status: 'not_started', destinationClass: null, deliveredAt: null },
      finalDocument: null,
    };
  }
  if (binding.actorRole === 'faculty') {
    return {
      ...common,
      revision: 1,
      status: 'faculty_review',
      studentShared: {
        evidence: [],
        applicantOptions: [],
        consentReceipts: [],
        waiverState: { decided: false, waived: null, receiptId: null },
      },
      facultyPrivate: { answers: [], notes: [], draftText: null, finalDocument: null },
      delivery: { status: 'not_started', destinationClass: null, deliveredAt: null },
    };
  }
  if (binding.actorRole === 'mentor') {
    return {
      ...common,
      status: 'draft',
      strategyStatus: 'not_started',
      nextMilestone: 'complete_builder',
      deliveryStatus: 'not_started',
    };
  }
  if (binding.actorRole === 'service') {
    return {
      ...common,
      status: 'draft',
      revision: 1,
      grantedPurpose: 'case_workflow',
    };
  }
  return {
    ...common,
    status: 'draft',
    revision: 1,
    createdAt: T0.toISOString(),
    updatedAt: T0.toISOString(),
    closedAt: null,
    builderProgress: {
      sessionId: 'builder-session-1',
      completedSteps: 0,
      totalSteps: 8,
      percent: 0,
      nextStepId: 'case_basics',
      autosavedAt: null,
    },
    deliveryStatus: 'not_started',
  };
}

function hydrationEnvelope(binding, overrides = {}) {
  const envelope = {
    schemaVersion: 'missionmed.lor.hydration-envelope.v1',
    authorizationSource: 'server_authorization_policy',
    actorId: binding.actorId,
    actorRole: binding.actorRole,
    caseId: binding.caseId,
    projectionSchema: binding.projectionSchema,
    projection: validHydrationProjection(binding),
  };
  return {
    ...envelope,
    ...overrides,
    projection: {
      ...envelope.projection,
      ...(overrides.projection || {}),
    },
  };
}

function hydrationUi() {
  const calls = { blocked: [], rendered: [] };
  return {
    presentationIsolation: 'production_projection_only',
    usesLocalStorage: false,
    canRevealPrototype: false,
    calls,
    async block(request) { calls.blocked.push(request); },
    async renderProductionProjection(projection, options) { calls.rendered.push({ projection, options }); },
  };
}

test('production hydration never reveals the synthetic/localStorage prototype before bootstrap, every dependency, and durable projection are ready', async () => {
  const unavailableUi = hydrationUi();
  const unavailable = new ProductionHydrationAdapter({
    bootstrapLoader: {
      source: 'protected_lor_bootstrap',
      fixtureBacked: false,
      async load() { return { operational: false }; },
    },
    dependencyHealth: { metadataOnly: true, async snapshot() { throw new Error('must not run'); } },
    projectionLoader: {
      source: 'durable_repository',
      fixtureBacked: false,
      async loadProductionProjection() { throw new Error('must not run'); },
    },
    clock: HYDRATION_CLOCK,
    ui: unavailableUi,
  });
  const blocked = await unavailable.hydrate({ caseId: 'case-1' });
  assert.equal(blocked.hydrated, false);
  assert.equal(blocked.fixtureRevealed, false);
  assert.equal(unavailableUi.calls.rendered.length, 0);
  assert.equal(unavailableUi.calls.blocked.every((call) => call.revealPrototype === false), true);

  const liveUi = hydrationUi();
  const live = new ProductionHydrationAdapter({
    bootstrapLoader: {
      source: 'protected_lor_bootstrap',
      fixtureBacked: false,
      async load() { return liveBootstrap(); },
    },
    dependencyHealth: { metadataOnly: true, async snapshot() { return liveHealth(); } },
    projectionLoader: {
      source: 'durable_repository',
      fixtureBacked: false,
      async loadProductionProjection(binding) { return hydrationEnvelope(binding); },
    },
    clock: HYDRATION_CLOCK,
    ui: liveUi,
  });
  const hydrated = await live.hydrate({ caseId: 'case-1' });
  assert.equal(hydrated.hydrated, true);
  assert.equal(hydrated.localStorageUsed, false);
  assert.equal(liveUi.calls.rendered.length, 1);
  assert.deepEqual(liveUi.calls.rendered[0].options, {
    runtimeMode: 'live',
    actorRole: 'student',
    projectionSchema: 'missionmed.lor.student-projection.v1',
    revealPrototype: false,
    persistToLocalStorage: false,
  });
});

test('production hydration rejects a fixture-marked payload and an adapter that can use localStorage or reveal the prototype', async () => {
  const ui = hydrationUi();
  const adapter = new ProductionHydrationAdapter({
    bootstrapLoader: {
      source: 'protected_lor_bootstrap',
      fixtureBacked: false,
      async load() { return liveBootstrap(); },
    },
    dependencyHealth: { metadataOnly: true, async snapshot() { return liveHealth(); } },
    projectionLoader: {
      source: 'durable_repository',
      fixtureBacked: false,
      async loadProductionProjection(binding) {
        return hydrationEnvelope(binding, { projection: { syntheticData: { unsafe: true } } });
      },
    },
    clock: HYDRATION_CLOCK,
    ui,
  });
  assert.equal((await adapter.hydrate({ caseId: 'case-1' })).hydrated, false);
  assert.equal(ui.calls.rendered.length, 0);
  assert.throws(
    () => new ProductionHydrationAdapter({
      bootstrapLoader: {
        source: 'protected_lor_bootstrap',
        fixtureBacked: false,
        async load() { return liveBootstrap(); },
      },
      dependencyHealth: { metadataOnly: true, async snapshot() { return liveHealth(); } },
      projectionLoader: {
        source: 'durable_repository',
        fixtureBacked: false,
        async loadProductionProjection(binding) { return hydrationEnvelope(binding); },
      },
      ui: hydrationUi(),
    }),
    /integration is unavailable/u,
  );
  assert.throws(
    () => new ProductionHydrationAdapter({
      bootstrapLoader: {
        source: 'protected_lor_bootstrap',
        fixtureBacked: false,
        async load() {},
      },
      dependencyHealth: { metadataOnly: true, async snapshot() {} },
      projectionLoader: {
        source: 'durable_repository',
        fixtureBacked: false,
        async loadProductionProjection() {},
      },
      clock: HYDRATION_CLOCK,
      ui: {
        presentationIsolation: 'production_projection_only',
        usesLocalStorage: true,
        canRevealPrototype: true,
        async block() {},
        async renderProductionProjection() {},
      },
    }),
    /integration is unavailable/u,
  );
});

test('production hydration rejects actor, role, case, and projection-schema mismatches for student, faculty, mentor, and service', async () => {
  for (const actorRole of ['student', 'faculty', 'mentor', 'service']) {
    const bootstrap = liveBootstrap({ actorRole });
    const wrongSchema = actorRole === 'student'
      ? HYDRATION_SCHEMAS.faculty
      : HYDRATION_SCHEMAS.student;
    const bootstrapMismatchUi = hydrationUi();
    const bootstrapMismatch = new ProductionHydrationAdapter({
      bootstrapLoader: {
        source: 'protected_lor_bootstrap',
        fixtureBacked: false,
        async load() { return { ...bootstrap, projectionSchema: wrongSchema }; },
      },
      dependencyHealth: { metadataOnly: true, async snapshot() { return liveHealth(); } },
      projectionLoader: {
        source: 'durable_repository',
        fixtureBacked: false,
        async loadProductionProjection() { throw new Error('must not run'); },
      },
      clock: HYDRATION_CLOCK,
      ui: bootstrapMismatchUi,
    });
    assert.equal((await bootstrapMismatch.hydrate({ caseId: 'case-1' })).hydrated, false);
    assert.equal(bootstrapMismatchUi.calls.rendered.length, 0);

    const mismatches = [
      { actorId: `${bootstrap.actorId}-other` },
      { actorRole: actorRole === 'student' ? 'faculty' : 'student' },
      { caseId: 'case-other', projection: { caseId: 'case-other' } },
      { projectionSchema: wrongSchema, projection: { schemaVersion: wrongSchema } },
    ];
    for (const mismatch of mismatches) {
      const ui = hydrationUi();
      const adapter = new ProductionHydrationAdapter({
        bootstrapLoader: {
          source: 'protected_lor_bootstrap',
          fixtureBacked: false,
          async load() { return bootstrap; },
        },
        dependencyHealth: { metadataOnly: true, async snapshot() { return liveHealth(); } },
        projectionLoader: {
          source: 'durable_repository',
          fixtureBacked: false,
          async loadProductionProjection(binding) { return hydrationEnvelope(binding, mismatch); },
        },
        clock: HYDRATION_CLOCK,
        ui,
      });
      assert.equal((await adapter.hydrate({ caseId: 'case-1' })).hydrated, false);
      assert.equal(ui.calls.rendered.length, 0);
    }
  }
});

test('production hydration enforces exact role projection privacy shapes and blocks cross-role or unreleased letter content', async () => {
  const adversarialProjections = [
    {
      actorRole: 'student',
      mutate: (projection) => ({
        ...projection,
        facultyPrivate: { draftText: 'PRIVATE FACULTY LETTER' },
      }),
    },
    {
      actorRole: 'student',
      mutate: (projection) => ({
        ...projection,
        studentEvidence: [{ facultyDraftText: 'NESTED PRIVATE FACULTY DRAFT' }],
      }),
    },
    {
      actorRole: 'student',
      mutate: (projection) => ({
        ...projection,
        studentEvidence: [{ structural_waiver_material: { text: 'WAIVER-PRIVATE' } }],
      }),
    },
    {
      actorRole: 'student',
      mutate: (projection) => ({
        ...projection,
        applicantOptions: [{ serviceGrant: { grantedPurpose: 'cross-role' } }],
      }),
    },
    {
      actorRole: 'student',
      mutate: (projection) => ({
        ...projection,
        builder: {
          ...projection.builder,
          stepData: { consent_and_waiver: { waiverPrivateLetter: 'PRIVATE LETTER' } },
        },
      }),
    },
    {
      actorRole: 'student',
      mutate: (projection) => ({
        ...projection,
        waiver: { privateLetter: 'CALLER-SMUGGLED LETTER' },
      }),
    },
    {
      actorRole: 'student',
      mutate: (projection) => ({
        ...projection,
        waiverReceipts: [createWaiverReceipt({
          id: 'other-student-waiver',
          caseId: 'case-1',
          studentId: 'wp:99',
          waived: true,
          policyVersion: 'policy-v1',
          acknowledgment: 'OTHER STUDENT WAIVER CONTENT',
          recordedAt: T0,
        })],
      }),
    },
    {
      actorRole: 'student',
      mutate: (projection) => ({
        ...projection,
        finalDocument: {
          id: 'document-unreleased',
          text: 'UNRELEASED PRIVATE LETTER',
          contentHash: null,
          mimeType: 'text/plain',
          releasedToStudentAt: null,
        },
      }),
    },
    {
      actorRole: 'faculty',
      mutate: (projection) => ({ ...projection, grantedPurpose: 'service_only' }),
    },
    {
      actorRole: 'faculty',
      mutate: (projection) => ({
        ...projection,
        studentShared: {
          ...projection.studentShared,
          evidence: [{ administrativeGrantId: 'nested-cross-role-grant' }],
        },
      }),
    },
    {
      actorRole: 'mentor',
      mutate: (projection) => ({ ...projection, facultyPrivate: { notes: ['PRIVATE'] } }),
    },
    {
      actorRole: 'mentor',
      mutate: (projection) => ({
        ...projection,
        nextMilestone: { facultyPrivate: { draftText: 'NESTED PRIVATE' } },
      }),
    },
    {
      actorRole: 'admin',
      mutate: (projection) => ({ ...projection, studentEvidence: [{ text: 'CONTENT' }] }),
    },
    {
      actorRole: 'admin',
      mutate: (projection) => ({
        ...projection,
        builderProgress: {
          ...projection.builderProgress,
          sessionId: { facultyPrivate: { draftText: 'NESTED PRIVATE' } },
        },
      }),
    },
    {
      actorRole: 'service',
      mutate: (projection) => ({ ...projection, privateLetter: 'CONTENT' }),
    },
    {
      actorRole: 'service',
      mutate: (projection) => ({
        ...projection,
        grantedPurpose: [{ facultyDraftText: 'NESTED PRIVATE' }],
      }),
    },
  ];

  for (const { actorRole, mutate } of adversarialProjections) {
    const bootstrap = liveBootstrap({ actorRole });
    const ui = hydrationUi();
    const adapter = new ProductionHydrationAdapter({
      bootstrapLoader: {
        source: 'protected_lor_bootstrap',
        fixtureBacked: false,
        async load() { return bootstrap; },
      },
      dependencyHealth: { metadataOnly: true, async snapshot() { return liveHealth(); } },
      projectionLoader: {
        source: 'durable_repository',
        fixtureBacked: false,
        async loadProductionProjection(binding) {
          return hydrationEnvelope(binding, { projection: mutate(validHydrationProjection(binding)) });
        },
      },
      clock: HYDRATION_CLOCK,
      ui,
    });
    assert.equal((await adapter.hydrate({ caseId: 'case-1' })).hydrated, false, actorRole);
    assert.equal(ui.calls.rendered.length, 0, actorRole);
  }
});

test('production hydration accepts each canonical role shape and only an explicitly released non-waived student document', async () => {
  for (const actorRole of ['student', 'faculty', 'mentor', 'admin', 'founder', 'support', 'service']) {
    const bootstrap = liveBootstrap({ actorRole });
    const ui = hydrationUi();
    const adapter = new ProductionHydrationAdapter({
      bootstrapLoader: {
        source: 'protected_lor_bootstrap',
        fixtureBacked: false,
        async load() { return bootstrap; },
      },
      dependencyHealth: { metadataOnly: true, async snapshot() { return liveHealth(); } },
      projectionLoader: {
        source: 'durable_repository',
        fixtureBacked: false,
        async loadProductionProjection(binding) { return hydrationEnvelope(binding); },
      },
      clock: HYDRATION_CLOCK,
      ui,
    });
    assert.equal((await adapter.hydrate({ caseId: 'case-1' })).hydrated, true, actorRole);
    assert.equal(ui.calls.rendered.length, 1, actorRole);
  }

  const bootstrap = liveBootstrap();
  const waiverReceipt = createWaiverReceipt({
    id: 'waiver-1',
    caseId: 'case-1',
    studentId: 'wp:42',
    waived: false,
    policyVersion: 'policy-v1',
    acknowledgment: 'I do not waive access.',
    recordedAt: T0,
  });
  const ui = hydrationUi();
  const releasedDocumentAdapter = new ProductionHydrationAdapter({
    bootstrapLoader: {
      source: 'protected_lor_bootstrap',
      fixtureBacked: false,
      async load() { return bootstrap; },
    },
    dependencyHealth: { metadataOnly: true, async snapshot() { return liveHealth(); } },
    projectionLoader: {
      source: 'durable_repository',
      fixtureBacked: false,
      async loadProductionProjection(binding) {
        return hydrationEnvelope(binding, {
          projection: {
            waiverReceipts: [waiverReceipt],
            finalDocument: {
              id: 'document-released',
              text: 'RELEASED STUDENT LETTER',
              contentHash: null,
              mimeType: 'text/plain',
              releasedToStudentAt: '2026-08-09T12:01:00.000Z',
            },
          },
        });
      },
    },
    clock: HYDRATION_CLOCK,
    ui,
  });
  assert.equal((await releasedDocumentAdapter.hydrate({ caseId: 'case-1' })).hydrated, true);
  assert.equal(ui.calls.rendered[0].projection.finalDocument.text, 'RELEASED STUDENT LETTER');
});

test('production hydration rejects future, non-canonical, or pre-waiver student release timestamps against the trusted clock', async () => {
  const bootstrap = liveBootstrap();
  const waiverReceipt = createWaiverReceipt({
    id: 'waiver-time-bound',
    caseId: 'case-1',
    studentId: 'wp:42',
    waived: false,
    policyVersion: 'policy-v1',
    acknowledgment: 'I do not waive access.',
    recordedAt: T0,
  });

  for (const releasedToStudentAt of [
    '2099-01-01T00:00:00.000Z',
    '2026-08-09 12:01:00Z',
    '2026-08-09T11:59:59.000Z',
  ]) {
    const ui = hydrationUi();
    const adapter = new ProductionHydrationAdapter({
      bootstrapLoader: {
        source: 'protected_lor_bootstrap',
        fixtureBacked: false,
        async load() { return bootstrap; },
      },
      dependencyHealth: { metadataOnly: true, async snapshot() { return liveHealth(); } },
      projectionLoader: {
        source: 'durable_repository',
        fixtureBacked: false,
        async loadProductionProjection(binding) {
          return hydrationEnvelope(binding, {
            projection: {
              waiverReceipts: [waiverReceipt],
              finalDocument: {
                id: 'document-time-invalid',
                text: 'MUST NOT RENDER',
                contentHash: null,
                mimeType: 'text/plain',
                releasedToStudentAt,
              },
            },
          });
        },
      },
      clock: HYDRATION_CLOCK,
      ui,
    });
    assert.equal((await adapter.hydrate({ caseId: 'case-1' })).hydrated, false);
    assert.equal(ui.calls.rendered.length, 0);
  }
});
