import crypto from 'node:crypto';

const OFFER_TABLE = 'command_center.usce_offer_drafts';
const PAYMENT_URL = 'https://missionmedinstitute.com/product/usce-clinical-rotations/';
const OFFER_PAGE_URL = 'https://cdn.missionmedinstitute.com/html-system/LIVE/usce_offer.html';
const TRACKER_PAGE_URL = 'https://cdn.missionmedinstitute.com/html-system/LIVE/usce_status_tracker.html';
const ACCOUNT_URL = 'https://missionmedinstitute.com/my-account/';
const MAX_BODY_BYTES = 16 * 1024;
const MAX_NOTE_LENGTH = 1000;
const MAX_ADMIN_MESSAGE_LENGTH = 2400;
const MAX_TOKEN_DAYS = 60;
const DEFAULT_TOKEN_DAYS = 14;
const SUPABASE_URL_FLAGS = ['MMHQ_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_SERVICE_KEY_FLAGS = ['MMHQ_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'MMHQ_SUPABASE_KEY'];
const CANONICAL_SUPABASE_PROJECT_REF = 'fglyvdykwgbuivikqoah';
const ADMIN_DRAFT_RPC = 'save_usce_offer_draft';
const ADMIN_UPDATE_RPC = 'update_usce_offer_draft';
const ADMIN_GET_RPC = 'get_usce_offer_draft_admin';
const ADMIN_TOKEN_RPC = 'mint_usce_offer_token';
const STUDENT_READ_RPC = 'get_usce_offer_by_token_hash';
const STUDENT_RESPOND_RPC = 'respond_usce_offer_by_token_hash';
const ADMIN_MESSAGE_PREVIEW_RPC = 'update_usce_offer_message_preview';
const ADMIN_POSTMARK_SEND_RPC = 'record_usce_offer_postmark_send';
const ADMIN_COMMS_RPC = 'list_usce_offer_comms';
const ADMIN_OPERATIONS_STATE_RPC = 'update_usce_offer_operations_state';
const ADMIN_STATUSES = new Set(['draft', 'ready', 'archived']);
const MESSAGE_CATEGORIES = new Set([
  'request_received',
  'availability_confirmed',
  'alternate_option_recommended',
  'offer_ready',
  'offer_reminder',
  'accepted_offer_next_steps',
  'declined_response',
  'alternate_requested_response',
  'payment_reminder',
]);
const PAYMENT_STATUSES = new Set(['pending', 'handoff_shown', 'paid', 'failed', 'refunded', 'manual_review']);
const PAPERWORK_STATUSES = new Set(['not_started', 'requested', 'received', 'approved', 'blocked']);
const LEARNDASH_STATUSES = new Set(['locked', 'ready', 'enabled', 'blocked']);
const POSTMARK_ENABLED_FLAGS = ['USCE_POSTMARK_ENABLED', 'MM_USCE_POSTMARK_ENABLED'];
const POSTMARK_DRY_RUN_FLAGS = ['USCE_POSTMARK_DRY_RUN', 'MM_USCE_POSTMARK_DRY_RUN'];
const POSTMARK_LIVE_SEND_FLAGS = ['USCE_POSTMARK_LIVE_SEND_ENABLED', 'MM_USCE_POSTMARK_LIVE_SEND_ENABLED'];
const POSTMARK_TOKEN_FLAGS = ['POSTMARK_SERVER_TOKEN', 'USCE_POSTMARK_SERVER_TOKEN', 'MMHQ_POSTMARK_SERVER_TOKEN'];
const POSTMARK_FROM_FLAGS = ['USCE_POSTMARK_FROM_EMAIL', 'POSTMARK_FROM_EMAIL', 'MMHQ_POSTMARK_FROM_EMAIL'];
const POSTMARK_REPLY_TO_FLAGS = ['USCE_POSTMARK_REPLY_TO_EMAIL', 'POSTMARK_REPLY_TO_EMAIL', 'MMHQ_POSTMARK_REPLY_TO_EMAIL'];
const POSTMARK_API_URL = 'https://api.postmarkapp.com/email';
const POSTMARK_FROM_NAME = 'MMI Clinical Rotations';
const DEFAULT_POSTMARK_FROM = 'clinicals@missionmedinstitute.com';
const DEFAULT_POSTMARK_REPLY_TO = 'clinicals@missionmedinstitute.com';
const POSTMARK_MAX_ATTEMPTS = 3;
const POSTMARK_RETRY_BASE_MS = 400;
const STUDENT_ACTIONS = new Map([
  ['accept', 'accept'],
  ['accepted', 'accept'],
  ['decline', 'decline'],
  ['declined', 'decline'],
  ['request_alternate', 'request_alternate'],
  ['alternate_requested', 'request_alternate'],
]);
const ALLOWED_ORIGINS = new Set([
  'https://missionmedinstitute.com',
  'https://www.missionmedinstitute.com',
  'https://cdn.missionmedinstitute.com',
  'https://missionmed-hq-production.up.railway.app',
]);
const DEV_ORIGINS = new Set([
  'http://localhost:4173',
  'http://localhost:4174',
  'http://localhost:4187',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
  'http://127.0.0.1:4187',
]);

export function isUsceOfferPortalPublicPath(pathname) {
  return getStudentOfferRoute(pathname) !== null;
}

export function isUsceAdminOfferPath(pathname) {
  return getAdminOfferRoute(pathname) !== null;
}

export async function handleUsceOfferPortalPublicRoute(request, response, url) {
  const route = getStudentOfferRoute(url.pathname);
  if (!route) return false;

  const corsHeaders = buildPublicCorsHeaders(request);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders);
    response.end();
    return true;
  }

  if (!isOriginAllowed(request)) {
    sendJson(response, 403, {
      error: 'origin_not_allowed',
      message: 'USCE offer portal is not available from this origin.',
    }, corsHeaders);
    return true;
  }

  if (!isSafeOfferToken(route.token)) {
    sendJson(response, 404, {
      error: 'offer_token_not_found',
      message: 'Offer token was not found.',
    }, corsHeaders);
    return true;
  }

  if (route.action === 'read') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET', 'OPTIONS'], corsHeaders);
      return true;
    }
    sendRoutePayload(response, await getStudentOfferByToken(route.token), corsHeaders);
    return true;
  }

  if (request.method !== 'POST') {
    sendMethodNotAllowed(response, ['POST', 'OPTIONS'], corsHeaders);
    return true;
  }

  let payload;
  try {
    payload = await readLimitedJsonBody(request, MAX_BODY_BYTES);
  } catch (error) {
    sendJson(response, error?.code === 'body_too_large' ? 413 : 400, {
      error: error?.code === 'body_too_large' ? 'payload_too_large' : 'invalid_json',
      message: 'Offer response payload could not be accepted.',
    }, corsHeaders);
    return true;
  }

  sendRoutePayload(response, await submitStudentOfferResponse(route.token, payload, request), corsHeaders);
  return true;
}

