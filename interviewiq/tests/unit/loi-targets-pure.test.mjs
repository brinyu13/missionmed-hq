import test from 'node:test';
import assert from 'node:assert/strict';
import {
  targetCommands, targetsEnabled, targetEnvelope, targetLetterAllowed, targetView,
} from '../../server/loi-targets.mjs';
import { LOI_CANARY_OWNER } from '../../server/loi-openai.mjs';

// ── helpers ──────────────────────────────────────────────────────────

function targetsConfig(overrides = {}) {
  return {
    loi: {
      enabled: true,
      targetsEnabled: true,
      mode: 'CANARY',
      ownerId: LOI_CANARY_OWNER,
      programId: 'some_program',
      ...overrides,
    },
  };
}

function validStudent(overrides = {}) {
  return {
    id: LOI_CANARY_OWNER,
    role: 'student',
    eligible: true,
    tier: '360',
    ...overrides,
  };
}

// ── targetCommands ───────────────────────────────────────────────────

test('targetCommands is a Set of 7 actions', () => {
  assert.ok(targetCommands instanceof Set);
  assert.equal(targetCommands.size, 7);
  assert.ok(targetCommands.has('loitarget.create'));
  assert.ok(targetCommands.has('loitarget.update'));
  assert.ok(targetCommands.has('loitarget.read'));
  assert.ok(targetCommands.has('loitarget.list'));
  assert.ok(targetCommands.has('loitarget.saved'));
  assert.ok(targetCommands.has('myeras.preview'));
  assert.ok(targetCommands.has('myeras.import'));
});

// ── targetsEnabled ───────────────────────────────────────────────────

test('targetsEnabled returns true for valid config and actor', () => {
  assert.equal(targetsEnabled(targetsConfig(), validStudent()), true);
});

test('targetsEnabled returns true with ivprep_complete tier', () => {
  assert.equal(targetsEnabled(targetsConfig(), validStudent({ tier: 'ivprep_complete' })), true);
});

test('targetsEnabled returns false when targetsEnabled config is false', () => {
  assert.equal(targetsEnabled(targetsConfig({ targetsEnabled: false }), validStudent()), false);
});

test('targetsEnabled returns false when loi not enabled', () => {
  assert.equal(targetsEnabled(targetsConfig({ enabled: false }), validStudent()), false);
});

test('targetsEnabled returns false for non-student role', () => {
  assert.equal(targetsEnabled(targetsConfig(), validStudent({ role: 'admin' })), false);
});

test('targetsEnabled returns false for ineligible actor', () => {
  assert.equal(targetsEnabled(targetsConfig(), validStudent({ eligible: false })), false);
});

test('targetsEnabled returns false for wrong tier', () => {
  assert.equal(targetsEnabled(targetsConfig(), validStudent({ tier: 'basic' })), false);
});

test('targetsEnabled returns false for invalid mode', () => {
  assert.equal(targetsEnabled(targetsConfig({ mode: 'INVALID' }), validStudent()), false);
});

test('targetsEnabled returns false when CANARY mode lacks ownerId', () => {
  assert.equal(targetsEnabled(targetsConfig({ ownerId: undefined }), validStudent()), false);
});

test('targetsEnabled returns false when CANARY mode lacks programId', () => {
  assert.equal(targetsEnabled(targetsConfig({ programId: undefined }), validStudent()), false);
});

