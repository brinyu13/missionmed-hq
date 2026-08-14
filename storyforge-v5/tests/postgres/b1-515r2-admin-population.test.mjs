import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migrationSql,
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const OWNER = { sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101 };
const PEER = { sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102 };
const THIRD = { sub: '33333333-3333-4333-8333-333333333333', role: 'student', wpUserId: 1103 };
const ADMIN = {
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'admin', wpUserId: 3101,
  wordpressAdmin: true, adminMode: true,
};
const AVATAR = '55555555-5555-4555-8555-555555555555';
const generations = [
  '66666666-6666-4666-8666-666666666661',
  '66666666-6666-4666-8666-666666666662',
  '66666666-6666-4666-8666-666666666663',
  '66666666-6666-4666-8666-666666666664',
  '66666666-6666-4666-8666-666666666665',
];
const missingStudent = '99999999-9999-4999-8999-999999999999';
const missingStory = '88888888-8888-4888-8888-888888888888';

const migrations = [
  '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql',
  '20260810200000_b1_514_v2_r2_story_versions_provenance.sql',
  '20260810210000_b1_514_v2_r3_inspiration.sql',
  '20260810220000_b1_514_v2_ra_requests_guest.sql',
  '20260810230000_b1_514_v2_preferences_environments.sql',
  '20260810240000_b1_514_v2_ra_lifecycle_completion.sql',
  '20260810250000_b1_514_v21_authored_segment_writes.sql',
  '20260810260000_b1_514_guest_voice_contributions.sql',
  '20260810270000_b1_514_request_delivery_attempts.sql',
  '20260810280000_b1_514_guest_voice_cleanup_recovery.sql',
  '20260812120000_b1_515_v201_reviews_collections_peer.sql',
  '20260813120000_b1_515r_admin_subject_masterkey.sql',
  '20260813130000_b1_515r_action_center_contribution_review.sql',
  '20260813140000_b1_515r_arena_avatar_directory_groups.sql',
  '20260813150000_b1_515r_inspiration_recommendation_publish_fix.sql',
  '20260814120000_b1_515r2_admin_population_avatar_sound.sql',
];

function populationEntry(identity, { avatar = false } = {}) {
  return {
    storyforge_uuid: identity.sub,
    wp_user_id: identity.wpUserId,
    arena_avatar_id: avatar ? AVATAR : '',
    arena_avatar_thumbnail_url: avatar
      ? 'https://cdn.missionmedinstitute.com/avatars/current.webp' : '',
  };
}

async function syncPopulation(
  client, generationId, entries, avatarAuthorityAvailable = true, observedAt = null,
) {
  return withRole(client, 'storyforge_app', async (db) => (
    await db.query(
      `SELECT public.sf_sync_admin_population_snapshot(
         'match_mentorship_360',$1,coalesce($4::timestamptz,now()),
         'mmhq_cam_build_entitlement',3893,$2::jsonb,$3
       ) AS payload`,
      [generationId, JSON.stringify(entries), avatarAuthorityAvailable, observedAt],
    )
  ).rows[0].payload);
}

async function expectNotFound(operation, message) {
  await assert.rejects(operation, (error) => error?.code === 'P0002' && error?.message === message);
}

