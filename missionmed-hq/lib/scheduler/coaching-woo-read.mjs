import { randomBytes } from 'node:crypto';
import { getSchedulerActor } from './auth.mjs';

const URL = 'https://missionmedinstitute.com/wp-json/mmed-coaching/v1/allowances';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const COUNT = { single: { mock: 1 }, three: { strategy: 1, mock: 3, debrief: 2 }, five: { strategy: 1, mock: 5, debrief: 3 } };
const MINUTES = { strategy: 120, mock: 105, debrief: 45 };
const positive = n => Number.isSafeInteger(n) && n > 0;
const plain = o => o && typeof o === 'object' && !Array.isArray(o);
const exact = (o, keys) => plain(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
function deny() { const e = new Error('Coaching access could not be verified.'); e.code = 'coaching_woo_allowances_unavailable'; e.status = 503; throw e; }

/** Read only. Existing service credentials are injected by server.mjs, never
 * supplied by a student request. No cross-request cache or financial mutation.
 * A successful read is an allowance snapshot, NOT an atomic refund/booking lock.
 */
export function createWooCoachingAllowanceReader({ getServiceHeaders, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  async function readForActor(actor) {
    if (!UUID.test(actor?.userId || '') || !positive(actor?.wpUserId) || typeof getServiceHeaders !== 'function' || typeof fetchImpl !== 'function') deny();
    let supplied;
    try { supplied = await getServiceHeaders(); } catch { deny(); }
    // Never forward cookies, arbitrary headers, a student token or browser data.
    const authorization = supplied?.Authorization;
    if (typeof authorization !== 'string' || !/^Basic [A-Za-z0-9+/]+=*$/.test(authorization)
      || authorization.length > 4096 || Object.keys(supplied).some(k => k.toLowerCase() !== 'authorization')) deny();
    const requestId = randomBytes(24).toString('hex');
    const requestedAt = Math.floor(now() / 1000);
    if (!positive(requestedAt)) deny();
    let response; let data;
    try {
      response = await fetchImpl(URL, { method: 'POST', redirect: 'error', credentials: 'omit',
        cache: 'no-store', signal: AbortSignal.timeout(7000),
        headers: { Authorization: authorization, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, subject_wp_user_id: actor.wpUserId, subject_user_id: actor.userId }),
      });
      if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')
        || Number(response.headers.get('content-length')) > 131072 || !response.body?.getReader) deny();
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 131072) { await reader.cancel(); deny(); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { deny(); }
    const current = Math.floor(now() / 1000);
    if (!positive(current) || current < requestedAt) deny();
    if (!exact(data, ['schema','request_id','subject_wp_user_id','subject_user_id','checked_at','valid_until','complete','packages'])
      || data.schema !== 'missionmed.coaching.allowances.v1' || data.request_id !== requestId
      || data.subject_wp_user_id !== actor.wpUserId || data.subject_user_id !== actor.userId
      || !Number.isSafeInteger(data.checked_at) || data.checked_at < requestedAt - 1 || data.checked_at > current + 1
      || current - data.checked_at > 15 || data.valid_until !== data.checked_at + 15 || current >= data.valid_until
      || data.complete !== true || !Array.isArray(data.packages) || data.packages.length > 100) deny();
    const orders = new Set(); const items = new Set(); const unitIds = new Set();
    for (const p of data.packages) {
      if (!exact(p, ['order_id','order_item_id','product_id','sku','snapshot_digest','eligibility_revision','units','eligible_unit_ids'])
        || !positive(p.order_id) || !positive(p.order_item_id) || !positive(p.product_id)
        || !Object.hasOwn(COUNT, p.sku) || !HASH.test(p.snapshot_digest) || !positive(p.eligibility_revision)
        || orders.has(p.order_id) || items.has(p.order_item_id) || !Array.isArray(p.units) || !Array.isArray(p.eligible_unit_ids)) deny();
      orders.add(p.order_id); items.add(p.order_item_id);
      const expected = COUNT[p.sku]; const seen = new Set();
      for (const u of p.units) {
        if (!exact(u, ['unit_id','order_id','order_item_id','owner_wp_user_id','product_id','sku','service','ordinal','duration_minutes','snapshot_digest'])
          || u.order_id !== p.order_id || u.order_item_id !== p.order_item_id || u.product_id !== p.product_id
          || u.owner_wp_user_id !== actor.wpUserId || u.sku !== p.sku || u.snapshot_digest !== p.snapshot_digest
          || !Object.hasOwn(expected, u.service) || !positive(u.ordinal) || u.ordinal > expected[u.service]
          || u.duration_minutes !== MINUTES[u.service]
          || u.unit_id !== `coaching-unit:v1:${p.order_id}:${p.order_item_id}:${u.service}:${u.ordinal}`
          || seen.has(u.unit_id) || unitIds.has(u.unit_id)) deny();
        seen.add(u.unit_id); unitIds.add(u.unit_id);
      }
      if (p.units.length !== Object.values(expected).reduce((a,b) => a+b,0)
        || p.eligible_unit_ids.some(id => typeof id !== 'string' || !seen.has(id))
        || new Set(p.eligible_unit_ids).size !== p.eligible_unit_ids.length) deny();
    }
    // No credentials, bank evidence or browser-owned grants survive this return.
    return data;
  }
  const readAllowances = async session => {
    const resolved = getSchedulerActor(session, 'student');
    if (!resolved.ok || resolved.actor?.supabaseIdentityConfirmed !== true) deny();
    return readForActor(resolved.actor);
  };
  // Server-only method. Subject is reloaded from native persistence, never a
  // caller-supplied student UUID, WordPress id, receipt or synthetic session.
  readAllowances.forStoredAppointment = async (repository, appointmentId) => {
    const status = repository?.status?.();
    if (!UUID.test(appointmentId || '') || status?.mode !== 'supabase_rest'
      || status.configured !== true || status.service_role_configured !== true
      || typeof repository.getAppointmentById !== 'function') deny();
    const appointment = await repository.getAppointmentById(appointmentId);
    if (!appointment || appointment.id !== appointmentId || !UUID.test(appointment.student_user_id || '')
      || !positive(appointment.student_wp_user_id)) deny();
    const receipt = await readForActor({ userId: appointment.student_user_id, wpUserId: appointment.student_wp_user_id });
    return { appointment, receipt };
  };
  return readAllowances;
}
