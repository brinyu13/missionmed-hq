/**
 * PRODUCTION COMPOSITION INTEGRATION TESTS.
 *
 * These exist because of a specific historical failure: every other suite in this directory
 * builds its own runtime, so all 116 original tests would have stayed green if the production
 * mount in server.mjs had been deleted outright. It WAS effectively deleted - the mount omitted
 * the `application` option, so `application` defaulted to null and every /api/lor-studio/*
 * request returned 503 while the suite reported a healthy product.
 *
 * Every test below drives the REAL createLorStudioRuntime through its REAL handle() entry point,
 * with the application produced by the REAL composition root. The suite closes with a source
 * guard asserting server.mjs actually passes `application`, and a negative control proving these
 * tests genuinely fail when the composition root is removed.
 *
 * The AI DRAFTING section applies the identical standard to DR-119 clause 8. The grounding engine
 * and the drafting service were both implemented and both covered by direct unit tests, and both
 * were unreachable through the mounted product: the HTTP adapter deliberately auto-constructs
 * nothing for drafting, so an application composed without an `aiDraftingService` answered every
 * /ai-proposals request with 503 INTEGRATION_DISABLED while the suite reported clause 8 as
 * covered. Those tests drive the whole path - HTTP, runtime, adapter, drafting service,
 * server-resolved approved facts, provider abstraction, grounding validation, store, response -
 * and are paired with a negative control that goes red the moment the wiring is removed.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

import {
  createLorStudioShutdownCoordinator,
  createLorStudioApplication,
  createReadinessGatedLorStudioApplication,
  readLorTargetConfiguration,
  LOR_COMPOSITION_REASONS,
  LOR_TARGET_ENV_KEYS,
} from '../../lor-studio/composition.mjs';
import {
  LOR_TARGET_BINDING_SCHEMA,
  LOR_TARGET_IDENTITY_FIELDS,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  PRODUCTION_DEPENDENCY_RECEIPT_SCHEMA,
  PRODUCTION_OPERATIONAL_READINESS_CONTRACT,
  productionOperationalReadinessTargetRef,
} from '../../lor-studio/adapters/production-operational-readiness.mjs';
import { PrivateVersionedStorageAdapter } from '../../lor-studio/adapters/private-versioned-storage-adapter.mjs';
import { PostmarkFacultyInvitationAdapter } from '../../lor-studio/adapters/faculty-otp-postmark-adapters.mjs';
import { PostmarkFacultyInvitationTransport } from '../../lor-studio/adapters/postmark-faculty-invitation-transport.mjs';
import { createLorStudioRuntime } from '../../lor-studio/http/runtime.mjs';
import { InMemoryRecommendationCaseRepository } from '../../lor-studio/repositories/in-memory-recommendation-case-repository.js';
import {
  MetadataOnlyEventBuffer,
  StaticEntitlementTestAdapter,
} from '../../lor-studio/adapters/test-adapters.js';
import { createLorApplicationAdapter } from '../../lor-studio/http/application-adapter.mjs';
import { RecommendationCaseService } from '../../lor-studio/services/recommendation-case-service.js';
import {
  AI_DRAFT_TEMPLATE_VERSION,
  AI_PROPOSAL_RECORD_SCHEMA,
  aiProposalAlreadyDecided,
} from '../../lor-studio/services/ai-proposal-service.js';
import { ENTAILMENT_STATUS, GROUNDING_MODEL_VERSION } from '../../lor-studio/domain/claim-validator.js';
import { IdempotencyConflictError, NotFoundError } from '../../lor-studio/domain/errors.js';
import { createConsentReceipt } from '../../lor-studio/domain/receipts.js';
import {
  BUILDER_STEPS,
  appendReceipt,
  autosaveBuilderStep,
  bindFacultyInvitation,
  bindVerifiedFaculty,
  completeBuilderStep,
  createRecommendationCase,
  setStudentPreparedMaterial,
  transitionRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';

const RANKLISTIQ_PRODUCTION_PROJECT_REF = 'fglyvdykwgbuivikqoah';
const HISTORICAL_NO_TOUCH_BRANCH_ID = 'mftguikkftmrxjxrkdln';

function authenticTestFacultyEmailPort() {
  const invitationOrigin = 'https://lor.example.test';
  const transport = new PostmarkFacultyInvitationTransport({
    binding: {
      schemaVersion: 'missionmed.lor.postmark-transport-binding.v1',
      provider: 'postmark',
      providerResourceBound: true,
      independentlyVerified: true,
      serverId: 'postmark-composition-test',
      senderIdentityVerified: true,
      templateVerified: true,
      fromEmail: 'lor@example.test',
      replyToEmail: '',
      invitationOrigin,
      invitationRouteTemplate: '/lor-studio/invitations/{invitationId}',
      templateAlias: 'lor-faculty-invitation-v1',
      messageStream: 'outbound',
    },
    credentialProvider: {
      serverOnly: true,
      async getServerToken() { return 'test-only-postmark-token'; },
    },
    fetchImplementation: async () => { throw new Error('unexpected provider call'); },
    clock: () => new Date('2026-08-25T12:00:00.000Z'),
  });
  return new PostmarkFacultyInvitationAdapter({
    binding: {
      providerResourceBound: true,
      independentlyVerified: true,
      provider: 'postmark',
      senderIdentityVerified: true,
      serverSideCredentials: true,
      invitationOrigin,
      invitationRouteTemplate: '/lor-studio/invitations/{invitationId}',
      templateAlias: 'lor-faculty-invitation-v1',
    },
    transport,
    clock: () => new Date('2026-08-25T12:00:00.000Z'),
  });
}

/** An explicit, ratified, NON-denied test target. There is no default target by design. */
function testTargetConfiguration(overrides = {}) {
  return {
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'test',
    provider: 'railway-postgres',
    projectId: 'lor-composition-test-project',
    environmentId: 'lor-composition-test-environment',
    serviceId: 'lor-composition-test-service',
    databaseName: 'railway',
    region: 'us-west2',
    schema: 'lor_studio',
    migrationLedger: 'lor-composition-test-ledger',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: false,
    ...overrides,
  };
}

function eligibleStudent(studentId) {
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
}

function actorSafeDriver() {
  return {
    atomicStateAndAudit: true,
    rlsEnforced: true,
    serverOnly: true,
    actorSafeCommands: true,
    databaseClock: true,
    appendOnlyArtifactAudit: true,
    async selectCase() {},
    async readStudentSafeCase() {},
    async readFacultyCaseProjection() {},
    async readFacultyDraftingContext() {},
    async readMentorCaseProjection() {},
    async reserveCaseCreation() {},
    async commitStudentCaseCreate() {},
    async commitStudentBuilderAutosave() {},
    async commitStudentBuilderComplete() {},
    async commitStudentConsentReceipt() {},
    async commitStudentWaiverReceipt() {},
    async commitStudentEvidencePublication() {},
    async commitFacultyFinalDocumentRelease() {},
    async appendArtifactExportAuditAtomic() {},
    async executeAtomicCaseCommand() {},
  };
}

function fullProductDriver() {
  return {
    ...actorSafeDriver(),
    databaseClock: true,
    actorSafeReads: true,
    atomicProviderCallReservation: true,
    atomicProviderRunAndProposal: true,
    conditionalAtomicOneDecision: true,
    atomicFacultyInvitationCommands: true,
    async reserveAiProposalGenerationAtomic() {},
    async markAiProposalGenerationUnknownAtomic() {},
    async persistProviderRunAndProposalAtomic() {},
    async readActorSafeAiProposal() {},
    async attachDecisionIfUndecidedAtomic() {},
    async issueFacultyInvitationAtomic() {},
    async resendFacultyInvitationOtpAtomic() {},
    async revokeFacultyInvitationAtomic() {},
    async reserveFacultyInvitationDeliveryAtomic() {},
    async markFacultyInvitationDeliveryUnknownAtomic() {},
    async commitFacultyInvitationDeliveryAtomic() {},
    async verifyFacultyInvitationAtomic() {},
  };
}

/**
 * The runtime's entitlement contract is FLAT - evaluateLorEntitlement reads `available`,
 * `sourceVerified`, `revoked`, `active`, `tier`, `lorEnabled`, `studentId` and `actorId` off the
 * resolved object itself, and then requires actorId to equal the authenticated subject.
 */
function resolverFor(subject) {
  return {
    async resolve() {
      return {
        available: true,
        sourceVerified: true,
        revoked: false,
        active: true,
        tier: 'tier3_360',
        lorEnabled: true,
        canaryEnabled: true,
        canaryConsented: true,
        studentId: subject,
        actorId: subject,
      };
    },
  };
}

/**
 * The AI proposal store contract, in memory.
 *
 * `putProposal` and `attachDecision` are CONDITIONAL ATOMIC WRITES, and both conditions are
 * enforced INSIDE the write here rather than by the caller - a read-then-write in the service
 * would let two concurrent decisions both observe a null decision and both commit.
 */
