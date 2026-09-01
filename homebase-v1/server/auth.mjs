import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { config } from './config.mjs';

const encoder = new TextEncoder();
const allowedRoles = new Set(['student', 'mentor', 'admin']);
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function signedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function signedAvatarClaims(claims) {
  const snapshot = claims?.avatar_snapshot && typeof claims.avatar_snapshot === 'object'
    && !Array.isArray(claims.avatar_snapshot)
    ? claims.avatar_snapshot
    : {};
  const activeAvatarId = signedText(claims?.active_avatar_id)
    || signedText(snapshot.active_avatar_id);
  return Object.freeze({
    avatarThumbnailUrl: signedText(claims?.avatar_thumbnail_url)
      || signedText(snapshot.avatar_thumbnail_url),
    avatarUrl: signedText(claims?.avatar_url) || signedText(snapshot.avatar_url),
    activeAvatarId: uuidPattern.test(activeAvatarId) ? activeAvatarId : '',
  });
}

export const fixtureIdentities = Object.freeze({
  student: Object.freeze({
    sub: '31111111-1111-4111-8111-111111111111',
    wp_user_id: 5101,
    name: 'Afthab Salam',
    first_name: 'Afthab',
    email: 'afthab.fabu@gmail.com',
    app_role: 'student',
  }),
  studentOther: Object.freeze({
    sub: '32222222-2222-4222-8222-222222222222',
    wp_user_id: 5102,
    name: 'Silma Raisa',
    first_name: 'Silma',
    email: 'silmaquadery@gmail.com',
    app_role: 'student',
  }),
  studentOutsideRoster: Object.freeze({
    sub: '39999999-9999-4999-8999-999999999999',
    wp_user_id: 5999,
    name: 'Unauthorized Student',
    first_name: 'Unauthorized',
    email: 'not.on.the.roster@example.com',
    app_role: 'student',
  }),
  admin: Object.freeze({
    sub: '3ccccccc-cccc-4ccc-8ccc-cccccccccccc',
    wp_user_id: 6101,
    name: 'Dr Brian',
    first_name: 'Dr Brian',
    app_role: 'admin',
    wordpress_admin: true,
  }),
});

function loopbackAddress(address = '') {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(String(address));
}

export function isLoopbackRequest(request) {
  return loopbackAddress(request?.socket?.remoteAddress);
}

function bearerToken(request) {
  const header = String(request?.headers?.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function verifierKey() {
  if (config.devAuth) return encoder.encode(config.devJwtSecret);
  if (config.jwksUrl) return createRemoteJWKSet(new URL(config.jwksUrl));
  return encoder.encode(config.jwtSecret);
}

export async function verifyToken(token, options = {}) {
  if (!token) {
    const error = new Error('A HomeBase bearer token is required.');
    error.code = 'auth_required';
    throw error;
  }
  const key = options.key || verifierKey();
  const verification = {
    issuer: options.issuer || config.jwtIssuer,
    audience: options.audience || config.jwtAudience,
    clockTolerance: 5,
    requiredClaims: ['sub', 'iat', 'exp', 'jti'],
  };
  if (options.algorithms || key instanceof Uint8Array) {
    verification.algorithms = options.algorithms || ['HS256'];
  }
  const result = await jwtVerify(token, key, verification);
  const claims = result.payload;
  const role = String(claims.app_role || '');
  if (!allowedRoles.has(role)) {
    const error = new Error('The signed HomeBase actor role is invalid.');
    error.code = 'invalid_role_claim';
    throw error;
  }
  if (claims.homebase_eligible !== true) {
    const error = new Error('Your MissionMed HomeBase access is not currently active.');
    error.code = 'eligibility_required';
    throw error;
  }
  if (!uuidPattern.test(String(claims.sub || ''))) {
    const error = new Error('The signed HomeBase subject is invalid.');
    error.code = 'invalid_subject_claim';
    throw error;
  }
  if (!uuidPattern.test(String(claims.jti || ''))) {
    const error = new Error('The signed HomeBase token identifier is invalid.');
    error.code = 'invalid_token_identifier_claim';
    throw error;
  }
  const wpUserId = Number(claims.wp_user_id);
  if (!Number.isSafeInteger(wpUserId) || wpUserId <= 0) {
    const error = new Error('The signed WordPress user identifier is invalid.');
    error.code = 'invalid_wp_user_id_claim';
    throw error;
  }
  const avatar = signedAvatarClaims(claims);
  return Object.freeze({
    sub: String(claims.sub),
    role,
    eligible: true,
    cohort: typeof claims.cohort === 'string' ? claims.cohort.trim() : '',
    wpUserId,
    name: String(claims.name || ''),
    firstName: typeof claims.first_name === 'string' ? claims.first_name : '',
    username: typeof claims.username === 'string' ? claims.username : '',
    email: typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '',
    wordpressAdmin: claims.wordpress_admin === true,
    avatarThumbnailUrl: avatar.avatarThumbnailUrl,
    avatarUrl: avatar.avatarUrl,
    activeAvatarId: avatar.activeAvatarId,
    issuer: String(claims.iss || ''),
  });
}

export async function authorize(request) {
  return verifyToken(bearerToken(request));
}

export async function issueDevToken(persona, request, overrides = {}) {
  if (!config.devAuth || !isLoopbackRequest(request)) {
    const error = new Error('Local fixture identity is unavailable.');
    error.code = 'dev_auth_unavailable';
    throw error;
  }
  const identity = fixtureIdentities[persona];
  if (!identity) {
    const error = new Error('Unknown fixture identity.');
    error.code = 'unknown_fixture_identity';
    throw error;
  }
  return new SignJWT({
    ...identity,
    homebase_eligible: overrides.eligible ?? true,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(config.jwtIssuer)
    .setAudience(config.jwtAudience)
    .setSubject(identity.sub)
    .setIssuedAt()
    .setExpirationTime(overrides.expiration || '5m')
    .setJti(crypto.randomUUID())
    .sign(encoder.encode(config.devJwtSecret));
}
