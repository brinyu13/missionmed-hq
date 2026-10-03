import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';
import { createIvocOwnerAdapter } from '../../server/integrations/ivoc.mjs';

const key = 'synthetic-ivoc-owner-request-secret'.repeat(2);
const now = 1791000000000;
const actor = { id: randomUUID(), role: 'student' };
const proof = { subject: actor.id, wp_user_id: 42, session_verifier: 'a'.repeat(64), auth_role: 'student', auth_tier: '360' };
const launchId = randomUUID(); const sessionId = randomUUID(); const interviewId = randomUUID();
const input = { requestId: randomUUID(), interviewId, programSpecialtyId: 'rise-program-1', registryReleaseId: 'rise_registry_current',
  questionId: 'CORE-01', questionContext: '', confirmedGoal: { id: randomUUID(), version: 1, text: 'Name my own action.' }, returnPath: `/interviewiq/#interview/${interviewId}` };
const digest = value => createHash('sha256').update(value).digest('hex');
const config = { enabled: true, origin: 'https://hq.example.test', wpOrigin: 'https://wp.example.test', requestSecret: key,
  resolveActor: async candidate => { assert.equal(candidate, actor); return proof; }, now: () => now };
function response(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }); }
const created = () => ({ launchId, status: 'created', ticket: 't'.repeat(43), expiresAt: new Date(now + 120000).toISOString(),
  launchUrl: `https://hq.example.test/iv-prep-on-call/#iiq/${launchId}/${'t'.repeat(43)}` });
const result = () => ({ schema: 'interviewiq.ivoc.result.v1', launchId, interviewId, programSpecialtyId: input.programSpecialtyId,
  registryReleaseId: input.registryReleaseId, questionId: input.questionId, confirmedGoal: input.confirmedGoal, sessionId,
  status: 'partial', sessionStatus: 'saved', summary: null, observations: [], nextChange: null, sourceVersion: null,
  requiresStudentConfirmation: true, returnUrl: `https://wp.example.test/interviewiq/#interview/${interviewId}` });
