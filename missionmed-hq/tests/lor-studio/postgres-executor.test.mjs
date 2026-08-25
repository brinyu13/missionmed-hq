import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  NODE_POSTGRES_EXECUTOR_CONTRACT,
  NodePostgresExecutorError,
  createNodePostgresExecutor,
} from '../../lor-studio/adapters/node-postgres-executor.mjs';

function result(rows = [], fields = []) {
  return { rows, fields };
}

function createFakePool({ query, release } = {}) {
  const calls = [];
  const releases = [];
  let connections = 0;
  const client = {
    async query(input) {
      calls.push(input);
      if (query) return query(input, calls.length);
      return result();
    },
    release(...args) {
      releases.push(args);
      if (release) return release(...args);
      return undefined;
    },
  };
  return {
    pool: {
      async connect() {
        connections += 1;
        return client;
      },
    },
    calls,
    releases,
    stats: () => ({ connections }),
  };
}

function statement(overrides = {}) {
  return {
    statementId: 'lor_test_query',
    text: 'SELECT $1::bigint AS safe_count',
    values: ['41'],
    ...overrides,
  };
}

function isExecutorError(code) {
  return (error) => error instanceof NodePostgresExecutorError && error.code === code;
}

async function captureOutcome(promise) {
  try {
    return { rejected: false, value: await promise };
  } catch (error) {
    return { rejected: true, error };
  }
}

test('module is dependency-injected and does not import or resolve pg', () => {
  const source = readFileSync(
    new URL('../../lor-studio/adapters/node-postgres-executor.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /(?:from|import\s*\()\s*['"]pg['"]/u);
  assert.equal(NODE_POSTGRES_EXECUTOR_CONTRACT.dependencyImport, 'none_pool_is_injected');
  assert.deepEqual(NODE_POSTGRES_EXECUTOR_CONTRACT.statementShape, [
    'statementId',
    'text',
    'values',
  ]);
  assert.deepEqual(NODE_POSTGRES_EXECUTOR_CONTRACT.forwardedQueryShape, ['text', 'values']);
});

test('factory fails closed without an injected Pool and on unbounded timeouts', () => {
  assert.throws(() => createNodePostgresExecutor(), isExecutorError('POOL_REQUIRED'));
  assert.throws(
    () => createNodePostgresExecutor({ pool: { connect() {} }, connectionString: 'forbidden' }),
    isExecutorError('EXECUTOR_OPTIONS_UNRECOGNIZED'),
  );
  assert.throws(
    () => createNodePostgresExecutor({ pool: { connect() {} }, statementTimeoutMs: 0 }),
    isExecutorError('STATEMENT_TIMEOUT_INVALID'),
  );
  assert.throws(
    () => createNodePostgresExecutor({
      pool: { connect() {} },
      idleInTransactionSessionTimeoutMs: 120_001,
    }),
    isExecutorError('IDLE_IN_TRANSACTION_SESSION_TIMEOUT_INVALID'),
  );
});

test('forwards text and values only, binds local timeouts, and normalizes bigint safely', async () => {
  const unsafe = '9007199254740993';
  const fake = createFakePool({
    query(input) {
      if (typeof input === 'string') return result();
      if (input.text.includes("set_config('statement_timeout'")) return result([{}]);
      return result(
        [{
          safe_count: '41',
          unsafe_count: unsafe,
          nested: { safe: 7n, unsafe: 9_007_199_254_740_993n },
        }],
        [
          { name: 'safe_count', dataTypeID: 20 },
          { name: 'unsafe_count', dataTypeID: 20 },
          { name: 'nested', dataTypeID: 3802 },
        ],
      );
    },
  });
  const executor = createNodePostgresExecutor({ pool: fake.pool });

  const observed = await executor.withConnection(async (connection) => {
    assert.deepEqual(Object.keys(connection), ['transaction']);
    return connection.transaction(async (transaction) => {
      assert.deepEqual(Object.keys(transaction), ['execute']);
      return transaction.execute(statement());
    });
  });

  assert.deepEqual(observed, {
    rows: [{
      safe_count: 41,
      unsafe_count: unsafe,
      nested: { safe: 7, unsafe },
    }],
  });
  assert.equal(executor.serverOnly, true);
  assert.equal(executor.transactional, true);
  assert.equal(executor.preparedStatements, false);
  assert.equal(fake.stats().connections, 1);
  assert.equal(fake.calls[0], 'BEGIN ISOLATION LEVEL READ COMMITTED');
  assert.match(fake.calls[1].text, /pg_catalog\.set_config\('statement_timeout', \$1, true\)/u);
  assert.deepEqual(fake.calls[1].values, ['5000ms', '2000ms', '5000ms']);
  assert.deepEqual(fake.calls[2], {
    text: statement().text,
    values: statement().values,
  });
  assert.equal(Object.hasOwn(fake.calls[2], 'statementId'), false);
  assert.equal(Object.hasOwn(fake.calls[2], 'name'), false);
  assert.equal(fake.calls[3], 'COMMIT');
  assert.deepEqual(fake.releases, [[]]);
  assert.equal(fake.calls.some((call) => call === 'DISCARD ALL'), false);
});

