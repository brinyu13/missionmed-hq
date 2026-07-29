import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

export const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

async function withDatabase(callback) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

export async function resetVoiceFixture() {
  await withDatabase(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        `DELETE FROM public.sf_recording_segments
          WHERE session_id IN (
            SELECT id FROM public.sf_recording_sessions
            WHERE student_id IN ($1, $2)
          )`,
        [STUDENT_ID, OTHER_STUDENT_ID],
      );
      await client.query(
        `DELETE FROM public.sf_recording_sessions
          WHERE student_id IN ($1, $2)`,
        [STUDENT_ID, OTHER_STUDENT_ID],
      );
      await client.query(
        `DELETE FROM public.sf_story_drafts
          WHERE user_id IN ($1, $2)`,
        [STUDENT_ID, OTHER_STUDENT_ID],
      );
      await client.query(
        `UPDATE public.sf_feature_flags
            SET scope = 'off',
                allowlist = '{}'::uuid[],
                cohorts = '{}'::text[],
                updated_by = $2,
                updated_at = now()
          WHERE key = $1`,
        ['voice_capture', ADMIN_ID],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function setVoiceScope({
  scope = 'allowlist',
  allowlist = [STUDENT_ID],
  cohorts = [],
} = {}) {
  await withDatabase(async (client) => {
    const result = await client.query(
      `UPDATE public.sf_feature_flags
          SET scope = $2,
              allowlist = $3::uuid[],
              cohorts = $4::text[],
              updated_by = $5,
              updated_at = now()
        WHERE key = $1
        RETURNING key`,
      ['voice_capture', scope, allowlist, cohorts, ADMIN_ID],
    );
    expect(result.rowCount, 'voice_capture server fixture row').toBe(1);
  });
}

export async function seedRecoveredTranscript({
  text,
  flaggedTerms = [],
  durationMs = 18_000,
} = {}) {
  const recordingId = randomUUID();
  const objectKey = `storyforge-rec/${STUDENT_ID}/${recordingId}/seg-00000.webm`;
  await withDatabase(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO public.sf_recording_sessions (
           id, student_id, state, mime_type, total_duration_ms, segment_count
         )
         VALUES ($1, $2, 'recording', 'audio/webm', $3, 1)`,
        [recordingId, STUDENT_ID, durationMs],
      );
      await client.query(
        `INSERT INTO public.sf_recording_segments (
           session_id, seq, object_key, mime_type, byte_size, duration_ms,
           transcribe_state, transcript, flagged_terms
         )
         VALUES ($1, 0, $2, 'audio/webm', 16, $3, 'transcribed', $4, $5::jsonb)`,
        [recordingId, objectKey, durationMs, text, JSON.stringify(flaggedTerms)],
      );
      await client.query(
        `INSERT INTO public.sf_story_drafts (user_id, payload)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (user_id) DO UPDATE
           SET payload = EXCLUDED.payload,
               row_version = public.sf_story_drafts.row_version + 1,
               updated_at = now()`,
        [
          STUDENT_ID,
          JSON.stringify({
            title: 'A recovered voice story',
            text,
            lesson: '',
            themes: [],
            studentScore: null,
            prefixEnabled: true,
            recordingId,
            nextSegmentSeq: 1,
            voiceDurationMs: durationMs,
            voiceAnchor: 0,
            appliedVoiceSegments: [0],
            voice: true,
          }),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
  return recordingId;
}

export async function seedActiveRecording({
  durationMs = 0,
} = {}) {
  const recordingId = randomUUID();
  await withDatabase(async (client) => {
    await client.query(
      `INSERT INTO public.sf_recording_sessions (
         id, student_id, state, total_duration_ms, segment_count
       )
       VALUES ($1, $2, 'recording', $3, 0)`,
      [recordingId, STUDENT_ID, durationMs],
    );
  });
  return recordingId;
}

export async function seedOutOfOrderTranscript() {
  const recordingId = randomUUID();
  await withDatabase(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO public.sf_recording_sessions (
           id, student_id, state, mime_type, total_duration_ms, segment_count
         )
         VALUES ($1, $2, 'recording', 'audio/webm', 30000, 2)`,
        [recordingId, STUDENT_ID],
      );
      await client.query(
        `INSERT INTO public.sf_recording_segments (
           session_id, seq, object_key, mime_type, byte_size, duration_ms,
           transcribe_state, transcript, flagged_terms
         )
         VALUES
           ($1, 0, $2, 'audio/webm', 16, 15000, 'transcribing', NULL, '[]'::jsonb),
           ($1, 1, $3, 'audio/webm', 16, 15000, 'transcribed', $4, '[]'::jsonb)`,
        [
          recordingId,
          `storyforge-rec/${STUDENT_ID}/${recordingId}/seg-00000.webm`,
          `storyforge-rec/${STUDENT_ID}/${recordingId}/seg-00001.webm`,
          'Second segment.',
        ],
      );
      await client.query(
        `INSERT INTO public.sf_story_drafts (user_id, payload)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (user_id) DO UPDATE
           SET payload = EXCLUDED.payload,
               row_version = public.sf_story_drafts.row_version + 1,
               updated_at = now()`,
        [
          STUDENT_ID,
          JSON.stringify({
            title: 'An out-of-order transcript',
            text: '',
            lesson: '',
            themes: [],
            studentScore: null,
            prefixEnabled: true,
            recordingId,
            nextSegmentSeq: 2,
            voiceDurationMs: 30_000,
            voiceAnchor: 0,
            appliedVoiceSegments: [],
            voice: true,
          }),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
  return recordingId;
}

export async function seedTranscriptionFailure() {
  const recordingId = randomUUID();
  const text = 'The reviewed draft text remains available.';
  await withDatabase(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO public.sf_recording_sessions (
           id, student_id, state, mime_type, total_duration_ms, segment_count
         )
         VALUES ($1, $2, 'recording', 'audio/webm', 4000, 1)`,
        [recordingId, STUDENT_ID],
      );
      await client.query(
        `INSERT INTO public.sf_recording_segments (
           session_id, seq, object_key, mime_type, byte_size, duration_ms,
           transcribe_state, transcript, flagged_terms
         )
         VALUES ($1, 0, $2, 'audio/webm', 16, 4000, 'transcribe_failed', NULL, '[]'::jsonb)`,
        [
          recordingId,
          `storyforge-rec/${STUDENT_ID}/${recordingId}/seg-00000.webm`,
        ],
      );
      await client.query(
        `INSERT INTO public.sf_story_drafts (user_id, payload)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (user_id) DO UPDATE
           SET payload = EXCLUDED.payload,
               row_version = public.sf_story_drafts.row_version + 1,
               updated_at = now()`,
        [
          STUDENT_ID,
          JSON.stringify({
            title: 'A transcription retry story',
            text,
            lesson: '',
            themes: [],
            studentScore: null,
            prefixEnabled: true,
            recordingId,
            nextSegmentSeq: 1,
            voiceDurationMs: 4_000,
            voiceAnchor: 0,
            appliedVoiceSegments: [],
            voice: true,
          }),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
  return recordingId;
}

export async function completeServerTranscriptSegment(recordingId, seq, transcript) {
  await withDatabase(async (client) => {
    const result = await client.query(
      `UPDATE public.sf_recording_segments
          SET transcribe_state = 'transcribed',
              transcript = $3,
              updated_at = now()
        WHERE session_id = $1
          AND seq = $2`,
      [recordingId, seq, transcript],
    );
    expect(result.rowCount, 'server transcript segment fixture').toBe(1);
  });
}

export async function studentRecordingSessionCount() {
  return withDatabase(async (client) => {
    const result = await client.query(
      `SELECT count(*)::integer AS count
         FROM public.sf_recording_sessions
        WHERE student_id = $1`,
      [STUDENT_ID],
    );
    return Number(result.rows[0].count);
  });
}

export async function loginStudent(page, {
  persona = 'Student · Maya',
} = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: persona }).click();
  await expect(page.locator('[data-view="home"], [data-view="mhome"]').first()).toBeVisible();
}

export async function devToken(request, persona = 'student') {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok(), `fixture token for ${persona}`).toBeTruthy();
  return (await response.json()).token;
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function installDeterministicMedia(page, {
  denied = false,
  emitChunk = false,
} = {}) {
  await page.addInitScript(({ shouldDeny, shouldEmitChunk }) => {
    class DeterministicTrack extends EventTarget {
      constructor() {
        super();
        this.kind = 'audio';
        this.readyState = 'live';
      }

      stop() {
        this.readyState = 'ended';
      }
    }

    class DeterministicMediaRecorder extends EventTarget {
      static isTypeSupported(type) {
        return type === 'audio/webm;codecs=opus' || type === 'audio/webm';
      }

      constructor(stream, options = {}) {
        super();
        this.stream = stream;
        this.mimeType = options.mimeType || 'audio/webm';
        this.state = 'inactive';
      }

      start() {
        this.state = 'recording';
      }

      stop() {
        if (shouldEmitChunk) {
          const chunk = new Event('dataavailable');
          Object.defineProperty(chunk, 'data', {
            value: new Blob(['deterministic voice segment'], { type: this.mimeType }),
          });
          this.dispatchEvent(chunk);
        }
        this.state = 'inactive';
        this.dispatchEvent(new Event('stop'));
      }
    }

    const track = new DeterministicTrack();
    const stream = {
      active: true,
      getAudioTracks: () => [track],
      getTracks: () => [track],
    };
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: DeterministicMediaRecorder,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        async getUserMedia() {
          if (shouldDeny) {
            throw new DOMException('Permission denied by deterministic browser fixture.', 'NotAllowedError');
          }
          return stream;
        },
      },
    });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        async request() {
          return { async release() {} };
        },
      },
    });
    window.__storyforgeVoiceTestMedia = { track };
  }, { shouldDeny: denied, shouldEmitChunk: emitChunk });
}

export async function closePageAndReset(page) {
  if (!page.isClosed()) await page.close();
  await resetVoiceFixture();
}
