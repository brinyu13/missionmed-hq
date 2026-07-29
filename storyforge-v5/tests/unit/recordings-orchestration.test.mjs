import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RecordingError,
  createRecordingsService,
  parseReconciliationAudioObject,
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
    async attachRecording() {
      return {
        story: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
        attachment: {
          assetId,
          recordingId,
          studentId,
          storyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          objectKey: `storyforge-audio/${studentId}/story/${assetId}`,
          contentType: 'audio/webm',
          segmentCount: 1,
          state: 'pending',
        },
        created: true,
      };
    },
    async auditRecordingDenial() {},
    async checkAudioReferences() {
      return [];
    },
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
    async cancelSession(identity, id) {
      return {
        state: 'cancelled',
        changed: true,
        objectKeys: [],
        prefix: `storyforge-rec/${identity.sub}/${id}/`,
      };
    },
    async retryCandidates() {
      return [];
    },
    async deleteAudio(identity, id) {
      return {
        state: 'retired',
        changed: true,
        objectKey: `storyforge-audio/${studentId}/story/${id}.webm`,
        storyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      };
    },
    async markAudioFailed() {
      return [];
    },
    async markAudioVerified() {
      return [];
    },
    async pendingAudioAssets() {
      return [];
    },
    async readAudioManifest() {
      return { segmentCount: 1 };
    },
    async recordObjectDeleteRetry() {},
    async recordReconciliationDeleted() {},
    async recordProviderFailover() {},
    async sweepCandidates() {
      return [];
    },
    async sweepSession() {
      return { changed: false, objectKeys: [] };
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
  environment = {},
  delay = async () => {},
  now = () => new Date('2026-07-29T12:00:00.000Z'),
} = {}) {
  const calls = {
    events: [],
    puts: [],
    gets: [],
    deletedObjects: [],
    deletedPrefixes: [],
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
    async deleteRecordingPrefix(input) {
      calls.deletedPrefixes.push(input);
      return { deleted: 0 };
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
        usage: {
          inputTokens: 18,
          outputTokens: 7,
          totalTokens: 25,
          transcript: 'never emit provider content',
        },
      };
    },
    releaseSession(id) {
      calls.releasedTranscriptionSessions.push(id);
    },
    ...transcriptionOverrides,
  };
  const assembly = {
    available: true,
    option: 'A',
    async assembleRecording(input) {
      calls.assembly.push(input);
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
    emitEvent(event) {
      calls.events.push(event);
    },
    environment,
    now,
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
  const completionEvent = calls.events.find((event) => (
    event.event === 'segment_transcribed'
  ));
  assert.equal(completionEvent.inputTokens, 18);
  assert.equal(completionEvent.outputTokens, 7);
  assert.equal(completionEvent.totalTokens, 25);
  assert.equal('transcript' in completionEvent, false);
});

test('post-claim storage failure becomes an audited retryable transcription failure', async () => {
  let failure;
  const store = storeFixture({
    async failTranscription(claim, code) {
      failure = { claim, code };
      return 1;
    },
  });
  const { service, calls } = serviceFixture({
    store,
    storageOverrides: {
      async getRecordingSegment() {
        throw new Error('private object-store detail');
      },
    },
  });
  await service.addSegment(student, recordingId, {
    seq: 0,
    mimeType: 'audio/webm',
    durationMs: 4_000,
    buffer: Buffer.from('abc'),
  });
  await service.waitForTranscriptionIdle(recordingId);
  assert.equal(failure.code, 'transcribe_unavailable');
  assert.equal(failure.claim.recordingId, recordingId);
  assert.equal(calls.transcriptions.length, 0);
  assert.equal(
    calls.events.some((event) => event.event === 'segment_transcribe_failed'),
    true,
  );
});

test('provider failover is durably audited before transcript completion', async () => {
  const order = [];
  let pending = true;
  const store = storeFixture({
    async recordProviderFailover(claim) {
      order.push(`failover:${claim.recordingId}:${claim.studentId}`);
    },
    async completeTranscription() {
      order.push('transcript-completed');
      return true;
    },
  });
  const { service } = serviceFixture({
    store,
    transcriptionOverrides: {
      hasPendingFailover(id) {
        return id === recordingId && pending;
      },
      acknowledgeFailover(id) {
        assert.equal(id, recordingId);
        pending = false;
        return true;
      },
    },
  });
  await service.addSegment(student, recordingId, {
    seq: 0,
    mimeType: 'audio/webm',
    durationMs: 4_000,
    buffer: Buffer.from('abc'),
  });
  await service.waitForTranscriptionIdle(recordingId);
  assert.deepEqual(order, [
    `failover:${recordingId}:${studentId}`,
    'transcript-completed',
  ]);
  assert.equal(pending, false);
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
    transcriptionAvailable: true,
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
    async markAssembled(id, ownerId) {
      assembled = { id, ownerId };
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
  });
  assert.deepEqual(calls.releasedTranscriptionSessions, [recordingId]);
});

