import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudentPreview } from '../../server/calendar-preview.mjs';

// ── emptyStudentPreview ──────────────────────────────────────────────

test('emptyStudentPreview returns preview object for valid admin', () => {
  const actor = { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', role: 'admin', tier: 'admin', eligible: true, zone: 'America/Chicago' };
  const result = emptyStudentPreview(actor);
  assert.equal(result.serverPreview, true);
});

test('emptyStudentPreview actor has admin identity', () => {
  const actor = { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', role: 'admin', tier: 'admin', eligible: true, zone: 'America/Chicago' };
  const result = emptyStudentPreview(actor);
  assert.equal(result.actor.id, actor.id);
  assert.equal(result.actor.role, 'admin');
  assert.equal(result.actor.tier, 'admin');
  assert.equal(result.actor.displayName, 'Student Preview');
  assert.equal(result.actor.firstName, 'Preview');
  assert.equal(result.actor.zone, 'America/Chicago');
});

test('emptyStudentPreview capabilities are all disabled', () => {
  const actor = { id: 'test-id', role: 'admin', tier: 'admin', eligible: true, zone: 'US/Eastern' };
  const result = emptyStudentPreview(actor);
  assert.equal(result.capabilities.coreOnly, true);
  assert.equal(result.capabilities.loi, false);
  assert.equal(result.capabilities.loiTargets, false);
  assert.equal(result.capabilities.loiComposition, false);
  assert.equal(result.capabilities.myerasImport, false);
  assert.equal(result.capabilities.intakeV2, false);
  assert.equal(result.capabilities.calendarV2, false);
  assert.equal(result.capabilities.itinerary, false);
  assert.equal(result.capabilities.adminLogistics, false);
  assert.equal(result.capabilities.research, false);
  assert.equal(result.capabilities.deepResearch, false);
});

test('emptyStudentPreview catalog is empty', () => {
  const actor = { id: 'test-id', role: 'admin', tier: 'admin', eligible: true, zone: 'UTC' };
  const result = emptyStudentPreview(actor);
  assert.deepEqual(result.catalog.programs, []);
  assert.deepEqual(result.catalog.facts, []);
  assert.deepEqual(result.catalog.sources, []);
  assert.deepEqual(result.catalog.profiles, []);
  assert.equal(result.catalog.student_zone, 'UTC');
  assert.equal(result.catalog.registry_release, null);
});

test('emptyStudentPreview state has empty interviews', () => {
  const actor = { id: 'test-id', role: 'admin', tier: 'admin', eligible: true, zone: 'UTC' };
  const result = emptyStudentPreview(actor);
  assert.deepEqual(result.state.interviews, []);
  assert.deepEqual(result.state.reviewQueue, []);
  assert.deepEqual(result.state.mentorAssigned, []);
  assert.deepEqual(result.state.changes, []);
});

test('emptyStudentPreview state has empty contrib', () => {
  const actor = { id: 'test-id', role: 'admin', tier: 'admin', eligible: true, zone: 'UTC' };
  const result = emptyStudentPreview(actor);
  assert.deepEqual(result.state.contrib.submissions, []);
  assert.deepEqual(result.state.contrib.ledger, []);
});

test('emptyStudentPreview state has ISO clock', () => {
  const actor = { id: 'test-id', role: 'admin', tier: 'admin', eligible: true, zone: 'UTC' };
  const result = emptyStudentPreview(actor);
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(result.state.clock));
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(result.server_time));
});

test('emptyStudentPreview has version 0', () => {
  const actor = { id: 'test-id', role: 'admin', tier: 'admin', eligible: true, zone: 'UTC' };
  const result = emptyStudentPreview(actor);
  assert.equal(result.version, 0);
});

test('emptyStudentPreview has empty integrations', () => {
  const actor = { id: 'test-id', role: 'admin', tier: 'admin', eligible: true, zone: 'UTC' };
  const result = emptyStudentPreview(actor);
  assert.deepEqual(result.integrations, {});
});

test('emptyStudentPreview state has empty domain objects', () => {
  const actor = { id: 'test-id', role: 'admin', tier: 'admin', eligible: true, zone: 'UTC' };
  const result = emptyStudentPreview(actor);
  // Each domain key should be an empty object (from empty())
  for (const key of ['why', 'questions', 'practice', 'debriefs', 'learning', 'rank', 'demands', 'results', 'shared', 'mentorPriority', 'loi', 'consents', 'mentorNudges', 'ivoc']) {
    assert.ok(key in result.state, `missing state.${key}`);
  }
});

test('emptyStudentPreview throws for non-admin role', () => {
  const actor = { id: 'test-id', role: 'student', tier: '360', eligible: true, zone: 'UTC' };
  assert.throws(() => emptyStudentPreview(actor), { code: 'admin_required' });
});

test('emptyStudentPreview throws for admin with wrong tier', () => {
  const actor = { id: 'test-id', role: 'admin', tier: '360', eligible: true, zone: 'UTC' };
  assert.throws(() => emptyStudentPreview(actor), { code: 'admin_required' });
});

test('emptyStudentPreview throws for ineligible admin', () => {
  const actor = { id: 'test-id', role: 'admin', tier: 'admin', eligible: false, zone: 'UTC' };
  assert.throws(() => emptyStudentPreview(actor), { code: 'admin_required' });
});

test('emptyStudentPreview throws for null actor', () => {
  assert.throws(() => emptyStudentPreview(null), { code: 'admin_required' });
});

test('emptyStudentPreview throws for undefined actor', () => {
  assert.throws(() => emptyStudentPreview(undefined), { code: 'admin_required' });
});
