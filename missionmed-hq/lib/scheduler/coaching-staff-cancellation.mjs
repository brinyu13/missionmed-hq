import { getSchedulerActor } from './auth.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function deny(code, status = 403) { const error = new Error(code); error.code = code; error.status = status; throw error; }

// PRIVATE internal seam for the existing authenticated admin cancellation route.
// Return null only for a non-Woo-coaching target, preserving its native fallback.
// The session is the server's existing authenticated session, never request JSON.
export function createCoachingStaffCancellation({ repository } = {}) {
  return async function cancelCoachingAppointment(session, payload = {}) {
    const resolved = getSchedulerActor(session, 'admin');
    const actor = resolved.actor;
    if (!resolved.ok || actor?.isAdmin !== true || actor.supabaseIdentityConfirmed !== true
      || !UUID.test(actor.userId) || !Number.isSafeInteger(actor.wpUserId) || actor.wpUserId <= 0) {
      deny('coaching_authenticated_admin_required');
    }
    const status = repository?.status?.();
    if (status?.mode !== 'supabase_rest' || status.configured !== true || status.service_role_configured !== true
      || typeof repository.rpc !== 'function') deny('coaching_service_repository_required', 503);
    if (!UUID.test(payload.appointment_id || '') || typeof payload.idempotency_key !== 'string' || !payload.idempotency_key.trim()
      || typeof payload.reason !== 'string' || !payload.reason.trim()
      || typeof payload.client_request_digest !== 'string' || !/^[a-f0-9]{64}$/.test(payload.client_request_digest)) {
      deny('coaching_staff_cancellation_binding_required', 400);
    }
    return repository.rpc('mm_coaching_hybrid_staff_cancel_appointment', { p_payload: {
      identity_source: 'native_scheduler_authenticated_staff', actor_type: 'admin',
      actor_user_id: actor.userId, actor_wp_user_id: actor.wpUserId,
      appointment_id: payload.appointment_id, idempotency_key: payload.idempotency_key,
      reason: payload.reason, client_request_digest: payload.client_request_digest,
    } });
  };
}