class InMemoryAiProposalStore {
  constructor() {
    this.isDurable = false;
    this.durability = 'NON_DURABLE_TEST_ONLY';
    this.records = new Map();
    this.idempotency = new Map();
    this.writes = [];
  }

  static key(caseId, id) {
    return `${caseId} ${id}`;
  }

  #replay(caseId, idempotencyKey, requestHash) {
    const reserved = this.idempotency.get(InMemoryAiProposalStore.key(caseId, idempotencyKey));
    if (!reserved) return null;
    if (reserved.requestHash !== requestHash) throw new IdempotencyConflictError({ idempotencyKey });
    return { record: structuredClone(this.records.get(InMemoryAiProposalStore.key(caseId, reserved.proposalId))), replayed: true };
  }

  #reserve(caseId, idempotencyKey, requestHash, proposalId) {
    this.idempotency.set(InMemoryAiProposalStore.key(caseId, idempotencyKey), {
      requestHash, proposalId, status: 'accepted',
    });
  }

  async reserveProposalGeneration({ caseId, idempotencyKey, requestHash }) {
    const key = InMemoryAiProposalStore.key(caseId, idempotencyKey);
    const existing = this.idempotency.get(key);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new IdempotencyConflictError({ idempotencyKey });
      return {
        status: existing.status,
        providerCallAuthorized: false,
        replayed: true,
        record: existing.proposalId
          ? structuredClone(this.records.get(InMemoryAiProposalStore.key(caseId, existing.proposalId)))
          : null,
      };
    }
    this.idempotency.set(key, { requestHash, proposalId: null, status: 'pending' });
    return { status: 'pending', providerCallAuthorized: true, replayed: false, record: null };
  }

  async finalizeProposalGeneration({ caseId, idempotencyKey, requestHash, record }) {
    if (record.decision !== null || record.acceptedContent !== null) {
      throw new Error('A stored AI proposal may not arrive already decided');
    }
    const key = InMemoryAiProposalStore.key(caseId, idempotencyKey);
    const reserved = this.idempotency.get(key);
    if (!reserved || reserved.status === 'unknown') throw new Error('AI generation is not pending');
    if (reserved.requestHash !== requestHash) throw new IdempotencyConflictError({ idempotencyKey });
    if (reserved.status === 'accepted') return this.#replay(caseId, idempotencyKey, requestHash);
    this.idempotency.set(key, { requestHash, proposalId: record.id, status: 'accepted' });
    this.records.set(InMemoryAiProposalStore.key(caseId, record.id), structuredClone(record));
    this.writes.push({ operation: 'put', caseId, proposalId: record.id });
    return { record: structuredClone(record), replayed: false };
  }

  async putProposal(request) {
    return this.finalizeProposalGeneration(request);
  }

  async markProposalGenerationUnknown({ caseId, idempotencyKey, requestHash }) {
    const key = InMemoryAiProposalStore.key(caseId, idempotencyKey);
    const reserved = this.idempotency.get(key);
    if (!reserved) throw new Error('AI generation reservation is absent');
    if (reserved.requestHash !== requestHash) throw new IdempotencyConflictError({ idempotencyKey });
    if (reserved.status === 'accepted') {
      return {
        status: 'accepted', providerCallAuthorized: false, replayed: true,
        record: structuredClone(this.records.get(InMemoryAiProposalStore.key(caseId, reserved.proposalId))),
      };
    }
    reserved.status = 'unknown';
    return { status: 'unknown', providerCallAuthorized: false, replayed: false, record: null };
  }

  async getProposal({ caseId, proposalId }) {
    const stored = this.records.get(InMemoryAiProposalStore.key(caseId, proposalId));
    return stored ? structuredClone(stored) : null;
  }

  async attachDecision({ caseId, proposalId, idempotencyKey, requestHash, record }) {
    const replay = this.#replay(caseId, idempotencyKey, requestHash);
    if (replay) return replay;
    const key = InMemoryAiProposalStore.key(caseId, proposalId);
    const stored = this.records.get(key);
    if (!stored) throw new NotFoundError('ai_proposal', proposalId);
    if (stored.decision !== null) throw aiProposalAlreadyDecided(proposalId);
    this.#reserve(caseId, idempotencyKey, requestHash, proposalId);
    this.records.set(key, structuredClone(record));
    this.writes.push({ operation: 'decide', caseId, proposalId });
    return { record: structuredClone(record), replayed: false };
  }
}

/** Composes an application exactly as server.mjs does, differing only in injected test ports. */
function composeTestApplication() {
  return createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
    testRepository: new InMemoryRecommendationCaseRepository(),
    eventSink: new MetadataOnlyEventBuffer(),
    aiProposalStore: new InMemoryAiProposalStore(),
    allowNonDurableForTests: true,
  });
}

function freshSession(now = Date.now()) {
  return {
    user: { id: 'wp:1', role: 'student' },
    issuedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 30 * 60_000).toISOString(),
    csrfToken: 'test-csrf-token',
  };
}

/** Minimal ServerResponse capturing what the runtime actually wrote. */
function captureResponse() {
  const chunks = [];
  return {
    statusCode: null,
    headers: null,
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(chunk) { if (chunk) chunks.push(chunk); },
    write(chunk) { if (chunk) chunks.push(chunk); },
    get body() {
      const raw = Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(String(c))))).toString('utf8');
      try { return JSON.parse(raw); } catch { return raw; }
    },
  };
}

function apiRequest(method = 'GET', body = null, headers = {}) {
  const stream = Readable.from(body === null ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.headers = {
    ...(body === null ? {} : { 'content-type': 'application/json' }),
    ...headers,
  };
  return stream;
}

/**
 * Drive the REAL runtime through its REAL handle() entry point, exactly as server.mjs does.
 * Note the third argument is a genuine URL - server.mjs previously passed a synthetic
 * { pathname, searchParams } literal here, which no test would have caught.
 */
async function callRuntime(runtime, pathname, {
  method = 'GET',
  body = null,
  session = freshSession(),
  key = '',
} = {}) {
  const response = captureResponse();
  const url = new URL(pathname, 'https://hq.example.test');
  const headers = key ? { 'idempotency-key': key } : {};
  const handled = await runtime.handle(apiRequest(method, body, headers), response, url, { session });
  return { handled, status: response.statusCode, body: response.body };
}

function runtimeWith(application) {
  return createLorStudioRuntime({
    publicDirectory: '/tmp/lor-studio-composition-test',
    flags: { enabled: true, killSwitch: false, requireCanary: false },
    entitlementResolver: resolverFor('wp:1'),
    application,
    validateCsrf: () => true,
  });
}

// ---------------------------------------------------------------------------
// Composition root behaviour
// ---------------------------------------------------------------------------

test('composition fails closed when no target is configured', () => {
  const composed = createLorStudioApplication({ targetConfiguration: null, entitlementPort: null });
  assert.equal(composed.application, null);
  assert.equal(composed.reason, LOR_COMPOSITION_REASONS.TARGET_NOT_CONFIGURED);
});

test('environment reader exposes only the exact provider-neutral v2 configuration', () => {
  assert.equal(readLorTargetConfiguration({}), null);
  assert.deepEqual(Object.keys(LOR_TARGET_ENV_KEYS), Object.keys(testTargetConfiguration()));

  const expected = testTargetConfiguration({
    environment: 'staging',
    projectId: '29afe885-b9b1-425d-8fd8-8611cd275409',
    environmentId: 'f5705d38-393c-4176-9cc2-0d1dbad42c93',
    serviceId: 'b49a52e7-df15-4417-b67a-a64403aa5db7',
  });
  const env = Object.fromEntries(Object.entries(LOR_TARGET_ENV_KEYS).map(([key, envKey]) => [
    envKey,
    typeof expected[key] === 'boolean' ? String(expected[key]) : expected[key],
  ]));
  assert.deepEqual(readLorTargetConfiguration(env), expected);

  // Presence of any one key is a partial configuration, never an implicit
  // disabled state or a trigger for defaults from another identity field.
  const partial = readLorTargetConfiguration({ [LOR_TARGET_ENV_KEYS.region]: '' });
  assert.ok(partial);
  assert.equal(partial.region, '');
  assert.equal(partial.projectId, undefined);
  assert.equal(createLorStudioApplication({
    targetConfiguration: partial,
    entitlementPort: new StaticEntitlementTestAdapter([]),
  }).reason, LOR_COMPOSITION_REASONS.TARGET_REJECTED);
});

test('composition fails closed for the denied RankListIQ production project and no-touch branch', () => {
  for (const [index, field] of LOR_TARGET_IDENTITY_FIELDS.entries()) {
    const denied = index % 2 === 0
      ? RANKLISTIQ_PRODUCTION_PROJECT_REF
      : HISTORICAL_NO_TOUCH_BRANCH_ID;
    const composed = createLorStudioApplication({
      targetConfiguration: testTargetConfiguration({ [field]: denied }),
      entitlementPort: new StaticEntitlementTestAdapter([]),
      testRepository: new InMemoryRecommendationCaseRepository(),
      allowNonDurableForTests: true,
    });
    assert.equal(composed.application, null, `${field}=${denied} must not compose`);
    assert.equal(composed.reason, LOR_COMPOSITION_REASONS.TARGET_REJECTED);
  }
});

test('composition fails closed on a partial or unratified target configuration', () => {
  const partial = testTargetConfiguration();
  delete partial.migrationLedger;
  assert.equal(
    createLorStudioApplication({ targetConfiguration: partial, entitlementPort: new StaticEntitlementTestAdapter([]) }).reason,
    LOR_COMPOSITION_REASONS.TARGET_REJECTED,
  );
  assert.equal(
    createLorStudioApplication({
      targetConfiguration: testTargetConfiguration({ ratified: false }),
      entitlementPort: new StaticEntitlementTestAdapter([]),
    }).reason,
    LOR_COMPOSITION_REASONS.TARGET_REJECTED,
  );
});

test('composition declines without a durable driver rather than silently degrading', () => {
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([]),
  });
  assert.equal(composed.application, null);
  assert.equal(composed.reason, LOR_COMPOSITION_REASONS.DURABLE_DRIVER_UNAVAILABLE);
  // The binding still resolved - the refusal is about durability, not about the target.
  assert.equal(composed.binding.projectId, 'lor-composition-test-project');
});

