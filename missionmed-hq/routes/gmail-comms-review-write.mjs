import crypto from 'node:crypto';
import {
  getConfiguredAllowedMailboxes,
  normalizeMailbox,
  sendJson,
} from './gmail-metadata-proof.mjs';

const GMAIL_COMMS_REVIEW_WRITE_PATH = '/api/integrations/gmail/comms-review-write';
const MAX_BODY_BYTES = 16 * 1024;
const CANONICAL_SUPABASE_PROJECT_REF = 'fglyvdykwgbuivikqoah';
const SUPABASE_URL_FLAGS = ['MMHQ_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_SERVICE_KEY_FLAGS = ['MMHQ_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'MMHQ_SUPABASE_KEY'];
const ALLOWED_DIRECTIONS = new Set(['IN', 'OUT', 'SYS']);
const ALLOWED_REVIEW_STATUSES = new Set(['approved', 'needs_review']);

export function isGmailCommsReviewWritePath(pathname = '') {
  return normalizePath(pathname) === GMAIL_COMMS_REVIEW_WRITE_PATH;
}

export async function handleGmailCommsReviewWriteRoute(request, response, url, context = {}) {
  if (!isGmailCommsReviewWritePath(url.pathname)) {
    return false;
  }

  const headers = context.authHeaders || {};
  if (request.method !== 'POST') {
    sendJson(response, 405, {
      ok: false,
      error: 'method_not_allowed',
      message: 'Gmail comms review write only supports POST.',
      allowed_methods: ['POST'],
    }, { ...headers, Allow: 'POST' });
    return true;
  }

  let payload;
  try {
    payload = await readLimitedJsonBody(request, MAX_BODY_BYTES);
  } catch (error) {
    sendJson(response, error?.code === 'body_too_large' ? 413 : 400, {
      ok: false,
      error: error?.code === 'body_too_large' ? 'payload_too_large' : 'invalid_json',
      message: 'Gmail comms review payload must be a JSON object.',
      gmail_writes: false,
      gmail_message_bodies_read: false,
      live_email_sent: false,
    }, headers);
    return true;
  }

  const normalized = normalizeReviewWritePayload(payload, context.session);
  if (!normalized.ok) {
    sendJson(response, reviewWriteValidationStatus(normalized.error), {
      ok: false,
      error: normalized.error,
      message: normalized.message,
      fields: normalized.fields,
      dry_run: Boolean(payload?.dry_run !== false),
      gmail_writes: false,
      gmail_message_bodies_read: false,
      supabase_writes: false,
      live_email_sent: false,
    }, headers);
    return true;
  }

  const config = getSupabaseConfig();
  if (!config.ok) {
    sendJson(response, 503, {
      ok: false,
      error: 'gmail_comms_storage_not_configured',
      message: 'MissionMed comms storage is not configured.',
      reason: config.reason,
      dry_run: normalized.data.dryRun,
      gmail_writes: false,
      gmail_message_bodies_read: false,
      supabase_writes: false,
      live_email_sent: false,
    }, headers);
    return true;
  }

  const result = await processReviewWrite(config, normalized.data);
  sendJson(response, result.httpStatus || (result.ok ? 200 : 400), {
    ...result,
    gmail_writes: false,
    gmail_message_bodies_read: false,
    live_email_sent: false,
  }, headers);
  return true;
}

