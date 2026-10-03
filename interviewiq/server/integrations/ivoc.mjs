import { createHash, createHmac, randomUUID } from 'node:crypto';
import { AppError } from '../errors.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA = /^[0-9a-f]{64}$/u;
const digest = value => createHash('sha256').update(value).digest('hex');
const error = (code = 'ivoc_owner_unavailable', status = 503) => new AppError(status, code, 'IV Prep On-Call could not verify this practice handoff. Your InterviewIQ work is saved.');
const exact = (object, fields) => object && typeof object === 'object' && !Array.isArray(object)
  && Object.keys(object).sort().join('|') === [...fields].sort().join('|');
function originOf(value) {
  let url; try { url = new URL(value); } catch { throw error('ivoc_configuration_invalid'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.hash || url.search) throw error('ivoc_configuration_invalid');
  return url.origin;
}
async function read(response) {
  if (!response.ok) throw error([401, 403].includes(response.status) ? 'ivoc_access_denied' : response.status === 409 ? 'ivoc_handoff_changed' : 'ivoc_owner_unavailable', [401, 403, 409].includes(response.status) ? response.status : 503);
  if (response.redirected || !response.headers.get('content-type')?.startsWith('application/json') || Number(response.headers.get('content-length')) > 16384) throw error('ivoc_response_invalid');
  const reader = response.body?.getReader(); if (!reader) throw error('ivoc_response_invalid');
  const chunks = []; let length = 0;
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > 16384) throw error('ivoc_response_invalid'); chunks.push(Buffer.from(value)); }
    const body = Buffer.concat(chunks).toString('utf8'); let value;
    try { value = JSON.parse(body); } catch { throw error('ivoc_response_invalid'); }
    return value;
  } finally { await reader.cancel().catch(() => {}); }
}

/** resolveActor must use the freshly authenticated server-only session context;
 * never accept browser body fields or persisted fixture identities as authority.
 * Returned five-field proof is never exposed in bootstrap/read models/logs.
 */
export function createIvocOwnerAdapter({ enabled = false, origin, wpOrigin, requestSecret,
  resolveActor, fetchImpl = fetch, now = Date.now } = {}) {
  if (!enabled) return Object.freeze({ available: false, launch: async () => { throw error(); }, result: async () => { throw error(); } });
  const base = originOf(origin); const returnOrigin = originOf(wpOrigin);
  if (typeof requestSecret !== 'string' || requestSecret.length < 32 || typeof resolveActor !== 'function') throw error('ivoc_configuration_invalid');
  async function call(actor, method, target, input) {
    const proof = await resolveActor(actor);
    if (!exact(proof, ['subject', 'wp_user_id', 'session_verifier', 'auth_role', 'auth_tier']) || !UUID.test(proof.subject)
      || !Number.isSafeInteger(proof.wp_user_id) || proof.wp_user_id < 1 || !SHA.test(proof.session_verifier)
      || proof.auth_role !== 'student' || !/^[a-z0-9_]{1,40}$/u.test(proof.auth_tier)) throw error('ivoc_access_denied', 403);
    const actorBytes = JSON.stringify(proof); const body = input == null ? '' : JSON.stringify(input);
    const timestamp = String(Math.floor(now() / 1000)); const nonce = randomUUID();
    const canonical = ['iiq-owner-v1', 'ivoc', timestamp, nonce, method, target, digest(body), digest(actorBytes)].join('\n');
    let response;
    try { response = await fetchImpl(`${base}${target}`, {
      method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}),
        'X-MMED-IIQ-Owner': 'ivoc', 'X-MMED-IIQ-Timestamp': timestamp, 'X-MMED-IIQ-Nonce': nonce,
        'X-MMED-IIQ-Actor': Buffer.from(actorBytes).toString('base64url'),
        'X-MMED-IIQ-Signature': createHmac('sha256', requestSecret).update(canonical).digest('hex') },
      ...(body ? { body } : {}),
    }); } catch { throw error(); }
    return read(response);
  }
  return Object.freeze({ available: true,
    async launch({ actor, input }) {
      if (!UUID.test(input?.interviewId) || !UUID.test(input?.requestId)) throw error('ivoc_handoff_invalid', 422);
      const value = await call(actor, 'POST', '/api/ivoc/v1/interviewiq/launches', input);
      if (!UUID.test(value?.launchId) || !['created', 'preparing', 'ready', 'error'].includes(value.status)) throw error('ivoc_response_invalid');
      if (value.status !== 'created') {
        if (!UUID.test(value.sessionId) || value.ticket !== null || value.launchUrl !== null) throw error('ivoc_response_invalid');
        return { launchId: value.launchId, sessionId: value.sessionId, status: value.status, launchUrl: null };
      }
      if (!/^[A-Za-z0-9_-]{43}$/u.test(value.ticket) || !Number.isFinite(Date.parse(value.expiresAt))
        || Date.parse(value.expiresAt) <= now() || Date.parse(value.expiresAt) > now() + 120000
        || value.launchUrl !== `${base}/iv-prep-on-call/#iiq/${value.launchId}/${value.ticket}`) throw error('ivoc_response_invalid');
      // The fragment contains a short-lived correlation ticket, never identity,
      // private context, auth bearer or signing material. Studio strips it.
      return { launchId: value.launchId, status: value.status, expiresAt: value.expiresAt, launchUrl: value.launchUrl };
    },
    async result({ actor, launchId, expected }) {
      if (!UUID.test(launchId) || !UUID.test(expected?.interviewId)) throw error('ivoc_handoff_invalid', 422);
      const value = await call(actor, 'GET', `/api/ivoc/v1/interviewiq/launches/${launchId}/result`);
      if (value?.schema !== 'interviewiq.ivoc.result.v1' || value.launchId !== launchId || value.requiresStudentConfirmation !== true
        || !['pending', 'partial', 'error', 'completed'].includes(value.status)
        || !['interviewId', 'programSpecialtyId', 'registryReleaseId', 'questionId'].every(key => value[key] === expected[key])
        || (expected.confirmedGoal === null ? value.confirmedGoal !== null
          : !exact(value.confirmedGoal, ['id', 'version', 'text']) || !['id', 'version', 'text'].every(key => value.confirmedGoal[key] === expected.confirmedGoal?.[key]))
        || (value.sessionId !== null && !UUID.test(value.sessionId))
        || (expected.sessionId != null && value.sessionId !== expected.sessionId)
        || value.returnUrl !== `${returnOrigin}/interviewiq/#interview/${expected.interviewId}`
        || !Array.isArray(value.observations) || value.observations.length > 3) throw error('ivoc_result_binding_invalid');
      const observations = value.observations.map(item => {
        if (!exact(item, ['text', 'facet', 'polarity', 'basis']) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 500
          || !['structure', 'evidence', 'specificity', 'concision'].includes(item.facet) || !['strength', 'weakness'].includes(item.polarity)
          || item.basis !== 'source-bound-ai-draft') throw error('ivoc_response_invalid');
        return { ...item };
      });
      if ((value.status === 'completed' && (!SHA.test(value.sourceVersion) || !UUID.test(value.sessionId)))
        || (value.status !== 'completed' && (observations.length || value.nextChange !== null || value.summary !== null || value.sourceVersion !== null))
        || (value.nextChange !== null && !observations.some(item => item.polarity === 'weakness' && item.text === value.nextChange))) throw error('ivoc_response_invalid');
      return { launchId, interviewId: value.interviewId, sessionId: value.sessionId, status: value.status,
        sourceVersion: value.sourceVersion, observations, nextChange: value.nextChange, requiresStudentConfirmation: true };
    },
  });
}