export async function handleUsceAdminOfferRoute(request, response, url, context = {}) {
  const route = getAdminOfferRoute(url.pathname);
  if (!route) return false;

  const authHeaders = context.authHeaders || {};
  if (route.action === 'comms') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET'], authHeaders);
      return true;
    }
    sendRoutePayload(response, await getAdminOfferComms(route.offerId, url.searchParams), authHeaders);
    return true;
  }

  if (route.action === 'message_preview' || route.action === 'send' || route.action === 'payment' || route.action === 'paperwork' || route.action === 'learndash') {
    const allowedMethod = route.action === 'message_preview' || route.action === 'send' ? 'POST' : 'PATCH';
    if (request.method !== allowedMethod) {
      sendMethodNotAllowed(response, [allowedMethod], authHeaders);
      return true;
    }

    const payload = await readAdminJsonPayload(request, response, authHeaders, route.action === 'comms');
    if (!payload.ok) return true;

    if (route.action === 'message_preview') {
      sendRoutePayload(response, await saveAdminMessagePreview(route.offerId, payload.body, context.session), authHeaders);
      return true;
    }

    if (route.action === 'send') {
      sendRoutePayload(response, await sendAdminOfferMessage(route.offerId, payload.body, context.session, request), authHeaders);
      return true;
    }

    sendRoutePayload(response, await updateAdminOperationsState(route.offerId, route.action, payload.body, context.session), authHeaders);
    return true;
  }

  if (route.action === 'offer') {
    if (request.method === 'GET') {
      sendRoutePayload(response, await getAdminOfferDraft(route.offerId), authHeaders);
      return true;
    }

    if (request.method === 'PATCH') {
      const payload = await readAdminJsonPayload(request, response, authHeaders);
      if (!payload.ok) return true;
      sendRoutePayload(response, await updateAdminOfferDraft(route.offerId, payload.body, context.session), authHeaders);
      return true;
    }

    sendMethodNotAllowed(response, ['GET', 'PATCH'], authHeaders);
    return true;
  }

  if (route.action === 'create') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST'], authHeaders);
      return true;
    }
    const payload = await readAdminJsonPayload(request, response, authHeaders);
    if (!payload.ok) return true;
    sendRoutePayload(response, await saveAdminOfferDraft(route.intakeRequestId, payload.body, context.session), authHeaders);
    return true;
  }

  if (request.method !== 'POST') {
    sendMethodNotAllowed(response, ['POST'], authHeaders);
    return true;
  }
  const payload = await readAdminJsonPayload(request, response, authHeaders, true);
  if (!payload.ok) return true;
  sendRoutePayload(response, await mintAdminOfferToken(route.offerId, payload.body, context.session), authHeaders);
  return true;
}

export function normalizeStudentResponseAction(value) {
  return STUDENT_ACTIONS.get(sanitizeTokenPart(value, 40).toLowerCase()) || '';
}

export function hashOfferToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || ''), 'utf8').digest('hex');
}

export function isSafeOfferToken(value) {
  const token = String(value || '').trim();
  return token.length >= 32 && token.length <= 256 && /^[A-Za-z0-9_-]+$/u.test(token);
}

export function buildPaymentHandoffForAction(action) {
  return normalizeStudentResponseAction(action) === 'accept' ? buildPaymentUrl() : null;
}

async function readAdminJsonPayload(request, response, headers, allowEmpty = false) {
  let body;
  try {
    body = await readLimitedJsonBody(request, MAX_BODY_BYTES);
  } catch (error) {
    sendJson(response, error?.code === 'body_too_large' ? 413 : 400, {
      error: error?.code === 'body_too_large' ? 'payload_too_large' : 'invalid_json',
      message: 'USCE offer admin payload must be a JSON object.',
    }, headers);
    return { ok: false };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    if (allowEmpty && (!body || Object.keys(body).length === 0)) {
      return { ok: true, body: {} };
    }
    sendJson(response, 400, {
      error: 'invalid_json',
      message: 'USCE offer admin payload must be a JSON object.',
    }, headers);
    return { ok: false };
  }

  return { ok: true, body };
}

async function saveAdminOfferDraft(intakeRequestId, payload, session) {
  if (!isUuid(intakeRequestId)) {
    return badRequest('invalid_intake_request_id', 'USCE intake request id must be a UUID.');
  }

  const offer = normalizeAdminOfferPayload(payload, { requireDraftFields: true });
  if (!offer.ok) return offer;

  return callOfferRpc({
    rpcName: ADMIN_DRAFT_RPC,
    body: {
      p_intake_request_id: intakeRequestId,
      p_offer: offer.data,
      p_admin_identity: buildAdminIdentity(session),
    },
    action: 'offer_draft_save',
  });
}

async function updateAdminOfferDraft(offerId, payload, session) {
  if (!isUuid(offerId)) {
    return badRequest('invalid_offer_id', 'USCE offer id must be a UUID.');
  }

  const offer = normalizeAdminOfferPayload(payload, { requireDraftFields: false });
  if (!offer.ok) return offer;

  return callOfferRpc({
    rpcName: ADMIN_UPDATE_RPC,
    body: {
      p_offer_id: offerId,
      p_offer: offer.data,
      p_admin_identity: buildAdminIdentity(session),
    },
    action: 'offer_draft_update',
  });
}

async function getAdminOfferDraft(offerId) {
  if (!isUuid(offerId)) {
    return badRequest('invalid_offer_id', 'USCE offer id must be a UUID.');
  }

  return callOfferRpc({
    rpcName: ADMIN_GET_RPC,
    body: { p_offer_id: offerId },
    action: 'offer_draft_read',
  });
}

