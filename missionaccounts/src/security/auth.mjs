import { createHmac, createPublicKey, timingSafeEqual, verify } from 'node:crypto';

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const signedRoles = new Set(['registered', 'student', 'missionaccounts_admin', 'founder']);

function decodePart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function deny(message, status = 401) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

let jwksCache = { expiresAt: 0, keys: [] };

async function getJwks(url) {
  if (Date.now() < jwksCache.expiresAt) return jwksCache.keys;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) deny('Matrix identity keys are unavailable', 503);
  const body = await response.json();
  jwksCache = { keys: body.keys || [], expiresAt: Date.now() + 300_000 };
  return jwksCache.keys;
}

function verifySharedSecretSignature(signed, signature, secret) {
  if (typeof secret !== 'string' || secret.length < 32) deny('MissionAccounts signing secret is unavailable', 503);
  const expected = createHmac('sha256', secret).update(signed).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) deny('Identity token signature invalid');
}

function verifyClaims(payload, config) {
  const now = Math.floor(Date.now() / 1000);
  if (!uuidPattern.test(String(payload.sub || ''))) deny('Identity token subject is invalid');
  if (!uuidPattern.test(String(payload.jti || ''))) deny('Identity token identifier is invalid');
  if (!Number.isFinite(payload.iat) || payload.iat > now + 30) deny('Identity token issued-at claim is invalid');
  if (!Number.isFinite(payload.exp) || payload.exp <= now) deny('Identity token is expired or incomplete');
  if (payload.nbf != null && (!Number.isFinite(payload.nbf) || payload.nbf > now + 30)) deny('Identity token is not active');
  if (payload.iss !== config.issuer) deny('Identity token issuer mismatch');
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(config.audience)) deny('Identity token audience mismatch', 403);
}

function normalizedProgramAccess(value, role) {
  if (value == null && role !== 'registered') {
    return {
      registered: true,
      programs: {
        mission_residency: { enrolled: false },
        examprep: { enrolled: true },
        clinicals: { enrolled: false },
      },
    };
  }
  if (!value || value.registered !== true || !value.programs || typeof value.programs !== 'object') {
    deny('Identity token program access is invalid', 403);
  }
  return {
    registered: true,
    programs: {
      mission_residency: { enrolled: value.programs.mission_residency?.enrolled === true },
      examprep: { enrolled: value.programs.examprep?.enrolled === true },
      clinicals: { enrolled: value.programs.clinicals?.enrolled === true },
    },
  };
}

function identityFromClaims(payload) {
  const signedRole = String(payload.app_role || '');
  const legacyRoles = Array.isArray(payload.app_metadata?.roles) ? payload.app_metadata.roles : [];
  const roles = signedRole ? [signedRole] : legacyRoles.filter(role => signedRoles.has(role));
  if (roles.length !== 1 || !signedRoles.has(roles[0])) deny('Identity token role is invalid', 403);
  if (payload.missionaccounts_eligible !== true) deny('MissionAccounts access is not active', 403);
  const programAccess = normalizedProgramAccess(payload.program_access, roles[0]);
  const wpUserId = Number(payload.wp_user_id);
  if (!Number.isSafeInteger(wpUserId) || wpUserId <= 0) deny('Identity token WordPress user is invalid');
  return {
    userId: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : '',
    roles,
    claims: payload,
    wpUserId,
    displayName: typeof payload.name === 'string' ? payload.name : '',
    firstName: typeof payload.first_name === 'string' ? payload.first_name : '',
    avatarThumbnailUrl: typeof payload.avatar_thumbnail_url === 'string' ? payload.avatar_thumbnail_url : '',
    programAccess,
  };
}

export async function verifyMatrixJwt(token, config) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) deny('Authentication required');
  const [encodedHeader, encodedPayload, signature] = parts;
  let header;
  let payload;
  try {
    header = decodePart(encodedHeader);
    payload = decodePart(encodedPayload);
  } catch {
    deny('Identity token encoding is invalid');
  }
  const signed = `${encodedHeader}.${encodedPayload}`;
  if (config.jwtSecret) {
    if (header.alg !== 'HS256' || header.kid) deny('Unsupported identity token');
    verifySharedSecretSignature(signed, signature, config.jwtSecret);
  } else {
    if (header.alg !== 'RS256' || !header.kid || !config.jwksUrl) deny('Unsupported identity token');
    const key = (await getJwks(config.jwksUrl)).find(item => item.kid === header.kid && item.kty === 'RSA');
    if (!key) deny('Identity signing key not found');
    const ok = verify('RSA-SHA256', Buffer.from(signed), createPublicKey({ key, format: 'jwk' }), Buffer.from(signature, 'base64url'));
    if (!ok) deny('Identity token signature invalid');
  }
  verifyClaims(payload, config);
  return identityFromClaims(payload);
}

export async function authenticate(request, config) {
  if (config.localAuth) {
    if (config.production) deny('Local authentication is disabled in production', 500);
    const role = request.headers['x-missionaccounts-local-role'] || 'student';
    const programs = new Set(String(request.headers['x-missionaccounts-local-programs'] || (role === 'registered' ? '' : 'examprep')).split(',').map(value => value.trim()).filter(Boolean));
    return {
      userId: request.headers['x-missionaccounts-local-user'] || '00000000-0000-4000-8000-000000000001',
      email: role === 'student' ? 'student.preview@invalid.local' : 'admin.preview@invalid.local',
      roles: [role],
      programAccess: {
        registered: true,
        programs: {
          mission_residency: { enrolled: programs.has('mission_residency') },
          examprep: { enrolled: programs.has('examprep') },
          clinicals: { enrolled: programs.has('clinicals') },
        },
      },
      local: true,
    };
  }
  const match = String(request.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  return verifyMatrixJwt(match?.[1], config);
}

export function requireRole(identity, allowed) {
  if (!allowed.some(role => identity.roles.includes(role))) deny('You do not have access to this MissionAccounts action', 403);
}
