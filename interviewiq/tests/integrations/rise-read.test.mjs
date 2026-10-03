import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRiseReadAdapter, minimizeRiseProfile } from '../../server/integrations/rise-read.mjs';

const now = 1791000000000;
const actor = Object.freeze({ id: '11111111-1111-4111-8111-111111111111', wpUserId: 42, role: 'student', eligible: true });
const cookie = 'mmhq_session=synthetic-owner-cookie-test-only';
const registryReleaseId = 'rise_registry_2026-10-02_abcd1234abcd';
const program = () => ({ id: 'program-im', programSpecialtyId: 'ps-im', display: {
  programName: 'Synthetic Internal Medicine', city: 'Synthetic City', state: 'NY', institution: 'Synthetic University',
}, designation: 'Internal Medicine', identifiers: [{ namespace: 'ACGME_PROGRAM', value: '1400000001' }],
  programType: 'University-based', fullStudentRecord: 'private-canary-never-output' });
const fact = patch => ({ field: 'research.curriculum', publicationState: 'STUDENT_VISIBLE',
  canonicalValue: { summary: 'Continuity clinic spans the three years.', privateNotes: 'private-canary-never-output' },
  retrievedAt: '2026-10-01', sourceUrl: 'https://example.edu/curriculum', ...patch });
const profile = facts => ({ registryReleaseId, program: program(), research: {
  currentFacts: facts || [fact()], pendingEvidence: { fields: [] }, hidden: 'private-canary-never-output',
} });
const response = (value, options = {}) => new Response(JSON.stringify(value), { status: 200,
  headers: { 'content-type': 'application/json' }, ...options });
function harness({ result = profile(), sessionPatch = {}, enabled = true, resolverError = null, fetchError = null } = {}) {
  const calls = []; let resolves = 0;
  const adapter = createRiseReadAdapter({ enabled, now: () => now,
    resolveOwnerSession: async received => {
      assert.equal(received, actor); resolves++;
      if (resolverError) throw resolverError;
      return { authenticated: true, subject: 'wp:42', audience: 'rise', cookie,
        validatedAt: now, expiresAt: now + 30000, ...sessionPatch };
    },
    fetchImpl: async (url, options) => { calls.push({ url: String(url), options });
      if (fetchError) throw fetchError;
      return result instanceof Response ? result : response(result);
    },
  });
  return { adapter, calls, count: () => resolves };
}
const code = expected => error => error.code === expected;

