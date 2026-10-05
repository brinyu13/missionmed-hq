// Accepted donor origin/codex/mr-zelle-release-1004; functions below are byte-identical.
// Source SHA256: ca645ac243f02ef201c8c549ed06f76d8051736b0baa2228d86de049c82bb029
// Extract SHA256: 441e8d0e6896d15c8ea7ee0a33f80ce5a103d971f5172ebbc43b73a9dbf0c086
import crypto from 'node:crypto';
const GMAIL_API_ROOT = 'https://gmail.googleapis.com/gmail/v1';
const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const MAILBOX = 'info@missionmedinstitute.com';
const CHASE_SENDER = 'no.reply.alerts@chase.com';
const CHASE_SUBJECT = 'You received money with Zelle';
const MAX_AGE_SECONDS = 300;
const MAX_RESULTS = 25;
const MAX_ORDER_AGE_SECONDS = 7 * 86400;
const replayCache = new Map();

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
    String(payload.protocol_version || ''),
    String(payload.currency || ''),
    JSON.stringify(payload.eligible_order_ids || []),
    JSON.stringify(payload.consumed_fingerprints || []),
  ].join('\n');
}

function purgeReplayCache(now) {
  for (const [nonce, expiry] of replayCache.entries()) {
    if (expiry <= now) replayCache.delete(nonce);
  }
}

export function normalizeMatchInput(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: 'invalid_body' };
  const orderId = Number(payload.order_id || 0);
  const expectedAmount = normalizeAmount(payload.expected_amount);
  const payerName = normalizePayer(payload.payer_name);
  const orderCreatedEpoch = Number(payload.order_created_epoch || 0);
  if (payload.protocol_version !== 2 || payload.currency !== 'USD') return { ok: false, error: 'protocol_or_currency_invalid' };
  const eligibleOrderIds = payload.eligible_order_ids;
  if (!Array.isArray(eligibleOrderIds) || eligibleOrderIds.length !== 1 || eligibleOrderIds[0] !== orderId) {
    return { ok: false, error: 'order_ambiguity' };
  }
  const consumedFingerprints = Array.isArray(payload.consumed_fingerprints)
    ? payload.consumed_fingerprints.filter((value) => /^[a-f0-9]{64}$/u.test(String(value))).slice(0, 250)
    : [];
  if (!Number.isInteger(orderId) || orderId < 1) return { ok: false, error: 'invalid_order' };
  if (!/^\d+\.\d{2}$/u.test(expectedAmount) || Number(expectedAmount) < 0.01) return { ok: false, error: 'invalid_amount' };
  if (payerName.length < 2 || payerName.length > 120) return { ok: false, error: 'invalid_payer' };
  if (!Number.isInteger(orderCreatedEpoch) || orderCreatedEpoch < 1_600_000_000) return { ok: false, error: 'invalid_order_time' };
  if (!Array.isArray(payload.consumed_fingerprints) || payload.consumed_fingerprints.length > 250 || consumedFingerprints.length !== payload.consumed_fingerprints.length) {
    return { ok: false, error: 'invalid_consumed_evidence' };
  }
  return { ok: true, orderId, expectedAmount, payerName, orderCreatedEpoch, consumedFingerprints };
}

