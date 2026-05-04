import crypto from 'node:crypto';

const PUBLIC_INTAKE_PATH = '/api/usce/public/requests';
const PUBLIC_CONFIG_PATH = '/api/usce/public/config';
const ADMIN_PUBLIC_INTAKE_LIST_PATH = '/api/usce/admin/public-intake-requests';
const ADMIN_PUBLIC_INTAKE_ACTION_PREFIX = `${ADMIN_PUBLIC_INTAKE_LIST_PATH}/`;
const MAX_BODY_BYTES = 16 * 1024;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const IP_LIMIT = 3;
const EMAIL_LIMIT = 1;
const ADMIN_LIST_MAX_LIMIT = 100;
const ADMIN_NOTE_MAX_LENGTH = 4000;
const RECIPIENTS = ['clinicals@missionmedinstitute.com', 'philperri@gmail.com'];
const INTAKE_ENABLED_FLAGS = ['MM_USCE_PUBLIC_INTAKE_ENABLED', 'USCE_PUBLIC_INTAKE_ENABLED'];
const NOTIFY_DRY_RUN_FLAGS = ['MM_USCE_PUBLIC_INTAKE_NOTIFY_DRY_RUN', 'USCE_PUBLIC_INTAKE_NOTIFY_DRY_RUN'];
const WRITE_MODE_FLAGS = ['MM_USCE_PUBLIC_INTAKE_WRITE_MODE', 'USCE_PUBLIC_INTAKE_WRITE_MODE'];
const SCHEMA_READY_FLAGS = ['MM_USCE_PUBLIC_INTAKE_SCHEMA_READY', 'USCE_PUBLIC_INTAKE_SCHEMA_READY'];
const SUPABASE_URL_FLAGS = ['MMHQ_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_SERVICE_KEY_FLAGS = ['MMHQ_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'MMHQ_SUPABASE_KEY'];
const CANONICAL_SUPABASE_PROJECT_REF = 'fglyvdykwgbuivikqoah';
const PUBLIC_INTAKE_TABLE = 'command_center.usce_public_intake_requests';
const PUBLIC_INTAKE_RPC = 'create_usce_public_intake_request';
const ADMIN_PUBLIC_INTAKE_LIST_RPC = 'list_usce_public_intake_requests';
const ADMIN_PUBLIC_INTAKE_STATUS_RPC = 'update_usce_public_intake_request_status';
const ADMIN_PUBLIC_INTAKE_NOTE_RPC = 'update_usce_public_intake_request_admin_note';
const ADMIN_STATUS_VALUES = new Set(['new', 'reviewed', 'in_progress', 'offer_ready', 'archived']);
const CANONICAL_PAYMENT_PRODUCT_URL = 'https://missionmedinstitute.com/product/usce-clinical-rotations/';
const CANONICAL_LEARNDASH_COURSE_URL = 'https://missionmedinstitute.com/courses/mmi-clinicals/';
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

const ipHits = new Map();
const emailHits = new Map();
const idempotencyHits = new Map();

export async function handleUscePublicRoute(request, response, url) {
  const pathname = normalizePathname(url.pathname);

  if (!pathname.startsWith('/api/usce/public/')) {
    return false;
  }

  const corsHeaders = buildPublicCorsHeaders(request);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders);
    response.end();
    return true;
  }

  if (!isOriginAllowed(request)) {
    sendPublicJson(response, 403, {
      error: 'origin_not_allowed',
      message: 'Clinical rotation request intake is not available from this origin.',
    }, corsHeaders);
    return true;
  }

  if (pathname === PUBLIC_CONFIG_PATH) {
    if (request.method !== 'GET') {
      sendPublicMethodNotAllowed(response, ['GET', 'OPTIONS'], corsHeaders);
      return true;
    }

    sendPublicJson(response, 200, buildPublicConfig(), corsHeaders);
    return true;
  }

  if (pathname === PUBLIC_INTAKE_PATH) {
    if (request.method !== 'POST') {
      sendPublicMethodNotAllowed(response, ['POST', 'OPTIONS'], corsHeaders);
      return true;
    }

    await handlePublicRequestCreate(request, response, corsHeaders);
    return true;
  }

  sendPublicJson(response, 404, {
    error: 'usce_public_route_not_found',
    message: 'Clinical rotation request route was not found.',
  }, corsHeaders);
  return true;
}

