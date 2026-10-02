import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const AUDIENCE = 'ivoc-rise-owner-projection';
const SOURCE = 'wordpress_current_rise_owner';
const REQUEST_DOMAIN = 'mmrise-ivoc-eligibility-request-v1\n';
const RESPONSE_DOMAIN = 'mmrise-ivoc-eligibility-response-v1\n';
const MAX_BYTES = 4096;

// DR-361: this receipt authorizes one internal read, never a reusable login.
export async function readCurrentRiseEligibility({
  wpBase, secret, subject, fetchImpl = fetch, now = Date.now,
  nonce = randomUUID(), timeoutMs = 3000,
} = {}) {
  try {
    const url = new URL('/wp-json/missionmed-rise/v1/ivoc-eligibility', wpBase);
    if (url.protocol !== 'https:' || url.username || url.password
        || !/^[1-9][0-9]{0,14}$/u.test(String(subject))
        || typeof secret !== 'string' || secret.length < 32
        || !/^[0-9a-f-]{36}$/u.test(nonce)) return null;
    const iat = Math.floor(now() / 1000);
    const body = JSON.stringify({ subject: 'wp:' + subject, audience: AUDIENCE, iat, nonce });
    const signature = createHmac('sha256', secret).update(REQUEST_DOMAIN + body).digest('hex');
    const response = await fetchImpl(url, {
      method: 'POST', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-MMED-RISE-Proof': signature },
      body, signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')
        || Number(response.headers.get('content-length')) > MAX_BYTES) return null;
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body ?? []) {
      size += chunk.length;
      if (size > MAX_BYTES) return null;
      chunks.push(Buffer.from(chunk));
    }
    const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof envelope.payload !== 'string' || !/^[a-f0-9]{64}$/u.test(envelope.signature)) return null;
    const expected = createHmac('sha256', secret).update(RESPONSE_DOMAIN + envelope.payload).digest();
    if (!timingSafeEqual(expected, Buffer.from(envelope.signature, 'hex'))) return null;
    const receipt = JSON.parse(envelope.payload);
    const current = Math.floor(now() / 1000);
    if (receipt.subject !== 'wp:' + subject || receipt.audience !== AUDIENCE || receipt.nonce !== nonce
        || receipt.source !== SOURCE || typeof receipt.allowed !== 'boolean' || typeof receipt.admin !== 'boolean'
        || !Number.isInteger(receipt.iat) || receipt.iat < iat - 5 || receipt.iat > current + 5
        || !Number.isInteger(receipt.exp) || receipt.exp <= current || receipt.exp > receipt.iat + 30
        || receipt.exp <= receipt.iat || current - iat > 30) return null;
    return Object.freeze({
      subject: receipt.subject, allowed: receipt.allowed, admin: receipt.admin,
      source: SOURCE, evaluatedAt: receipt.iat, expiresAt: receipt.exp,
    });
  } catch { return null; }
}

export function riseDelegatedProjection(session, receipt, now = Date.now()) {
  const expiry = Math.min(Date.parse(session?.expiresAt), (receipt?.expiresAt || 0) * 1000);
  if (!receipt?.allowed || receipt.subject !== 'wp:' + session?.user?.id
      || !Number.isFinite(expiry) || expiry <= now
      || !/^[A-Za-z0-9_-]{24,256}$/u.test(String(session?.csrfToken || ''))) return null;
  return {
    authenticated: true, sessionPersistent: true, revoked: false, revokedAt: null,
    authAudience: 'rise', audience: 'rise', apiScope: 'rise', accessToken: '',
    csrfToken: session.csrfToken, expiresAt: new Date(expiry).toISOString(),
    // Compatibility labels consumed only by the existing internal RISE adapter.
    // They carry a fresh owner decision, not a fabricated course enrollment.
    risePrivateBeta: true, riseEntitlements: ['FULL_RISE_BETA_ACCESS'],
    user: { id: session.user.id, displayName: session.user.displayName,
      roles: receipt.admin ? ['administrator'] : ['subscriber'] },
    eligibility: { source: receipt.source, evaluatedAt: receipt.evaluatedAt },
  };
}
