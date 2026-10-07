import test from 'node:test';
import assert from 'node:assert/strict';
import {
  intakeEnabled, requireIntake, intakeCommands,
  POSITION_TYPES, EXPERIENCE_TYPES, EVENT_TYPES,
  parseIntake,
} from '../../server/interview-intake.mjs';

// ── Constants ──────────────────────────────────────────────────────────

test('POSITION_TYPES has 7 entries', () => {
  assert.equal(POSITION_TYPES.length, 7);
  assert.ok(POSITION_TYPES.includes('CATEGORICAL'));
  assert.ok(POSITION_TYPES.includes('ADVANCED'));
  assert.ok(POSITION_TYPES.includes('PRELIMINARY'));
  assert.ok(POSITION_TYPES.includes('TRANSITIONAL_YEAR'));
});

test('EXPERIENCE_TYPES has 10 entries', () => {
  assert.equal(EXPERIENCE_TYPES.length, 10);
  assert.ok(EXPERIENCE_TYPES.includes('CLERKSHIP'));
  assert.ok(EXPERIENCE_TYPES.includes('AWAY_ROTATION'));
});

test('EVENT_TYPES has 6 entries', () => {
  assert.equal(EVENT_TYPES.length, 6);
  assert.ok(EVENT_TYPES.includes('MEET_GREET'));
  assert.ok(EVENT_TYPES.includes('SECOND_LOOK'));
});

// ── intakeEnabled ──────────────────────────────────────────────────────

test('intakeEnabled returns true for valid config and actor', () => {
  const config = { intake: { enabled: true } };
  const actor = { role: 'student', tier: '360', eligible: true };
  assert.equal(intakeEnabled(config, actor), true);
});

test('intakeEnabled accepts ivprep_complete tier', () => {
  const config = { intake: { enabled: true } };
  const actor = { role: 'student', tier: 'ivprep_complete', eligible: true };
  assert.equal(intakeEnabled(config, actor), true);
});

test('intakeEnabled rejects when intake disabled', () => {
  const config = { intake: { enabled: false } };
  const actor = { role: 'student', tier: '360', eligible: true };
  assert.equal(intakeEnabled(config, actor), false);
});

test('intakeEnabled rejects missing intake config', () => {
  const config = {};
  const actor = { role: 'student', tier: '360', eligible: true };
  assert.equal(intakeEnabled(config, actor), false);
});

test('intakeEnabled rejects non-student role', () => {
  const config = { intake: { enabled: true } };
  const actor = { role: 'admin', tier: '360', eligible: true };
  assert.equal(intakeEnabled(config, actor), false);
});

test('intakeEnabled rejects ineligible actor', () => {
  const config = { intake: { enabled: true } };
  const actor = { role: 'student', tier: '360', eligible: false };
  assert.equal(intakeEnabled(config, actor), false);
});

test('intakeEnabled rejects wrong tier', () => {
  const config = { intake: { enabled: true } };
  const actor = { role: 'student', tier: 'basic', eligible: true };
  assert.equal(intakeEnabled(config, actor), false);
});

test('intakeEnabled rejects null actor', () => {
  const config = { intake: { enabled: true } };
  assert.equal(intakeEnabled(config, null), false);
});

// ── intakeCommands ────────────────────────────────────────────────────

test('intakeCommands is a Set with 3 members', () => {
  assert.ok(intakeCommands instanceof Set);
  assert.equal(intakeCommands.size, 3);
});

test('intakeCommands contains intake.create', () => {
  assert.ok(intakeCommands.has('intake.create'));
});

test('intakeCommands contains intake.update', () => {
  assert.ok(intakeCommands.has('intake.update'));
});

test('intakeCommands contains intake.read', () => {
  assert.ok(intakeCommands.has('intake.read'));
});

// ── requireIntake ─────────────────────────────────────────────────────

test('requireIntake does not throw for valid config and actor', () => {
  const config = { intake: { enabled: true } };
  const actor = { role: 'student', tier: '360', eligible: true };
  assert.doesNotThrow(() => requireIntake(config, actor));
});

test('requireIntake does not throw for ivprep_complete tier', () => {
  const config = { intake: { enabled: true } };
  const actor = { role: 'student', tier: 'ivprep_complete', eligible: true };
  assert.doesNotThrow(() => requireIntake(config, actor));
});

test('requireIntake throws intake_unavailable for disabled config', () => {
  const config = { intake: { enabled: false } };
  const actor = { role: 'student', tier: '360', eligible: true };
  assert.throws(() => requireIntake(config, actor), {
    code: 'intake_unavailable',
    status: 403,
  });
});

