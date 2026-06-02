import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMockMeetingCleanupAdapter,
  createMockMeetingAdapter,
  createMockEnrollmentGateAdapter,
  createMockPaymentAdapter,
  emailMedMailNotificationAdapter,
  enrollmentGateAdapter,
  googleCalendarBusySyncAdapter,
  smsNotificationProviderAdapter,
  stripePaymentAdapter,
  webexMeetingLinkAdapter,
  zoomMeetingCleanupAdapter,
  zoomMeetingLinkAdapter,
} from '../missionmed-hq/lib/scheduler/adapters.mjs';
import { createMemorySchedulerRepository } from '../missionmed-hq/lib/scheduler/persistence.mjs';
import { handleSchedulerApiRoute } from '../missionmed-hq/lib/scheduler/routes.mjs';

const APPOINTMENT_TYPE = {
  id: 'type-dr-j',
  status: 'active',
  active: true,
  duration_minutes: 30,
  min_notice_minutes: 0,
  max_booking_window_days: 365,
};

const DR_BRIAN_WEBEX_APPOINTMENT_TYPE = {
  ...APPOINTMENT_TYPE,
  id: 'type-mission-residency-dr-brian',
  slug: 'mission-residency-dr-brian',
  name: 'Mission Residency 1-on-1 Advising',
  metadata: {
    division: 'mission-residency',
    web_meetings: {
      provider: 'webex',
      auto_generate: true,
      provider_account_id: 'dr-brian-webex@example.test',
      send_invitee_email: true,
    },
    notifications: {
      student_booked_email: true,
      admin_booked_email: false,
    },
  },
};

const DR_J_ZOOM_APPOINTMENT_TYPE = {
  ...APPOINTMENT_TYPE,
  id: 'type-dr-j-examprep',
  slug: 'dr-j-examprep',
  name: 'ExamPrep 1-on-1 with Dr. J',
  metadata: {
    division: 'exam-prep',
    web_meetings: {
      provider: 'zoom',
      auto_generate: true,
      provider_account_id: 'dr-j-zoom@example.test',
    },
    notifications: {
      student_booked_email: false,
      admin_booked_email: false,
    },
  },
};

const FUTURE_FIXTURE_START = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
FUTURE_FIXTURE_START.setUTCHours(14, 0, 0, 0);
const FUTURE_FIXTURE_END = new Date(FUTURE_FIXTURE_START.getTime() + 30 * 60 * 1000);
const FUTURE_FIXTURE_SECOND_START = new Date(FUTURE_FIXTURE_START.getTime() + 60 * 60 * 1000);
const FUTURE_FIXTURE_SECOND_END = new Date(FUTURE_FIXTURE_SECOND_START.getTime() + 30 * 60 * 1000);
const FUTURE_FIXTURE_DAY_START = new Date(FUTURE_FIXTURE_START);
FUTURE_FIXTURE_DAY_START.setUTCHours(0, 0, 0, 0);
const FUTURE_FIXTURE_DAY_END = new Date(FUTURE_FIXTURE_START);
FUTURE_FIXTURE_DAY_END.setUTCHours(23, 59, 59, 999);
const BOOKING_START_AT = FUTURE_FIXTURE_START.toISOString();
const BOOKING_END_AT = FUTURE_FIXTURE_END.toISOString();
const SECOND_BOOKING_START_AT = FUTURE_FIXTURE_SECOND_START.toISOString();
const SECOND_BOOKING_END_AT = FUTURE_FIXTURE_SECOND_END.toISOString();
const CALENDAR_FEED_PATH = `/api/scheduler/calendar-feed?start=${encodeURIComponent(FUTURE_FIXTURE_DAY_START.toISOString())}&end=${encodeURIComponent(FUTURE_FIXTURE_DAY_END.toISOString())}`;

function session(overrides = {}) {
  return {
    supabaseUserId: 'student-a',
    csrfToken: 'csrf-token',
    user: {
      id: 101,
      wpUserId: 101,
      email: 'student-a@example.test',
      login: 'student-login',
      displayName: 'Student A',
      roles: ['student'],
    },
    ...overrides,
  };
}

function providerSession(overrides = {}) {
  return session({
    supabaseUserId: 'provider-user-a',
    schedulerProviderId: 'provider-a',
    user: {
      id: 201,
      wpUserId: 201,
      email: 'provider@example.test',
      login: 'provider-login',
      displayName: 'Provider A',
      roles: ['provider'],
    },
    ...overrides,
  });
}

function adminSession() {
  return session({
    supabaseUserId: 'admin-a',
    user: {
      id: 301,
      wpUserId: 301,
      email: 'admin@example.test',
      login: 'admin-login',
      displayName: 'Admin A',
      roles: ['hq_admin'],
    },
  });
}

function repository(seed = {}) {
  return createMemorySchedulerRepository({
    seed: {
      appointmentTypes: [APPOINTMENT_TYPE],
      providers: [{ id: 'provider-a', active: true, status: 'active' }],
      ...seed,
    },
  });
}

async function callRoute({
  path,
  method = 'GET',
  body = {},
  authSession = session(),
  repo = repository(),
  csrf = 'csrf-token',
  enrollmentDecision = 'eligible',
  schedulerAdapters = {},
} = {}) {
  const response = {
    status: null,
    payload: null,
    headers: null,
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
    },
    end(bodyText = '') {
      this.body = bodyText;
    },
  };
  const request = {
    method,
    headers: csrf ? { 'x-mmhq-csrf': csrf } : {},
  };
  const url = new URL(path, 'http://scheduler.test');
  await handleSchedulerApiRoute(request, response, url, {
    session: authSession,
    authHeaders: {},
    schedulerRepository: repo,
    sendJson(res, status, payload, headers = {}) {
      res.status = status;
      res.payload = payload;
      res.headers = headers;
    },
    sendMethodNotAllowed(res, methods) {
      res.status = 405;
      res.payload = { ok: false, error: 'method_not_allowed', methods };
    },
    readJsonBody: async () => body,
    validateCsrf: (req, sess) => req.headers['x-mmhq-csrf'] === sess?.csrfToken,
    schedulerAdapters: {
      enrollmentGateAdapter: createMockEnrollmentGateAdapter(enrollmentDecision),
      ...schedulerAdapters,
    },
  });
  return response;
}

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
  };
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function futureMondayDateKey() {
  const date = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  date.setUTCHours(0, 0, 0, 0);
  while (date.getUTCDay() !== 1) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

function adminGridRule(weekStart) {
  return {
    id: 'rule-admin-grid-a',
    provider_id: 'provider-a',
    appointment_type_id: 'type-dr-j',
    rule_type: 'weekly',
    day_of_week: [1],
    start_time: '09:00:00',
    end_time: '10:00:00',
    timezone: 'America/New_York',
    effective_start: weekStart,
    effective_end: weekStart,
    status: 'active',
    active: true,
  };
}

test('missing auth is rejected before scheduler bootstrap data is returned', async () => {
  const response = await callRoute({ path: '/api/scheduler/bootstrap', authSession: null });
  assert.equal(response.status, 401);
  assert.equal(response.payload.error, 'authentication_required');
});

test('admin route rejects non-admin session', async () => {
  const response = await callRoute({ path: '/api/scheduler/admin/appointments', authSession: session() });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error, 'admin_required');
});

