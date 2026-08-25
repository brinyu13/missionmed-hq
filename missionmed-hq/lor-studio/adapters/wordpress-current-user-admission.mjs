import { hashValue } from '../domain/value-utils.js';
import {
  createTrustedRequestContext,
  readTrustedRequestContext,
} from '../security/trusted-request-context.mjs';
import {
  createWordPressLorS2sClient,
  WORDPRESS_LOR_ADMISSION_CONTRACT,
  WORDPRESS_LOR_ADMISSION_PATH,
  WORDPRESS_LOR_BINDING_PROVENANCE,
} from './wordpress-lor-s2s-protocol.mjs';

export {
  WORDPRESS_LOR_ADMISSION_CONTRACT,
  WORDPRESS_LOR_ADMISSION_PATH,
  WORDPRESS_LOR_BINDING_PROVENANCE,
};

const SUBJECT_PATTERN = /^wp:[1-9][0-9]*$/u;
const BINDING_PATTERN = /^lorb1_[A-Za-z0-9_-]{43}$/u;
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

function exactBinding(session, now) {
  const bindingId = session?.lorAdmissionBindingId;
  if (typeof bindingId !== 'string' || !BINDING_PATTERN.test(bindingId)) {
    fail('BINDING_UNAVAILABLE');
  }
  if (session?.lorAdmissionBindingProvenance !== WORDPRESS_LOR_BINDING_PROVENANCE) {
    fail('BINDING_UNAVAILABLE');
  }
  const expiresAt = session?.lorAdmissionBindingExpiresAt;
  if (typeof expiresAt !== 'string' || !UTC_INSTANT_PATTERN.test(expiresAt)) {
    fail('BINDING_UNAVAILABLE');
  }
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs) || new Date(expiresAtMs).toISOString() !== expiresAt || expiresAtMs <= now) {
    fail('BINDING_UNAVAILABLE');
  }
  return bindingId;
}

function nowMilliseconds(clock) {
  const raw = clock();
  const milliseconds = raw instanceof Date ? raw.getTime() : Number(raw);
  if (!Number.isFinite(milliseconds)) fail('CLOCK_INVALID');
  return milliseconds;
}

/**
 * Build the server-only WordPress admission resolver and matching case-service
 * entitlement port. The browser-carried HQ session contains only a non-secret
 * binding identifier. Every authorization is a fresh, signed S2S POST; the
 * binding is useless without the server-held domain-separated HMAC key.
 *
 * @param {{
 *   s2sClient?: { admit(input: { bindingId: string, subject: string }): Promise<Record<string, unknown>> } | null,
 *   origin?: string,
 *   sharedSecret?: string,
 *   fetchImplementation?: typeof globalThis.fetch,
 *   clock?: () => Date | number,
 *   nonceFactory?: () => string,
 *   maximumResponseBytes?: number,
 *   transportTimeoutMs?: number,
 * }} [options]
 */
export function createWordPressCurrentUserAdmission({
  s2sClient = null,
  origin,
  sharedSecret,
  fetchImplementation = globalThis.fetch,
  clock = () => new Date(),
  nonceFactory,
  maximumResponseBytes,
  transportTimeoutMs,
} = {}) {
  if (typeof clock !== 'function') fail('CLOCK_INVALID');
  let client = s2sClient;
  if (client === null) {
    const options = { origin, sharedSecret, fetchImplementation, clock };
    if (nonceFactory !== undefined) options.nonceFactory = nonceFactory;
    if (maximumResponseBytes !== undefined) options.maximumResponseBytes = maximumResponseBytes;
    if (transportTimeoutMs !== undefined) options.transportTimeoutMs = transportTimeoutMs;
    client = createWordPressLorS2sClient(options);
  }
  if (!client || typeof client.admit !== 'function') fail('S2S_CLIENT_UNAVAILABLE');

  const sourceReferenceHash = hashValue({
    authority: 'DR-133',
    contract: WORDPRESS_LOR_ADMISSION_CONTRACT,
    path: WORDPRESS_LOR_ADMISSION_PATH,
    transport: 'signed_s2s_post',
  });
  const contexts = new WeakMap();

  const admission = {
    requiresTrustedRequestContext: true,

    /** @param {{ subject?: unknown, session?: Record<string, any> }} [input] */
    async resolve(input = {}) {
      const authenticatedSubject = canonicalSubject(input.subject);
      const sessionSubject = canonicalSessionSubject(input.session?.user?.id);
      if (sessionSubject !== authenticatedSubject) fail('SESSION_SUBJECT_MISMATCH');
      const bindingId = exactBinding(input.session, nowMilliseconds(clock));

      let receipt;
      try {
        receipt = await client.admit({ bindingId, subject: authenticatedSubject });
      } catch {
        fail('ADMISSION_DENIED');
      }
      if (
        !receipt
        || receipt.contract !== WORDPRESS_LOR_ADMISSION_CONTRACT
        || receipt.subject !== authenticatedSubject
        || receipt.admitted !== true
      ) fail('ADMISSION_DENIED');

      // This stable proof identifies the verified identity source for the
      // permanent database crosswalk. Freshness/replay are independently
      // enforced by the signed S2S nonce and the bounded receipt on every call.
      const proofHash = hashValue({
        schemaVersion: 'missionmed.lor.wordpress-admission-proof.v2',
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
      const subject = canonicalSubject(input.studentId);
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
        producerStatus: 'WORDPRESS_ADMISSION_V2_SIGNED_S2S',
      });
    },
  };

  return Object.freeze(admission);
}

export const WORDPRESS_CURRENT_USER_ADMISSION_CONTRACT = Object.freeze({
  authority: 'DR-133',
  receiptContract: WORDPRESS_LOR_ADMISSION_CONTRACT,
  path: WORDPRESS_LOR_ADMISSION_PATH,
  method: 'POST',
  redirect: 'manual',
  credentials: 'omit',
  sessionCredential: 'non_secret_binding_id_only',
  bindingProvenance: WORDPRESS_LOR_BINDING_PROVENANCE,
  authorization: 'domain_separated_hmac_with_atomic_nonce',
  proofHashInputs: ['schemaVersion', 'sourceReferenceHash', 'subject'],
});