test('requireIntake throws intake_unavailable for admin role', () => {
  const config = { intake: { enabled: true } };
  const actor = { role: 'admin', tier: 'admin', eligible: true };
  assert.throws(() => requireIntake(config, actor), {
    code: 'intake_unavailable',
    status: 403,
  });
});

test('requireIntake throws intake_unavailable for ineligible actor', () => {
  const config = { intake: { enabled: true } };
  const actor = { role: 'student', tier: '360', eligible: false };
  assert.throws(() => requireIntake(config, actor), {
    code: 'intake_unavailable',
    status: 403,
  });
});

test('requireIntake throws intake_unavailable for wrong tier', () => {
  const config = { intake: { enabled: true } };
  const actor = { role: 'student', tier: 'basic', eligible: true };
  assert.throws(() => requireIntake(config, actor), {
    code: 'intake_unavailable',
    status: 403,
  });
});

test('requireIntake throws for null actor', () => {
  const config = { intake: { enabled: true } };
  assert.throws(() => requireIntake(config, null), {
    code: 'intake_unavailable',
    status: 403,
  });
});

test('requireIntake throws for missing config', () => {
  const actor = { role: 'student', tier: '360', eligible: true };
  assert.throws(() => requireIntake({}, actor), {
    code: 'intake_unavailable',
    status: 403,
  });
});

test('requireIntake error message describes workspace unavailability', () => {
  const config = { intake: { enabled: false } };
  const actor = { role: 'student', tier: '360', eligible: true };
  try {
    requireIntake(config, actor);
    assert.fail('Expected to throw');
  } catch (e) {
    assert.equal(e.message, 'The new interview intake is not available for this workspace.');
  }
});

// ── parseIntake create mode ────────────────────────────────────────────

function validIdentity(overrides = {}) {
  return {
    invitationLabel: 'Mayo Clinic Internal Medicine',
    provisionalConfirmed: true,
    ...overrides,
  };
}

function validCreateData(overrides = {}) {
  return {
    identity: validIdentity(),
    positionType: 'CATEGORICAL',
    track: 'Categorical',
    deadline: '2025-12-01',
    schedule: { zone: 'UTC' },
    details: { relationshipState: 'NO' },
    experiences: [],
    events: [],
    ...overrides,
  };
}

test('parseIntake create returns correct shape', () => {
  const result = parseIntake(validCreateData());
  assert.ok('identity' in result);
  assert.ok('positionType' in result);
  assert.ok('track' in result);
  assert.ok('schedule' in result);
  assert.ok('deadline' in result);
  assert.ok('details' in result);
  assert.ok('experiences' in result);
  assert.ok('events' in result);
});

test('parseIntake create accepts provisional identity', () => {
  const result = parseIntake(validCreateData());
  assert.equal(result.identity.provisionalConfirmed, true);
  assert.equal(result.identity.programId, null);
});

test('parseIntake create accepts canonical identity', () => {
  const result = parseIntake(validCreateData({
    identity: {
      programId: 'rise_mayo_im',
      registryReleaseId: 'release_123',
      invitationLabel: 'Mayo Clinic Internal Medicine',
      confirmed: true,
    },
  }));
  assert.equal(result.identity.confirmed, true);
  assert.equal(result.identity.programId, 'rise_mayo_im');
});

test('parseIntake create rejects unconfirmed canonical identity', () => {
  assert.throws(() => parseIntake(validCreateData({
    identity: {
      programId: 'rise_mayo_im',
      registryReleaseId: 'release_123',
      invitationLabel: 'Mayo Clinic Internal Medicine',
      confirmed: false,
    },
  })), { code: 'intake_identity_confirmation' });
});

test('parseIntake create rejects canonical without registryReleaseId', () => {
  assert.throws(() => parseIntake(validCreateData({
    identity: {
      programId: 'rise_mayo_im',
      invitationLabel: 'Mayo Clinic Internal Medicine',
      confirmed: true,
    },
  })), { code: 'intake_identity_confirmation' });
});

test('parseIntake create rejects invalid positionType', () => {
  assert.throws(() => parseIntake(validCreateData({ positionType: 'INVALID' })), { code: 'invalid_choice' });
});

test('parseIntake create defaults positionType to UNKNOWN', () => {
  const data = validCreateData();
  delete data.positionType;
  const result = parseIntake(data);
  assert.equal(result.positionType, 'UNKNOWN');
});

