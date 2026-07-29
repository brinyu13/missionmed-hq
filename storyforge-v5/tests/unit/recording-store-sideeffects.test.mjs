import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresRecordingStore } from '../../server/recordings.mjs';

const studentId = '11111111-1111-4111-8111-111111111111';
const recordingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const assetId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const storyId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const identity = Object.freeze({
  sub: studentId,
  role: 'student',
  eligible: true,
  wpUserId: 1101,
});

function storeWithClient(client, {
  appendAudit = async () => {},
  appendServiceAudit = async () => {},
  withIdentity = async (caller, operation) => operation(client),
  withServiceTransaction = async (operation) => operation(client),
} = {}) {
  return createPostgresRecordingStore({
    withIdentity,
    withServiceTransaction,
    appendAudit,
    appendServiceAudit,
  });
}

test('cancel fails closed on service-audit failure before mutating recording rows', async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('FROM public.sf_recording_sessions') && sql.includes('FOR UPDATE')) {
        return {
          rows: [{
            id: recordingId,
            student_id: studentId,
            state: 'recording',
            assembled_asset_id: null,
          }],
        };
      }
      if (sql.includes('FROM public.sf_recording_segments')) {
        return { rows: [{ object_key: 'storyforge-rec/private-segment.webm' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const store = storeWithClient(client, {
    async appendServiceAudit() {
      const error = new Error('Service audit authority is unavailable.');
      error.code = 'audit_authority_unavailable';
      throw error;
    },
  });

  await assert.rejects(
    store.cancelSession(identity, recordingId),
    (error) => error.code === 'audit_authority_unavailable',
  );
  assert.equal(
    queries.some((sql) => sql.includes('DELETE FROM public.sf_recording_segments')),
    false,
  );
  assert.equal(
    queries.some((sql) => sql.includes('UPDATE public.sf_recording_sessions')),
    false,
  );
});

test('cancel commits its database mutation before returning the object-deletion plan', async () => {
  const order = [];
  let transactionOpen = false;
  const client = {
    async query(sql) {
      assert.equal(transactionOpen, true);
      if (sql.includes('FROM public.sf_recording_sessions') && sql.includes('FOR UPDATE')) {
        order.push('session-lock');
        return {
          rows: [{
            id: recordingId,
            student_id: studentId,
            state: 'recording',
            assembled_asset_id: null,
          }],
        };
      }
      if (sql.includes('DELETE FROM public.sf_recording_segments')) {
        order.push('segment-delete');
        return { rows: [] };
      }
      if (sql.includes('FROM public.sf_recording_segments')) {
        order.push('segment-read');
        return {
          rows: [{
            object_key: `storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`,
          }],
        };
      }
      if (sql.includes('UPDATE public.sf_recording_sessions')) {
        order.push('session-update');
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const store = storeWithClient(client, {
    appendAudit: async () => assert.fail('cancel must not use the authenticated writer'),
    async appendServiceAudit(innerClient, event) {
      assert.equal(innerClient, client);
      assert.equal(transactionOpen, true);
      order.push('service-audit');
      assert.deepEqual(event, {
        action: 'recording_cancelled',
        entityType: 'recording_session',
        entityId: recordingId,
        studentId,
        previousValue: { state: 'recording' },
        newValue: { state: 'cancelled' },
      });
    },
    async withServiceTransaction(operation) {
      order.push('begin');
      transactionOpen = true;
      try {
        const result = await operation(client);
        order.push('commit');
        return result;
      } finally {
        transactionOpen = false;
      }
    },
  });

  const result = await store.cancelSession(identity, recordingId);
  assert.equal(transactionOpen, false);
  assert.deepEqual(order, [
    'begin',
    'session-lock',
    'segment-read',
    'service-audit',
    'segment-delete',
    'session-update',
    'commit',
  ]);
  assert.deepEqual(result, {
    state: 'cancelled',
    changed: true,
    objectKeys: [
      `storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`,
    ],
    prefix: `storyforge-rec/${studentId}/${recordingId}/`,
  });
});

test('cancel returns the exact state conflict for an assembled recording', async () => {
  const store = storeWithClient({
    async query(sql) {
      if (sql.includes('FROM public.sf_recording_sessions') && sql.includes('FOR UPDATE')) {
        return {
          rows: [{
            id: recordingId,
            student_id: studentId,
            state: 'assembled',
            assembled_asset_id: null,
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  });
  await assert.rejects(
    store.cancelSession(identity, recordingId),
    (error) => (
      error.code === 'state_conflict'
      && error.status === 409
      && error.message === 'Recording session is not in a compatible state.'
    ),
  );
});

test('audio retirement commits before returning its prefix-deletion plan', async () => {
  const order = [];
  let transactionOpen = false;
  const client = {
    async query(sql, values) {
      assert.equal(transactionOpen, true);
      assert.match(sql, /public\.sf_retire_story_audio\(\$1\)/);
      assert.deepEqual(values, [assetId]);
      order.push('retire-function');
      return {
        rows: [{
          object_key: `storyforge-audio/${studentId}/${storyId}/${assetId}`,
          story_id: storyId,
          changed: true,
        }],
      };
    },
  };
  const store = storeWithClient(client, {
    appendAudit: async () => assert.fail('retirement audit is owned by the database function'),
    appendServiceAudit: async () => assert.fail('retirement must use the identity transaction'),
    async withIdentity(caller, operation) {
      assert.equal(caller, identity);
      order.push('begin');
      transactionOpen = true;
      try {
        const result = await operation(client);
        order.push('commit');
        return result;
      } finally {
        transactionOpen = false;
      }
    },
  });

  const result = await store.deleteAudio(identity, assetId);
  assert.equal(transactionOpen, false);
  assert.deepEqual(order, ['begin', 'retire-function', 'commit']);
  assert.deepEqual(result, {
    state: 'retired',
    changed: true,
    objectKey: `storyforge-audio/${studentId}/${storyId}/${assetId}`,
    storyId,
  });
});

test('approved sweep-candidate query maps only bounded lifecycle metadata', async () => {
  const store = storeWithClient({
    async query(sql, values) {
      assert.equal(sql, 'SELECT * FROM public.sf_voice_sweep_candidates($1)');
      assert.deepEqual(values, [50]);
      return {
        rows: [{
          session_id: recordingId,
          student_id: studentId,
          state: 'finishing',
          reason: 'save_never_completed_72h',
        }],
      };
    },
  });
  assert.deepEqual(await store.sweepCandidates(), [{
    recordingId,
    studentId,
    state: 'finishing',
    reason: 'save_never_completed_72h',
  }]);
});

test('approved sweep purge reports a zero-segment finishing transition as changed', async () => {
  const calls = [];
  const candidate = {
    recordingId,
    studentId,
    state: 'finishing',
    reason: 'save_never_completed_72h',
  };
  const store = storeWithClient({
    async query(sql, values) {
      if (sql.includes('SELECT state,') && sql.includes('AS segment_count')) {
        calls.push('before');
        assert.deepEqual(values, [recordingId]);
        return { rows: [{ state: 'finishing', segment_count: 0 }] };
      }
      if (sql === 'SELECT * FROM public.sf_voice_sweep_purge($1, $2)') {
        calls.push('purge');
        assert.deepEqual(values, [recordingId, candidate.reason]);
        return { rows: [] };
      }
      if (sql.includes('EXISTS (') && sql.includes('AS has_segments')) {
        calls.push('after');
        return { rows: [{ state: 'failed', has_segments: false }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  });
  assert.deepEqual(await store.sweepSession(candidate), {
    changed: true,
    objectKeys: [],
    prefix: `storyforge-rec/${studentId}/${recordingId}/`,
  });
  assert.deepEqual(calls, ['before', 'purge', 'after']);
});

test('sweep revalidation preserves a refreshed failed session that still has segments', async () => {
  const candidate = {
    recordingId,
    studentId,
    state: 'failed',
    reason: 'failed_24h',
  };
  const store = storeWithClient({
    async query(sql) {
      if (sql.includes('SELECT state,') && sql.includes('AS segment_count')) {
        return { rows: [{ state: 'failed', segment_count: 1 }] };
      }
      if (sql === 'SELECT * FROM public.sf_voice_sweep_purge($1, $2)') {
        return { rows: [] };
      }
      if (sql.includes('EXISTS (') && sql.includes('AS has_segments')) {
        return { rows: [{ state: 'failed', has_segments: true }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  });
  assert.deepEqual(await store.sweepSession(candidate), {
    changed: false,
    objectKeys: [],
    prefix: `storyforge-rec/${studentId}/${recordingId}/`,
  });
});

test('mixed MIME is rejected before persistence or compensation', async () => {
  let persisted = false;
  let compensated = false;
  let queryCount = 0;
  const store = storeWithClient({
    async query(sql) {
      queryCount += 1;
      if (sql.includes('FROM public.sf_recording_sessions') && sql.includes('FOR UPDATE')) {
        return {
          rows: [{
            id: recordingId,
            student_id: studentId,
            state: 'recording',
            mime_type: 'audio/webm',
            total_duration_ms: 4_000,
            segment_count: 1,
            assembled_asset_id: null,
          }],
        };
      }
      if (sql.includes('FROM public.sf_recording_segments') && sql.includes('seq = $2')) {
        return { rows: [] };
      }
      throw new Error(`Mixed MIME must fail before query: ${sql}`);
    },
  });

  await assert.rejects(
    store.acceptSegment({
      identity,
      recordingId,
      seq: 1,
      objectKey: 'storyforge-rec/mixed-mime.m4a',
      mimeType: 'audio/mp4',
      byteSize: 3,
      durationMs: 4_000,
      dailyLimitMs: 60 * 60_000,
      async persistObject() {
        persisted = true;
      },
      async compensateObject() {
        compensated = true;
      },
    }),
    (error) => error.code === 'unsupported_audio_format' && error.status === 400,
  );
  assert.equal(queryCount, 2);
  assert.equal(persisted, false);
  assert.equal(compensated, false);
});

test('failed segment persistence compensates while the identity transaction lock is held', async () => {
  let transactionOpen = false;
  let compensatedWhileLocked = false;
  const client = {
    async query(sql) {
      if (sql.includes('FROM public.sf_recording_sessions') && sql.includes('FOR UPDATE')) {
        return {
          rows: [{
            id: recordingId,
            student_id: studentId,
            state: 'recording',
            mime_type: null,
            total_duration_ms: 0,
            segment_count: 0,
            assembled_asset_id: null,
          }],
        };
      }
      if (sql.includes('FROM public.sf_recording_segments') && sql.includes('seq = $2')) {
        return { rows: [] };
      }
      if (sql.includes('coalesce(sum(byte_size)')) return { rows: [{ byte_size: 0 }] };
      if (sql.includes('coalesce(sum(greatest')) return { rows: [{ duration_ms: 0 }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const store = storeWithClient(client, {
    async withIdentity(caller, operation) {
      transactionOpen = true;
      try {
        return await operation(client);
      } finally {
        transactionOpen = false;
      }
    },
  });
  await assert.rejects(
    store.acceptSegment({
      identity,
      recordingId,
      seq: 0,
      objectKey: 'storyforge-rec/segment.webm',
      mimeType: 'audio/webm',
      byteSize: 3,
      durationMs: 4_000,
      dailyLimitMs: 60 * 60_000,
      async persistObject() {
        throw new Error('ambiguous object-store failure');
      },
      async compensateObject() {
        compensatedWhileLocked = transactionOpen;
      },
    }),
    /ambiguous object-store failure/,
  );
  assert.equal(compensatedWhileLocked, true);
});

test('startup recovery uses the service writer after expiring stale transcription claims', async () => {
  const authenticatedAudits = [];
  const serviceAudits = [];
  const client = {
    async query(sql) {
      if (sql.startsWith('UPDATE public.sf_recording_segments segment')) {
        assert.match(sql, /segment\.updated_at < now\(\) - interval '5 minutes'/);
        return {
          rows: [{
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            session_id: recordingId,
            seq: 2,
            retry_count: 1,
            student_id: studentId,
          }],
        };
      }
      if (sql.includes('FROM public.sf_recording_segments segment')) {
        return {
          rows: [{
            session_id: recordingId,
            seq: 2,
            retry_count: 1,
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const store = storeWithClient(client, {
    async appendAudit(innerClient, event) {
      authenticatedAudits.push(event);
    },
    async appendServiceAudit(innerClient, event) {
      serviceAudits.push(event);
    },
  });
  assert.deepEqual(await store.pendingTranscriptions(), [{
    recordingId,
    seq: 2,
    retryCount: 1,
  }]);
  assert.deepEqual(authenticatedAudits, []);
  assert.equal(serviceAudits.length, 1);
  assert.equal(serviceAudits[0].action, 'segment_transcribe_failed');
  assert.equal(serviceAudits[0].newValue.code, 'transcribe_interrupted');
  assert.equal(JSON.stringify(serviceAudits[0]).includes('transcript'), false);
});

test('assembly completion uses only the service audit writer', async () => {
  const serviceAudits = [];
  const client = {
    async query(sql, values) {
      assert.match(sql, /SET state = 'assembled'/);
      assert.deepEqual(values, [recordingId, studentId]);
      return { rows: [{ id: recordingId }] };
    },
  };
  const store = storeWithClient(client, {
    appendAudit: async () => assert.fail('assembly must not use authenticated audit'),
    async appendServiceAudit(innerClient, event) {
      serviceAudits.push(event);
    },
  });
  assert.equal(await store.markAssembled(recordingId, studentId), true);
  assert.deepEqual(serviceAudits, [{
    action: 'assembly_completed',
    entityType: 'recording_session',
    entityId: recordingId,
    studentId,
    previousValue: { state: 'finishing' },
    newValue: { state: 'assembled' },
  }]);
});

test('provider failover is written through the content-free service audit boundary', async () => {
  const serviceAudits = [];
  const store = storeWithClient({}, {
    appendAudit: async () => assert.fail('provider failover must not use authenticated audit'),
    async appendServiceAudit(innerClient, event) {
      serviceAudits.push(event);
    },
  });
  await store.recordProviderFailover({ recordingId, studentId });
  assert.deepEqual(serviceAudits, [{
    action: 'provider_failover',
    entityType: 'recording_session',
    entityId: recordingId,
    studentId,
    previousValue: null,
    newValue: null,
  }]);
});

test('reconciliation deletion uses only the bounded service audit vocabulary', async () => {
  const serviceAudits = [];
  const store = storeWithClient({}, {
    appendAudit: async () => assert.fail('reconciliation must not use authenticated audit'),
    async appendServiceAudit(innerClient, event) {
      serviceAudits.push(event);
    },
  });
  await store.recordReconciliationDeleted({
    entityId: assetId,
    studentId,
    storyId,
    objectCount: 1,
    byteSize: 4096,
  });
  assert.deepEqual(serviceAudits, [{
    action: 'reconciliation_deleted',
    entityType: 'audio_asset',
    entityId: assetId,
    studentId,
    storyId,
    previousValue: null,
    newValue: {
      objectCount: 1,
      byteSize: 4096,
    },
  }]);
  assert.deepEqual(Object.keys(serviceAudits[0].newValue).sort(), [
    'byteSize',
    'objectCount',
  ]);
});

test('a second worker cannot reclaim an in-flight transcription segment', async () => {
  let updates = 0;
  const client = {
    async query(sql) {
      if (sql.includes('FOR UPDATE OF segment')) {
        return {
          rows: [{
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            session_id: recordingId,
            seq: 2,
            object_key: 'storyforge-rec/private.webm',
            mime_type: 'audio/webm',
            retry_count: 0,
            transcribe_state: 'transcribing',
            student_id: studentId,
            state: 'recording',
          }],
        };
      }
      updates += 1;
      return { rows: [] };
    },
  };
  const store = storeWithClient(client);
  assert.equal(await store.claimTranscription(recordingId, 2), null);
  assert.equal(updates, 0);
});