async function mintAdminOfferToken(offerId, payload, session) {
  if (!isUuid(offerId)) {
    return badRequest('invalid_offer_id', 'USCE offer id must be a UUID.');
  }

  const rawToken = `usce_${crypto.randomBytes(32).toString('base64url')}`;
  const expiresAt = normalizeTokenExpiry(payload?.expires_at, payload?.expires_in_days);

  const result = await callOfferRpc({
    rpcName: ADMIN_TOKEN_RPC,
    body: {
      p_offer_id: offerId,
      p_token_hash: hashOfferToken(rawToken),
      p_expires_at: expiresAt,
      p_admin_identity: buildAdminIdentity(session),
    },
    action: 'offer_token_mint',
  });

  if (!result.ok) return result;

  return {
    ...result,
    token: rawToken,
    offer_url: `${OFFER_PAGE_URL}?offer=${encodeURIComponent(rawToken)}`,
    token_security: {
      raw_token_returned_once: true,
      stored_token_material: 'sha256_hash_only',
      expires_at: expiresAt,
    },
  };
}

async function saveAdminMessagePreview(offerId, payload, session) {
  if (!isUuid(offerId)) {
    return badRequest('invalid_offer_id', 'USCE offer id must be a UUID.');
  }

  const message = normalizeOfferMessagePayload(payload);
  if (!message.ok) return message;

  return callOfferRpc({
    rpcName: ADMIN_MESSAGE_PREVIEW_RPC,
    body: {
      p_offer_id: offerId,
      p_message: message.data,
      p_admin_identity: buildAdminIdentity(session),
    },
    action: 'offer_message_preview',
  });
}

async function sendAdminOfferMessage(offerId, payload, session, request) {
  if (!isUuid(offerId)) {
    return badRequest('invalid_offer_id', 'USCE offer id must be a UUID.');
  }

  const message = normalizeOfferMessagePayload(payload);
  if (!message.ok) return message;

  const postmarkConfig = getPostmarkConfig();
  const idempotencyKey = sanitizeTokenPart(
    request.headers['x-mm-usce-idempotency-key']
      || request.headers['idempotency-key']
      || payload?.idempotency_key
      || `${offerId}-${message.data.category}-${message.data.variant}`,
    160,
  );
  const liveApproval = payload?.approve_live_send === true;

  if (liveApproval && !postmarkConfig.liveSend) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'postmark_live_send_not_configured',
      message: 'USCE offer email live send is not configured. No email was sent.',
      dry_run: false,
      reason: postmarkConfig.reason || 'postmark_live_send_disabled',
    };
  }

  if (!liveApproval) {
    return recordOfferSend({
      offerId,
      message: message.data,
      mode: 'dry_run',
      idempotencyKey,
      postmarkMessageId: null,
      session,
      action: 'offer_postmark_dry_run',
      extra: {
        postmark_enabled: postmarkConfig.enabled,
        postmark_dry_run: postmarkConfig.dryRun,
        live_send_enabled: postmarkConfig.liveSend,
        live_send_approval: liveApproval,
      },
    });
  }

  if (!postmarkConfig.ok) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'postmark_not_configured',
      message: 'USCE Postmark live send is gated but server configuration is incomplete.',
      dry_run: false,
      reason: postmarkConfig.reason,
    };
  }

  const renderedMessage = buildOfferEmailPresentation({ offerId, message: message.data });
  const liveResult = await sendPostmarkEmailWithRetry({
    token: postmarkConfig.token,
    fromEmail: postmarkConfig.fromEmail,
    replyTo: postmarkConfig.replyTo,
    toEmail: message.data.to_email,
    subject: message.data.subject,
    body: renderedMessage.textBody,
    htmlBody: renderedMessage.htmlBody,
  });

  if (!liveResult.ok) {
    return liveResult;
  }

  return recordOfferSend({
    offerId,
    message: { ...message.data, from_email: postmarkConfig.fromEmail },
    mode: 'live',
    idempotencyKey,
    postmarkMessageId: liveResult.message_id,
    session,
    action: 'offer_postmark_live_send',
    extra: { postmark_enabled: true, postmark_dry_run: false, live_send_enabled: true },
  });
}

async function recordOfferSend({ offerId, message, mode, idempotencyKey, postmarkMessageId, session, action, extra = {} }) {
  return callOfferRpc({
    rpcName: ADMIN_POSTMARK_SEND_RPC,
    body: {
      p_offer_id: offerId,
      p_message: { ...message, ...extra },
      p_mode: mode,
      p_idempotency_key: idempotencyKey || null,
      p_postmark_message_id: postmarkMessageId || null,
      p_admin_identity: buildAdminIdentity(session),
    },
    action,
  });
}

async function getAdminOfferComms(offerId, searchParams) {
  if (!isUuid(offerId)) {
    return badRequest('invalid_offer_id', 'USCE offer id must be a UUID.');
  }

  const limit = normalizeLimit(searchParams?.get?.('limit'), 50, 100);
  return callOfferRpc({
    rpcName: ADMIN_COMMS_RPC,
    body: {
      p_offer_id: offerId,
      p_limit: limit,
    },
    action: 'offer_comms_read',
  });
}

async function updateAdminOperationsState(offerId, action, payload, session) {
  if (!isUuid(offerId)) {
    return badRequest('invalid_offer_id', 'USCE offer id must be a UUID.');
  }

  const patch = normalizeOperationsPatch(action, payload);
  if (!patch.ok) return patch;

  return callOfferRpc({
    rpcName: ADMIN_OPERATIONS_STATE_RPC,
    body: {
      p_offer_id: offerId,
      p_patch: patch.data,
      p_admin_identity: buildAdminIdentity(session),
    },
    action: `offer_${action}_state_update`,
  });
}

async function getStudentOfferByToken(rawToken) {
  return callOfferRpc({
    rpcName: STUDENT_READ_RPC,
    body: { p_token_hash: hashOfferToken(rawToken) },
    action: 'student_offer_read',
    publicRequest: true,
  });
}

async function submitStudentOfferResponse(rawToken, payload, request) {
  const action = normalizeStudentResponseAction(payload?.action);
  if (!action) {
    return badRequest('invalid_offer_response_action', 'Offer response action must be accept, decline, or request_alternate.');
  }

  const note = sanitizeText(payload?.note ?? payload?.student_response_note, MAX_NOTE_LENGTH);
  const consent = Boolean(payload?.consent);

  return callOfferRpc({
    rpcName: STUDENT_RESPOND_RPC,
    body: {
      p_token_hash: hashOfferToken(rawToken),
      p_action: action,
      p_note: note || null,
      p_consent: consent,
      p_metadata: {
        source: 'usce_offer_portal',
        user_agent_hash: hashForLog(request.headers['user-agent'] || ''),
        ip_hash: hashForLog(getClientIp(request)),
      },
    },
    action: 'student_offer_response',
    publicRequest: true,
  });
}

