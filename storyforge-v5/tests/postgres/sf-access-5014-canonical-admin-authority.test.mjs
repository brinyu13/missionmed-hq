import assert from 'node:assert/strict';
import test from 'node:test';

import {
  startEphemeralStoryForgeDatabase,
  withIdentity,
} from './helpers/ephemeral-postgres.mjs';

const MAPPED_STUDENT_AS_ADMIN = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'admin',
  wpUserId: 1101,
  wordpressAdmin: true,
});

test('canonical admin authority composes with 360 eligibility without widening RLS', async () => {
  const database = await startEphemeralStoryForgeDatabase({ applyCurrent: true });
  const { client } = database;
  try {
    await client.query(
      `INSERT INTO public.sf_stories(student_id,title,status)
       VALUES('22222222-2222-4222-8222-222222222222','Private boundary probe','private')`,
    );
    const result = await withIdentity(client, MAPPED_STUDENT_AS_ADMIN, (db) => db.query(
      `SELECT
         public.sf_actor_base_role() AS base_role,
         public.sf_actor_role() AS effective_role,
         public.sf_has_live_identity() AS live,
         public.sf_has_live_identity(ARRAY['admin']) AS admin_live,
         public.sf_has_live_identity(ARRAY['student']) AS student_live,
         (SELECT count(*)::integer FROM public.sf_users) AS visible_users,
         (SELECT count(*)::integer FROM public.sf_stories WHERE status='private') AS private_stories`,
    ));
    assert.deepEqual(result.rows[0], {
      base_role: 'admin',
      effective_role: 'admin',
      live: true,
      admin_live: true,
      student_live: false,
      visible_users: 1,
      private_stories: 0,
    });

    for (const identity of [
      { ...MAPPED_STUDENT_AS_ADMIN, wordpressAdmin: false },
      { ...MAPPED_STUDENT_AS_ADMIN, eligible: false },
      { ...MAPPED_STUDENT_AS_ADMIN, role: 'mentor', wordpressAdmin: false },
    ]) {
      const denied = await withIdentity(client, identity, (db) => db.query(
        `SELECT public.sf_has_live_identity() AS live,
                (SELECT count(*)::integer FROM public.sf_users) AS visible_users`,
      ));
      assert.deepEqual(denied.rows[0], { live: false, visible_users: 0 });
    }
  } finally {
    await database.stop();
  }
});
