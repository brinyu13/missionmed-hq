import crypto from 'node:crypto';
import {
  GMAIL_API_ROOT,
  GMAIL_READONLY_SCOPE,
  getConfiguredAllowedMailboxes,
  googleGetJson,
  mintDelegatedAccessToken,
  normalizeMailbox,
  readGmailDwdConfig,
  sendJson,
} from './gmail-metadata-proof.mjs';

const SYNC_PREVIEW_PATH = '/api/integrations/gmail/sync-preview';
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const DEFAULT_NEWER_THAN_DAYS = 30;
const MAX_NEWER_THAN_DAYS = 90;
const METADATA_HEADERS = ['From', 'To', 'Cc', 'Date', 'Subject', 'Message-ID', 'In-Reply-To', 'References'];
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu;
const CANONICAL_SUPABASE_PROJECT_REF = 'fglyvdykwgbuivikqoah';
const SUPABASE_URL_FLAGS = ['MMHQ_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_SERVICE_KEY_FLAGS = ['MMHQ_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'MMHQ_SUPABASE_KEY'];

export function isGmailSyncPreviewPath(pathname = '') {
  return normalizePath(pathname) === SYNC_PREVIEW_PATH;
}

export async function handleGmailSyncPreviewRoute(request, response, url, context = {}) {
  if (!isGmailSyncPreviewPath(url.pathname)) {
    return false;
  }

  const headers = context.authHeaders || {};
  if (request.method !== 'GET') {
    sendJson(response, 405, {
      ok: false,
      error: 'method_not_allowed',
      message: 'Gmail sync preview only supports GET.',
      allowed_methods: ['GET'],
    }, { ...headers, Allow: 'GET' });
    return true;
  }

  const mailbox = normalizeMailbox(url.searchParams.get('mailbox'));
  if (!mailbox) {
    sendJson(response, 400, {
      ok: false,
      error: 'gmail_mailbox_required',
      message: 'Provide one allowlisted mailbox for Gmail sync preview.',
      allowed_mailboxes: Array.from(getConfiguredAllowedMailboxes()),
      dry_run: true,
      supabase_writes: false,
      gmail_writes: false,
    }, headers);
    return true;
  }

  const allowedMailboxes = getConfiguredAllowedMailboxes();
  if (!allowedMailboxes.has(mailbox)) {
    sendJson(response, 403, {
      ok: false,
      error: 'gmail_mailbox_not_allowed',
      message: 'Gmail sync preview is limited to allowlisted MissionMed mailboxes.',
      allowed_mailboxes: Array.from(allowedMailboxes),
      dry_run: true,
      supabase_writes: false,
      gmail_writes: false,
    }, headers);
    return true;
  }

  const params = normalizePreviewParams(url.searchParams);
  if (!params.ok) {
    sendJson(response, 400, {
      ok: false,
      error: params.error,
      message: params.message,
      dry_run: true,
      supabase_writes: false,
      gmail_writes: false,
    }, headers);
    return true;
  }

  const config = readGmailDwdConfig();
  if (!config.ok) {
    sendJson(response, config.httpStatus, {
      ok: false,
      error: config.error,
      message: config.message,
      missing: config.missing,
      invalid: config.invalid,
      preview_mode: 'metadata_headers_only',
      dry_run: true,
      gmail_messages_listed: false,
      gmail_message_metadata_read: false,
      gmail_message_bodies_read: false,
      gmail_writes: false,
      supabase_writes: false,
    }, headers);
    return true;
  }

  const preview = await runSyncPreview({
    mailbox,
    params,
    credentials: config.credentials,
    scopes: config.scopes,
  });

  if (!preview.ok) {
    sendJson(response, preview.httpStatus || 502, {
      ok: false,
      error: preview.error || 'gmail_sync_preview_failed',
      message: preview.message || 'Gmail sync preview failed.',
      mailbox,
      provider_status: preview.providerStatus || null,
      preview_mode: 'metadata_headers_only',
      dry_run: true,
      gmail_message_bodies_read: false,
      gmail_writes: false,
      supabase_writes: false,
    }, headers);
    return true;
  }

  sendJson(response, 200, {
    ok: true,
    preview_mode: 'metadata_headers_only',
    auth_model: 'domain_wide_delegation',
    scope: GMAIL_READONLY_SCOPE,
    dry_run: true,
    mailbox,
    query: preview.query,
    limit: params.limit,
    newer_than_days: params.newerThanDays,
    candidate_count: preview.candidates.length,
    result_size_estimate: preview.resultSizeEstimate,
    match_index: preview.matchIndex,
    candidates: preview.candidates,
    privacy: {
      message_bodies_read: false,
      snippets_returned: false,
      attachments_read: false,
      subject_text_returned: false,
      custom_label_names_returned: false,
    },
    gmail_messages_listed: true,
    gmail_message_metadata_read: true,
    gmail_message_bodies_read: false,
    gmail_writes: false,
    supabase_reads: preview.matchIndex.mode === 'read_only_rpc',
    supabase_writes: false,
    live_email_sent: false,
  }, headers);
  return true;
}

