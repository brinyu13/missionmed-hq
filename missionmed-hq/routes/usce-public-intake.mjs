import crypto from 'node:crypto';

const PUBLIC_INTAKE_PATH = '/api/usce/public/requests';
const PUBLIC_CONFIG_PATH = '/api/usce/public/config';
const ADMIN_PUBLIC_INTAKE_LIST_PATH = '/api/usce/admin/public-intake-requests';
const ADMIN_PUBLIC_INTAKE_CONTROLLED_TEST_PATH = `${ADMIN_PUBLIC_INTAKE_LIST_PATH}/controlled-test`;
const ADMIN_PUBLIC_INTAKE_ACTION_PREFIX = `${ADMIN_PUBLIC_INTAKE_LIST_PATH}/`;
const MAX_BODY_BYTES = 16 * 1024;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const IP_LIMIT = 3;
const EMAIL_LIMIT = 1;
const ADMIN_LIST_MAX_LIMIT = 100;
const ADMIN_NOTE_MAX_LENGTH = 4000;
const ADMIN_NOTIFICATION_RECIPIENTS = [
  'info@missionmedinstitute.com',
  'clinicals@missionmedinstitute.com',
  'Philperri@gmail.com',
];
const POSTMARK_TOKEN_FLAGS = ['POSTMARK_SERVER_TOKEN', 'USCE_POSTMARK_SERVER_TOKEN', 'MMHQ_POSTMARK_SERVER_TOKEN'];
const POSTMARK_FROM_FLAGS = ['USCE_POSTMARK_FROM_EMAIL', 'POSTMARK_FROM_EMAIL', 'MMHQ_POSTMARK_FROM_EMAIL'];
const POSTMARK_REPLY_TO_FLAGS = ['USCE_POSTMARK_REPLY_TO_EMAIL', 'POSTMARK_REPLY_TO_EMAIL', 'MMHQ_POSTMARK_REPLY_TO_EMAIL'];
const NOTIFICATION_FORCE_DRY_RUN_FLAGS = ['USCE_EMAIL_FORCE_DRY_RUN', 'MM_USCE_EMAIL_FORCE_DRY_RUN'];
const POSTMARK_API_URL = 'https://api.postmarkapp.com/email';
const DEFAULT_POSTMARK_FROM = 'clinicals@missionmedinstitute.com';
const DEFAULT_POSTMARK_REPLY_TO = 'clinicals@missionmedinstitute.com';
const POSTMARK_MAX_ATTEMPTS = 3;
const POSTMARK_RETRY_BASE_MS = 400;
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
const CANONICAL_TRACKER_URL = 'https://cdn.missionmedinstitute.com/html-system/LIVE/usce_status_tracker.html';
const CANONICAL_ADMIN_URL = 'https://cdn.missionmedinstitute.com/html-system/LIVE/usce_admin.html';
const CANONICAL_ACCOUNT_URL = 'https://missionmedinstitute.com/my-account/';
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

export function isUsceAdminPublicIntakeControlledTestPath(pathname) {
  return normalizePathname(pathname) === ADMIN_PUBLIC_INTAKE_CONTROLLED_TEST_PATH;
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
    const notification = await sendPublicIntakeNotifications({
      requestId: persistence.requestId,
      data: validation.data,
      request,
      status: persistence.status || 'new',
      wasExisting: persistence.wasExisting,
    });

    logSafeEvent('accepted_supabase', {
      requestId: persistence.requestId,
      emailHash: hashForLog(emailKey),
      notificationStatus: notification.status,
      notificationDryRun: notification.dryRun,
      adminRecipientCount: ADMIN_NOTIFICATION_RECIPIENTS.length,
    });

    sendPublicJson(response, persistence.wasExisting ? 200 : 202, {
      success: true,
      request_id: persistence.requestId,
      status: persistence.status || 'new',
      dry_run: false,
      notification_dry_run: notification.dryRun,
      notification_status: notification.status,
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
    notificationDryRun: true,
    adminRecipientCount: ADMIN_NOTIFICATION_RECIPIENTS.length,
  });

  sendPublicJson(response, 202, {
    success: true,
    request_id: requestId,
    status: 'received_for_review',
    dry_run: true,
  }, corsHeaders);
}

