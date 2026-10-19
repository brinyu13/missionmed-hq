import { createHmac, timingSafeEqual } from 'node:crypto';

// Additive contract only: no routes, environment reads, background work, grants
// or provider calls. The integrator supplies existing server identity/RPC seams.
export const COACHING_RPC = Object.freeze({
  claim_bridge_nonce: 'mm_coaching_claim_bridge_nonce',
  admit_order: 'mm_coaching_admit_order',
  verified_payment: 'mm_coaching_verified_payment',
  release_unpaid_order: 'mm_coaching_release_unpaid_order',
  approve_availability: 'mm_coaching_approve_availability',
  read_model: 'mm_coaching_read_model',
  mutate_appointment: 'mm_coaching_mutate_appointment',
  claim_activation_outbox: 'mm_coaching_claim_activation_outbox',
  ack_activation_outbox: 'mm_coaching_ack_activation_outbox',
});
const WOO_ACTIONS = new Set(['admit_order', 'verified_payment', 'release_unpaid_order']);
const fail = (code) => { const error = new Error(code); error.code = code; error.status = 403; throw error; };

/** Verify exact raw bytes. The caller must durably claim the nonce before RPC;
 * timestamp checking alone is not replay protection. Never log this envelope.
 * Bridge authorizes the canonical Woo server, not a browser or payer claim.
 */
export function verifyCoachingEnvelope({ rawBody, timestamp, nonce, signature, secret, now = Date.now() }) {
  if (typeof rawBody !== 'string' || Buffer.byteLength(rawBody) > 32768
    || typeof secret !== 'string' || Buffer.byteLength(secret) < 32
    || typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp)
    || typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)
    || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)
    || !Number.isFinite(now) || Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) {
    fail('coaching_invalid_envelope');
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}\n${nonce}\n${rawBody}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) fail('coaching_invalid_signature');
  let body;
  try { body = JSON.parse(rawBody); } catch { fail('coaching_invalid_json'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || !WOO_ACTIONS.has(body.action)
    || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) fail('coaching_invalid_action');
  return { action: body.action, payload: body.payload, nonce, timestamp: Number(timestamp) };
}

/** All activation is OFF unless the exact integrator enables it after gates.
 * claimNonce must persist (issuer, nonce) uniquely; it must not be a memory Set.
 * No open HTTP handler is installed here. Woo owns genuine financial verification.
 */
export function createCoachingService({ rpcClient, enabled = false, secret, claimNonce, resolveNativeActor, verifyFounderActor } = {}) {
  async function rpc(action, payload) {
    if (enabled !== true || typeof rpcClient !== 'function') fail('coaching_disabled');
    return rpcClient(COACHING_RPC[action], { p_payload: payload });
  }
  async function actorPayload(session, payload) {
    if (typeof resolveNativeActor !== 'function') fail('coaching_identity_unconfigured');
    const actor = await resolveNativeActor(session);
    if (!actor?.userId || !Number.isSafeInteger(actor.wpUserId) || actor.wpUserId <= 0) fail('coaching_exact_native_actor_required');
    // Explicit allowlist prevents arbitrary client role/identity aliases surviving.
    const result = {};
    for (const key of ['action','idempotency_key','service_credit_id','appointment_id','approval_id',
      'start_at','end_at','timezone','provider_id','appointment_type_id','resource_id','schedule_event_id','intake_answers','reason']) {
      if (Object.hasOwn(payload, key)) result[key] = payload[key];
    }
    return { ...result, identity_source: 'native_scheduler_authenticated_actor',
      actor_user_id: actor.userId, actor_wp_user_id: actor.wpUserId, actor_type: 'student' };
  }
  return {
    async canonicalWooEnvelope(envelope) {
      if (enabled !== true) fail('coaching_disabled');
      const verified = verifyCoachingEnvelope({ ...envelope, secret });
      const noncePayload = { issuer: 'canonical_woo', nonce: verified.nonce, timestamp: verified.timestamp };
      // Default uses the private persisted native RPC, never an in-memory cache.
      const claimed = typeof claimNonce === 'function' ? await claimNonce(noncePayload)
        : await rpc('claim_bridge_nonce', noncePayload);
      if (claimed !== true) fail('coaching_nonce_replayed');
      if (verified.action === 'verified_payment' && (verified.payload.source !== 'canonical_woo_verified'
        || verified.payload.event_type !== 'payment_complete' || verified.payload.is_paid !== true
        || !['processing','completed'].includes(verified.payload.woo_status))) fail('coaching_canonical_payment_required');
      if (verified.action === 'release_unpaid_order' && (verified.payload.source !== 'canonical_woo_verified'
        || verified.payload.event_type !== 'terminal_unpaid' || verified.payload.is_paid !== false
        || verified.payload.gateway !== 'stripe' || verified.payload.provider_status !== 'canceled'
        || verified.payload.financial_outcome !== 'verified_terminal_unpaid'
        || verified.payload.gateway_funds_received !== false || !verified.payload.provider_evidence_id)) fail('coaching_terminal_unpaid_required');
      return rpc(verified.action, verified.payload);
    },
    async readModel(session) { return rpc('read_model', await actorPayload(session, {})); },
    // Internal worker methods only; do not mount on the student/Woo action route.
    async claimActivationOutbox(payload) { return rpc('claim_activation_outbox', payload); },
    async acknowledgeActivationOutbox(payload) { return rpc('ack_activation_outbox', payload); },
    async mutateAppointment(session, payload = {}) { return rpc('mutate_appointment', await actorPayload(session, payload)); },
    async approveAvailability(session, payload = {}) {
      if (typeof verifyFounderActor !== 'function') fail('coaching_founder_verifier_required');
      const founder = await verifyFounderActor(session);
      if (!founder?.userId || founder.isFounder !== true) fail('coaching_founder_required');
      const approved = {};
      for (const key of ['service','availability_rule_id','provider_id','appointment_type_id','approved_from','approved_until','approval_evidence_id']) {
        if (Object.hasOwn(payload,key)) approved[key] = payload[key];
      }
      return rpc('approve_availability', { ...approved, founder_actor_id: founder.userId, approval_source: 'authenticated_founder' });
    },
    status() { return { enabled: enabled === true, native_composition_acceptance: 'UNVERIFIED',
      emergency: 'REQUEST_FIRST_ONLY_NO_NATIVE_PURCHASE_RESERVATION', rpc: COACHING_RPC }; },
  };
}