export async function findExactZelleMatch({ input, credentials, scopes, gmailGetJson, mintToken }) {
  const nowEpoch = Math.floor(Date.now() / 1000);
  if (input.orderCreatedEpoch > nowEpoch || input.orderCreatedEpoch < nowEpoch - MAX_ORDER_AGE_SECONDS) {
    return { ok: true, state: 'needs_review', error: 'order_outside_automatic_window' };
  }
  const tokenResult = await mintToken({ mailbox: MAILBOX, credentials, scopes: scopes || [GMAIL_READONLY_SCOPE] });
  if (!tokenResult.ok) return { ok: false, state: 'provider_unavailable', error: tokenResult.error, httpStatus: 502 };

  const afterEpoch = input.orderCreatedEpoch;
  const query = `from:(${CHASE_SENDER}) subject:("${CHASE_SUBJECT}") after:${afterEpoch}`;
  const listUrl = new URL(`${GMAIL_API_ROOT}/users/${encodeURIComponent(MAILBOX)}/messages`);
  listUrl.searchParams.set('maxResults', String(MAX_RESULTS));
  listUrl.searchParams.set('q', query);
  const listed = await gmailGetJson(listUrl.toString(), tokenResult.accessToken);
  if (!listed.ok) return { ok: false, state: 'provider_unavailable', error: listed.error, httpStatus: 502 };
  // Never approve from a truncated search: a later page may contain ambiguity.
  if (listed.data?.nextPageToken || !Array.isArray(listed.data?.messages ?? [])) {
    return { ok: true, state: 'needs_review', error: 'incomplete_mail_search' };
  }

  const matches = [];
  const seenTransactions = new Map();
  for (const message of Array.isArray(listed.data?.messages) ? listed.data.messages.slice(0, MAX_RESULTS) : []) {
    const id = sanitizeId(message?.id);
    if (!id) continue;
    const messageUrl = new URL(`${GMAIL_API_ROOT}/users/${encodeURIComponent(MAILBOX)}/messages/${encodeURIComponent(id)}`);
    messageUrl.searchParams.set('format', 'full');
    const fetched = await gmailGetJson(messageUrl.toString(), tokenResult.accessToken);
    if (!fetched.ok) return { ok: false, state: 'provider_unavailable', error: fetched.error, httpStatus: 502 };
    const candidate = parseChaseZelleMessage(fetched.data);
    if (!candidate) continue;
    if (candidate.internalEpoch < afterEpoch || candidate.internalEpoch > nowEpoch + 300) continue;
    if (candidate.sentDay < easternDay(input.orderCreatedEpoch) || candidate.sentDay > easternDay(nowEpoch)) continue;
    const existing = seenTransactions.get(candidate.fingerprint);
    if (existing && (existing.amount !== candidate.amount || existing.payerName !== candidate.payerName || existing.sentDay !== candidate.sentDay)) {
      return { ok: true, state: 'needs_review', error: 'conflicting_transaction_evidence' };
    }
    seenTransactions.set(candidate.fingerprint, candidate);
    if (candidate.amount !== input.expectedAmount || candidate.payerName !== input.payerName) continue;
    if (!existing) matches.push(candidate);
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
    protocol_version: 2,
    sent_day: match.sentDay,
    message_fingerprint: match.messageFingerprint,
    authentication: 'gmail_chase_dkim_dmarc_pass',
  };
}

