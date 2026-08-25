import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  ATOMIC_RLS_CASE_DRIVER_CONTRACT,
  ATOMIC_RLS_CASE_STATEMENTS,
  createAtomicRlsCaseDriver,
} from '../../lor-studio/adapters/atomic-rls-case-driver.mjs';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  appendStudentSafeReceipt,
  autosaveStudentSafeBuilderStep,
  completeStudentSafeBuilderStep,
  createStudentSafeRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import { hashValue, sha256 } from '../../lor-studio/domain/value-utils.js';
import { SupabaseDurableRecommendationCaseRepository } from '../../lor-studio/repositories/supabase-durable-recommendation-case-repository.mjs';
import { createMetadataServiceEvent } from '../../lor-studio/services/metadata-events.js';

const STUDENT = 'wp:41';
const FACULTY = 'wp:43';
const MENTOR = 'wp:72';
const AUTH_UID = '4c1d4b2e-1f1a-4a67-9a1a-7b0f0c9d5e01';
const CASE_ID = 'case_durable_0001';
const BUILDER_SESSION_ID = 'builder_durable_0001';
const CREATED_AT = '2026-08-19T09:00:00.000Z';
const TRUSTED_STUDENT_AUTHORIZATION = Object.freeze({
  schemaVersion: 'missionmed.lor.trusted-student-authorization.v1',
  authoritySource: 'server_verified_entitlement',
  entitlementVerified: true,
  lorEnabled: true,
  canaryAuthorized: true,
  clientAsserted: false,
});

function targetConfiguration(overrides = {}) {
  return {
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    ratified: true,
    decisionRecord: 'DR-120',
    environment: 'staging',
    projectRef: 'lor-case-driver-staging',
    parentProjectRef: 'lor-case-driver-parent',
    branchName: 'lor-staging',
    branchId: 'lor-case-driver-staging',
    schema: 'lor_studio',
    migrationLedger: 'lor_studio/migrations/staging',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: false,
    ...overrides,
  };
}

const BINDING = resolveLorTargetBinding(targetConfiguration());

function scope({
  actorId = STUDENT,
  actorRole = 'student',
  resourceStudentId = STUDENT,
  caseId = CASE_ID,
  operation = 'read',
  assignmentId = null,
  invitationId = null,
  administrativeGrantId = null,
  entitlementVerified = true,
  lorEnabled = true,
  canaryAuthorized = true,
  ...overrides
} = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: AUTH_UID,
    authenticatedSubject: actorId,
    actorId,
    actorRole,
    resourceStudentId,
    caseId,
    operation,
    purpose: operation === 'read' ? 'student_case_read' : 'student_case_write',
    assignmentId,
    invitationId,
    administrativeGrantId,
    entitlementVerified,
    lorEnabled,
    canaryAuthorized,
    ...overrides,
  };
}

function metadataEvent(state, eventType, suffix) {
  return createMetadataServiceEvent({
    eventId: `driver-${suffix}`,
    eventType,
    caseId: state.id,
    actorId: STUDENT,
    actorRole: 'student',
    correlationId: `driver-correlation-${suffix}`,
    revision: state.revision,
    occurredAt: state.updatedAt,
  });
}

function sealReceipt(payload) {
  return { ...payload, receiptHash: hashValue(payload) };
}

function fixtureStates() {
  const created = createStudentSafeRecommendationCase({
    id: CASE_ID,
    studentId: STUDENT,
    actorId: STUDENT,
    builderSessionId: BUILDER_SESSION_ID,
    now: CREATED_AT,
  });
  const autosaved = autosaveStudentSafeBuilderStep(created.state, {
    actorId: STUDENT,
    stepId: 'case_basics',
    stepData: { specialty: 'Internal Medicine' },
    now: '2026-08-19T09:01:00.000Z',
  });
  const completed = completeStudentSafeBuilderStep(autosaved.state, {
    actorId: STUDENT,
    stepId: 'case_basics',
    now: '2026-08-19T09:02:00.000Z',
  });
  const consentReceipt = sealReceipt({
    schemaVersion: 'missionmed.lor.consent-receipt.v1',
    id: 'consent-1',
    caseId: CASE_ID,
    actorId: STUDENT,
    scopes: ['letter_drafting'],
    policyVersion: '2026-08',
    recordedAt: '2026-08-19T09:03:00.000Z',
  });
  const consented = appendStudentSafeReceipt(completed.state, {
    actorId: STUDENT,
    receiptType: 'consent',
    receipt: consentReceipt,
    now: consentReceipt.recordedAt,
  });
  const waiverReceipt = sealReceipt({
    schemaVersion: 'missionmed.lor.waiver-receipt.v1',
    id: 'waiver-1',
    caseId: CASE_ID,
    actorId: STUDENT,
    waived: false,
    policyVersion: '2026-08',
    priorReceiptId: null,
    acknowledgment: 'I elect to receive the released letter.',
    recordedAt: '2026-08-19T09:04:00.000Z',
  });
  const waived = appendStudentSafeReceipt(consented.state, {
    actorId: STUDENT,
    receiptType: 'waiver',
    receipt: waiverReceipt,
    now: waiverReceipt.recordedAt,
  });
  return {
    created,
    autosaved,
    completed,
    consented,
    waived,
    consentReceipt,
    waiverReceipt,
  };
}

