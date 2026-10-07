import test from 'node:test';
import assert from 'node:assert/strict';
import {
  researchEnabled, requireResearch, provisionalMission,
  researchCommands, provisionalSQL, provisionalValues,
} from '../../server/research-workspace.mjs';
import { MRX_VERSION, MRX_SCHEMA } from '../../server/research-standard.mjs';

// ── researchCommands ──────────────────────────────────────────────────

test('researchCommands is a Set of 6 actions', () => {
  assert.ok(researchCommands instanceof Set);
  assert.equal(researchCommands.size, 6);
  assert.ok(researchCommands.has('mission.create'));
  assert.ok(researchCommands.has('submission.upload'));
  assert.ok(researchCommands.has('submission.repair'));
  assert.ok(researchCommands.has('submission.withdraw'));
  assert.ok(researchCommands.has('submission.decide'));
  assert.ok(researchCommands.has('research.read'));
});

// ── provisionalValues ─────────────────────────────────────────────────

test('provisionalValues contains MRX_VERSION and MRX_SCHEMA', () => {
  assert.deepEqual(provisionalValues, [MRX_VERSION, MRX_SCHEMA]);
});

test('provisionalSQL is a string with parameter placeholders', () => {
  assert.ok(typeof provisionalSQL === 'string');
  assert.ok(provisionalSQL.includes('$1'));
  assert.ok(provisionalSQL.includes('$2'));
});

// ── researchEnabled ───────────────────────────────────────────────────

function validConfig() {
  return { researchMissionsEnabled: true };
}

function studentActor(overrides = {}) {
  return {
    role: 'student',
    tier: '360',
    eligible: true,
    ...overrides,
  };
}

function adminActor(overrides = {}) {
  return {
    role: 'admin',
    tier: 'admin',
    eligible: true,
    ...overrides,
  };
}

test('researchEnabled returns true for eligible student with 360 tier', () => {
  assert.equal(researchEnabled(validConfig(), studentActor()), true);
});

test('researchEnabled returns true for eligible student with ivprep_complete tier', () => {
  assert.equal(researchEnabled(validConfig(), studentActor({ tier: 'ivprep_complete' })), true);
});

test('researchEnabled returns true for eligible admin', () => {
  assert.equal(researchEnabled(validConfig(), adminActor()), true);
});

test('researchEnabled returns false when research disabled in config', () => {
  assert.equal(researchEnabled({ researchMissionsEnabled: false }, studentActor()), false);
});

test('researchEnabled returns false for missing config', () => {
  assert.equal(researchEnabled(null, studentActor()), false);
  assert.equal(researchEnabled(undefined, studentActor()), false);
});

test('researchEnabled returns false for ineligible actor', () => {
  assert.equal(researchEnabled(validConfig(), studentActor({ eligible: false })), false);
});

test('researchEnabled returns false for null actor', () => {
  assert.equal(researchEnabled(validConfig(), null), false);
});

test('researchEnabled returns false for wrong student tier', () => {
  assert.equal(researchEnabled(validConfig(), studentActor({ tier: 'basic' })), false);
});

test('researchEnabled returns false for non-admin non-student role', () => {
  assert.equal(researchEnabled(validConfig(), { role: 'viewer', tier: '360', eligible: true }), false);
});

test('researchEnabled returns false for admin with wrong tier', () => {
  assert.equal(researchEnabled(validConfig(), adminActor({ tier: '360' })), false);
});

test('researchEnabled returns false for student with admin tier', () => {
  assert.equal(researchEnabled(validConfig(), studentActor({ tier: 'admin' })), false);
});

// ── requireResearch ───────────────────────────────────────────────────

test('requireResearch does not throw for valid config and actor', () => {
  assert.doesNotThrow(() => requireResearch(validConfig(), studentActor()));
});

test('requireResearch throws coming_soon when research not enabled', () => {
  assert.throws(
    () => requireResearch({ researchMissionsEnabled: false }, studentActor()),
    { code: 'coming_soon', status: 503 }
  );
});

test('requireResearch throws research_access_required for ineligible actor', () => {
  assert.throws(
    () => requireResearch(validConfig(), studentActor({ eligible: false })),
    { code: 'research_access_required', status: 403 }
  );
});

test('requireResearch throws research_access_required for wrong tier', () => {
  assert.throws(
    () => requireResearch(validConfig(), studentActor({ tier: 'basic' })),
    { code: 'research_access_required', status: 403 }
  );
});

test('requireResearch throws coming_soon before access check', () => {
  // When both config and actor are invalid, config check fires first
  assert.throws(
    () => requireResearch({}, studentActor({ eligible: false })),
    { code: 'coming_soon' }
  );
});

// ── provisionalMission ────────────────────────────────────────────────

test('provisionalMission returns true for standard_version match', () => {
  assert.equal(provisionalMission({ standard_version: MRX_VERSION }), true);
});

test('provisionalMission returns true for public_payload.kind match', () => {
  assert.equal(provisionalMission({ public_payload: { kind: MRX_VERSION } }), true);
});

test('provisionalMission returns true for public_payload.schema match', () => {
  assert.equal(provisionalMission({ public_payload: { schema: MRX_SCHEMA } }), true);
});

test('provisionalMission returns false for wrong version', () => {
  assert.equal(provisionalMission({ standard_version: 'OTHER_V2' }), false);
});

test('provisionalMission returns false for empty object', () => {
  assert.equal(provisionalMission({}), false);
});

test('provisionalMission returns false for null', () => {
  assert.equal(provisionalMission(null), false);
});

test('provisionalMission returns false for undefined', () => {
  assert.equal(provisionalMission(undefined), false);
});

test('provisionalMission returns false for wrong schema', () => {
  assert.equal(provisionalMission({ public_payload: { schema: 'wrong.schema' } }), false);
});