test('composition catches dependency construction failures without exposing error text', () => {
  const secretBearingMessage = 'postgres://operator:secret@example.test/lor';
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([]),
    durableRepositoryFactory() {
      throw new Error(secretBearingMessage);
    },
  });
  assert.equal(composed.application, null);
  assert.equal(composed.reason, LOR_COMPOSITION_REASONS.COMPOSITION_FAILED);
  assert.equal(Object.hasOwn(composed, 'detail'), false);
  assert.equal(JSON.stringify(composed).includes(secretBearingMessage), false);
  assert.equal(composed.binding.projectId, 'lor-composition-test-project');
});

test('composition constructs the actor-safe durable repository only from an explicit driver and scope provider', () => {
  const driver = actorSafeDriver();
  const scopeProvider = async () => {
    throw new Error('scope must be resolved only when a case operation executes');
  };
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([]),
    driver,
    scopeProvider,
  });
  assert.ok(composed.application);
  assert.equal(composed.binding.projectId, 'lor-composition-test-project');
});

test('production runtime dependencies are constructed only after target and entitlement validation', () => {
  let calls = 0;
  const runtimeDependencies = Object.freeze({
    driver: actorSafeDriver(),
    scopeProvider: async () => { throw new Error('not executed during composition'); },
    close: async () => {},
  });
  const factory = (binding) => {
    calls += 1;
    assert.equal(binding.projectId, 'lor-composition-test-project');
    return runtimeDependencies;
  };

  const invalidTarget = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration({ ratified: false }),
    entitlementPort: new StaticEntitlementTestAdapter([]),
    runtimeDependencyFactory: factory,
  });
  assert.equal(invalidTarget.reason, LOR_COMPOSITION_REASONS.TARGET_REJECTED);
  assert.equal(calls, 0);

  const missingEntitlement = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: null,
    runtimeDependencyFactory: factory,
  });
  assert.equal(missingEntitlement.reason, LOR_COMPOSITION_REASONS.ENTITLEMENT_PORT_UNAVAILABLE);
  assert.equal(calls, 0);

  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([]),
    runtimeDependencyFactory: factory,
  });
  assert.ok(composed.application);
  assert.equal(calls, 1);
  assert.equal(composed.runtimeDependencies, runtimeDependencies);
});

test('production entitlement is constructed only after the database actor resolver exists', () => {
  const actorResolver = Object.freeze({
    async resolve() { throw new Error('request resolution is lazy'); },
  });
  const entitlementPort = new StaticEntitlementTestAdapter([]);
  let factoryCalls = 0;
  const runtimeDependencies = Object.freeze({
    driver: actorSafeDriver(),
    scopeProvider: async () => { throw new Error('request scope is lazy'); },
    actorResolver,
    close: async () => {},
  });

  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPortFactory(input) {
      factoryCalls += 1;
      assert.deepEqual(Object.keys(input), ['actorResolver']);
      assert.equal(input.actorResolver, actorResolver);
      return entitlementPort;
    },
    runtimeDependencyFactory: () => runtimeDependencies,
  });

  assert.ok(composed.application);
  assert.equal(factoryCalls, 1);
  assert.equal(composed.entitlementPort, entitlementPort);
  assert.equal(composed.runtimeDependencies, runtimeDependencies);
});

test('entitlement factory cannot run without the bound database actor resolver', () => {
  let factoryCalls = 0;
  let closes = 0;
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPortFactory() {
      factoryCalls += 1;
      return new StaticEntitlementTestAdapter([]);
    },
    runtimeDependencyFactory: () => ({
      driver: actorSafeDriver(),
      scopeProvider: async () => ({}),
      async close() { closes += 1; },
    }),
  });

  assert.equal(composed.application, null);
  assert.equal(composed.reason, LOR_COMPOSITION_REASONS.COMPOSITION_FAILED);
  assert.equal(factoryCalls, 0);
  assert.equal(closes, 1);
});

test('composition constructs the durable AI and faculty invitation graph over one bound driver', () => {
  const driver = fullProductDriver();
  const scopeProvider = async () => { throw new Error('request scope is lazy'); };
  const candidateScopeProvider = async () => { throw new Error('candidate scope is lazy'); };
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([]),
    driver,
    scopeProvider,
    candidateScopeProvider,
    aiProposalProvider: { async generateProposal() {} },
    facultyEmailPort: authenticTestFacultyEmailPort(),
    facultyInvitationSecretDeriver: {
      deriveIssue() {},
      deriveResend() {},
      tokenForInvitation() {},
    },
    invitationOrigin: 'https://lor.example.test',
  });

  assert.ok(composed.application);
  assert.equal(composed.aiProposalStore?.isDurable, true);
  assert.equal(composed.aiProposalStore?.driver, driver);
  assert.equal(composed.facultyInvitationCommandRepository?.driver, driver);
  assert.equal(composed.facultyInvitationVerificationRepository?.driver, driver);
  for (const method of ['requestProposal', 'recordProposalDecision', 'getProposal']) {
    assert.equal(typeof composed.aiDraftingService?.[method], 'function');
  }
  for (const method of ['issue', 'resendOtp', 'revoke']) {
    assert.equal(typeof composed.facultyInvitationLifecycleService?.[method], 'function');
  }
  assert.equal(typeof composed.facultyInvitationVerificationService?.verify, 'function');
});

test('runtime dependency construction failures are redacted', () => {
  const secret = 'postgresql://runtime:do-not-emit@private.example.test/railway';
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([]),
    runtimeDependencyFactory() { throw new Error(secret); },
  });
  assert.equal(composed.application, null);
  assert.equal(composed.reason, LOR_COMPOSITION_REASONS.COMPOSITION_FAILED);
  assert.equal(JSON.stringify(composed).includes(secret), false);
});

test('allocated runtime dependencies are closed when later composition fails', () => {
  let closes = 0;
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([]),
    runtimeDependencyFactory() {
      return {
        driver: {},
        scopeProvider: async () => null,
        async close() { closes += 1; },
      };
    },
  });
  assert.equal(composed.application, null);
  assert.equal(composed.reason, LOR_COMPOSITION_REASONS.COMPOSITION_FAILED);
  assert.equal(closes, 1);
});

test('composition builds a real application from an explicit validated target', () => {
  const composed = composeTestApplication();
  assert.ok(composed.application, 'an application must be constructed');
  assert.equal(typeof composed.application.handleRequest, 'function');
  assert.equal(typeof composed.application.getBootstrap, 'function');
  assert.equal(composed.binding.projectId, 'lor-composition-test-project');
});

// ---------------------------------------------------------------------------
// NEGATIVE CONTROL - the historical failure, reproduced deliberately
// ---------------------------------------------------------------------------

test('NEGATIVE CONTROL: omitting the composition root makes every API route 503', async () => {
  // This is the exact production shape that left LOR Studio dark: a runtime built without an
  // `application`. If a future change reintroduces it, the positive tests below go red.
  const runtime = runtimeWith(null);

  for (const pathname of ['/api/lor-studio/bootstrap', '/api/lor-studio/cases/case-1']) {
    const { status, body } = await callRuntime(runtime, pathname);
    assert.equal(status, 503, `${pathname} must be 503 without a composed application`);
    assert.equal(body.error, 'lor_application_unavailable');
  }
});

