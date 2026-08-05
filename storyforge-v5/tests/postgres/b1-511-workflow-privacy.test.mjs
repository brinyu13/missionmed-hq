import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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
const UNASSIGNED_MENTOR = {
  sub: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'mentor',
  wpUserId: 2103,
};
const ADMIN = {
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'admin',
  wpUserId: 3101,
};

const migrationName = '20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql';

const repeatableFunctions = [
  'sf_story_feature_enabled',
  'sf_submit_story',
  'sf_withdraw_story',
  'sf_update_story_taxonomy',
  'sf_update_story_priority',
  'sf_admin_update_story_taxonomy',
  'sf_forbid_mentor_note_delete',
  'sf_mentor_notes_enabled',
  'sf_b1_511_capabilities',
  'sf_can_review_submitted_story',
  'sf_create_mentor_note',
  'sf_update_mentor_note',
  'sf_publish_mentor_note',
  'sf_archive_mentor_note',
  'sf_list_mentor_notes',
  'sf_prepare_mentor_note_audio',
  'sf_begin_mentor_note_audio',
  'sf_complete_mentor_note_audio',
  'sf_fail_mentor_note_audio',
  'sf_get_mentor_note_audio',
  'sf_discard_mentor_note',
  'sf_complete_mentor_note_audio_delete',
];

