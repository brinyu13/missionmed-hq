import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IdempotencyConflictError,
  IntegrationDisabledError,
  LorDomainError,
  ValidationError,
} from '../domain/errors.js';
import { assertRecommendationCase } from '../domain/recommendation-case.js';
import {
  assertNonEmptyString,
  canonicalize,
  deepFreeze,
  hashValue,
  toIso,
} from '../domain/value-utils.js';
import { validateMetadataServiceEvent } from '../services/metadata-events.js';
import { isDeniedTargetIdentifier } from './lor-target-binding.mjs';

/**
 * Atomic, RLS-enforced SQL driver for durable LOR Studio recommendation cases.
 *
 * This is the ONLY module in LOR Studio that names a table or a column. Every layer
 * above it - repository, service, HTTP adapter - speaks domain records and receipts.
 * If a relation name appears anywhere else, the persistence boundary has leaked.
 *
 * It exists because SupabaseDurableRecommendationCaseRepository is unconstructible
 * without a driver that can prove four things at once:
 *
 *   1. state and its metadata audit row land in ONE transaction, or neither lands;
 *   2. a save applies only against the exact revision the caller read, so two
 *      competing writers cannot both win;
 *   3. the request identity used for row-level security is established server-side
 *      per transaction, from the verified scope only, and cannot bleed between
 *      users on a pooled connection;
 *   4. an idempotent replay returns the receipt of the original commit instead of
 *      committing a second time.
 *
 * SQL is never assembled from caller data. Every caller value travels as a bound
 * parameter; the only interpolated identifiers are module constants.
 */

export const ATOMIC_RLS_CASE_DRIVER_INTEGRATION = 'lor_atomic_rls_case_driver';

const LOR_SCHEMA = 'lor_studio';

/**
 * The database role the driver runs as inside every transaction.
 *
 * It is a module constant, never a request field. A table owner or superuser
 * BYPASSES row-level security in PostgreSQL, so binding the connection down to an
 * unprivileged application role is what makes the policies load-bearing rather
 * than decorative.
 */
const APPLICATION_DB_ROLE = 'lor_studio_app';

const SERVER_SCOPE_SCHEMA = 'missionmed.lor.server-query-scope.v1';
const DRIVER_AUTHORIZATION_SCHEMA = 'missionmed.lor.driver-authorization-binding.v1';
const CREATION_RESERVATION_RECEIPT_SCHEMA = 'missionmed.lor.case-creation-reservation-receipt.v1';
const ATOMIC_COMMIT_RECEIPT_SCHEMA = 'missionmed.lor.atomic-commit-receipt.v1';
const TARGET_BINDING_SCHEMA = 'missionmed.lor.target-binding.v1';

