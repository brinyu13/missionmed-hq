import assert from 'node:assert/strict';
import test from 'node:test';

import { migrationSql, startEphemeralStoryForgeDatabase, withIdentity } from './helpers/ephemeral-postgres.mjs';

const OWNER = { sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101 };
const PEER = { sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102 };
const ADMIN = { sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'admin', wpUserId: 3101, wordpressAdmin: true, adminMode: true };
const AVATAR = '55555555-5555-4555-8555-555555555555';
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
  '20260813140000_b1_515r_arena_avatar_directory_groups.sql',
];

test('Arena avatar projections are active-user-bound, CDN-only, and admin-directory bounded', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all',allowlist='{}',cohorts='{}'
       WHERE key IN('admin_console','admin_directory','avatar_identity')`,
    );
    await client.query(
      `UPDATE public.sf_users SET
         arena_avatar_id=$2,
         arena_avatar_thumbnail_url='https://cdn.missionmedinstitute.com/avatars/maya.webp',
         arena_avatar_synced_at=now(),
         cohort='Cohort 2027'
       WHERE id=$1`,
      [OWNER.sub, AVATAR],
    );

    await assert.rejects(
      withIdentity(client, OWNER, (db) => db.query('SELECT public.sf_admin_arena_avatar_projections(ARRAY[$1]::uuid[])', [OWNER.sub])),
      (error) => error?.code === '42501',
    );
    const projected = await withIdentity(client, ADMIN, async (db) => (
      await db.query('SELECT public.sf_admin_arena_avatar_projections(ARRAY[$1,$2]::uuid[]) AS value', [OWNER.sub, PEER.sub])
    ).rows[0].value);
    assert.deepEqual(projected, [{
      studentId: OWNER.sub,
      avatar: {
        available: true,
        source: 'arena_lobby',
        activeAvatarId: AVATAR,
        headshotUrl: 'https://cdn.missionmedinstitute.com/avatars/maya.webp',
        syncedAt: projected[0].avatar.syncedAt,
      },
    }, {
      studentId: PEER.sub,
      avatar: { available: false, source: 'initials' },
    }]);
    assert.ok(projected[0].avatar.syncedAt);
    assert.doesNotMatch(JSON.stringify(projected), /object_key|service_role|supabase|email/i);
    await assert.rejects(
      client.query(
        `UPDATE public.sf_users SET arena_avatar_id=$2,
           arena_avatar_thumbnail_url='https://attacker.example/avatar.webp' WHERE id=$1`,
        [OWNER.sub, AVATAR],
      ),
      (error) => error?.code === '23514',
    );

    const groups = await withIdentity(client, ADMIN, async (db) => (
      await db.query('SELECT public.sf_admin_directory_groups() AS value')
    ).rows[0].value);
    assert.deepEqual(groups.groups.find((group) => group.id === 'Cohort 2027'), {
      id: 'Cohort 2027', label: 'Cohort 2027', studentCount: 1,
    });
    assert.equal(groups.groups.some((group) => ['active', 'idle', 'offline'].includes(group.id)), false);
  } finally {
    await database.stop();
  }
});
