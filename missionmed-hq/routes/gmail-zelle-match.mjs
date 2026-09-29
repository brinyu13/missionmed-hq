import crypto from 'node:crypto';
import {
  GMAIL_API_ROOT,
  GMAIL_READONLY_SCOPE,
  getConfiguredAllowedMailboxes,
  googleGetJson,
  mintDelegatedAccessToken,
  readGmailDwdConfig,
  sendJson,
} from './gmail-metadata-proof.mjs';

export const ZELLE_MATCH_PATH = '/api/integrations/gmail/zelle-match';
const MAILBOX = 'info@missionmedinstitute.com';
const CHASE_SENDER = 'no.reply.alerts@chase.com';
const CHASE_SUBJECT = 'You received money with Zelle';
const MAX_AGE_SECONDS = 300;
const MAX_RESULTS = 25;
const replayCache = new Map();

export function isGmailZelleMatchPath(pathname = '') {
  return String(pathname || '').replace(/\/+$/u, '') === ZELLE_MATCH_PATH;
}

export async function handleGmailZelleMatchRoute(request, response, url, context = {}) {
  if (!isGmailZelleMatchPath(url.pathname)) return false;
  if (request.method !== 'POST') {
    sendJson(response, 405, { ok: false, state: 'locked', error: 'method_not_allowed' }, { Allow: 'POST' });
    return true;
  }

  let payload;
  try {
    payload = await context.readJsonBody(request);
  } catch {
    sendJson(response, 400, { ok: false, state: 'locked', error: 'invalid_body' });
    return true;
  }

  const authentication = authenticateRequest(request, payload, context.now || (() => Date.now()));
  if (!authentication.ok) {
    sendJson(response, authentication.status, { ok: false, state: 'locked', error: authentication.error });
    return true;
  }

  const input = normalizeMatchInput(payload);
  if (!input.ok) {
    sendJson(response, 422, { ok: false, state: 'locked', error: input.error });
    return true;
  }

  const allowed = getConfiguredAllowedMailboxes();
  if (!allowed.has(MAILBOX)) {
    sendJson(response, 503, { ok: false, state: 'provider_unavailable', error: 'mailbox_not_allowlisted' });
    return true;
  }

  const config = readGmailDwdConfig();
  if (!config.ok) {
    sendJson(response, 503, { ok: false, state: 'provider_unavailable', error: 'gmail_setup_required' });
    return true;
  }

  const result = await findExactZelleMatch({
    input,
    credentials: config.credentials,
    scopes: config.scopes,
    gmailGetJson: context.gmailGetJson || googleGetJson,
    mintToken: context.mintToken || mintDelegatedAccessToken,
  });
  sendJson(response, result.httpStatus || 200, publicResult(result));
  return true;
}

function authenticateRequest(request, payload, now) {
  const secret = String(process.env.MMHQ_HANDOFF_SECRET || '').trim();
  if (!secret) return { ok: false, status: 503, error: 'shared_secret_missing' };
  const timestamp = String(request.headers['x-mmed-zelle-timestamp'] || '').trim();
  const nonce = String(request.headers['x-mmed-zelle-nonce'] || '').trim();
  const signature = String(request.headers['x-mmed-zelle-signature'] || '').trim().toLowerCase();
  if (!/^\d{10}$/u.test(timestamp) || !/^[a-f0-9]{32}$/u.test(nonce) || !/^[a-f0-9]{64}$/u.test(signature)) {
    return { ok: false, status: 401, error: 'signature_required' };
  }
  if (Math.abs(Math.floor(now() / 1000) - Number(timestamp)) > MAX_AGE_SECONDS) {
    return { ok: false, status: 401, error: 'signature_expired' };
  }
  purgeReplayCache(now());
  if (replayCache.has(nonce)) return { ok: false, status: 409, error: 'request_replay' };
  const canonical = canonicalSignatureInput(timestamp, nonce, payload);
  const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  const suppliedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return { ok: false, status: 401, error: 'signature_invalid' };
  }
  replayCache.set(nonce, now() + MAX_AGE_SECONDS * 1000);
  return { ok: true };
}

