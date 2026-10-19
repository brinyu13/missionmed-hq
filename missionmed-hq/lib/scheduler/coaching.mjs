import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Additive contract only: no routes, environment reads, background work, grants
// or provider calls. The integrator supplies existing server identity/RPC seams.
export const COACHING_RPC = Object.freeze({
  claim_bridge_nonce: 'mm_coaching_claim_bridge_nonce',
  admit_order: 'mm_coaching_admit_order',
  verified_payment: 'mm_coaching_verified_payment',
  observe_refund: 'mm_coaching_observe_refund',
  lookup_operation: 'mm_coaching_lookup_operation',
  release_unpaid_order: 'mm_coaching_release_unpaid_order',
  approve_availability: 'mm_coaching_approve_availability',
  read_model: 'mm_coaching_read_model',
  mutate_appointment: 'mm_coaching_mutate_appointment',
  claim_activation_outbox: 'mm_coaching_claim_activation_outbox',
  ack_activation_outbox: 'mm_coaching_ack_activation_outbox',
});
const WOO_ACTIONS = new Set(['admit_order', 'verified_payment', 'release_unpaid_order', 'observe_refund']);
const fail = (code) => { const error = new Error(code); error.code = code; error.status = 403; throw error; };

// Request-scoped, server-to-server freshness only. This does not make a Woo
// refund and a native booking cross-system atomic. Never send browser bindings.
export async function checkCoachingAccess({ actor, bindings, secret, fetchImpl = globalThis.fetch, now = Date.now() }) {
  if (!actor?.userId || !Number.isSafeInteger(actor.wpUserId) || actor.wpUserId <= 0
    || !Array.isArray(bindings) || bindings.length > 100 || typeof fetchImpl !== 'function'
    || typeof secret !== 'string' || Buffer.byteLength(secret) < 32) fail('coaching_access_unavailable');
  const seen = new Set();
  for (const b of bindings) {
    if (typeof b.order_id !== 'string' || !b.order_id || !/^[a-f0-9]{64}$/.test(b.snapshot_digest || '') || seen.has(b.order_id)) fail('coaching_access_binding_invalid');
    seen.add(b.order_id);
  }
  if (!bindings.length) return new Map();
  const timestamp = String(Math.floor(now / 1000)); const nonce = randomBytes(24).toString('hex');
  const raw = JSON.stringify({ actor_user_id: actor.userId, actor_wp_user_id: actor.wpUserId, bindings });
  const signature = createHmac('sha256', secret).update(`mmed-coaching-access-request-v1\n${timestamp}\n${nonce}\n${raw}`).digest('hex');
  let response; let text; let body; let decoded; let decodedRaw;
  try {
    response = await fetchImpl('https://missionmedinstitute.com/wp-json/mmed-coaching/v1/access-status', {
      method: 'POST', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(7000),
      headers: { 'content-type': 'application/json', 'x-mmed-coaching-timestamp': timestamp,
        'x-mmed-coaching-nonce': nonce, 'x-mmed-coaching-signature': signature }, body: raw,
    });
    if (!response.ok || Number(response.headers?.get('content-length')) > 32768) fail('coaching_access_unavailable');
    // Bound streaming bytes before decoding; do not buffer an unbounded body.
    if (!response.body?.getReader) fail('coaching_access_unavailable');
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 32768) { await reader.cancel(); fail('coaching_access_unavailable'); } chunks.push(Buffer.from(value));
    } } finally { reader.releaseLock(); }
    text = Buffer.concat(chunks).toString('utf8'); body = JSON.parse(text);
    if (typeof body.payload !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.payload)
      || typeof body.signature !== 'string' || !/^[a-f0-9]{64}$/.test(body.signature)) fail('coaching_access_unavailable');
    const bytes = Buffer.from(body.payload, 'base64');
    if (bytes.toString('base64') !== body.payload) fail('coaching_access_unavailable');
    decodedRaw = bytes.toString('utf8');
    const expected = createHmac('sha256', secret).update(`mmed-coaching-access-response-v1\n${decodedRaw}`).digest();
    if (!timingSafeEqual(expected, Buffer.from(body.signature, 'hex'))) fail('coaching_access_unavailable');
    decoded = JSON.parse(decodedRaw);
  } catch { fail('coaching_access_unavailable'); }
  if (decoded.nonce !== nonce || decoded.request_digest !== createHash('sha256').update(raw).digest('hex')
    || decoded.actor_user_id !== actor.userId || decoded.actor_wp_user_id !== actor.wpUserId
    || !Number.isSafeInteger(decoded.checked_at) || Math.abs(Math.floor(Date.now() / 1000) - decoded.checked_at) > 60
    || !Array.isArray(decoded.bindings) || decoded.bindings.length !== bindings.length) fail('coaching_access_unavailable');
  const result = new Map(); const requested = new Map(bindings.map(b => [b.order_id, b.snapshot_digest]));
  for (const b of decoded.bindings) {
    if (!requested.has(b.order_id) || requested.get(b.order_id) !== b.snapshot_digest || result.has(b.order_id) || typeof b.active !== 'boolean') fail('coaching_access_unavailable');
    result.set(b.order_id, b.active);
  }
  return result;
}

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
      'start_at','end_at','timezone','provider_id','appointment_type_id','resource_id','schedule_event_id','intake_answers','reason','client_request_digest']) {
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
      if (verified.action === 'observe_refund' && (verified.payload.source !== 'canonical_woo_verified'
        || verified.payload.event_type !== 'refund_observed' || verified.payload.refund_record_verified !== true
        || !verified.payload.event_id || !verified.payload.refund_id || !Number.isSafeInteger(verified.payload.cumulative_refund_cents)
        || verified.payload.cumulative_refund_cents <= 0)) fail('coaching_canonical_refund_required');
      if (verified.action === 'release_unpaid_order' && (verified.payload.source !== 'canonical_woo_verified'
        || verified.payload.event_type !== 'terminal_unpaid' || verified.payload.is_paid !== false
        || verified.payload.gateway !== 'stripe' || verified.payload.provider_status !== 'canceled'
        || verified.payload.financial_outcome !== 'verified_terminal_unpaid'
        || verified.payload.gateway_funds_received !== false || !verified.payload.provider_evidence_id)) fail('coaching_terminal_unpaid_required');
      return rpc(verified.action, verified.payload);
    },
    async readModel(session) { return rpc('read_model', await actorPayload(session, {})); },
    async lookupOperation(session, payload = {}) { return rpc('lookup_operation', await actorPayload(session, payload)); },
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