// ---------------------------------------------------------------------------
// Reachability through the REAL runtime
// ---------------------------------------------------------------------------

test('a composed application changes bootstrap from "no application" to "not durable"', async () => {
  // This is the precise signal that composition worked. Both responses are 503, but they mean
  // opposite things: lor_application_unavailable means the application was never constructed -
  // the historical defect - whereas lor_durable_runtime_required means the application WAS
  // reached, evaluated its own readiness, and correctly refused to enter live mode on a
  // non-durable repository. Reachability and truthfulness, not a green light.
  const withoutApplication = await callRuntime(runtimeWith(null), '/api/lor-studio/bootstrap');
  assert.equal(withoutApplication.body.error, 'lor_application_unavailable');

  const composed = await callRuntime(runtimeWith(composeTestApplication().application), '/api/lor-studio/bootstrap');
  assert.notEqual(composed.body.error, 'lor_application_unavailable',
    'the application must be reached, not reported missing');
  assert.equal(composed.body.error, 'lor_durable_runtime_required');
  assert.equal(composed.body.operational, false);
  assert.equal(composed.body.storageMode, 'NON_DURABLE_TEST_ONLY',
    'a non-durable repository must never claim to be operational just because wiring exists');
});

test('a composed application makes case routes reachable through the real runtime', async () => {
  const runtime = runtimeWith(composeTestApplication().application);
  const created = await callRuntime(runtime, '/api/lor-studio/cases', {
    method: 'POST',
    body: { studentId: 'wp:1' },
  });

  assert.notEqual(created.status, 503, 'case creation must reach the application, not 503');
  assert.notEqual(created.body?.error, 'lor_application_unavailable');
});

test('authorization still applies at the actually mounted boundary', async () => {
  const runtime = runtimeWith(composeTestApplication().application);

  // No session at all: the runtime must refuse before the application is ever consulted.
  const anonymous = await callRuntime(runtime, '/api/lor-studio/bootstrap', { session: null });
  assert.equal(anonymous.status, 401);

  // An expired session must not reach the application either.
  const expired = await callRuntime(runtime, '/api/lor-studio/bootstrap', {
    session: {
      user: { id: 'wp:1' },
      issuedAt: new Date(Date.now() - 7_200_000).toISOString(),
      expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
    },
  });
  assert.equal(expired.status, 401);
});

test('the feature flags still gate a composed application', async () => {
  const application = composeTestApplication().application;

  const disabled = createLorStudioRuntime({
    publicDirectory: '/tmp/lor-studio-composition-test',
    flags: { enabled: false, killSwitch: false, requireCanary: false },
    entitlementResolver: { async resolve() { return { available: true, eligible: true, sourceVerified: true }; } },
    application,
    validateCsrf: () => true,
  });
  assert.equal((await callRuntime(disabled, '/api/lor-studio/bootstrap')).status, 404);

  const killed = createLorStudioRuntime({
    publicDirectory: '/tmp/lor-studio-composition-test',
    flags: { enabled: true, killSwitch: true, requireCanary: false },
    entitlementResolver: { async resolve() { return { available: true, eligible: true, sourceVerified: true }; } },
    application,
    validateCsrf: () => true,
  });
  assert.equal((await callRuntime(killed, '/api/lor-studio/bootstrap')).status, 423);
});

// ---------------------------------------------------------------------------
// AI DRAFTING (DR-119 clause 8) THROUGH THE REAL COMPOSITION ROOT
//
// The fixtures below build a case the way production builds one - one domain transition per
// repository revision - because hand-shaping an aggregate would reach past the very invariants
// the drafting authorisation depends on (consent receipt present, evidence hash-bound to its own
// text, faculty verified and recipient-bound).
// ---------------------------------------------------------------------------

const T0 = new Date('2026-08-09T12:00:00.000Z');
const DRAFT_CASE_ID = 'case-composition-ai-1';
const DRAFT_STUDENT_ID = 'wp:1';
/** The faculty writer is a DIFFERENT principal from the student the case belongs to. */
const DRAFT_FACULTY_ID = 'wp:9';
const DRAFT_CONSENT_RECEIPT_ID = 'consent-composition-ai-1';
const DRAFT_INVITATION_ID = 'invite-composition-ai-1';
const DRAFT_RECIPIENT_EMAIL_HASH = sha256('faculty@example.test');
const DRAFT_PROPOSALS_PATH = `/api/lor-studio/cases/${DRAFT_CASE_ID}/ai-proposals`;

const APPROVED_FACTS = [
  { id: 'fact-rounds', text: 'The student arrived early for rounds.' },
  { id: 'fact-cultures', text: 'The student independently followed up pending cultures.' },
];

/** Evidence in the shape the aggregate carries it: case-bound, hash-bound, consent-bound. */
function approvedEvidence() {
  return APPROVED_FACTS.map((fact) => ({
    id: fact.id,
    caseId: DRAFT_CASE_ID,
    text: fact.text,
    contentHash: sha256(fact.text),
    consentReceiptId: DRAFT_CONSENT_RECEIPT_ID,
  }));
}

/** The whole revision chain of a case a faculty writer may draft on. */
function draftCaseRevisions() {
  const revisions = [];
  let record = createRecommendationCase({
    id: DRAFT_CASE_ID,
    studentId: DRAFT_STUDENT_ID,
    now: T0,
    builderSessionId: `builder-${DRAFT_CASE_ID}`,
  });
  revisions.push(record);
  const advance = (next) => { record = next; revisions.push(next); };

  advance(appendReceipt(record, {
    actorId: DRAFT_STUDENT_ID,
    receiptType: 'consent',
    receipt: createConsentReceipt({
      id: DRAFT_CONSENT_RECEIPT_ID,
      caseId: DRAFT_CASE_ID,
      studentId: DRAFT_STUDENT_ID,
      scopes: ['ai_drafting', 'evidence_grounding'],
      policyVersion: 'dr-133-identified-education-record-v1',
      recordedAt: T0,
    }),
    now: T0,
  }));
  advance(setStudentPreparedMaterial(record, {
    actorId: DRAFT_STUDENT_ID,
    studentEvidence: approvedEvidence(),
    applicantOptions: [],
    now: T0,
  }));
  for (const [index, stepId] of BUILDER_STEPS.entries()) {
    advance(autosaveBuilderStep(record, { actorId: DRAFT_STUDENT_ID, stepId, stepData: { index }, now: T0 }));
    advance(completeBuilderStep(record, { actorId: DRAFT_STUDENT_ID, stepId, now: T0 }));
  }
  advance(bindFacultyInvitation(record, {
    actorId: DRAFT_STUDENT_ID,
    invitationId: DRAFT_INVITATION_ID,
    recipientEmailHash: DRAFT_RECIPIENT_EMAIL_HASH,
    now: T0,
  }));
  advance(bindVerifiedFaculty(record, {
    actorId: DRAFT_FACULTY_ID,
    invitationId: DRAFT_INVITATION_ID,
    facultyId: DRAFT_FACULTY_ID,
    recipientEmailHash: DRAFT_RECIPIENT_EMAIL_HASH,
    now: T0,
  }));
  advance(transitionRecommendationCase(record, {
    actorId: DRAFT_FACULTY_ID,
    toStatus: 'faculty_review',
    now: T0,
  }));
  return revisions;
}

/** Seeded through the repository's own append-only create/save path, one revision per call. */
async function seedDraftCase(repository) {
  const revisions = draftCaseRevisions();
  await repository.create(revisions[0], {
    idempotencyKey: `seed-${DRAFT_CASE_ID}-0`,
    requestHash: sha256(`seed:${DRAFT_CASE_ID}:0`),
  });
  for (let index = 1; index < revisions.length; index += 1) {
    await repository.save(revisions[index], {
      expectedRevision: index - 1,
      idempotencyKey: `seed-${DRAFT_CASE_ID}-${index}`,
      requestHash: sha256(`seed:${DRAFT_CASE_ID}:${index}`),
    });
  }
}

function draftingPorts() {
  return {
    repository: new InMemoryRecommendationCaseRepository(),
    entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent(DRAFT_STUDENT_ID)]),
    proposalStore: new InMemoryAiProposalStore(),
  };
}

/**
 * Compose through the REAL composition root with a seeded drafting case.
 *
 * The clock is fixed so the assertions below can prove the composition root threaded ITS clock
 * all the way down - into the AiProposalService that mints provenance AND into the drafting
 * service that stamps requestedAt - rather than either of them defaulting to their own.
 */
async function composeDraftingApplication(overrides = {}) {
  const ports = draftingPorts();
  await seedDraftCase(ports.repository);
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: ports.entitlementPort,
    testRepository: ports.repository,
    eventSink: new MetadataOnlyEventBuffer(),
    aiProposalStore: ports.proposalStore,
    clock: () => T0,
    allowNonDurableForTests: true,
    ...overrides,
  });
  return { ...ports, composed };
}

