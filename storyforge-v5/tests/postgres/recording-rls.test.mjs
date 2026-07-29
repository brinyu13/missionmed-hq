import assert from 'node:assert/strict';
import test from 'node:test';

import {
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT_A = {
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  wpUserId: 1101,
};
const STUDENT_B = {
  sub: '22222222-2222-4222-8222-222222222222',
  role: 'student',
  wpUserId: 1102,
};
const MENTOR = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'mentor',
  wpUserId: 2101,
};
const ADMIN = {
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'admin',
  wpUserId: 3101,
};

test('recording sessions and segments enforce owner-only RLS and service purge access', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const catalog = await client.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
       WHERE relname IN ('sf_recording_sessions', 'sf_recording_segments')
       ORDER BY relname`,
    );
    assert.deepEqual(catalog.rows, [
      {
        relname: 'sf_recording_segments',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'sf_recording_sessions',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);

    const uniqueConstraints = await client.query(
      `SELECT pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
       WHERE conrelid = 'public.sf_recording_segments'::regclass
         AND contype = 'u'`,
    );
    assert.ok(
      uniqueConstraints.rows.some(
        ({ definition }) => definition === 'UNIQUE (session_id, seq)',
      ),
    );

    const created = await withIdentity(client, STUDENT_A, async (identityClient) => {
      const session = await identityClient.query(
        `INSERT INTO public.sf_recording_sessions
           (student_id, mime_type, total_duration_ms, segment_count)
         VALUES ($1, 'audio/webm', 1000, 1)
         RETURNING id`,
        [STUDENT_A.sub],
      );
      const segment = await identityClient.query(
        `INSERT INTO public.sf_recording_segments
           (session_id, seq, object_key, mime_type, byte_size, duration_ms)
         VALUES ($1, 0, $2, 'audio/webm', 1024, 1000)
         RETURNING id`,
        [
          session.rows[0].id,
          `storyforge-audio/${STUDENT_A.sub}/fixture/segment-0.webm`,
        ],
      );
      return {
        sessionId: session.rows[0].id,
        segmentId: segment.rows[0].id,
      };
    });

    await withIdentity(client, STUDENT_A, async (identityClient) => {
      const ownSessions = await identityClient.query(
        'SELECT id FROM public.sf_recording_sessions WHERE id = $1',
        [created.sessionId],
      );
      const ownSegments = await identityClient.query(
        'SELECT id FROM public.sf_recording_segments WHERE id = $1',
        [created.segmentId],
      );
      assert.equal(ownSessions.rowCount, 1);
      assert.equal(ownSegments.rowCount, 1);
    });

    await withIdentity(client, STUDENT_B, async (identityClient) => {
      const foreignSessions = await identityClient.query(
        'SELECT id FROM public.sf_recording_sessions WHERE id = $1',
        [created.sessionId],
      );
      const foreignSegments = await identityClient.query(
        'SELECT id FROM public.sf_recording_segments WHERE id = $1',
        [created.segmentId],
      );
      assert.equal(foreignSessions.rowCount, 0);
      assert.equal(foreignSegments.rowCount, 0);
    });

    await assert.rejects(
      withIdentity(client, STUDENT_B, (identityClient) => identityClient.query(
        `INSERT INTO public.sf_recording_sessions (student_id, mime_type)
         VALUES ($1, 'audio/webm')`,
        [STUDENT_A.sub],
      )),
      (error) => error.code === '42501',
    );

    for (const identity of [MENTOR, ADMIN]) {
      await withIdentity(client, identity, async (identityClient) => {
        const sessions = await identityClient.query(
          'SELECT id FROM public.sf_recording_sessions WHERE id = $1',
          [created.sessionId],
        );
        const segments = await identityClient.query(
          'SELECT id FROM public.sf_recording_segments WHERE id = $1',
          [created.segmentId],
        );
        assert.equal(sessions.rowCount, 0);
        assert.equal(segments.rowCount, 0);
      });
    }

    await withIdentity(client, {
      ...STUDENT_A,
      eligible: false,
    }, async (identityClient) => {
      const sessions = await identityClient.query(
        'SELECT id FROM public.sf_recording_sessions WHERE id = $1',
        [created.sessionId],
      );
      assert.equal(sessions.rowCount, 0);
    });

    await assert.rejects(
      withIdentity(client, STUDENT_A, (identityClient) => identityClient.query(
        `INSERT INTO public.sf_recording_sessions (student_id, mime_type)
         VALUES ($1, 'audio/webm')`,
        [STUDENT_A.sub],
      )),
      (error) => error.code === '23505',
    );

    await assert.rejects(
      withIdentity(client, STUDENT_A, (identityClient) => identityClient.query(
        `INSERT INTO public.sf_recording_segments
           (session_id, seq, object_key, mime_type, byte_size)
         VALUES ($1, 0, $2, 'audio/webm', 100)`,
        [created.sessionId, 'storyforge-audio/duplicate-sequence.webm'],
      )),
      (error) => error.code === '23505',
    );

    const deletePrivilege = await client.query(
      `SELECT
         has_table_privilege('authenticated', 'public.sf_recording_segments', 'DELETE')
           AS authenticated_delete,
         has_table_privilege('storyforge_app', 'public.sf_recording_segments', 'DELETE')
           AS service_delete`,
    );
    assert.deepEqual(deletePrivilege.rows[0], {
      authenticated_delete: false,
      service_delete: true,
    });

    await withRole(client, 'storyforge_app', async (serviceClient) => {
      const updated = await serviceClient.query(
        `UPDATE public.sf_recording_segments
         SET transcript = 'synthetic service test', transcribe_state = 'transcribed'
         WHERE id = $1
         RETURNING id`,
        [created.segmentId],
      );
      assert.equal(updated.rowCount, 1);

      const cancelled = await serviceClient.query(
        `UPDATE public.sf_recording_sessions
         SET state = 'cancelled'
         WHERE id = $1
         RETURNING id`,
        [created.sessionId],
      );
      assert.equal(cancelled.rowCount, 1);

      const purged = await serviceClient.query(
        'DELETE FROM public.sf_recording_segments WHERE id = $1 RETURNING id',
        [created.segmentId],
      );
      assert.equal(purged.rowCount, 1);
    });

    const remaining = await client.query(
      'SELECT count(*)::int AS count FROM public.sf_recording_segments WHERE id = $1',
      [created.segmentId],
    );
    assert.equal(remaining.rows[0].count, 0);
  } finally {
    await database.stop();
  }
});
