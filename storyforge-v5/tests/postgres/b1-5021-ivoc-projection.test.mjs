import assert from 'node:assert/strict';
import test from 'node:test';

import {
  startEphemeralStoryForgeDatabase,
  withIdentity,
} from './helpers/ephemeral-postgres.mjs';

const OWNER = { sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101 };
const OTHER = { sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102 };

async function createPublishedStory(client) {
  const story = (await client.query(
    `INSERT INTO public.sf_stories(
       student_id,title,original_text,current_text,status,themes,mentor_score,review_suitability
     ) VALUES($1,'Approved teamwork story','raw private story prose','edited private story prose',
       'approved',ARRAY['team'],5,'both')
     RETURNING id,row_version`,
    [OWNER.sub],
  )).rows[0];
  await client.query(
    `INSERT INTO public.sf_story_publications(story_id,student_id,destination,activated_by)
     VALUES($1,$2,'iv_prep_on_call',$2)`,
    [story.id, OWNER.sub],
  );
  return story;
}

test('owner consent returns only the bounded IVOC projection and denies other identities', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase({ applyCurrent: true });
  const { client } = database;
  try {
    const story = await createPublishedStory(client);
    const consent = await withIdentity(client, OWNER, async (db) => (
      await db.query(
        `SELECT public.sf_decide_ivoc_projection_consent($1,$2,'grant',$3,false) AS payload`,
        [story.id, story.row_version, 'A concise approved teamwork example.'],
      )
    ).rows[0].payload);
    assert.equal(consent.decision, 'grant');

    const projection = await withIdentity(client, OWNER, async (db) => (
      await db.query('SELECT public.sf_ivoc_approved_story_projection() AS payload')
    ).rows[0].payload);
    assert.equal(projection.policyVersion, 'ivoc-approved-stories-1');
    assert.equal(projection.stories.length, 1);
    assert.equal(projection.stories[0].summary, 'A concise approved teamwork example.');
    assert.deepEqual(projection.stories[0].themes, ['team']);
    assert.doesNotMatch(JSON.stringify(projection), /raw private|edited private/i);

    const otherProjection = await withIdentity(client, OTHER, async (db) => (
      await db.query('SELECT public.sf_ivoc_approved_story_projection() AS payload')
    ).rows[0].payload);
    assert.equal(otherProjection, null);

    const posture = (await client.query(
      `SELECT relrowsecurity,relforcerowsecurity,
         has_table_privilege('authenticated','public.sf_ivoc_projection_consents','INSERT') AS can_insert,
         has_table_privilege('authenticated','public.sf_ivoc_projection_consents','UPDATE') AS can_update
       FROM pg_class WHERE relname='sf_ivoc_projection_consents'`,
    )).rows[0];
    assert.deepEqual(posture, {
      relrowsecurity: true, relforcerowsecurity: true, can_insert: false, can_update: false,
    });
    await assert.rejects(
      client.query('UPDATE public.sf_ivoc_projection_consents SET decision=\'revoke\' WHERE id=$1', [consent.consentId]),
      (error) => error?.code === '42501',
    );
  } finally {
    await database.stop();
  }
});

test('revocation and story-version drift invalidate the projection', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase({ applyCurrent: true });
  const { client } = database;
  try {
    const story = await createPublishedStory(client);
    await withIdentity(client, OWNER, (db) => db.query(
      `SELECT public.sf_decide_ivoc_projection_consent($1,$2,'grant',$3,false)`,
      [story.id, story.row_version, 'Approved bounded summary.'],
    ));
    await client.query('UPDATE public.sf_stories SET row_version=row_version+1 WHERE id=$1', [story.id]);
    assert.equal(await withIdentity(client, OWNER, async (db) => (
      await db.query('SELECT public.sf_ivoc_approved_story_projection() AS payload')
    ).rows[0].payload), null);

    const version = (await client.query('SELECT row_version FROM public.sf_stories WHERE id=$1', [story.id])).rows[0].row_version;
    await withIdentity(client, OWNER, (db) => db.query(
      `SELECT public.sf_decide_ivoc_projection_consent($1,$2,'grant',$3,false)`,
      [story.id, version, 'Re-approved bounded summary.'],
    ));
    await withIdentity(client, OWNER, (db) => db.query(
      `SELECT public.sf_decide_ivoc_projection_consent($1,$2,'revoke',NULL,false)`,
      [story.id, version],
    ));
    assert.equal(await withIdentity(client, OWNER, async (db) => (
      await db.query('SELECT public.sf_ivoc_approved_story_projection() AS payload')
    ).rows[0].payload), null);
  } finally {
    await database.stop();
  }
});
