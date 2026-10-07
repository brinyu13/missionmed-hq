import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deepResearchEnabled,
  requireDeepResearch,
  demandBinding,
  parseResearchFlatJSON,
} from '../../server/research-dispatch.mjs';

// ── helpers ─────────────────────────────────────────────────────────

function validConfig(overrides = {}) {
  return {
    deepResearch: {
      enabled: true,
      ownerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      programId: 'p1p2p3p4-aaaa-4bbb-8ccc-ddddeeeeefff',
      ...overrides,
    },
  };
}

function validActor(overrides = {}) {
  return {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    role: 'student',
    tier: '360',
    eligible: true,
    ...overrides,
  };
}

// ── deepResearchEnabled ─────────────────────────────────────────────

test('deepResearchEnabled returns true for valid config and actor', () => {
  assert.equal(deepResearchEnabled(validConfig(), validActor()), true);
});

test('deepResearchEnabled accepts ivprep_complete tier', () => {
  assert.equal(deepResearchEnabled(validConfig(), validActor({ tier: 'ivprep_complete' })), true);
});

test('deepResearchEnabled returns false when config.deepResearch.enabled is false', () => {
  assert.equal(deepResearchEnabled(validConfig({ enabled: false }), validActor()), false);
});

test('deepResearchEnabled returns false when config.deepResearch is missing', () => {
  assert.equal(deepResearchEnabled({}, validActor()), false);
});

test('deepResearchEnabled returns false when actor is not eligible', () => {
  assert.equal(deepResearchEnabled(validConfig(), validActor({ eligible: false })), false);
});

test('deepResearchEnabled returns false when actor role is not student', () => {
  assert.equal(deepResearchEnabled(validConfig(), validActor({ role: 'admin' })), false);
});

test('deepResearchEnabled returns false for mentor role', () => {
  assert.equal(deepResearchEnabled(validConfig(), validActor({ role: 'mentor' })), false);
});

test('deepResearchEnabled returns false when tier is not in allowed list', () => {
  assert.equal(deepResearchEnabled(validConfig(), validActor({ tier: 'basic' })), false);
});

test('deepResearchEnabled returns false when tier is admin', () => {
  assert.equal(deepResearchEnabled(validConfig(), validActor({ tier: 'admin' })), false);
});

