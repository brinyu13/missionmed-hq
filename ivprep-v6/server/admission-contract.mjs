const ALLOWED_AUTH_SOURCES = Object.freeze(new Set([
  'wordpress-cookie',
  'wordpress-handoff',
  'wordpress-token',
]));
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_ROLES = 24;

function parseExactIsoTime(value) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 40) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function authenticationDenied(code = 'ivprep_authentication_required') {
  return Object.freeze({ ok: false, status: 401, code });
}

function admissionDenied(code = 'ivprep_admission_denied') {
  return Object.freeze({ ok: false, status: 403, code });
}

export function strictProjectHqSession({
  request,
  hqSession,
  cookieFingerprint,
  registry,
  now = Date.now(),
  maxSessionTtlSeconds = 28_800,
} = {}) {
  if (request?.headers?.authorization || request?.headers?.Authorization) return authenticationDenied();
  if (!hqSession || typeof hqSession !== 'object' || Array.isArray(hqSession)) return authenticationDenied();
  if (!cookieFingerprint || registry.isRevoked(cookieFingerprint)) return authenticationDenied();
  if (hqSession.version !== 1) return authenticationDenied();

  const issuedAtMs = parseExactIsoTime(hqSession.issuedAt);
  const expiresAtMs = parseExactIsoTime(hqSession.expiresAt);
  const maxTtlMs = Math.max(600, Number(maxSessionTtlSeconds) || 0) * 1000;
  if (issuedAtMs == null || expiresAtMs == null) return authenticationDenied();
  if (issuedAtMs > now + MAX_CLOCK_SKEW_MS || expiresAtMs <= now || expiresAtMs <= issuedAtMs) return authenticationDenied();
  if (expiresAtMs - issuedAtMs > maxTtlMs) return authenticationDenied();

  const csrfToken = String(hqSession.csrfToken || '');
  if (!/^[A-Za-z0-9_-]{16,256}$/u.test(csrfToken)) return authenticationDenied();
  if (!ALLOWED_AUTH_SOURCES.has(hqSession.authSource)) return authenticationDenied();

  const wpUserId = Number(hqSession.user?.id);
  if (!Number.isSafeInteger(wpUserId) || wpUserId <= 0) return authenticationDenied();
  const roles = hqSession.user?.roles;
  if (!Array.isArray(roles) || roles.length > MAX_ROLES || roles.some((role) => typeof role !== 'string' || role.length > 80)) {
    return authenticationDenied();
  }

  const subject = `wp:${wpUserId}`;
  const entitlement = registry.entitlementFor(subject);
  if (!entitlement || entitlement.voice !== true) return admissionDenied();

  return Object.freeze({
    ok: true,
    status: 200,
    subject,
    supabaseSubject: hqSession.supabaseUserId == null ? null : String(hqSession.supabaseUserId),
    issuedAtMs,
    expiresAtMs,
    csrfToken,
    authSource: hqSession.authSource,
    cookieFingerprint,
    entitlement: Object.freeze(entitlement),
  });
}

export function validateIvPrepMutation({ request, admission, expectedOrigin }) {
  if (!admission?.ok) return admission;
  const csrf = String(request?.headers?.['x-mmhq-csrf'] || '');
  if (!csrf || csrf !== admission.csrfToken) return admissionDenied();
  const origin = String(request?.headers?.origin || '');
  const fetchSite = String(request?.headers?.['sec-fetch-site'] || '').toLowerCase();
  if (!origin || origin !== expectedOrigin || (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite))) {
    return admissionDenied();
  }
  return Object.freeze({ ok: true, status: 200 });
}

export function publicAdmissionState(admission, { videoEnabled = false, founderPaidTest = null, hqSession = null } = {}) {
  // Y1-Y2-CAM-V6-3505: the product had no way to render who is actually signed in, so
  // the shell displayed a fixture student ("Priya Sharma") as though it were a real
  // assignment. This exposes the viewer's OWN identity back to their own browser -
  // their WordPress subject, id and roles. No other subject's data, and no
  // credential, token or entitlement secret is added here.
  const roles = Array.isArray(hqSession?.user?.roles)
    ? hqSession.user.roles.filter((role) => typeof role === 'string').slice(0, 24)
    : [];
  return Object.freeze({
    admitted: admission?.ok === true,
    identity: admission?.ok === true
      ? Object.freeze({
          subject: admission.subject,
          wpUserId: Number(String(admission.subject).replace(/^wp:/u, '')) || null,
          roles: Object.freeze(roles),
          founder: admission.entitlement?.founder === true,
        })
      : null,
    voiceEnabled: admission?.ok === true && admission.entitlement.voice === true,
    videoEnabled: admission?.ok === true && videoEnabled === true && admission.entitlement.video === true,
    videoSecondsAvailable: admission?.ok === true ? admission.entitlement.grantedVideoSeconds : 0,
    entitlementRevision: admission?.ok === true ? admission.entitlement.revision : null,
    sessionExpiresAt: admission?.ok === true ? new Date(admission.expiresAtMs).toISOString() : null,
    mutationCsrfToken: admission?.ok === true ? admission.csrfToken : null,
    founderPaidTest: admission?.ok === true && founderPaidTest?.enabled === true
      ? Object.freeze({
          enabled: true,
          testNo: founderPaidTest.testNo,
          agentId: founderPaidTest.agentId,
          profile: founderPaidTest.profile,
          maximumSeconds: founderPaidTest.maximumSeconds,
          voices: Object.freeze([...(founderPaidTest.voices || [])]),
          state: founderPaidTest.state,
        })
      : Object.freeze({ enabled: false }),
  });
}