export function canonicalSignatureInput(timestamp, nonce, payload = {}) {
  return [
    String(timestamp),
    String(nonce),
    String(Number(payload.order_id || 0)),
    normalizeAmount(payload.expected_amount),
    normalizePayer(payload.payer_name),
    String(Number(payload.order_created_epoch || 0)),
  ].join('\n');
}

function purgeReplayCache(now) {
  for (const [nonce, expiry] of replayCache.entries()) {
    if (expiry <= now) replayCache.delete(nonce);
  }
}

export function normalizeMatchInput(payload = {}) {
  const orderId = Number(payload.order_id || 0);
  const expectedAmount = normalizeAmount(payload.expected_amount);
  const payerName = normalizePayer(payload.payer_name);
  const orderCreatedEpoch = Number(payload.order_created_epoch || 0);
  const consumedFingerprints = Array.isArray(payload.consumed_fingerprints)
    ? payload.consumed_fingerprints.filter((value) => /^[a-f0-9]{64}$/u.test(String(value))).slice(0, 250)
    : [];
  if (!Number.isInteger(orderId) || orderId < 1) return { ok: false, error: 'invalid_order' };
  if (!/^\d+\.\d{2}$/u.test(expectedAmount) || Number(expectedAmount) < 0.01) return { ok: false, error: 'invalid_amount' };
  if (payerName.length < 2 || payerName.length > 120) return { ok: false, error: 'invalid_payer' };
  if (!Number.isInteger(orderCreatedEpoch) || orderCreatedEpoch < 1_600_000_000) return { ok: false, error: 'invalid_order_time' };
  return { ok: true, orderId, expectedAmount, payerName, orderCreatedEpoch, consumedFingerprints };
}

export async function findExactZelleMatch({ input, credentials, scopes, gmailGetJson, mintToken }) {
  const tokenResult = await mintToken({ mailbox: MAILBOX, credentials, scopes: scopes || [GMAIL_READONLY_SCOPE] });
  if (!tokenResult.ok) return { ok: false, state: 'provider_unavailable', error: tokenResult.error, httpStatus: 502 };

  const afterEpoch = Math.max(0, input.orderCreatedEpoch - 900);
  const query = `from:(${CHASE_SENDER}) subject:("${CHASE_SUBJECT}") after:${afterEpoch}`;
  const listUrl = new URL(`${GMAIL_API_ROOT}/users/${encodeURIComponent(MAILBOX)}/messages`);
  listUrl.searchParams.set('maxResults', String(MAX_RESULTS));
  listUrl.searchParams.set('q', query);
  const listed = await gmailGetJson(listUrl.toString(), tokenResult.accessToken);
  if (!listed.ok) return { ok: false, state: 'provider_unavailable', error: listed.error, httpStatus: 502 };

  const matches = [];
  for (const message of Array.isArray(listed.data?.messages) ? listed.data.messages.slice(0, MAX_RESULTS) : []) {
    const id = sanitizeId(message?.id);
    if (!id) continue;
    const messageUrl = new URL(`${GMAIL_API_ROOT}/users/${encodeURIComponent(MAILBOX)}/messages/${encodeURIComponent(id)}`);
    messageUrl.searchParams.set('format', 'full');
    const fetched = await gmailGetJson(messageUrl.toString(), tokenResult.accessToken);
    if (!fetched.ok) return { ok: false, state: 'provider_unavailable', error: fetched.error, httpStatus: 502 };
    const candidate = parseChaseZelleMessage(fetched.data);
    if (!candidate) continue;
    if (candidate.internalEpoch < afterEpoch || candidate.internalEpoch > Math.floor(Date.now() / 1000) + 300) continue;
    if (candidate.amount !== input.expectedAmount || candidate.payerName !== input.payerName) continue;
    matches.push(candidate);
  }

  if (matches.length === 0) return { ok: true, state: 'not_found', match_count: 0 };
  if (matches.length > 1) return { ok: true, state: 'needs_review', match_count: matches.length };
  const match = matches[0];
  if (input.consumedFingerprints.includes(match.fingerprint)) {
    return { ok: true, state: 'already_consumed', match_count: 1 };
  }
  return {
    ok: true,
    state: 'verified',
    match_count: 1,
    fingerprint: match.fingerprint,
    received_epoch: match.internalEpoch,
    reference_masked: match.referenceMasked,
  };
}

