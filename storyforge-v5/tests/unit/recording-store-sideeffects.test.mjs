import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresRecordingStore } from '../../server/recordings.mjs';

const studentId = '11111111-1111-4111-8111-111111111111';
const recordingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const assetId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const identity = Object.freeze({
  sub: studentId,
  role: 'student',
  eligible: true,
  wpUserId: 1101,
});

function storeWithClient(client) {
  return createPostgresRecordingStore({
    withIdentity: async (caller, operation) => operation(client),
    withServiceTransaction: async (operation) => operation(client),
    async appendAudit() {
      const error = new Error('Audit authority is unavailable.');
      error.code = 'audit_authority_unavailable';
      throw error;
    },
  });
}

test('cancel proves audit authority before deleting any recording object', async () => {
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
  const store = storeWithClient(client);
  let purgeCalled = false;
  await assert.rejects(
    store.cancelSession(identity, recordingId, async () => {
      purgeCalled = true;
    }),
    (error) => error.code === 'audit_authority_unavailable',
  );
  assert.equal(purgeCalled, false);
  assert.equal(
    queries.some((sql) => sql.includes('DELETE FROM public.sf_recording_segments')),
    false,
  );
});

test('audio deletion proves audit authority before deleting the private object', async () => {
  const client = {
    async query(sql) {
      if (sql.includes('FROM public.sf_audio_assets asset')) {
        return {
          rows: [{
            id: assetId,
            story_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            student_id: studentId,
            object_key: 'storyforge-audio/private.m4a',
            content_type: 'audio/mp4',
            byte_size: 100,
            duration_ms: 1_000,
            state: 'verified',
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const store = storeWithClient(client);
  let deleteCalled = false;
  await assert.rejects(
    store.deleteAudio(identity, assetId, async () => {
      deleteCalled = true;
    }),
    (error) => error.code === 'audit_authority_unavailable',
  );
  assert.equal(deleteCalled, false);
});

test('background sweeps fail closed until a bounded draft and audio lifecycle query is approved', async () => {
  const store = storeWithClient({
    async query() {
      assert.fail('blocked sweeps must not query private data');
    },
  });
  await assert.rejects(
    store.sweepCandidates(),
    (error) => error.code === 'recording_lifecycle_authority_blocked'
      && error.status === 503,
  );
});

test('locked sweep cleanup is also unavailable rather than impersonating a student', async () => {
  const store = storeWithClient({
    async query() {
      assert.fail('blocked sweep must not mutate recording data');
    },
  });
  await assert.rejects(
    store.sweepSession(recordingId, async () => assert.fail('must not purge')),
    (error) => error.code === 'recording_lifecycle_authority_blocked',
  );
});

test('failed segment acceptance compensates while the session transaction lock is held', async () => {
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
  const store = createPostgresRecordingStore({
    withIdentity: async (caller, operation) => {
      transactionOpen = true;
      try {
        return await operation(client);
      } finally {
        transactionOpen = false;
      }
    },
    withServiceTransaction: async (operation) => operation(client),
    async appendAudit() {},
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

test('startup recovery expires stale transcription claims before requeueing them', async () => {
  const audits = [];
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
  const store = createPostgresRecordingStore({
    withIdentity: async (caller, operation) => operation(client),
    withServiceTransaction: async (operation) => operation(client),
    async appendAudit(innerClient, event) {
      audits.push(event);
    },
  });
  assert.deepEqual(await store.pendingTranscriptions(), [{
    recordingId,
    seq: 2,
    retryCount: 1,
  }]);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'segment_transcribe_failed');
  assert.equal(audits[0].newValue.code, 'transcribe_interrupted');
  assert.equal(JSON.stringify(audits[0]).includes('transcript'), false);
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
  const store = createPostgresRecordingStore({
    withIdentity: async (caller, operation) => operation(client),
    withServiceTransaction: async (operation) => operation(client),
    async appendAudit() {},
  });
  assert.equal(await store.claimTranscription(recordingId, 2), null);
  assert.equal(updates, 0);
});
