import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  VoiceFlagError,
  createFlagService,
  createPostgresFlagStore,
  evaluateVoiceCapability,
} from '../../server/flags.mjs';

const studentId = '11111111-1111-4111-8111-111111111111';
const otherStudentId = '22222222-2222-4222-8222-222222222222';
const student = Object.freeze({
  sub: studentId,
  role: 'student',
  eligible: true,
  cohort: 'G7',
});
const admin = Object.freeze({
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'admin',
  eligible: true,
});
const appSource = readFileSync(new URL('../../server/app.mjs', import.meta.url), 'utf8');

function flag(overrides = {}) {
  return {
    key: 'voice_capture',
    scope: 'off',
    allowlist: [],
    cohorts: [],
    updatedAt: '2026-07-29T12:00:00.000Z',
    ...overrides,
  };
}

function storeFixture(initialFlag = flag()) {
  const calls = {
    denials: [],
    updates: [],
  };
  let current = initialFlag;
  return {
    calls,
    store: {
      async readVoiceFlag() {
        return current;
      },
      async auditAdminDenial(identity, surface) {
        calls.denials.push({ identity, surface });
      },
      async readAdminFeatures() {
        return { flag: current, audit: [] };
      },
      async updateVoiceFlag(identity, next) {
        calls.updates.push({ identity, next });
        current = { ...current, ...next };
        return current;
      },
      async readVoiceHealth() {
        return { windowHours: 24, sessionsByState: [], errorsByCategory: [] };
      },
    },
  };
}

test('voice capability defaults off and only grants verified student identities', () => {
  assert.equal(evaluateVoiceCapability(null, student), false);
  assert.equal(evaluateVoiceCapability(flag({ scope: 'off' }), student), false);
  assert.equal(evaluateVoiceCapability(flag({
    scope: 'allowlist',
    allowlist: [studentId],
  }), student), true);
  assert.equal(evaluateVoiceCapability(flag({
    scope: 'allowlist',
    allowlist: [otherStudentId],
  }), student), false);
  assert.equal(evaluateVoiceCapability(flag({
    scope: 'allowlist',
    allowlist: [studentId],
  }), { ...student, role: 'mentor' }), false);
  assert.equal(evaluateVoiceCapability(flag({
    scope: 'allowlist',
    allowlist: [studentId],
  }), { ...student, eligible: false }), false);
});

test('cohort scope never grants an empty claim and eligible_all remains student-only', () => {
  const cohortFlag = flag({ scope: 'cohort', cohorts: ['G7'] });
  assert.equal(evaluateVoiceCapability(cohortFlag, student), true);
  assert.equal(evaluateVoiceCapability(cohortFlag, { ...student, cohort: '' }), false);
  assert.equal(evaluateVoiceCapability(cohortFlag, { ...student, cohort: 'G8' }), false);
  assert.equal(evaluateVoiceCapability(
    flag({ scope: 'eligible_all' }),
    student,
  ), true);
  assert.equal(evaluateVoiceCapability(
    flag({ scope: 'eligible_all' }),
    { ...student, role: 'admin' },
  ), false);
});

test('environment kill is read on every request and overrides an allowlist grant', async () => {
  const fixture = storeFixture(flag({ scope: 'allowlist', allowlist: [studentId] }));
  const environment = { STORYFORGE_VOICE_FORCE_OFF: '0' };
  const service = createFlagService({ store: fixture.store, environment });
  assert.equal(await service.voiceCapture(student), true);
  environment.STORYFORGE_VOICE_FORCE_OFF = '1';
  assert.equal(await service.voiceCapture(student), false);
  await assert.rejects(
    service.assertVoiceEnabled(student, {
      allowGrace: true,
      session: {
        state: 'recording',
        createdAt: '2026-07-29T11:55:00.000Z',
      },
    }),
    (error) => error instanceof VoiceFlagError && error.code === 'voice_disabled',
  );
});

test('environment kill short-circuits an unavailable flag database', async () => {
  let reads = 0;
  const service = createFlagService({
    store: {
      async readVoiceFlag() {
        reads += 1;
        throw new Error('database unavailable');
      },
    },
    environment: { STORYFORGE_VOICE_FORCE_OFF: '1' },
  });
  assert.equal(await service.voiceCapture(student), false);
  await assert.rejects(
    service.assertVoiceEnabled(student),
    (error) => error.code === 'voice_disabled' && error.status === 403,
  );
  assert.equal(reads, 0);
});

