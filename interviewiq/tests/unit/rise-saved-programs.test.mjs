import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSavedPrograms} from '../../server/rise-owner.mjs';
import {validProgramId} from '../../server/owner-wire.mjs';

// ── RISE Saved Programs fixture readiness (Backlog item 2) ───────────────────
// Validates that projectSavedPrograms accepts well-formed multi-program,
// multi-specialty fixture data matching the rise-interviewiq-saved-programs-v1
// schema, including CANONICAL vs UNRESOLVED identity states, pagination,
// and edge cases.

const RELEASE = 'rv-2026-10-06-001';
const NOW = Date.now();
const past = (minutes) => new Date(NOW - minutes * 60_000).toISOString();

// ── Fixture helpers ────────────────────────────────────────────────────────────

function canonicalRecord(programRef, name, specialty, acgmeId, state, priority, updatedAt) {
  return {
    source: 'RISE_SAVED',
    programRef,
    identityState: 'CANONICAL',
    program: {
      id: programRef,
      name,
      track: 'Categorical',
      registryReleaseId: RELEASE,
      specialty,
      acgmeId,
    },
    state,
    priority,
    updatedAt,
    evidenceState: 'UNKNOWN',
  };
}

function unresolvedRecord(programRef, state, priority, updatedAt) {
  return {
    source: 'RISE_SAVED',
    programRef,
    identityState: 'UNRESOLVED',
    program: null,
    state,
    priority,
    updatedAt,
    evidenceState: 'UNKNOWN',
  };
}

function envelope(records, {page = 1, pageSize = 100, total = null, accessibleTotal = null, hasMore = null} = {}) {
  const t = total ?? records.length;
  const at = accessibleTotal ?? Math.min(t, 2000);
  const hm = hasMore ?? ((page - 1) * pageSize + records.length < at);
  return {
    schema: 'rise-interviewiq-saved-programs-v1',
    source: 'RISE_SAVED',
    registryReleaseId: RELEASE,
    page,
    pageSize,
    total: t,
    accessibleTotal: at,
    truncated: t > 2000,
    hasMore: hm,
    records,
  };
}

// ── Core fixture: 6 programs across 3 specialties ─────────────────────────────

const FIXTURE_RECORDS = [
  canonicalRecord('prog-im-001', 'Metro General IM Residency', 'Internal Medicine', '1200100001', 'SAVED', 1, past(60)),
  canonicalRecord('prog-im-002', 'Valley Health IM Residency', 'Internal Medicine', '1200100002', 'APPLIED', 2, past(45)),
  canonicalRecord('prog-fm-001', 'Lakeside Family Medicine', 'Family Medicine', '1200200001', 'INTERVIEWING', 3, past(30)),
  canonicalRecord('prog-peds-001', 'Children\'s Hospital Pediatrics', 'Pediatrics', '1200300001', 'RANKED', 4, past(20)),
  unresolvedRecord('prog-unknown-001', 'SAVED', null, past(15)),
  canonicalRecord('prog-fm-002', 'Mountainview FM Program', 'Family Medicine', '1200200002', 'APPLIED', 5, past(10)),
];

// ── projectSavedPrograms validation ────────────────────────────────────────────

test('projectSavedPrograms accepts full multi-specialty fixture', () => {
  const input = envelope(FIXTURE_RECORDS);
  const result = projectSavedPrograms(input, {}, NOW);

  assert.equal(result.schema, 'rise-interviewiq-saved-programs-v1');
  assert.equal(result.source, 'RISE_SAVED');
  assert.equal(result.registryReleaseId, RELEASE);
  assert.equal(result.records.length, 6);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 100);
  assert.equal(result.total, 6);
  assert.equal(result.hasMore, false);
});

test('canonical records preserve identity fields', () => {
  const input = envelope(FIXTURE_RECORDS);
  const result = projectSavedPrograms(input, {}, NOW);

  const im1 = result.records[0];
  assert.equal(im1.identityState, 'CANONICAL');
  assert.equal(im1.program.id, 'prog-im-001');
  assert.equal(im1.program.name, 'Metro General IM Residency');
  assert.equal(im1.program.specialty, 'Internal Medicine');
  assert.equal(im1.program.acgmeId, '1200100001');
  assert.equal(im1.program.track, 'Categorical');
  assert.equal(im1.program.registryReleaseId, RELEASE);
  assert.equal(im1.state, 'SAVED');
  assert.equal(im1.priority, 1);
});