export function isUsceAdminPublicIntakeListPath(pathname) {
  return normalizePathname(pathname) === ADMIN_PUBLIC_INTAKE_LIST_PATH;
}

export function getUsceAdminPublicIntakeAction(pathname) {
  const normalized = normalizePathname(pathname);
  if (!normalized.startsWith(ADMIN_PUBLIC_INTAKE_ACTION_PREFIX)) {
    return null;
  }

  const parts = normalized.slice(ADMIN_PUBLIC_INTAKE_ACTION_PREFIX.length).split('/');
  if (parts.length !== 2) {
    return null;
  }

  const [requestId, action] = parts;
  if (!isUuid(requestId) || !['status', 'admin-note'].includes(action)) {
    return null;
  }

  return { requestId, action };
}

export async function getUscePublicIntakeAdminList(searchParams = new URLSearchParams()) {
  const config = getSupabasePublicIntakeConfig();
  if (!config.ok) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'usce_public_intake_admin_storage_not_configured',
      message: 'USCE public intake admin read storage is not configured.',
      storage_target: PUBLIC_INTAKE_TABLE,
      storage_adapter: `rpc:${ADMIN_PUBLIC_INTAKE_LIST_RPC}`,
      reason: config.reason,
    };
  }

  const params = normalizeAdminListParams(searchParams);
  const rpcResult = await listSupabasePublicIntakeViaRpc(config, params);
  if (!rpcResult.ok) {
    return {
      ok: false,
      httpStatus: rpcResult.statusCode || 503,
      error: 'usce_public_intake_admin_read_failed',
      message: 'USCE public intake requests could not be loaded.',
      storage_target: PUBLIC_INTAKE_TABLE,
      storage_adapter: `rpc:${ADMIN_PUBLIC_INTAKE_LIST_RPC}`,
      reason: rpcResult.reason,
    };
  }

  return {
    ok: true,
    mode: 'live',
    storage_target: PUBLIC_INTAKE_TABLE,
    storage_adapter: `rpc:${ADMIN_PUBLIC_INTAKE_LIST_RPC}`,
    items: Array.isArray(rpcResult.payload.items) ? rpcResult.payload.items : [],
    pagination: {
      limit: params.limit,
      offset: params.offset,
      count: Number(rpcResult.payload.count || 0),
    },
    filters: {
      status: params.status || null,
      search: params.search || null,
    },
  };
}

export async function updateUscePublicIntakeAdminStatus(requestId, payload = {}) {
  if (!isUuid(requestId)) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'invalid_public_intake_request_id',
      message: 'USCE public intake request id must be a UUID.',
    };
  }

  const status = sanitizeText(payload?.status, 40).toLowerCase();
  if (!ADMIN_STATUS_VALUES.has(status)) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'invalid_usce_public_intake_status',
      message: 'USCE public intake status is not allowed.',
      allowed_statuses: Array.from(ADMIN_STATUS_VALUES),
    };
  }

  return callSupabasePublicIntakeAdminRpc({
    rpcName: ADMIN_PUBLIC_INTAKE_STATUS_RPC,
    body: {
      p_request_id: requestId,
      p_status: status,
    },
    action: 'status_update',
  });
}