test('scope-change grace is limited to a pre-existing recording for ten minutes', async () => {
  const fixture = storeFixture(flag({
    scope: 'off',
    updatedAt: '2026-07-29T12:00:00.000Z',
  }));
  const service = createFlagService({
    store: fixture.store,
    environment: {},
    now: () => new Date('2026-07-29T12:09:59.000Z'),
  });
  await service.assertVoiceEnabled(student, {
    allowGrace: true,
    session: {
      state: 'recording',
      createdAt: '2026-07-29T11:50:00.000Z',
    },
  });
  await assert.rejects(
    service.assertVoiceEnabled(student, {
      allowGrace: true,
      session: {
        state: 'recording',
        createdAt: '2026-07-29T12:00:01.000Z',
      },
    }),
    (error) => error.code === 'voice_disabled',
  );
  const expired = createFlagService({
    store: fixture.store,
    environment: {},
    now: () => new Date('2026-07-29T12:10:00.001Z'),
  });
  await assert.rejects(
    expired.assertVoiceEnabled(student, {
      allowGrace: true,
      session: {
        state: 'finishing',
        createdAt: '2026-07-29T11:50:00.000Z',
      },
    }),
    (error) => error.code === 'voice_disabled',
  );
});

test('admin mutations validate UUIDs and exact configured cohorts', async () => {
  const fixture = storeFixture();
  const service = createFlagService({
    store: fixture.store,
    environment: { STORYFORGE_VALID_COHORTS: 'G7,G8' },
  });
  const updated = await service.updateVoiceCapture(admin, {
    scope: 'cohort',
    allowlist: [studentId, studentId],
    cohorts: ['G7', 'G7'],
  });
  assert.equal(updated.scope, 'cohort');
  assert.deepEqual(fixture.calls.updates[0].next, {
    scope: 'cohort',
    allowlist: [studentId],
    cohorts: ['G7'],
  });
  await assert.rejects(
    service.updateVoiceCapture(admin, {
      scope: 'cohort',
      allowlist: [],
      cohorts: ['NOT-A-COHORT'],
    }),
    (error) => error.code === 'invalid_voice_cohort',
  );
  await assert.rejects(
    service.updateVoiceCapture(admin, {
      scope: 'allowlist',
      allowlist: ['not-a-uuid'],
      cohorts: [],
    }),
    (error) => error.code === 'invalid_voice_allowlist',
  );
  await assert.rejects(
    service.updateVoiceCapture(admin, {
      scope: 'cohort',
      allowlist: [],
      cohorts: ['   '],
    }),
    (error) => error.code === 'invalid_voice_cohort',
  );
  await assert.rejects(
    service.updateVoiceCapture(admin, {
      scope: 'eligible_all',
      allowlist: [],
      cohorts: [],
    }),
    (error) => error.code === 'eligible_all_locked' && error.status === 403,
  );
});

test('Founder-authorized eligible-all activation remains student-only', async () => {
  const fixture = storeFixture();
  const service = createFlagService({
    store: fixture.store,
    environment: {},
    allowEligibleAll: true,
  });
  const updated = await service.updateVoiceCapture(admin, {
    scope: 'eligible_all',
    allowlist: [],
    cohorts: [],
  });
  assert.equal(updated.scope, 'eligible_all');
  assert.deepEqual(updated.allowlist, []);
  assert.deepEqual(updated.cohorts, []);
  assert.equal(evaluateVoiceCapability(updated, student), true);
  assert.equal(evaluateVoiceCapability(updated, { ...student, eligible: false }), false);
  assert.equal(evaluateVoiceCapability(updated, { ...student, role: 'admin' }), false);
  assert.equal(evaluateVoiceCapability(updated, { ...student, role: 'mentor' }), false);
  assert.match(
    appSource,
    /createFlagService\(\{[\s\S]*?allowEligibleAll:\s*true,[\s\S]*?\}\)/,
    'production runtime must explicitly carry the Founder eligible-all authority',
  );
});