function normalizeAdminOfferPayload(payload, { requireDraftFields }) {
  const data = {
    specialty: sanitizeText(payload?.specialty, 160),
    location: sanitizeText(payload?.location, 180),
    timing: sanitizeText(payload?.timing, 180),
    duration_weeks: normalizeDurationWeeks(payload?.duration_weeks),
    format: sanitizeText(payload?.format, 160) || 'In-person clinical exposure',
    admin_message: sanitizeMultilineText(payload?.admin_message ?? payload?.message, MAX_ADMIN_MESSAGE_LENGTH),
    expires_at: normalizeIsoTimestamp(payload?.expires_at),
    status: normalizeAdminStatus(payload?.status),
    metadata: sanitizeMetadata(payload?.metadata),
  };

  if (requireDraftFields) {
    const missing = [];
    if (!data.specialty) missing.push('specialty');
    if (!data.location) missing.push('location');
    if (!data.timing) missing.push('timing');
    if (!data.duration_weeks) missing.push('duration_weeks');
    if (missing.length) {
      return {
        ok: false,
        httpStatus: 400,
        error: 'missing_offer_draft_fields',
        message: 'USCE offer draft is missing required fields.',
        fields: missing,
      };
    }
  }

  return { ok: true, data };
}

function normalizeOfferMessagePayload(payload) {
  const category = sanitizeTokenPart(payload?.category || 'offer_ready', 80).toLowerCase();
  const variant = sanitizeTokenPart(payload?.variant || 'coordinator_clear', 80).toLowerCase();
  const subject = sanitizeText(payload?.subject, 240);
  const body = sanitizeMultilineText(payload?.body ?? payload?.body_text ?? payload?.message, 6000);
  const toEmail = sanitizeEmail(payload?.to_email || payload?.email);

  const missing = [];
  if (!MESSAGE_CATEGORIES.has(category)) missing.push('category');
  if (!subject) missing.push('subject');
  if (!body) missing.push('body');

  if (missing.length) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'missing_message_fields',
      message: 'USCE offer message preview is missing required fields.',
      fields: missing,
    };
  }

  return {
    ok: true,
    data: {
      category,
      variant: variant || 'coordinator_clear',
      subject,
      body,
      to_email: toEmail || null,
    },
  };
}

function normalizeOperationsPatch(action, payload) {
  const note = sanitizeMultilineText(payload?.note, 1000);
  const data = {};

  if (action === 'payment') {
    const paymentStatus = sanitizeTokenPart(payload?.payment_status || payload?.status, 40).toLowerCase();
    if (!PAYMENT_STATUSES.has(paymentStatus)) {
      return badRequest('invalid_payment_status', 'Payment status must be pending, handoff_shown, paid, failed, refunded, or manual_review.');
    }
    data.payment_status = paymentStatus;
    data.payment_reference = sanitizeText(payload?.payment_reference || payload?.reference, 240) || null;
  } else if (action === 'paperwork') {
    const paperworkStatus = sanitizeTokenPart(payload?.paperwork_status || payload?.status, 40).toLowerCase();
    if (!PAPERWORK_STATUSES.has(paperworkStatus)) {
      return badRequest('invalid_paperwork_status', 'Paperwork status must be not_started, requested, received, approved, or blocked.');
    }
    data.paperwork_status = paperworkStatus;
  } else if (action === 'learndash') {
    const learndashStatus = sanitizeTokenPart(payload?.learndash_status || payload?.status, 40).toLowerCase();
    if (!LEARNDASH_STATUSES.has(learndashStatus)) {
      return badRequest('invalid_learndash_status', 'LearnDash status must be locked, ready, enabled, or blocked.');
    }
    data.learndash_status = learndashStatus;
  } else {
    return badRequest('invalid_operations_action', 'USCE operations state action is not supported.');
  }

  if (note) data.note = note;
  return { ok: true, data };
}

function normalizeLimit(value, fallback, max) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return fallback;
  return Math.max(1, Math.min(max, numeric));
}

function normalizeDurationWeeks(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 24) return null;
  return numeric;
}

function normalizeAdminStatus(value) {
  const status = sanitizeText(value, 40).toLowerCase();
  return ADMIN_STATUSES.has(status) ? status : '';
}

function normalizeTokenExpiry(expiresAt, expiresInDays) {
  const explicit = normalizeIsoTimestamp(expiresAt);
  if (explicit) return explicit;

  const days = Number(expiresInDays);
  const safeDays = Number.isInteger(days) ? Math.min(MAX_TOKEN_DAYS, Math.max(1, days)) : DEFAULT_TOKEN_DAYS;
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeIsoTimestamp(value) {
  const raw = sanitizeText(value, 80);
  if (!raw) return null;
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function sanitizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const safe = {};
  for (const [key, val] of Object.entries(value).slice(0, 20)) {
    const safeKey = sanitizeText(key, 80);
    if (!safeKey) continue;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      safe[safeKey] = typeof val === 'string' ? sanitizeText(val, 400) : val;
    }
  }
  return safe;
}

function buildAdminIdentity(session) {
  const user = session?.user || {};
  return {
    wp_id: user.id || null,
    login: sanitizeText(user.login || user.username || user.user_login, 120),
    email_hash: hashForLog(user.email || user.user_email || ''),
    roles: Array.isArray(user.roles) ? user.roles.map((role) => sanitizeText(role, 80)).filter(Boolean).slice(0, 8) : [],
  };
}