test('student booking route uses server identity instead of request student id', async () => {
  const repo = repository();
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    body: {
      student_user_id: 'student-b',
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-a',
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.result.appointment.student_user_id, 'student-a');
});

test('student calendar feed returns only current student scheduler events in range', async () => {
  const repo = repository({
    providers: [{ id: 'provider-a', active: true, status: 'active', display_name: 'Dr. Test' }],
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      name: '1-on-1 Advising',
      metadata: { division: 'mission-residency' },
    }],
  });

  await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-calendar-feed-a',
    },
  });
  await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    authSession: session({
      supabaseUserId: 'student-b',
      user: {
        id: 102,
        wpUserId: 102,
        email: 'student-b@example.test',
        login: 'student-b-login',
        displayName: 'Student B',
        roles: ['student'],
      },
    }),
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: SECOND_BOOKING_START_AT,
      end_at: SECOND_BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-calendar-feed-b',
    },
  });

  const response = await callRoute({
    path: CALENDAR_FEED_PATH,
    repo,
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.events.length, 1);
  assert.equal(response.payload.data.events[0].source, 'scheduler');
  assert.equal(response.payload.data.events[0].title, '1-on-1 Advising with Dr. Test');
  assert.equal(response.payload.data.events[0].category, 'mission-residency');
  assert.equal(response.payload.data.events[0].meta_json.can_cancel, true);
});

test('student booking route blocks ineligible enrollment decision', async () => {
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    enrollmentDecision: { status: 'ineligible', eligible: false, reason: 'missing_enrollment' },
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-ineligible',
    },
  });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error, 'scheduler_eligibility_required');
});

test('student booking route fails closed when enrollment bridge is not configured', async () => {
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    enrollmentDecision: { status: 'not_configured', eligible: false, reason: 'enrollment_bridge_not_configured' },
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-unknown-eligibility',
    },
  });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error, 'scheduler_eligibility_not_configured');
});

test('student booking route permits controlled launch allowlist by server identity and appointment type scope', async () => {
  const originalEnv = {
    mode: process.env.SCHEDULER_LAUNCH_ENROLLMENT_MODE,
    logins: process.env.SCHEDULER_LAUNCH_ELIGIBLE_LOGINS,
    slugs: process.env.SCHEDULER_LAUNCH_ELIGIBLE_APPOINTMENT_TYPE_SLUGS,
  };
  process.env.SCHEDULER_LAUNCH_ENROLLMENT_MODE = 'allowlist';
  process.env.SCHEDULER_LAUNCH_ELIGIBLE_LOGINS = 'student-login';
  process.env.SCHEDULER_LAUNCH_ELIGIBLE_APPOINTMENT_TYPE_SLUGS = 'launch-consult';
  try {
    const repo = repository({
      appointmentTypes: [{ ...APPOINTMENT_TYPE, slug: 'launch-consult' }],
    });
    const response = await callRoute({
      path: '/api/scheduler/book',
      method: 'POST',
      repo,
      schedulerAdapters: { enrollmentGateAdapter },
      body: {
        appointment_type_id: 'type-dr-j',
        provider_id: 'provider-a',
        start_at: BOOKING_START_AT,
        end_at: BOOKING_END_AT,
        timezone: 'America/New_York',
        idempotency_key: 'route-book-launch-allowlist',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.payload.data.result.appointment.student_user_id, 'student-a');
  } finally {
    restoreEnv('SCHEDULER_LAUNCH_ENROLLMENT_MODE', originalEnv.mode);
    restoreEnv('SCHEDULER_LAUNCH_ELIGIBLE_LOGINS', originalEnv.logins);
    restoreEnv('SCHEDULER_LAUNCH_ELIGIBLE_APPOINTMENT_TYPE_SLUGS', originalEnv.slugs);
  }
});

test('student booking route keeps launch allowlist closed for unscoped appointment types', async () => {
  const originalEnv = {
    mode: process.env.SCHEDULER_LAUNCH_ENROLLMENT_MODE,
    logins: process.env.SCHEDULER_LAUNCH_ELIGIBLE_LOGINS,
    slugs: process.env.SCHEDULER_LAUNCH_ELIGIBLE_APPOINTMENT_TYPE_SLUGS,
  };
  process.env.SCHEDULER_LAUNCH_ENROLLMENT_MODE = 'allowlist';
  process.env.SCHEDULER_LAUNCH_ELIGIBLE_LOGINS = 'student-login';
  process.env.SCHEDULER_LAUNCH_ELIGIBLE_APPOINTMENT_TYPE_SLUGS = 'different-launch-type';
  try {
    const repo = repository({
      appointmentTypes: [{ ...APPOINTMENT_TYPE, slug: 'launch-consult' }],
    });
    const response = await callRoute({
      path: '/api/scheduler/book',
      method: 'POST',
      repo,
      schedulerAdapters: { enrollmentGateAdapter },
      body: {
        appointment_type_id: 'type-dr-j',
        provider_id: 'provider-a',
        start_at: BOOKING_START_AT,
        end_at: BOOKING_END_AT,
        timezone: 'America/New_York',
        idempotency_key: 'route-book-launch-closed-type',
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.payload.error, 'scheduler_eligibility_required');
  } finally {
    restoreEnv('SCHEDULER_LAUNCH_ENROLLMENT_MODE', originalEnv.mode);
    restoreEnv('SCHEDULER_LAUNCH_ELIGIBLE_LOGINS', originalEnv.logins);
    restoreEnv('SCHEDULER_LAUNCH_ELIGIBLE_APPOINTMENT_TYPE_SLUGS', originalEnv.slugs);
  }
});

test('registered users can book non-member consult through server entitlement model', async () => {
  const repo = repository({
    appointmentTypes: [{ ...APPOINTMENT_TYPE, slug: 'consult-non-member' }],
  });
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    schedulerAdapters: { enrollmentGateAdapter },
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-non-member-consult',
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.result.appointment.student_user_id, 'student-a');
});

test('360 course entitlement can book Mission Residency one-on-one server-side', async () => {
  const repo = repository({
    appointmentTypes: [{ ...APPOINTMENT_TYPE, slug: 'mission-residency-1-on-1-advising' }],
  });
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    authSession: session({ schedulerEntitlements: { course_ids: ['3893'] } }),
    schedulerAdapters: { enrollmentGateAdapter },
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-360-one-on-one',
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.result.appointment.student_user_id, 'student-a');
});

test('Mission Residency daily limit blocks a second Dr. Brian 360 booking on the same day', async () => {
  const appointmentType = {
    ...APPOINTMENT_TYPE,
    id: 'type-mr-360',
    slug: 'mission-residency-1-on-1-advising',
    duration_minutes: 120,
    capacity: 1,
    metadata: {
      division: 'mission-residency',
      quota_bucket: 'mission_residency_1_on_1',
      missionmed_360_daily_limit: {
        enabled: true,
        limit: 1,
        unit: 'day',
      },
    },
  };
  const otherMissionType = {
    ...appointmentType,
    id: 'type-mr-personal-statement',
    slug: 'mission-residency-personal-statement',
  };
  const repo = repository({
    appointmentTypes: [appointmentType, otherMissionType],
    providers: [{ id: 'provider-brian', active: true, status: 'active' }],
  });
  repo.store.appointments.push({
    id: 'appt-existing-mr-360',
    student_user_id: 'student-existing',
    appointment_type_id: otherMissionType.id,
    provider_id: 'provider-brian',
    start_at: '2030-06-03T14:00:00.000Z',
    end_at: '2030-06-03T16:00:00.000Z',
    timezone: 'America/New_York',
    status: 'booked',
  });

  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    body: {
      appointment_type_id: appointmentType.id,
      provider_id: 'provider-brian',
      start_at: '2030-06-03T20:00:00.000Z',
      end_at: '2030-06-03T22:00:00.000Z',
      timezone: 'America/New_York',
      idempotency_key: 'route-book-mr-360-daily-limit',
    },
  });

  assert.equal(response.status, 409);
  assert.equal(response.payload.error, 'scheduler_daily_limit_reached');
  assert.equal(repo.store.appointments.length, 1);
});

