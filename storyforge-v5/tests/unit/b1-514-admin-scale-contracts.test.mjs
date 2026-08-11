import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AdminConsoleError,
  adminDirectoryForceOff,
  adminReviewControlsForceOff,
  createAdminConsoleService,
  reviewCheckForceOff,
  validateDirectoryQuery,
  validateQueueQuery,
  validateReviewCheck,
  validateSavedView,
} from '../../server/admin-console.mjs';

const ADMIN = Object.freeze({
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'admin',
  eligible: true,
});
const FOUNDER = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  eligible: true,
  wordpressAdmin: true,
});
const STUDENT_ID = '22222222-2222-4222-8222-222222222222';

function runtime(handler = () => ({ rows: [{ payload: { ok: true } }] })) {
  const calls = [];
  const withIdentity = async (identity, operation, options = {}) => operation({
    async query(text, values = []) {
      calls.push({ identity, options, text: String(text), values });
      if (String(text).includes('sf_admin_console_enabled')) {
        return { rows: [{ enabled: true }] };
      }
      return handler({ identity, options, text: String(text), values });
    },
  });
  return { calls, withIdentity };
}

function enabledEnvironment(overrides = {}) {
  return {
    STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0',
    STORYFORGE_ADMIN_DIRECTORY_FORCE_OFF: '0',
    STORYFORGE_REVIEW_CHECK_FORCE_OFF: '0',
    STORYFORGE_ADMIN_REVIEW_CONTROLS_FORCE_OFF: '0',
    STORYFORGE_ACTIVITY_FORCE_OFF: '0',
    ...overrides,
  };
}

test('B1-514 administrator sub-surface runtime kills default closed independently', () => {
  assert.equal(adminDirectoryForceOff({}), true);
  assert.equal(reviewCheckForceOff({}), true);
  assert.equal(adminReviewControlsForceOff({}), true);
  assert.equal(adminDirectoryForceOff({ STORYFORGE_ADMIN_DIRECTORY_FORCE_OFF: 'false' }), false);
  assert.equal(reviewCheckForceOff({ STORYFORGE_REVIEW_CHECK_FORCE_OFF: '0' }), false);
  assert.equal(adminReviewControlsForceOff({ STORYFORGE_ADMIN_REVIEW_CONTROLS_FORCE_OFF: 'off' }), false);
});

test('directory and queue validators clamp page size and reject unbounded state', () => {
  assert.deepEqual(validateDirectoryQuery({
    q: '  Brian  ',
    filter: 'needs_review',
    session: '360 Spring 2026',
    sort: 'attention',
    page: '3',
    pageSize: '500',
  }), {
    q: 'Brian',
    filter: 'needs_review',
    session: '360 Spring 2026',
    sort: 'attention',
    page: 3,
    pageSize: 50,
  });
  assert.deepEqual(validateQueueQuery({ pageSize: 500 }), {
    q: '',
    status: null,
    session: '',
    sort: 'oldest',
    page: 1,
    pageSize: 50,
  });
  for (const query of [
    { filter: 'private' },
    { sort: 'arbitrary_sql' },
    { session: 'x'.repeat(81) },
    { page: 0 },
    { pageSize: 0 },
  ]) {
    assert.throws(() => validateDirectoryQuery(query), AdminConsoleError);
  }
  assert.throws(() => validateQueueQuery({ status: 'private' }), {
    code: 'invalid_admin_filter',
  });
});

test('saved views persist only bounded filter state and Review Check accepts no content', () => {
  assert.deepEqual(validateSavedView({
    label: '  Spring review  ',
    state: { filter: 'needs_review', session: '360 Spring 2026', sort: 'attention' },
  }), {
    label: 'Spring review',
    state: { filter: 'needs_review', session: '360 Spring 2026', sort: 'attention' },
  });
  assert.throws(
    () => validateSavedView({
      label: 'Unsafe',
      state: { filter: 'all', session: '', sort: 'name', q: 'student identity' },
    }),
    { code: 'invalid_admin_saved_view' },
  );
  assert.deepEqual(validateReviewCheck({ studentId: STUDENT_ID, preview: true }), {
    studentId: STUDENT_ID,
    preview: true,
  });
  assert.throws(
    () => validateReviewCheck({ studentId: STUDENT_ID, preview: false, body: 'private content' }),
    { code: 'invalid_review_check' },
  );
});

