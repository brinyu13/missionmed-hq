const EXECUTOR_INTEGRATION = 'lor_node_postgres_executor';
export const NODE_POSTGRES_DATABASE_ROLE = 'lor_studio_app';
export const NODE_POSTGRES_SET_LOCAL_ROLE_SQL = 'SET LOCAL ROLE lor_studio_app';

const STATEMENT_KEYS = new Set(['statementId', 'text', 'values']);
const OPTION_KEYS = new Set([
  'pool',
  'databaseRole',
  'statementTimeoutMs',
  'lockTimeoutMs',
  'idleInTransactionSessionTimeoutMs',
]);
const INT8_OID = 20;
const INTEGER_TEXT = /^-?(?:0|[1-9][0-9]*)$/u;
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

const DEFAULT_TIMEOUTS = Object.freeze({
  statementTimeoutMs: 5_000,
  lockTimeoutMs: 2_000,
  idleInTransactionSessionTimeoutMs: 5_000,
});

const TRANSACTION_TIMEOUT_SQL = `SELECT
  pg_catalog.set_config('statement_timeout', $1, true) AS statement_timeout,
  pg_catalog.set_config('lock_timeout', $2, true) AS lock_timeout,
  pg_catalog.set_config('idle_in_transaction_session_timeout', $3, true)
    AS idle_in_transaction_session_timeout`;

export class NodePostgresExecutorError extends Error {
  constructor(code) {
    super(`Node PostgreSQL executor failed: ${code}`);
    this.name = 'NodePostgresExecutorError';
    this.code = code;
  }
}

function fail(code) {
  throw new NodePostgresExecutorError(code);
}

function observedRejectedPromise(error) {
  const rejection = Promise.reject(error);
  void rejection.catch(() => {});
  return rejection;
}

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function assertTimeout(value, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 120_000) {
    fail(`${name.toUpperCase()}_INVALID`);
  }
  return value;
}

function assertDatabaseRole(value) {
  if (value !== NODE_POSTGRES_DATABASE_ROLE) fail('DATABASE_ROLE_INVALID');
  return value;
}

function assertStatement(statement) {
  if (!hasExactKeys(statement, STATEMENT_KEYS)) fail('STATEMENT_CONTRACT_VIOLATED');
  if (typeof statement.statementId !== 'string' || statement.statementId.trim() === '') {
    fail('STATEMENT_ID_INVALID');
  }
  if (typeof statement.text !== 'string' || statement.text.trim() === '') {
    fail('STATEMENT_TEXT_INVALID');
  }
  if (!Array.isArray(statement.values)) fail('STATEMENT_VALUES_INVALID');
  return {
    text: statement.text,
    values: [...statement.values],
  };
}

function normalizeInteger(value) {
  let parsed;
  if (typeof value === 'bigint') {
    parsed = value;
  } else if (typeof value === 'string' && INTEGER_TEXT.test(value)) {
    parsed = BigInt(value);
  } else if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  } else {
    fail('INT8_RESULT_INVALID');
  }
  if (parsed >= MIN_SAFE_BIGINT && parsed <= MAX_SAFE_BIGINT) return Number(parsed);
  return parsed.toString(10);
}

function normalizeValue(value, seen) {
  if (typeof value === 'bigint') return normalizeInteger(value);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date || value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return value;
  }
  if (seen.has(value)) fail('RESULT_CYCLE_REJECTED');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => normalizeValue(entry, seen));
    }
    if (!isRecord(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry, seen)]),
    );
  } finally {
    seen.delete(value);
  }
}

function int8Columns(fields) {
  if (fields === undefined) return new Set();
  if (!Array.isArray(fields)) fail('RESULT_FIELDS_INVALID');
  const names = new Set();
  for (const field of fields) {
    if (!field || typeof field !== 'object') fail('RESULT_FIELD_INVALID');
    if (field.dataTypeID === INT8_OID) {
      if (typeof field.name !== 'string' || field.name === '') fail('RESULT_FIELD_NAME_INVALID');
      names.add(field.name);
    }
  }
  return names;
}

function normalizeResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    fail('QUERY_RESULT_CONTRACT_VIOLATED');
  }
  if (!Array.isArray(result.rows)) fail('QUERY_ROWS_CONTRACT_VIOLATED');
  const integerColumns = int8Columns(result.fields);
  const rows = result.rows.map((row) => {
    if (!isRecord(row)) fail('QUERY_ROW_CONTRACT_VIOLATED');
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = integerColumns.has(key) && value !== null
        ? normalizeInteger(value)
        : normalizeValue(value, new WeakSet());
    }
    return normalized;
  });
  return Object.freeze({ rows: Object.freeze(rows) });
}

function timeoutValues(timeouts) {
  return [
    `${timeouts.statementTimeoutMs}ms`,
    `${timeouts.lockTimeoutMs}ms`,
    `${timeouts.idleInTransactionSessionTimeoutMs}ms`,
  ];
}

function assertClient(client) {
  if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') {
    fail('POOL_CLIENT_CONTRACT_VIOLATED');
  }
  return client;
}

class NodePostgresExecutor {
  constructor(options) {
    if (!hasExactKeys(options, OPTION_KEYS)) fail('EXECUTOR_OPTIONS_UNRECOGNIZED');
    if (!options.pool || typeof options.pool.connect !== 'function') fail('POOL_REQUIRED');
    this.pool = options.pool;
    this.databaseRole = assertDatabaseRole(options.databaseRole);
    this.timeouts = Object.freeze({
      statementTimeoutMs: assertTimeout(options.statementTimeoutMs, 'statement_timeout'),
      lockTimeoutMs: assertTimeout(options.lockTimeoutMs, 'lock_timeout'),
      idleInTransactionSessionTimeoutMs: assertTimeout(
        options.idleInTransactionSessionTimeoutMs,
        'idle_in_transaction_session_timeout',
      ),
    });
    this.serverOnly = true;
    this.transactional = true;
    this.preparedStatements = false;
    Object.freeze(this);
  }

