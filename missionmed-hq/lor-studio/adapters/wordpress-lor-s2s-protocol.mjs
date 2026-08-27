import {
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';

export const WORDPRESS_LOR_AUDIENCE = 'lor-studio';
export const WORDPRESS_LOR_S2S_KEY_DOMAIN = 'missionmed.lor.s2s.key.v1';
export const WORDPRESS_LOR_S2S_REQUEST_DOMAIN = 'missionmed.lor.s2s.request.v1';
export const WORDPRESS_LOR_BOOTSTRAP_REDEEM_PATH =
  '/wp-json/missionmed/v1/lor-studio/bootstrap/redeem';
export const WORDPRESS_LOR_ADMISSION_PATH =
  '/wp-json/missionmed/v1/lor-studio/current-user-admission';
export const WORDPRESS_LOR_BINDING_REVOCATION_PATH =
  '/wp-json/missionmed/v1/lor-studio/binding/revoke';
export const WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PATH =
  '/wp-json/missionmed/v1/lor-studio/resource-student-entitlement';
export const WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_PATH =
  '/wp-json/missionmed/v1/lor-studio/resource-student-entitlement/probe';
export const WORDPRESS_LOR_BOOTSTRAP_REQUEST_CONTRACT =
  'missionmed.lor.wordpress-bootstrap-redemption-request.v2';
export const WORDPRESS_LOR_BOOTSTRAP_RESPONSE_CONTRACT =
  'missionmed.lor.wordpress-bootstrap-redemption.v2';
export const WORDPRESS_LOR_ADMISSION_REQUEST_CONTRACT =
  'missionmed.lor.wordpress-admission-request.v2';
export const WORDPRESS_LOR_ADMISSION_CONTRACT =
  'missionmed.lor.wordpress-admission.v3';
export const WORDPRESS_LOR_BINDING_REVOCATION_REQUEST_CONTRACT =
  'missionmed.lor.wordpress-binding-revocation-request.v2';
export const WORDPRESS_LOR_BINDING_REVOCATION_CONTRACT =
  'missionmed.lor.wordpress-binding-revocation.v2';
export const WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_REQUEST_CONTRACT =
  'missionmed.lor.wordpress-resource-student-entitlement-request.v1';
export const WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_CONTRACT =
  'missionmed.lor.wordpress-resource-student-entitlement.v1';
export const WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_REQUEST_CONTRACT =
  'missionmed.lor.wordpress-resource-student-entitlement-probe-request.v1';
export const WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_CONTRACT =
  'missionmed.lor.wordpress-resource-student-entitlement-probe.v1';
export const WORDPRESS_LOR_BINDING_PROVENANCE =
  'wordpress_lor_s2s_binding';
export const WORDPRESS_LOR_STUDENT_IDENTITY_CLASS = 'student';
export const WORDPRESS_LOR_FACULTY_CANDIDATE_IDENTITY_CLASS = 'faculty_candidate';
export const WORDPRESS_LOR_RESOURCE_ENTITLEMENT_PRODUCER =
  'WORDPRESS_RESOURCE_ADMISSION_V1_SIGNED_S2S';

const SUBJECT_PATTERN = /^wp:[1-9][0-9]*$/u;
const CODE_PATTERN = /^lorc1_[A-Za-z0-9_-]{43}$/u;
const STATE_HASH_PATTERN = /^[a-f0-9]{64}$/u;
const BINDING_PATTERN = /^lorb1_[A-Za-z0-9_-]{43}$/u;
const NONCE_PATTERN = /^lorn1_[A-Za-z0-9_-]{43}$/u;
const HEX_SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UTC_INSTANT_PATTERN =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u;
const JSON_CONTENT_TYPE_PATTERN = /^application\/json(?:\s*;\s*charset=utf-8)?$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 8_192;
const DEFAULT_TRANSPORT_TIMEOUT_MS = 5_000;
const MAXIMUM_BINDING_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const MAXIMUM_RECEIPT_LIFETIME_MS = 5 * 60 * 1_000;
const CLOCK_SKEW_MS = 30_000;
const LOR_CALLBACK_PATH = '/api/lor-studio/auth/callback';
const IDENTITY_CLASSES = new Set([
  WORDPRESS_LOR_STUDENT_IDENTITY_CLASS,
  WORDPRESS_LOR_FACULTY_CANDIDATE_IDENTITY_CLASS,
]);
const RESOURCE_ACTOR_ROLES = new Set(['faculty', 'mentor']);

const BOOTSTRAP_RESPONSE_KEYS = new Set([
  'contract',
  'audience',
  'subject',
  'bindingId',
  'bindingExpiresAt',
  'identityClass',
  'receipt',
]);
const RECEIPT_KEYS = new Set([
  'contract',
  'subject',
  'identityClass',
  'admitted',
  'evaluatedAt',
  'expiresAt',
]);
const REVOCATION_KEYS = new Set([
  'contract',
  'audience',
  'subject',
  'bindingId',
  'identityClass',
  'revoked',
  'revokedAt',
]);
const RESOURCE_ENTITLEMENT_KEYS = new Set([
  'contract',
  'audience',
  'requesterSubject',
  'actorRole',
  'studentId',
  'active',
  'tier',
  'lorEnabled',
  'revoked',
  'canaryEnabled',
  'canaryConsented',
  'producerStatus',
  'metadataOnly',
  'evaluatedAt',
  'expiresAt',
]);
const RESOURCE_ENTITLEMENT_PROBE_KEYS = new Set([
  'contract',
  'audience',
  'ready',
  'metadataOnly',
  'producerStatus',
  'evaluatedAt',
  'expiresAt',
]);

export class WordPressLorS2sProtocolError extends Error {
  constructor(code) {
    super(`WordPress LOR S2S protocol failed: ${code}`);
    this.name = 'WordPressLorS2sProtocolError';
    this.code = code;
  }
}

function fail(code) {
  throw new WordPressLorS2sProtocolError(code);
}

function isPlainRecord(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, expected) {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function exactPattern(value, pattern, code) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code);
  return value;
}

