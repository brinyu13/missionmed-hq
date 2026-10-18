import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeVoiceSpendPolicy, consumeNativeCreatePermit, trustedNativeVoiceAdmin } from '../../server/providers/native-voice-spend-policy.mjs';
import { createNativeVoiceSpendStore } from '../../server/providers/native-voice-spend-store.mjs';
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = Date.parse('2026-10-15T00:00:00Z');
const binding = () => ({ ownerSubject: 'wp:1', administrator: true, ivocSessionId: ID,
  cookieFingerprint: 'a'.repeat(64), requestHash: 'b'.repeat(64), credentialFingerprint: 'c'.repeat(64), entitlementRevision: 'revision' });
function fixture({ patch = {}, claimError = false, heartbeat = null } = {}) {
  const calls = []; let claimed = false;
  const row = { ok: true, reservation_id: ID, generation: ID, owner_subject: 'wp:1', session_id: ID,
    model: 'gpt-live-1', credential_fingerprint: 'c'.repeat(64), account_fingerprint: 'd'.repeat(64), hard_ceiling_verified: true, cleanup_ms: 1000,
    presence_ms: 10000, heartbeat_ms: 1000, deadline_at: new Date(NOW + 60000).toISOString(),
    startup_deadline_at: new Date(NOW + 30000).toISOString(), presence_expires_at: new Date(NOW + 10000).toISOString(), ...patch };
  const store = { reserve: async b => { calls.push(['reserve', b]); return row; },
    claimCreate: async b => { calls.push(['claim', b]); if (claimed) throw new Error('consumed'); claimed = true;
      if (claimError) throw new Error('claim response lost'); return { ok: true, claimed: true, reservation_id: ID }; },
    heartbeat: async b => { calls.push(['presence', b]); return heartbeat || row; },
    recordTerminal: async b => { calls.push(['terminal', b]); return { ok: true, provider_terminal_confirmed: true, accounting_complete: false }; },
    recordUsage: async b => { calls.push(['usage', b]); return { ok: true, accounting_complete: true, accounting_scope: 'native_voice_seconds' }; },
    quarantine: async b => { calls.push(['quarantine', b]); return { ok: true }; } };
  return { policy: createNativeVoiceSpendPolicy({ store, now: () => NOW }), calls, row };
}
test('default policy, exact Founder AND trusted Admin, and malformed/stale funding all deny', async () => {
  assert.throws(() => createNativeVoiceSpendPolicy(), /unavailable/);
  assert.equal(trustedNativeVoiceAdmin({ user: { id: 1, roles: ['administrator'] } }, 'wp:1'), true);
  for (const [id, roles, subject] of [[2, ['administrator'], 'wp:2'], [1, ['founder'], 'wp:1'], ['1', ['administrator'], 'wp:1']]) {
    assert.equal(trustedNativeVoiceAdmin({ user: { id, roles } }, subject), false);
  }
  for (const input of [{ ...binding(), administrator: false }, { ...binding(), ownerSubject: 'wp:2' }]) {
    const h = fixture(); await assert.rejects(h.policy.reserve(input), /funded/); assert.equal(h.calls.length, 0);
  }
  for (const patch of [{ hard_ceiling_verified: false }, { cleanup_ms: 0 }, { cleanup_ms: 60001 }, { cleanup_ms: undefined }, { account_fingerprint: '' }, { model: 'other' },
    { deadline_at: new Date(NOW).toISOString() }, { heartbeat_ms: 6000 }]) {
    const h = fixture({ patch }); await assert.rejects(h.policy.reserve(binding()), /funded/);
    assert.equal(h.calls.some(c => c[0] === 'claim'), false);
  }
});
test('durable claim precedes opaque one-use permit; unknown committed response cannot produce a retry permit', async () => {
  const h = fixture(); const r = await h.policy.reserve(binding());
  const permit = await h.policy.claim(r, binding());
  assert.deepEqual(h.calls.map(c => c[0]), ['reserve', 'claim']);
  assert.equal(consumeNativeCreatePermit(permit, 'c'.repeat(64), NOW), permit);
  assert.throws(() => consumeNativeCreatePermit(permit, 'c'.repeat(64), NOW), /funded/);
  await assert.rejects(h.policy.claim(r, binding()), /consumed/);
  const lost = fixture({ claimError: true }); const lr = await lost.policy.reserve(binding());
  await assert.rejects(lost.policy.claim(lr, binding()), /lost/);
  await assert.rejects(lost.policy.claim(lr, binding()), /consumed/);
  assert.throws(() => consumeNativeCreatePermit({ authorized: true }, 'c'.repeat(64), NOW), /funded/);
});
test('owner/cookie/request drift cannot use reserved authority, and heartbeats cannot move the absolute deadline', async () => {
  const h = fixture(); const r = await h.policy.reserve(binding());
  await assert.rejects(h.policy.claim(r, { ...binding(), cookieFingerprint: 'e'.repeat(64) }), /funded/);
  assert.equal(h.calls.filter(c => c[0] === 'claim').length, 0);
  const changed = fixture({ heartbeat: { ok: true, reservation_id: ID, deadline_at: new Date(NOW + 120000).toISOString(),
    presence_expires_at: new Date(NOW + 20000).toISOString() } });
  const cr = await changed.policy.reserve(binding());
  await assert.rejects(changed.policy.presence(cr, { generation: ID, sequence: 1 }), /funded/);
});
test('terminal evidence and final accounting remain separate; no transcript or hangup ACK is mapped into either', async () => {
  const h = fixture(); const r = await h.policy.reserve(binding());
  const terminal = await h.policy.evidence(r, { kind: 'terminal', eventId: 'closed-1' });
  assert.equal(terminal.provider_terminal_confirmed, true); assert.equal(terminal.accounting_complete, false);
  assert.deepEqual(h.calls.map(c => c[0]), ['reserve', 'terminal']);
  await assert.rejects(h.policy.evidence(r, { kind: 'hangup', ok: true }), /invalid/);
});
test('fixed exact-project RPC adapter makes one attempt and sanitizes persistence uncertainty', async () => {
  assert.throws(() => createNativeVoiceSpendStore({ rest: { projectRef: 'foreign', request() {} } }), /exact authorized/);
  const calls = []; const store = createNativeVoiceSpendStore({ rest: { projectRef: 'bscnrgqlwsyygyfrbhfn',
    request: async (path, options) => { calls.push({ path, options }); throw new Error('private fixture content'); } } });
  await assert.rejects(store.claimCreate({ reservationId: ID, ...binding() }), e => e.message === 'Native Voice durable operation unconfirmed.');
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/rpc/ivoc_native_voice_claim_create');
});
// PostgreSQL atomicity, lock-expiry, duplicate bind, same-event terminal+usage,
// service_role column ACLs and RLS require the separately admitted isolated DB
// runner. These mock tests explicitly do not certify those database invariants.


