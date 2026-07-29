import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RecordingError,
  createRecordingsService,
  recordingConstants,
} from '../../server/recordings.mjs';

const studentId = '11111111-1111-4111-8111-111111111111';
const recordingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const segmentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const assetId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const student = Object.freeze({
  sub: studentId,
  role: 'student',
  eligible: true,
  cohort: 'G7',
});

function session(overrides = {}) {
  return {
    id: recordingId,
    studentId,
    state: 'recording',
    totalDurationMs: 0,
    segmentCount: 0,
    assembledAssetId: null,
    createdAt: '2026-07-29T12:00:00.000Z',
    ...overrides,
  };
}

function segment(overrides = {}) {
  return {
    id: segmentId,
    recordingId,
    seq: 0,
    objectKey: `storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`,
    mimeType: 'audio/webm',
    byteSize: 3,
    durationMs: 4_000,
    transcribeState: 'received',
    transcript: '',
    flaggedTerms: [],
    retryCount: 0,
    ...overrides,
  };
}

function storeFixture(overrides = {}) {
  return {
    async auditRecordingDenial() {},
    async openSession() {
      return { session: session(), created: true };
    },
    async readOwnedSession() {
      return session();
    },
    async acceptSegment({ persistObject, compensateObject, ...input }) {
      try {
        await persistObject();
        return {
          segment: segment({
            seq: input.seq,
            objectKey: input.objectKey,
            mimeType: input.mimeType,
            byteSize: input.byteSize,
            durationMs: input.durationMs,
          }),
          created: true,
        };
      } catch (error) {
        await compensateObject();
        throw error;
      }
    },
    async claimTranscription(id, seq) {
      return {
        id: segmentId,
        recordingId: id,
        seq,
        objectKey: `storyforge-rec/${studentId}/${id}/seg-${String(seq).padStart(5, '0')}.webm`,
        mimeType: 'audio/webm',
        studentId,
        retryCount: 0,
        promptTail: '',
        draftTitle: 'A difficult overnight call',
      };
    },
    async completeTranscription() {
      return true;
    },
    async readDraftTitle() {
      return 'A difficult overnight call';
    },
    async failTranscription() {
      return 1;
    },
    async readStatus() {
      return { session: session(), segments: [] };
    },
    async finishSession() {
      return { session: session({ state: 'finishing' }), transitioned: true };
    },
    async markAssembled() {
      return true;
    },
    async markAssemblyFailed() {
      return true;
    },
    async cancelSession(identity, id, purgeObjects) {
      await purgeObjects({ segmentKeys: [], asset: null });
      return { state: 'cancelled', changed: true };
    },
    async retryCandidates() {
      return [];
    },
    async deleteAudio(identity, id, deleteAsset) {
      await deleteAsset({ id, object_key: `storyforge-audio/${studentId}/story/${id}.webm` });
      return { state: 'retired', changed: true };
    },
    async sweepCandidates() {
      return [];
    },
    async sweepSession() {
      return false;
    },
    async pendingTranscriptions() {
      return [];
    },
    async pendingAssemblies() {
      return [];
    },
    ...overrides,
  };
}

function serviceFixture({
  store = storeFixture(),
  flagAssert = async () => {},
  forceOff = () => false,
  storageOverrides = {},
  transcriptionOverrides = {},
  assemblyOverrides = {},
  audioRetirement = {
    available: true,
    async retireAudio({ identity, assetId: id, store, deleteAsset }) {
      return store.deleteAudio(identity, id, deleteAsset);
    },
  },
  environment = {},
  delay = async () => {},
} = {}) {
  const calls = {
    events: [],
    puts: [],
    gets: [],
    deletedObjects: [],
    deletedAssets: [],
    transcriptions: [],
    releasedTranscriptionSessions: [],
    assembly: [],
  };
  const storage = {
    async putRecordingSegment(input) {
      calls.puts.push(input);
    },
    async getRecordingSegment(input) {
      calls.gets.push(input);
      return Buffer.from('abc');
    },
    async deleteRecordingObjects(input) {
      calls.deletedObjects.push(input);
    },
    async deleteAudioAssetObject(input) {
      calls.deletedAssets.push(input);
    },
    ...storageOverrides,
  };
  const transcription = {
    async keywordsForDraft({ draftTitle }) {
      return draftTitle ? ['overnight'] : [];
    },
    async transcribeSegment(input) {
      calls.transcriptions.push(input);
      return {
        text: 'The final transcript',
        flaggedTerms: [{ from: 'whipple', to: 'Whipple', source: 'lexicon' }],
        providerId: 'internal-primary',
        modelId: 'internal-model',
        latencyMs: 375,
      };
    },
    releaseSession(id) {
      calls.releasedTranscriptionSessions.push(id);
    },
    ...transcriptionOverrides,
  };
  const assembly = {
    async assembleRecording(input) {
      calls.assembly.push(input);
      return { assetId };
    },
    ...assemblyOverrides,
  };
  const service = createRecordingsService({
    store,
    flagService: {
      assertVoiceEnabled: flagAssert,
      voiceForceOff: forceOff,
    },
    storage,
    transcription,
    assembly,
    audioRetirement,
    emitEvent(event) {
      calls.events.push(event);
    },
    environment,
    now: () => new Date('2026-07-29T12:00:00.000Z'),
    delay,
  });
  return { service, calls };
}

