import { createHash } from 'node:crypto';

// PRIVATE CANDIDATE. Server dependency injection only; no routes or credentials.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const ACTIONS = new Set(['book', 'reschedule', 'cancel']);
const BIND = ['actor_user_id','actor_wp_user_id','action','idempotency_key','client_request_digest','unit_id','appointment_id','appointment_type_id','provider_id','resource_id','approval_id','start_at','end_at','timezone'];
const NATIVE = ['action','idempotency_key','client_request_digest','unit_id','service_credit_id','appointment_id','appointment_type_id','provider_id','resource_id','approval_id','start_at','end_at','timezone','schedule_event_id','intake_answers','reason'];
const digest = value => createHash('sha256').update(value, 'utf8').digest('hex');
function deny(code, status = 403) { const e = new Error(code); e.code = code; e.status = status; throw e; }
function pick(payload, keys) { return Object.fromEntries(keys.filter(k => Object.hasOwn(payload, k) && payload[k] !== undefined).map(k => [k, structuredClone(payload[k])])); }

export function createCoachingHybridService({ enabled = false, repository, actor, resolveNativeActor, readWooAllowances, now = Date.now } = {}) {
  async function identity(session) {
    if (enabled !== true) deny('coaching_disabled', 503);
    if (typeof resolveNativeActor !== 'function') deny('coaching_identity_unconfigured');
    const actual = await resolveNativeActor(session);
    if (!actual?.supabaseIdentityConfirmed || !UUID.test(actual.userId)
      || !Number.isSafeInteger(actual.wpUserId) || actual.wpUserId <= 0
      || !actor?.supabaseIdentityConfirmed || String(actor.userId ?? '') !== String(actual.userId)
      || String(actor.wpUserId ?? '') !== String(actual.wpUserId)) deny('coaching_confirmed_identity_required');
    const status = repository?.status?.();
    if (status?.mode !== 'supabase_rest' || status.configured !== true || status.service_role_configured !== true
      || typeof repository.rpc !== 'function') deny('coaching_service_repository_required', 503);
    return { identity_source: 'native_scheduler_authenticated_actor', actor_user_id: actual.userId, actor_wp_user_id: actual.wpUserId };
  }
  async function freshReceipt(session, owned) {
    if (typeof readWooAllowances !== 'function') deny('coaching_woo_allowances_unavailable', 503);
    const receipt = await readWooAllowances(session);
    const seconds = now() / 1000;
    if (!receipt || receipt.schema !== 'missionmed.coaching.allowances.v1'
      || !/^[a-f0-9]{48}$/.test(receipt.request_id || '') || receipt.complete !== true
      || receipt.subject_user_id !== owned.actor_user_id || receipt.subject_wp_user_id !== owned.actor_wp_user_id
      || !Array.isArray(receipt.packages) || receipt.packages.length > 100
      || !Number.isSafeInteger(receipt.checked_at) || !Number.isFinite(seconds)
      || receipt.checked_at > seconds + 1 || seconds - receipt.checked_at > 15
      || receipt.valid_until !== receipt.checked_at + 15 || seconds >= receipt.valid_until) deny('coaching_woo_allowances_unavailable', 503);
    // Full exact unit/package validation belongs to the injected canonical reader
    // and SQL import. A browser receipt is never accepted by this adapter.
    return structuredClone(receipt);
  }
  function operation(payload) {
    if (!payload || !ACTIONS.has(payload.action)) deny('coaching_invalid_action', 400);
    if (typeof payload.idempotency_key !== 'string' || !payload.idempotency_key.trim()
      || typeof payload.client_request_digest !== 'string' || !HASH.test(payload.client_request_digest)) deny('coaching_operation_binding_required', 400);
  }
  return Object.freeze({
    async readModel(session) {
      const owned = await identity(session);
      const allowance_receipt = await freshReceipt(session, owned);
      return repository.rpc('mm_coaching_hybrid_read_model', { p_payload: { ...owned,
        allowance_source: 'authenticated_server_woo_read', allowance_receipt,
        request_digest: digest(`read:${allowance_receipt.request_id}`) } });
    },
    async lookupOperation(session, payload = {}) {
      const owned = await identity(session); operation(payload);
      return repository.rpc('mm_coaching_hybrid_lookup_operation', { p_payload: {
        ...pick(payload, ['action','idempotency_key','client_request_digest']), ...owned } });
    },
    async mutateAppointment(session, payload = {}) {
      const owned = await identity(session); operation(payload);
      const safe = { ...pick(payload, NATIVE), ...owned };
      if (typeof safe.unit_id !== 'string' || !safe.unit_id) deny('coaching_owned_unit_required', 400);
      const request_binding = JSON.stringify(Object.fromEntries(BIND.map(k => [k, safe[k] ?? null])));
      safe.request_binding = request_binding; safe.request_digest = digest(request_binding);
      if (safe.action !== 'cancel') {
        safe.allowance_source = 'authenticated_server_woo_read';
        // Last asynchronous boundary before RPC; never reuse a read-model fact.
        safe.allowance_receipt = await freshReceipt(session, owned);
      }
      return repository.rpc('mm_coaching_hybrid_mutate_appointment', { p_payload: safe });
    },
    status() { return { enabled: enabled === true, native_composition_acceptance: 'UNVERIFIED',
      woo_booking_atomicity: 'FRESH_SNAPSHOT_ONLY', emergency: 'REQUEST_FIRST_ONLY_NO_NATIVE_PURCHASE_RESERVATION' }; },
  });
}
