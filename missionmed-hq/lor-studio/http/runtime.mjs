import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import {
  createTrustedRequestContext,
  runWithTrustedRequestContext,
} from '../security/trusted-request-context.mjs';
import {
  createFacultyCandidateCredentialContext,
  runWithFacultyCandidateCredentialContext,
} from '../security/faculty-candidate-credential-context.mjs';

export const LOR_STUDIO_ROUTE_PREFIX = '/lor-studio';
export const LOR_STUDIO_API_PREFIX = '/api/lor-studio';
export const LOR_CANDIDATE_AUTH_START_PATH = `${LOR_STUDIO_API_PREFIX}/auth/candidate/start`;
export const LOR_CANDIDATE_HANDOFF_COOKIE_NAME = '__Secure-mmhq_lor_candidate_handoff';
export const LOR_CANDIDATE_IDENTITY_CLASS = 'faculty_candidate';
export const LOR_STUDENT_IDENTITY_CLASS = 'student';
export const LOR_SESSION_IDENTITY_CLASS_FIELD = 'lorAdmissionIdentityClass';
export const LOR_SESSION_CANDIDATE_INVITATION_FIELD = 'lorFacultyCandidateInvitationId';

export const LOR_CANDIDATE_HANDOFF_SCHEMA =
  'missionmed.lor.faculty-candidate-auth-handoff.v1';
const LOR_CANDIDATE_HANDOFF_MAX_LIFETIME_MS = 15 * 60 * 1_000;
const LOR_CANDIDATE_HANDOFF_CLOCK_SKEW_MS = 30 * 1_000;
export const LOR_CANDIDATE_HANDOFF_COOKIE_PATH = '/api/lor-studio/auth/';
const LOR_CANDIDATE_START_MAX_BODY_BYTES = 8_192;
const CANDIDATE_LOCATOR = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const CANDIDATE_RAW_TOKEN = /^[A-Za-z0-9_-]{43}$/u;
const SEALED_CANDIDATE_HANDOFF =
  /^lorch1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{16,3700}\.[A-Za-z0-9_-]{22}$/u;

export const LOR_CANDIDATE_AUTH_START_CONTRACT = Object.freeze({
  path: LOR_CANDIDATE_AUTH_START_PATH,
  method: 'POST',
  sessionRequired: false,
  csrfProtection: 'exact_same_origin_and_custom_header',
  exchangeMethod: 'exchangeInvitationToken',
  inspectionMethod: 'inspectSealedHandoff',
  identityClass: LOR_CANDIDATE_IDENTITY_CLASS,
  sessionIdentityClassField: LOR_SESSION_IDENTITY_CLASS_FIELD,
  sessionInvitationField: LOR_SESSION_CANDIDATE_INVITATION_FIELD,
  handoffSchema: LOR_CANDIDATE_HANDOFF_SCHEMA,
  maximumLifetimeSeconds: LOR_CANDIDATE_HANDOFF_MAX_LIFETIME_MS / 1_000,
  cookie: Object.freeze({
    name: LOR_CANDIDATE_HANDOFF_COOKIE_NAME,
    path: LOR_CANDIDATE_HANDOFF_COOKIE_PATH,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  }),
  successStatus: 204,
  rawTokenInUrl: false,
  rawTokenInResponse: false,
});

const ASSET_CONTENT_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
});

const SAFE_ASSETS = new Set([
  'index.html',
  'invitation-auth.html',
  'production-adapter.css',
  'production-adapter.js',
  'production-projection-ui.js',
]);
const FACULTY_CANDIDATE_ASSET_PATHS = new Set([
  `${LOR_STUDIO_ROUTE_PREFIX}/production-adapter.css`,
  `${LOR_STUDIO_ROUTE_PREFIX}/production-adapter.js`,
  `${LOR_STUDIO_ROUTE_PREFIX}/production-projection-ui.js`,
]);
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const FACULTY_INVITATION_PAGE =
  /^\/lor-studio\/invitations\/[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}\/?$/u;
const FACULTY_INVITATION_BOOTSTRAP =
  /^\/api\/lor-studio\/invitations\/([A-Za-z0-9][A-Za-z0-9_.:-]{0,199})\/bootstrap$/u;
const FACULTY_INVITATION_VERIFY =
  /^\/api\/lor-studio\/invitations\/([A-Za-z0-9][A-Za-z0-9_.:-]{0,199})\/verify$/u;

/**
 * @typedef {object} LorStudioFlags
 * @property {boolean} enabled
 * @property {boolean} killSwitch
 * @property {boolean} requireCanary
 */

/**
 * @typedef {object} LorSession
 * @property {{ id?: string | number | null }} [user]
 * @property {string} [issuedAt]
 * @property {string} [expiresAt]
 * @property {string} [csrfToken]
 */

/**
 * @typedef {object} LorEntitlementProjection
 * @property {boolean} [available]
 * @property {boolean} [sourceVerified]
 * @property {boolean} [revoked]
 * @property {boolean} [active]
 * @property {string} [tier]
 * @property {boolean} [lorEnabled]
 * @property {boolean} [canaryEnabled]
 * @property {boolean} [canaryConsented]
 * @property {string | number | null} [studentId]
 * @property {string | number | null} [actorId]
 * @property {string} [role]
 */

