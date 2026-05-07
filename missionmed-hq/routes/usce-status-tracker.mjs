const STUDENT_STATUS_PATH = '/api/usce/student/status';
const CANONICAL_SUPABASE_PROJECT_REF = 'fglyvdykwgbuivikqoah';
const TRACKER_URL = 'https://cdn.missionmedinstitute.com/html-system/LIVE/usce_status_tracker.html';
const OFFER_PAGE_URL = 'https://cdn.missionmedinstitute.com/html-system/LIVE/usce_offer.html';
const PAYMENT_PRODUCT_URL = 'https://missionmedinstitute.com/product/usce-clinical-rotations/';
const LEARNDASH_COURSE_URL = 'https://missionmedinstitute.com/courses/mmi-clinicals/';
const SUPABASE_URL_FLAGS = ['MMHQ_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_SERVER_KEY_FLAGS = [
  'MMHQ_SUPABASE_' + 'SERVICE' + '_ROLE_KEY',
  'SUPABASE_' + 'SERVICE' + '_ROLE_KEY',
  'MMHQ_SUPABASE_KEY',
];
const INTAKE_TABLE = 'usce_public_intake_requests';
const OFFER_TABLE = 'usce_offer_drafts';
const COMMS_TABLE = 'usce_comms';
const ADMIN_LIST_RPC = 'list_usce_public_intake_requests';

export function isUsceStudentStatusPath(pathname) {
  return normalizePathname(pathname) === STUDENT_STATUS_PATH;
}

export async function handleUsceStudentStatusRoute(request, response, url, context = {}) {
  const authHeaders = context.authHeaders || {};

  if (!isUsceStudentStatusPath(url.pathname)) {
    return false;
  }

  if (request.method !== 'GET') {
    sendMethodNotAllowed(response, ['GET', 'OPTIONS'], authHeaders);
    return true;
  }

  const session = context.session || null;
  if (!session) {
    sendJson(response, 401, {
      ok: false,
      authenticated: false,
      error: 'authentication_required',
      message: 'Log in with the MissionMed account that uses the same email as your USCE request.',
      tracker_url: TRACKER_URL,
      login: context.login || {},
    }, authHeaders);
    return true;
  }

  const studentEmail = sanitizeEmail(session?.user?.email);
  if (!studentEmail) {
    sendJson(response, 403, {
      ok: false,
      authenticated: true,
      error: 'student_email_required',
      message: 'Your MissionMed account needs an email address before USCE request status can load.',
      tracker_url: TRACKER_URL,
    }, authHeaders);
    return true;
  }

  sendRoutePayload(response, await getStudentStatus(studentEmail), authHeaders);
  return true;
}

async function getStudentStatus(studentEmail) {
  const config = getSupabaseConfig();
  if (!config.ok) {
    return {
      ok: false,
      authenticated: true,
      httpStatus: 503,
      error: 'usce_student_status_storage_not_configured',
      message: 'USCE request status storage is not configured.',
      reason: config.reason,
      tracker_url: TRACKER_URL,
    };
  }

  const intakeResult = await fetchIntakeRequestsByEmail(config, studentEmail);
  if (!intakeResult.ok) {
    return {
      ok: false,
      authenticated: true,
      httpStatus: intakeResult.httpStatus || 503,
      error: 'usce_student_status_read_failed',
      message: 'USCE request status could not be loaded.',
      reason: intakeResult.reason || 'intake_read_failed',
      tracker_url: TRACKER_URL,
    };
  }

  const requests = intakeResult.items;
  const requestIds = requests.map((item) => item.id).filter(Boolean);
  const offerResult = await fetchOffersForRequests(config, requestIds);
  const commsResult = await fetchCommsForRequests(config, requestIds);
  const offersByRequest = groupLatestBy(offerResult.ok ? offerResult.items : [], 'intake_request_id', 'updated_at');
  const commsByRequest = groupBy(commsResult.ok ? commsResult.items : [], 'intake_request_id');

  const trackerItems = requests.map((requestItem) => {
    const offer = offersByRequest.get(requestItem.id) || null;
    return buildTrackerItem(requestItem, offer, commsByRequest.get(requestItem.id) || []);
  });

  return {
    ok: true,
    authenticated: true,
    mode: 'live',
    tracker_url: TRACKER_URL,
    student: {
      email_masked: maskEmail(studentEmail),
    },
    current: trackerItems[0] || null,
    items: trackerItems,
    empty_state: trackerItems.length
      ? null
      : {
          headline: 'No USCE request is linked to this account yet.',
          next_step: 'Use the same email for your MissionMed account and USCE request, or contact the Clinicals team if this looks wrong.',
        },
    diagnostics: {
      intake_adapter: intakeResult.adapter,
      offer_adapter: offerResult.ok ? offerResult.adapter : 'unavailable',
      comms_adapter: commsResult.ok ? commsResult.adapter : 'unavailable',
      offer_status_reason: offerResult.ok ? 'loaded' : safeReason(offerResult.reason),
      comms_status_reason: commsResult.ok ? 'loaded' : safeReason(commsResult.reason),
    },
  };
}