function exactSubject(value) {
  const subject = exactPattern(value, SUBJECT_PATTERN, 'SUBJECT_INVALID');
  const identifier = Number(subject.slice(3));
  if (!Number.isSafeInteger(identifier) || identifier <= 0) fail('SUBJECT_INVALID');
  return subject;
}

function exactIdentityClass(value) {
  if (typeof value !== 'string' || !IDENTITY_CLASSES.has(value)) {
    fail('IDENTITY_CLASS_INVALID');
  }
  return value;
}

function exactResourceActorRole(value) {
  if (typeof value !== 'string' || !RESOURCE_ACTOR_ROLES.has(value)) {
    fail('RESOURCE_ACTOR_ROLE_INVALID');
  }
  return value;
}

function exactInstant(value, code) {
  const instant = exactPattern(value, UTC_INSTANT_PATTERN, code);
  const milliseconds = Date.parse(instant);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== instant) fail(code);
  return milliseconds;
}

function exactHttpsOrigin(value) {
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || value.length > 512
    || CONTROL_CHARACTER_PATTERN.test(value)
  ) fail('ORIGIN_INVALID');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail('ORIGIN_INVALID');
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.pathname !== '/'
    || parsed.search !== ''
    || parsed.hash !== ''
    || parsed.origin !== value
  ) fail('ORIGIN_INVALID');
  return parsed.origin;
}

function exactCallback(value) {
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || value.length > 2_048
    || CONTROL_CHARACTER_PATTERN.test(value)
  ) fail('CALLBACK_INVALID');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail('CALLBACK_INVALID');
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.hash !== ''
    || parsed.pathname !== LOR_CALLBACK_PATH
    || parsed.searchParams.get('audience') !== WORDPRESS_LOR_AUDIENCE
    || !STATE_HASH_PATTERN.test(parsed.searchParams.get('state') ?? '')
  ) fail('CALLBACK_INVALID');
  const keys = [...parsed.searchParams.keys()];
  if (keys.length !== 2 || new Set(keys).size !== 2) fail('CALLBACK_INVALID');
  return parsed.toString();
}

