import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoachingStaffCancellation } from '../missionmed-hq/lib/scheduler/coaching-staff-cancellation.mjs';
const USER = '11111111-1111-4111-8111-111111111111';
const APPOINTMENT = '22222222-2222-4222-8222-222222222222';
const session = { user: { supabaseUserId: USER, wpUserId: 77, roles: ['administrator'] } };
const payload = { appointment_id: APPOINTMENT, idempotency_key: 'staff-cancel-request', reason: 'Refund containment', client_request_digest: 'a'.repeat(64) };
function fixture(status = { mode: 'supabase_rest', configured: true, service_role_configured: true }, result = { ok: true }) {
  const calls = [];
  const cancel = createCoachingStaffCancellation({ repository: { status: () => status, rpc: async (name, args) => { calls.push({ name, ...args }); return result; } } });
  return { cancel, calls };
}
test('actual existing admin resolver supplies actor; all HTTP aliases and financial fields stripped', async () => {
  const { cancel, calls } = fixture();
  await cancel(session, { ...payload, actor_user_id: APPOINTMENT, actor_wp_user_id: 999, actor_type: 'system', isAdmin: true, student_user_id: APPOINTMENT, student_wp_user_id: 999, unit_id: 'forged', allowance_receipt: {}, refund_approved: true });
  assert.deepEqual(calls, [{ name: 'mm_coaching_hybrid_staff_cancel_appointment', p_payload: { ...payload, identity_source: 'native_scheduler_authenticated_staff', actor_type: 'admin', actor_user_id: USER, actor_wp_user_id: 77 } }]);
});
test('student payload admin flags cannot authorize staff cancellation', async () => {
  const { cancel, calls } = fixture();
  await assert.rejects(cancel({ user: { ...session.user, roles: ['student'] } }, { ...payload, isAdmin: true, actor_type: 'admin' }), { code: 'coaching_authenticated_admin_required' });
  assert.deepEqual(calls, []);
});
test('anonymous, fallback, malformed UUID and fractional WordPress identities fail closed', async () => {
  const { cancel, calls } = fixture();
  for (const bad of [null, { user: { ...session.user, supabaseUserId: undefined, id: USER } }, { user: { ...session.user, supabaseUserId: 'invalid' } }, { user: { ...session.user, wpUserId: 77.5 } }]) {
    await assert.rejects(cancel(bad, payload), { code: 'coaching_authenticated_admin_required' });
  }
  assert.deepEqual(calls, []);
});
test('repository and operation binding remain explicit', async () => {
  const { cancel, calls } = fixture();
  for (const change of [{ appointment_id: 'invalid' }, { reason: '' }, { idempotency_key: '' }, { client_request_digest: 'fake' }]) await assert.rejects(cancel(session, { ...payload, ...change }), { code: 'coaching_staff_cancellation_binding_required' });
  assert.deepEqual(calls, []);
  await assert.rejects(fixture({ mode: 'memory', configured: true, service_role_configured: true }).cancel(session, payload), { code: 'coaching_service_repository_required' });
});
test('native null is preserved for existing legacy cancellation fallback', async () => {
  assert.equal(await fixture(undefined, null).cancel(session, payload), null);
});