const ACTOR_ROLES = new Set(['student', 'faculty', 'mentor', 'admin', 'founder', 'support', 'service']);
const SCOPE_OPERATIONS = new Set(['read', 'create', 'save']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

/** Relations owned by this driver. Named here and nowhere else in LOR Studio. */
const RELATIONS = deepFreeze({
  cases: `${LOR_SCHEMA}.recommendation_cases`,
  auditEvents: `${LOR_SCHEMA}.recommendation_case_audit_events`,
  creationReservations: `${LOR_SCHEMA}.recommendation_case_creation_reservations`,
  writeReceipts: `${LOR_SCHEMA}.recommendation_case_write_receipts`,
});

/**
 * Prepared-statement names. `node-pg` reuses a named statement's plan, which
 * requires one fixed text per name - satisfied because each name maps to exactly
 * one constant below. Tests assert on these names rather than on SQL substrings.
 */
export const ATOMIC_RLS_CASE_STATEMENTS = deepFreeze({
  bindIdentity: 'lor_case_bind_identity',
  transactionId: 'lor_case_transaction_id',
  selectCase: 'lor_case_select',
  selectRevision: 'lor_case_select_revision',
  selectWriteReceipt: 'lor_case_select_write_receipt',
  insertState: 'lor_case_insert_state',
  updateState: 'lor_case_update_state',
  insertAuditEvent: 'lor_case_insert_audit_event',
  insertWriteReceipt: 'lor_case_insert_write_receipt',
  insertCreationReservation: 'lor_case_insert_creation_reservation',
  selectCreationReservation: 'lor_case_select_creation_reservation',
});

/**
 * Exactly the fields the durable repository's verified scope carries. An exact-key
 * match is the point: a caller cannot append `rlsRole`, `dbRole`, or any other
 * identity-shaped field and have it reach the connection.
 */
const SCOPE_KEYS = new Set([
  'schemaVersion',
  'authoritySource',
  'authenticated',
  'roleVerified',
  'authUid',
  'authenticatedSubject',
  'actorId',
  'actorRole',
  'resourceStudentId',
  'caseId',
  'operation',
  'purpose',
  'assignmentId',
  'invitationId',
  'administrativeGrantId',
]);

const SELECT_CASE_KEYS = new Set(['binding', 'scope', 'caseId']);
const RESERVE_CREATION_KEYS = new Set([
  'binding',
  'scope',
  'operation',
  'creationRef',
  'actorRef',
  'idempotencyKey',
  'requestHash',
  'proposedIdentifiers',
]);
const ATOMIC_COMMAND_KEYS = new Set([
  'binding',
  'scope',
  'operation',
  'record',
  'expectedRevision',
  'idempotencyKey',
  'requestHash',
  'event',
]);
const PROPOSED_IDENTIFIER_KEYS = new Set(['caseId', 'builderSessionId', 'createdAt']);

const BINDING_IDENTITY_FIELDS = Object.freeze([
  'schemaVersion',
  'decisionRecord',
  'environment',
  'projectRef',
  'parentProjectRef',
  'branchName',
  'branchId',
  'schema',
  'migrationLedger',
]);

/**
 * Internal control-flow signal for an outcome the repository is designed to read
 * off a RESULT (stale revision, not found, idempotency conflict). It is thrown
 * rather than returned so the transaction unwinds: an outcome that is not a commit
 * must never leave a committed row behind, not even an empty one.
 */
class DriverRejection extends Error {
  constructor(outcome) {
    super('atomic case command rejected');
    this.name = 'DriverRejection';
    this.outcome = outcome;
  }
}

function failClosed(status) {
  throw new IntegrationDisabledError(ATOMIC_RLS_CASE_DRIVER_INTEGRATION, status);
}

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, expected) {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function assertSha256(value, fieldName) {
  if (!SHA256_PATTERN.test(value ?? '')) {
    throw new ValidationError(`${fieldName} must be a SHA-256 digest`, { fieldName });
  }
  return value;
}

/**
 * Build one statement. The placeholder audit is not decoration: it is the
 * mechanical guarantee that every caller value is bound rather than interpolated,
 * so a mismatch between the SQL and the value list fails closed instead of
 * silently sending a statement with a dangling or unused parameter.
 */
function statement(name, text, values = []) {
  const indexes = new Set((text.match(/\$\d+/gu) ?? []).map((token) => Number(token.slice(1))));
  const expected = values.length;
  if (indexes.size !== expected) failClosed('STATEMENT_PARAMETER_MISMATCH');
  for (let index = 1; index <= expected; index += 1) {
    if (!indexes.has(index)) failClosed('STATEMENT_PARAMETER_MISMATCH');
  }
  for (const value of values) {
    const type = typeof value;
    if (value !== null && type !== 'string' && type !== 'number' && type !== 'boolean') {
      failClosed('STATEMENT_PARAMETER_UNSUPPORTED');
    }
  }
  return Object.freeze({ name, text, values: Object.freeze([...values]) });
}

/**
 * Issued on the CONNECTION after the transaction has ended, never inside it.
 *
 * `SET LOCAL` / `set_config(..., true)` already unwind at COMMIT or ROLLBACK, so
 * this is the second line of defence for pooled connections. It is deliberately
 * outside the transaction because an aborted transaction rejects every further
 * statement - a reset issued inside it would be skipped in exactly the failure
 * case that makes identity bleed dangerous.
 */
const RESET_IDENTITY_STATEMENT = Object.freeze({
  name: null,
  text: 'DISCARD ALL',
  values: Object.freeze([]),
});

const BIND_IDENTITY_SQL = `SELECT
  set_config('role', $1, true) AS database_role,
  set_config('request.jwt.claim.sub', $2, true) AS auth_uid,
  set_config('${LOR_SCHEMA}.authenticated_subject', $3, true) AS authenticated_subject,
  set_config('${LOR_SCHEMA}.actor_role', $4, true) AS actor_role,
  set_config('${LOR_SCHEMA}.resource_student_id', $5, true) AS resource_student_id,
  set_config('${LOR_SCHEMA}.case_id', $6, true) AS case_id,
  set_config('${LOR_SCHEMA}.operation', $7, true) AS operation,
  set_config('${LOR_SCHEMA}.purpose', $8, true) AS purpose,
  set_config('${LOR_SCHEMA}.invitation_id', $9, true) AS invitation_id,
  set_config('${LOR_SCHEMA}.assignment_id', $10, true) AS assignment_id,
  set_config('${LOR_SCHEMA}.administrative_grant_id', $11, true) AS administrative_grant_id`;

const TRANSACTION_ID_SQL = 'SELECT pg_current_xact_id()::text AS transaction_id';

const SELECT_CASE_SQL = `SELECT record, revision
  FROM ${RELATIONS.cases}
  WHERE case_id = $1 AND student_id = $2`;

const SELECT_REVISION_SQL = `SELECT revision
  FROM ${RELATIONS.cases}
  WHERE case_id = $1 AND student_id = $2`;

// student_id is bound here for the same reason SELECT_CASE_SQL and SELECT_REVISION_SQL bind it.
// Without it the replay path was owner-blind: an idempotency key is only unique within a case, so
// a caller scoped to one student who guessed or reused a key for another student's case received
// that student's stored record back. The repository above catches it, but the driver is the layer
// that owns table access and it must not depend on a caller further up to be safe.
const SELECT_WRITE_RECEIPT_SQL = `SELECT request_hash, operation, revision, record, record_hash,
    event_hash, audit_event_ref, transaction_id
  FROM ${RELATIONS.writeReceipts}
  WHERE case_id = $1 AND idempotency_key = $2 AND student_id = $3`;

const INSERT_STATE_SQL = `INSERT INTO ${RELATIONS.cases}
    (case_id, student_id, revision, status, created_at, updated_at, record, record_hash)
  VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::jsonb, $8)
  ON CONFLICT (case_id) DO NOTHING
  RETURNING record, revision, pg_current_xact_id()::text AS transaction_id`;

/**
 * The optimistic-concurrency predicate. `revision = $8` is the whole concurrency
 * story: PostgreSQL re-evaluates it after taking the row lock under READ
 * COMMITTED, so of two writers holding the same expectedRevision the loser matches
 * zero rows and is told the revision it actually lost to.
 */
const UPDATE_STATE_SQL = `UPDATE ${RELATIONS.cases}
  SET revision = $1, status = $2, updated_at = $3::timestamptz, record = $4::jsonb, record_hash = $5
  WHERE case_id = $6 AND student_id = $7 AND revision = $8
  RETURNING record, revision, pg_current_xact_id()::text AS transaction_id`;

const INSERT_AUDIT_EVENT_SQL = `INSERT INTO ${RELATIONS.auditEvents}
    (event_ref, case_id, case_ref, actor_ref, actor_role, correlation_ref, event_type,
     outcome, revision, occurred_at, event, event_hash, transaction_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11::jsonb, $12,
     pg_current_xact_id()::text)
  ON CONFLICT (event_ref) DO NOTHING
  RETURNING event_ref, transaction_id`;

// student_id is stored so the replay lookup can bind an owner predicate, and so an RLS policy on
// this relation can be expressed at all. Without the column the receipt table is owner-blind and
// the only ownership evidence is the studentId buried inside the record JSON.
const INSERT_WRITE_RECEIPT_SQL = `INSERT INTO ${RELATIONS.writeReceipts}
    (case_id, student_id, idempotency_key, request_hash, operation, revision, record, record_hash,
     event_hash, audit_event_ref, transaction_id, committed_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, pg_current_xact_id()::text, now())
  ON CONFLICT (case_id, idempotency_key) DO NOTHING
  RETURNING transaction_id`;

const INSERT_CREATION_RESERVATION_SQL = `INSERT INTO ${RELATIONS.creationReservations}
    (creation_ref, actor_ref, idempotency_key, request_hash, case_id, builder_session_id,
     created_at, transaction_id, reserved_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, pg_current_xact_id()::text, now())
  ON CONFLICT (creation_ref) DO NOTHING
  RETURNING case_id, builder_session_id, created_at, request_hash, transaction_id`;

const SELECT_CREATION_RESERVATION_SQL = `SELECT case_id, builder_session_id, created_at,
    request_hash, transaction_id
  FROM ${RELATIONS.creationReservations}
  WHERE creation_ref = $1 AND actor_ref = $2`;

/**
 * @typedef {object} SqlStatement
 * @property {string | null} name prepared-statement name, or null when not preparable
 * @property {string} text
 * @property {ReadonlyArray<string | number | boolean | null>} values
 */

/**
 * @typedef {object} SqlResult
 * @property {Record<string, unknown>[]} rows
 */

/**
 * @typedef {object} SqlTransaction
 * @property {(statement: SqlStatement) => Promise<SqlResult>} execute
 */

/**
 * @typedef {object} SqlConnection
 * @property {(statement: SqlStatement) => Promise<SqlResult>} execute statements outside a transaction
 * @property {(handler: (transaction: SqlTransaction) => Promise<unknown>) => Promise<unknown>} transaction
 */

/**
 * The injected SQL executor port.
 *
 * A real `pg` implementation is mechanical: `withConnection` is
 * `pool.connect()` / `client.release()`, `connection.execute` is
 * `client.query({name, text, values})`, and `connection.transaction` is
 * BEGIN / handler / COMMIT, with ROLLBACK and a rethrow when the handler rejects.
 * PostgREST can implement the same shape over a single stored procedure.
 *
 * Required behaviour, relied on by this driver:
 *   - `transaction` COMMITs only when the handler resolves;
 *   - `transaction` ROLLBACKs and RETHROWS when the handler rejects;
 *   - `withConnection` gives the handler exclusive use of one connection, so the
 *     identity bound inside the transaction and the reset issued afterwards apply
 *     to the same backend.
 *
 * @typedef {object} SqlExecutorPort
 * @property {boolean} serverOnly
 * @property {boolean} transactional
 * @property {(handler: (connection: SqlConnection) => Promise<unknown>) => Promise<unknown>} withConnection
 */

function assertExecutor(executor) {
  if (
    !executor
    || executor.serverOnly !== true
    || executor.transactional !== true
    || typeof executor.withConnection !== 'function'
  ) {
    failClosed('SQL_EXECUTOR_PORT_REQUIRED');
  }
  return executor;
}

function assertConnection(connection) {
  if (
    !connection
    || typeof connection.execute !== 'function'
    || typeof connection.transaction !== 'function'
  ) {
    failClosed('SQL_CONNECTION_CONTRACT_VIOLATED');
  }
  return connection;
}

function assertTransaction(transaction) {
  if (!transaction || typeof transaction.execute !== 'function') {
    failClosed('SQL_TRANSACTION_CONTRACT_VIOLATED');
  }
  return transaction;
}

/**
 * The driver is pinned to ONE target at construction. Requests carry a binding
 * too, and it must match by value.
 *
 * Value equality rather than object identity is deliberate: the repository hands
 * `reserveCaseCreation` a `structuredClone` of its command, which produces a copy
 * that is no longer the object the target-binding registry validated. Comparing
 * the nine identity fields keeps the check meaningful across that clone while
 * still refusing to let a request redirect the driver at another project.
 */
function assertTargetBinding(binding, target) {
  if (!binding || typeof binding !== 'object') failClosed('TARGET_BINDING_REQUIRED');
  for (const field of BINDING_IDENTITY_FIELDS) {
    if (binding[field] !== target[field]) failClosed('TARGET_BINDING_MISMATCH');
  }
  for (const field of ['projectRef', 'parentProjectRef', 'branchId', 'branchName']) {
    if (isDeniedTargetIdentifier(binding[field])) failClosed('TARGET_BINDING_DENIED');
  }
  return target;
}

function assertScopeEnvelope(scope, { operation, caseId }) {
  if (!isPlainObject(scope)) failClosed('VERIFIED_SERVER_SCOPE_REQUIRED');
  // Exact keys, checked BEFORE anything is read: an unrecognized field is not
  // ignored, it is a refusal. This is what stops a caller-supplied value from
  // reaching the RLS context at all.
  if (!hasExactKeys(scope, SCOPE_KEYS)) failClosed('SERVER_SCOPE_FIELDS_UNRECOGNIZED');
  if (
    scope.schemaVersion !== SERVER_SCOPE_SCHEMA
    || scope.authoritySource !== 'server_verified_session_crosswalk'
    || scope.authenticated !== true
    || scope.roleVerified !== true
  ) {
    failClosed('VERIFIED_SERVER_SCOPE_REQUIRED');
  }
  for (const field of [
    'authUid',
    'authenticatedSubject',
    'actorId',
    'resourceStudentId',
    'caseId',
    'purpose',
  ]) {
    assertNonEmptyString(scope[field], `scope.${field}`, { maxLength: 200 });
  }
  if (!ACTOR_ROLES.has(scope.actorRole)) throw new ValidationError('scope.actorRole is not recognized');
  if (!SCOPE_OPERATIONS.has(scope.operation)) throw new ValidationError('scope.operation is not recognized');
  for (const field of ['assignmentId', 'invitationId', 'administrativeGrantId']) {
    if (scope[field] !== null) assertNonEmptyString(scope[field], `scope.${field}`, { maxLength: 200 });
  }
  // The identity the driver binds is the AUTHENTICATED subject. A scope whose
  // actorId has drifted from it is an escalation attempt, not a rounding error.
  if (scope.actorId !== scope.authenticatedSubject) {
    throw new AuthorizationDeniedError('DRIVER_IDENTITY_SUBJECT_MISMATCH');
  }
  if (scope.operation !== operation || scope.caseId !== caseId) {
    throw new DomainInvariantError('RLS scope must be bound to the requested case and operation');
  }
  return scope;
}

/**
 * The request identity, derived server-side from the verified scope alone.
 *
 * Nothing here reads the request body, the record, the event, or any field the
 * caller could add: the database role is a module constant and every claim is
 * copied from an allowlisted scope field.
 */
function deriveRlsIdentity(scope) {
  return Object.freeze({
    databaseRole: APPLICATION_DB_ROLE,
    authUid: scope.authUid,
    authenticatedSubject: scope.authenticatedSubject,
    actorRole: scope.actorRole,
    resourceStudentId: scope.resourceStudentId,
    caseId: scope.caseId,
    operation: scope.operation,
    purpose: scope.purpose,
    invitationId: scope.invitationId ?? '',
    assignmentId: scope.assignmentId ?? '',
    administrativeGrantId: scope.administrativeGrantId ?? '',
  });
}

function bindIdentityStatement(identity) {
  return statement(ATOMIC_RLS_CASE_STATEMENTS.bindIdentity, BIND_IDENTITY_SQL, [
    identity.databaseRole,
    identity.authUid,
    identity.authenticatedSubject,
    identity.actorRole,
    identity.resourceStudentId,
    identity.caseId,
    identity.operation,
    identity.purpose,
    identity.invitationId,
    identity.assignmentId,
    identity.administrativeGrantId,
  ]);
}

function authorizationBinding(scope) {
  return {
    schemaVersion: DRIVER_AUTHORIZATION_SCHEMA,
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
  };
}

function firstRow(result) {
  const rows = result?.rows;
  if (!Array.isArray(rows)) failClosed('SQL_RESULT_CONTRACT_VIOLATED');
  if (rows.length > 1) failClosed('SQL_RESULT_NOT_UNIQUE');
  return rows.length === 1 ? rows[0] : null;
}

function assertTransactionId(value) {
  if (typeof value !== 'string' || value.trim() === '') failClosed('TRANSACTION_IDENTITY_UNPROVEN');
  return value;
}

/** Same-transaction proof: every write must report the transaction we opened. */
function assertSameTransaction(observed, expected) {
  if (assertTransactionId(observed) !== expected) failClosed('ATOMIC_TRANSACTION_SPLIT');
}

function assertStoredRecord(stored, expectedHash) {
  if (!isPlainObject(stored)) failClosed('PERSISTED_RECORD_UNREADABLE');
  assertRecommendationCase(stored);
  // Round-trip proof: what the row now holds hashes to what we intended to store.
  if (hashValue(stored) !== expectedHash) failClosed('PERSISTED_RECORD_HASH_MISMATCH');
  return stored;
}

function assertRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) failClosed('PERSISTED_REVISION_INVALID');
  return value;
}