async function runSyncPreview({ mailbox, params, credentials, scopes }) {
  const tokenResult = await mintDelegatedAccessToken({ mailbox, credentials, scopes });
  if (!tokenResult.ok) return tokenResult;

  const query = buildGmailQuery(params);
  const listUrl = new URL(`${GMAIL_API_ROOT}/users/${encodeURIComponent(mailbox)}/messages`);
  listUrl.searchParams.set('maxResults', String(params.limit));
  listUrl.searchParams.set('q', query);

  const listResult = await googleGetJson(listUrl.toString(), tokenResult.accessToken);
  if (!listResult.ok) return listResult;

  const messages = Array.isArray(listResult.data?.messages) ? listResult.data.messages.slice(0, params.limit) : [];
  const candidates = [];
  for (const item of messages) {
    const id = sanitizeGmailId(item?.id);
    if (!id) continue;
    const metadataUrl = new URL(`${GMAIL_API_ROOT}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(id)}`);
    metadataUrl.searchParams.set('format', 'metadata');
    for (const header of METADATA_HEADERS) {
      metadataUrl.searchParams.append('metadataHeaders', header);
    }

    const metadataResult = await googleGetJson(metadataUrl.toString(), tokenResult.accessToken);
    if (!metadataResult.ok) return metadataResult;
    candidates.push(buildCandidatePreview({
      mailbox,
      message: metadataResult.data,
      params,
    }));
  }

  const matchIndex = await buildIntakeMatchIndex(candidates, params);
  const matchedCandidates = candidates.map((candidate) => applyIntakeMatches(candidate, matchIndex)).map(toPublicCandidate);

  return {
    ok: true,
    query,
    resultSizeEstimate: Math.max(0, Number(listResult.data?.resultSizeEstimate || 0)),
    matchIndex: matchIndex.summary,
    candidates: matchedCandidates,
  };
}

function buildCandidatePreview({ mailbox, message, params }) {
  const headers = normalizeHeaders(message?.payload?.headers);
  const participants = collectParticipants(headers);
  const subject = sanitizeHeaderValue(headers.subject, 240);
  const references = extractReferences(headers);
  const exactStudentEmail = params.studentEmail && participants.includes(params.studentEmail);
  const subjectUuidRefs = extractUuidRefs(subject);
  const headerUuidRefs = extractUuidRefs(Object.values(references).join(' '));
  const allRefs = Array.from(new Set([...subjectUuidRefs, ...headerUuidRefs]));
  const offerRefMatch = params.offerId && allRefs.includes(params.offerId);
  const intakeRefMatch = params.intakeId && allRefs.includes(params.intakeId);
  const matchReasons = [];
  if (exactStudentEmail) matchReasons.push('exact_student_email_in_headers');
  if (offerRefMatch) matchReasons.push('offer_id_reference_match');
  if (intakeRefMatch) matchReasons.push('intake_id_reference_match');

  const confidence = matchReasons.length >= 2 ? 'high' : matchReasons.length === 1 ? 'medium' : 'none';
  const syncAction = confidence === 'none' ? 'needs_review' : 'would_log';
  const fromEmails = extractEmails(headers.from).slice(0, 5);
  const toEmails = extractEmails(`${headers.to || ''},${headers.cc || ''}`).slice(0, 10);
  const participantEmails = Array.from(new Set([...fromEmails, ...toEmails]));

  return {
    gmail_message_id: sanitizeGmailId(message?.id),
    gmail_thread_id: sanitizeGmailId(message?.threadId),
    mailbox,
    internal_date: normalizeInternalDate(message?.internalDate),
    header_date: sanitizeHeaderValue(headers.date, 120),
    from: redactEmailList(fromEmails),
    to_cc: redactEmailList(toEmails),
    subject_redacted: true,
    subject_hash: subject ? hashValue(subject) : null,
    message_id_hash: headers['message-id'] ? hashValue(headers['message-id']) : null,
    in_reply_to_hash: references.in_reply_to ? hashValue(references.in_reply_to) : null,
    references_hash: references.references ? hashValue(references.references) : null,
    matched_student_email: exactStudentEmail ? params.studentEmail : null,
    matched_intake_id: intakeRefMatch ? params.intakeId : null,
    matched_offer_id: offerRefMatch ? params.offerId : null,
    match_confidence: confidence,
    match_reasons: matchReasons,
    sync_action: syncAction,
    body_returned: false,
    snippet_returned: false,
    _participantEmails: participantEmails,
  };
}