async function fetchIntakeRequestsByEmail(config, studentEmail) {
  const direct = await fetchTableRows(config, INTAKE_TABLE, {
    select: [
      'id',
      'created_at',
      'updated_at',
      'status',
      'student_name',
      'email',
      'training_level_or_school',
      'preferred_specialties',
      'preferred_locations',
      'preferred_months_or_dates',
      'duration_weeks',
      'payment_product_url',
      'learndash_course_url',
    ].join(','),
    email: `eq.${studentEmail}`,
    order: 'created_at.desc',
    limit: '25',
  });

  if (direct.ok) {
    return {
      ok: true,
      adapter: `rest:${INTAKE_TABLE}`,
      items: direct.items.map(sanitizeIntakeRequest).filter(Boolean),
    };
  }

  const rpc = await postRpc(config, ADMIN_LIST_RPC, {
    p_limit: 100,
    p_offset: 0,
    p_status: null,
    p_search: studentEmail,
  });

  if (!rpc.ok) {
    return {
      ok: false,
      httpStatus: rpc.httpStatus || direct.httpStatus || 503,
      reason: rpc.reason || direct.reason || 'intake_rpc_failed',
    };
  }

  const rows = Array.isArray(rpc.payload?.items) ? rpc.payload.items : [];
  return {
    ok: true,
    adapter: `rpc:${ADMIN_LIST_RPC}`,
    items: rows
      .filter((row) => sanitizeEmail(row?.email) === studentEmail)
      .map(sanitizeIntakeRequest)
      .filter(Boolean),
  };
}

async function fetchOffersForRequests(config, requestIds) {
  if (!requestIds.length) {
    return { ok: true, adapter: `rest:${OFFER_TABLE}`, items: [] };
  }

  const result = await fetchTableRows(config, OFFER_TABLE, {
    select: [
      'id',
      'intake_request_id',
      'created_at',
      'updated_at',
      'status',
      'specialty',
      'location',
      'timing',
      'duration_weeks',
      'format',
      'expires_at',
      'payment_url',
      'offer_token_expires_at',
      'accepted_at',
      'declined_at',
      'alternate_requested_at',
      'postmark_status',
      'message_previewed_at',
      'message_sent_at',
      'payment_status',
      'payment_checked_at',
      'paperwork_status',
      'paperwork_updated_at',
      'learndash_status',
      'learndash_updated_at',
    ].join(','),
    intake_request_id: `in.(${requestIds.join(',')})`,
    order: 'updated_at.desc',
    limit: '100',
  });

  if (!result.ok) {
    return {
      ok: false,
      adapter: `rest:${OFFER_TABLE}`,
      reason: result.reason,
      httpStatus: result.httpStatus || 503,
      items: [],
    };
  }

  return {
    ok: true,
    adapter: `rest:${OFFER_TABLE}`,
    items: result.items.map(sanitizeOffer).filter(Boolean),
  };
}