test('Match Prep Pro entitlement cannot book Mission Residency one-on-one', async () => {
  const repo = repository({
    appointmentTypes: [{ ...APPOINTMENT_TYPE, slug: 'mission-residency-1-on-1-advising' }],
  });
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    authSession: session({ schedulerEntitlements: { course_ids: ['5227'] } }),
    schedulerAdapters: { enrollmentGateAdapter },
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-mpp-one-on-one-blocked',
    },
  });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error, 'scheduler_eligibility_required');
});

test('Match Prep Pro entitlement can book Mission Residency small group', async () => {
  const repo = repository({
    appointmentTypes: [{ ...APPOINTMENT_TYPE, slug: 'mission-residency-small-group-advising' }],
  });
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    authSession: session({ schedulerEntitlements: { course_ids: ['5227'] } }),
    schedulerAdapters: { enrollmentGateAdapter },
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-mpp-small-group',
    },
  });
  assert.equal(response.status, 200);
});

test('client-supplied entitlement claims do not unlock restricted booking', async () => {
  const repo = repository({
    appointmentTypes: [{ ...APPOINTMENT_TYPE, slug: 'mission-residency-1-on-1-advising' }],
  });
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    schedulerAdapters: { enrollmentGateAdapter },
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      entitlements: { course_ids: ['3893'] },
      idempotency_key: 'route-book-browser-entitlement-spoof',
    },
  });
  assert.equal(response.status, 403);
  assert.match(response.payload.error, /scheduler_eligibility_/u);
});

test('admin override can book for a target student without enrollment adapter bypass on student route', async () => {
  const response = await callRoute({
    path: '/api/scheduler/admin/override-book',
    method: 'POST',
    authSession: adminSession(),
    enrollmentDecision: { status: 'not_configured', eligible: false },
    body: {
      reason: 'manual eligibility verified outside scheduler test',
      student_user_id: 'student-target',
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-admin-override-a',
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.result.appointment.student_user_id, 'student-target');
});

test('student mutation missing CSRF is rejected', async () => {
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    csrf: '',
    body: { idempotency_key: 'route-book-csrf' },
  });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error, 'csrf_validation_failed');
});

test('student appointment list filters private notes from response', async () => {
  const repo = repository();
  repo.store.appointments.push({
    id: 'appt-private',
    student_user_id: 'student-a',
    provider_id: 'provider-a',
    appointment_type_id: 'type-dr-j',
    start_at: BOOKING_START_AT,
    end_at: BOOKING_END_AT,
    status: 'booked',
    staff_notes: 'do not expose',
    private_notes: 'do not expose',
    metadata: { private_notes: 'hidden', public_note: 'ok' },
  });
  const response = await callRoute({ path: '/api/scheduler/my-appointments', repo });
  const appointment = response.payload.data.appointments[0];
  assert.equal(response.status, 200);
  assert.equal('staff_notes' in appointment, false);
  assert.equal('private_notes' in appointment, false);
  assert.deepEqual(appointment.metadata, { public_note: 'ok' });
});

test('provider route rejects unrelated provider appointment detail', async () => {
  const repo = repository();
  repo.store.appointments.push({
    id: 'appt-provider-a',
    student_user_id: 'student-a',
    provider_id: 'provider-a',
    appointment_type_id: 'type-dr-j',
    start_at: BOOKING_START_AT,
    end_at: BOOKING_END_AT,
    status: 'booked',
  });
  const response = await callRoute({
    path: '/api/scheduler/provider/appointment/appt-provider-a',
    authSession: providerSession({ schedulerProviderId: 'provider-b' }),
    repo,
  });
  assert.equal(response.status, 404);
  assert.equal(response.payload.error, 'scheduler_provider_appointment_not_found');
});

test('provider route fails closed when provider mapping is missing', async () => {
  const repo = repository();
  const response = await callRoute({
    path: '/api/scheduler/provider/my-schedule',
    authSession: providerSession({ schedulerProviderId: null }),
    repo,
  });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error, 'scheduler_provider_not_configured');
});