export async function updateUscePublicIntakeAdminNote(requestId, payload = {}) {
  if (!isUuid(requestId)) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'invalid_public_intake_request_id',
      message: 'USCE public intake request id must be a UUID.',
    };
  }

  const note = sanitizeText(payload?.admin_note ?? payload?.admin_notes ?? payload?.note, ADMIN_NOTE_MAX_LENGTH);
  if (!note) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'invalid_usce_public_intake_admin_note',
      message: 'USCE public intake admin note cannot be empty.',
    };
  }

  return callSupabasePublicIntakeAdminRpc({
    rpcName: ADMIN_PUBLIC_INTAKE_NOTE_RPC,
    body: {
      p_request_id: requestId,
      p_admin_note: note,
    },
    action: 'admin_note_update',
  });
}

async function handlePublicRequestCreate(request, response, corsHeaders) {
  if (!envFlagAny(INTAKE_ENABLED_FLAGS, false)) {
    sendPublicJson(response, 503, {
      error: 'usce_public_intake_disabled',
      message: 'Clinical rotation request intake is not accepting submissions right now.',
    }, corsHeaders);
    return;
  }

  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  if (!contentType.split(';')[0].trim().endsWith('/json') && !contentType.includes('application/json')) {
    sendPublicJson(response, 415, {
      error: 'unsupported_media_type',
      message: 'Clinical rotation request intake accepts JSON only.',
    }, corsHeaders);
    return;
  }

  let rawPayload;
  try {
    rawPayload = await readLimitedJsonBody(request, MAX_BODY_BYTES);
  } catch (error) {
    const code = error?.code === 'body_too_large' ? 413 : 400;
    sendPublicJson(response, code, {
      error: code === 413 ? 'payload_too_large' : 'invalid_json',
      message: 'Clinical rotation request could not be accepted.',
    }, corsHeaders);
    return;
  }

  if (sanitizeText(rawPayload?.company_name, 120)) {
    const requestId = crypto.randomUUID();
    logSafeEvent('honeypot_success', { requestId });
    sendPublicJson(response, 200, {
      success: true,
      request_id: requestId,
    }, corsHeaders);
    return;
  }

  const validation = validateIntakePayload(rawPayload);
  if (!validation.ok) {
    sendPublicJson(response, 400, {
      error: 'validation_failed',
      message: 'Clinical rotation request is missing required information.',
    }, corsHeaders);
    return;
  }

  const requestId = crypto.randomUUID();
  const ipKey = getClientIp(request);
  if (!takeRateLimit(ipHits, ipKey, IP_LIMIT)) {
    logSafeEvent('rate_limited_ip', { requestId, ipHash: hashForLog(ipKey) });
    sendPublicJson(response, 429, {
      error: 'too_many_requests',
      message: 'Clinical rotation request intake is temporarily rate limited.',
    }, corsHeaders);
    return;
  }

  const emailKey = validation.data.email.toLowerCase();
  const idempotencyKey = normalizeIdempotencyKey(
    request.headers['x-mm-usce-idempotency-key'] || validation.data.idempotency_key,
    validation.data,
  );
  const priorRequestId = getIdempotentRequestId(idempotencyKey);
  if (priorRequestId) {
    sendPublicJson(response, 200, {
      success: true,
      request_id: priorRequestId,
    }, corsHeaders);
    return;
  }

  if (!takeRateLimit(emailHits, emailKey, EMAIL_LIMIT)) {
    logSafeEvent('email_throttled_success', { requestId, emailHash: hashForLog(emailKey) });
    rememberIdempotentRequest(idempotencyKey, requestId);
    sendPublicJson(response, 200, {
      success: true,
      request_id: requestId,
    }, corsHeaders);
    return;
  }

  const writeMode = envValueAny(WRITE_MODE_FLAGS, 'dry_run').trim().toLowerCase();
  if (writeMode === 'disabled') {
    logSafeEvent('write_mode_disabled', { requestId, emailHash: hashForLog(emailKey) });
    sendPublicJson(response, 503, {
      error: 'usce_public_intake_storage_disabled',
      message: 'Clinical rotation request intake storage is not accepting submissions right now.',
    }, corsHeaders);
    return;
  }

  if (writeMode === 'supabase' && !envFlagAny(SCHEMA_READY_FLAGS, false)) {
    logSafeEvent('schema_blocked', { requestId, emailHash: hashForLog(emailKey) });
    sendPublicJson(response, 503, {
      error: 'schema_requires_request_first_migration',
      message: 'Clinical rotation request intake needs a request-first schema update before live writes can be enabled.',
    }, corsHeaders);
    return;
  }

  if (writeMode === 'supabase') {
    const persistence = await persistSupabasePublicIntake({
      data: validation.data,
      request,
      requestId,
      idempotencyKey,
    });

    if (!persistence.ok) {
      logSafeEvent('supabase_write_failed', {
        requestId,
        reason: persistence.reason,
        emailHash: hashForLog(emailKey),
      });
      sendPublicJson(response, persistence.statusCode || 503, {
        error: persistence.publicError || 'usce_public_intake_storage_unavailable',
        message: 'Clinical rotation request could not be stored right now.',
      }, corsHeaders);
      return;
    }

    rememberIdempotentRequest(idempotencyKey, persistence.requestId);
    logSafeEvent('accepted_supabase', {
      requestId: persistence.requestId,
      emailHash: hashForLog(emailKey),
      notifyDryRun: envFlagAny(NOTIFY_DRY_RUN_FLAGS, true),
      recipientCount: RECIPIENTS.length,
    });

    sendPublicJson(response, persistence.wasExisting ? 200 : 202, {
      success: true,
      request_id: persistence.requestId,
      status: persistence.status || 'new',
      dry_run: false,
      notification_dry_run: envFlagAny(NOTIFY_DRY_RUN_FLAGS, true),
    }, corsHeaders);
    return;
  }

  if (writeMode !== 'dry_run') {
    logSafeEvent('write_mode_blocked', { requestId, writeMode });
    sendPublicJson(response, 503, {
      error: 'usce_public_intake_storage_not_ready',
      message: 'Clinical rotation request intake storage is not ready.',
    }, corsHeaders);
    return;
  }

  rememberIdempotentRequest(idempotencyKey, requestId);
  logSafeEvent('accepted_dry_run', {
    requestId,
    emailHash: hashForLog(emailKey),
    notifyDryRun: envFlagAny(NOTIFY_DRY_RUN_FLAGS, true),
    recipientCount: RECIPIENTS.length,
  });

  sendPublicJson(response, 202, {
    success: true,
    request_id: requestId,
    status: 'received_for_review',
    dry_run: true,
  }, corsHeaders);
}

