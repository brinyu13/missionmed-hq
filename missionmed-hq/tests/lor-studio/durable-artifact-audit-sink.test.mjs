import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuditEvent } from '../../lor-studio/audit/audit-events.mjs';
import {
  AuthorizationDeniedError,
  IntegrationDisabledError,
  ValidationError,
} from '../../lor-studio/domain/errors.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  DURABLE_ARTIFACT_AUDIT_CONTRACT,
  SupabaseDurableArtifactAuditSink,
  isAuthenticDurableArtifactAuditSink,
} from '../../lor-studio/repositories/supabase-durable-artifact-audit-sink.mjs';

const AT = '2026-08-26T12:00:00.000Z';
const CASE_ID = 'case-artifact-audit-1';
const ACTOR_ID = 'wp:202';
const EVENT_HASH = /^[a-f0-9]{64}$/u;

function binding() {
  return resolveLorTargetBinding({
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
}

function facultyScope(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: '019fc643-9a21-7abc-8def-0123456789ab',
    authenticatedSubject: ACTOR_ID,
    actorId: ACTOR_ID,
    actorRole: 'faculty',
    resourceStudentId: 'wp:101',
    caseId: CASE_ID,
    operation: 'read',
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

function generatedEvent(overrides = {}) {
  return {
    ...createAuditEvent({
      type: 'artifact.generated',
      actor: { id: ACTOR_ID, role: 'faculty' },
      caseId: CASE_ID,
      targetId: 'document-final-1',
      outcome: 'success',
      metadata: {
        action: 'export_final_document',
        artifactFormat: 'docx',
        result: 'faculty_owner',
        artifactSha256: sha256('artifact-bytes'),
        releaseDocumentHash: null,
        sourceRevision: 7,
      },
      at: AT,
    }),
    ...overrides,
  };
}

function studentScope(overrides = {}) {
  return facultyScope({
    authenticatedSubject: ACTOR_ID,
    actorId: ACTOR_ID,
    actorRole: 'student',
    resourceStudentId: ACTOR_ID,
    operation: 'read',
    purpose: 'student_case_read',
    invitationId: null,
    ...overrides,
  });
}

function driver(overrides = {}) {
  const calls = [];
  const value = {
    rlsEnforced: true,
    serverOnly: true,
    databaseClock: true,
    appendOnlyArtifactAudit: true,
    async appendArtifactExportAuditAtomic(command) {
      calls.push(command);
      return {
        schemaVersion: 'missionmed.lor.artifact-audit-receipt.v1',
        accepted: true,
        replayed: false,
        caseId: command.caseId,
        eventId: command.event.eventId,
        eventType: command.event.type,
        outcome: command.event.outcome,
        eventHash: command.eventHash,
        scopeHash: command.scopeHash,
        targetBindingHash: command.targetBindingHash,
        artifactSha256: command.event.type === 'artifact.generated'
          ? command.event.metadata.artifactSha256
          : null,
        releaseDocumentHash: command.event.type === 'artifact.generated'
          ? command.event.metadata.releaseDocumentHash
          : null,
        sourceRevision: command.event.type === 'artifact.generated'
          ? command.event.metadata.sourceRevision
          : null,
        transactionRef: `txn_${sha256('artifact-audit-transaction')}`,
        committedAt: AT,
      };
    },
    ...overrides,
  };
  return { calls, value };
}

function sinkHarness({ scope = facultyScope(), driverOverrides = {} } = {}) {
  const durableDriver = driver(driverOverrides);
  const scopeCalls = [];
  const sink = new SupabaseDurableArtifactAuditSink({
    binding: binding(),
    driver: durableDriver.value,
    async scopeProvider(request) {
      scopeCalls.push(request);
      return scope;
    },
  });
  return { sink, driver: durableDriver, scopeCalls };
}

test('durable artifact audit reserves one authentic actor/case-bound append-only command', async () => {
  const { sink, driver: durableDriver, scopeCalls } = sinkHarness();
  const event = generatedEvent();
  const receipt = await sink.emit(event, {
    actorId: ACTOR_ID,
    actorRole: 'faculty',
    caseId: CASE_ID,
  });

  assert.equal(isAuthenticDurableArtifactAuditSink(sink), true);
  assert.deepEqual(scopeCalls, [{ caseId: CASE_ID, operation: 'read' }]);
  assert.equal(durableDriver.calls.length, 1);
  const command = durableDriver.calls[0];
  assert.equal(command.schemaVersion, 'missionmed.lor.artifact-audit-command.v1');
  assert.equal(command.caseId, CASE_ID);
  assert.deepEqual(command.event, event);
  assert.match(command.eventHash, EVENT_HASH);
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.eventHash, command.eventHash);
  assert.equal(receipt.committedAt, AT);
});

test('student audit asks the runtime for an owner-bound read scope', async () => {
  const scopeCalls = [];
  const durableDriver = driver();
  const sink = new SupabaseDurableArtifactAuditSink({
    binding: binding(),
    driver: durableDriver.value,
    async scopeProvider(request) {
      scopeCalls.push(request);
      return studentScope();
    },
  });
  const event = createAuditEvent({
    type: 'artifact.generated',
    actor: { id: ACTOR_ID, role: 'student' },
    caseId: CASE_ID,
    targetId: 'document-final-1',
    outcome: 'success',
    metadata: {
      action: 'export_final_document',
      artifactFormat: 'docx',
      result: 'student_visible',
      artifactSha256: sha256('student-artifact-bytes'),
      releaseDocumentHash: sha256('release-document'),
      sourceRevision: 8,
    },
    at: AT,
  });

  await sink.emit(event, {
    actorId: ACTOR_ID,
    actorRole: 'student',
    caseId: CASE_ID,
  });
  const missingReleaseBinding = {
    ...event,
    metadata: { ...event.metadata, releaseDocumentHash: null },
  };
  await assert.rejects(
    () => sink.emit(missingReleaseBinding, {
      actorId: ACTOR_ID,
      actorRole: 'student',
      caseId: CASE_ID,
    }),
    ValidationError,
  );
  assert.deepEqual(scopeCalls, [{
    caseId: CASE_ID,
    operation: 'read',
    resourceStudentId: ACTOR_ID,
  }]);
  assert.equal(durableDriver.calls.length, 1);
  assert.equal(durableDriver.calls[0].scope.purpose, 'student_case_read');
});

test('shape-compatible sinks, proxies, subclasses, and incomplete drivers cannot mint authenticity', () => {
  const { sink } = sinkHarness();
  assert.equal(isAuthenticDurableArtifactAuditSink({
    isDurable: true,
    serverOnly: true,
    actorCaseBound: true,
    appendOnly: true,
    async emit() {},
  }), false);
  assert.equal(isAuthenticDurableArtifactAuditSink(new Proxy(sink, {})), false);

  class OverridingSink extends SupabaseDurableArtifactAuditSink {
    async emit() { return { accepted: true }; }
  }
  const baseDriver = driver().value;
  const subclass = new OverridingSink({
    binding: binding(),
    driver: baseDriver,
    scopeProvider: async () => facultyScope(),
  });
  assert.equal(isAuthenticDurableArtifactAuditSink(subclass), false);

  assert.throws(
    () => new SupabaseDurableArtifactAuditSink({
      binding: binding(),
      driver: { ...baseDriver, appendOnlyArtifactAudit: false },
      scopeProvider: async () => facultyScope(),
    }),
    IntegrationDisabledError,
  );
});

test('forged event references, extra keys, unsafe metadata, and cross-role context fail before the driver', async () => {
  const { sink, driver: durableDriver } = sinkHarness();
  const context = { actorId: ACTOR_ID, actorRole: 'faculty', caseId: CASE_ID };
  const candidates = [
    { ...generatedEvent(), actorRef: sha256('forged').slice(0, 24) },
    { ...generatedEvent(), caseRef: sha256('forged').slice(0, 24) },
    { ...generatedEvent(), extra: true },
    { ...generatedEvent(), metadata: { action: 'export_final_document', artifactFormat: 'docx', result: 'faculty_owner', email: 'forbidden' } },
  ];
  for (const event of candidates) {
    await assert.rejects(() => sink.emit(event, context), ValidationError);
  }
  await assert.rejects(
    () => sink.emit(generatedEvent(), { ...context, actorRole: 'student' }),
    ValidationError,
  );
  assert.equal(durableDriver.calls.length, 0);
});

test('scope mismatch and forged database receipts fail closed', async () => {
  const context = { actorId: ACTOR_ID, actorRole: 'faculty', caseId: CASE_ID };
  const mismatches = [
    facultyScope({ caseId: 'case-other' }),
    facultyScope({ operation: 'save' }),
    facultyScope({ invitationId: null }),
    facultyScope({ canaryAuthorized: false }),
  ];
  for (const scope of mismatches) {
    const { sink, driver: durableDriver } = sinkHarness({ scope });
    await assert.rejects(() => sink.emit(generatedEvent(), context), AuthorizationDeniedError);
    assert.equal(durableDriver.calls.length, 0);
  }

  const { sink } = sinkHarness({
    driverOverrides: {
      async appendArtifactExportAuditAtomic(command) {
        return {
          schemaVersion: 'missionmed.lor.artifact-audit-receipt.v1',
          accepted: true,
          replayed: false,
          caseId: command.caseId,
          eventId: command.event.eventId,
          eventType: command.event.type,
          outcome: command.event.outcome,
          eventHash: sha256('forged'),
          scopeHash: command.scopeHash,
          targetBindingHash: command.targetBindingHash,
          artifactSha256: command.event.metadata.artifactSha256,
          releaseDocumentHash: command.event.metadata.releaseDocumentHash,
          sourceRevision: command.event.metadata.sourceRevision,
          transactionRef: `txn_${sha256('artifact-audit-transaction')}`,
          committedAt: AT,
        };
      },
    },
  });
  await assert.rejects(
    () => sink.emit(generatedEvent(), context),
    IntegrationDisabledError,
  );
});

test('database receipts must repeat the exact exported byte and source-version binding', async () => {
  const context = { actorId: ACTOR_ID, actorRole: 'faculty', caseId: CASE_ID };
  for (const forged of [
    { artifactSha256: sha256('different-artifact') },
    { releaseDocumentHash: sha256('different-release') },
    { sourceRevision: 99 },
  ]) {
    const { sink } = sinkHarness({
      driverOverrides: {
        async appendArtifactExportAuditAtomic(command) {
          return {
            schemaVersion: 'missionmed.lor.artifact-audit-receipt.v1',
            accepted: true,
            replayed: false,
            caseId: command.caseId,
            eventId: command.event.eventId,
            eventType: command.event.type,
            outcome: command.event.outcome,
            eventHash: command.eventHash,
            scopeHash: command.scopeHash,
            targetBindingHash: command.targetBindingHash,
            artifactSha256: command.event.metadata.artifactSha256,
            releaseDocumentHash: command.event.metadata.releaseDocumentHash,
            sourceRevision: command.event.metadata.sourceRevision,
            transactionRef: `txn_${sha256('artifact-audit-transaction')}`,
            committedAt: AT,
            ...forged,
          };
        },
      },
    });
    await assert.rejects(() => sink.emit(generatedEvent(), context), IntegrationDisabledError);
  }
});

test('the published contract is narrow and contains no protected-content input', () => {
  assert.deepEqual(DURABLE_ARTIFACT_AUDIT_CONTRACT.eventTypes, [
    'artifact.generated',
    'artifact.denied',
  ]);
  assert.equal(DURABLE_ARTIFACT_AUDIT_CONTRACT.rawProtectedContentAccepted, false);
  assert.equal(DURABLE_ARTIFACT_AUDIT_CONTRACT.databaseClock, true);
});

test('the authentic sink prototype cannot be replaced after construction', () => {
  const { sink } = sinkHarness();
  const descriptor = Object.getOwnPropertyDescriptor(
    SupabaseDurableArtifactAuditSink.prototype,
    'emit',
  );
  assert.equal(Object.isFrozen(SupabaseDurableArtifactAuditSink.prototype), true);
  assert.equal(descriptor?.writable, false);
  assert.equal(descriptor?.configurable, false);
  assert.throws(() => {
    SupabaseDurableArtifactAuditSink.prototype.emit = async () => undefined;
  }, TypeError);
  assert.equal(isAuthenticDurableArtifactAuditSink(sink), true);
  assert.equal(isAuthenticDurableArtifactAuditSink({ emit: sink.emit }), false);
});