function extractFunction(source, functionName) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
  const endMarker = '\n$$;';
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${functionName} definition must exist`);
  assert.notEqual(end, -1, `${functionName} definition must terminate`);
  return source.slice(start, end + endMarker.length);
}

test('B1-511 CREATE OR REPLACE contracts remain repeatable after initial migration', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  try {
    const source = readFileSync(
      path.join(database.packageDir, 'infra/postgres/migrations', migrationName),
      'utf8',
    );
    assert.equal(repeatableFunctions.length, 22);
    for (const functionName of repeatableFunctions) {
      await assert.doesNotReject(
        database.client.query(extractFunction(source, functionName)),
        `${functionName} must remain safely replaceable`,
      );
    }
  } finally {
    await database.stop();
  }
});

test('B1-511 taxonomy and priority are bounded, versioned, audited, and private', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const flags = await client.query(
      `SELECT key, scope, allowlist, cohorts
         FROM public.sf_feature_flags
        WHERE key = ANY($1::text[])
        ORDER BY key`,
      [[
        'story_workflow', 'story_taxonomy', 'inline_priority',
        'story_search', 'mentor_notes',
      ]],
    );
    assert.equal(flags.rowCount, 5);
    assert.ok(flags.rows.every((row) => (
      row.scope === 'off' && row.allowlist.length === 0 && row.cohorts.length === 0
    )));
    const privileges = await client.query(
      `SELECT
         has_table_privilege('authenticated', 'public.sf_mentor_notes', 'SELECT') AS note_read,
         has_table_privilege('authenticated', 'public.sf_mentor_note_media', 'SELECT') AS media_read,
         has_table_privilege(
           'authenticated', 'public.sf_mentor_note_audio_deletion_intents', 'SELECT'
         ) AS deletion_read,
         has_function_privilege(
           'authenticated',
           'public.sf_complete_mentor_note_audio_delete(uuid,text)',
           'EXECUTE'
         ) AS reviewer_delete_completion,
         has_function_privilege(
           'storyforge_app',
           'public.sf_complete_mentor_note_audio_delete(uuid,text)',
           'EXECUTE'
         ) AS service_delete_completion`,
    );
    assert.deepEqual(privileges.rows[0], {
      note_read: true,
      media_read: false,
      deletion_read: false,
      reviewer_delete_completion: true,
      service_delete_completion: false,
    });

    const stories = await client.query(
      `INSERT INTO public.sf_stories
         (student_id, title, original_text, current_text, status, archived_at, uses)
       VALUES
         ($1, 'Submitted story', 'Original', 'Current', 'awaiting', NULL, ARRAY['ps']),
         ($1, 'Private story', 'Private', 'Private', 'private', NULL, ARRAY['later']),
         ($1, 'Archived story', 'Archived', 'Archived', 'awaiting', now(), ARRAY[]::text[]),
         ($2, 'Other story', 'Other', 'Other', 'awaiting', NULL, ARRAY[]::text[])
       RETURNING id, title, row_version`,
      [STUDENT.sub, OTHER_STUDENT.sub],
    );
    const byTitle = Object.fromEntries(stories.rows.map((story) => [story.title, story]));

    await withIdentity(client, STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_update_story_taxonomy(
             $1, 0, ARRAY['clinical'], ARRAY['myeras_experiences'], 'library'
           )`,
          [byTitle['Submitted story'].id],
        ),
        (error) => error.code === '42501',
      );
    });

    await client.query(
      `UPDATE public.sf_feature_flags
          SET scope = 'eligible_all', updated_at = now()
        WHERE key IN ('story_taxonomy', 'inline_priority')`,
    );

    let taxonomyVersion;
    await withIdentity(client, STUDENT, async (identityClient) => {
      const result = await identityClient.query(
        `SELECT public.sf_update_story_taxonomy(
           $1, 0,
           ARRAY['research', 'clinical', 'clinical'],
           ARRAY['myeras_most_impactful', 'letter'],
           'library'
         ) AS payload`,
        [byTitle['Submitted story'].id],
      );
      assert.deepEqual(result.rows[0].payload.categories, ['clinical', 'research']);
      assert.deepEqual(result.rows[0].payload.uses, ['letter', 'myeras_most_impactful']);
      taxonomyVersion = Number(result.rows[0].payload.rowVersion);
    });
    await withIdentity(client, STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_update_story_taxonomy(
             $1, $2, ARRAY['not_allowed'], ARRAY[]::text[], 'library'
           )`,
          [byTitle['Submitted story'].id, taxonomyVersion],
        ),
        (error) => error.code === '22023',
      );
    });
    await withIdentity(client, STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_update_story_taxonomy(
             $1, 0, ARRAY['clinical'], ARRAY['ps'], 'library'
           )`,
          [byTitle['Other story'].id],
        ),
        (error) => error.code === 'P0002',
      );
    });
    await withIdentity(client, STUDENT, async (identityClient) => {
      const priority = await identityClient.query(
        `SELECT public.sf_update_story_priority($1, $2, 5::smallint, 'library') AS payload`,
        [byTitle['Submitted story'].id, taxonomyVersion],
      );
      assert.equal(priority.rows[0].payload.priority, 5);
      assert.equal(Number(priority.rows[0].payload.rowVersion), taxonomyVersion + 1);
    });
    await withIdentity(client, STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_update_story_priority($1, $2, 4::smallint, 'library')`,
          [byTitle['Submitted story'].id, taxonomyVersion],
        ),
        (error) => error.code === '40001',
      );
    });

    await withIdentity(client, ADMIN, async (identityClient) => {
      await identityClient.query(
        `SELECT public.sf_admin_set_console_flag('allowlist', ARRAY[$1::uuid])`,
        [ADMIN.sub],
      );
      const capabilities = await identityClient.query(
        'SELECT public.sf_b1_511_capabilities() AS payload',
      );
      assert.equal(capabilities.rows[0].payload.taxonomy, true);
      const submitted = await identityClient.query(
        `SELECT public.sf_admin_update_story_taxonomy(
           $1, $2, ARRAY['teaching'], ARRAY['iv'], 'workspace'
         ) AS payload`,
        [byTitle['Submitted story'].id, taxonomyVersion + 1],
      );
      assert.equal(Number(submitted.rows[0].payload.rowVersion), taxonomyVersion + 2);
    });
    await withIdentity(client, ADMIN, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_admin_update_story_taxonomy(
             $1, 0, ARRAY['personal'], ARRAY['ps'], 'workspace'
           )`,
          [byTitle['Private story'].id],
        ),
        (error) => error.code === 'P0002',
      );
    });
    await withIdentity(client, ADMIN, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_admin_update_story_taxonomy(
             $1, 0, ARRAY['personal'], ARRAY['ps'], 'workspace'
           )`,
          [byTitle['Archived story'].id],
        ),
        (error) => error.code === 'P0002',
      );
    });

    const audit = await client.query(
      `SELECT action FROM public.sf_audit_events
        WHERE story_id = $1
          AND action IN (
            'story.taxonomy_updated', 'story.student_priority_updated',
            'admin.story_taxonomy_updated'
          )
        ORDER BY id`,
      [byTitle['Submitted story'].id],
    );
    assert.deepEqual(audit.rows.map((row) => row.action), [
      'story.taxonomy_updated',
      'story.student_priority_updated',
      'admin.story_taxonomy_updated',
    ]);
  } finally {
    await database.stop();
  }
});

test('B1-511 explicit submission and awaiting withdrawal preserve privacy without an assignment', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    await client.query(
      `UPDATE public.sf_mentor_assignments
          SET active = false
        WHERE student_id = $1`,
      [OTHER_STUDENT.sub],
    );
    const stories = await client.query(
      `INSERT INTO public.sf_stories
         (student_id, title, original_text, current_text, status)
       VALUES
         ($1, 'Unassigned submission', 'Original', 'Ready to submit', 'private'),
         ($1, 'Still private', 'Private original', 'Private draft', 'private'),
         ($1, 'Already reviewing', 'Review original', 'Review copy', 'in_review')
       RETURNING id, title, row_version`,
      [OTHER_STUDENT.sub],
    );
    const byTitle = Object.fromEntries(stories.rows.map((story) => [story.title, story]));

    await withIdentity(client, OTHER_STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_submit_story($1, 'workspace')`,
          [byTitle['Unassigned submission'].id],
        ),
        (error) => error.code === '42501',
      );
    });
    await client.query(
      `UPDATE public.sf_feature_flags
          SET scope = 'eligible_all', updated_at = now()
        WHERE key = 'story_workflow'`,
    );

    let submittedAt;
    await withIdentity(client, OTHER_STUDENT, async (identityClient) => {
      const capabilities = await identityClient.query(
        'SELECT public.sf_b1_511_capabilities() AS payload',
      );
      assert.deepEqual(capabilities.rows[0].payload, {
        submissionReview: true,
        taxonomy: false,
        inlinePriority: false,
        storySearch: false,
        mentorNotes: false,
        mentorNotesRead: false,
      });
      const submitted = await identityClient.query(
        `SELECT to_jsonb(public.sf_submit_story($1, 'workspace')) AS payload`,
        [byTitle['Unassigned submission'].id],
      );
      assert.equal(submitted.rows[0].payload.status, 'awaiting');
      assert.equal(Number(submitted.rows[0].payload.row_version), 1);
      submittedAt = new Date(submitted.rows[0].payload.submitted_at);
    });

    await withIdentity(client, ADMIN, async (identityClient) => {
      await identityClient.query(
        `SELECT public.sf_admin_set_console_flag('allowlist', ARRAY[$1::uuid])`,
        [ADMIN.sub],
      );
      const visible = await identityClient.query(
        'SELECT public.sf_admin_story_detail($1) AS payload',
        [byTitle['Unassigned submission'].id],
      );
      assert.equal(visible.rows[0].payload.story.id, byTitle['Unassigned submission'].id);
    });
    await withIdentity(client, ADMIN, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          'SELECT public.sf_admin_story_detail($1)',
          [byTitle['Still private'].id],
        ),
        (error) => error.code === 'P0002',
      );
    });

    await withIdentity(client, MENTOR, async (identityClient) => {
      const direct = await identityClient.query(
        'SELECT id FROM public.sf_stories WHERE id = $1',
        [byTitle['Unassigned submission'].id],
      );
      assert.equal(direct.rowCount, 0, 'mentor access remains assignment-bound');
    });

    await withIdentity(client, OTHER_STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT to_jsonb(public.sf_withdraw_story($1, 0, 'workspace'))`,
          [byTitle['Unassigned submission'].id],
        ),
        (error) => error.code === '40001',
      );
    });
    await withIdentity(client, OTHER_STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT to_jsonb(public.sf_withdraw_story($1, 0, 'workspace'))`,
          [byTitle['Already reviewing'].id],
        ),
        (error) => error.code === '23514',
      );
    });
    await withIdentity(client, OTHER_STUDENT, async (identityClient) => {
      const withdrawn = await identityClient.query(
        `SELECT to_jsonb(public.sf_withdraw_story($1, 1, 'workspace')) AS payload`,
        [byTitle['Unassigned submission'].id],
      );
      assert.equal(withdrawn.rows[0].payload.status, 'private');
      assert.equal(Number(withdrawn.rows[0].payload.row_version), 2);
      assert.equal(
        new Date(withdrawn.rows[0].payload.submitted_at).toISOString(),
        submittedAt.toISOString(),
      );
      assert.equal(withdrawn.rows[0].payload.last_submitted_at, null);
    });

    await withIdentity(client, ADMIN, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          'SELECT public.sf_admin_story_detail($1)',
          [byTitle['Unassigned submission'].id],
        ),
        (error) => error.code === 'P0002',
      );
    });
    const history = await client.query(
      `SELECT action
         FROM public.sf_audit_events
        WHERE story_id = $1
          AND action IN ('story.submitted', 'story.withdrawn')
        ORDER BY id`,
      [byTitle['Unassigned submission'].id],
    );
    assert.deepEqual(history.rows.map((row) => row.action), [
      'story.submitted', 'story.withdrawn',
    ]);
  } finally {
    await database.stop();
  }
});

