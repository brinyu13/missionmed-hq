import assert from 'node:assert/strict';
import test from 'node:test';

import { createGuestVoiceService, GuestVoiceError } from '../../server/guest-voice.mjs';

const token = 'a'.repeat(43);
const studentId = '11111111-1111-4111-8111-111111111111';
const invitationId = '22222222-2222-4222-8222-222222222222';
const recordingId = '33333333-3333-4333-8333-333333333333';
const promptId = '44444444-4444-4444-8444-444444444444';
const contributionId = '55555555-5555-4555-8555-555555555555';
const assetId = '66666666-6666-4666-8666-666666666666';
const gatewayPseudonym = 'a'.repeat(64);

function fixture({
  environment = {},
  queries = [],
  completeThrowsAfterCommit = false,
  deletePrefixFailures = 0,
} = {}) {
  const objects = new Map();
  const copied = [];
  const deleted = [];
  const events = [];
  let transcribed = false;
  let completed = false;
  let cleanupState = null;
  let prefixFailures = deletePrefixFailures;
  const permanentKey = `storyforge-contribution-audio/${studentId}/${invitationId}/${contributionId}/${assetId}.webm`;
  const query = async (sql, values = []) => {
    queries.push({ sql, values });
    if (sql.includes('sf_guest_rate_hit')) return { rows: [{ attempts: 1 }] };
    if (sql.includes('sf_guest_voice_open')) return { rows: [{ payload: {
      recordingId, invitationId, studentId, state: 'recording',
    } }] };
    if (sql.includes('sf_guest_voice_status')) return { rows: [{ payload: {
      recordingId, invitationId, studentId, state: 'recording',
      segments: transcribed ? [{ seq: 0, transcribeState: 'transcribed', transcript: 'Guest memory.' }] : [],
    } }] };
    if (sql.includes('sf_guest_voice_reserve_segment')) return { rows: [{ payload: {} }] };
    if (sql.includes('sf_guest_voice_confirm_segment')) return { rows: [{ payload: {
      recordingId, seq: 0, state: 'received',
    } }] };
    if (sql.includes('sf_guest_voice_claim_transcription')) return { rows: [{ payload: {
      recordingId, studentId, seq: 0, objectKey: values[0] && [...objects.keys()][0],
      mimeType: 'audio/webm', promptTail: '',
    } }] };
    if (sql.includes('sf_guest_voice_complete_transcription')) {
      transcribed = true;
      return { rows: [{ sf_guest_voice_complete_transcription: true }] };
    }
    if (sql.includes('sf_guest_voice_fail_transcription')) return { rows: [{ value: true }] };
    if (sql.includes('sf_guest_voice_prepare_finish')) return { rows: [{ payload: completed ? {
      recordingId, invitationId, studentId, mimeType: 'audio/webm', durationMs: 4000,
      byteSize: 6, segmentCount: 1, providerTranscript: 'Guest memory.', promptId,
      promptTextSnapshot: 'Tell me about a memory.', contributionId, assetId,
      objectKey: permanentKey, transcript: 'Guest reviewed memory.', kind: 'voice',
      state: 'new', existing: true,
    } : {
      recordingId, invitationId, studentId, mimeType: 'audio/webm', durationMs: 4000,
      byteSize: 6, segmentCount: 1, providerTranscript: 'Guest memory.', promptId,
      promptTextSnapshot: 'Tell me about a memory.', contributionId, assetId,
      objectKey: permanentKey, existing: false,
    } }] };
    if (sql.includes('sf_guest_voice_complete(')) {
      completed = true;
      cleanupState = 'intended';
      if (completeThrowsAfterCommit) throw new Error('database acknowledgement lost');
      return { rows: [{ payload: {
        contributionId: values[2], assetId: values[3], kind: 'voice', state: 'new', existing: false,
      } }] };
    }
    if (sql.includes('sf_guest_voice_cancel')) return { rows: [{ payload: {
      recordingId, studentId, state: 'cancelled',
    } }] };
    if (sql.includes('sf_claim_guest_voice_cleanup')) {
      if (!cleanupState) cleanupState = 'intended';
      if (cleanupState !== 'intended') return { rows: [] };
      cleanupState = 'claimed';
      return { rows: [{
        intent_id: '77777777-7777-4777-8777-777777777777',
        session_id: recordingId,
        cleanup_kind: 'transient_prefix',
        object_locator: `storyforge-rec/${studentId}/${recordingId}/`,
      }] };
    }
    if (sql.includes('sf_complete_guest_voice_cleanup')) {
      cleanupState = sql.includes('true') ? 'resolved' : 'intended';
      return { rows: [{ value: true }] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const service = createGuestVoiceService({
    environment: {
      STORYFORGE_REQUEST_A_STORY_FORCE_OFF: '0',
      STORYFORGE_GUEST_FORCE_OFF: '0',
      STORYFORGE_GUEST_CONTRIBUTIONS_FORCE_OFF: '0',
      STORYFORGE_VOICE_FORCE_OFF: '0',
      ...environment,
    },
    withServiceTransaction: async (operation) => operation({ query }),
    storage: {
      async putRecordingSegment({ objectKey, body }) { objects.set(objectKey, Buffer.from(body)); },
      async getRecordingSegment({ objectKey }) { return objects.get(objectKey) || Buffer.from('audio!'); },
      async deleteRecordingObjects({ objectKeys }) { objectKeys.forEach((key) => objects.delete(key)); },
      async copyAudioObject(input) { copied.push(input); },
      async headAudioObject({ objectKey }) { return { objectKey, contentType: 'audio/webm', byteSize: 6 }; },
      async deleteAudioObject({ objectKey }) { deleted.push(objectKey); },
      async deleteRecordingPrefix({ prefix }) {
        if (prefixFailures > 0) {
          prefixFailures -= 1;
          throw new Error('private storage unavailable');
        }
        deleted.push(prefix);
      },
    },
    transcription: {
      available: true,
      async transcribeSegment(input) {
        assert.equal(input.studentId, studentId);
        assert.equal(input.buffer.toString(), 'audio!');
        return { text: 'Guest memory.', providerId: 'bounded-provider', modelId: 'bounded-model' };
      },
    },
    assembly: {
      available: true,
      option: 'A',
      async assembleRecording(input) {
        assert.deepEqual(input, { recordingId, studentId });
        return {
          option: 'A', artifactReady: true,
          artifactKey: `storyforge-rec/${studentId}/${recordingId}/assembled.webm`,
          mimeType: 'audio/webm', byteSize: 6,
          checksumSha256: 'b'.repeat(64),
        };
      },
    },
    emitEvent: (event) => events.push(event),
  });
  return { service, queries, objects, copied, deleted, events };
}

test('guest voice is default-off before any token or private-storage access', async () => {
  const subject = fixture({ environment: { STORYFORGE_VOICE_FORCE_OFF: '1' } });
  await assert.rejects(
    subject.service.open(token),
    (error) => error instanceof GuestVoiceError
      && error.code === 'invitation_not_found'
      && error.status === 404,
  );
  assert.equal(subject.queries.length, 0);
  assert.equal(subject.objects.size, 0);
});

test('token-scoped segment capture uses bounded private storage and transcription', async () => {
  const subject = fixture();
  const opened = await subject.service.open(token, { ip: gatewayPseudonym });
  assert.equal(opened.recordingId, recordingId);
  assert.equal(opened.caps.maxDurationMs, 1_800_000);
  assert.equal(opened.caps.maxAssetBytes, 31_457_280);
  const added = await subject.service.addSegment(token, recordingId, {
    seq: 0,
    mimeType: 'audio/webm',
    durationMs: 4000,
    buffer: Buffer.from('audio!'),
  }, { ip: gatewayPseudonym });
  assert.equal(added.state, 'received');
  const objectKey = `storyforge-rec/${studentId}/${recordingId}/seg-00000.webm`;
  assert.equal(subject.objects.get(objectKey).toString(), 'audio!');
  await subject.service.finish(token, recordingId, { promptId }, { ip: gatewayPseudonym });
  assert.ok(subject.queries.every(({ values }) => !values.includes(token)));
  assert.ok(subject.queries.some(({ sql }) => sql.includes('sf_guest_voice_complete_transcription')));
});

test('finish preserves verified original audio under the contribution namespace without creating a story', async () => {
  const subject = fixture();
  await subject.service.addSegment(token, recordingId, {
    seq: 0, mimeType: 'audio/webm', durationMs: 4000, buffer: Buffer.from('audio!'),
  }, { ip: gatewayPseudonym });
  const result = await subject.service.finish(token, recordingId, {
    promptId,
    transcript: 'Guest reviewed memory.',
  }, { ip: gatewayPseudonym });
  assert.equal(result.kind, 'voice');
  assert.equal(result.transcript, 'Guest reviewed memory.');
  assert.equal(subject.copied.length, 1);
  assert.match(subject.copied[0].targetKey, new RegExp(
    `^storyforge-contribution-audio/${studentId}/${invitationId}/[a-f0-9-]{36}/[a-f0-9-]{36}\\.webm$`,
  ));
  assert.ok(subject.queries.every(({ sql }) => !sql.includes('sf_create_story')));
  assert.ok(subject.deleted.includes(`storyforge-rec/${studentId}/${recordingId}/`));
});

test('lost database acknowledgement never deletes committed permanent audio and retry returns one result', async () => {
  const subject = fixture({ completeThrowsAfterCommit: true });
  await assert.rejects(
    subject.service.finish(token, recordingId, { promptId, transcript: 'Guest reviewed memory.' }, { ip: gatewayPseudonym }),
    /database acknowledgement lost/,
  );
  assert.equal(subject.deleted.includes(
    `storyforge-contribution-audio/${studentId}/${invitationId}/${contributionId}/${assetId}.webm`,
  ), false);
  const retried = await subject.service.finish(token, recordingId, {
    promptId,
    transcript: 'A changed retry must not create another artifact.',
  }, { ip: gatewayPseudonym });
  assert.equal(retried.existing, true);
  assert.equal(retried.contributionId, contributionId);
  assert.equal(subject.copied.length, 1);
});

test('durable cleanup retries after storage failure and a later service sweep resolves it', async () => {
  const subject = fixture({ deletePrefixFailures: 1 });
  const cancelled = await subject.service.cancel(token, recordingId);
  assert.equal(cancelled.state, 'cancelled');
  assert.deepEqual(await subject.service.recoverCleanup(), { scanned: 1, deleted: 1, failed: 0 });
  assert.ok(subject.deleted.includes(`storyforge-rec/${studentId}/${recordingId}/`));
});

test('segment and aggregate input bounds reject before storage', async () => {
  const subject = fixture();
  await assert.rejects(
    subject.service.addSegment(token, recordingId, {
      seq: 0,
      mimeType: 'audio/webm',
      durationMs: 60_001,
      buffer: Buffer.from('audio!'),
    }),
    (error) => error.code === 'invalid_segment_duration',
  );
  await assert.rejects(
    subject.service.addSegment(token, recordingId, {
      seq: 0,
      mimeType: 'audio/webm',
      durationMs: 1000,
      buffer: Buffer.alloc((5 * 1024 * 1024) + 1),
    }),
    (error) => error.code === 'invalid_audio_size' && error.status === 413,
  );
  assert.equal(subject.objects.size, 0);
});

test('guest voice requires a signed gateway pseudonym and applies independent token and client limits', async () => {
  const attempts = [1, 1, 121];
  const subject = fixture();
  const originalQueryCount = subject.queries.length;
  await assert.rejects(
    subject.service.open(token, { ip: '127.0.0.1' }),
    (error) => error.code === 'gateway_ingress_required' && error.status === 401,
  );
  assert.equal(subject.queries.length, originalQueryCount);

  let index = 0;
  const limited = fixture({ queries: [] });
  const rateQueries = limited.queries;
  // The fixture returns one attempt by default; replace the recorded rate result
  // through a purpose-built transaction to prove the token scope closes first.
  const service = createGuestVoiceService({
    environment: {
      STORYFORGE_REQUEST_A_STORY_FORCE_OFF: '0',
      STORYFORGE_GUEST_FORCE_OFF: '0',
      STORYFORGE_GUEST_CONTRIBUTIONS_FORCE_OFF: '0',
      STORYFORGE_VOICE_FORCE_OFF: '0',
    },
    withServiceTransaction: async (operation) => operation({
      query: async (sql, values = []) => {
        rateQueries.push({ sql, values });
        if (sql.includes('sf_guest_rate_hit')) return { rows: [{ attempts: attempts[index++] }] };
        if (sql.includes('sf_guest_voice_open')) return { rows: [{ payload: { recordingId } }] };
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    }),
    storage: {
      putRecordingSegment() {}, getRecordingSegment() {}, deleteRecordingObjects() {},
      copyAudioObject() {}, headAudioObject() {}, deleteAudioObject() {}, deleteRecordingPrefix() {},
    },
    transcription: { available: true, transcribeSegment() {} },
    assembly: { available: true, option: 'A', assembleRecording() {} },
  });
  await service.open(token, { ip: gatewayPseudonym });
  await assert.rejects(
    service.open(token, { ip: gatewayPseudonym }),
    (error) => error.code === 'guest_rate_limited' && error.status === 429,
  );
});