/** The faculty writer's runtime: a different principal from the student, and a faculty role. */
function facultyRuntimeWith(application) {
  return createLorStudioRuntime({
    publicDirectory: '/tmp/lor-studio-composition-test',
    flags: { enabled: true, killSwitch: false, requireCanary: false },
    entitlementResolver: {
      async resolve() {
        return {
          available: true,
          sourceVerified: true,
          revoked: false,
          active: true,
          tier: 'tier3_360',
          lorEnabled: true,
          canaryEnabled: true,
          canaryConsented: true,
          studentId: DRAFT_STUDENT_ID,
          actorId: DRAFT_FACULTY_ID,
          role: 'faculty',
        };
      },
    },
    application,
    validateCsrf: () => true,
  });
}

function facultySession(now = Date.now()) {
  return {
    user: { id: DRAFT_FACULTY_ID, role: 'faculty' },
    issuedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 30 * 60_000).toISOString(),
    csrfToken: 'test-csrf-token',
  };
}

test('an absent AI proposal store disables drafting only, and does not take the product down', async () => {
  // Drafting over a scratch in-memory store would be wrong - a faculty writer's proposal and the
  // human decision recorded against it could vanish between two requests while the product
  // reported itself live - so an absent store still disables drafting outright.
  //
  // But it must disable DRAFTING, not the product. This originally declined the whole
  // composition, which made an unconfigured drafting plane fatal to case creation, the builder,
  // receipts and release - none of which touch a proposal - and took the E2E student journey
  // down the moment it landed. Blast radius belongs to the feature missing its dependency.
  const { composed } = await composeDraftingApplication({ aiProposalStore: null });

  assert.ok(composed.application, 'the product must still compose without a drafting store');
  assert.equal(composed.aiDraftingService, null, 'drafting must be off, not improvised');
  assert.equal(composed.draftingAvailable, false);
  assert.equal(composed.draftingUnavailableReason, LOR_COMPOSITION_REASONS.AI_PROPOSAL_STORE_UNAVAILABLE,
    'an operator must learn the specific cause, not infer it from a generic 503');
  assert.equal(composed.binding.projectId, 'lor-composition-test-project');
});

test('production composition never falls back to deterministic AI when a store appears without a provider', () => {
  const durableStoreWithoutProvider = new InMemoryAiProposalStore();
  durableStoreWithoutProvider.isDurable = true;
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([]),
    driver: actorSafeDriver(),
    scopeProvider: async () => { throw new Error('not executed during composition'); },
    aiProposalStore: durableStoreWithoutProvider,
    allowNonDurableForTests: false,
  });
  assert.ok(composed.application);
  assert.equal(composed.aiDraftingService, null);
  assert.equal(composed.draftingAvailable, false);
  assert.equal(composed.draftingUnavailableReason, LOR_COMPOSITION_REASONS.AI_PROVIDER_UNAVAILABLE);
});

test('the composed application carries a drafting service, and the adapter accepted it', async () => {
  const { composed } = await composeDraftingApplication();
  assert.ok(composed.application, `composition declined: ${composed.reason}`);
  // The adapter validates the injected service's three methods and throws otherwise, so an
  // application existing at all already proves the shape - this states it where a reader sees it.
  for (const method of ['requestProposal', 'recordProposalDecision', 'getProposal']) {
    assert.equal(typeof composed.aiDraftingService[method], 'function', `${method} must be wired`);
  }
});

test('DR-119 clause 8 end to end: HTTP -> runtime -> adapter -> drafting -> grounding -> store -> response', async () => {
  const { composed, proposalStore } = await composeDraftingApplication();
  assert.ok(composed.application, `composition declined: ${composed.reason}`);
  const runtime = facultyRuntimeWith(composed.application);

  const created = await callRuntime(runtime, DRAFT_PROPOSALS_PATH, {
    method: 'POST',
    body: {},
    session: facultySession(),
    key: 'composition-draft-1',
  });

  // REACHABILITY. Not 503 for a missing application, and - the point of this lane - not 503 for
  // an unconfigured integration either.
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.notEqual(created.body?.error, 'lor_application_unavailable');
  assert.notEqual(created.body?.error, 'integration_disabled');
  const proposal = created.body.proposal;

  // A PROPOSAL, and it says so in every place that matters.
  assert.equal(proposal.schemaVersion, AI_PROPOSAL_RECORD_SCHEMA);
  assert.equal(proposal.state, 'proposal');
  assert.equal(proposal.humanDecisionRequired, true);
  assert.equal(proposal.decision, null);
  assert.equal(proposal.acceptedContent, null);
  assert.equal(proposal.requestedBy, DRAFT_FACULTY_ID);

  // SERVER-RESOLVED APPROVED FACTS. The request body was empty; the grounding set came from the
  // stored aggregate's consented, hash-bound evidence and from nowhere else.
  assert.deepEqual(
    proposal.grounding.supportIds,
    APPROVED_FACTS.map((fact) => fact.id).sort(),
  );
  assert.deepEqual(
    proposal.provenance.sourceReferences,
    APPROVED_FACTS.map((fact) => ({ id: fact.id, contentHash: sha256(fact.text) })),
  );

  // PROVIDER ABSTRACTION. The composition root chose the deterministic local adapter, and the
  // choice is legible in the provenance rather than assumed.
  assert.equal(proposal.provenance.provider, 'missionmed-local-deterministic');
  assert.equal(proposal.provenance.model, 'structured-template-v1');

  // GROUNDING VALIDATION actually ran over the provider's output.
  assert.equal(proposal.grounding.schemaVersion, GROUNDING_MODEL_VERSION);
  assert.equal(proposal.grounding.factualSegmentCount, APPROVED_FACTS.length);
  assert.equal(proposal.grounding.connectiveSegmentCount, 0);
  assert.equal(proposal.grounding.attestations.length, APPROVED_FACTS.length);
  for (const attestation of proposal.grounding.attestations) {
    assert.equal(attestation.status, ENTAILMENT_STATUS.ENTAILED);
    assert.equal(attestation.verifierId, 'missionmed.entailment.verbatim.v1');
  }

  // SERVER-MINTED PROVENANCE. The template is a constant, never a request field, and the output
  // hash covers the exact wording returned.
  assert.equal(proposal.provenance.templateVersion, AI_DRAFT_TEMPLATE_VERSION);
  assert.equal(proposal.provenance.outputHash, sha256(proposal.text));
  assert.equal(proposal.provenance.caseId, DRAFT_CASE_ID);

  // THE COMPOSITION ROOT'S CLOCK reached both halves of the drafting plane: the proposal service
  // that stamps provenance, and the drafting service that stamps the request.
  assert.equal(proposal.provenance.generatedAt, T0.toISOString());
  assert.equal(proposal.requestedAt, T0.toISOString());

  // PERSISTENCE happened in the injected store, not in a cache inside the service.
  assert.deepEqual(proposalStore.writes, [{ operation: 'put', caseId: DRAFT_CASE_ID, proposalId: proposal.id }]);

  const reread = await callRuntime(runtime, `${DRAFT_PROPOSALS_PATH}/${proposal.id}`, {
    session: facultySession(),
  });
  assert.equal(reread.status, 200, JSON.stringify(reread.body));
  assert.deepEqual(reread.body.proposal.provenance, proposal.provenance);
  assert.equal(reread.body.proposal.grounding.attestationHash, proposal.grounding.attestationHash);
  assert.equal(reread.body.proposal.acceptedContent, null);

  // IDEMPOTENCY replays out of the store rather than drafting a second proposal.
  const replayed = await callRuntime(runtime, DRAFT_PROPOSALS_PATH, {
    method: 'POST',
    body: {},
    session: facultySession(),
    key: 'composition-draft-1',
  });
  assert.equal(replayed.status, 201);
  assert.equal(replayed.body.proposal.id, proposal.id);
  assert.equal(proposalStore.writes.length, 1, 'a replay must not write a second proposal');

  // THE MANDATORY HUMAN DECISION is what turns a proposal into content.
  const decided = await callRuntime(runtime, `${DRAFT_PROPOSALS_PATH}/${proposal.id}/decision`, {
    method: 'POST',
    body: { action: 'accepted' },
    session: facultySession(),
    key: 'composition-decide-1',
  });
  assert.equal(decided.status, 201, JSON.stringify(decided.body));
  const settled = decided.body.proposal;
  assert.equal(settled.state, 'decided');
  assert.equal(settled.humanDecisionRequired, false);
  assert.equal(settled.decision.action, 'accepted');
  // The deciding principal is the authenticated actor the RUNTIME resolved, never a body field.
  assert.equal(settled.decision.facultyId, DRAFT_FACULTY_ID);
  // The decision binds to the exact wording, not to a handle.
  assert.equal(settled.decision.proposalOutputHash, proposal.provenance.outputHash);
  assert.equal(settled.acceptedContent.textHash, sha256(proposal.text));
  assert.equal(settled.acceptedContent.groundedAsAttested, true);
  assert.deepEqual(settled.acceptedContent.supportIds, proposal.grounding.supportIds);
});