const FIXTURES = fixtureStates();

const COMMAND_CASES = [
  {
    method: 'commitStudentCaseCreate',
    statementId: ATOMIC_RLS_CASE_STATEMENTS.commitStudentCaseCreate,
    functionName: 'commit_student_case_create',
    action: 'case.create',
    eventType: 'case.created',
    transition: FIXTURES.created,
    expectedRevision: null,
    receipt: null,
    valueCount: 6,
  },
  {
    method: 'commitStudentBuilderAutosave',
    statementId: ATOMIC_RLS_CASE_STATEMENTS.commitStudentBuilderAutosave,
    functionName: 'commit_student_builder_autosave',
    action: 'builder.autosave',
    eventType: 'builder.autosaved',
    transition: FIXTURES.autosaved,
    expectedRevision: 0,
    receipt: null,
    valueCount: 7,
  },
  {
    method: 'commitStudentBuilderComplete',
    statementId: ATOMIC_RLS_CASE_STATEMENTS.commitStudentBuilderComplete,
    functionName: 'commit_student_builder_complete',
    action: 'builder.complete_step',
    eventType: 'builder.step_completed',
    transition: FIXTURES.completed,
    expectedRevision: 1,
    receipt: null,
    valueCount: 7,
  },
  {
    method: 'commitStudentConsentReceipt',
    statementId: ATOMIC_RLS_CASE_STATEMENTS.commitStudentConsentReceipt,
    functionName: 'commit_student_consent_receipt',
    action: 'consent.record',
    eventType: 'consent.recorded',
    transition: FIXTURES.consented,
    expectedRevision: 2,
    receipt: FIXTURES.consentReceipt,
    valueCount: 8,
  },
  {
    method: 'commitStudentWaiverReceipt',
    statementId: ATOMIC_RLS_CASE_STATEMENTS.commitStudentWaiverReceipt,
    functionName: 'commit_student_waiver_receipt',
    action: 'waiver.record',
    eventType: 'waiver.recorded',
    transition: FIXTURES.waived,
    expectedRevision: 3,
    receipt: FIXTURES.waiverReceipt,
    valueCount: 8,
  },
];

function commandFor(entry, overrides = {}) {
  const state = overrides.state ?? entry.transition.state;
  const event = overrides.event ?? metadataEvent(state, entry.eventType, `${entry.action}-${state.revision}`);
  return {
    binding: BINDING,
    scope: scope({ operation: entry.action === 'case.create' ? 'create' : 'save' }),
    state,
    expectedRevision: entry.expectedRevision,
    idempotencyKey: `idem-${entry.action}`,
    requestHash: sha256(`request:${entry.action}`),
    event,
    versionEntry: entry.transition.versionEntry,
    receipt: entry.receipt,
    ...overrides,
  };
}

function commandReceipt({ entry, statement, transactionId, overrides = {} }) {
  const state = overrides.state ?? JSON.parse(statement.values[0]);
  const eventIndex = entry.action === 'case.create' ? 3 : 4;
  const eventHashIndex = entry.action === 'case.create' ? 4 : 5;
  const event = JSON.parse(statement.values[eventIndex]);
  return {
    schemaVersion: 'missionmed.lor.atomic-command-receipt.v2',
    action: entry.action,
    committed: true,
    replayed: false,
    sameTransaction: true,
    caseId: state.id,
    studentId: state.studentId,
    revision: String(state.revision),
    idempotencyKey: entry.action === 'case.create' ? statement.values[1] : statement.values[2],
    requestHash: entry.action === 'case.create' ? statement.values[2] : statement.values[3],
    safeRecordHash: hashValue(state),
    protectedStateHash: sha256(`protected:${state.id}:${state.revision}`),
    eventHash: statement.values[eventHashIndex],
    auditEventRef: event.eventRef,
    transactionId,
    state,
    ...overrides,
  };
}

function studentRow(state = FIXTURES.created.state, overrides = {}) {
  return {
    case_id: state.id,
    student_auth_subject: state.studentId,
    revision: String(state.revision),
    status: state.status,
    created_at: new Date(state.createdAt),
    updated_at: new Date(state.updatedAt),
    closed_at: state.closedAt,
    record: {
      builder: structuredClone(state.builder),
      studentEvidence: structuredClone(state.studentEvidence),
      applicantOptions: structuredClone(state.applicantOptions),
      delivery: structuredClone(state.delivery),
    },
    consent_receipts: structuredClone(state.consentReceipts),
    waiver_receipts: structuredClone(state.waiverReceipts),
    final_document_id: null,
    final_document_text: null,
    final_document_content_hash: null,
    final_document_mime_type: null,
    approval_approved: null,
    approval_at: null,
    approval_faculty_ref: null,
    approval_signature_attested: null,
    release_document_id: null,
    release_document_hash: null,
    released_at: null,
    released_at_revision: null,
    waiver_receipt_id: null,
    snapshot_hash: null,
    ...overrides,
  };
}