export function parseChaseZelleMessage(message = {}) {
  const rawHeaders = message.payload?.headers || [];
  const values = name => rawHeaders.filter(h => String(h?.name).toLowerCase() === name).map(h => String(h.value || ''));
  if (values('from').length !== 1 || values('subject').length !== 1 || values('to').length !== 1) return null;
  const headers = { from: values('from')[0], subject: values('subject')[0], to: values('to')[0] };
  const from = extractEmail(headers.from);
  const subject = String(headers.subject || '').trim();
  if (from !== CHASE_SENDER || !/^(?:Chase(?: Alerts)?\s*<no\.reply\.alerts@chase\.com>|no\.reply\.alerts@chase\.com)$/iu.test(headers.from.trim()) || !/^You received money with Zelle(?:®)?$/iu.test(subject)) return null;
  // Gmail's first receiver-added Authentication-Results is authoritative. Do not
  // search later/forwarded headers for a convenient pass or accept ARC alone.
  const authentication = values('authentication-results')[0] || '';
  const clauses = authentication.split(';').map(v => v.trim());
  if (clauses.shift() !== 'mx.google.com') return null;
  if (!clauses.some(v => /^dkim=pass\b/iu.test(v) && /\bheader\.(?:i=@|d=)chase\.com(?:\s|$)/iu.test(v))) return null;
  if (!clauses.some(v => /^dmarc=pass\b/iu.test(v) && /\bheader\.from=chase\.com(?:\s|$)/iu.test(v))) return null;
  if (extractEmail(headers.to) !== MAILBOX || values('delivered-to')[0]?.trim().toLowerCase() !== MAILBOX) return null;
  if (!sanitizeId(message.id)) return null;
  const body = collectBodyText(message.payload).replace(/\u00a0/gu, ' ').replace(/[ \t]+/gu, ' ');
  const amountMatches = [...body.matchAll(/\bAmount\s*:?\s*\$\s*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\.[0-9]{2})(?![0-9.])/giu)];
  const amountMatch = amountMatches.length === 1 ? amountMatches[0] : null;
  const payerMatch = body.match(/(?:^|\n)\s*([^\n]{2,120}?)\s+(?:has\s+)?sent\s+you(?:\s+money)?(?:\s+with\s+Zelle)?(?:[.!]|\s+\$|\s*\n)/iu);
  const reversePayerMatch = body.match(/(?:you(?:'ve| have)?\s+received|received)\s+\$\s*[0-9,]+\.\d{2}\s+from\s+([^\n.!]{2,120})/iu);
  const references = [...body.matchAll(/\bTransaction\s+number\s*:?\s*([A-Za-z0-9-]{4,80})(?![A-Za-z0-9-])/giu)];
  const referenceMatch = references.length === 1 ? references[0] : null;
  const dates = [...body.matchAll(/\bSent on\s*:?\s*([A-Za-z]{3}\s+[0-9]{1,2},\s+[0-9]{4})/giu)];
  const sentDay = dates.length === 1 ? parseSentDay(dates[0][1]) : '';
  const internalEpoch = Math.floor(Number(message.internalDate || 0) / 1000);
  if (!amountMatch || (!payerMatch && !reversePayerMatch) || !internalEpoch || !referenceMatch || !sentDay) return null;
  const amount = normalizeAmount(amountMatch[1]);
  const payerName = normalizePayer((payerMatch || reversePayerMatch)[1]);
  const reference = String(referenceMatch?.[1] || '').trim();
  if (!amount || Number(amount) <= 0 || payerName.length < 2) return null;
  if (sentDay > easternDay(internalEpoch) || sentDay < easternDay(internalEpoch - 2 * 86400)) return null;
  // Stable across duplicate notification/message IDs. Woo atomically consumes
  // this reference across BOTH automatic and administrator providers.
  const fingerprintSource = `chase-zelle-v2\n${MAILBOX}\n${reference}`;
  return {
    amount,
    payerName,
    internalEpoch,
    sentDay,
    messageFingerprint: crypto.createHash('sha256').update(`${MAILBOX}\n${message.id}`).digest('hex'),
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
    payload.protocol_version = result.protocol_version;
    payload.sent_day = result.sent_day;
    payload.message_fingerprint = result.message_fingerprint;
    payload.authentication = result.authentication;
  }
  return payload;
}

export function normalizeAmount(value) {
  const input = String(value ?? '').trim().replace(/^\$/u, '');
  if (!/^(?:0|[1-9][0-9]*|[1-9][0-9]{0,2}(?:,[0-9]{3})+)(?:\.[0-9]{1,2})?$/u.test(input)) return '';
  const [whole, cents = ''] = input.replace(/,/gu, '').split('.');
  if (whole.length > 8) return '';
  return `${whole}.${cents.padEnd(2, '0')}`;
}

export function normalizePayer(value) {
  // Exact matching after case/whitespace normalization, never fuzzy matching
  // or accent/punctuation deletion that could collapse distinct identities.
  return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

function easternDay(epoch) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(epoch * 1000));
}

function parseSentDay(value) {
  const match = value.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/u);
  const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match?.[1].toLowerCase());
  if (!match || month < 0) return '';
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[2])));
  return date.getUTCMonth() === month && date.getUTCDate() === Number(match[2]) ? date.toISOString().slice(0,10) : '';
}

function extractEmail(value) {
  const match = String(value || '').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/u);
  return match ? match[0] : '';
}

function sanitizeId(value) {
  const id = String(value || '');
  return /^[A-Za-z0-9_-]{4,128}$/u.test(id) ? id : '';
}