test('unresolved records have null program', () => {
  const input = envelope(FIXTURE_RECORDS);
  const result = projectSavedPrograms(input, {}, NOW);

  const unresolved = result.records[4];
  assert.equal(unresolved.identityState, 'UNRESOLVED');
  assert.equal(unresolved.program, null);
  assert.equal(unresolved.programRef, 'prog-unknown-001');
  assert.equal(unresolved.priority, null);
});

test('all four states accepted: SAVED, APPLIED, INTERVIEWING, RANKED', () => {
  const input = envelope(FIXTURE_RECORDS);
  const result = projectSavedPrograms(input, {}, NOW);

  const states = result.records.map(r => r.state);
  assert.ok(states.includes('SAVED'));
  assert.ok(states.includes('APPLIED'));
  assert.ok(states.includes('INTERVIEWING'));
  assert.ok(states.includes('RANKED'));
});

test('multiple specialties coexist in a single result set', () => {
  const input = envelope(FIXTURE_RECORDS);
  const result = projectSavedPrograms(input, {}, NOW);

  const specialties = new Set(
    result.records
      .filter(r => r.identityState === 'CANONICAL')
      .map(r => r.program.specialty)
  );
  assert.ok(specialties.has('Internal Medicine'));
  assert.ok(specialties.has('Family Medicine'));
  assert.ok(specialties.has('Pediatrics'));
  assert.equal(specialties.size, 3);
});

// ── Pagination ─────────────────────────────────────────────────────────────────

test('pagination: page 1 with hasMore=true', () => {
  const page1Records = FIXTURE_RECORDS.slice(0, 3);
  const input = envelope(page1Records, {page: 1, pageSize: 3, total: 6, hasMore: true});
  const result = projectSavedPrograms(input, {page: 1, pageSize: 3}, NOW);

  assert.equal(result.records.length, 3);
  assert.equal(result.hasMore, true);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 3);
  assert.equal(result.total, 6);
});

test('pagination: page 2 with hasMore=false', () => {
  const page2Records = FIXTURE_RECORDS.slice(3);
  const input = envelope(page2Records, {page: 2, pageSize: 3, total: 6, hasMore: false});
  const result = projectSavedPrograms(input, {page: 2, pageSize: 3}, NOW);

  assert.equal(result.records.length, 3);
  assert.equal(result.hasMore, false);
  assert.equal(result.page, 2);
});

test('empty result set when total is 0', () => {
  const input = envelope([], {total: 0, hasMore: false});
  const result = projectSavedPrograms(input, {}, NOW);

  assert.equal(result.records.length, 0);
  assert.equal(result.total, 0);
  assert.equal(result.hasMore, false);
  assert.equal(result.truncated, false);
});

// ── Truncation ─────────────────────────────────────────────────────────────────

test('truncated=true when total exceeds 2000', () => {
  // Build 5 records for page=1, pageSize=5, total=2500, accessibleTotal=2000
  // Expected records on page 1 = min(5, 2000 - 0) = 5
  const truncRecords = [];
  for (let i = 0; i < 5; i++) {
    truncRecords.push(canonicalRecord(`prog-trunc-${String(i).padStart(3,'0')}`, `Truncation Test ${i}`, 'Internal Medicine', `12001000${String(i).padStart(2,'0')}`, 'SAVED', i + 1, past(5 + i)));
  }
  const input = envelope(truncRecords, {total: 2500, accessibleTotal: 2000, hasMore: true, pageSize: 5});
  const result = projectSavedPrograms(input, {page: 1, pageSize: 5}, NOW);

  assert.equal(result.truncated, true);
  assert.equal(result.total, 2500);
  assert.equal(result.accessibleTotal, 2000);
});

// ── Rejection cases ────────────────────────────────────────────────────────────

test('rejects wrong schema', () => {
  const input = envelope(FIXTURE_RECORDS);
  input.schema = 'wrong-schema-v1';
  assert.throws(() => projectSavedPrograms(input, {}, NOW), {code: 'invalid_owner_response'});
});

