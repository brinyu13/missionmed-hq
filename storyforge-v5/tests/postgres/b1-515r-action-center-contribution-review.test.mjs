import assert from 'node:assert/strict';
import test from 'node:test';

import { migrationSql, startEphemeralStoryForgeDatabase, withIdentity } from './helpers/ephemeral-postgres.mjs';

const OWNER = { sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101 };
const PEER = { sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102 };
const ADMIN = { sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'admin', wpUserId: 3101, wordpressAdmin: true, adminMode: true };
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
];

test('A38 contribution review is owner-only, optimistic, redacted, and promotes private with score', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    await client.query(`UPDATE public.sf_feature_flags SET scope='eligible_all',allowlist='{}',cohorts='{}' WHERE key='request_a_story'`);
    const invitation = (await client.query(
      `INSERT INTO public.sf_story_invitations(student_id,contributor_first_name,relationship_id,email,disclosure_version)
       VALUES($1,'Guest','friend','guest@example.test','v1') RETURNING id`, [OWNER.sub],
    )).rows[0];
    const contribution = (await client.query(
      `INSERT INTO public.sf_story_contributions(invitation_id,kind,transcript,prompt_text_snapshot)
       VALUES($1,'text','Private guest transcript sentinel','Tell one specific remembered moment.') RETURNING id,row_version`, [invitation.id],
    )).rows[0];

    const reviewed = await withIdentity(client, OWNER, async (db) => (
      await db.query(`SELECT public.sf_request_review_contribution($1,0,5::smallint,'Useful private review sentinel') AS value`, [contribution.id])
    ).rows[0].value);
    assert.equal(reviewed.studentScore, 5);
    assert.equal(reviewed.studentReviewNote, 'Useful private review sentinel');
    assert.equal(reviewed.rowVersion, 1);
    assert.equal(reviewed.state, 'new');

    await assert.rejects(
      withIdentity(client, PEER, (db) => db.query(`SELECT public.sf_request_review_contribution($1,1,4::smallint,NULL)`, [contribution.id])),
      (error) => error?.code === 'P0002' && error?.message === 'contribution not found',
    );
    await assert.rejects(
      withIdentity(client, OWNER, (db) => db.query(`SELECT public.sf_request_review_contribution($1,0,4::smallint,NULL)`, [contribution.id])),
      (error) => error?.code === '40001' && error?.message === 'contribution changed in another session',
    );
    for (const args of [[-1, 4, null], [1, 0, null], [1, 4, 'x'.repeat(2001)]]) {
      await assert.rejects(
        withIdentity(client, OWNER, (db) => db.query(`SELECT public.sf_request_review_contribution($1,$2,$3::smallint,$4)`, [contribution.id, ...args])),
        (error) => error?.code === '22023',
      );
    }
    await assert.rejects(
      withIdentity(client, OWNER, (db) => db.query(`UPDATE public.sf_story_contributions SET student_score=1 WHERE id=$1`, [contribution.id])),
      (error) => error?.code === '42501',
    );

    const audit = (await client.query(
      `SELECT previous_value,new_value FROM public.sf_audit_events
       WHERE action='request.contribution_reviewed' AND entity_id=$1`, [contribution.id],
    )).rows[0];
    assert.deepEqual(audit.previous_value, { score: null, noteLength: 0, notePresent: false, rowVersion: 0 });
    assert.deepEqual(audit.new_value, { score: 5, noteLength: 30, notePresent: true, rowVersion: 1 });
    assert.doesNotMatch(JSON.stringify(audit), /sentinel|transcript|guest@example/i);

    const promoted = await withIdentity(client, OWNER, async (db) => (
      await db.query(`SELECT public.sf_request_promote($1,'Promoted private story') AS value`, [contribution.id])
    ).rows[0].value);
    assert.equal(promoted.existing, false);
    assert.equal(promoted.visibility, 'private');
    const story = (await client.query(`SELECT visibility,student_score,origin FROM public.sf_stories WHERE id=$1`, [promoted.storyId])).rows[0];
    assert.equal(story.visibility, 'private');
    assert.equal(story.student_score, 5);
    assert.equal(story.origin.contributionId, contribution.id);
    const promotedRow = (await client.query(`SELECT state,row_version FROM public.sf_story_contributions WHERE id=$1`, [contribution.id])).rows[0];
    assert.deepEqual(promotedRow, { state: 'promoted', row_version: '2' });
    await assert.rejects(
      withIdentity(client, OWNER, (db) => db.query(`SELECT public.sf_request_review_contribution($1,2,3::smallint,NULL)`, [contribution.id])),
      (error) => error?.code === 'P0002' && error?.message === 'contribution not found',
    );
    const again = await withIdentity(client, OWNER, async (db) => (
      await db.query(`SELECT public.sf_request_promote($1,'Ignored') AS value`, [contribution.id])
    ).rows[0].value);
    assert.equal(again.existing, true);
    assert.equal((await client.query(`SELECT row_version FROM public.sf_story_contributions WHERE id=$1`, [contribution.id])).rows[0].row_version, '2');
  } finally { await database.stop(); }
});