test('the mounted drafting route accepts no caller-supplied grounding or authorization material', async () => {
  const { composed } = await composeDraftingApplication();
  const runtime = facultyRuntimeWith(composed.application);

  // Posting fact text would let a caller ground any sentence it liked. The field does not exist.
  const forged = await callRuntime(runtime, DRAFT_PROPOSALS_PATH, {
    method: 'POST',
    body: { factIds: null, facts: [{ id: 'fact-invented', text: 'She was the best student I ever taught.' }] },
    session: facultySession(),
    key: 'composition-forge-1',
  });
  assert.equal(forged.status, 400);
  assert.equal(forged.body.error, 'validation_failed');

  // Narrowing is allowed; asserting a fact the case does not carry under consent is not.
  const unknown = await callRuntime(runtime, DRAFT_PROPOSALS_PATH, {
    method: 'POST',
    body: { factIds: ['fact-never-consented'] },
    session: facultySession(),
    key: 'composition-forge-2',
  });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.error, 'validation_failed');
});

test('authorization still applies to the mounted drafting routes', async () => {
  const { composed } = await composeDraftingApplication();

  // The case OWNER is not the writer. `write_faculty_private` is a faculty action, and an
  // authorization denial is reported as not-found so the route cannot be used as a probe.
  const asStudent = await callRuntime(runtimeWith(composed.application), DRAFT_PROPOSALS_PATH, {
    method: 'POST',
    body: {},
    key: 'composition-student-1',
  });
  assert.equal(asStudent.status, 404);
  assert.equal(asStudent.body.error, 'not_found');

  // No session at all: the runtime refuses before the drafting service is ever consulted.
  const anonymous = await callRuntime(facultyRuntimeWith(composed.application), DRAFT_PROPOSALS_PATH, {
    method: 'POST',
    body: {},
    session: null,
    key: 'composition-anon-1',
  });
  assert.equal(anonymous.status, 401);
});

// ---------------------------------------------------------------------------
// NEGATIVE CONTROL for the drafting wiring
// ---------------------------------------------------------------------------

test('NEGATIVE CONTROL: an application composed WITHOUT drafting answers the same route 503', async () => {
  // The historical shape of this defect, reproduced deliberately. Everything here matches what
  // the composition root builds EXCEPT the `aiDraftingService` argument - same seeded case, same
  // repository, same entitlement port, same case service, same runtime, same faculty principal.
  // The only difference is the one line this lane added, so the 201 proven above is attributable
  // to that line and to nothing else in the harness.
  const { repository, entitlementPort } = draftingPorts();
  await seedDraftCase(repository);
  const withoutDrafting = createLorApplicationAdapter({
    caseService: new RecommendationCaseService({
      repository,
      entitlementPort,
      eventSink: new MetadataOnlyEventBuffer(),
      clock: () => T0,
      requireCanary: true,
    }),
    repository,
    allowNonDurableForTests: true,
  });
  const runtime = facultyRuntimeWith(withoutDrafting);

  const drafted = await callRuntime(runtime, DRAFT_PROPOSALS_PATH, {
    method: 'POST',
    body: {},
    session: facultySession(),
    key: 'composition-negative-1',
  });
  assert.equal(drafted.status, 503, 'drafting must be dark when the composition root omits it');
  assert.equal(drafted.body.error, 'integration_disabled');

  // The harness itself is sound: the SAME runtime serves a case route on the SAME case. So the
  // 503 above is the missing drafting wiring, not a broken fixture, a bad actor, or a bad route.
  const projection = await callRuntime(runtime, `/api/lor-studio/cases/${DRAFT_CASE_ID}`, {
    session: facultySession(),
  });
  assert.equal(projection.status, 200, JSON.stringify(projection.body));
});

test('NEGATIVE CONTROL: removing the store turns drafting off and leaves the rest of the API live', async () => {
  // Supplying a store MUST wire drafting - that is the control proving the composition root
  // actually reaches clause 8 rather than the routes happening to work for another reason.
  const { composed: withStore } = await composeDraftingApplication();
  assert.ok(withStore.application);
  assert.ok(withStore.aiDraftingService, 'a store must produce a wired drafting service');
  assert.equal(withStore.draftingAvailable, true);

  // Withholding it must turn drafting off WITHOUT collateral damage: the drafting route reports
  // the integration disabled, and an ordinary case read still works through the real runtime.
  const { composed: without } = await composeDraftingApplication({ aiProposalStore: null });
  assert.ok(without.application);
  assert.equal(without.aiDraftingService, null);

  const runtime = facultyRuntimeWith(without.application);
  // The faculty session matters: without it the request dies at the CSRF/authorization gate and
  // never reaches the drafting branch, so a refusal would prove nothing about drafting at all.
  const drafting = await callRuntime(runtime, DRAFT_PROPOSALS_PATH, {
    method: 'POST', body: {}, session: facultySession(), key: 'drafting-disabled-probe',
  });
  assert.equal(drafting.status, 503, 'drafting must report itself unavailable');
  assert.notEqual(drafting.body?.error, undefined);

  const read = await callRuntime(runtime, `/api/lor-studio/cases/${DRAFT_CASE_ID}`, {
    session: facultySession(),
  });
  assert.notEqual(read.status, 503, 'a case read must not be collateral damage of absent drafting');
});

test('readiness wrapper allocates only after target and entitlement validation', async () => {
  let factoryCalls = 0;
  const factory = () => {
    factoryCalls += 1;
    throw new Error('must not be reached');
  };
  const missingTarget = await createReadinessGatedLorStudioApplication({
    targetConfiguration: null,
    entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
    runtimeDependencyFactory: factory,
  });
  const missingEntitlement = await createReadinessGatedLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: null,
    runtimeDependencyFactory: factory,
  });
  assert.equal(missingTarget.reason, LOR_COMPOSITION_REASONS.TARGET_NOT_CONFIGURED);
  assert.equal(missingEntitlement.reason, LOR_COMPOSITION_REASONS.ENTITLEMENT_PORT_UNAVAILABLE);
  assert.equal(factoryCalls, 0);
});

test('one exact green runtime readiness receipt retains the durable application', async () => {
  let probes = 0;
  let closes = 0;
  const result = await createReadinessGatedLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
    runtimeDependencyFactory: () => ({
      driver: actorSafeDriver(),
      scopeProvider: async () => ({}),
      readiness: {
        async probe() {
          probes += 1;
          return { ready: true, reasonCode: 'READY', checks: { database: true } };
        },
      },
      async close() { closes += 1; },
    }),
  });
  assert.ok(result.application);
  assert.ok(result.runtimeDependencies);
  assert.equal(probes, 1);
  assert.equal(closes, 0);
});

function productionProviderReceipts(targetConfiguration, overrides = {}) {
  const targetRef = productionOperationalReadinessTargetRef(
    resolveLorTargetBinding(targetConfiguration),
  );
  return Object.fromEntries(
    PRODUCTION_OPERATIONAL_READINESS_CONTRACT.providerReceiptDependencies.map((dependency) => [
      dependency,
      {
        schemaVersion: PRODUCTION_DEPENDENCY_RECEIPT_SCHEMA,
        dependency,
        state: 'ready',
        errorCode: '',
        targetRef,
        evidenceRef: sha256(`production-composition:${dependency}`),
        observedAt: '2026-08-25T11:59:00.000Z',
        expiresAt: '2026-08-25T12:10:00.000Z',
        ...(overrides[dependency] ?? {}),
      },
    ]),
  );
}

function concreteOperationalSurfaces() {
  const privateStorageService = new PrivateVersionedStorageAdapter({
    binding: {
      providerResourceBound: true,
      independentlyVerified: true,
      bucket: 'lor-writer-depot',
      private: true,
      versioned: true,
      serverMediated: true,
      policyVerified: true,
      storageIdentity: 'production-composition-test-storage',
    },
    driver: {
      privateOnly: true,
      immutableVersions: true,
      serverOnly: true,
      async putImmutable() { throw new Error('not called by bootstrap'); },
      async getImmutable() { throw new Error('not called by bootstrap'); },
    },
    capabilityProvider: {
      async resolveStorageCapability() { throw new Error('not called by bootstrap'); },
    },
    clock: () => new Date('2026-08-25T12:00:00.000Z'),
  });
  return {
    aiProposalStore: {
      isDurable: true,
      atomicProviderCallReservation: true,
      atomicProviderRunAndProposal: true,
      conditionalAtomicOneDecision: true,
      async reserveProposalGeneration() {},
      async finalizeProposalGeneration() {},
      async markProposalGenerationUnknown() {},
      async putProposal() {},
      async getProposal() {},
      async attachDecision() {},
    },
    aiProposalProvider: { async generateProposal() {} },
    facultyInvitationLifecycleService: {
      async issue() {},
      async resendOtp() {},
      async revoke() {},
    },
    facultyInvitationVerificationService: { async verify() {} },
    privateStorageService,
  };
}

