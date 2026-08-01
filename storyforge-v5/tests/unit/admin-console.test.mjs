import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AdminConsoleError,
  adminConsoleForceOff,
  createAdminConsoleService,
  validateAdminReview,
} from '../../server/admin-console.mjs';

const ADMIN = Object.freeze({
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'admin',
  eligible: true,
});
const STUDENT = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  eligible: true,
});

function store(handler) {
  const calls = [];
  return {
    calls,
    withIdentity: async (identity, operation) => operation({
      async query(text, values = []) {
        calls.push({ identity, text, values });
        return handler({ identity, text, values, calls });
      },
    }),
  };
}

test('administrator console kill switch defaults closed and recognizes only explicit off values', () => {
  assert.equal(adminConsoleForceOff({}), true);
  assert.equal(adminConsoleForceOff({ STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '1' }), true);
  assert.equal(adminConsoleForceOff({ STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: 'true' }), true);
  assert.equal(adminConsoleForceOff({ STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0' }), false);
  assert.equal(adminConsoleForceOff({ STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: 'off' }), false);
});

test('capability is false for force-off, non-admin, and database-off identities', async () => {
  const forceOffStore = store(() => ({ rows: [{ enabled: true }] }));
  const forceOff = createAdminConsoleService({
    withIdentity: forceOffStore.withIdentity,
    environment: { STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '1' },
  });
  assert.equal(await forceOff.capability(ADMIN), false);
  assert.equal(forceOffStore.calls.length, 0);

  const openStore = store(() => ({ rows: [{ enabled: false }] }));
  const service = createAdminConsoleService({
    withIdentity: openStore.withIdentity,
    environment: { STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0' },
  });
  assert.equal(await service.capability(STUDENT), false);
  assert.equal(await service.capability(ADMIN), false);
  assert.equal(openStore.calls.length, 1);
});

test('bounded RPC methods validate roles, limits, cursors, filters, and identifiers', async () => {
  const fake = store(({ text }) => {
    if (text.includes('sf_admin_console_enabled')) return { rows: [{ enabled: true }] };
    return { rows: [{ payload: { ok: true } }] };
  });
  const service = createAdminConsoleService({
    withIdentity: fake.withIdentity,
    environment: { STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0' },
  });

  await assert.rejects(
    service.home(STUDENT),
    (error) => error instanceof AdminConsoleError && error.code === 'admin_required' && error.status === 403,
  );
  assert.throws(
    () => service.students(ADMIN, { limit: 51 }),
    (error) => error.code === 'invalid_admin_limit',
  );
  assert.throws(
    () => service.students(ADMIN, { status: 'private' }),
    (error) => error.code === 'invalid_admin_filter',
  );
  assert.throws(
    () => service.student(ADMIN, 'not-a-uuid'),
    (error) => error.code === 'invalid_identifier',
  );
  assert.throws(
    () => service.queue(ADMIN, { afterAt: 'not-a-time' }),
    (error) => error.code === 'invalid_admin_cursor',
  );

  assert.deepEqual(await service.home(ADMIN, { limit: 8 }), { ok: true });
  assert.match(fake.calls.at(-1).text, /sf_admin_home/);
});

test('review validation allowlists fields and exact authority values without mutating input', () => {
  const input = {
    expectedVersion: 3,
    patch: {
      status: 'reviewed',
      mentorScore: 5,
      suitability: 'both',
      studentFeedback: '  Visible feedback  ',
      internalNote: '  Internal note  ',
    },
  };
  const value = validateAdminReview(input);
  assert.deepEqual(value, {
    expectedVersion: 3,
    patch: {
      status: 'reviewed',
      mentorScore: 5,
      suitability: 'both',
      studentFeedback: 'Visible feedback',
      internalNote: 'Internal note',
    },
  });
  assert.equal(input.patch.studentFeedback, '  Visible feedback  ');

  for (const invalid of [
    { expectedVersion: -1, patch: { status: 'reviewed' } },
    { expectedVersion: 0, patch: {} },
    { expectedVersion: 0, patch: { status: 'private' } },
    { expectedVersion: 0, patch: { mentorScore: 6 } },
    { expectedVersion: 0, patch: { suitability: 'letter' } },
    { expectedVersion: 0, patch: { internalNote: '   ' } },
    { expectedVersion: 0, patch: { audioAssetId: 'forbidden' } },
  ]) {
    assert.throws(
      () => validateAdminReview(invalid),
      (error) => error.code === 'invalid_admin_review',
    );
  }
});

test('stale database review conflicts are sanitized to HTTP 409', async () => {
  const fake = store(({ text }) => {
    if (text.includes('sf_admin_console_enabled')) return { rows: [{ enabled: true }] };
    const error = new Error('internal serialization detail');
    error.code = '40001';
    throw error;
  });
  const service = createAdminConsoleService({
    withIdentity: fake.withIdentity,
    environment: { STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0' },
  });
  await assert.rejects(
    service.review(ADMIN, '10000000-0000-4000-8000-000000000001', {
      expectedVersion: 0,
      patch: { mentorScore: 4 },
    }),
    (error) => error.code === 'admin_review_conflict'
      && error.status === 409
      && !error.message.includes('serialization'),
  );
});

test('administrator flag control remains role-gated and bounded to off or allowlist', async () => {
  const fake = store(({ text }) => {
    if (text.startsWith('SELECT key')) {
      return { rowCount: 1, rows: [{ key: 'admin_console', scope: 'off', allowlist: [], cohorts: [] }] };
    }
    if (text.includes('sf_admin_set_console_flag')) {
      return {
        rowCount: 1,
        rows: [{ payload: { key: 'admin_console', scope: 'allowlist', allowlist: [ADMIN.sub], cohorts: [] } }],
      };
    }
    return { rows: [] };
  });
  const service = createAdminConsoleService({
    withIdentity: fake.withIdentity,
    environment: { STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '1' },
  });
  await assert.rejects(service.getFlag(STUDENT), (error) => error.code === 'admin_required');
  await assert.rejects(
    service.updateFlag(ADMIN, { scope: 'eligible_all', allowlist: [] }),
    (error) => error.code === 'invalid_admin_scope',
  );
  const updated = await service.updateFlag(ADMIN, { scope: 'allowlist', allowlist: [ADMIN.sub] });
  assert.equal(updated.scope, 'allowlist');
  assert.deepEqual(updated.allowlist, [ADMIN.sub]);
  assert.equal(fake.calls.filter(({ text }) => text.includes('sf_admin_set_console_flag')).length, 1);
  assert.equal(fake.calls.some(({ text }) => text.includes('sf_append_audit')), false);
});