test('E1 opens an idempotent default-off-gated session with the binding caps', async () => {
  const flagCalls = [];
  const { service, calls } = serviceFixture({
    flagAssert: async (...args) => flagCalls.push(args),
  });
  const result = await service.createRecording(student);
  assert.equal(flagCalls.length, 1);
  assert.deepEqual(result, {
    recordingId,
    segmentPlanMs: [4_000, 15_000],
    caps: {
      maxDurationMs: 1_200_000,
      maxSegments: 200,
      maxSegmentBytes: 5_242_880,
      dailyMinutes: 60,
    },
    created: true,
  });
  assert.equal(calls.events[0].event, 'recording_started');
  assert.deepEqual(Object.keys(calls.events[0]).sort(), [
    'event',
    'recordingId',
    'studentId',
    't',
  ]);
});

test('E2 stores a deterministic private segment and completes queued transcription', async () => {
  let completed;
  const store = storeFixture({
    async completeTranscription(claim, result) {
      completed = { claim, result };
      return true;
    },
  });
  const { service, calls } = serviceFixture({ store });
  const accepted = await service.addSegment(student, recordingId, {
    seq: 0,
    mimeType: 'audio/webm;codecs=opus',
    durationMs: 4_000,
    buffer: Buffer.from('abc'),
  });
  assert.deepEqual(accepted, { seq: 0, state: 'received', created: true });
  assert.equal(calls.puts.length, 1);
  assert.deepEqual(calls.puts[0], {
    objectKey: `storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`,
    contentType: 'audio/webm',
    body: Buffer.from('abc'),
    byteSize: 3,
  });
  await service.waitForTranscriptionIdle(recordingId);
  assert.equal(completed.result.text, 'The final transcript');
  assert.deepEqual(completed.result.flaggedTerms, [
    { from: 'whipple', to: 'Whipple', source: 'lexicon' },
  ]);
  assert.deepEqual(calls.transcriptions[0].keywords, ['overnight']);
  assert.equal(calls.transcriptions[0].promptTail, '');
  assert.equal(calls.events.some((event) => (
    JSON.stringify(event).includes('The final transcript')
  )), false);
});

test('E2 duplicate sequence is retry-safe and does not rewrite or retranscribe', async () => {
  const store = storeFixture({
    async acceptSegment() {
      return { segment: segment({ transcribeState: 'transcribed' }), created: false };
    },
  });
  const { service, calls } = serviceFixture({ store });
  const accepted = await service.addSegment(student, recordingId, {
    seq: 0,
    mimeType: 'audio/webm',
    durationMs: 4_000,
    buffer: Buffer.from('abc'),
  });
  assert.deepEqual(accepted, { seq: 0, state: 'transcribed', created: false });
  assert.equal(calls.puts.length, 0);
  await service.waitForTranscriptionIdle(recordingId);
  assert.equal(calls.transcriptions.length, 0);
});

test('the environment kill prevents queued audio from reaching transcription', async () => {
  let claimed = false;
  const store = storeFixture({
    async claimTranscription() {
      claimed = true;
      return null;
    },
  });
  const { service, calls } = serviceFixture({
    store,
    forceOff: () => true,
  });
  await service.addSegment(student, recordingId, {
    seq: 0,
    mimeType: 'audio/webm',
    durationMs: 4_000,
    buffer: Buffer.from('abc'),
  });
  await service.waitForTranscriptionIdle(recordingId);
  assert.equal(claimed, false);
  assert.equal(calls.transcriptions.length, 0);
});

test('E2 rejects oversize bytes before storage or database mutation', async () => {
  let accepted = false;
  const store = storeFixture({
    async acceptSegment() {
      accepted = true;
    },
  });
  const { service, calls } = serviceFixture({ store });
  await assert.rejects(
    service.addSegment(student, recordingId, {
      seq: 0,
      mimeType: 'audio/webm',
      durationMs: 4_000,
      buffer: Buffer.alloc(recordingConstants.maxSegmentBytes + 1),
    }),
    (error) => (
      error instanceof RecordingError
      && error.code === 'segment_too_large'
      && error.status === 413
    ),
  );
  assert.equal(accepted, false);
  assert.equal(calls.puts.length, 0);
});

