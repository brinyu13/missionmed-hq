import assert from 'node:assert/strict';
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
  const admin = {
    sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: 'admin',
    eligible: true,
  };
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

test('E13 fails closed until the authority-approved cross-student audit query is supplied', async () => {
  const store = createPostgresFlagStore({
    withIdentity: async (identity, operation) => operation({ query: async () => ({ rows: [] }) }),
    withServiceTransaction: async (operation) => operation({
      async query() {
        return { rows: [{ state: 'recording', count: 2 }] };
      },
    }),
    appendAudit: async () => {},
  });
  await assert.rejects(
    store.readVoiceHealth({
      sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'admin',
      eligible: true,
    }),
    (error) => (
      error.code === 'voice_health_audit_unavailable'
      && error.status === 503
    ),
  );
});

test('E11 fails closed rather than returning a caller-filtered feature history', async () => {
  const store = createPostgresFlagStore({
    withIdentity: async (identity, operation) => operation({
      async query() {
        return { rows: [] };
      },
    }),
    withServiceTransaction: async (operation) => operation({ query: async () => ({ rows: [] }) }),
    appendAudit: async () => {},
  });
  await assert.rejects(
    store.readAdminFeatures({
      sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'admin',
      eligible: true,
    }),
    (error) => error.code === 'feature_audit_unavailable' && error.status === 503,
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
