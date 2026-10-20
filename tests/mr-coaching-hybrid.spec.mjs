import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createCoachingHybridService } from '../missionmed-hq/lib/scheduler/coaching-hybrid.mjs';
import { createWooCoachingAllowanceReader } from '../missionmed-hq/lib/scheduler/coaching-woo-read.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const actor = { userId, wpUserId: 9001, supabaseIdentityConfirmed: true };
const session = { supabaseUserId: userId, user: { wpUserId: 9001 } };
const now = 2000000000000;
const status = { mode: 'supabase_rest', configured: true, service_role_configured: true };
const payload = { action: 'book', idempotency_key: 'owned-operation', client_request_digest: 'a'.repeat(64), unit_id: 'coaching-unit:v1:101:1101:mock:1', appointment_type_id: userId, provider_id: userId, start_at: '2034-07-01T13:00:00Z', end_at: '2034-07-01T14:45:00Z', timezone: 'America/New_York' };
const BIND = ['actor_user_id','actor_wp_user_id','action','idempotency_key','client_request_digest','unit_id','appointment_id','appointment_type_id','provider_id','resource_id','approval_id','start_at','end_at','timezone'];
function fixture(overrides = {}) {
  const calls = []; const events = []; let counter = 0;
  const reader = createWooCoachingAllowanceReader({ now: () => now, getServiceHeaders: async () => ({ Authorization: 'Basic c2VydmVyOnNlcnZlcg==' }),
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://missionmedinstitute.com/wp-json/mmed-coaching/v1/allowances');
      assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
      const body = JSON.parse(options.body); events.push(`woo:${++counter}`);
      return new Response(JSON.stringify({ schema: 'missionmed.coaching.allowances.v1', ...body, checked_at: now / 1000, valid_until: now / 1000 + 15, complete: true, packages: [] }), { headers: { 'content-type': 'application/json' } });
    } });
  const repository = { status: () => status, rpc: async (name, args) => { events.push(name); calls.push({ name, ...args }); return { ok: true }; } };
  const service = createCoachingHybridService({ enabled: true, repository, actor, resolveNativeActor: async () => actor, readWooAllowances: reader, now: () => now, ...overrides });
  return { service, calls, events, reader, repository };
}
test('only four nonfinancial server methods are exposed; default is disabled', async () => {
  const { service } = fixture(); assert.deepEqual(Object.keys(service).sort(), ['lookupOperation','mutateAppointment','readModel','status']);
  assert.equal(service.status().native_composition_acceptance, 'UNVERIFIED');
  await assert.rejects(createCoachingHybridService().readModel(session), { code: 'coaching_disabled' });
});
test('read model uses fresh HTTP-mocked canonical reader and exact owned identity', async () => {
  const { service, calls, events } = fixture(); await service.readModel(session); await service.readModel(session);
  assert.equal(calls[0].name, 'mm_coaching_hybrid_read_model');
  assert.equal(calls[0].p_payload.actor_user_id, userId); assert.equal(calls[0].p_payload.actor_wp_user_id, 9001);
  assert.equal(calls[0].p_payload.allowance_source, 'authenticated_server_woo_read');
  assert.notEqual(calls[0].p_payload.allowance_receipt.request_id, calls[1].p_payload.allowance_receipt.request_id);
  assert.deepEqual(events, ['woo:1','mm_coaching_hybrid_read_model','woo:2','mm_coaching_hybrid_read_model']);
});
test('lookup strips receipt, unit, roles and all client identity aliases', async () => {
  const { service, calls, events } = fixture();
  await service.lookupOperation(session, { ...payload, actor_user_id: 'attacker', actor_type: 'admin', studentUserId: 'attacker', allowance_receipt: {} });
  assert.deepEqual(calls[0], { name: 'mm_coaching_hybrid_lookup_operation', p_payload: { action: payload.action, idempotency_key: payload.idempotency_key, client_request_digest: payload.client_request_digest, identity_source: 'native_scheduler_authenticated_actor', actor_user_id: userId, actor_wp_user_id: 9001 } });
  assert.deepEqual(events, ['mm_coaching_hybrid_lookup_operation']);
});
test('book and reschedule refresh immediately before mutation and generate exact SQL binding', async () => {
  const { service, calls, events } = fixture();
  for (const action of ['book','reschedule']) await service.mutateAppointment(session, { ...payload, action, actor_user_id: 'attacker', actor_wp_user_id: 1, actorType: 'admin', student_user_id: 'attacker', request_binding: 'fake', request_digest: 'fake', allowance_receipt: { fake: true }, allowance_source: 'fake', financial_authority: true, reason: 'Owned student request' });
  for (const { name, p_payload: p } of calls) {
    assert.equal(name, 'mm_coaching_hybrid_mutate_appointment'); assert.equal(p.actor_user_id, userId); assert.equal(p.actor_wp_user_id, 9001);
    assert.equal(p.actorType, undefined); assert.equal(p.student_user_id, undefined); assert.equal(p.financial_authority, undefined);
    assert.equal(p.allowance_receipt.complete, true); assert.equal(p.allowance_receipt.fake, undefined);
    const bound = JSON.parse(p.request_binding); assert.deepEqual(Object.keys(bound), BIND); assert.equal(bound.appointment_id, null); assert.equal(bound.resource_id, null);
    assert.equal(p.request_digest, createHash('sha256').update(p.request_binding, 'utf8').digest('hex'));
  }
  assert.notEqual(calls[0].p_payload.allowance_receipt.request_id, calls[1].p_payload.allowance_receipt.request_id);
  assert.deepEqual(events, ['woo:1','mm_coaching_hybrid_mutate_appointment','woo:2','mm_coaching_hybrid_mutate_appointment']);
});
test('cancel requires owned native unit but no Woo read or allowance receipt', async () => {
  const { service, calls } = fixture({ readWooAllowances: async () => { throw Error('must not read'); } });
  await service.mutateAppointment(session, { ...payload, action: 'cancel', appointment_id: userId, allowance_receipt: { complete: true }, allowance_source: 'fake' });
  assert.equal(calls[0].p_payload.allowance_receipt, undefined); assert.equal(calls[0].p_payload.allowance_source, undefined);
  assert.equal(JSON.parse(calls[0].p_payload.request_binding).appointment_id, userId);
});
test('unconfirmed, malformed and mismatched identities fail before HTTP or RPC', async () => {
  for (const bad of [{ ...actor, supabaseIdentityConfirmed: false }, { ...actor, userId: '1' }, { ...actor, wpUserId: 1.2 }, { ...actor, wpUserId: 0 }, { ...actor, userId: '22222222-2222-4222-8222-222222222222' }]) {
    const { service, events } = fixture({ resolveNativeActor: async () => bad });
    await assert.rejects(service.readModel(session), { code: 'coaching_confirmed_identity_required' }); assert.deepEqual(events, []);
  }
});
test('repository must be configured native service-role REST', async () => {
  for (const bad of [{ ...status, mode: 'memory' }, { ...status, configured: false }, { ...status, service_role_configured: false }]) {
    const { service, events } = fixture({ repository: { status: () => bad, rpc: async () => assert.fail('RPC forbidden') } });
    await assert.rejects(service.readModel(session), { code: 'coaching_service_repository_required' }); assert.deepEqual(events, []);
  }
});
test('invalid action, idempotency, digest and missing unit fail before read/RPC', async () => {
  for (const bad of [{ ...payload, action: 'verified_payment' }, { ...payload, idempotency_key: '' }, { ...payload, client_request_digest: 'fake' }, { ...payload, unit_id: undefined }]) {
    const { service, events } = fixture(); await assert.rejects(service.mutateAppointment(session, bad)); assert.deepEqual(events, []);
  }
});
test('incomplete, stale, wrong-owner and malformed reader facts never reach RPC', async () => {
  const base = { schema: 'missionmed.coaching.allowances.v1', request_id: 'b'.repeat(48), subject_user_id: userId, subject_wp_user_id: 9001, checked_at: now / 1000, valid_until: now / 1000 + 15, complete: true, packages: [] };
  for (const change of [{ complete: false }, { subject_user_id: 'attacker' }, { subject_wp_user_id: 1 }, { checked_at: now / 1000 - 16, valid_until: now / 1000 - 1 }, { checked_at: now / 1000 + 2 }, { valid_until: now / 1000 + 16 }, { packages: null }, { request_id: 'fake' }]) {
    const { service, calls } = fixture({ readWooAllowances: async () => ({ ...base, ...change }) });
    await assert.rejects(service.readModel(session), { code: 'coaching_woo_allowances_unavailable' });
    await assert.rejects(service.mutateAppointment(session, payload), { code: 'coaching_woo_allowances_unavailable' }); assert.deepEqual(calls, []);
  }
});
test('reader failure propagates without retry or fallback RPC', async () => {
  let attempts = 0; const { service, calls } = fixture({ readWooAllowances: async () => { attempts++; throw Error('Woo unavailable'); } });
  await assert.rejects(service.mutateAppointment(session, payload), /Woo unavailable/); assert.equal(attempts, 1); assert.deepEqual(calls, []);
});
test('RPC failures propagate without retry', async () => {
  let attempts = 0; const { service } = fixture({ repository: { status: () => status, rpc: async () => { attempts++; throw Error('RPC unavailable'); } } });
  await assert.rejects(service.lookupOperation(session, payload), /RPC unavailable/); assert.equal(attempts, 1);
});