export class AtomicRlsCaseDriver {
  /**
   * @param {object} options
   * @param {Record<string, unknown>} options.binding validated LOR target binding
   * @param {SqlExecutorPort} options.executor
   */
  constructor({ binding, executor } = {}) {
    if (!binding || typeof binding !== 'object' || binding.schemaVersion !== TARGET_BINDING_SCHEMA) {
      failClosed('TARGET_BINDING_REQUIRED');
    }
    if (binding.schema !== LOR_SCHEMA) failClosed('TARGET_SCHEMA_MISMATCH');
    for (const field of ['projectRef', 'parentProjectRef', 'branchId', 'branchName']) {
      if (isDeniedTargetIdentifier(binding[field])) failClosed('TARGET_BINDING_DENIED');
    }
    this.target = deepFreeze(
      Object.fromEntries(BINDING_IDENTITY_FIELDS.map((field) => [field, binding[field]])),
    );
    this.executor = assertExecutor(executor);
    // Capability declarations the durable repository gates on.
    this.atomicStateAndAudit = true;
    this.rlsEnforced = true;
    this.serverOnly = true;
    Object.freeze(this);
  }

  /**
   * Open a connection, bind the RLS identity as the FIRST statement inside a
   * transaction, run the handler, and reset the connection on the way out -
   * whether the transaction committed, rolled back, or exploded.
   */
  async #withRlsTransaction(scope, handler) {
    const identity = deriveRlsIdentity(scope);
    return this.executor.withConnection(async (rawConnection) => {
      const connection = assertConnection(rawConnection);
      try {
        return await connection.transaction(async (rawTransaction) => {
          const transaction = assertTransaction(rawTransaction);
          await transaction.execute(bindIdentityStatement(identity));
          return handler(transaction);
        });
      } finally {
        // Not conditional on success. A poisoned pooled connection is how one
        // student's identity ends up executing another student's query, so this
        // runs on the failure path too. A reset that itself fails is surfaced
        // rather than swallowed: the connection is no longer safe to reuse.
        await connection.execute(RESET_IDENTITY_STATEMENT);
      }
    });
  }

  async #transact(scope, handler) {
    try {
      return await this.#withRlsTransaction(scope, handler);
    } catch (error) {
      if (error instanceof DriverRejection) return error.outcome;
      if (error instanceof LorDomainError) throw error;
      // Driver-internal failures never travel outward verbatim: a raw SQL error
      // can carry row values, parameter contents, and connection details.
      throw new IntegrationDisabledError(
        ATOMIC_RLS_CASE_DRIVER_INTEGRATION,
        'ATOMIC_TRANSACTION_FAILED',
      );
    }
  }

  async #captureTransactionId(transaction) {
    const row = firstRow(
      await transaction.execute(
        statement(ATOMIC_RLS_CASE_STATEMENTS.transactionId, TRANSACTION_ID_SQL, []),
      ),
    );
    return assertTransactionId(row?.transaction_id);
  }

  /** @param {Record<string, unknown>} request */
  async selectCase(request) {
    if (!isPlainObject(request) || !hasExactKeys(request, SELECT_CASE_KEYS)) {
      failClosed('SELECT_REQUEST_FIELDS_UNRECOGNIZED');
    }
    assertTargetBinding(request.binding, this.target);
    const caseId = assertNonEmptyString(request.caseId, 'caseId', { maxLength: 200 });
    const scope = assertScopeEnvelope(request.scope, { operation: 'read', caseId });
    return this.#transact(scope, async (transaction) => {
      const row = firstRow(
        await transaction.execute(
          statement(ATOMIC_RLS_CASE_STATEMENTS.selectCase, SELECT_CASE_SQL, [
            caseId,
            scope.resourceStudentId,
          ]),
        ),
      );
      if (!row) return deepFreeze({ found: false });
      const record = row.record;
      if (!isPlainObject(record)) failClosed('PERSISTED_RECORD_UNREADABLE');
      assertRecommendationCase(record);
      assertRevision(row.revision);
      if (record.id !== caseId || record.studentId !== scope.resourceStudentId) {
        throw new AuthorizationDeniedError('DRIVER_CASE_SCOPE_MISMATCH');
      }
      if (record.revision !== row.revision) failClosed('PERSISTED_REVISION_DIVERGED');
      return deepFreeze({
        found: true,
        record,
        authorizationBinding: authorizationBinding(scope),
      });
    });
  }

  /** @param {Record<string, unknown>} request */
  async reserveCaseCreation(request) {
    if (!isPlainObject(request) || !hasExactKeys(request, RESERVE_CREATION_KEYS)) {
      failClosed('RESERVATION_REQUEST_FIELDS_UNRECOGNIZED');
    }
    assertTargetBinding(request.binding, this.target);
    if (request.operation !== 'reserve_create') {
      throw new ValidationError('Creation reservation operation must be reserve_create');
    }
    const creationRef = assertNonEmptyString(request.creationRef, 'creationRef', { maxLength: 200 });
    const actorRef = assertNonEmptyString(request.actorRef, 'actorRef', { maxLength: 200 });
    const idempotencyKey = assertNonEmptyString(request.idempotencyKey, 'idempotencyKey', { maxLength: 200 });
    const requestHash = assertSha256(request.requestHash, 'requestHash');
    const proposed = request.proposedIdentifiers;
    if (!isPlainObject(proposed) || !hasExactKeys(proposed, PROPOSED_IDENTIFIER_KEYS)) {
      failClosed('RESERVATION_IDENTIFIERS_UNRECOGNIZED');
    }
    const proposedCaseId = assertNonEmptyString(proposed.caseId, 'proposedIdentifiers.caseId', { maxLength: 200 });
    const proposedBuilderSessionId = assertNonEmptyString(
      proposed.builderSessionId,
      'proposedIdentifiers.builderSessionId',
      { maxLength: 200 },
    );
    if (proposedCaseId === proposedBuilderSessionId) {
      throw new ValidationError('Case and protected builder identifiers must be distinct');
    }
    const proposedCreatedAt = toIso(proposed.createdAt, 'proposedIdentifiers.createdAt');
    const scope = assertScopeEnvelope(request.scope, { operation: 'create', caseId: creationRef });
    if (scope.actorRole !== 'student' || scope.resourceStudentId !== scope.authenticatedSubject) {
      throw new AuthorizationDeniedError('CASE_CREATION_SUBJECT_SCOPE_MISMATCH');
    }

    return this.#transact(scope, async (transaction) => {
      const transactionId = await this.#captureTransactionId(transaction);
      const inserted = firstRow(
        await transaction.execute(
          statement(
            ATOMIC_RLS_CASE_STATEMENTS.insertCreationReservation,
            INSERT_CREATION_RESERVATION_SQL,
            [
              creationRef,
              actorRef,
              idempotencyKey,
              requestHash,
              proposedCaseId,
              proposedBuilderSessionId,
              proposedCreatedAt,
            ],
          ),
        ),
      );
      if (inserted) {
        assertSameTransaction(inserted.transaction_id, transactionId);
        return this.#reservationReceipt({
          row: inserted,
          scope,
          creationRef,
          actorRef,
          idempotencyKey,
          requestHash,
          transactionId,
          replayed: false,
        });
      }
      // The reservation already exists. Replaying it is the WHOLE point of the
      // idempotency key: the caller must get back the identifiers it was first
      // given, never a second, competing pair.
      const existing = firstRow(
        await transaction.execute(
          statement(
            ATOMIC_RLS_CASE_STATEMENTS.selectCreationReservation,
            SELECT_CREATION_RESERVATION_SQL,
            [creationRef, actorRef],
          ),
        ),
      );
      if (!existing) failClosed('CREATION_RESERVATION_UNREADABLE');
      if (existing.request_hash !== requestHash) throw new IdempotencyConflictError({ idempotencyKey });
      return this.#reservationReceipt({
        row: existing,
        scope,
        creationRef,
        actorRef,
        idempotencyKey,
        requestHash,
        transactionId: assertTransactionId(existing.transaction_id),
        replayed: true,
      });
    });
  }

  #reservationReceipt({
    row,
    scope,
    creationRef,
    actorRef,
    idempotencyKey,
    requestHash,
    transactionId,
    replayed,
  }) {
    const caseId = assertNonEmptyString(row.case_id, 'reservation case_id', { maxLength: 200 });
    const builderSessionId = assertNonEmptyString(
      row.builder_session_id,
      'reservation builder_session_id',
      { maxLength: 200 },
    );
    if (caseId === builderSessionId) failClosed('CREATION_RESERVATION_IDENTIFIERS_COLLIDED');
    return deepFreeze({
      schemaVersion: CREATION_RESERVATION_RECEIPT_SCHEMA,
      reserved: true,
      durable: true,
      sameTransaction: true,
      transactionId,
      replayed,
      creationRef,
      actorRef,
      idempotencyKey,
      requestHash,
      caseId,
      builderSessionId,
      createdAt: toIso(row.created_at, 'reservation created_at'),
      authorizationBinding: authorizationBinding(scope),
    });
  }

  /** @param {Record<string, unknown>} command */
  async executeAtomicCaseCommand(command) {
    if (!isPlainObject(command) || !hasExactKeys(command, ATOMIC_COMMAND_KEYS)) {
      failClosed('ATOMIC_COMMAND_FIELDS_UNRECOGNIZED');
    }
    assertTargetBinding(command.binding, this.target);
    const operation = command.operation;
    if (operation !== 'create' && operation !== 'save') {
      throw new ValidationError('Atomic case operation must be create or save');
    }
    const record = command.record;
    assertRecommendationCase(record);
    const event = command.event;
    validateMetadataServiceEvent(event);
    const idempotencyKey = assertNonEmptyString(command.idempotencyKey, 'idempotencyKey', { maxLength: 200 });
    const requestHash = assertSha256(command.requestHash, 'requestHash');
    const expectedRevision = command.expectedRevision;
    if (operation === 'create') {
      if (expectedRevision !== null || record.revision !== 0) {
        throw new DomainInvariantError('Atomic case creation must begin at revision zero');
      }
    } else if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new ValidationError('expectedRevision must be a non-negative integer');
    } else if (record.revision !== expectedRevision + 1) {
      throw new DomainInvariantError('Atomic case save must advance exactly one revision');
    }
    const scope = assertScopeEnvelope(command.scope, { operation, caseId: record.id });
    if (record.studentId !== scope.resourceStudentId) {
      throw new AuthorizationDeniedError('DRIVER_CASE_SCOPE_MISMATCH');
    }
    if (event.revision !== record.revision || event.occurredAt !== record.updatedAt) {
      throw new DomainInvariantError('Metadata audit event must be bound to the exact case revision');
    }

    const recordJson = canonicalize(record);
    const recordHash = hashValue(record);
    const eventHash = hashValue(event);

    return this.#transact(scope, async (transaction) => {
      const transactionId = await this.#captureTransactionId(transaction);

      const replay = await this.#replay({
        transaction,
        scope,
        caseId: record.id,
        idempotencyKey,
        requestHash,
      });
      if (replay) return replay;

      const stateRow = operation === 'create'
        ? firstRow(
          await transaction.execute(
            statement(ATOMIC_RLS_CASE_STATEMENTS.insertState, INSERT_STATE_SQL, [
              record.id,
              record.studentId,
              record.revision,
              record.status,
              record.createdAt,
              record.updatedAt,
              recordJson,
              recordHash,
            ]),
          ),
        )
        : firstRow(
          await transaction.execute(
            statement(ATOMIC_RLS_CASE_STATEMENTS.updateState, UPDATE_STATE_SQL, [
              record.revision,
              record.status,
              record.updatedAt,
              recordJson,
              recordHash,
              record.id,
              record.studentId,
              expectedRevision,
            ]),
          ),
        );
      if (!stateRow) await this.#rejectLostWrite({ transaction, scope, record, expectedRevision });
      assertSameTransaction(stateRow.transaction_id, transactionId);
      if (assertRevision(stateRow.revision) !== record.revision) failClosed('PERSISTED_REVISION_DIVERGED');
      const storedRecord = assertStoredRecord(stateRow.record, recordHash);

      // The audit row is written in this same transaction, before the receipt.
      // If it fails, the whole thing unwinds: state without its audit row is the
      // exact partial commit the atomicity requirement exists to prevent.
      const auditRow = firstRow(
        await transaction.execute(
          statement(ATOMIC_RLS_CASE_STATEMENTS.insertAuditEvent, INSERT_AUDIT_EVENT_SQL, [
            event.eventRef,
            record.id,
            event.caseRef,
            event.actorRef,
            event.actorRole,
            event.correlationRef,
            event.eventType,
            event.outcome,
            event.revision,
            event.occurredAt,
            canonicalize(event),
            eventHash,
          ]),
        ),
      );
      if (!auditRow) failClosed('AUDIT_EVENT_NOT_WRITTEN');
      if (auditRow.event_ref !== event.eventRef) failClosed('AUDIT_EVENT_REF_DIVERGED');
      assertSameTransaction(auditRow.transaction_id, transactionId);

      const receiptRow = firstRow(
        await transaction.execute(
          statement(ATOMIC_RLS_CASE_STATEMENTS.insertWriteReceipt, INSERT_WRITE_RECEIPT_SQL, [
            record.id,
            record.studentId,
            idempotencyKey,
            requestHash,
            operation,
            record.revision,
            recordJson,
            recordHash,
            eventHash,
            event.eventRef,
          ]),
        ),
      );
      // The state write already serialised writers for this case, so a receipt
      // collision here means the same key was reused for a different revision.
      if (!receiptRow) throw new DriverRejection(deepFreeze({ committed: false, errorCode: 'IDEMPOTENCY_CONFLICT' }));
      assertSameTransaction(receiptRow.transaction_id, transactionId);

      return deepFreeze({
        schemaVersion: ATOMIC_COMMIT_RECEIPT_SCHEMA,
        committed: true,
        stateCommitted: true,
        auditCommitted: true,
        sameTransaction: true,
        transactionId,
        replayed: false,
        operation,
        caseId: record.id,
        revision: record.revision,
        idempotencyKey,
        requestHash,
        recordHash,
        eventHash,
        auditEventRef: event.eventRef,
        record: storedRecord,
        authorizationBinding: authorizationBinding(scope),
      });
    });
  }

  async #replay({ transaction, scope, caseId, idempotencyKey, requestHash }) {
    const prior = firstRow(
      await transaction.execute(
        statement(ATOMIC_RLS_CASE_STATEMENTS.selectWriteReceipt, SELECT_WRITE_RECEIPT_SQL, [
          caseId,
          idempotencyKey,
          scope.resourceStudentId,
        ]),
      ),
    );
    if (!prior) return null;
    if (prior.request_hash !== requestHash) {
      throw new DriverRejection(deepFreeze({ committed: false, errorCode: 'IDEMPOTENCY_CONFLICT' }));
    }
    const priorHash = assertSha256(prior.record_hash, 'stored record_hash');
    const storedRecord = assertStoredRecord(prior.record, priorHash);
    // Belt and braces against the row itself, not only the predicate: selectCase already refuses a
    // record whose owner does not match the scope, and a replay must be held to the same rule.
    if (storedRecord.studentId !== scope.resourceStudentId) {
      throw new AuthorizationDeniedError('DRIVER_CASE_SCOPE_MISMATCH');
    }
    return deepFreeze({
      schemaVersion: ATOMIC_COMMIT_RECEIPT_SCHEMA,
      committed: true,
      stateCommitted: true,
      auditCommitted: true,
      sameTransaction: true,
      // The transaction that actually committed these rows, not this replay's.
      transactionId: assertTransactionId(prior.transaction_id),
      replayed: true,
      operation: prior.operation,
      caseId,
      revision: assertRevision(prior.revision),
      idempotencyKey,
      requestHash,
      recordHash: priorHash,
      eventHash: assertSha256(prior.event_hash, 'stored event_hash'),
      auditEventRef: assertNonEmptyString(prior.audit_event_ref, 'stored audit_event_ref', { maxLength: 200 }),
      record: storedRecord,
      authorizationBinding: authorizationBinding(scope),
    });
  }

  /**
   * The state write matched no row. Report WHY, with the revision the caller
   * actually lost to, and unwind: nothing about this command may commit.
   */
  async #rejectLostWrite({ transaction, scope, record, expectedRevision }) {
    const current = firstRow(
      await transaction.execute(
        statement(ATOMIC_RLS_CASE_STATEMENTS.selectRevision, SELECT_REVISION_SQL, [
          record.id,
          scope.resourceStudentId,
        ]),
      ),
    );
    if (!current) {
      throw new DriverRejection(deepFreeze({ committed: false, errorCode: 'NOT_FOUND' }));
    }
    throw new DriverRejection(deepFreeze({
      committed: false,
      errorCode: 'STALE_REVISION',
      expectedRevision: expectedRevision ?? null,
      actualRevision: assertRevision(current.revision),
    }));
  }
}

