import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
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
  autosaveBuilderStep,
  createRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import { hashValue, sha256 } from '../../lor-studio/domain/value-utils.js';
import { SupabaseDurableRecommendationCaseRepository } from '../../lor-studio/repositories/supabase-durable-recommendation-case-repository.mjs';
import { createMetadataServiceEvent } from '../../lor-studio/services/metadata-events.js';

const STUDENT = 'wp:41';
const AUTH_UID = '4c1d4b2e-1f1a-4a67-9a1a-7b0f0c9d5e01';
const CASE_ID = 'case_durable_0001';
const BUILDER_SESSION_ID = 'builder_durable_0001';
const CREATED_AT = '2026-08-19T09:00:00.000Z';

/* ------------------------------------------------------------------ target */

function stagingTargetConfiguration(overrides = {}) {
  return {
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    ratified: true,
    decisionRecord: 'DR-119',
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

const BINDING = resolveLorTargetBinding(stagingTargetConfiguration());

/* ------------------------------------------------- fake transactional store */

/**
 * A fake that models what actually matters about PostgreSQL here: statements run
 * inside a transaction, writes are invisible until COMMIT, a rejected handler
 * ROLLBACKs and rethrows, and a row write takes a lock that a competing writer
 * must wait for - after which it re-evaluates its WHERE clause against the newly
 * committed row, exactly as READ COMMITTED does.
 *
 * It dispatches on the driver's prepared-statement NAMES, but it reads the real
 * SQL text for the identity statement, so is_local is observed rather than
 * assumed.
 */

function createDatabase() {
  return {
    cases: new Map(),
    audit: new Map(),
    reservations: new Map(),
    receipts: new Map(),
  };
}

function createMutex() {
  let tail = Promise.resolve();
  return async function acquire() {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const prior = tail;
    tail = tail.then(() => gate);
    await prior;
    return release;
  };
}

function receiptKey(caseId, idempotencyKey) {
  return `${caseId} ${idempotencyKey}`;
}

function createFakeSqlExecutor({ database = createDatabase(), control = {} } = {}) {
  const log = [];
  const identityBindings = [];
  const mutexes = new Map();
  let transactionSequence = 0;
  let connectionsOpened = 0;
  let resetCount = 0;
  let sessionScopedWrites = 0;

  function mutexFor(key) {
    if (!mutexes.has(key)) mutexes.set(key, createMutex());
    return mutexes.get(key);
  }

  async function acquire(transaction, key) {
    if (transaction.locks.has(key)) return;
    transaction.locks.set(key, await mutexFor(key)());
  }

  function releaseKey(transaction, key) {
    const release = transaction.locks.get(key);
    if (release) {
      transaction.locks.delete(key);
      release();
    }
  }

  function releaseAll(transaction) {
    for (const key of [...transaction.locks.keys()]) releaseKey(transaction, key);
  }

  function assertStatementShape(candidate) {
    assert.ok(candidate && typeof candidate === 'object', 'statement must be an object');
    assert.ok(
      candidate.name === null || (typeof candidate.name === 'string' && candidate.name.length > 0),
      'statement name must be a non-empty string or null',
    );
    assert.equal(typeof candidate.text, 'string');
    assert.ok(candidate.text.trim().length > 0);
    assert.ok(Array.isArray(candidate.values));
  }

  function readCase(transaction, caseId) {
    if (transaction?.pending.cases.has(caseId)) return transaction.pending.cases.get(caseId);
    return database.cases.get(caseId) ?? null;
  }

  function readReceipt(transaction, key) {
    if (transaction?.pending.receipts.has(key)) return transaction.pending.receipts.get(key);
    return database.receipts.get(key) ?? null;
  }

  function readReservation(transaction, creationRef) {
    if (transaction?.pending.reservations.has(creationRef)) {
      return transaction.pending.reservations.get(creationRef);
    }
    return database.reservations.get(creationRef) ?? null;
  }

  function bindIdentity(transaction, statement) {
    const pattern = /set_config\('([^']+)',\s*\$(\d+),\s*(true|false)\)/gu;
    const applied = {};
    let match = pattern.exec(statement.text);
    while (match) {
      const [, setting, position, isLocal] = match;
      const value = statement.values[Number(position) - 1];
      applied[setting] = value;
      if (isLocal === 'true') transaction.settings.set(setting, value);
      else sessionScopedWrites += 1;
      match = pattern.exec(statement.text);
    }
    identityBindings.push({ transactionId: transaction.transactionId, applied });
    return { rows: [{ ...applied }] };
  }

  async function dispatch(transaction, statement) {
    const values = statement.values;
    switch (statement.name) {
      case ATOMIC_RLS_CASE_STATEMENTS.bindIdentity:
        return bindIdentity(transaction, statement);

      case ATOMIC_RLS_CASE_STATEMENTS.transactionId:
        return { rows: [{ transaction_id: transaction.transactionId }] };

      case ATOMIC_RLS_CASE_STATEMENTS.selectCase: {
        const row = readCase(transaction, values[0]);
        if (!row || row.student_id !== values[1]) return { rows: [] };
        return { rows: [{ record: structuredClone(row.record), revision: row.revision }] };
      }

      case ATOMIC_RLS_CASE_STATEMENTS.selectRevision: {
        const row = readCase(transaction, values[0]);
        if (!row || row.student_id !== values[1]) return { rows: [] };
        return { rows: [{ revision: row.revision }] };
      }

      case ATOMIC_RLS_CASE_STATEMENTS.selectWriteReceipt: {
        const row = readReceipt(transaction, receiptKey(values[0], values[1]));
        // The real statement binds `AND student_id = $3`, so the fake must apply that predicate
        // too. It previously keyed on case_id + idempotency_key alone, which made it strictly more
        // forgiving than PostgreSQL and hid an owner-blind replay: an idempotency key is unique
        // only within a case, so a caller scoped to one student could receive another student's
        // stored record. A fake that cannot fail the way the database fails proves nothing.
        if (!row || row.student_id !== values[2]) return { rows: [] };
        return {
          rows: [{
            request_hash: row.request_hash,
            operation: row.operation,
            revision: row.revision,
            record: structuredClone(row.record),
            record_hash: row.record_hash,
            event_hash: row.event_hash,
            audit_event_ref: row.audit_event_ref,
            transaction_id: row.transaction_id,
          }],
        };
      }

      case ATOMIC_RLS_CASE_STATEMENTS.insertState: {
        const [caseId, studentId, revision, status, createdAt, updatedAt, recordJson, recordHash] = values;
        const key = `case:${caseId}`;
        await acquire(transaction, key);
        if (readCase(transaction, caseId)) {
          releaseKey(transaction, key);
          return { rows: [] };
        }
        const record = JSON.parse(recordJson);
        transaction.pending.cases.set(caseId, {
          case_id: caseId,
          student_id: studentId,
          revision,
          status,
          created_at: createdAt,
          updated_at: updatedAt,
          record,
          record_hash: recordHash,
          writtenInTransaction: transaction.transactionId,
        });
        return {
          rows: [{
            record: structuredClone(record),
            revision,
            transaction_id: transaction.transactionId,
          }],
        };
      }

      case ATOMIC_RLS_CASE_STATEMENTS.updateState: {
        const [revision, status, updatedAt, recordJson, recordHash, caseId, studentId,
          expectedRevision] = values;
        const key = `case:${caseId}`;
        await acquire(transaction, key);
        // Re-read AFTER the lock: this is the moment a loser discovers the winner.
        const current = readCase(transaction, caseId);
        if (!current || current.student_id !== studentId || current.revision !== expectedRevision) {
          releaseKey(transaction, key);
          return { rows: [] };
        }
        const record = JSON.parse(recordJson);
        transaction.pending.cases.set(caseId, {
          ...current,
          revision,
          status,
          updated_at: updatedAt,
          record,
          record_hash: recordHash,
          writtenInTransaction: transaction.transactionId,
        });
        return {
          rows: [{
            record: structuredClone(record),
            revision,
            transaction_id: transaction.transactionId,
          }],
        };
      }

      case ATOMIC_RLS_CASE_STATEMENTS.insertAuditEvent: {
        const [eventRef, caseId, caseRef, actorRef, actorRole, correlationRef, eventType,
          outcome, revision, occurredAt, eventJson, eventHash] = values;
        const key = `audit:${eventRef}`;
        await acquire(transaction, key);
        if (transaction.pending.audit.has(eventRef) || database.audit.has(eventRef)) {
          releaseKey(transaction, key);
          return { rows: [] };
        }
        transaction.pending.audit.set(eventRef, {
          event_ref: eventRef,
          case_id: caseId,
          case_ref: caseRef,
          actor_ref: actorRef,
          actor_role: actorRole,
          correlation_ref: correlationRef,
          event_type: eventType,
          outcome,
          revision,
          occurred_at: occurredAt,
          event: JSON.parse(eventJson),
          event_hash: eventHash,
          transaction_id: transaction.transactionId,
        });
        return { rows: [{ event_ref: eventRef, transaction_id: transaction.transactionId }] };
      }

      case ATOMIC_RLS_CASE_STATEMENTS.insertWriteReceipt: {
        const [caseId, studentId, idempotencyKey, requestHash, operation, revision, recordJson,
          recordHash, eventHash, auditEventRef] = values;
        const key = receiptKey(caseId, idempotencyKey);
        await acquire(transaction, `receipt:${key}`);
        if (readReceipt(transaction, key)) {
          releaseKey(transaction, `receipt:${key}`);
          return { rows: [] };
        }
        transaction.pending.receipts.set(key, {
          case_id: caseId,
          student_id: studentId,
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          operation,
          revision,
          record: JSON.parse(recordJson),
          record_hash: recordHash,
          event_hash: eventHash,
          audit_event_ref: auditEventRef,
          transaction_id: transaction.transactionId,
        });
        return { rows: [{ transaction_id: transaction.transactionId }] };
      }

      case ATOMIC_RLS_CASE_STATEMENTS.insertCreationReservation: {
        const [creationRef, actorRef, idempotencyKey, requestHash, caseId,
          builderSessionId, createdAt] = values;
        const key = `reservation:${creationRef}`;
        await acquire(transaction, key);
        if (readReservation(transaction, creationRef)) {
          releaseKey(transaction, key);
          return { rows: [] };
        }
        transaction.pending.reservations.set(creationRef, {
          creation_ref: creationRef,
          actor_ref: actorRef,
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          case_id: caseId,
          builder_session_id: builderSessionId,
          created_at: createdAt,
          transaction_id: transaction.transactionId,
        });
        return {
          rows: [{
            case_id: caseId,
            builder_session_id: builderSessionId,
            // timestamptz comes back from node-pg as a Date, not a string.
            created_at: new Date(createdAt),
            request_hash: requestHash,
            transaction_id: transaction.transactionId,
          }],
        };
      }

      case ATOMIC_RLS_CASE_STATEMENTS.selectCreationReservation: {
        const row = readReservation(transaction, values[0]);
        if (!row || row.actor_ref !== values[1]) return { rows: [] };
        return {
          rows: [{
            case_id: row.case_id,
            builder_session_id: row.builder_session_id,
            created_at: new Date(row.created_at),
            request_hash: row.request_hash,
            transaction_id: row.transaction_id,
          }],
        };
      }

      default:
        throw new Error(`unexpected statement ${String(statement.name)}`);
    }
  }

  async function execute(context, statement, transaction) {
    assertStatementShape(statement);
    log.push({
      connectionId: context.connectionId,
      transactionId: transaction ? transaction.transactionId : null,
      name: statement.name,
      text: statement.text,
      values: [...statement.values],
    });
    if (control.beforeStatement) {
      await control.beforeStatement({
        name: statement.name,
        transactionId: transaction ? transaction.transactionId : null,
      });
    }
    if (statement.text === 'DISCARD ALL') {
      // Faithful to PostgreSQL: DISCARD ALL cannot run inside a transaction block.
      assert.equal(transaction, undefined, 'DISCARD ALL must be issued outside a transaction');
      resetCount += 1;
      return { rows: [] };
    }
    assert.ok(transaction, `statement ${String(statement.name)} must run inside a transaction`);
    if (control.failOn && control.failOn === statement.name) {
      throw new Error('simulated database failure');
    }
    return dispatch(transaction, statement);
  }

  function commit(transaction) {
    for (const [key, row] of transaction.pending.cases) database.cases.set(key, row);
    for (const [key, row] of transaction.pending.audit) database.audit.set(key, row);
    for (const [key, row] of transaction.pending.reservations) database.reservations.set(key, row);
    for (const [key, row] of transaction.pending.receipts) database.receipts.set(key, row);
    transaction.settings.clear();
    releaseAll(transaction);
  }

  function rollback(transaction) {
    transaction.pending.cases.clear();
    transaction.pending.audit.clear();
    transaction.pending.reservations.clear();
    transaction.pending.receipts.clear();
    transaction.settings.clear();
    releaseAll(transaction);
  }

  return {
    serverOnly: true,
    transactional: true,
    async withConnection(handler) {
      connectionsOpened += 1;
      const context = { connectionId: `conn_${connectionsOpened}` };
      const connection = {
        execute: (statement) => execute(context, statement, undefined),
        async transaction(runner) {
          transactionSequence += 1;
          const transaction = {
            transactionId: `xact_${transactionSequence}`,
            pending: {
              cases: new Map(),
              audit: new Map(),
              reservations: new Map(),
              receipts: new Map(),
            },
            locks: new Map(),
            settings: new Map(),
          };
          try {
            const result = await runner({
              execute: (statement) => execute(context, statement, transaction),
            });
            commit(transaction);
            return result;
          } catch (error) {
            rollback(transaction);
            throw error;
          }
        },
      };
      return handler(connection);
    },
    database,
    log,
    identityBindings,
    stats: () => ({ connectionsOpened, resetCount, sessionScopedWrites }),
  };
}

/* --------------------------------------------------------------- fixtures */

function verifiedScope(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: AUTH_UID,
    authenticatedSubject: STUDENT,
    actorId: STUDENT,
    actorRole: 'student',
    resourceStudentId: STUDENT,
    caseId: CASE_ID,
    operation: 'save',
    purpose: 'case_workflow',
    assignmentId: null,
    invitationId: null,
    administrativeGrantId: null,
    ...overrides,
  };
}