function buildPublicConfig() {
  return {
    service: 'missionmed-usce-public-intake',
    version: 'CX-OFFER-309A',
    intake_enabled: envFlagAny(INTAKE_ENABLED_FLAGS, false),
    intake_enabled_flags: INTAKE_ENABLED_FLAGS,
    notify_dry_run: envFlagAny(NOTIFY_DRY_RUN_FLAGS, true),
    write_mode: envValueAny(WRITE_MODE_FLAGS, 'dry_run').trim().toLowerCase(),
    schema_ready: envFlagAny(SCHEMA_READY_FLAGS, false),
    storage_target: PUBLIC_INTAKE_TABLE,
    storage_adapter: `rpc:${PUBLIC_INTAKE_RPC}`,
    payment_required_before_review: false,
    endpoint: PUBLIC_INTAKE_PATH,
    required_fields: [
      'student_name',
      'email',
      'training_level_or_school',
      'preferred_specialties',
      'preferred_locations',
      'preferred_months_or_dates',
      'duration_weeks',
      'source_url',
      'consent',
    ],
  };
}

function validateIntakePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['payload_object_required'] };
  }

  const data = {
    student_name: sanitizeText(payload.student_name, 200),
    email: sanitizeEmail(payload.email),
    phone: sanitizeText(payload.phone, 40),
    training_level_or_school: sanitizeText(payload.training_level_or_school, 240),
    preferred_specialties: sanitizeStringArray(payload.preferred_specialties, 4, 80),
    preferred_locations: sanitizeStringArray(payload.preferred_locations, 4, 80),
    preferred_months_or_dates: sanitizeStringArray(payload.preferred_months_or_dates, 6, 40),
    duration_weeks: normalizeDurationWeeks(payload.duration_weeks),
    flexibility: sanitizeText(payload.flexibility, 500),
    notes: sanitizeText(payload.notes, 2000),
    source_url: sanitizeText(payload.source_url, 500),
    consent: payload.consent === true,
    idempotency_key: sanitizeText(payload.idempotency_key, 120),
    utm: sanitizeUtm(payload.utm),
  };

  const errors = [];
  if (data.student_name.length < 2) errors.push('student_name_required');
  if (!isValidEmail(data.email)) errors.push('valid_email_required');
  if (data.training_level_or_school.length < 2) errors.push('training_level_or_school_required');
  if (data.preferred_specialties.length < 1) errors.push('preferred_specialties_required');
  if (data.preferred_locations.length < 1) errors.push('preferred_locations_required');
  if (data.preferred_months_or_dates.length < 1) errors.push('preferred_months_or_dates_required');
  if (!Number.isInteger(data.duration_weeks) || data.duration_weeks < 1 || data.duration_weeks > 24) errors.push('duration_weeks_invalid');
  if (!data.source_url) errors.push('source_url_required');
  if (!data.consent) errors.push('consent_required');

  return errors.length ? { ok: false, errors } : { ok: true, data };
}