test('provider can add private note only to assigned appointment', async () => {
  const repo = repository();
  repo.store.appointments.push({
    id: 'appt-provider-a',
    student_user_id: 'student-a',
    provider_id: 'provider-a',
    appointment_type_id: 'type-dr-j',
    start_at: BOOKING_START_AT,
    end_at: BOOKING_END_AT,
    status: 'booked',
  });
  const response = await callRoute({
    path: '/api/scheduler/provider/notes',
    method: 'POST',
    authSession: providerSession(),
    repo,
    body: { appointment_id: 'appt-provider-a', note: 'Private note' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.result.appointment_id, 'appt-provider-a');
  assert.equal('note' in response.payload.data.result, false);
});

test('admin appointment list is available to HQ admin identity', async () => {
  const repo = repository();
  repo.store.appointments.push({
    id: 'appt-admin',
    student_user_id: 'student-a',
    provider_id: 'provider-a',
    appointment_type_id: 'type-dr-j',
    start_at: BOOKING_START_AT,
    end_at: BOOKING_END_AT,
    status: 'booked',
  });
  const response = await callRoute({
    path: '/api/scheduler/admin/appointments',
    authSession: adminSession(),
    repo,
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.appointments.length, 1);
});

test('admin audit log route exposes safe read-only audit rows', async () => {
  const repo = repository();
  repo.store.auditEvents.push({
    id: 'audit-1',
    entity_type: 'appointment',
    entity_id: 'appt-admin',
    action: 'appointment.booked',
    actor_type: 'student',
    actor_id: 'student-a',
    idempotency_key: 'idem-audit',
    before_json: { private_notes: 'hidden' },
    after_json: { private_notes: 'hidden' },
    created_at: BOOKING_START_AT,
  });
  const response = await callRoute({
    path: '/api/scheduler/admin/audit-log',
    authSession: adminSession(),
    repo,
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.events.length, 1);
  assert.equal(response.payload.data.events[0].target_id, 'appt-admin');
  assert.equal('before_json' in response.payload.data.events[0], false);
  assert.equal('after_json' in response.payload.data.events[0], false);
});

test('admin entitlement config route exposes server-side rule contract', async () => {
  const response = await callRoute({
    path: '/api/scheduler/admin/entitlements/config',
    authSession: adminSession(),
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.config.browser_eligibility_trusted, false);
  assert.equal(response.payload.data.config.credit_pools.length > 0, true);
  assert.equal(response.payload.data.config.appointment_type_rules.some((rule) => rule.slug === 'consult-non-member'), true);
});

test('student cannot read admin audit log route', async () => {
  const response = await callRoute({ path: '/api/scheduler/admin/audit-log', authSession: session() });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error, 'admin_required');
});

test('admin appointment type config route fails closed for student identity', async () => {
  const response = await callRoute({ path: '/api/scheduler/admin/appointment-types/type-dr-j/config', authSession: session() });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error, 'admin_required');
});

test('admin appointment type config route exposes safe not-configured integration statuses', async () => {
  const response = await callRoute({
    path: '/api/scheduler/admin/appointment-types/type-dr-j/config',
    authSession: adminSession(),
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.config.basics.name, '');
  assert.equal(response.payload.data.integrations.zoom, 'not_configured');
  assert.equal(response.payload.data.integrations.webex, 'not_configured');
  assert.equal(response.payload.data.integrations.stripe, 'not_configured');
  assert.equal(response.payload.data.integrations.email, 'not_configured');
  assert.equal(response.payload.data.integrations.sms, 'not_configured');
});

test('admin availability preview returns visual grid contract without publishing slots', async () => {
  const response = await callRoute({
    path: '/api/scheduler/admin/appointment-types/type-dr-j/availability-preview',
    method: 'POST',
    authSession: adminSession(),
    body: {
      provider_id: 'provider-a',
      start_mode: 'specific_start_times',
      slots: [{ day: 'Monday', start_time: '09:00', end_time: '10:00', status: 'draft' }],
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.status, 'preview');
  assert.equal(response.payload.data.preview.start_mode, 'specific_start_times');
  assert.equal(response.payload.data.preview.slots.length, 1);
});

test('admin availability grid returns persisted student-visible opening cells', async () => {
  const weekStart = futureMondayDateKey();
  const repo = repository({ availabilityRules: [adminGridRule(weekStart)] });
  const response = await callRoute({
    path: `/api/scheduler/admin/availability-grid?provider_id=provider-a&appointment_type_id=type-dr-j&week_start=${weekStart}&timezone=America%2FNew_York`,
    authSession: adminSession(),
    repo,
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.provider.id, 'provider-a');
  assert.equal(response.payload.data.appointment_type.id, 'type-dr-j');
  assert.equal(response.payload.data.cells.some((cell) => cell.status === 'open' && cell.time_label === '9:00 AM'), true);
});

test('admin availability cell close blocks the same slot from student availability', async () => {
  const weekStart = futureMondayDateKey();
  const repo = repository({ availabilityRules: [adminGridRule(weekStart)] });
  const grid = await callRoute({
    path: `/api/scheduler/admin/availability-grid?provider_id=provider-a&appointment_type_id=type-dr-j&week_start=${weekStart}&timezone=America%2FNew_York`,
    authSession: adminSession(),
    repo,
  });
  const cell = grid.payload.data.cells.find((item) => item.status === 'open' && item.time_label === '9:00 AM');
  assert.ok(cell);

  const before = await callRoute({
    path: `/api/scheduler/availability?provider_id=provider-a&appointment_type_id=type-dr-j&start_date=${encodeURIComponent(cell.start_at)}&end_date=${encodeURIComponent(new Date(Date.parse(cell.start_at) + 60 * 60_000).toISOString())}&timezone=America%2FNew_York`,
    repo,
  });
  assert.equal(before.status, 200);
  assert.equal(before.payload.data.slots.some((slot) => slot.startAt === cell.start_at || slot.start_at === cell.start_at), true);

  const close = await callRoute({
    path: '/api/scheduler/admin/availability-cell',
    method: 'POST',
    authSession: adminSession(),
    repo,
    body: {
      action: 'close',
      provider_id: 'provider-a',
      appointment_type_id: 'type-dr-j',
      start_at: cell.start_at,
      end_at: cell.end_at,
      timezone: 'America/New_York',
      reason: 'Closed by route test',
    },
  });
  assert.equal(close.status, 200);
  assert.equal(repo.blackouts.length, 1);

  const after = await callRoute({
    path: `/api/scheduler/availability?provider_id=provider-a&appointment_type_id=type-dr-j&start_date=${encodeURIComponent(cell.start_at)}&end_date=${encodeURIComponent(new Date(Date.parse(cell.start_at) + 60 * 60_000).toISOString())}&timezone=America%2FNew_York`,
    repo,
  });
  assert.equal(after.status, 200);
  assert.equal(after.payload.data.slots.some((slot) => slot.startAt === cell.start_at || slot.start_at === cell.start_at), false);
});

test('admin availability cell can repeat an open slot weekly through an end date', async () => {
  const weekStart = futureMondayDateKey();
  const repeatUntil = new Date(`${weekStart}T00:00:00.000Z`);
  repeatUntil.setUTCDate(repeatUntil.getUTCDate() + 21);
  const repo = repository({ availabilityRules: [] });
  const grid = await callRoute({
    path: `/api/scheduler/admin/availability-grid?provider_id=provider-a&appointment_type_id=type-dr-j&week_start=${weekStart}&timezone=America%2FNew_York`,
    authSession: adminSession(),
    repo,
  });
  const cell = grid.payload.data.cells.find((item) => item.status === 'closed' && item.time_label === '9:00 AM');
  assert.ok(cell);

  const response = await callRoute({
    path: '/api/scheduler/admin/availability-cell',
    method: 'POST',
    authSession: adminSession(),
    repo,
    body: {
      action: 'open',
      provider_id: 'provider-a',
      appointment_type_id: 'type-dr-j',
      start_at: cell.start_at,
      end_at: cell.end_at,
      timezone: 'America/New_York',
      repeat_weekly: true,
      repeat_until: repeatUntil.toISOString().slice(0, 10),
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.result.repeat_weekly, true);
  assert.equal(repo.availabilityRules.length, 1);
  assert.equal(repo.availabilityRules[0].rule_type, 'recurring');
  assert.equal(repo.availabilityRules[0].effective_end, repeatUntil.toISOString().slice(0, 10));
  assert.equal(repo.availabilityRules[0].metadata.repeat_weekly, true);

  const nextWeekStart = new Date(`${weekStart}T00:00:00.000Z`);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);
  const nextWeek = nextWeekStart.toISOString().slice(0, 10);
  const repeatedGrid = await callRoute({
    path: `/api/scheduler/admin/availability-grid?provider_id=provider-a&appointment_type_id=type-dr-j&week_start=${nextWeek}&timezone=America%2FNew_York`,
    authSession: adminSession(),
    repo,
  });
  assert.equal(repeatedGrid.status, 200);
  assert.equal(repeatedGrid.payload.data.cells.some((item) => item.status === 'open' && item.time_label === '9:00 AM'), true);
});

test('admin availability cell mutation refuses booked slots', async () => {
  const weekStart = futureMondayDateKey();
  const repo = repository({ availabilityRules: [adminGridRule(weekStart)] });
  const grid = await callRoute({
    path: `/api/scheduler/admin/availability-grid?provider_id=provider-a&appointment_type_id=type-dr-j&week_start=${weekStart}&timezone=America%2FNew_York`,
    authSession: adminSession(),
    repo,
  });
  const cell = grid.payload.data.cells.find((item) => item.status === 'open' && item.time_label === '9:00 AM');
  repo.store.appointments.push({
    id: 'appt-admin-grid-booked',
    student_user_id: 'student-a',
    provider_id: 'provider-a',
    appointment_type_id: 'type-dr-j',
    start_at: cell.start_at,
    end_at: cell.end_at,
    status: 'booked',
  });
  const response = await callRoute({
    path: '/api/scheduler/admin/availability-cell',
    method: 'POST',
    authSession: adminSession(),
    repo,
    body: {
      action: 'close',
      provider_id: 'provider-a',
      appointment_type_id: 'type-dr-j',
      start_at: cell.start_at,
      end_at: cell.end_at,
      timezone: 'America/New_York',
    },
  });
  assert.equal(response.status, 409);
  assert.equal(response.payload.error, 'scheduler_admin_grid_booked_slot_locked');
});

test('student cannot mutate admin availability cells', async () => {
  const response = await callRoute({
    path: '/api/scheduler/admin/availability-cell',
    method: 'POST',
    authSession: session(),
    body: {
      action: 'close',
      provider_id: 'provider-a',
      appointment_type_id: 'type-dr-j',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
    },
  });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error, 'admin_required');
});

test('student appointment type list redacts admin-only metadata while exposing student fields', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        instructions: 'Bring your questions.',
        staff_only: 'hidden',
        intake_fields: [
          { field_key: 'goals', label: 'Goals', field_type: 'textarea', required: true, visibility: 'student_and_staff' },
          { field_key: 'staff_note', label: 'Staff note', required: false, visibility: 'staff_only' },
        ],
        notifications: { admin_booked_email: true, private_template: 'hidden' },
      },
    }],
  });
  const response = await callRoute({ path: '/api/scheduler/appointment-types', repo });
  assert.equal(response.status, 200);
  const [type] = response.payload.data.types;
  assert.equal(type.metadata, undefined);
  assert.equal(type.student_config.instructions, 'Bring your questions.');
  assert.equal(type.student_config.intake_fields.length, 1);
  assert.equal(type.student_config.intake_fields[0].field_key, 'goals');
});

test('student booking is blocked when required custom intake field is missing', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        intake_fields: [
          { field_key: 'goals', label: 'Goals', field_type: 'textarea', required: true, visibility: 'student_and_staff' },
        ],
      },
    }],
  });
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-missing-intake',
      intake_answers: [],
    },
  });
  assert.equal(response.status, 400);
  assert.equal(response.payload.error, 'scheduler_required_intake_missing');
});

