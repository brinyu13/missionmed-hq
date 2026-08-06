import assert from 'node:assert/strict';
import test from 'node:test';

import { startEphemeralStoryForgeDatabase, withIdentity } from './helpers/ephemeral-postgres.mjs';

const STUDENT = { sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101 };
const OTHER = { sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102 };
const MENTOR = { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'mentor', wpUserId: 2101 };
const ADMIN = { sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'admin', wpUserId: 3101 };

test('B1-512 private story media is owner-bound and submitted admin access remains bounded', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const privilege = await client.query(`SELECT
      has_table_privilege('authenticated', 'public.sf_story_media', 'SELECT') media_read,
      has_table_privilege('authenticated', 'public.sf_story_media_deletion_intents', 'SELECT') intent_read`);
    assert.deepEqual(privilege.rows[0], { media_read: false, intent_read: false });

    const inserted = await client.query(
      `INSERT INTO public.sf_stories(student_id,title,original_text,current_text,status)
       VALUES ($1,'Private media story','Original','Current','private') RETURNING id`,
      [STUDENT.sub],
    );
    const storyId = inserted.rows[0].id;
    const mediaId = '51200000-0000-4512-8512-000000000010';
    await withIdentity(client, STUDENT, async (identityClient) => {
      const allocation = await identityClient.query(
        `SELECT public.sf_allocate_story_media($1,$2,'image/png',1024,'A private image') media`,
        [storyId, mediaId],
      );
      assert.match(allocation.rows[0].media.uploadObjectKey, /^storyforge-media\/pending\//);
      await identityClient.query(
        `SELECT public.sf_commit_story_media($1,$2,'etag',NULL)`,
        [mediaId, `storyforge-media/${STUDENT.sub}/${storyId}/${mediaId}.png`],
      );
      const listed = await identityClient.query('SELECT public.sf_list_story_media($1) media', [storyId]);
      assert.equal(listed.rows[0].media.length, 1);
    });

    for (const identity of [OTHER, MENTOR]) {
      await withIdentity(client, identity, async (identityClient) => {
        await assert.rejects(
          identityClient.query('SELECT public.sf_list_story_media($1)', [storyId]),
          (error) => error.code === 'P0002',
        );
      });
      await withIdentity(client, identity, async (identityClient) => {
        await assert.rejects(
          identityClient.query('SELECT public.sf_story_media_playback_claim($1)', [mediaId]),
          (error) => error.code === 'P0002',
        );
      });
    }

    await withIdentity(client, ADMIN, async (identityClient) => {
      await identityClient.query(`SELECT public.sf_admin_set_console_flag('allowlist', ARRAY[$1::uuid])`, [ADMIN.sub]);
    });
    await withIdentity(client, ADMIN, async (identityClient) => {
      await assert.rejects(
        identityClient.query('SELECT public.sf_list_story_media($1)', [storyId]),
        (error) => error.code === 'P0002',
      );
    });

    await client.query(`UPDATE public.sf_stories SET status='awaiting' WHERE id=$1`, [storyId]);
    await withIdentity(client, ADMIN, async (identityClient) => {
      const listed = await identityClient.query('SELECT public.sf_list_story_media($1) media', [storyId]);
      assert.equal(listed.rows[0].media.length, 1);
    });
    await client.query(`UPDATE public.sf_stories SET archived_at=now() WHERE id=$1`, [storyId]);
    await withIdentity(client, STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query('SELECT public.sf_list_story_media($1)', [storyId]),
        (error) => error.code === 'P0002',
      );
    });
  } finally {
    await database.stop();
  }
});

test('B1-512 media deletion uses a durable intent and removes browser-visible access first', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const story = await client.query(
      `INSERT INTO public.sf_stories(student_id,title,original_text,current_text,status)
       VALUES ($1,'Delete media','Original','Current','private') RETURNING id`,
      [STUDENT.sub],
    );
    const storyId = story.rows[0].id;
    const mediaId = '51200000-0000-4512-8512-000000000011';
    await withIdentity(client, STUDENT, async (identityClient) => {
      await identityClient.query(`SELECT public.sf_allocate_story_media($1,$2,'image/jpeg',100,'')`, [storyId, mediaId]);
      await identityClient.query(`SELECT public.sf_commit_story_media($1,$2,'etag',NULL)`, [mediaId, `storyforge-media/${STUDENT.sub}/${storyId}/${mediaId}.jpg`]);
      const begun = await identityClient.query('SELECT public.sf_begin_story_media_delete($1) intent', [mediaId]);
      const intentId = begun.rows[0].intent.intentId;
      const hidden = await identityClient.query('SELECT public.sf_list_story_media($1) media', [storyId]);
      assert.equal(hidden.rows[0].media.length, 0);
      await identityClient.query('SELECT public.sf_resolve_story_media_delete($1,true)', [intentId]);
    });
    const receipt = await client.query(
      `SELECT intent.state, media.state media_state, media.object_key
       FROM public.sf_story_media_deletion_intents intent JOIN public.sf_story_media media ON media.id=intent.media_id
       WHERE media.id=$1`,
      [mediaId],
    );
    assert.deepEqual(receipt.rows[0], { state: 'resolved', media_state: 'deleted', object_key: null });
  } finally {
    await database.stop();
  }
});

test('B1-512 versioned configuration accepts active custom taxonomy and enforces required submission fields', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const current = await client.query(`SELECT payload, row_version FROM public.sf_storyforge_configuration WHERE key='content_display'`);
    const payload = current.rows[0].payload;
    payload.taxonomy.categories.push({ id: '51200000-0000-4512-8512-000000000099', label: 'Custom category', sortOrder: 120, state: 'active', builtin: false });
    payload.sections.learningLesson.mode = 'visible_required';
    await withIdentity(client, ADMIN, async (identityClient) => {
      const published = await identityClient.query(
        'SELECT public.sf_publish_storyforge_configuration($1::jsonb,$2) configuration',
        [JSON.stringify(payload), Number(current.rows[0].row_version)],
      );
      assert.equal(Number(published.rows[0].configuration.rowVersion), 1);
    });
    await client.query(`UPDATE public.sf_feature_flags SET scope='eligible_all' WHERE key IN ('story_taxonomy','story_workflow')`);
    const story = await client.query(
      `INSERT INTO public.sf_stories(student_id,title,original_text,current_text,status,lesson)
       VALUES ($1,'Configured story','Original','Current text','private','') RETURNING id,row_version`,
      [STUDENT.sub],
    );
    await withIdentity(client, STUDENT, async (identityClient) => {
      const updated = await identityClient.query(
        `SELECT public.sf_update_story_taxonomy_configured($1,$2,$3::text[],ARRAY[]::text[],'workspace',false) payload`,
        [story.rows[0].id, story.rows[0].row_version, ['51200000-0000-4512-8512-000000000099']],
      );
      assert.deepEqual(updated.rows[0].payload.categories, ['51200000-0000-4512-8512-000000000099']);
    });
    await withIdentity(client, STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(`SELECT public.sf_submit_story($1,'workspace')`, [story.rows[0].id]),
        (error) => error.code === '23514' && /Learning Lesson/.test(error.message),
      );
    });
  } finally {
    await database.stop();
  }
});
