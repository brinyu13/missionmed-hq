import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarEnabled, requireCalendar, admissionProof, validatePairs,
  CALENDAR_ACTION, isLogisticsTarget,
} from '../../server/calendar-admission.mjs';

// ── CALENDAR_ACTION ──────────────────────────────────────────────────

test('CALENDAR_ACTION matches GET cohort', () => {
  assert.ok(CALENDAR_ACTION.test('GET /api/calendar/cohort'));
});

test('CALENDAR_ACTION matches GET calendar admin', () => {
  assert.ok(CALENDAR_ACTION.test('GET /api/calendar/admin'));
});

test('CALENDAR_ACTION matches POST calendar admin', () => {
  assert.ok(CALENDAR_ACTION.test('POST /api/calendar/admin'));
});

test('CALENDAR_ACTION matches calendar admin with UUID', () => {
  assert.ok(CALENDAR_ACTION.test('GET /api/calendar/admin/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'));
});

test('CALENDAR_ACTION matches GET itinerary', () => {
  assert.ok(CALENDAR_ACTION.test('GET /api/interviews/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/itinerary'));
});

test('CALENDAR_ACTION matches POST itinerary with sub-id', () => {
  assert.ok(CALENDAR_ACTION.test('POST /api/interviews/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/itinerary/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'));
});

test('CALENDAR_ACTION rejects DELETE', () => {
  assert.ok(!CALENDAR_ACTION.test('DELETE /api/calendar/admin'));
});

test('CALENDAR_ACTION rejects invalid paths', () => {
  assert.ok(!CALENDAR_ACTION.test('GET /api/other'));
  assert.ok(!CALENDAR_ACTION.test('POST /api/calendar/cohort'));
});

// ── calendarEnabled ──────────────────────────────────────────────────

test('calendarEnabled returns true for eligible student with 360 tier', () => {
  const config = { calendar: { enabled: true } };
  const actor = { role: 'student', tier: '360', eligible: true };
  assert.equal(calendarEnabled(config, actor), true);
});

test('calendarEnabled returns true for eligible student with ivprep_complete tier', () => {
  const config = { calendar: { enabled: true } };
  const actor = { role: 'student', tier: 'ivprep_complete', eligible: true };
  assert.equal(calendarEnabled(config, actor), true);
});

test('calendarEnabled returns true for eligible admin', () => {
  const config = { calendar: { enabled: true } };
  const actor = { role: 'admin', tier: 'admin', eligible: true };
  assert.equal(calendarEnabled(config, actor), true);
});

test('calendarEnabled returns false when calendar not enabled', () => {
  const config = { calendar: { enabled: false } };
  const actor = { role: 'student', tier: '360', eligible: true };
  assert.equal(calendarEnabled(config, actor), false);
});

test('calendarEnabled returns false when calendar config missing', () => {
  assert.equal(calendarEnabled({}, { role: 'student', tier: '360', eligible: true }), false);
});

test('calendarEnabled returns false for ineligible actor', () => {
  const config = { calendar: { enabled: true } };
  assert.equal(calendarEnabled(config, { role: 'student', tier: '360', eligible: false }), false);
});

test('calendarEnabled returns false for null actor', () => {
  const config = { calendar: { enabled: true } };
  assert.equal(calendarEnabled(config, null), false);
});

test('calendarEnabled returns false for non-admin non-student role', () => {
  const config = { calendar: { enabled: true } };
  assert.equal(calendarEnabled(config, { role: 'mentor', tier: '360', eligible: true }), false);
});

test('calendarEnabled returns false for admin with wrong tier', () => {
  const config = { calendar: { enabled: true } };
  assert.equal(calendarEnabled(config, { role: 'admin', tier: '360', eligible: true }), false);
});

test('calendarEnabled returns false for student with admin tier', () => {
  const config = { calendar: { enabled: true } };
  assert.equal(calendarEnabled(config, { role: 'student', tier: 'admin', eligible: true }), false);
});

// ── requireCalendar ─────────────────────────────────────────────────

test('requireCalendar does not throw for eligible student', () => {
  const config = { calendar: { enabled: true } };
  const actor = { role: 'student', tier: '360', eligible: true };
  assert.doesNotThrow(() => requireCalendar(config, actor));
});

test('requireCalendar does not throw for eligible admin', () => {
  const config = { calendar: { enabled: true } };
  const actor = { role: 'admin', tier: 'admin', eligible: true };
  assert.doesNotThrow(() => requireCalendar(config, actor));
});

test('requireCalendar throws when calendar disabled', () => {
  const config = { calendar: { enabled: false } };
  const actor = { role: 'student', tier: '360', eligible: true };
  assert.throws(
    () => requireCalendar(config, actor),
    { name: 'AppError', code: 'calendar_unavailable', status: 403 },
  );
});

test('requireCalendar throws for ineligible actor', () => {
  const config = { calendar: { enabled: true } };
  const actor = { role: 'student', tier: '360', eligible: false };
  assert.throws(
    () => requireCalendar(config, actor),
    { code: 'calendar_unavailable', status: 403 },
  );
});

test('requireCalendar throws for null actor', () => {
  const config = { calendar: { enabled: true } };
  assert.throws(
    () => requireCalendar(config, null),
    { code: 'calendar_unavailable', status: 403 },
  );
});

test('requireCalendar message matches expected text', () => {
  try {
    requireCalendar({ calendar: { enabled: false } }, { role: 'student', tier: '360', eligible: true });
    assert.fail('should have thrown');
  } catch (e) {
    assert.equal(e.message, 'Shared Calendar and private itineraries are unavailable.');
  }
});