/** @typedef {{ ok: false, status: number, error: string, message: string }} LorAccessFailure */
/** @typedef {{ ok: true, subject: string, session: LorSession }} LorFreshSession */
/** @typedef {{ id: string, role: string }} LorActor */
/** @typedef {{ studentId: string, active: true, tier: 'tier3_360', lorEnabled: true, revoked: false, canaryEnabled: boolean, canaryConsented: boolean }} LorAcceptedEntitlement */
/** @typedef {{ ok: true, actor: Readonly<LorActor>, entitlement: Readonly<LorAcceptedEntitlement> }} LorEntitlementAccess */
/** @typedef {{ ok: true, actor: Readonly<LorActor>, entitlement: Readonly<LorAcceptedEntitlement> }} LorAccessGrant */

/**
 * @typedef {object} LorEntitlementResolver
 * @property {(input: { subject: string, session: LorSession, request: import('node:http').IncomingMessage }) => Promise<LorEntitlementProjection>} resolve
 * @property {boolean} [requiresTrustedRequestContext]
 * @property {(projection: LorEntitlementProjection) => Readonly<Record<string, unknown>>} [consumeTrustedRequestContext]
 */

/**
 * @typedef {object} LorApplicationBootstrap
 * @property {boolean} [operational]
 * @property {string} [runtimeMode]
 * @property {string} [storageMode]
 * @property {boolean} [providersReady]
 * @property {Record<string, unknown>} [capabilities]
 */

/**
 * @typedef {object} LorApplicationContract
 * @property {(input: { actor: Readonly<LorActor>, entitlement: Readonly<LorAcceptedEntitlement> }) => Promise<LorApplicationBootstrap>} [getBootstrap]
 * @property {(input: { request: import('node:http').IncomingMessage, url: URL, actor: Readonly<LorActor>, entitlement: Readonly<LorAcceptedEntitlement> }) => Promise<{ status?: number, body?: unknown, binary?: { body: Buffer | Uint8Array | ArrayBuffer, contentType: string, filename?: string, sensitive?: boolean } }>} [handleRequest]
 */

/**
 * @typedef {object} LorStudioRuntimeOptions
 * @property {string} [publicDirectory]
 * @property {LorStudioFlags} [flags]
 * @property {LorEntitlementResolver} [entitlementResolver]
 * @property {LorApplicationContract | null} [application]
 * @property {{ exchangeInvitationToken: (input: { invitationId: string, rawToken: string }) => Promise<unknown> }} [candidateAuthStartService]
 * @property {(request: import('node:http').IncomingMessage, session: LorSession | null) => boolean} [validateCsrf]
 * @property {() => Date | number} [clock]
 */

/**
 * @param {unknown} value
 * @param {boolean} fallback
 */
function asBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [environment]
 * @returns {Readonly<LorStudioFlags>}
 */
export function resolveLorStudioFlags(environment = process.env) {
  return Object.freeze({
    enabled: asBoolean(environment.MMHQ_LOR_STUDIO_ENABLED, false),
    killSwitch: asBoolean(environment.MMHQ_LOR_STUDIO_KILL_SWITCH, true),
    requireCanary: asBoolean(environment.MMHQ_LOR_STUDIO_REQUIRE_CANARY, true),
  });
}

export function isLorStudioRequestPath(pathname = '') {
  const value = String(pathname || '');
  return value === LOR_STUDIO_ROUTE_PREFIX
    || value.startsWith(`${LOR_STUDIO_ROUTE_PREFIX}/`)
    || value === LOR_STUDIO_API_PREFIX
    || value.startsWith(`${LOR_STUDIO_API_PREFIX}/`);
}

/** @returns {Readonly<LorEntitlementResolver>} */
export function createUnavailableLorEntitlementResolver(reason = 'exact_entitlement_contract_unverified') {
  return Object.freeze({
    async resolve() {
      return {
        available: false,
        eligible: false,
        sourceVerified: false,
        reason,
      };
    },
  });
}

/**
 * @param {number} status
 * @param {string} error
 * @param {string} message
 * @param {Record<string, unknown>} [extra]
 * @returns {LorAccessFailure & Record<string, unknown>}
 */
function accessFailure(status, error, message, extra = {}) {
  return { ok: false, status, error, message, ...extra };
}

/**
 * @param {LorSession | null | undefined} session
 * @param {Date | number} [now]
 * @param {{ requireCanonicalSubject?: boolean }} [options]
 * @returns {LorAccessFailure | LorFreshSession}
 */
export function validateFreshLorSession(
  session,
  now = new Date(),
  { requireCanonicalSubject = false } = {},
) {
  if (!session || typeof session !== 'object') {
    return accessFailure(401, 'authentication_required', 'A fresh MissionMed session is required.');
  }

  const canonicalSubject = canonicalizeLorSessionSubject(session?.user?.id);
  const legacySubject = String(session?.user?.id ?? '').trim();
  const subject = canonicalSubject ?? (requireCanonicalSubject ? null : legacySubject);
  const expiresAt = Date.parse(String(session.expiresAt || ''));
  const issuedAt = Date.parse(String(session.issuedAt || ''));
  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  if (!subject || !Number.isFinite(expiresAt) || !Number.isFinite(issuedAt) || !Number.isFinite(nowMs)) {
    return accessFailure(401, 'invalid_session', 'The MissionMed session is incomplete or invalid.');
  }

  if (expiresAt <= nowMs) {
    return accessFailure(401, 'session_expired', 'The MissionMed session has expired.');
  }

  if (issuedAt > nowMs + 5 * 60 * 1000 || issuedAt >= expiresAt) {
    return accessFailure(401, 'invalid_session_window', 'The MissionMed session time window is invalid.');
  }

  return {
    ok: true,
    subject,
    session,
  };
}