async function fetchCommsForRequests(config, requestIds) {
  if (!requestIds.length) {
    return { ok: true, adapter: `rest:${COMMS_TABLE}`, items: [] };
  }

  const result = await fetchTableRows(config, COMMS_TABLE, {
    select: [
      'id',
      'created_at',
      'intake_request_id',
      'direction',
      'message_status',
      'postmark_message_id',
      'raw_json',
    ].join(','),
    intake_request_id: `in.(${requestIds.join(',')})`,
    order: 'created_at.desc',
    limit: '100',
  });

  if (!result.ok) {
    return {
      ok: false,
      adapter: `rest:${COMMS_TABLE}`,
      reason: result.reason,
      httpStatus: result.httpStatus || 503,
      items: [],
    };
  }

  return {
    ok: true,
    adapter: `rest:${COMMS_TABLE}`,
    items: result.items.map(sanitizeCommsEvent).filter(Boolean),
  };
}

function buildTrackerItem(requestItem, offer, commsEvents) {
  const stage = computeStage(requestItem, offer);
  const reference = 'USCE-' + String(requestItem.id || '').replace(/-/gu, '').slice(0, 8).toUpperCase();
  const accepted = Boolean(offer?.accepted_at || offer?.status === 'accepted');
  const declined = Boolean(offer?.declined_at || offer?.status === 'declined');
  const alternateRequested = Boolean(offer?.alternate_requested_at || offer?.status === 'alternate_requested');
  const safePaymentUrl = accepted ? (offer?.payment_url || requestItem.payment_product_url || PAYMENT_PRODUCT_URL) : null;

  return {
    request: {
      id: requestItem.id,
      reference,
      submitted_at: requestItem.created_at || null,
      updated_at: maxTimestamp([requestItem.updated_at, offer?.updated_at]),
      status: requestItem.status || 'new',
      student_name: requestItem.student_name || 'MissionMed student',
      training_level_or_school: requestItem.training_level_or_school || null,
      preferred_specialties: requestItem.preferred_specialties || [],
      preferred_locations: requestItem.preferred_locations || [],
      preferred_months_or_dates: requestItem.preferred_months_or_dates || [],
      duration_weeks: requestItem.duration_weeks || null,
    },
    offer: offer
      ? {
          id: offer.id,
          status: offer.status || 'draft',
          specialty: offer.specialty || null,
          location: offer.location || null,
          timing: offer.timing || null,
          duration_weeks: offer.duration_weeks || null,
          format: offer.format || 'In-person clinical exposure',
          expires_at: offer.expires_at || offer.offer_token_expires_at || null,
          offer_link_available: false,
          offer_link_note: offer.offer_token_expires_at
            ? 'Your secure offer link is shared by the Clinicals team and is not exposed from the tracker.'
            : 'Your secure offer link will appear after Clinicals prepares and shares the offer.',
        }
      : null,
    tracker: {
      current_stage_key: stage.key,
      current_stage_index: stage.index,
      current_stage_label: stage.label,
      next_step: stage.nextStep,
      waiting_on: stage.waitingOn,
      stages: stage.stages,
    },
    decision: {
      status: accepted ? 'accepted' : declined ? 'declined' : alternateRequested ? 'alternate_requested' : 'pending',
      accepted_at: offer?.accepted_at || null,
      declined_at: offer?.declined_at || null,
      alternate_requested_at: offer?.alternate_requested_at || null,
    },
    payment: {
      status: offer?.payment_status || 'pending',
      handoff_url: safePaymentUrl,
      payment_cta_available: Boolean(safePaymentUrl),
      checked_at: offer?.payment_checked_at || null,
    },
    paperwork: {
      status: offer?.paperwork_status || 'not_started',
      updated_at: offer?.paperwork_updated_at || null,
    },
    course_access: {
      status: offer?.learndash_status || 'locked',
      course_url: LEARNDASH_COURSE_URL,
      updated_at: offer?.learndash_updated_at || null,
    },
    communication: buildCommunicationSummary(offer, commsEvents),
    actions: buildStudentActions(stage, offer, safePaymentUrl),
  };
}