test('actual mount reservation binds server billing context, with browser context unable to replace it', async () => {
  const {Readable}=await import('node:stream'); const {createHash}=await import('node:crypto');
  const {createIvPrepHqHandler}=await import('../../server/hq-mount.mjs');
  const {InMemoryAdmissionRegistry}=await import('../../server/admission-registry.mjs');
  const {NATIVE_VOICE_BILLING_CONTEXT}=await import('../../server/providers/openai-live-session.mjs');
  const registry=new InMemoryAdmissionRegistry({now:()=>NOW});
  registry.grantSyntheticEntitlement({subject:'wp:1',revision:'local-1',expiresAtMs:NOW+120000,founder:true,voice:true,video:false});
  let captured,creates=0;
  const handler=createIvPrepHqHandler({registry,now:()=>NOW,flags:{enabled:true,adminCanaryEnabled:true,videoEnabled:false},
    liveSessionGuard:async()=>{},liveContextResolver:async()=>({actorBlock:'authorized fixture',receipt:'fixture'}),
    liveSessionBroker:{billingContext:NATIVE_VOICE_BILLING_CONTEXT,credentialFingerprint:'c'.repeat(64),create:async()=>{creates++;}},
    nativeVoicePolicy:{reserve:async value=>{captured=value;throw new Error('offline stop before provider');}}});
  const body={sdp:'v=0\r\no=offer',voice:'marin',context:{questionIds:['CORE-01']},ivocSessionId:ID};
  async function invoke(value){const request=Readable.from([Buffer.from(JSON.stringify(value))]);request.method='POST';request.headers={host:'hq.local',origin:'http://hq.local','sec-fetch-site':'same-origin','x-mmhq-csrf':'csrf_token_1234567890'};
    const response={writeHead(status){this.status=status;},end(){}};
    await handler({request,response,url:new URL('http://hq.local/api/ivprep-v6/live/sessions'),hqSession:{version:1,issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),csrfToken:'csrf_token_1234567890',authSource:'wordpress-cookie',user:{id:1,roles:['administrator']}},cookieFingerprint:'a'.repeat(64),hqSessionMaxTtlSeconds:300,expectedOrigin:'http://hq.local'});return response.status;}
  assert.equal(await invoke(body),503);assert.ok(captured);
  assert.equal(captured.requestHash,createHash('sha256').update(JSON.stringify({body,billingContext:NATIVE_VOICE_BILLING_CONTEXT})).digest('hex'));
  assert.notEqual(captured.requestHash,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
  captured=null;await invoke({...body,billingContext:{organization:'foreign',project:'foreign'}});
  assert.equal(captured,null,'browser billing context must be rejected before reservation');assert.equal(creates,0);
});
