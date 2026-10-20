import { randomUUID } from 'node:crypto';
import { createCoachingStoredAccess } from './coaching-stored-access.mjs';
import { createCoachingWebexProvider } from './coaching-provider.mjs';
import { dispatchCoachingNotification } from './coaching-notification-guard.mjs';
import { reconcileCoachingUsagePage } from './coaching-reconciliation.mjs';
import { webexMeetingPayload, emailMedMailNotificationAdapter, smsNotificationProviderAdapter } from './adapters.mjs';

let running = false;
const metadata = row => { try { return typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {}; } catch { return {}; } };
// One explicit tick; no timer, new service, secret, or ordinary queue dispatch.
// The existing HQ timer owner must keep this OFF until independent release.
export async function runCoachingMaintenance({ repository, readWooAllowances, schedulerAdapters = {}, env = process.env, fetchImpl = globalThis.fetch, limit = 5, now = Date.now } = {}) {
  if (running) return { status: 'skipped_overlap' };
  const status = repository?.status?.();
  if (status?.mode !== 'supabase_rest' || status.configured !== true || status.service_role_configured !== true || typeof repository.rpc !== 'function') return { status: 'held', reason: 'coaching_repository_unavailable' };
  running = true;
  const token = randomUUID(); let owned = false;
  const pageSize = Math.max(1, Math.min(5, Number(limit) || 5));
  const deadline = now() + 60_000;
  try {
    owned = await repository.rpc('mm_coaching_hybrid_claim_maintenance', { p_payload: { token } });
    if (owned !== true) return { status: 'skipped_lease' };
    const beforeEach = async () => now() < deadline && await repository.rpc('mm_coaching_hybrid_claim_maintenance', { p_payload: { token } }) === true;
    let provider;
    const access = createCoachingStoredAccess({ repository, readWooAllowances,
      cleanupCoachingMeeting: payload => schedulerAdapters.cleanupCoachingMeeting ? schedulerAdapters.cleanupCoachingMeeting(payload) : provider.cleanup(payload) });
    provider = schedulerAdapters.coachingWebexProvider || createCoachingWebexProvider({ getStoredCoachingAccess: access.getStoredCoachingAccess, buildMeetingPayload: webexMeetingPayload, env, fetchImpl });
    const reconciliation = await reconcileCoachingUsagePage({ repository, access, limit: pageSize, beforeEach, leaseToken: token });
    const due = await repository.rpc('mm_coaching_hybrid_due_notifications', { p_payload: { limit: pageSize, token } });
    if (!Array.isArray(due) || due.length > pageSize) throw Error('coaching_due_page_unverified');
    const notifications = [];
    for (const notification of due) {
      if (!await beforeEach()) break;
      const adapter = notification.channel === 'sms' ? schedulerAdapters.smsNotificationProviderAdapter || smsNotificationProviderAdapter
        : schedulerAdapters.emailMedMailNotificationAdapter || emailMedMailNotificationAdapter;
      const dispatched = await dispatchCoachingNotification({ repository, access, notification, send: (appointment, current) => {
        const meta = metadata(current);
        return adapter({ ...meta, appointment, appointment_id: appointment.id, appointmentId: appointment.id,
          notificationId: current.id, template_key: current.template_key, recipient_role: current.recipient_role,
          meeting_url: appointment.meeting_url || null, join_url: appointment.meeting_url || null,
          sms_opt_in: meta.sms_opt_in === true, to_phone: meta.to_phone || null, to_email: meta.recipient_email || null, queued: true });
      } });
      // Native due RPC is coaching-only. A classification mismatch is held;
      // this maintenance function NEVER falls back to ordinary dispatch.
      notifications.push({ id: notification.id, status: dispatched?.status || 'held' });
    }
    return { status: 'processed', reconciliation, notifications };
  } catch { return { status: 'held', reason: 'coaching_maintenance_unverified' }; }
  finally {
    if (owned) { try { await repository.rpc('mm_coaching_hybrid_release_maintenance', { p_payload: { token } }); } catch { /* TTL fails closed. */ } }
    running = false;
  }
}