function exactSharedSecret(value) {
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || Buffer.byteLength(value, 'utf8') < 32
    || Buffer.byteLength(value, 'utf8') > 4_096
    || CONTROL_CHARACTER_PATTERN.test(value)
  ) fail('SHARED_SECRET_UNAVAILABLE');
  return value;
}

function nowMilliseconds(clock) {
  const raw = clock();
  const milliseconds = raw instanceof Date ? raw.getTime() : Number(raw);
  if (!Number.isFinite(milliseconds)) fail('CLOCK_INVALID');
  return milliseconds;
}

function exactNonceFactory(nonceFactory) {
  if (typeof nonceFactory !== 'function') fail('NONCE_FACTORY_INVALID');
  return () => exactPattern(nonceFactory(), NONCE_PATTERN, 'NONCE_INVALID');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createWordPressLorAuthState(randomBytesImplementation = randomBytes) {
  if (typeof randomBytesImplementation !== 'function') fail('RANDOM_SOURCE_INVALID');
  const bytes = randomBytesImplementation(32);
  if (!Buffer.isBuffer(bytes) || bytes.length !== 32) fail('RANDOM_SOURCE_INVALID');
  return sha256(bytes);
}

export function createWordPressLorRequestNonce(randomBytesImplementation = randomBytes) {
  if (typeof randomBytesImplementation !== 'function') fail('RANDOM_SOURCE_INVALID');
  const bytes = randomBytesImplementation(32);
  if (!Buffer.isBuffer(bytes) || bytes.length !== 32) fail('RANDOM_SOURCE_INVALID');
  return `lorn1_${bytes.toString('base64url')}`;
}

export function deriveWordPressLorS2sKey(sharedSecret) {
  return createHmac('sha256', exactSharedSecret(sharedSecret))
    .update(WORDPRESS_LOR_S2S_KEY_DOMAIN, 'utf8')
    .digest();
}

export function canonicalWordPressLorRequest({ method, path, timestamp, nonce, rawBody }) {
  if (method !== 'POST') fail('METHOD_INVALID');
  if (![
    WORDPRESS_LOR_BOOTSTRAP_REDEEM_PATH,
    WORDPRESS_LOR_ADMISSION_PATH,
    WORDPRESS_LOR_BINDING_REVOCATION_PATH,
    WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PATH,
    WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_PATH,
  ].includes(path)) {
    fail('PATH_INVALID');
  }
  if (typeof timestamp !== 'string' || !/^(?:0|[1-9][0-9]{0,12})$/u.test(timestamp)) {
    fail('TIMESTAMP_INVALID');
  }
  exactPattern(nonce, NONCE_PATTERN, 'NONCE_INVALID');
  if (typeof rawBody !== 'string' || rawBody.length < 2 || rawBody.length > 4_096) {
    fail('BODY_INVALID');
  }
  const bodyHash = sha256(Buffer.from(rawBody, 'utf8'));
  if (!HEX_SHA256_PATTERN.test(bodyHash)) fail('BODY_INVALID');
  return [
    WORDPRESS_LOR_S2S_REQUEST_DOMAIN,
    method,
    path,
    bodyHash,
    timestamp,
    nonce,
    WORDPRESS_LOR_AUDIENCE,
  ].join('\n');
}

export function signWordPressLorRequest({ sharedSecret, method, path, timestamp, nonce, rawBody }) {
  const canonical = canonicalWordPressLorRequest({ method, path, timestamp, nonce, rawBody });
  const digest = createHmac('sha256', deriveWordPressLorS2sKey(sharedSecret))
    .update(canonical, 'utf8')
    .digest('hex');
  return `v1=${digest}`;
}

async function readResponseBody(response, maximumBytes) {
  const rawLength = response?.headers?.get?.('content-length');
  if (rawLength !== null && rawLength !== undefined && rawLength !== '') {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(rawLength)) fail('RESPONSE_HEADERS_INVALID');
    const length = Number(rawLength);
    if (!Number.isSafeInteger(length) || length > maximumBytes) fail('RESPONSE_TOO_LARGE');
  }
  const reader = response?.body?.getReader?.();
  if (!reader || typeof reader.read !== 'function') fail('RESPONSE_INVALID');
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (!next || typeof next !== 'object') fail('RESPONSE_INVALID');
      if (next.done === true) break;
      if (!(next.value instanceof Uint8Array)) fail('RESPONSE_INVALID');
      total += next.value.byteLength;
      if (total > maximumBytes) fail('RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(next.value));
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* best-effort bounded cancellation */ }
    throw error;
  } finally {
    try { reader.releaseLock?.(); } catch { /* transport detail is never surfaced */ }
  }
  if (total < 2) fail('RESPONSE_INVALID');
  try {
    return JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
  } catch {
    fail('RESPONSE_INVALID');
  }
}