function facultyProjection({ revision = 9, releasedAt = '2026-08-19T10:00:00.000Z' } = {}) {
  return {
    schemaVersion: 'missionmed.lor.faculty-projection.v1',
    caseId: CASE_ID,
    revision,
    status: 'faculty_approved',
    studentShared: {
      evidence: [],
      applicantOptions: [],
      consentReceipts: [],
      waiverState: { decided: true, waived: false, receiptId: 'waiver-1' },
    },
    facultyPrivate: {
      answers: [],
      notes: [],
      draftText: 'Faculty draft',
      finalDocument: {
        id: 'document-1',
        text: 'Final wording',
        contentHash: null,
        mimeType: null,
        releasedToStudentAt: releasedAt,
      },
    },
    delivery: { status: 'not_started', destinationClass: null, deliveredAt: null },
  };
}

function facultyReleaseCommand(overrides = {}) {
  const expectedRevision = overrides.expectedRevision ?? 8;
  const event = overrides.event ?? createMetadataServiceEvent({
    eventId: 'faculty-release-driver',
    eventType: 'faculty.final_document_released',
    caseId: CASE_ID,
    actorId: FACULTY,
    actorRole: 'faculty',
    correlationId: 'faculty-release-driver',
    revision: expectedRevision + 1,
    occurredAt: '2026-08-19T10:00:00.000Z',
  });
  return {
    binding: BINDING,
    scope: scope({
      actorId: FACULTY,
      actorRole: 'faculty',
      resourceStudentId: STUDENT,
      operation: 'save',
      invitationId: 'invitation-1',
      purpose: 'faculty_private_edit',
    }),
    expectedRevision,
    documentId: 'document-1',
    idempotencyKey: 'faculty-release-idempotency',
    requestHash: sha256('faculty-release-request'),
    event,
    ...overrides,
  };
}

function facultyReleaseReceipt(statement, transactionId, overrides = {}) {
  const event = JSON.parse(statement.values[4]);
  const state = overrides.state ?? facultyProjection();
  return {
    schemaVersion: 'missionmed.lor.atomic-command-receipt.v2',
    action: 'faculty.final_document_release',
    committed: true,
    replayed: false,
    sameTransaction: true,
    caseId: CASE_ID,
    studentId: STUDENT,
    revision: String(state.revision),
    idempotencyKey: statement.values[2],
    requestHash: statement.values[3],
    safeRecordHash: sha256('database-owned-safe-record'),
    protectedStateHash: sha256('database-owned-protected-state'),
    eventHash: statement.values[5],
    auditEventRef: event.eventRef,
    transactionId,
    state,
    ...overrides,
  };
}

function createFakeExecutor({ respond } = {}) {
  const log = [];
  const metrics = {
    connectionsOpened: 0,
    connectionsReleased: 0,
    activeConnections: 0,
    transactionsCommitted: 0,
    transactionsRolledBack: 0,
  };
  let transactionSequence = 0;

  return {
    serverOnly: true,
    transactional: true,
    log,
    metrics,
    async withConnection(handler) {
      metrics.connectionsOpened += 1;
      metrics.activeConnections += 1;
      const connectionId = `connection-${metrics.connectionsOpened}`;
      try {
        return await handler({
          async transaction(transactionHandler) {
            transactionSequence += 1;
            const transactionId = `tx-${transactionSequence}`;
            try {
              const value = await transactionHandler({
                async execute(statement) {
                  assert.deepEqual(
                    Object.keys(statement).sort(),
                    ['statementId', 'text', 'values'],
                    'driver statement must not include a node-pg prepared name',
                  );
                  const entry = { connectionId, transactionId, ...statement };
                  log.push(entry);
                  if (statement.statementId === ATOMIC_RLS_CASE_STATEMENTS.bindIdentity) {
                    return { rows: [{}] };
                  }
                  if (statement.statementId === ATOMIC_RLS_CASE_STATEMENTS.transactionId) {
                    return { rows: [{ transaction_id: transactionId }] };
                  }
                  if (respond) return respond({ statement, transactionId, log });
                  return { rows: [] };
                },
              });
              metrics.transactionsCommitted += 1;
              return value;
            } catch (error) {
              metrics.transactionsRolledBack += 1;
              throw error;
            }
          },
        });
      } finally {
        metrics.activeConnections -= 1;
        metrics.connectionsReleased += 1;
      }
    },
  };
}

function errorWith(code, message, secret = 'secret-row-value') {
  return Object.assign(new Error(message), {
    code,
    detail: secret,
    hint: `do not leak ${secret}`,
  });
}

async function captureRejection(operation) {
  try {
    await operation();
  } catch (error) {
    return error;
  }
  assert.fail('expected operation to reject');
}

