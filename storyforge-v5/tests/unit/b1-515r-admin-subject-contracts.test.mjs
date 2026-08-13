import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AdminConsoleError,
  createAdminConsoleService,
  validateSubjectStoriesQuery,
} from '../../server/admin-console.mjs';
import { createAppServer } from '../../server/app.mjs';

const ADMIN = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'admin',
  eligible: true,
  wordpressAdmin: true,
});
const STUDENT = Object.freeze({
  sub: '22222222-2222-4222-8222-222222222222',
  role: 'student',
  eligible: true,
});
const SUBJECT_ID = '33333333-3333-4333-8333-333333333333';
const STORY_ID = '44444444-4444-4444-8444-444444444444';

const environment = Object.freeze({
  STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0',
});

function serviceFixture(
  handler = () => ({ rows: [{ payload: { ok: true } }] }),
  serviceEnvironment = environment,
) {
  const calls = [];
  const service = createAdminConsoleService({
    environment: serviceEnvironment,
    withIdentity: async (identity, operation, options = {}) => operation({
      async query(sql, values = []) {
        calls.push({ identity, options, sql: String(sql), values });
        if (String(sql).includes('sf_admin_console_enabled')) return { rows: [{ enabled: true }] };
        return handler({ identity, options, sql: String(sql), values });
      },
    }),
  });
  return { calls, service };
}

test('subject StoryForge query is bounded and canonical', () => {
  assert.deepEqual(validateSubjectStoriesQuery({
    q: '  patient  ', status: 'reviewed', source: 'voice', sort: 'title', page: '2', pageSize: '500',
  }), {
    q: 'patient', status: 'reviewed', source: 'voice', sort: 'title', page: 2, pageSize: 100,
  });
  assert.throws(() => validateSubjectStoriesQuery({ sort: 'sql' }), AdminConsoleError);
  assert.throws(() => validateSubjectStoriesQuery({ source: 'x'.repeat(81) }), AdminConsoleError);
});

test('subject contracts keep the signed administrator as actor and the student explicit', async () => {
  const observed = serviceFixture();
  await observed.service.subjectHome(ADMIN, SUBJECT_ID);
  await observed.service.subjectStories(ADMIN, SUBJECT_ID, {
    q: 'moment', status: 'awaiting', source: 'voice', sort: 'oldest', page: 3, pageSize: 75,
  });
  await observed.service.subjectStory(ADMIN, SUBJECT_ID, STORY_ID);

  const calls = observed.calls.filter(({ sql }) => !sql.includes('sf_admin_console_enabled'));
  assert.deepEqual(calls.map(({ sql }) => sql.match(/public\.(sf_[a-z0-9_]+)/)?.[1]), [
    'sf_admin_subject_home', 'sf_admin_subject_stories', 'sf_admin_subject_story',
  ]);
  assert.deepEqual(calls[0].values, [SUBJECT_ID]);
  assert.deepEqual(calls[1].values, [SUBJECT_ID, 'moment', 'awaiting', 'voice', 'oldest', 3, 75]);
  assert.deepEqual(calls[2].values, [SUBJECT_ID, STORY_ID]);
  assert.ok(calls.every(({ identity }) => identity === ADMIN));
  assert.ok(calls.every(({ options }) => options.adminMode === undefined));
});

test('student identity cannot enter administrator subject context', async () => {
  const observed = serviceFixture();
  await assert.rejects(observed.service.subjectHome(STUDENT, SUBJECT_ID), {
    code: 'admin_required', status: 403,
  });
  assert.equal(observed.calls.length, 0);
});

test('missing identity and malformed subject or story identifiers fail before subject RPC work', async () => {
  const observed = serviceFixture();
  await assert.rejects(observed.service.subjectHome(null, SUBJECT_ID), {
    code: 'admin_required', status: 403,
  });
  assert.throws(() => observed.service.subjectStories(ADMIN, 'not-a-student'), {
    code: 'invalid_identifier', status: 400,
  });
  assert.throws(() => observed.service.subjectStory(ADMIN, SUBJECT_ID, 'not-a-story'), {
    code: 'invalid_identifier', status: 400,
  });
  assert.equal(observed.calls.length, 0);
});

test('unknown subject stays a sanitized not-found response', async () => {
  const observed = serviceFixture(({ sql }) => {
    if (sql.includes('sf_admin_subject_home')) {
      const error = new Error('student not found');
      error.code = 'P0002';
      throw error;
    }
    return { rows: [{ payload: { ok: true } }] };
  });
  await assert.rejects(
    observed.service.subjectHome(ADMIN, SUBJECT_ID),
    (error) => error.code === 'not_found' && error.status === 404
      && error.message === 'The requested administrator resource was not found.',
  );
});