async function persistSupabasePublicIntake({ data, request, requestId, idempotencyKey }) {
  const config = getSupabasePublicIntakeConfig();
  if (!config.ok) {
    return {
      ok: false,
      reason: config.reason,
      statusCode: 503,
      publicError: 'usce_public_intake_storage_not_configured',
    };
  }

  const record = buildPublicIntakeRecord({ data, request, requestId, idempotencyKey });
  const rpcResult = await createSupabasePublicIntakeViaRpc(config, record);
  if (rpcResult.ok) {
    return {
      ok: true,
      requestId: rpcResult.row.id,
      status: rpcResult.row.status,
      wasExisting: rpcResult.wasExisting,
    };
  }

  return {
    ok: false,
    reason: rpcResult.reason || 'supabase_rpc_failed',
    statusCode: 503,
    publicError: 'usce_public_intake_storage_unavailable',
  };
}

function getSupabasePublicIntakeConfig() {
  const supabaseUrl = sanitizeSupabaseUrl(envValueAny(SUPABASE_URL_FLAGS, ''));
  const serviceKey = envValueAny(SUPABASE_SERVICE_KEY_FLAGS, '');

  if (!supabaseUrl) {
    return { ok: false, reason: 'supabase_url_missing' };
  }

  if (getSupabaseProjectRef(supabaseUrl) !== CANONICAL_SUPABASE_PROJECT_REF) {
    return { ok: false, reason: 'supabase_project_mismatch' };
  }

  if (!serviceKey) {
    return { ok: false, reason: 'supabase_service_key_missing' };
  }

  return { ok: true, supabaseUrl, serviceKey };
}

function buildPublicIntakeRecord({ data, request, requestId, idempotencyKey }) {
  return {
    id: requestId,
    status: 'new',
    student_name: data.student_name,
    email: data.email,
    phone: data.phone || null,
    training_level_or_school: data.training_level_or_school,
    preferred_specialties: data.preferred_specialties,
    preferred_locations: data.preferred_locations,
    preferred_months_or_dates: data.preferred_months_or_dates,
    duration_weeks: data.duration_weeks,
    flexibility: data.flexibility || null,
    notes: data.notes || null,
    consent: data.consent,
    source: 'r2_usce_request',
    source_url: data.source_url,
    user_agent: sanitizeText(request.headers['user-agent'], 500) || null,
    ip_hash: hashForLog(getClientIp(request)),
    idempotency_key: idempotencyKey,
    payment_product_url: CANONICAL_PAYMENT_PRODUCT_URL,
    learndash_course_url: CANONICAL_LEARNDASH_COURSE_URL,
    metadata: {
      source_version: 'CX-OFFER-310B',
      endpoint: PUBLIC_INTAKE_PATH,
      notify_dry_run: envFlagAny(NOTIFY_DRY_RUN_FLAGS, true),
      utm: data.utm,
      request_first: true,
      payment_required_before_review: false,
    },
  };
}