function computeStage(requestItem, offer) {
  const keys = [
    ['request_submitted', 'Request submitted', 'We received your request.'],
    ['under_review', 'Under review', 'A Clinicals coordinator is reviewing your preferences.'],
    ['options_preparing', 'Options being prepared', 'We are matching your timing and specialty preferences.'],
    ['offer_ready', 'Offer ready', 'A secure offer is ready or being shared.'],
    ['student_decision', 'Student decision', 'Review your offer and choose accept, decline, or request another option.'],
    ['payment', 'Payment', 'Payment is only available after you accept an offer.'],
    ['paperwork', 'Paperwork', 'Onboarding paperwork follows payment readiness.'],
    ['rotation_finalized', 'Rotation finalized', 'Course access and final rotation steps are completed.'],
  ];

  let index = 0;
  let waitingOn = 'MissionMed';
  let nextStep = 'Create or log in to your MissionMed account to keep tracking this request.';
  const reqStatus = String(requestItem?.status || 'new').toLowerCase();
  const offerStatus = String(offer?.status || '').toLowerCase();
  const accepted = Boolean(offer?.accepted_at || offerStatus === 'accepted');
  const declined = Boolean(offer?.declined_at || offerStatus === 'declined');
  const alternateRequested = Boolean(offer?.alternate_requested_at || offerStatus === 'alternate_requested');
  const hasOfferReadySignal = Boolean(
    offer
    && (offer.offer_token_expires_at
      || offer.message_sent_at
      || ['ready', 'sent', 'viewed', 'accepted', 'declined', 'alternate_requested'].includes(offerStatus)
      || ['dry_run', 'queued', 'sent'].includes(String(offer.postmark_status || '').toLowerCase()))
  );

  if (['reviewed', 'in_progress', 'offer_ready', 'promoted'].includes(reqStatus)) {
    index = 1;
    nextStep = 'Your request is being reviewed.';
  }

  if (offer || reqStatus === 'offer_ready') {
    index = 2;
    nextStep = 'Clinical rotation options are being prepared.';
  }

  if (hasOfferReadySignal) {
    index = 3;
    waitingOn = 'Student';
    nextStep = 'Review the secure offer link from the Clinicals team.';
  }

  if (accepted || declined || alternateRequested) {
    index = 4;
    waitingOn = accepted ? 'Student' : 'MissionMed';
    nextStep = accepted
      ? 'Continue to the MissionMed Clinicals payment handoff.'
      : declined
        ? 'This option is closed. Contact Clinicals if you want a new request.'
        : 'Clinicals will prepare an alternate option.';
  }

  if (accepted) {
    const paymentStatus = String(offer?.payment_status || 'pending').toLowerCase();
    index = paymentStatus === 'paid' ? 6 : 5;
    waitingOn = paymentStatus === 'paid' ? 'MissionMed' : 'Student';
    nextStep = paymentStatus === 'paid'
      ? 'Payment is recorded; watch for paperwork next.'
      : 'Complete the official MissionMed Clinicals payment handoff.';
  }

  if (accepted && ['requested', 'received', 'approved'].includes(String(offer?.paperwork_status || '').toLowerCase())) {
    index = 6;
    waitingOn = offer.paperwork_status === 'approved' ? 'MissionMed' : 'Student';
    nextStep = offer.paperwork_status === 'approved'
      ? 'Paperwork is approved; rotation finalization is next.'
      : 'Complete the requested onboarding paperwork.';
  }

  if (accepted && ['ready', 'enabled'].includes(String(offer?.learndash_status || '').toLowerCase())) {
    index = 7;
    waitingOn = offer.learndash_status === 'enabled' ? 'Complete' : 'MissionMed';
    nextStep = offer.learndash_status === 'enabled'
      ? 'Your rotation/course access is finalized.'
      : 'Course access is ready for final coordinator approval.';
  }

  const stages = keys.map(([key, label, description], itemIndex) => {
    let state = itemIndex < index ? 'complete' : itemIndex === index ? 'active' : 'waiting';
    if ((declined || alternateRequested) && itemIndex > 4) state = 'waiting';
    if (declined && itemIndex === 4) state = 'issue';
    if (alternateRequested && itemIndex === 4) state = 'active';
    return { key, label, description, state };
  });

  return {
    index,
    key: keys[index][0],
    label: keys[index][1],
    waitingOn,
    nextStep,
    stages,
  };
}