test('E2 rejects zero client duration before storage or transcription accounting', async () => {
  let accepted = false;
  const store = storeFixture({
    async acceptSegment() {
      accepted = true;
    },
  });
  const { service, calls } = serviceFixture({ store });
  await assert.rejects(
    service.addSegment(student, recordingId, {
      seq: 0,
      mimeType: 'audio/webm',
      durationMs: 0,
      buffer: Buffer.from('abc'),
    }),
    (error) => (
      error instanceof RecordingError
      && error.code === 'invalid_segment_duration'
    ),
  );
  assert.equal(accepted, false);
  assert.equal(calls.puts.length, 0);
  assert.equal(calls.transcriptions.length, 0);
});

test('E2 compensates an ambiguous object-store write even when the PUT rejects', async () => {
  const { service, calls } = serviceFixture({
    storageOverrides: {
      async putRecordingSegment() {
        throw new Error('connection ended after the object was accepted');
      },
    },
  });
  await assert.rejects(
    service.addSegment(student, recordingId, {
      seq: 0,
      mimeType: 'audio/webm',
      durationMs: 4_000,
      buffer: Buffer.from('abc'),
    }),
    /connection ended/,
  );
  assert.deepEqual(calls.deletedObjects, [{
    objectKeys: [
      `storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`,
    ],
  }]);
});

test('E3 returns ordered transcript state without provider or storage internals', async () => {
  const store = storeFixture({
    async readStatus() {
      return {
        session: session({ totalDurationMs: 19_000 }),
        segments: [
          segment({
            seq: 0,
            transcribeState: 'transcribed',
            transcript: 'First sentence.',
          }),
          segment({
            seq: 1,
            transcribeState: 'transcribed',
            transcript: 'Second sentence.',
            flaggedTerms: [{ term: 'whipple', suggestion: 'Whipple' }],
          }),
        ],
      };
    },
  });
  const { service } = serviceFixture({ store });
  const status = await service.getRecording(student, recordingId);
  assert.deepEqual(status, {
    state: 'recording',
    segments: [
      {
        seq: 0,
        transcribeState: 'transcribed',
        transcript: 'First sentence.',
        flaggedTerms: [],
      },
      {
        seq: 1,
        transcribeState: 'transcribed',
        transcript: 'Second sentence.',
        flaggedTerms: [{ term: 'whipple', suggestion: 'Whipple' }],
      },
    ],
    fullText: 'First sentence. Second sentence.',
    totalDurationMs: 19_000,
    assembled: false,
  });
  assert.equal('providerId' in status, false);
  assert.equal(JSON.stringify(status).includes('objectKey'), false);
});