test('caller readiness booleans cannot mint measured operational authority', async () => {
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
    driver: actorSafeDriver(),
    scopeProvider: async () => ({}),
    providersReady: true,
    allAcceptedFunctionsOperational: true,
    ...concreteOperationalSurfaces(),
  });
  assert.ok(composed.application);
  const bootstrap = await composed.application.getBootstrap();
  assert.equal(bootstrap.operational, false);
  assert.equal(bootstrap.providersReady, false);
  assert.equal(bootstrap.capabilities.fullAcceptedFunctionSet, false);
});

test('raw provider receipts cannot recompose one pool into a live durable application', async () => {
  let runtimeFactoryCalls = 0;
  let entitlementFactoryCalls = 0;
  let runtimeProbes = 0;
  let closes = 0;
  const targetConfiguration = testTargetConfiguration({
    environment: 'production',
    productionDataBindingPassed: true,
  });
  const providerReceipts = productionProviderReceipts(targetConfiguration);
  const releaseFlags = Object.freeze({ enabled: true, killSwitch: false, requireCanary: true });
  const clock = () => new Date('2026-08-25T12:00:00.000Z');
  const dependencies = {
    driver: actorSafeDriver(),
    scopeProvider: async () => ({}),
    actorResolver: Object.freeze({ async resolve() { return null; } }),
    readiness: {
      async probe() {
        runtimeProbes += 1;
        return {
          ready: true,
          reasonCode: 'READY',
          groups: { auditCatalog: true, database: true, repository: true, rls: true },
        };
      },
    },
    async close() { closes += 1; },
  };

  const result = await createReadinessGatedLorStudioApplication({
    targetConfiguration,
    entitlementPortFactory({ actorResolver }) {
      entitlementFactoryCalls += 1;
      assert.equal(actorResolver, dependencies.actorResolver);
      return new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]);
    },
    runtimeDependencyFactory() {
      runtimeFactoryCalls += 1;
      return dependencies;
    },
    providerReceipts,
    releaseFlags,
    clock,
    ...concreteOperationalSurfaces(),
  });

  assert.equal(result.application, null);
  assert.equal(result.reason, LOR_COMPOSITION_REASONS.RUNTIME_READINESS_FAILED);
  assert.equal(runtimeFactoryCalls, 1, 'the product must allocate exactly one database pool');
  assert.equal(entitlementFactoryCalls, 1);
  assert.equal(runtimeProbes, 1);
  assert.equal(closes, 1);
});

test('green receipts cannot make the product live while concrete accepted-function surfaces are absent', async () => {
  let closes = 0;
  const targetConfiguration = testTargetConfiguration({
    environment: 'production',
    productionDataBindingPassed: true,
  });
  const result = await createReadinessGatedLorStudioApplication({
    targetConfiguration,
    entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
    runtimeDependencyFactory: () => ({
      driver: actorSafeDriver(),
      scopeProvider: async () => ({}),
      readiness: {
        async probe() {
          return {
            ready: true,
            reasonCode: 'READY',
            groups: { auditCatalog: true, database: true, repository: true, rls: true },
          };
        },
      },
      async close() { closes += 1; },
    }),
    providerReceipts: productionProviderReceipts(targetConfiguration),
    releaseFlags: { enabled: true, killSwitch: false, requireCanary: true },
    clock: () => new Date('2026-08-25T12:00:00.000Z'),
  });
  assert.equal(result.application, null);
  assert.equal(result.reason, LOR_COMPOSITION_REASONS.RUNTIME_READINESS_FAILED);
  assert.equal(closes, 1);
});

test('measured readiness cannot bypass the durable protected-export audit sink', async () => {
  let closes = 0;
  const targetConfiguration = testTargetConfiguration({
    environment: 'production',
    productionDataBindingPassed: true,
  });
  const surfaces = concreteOperationalSurfaces();
  const driverWithoutArtifactAudit = actorSafeDriver();
  driverWithoutArtifactAudit.appendOnlyArtifactAudit = false;
  delete driverWithoutArtifactAudit.appendArtifactExportAuditAtomic;
  const result = await createReadinessGatedLorStudioApplication({
    targetConfiguration,
    entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
    runtimeDependencyFactory: () => ({
      driver: driverWithoutArtifactAudit,
      scopeProvider: async () => ({}),
      readiness: {
        async probe() {
          return {
            ready: true,
            reasonCode: 'READY',
            groups: { auditCatalog: true, database: true, repository: true, rls: true },
          };
        },
      },
      async close() { closes += 1; },
    }),
    providerReceipts: productionProviderReceipts(targetConfiguration),
    releaseFlags: { enabled: true, killSwitch: false, requireCanary: true },
    clock: () => new Date('2026-08-25T12:00:00.000Z'),
    ...surfaces,
  });
  assert.equal(result.application, null);
  assert.equal(result.reason, LOR_COMPOSITION_REASONS.RUNTIME_READINESS_FAILED);
  assert.equal(closes, 1);
});

test('a shape-only no-op storage object cannot count as provider-bound storage', async () => {
  const surfaces = concreteOperationalSurfaces();
  surfaces.privateStorageService = {
    durability: 'DURABLE_PROVIDER_BOUND',
    async put() {},
    async get() {},
  };
  const result = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
    driver: actorSafeDriver(),
    scopeProvider: async () => ({}),
    ...surfaces,
  });
  assert.equal(result.application, null);
  assert.equal(result.reason, LOR_COMPOSITION_REASONS.COMPOSITION_FAILED);
});

test('operational readiness requires the complete exact dependency and database group sets', async () => {
  const targetConfiguration = testTargetConfiguration({
    environment: 'production',
    productionDataBindingPassed: true,
  });
  const validReceipts = productionProviderReceipts(targetConfiguration);
  const missingStorage = { ...validReceipts };
  delete missingStorage.storage;
  const cases = [
    {
      providerReceipts: missingStorage,
      groups: { auditCatalog: true, database: true, repository: true, rls: true },
    },
    {
      providerReceipts: { ...validReceipts, unexpected: validReceipts.ai },
      groups: { auditCatalog: true, database: true, repository: true, rls: true },
    },
    {
      providerReceipts: productionProviderReceipts(targetConfiguration, {
        storage: { state: 'unavailable', errorCode: 'NOT_BOUND' },
      }),
      groups: { auditCatalog: true, database: true, repository: true, rls: true },
    },
    { providerReceipts: validReceipts, groups: {} },
    {
      providerReceipts: validReceipts,
      groups: {
        auditCatalog: true,
        database: true,
        repository: true,
        rls: true,
        unexpected: true,
      },
    },
  ];

  for (const candidate of cases) {
    let closes = 0;
    const result = await createReadinessGatedLorStudioApplication({
      targetConfiguration,
      entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
      runtimeDependencyFactory: () => ({
        driver: actorSafeDriver(),
        scopeProvider: async () => ({}),
        readiness: {
          async probe() {
            return { ready: true, reasonCode: 'READY', groups: candidate.groups };
          },
        },
        async close() { closes += 1; },
      }),
      providerReceipts: candidate.providerReceipts,
      releaseFlags: { enabled: true, killSwitch: false, requireCanary: true },
      clock: () => new Date('2026-08-25T12:00:00.000Z'),
    });
    assert.equal(result.application, null);
    assert.equal(result.reason, LOR_COMPOSITION_REASONS.RUNTIME_READINESS_FAILED);
    assert.equal(closes, 1);
  }
});

test('caller-supplied operational readiness factories cannot mint live authority', async () => {
  for (const operationalReadinessFactory of [null, {}, () => ({
    async snapshot() {
      return {
        status: 'ready',
        productionOperational: true,
        dependencies: {},
        databaseProbeGroups: {},
      };
    },
  })]) {
    let runtimeFactoryCalls = 0;
    let maliciousFactoryCalls = 0;
    const suppliedFactory = typeof operationalReadinessFactory === 'function'
      ? (...args) => {
        maliciousFactoryCalls += 1;
        return operationalReadinessFactory(...args);
      }
      : operationalReadinessFactory;
    const result = await createReadinessGatedLorStudioApplication({
      targetConfiguration: testTargetConfiguration(),
      entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
      runtimeDependencyFactory() {
        runtimeFactoryCalls += 1;
        throw new Error('must not allocate');
      },
      operationalReadinessFactory: suppliedFactory,
    });
    assert.equal(result.application, null);
    assert.equal(result.reason, LOR_COMPOSITION_REASONS.RUNTIME_READINESS_FAILED);
    assert.equal(runtimeFactoryCalls, 0);
    assert.equal(maliciousFactoryCalls, 0);
  }
});

