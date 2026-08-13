import { randomUUID } from 'node:crypto';

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const allowedMimeTypes = new Set(['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav']);
const mimeExtensions = Object.freeze({
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
});
const maxAudioBytes = 5 * 1024 * 1024;

export class MentorNotesError extends Error {
  constructor(code, message, status = 400, options = {}) {
    super(message, options);
    this.name = 'MentorNotesError';
    this.code = code;
    this.status = status;
  }
}

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be supplied.`);
  return value;
}

function explicitlyDisabled(value) {
  return !['0', 'false', 'no', 'off'].includes(String(value ?? '').trim().toLowerCase());
}

export function mentorNotesForceOff(environment = process.env) {
  return explicitlyDisabled(environment.STORYFORGE_MENTOR_NOTES_FORCE_OFF);
}

function requireUuid(value, label) {
  const result = String(value || '').trim();
  if (!uuidPattern.test(result)) {
    throw new MentorNotesError('invalid_identifier', `${label} is not valid.`);
  }
  return result;
}

function requireReviewer(identity) {
  if (
    (!['admin', 'mentor'].includes(identity?.role) && identity?.wordpressAdmin !== true)
    || identity?.eligible !== true
    || !uuidPattern.test(String(identity?.sub || ''))
  ) {
    throw new MentorNotesError(
      'mentor_note_reviewer_required',
      'An authorized StoryForge reviewer is required.',
      403,
    );
  }
}

function expectedVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 0) {
    throw new MentorNotesError(
      'mentor_note_version_required',
      'Reload the mentor note before saving.',
    );
  }
  return version;
}

function boundedBody(value, { optional = false } = {}) {
  const body = String(value ?? '').trim();
  if ((optional && !body) || (body.length >= 1 && body.length <= 10_000)) return body;
  throw new MentorNotesError(
    'invalid_mentor_note',
    'Mentor feedback must contain between 1 and 10000 characters.',
  );
}

function surface(value) {
  const result = String(value || 'workspace');
  if (!['workspace', 'quick'].includes(result)) {
    throw new MentorNotesError('invalid_mentor_note_surface', 'Mentor note surface is invalid.');
  }
  return result;
}

function normalizeMimeType(value) {
  const result = String(value || '').split(';', 1)[0].trim().toLowerCase();
  if (!allowedMimeTypes.has(result)) {
    throw new MentorNotesError(
      'unsupported_audio_format',
      'This mentor-note audio format is not supported.',
    );
  }
  return result;
}

function normalizeAudio(value) {
  const buffer = Buffer.isBuffer(value)
    ? value
    : (value instanceof Uint8Array ? Buffer.from(value) : null);
  if (!buffer || buffer.byteLength < 1) {
    throw new MentorNotesError('invalid_audio_size', 'Mentor-note audio is required.');
  }
  if (buffer.byteLength > maxAudioBytes) {
    throw new MentorNotesError(
      'mentor_note_audio_too_large',
      'Mentor-note audio may not exceed 5 MB.',
      413,
    );
  }
  return buffer;
}

function translateDatabaseError(error) {
  if (error?.code === '40001') {
    throw new MentorNotesError(
      'mentor_note_conflict',
      'This mentor note changed. Reload before saving.',
      409,
    );
  }
  if (error?.code === '42501') {
    throw new MentorNotesError(
      'mentor_notes_disabled',
      'Mentor notes are unavailable for this account.',
      403,
    );
  }
  if (error?.code === 'P0002') {
    throw new MentorNotesError('mentor_note_not_found', 'Mentor note not found.', 404);
  }
  throw error;
}

export function createMentorNotesService({
  withIdentity,
  storage,
  transcription,
  signPlayback,
  environment = process.env,
} = {}) {
  requireFunction(withIdentity, 'withIdentity');
  const putAudio = requireFunction(
    storage?.putAudio || storage?.putRecordingSegment,
    'storage.putRecordingSegment',
  );
  const headAudio = requireFunction(
    storage?.headAudio || storage?.headAudioObject,
    'storage.headAudioObject',
  );
  const deleteAudio = requireFunction(
    storage?.deleteAudio || storage?.deleteRecordingObjects,
    'storage.deleteRecordingObjects',
  );
  const transcribe = requireFunction(
    transcription?.transcribeSegment,
    'transcription.transcribeSegment',
  );
  requireFunction(signPlayback, 'signPlayback');

  function withReviewerIdentity(identity, operation) {
    return identity?.wordpressAdmin === true && identity?.role !== 'admin'
      ? withIdentity(identity, operation, { adminMode: true })
      : withIdentity(identity, operation);
  }

  async function rpc(identity, sql, values, { reviewer = false } = {}) {
    try {
      const transaction = reviewer ? withReviewerIdentity : withIdentity;
      return await transaction(identity, async (client) => {
        const result = await client.query(sql, values);
        return result.rows[0]?.payload ?? null;
      });
    } catch (error) {
      return translateDatabaseError(error);
    }
  }

  async function databaseEnabled(identity) {
    if (mentorNotesForceOff(environment)) return false;
    if (!['student', 'admin', 'mentor'].includes(identity?.role) || identity?.eligible !== true) return false;
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query('SELECT public.sf_mentor_notes_enabled() AS enabled');
        return result.rows[0]?.enabled === true;
      });
    } catch (error) {
      if (['42501', '42883', '42P01'].includes(error?.code)) return false;
      throw error;
    }
  }

  async function capability(identity) {
    if (!['admin', 'mentor'].includes(identity?.role) && identity?.wordpressAdmin !== true) return false;
    if (mentorNotesForceOff(environment) || identity?.eligible !== true) return false;
    try {
      return await withReviewerIdentity(identity, async (client) => {
        const result = await client.query('SELECT public.sf_mentor_notes_enabled() AS enabled');
        return result.rows[0]?.enabled === true;
      });
    } catch (error) {
      if (['42501', '42883', '42P01'].includes(error?.code)) return false;
      throw error;
    }
  }

  async function readCapability(identity) {
    return databaseEnabled(identity);
  }

  async function requireEnabled(identity) {
    requireReviewer(identity);
    if (!await capability(identity)) {
      throw new MentorNotesError(
        'mentor_notes_disabled',
        'Mentor notes are disabled by the StoryForge safety controls.',
        403,
      );
    }
  }

  async function requireReadable(identity) {
    if (!await readCapability(identity)) {
      throw new MentorNotesError(
        'mentor_notes_disabled',
        'Mentor notes are disabled by the StoryForge safety controls.',
        403,
      );
    }
  }

  async function list(identity, storyId, { reviewer = false } = {}) {
    if (reviewer) await requireEnabled(identity);
    else await requireReadable(identity);
    return rpc(
      identity,
      'SELECT public.sf_list_mentor_notes($1) AS payload',
      [requireUuid(storyId, 'Story identifier')],
      { reviewer },
    );
  }

  async function create(identity, storyId, input = {}) {
    await requireEnabled(identity);
    return rpc(
      identity,
      "SELECT public.sf_create_mentor_note($1, $2, $3, $4) AS payload",
      [
        requireUuid(storyId, 'Story identifier'),
        boundedBody(input.body, { optional: true }),
        input.internalOnly === true,
        surface(input.surface),
      ],
      { reviewer: true },
    );
  }

  async function update(identity, noteId, input = {}) {
    await requireEnabled(identity);
    return rpc(
      identity,
      'SELECT public.sf_update_mentor_note($1, $2, $3, $4) AS payload',
      [
        requireUuid(noteId, 'Mentor note identifier'),
        expectedVersion(input.expectedVersion),
        boundedBody(input.body),
        surface(input.surface),
      ],
      { reviewer: true },
    );
  }

  async function publish(identity, noteId, input = {}) {
    await requireEnabled(identity);
    return rpc(
      identity,
      'SELECT public.sf_publish_mentor_note($1, $2, $3) AS payload',
      [
        requireUuid(noteId, 'Mentor note identifier'),
        expectedVersion(input.expectedVersion),
        surface(input.surface),
      ],
      { reviewer: true },
    );
  }

  async function discard(identity, noteId, input = {}) {
    await requireEnabled(identity);
    const note = await rpc(
      identity,
      'SELECT public.sf_discard_mentor_note($1, $2, $3) AS payload',
      [
        requireUuid(noteId, 'Mentor note identifier'),
        expectedVersion(input.expectedVersion),
        surface(input.surface),
      ],
      { reviewer: true },
    );
    if (note?.objectKey) {
      await deleteAudio({ objectKeys: [note.objectKey] });
      await rpc(
        identity,
        'SELECT public.sf_complete_mentor_note_audio_delete($1, $2) AS payload',
        [note.noteId || note.id, note.objectKey],
        { reviewer: true },
      );
    }
    return { ...note, objectKey: undefined };
  }

  async function uploadAudio(identity, noteId, input = {}) {
    await requireEnabled(identity);
    if (transcription?.available === false) {
      throw new MentorNotesError(
        'transcribe_unavailable',
        'Mentor-note transcription is unavailable.',
        503,
      );
    }
    const id = requireUuid(noteId, 'Mentor note identifier');
    const version = expectedVersion(input.expectedVersion);
    const mimeType = normalizeMimeType(input.mimeType);
    const buffer = normalizeAudio(input.buffer);
    const extension = mimeExtensions[mimeType];
    const allocation = await rpc(
      identity,
      'SELECT public.sf_prepare_mentor_note_audio($1, $2, $3, $4, $5) AS payload',
      [id, version, mimeType, buffer.byteLength, surface(input.surface)],
      { reviewer: true },
    );
    const objectKey = `storyforge-mentor-notes/${allocation.authorId}/${allocation.studentId}/${allocation.storyId}/${id}/${randomUUID()}.${extension}`;
    await rpc(
      identity,
      'SELECT public.sf_begin_mentor_note_audio($1, $2, $3, $4, $5, $6) AS payload',
      [id, version, objectKey, mimeType, buffer.byteLength, surface(input.surface)],
      { reviewer: true },
    );

    try {
      await putAudio({
        objectKey,
        contentType: mimeType,
        body: buffer,
        byteSize: buffer.byteLength,
      });
      const metadata = await headAudio({ objectKey });
      if (metadata.contentType !== mimeType || metadata.byteSize !== buffer.byteLength) {
        throw new MentorNotesError(
          'mentor_note_audio_verification_failed',
          'Mentor-note audio could not be verified.',
          503,
        );
      }
      const transcript = await transcribe({
        buffer,
        mimeType,
        seq: 0,
        recordingId: id,
        studentId: allocation.studentId,
        storyId: allocation.storyId,
        keywords: [],
        promptTail: '',
      });
      return await rpc(
        identity,
        'SELECT public.sf_complete_mentor_note_audio($1, $2, $3, $4, $5, $6, $7) AS payload',
        [
          id,
          Number(allocation.nextVersion),
          objectKey,
          transcript.text,
          transcript.providerId,
          transcript.modelId,
          surface(input.surface),
        ],
        { reviewer: true },
      );
    } catch (cause) {
      const failed = await rpc(
        identity,
        'SELECT public.sf_fail_mentor_note_audio($1, $2, $3, $4) AS payload',
        [id, objectKey, 'upload_or_transcribe', surface(input.surface)],
        { reviewer: true },
      ).catch(() => null);
      const deleted = await deleteAudio({ objectKeys: [objectKey] })
        .then(() => true)
        .catch(() => false);
      if (deleted && failed?.objectKey) {
        await rpc(
          identity,
          'SELECT public.sf_complete_mentor_note_audio_delete($1, $2) AS payload',
          [failed.noteId || id, failed.objectKey],
          { reviewer: true },
        ).catch(() => null);
      }
      if (cause instanceof MentorNotesError) throw cause;
      throw new MentorNotesError(
        cause?.code || 'mentor_note_audio_failed',
        'Mentor-note audio could not be processed.',
        Number(cause?.status) || 503,
        { cause },
      );
    } finally {
      if (typeof transcription?.releaseSession === 'function') {
        transcription.releaseSession(id);
      }
    }
  }

  async function transcribeAudioSegment(identity, noteId, input = {}) {
    await requireEnabled(identity);
    if (transcription?.available === false) {
      throw new MentorNotesError(
        'transcribe_unavailable',
        'Mentor-note transcription is unavailable.',
        503,
      );
    }
    const id = requireUuid(noteId, 'Mentor note identifier');
    const version = expectedVersion(input.expectedVersion);
    const mimeType = normalizeMimeType(input.mimeType);
    const buffer = normalizeAudio(input.buffer);
    const seq = Number(input.seq);
    if (!Number.isInteger(seq) || seq < 0 || seq > 199) {
      throw new MentorNotesError('invalid_segment_sequence', 'Mentor-note segment sequence is invalid.');
    }
    const allocation = await rpc(
      identity,
      'SELECT public.sf_prepare_mentor_note_audio($1, $2, $3, $4, $5) AS payload',
      [id, version, mimeType, buffer.byteLength, surface(input.surface)],
      { reviewer: true },
    );
    try {
      const transcript = await transcribe({
        buffer,
        mimeType,
        seq,
        recordingId: id,
        studentId: allocation.studentId,
        storyId: allocation.storyId,
        keywords: [],
        promptTail: String(input.promptTail || '').slice(-2_000),
      });
      return {
        seq,
        text: String(transcript.text || ''),
        flaggedTerms: Array.isArray(transcript.flaggedTerms) ? transcript.flaggedTerms : [],
      };
    } catch (cause) {
      if (cause instanceof MentorNotesError) throw cause;
      throw new MentorNotesError(
        cause?.code || 'transcribe_unavailable',
        'This part of the mentor recording could not be transcribed yet.',
        Number(cause?.status) || 503,
        { cause },
      );
    }
  }

  async function playback(identity, noteId) {
    await requireReadable(identity);
    const reviewer = identity?.wordpressAdmin === true && identity?.role !== 'admin';
    const audio = await rpc(
      identity,
      'SELECT public.sf_get_mentor_note_audio($1) AS payload',
      [requireUuid(noteId, 'Mentor note identifier')],
      { reviewer },
    );
    if (!audio?.objectKey) {
      throw new MentorNotesError('mentor_note_audio_not_found', 'Mentor-note audio not found.', 404);
    }
    const signed = await signPlayback({ objectKey: audio.objectKey });
    return {
      playbackUrl: signed.playbackUrl,
      expiresIn: signed.expiresIn,
      contentType: audio.contentType,
      durationMs: audio.durationMs ?? null,
    };
  }

  return Object.freeze({
    capability,
    create,
    discard,
    list,
    playback,
    publish,
    readCapability,
    transcribeAudioSegment,
    update,
    uploadAudio,
  });
}