/**
 * @param {unknown} rawReceipt
 * @param {{ subject: string, identityClass: string, now: number, maximumLifetimeMs?: number }} options
 */
export function assertWordPressLorAdmissionReceipt(rawReceipt, {
  subject,
  identityClass,
  now,
  maximumLifetimeMs = MAXIMUM_RECEIPT_LIFETIME_MS,
}) {
  const expectedSubject = exactSubject(subject);
  const expectedIdentityClass = exactIdentityClass(identityClass);
  if (!hasExactKeys(rawReceipt, RECEIPT_KEYS)) fail('RECEIPT_INVALID');
  const receipt = /** @type {Record<string, any>} */ (rawReceipt);
  if (
    receipt.contract !== WORDPRESS_LOR_ADMISSION_CONTRACT
    || receipt.subject !== expectedSubject
    || receipt.identityClass !== expectedIdentityClass
    || receipt.admitted !== true
  ) fail('RECEIPT_DENIED');
  const evaluatedAt = exactInstant(receipt.evaluatedAt, 'RECEIPT_TIME_INVALID');
  const expiresAt = exactInstant(receipt.expiresAt, 'RECEIPT_TIME_INVALID');
  if (
    !Number.isFinite(now)
    || !Number.isSafeInteger(maximumLifetimeMs)
    || maximumLifetimeMs < 30_000
    || maximumLifetimeMs > 15 * 60 * 1_000
    || evaluatedAt > now + CLOCK_SKEW_MS
    || evaluatedAt < now - maximumLifetimeMs
    || expiresAt <= now
    || expiresAt <= evaluatedAt
    || expiresAt - evaluatedAt > maximumLifetimeMs
  ) fail('RECEIPT_TIME_INVALID');
  return Object.freeze({ ...receipt });
}

function assertBootstrapResponse(raw, { identityClass, now }) {
  const expectedIdentityClass = exactIdentityClass(identityClass);
  if (!hasExactKeys(raw, BOOTSTRAP_RESPONSE_KEYS)) fail('BOOTSTRAP_RESPONSE_INVALID');
  if (
    raw.contract !== WORDPRESS_LOR_BOOTSTRAP_RESPONSE_CONTRACT
    || raw.audience !== WORDPRESS_LOR_AUDIENCE
    || raw.identityClass !== expectedIdentityClass
  ) fail('BOOTSTRAP_RESPONSE_INVALID');
  const subject = exactSubject(raw.subject);
  const bindingId = exactPattern(raw.bindingId, BINDING_PATTERN, 'BOOTSTRAP_RESPONSE_INVALID');
  const bindingExpiresAt = exactInstant(raw.bindingExpiresAt, 'BOOTSTRAP_RESPONSE_INVALID');
  if (bindingExpiresAt <= now || bindingExpiresAt - now > MAXIMUM_BINDING_LIFETIME_MS) {
    fail('BOOTSTRAP_RESPONSE_INVALID');
  }
  const receipt = assertWordPressLorAdmissionReceipt(raw.receipt, {
    subject,
    identityClass: expectedIdentityClass,
    now,
  });
  if (Date.parse(receipt.expiresAt) > bindingExpiresAt) fail('BOOTSTRAP_RESPONSE_INVALID');
  return Object.freeze({
    contract: raw.contract,
    audience: raw.audience,
    subject,
    bindingId,
    bindingExpiresAt: raw.bindingExpiresAt,
    identityClass: expectedIdentityClass,
    receipt,
  });
}