test('rejects wrong source', () => {
  const input = envelope(FIXTURE_RECORDS);
  input.source = 'MANUAL';
  assert.throws(() => projectSavedPrograms(input, {}, NOW), {code: 'invalid_owner_response'});
});

test('rejects duplicate programRef in records', () => {
  const dup = [
    canonicalRecord('prog-dup-001', 'Program A', 'Internal Medicine', '1200100001', 'SAVED', 1, past(10)),
    canonicalRecord('prog-dup-001', 'Program B', 'Internal Medicine', '1200100002', 'APPLIED', 2, past(5)),
  ];
  const input = envelope(dup);
  assert.throws(() => projectSavedPrograms(input, {}, NOW), {code: 'invalid_owner_response'});
});

test('rejects future updatedAt timestamp', () => {
  const future = new Date(NOW + 86_400_000).toISOString();
  const records = [canonicalRecord('prog-future-001', 'Future Program', 'IM', '1200100001', 'SAVED', 1, future)];
  const input = envelope(records);
  assert.throws(() => projectSavedPrograms(input, {}, NOW), {code: 'invalid_owner_response'});
});

test('rejects invalid state', () => {
  const records = [canonicalRecord('prog-bad-001', 'Bad State', 'IM', '1200100001', 'WITHDRAWN', 1, past(5))];
  const input = envelope(records);
  assert.throws(() => projectSavedPrograms(input, {}, NOW), {code: 'invalid_owner_response'});
});

test('rejects mismatched registryReleaseId in canonical program', () => {
  const records = [canonicalRecord('prog-mismatch-001', 'Mismatch', 'IM', '1200100001', 'SAVED', 1, past(5))];
  records[0].program.registryReleaseId = 'different-release';
  const input = envelope(records);
  assert.throws(() => projectSavedPrograms(input, {}, NOW), {code: 'invalid_owner_response'});
});

test('rejects CANONICAL record with null program', () => {
  const records = [{
    source: 'RISE_SAVED',
    programRef: 'prog-null-001',
    identityState: 'CANONICAL',
    program: null,
    state: 'SAVED',
    priority: 1,
    updatedAt: past(5),
    evidenceState: 'UNKNOWN',
  }];
  const input = envelope(records);
  assert.throws(() => projectSavedPrograms(input, {}, NOW), {code: 'invalid_owner_response'});
});

test('rejects UNRESOLVED record with non-null program', () => {
  const records = [{
    source: 'RISE_SAVED',
    programRef: 'prog-unres-001',
    identityState: 'UNRESOLVED',
    program: {id: 'prog-unres-001', name: 'Fake', track: 'Categorical', registryReleaseId: RELEASE, specialty: null, acgmeId: null},
    state: 'SAVED',
    priority: null,
    updatedAt: past(5),
    evidenceState: 'UNKNOWN',
  }];
  const input = envelope(records);
  assert.throws(() => projectSavedPrograms(input, {}, NOW), {code: 'invalid_owner_response'});
});

test('rejects record count mismatch with expected page math', () => {
  // 2 records but claims total=5 with page 1, pageSize 100 → expects 5 records
  const records = FIXTURE_RECORDS.slice(0, 2);
  const input = envelope(records, {total: 5, hasMore: false});
  assert.throws(() => projectSavedPrograms(input, {}, NOW), {code: 'invalid_owner_response'});
});

test('rejects missing required envelope fields', () => {
  const input = envelope(FIXTURE_RECORDS);
  delete input.accessibleTotal;
  assert.throws(() => projectSavedPrograms(input, {}, NOW));
});

// ── validProgramId ─────────────────────────────────────────────────────────────

test('validProgramId accepts alphanumeric with separators', () => {
  assert.ok(validProgramId('prog-im-001'));
  assert.ok(validProgramId('ACGME.1200100001'));
  assert.ok(validProgramId('program:test_v2'));
  assert.ok(validProgramId('A'));
});

test('validProgramId rejects invalid values', () => {
  assert.equal(validProgramId(''), false);
  assert.equal(validProgramId('.'), false);
  assert.equal(validProgramId('..'), false);
  assert.equal(validProgramId('-start'), false);
  assert.equal(validProgramId('.start'), false);
  assert.equal(validProgramId(null), false);
  assert.equal(validProgramId(42), false);
  assert.equal(validProgramId('a'.repeat(181)), false);
});