export function parseChaseZelleMessage(message = {}) {
  const headers = Object.fromEntries((message.payload?.headers || []).map((header) => [String(header?.name || '').toLowerCase(), String(header?.value || '')]));
  const from = extractEmail(headers.from);
  const subject = String(headers.subject || '').trim();
  if (from !== CHASE_SENDER || !subject.toLowerCase().startsWith(CHASE_SUBJECT.toLowerCase())) return null;
  const body = collectBodyText(message.payload).replace(/\u00a0/gu, ' ').replace(/[ \t]+/gu, ' ');
  const amountMatch = body.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/u);
  const payerMatch = body.match(/(?:^|\n)\s*([^\n]{2,120}?)\s+(?:has\s+)?sent\s+you(?:\s+money)?(?:\s+with\s+Zelle)?(?:[.!]|\s+\$|\s*\n)/iu);
  const reversePayerMatch = body.match(/(?:you(?:'ve| have)?\s+received|received)\s+\$\s*[0-9,]+\.\d{2}\s+from\s+([^\n.!]{2,120})/iu);
  const referenceMatch = body.match(/(?:transaction|confirmation|reference)\s*(?:number|#|id)?\s*[:#]?\s*([A-Za-z0-9-]{4,80})/iu);
  const internalEpoch = Math.floor(Number(message.internalDate || 0) / 1000);
  if (!amountMatch || (!payerMatch && !reversePayerMatch) || !internalEpoch) return null;
  const amount = normalizeAmount(amountMatch[1]);
  const payerName = normalizePayer((payerMatch || reversePayerMatch)[1]);
  const reference = String(referenceMatch?.[1] || '').trim();
  const fingerprintSource = `${sanitizeId(message.id)}\n${amount}\n${payerName}\n${internalEpoch}\n${reference}`;
  return {
    amount,
    payerName,
    internalEpoch,
    fingerprint: crypto.createHash('sha256').update(fingerprintSource).digest('hex'),
    referenceMasked: reference ? `...${reference.slice(-4)}` : null,
  };
}

function collectBodyText(part = {}) {
  const chunks = [];
  if (part.body?.data) {
    try { chunks.push(Buffer.from(String(part.body.data), 'base64url').toString('utf8')); } catch { /* fail closed */ }
  }
  for (const child of Array.isArray(part.parts) ? part.parts : []) chunks.push(collectBodyText(child));
  return chunks.join('\n').replace(/<style[\s\S]*?<\/style>/giu, ' ').replace(/<script[\s\S]*?<\/script>/giu, ' ').replace(/<[^>]+>/gu, '\n').replace(/&nbsp;/giu, ' ').replace(/&amp;/giu, '&');
}

function publicResult(result) {
  const payload = { ok: Boolean(result.ok), state: result.state || 'provider_unavailable', match_count: Number(result.match_count || 0) };
  if (result.error) payload.error = String(result.error).slice(0, 80);
  if (result.state === 'verified') {
    payload.fingerprint = result.fingerprint;
    payload.received_epoch = result.received_epoch;
    payload.reference_masked = result.reference_masked;
  }
  return payload;
}

function normalizeAmount(value) {
  const numeric = Number(String(value ?? '').replace(/[$,\s]/gu, ''));
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '';
}

function normalizePayer(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9' -]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function extractEmail(value) {
  const match = String(value || '').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/u);
  return match ? match[0] : '';
}

function sanitizeId(value) {
  const id = String(value || '');
  return /^[A-Za-z0-9_-]{4,128}$/u.test(id) ? id : '';
}