test('private, cross-subject, and unknown direct story denials remain uniform 404s', async () => {
  const observed = serviceFixture(({ sql }) => {
    if (sql.includes('sf_admin_subject_story')) {
      const error = new Error('story not found');
      error.code = 'P0002';
      throw error;
    }
    return { rows: [{ payload: { ok: true } }] };
  });
  await assert.rejects(
    observed.service.subjectStory(ADMIN, SUBJECT_ID, STORY_ID),
    (error) => error.code === 'not_found' && error.status === 404
      && !error.message.includes('private') && !error.message.includes('subject'),
  );
});

test('administrator identity surfaces receive only active Arena CDN projections', async () => {
  const avatarId = '55555555-5555-4555-8555-555555555555';
  const safeUrl = 'https://cdn.missionmedinstitute.com/avatars/maya.webp';
  const observed = serviceFixture(({ sql }) => {
    if (sql.includes('sf_admin_directory(')) {
      return { rows: [{ payload: { students: [{ id: SUBJECT_ID, name: 'Maya Student' }] } }] };
    }
    if (sql.includes('sf_admin_arena_avatar_projections')) {
      return { rows: [{ payload: [{
        studentId: SUBJECT_ID,
        avatar: {
          available: true,
          source: 'arena_lobby',
          activeAvatarId: avatarId,
          headshotUrl: safeUrl,
          syncedAt: '2026-08-13T12:00:00.000Z',
        },
      }] }] };
    }
    if (sql.includes('sf_admin_directory_groups')) {
      return { rows: [{ payload: { groups: [{ id: 'Class of 2027', label: 'Class of 2027', studentCount: 12 }] } }] };
    }
    return { rows: [{ payload: { ok: true } }] };
  }, {
    STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0',
    STORYFORGE_ADMIN_DIRECTORY_FORCE_OFF: '0',
    STORYFORGE_AVATAR_IDENTITY_FORCE_OFF: '0',
  });
  const directory = await observed.service.directory(ADMIN);
  assert.deepEqual(directory.students[0].avatar, {
    available: true,
    source: 'arena_lobby',
    activeAvatarId: avatarId,
    headshotUrl: safeUrl,
    syncedAt: '2026-08-13T12:00:00.000Z',
  });
  assert.deepEqual(await observed.service.directoryGroups(ADMIN), {
    groups: [{ id: 'Class of 2027', label: 'Class of 2027', studentCount: 12 }],
  });
  const avatarCall = observed.calls.find(({ sql }) => sql.includes('sf_admin_arena_avatar_projections'));
  assert.deepEqual(avatarCall.values, [[SUBJECT_ID]]);
  assert.equal(JSON.stringify(directory).includes('object_key'), false);
});

test('administrator action-center and recent rows receive the same bounded Arena projection', async () => {
  const avatarId = '55555555-5555-4555-8555-555555555555';
  const safeUrl = 'https://cdn.missionmedinstitute.com/avatars/maya.webp';
  const storyRow = { id: STORY_ID, studentId: SUBJECT_ID, studentName: 'Maya Student' };
  const observed = serviceFixture(({ sql }) => {
    if (sql.includes('sf_admin_home')) {
      return { rows: [{ payload: {
        recent: [storyRow],
        actionCenter: {
          next: [storyRow],
          whoNeedsMe: {
            needsReview: { count: 1, items: [storyRow] },
            needsNudge: { count: 1, items: [{ studentId: SUBJECT_ID, studentName: 'Maya Student' }] },
          },
          changed: {
            changesReturned: { count: 1, items: [storyRow] },
            newSinceLastVisit: { count: 1, items: [storyRow], firstVisit: false },
          },
        },
      } }] };
    }
    if (sql.includes('sf_admin_arena_avatar_projections')) {
      return { rows: [{ payload: [{
        studentId: SUBJECT_ID,
        avatar: {
          available: true,
          source: 'arena_lobby',
          activeAvatarId: avatarId,
          headshotUrl: safeUrl,
          syncedAt: '2026-08-13T12:00:00.000Z',
        },
      }] }] };
    }
    return { rows: [{ payload: { ok: true } }] };
  }, {
    STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0',
    STORYFORGE_AVATAR_IDENTITY_FORCE_OFF: '0',
  });
  const home = await observed.service.home(ADMIN);
  const rows = [
    home.recent[0],
    home.actionCenter.next[0],
    home.actionCenter.whoNeedsMe.needsReview.items[0],
    home.actionCenter.whoNeedsMe.needsNudge.items[0],
    home.actionCenter.changed.changesReturned.items[0],
    home.actionCenter.changed.newSinceLastVisit.items[0],
  ];
  assert.ok(rows.every((row) => row.avatar?.headshotUrl === safeUrl));
  const avatarCalls = observed.calls.filter(({ sql }) => sql.includes('sf_admin_arena_avatar_projections'));
  assert.equal(avatarCalls.length, 1);
  assert.deepEqual(avatarCalls[0].values, [[SUBJECT_ID]]);
});

