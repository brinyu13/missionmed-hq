import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { createCoachingWebexProvider } from '../missionmed-hq/lib/scheduler/coaching-provider.mjs';
const id = '11111111-2222-4333-8444-555555555555';
const unit = 'coaching-unit:v1:123:456:mock:1';
const fact = { appointment_id: id, unit_id: unit, eligibility: true, state: 'booked' };
const env = { MMHQ_WP_BASE: 'https://missionmedinstitute.com', MMHQ_HANDOFF_SECRET: 'nonsecret-fixture-only-'.repeat(3) };
function setup({ facts = [fact], result, response, overrides = {} } = {}) {
  const calls = []; const reads = []; let i = 0;
  const provider = createCoachingWebexProvider({ env,
    getStoredCoachingAccess: async ap => { reads.push(ap); return facts[Math.min(i++, facts.length - 1)]; },
    buildMeetingPayload: () => ({ title: 'Controlled fixture', start: '2026-10-25T10:00:00-04:00', end: '2026-10-25T11:45:00-04:00' }),
    fetchImpl: async (url, options) => { calls.push({ url, options }); return response || new Response(JSON.stringify(result || {
      ok: true, external_event_id: 'OWNED_MEETING', meeting_url: 'https://example.webex.com/controlled-fixture',
      recordings: [], evidence: { meeting_absent: true, recordings: [] },
    }), { headers: { 'content-type': 'application/json' } }); }, ...overrides,
  });
  return { provider, calls, reads };
}
test('create binds stored appointment/unit and existing HMAC; ignores client grant claims', async () => {
  const { provider, calls, reads } = setup();
  const result = await provider.create({ appointment_id: id, unit_id: 'FOREIGN', eligibility: true });
  assert.equal(result.status, 'created'); assert.equal(result.invitee_email_sent, false);
  assert.deepEqual(reads, [{ id }, { id }]);
  const { url, options } = calls[0]; assert.equal(url, 'https://missionmedinstitute.com/wp-json/missionmed-scheduler/v1/coaching/webex');
  const body = JSON.parse(options.body); assert.equal(body.unit_id, unit); assert.deepEqual(body.invitee, {});
  assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
  assert.equal(options.headers['X-MM-Scheduler-Signature'], createHmac('sha256', env.MMHQ_HANDOFF_SECRET)
    .update(options.headers['X-MM-Scheduler-Timestamp'] + '.' + options.body).digest('hex'));
});
test('unknown/revoked/mismatched entitlement cannot create or disclose recordings', async () => {
  for (const denied of [null, { ...fact, eligibility: false }, { ...fact, appointment_id: 'OTHER' }, { ...fact, unit_id: 'bad' }]) {
    for (const method of ['create','recordings']) {
      const { provider, calls } = setup({ facts: [denied] });
      await assert.rejects(provider[method]({ appointment_id: id })); assert.equal(calls.length, 0);
    }
  }
});
test('refund during provider creation revokes newly owned resources and withholds URL', async () => {
  const { provider, calls } = setup({ facts: [fact, { ...fact, eligibility: false }] });
  await assert.rejects(provider.create({ appointment_id: id }));
  assert.deepEqual(calls.map(c => JSON.parse(c.options.body).action), ['create','revoke']);
});
test('refund during recording lookup never returns copied recording URL', async () => {
  const { provider, calls } = setup({ facts: [fact, { ...fact, eligibility: false }] });
  await assert.rejects(provider.recordings({ appointment_id: id }));
  assert.deepEqual(calls.map(c => JSON.parse(c.options.body).action), ['recordings','revoke']);
});
test('unknown after creation or recording lookup withholds URLs without guessing revocation', async () => {
  for (const method of ['create','recordings']) {
    const { provider, calls } = setup({ facts: [fact, { ...fact, eligibility: undefined }] });
    await assert.rejects(provider[method]({ appointment_id: id }));
    assert.deepEqual(calls.map(c => JSON.parse(c.options.body).action), [method]);
  }
});
test('cleanup requires positive cancellation/revocation and actual provider absence proof', async () => {
  const active = setup(); await assert.rejects(active.provider.cleanup({ appointment_id: id })); assert.equal(active.calls.length, 0);
  const cancelled = setup({ facts: [{ ...fact, state: 'canceled' }] });
  assert.equal((await cancelled.provider.cleanup({ appointment_id: id })).cleanup_ok, true);
  const revoked = setup({ facts: [{ ...fact, eligibility: false }] });
  assert.equal((await revoked.provider.cleanup({ appointment_id: id })).cleanup_ok, true);
  const unknown = setup({ facts: [{ ...fact, eligibility: undefined }] });
  await assert.rejects(unknown.provider.cleanup({ appointment_id: id }));
  const unconfirmed = setup({ facts: [{ ...fact, eligibility: false }], result: { ok: true, evidence: { meeting_absent: false, recordings: [] } } });
  await assert.rejects(unconfirmed.provider.cleanup({ appointment_id: id }));
});
test('broker transport failures never certify provider containment', async () => {
  for (const response of [new Response('{}', { status: 503 }), new Response('not-json', { headers: { 'content-type': 'text/plain' } }),
    new Response(JSON.stringify({ ok: true }) + 'x'.repeat(262145), { headers: { 'content-type': 'application/json' } })]) {
    const { provider } = setup({ response }); await assert.rejects(provider.create({ appointment_id: id }));
  }
  for (const badEnv of [{ ...env, MMHQ_WP_BASE: 'https://attacker.test' }, { ...env, MMHQ_HANDOFF_SECRET: '' }]) {
    const { provider, calls } = setup({ overrides: { env: badEnv } });
    await assert.rejects(provider.create({ appointment_id: id })); assert.equal(calls.length, 0);
  }
});
