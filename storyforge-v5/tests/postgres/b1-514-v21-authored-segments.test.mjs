import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  migrationSql,
  startEphemeralStoryForgeDatabase,
  withIdentity,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT = {
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  wpUserId: 1101,
};
const MENTOR = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'mentor',
  wpUserId: 2101,
};
const migrations = [
  '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql',
  '20260810200000_b1_514_v2_r2_story_versions_provenance.sql',
  '20260810250000_b1_514_v21_authored_segment_writes.sql',
];

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

test('canonical Full Story and published mentor content append exact provenance', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }

    let typedStory;
    await withIdentity(client, STUDENT, async (identityClient) => {
      const created = await identityClient.query(
        `SELECT (public.sf_create_story_v5(
          '{"title":"Typed","text":"First typed telling","captureType":"text"}'::jsonb,
          'quick'
        )).*`,
      );
      typedStory = created.rows[0];
      await identityClient.query(
        `SELECT (public.sf_update_story_v5(
          $1, '{"text":"Second typed telling"}'::jsonb, NULL, 'workspace'
        )).*`,
        [typedStory.id],
      );
    });

    const typed = await client.query(
      `SELECT source_role,source_entity_type,source_entity_id,body_hash,
              recording_id,audio_asset_id,author_id
       FROM public.sf_authored_segments WHERE story_id=$1 ORDER BY created_at,id`,
      [typedStory.id],
    );
    const expectedTyped = [
      {
        source_role: 'student_typed',
        source_entity_type: 'story',
        source_entity_id: typedStory.id,
        body_hash: sha256('First typed telling'),
        recording_id: null,
        audio_asset_id: null,
        author_id: STUDENT.sub,
      },
      {
        source_role: 'student_typed',
        source_entity_type: 'story',
        source_entity_id: typedStory.id,
        body_hash: sha256('Second typed telling'),
        recording_id: null,
        audio_asset_id: null,
        author_id: STUDENT.sub,
      },
    ];
    typed.rows.sort((left, right) => left.body_hash.localeCompare(right.body_hash));
    expectedTyped.sort((left, right) => left.body_hash.localeCompare(right.body_hash));
    assert.deepEqual(typed.rows, expectedTyped);

    let audioStory;
    let recordingId;
    await withIdentity(client, STUDENT, async (identityClient) => {
      audioStory = (await identityClient.query(
        `SELECT (public.sf_create_story_v5(
          '{"title":"Spoken","text":"Exact spoken telling","captureType":"audio"}'::jsonb,
          'quick'
        )).*`,
      )).rows[0];
    });
    recordingId = (await client.query(
      `INSERT INTO public.sf_recording_sessions(student_id,state,mime_type,total_duration_ms,segment_count)
       VALUES($1,'assembled','audio/webm',4000,1) RETURNING id`,
      [STUDENT.sub],
    )).rows[0].id;
    await withIdentity(client, STUDENT, async (identityClient) => {
      await identityClient.query(
        "SELECT * FROM public.sf_attach_recording($1,$2,'audio/webm')",
        [audioStory.id, recordingId],
      );
    });
    const spoken = (await client.query(
      `SELECT source_role,body_hash,recording_id,audio_asset_id,author_id
       FROM public.sf_authored_segments WHERE story_id=$1`,
      [audioStory.id],
    )).rows[0];
    assert.equal(spoken.source_role, 'student_spoken');
    assert.equal(spoken.body_hash, sha256('Exact spoken telling'));
    assert.equal(spoken.recording_id, recordingId);
    assert.ok(spoken.audio_asset_id);
    assert.equal(spoken.author_id, STUDENT.sub);

    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all'
       WHERE key='mentor_notes'`,
    );
    await client.query(
      "UPDATE public.sf_stories SET status='awaiting' WHERE id=$1",
      [typedStory.id],
    );
    let noteId;
    await withIdentity(client, MENTOR, async (identityClient) => {
      noteId = (await identityClient.query(
        `SELECT public.sf_create_mentor_note(
          $1,'Clear student-facing mentor guidance.',false,'workspace'
        ) AS payload`,
        [typedStory.id],
      )).rows[0].payload.id;
      await identityClient.query(
        "SELECT public.sf_publish_mentor_note($1,0,'workspace')",
        [noteId],
      );
    });
    const mentor = (await client.query(
      `SELECT source_role,source_entity_type,source_entity_id,body_hash,author_id
       FROM public.sf_authored_segments
       WHERE source_entity_type='mentor_note' AND source_entity_id=$1`,
      [noteId],
    )).rows[0];
    assert.deepEqual(mentor, {
      source_role: 'mentor_content',
      source_entity_type: 'mentor_note',
      source_entity_id: noteId,
      body_hash: sha256('Clear student-facing mentor guidance.'),
      author_id: MENTOR.sub,
    });
  } finally {
    await database.stop();
  }
});
