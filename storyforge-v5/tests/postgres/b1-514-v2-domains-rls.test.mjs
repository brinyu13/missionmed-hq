import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migrationSql,
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT = { sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101 };
const OTHER = { sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102 };
const migrations = [
  '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql',
  '20260810200000_b1_514_v2_r2_story_versions_provenance.sql',
  '20260810210000_b1_514_v2_r3_inspiration.sql',
  '20260810220000_b1_514_v2_ra_requests_guest.sql',
  '20260810230000_b1_514_v2_preferences_environments.sql',
];
const promptId = '33333333-3333-4333-8333-333333333333';
const contributorPromptId = '44444444-4444-4444-8444-444444444444';

test('B1-514 V2 domains remain additive, owner-scoped, forced-RLS, and default closed', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const historical = await client.query(
      `INSERT INTO public.sf_stories(student_id,title,original_text,current_text,status)
       VALUES($1,'Historical','Exact original','Exact current','private') RETURNING id,xmin::text,row_version`,
      [STUDENT.sub],
    );
    for (const migration of migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    const preserved = await client.query(
      'SELECT xmin::text,row_version,original_text,current_text,visibility FROM public.sf_stories WHERE id=$1',
      [historical.rows[0].id],
    );
    assert.deepEqual(preserved.rows[0], {
      xmin: historical.rows[0].xmin,
      row_version: historical.rows[0].row_version,
      original_text: 'Exact original',
      current_text: 'Exact current',
      visibility: null,
    });

    const flags = await client.query(
      `SELECT key,scope FROM public.sf_feature_flags
       WHERE key IN('story_versions','inspiration','request_a_story','guest_contributions') ORDER BY key`,
    );
    assert.deepEqual(flags.rows, [
      { key: 'guest_contributions', scope: 'off' },
      { key: 'inspiration', scope: 'off' },
      { key: 'request_a_story', scope: 'off' },
      { key: 'story_versions', scope: 'off' },
    ]);
    const posture = await client.query(
      `SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
       WHERE relname IN('sf_story_versions','sf_inspiration_saved','sf_story_invitations','sf_story_contributions')
       ORDER BY relname`,
    );
    assert.equal(posture.rowCount, 4);
    assert.ok(posture.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));

    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all'
       WHERE key IN('story_versions','inspiration','request_a_story','guest_contributions')`,
    );
    await client.query(
      `INSERT INTO public.sf_inspiration_prompts
       (id,library_key,text,who_ids,who_detail_ids,domain_ids,energy_ids,territory,follow_up,interview_use,sort_order)
       VALUES($1,'q-999','A truthful test prompt?',ARRAY['you'],ARRAY[]::text[],ARRAY['personal'],ARRAY['serious'],'identity','What changed?','Behavioral',1)`,
      [promptId],
    );
    await client.query(
      `INSERT INTO public.sf_contributor_prompts(id,library_key,relationship_ids,text,hint,sort_order)
       VALUES($1,'c-999',ARRAY['parent'],'Tell me a bounded story from childhood.','Share one moment.',1)`,
      [contributorPromptId],
    );

    let invitationId;
    await withIdentity(client, STUDENT, async (identityClient) => {
      const version = await identityClient.query(
        `SELECT public.sf_save_story_version($1,'thirty_second','Exact concise telling','save','typed',0,NULL,NULL) AS payload`,
        [historical.rows[0].id],
      );
      assert.equal(version.rows[0].payload.body, 'Exact concise telling');
      await identityClient.query(
        `INSERT INTO public.sf_inspiration_saved(student_id,prompt_id,prompt_text_snapshot,draft,kind,source)
         VALUES(public.sf_actor_id(),$1,'A truthful test prompt?','Private draft','saved','typed')`,
        [promptId],
      );
      const invitation = await identityClient.query(
        `INSERT INTO public.sf_story_invitations
         (student_id,contributor_first_name,relationship_id,email,disclosure_version)
         VALUES(public.sf_actor_id(),'Pat','parent','pat@example.test','founder-v1') RETURNING id`,
      );
      invitationId = invitation.rows[0].id;
    });

    await withIdentity(client, OTHER, async (identityClient) => {
      assert.equal((await identityClient.query('SELECT count(*)::integer AS count FROM public.sf_story_versions')).rows[0].count, 0);
      assert.equal((await identityClient.query('SELECT count(*)::integer AS count FROM public.sf_inspiration_saved')).rows[0].count, 0);
      assert.equal((await identityClient.query('SELECT count(*)::integer AS count FROM public.sf_story_invitations')).rows[0].count, 0);
    });
    await withRole(client, 'storyforge_app', async (serviceClient) => {
      assert.equal((await serviceClient.query('SELECT id FROM public.sf_story_invitations WHERE id=$1', [invitationId])).rowCount, 1);
    });
  } finally {
    await database.stop();
  }
});
