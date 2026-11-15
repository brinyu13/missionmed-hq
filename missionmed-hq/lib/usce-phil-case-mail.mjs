import { philAccessToken } from '../routes/usce-phil-gmail.mjs';

const MAILBOX = 'philaperri@gmail.com';
const API_ROOT = 'https://gmail.googleapis.com/gmail/v1/users/' + encodeURIComponent(MAILBOX);
const CASE_REF_RE = /^USCE-[A-Z0-9]{8}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GMAIL_ID_RE = /^[a-f0-9]{1,40}$/i;
const RFC_ID_RE = /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,128})@([A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?)>$/;
const QUERYABLE_RFC_ID_RE = /^<[A-Za-z0-9._+-]{1,128}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?>$/;
const BLOCKED_LABELS = new Set(['SPAM', 'TRASH', 'DRAFT', 'CHAT']);
const METADATA_FIELDS = 'id,messages(id,threadId,labelIds,internalDate,payload(headers(name,value)))';
const MESSAGE_FIELDS = 'id,threadId,labelIds,internalDate,payload(mimeType,filename,headers(name,value),body(data,size),parts(mimeType,filename,headers(name,value),body(data,size),parts(mimeType,filename,headers(name,value),body(data,size),parts(mimeType,filename,headers(name,value),body(data,size),parts(mimeType,filename,headers(name,value),body(data,size))))))';
const HEADER_NAMES = [
  'from', 'to', 'cc', 'bcc', 'subject', 'message-id', 'in-reply-to', 'references',
  'authentication-results', 'auto-submitted', 'precedence', 'list-id', 'list-unsubscribe',
  'resent-from', 'resent-to', 'resent-cc', 'resent-bcc', 'return-path', 'x-forwarded-for',
  'x-forwarded-to', 'x-forwarded-by', 'content-type', 'x-autoreply', 'x-autorespond',
  'x-auto-response-suppress', 'x-loop'
];
const fail = code => { throw new Error(code); };
const rpcOk = result => { if (!result?.ok) fail(result?.error || 'rpc_failed'); return result; };

function validRfcId(value) {
  if (typeof value !== 'string' || value.length > 320) return false;
  const match = RFC_ID_RE.exec(value);
  if (!match || match[2].includes('..')) return false;
  return true;
}
function canonicalRfcList(values, { requiredOne = false } = {}) {
  if (!Array.isArray(values) || (requiredOne && values.length === 0) || values.length > 100) fail('invalid_rfc_anchors');
  const unique = [...new Set(values)];
  if (unique.some(value => !validRfcId(value))) fail('invalid_rfc_anchors');
  return unique;
}
function parseHeaderIds(value) {
  const source = String(value || '').trim();
  if (!source) return [];
  const ids = source.match(/<[^<>\s\r\n]{1,320}>/g) || [];
  if (ids.length > 100) fail('too_many_rfc_ids');
  const residue = source.replace(/<[^<>\s\r\n]{1,320}>/g, '').replace(/[\s,;]/g, '');
  if (residue || ids.some(id => !validRfcId(id))) fail('invalid_rfc_header');
  return ids;
}
function parseHeaders(payload) {
  const headers = new Map();
  const source = payload?.headers || [];
  if (!Array.isArray(source) || source.length > 100) fail('invalid_headers');
  for (const item of source) {
    const name = String(item?.name || '').toLowerCase();
    if (!HEADER_NAMES.includes(name)) continue;
    if (String(item?.value || '').length > 8192) fail('oversized_header');
    const values = headers.get(name) || [];
    values.push(String(item?.value || ''));
    headers.set(name, values);
  }
  return headers;
}
function oneHeader(headers, name, { required: must = false } = {}) {
  const values = headers.get(name) || [];
  if (values.length > 1 || (must && values.length !== 1)) fail('ambiguous_header');
  return values[0] || '';
}
function parseOneAddress(value) {
  const raw = String(value || '').trim();
  const emailPattern = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  let candidate = raw;
  if (!emailPattern.test(candidate)) {
    const mailbox = raw.match(/^\s*(?:"(?:[^"\\]|\\.)*"|[^<>";,]+)\s*<([^<>]+)>\s*$/);
    if (!mailbox) return null;
    candidate = mailbox[1].trim();
  }
  if (!emailPattern.test(candidate)) return null;
  const email = candidate.toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  return email;
}
function alignedDmarc(headers, fromEmail) {
  const results = headers.get('authentication-results') || [];
  if (results.length !== 1) return false;
  const value = results[0].trim();
  if (!/^mx\.google\.com\s*;/i.test(value)) return false;
  const clauses = value.replace(/\([^)]*\)/g, '').split(';');
  const dmarcClauses = clauses.filter(part => /\bdmarc\s*=/.test(part));
  if (dmarcClauses.length !== 1 || !/\bdmarc\s*=\s*pass\b/i.test(dmarcClauses[0])) return false;
  const domain = fromEmail.split('@')[1]?.toLowerCase();
  const headerFrom = dmarcClauses[0].match(/\bheader\.from\s*=\s*([a-z0-9.-]+)\b/i)?.[1]?.toLowerCase();
  return !!domain && !!headerFrom && domain === headerFrom;
}
function isAutomatedOrForwarded(headers, subject, fromEmail) {
  if (/^(?:fw|fwd)\s*:/i.test(subject)) return true;
  for (const name of ['resent-from', 'resent-to', 'resent-cc', 'resent-bcc', 'x-forwarded-for', 'x-forwarded-to', 'x-forwarded-by']) {
    if (headers.has(name)) return true;
  }
  const auto = oneHeader(headers, 'auto-submitted').toLowerCase();
  if (auto && auto !== 'no') return true;
  if (/\b(bulk|list|junk)\b/i.test(oneHeader(headers, 'precedence')) || headers.has('list-id') || headers.has('list-unsubscribe')) return true;
  if (['x-autoreply', 'x-autorespond', 'x-auto-response-suppress', 'x-loop'].some(name => headers.has(name))) return true;
  const contentType = oneHeader(headers, 'content-type');
  if (/multipart\/report/i.test(contentType) || /report-type\s*=\s*["']?(?:delivery-status|feedback-report)/i.test(contentType)) return true;
  if (/^(?:mailer-daemon|postmaster)@/i.test(fromEmail) || /delivery status notification|undelivered mail|delivery failure|dmarc aggregate report|automatic reply/i.test(subject)) return true;
  return false;
}
function normalizeMetadata(message, { caseRef, anchors, connectedAt, studentEmail, threadLinked = false, requireLink = true } = {}) {
  if (!GMAIL_ID_RE.test(String(message?.id || '')) || !GMAIL_ID_RE.test(String(message?.threadId || ''))) return null;
  if (!Array.isArray(message.labelIds) || message.labelIds.some(label => BLOCKED_LABELS.has(label))) return null;
  const receivedMs = Number(message.internalDate);
  const lowerBound = Date.parse(connectedAt);
  if (!Number.isFinite(receivedMs) || !Number.isFinite(lowerBound) || receivedMs < lowerBound) return null;
  const headers = parseHeaders(message.payload);
  const subject = oneHeader(headers, 'subject', { required: true }).replace(/[\r\n]/g, ' ').trim().slice(0, 500);
  const fromEmail = parseOneAddress(oneHeader(headers, 'from', { required: true }));
  const toEmail = parseOneAddress(oneHeader(headers, 'to', { required: true }));
  if (!fromEmail || !toEmail || isAutomatedOrForwarded(headers, subject, fromEmail)) return null;
  if (headers.has('cc') || headers.has('bcc')) return null;
  const rfcMessageId = parseHeaderIds(oneHeader(headers, 'message-id', { required: true }));
  if (rfcMessageId.length !== 1) return null;
  const inReplyToIds = parseHeaderIds(oneHeader(headers, 'in-reply-to'));
  if (inReplyToIds.length > 1) return null;
  const referencesIds = parseHeaderIds(oneHeader(headers, 'references'));
  const linkedByRfc = [rfcMessageId[0], ...inReplyToIds, ...referencesIds].some(id => anchors.includes(id));
  const refRegex = new RegExp(`(?:^|[^A-Z0-9])${caseRef}(?:$|[^A-Z0-9])`, 'i');
  const linkedBySubject = refRegex.test(subject);
  if (requireLink && !linkedByRfc && !linkedBySubject && !threadLinked) return null;
  if (fromEmail === MAILBOX) {
    if (!message.labelIds.includes('SENT') || toEmail !== studentEmail) return null;
    return {
      headers, subject, receivedMs, labels: [...message.labelIds].sort(), gmail_id: message.id, thread_id: message.threadId,
      rfc_message_id: rfcMessageId[0], in_reply_to: inReplyToIds[0] || null,
      references_ids: referencesIds, from_email: fromEmail, to_email: toEmail,
      received_at: new Date(receivedMs).toISOString(), direction: 'outgoing', authenticated: true
    };
  }
  if (message.labelIds.includes('SENT') || fromEmail !== studentEmail || toEmail !== MAILBOX || !alignedDmarc(headers, fromEmail)) return null;
  return {
    headers, subject, receivedMs, labels: [...message.labelIds].sort(), gmail_id: message.id, thread_id: message.threadId,
    rfc_message_id: rfcMessageId[0], in_reply_to: inReplyToIds[0] || null,
    references_ids: referencesIds, from_email: fromEmail, to_email: toEmail,
    received_at: new Date(receivedMs).toISOString(), direction: 'incoming', authenticated: true
  };
}
function preflightShape(meta, leaseId, caseId) {
  return {
    lease_id: leaseId, case_id: caseId, gmail_id: meta.gmail_id, thread_id: meta.thread_id,
    rfc_message_id: meta.rfc_message_id, in_reply_to: meta.in_reply_to,
    references_ids: meta.references_ids, from_email: meta.from_email, to_email: meta.to_email,
      received_at: meta.received_at, direction: meta.direction === 'incoming' ? 'IN' : 'OUT', authenticated: meta.authenticated
  };
}
function decodeBase64Url(input) {
  if (typeof input !== 'string' || input.length > 100000) return '';
  try { return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
  catch { return ''; }
}
function isAttachmentPart(part) {
  if (part?.filename) return true;
  return (part?.headers || []).some(header => String(header?.name || '').toLowerCase() === 'content-disposition' && /^\s*attachment(?:\s*;|\s*$)/i.test(String(header?.value || '')));
}
function extractPlainText(payload) {
  const chunks = [];
  const walk = (part, depth = 0) => {
    if (!part || depth > 8 || isAttachmentPart(part) || part.mimeType === 'message/rfc822') return;
    if (part.mimeType === 'text/plain' && typeof part.body?.data === 'string') {
      const text = decodeBase64Url(part.body.data);
      if (text) chunks.push(text);
    }
    for (const child of part.parts || []) walk(child, depth + 1);
  };
  walk(payload);
  return chunks.join('\n');
}
function containsForwardedAttachment(payload, depth = 0) {
  if (!payload || depth > 8) return false;
  if (payload.mimeType === 'message/rfc822') return true;
  return (payload.parts || []).some(part => !isAttachmentPart(part) && containsForwardedAttachment(part, depth + 1));
}
function sanitizeBody(text) {
  let body = String(text || '').replace(/\r\n?/g, '\n').replace(/\0/g, '').trim();
  const lines = body.split('\n');
  const kept = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/^\s*>/.test(line) || /^\s*On .{1,300}wrote:\s*$/i.test(line) || /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i.test(line) || /^\s*-{5,}\s*Forwarded message\s*-{0,}\s*$/i.test(line) || /^\s*Begin forwarded message:\s*$/i.test(line) || /^\s*Forwarded message\s*:?\s*$/i.test(line)) break;
    if (/^\s*From:\s*\S/i.test(line) && /^\s*(?:Sent|Date):\s*\S/i.test(lines[index + 1] || '') && /^\s*To:\s*\S/i.test(lines[index + 2] || '')) break;
    kept.push(line);
  }
  body = kept.join('\n').trim();
  if (body.length > 30000) body = body.slice(0, 30000);
  return body;
}
function gmailUrl(path, params = {}) {
  const url = new URL(`${API_ROOT}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) for (const item of value) url.searchParams.append(key, String(item));
    else url.searchParams.set(key, String(value));
  }
  return url;
}
async function getJson(fetchImpl, token, path, params = {}) {
  const response = await fetchImpl(gmailUrl(path, params), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000)
  });
  if (!response?.ok) fail(`gmail_http_${response?.status || 'error'}`);
  return response.json();
}
function comparable(meta) {
  return JSON.stringify({
    gmail_id: meta.gmail_id, thread_id: meta.thread_id, labels: meta.labels, receivedMs: meta.receivedMs, rfc_message_id: meta.rfc_message_id,
    in_reply_to: meta.in_reply_to, references_ids: meta.references_ids, from_email: meta.from_email,
    to_email: meta.to_email, received_at: meta.received_at, direction: meta.direction,
    authenticated: meta.authenticated, subject: meta.subject
  });
}
function decodeCursor(value) {
  if (!value) return { phase: 'subject', token: null };
  if (value === 'p1a.') return { phase: 'anchors', token: null };
  if (value.startsWith('p1a.')) {
    const token = value.slice(4);
    if (!token || /[\u0000-\u001f\u007f]/.test(token)) fail('invalid_page_cursor');
    return { phase: 'anchors', token };
  }
  if (value.startsWith('p1s.')) {
    const token = value.slice(4);
    if (!token || /[\u0000-\u001f\u007f]/.test(token)) fail('invalid_page_cursor');
    return { phase: 'subject', token };
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) fail('invalid_page_cursor');
  return { phase: 'subject', token: value };
}
function encodeCursor(phase, token = null) {
  if (token == null) return phase === 'anchors' ? 'p1a.' : null;
  if (typeof token !== 'string' || !token || /[\u0000-\u001f\u007f]/.test(token)) fail('invalid_provider_page_token');
  const encoded = (phase === 'anchors' ? 'p1a.' : 'p1s.') + token;
  if (encoded.length > 2048) fail('provider_page_token_too_large');
  return encoded;
}

export async function syncPhilCaseOnce({ rpc, env = process.env, fetchImpl = fetch, authorize = philAccessToken } = {}) {
  if (typeof rpc !== 'function') return { ok: false, error: 'rpc_required' };
  let claim;
  try { claim = rpcOk(await rpc('usce_phil_case_mail', { p_action: 'claim', p_data: {} })); }
  catch { return { ok: false, error: 'claim_failed' }; }
  if (!claim.claimed) return { ok: true, claimed: false, pending: true };

  const leaseId = claim.lease_id;
  const caseId = claim.case_id;
  let failed = false;
  const control = (action, data = {}) => rpc('usce_phil_case_mail', {
    p_action: action, p_data: { lease_id: leaseId, case_id: caseId, ...data }
  });
  try {
    if (typeof leaseId !== 'string' || !leaseId || typeof caseId !== 'string' || !caseId) fail('invalid_claim');
    if (!UUID_RE.test(caseId)) fail('invalid_case_id');
    if (typeof claim.case_ref !== 'string' || !CASE_REF_RE.test(claim.case_ref) || claim.case_ref !== 'USCE-' + caseId.replace(/-/g, '').slice(0, 8).toUpperCase()) fail('invalid_case_ref');
    const studentEmail = typeof claim.student_email === 'string' ? parseOneAddress(claim.student_email) : null;
    if (!studentEmail || studentEmail !== claim.student_email.toLowerCase()) fail('invalid_student_email');
    if (studentEmail === MAILBOX) {
      rpcOk(await control('checkpoint', { page_token: null }));
      return { ok: true, claimed: true, skipped: true, reason: 'self_addressed' };
    }
    const connectedMs = Date.parse(claim.connected_at);
    if (!Number.isFinite(connectedMs) || connectedMs <= 0) fail('consent_required');
    const anchors = canonicalRfcList(claim.anchors, { requiredOne: false });
    if (anchors.length > 100 || anchors.reduce((sum, id) => sum + id.length, 0) > 12000) fail('anchors_too_large');
    const queryAnchors = anchors.filter(id => QUERYABLE_RFC_ID_RE.test(id));
    if (typeof claim.encrypted_grant !== 'string' || !claim.encrypted_grant) fail('grant_unavailable');
    if (claim.page_token != null && (typeof claim.page_token !== 'string' || claim.page_token.length > 2048 || /[\u0000-\u001f\u007f]/.test(claim.page_token))) fail('invalid_page_token');
    const token = await authorize(claim.encrypted_grant, env, fetchImpl);
    if (typeof token !== 'string' || !token || token.length > 8192) fail('gmail_authorization_unavailable');
    const cursor = decodeCursor(claim.page_token);
    if (cursor.phase === 'anchors' && !queryAnchors.length) fail('invalid_page_cursor');
    const query = cursor.phase === 'subject'
      ? `subject:"${claim.case_ref}" after:${Math.floor(connectedMs / 1000) - 1} -in:drafts -in:spam -in:trash -in:chats`
      : `{${queryAnchors.map(id => `rfc822msgid:${id}`).join(' ')}} -in:drafts -in:spam -in:trash -in:chats`;
    const listParams = { q: query, maxResults: 25, fields: 'threads(id),nextPageToken', pageToken: cursor.token || undefined };
    const page = await getJson(fetchImpl, token, 'threads', listParams);
    if (page.nextPageToken != null && (typeof page.nextPageToken !== 'string' || !page.nextPageToken || /[\u0000-\u001f\u007f]/.test(page.nextPageToken))) fail('invalid_provider_page_token');
    if (page.threads !== undefined && !Array.isArray(page.threads)) fail('invalid_thread_list');
    const listedIds = (page.threads || []).map(thread => thread?.id);
    const threadIds = [...new Set(listedIds.filter(id => typeof id === 'string' && GMAIL_ID_RE.test(id)))];
    const threads = [];
    for (const threadId of threadIds) {
      let data;
      try {
        data = await getJson(fetchImpl, token, `threads/${encodeURIComponent(threadId)}`, {
          format: 'metadata', metadataHeaders: HEADER_NAMES, fields: METADATA_FIELDS
        });
      } catch (error) {
        if (error?.message === 'gmail_http_404') continue;
        throw error;
      }
      if (data.id !== threadId || !Array.isArray(data.messages)) continue;
      threads.push({ id: threadId, messages: data.messages });
    }

    const candidates = [];
    const directlyLinkedThreads = new Set();
    for (const thread of threads) {
      const messages = [];
      for (const message of thread.messages) {
        if (message.threadId !== thread.id) continue;
        let meta;
        try { meta = normalizeMetadata(message, { caseRef: claim.case_ref, anchors, connectedAt: claim.connected_at, studentEmail, requireLink: false }); }
        catch { continue; }
        if (meta) {
          const linkedByRfc = [meta.rfc_message_id, ...(meta.in_reply_to ? [meta.in_reply_to] : []), ...meta.references_ids].some(id => anchors.includes(id));
          const refTokens = meta.subject.match(/USCE-[A-Z0-9]{8}/gi) || [];
          const uniqueRefs = new Set(refTokens.map(x => x.toUpperCase()));
          if ([...uniqueRefs].some(ref => ref !== claim.case_ref)) continue;
          if (linkedByRfc || (refTokens.length && refTokens[0].toUpperCase() === claim.case_ref)) {
            directlyLinkedThreads.add(thread.id);
          }
          messages.push(meta);
        }
      }
      if (messages.length) candidates.push({ id: thread.id, messages });
    }
    const prepared = candidates.filter(thread => directlyLinkedThreads.has(thread.id));

    const seen = new Set();
    let ingested = 0;
    for (const thread of prepared) {
      thread.messages.sort((a, b) => a.receivedMs - b.receivedMs || a.gmail_id.localeCompare(b.gmail_id));
      const linked = directlyLinkedThreads.has(thread.id);
      for (const meta of thread.messages) {
        if (seen.has(meta.gmail_id)) continue;
        seen.add(meta.gmail_id);
        if (!meta.in_reply_to && !meta.references_ids.length) continue;
        // Only explicitly eligible metadata may authorize a body read.
        const shape = preflightShape(meta, leaseId, caseId);
        const preflight = rpcOk(await control('preflight', shape));
        if (preflight.eligible !== true) continue;
        let full;
        try {
          full = await getJson(fetchImpl, token, `messages/${encodeURIComponent(meta.gmail_id)}`, {
            format: 'full', fields: MESSAGE_FIELDS
          });
        } catch (error) {
          if (error?.message === 'gmail_http_404') continue;
          throw error;
        }
        let fresh;
        try { fresh = normalizeMetadata(full, { caseRef: claim.case_ref, anchors, connectedAt: claim.connected_at, studentEmail, threadLinked: linked }); }
        catch { continue; }
        if (!fresh || comparable({ ...fresh, subject: fresh.subject }) !== comparable({ ...meta, subject: meta.subject })) continue;
        if (containsForwardedAttachment(full.payload)) continue;
        const bodyText = sanitizeBody(extractPlainText(full.payload));
        if (!bodyText) continue;
        const ingest = {
          ...shape,
          subject: fresh.subject,
          body_text: bodyText
        };
        rpcOk(await control('ingest', ingest));
        ingested++;
      }
    }
    let nextCursor = null;
    if (page.nextPageToken) nextCursor = encodeCursor(cursor.phase, page.nextPageToken);
    else if (cursor.phase === 'subject' && queryAnchors.length) nextCursor = encodeCursor('anchors');
    const pageToken = nextCursor;
    rpcOk(await control('checkpoint', { page_token: pageToken }));
    return { ok: true, claimed: true, ingested, more: !!pageToken };
  } catch (error) {
    failed = true;
    try { await control('release'); } catch { /* lease expiry remains the fallback */ }
    return { ok: false, claimed: true, error: 'case_mail_sync_unavailable' };
  } finally {
    if (!failed) {
      try { await control('release'); } catch { /* release is best effort after checkpoint */ }
    }
  }
}
