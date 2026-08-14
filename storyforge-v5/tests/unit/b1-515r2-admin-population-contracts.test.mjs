import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  AdminConsoleError,
  createAdminConsoleService,
  validateAdminPopulationSettings,
} from '../../server/admin-console.mjs';
import {
  classifyIdentityMappings,
  reconcilePostgresProfiles,
  verifyPostgresPlan,
} from '../../scripts/storyforge-identity-sync.mjs';

const ADMIN = Object.freeze({
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'admin',
  eligible: true,
  wordpressAdmin: true,
});
const STUDENT = '11111111-1111-4111-8111-111111111111';
const AVATAR = '55555555-5555-4555-8555-555555555555';
const GENERATION = '66666666-6666-4666-8666-666666666666';
const observedAt = new Date().toISOString();

function serviceFixture(handler) {
  const calls = [];
  const service = createAdminConsoleService({
    environment: {
      STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0',
      STORYFORGE_AVATAR_IDENTITY_FORCE_OFF: '0',
    },
    withIdentity: async (identity, operation, options = {}) => operation({
      async query(sql, values = []) {
        calls.push({ identity, options, sql: String(sql), values });
        if (String(sql).includes('sf_admin_console_enabled')) return { rows: [{ enabled: true }] };
        return handler({ sql: String(sql), values });
      },
    }),
  });
  return { calls, service };
}

test('Administrator population input is exact and narrowing-only', () => {
  assert.deepEqual(validateAdminPopulationSettings({
    populationKeys: ['match_mentorship_360'],
  }), { populationKeys: ['match_mentorship_360'] });
  assert.deepEqual(validateAdminPopulationSettings({ populationKeys: [] }), { populationKeys: [] });
  for (const invalid of [
    {},
    { populationKeys: 'match_mentorship_360' },
    { populationKeys: ['registered_users'] },
    { populationKeys: ['match_mentorship_360', 'match_mentorship_360'] },
    { populationKeys: [], scope: 'eligible_all' },
  ]) {
    assert.throws(
      () => validateAdminPopulationSettings(invalid),
      (error) => error instanceof AdminConsoleError && error.code === 'invalid_admin_population',
    );
  }
});

test('population settings RPCs expose only the centralized read and audited replacement write', async () => {
  const context = {
    selectedKeys: ['match_mentorship_360'],
    defaultKey: 'match_mentorship_360',
    authority: 'mmhq_cam_build_entitlement',
    observedAt,
    syncedAt: observedAt,
    memberCount: 360,
    options: [{
      key: 'match_mentorship_360', label: '360 Match Mentorship', available: true, selected: true,
    }],
    updatedAt: observedAt,
  };
  const fixture = serviceFixture(({ sql }) => ({
    rows: [{ payload: sql.includes('sf_admin_set_population_scope')
      ? { ...context, selectedKeys: [], auditId: '91' }
      : context }],
  }));
  assert.deepEqual(await fixture.service.populationSettings(ADMIN), context);
  assert.deepEqual(await fixture.service.updatePopulationSettings(ADMIN, {
    populationKeys: [],
  }), { ...context, selectedKeys: [], auditId: '91' });
  const contractCalls = fixture.calls.filter(({ sql }) => (
    sql.includes('sf_admin_population_context') || sql.includes('sf_admin_set_population_scope')
  ));
  assert.equal(contractCalls.length, 2);
  assert.match(contractCalls[0].sql, /sf_admin_population_context/);
  assert.match(contractCalls[1].sql, /sf_admin_set_population_scope/);
  assert.deepEqual(contractCalls[1].values, [[]]);
  assert.equal(contractCalls.some(({ sql }) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(sql)), false);
});

test('student-group queue avatar enrichment covers the group header and every nested story', async () => {
  const safeUrl = 'https://cdn.missionmedinstitute.com/avatars/current.webp';
  const story = { id: '44444444-4444-4444-8444-444444444444', studentId: STUDENT };
  const fixture = serviceFixture(({ sql }) => {
    if (sql.includes('sf_admin_review_queue_scaled')) {
      return { rows: [{ payload: {
        stories: [story],
        studentGroups: [{ studentId: STUDENT, studentName: 'Maya', stories: [story] }],
        groupedBy: 'student', total: 1, page: 1, pageSize: 20,
      } }] };
    }
    if (sql.includes('sf_admin_arena_avatar_projections')) {
      return { rows: [{ payload: [{
        studentId: STUDENT,
        avatar: {
          available: true, source: 'arena_lobby', activeAvatarId: AVATAR,
          headshotUrl: safeUrl, syncedAt: observedAt,
        },
      }] }] };
    }
    return { rows: [{ payload: null }] };
  });
  const queue = await fixture.service.queueScaled(ADMIN, { sort: 'student' });
  assert.equal(queue.studentGroups[0].avatar.headshotUrl, safeUrl);
  assert.equal(queue.studentGroups[0].stories[0].avatar.headshotUrl, safeUrl);
  assert.equal(queue.stories[0].avatar.headshotUrl, safeUrl);
  assert.deepEqual(
    fixture.calls.find(({ sql }) => sql.includes('sf_admin_arena_avatar_projections')).values,
    [[STUDENT]],
  );

  const unsafe = serviceFixture(({ sql }) => {
    if (sql.includes('sf_admin_review_queue_scaled')) {
      return { rows: [{ payload: { stories: [story], studentGroups: [], groupedBy: null } }] };
    }
    if (sql.includes('sf_admin_arena_avatar_projections')) {
      return { rows: [{ payload: [{
        studentId: STUDENT,
        avatar: { available: true, activeAvatarId: AVATAR, headshotUrl: `${safeUrl}?credential=x` },
      }] }] };
    }
    return { rows: [{ payload: null }] };
  });
  assert.equal((await unsafe.service.queueScaled(ADMIN)).stories[0].avatar, undefined);
});