test('student booking is blocked when appointment type requires payment without server confirmation', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        payments: { mode: 'required', provider: 'stripe' },
      },
    }],
  });
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-payment-required',
    },
  });
  assert.equal(response.status, 402);
  assert.equal(response.payload.error, 'scheduler_payment_confirmation_required');
});

test('student booking does not trust browser payment confirmation when Stripe is not configured', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        payments: { mode: 'required', provider: 'stripe' },
      },
    }],
  });
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-payment-spoof',
      payment_intent_id: 'pi_browser_claim',
      payment_status: 'succeeded',
    },
  });
  assert.equal(response.status, 402);
  assert.equal(response.payload.error, 'scheduler_payment_not_configured');
});

test('server-confirmed payment allows paid appointment booking', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        payments: { mode: 'required', provider: 'stripe' },
      },
    }],
  });
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    schedulerAdapters: {
      stripePaymentAdapter: createMockPaymentAdapter('stripe', 'succeeded'),
    },
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-payment-confirmed',
      payment_intent_id: 'pi_test_confirmed',
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.result.appointment.student_user_id, 'student-a');
});

test('payment intent route fails closed when Stripe is not configured', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        payments: { mode: 'required', provider: 'stripe', amount_cents: 5000, currency: 'usd' },
      },
    }],
  });
  const response = await callRoute({
    path: '/api/scheduler/payments/intent',
    method: 'POST',
    repo,
    body: {
      appointment_type_id: 'type-dr-j',
      idempotency_key: 'route-payment-intent-not-configured',
    },
  });
  assert.equal(response.status, 402);
  assert.equal(response.payload.error, 'scheduler_payment_not_configured');
});

test('admin notification dispatcher sends due queued notifications through injected adapter', async () => {
  const repo = repository();
  repo.store.notifications.push({
    id: 'notification-due',
    appointment_id: 'appt-due',
    channel: 'email',
    template_key: 'scheduler_appointment_reminder',
    recipient_role: 'student',
    scheduled_at: '2026-05-20T13:00:00.000Z',
    status: 'pending',
    metadata: { recipient_email: 'student-a@example.test', meeting_url: 'https://example.test/meeting' },
  });
  const response = await callRoute({
    path: '/api/scheduler/admin/notifications/dispatch-due',
    method: 'POST',
    authSession: adminSession(),
    repo,
    schedulerAdapters: {
      emailMedMailNotificationAdapter: async () => ({ ok: true, status: 'sent', provider_message_id: 'msg-test' }),
    },
    body: {
      now: '2026-05-20T13:05:00.000Z',
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.dispatch.processed, 1);
  assert.equal(repo.store.notifications[0].status, 'sent');
  assert.equal(repo.store.notifications[0].provider_message_id, 'msg-test');
});

test('Zoom auto-generation stores meeting link and remains idempotent on retry', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        web_meetings: {
          provider: 'zoom',
          auto_generate: true,
          provider_account_id: 'zoom-provider@example.test',
        },
      },
    }],
  });
  const body = {
    appointment_type_id: 'type-dr-j',
    provider_id: 'provider-a',
    start_at: BOOKING_START_AT,
    end_at: BOOKING_END_AT,
    timezone: 'America/New_York',
    idempotency_key: 'route-book-zoom-created',
  };
  const schedulerAdapters = {
    zoomMeetingLinkAdapter: createMockMeetingAdapter('zoom', 'created'),
  };
  const first = await callRoute({ path: '/api/scheduler/book', method: 'POST', repo, schedulerAdapters, body });
  const notificationCount = repo.store.notifications.length;
  const second = await callRoute({ path: '/api/scheduler/book', method: 'POST', repo, schedulerAdapters, body });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(repo.store.appointments.length, 1);
  assert.equal(repo.store.notifications.length, notificationCount);
  assert.equal(repo.store.appointments[0].meeting_url, 'https://example.test/zoom/mock-meeting');
  assert.equal(repo.store.appointments[0].metadata.scheduler_integrations.meeting.external_event_id, 'zoom-mock-event');
  assert.equal(second.payload.data.integrations.idempotency_replay, true);

  const appointments = await callRoute({ path: '/api/scheduler/my-appointments', repo });
  assert.equal(appointments.status, 200);
  assert.equal(appointments.payload.data.appointments[0].metadata.scheduler_integrations.meeting.external_event_id, undefined);
});