function scopeProvider({ caseId, operation, resourceStudentId }) {
  return verifiedScope({
    caseId,
    operation,
    resourceStudentId: resourceStudentId ?? STUDENT,
  });
}

function buildRepository(executor) {
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const repository = new SupabaseDurableRecommendationCaseRepository({
    binding: BINDING,
    driver,
    scopeProvider,
  });
  return { driver, repository };
}

function baseRecord() {
  return createRecommendationCase({
    id: CASE_ID,
    studentId: STUDENT,
    now: CREATED_AT,
    builderSessionId: BUILDER_SESSION_ID,
  });
}

function advance(record, { stepId = 'case_basics', now, value = 'a' }) {
  return autosaveBuilderStep(record, {
    actorId: STUDENT,
    stepId,
    stepData: { marker: value },
    now,
  });
}

function eventFor(record, { eventId, eventType, correlationId = 'corr_1' }) {
  return createMetadataServiceEvent({
    eventId,
    eventType,
    caseId: record.id,
    actorId: STUDENT,
    actorRole: 'student',
    correlationId,
    revision: record.revision,
    occurredAt: record.updatedAt,
  });
}

function createCommand(record, { idempotencyKey = 'idem_create', eventId = 'evt_create' } = {}) {
  return {
    operation: 'create',
    record,
    expectedRevision: null,
    idempotencyKey,
    requestHash: sha256(`request:${idempotencyKey}`),
    event: eventFor(record, { eventId, eventType: 'case.created' }),
  };
}