function buildPublicConfig() {
  const notificationConfig = buildPublicNotificationConfig();
  return {
    service: 'missionmed-usce-public-intake',
    version: 'CX-OFFER-338-TRACKER-EMAILS',
    intake_enabled: envFlagAny(INTAKE_ENABLED_FLAGS, false),
    intake_enabled_flags: INTAKE_ENABLED_FLAGS,
    notify_dry_run: notificationConfig.dry_run,
    write_mode: envValueAny(WRITE_MODE_FLAGS, 'dry_run').trim().toLowerCase(),
    schema_ready: envFlagAny(SCHEMA_READY_FLAGS, false),
    storage_target: PUBLIC_INTAKE_TABLE,
    storage_adapter: `rpc:${PUBLIC_INTAKE_RPC}`,
    notifications: notificationConfig,
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

async function sendPublicIntakeNotifications({ requestId, data, request, status, wasExisting }) {
  const config = getPostmarkNotificationConfig();
  if (!config.ok || config.dryRun) {
    return {
      ok: config.ok,
      status: config.ok ? 'dry_run' : 'not_configured',
      dryRun: true,
      reason: config.reason || null,
    };
  }

  const adminMessage = buildAdminRequestNotification({ requestId, data, request, status, wasExisting });
  const studentMessage = buildStudentRequestAcknowledgement({ requestId, data, status });
  const adminJobs = ADMIN_NOTIFICATION_RECIPIENTS.map((recipient) => (
    sendPostmarkEmailWithRetry({
      ...config,
      to: recipient,
      subject: adminMessage.subject,
      textBody: adminMessage.textBody,
      htmlBody: adminMessage.htmlBody,
      tag: 'usce-request-admin',
      metadata: {
        usce_request_id: requestId,
        notification_type: 'admin_request_received',
        recipient_hash: hashForLog(recipient.toLowerCase()),
      },
    })
  ));
  const results = await Promise.allSettled([
    ...adminJobs,
    sendPostmarkEmailWithRetry({
      ...config,
      to: data.email,
      subject: studentMessage.subject,
      textBody: studentMessage.textBody,
      htmlBody: studentMessage.htmlBody,
      tag: 'usce-request-student',
      metadata: { usce_request_id: requestId, notification_type: 'student_request_received' },
    }),
  ]);

  const settled = results.map((result) => result.status === 'fulfilled' ? result.value : {
    ok: false,
    reason: 'postmark_request_rejected',
  });
  const failed = settled.filter((item) => !item.ok);

  return {
    ok: failed.length === 0,
    status: failed.length ? 'partial_or_failed' : 'sent',
    dryRun: false,
    sent: settled.filter((item) => item.ok).length,
    failed: failed.length,
    reason: failed[0]?.reason || null,
  };
}

function buildPublicNotificationConfig() {
  const config = getPostmarkNotificationConfig();
  return {
    provider: 'postmark',
    live_send_enabled: Boolean(config.ok && !config.dryRun),
    dry_run: Boolean(config.dryRun),
    legacy_notify_dry_run_flag: Boolean(config.legacyNotifyDryRun),
    admin_recipient_count: ADMIN_NOTIFICATION_RECIPIENTS.length,
    from_email: config.fromEmail || DEFAULT_POSTMARK_FROM,
    reason: config.reason || null,
  };
}

function getPostmarkNotificationConfig() {
  const token = envValueAny(POSTMARK_TOKEN_FLAGS, '');
  const legacyNotifyDryRun = envFlagAny(NOTIFY_DRY_RUN_FLAGS, false);
  const forceDryRun = envFlagAny(NOTIFICATION_FORCE_DRY_RUN_FLAGS, false);
  const fromEmail = sanitizeEmail(envValueAny(POSTMARK_FROM_FLAGS, DEFAULT_POSTMARK_FROM)) || DEFAULT_POSTMARK_FROM;
  const replyTo = sanitizeEmail(envValueAny(POSTMARK_REPLY_TO_FLAGS, DEFAULT_POSTMARK_REPLY_TO)) || DEFAULT_POSTMARK_REPLY_TO;

  if (!token) {
    return {
      ok: false,
      dryRun: true,
      reason: 'postmark_token_missing',
      legacyNotifyDryRun,
      fromEmail,
      replyTo,
    };
  }

  if (forceDryRun) {
    return {
      ok: true,
      dryRun: true,
      reason: 'notification_force_dry_run_enabled',
      legacyNotifyDryRun,
      token,
      fromEmail,
      replyTo,
    };
  }

  return {
    ok: true,
    dryRun: false,
    legacyNotifyDryRun,
    token,
    fromEmail,
    replyTo,
  };
}

function buildAdminRequestNotification({ requestId, data, request, status, wasExisting }) {
  const subject = `New MissionMed USCE request: ${data.student_name}`;
  const trackerUrl = buildTrackerUrl(requestId, true);
  const rows = [
    ['Reference', requestId],
    ['Status', status || 'new'],
    ['Student', data.student_name],
    ['Email', data.email],
    ['Phone', data.phone || 'Not provided'],
    ['Training / school', data.training_level_or_school],
    ['Specialties', data.preferred_specialties.join(', ')],
    ['Locations', data.preferred_locations.join(', ')],
    ['Months / dates', data.preferred_months_or_dates.join(', ')],
    ['Duration', `${data.duration_weeks} week${data.duration_weeks === 1 ? '' : 's'}`],
    ['Flexibility', data.flexibility || 'None listed'],
    ['Notes', data.notes || 'None listed'],
    ['Source', data.source_url],
    ['Submission type', wasExisting ? 'Duplicate/idempotent replay' : 'New stored request'],
    ['IP hash', hashForLog(getClientIp(request))],
  ];
  return buildTrackerEmailMessage({
    subject,
    preheader: 'A new Clinicals request is ready for coordinator review.',
    eyebrow: 'Admin notification',
    heading: 'New USCE request received',
    intro: 'A student submitted the MissionMed Clinicals request form. Review the request, confirm availability, and send a tracker-backed offer when ready.',
    statusLabel: 'Request received',
    statusText: 'Waiting for coordinator review',
    activeIndex: 0,
    studentName: data.student_name,
    requestId,
    rows,
    buttons: [
      { label: 'Open admin queue', url: CANONICAL_ADMIN_URL, primary: true },
      { label: 'View tracker', url: trackerUrl, primary: false },
      { label: 'Email student', url: `mailto:${data.email}`, primary: false },
    ],
    footer: 'Review the request in the USCE admin queue before sending an offer.',
  });
}

function buildStudentRequestAcknowledgement({ requestId, data, status }) {
  const trackerUrl = buildTrackerUrl(requestId, true);
  return buildTrackerEmailMessage({
    subject: 'We received your MissionMed Clinicals request',
    preheader: 'Your request tracker is ready. MissionMed Clinicals will review your preferences next.',
    eyebrow: 'Request tracker started',
    heading: 'Your request is now being tracked',
    intro: `Hi ${data.student_name}, we received your USCE rotation request. Your tracker starts at Request received, then moves through review, availability, offer, and secured status as the Clinicals team updates your file.`,
    statusLabel: 'Request received',
    statusText: 'Waiting for coordinator review',
    activeIndex: 0,
    studentName: data.student_name,
    requestId,
    rows: [
      ['Reference', requestId],
      ['Current status', status || 'new'],
      ['Specialties', formatList(data.preferred_specialties)],
      ['Locations', formatList(data.preferred_locations)],
      ['Months / dates', formatList(data.preferred_months_or_dates)],
      ['Duration', `${data.duration_weeks} week${data.duration_weeks === 1 ? '' : 's'}`],
    ],
    buttons: [
      { label: 'Open my tracker', url: trackerUrl, primary: true },
      { label: 'Create / sign in', url: buildAccountUrl(trackerUrl), primary: false },
      { label: 'Contact Clinicals', url: 'mailto:clinicals@missionmedinstitute.com', primary: false },
    ],
    footer: 'A MissionMed Clinicals coordinator will email you when availability is confirmed or if we need a better-fit option.',
  });
}

function buildTrackerEmailMessage({
  subject,
  preheader,
  eyebrow,
  heading,
  intro,
  statusLabel,
  statusText,
  activeIndex,
  studentName,
  requestId,
  rows,
  buttons,
  footer,
}) {
  const stages = ['Received', 'Review', 'Available', 'Offer', 'Secured'];
  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join('\n');
  const textButtons = buttons.map((button) => `${button.label}: ${button.url}`).join('\n');
  const htmlRows = rows.map(([label, value]) => (
    `<tr><th align="left" style="padding:11px 14px;border-bottom:1px solid #d7dee8;color:#5e6b7c;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(label)}</th><td style="padding:11px 14px;border-bottom:1px solid #d7dee8;color:#08233d;font-size:14px;font-weight:700;">${escapeHtml(value)}</td></tr>`
  )).join('');
  const stageCells = stages.map((stage, index) => {
    const done = index < activeIndex;
    const active = index === activeIndex;
    const background = done ? '#1f9d62' : active ? '#ff7f35' : '#7b8b99';
    const color = done || active ? '#ffffff' : '#dce5ec';
    return `<td style="width:20%;padding:0 3px;"><div style="background:${background};color:${color};border-radius:8px;padding:13px 7px;text-align:center;font-size:12px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;">${escapeHtml(stage)}</div></td>`;
  }).join('');
  const htmlButtons = buttons.map((button) => {
    const background = button.primary ? '#f4c84d' : '#ffffff';
    const border = button.primary ? '#f4c84d' : '#d7dee8';
    const color = '#08233d';
    return `<a href="${escapeHtml(button.url)}" style="display:inline-block;margin:0 8px 10px 0;padding:13px 18px;border-radius:999px;background:${background};border:1px solid ${border};color:${color};font-size:12px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;text-decoration:none;">${escapeHtml(button.label)}</a>`;
  }).join('');
  const trackerUrl = buildTrackerUrl(requestId, true);
  const textBody = `${heading}\n\n${intro}\n\nCurrent status: ${statusLabel} - ${statusText}\nTracker: ${trackerUrl}\n\n${textRows}\n\nActions\n${textButtons}\n\n${footer}\n\nMissionMed Clinicals`;
  const htmlBody = [
    '<!doctype html><html><body style="margin:0;padding:0;background:#071627;">',
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader || '')}</div>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#071627;padding:26px 12px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;"><tr><td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;border-collapse:collapse;">',
    '<tr><td style="padding:18px 20px;background:#051524;border:1px solid #244760;border-bottom:0;border-radius:16px 16px 0 0;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td>',
    '<div style="display:inline-block;width:42px;height:42px;border-radius:50%;background:#f4c84d;color:#08233d;text-align:center;line-height:42px;font-family:Georgia,serif;font-weight:900;">MM</div>',
    '</td><td align="right" style="color:#f4d36a;font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;">MissionMed Clinicals</td></tr></table>',
    '</td></tr>',
    '<tr><td style="padding:28px 24px;background:linear-gradient(180deg,#0b4770,#0a5687);border-left:1px solid #244760;border-right:1px solid #244760;">',
    `<div style="display:inline-block;border:1px solid rgba(255,255,255,.32);border-radius:999px;padding:7px 12px;color:#f4d36a;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;">${escapeHtml(eyebrow || 'USCE tracker')}</div>`,
    `<h1 style="margin:18px 0 10px;color:#ffffff;font-family:Georgia,serif;font-size:38px;line-height:1.05;font-weight:700;">${escapeHtml(heading)}</h1>`,
    `<p style="margin:0;color:#d9e7f1;font-size:15px;line-height:1.65;">${escapeHtml(intro)}</p>`,
    '</td></tr>',
    '<tr><td style="padding:18px;background:#0b78a8;border-left:1px solid #244760;border-right:1px solid #244760;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>',
    '<td style="color:#ffffff;font-size:26px;line-height:1;font-weight:900;text-transform:uppercase;">USCE<br><span style="color:#f4d36a;">Tracker</span></td>',
    `<td align="right" style="color:#d9e7f1;font-size:13px;line-height:1.5;">Active now: <b style="color:#ffffff;">${escapeHtml(statusLabel)}</b><br>${escapeHtml(statusText)}</td>`,
    '</tr></table>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;"><tr>',
    stageCells,
    '</tr></table>',
    `<div style="margin-top:16px;text-align:center;color:#ffffff;font-size:17px;line-height:1.35;font-weight:900;text-transform:uppercase;">${escapeHtml(statusLabel)} <span style="color:#f4d36a;">- ${escapeHtml(statusText)}</span></div>`,
    '</td></tr>',
    '<tr><td style="padding:0;background:#fffaf0;border-left:1px solid #244760;border-right:1px solid #244760;color:#08233d;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">',
    `<tr><td style="padding:18px 20px;border-bottom:1px solid #d7dee8;"><b style="display:block;color:#08233d;font-size:16px;">${escapeHtml(studentName || 'MissionMed student')}</b><span style="color:#5e6b7c;font-size:12px;">Reference ${escapeHtml(requestId || 'pending')}</span></td></tr>`,
    htmlRows,
    '</table>',
    '</td></tr>',
    '<tr><td style="padding:20px 22px;background:#ffffff;border-left:1px solid #244760;border-right:1px solid #244760;color:#08233d;">',
    htmlButtons,
    `<p style="margin:10px 0 0;color:#5e6b7c;font-size:13px;line-height:1.6;">${escapeHtml(footer)}</p>`,
    '</td></tr>',
    '<tr><td style="padding:18px 22px;background:#051524;border:1px solid #244760;border-top:0;border-radius:0 0 16px 16px;color:#9fb0bf;font-size:12px;line-height:1.6;">MissionMed Clinicals<br>This email does not create a payment or enrollment. Payment appears only after an accepted offer.</td></tr>',
    '</table>',
    '</td></tr></table>',
    '</body></html>',
  ].join('');

  return { subject, textBody, htmlBody };
}