async function createSupabasePublicIntakeViaRpc(config, record) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${PUBLIC_INTAKE_RPC}`, {
    method: 'POST',
    headers: buildSupabaseHeaders(config.serviceKey, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ p_request: record }),
  });

  const payload = await readSupabaseJson(response);
  if (response.ok && payload?.id) {
    return {
      ok: true,
      row: {
        id: payload.id,
        status: payload.status || 'new',
      },
      wasExisting: Boolean(payload.was_existing),
    };
  }

  return {
    ok: false,
    reason: safeSupabaseErrorReason(payload),
  };
}

async function listSupabasePublicIntakeViaRpc(config, params) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${ADMIN_PUBLIC_INTAKE_LIST_RPC}`, {
    method: 'POST',
    headers: buildSupabaseHeaders(config.serviceKey, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      p_limit: params.limit,
      p_offset: params.offset,
      p_status: params.status || null,
      p_search: params.search || null,
    }),
  });

  const payload = await readSupabaseJson(response);
  if (response.ok && payload && typeof payload === 'object') {
    return { ok: true, payload };
  }

  return {
    ok: false,
    statusCode: response.status === 400 ? 400 : 503,
    reason: safeSupabaseErrorReason(payload),
  };
}

async function callSupabasePublicIntakeAdminRpc({ rpcName, body, action }) {
  const config = getSupabasePublicIntakeConfig();
  if (!config.ok) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'usce_public_intake_admin_storage_not_configured',
      message: 'USCE public intake admin write storage is not configured.',
      storage_target: PUBLIC_INTAKE_TABLE,
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
    if (payload.ok === false && payload.error === 'not_found') {
      return {
        ok: false,
        httpStatus: 404,
        error: 'usce_public_intake_request_not_found',
        message: 'USCE public intake request was not found.',
      };
    }

    if (payload.ok !== true || !payload.item || typeof payload.item !== 'object') {
      return {
        ok: false,
        httpStatus: 503,
        error: 'usce_public_intake_admin_write_failed',
        message: 'USCE public intake request update returned an invalid response.',
        storage_target: PUBLIC_INTAKE_TABLE,
        storage_adapter: `rpc:${rpcName}`,
      };
    }

    return {
      ok: true,
      mode: 'live',
      action,
      storage_target: PUBLIC_INTAKE_TABLE,
      storage_adapter: `rpc:${rpcName}`,
      item: {
        id: payload.item.id,
        status: payload.item.status || null,
        admin_notes: payload.item.admin_notes || null,
        updated_at: payload.item.updated_at || null,
      },
    };
  }

  return {
    ok: false,
    httpStatus: response.status === 400 ? 400 : 503,
    error: 'usce_public_intake_admin_write_failed',
    message: 'USCE public intake request could not be updated.',
    storage_target: PUBLIC_INTAKE_TABLE,
    storage_adapter: `rpc:${rpcName}`,
    reason: safeSupabaseErrorReason(payload),
  };
}

function normalizeAdminListParams(searchParams) {
  const rawLimit = Number(searchParams.get('limit') || 50);
  const rawOffset = Number(searchParams.get('offset') || 0);
  const status = sanitizeText(searchParams.get('status'), 40).toLowerCase();
  const search = sanitizeText(searchParams.get('search'), 120);

  return {
    limit: clampInteger(rawLimit, 1, ADMIN_LIST_MAX_LIMIT, 50),
    offset: clampInteger(rawOffset, 0, 10_000, 0),
    status: status || '',
    search: search || '',
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(String(value || '').trim());
}

function clampInteger(value, min, max, fallback) {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
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
    const hostname = new URL(supabaseUrl).hostname;
    return hostname.split('.')[0] || '';
  } catch {
    return '';
  }
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
  if (!text) {
    return {};
  }

  return JSON.parse(text);
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
  return sanitizeText(value, 254).toLowerCase();
}

