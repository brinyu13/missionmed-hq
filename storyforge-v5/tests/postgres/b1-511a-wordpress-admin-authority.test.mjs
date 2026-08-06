import assert from 'node:assert/strict';
import test from 'node:test';

import {
  startEphemeralStoryForgeDatabase,
  withIdentity,
} from './helpers/ephemeral-postgres.mjs';

const FOUNDER_STUDENT = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  wpUserId: 1101,
  wordpressAdmin: true,
});
const ADMIN = Object.freeze({
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'admin',
  wpUserId: 3101,
});

test('signed WordPress admin authority is additive and server-selected', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    await withIdentity(client, ADMIN, async (identityClient) => {
      await identityClient.query(
        `SELECT public.sf_admin_set_console_flag(
           'allowlist', ARRAY[$1::uuid, $2::uuid]
         )`,
        [ADMIN.sub, FOUNDER_STUDENT.sub],
      );
    });

    await withIdentity(client, FOUNDER_STUDENT, async (identityClient) => {
      const result = await identityClient.query(
        `SELECT
           public.sf_actor_base_role() AS base_role,
           public.sf_actor_role() AS effective_role,
           public.sf_has_live_identity(ARRAY['student']) AS student_live,
           public.sf_has_live_identity(ARRAY['admin']) AS admin_live,
           public.sf_admin_console_enabled() AS admin_console`,
      );
      assert.deepEqual(result.rows[0], {
        base_role: 'student',
        effective_role: 'student',
        student_live: true,
        admin_live: false,
        admin_console: false,
      });
    });

    await withIdentity(client, {
      ...FOUNDER_STUDENT,
      adminMode: true,
    }, async (identityClient) => {
      const result = await identityClient.query(
        `SELECT
           public.sf_actor_base_role() AS base_role,
           public.sf_actor_role() AS effective_role,
           public.sf_has_live_identity(ARRAY['student']) AS student_live,
           public.sf_has_live_identity(ARRAY['admin']) AS admin_live,
           public.sf_admin_console_enabled() AS admin_console`,
      );
      assert.deepEqual(result.rows[0], {
        base_role: 'student',
        effective_role: 'admin',
        student_live: false,
        admin_live: true,
        admin_console: true,
      });
    });

    await withIdentity(client, {
      ...FOUNDER_STUDENT,
      wordpressAdmin: false,
      adminMode: true,
    }, async (identityClient) => {
      const result = await identityClient.query(
        `SELECT
           public.sf_actor_role() AS effective_role,
           public.sf_has_live_identity(ARRAY['admin']) AS admin_live`,
      );
      assert.deepEqual(result.rows[0], {
        effective_role: 'student',
        admin_live: false,
      });
    });
  } finally {
    await database.stop();
  }
});