function buildTrackerUrl(requestId, submitted) {
  const url = new URL(CANONICAL_TRACKER_URL);
  if (submitted) url.searchParams.set('request_submitted', '1');
  if (requestId) url.searchParams.set('ref', String(requestId).slice(0, 80));
  return url.toString();
}

function buildAccountUrl(target) {
  const url = new URL(CANONICAL_ACCOUNT_URL);
  url.searchParams.set('redirect_to', target || CANONICAL_TRACKER_URL);
  return url.toString();
}

function formatList(values) {
  if (!Array.isArray(values) || !values.length) return 'Not provided';
  return values.filter(Boolean).join(', ');
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

async function sendPostmarkEmail({ token, fromEmail, replyTo, to, subject, textBody, htmlBody, tag, metadata }) {
  if (!token) {
    return { ok: false, reason: 'postmark_token_missing', retryable: false };
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
        From: fromEmail,
        To: to,
        ReplyTo: replyTo,
        Subject: subject,
        TextBody: textBody,
        HtmlBody: htmlBody,
        MessageStream: 'outbound',
        Tag: tag,
        Metadata: metadata || {},
      }),
    });
  } catch {
    return { ok: false, reason: 'postmark_network_error', retryable: true };
  }

  const payload = await readSupabaseJson(response);
  if (!response.ok) {
    return {
      ok: false,
      reason: sanitizeText(payload?.ErrorCode || payload?.Message || response.status, 160),
      retryable: response.status === 429 || response.status >= 500,
      statusCode: response.status,
    };
  }

  return {
    ok: true,
    messageId: sanitizeText(payload?.MessageID || payload?.MessageId || '', 180),
    retryable: false,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createUscePublicIntakeAdminControlledTest(request, payload = {}) {
  if (!isControlledAdminTestPayload(payload)) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'controlled_test_payload_required',
      message: 'Controlled intake test rows require an explicit safe test payload.',
    };
  }

  const validation = validateIntakePayload(payload);
  if (!validation.ok) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'validation_failed',
      message: 'Controlled intake test row is missing required information.',
      details: validation.errors,
    };
  }

  const requestId = crypto.randomUUID();
  const idempotencyKey = normalizeIdempotencyKey(
    payload.idempotency_key || `admin-controlled-test:${requestId}`,
    validation.data,
  );
  const persistence = await persistSupabasePublicIntake({
    data: validation.data,
    request,
    requestId,
    idempotencyKey,
  });

  if (!persistence.ok) {
    return {
      ok: false,
      httpStatus: persistence.statusCode || 503,
      error: persistence.publicError || 'usce_public_intake_storage_unavailable',
      message: 'Controlled intake test row could not be stored right now.',
      reason: persistence.reason,
      storage_target: PUBLIC_INTAKE_TABLE,
      storage_adapter: `rpc:${PUBLIC_INTAKE_RPC}`,
    };
  }

  logSafeEvent('admin_controlled_test_intake_created', {
    requestId: persistence.requestId,
    emailHash: hashForLog(validation.data.email.toLowerCase()),
  });

  return {
    ok: true,
    httpStatus: persistence.wasExisting ? 200 : 201,
    request_id: persistence.requestId,
    status: persistence.status || 'new',
    dry_run: false,
    controlled_test: true,
    storage_target: PUBLIC_INTAKE_TABLE,
    storage_adapter: `rpc:${PUBLIC_INTAKE_RPC}`,
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

function isControlledAdminTestPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }

  const email = sanitizeEmail(payload.email).toLowerCase();
  const notes = sanitizeText(payload.notes, 2000).toUpperCase();
  return payload.controlled_test === true
    && email.startsWith('test+cx')
    && email.endsWith('@missionmedinstitute.com')
    && notes.includes('SAFE CONTROLLED TEST ROW');
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
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