// ── savedPrograms adapter (loi-targets.mjs) ────────────────────────────────────

test('savedPrograms adapter validates pagination and delegates to owners.rise', async () => {
  const {savedPrograms} = await import('../../server/loi-targets.mjs');

  // Build a minimal stub actor + config that passes requireTargets
  const actor = {id: 'test-id', wpUserId: 'wp-1', role: 'student', tier: '360', eligible: true};
  const config = {
    loi: {enabled: true, mode: 'CANARY', targetsEnabled: true, ownerId: 'test-id', targetsOwnerId: 'test-id', programId: 'prog-im-001'},
  };

  // Stub owners.rise.savedPrograms to return fixture data through projectSavedPrograms
  let capturedQuery;
  const owners = {
    rise: {
      savedPrograms: async (_actor, query) => {
        capturedQuery = query;
        // Build fixture matching the exact query params so validation passes
        const fixtureResponse = envelope([
          canonicalRecord('prog-im-001', 'Metro General IM Residency', 'Internal Medicine', '1200100001', 'SAVED', 1, past(60)),
        ], {total: 1, hasMore: false, page: query.page, pageSize: query.pageSize});
        return projectSavedPrograms(fixtureResponse, query, NOW);
      },
    },
  };

  const result = await savedPrograms({actor, owners, config, data: {page: 1, pageSize: 50}});
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].program.name, 'Metro General IM Residency');
  assert.deepEqual(capturedQuery, {page: 1, pageSize: 50});
});

test('savedPrograms adapter rejects page beyond bound', async () => {
  const {savedPrograms} = await import('../../server/loi-targets.mjs');
  const actor = {id: 'test-id', wpUserId: 'wp-1', role: 'student', tier: '360', eligible: true};
  const config = {
    loi: {enabled: true, mode: 'CANARY', targetsEnabled: true, ownerId: 'test-id', targetsOwnerId: 'test-id', programId: 'p'},
  };
  const owners = {rise: {savedPrograms: async () => ({})}};

  await assert.rejects(
    () => savedPrograms({actor, owners, config, data: {page: 21, pageSize: 100}}),
    {code: 'invalid_pagination'},
  );
});

test('savedPrograms adapter rejects when owners.rise is missing', async () => {
  const {savedPrograms} = await import('../../server/loi-targets.mjs');
  const actor = {id: 'test-id', wpUserId: 'wp-1', role: 'student', tier: '360', eligible: true};
  const config = {
    loi: {enabled: true, mode: 'CANARY', targetsEnabled: true, ownerId: 'test-id', targetsOwnerId: 'test-id', programId: 'p'},
  };

  await assert.rejects(
    () => savedPrograms({actor, owners: {}, config}),
    {code: 'owner_service_unavailable'},
  );
});

// ── Fixture-level integration: writeTarget RISE_SAVED source contract ──────────

test('projectSavedPrograms output records have correct shape for writeTarget lookup', () => {
  const input = envelope(FIXTURE_RECORDS);
  const result = projectSavedPrograms(input, {}, NOW);

  // writeTarget iterates savedPrograms looking for a matching programRef
  for (const record of result.records) {
    assert.equal(record.source, 'RISE_SAVED');
    assert.equal(typeof record.programRef, 'string');
    assert.ok(validProgramId(record.programRef));
    assert.ok(['CANONICAL', 'UNRESOLVED'].includes(record.identityState));
    if (record.identityState === 'CANONICAL') {
      assert.equal(record.program.id, record.programRef);
      assert.equal(typeof record.program.name, 'string');
      assert.equal(typeof record.program.registryReleaseId, 'string');
    } else {
      assert.equal(record.program, null);
    }
  }
});

test('acgmeId format is exactly 10 digits', () => {
  const input = envelope(FIXTURE_RECORDS);
  const result = projectSavedPrograms(input, {}, NOW);

  for (const record of result.records) {
    if (record.identityState === 'CANONICAL' && record.program.acgmeId !== null) {
      assert.match(record.program.acgmeId, /^\d{10}$/);
    }
  }
});