/**
 * Canonicalize the authenticated WordPress identity at the trusted server
 * boundary. A browser cannot select this value: it comes from the encrypted HQ
 * session after WordPress handoff verification.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function canonicalizeLorSessionSubject(value) {
  let digits;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    digits = String(value);
  } else if (typeof value === 'string') {
    if (value.trim() !== value || value === '') return null;
    const match = /^(?:wp:)?([1-9][0-9]*)$/u.exec(value);
    if (!match) return null;
    digits = match[1];
  } else {
    return null;
  }
  const identifier = Number(digits);
  if (!Number.isSafeInteger(identifier) || identifier <= 0 || String(identifier) !== digits) return null;
  return `wp:${digits}`;
}

/**
 * @param {LorEntitlementProjection | null | undefined} entitlement
 * @param {{ requireCanary?: boolean }} [options]
 * @returns {LorAccessFailure | LorEntitlementAccess}
 */
export function evaluateLorEntitlement(entitlement, { requireCanary = true } = {}) {
  if (!entitlement || entitlement.available !== true || entitlement.sourceVerified !== true) {
    return accessFailure(
      503,
      'entitlement_contract_unavailable',
      'The authoritative LOR entitlement contract is unavailable.',
    );
  }

  if (entitlement.revoked !== false) {
    return accessFailure(403, 'lor_entitlement_revoked', 'LOR Studio access is revoked or cannot be proven active.');
  }

  if (entitlement.active !== true || entitlement.tier !== 'tier3_360' || entitlement.lorEnabled !== true) {
    return accessFailure(
      403,
      'lor_entitlement_required',
      'Access requires an active Tier 3 / 360 entitlement and explicit LOR Studio enablement.',
    );
  }

  if (requireCanary && (entitlement.canaryEnabled !== true || entitlement.canaryConsented !== true)) {
    return accessFailure(
      403,
      'lor_canary_consent_required',
      'This release is limited to explicitly enabled, consenting canary participants.',
    );
  }

  const studentId = String(entitlement.studentId ?? '').trim();
  const actorId = String(entitlement.actorId ?? studentId).trim();
  const role = String(entitlement.role || 'student').trim().toLowerCase();
  if (!actorId || !studentId || !['student', 'faculty', 'mentor', 'admin'].includes(role)) {
    return accessFailure(503, 'entitlement_projection_invalid', 'The entitlement projection is incomplete.');
  }

  return {
    ok: true,
    actor: Object.freeze({ id: actorId, role }),
    entitlement: Object.freeze({
      studentId,
      active: true,
      tier: 'tier3_360',
      lorEnabled: true,
      revoked: false,
      canaryEnabled: entitlement.canaryEnabled === true,
      canaryConsented: entitlement.canaryConsented === true,
    }),
  };
}

/** @param {string} contentType */
function commonHeaders(contentType) {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'self'; base-uri 'none'; font-src 'self' https://fonts.gstatic.com; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'; connect-src 'self'",
    'Content-Type': contentType,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=()',
    'Referrer-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-MissionMed-LOR-Mode': 'protected',
    'X-Robots-Tag': 'noindex, nofollow',
  };
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} status
 * @param {unknown} payload
 * @param {Record<string, string>} [extraHeaders]
 */
function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    ...commonHeaders('application/json; charset=utf-8'),
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

/**
 * Candidate-auth start is intentionally the only API operation which may run before a MissionMed
 * session exists. A browser-supplied token is exchanged exactly once through the injected trusted
 * service; the HTTP layer receives only a sealed, short-lived handoff which it can place in an
 * HttpOnly cookie for the normal WordPress sign-in callback to consume.
 */
const CANDIDATE_HANDOFF_KEYS = Object.freeze([
  'schemaVersion',
  'authoritySource',
  'invitationId',
  'sealedHandoff',
  'issuedAt',
  'expiresAt',
  'singlePurpose',
  'clientAsserted',
]);
const CANDIDATE_HANDOFF_KEY_SET = new Set(CANDIDATE_HANDOFF_KEYS);

/** @param {import('node:http').IncomingMessage} request @param {string} name */
function requestHeader(request, name) {
  return String(request?.headers?.[name.toLowerCase()] || request?.headers?.[name] || '').trim();
}

/** @param {unknown} value @param {string} fieldName */
function canonicalCandidateInstant(value, fieldName) {
  if (typeof value !== 'string') throw new TypeError(`${fieldName} is invalid`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new TypeError(`${fieldName} is invalid`);
  }
  return timestamp;
}

/**
 * @param {unknown} input
 * @param {{ invitationId: string, now: Date | number }} options
 */