test('contract freezes Option A v2 surface and exactly eight privileged read/command functions', () => {
  assert.equal(ATOMIC_RLS_CASE_DRIVER_CONTRACT.authority, 'DR-120');
  assert.equal(
    ATOMIC_RLS_CASE_DRIVER_CONTRACT.commandReceiptSchema,
    'missionmed.lor.atomic-command-receipt.v2',
  );
  assert.equal(ATOMIC_RLS_CASE_DRIVER_CONTRACT.commandReceiptKeys.length, 16);
  assert.deepEqual(ATOMIC_RLS_CASE_DRIVER_CONTRACT.actorSafeMethods, [
    'commitStudentCaseCreate',
    'commitStudentBuilderAutosave',
    'commitStudentBuilderComplete',
    'commitStudentConsentReceipt',
    'commitStudentWaiverReceipt',
    'commitFacultyFinalDocumentRelease',
  ]);
  assert.deepEqual(ATOMIC_RLS_CASE_DRIVER_CONTRACT.securityDefinerFunctions, [
    'commit_student_case_create',
    'commit_student_builder_autosave',
    'commit_student_builder_complete',
    'commit_student_consent_receipt',
    'commit_student_waiver_receipt',
    'read_mentor_case_projection',
    'read_faculty_case_projection',
    'commit_faculty_final_document_release',
  ]);
  assert.equal(ATOMIC_RLS_CASE_DRIVER_CONTRACT.mentorRead.includes('five_field'), true);
});

test('all five action methods call only their frozen function ABI and accept exact v2 receipts', async (t) => {
  for (const entry of COMMAND_CASES) {
    await t.test(entry.action, async () => {
      const executor = createFakeExecutor({
        respond({ statement, transactionId }) {
          assert.equal(statement.statementId, entry.statementId);
          return { rows: [{ result: commandReceipt({ entry, statement, transactionId }) }] };
        },
      });
      const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
      const command = commandFor(entry);
      const result = await driver[entry.method](command);

      assert.deepEqual(Object.keys(result).sort(), [
        'action',
        'auditEventRef',
        'caseId',
        'committed',
        'eventHash',
        'idempotencyKey',
        'protectedStateHash',
        'replayed',
        'requestHash',
        'revision',
        'safeRecordHash',
        'sameTransaction',
        'schemaVersion',
        'state',
        'studentId',
        'transactionId',
      ]);
      assert.equal(result.action, entry.action);
      assert.equal(result.revision, entry.transition.state.revision);
      assert.equal(Object.isFrozen(result), true);
      assert.equal(Object.isFrozen(result.state), true);

      assert.deepEqual(executor.log.map(({ statementId }) => statementId), [
        ATOMIC_RLS_CASE_STATEMENTS.bindIdentity,
        entry.statementId,
      ]);
      const rpc = executor.log[1];
      assert.match(rpc.text, new RegExp(`^SELECT\\s+lor_studio\\.${entry.functionName}\\(`, 'u'));
      assert.equal(rpc.values.length, entry.valueCount);
      assert.equal(rpc.text.includes('INSERT INTO'), false);
      assert.equal(rpc.text.includes('UPDATE '), false);
      assert.equal(rpc.text.includes('DELETE FROM'), false);
      assert.equal(executor.metrics.connectionsReleased, 1);
      assert.equal(executor.metrics.activeConnections, 0);
      assert.equal(executor.metrics.transactionsCommitted, 1);
    });
  }
});