test('E4 waits for the final queued transcript before assembly and adapter release', async () => {
  let resolveTranscription;
  let transcriptComplete = false;
  let finishCalls = 0;
  const store = storeFixture({
    async completeTranscription() {
      transcriptComplete = true;
      return true;
    },
    async readStatus() {
      return {
        session: session({ segmentCount: 1 }),
        segments: [segment({
          transcribeState: transcriptComplete ? 'transcribed' : 'transcribing',
        })],
      };
    },
    async finishSession() {
      finishCalls += 1;
      assert.equal(transcriptComplete, true);
      return { session: session({ state: 'finishing' }), transitioned: true };
    },
  });
  const { service, calls } = serviceFixture({
    store,
    transcriptionOverrides: {
      async transcribeSegment() {
        await new Promise((resolve) => {
          resolveTranscription = resolve;
        });
        return {
          text: 'Final words.',
          flaggedTerms: [],
          providerId: 'internal',
          modelId: 'internal',
          latencyMs: 1,
        };
      },
    },
  });
  await service.addSegment(student, recordingId, {
    seq: 0,
    mimeType: 'audio/webm',
    durationMs: 4_000,
    buffer: Buffer.from('abc'),
  });
  await new Promise((resolve) => setImmediate(resolve));
  const finishing = service.finishRecording(student, recordingId, {
    clientDurationMs: 4_000,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finishCalls, 0);
  assert.deepEqual(calls.releasedTranscriptionSessions, []);
  resolveTranscription();
  assert.deepEqual(await finishing, { state: 'finishing' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finishCalls, 1);
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
    async cancelSession(identity, id) {
      return {
        state: 'cancelled',
        changed: true,
        objectKeys: [
          `storyforge-rec/${studentId}/${id}/seg-00000.webm`,
          `storyforge-rec/${studentId}/${id}/seg-00001.webm`,
        ],
        prefix: `storyforge-rec/${studentId}/${id}/`,
      };
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
  assert.deepEqual(calls.deletedPrefixes, [{
    prefix: `storyforge-rec/${studentId}/${recordingId}/`,
  }]);
  assert.deepEqual(calls.releasedTranscriptionSessions, [recordingId]);
  const checksBeforeDelete = flagChecks;
  assert.deepEqual(await service.deleteAudio(student, assetId), { state: 'retired' });
  assert.equal(flagChecks, checksBeforeDelete);
  assert.equal(
    calls.deletedAssets[0].asset.objectKey,
    `storyforge-audio/${studentId}/story/${assetId}.webm`,
  );
});

test('E8 fails before object deletion while lifecycle transaction authority is unavailable', async () => {
  const { service, calls } = serviceFixture({
    store: storeFixture({
      async deleteAudio() {
        throw new RecordingError(
          'audio_retirement_authority_blocked',
          'Audio deletion is unavailable.',
          503,
        );
      },
    }),
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

test('transcription-off mode preserves received work without claims or retry consumption', async () => {
  let claims = 0;
  let pendingReads = 0;
  const store = storeFixture({
    async acceptSegment({ seq, objectKey, mimeType, byteSize, durationMs, persistObject }) {
      await persistObject();
      return {
        segment: segment({
          seq,
          objectKey,
          mimeType,
          byteSize,
          durationMs,
          transcribeState: 'received',
          retryCount: 0,
        }),
        created: true,
      };
    },
    async claimTranscription() {
      claims += 1;
      throw new Error('provider-off work must never be claimed');
    },
    async pendingTranscriptions() {
      pendingReads += 1;
      throw new Error('provider-off startup must not expire or queue claims');
    },
    async readStatus() {
      return {
        session: {
          id: recordingId,
          state: 'recording',
          totalDurationMs: 4_000,
          assembledAssetId: null,
        },
        segments: [segment({
          seq: 0,
          transcribeState: 'received',
          retryCount: 0,
        }), segment({
          seq: 1,
          transcribeState: 'transcribing',
          retryCount: 1,
        })],
      };
    },
    async retryCandidates() {
      return [segment({
        seq: 0,
        transcribeState: 'received',
        retryCount: 0,
      }), segment({
        seq: 1,
        transcribeState: 'transcribing',
        retryCount: 1,
      })];
    },
  });
  const { service, calls } = serviceFixture({
    store,
    transcriptionOverrides: {
      available: false,
      async transcribeSegment() {
        throw new Error('provider-off work must never reach a driver');
      },
    },
  });

  await service.addSegment(student, recordingId, {
    seq: 0,
    mimeType: 'audio/webm',
    durationMs: 4_000,
    buffer: Buffer.from('private-audio'),
  });
  await service.waitForTranscriptionIdle(recordingId);
  const status = await service.getRecording(student, recordingId);
  const retry = await service.retryTranscription(student, recordingId);
  const recovery = await service.recoverPendingTranscriptions();

  assert.equal(claims, 0);
  assert.equal(pendingReads, 0);
  assert.equal(calls.transcriptions.length, 0);
  assert.equal(status.transcriptionAvailable, false);
  assert.equal(status.segments[0].transcribeState, 'received');
  assert.equal(status.segments[0].transcript, '');
  assert.equal(status.segments[1].transcribeState, 'transcribing');
  assert.equal(retry.transcriptionAvailable, false);
  assert.equal(retry.segments[0].transcribeState, 'received');
  assert.equal(retry.segments[0].retryCount, 0);
  assert.equal(retry.segments[1].transcribeState, 'transcribing');
  assert.equal(retry.segments[1].retryCount, 1);
  assert.deepEqual(recovery, { queued: 0, blocked: true });
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
      return [
        { recordingId: first, studentId, reason: 'abandoned_24h' },
        { recordingId: second, studentId, reason: 'abandoned_24h' },
      ];
    },
    async sweepSession(candidate) {
      if (candidate.recordingId === first) {
        return {
          changed: true,
          objectKeys: [],
          prefix: `storyforge-rec/${studentId}/${first}/`,
        };
      }
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

test('10-minute maintenance retries pending durable audio even when session sweeping fails', async () => {
  let pendingScans = 0;
  const store = storeFixture({
    async sweepCandidates() {
      throw new Error('session sweep unavailable');
    },
    async pendingAudioAssets() {
      pendingScans += 1;
      return [];
    },
  });
  const { service } = serviceFixture({
    store,
    environment: { STORYFORGE_ASSEMBLY_OPTION: 'A' },
  });
  assert.deepEqual(await service.runMaintenance(), {
    sessions: { failed: true },
    pendingAudioAssets: {
      scanned: 0,
      verified: 0,
      failed: 0,
    },
    transcriptions: { queued: 0 },
    audioReconciliation: {
      mode: 'off',
      suspended: false,
      invalidConfig: false,
      due: false,
      aborted: false,
      abortReason: null,
      listed: 0,
      truncated: false,
      candidates: 0,
      referenced: 0,
      preserved: {
        outsidePrefix: 0,
        control: 0,
        invalidMetadata: 0,
        notOldEnough: 0,
        invalidIdentifier: 0,
        referenced: 0,
        deletionCap: 0,
        deleteFailed: 0,
      },
      deleted: 0,
      retried: 0,
      failed: 0,
      wouldDelete: [],
      markerWriteFailed: false,
    },
  });
  assert.equal(pendingScans, 1);
});

test('pending-audio recovery retries a fresh asset and terminally fails an hour-old asset', async () => {
  const retryAssetId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const failedAssetId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const stem = `storyforge-audio/${studentId}/story`;
  const verified = [];
  const failed = [];
  const store = storeFixture({
    async pendingAudioAssets() {
      return [
        {
          assetId: retryAssetId,
          recordingId,
          studentId,
          storyId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          objectKey: `${stem}/${retryAssetId}`,
          contentType: 'audio/webm',
          segmentCount: 1,
          pendingMinutes: 20,
        },
        {
          assetId: failedAssetId,
          recordingId: '99999999-9999-4999-8999-999999999999',
          studentId,
          storyId: '88888888-8888-4888-8888-888888888888',
          objectKey: `${stem}/${failedAssetId}`,
          contentType: 'audio/webm',
          segmentCount: 1,
          pendingMinutes: 60,
        },
      ];
    },
    async markAudioVerified(id, byteSize, checksumSha256) {
      verified.push({ id, byteSize, checksumSha256 });
      return [`storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`];
    },
    async markAudioFailed(id) {
      failed.push(id);
      return [
        `storyforge-rec/${studentId}/99999999-9999-4999-8999-999999999999/seg-00000.webm`,
      ];
    },
  });
  const assembledBytes = Buffer.from('restart-safe-audio');
  const { service, calls } = serviceFixture({
    store,
    storageOverrides: {
      async copyAudioObject() {},
      async headAudioObject() {
        return { contentType: 'audio/webm', byteSize: assembledBytes.byteLength };
      },
      async getRecordingSegment() {
        return assembledBytes;
      },
    },
    assemblyOverrides: { option: 'A' },
  });
  assert.deepEqual(await service.recoverPendingAudioAssets(), {
    scanned: 2,
    verified: 1,
    failed: 1,
  });
  assert.equal(verified.length, 1);
  assert.equal(verified[0].id, retryAssetId);
  assert.equal(failed[0], failedAssetId);
  assert.deepEqual(calls.deletedPrefixes.map((item) => item.prefix), [
    `storyforge-rec/${studentId}/${recordingId}/`,
    `storyforge-rec/${studentId}/99999999-9999-4999-8999-999999999999/`,
  ]);
});

test('E7 Option A copies, HEAD-verifies, checksums, finalizes, and purges temp audio', async () => {
  const copies = [];
  const heads = [];
  let finalized;
  const assembledBytes = Buffer.from('assembled-option-a');
  const store = storeFixture({
    async markAudioVerified(id, byteSize, checksumSha256) {
      finalized = { id, byteSize, checksumSha256 };
      return [
        `storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`,
        `storyforge-rec/${studentId}/${recordingId}/assembled.webm`,
      ];
    },
  });
  const { service, calls } = serviceFixture({
    store,
    storageOverrides: {
      async copyAudioObject(input) {
        copies.push(input);
      },
      async headAudioObject(input) {
        heads.push(input);
        return { contentType: 'audio/webm', byteSize: assembledBytes.byteLength };
      },
      async getRecordingSegment() {
        return assembledBytes;
      },
    },
    assemblyOverrides: { option: 'A' },
  });

  const saved = await service.saveRecordingStory(student, recordingId, {
    title: 'Reviewed voice story',
    text: 'Reviewed transcript',
  });
  const stem = `storyforge-audio/${studentId}/story/${assetId}`;
  assert.deepEqual(copies, [{
    sourceKey: `storyforge-rec/${studentId}/${recordingId}/assembled.webm`,
    targetKey: `${stem}.webm`,
    contentType: 'audio/webm',
  }]);
  assert.deepEqual(heads, [{ objectKey: `${stem}.webm` }]);
  assert.deepEqual(finalized, {
    id: assetId,
    byteSize: assembledBytes.byteLength,
    checksumSha256: '06787d290b820efe4267073b163877172be6dd5601bc2171432bff875320103a',
  });
  assert.equal(saved.attachment.state, 'verified');
  assert.equal(calls.deletedPrefixes.length, 1);
  assert.equal(
    calls.deletedPrefixes[0].prefix,
    `storyforge-rec/${studentId}/${recordingId}/`,
  );
});

test('E7 Option B copies ordered segments, aggregates verified bytes, and retains playback order', async () => {
  const copies = [];
  let finalized;
  const stem = `storyforge-audio/${studentId}/story/${assetId}`;
  const store = storeFixture({
    async attachRecording() {
      return {
        story: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
        attachment: {
          assetId,
          recordingId,
          studentId,
          storyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          objectKey: stem,
          contentType: 'audio/mp4',
          segmentCount: 2,
          state: 'pending',
        },
        created: true,
      };
    },
    async markAudioVerified(id, byteSize, checksumSha256) {
      finalized = { id, byteSize, checksumSha256 };
      return [];
    },
    async readAudioManifest() {
      return { segmentCount: 2 };
    },
  });
  const { service } = serviceFixture({
    store,
    storageOverrides: {
      async copyAudioObject(input) {
        copies.push(input);
      },
      async headAudioObject() {
        return { contentType: 'audio/mp4', byteSize: 11 };
      },
    },
    assemblyOverrides: { option: 'B' },
  });

  const saved = await service.saveRecordingStory(student, recordingId, {
    title: 'Reviewed voice story',
    text: 'Reviewed transcript',
  });
  assert.deepEqual(copies, [
    {
      sourceKey: `storyforge-rec/${studentId}/${recordingId}/seg-00000.m4a`,
      targetKey: `${stem}/seg-00000.m4a`,
      contentType: 'audio/mp4',
    },
    {
      sourceKey: `storyforge-rec/${studentId}/${recordingId}/seg-00001.m4a`,
      targetKey: `${stem}/seg-00001.m4a`,
      contentType: 'audio/mp4',
    },
  ]);
  assert.deepEqual(finalized, {
    id: assetId,
    byteSize: 22,
    checksumSha256: null,
  });
  assert.equal(saved.attachment.state, 'verified');
  assert.deepEqual(await service.playbackKeys({
    id: assetId,
    object_key: stem,
    content_type: 'audio/mp4',
  }), [
    `${stem}/seg-00000.m4a`,
    `${stem}/seg-00001.m4a`,
  ]);
});

test('legacy playback signs a stored full key verbatim without selecting an assembly option', async () => {
  const { service } = serviceFixture({
    assemblyOverrides: { option: undefined },
  });
  const objectKey = `storyforge-audio/${studentId}/legacy/${assetId}.mp4`;
  assert.deepEqual(await service.playbackKeys({
    id: assetId,
    object_key: objectKey,
    content_type: 'audio/mp4',
  }), [objectKey]);
});

const reconciliationStoryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const reconciliationNow = new Date('2026-07-29T12:00:00.000Z');

function reconciliationAssetId(index) {
  return `eeeeeeee-eeee-4eee-8eee-${index.toString(16).padStart(12, '0')}`;
}

function reconciliationObject(index, {
  lastModified = new Date('2026-07-22T11:59:59.999Z'),
  option = 'A',
  objectKey,
  byteSize = index + 1,
} = {}) {
  const id = reconciliationAssetId(index);
  return {
    objectKey: objectKey || (
      option === 'B'
        ? `storyforge-audio/${studentId}/${reconciliationStoryId}/${id}/seg-00000.webm`
        : `storyforge-audio/${studentId}/${reconciliationStoryId}/${id}.webm`
    ),
    byteSize,
    lastModified,
  };
}

function reconciliationStorage(objects, overrides = {}) {
  return {
    async readAudioControlObject() {
      return null;
    },
    async listAudioObjectsPage() {
      return {
        objects,
        continuationToken: null,
        truncated: false,
      };
    },
    async writeAudioControlObject() {},
    async deleteAudioObject() {},
    ...overrides,
  };
}

test('weekly reconciliation parses only the two ruled permanent object layouts', () => {
  const optionA = reconciliationObject(1);
  const optionB = reconciliationObject(2, { option: 'B' });
  assert.deepEqual(parseReconciliationAudioObject(optionA.objectKey), {
    objectKey: optionA.objectKey,
    entityId: reconciliationAssetId(1),
    studentId,
    storyId: reconciliationStoryId,
  });
  assert.deepEqual(parseReconciliationAudioObject(optionB.objectKey), {
    objectKey: optionB.objectKey,
    entityId: reconciliationAssetId(2),
    studentId,
    storyId: reconciliationStoryId,
  });
  for (const key of [
    `storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`,
    'storyforge-audio/_control/reconciliation.json',
    `storyforge-audio/${studentId}/${reconciliationStoryId}/junk.webm`,
    `storyforge-audio/${studentId}/not-a-story/${reconciliationAssetId(3)}.webm`,
    `storyforge-audio/${studentId}/${reconciliationStoryId}/${reconciliationAssetId(3)}/seg-1.webm`,
  ]) {
    assert.equal(parseReconciliationAudioObject(key), null);
  }
  assert.deepEqual(recordingConstants.audioReconciliation, {
    ageMs: 604_800_000,
    cadenceMs: 604_800_000,
    pageSize: 1000,
    referenceBatchSize: 1000,
    evaluationCap: 5000,
    deleteCap: 200,
    prefix: 'storyforge-audio/',
    controlPrefix: 'storyforge-audio/_control/',
    controlKey: 'storyforge-audio/_control/reconciliation.json',
    deleteRetries: 1,
  });
});

test('reconciliation gate order suspends before mode and treats every non-exact mode as off', async () => {
  let storageCalls = 0;
  const storageOverrides = {
    async readAudioControlObject() {
      storageCalls += 1;
      return null;
    },
  };
  const suspended = serviceFixture({
    environment: {
      STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED: ' ',
      STORYFORGE_AUDIO_RECONCILIATION: 'on',
    },
    storageOverrides,
  });
  assert.equal((await suspended.service.runWeeklyAudioReconciliation()).suspended, true);
  assert.equal(storageCalls, 0);
  assert.equal(
    suspended.calls.events.at(-1).event,
    'audio_reconciliation',
  );

  for (const value of ['ON', ' on ', 'unexpected']) {
    const fixture = serviceFixture({
      environment: { STORYFORGE_AUDIO_RECONCILIATION: value },
      storageOverrides,
    });
    const result = await fixture.service.runWeeklyAudioReconciliation();
    assert.equal(result.mode, 'off');
    assert.equal(result.invalidConfig, true);
  }
  assert.equal(storageCalls, 0);
});

test('reconciliation cadence skips a recent marker and corrupt or absent markers are due', async () => {
  let listCalls = 0;
  const recent = serviceFixture({
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'dry_run' },
    storageOverrides: reconciliationStorage([], {
      async readAudioControlObject() {
        return { completedAt: '2026-07-22T12:00:00.001Z' };
      },
      async listAudioObjectsPage() {
        listCalls += 1;
        assert.fail('a run younger than seven days must not list');
      },
    }),
  });
  assert.equal((await recent.service.runWeeklyAudioReconciliation()).due, false);
  assert.equal(listCalls, 0);

  for (const markerRead of [
    async () => null,
    async () => {
      throw new SyntaxError('corrupt marker');
    },
    async () => ({ completedAt: 'not-a-date' }),
    async () => ({ completedAt: '2026-07-22T12:00:00.000Z' }),
  ]) {
    let marker;
    const fixture = serviceFixture({
      environment: { STORYFORGE_AUDIO_RECONCILIATION: 'dry_run' },
      storageOverrides: reconciliationStorage([], {
        readAudioControlObject: markerRead,
        async writeAudioControlObject(input) {
          marker = input;
        },
      }),
    });
    const result = await fixture.service.runWeeklyAudioReconciliation();
    assert.equal(result.due, true);
    assert.equal(marker.objectKey, 'storyforge-audio/_control/reconciliation.json');
    assert.equal(marker.value.mode, 'dry_run');
  }
});

test('dry-run filters fail closed, checks references, and reports the exact would-delete set', async () => {
  const unreferenced = reconciliationObject(10);
  const referenced = reconciliationObject(11, { option: 'B' });
  const exactBoundary = reconciliationObject(12, {
    lastModified: new Date(reconciliationNow.getTime() - 604_800_000),
  });
  const objects = [
    unreferenced,
    referenced,
    exactBoundary,
    reconciliationObject(13, { lastModified: new Date('2026-07-28T12:00:00Z') }),
    reconciliationObject(14, { lastModified: null }),
    reconciliationObject(18, { byteSize: null }),
    reconciliationObject(15, {
      objectKey: `storyforge-audio/${studentId}/${reconciliationStoryId}/junk.webm`,
    }),
    reconciliationObject(16, {
      objectKey: 'storyforge-audio/_control/reconciliation.json',
    }),
    reconciliationObject(17, {
      objectKey: `storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`,
    }),
  ];
  let checkedKeys;
  const deleted = [];
  let marker;
  const store = storeFixture({
    async checkAudioReferences(keys) {
      checkedKeys = keys;
      return keys.map((objectKey) => ({
        objectKey,
        referenced: objectKey === referenced.objectKey,
      }));
    },
  });
  const { service } = serviceFixture({
    store,
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'dry_run' },
    storageOverrides: reconciliationStorage(objects, {
      async deleteAudioObject(input) {
        deleted.push(input);
      },
      async writeAudioControlObject(input) {
        marker = input.value;
      },
    }),
  });
  const result = await service.runWeeklyAudioReconciliation();
  assert.deepEqual(checkedKeys, [unreferenced.objectKey, referenced.objectKey]);
  assert.deepEqual(result.wouldDelete, [unreferenced.objectKey]);
  assert.equal(result.candidates, 2);
  assert.equal(result.referenced, 1);
  assert.equal(result.preserved.notOldEnough, 2);
  assert.equal(result.preserved.invalidMetadata, 2);
  assert.equal(result.preserved.invalidIdentifier, 1);
  assert.equal(result.preserved.control, 1);
  assert.equal(result.preserved.outsidePrefix, 1);
  assert.deepEqual(deleted, []);
  assert.deepEqual(marker.counts.preserved, result.preserved);
});

test('reconciliation listing enforces five 1000-key pages and reports truncation', async () => {
  const maxKeys = [];
  let pages = 0;
  let marker;
  const { service } = serviceFixture({
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'dry_run' },
    storageOverrides: reconciliationStorage([], {
      async listAudioObjectsPage(input) {
        pages += 1;
        maxKeys.push(input.maxKeys);
        return {
          objects: Array.from({ length: 1000 }, (_, index) => ({
            objectKey: `storyforge-audio/_control/page-${pages}-${index}`,
            byteSize: 1,
            lastModified: new Date('2026-07-01T00:00:00Z'),
          })),
          continuationToken: `page-${pages + 1}`,
          truncated: true,
        };
      },
      async writeAudioControlObject(input) {
        marker = input.value;
      },
    }),
  });
  const result = await service.runWeeklyAudioReconciliation();
  assert.equal(pages, 5);
  assert.deepEqual(maxKeys, [1000, 1000, 1000, 1000, 1000]);
  assert.equal(result.listed, 5000);
  assert.equal(result.truncated, true);
  assert.equal(result.preserved.control, 5000);
  assert.equal(marker.counts.truncated, true);
});

test('reference ambiguity aborts before every deletion and remains isolated in maintenance', async () => {
  const object = reconciliationObject(20);
  let deletes = 0;
  const store = storeFixture({
    async checkAudioReferences() {
      throw new Error('M3 function absent');
    },
  });
  const { service } = serviceFixture({
    store,
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'on' },
    storageOverrides: reconciliationStorage([object], {
      async deleteAudioObject() {
        deletes += 1;
      },
    }),
  });
  const result = await service.runMaintenance();
  assert.equal(result.audioReconciliation.aborted, true);
  assert.equal(result.audioReconciliation.abortReason, 'reference_check_failed');
  assert.equal(deletes, 0);
  assert.deepEqual(result.sessions, { scanned: 0, cleaned: 0, failures: [] });
  assert.deepEqual(result.pendingAudioAssets, {
    scanned: 0,
    verified: 0,
    failed: 0,
  });
  assert.deepEqual(result.transcriptions, { queued: 0 });
});

test('configured reconciliation probes M3 even when the fresh listing has no candidates', async () => {
  for (const mode of ['dry_run', 'on']) {
    let referenceCalls = 0;
    const store = storeFixture({
      async checkAudioReferences(keys) {
        referenceCalls += 1;
        assert.deepEqual(keys, []);
        throw new Error('M3 function absent');
      },
    });
    const { service } = serviceFixture({
      store,
      environment: { STORYFORGE_AUDIO_RECONCILIATION: mode },
      storageOverrides: reconciliationStorage([]),
    });
    const result = await service.runWeeklyAudioReconciliation();
    assert.equal(result.aborted, true);
    assert.equal(result.abortReason, 'reference_check_failed');
    assert.equal(result.deleted, 0);
    assert.equal(referenceCalls, 1);
  }
});

test('reference checks split 1001 candidates into complete same-run batches before dry-run selection', async () => {
  const objects = Array.from({ length: 1001 }, (_, index) => (
    reconciliationObject(1_000 + index)
  ));
  const batches = [];
  const store = storeFixture({
    async checkAudioReferences(keys) {
      batches.push([...keys]);
      return keys.map((objectKey) => ({ objectKey, referenced: false }));
    },
  });
  const { service } = serviceFixture({
    store,
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'dry_run' },
    storageOverrides: reconciliationStorage([], {
      async listAudioObjectsPage({ continuationToken }) {
        const secondPage = continuationToken === 'page-2';
        return {
          objects: secondPage ? objects.slice(1000) : objects.slice(0, 1000),
          continuationToken: secondPage ? null : 'page-2',
          truncated: !secondPage,
        };
      },
    }),
  });
  const result = await service.runWeeklyAudioReconciliation();
  assert.deepEqual(batches.map((batch) => batch.length), [1000, 1]);
  assert.equal(result.candidates, 1001);
  assert.equal(result.wouldDelete.length, 200);
  assert.equal(result.preserved.deletionCap, 801);
});

test('missing, duplicate, unexpected, and non-boolean reference evidence all fail closed', async () => {
  const object = reconciliationObject(50);
  const malformedResults = [
    [],
    [
      { objectKey: object.objectKey, referenced: false },
      { objectKey: object.objectKey, referenced: false },
    ],
    [{ objectKey: reconciliationObject(51).objectKey, referenced: false }],
    [{ objectKey: object.objectKey, referenced: null }],
  ];
  for (const references of malformedResults) {
    let deletes = 0;
    const store = storeFixture({
      async checkAudioReferences() {
        return references;
      },
    });
    const { service } = serviceFixture({
      store,
      environment: { STORYFORGE_AUDIO_RECONCILIATION: 'on' },
      storageOverrides: reconciliationStorage([object], {
        async deleteAudioObject() {
          deletes += 1;
        },
      }),
    });
    const result = await service.runWeeklyAudioReconciliation();
    assert.equal(result.aborted, true);
    assert.equal(result.abortReason, 'reference_check_failed');
    assert.equal(deletes, 0);
  }
});

test('marker-write failure is visible and leaves the next tick due', async () => {
  let listCalls = 0;
  const { service, calls } = serviceFixture({
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'dry_run' },
    storageOverrides: reconciliationStorage([], {
      async listAudioObjectsPage() {
        listCalls += 1;
        return {
          objects: [],
          continuationToken: null,
          truncated: false,
        };
      },
      async writeAudioControlObject() {
        throw new Error('marker unavailable');
      },
    }),
  });
  const first = await service.runWeeklyAudioReconciliation();
  const second = await service.runWeeklyAudioReconciliation();
  assert.equal(first.markerWriteFailed, true);
  assert.equal(second.markerWriteFailed, true);
  assert.equal(first.due, true);
  assert.equal(second.due, true);
  assert.equal(listCalls, 2);
  assert.equal(
    calls.events.filter((event) => event.event === 'audio_reconciliation').length,
    2,
  );
});

test('a retry-audit failure aborts visibly after a successful retry', async () => {
  const object = reconciliationObject(52);
  let deleteAttempts = 0;
  let deletionAudits = 0;
  const store = storeFixture({
    async checkAudioReferences(keys) {
      return keys.map((objectKey) => ({ objectKey, referenced: false }));
    },
    async recordObjectDeleteRetry() {
      throw new Error('retry audit unavailable');
    },
    async recordReconciliationDeleted() {
      deletionAudits += 1;
    },
  });
  const { service } = serviceFixture({
    store,
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'on' },
    storageOverrides: reconciliationStorage([object], {
      async deleteAudioObject() {
        deleteAttempts += 1;
        if (deleteAttempts === 1) throw new Error('initial delete failed');
      },
    }),
  });
  const result = await service.runWeeklyAudioReconciliation();
  assert.equal(deleteAttempts, 2);
  assert.equal(deletionAudits, 0);
  assert.equal(result.deleted, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.aborted, true);
  assert.equal(result.abortReason, 'delete_retry_audit_failed');
});

test('a successful reconciliation lane remains complete when another maintenance lane fails', async () => {
  const store = storeFixture({
    async sweepCandidates() {
      throw new Error('session sweep unavailable');
    },
  });
  const { service } = serviceFixture({
    store,
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'dry_run' },
    storageOverrides: reconciliationStorage([]),
  });
  const result = await service.runMaintenance();
  assert.deepEqual(result.sessions, { failed: true });
  assert.equal(result.audioReconciliation.mode, 'dry_run');
  assert.equal(result.audioReconciliation.due, true);
  assert.equal(result.audioReconciliation.aborted, false);
});

test('on mode retries each failed delete exactly once and writes only ruled audits', async () => {
  const retrySucceeds = reconciliationObject(30);
  const retryFails = reconciliationObject(31);
  const attempts = new Map();
  const retryAudits = [];
  const deletionAudits = [];
  const store = storeFixture({
    async checkAudioReferences(keys) {
      return keys.map((objectKey) => ({ objectKey, referenced: false }));
    },
    async recordObjectDeleteRetry(event) {
      retryAudits.push(event);
    },
    async recordReconciliationDeleted(event) {
      deletionAudits.push(event);
    },
  });
  const { service } = serviceFixture({
    store,
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'on' },
    storageOverrides: reconciliationStorage([retrySucceeds, retryFails], {
      async deleteAudioObject({ objectKey }) {
        const count = (attempts.get(objectKey) || 0) + 1;
        attempts.set(objectKey, count);
        if (objectKey === retryFails.objectKey || count === 1) {
          throw new Error('bounded delete failure');
        }
      },
    }),
  });
  const result = await service.runWeeklyAudioReconciliation();
  assert.equal(attempts.get(retrySucceeds.objectKey), 2);
  assert.equal(attempts.get(retryFails.objectKey), 2);
  assert.equal(result.retried, 2);
  assert.equal(result.deleted, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.preserved.deleteFailed, 1);
  assert.equal(retryAudits.length, 2);
  assert.deepEqual(deletionAudits, [{
    entityId: reconciliationAssetId(30),
    studentId,
    storyId: reconciliationStoryId,
    objectCount: 1,
    byteSize: 31,
  }]);
});