test('E4 delegates assembly without selecting an assembly implementation', async () => {
  let assembled;
  const store = storeFixture({
    async markAssembled(id, ownerId, completedAssetId) {
      assembled = { id, ownerId, completedAssetId };
      return true;
    },
  });
  const { service, calls } = serviceFixture({ store });
  const result = await service.finishRecording(student, recordingId, {
    clientDurationMs: 4_000,
  });
  assert.deepEqual(result, { state: 'finishing' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.assembly, [{ recordingId, studentId }]);
  assert.deepEqual(assembled, {
    id: recordingId,
    ownerId: studentId,
    completedAssetId: assetId,
  });
  assert.deepEqual(calls.releasedTranscriptionSessions, [recordingId]);
});

test('E4 fails before session mutation when the RP-8 assembly lane is unavailable', async () => {
  let finished = false;
  const blocked = Object.assign(
    new Error('Recording assembly is unavailable until RP-8 is approved.'),
    { code: 'assembly_authority_blocked', status: 503 },
  );
  const { service } = serviceFixture({
    store: storeFixture({
      async finishSession() {
        finished = true;
        return { session: session({ state: 'finishing' }), transitioned: true };
      },
    }),
    assemblyOverrides: {
      available: false,
      async assembleRecording() {
        throw blocked;
      },
    },
  });
  await assert.rejects(
    service.finishRecording(student, recordingId, { clientDurationMs: 4_000 }),
    (error) => error === blocked,
  );
  assert.equal(finished, false);
});

test('E5 cancel purges transient objects and E8 deletion remains outside the voice flag', async () => {
  let flagChecks = 0;
  const store = storeFixture({
    async cancelSession(identity, id, purgeObjects) {
      await purgeObjects({
        segmentKeys: [
          `storyforge-rec/${studentId}/${id}/seg-00000.webm`,
          `storyforge-rec/${studentId}/${id}/seg-00001.webm`,
        ],
        asset: null,
      });
      return { state: 'cancelled', changed: true };
    },
  });
  const { service, calls } = serviceFixture({
    store,
    flagAssert: async () => {
      flagChecks += 1;
    },
  });
  assert.deepEqual(await service.cancelRecording(student, recordingId), {
    state: 'cancelled',
  });
  assert.deepEqual(calls.deletedObjects[0].objectKeys, [
    `storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`,
    `storyforge-rec/${studentId}/${recordingId}/seg-00001.webm`,
  ]);
  assert.deepEqual(calls.releasedTranscriptionSessions, [recordingId]);
  const checksBeforeDelete = flagChecks;
  assert.deepEqual(await service.deleteAudio(student, assetId), { state: 'retired' });
  assert.equal(flagChecks, checksBeforeDelete);
  assert.equal(calls.deletedAssets[0].asset.id, assetId);
});

test('E8 fails before object deletion while lifecycle transaction authority is unavailable', async () => {
  const { service, calls } = serviceFixture({
    audioRetirement: { available: false },
  });
  await assert.rejects(
    service.deleteAudio(student, assetId),
    (error) => (
      error instanceof RecordingError
      && error.code === 'audio_retirement_authority_blocked'
      && error.status === 503
    ),
  );
  assert.equal(calls.deletedAssets.length, 0);
});

test('foreign recording access is denied only after one content-free audit attempt', async () => {
  const denial = new RecordingError(
    'recording_access_denied',
    'Recording session is unavailable.',
    403,
  );
  const audited = [];
  const { service } = serviceFixture({
    store: storeFixture({
      async readStatus() {
        throw denial;
      },
      async auditRecordingDenial(identity, id, surface) {
        audited.push({ identity, id, surface });
      },
    }),
  });
  await assert.rejects(
    service.getRecording(student, recordingId),
    (error) => error === denial,
  );
  assert.deepEqual(audited, [{
    identity: student,
    id: recordingId,
    surface: 'quick',
  }]);
});

test('E6 schedules only retryable segments with the binding backoff', async () => {
  const delayed = [];
  const store = storeFixture({
    async retryCandidates() {
      return [
        segment({ seq: 0, transcribeState: 'transcribe_failed', retryCount: 1 }),
        segment({ seq: 1, transcribeState: 'transcribe_failed', retryCount: 3 }),
        segment({ seq: 2, transcribeState: 'transcribed', retryCount: 0 }),
      ];
    },
    async claimTranscription(id, seq) {
      if (seq !== 0) throw new Error('non-retryable segment was queued');
      return {
        id: segmentId,
        recordingId: id,
        seq,
        objectKey: `storyforge-rec/${studentId}/${id}/seg-00000.webm`,
        mimeType: 'audio/webm',
        studentId,
        retryCount: 1,
        promptTail: '',
        draftTitle: '',
      };
    },
  });
  const { service } = serviceFixture({
    store,
    delay: async (milliseconds) => delayed.push(milliseconds),
  });
  const result = await service.retryTranscription(student, recordingId);
  assert.equal(result.segments.length, 3);
  await service.waitForTranscriptionIdle(recordingId);
  assert.deepEqual(delayed, [2_000]);
});

test('per-session transcription orchestration never exceeds two concurrent calls', async () => {
  let active = 0;
  let maximum = 0;
  const releases = [];
  const store = storeFixture({
    async acceptSegment({ seq, objectKey, mimeType, byteSize, durationMs, persistObject }) {
      await persistObject();
      return {
        segment: segment({ seq, objectKey, mimeType, byteSize, durationMs }),
        created: true,
      };
    },
  });
  const { service } = serviceFixture({
    store,
    transcriptionOverrides: {
      async transcribeSegment() {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => releases.push(resolve));
        active -= 1;
        return {
          text: '',
          flaggedTerms: [],
          providerId: 'internal',
          modelId: 'internal',
          latencyMs: 1,
        };
      },
    },
  });
  await Promise.all([0, 1, 2].map((seq) => service.addSegment(student, recordingId, {
    seq,
    mimeType: 'audio/webm',
    durationMs: 4_000,
    buffer: Buffer.from([seq + 1]),
  })));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(maximum > 0 && maximum <= 2);
  releases.splice(0).forEach((resolve) => resolve());
  await new Promise((resolve) => setImmediate(resolve));
  releases.splice(0).forEach((resolve) => resolve());
  await new Promise((resolve) => setImmediate(resolve));
  releases.splice(0).forEach((resolve) => resolve());
  await service.waitForTranscriptionIdle(recordingId);
  assert.ok(maximum <= 2);
});

test('session sweeps isolate failures and never claim failed cleanup as success', async () => {
  const first = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const second = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const store = storeFixture({
    async sweepCandidates() {
      return [first, second];
    },
    async sweepSession(id) {
      if (id === first) return true;
      throw new Error('object store unavailable');
    },
  });
  const { service } = serviceFixture({ store });
  assert.deepEqual(await service.runSweeps(), {
    scanned: 2,
    cleaned: 1,
    failures: [second],
  });
});