test('A19 action center is canonical-private-safe, bounded, deterministic, and watermarked', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    await client.query(`UPDATE public.sf_feature_flags SET scope='eligible_all',allowlist='{}',cohorts='{}' WHERE key IN('admin_console','admin_directory')`);
    await client.query(`UPDATE public.sf_activity_config SET activated_at=now()-interval '30 days' WHERE key='activity_tracking'`);
    const stories = await client.query(
      `INSERT INTO public.sf_stories(student_id,title,original_text,current_text,capture_type,status,visibility,mentor_score,updated_at,last_submitted_at)
       VALUES
       ($1,'Awaiting visible','a','a','text','awaiting',NULL,NULL,now()-interval '10 days',now()-interval '10 days'),
       ($1,'In review visible','b','b','text','in_review',NULL,NULL,now()-interval '9 days',now()-interval '9 days'),
       ($1,'Changes visible','c','c','text','changes',NULL,4,now()-interval '8 days',now()-interval '8 days'),
       ($1,'Explicit private conflict','secret','secret','text','awaiting','private',NULL,now(),now()),
       ($2,'Peer old story','p','p','text','reviewed',NULL,5,now()-interval '12 days',now()-interval '12 days')
       RETURNING id,title`, [OWNER.sub, PEER.sub],
    );
    const ids = Object.fromEntries(stories.rows.map((row) => [row.title, row.id]));

    const first = await withIdentity(client, ADMIN, async (db) => (
      await db.query(`SELECT public.sf_admin_home(10) AS value`)
    ).rows[0].value);
    assert.equal(first.metrics.submittedStories, 4);
    assert.equal(first.actionCenter.changed.newSinceLastVisit.firstVisit, true);
    assert.equal(first.actionCenter.changed.newSinceLastVisit.count, 0);
    assert.deepEqual(first.actionCenter.changed.newSinceLastVisit.items, []);
    assert.equal(first.actionCenter.boundaries.boundaryLimited, false);
    assert.equal(first.actionCenter.whoNeedsMe.needsReview.count, 2);
    assert.ok(first.actionCenter.whoNeedsMe.needsNudge.items.some((item) => item.studentId === PEER.sub));
    assert.deepEqual(first.actionCenter.next.slice(0, 2).map((item) => item.action), ['review','continue_review']);
    assert.equal(new Set(first.actionCenter.next.map((item) => item.id)).size, first.actionCenter.next.length);
    assert.doesNotMatch(JSON.stringify(first), /Explicit private conflict|secret/);

    await client.query(`UPDATE public.sf_stories SET updated_at=clock_timestamp() WHERE id=$1`, [ids['Changes visible']]);
    const second = await withIdentity(client, ADMIN, async (db) => (
      await db.query(`SELECT public.sf_admin_home(10) AS value`)
    ).rows[0].value);
    assert.equal(second.actionCenter.changed.newSinceLastVisit.firstVisit, false);
    assert.ok(second.actionCenter.changed.newSinceLastVisit.since);
    assert.equal(second.actionCenter.changed.newSinceLastVisit.count, 1);
    assert.equal(second.actionCenter.changed.newSinceLastVisit.items[0].id, ids['Changes visible']);

    const queue = await withIdentity(client, ADMIN, async (db) => (
      await db.query(`SELECT public.sf_admin_review_queue_scaled('',NULL,'','oldest',1,50) AS value`)
    ).rows[0].value);
    assert.equal(queue.total, 4);
    assert.doesNotMatch(JSON.stringify(queue), /Explicit private conflict|secret/);
    const audit = await client.query(`SELECT previous_value,new_value,detail FROM public.sf_audit_events WHERE action='admin.home_viewed'`);
    assert.equal(audit.rowCount, 2);
    assert.ok(audit.rows.every((row) => row.previous_value === null && row.detail === null && Object.keys(row.new_value).join() === 'result_count'));
  } finally { await database.stop(); }
});
