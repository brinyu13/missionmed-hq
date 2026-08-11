import { createHash } from 'node:crypto';
import { createOptionAAssemblyExecutor } from './assembly/executors.mjs';

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const pseudonymPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const mimeExtensions = Object.freeze({
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
});
const maxSegmentBytes = 5 * 1024 * 1024;
const maxDurationMs = 30 * 60 * 1000;
const maxAssetBytes = 30 * 1024 * 1024;
const maxSegments = 200;

export class GuestVoiceError extends Error {
  constructor(code, message, status = 400, options = {}) {
    super(message, options);
    this.name = 'GuestVoiceError';
    this.code = code;
    this.status = status;
  }
}

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be supplied.`);
  return value;
}

function forceOff(value) {
  return !['0', 'false', 'no', 'off'].includes(String(value ?? '1').trim().toLowerCase());
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function guestToken(value) {
  const token = String(value || '');
  if (!tokenPattern.test(token)) {
    throw new GuestVoiceError('invitation_not_found', 'Invitation not found.', 404);
  }
  return token;
}

function uuid(value, label = 'Resource') {
  const result = String(value || '');
  if (!uuidPattern.test(result)) {
    throw new GuestVoiceError('invalid_identifier', `${label} identifier is invalid.`);
  }
  return result;
}

function integer(value, { min, max, code, message }) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < min || result > max) {
    throw new GuestVoiceError(code, message);
  }
  return result;
}

function audioBody(value) {
  const body = Buffer.isBuffer(value)
    ? value
    : (value instanceof Uint8Array ? Buffer.from(value) : null);
  if (!body || body.byteLength < 1 || body.byteLength > maxSegmentBytes) {
    throw new GuestVoiceError(
      'invalid_audio_size',
      'Each audio segment must be between 1 byte and 5 MB.',
      body?.byteLength > maxSegmentBytes ? 413 : 400,
    );
  }
  return body;
}

function mimeType(value) {
  const result = String(value || '').split(';', 1)[0].trim().toLowerCase();
  if (!Object.hasOwn(mimeExtensions, result)) {
    throw new GuestVoiceError('unsupported_audio_format', 'This audio format is not supported.');
  }
  return result;
}

function mapDatabaseError(error) {
  if (error instanceof GuestVoiceError) return error;
  if (error?.code === 'P0002' || error?.code === '42501') {
    return new GuestVoiceError('invitation_not_found', 'Invitation not found.', 404, { cause: error });
  }
  if (error?.code === 'P0003') {
    return new GuestVoiceError('invitation_complete', 'This invitation already has three shared stories.', 429, { cause: error });
  }
  if (error?.code === '40001') {
    return new GuestVoiceError('guest_voice_conflict', 'This contribution cannot be changed.', 409, { cause: error });
  }
  if (error?.code === '55000') {
    return new GuestVoiceError('guest_voice_pending', 'The recording is still being prepared.', 409, { cause: error });
  }
  if (error?.code === '22023' || error?.code === '23514') {
    return new GuestVoiceError('invalid_guest_voice_request', 'The recording request is invalid.', 400, { cause: error });
  }
  return error;
}

function safeTranscriptionCode(error) {
  return [
    'transcribe_unavailable',
    'transcribe_timeout',
    'transcribe_rejected_format',
    'transcribe_failed_permanent',
  ].includes(error?.code) ? error.code : 'transcribe_unavailable';
}

export function createGuestVoiceAssemblyExecutor({
  withServiceTransaction,
  storage,
  runConcatRemux,
} = {}) {
  requireFunction(withServiceTransaction, 'withServiceTransaction');
  const getObject = requireFunction(
    storage?.getSegment || storage?.getRecordingSegment,
    'storage.getRecordingSegment',
  );
  const putObject = requireFunction(
    storage?.putSegment || storage?.putRecordingSegment,
    'storage.putRecordingSegment',
  );
  return createOptionAAssemblyExecutor({
    loadSegments: ({ studentId, recordingId }) => withServiceTransaction(async (client) => {
      const result = await client.query(
        'SELECT * FROM public.sf_guest_voice_assembly_manifest($1)',
        [uuid(recordingId, 'Recording')],
      );
      if (!result.rows.length) {
        throw new GuestVoiceError('guest_voice_pending', 'The recording is still being prepared.', 409);
      }
      // The existing Option A executor independently validates the UUID namespace,
      // contiguous sequence, MIME agreement, and exact private object keys.
      return result.rows.map((row) => ({ ...row, studentId }));
    }),
    getObject,
    putObject,
    ...(runConcatRemux ? { runConcatRemux } : {}),
  });
}

export function createGuestVoiceService({
  withServiceTransaction,
  storage,
  transcription,
  assembly,
  environment = process.env,
  now = () => new Date(),
  emitEvent = () => {},
} = {}) {
  requireFunction(withServiceTransaction, 'withServiceTransaction');
  const putSegment = requireFunction(
    storage?.putSegment || storage?.putRecordingSegment,
    'storage.putRecordingSegment',
  );
  const getSegment = requireFunction(
    storage?.getSegment || storage?.getRecordingSegment,
    'storage.getRecordingSegment',
  );
  const deleteObjects = requireFunction(
    storage?.deleteObjects || storage?.deleteRecordingObjects,
    'storage.deleteRecordingObjects',
  );
  const copyAudioObject = requireFunction(storage?.copyAudioObject, 'storage.copyAudioObject');
  const headAudioObject = requireFunction(storage?.headAudioObject, 'storage.headAudioObject');
  const deleteAudioObject = requireFunction(storage?.deleteAudioObject, 'storage.deleteAudioObject');
  const deleteRecordingPrefix = requireFunction(
    storage?.deleteRecordingPrefix,
    'storage.deleteRecordingPrefix',
  );
  const transcribeSegment = requireFunction(
    transcription?.transcribeSegment,
    'transcription.transcribeSegment',
  );
  requireFunction(assembly?.assembleRecording, 'assembly.assembleRecording');
  requireFunction(emitEvent, 'emitEvent');

  const pending = new Map();
  let cleanupRunning = null;

  function enabled() {
    return !forceOff(environment.STORYFORGE_REQUEST_A_STORY_FORCE_OFF)
      && !forceOff(environment.STORYFORGE_GUEST_FORCE_OFF)
      && !forceOff(environment.STORYFORGE_GUEST_CONTRIBUTIONS_FORCE_OFF)
      && !forceOff(environment.STORYFORGE_VOICE_FORCE_OFF)
      && transcription?.available !== false
      && assembly?.available !== false
      && assembly?.option === 'A';
  }

  function requireEnabled() {
    if (!enabled()) {
      throw new GuestVoiceError('invitation_not_found', 'Invitation not found.', 404);
    }
  }

  function emit(event, fields = {}) {
    emitEvent(Object.freeze({
      t: now().toISOString(),
      event,
      ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value != null)),
    }));
  }

  async function transaction(operation) {
    try {
      return await withServiceTransaction(operation);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async function rateLimit(client, tokenHash, ip) {
    const pseudonym = String(ip || '').trim().toLowerCase();
    if (!pseudonymPattern.test(pseudonym)) {
      throw new GuestVoiceError(
        'gateway_ingress_required',
        'StoryForge guest access is unavailable.',
        401,
      );
    }
    const bucket = new Date(Math.floor(now().getTime() / 900_000) * 900_000).toISOString();
    const scopes = [
      [sha256(`token:${tokenHash}`), 120],
      [sha256(`client:${pseudonym}`), 240],
    ];
    for (const [scope, limit] of scopes) {
      const result = await client.query('SELECT public.sf_guest_rate_hit($1,$2) AS attempts', [scope, bucket]);
      if (Number(result.rows[0]?.attempts || 0) > limit) {
        throw new GuestVoiceError('guest_rate_limited', 'Please wait before trying again.', 429);
      }
    }
  }

  async function runTranscription(token, recordingId, seq) {
    const tokenHash = sha256(token);
    const claim = await transaction(async (client) => (
      await client.query(
        'SELECT public.sf_guest_voice_claim_transcription($1,$2,$3) AS payload',
        [tokenHash, recordingId, seq],
      )
    ).rows[0]?.payload);
    if (!claim) return;
    try {
      const buffer = audioBody(await getSegment({ objectKey: claim.objectKey }));
      const result = await transcribeSegment({
        recordingId,
        studentId: claim.studentId,
        buffer,
        mimeType: claim.mimeType,
        seq,
        keywords: [],
        promptTail: String(claim.promptTail || ''),
        languageHint: 'en',
      });
      await transaction((client) => client.query(
        'SELECT public.sf_guest_voice_complete_transcription($1,$2,$3,$4,$5,$6)',
        [
          tokenHash,
          recordingId,
          seq,
          String(result?.text || ''),
          String(result?.providerId || ''),
          String(result?.modelId || ''),
        ],
      ));
      emit('guest_voice_segment_transcribed', { recordingId, seq });
    } catch (error) {
      await transaction((client) => client.query(
        'SELECT public.sf_guest_voice_fail_transcription($1,$2,$3,$4)',
        [tokenHash, recordingId, seq, safeTranscriptionCode(error)],
      )).catch(() => {});
      emit('guest_voice_transcription_failed', { recordingId, seq, errorCategory: 'transcribe' });
    }
  }

  function enqueue(token, recordingId, seq) {
    const previous = pending.get(recordingId) || Promise.resolve();
    const next = previous.then(() => runTranscription(token, recordingId, seq));
    pending.set(recordingId, next);
    next.finally(() => {
      if (pending.get(recordingId) === next) pending.delete(recordingId);
    }).catch(() => {});
    return next;
  }

  async function waitForIdle(recordingId) {
    await (pending.get(recordingId) || Promise.resolve());
  }

  async function recoverGuestVoiceCleanup() {
    if (cleanupRunning) return cleanupRunning;
    cleanupRunning = (async () => {
      const candidates = await transaction(async (client) => (
        await client.query('SELECT * FROM public.sf_claim_guest_voice_cleanup($1)', [20])
      ).rows);
      let deleted = 0;
      let failed = 0;
      for (const candidate of candidates) {
        try {
          if (candidate.cleanup_kind === 'transient_prefix') {
            await deleteRecordingPrefix({ prefix: candidate.object_locator });
          } else if (candidate.cleanup_kind === 'permanent_object') {
            await deleteAudioObject({ objectKey: candidate.object_locator });
          } else {
            throw new GuestVoiceError('guest_voice_cleanup_invalid', 'Private audio cleanup is unavailable.', 503);
          }
          await transaction((client) => client.query(
            'SELECT public.sf_complete_guest_voice_cleanup($1,true,NULL)',
            [candidate.intent_id],
          ));
          deleted += 1;
        } catch {
          failed += 1;
          await transaction((client) => client.query(
            "SELECT public.sf_complete_guest_voice_cleanup($1,false,'object_delete_failed')",
            [candidate.intent_id],
          )).catch(() => {});
        }
      }
      if (deleted || failed) emit('guest_voice_cleanup_completed', { deleted, failed });
      return { scanned: candidates.length, deleted, failed };
    })();
    try {
      return await cleanupRunning;
    } finally {
      cleanupRunning = null;
    }
  }

  // Cleanup authority is durable in PostgreSQL. The unreferenced timer lets a
  // fresh process resume abandoned/revoked work without requiring guest traffic.
  const cleanupTimer = setInterval(() => {
    recoverGuestVoiceCleanup().catch(() => {});
  }, 10 * 60 * 1000);
  cleanupTimer.unref?.();

  return Object.freeze({
    available: enabled,
    caps: Object.freeze({ maxDurationMs, maxAssetBytes, maxSegmentBytes, maxSegments }),
    recoverCleanup: recoverGuestVoiceCleanup,

    async open(tokenValue, { ip } = {}) {
      requireEnabled();
      const token = guestToken(tokenValue);
      const tokenHash = sha256(token);
      return transaction(async (client) => {
        await rateLimit(client, tokenHash, ip);
        const result = await client.query(
          'SELECT public.sf_guest_voice_open($1) AS payload',
          [tokenHash],
        );
        return {
          ...result.rows[0].payload,
          caps: { maxDurationMs, maxAssetBytes, maxSegmentBytes, maxSegments },
        };
      });
    },

    async addSegment(tokenValue, recordingIdValue, input = {}, { ip } = {}) {
      requireEnabled();
      const token = guestToken(tokenValue);
      const tokenHash = sha256(token);
      const recordingId = uuid(recordingIdValue, 'Recording');
      const seq = integer(input.seq, {
        min: 0, max: maxSegments - 1,
        code: 'invalid_segment_sequence', message: 'Segment sequence is invalid.',
      });
      const durationMs = integer(input.durationMs, {
        min: 1, max: 60_000,
        code: 'invalid_segment_duration', message: 'Segment duration is invalid.',
      });
      const type = mimeType(input.mimeType);
      const body = audioBody(input.buffer);
      let objectKey = '';
      try {
        const accepted = await transaction(async (client) => {
          await rateLimit(client, tokenHash, ip);
          const status = (await client.query(
            'SELECT public.sf_guest_voice_status($1,$2) AS payload',
            [tokenHash, recordingId],
          )).rows[0]?.payload;
          objectKey = `storyforge-rec/${status.studentId}/${recordingId}/seg-${String(seq).padStart(5, '0')}.${mimeExtensions[type]}`;
          await client.query(
            'SELECT public.sf_guest_voice_reserve_segment($1,$2,$3,$4,$5,$6,$7)',
            [tokenHash, recordingId, seq, objectKey, type, body.byteLength, durationMs],
          );
          await putSegment({ objectKey, contentType: type, body, byteSize: body.byteLength });
          return (await client.query(
            'SELECT public.sf_guest_voice_confirm_segment($1,$2,$3) AS payload',
            [tokenHash, recordingId, seq],
          )).rows[0]?.payload;
        });
        enqueue(token, recordingId, seq);
        return accepted;
      } catch (error) {
        if (objectKey) await deleteObjects({ objectKeys: [objectKey] }).catch(() => {});
        throw error;
      }
    },

    async status(tokenValue, recordingIdValue, { ip } = {}) {
      requireEnabled();
      const tokenHash = sha256(guestToken(tokenValue));
      const recordingId = uuid(recordingIdValue, 'Recording');
      return transaction(async (client) => {
        await rateLimit(client, tokenHash, ip);
        return (await client.query(
          'SELECT public.sf_guest_voice_status($1,$2) AS payload',
          [tokenHash, recordingId],
        )).rows[0]?.payload;
      });
    },

    async retryTranscription(tokenValue, recordingIdValue, seqValue) {
      requireEnabled();
      const token = guestToken(tokenValue);
      const recordingId = uuid(recordingIdValue, 'Recording');
      const seq = integer(seqValue, {
        min: 0, max: maxSegments - 1,
        code: 'invalid_segment_sequence', message: 'Segment sequence is invalid.',
      });
      await enqueue(token, recordingId, seq);
      return { recordingId, seq, queued: true };
    },

    async finish(tokenValue, recordingIdValue, input = {}, { ip } = {}) {
      requireEnabled();
      const token = guestToken(tokenValue);
      const tokenHash = sha256(token);
      const recordingId = uuid(recordingIdValue, 'Recording');
      const promptId = uuid(input.promptId, 'Prompt');
      await waitForIdle(recordingId);
      const prepared = await transaction(async (client) => {
        await rateLimit(client, tokenHash, ip);
        return (await client.query(
          'SELECT public.sf_guest_voice_prepare_finish($1,$2,$3) AS payload',
          [tokenHash, recordingId, promptId],
        )).rows[0]?.payload;
      });
      if (prepared.existing === true) {
        return {
          contributionId: prepared.contributionId,
          assetId: prepared.assetId,
          kind: 'voice',
          state: prepared.state,
          existing: true,
          transcript: prepared.transcript,
          providerTranscript: prepared.providerTranscript,
        };
      }
      const transcript = String(input.transcript ?? prepared.providerTranscript).trim();
      if (!transcript || transcript.length > 20_000) {
        throw new GuestVoiceError('invalid_contribution', 'Review the transcript before sharing.');
      }
      const assembled = await assembly.assembleRecording({
        recordingId,
        studentId: prepared.studentId,
      });
      if (
        assembled?.option !== 'A'
        || assembled?.artifactReady !== true
        || !assembled.artifactKey
        || !Number.isInteger(Number(assembled.byteSize))
        || Number(assembled.byteSize) < 1
        || Number(assembled.byteSize) > maxAssetBytes
        || !/^[a-f0-9]{64}$/.test(String(assembled.checksumSha256 || ''))
      ) {
        throw new GuestVoiceError('guest_voice_assembly_failed', 'The recording could not be prepared.', 503);
      }
      const contributionId = uuid(prepared.contributionId, 'Contribution');
      const assetId = uuid(prepared.assetId, 'Audio asset');
      const targetKey = String(prepared.objectKey || '');
      const expectedTarget = `storyforge-contribution-audio/${prepared.studentId}/${prepared.invitationId}/${contributionId}/${assetId}.${mimeExtensions[prepared.mimeType]}`;
      if (targetKey !== expectedTarget) {
        throw new GuestVoiceError('invalid_guest_voice_request', 'The recording request is invalid.');
      }
      try {
        await copyAudioObject({
          sourceKey: assembled.artifactKey,
          targetKey,
          contentType: prepared.mimeType,
        });
        const head = await headAudioObject({ objectKey: targetKey });
        if (
          head.contentType !== prepared.mimeType
          || Number(head.byteSize) !== Number(assembled.byteSize)
        ) {
          throw new GuestVoiceError('audio_verification_failed', 'Private audio verification did not complete.', 503);
        }
        const completed = await transaction((client) => client.query(
          `SELECT public.sf_guest_voice_complete(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
          ) AS payload`,
          [
            tokenHash, recordingId, contributionId, assetId, transcript, targetKey,
            prepared.mimeType, Number(assembled.byteSize), Number(prepared.durationMs),
            assembled.checksumSha256,
          ],
        ).then((result) => result.rows[0]?.payload));
        await recoverGuestVoiceCleanup().catch(() => emit('guest_voice_cleanup_failed', {
          recordingId, errorCategory: 'storage',
        }));
        emit('guest_voice_contribution_completed', { recordingId, contributionId, assetId });
        return { ...completed, transcript, providerTranscript: prepared.providerTranscript };
      } catch (error) {
        // Never delete the permanent target on an ambiguous transaction result.
        // The durable cleanup worker first proves that no verified asset refers
        // to it, so a committed contribution survives a lost database ACK.
        recoverGuestVoiceCleanup().catch(() => {});
        throw error;
      }
    },

    async cancel(tokenValue, recordingIdValue) {
      requireEnabled();
      const tokenHash = sha256(guestToken(tokenValue));
      const recordingId = uuid(recordingIdValue, 'Recording');
      const result = await transaction((client) => client.query(
        'SELECT public.sf_guest_voice_cancel($1,$2) AS payload',
        [tokenHash, recordingId],
      ).then((response) => response.rows[0]?.payload));
      await recoverGuestVoiceCleanup().catch(() => emit('guest_voice_cleanup_failed', {
        recordingId, errorCategory: 'storage',
      }));
      pending.delete(recordingId);
      emit('guest_voice_recording_cancelled', { recordingId });
      return { recordingId, state: result.state };
    },
  });
}