test('parseIntake create rejects track over 200 chars', () => {
  assert.throws(() => parseIntake(validCreateData({ track: 'x'.repeat(201) })), { code: 'invalid_text' });
});

test('parseIntake create validates deadline', () => {
  const result = parseIntake(validCreateData({ deadline: '2025-12-01' }));
  assert.equal(result.deadline, '2025-12-01');
});

test('parseIntake create accepts null deadline', () => {
  const result = parseIntake(validCreateData({ deadline: null }));
  assert.equal(result.deadline, null);
});

test('parseIntake create rejects invalid deadline', () => {
  assert.throws(() => parseIntake(validCreateData({ deadline: 'bad' })), { code: 'invalid_date' });
});

test('parseIntake create validates schedule keys', () => {
  assert.throws(() => parseIntake(validCreateData({
    schedule: { zone: 'UTC', hacked: true },
  })), { code: 'unexpected_fields' });
});

test('parseIntake create rejects experiences without relationship', () => {
  assert.throws(() => parseIntake(validCreateData({
    details: { relationshipState: 'NO' },
    experiences: [{ kind: 'CLERKSHIP', description: 'IM rotation', confirmed: true }],
  })), { code: 'intake_relationship' });
});

test('parseIntake create allows experiences with relationship YES', () => {
  const result = parseIntake(validCreateData({
    details: { relationshipState: 'YES' },
    experiences: [{
      kind: 'CLERKSHIP',
      description: 'IM rotation at Mayo',
      confirmed: true,
    }],
  }));
  assert.equal(result.experiences.length, 1);
  assert.equal(result.experiences[0].kind, 'CLERKSHIP');
});

test('parseIntake create rejects unconfirmed experience', () => {
  assert.throws(() => parseIntake(validCreateData({
    details: { relationshipState: 'YES' },
    experiences: [{
      kind: 'CLERKSHIP',
      description: 'IM rotation',
      confirmed: false,
    }],
  })), { code: 'intake_experience_confirmation' });
});

test('parseIntake create rejects misordered experience dates', () => {
  assert.throws(() => parseIntake(validCreateData({
    details: { relationshipState: 'YES' },
    experiences: [{
      kind: 'CLERKSHIP',
      description: 'IM rotation',
      confirmed: true,
      startDate: '2025-06-01',
      endDate: '2025-05-01',
    }],
  })), { code: 'intake_experience_dates' });
});

test('parseIntake create rejects over 20 experiences', () => {
  const exps = Array.from({ length: 21 }, () => ({
    kind: 'CLERKSHIP', description: 'rotation', confirmed: true,
  }));
  assert.throws(() => parseIntake(validCreateData({
    details: { relationshipState: 'YES' },
    experiences: exps,
  })), { code: 'invalid_array' });
});

test('parseIntake create validates events with clientKeys', () => {
  const result = parseIntake(validCreateData({
    events: [{
      clientKey: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      kind: 'DINNER',
      schedule: { date: '2025-12-01', zone: 'UTC' },
    }],
  }));
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].kind, 'DINNER');
});

test('parseIntake create rejects duplicate event clientKeys', () => {
  const key = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  assert.throws(() => parseIntake(validCreateData({
    events: [
      { clientKey: key, kind: 'DINNER', schedule: { date: '2025-12-01', zone: 'UTC' } },
      { clientKey: key, kind: 'SOCIAL', schedule: { date: '2025-12-02', zone: 'UTC' } },
    ],
  })), { code: 'intake_duplicate_event' });
});

test('parseIntake create rejects over 12 events', () => {
  const events = Array.from({ length: 13 }, (_, i) => ({
    clientKey: `a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5${i.toString(16).padStart(2, '0')}`.slice(0, 36),
    kind: 'OTHER',
    schedule: { date: '2025-12-01', zone: 'UTC' },
  }));
  assert.throws(() => parseIntake(validCreateData({ events })), { code: 'invalid_array' });
});