function assertBindingRevocation(raw, { bindingId, subject, identityClass, now }) {
  if (!hasExactKeys(raw, REVOCATION_KEYS)) fail('REVOCATION_RESPONSE_INVALID');
  const exactBindingId = exactPattern(bindingId, BINDING_PATTERN, 'BINDING_INVALID');
  const exactAuthenticatedSubject = exactSubject(subject);
  const expectedIdentityClass = exactIdentityClass(identityClass);
  if (
    raw.contract !== WORDPRESS_LOR_BINDING_REVOCATION_CONTRACT
    || raw.audience !== WORDPRESS_LOR_AUDIENCE
    || raw.subject !== exactAuthenticatedSubject
    || raw.bindingId !== exactBindingId
    || raw.identityClass !== expectedIdentityClass
    || raw.revoked !== true
  ) fail('REVOCATION_RESPONSE_INVALID');
  const revokedAt = exactInstant(raw.revokedAt, 'REVOCATION_RESPONSE_INVALID');
  if (revokedAt > now + CLOCK_SKEW_MS || revokedAt < now - MAXIMUM_RECEIPT_LIFETIME_MS) {
    fail('REVOCATION_RESPONSE_INVALID');
  }
  return Object.freeze({ ...raw });
}

function assertFreshWindow(raw, now, code) {
  const evaluatedAt = exactInstant(raw.evaluatedAt, code);
  const expiresAt = exactInstant(raw.expiresAt, code);
  if (
    !Number.isFinite(now)
    || evaluatedAt > now + CLOCK_SKEW_MS
    || evaluatedAt < now - MAXIMUM_RECEIPT_LIFETIME_MS
    || expiresAt <= now
    || expiresAt <= evaluatedAt
    || expiresAt - evaluatedAt > MAXIMUM_RECEIPT_LIFETIME_MS
  ) fail(code);
}

function assertResourceStudentEntitlement(raw, expected) {
  if (!hasExactKeys(raw, RESOURCE_ENTITLEMENT_KEYS)) fail('RESOURCE_ENTITLEMENT_INVALID');
  const requesterSubject = exactSubject(expected.requesterSubject);
  const actorRole = exactResourceActorRole(expected.actorRole);
  const studentId = exactSubject(expected.studentId);
  if (
    raw.contract !== WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_CONTRACT
    || raw.audience !== WORDPRESS_LOR_AUDIENCE
    || raw.requesterSubject !== requesterSubject
    || raw.actorRole !== actorRole
    || raw.studentId !== studentId
    || raw.active !== true
    || raw.tier !== 'tier3_360'
    || raw.lorEnabled !== true
    || raw.revoked !== false
    || typeof raw.canaryEnabled !== 'boolean'
    || typeof raw.canaryConsented !== 'boolean'
    || raw.producerStatus !== WORDPRESS_LOR_RESOURCE_ENTITLEMENT_PRODUCER
    || raw.metadataOnly !== true
  ) fail('RESOURCE_ENTITLEMENT_INVALID');
  assertFreshWindow(raw, expected.now, 'RESOURCE_ENTITLEMENT_TIME_INVALID');
  return Object.freeze({ ...raw });
}