test('real durable repository calls the real driver with the exact nine-key one-to-one ABI', async () => {
  const entry = COMMAND_CASES[0];
  const executor = createFakeExecutor({
    respond({ statement, transactionId }) {
      assert.equal(statement.statementId, entry.statementId);
      return { rows: [{ result: commandReceipt({ entry, statement, transactionId }) }] };
    },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const repository = new SupabaseDurableRecommendationCaseRepository({
    binding: BINDING,
    driver,
    scopeProvider: ({ caseId, operation, resourceStudentId = STUDENT }) => scope({
      caseId,
      operation,
      resourceStudentId,
      actorId: resourceStudentId,
    }),
  });
  const command = commandFor(entry);
  const stored = await repository.commitStudentCaseCreate({
    state: command.state,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    event: command.event,
    versionEntry: command.versionEntry,
    studentWriteAuthorization: TRUSTED_STUDENT_AUTHORIZATION,
  });
  assert.deepEqual(stored, command.state);
  assert.deepEqual(executor.log.map(({ statementId }) => statementId), [
    ATOMIC_RLS_CASE_STATEMENTS.bindIdentity,
    ATOMIC_RLS_CASE_STATEMENTS.commitStudentCaseCreate,
  ]);
});

test('identity bind is first and contains exactly the 14 frozen transaction-local axes', async () => {
  const entry = COMMAND_CASES[0];
  const executor = createFakeExecutor({
    respond({ statement, transactionId }) {
      return { rows: [{ result: commandReceipt({ entry, statement, transactionId }) }] };
    },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  await driver.commitStudentCaseCreate(commandFor(entry));
  const bind = executor.log[0];
  const settings = [...bind.text.matchAll(/set_config\('([^']+)',\s*\$([0-9]+),\s*(true|false)\)/gu)];
  assert.equal([...bind.text.matchAll(/pg_catalog\.set_config\(/gu)].length, 14);
  assert.deepEqual(settings.map((match) => match[1]), [
    'role',
    'request.jwt.claim.sub',
    'lor_studio.student_auth_subject',
    'lor_studio.actor_role',
    'lor_studio.resource_student_id',
    'lor_studio.case_id',
    'lor_studio.operation',
    'lor_studio.purpose',
    'lor_studio.invitation_id',
    'lor_studio.assignment_id',
    'lor_studio.administrative_grant_id',
    'lor_studio.entitlement_verified',
    'lor_studio.lor_enabled',
    'lor_studio.canary_authorized',
  ]);
  assert.equal(settings.every((match) => match[3] === 'true'), true);
  assert.deepEqual(bind.values, [
    'lor_studio_app',
    AUTH_UID,
    STUDENT,
    'student',
    STUDENT,
    CASE_ID,
    'create',
    'student_case_write',
    '',
    '',
    '',
    'true',
    'true',
    'true',
  ]);
});

test('every missing scope field and every unverified write axis fails before a connection opens', async (t) => {
  const entry = COMMAND_CASES[0];
  const base = commandFor(entry);
  for (const key of Object.keys(base.scope)) {
    await t.test(`missing ${key}`, async () => {
      const executor = createFakeExecutor();
      const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
      const brokenScope = { ...base.scope };
      delete brokenScope[key];
      await assert.rejects(
        () => driver.commitStudentCaseCreate({ ...base, scope: brokenScope }),
        (error) => error.code === 'INTEGRATION_DISABLED',
      );
      assert.equal(executor.metrics.connectionsOpened, 0);
    });
  }
  for (const axis of ['entitlementVerified', 'lorEnabled', 'canaryAuthorized']) {
    await t.test(`${axis} false`, async () => {
      const executor = createFakeExecutor();
      const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
      await assert.rejects(
        () => driver.commitStudentCaseCreate({
          ...base,
          scope: { ...base.scope, [axis]: false },
        }),
        (error) => error.code === 'AUTHORIZATION_DENIED',
      );
      assert.equal(executor.metrics.connectionsOpened, 0);
    });
  }
});

test('student read is one fixed safe SELECT and returns exact two-key envelopes', async () => {
  let found = true;
  const executor = createFakeExecutor({
    respond({ statement }) {
      assert.equal(statement.statementId, ATOMIC_RLS_CASE_STATEMENTS.readStudentSafeCase);
      return { rows: found ? [studentRow()] : [] };
    },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const request = { binding: BINDING, scope: scope(), caseId: CASE_ID };
  const result = await driver.readStudentSafeCase(request);
  assert.deepEqual(Object.keys(result).sort(), ['found', 'state']);
  assert.equal(result.found, true);
  assert.deepEqual(Object.keys(result.state).sort(), [
    'applicantOptions',
    'builder',
    'closedAt',
    'consentReceipts',
    'createdAt',
    'delivery',
    'id',
    'releasedDocument',
    'revision',
    'schemaVersion',
    'status',
    'studentEvidence',
    'studentId',
    'updatedAt',
    'waiverReceipts',
  ]);
  const read = executor.log[1];
  assert.deepEqual(read.values, [CASE_ID, STUDENT]);
  assert.equal(executor.log.length, 2, 'bind plus exactly one read');
  for (const forbidden of [
    'faculty_private_content',
    'protected_revision_states',
    'strategy_metadata',
    'version_history',
  ]) assert.equal(read.text.toLowerCase().includes(forbidden), false);

  found = false;
  const missing = await driver.readStudentSafeCase(request);
  assert.deepEqual(missing, { found: false, state: null });
});

test('mentor read invokes only the exact five-field function and rejects broader output', async () => {
  let extra = false;
  const projection = {
    caseId: CASE_ID,
    status: 'draft',
    strategyStatus: null,
    nextMilestone: null,
    deliveryStatus: 'not_started',
  };
  const executor = createFakeExecutor({
    respond({ statement }) {
      assert.equal(statement.statementId, ATOMIC_RLS_CASE_STATEMENTS.readMentorCaseProjection);
      assert.deepEqual(statement.values, []);
      return { rows: [{ result: extra ? { ...projection, builder: {} } : projection }] };
    },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const request = {
    binding: BINDING,
    scope: scope({
      actorId: MENTOR,
      actorRole: 'mentor',
      assignmentId: 'assignment-1',
      entitlementVerified: false,
      lorEnabled: false,
      canaryAuthorized: false,
    }),
    caseId: CASE_ID,
  };
  const result = await driver.readMentorCaseProjection(request);
  assert.deepEqual(result, { found: true, projection });
  assert.match(executor.log[1].text, /^SELECT lor_studio\.read_mentor_case_projection\(\) AS result$/u);
  extra = true;
  await assert.rejects(
    () => driver.readMentorCaseProjection(request),
    (error) => error.code === 'DOMAIN_INVARIANT',
  );
});

test('faculty read invokes only the exact seven-field actor-safe projection function', async () => {
  let projection = facultyProjection({ revision: 8, releasedAt: null });
  const executor = createFakeExecutor({
    respond({ statement }) {
      assert.equal(statement.statementId, ATOMIC_RLS_CASE_STATEMENTS.readFacultyCaseProjection);
      assert.deepEqual(statement.values, []);
      return { rows: [{ result: projection }] };
    },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const request = {
    binding: BINDING,
    scope: scope({
      actorId: FACULTY,
      actorRole: 'faculty',
      resourceStudentId: STUDENT,
      operation: 'read',
      invitationId: 'invitation-1',
      purpose: 'faculty_private_edit',
    }),
    caseId: CASE_ID,
  };
  assert.deepEqual(await driver.readFacultyCaseProjection(request), {
    found: true,
    projection,
  });
  assert.match(
    executor.log[1].text,
    /^SELECT lor_studio\.read_faculty_case_projection\(\) AS result$/u,
  );
  projection = { ...projection, studentId: STUDENT };
  await assert.rejects(() => driver.readFacultyCaseProjection(request));
});

test('faculty release calls the six-argument command ABI and treats database hashes as opaque digests', async () => {
  const executor = createFakeExecutor({
    respond({ statement, transactionId }) {
      assert.equal(
        statement.statementId,
        ATOMIC_RLS_CASE_STATEMENTS.commitFacultyFinalDocumentRelease,
      );
      return { rows: [{ result: facultyReleaseReceipt(statement, transactionId) }] };
    },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const receipt = await driver.commitFacultyFinalDocumentRelease(facultyReleaseCommand());
  assert.equal(receipt.action, 'faculty.final_document_release');
  assert.equal(receipt.revision, 9);
  assert.deepEqual(receipt.state, facultyProjection());
  const rpc = executor.log[1];
  assert.match(rpc.text, /^SELECT lor_studio\.commit_faculty_final_document_release\(/u);
  assert.deepEqual(rpc.values.slice(0, 4), [
    8,
    'document-1',
    'faculty-release-idempotency',
    sha256('faculty-release-request'),
  ]);
  assert.equal(rpc.values.length, 6);
  assert.equal(rpc.values[5], hashValue(JSON.parse(rpc.values[4])));
  assert.deepEqual(executor.log[0].values.slice(2, 14), [
    FACULTY,
    'faculty',
    STUDENT,
    CASE_ID,
    'save',
    'faculty_private_edit',
    'invitation-1',
    '',
    '',
    'true',
    'true',
    'true',
  ]);
});

test('faculty release scope requires invitation, purpose, and all three trusted axes before SQL', async (t) => {
  const base = facultyReleaseCommand();
  const mutations = [
    { invitationId: null },
    { purpose: 'case_workflow' },
    { entitlementVerified: false },
    { lorEnabled: false },
    { canaryAuthorized: false },
  ];
  for (const mutation of mutations) {
    await t.test(JSON.stringify(mutation), async () => {
      const executor = createFakeExecutor();
      const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
      await assert.rejects(() => driver.commitFacultyFinalDocumentRelease({
        ...base,
        scope: { ...base.scope, ...mutation },
      }), (error) => error.code === 'AUTHORIZATION_DENIED');
      assert.equal(executor.metrics.connectionsOpened, 0);
    });
  }
});

test('target, case, subject, role evidence, and pseudonym binding all fail closed', async (t) => {
  const entry = COMMAND_CASES[0];
  const base = commandFor(entry);
  const attempts = [
    { label: 'target', command: { ...base, binding: { ...BINDING, projectRef: 'other-target' } } },
    { label: 'case', command: { ...base, scope: { ...base.scope, caseId: 'case-other' } } },
    { label: 'subject', command: { ...base, scope: { ...base.scope, resourceStudentId: 'wp:99' } } },
    { label: 'actor', command: { ...base, scope: { ...base.scope, actorId: 'wp:99' } } },
    { label: 'student assignment', command: { ...base, scope: { ...base.scope, assignmentId: 'a-1' } } },
    {
      label: 'event actor ref',
      command: {
        ...base,
        event: { ...base.event, actorRef: `actor_${sha256('wrong')}` },
      },
    },
  ];
  for (const attempt of attempts) {
    await t.test(attempt.label, async () => {
      const executor = createFakeExecutor();
      const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
      await assert.rejects(() => driver.commitStudentCaseCreate(attempt.command));
      assert.equal(executor.metrics.connectionsOpened, 0);
    });
  }
});

test('creation reservation binds canonical subject and UUID and replays without allocating again', async () => {
  const creationRef = `case_creation_${sha256('creation-key')}`;
  const actorRef = `actor_${sha256(`lor-studio:actor:${STUDENT}`)}`;
  const requestHash = sha256('reservation-request');
  let alreadyExists = false;
  const stored = {
    case_id: CASE_ID,
    builder_session_id: BUILDER_SESSION_ID,
    created_at: new Date(CREATED_AT),
    request_hash: requestHash,
    transaction_id: 'tx-original',
  };
  const executor = createFakeExecutor({
    respond({ statement, transactionId }) {
      if (statement.statementId === ATOMIC_RLS_CASE_STATEMENTS.insertCreationReservation) {
        if (alreadyExists) return { rows: [] };
        alreadyExists = true;
        return { rows: [{ ...stored, transaction_id: transactionId }] };
      }
      assert.equal(statement.statementId, ATOMIC_RLS_CASE_STATEMENTS.selectCreationReservation);
      return { rows: [stored] };
    },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const request = {
    binding: BINDING,
    scope: scope({ caseId: creationRef, operation: 'create' }),
    operation: 'reserve_create',
    creationRef,
    actorRef,
    idempotencyKey: 'reserve-idem',
    requestHash,
    proposedIdentifiers: {
      caseId: CASE_ID,
      builderSessionId: BUILDER_SESSION_ID,
      createdAt: CREATED_AT,
    },
  };
  const created = await driver.reserveCaseCreation(request);
  const replay = await driver.reserveCaseCreation(request);
  assert.equal(created.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.transactionId, 'tx-original');
  const insert = executor.log.find(
    ({ statementId }) => statementId === ATOMIC_RLS_CASE_STATEMENTS.insertCreationReservation,
  );
  assert.equal(insert.values[1], STUDENT);
  assert.equal(insert.values[2], AUTH_UID);
  const select = executor.log.find(
    ({ statementId }) => statementId === ATOMIC_RLS_CASE_STATEMENTS.selectCreationReservation,
  );
  assert.deepEqual(select.values, [creationRef, STUDENT, AUTH_UID, actorRef]);
  assert.equal(executor.metrics.connectionsReleased, 2);
  assert.equal(executor.metrics.activeConnections, 0);
});

test('exact replay can return the stored target state before candidate semantic validation', async () => {
  const entry = COMMAND_CASES[1];
  const laterCandidate = FIXTURES.completed.state;
  const laterEvent = metadataEvent(laterCandidate, 'builder.step_completed', 'later-rebuilt-candidate');
  const reconstructed = commandFor(entry, {
    state: laterCandidate,
    event: laterEvent,
    versionEntry: FIXTURES.completed.versionEntry,
  });
  const storedState = FIXTURES.autosaved.state;
  const storedEvent = metadataEvent(storedState, 'builder.autosaved', 'stored-autosave');
  const executor = createFakeExecutor({
    respond({ statement, transactionId }) {
      return {
        rows: [{
          result: commandReceipt({
            entry,
            statement,
            transactionId,
            overrides: {
              replayed: true,
              state: storedState,
              revision: String(storedState.revision),
              safeRecordHash: hashValue(storedState),
              eventHash: hashValue(storedEvent),
              auditEventRef: storedEvent.eventRef,
              transactionId: 'tx-original',
            },
          }),
        }],
      };
    },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const receipt = await driver.commitStudentBuilderAutosave(reconstructed);
  assert.equal(receipt.replayed, true);
  assert.equal(receipt.revision, 1);
  assert.deepEqual(receipt.state, storedState);
  assert.equal(receipt.transactionId, 'tx-original');
});

test('a non-replay receipt may not diverge from the candidate state/event', async () => {
  const entry = COMMAND_CASES[1];
  const executor = createFakeExecutor({
    respond({ statement, transactionId }) {
      return {
        rows: [{
          result: commandReceipt({
            entry,
            statement,
            transactionId,
            overrides: { eventHash: sha256('different-event') },
          }),
        }],
      };
    },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  await assert.rejects(
    () => driver.commitStudentBuilderAutosave(commandFor(entry)),
    (error) => error.code === 'INTEGRATION_DISABLED'
      && error.details.status === 'ATOMIC_COMMAND_RECEIPT_BINDING_INVALID',
  );
  assert.equal(executor.metrics.transactionsRolledBack, 1);
  assert.equal(executor.metrics.connectionsReleased, 1);
});

test('strict receipt acceptance rejects extra fields, malformed hashes, and unsafe bigint revisions', async (t) => {
  const entry = COMMAND_CASES[0];
  const mutations = [
    { label: 'extra field', mutate: (receipt) => ({ ...receipt, facultyPrivate: { draftText: 'leak' } }) },
    { label: 'safe hash malformed', mutate: (receipt) => ({ ...receipt, safeRecordHash: 'nope' }) },
    { label: 'protected hash malformed', mutate: (receipt) => ({ ...receipt, protectedStateHash: 'nope' }) },
    {
      label: 'unsafe revision',
      mutate: (receipt) => ({ ...receipt, revision: '9007199254740992' }),
    },
  ];
  for (const mutation of mutations) {
    await t.test(mutation.label, async () => {
      const executor = createFakeExecutor({
        respond({ statement, transactionId }) {
          return {
            rows: [{ result: mutation.mutate(commandReceipt({ entry, statement, transactionId })) }],
          };
        },
      });
      const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
      await assert.rejects(
        () => driver.commitStudentCaseCreate(commandFor(entry)),
        (error) => error.code === 'INTEGRATION_DISABLED',
      );
      assert.equal(executor.metrics.transactionsRolledBack, 1);
      assert.equal(executor.metrics.connectionsReleased, 1);
    });
  }
});

test('node-pg bigint strings normalize at both read and command receipt boundaries', async () => {
  const entry = COMMAND_CASES[0];
  let mode = 'command';
  const executor = createFakeExecutor({
    respond({ statement, transactionId }) {
      if (mode === 'read') return { rows: [studentRow()] };
      return { rows: [{ result: commandReceipt({ entry, statement, transactionId }) }] };
    },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const receipt = await driver.commitStudentCaseCreate(commandFor(entry));
  assert.equal(receipt.revision, 0);
  mode = 'read';
  const read = await driver.readStudentSafeCase({ binding: BINDING, scope: scope(), caseId: CASE_ID });
  assert.equal(read.state.revision, 0);
});

test('stable database rejections map to safe domain errors and unknown errors are sanitized', async (t) => {
  const entry = COMMAND_CASES[1];
  const cases = [
    { code: 'P1001', message: 'LOR_CASE_NOT_FOUND', expected: 'NOT_FOUND' },
    { code: 'P1002', message: 'LOR_STALE_REVISION', expected: 'STALE_REVISION' },
    { code: 'P1003', message: 'LOR_IDEMPOTENCY_CONFLICT', expected: 'IDEMPOTENCY_CONFLICT' },
    { code: 'P1004', message: 'LOR_AUTHORIZATION_DENIED', expected: 'AUTHORIZATION_DENIED' },
    { code: 'P1005', message: 'LOR_COMMAND_INVALID', expected: 'INTEGRATION_DISABLED' },
  ];
  for (const item of cases) {
    await t.test(item.code, async () => {
      const executor = createFakeExecutor({
        respond() { throw errorWith(item.code, item.message); },
      });
      const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
      const error = await captureRejection(
        () => driver.commitStudentBuilderAutosave(commandFor(entry)),
      );
      assert.equal(error.code, item.expected);
      assert.equal(JSON.stringify(error).includes('secret-row-value'), false);
      if (item.code === 'P1002') {
        assert.equal(error.details.actualRevision, null);
        assert.equal(error.details.expectedRevision, 0);
      }
      assert.equal(executor.metrics.transactionsRolledBack, 1);
      assert.equal(executor.metrics.connectionsReleased, 1);
      assert.equal(executor.metrics.activeConnections, 0);
    });
  }

  const executor = createFakeExecutor({
    respond() { throw errorWith('23505', 'duplicate key contains private@example.test'); },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const error = await captureRejection(
    () => driver.commitStudentBuilderAutosave(commandFor(entry)),
  );
  assert.equal(error.code, 'INTEGRATION_DISABLED');
  assert.equal(error.details.status, 'ATOMIC_TRANSACTION_FAILED');
  assert.equal(error.message.includes('private@example.test'), false);
  assert.equal(JSON.stringify(error).includes('secret-row-value'), false);
});

test('wrong code/message pairs never spoof the allowlisted rejection mapping', async () => {
  const entry = COMMAND_CASES[1];
  const executor = createFakeExecutor({
    respond() { throw errorWith('P1002', 'LOR_IDEMPOTENCY_CONFLICT'); },
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const error = await captureRejection(
    () => driver.commitStudentBuilderAutosave(commandFor(entry)),
  );
  assert.equal(error.code, 'INTEGRATION_DISABLED');
  assert.equal(error.details.status, 'ATOMIC_TRANSACTION_FAILED');
});

test('legacy full-aggregate seams fail before SQL and direct protected DML is absent from source', async () => {
  const executor = createFakeExecutor();
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  await assert.rejects(
    () => driver.selectCase({}),
    (error) => error.details.status === 'FULL_AGGREGATE_READ_REQUIRES_ACTOR_SAFE_ADAPTER',
  );
  await assert.rejects(
    () => driver.executeAtomicCaseCommand({}),
    (error) => error.details.status === 'FULL_AGGREGATE_WRITE_REQUIRES_ACTOR_SAFE_COMMAND',
  );
  assert.equal(executor.metrics.connectionsOpened, 0);

  const source = readFileSync(
    fileURLToPath(new URL('../../lor-studio/adapters/atomic-rls-case-driver.mjs', import.meta.url)),
    'utf8',
  );
  for (const forbidden of [
    /INSERT\s+INTO\s+lor_studio\.recommendation_cases/iu,
    /UPDATE\s+lor_studio\.recommendation_cases/iu,
    /INSERT\s+INTO\s+lor_studio\.recommendation_case_audit_events/iu,
    /INSERT\s+INTO\s+lor_studio\.recommendation_case_write_receipts/iu,
    /INSERT\s+INTO\s+lor_studio\.recommendation_case_protected_revision_states/iu,
    /executeStudentCommand\s*\(/u,
  ]) assert.equal(forbidden.test(source), false);
  assert.equal((source.match(/INSERT\s+INTO/giu) ?? []).length, 1, 'only scoped creation reservation DML remains');
});

test('unvalidated constructor bindings and malformed executor contracts are rejected', () => {
  const executor = createFakeExecutor();
  assert.throws(
    () => createAtomicRlsCaseDriver({ binding: { ...BINDING }, executor }),
    (error) => error.code === 'INTEGRATION_DISABLED'
      && error.details.status === 'VALIDATED_TARGET_BINDING_REQUIRED',
  );
  assert.throws(
    () => createAtomicRlsCaseDriver({ binding: BINDING, executor: { serverOnly: true } }),
    (error) => error.code === 'INTEGRATION_DISABLED'
      && error.details.status === 'SQL_EXECUTOR_PORT_REQUIRED',
  );
});