test('parseIntake create rejects advancedFactConfirmed for non-ADVANCED', () => {
  assert.throws(() => parseIntake(validCreateData({
    positionType: 'CATEGORICAL',
    details: { advancedFactConfirmed: true, prelimTargetId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' },
  })), { code: 'intake_advanced_context' });
});

test('parseIntake create rejects advancedFactConfirmed without prelimTargetId', () => {
  assert.throws(() => parseIntake(validCreateData({
    positionType: 'ADVANCED',
    details: { advancedFactConfirmed: true },
  })), { code: 'intake_prelim_target' });
});

// ── parseIntake details validation ────────────────────────────────────

test('parseIntake create validates FIELDS choices', () => {
  const result = parseIntake(validCreateData({
    details: {
      invitationSource: 'ERAS',
      platform: 'ZOOM',
      priority: 'HIGH',
      structure: 'PANEL',
    },
  }));
  assert.equal(result.details.invitationSource, 'ERAS');
  assert.equal(result.details.platform, 'ZOOM');
  assert.equal(result.details.priority, 'HIGH');
  assert.equal(result.details.structure, 'PANEL');
});

test('parseIntake create rejects invalid field choice', () => {
  assert.throws(() => parseIntake(validCreateData({
    details: { priority: 'MEGA_HIGH' },
  })), { code: 'invalid_choice' });
});

test('parseIntake create validates TEXT_FIELDS lengths', () => {
  assert.throws(() => parseIntake(validCreateData({
    details: { location: 'x'.repeat(1001) },
  })), { code: 'invalid_text' });
});

test('parseIntake create validates matchCycle range', () => {
  const result = parseIntake(validCreateData({
    details: { matchCycle: 2025 },
  }));
  assert.equal(result.details.matchCycle, 2025);
});

test('parseIntake create rejects matchCycle out of range', () => {
  assert.throws(() => parseIntake(validCreateData({
    details: { matchCycle: 1999 },
  })), { code: 'invalid_integer' });
});

test('parseIntake create validates interviewCount range', () => {
  const result = parseIntake(validCreateData({
    details: { interviewCount: 5 },
  }));
  assert.equal(result.details.interviewCount, 5);
});

test('parseIntake create rejects interviewCount over 30', () => {
  assert.throws(() => parseIntake(validCreateData({
    details: { interviewCount: 31 },
  })), { code: 'invalid_integer' });
});

test('parseIntake create rejects interviewCount below 1', () => {
  assert.throws(() => parseIntake(validCreateData({
    details: { interviewCount: 0 },
  })), { code: 'invalid_integer' });
});

test('parseIntake create validates prelimTargetId as UUID', () => {
  const result = parseIntake(validCreateData({
    positionType: 'ADVANCED',
    details: {
      prelimTargetId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      advancedFactConfirmed: true,
    },
  }));
  assert.equal(result.details.prelimTargetId, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
});

test('parseIntake create rejects invalid prelimTargetId', () => {
  assert.throws(() => parseIntake(validCreateData({
    details: { prelimTargetId: 'not-a-uuid' },
  })), { code: 'invalid_identifier' });
});

// ── parseIntake update mode ────────────────────────────────────────────

test('parseIntake update returns expected shape', () => {
  const result = parseIntake({
    expectedIntakeVersion: 1,
    details: { priority: 'HIGH' },
  }, true);
  assert.ok('positionType' in result);
  assert.ok('detailsInput' in result);
  assert.ok('expectedIntakeVersion' in result);
  assert.equal(result.expectedIntakeVersion, 1);
  assert.deepEqual(result.detailsInput, { priority: 'HIGH' });
});

test('parseIntake update requires expectedIntakeVersion', () => {
  assert.throws(() => parseIntake({
    details: {},
  }, true), { code: 'invalid_integer' });
});

test('parseIntake update accepts undefined positionType', () => {
  const result = parseIntake({
    expectedIntakeVersion: 1,
  }, true);
  assert.equal(result.positionType, undefined);
});

test('parseIntake update validates positionType when present', () => {
  const result = parseIntake({
    expectedIntakeVersion: 1,
    positionType: 'ADVANCED',
  }, true);
  assert.equal(result.positionType, 'ADVANCED');
});

test('parseIntake update rejects invalid positionType', () => {
  assert.throws(() => parseIntake({
    expectedIntakeVersion: 1,
    positionType: 'INVALID',
  }, true), { code: 'invalid_choice' });
});

test('parseIntake update rejects unexpected keys', () => {
  assert.throws(() => parseIntake({
    expectedIntakeVersion: 1,
    identity: validIdentity(),
  }, true), { code: 'unexpected_fields' });
});

test('parseIntake update passes through experiences input', () => {
  const result = parseIntake({
    expectedIntakeVersion: 1,
    experiences: [],
  }, true);
  assert.deepEqual(result.experiencesInput, []);
});

test('parseIntake update accepts undefined experiences', () => {
  const result = parseIntake({
    expectedIntakeVersion: 1,
  }, true);
  assert.equal(result.experiencesInput, undefined);
});