function assertResourceStudentEntitlementProbe(raw, now) {
  if (!hasExactKeys(raw, RESOURCE_ENTITLEMENT_PROBE_KEYS)) {
    fail('RESOURCE_ENTITLEMENT_PROBE_INVALID');
  }
  if (
    raw.contract !== WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_CONTRACT
    || raw.audience !== WORDPRESS_LOR_AUDIENCE
    || raw.ready !== true
    || raw.metadataOnly !== true
    || raw.producerStatus !== WORDPRESS_LOR_RESOURCE_ENTITLEMENT_PRODUCER
  ) fail('RESOURCE_ENTITLEMENT_PROBE_INVALID');
  assertFreshWindow(raw, now, 'RESOURCE_ENTITLEMENT_PROBE_TIME_INVALID');
  return Object.freeze({ ...raw });
}

/**
 * Create the one server-only client for both bootstrap redemption and ongoing
 * admission. The shared key never enters a body, URL, receipt, error, log, or
 * returned value. Redirects and cookies are disabled on every request.
 */
/**
 * @param {{
 *   origin?: string,
 *   sharedSecret?: string,
 *   fetchImplementation?: typeof globalThis.fetch,
 *   clock?: () => Date | number,
 *   nonceFactory?: () => string,
 *   maximumResponseBytes?: number,
 *   transportTimeoutMs?: number,
 * }} [options]
 */
