import { assertProjectionEnvelope } from '../../ivoc/contracts/projection-envelope.mjs';

const MAX_RESPONSE_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 4_000;
const SUBJECT = /^wp:([1-9][0-9]{0,19})$/u;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const AUTHORIZATION = /^(?:Basic|Bearer) [^\r\n]{16,4096}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

function exactWordPressBase(value) {
  let parsed;
  try { parsed = new URL(String(value || '')); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  parsed.pathname = parsed.pathname.replace(/\/+$/u, '') || '/';
  return parsed;
}

function validatedProjection(value, { actor, sessionId }) {
  assertProjectionEnvelope(value);
  if (value.owner_app !== 'filevault'
      || value.projection_type !== 'filevault.document_projection'
      || value.schema_version !== '1'
      || value.subject_id !== actor
      || value.authorization?.basis !== 'student_consent'
      || value.authorization?.consent_ref !== `ivoc-session:${sessionId}`
      || value.payload?.kind !== 'cv'
      || !Array.isArray(value.payload?.entries)
      || !SHA256.test(String(value.payload?.content_hash || ''))
      || !SHA256.test(String(value.source_receipt?.hash || ''))) {
    throw new TypeError('ivoc_file_vault_projection_invalid');
  }
  return value;
}

export function createFileVaultCvProjectionSource({
  wordPressBase,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const base = exactWordPressBase(wordPressBase);
  if (!base) throw new TypeError('ivoc_file_vault_base_invalid');
  if (typeof fetchImpl !== 'function') throw new TypeError('ivoc_file_vault_fetch_required');
  const boundedTimeout = Math.max(250, Math.min(10_000, Math.trunc(Number(timeoutMs) || DEFAULT_TIMEOUT_MS)));

  return Object.freeze({
    async read({ actor, sessionId, authorization } = {}) {
      const subject = SUBJECT.exec(String(actor || ''));
      if (!subject || !SESSION_ID.test(String(sessionId || ''))) {
        throw new TypeError('ivoc_file_vault_identity_invalid');
      }
      if (!AUTHORIZATION.test(String(authorization || ''))) {
        throw new TypeError('ivoc_file_vault_authorization_required');
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort('ivoc_file_vault_timeout'), boundedTimeout);
      try {
        const url = new URL(`/wp-json/mmed/v2/file-vault/projections/ivoc/cv/${subject[1]}`, base);
        url.searchParams.set('session_id', sessionId);
        const response = await fetchImpl(url, {
          method: 'GET',
          redirect: 'error',
          cache: 'no-store',
          headers: {
            Authorization: authorization,
            'X-MMED-Consumer': 'ivoc',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`ivoc_file_vault_upstream_${response.status}`);
        const declaredBytes = Number(response.headers?.get?.('content-length'));
        if (Number.isFinite(declaredBytes) && declaredBytes > MAX_RESPONSE_BYTES) {
          throw new TypeError('ivoc_file_vault_projection_too_large');
        }
        const body = await response.text();
        if (!body || Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
          throw new TypeError('ivoc_file_vault_projection_too_large');
        }
        let projection;
        try { projection = JSON.parse(body); } catch { throw new TypeError('ivoc_file_vault_projection_invalid'); }
        return validatedProjection(projection, { actor, sessionId });
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

