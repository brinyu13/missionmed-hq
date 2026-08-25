import { hashValue } from '../domain/value-utils.js';
import {
  createTrustedRequestContext,
  readTrustedRequestContext,
} from '../security/trusted-request-context.mjs';

export const WORDPRESS_LOR_ADMISSION_CONTRACT =
  'missionmed.lor.wordpress-admission.v2';
export const WORDPRESS_LOR_ADMISSION_PATH =
  '/wp-json/missionmed/v1/lor-studio/current-user-admission';
export const WORDPRESS_LOR_ADMISSION_GRANT_PROVENANCE =
  'wordpress_lor_refresh_grant';

const RECEIPT_KEYS = new Set([
  'contract',
  'subject',
  'admitted',
  'evaluatedAt',
  'expiresAt',
]);
const SUBJECT_PATTERN = /^wp:[1-9][0-9]*$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const DEFAULT_MAX_RESPONSE_BYTES = 4_096;
const DEFAULT_MAX_RECEIPT_LIFETIME_MS = 5 * 60 * 1_000;
const DEFAULT_TRANSPORT_TIMEOUT_MS = 5_000;
const MAX_CLOCK_SKEW_MS = 30_000;
const JSON_CONTENT_TYPE_PATTERN = /^application\/json(?:\s*;\s*charset=utf-8)?$/u;
const UTC_INSTANT_PATTERN =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u;

export class WordPressCurrentUserAdmissionError extends Error {
  constructor(code) {
    super(`WordPress LOR admission failed: ${code}`);
    this.name = 'WordPressCurrentUserAdmissionError';
    this.code = code;
  }
}

function fail(code) {
  throw new WordPressCurrentUserAdmissionError(code);
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

function canonicalSubject(value) {
  if (typeof value !== 'string' || !SUBJECT_PATTERN.test(value) || value.length > 200) {
    fail('SUBJECT_INVALID');
  }
  const identifier = Number(value.slice(3));
  if (!Number.isSafeInteger(identifier) || identifier <= 0) fail('SUBJECT_INVALID');
  return value;
}

function canonicalSessionSubject(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) fail('SUBJECT_INVALID');
    return `wp:${value}`;
  }
  if (typeof value !== 'string' || value.trim() !== value) fail('SUBJECT_INVALID');
  if (SUBJECT_PATTERN.test(value)) return canonicalSubject(value);
  if (!/^[1-9][0-9]*$/u.test(value)) fail('SUBJECT_INVALID');
  const identifier = Number(value);
  if (!Number.isSafeInteger(identifier) || String(identifier) !== value) fail('SUBJECT_INVALID');
  return `wp:${value}`;
}

function exactHttpsOrigin(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length > 512) {
    fail('ORIGIN_INVALID');
  }
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

function exactGrant(session) {
  const grant = session?.lorAdmissionGrant;
  if (
    typeof grant !== 'string'
    || grant.length < 64
    || grant.length > 2_048
    || grant.trim() !== grant
    || CONTROL_CHARACTER_PATTERN.test(grant)
  ) fail('REFRESH_GRANT_UNAVAILABLE');
  if (session?.lorAdmissionGrantProvenance !== WORDPRESS_LOR_ADMISSION_GRANT_PROVENANCE) {
    fail('REFRESH_GRANT_UNAVAILABLE');
  }
  return grant;
}

function instant(value, code) {
  if (typeof value !== 'string' || !UTC_INSTANT_PATTERN.test(value)) fail(code);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) fail(code);
  return timestamp;
}

function nowMilliseconds(clock) {
  const value = clock();
  const milliseconds = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(milliseconds)) fail('CLOCK_INVALID');
  return milliseconds;
}

