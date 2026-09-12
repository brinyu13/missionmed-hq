import assert from 'node:assert/strict';
import test from 'node:test';

import {
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const OWNER = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101,
});
const OTHER = Object.freeze({
  sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102,
});
const ADMIN = Object.freeze({
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'admin', wpUserId: 3101,
  wordpressAdmin: true, adminMode: true,
});
const PROMPT = '44444444-4444-4444-8444-444444444444';

async function asService(client, sql, values = []) {
  return withRole(client, 'storyforge_app', (db) => db.query(sql, values));
}

async function createInvitation(client, tokenHash = 'a'.repeat(64)) {
  return (await client.query(
    `INSERT INTO public.sf_story_invitations(
      student_id,contributor_first_name,relationship_id,email,token_hash,status,
      personal_message,disclosure_version,expires_at
    ) VALUES($1,'Raghav Mom','parent','guest@example.test',$2,'started','',
      'founder-v1',now()+interval '7 days') RETURNING id`,
    [OWNER.sub, tokenHash],
  )).rows[0];
}

test('guest submit atomically hydrates one private story and one student notification', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase({ applyCurrent: true });
  const { client } = database;
  try {
    await client.query(
      `UPDATE public.sf_feature_flags
       SET scope='eligible_all',allowlist='{}',cohorts='{}'
       WHERE key IN ('request_a_story','guest_contributions','admin_console')`,
    );
    await client.query(
      `UPDATE public.sf_feature_flags
       SET scope='allowlist',allowlist=ARRAY[$1]::uuid[],cohorts='{}'
       WHERE key='admin_directory'`,
      [OWNER.sub],
    );
    await client.query(
      `INSERT INTO public.sf_contributor_prompts(
        id,library_key,relationship_ids,text,hint,sort_order
      ) VALUES($1,'c-999',ARRAY['parent'],'Tell me one family memory.','One moment.',1)
      ON CONFLICT (id) DO NOTHING`,
      [PROMPT],
    );
    const invitation = await createInvitation(client);

    const delivered = (await asService(
      client,
      `SELECT public.sf_guest_contribute(
        $1,'text','A private family memory.',$2,'Tell me one family memory.'
      ) AS payload`,
      [invitation.id, PROMPT],
    )).rows[0].payload;

    assert.equal(delivered.state, 'promoted');
    assert.equal(delivered.visibility, 'private');
    assert.equal(delivered.existing, false);
    assert.match(delivered.storyId, /^[a-f0-9-]{36}$/);
    assert.match(delivered.notificationId, /^[a-f0-9-]{36}$/);

    const story = (await client.query(
      `SELECT student_id,title,original_text,current_text,capture_type,status,
              visibility,origin
       FROM public.sf_stories WHERE id=$1`,
      [delivered.storyId],
    )).rows[0];
    assert.deepEqual(story, {
      student_id: OWNER.sub,
      title: 'A story from Raghav Mom',
      original_text: 'A private family memory.',
      current_text: 'A private family memory.',
      capture_type: 'imported',
      status: 'private',
      visibility: 'private',
      origin: {
        type: 'contribution',
        contributionId: delivered.contributionId,
        relationship: 'parent',
        contributorFirstName: 'Raghav Mom',
      },
    });

    assert.deepEqual((await client.query(
      `SELECT original_transcript,capture_type
       FROM public.sf_story_originals WHERE story_id=$1`,
      [delivered.storyId],
    )).rows[0], {
      original_transcript: 'A private family memory.', capture_type: 'imported',
    });
    assert.deepEqual((await client.query(
      `SELECT source_role,source_entity_type,source_entity_id,author_id
       FROM public.sf_authored_segments WHERE story_id=$1`,
      [delivered.storyId],
    )).rows, [{
      source_role: 'guest_contributor',
      source_entity_type: 'contribution',
      source_entity_id: delivered.contributionId,
      author_id: null,
    }]);
    assert.deepEqual((await client.query(
      `SELECT recipient_id,actor_id,story_id,event_key,event_category,deep_link
       FROM public.sf_notifications WHERE id=$1`,
      [delivered.notificationId],
    )).rows[0], {
      recipient_id: OWNER.sub,
      actor_id: null,
      story_id: delivered.storyId,
      event_key: 'request.story_received',
      event_category: 'system',
      deep_link: '/library',
    });

    const retried = (await asService(
      client,
      `SELECT public.sf_guest_contribute(
        $1,'text','A private family memory.',$2,'Tell me one family memory.'
      ) AS payload`,
      [invitation.id, PROMPT],
    )).rows[0].payload;
    assert.equal(retried.existing, true);
    assert.equal(retried.storyId, delivered.storyId);
    assert.equal(retried.notificationId, delivered.notificationId);
    assert.deepEqual((await client.query(
      `SELECT
        (SELECT count(*)::integer FROM public.sf_story_contributions WHERE invitation_id=$1) AS contributions,
        (SELECT count(*)::integer FROM public.sf_stories WHERE id=$2) AS stories,
        (SELECT count(*)::integer FROM public.sf_notifications WHERE story_id=$2) AS notifications`,
      [invitation.id, delivered.storyId],
    )).rows[0], { contributions: 1, stories: 1, notifications: 1 });

    const ownerVisible = await withIdentity(client, OWNER, (db) => db.query(
      'SELECT id FROM public.sf_stories WHERE id=$1', [delivered.storyId],
    ));
    assert.equal(ownerVisible.rowCount, 1);
    const otherVisible = await withIdentity(client, OTHER, (db) => db.query(
      'SELECT id FROM public.sf_stories WHERE id=$1', [delivered.storyId],
    ));
    assert.equal(otherVisible.rowCount, 0);

    await asService(
      client,
      `SELECT public.sf_sync_admin_population_snapshot(
        'match_mentorship_360',$1,now(),'mmhq_cam_build_entitlement',3893,$2::jsonb,true
      )`,
      [
        '77777777-7777-4777-8777-777777777777',
        JSON.stringify([{
          storyforge_uuid: OWNER.sub,
          wp_user_id: OWNER.wpUserId,
          arena_avatar_id: '',
          arena_avatar_thumbnail_url: '',
        }]),
      ],
    );
    const adminView = await withIdentity(client, ADMIN, async (db) => (
      await db.query(
        `SELECT public.sf_admin_subject_stories($1,'','','contribution','recent',1,50) AS payload`,
        [OWNER.sub],
      )
    ).rows[0].payload);
    assert.equal(adminView.stories.length, 0, 'explicit private remains hidden from administrators');

    const audit = (await client.query(
      `SELECT actor_id,actor_role,action,student_id,story_id,new_value
       FROM public.sf_audit_events
       WHERE action='request.contribution_hydrated' AND story_id=$1`,
      [delivered.storyId],
    )).rows[0];
    assert.equal(audit.actor_id, null);
    assert.equal(audit.actor_role, null);
    assert.equal(audit.student_id, OWNER.sub);
    assert.equal(audit.new_value.origin, 'contribution');
    assert.doesNotMatch(JSON.stringify(audit), /family memory|guest@example/i);

    const helperGrant = await client.query(
      `SELECT has_function_privilege('storyforge_app',
        'public.sf_guest_hydrate_contribution(uuid)','EXECUTE') AS allowed`,
    );
    assert.equal(helperGrant.rows[0].allowed, false);
  } finally {
    await database.stop();
  }
});

