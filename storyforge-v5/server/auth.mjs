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
    sub: '11111111-1111-4111-8111-111111111111',
    wp_user_id: 1101,
    name: 'Maya Student',
    first_name: 'Maya',
    app_role: 'student',
  }),
  founderStudent: Object.freeze({
    sub: '11111111-1111-4111-8111-111111111111',
    wp_user_id: 1101,
    name: 'Maya Student',
    first_name: 'Maya',
    app_role: 'student',
    wordpress_admin: true,
  }),
  studentOther: Object.freeze({
    sub: '22222222-2222-4222-8222-222222222222',
    wp_user_id: 1102,
    name: 'Noah Student',
    first_name: 'Noah',
    app_role: 'student',
  }),
  mentor: Object.freeze({
    sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    wp_user_id: 2101,
    name: 'Dr. Chen',
    first_name: 'Dr. Chen',
    app_role: 'mentor',
  }),
  mentorTwo: Object.freeze({
    sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    wp_user_id: 2102,
    name: 'Dr. Rivera',
    first_name: 'Dr. Rivera',
    app_role: 'mentor',
  }),
  unassignedMentor: Object.freeze({
    sub: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    wp_user_id: 2103,
    name: 'Dr. Unassigned',
    first_name: 'Dr. Unassigned',
    app_role: 'mentor',
  }),
  admin: Object.freeze({
    sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    wp_user_id: 3101,
    name: 'Program Admin',
    first_name: 'Program Admin',
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
    const error = new Error('A StoryForge bearer token is required.');
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
    const error = new Error('The signed StoryForge actor role is invalid.');
    error.code = 'invalid_role_claim';
    throw error;
  }
  if (claims.storyforge_eligible !== true) {
    const error = new Error('Your 360 eligibility is not currently active.');
    error.code = 'eligibility_required';
    throw error;
  }
  if (!uuidPattern.test(String(claims.sub || ''))) {
    const error = new Error('The signed StoryForge subject is invalid.');
    error.code = 'invalid_subject_claim';
    throw error;
  }
  if (!uuidPattern.test(String(claims.jti || ''))) {
    const error = new Error('The signed StoryForge token identifier is invalid.');
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
    storyforge_eligible: overrides.eligible ?? true,
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