test('default-off and missing current owner transport cause no network operation', async () => {
  let calls = 0;
  const adapter = createRiseReadAdapter({ fetchImpl: async () => { calls++; } });
  assert.equal(adapter.available, false);
  await assert.rejects(adapter.searchPrograms(actor, 'internal medicine'), code('rise_owner_transport_pending'));
  assert.equal(calls, 0);
  assert.equal(createRiseReadAdapter({ enabled: true }).available, false);
});
test('only the observed isolated RISE origin is accepted', () => {
  for (const origin of ['https://attacker.invalid', 'http://missionmed-rise-production.up.railway.app',
    'https://missionmed-rise-production.up.railway.app/path', 'https://secret@missionmed-rise-production.up.railway.app',
    'https://missionmed-hq-production.up.railway.app']) {
    assert.throws(() => createRiseReadAdapter({ origin }), code('rise_adapter_configuration_invalid'));
  }
});
test('actual generic search path has only a subject-authorized cookie and no IVOC identity', async () => {
  const h = harness({ result: { registryReleaseId, page: 1, pageSize: 12, total: 1, records: [program()] } });
  const result = await h.adapter.searchPrograms(actor, 'internal medicine');
  assert.equal(result.programs[0].id, 'ps-im');
  assert.equal(result.programs[0].registryProgramId, 'program-im');
  assert.equal(result.programs[0].zone, null);
  assert.equal(result.programs[0].track, '');
  assert.equal(result.programs[0].acgmeId, '1400000001');
  assert.equal(h.calls[0].url, 'https://missionmed-rise-production.up.railway.app/api/rise/v1/programs?q=internal+medicine&page=1&pageSize=12');
  assert.deepEqual(h.calls[0].options.headers, { Accept: 'application/json', Cookie: cookie });
  assert.equal(h.calls[0].options.method, 'GET');
  assert.equal(h.calls[0].options.redirect, 'error');
  assert.doesNotMatch(JSON.stringify(result), /private-canary|synthetic-owner-cookie|ivoc/);
});
test('every owner call resolves fresh access and uses actual profile path', async () => {
  const h = harness();
  await h.adapter.getProgram(actor, 'ps-im');
  await h.adapter.getProgram(actor, 'ps-im');
  assert.equal(h.count(), 2);
  assert.equal(h.calls[0].url, 'https://missionmed-rise-production.up.railway.app/api/rise/v1/program-specialties/ps-im');
});
test('wrong subject, audience, expired or stale owner session fails before fetch', async () => {
  for (const sessionPatch of [{ subject: 'wp:43' }, { audience: 'ivoc' }, { authenticated: false },
    { expiresAt: now }, { validatedAt: now - 5001 }, { validatedAt: now + 2001 },
    { cookie: cookie + '; another=secret' }, { cookie: 'Bearer synthetic-token' }]) {
    const h = harness({ sessionPatch });
    await assert.rejects(h.adapter.getProgram(actor, 'ps-im'), code('rise_access_denied'));
    assert.equal(h.calls.length, 0);
  }
});
test('mentor and unsigned actor input cannot gain general owner research access', async () => {
  const h = harness();
  for (const bad of [{ ...actor, role: 'mentor' }, { ...actor, eligible: false }, { ...actor, wpUserId: '42' },
    { ...actor, id: 'wp:42' }]) {
    await assert.rejects(h.adapter.getProgram(bad, 'ps-im'), code('rise_access_denied'));
  }
  assert.equal(h.calls.length, 0);
});
test('credentials in a resolver exception never enter the adapter error', async () => {
  const h = harness({ resolverError: new Error(cookie) });
  await assert.rejects(h.adapter.getProgram(actor, 'ps-im'), error => error.code === 'rise_owner_transport_pending' && !error.message.includes(cookie));
});
test('query and canonical identifier validation happens before owner calls', async () => {
  const h = harness();
  for (const q of ['a'.repeat(257), 'name\nsecret', {}]) await assert.rejects(h.adapter.searchPrograms(actor, q), code('rise_search_invalid'));
  for (const id of ['../other', 'ps-im?user=43', 'a'.repeat(181), '']) await assert.rejects(h.adapter.getProgram(actor, id), code('rise_program_invalid'));
  assert.equal(h.calls.length, 0);
});
test('malformed pagination, identity, duplicates and nonregistry releases are denied', async () => {
  for (const result of [
    { registryReleaseId, page: 2, pageSize: 12, total: 1, records: [program()] },
    { registryReleaseId, page: 1, pageSize: 12, total: 2, records: [program(), program()] },
    { registryReleaseId: 'invented', page: 1, pageSize: 12, total: 1, records: [program()] },
    { registryReleaseId, page: 1, pageSize: 12, total: 1, records: [{ ...program(), programSpecialtyId: '../escape' }] },
  ]) await assert.rejects(harness({ result }).adapter.searchPrograms(actor, ''), code('rise_response_invalid'));
});
test('selected program specialty must match the owner profile exactly', async () => {
  await assert.rejects(harness().adapter.getProgram(actor, 'other-id'), code('rise_response_invalid'));
});
test('published fact output keeps source/as-of without claiming a verbatim quote', () => {
  const result = minimizeRiseProfile(profile(), 'ps-im');
  assert.equal(result.facts.length, 1);
  assert.equal(result.facts[0].textKind, 'owner_canonical_summary_not_verbatim_quote');
  assert.equal(result.facts[0].sources[0].url, 'https://example.edu/curriculum');
  assert.equal(result.facts[0].sources[0].retrievedAt, '2026-10-01T00:00:00.000Z');
  assert.equal(result.unknowns.length, 6);
  assert.doesNotMatch(JSON.stringify(result), /private-canary/);
  assert.deepEqual(result, minimizeRiseProfile(profile(), 'ps-im'));
});
test('review-gated, unknown, raw people and invalid source facts cannot become supported', () => {
  const raw = profile([fact({ publicationState: 'REVIEW_REQUIRED' }), fact({ knowledge: { state: 'unknown' } }),
    fact({ field: 'research.leadership', canonicalValue: [{ name: 'Private Person', role: 'PD' }] }),
    fact({ sourceUrl: 'http://internal.local/private' }), fact({ retrievedAt: 'not a date' }),
    fact({ canonicalValue: { summary: 'Private Person, MD directs the program.' } })]);
  const result = minimizeRiseProfile(raw, 'ps-im');
  assert.equal(result.facts.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /Private Person|internal\.local/);
});
test('disagreeing current owner summaries remain an explicit conflict', () => {
  const result = minimizeRiseProfile(profile([fact(), fact({ canonicalValue: 'Only one year includes clinic.' })]), 'ps-im');
  assert.equal(result.facts.length, 0);
  assert.equal(result.unknowns.find(item => item.field === 'research.curriculum').state, 'conflict');
});
test('pending owner fields expose state but never unpublished claim content', () => {
  const raw = profile([]); raw.research.pendingEvidence.fields = [{ field: 'research.curriculum', privateText: 'hidden review' }];
  const result = minimizeRiseProfile(raw, 'ps-im');
  assert.equal(result.unknowns[0].reason, 'owner_review_pending');
  assert.doesNotMatch(JSON.stringify(result), /hidden review/);
});
test('evidence service consumes the existing generic read endpoint only', async () => {
  const h = harness(); const result = await h.adapter.getProgramEvidence(actor, 'ps-im');
  assert.equal(result.owner, 'rise'); assert.equal(result.facts.length, 1);
  assert.equal(h.calls.length, 1); assert.doesNotMatch(h.calls[0].url, /ivoc/);
});
test('read-only research state neither reserves a paid job nor exposes provider payload', async () => {
  const h = harness({ result: { eligibility: { allowed: false, privateControls: 'hidden' }, records: [
    { id: 'job-1', programSpecialtyId: 'ps-im', status: 'QUEUED', updatedAt: '2026-10-01', providerPayload: 'hidden' },
    { id: 'job-2', programSpecialtyId: 'ps-other', status: 'COMPLETED' },
  ] } });
  const result = await h.adapter.readResearchState(actor, 'ps-im');
  assert.deepEqual(result.jobs.map(item => item.id), ['job-1']);
  assert.equal(h.calls[0].options.method, 'GET');
  assert.match(h.calls[0].url, /\/program-specialties\/ps-im\/research$/);
  assert.doesNotMatch(JSON.stringify(result), /hidden|job-2/);
  assert.equal('requestResearch' in h.adapter, false);
  assert.equal('publish' in h.adapter, false);
});
test('denial, owner outage and network errors stay explicit with no stale fallback', async () => {
  for (const status of [401, 403, 429, 500]) {
    const h = harness({ result: response({ secret: cookie }, { status }) });
    await assert.rejects(h.adapter.getProgram(actor, 'ps-im'), error =>
      ['rise_access_denied', 'rise_owner_unavailable'].includes(error.code) && !error.message.includes(cookie));
  }
  await assert.rejects(harness({ fetchError: new Error(cookie) }).adapter.getProgram(actor, 'ps-im'), code('rise_owner_unavailable'));
});
test('HTML, declared oversized, streamed oversized and malformed JSON responses fail closed', async () => {
  const invalid = [new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
    response(profile(), { headers: { 'content-type': 'application/json', 'content-length': '524289' } }),
    new Response('x'.repeat(524289), { headers: { 'content-type': 'application/json' } }),
    new Response('{broken', { headers: { 'content-type': 'application/json' } })];
  for (const result of invalid) await assert.rejects(harness({ result }).adapter.getProgram(actor, 'ps-im'), code('rise_response_invalid'));
});