export function createWordPressLorS2sClient({
  origin,
  sharedSecret,
  fetchImplementation = globalThis.fetch,
  clock = () => new Date(),
  nonceFactory = () => createWordPressLorRequestNonce(),
  maximumResponseBytes = DEFAULT_MAXIMUM_RESPONSE_BYTES,
  transportTimeoutMs = DEFAULT_TRANSPORT_TIMEOUT_MS,
} = {}) {
  const canonicalOrigin = exactHttpsOrigin(origin);
  const secret = exactSharedSecret(sharedSecret);
  if (typeof fetchImplementation !== 'function') fail('FETCH_UNAVAILABLE');
  if (typeof clock !== 'function') fail('CLOCK_INVALID');
  const createNonce = exactNonceFactory(nonceFactory);
  if (
    !Number.isSafeInteger(maximumResponseBytes)
    || maximumResponseBytes < 512
    || maximumResponseBytes > 16_384
  ) fail('RESPONSE_LIMIT_INVALID');
  if (
    !Number.isSafeInteger(transportTimeoutMs)
    || transportTimeoutMs < 50
    || transportTimeoutMs > 15_000
  ) fail('TRANSPORT_TIMEOUT_INVALID');

  async function signedPost(path, body, { signal = null } = {}) {
    if (
      signal !== null
      && (
        typeof signal !== 'object'
        || typeof signal.aborted !== 'boolean'
        || typeof signal.addEventListener !== 'function'
        || typeof signal.removeEventListener !== 'function'
      )
    ) fail('ABORT_SIGNAL_INVALID');
    if (signal?.aborted === true) fail('TRANSPORT_ABORTED');
    const rawBody = JSON.stringify(body);
    const nonce = createNonce();
    const timestamp = String(Math.floor(nowMilliseconds(clock) / 1_000));
    const signature = signWordPressLorRequest({
      sharedSecret: secret,
      method: 'POST',
      path,
      timestamp,
      nonce,
      rawBody,
    });
    const endpoint = `${canonicalOrigin}${path}`;
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener('abort', abortFromCaller, { once: true });
    let timeout;
    try {
      const transport = (async () => {
        const response = await fetchImplementation(endpoint, {
          method: 'POST',
          redirect: 'manual',
          cache: 'no-store',
          credentials: 'omit',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-MissionMed-LOR-S2S-Audience': WORDPRESS_LOR_AUDIENCE,
            'X-MissionMed-LOR-S2S-Timestamp': timestamp,
            'X-MissionMed-LOR-S2S-Nonce': nonce,
            'X-MissionMed-LOR-S2S-Signature': signature,
          },
          body: rawBody,
        });
        if (response?.status !== 200 || response?.redirected === true || response?.url !== endpoint) {
          fail('TRANSPORT_DENIED');
        }
        const contentType = String(response.headers?.get?.('content-type') ?? '').toLowerCase();
        const cacheDirectives = String(response.headers?.get?.('cache-control') ?? '')
          .toLowerCase()
          .split(',')
          .map((directive) => directive.trim())
          .filter(Boolean);
        if (!JSON_CONTENT_TYPE_PATTERN.test(contentType) || !cacheDirectives.includes('no-store')) {
          fail('RESPONSE_HEADERS_INVALID');
        }
        return readResponseBody(response, maximumResponseBytes);
      })();
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new WordPressLorS2sProtocolError('TRANSPORT_TIMEOUT'));
        }, transportTimeoutMs);
      });
      return await Promise.race([transport, deadline]);
    } catch (error) {
      if (error instanceof WordPressLorS2sProtocolError) throw error;
      if (signal?.aborted === true) fail('TRANSPORT_ABORTED');
      fail('TRANSPORT_FAILED');
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromCaller);
      controller.abort();
    }
  }

  /**
   * @param {{
   *   authenticatedSubject?: unknown,
   *   actorRole?: unknown,
   *   studentId?: unknown,
   *   signal?: AbortSignal | null,
   * }} [input]
   */
  async function getResourceStudentEntitlement({
    authenticatedSubject,
    actorRole,
    studentId,
    signal = null,
  } = {}) {
    const exactAuthenticatedSubject = exactSubject(authenticatedSubject);
    const exactActorRole = exactResourceActorRole(actorRole);
    const exactStudentId = exactSubject(studentId);
    const raw = await signedPost(WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PATH, {
      contract: WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_REQUEST_CONTRACT,
      audience: WORDPRESS_LOR_AUDIENCE,
      requesterSubject: exactAuthenticatedSubject,
      actorRole: exactActorRole,
      studentId: exactStudentId,
      metadataOnly: true,
    }, { signal });
    return assertResourceStudentEntitlement(raw, {
      requesterSubject: exactAuthenticatedSubject,
      actorRole: exactActorRole,
      studentId: exactStudentId,
      now: nowMilliseconds(clock),
    });
  }

  /** @param {{ signal?: AbortSignal | null }} [input] */
  async function probeResourceStudentEntitlement({ signal = null } = {}) {
    const raw = await signedPost(WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_PATH, {
      contract: WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_REQUEST_CONTRACT,
      audience: WORDPRESS_LOR_AUDIENCE,
      metadataOnly: true,
    }, { signal });
    return assertResourceStudentEntitlementProbe(raw, nowMilliseconds(clock));
  }

  const resourceEntitlementPort = Object.freeze({
    signedS2s: true,
    resolve: getResourceStudentEntitlement,
    probe: probeResourceStudentEntitlement,
  });

  return Object.freeze({
    /** @param {{ code?: unknown, state?: unknown, callback?: unknown, identityClass?: unknown }} [input] */
    async redeemBootstrap({
      code,
      state,
      callback,
      identityClass = WORDPRESS_LOR_STUDENT_IDENTITY_CLASS,
    } = {}) {
      const exactCode = exactPattern(code, CODE_PATTERN, 'BOOTSTRAP_CODE_INVALID');
      const exactStateHash = exactPattern(state, STATE_HASH_PATTERN, 'BOOTSTRAP_STATE_INVALID');
      const exactBoundCallback = exactCallback(callback);
      const exactBoundIdentityClass = exactIdentityClass(identityClass);
      const raw = await signedPost(WORDPRESS_LOR_BOOTSTRAP_REDEEM_PATH, {
        contract: WORDPRESS_LOR_BOOTSTRAP_REQUEST_CONTRACT,
        audience: WORDPRESS_LOR_AUDIENCE,
        identityClass: exactBoundIdentityClass,
        code: exactCode,
        stateHash: exactStateHash,
        callback: exactBoundCallback,
      });
      return assertBootstrapResponse(raw, {
        identityClass: exactBoundIdentityClass,
        now: nowMilliseconds(clock),
      });
    },

    /** @param {{ bindingId?: unknown, subject?: unknown, identityClass?: unknown }} [input] */
    async admit({
      bindingId,
      subject,
      identityClass = WORDPRESS_LOR_STUDENT_IDENTITY_CLASS,
    } = {}) {
      const exactBindingId = exactPattern(bindingId, BINDING_PATTERN, 'BINDING_INVALID');
      const exactAuthenticatedSubject = exactSubject(subject);
      const exactBoundIdentityClass = exactIdentityClass(identityClass);
      const raw = await signedPost(WORDPRESS_LOR_ADMISSION_PATH, {
        contract: WORDPRESS_LOR_ADMISSION_REQUEST_CONTRACT,
        audience: WORDPRESS_LOR_AUDIENCE,
        bindingId: exactBindingId,
        subject: exactAuthenticatedSubject,
        identityClass: exactBoundIdentityClass,
      });
      return assertWordPressLorAdmissionReceipt(raw, {
        subject: exactAuthenticatedSubject,
        identityClass: exactBoundIdentityClass,
        now: nowMilliseconds(clock),
      });
    },

    /** @param {{ bindingId?: unknown, subject?: unknown, identityClass?: unknown }} [input] */
    async revokeBinding({
      bindingId,
      subject,
      identityClass = WORDPRESS_LOR_STUDENT_IDENTITY_CLASS,
    } = {}) {
      const exactBindingId = exactPattern(bindingId, BINDING_PATTERN, 'BINDING_INVALID');
      const exactAuthenticatedSubject = exactSubject(subject);
      const exactBoundIdentityClass = exactIdentityClass(identityClass);
      const raw = await signedPost(WORDPRESS_LOR_BINDING_REVOCATION_PATH, {
        contract: WORDPRESS_LOR_BINDING_REVOCATION_REQUEST_CONTRACT,
        audience: WORDPRESS_LOR_AUDIENCE,
        bindingId: exactBindingId,
        subject: exactAuthenticatedSubject,
        identityClass: exactBoundIdentityClass,
      });
      return assertBindingRevocation(raw, {
        bindingId: exactBindingId,
        subject: exactAuthenticatedSubject,
        identityClass: exactBoundIdentityClass,
        now: nowMilliseconds(clock),
      });
    },

    getResourceStudentEntitlement,
    probeResourceStudentEntitlement,
    resourceEntitlementPort,
  });
}

export const WORDPRESS_LOR_S2S_PROTOCOL_CONTRACT = Object.freeze({
  authority: 'DR-133',
  audience: WORDPRESS_LOR_AUDIENCE,
  bootstrapPath: WORDPRESS_LOR_BOOTSTRAP_REDEEM_PATH,
  admissionPath: WORDPRESS_LOR_ADMISSION_PATH,
  revocationPath: WORDPRESS_LOR_BINDING_REVOCATION_PATH,
  resourceStudentEntitlementPath: WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PATH,
  resourceStudentEntitlementProbePath: WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_PATH,
  identityClasses: Object.freeze([
    WORDPRESS_LOR_STUDENT_IDENTITY_CLASS,
    WORDPRESS_LOR_FACULTY_CANDIDATE_IDENTITY_CLASS,
  ]),
  method: 'POST',
  redirect: 'manual',
  credentials: 'omit',
  codeExposure: 'browser_one_time_opaque_only',
  sessionCredential: 'non_secret_binding_id_only',
  requestAuthentication: 'domain_separated_hmac_with_atomic_nonce',
  resourceResponse: 'fresh_metadata_only_exact_schema',
  readinessProbe: 'signed_metadata_only_no_subject',
});
