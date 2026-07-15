import { timingSafeEqual } from 'node:crypto';
import { READ_ROLES, ROLES, WRITE_ROLES } from './contracts.mjs';

const DEFAULT_IDENTITY_MAX_AGE_MS = 5 * 60 * 1000;
const FORWARDED_REQUEST_HEADERS = Object.freeze([
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-proto',
  'x-real-ip',
  'cf-connecting-ip',
]);
const REVIEW_ROLES = Object.freeze(['editorial_reviewer', 'physician_reviewer']);
const TRUSTED_IDENTITY_CONTEXTS = new WeakSet();
const TRUSTED_FINALIZATION_CONTEXTS = new WeakSet();

export class AuthorizationError extends Error {
  constructor(code, statusCode = 403) {
    super(code);
    this.name = 'AuthorizationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function authenticationRequired() {
  return new AuthorizationError('authentication_required', 401);
}

function requestVerificationFailed() {
  return new AuthorizationError('request_verification_failed', 403);
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function headerValue(request, name) {
  const value = request.headers?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

function canonicalOrigin(value) {
  const candidate = stringValue(value);
  if (!candidate || candidate === 'null') {
    return null;
  }
  try {
    const parsed = new URL(candidate);
    const loopbackHttp = parsed.protocol === 'http:'
      && ['127.0.0.1', '[::1]', 'localhost'].includes(parsed.hostname);
    if (parsed.origin !== candidate || (parsed.protocol !== 'https:' && !loopbackHttp)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizeActor(actor) {
  if (!actor || typeof actor !== 'object') {
    throw authenticationRequired();
  }
  const id = stringValue(actor.id);
  const roles = [...new Set((Array.isArray(actor.roles) ? actor.roles : [])
    .map((role) => stringValue(role))
    .filter((role) => ROLES.includes(role)))];
  if (!id || !roles.length) {
    throw authenticationRequired();
  }
  return Object.freeze({ id, roles: Object.freeze(roles) });
}

export function requireAnyRole(actorInput, permittedRoles) {
  const actor = normalizeActor(actorInput);
  const permitted = new Set(permittedRoles);
  if (!actor.roles.some((role) => permitted.has(role))) {
    throw new AuthorizationError('role_not_permitted');
  }
  return actor;
}

export function requireRead(actorInput) {
  return requireAnyRole(actorInput, READ_ROLES);
}

export function requireWrite(actorInput) {
  return requireAnyRole(actorInput, WRITE_ROLES);
}

export function requireRole(actorInput, role) {
  return requireAnyRole(actorInput, [role]);
}

export function normalizeIdentityContext(
  resolved,
  { now = Date.now(), maxValidationAgeMs = DEFAULT_IDENTITY_MAX_AGE_MS } = {},
) {
  if (!resolved || typeof resolved !== 'object' || resolved.validated !== true) {
    throw authenticationRequired();
  }

  const actor = normalizeActor(resolved.actor);
  const sessionInput = resolved.session;
  if (!sessionInput || typeof sessionInput !== 'object') {
    throw authenticationRequired();
  }

  const sessionId = stringValue(sessionInput.id);
  const expiresAt = Date.parse(stringValue(sessionInput.expires_at));
  const validatedAt = Date.parse(stringValue(sessionInput.validated_at));
  const boundedMaxAge = Number.isFinite(maxValidationAgeMs) && maxValidationAgeMs > 0
    ? Math.min(maxValidationAgeMs, DEFAULT_IDENTITY_MAX_AGE_MS)
    : DEFAULT_IDENTITY_MAX_AGE_MS;
  const age = now - validatedAt;
  if (
    !sessionId
    || sessionInput.revoked !== false
    || !Number.isFinite(expiresAt)
    || expiresAt <= now
    || !Number.isFinite(validatedAt)
    || age < -30_000
    || age > boundedMaxAge
  ) {
    throw authenticationRequired();
  }

  const securityInput = resolved.request_security;
  const requestSecurity = securityInput && typeof securityInput === 'object'
    ? Object.freeze({
      sessionId: stringValue(securityInput.session_id),
      csrfToken: stringValue(securityInput.csrf_token),
      trustedOrigins: Object.freeze((Array.isArray(securityInput.trusted_origins)
        ? securityInput.trusted_origins
        : []).map(canonicalOrigin).filter(Boolean)),
    })
    : null;

  const context = Object.freeze({
    actor,
    session: Object.freeze({
      id: sessionId,
      expiresAt: new Date(expiresAt).toISOString(),
      validatedAt: new Date(validatedAt).toISOString(),
      revoked: false,
    }),
    requestSecurity,
  });
  TRUSTED_IDENTITY_CONTEXTS.add(context);
  return context;
}

export function enforceRequestIntegrity(request, identityContext) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method || '')) {
    return;
  }
  if (!TRUSTED_IDENTITY_CONTEXTS.has(identityContext)) {
    throw requestVerificationFailed();
  }

  const security = identityContext.requestSecurity;
  const suppliedOrigin = canonicalOrigin(headerValue(request, 'origin'));
  const suppliedToken = headerValue(request, 'x-csrf-token');
  if (
    !security
    || !security.sessionId
    || security.sessionId !== identityContext.session.id
    || security.csrfToken.length < 16
    || !security.trustedOrigins.length
    || !suppliedOrigin
    || !security.trustedOrigins.includes(suppliedOrigin)
    || suppliedToken.length < 16
    || !constantTimeEqual(suppliedToken, security.csrfToken)
  ) {
    throw requestVerificationFailed();
  }
}

export function assertLocalDemoConfiguration(enabled) {
  const nodeEnvironment = String(process.env.NODE_ENV || '').trim().toLowerCase();
  if (enabled && nodeEnvironment === 'production') {
    throw new AuthorizationError('local_demo_forbidden', 403);
  }
}

export function localDemoActor(request, enabled) {
  assertLocalDemoConfiguration(enabled);
  const remote = request.socket?.remoteAddress || '';
  const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  const forwarded = FORWARDED_REQUEST_HEADERS.some((name) => Object.hasOwn(request.headers || {}, name));
  const host = headerValue(request, 'host');
  let loopbackHost = false;
  try {
    const hostname = new URL(`http://${host}`).hostname;
    loopbackHost = ['127.0.0.1', '[::1]', 'localhost'].includes(hostname);
  } catch {
    loopbackHost = false;
  }
  if (!enabled || !loopback || !loopbackHost || forwarded) {
    throw new AuthorizationError('production_identity_adapter_required', 401);
  }
  return Object.freeze({
    id: 'reviewer_local_demo',
    roles: Object.freeze(['platform_admin', 'author', 'editorial_reviewer', 'release_manager', 'read_only']),
  });
}

export function createTrustedFinalizationContext(rawContext, {
  identityContext,
  releaseId,
  channel,
} = {}) {
  if (!TRUSTED_IDENTITY_CONTEXTS.has(identityContext) || !rawContext || typeof rawContext !== 'object') {
    throw new AuthorizationError('finalization_required');
  }
  const actor = identityContext.actor;
  const scope = stringValue(rawContext.scope);
  const reviewerScope = scope === 'approved_internal_reviewer'
    && actor.roles.some((role) => REVIEW_ROLES.includes(role));
  const participantScope = scope === 'participant';
  if (
    rawContext.authorized !== true
    || rawContext.state !== 'finalized'
    || stringValue(rawContext.release_id) !== stringValue(releaseId)
    || stringValue(rawContext.channel) !== stringValue(channel)
    || stringValue(rawContext.session_id) !== identityContext.session.id
    || stringValue(rawContext.actor_id) !== actor.id
    || (!participantScope && !reviewerScope)
  ) {
    throw new AuthorizationError('finalization_required');
  }

  const context = Object.freeze({
    actorId: actor.id,
    sessionId: identityContext.session.id,
    releaseId: stringValue(releaseId),
    channel: stringValue(channel),
    state: 'finalized',
    scope,
    authorized: true,
  });
  TRUSTED_FINALIZATION_CONTEXTS.add(context);
  return context;
}

export function requireTrustedFinalizationContext(context, {
  actorInput,
  releaseId,
  channel,
} = {}) {
  const actor = normalizeActor(actorInput);
  if (
    !TRUSTED_FINALIZATION_CONTEXTS.has(context)
    || context.authorized !== true
    || context.state !== 'finalized'
    || context.actorId !== actor.id
    || context.releaseId !== stringValue(releaseId)
    || context.channel !== stringValue(channel)
  ) {
    throw new AuthorizationError('finalization_required');
  }
  if (
    context.scope === 'approved_internal_reviewer'
    && !actor.roles.some((role) => REVIEW_ROLES.includes(role))
  ) {
    throw new AuthorizationError('finalization_required');
  }
  return context;
}
