import assert from 'node:assert/strict';
import test from 'node:test';
import { PostgresRepository, PostgresRepositoryError } from '../src/postgres-repository.mjs';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function repositoryError(code) {
  return (error) => error instanceof PostgresRepositoryError && error.code === code;
}

function fakeClient({ actorId = ACTOR_ID, rowFor, failFor } = {}) {
  const calls = [];
  let releaseCount = 0;
  return {
    calls,
    get releaseCount() {
      return releaseCount;
    },
    async query(text, values = []) {
      calls.push({ text, values });
      if (failFor) {
        const failure = failFor(text, calls.length);
        if (failure) throw failure;
      }
      if (text === 'SELECT i1q.current_actor_id() AS actor_id') {
        return { rows: [{ actor_id: actorId }] };
      }
      if (rowFor) {
        const rows = rowFor(text, values);
        if (rows !== undefined) return { rows };
      }
      return { rows: [] };
    },
    release() {
      releaseCount += 1;
    },
  };
}

function repositoryFor(client, connectCounter = { count: 0 }) {
  return {
    repository: new PostgresRepository({
      connect: async () => {
        connectCounter.count += 1;
        return client;
      },
    }),
    connectCounter,
  };
}

test('constructor and pool factory require connection functions', () => {
  assert.throws(() => new PostgresRepository(), repositoryError('postgres_connect_function_required'));
  assert.throws(() => new PostgresRepository({ connect: true }), repositoryError('postgres_connect_function_required'));
  assert.throws(() => PostgresRepository.fromPool(), repositoryError('postgres_pool_connect_required'));
  assert.throws(() => PostgresRepository.fromPool({ connect: true }), repositoryError('postgres_pool_connect_required'));
});