async function callOfferRpc({ rpcName, body, action, publicRequest = false }) {
  const config = getSupabaseOfferConfig();
  if (!config.ok) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'usce_offer_storage_not_configured',
      message: 'USCE offer storage is not configured.',
      storage_target: OFFER_TABLE,
      storage_adapter: `rpc:${rpcName}`,
      reason: config.reason,
    };
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: buildSupabaseHeaders(config.serviceKey, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(body),
  });

  const payload = await readSupabaseJson(response);
  if (response.ok && payload && typeof payload === 'object') {
    if (payload.ok === false) {
      return mapRpcError(payload, publicRequest);
    }

    return {
      ok: true,
      mode: 'live',
      action,
      storage_target: OFFER_TABLE,
      storage_adapter: `rpc:${rpcName}`,
      ...payload,
    };
  }

  return {
    ok: false,
    httpStatus: response.status === 400 ? 400 : 503,
    error: 'usce_offer_rpc_failed',
    message: 'USCE offer operation could not be completed.',
    storage_target: OFFER_TABLE,
    storage_adapter: `rpc:${rpcName}`,
    reason: safeSupabaseErrorReason(payload),
  };
}

function mapRpcError(payload, publicRequest) {
  const error = sanitizeText(payload.error, 80) || 'usce_offer_operation_failed';
  const statusMap = {
    not_found: 404,
    intake_not_found: 404,
    invalid_token: 404,
    expired: 410,
    already_responded: 409,
    invalid_state: 409,
    invalid_action: 400,
  };
  return {
    ok: false,
    httpStatus: statusMap[error] || 400,
    error: publicRequest && error === 'not_found' ? 'invalid_token' : error,
    message: publicSafeErrorMessage(error),
  };
}

function publicSafeErrorMessage(error) {
  const messages = {
    invalid_token: 'Offer token is invalid or no longer available.',
    not_found: 'Offer was not found.',
    intake_not_found: 'USCE intake request was not found.',
    expired: 'Offer token has expired.',
    already_responded: 'This offer already has a different recorded response.',
    invalid_state: 'Offer is not available for this action.',
    invalid_action: 'Offer response action is not allowed.',
  };
  return messages[error] || 'USCE offer operation could not be completed.';
}

function getSupabaseOfferConfig() {
  const supabaseUrl = sanitizeSupabaseUrl(envValueAny(SUPABASE_URL_FLAGS, ''));
  const serviceKey = envValueAny(SUPABASE_SERVICE_KEY_FLAGS, '');

  if (!supabaseUrl) return { ok: false, reason: 'supabase_url_missing' };
  if (getSupabaseProjectRef(supabaseUrl) !== CANONICAL_SUPABASE_PROJECT_REF) {
    return { ok: false, reason: 'supabase_project_mismatch' };
  }
  if (!serviceKey) return { ok: false, reason: 'supabase_service_key_missing' };

  return { ok: true, supabaseUrl, serviceKey };
}

function getAdminOfferRoute(pathname) {
  const normalized = normalizePathname(pathname);
  let match = normalized.match(/^\/api\/usce\/admin\/intake-requests\/([^/]+)\/offer-draft$/u);
  if (match) {
    return { action: 'create', intakeRequestId: match[1] };
  }

  match = normalized.match(/^\/api\/usce\/admin\/offers\/([^/]+)$/u);
  if (match) {
    return { action: 'offer', offerId: match[1] };
  }

  match = normalized.match(/^\/api\/usce\/admin\/offers\/([^/]+)\/message-preview$/u);
  if (match) {
    return { action: 'message_preview', offerId: match[1] };
  }

  match = normalized.match(/^\/api\/usce\/admin\/offers\/([^/]+)\/send$/u);
  if (match) {
    return { action: 'send', offerId: match[1] };
  }

  match = normalized.match(/^\/api\/usce\/admin\/offers\/([^/]+)\/comms$/u);
  if (match) {
    return { action: 'comms', offerId: match[1] };
  }

  match = normalized.match(/^\/api\/usce\/admin\/offers\/([^/]+)\/payment$/u);
  if (match) {
    return { action: 'payment', offerId: match[1] };
  }

  match = normalized.match(/^\/api\/usce\/admin\/offers\/([^/]+)\/paperwork$/u);
  if (match) {
    return { action: 'paperwork', offerId: match[1] };
  }

  match = normalized.match(/^\/api\/usce\/admin\/offers\/([^/]+)\/learndash$/u);
  if (match) {
    return { action: 'learndash', offerId: match[1] };
  }

  match = normalized.match(/^\/api\/usce\/admin\/offers\/([^/]+)\/token$/u);
  if (match) {
    return { action: 'token', offerId: match[1] };
  }

  return null;
}

function getStudentOfferRoute(pathname) {
  const normalized = normalizePathname(pathname);
  let match = normalized.match(/^\/api\/usce\/offer\/([^/]+)$/u);
  if (match) {
    return { action: 'read', token: decodeToken(match[1]) };
  }

  match = normalized.match(/^\/api\/usce\/offer\/([^/]+)\/respond$/u);
  if (match) {
    return { action: 'respond', token: decodeToken(match[1]) };
  }

  return null;
}

function decodeToken(value) {
  try {
    return decodeURIComponent(String(value || '')).trim();
  } catch {
    return '';
  }
}

function sendRoutePayload(response, payload, headers = {}) {
  const statusCode = payload?.httpStatus || (payload?.ok === false ? 400 : 200);
  const { httpStatus: _httpStatus, ...safePayload } = payload || {};
  sendJson(response, statusCode, safePayload, headers);
}

function sendMethodNotAllowed(response, methods, headers = {}) {
  sendJson(response, 405, {
    error: 'method_not_allowed',
    message: `Allowed methods: ${methods.join(', ')}`,
  }, {
    ...headers,
    Allow: methods.join(', '),
  });
}

function badRequest(error, message) {
  return { ok: false, httpStatus: 400, error, message };
}

function buildSupabaseHeaders(serviceKey, extraHeaders = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: 'application/json',
    ...extraHeaders,
  };
}

