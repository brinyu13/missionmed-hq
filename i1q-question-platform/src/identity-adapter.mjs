import { IDENTITY_CONTRACT_VERSION, ROLES } from './contracts.mjs';

export { IDENTITY_CONTRACT_VERSION };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
const ALLOWED_JWT_ALGORITHMS = new Set(['ES256', 'RS256', 'HS256']);
const CREDENTIAL_STATUSES = new Set(['unverified', 'verified', 'expired', 'suspended', 'not_applicable']);

export class IdentityAdapterError extends Error {
  constructor(code, statusCode = 401, options = {}) {
    super(code, options);
    this.name = 'IdentityAdapterError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function fail(code, statusCode = 401) {
  throw new IdentityAdapterError(code, statusCode);
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function base64UrlJson(segment, code) {
  try {
    const value = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
    return value;
  } catch (error) {
    if (error instanceof IdentityAdapterError) throw error;
    fail(code);
  }
}

function parseUntrustedJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/u.test(part))) {
    fail('access_token_malformed');
  }
  const header = base64UrlJson(parts[0], 'access_token_header_invalid');
  const claims = base64UrlJson(parts[1], 'access_token_claims_invalid');
  if (!ALLOWED_JWT_ALGORITHMS.has(stringValue(header.alg))) fail('access_token_algorithm_invalid');
  if (stringValue(header.typ) && stringValue(header.typ) !== 'JWT') fail('access_token_type_invalid');
  return { header, claims };
}

function bearerToken(request) {
  const authorization = stringValue(request?.headers?.authorization);
  const match = authorization.match(/^Bearer ([A-Za-z0-9._~-]+)$/u);
  if (!match) fail('bearer_token_required');
  return match[1];
}

function audienceIncludes(audience, expectedAudience) {
  if (typeof audience === 'string') return audience === expectedAudience;
  return Array.isArray(audience)
    && audience.length > 0
    && audience.every((value) => typeof value === 'string')
    && audience.includes(expectedAudience);
}

function validateClaims(claims, {
  expectedIssuer,
  expectedAudience,
  nowMs,
  clockSkewSeconds,
}) {
  const nowSeconds = Math.floor(nowMs / 1000);
  const issuer = stringValue(claims.iss);
  const subject = stringValue(claims.sub).toLowerCase();
  const sessionId = stringValue(claims.session_id).toLowerCase();
  const issuedAt = Number(claims.iat);
  const expiresAt = Number(claims.exp);
  const notBefore = claims.nbf === undefined ? null : Number(claims.nbf);

  if (issuer !== expectedIssuer) fail('token_issuer_invalid');
  if (!audienceIncludes(claims.aud, expectedAudience)) fail('token_audience_invalid');
  if (claims.role !== 'authenticated') fail('token_role_invalid');
  if (claims.is_anonymous !== false) fail('anonymous_identity_forbidden');
  if (!UUID_PATTERN.test(subject)) fail('token_subject_invalid');
  if (!UUID_PATTERN.test(sessionId)) fail('token_session_invalid');
  if (!Number.isFinite(issuedAt) || issuedAt > nowSeconds + clockSkewSeconds) fail('token_issued_at_invalid');
  if (!Number.isFinite(expiresAt) || expiresAt <= nowSeconds - clockSkewSeconds || expiresAt <= issuedAt) {
    fail('token_expired');
  }
  if (notBefore !== null && (!Number.isFinite(notBefore) || notBefore > nowSeconds + clockSkewSeconds)) {
    fail('token_not_yet_valid');
  }

  return Object.freeze({
    subject,
    sessionId,
    issuedAt: new Date(issuedAt * 1000).toISOString(),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  });
}

function normalizeMemberships(profile, actorId, nowMs) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) fail('role_profile_invalid');
  if (stringValue(profile.actor_id).toLowerCase() !== actorId) fail('role_profile_actor_mismatch');
  if (profile.active !== true || profile.revoked === true || stringValue(profile.revoked_at)) {
    fail('identity_revoked');
  }

  const memberships = Array.isArray(profile.memberships)
    ? profile.memberships
    : (Array.isArray(profile.roles) ? profile.roles.map((name) => ({ name })) : []);
  const roles = [];
  for (const membership of memberships) {
    if (!membership || typeof membership !== 'object' || Array.isArray(membership)) {
      fail('role_membership_invalid');
    }
    const name = stringValue(membership.name);
    if (!ROLES.includes(name)) fail('role_membership_unknown');
    const validFrom = stringValue(membership.valid_from);
    const validUntil = stringValue(membership.valid_until);
    const revokedAt = stringValue(membership.revoked_at);
    if (revokedAt) continue;
    if (validFrom && !Number.isFinite(Date.parse(validFrom))) fail('role_membership_invalid');
    if (validUntil && !Number.isFinite(Date.parse(validUntil))) fail('role_membership_invalid');
    if (validFrom && Date.parse(validFrom) > nowMs) continue;
    if (validUntil && Date.parse(validUntil) <= nowMs) continue;
    roles.push(name);
  }

  const uniqueRoles = [...new Set(roles)];
  if (!uniqueRoles.length) fail('i1q_role_required', 403);
  const credentialStatus = stringValue(profile.credential_status) || 'not_applicable';
  if (!CREDENTIAL_STATUSES.has(credentialStatus)) fail('credential_status_invalid');
  const credentialExpiresAt = stringValue(profile.credential_expires_at);
  if (credentialExpiresAt && !Number.isFinite(Date.parse(credentialExpiresAt))) {
    fail('credential_expiry_invalid');
  }
  const currentCredential = !credentialExpiresAt || Date.parse(credentialExpiresAt) > nowMs;

  return Object.freeze({
    roles: Object.freeze(uniqueRoles),
    credentialStatus,
    credentialVerified: credentialStatus === 'verified'
      && Boolean(stringValue(profile.credential_verification_id))
      && currentCredential,
  });
}