function sanitizeStringArray(value, maxItems, maxLength) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const cleaned = [];

  for (const item of source) {
    const safe = sanitizeText(item, maxLength);
    const key = safe.toLowerCase();
    if (!safe || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(safe);
    if (cleaned.length >= maxItems) break;
  }

  return cleaned;
}

function sanitizeUtm(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const output = {};
  for (const key of ['source', 'medium', 'campaign', 'term', 'content']) {
    const safe = sanitizeText(value[key], 200);
    if (safe) output[key] = safe;
  }
  return output;
}

function normalizeDurationWeeks(value) {
  if (Number.isInteger(value)) return value;
  const match = String(value || '').match(/\d+/u);
  return match ? Number(match[0]) : NaN;
}

function isValidEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value);
}

function normalizeIdempotencyKey(value, data) {
  const safe = sanitizeText(value, 120);
  if (safe) return safe;

  return crypto
    .createHash('sha256')
    .update([
      data.email,
      data.student_name,
      data.preferred_specialties.join('|'),
      data.preferred_locations.join('|'),
      data.preferred_months_or_dates.join('|'),
    ].join('::'))
    .digest('hex');
}

function takeRateLimit(store, key, limit, now = Date.now()) {
  pruneRateStore(store, now);
  const current = (store.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (current.length >= limit) {
    store.set(key, current);
    return false;
  }
  current.push(now);
  store.set(key, current);
  return true;
}

function pruneRateStore(store, now = Date.now()) {
  if (store.size < 1000) return;
  for (const [key, values] of store.entries()) {
    const active = values.filter((ts) => now - ts < RATE_WINDOW_MS);
    if (active.length) store.set(key, active);
    else store.delete(key);
  }
}

function getIdempotentRequestId(key, now = Date.now()) {
  const record = idempotencyHits.get(key);
  if (!record || now - record.createdAt > RATE_WINDOW_MS) {
    idempotencyHits.delete(key);
    return '';
  }
  return record.requestId;
}

function rememberIdempotentRequest(key, requestId) {
  idempotencyHits.set(key, { requestId, createdAt: Date.now() });
}

function buildPublicCorsHeaders(request = null) {
  const origin = String(request?.headers?.origin || '').trim();
  const allowedOrigin = isAllowedOriginValue(origin) ? origin : 'https://missionmedinstitute.com';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, X-MM-USCE-Idempotency-Key',
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

function sendPublicMethodNotAllowed(response, methods, extraHeaders = {}) {
  sendPublicJson(response, 405, {
    error: 'method_not_allowed',
    message: `Allowed methods: ${methods.join(', ')}`,
  }, {
    ...extraHeaders,
    Allow: methods.join(', '),
  });
}

function sendPublicJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload, null, 2));
}

function envFlagAny(names, fallback = false) {
  const raw = envValueAny(names, '');
  if (!raw) return Boolean(fallback);
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function envValueAny(names, fallback = '') {
  for (const name of names) {
    const raw = String(process.env[name] || '').trim();
    if (raw) return raw;
  }
  return String(fallback);
}

function normalizePathname(pathname) {
  const value = String(pathname || '/').replace(/\/+$/u, '');
  return value || '/';
}

function getClientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const realIp = String(request.headers['x-real-ip'] || '').trim();
  return forwarded || realIp || request.socket?.remoteAddress || 'unknown';
}

function hashForLog(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
}

function logSafeEvent(event, details = {}) {
  console.log('[USCE_PUBLIC_INTAKE]', event, JSON.stringify(details));
}