function buildCommunicationSummary(offer, commsEvents) {
  const statuses = commsEvents.map((item) => item.message_status).filter(Boolean);
  const eventTypes = commsEvents.map((item) => item.event_type).filter(Boolean);
  return {
    message_previewed: Boolean(offer?.message_previewed_at),
    message_sent: Boolean(offer?.message_sent_at || ['dry_run', 'queued', 'sent'].includes(String(offer?.postmark_status || '').toLowerCase())),
    postmark_status: offer?.postmark_status || 'not_sent',
    latest_event: eventTypes[0] || statuses[0] || null,
    latest_event_at: commsEvents[0]?.created_at || null,
    timeline: commsEvents.slice(0, 10).map((item) => ({
      created_at: item.created_at,
      direction: item.direction,
      message_status: item.message_status,
      event_type: item.event_type,
    })),
  };
}

function buildStudentActions(stage, offer, safePaymentUrl) {
  const actions = [];
  if (safePaymentUrl) {
    actions.push({ key: 'complete_payment', label: 'Complete payment', url: safePaymentUrl, primary: true });
  }
  if (offer && !safePaymentUrl) {
    actions.push({ key: 'contact_clinicals', label: 'Contact Clinicals team', url: buildMailtoUrl(), primary: stage.key === 'offer_ready' });
  }
  actions.push({ key: 'check_back', label: 'Check back later', url: TRACKER_URL, primary: actions.length === 0 });
  return actions;
}

function sanitizeIntakeRequest(row) {
  const id = sanitizeUuid(row?.id);
  const email = sanitizeEmail(row?.email);
  if (!id || !email) return null;
  return {
    id,
    created_at: sanitizeIso(row?.created_at),
    updated_at: sanitizeIso(row?.updated_at),
    status: sanitizeStatus(row?.status, 'new'),
    student_name: sanitizeText(row?.student_name, 160),
    email,
    training_level_or_school: sanitizeText(row?.training_level_or_school, 200),
    preferred_specialties: sanitizeArray(row?.preferred_specialties, 6),
    preferred_locations: sanitizeArray(row?.preferred_locations, 6),
    preferred_months_or_dates: sanitizeArray(row?.preferred_months_or_dates, 8),
    duration_weeks: sanitizeInt(row?.duration_weeks, 1, 24),
    payment_product_url: sanitizeAllowedUrl(row?.payment_product_url, PAYMENT_PRODUCT_URL),
    learndash_course_url: sanitizeAllowedUrl(row?.learndash_course_url, LEARNDASH_COURSE_URL),
  };
}

