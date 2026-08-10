import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createVisibilityService,
  mentorshipPolicy,
  visibilityConsentForceOff,
} from '../../server/visibility.mjs';
import {
  activityForceOff,
  createActivityService,
  validateHeartbeat,
} from '../../server/activity.mjs';

const migration = await readFile(
  new URL('../../infra/postgres/migrations/20260810190000_b1_514_v2_r1_visibility_consent_activity.sql', import.meta.url),
  'utf8',
);

const STUDENT = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  eligible: true,
  wpUserId: 101,
});
const ADMIN = Object.freeze({
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'admin',
  eligible: true,
  wpUserId: 107,
});

test('B1-514 R1 migration is additive, default-off, bigint-receipted, and sf_actor_id scoped', () => {
  assert.match(migration, /ADD COLUMN visibility text NULL/);
  assert.match(migration, /audit_event_id bigint NOT NULL UNIQUE/);
  assert.doesNotMatch(migration, /audit_event_id uuid/);
  assert.match(migration, /public\.sf_actor_id\(\)/);
  assert.doesNotMatch(migration, /auth\.uid\(\)/);
  assert.match(migration, /\('visibility_consent'\), \('activity_tracking'\)/);
  assert.match(migration, /'off', '\{\}'::uuid\[\], '\{\}'::text\[\]/);
  assert.match(migration, /ALTER TABLE public\.sf_mentorship_consent FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.sf_activity_sessions FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.sf_activity_counters FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /v_consent\.audit_event_id::text/);
  assert.match(migration, /Existing stories are never touched/);
});

test('R1 runtime kill switches default closed and require an explicit false value', () => {
  assert.equal(visibilityConsentForceOff({}), true);
  assert.equal(activityForceOff({}), true);
  assert.equal(visibilityConsentForceOff({ STORYFORGE_VISIBILITY_CONSENT_FORCE_OFF: '0' }), false);
  assert.equal(activityForceOff({ STORYFORGE_ACTIVITY_FORCE_OFF: 'false' }), false);
});

test('activity heartbeat accepts only a content-free closed payload', () => {
  const valid = validateHeartbeat({
    sessionId: crypto.randomUUID(),
    surface: 'story_detail',
    activeMs: 60_000,
  });
  assert.equal(valid.surface, 'story_detail');
  assert.equal(valid.activeMs, 60_000);
  for (const invalid of [
    { ...valid, text: 'private prose' },
    { ...valid, surface: '/library/private-story-id' },
    { ...valid, activeMs: 60_001 },
  ]) {
    assert.throws(() => validateHeartbeat(invalid), { code: 'invalid_activity_heartbeat' });
  }
});

test('visibility service fixes the policy version server-side and preserves bigint receipts as strings', async () => {
  const calls = [];
  const withIdentity = async (identity, operation, options) => operation({
    async query(sql, values = []) {
      calls.push({ identity, options, sql: String(sql), values });
      if (String(sql).includes('sf_decide_mentorship_consent')) {
        return { rows: [{ payload: {
          consent: { accepted: true, auditId: '9223372036854775806' },
          receipt: { auditId: '9223372036854775806' },
        } }] };
      }
      if (String(sql).includes('sf_set_story_visibility')) {
        return { rows: [{ id: values[0], visibility: values[1], row_version: 4 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  });
  const service = createVisibilityService({
    withIdentity,
    environment: { STORYFORGE_VISIBILITY_CONSENT_FORCE_OFF: '0' },
  });
  const decided = await service.decide(STUDENT, { decision: 'accept' });
  assert.equal(decided.receipt.auditId, '9223372036854775806');
  assert.equal(calls[0].values[0], mentorshipPolicy.version);
  await assert.rejects(
    service.decide(STUDENT, { decision: 'accept', policyVersion: 'forged' }),
    (error) => error.code === 'invalid_consent_decision',
  );
  const storyId = crypto.randomUUID();
  const story = await service.setStoryVisibility(STUDENT, storyId, {
    visibility: 'private',
    expectedVersion: 3,
  });
  assert.equal(story.visibility, 'private');
  await assert.rejects(
    service.setStoryVisibility(ADMIN, storyId, { visibility: 'private', expectedVersion: 3 }),
    (error) => error.code === 'student_required' && error.status === 403,
  );
});

test('activity service fail-silently discards heartbeats while runtime force-off is active', async () => {
  let queried = false;
  const service = createActivityService({
    withIdentity: async (_identity, operation) => operation({
      query: async () => {
        queried = true;
        return { rows: [] };
      },
    }),
    environment: {},
  });
  const result = await service.heartbeat(STUDENT, {
    sessionId: crypto.randomUUID(),
    surface: 'home',
    activeMs: 1000,
  });
  assert.deepEqual(result, { accepted: false, reason: 'force_off' });
  assert.equal(queried, false);
});
