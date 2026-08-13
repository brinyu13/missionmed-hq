import assert from 'node:assert/strict';
import test from 'node:test';

import { migrationSql, startEphemeralStoryForgeDatabase, withIdentity } from './helpers/ephemeral-postgres.mjs';

const ADMIN = {
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'admin',
  wpUserId: 3101,
  wordpressAdmin: true,
  adminMode: true,
};

const prerequisites = [
  '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql',
  '20260810200000_b1_514_v2_r2_story_versions_provenance.sql',
  '20260810210000_b1_514_v2_r3_inspiration.sql',
];

test('recommended launch prompts can be updated through the bounded audited publisher after seed history exists', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of prerequisites) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    await client.query(
      `UPDATE public.sf_feature_flags
          SET scope='eligible_all',allowlist='{}',cohorts='{}'
        WHERE key IN('admin_console','inspiration_admin')`,
    );
    const prompt = (await client.query(
      `INSERT INTO public.sf_inspiration_prompts(
         id,library_key,text,who_ids,domain_ids,energy_ids,territory,
         follow_up,interview_use,state,recommended,sort_order
       ) VALUES(
         '44444444-4444-4444-8444-444444444444','q-004',
         'Tell me about one remembered moment of shared laughter.',
         ARRAY['you'],ARRAY['personal'],ARRAY['light'],'humor',
         'What changed afterward?','Shows warmth and connection.','active',false,4
       ) RETURNING *`,
    )).rows[0];
    await client.query(
      `INSERT INTO public.sf_inspiration_prompt_history(prompt_id,row_version,snapshot,actor_id)
       VALUES($1,0,$2::jsonb,$3)`,
      [prompt.id, JSON.stringify(prompt), ADMIN.sub],
    );
    const payload = {
      id: prompt.id,
      libraryKey: prompt.library_key,
      text: prompt.text,
      who: prompt.who_ids,
      whoDetail: prompt.who_detail_ids,
      domain: prompt.domain_ids,
      energy: prompt.energy_ids,
      territory: prompt.territory,
      followUp: prompt.follow_up,
      interviewUse: prompt.interview_use,
      state: prompt.state,
      recommended: true,
      sortOrder: prompt.sort_order,
      expectedVersion: 0,
    };

    await assert.rejects(
      withIdentity(client, ADMIN, (db) => db.query(
        `SELECT public.sf_admin_publish_inspiration_prompt($1::jsonb)`,
        [JSON.stringify(payload)],
      )),
      (error) => error?.code === '23505',
    );

    await client.query(
      migrationSql('20260813150000_b1_515r_inspiration_recommendation_publish_fix.sql')
        .replace(/^\\set .*$/gm, ''),
    );
    const updated = await withIdentity(client, ADMIN, async (db) => (
      await db.query(
        `SELECT public.sf_admin_publish_inspiration_prompt($1::jsonb) AS value`,
        [JSON.stringify(payload)],
      )
    ).rows[0].value);
    assert.equal(updated.library_key, 'q-004');
    assert.equal(updated.recommended, true);
    assert.equal(updated.row_version, 1);
    assert.equal((await client.query(
      `SELECT count(*)::integer AS count
         FROM public.sf_inspiration_prompt_history
        WHERE prompt_id=$1 AND row_version=0`,
      [prompt.id],
    )).rows[0].count, 1);
    const audit = await client.query(
      `SELECT actor_id,student_id,action,visibility,new_value
         FROM public.sf_audit_events
        WHERE action='inspiration.prompt_published' AND entity_id=$1`,
      [prompt.id],
    );
    assert.equal(audit.rowCount, 1);
    assert.equal(audit.rows[0].actor_id, ADMIN.sub);
    assert.equal(audit.rows[0].student_id, null);
    assert.equal(audit.rows[0].visibility, 'admin_only');
    assert.deepEqual(audit.rows[0].new_value, { state: 'active', rowVersion: 1 });
  } finally {
    await database.stop();
  }
});