function saveCommand(record, expectedRevision, { idempotencyKey = 'idem_save', eventId = 'evt_save' } = {}) {
  return {
    operation: 'save',
    record,
    expectedRevision,
    idempotencyKey,
    requestHash: sha256(`request:${idempotencyKey}`),
    event: eventFor(record, { eventId, eventType: 'builder.autosaved' }),
  };
}

async function rejects(fn) {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  return assert.fail('expected the call to be rejected');
}

function throws(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return assert.fail('expected the call to throw');
}

/* ------------------------------------------------------------------ tests */

test('the driver makes the durable case repository constructible and declares atomic RLS custody', () => {
  const executor = createFakeSqlExecutor();
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });

  assert.equal(driver.atomicStateAndAudit, true);
  assert.equal(driver.rlsEnforced, true);
  assert.equal(driver.serverOnly, true);

  const repository = new SupabaseDurableRecommendationCaseRepository({
    binding: BINDING,
    driver,
    scopeProvider,
  });
  assert.equal(repository.isDurable, true);
  assert.equal(repository.atomicStateAndEvent, true);
  assert.equal(repository.describePersistence().durability, 'DURABLE_PROVIDER_BOUND');

  for (const executorCandidate of [
    undefined,
    {},
    { serverOnly: true, transactional: true },
    { serverOnly: false, transactional: true, withConnection() {} },
    { serverOnly: true, transactional: false, withConnection() {} },
  ]) {
    const error = throws(
      () => createAtomicRlsCaseDriver({ binding: BINDING, executor: executorCandidate }),
    );
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    assert.equal(error.details.status, 'SQL_EXECUTOR_PORT_REQUIRED');
  }
});

