import assert from 'node:assert/strict';
import test from 'node:test';

import {
  IntegrationDisabledError,
  ValidationError,
} from '../../lor-studio/domain/errors.js';
import { resolveLorTargetBinding } from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  SupabaseDurableMentorAssignmentRepository,
} from '../../lor-studio/repositories/supabase-durable-mentor-assignment-repository.mjs';
import {
  DURABLE_MENTOR_ASSIGNMENT_OPERATOR_CONTRACT,
  createDurableMentorAssignmentOperator,
  isAuthenticDurableMentorAssignmentOperator,
} from '../../lor-studio/services/durable-mentor-assignment-service.mjs';

const ASSIGNMENT_ID = `mentor_service_assignment_${'a'.repeat(64)}`;
const NOW = '2026-08-26T16:00:00.000Z';
const EXPIRES_AT = '2026-09-25T16:00:00.000Z';
const HASH = 'b'.repeat(64);
const EVENT_HASH = 'c'.repeat(64);
const EVENT_REF = `event_${'d'.repeat(64)}`;

function binding() {
  return resolveLorTargetBinding({
    schemaVersion: 'missionmed.lor.target-binding.v2',
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'local',
    provider: 'railway-postgres',
    projectId: 'lor-local-project-a',
    environmentId: 'lor-local-environment-a',
    serviceId: 'lor-local-service-a',
    databaseName: 'railway',
    region: 'us-west2',
    schema: 'lor_studio',
    migrationLedger: 'lor_studio/migrations/local',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: false,
  });
}

function receipt(action, overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.mentor-assignment-command-receipt.v1',
    action,
    committed: true,
    replayed: false,
    assignmentId: ASSIGNMENT_ID,
    caseId: 'case-mentor-1',
    studentAuthSubject: 'wp:101',
    mentorAuthSubject: 'wp:202',
    mentorAuthUid: 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa',
    operation: 'read',
    purpose: 'mentor_case_read',
    assignedAt: NOW,
    expiresAt: EXPIRES_AT,
    revokedAt: action === 'mentor.assignment_revoked' ? NOW : null,
    assignmentHash: HASH,
    revocationHash: action === 'mentor.assignment_revoked' ? HASH : null,
    auditEventRef: EVENT_REF,
    eventHash: EVENT_HASH,
    transactionId: '101',
    ...overrides,
  };
}

function driver() {
  const calls = [];
  return {
    calls,
    serverOnly: true,
    rlsEnforced: true,
    databaseClock: true,
    atomicMentorAssignmentCommands: true,
    async assignMentorCaseAtomic(command) {
      calls.push(['assign', command]);
      return receipt('mentor.assignment_issued');
    },
    async revokeMentorCaseAssignmentAtomic(command) {
      calls.push(['revoke', command]);
      return receipt('mentor.assignment_revoked');
    },
  };
}

function harness(rawDriver = driver()) {
  const targetBinding = binding();
  const repository = new SupabaseDurableMentorAssignmentRepository({
    binding: targetBinding,
    driver: rawDriver,
  });
  const operator = createDurableMentorAssignmentOperator({ repository });
  return { targetBinding, repository, driver: rawDriver, operator };
}

test('trusted operator assigns read-only mentor access through the durable command port', async () => {
  const { targetBinding, driver: durableDriver, operator } = harness();
  const command = {
    caseId: 'case-mentor-1',
    studentAuthSubject: 'wp:101',
    mentorAuthSubject: 'wp:202',
    purpose: 'mentor_case_read',
    maximumLifetimeSeconds: 2_592_000,
    idempotencyKey: 'mentor-assign-101',
  };
  const result = await operator.assign(command);

  assert.equal(isAuthenticDurableMentorAssignmentOperator(operator), true);
  assert.equal(Object.isFrozen(operator), true);
  assert.deepEqual(Reflect.ownKeys(operator), ['assign', 'revoke']);
  assert.equal(result.action, 'mentor.assignment_issued');
  assert.equal(result.operation, 'read');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(durableDriver.calls.length, 1);
  assert.equal(durableDriver.calls[0][0], 'assign');
  assert.equal(durableDriver.calls[0][1].binding, targetBinding);
  assert.deepEqual(
    { ...durableDriver.calls[0][1], binding: undefined },
    { ...command, binding: undefined },
  );
});

test('trusted operator revokes the exact assignment without caller-owned hashes or time', async () => {
  const { driver: durableDriver, operator } = harness();
  const command = {
    caseId: 'case-mentor-1',
    studentAuthSubject: 'wp:101',
    assignmentId: ASSIGNMENT_ID,
    reasonCode: 'OPERATOR_REVOKED',
    idempotencyKey: 'mentor-revoke-101',
  };
  const result = await operator.revoke(command);

  assert.equal(result.action, 'mentor.assignment_revoked');
  assert.equal(result.assignmentId, ASSIGNMENT_ID);
  assert.match(result.revocationHash, /^[a-f0-9]{64}$/u);
  assert.equal(durableDriver.calls[0][0], 'revoke');
  assert.deepEqual(
    Object.keys(durableDriver.calls[0][1]).sort(),
    [...Object.keys(command), 'binding'].sort(),
  );
});

