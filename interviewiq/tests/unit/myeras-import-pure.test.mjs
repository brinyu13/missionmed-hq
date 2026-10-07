import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseImport, rowKey, myerasCommands, myerasEnabled, requireMyeras,
} from '../../server/myeras-import.mjs';
import { MYERAS_HEADER } from '../../server/myeras-csv.mjs';

// Helper: build a minimal valid CSV
function buildCsv(rows) {
  const lines = [MYERAS_HEADER.join(',')];
  for (const row of rows) lines.push(row.join(','));
  return lines.join('\n');
}

function validRow(overrides = {}) {
  const defaults = {
    program_name: 'Mayo Clinic Internal Medicine',
    specialty: 'Internal Medicine',
    track: 'Categorical',
    institution: 'Mayo Clinic',
    city: 'Rochester',
    state: 'MN',
    program_identifier: 'ACGME1234567890',
    application_status: 'Applied',
    signal_status: 'Signaled',
    interview_status: 'Interview Received',
    source: 'MYERAS',
    exported_at: '2025-01-15T12:00:00Z',
  };
  const merged = { ...defaults, ...overrides };
  return MYERAS_HEADER.map(k => merged[k]);
}

// ── parseImport ────────────────────────────────────────────────────────

test('parseImport accepts valid CSV string', () => {
  const csv = buildCsv([validRow()]);
  const result = parseImport({ csvText: csv }, true);
  assert.equal(result.schema, 'iiq-myeras-import-v1');
  assert.equal(result.uniqueCount, 1);
});

test('parseImport rejects non-string csvText', () => {
  assert.throws(() => parseImport({ csvText: 42 }, true), { code: 'invalid_csv_utf8' });
});

test('parseImport rejects orphan surrogates', () => {
  assert.throws(() => parseImport({ csvText: 'abc\uD800def' }, true), { code: 'invalid_csv_utf8' });
});

test('parseImport rejects missing csvText', () => {
  assert.throws(() => parseImport({}, true));
});

test('parseImport preview mode only allows csvText key', () => {
  assert.throws(() => parseImport({ csvText: buildCsv([validRow()]), extraKey: true }, true), { code: 'unexpected_fields' });
});

test('parseImport non-preview allows decisions key', () => {
  // Will fail at CSV level but validates key check first
  const csv = buildCsv([validRow()]);
  // Non-preview expects expectedPreviewDigest and decisions but doesn't crash on onlyKeys
  assert.doesNotThrow(() => parseImport({ csvText: csv, expectedPreviewDigest: 'x'.repeat(64), decisions: [] }));
});

test('parseImport wraps CSV parse errors with code', () => {
  try {
    parseImport({ csvText: '' }, true);
    assert.fail('Should have thrown');
  } catch (e) {
    assert.equal(typeof e.code, 'string');
    assert.equal(e.status, 422);
  }
});

test('parseImport wraps header errors', () => {
  try {
    parseImport({ csvText: 'bad,header\nfoo,bar' }, true);
    assert.fail('Should have thrown');
  } catch (e) {
    assert.equal(typeof e.code, 'string');
  }
});

// ── rowKey ──────────────────────────────────────────────────────────────

test('rowKey returns 64-char hex string', () => {
  const original = Object.fromEntries(MYERAS_HEADER.map(k => [k, 'test']));
  const key = rowKey(original);
  assert.ok(/^[0-9a-f]{64}$/.test(key));
});

test('rowKey excludes exported_at from digest', () => {
  const a = Object.fromEntries(MYERAS_HEADER.map(k => [k, 'test']));
  const b = { ...a, exported_at: 'different' };
  assert.equal(rowKey(a), rowKey(b));
});

test('rowKey differs for different program names', () => {
  const a = Object.fromEntries(MYERAS_HEADER.map(k => [k, 'test']));
  const b = { ...a, program_name: 'other' };
  assert.notEqual(rowKey(a), rowKey(b));
});