test('Zoom-backed cancel invokes cleanup adapter with persisted external event id only', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        web_meetings: {
          provider: 'zoom',
          auto_generate: true,
          provider_account_id: 'zoom-provider@example.test',
        },
      },
    }],
  });
  const schedulerAdapters = {
    zoomMeetingLinkAdapter: createMockMeetingAdapter('zoom', 'created'),
  };
  const booking = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    schedulerAdapters,
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-zoom-cleanup-created',
    },
  });
  assert.equal(booking.status, 200);

  let cleanupPayload = null;
  const cancel = await callRoute({
    path: '/api/scheduler/cancel',
    method: 'POST',
    repo,
    schedulerAdapters: {
      ...schedulerAdapters,
      zoomMeetingCleanupAdapter: async (payload) => {
        cleanupPayload = payload;
        return createMockMeetingCleanupAdapter('zoom', 'deleted')(payload);
      },
    },
    body: {
      appointment_id: repo.store.appointments[0].id,
      idempotency_key: 'route-cancel-zoom-cleanup',
      meeting_url: 'https://spoofed.example.test/zoom/not-used',
      external_event_id: 'spoofed-external-id',
    },
  });

  assert.equal(cancel.status, 200);
  assert.equal(cleanupPayload.external_event_id, 'zoom-mock-event');
  assert.equal(cleanupPayload.meeting_url, undefined);
  assert.equal(cancel.payload.data.integrations.meeting.status, 'deleted');
  assert.equal(repo.store.appointments[0].metadata.scheduler_integrations.meeting.cleanup_status, 'deleted');
  assert.equal(repo.store.auditEvents.some((event) => event.action === 'scheduler.meeting.zoom.cleanup.success'), true);
});

test('non-Zoom cancel does not invoke Zoom cleanup adapter', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        web_meetings: {
          provider: 'webex',
          auto_generate: true,
          provider_account_id: 'webex-provider@example.test',
        },
      },
    }],
  });
  const schedulerAdapters = {
    webexMeetingLinkAdapter: createMockMeetingAdapter('webex', 'created'),
    zoomMeetingCleanupAdapter: async () => {
      throw new Error('Zoom cleanup should not run for Webex-backed appointments.');
    },
  };
  const booking = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    schedulerAdapters,
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-webex-no-zoom-cleanup',
    },
  });
  const cancel = await callRoute({
    path: '/api/scheduler/cancel',
    method: 'POST',
    repo,
    schedulerAdapters,
    body: {
      appointment_id: repo.store.appointments[0].id,
      idempotency_key: 'route-cancel-webex-no-zoom-cleanup',
    },
  });

  assert.equal(booking.status, 200);
  assert.equal(cancel.status, 200);
  assert.equal(cancel.payload.data.integrations.meeting.status, 'not_required');
  assert.equal(cancel.payload.data.integrations.meeting.provider, 'webex');
});

test('Dr. Brian Mission Residency booking routes to Webex invitee, student email, and calendar join metadata', async () => {
  const repo = repository({
    appointmentTypes: [DR_BRIAN_WEBEX_APPOINTMENT_TYPE],
    providers: [{ id: 'provider-brian', display_name: 'Dr. Brian', active: true, status: 'active' }],
  });
  let webexPayload = null;
  const emailPayloads = [];
  const schedulerAdapters = {
    webexMeetingLinkAdapter: async (payload) => {
      webexPayload = payload;
      return {
        ok: true,
        status: 'created',
        provider: 'webex',
        meeting_url: 'https://webex.example.test/join/dr-brian-055d',
        external_event_id: 'webex-meeting-055d',
        invitee_status: 'created',
        invitee_email_present: Boolean(payload.student_email),
        invitee_email_sent: payload.webex_invitee_send_email !== false,
        invitee_id: 'webex-invitee-055d',
      };
    },
    emailMedMailNotificationAdapter: async (payload) => {
      emailPayloads.push(payload);
      return { ok: true, status: 'sent', provider_message_id: `msg-${emailPayloads.length}` };
    },
    zoomMeetingLinkAdapter: async () => {
      throw new Error('Zoom must not run for Dr. Brian Webex booking.');
    },
  };

  const booking = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    schedulerAdapters,
    body: {
      appointment_type_id: DR_BRIAN_WEBEX_APPOINTMENT_TYPE.id,
      provider_id: 'provider-brian',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-dr-brian-webex-055d',
    },
  });

  assert.equal(booking.status, 200);
  assert.equal(webexPayload.student_email, 'student-a@example.test');
  assert.equal(webexPayload.student_display_name, 'Student A');
  assert.equal(webexPayload.provider_account_id, 'dr-brian-webex@example.test');
  assert.equal(webexPayload.title, 'MissionMed Appointment - Dr. Brian - Mission Residency 1-on-1 Advising');
  assert.equal(webexPayload.webex_invitee_send_email, true);
  assert.equal(booking.payload.data.integrations.meeting.provider, 'webex');
  assert.equal(booking.payload.data.integrations.meeting.invitee_email_present, true);
  assert.equal(booking.payload.data.integrations.meeting.invitee_email_sent, true);

  const appointment = repo.store.appointments[0];
  assert.equal(appointment.meeting_url, 'https://webex.example.test/join/dr-brian-055d');
  assert.equal(appointment.external_event_status, 'created');
  assert.equal(appointment.metadata.scheduler_integrations.meeting.meeting_provider, 'webex');
  assert.equal(appointment.metadata.scheduler_integrations.meeting.webex_join_url, 'https://webex.example.test/join/dr-brian-055d');
  assert.equal(appointment.metadata.scheduler_integrations.meeting.webex_meeting_id, 'webex-meeting-055d');
  assert.equal(appointment.metadata.scheduler_integrations.meeting.invitee_status, 'created');

  const studentEmail = emailPayloads.find((payload) => payload.template_key === 'scheduler_booking_confirmation');
  assert.ok(studentEmail);
  assert.equal(studentEmail.to_email, 'student-a@example.test');
  assert.equal(studentEmail.meeting_url, 'https://webex.example.test/join/dr-brian-055d');
  assert.equal(studentEmail.meeting_provider, 'webex');
  assert.equal(studentEmail.provider_name, 'Dr. Brian');

  const studentCalendar = await callRoute({ path: CALENDAR_FEED_PATH, repo, schedulerAdapters });
  assert.equal(studentCalendar.status, 200);
  assert.equal(studentCalendar.payload.data.events.length, 1);
  const studentEvent = studentCalendar.payload.data.events[0];
  assert.equal(studentEvent.meeting_url, 'https://webex.example.test/join/dr-brian-055d');
  assert.equal(studentEvent.meeting_platform, 'webex');
  assert.equal(studentEvent.join_button.label, 'Join Webex');
  assert.equal(studentEvent.join_button.url, 'https://webex.example.test/join/dr-brian-055d');
  assert.equal(studentEvent.meta_json.student_email, undefined);
  assert.equal(studentEvent.meta_json.meeting_url, 'https://webex.example.test/join/dr-brian-055d');

  const adminCalendar = await callRoute({
    path: CALENDAR_FEED_PATH.replace('/api/scheduler/calendar-feed', '/api/scheduler/admin/calendar-feed'),
    repo,
    authSession: adminSession(),
  });
  assert.equal(adminCalendar.status, 200);
  assert.equal(adminCalendar.payload.data.events[0].meeting_platform, 'webex');
  assert.equal(adminCalendar.payload.data.events[0].meta_json.student_email, 'student-a@example.test');

  const providerCalendar = await callRoute({
    path: CALENDAR_FEED_PATH.replace('/api/scheduler/calendar-feed', '/api/scheduler/provider/calendar-feed'),
    repo,
    authSession: providerSession({ schedulerProviderId: 'provider-brian' }),
  });
  assert.equal(providerCalendar.status, 200);
  assert.equal(providerCalendar.payload.data.events[0].join_button.label, 'Join Webex');
  assert.equal(providerCalendar.payload.data.events[0].meta_json.student_email, 'student-a@example.test');

  const otherStudent = await callRoute({
    path: CALENDAR_FEED_PATH,
    repo,
    authSession: session({
      supabaseUserId: 'student-b',
      user: {
        id: 102,
        wpUserId: 102,
        email: 'student-b@example.test',
        login: 'student-b',
        displayName: 'Student B',
        roles: ['student'],
      },
    }),
  });
  assert.equal(otherStudent.status, 200);
  assert.equal(otherStudent.payload.data.events.length, 0);

  const myAppointments = await callRoute({ path: '/api/scheduler/my-appointments', repo });
  const serialized = JSON.stringify(myAppointments.payload);
  assert.equal(serialized.includes('host_key'), false);
  assert.equal(serialized.includes('hostUrl'), false);
  assert.equal(serialized.includes('start_url'), false);
  assert.equal(serialized.includes('webex-meeting-055d'), false);
  assert.equal(serialized.includes('webex-invitee-055d'), false);
  assert.equal(serialized.includes('student-a@example.test'), false);
});

