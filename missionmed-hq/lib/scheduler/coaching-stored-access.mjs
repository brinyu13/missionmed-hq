import { createHash } from 'node:crypto';

const ACTIVE = new Set(['held', 'booked', 'confirmed']);
const SAME = (a, b) => String(a ?? '') === String(b ?? '');
const SAFE = ['id','student_user_id','student_wp_user_id','appointment_type_id','provider_id','resource_id','schedule_event_id','start_at','end_at','status','timezone','created_at','updated_at','canceled_at'];
function metadata(row) { try { return typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : row?.metadata || {}; } catch { return {}; } }
export const isStoredCoachingType = type => String(type?.slug || '').startsWith('mr-coaching-') || Boolean(metadata(type).mr_coaching_service);

// Request/worker-scoped read and reconciliation seam. Never accepts a supplied
// student, paid flag, unit id or permission grant. All target facts are reloaded.
export function createCoachingStoredAccess({ repository, readWooAllowances, cleanupCoachingMeeting } = {}) {
  const cleanupResults = new Map();
  async function inspect(appointmentId) {
    let appointment;
    try {
      appointment = await repository.getAppointmentById(appointmentId);
      if (!appointment || !SAME(appointment.id, appointmentId)) return { coaching: null, state: 'unverified', appointment: null };
      const rows = await repository.listAppointmentTypes({ appointment_type_id: appointment.appointment_type_id });
      const type = rows.find(t => SAME(t.id, appointment.appointment_type_id));
      if (!type) return { coaching: null, state: 'unverified', appointment };
      if (!isStoredCoachingType(type)) return { coaching: false, state: 'legacy', appointment };
      if (appointment.deleted_at || ['canceled', 'cancelled'].includes(appointment.status)) {
        const usage = await repository.rpc('mm_coaching_hybrid_stored_usage', { p_payload: { appointment_id: appointment.id } });
        if (!SAME(usage?.appointment_id, appointment.id) || !SAME(usage.subject_user_id, appointment.student_user_id)
          || !SAME(usage.subject_wp_user_id, appointment.student_wp_user_id) || typeof usage.unit_id !== 'string') throw Error('stored_usage_unavailable');
        return { coaching: true, state: 'canceled', appointment, unit_id: usage.unit_id };
      }
      if (typeof readWooAllowances?.forStoredAppointment !== 'function') throw Error('stored_owner_reader_unavailable');
      const owned = await readWooAllowances.forStoredAppointment(repository, appointmentId);
      if (!SAME(owned.appointment?.id, appointmentId) || !SAME(owned.appointment.student_user_id, appointment.student_user_id)
        || !SAME(owned.appointment.student_wp_user_id, appointment.student_wp_user_id)) throw Error('stored_owner_changed');
      const receipt = owned.receipt;
      const model = await repository.rpc('mm_coaching_hybrid_read_model', { p_payload: {
        identity_source: 'native_scheduler_authenticated_actor', allowance_source: 'authenticated_server_woo_read',
        actor_user_id: appointment.student_user_id, actor_wp_user_id: appointment.student_wp_user_id,
        allowance_receipt: receipt,
        request_digest: createHash('sha256').update(`access:${appointmentId}:${receipt.request_id}`, 'utf8').digest('hex'),
      } });
      const services = (model?.packages || []).flatMap(p => (p.services || []).map(s => ({ ...s, package: p })))
        .filter(s => SAME(s.appointment_id, appointmentId));
      if (services.length !== 1 || typeof services[0].unit_id !== 'string') throw Error('exact_stored_usage_unavailable');
      const unit = services[0];
      const fresh = await repository.getAppointmentById(appointmentId);
      if (!fresh || !SAME(fresh.student_user_id, appointment.student_user_id) || !SAME(fresh.student_wp_user_id, appointment.student_wp_user_id)
        || !SAME(fresh.appointment_type_id, appointment.appointment_type_id)) throw Error('stored_owner_changed');
      if (fresh.deleted_at || ['canceled', 'cancelled'].includes(fresh.status)) return { coaching: true, state: 'canceled', appointment: fresh, unit_id: unit.unit_id };
      const currentMember = receipt.packages.some(p => p.order_id === unit.package.order_id && p.eligible_unit_ids.includes(unit.unit_id));
      if (typeof unit.booking_allowed !== 'boolean' || typeof unit.package.booking_allowed !== 'boolean'
        || unit.booking_allowed !== currentMember || (currentMember && unit.package.booking_allowed !== true)) throw Error('ambiguous_unit_eligibility');
      const eligible = unit.booking_allowed === true;
      return { coaching: true, state: eligible ? 'eligible' : 'revoked', appointment: fresh, unit_id: unit.unit_id, receipt };
    } catch {
      return { coaching: true, state: 'unverified', appointment: appointment || null };
    }
  }
  async function cleanup(access) {
    if (typeof cleanupCoachingMeeting !== 'function') return { ...access, cleanup: { ok: false, status: 'held', reason: 'coaching_cleanup_unavailable' } };
    const key = access.appointment.id;
    if (!cleanupResults.has(key)) cleanupResults.set(key, (async () => {
      try {
        const result = await cleanupCoachingMeeting({ appointment: access.appointment, unit_id: access.unit_id || null, reason: 'coaching_unit_revoked' });
        return result?.ok === true ? result : { ok: false, status: 'held', reason: 'coaching_cleanup_unverified' };
      } catch { return { ok: false, status: 'held', reason: 'coaching_cleanup_unverified' }; }
    })());
    return { ...access, cleanup: await cleanupResults.get(key) };
  }
  async function reconcile(appointmentId) {
    const access = await inspect(appointmentId);
    if (access.coaching !== true) return access;
    if (access.state === 'canceled') return cleanup(access);
    if (access.state !== 'revoked') return access;
    // Past/delivered history is immutable here. Provider recording/link cleanup
    // still applies to a positively revoked unit, without changing its history.
    if (!ACTIVE.has(access.appointment.status) || Date.parse(access.appointment.start_at) <= Date.now()) return cleanup(access);
    try {
      const result = await repository.rpc('mm_coaching_hybrid_revoke_appointment', { p_payload: {
        appointment_id: access.appointment.id, allowance_receipt: access.receipt,
      } });
      const actual = await repository.getAppointmentById(appointmentId);
      if (result?.ok !== true || !actual || !['canceled','cancelled'].includes(actual.status)
        || !SAME(actual.student_user_id, access.appointment.student_user_id) || !SAME(actual.student_wp_user_id, access.appointment.student_wp_user_id)) throw Error('revocation_unconfirmed');
      return cleanup({ ...access, appointment: actual, state: 'canceled' });
    } catch { return { ...access, state: 'unverified', cleanup: { ok: false, status: 'held', reason: 'coaching_revocation_unverified' } }; }
  }
  async function redactForStudent(appointments, actor) {
    const result = [];
    for (const original of appointments) {
      const access = await reconcile(original.id);
      if (!access.appointment || !SAME(access.appointment.student_user_id, actor.userId)) continue;
      // Legacy UUID ownership predates WP linkage; retain its existing exact row.
      if (access.coaching === false) { result.push(original); continue; }
      if (!SAME(access.appointment.student_wp_user_id, actor.wpUserId)) continue;
      if (access.state === 'eligible') { result.push(original); continue; }
      const safe = Object.fromEntries(SAFE.filter(k => Object.hasOwn(access.appointment, k)).map(k => [k, access.appointment[k]]));
      safe.coaching_access = { status: access.state, links_available: false, can_reschedule: false };
      result.push(safe);
    }
    return result;
  }
  return Object.freeze({ inspect, reconcile, redactForStudent,
    async getStoredCoachingAccess(appointment) {
      const access = await inspect(appointment?.id);
      return { coaching: access.coaching, eligibility: access.state === 'eligible' ? true : ['revoked','canceled'].includes(access.state) ? false : null,
        state: access.appointment?.status || null, access_state: access.state,
        appointment_id: access.appointment?.id || null, unit_id: access.unit_id || null,
        owner_user_id: access.appointment?.student_user_id || null, owner_wp_user_id: access.appointment?.student_wp_user_id || null };
    },
  });
}