async function buildIntakeMatchIndex(candidates, params) {
  const emails = new Set();
  if (params.studentEmail) emails.add(params.studentEmail);
  for (const candidate of candidates) {
    for (const email of candidate._participantEmails || []) {
      if (isEmail(email)) emails.add(email);
    }
  }

  const config = getSupabaseConfig();
  if (!config.ok) {
    return {
      byEmail: new Map(),
      summary: {
        mode: 'unavailable',
        reason: config.reason,
        matched_email_count: 0,
        supabase_writes: false,
      },
    };
  }

  const byEmail = new Map();
  for (const email of Array.from(emails).slice(0, 20)) {
    const result = await fetchIntakeMatchesByEmail(config, email);
    if (!result.ok) {
      return {
        byEmail,
        summary: {
          mode: 'read_only_rpc_partial',
          reason: result.error,
          matched_email_count: byEmail.size,
          supabase_writes: false,
        },
      };
    }
    if (result.items.length) byEmail.set(email, result.items);
  }

  return {
    byEmail,
    summary: {
      mode: 'read_only_rpc',
      searched_email_count: emails.size,
      matched_email_count: byEmail.size,
      supabase_writes: false,
    },
  };
}

function applyIntakeMatches(candidate, matchIndex) {
  if (candidate.matched_intake_id) return candidate;
  const participantMatches = [];
  for (const email of candidate._participantEmails || []) {
    const items = matchIndex.byEmail.get(email) || [];
    for (const item of items) {
      participantMatches.push({ email, ...item });
    }
  }
  if (!participantMatches.length) return candidate;

  const exact = candidate.matched_student_email
    ? participantMatches.filter((match) => match.email === candidate.matched_student_email)
    : participantMatches;
  const matches = exact.length ? exact : participantMatches;
  const uniqueIntakeIds = Array.from(new Set(matches.map((match) => match.intake_id).filter(Boolean)));
  const reasons = new Set(candidate.match_reasons || []);
  reasons.add('exact_email_matches_usce_intake');

  return {
    ...candidate,
    matched_student_email: candidate.matched_student_email || matches[0].email,
    matched_intake_id: uniqueIntakeIds.length === 1 ? uniqueIntakeIds[0] : candidate.matched_intake_id,
    candidate_intake_ids: uniqueIntakeIds.slice(0, 5),
    match_confidence: uniqueIntakeIds.length === 1 ? 'high' : 'needs_review',
    match_reasons: Array.from(reasons),
    sync_action: uniqueIntakeIds.length === 1 ? 'would_log' : 'needs_review',
  };
}

function toPublicCandidate(candidate) {
  const { _participantEmails, ...publicCandidate } = candidate;
  return publicCandidate;
}

async function fetchIntakeMatchesByEmail(config, email) {
  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/list_usce_public_intake_requests`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.serviceKey}`,
        apikey: config.serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_limit: 5,
        p_offset: 0,
        p_status: null,
        p_search: email,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: `supabase_${response.status}` };
    }
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return {
      ok: true,
      items: items
        .filter((item) => normalizeMailbox(item?.email) === email)
        .slice(0, 5)
        .map((item) => ({
          intake_id: normalizeUuid(item?.id),
          intake_status: sanitizeHeaderValue(item?.status, 60),
          intake_created_at: sanitizeHeaderValue(item?.created_at, 80),
        }))
        .filter((item) => item.intake_id),
    };
  } catch {
    return { ok: false, error: 'supabase_request_failed' };
  }
}