test('uses caller-selected bounded timeout values without interpolating them into SQL', async () => {
  const fake = createFakePool();
  const executor = createNodePostgresExecutor({
    pool: fake.pool,
    statementTimeoutMs: 8_000,
    lockTimeoutMs: 3_000,
    idleInTransactionSessionTimeoutMs: 9_000,
  });
  await executor.withConnection((connection) => connection.transaction(
    (transaction) => transaction.execute(statement()),
  ));
  assert.deepEqual(fake.calls[1].values, ['8000ms', '3000ms', '9000ms']);
  assert.doesNotMatch(fake.calls[1].text, /8000|3000|9000/u);
});

test('rolls back and rethrows the exact handler error', async () => {
  const fake = createFakePool();
  const executor = createNodePostgresExecutor({ pool: fake.pool });
  const marker = new Error('handler marker');

  await assert.rejects(
    executor.withConnection((connection) => connection.transaction(async (transaction) => {
      await transaction.execute(statement());
      throw marker;
    })),
    (error) => error === marker,
  );

  assert.equal(fake.calls.at(-1), 'ROLLBACK');
  assert.equal(fake.calls.includes('COMMIT'), false);
  assert.deepEqual(fake.releases, [[]]);
});

test('a caught query failure still poisons the transaction and is rethrown after rollback', async () => {
  const marker = new Error('query marker');
  const fake = createFakePool({
    query(input) {
      if (typeof input !== 'string' && input.text === 'SELECT broken') throw marker;
      return result();
    },
  });
  const executor = createNodePostgresExecutor({ pool: fake.pool });

  await assert.rejects(
    executor.withConnection((connection) => connection.transaction(async (transaction) => {
      await assert.rejects(transaction.execute(statement({ text: 'SELECT broken', values: [] })));
      return 'caller-tried-to-continue';
    })),
    (error) => error === marker,
  );

  assert.deepEqual(fake.calls, [
    'BEGIN ISOLATION LEVEL READ COMMITTED',
    {
      text: fake.calls[1].text,
      values: ['5000ms', '2000ms', '5000ms'],
    },
    { text: 'SELECT broken', values: [] },
    'ROLLBACK',
  ]);
  assert.deepEqual(fake.releases, [[]]);
});

test('rollback uncertainty destroys the client while preserving the handler error', async () => {
  const handlerError = new Error('handler marker');
  const rollbackError = new Error('rollback marker');
  const fake = createFakePool({
    query(input) {
      if (input === 'ROLLBACK') throw rollbackError;
      return result();
    },
  });
  const executor = createNodePostgresExecutor({ pool: fake.pool });

  await assert.rejects(
    executor.withConnection((connection) => connection.transaction(() => {
      throw handlerError;
    })),
    (error) => error === handlerError,
  );
  assert.deepEqual(fake.releases, [[rollbackError]]);
});

test('commit uncertainty attempts rollback, rethrows commit failure, and destroys the client', async () => {
  const commitError = new Error('commit marker');
  const fake = createFakePool({
    query(input) {
      if (input === 'COMMIT') throw commitError;
      return result();
    },
  });
  const executor = createNodePostgresExecutor({ pool: fake.pool });

  await assert.rejects(
    executor.withConnection((connection) => connection.transaction(
      (transaction) => transaction.execute(statement()),
    )),
    (error) => error === commitError,
  );
  assert.deepEqual(fake.calls.slice(-2), ['COMMIT', 'ROLLBACK']);
  assert.deepEqual(fake.releases, [[commitError]]);
});