test('disabled or ineligible student cannot hydrate a guest story', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase({ applyCurrent: true });
  const { client } = database;
  try {
    await client.query(
      `UPDATE public.sf_feature_flags
       SET scope='eligible_all',allowlist='{}',cohorts='{}'
       WHERE key IN ('request_a_story','guest_contributions')`,
    );
    await client.query(
      `INSERT INTO public.sf_contributor_prompts(
        id,library_key,relationship_ids,text,hint,sort_order
      ) VALUES($1,'c-999',ARRAY['parent'],'Tell me one family memory.','One moment.',1)
      ON CONFLICT (id) DO NOTHING`,
      [PROMPT],
    );
    const invitation = await createInvitation(client, 'b'.repeat(64));
    await client.query('UPDATE public.sf_users SET eligible=false WHERE id=$1', [OWNER.sub]);
    await assert.rejects(
      asService(
        client,
        `SELECT public.sf_guest_contribute(
          $1,'text','A blocked memory.',$2,'Tell me one family memory.'
        )`,
        [invitation.id, PROMPT],
      ),
      (error) => error.code === 'P0002',
    );
    assert.deepEqual((await client.query(
      `SELECT
        (SELECT count(*)::integer FROM public.sf_story_contributions WHERE invitation_id=$1) AS contributions,
        (SELECT count(*)::integer FROM public.sf_stories WHERE origin->>'type'='contribution') AS stories,
        (SELECT count(*)::integer FROM public.sf_notifications WHERE event_key='request.story_received') AS notifications`,
      [invitation.id],
    )).rows[0], { contributions: 0, stories: 0, notifications: 0 });
  } finally {
    await database.stop();
  }
});
