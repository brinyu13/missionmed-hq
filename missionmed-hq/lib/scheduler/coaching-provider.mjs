import { createHmac } from 'node:crypto';

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const UNIT = /^coaching-unit:v1:[1-9][0-9]*:[1-9][0-9]*:(mock|strategy|debrief):[1-9][0-9]*$/;
function deny() { const e = new Error('Coaching meeting access requires secure review.'); e.code = 'coaching_provider_access_unverified'; e.status = 503; throw e; }

/** Existing host + broker + HMAC only. All context is loaded from native stored
 * appointments and fresh Woo rights, never client-owned entitlement markers.
 */
export function createCoachingWebexProvider({ getStoredCoachingAccess, buildMeetingPayload,
  env = process.env, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  async function access(payload) {
    const id = payload?.appointment?.id || payload?.appointment_id || payload?.appointmentId;
    if (!UUID.test(id || '') || typeof getStoredCoachingAccess !== 'function') deny();
    const fact = await getStoredCoachingAccess({ id });
    if (!fact || fact.appointment_id !== id || !UNIT.test(fact.unit_id || '')) deny();
    return fact;
  }
  async function request(action, fact, extra = {}) {
    const base = String(env.MMHQ_WP_BASE || '').replace(/\/$/, '');
    const secret = env.MMHQ_HANDOFF_SECRET;
    if (base !== 'https://missionmedinstitute.com' || typeof secret !== 'string' || secret.length < 32
      || typeof fetchImpl !== 'function') deny();
    const body = JSON.stringify({ action, appointment_id: fact.appointment_id, unit_id: fact.unit_id, ...extra });
    const timestamp = String(Math.floor(now() / 1000));
    const signature = createHmac('sha256', secret).update(timestamp + '.' + body).digest('hex');
    let response; let data;
    try {
      response = await fetchImpl(base + '/wp-json/missionmed-scheduler/v1/coaching/webex', {
        method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store',
        signal: AbortSignal.timeout(20000), body,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json',
          'X-MM-Scheduler-Timestamp': timestamp, 'X-MM-Scheduler-Signature': signature,
          'X-MM-Scheduler-Source': 'missionmed-hq-scheduler' },
      });
      if (!response.ok || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '')
        || !response.body?.getReader) deny();
      const reader = response.body.getReader(); const chunks = []; let bytes = 0;
      try { for (;;) { const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength; if (bytes > 262144) { await reader.cancel(); deny(); }
        chunks.push(Buffer.from(part.value));
      } } finally { reader.releaseLock(); }
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (data?.ok !== true) deny();
    } catch { deny(); }
    return data;
  }
  function active(fact) {
    if (fact.eligibility !== true || !['booked','confirmed','completed'].includes(fact.state)) deny();
  }
  async function afterExternalRead(payload, original) {
    const after = await access(payload);
    if (after.unit_id !== original.unit_id) deny();
    if (after.eligibility === false || ['canceled','cancelled'].includes(after.state)) {
      await request('revoke', original); deny();
    }
    // Unknown is not revocation authority. Withhold links and require review.
    active(after);
  }
  return Object.freeze({
    async create(payload) {
      const fact = await access(payload); active(fact);
      if (fact.state === 'completed' || typeof buildMeetingPayload !== 'function') deny();
      const meeting = buildMeetingPayload(payload);
      const result = await request('create', fact, { meeting, invitee: {} });
      // Financial state can change while the external meeting is created. Do
      // not persist/issue its URL without another fresh entitlement check.
      await afterExternalRead(payload, fact);
      if (typeof result.meeting_url !== 'string' || !/^https:\/\//.test(result.meeting_url)
        || !/^[A-Za-z0-9_=-]{1,512}$/.test(result.external_event_id || '')) deny();
      return { ...result, provider: 'webex', status: 'created',
        invitee_email_sent: false, invitee_status: 'suppressed' };
    },
    async recordings(payload) {
      const fact = await access(payload); active(fact);
      const result = await request('recordings', fact);
      await afterExternalRead(payload, fact);
      if (!Array.isArray(result.recordings)) deny();
      return result;
    },
    async cleanup(payload) {
      const fact = await access(payload);
      // Unknown/failure is NOT proof of revocation. A positive native canceled
      // state or freshly proven ineligible unit authorizes own-resource cleanup.
      if (fact.eligibility !== false && !['canceled','cancelled'].includes(fact.state)) deny();
      const result = await request('revoke', fact);
      if (result.evidence?.meeting_absent !== true || !Array.isArray(result.evidence.recordings)
        || result.evidence.recordings.some(r => r.provider_absent !== true)) deny();
      return { ok: true, provider: 'webex', status: 'provider_resources_absent', cleanup_ok: true,
        evidence: result.evidence };
    },
  });
}