test('targetsEnabled returns false when actor id does not match ownerId', () => {
  assert.equal(targetsEnabled(targetsConfig(), validStudent({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' })), false);
});

test('targetsEnabled returns true in ELIGIBLE mode without ownerId', () => {
  const config = targetsConfig({ mode: 'ELIGIBLE', ownerId: undefined, programId: undefined });
  assert.equal(targetsEnabled(config, validStudent({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' })), true);
});

test('targetsEnabled checks targetsOwnerId when present', () => {
  const config = targetsConfig({ targetsOwnerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' });
  assert.equal(targetsEnabled(config, validStudent()), false);
});

test('targetsEnabled passes when targetsOwnerId matches actor', () => {
  const config = targetsConfig({ targetsOwnerId: LOI_CANARY_OWNER });
  assert.equal(targetsEnabled(config, validStudent()), true);
});

// ── targetEnvelope ───────────────────────────────────────────────────

test('targetEnvelope falls through to commandEnvelope when no targetKind/targetId', () => {
  const body = {
    command: 'loi.save',
    interviewId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    data: {},
    requestId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    expectedVersion: 1,
  };
  const result = targetEnvelope(body);
  assert.equal(result.command, 'loi.save');
  assert.ok('bodyHash' in result);
});

test('targetEnvelope accepts program targetKind with letter command', () => {
  const body = {
    command: 'loi.save',
    targetKind: 'program',
    targetId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    data: {},
    requestId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    expectedVersion: 1,
  };
  const result = targetEnvelope(body);
  assert.equal(result.targetKind, 'program');
  assert.equal(result.command, 'loi.save');
});

test('targetEnvelope accepts loitarget.create with null targetId', () => {
  const body = {
    command: 'loitarget.create',
    targetKind: 'program',
    targetId: null,
    data: {},
    requestId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    expectedVersion: 0,
  };
  const result = targetEnvelope(body);
  assert.equal(result.targetId, null);
});

test('targetEnvelope rejects non-program targetKind', () => {
  const body = {
    command: 'loi.save',
    targetKind: 'interview',
    targetId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    data: {},
    requestId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    expectedVersion: 1,
  };
  assert.throws(() => targetEnvelope(body), { code: 'invalid_loi_target' });
});

test('targetEnvelope rejects unrecognized command with targetKind', () => {
  const body = {
    command: 'unknown.action',
    targetKind: 'program',
    targetId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    data: {},
    requestId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    expectedVersion: 1,
  };
  assert.throws(() => targetEnvelope(body), { code: 'invalid_loi_target' });
});

test('targetEnvelope requires null targetId for create-like commands', () => {
  const body = {
    command: 'loitarget.create',
    targetKind: 'program',
    targetId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    data: {},
    requestId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    expectedVersion: 0,
  };
  assert.throws(() => targetEnvelope(body), { code: 'invalid_loi_target' });
});

test('targetEnvelope requires valid UUID for targetId on update command', () => {
  const body = {
    command: 'loitarget.update',
    targetKind: 'program',
    targetId: 'not-a-uuid',
    data: {},
    requestId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    expectedVersion: 1,
  };
  assert.throws(() => targetEnvelope(body), { code: 'invalid_identifier' });
});

test('targetEnvelope rejects unexpected keys', () => {
  const body = {
    command: 'loi.save',
    targetKind: 'program',
    targetId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    data: {},
    requestId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    expectedVersion: 1,
    extra: true,
  };
  assert.throws(() => targetEnvelope(body), { code: 'unexpected_fields' });
});

test('targetEnvelope includes bodyHash in result', () => {
  const body = {
    command: 'loi.save',
    targetKind: 'program',
    targetId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    data: {},
    requestId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    expectedVersion: 1,
  };
  const result = targetEnvelope(body);
  assert.ok(typeof result.bodyHash === 'string');
  assert.ok(result.bodyHash.length === 64);
});

test('targetEnvelope null-targetId commands include list and saved', () => {
  for (const cmd of ['loitarget.list', 'loitarget.saved', 'myeras.preview', 'myeras.import']) {
    const body = {
      command: cmd,
      targetKind: 'program',
      targetId: null,
      data: {},
      requestId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      expectedVersion: 0,
    };
    assert.doesNotThrow(() => targetEnvelope(body), `Failed for ${cmd}`);
  }
});

// ── targetLetterAllowed ──────────────────────────────────────────────

test('targetLetterAllowed returns true for matching MATCHED row', () => {
  const row = {
    owner_id: LOI_CANARY_OWNER,
    resolution_state: 'MATCHED',
    program_id: 'some_program',
  };
  assert.equal(targetLetterAllowed(targetsConfig(), validStudent(), row), true);
});

test('targetLetterAllowed returns false when owner_id mismatches', () => {
  const row = {
    owner_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    resolution_state: 'MATCHED',
    program_id: 'some_program',
  };
  assert.equal(targetLetterAllowed(targetsConfig(), validStudent(), row), false);
});

test('targetLetterAllowed returns false for non-MATCHED resolution', () => {
  const row = {
    owner_id: LOI_CANARY_OWNER,
    resolution_state: 'NOT_FOUND',
    program_id: 'some_program',
  };
  assert.equal(targetLetterAllowed(targetsConfig(), validStudent(), row), false);
});

test('targetLetterAllowed returns false when program_id mismatches config', () => {
  const row = {
    owner_id: LOI_CANARY_OWNER,
    resolution_state: 'MATCHED',
    program_id: 'other_program',
  };
  assert.equal(targetLetterAllowed(targetsConfig(), validStudent(), row), false);
});

test('targetLetterAllowed returns null/falsy when program_id is null', () => {
  const row = {
    owner_id: LOI_CANARY_OWNER,
    resolution_state: 'MATCHED',
    program_id: null,
  };
  // loiProgramAllowed returns false for non-string programId, but the function
  // may short-circuit to null/undefined via optional chaining — assert falsy
  assert.ok(!targetLetterAllowed(targetsConfig(), validStudent(), row));
});

test('targetLetterAllowed returns false when targetsEnabled fails', () => {
  const config = targetsConfig({ targetsEnabled: false });
  const row = {
    owner_id: LOI_CANARY_OWNER,
    resolution_state: 'MATCHED',
    program_id: 'some_program',
  };
  assert.equal(targetLetterAllowed(config, validStudent(), row), false);
});

test('targetLetterAllowed passes without config programId filter', () => {
  const config = targetsConfig({ mode: 'ELIGIBLE', ownerId: undefined, programId: undefined });
  const row = {
    owner_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    resolution_state: 'MATCHED',
    program_id: 'any_program',
  };
  assert.equal(targetLetterAllowed(config, validStudent({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' }), row), true);
});

// ── targetView ───────────────────────────────────────────────────────

function makeRow(overrides = {}) {
  return {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    program_id: 'some_program',
    program_name: 'Mayo Clinic IM',
    program_track: 'Categorical',
    registry_release_id: 'rel-1',
    resolution_state: 'MATCHED',
    target_choice: 'CREATE_LETTER',
    position_type: 'CATEGORICAL',
    version: 3,
    sources: [{ source: 'RISE_SAVED' }],
    created_at: '2025-07-01T00:00:00.000Z',
    updated_at: '2025-07-02T00:00:00.000Z',
    ...overrides,
  };
}

test('targetView returns correct shape', () => {
  const result = targetView(makeRow());
  assert.equal(result.targetKind, 'program');
  assert.equal(result.targetId, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
  assert.equal(result.program.id, 'some_program');
  assert.equal(result.program.name, 'Mayo Clinic IM');
  assert.equal(result.program.track, 'Categorical');
  assert.equal(result.program.registryReleaseId, 'rel-1');
  assert.equal(result.programName, 'Mayo Clinic IM');
  assert.equal(result.resolutionState, 'MATCHED');
  assert.equal(result.choice, 'CREATE_LETTER');
  assert.ok(!('positionType' in result), 'no schema-less positionType projection (iiq.loi_targets has no position_type column)');
  assert.equal(result.version, 3);
  assert.equal(result.evidenceState, 'UNKNOWN');
});

test('targetView returns null program when program_id is null', () => {
  const result = targetView(makeRow({ program_id: null }));
  assert.equal(result.program, null);
});

test('targetView never projects positionType (PGY-1 context is derived in loi-generation)', () => {
  const result = targetView(makeRow({ position_type: 'PRELIMINARY' }));
  assert.ok(!('positionType' in result));
});

test('targetView includes loi history when provided', () => {
  const history = { current: null, outreach: [] };
  const result = targetView(makeRow(), history);
  assert.deepEqual(result.loi, history);
});

test('targetView omits loi when history not provided', () => {
  const result = targetView(makeRow());
  assert.ok(!('loi' in result));
});

test('targetView converts Date objects to ISO strings', () => {
  const result = targetView(makeRow({
    created_at: new Date('2025-07-01T00:00:00.000Z'),
    updated_at: new Date('2025-07-02T00:00:00.000Z'),
  }));
  assert.equal(result.createdAt, '2025-07-01T00:00:00.000Z');
  assert.equal(result.updatedAt, '2025-07-02T00:00:00.000Z');
});

test('targetView passes through string timestamps as-is', () => {
  const result = targetView(makeRow({
    created_at: '2025-07-01',
    updated_at: '2025-07-02',
  }));
  assert.equal(result.createdAt, '2025-07-01');
  assert.equal(result.updatedAt, '2025-07-02');
});

test('targetView coerces version to number', () => {
  // Database may return bigint as string
  const result = targetView(makeRow({ version: '5' }));
  assert.equal(result.version, 5);
  assert.equal(typeof result.version, 'number');
});