async function processReviewWrite(config, data) {
  const target = await resolveTarget(config, data);
  if (!target.ok) {
    return {
      ok: false,
      httpStatus: target.httpStatus || 400,
      error: target.error,
      message: target.message,
      dry_run: data.dryRun,
      supabase_writes: false,
    };
  }

  const dedupe = await findExistingCommsEvent(config, data);
  if (!dedupe.ok) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'gmail_comms_dedupe_check_failed',
      message: 'Gmail comms dedupe check failed before write.',
      dry_run: data.dryRun,
      supabase_writes: false,
    };
  }

  if (dedupe.existingId) {
    return {
      ok: true,
      idempotent: true,
      dry_run: data.dryRun,
      would_write: false,
      written: false,
      comms_id: dedupe.existingId,
      target: target.publicTarget,
      dedupe_key: data.dedupeKey,
      supabase_writes: false,
    };
  }

  if (data.dryRun) {
    return {
      ok: true,
      dry_run: true,
      would_write: true,
      written: false,
      target: target.publicTarget,
      dedupe_key: data.dedupeKey,
      comms_preview: buildCommsInsert(data, target, { preview: true }),
      supabase_writes: false,
    };
  }

  const insert = buildCommsInsert(data, target);
  const inserted = await insertCommsEvent(config, insert);
  if (!inserted.ok) {
    return {
      ok: false,
      httpStatus: 503,
      error: inserted.error,
      message: 'Reviewed Gmail metadata event could not be written to comms.',
      dry_run: false,
      written: false,
      supabase_writes: false,
    };
  }

  return {
    ok: true,
    dry_run: false,
    would_write: false,
    written: true,
    comms_id: inserted.id,
    target: target.publicTarget,
    dedupe_key: data.dedupeKey,
    supabase_writes: true,
  };
}

function normalizeReviewWritePayload(payload, session) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return invalid('invalid_json', 'Gmail comms review payload must be a JSON object.');
  }

  const forbidden = ['body', 'body_text', 'body_html', 'snippet', 'subject', 'payload', 'parts', 'attachment', 'attachments']
    .filter((key) => Object.prototype.hasOwnProperty.call(payload, key));
  if (forbidden.length) {
    return invalid('gmail_private_content_not_allowed', 'Raw subject, body, snippet, payload, and attachment fields are not accepted by the Gmail comms write gate.', forbidden);
  }

  const mailbox = normalizeMailbox(payload.mailbox);
  const allowedMailboxes = getConfiguredAllowedMailboxes();
  if (!mailbox) return invalid('gmail_mailbox_required', 'mailbox is required.');
  if (!allowedMailboxes.has(mailbox)) {
    return invalid('gmail_mailbox_not_allowed', 'mailbox must be one of the allowlisted MissionMed mailboxes.');
  }

  const gmailMessageId = sanitizeGmailId(payload.gmail_message_id);
  const gmailThreadId = sanitizeGmailId(payload.gmail_thread_id);
  if (!gmailMessageId) return invalid('gmail_message_id_required', 'gmail_message_id is required.');
  if (!gmailThreadId) return invalid('gmail_thread_id_required', 'gmail_thread_id is required.');

  const intakeRequestId = normalizeUuid(payload.intake_request_id);
  const offerId = normalizeUuid(payload.offer_id || payload.offer_draft_id);
  if (!intakeRequestId && !offerId) {
    return invalid('target_required', 'Admin must supply intake_request_id or offer_id for reviewed Gmail comms write.');
  }
  if (payload.intake_request_id && !intakeRequestId) return invalid('invalid_intake_request_id', 'intake_request_id must be a UUID.');
  if ((payload.offer_id || payload.offer_draft_id) && !offerId) return invalid('invalid_offer_id', 'offer_id must be a UUID.');

  const direction = sanitizeToken(payload.direction || 'IN', 12).toUpperCase();
  if (!ALLOWED_DIRECTIONS.has(direction)) {
    return invalid('invalid_direction', 'direction must be IN, OUT, or SYS.');
  }

  const reviewStatus = sanitizeToken(payload.review_status || 'approved', 40).toLowerCase();
  if (!ALLOWED_REVIEW_STATUSES.has(reviewStatus)) {
    return invalid('invalid_review_status', 'review_status must be approved or needs_review.');
  }
  if (reviewStatus !== 'approved' && payload.dry_run === false) {
    return invalid('review_not_approved', 'Non-dry-run Gmail comms writes require review_status approved.');
  }

  const from = normalizeEmailList(payload.from || payload.from_email);
  const toCc = normalizeEmailList(payload.to_cc || payload.to || payload.to_email);
  const subjectHash = sanitizeHash(payload.subject_hash);
  const messageIdHash = sanitizeHash(payload.message_id_hash);
  const inReplyToHash = sanitizeHash(payload.in_reply_to_hash);
  const referencesHash = sanitizeHash(payload.references_hash);
  const internalDate = normalizeIsoTimestamp(payload.internal_date || payload.date);
  const headerDate = sanitizeText(payload.header_date, 120);
  const matchConfidence = sanitizeToken(payload.match_confidence || 'admin_reviewed', 40).toLowerCase() || 'admin_reviewed';
  const matchReasons = Array.isArray(payload.match_reasons)
    ? payload.match_reasons.map((reason) => sanitizeToken(reason, 80)).filter(Boolean).slice(0, 10)
    : [];

  return {
    ok: true,
    data: {
      mailbox,
      gmailMessageId,
      gmailThreadId,
      intakeRequestId,
      offerId,
      direction,
      reviewStatus,
      from,
      toCc,
      subjectHash,
      messageIdHash,
      inReplyToHash,
      referencesHash,
      internalDate,
      headerDate,
      matchConfidence,
      matchReasons,
      dryRun: payload.dry_run !== false,
      dedupeKey: hashValue(`${mailbox}:${gmailMessageId}`),
      adminIdentity: buildAdminIdentity(session),
    },
  };
}