test('successful transaction commits, releases once, and closes the transaction handle', async () => {
  const revision = { id: 'revision_1', content_hash: HASH_A };
  const client = fakeClient({
    rowFor(text) {
      if (text.includes('FROM i1q.item_revisions')) return [revision];
      return undefined;
    },
  });
  const { repository, connectCounter } = repositoryFor(client);
  let capturedTransaction;

  const result = await repository.withTransaction(async (transaction, identity) => {
    capturedTransaction = transaction;
    assert.deepEqual(identity, { actorId: ACTOR_ID });
    assert.equal(Object.isFrozen(identity), true);
    assert.throws(() => {
      identity.actorId = 'changed';
    }, TypeError);
    return transaction.getItemRevision('revision_1');
  });

  assert.deepEqual(result, revision);
  assert.equal(connectCounter.count, 1);
  assert.equal(client.releaseCount, 1);
  assert.equal(client.calls[0].text, 'BEGIN');
  assert.equal(client.calls[1].text, 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  assert.equal(client.calls[2].text, 'SELECT i1q.current_actor_id() AS actor_id');
  assert.match(client.calls[3].text, /FROM i1q\.item_revisions/u);
  assert.deepEqual(client.calls[3].values, ['revision_1']);
  assert.equal(client.calls[4].text, 'COMMIT');
  await assert.rejects(() => capturedTransaction.getItemRevision('revision_1'), repositoryError('postgres_transaction_closed'));
});

test('read-only transaction emits the requested allowed isolation level', async () => {
  const client = fakeClient();
  const { repository } = repositoryFor(client);
  const value = await repository.withTransaction(async () => 42, {
    isolationLevel: 'repeatable_read',
    readOnly: true,
  });

  assert.equal(value, 42);
  assert.equal(client.calls[1].text, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(client.calls.at(-1).text, 'COMMIT');
  assert.equal(client.releaseCount, 1);
});

test('transaction options fail before opening a connection', async () => {
  const client = fakeClient();
  const { repository, connectCounter } = repositoryFor(client);

  await assert.rejects(() => repository.withTransaction(null), repositoryError('postgres_transaction_callback_required'));
  await assert.rejects(
    () => repository.withTransaction(async () => null, { isolationLevel: 'dirty_read' }),
    repositoryError('postgres_isolation_level_invalid'),
  );
  await assert.rejects(
    () => repository.withTransaction(async () => null, { readOnly: 'yes' }),
    repositoryError('postgres_read_only_invalid'),
  );
  assert.equal(connectCounter.count, 0);
  assert.equal(client.calls.length, 0);
});

test('missing authenticated actor rolls back and never invokes work', async () => {
  const client = fakeClient({ actorId: null });
  const { repository } = repositoryFor(client);
  let invoked = false;

  await assert.rejects(
    () => repository.withTransaction(async () => {
      invoked = true;
    }),
    repositoryError('authenticated_actor_required'),
  );

  assert.equal(invoked, false);
  assert.deepEqual(client.calls.map((call) => call.text), [
    'BEGIN',
    'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE',
    'SELECT i1q.current_actor_id() AS actor_id',
    'ROLLBACK',
  ]);
  assert.equal(client.releaseCount, 1);
});

test('work failure rolls back, releases, and closes a captured transaction', async () => {
  const client = fakeClient();
  const { repository } = repositoryFor(client);
  const workError = new Error('work_failed');
  let capturedTransaction;

  await assert.rejects(
    () => repository.withTransaction(async (transaction) => {
      capturedTransaction = transaction;
      throw workError;
    }),
    (error) => error === workError,
  );

  assert.equal(client.calls.at(-1).text, 'ROLLBACK');
  assert.equal(client.releaseCount, 1);
  await assert.rejects(() => capturedTransaction.getItemRevision('revision_1'), repositoryError('postgres_transaction_closed'));
});

test('BEGIN failure releases without issuing rollback', async () => {
  const beginError = new Error('begin_failed');
  const client = fakeClient({ failFor: (text) => (text === 'BEGIN' ? beginError : null) });
  const { repository } = repositoryFor(client);

  await assert.rejects(() => repository.withTransaction(async () => null), (error) => error === beginError);
  assert.deepEqual(client.calls.map((call) => call.text), ['BEGIN']);
  assert.equal(client.releaseCount, 1);
});

test('failure after BEGIN rolls back and releases', async () => {
  const setError = new Error('set_failed');
  const client = fakeClient({
    failFor: (text) => (text.startsWith('SET TRANSACTION') ? setError : null),
  });
  const { repository } = repositoryFor(client);

  await assert.rejects(() => repository.withTransaction(async () => null), (error) => error === setError);
  assert.deepEqual(client.calls.map((call) => call.text), [
    'BEGIN',
    'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE',
    'ROLLBACK',
  ]);
  assert.equal(client.releaseCount, 1);
});

test('COMMIT failure attempts rollback and releases', async () => {
  const commitError = new Error('commit_failed');
  const client = fakeClient({ failFor: (text) => (text === 'COMMIT' ? commitError : null) });
  const { repository } = repositoryFor(client);

  await assert.rejects(() => repository.withTransaction(async () => 'value'), (error) => error === commitError);
  assert.deepEqual(client.calls.slice(-2).map((call) => call.text), ['COMMIT', 'ROLLBACK']);
  assert.equal(client.releaseCount, 1);
});

test('rollback failure preserves both errors in an AggregateError and releases', async () => {
  const workError = new Error('work_failed');
  const rollbackError = new Error('rollback_failed');
  const client = fakeClient({ failFor: (text) => (text === 'ROLLBACK' ? rollbackError : null) });
  const { repository } = repositoryFor(client);

  await assert.rejects(
    () => repository.withTransaction(async () => {
      throw workError;
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.message, 'postgres_transaction_and_rollback_failed');
      assert.deepEqual(error.errors, [workError, rollbackError]);
      return true;
    },
  );
  assert.equal(client.releaseCount, 1);
});

test('invalid dedicated client is rejected and any available release hook is called', async () => {
  let releases = 0;
  const client = {
    release() {
      releases += 1;
    },
  };
  const { repository } = repositoryFor(client);

  await assert.rejects(
    () => repository.withTransaction(async () => null),
    repositoryError('postgres_dedicated_client_required'),
  );
  assert.equal(releases, 1);
});

test('answer and restricted-source reads use only purpose-scoped database functions', async () => {
  const answer = { item_revision_id: 'revision_1', answer: 'A' };
  const source = { id: 'restricted_1', private_storage_ref: 'restricted://opaque' };
  const client = fakeClient({
    rowFor(text) {
      if (text.startsWith('SELECT * FROM i1q.read_item_revision_answers')) return [answer];
      if (text.startsWith('SELECT * FROM i1q.read_restricted_source_reference')) return [source];
      return undefined;
    },
  });
  const { repository } = repositoryFor(client);

  const result = await repository.withTransaction(async (transaction) => ({
    answer: await transaction.readItemRevisionAnswers({ itemRevisionId: 'revision_1', purpose: 'medical_review' }),
    source: await transaction.readRestrictedSourceReference({ referenceId: 'restricted_1', purpose: 'privacy_review' }),
  }));

  assert.deepEqual(result, { answer, source });
  const dataCalls = client.calls.slice(3, -1);
  assert.equal(dataCalls.length, 2);
  assert.equal(dataCalls[0].text, 'SELECT * FROM i1q.read_item_revision_answers($1, $2)');
  assert.deepEqual(dataCalls[0].values, ['revision_1', 'medical_review']);
  assert.equal(dataCalls[1].text, 'SELECT * FROM i1q.read_restricted_source_reference($1, $2)');
  assert.deepEqual(dataCalls[1].values, ['restricted_1', 'privacy_review']);
});

test('null object inputs receive stable repository validation errors without SQL', async () => {
  const client = fakeClient();
  const { repository } = repositoryFor(client);

  await repository.withTransaction(async (transaction) => {
    const before = client.calls.length;
    await assert.rejects(
      () => transaction.readItemRevisionAnswers(null),
      repositoryError('repository_input_object_required'),
    );
    await assert.rejects(
      () => transaction.readRestrictedSourceReference(null),
      repositoryError('repository_input_object_required'),
    );
    await assert.rejects(
      () => transaction.readChannelArtifactPayload(null),
      repositoryError('repository_input_object_required'),
    );
    assert.equal(client.calls.length, before);
  });
});

test('assignment validation rejects unknown fields and invalid enums without SQL', async () => {
  const client = fakeClient();
  const { repository } = repositoryFor(client);

  await repository.withTransaction(async (transaction) => {
    const valid = {
      assignmentId: 'assignment_1',
      itemRevisionId: 'revision_1',
      reviewerId: 'reviewer_1',
      reviewType: 'editorial',
      priority: 'P1',
    };
    const before = client.calls.length;
    await assert.rejects(
      () => transaction.createReviewAssignment({ ...valid, actorId: ACTOR_ID }),
      repositoryError('repository_input_field_forbidden'),
    );
    await assert.rejects(
      () => transaction.createReviewAssignment({ ...valid, reviewType: 'peer' }),
      repositoryError('review_type_invalid'),
    );
    await assert.rejects(
      () => transaction.createReviewAssignment({ ...valid, priority: 'urgent' }),
      repositoryError('review_priority_invalid'),
    );
    assert.equal(client.calls.length, before);
  });
});

test('assignment listing normalizes null and unknown option failures before SQL', async () => {
  const client = fakeClient();
  const { repository } = repositoryFor(client);

  await repository.withTransaction(async (transaction) => {
    const before = client.calls.length;
    await assert.rejects(
      () => transaction.listMyReviewAssignments(null),
      repositoryError('repository_input_object_required'),
    );
    await assert.rejects(
      () => transaction.listMyReviewAssignments({ actorId: ACTOR_ID }),
      repositoryError('repository_input_field_forbidden'),
    );
    await assert.rejects(
      () => transaction.listMyReviewAssignments({ states: [] }),
      repositoryError('review_assignment_states_required'),
    );
    assert.equal(client.calls.length, before);
  });
});

test('review event serializes findings and rejects cyclic findings without SQL', async () => {
  const client = fakeClient();
  const { repository } = repositoryFor(client);

  await repository.withTransaction(async (transaction) => {
    await transaction.recordReviewEvent({
      reviewEventId: 'event_1',
      assignmentId: 'assignment_1',
      verdict: 'pass',
      findings: { rubric: 'complete' },
    });
    const eventCall = client.calls.at(-1);
    assert.equal(eventCall.text, 'SELECT * FROM i1q.record_review_event($1, $2, $3, $4::jsonb)');
    assert.deepEqual(eventCall.values, ['event_1', 'assignment_1', 'pass', '{"rubric":"complete"}']);

    const cyclic = {};
    cyclic.self = cyclic;
    const before = client.calls.length;
    await assert.rejects(
      () => transaction.recordReviewEvent({
        reviewEventId: 'event_2',
        assignmentId: 'assignment_1',
        verdict: 'pass',
        findings: cyclic,
      }),
      repositoryError('review_findings_not_serializable'),
    );
    assert.equal(client.calls.length, before);
  });
});

test('release assembly validates exact shapes and duplicate identities before SQL', async () => {
  const client = fakeClient();
  const { repository } = repositoryFor(client);
  const base = {
    releaseId: 'release_1',
    releaseLabel: 'internal_candidate',
    datasetVersion: 'dataset_1',
  };

  await repository.withTransaction(async (transaction) => {
    const before = client.calls.length;
    await assert.rejects(
      () => transaction.assembleRelease({ ...base, memberships: [] }),
      repositoryError('release_memberships_required'),
    );
    await assert.rejects(
      () => transaction.assembleRelease({
        ...base,
        memberships: [
          { itemRevisionId: 'revision_1', questionId: 'question_1' },
          { itemRevisionId: 'revision_1', questionId: 'question_2' },
        ],
      }),
      repositoryError('duplicate_item_revision_id'),
    );
    await assert.rejects(
      () => transaction.assembleRelease({
        ...base,
        memberships: [
          { itemRevisionId: 'revision_1', questionId: 'question_1' },
          { itemRevisionId: 'revision_2', questionId: 'question_1' },
        ],
      }),
      repositoryError('duplicate_question_id'),
    );
    assert.equal(client.calls.length, before);
  });
});

test('release validation rejects malformed hashes and empty checks before SQL', async () => {
  const client = fakeClient();
  const { repository } = repositoryFor(client);
  const valid = {
    validationId: 'validation_1',
    releaseId: 'release_1',
    evidenceHash: HASH_A,
    checkIds: ['manifest_hash', 'class_a_closed_world'],
  };

  await repository.withTransaction(async (transaction) => {
    const before = client.calls.length;
    await assert.rejects(
      () => transaction.recordExportValidation({ ...valid, evidenceHash: HASH_A.toUpperCase() }),
      repositoryError('validation_evidence_hash_invalid'),
    );
    await assert.rejects(
      () => transaction.recordExportValidation({ ...valid, checkIds: [] }),
      repositoryError('validation_check_ids_required'),
    );
    await assert.rejects(
      () => transaction.recordExportValidation({ ...valid, checkIds: [' valid '] }),
      repositoryError('validation_check_id_invalid'),
    );
    assert.equal(client.calls.length, before);
  });
});

test('promotion validates every evidence hash before SQL', async () => {
  const client = fakeClient();
  const { repository } = repositoryFor(client);
  const valid = {
    promotionId: 'promotion_1',
    releaseId: 'release_1',
    targetState: 'validated',
    authorityType: 'release_manager_validation',
    evidenceHashes: [HASH_A, HASH_B],
  };

  await repository.withTransaction(async (transaction) => {
    await transaction.promoteRelease(valid);
    const call = client.calls.at(-1);
    assert.equal(call.text, 'SELECT * FROM i1q.promote_release($1, $2, $3, $4, $5::jsonb, $6)');
    assert.deepEqual(call.values, [
      'promotion_1',
      'release_1',
      'validated',
      'release_manager_validation',
      JSON.stringify([HASH_A, HASH_B]),
      null,
    ]);

    const before = client.calls.length;
    await assert.rejects(
      () => transaction.promoteRelease({ ...valid, evidenceHashes: [HASH_A, 'invalid'] }),
      repositoryError('promotion_evidence_hash_invalid'),
    );
    assert.equal(client.calls.length, before);
  });
});

test('undefined required channel payload is rejected before SQL', async () => {
  const client = fakeClient();
  const { repository } = repositoryFor(client);
  const input = {
    artifactId: 'artifact_1',
    releaseId: 'release_1',
    policyId: 'policy_1',
    channel: 'stat',
    phase: 'pre_answer',
    dataClass: 'A',
    mediaType: 'application/json',
    payload: undefined,
  };

  await repository.withTransaction(async (transaction) => {
    const before = client.calls.length;
    await assert.rejects(
      () => transaction.createChannelArtifact(input),
      repositoryError('channel_payload_not_serializable'),
    );
    assert.equal(client.calls.length, before);
  });
});

test('malformed driver results roll back and release', async () => {
  const client = fakeClient({
    rowFor(text) {
      if (text.includes('FROM i1q.item_revisions')) return null;
      return undefined;
    },
  });
  const originalQuery = client.query.bind(client);
  client.query = async (text, values = []) => {
    if (text.includes('FROM i1q.item_revisions')) {
      client.calls.push({ text, values });
      return { rowCount: 0 };
    }
    return originalQuery(text, values);
  };
  const { repository } = repositoryFor(client);

  await assert.rejects(
    () => repository.withTransaction((transaction) => transaction.getItemRevision('revision_1')),
    repositoryError('postgres_driver_result_invalid'),
  );
  assert.equal(client.calls.at(-1).text, 'ROLLBACK');
  assert.equal(client.releaseCount, 1);
});
