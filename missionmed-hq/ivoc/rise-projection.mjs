import { assertProjectionEnvelope } from '../../ivoc/contracts/projection-envelope.mjs';

const MAX_RESPONSE_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 4_000;
const SUBJECT = /^wp:([1-9][0-9]{0,19})$/u;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const COOKIE_NAME = /^[A-Za-z0-9_-]{1,64}$/u;
const COOKIE_VALUE = /^[A-Za-z0-9%._~+/=-]{16,8192}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const PERSON_ROLES = new Set(['Program Director', 'Associate Program Director', 'Chief Resident', 'Faculty']);

function exactBase(value) {
  let parsed;
  try { parsed = new URL(String(value || '')); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  parsed.pathname = parsed.pathname.replace(/\/+$/u, '') || '/';
  return parsed;
}

function boundedText(value, maximum) {
  return typeof value === 'string' && value.trim() && value.length <= maximum;
}

function validateProjection(value, { actor, sessionId, programId }) {
  assertProjectionEnvelope(value);
  const payload = value.payload;
  if (value.owner_app !== 'rise'
      || value.projection_type !== 'rise.program_cheat_sheet'
      || value.schema_version !== '1'
      || value.subject_id !== actor
      || value.authorization?.basis !== 'owner_policy'
      || value.authorization?.consent_ref !== `ivoc-session:${sessionId}`
      || payload?.program_id !== programId
      || !boundedText(payload?.name, 240)
      || !Array.isArray(payload?.high_yield_facts) || payload.high_yield_facts.length > 8
      || !Array.isArray(payload?.people) || payload.people.length > 4
      || !SHA256.test(String(value.source_receipt?.hash || ''))
      || value.minimization?.fields_excluded_reason?.people_names !== 'not required by the initial IVOC Actor projection') {
    throw new TypeError('ivoc_rise_projection_invalid');
  }
  for (const fact of payload.high_yield_facts) {
    if (!boundedText(fact?.fact, 640) || !boundedText(fact?.source_ref, 2_048)
        || (fact?.as_of != null && !boundedText(fact.as_of, 40))) {
      throw new TypeError('ivoc_rise_projection_invalid');
    }
  }
  for (const person of payload.people) {
    const keys = Object.keys(person || {}).sort();
    if (!PERSON_ROLES.has(person?.role) || !boundedText(person?.source_ref, 2_048)
        || (person?.as_of != null && !boundedText(person.as_of, 40))
        || keys.some((key) => !['as_of', 'role', 'source_ref'].includes(key))) {
      throw new TypeError('ivoc_rise_projection_invalid');
    }
  }
  return value;
}

export function createRiseProgramProjectionSource({
  riseBase,
  sessionCookieName = 'mmhq_session',
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const base = exactBase(riseBase);
  if (!base) throw new TypeError('ivoc_rise_base_invalid');
  if (!COOKIE_NAME.test(String(sessionCookieName || ''))) throw new TypeError('ivoc_rise_cookie_name_invalid');
  if (typeof fetchImpl !== 'function') throw new TypeError('ivoc_rise_fetch_required');
  const boundedTimeout = Math.max(250, Math.min(10_000, Math.trunc(Number(timeoutMs) || DEFAULT_TIMEOUT_MS)));

  return Object.freeze({
    async read({ actor, sessionId, sessionCookie, programId, registryReleaseId } = {}) {
      if (!SUBJECT.test(String(actor || '')) || !SESSION_ID.test(String(sessionId || ''))
          || !OPAQUE_ID.test(String(programId || '')) || !OPAQUE_ID.test(String(registryReleaseId || ''))) {
        throw new TypeError('ivoc_rise_identity_invalid');
      }
      const expectedPrefix = `${sessionCookieName}=`;
      const cookie = String(sessionCookie || '');
      if (!cookie.startsWith(expectedPrefix) || !COOKIE_VALUE.test(cookie.slice(expectedPrefix.length))) {
        throw new TypeError('ivoc_rise_authorization_required');
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort('ivoc_rise_timeout'), boundedTimeout);
      try {
        const url = new URL(`/api/rise/v1/ivoc/program-projections/${encodeURIComponent(programId)}`, base);
        url.searchParams.set('session_id', sessionId);
        url.searchParams.set('release_id', registryReleaseId);
        const response = await fetchImpl(url, {
          method: 'GET', redirect: 'error', cache: 'no-store',
          headers: { Cookie: cookie, 'X-MMED-Consumer': 'ivoc', Accept: 'application/json' },
          signal: controller.signal,
        });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`ivoc_rise_upstream_${response.status}`);
        const declaredBytes = Number(response.headers?.get?.('content-length'));
        if (Number.isFinite(declaredBytes) && declaredBytes > MAX_RESPONSE_BYTES) {
          throw new TypeError('ivoc_rise_projection_too_large');
        }
        const body = await response.text();
        if (!body || Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
          throw new TypeError('ivoc_rise_projection_too_large');
        }
        let projection;
        try { projection = JSON.parse(body); } catch { throw new TypeError('ivoc_rise_projection_invalid'); }
        return validateProjection(projection, { actor, sessionId, programId });
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