async function resolveTarget(config, data) {
  if (data.offerId) {
    const response = await supabaseSelect(config, 'command_center.usce_offer_drafts', {
      select: 'id,intake_request_id,status',
      id: `eq.${data.offerId}`,
      limit: '1',
    });
    if (!response.ok) return response;
    const offer = response.rows[0];
    if (!offer) {
      return { ok: false, httpStatus: 404, error: 'offer_not_found', message: 'Offer target was not found.' };
    }
    if (data.intakeRequestId && data.intakeRequestId !== normalizeUuid(offer.intake_request_id)) {
      return { ok: false, httpStatus: 400, error: 'target_mismatch', message: 'intake_request_id does not match the supplied offer_id.' };
    }
    return {
      ok: true,
      intakeRequestId: normalizeUuid(offer.intake_request_id),
      offerId: data.offerId,
      publicTarget: {
        intake_request_id: normalizeUuid(offer.intake_request_id),
        offer_id: data.offerId,
      },
    };
  }

  const response = await supabaseSelect(config, 'command_center.usce_public_intake_requests', {
    select: 'id,status',
    id: `eq.${data.intakeRequestId}`,
    limit: '1',
  });
  if (!response.ok) return response;
  if (!response.rows[0]) {
    return { ok: false, httpStatus: 404, error: 'intake_not_found', message: 'Intake target was not found.' };
  }
  return {
    ok: true,
    intakeRequestId: data.intakeRequestId,
    offerId: null,
    publicTarget: {
      intake_request_id: data.intakeRequestId,
      offer_id: null,
    },
  };
}

async function findExistingCommsEvent(config, data) {
  const response = await supabaseSelect(config, 'command_center.usce_comms', {
    select: 'id',
    'raw_json->>source': 'eq.gmail_metadata_review_write',
    'raw_json->>mailbox': `eq.${data.mailbox}`,
    'raw_json->>gmail_message_id': `eq.${data.gmailMessageId}`,
    limit: '1',
  });
  if (!response.ok) return response;
  return { ok: true, existingId: response.rows[0]?.id || null };
}

function buildCommsInsert(data, target, options = {}) {
  const rawJson = {
    source: 'gmail_metadata_review_write',
    schema_version: 'CX-OFFER-326',
    mailbox: data.mailbox,
    gmail_message_id: data.gmailMessageId,
    gmail_thread_id: data.gmailThreadId,
    dedupe_key: data.dedupeKey,
    offer_draft_id: target.offerId,
    subject_redacted: true,
    subject_hash: data.subjectHash || null,
    message_id_hash: data.messageIdHash || null,
    in_reply_to_hash: data.inReplyToHash || null,
    references_hash: data.referencesHash || null,
    internal_date: data.internalDate,
    header_date: data.headerDate || null,
    match_confidence: data.matchConfidence,
    match_reasons: data.matchReasons,
    review_status: data.reviewStatus,
    reviewed_by: data.adminIdentity,
    body_stored: false,
    snippet_stored: false,
    gmail_writes: false,
    dry_run: Boolean(options.preview),
  };

  return {
    intake_request_id: target.intakeRequestId,
    direction: data.direction,
    is_internal_note: data.direction === 'SYS',
    message_status: data.direction === 'IN' ? 'replied' : 'sent',
    from_email: data.from[0] || null,
    to_email: data.toCc[0] || null,
    subject: 'Gmail metadata event (subject redacted)',
    body_text: null,
    raw_json: rawJson,
    needs_triage: data.matchConfidence !== 'high',
  };
}

