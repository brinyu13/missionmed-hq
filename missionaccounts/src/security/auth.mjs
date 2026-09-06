import { createPublicKey, verify } from 'node:crypto';

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

export async function verifyMatrixJwt(token, config) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) deny('Authentication required');
  const [encodedHeader, encodedPayload, signature] = parts;
  const header = decodePart(encodedHeader);
  const payload = decodePart(encodedPayload);
  if (header.alg !== 'RS256' || !header.kid) deny('Unsupported identity token');
  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || payload.exp <= now || payload.nbf > now + 30) deny('Identity token is expired or incomplete');
  if (payload.iss !== config.issuer) deny('Identity token issuer mismatch');
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(config.audience)) deny('Identity token audience mismatch', 403);
  const key = (await getJwks(config.jwksUrl)).find(item => item.kid === header.kid && item.kty === 'RSA');
  if (!key) deny('Identity signing key not found');
  const ok = verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(signature, 'base64url'));
  if (!ok) deny('Identity token signature invalid');
  const roles = Array.isArray(payload.app_metadata?.roles) ? payload.app_metadata.roles : [];
  return { userId: payload.sub, email: payload.email || '', roles, claims: payload };
}

export async function authenticate(request, config) {
  if (config.localAuth) {
    if (config.production) deny('Local authentication is disabled in production', 500);
    const role = request.headers['x-missionaccounts-local-role'] || 'student';
    return {
      userId: request.headers['x-missionaccounts-local-user'] || '00000000-0000-4000-8000-000000000001',
      email: role === 'student' ? 'student.preview@invalid.local' : 'admin.preview@invalid.local',
      roles: role === 'student' ? ['student'] : [role],
      local: true,
    };
  }
  const match = String(request.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  return verifyMatrixJwt(match?.[1], config);
}

export function requireRole(identity, allowed) {
  if (!allowed.some(role => identity.roles.includes(role))) deny('You do not have access to this MissionAccounts action', 403);
}
