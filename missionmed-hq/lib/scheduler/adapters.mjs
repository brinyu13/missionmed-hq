import { resolveSchedulerEntitlementDecision } from './entitlements.mjs';

const DEFAULT_TIMEOUT_MS = 6500;
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);

// MM-SCHED integrations remain server-only. Live calls require explicit env enablement.
export async function googleCalendarBusySyncAdapter() {
  return notConfigured('google_calendar_busy_sync');
}

export async function googleCalendarEventAdapter() {
  return notConfigured('google_calendar_event_creation');
}

export async function googleCalendarProviderMappingAdapter() {
  return notConfigured('google_calendar_provider_mapping');
}

export async function icsInviteAdapter() {
  return notConfigured('ics_invite_generation');
}

export async function zoomMeetingLinkAdapter(payload = {}, options = {}) {
  const env = options.env || process.env;
  const config = {
    enabled: envFlag(env.SCHEDULER_ZOOM_ENABLED),
    accountId: secretText(env.SCHEDULER_ZOOM_ACCOUNT_ID || env.ZOOM_ACCOUNT_ID),
    clientId: secretText(env.SCHEDULER_ZOOM_CLIENT_ID || env.ZOOM_CLIENT_ID),
    clientSecret: secretText(env.SCHEDULER_ZOOM_CLIENT_SECRET || env.ZOOM_CLIENT_SECRET),
    apiBase: cleanUrl(env.SCHEDULER_ZOOM_API_BASE || 'https://api.zoom.us'),
    tokenBase: cleanUrl(env.SCHEDULER_ZOOM_TOKEN_BASE || 'https://zoom.us'),
  };
  if (!config.enabled || !config.accountId || !config.clientId || !config.clientSecret) {
    return notConfigured('zoom_meeting_link_creation', {
      required_env: ['SCHEDULER_ZOOM_ENABLED', 'SCHEDULER_ZOOM_ACCOUNT_ID', 'SCHEDULER_ZOOM_CLIENT_ID', 'SCHEDULER_ZOOM_CLIENT_SECRET'],
    });
  }

  const providerAccountId = providerMeetingAccount(payload, 'zoom');
  if (!providerAccountId) {
    return providerMappingMissing('zoom_meeting_link_creation', 'zoom');
  }

  try {
    const tokenUrl = new URL('/oauth/token', config.tokenBase);
    tokenUrl.searchParams.set('grant_type', 'account_credentials');
    tokenUrl.searchParams.set('account_id', config.accountId);
    const tokenResponse = await fetchJson(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    if (!tokenResponse.ok || !tokenResponse.data?.access_token) {
      return providerFailure('zoom_meeting_link_creation', 'zoom', tokenResponse, 'Zoom token request failed.');
    }

    const meetingResponse = await fetchJson(new URL(`/v2/users/${encodeURIComponent(providerAccountId)}/meetings`, config.apiBase), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResponse.data.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(zoomMeetingPayload(payload)),
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    if (!meetingResponse.ok) {
      return providerFailure('zoom_meeting_link_creation', 'zoom', meetingResponse, 'Zoom meeting creation failed.');
    }

    const meetingUrl = String(meetingResponse.data?.join_url || '').trim();
    return {
      ok: Boolean(meetingUrl),
      status: meetingUrl ? 'created' : 'failed',
      adapter: 'zoom_meeting_link_creation',
      provider: 'zoom',
      meeting_url: meetingUrl || null,
      meeting_url_present: Boolean(meetingUrl),
      external_event_id: String(meetingResponse.data?.id || meetingResponse.data?.uuid || '').trim() || null,
      provider_account_id_present: true,
      message: meetingUrl ? 'Zoom meeting created server-side.' : 'Zoom response did not include a join URL.',
    };
  } catch (error) {
    return adapterException('zoom_meeting_link_creation', 'zoom', error);
  }
}

export async function zoomMeetingCleanupAdapter(payload = {}, options = {}) {
  const env = options.env || process.env;
  const config = {
    enabled: envFlag(env.SCHEDULER_ZOOM_ENABLED),
    accountId: secretText(env.SCHEDULER_ZOOM_ACCOUNT_ID || env.ZOOM_ACCOUNT_ID),
    clientId: secretText(env.SCHEDULER_ZOOM_CLIENT_ID || env.ZOOM_CLIENT_ID),
    clientSecret: secretText(env.SCHEDULER_ZOOM_CLIENT_SECRET || env.ZOOM_CLIENT_SECRET),
    apiBase: cleanUrl(env.SCHEDULER_ZOOM_API_BASE || 'https://api.zoom.us'),
    tokenBase: cleanUrl(env.SCHEDULER_ZOOM_TOKEN_BASE || 'https://zoom.us'),
  };
  if (!config.enabled || !config.accountId || !config.clientId || !config.clientSecret) {
    return notConfigured('zoom_meeting_cleanup', {
      required_env: ['SCHEDULER_ZOOM_ENABLED', 'SCHEDULER_ZOOM_ACCOUNT_ID', 'SCHEDULER_ZOOM_CLIENT_ID', 'SCHEDULER_ZOOM_CLIENT_SECRET'],
    });
  }

  const externalEventId = zoomExternalEventId(payload);
  if (!externalEventId) {
    return {
      ok: false,
      status: 'missing_external_event_id',
      adapter: 'zoom_meeting_cleanup',
      provider: 'zoom',
      external_event_id_present: false,
      message: 'Zoom meeting cleanup requires a persisted external event id.',
    };
  }

  try {
    const tokenUrl = new URL('/oauth/token', config.tokenBase);
    tokenUrl.searchParams.set('grant_type', 'account_credentials');
    tokenUrl.searchParams.set('account_id', config.accountId);
    const tokenResponse = await fetchJson(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    if (!tokenResponse.ok || !tokenResponse.data?.access_token) {
      return providerFailure('zoom_meeting_cleanup', 'zoom', tokenResponse, 'Zoom token request failed.');
    }

    const deleteResponse = await fetchJson(new URL(`/v2/meetings/${encodeURIComponent(externalEventId)}`, config.apiBase), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenResponse.data.access_token}`,
      },
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    if (deleteResponse.ok) {
      return {
        ok: true,
        status: 'deleted',
        adapter: 'zoom_meeting_cleanup',
        provider: 'zoom',
        external_event_id_present: true,
        message: 'Zoom meeting deleted server-side.',
      };
    }
    if (Number(deleteResponse.status) === 404 || Number(deleteResponse.data?.code) === 3001) {
      return {
        ok: true,
        status: 'already_missing',
        adapter: 'zoom_meeting_cleanup',
        provider: 'zoom',
        external_event_id_present: true,
        message: 'Zoom meeting was already absent.',
      };
    }
    return providerFailure('zoom_meeting_cleanup', 'zoom', deleteResponse, 'Zoom meeting cleanup failed.');
  } catch (error) {
    return adapterException('zoom_meeting_cleanup', 'zoom', error);
  }
}

export async function webexMeetingLinkAdapter(payload = {}, options = {}) {
  const env = options.env || process.env;
  const config = {
    enabled: envFlag(env.SCHEDULER_WEBEX_ENABLED),
    accessToken: secretText(env.SCHEDULER_WEBEX_ACCESS_TOKEN || env.WEBEX_ACCESS_TOKEN),
    apiBase: cleanUrl(env.SCHEDULER_WEBEX_API_BASE || 'https://webexapis.com'),
  };
  if (!config.enabled || !config.accessToken) {
    return notConfigured('webex_meeting_link_creation', {
      required_env: ['SCHEDULER_WEBEX_ENABLED', 'SCHEDULER_WEBEX_ACCESS_TOKEN'],
    });
  }

  const providerAccountId = providerMeetingAccount(payload, 'webex');
  if (!providerAccountId) {
    return providerMappingMissing('webex_meeting_link_creation', 'webex');
  }

  try {
    const meetingResponse = await fetchJson(new URL('/v1/meetings', config.apiBase), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webexMeetingPayload(payload, providerAccountId)),
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    if (!meetingResponse.ok) {
      return providerFailure('webex_meeting_link_creation', 'webex', meetingResponse, 'Webex meeting creation failed.');
    }

    const meetingUrl = String(
      meetingResponse.data?.webLink
        || meetingResponse.data?.joinWebUrl
        || meetingResponse.data?.meetingLink
        || '',
    ).trim();
    return {
      ok: Boolean(meetingUrl),
      status: meetingUrl ? 'created' : 'failed',
      adapter: 'webex_meeting_link_creation',
      provider: 'webex',
      meeting_url: meetingUrl || null,
      meeting_url_present: Boolean(meetingUrl),
      external_event_id: String(meetingResponse.data?.id || meetingResponse.data?.meetingId || '').trim() || null,
      provider_account_id_present: true,
      message: meetingUrl ? 'Webex meeting created server-side.' : 'Webex response did not include a join URL.',
    };
  } catch (error) {
    return adapterException('webex_meeting_link_creation', 'webex', error);
  }
}

export async function googleMeetAdapter() {
  return notConfigured('google_meet_handling');
}

export async function manualMeetingLinkAdapter(payload = {}) {
  const meetingUrl = String(payload.meeting_url || payload.meetingUrl || '').trim();
  if (!meetingUrl) {
    return notConfigured('manual_meeting_link');
  }

  return {
    ok: true,
    status: 'manual',
    adapter: 'manual_meeting_link',
    meeting_url_present: true,
    message: 'Manual meeting link was provided server-side.',
  };
}

export async function stripePaymentAdapter(payload = {}, options = {}) {
  const env = options.env || process.env;
  const secretKey = secretText(env.SCHEDULER_STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY);
  const allowLive = envFlag(env.SCHEDULER_ALLOW_LIVE_STRIPE);
  const enabled = envFlag(env.SCHEDULER_STRIPE_ENABLED);
  if (!enabled || !secretKey) {
    return notConfigured('stripe_payment_intent', {
      required_env: ['SCHEDULER_STRIPE_ENABLED', 'SCHEDULER_STRIPE_SECRET_KEY or STRIPE_SECRET_KEY'],
    });
  }
  if (secretKey.startsWith('sk_live_') && !allowLive) {
    return notConfigured('stripe_payment_intent', {
      reason: 'live_stripe_key_requires_explicit_scheduler_approval',
      required_env: ['SCHEDULER_ALLOW_LIVE_STRIPE'],
    });
  }

  const action = String(payload.action || payload.operation || (payload.payment_intent_id || payload.paymentIntentId ? 'verify' : 'create')).trim();
  try {
    if (action === 'verify' || action === 'retrieve') {
      return await verifyStripePaymentIntent(payload, { ...options, secretKey });
    }
    return await createStripePaymentIntent(payload, { ...options, secretKey });
  } catch (error) {
    return adapterException('stripe_payment_intent', 'stripe', error);
  }
}

export async function paypalPaymentAdapter() {
  return notConfigured('paypal_payment');
}

export function createMockMeetingAdapter(provider = 'zoom', decision = 'created') {
  return async (payload = {}) => {
    if (decision === 'failed') {
      return {
        ok: false,
        status: 'failed',
        adapter: `${provider}_meeting_link_creation`,
        provider,
        message: 'Mock meeting adapter failure.',
      };
    }

    return {
      ok: true,
      status: 'created',
      adapter: `${provider}_meeting_link_creation`,
      provider,
      meeting_url: payload.meeting_url || payload.meetingUrl || `https://example.test/${provider}/mock-meeting`,
      meeting_url_present: Boolean(payload.meeting_url || payload.meetingUrl) || true,
      external_event_id: `${provider}-mock-event`,
      message: 'Mock meeting adapter created a staging-safe meeting placeholder.',
    };
  };
}

export function createMockMeetingCleanupAdapter(provider = 'zoom', decision = 'deleted') {
  return async () => {
    if (decision === 'failed') {
      return {
        ok: false,
        status: 'failed',
        adapter: `${provider}_meeting_cleanup`,
        provider,
        message: 'Mock meeting cleanup adapter failure.',
      };
    }

    return {
      ok: true,
      status: decision,
      adapter: `${provider}_meeting_cleanup`,
      provider,
      external_event_id_present: true,
      message: 'Mock meeting cleanup adapter deleted a staging-safe meeting placeholder.',
    };
  };
}

export function createMockPaymentAdapter(provider = 'stripe', decision = 'not_configured') {
  return async (payload = {}) => {
    if (decision !== 'succeeded') {
      return {
        ok: false,
        status: decision,
        adapter: `${provider}_payment_intent`,
        provider,
        message: 'Mock payment adapter did not confirm payment.',
      };
    }

    return {
      ok: true,
      status: 'succeeded',
      adapter: `${provider}_payment_intent`,
      provider,
      payment_confirmation_id: payload.payment_confirmation_id || payload.paymentConfirmationId || 'mock-payment-confirmation',
      message: 'Mock payment adapter confirmed payment.',
    };
  };
}

export async function emailMedMailNotificationAdapter(payload = {}, options = {}) {
  const env = options.env || process.env;
  const provider = String(env.SCHEDULER_EMAIL_PROVIDER || env.MEDMAIL_PROVIDER || 'postmark').trim().toLowerCase();
  const enabled = envFlag(env.SCHEDULER_EMAIL_ENABLED || env.MEDMAIL_ENABLED);
  const token = secretText(env.SCHEDULER_POSTMARK_SERVER_TOKEN || env.POSTMARK_SERVER_TOKEN);
  const from = String(env.SCHEDULER_EMAIL_FROM || env.MEDMAIL_FROM_EMAIL || env.POSTMARK_FROM_EMAIL || '').trim();
  if (!enabled || provider !== 'postmark' || !token || !from) {
    return notConfigured('email_medmail_notification_queue', {
      required_env: ['SCHEDULER_EMAIL_ENABLED', 'SCHEDULER_EMAIL_PROVIDER=postmark', 'SCHEDULER_POSTMARK_SERVER_TOKEN', 'SCHEDULER_EMAIL_FROM'],
      queued: Boolean(payload.queued),
    });
  }

  const recipient = normalizeRecipient(payload);
  if (!recipient.email) {
    return {
      ok: true,
      status: 'suppressed',
      adapter: 'email_medmail_notification_queue',
      channel: 'email',
      reason: 'recipient_email_missing',
      message: 'Email notification suppressed because no recipient email was available.',
    };
  }

  const email = buildSchedulerEmail({ ...payload, recipient, from });
  try {
    const response = await fetchJson('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify(email),
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    if (!response.ok || Number(response.data?.ErrorCode || 0) !== 0) {
      return providerFailure('email_medmail_notification_queue', 'postmark', response, 'Postmark send failed.');
    }
    return {
      ok: true,
      status: 'sent',
      adapter: 'email_medmail_notification_queue',
      provider: 'postmark',
      channel: 'email',
      provider_message_id: String(response.data?.MessageID || response.data?.MessageId || '').trim() || null,
      message: 'Scheduler email sent via Postmark.',
    };
  } catch (error) {
    return adapterException('email_medmail_notification_queue', 'postmark', error);
  }
}

export async function smsNotificationProviderAdapter(payload = {}, options = {}) {
  const env = options.env || process.env;
  const provider = String(env.SCHEDULER_SMS_PROVIDER || 'twilio').trim().toLowerCase();
  const enabled = envFlag(env.SCHEDULER_SMS_ENABLED);
  const accountSid = secretText(env.SCHEDULER_TWILIO_ACCOUNT_SID || env.TWILIO_ACCOUNT_SID);
  const authToken = secretText(env.SCHEDULER_TWILIO_AUTH_TOKEN || env.TWILIO_AUTH_TOKEN);
  const messagingServiceSid = secretText(env.SCHEDULER_TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_MESSAGING_SERVICE_SID);
  const from = String(env.SCHEDULER_TWILIO_FROM || env.TWILIO_FROM || '').trim();
  if (!enabled || provider !== 'twilio' || !accountSid || !authToken || (!messagingServiceSid && !from)) {
    return notConfigured('sms_notification_provider', {
      required_env: ['SCHEDULER_SMS_ENABLED', 'SCHEDULER_SMS_PROVIDER=twilio', 'SCHEDULER_TWILIO_ACCOUNT_SID', 'SCHEDULER_TWILIO_AUTH_TOKEN', 'SCHEDULER_TWILIO_MESSAGING_SERVICE_SID or SCHEDULER_TWILIO_FROM'],
    });
  }
  if (!payload.sms_opt_in && !payload.smsOptIn) {
    return {
      ok: true,
      status: 'suppressed',
      adapter: 'sms_notification_provider',
      channel: 'sms',
      reason: 'sms_opt_in_required',
      message: 'SMS notification suppressed because the student has not opted in.',
    };
  }
  const to = String(payload.to_phone || payload.toPhone || payload.phone || '').trim();
  if (!to) {
    return {
      ok: true,
      status: 'suppressed',
      adapter: 'sms_notification_provider',
      channel: 'sms',
      reason: 'recipient_phone_missing',
      message: 'SMS notification suppressed because no recipient phone was available.',
    };
  }

  const body = schedulerSmsBody(payload);
  const params = new URLSearchParams();
  params.set('To', to);
  params.set('Body', body);
  if (messagingServiceSid) params.set('MessagingServiceSid', messagingServiceSid);
  else params.set('From', from);

  try {
    const response = await fetchJson(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    if (!response.ok) {
      return providerFailure('sms_notification_provider', 'twilio', response, 'Twilio SMS send failed.');
    }
    return {
      ok: true,
      status: 'sent',
      adapter: 'sms_notification_provider',
      provider: 'twilio',
      channel: 'sms',
      provider_message_id: String(response.data?.sid || '').trim() || null,
      message: 'Scheduler SMS sent via Twilio.',
    };
  } catch (error) {
    return adapterException('sms_notification_provider', 'twilio', error);
  }
}

export async function enrollmentGateAdapter(payload = {}, options = {}) {
  const entitlementDecision = resolveSchedulerEntitlementDecision(payload, options);
  if (entitlementDecision) {
    return normalizeEnrollmentDecision(entitlementDecision, payload);
  }

  const bridgeDecision = await getBridgeEnrollmentDecision(payload, options);
  if (bridgeDecision) {
    return normalizeEnrollmentDecision(bridgeDecision, payload);
  }

  const launchDecision = getLaunchAllowlistEnrollmentDecision(payload, options.env || process.env);
  if (launchDecision) {
    return normalizeEnrollmentDecision(launchDecision, payload);
  }

  const fixtureDecision = getServerFixtureEnrollmentDecision(payload);
  if (fixtureDecision) {
    return normalizeEnrollmentDecision(fixtureDecision, payload);
  }

  return normalizeEnrollmentDecision({
    ok: false,
    status: 'not_configured',
    eligible: false,
    reason: 'enrollment_bridge_not_configured',
    mode: 'fail_closed',
    message: 'Enrollment gate is not configured. Booking must wait for the approved Railway WordPress/LearnDash/WooCommerce eligibility bridge or an admin override.',
  }, payload);
}

function getLaunchAllowlistEnrollmentDecision(payload = {}, env = process.env) {
  if (String(env.SCHEDULER_LAUNCH_ENROLLMENT_MODE || '').trim().toLowerCase() !== 'allowlist') {
    return null;
  }

  const allowedTypeTokens = mergeTokenSets(
    env.SCHEDULER_LAUNCH_ELIGIBLE_APPOINTMENT_TYPE_IDS,
    env.SCHEDULER_LAUNCH_ELIGIBLE_APPOINTMENT_TYPE_SLUGS,
  );
  if (!allowedTypeTokens.size) {
    return {
      ok: false,
      status: 'not_configured',
      eligible: false,
      reason: 'launch_allowlist_missing_appointment_type_scope',
      mode: 'launch_allowlist',
      message: 'Scheduler launch allowlist is missing an appointment type scope, so booking remains closed.',
    };
  }

  const appointmentTypeTokens = compactTokens([
    payload.appointmentTypeId,
    payload.appointment_type_id,
    payload.appointmentType?.id,
    payload.appointment_type?.id,
    payload.appointmentType?.slug,
    payload.appointment_type?.slug,
  ]);
  if (!hasTokenMatch(appointmentTypeTokens, allowedTypeTokens)) {
    return {
      ok: false,
      status: 'ineligible',
      eligible: false,
      reason: 'launch_allowlist_appointment_type_not_allowed',
      mode: 'launch_allowlist',
      message: 'This appointment type is not open for the controlled Scheduler launch allowlist.',
    };
  }

  const actor = payload.actor || {};
  const allowedUserTokens = mergeTokenSets(
    env.SCHEDULER_LAUNCH_ELIGIBLE_USER_IDS,
    env.SCHEDULER_LAUNCH_ELIGIBLE_WP_USER_IDS,
    env.SCHEDULER_LAUNCH_ELIGIBLE_EMAILS,
    env.SCHEDULER_LAUNCH_ELIGIBLE_LOGINS,
  );
  if (!allowedUserTokens.size) {
    return {
      ok: false,
      status: 'not_configured',
      eligible: false,
      reason: 'launch_allowlist_missing_user_scope',
      mode: 'launch_allowlist',
      message: 'Scheduler launch allowlist is missing a server-side user scope, so booking remains closed.',
    };
  }

  const userTokens = compactTokens([
    payload.studentUserId,
    payload.student_user_id,
    payload.studentWpUserId,
    payload.student_wp_user_id,
    actor.userId,
    actor.wpUserId,
    actor.email,
    actor.login,
  ]);
  if (!hasTokenMatch(userTokens, allowedUserTokens)) {
    return {
      ok: false,
      status: 'ineligible',
      eligible: false,
      reason: 'launch_allowlist_user_not_allowed',
      mode: 'launch_allowlist',
      message: 'This account is not included in the controlled Scheduler launch allowlist.',
    };
  }

  return {
    ok: true,
    status: 'eligible',
    eligible: true,
    reason: 'launch_allowlist_eligible',
    mode: 'launch_allowlist',
    message: 'Controlled Scheduler launch allowlist confirms eligibility for this appointment type.',
  };
}

function getServerFixtureEnrollmentDecision(payload = {}, env = process.env) {
  if (String(env.SCHEDULER_STAGING_ENROLLMENT_MODE || '').trim() !== 'fixture') {
    return null;
  }

  const studentUserId = String(payload.studentUserId ?? payload.student_user_id ?? '').trim();
  const eligibleIds = splitFixtureList(env.SCHEDULER_STAGING_ELIGIBLE_USER_IDS);
  const ineligibleIds = splitFixtureList(env.SCHEDULER_STAGING_INELIGIBLE_USER_IDS);

  if (eligibleIds.has(studentUserId)) {
    return {
      ok: true,
      status: 'eligible',
      eligible: true,
      reason: 'staging_fixture_eligible',
      mode: 'server_fixture',
      message: 'Staging fixture confirms scheduler eligibility.',
    };
  }

  if (ineligibleIds.has(studentUserId)) {
    return {
      ok: false,
      status: 'ineligible',
      eligible: false,
      reason: 'staging_fixture_ineligible',
      mode: 'server_fixture',
      message: 'Staging fixture marks this user ineligible.',
    };
  }

  return {
    ok: false,
    status: 'unknown',
    eligible: false,
    reason: 'staging_fixture_missing_user',
    mode: 'server_fixture',
    message: 'Staging fixture has no eligibility record for this user.',
  };
}

function mergeTokenSets(...values) {
  const tokens = new Set();
  for (const value of values) {
    for (const token of compactTokens(String(value || '').split(','))) {
      tokens.add(token);
    }
  }
  return tokens;
}

function compactTokens(values = []) {
  return values
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean);
}

function hasTokenMatch(values = [], allowed = new Set()) {
  return values.some((value) => allowed.has(value));
}

export function createMockEnrollmentGateAdapter(decision = 'eligible') {
  return async (payload = {}) => normalizeEnrollmentDecision(decision, payload);
}

export function normalizeEnrollmentDecision(decision = {}, payload = {}) {
  const normalized = typeof decision === 'string'
    ? { status: decision, eligible: decision === 'eligible' }
    : { ...decision };
  const eligible = normalized.eligible === true || normalized.status === 'eligible';
  const status = normalized.status || (eligible ? 'eligible' : 'not_configured');
  const reason = normalized.reason || (eligible ? 'eligible' : status);

  return {
    ok: eligible,
    status,
    adapter: 'enrollment_gate',
    eligible,
    reason,
    mode: normalized.mode || 'mock_or_configured_decision',
    checked: {
      appointment_type_id: payload.appointmentTypeId ?? payload.appointment_type_id ?? null,
      student_user_id: payload.studentUserId ?? payload.student_user_id ?? null,
      student_wp_user_id: payload.studentWpUserId ?? payload.student_wp_user_id ?? null,
    },
    message: normalized.message || (eligible
      ? 'Enrollment eligibility confirmed.'
      : 'Enrollment eligibility could not be confirmed.'),
  };
}

export async function ssaImportPreviewAdapter(payload = {}) {
  const source = payload.source || payload.export || payload.rows || null;
  return {
    ok: true,
    status: 'dry_run',
    adapter: 'ssa_import_preview',
    import_run_enabled: false,
    summary: {
      source_present: Boolean(source),
      rows_seen: Array.isArray(payload.rows) ? payload.rows.length : 0,
    },
    warnings: [
      'SSA import preview is scaffolded only.',
      'No SSA source, production WordPress database, Supabase data, reminders, or calendar events were modified.',
    ],
  };
}

function notConfigured(adapter, details = {}) {
  return {
    ok: false,
    status: 'not_configured',
    adapter,
    ...details,
    message: `${adapter} is intentionally not wired in MM-SCHED-012 foundation.`,
  };
}

function providerMappingMissing(adapter, provider) {
  return {
    ok: false,
    status: 'provider_mapping_missing',
    adapter,
    provider,
    message: `${provider} meeting creation requires a server-side provider account mapping.`,
  };
}

function providerFailure(adapter, provider, response = {}, message = 'Provider request failed.') {
  return {
    ok: false,
    status: 'failed',
    adapter,
    provider,
    http_status: response.status || null,
    provider_error: safeProviderError(response.data),
    message,
  };
}

function adapterException(adapter, provider, error) {
  return {
    ok: false,
    status: 'failed',
    adapter,
    provider,
    message: error instanceof Error ? error.message : 'Adapter request failed.',
  };
}

async function fetchJson(target, {
  method = 'GET',
  headers = {},
  body = undefined,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    return { ok: false, status: 0, data: { message: 'fetch_unavailable' } };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(timeoutMs || DEFAULT_TIMEOUT_MS));
  try {
    const response = await fetchImpl(target, { method, headers, body, signal: controller.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, data: parseJson(text), text };
  } finally {
    clearTimeout(timeout);
  }
}

function zoomMeetingPayload(payload = {}) {
  return {
    topic: meetingTitle(payload),
    type: 2,
    start_time: isoWithoutMillis(payload.start_at || payload.startAt),
    duration: durationMinutes(payload),
    timezone: String(payload.timezone || 'America/New_York'),
    agenda: safePlainText(payload.agenda || payload.description || 'MissionMed scheduled appointment.'),
    settings: {
      waiting_room: true,
      join_before_host: false,
      approval_type: 2,
      registrants_email_notification: false,
    },
  };
}

function zoomExternalEventId(payload = {}) {
  return String(
    payload.external_event_id
      || payload.externalEventId
      || payload.zoom_meeting_id
      || payload.zoomMeetingId
      || payload.meeting_id
      || payload.meetingId
      || '',
  ).trim();
}

function webexMeetingPayload(payload = {}, providerAccountId = '') {
  const body = {
    title: meetingTitle(payload),
    start: new Date(payload.start_at || payload.startAt).toISOString(),
    end: new Date(payload.end_at || payload.endAt).toISOString(),
    timezone: String(payload.timezone || 'America/New_York'),
    agenda: safePlainText(payload.agenda || payload.description || 'MissionMed scheduled appointment.'),
  };
  if (providerAccountId.includes('@')) {
    body.hostEmail = providerAccountId;
  }
  return body;
}

async function createStripePaymentIntent(payload = {}, options = {}) {
  const amount = Number(payload.amount_cents || payload.amountCents || 0);
  const currency = String(payload.currency || 'usd').trim().toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      status: 'failed',
      adapter: 'stripe_payment_intent',
      provider: 'stripe',
      reason: 'amount_required',
      message: 'Stripe PaymentIntent creation requires a positive amount_cents.',
    };
  }

  const params = new URLSearchParams();
  params.set('amount', String(Math.floor(amount)));
  params.set('currency', currency);
  params.set('automatic_payment_methods[enabled]', 'true');
  for (const [key, value] of Object.entries(stripeMetadata(payload))) {
    if (value != null && String(value).trim()) params.set(`metadata[${key}]`, String(value));
  }
  const response = await fetchJson('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  if (!response.ok) {
    return providerFailure('stripe_payment_intent', 'stripe', response, 'Stripe PaymentIntent creation failed.');
  }
  return {
    ok: true,
    status: response.data?.status || 'requires_payment_method',
    adapter: 'stripe_payment_intent',
    provider: 'stripe',
    payment_intent_id: response.data?.id || null,
    client_secret: response.data?.client_secret || null,
    payment_confirmation_id: response.data?.id || null,
    message: 'Stripe PaymentIntent created server-side.',
  };
}

async function verifyStripePaymentIntent(payload = {}, options = {}) {
  const paymentIntentId = String(payload.payment_intent_id || payload.paymentIntentId || payload.payment_confirmation_id || payload.paymentConfirmationId || '').trim();
  if (!paymentIntentId) {
    return {
      ok: false,
      status: 'payment_confirmation_missing',
      adapter: 'stripe_payment_intent',
      provider: 'stripe',
      message: 'Payment confirmation id is required.',
    };
  }
  const response = await fetchJson(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${options.secretKey}` },
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  if (!response.ok) {
    return providerFailure('stripe_payment_intent', 'stripe', response, 'Stripe PaymentIntent verification failed.');
  }
  const status = String(response.data?.status || '').trim();
  return {
    ok: status === 'succeeded',
    status: status === 'succeeded' ? 'succeeded' : 'payment_pending',
    adapter: 'stripe_payment_intent',
    provider: 'stripe',
    payment_intent_id: response.data?.id || paymentIntentId,
    payment_confirmation_id: response.data?.id || paymentIntentId,
    amount_cents: response.data?.amount || null,
    currency: response.data?.currency || null,
    message: status === 'succeeded'
      ? 'Stripe PaymentIntent is server-verified as succeeded.'
      : `Stripe PaymentIntent is ${status || 'not confirmed'}.`,
  };
}

async function getBridgeEnrollmentDecision(payload = {}, options = {}) {
  const env = options.env || process.env;
  const enabled = envFlag(env.SCHEDULER_ENROLLMENT_BRIDGE_ENABLED);
  const bridgeUrl = String(env.SCHEDULER_ENROLLMENT_BRIDGE_URL || '').trim();
  const token = secretText(env.SCHEDULER_ENROLLMENT_BRIDGE_TOKEN || '');
  if (!enabled || !bridgeUrl || !token) {
    return null;
  }
  if (!envFlag(env.SCHEDULER_ENROLLMENT_BRIDGE_ALLOW_PRODUCTION) && !isNonProductionUrl(bridgeUrl)) {
    return {
      ok: false,
      status: 'not_configured',
      eligible: false,
      reason: 'production_enrollment_bridge_not_authorized',
      mode: 'fail_closed',
      message: 'Enrollment bridge URL appears production-like and is not explicitly authorized for Scheduler.',
    };
  }

  try {
    const response = await fetchJson(bridgeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        student_user_id: payload.studentUserId ?? payload.student_user_id ?? null,
        student_wp_user_id: payload.studentWpUserId ?? payload.student_wp_user_id ?? null,
        appointment_type_id: payload.appointmentTypeId ?? payload.appointment_type_id ?? null,
        appointment_type_slug: payload.appointmentTypeSlug ?? payload.appointment_type_slug ?? null,
        requested_action: payload.requestedAction || payload.requested_action || 'book',
      }),
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    if (!response.ok) {
      return {
        ok: false,
        status: 'error',
        eligible: false,
        reason: 'enrollment_bridge_error',
        mode: 'bridge',
        message: 'Enrollment bridge returned an error and Scheduler failed closed.',
      };
    }
    return { ...response.data, mode: response.data?.mode || 'bridge' };
  } catch {
    return {
      ok: false,
      status: 'error',
      eligible: false,
      reason: 'enrollment_bridge_timeout_or_network_error',
      mode: 'bridge',
      message: 'Enrollment bridge could not be reached. Scheduler failed closed.',
    };
  }
}

function buildSchedulerEmail(payload = {}) {
  const templateKey = String(payload.templateKey || payload.template_key || 'scheduler_notification');
  const appointment = payload.appointment || {};
  const subject = schedulerEmailSubject(templateKey, payload);
  const text = schedulerEmailText(templateKey, payload, appointment);
  return {
    From: payload.from,
    To: payload.recipient.email,
    Subject: subject,
    TextBody: text,
    HtmlBody: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
    MessageStream: String(payload.message_stream || payload.messageStream || 'outbound').trim(),
    Metadata: {
      appointment_id: String(payload.appointmentId || payload.appointment_id || appointment.id || ''),
      template_key: templateKey,
      source: 'missionmed_scheduler',
    },
  };
}

function schedulerEmailSubject(templateKey, payload = {}) {
  if (templateKey.includes('cancel')) return 'MissionMed appointment canceled';
  if (templateKey.includes('reschedule')) return 'MissionMed appointment rescheduled';
  if (templateKey.includes('reminder')) return 'MissionMed appointment reminder';
  if (String(payload.recipientRole || payload.recipient_role || '').includes('admin')) return 'MissionMed scheduler booking notice';
  return 'MissionMed appointment confirmation';
}

function schedulerEmailText(templateKey, payload = {}, appointment = {}) {
  const when = appointment.start_at || appointment.startAt || payload.start_at || payload.startAt || '';
  const provider = payload.provider_name || payload.providerName || appointment.provider_name || 'your MissionMed provider';
  const meetingUrl = String(payload.meeting_url || payload.meetingUrl || appointment.meeting_url || '').trim();
  const paymentStatus = payload.payment_status || payload.paymentStatus || appointment.payment_status || 'not required';
  const lines = [
    schedulerEmailSubject(templateKey, payload),
    '',
    `Provider: ${provider}`,
    `Time: ${when ? new Date(when).toISOString() : 'scheduled time pending'}`,
    `Payment: ${paymentStatus}`,
  ];
  if (meetingUrl) lines.push(`Meeting link: ${meetingUrl}`);
  lines.push('', 'Reply to MissionMed if you need help with this appointment.');
  return lines.join('\n');
}

function schedulerSmsBody(payload = {}) {
  const when = payload.start_at || payload.startAt || payload.appointment?.start_at || payload.appointment?.startAt || '';
  const meetingUrl = String(payload.meeting_url || payload.meetingUrl || payload.appointment?.meeting_url || '').trim();
  const parts = [`MissionMed reminder: appointment ${when ? new Date(when).toISOString() : 'coming up'}.`];
  if (meetingUrl) parts.push(`Join: ${meetingUrl}`);
  return parts.join(' ');
}

function normalizeRecipient(payload = {}) {
  return {
    email: String(payload.to_email || payload.toEmail || payload.recipient?.email || payload.actor?.email || '').trim().toLowerCase(),
    phone: String(payload.to_phone || payload.toPhone || payload.recipient?.phone || '').trim(),
  };
}

function providerMeetingAccount(payload = {}, provider = '') {
  const metadata = payload.metadata || payload.appointmentType?.metadata || payload.appointment_type?.metadata || {};
  const meeting = metadata.web_meetings || metadata.webMeetings || {};
  const providerMap = payload.providerMeetingAccounts || payload.provider_meeting_accounts || metadata.provider_meeting_accounts || {};
  return String(
    payload.provider_account_id
      || payload.providerAccountId
      || payload.meeting_account_id
      || payload.meetingAccountId
      || meeting.provider_account_id
      || meeting.providerAccountId
      || meeting[`${provider}_account_id`]
      || providerMap[provider]
      || '',
  ).trim();
}

function meetingTitle(payload = {}) {
  return safePlainText(payload.title || payload.topic || payload.appointmentTypeName || payload.appointment_type_name || 'MissionMed appointment');
}

function durationMinutes(payload = {}) {
  const explicit = Number(payload.duration_minutes || payload.durationMinutes || 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  const start = new Date(payload.start_at || payload.startAt);
  const end = new Date(payload.end_at || payload.endAt);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  }
  return 30;
}

function stripeMetadata(payload = {}) {
  return {
    source: 'missionmed_scheduler',
    appointment_type_id: payload.appointment_type_id || payload.appointmentTypeId || payload.appointmentType?.id,
    student_user_id: payload.student_user_id || payload.studentUserId,
    idempotency_key: payload.idempotency_key || payload.idempotencyKey,
  };
}

function envFlag(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

function secretText(value = '') {
  return String(value || '').trim();
}

function cleanUrl(value = '') {
  const text = String(value || '').trim().replace(/\/+$/u, '');
  try {
    return new URL(text).toString().replace(/\/+$/u, '');
  } catch {
    return '';
  }
}

function parseJson(text = '') {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function safeProviderError(data = {}) {
  if (!data || typeof data !== 'object') return null;
  return String(data.message || data.error_description || data.error || data.code || data.raw || '').slice(0, 240) || null;
}

function safePlainText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240);
}

function isoWithoutMillis(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString().replace(/\.\d{3}Z$/u, 'Z') : date.toISOString().replace(/\.\d{3}Z$/u, 'Z');
}

function isNonProductionUrl(value = '') {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'localhost'
      || host === '127.0.0.1'
      || host.endsWith('.test')
      || host.includes('staging')
      || host.includes('nonprod')
      || host.includes('sandbox')
      || host.includes('railway.app');
  } catch {
    return false;
  }
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitFixtureList(value = '') {
  return new Set(
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}