async function insertCommsEvent(config, insert) {
  try {
    const restTarget = buildSupabaseRestTarget(config, 'command_center.usce_comms');
    const response = await fetch(`${restTarget.url}?select=id`, {
      method: 'POST',
      headers: buildSupabaseHeaders(config.serviceKey, {
        ...restTarget.headers,
        Prefer: 'return=representation',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(insert),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, error: `supabase_insert_${response.status}` };
    }
    return { ok: true, id: Array.isArray(payload) ? payload[0]?.id : payload?.id };
  } catch {
    return { ok: false, error: 'supabase_insert_request_failed' };
  }
}

async function supabaseSelect(config, table, params) {
  try {
    const restTarget = buildSupabaseRestTarget(config, table);
    const url = new URL(restTarget.url);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && String(value) !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: buildSupabaseHeaders(config.serviceKey, restTarget.headers),
    });
    const rows = await response.json().catch(() => []);
    if (!response.ok) {
      return { ok: false, error: `supabase_select_${response.status}`, rows: [] };
    }
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } catch {
    return { ok: false, error: 'supabase_select_request_failed', rows: [] };
  }
}

function buildSupabaseRestTarget(config, relation) {
  const [schema, table] = String(relation || '').split('.');
  if (schema && table) {
    return {
      url: `${config.supabaseUrl}/rest/v1/${encodeURIComponent(table)}`,
      headers: {
        'Accept-Profile': schema,
        'Content-Profile': schema,
      },
    };
  }
  return {
    url: `${config.supabaseUrl}/rest/v1/${encodeURIComponent(String(relation || ''))}`,
    headers: {},
  };
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

async function readLimitedJsonBody(request, maxBytes) {
  const chunks = [];
  let totalSize = 0;
  for await (const chunk of request) {
    totalSize += chunk.length;
    if (totalSize > maxBytes) {
      const error = new Error('Request body too large.');
      error.code = 'body_too_large';
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function buildAdminIdentity(session) {
  const user = session?.user || {};
  return {
    wp_id: user.id || null,
    login: sanitizeText(user.login || user.username || user.user_login, 120),
    email_hash: hashValue(user.email || user.user_email || ''),
    roles: Array.isArray(user.roles) ? user.roles.map((role) => sanitizeText(role, 80)).filter(Boolean).slice(0, 8) : [],
  };
}

function buildSupabaseHeaders(serviceKey, extraHeaders = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: 'application/json',
    ...extraHeaders,
  };
}

function normalizeEmailList(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  return Array.from(new Set(raw
    .toLowerCase()
    .match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gu) || []))
    .slice(0, 20);
}

function normalizeIsoTimestamp(value) {
  const raw = sanitizeText(value, 120);
  if (!raw) return null;
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function normalizeUuid(value) {
  const raw = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(raw) ? raw : '';
}

function sanitizeHash(value) {
  const raw = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{16,64}$/u.test(raw) ? raw.slice(0, 64) : '';
}

function sanitizeGmailId(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 120);
}

function sanitizeToken(value, maxLength) {
  return String(value || '').replace(/[^A-Za-z0-9_.:-]/gu, '').trim().slice(0, maxLength);
}

function sanitizeText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .replace(/[<>]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeSupabaseUrl(value) {
  const raw = sanitizeText(value, 300).replace(/\/+$/u, '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    return parsed.origin;
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

function normalizePath(value) {
  return String(value || '').replace(/\/+$/u, '') || '/';
}

function invalid(error, message, fields = []) {
  return { ok: false, error, message, fields };
}

function reviewWriteValidationStatus(error) {
  if (error === 'gmail_mailbox_not_allowed') return 403;
  return 400;
}