  async withConnection(handler) {
    if (typeof handler !== 'function') fail('CONNECTION_HANDLER_REQUIRED');
    const client = assertClient(await this.pool.connect());
    const state = {
      released: false,
      outerHandlerSettled: false,
      activeTransaction: null,
      unsafe: false,
      unsafeError: undefined,
      destroyError: undefined,
    };
    const assertUsable = () => {
      if (state.released) fail('CONNECTION_ALREADY_RELEASED');
    };
    const markUnsafe = (error) => {
      if (!state.unsafe) {
        state.unsafe = true;
        state.unsafeError = error;
        state.destroyError = error || new NodePostgresExecutorError(
          'UNSAFE_TRANSACTION_STATE',
        );
      }
    };

    const connection = Object.freeze({
      transaction: (transactionHandler) => {
        try {
          assertUsable();
          if (state.outerHandlerSettled) fail('CONNECTION_HANDLER_SETTLED');
          if (typeof transactionHandler !== 'function') fail('TRANSACTION_HANDLER_REQUIRED');
          if (state.activeTransaction) fail('NESTED_TRANSACTION_PROHIBITED');
        } catch (error) {
          return observedRejectedPromise(error);
        }

        const transactionRecord = {
          abortOnly: false,
          abortErrorSet: false,
          abortError: undefined,
          finished: false,
          promise: null,
          settlement: null,
        };
        state.activeTransaction = transactionRecord;

        const transactionPromise = (async () => {
          const transactionState = {
            active: false,
            firstQueryFailed: false,
            firstQueryError: undefined,
            queryInFlight: false,
            querySettlement: null,
          };
          try {
            try {
              await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
              transactionState.active = true;
            } catch (error) {
              markUnsafe(error);
              throw error;
            }

            const transaction = Object.freeze({
              execute: (statement) => {
                let ownsQuerySlot = false;
                const execution = (async () => {
                  try {
                    assertUsable();
                    if (
                      !transactionState.active
                      || state.activeTransaction !== transactionRecord
                    ) {
                      fail('TRANSACTION_NOT_ACTIVE');
                    }
                    if (transactionRecord.abortOnly || state.outerHandlerSettled) {
                      fail('TRANSACTION_ABORT_ONLY');
                    }
                    if (transactionState.queryInFlight) {
                      fail('CONCURRENT_TRANSACTION_QUERY_PROHIBITED');
                    }
                    const query = assertStatement(statement);
                    transactionState.queryInFlight = true;
                    ownsQuerySlot = true;
                    return normalizeResult(await client.query(query));
                  } catch (error) {
                    if (!transactionState.firstQueryFailed) {
                      transactionState.firstQueryFailed = true;
                      transactionState.firstQueryError = error;
                    }
                    throw error;
                  } finally {
                    if (ownsQuerySlot) transactionState.queryInFlight = false;
                  }
                })();
                if (ownsQuerySlot) {
                  transactionState.querySettlement = execution.then(
                    (value) => ({ failed: false, value }),
                    (error) => ({ failed: true, error }),
                  );
                }
                // Register a rejection observer immediately. The original
                // promise is still returned unchanged to the caller.
                void execution.catch(() => {});
                return execution;
              },
            });

            let value;
            try {
              // This is deliberately a constant SQL statement, not an identifier
              // supplied by a caller. PostgreSQL role identifiers cannot be bound
              // as values, and allowing interpolation here would turn target
              // configuration into privilege selection. It must be the first
              // statement after BEGIN so every later GUC and application query
              // executes under the fixed least-privilege application role.
              await client.query(NODE_POSTGRES_SET_LOCAL_ROLE_SQL);
              if (transactionRecord.abortOnly || state.outerHandlerSettled) {
                throw transactionRecord.abortErrorSet
                  ? transactionRecord.abortError
                  : new NodePostgresExecutorError('TRANSACTION_LEAKED');
              }
              await client.query({
                text: TRANSACTION_TIMEOUT_SQL,
                values: timeoutValues(this.timeouts),
              });
              if (transactionRecord.abortOnly || state.outerHandlerSettled) {
                throw transactionRecord.abortErrorSet
                  ? transactionRecord.abortError
                  : new NodePostgresExecutorError('TRANSACTION_LEAKED');
              }
              value = await transactionHandler(transaction);
              if (transactionState.queryInFlight) {
                const queryLeakError = new NodePostgresExecutorError(
                  'TRANSACTION_QUERY_NOT_AWAITED',
                );
                transactionRecord.abortOnly = true;
                transactionRecord.abortErrorSet = true;
                transactionRecord.abortError = queryLeakError;
                await transactionState.querySettlement;
                throw queryLeakError;
              }
              if (transactionState.firstQueryFailed) {
                throw transactionState.firstQueryError;
              }
              if (transactionRecord.abortOnly || state.outerHandlerSettled) {
                throw transactionRecord.abortErrorSet
                  ? transactionRecord.abortError
                  : new NodePostgresExecutorError('TRANSACTION_LEAKED');
              }
              try {
                await client.query('COMMIT');
              } catch (error) {
                markUnsafe(error);
                throw error;
              }
              transactionState.active = false;
              return value;
            } catch (error) {
              if (transactionState.active) {
                try {
                  await client.query('ROLLBACK');
                  transactionState.active = false;
                } catch (rollbackError) {
                  markUnsafe(rollbackError);
                }
              }
              throw error;
            }
          } finally {
            transactionRecord.finished = true;
            if (state.activeTransaction === transactionRecord) {
              state.activeTransaction = null;
            }
          }
        })();

        transactionRecord.promise = transactionPromise;
        transactionRecord.settlement = transactionPromise.then(
          (value) => ({ failed: false, value }),
          (error) => ({ failed: true, error }),
        );
        return transactionPromise;
      },
    });

    let handlerFailed = false;
    let handlerError = undefined;
    let value;
    try {
      const handlerResult = handler(connection);
      if (
        handlerResult !== null
        && (typeof handlerResult === 'object' || typeof handlerResult === 'function')
        && typeof handlerResult.then === 'function'
      ) {
        value = await handlerResult;
      } else {
        value = handlerResult;
      }
    } catch (error) {
      handlerFailed = true;
      handlerError = error;
    }

    state.outerHandlerSettled = true;
    const leakedTransaction = state.activeTransaction;
    if (leakedTransaction && !leakedTransaction.finished) {
      const leakError = new NodePostgresExecutorError('TRANSACTION_LEAKED');
      leakedTransaction.abortOnly = true;
      leakedTransaction.abortErrorSet = true;
      leakedTransaction.abortError = leakError;
      await leakedTransaction.settlement;
      if (!handlerFailed) {
        handlerFailed = true;
        handlerError = leakError;
      }
    }

    state.released = true;
    let releaseFailed = false;
    let releaseError = undefined;
    try {
      if (state.unsafe) client.release(state.destroyError);
      else client.release();
    } catch (error) {
      releaseFailed = true;
      releaseError = error;
    }
    if (releaseFailed) {
      handlerError = handlerFailed
        ? new AggregateError(
          [handlerError, releaseError],
          'Node PostgreSQL connection release failed after handler failure',
        )
        : releaseError;
      handlerFailed = true;
    }
    if (handlerFailed) throw handlerError;
    return value;
  }
}

