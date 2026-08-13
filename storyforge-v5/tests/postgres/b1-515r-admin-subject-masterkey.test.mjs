import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migrationSql,
  startEphemeralStoryForgeDatabase,
  withIdentity,
} from './helpers/ephemeral-postgres.mjs';

const OWNER = { sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101 };
const PEER = { sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102 };
const OUTSIDER = { sub: '33333333-3333-4333-8333-333333333333', role: 'student', wpUserId: 1103 };
const INELIGIBLE = { sub: '44444444-4444-4444-8444-444444444444', role: 'student', wpUserId: 1104, eligible: false };
const MENTOR = { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'mentor', wpUserId: 2101 };
const ADMIN = {
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'admin', wpUserId: 3101,
  wordpressAdmin: true, adminMode: true,
};

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
];

async function expectStoryNotFound(operation) {
  await assert.rejects(
    operation,
    (error) => error?.code === 'P0002' && error?.message === 'story not found',
  );
}

test('B1-515R Admin actor + student subject reads are bounded, observable, and non-impersonating', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    await client.query(
      `UPDATE public.sf_users SET first_name='Maya',academic_year='PGY-1',specialty='Internal Medicine',application_cycle='2027' WHERE id=$1`,
      [OWNER.sub],
    );
    await client.query(
      `INSERT INTO public.sf_users(id,wp_user_id,display_name,role,eligible,cohort)
       VALUES($1,$2,'Outside Student','student',true,'Other'),
             ($3,$4,'Inactive Student','student',false,'2027')`,
      [OUTSIDER.sub, OUTSIDER.wpUserId, INELIGIBLE.sub, INELIGIBLE.wpUserId],
    );
    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all',allowlist='{}',cohorts='{}'
       WHERE key='admin_console'`,
    );
    await client.query(
      `UPDATE public.sf_feature_flags SET scope='allowlist',allowlist=ARRAY[$1]::uuid[],cohorts='{}'
       WHERE key IN('admin_directory','visibility_consent','story_versions')`,
      [OWNER.sub],
    );
    const inserted = await client.query(
      `INSERT INTO public.sf_stories(
         student_id,title,original_text,current_text,capture_type,status,visibility,updated_at
       ) VALUES
       ($1,'Legacy submitted','Legacy original','Legacy current','text','awaiting',NULL,now()),
       ($1,'Explicit private conflict','Secret conflict','Secret conflict','text','awaiting','private',now()-interval '1 minute'),
       ($1,'Mentor-visible draft','Visible draft','Visible draft','audio','private','mentor_visible',now()-interval '2 minutes'),
       ($1,'Ordinary private','Private bytes','Private bytes','text','private',NULL,now()-interval '3 minutes'),
       ($1,'Archived submitted','Archived bytes','Archived bytes','text','reviewed',NULL,now()-interval '4 minutes'),
       ($1,'Trashed submitted','Trashed bytes','Trashed bytes','text','approved',NULL,now()-interval '5 minutes'),
       ($2,'Other owner story','Other bytes','Other bytes','text','awaiting',NULL,now())
       RETURNING id,title,row_version`,
      [OWNER.sub, PEER.sub],
    );
    const byTitle = Object.fromEntries(inserted.rows.map((row) => [row.title, row]));
    await client.query(
      `UPDATE public.sf_stories SET archived_at=now(),archived_by=$1 WHERE id=$2`,
      [OWNER.sub, byTitle['Archived submitted'].id],
    );
    await client.query(
      `INSERT INTO public.sf_story_trash(story_id,student_id,trashed_by)
       VALUES($1,$2,$2)`,
      [byTitle['Trashed submitted'].id, OWNER.sub],
    );

    await assert.rejects(
      withIdentity(client, OWNER, (db) => db.query('SELECT public.sf_admin_subject_home($1)', [OWNER.sub])),
      (error) => error?.code === '42501',
    );
    await withIdentity(client, ADMIN, async (db) => {
      const home = (await db.query('SELECT public.sf_admin_subject_home($1) AS payload', [OWNER.sub])).rows[0].payload;
      assert.deepEqual(home.metrics, {
        observableStories: 2,
        awaitingReview: 1,
        inReview: 0,
        changesRequested: 0,
        reviewed: 0,
        approved: 0,
        unscored: 2,
        mentorVisible: 1,
      });
      assert.equal(home.context.mode, 'admin_subject');
      assert.equal(home.context.actorId, ADMIN.sub);
      assert.equal(home.context.actorRole, 'admin');
      assert.deepEqual(home.context.subject, {
        id: OWNER.sub,
        displayName: 'Maya Student',
        firstName: 'Maya',
        cohort: '2027',
        academicYear: 'PGY-1',
        specialty: 'Internal Medicine',
        applicationCycle: '2027',
      });
      assert.deepEqual(home.context.capabilities, { studentOwnedMutations: false, peerShare: false });
      assert.ok(!JSON.stringify(home.context).includes('wpUserId'));
      assert.ok(!JSON.stringify(home.context).toLowerCase().includes('email'));
      assert.deepEqual(new Set(home.recent.map((story) => story.title)), new Set([
        'Legacy submitted', 'Mentor-visible draft',
      ]));
      const direct = await db.query(
        `SELECT id FROM public.sf_stories WHERE id = ANY($1::uuid[]) ORDER BY id`,
        [[byTitle['Legacy submitted'].id, byTitle['Explicit private conflict'].id]],
      );
      assert.deepEqual(direct.rows.map((row) => row.id), [byTitle['Legacy submitted'].id]);

      const library = (await db.query(
        `SELECT public.sf_admin_subject_stories($1,'','','voice','recent',1,50) AS payload`,
        [OWNER.sub],
      )).rows[0].payload;
      assert.equal(library.pagination.total, 1);
      assert.equal(library.stories[0].title, 'Mentor-visible draft');
      assert.equal(library.stories[0].source, 'voice');
      assert.deepEqual(library.filters, { query: '', status: '', source: 'voice', sort: 'recent' });

      const detail = (await db.query(
        'SELECT public.sf_admin_subject_story($1,$2) AS payload',
        [OWNER.sub, byTitle['Legacy submitted'].id],
      )).rows[0].payload;
      assert.equal(detail.context.actorId, ADMIN.sub);
      assert.equal(detail.context.subject.id, OWNER.sub);
      assert.equal(detail.story.studentId, OWNER.sub);
      assert.equal(detail.story.text, 'Legacy current');
      assert.equal(detail.story.rowVersion, 0);
      assert.deepEqual(detail.versions, []);

    });
    await withIdentity(client, MENTOR, async (db) => {
      const direct = await db.query(
        `SELECT id FROM public.sf_stories WHERE id = ANY($1::uuid[]) ORDER BY id`,
        [[byTitle['Legacy submitted'].id, byTitle['Explicit private conflict'].id]],
      );
      assert.deepEqual(direct.rows.map((row) => row.id), [byTitle['Legacy submitted'].id]);
    });
    await withIdentity(client, OWNER, async (db) => {
      const direct = await db.query(
        `SELECT id FROM public.sf_stories WHERE id = ANY($1::uuid[])`,
        [[byTitle['Legacy submitted'].id, byTitle['Explicit private conflict'].id]],
      );
      assert.equal(direct.rowCount, 2);
    });

    for (const deniedId of [
      byTitle['Explicit private conflict'].id,
      byTitle['Ordinary private'].id,
      byTitle['Archived submitted'].id,
      byTitle['Trashed submitted'].id,
      byTitle['Other owner story'].id,
      '99999999-9999-4999-8999-999999999999',
    ]) {
      await expectStoryNotFound(withIdentity(client, ADMIN, (db) => db.query(
        'SELECT public.sf_admin_subject_story($1,$2)', [OWNER.sub, deniedId],
      )));
    }
    for (const unavailableSubject of [PEER.sub, INELIGIBLE.sub]) {
      await assert.rejects(
        withIdentity(client, ADMIN, (db) => db.query(
          'SELECT public.sf_admin_subject_home($1)', [unavailableSubject],
        )),
        (error) => error?.code === 'P0002' && error?.message === 'student not found',
      );
    }
    await assert.rejects(
      withIdentity(client, ADMIN, (db) => db.query(
        `SELECT public.sf_update_story_v5($1,'{"title":"Admin impersonation"}'::jsonb,0,'workspace')`,
        [byTitle['Legacy submitted'].id],
      )),
      (error) => error?.code === '42501',
    );

    const audits = await client.query(
      `SELECT actor_id,actor_role,student_id,action,visibility
       FROM public.sf_audit_events
       WHERE action IN('admin.subject_home_viewed','admin.subject_library_viewed','admin.subject_story_viewed')
       ORDER BY id`,
    );
    assert.equal(audits.rowCount, 3);
    assert.ok(audits.rows.every((row) => row.actor_id === ADMIN.sub));
    assert.ok(audits.rows.every((row) => row.actor_role === 'admin'));
    assert.ok(audits.rows.every((row) => row.student_id === OWNER.sub));
    assert.ok(audits.rows.every((row) => row.visibility === 'admin_only'));

    await client.query(
      `UPDATE public.sf_feature_flags SET scope='off',allowlist='{}',cohorts='{}'
       WHERE key='visibility_consent'`,
    );
    await withIdentity(client, ADMIN, async (db) => {
      await expectStoryNotFound(db.query(
        'SELECT public.sf_admin_subject_story($1,$2)',
        [OWNER.sub, byTitle['Mentor-visible draft'].id],
      ));
    });
  } finally {
    await database.stop();
  }
});

test('B1-515R peer-share scope control is admin-only, replacement-based, audited, and force-off', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all',allowlist='{}',cohorts='{}'
       WHERE key='admin_console'`,
    );
    await client.query(
      `UPDATE public.sf_users SET cohort='Shared' WHERE id IN($1,$2)`,
      [OWNER.sub, PEER.sub],
    );
    await client.query(
      `INSERT INTO public.sf_users(id,wp_user_id,display_name,role,eligible,cohort)
       VALUES($1,$2,'Outside Student','student',true,'Outside')`,
      [OUTSIDER.sub, OUTSIDER.wpUserId],
    );
    const story = (await client.query(
      `INSERT INTO public.sf_stories(student_id,title,original_text,current_text,status,visibility)
       VALUES($1,'Peer scope story','Original','Current','awaiting','mentor_visible') RETURNING id,row_version`,
      [OWNER.sub],
    )).rows[0];

    await assert.rejects(
      withIdentity(client, OWNER, (db) => db.query(
        `SELECT public.sf_admin_set_peer_share_scope('eligible_all','{}','{}')`,
      )),
      (error) => error?.code === '42501',
    );
    await assert.rejects(
      withIdentity(client, ADMIN, (db) => db.query(
        `SELECT public.sf_admin_set_peer_share_scope('everyone','{}','{}')`,
      )),
      (error) => error?.code === '22023',
    );
    for (const invalid of [
      `SELECT public.sf_admin_set_peer_share_scope('allowlist','{}','{}')`,
      `SELECT public.sf_admin_set_peer_share_scope('cohort','{}','{}')`,
      `SELECT public.sf_admin_set_peer_share_scope('off',ARRAY['${OWNER.sub}']::uuid[],'{}')`,
    ]) {
      await assert.rejects(
        withIdentity(client, ADMIN, (db) => db.query(invalid)),
        (error) => error?.code === '22023',
      );
    }
    await withIdentity(client, ADMIN, async (db) => {
      const allowlist = (await db.query(
        `SELECT public.sf_admin_set_peer_share_scope('allowlist',ARRAY[$1,$1]::uuid[],'{}') AS payload`,
        [OWNER.sub],
      )).rows[0].payload;
      assert.deepEqual({
        key: allowlist.key, scope: allowlist.scope, enabled: allowlist.enabled,
        allowlistCount: allowlist.allowlistCount, cohortCount: allowlist.cohortCount,
      }, {
        key: 'peer_share', scope: 'allowlist', enabled: true,
        allowlistCount: 1, cohortCount: 0,
      });
      const cohort = (await db.query(
        `SELECT public.sf_admin_set_peer_share_scope('cohort','{}',ARRAY['Shared','Shared']) AS payload`,
      )).rows[0].payload;
      assert.equal(cohort.scope, 'cohort');
      assert.equal(cohort.allowlistCount, 0);
      assert.equal(cohort.cohortCount, 1);
    });
    assert.deepEqual((await client.query(
      `SELECT scope,allowlist,cohorts FROM public.sf_feature_flags WHERE key='peer_share'`,
    )).rows[0], { scope: 'cohort', allowlist: [], cohorts: ['Shared'] });

    let grantId;
    await withIdentity(client, OWNER, async (db) => {
      const result = await db.query(
        `SELECT public.sf_peer_share_story($1,$2,ARRAY[$3]::uuid[],false) AS payload`,
        [story.id, story.row_version, PEER.sub],
      );
      grantId = result.rows[0].payload.grants[0].id;
    });
    await withIdentity(client, PEER, async (db) => {
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.sf_peer_story_grants')).rows[0].count, 1);
      const noAudio = (await db.query(
        'SELECT public.sf_peer_story_view($1) AS payload', [grantId],
      )).rows[0].payload;
      assert.equal(noAudio.hasAudio, false);
    });
    await client.query(
      `INSERT INTO public.sf_audio_assets(
         story_id,student_id,object_key,content_type,byte_size,checksum_sha256,state,verified_at
       ) VALUES($1,$2,'storyforge-audio/peer-scope.webm','audio/webm',64,$3,'verified',now())`,
      [story.id, OWNER.sub, 'a'.repeat(64)],
    );
    await withIdentity(client, PEER, async (db) => {
      const withAudio = (await db.query(
        'SELECT public.sf_peer_story_view($1) AS payload', [grantId],
      )).rows[0].payload;
      assert.equal(withAudio.hasAudio, true);
      assert.ok(!Object.hasOwn(withAudio, 'audioId'));
      assert.ok(!Object.hasOwn(withAudio, 'objectKey'));
    });
    await withIdentity(client, OUTSIDER, async (db) => {
      await assert.rejects(
        db.query('SELECT public.sf_peer_story_view($1)', [grantId]),
        (error) => error?.code === 'P0002' && error?.message === 'peer grant not found',
      );
    });

    await withIdentity(client, ADMIN, async (db) => {
      const off = (await db.query(
        `SELECT public.sf_admin_set_peer_share_scope('off','{}','{}') AS payload`,
      )).rows[0].payload;
      assert.equal(off.enabled, false);
    });
    await withIdentity(client, PEER, async (db) => {
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.sf_peer_story_grants')).rows[0].count, 0);
      await assert.rejects(
        db.query('SELECT public.sf_peer_inbox()'),
        (error) => error?.code === '42501',
      );
    });
    await withIdentity(client, OUTSIDER, async (db) => {
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.sf_peer_story_grants')).rows[0].count, 0);
    });

    await withIdentity(client, ADMIN, async (db) => {
      await db.query(
        `SELECT public.sf_admin_set_peer_share_scope('cohort','{}',ARRAY['Shared'])`,
      );
    });
    await withIdentity(client, OWNER, async (db) => {
      await db.query('SELECT public.sf_peer_revoke_grant($1)', [grantId]);
    });
    await withIdentity(client, PEER, async (db) => {
      await assert.rejects(
        db.query('SELECT public.sf_peer_story_view($1)', [grantId]),
        (error) => error?.code === 'P0002' && error?.message === 'peer grant not found',
      );
    });

    const flagAudits = await client.query(
      `SELECT previous_value,new_value,visibility
       FROM public.sf_audit_events
       WHERE action='feature_scope_changed' AND new_value->>'key'='peer_share'
       ORDER BY id`,
    );
    assert.equal(flagAudits.rowCount, 4);
    assert.ok(flagAudits.rows.every((row) => row.visibility === 'admin_only'));
    assert.ok(flagAudits.rows.every((row) => !JSON.stringify(row).includes(OWNER.sub)));
    assert.ok(flagAudits.rows.every((row) => !JSON.stringify(row).includes('Shared')));
    assert.equal((await client.query(
      `SELECT status FROM public.sf_peer_story_grants WHERE id=$1`, [grantId],
    )).rows[0].status, 'revoked');
  } finally {
    await database.stop();
  }
});