/**
 * @param {object} options
 * @param {Record<string, unknown>} options.binding
 * @param {SqlExecutorPort} options.executor
 */
export function createAtomicRlsCaseDriver(options) {
  return new AtomicRlsCaseDriver(options);
}

export const ATOMIC_RLS_CASE_DRIVER_CONTRACT = deepFreeze({
  integration: ATOMIC_RLS_CASE_DRIVER_INTEGRATION,
  authority: 'DR-119',
  relations: RELATIONS,
  relationOwnership: 'sole_layer_that_names_tables_or_columns',
  statements: ATOMIC_RLS_CASE_STATEMENTS,
  parameterization: 'all_caller_values_bound_never_interpolated',
  applicationDatabaseRole: APPLICATION_DB_ROLE,
  identitySource: 'server_verified_scope_only',
  identityScope: 'transaction_local_set_config_plus_connection_reset_on_exit',
  identityReset: RESET_IDENTITY_STATEMENT.text,
  atomicity: 'case_state_and_metadata_audit_and_write_receipt_in_one_transaction',
  concurrency: 'update_where_revision_equals_expected_revision',
  idempotency: 'case_id_and_idempotency_key_receipt_replay',
  rollback: 'every_non_commit_outcome_unwinds_the_transaction',
  atomicCommitReceiptSchema: ATOMIC_COMMIT_RECEIPT_SCHEMA,
  creationReservationReceiptSchema: CREATION_RESERVATION_RECEIPT_SCHEMA,
  driverAuthorizationSchema: DRIVER_AUTHORIZATION_SCHEMA,
  executorPort: {
    withConnection: 'exclusive_connection_for_the_handler',
    transaction: 'commit_on_resolve_rollback_and_rethrow_on_reject',
    statementShape: ['name', 'text', 'values'],
  },
});