/**
 * Build the node-postgres executor around an already-created Pool-like object.
 *
 * This module intentionally does not import `pg` and accepts no connection
 * string, host, credential, or environment configuration. The future runtime
 * owns target binding and injects its reviewed Pool after the dependency and
 * target gates exist. Logical statement identifiers are never forwarded as
 * node-postgres prepared-statement names, which keeps the port safe behind a
 * transaction-mode pooler.
 */
export function createNodePostgresExecutor(options = {}) {
  if (!isRecord(options) || Object.keys(options).some((key) => !OPTION_KEYS.has(key))) {
    fail('EXECUTOR_OPTIONS_UNRECOGNIZED');
  }
  const {
    pool,
    databaseRole,
    statementTimeoutMs = DEFAULT_TIMEOUTS.statementTimeoutMs,
    lockTimeoutMs = DEFAULT_TIMEOUTS.lockTimeoutMs,
    idleInTransactionSessionTimeoutMs = DEFAULT_TIMEOUTS.idleInTransactionSessionTimeoutMs,
  } = options;
  return new NodePostgresExecutor({
    pool,
    databaseRole,
    statementTimeoutMs,
    lockTimeoutMs,
    idleInTransactionSessionTimeoutMs,
  });
}

export const NODE_POSTGRES_EXECUTOR_CONTRACT = Object.freeze({
  integration: EXECUTOR_INTEGRATION,
  authority: 'DR-133',
  dependencyImport: 'none_pool_is_injected',
  serverOnly: true,
  transactional: true,
  connectionShape: ['transaction'],
  transactionShape: ['execute'],
  statementShape: ['statementId', 'text', 'values'],
  forwardedQueryShape: ['text', 'values'],
  resultShape: ['rows'],
  preparedStatements: 'disabled_for_transaction_pooling',
  databaseRole: NODE_POSTGRES_DATABASE_ROLE,
  roleSelection: 'fixed_explicit_constructor_option',
  roleBinding: 'constant_set_local_role_immediately_after_begin',
  setLocalRoleSql: NODE_POSTGRES_SET_LOCAL_ROLE_SQL,
  identityCleanup: 'transaction_local_commit_or_rollback',
  unsafeConnectionCleanup: 'release_with_truthy_error_destroys_client_exact_failure_rethrown',
  leakedWork: 'abort_only_and_drained_before_release',
  failureTracking: 'boolean_flags_preserve_falsy_thrown_values',
  timeoutBinding: 'transaction_local_before_handler',
  bigintNormalization: 'safe_number_else_decimal_string',
  defaultTimeouts: DEFAULT_TIMEOUTS,
});
