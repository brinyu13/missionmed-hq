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
const retryDelaysMs = Object.freeze([0, 2_000, 8_000]);
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

function sessionProjection(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id ?? row.studentId,
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
    'recording_state_conflict',
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
}) {
  requireFunction(withIdentity, 'withIdentity');
  requireFunction(withServiceTransaction, 'withServiceTransaction');
  requireFunction(appendAudit, 'appendAudit');

  function backgroundLifecycleBlocked() {
    return new RecordingError(
      'recording_lifecycle_authority_blocked',
      'Background recording cleanup requires an approved privacy-preserving draft and audio lifecycle query.',
      503,
    );
  }

  async function readDraftTitle() {
    // The service role has no approved path into private drafts. Transcription
    // remains useful without draft-derived keywords and never impersonates a
    // student with a fabricated WordPress identity.
    return '';
  }

  async function findActiveSession(identity) {
    return withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT id, student_id, state, mime_type, total_duration_ms, segment_count,
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
          `SELECT id, student_id, state, mime_type, total_duration_ms, segment_count,
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
           RETURNING id, student_id, state, mime_type, total_duration_ms, segment_count,
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
        `SELECT id, student_id, state, mime_type, total_duration_ms, segment_count,
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
    return withIdentity(identity, async (client) => appendAudit(client, {
      action: 'unauthorized_denied',
      entityType: 'recording_session',
      entityId: recordingId,
      surface,
      studentId: identity.sub,
      previousValue: null,
      newValue: { errorCategory: 'auth' },
    }));
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
        `SELECT id, student_id, state, mime_type, total_duration_ms, segment_count,
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
          RETURNING id, student_id, state, mime_type, total_duration_ms, segment_count,
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
        `SELECT id, student_id, state, mime_type, total_duration_ms, segment_count,
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
          RETURNING id, student_id, state, mime_type, total_duration_ms, segment_count,
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

  async function markAssembled(recordingId, studentId, assetId) {
    return withServiceTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE public.sf_recording_sessions
            SET state = 'assembled',
                assembled_asset_id = $3,
                last_activity_at = now(),
                updated_at = now()
          WHERE id = $1
            AND student_id = $2
            AND state = 'finishing'
          RETURNING id`,
        [recordingId, studentId, assetId],
      );
      if (!updated.rows[0]) return false;
      await appendAudit(client, {
        action: 'assembly_completed',
        entityType: 'recording_session',
        entityId: recordingId,
        surface: 'system',
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
      await appendAudit(client, {
        action: 'assembly_failed',
        entityType: 'recording_session',
        entityId: recordingId,
        surface: 'system',
        studentId,
        previousValue: { state: 'finishing' },
        newValue: { state: 'failed', errorCategory: 'assembly' },
      });
      return true;
    });
  }

  async function cancelSession(identity, recordingId, purgeObjects) {
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
      if (session.state === 'cancelled') return { state: 'cancelled', changed: false };
      if (!['recording', 'finishing', 'failed'].includes(session.state)) throw stateConflict();
      const segments = await client.query(
        `SELECT object_key
           FROM public.sf_recording_segments
          WHERE session_id = $1
          ORDER BY seq
          FOR UPDATE`,
        [recordingId],
      );
      if (session.assembled_asset_id) {
        throw backgroundLifecycleBlocked();
      }
      await appendAudit(client, {
        action: 'recording_cancelled',
        entityType: 'recording_session',
        entityId: recordingId,
        surface: 'quick',
        studentId: identity.sub,
        previousValue: { state: session.state },
        newValue: { state: 'cancelled' },
      });
      await purgeObjects({
        segmentKeys: segments.rows.map((row) => row.object_key),
        asset: null,
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
      return { state: 'cancelled', changed: true };
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
      await appendAudit(client, {
        action: 'segment_transcribed',
        entityType: 'recording_segment',
        entityId: claim.id,
        surface: 'system',
        studentId: claim.studentId,
        previousValue: { transcribeState: 'transcribing' },
        newValue: {
          recordingId: claim.recordingId,
          seq: claim.seq,
          transcribeState: 'transcribed',
          latencyMs: result.latencyMs,
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
      await appendAudit(client, {
        action: 'segment_transcribe_failed',
        entityType: 'recording_segment',
        entityId: claim.id,
        surface: 'system',
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

  async function deleteAudio(identity, assetId, deleteAsset) {
    return withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT asset.id, asset.story_id, asset.student_id, asset.object_key,
                asset.content_type, asset.byte_size, asset.duration_ms, asset.state
           FROM public.sf_audio_assets asset
           JOIN public.sf_stories story ON story.id = asset.story_id
          WHERE asset.id = $1
            AND asset.student_id = $2
            AND story.student_id = $2
          FOR UPDATE OF asset`,
        [assetId, identity.sub],
      );
      const asset = result.rows[0];
      if (!asset) {
        throw new RecordingError('audio_not_found', 'Audio asset not found.', 404);
      }
      if (asset.state === 'retired') return { state: 'retired', changed: false };
      await appendAudit(client, {
        action: 'audio_deleted',
        entityType: 'audio_asset',
        entityId: assetId,
        surface: 'library',
        studentId: identity.sub,
        storyId: asset.story_id,
        previousValue: { state: asset.state },
        newValue: { state: 'retired' },
      });
      await deleteAsset(asset);
      await client.query(
        `UPDATE public.sf_audio_assets
            SET state = 'retired'
          WHERE id = $1`,
        [assetId],
      );
      return { state: 'retired', changed: true };
    });
  }

  async function sweepCandidates() {
    throw backgroundLifecycleBlocked();
  }

  async function sweepSession() {
    throw backgroundLifecycleBlocked();
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
        await appendAudit(client, {
          action: 'segment_transcribe_failed',
          entityType: 'recording_segment',
          entityId: row.id,
          surface: 'system',
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
    auditRecordingDenial,
    cancelSession,
    claimTranscription,
    completeTranscription,
    deleteAudio,
    failTranscription,
    findActiveSession,
    finishSession,
    markAssembled,
    markAssemblyFailed,
    openSession,
    pendingAssemblies,
    pendingTranscriptions,
    readDraftTitle,
    readOwnedSession,
    readStatus,
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
  audioRetirement = { available: false },
  emitEvent,
  environment = process.env,
  now = () => new Date(),
  delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  if (!store) throw new TypeError('A production recording store must be supplied.');
  for (const method of [
    'acceptSegment',
    'auditRecordingDenial',
    'cancelSession',
    'claimTranscription',
    'completeTranscription',
    'deleteAudio',
    'failTranscription',
    'finishSession',
    'markAssembled',
    'markAssemblyFailed',
    'openSession',
    'pendingAssemblies',
    'pendingTranscriptions',
    'readDraftTitle',
    'readOwnedSession',
    'readStatus',
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
  });
  requireFunction(transcription?.transcribeSegment, 'transcription.transcribeSegment');
  requireFunction(transcription?.keywordsForDraft, 'transcription.keywordsForDraft');
  requireFunction(assembly?.assembleRecording, 'assembly.assembleRecording');
  requireFunction(emitEvent, 'emitEvent');
  requireFunction(delay, 'delay');
  const transcriptionAvailable = transcription.available !== false;

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

  async function purgeObjects({ segmentKeys, asset }) {
    if (segmentKeys.length) await segmentStorage.deleteObjects({ objectKeys: segmentKeys });
    if (asset) await segmentStorage.deleteAudioAsset({ asset });
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
    try {
      const body = normalizeBytes(await segmentStorage.getSegment({ objectKey: claim.objectKey }));
      const draftTitle = await store.readDraftTitle(claim.studentId);
      const keywords = await transcription.keywordsForDraft({ draftTitle });
      const startedAt = now().getTime();
      const raw = await transcription.transcribeSegment({
        recordingId: claim.recordingId,
        studentId: claim.studentId,
        buffer: body,
        mimeType: claim.mimeType,
        seq: claim.seq,
        keywords,
        promptTail: claim.promptTail,
        languageHint: 'en',
      });
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
        });
      }
    } catch (error) {
      const code = safeTranscriptionCode(error);
      await store.failTranscription(claim, code);
      emit('segment_transcribe_failed', {
        recordingId: claim.recordingId,
        studentId: claim.studentId,
        jobSeq: claim.seq,
        errorCategory: 'transcribe',
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
      .then(async (result) => {
        const assetId = safeUuid(result?.assetId);
        if (await store.markAssembled(session.id, identity.sub, assetId)) {
          emit('assembly_completed', {
            recordingId: session.id,
            assetId,
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
    const finished = await store.finishSession(identity, recordingId, clientDurationMs);
    if (finished.transitioned || finished.session.state === 'finishing') {
      beginAssembly(finished.session, identity);
    }
    if (finished.transitioned) {
      emit('recording_finished', { recordingId, studentId: identity.sub });
    }
    if (['finishing', 'assembled', 'attached'].includes(finished.session.state)) {
      releaseTranscriptionSession(recordingId);
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
      () => store.cancelSession(identity, recordingId, purgeObjects),
    );
    if (result.changed) {
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
    if (
      audioRetirement?.available !== true
      || typeof audioRetirement.retireAudio !== 'function'
    ) {
      throw new RecordingError(
        'audio_retirement_authority_blocked',
        'Audio deletion is unavailable until the approved retirement transaction is installed.',
        503,
      );
    }
    const result = await audioRetirement.retireAudio({
      identity,
      assetId,
      store,
      deleteAsset: (asset) => segmentStorage.deleteAudioAsset({ asset }),
    });
    if (result.changed) emit('audio_deleted', { assetId, studentId: identity.sub });
    return { state: result.state };
  }

  async function runSweeps() {
    const candidates = await store.sweepCandidates();
    let cleaned = 0;
    const failures = [];
    for (const recordingId of candidates) {
      try {
        if (await store.sweepSession(recordingId, purgeObjects)) {
          cleaned += 1;
          emit('sweep_cleaned', { recordingId });
          releaseTranscriptionSession(recordingId);
        }
      } catch {
        failures.push(recordingId);
      }
    }
    return { scanned: candidates.length, cleaned, failures };
  }

  function startSweeps() {
    if (!onByDefault(environment.STORYFORGE_SWEEPS)) {
      return Object.freeze({ enabled: false, stop() {} });
    }
    const timer = setInterval(() => {
      runSweeps().catch(() => {});
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

  return Object.freeze({
    addSegment,
    cancelRecording,
    createRecording,
    deleteAudio,
    finishRecording,
    getRecording,
    recoverPendingAssemblies,
    recoverPendingTranscriptions,
    retryTranscription,
    runSweeps,
    startSweeps,
    waitForTranscriptionIdle: queue.waitForIdle,
  });
}

export const recordingConstants = Object.freeze({
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