function sanitizeOffer(row) {
  const id = sanitizeUuid(row?.id);
  const intakeRequestId = sanitizeUuid(row?.intake_request_id);
  if (!id || !intakeRequestId) return null;
  return {
    id,
    intake_request_id: intakeRequestId,
    created_at: sanitizeIso(row?.created_at),
    updated_at: sanitizeIso(row?.updated_at),
    status: sanitizeStatus(row?.status, 'draft'),
    specialty: sanitizeText(row?.specialty, 120),
    location: sanitizeText(row?.location, 160),
    timing: sanitizeText(row?.timing, 160),
    duration_weeks: sanitizeInt(row?.duration_weeks, 1, 24),
    format: sanitizeText(row?.format, 120),
    expires_at: sanitizeIso(row?.expires_at),
    payment_url: sanitizeAllowedUrl(row?.payment_url, PAYMENT_PRODUCT_URL),
    offer_token_expires_at: sanitizeIso(row?.offer_token_expires_at),
    accepted_at: sanitizeIso(row?.accepted_at),
    declined_at: sanitizeIso(row?.declined_at),
    alternate_requested_at: sanitizeIso(row?.alternate_requested_at),
    postmark_status: sanitizeStatus(row?.postmark_status, 'not_sent'),
    message_previewed_at: sanitizeIso(row?.message_previewed_at),
    message_sent_at: sanitizeIso(row?.message_sent_at),
    payment_status: sanitizeStatus(row?.payment_status, 'pending'),
    payment_checked_at: sanitizeIso(row?.payment_checked_at),
    paperwork_status: sanitizeStatus(row?.paperwork_status, 'not_started'),
    paperwork_updated_at: sanitizeIso(row?.paperwork_updated_at),
    learndash_status: sanitizeStatus(row?.learndash_status, 'locked'),
    learndash_updated_at: sanitizeIso(row?.learndash_updated_at),
  };
}

function sanitizeCommsEvent(row) {
  const id = sanitizeUuid(row?.id);
  const intakeRequestId = sanitizeUuid(row?.intake_request_id);
  if (!id || !intakeRequestId) return null;
  const raw = row?.raw_json && typeof row.raw_json === 'object' ? row.raw_json : {};
  return {
    id,
    intake_request_id: intakeRequestId,
    created_at: sanitizeIso(row?.created_at),
    direction: sanitizeStatus(row?.direction, 'SYS').slice(0, 12),
    message_status: sanitizeStatus(row?.message_status, ''),
    event_type: sanitizeStatus(raw.event_type, ''),
    postmark_message_recorded: Boolean(row?.postmark_message_id),
  };
}

async function fetchTableRows(config, table, params) {
  const target = new URL(`/rest/v1/${table}`, config.supabaseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      target.searchParams.set(key, value);
    }
  });

  const response = await fetch(target, {
    method: 'GET',
    headers: buildSupabaseHeaders(config.serverKey, { 'Accept-Profile': 'command_center' }),
  });

  const payload = await readJson(response);
  if (!response.ok || !Array.isArray(payload)) {
    return {
      ok: false,
      httpStatus: response.status,
      reason: safeSupabaseReason(payload),
    };
  }

  return { ok: true, items: payload };
}

async function postRpc(config, rpcName, body) {
  const target = new URL(`/rest/v1/rpc/${rpcName}`, config.supabaseUrl);
  const response = await fetch(target, {
    method: 'POST',
    headers: buildSupabaseHeaders(config.serverKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  const payload = await readJson(response);
  if (!response.ok || !payload || typeof payload !== 'object') {
    return {
      ok: false,
      httpStatus: response.status,
      reason: safeSupabaseReason(payload),
    };
  }

  return { ok: true, payload };
}

function buildSupabaseHeaders(serverKey, extra = {}) {
  return {
    apikey: serverKey,
    Authorization: `Bearer ${serverKey}`,
    Accept: 'application/json',
    ...extra,
  };
}

function getSupabaseConfig() {
  const supabaseUrl = sanitizeSupabaseUrl(envValueAny(SUPABASE_URL_FLAGS, ''));
  const serverKey = envValueAny(SUPABASE_SERVER_KEY_FLAGS, '');

  if (!supabaseUrl) {
    return { ok: false, reason: 'supabase_url_missing' };
  }

  if (getSupabaseProjectRef(supabaseUrl) !== CANONICAL_SUPABASE_PROJECT_REF) {
    return { ok: false, reason: 'supabase_project_mismatch' };
  }

  if (!serverKey) {
    return { ok: false, reason: 'supabase_server_key_missing' };
  }

  return { ok: true, supabaseUrl, serverKey };
}

function getSupabaseProjectRef(value) {
  try {
    const host = new URL(value).hostname;
    return host.split('.')[0] || '';
  } catch {
    return '';
  }
}

function sanitizeSupabaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/u, '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    return parsed.toString().replace(/\/+$/u, '');
  } catch {
    return '';
  }
}

function groupLatestBy(items, key, dateKey) {
  const map = new Map();
  items.forEach((item) => {
    const groupKey = item?.[key];
    if (!groupKey) return;
    const existing = map.get(groupKey);
    if (!existing || Date.parse(item?.[dateKey] || '') > Date.parse(existing?.[dateKey] || '')) {
      map.set(groupKey, item);
    }
  });
  return map;
}

function groupBy(items, key) {
  const map = new Map();
  items.forEach((item) => {
    const groupKey = item?.[key];
    if (!groupKey) return;
    if (!map.has(groupKey)) map.set(groupKey, []);
    map.get(groupKey).push(item);
  });
  map.forEach((group) => group.sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || '')));
  return map;
}

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return '';
  const shown = local.length <= 2 ? local[0] || '*' : `${local.slice(0, 2)}...${local.slice(-1)}`;
  return `${shown}@${domain}`;
}