test('disabled or unavailable Arena identity falls back to authorized initials data', async () => {
  const observed = serviceFixture(({ sql }) => {
    if (sql.includes('sf_admin_directory(')) {
      return { rows: [{ payload: { students: [{ id: SUBJECT_ID, name: 'Maya Student' }] } }] };
    }
    if (sql.includes('sf_admin_arena_avatar_projections')) {
      const error = new Error('Arena avatar projection is disabled');
      error.code = '42501';
      throw error;
    }
    return { rows: [{ payload: { ok: true } }] };
  }, {
    STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0',
    STORYFORGE_ADMIN_DIRECTORY_FORCE_OFF: '0',
    STORYFORGE_AVATAR_IDENTITY_FORCE_OFF: '0',
  });
  assert.deepEqual(await observed.service.directory(ADMIN), {
    students: [{ id: SUBJECT_ID, name: 'Maya Student' }],
  });
});

test('peer-share feature scope is admin-only, bounded, and calls only the audited flag RPC', async () => {
  const observed = serviceFixture(({ sql }) => {
    if (sql.includes("WHERE key = 'peer_share'")) {
      return { rows: [{ key: 'peer_share', scope: 'off', allowlist: [], cohorts: [] }] };
    }
    if (sql.includes('sf_admin_set_peer_share_scope')) {
      return { rows: [{ payload: {
        key: 'peer_share', scope: 'allowlist', enabled: true,
        allowlistCount: 1, cohortCount: 0, auditId: '91',
      } }] };
    }
    return { rows: [{ payload: { ok: true } }] };
  });
  assert.equal((await observed.service.getPeerShareFlag(ADMIN)).scope, 'off');
  const updated = await observed.service.updatePeerShareFlag(ADMIN, {
    scope: 'allowlist', allowlist: [SUBJECT_ID], cohorts: [],
  });
  assert.equal(updated.scope, 'allowlist');
  assert.equal(updated.auditId, '91');
  const write = observed.calls.find(({ sql }) => sql.includes('sf_admin_set_peer_share_scope'));
  assert.deepEqual(write.values, ['allowlist', [SUBJECT_ID], []]);
  assert.equal(/\b(?:INSERT|UPDATE|DELETE)\b/u.test(write.sql), false);
  await assert.rejects(observed.service.updatePeerShareFlag(STUDENT, {
    scope: 'off', allowlist: [], cohorts: [],
  }), { code: 'admin_required', status: 403 });
});

async function routeFixture(context) {
  const calls = [];
  const adminConsoleService = {
    subjectHome: async (...args) => (calls.push(['home', ...args]), { context: { mode: 'admin_subject' } }),
    subjectStories: async (...args) => (calls.push(['stories', ...args]), { stories: [] }),
    subjectStory: async (...args) => (calls.push(['story', ...args]), { story: { id: STORY_ID } }),
    directoryGroups: async (...args) => (calls.push(['groups', ...args]), { groups: [] }),
  };
  const server = createAppServer({
    authorizeRequest: async () => ADMIN,
    identityTransaction: async (_identity, operation) => operation({ query: async () => ({ rows: [] }) }),
    phaseOneRuntime: {
      transcription: { available: false, transcribeSegment: async () => { throw new Error('unavailable'); } },
      flagService: { voiceCapture: async () => false },
      recordingsService: {},
    },
    adminConsoleService,
    reportError() {},
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { calls, origin: `http://127.0.0.1:${server.address().port}` };
}

test('subject Home, Library, and Story Room GET routes preserve explicit subject context', async (context) => {
  const { calls, origin } = await routeFixture(context);
  assert.equal((await fetch(`${origin}/api/admin/console/subjects/${SUBJECT_ID}/home`)).status, 200);
  assert.equal((await fetch(`${origin}/api/admin/console/subjects/${SUBJECT_ID}/stories?q=moment&page=2`)).status, 200);
  assert.equal((await fetch(`${origin}/api/admin/console/subjects/${SUBJECT_ID}/stories/${STORY_ID}`)).status, 200);
  assert.equal((await fetch(`${origin}/api/admin/console/groups`)).status, 200);
  assert.deepEqual(calls.map(([name]) => name), ['home', 'stories', 'story', 'groups']);
  assert.equal(calls[0][1], ADMIN);
  assert.equal(calls[0][2], SUBJECT_ID);
  assert.deepEqual(calls[1][3], { q: 'moment', page: '2' });
  assert.equal(calls[2][2], SUBJECT_ID);
  assert.equal(calls[2][3], STORY_ID);
});

test('subject routes require authenticated identity before any service call', async (context) => {
  let serviceCalls = 0;
  const server = createAppServer({
    authorizeRequest: async () => {
      const error = new Error('Authentication required.');
      error.code = 'auth_required';
      throw error;
    },
    adminConsoleService: {
      subjectHome: async () => { serviceCalls += 1; },
      subjectStories: async () => { serviceCalls += 1; },
      subjectStory: async () => { serviceCalls += 1; },
    },
    reportError() {},
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/admin/console/subjects/${SUBJECT_ID}/home`,
  );
  assert.equal(response.status, 401);
  assert.equal(serviceCalls, 0);
});