test('BEGIN uncertainty destroys the client and does not invent a rollback result', async () => {
  const beginError = new Error('begin marker');
  const fake = createFakePool({
    query(input) {
      if (input === 'BEGIN ISOLATION LEVEL READ COMMITTED') throw beginError;
      return result();
    },
  });
  const executor = createNodePostgresExecutor({ pool: fake.pool });

  await assert.rejects(
    executor.withConnection((connection) => connection.transaction(() => 'never')),
    (error) => error === beginError,
  );
  assert.deepEqual(fake.calls, ['BEGIN ISOLATION LEVEL READ COMMITTED']);
  assert.deepEqual(fake.releases, [[beginError]]);
});

test('release failure is surfaced, including when a handler already failed', async () => {
  const releaseError = new Error('release marker');
  const handlerError = new Error('handler marker');
  const first = createFakePool({
    release() {
      throw releaseError;
    },
  });
  const firstExecutor = createNodePostgresExecutor({ pool: first.pool });
  await assert.rejects(
    firstExecutor.withConnection(() => 'handled'),
    (error) => error === releaseError,
  );

  const second = createFakePool({
    release() {
      throw releaseError;
    },
  });
  const secondExecutor = createNodePostgresExecutor({ pool: second.pool });
  await assert.rejects(
    secondExecutor.withConnection(() => {
      throw handlerError;
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [handlerError, releaseError]);
      return true;
    },
  );
});

test('undefined, null, and zero handler throws remain exact rejections', async () => {
  for (const marker of [undefined, null, 0]) {
    const fake = createFakePool();
    const executor = createNodePostgresExecutor({ pool: fake.pool });
    const outcome = await captureOutcome(executor.withConnection(() => {
      throw marker;
    }));
    assert.equal(outcome.rejected, true);
    assert.equal(Object.is(outcome.error, marker), true);
    assert.deepEqual(fake.releases, [[]]);
  }
});

test('undefined, null, and zero query rejections poison and roll back the transaction', async () => {
  for (const marker of [undefined, null, 0]) {
    const fake = createFakePool({
      query(input) {
        if (typeof input !== 'string' && input.text === 'SELECT falsy_failure') {
          return Promise.reject(marker);
        }
        return result();
      },
    });
    const executor = createNodePostgresExecutor({ pool: fake.pool });
    const outcome = await captureOutcome(executor.withConnection(
      (connection) => connection.transaction(async (transaction) => {
        await captureOutcome(transaction.execute(statement({
          text: 'SELECT falsy_failure',
          values: [],
        })));
        return 'must-not-commit';
      }),
    ));
    assert.equal(outcome.rejected, true);
    assert.equal(Object.is(outcome.error, marker), true);
    assert.equal(fake.calls.at(-1), 'ROLLBACK');
    assert.equal(fake.calls.includes('COMMIT'), false);
  }
});

test('falsy unsafe and release errors are retained independently from their values', async () => {
  for (const marker of [undefined, null, 0]) {
    const beginUnsafe = createFakePool({
      query(input) {
        if (input === 'BEGIN ISOLATION LEVEL READ COMMITTED') return Promise.reject(marker);
        return result();
      },
    });
    const beginExecutor = createNodePostgresExecutor({ pool: beginUnsafe.pool });
    const beginOutcome = await captureOutcome(beginExecutor.withConnection(
      (connection) => connection.transaction(() => undefined),
    ));
    assert.equal(beginOutcome.rejected, true);
    assert.equal(Object.is(beginOutcome.error, marker), true);
    assert.equal(beginUnsafe.releases.length, 1);
    assert.equal(beginUnsafe.releases[0].length, 1);
    assert.ok(beginUnsafe.releases[0][0]);
    assert.ok(beginUnsafe.releases[0][0] instanceof NodePostgresExecutorError);
    assert.equal(beginUnsafe.releases[0][0].code, 'UNSAFE_TRANSACTION_STATE');

    const commitUnsafe = createFakePool({
      query(input) {
        if (input === 'COMMIT') return Promise.reject(marker);
        return result();
      },
    });
    const commitExecutor = createNodePostgresExecutor({ pool: commitUnsafe.pool });
    const commitOutcome = await captureOutcome(commitExecutor.withConnection(
      (connection) => connection.transaction(() => 'never-committed'),
    ));
    assert.equal(commitOutcome.rejected, true);
    assert.equal(Object.is(commitOutcome.error, marker), true);
    assert.ok(commitUnsafe.releases[0][0]);
    assert.equal(commitUnsafe.releases[0][0].code, 'UNSAFE_TRANSACTION_STATE');

    const outwardError = new Error(`rollback outward ${String(marker)}`);
    const rollbackUnsafe = createFakePool({
      query(input) {
        if (input === 'ROLLBACK') return Promise.reject(marker);
        return result();
      },
    });
    const rollbackExecutor = createNodePostgresExecutor({ pool: rollbackUnsafe.pool });
    const rollbackOutcome = await captureOutcome(rollbackExecutor.withConnection(
      (connection) => connection.transaction(() => {
        throw outwardError;
      }),
    ));
    assert.equal(rollbackOutcome.rejected, true);
    assert.equal(rollbackOutcome.error, outwardError);
    assert.ok(rollbackUnsafe.releases[0][0]);
    assert.equal(rollbackUnsafe.releases[0][0].code, 'UNSAFE_TRANSACTION_STATE');

    const releasing = createFakePool({
      release() {
        throw marker;
      },
    });
    const releasingExecutor = createNodePostgresExecutor({ pool: releasing.pool });
    const releaseOutcome = await captureOutcome(releasingExecutor.withConnection(() => 'value'));
    assert.equal(releaseOutcome.rejected, true);
    assert.equal(Object.is(releaseOutcome.error, marker), true);
  }

  const aggregate = createFakePool({
    release() {
      throw 0;
    },
  });
  const aggregateExecutor = createNodePostgresExecutor({ pool: aggregate.pool });
  const aggregateOutcome = await captureOutcome(aggregateExecutor.withConnection(() => {
    throw undefined;
  }));
  assert.equal(aggregateOutcome.rejected, true);
  assert.ok(aggregateOutcome.error instanceof AggregateError);
  assert.equal(Object.is(aggregateOutcome.error.errors[0], undefined), true);
  assert.equal(Object.is(aggregateOutcome.error.errors[1], 0), true);
});