function maxTimestamp(values) {
  const valid = values.map((value) => Date.parse(value || '')).filter(Number.isFinite);
  if (!valid.length) return null;
  return new Date(Math.max(...valid)).toISOString();
}

function buildMailtoUrl() {
  const address = 'clinicals' + '@' + 'missionmedinstitute.com';
  const params = new URLSearchParams({
    subject: 'USCE request status',
  });
  return `mailto:${address}?${params.toString()}`;
}

function sanitizeAllowedUrl(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback || null;
  try {
    const parsed = new URL(raw);
    const allowed = new Set([
      new URL(PAYMENT_PRODUCT_URL).origin,
      new URL(LEARNDASH_COURSE_URL).origin,
      new URL(OFFER_PAGE_URL).origin,
    ]);
    return allowed.has(parsed.origin) ? parsed.toString() : (fallback || null);
  } catch {
    return fallback || null;
  }
}

function sanitizeEmail(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(raw)) return '';
  return raw;
}

function sanitizeUuid(value) {
  const raw = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(raw) ? raw : '';
}

function sanitizeIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function sanitizeText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, maxLength);
}

function sanitizeStatus(value, fallback = '') {
  const raw = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/gu, '').slice(0, 80);
  return raw || fallback;
}

function sanitizeArray(value, maxItems) {
  const arr = Array.isArray(value) ? value : [];
  return arr.map((item) => sanitizeText(item, 120)).filter(Boolean).slice(0, maxItems);
}

function sanitizeInt(value, min, max) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) return null;
  return numeric;
}

function safeReason(value) {
  return sanitizeStatus(value, 'unavailable');
}

function safeSupabaseReason(payload) {
  if (!payload || typeof payload !== 'object') return 'invalid_response';
  return sanitizeStatus(payload.code || payload.error || payload.message || payload.details || 'request_failed', 'request_failed');
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizePathname(pathname) {
  const value = String(pathname || '/').replace(/\/+$/u, '');
  return value || '/';
}

function envValueAny(names, fallback = '') {
  for (const name of names) {
    const raw = String(process.env[name] || '').trim();
    if (raw) return raw;
  }
  return String(fallback);
}

function sendRoutePayload(response, payload, headers = {}) {
  if (payload && typeof payload === 'object' && Number.isInteger(payload.httpStatus)) {
    const { httpStatus, ...body } = payload;
    sendJson(response, httpStatus, body, headers);
    return;
  }
  sendJson(response, 200, payload, headers);
}

function sendMethodNotAllowed(response, methods, headers = {}) {
  sendJson(response, 405, {
    ok: false,
    error: 'method_not_allowed',
    message: `Allowed methods: ${methods.join(', ')}`,
  }, {
    ...headers,
    Allow: methods.join(', '),
  });
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload, null, 2));
}