function validateCandidateHandoff(input, { invitationId, now }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Candidate handoff is unavailable');
  }
  let prototype;
  let keys;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(input);
    keys = Reflect.ownKeys(input);
    descriptors = Object.getOwnPropertyDescriptors(input);
  } catch {
    throw new TypeError('Candidate handoff is unavailable');
  }
  if (
    ![Object.prototype, null].includes(prototype)
    || keys.length !== CANDIDATE_HANDOFF_KEYS.length
    || keys.some((key) => typeof key !== 'string' || !CANDIDATE_HANDOFF_KEY_SET.has(key))
  ) {
    throw new TypeError('Candidate handoff is unavailable');
  }
  const value = Object.create(null);
  for (const key of CANDIDATE_HANDOFF_KEYS) {
    const descriptor = descriptors[key];
    if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('Candidate handoff is unavailable');
    }
    value[key] = descriptor.value;
  }

  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const issuedAt = canonicalCandidateInstant(value.issuedAt, 'issuedAt');
  const expiresAt = canonicalCandidateInstant(value.expiresAt, 'expiresAt');
  if (
    value.schemaVersion !== LOR_CANDIDATE_HANDOFF_SCHEMA
    || value.authoritySource !== 'server_verified_invitation_token_exchange'
    || value.invitationId !== invitationId
    || !SEALED_CANDIDATE_HANDOFF.test(value.sealedHandoff ?? '')
    || value.singlePurpose !== true
    || value.clientAsserted !== false
    || !Number.isFinite(nowMs)
    || issuedAt > nowMs + LOR_CANDIDATE_HANDOFF_CLOCK_SKEW_MS
    || expiresAt <= nowMs
    || expiresAt <= issuedAt
    || expiresAt - issuedAt > LOR_CANDIDATE_HANDOFF_MAX_LIFETIME_MS
  ) {
    throw new TypeError('Candidate handoff is unavailable');
  }
  return Object.freeze({
    sealedHandoff: value.sealedHandoff,
    maxAgeSeconds: Math.max(1, Math.min(
      LOR_CANDIDATE_HANDOFF_MAX_LIFETIME_MS / 1_000,
      Math.ceil((expiresAt - nowMs) / 1_000),
    )),
  });
}

/** @param {import('node:http').IncomingMessage} request */
async function readCandidateStartPayload(request) {
  if (requestHeader(request, 'content-type').toLowerCase() !== 'application/json') {
    throw new TypeError('Candidate start request is invalid');
  }
  if (!['', 'identity'].includes(requestHeader(request, 'content-encoding').toLowerCase())) {
    throw new TypeError('Candidate start request is invalid');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > LOR_CANDIDATE_START_MAX_BODY_BYTES) {
      throw new TypeError('Candidate start request is invalid');
    }
    chunks.push(buffer);
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new TypeError('Candidate start request is invalid');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Candidate start request is invalid');
  }
  let keys;
  let descriptors;
  let prototype;
  try {
    keys = Reflect.ownKeys(payload);
    descriptors = Object.getOwnPropertyDescriptors(payload);
    prototype = Object.getPrototypeOf(payload);
  } catch {
    throw new TypeError('Candidate start request is invalid');
  }
  if (
    prototype !== Object.prototype
    || keys.length !== 2
    || !keys.every((key) => typeof key === 'string' && ['invitationId', 'rawToken'].includes(key))
  ) {
    throw new TypeError('Candidate start request is invalid');
  }
  for (const key of ['invitationId', 'rawToken']) {
    const descriptor = descriptors[key];
    if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('Candidate start request is invalid');
    }
  }
  const invitationId = descriptors.invitationId.value;
  const rawToken = descriptors.rawToken.value;
  if (!CANDIDATE_LOCATOR.test(invitationId ?? '') || !CANDIDATE_RAW_TOKEN.test(rawToken ?? '')) {
    throw new TypeError('Candidate start request is invalid');
  }
  return Object.freeze({ invitationId, rawToken });
}