test('a reconciliation audit failure aborts every later deletion', async () => {
  const first = reconciliationObject(40);
  const second = reconciliationObject(41);
  const deletes = [];
  const store = storeFixture({
    async checkAudioReferences(keys) {
      return keys.map((objectKey) => ({ objectKey, referenced: false }));
    },
    async recordReconciliationDeleted() {
      throw new Error('audit unavailable');
    },
  });
  const { service } = serviceFixture({
    store,
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'on' },
    storageOverrides: reconciliationStorage([first, second], {
      async deleteAudioObject({ objectKey }) {
        deletes.push(objectKey);
      },
    }),
  });
  const result = await service.runWeeklyAudioReconciliation();
  assert.deepEqual(deletes, [first.objectKey]);
  assert.equal(result.deleted, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.aborted, true);
  assert.equal(result.abortReason, 'reconciliation_audit_failed');
});

test('the deletion cap is exact and a fresh-list rerun is idempotent', async () => {
  const objects = new Map(
    Array.from({ length: 201 }, (_, index) => {
      const object = reconciliationObject(100 + index);
      return [object.objectKey, object];
    }),
  );
  const audits = [];
  let deletes = 0;
  const store = storeFixture({
    async checkAudioReferences(keys) {
      return keys.map((objectKey) => ({ objectKey, referenced: false }));
    },
    async recordReconciliationDeleted(event) {
      audits.push(event);
    },
  });
  const { service } = serviceFixture({
    store,
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'on' },
    storageOverrides: reconciliationStorage([], {
      async listAudioObjectsPage() {
        return {
          objects: [...objects.values()],
          continuationToken: null,
          truncated: false,
        };
      },
      async deleteAudioObject({ objectKey }) {
        deletes += 1;
        objects.delete(objectKey);
      },
    }),
  });
  const first = await service.runWeeklyAudioReconciliation();
  assert.equal(first.deleted, 200);
  assert.equal(first.preserved.deletionCap, 1);
  assert.equal(deletes, 200);
  assert.equal(audits.length, 200);
  const second = await service.runWeeklyAudioReconciliation();
  assert.equal(second.deleted, 1);
  assert.equal(deletes, 201);
  assert.equal(audits.length, 201);
  const third = await service.runWeeklyAudioReconciliation();
  assert.equal(third.deleted, 0);
  assert.equal(audits.length, 201);
});