test('a request cannot redirect the driver at a different target', async () => {
  const executor = createFakeSqlExecutor();
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const foreign = resolveLorTargetBinding(stagingTargetConfiguration({
    projectRef: 'lor-case-driver-elsewhere',
    branchId: 'lor-case-driver-elsewhere',
  }));
  const repository = new SupabaseDurableRecommendationCaseRepository({
    binding: foreign,
    driver,
    scopeProvider,
  });

  const error = await rejects(() => repository.getById(CASE_ID));
  assert.equal(error.code, 'INTEGRATION_DISABLED');
  assert.equal(error.details.status, 'TARGET_BINDING_MISMATCH');
  assert.equal(executor.stats().connectionsOpened, 0);
});

test('happy path: state and audit commit in one transaction and the case reads back', async () => {
  const executor = createFakeSqlExecutor();
  const { repository } = buildRepository(executor);
  const record = baseRecord();
  const command = createCommand(record);

  const committed = await repository.commitWithEvent(command);
  assert.deepEqual(committed, record);

  const { database } = executor;
  assert.equal(database.cases.size, 1);
  assert.equal(database.audit.size, 1);
  assert.equal(database.receipts.size, 1);

  const caseRow = database.cases.get(CASE_ID);
  const auditRow = database.audit.get(command.event.eventRef);
  assert.equal(caseRow.revision, 0);
  assert.equal(caseRow.student_id, STUDENT);
  assert.equal(caseRow.record_hash, hashValue(record));
  assert.deepEqual(auditRow.event, command.event);
  assert.equal(auditRow.event_hash, hashValue(command.event));
  // The atomicity claim, checked rather than asserted: both rows were produced by
  // the same transaction.
  assert.equal(caseRow.writtenInTransaction, auditRow.transaction_id);

  const loaded = await repository.getById(CASE_ID);
  assert.deepEqual(loaded, record);

  assert.deepEqual(executor.stats(), { connectionsOpened: 2, resetCount: 2, sessionScopedWrites: 0 });
});