test('deepResearchEnabled returns false when actor.id does not match ownerId', () => {
  assert.equal(deepResearchEnabled(validConfig(), validActor({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' })), false);
});

test('deepResearchEnabled returns false for null actor', () => {
  assert.equal(deepResearchEnabled(validConfig(), null), false);
});

test('deepResearchEnabled returns false for undefined actor', () => {
  assert.equal(deepResearchEnabled(validConfig(), undefined), false);
});

test('deepResearchEnabled returns false when enabled is truthy but not true', () => {
  assert.equal(deepResearchEnabled(validConfig({ enabled: 1 }), validActor()), false);
});

test('deepResearchEnabled returns false when eligible is truthy but not true', () => {
  assert.equal(deepResearchEnabled(validConfig(), validActor({ eligible: 1 })), false);
});

// ── requireDeepResearch ─────────────────────────────────────────────

test('requireDeepResearch does not throw for valid config, actor, no programId', () => {
  assert.doesNotThrow(() => requireDeepResearch(validConfig(), validActor()));
});

test('requireDeepResearch does not throw for valid config, actor, matching programId', () => {
  const config = validConfig();
  assert.doesNotThrow(() => requireDeepResearch(config, validActor(), config.deepResearch.programId));
});

test('requireDeepResearch does not throw when programId is undefined', () => {
  assert.doesNotThrow(() => requireDeepResearch(validConfig(), validActor(), undefined));
});

test('requireDeepResearch does not throw when programId is null (falsy)', () => {
  assert.doesNotThrow(() => requireDeepResearch(validConfig(), validActor(), null));
});

test('requireDeepResearch throws for disabled research', () => {
  assert.throws(
    () => requireDeepResearch(validConfig({ enabled: false }), validActor()),
    { name: 'AppError', code: 'research_unavailable', status: 403 },
  );
});

test('requireDeepResearch throws for wrong programId', () => {
  assert.throws(
    () => requireDeepResearch(validConfig(), validActor(), 'wrong-program-id'),
    { name: 'AppError', code: 'research_unavailable', status: 403 },
  );
});

test('requireDeepResearch throws for ineligible actor', () => {
  assert.throws(
    () => requireDeepResearch(validConfig(), validActor({ eligible: false })),
    { name: 'AppError', code: 'research_unavailable', status: 403 },
  );
});

test('requireDeepResearch message matches expected text', () => {
  try {
    requireDeepResearch(validConfig({ enabled: false }), validActor());
    assert.fail('should have thrown');
  } catch (e) {
    assert.equal(e.message, 'Research is not enabled for this workspace or program.');
  }
});

// ── demandBinding ───────────────────────────────────────────────────

test('demandBinding maps all six fields correctly', () => {
  const row = {
    external_request_id: 'req-001',
    id: 'demand-001',
    interview_id: 'iv-001',
    owner_id: 'own-001',
    program_id: 'prog-001',
    extra_field: 'ignored',
  };
  const release = 'release-42';
  const result = demandBinding(row, release);
  assert.deepEqual(result, {
    requestId: 'req-001',
    demandId: 'demand-001',
    interviewId: 'iv-001',
    ownerId: 'own-001',
    programId: 'prog-001',
    registryReleaseId: 'release-42',
  });
});

test('demandBinding returns exactly six keys', () => {
  const row = {
    external_request_id: 'r', id: 'd', interview_id: 'i',
    owner_id: 'o', program_id: 'p',
  };
  const result = demandBinding(row, 'rel');
  assert.equal(Object.keys(result).length, 6);
});

test('demandBinding handles null release', () => {
  const row = {
    external_request_id: 'r', id: 'd', interview_id: 'i',
    owner_id: 'o', program_id: 'p',
  };
  const result = demandBinding(row, null);
  assert.equal(result.registryReleaseId, null);
});

test('demandBinding handles undefined fields as undefined', () => {
  const row = {};
  const result = demandBinding(row, 'rel');
  assert.equal(result.requestId, undefined);
  assert.equal(result.demandId, undefined);
  assert.equal(result.interviewId, undefined);
  assert.equal(result.ownerId, undefined);
  assert.equal(result.programId, undefined);
  assert.equal(result.registryReleaseId, 'rel');
});

// ── parseResearchFlatJSON ───────────────────────────────────────────

const FLAT_KEYS = ['alpha', 'beta'];

test('parseResearchFlatJSON parses valid flat JSON with matching keys', () => {
  const raw = '{"alpha":"one","beta":"two"}';
  const result = parseResearchFlatJSON(raw, FLAT_KEYS);
  assert.deepEqual(result, { alpha: 'one', beta: 'two' });
});

test('parseResearchFlatJSON accepts numeric values', () => {
  const raw = '{"alpha":42,"beta":-3.14}';
  const result = parseResearchFlatJSON(raw, FLAT_KEYS);
  assert.equal(result.alpha, 42);
  assert.equal(result.beta, -3.14);
});

test('parseResearchFlatJSON accepts boolean values', () => {
  const raw = '{"alpha":true,"beta":false}';
  const result = parseResearchFlatJSON(raw, FLAT_KEYS);
  assert.equal(result.alpha, true);
  assert.equal(result.beta, false);
});

test('parseResearchFlatJSON accepts null values', () => {
  const raw = '{"alpha":null,"beta":"ok"}';
  const result = parseResearchFlatJSON(raw, FLAT_KEYS);
  assert.equal(result.alpha, null);
  assert.equal(result.beta, 'ok');
});

test('parseResearchFlatJSON accepts leading/trailing whitespace', () => {
  const raw = '  { "alpha" : "a" , "beta" : "b" }  ';
  const result = parseResearchFlatJSON(raw, FLAT_KEYS);
  assert.deepEqual(result, { alpha: 'a', beta: 'b' });
});

test('parseResearchFlatJSON accepts escaped strings', () => {
  const raw = '{"alpha":"line\\none","beta":"tab\\there"}';
  const result = parseResearchFlatJSON(raw, FLAT_KEYS);
  assert.equal(result.alpha, 'line\none');
  assert.equal(result.beta, 'tab\there');
});

test('parseResearchFlatJSON accepts scientific notation', () => {
  const raw = '{"alpha":1e2,"beta":3.5E-1}';
  const result = parseResearchFlatJSON(raw, FLAT_KEYS);
  assert.equal(result.alpha, 100);
  assert.equal(result.beta, 0.35);
});

test('parseResearchFlatJSON rejects non-string input', () => {
  assert.throws(() => parseResearchFlatJSON(123, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects null input', () => {
  assert.throws(() => parseResearchFlatJSON(null, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects undefined input', () => {
  assert.throws(() => parseResearchFlatJSON(undefined, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects input exceeding 16384 bytes', () => {
  const raw = '{"alpha":"' + 'x'.repeat(16380) + '","beta":"y"}';
  assert.throws(() => parseResearchFlatJSON(raw, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON accepts input at exactly 16384 bytes', () => {
  // Build a string that is exactly 16384 bytes
  const prefix = '{"alpha":"';
  const middle = '","beta":"b"}';
  const padLen = 16384 - Buffer.byteLength(prefix + middle);
  const raw = prefix + 'a'.repeat(padLen) + middle;
  assert.equal(Buffer.byteLength(raw), 16384);
  const result = parseResearchFlatJSON(raw, FLAT_KEYS);
  assert.equal(result.beta, 'b');
});

test('parseResearchFlatJSON rejects __proto__ key', () => {
  const raw = '{"__proto__":"bad","beta":"ok"}';
  assert.throws(() => parseResearchFlatJSON(raw, ['__proto__', 'beta']), { status: 503 });
});

test('parseResearchFlatJSON rejects constructor key', () => {
  const raw = '{"constructor":"bad","beta":"ok"}';
  assert.throws(() => parseResearchFlatJSON(raw, ['constructor', 'beta']), { status: 503 });
});

test('parseResearchFlatJSON rejects prototype key', () => {
  const raw = '{"prototype":"bad","beta":"ok"}';
  assert.throws(() => parseResearchFlatJSON(raw, ['prototype', 'beta']), { status: 503 });
});

test('parseResearchFlatJSON rejects duplicate keys', () => {
  const raw = '{"alpha":"one","alpha":"two"}';
  assert.throws(() => parseResearchFlatJSON(raw, ['alpha']), { status: 503 });
});

test('parseResearchFlatJSON rejects when keys do not match expected set', () => {
  const raw = '{"alpha":"one","gamma":"three"}';
  assert.throws(() => parseResearchFlatJSON(raw, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects extra keys', () => {
  const raw = '{"alpha":"one","beta":"two","gamma":"three"}';
  assert.throws(() => parseResearchFlatJSON(raw, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects missing keys', () => {
  const raw = '{"alpha":"one"}';
  assert.throws(() => parseResearchFlatJSON(raw, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects empty object when keys expected', () => {
  const raw = '{}';
  assert.throws(() => parseResearchFlatJSON(raw, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects array input', () => {
  const raw = '["alpha","beta"]';
  assert.throws(() => parseResearchFlatJSON(raw, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects nested objects', () => {
  const raw = '{"alpha":{"nested":true},"beta":"ok"}';
  assert.throws(() => parseResearchFlatJSON(raw, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects nested arrays', () => {
  const raw = '{"alpha":[1,2],"beta":"ok"}';
  assert.throws(() => parseResearchFlatJSON(raw, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects trailing content after closing brace', () => {
  const raw = '{"alpha":"one","beta":"two"}extra';
  assert.throws(() => parseResearchFlatJSON(raw, FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects empty string', () => {
  assert.throws(() => parseResearchFlatJSON('', FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON rejects whitespace-only string', () => {
  assert.throws(() => parseResearchFlatJSON('   ', FLAT_KEYS), { status: 503 });
});

test('parseResearchFlatJSON throws AppError with code research_unavailable', () => {
  try {
    parseResearchFlatJSON(null, FLAT_KEYS);
    assert.fail('should have thrown');
  } catch (e) {
    assert.equal(e.code, 'research_unavailable');
    assert.equal(e.status, 503);
  }
});

test('parseResearchFlatJSON works with unicode escape in key', () => {
  const raw = '{"\\u0061lpha":"one","beta":"two"}';
  const result = parseResearchFlatJSON(raw, FLAT_KEYS);
  assert.equal(result.alpha, 'one');
});

test('parseResearchFlatJSON single key matches', () => {
  const raw = '{"only":"value"}';
  const result = parseResearchFlatJSON(raw, ['only']);
  assert.deepEqual(result, { only: 'value' });
});

test('parseResearchFlatJSON works with many keys', () => {
  const keys = ['a', 'b', 'c', 'd', 'e', 'f'];
  const raw = '{"a":1,"b":2,"c":3,"d":4,"e":5,"f":6}';
  const result = parseResearchFlatJSON(raw, keys);
  assert.equal(Object.keys(result).length, 6);
  assert.equal(result.f, 6);
});
