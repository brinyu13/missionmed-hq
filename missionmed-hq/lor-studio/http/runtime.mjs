import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

export const LOR_STUDIO_ROUTE_PREFIX = '/lor-studio';
export const LOR_STUDIO_API_PREFIX = '/api/lor-studio';

const ASSET_CONTENT_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
});

const SAFE_ASSETS = new Set(['index.html', 'production-adapter.css', 'production-adapter.js']);
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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
/** @typedef {{ ok: true, actor: Readonly<LorActor>, entitlement: Readonly<LorAcceptedEntitlement>, session: LorSession }} LorAccessGrant */

/**
 * @typedef {object} LorEntitlementResolver
 * @property {(input: { subject: string, session: LorSession, request: import('node:http').IncomingMessage }) => Promise<LorEntitlementProjection>} resolve
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
 * @property {(input: { actor: Readonly<LorActor>, entitlement: Readonly<LorAcceptedEntitlement>, session: LorSession }) => Promise<LorApplicationBootstrap>} [getBootstrap]
 * @property {(input: { request: import('node:http').IncomingMessage, url: URL, actor: Readonly<LorActor>, entitlement: Readonly<LorAcceptedEntitlement>, session: LorSession }) => Promise<{ status?: number, body?: unknown }>} [handleRequest]
 */

/**
 * @typedef {object} LorStudioRuntimeOptions
 * @property {string} [publicDirectory]
 * @property {LorStudioFlags} [flags]
 * @property {LorEntitlementResolver} [entitlementResolver]
 * @property {LorApplicationContract | null} [application]
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
 * @returns {LorAccessFailure | LorFreshSession}
 */
export function validateFreshLorSession(session, now = new Date()) {
  if (!session || typeof session !== 'object') {
    return accessFailure(401, 'authentication_required', 'A fresh MissionMed session is required.');
  }

  const subject = String(session?.user?.id ?? '').trim();
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
    'Content-Security-Policy': "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'",
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
async function serveProtectedAsset(request, response, pathname, publicDirectory) {
  if (!['GET', 'HEAD'].includes(String(request.method || 'GET').toUpperCase())) {
    sendJson(response, 405, { error: 'method_not_allowed', allowed: ['GET', 'HEAD'] }, { Allow: 'GET, HEAD' });
    return;
  }

  const suffix = pathname.slice(LOR_STUDIO_ROUTE_PREFIX.length).replace(/^\/+|\/+$/gu, '');
  const assetName = suffix || 'index.html';
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
  validateCsrf = () => false,
  clock = () => new Date(),
} = {}) {
  if (!publicDirectory) throw new Error('LOR Studio publicDirectory is required.');
  if (!entitlementResolver || typeof entitlementResolver.resolve !== 'function') {
    throw new Error('LOR Studio entitlementResolver.resolve is required.');
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {LorSession | null} session
   * @returns {Promise<LorAccessFailure | LorAccessGrant>}
   */
  async function authorize(request, session) {
    const freshSession = validateFreshLorSession(session, clock());
    if (freshSession.ok === false) return freshSession;

    if (flags.enabled !== true) {
      return accessFailure(404, 'lor_feature_disabled', 'LOR Studio is not enabled in this environment.');
    }
    if (flags.killSwitch !== false) {
      return accessFailure(423, 'lor_kill_switch_active', 'The LOR Studio release kill switch is active.');
    }

    let entitlement;
    try {
      entitlement = await entitlementResolver.resolve({
        subject: freshSession.subject,
        session: freshSession.session,
        request,
      });
    } catch {
      return accessFailure(503, 'entitlement_lookup_failed', 'The authoritative LOR entitlement lookup failed closed.');
    }

    const evaluated = evaluateLorEntitlement(entitlement, { requireCanary: flags.requireCanary !== false });
    if (evaluated.ok === false) return evaluated;
    if (String(evaluated.actor.id) !== String(freshSession.subject)) {
      return accessFailure(
        403,
        'entitlement_subject_mismatch',
        'The LOR authorization projection does not match the authenticated principal.',
      );
    }

    return { ...evaluated, session: freshSession.session };
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   * @param {URL} url
   * @param {LorSession | null} session
   */
  async function handleApi(request, response, url, session) {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        ...commonHeaders('application/json; charset=utf-8'),
        Allow: 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
      });
      response.end();
      return;
    }

    const access = await authorize(request, session);
    if (access.ok === false) {
      sendJson(response, access.status, { error: access.error, message: access.message });
      return;
    }

    if (MUTATION_METHODS.has(String(request.method || '').toUpperCase()) && !validateCsrf(request, session)) {
      sendJson(response, 403, { error: 'csrf_validation_failed', message: 'Missing or invalid LOR Studio CSRF token.' });
      return;
    }

    if (url.pathname === `${LOR_STUDIO_API_PREFIX}/bootstrap` && request.method === 'GET') {
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
        applicationPayload = await application.getBootstrap({
          actor: access.actor,
          entitlement: access.entitlement,
          session,
        });
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
      result = await application.handleRequest({
        request,
        url,
        actor: access.actor,
        entitlement: access.entitlement,
        session,
      });
    } catch {
      sendJson(response, 500, {
        error: 'lor_application_request_failed',
        message: 'The LOR Studio application request failed safely.',
      });
      return;
    }
    const status = Number.isInteger(result?.status) ? result.status : 200;
    sendJson(response, status, result?.body ?? result ?? {});
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   * @param {URL} url
   * @param {{ session?: LorSession | null }} [context]
   */
  async function handle(request, response, url, { session = null } = {}) {
    if (!isLorStudioRequestPath(url?.pathname)) return false;

    if (url.pathname === LOR_STUDIO_API_PREFIX || url.pathname.startsWith(`${LOR_STUDIO_API_PREFIX}/`)) {
      await handleApi(request, response, url, session);
      return true;
    }

    const access = await authorize(request, session);
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