function traceIdentity(user, includeEmail) {
  const metadata = user?.user_metadata && typeof user.user_metadata === 'object'
    ? user.user_metadata
    : {};
  const rawWordPressId = Number(metadata.wp_user_id);
  return Object.freeze({
    wordpressUserId: Number.isSafeInteger(rawWordPressId) && rawWordPressId > 0 ? rawWordPressId : null,
    email: includeEmail ? stringValue(user?.email).toLowerCase() || null : null,
  });
}

async function emitAudit(audit, event) {
  try {
    await audit(Object.freeze(event));
  } catch (cause) {
    throw new IdentityAdapterError('identity_audit_unavailable', 503, { cause });
  }
}

function safeRequestId(request) {
  const candidate = stringValue(request?.headers?.['x-request-id']);
  return SAFE_REQUEST_ID_PATTERN.test(candidate) ? candidate : null;
}

export function createI1QIdentityResolver({
  expectedIssuer,
  expectedAudience = 'authenticated',
  trustedOrigins,
  verifyAccessToken,
  resolveRoleProfile,
  audit,
  includeEmail = false,
  now = () => Date.now(),
  clockSkewSeconds = 30,
} = {}) {
  const issuer = stringValue(expectedIssuer).replace(/\/+$/u, '');
  const audience = stringValue(expectedAudience);
  const origins = [...new Set((Array.isArray(trustedOrigins) ? trustedOrigins : []).map((value) => {
    try {
      const parsed = new URL(stringValue(value));
      return parsed.protocol === 'https:' && parsed.origin === stringValue(value) ? parsed.origin : '';
    } catch {
      return '';
    }
  }).filter(Boolean))];

  if (!issuer.startsWith('https://') || !issuer.endsWith('/auth/v1')) fail('identity_issuer_configuration_invalid', 500);
  if (!audience) fail('identity_audience_configuration_invalid', 500);
  if (!origins.length) fail('identity_origin_configuration_invalid', 500);
  if (typeof verifyAccessToken !== 'function') fail('identity_verifier_required', 500);
  if (typeof resolveRoleProfile !== 'function') fail('identity_role_resolver_required', 500);
  if (typeof audit !== 'function') fail('identity_audit_sink_invalid', 500);
  if (typeof now !== 'function') fail('identity_clock_invalid', 500);

  return async function resolveI1QIdentity(request) {
    const validatedAtMs = now();
    let auditCode = 'authentication_failed';
    try {
      const token = bearerToken(request);
      const { claims } = parseUntrustedJwt(token);
      const validatedClaims = validateClaims(claims, {
        expectedIssuer: issuer,
        expectedAudience: audience,
        nowMs: validatedAtMs,
        clockSkewSeconds,
      });

      const user = await verifyAccessToken({ accessToken: token, claims });
      const verifiedUser = user?.user && typeof user.user === 'object' ? user.user : user;
      if (!verifiedUser || stringValue(verifiedUser.id).toLowerCase() !== validatedClaims.subject) {
        fail('verified_user_mismatch');
      }
      if (verifiedUser.is_anonymous === true) fail('anonymous_identity_forbidden');
      const bannedUntil = Date.parse(stringValue(verifiedUser.banned_until));
      if (Number.isFinite(bannedUntil) && bannedUntil > validatedAtMs) fail('identity_revoked');

      const profile = await resolveRoleProfile({
        actorId: validatedClaims.subject,
        accessToken: token,
        sessionId: validatedClaims.sessionId,
      });
      const membership = normalizeMemberships(profile, validatedClaims.subject, validatedAtMs);
      const trace = traceIdentity(verifiedUser, includeEmail);

      return Object.freeze({
        validated: true,
        actor: Object.freeze({ id: validatedClaims.subject, roles: membership.roles }),
        session: Object.freeze({
          id: validatedClaims.sessionId,
          issued_at: validatedClaims.issuedAt,
          expires_at: validatedClaims.expiresAt,
          validated_at: new Date(validatedAtMs).toISOString(),
          revoked: false,
        }),
        identity: Object.freeze({
          contract_version: IDENTITY_CONTRACT_VERSION,
          canonical_actor_id: validatedClaims.subject,
          supabase_user_id: validatedClaims.subject,
          wordpress_user_id: trace.wordpressUserId,
          email: trace.email,
          credential_status: membership.credentialStatus,
          credential_verified: membership.credentialVerified,
          active: true,
          revoked: false,
        }),
        request_security: Object.freeze({
          transport: 'bearer',
          session_id: validatedClaims.sessionId,
          csrf_token: '',
          trusted_origins: origins,
        }),
      });
    } catch (error) {
      auditCode = error instanceof IdentityAdapterError ? error.code : 'identity_provider_unavailable';
      await emitAudit(audit, {
        event: 'privileged_identity_resolution_failed',
        code: auditCode,
        request_id: safeRequestId(request),
        occurred_at: new Date(validatedAtMs).toISOString(),
      });
      if (error instanceof IdentityAdapterError) throw error;
      throw new IdentityAdapterError(auditCode, 401, { cause: error });
    }
  };
}

