import assert from 'node:assert/strict';
import test from 'node:test';

import {
  startEphemeralStoryForgeDatabase,
  withIdentity,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT = {
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  wpUserId: 1101,
};
const OTHER_STUDENT = {
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

test('admin console is default-off, bounded to submitted stories, audited, and role-safe', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  let submittedId;
  let privateId;
  let archivedId;
  try {
    const seeded = await client.query(
      `SELECT scope, allowlist, cohorts, updated_by
       FROM public.sf_feature_flags WHERE key = 'admin_console'`,
    );
    assert.deepEqual(seeded.rows[0], {
      scope: 'off',
      allowlist: [],
      cohorts: [],
      updated_by: ADMIN.sub,
    });

    const stories = await client.query(
      `INSERT INTO public.sf_stories
         (student_id, title, original_text, current_text, lesson, status, archived_at)
       VALUES
         ($1, 'Submitted proof', 'Original proof', 'Current proof', 'Learning proof', 'awaiting', NULL),
         ($1, 'Private proof', 'Private original', 'Private current', 'Private lesson', 'private', NULL),
         ($1, 'Archived proof', 'Archived original', 'Archived current', 'Archived lesson', 'awaiting', now())
       RETURNING id, status, archived_at`,
      [STUDENT.sub],
    );
    submittedId = stories.rows[0].id;
    privateId = stories.rows[1].id;
    archivedId = stories.rows[2].id;
    await client.query(
      `INSERT INTO public.sf_story_originals
         (story_id, original_transcript, capture_type)
       VALUES ($1, 'Original proof', 'text')`,
      [submittedId],
    );

    await withIdentity(client, ADMIN, async (identityClient) => {
      const capability = await identityClient.query(
        'SELECT public.sf_admin_console_enabled() AS enabled',
      );
      assert.equal(capability.rows[0].enabled, false);
      await assert.rejects(
        identityClient.query('SELECT public.sf_admin_home(8)'),
        (error) => error.code === '42501',
      );
    });

    await withIdentity(client, ADMIN, async (identityClient) => {
      const activated = await identityClient.query(
        `SELECT public.sf_admin_set_console_flag('allowlist', ARRAY[$1::uuid]) AS payload`,
        [ADMIN.sub],
      );
      assert.equal(activated.rows[0].payload.scope, 'allowlist');
      assert.deepEqual(activated.rows[0].payload.allowlist, [ADMIN.sub]);
    });

    for (const hiddenId of [privateId, archivedId]) {
      await withIdentity(client, ADMIN, async (identityClient) => {
        await assert.rejects(
          identityClient.query('SELECT public.sf_admin_story_detail($1)', [hiddenId]),
          (error) => error.code === 'P0002',
        );
      });
    }

    await withIdentity(client, ADMIN, async (identityClient) => {
      const generic = await identityClient.query(
        'SELECT id FROM public.sf_stories WHERE id = $1',
        [submittedId],
      );
      assert.equal(generic.rowCount, 0, 'generic story RLS remains closed to admin');

      const home = await identityClient.query(
        'SELECT public.sf_admin_home(8) AS payload',
      );
      assert.equal(home.rows[0].payload.metrics.submittedStories, 1);

      const search = await identityClient.query(
        `SELECT public.sf_admin_search_students('', NULL, NULL, NULL, 25) AS payload`,
      );
      assert.equal(search.rows[0].payload.students.length, 1);
      assert.equal(search.rows[0].payload.students[0].id, STUDENT.sub);
      assert.equal(Object.hasOwn(search.rows[0].payload.students[0], 'email'), false);
      assert.equal(Object.hasOwn(search.rows[0].payload.students[0], 'username'), false);

      const student = await identityClient.query(
        `SELECT public.sf_admin_student_detail($1, NULL, NULL, 25) AS payload`,
        [STUDENT.sub],
      );
      assert.deepEqual(student.rows[0].payload.stories.map((story) => story.id), [submittedId]);

      const detail = await identityClient.query(
        'SELECT public.sf_admin_story_detail($1) AS payload',
        [submittedId],
      );
      assert.equal(detail.rows[0].payload.story.originalText, 'Original proof');
      assert.equal(detail.rows[0].payload.story.lesson, 'Learning proof');
      assert.equal(JSON.stringify(detail.rows[0].payload).includes('object_key'), false);
      assert.equal(JSON.stringify(detail.rows[0].payload).includes('audioAsset'), false);

      const reviewed = await identityClient.query(
        `SELECT public.sf_admin_review_story(
           $1, 0,
           '{"status":"reviewed","mentorScore":5,"suitability":"both","studentFeedback":"Student-visible proof","internalNote":"Admin-only proof"}'::jsonb,
           'workspace'
         ) AS payload`,
        [submittedId],
      );
      assert.equal(reviewed.rows[0].payload.story.status, 'reviewed');
      assert.equal(reviewed.rows[0].payload.story.mentorScore, 5);
      assert.equal(reviewed.rows[0].payload.story.reviewSuitability, 'both');
      assert.equal(reviewed.rows[0].payload.feedback.at(-1).reviewerRole, 'admin');
      assert.equal(reviewed.rows[0].payload.internalNotes.at(-1).body, 'Admin-only proof');

    });

    await withIdentity(client, ADMIN, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_admin_review_story($1, 0, '{"mentorScore":4}'::jsonb, 'workspace')`,
          [submittedId],
        ),
        (error) => error.code === '40001',
      );
    });

    await withIdentity(client, STUDENT, async (identityClient) => {
      const story = await identityClient.query(
        `SELECT status, mentor_score, review_suitability, reviewed_by, reviewed_at
         FROM public.sf_stories WHERE id = $1`,
        [submittedId],
      );
      assert.deepEqual(
        {
          status: story.rows[0].status,
          mentor_score: story.rows[0].mentor_score,
          review_suitability: story.rows[0].review_suitability,
        },
        { status: 'reviewed', mentor_score: 5, review_suitability: 'both' },
      );
      assert.ok(story.rows[0].reviewed_by);
      assert.ok(story.rows[0].reviewed_at);

      const feedback = await identityClient.query(
        `SELECT body FROM public.sf_feedback WHERE story_id = $1`,
        [submittedId],
      );
      assert.deepEqual(feedback.rows.map((row) => row.body), ['Student-visible proof']);

      const notes = await identityClient.query(
        `SELECT body FROM public.sf_story_internal_notes WHERE story_id = $1`,
        [submittedId],
      );
      assert.equal(notes.rowCount, 0);
      const adminAudit = await identityClient.query(
        `SELECT action FROM public.sf_audit_events
         WHERE story_id = $1 AND visibility = 'admin_only'`,
        [submittedId],
      );
      assert.equal(adminAudit.rowCount, 0);
    });

    await withIdentity(client, MENTOR, async (identityClient) => {
      const notes = await identityClient.query(
        `SELECT body FROM public.sf_story_internal_notes WHERE story_id = $1`,
        [submittedId],
      );
      assert.equal(notes.rowCount, 0);
      const adminAudit = await identityClient.query(
        `SELECT action FROM public.sf_audit_events
         WHERE story_id = $1 AND visibility = 'admin_only'`,
        [submittedId],
      );
      assert.equal(adminAudit.rowCount, 0);
    });

    for (const identity of [STUDENT, OTHER_STUDENT, MENTOR]) {
      await withIdentity(client, identity, async (identityClient) => {
        await assert.rejects(
          identityClient.query('SELECT public.sf_admin_home(8)'),
          (error) => error.code === '42501',
        );
      });
      await withIdentity(client, identity, async (identityClient) => {
        await assert.rejects(
          identityClient.query(
            `SELECT public.sf_admin_set_console_flag('allowlist', ARRAY[$1::uuid])`,
            [ADMIN.sub],
          ),
          (error) => error.code === '42501',
        );
      });
    }

    const featureAudit = await client.query(
      `SELECT count(*)::integer AS count
       FROM public.sf_audit_events
       WHERE action = 'admin.feature_scope_changed'
         AND visibility = 'admin_only'`,
    );
    assert.equal(featureAudit.rows[0].count, 1);

    const noteAudit = await client.query(
      `SELECT count(*)::integer AS count
       FROM public.sf_audit_events
       WHERE story_id = $1
         AND visibility = 'admin_only'
         AND (
           coalesce(previous_value::text, '') ILIKE '%Admin-only proof%'
           OR coalesce(new_value::text, '') ILIKE '%Admin-only proof%'
           OR coalesce(detail, '') ILIKE '%Admin-only proof%'
         )`,
      [submittedId],
    );
    assert.equal(noteAudit.rows[0].count, 0, 'internal note body never enters audit');

    await assert.rejects(
      client.query(
        `UPDATE public.sf_story_internal_notes SET body = 'changed' WHERE story_id = $1`,
        [submittedId],
      ),
      (error) => error.code === '42501',
    );
  } finally {
    await database.stop();
  }
});