/** @param {string} value @param {number} maxAgeSeconds */
function candidateHandoffCookie(value, maxAgeSeconds) {
  return `${LOR_CANDIDATE_HANDOFF_COOKIE_NAME}=${value}; Max-Age=${maxAgeSeconds}; Path=${LOR_CANDIDATE_HANDOFF_COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCandidateHandoffCookie() {
  return candidateHandoffCookie('', 0);
}

/**
 * Binary export responses are allowlisted by content type. The list is deliberately narrow and
 * deliberately excludes anything the browser could treat as active content on this origin: an
 * export route must never become an HTML/SVG/script delivery channel for the protected surface.
 */
const BINARY_CONTENT_TYPES = new Set([
  'application/octet-stream',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function sanitizeDownloadFilename(value) {
  const base = path.basename(String(value ?? ''))
    .replace(/[^A-Za-z0-9._-]/gu, '_')
    .replace(/^[._]+/u, '')
    .slice(0, 128);
  return base || 'download';
}

/**
 * @param {unknown} body
 * @returns {Buffer | null}
 */
function toResponseBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(new Uint8Array(body));
  return null;
}

/**
 * Binary sibling of sendJson. It carries the identical security header set (including nosniff,
 * no-store, and the LOR CSP) and adds only Content-Type/Length/Disposition. It performs no
 * authorization of its own and must therefore only ever be reached after handleApi's
 * authorize -> CSRF -> application-availability sequence has already passed.
 *
 * @param {import('node:http').ServerResponse} response
 * @param {number} status
 * @param {unknown} body
 * @param {{ contentType?: string, filename?: string, sensitive?: boolean }} [options]
 */
function sendBuffer(
  response,
  status,
  body,
  { contentType = '', filename = '', sensitive = false } = {},
) {
  const buffer = toResponseBuffer(body);
  const normalizedType = String(contentType || '').trim().toLowerCase();
  let cleared = false;
  const clearSensitiveBuffer = () => {
    if (cleared || sensitive !== true) return;
    cleared = true;
    buffer?.fill(0);
    if ((Buffer.isBuffer(body) || body instanceof Uint8Array) && body !== buffer) body.fill(0);
    if (body instanceof ArrayBuffer && body !== buffer?.buffer) {
      new Uint8Array(body).fill(0);
    }
  };
  if (!buffer || !BINARY_CONTENT_TYPES.has(normalizedType)) {
    clearSensitiveBuffer();
    sendJson(response, 500, {
      error: 'lor_binary_response_rejected',
      message: 'The LOR Studio binary response did not satisfy the export contract.',
    });
    return;
  }

  const safeName = sanitizeDownloadFilename(filename);
  try {
    response.writeHead(status, {
      ...commonHeaders(normalizedType),
      'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      'Content-Length': String(buffer.byteLength),
    });
    if (sensitive === true && typeof response.once === 'function') {
      response.once('finish', clearSensitiveBuffer);
      response.once('close', clearSensitiveBuffer);
      response.once('error', clearSensitiveBuffer);
    }
    response.end(buffer, clearSensitiveBuffer);
  } catch {
    clearSensitiveBuffer();
    throw new Error('LOR_BINARY_RESPONSE_SEND_FAILED');
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {LorAccessFailure} failure
 */
function sendAccessPage(response, failure) {
  const login = failure.status === 401
    ? '<p><a href="/api/auth/start?final=%2Flor-studio%2F">Sign in through MissionMed</a></p>'
    : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOR Studio</title><style>body{background:#07181a;color:#f7fbfb;font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}main{max-width:620px;background:#0c2b2e;border:1px solid #315e60;border-radius:20px;padding:34px}h1{margin-top:0}p{color:#c9dcda;line-height:1.55}a{color:#79ddd3;font-weight:800}</style></head><body><main><h1>LOR Studio is unavailable</h1><p>${escapeHtml(failure.message)}</p>${login}<p><small>Reference: ${escapeHtml(failure.error)}</small></p></main></body></html>`;
  response.writeHead(failure.status, commonHeaders('text/html; charset=utf-8'));
  response.end(html);
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {string} pathname
 * @param {string} publicDirectory
 */
async function serveProtectedAsset(
  request,
  response,
  pathname,
  publicDirectory,
  forcedAssetName = null,
) {
  if (!['GET', 'HEAD'].includes(String(request.method || 'GET').toUpperCase())) {
    sendJson(response, 405, { error: 'method_not_allowed', allowed: ['GET', 'HEAD'] }, { Allow: 'GET, HEAD' });
    return;
  }

  const suffix = pathname.slice(LOR_STUDIO_ROUTE_PREFIX.length).replace(/^\/+|\/+$/gu, '');
  const assetName = forcedAssetName
    ?? (FACULTY_INVITATION_PAGE.test(pathname) ? 'index.html' : (suffix || 'index.html'));
  if (!SAFE_ASSETS.has(assetName)) {
    sendJson(response, 404, { error: 'lor_asset_not_found' });
    return;
  }

  const absoluteRoot = path.resolve(publicDirectory);
  const absoluteAsset = path.resolve(absoluteRoot, assetName);
  if (!absoluteAsset.startsWith(`${absoluteRoot}${path.sep}`)) {
    sendJson(response, 403, { error: 'lor_asset_forbidden' });
    return;
  }

  try {
    const details = await stat(absoluteAsset);
    if (!details.isFile()) throw new Error('not_file');
    const headers = {
      ...commonHeaders(ASSET_CONTENT_TYPES[path.extname(absoluteAsset)] || 'application/octet-stream'),
      'Content-Length': String(details.size),
    };
    response.writeHead(200, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(absoluteAsset).pipe(response);
  } catch {
    sendJson(response, 404, { error: 'lor_asset_not_found' });
  }
}

/**
 * @param {LorApplicationBootstrap | null | undefined} payload
 * @returns {LorApplicationBootstrap | null}
 */
function normalizeApplicationBootstrap(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const operational = payload.operational === true
    && payload.runtimeMode === 'live'
    && payload.storageMode === 'durable'
    && payload.providersReady === true;
  return {
    operational,
    runtimeMode: operational ? 'live' : 'unavailable',
    storageMode: String(payload.storageMode || 'unavailable'),
    providersReady: payload.providersReady === true,
    capabilities: payload.capabilities && typeof payload.capabilities === 'object' ? payload.capabilities : {},
  };
}

/** @param {LorStudioRuntimeOptions} [options] */
export function createLorStudioRuntime({
  publicDirectory,
  flags = resolveLorStudioFlags(),
  entitlementResolver = createUnavailableLorEntitlementResolver(),
  application = null,
  candidateAuthStartService = null,
  validateCsrf = () => false,
  clock = () => new Date(),
} = {}) {
  if (!publicDirectory) throw new Error('LOR Studio publicDirectory is required.');
  if (!entitlementResolver || typeof entitlementResolver.resolve !== 'function') {
    throw new Error('LOR Studio entitlementResolver.resolve is required.');
  }
  if (
    entitlementResolver.requiresTrustedRequestContext === true
    && typeof entitlementResolver.consumeTrustedRequestContext !== 'function'
  ) {
    throw new Error('LOR Studio trusted entitlement resolver context consumer is required.');
  }
  if (
    candidateAuthStartService !== null
    && (
      !candidateAuthStartService
      || typeof candidateAuthStartService.exchangeInvitationToken !== 'function'
    )
  ) {
    throw new Error('LOR Studio candidateAuthStartService.exchangeInvitationToken is required.');
  }
  const trustedGrantContexts = new WeakMap();
  const candidateGrantContexts = new WeakMap();

  async function runApplicationWithAccess(access, operation, { candidateCredential = false } = {}) {
    const context = trustedGrantContexts.get(access);
    const candidate = candidateGrantContexts.get(access);
    const invoke = candidateCredential && candidate
      ? () => runWithFacultyCandidateCredentialContext(candidate, operation, clock())
      : operation;
    if (!context) return invoke();
    return runWithTrustedRequestContext(context, invoke);
  }

  function invitationIdForCandidatePath(pathname) {
    const pageMatch = FACULTY_INVITATION_PAGE.exec(pathname);
    const apiMatch = FACULTY_INVITATION_BOOTSTRAP.exec(pathname)
      ?? FACULTY_INVITATION_VERIFY.exec(pathname);
    return pageMatch?.[0]
      ? pageMatch[0].split('/').filter(Boolean).at(-1)
      : (apiMatch?.[1] ?? null);
  }

  function hasInvitationBoundCandidateCredential(
    candidateCredential,
    invitationId,
    authenticatedSubject,
  ) {
    try {
      const credential = createFacultyCandidateCredentialContext(candidateCredential, clock());
      return credential.invitationId === invitationId
        && credential.authenticatedSubject === authenticatedSubject;
    } catch {
      return false;
    }
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {LorSession | null} session
   * @returns {Promise<LorAccessFailure | LorAccessGrant>}
   */
  async function authorize(request, session, { url = null, candidateCredential = null } = {}) {
    const freshSession = validateFreshLorSession(session, clock(), {
      requireCanonicalSubject: entitlementResolver.requiresTrustedRequestContext === true,
    });
    if (freshSession.ok === false) return freshSession;

    if (flags.enabled !== true) {
      return accessFailure(404, 'lor_feature_disabled', 'LOR Studio is not enabled in this environment.');
    }
    if (flags.killSwitch !== false) {
      return accessFailure(423, 'lor_kill_switch_active', 'The LOR Studio release kill switch is active.');
    }

    let entitlement;
    let trustedContext = null;
    try {
      entitlement = await entitlementResolver.resolve({
        subject: freshSession.subject,
        session: freshSession.session,
        request,
      });
      if (entitlementResolver.requiresTrustedRequestContext === true) {
        trustedContext = createTrustedRequestContext(
          entitlementResolver.consumeTrustedRequestContext(entitlement),
        );
      }
    } catch {
      return accessFailure(503, 'entitlement_lookup_failed', 'The authoritative LOR entitlement lookup failed closed.');
    }

    const candidateInvitationId = invitationIdForCandidatePath(url?.pathname ?? '');
    const invitationCandidatePolicyAuthorized = (
      trustedContext?.canaryAuthorized === true
      && candidateInvitationId !== null
      && session?.[LOR_SESSION_IDENTITY_CLASS_FIELD] === LOR_CANDIDATE_IDENTITY_CLASS
      && session?.[LOR_SESSION_CANDIDATE_INVITATION_FIELD] === candidateInvitationId
      && hasInvitationBoundCandidateCredential(
        candidateCredential,
        candidateInvitationId,
        freshSession.subject,
      )
    );
    const evaluated = evaluateLorEntitlement(entitlement, {
      requireCanary: flags.requireCanary !== false && !invitationCandidatePolicyAuthorized,
    });
    if (evaluated.ok === false) return evaluated;
    if (String(evaluated.actor.id) !== String(freshSession.subject)) {
      return accessFailure(
        403,
        'entitlement_subject_mismatch',
        'The LOR authorization projection does not match the authenticated principal.',
      );
    }
    if (
      trustedContext
      && (
        trustedContext.authenticatedSubject !== freshSession.subject
        || trustedContext.actorRole !== evaluated.actor.role
      )
    ) {
      return accessFailure(
        403,
        'trusted_context_identity_mismatch',
        'The trusted LOR request context does not match the authenticated principal.',
      );
    }

    const access = { ...evaluated };
    if (trustedContext) trustedGrantContexts.set(access, trustedContext);
    if (candidateInvitationId !== null) {
      if (evaluated.actor.role !== 'faculty') {
        return accessFailure(403, 'faculty_candidate_scope_required', 'Faculty invitation access was denied.');
      }
      let credential;
      try {
        credential = createFacultyCandidateCredentialContext(candidateCredential, clock());
      } catch {
        return accessFailure(403, 'faculty_candidate_credential_required', 'Faculty invitation access was denied.');
      }
      if (
        credential.authenticatedSubject !== freshSession.subject
        || credential.invitationId !== candidateInvitationId
      ) {
        return accessFailure(403, 'faculty_candidate_credential_mismatch', 'Faculty invitation access was denied.');
      }
      candidateGrantContexts.set(access, credential);
    }
    return access;
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   * @param {URL} url
   * @param {LorSession | null} session
   */
  async function handleApi(request, response, url, session, candidateCredential) {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        ...commonHeaders('application/json; charset=utf-8'),
        Allow: 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
      });
      response.end();
      return;
    }

    if (url.pathname === LOR_CANDIDATE_AUTH_START_PATH) {
      if (request.method !== 'POST') {
        sendJson(
          response,
          405,
          { error: 'method_not_allowed' },
          { Allow: 'POST', 'Set-Cookie': clearCandidateHandoffCookie() },
        );
        return;
      }
      if (flags.enabled !== true) {
        sendJson(response, 404, { error: 'lor_feature_disabled' }, {
          'Set-Cookie': clearCandidateHandoffCookie(),
        });
        return;
      }
      if (flags.killSwitch !== false) {
        sendJson(response, 423, { error: 'lor_kill_switch_active' }, {
          'Set-Cookie': clearCandidateHandoffCookie(),
        });
        return;
      }
      const origin = requestHeader(request, 'origin');
      const fetchSite = requestHeader(request, 'sec-fetch-site').toLowerCase();
      const candidateMarker = requestHeader(request, 'x-missionmed-lor-candidate');
      if (
        origin !== url.origin
        || candidateMarker !== '1'
        || (fetchSite !== '' && fetchSite !== 'same-origin')
      ) {
        sendJson(response, 403, {
          error: 'candidate_auth_start_denied',
          message: 'Faculty invitation sign-in could not be started.',
        }, { 'Set-Cookie': clearCandidateHandoffCookie() });
        return;
      }
      if ([...url.searchParams.keys()].length !== 0) {
        sendJson(response, 400, {
          error: 'candidate_auth_start_denied',
          message: 'Faculty invitation sign-in could not be started.',
        }, { 'Set-Cookie': clearCandidateHandoffCookie() });
        return;
      }
      if (!candidateAuthStartService) {
        sendJson(response, 503, {
          error: 'candidate_auth_start_unavailable',
          message: 'Faculty invitation sign-in is temporarily unavailable.',
        }, { 'Set-Cookie': clearCandidateHandoffCookie() });
        return;
      }

      let payload;
      try {
        payload = await readCandidateStartPayload(request);
      } catch {
        sendJson(response, 400, {
          error: 'candidate_auth_start_denied',
          message: 'Faculty invitation sign-in could not be started.',
        }, { 'Set-Cookie': clearCandidateHandoffCookie() });
        return;
      }

      let handoff;
      try {
        const exchanged = await candidateAuthStartService.exchangeInvitationToken({
          invitationId: payload.invitationId,
          rawToken: payload.rawToken,
        });
        handoff = validateCandidateHandoff(exchanged, {
          invitationId: payload.invitationId,
          now: clock(),
        });
      } catch (error) {
        let code = '';
        try {
          code = String(error?.code || '');
        } catch {
          code = '';
        }
        const denied = code === 'INVITATION_DENIED';
        sendJson(response, denied ? 403 : 503, {
          error: denied ? 'candidate_auth_start_denied' : 'candidate_auth_start_unavailable',
          message: denied
            ? 'Faculty invitation sign-in could not be started.'
            : 'Faculty invitation sign-in is temporarily unavailable.',
        }, { 'Set-Cookie': clearCandidateHandoffCookie() });
        return;
      }

      response.writeHead(204, {
        ...commonHeaders('application/json; charset=utf-8'),
        'Set-Cookie': candidateHandoffCookie(handoff.sealedHandoff, handoff.maxAgeSeconds),
      });
      response.end();
      return;
    }

    const access = await authorize(request, session, { url, candidateCredential });
    if (access.ok === false) {
      sendJson(response, access.status, { error: access.error, message: access.message });
      return;
    }

    if (MUTATION_METHODS.has(String(request.method || '').toUpperCase()) && !validateCsrf(request, session)) {
      sendJson(response, 403, { error: 'csrf_validation_failed', message: 'Missing or invalid LOR Studio CSRF token.' });
      return;
    }

    const candidateBootstrap = FACULTY_INVITATION_BOOTSTRAP.exec(url.pathname);
    if (
      (url.pathname === `${LOR_STUDIO_API_PREFIX}/bootstrap` || candidateBootstrap)
      && request.method === 'GET'
    ) {
      const queryKeys = [...url.searchParams.keys()];
      const caseValues = url.searchParams.getAll('case');
      const queryValid = candidateBootstrap
        ? queryKeys.length === 0
        : queryKeys.length === 0 || (
          queryKeys.length === 1
          && queryKeys[0] === 'case'
          && caseValues.length === 1
          && CANDIDATE_LOCATOR.test(caseValues[0])
        );
      if (!queryValid) {
        sendJson(response, 400, { error: 'lor_bootstrap_query_forbidden' });
        return;
      }
      if (!application || typeof application.getBootstrap !== 'function') {
        sendJson(response, 503, {
          error: 'lor_application_unavailable',
          message: 'The durable LOR application runtime has not been configured.',
          operational: false,
          runtimeMode: 'unavailable',
        });
        return;
      }

      let applicationPayload;
      try {
        applicationPayload = await runApplicationWithAccess(access, () => application.getBootstrap({
          actor: access.actor,
          entitlement: access.entitlement,
        }));
      } catch {
        sendJson(response, 503, {
          error: 'lor_application_bootstrap_failed',
          message: 'The LOR application bootstrap failed closed.',
          operational: false,
          runtimeMode: 'unavailable',
        });
        return;
      }

      const bootstrap = normalizeApplicationBootstrap(applicationPayload);
      if (!bootstrap?.operational) {
        sendJson(response, 503, {
          error: 'lor_durable_runtime_required',
          message: 'LOR Studio will not enter live mode without durable storage and verified providers.',
          operational: false,
          runtimeMode: 'unavailable',
          storageMode: bootstrap?.storageMode || 'unavailable',
          providersReady: bootstrap?.providersReady === true,
        });
        return;
      }

      sendJson(response, 200, {
        ...bootstrap,
        ...(candidateBootstrap
          ? { capabilities: Object.freeze({ verifyInvitation: true }) }
          : {}),
        csrfToken: String(session.csrfToken || ''),
      });
      return;
    }

    if (!application || typeof application.handleRequest !== 'function') {
      sendJson(response, 503, {
        error: 'lor_application_unavailable',
        message: 'The durable LOR application runtime has not been configured.',
      });
      return;
    }

    let result;
    try {
      result = await runApplicationWithAccess(
        access,
        () => application.handleRequest({
          request,
          url,
          actor: access.actor,
          entitlement: access.entitlement,
        }),
        { candidateCredential: FACULTY_INVITATION_VERIFY.test(url.pathname) },
      );
    } catch {
      sendJson(response, 500, {
        error: 'lor_application_request_failed',
        message: 'The LOR Studio application request failed safely.',
      });
      return;
    }
    const status = Number.isInteger(result?.status) ? result.status : 200;
    if (result?.binary && typeof result.binary === 'object') {
      sendBuffer(response, status, result.binary.body, {
        contentType: result.binary.contentType,
        filename: result.binary.filename,
        sensitive: result.binary.sensitive === true,
      });
      return;
    }
    sendJson(response, status, result?.body ?? result ?? {});
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   * @param {URL} url
   * @param {{ session?: LorSession | null, candidateCredential?: unknown }} [context]
   */
  async function handle(
    request,
    response,
    url,
    { session = null, candidateCredential = null } = {},
  ) {
    if (!isLorStudioRequestPath(url?.pathname)) return false;

    if (url.pathname === LOR_STUDIO_API_PREFIX || url.pathname.startsWith(`${LOR_STUDIO_API_PREFIX}/`)) {
      await handleApi(request, response, url, session, candidateCredential);
      return true;
    }

    if (FACULTY_INVITATION_PAGE.test(url.pathname)) {
      if (flags.enabled !== true) {
        sendAccessPage(response, accessFailure(
          404,
          'lor_feature_disabled',
          'LOR Studio is not enabled in this environment.',
        ));
        return true;
      }
      if (flags.killSwitch !== false) {
        sendAccessPage(response, accessFailure(
          423,
          'lor_kill_switch_active',
          'The LOR Studio release kill switch is active.',
        ));
        return true;
      }
      const freshSession = validateFreshLorSession(session, clock(), {
        requireCanonicalSubject: entitlementResolver.requiresTrustedRequestContext === true,
      });
      const invitationId = invitationIdForCandidatePath(url.pathname);
      if (
        freshSession.ok === false
        || invitationId === null
        || !hasInvitationBoundCandidateCredential(
          candidateCredential,
          invitationId,
          freshSession.subject,
        )
      ) {
        await serveProtectedAsset(
          request,
          response,
          url.pathname,
          publicDirectory,
          'invitation-auth.html',
        );
        return true;
      }
    }

    if (FACULTY_CANDIDATE_ASSET_PATHS.has(url.pathname)) {
      const freshSession = validateFreshLorSession(session, clock(), {
        requireCanonicalSubject: entitlementResolver.requiresTrustedRequestContext === true,
      });
      const invitationId = session?.[LOR_SESSION_CANDIDATE_INVITATION_FIELD];
      if (
        flags.enabled === true
        && flags.killSwitch === false
        && freshSession.ok === true
        && session?.[LOR_SESSION_IDENTITY_CLASS_FIELD] === LOR_CANDIDATE_IDENTITY_CLASS
        && CANDIDATE_LOCATOR.test(invitationId ?? '')
        && hasInvitationBoundCandidateCredential(
          candidateCredential,
          invitationId,
          freshSession.subject,
        )
      ) {
        await serveProtectedAsset(request, response, url.pathname, publicDirectory);
        return true;
      }
    }

    const access = await authorize(request, session, { url, candidateCredential });
    if (access.ok === false) {
      sendAccessPage(response, access);
      return true;
    }

    await serveProtectedAsset(request, response, url.pathname, publicDirectory);
    return true;
  }

  return Object.freeze({
    authorize,
    handle,
    flags: Object.freeze({ ...flags }),
  });
}