function canonicalSupabaseConfiguration(supabaseUrl, projectRef) {
  let parsed;
  try {
    parsed = new URL(stringValue(supabaseUrl));
  } catch {
    fail('supabase_url_invalid', 500);
  }
  const ref = stringValue(projectRef).toLowerCase();
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    fail('supabase_url_invalid', 500);
  }
  if (!/^[a-z0-9]{20}$/u.test(ref) || parsed.hostname !== `${ref}.supabase.co`) {
    fail('supabase_project_mismatch', 500);
  }
  return Object.freeze({ origin: parsed.origin, issuer: `${parsed.origin}/auth/v1` });
}

function rejectPrivilegedApiKey(key) {
  const value = stringValue(key);
  if (!value) fail('supabase_publishable_key_required', 500);
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/u.test(value)) return value;
  const parts = value.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload?.role === 'service_role') fail('service_role_key_forbidden', 500);
      if (payload?.role !== 'anon') fail('supabase_publishable_key_invalid', 500);
      return value;
    } catch (error) {
      if (error instanceof IdentityAdapterError) throw error;
      fail('supabase_publishable_key_invalid', 500);
    }
  }
  if (/^(?:sb_secret_|service[_-]?role)/iu.test(value)) fail('service_role_key_forbidden', 500);
  fail('supabase_publishable_key_invalid', 500);
}

export function createSupabaseUserVerifier({
  supabaseUrl,
  projectRef,
  publishableKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5_000,
} = {}) {
  const configuration = canonicalSupabaseConfiguration(supabaseUrl, projectRef);
  const apiKey = rejectPrivilegedApiKey(publishableKey);
  if (typeof fetchImpl !== 'function') fail('identity_fetch_required', 500);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 250 || timeoutMs > 15_000) fail('identity_timeout_invalid', 500);

  return async function verifySupabaseUser({ accessToken }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${configuration.origin}/auth/v1/user`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          apikey: apiKey,
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch (error) {
      throw new IdentityAdapterError('identity_provider_unavailable', 401, { cause: error });
    } finally {
      clearTimeout(timer);
    }
    if (!response || response.status !== 200) {
      fail(response && response.status >= 500 ? 'identity_provider_unavailable' : 'access_token_invalid');
    }
    try {
      return await response.json();
    } catch {
      fail('identity_provider_response_invalid');
    }
  };
}

export function createSupabaseRoleProfileResolver({
  supabaseUrl,
  projectRef,
  publishableKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5_000,
} = {}) {
  const configuration = canonicalSupabaseConfiguration(supabaseUrl, projectRef);
  const apiKey = rejectPrivilegedApiKey(publishableKey);
  if (typeof fetchImpl !== 'function') fail('identity_fetch_required', 500);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 250 || timeoutMs > 15_000) fail('identity_timeout_invalid', 500);

  return async function resolveSupabaseRoleProfile({ accessToken }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${configuration.origin}/rest/v1/rpc/resolve_current_identity`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Profile': 'i1q',
          'Content-Profile': 'i1q',
          'Content-Type': 'application/json',
          apikey: apiKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: '{}',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch (error) {
      throw new IdentityAdapterError('role_profile_provider_unavailable', 401, { cause: error });
    } finally {
      clearTimeout(timer);
    }
    if (!response || response.status !== 200) {
      fail(response && response.status >= 500 ? 'role_profile_provider_unavailable' : 'role_profile_denied');
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      fail('role_profile_response_invalid');
    }
    const profile = Array.isArray(payload) && payload.length === 1 ? payload[0] : payload;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) fail('role_profile_response_invalid');
    if (profile.identity_contract_version !== IDENTITY_CONTRACT_VERSION) fail('identity_contract_version_mismatch');
    return profile;
  };
}

export function ranklistIqIdentityConfiguration() {
  const projectRef = 'fglyvdykwgbuivikqoah';
  const origin = `https://${projectRef}.supabase.co`;
  return Object.freeze({ projectRef, origin, issuer: `${origin}/auth/v1` });
}