test('an unawaited transaction becomes abort-only before commit and drains before release', async () => {
  let finishBegin;
  let announceBegin;
  const beginStarted = new Promise((resolve) => { announceBegin = resolve; });
  const events = [];
  const fake = createFakePool({
    query(input) {
      events.push(typeof input === 'string' ? input : input.text);
      if (input === 'BEGIN ISOLATION LEVEL READ COMMITTED') {
        announceBegin();
        return new Promise((resolve) => { finishBegin = () => resolve(result()); });
      }
      return result();
    },
    release() {
      events.push('RELEASE');
    },
  });
  const executor = createNodePostgresExecutor({ pool: fake.pool });
  const pending = executor.withConnection((connection) => {
    void connection.transaction((transaction) => transaction.execute(statement()));
    return 'outer-returned';
  });
  await beginStarted;
  finishBegin();
  await assert.rejects(pending, isExecutorError('TRANSACTION_LEAKED'));
  assert.deepEqual(events, ['BEGIN ISOLATION LEVEL READ COMMITTED', 'ROLLBACK', 'RELEASE']);
  assert.equal(fake.calls.includes('COMMIT'), false);
});

test('leaked in-flight query rejection is observed and drained before client release', async () => {
  let announceSlowQuery;
  const slowQueryStarted = new Promise((resolve) => { announceSlowQuery = resolve; });
  const events = [];
  const unhandled = [];
  const onUnhandled = (error) => { unhandled.push(error); };
  process.on('unhandledRejection', onUnhandled);
  const fake = createFakePool({
    query(input) {
      const label = typeof input === 'string' ? input : input.text;
      events.push(label);
      if (label === 'SELECT slow_rejection') {
        announceSlowQuery();
        return new Promise((resolve, reject) => {
          setImmediate(() => {
            events.push('SLOW_QUERY_SETTLED');
            reject(undefined);
          });
        });
      }
      return result();
    },
    release() {
      events.push('RELEASE');
    },
  });
  const executor = createNodePostgresExecutor({ pool: fake.pool });
  try {
    const outcome = await captureOutcome(executor.withConnection(async (connection) => {
      void connection.transaction(async (transaction) => {
        void transaction.execute(statement({ text: 'SELECT slow_rejection', values: [] }));
      });
      await slowQueryStarted;
      return 'outer-returned';
    }));
    assert.equal(outcome.rejected, true);
    assert.ok(outcome.error instanceof NodePostgresExecutorError);
    assert.equal(outcome.error.code, 'TRANSACTION_LEAKED');
    await new Promise((resolve) => { setImmediate(resolve); });
    assert.deepEqual(unhandled, []);
    assert.equal(events.at(-1), 'RELEASE');
    assert.ok(events.indexOf('SLOW_QUERY_SETTLED') < events.indexOf('ROLLBACK'));
    assert.ok(events.indexOf('ROLLBACK') < events.indexOf('RELEASE'));
    assert.equal(fake.calls.includes('COMMIT'), false);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('rejects legacy or expanded statements and malformed query results inside rollback', async () => {
  const fake = createFakePool({
    query(input) {
      if (typeof input !== 'string' && input.text === 'SELECT malformed') return { rowCount: 0 };
      return result();
    },
  });
  const executor = createNodePostgresExecutor({ pool: fake.pool });

  await assert.rejects(
    executor.withConnection((connection) => connection.transaction(
      (transaction) => transaction.execute({ ...statement(), name: 'legacy_name' }),
    )),
    isExecutorError('STATEMENT_CONTRACT_VIOLATED'),
  );
  assert.equal(fake.calls.at(-1), 'ROLLBACK');

  await assert.rejects(
    executor.withConnection((connection) => connection.transaction(
      (transaction) => transaction.execute(statement({ text: 'SELECT malformed', values: [] })),
    )),
    isExecutorError('QUERY_ROWS_CONTRACT_VIOLATED'),
  );
  assert.equal(fake.calls.at(-1), 'ROLLBACK');
});

test('rejects nested transactions and expired transaction capabilities', async () => {
  const fake = createFakePool();
  const executor = createNodePostgresExecutor({ pool: fake.pool });
  let capturedTransaction;

  await assert.rejects(
    executor.withConnection((connection) => connection.transaction(async (transaction) => {
      await assert.rejects(
        connection.transaction(() => undefined),
        isExecutorError('NESTED_TRANSACTION_PROHIBITED'),
      );
      throw new Error('force outer rollback');
    })),
  );

  await executor.withConnection((connection) => connection.transaction(async (transaction) => {
    capturedTransaction = transaction;
    await transaction.execute(statement());
  }));
  await assert.rejects(
    capturedTransaction.execute(statement()),
    isExecutorError('CONNECTION_ALREADY_RELEASED'),
  );
});

test('rejects concurrent transaction queries and rolls back even if the caller catches it', async () => {
  let releaseFirstQuery;
  const fake = createFakePool({
    query(input) {
      if (typeof input !== 'string' && input.text === 'SELECT slow') {
        return new Promise((resolve) => { releaseFirstQuery = () => resolve(result()); });
      }
      return result();
    },
  });
  const executor = createNodePostgresExecutor({ pool: fake.pool });

  await assert.rejects(
    executor.withConnection((connection) => connection.transaction(async (transaction) => {
      const first = transaction.execute(statement({ text: 'SELECT slow', values: [] }));
      await assert.rejects(
        transaction.execute(statement({ text: 'SELECT concurrent', values: [] })),
        isExecutorError('CONCURRENT_TRANSACTION_QUERY_PROHIBITED'),
      );
      releaseFirstQuery();
      await first;
    })),
    isExecutorError('CONCURRENT_TRANSACTION_QUERY_PROHIBITED'),
  );
  assert.equal(fake.calls.at(-1), 'ROLLBACK');
});

test('caught concurrent execute cannot replace settlement for the unawaited slot owner', async () => {
  let settleFirstQuery;
  const events = [];
  const fake = createFakePool({
    query(input) {
      const label = typeof input === 'string' ? input : input.text;
      events.push(label);
      if (label === 'SELECT slot_owner') {
        return new Promise((resolve) => {
          settleFirstQuery = () => {
            events.push('SLOT_OWNER_SETTLED');
            resolve(result());
          };
        });
      }
      return result();
    },
    release() {
      events.push('RELEASE');
    },
  });
  const executor = createNodePostgresExecutor({ pool: fake.pool });

  await assert.rejects(
    executor.withConnection((connection) => connection.transaction(async (transaction) => {
      void transaction.execute(statement({ text: 'SELECT slot_owner', values: [] }));
      const concurrent = await captureOutcome(transaction.execute(statement({
        text: 'SELECT must_not_run',
        values: [],
      })));
      assert.equal(concurrent.rejected, true);
      assert.ok(concurrent.error instanceof NodePostgresExecutorError);
      assert.equal(concurrent.error.code, 'CONCURRENT_TRANSACTION_QUERY_PROHIBITED');
      setImmediate(settleFirstQuery);
    })),
    isExecutorError('TRANSACTION_QUERY_NOT_AWAITED'),
  );

  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(fake.calls.some((call) => call?.text === 'SELECT must_not_run'), false);
  assert.ok(events.indexOf('SLOT_OWNER_SETTLED') < events.indexOf('ROLLBACK'));
  assert.ok(events.indexOf('ROLLBACK') < events.indexOf('RELEASE'));
});