test('default-off integration neither invokes provider nor fakes a launch', async () => {
  const adapter = createIvocOwnerAdapter({ fetchImpl: () => { throw new Error('must not run'); } });
  assert.equal(adapter.available, false); await assert.rejects(adapter.launch(), /could not verify/u);
});
test('adapter signs exact private server actor/path/body and never sends browser credentials', async () => {
  let calls = 0;
  const adapter = createIvocOwnerAdapter({ ...config, fetchImpl: async (url, options) => {
    calls++; assert.equal(url, 'https://hq.example.test/api/ivoc/v1/interviewiq/launches');
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store'); assert.ok(options.signal);
    const headers = options.headers; assert.equal(headers.Authorization, undefined); assert.equal(headers.Cookie, undefined); assert.equal(headers.Origin, undefined);
    assert.equal(headers['X-MMED-IIQ-Owner'], 'ivoc'); assert.equal(Buffer.from(headers['X-MMED-IIQ-Actor'], 'base64url').toString(), JSON.stringify(proof));
    const canonical = ['iiq-owner-v1', 'ivoc', headers['X-MMED-IIQ-Timestamp'], headers['X-MMED-IIQ-Nonce'], 'POST', '/api/ivoc/v1/interviewiq/launches', digest(options.body), digest(JSON.stringify(proof))].join('\n');
    assert.equal(headers['X-MMED-IIQ-Signature'], createHmac('sha256', key).update(canonical).digest('hex'));
    assert.deepEqual(JSON.parse(options.body), input); return response(created(), 201);
  } });
  const output = await adapter.launch({ actor, input }); assert.equal(calls, 1); assert.equal(output.launchId, launchId);
  assert.equal(output.ticket, undefined); assert.equal(output.session_verifier, undefined); assert.equal(output.launchUrl, created().launchUrl);
});
test('launch URL rejects cross-origin, wrong path, changed ticket, expiry and malformed status', async () => {
  for (const mutate of [p => ({ ...p, launchUrl: p.launchUrl.replace('hq.example.test', 'evil.example.test') }),
    p => ({ ...p, launchUrl: p.launchUrl.replace('/iv-prep-on-call/', '/admin/') }),
    p => ({ ...p, ticket: 'x'.repeat(43) }), p => ({ ...p, expiresAt: new Date(now).toISOString() }),
    p => ({ ...p, status: 'complete' })]) {
    const adapter = createIvocOwnerAdapter({ ...config, fetchImpl: async () => response(mutate(created())) });
    await assert.rejects(adapter.launch({ actor, input }), e => e.code === 'ivoc_response_invalid');
  }
});
test('server-only actor resolver rejects admin impersonation and browser identity aliases before network', async () => {
  for (const invalid of [{ ...proof, auth_role: 'admin' }, { ...proof, sub: proof.subject }, { ...proof, session_verifier: '' }]) {
    const adapter = createIvocOwnerAdapter({ ...config, resolveActor: async () => invalid, fetchImpl: async () => { throw new Error('no network'); } });
    await assert.rejects(adapter.launch({ actor, input }), e => e.status === 403);
  }
});
test('pending/partial result is honest and fully bound; JSONB goal key order is harmless', async () => {
  const payload = result(); payload.confirmedGoal = { text: input.confirmedGoal.text, version: 1, id: input.confirmedGoal.id };
  const adapter = createIvocOwnerAdapter({ ...config, fetchImpl: async () => response(payload) });
  const output = await adapter.result({ actor, launchId, expected: input });
  assert.equal(output.status, 'partial'); assert.deepEqual(output.observations, []); assert.equal(output.requiresStudentConfirmation, true);
});
test('cross-session/program/goal/result mismatch and provisional client feedback cannot import', async () => {
  for (const mutate of [p => ({ ...p, launchId: randomUUID() }), p => ({ ...p, interviewId: randomUUID() }),
    p => ({ ...p, programSpecialtyId: 'different' }), p => ({ ...p, registryReleaseId: 'old' }),
    p => ({ ...p, confirmedGoal: { ...p.confirmedGoal, version: 2 } }), p => ({ ...p, requiresStudentConfirmation: false }),
    p => ({ ...p, returnUrl: 'https://evil.test/' }), p => ({ ...p, observations: [{ text: 'unsupported', facet: 'structure', polarity: 'strength', basis: 'client' }] })]) {
    const adapter = createIvocOwnerAdapter({ ...config, fetchImpl: async () => response(mutate(result())) });
    await assert.rejects(adapter.result({ actor, launchId, expected: input }));
  }
});
test('permitted source-bound draft stays unconfirmed and cannot carry transcript or media extras', async () => {
  const payload = { ...result(), status: 'completed', sourceVersion: 'c'.repeat(64), summary: 'Feedback ready.',
    observations: [{ text: 'Name the action you took.', facet: 'specificity', polarity: 'weakness', basis: 'source-bound-ai-draft' }], nextChange: 'Name the action you took.',
    transcript: 'owner field excluded', recording: 'owner field excluded' };
  const adapter = createIvocOwnerAdapter({ ...config, fetchImpl: async () => response(payload) });
  const output = await adapter.result({ actor, launchId, expected: input });
  assert.equal(output.status, 'completed'); assert.equal(output.requiresStudentConfirmation, true); assert.equal(output.transcript, undefined); assert.equal(output.recording, undefined);
});
test('outages, redirects, oversized responses, HTTP denials and missing schema never become success', async () => {
  for (const fetchImpl of [async () => { throw new TypeError('synthetic network'); }, async () => response({ error: 'private SQL' }, 503),
    async () => response({}, 403), async () => new Response('x'.repeat(17000), { headers: { 'content-type': 'application/json' } })]) {
    const adapter = createIvocOwnerAdapter({ ...config, fetchImpl }); await assert.rejects(adapter.launch({ actor, input }), e => !e.message.includes('private SQL'));
  }
});