test('scalable admin methods delegate only to bounded R1 RPC seams', async () => {
  const fake = runtime();
  const service = createAdminConsoleService({
    withIdentity: fake.withIdentity,
    environment: enabledEnvironment(),
  });

  await service.directory(FOUNDER, { filter: 'warnings', pageSize: 500 });
  await service.directoryStudent(FOUNDER, STUDENT_ID);
  await service.savedViews(FOUNDER);
  await service.saveView(FOUNDER, {
    label: 'Quiet students',
    state: { filter: 'inactive_30', session: '', sort: 'quiet' },
  });
  const viewId = '33333333-3333-4333-8333-333333333333';
  await service.deleteView(FOUNDER, viewId);
  await service.queueScaled(FOUNDER, { q: 'Maya', sort: 'oldest', pageSize: 200 });
  await service.activity(FOUNDER, STUDENT_ID);
  await service.reviewCheck(FOUNDER, { studentId: STUDENT_ID, preview: true });
  await service.directReview(FOUNDER, '44444444-4444-4444-8444-444444444444', {
    expectedVersion: 4,
    patch: { mentorScore: 5 },
  });

  const calls = fake.calls.filter(({ text }) => !text.includes('sf_admin_console_enabled'));
  assert.deepEqual(calls.map(({ text }) => text.match(/public\.(sf_[a-z0-9_]+)/)?.[1]), [
    'sf_admin_directory',
    'sf_admin_directory_student',
    'sf_admin_saved_views',
    'sf_admin_save_view',
    'sf_admin_delete_saved_view',
    'sf_admin_review_queue_scaled',
    'sf_admin_activity_for_student',
    'sf_record_review_check',
    'sf_admin_review_story',
  ]);
  assert.equal(calls[0].values.at(-1), 50);
  assert.equal(calls[5].values.at(-1), 50);
  assert.ok(fake.calls.every(({ options }) => options.adminMode === true));
});

test('default-off surfaces avoid database work and missing RPCs fail truthfully', async () => {
  const closed = runtime();
  const closedService = createAdminConsoleService({
    withIdentity: closed.withIdentity,
    environment: { STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0' },
  });
  await assert.rejects(closedService.directory(ADMIN), { code: 'admin_directory_force_off' });
  await assert.rejects(
    closedService.reviewCheck(ADMIN, { studentId: STUDENT_ID, preview: true }),
    { code: 'review_check_force_off' },
  );
  await assert.rejects(
    async () => closedService.directReview(ADMIN, '44444444-4444-4444-8444-444444444444', {
      expectedVersion: 0,
      patch: { mentorScore: 4 },
    }),
    { code: 'admin_review_controls_force_off' },
  );
  assert.equal(closed.calls.length, 0);
  assert.deepEqual(
    await closedService.review(ADMIN, '44444444-4444-4444-8444-444444444444', {
      expectedVersion: 0,
      patch: { mentorScore: 4 },
    }),
    { ok: true },
  );
  assert.match(closed.calls.at(-1).text, /sf_admin_review_story/);

  const unavailable = runtime(({ text }) => {
    if (text.includes('sf_admin_directory')) {
      const error = new Error('function does not exist');
      error.code = '42883';
      throw error;
    }
    return { rows: [{ payload: { ok: true } }] };
  });
  const unavailableService = createAdminConsoleService({
    withIdentity: unavailable.withIdentity,
    environment: enabledEnvironment(),
  });
  await assert.rejects(
    unavailableService.directory(ADMIN),
    (error) => error.code === 'admin_v2_unavailable'
      && error.status === 503
      && !error.message.includes('function'),
  );
});