test('rowKey is deterministic', () => {
  const original = Object.fromEntries(MYERAS_HEADER.map(k => [k, 'val']));
  assert.equal(rowKey(original), rowKey(original));
});

test('rowKey is key-order independent', () => {
  const a = { program_name: 'Mayo', specialty: 'IM', exported_at: '2025' };
  const b = { specialty: 'IM', program_name: 'Mayo', exported_at: '2025' };
  assert.equal(rowKey(a), rowKey(b));
});

// ── myerasCommands ────────────────────────────────────────────────────

test('myerasCommands is a Set', () => {
  assert.ok(myerasCommands instanceof Set);
});

test('myerasCommands contains myeras.preview', () => {
  assert.ok(myerasCommands.has('myeras.preview'));
});

test('myerasCommands contains myeras.import', () => {
  assert.ok(myerasCommands.has('myeras.import'));
});

test('myerasCommands has exactly 2 entries', () => {
  assert.equal(myerasCommands.size, 2);
});

// ── myerasEnabled ─────────────────────────────────────────────────────

// myerasEnabled requires targetsEnabled(config,actor) AND config.loi.myerasEnabled===true
function myerasConfig(overrides = {}) {
  return {
    loi: {
      enabled: true,
      targetsEnabled: true,
      myerasEnabled: true,
      mode: 'CANARY',
      ownerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      programId: 'p1p2p3p4-aaaa-4bbb-8ccc-ddddeeeeefff',
      targetsOwnerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      ...overrides,
    },
  };
}

function myerasActor(overrides = {}) {
  return {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    role: 'student',
    tier: '360',
    eligible: true,
    ...overrides,
  };
}

test('myerasEnabled returns true for valid config and actor', () => {
  assert.equal(myerasEnabled(myerasConfig(), myerasActor()), true);
});

test('myerasEnabled returns false when myerasEnabled config is false', () => {
  assert.equal(myerasEnabled(myerasConfig({ myerasEnabled: false }), myerasActor()), false);
});

test('myerasEnabled returns false when myerasEnabled config is missing', () => {
  const config = myerasConfig();
  delete config.loi.myerasEnabled;
  assert.equal(myerasEnabled(config, myerasActor()), false);
});

test('myerasEnabled returns false when targetsEnabled is false', () => {
  assert.equal(myerasEnabled(myerasConfig({ targetsEnabled: false }), myerasActor()), false);
});

test('myerasEnabled returns false when loi.enabled is false', () => {
  assert.equal(myerasEnabled(myerasConfig({ enabled: false }), myerasActor()), false);
});

test('myerasEnabled returns false for admin role', () => {
  assert.equal(myerasEnabled(myerasConfig(), myerasActor({ role: 'admin' })), false);
});

test('myerasEnabled returns false when not eligible', () => {
  assert.equal(myerasEnabled(myerasConfig(), myerasActor({ eligible: false })), false);
});

// ── requireMyeras ─────────────────────────────────────────────────────

test('requireMyeras does not throw for valid config and actor', () => {
  assert.doesNotThrow(() => requireMyeras(myerasConfig(), myerasActor()));
});

test('requireMyeras throws when myerasEnabled is false', () => {
  assert.throws(
    () => requireMyeras(myerasConfig({ myerasEnabled: false }), myerasActor()),
    { name: 'AppError', code: 'myeras_unavailable', status: 403 },
  );
});

test('requireMyeras throws when targets are disabled', () => {
  assert.throws(
    () => requireMyeras(myerasConfig({ targetsEnabled: false }), myerasActor()),
    { name: 'AppError', status: 403 },
  );
});

test('requireMyeras throws for ineligible actor', () => {
  assert.throws(
    () => requireMyeras(myerasConfig(), myerasActor({ eligible: false })),
    { name: 'AppError', status: 403 },
  );
});

test('requireMyeras message matches expected text', () => {
  try {
    requireMyeras(myerasConfig({ myerasEnabled: false }), myerasActor());
    assert.fail('should have thrown');
  } catch (e) {
    assert.equal(e.message, 'MyERAS import is unavailable for this workspace.');
  }
});