test('Dr. J ExamPrep booking remains Zoom scoped while Webex adapter is untouched', async () => {
  const repo = repository({
    appointmentTypes: [DR_J_ZOOM_APPOINTMENT_TYPE],
    providers: [{ id: 'provider-dr-j', display_name: 'Dr. J', active: true, status: 'active' }],
  });
  let zoomCount = 0;
  let webexCount = 0;
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    schedulerAdapters: {
      zoomMeetingLinkAdapter: async () => {
        zoomCount += 1;
        return {
          ok: true,
          status: 'created',
          provider: 'zoom',
          meeting_url: 'https://zoom.example.test/j/dr-j-055d',
          external_event_id: 'zoom-meeting-055d',
        };
      },
      webexMeetingLinkAdapter: async () => {
        webexCount += 1;
        throw new Error('Webex must not run for Dr. J Zoom booking.');
      },
    },
    body: {
      appointment_type_id: DR_J_ZOOM_APPOINTMENT_TYPE.id,
      provider_id: 'provider-dr-j',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-dr-j-zoom-055d',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(zoomCount, 1);
  assert.equal(webexCount, 0);
  assert.equal(repo.store.appointments[0].meeting_url, 'https://zoom.example.test/j/dr-j-055d');
  assert.equal(repo.store.appointments[0].metadata.scheduler_integrations.meeting.provider, 'zoom');
});

test('Webex failure keeps appointment but exposes pending join-link state without a fake button', async () => {
  const repo = repository({
    appointmentTypes: [DR_BRIAN_WEBEX_APPOINTMENT_TYPE],
    providers: [{ id: 'provider-brian', display_name: 'Dr. Brian', active: true, status: 'active' }],
  });
  const emailPayloads = [];
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    schedulerAdapters: {
      webexMeetingLinkAdapter: async () => ({
        ok: false,
        status: 'failed',
        provider: 'webex',
        message: 'Mock Webex outage.',
      }),
      emailMedMailNotificationAdapter: async (payload) => {
        emailPayloads.push(payload);
        return { ok: true, status: 'sent', provider_message_id: `msg-failed-${emailPayloads.length}` };
      },
    },
    body: {
      appointment_type_id: DR_BRIAN_WEBEX_APPOINTMENT_TYPE.id,
      provider_id: 'provider-brian',
      start_at: SECOND_BOOKING_START_AT,
      end_at: SECOND_BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-dr-brian-webex-failed-055d',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.data.integrations.meeting.status, 'failed');
  assert.equal(repo.store.appointments[0].meeting_url, null);
  assert.equal(repo.store.appointments[0].external_event_status, 'failed');
  assert.equal(repo.store.appointments[0].metadata.scheduler_integrations.meeting.meeting_create_status, 'failed');

  const studentEmail = emailPayloads.find((payload) => payload.template_key === 'scheduler_booking_confirmation');
  assert.ok(studentEmail);
  assert.equal(studentEmail.meeting_url, null);
  assert.equal(studentEmail.meeting_expected, true);

  const studentCalendar = await callRoute({
    path: `/api/scheduler/calendar-feed?start=${encodeURIComponent(FUTURE_FIXTURE_DAY_START.toISOString())}&end=${encodeURIComponent(new Date(FUTURE_FIXTURE_SECOND_END.getTime() + 60_000).toISOString())}`,
    repo,
  });
  assert.equal(studentCalendar.status, 200);
  assert.equal(studentCalendar.payload.data.events[0].meeting_url, null);
  assert.equal(studentCalendar.payload.data.events[0].join_button, null);
});

test('admin Zoom-backed cancel also invokes cleanup adapter', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        web_meetings: {
          provider: 'zoom',
          auto_generate: true,
          provider_account_id: 'zoom-provider@example.test',
        },
      },
    }],
  });
  const schedulerAdapters = {
    zoomMeetingLinkAdapter: createMockMeetingAdapter('zoom', 'created'),
  };
  await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    schedulerAdapters,
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-admin-zoom-cleanup-created',
    },
  });

  let cleanupCount = 0;
  const cancel = await callRoute({
    path: '/api/scheduler/admin/cancel',
    method: 'POST',
    repo,
    authSession: adminSession(),
    schedulerAdapters: {
      ...schedulerAdapters,
      zoomMeetingCleanupAdapter: async () => {
        cleanupCount += 1;
        return createMockMeetingCleanupAdapter('zoom', 'deleted')();
      },
    },
    body: {
      appointment_id: repo.store.appointments[0].id,
      idempotency_key: 'route-admin-cancel-zoom-cleanup',
    },
  });

  assert.equal(cancel.status, 200);
  assert.equal(cleanupCount, 1);
  assert.equal(cancel.payload.data.integrations.meeting.status, 'deleted');
});