test('a stale expectedRevision is rejected with the actual revision and commits nothing', async () => {
  const executor = createFakeSqlExecutor();
  const { repository } = buildRepository(executor);
  const record0 = baseRecord();
  await repository.commitWithEvent(createCommand(record0));

  const record1 = advance(record0, { now: '2026-08-19T09:05:00.000Z' });
  const record2 = advance(record1, { now: '2026-08-19T09:06:00.000Z', value: 'b' });

  const error = await rejects(() => repository.commitWithEvent(saveCommand(record2, 1)));
  assert.equal(error.code, 'STALE_REVISION');
  assert.deepEqual(error.details, { caseId: CASE_ID, expectedRevision: 1, actualRevision: 0 });

  const { database } = executor;
  assert.equal(database.cases.get(CASE_ID).revision, 0);
  assert.equal(database.cases.get(CASE_ID).record_hash, hashValue(record0));
  assert.equal(database.audit.size, 1, 'a losing save must not append an audit row');
  assert.equal(database.receipts.size, 1);
});

test('an idempotent replay returns the prior receipt instead of committing twice', async () => {
  const executor = createFakeSqlExecutor();
  const { repository } = buildRepository(executor);
  const record0 = baseRecord();
  await repository.commitWithEvent(createCommand(record0));

  const record1 = advance(record0, { now: '2026-08-19T09:05:00.000Z' });
  const command = saveCommand(record1, 0);
  const first = await repository.commitWithEvent(command);
  const firstTransaction = executor.database.cases.get(CASE_ID).writtenInTransaction;

  executor.log.length = 0;
  const replay = await repository.commitWithEvent(command);

  assert.deepEqual(replay, first);
  assert.equal(executor.database.cases.get(CASE_ID).revision, 1);
  assert.equal(
    executor.database.cases.get(CASE_ID).writtenInTransaction,
    firstTransaction,
    'the replay must not rewrite the row',
  );
  assert.equal(executor.database.audit.size, 2, 'the replay must not append a second audit row');
  assert.equal(executor.database.receipts.size, 2);

  const replayStatements = executor.log.map((entry) => entry.name);
  assert.ok(replayStatements.includes(ATOMIC_RLS_CASE_STATEMENTS.selectWriteReceipt));
  for (const write of [
    ATOMIC_RLS_CASE_STATEMENTS.updateState,
    ATOMIC_RLS_CASE_STATEMENTS.insertState,
    ATOMIC_RLS_CASE_STATEMENTS.insertAuditEvent,
    ATOMIC_RLS_CASE_STATEMENTS.insertWriteReceipt,
  ]) {
    assert.ok(!replayStatements.includes(write), `replay must not issue ${write}`);
  }

  // A different request behind the same key is a conflict, not a silent replay.
  const conflict = await rejects(() => repository.commitWithEvent({
    ...saveCommand(record1, 0),
    requestHash: sha256('a different request body'),
  }));
  assert.equal(conflict.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(executor.database.audit.size, 2);
});

test('a replay never returns a case belonging to another student', async () => {
  // Regression, found by adversarial review and reproduced end to end. An idempotency key is
  // unique only WITHIN a case, and the receipt lookup bound case_id + idempotency_key alone -
  // no owner predicate, unlike its sibling selectCase and selectRevision statements, both of
  // which bind student_id. A caller scoped to one student who reused or guessed a key on another
  // student's case received that student's stored record back through the replay path.
  //
  // The repository above did catch it, so it was never reachable end to end - but the driver is
  // the layer that owns table access, and it must not depend on a caller further up to be safe.
  // Two things changed: the receipt row now carries student_id and the lookup binds it, and the
  // replay re-checks the stored record's owner against the scope the way selectCase does.
  const executor = createFakeSqlExecutor();
  const { driver, repository } = buildRepository(executor);
  const record0 = baseRecord();
  await repository.commitWithEvent(createCommand(record0));
  const record1 = advance(record0, { now: '2026-08-19T09:05:00.000Z' });
  await repository.commitWithEvent(saveCommand(record1, 0));

  // The attack is aimed at the DRIVER, because that is where the hole was: the repository's own
  // scope binding masked it. Same case, same idempotency key, foreign student in the scope.
  const foreignScope = verifiedScope({ caseId: CASE_ID, operation: 'save', resourceStudentId: 'wp:99' });
  const denied = await rejects(() => driver.executeAtomicCaseCommand({
    scope: foreignScope,
    operation: 'save',
    record: record1,
    expectedRevision: 0,
    idempotencyKey: saveCommand(record1, 0).idempotencyKey,
    requestHash: saveCommand(record1, 0).requestHash,
    event: saveCommand(record1, 0).event,
  }));

  assert.equal(
    JSON.stringify(denied ?? {}).includes(STUDENT),
    false,
    'a refusal must never carry the owning student back to the caller',
  );
  assert.equal(executor.database.receipts.size, 2, 'a refused replay must write nothing');
  assert.equal(executor.database.audit.size, 2);
});

test('a mid-transaction failure rolls back BOTH the state row and the audit row', async () => {
  const control = { failOn: null };
  const executor = createFakeSqlExecutor({ control });
  const { repository } = buildRepository(executor);
  const record0 = baseRecord();
  await repository.commitWithEvent(createCommand(record0));
  const committedTransaction = executor.database.cases.get(CASE_ID).writtenInTransaction;

  const record1 = advance(record0, { now: '2026-08-19T09:05:00.000Z' });
  control.failOn = ATOMIC_RLS_CASE_STATEMENTS.insertAuditEvent;

  const error = await rejects(() => repository.commitWithEvent(saveCommand(record1, 0)));
  assert.equal(error.code, 'INTEGRATION_DISABLED');
  assert.equal(error.details.status, 'ATOMIC_TRANSACTION_FAILED');
  assert.ok(!/simulated database failure/u.test(error.message), 'raw driver failures must not leak');

  const row = executor.database.cases.get(CASE_ID);
  assert.equal(row.revision, 0, 'state must not survive an audit-write failure');
  assert.equal(row.record_hash, hashValue(record0));
  assert.equal(row.writtenInTransaction, committedTransaction);
  assert.equal(executor.database.audit.size, 1);
  assert.equal(executor.database.receipts.size, 1);

  control.failOn = null;
  // The same save now succeeds, proving the rollback left no half-written state.
  const recovered = await repository.commitWithEvent(saveCommand(record1, 0));
  assert.deepEqual(recovered, record1);
  assert.equal(executor.database.audit.size, 2);
});

test('the RLS identity is bound before any other statement and reset after, even on failure', async () => {
  const control = { failOn: null };
  const executor = createFakeSqlExecutor({ control });
  const { repository } = buildRepository(executor);

  await repository.commitWithEvent(createCommand(baseRecord()));
  const opening = executor.log[0];
  assert.equal(opening.name, ATOMIC_RLS_CASE_STATEMENTS.bindIdentity);
  assert.ok(opening.transactionId, 'identity must be bound inside the transaction');
  const closing = executor.log.at(-1);
  assert.equal(closing.text, 'DISCARD ALL');
  assert.equal(closing.transactionId, null, 'the reset must run outside the transaction');
  assert.equal(executor.stats().resetCount, 1);

  // Now the failure path. The reset is the only thing standing between a poisoned
  // pooled connection and one student's identity executing another's query.
  executor.log.length = 0;
  control.failOn = ATOMIC_RLS_CASE_STATEMENTS.insertState;
  const record = createRecommendationCase({
    id: 'case_durable_0002',
    studentId: STUDENT,
    now: CREATED_AT,
    builderSessionId: 'builder_durable_0002',
  });
  const failure = await rejects(() => repository.commitWithEvent(
    createCommand(record, { idempotencyKey: 'idem_create_2', eventId: 'evt_create_2' }),
  ));
  assert.equal(failure.details.status, 'ATOMIC_TRANSACTION_FAILED');

  assert.equal(executor.log[0].name, ATOMIC_RLS_CASE_STATEMENTS.bindIdentity);
  const reset = executor.log.at(-1);
  assert.equal(reset.text, 'DISCARD ALL');
  assert.equal(reset.transactionId, null);
  assert.equal(executor.stats().resetCount, 2, 'the reset must run on the failure path too');
  assert.equal(executor.stats().sessionScopedWrites, 0, 'identity must be transaction-local');
});

test('two concurrent writers on the same expectedRevision yield exactly one winner', async () => {
  const control = {};
  const executor = createFakeSqlExecutor({ control });
  const { repository } = buildRepository(executor);
  const record0 = baseRecord();
  await repository.commitWithEvent(createCommand(record0));

  const left = advance(record0, { now: '2026-08-19T09:05:00.000Z', value: 'left' });
  const right = advance(record0, { now: '2026-08-19T09:06:00.000Z', value: 'right' });

  // Hold whichever writer took the row lock until the other has also reached its
  // UPDATE, so the two genuinely overlap instead of running back to back.
  let attempts = 0;
  let releaseBoth;
  const bothAttempted = new Promise((resolve) => { releaseBoth = resolve; });
  control.beforeStatement = async ({ name }) => {
    if (name === ATOMIC_RLS_CASE_STATEMENTS.updateState) {
      attempts += 1;
      if (attempts === 2) releaseBoth();
    }
    if (name === ATOMIC_RLS_CASE_STATEMENTS.insertWriteReceipt) await bothAttempted;
  };

  const outcomes = await Promise.allSettled([
    repository.commitWithEvent(saveCommand(left, 0, { idempotencyKey: 'idem_left', eventId: 'evt_left' })),
    repository.commitWithEvent(saveCommand(right, 0, { idempotencyKey: 'idem_right', eventId: 'evt_right' })),
  ]);

  assert.equal(attempts, 2, 'both writers must have attempted the same optimistic update');
  const winners = outcomes.filter((outcome) => outcome.status === 'fulfilled');
  const losers = outcomes.filter((outcome) => outcome.status === 'rejected');
  assert.equal(winners.length, 1, 'exactly one writer may win');
  assert.equal(losers.length, 1);
  assert.equal(losers[0].reason.code, 'STALE_REVISION');
  assert.equal(losers[0].reason.details.expectedRevision, 0);
  assert.equal(losers[0].reason.details.actualRevision, 1);

  const row = executor.database.cases.get(CASE_ID);
  assert.equal(row.revision, 1);
  assert.equal(row.record_hash, hashValue(winners[0].value));
  assert.equal(executor.database.audit.size, 2, 'the loser must not have appended an audit row');
  assert.equal(executor.database.receipts.size, 2);
});

test('no caller-supplied value can change the identity used for the RLS context', async () => {
  const record = baseRecord();
  const command = createCommand(record);

  const tampering = [
    ['an extra scope field', {
      scope: { ...verifiedScope({ operation: 'create' }), rlsRole: 'postgres' },
    }],
    ['a client-asserted scope flag', {
      scope: { ...verifiedScope({ operation: 'create' }), clientAsserted: true },
    }],
    ['a client authority source', {
      scope: verifiedScope({ operation: 'create', authoritySource: 'client_request' }),
    }],
    ['an unverified role', {
      scope: verifiedScope({ operation: 'create', roleVerified: false }),
    }],
    ['an actor that is not the authenticated subject', {
      scope: verifiedScope({ operation: 'create', actorId: 'wp:99' }),
    }],
    ['an extra request field', { identity: { role: 'postgres' } }],
  ];

  for (const [label, overrides] of tampering) {
    const executor = createFakeSqlExecutor();
    const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
    const error = await rejects(() => driver.executeAtomicCaseCommand({
      binding: BINDING,
      scope: verifiedScope({ operation: 'create' }),
      operation: 'create',
      record,
      expectedRevision: null,
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      event: command.event,
      ...overrides,
    }));
    assert.ok(
      ['INTEGRATION_DISABLED', 'AUTHORIZATION_DENIED', 'VALIDATION_FAILED'].includes(error.code),
      `${label} must fail closed, got ${error.code}`,
    );
    assert.deepEqual(
      executor.stats(),
      { connectionsOpened: 0, resetCount: 0, sessionScopedWrites: 0 },
      `${label} must be refused before any connection is opened`,
    );
    assert.equal(executor.log.length, 0, `${label} must execute no statement`);
  }

  // Positive control: the bound identity is a pure function of the verified scope.
  // Two commands differing in record, event, revision, and idempotency key bind
  // identical identity parameters, and the database role is the driver's constant.
  const executor = createFakeSqlExecutor();
  const { repository } = buildRepository(executor);
  await repository.commitWithEvent(command);
  const record1 = advance(record, { now: '2026-08-19T09:05:00.000Z' });
  await repository.commitWithEvent(saveCommand(record1, 0));

  const [creation, save] = executor.identityBindings;
  assert.equal(creation.applied.role, 'lor_studio_app');
  assert.equal(creation.applied['request.jwt.claim.sub'], AUTH_UID);
  assert.equal(creation.applied['lor_studio.authenticated_subject'], STUDENT);
  assert.equal(creation.applied['lor_studio.actor_role'], 'student');
  assert.equal(creation.applied['lor_studio.resource_student_id'], STUDENT);
  assert.equal(creation.applied['lor_studio.case_id'], CASE_ID);
  assert.equal(creation.applied['lor_studio.purpose'], 'case_workflow');
  assert.equal(creation.applied['lor_studio.operation'], 'create');
  assert.equal(save.applied['lor_studio.operation'], 'save');
  assert.deepEqual(
    { ...creation.applied, 'lor_studio.operation': null },
    { ...save.applied, 'lor_studio.operation': null },
    'only the server-derived operation may differ between the two identities',
  );
});

test('creation reservation is durable, atomic, and replays the identifiers it first issued', async () => {
  const executor = createFakeSqlExecutor();
  const { repository } = buildRepository(executor);
  const request = {
    actorId: STUDENT,
    idempotencyKey: 'idem_reserve',
    requestHash: sha256('reserve request'),
    proposedIdentifiers: {
      caseId: CASE_ID,
      builderSessionId: BUILDER_SESSION_ID,
      createdAt: CREATED_AT,
    },
  };

  const first = await repository.reserveCaseCreation(request);
  assert.deepEqual(first, {
    caseId: CASE_ID,
    builderSessionId: BUILDER_SESSION_ID,
    createdAt: CREATED_AT,
    replayed: false,
  });
  assert.equal(executor.database.reservations.size, 1);

  const replay = await repository.reserveCaseCreation({
    ...request,
    proposedIdentifiers: {
      caseId: 'case_attacker_choice',
      builderSessionId: 'builder_attacker_choice',
      createdAt: '2027-01-01T00:00:00.000Z',
    },
  });
  assert.deepEqual(replay, {
    caseId: CASE_ID,
    builderSessionId: BUILDER_SESSION_ID,
    createdAt: CREATED_AT,
    replayed: true,
  }, 'a replay returns the reserved identifiers, never a second pair');
  assert.equal(executor.database.reservations.size, 1);

  const conflict = await rejects(() => repository.reserveCaseCreation({
    ...request,
    requestHash: sha256('a different reserve request'),
  }));
  assert.equal(conflict.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(executor.database.reservations.size, 1);
});

test('generated SQL pins optimistic concurrency, transaction-local identity, and bound parameters', async () => {
  const executor = createFakeSqlExecutor();
  const { repository } = buildRepository(executor);
  const record0 = baseRecord();
  await repository.commitWithEvent(createCommand(record0));
  const record1 = advance(record0, { now: '2026-08-19T09:05:00.000Z' });
  await repository.commitWithEvent(saveCommand(record1, 0));
  await repository.getById(CASE_ID);

  const byName = new Map(executor.log.map((entry) => [entry.name, entry]));

  const identity = byName.get(ATOMIC_RLS_CASE_STATEMENTS.bindIdentity);
  assert.equal((identity.text.match(/set_config\(/gu) ?? []).length, 11);
  assert.equal(
    (identity.text.match(/,\s*true\)/gu) ?? []).length,
    11,
    'every setting must be transaction-local',
  );
  assert.ok(!/,\s*false\)/u.test(identity.text));
  assert.match(identity.text, /set_config\('role', \$1, true\)/u);

  const update = byName.get(ATOMIC_RLS_CASE_STATEMENTS.updateState);
  assert.match(
    update.text,
    /WHERE case_id = \$6 AND student_id = \$7 AND revision = \$8/u,
    'the optimistic-concurrency predicate must match the exact expected revision',
  );
  assert.match(update.text, /RETURNING record, revision, pg_current_xact_id\(\)::text AS transaction_id/u);

  const insert = byName.get(ATOMIC_RLS_CASE_STATEMENTS.insertState);
  assert.match(insert.text, /ON CONFLICT \(case_id\) DO NOTHING/u);

  const audit = byName.get(ATOMIC_RLS_CASE_STATEMENTS.insertAuditEvent);
  assert.match(audit.text, /pg_current_xact_id\(\)::text/u, 'the audit row records its own transaction');
  assert.match(audit.text, /ON CONFLICT \(event_ref\) DO NOTHING/u);

  // Nothing a caller supplied is ever spliced into SQL text. Bare vocabulary
  // tokens are skipped because words like "student" legitimately appear in column
  // names; every identifier, digest, timestamp, and JSON payload is checked.
  for (const entry of executor.log) {
    for (const value of entry.values) {
      if (typeof value !== 'string' || value.length < 3) continue;
      if (/^[a-z_]+$/u.test(value)) continue;
      assert.ok(
        !entry.text.includes(value),
        `statement ${String(entry.name)} interpolated a bound value`,
      );
    }
  }

  // And the text itself never varies with the data it carries.
  const canonicalText = new Map();
  for (const entry of executor.log) {
    if (!canonicalText.has(entry.name)) canonicalText.set(entry.name, entry.text);
    assert.equal(
      entry.text,
      canonicalText.get(entry.name),
      `statement ${String(entry.name)} changed its SQL between calls`,
    );
  }
});

test('this driver is the only layer in LOR Studio that names a case table', () => {
  const driverPath = fileURLToPath(
    new URL('../../lor-studio/adapters/atomic-rls-case-driver.mjs', import.meta.url),
  );
  const root = fileURLToPath(new URL('../../lor-studio', import.meta.url));
  const relations = Object.values(ATOMIC_RLS_CASE_DRIVER_CONTRACT.relations)
    .map((relation) => relation.split('.').pop());
  assert.equal(relations.length, 4);

  const offenders = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current)) {
      const candidate = path.join(current, entry);
      if (statSync(candidate).isDirectory()) {
        stack.push(candidate);
        continue;
      }
      if (!/\.(?:js|mjs)$/u.test(entry) || candidate === driverPath) continue;
      const source = readFileSync(candidate, 'utf8');
      for (const relation of relations) {
        if (source.includes(relation)) offenders.push(`${candidate}: ${relation}`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'persistence relation names must not leak above the driver');
});
