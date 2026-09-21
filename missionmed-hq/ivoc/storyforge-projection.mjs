import { assertProjectionEnvelope } from '../../ivoc/contracts/projection-envelope.mjs';

const MAX_TOKEN_RESPONSE_BYTES = 16 * 1024;
const MAX_PROJECTION_RESPONSE_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 4_000;
const SUBJECT = /^wp:([1-9][0-9]{0,19})$/u;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const AUTHORIZATION = /^(?:Basic|Bearer) [^\r\n]{16,4096}$/u;
const JWT = /^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,2048}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function exactWordPressBase(value) {
  let parsed;
  try { parsed = new URL(String(value || '')); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  parsed.pathname = parsed.pathname.replace(/\/+$/u, '') || '/';
  return parsed;
}

async function readBoundedJson(response, maximum, tooLargeCode, invalidCode) {
  const declaredBytes = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > maximum) throw new TypeError(tooLargeCode);
  const body = await response.text();
  if (!body || Buffer.byteLength(body, 'utf8') > maximum) throw new TypeError(tooLargeCode);
  try { return JSON.parse(body); } catch { throw new TypeError(invalidCode); }
}

function validatedToken(value) {
  const token = String(value?.token || '');
  const ttlSeconds = Number(value?.ttl_seconds);
  const expiresAt = Number(value?.expires_at);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!JWT.test(token) || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 5 || ttlSeconds > 300
      || !Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds || expiresAt > nowSeconds + 360) {
    throw new TypeError('ivoc_storyforge_token_invalid');
  }
  return token;
}

function boundedText(value, maximum) {
  return typeof value === 'string' && value.trim() && value.length <= maximum;
}

function validatedProjection(value, actor) {
  assertProjectionEnvelope(value);
  const stories = value.payload?.stories;
  if (value.owner_app !== 'storyforge'
      || value.projection_type !== 'storyforge.approved_stories'
      || value.schema_version !== '1'
      || value.subject_id !== actor
      || value.authorization?.basis !== 'student_consent'
      || !boundedText(value.authorization?.consent_ref, 200)
      || !Array.isArray(stories) || !stories.length || stories.length > 12
      || !SHA256.test(String(value.source_receipt?.hash || ''))) {
    throw new TypeError('ivoc_storyforge_projection_invalid');
  }
  for (const story of stories) {
    const summaryWords = String(story?.summary || '').trim().split(/\s+/u).filter(Boolean);
    if (!UUID.test(String(story?.story_id || ''))
        || !boundedText(story?.version, 40)
        || story?.consent_state !== 'granted'
        || !boundedText(story?.title, 160)
        || !boundedText(story?.summary, 1200)
        || summaryWords.length > 60
        || !Array.isArray(story?.themes) || story.themes.length > 12
        || story.themes.some((item) => !boundedText(item, 80))) {
      throw new TypeError('ivoc_storyforge_projection_invalid');
    }
  }
  return value;
}

export function createStoryForgeProjectionSource({
  wordPressBase,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const base = exactWordPressBase(wordPressBase);
  if (!base) throw new TypeError('ivoc_storyforge_base_invalid');
  if (typeof fetchImpl !== 'function') throw new TypeError('ivoc_storyforge_fetch_required');
  const boundedTimeout = Math.max(250, Math.min(10_000, Math.trunc(Number(timeoutMs) || DEFAULT_TIMEOUT_MS)));

  return Object.freeze({
    async read({ actor, sessionId, authorization } = {}) {
      if (!SUBJECT.test(String(actor || '')) || !SESSION_ID.test(String(sessionId || ''))) {
        throw new TypeError('ivoc_storyforge_identity_invalid');
      }
      if (!AUTHORIZATION.test(String(authorization || ''))) {
        throw new TypeError('ivoc_storyforge_authorization_required');
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort('ivoc_storyforge_timeout'), boundedTimeout);
      try {
        const tokenResponse = await fetchImpl(new URL('/wp-json/missionmed/v1/storyforge/ivoc-token', base), {
          method: 'POST',
          redirect: 'error',
          cache: 'no-store',
          headers: {
            Authorization: authorization,
            'X-MMED-Consumer': 'ivoc',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        if (!tokenResponse.ok) throw new Error(`ivoc_storyforge_token_upstream_${tokenResponse.status}`);
        const token = validatedToken(await readBoundedJson(
          tokenResponse, MAX_TOKEN_RESPONSE_BYTES,
          'ivoc_storyforge_token_too_large', 'ivoc_storyforge_token_invalid',
        ));
        const projectionResponse = await fetchImpl(new URL('/storyforge/api/ivoc/projection', base), {
          method: 'GET',
          redirect: 'error',
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: controller.signal,
        });
        if (projectionResponse.status === 404) return null;
        if (!projectionResponse.ok) throw new Error(`ivoc_storyforge_projection_upstream_${projectionResponse.status}`);
        const projection = await readBoundedJson(
          projectionResponse, MAX_PROJECTION_RESPONSE_BYTES,
          'ivoc_storyforge_projection_too_large', 'ivoc_storyforge_projection_invalid',
        );
        return validatedProjection(projection, actor);
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