test('admin mutation bounds accept exactly 50 allowlist and 20 cohort entries', async () => {
  const fixture = storeFixture();
  const allowlist = Array.from({ length: 50 }, (_, index) => (
    `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  ));
  const cohorts = Array.from({ length: 20 }, (_, index) => `G${index + 1}`);
  const service = createFlagService({
    store: fixture.store,
    environment: { STORYFORGE_VALID_COHORTS: cohorts.join(',') },
  });

  const boundary = await service.updateVoiceCapture(admin, {
    scope: 'allowlist',
    allowlist,
    cohorts,
  });
  assert.equal(boundary.allowlist.length, 50);
  assert.equal(boundary.cohorts.length, 20);

  await assert.rejects(
    service.updateVoiceCapture(admin, {
      scope: 'allowlist',
      allowlist: [...allowlist, otherStudentId],
      cohorts: [],
    }),
    (error) => error.code === 'invalid_voice_allowlist',
  );
  await assert.rejects(
    service.updateVoiceCapture(admin, {
      scope: 'cohort',
      allowlist: [],
      cohorts: [...cohorts, 'G21'],
    }),
    (error) => error.code === 'invalid_voice_cohort',
  );
});

test('non-admin feature and health access is denied only after an audit attempt', async () => {
  const fixture = storeFixture();
  const service = createFlagService({ store: fixture.store, environment: {} });
  await assert.rejects(
    service.getAdminFeatures(student),
    (error) => error.code === 'admin_required' && error.status === 403,
  );
  await assert.rejects(
    service.getVoiceHealth(student),
    (error) => error.code === 'admin_required' && error.status === 403,
  );
  assert.deepEqual(
    fixture.calls.denials.map((entry) => entry.surface),
    ['features', 'voice_health'],
  );
});

test('E13 runs the approved bounded error summary on the same identity client', async () => {
  const identityQueries = [];
  const serviceQueries = [];
  const identityClient = {
    async query(text, params) {
      identityQueries.push({ text, params });
      if (text.includes('sf_reconciliation_report')) {
        return {
          rows: [{
            run_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            mode: 'dry_run',
            started_at: '2026-07-30T12:00:00.000Z',
            finished_at: '2026-07-30T12:01:00.000Z',
            pages_listed: 1,
            keys_evaluated: 4,
            candidates: 1,
            preserved: 3,
            deleted_confirmed: 0,
            object_absent: 0,
            retried: 0,
            failed: 0,
            abort_reason: null,
            suspended: false,
            suspension_reason: null,
            cursor_digest_start: '',
            cursor_digest_end: 'a'.repeat(64),
            replica_id: 'replica-fixture',
          }],
        };
      }
      return {
        rows: [
          { error_category: 'transcribe', count: 3 },
          { error_category: 'assembly', count: 1 },
        ],
      };
    },
  };
  const store = createPostgresFlagStore({
    withIdentity: async (identity, operation) => {
      assert.equal(identity, admin);
      return operation(identityClient);
    },
    withServiceTransaction: async (operation) => operation({
      async query(text, params) {
        serviceQueries.push({ text, params });
        return {
          rows: [
            { state: 'recording', count: 2 },
            { state: 'attached', count: 4 },
          ],
        };
      },
    }),
    appendAudit: async () => {},
  });
  assert.deepEqual(await store.readVoiceHealth(admin), {
    windowHours: 24,
    sessionsByState: [
      { state: 'recording', count: 2 },
      { state: 'attached', count: 4 },
    ],
    errorsByCategory: [
      { errorCategory: 'transcribe', count: 3 },
      { errorCategory: 'assembly', count: 1 },
    ],
    reconciliation: [{
      runId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      mode: 'dry_run',
      startedAt: '2026-07-30T12:00:00.000Z',
      finishedAt: '2026-07-30T12:01:00.000Z',
      pagesListed: 1,
      keysEvaluated: 4,
      candidates: 1,
      preserved: 3,
      deletedConfirmed: 0,
      objectAbsent: 0,
      retried: 0,
      failed: 0,
      abortReason: null,
      suspended: false,
      suspensionReason: null,
      cursorDigestStart: '',
      cursorDigestEnd: 'a'.repeat(64),
      replicaId: 'replica-fixture',
    }],
  });
  assert.equal(identityQueries.length, 2);
  assert.equal(
    identityQueries[0].text,
    'SELECT * FROM public.sf_voice_error_summary()',
  );
  assert.equal(identityQueries[0].params, undefined);
  assert.equal(
    identityQueries[1].text,
    'SELECT * FROM public.sf_reconciliation_report($1)',
  );
  assert.deepEqual(identityQueries[1].params, [5]);
  assert.equal(serviceQueries.length, 1);
  assert.match(serviceQueries[0].text, /FROM public\.sf_recording_sessions/);
});

test('E11 runs the approved bounded feature history query on the same identity client', async () => {
  const queries = [];
  const identityClient = {
    async query(text, params) {
      queries.push({ text, params });
      if (text.includes('FROM public.sf_feature_flags')) {
        return {
          rows: [{
            key: 'voice_capture',
            scope: 'allowlist',
            allowlist: [studentId],
            cohorts: [],
            updated_by: admin.sub,
            updated_at: '2026-07-29T13:00:00.000Z',
          }],
        };
      }
      assert.equal(text, 'SELECT * FROM public.sf_feature_audit_tail($1)');
      assert.deepEqual(params, [20]);
      return {
        rows: [{
          id: 41,
          actor_id: admin.sub,
          action: 'feature_scope_changed',
          previous_value: { scope: 'off', allowlist: [], cohorts: [] },
          new_value: {
            scope: 'allowlist',
            allowlist: [studentId],
            cohorts: [],
          },
          created_at: '2026-07-29T13:00:00.000Z',
        }],
      };
    },
  };
  let identityTransactions = 0;
  const store = createPostgresFlagStore({
    withIdentity: async (identity, operation) => {
      identityTransactions += 1;
      assert.equal(identity, admin);
      return operation(identityClient);
    },
    withServiceTransaction: async (operation) => operation({ query: async () => ({ rows: [] }) }),
    appendAudit: async () => {},
  });
  assert.deepEqual(await store.readAdminFeatures(admin), {
    flag: {
      key: 'voice_capture',
      scope: 'allowlist',
      allowlist: [studentId],
      cohorts: [],
      updatedBy: admin.sub,
      updatedAt: '2026-07-29T13:00:00.000Z',
    },
    audit: [{
      id: '41',
      actorId: admin.sub,
      action: 'feature_scope_changed',
      previous: { scope: 'off', allowlist: [], cohorts: [] },
      current: {
        scope: 'allowlist',
        allowlist: [studentId],
        cohorts: [],
      },
      createdAt: '2026-07-29T13:00:00.000Z',
    }],
  });
  assert.equal(identityTransactions, 1);
  assert.equal(queries.length, 2);
});

test('E11 and E13 retain their 503 seams when an approved query is absent', async () => {
  const store = createPostgresFlagStore({
    withIdentity: async (_identity, operation) => operation({
      async query() {
        return { rows: [] };
      },
    }),
    withServiceTransaction: async (operation) => operation({
      async query() {
        return { rows: [] };
      },
    }),
    appendAudit: async () => {},
    readFeatureAuditTail: null,
    readVoiceErrorSummary: null,
  });
  await assert.rejects(
    store.readAdminFeatures(admin),
    (error) => error.code === 'feature_audit_unavailable' && error.status === 503,
  );
  await assert.rejects(
    store.readVoiceHealth(admin),
    (error) => error.code === 'voice_health_audit_unavailable' && error.status === 503,
  );
});

test('E13 rejects any category outside the fixed content-free vocabulary', async () => {
  const store = createPostgresFlagStore({
    withIdentity: async (identity, operation) => operation({ query: async () => ({ rows: [] }) }),
    withServiceTransaction: async (operation) => operation({
      async query() {
        return { rows: [{ state: 'recording', count: 2 }] };
      },
    }),
    appendAudit: async () => {},
    readVoiceErrorSummary: async () => [{
      errorCategory: 'patient supplied text',
      count: 1,
    }],
  });
  await assert.rejects(
    store.readVoiceHealth({
      sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'admin',
      eligible: true,
    }),
    (error) => (
      error.code === 'voice_health_audit_invalid'
      && error.status === 503
    ),
  );
});
