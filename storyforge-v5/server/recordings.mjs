import { createHash } from 'node:crypto';

const segmentPlanMs = Object.freeze([4_000, 15_000]);
const allowedMimeTypes = new Set(['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav']);
const mimeExtensions = Object.freeze({
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
});
const maxSegmentBytes = 5 * 1024 * 1024;
const maxAssetBytes = 50 * 1024 * 1024;
const maxRecordingDurationMs = 20 * 60 * 1000;
const maxSegments = 200;
const defaultDailyMinutes = 60;
const sweepIntervalMs = 10 * 60 * 1000;
const audioReconciliationAgeMs = 168 * 60 * 60 * 1000;
const audioReconciliationCadenceMs = 7 * 24 * 60 * 60 * 1000;
const audioReconciliationPageSize = 1000;
const audioReconciliationReferenceBatchSize = 1000;
const audioReconciliationEvaluationCap = 5000;
const audioReconciliationDeleteCap = 200;
const audioReconciliationPrefix = 'storyforge-audio/';
const audioReconciliationControlPrefix = 'storyforge-audio/_control/';
const audioReconciliationControlKey = `${audioReconciliationControlPrefix}reconciliation.json`;
const permanentAudioExtensions = new Set(['webm', 'm4a', 'mp4', 'ogg', 'wav']);
const retryDelaysMs = Object.freeze([0, 2_000, 8_000]);
const usageMetricNames = Object.freeze([
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'durationSeconds',
  'inputAudioTokens',
  'inputTextTokens',
  'outputAudioTokens',
  'outputTextTokens',
]);
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export class RecordingError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'RecordingError';
    this.code = code;
    this.status = status;
  }
}

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be supplied.`);
  return value;
}

function integer(value, code, message, { min, max }) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < min || result > max) {
    throw new RecordingError(code, message);
  }
  return result;
}

function positiveIntegerSetting(value, fallback, { min, max }) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function onByDefault(value) {
  const normalized = String(value ?? 'on').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(normalized);
}

function safeUuid(value) {
  const result = String(value || '');
  if (!uuidPattern.test(result)) {
    throw new RecordingError(
      'invalid_identifier',
      'A valid resource identifier is required.',
    );
  }
  return result;
}

export function parseReconciliationAudioObject(objectKeyValue) {
  const objectKey = String(objectKeyValue || '');
  if (
    !objectKey.startsWith(audioReconciliationPrefix)
    || objectKey.startsWith(audioReconciliationControlPrefix)
  ) {
    return null;
  }
  const parts = objectKey.slice(audioReconciliationPrefix.length).split('/');
  if (parts.length < 3 || parts.length > 4) return null;
  const [studentId, storyId] = parts;
  if (!uuidPattern.test(studentId) || !uuidPattern.test(storyId)) return null;

  let entityId = '';
  if (parts.length === 3) {
    const match = parts[2].match(/^([a-f0-9-]+)\.([a-z0-9]+)$/i);
    if (
      !match
      || !uuidPattern.test(match[1])
      || !permanentAudioExtensions.has(match[2].toLowerCase())
    ) {
      return null;
    }
    entityId = match[1];
  } else {
    if (!uuidPattern.test(parts[2])) return null;
    const match = parts[3].match(/^seg-\d{5}\.([a-z0-9]+)$/i);
    if (!match || !permanentAudioExtensions.has(match[1].toLowerCase())) return null;
    entityId = parts[2];
  }
  return Object.freeze({
    objectKey,
    entityId,
    studentId,
    storyId,
  });
}

function assertStudent(identity) {
  if (identity?.role !== 'student' || identity?.eligible !== true || !uuidPattern.test(identity?.sub || '')) {
    throw new RecordingError(
      'student_required',
      'An eligible student account is required.',
      403,
    );
  }
}

function normalizeMimeType(value) {
  const result = String(value || '').split(';', 1)[0].trim().toLowerCase();
  if (!allowedMimeTypes.has(result)) {
    throw new RecordingError(
      'unsupported_audio_format',
      'This audio format is not supported.',
      400,
    );
  }
  return result;
}

function normalizeBytes(value) {
  const body = Buffer.isBuffer(value)
    ? value
    : (value instanceof Uint8Array ? Buffer.from(value) : null);
  if (!body || body.byteLength < 1) {
    throw new RecordingError('invalid_audio_size', 'An audio segment is required.');
  }
  if (body.byteLength > maxSegmentBytes) {
    throw new RecordingError(
      'segment_too_large',
      'Audio segments may not exceed 5 MB.',
      413,
    );
  }
  return body;
}

function normalizeFlaggedTerms(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => (
    item
    && typeof item === 'object'
    && !Array.isArray(item)
    && Object.keys(item).every((key) => (
      [
        'term',
        'suggestion',
        'from',
        'to',
        'start',
        'end',
        'source',
        'confidence',
        'lexiconVersion',
      ].includes(key)
    ))
  ));
}

function contentFreeUsage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    usageMetricNames
      .map((name) => [name, Number(value[name])])
      .filter(([, metric]) => Number.isFinite(metric) && metric >= 0),
  );
}

function sessionProjection(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id ?? row.studentId,
    storyId: row.story_id ?? row.storyId ?? null,
    state: row.state,
    mimeType: row.mime_type ?? row.mimeType ?? null,
    totalDurationMs: Number(row.total_duration_ms ?? row.totalDurationMs ?? 0),
    segmentCount: Number(row.segment_count ?? row.segmentCount ?? 0),
    assembledAssetId: row.assembled_asset_id ?? row.assembledAssetId ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    lastActivityAt: row.last_activity_at ?? row.lastActivityAt,
  };
}

function segmentProjection(row) {
  let flaggedTerms = row.flagged_terms ?? row.flaggedTerms ?? [];
  if (typeof flaggedTerms === 'string') {
    try {
      flaggedTerms = JSON.parse(flaggedTerms);
    } catch {
      flaggedTerms = [];
    }
  }
  return {
    id: row.id,
    recordingId: row.session_id ?? row.recordingId,
    seq: Number(row.seq),
    objectKey: row.object_key ?? row.objectKey,
    mimeType: row.mime_type ?? row.mimeType,
    byteSize: Number(row.byte_size ?? row.byteSize),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    transcribeState: row.transcribe_state ?? row.transcribeState,
    transcript: String(row.transcript || ''),
    flaggedTerms: normalizeFlaggedTerms(flaggedTerms),
    retryCount: Number(row.retry_count ?? row.retryCount ?? 0),
  };
}

function recordingAccessDenied() {
  return new RecordingError(
    'recording_access_denied',
    'Recording session is unavailable.',
    403,
  );
}

function stateConflict() {
  return new RecordingError(
    'state_conflict',
    'Recording session is not in a compatible state.',
    409,
  );
}

function dailyLimitError() {
  return new RecordingError(
    'voice_daily_limit',
    "You've reached today's recording limit. Everything you captured is saved, and typing is always available. Recording returns tomorrow.",
    429,
  );
}

function lengthLimitError() {
  return new RecordingError(
    'voice_length_limit',
    'This recording reached its length limit and was stopped. Everything you said is captured below.',
    409,
  );
}

function safeTranscriptionCode(error) {
  const permitted = new Set([
    'transcribe_unavailable',
    'transcribe_timeout',
    'transcribe_rejected_format',
    'transcribe_failed_permanent',
  ]);
  return permitted.has(error?.code) ? error.code : 'transcribe_unavailable';
}

function utcDayStartSql() {
  return "date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'";
}

function accountedDurationSql(tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return `greatest(
    ${prefix}total_duration_ms,
    CASE
      WHEN ${prefix}segment_count = 0 THEN 0
      ELSE ${segmentPlanMs[0]} + greatest(${prefix}segment_count - 1, 0) * ${segmentPlanMs[1]}
    END
  )`;
}

function nextAccountedDuration(session, durationMs) {
  const nextCount = session.segmentCount + 1;
  const planned = segmentPlanMs[0] + Math.max(0, nextCount - 1) * segmentPlanMs[1];
  return Math.max(session.totalDurationMs + durationMs, planned);
}

export function createPostgresRecordingStore({
  withIdentity,
  withServiceTransaction,
  appendAudit,
  appendServiceAudit,
}) {
  requireFunction(withIdentity, 'withIdentity');
  requireFunction(withServiceTransaction, 'withServiceTransaction');
  requireFunction(appendAudit, 'appendAudit');
  requireFunction(appendServiceAudit, 'appendServiceAudit');

  async function readDraftTitle() {
    // The service role has no approved path into private drafts. Transcription
    // remains useful without draft-derived keywords and never impersonates a
    // student with a fabricated WordPress identity.
    return '';
  }

  async function findActiveSession(identity) {
    return withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT id, student_id, story_id, state, mime_type, total_duration_ms, segment_count,
                assembled_asset_id, last_activity_at, created_at, updated_at
           FROM public.sf_recording_sessions
          WHERE student_id = $1
            AND state = 'recording'
          ORDER BY created_at ASC
          LIMIT 1`,
        [identity.sub],
      );
      return sessionProjection(result.rows[0]);
    });
  }

  async function openSession(identity, dailyLimitMs) {
    try {
      return await withIdentity(identity, async (client) => {
        const active = await client.query(
          `SELECT id, student_id, story_id, state, mime_type, total_duration_ms, segment_count,
                  assembled_asset_id, last_activity_at, created_at, updated_at
             FROM public.sf_recording_sessions
            WHERE student_id = $1
              AND state = 'recording'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE`,
          [identity.sub],
        );
        if (active.rows[0]) {
          return { session: sessionProjection(active.rows[0]), created: false };
        }
        const usage = await client.query(
          `SELECT coalesce(sum(${accountedDurationSql('session')}), 0)::bigint AS duration_ms
             FROM public.sf_recording_sessions session
            WHERE student_id = $1
              AND created_at >= ${utcDayStartSql()}`,
          [identity.sub],
        );
        if (Number(usage.rows[0]?.duration_ms || 0) >= dailyLimitMs) throw dailyLimitError();
        const inserted = await client.query(
          `INSERT INTO public.sf_recording_sessions (student_id)
           VALUES ($1)
           RETURNING id, student_id, story_id, state, mime_type, total_duration_ms, segment_count,
                     assembled_asset_id, last_activity_at, created_at, updated_at`,
          [identity.sub],
        );
        const session = sessionProjection(inserted.rows[0]);
        await appendAudit(client, {
          action: 'recording_started',
          entityType: 'recording_session',
          entityId: session.id,
          surface: 'quick',
          studentId: identity.sub,
          previousValue: null,
          newValue: { state: 'recording' },
        });
        return { session, created: true };
      });
    } catch (error) {
      if (error?.code !== '23505') throw error;
      const session = await findActiveSession(identity);
      if (!session) throw error;
      return { session, created: false };
    }
  }

  async function readOwnedSession(identity, recordingId) {
    return withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT id, student_id, story_id, state, mime_type, total_duration_ms, segment_count,
                assembled_asset_id, last_activity_at, created_at, updated_at
           FROM public.sf_recording_sessions
          WHERE id = $1
            AND student_id = $2`,
        [recordingId, identity.sub],
      );
      return sessionProjection(result.rows[0]);
    });
  }

  async function auditRecordingDenial(identity, recordingId, surface) {
    try {
      return await withIdentity(identity, async (client) => appendAudit(client, {
        action: 'unauthorized_denied',
        entityType: 'recording_session',
        entityId: recordingId,
        surface,
        studentId: identity.sub,
        previousValue: null,
        newValue: { errorCategory: 'auth' },
      }));
    } catch (error) {
      if (
        error?.code === 'audit_writer_unavailable'
        && error?.cause?.code === '42501'
        && /live identity required/i.test(String(error?.cause?.message || ''))
      ) {
        return null;
      }
      throw error;
    }
  }

  async function acceptSegment({
    identity,
    recordingId,
    seq,
    objectKey,
    mimeType,
    byteSize,
    durationMs,
    dailyLimitMs,
    persistObject,
    compensateObject,
  }) {
    requireFunction(compensateObject, 'compensateObject');
    return withIdentity(identity, async (client) => {
      const sessionResult = await client.query(
        `SELECT id, student_id, story_id, state, mime_type, total_duration_ms, segment_count,
                assembled_asset_id, last_activity_at, created_at, updated_at
           FROM public.sf_recording_sessions
          WHERE id = $1
            AND student_id = $2
          FOR UPDATE`,
        [recordingId, identity.sub],
      );
      const session = sessionProjection(sessionResult.rows[0]);
      if (!session) throw recordingAccessDenied();
      const duplicate = await client.query(
        `SELECT id, session_id, seq, object_key, mime_type, byte_size, duration_ms,
                transcribe_state, transcript, flagged_terms, retry_count
           FROM public.sf_recording_segments
          WHERE session_id = $1
            AND seq = $2`,
        [recordingId, seq],
      );
      if (duplicate.rows[0]) {
        return { segment: segmentProjection(duplicate.rows[0]), created: false };
      }
      if (session.state !== 'recording') throw stateConflict();
      if (session.mimeType && session.mimeType !== mimeType) {
        throw new RecordingError(
          'unsupported_audio_format',
          'This audio format is not supported.',
          400,
        );
      }
      const accountedDurationMs = nextAccountedDuration(session, durationMs);
      if (session.segmentCount >= maxSegments || accountedDurationMs > maxRecordingDurationMs) {
        throw lengthLimitError();
      }
      const [bytes, otherDailyUsage] = await Promise.all([
        client.query(
          `SELECT coalesce(sum(byte_size), 0)::bigint AS byte_size
             FROM public.sf_recording_segments
            WHERE session_id = $1`,
          [recordingId],
        ),
        client.query(
          `SELECT coalesce(sum(${accountedDurationSql('session')}), 0)::bigint AS duration_ms
             FROM public.sf_recording_sessions session
            WHERE student_id = $1
              AND id <> $2
              AND created_at >= ${utcDayStartSql()}`,
          [identity.sub, recordingId],
        ),
      ]);
      if (Number(bytes.rows[0]?.byte_size || 0) + byteSize > maxAssetBytes) {
        throw lengthLimitError();
      }
      if (
        Number(otherDailyUsage.rows[0]?.duration_ms || 0)
        + accountedDurationMs
        > dailyLimitMs
      ) {
        throw dailyLimitError();
      }

      let inserted;
      try {
        await persistObject();
        inserted = await client.query(
        `INSERT INTO public.sf_recording_segments (
           session_id, seq, object_key, mime_type, byte_size, duration_ms
         )
         VALUES ($1, $2, $3, $4, $5::bigint, $6)
         RETURNING id, session_id, seq, object_key, mime_type, byte_size, duration_ms,
                   transcribe_state, transcript, flagged_terms, retry_count`,
        [recordingId, seq, objectKey, mimeType, byteSize, durationMs],
      );
        const segment = segmentProjection(inserted.rows[0]);
        await client.query(
        `UPDATE public.sf_recording_sessions
            SET mime_type = coalesce(mime_type, $2),
                total_duration_ms = total_duration_ms + $3,
                segment_count = segment_count + 1,
                last_activity_at = now(),
                updated_at = now()
          WHERE id = $1`,
        [recordingId, mimeType, durationMs],
      );
        await appendAudit(client, {
        action: 'segment_received',
        entityType: 'recording_segment',
        entityId: segment.id,
        surface: 'quick',
        studentId: identity.sub,
        previousValue: null,
        newValue: {
          recordingId,
          seq,
          byteSize,
          durationMs,
        },
        });
        return { segment, created: true };
      } catch (error) {
        // Compensation runs while this transaction still owns the session row
        // lock. A concurrent retry cannot replace the deterministic key before
        // cleanup, preventing deletion of a later committed segment.
        await compensateObject().catch(() => {});
        throw error;
      }
    });
  }

  async function readStatus(identity, recordingId) {
    return withIdentity(identity, async (client) => {
      const sessionResult = await client.query(
        `UPDATE public.sf_recording_sessions
            SET last_activity_at = CASE
                  WHEN state IN ('recording','finishing') THEN now()
                  ELSE last_activity_at
                END,
                updated_at = CASE
                  WHEN state IN ('recording','finishing') THEN now()
                  ELSE updated_at
                END
          WHERE id = $1
            AND student_id = $2
          RETURNING id, student_id, story_id, state, mime_type, total_duration_ms, segment_count,
                    assembled_asset_id, last_activity_at, created_at, updated_at`,
        [recordingId, identity.sub],
      );
      const session = sessionProjection(sessionResult.rows[0]);
      if (!session) throw recordingAccessDenied();
      const segments = await client.query(
        `SELECT id, session_id, seq, object_key, mime_type, byte_size, duration_ms,
                transcribe_state, transcript, flagged_terms, retry_count
           FROM public.sf_recording_segments
          WHERE session_id = $1
          ORDER BY seq`,
        [recordingId],
      );
      return { session, segments: segments.rows.map(segmentProjection) };
    });
  }

  async function finishSession(identity, recordingId, clientDurationMs) {
    return withIdentity(identity, async (client) => {
      const locked = await client.query(
        `SELECT id, student_id, story_id, state, mime_type, total_duration_ms, segment_count,
                assembled_asset_id, last_activity_at, created_at, updated_at
           FROM public.sf_recording_sessions
          WHERE id = $1
            AND student_id = $2
          FOR UPDATE`,
        [recordingId, identity.sub],
      );
      const session = sessionProjection(locked.rows[0]);
      if (!session) throw recordingAccessDenied();
      if (['finishing', 'assembled', 'attached'].includes(session.state)) {
        return { session, transitioned: false };
      }
      if (session.state !== 'recording') throw stateConflict();
      if (clientDurationMs > maxRecordingDurationMs || session.totalDurationMs > maxRecordingDurationMs) {
        throw lengthLimitError();
      }
      const updated = await client.query(
        `UPDATE public.sf_recording_sessions
            SET state = 'finishing',
                last_activity_at = now(),
                updated_at = now()
          WHERE id = $1
          RETURNING id, student_id, story_id, state, mime_type, total_duration_ms, segment_count,
                    assembled_asset_id, last_activity_at, created_at, updated_at`,
        [recordingId],
      );
      const current = sessionProjection(updated.rows[0]);
      await appendAudit(client, {
        action: 'recording_finished',
        entityType: 'recording_session',
        entityId: recordingId,
        surface: 'quick',
        studentId: identity.sub,
        previousValue: { state: 'recording' },
        newValue: { state: 'finishing' },
      });
      return { session: current, transitioned: true };
    });
  }

  async function markAssembled(recordingId, studentId) {
    return withServiceTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE public.sf_recording_sessions
            SET state = 'assembled',
                last_activity_at = now(),
                updated_at = now()
          WHERE id = $1
            AND student_id = $2
            AND state = 'finishing'
          RETURNING id`,
        [recordingId, studentId],
      );
      if (!updated.rows[0]) return false;
      await appendServiceAudit(client, {
        action: 'assembly_completed',
        entityType: 'recording_session',
        entityId: recordingId,
        studentId,
        previousValue: { state: 'finishing' },
        newValue: { state: 'assembled' },
      });
      return true;
    });
  }

  async function markAssemblyFailed(recordingId, studentId) {
    return withServiceTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE public.sf_recording_sessions
            SET state = 'failed',
                updated_at = now()
          WHERE id = $1
            AND student_id = $2
            AND state = 'finishing'
          RETURNING id`,
        [recordingId, studentId],
      );
      if (!updated.rows[0]) return false;
      await appendServiceAudit(client, {
        action: 'assembly_failed',
        entityType: 'recording_session',
        entityId: recordingId,
        studentId,
        previousValue: { state: 'finishing' },
        newValue: { state: 'failed', errorCategory: 'assembly' },
      });
      return true;
    });
  }

  async function cancelSession(identity, recordingId) {
    return withServiceTransaction(async (client) => {
      const locked = await client.query(
        `SELECT id, student_id, state, assembled_asset_id
           FROM public.sf_recording_sessions
          WHERE id = $1
          FOR UPDATE`,
        [recordingId],
      );
      const session = locked.rows[0];
      if (!session || session.student_id !== identity.sub) throw recordingAccessDenied();
      if (session.state === 'cancelled') {
        return {
          state: 'cancelled',
          changed: false,
          objectKeys: [],
          prefix: `storyforge-rec/${identity.sub}/${recordingId}/`,
        };
      }
      if (!['recording', 'finishing', 'failed'].includes(session.state)) throw stateConflict();
      const segments = await client.query(
        `SELECT object_key
           FROM public.sf_recording_segments
          WHERE session_id = $1
          ORDER BY seq
          FOR UPDATE`,
        [recordingId],
      );
      if (session.assembled_asset_id) throw stateConflict();
      await appendServiceAudit(client, {
        action: 'recording_cancelled',
        entityType: 'recording_session',
        entityId: recordingId,
        studentId: identity.sub,
        previousValue: { state: session.state },
        newValue: { state: 'cancelled' },
      });
      await client.query(
        `DELETE FROM public.sf_recording_segments
          WHERE session_id = $1`,
        [recordingId],
      );
      await client.query(
        `UPDATE public.sf_recording_sessions
            SET state = 'cancelled',
                updated_at = now()
          WHERE id = $1`,
        [recordingId],
      );
      return {
        state: 'cancelled',
        changed: true,
        objectKeys: segments.rows.map((row) => row.object_key),
        prefix: `storyforge-rec/${identity.sub}/${recordingId}/`,
      };
    });
  }

  async function attachedStory(client, session, studentId) {
    const story = await client.query(
      'SELECT * FROM public.sf_stories WHERE id = $1 AND student_id = $2',
      [session.story_id, studentId],
    );
    const asset = await client.query(
      `SELECT id, story_id, student_id, object_key, content_type, state
         FROM public.sf_audio_assets
        WHERE id = $1 AND student_id = $2`,
      [session.assembled_asset_id, studentId],
    );
    if (!story.rows[0] || !asset.rows[0]) throw stateConflict();
    return {
      story: story.rows[0],
      attachment: {
        assetId: asset.rows[0].id,
        recordingId: session.id,
        studentId,
        storyId: story.rows[0].id,
        objectKey: asset.rows[0].object_key,
        contentType: asset.rows[0].content_type,
        segmentCount: Number(session.segment_count || 0),
        state: asset.rows[0].state,
      },
      created: false,
    };
  }

  async function attachRecording(identity, recordingId, body) {
    const attach = () => withIdentity(identity, async (client) => {
      const locked = await client.query(
        `SELECT id, student_id, story_id, state, mime_type, total_duration_ms,
                segment_count, assembled_asset_id, created_at, updated_at
           FROM public.sf_recording_sessions
          WHERE id = $1
            AND student_id = $2
          FOR UPDATE`,
        [recordingId, identity.sub],
      );
      const session = locked.rows[0];
      if (!session) throw recordingAccessDenied();
      if (session.state === 'attached') {
        return attachedStory(client, session, identity.sub);
      }
      if (session.state === 'finishing') {
        const error = new RecordingError(
          'voice_assembly_pending',
          'Your recording is still being prepared.',
          409,
        );
        error.retryAfterMs = 2_000;
        throw error;
      }
      if (session.state !== 'assembled') throw stateConflict();

      const payload = {
        ...body,
        captureType: 'audio',
      };
      const providerOriginal = await client.query(
        `SELECT string_agg(segment.transcript, ' ' ORDER BY segment.seq) AS transcript,
                count(*)::integer AS segment_count
           FROM public.sf_recording_segments segment
          WHERE segment.session_id = $1
            AND segment.transcribe_state = 'transcribed'
         HAVING count(*) = $2`,
        [recordingId, Number(session.segment_count || 0)],
      );
      if (
        !providerOriginal.rows[0]
        || typeof providerOriginal.rows[0].transcript !== 'string'
      ) {
        throw new RecordingError(
          'state_conflict',
          'Recording session is not in a compatible state.',
          409,
        );
      }
      const originalTranscript = providerOriginal.rows[0].transcript;
      const created = await client.query(
        'SELECT * FROM public.sf_create_story_v5($1::jsonb, $2)',
        [JSON.stringify({ ...payload, text: originalTranscript }), body.surface || 'quick'],
      );
      let story = created.rows[0];
      const attached = await client.query(
        'SELECT * FROM public.sf_attach_recording($1, $2, $3)',
        [story.id, recordingId, session.mime_type],
      );
      if (body.text !== originalTranscript) {
        const edited = await client.query(
          'SELECT * FROM public.sf_update_story_v5($1, $2::jsonb, $3, $4)',
          [
            story.id,
            JSON.stringify({ text: body.text }),
            story.row_version,
            body.surface || 'quick',
          ],
        );
        story = edited.rows[0];
      }
      const asset = attached.rows[0];
      return {
        story,
        attachment: {
          assetId: asset.asset_id,
          recordingId,
          studentId: identity.sub,
          storyId: story.id,
          objectKey: asset.target_object_key,
          contentType: session.mime_type,
          segmentCount: Number(session.segment_count || 0),
          state: 'pending',
        },
        created: true,
      };
    });

    try {
      return await attach();
    } catch (error) {
      if (
        error?.code === '42501'
        && /recording already attached elsewhere/i.test(String(error?.message || ''))
      ) {
        return withIdentity(identity, async (client) => {
          const result = await client.query(
            `SELECT id, student_id, story_id, state, segment_count, assembled_asset_id
               FROM public.sf_recording_sessions
              WHERE id = $1
                AND student_id = $2`,
            [recordingId, identity.sub],
          );
          const session = result.rows[0];
          if (!session || session.state !== 'attached') throw recordingAccessDenied();
          return attachedStory(client, session, identity.sub);
        });
      }
      if (error?.code === 'P0002') {
        throw new RecordingError('not_found', 'The recording or story was not found.', 404);
      }
      if (error?.code === '23514') throw stateConflict();
      if (error?.code === '22023') {
        throw new RecordingError('invalid_request', 'The recording could not be attached.', 400);
      }
      if (error?.code === '42501') throw recordingAccessDenied();
      throw error;
    }
  }

  async function attachVersionRecording(identity, recordingId, storyId) {
    return withIdentity(identity, async (client) => {
      const locked = await client.query(
        `SELECT id,student_id,story_id,state,mime_type,total_duration_ms,segment_count,assembled_asset_id
           FROM public.sf_recording_sessions
          WHERE id=$1 AND student_id=$2 FOR UPDATE`,
        [recordingId, identity.sub],
      );
      const session = locked.rows[0];
      if (!session) throw recordingAccessDenied();
      if (!['assembled', 'attached'].includes(session.state)) {
        if (session.state === 'finishing') {
          const error = new RecordingError('voice_assembly_pending', 'Your recording is still being prepared.', 409);
          error.retryAfterMs = 2_000;
          throw error;
        }
        throw stateConflict();
      }
      const transcript = await client.query(
        `SELECT string_agg(segment.transcript,' ' ORDER BY segment.seq) AS transcript,
                count(*)::integer AS segment_count
           FROM public.sf_recording_segments segment
          WHERE segment.session_id=$1 AND segment.transcribe_state='transcribed'
         HAVING count(*)=$2`,
        [recordingId, Number(session.segment_count || 0)],
      );
      if (typeof transcript.rows[0]?.transcript !== 'string') throw stateConflict();
      let attachment;
      if (session.state === 'attached') {
        if (session.story_id !== storyId) throw recordingAccessDenied();
        attachment = (await attachedStory(client, session, identity.sub)).attachment;
      } else {
        const attached = await client.query('SELECT * FROM public.sf_attach_version_recording($1,$2,$3)', [storyId, recordingId, session.mime_type]);
        const asset = attached.rows[0];
        attachment = {
          assetId: asset.asset_id,
          recordingId,
          studentId: identity.sub,
          storyId,
          objectKey: asset.target_object_key,
          contentType: session.mime_type,
          segmentCount: Number(session.segment_count || 0),
          state: 'pending',
        };
      }
      return { transcript: transcript.rows[0].transcript, attachment };
    });
  }

  async function retryCandidates(identity, recordingId, requestedSeq) {
    return withIdentity(identity, async (client) => {
      const sessionResult = await client.query(
        `SELECT id, student_id, state, created_at, updated_at
           FROM public.sf_recording_sessions
          WHERE id = $1
            AND student_id = $2`,
        [recordingId, identity.sub],
      );
      if (!sessionResult.rows[0]) throw recordingAccessDenied();
      if (!['recording', 'finishing', 'assembled'].includes(sessionResult.rows[0].state)) {
        throw stateConflict();
      }
      const params = [recordingId];
      const seqFilter = requestedSeq == null ? '' : 'AND seq = $2';
      if (requestedSeq != null) params.push(requestedSeq);
      const result = await client.query(
        `SELECT id, session_id, seq, object_key, mime_type, byte_size, duration_ms,
                transcribe_state, transcript, flagged_terms, retry_count
           FROM public.sf_recording_segments
          WHERE session_id = $1
            ${seqFilter}
          ORDER BY seq`,
        params,
      );
      return result.rows.map(segmentProjection);
    });
  }

  async function claimTranscription(recordingId, seq) {
    return withServiceTransaction(async (client) => {
      const result = await client.query(
        `SELECT segment.id, segment.session_id, segment.seq, segment.object_key,
                segment.mime_type, segment.retry_count, segment.transcribe_state,
                session.student_id, session.state
           FROM public.sf_recording_segments segment
           JOIN public.sf_recording_sessions session ON session.id = segment.session_id
          WHERE segment.session_id = $1
            AND segment.seq = $2
          FOR UPDATE OF segment`,
        [recordingId, seq],
      );
      const row = result.rows[0];
      if (
        !row
        || !['recording', 'finishing', 'assembled'].includes(row.state)
        || !['received', 'transcribe_failed'].includes(row.transcribe_state)
        || Number(row.retry_count) >= 3
      ) {
        return null;
      }
      const claimed = await client.query(
        `UPDATE public.sf_recording_segments
            SET transcribe_state = 'transcribing',
                updated_at = now()
          WHERE id = $1
            AND transcribe_state IN ('received','transcribe_failed')
          RETURNING id`,
        [row.id],
      );
      if (!claimed.rows[0]) return null;
      const context = await client.query(
        `SELECT
           coalesce((
             SELECT transcript
               FROM public.sf_recording_segments previous
              WHERE previous.session_id = $1
                AND previous.seq < $2
                AND previous.transcribe_state = 'transcribed'
              ORDER BY previous.seq DESC
              LIMIT 1
           ), '') AS prompt_tail`,
        [recordingId, seq],
      );
      return {
        id: row.id,
        recordingId,
        seq: Number(row.seq),
        objectKey: row.object_key,
        mimeType: row.mime_type,
        studentId: row.student_id,
        retryCount: Number(row.retry_count),
        promptTail: String(context.rows[0]?.prompt_tail || '').slice(-200),
      };
    });
  }

  async function completeTranscription(claim, result) {
    return withServiceTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE public.sf_recording_segments
            SET transcribe_state = 'transcribed',
                transcript = $2,
                flagged_terms = $3::jsonb,
                updated_at = now()
          WHERE id = $1
            AND transcribe_state = 'transcribing'
          RETURNING id`,
        [claim.id, result.text, JSON.stringify(result.flaggedTerms)],
      );
      if (!updated.rows[0]) return false;
      await client.query(
        `UPDATE public.sf_recording_sessions
            SET provider_id = coalesce($2, provider_id),
                model_id = coalesce($3, model_id),
                updated_at = now()
          WHERE id = $1`,
        [claim.recordingId, result.providerId || null, result.modelId || null],
      );
      await appendServiceAudit(client, {
        action: 'segment_transcribed',
        entityType: 'recording_segment',
        entityId: claim.id,
        studentId: claim.studentId,
        previousValue: { transcribeState: 'transcribing' },
        newValue: {
          recordingId: claim.recordingId,
          seq: claim.seq,
          transcribeState: 'transcribed',
          latencyMs: result.latencyMs,
          ...(result.providerId ? { provider: result.providerId } : {}),
          ...(result.modelId ? { model: result.modelId } : {}),
        },
      });
      return true;
    });
  }

  async function failTranscription(claim, code) {
    return withServiceTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE public.sf_recording_segments
            SET transcribe_state = 'transcribe_failed',
                retry_count = least(retry_count + 1, 3),
                updated_at = now()
          WHERE id = $1
            AND transcribe_state = 'transcribing'
          RETURNING retry_count`,
        [claim.id],
      );
      if (!updated.rows[0]) return null;
      await appendServiceAudit(client, {
        action: 'segment_transcribe_failed',
        entityType: 'recording_segment',
        entityId: claim.id,
        studentId: claim.studentId,
        previousValue: { transcribeState: 'transcribing' },
        newValue: {
          recordingId: claim.recordingId,
          seq: claim.seq,
          transcribeState: 'transcribe_failed',
          retryCount: Number(updated.rows[0].retry_count),
          errorCategory: 'transcribe',
          code,
        },
      });
      return Number(updated.rows[0].retry_count);
    });
  }

  async function deleteAudio(identity, assetId) {
    return withIdentity(identity, async (client) => {
      const result = await client.query(
        'SELECT * FROM public.sf_retire_story_audio($1)',
        [assetId],
      );
      const retired = result.rows[0];
      if (!retired) throw new RecordingError('audio_not_found', 'Audio asset not found.', 404);
      return {
        state: 'retired',
        changed: retired.changed === true,
        objectKey: retired.object_key,
        storyId: retired.story_id,
      };
    });
  }

  async function sweepCandidates(limit = 50) {
    return withServiceTransaction(async (client) => {
      const result = await client.query(
        'SELECT * FROM public.sf_voice_sweep_candidates($1)',
        [limit],
      );
      return result.rows.map((row) => ({
        recordingId: row.session_id,
        studentId: row.student_id,
        state: row.state,
        reason: row.reason,
      }));
    });
  }

  async function sweepSession(candidate) {
    return withServiceTransaction(async (client) => {
      const before = await client.query(
        `SELECT state,
                (SELECT count(*)::integer
                   FROM public.sf_recording_segments
                  WHERE session_id = $1) AS segment_count
           FROM public.sf_recording_sessions
          WHERE id = $1`,
        [candidate.recordingId],
      );
      const result = await client.query(
        'SELECT * FROM public.sf_voice_sweep_purge($1, $2)',
        [candidate.recordingId, candidate.reason],
      );
      const state = await client.query(
        `SELECT state,
                EXISTS (
                  SELECT 1 FROM public.sf_recording_segments
                  WHERE session_id = $1
                ) AS has_segments
           FROM public.sf_recording_sessions
          WHERE id = $1`,
        [candidate.recordingId],
      );
      const previousState = before.rows[0]?.state;
      const previousSegmentCount = Number(before.rows[0]?.segment_count || 0);
      const currentState = state.rows[0]?.state;
      const hasSegments = state.rows[0]?.has_segments === true;
      return {
        changed: currentState === 'failed' && (
          result.rows.length > 0
          || previousState !== currentState
          || (previousSegmentCount > 0 && !hasSegments)
        ),
        objectKeys: result.rows.map((row) => row.object_key),
        prefix: `storyforge-rec/${candidate.studentId}/${candidate.recordingId}/`,
      };
    });
  }

  async function pendingAudioAssets(limit = 20) {
    return withServiceTransaction(async (client) => {
      const result = await client.query(
        `SELECT candidate.*, session.segment_count
           FROM public.sf_voice_asset_pending_candidates($1) candidate
           JOIN public.sf_recording_sessions session
             ON session.id = candidate.session_id`,
        [limit],
      );
      return result.rows.map((row) => ({
        assetId: row.asset_id,
        recordingId: row.session_id,
        studentId: row.student_id,
        storyId: row.story_id,
        objectKey: row.object_key,
        contentType: row.content_type,
        segmentCount: Number(row.segment_count),
        pendingMinutes: Number(row.pending_minutes),
      }));
    });
  }

  async function markAudioVerified(assetId, byteSize, checksumSha256) {
    return withServiceTransaction(async (client) => {
      const result = await client.query(
        'SELECT * FROM public.sf_voice_asset_mark_verified($1, $2::bigint, $3)',
        [assetId, byteSize, checksumSha256],
      );
      return result.rows.map((row) => row.object_key);
    });
  }

  async function markAudioFailed(assetId) {
    return withServiceTransaction(async (client) => {
      const result = await client.query(
        'SELECT * FROM public.sf_voice_asset_mark_failed($1)',
        [assetId],
      );
      return result.rows.map((row) => row.object_key);
    });
  }

  async function claimVersionAudioCleanup(limit = 20) {
    return withServiceTransaction(async (client) => {
      const result = await client.query(
        'SELECT * FROM public.sf_claim_version_audio_cleanup($1)',
        [limit],
      );
      return result.rows.map((row) => ({
        intentId: row.intent_id,
        assetId: row.asset_id,
        objectKey: row.object_key,
        contentType: row.content_type,
        segmentCount: Number(row.segment_count || 0),
      }));
    });
  }

  async function completeVersionAudioCleanup(intentId, succeeded, errorCategory = null) {
    return withServiceTransaction(async (client) => {
      await client.query(
        'SELECT public.sf_complete_version_audio_cleanup($1,$2,$3)',
        [intentId, succeeded === true, errorCategory],
      );
      return true;
    });
  }

  async function checkAudioReferences(objectKeys) {
    return withServiceTransaction(async (client) => {
      const result = await client.query(
        'SELECT * FROM public.sf_voice_audio_reference_check($1::text[])',
        [objectKeys],
      );
      return result.rows.map((row) => ({
        objectKey: row.object_key,
        referenced: row.referenced,
      }));
    });
  }

  async function readAudioManifest(assetId) {
    return withServiceTransaction(async (client) => {
      const result = await client.query(
        `SELECT rs.segment_count
           FROM public.sf_recording_sessions rs
          WHERE rs.assembled_asset_id = $1`,
        [assetId],
      );
      return result.rows[0]
        ? { segmentCount: Number(result.rows[0].segment_count || 0) }
        : null;
    });
  }

  async function recordObjectDeleteRetry({
    entityType,
    entityId,
    studentId,
    storyId = null,
    objectCount,
  }) {
    return withServiceTransaction((client) => appendServiceAudit(client, {
      action: 'object_delete_retried',
      entityType,
      entityId,
      studentId,
      storyId,
      previousValue: null,
      newValue: { objectCount, retryCount: 1 },
    }));
  }

  async function recordReconciliationDeleted({
    entityId,
    studentId,
    storyId,
    objectCount,
    byteSize,
  }) {
    return withServiceTransaction((client) => appendServiceAudit(client, {
      action: 'reconciliation_deleted',
      entityType: 'audio_asset',
      entityId,
      studentId,
      storyId,
      previousValue: null,
      newValue: { objectCount, byteSize },
    }));
  }

  async function recordProviderFailover({ recordingId, studentId }) {
    return withServiceTransaction((client) => appendServiceAudit(client, {
      action: 'provider_failover',
      entityType: 'recording_session',
      entityId: recordingId,
      studentId,
      previousValue: null,
      newValue: null,
    }));
  }

  async function pendingTranscriptions() {
    return withServiceTransaction(async (client) => {
      const stale = await client.query(
        `UPDATE public.sf_recording_segments segment
            SET transcribe_state = 'transcribe_failed',
                retry_count = least(segment.retry_count + 1, 3),
                updated_at = now()
           FROM public.sf_recording_sessions session
          WHERE session.id = segment.session_id
            AND session.state IN ('recording','finishing','assembled')
            AND segment.transcribe_state = 'transcribing'
            AND segment.updated_at < now() - interval '5 minutes'
          RETURNING segment.id, segment.session_id, segment.seq,
                    segment.retry_count, session.student_id`,
      );
      for (const row of stale.rows) {
        await appendServiceAudit(client, {
          action: 'segment_transcribe_failed',
          entityType: 'recording_segment',
          entityId: row.id,
          studentId: row.student_id,
          previousValue: { transcribeState: 'transcribing' },
          newValue: {
            recordingId: row.session_id,
            seq: Number(row.seq),
            transcribeState: 'transcribe_failed',
            retryCount: Number(row.retry_count),
            errorCategory: 'transcribe',
            code: 'transcribe_interrupted',
          },
        });
      }
      const result = await client.query(
        `SELECT segment.session_id, segment.seq, segment.retry_count
           FROM public.sf_recording_segments segment
           JOIN public.sf_recording_sessions session ON session.id = segment.session_id
          WHERE session.state IN ('recording','finishing','assembled')
            AND segment.transcribe_state IN ('received','transcribe_failed')
            AND segment.retry_count < 3
          ORDER BY segment.session_id, segment.seq`,
      );
      return result.rows.map((row) => ({
        recordingId: row.session_id,
        seq: Number(row.seq),
        retryCount: Number(row.retry_count),
      }));
    });
  }

  async function pendingAssemblies() {
    return withServiceTransaction(async (client) => {
      const result = await client.query(
        `SELECT id, student_id
           FROM public.sf_recording_sessions
          WHERE state = 'finishing'
          ORDER BY updated_at`,
      );
      return result.rows.map((row) => ({
        recordingId: row.id,
        studentId: row.student_id,
      }));
    });
  }

  return Object.freeze({
    acceptSegment,
    attachRecording,
    attachVersionRecording,
    auditRecordingDenial,
    checkAudioReferences,
    claimVersionAudioCleanup,
    cancelSession,
    claimTranscription,
    completeTranscription,
    completeVersionAudioCleanup,
    deleteAudio,
    failTranscription,
    findActiveSession,
    finishSession,
    markAssembled,
    markAssemblyFailed,
    markAudioFailed,
    markAudioVerified,
    openSession,
    pendingAssemblies,
    pendingAudioAssets,
    pendingTranscriptions,
    readAudioManifest,
    readDraftTitle,
    readOwnedSession,
    readStatus,
    recordObjectDeleteRetry,
    recordReconciliationDeleted,
    recordProviderFailover,
    retryCandidates,
    sweepCandidates,
    sweepSession,
  });
}

function createSessionQueue(runJob) {
  const sessions = new Map();

  function stateFor(recordingId) {
    if (!sessions.has(recordingId)) {
      sessions.set(recordingId, {
        active: 0,
        jobs: [],
        keys: new Set(),
        waiters: [],
      });
    }
    return sessions.get(recordingId);
  }

  function settleIfIdle(recordingId, state) {
    if (state.active || state.jobs.length) return;
    for (const resolve of state.waiters.splice(0)) resolve();
    if (!state.keys.size) sessions.delete(recordingId);
  }

  function drain(recordingId) {
    const state = sessions.get(recordingId);
    if (!state) return;
    // FIFO is intentionally strict so every segment can use the prior final as
    // prompt context. One active call remains within the authority's <= 2 cap.
    while (state.active < 1 && state.jobs.length) {
      const job = state.jobs.shift();
      state.active += 1;
      Promise.resolve()
        .then(() => runJob(job))
        .catch(() => {})
        .finally(() => {
          state.active -= 1;
          state.keys.delete(job.key);
          drain(recordingId);
          settleIfIdle(recordingId, state);
        });
    }
  }

  function enqueue(recordingId, seq, delayMs = 0) {
    const state = stateFor(recordingId);
    const key = `${recordingId}:${seq}`;
    if (state.keys.has(key)) return false;
    state.keys.add(key);
    state.jobs.push({ key, recordingId, seq, delayMs });
    drain(recordingId);
    return true;
  }

  function waitForIdle(recordingId) {
    const state = sessions.get(recordingId);
    if (!state || (!state.active && !state.jobs.length)) return Promise.resolve();
    return new Promise((resolve) => state.waiters.push(resolve));
  }

  return Object.freeze({ enqueue, waitForIdle });
}

export function createRecordingsService({
  store,
  flagService,
  storage,
  transcription,
  assembly,
  emitEvent,
  environment = process.env,
  now = () => new Date(),
  delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  if (!store) throw new TypeError('A production recording store must be supplied.');
  for (const method of [
    'acceptSegment',
    'attachRecording',
    'auditRecordingDenial',
    'cancelSession',
    'checkAudioReferences',
    'claimTranscription',
    'completeTranscription',
    'deleteAudio',
    'failTranscription',
    'finishSession',
    'markAssembled',
    'markAssemblyFailed',
    'markAudioFailed',
    'markAudioVerified',
    'openSession',
    'pendingAssemblies',
    'pendingAudioAssets',
    'pendingTranscriptions',
    'readAudioManifest',
    'readDraftTitle',
    'readOwnedSession',
    'readStatus',
    'recordObjectDeleteRetry',
    'recordReconciliationDeleted',
    'recordProviderFailover',
    'retryCandidates',
    'sweepCandidates',
    'sweepSession',
  ]) {
    requireFunction(store[method], `store.${method}`);
  }
  if (
    !flagService
    || typeof flagService.assertVoiceEnabled !== 'function'
    || typeof flagService.voiceForceOff !== 'function'
  ) {
    throw new TypeError('A production voice flag service must be supplied.');
  }
  const segmentStorage = Object.freeze({
    putSegment: requireFunction(
      storage?.putSegment || storage?.putRecordingSegment,
      'storage.putRecordingSegment',
    ),
    getSegment: requireFunction(
      storage?.getSegment || storage?.getRecordingSegment,
      'storage.getRecordingSegment',
    ),
    deleteObjects: requireFunction(
      storage?.deleteObjects || storage?.deleteRecordingObjects,
      'storage.deleteRecordingObjects',
    ),
    deleteAudioAsset: requireFunction(
      storage?.deleteAudioAsset || storage?.deleteAudioAssetObject,
      'storage.deleteAudioAssetObject',
    ),
    copyAudioObject: storage?.copyAudioObject,
    headAudioObject: storage?.headAudioObject,
    listAudioObjects: storage?.listAudioObjects,
    listAudioObjectsPage: storage?.listAudioObjectsPage,
    readAudioControlObject: storage?.readAudioControlObject,
    writeAudioControlObject: storage?.writeAudioControlObject,
    deleteAudioObject: storage?.deleteAudioObject,
    deleteRecordingPrefix: storage?.deleteRecordingPrefix,
  });
  requireFunction(transcription?.transcribeSegment, 'transcription.transcribeSegment');
  requireFunction(transcription?.keywordsForDraft, 'transcription.keywordsForDraft');
  requireFunction(assembly?.assembleRecording, 'assembly.assembleRecording');
  requireFunction(emitEvent, 'emitEvent');
  requireFunction(delay, 'delay');
  const transcriptionAvailable = transcription.available !== false;
  const assemblyOption = ['A', 'B'].includes(assembly?.option)
    ? assembly.option
    : null;

  const dailyLimitMs = (
    positiveIntegerSetting(
      environment.STORYFORGE_VOICE_DAILY_MINUTES,
      defaultDailyMinutes,
      { min: 1, max: 1_440 },
    ) * 60 * 1000
  );

  function emit(event, fields = {}) {
    const safe = {
      t: now().toISOString(),
      event,
    };
    for (const key of [
      'recordingId',
      'assetId',
      'storyId',
      'studentId',
      'jobSeq',
      'latencyMs',
      'errorCategory',
      'providerLatencyBucket',
      ...usageMetricNames,
    ]) {
      if (fields[key] !== undefined && fields[key] !== null) safe[key] = fields[key];
    }
    emitEvent(Object.freeze(safe));
  }

  function releaseTranscriptionSession(recordingId) {
    if (typeof transcription.releaseSession === 'function') {
      transcription.releaseSession(recordingId);
    }
  }

  function releaseTranscriptionSessionWhenIdle(recordingId) {
    queue.waitForIdle(recordingId)
      .then(() => {
        if (
          typeof transcription.hasPendingFailover === 'function'
          && transcription.hasPendingFailover(recordingId)
        ) {
          return;
        }
        releaseTranscriptionSession(recordingId);
      })
      .catch(() => {});
  }

  async function persistPendingProviderFailover(claim) {
    if (
      typeof transcription.hasPendingFailover !== 'function'
      || typeof transcription.acknowledgeFailover !== 'function'
      || !transcription.hasPendingFailover(claim.recordingId)
    ) {
      return false;
    }
    await store.recordProviderFailover(claim);
    transcription.acknowledgeFailover(claim.recordingId);
    return true;
  }

  function recordingPrefix(studentId, recordingId) {
    return `storyforge-rec/${studentId}/${recordingId}/`;
  }

  function requireFinalizationStorage() {
    for (const [name, method] of [
      ['storage.copyAudioObject', segmentStorage.copyAudioObject],
      ['storage.headAudioObject', segmentStorage.headAudioObject],
      ['storage.deleteRecordingPrefix', segmentStorage.deleteRecordingPrefix],
    ]) {
      requireFunction(method, name);
    }
  }

  async function afterCommitDelete({
    operation,
    entityType,
    entityId,
    studentId,
    storyId = null,
    objectCount,
  }) {
    try {
      await operation();
      return { retried: false, deleted: true };
    } catch {
      let deleted = false;
      try {
        await operation();
        deleted = true;
      } catch {
        deleted = false;
      }
      await store.recordObjectDeleteRetry({
        entityType,
        entityId,
        studentId,
        storyId,
        objectCount: Math.max(0, Number(objectCount) || 0),
      });
      return { retried: true, deleted };
    }
  }

  async function deleteRecordingTemp({
    recordingId,
    studentId,
    storyId = null,
    objectKeys = [],
    entityType = 'recording_session',
    entityId = recordingId,
  }) {
    const prefix = recordingPrefix(studentId, recordingId);
    const operation = typeof segmentStorage.deleteRecordingPrefix === 'function'
      ? () => segmentStorage.deleteRecordingPrefix({ prefix })
      : () => segmentStorage.deleteObjects({ objectKeys });
    return afterCommitDelete({
      operation,
      entityType,
      entityId,
      studentId,
      storyId,
      objectCount: objectKeys.length,
    });
  }

  async function withAuditedRecordingAccess(identity, recordingId, surface, operation) {
    try {
      return await operation();
    } catch (error) {
      if (error?.code === 'recording_access_denied') {
        await store.auditRecordingDenial(identity, recordingId, surface);
        emit('unauthorized_denied', {
          recordingId,
          studentId: identity.sub,
          errorCategory: 'auth',
        });
      }
      throw error;
    }
  }

  async function runTranscription(job) {
    if (!transcriptionAvailable) return;
    if (job.delayMs > 0) await delay(job.delayMs);
    if (flagService.voiceForceOff()) return;
    const claim = await store.claimTranscription(job.recordingId, job.seq);
    if (!claim) return;
    const startedAt = now().getTime();
    let raw;
    try {
      const body = normalizeBytes(
        await segmentStorage.getSegment({ objectKey: claim.objectKey }),
      );
      const draftTitle = await store.readDraftTitle(claim.studentId);
      const keywords = await transcription.keywordsForDraft({ draftTitle });
      raw = await transcription.transcribeSegment({
        recordingId: claim.recordingId,
        studentId: claim.studentId,
        buffer: body,
        mimeType: claim.mimeType,
        seq: claim.seq,
        keywords,
        promptTail: claim.promptTail,
        languageHint: 'en',
      });
    } catch (error) {
      await persistPendingProviderFailover(claim);
      const code = safeTranscriptionCode(error);
      await store.failTranscription(claim, code);
      emit('segment_transcribe_failed', {
        recordingId: claim.recordingId,
        studentId: claim.studentId,
        jobSeq: claim.seq,
        errorCategory: 'transcribe',
      });
      return;
    }
    await persistPendingProviderFailover(claim);
    const text = String(raw?.text ?? '');
    const latencyMs = Number.isFinite(Number(raw?.latencyMs))
      ? Math.max(0, Math.round(Number(raw.latencyMs)))
      : Math.max(0, now().getTime() - startedAt);
    const result = {
      text,
      flaggedTerms: normalizeFlaggedTerms(raw?.flaggedTerms),
      providerId: raw?.providerId ? String(raw.providerId) : null,
      modelId: raw?.modelId ? String(raw.modelId) : null,
      latencyMs,
    };
    if (await store.completeTranscription(claim, result)) {
      emit('segment_transcribed', {
        recordingId: claim.recordingId,
        studentId: claim.studentId,
        jobSeq: claim.seq,
        latencyMs,
        ...contentFreeUsage(raw?.usage),
      });
    }
  }

  const queue = createSessionQueue(runTranscription);
  const assemblyJobs = new Set();

  async function createRecording(identity) {
    assertStudent(identity);
    await flagService.assertVoiceEnabled(identity);
    const opened = await store.openSession(identity, dailyLimitMs);
    if (opened.created) {
      emit('recording_started', {
        recordingId: opened.session.id,
        studentId: identity.sub,
      });
    }
    return {
      recordingId: opened.session.id,
      segmentPlanMs: [...segmentPlanMs],
      caps: {
        maxDurationMs: maxRecordingDurationMs,
        maxSegments,
        maxSegmentBytes,
        dailyMinutes: dailyLimitMs / 60_000,
      },
      created: opened.created,
    };
  }

  async function addSegment(identity, recordingIdValue, input) {
    assertStudent(identity);
    const recordingId = safeUuid(recordingIdValue);
    const session = await withAuditedRecordingAccess(
      identity,
      recordingId,
      'quick',
      async () => {
        const owned = await store.readOwnedSession(identity, recordingId);
        if (!owned) throw recordingAccessDenied();
        return owned;
      },
    );
    await flagService.assertVoiceEnabled(identity, { allowGrace: true, session });
    const seq = integer(input?.seq, 'invalid_segment_sequence', 'Segment sequence is invalid.', {
      min: 0,
      max: maxSegments - 1,
    });
    const mimeType = normalizeMimeType(input?.mimeType);
    const durationMs = integer(
      input?.durationMs,
      'invalid_segment_duration',
      'Segment duration is invalid.',
      { min: 1, max: 60_000 },
    );
    const body = normalizeBytes(input?.buffer);
    const objectKey = `storyforge-rec/${identity.sub}/${recordingId}/seg-${String(seq).padStart(5, '0')}.${mimeExtensions[mimeType]}`;
    const accepted = await store.acceptSegment({
      identity,
      recordingId,
      seq,
      objectKey,
      mimeType,
      byteSize: body.byteLength,
      durationMs,
      dailyLimitMs,
      persistObject: async () => {
        await segmentStorage.putSegment({
          objectKey,
          contentType: mimeType,
          body,
          byteSize: body.byteLength,
        });
      },
      compensateObject: () => segmentStorage.deleteObjects({ objectKeys: [objectKey] }),
    });
    if (accepted.created) {
      if (transcriptionAvailable) queue.enqueue(recordingId, seq);
      emit('segment_received', {
        recordingId,
        studentId: identity.sub,
        jobSeq: seq,
      });
    }
    return {
      seq,
      state: accepted.segment.transcribeState,
      created: accepted.created,
    };
  }

  async function getRecording(identity, recordingIdValue) {
    assertStudent(identity);
    const recordingId = safeUuid(recordingIdValue);
    await flagService.assertVoiceEnabled(identity);
    const { session, segments } = await withAuditedRecordingAccess(
      identity,
      recordingId,
      'quick',
      () => store.readStatus(identity, recordingId),
    );
    return {
      state: session.state,
      transcriptionAvailable,
      segments: segments.map((segment) => ({
        seq: segment.seq,
        transcribeState: segment.transcribeState,
        transcript: segment.transcript,
        flaggedTerms: segment.flaggedTerms,
      })),
      fullText: segments
        .filter((segment) => segment.transcribeState === 'transcribed')
        .map((segment) => segment.transcript.trim())
        .filter(Boolean)
        .join(' '),
      totalDurationMs: session.totalDurationMs,
      assembled: Boolean(session.assembledAssetId)
        || ['assembled', 'attached'].includes(session.state),
    };
  }

  function beginAssembly(session, identity) {
    if (assemblyJobs.has(session.id)) return false;
    assemblyJobs.add(session.id);
    Promise.resolve()
      .then(() => assembly.assembleRecording({
        recordingId: session.id,
        studentId: identity.sub,
      }))
      .then(async () => {
        if (await store.markAssembled(session.id, identity.sub)) {
          emit('assembly_completed', {
            recordingId: session.id,
            studentId: identity.sub,
          });
        }
      })
      .catch(async () => {
        if (await store.markAssemblyFailed(session.id, identity.sub)) {
          emit('assembly_failed', {
            recordingId: session.id,
            studentId: identity.sub,
            errorCategory: 'assembly',
          });
        }
      })
      .finally(() => assemblyJobs.delete(session.id))
      .catch(() => {});
    return true;
  }

  async function finishRecording(identity, recordingIdValue, input = {}) {
    assertStudent(identity);
    const recordingId = safeUuid(recordingIdValue);
    const session = await withAuditedRecordingAccess(
      identity,
      recordingId,
      'quick',
      async () => {
        const owned = await store.readOwnedSession(identity, recordingId);
        if (!owned) throw recordingAccessDenied();
        return owned;
      },
    );
    await flagService.assertVoiceEnabled(identity, { allowGrace: true, session });
    const clientDurationMs = integer(
      input.clientDurationMs,
      'invalid_recording_duration',
      'Recording duration is invalid.',
      { min: 0, max: maxRecordingDurationMs },
    );
    if (assembly.available === false) {
      await assembly.assembleRecording({
        recordingId,
        studentId: identity.sub,
      });
      throw new RecordingError(
        'assembly_authority_blocked',
        'Recording assembly is unavailable.',
        503,
      );
    }
    if (transcriptionAvailable) {
      await queue.waitForIdle(recordingId);
      const status = await withAuditedRecordingAccess(
        identity,
        recordingId,
        'quick',
        () => store.readStatus(identity, recordingId),
      );
      const segmentStates = status.segments.map((segment) => segment.transcribeState);
      const incomplete = (
        status.session.segmentCount > status.segments.length
        || segmentStates.some((state) => state !== 'transcribed')
      );
      if (incomplete) {
        if (segmentStates.some((state) => String(state).includes('failed'))) {
          throw new RecordingError(
            'transcribe_unavailable',
            'Transcription is currently unavailable.',
            503,
          );
        }
        throw new RecordingError(
          'voice_assembly_pending',
          'Your recording is still being prepared.',
          409,
        );
      }
    }
    const finished = await store.finishSession(identity, recordingId, clientDurationMs);
    if (finished.transitioned || finished.session.state === 'finishing') {
      beginAssembly(finished.session, identity);
    }
    if (finished.transitioned) {
      emit('recording_finished', { recordingId, studentId: identity.sub });
    }
    if (['finishing', 'assembled', 'attached'].includes(finished.session.state)) {
      releaseTranscriptionSessionWhenIdle(recordingId);
    }
    return {
      state: finished.session.state,
      ...(finished.session.assembledAssetId
        ? { assetId: finished.session.assembledAssetId }
        : {}),
    };
  }

  async function cancelRecording(identity, recordingIdValue) {
    assertStudent(identity);
    const recordingId = safeUuid(recordingIdValue);
    await flagService.assertVoiceEnabled(identity);
    const result = await withAuditedRecordingAccess(
      identity,
      recordingId,
      'quick',
      () => store.cancelSession(identity, recordingId),
    );
    if (result.changed) {
      await deleteRecordingTemp({
        recordingId,
        studentId: identity.sub,
        objectKeys: result.objectKeys,
      });
      emit('recording_cancelled', { recordingId, studentId: identity.sub });
      releaseTranscriptionSession(recordingId);
    }
    return { state: result.state };
  }

  async function retryTranscription(identity, recordingIdValue, input = {}) {
    assertStudent(identity);
    const recordingId = safeUuid(recordingIdValue);
    await flagService.assertVoiceEnabled(identity);
    const seq = input.seq == null
      ? null
      : integer(input.seq, 'invalid_segment_sequence', 'Segment sequence is invalid.', {
        min: 0,
        max: maxSegments - 1,
      });
    const segments = await withAuditedRecordingAccess(
      identity,
      recordingId,
      'quick',
      async () => {
        const candidates = await store.retryCandidates(identity, recordingId, seq);
        if (seq != null && candidates.length === 0) throw recordingAccessDenied();
        return candidates;
      },
    );
    for (const segment of segments) {
      if (
        ['received', 'transcribe_failed'].includes(segment.transcribeState)
        && segment.retryCount < 3
      ) {
        const delayMs = retryDelaysMs[Math.min(segment.retryCount, retryDelaysMs.length - 1)];
        if (transcriptionAvailable) queue.enqueue(recordingId, segment.seq, delayMs);
      }
    }
    return {
      transcriptionAvailable,
      segments: segments.map((segment) => ({
        seq: segment.seq,
        transcribeState: segment.transcribeState,
        retryCount: segment.retryCount,
      })),
    };
  }

  async function deleteAudio(identity, assetIdValue) {
    assertStudent(identity);
    const assetId = safeUuid(assetIdValue);
    const result = await store.deleteAudio(identity, assetId);
    if (result.changed) {
      await afterCommitDelete({
        operation: () => segmentStorage.deleteAudioAsset({
          asset: { objectKey: result.objectKey },
        }),
        entityType: 'audio_asset',
        entityId: assetId,
        studentId: identity.sub,
        storyId: result.storyId,
        objectCount: 1,
      });
      emit('audio_deleted', {
        assetId,
        storyId: result.storyId,
        studentId: identity.sub,
      });
    }
    return { state: result.state };
  }

  async function runSweeps() {
    const candidates = await store.sweepCandidates();
    let cleaned = 0;
    const failures = [];
    for (const candidate of candidates) {
      try {
        const result = await store.sweepSession(candidate);
        if (result.changed) {
          await deleteRecordingTemp({
            recordingId: candidate.recordingId,
            studentId: candidate.studentId,
            objectKeys: result.objectKeys,
          });
          cleaned += 1;
          emit('sweep_cleaned', { recordingId: candidate.recordingId });
          releaseTranscriptionSession(candidate.recordingId);
        }
      } catch {
        failures.push(candidate.recordingId);
      }
    }
    return { scanned: candidates.length, cleaned, failures };
  }

  function audioReconciliationResult(mode = 'off') {
    return {
      mode,
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
    };
  }

  function emitAudioReconciliation(result) {
    try {
      emitEvent(Object.freeze({
        t: now().toISOString(),
        event: 'audio_reconciliation',
        mode: result.mode,
        suspended: result.suspended,
        invalidConfig: result.invalidConfig,
        due: result.due,
        aborted: result.aborted,
        abortReason: result.abortReason,
        listed: result.listed,
        truncated: result.truncated,
        candidates: result.candidates,
        referenced: result.referenced,
        preserved: result.preserved,
        deleted: result.deleted,
        retried: result.retried,
        failed: result.failed,
        wouldDelete: result.wouldDelete,
        markerWriteFailed: result.markerWriteFailed,
      }));
    } catch {
      // Telemetry is evidence, never authority to continue or repeat deletion.
    }
  }

  async function completeAudioReconciliation(result, startedAt) {
    const completedAt = now().toISOString();
    result.completedAt = completedAt;
    const marker = {
      mode: result.mode,
      startedAt,
      completedAt,
      counts: {
        listed: result.listed,
        truncated: result.truncated,
        candidates: result.candidates,
        referenced: result.referenced,
        preserved: result.preserved,
        deleted: result.deleted,
        retried: result.retried,
        failed: result.failed,
      },
      ...(result.aborted ? { aborted: result.abortReason } : {}),
    };
    try {
      await requireFunction(
        segmentStorage.writeAudioControlObject,
        'storage.writeAudioControlObject',
      )({
        objectKey: audioReconciliationControlKey,
        value: marker,
      });
    } catch {
      result.markerWriteFailed = true;
    }
    emitAudioReconciliation(result);
    return result;
  }

  function abortAudioReconciliation(result, reason) {
    result.aborted = true;
    result.abortReason = reason;
    return result;
  }

  async function runWeeklyAudioReconciliation() {
    if (String(environment.STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED ?? '') !== '') {
      const result = audioReconciliationResult();
      result.suspended = true;
      emitAudioReconciliation(result);
      return result;
    }

    const rawMode = String(environment.STORYFORGE_AUDIO_RECONCILIATION ?? '');
    const configuredMode = rawMode === '' ? 'off' : rawMode;
    if (!['off', 'dry_run', 'on'].includes(configuredMode)) {
      const result = audioReconciliationResult();
      result.invalidConfig = true;
      emitAudioReconciliation(result);
      return result;
    }
    const result = audioReconciliationResult(configuredMode);
    if (configuredMode === 'off') return result;

    let marker = null;
    try {
      marker = await requireFunction(
        segmentStorage.readAudioControlObject,
        'storage.readAudioControlObject',
      )({ objectKey: audioReconciliationControlKey });
    } catch {
      marker = null;
    }
    if (marker && typeof marker.completedAt === 'string') {
      const completedAtMs = new Date(marker.completedAt).getTime();
      if (
        Number.isFinite(completedAtMs)
        && now().getTime() - completedAtMs < audioReconciliationCadenceMs
      ) {
        return result;
      }
    }

    result.due = true;
    const startedAt = now().toISOString();
    const listedObjects = [];
    const seenTokens = new Set();
    let continuationToken = null;
    try {
      const listPage = requireFunction(
        segmentStorage.listAudioObjectsPage,
        'storage.listAudioObjectsPage',
      );
      do {
        const maxKeys = Math.min(
          audioReconciliationPageSize,
          audioReconciliationEvaluationCap - listedObjects.length,
        );
        const page = await listPage({
          prefix: audioReconciliationPrefix,
          continuationToken,
          maxKeys,
        });
        if (
          !page
          || !Array.isArray(page.objects)
          || page.objects.length > maxKeys
          || typeof page.truncated !== 'boolean'
        ) {
          throw new Error('invalid_listing_page');
        }
        listedObjects.push(...page.objects);
        const nextToken = page.continuationToken == null
          ? null
          : String(page.continuationToken);
        if (page.truncated !== Boolean(nextToken)) {
          throw new Error('invalid_listing_cursor');
        }
        if (nextToken && seenTokens.has(nextToken)) {
          throw new Error('repeated_listing_cursor');
        }
        if (
          listedObjects.length >= audioReconciliationEvaluationCap
          && nextToken
        ) {
          result.truncated = true;
          break;
        }
        if (nextToken) seenTokens.add(nextToken);
        continuationToken = nextToken;
      } while (continuationToken);
    } catch {
      result.listed = listedObjects.length;
      abortAudioReconciliation(result, 'list_failed');
      return completeAudioReconciliation(result, startedAt);
    }
    result.listed = listedObjects.length;

    const evaluatedAtMs = now().getTime();
    const candidates = [];
    for (const object of listedObjects) {
      const objectKey = String(object?.objectKey || '');
      if (!objectKey.startsWith(audioReconciliationPrefix)) {
        result.preserved.outsidePrefix += 1;
        continue;
      }
      if (objectKey.startsWith(audioReconciliationControlPrefix)) {
        result.preserved.control += 1;
        continue;
      }
      const modifiedAtMs = new Date(object?.lastModified).getTime();
      const byteSize = object?.byteSize;
      if (
        !object?.lastModified
        || !Number.isFinite(modifiedAtMs)
        || typeof byteSize !== 'number'
        || !Number.isInteger(byteSize)
        || byteSize < 0
      ) {
        result.preserved.invalidMetadata += 1;
        continue;
      }
      if (evaluatedAtMs - modifiedAtMs <= audioReconciliationAgeMs) {
        result.preserved.notOldEnough += 1;
        continue;
      }
      const identity = parseReconciliationAudioObject(objectKey);
      if (!identity) {
        result.preserved.invalidIdentifier += 1;
        continue;
      }
      candidates.push({
        ...identity,
        byteSize,
      });
    }
    result.candidates = candidates.length;

    let references;
    try {
      references = await checkAudioObjectReferences(
        candidates.map((candidate) => candidate.objectKey),
      );
      if (!Array.isArray(references) || references.length !== candidates.length) {
        throw new Error('incomplete_reference_results');
      }
      const expected = new Set(candidates.map((candidate) => candidate.objectKey));
      const seen = new Set();
      for (const reference of references) {
        if (
          !expected.has(reference?.objectKey)
          || seen.has(reference.objectKey)
          || typeof reference.referenced !== 'boolean'
        ) {
          throw new Error('invalid_reference_result');
        }
        seen.add(reference.objectKey);
      }
    } catch {
      abortAudioReconciliation(result, 'reference_check_failed');
      return completeAudioReconciliation(result, startedAt);
    }

    const referenceByKey = new Map(
      references.map((reference) => [reference.objectKey, reference.referenced]),
    );
    const unreferenced = [];
    for (const candidate of candidates) {
      if (referenceByKey.get(candidate.objectKey) === true) {
        result.referenced += 1;
        result.preserved.referenced += 1;
      } else {
        unreferenced.push(candidate);
      }
    }
    const selected = unreferenced.slice(0, audioReconciliationDeleteCap);
    result.preserved.deletionCap = Math.max(
      0,
      unreferenced.length - selected.length,
    );
    result.wouldDelete = selected.map((candidate) => candidate.objectKey);
    if (configuredMode === 'dry_run') {
      return completeAudioReconciliation(result, startedAt);
    }

    const deleteObject = segmentStorage.deleteAudioObject;
    if (typeof deleteObject !== 'function') {
      abortAudioReconciliation(result, 'delete_unavailable');
      return completeAudioReconciliation(result, startedAt);
    }
    for (const candidate of selected) {
      let deleted = false;
      try {
        await deleteObject({ objectKey: candidate.objectKey });
        deleted = true;
      } catch {
        result.retried += 1;
        try {
          await deleteObject({ objectKey: candidate.objectKey });
          deleted = true;
        } catch {
          result.failed += 1;
          result.preserved.deleteFailed += 1;
        }
        try {
          await store.recordObjectDeleteRetry({
            entityType: 'audio_asset',
            entityId: candidate.entityId,
            studentId: candidate.studentId,
            storyId: candidate.storyId,
            objectCount: 1,
          });
        } catch {
          if (deleted) {
            result.deleted += 1;
            result.failed += 1;
          }
          abortAudioReconciliation(result, 'delete_retry_audit_failed');
          break;
        }
      }
      if (!deleted) continue;
      result.deleted += 1;
      try {
        await store.recordReconciliationDeleted({
          entityId: candidate.entityId,
          studentId: candidate.studentId,
          storyId: candidate.storyId,
          objectCount: 1,
          byteSize: candidate.byteSize,
        });
      } catch {
        result.failed += 1;
        abortAudioReconciliation(result, 'reconciliation_audit_failed');
        break;
      }
    }
    return completeAudioReconciliation(result, startedAt);
  }

  async function runMaintenance() {
    const [
      sessions,
      pendingAudioAssets,
      orphanVersionAudio,
      transcriptions,
    ] = await Promise.allSettled([
      runSweeps(),
      recoverPendingAudioAssets(),
      recoverOrphanVersionAudio(),
      recoverPendingTranscriptions(),
    ]);
    return {
      sessions: sessions.status === 'fulfilled'
        ? sessions.value
        : { failed: true },
      pendingAudioAssets: pendingAudioAssets.status === 'fulfilled'
        ? pendingAudioAssets.value
        : { failed: true },
      orphanVersionAudio: orphanVersionAudio.status === 'fulfilled'
        ? orphanVersionAudio.value
        : { failed: true },
      transcriptions: transcriptions.status === 'fulfilled'
        ? transcriptions.value
        : { failed: true },
      audioReconciliation: { retired: true },
    };
  }

  function startSweeps() {
    if (!onByDefault(environment.STORYFORGE_SWEEPS)) {
      return Object.freeze({ enabled: false, stop() {} });
    }
    const timer = setInterval(() => {
      runMaintenance().catch(() => {});
    }, sweepIntervalMs);
    timer.unref?.();
    return Object.freeze({
      enabled: true,
      stop() {
        clearInterval(timer);
      },
    });
  }

  async function recoverPendingTranscriptions() {
    if (!transcriptionAvailable) return { queued: 0, blocked: true };
    const pending = await store.pendingTranscriptions();
    for (const segment of pending) {
      const delayMs = retryDelaysMs[Math.min(segment.retryCount, retryDelaysMs.length - 1)];
      queue.enqueue(segment.recordingId, segment.seq, delayMs);
    }
    return { queued: pending.length };
  }

  async function recoverPendingAssemblies() {
    if (assembly.available === false) {
      return { queued: 0, blocked: true };
    }
    const pending = await store.pendingAssemblies();
    let queued = 0;
    for (const item of pending) {
      if (beginAssembly(
        { id: item.recordingId },
        { sub: item.studentId },
      )) queued += 1;
    }
    return { queued };
  }

  function permanentAudioKeys(attachment) {
    const objectKey = String(attachment.objectKey || '');
    const extension = mimeExtensions[String(attachment.contentType || '')];
    if (!objectKey || !extension || !assemblyOption) {
      throw new RecordingError(
        'assembly_authority_blocked',
        'Recording assembly is unavailable.',
        503,
      );
    }
    if (assemblyOption === 'A') return [`${objectKey}.${extension}`];
    const segmentCount = integer(
      attachment.segmentCount,
      'invalid_request',
      'The recording could not be attached.',
      { min: 1, max: maxSegments },
    );
    return Array.from(
      { length: segmentCount },
      (_, seq) => `${objectKey}/seg-${String(seq).padStart(5, '0')}.${extension}`,
    );
  }

  async function finalizeAttachment(attachment) {
    requireFinalizationStorage();
    const extension = mimeExtensions[String(attachment.contentType || '')];
    const prefix = recordingPrefix(attachment.studentId, attachment.recordingId);
    const targets = permanentAudioKeys(attachment);
    const sources = assemblyOption === 'A'
      ? [`${prefix}assembled.${extension}`]
      : targets.map((_, seq) => (
        `${prefix}seg-${String(seq).padStart(5, '0')}.${extension}`
      ));

    for (let index = 0; index < targets.length; index += 1) {
      await segmentStorage.copyAudioObject({
        sourceKey: sources[index],
        targetKey: targets[index],
        contentType: attachment.contentType,
      });
    }

    const verified = [];
    for (const objectKey of targets) {
      const metadata = await segmentStorage.headAudioObject({ objectKey });
      if (
        metadata.contentType !== attachment.contentType
        || !Number.isInteger(metadata.byteSize)
        || metadata.byteSize < 1
      ) {
        throw new RecordingError(
          'audio_verification_failed',
          'Private audio verification did not complete.',
          503,
        );
      }
      verified.push(metadata);
    }

    let checksumSha256 = null;
    if (assemblyOption === 'A') {
      const stored = await segmentStorage.getSegment({
        objectKey: targets[0],
      });
      const bytes = Buffer.isBuffer(stored)
        ? stored
        : (stored instanceof Uint8Array ? Buffer.from(stored) : null);
      if (!bytes || bytes.byteLength < 1 || bytes.byteLength > maxAssetBytes) {
        throw new RecordingError(
          'audio_verification_failed',
          'Private audio verification did not complete.',
          503,
        );
      }
      checksumSha256 = createHash('sha256').update(bytes).digest('hex');
    }
    const byteSize = verified.reduce((total, item) => total + item.byteSize, 0);
    const tempKeys = await store.markAudioVerified(
      attachment.assetId,
      byteSize,
      checksumSha256,
    );
    await deleteRecordingTemp({
      recordingId: attachment.recordingId,
      studentId: attachment.studentId,
      storyId: attachment.storyId,
      objectKeys: tempKeys,
      entityType: 'audio_asset',
      entityId: attachment.assetId,
    });
    return {
      byteSize,
      checksumSha256,
      objectKeys: targets,
      verified: true,
    };
  }

  async function saveRecordingStory(identity, recordingIdValue, body) {
    assertStudent(identity);
    const recordingId = safeUuid(recordingIdValue);
    const attached = await withAuditedRecordingAccess(
      identity,
      recordingId,
      'quick',
      () => store.attachRecording(identity, recordingId, body),
    );
    if (attached.attachment.state === 'pending') {
      try {
        await finalizeAttachment(attached.attachment);
        attached.attachment.state = 'verified';
      } catch {
        // The story and immutable transcript already committed. The time-based
        // pending-asset worker owns retries and the terminal 60-minute failure.
        attached.attachment.state = 'pending';
      }
    }
    releaseTranscriptionSessionWhenIdle(recordingId);
    return attached;
  }

  async function saveRecordingVersion(identity, recordingIdValue, storyIdValue) {
    assertStudent(identity);
    await flagService.assertVoiceEnabled(identity);
    if (typeof store.attachVersionRecording !== 'function') {
      throw new RecordingError('voice_version_unavailable', 'Purposeful voice versions are unavailable.', 503);
    }
    const recordingId = safeUuid(recordingIdValue);
    const storyId = safeUuid(storyIdValue);
    const attached = await withAuditedRecordingAccess(
      identity,
      recordingId,
      'story_version',
      () => store.attachVersionRecording(identity, recordingId, storyId),
    );
    if (attached.attachment.state === 'pending') {
      await finalizeAttachment(attached.attachment);
      attached.attachment.state = 'verified';
    }
    releaseTranscriptionSessionWhenIdle(recordingId);
    return {
      transcript: attached.transcript,
      recordingId,
      audioAssetId: attached.attachment.assetId,
      durationMs: attached.attachment.durationMs || null,
    };
  }

  async function recoverPendingAudioAssets() {
    if (!assemblyOption) return { scanned: 0, verified: 0, failed: 0, blocked: true };
    const candidates = await store.pendingAudioAssets();
    let verified = 0;
    let failed = 0;
    for (const attachment of candidates) {
      if (attachment.pendingMinutes >= 60) {
        const tempKeys = await store.markAudioFailed(attachment.assetId);
        await deleteRecordingTemp({
          recordingId: attachment.recordingId,
          studentId: attachment.studentId,
          storyId: attachment.storyId,
          objectKeys: tempKeys,
          entityType: 'audio_asset',
          entityId: attachment.assetId,
        });
        failed += 1;
        continue;
      }
      try {
        await finalizeAttachment(attachment);
        verified += 1;
      } catch {
        // The next 10-minute sweep retries this restart-safe pending asset.
      }
    }
    return { scanned: candidates.length, verified, failed };
  }

  async function recoverOrphanVersionAudio() {
    if (
      typeof store.claimVersionAudioCleanup !== 'function'
      || typeof store.completeVersionAudioCleanup !== 'function'
    ) {
      return { scanned: 0, deleted: 0, failed: 0, blocked: true };
    }
    const candidates = await store.claimVersionAudioCleanup(20);
    let deleted = 0;
    let failed = 0;
    for (const candidate of candidates) {
      try {
        await segmentStorage.deleteAudioAsset({
          asset: { objectKey: candidate.objectKey },
        });
        await store.completeVersionAudioCleanup(candidate.intentId, true, null);
        deleted += 1;
        emit('version_audio_orphan_deleted', {
          assetId: candidate.assetId,
        });
      } catch {
        failed += 1;
        try {
          await store.completeVersionAudioCleanup(
            candidate.intentId,
            false,
            'object_delete_failed',
          );
        } catch {
          // The durable intent remains the recovery authority. A later sweep
          // retries it; no private identifier or storage detail is logged.
        }
      }
    }
    return { scanned: candidates.length, deleted, failed };
  }

  async function playbackKeys(asset) {
    const objectKey = String(asset?.object_key || asset?.objectKey || '');
    if (/\.(?:webm|m4a|mp4|ogg|wav)$/i.test(objectKey)) return [objectKey];
    if (!assemblyOption) {
      throw new RecordingError(
        'assembly_authority_blocked',
        'Recording assembly is unavailable.',
        503,
      );
    }
    const manifest = await store.readAudioManifest(safeUuid(asset?.id));
    if (!manifest) throw new RecordingError('not_found', 'Audio asset not found.', 404);
    return permanentAudioKeys({
      objectKey,
      contentType: asset?.content_type || asset?.contentType,
      segmentCount: manifest.segmentCount,
    });
  }

  async function checkAudioObjectReferences(objectKeys) {
    const keys = [...new Set((objectKeys || []).map(String).filter(Boolean))];
    if (!keys.length) {
      return store.checkAudioReferences([]);
    }
    const results = [];
    for (
      let index = 0;
      index < keys.length;
      index += audioReconciliationReferenceBatchSize
    ) {
      results.push(...await store.checkAudioReferences(
        keys.slice(index, index + audioReconciliationReferenceBatchSize),
      ));
    }
    return results;
  }

  return Object.freeze({
    addSegment,
    cancelRecording,
    createRecording,
    deleteAudio,
    finishRecording,
    getRecording,
    checkAudioObjectReferences,
    playbackKeys,
    recoverPendingAssemblies,
    recoverPendingAudioAssets,
    recoverOrphanVersionAudio,
    recoverPendingTranscriptions,
    retryTranscription,
    runWeeklyAudioReconciliation,
    runMaintenance,
    runSweeps,
    saveRecordingStory,
    saveRecordingVersion,
    startSweeps,
    waitForTranscriptionIdle: queue.waitForIdle,
  });
}

export const recordingConstants = Object.freeze({
  audioReconciliation: Object.freeze({
    ageMs: audioReconciliationAgeMs,
    cadenceMs: audioReconciliationCadenceMs,
    pageSize: audioReconciliationPageSize,
    referenceBatchSize: audioReconciliationReferenceBatchSize,
    evaluationCap: audioReconciliationEvaluationCap,
    deleteCap: audioReconciliationDeleteCap,
    prefix: audioReconciliationPrefix,
    controlPrefix: audioReconciliationControlPrefix,
    controlKey: audioReconciliationControlKey,
    deleteRetries: 1,
  }),
  allowedMimeTypes: Object.freeze([...allowedMimeTypes]),
  dailyMinutesDefault: defaultDailyMinutes,
  maxAssetBytes,
  maxRecordingDurationMs,
  maxSegmentBytes,
  maxSegments,
  retryDelaysMs,
  segmentPlanMs,
  sweepIntervalMs,
});