test('B1-511 mentor notes and media enforce submitted-story and direct-ID privacy', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const stories = await client.query(
      `INSERT INTO public.sf_stories
         (student_id, title, original_text, current_text, status)
       VALUES
         ($1, 'Submitted story', 'Original', 'Current', 'awaiting'),
         ($1, 'Private story', 'Private', 'Private', 'private')
       RETURNING id, title`,
      [STUDENT.sub],
    );
    const byTitle = Object.fromEntries(stories.rows.map((story) => [story.title, story.id]));
    await client.query(
      `UPDATE public.sf_feature_flags SET scope = 'eligible_all', updated_at = now()
        WHERE key = 'mentor_notes'`,
    );
    await withIdentity(client, ADMIN, async (identityClient) => {
      await identityClient.query(
        `SELECT public.sf_admin_set_console_flag('allowlist', ARRAY[$1::uuid])`,
        [ADMIN.sub],
      );
    });

    let noteId;
    let internalNoteId;
    await withIdentity(client, MENTOR, async (identityClient) => {
      const created = await identityClient.query(
        `SELECT public.sf_create_mentor_note($1, 'Draft feedback', false, 'workspace') AS payload`,
        [byTitle['Submitted story']],
      );
      noteId = created.rows[0].payload.id;
      assert.equal(created.rows[0].payload.state, 'draft');
      assert.equal(created.rows[0].payload.internalOnly, false);
      const internal = await identityClient.query(
        `SELECT public.sf_create_mentor_note(
           $1, 'Reviewer-only note', true, 'workspace'
         ) AS payload`,
        [byTitle['Submitted story']],
      );
      internalNoteId = internal.rows[0].payload.id;
      assert.equal(internal.rows[0].payload.internalOnly, true);
    });
    await withIdentity(client, MENTOR, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_publish_mentor_note($1, 0, 'workspace')`,
          [internalNoteId],
        ),
        (error) => error.code === '42501',
      );
    });
    await withIdentity(client, MENTOR, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_create_mentor_note($1, 'Must stay private', false, 'workspace')`,
          [byTitle['Private story']],
        ),
        (error) => error.code === 'P0002',
      );
    });

    await withIdentity(client, UNASSIGNED_MENTOR, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_create_mentor_note($1, 'Denied', false, 'workspace')`,
          [byTitle['Submitted story']],
        ),
        (error) => error.code === 'P0002',
      );
    });
    await withIdentity(client, UNASSIGNED_MENTOR, async (identityClient) => {
      const direct = await identityClient.query(
        'SELECT id FROM public.sf_mentor_notes WHERE id = $1',
        [noteId],
      );
      assert.equal(direct.rowCount, 0);
    });

    for (const identity of [STUDENT, OTHER_STUDENT]) {
      await withIdentity(client, identity, async (identityClient) => {
        const direct = await identityClient.query(
          'SELECT id FROM public.sf_mentor_notes WHERE id = $1',
          [noteId],
        );
        assert.equal(direct.rowCount, 0, 'draft note must be denied by direct ID');
      });
    }

    const objectKey = `storyforge-mentor-notes/${MENTOR.sub}/${STUDENT.sub}/${byTitle['Submitted story']}/${noteId}/12345678-1234-4234-8234-123456789abc.webm`;
    await withIdentity(client, MENTOR, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          `SELECT public.sf_begin_mentor_note_audio(
             $1, 0, 'student-audio/wrong.webm', 'audio/webm', 1024, 'workspace'
           )`,
          [noteId],
        ),
        (error) => error.code === '22023',
      );
    });
    await withIdentity(client, MENTOR, async (identityClient) => {
      const begun = await identityClient.query(
        `SELECT public.sf_begin_mentor_note_audio(
           $1, 0, $2, 'audio/webm', 1024, 'workspace'
         ) AS payload`,
        [noteId, objectKey],
      );
      assert.equal(begun.rows[0].payload.state, 'pending');
      const complete = await identityClient.query(
        `SELECT public.sf_complete_mentor_note_audio(
           $1, 1, $2, 'Editable transcript', 'provider', 'model', 'workspace'
         ) AS payload`,
        [noteId, objectKey],
      );
      assert.equal(complete.rows[0].payload.body, 'Editable transcript');
      const published = await identityClient.query(
        `SELECT public.sf_publish_mentor_note($1, 2, 'workspace') AS payload`,
        [noteId],
      );
      assert.equal(published.rows[0].payload.state, 'published');
    });

    await withIdentity(client, STUDENT, async (identityClient) => {
      const direct = await identityClient.query(
        'SELECT id, body, state FROM public.sf_mentor_notes WHERE id = $1',
        [noteId],
      );
      assert.deepEqual(direct.rows, [{
        id: noteId,
        body: 'Editable transcript',
        state: 'published',
      }]);
      const notes = await identityClient.query(
        'SELECT public.sf_list_mentor_notes($1) AS payload',
        [byTitle['Submitted story']],
      );
      assert.deepEqual(notes.rows[0].payload.map((note) => note.id), [noteId]);
      assert.equal(Object.hasOwn(notes.rows[0].payload[0], 'internalOnly'), false);
      const audio = await identityClient.query(
        'SELECT public.sf_get_mentor_note_audio($1) AS payload',
        [noteId],
      );
      assert.equal(audio.rows[0].payload.objectKey, objectKey);
    });
    await withIdentity(client, STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          'SELECT object_key FROM public.sf_mentor_note_media WHERE note_id = $1',
          [noteId],
        ),
        (error) => error.code === '42501',
      );
    });

    await withIdentity(client, MENTOR, async (identityClient) => {
      const notes = await identityClient.query(
        'SELECT public.sf_list_mentor_notes($1) AS payload',
        [byTitle['Submitted story']],
      );
      const internal = notes.rows[0].payload.find((note) => note.id === internalNoteId);
      assert.equal(internal.internalOnly, true);
      assert.equal(internal.state, 'draft');
    });

    await withIdentity(client, OTHER_STUDENT, async (identityClient) => {
      const direct = await identityClient.query(
        'SELECT id FROM public.sf_mentor_notes WHERE id = $1',
        [noteId],
      );
      assert.equal(direct.rowCount, 0);
      await assert.rejects(
        identityClient.query('SELECT public.sf_get_mentor_note_audio($1)', [noteId]),
        (error) => error.code === 'P0002',
      );
    });

    let discardedNoteId;
    let discardedObjectKey;
    await withIdentity(client, MENTOR, async (identityClient) => {
      const created = await identityClient.query(
        `SELECT public.sf_create_mentor_note($1, '', false, 'workspace') AS payload`,
        [byTitle['Submitted story']],
      );
      discardedNoteId = created.rows[0].payload.id;
      discardedObjectKey = `storyforge-mentor-notes/${MENTOR.sub}/${STUDENT.sub}/${byTitle['Submitted story']}/${discardedNoteId}/abcdef12-3456-4789-8abc-def123456789.webm`;
      await identityClient.query(
        `SELECT public.sf_begin_mentor_note_audio(
           $1, 0, $2, 'audio/webm', 512, 'workspace'
         )`,
        [discardedNoteId, discardedObjectKey],
      );
      const discarded = await identityClient.query(
        `SELECT public.sf_discard_mentor_note($1, 1, 'workspace') AS payload`,
        [discardedNoteId],
      );
      assert.equal(discarded.rows[0].payload.state, 'archived');
      assert.equal(discarded.rows[0].payload.objectKey, discardedObjectKey);
    });

    await withIdentity(client, STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          'SELECT public.sf_complete_mentor_note_audio_delete($1, $2)',
          [discardedNoteId, discardedObjectKey],
        ),
        (error) => error.code === '42501',
      );
    });
    await withIdentity(client, MENTOR, async (identityClient) => {
      await identityClient.query(
        'SELECT public.sf_complete_mentor_note_audio_delete($1, $2)',
        [discardedNoteId, discardedObjectKey],
      );
    });
    const deletion = await client.query(
      `SELECT state, attempts, resolved_at IS NOT NULL AS resolved
         FROM public.sf_mentor_note_audio_deletion_intents
        WHERE note_id = $1`,
      [discardedNoteId],
    );
    assert.deepEqual(deletion.rows, [{ state: 'deleted', attempts: 1, resolved: true }]);
  } finally {
    await database.stop();
  }
});