test('operator rejects browser-shaped authority fields, unsafe roles, and unbounded expiry', async () => {
  const { driver: durableDriver, operator } = harness();
  const valid = {
    caseId: 'case-mentor-1',
    studentAuthSubject: 'wp:101',
    mentorAuthSubject: 'wp:202',
    purpose: 'mentor_case_read',
    maximumLifetimeSeconds: 2_592_000,
    idempotencyKey: 'mentor-assign-101',
  };
  await assert.rejects(
    operator.assign({ ...valid, actorRole: 'admin' }),
    (error) => error instanceof ValidationError,
  );
  await assert.rejects(
    operator.assign({ ...valid, mentorAuthSubject: 'service:admin' }),
    (error) => error instanceof ValidationError,
  );
  await assert.rejects(
    operator.assign({ ...valid, maximumLifetimeSeconds: 15_552_001 }),
    (error) => error instanceof ValidationError,
  );
  await assert.rejects(
    operator.assign({ ...valid, studentAuthSubject: 'wp:202' }),
    (error) => error instanceof ValidationError,
  );
  assert.equal(durableDriver.calls.length, 0);
});

test('operator snapshots plain data and never evaluates accessor commands', async () => {
  const { driver: durableDriver, operator } = harness();
  let reads = 0;
  const raw = {
    caseId: 'case-mentor-1',
    studentAuthSubject: 'wp:101',
    mentorAuthSubject: 'wp:202',
    purpose: 'mentor_case_read',
    maximumLifetimeSeconds: 2_592_000,
  };
  Object.defineProperty(raw, 'idempotencyKey', {
    enumerable: true,
    get() {
      reads += 1;
      return 'mentor-assign-101';
    },
  });
  await assert.rejects(
    operator.assign(raw),
    (error) => error instanceof ValidationError,
  );
  assert.equal(reads, 0);
  assert.equal(durableDriver.calls.length, 0);
});

test('repository fails closed on a forged driver and on a malformed database receipt', async () => {
  assert.throws(
    () => new SupabaseDurableMentorAssignmentRepository({
      binding: binding(),
      driver: {
        serverOnly: true,
        rlsEnforced: true,
        databaseClock: true,
        atomicMentorAssignmentCommands: true,
      },
    }),
    (error) => error instanceof IntegrationDisabledError,
  );

  const badDriver = driver();
  badDriver.assignMentorCaseAtomic = async () => receipt(
    'mentor.assignment_issued',
    { operation: 'save' },
  );
  const { operator } = harness(badDriver);
  await assert.rejects(
    operator.assign({
      caseId: 'case-mentor-1',
      studentAuthSubject: 'wp:101',
      mentorAuthSubject: 'wp:202',
      purpose: 'mentor_case_read',
      maximumLifetimeSeconds: 2_592_000,
      idempotencyKey: 'mentor-assign-101',
    }),
    (error) => error instanceof IntegrationDisabledError
      && error.code === 'INTEGRATION_DISABLED',
  );

  const wrongLifetimeDriver = driver();
  wrongLifetimeDriver.assignMentorCaseAtomic = async () => receipt(
    'mentor.assignment_issued',
    { expiresAt: '2026-08-26T17:00:00.000Z' },
  );
  const { operator: lifetimeOperator } = harness(wrongLifetimeDriver);
  await assert.rejects(
    lifetimeOperator.assign({
      caseId: 'case-mentor-1',
      studentAuthSubject: 'wp:101',
      mentorAuthSubject: 'wp:202',
      purpose: 'mentor_case_read',
      maximumLifetimeSeconds: 2_592_000,
      idempotencyKey: 'mentor-assign-101',
    }),
    (error) => error instanceof IntegrationDisabledError
      && error.code === 'INTEGRATION_DISABLED',
  );
});

test('operator contract exposes no browser route and fixes database-owned fields', () => {
  assert.equal(DURABLE_MENTOR_ASSIGNMENT_OPERATOR_CONTRACT.browserRoute, false);
  assert.equal(
    DURABLE_MENTOR_ASSIGNMENT_OPERATOR_CONTRACT.transport,
    'module_private_server_side_only',
  );
  assert.equal(DURABLE_MENTOR_ASSIGNMENT_OPERATOR_CONTRACT.operation, 'read_only_mentor_case_access');
  assert.deepEqual(DURABLE_MENTOR_ASSIGNMENT_OPERATOR_CONTRACT.lifetimeSeconds, {
    minimum: 300,
    maximum: 15_552_000,
  });
  assert.equal(
    DURABLE_MENTOR_ASSIGNMENT_OPERATOR_CONTRACT.databaseOwned.includes('assignmentHash'),
    true,
  );
});