test('B1-515R2 population is current, centralized, fail-closed, and independently proven', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    const additiveTableCounts = (await client.query(
      `SELECT
         (SELECT count(*)::int FROM public.sf_account_preferences) AS account_preferences,
         (SELECT count(*)::int FROM public.sf_admin_population_settings) AS population_settings,
         (SELECT count(*)::int FROM public.sf_entitlement_population_projection) AS population_projection,
         (SELECT count(*)::int FROM public.sf_entitlement_population_sync_state) AS population_sync_state`,
    )).rows[0];
    assert.deepEqual(additiveTableCounts, {
      account_preferences: 0,
      population_settings: 0,
      population_projection: 0,
      population_sync_state: 0,
    });
    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all',allowlist='{}',cohorts='{}'
       WHERE key IN(
         'admin_console','admin_directory','admin_review_controls','avatar_identity',
         'activity_tracking','story_archive','mentor_notes'
       )`,
    );
    await client.query(
      `INSERT INTO public.sf_users(id,wp_user_id,display_name,role,eligible,cohort)
       VALUES($1,$2,'Zed Student','student',true,'2028')`,
      [THIRD.sub, THIRD.wpUserId],
    );
    const inserted = await client.query(
      `INSERT INTO public.sf_stories(
         student_id,title,original_text,current_text,status,visibility,last_submitted_at
       ) VALUES
       ($1,'Owner one','owner','owner','awaiting',NULL,now()-interval '3 days'),
       ($1,'Owner two','owner','owner','in_review',NULL,now()-interval '2 days'),
       ($1,'Owner three','owner','owner','reviewed',NULL,now()-interval '1 day'),
       ($1,'Owner private','owner','owner','awaiting','private',now()),
       ($1,'Owner archived','owner','owner','awaiting',NULL,now()),
       ($2,'Peer story','peer sentinel','peer sentinel','awaiting',NULL,now()),
       ($3,'Third story','third','third','awaiting',NULL,now())
       RETURNING id,title,row_version`,
      [OWNER.sub, PEER.sub, THIRD.sub],
    );
    const stories = Object.fromEntries(inserted.rows.map((row) => [row.title, row]));
    await client.query(
      'UPDATE public.sf_stories SET archived_at=now(),archived_by=$1 WHERE id=$2',
      [ADMIN.sub, stories['Owner archived'].id],
    );

    const privateNote = (await client.query(
      `INSERT INTO public.sf_mentor_notes(
         story_id,student_id,author_id,body,internal_only,state,published_at
       ) VALUES($1,$2,$2,'private owner note',false,'published',now()) RETURNING id`,
      [stories['Owner private'].id, OWNER.sub],
    )).rows[0];
    const outPopulationNote = (await client.query(
      `INSERT INTO public.sf_mentor_notes(
         story_id,student_id,author_id,body,internal_only,state
       ) VALUES($1,$2,$3,'out of population note',false,'draft') RETURNING id,row_version`,
      [stories['Peer story'].id, PEER.sub, ADMIN.sub],
    )).rows[0];
    await client.query(
      `INSERT INTO public.sf_story_internal_notes(story_id,admin_id,body)
       VALUES($1,$2,'private internal note')`,
      [stories['Owner private'].id, ADMIN.sub],
    );
    const outPopulationStoryMediaId = '77777777-7777-4777-8777-777777777773';
    const privateStoryMediaId = '77777777-7777-4777-8777-777777777774';
    await client.query(
      `INSERT INTO public.sf_story_media(
         id,story_id,student_id,media_kind,mime_type,byte_size,
         object_key,upload_object_key,state,verified_at
       ) VALUES
       ($1,$2,$3,'photo','image/webp',1,'storyforge-media/out-pop.webp','storyforge-media/out-pop.upload', 'verified',now()),
       ($4,$5,$6,'photo','image/webp',1,'storyforge-media/private.webp','storyforge-media/private.upload','verified',now())`,
      [
        outPopulationStoryMediaId, stories['Peer story'].id, PEER.sub,
        privateStoryMediaId, stories['Owner private'].id, OWNER.sub,
      ],
    );
    const privateMediaId = '77777777-7777-4777-8777-777777777771';
    const privateObjectId = '77777777-7777-4777-8777-777777777772';
    await client.query(
      `INSERT INTO public.sf_mentor_note_media(
         id,note_id,author_id,student_id,story_id,object_key,content_type,byte_size,state,verified_at
       ) VALUES($1,$2,$3,$3,$4,$5,'audio/webm',1,'verified',now())`,
      [
        privateMediaId,
        privateNote.id,
        OWNER.sub,
        stories['Owner private'].id,
        `storyforge-mentor-notes/${OWNER.sub}/${OWNER.sub}/${stories['Owner private'].id}/${privateNote.id}/${privateObjectId}.webm`,
      ],
    );
    await client.query(
      `INSERT INTO public.sf_story_trash(story_id,student_id,trashed_by)
       VALUES($1,$2,$2)`,
      [stories['Owner private'].id, OWNER.sub],
    );
    await client.query(
      `INSERT INTO public.sf_audit_events(
         actor_id,actor_role,actor_display,action,entity_type,entity_id,surface,
         student_id,story_id,visibility
       ) VALUES($1,'admin','Founder','test.private_visibility_probe','story',$2,'system',$3,$2,'admin_only')`,
      [ADMIN.sub, stories['Owner private'].id, OWNER.sub],
    );

    const emptyDirectory = await withIdentity(client, ADMIN, async (db) => (
      await db.query("SELECT public.sf_admin_directory('', 'all', '', 'name', 1, 25) AS payload")
    ).rows[0].payload);
    assert.equal(emptyDirectory.total, 0);
    const emptyHome = await withIdentity(client, ADMIN, async (db) => (
      await db.query('SELECT public.sf_admin_home(8) AS payload')
    ).rows[0].payload);
    assert.equal(emptyHome.metrics.submittedStories, 0);

    const firstSync = await syncPopulation(client, generations[0], [
      populationEntry(OWNER, { avatar: true }),
    ]);
    assert.equal(firstSync.memberCount, 1);
    assert.equal(firstSync.avatarCount, 1);
    const verified = await withRole(client, 'storyforge_app', async (db) => (
      await db.query(
        "SELECT public.sf_verify_admin_population_snapshot('match_mentorship_360',$1,ARRAY[$2]::uuid[]) AS payload",
        [generations[0], OWNER.sub],
      )
    ).rows[0].payload);
    assert.equal(verified.verified, 1);
    await assert.rejects(
      syncPopulation(client, generations[0], [populationEntry(OWNER)]),
      (error) => error?.code === '22023' && /replayed/.test(error.message),
    );
    await assert.rejects(
      syncPopulation(
        client, generations[1], [populationEntry(PEER)], true,
        new Date(Date.parse(firstSync.observedAt) - 1000).toISOString(),
      ),
      (error) => error?.code === '22023' && /stale/.test(error.message),
    );
    await assert.rejects(
      syncPopulation(
        client, generations[4], [populationEntry(PEER)], true,
        new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      ),
      (error) => error?.code === '22023' && /invalid canonical/.test(error.message),
    );
    assert.equal(
      (await client.query(
        'SELECT generation_id::text FROM public.sf_entitlement_population_sync_state',
      )).rows[0].generation_id,
      generations[0],
    );
    assert.deepEqual(
      (await client.query(
        'SELECT student_id::text FROM public.sf_entitlement_population_projection ORDER BY student_id',
      )).rows.map((row) => row.student_id),
      [OWNER.sub],
    );

    const hostileAuditBefore = Number(
      (await client.query('SELECT count(*) FROM public.sf_audit_events')).rows[0].count,
    );
    const hostileNotificationBefore = Number(
      (await client.query('SELECT count(*) FROM public.sf_notifications')).rows[0].count,
    );
    const hostileNoteBefore = (await client.query(
      'SELECT body,state,row_version FROM public.sf_mentor_notes WHERE id=$1', [outPopulationNote.id],
    )).rows[0];
    const hostileMediaBefore = Number(
      (await client.query('SELECT count(*) FROM public.sf_mentor_note_media')).rows[0].count,
    );

    for (const [storyId, mediaId] of [
      [stories['Peer story'].id, outPopulationStoryMediaId],
      [stories['Owner private'].id, privateStoryMediaId],
    ]) {
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query('SELECT public.sf_list_story_media($1)', [storyId])),
        'story media not found',
      );
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query(
          'SELECT public.sf_story_media_playback_claim($1)', [mediaId],
        )),
        'story media not found',
      );
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query(
          "SELECT public.sf_create_mentor_note($1,'probe',false,'workspace')", [storyId],
        )),
        'submitted story not found',
      );
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query('SELECT public.sf_list_mentor_notes($1)', [storyId])),
        'submitted story not found',
      );
    }
    for (const noteId of [outPopulationNote.id, privateNote.id]) {
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query(
          'SELECT public.sf_get_mentor_note_audio($1)', [noteId],
        )),
        'mentor note audio not found',
      );
    }
    const noteObjectKey = `storyforge-mentor-notes/${ADMIN.sub}/${PEER.sub}/${stories['Peer story'].id}/${outPopulationNote.id}/77777777-7777-4777-8777-777777777775.webm`;
    const noteMutationCalls = [
      (db) => db.query(
        "SELECT public.sf_update_mentor_note($1,$2,'updated','workspace')",
        [outPopulationNote.id, outPopulationNote.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_publish_mentor_note($1,$2,'workspace')",
        [outPopulationNote.id, outPopulationNote.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_archive_mentor_note($1,$2,'workspace')",
        [outPopulationNote.id, outPopulationNote.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_prepare_mentor_note_audio($1,$2,'audio/webm',1,'workspace')",
        [outPopulationNote.id, outPopulationNote.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_begin_mentor_note_audio($1,$2,$3,'audio/webm',1,'workspace')",
        [outPopulationNote.id, outPopulationNote.row_version, noteObjectKey],
      ),
      (db) => db.query(
        "SELECT public.sf_complete_mentor_note_audio($1,$2,$3,'transcript','provider','model','workspace')",
        [outPopulationNote.id, outPopulationNote.row_version, noteObjectKey],
      ),
      (db) => db.query(
        "SELECT public.sf_fail_mentor_note_audio($1,$2,'failure','workspace')",
        [outPopulationNote.id, noteObjectKey],
      ),
      (db) => db.query(
        "SELECT public.sf_discard_mentor_note($1,$2,'workspace')",
        [outPopulationNote.id, outPopulationNote.row_version],
      ),
    ];
    for (const call of noteMutationCalls) {
      await expectNotFound(withIdentity(client, ADMIN, call), 'mentor note not found');
    }
    assert.equal(
      Number((await client.query('SELECT count(*) FROM public.sf_audit_events')).rows[0].count),
      hostileAuditBefore,
    );
    assert.equal(
      Number((await client.query('SELECT count(*) FROM public.sf_notifications')).rows[0].count),
      hostileNotificationBefore,
    );
    assert.deepEqual(
      (await client.query(
        'SELECT body,state,row_version FROM public.sf_mentor_notes WHERE id=$1', [outPopulationNote.id],
      )).rows[0],
      hostileNoteBefore,
    );
    assert.equal(
      Number((await client.query('SELECT count(*) FROM public.sf_mentor_note_media')).rows[0].count),
      hostileMediaBefore,
    );

    const privateStory = stories['Owner private'];
    const archivedStory = stories['Owner archived'];
    const privateAdminCalls = [
      (db) => db.query('SELECT public.sf_admin_story_detail($1)', [privateStory.id]),
      (db) => db.query(
        "SELECT public.sf_admin_review_story($1,$2,'{}'::jsonb,'workspace')",
        [privateStory.id, privateStory.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_admin_set_review_status_v201($1,$2,'reviewed')",
        [privateStory.id, privateStory.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_admin_save_use_reviews($1,$2,'[]'::jsonb)",
        [privateStory.id, privateStory.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_admin_set_story_publication($1,$2,'personal_statement',true,false)",
        [privateStory.id, privateStory.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_set_story_collection($1,$2,'active','library')",
        [privateStory.id, privateStory.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_update_story_taxonomy_configured($1,$2,'{}'::text[],'{}'::text[],'workspace',true)",
        [privateStory.id, privateStory.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_admin_update_story_taxonomy($1,$2,'{}'::text[],'{}'::text[],'workspace')",
        [privateStory.id, privateStory.row_version],
      ),
    ];
    for (const call of privateAdminCalls) {
      await expectNotFound(withIdentity(client, ADMIN, call), 'story not found');
    }

    for (const call of [
      (db) => db.query(
        "SELECT public.sf_admin_review_story($1,$2,'{}'::jsonb,'workspace')",
        [archivedStory.id, archivedStory.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_admin_set_story_publication($1,$2,'personal_statement',true,false)",
        [archivedStory.id, archivedStory.row_version],
      ),
      (db) => db.query(
        "SELECT public.sf_admin_update_story_taxonomy($1,$2,'{}'::text[],'{}'::text[],'workspace')",
        [archivedStory.id, archivedStory.row_version],
      ),
    ]) {
      await expectNotFound(withIdentity(client, ADMIN, call), 'story not found');
    }
    const restored = await withIdentity(client, ADMIN, async (db) => (
      await db.query(
        "SELECT public.sf_set_story_collection($1,$2,'active','library') AS payload",
        [archivedStory.id, archivedStory.row_version],
      )
    ).rows[0].payload);
    assert.equal(restored.collection, 'active');
    assert.equal(restored.archived_at, null);

    // Production intentionally exposes mentor-note media through bounded RPCs,
    // not direct SELECT. Temporarily grant SELECT only inside this disposable
    // database so the hostile explicit-private RLS branch itself is exercised.
    await client.query('GRANT SELECT ON public.sf_mentor_note_media TO authenticated');
    await withIdentity(client, ADMIN, async (db) => {
      assert.equal((await db.query(
        'SELECT id FROM public.sf_mentor_notes WHERE story_id=$1', [privateStory.id],
      )).rowCount, 0);
      assert.equal((await db.query(
        'SELECT id FROM public.sf_story_internal_notes WHERE story_id=$1', [privateStory.id],
      )).rowCount, 0);
      assert.equal((await db.query(
        'SELECT id FROM public.sf_mentor_note_media WHERE story_id=$1', [privateStory.id],
      )).rowCount, 0);
      assert.equal((await db.query(
        'SELECT story_id FROM public.sf_story_trash WHERE story_id=$1', [privateStory.id],
      )).rowCount, 0);
      assert.equal((await db.query(
        "SELECT id FROM public.sf_audit_events WHERE story_id=$1 AND action='test.private_visibility_probe'",
        [privateStory.id],
      )).rowCount, 0);
    });
    await withIdentity(client, OWNER, async (db) => {
      assert.equal((await db.query(
        'SELECT id FROM public.sf_mentor_notes WHERE id=$1', [privateNote.id],
      )).rowCount, 1);
      assert.equal((await db.query(
        'SELECT id FROM public.sf_mentor_note_media WHERE id=$1', [privateMediaId],
      )).rowCount, 1);
      assert.equal((await db.query(
        'SELECT story_id FROM public.sf_story_trash WHERE story_id=$1', [privateStory.id],
      )).rowCount, 1);
    });
    await client.query('REVOKE SELECT ON public.sf_mentor_note_media FROM authenticated');

    await withIdentity(client, ADMIN, async (db) => {
      const directory = (await db.query(
        "SELECT public.sf_admin_directory('', 'all', '', 'name', 1, 25) AS payload",
      )).rows[0].payload;
      assert.deepEqual(directory.students.map((row) => row.id), [OWNER.sub]);
      assert.equal(directory.students[0].storyCount, 4);
      assert.equal(directory.students[0].privateCount, 1);
      assert.deepEqual(directory.population.selectedKeys, ['match_mentorship_360']);
      assert.equal(directory.population.memberCount, 1);
      assert.deepEqual(directory.population.options.filter((option) => option.available).map((option) => option.key), [
        'match_mentorship_360',
      ]);
      const search = (await db.query(
        "SELECT public.sf_admin_search_students('',NULL,NULL,NULL,25) AS payload",
      )).rows[0].payload;
      assert.deepEqual(search.students.map((row) => row.id), [OWNER.sub]);
      assert.equal(search.students[0].storyCount, 4);
      const directoryStudent = (await db.query(
        'SELECT public.sf_admin_directory_student($1) AS payload', [OWNER.sub],
      )).rows[0].payload;
      assert.equal(directoryStudent.counts.total, 4);
      assert.equal(directoryStudent.counts.private, 1);
      assert.equal(directoryStudent.stories.some((story) => story.id === privateStory.id), false);
      const studentDetail = (await db.query(
        'SELECT public.sf_admin_student_detail($1,NULL,NULL,25) AS payload', [OWNER.sub],
      )).rows[0].payload;
      assert.equal(studentDetail.stories.length, 4);
      assert.equal(studentDetail.stories.some((story) => story.id === privateStory.id), false);
      const queue = (await db.query(
        "SELECT public.sf_admin_review_queue(NULL,NULL,NULL,NULL,25) AS payload",
      )).rows[0].payload;
      assert.ok(queue.stories.length === 4 && queue.stories.every((story) => story.studentId === OWNER.sub));
      const home = (await db.query('SELECT public.sf_admin_home(8) AS payload')).rows[0].payload;
      assert.equal(home.metrics.submittedStories, 4);
    });

    for (const denied of [PEER.sub, missingStudent]) {
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query('SELECT public.sf_admin_subject_home($1)', [denied])),
        'student not found',
      );
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query('SELECT public.sf_admin_student_detail($1,NULL,NULL,25)', [denied])),
        'student not found',
      );
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query('SELECT public.sf_admin_directory_student($1)', [denied])),
        'student not found',
      );
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query('SELECT public.sf_admin_activity_for_student($1)', [denied])),
        'student not found',
      );
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query('SELECT public.sf_record_review_check($1,true)', [denied])),
        'student not found',
      );
    }
    for (const denied of [stories['Peer story'].id, missingStory]) {
      await expectNotFound(
        withIdentity(client, ADMIN, (db) => db.query('SELECT public.sf_admin_story_detail($1)', [denied])),
        'story not found',
      );
    }

    const before = await client.query(
      `SELECT row_version,status FROM public.sf_stories WHERE id=$1`,
      [stories['Peer story'].id],
    );
    const auditBefore = Number((await client.query('SELECT count(*) FROM public.sf_audit_events')).rows[0].count);
    const notificationBefore = Number((await client.query('SELECT count(*) FROM public.sf_notifications')).rows[0].count);
    await expectNotFound(
      withIdentity(client, ADMIN, (db) => db.query(
        `SELECT public.sf_admin_review_story($1,0,'{"status":"in_review"}'::jsonb,'workspace')`,
        [stories['Peer story'].id],
      )),
      'story not found',
    );
    assert.deepEqual(
      (await client.query('SELECT row_version,status FROM public.sf_stories WHERE id=$1', [stories['Peer story'].id])).rows,
      before.rows,
    );
    assert.equal(Number((await client.query('SELECT count(*) FROM public.sf_audit_events')).rows[0].count), auditBefore);
    assert.equal(Number((await client.query('SELECT count(*) FROM public.sf_notifications')).rows[0].count), notificationBefore);

    await withIdentity(client, ADMIN, async (db) => {
      assert.deepEqual(
        (await db.query('SELECT id FROM public.sf_users WHERE role=\'student\' ORDER BY id')).rows.map((row) => row.id),
        [OWNER.sub],
      );
      assert.ok((await db.query('SELECT id FROM public.sf_stories WHERE id=$1', [stories['Peer story'].id])).rowCount === 0);
    });

    const narrowed = await withIdentity(client, ADMIN, async (db) => (
      await db.query("SELECT public.sf_admin_set_population_scope('{}'::text[]) AS payload")
    ).rows[0].payload);
    assert.deepEqual(narrowed.selectedKeys, []);
    await expectNotFound(
      withIdentity(client, ADMIN, (db) => db.query('SELECT public.sf_admin_subject_home($1)', [OWNER.sub])),
      'student not found',
    );
    await assert.rejects(
      withIdentity(client, ADMIN, (db) => db.query(
        "SELECT public.sf_admin_set_population_scope(ARRAY['registered_users'])",
      )),
      (error) => error?.code === '22023',
    );
    await withIdentity(client, ADMIN, (db) => db.query(
      "SELECT public.sf_admin_set_population_scope(ARRAY['match_mentorship_360'])",
    ));

    await syncPopulation(client, generations[1], [populationEntry(OWNER)], false);
    const preservedAvatar = (await client.query(
      `SELECT arena_avatar_id::text,arena_avatar_thumbnail_url FROM public.sf_users WHERE id=$1`,
      [OWNER.sub],
    )).rows[0];
    assert.deepEqual(preservedAvatar, {
      arena_avatar_id: AVATAR,
      arena_avatar_thumbnail_url: 'https://cdn.missionmedinstitute.com/avatars/current.webp',
    });
    await assert.rejects(
      syncPopulation(client, generations[2], [{
        ...populationEntry(OWNER),
        arena_avatar_id: AVATAR,
        arena_avatar_thumbnail_url: 'https://cdn.missionmedinstitute.com/avatars/current.webp?token=secret',
      }]),
      (error) => error?.code === '22023',
    );
    assert.equal(
      (await client.query('SELECT generation_id::text FROM public.sf_entitlement_population_sync_state')).rows[0].generation_id,
      generations[1],
    );

    await syncPopulation(client, generations[2], [
      populationEntry(OWNER), populationEntry(PEER), populationEntry(THIRD),
    ]);
    const groupPageOne = await withIdentity(client, ADMIN, async (db) => (
      await db.query(
        "SELECT public.sf_admin_review_queue_scaled('',NULL,'','student',1,1) AS payload",
      )
    ).rows[0].payload);
    const groupPageTwo = await withIdentity(client, ADMIN, async (db) => (
      await db.query(
        "SELECT public.sf_admin_review_queue_scaled('',NULL,'','student',2,1) AS payload",
      )
    ).rows[0].payload);
    assert.equal(groupPageOne.groupedBy, 'student');
    assert.equal(groupPageOne.total, 3);
    assert.equal(groupPageOne.pageSize, 1);
    assert.equal(groupPageOne.studentGroups.length, 1);
    assert.equal(groupPageOne.studentGroups[0].studentId, OWNER.sub);
    assert.equal(groupPageOne.studentGroups[0].stories.length, 4);
    assert.equal(groupPageOne.stories.length, 4);
    assert.equal(groupPageTwo.studentGroups.length, 1);
    assert.notEqual(groupPageTwo.studentGroups[0].studentId, OWNER.sub);

    await syncPopulation(client, generations[3], [populationEntry(PEER)]);
    await expectNotFound(
      withIdentity(client, ADMIN, (db) => db.query('SELECT public.sf_admin_subject_home($1)', [OWNER.sub])),
      'student not found',
    );
    assert.equal(await withIdentity(client, ADMIN, async (db) => (
      await db.query('SELECT public.sf_admin_subject_in_scope($1) AS value', [PEER.sub])
    ).rows[0].value), true);

    await client.query(
      "UPDATE public.sf_stories SET visibility='private' WHERE id=$1",
      [stories['Peer story'].id],
    );
    const reviewPreview = await withIdentity(client, ADMIN, async (db) => (
      await db.query('SELECT public.sf_record_review_check($1,true) AS payload', [PEER.sub])
    ).rows[0].payload);
    assert.equal(reviewPreview.sent, false);
    assert.match(reviewPreview.body, /no stories had been submitted/);
    const reviewSent = await withIdentity(client, ADMIN, async (db) => (
      await db.query('SELECT public.sf_record_review_check($1,false) AS payload', [PEER.sub])
    ).rows[0].payload);
    assert.equal(reviewSent.studentId, PEER.sub);
    assert.equal(reviewSent.sentBy, ADMIN.sub);
    assert.match(reviewSent.body, /no stories had been submitted/);
    const reviewAudit = (await client.query(
      `SELECT actor_id::text,student_id::text
       FROM public.sf_audit_events WHERE id=$1`, [reviewSent.auditEventId],
    )).rows[0];
    assert.deepEqual(reviewAudit, { actor_id: ADMIN.sub, student_id: PEER.sub });

    await assert.rejects(
      withRole(client, 'storyforge_app', (db) => db.query(
        `INSERT INTO public.sf_entitlement_population_projection(
           population_key,student_id,wp_user_id,generation_id,authority,course_id,observed_at
         ) VALUES('match_mentorship_360',$1,$2,$3,'mmhq_cam_build_entitlement',3893,now())`,
        [OWNER.sub, OWNER.wpUserId, generations[0]],
      )),
      (error) => error?.code === '42501',
    );
  } finally {
    await database.stop();
  }
});

test('Opening Sound is an isolated default-off account preference', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    assert.equal(await withIdentity(client, OWNER, async (db) => (
      await db.query('SELECT public.sf_opening_sound_preference() AS value')
    ).rows[0].value), false);
    assert.equal(await withIdentity(client, OWNER, async (db) => (
      await db.query('SELECT public.sf_set_opening_sound_preference(true) AS value')
    ).rows[0].value), true);
    assert.equal(await withIdentity(client, PEER, async (db) => (
      await db.query('SELECT public.sf_opening_sound_preference() AS value')
    ).rows[0].value), false);
    assert.equal(await withIdentity(client, OWNER, async (db) => (
      await db.query('SELECT public.sf_opening_sound_preference() AS value')
    ).rows[0].value), true);
    await assert.rejects(
      withIdentity(client, PEER, (db) => db.query(
        `UPDATE public.sf_account_preferences SET opening_sound_enabled=false WHERE user_id=$1`,
        [OWNER.sub],
      )),
      (error) => error?.code === '42501',
    );
  } finally {
    await database.stop();
  }
});
