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
const ADMIN = {
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'admin', wpUserId: 3101,
  wordpressAdmin: true, adminMode: true,
};

const v2Migrations = [
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
];

test('B1-515 domains are additive, default-off, bounded, and deny cross-user access', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const before = await client.query(
      `INSERT INTO public.sf_stories(student_id,title,original_text,current_text,status)
       VALUES($1,'B1-515 exact story','Original bytes','Current bytes','awaiting')
       RETURNING id,xmin::text,row_version,original_text,current_text`,
      [OWNER.sub],
    );
    for (const migration of v2Migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    const after = await client.query(
      `SELECT xmin::text,row_version,original_text,current_text,visibility
       FROM public.sf_stories WHERE id=$1`,
      [before.rows[0].id],
    );
    assert.deepEqual(after.rows[0], {
      xmin: before.rows[0].xmin,
      row_version: before.rows[0].row_version,
      original_text: 'Original bytes',
      current_text: 'Current bytes',
      visibility: null,
    });

    const flags = await client.query(
      `SELECT key,scope FROM public.sf_feature_flags
       WHERE key IN('story_archive','story_promotions','per_use_scoring','peer_share') ORDER BY key`,
    );
    assert.deepEqual(flags.rows, [
      { key: 'peer_share', scope: 'off' },
      { key: 'per_use_scoring', scope: 'off' },
      { key: 'story_archive', scope: 'off' },
      { key: 'story_promotions', scope: 'off' },
    ]);
    const posture = await client.query(
      `SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
       WHERE relname IN('sf_story_trash','sf_story_use_reviews','sf_story_publications','sf_peer_story_grants','sf_peer_feedback')
       ORDER BY relname`,
    );
    assert.equal(posture.rowCount, 5);
    assert.ok(posture.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
    const privileges = await client.query(
      `SELECT
        has_table_privilege('authenticated','public.sf_story_use_reviews','INSERT') AS use_insert,
        has_table_privilege('authenticated','public.sf_story_publications','UPDATE') AS publication_update,
        has_table_privilege('authenticated','public.sf_peer_story_grants','INSERT') AS grant_insert,
        has_table_privilege('authenticated','public.sf_peer_feedback','INSERT') AS feedback_insert`,
    );
    assert.deepEqual(privileges.rows[0], {
      use_insert: false, publication_update: false, grant_insert: false, feedback_insert: false,
    });

    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all'
       WHERE key IN('admin_console','admin_review_controls','story_archive','story_promotions','per_use_scoring','peer_share')`,
    );
    await client.query(
      `INSERT INTO public.sf_users(id,wp_user_id,display_name,role,eligible,cohort)
       VALUES($1,$2,'Outside Student','student',true,'Session B')`,
      [OUTSIDER.sub, OUTSIDER.wpUserId],
    );
    await client.query(
      `UPDATE public.sf_users SET cohort='Session A' WHERE id IN($1,$2)`,
      [OWNER.sub, PEER.sub],
    );
    await client.query(
      `UPDATE public.sf_users SET cohort='Session B' WHERE id=$1`,
      [OUTSIDER.sub],
    );

    await withIdentity(client, ADMIN, async (db) => {
      const reviews = await db.query(
        `SELECT public.sf_admin_save_use_reviews($1,0,$2::jsonb) AS payload`,
        [before.rows[0].id, JSON.stringify([
          { useId: 'ps', qualifies: true, score: 3 },
          { useId: 'iv', qualifies: true, score: 5 },
        ])],
      );
      assert.equal(reviews.rows[0].payload.reviews.length, 2);
      const publication = await db.query(
        `SELECT public.sf_admin_set_story_publication($1,1,'personal_statement',true,false) AS payload`,
        [before.rows[0].id],
      );
      assert.equal(publication.rows[0].payload.destination, 'personal_statement');
      assert.equal(publication.rows[0].payload.storyRowVersion, 2);
    });

    let grantId;
    await assert.rejects(
      withIdentity(client, OWNER, (db) => db.query(
        `SELECT public.sf_peer_share_story($1,2,ARRAY[$2]::uuid[],false) AS payload`,
        [before.rows[0].id, PEER.sub],
      )),
      (error) => error?.code === '42501',
    );
    await withIdentity(client, OWNER, async (db) => {
      const candidates = await db.query('SELECT public.sf_peer_candidates() AS payload');
      assert.deepEqual(candidates.rows[0].payload.map((row) => row.id), [PEER.sub]);
      const shared = await db.query(
        `SELECT public.sf_peer_share_story($1,2,ARRAY[$2]::uuid[],true) AS payload`,
        [before.rows[0].id, PEER.sub],
      );
      grantId = shared.rows[0].payload.grants[0].id;
    });
    await withIdentity(client, PEER, async (db) => {
      const inbox = await db.query('SELECT public.sf_peer_inbox() AS payload');
      assert.equal(inbox.rows[0].payload.length, 1);
      const story = await db.query('SELECT public.sf_peer_story_view($1) AS payload', [grantId]);
      assert.equal(story.rows[0].payload.text, 'Current bytes');
      await db.query('SELECT public.sf_peer_add_feedback($1,$2)', [grantId, 'A bounded peer response.']);
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.sf_peer_feedback')).rows[0].count, 1);
    });
    await withIdentity(client, OUTSIDER, async (db) => {
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.sf_peer_story_grants')).rows[0].count, 0);
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.sf_peer_feedback')).rows[0].count, 0);
      await assert.rejects(
        db.query('SELECT public.sf_peer_story_view($1)', [grantId]),
        (error) => error?.code === 'P0002',
      );
    });
    await withIdentity(client, OWNER, async (db) => {
      await db.query('SELECT public.sf_peer_revoke_grant($1)', [grantId]);
      const outbox = await db.query('SELECT public.sf_peer_outbox() AS payload');
      assert.equal(outbox.rows[0].payload.length, 1);
      assert.equal(outbox.rows[0].payload[0].status, 'revoked');
      assert.equal(outbox.rows[0].payload[0].feedback.length, 1);
      assert.equal(outbox.rows[0].payload[0].feedback[0].body, 'A bounded peer response.');
    });
    await withIdentity(client, PEER, async (db) => {
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.sf_peer_story_grants')).rows[0].count, 0);
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.sf_peer_feedback')).rows[0].count, 0);
    });
    await assert.rejects(
      withIdentity(client, PEER, (db) => db.query('SELECT public.sf_peer_story_view($1)', [grantId])),
      (error) => error?.code === 'P0002',
    );
    await assert.rejects(
      withIdentity(client, PEER, (db) => db.query(
        'SELECT public.sf_peer_add_feedback($1,$2)', [grantId, 'Late feedback'],
      )),
      (error) => error?.code === 'P0002',
    );

    await withIdentity(client, OWNER, async (db) => {
      const archived = await db.query(
        `SELECT public.sf_set_story_collection($1,2,'archived','library') AS payload`,
        [before.rows[0].id],
      );
      assert.ok(archived.rows[0].payload.archived_at);
      assert.equal(archived.rows[0].payload.trashedAt, null);
      const trashed = await db.query(
        `SELECT public.sf_set_story_collection($1,3,'trashed','library') AS payload`,
        [before.rows[0].id],
      );
      assert.equal(trashed.rows[0].payload.archived_at, null);
      assert.ok(trashed.rows[0].payload.trashedAt);
      const restored = await db.query(
        `SELECT public.sf_set_story_collection($1,4,'active','library') AS payload`,
        [before.rows[0].id],
      );
      assert.equal(restored.rows[0].payload.archived_at, null);
      assert.equal(restored.rows[0].payload.trashedAt, null);
      assert.equal(restored.rows[0].payload.row_version, 5);
    });

    await client.query(
      "UPDATE public.sf_stories SET visibility='private' WHERE id=$1",
      [before.rows[0].id],
    );
    await assert.rejects(
      withIdentity(client, OWNER, (db) => db.query(
        `SELECT public.sf_peer_share_story($1,5,ARRAY[$2]::uuid[],false)`,
        [before.rows[0].id, PEER.sub],
      )),
      (error) => error?.code === '42501',
    );
    await withIdentity(client, OWNER, async (db) => {
      const confirmed = await db.query(
        `SELECT public.sf_peer_share_story($1,5,ARRAY[$2]::uuid[],true) AS payload`,
        [before.rows[0].id, PEER.sub],
      );
      assert.equal(confirmed.rows[0].payload.grants.length, 1);
    });

    await withIdentity(client, ADMIN, async (db) => {
      const inReview = await db.query(
        `SELECT public.sf_admin_set_review_status_v201($1,5,'in_review') AS payload`,
        [before.rows[0].id],
      );
      assert.equal(inReview.rows[0].payload.status, 'in_review');
      assert.equal(inReview.rows[0].payload.rowVersion, 6);
      const awaiting = await db.query(
        `SELECT public.sf_admin_set_review_status_v201($1,6,'awaiting') AS payload`,
        [before.rows[0].id],
      );
      assert.equal(awaiting.rows[0].payload.status, 'awaiting');
      assert.equal(awaiting.rows[0].payload.rowVersion, 7);
    });

    await client.query("UPDATE public.sf_feature_flags SET scope='off' WHERE key='peer_share'");
    await assert.rejects(
      withIdentity(client, PEER, (db) => db.query('SELECT public.sf_peer_inbox()')),
      (error) => error?.code === '42501',
    );
  } finally {
    await database.stop();
  }
});