function getSupabaseConfig() {
  const supabaseUrl = sanitizeSupabaseUrl(envValueAny(SUPABASE_URL_FLAGS, ''));
  const serviceKey = envValueAny(SUPABASE_SERVICE_KEY_FLAGS, '');
  if (!supabaseUrl) return { ok: false, reason: 'supabase_url_missing' };
  if (getSupabaseProjectRef(supabaseUrl) !== CANONICAL_SUPABASE_PROJECT_REF) {
    return { ok: false, reason: 'supabase_project_mismatch' };
  }
  if (!serviceKey) return { ok: false, reason: 'supabase_service_key_missing' };
  return { ok: true, supabaseUrl, serviceKey };
}

function normalizePreviewParams(searchParams) {
  const limit = normalizeInteger(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
  const newerThanDays = normalizeInteger(searchParams.get('newer_than_days'), DEFAULT_NEWER_THAN_DAYS, MAX_NEWER_THAN_DAYS);
  const studentEmail = normalizeMailbox(searchParams.get('student_email'));
  const offerId = normalizeUuid(searchParams.get('offer_id'));
  const intakeId = normalizeUuid(searchParams.get('intake_id'));

  if (searchParams.get('student_email') && !isEmail(studentEmail)) {
    return { ok: false, error: 'invalid_student_email', message: 'student_email must be an exact email address.' };
  }
  if (searchParams.get('offer_id') && !offerId) {
    return { ok: false, error: 'invalid_offer_id', message: 'offer_id must be a UUID.' };
  }
  if (searchParams.get('intake_id') && !intakeId) {
    return { ok: false, error: 'invalid_intake_id', message: 'intake_id must be a UUID.' };
  }

  return {
    ok: true,
    limit,
    newerThanDays,
    studentEmail,
    offerId,
    intakeId,
  };
}

function buildGmailQuery(params) {
  const parts = [`newer_than:${params.newerThanDays}d`, '-in:spam', '-in:trash'];
  if (params.studentEmail) {
    const email = params.studentEmail.replace(/"/gu, '');
    parts.push(`{from:${email} to:${email} cc:${email}}`);
  }
  if (params.offerId) parts.push(`"${params.offerId}"`);
  if (params.intakeId) parts.push(`"${params.intakeId}"`);
  return parts.join(' ');
}

function normalizeHeaders(headers) {
  const normalized = {};
  if (!Array.isArray(headers)) return normalized;
  for (const header of headers) {
    const name = String(header?.name || '').trim().toLowerCase();
    if (!METADATA_HEADERS.map((h) => h.toLowerCase()).includes(name)) continue;
    normalized[name] = sanitizeHeaderValue(header?.value, name === 'subject' ? 240 : 1200);
  }
  return normalized;
}

function collectParticipants(headers) {
  return Array.from(new Set([
    ...extractEmails(headers.from),
    ...extractEmails(headers.to),
    ...extractEmails(headers.cc),
  ]));
}

function extractEmails(value) {
  return String(value || '')
    .toLowerCase()
    .match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gu)?.slice(0, 20) || [];
}

function redactEmailList(emails) {
  return Array.from(new Set(emails.map(redactEmail).filter(Boolean)));
}

function redactEmail(email) {
  const normalized = normalizeMailbox(email);
  if (!isEmail(normalized)) return '';
  const [local, domain] = normalized.split('@');
  const visible = local.length <= 2 ? `${local[0] || 'x'}*` : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function extractReferences(headers) {
  return {
    message_id: sanitizeHeaderValue(headers['message-id'], 1200),
    in_reply_to: sanitizeHeaderValue(headers['in-reply-to'], 1200),
    references: sanitizeHeaderValue(headers.references, 2000),
  };
}

function extractUuidRefs(value) {
  return Array.from(new Set(String(value || '').toLowerCase().match(UUID_RE) || []));
}

function normalizeInteger(value, fallback, max) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return fallback;
  return Math.max(1, Math.min(max, numeric));
}

function normalizeUuid(value) {
  const raw = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(raw) ? raw : '';
}

function normalizeInternalDate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Date(numeric).toISOString();
}

function sanitizeHeaderValue(value, maxLength) {
  return String(value || '').replace(/[^\P{C}\t ]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, maxLength);
}

function sanitizeGmailId(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 120);
}

function sanitizeSupabaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/u, '');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return '';
    return url.toString().replace(/\/+$/u, '');
  } catch {
    return '';
  }
}

function getSupabaseProjectRef(supabaseUrl) {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

function envValueAny(keys, fallback = '') {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  return fallback;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 24);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(String(value || ''));
}

function normalizePath(value) {
  return String(value || '').replace(/\/+$/u, '') || '/';
}