test('false, malformed, and throwing readiness close once and expose one safe reason', async () => {
  const candidates = [
    async () => ({ ready: false, reasonCode: 'secret provider detail', checks: { database: false } }),
    async () => ({ ready: true, reasonCode: 'READY', checks: {} }),
    async () => { throw new Error('credential-like provider detail'); },
  ];
  for (const probe of candidates) {
    let closes = 0;
    const result = await createReadinessGatedLorStudioApplication({
      targetConfiguration: testTargetConfiguration(),
      entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
      runtimeDependencyFactory: () => ({
        driver: actorSafeDriver(),
        scopeProvider: async () => ({}),
        readiness: { probe },
        async close() { closes += 1; },
      }),
    });
    assert.equal(result.application, null);
    assert.equal(result.reason, LOR_COMPOSITION_REASONS.RUNTIME_READINESS_FAILED);
    assert.equal(JSON.stringify(result).includes('credential'), false);
    assert.equal(JSON.stringify(result).includes('secret provider'), false);
    assert.equal(closes, 1);
  }
});

test('startup abort closes the allocated runtime while readiness is pending', async () => {
  const controller = new AbortController();
  let closeCount = 0;
  const pending = createReadinessGatedLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
    signal: controller.signal,
    runtimeDependencyFactory() {
      return {
        driver: actorSafeDriver(),
        scopeProvider: async () => ({}),
        readiness: { probe: () => new Promise(() => {}) },
        async close() { closeCount += 1; },
      };
    },
  });
  controller.abort();
  const result = await pending;
  assert.equal(result.application, null);
  assert.equal(result.reason, LOR_COMPOSITION_REASONS.RUNTIME_READINESS_FAILED);
  assert.equal(closeCount, 1);
});

test('shutdown is one shared promise, closes HTTP before pool, and attempts both on error', async () => {
  const order = [];
  const shutdown = createLorStudioShutdownCoordinator({
    closeHttp: async () => { order.push('http'); },
    runtimeDependencies: { async close() { order.push('pool'); } },
  });
  const first = shutdown();
  const second = shutdown();
  assert.equal(first, second);
  await first;
  assert.deepEqual(order, ['http', 'pool']);

  const failingOrder = [];
  const failing = createLorStudioShutdownCoordinator({
    closeHttp: async () => { failingOrder.push('http'); throw new Error('private detail'); },
    runtimeDependencies: { async close() { failingOrder.push('pool'); } },
  });
  await assert.rejects(failing(), (error) => error.message === 'LOR_RUNTIME_SHUTDOWN_FAILED');
  assert.deepEqual(failingOrder, ['http', 'pool']);
});

// ---------------------------------------------------------------------------
// SOURCE GUARD - the check that would have caught the original defect
// ---------------------------------------------------------------------------

test('SOURCE GUARD: server.mjs readiness-gates and passes an application to the runtime', () => {
  const source = readFileSync(fileURLToPath(new URL('../../server.mjs', import.meta.url)), 'utf8');

  assert.match(source, /await createReadinessGatedLorStudioApplication\(/u,
    'server.mjs must construct and readiness-gate the application through the production wrapper');
  assert.match(source, /readLorTargetConfiguration\(/u,
    'the target must come from explicit configuration');

  const mount = source.match(/createLorStudioRuntime\(\{[\s\S]*?\n\}\);/u);
  assert.ok(mount, 'the LOR Studio runtime mount must be present in server.mjs');
  assert.match(mount[0], /application:\s*LOR_STUDIO_COMPOSITION\.application/u,
    'the mount MUST pass `application` - omitting it is the defect that left the product dark');

  // No implicit LOR target may reappear in the LOR composition path. Scoped deliberately to
  // that block: server.mjs legitimately names the RankListIQ project elsewhere as
  // AUTH_ALLOWED_SUPABASE_PROJECT, which is MissionMed HQ's auth project and nothing to do with
  // LOR Studio. The binding-level protection is the denylist in lor-target-binding.mjs.
  const compositionBlock = source.match(/const LOR_STUDIO_COMPOSITION[\s\S]*?\n\}\);/u);
  assert.ok(compositionBlock, 'the LOR composition block must be present');
  assert.equal(compositionBlock[0].includes(RANKLISTIQ_PRODUCTION_PROJECT_REF), false,
    'the LOR composition must never name the RankListIQ production project');
  assert.equal(compositionBlock[0].includes(HISTORICAL_NO_TOUCH_BRANCH_ID), false,
    'the LOR composition must never name the historical no-touch branch');
  assert.match(compositionBlock[0], /targetConfiguration:\s*readLorTargetConfiguration\(process\.env\)/u,
    'the target must come only from explicit external configuration, never a literal');

  // The runtime must receive a real URL, not a synthetic { pathname, searchParams } literal.
  assert.match(source, /LOR_STUDIO_RUNTIME\.handle\(request,\s*response,\s*url,/u,
    'the runtime must be handed the genuine URL object');
  assert.match(source, /createProductionPostgresRuntimeDependencies/u);
  assert.match(source, /createWordPressCurrentUserAdmission/u);
  assert.match(source, /readLorStudioSession\(request\)/u);
  assert.match(source, /!session[\s\S]*?LOR_HTML_ENTRY_PATHS\.has\(pathname\)[\s\S]*?sendRedirect\(response, LOR_AUTH_START_PATH, 302\)/u,
    'an unauthenticated canonical LOR page must enter the isolated LOR auth lane');
  assert.match(source, /process\.once\('SIGTERM', requestGracefulShutdown\)/u);
  assert.match(source, /process\.once\('SIGINT', requestGracefulShutdown\)/u);
  assert.ok(
    source.indexOf("process.once('SIGTERM', requestGracefulShutdown)")
      < source.indexOf('await createReadinessGatedLorStudioApplication('),
    'signal handlers must be installed before the network-bound readiness probe',
  );
  assert.match(source, /server\.on\('error',[\s\S]*?process\.exitCode = 1/u,
    'a fatal listen error must leave a non-zero process exit status');
  assert.match(source, /LOR_STUDIO_SHUTDOWN\(\)\.catch\(\(\) => \{[\s\S]*?process\.exitCode = 1/u,
    'a graceful-signal cleanup failure must leave a non-zero process exit status');
});

test('SOURCE GUARD: the composition root passes a drafting service to the application adapter', () => {
  const source = readFileSync(fileURLToPath(new URL('../../lor-studio/composition.mjs', import.meta.url)), 'utf8');

  assert.match(source, /createAiDraftingService\(\{/u,
    'the composition root must construct the drafting service - the HTTP adapter never will');

  const adapterCall = source.match(/createLorApplicationAdapter\(\{[\s\S]*?\n {4}\}\);/u);
  assert.ok(adapterCall, 'the application adapter construction must be present in the composition root');
  assert.match(adapterCall[0], /aiDraftingService,/u,
    'the adapter MUST receive aiDraftingService - omitting it is what leaves clause 8 dark');

  // The store is either explicitly injected or constructed over the same validated durable
  // database driver. It is never an in-memory production default.
  // Production also requires an explicit privacy-approved provider; the deterministic adapter
  // exists only behind the explicit non-durable test gate.
  assert.match(source, /const draftingAvailable = Boolean\(proposalStoreDurableEnough && proposalProvider\)/u,
    'drafting availability must require a durable store and an approved provider');
  assert.match(source, /draftingAvailable\s*\?\s*createAiDraftingService\(\{/u,
    'the drafting service must be constructed only when a store was supplied');
  assert.equal(
    /if \(!aiProposalStore\) \{[\s\S]{0,200}?return \{ application: null/u.test(source),
    false,
    'an absent store must disable drafting, never decline the whole application',
  );

  // No credential, no environment key, and no network provider on the drafting path. The only
  // environment reads in this module are the explicit target keys, which are enumerated in
  // LOR_TARGET_ENV_KEYS and validated by the binding resolver.
  const draftingBlock = source.slice(
    source.indexOf('const proposalService'),
    source.indexOf('let resolvedFacultyInvitationLifecycleService'),
  );
  assert.ok(draftingBlock.length > 0, 'the drafting construction block must be present');
  for (const forbidden of ['process.env', 'apiKey', 'API_KEY', 'token', 'secret', 'fetch(']) {
    assert.equal(draftingBlock.includes(forbidden), false,
      `the drafting composition must not reference ${forbidden}`);
  }
  assert.match(
    source,
    /allowNonDurableForTests \? new DeterministicAiProposalAdapter\(\) : null/u,
    'the deterministic provider must be reachable only through the explicit non-durable test gate',
  );
  assert.equal(/aiProposalProvider \?\? new DeterministicAiProposalAdapter/u.test(source), false,
    'production must never silently fall back to deterministic AI');
});