test('Zoom auto-generation fails safely when provider account mapping is missing', async () => {
  const repo = repository({
    appointmentTypes: [{
      ...APPOINTMENT_TYPE,
      metadata: {
        web_meetings: {
          provider: 'zoom',
          auto_generate: true,
        },
      },
    }],
  });
  const response = await callRoute({
    path: '/api/scheduler/book',
    method: 'POST',
    repo,
    schedulerAdapters: {
      zoomMeetingLinkAdapter: async () => ({
        ok: false,
        status: 'provider_mapping_missing',
        adapter: 'zoom_meeting_link_creation',
        provider: 'zoom',
      }),
    },
    body: {
      appointment_type_id: 'type-dr-j',
      provider_id: 'provider-a',
      start_at: BOOKING_START_AT,
      end_at: BOOKING_END_AT,
      timezone: 'America/New_York',
      idempotency_key: 'route-book-zoom-mapping-missing',
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.integrations.meeting.status, 'provider_mapping_missing');
  assert.equal(repo.store.appointments[0].meeting_url, null);
});

test('external integration adapters fail closed until staging credentials are explicitly configured', async () => {
  const [google, zoom, zoomCleanup, webex, stripe, email, sms] = await Promise.all([
    googleCalendarBusySyncAdapter(),
    zoomMeetingLinkAdapter(),
    zoomMeetingCleanupAdapter({ external_event_id: 'zoom-test-event' }),
    webexMeetingLinkAdapter(),
    stripePaymentAdapter(),
    emailMedMailNotificationAdapter(),
    smsNotificationProviderAdapter(),
  ]);
  assert.equal(google.status, 'not_configured');
  assert.equal(zoom.status, 'not_configured');
  assert.equal(zoomCleanup.status, 'not_configured');
  assert.equal(webex.status, 'not_configured');
  assert.equal(stripe.status, 'not_configured');
  assert.equal(email.status, 'not_configured');
  assert.equal(sms.status, 'not_configured');
});

test('Zoom adapter creates meeting with explicit staging env and provider mapping', async () => {
  const calls = [];
  const zoom = await zoomMeetingLinkAdapter({
    provider_account_id: 'zoom-provider@example.test',
    start_at: BOOKING_START_AT,
    end_at: BOOKING_END_AT,
    timezone: 'America/New_York',
  }, {
    env: {
      SCHEDULER_ZOOM_ENABLED: 'true',
      SCHEDULER_ZOOM_ACCOUNT_ID: 'acct',
      SCHEDULER_ZOOM_CLIENT_ID: 'client',
      SCHEDULER_ZOOM_CLIENT_SECRET: 'secret',
    },
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).includes('/oauth/token')) return jsonResponse(200, { access_token: 'token' });
      return jsonResponse(201, { id: 123, join_url: 'https://zoom.test/j/123' });
    },
  });

  assert.equal(zoom.status, 'created');
  assert.equal(zoom.meeting_url, 'https://zoom.test/j/123');
  assert.equal(calls.length, 2);
});

test('Zoom cleanup adapter deletes meeting with explicit staging env and external event id', async () => {
  const calls = [];
  const cleanup = await zoomMeetingCleanupAdapter({
    external_event_id: '123456789',
  }, {
    env: {
      SCHEDULER_ZOOM_ENABLED: 'true',
      SCHEDULER_ZOOM_ACCOUNT_ID: 'acct',
      SCHEDULER_ZOOM_CLIENT_ID: 'client',
      SCHEDULER_ZOOM_CLIENT_SECRET: 'secret',
    },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), method: init.method });
      if (String(url).includes('/oauth/token')) return jsonResponse(200, { access_token: 'token' });
      return { ok: true, status: 204, text: async () => '' };
    },
  });

  assert.equal(cleanup.status, 'deleted');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, 'DELETE');
  assert.match(calls[1].url, /\/v2\/meetings\/123456789$/u);
});

test('Zoom cleanup adapter treats already-missing meetings as cleanup success', async () => {
  const cleanup = await zoomMeetingCleanupAdapter({
    external_event_id: 'missing-meeting',
  }, {
    env: {
      SCHEDULER_ZOOM_ENABLED: 'true',
      SCHEDULER_ZOOM_ACCOUNT_ID: 'acct',
      SCHEDULER_ZOOM_CLIENT_ID: 'client',
      SCHEDULER_ZOOM_CLIENT_SECRET: 'secret',
    },
    fetchImpl: async (url) => {
      if (String(url).includes('/oauth/token')) return jsonResponse(200, { access_token: 'token' });
      return jsonResponse(404, { code: 3001, message: 'Meeting does not exist.' });
    },
  });

  assert.equal(cleanup.ok, true);
  assert.equal(cleanup.status, 'already_missing');
});

test('Webex adapter reports API failure without exposing credentials', async () => {
  const webex = await webexMeetingLinkAdapter({
    provider_account_id: 'webex-provider@example.test',
    start_at: BOOKING_START_AT,
    end_at: BOOKING_END_AT,
  }, {
    env: {
      SCHEDULER_WEBEX_ENABLED: 'true',
      SCHEDULER_WEBEX_ACCESS_TOKEN: 'secret-token',
    },
    fetchImpl: async () => jsonResponse(500, { message: 'provider down' }),
  });

  assert.equal(webex.status, 'failed');
  assert.equal(webex.provider_error, 'provider down');
});

test('Webex adapter creates meeting invitee with student email through REST invitee endpoint', async () => {
  const calls = [];
  const webex = await webexMeetingLinkAdapter({
    provider_account_id: 'dr-brian-webex@example.test',
    student_email: 'student-a@example.test',
    student_display_name: 'Student A',
    title: 'WEBEX-TEST-DO-NOT-USE Dr Brian Scheduler Webex Booking',
    start_at: BOOKING_START_AT,
    end_at: BOOKING_END_AT,
    timezone: 'America/New_York',
    webex_invitee_send_email: true,
  }, {
    env: {
      SCHEDULER_WEBEX_ENABLED: 'true',
      SCHEDULER_WEBEX_ACCESS_TOKEN: 'secret-token',
    },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : null });
      if (String(url).endsWith('/v1/meetings')) {
        return jsonResponse(201, { id: 'webex-meeting-055d', webLink: 'https://webex.example.test/join/055d' });
      }
      if (String(url).endsWith('/v1/meetingInvitees')) {
        return jsonResponse(201, { id: 'webex-invitee-055d', email: 'student-a@example.test', meetingId: 'webex-meeting-055d' });
      }
      return jsonResponse(404, { message: 'unexpected endpoint' });
    },
  });

  assert.equal(webex.status, 'created');
  assert.equal(webex.meeting_url, 'https://webex.example.test/join/055d');
  assert.equal(webex.external_event_id, 'webex-meeting-055d');
  assert.equal(webex.invitee_status, 'created');
  assert.equal(webex.invitee_email_present, true);
  assert.equal(webex.invitee_email_sent, true);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/v1\/meetings$/u);
  assert.match(calls[1].url, /\/v1\/meetingInvitees$/u);
  assert.equal(calls[1].body.meetingId, 'webex-meeting-055d');
  assert.equal(calls[1].body.email, 'student-a@example.test');
  assert.equal(calls[1].body.displayName, 'Student A');
  assert.equal(calls[1].body.hostEmail, 'dr-brian-webex@example.test');
  assert.equal(calls[1].body.sendEmail, true);
});

test('mock meeting and payment adapters support staging-safe success and failure coverage', async () => {
  const zoomSuccess = await createMockMeetingAdapter('zoom', 'created')({});
  const webexFailure = await createMockMeetingAdapter('webex', 'failed')({});
  const stripeSuccess = await createMockPaymentAdapter('stripe', 'succeeded')({ payment_confirmation_id: 'test-confirmation' });
  const stripeBlocked = await createMockPaymentAdapter('stripe', 'not_configured')({});

  assert.equal(zoomSuccess.status, 'created');
  assert.equal(webexFailure.status, 'failed');
  assert.equal(stripeSuccess.ok, true);
  assert.equal(stripeBlocked.ok, false);
});