async function responseBody(response, maximumBytes) {
  const rawContentLength = response?.headers?.get?.('content-length');
  if (rawContentLength !== null && rawContentLength !== undefined && rawContentLength !== '') {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(rawContentLength)) fail('RESPONSE_HEADERS_INVALID');
    const contentLength = Number(rawContentLength);
    if (!Number.isSafeInteger(contentLength) || contentLength > maximumBytes) {
      fail('RESPONSE_TOO_LARGE');
    }
  }
  const reader = response?.body?.getReader?.();
  if (!reader || typeof reader.read !== 'function') fail('RESPONSE_INVALID');
  const chunks = [];
  let total = 0;
  let complete = false;
  try {
    while (true) {
      const result = await reader.read();
      if (!result || typeof result !== 'object') fail('RESPONSE_INVALID');
      if (result.done === true) {
        complete = true;
        break;
      }
      if (!(result.value instanceof Uint8Array)) fail('RESPONSE_INVALID');
      total += result.value.byteLength;
      if (total > maximumBytes) fail('RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(result.value));
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* safe best-effort cancellation */ }
    throw error;
  } finally {
    try { reader.releaseLock?.(); } catch { /* no externally visible transport detail */ }
  }
  if (!complete || total === 0) fail('RESPONSE_INVALID');
  const bytes = Buffer.concat(chunks, total);
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('RESPONSE_INVALID');
  }
  return parsed;
}

function assertReceipt(rawReceipt, { subject, now, maximumLifetime }) {
  if (!hasExactKeys(rawReceipt, RECEIPT_KEYS)) fail('RECEIPT_INVALID');
  const receipt = { ...rawReceipt };
  if (
    receipt.contract !== WORDPRESS_LOR_ADMISSION_CONTRACT
    || receipt.subject !== subject
    || receipt.admitted !== true
  ) fail('RECEIPT_DENIED');
  const evaluatedAt = instant(receipt.evaluatedAt, 'RECEIPT_TIME_INVALID');
  const expiresAt = instant(receipt.expiresAt, 'RECEIPT_TIME_INVALID');
  if (
    evaluatedAt > now + MAX_CLOCK_SKEW_MS
    || evaluatedAt < now - maximumLifetime
    || expiresAt <= now
    || expiresAt <= evaluatedAt
    || expiresAt - evaluatedAt > maximumLifetime
  ) fail('RECEIPT_TIME_INVALID');
  return Object.freeze(receipt);
}

/**
 * Build the server-only WordPress admission resolver and matching case-service
 * entitlement port. The opaque refresh grant is read only from an encrypted HQ
 * session, sent only in one exact request header, and never enters a returned
 * value, error, log, hash, or trusted context.
 *
 * @param {{
 *   origin?: string,
 *   fetchImplementation?: typeof globalThis.fetch,
 *   clock?: () => Date | number,
 *   maxResponseBytes?: number,
 *   maxReceiptLifetimeMs?: number,
 *   transportTimeoutMs?: number,
 * }} options
 */