async function readSupabaseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeSupabaseErrorReason(payload) {
  const code = sanitizeText(payload?.code, 80);
  return code || 'supabase_request_failed';
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

function buildPublicCorsHeaders(request = null) {
  const origin = String(request?.headers?.origin || '').trim();
  const allowedOrigin = isAllowedOriginValue(origin) ? origin : 'https://missionmedinstitute.com';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function isOriginAllowed(request = null) {
  const origin = String(request?.headers?.origin || '').trim();
  return !origin || isAllowedOriginValue(origin);
}

function isAllowedOriginValue(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && DEV_ORIGINS.has(origin)) return true;
  return false;
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

function sanitizeMultilineText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, ' ')
    .replace(/[<>]/gu, '')
    .replace(/[ \t]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function sanitizeText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .replace(/[<>]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeEmail(value) {
  const raw = sanitizeText(value, 320).toLowerCase();
  if (!raw || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(raw)) return '';
  return raw;
}

function formatPostmarkFromHeader(value) {
  const email = sanitizeEmail(value) || DEFAULT_POSTMARK_FROM;
  return `${POSTMARK_FROM_NAME} <${email}>`;
}

function sanitizeTokenPart(value, maxLength) {
  return String(value || '')
    .replace(/[^A-Za-z0-9_-]/gu, '')
    .trim()
    .slice(0, maxLength);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(String(value || '').trim());
}

function getClientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const realIp = String(request.headers['x-real-ip'] || '').trim();
  return forwarded || realIp || request.socket?.remoteAddress || 'unknown';
}

function hashForLog(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
}

function envValueAny(names, fallback = '') {
  for (const name of names) {
    const raw = String(process.env[name] || '').trim();
    if (raw) return raw;
  }
  return String(fallback);
}

function envFlagAny(names, defaultValue = false) {
  const raw = envValueAny(names, '');
  if (!raw) return Boolean(defaultValue);
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(raw.toLowerCase());
}

function getPostmarkConfig() {
  const token = envValueAny(POSTMARK_TOKEN_FLAGS, '');
  const enabled = envFlagAny(POSTMARK_ENABLED_FLAGS, Boolean(token));
  const dryRun = envFlagAny(POSTMARK_DRY_RUN_FLAGS, false);
  const liveSend = enabled && !dryRun && envFlagAny(POSTMARK_LIVE_SEND_FLAGS, true);
  const fromEmail = sanitizeEmail(envValueAny(POSTMARK_FROM_FLAGS, DEFAULT_POSTMARK_FROM)) || DEFAULT_POSTMARK_FROM;
  const replyTo = sanitizeEmail(envValueAny(POSTMARK_REPLY_TO_FLAGS, DEFAULT_POSTMARK_REPLY_TO)) || DEFAULT_POSTMARK_REPLY_TO;

  if (!token && !dryRun) {
    return { ok: false, enabled, dryRun: false, liveSend: false, fromEmail, replyTo, reason: 'postmark_token_missing' };
  }

  if (!liveSend) {
    return {
      ok: true,
      enabled,
      dryRun: true,
      liveSend: false,
      fromEmail,
      replyTo,
      reason: dryRun ? 'postmark_dry_run_enabled' : 'postmark_live_send_disabled',
    };
  }

  if (!token) {
    return { ok: false, enabled, dryRun, liveSend, fromEmail, replyTo, reason: 'postmark_token_missing' };
  }

  return { ok: true, enabled, dryRun, liveSend, token, fromEmail, replyTo };
}

function buildOfferEmailPresentation({ offerId, message }) {
  const category = String(message?.category || 'offer_ready').toLowerCase();
  const body = String(message?.body || '');
  const offerUrl = extractUrl(body, 'usce_offer.html') || OFFER_PAGE_URL;
  const status = offerEmailStatus(category);
  const actions = [
    { label: status.primaryActionLabel, url: status.includePayment ? buildPaymentUrl() : offerUrl, primary: true },
    { label: 'Open tracker', url: TRACKER_PAGE_URL, primary: false },
    { label: 'Sign in', url: buildAccountUrl(TRACKER_PAGE_URL), primary: false },
  ];
  if (!status.includePayment) actions.push({ label: 'Contact Clinicals', url: 'mailto:clinicals@missionmedinstitute.com', primary: false });

  const textActions = actions.map((action) => `${action.label}: ${action.url}`).join('\n');
  const textBody = `${offerEmailHeading(category)}\n\n${body}\n\nCurrent tracker step: ${status.stageLabel} - ${status.stageText}\n\nActions\n${textActions}\n\nMissionMed Clinicals`;
  const stages = ['Received', 'Review', 'Available', 'Offer', 'Secured'];
  const htmlBody = buildOfferTrackerEmailHtml({
    preheader: status.preheader,
    eyebrow: status.eyebrow,
    heading: offerEmailHeading(category),
    intro: body,
    statusLabel: status.stageLabel,
    statusText: status.stageText,
    activeIndex: status.activeIndex,
    offerId,
    actions,
    stages,
    primaryUrl: status.includePayment ? buildPaymentUrl() : offerUrl,
  });

  return { textBody, htmlBody };
}

function buildOfferTrackerEmailHtml({
  preheader,
  eyebrow,
  heading,
  intro,
  statusLabel,
  statusText,
  activeIndex,
  offerId,
  actions,
  stages,
  primaryUrl,
}) {
  const safeActiveIndex = Math.max(0, Math.min(stages.length - 1, Number(activeIndex) || 0));
  const paragraphs = String(intro || '')
    .split(/\n{2,}/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p style="margin:0 0 12px;color:#d9e7f1;font-size:15px;line-height:1.65;">${escapeHtml(part)}</p>`)
    .join('');
  const labels = stages.map((stage) => `<td align="center" style="padding:0 3px 7px;color:#ffffff;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(stage)}</td>`).join('');
  const segments = stages.map((stage, index) => {
    const done = index < safeActiveIndex;
    const active = index === safeActiveIndex;
    const background = done ? '#32bf72' : active ? '#ff7f35' : '#8d9ba6';
    const color = done || active ? '#ffffff' : '#dce5ec';
    const radius = index === 0 ? '999px 0 0 999px' : index === stages.length - 1 ? '0 999px 999px 0' : '0';
    return `<td width="20%" align="center" style="padding:0;"><div style="min-height:64px;line-height:64px;background:${background};border-right:3px solid #6f8291;border-radius:${radius};color:${color};font-size:28px;font-weight:900;text-shadow:0 2px 7px rgba(0,0,0,.26);">${index + 1}</div></td>`;
  }).join('');
  const actionButtons = actions.map((action) => {
    const background = action.primary ? '#f3cf61' : '#ffffff';
    const border = action.primary ? '#f3cf61' : '#d7dee8';
    return `<a href="${escapeHtml(action.url)}" style="display:inline-block;margin:0 8px 10px 0;padding:13px 18px;border-radius:999px;background:${background};border:1px solid ${border};color:#071627;font-size:12px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;text-decoration:none;">${escapeHtml(action.label)}</a>`;
  }).join('');

  return [
    '<!doctype html><html><body style="margin:0;padding:0;background:#071627;">',
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader || '')}</div>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#071627;font-family:Poppins,Arial,Helvetica,sans-serif;color:#ffffff;"><tr><td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:1180px;border-collapse:collapse;">',
    '<tr><td style="padding:14px 20px;background:#051524;border-bottom:1px solid rgba(255,255,255,.18);">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>',
    '<td width="64" valign="middle"><div style="width:42px;height:42px;border-radius:50%;background:#f3cf61;color:#071627;text-align:center;line-height:42px;font-family:Georgia,serif;font-size:18px;font-weight:900;">MM</div></td>',
    '<td valign="middle"><div style="color:#ffffff;font-size:15px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">MissionMed</div><div style="color:#a9b9c8;font-size:11px;letter-spacing:.12em;text-transform:uppercase;">Clinical rotations</div></td>',
    '<td align="right" valign="middle"><div style="color:#f3cf61;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">Request Tracker</div><div style="color:#a9b9c8;font-size:11px;">Secure offer update</div></td>',
    '</tr></table>',
    '</td></tr>',
    '<tr><td style="padding:34px 20px 16px;background:#0b4770;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>',
    '<td valign="bottom" style="padding-right:24px;">',
    `<div style="display:inline-block;border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:8px 13px;color:#f3cf61;background:rgba(255,255,255,.08);font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;">${escapeHtml(eyebrow || 'USCE request tracker')}</div>`,
    `<h1 style="margin:18px 0 12px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:58px;line-height:.98;font-weight:700;">${escapeHtml(heading)}</h1>`,
    paragraphs,
    '</td>',
    '<td width="330" valign="bottom"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffaf0;color:#071627;border-radius:8px;border-top:6px solid #d9b85b;box-shadow:0 20px 60px rgba(0,0,0,.24);"><tr><td style="padding:18px;">',
    '<div style="color:#627287;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">Current status</div>',
    `<div style="margin-top:6px;color:#071627;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.1;font-weight:900;">${escapeHtml(statusLabel)}</div>`,
    `<div style="margin-top:8px;color:#627287;font-size:13px;line-height:1.55;">${escapeHtml(statusText)}</div>`,
    '</td></tr></table></td>',
    '</tr></table>',
    '</td></tr>',
    '<tr><td style="padding:0 20px 16px;background:linear-gradient(180deg,#0b4770 0%,#0b4770 50%,#071627 50%,#071627 100%);">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b78a8;border:1px solid rgba(255,255,255,.22);border-radius:12px;box-shadow:0 26px 80px rgba(0,0,0,.34);"><tr><td style="padding:16px;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="color:#ffffff;font-size:28px;line-height:1;font-weight:900;text-transform:uppercase;">USCE<br><span style="color:#f3cf61;">Tracker</span></td>',
    `<td align="right" style="color:#d9e7f1;font-size:12px;line-height:1.55;">Active now: <b style="color:#ffffff;">${escapeHtml(statusLabel)}</b>. Completed segments turn green; the current segment blinks.</td></tr></table>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;background:#073c5a;border:1px solid rgba(255,255,255,.16);border-radius:6px;"><tr><td style="padding:16px;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>' + labels + '</tr></table>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:3px solid rgba(255,255,255,.72);border-radius:999px;overflow:hidden;background:#637689;"><tr>' + segments + '</tr></table>',
    `<div style="margin:16px 0 0;text-align:center;color:#ffffff;font-size:17px;line-height:1.35;font-weight:900;text-transform:uppercase;">${escapeHtml(statusLabel)} - <span style="color:#f3cf61;">${escapeHtml(statusText)}</span></div>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;"><tr>',
    `<td width="33.33%" valign="top" style="padding:0 5px;"><div style="min-height:80px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);border-radius:4px;padding:13px;"><b style="display:block;color:#ffffff;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Your request</b><span style="display:block;margin-top:7px;color:rgba(255,255,255,.78);font-size:12px;line-height:1.55;">Offer reference ${escapeHtml(offerId || 'pending')}</span></div></td>`,
    `<td width="33.33%" valign="top" style="padding:0 5px;"><div style="min-height:80px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);border-radius:4px;padding:13px;"><b style="display:block;color:#ffffff;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Current step</b><span style="display:block;margin-top:7px;color:rgba(255,255,255,.78);font-size:12px;line-height:1.55;">${escapeHtml(statusText)}</span></div></td>`,
    `<td width="33.33%" valign="top" style="padding:0 5px;"><div style="min-height:80px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);border-radius:4px;padding:13px;"><b style="display:block;color:#ffffff;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Follow tracking</b><span style="display:block;margin-top:7px;color:rgba(255,255,255,.78);font-size:12px;line-height:1.55;">Use the tracker to review this update.</span><a href="${escapeHtml(TRACKER_PAGE_URL)}" style="color:#f3cf61;font-size:12px;font-weight:900;text-decoration:none;">Open tracker</a></div></td>`,
    '</tr></table></td></tr></table></td></tr></table>',
    '</td></tr>',
    '<tr><td style="padding:0 20px 16px;background:#071627;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffdf6;color:#071627;border-radius:8px;"><tr><td style="padding:20px;">',
    '<div style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#071627;">Want to follow every update?</div>',
    '<p style="margin:8px 0 14px;color:#627287;font-size:13px;line-height:1.65;">Open the tracker or sign in with the same email to follow your request securely from any device.</p>',
    actionButtons,
    `<p style="margin:2px 0 0;color:#627287;font-size:12px;line-height:1.6;">Primary action: ${escapeHtml(primaryUrl || TRACKER_PAGE_URL)}</p>`,
    '</td></tr></table></td></tr>',
    '<tr><td style="padding:0 20px 20px;background:#071627;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>',
    '<td width="56%" valign="top" style="padding-right:8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffdf6;color:#071627;border-radius:8px;"><tr><td style="padding:20px;"><div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;">What happens next</div><div style="margin-top:12px;border:1px solid rgba(217,184,91,.38);background:#fffaf0;border-radius:8px;padding:17px;"><small style="display:block;color:#627287;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;">Current step</small><b style="display:block;margin-top:5px;color:#071627;font-family:Georgia,serif;font-size:25px;line-height:1.15;">' + escapeHtml(statusLabel) + '</b><span style="display:block;margin-top:8px;color:#627287;font-size:13px;line-height:1.65;">' + escapeHtml(statusText) + '</span></div></td></tr></table></td>',
    '<td width="44%" valign="top" style="padding-left:8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffdf6;color:#071627;border-radius:8px;"><tr><td style="padding:20px;"><div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;">Status details</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;"><tr><td style="padding:0 5px 9px 0;"><div style="border:1px solid #d7dee8;border-radius:8px;background:#ffffff;padding:11px;"><small style="display:block;color:#627287;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">Offer</small><b style="display:block;margin-top:4px;color:#071627;font-size:13px;line-height:1.35;">' + escapeHtml(statusLabel) + '</b></div></td><td style="padding:0 0 9px 5px;"><div style="border:1px solid #d7dee8;border-radius:8px;background:#ffffff;padding:11px;"><small style="display:block;color:#627287;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">Tuition</small><b style="display:block;margin-top:4px;color:#071627;font-size:13px;line-height:1.35;">Pending</b></div></td></tr></table></td></tr></table></td>',
    '</tr></table>',
    '<p style="margin:20px 0 0;text-align:center;color:rgba(255,255,255,.66);font-size:12px;line-height:1.65;">This tracker does not create payments, orders, emails, or course enrollment. Payment appears only after an accepted offer.</p>',
    '</td></tr></table></td></tr></table></body></html>',
  ].join('');
}

function offerEmailHeading(category) {
  if (category === 'accepted_offer_next_steps') return 'Your MissionMed Clinicals next steps are ready';
  if (category === 'payment_reminder') return 'Secure your MissionMed rotation seat';
  if (category === 'declined_response') return 'Your MissionMed Clinicals response was recorded';
  if (category === 'alternate_requested_response') return 'We received your alternate request';
  if (category === 'availability_confirmed') return 'MissionMed Clinicals found a possible rotation path';
  return 'Your MissionMed Clinicals offer is ready';
}

function offerEmailStatus(category) {
  if (category === 'accepted_offer_next_steps' || category === 'payment_reminder') {
    return { eyebrow: 'Offer accepted', preheader: 'Secure your approved rotation seat and complete enrollment.', stageLabel: 'Tuition next', stageText: 'Secure your approved seat', activeIndex: 4, primaryActionLabel: 'Secure seat', includePayment: true };
  }
  if (category === 'declined_response') {
    return { eyebrow: 'Response recorded', preheader: 'Your decline was recorded and no payment is needed.', stageLabel: 'Offer declined', stageText: 'No tuition handoff opened', activeIndex: 3, primaryActionLabel: 'View tracker', includePayment: false };
  }
  if (category === 'alternate_requested_response') {
    return { eyebrow: 'Alternate requested', preheader: 'MissionMed Clinicals is preparing a better-fit option.', stageLabel: 'Alternate requested', stageText: 'Clinical team reviewing', activeIndex: 2, primaryActionLabel: 'View tracker', includePayment: false };
  }
  if (category === 'availability_confirmed') {
    return { eyebrow: 'Availability confirmed', preheader: 'A possible rotation path is being prepared.', stageLabel: 'Availability confirmed', stageText: 'Preparing offer', activeIndex: 2, primaryActionLabel: 'View tracker', includePayment: false };
  }
  return { eyebrow: 'Offer ready', preheader: 'Approve, decline, or request an alternate MissionMed Clinicals offer.', stageLabel: 'Offer sent', stageText: 'Waiting for your approval', activeIndex: 3, primaryActionLabel: 'Review offer', includePayment: false };
}

function buildPaymentUrl() {
  const url = new URL(PAYMENT_URL);
  url.searchParams.set('usce_offer_approved', '1');
  url.searchParams.set('secure_window', '48h');
  return url.toString();
}

function buildAccountUrl(target) {
  const url = new URL(ACCOUNT_URL);
  url.searchParams.set('redirect_to', target || TRACKER_PAGE_URL);
  return url.toString();
}

function extractUrl(body, contains) {
  const candidates = String(body || '').match(/https?:\/\/[^\s<>"')]+/gu) || [];
  const found = candidates.find((url) => !contains || url.includes(contains));
  return found || candidates[0] || '';
}

async function sendPostmarkEmailWithRetry(message) {
  let lastResult = { ok: false, reason: 'postmark_not_attempted', retryable: true };

  for (let attempt = 1; attempt <= POSTMARK_MAX_ATTEMPTS; attempt += 1) {
    lastResult = await sendPostmarkEmail(message);
    if (lastResult.ok || !lastResult.retryable || attempt === POSTMARK_MAX_ATTEMPTS) {
      return { ...lastResult, attempts: attempt };
    }
    await sleep(POSTMARK_RETRY_BASE_MS * attempt);
  }

  return { ...lastResult, attempts: POSTMARK_MAX_ATTEMPTS };
}

async function sendPostmarkEmail({ token, fromEmail, replyTo, toEmail, subject, body, htmlBody }) {
  if (!sanitizeEmail(toEmail)) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'missing_recipient_email',
      message: 'A live USCE offer email requires an explicit valid recipient email.',
      retryable: false,
    };
  }

  let response;
  try {
    response = await fetch(POSTMARK_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify({
        From: formatPostmarkFromHeader(fromEmail),
        To: toEmail,
        ReplyTo: replyTo || DEFAULT_POSTMARK_REPLY_TO,
        Subject: subject,
        TextBody: body,
        HtmlBody: htmlBody || textToHtml(body),
        MessageStream: 'outbound',
        Tag: 'usce-offer',
      }),
    });
  } catch {
    return {
      ok: false,
      httpStatus: 502,
      error: 'postmark_network_error',
      message: 'Postmark could not be reached for the USCE offer email.',
      reason: 'postmark_network_error',
      retryable: true,
    };
  }

  const payload = await readSupabaseJson(response);
  if (!response.ok) {
    return {
      ok: false,
      httpStatus: 502,
      error: 'postmark_send_failed',
      message: 'Postmark rejected the USCE offer email.',
      reason: sanitizeText(payload?.ErrorCode || payload?.Message || response.status, 160),
      retryable: response.status === 429 || response.status >= 500,
      statusCode: response.status,
    };
  }

  return {
    ok: true,
    message_id: sanitizeText(payload?.MessageID || payload?.MessageId || '', 180),
    retryable: false,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function textToHtml(value) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;max-width:680px;white-space:pre-wrap;">${escapeHtml(value)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function normalizePathname(pathname) {
  const value = String(pathname || '/').replace(/\/+$/u, '');
  return value || '/';
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload, null, 2));
}
