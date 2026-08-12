import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyPostgresPlan,
  classifyIdentityMappings,
  reconcilePostgresProfiles,
} from '../../scripts/storyforge-identity-sync.mjs';

const wpCommand = fileURLToPath(new URL(
  '../../scripts/wp-storyforge-identity-sync.php',
  import.meta.url,
));
const uuids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
];

function snapshot(users) {
  return {
    version: 1,
    authority: 'mmhq_cam_build_entitlement',
    course_id: 3893,
    users: users.map((user) => ({
      email: `${user.username}@example.test`,
      display_name: `Fixture ${user.wp_user_id}`,
      native_role: 'student',
      storyforge_uuid_raw: '',
      eligible: true,
      ...user,
    })),
  };
}

test('dry-run classifies valid, partial, new, and ineligible identities without overwrites', () => {
  let uuidIndex = 3;
  const plan = classifyIdentityMappings(snapshot([
    { wp_user_id: 10, username: 'valid', storyforge_uuid_raw: uuids[0] },
    { wp_user_id: 20, username: 'needs-db', storyforge_uuid_raw: uuids[1] },
    { wp_user_id: 30, username: 'needs-wp' },
    { wp_user_id: 40, username: 'new' },
    { wp_user_id: 50, username: 'inactive', eligible: false },
  ]), [
    { id: uuids[0], wp_user_id: 10 },
    { id: uuids[2], wp_user_id: 30 },
  ], {
    createUuid: () => uuids[uuidIndex++],
    roster: [{ label: 'S01', username: 'VALID' }, { label: 'S02', username: 'new' }],
  });
  assert.deepEqual(plan.entries.map((entry) => entry.status), [
    'ALREADY_VALID',
    'NEEDS_POSTGRES_ROW_ONLY',
    'NEEDS_WORDPRESS_UUID_ONLY',
    'NEEDS_BOTH',
    'INELIGIBLE',
  ]);
  assert.equal(plan.summary.blocking_conflicts, 0);
  assert.equal(plan.summary.entitled_students, 4);
  assert.equal(plan.summary.roster_resolved, 2);
  assert.equal(plan.summary.roster_entitled, 2);
});

test('dry-run stops on WordPress, PostgreSQL, duplicate, and invalid identity conflicts', () => {
  const rows = snapshot([
    { wp_user_id: 10, username: 'wp-conflict', storyforge_uuid_raw: uuids[0] },
    { wp_user_id: 20, username: 'pg-conflict', storyforge_uuid_raw: uuids[1] },
    { wp_user_id: 30, username: 'duplicate-a', storyforge_uuid_raw: uuids[2] },
    { wp_user_id: 40, username: 'duplicate-b', storyforge_uuid_raw: uuids[2] },
    { wp_user_id: 50, username: 'invalid', storyforge_uuid_raw: 'not-a-uuid' },
  ]);
  const plan = classifyIdentityMappings(rows, [
    { id: uuids[0], wp_user_id: 99 },
    { id: uuids[3], wp_user_id: 20 },
  ]);
  assert.deepEqual(plan.entries.map((entry) => entry.status), [
    'CONFLICTING_WORDPRESS_UUID',
    'CONFLICTING_POSTGRES_IDENTITY',
    'DUPLICATE_UUID',
    'DUPLICATE_UUID',
    'INVALID_ACCOUNT',
  ]);
  assert.equal(plan.summary.blocking_conflicts, 5);
  assert(plan.entries.every((entry) => !entry.apply_wordpress && !entry.apply_postgres));
});

test('PostgreSQL apply is transactional, idempotent, and rejects changed identities', async () => {
  const queries = [];
  const rows = new Map();
  const client = {
    async query(sql, params = []) {
      queries.push([sql, params]);
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('SELECT id::text')) {
        const row = rows.get(params[1]);
        return { rows: row ? [row] : [] };
      }
      if (sql.includes('INSERT INTO public.sf_users')) {
        rows.set(params[1], { id: params[0], wp_user_id: params[1] });
        return { rows: [] };
      }
      throw new Error('unexpected query');
    },
  };
  const plan = {
    version: 1,
    summary: { blocking_conflicts: 0 },
    entries: [{
      status: 'NEEDS_BOTH',
      wp_user_id: 10,
      storyforge_uuid: uuids[0],
      display_name: 'Fixture 10',
      apply_postgres: true,
    }],
  };
  await applyPostgresPlan(plan, client);
  await applyPostgresPlan(plan, client);
  assert.equal(queries.filter(([sql]) => sql.includes('INSERT INTO')).length, 1);

  rows.set(10, { id: uuids[1], wp_user_id: 10 });
  await assert.rejects(applyPostgresPlan(plan, client), /changed after dry run/);
  assert.equal(queries.at(-1)[0], 'ROLLBACK');
});

test('WordPress operator command recomputes entitlement and touches only the existing UUID meta key', async () => {
  const source = await readFile(wpCommand, 'utf8');
  assert.match(source, /mmsf_entitlement_for_user/);
  assert.match(source, /mmsf_native_role_for_user/);
  assert.match(source, /_missionmed_storyforge_user_id/);
  assert.match(source, /mmhq_cam_build_entitlement/);
  assert.match(source, /fileperms\(\$path\)/);
  assert.match(source, /update_user_meta\(\$wp_user_id, \$uuid_meta_key, \$target_uuid\)/);
  assert.doesNotMatch(source, /wp_create_user|wp_insert_user|wp_update_user|ld_update_course_access/);
  assert.doesNotMatch(source, /voice_capture|recording|transcription|sf_stories/);
});

test('profile reconciliation updates only WordPress-authoritative names on an exact existing identity binding', async () => {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      queries.push([sql, params]);
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('UPDATE public.sf_users')) {
        assert.match(sql, /WHERE id = \$1::uuid AND wp_user_id = \$2 AND role='student' AND eligible/);
        assert.doesNotMatch(sql, /SET role|SET eligible|SET cohort|SET wp_user_id/);
        return {
          rowCount: 1,
          rows: [{ id: params[0], wp_user_id: params[1], display_name: params[2], first_name: params[3] }],
        };
      }
      throw new Error('unexpected query');
    },
  };
  const plan = {
    version: 1,
    summary: { blocking_conflicts: 0 },
    entries: [{
      status: 'ALREADY_VALID', eligible: true, wp_user_id: 10,
      storyforge_uuid: uuids[0], display_name: 'Brian Bolante', first_name: 'Brian',
    }],
  };
  assert.deepEqual(await reconcilePostgresProfiles(plan, client), { checked: 1, reconciled: 1 });
  assert.equal(queries[0][0], 'BEGIN');
  assert.equal(queries.at(-1)[0], 'COMMIT');

  client.query = async (sql) => {
    if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
    if (sql.includes('UPDATE public.sf_users')) return { rows: [], rowCount: 0 };
    throw new Error('unexpected query');
  };
  await assert.rejects(reconcilePostgresProfiles(plan, client), /profile reconciliation failed/);
});