export function createWordPressCurrentUserAdmission({
  origin,
  fetchImplementation = globalThis.fetch,
  clock = () => new Date(),
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  maxReceiptLifetimeMs = DEFAULT_MAX_RECEIPT_LIFETIME_MS,
  transportTimeoutMs = DEFAULT_TRANSPORT_TIMEOUT_MS,
} = {}) {
  const canonicalOrigin = exactHttpsOrigin(origin);
  if (typeof fetchImplementation !== 'function') fail('FETCH_UNAVAILABLE');
  if (typeof clock !== 'function') fail('CLOCK_INVALID');
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 256 || maxResponseBytes > 16_384) {
    fail('RESPONSE_LIMIT_INVALID');
  }
  if (
    !Number.isSafeInteger(maxReceiptLifetimeMs)
    || maxReceiptLifetimeMs < 30_000
    || maxReceiptLifetimeMs > 15 * 60 * 1_000
  ) fail('RECEIPT_LIFETIME_INVALID');
  if (!Number.isSafeInteger(transportTimeoutMs) || transportTimeoutMs < 50 || transportTimeoutMs > 15_000) {
    fail('TRANSPORT_TIMEOUT_INVALID');
  }

  const endpoint = `${canonicalOrigin}${WORDPRESS_LOR_ADMISSION_PATH}`;
  const sourceReferenceHash = hashValue({
    authority: 'DR-133',
    contract: WORDPRESS_LOR_ADMISSION_CONTRACT,
    origin: canonicalOrigin,
    path: WORDPRESS_LOR_ADMISSION_PATH,
  });
  const contexts = new WeakMap();

  const admission = {
    requiresTrustedRequestContext: true,

    /** @param {{ subject?: unknown, session?: Record<string, any> }} [input] */
    async resolve(input = {}) {
      const { subject, session } = input;
      const authenticatedSubject = canonicalSubject(subject);
      const sessionSubject = canonicalSessionSubject(session?.user?.id);
      if (sessionSubject !== authenticatedSubject) fail('SESSION_SUBJECT_MISMATCH');
      const grant = exactGrant(session);

      const controller = new AbortController();
      let timeout;
      try {
        const transport = (async () => {
          const response = await fetchImplementation(endpoint, {
            method: 'GET',
            redirect: 'manual',
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'X-MissionMed-LOR-Admission': grant,
            },
          });
          if (
            response?.status !== 200
            || response?.redirected === true
            || response?.url !== endpoint
          ) fail('TRANSPORT_DENIED');
          const contentType = String(response.headers?.get?.('content-type') ?? '').toLowerCase();
          const cacheDirectives = String(response.headers?.get?.('cache-control') ?? '')
            .toLowerCase()
            .split(',')
            .map((directive) => directive.trim())
            .filter(Boolean);
          if (!JSON_CONTENT_TYPE_PATTERN.test(contentType) || !cacheDirectives.includes('no-store')) {
            fail('RESPONSE_HEADERS_INVALID');
          }
          return responseBody(response, maxResponseBytes);
        })();
        const deadline = new Promise((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new WordPressCurrentUserAdmissionError('TRANSPORT_TIMEOUT'));
          }, transportTimeoutMs);
        });
        const rawReceipt = await Promise.race([transport, deadline]);

        const now = nowMilliseconds(clock);
        const receipt = assertReceipt(
          rawReceipt,
          {
            subject: authenticatedSubject,
            now,
            maximumLifetime: maxReceiptLifetimeMs,
          },
        );
        const proofHash = hashValue({
          schemaVersion: 'missionmed.lor.wordpress-admission-proof.v1',
          sourceReferenceHash,
          subject: authenticatedSubject,
        });
        const context = createTrustedRequestContext({
          schemaVersion: 'missionmed.lor.trusted-request-context.v1',
          authenticatedSubject,
          actorRole: 'student',
          sourceReferenceHash,
          proofHash,
          entitlementVerified: true,
          lorEnabled: true,
          canaryAuthorized: true,
          clientAsserted: false,
        });
        const projection = Object.freeze({
          available: true,
          sourceVerified: true,
          revoked: false,
          active: true,
          tier: 'tier3_360',
          lorEnabled: true,
          canaryEnabled: true,
          canaryConsented: true,
          studentId: receipt.subject,
          actorId: receipt.subject,
          role: 'student',
        });
        contexts.set(projection, context);
        return projection;
      } catch (error) {
        if (error instanceof WordPressCurrentUserAdmissionError) throw error;
        fail('TRANSPORT_FAILED');
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
        controller.abort();
      }
    },

    consumeTrustedRequestContext(projection) {
      const context = projection && typeof projection === 'object'
        ? contexts.get(projection)
        : undefined;
      if (!context) fail('TRUSTED_CONTEXT_UNAVAILABLE');
      contexts.delete(projection);
      return context;
    },

    /** @param {{ studentId?: unknown }} [input] */
    async getStudentEntitlement(input = {}) {
      const { studentId } = input;
      const subject = canonicalSubject(studentId);
      let context;
      try {
        context = readTrustedRequestContext();
      } catch {
        fail('TRUSTED_CONTEXT_UNAVAILABLE');
      }
      if (context.actorRole !== 'student' || context.authenticatedSubject !== subject) {
        fail('ENTITLEMENT_SUBJECT_MISMATCH');
      }
      return Object.freeze({
        studentId: subject,
        active: true,
        tier: 'tier3_360',
        lorEnabled: true,
        revoked: false,
        canaryEnabled: true,
        canaryConsented: true,
        producerStatus: 'WORDPRESS_ADMISSION_V2_VERIFIED',
      });
    },
  };

  return Object.freeze(admission);
}

export const WORDPRESS_CURRENT_USER_ADMISSION_CONTRACT = Object.freeze({
  authority: 'DR-133',
  receiptContract: WORDPRESS_LOR_ADMISSION_CONTRACT,
  path: WORDPRESS_LOR_ADMISSION_PATH,
  method: 'GET',
  redirect: 'manual',
  credentials: 'omit',
  responseMaximumBytes: DEFAULT_MAX_RESPONSE_BYTES,
  refreshGrantProvenance: WORDPRESS_LOR_ADMISSION_GRANT_PROVENANCE,
  refreshGrantExposure: 'server_header_only_never_returned_logged_or_hashed',
  proofHashInputs: ['schemaVersion', 'sourceReferenceHash', 'subject'],
});
