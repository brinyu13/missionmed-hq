import { randomUUID } from 'node:crypto';

// Uses existing queue states only. A conditional failed-state claim is held
// for review until a positively acknowledged send; never auto-retries an
// uncertain external outcome. Terminal suppression cannot be overwritten.
export async function dispatchCoachingNotification({ repository, access, notification, send } = {}) {
  const initial = await access.inspect(notification.appointment_id);
  if (initial.coaching === false) return null; // Exact existing legacy dispatch.
  if (typeof repository.claimCoachingNotification !== 'function' || typeof repository.finishCoachingNotification !== 'function'
    || typeof repository.getNotificationById !== 'function') return { ok: false, status: 'held', reason: 'coaching_notification_claim_unavailable' };
  const token = `coaching_dispatch:${randomUUID()}`;
  const claimed = await repository.claimCoachingNotification(notification.id, token, Number(notification.attempt_count || 0) + 1);
  if (!claimed) return { ok: false, status: 'held', reason: 'coaching_notification_not_pending' };
  const finish = patch => repository.finishCoachingNotification(notification.id, token, patch);
  const decision = await access.reconcile(notification.appointment_id);
  if (decision.state === 'canceled' || decision.state === 'revoked') {
    if (typeof repository.suppressCoachingNotifications === 'function') await repository.suppressCoachingNotifications(notification.appointment_id);
    else await finish({ status: 'suppressed', last_error: 'coaching_unit_revoked' });
    return { ok: false, status: 'suppressed', reason: 'coaching_unit_revoked', cleanup: decision.cleanup || null };
  }
  if (decision.coaching !== true || decision.state !== 'eligible') {
    await finish({ status: 'failed', last_error: 'coaching_eligibility_unverified' });
    return { ok: false, status: 'held', reason: 'coaching_eligibility_unverified' };
  }
  // Fresh ownership/eligibility was just checked; reload actual status and the
  // live claim immediately before send, never use a queue's old meeting URL.
  const appointment = await repository.getAppointmentById(notification.appointment_id);
  const current = await repository.getNotificationById(notification.id);
  if (!appointment || !['held','booked','confirmed'].includes(appointment.status) || appointment.deleted_at
    || appointment.student_user_id !== decision.appointment.student_user_id
    || appointment.student_wp_user_id !== decision.appointment.student_wp_user_id
    || !current || current.status !== 'failed' || current.last_error !== token) {
    await finish({ status: 'suppressed', last_error: 'coaching_appointment_or_claim_changed' });
    return { ok: false, status: 'suppressed', reason: 'coaching_appointment_or_claim_changed' };
  }
  let dispatched;
  try { dispatched = await send(appointment, current); }
  catch { dispatched = { ok: false, status: 'held' }; }
  if (dispatched?.ok === true && dispatched.status === 'sent') {
    const saved = await finish({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: dispatched.provider_message_id || null, last_error: null });
    return saved ? dispatched : { ok: false, status: 'held', reason: 'coaching_notification_state_changed' };
  }
  if (dispatched?.status === 'suppressed') {
    await finish({ status: 'suppressed', last_error: 'provider_suppressed' });
    return { ok: false, status: 'suppressed', reason: 'provider_suppressed' };
  }
  await finish({ status: 'failed', last_error: 'coaching_provider_outcome_unverified' });
  return { ok: false, status: 'held', reason: 'coaching_provider_outcome_unverified' };
}