test('operator plan carries explicit 360 lineage and atomically invokes the centralized projection RPC', async () => {
  const plan = classifyIdentityMappings({
    version: 1,
    authority: 'mmhq_cam_build_entitlement',
    course_id: 3893,
    population_authority: {
      key: 'match_mentorship_360', authority: 'mmhq_cam_build_entitlement', course_id: 3893,
      generation_id: GENERATION, complete: true, observed_at: observedAt,
    },
    avatar_authority: { source: 'arena_lobby', available: true, storage: 'r2_cdn' },
    users: [{
      wp_user_id: 1101, username: 'maya', email: 'maya@example.test',
      display_name: 'Maya Student', first_name: 'Maya', native_role: 'student',
      storyforge_uuid_raw: STUDENT, eligible: true,
      arena_avatar: {
        source: 'arena_lobby', active_avatar_id: AVATAR,
        avatar_thumbnail_url: 'https://cdn.missionmedinstitute.com/avatars/current.webp',
      },
    }],
  }, [{ id: STUDENT, wp_user_id: 1101 }]);
  assert.equal(plan.population_authority.generation_id, GENERATION);

  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('UPDATE public.sf_users')) {
        assert.doesNotMatch(sql, /arena_avatar_id|SET eligible|SET role/);
        return { rowCount: 1, rows: [{
          id: params[0], wp_user_id: params[1], display_name: params[2], first_name: params[3],
        }] };
      }
      if (sql.includes('sf_sync_admin_population_snapshot')) {
        return { rows: [{ payload: {
          populationKey: 'match_mentorship_360', generationId: GENERATION,
          memberCount: 1, avatarCount: 1, avatarAuthorityAvailable: true, observedAt,
        } }] };
      }
      if (sql.includes('SELECT id::text')) {
        return { rows: [{ id: STUDENT, wp_user_id: 1101, role: 'student', eligible: true }] };
      }
      if (sql.includes('sf_verify_admin_population_snapshot')) {
        return { rows: [{ payload: {
          populationKey: 'match_mentorship_360', generationId: GENERATION, verified: 1,
        } }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  const reconciled = await reconcilePostgresProfiles(plan, client);
  assert.equal(reconciled.population.memberCount, 1);
  const sync = calls.find(({ sql }) => sql.includes('sf_sync_admin_population_snapshot'));
  assert.deepEqual(sync.params.slice(0, 5), [
    'match_mentorship_360', GENERATION, observedAt,
    'mmhq_cam_build_entitlement', 3893,
  ]);
  assert.deepEqual(JSON.parse(sync.params[5]), [{
    storyforge_uuid: STUDENT,
    wp_user_id: 1101,
    arena_avatar_id: AVATAR,
    arena_avatar_thumbnail_url: 'https://cdn.missionmedinstitute.com/avatars/current.webp',
  }]);
  assert.equal(sync.params[6], true);
  assert.equal((await verifyPostgresPlan(plan, client)).population.verified, 1);
});

test('migration and HTTP contract contain no eligibility overload or client-side population DML', async () => {
  const [migration, app, identitySync] = await Promise.all([
    readFile(new URL(
      '../../infra/postgres/migrations/20260814120000_b1_515r2_admin_population_avatar_sound.sql',
      import.meta.url,
    ), 'utf8'),
    readFile(new URL('../../server/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../../scripts/storyforge-identity-sync.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(migration, /CREATE TABLE public\.sf_entitlement_population_projection/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.sf_admin_subject_in_scope/);
  assert.doesNotMatch(migration, /UPDATE public\.sf_users\s+SET\s+eligible/is);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/g);
  assert.match(migration, /stale or replayed canonical population snapshot/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.sf_story_media_authorized/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.sf_can_review_submitted_story/);
  assert.match(migration, /sf_list_mentor_notes_b1_515r_baseline/);
  assert.match(migration, /sf_get_mentor_note_audio_b1_515r_baseline/);
  assert.match(migration, /REVOKE ALL ON public\.sf_account_preferences/);
  assert.match(identitySync, /POPULATION_SNAPSHOT_MAX_AGE_MS = 86_400_000/);
  assert.match(app, /GET' && url\.pathname === '\/api\/admin\/console\/population-settings'/);
  assert.match(app, /PATCH' && url\.pathname === '\/api\/admin\/console\/population-settings'/);
  assert.match(app, /public\.sf_opening_sound_preference\(\) AS opening_sound_enabled/);
  assert.match(app, /PATCH' && url\.pathname === '\/api\/preferences\/opening-sound'/);
  assert.match(app, /Object\.keys\(body\)\.length !== 1/);
});

test('browser and integration fixtures sync only the complete seeded test population', async () => {
  const runners = await Promise.all([
    'run-local.sh', 'run-e2e.sh', 'run-integration.sh', 'run-conformance.sh',
  ].map((name) => readFile(new URL(`../../scripts/${name}`, import.meta.url), 'utf8')));
  for (const runner of runners) {
    assert.match(runner, /20260814120000_b1_515r2_admin_population_avatar_sound\.sql/);
    assert.match(runner, /sf_sync_admin_population_snapshot\('match_mentorship_360'/);
    assert.match(runner, /'mmhq_cam_build_entitlement',3893/);
    assert.match(runner, /WHERE role='student' AND eligible/);
    assert.match(runner, /,'\[\]'::jsonb\),false\)/);
  }
});