// ── admissionProof ───────────────────────────────────────────────────

test('admissionProof returns a hex string', () => {
  const proof = admissionProof('secret-key', 'example.com', 'test-body');
  assert.ok(/^[0-9a-f]{64}$/.test(proof));
});

test('admissionProof is deterministic', () => {
  const a = admissionProof('key', 'domain', 'text');
  const b = admissionProof('key', 'domain', 'text');
  assert.equal(a, b);
});

test('admissionProof differs for different secrets', () => {
  const a = admissionProof('key-1', 'domain', 'text');
  const b = admissionProof('key-2', 'domain', 'text');
  assert.notEqual(a, b);
});

test('admissionProof differs for different domains', () => {
  const a = admissionProof('key', 'domain-1', 'text');
  const b = admissionProof('key', 'domain-2', 'text');
  assert.notEqual(a, b);
});

test('admissionProof differs for different text', () => {
  const a = admissionProof('key', 'domain', 'text-1');
  const b = admissionProof('key', 'domain', 'text-2');
  assert.notEqual(a, b);
});

test('admissionProof format is HMAC-SHA256 of domain+newline+text', async () => {
  // Verify manually: HMAC-SHA256('secret', 'dom\nbody')
  const { createHmac } = await import('node:crypto');
  const expected = createHmac('sha256', 'secret').update('dom\nbody').digest('hex');
  assert.equal(admissionProof('secret', 'dom', 'body'), expected);
});

// ── validatePairs ────────────────────────────────────────────────────

test('validatePairs accepts valid pairs', () => {
  const pairs = [
    { subject: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', wp_user_id: 1 },
    { subject: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', wp_user_id: 2 },
  ];
  assert.deepEqual(validatePairs(pairs), pairs);
});

test('validatePairs accepts empty array', () => {
  assert.deepEqual(validatePairs([]), []);
});

test('validatePairs rejects non-array', () => {
  assert.throws(() => validatePairs('not-array'), { code: 'calendar_pairs' });
});

test('validatePairs rejects null', () => {
  assert.throws(() => validatePairs(null), { code: 'calendar_pairs' });
});

test('validatePairs rejects array over 200 entries', () => {
  const pairs = Array.from({ length: 201 }, (_, i) => ({
    subject: `a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c${(i).toString(16).padStart(2, '0')}d`.slice(0, 36),
    wp_user_id: i + 1,
  }));
  // Each UUID must be valid — use a simpler approach
  assert.throws(() => validatePairs(pairs), { code: 'calendar_pairs' });
});

test('validatePairs rejects pair with extra keys', () => {
  const pairs = [{ subject: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', wp_user_id: 1, extra: true }];
  assert.throws(() => validatePairs(pairs), { code: 'calendar_pairs' });
});

test('validatePairs rejects invalid UUID subject', () => {
  const pairs = [{ subject: 'not-a-uuid', wp_user_id: 1 }];
  assert.throws(() => validatePairs(pairs), { code: 'calendar_pairs' });
});

test('validatePairs rejects non-integer wp_user_id', () => {
  const pairs = [{ subject: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', wp_user_id: 1.5 }];
  assert.throws(() => validatePairs(pairs), { code: 'calendar_pairs' });
});

test('validatePairs rejects wp_user_id of 0', () => {
  const pairs = [{ subject: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', wp_user_id: 0 }];
  assert.throws(() => validatePairs(pairs), { code: 'calendar_pairs' });
});

test('validatePairs rejects negative wp_user_id', () => {
  const pairs = [{ subject: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', wp_user_id: -1 }];
  assert.throws(() => validatePairs(pairs), { code: 'calendar_pairs' });
});

test('validatePairs rejects duplicate subjects', () => {
  const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const pairs = [
    { subject: uuid, wp_user_id: 1 },
    { subject: uuid, wp_user_id: 2 },
  ];
  assert.throws(() => validatePairs(pairs), { code: 'calendar_pairs' });
});

test('validatePairs rejects duplicate wp_user_ids', () => {
  const pairs = [
    { subject: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', wp_user_id: 1 },
    { subject: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', wp_user_id: 1 },
  ];
  assert.throws(() => validatePairs(pairs), { code: 'calendar_pairs' });
});

test('validatePairs rejects missing subject key', () => {
  const pairs = [{ wp_user_id: 1 }];
  assert.throws(() => validatePairs(pairs), { code: 'calendar_pairs' });
});

test('validatePairs rejects missing wp_user_id key', () => {
  const pairs = [{ subject: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' }];
  assert.throws(() => validatePairs(pairs), { code: 'calendar_pairs' });
});

// ── isLogisticsTarget ────────────────────────────────────────────────
// isLogisticsTarget uses a WeakMap keyed on objects from admittedTarget,
// so we can only test the actor role check and the negative case.

test('isLogisticsTarget returns false for non-admin actor', () => {
  const actor = { role: 'student' };
  assert.equal(isLogisticsTarget(actor, {}), false);
});

test('isLogisticsTarget returns false for null actor', () => {
  assert.equal(isLogisticsTarget(null, {}), false);
});

test('isLogisticsTarget returns false for unknown target object', () => {
  // A target not created by admittedTarget won't be in the WeakMap
  const actor = { role: 'admin' };
  assert.equal(isLogisticsTarget(actor, { ownerId: 'x', wpUserId: 1 }), false);
});
