import assert from 'node:assert/strict';
import test from 'node:test';

import {
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT = {
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  wpUserId: 1101,
};
const MENTOR = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'mentor',
  wpUserId: 2101,
};
const ADMIN = {
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'admin',
  wpUserId: 3101,
};

test('voice feature flag is seeded off and is admin-write/service-read only', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const catalog = await client.query(
      `SELECT relrowsecurity, relforcerowsecurity
       FROM pg_class
       WHERE oid = 'public.sf_feature_flags'::regclass`,
    );
    assert.deepEqual(catalog.rows[0], {
      relrowsecurity: true,
      relforcerowsecurity: true,
    });

    const seeded = await client.query(
      `SELECT key, scope, allowlist, cohorts, updated_by
       FROM public.sf_feature_flags`,
    );
    assert.deepEqual(seeded.rows, [{
      key: 'voice_capture',
      scope: 'off',
      allowlist: [],
      cohorts: [],
      updated_by: STUDENT.sub,
    }]);

    await withRole(client, 'storyforge_app', async (serviceClient) => {
      const capability = await serviceClient.query(
        `SELECT
           CASE scope
             WHEN 'off' THEN false
             WHEN 'eligible_all' THEN true
             WHEN 'allowlist' THEN $1::uuid = ANY (allowlist)
             WHEN 'cohort' THEN $2::text = ANY (cohorts)
             ELSE false
           END AS enabled
         FROM public.sf_feature_flags
         WHERE key = 'voice_capture'`,
        [STUDENT.sub, '2027'],
      );
      assert.equal(capability.rows[0].enabled, false);
    });

    for (const identity of [STUDENT, MENTOR]) {
      await withIdentity(client, identity, async (identityClient) => {
        const hidden = await identityClient.query(
          `SELECT key FROM public.sf_feature_flags
           WHERE key = 'voice_capture'`,
        );
        assert.equal(hidden.rowCount, 0);
      });
    }

    await withIdentity(client, ADMIN, async (identityClient) => {
      const visible = await identityClient.query(
        `SELECT key, scope FROM public.sf_feature_flags
         WHERE key = 'voice_capture'`,
      );
      assert.deepEqual(visible.rows[0], {
        key: 'voice_capture',
        scope: 'off',
      });

      const updated = await identityClient.query(
        `UPDATE public.sf_feature_flags
         SET scope = 'allowlist', allowlist = ARRAY[$1::uuid], updated_by = $2
         WHERE key = 'voice_capture'
         RETURNING scope, allowlist`,
        [STUDENT.sub, ADMIN.sub],
      );
      assert.deepEqual(updated.rows[0], {
        scope: 'allowlist',
        allowlist: [STUDENT.sub],
      });
    });

    await withIdentity(client, STUDENT, async (identityClient) => {
      const deniedUpdate = await identityClient.query(
        `UPDATE public.sf_feature_flags
         SET scope = 'eligible_all'
         WHERE key = 'voice_capture'`,
      );
      assert.equal(deniedUpdate.rowCount, 0);
    });

    await assert.rejects(
      withIdentity(client, ADMIN, (identityClient) => identityClient.query(
        `INSERT INTO public.sf_feature_flags (key, scope, updated_by)
         VALUES ('unapproved_flag', 'off', $1)`,
        [ADMIN.sub],
      )),
      (error) => error.code === '42501',
    );

    await assert.rejects(
      withIdentity(client, ADMIN, (identityClient) => identityClient.query(
        `UPDATE public.sf_feature_flags
         SET scope = 'founder'
         WHERE key = 'voice_capture'`,
      )),
      (error) => error.code === '23514',
    );

    await assert.rejects(
      withRole(client, 'storyforge_app', (serviceClient) => serviceClient.query(
        `UPDATE public.sf_feature_flags
         SET scope = 'off'
         WHERE key = 'voice_capture'`,
      )),
      (error) => error.code === '42501',
    );

    await assert.rejects(
      withRole(client, 'anon', (anonClient) => anonClient.query(
        'SELECT key FROM public.sf_feature_flags',
      )),
      (error) => error.code === '42501',
    );

    await withRole(client, 'storyforge_app', async (serviceClient) => {
      const capability = await serviceClient.query(
        `SELECT
           scope = 'eligible_all'
           OR (scope = 'allowlist' AND $1::uuid = ANY (allowlist))
           OR (scope = 'cohort' AND $2::text = ANY (cohorts))
           AS enabled
         FROM public.sf_feature_flags
         WHERE key = 'voice_capture'`,
        [STUDENT.sub, '2027'],
      );
      assert.equal(capability.rows[0].enabled, true);
    });
  } finally {
    await database.stop();
  }
});
