import {
  generateAvailabilitySlots,
  normalizeSchedulerTimezone,
} from './engine.mjs';
import {
  assertSchedulerMutationIdentity,
  getSchedulerActor,
  safeSchedulerActor,
} from './auth.mjs';
import {
  createSchedulerRepository,
  normalizeSchedulerPersistenceError,
} from './persistence.mjs';
import {
  emailMedMailNotificationAdapter,
  enrollmentGateAdapter,
  googleCalendarBusySyncAdapter,
  googleCalendarEventAdapter,
  googleCalendarProviderMappingAdapter,
  googleMeetAdapter,
  icsInviteAdapter,
  manualMeetingLinkAdapter,
  paypalPaymentAdapter,
  smsNotificationProviderAdapter,
  ssaImportPreviewAdapter,
  stripePaymentAdapter,
  webexMeetingLinkAdapter,
  zoomMeetingCleanupAdapter,
  zoomMeetingLinkAdapter,
} from './adapters.mjs';
import {
  buildSchedulerEntitlementAdminConfig,
  decorateAppointmentTypesForEntitlements,
  schedulerEntitlementBootstrapSummary,
  schedulerEntitlementPolicySummary,
} from './entitlements.mjs';

export { getSchedulerActor } from './auth.mjs';

export const SCHEDULER_ROUTE_FAMILIES = {
  student: [
    'GET /api/scheduler/bootstrap',
    'GET /api/scheduler/providers',
    'GET /api/scheduler/appointment-types',
    'GET /api/scheduler/availability',
    'POST /api/scheduler/book',
    'POST /api/scheduler/reschedule',
    'POST /api/scheduler/cancel',
    'GET /api/scheduler/my-appointments',
    'GET /api/scheduler/my-appointment-history',
    'GET /api/scheduler/calendar-feed',
    'GET /api/scheduler/join/:appointmentId',
    'POST /api/scheduler/payments/intent',
    'POST /api/scheduler/payments/confirm',
  ],
  admin: [
    'GET /api/scheduler/admin/appointments',
    'GET /api/scheduler/admin/availability-grid',
    'POST /api/scheduler/admin/availability-cell',
    'CRUD /api/scheduler/admin/providers',
    'CRUD /api/scheduler/admin/resources',
    'CRUD /api/scheduler/admin/appointment-types',
    'CRUD /api/scheduler/admin/availability',
    'CRUD /api/scheduler/admin/blackouts',
    'CRUD /api/scheduler/admin/schedule-events',
    'POST /api/scheduler/admin/override-book',
    'POST /api/scheduler/admin/no-show',
    'POST /api/scheduler/admin/cancel',
    'POST /api/scheduler/admin/reschedule',
    'POST /api/scheduler/admin/notifications/dispatch-due',
    'GET /api/scheduler/admin/analytics',
    'GET /api/scheduler/admin/audit-log',
    'GET /api/scheduler/admin/entitlements/config',
    'PATCH /api/scheduler/admin/entitlements/config',
    'POST /api/scheduler/admin/import/ssa-preview',
    'GET /api/scheduler/admin/appointment-types/:id/config',
    'POST /api/scheduler/admin/appointment-types/:id/availability-preview',
    'POST /api/scheduler/admin/appointment-types/:id/availability-publish',
    'POST /api/scheduler/admin/appointment-types/:id/availability-unpublish',
    'POST /api/scheduler/admin/appointment-types/:id/intake-fields',
    'PATCH /api/scheduler/admin/appointment-types/:id/intake-fields/:fieldId',
    'POST /api/scheduler/admin/appointment-types/:id/notifications',
    'PATCH /api/scheduler/admin/appointment-types/:id/booking-flow',
    'PATCH /api/scheduler/admin/appointment-types/:id/web-meetings',
    'PATCH /api/scheduler/admin/appointment-types/:id/payments',
  ],
  provider: [
    'GET /api/scheduler/provider/my-schedule',
    'POST /api/scheduler/provider/block-time',
    'POST /api/scheduler/provider/unblock-time',
    'GET /api/scheduler/provider/appointment/:id',
    'POST /api/scheduler/provider/notes',
  ],
};

const ADMIN_CRUD_COLLECTIONS = new Set(['providers', 'resources', 'appointment-types', 'availability', 'blackouts', 'schedule-events']);
const STUDENT_MUTATION_PATHS = new Set(['/api/scheduler/book', '/api/scheduler/reschedule', '/api/scheduler/cancel']);
const ADMIN_MUTATION_PATHS = new Set(['/api/scheduler/admin/override-book', '/api/scheduler/admin/no-show', '/api/scheduler/admin/cancel', '/api/scheduler/admin/reschedule']);

export function isSchedulerApiPath(pathname = '') {
  return String(pathname || '').startsWith('/api/scheduler/');
}

export async function handleSchedulerApiRoute(request, response, url, context = {}) {
  const pathname = url.pathname;
  if (!isSchedulerApiPath(pathname)) {
    return false;
  }

  const sendJson = context.sendJson;
  const sendMethodNotAllowed = context.sendMethodNotAllowed;
  const readJsonBody = context.readJsonBody;
  const validateCsrf = context.validateCsrf;
  const session = context.session;
  const authHeaders = context.authHeaders || {};
  const repository = context.schedulerRepository || createSchedulerRepository(context.schedulerRepositoryOptions || {});
  const schedulerAdapters = context.schedulerAdapters || {};
  const enrollmentAdapter = schedulerAdapters.enrollmentGateAdapter || enrollmentGateAdapter;
  const paymentAdapter = schedulerAdapters.stripePaymentAdapter || stripePaymentAdapter;

  if (request.method === 'OPTIONS') {
    response.writeHead(204, authHeaders);
    response.end();
    return true;
  }

  const requiredRole = pathname.startsWith('/api/scheduler/admin/')
    ? 'admin'
    : pathname.startsWith('/api/scheduler/provider/')
      ? 'provider'
      : 'student';
  const actorResult = getSchedulerActor(session, requiredRole);
  if (!actorResult.ok) {
    sendJson(response, actorResult.status, schedulerError(actorResult.error, actorResult.message), authHeaders);
    return true;
  }

  if (isMutationMethod(request.method) && typeof validateCsrf === 'function' && !validateCsrf(request, session)) {
    sendJson(response, 403, schedulerError('csrf_validation_failed', 'Missing or invalid CSRF token.'), authHeaders);
    return true;
  }

  const actor = actorResult.actor;

  try {
    if (pathname === '/api/scheduler/bootstrap') {
      if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
      const repositoryStatus = repository.status();
      sendJson(response, 200, schedulerOk({
        status: repositoryStatus.configured ? 'ready' : 'not_configured',
        user: safeSchedulerActor(actor),
        repository: repositoryStatus,
        features: {
          can_book: true,
          can_reschedule: true,
          can_cancel: true,
          provider_routes_enabled: actor.isProvider,
          admin_routes_enabled: actor.isAdmin,
        },
        config: {
          api_base: '/api/scheduler',
          frontend_delivery: 'r2_cdn_wordpress_proxy_pending',
          mutations: 'railway_server_mediated_only',
          enrollment_policy: schedulerEnrollmentPolicySummary(),
          entitlements: schedulerEntitlementBootstrapSummary(actor),
        },
      }), authHeaders);
      return true;
    }

    if (pathname === '/api/scheduler/appointment-types') {
      if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
      const eligibility = await enrollmentAdapter({ studentUserId: actor.userId, studentWpUserId: actor.wpUserId, actor });
      const types = await repository.listAppointmentTypes(Object.fromEntries(url.searchParams.entries()));
      const sanitizedTypes = types.map(sanitizeAppointmentTypeForStudent);
      sendJson(response, 200, schedulerOk({
        status: 'ready',
        types: decorateAppointmentTypesForEntitlements(sanitizedTypes, actor),
        eligibility,
        entitlements: schedulerEntitlementBootstrapSummary(actor),
      }), authHeaders);
      return true;
    }

    if (pathname === '/api/scheduler/providers') {
      if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
      const providers = await repository.listProviders(Object.fromEntries(url.searchParams.entries()));
      sendJson(response, 200, schedulerOk({
        status: 'ready',
        providers,
        appointment_type_id: url.searchParams.get('appointment_type_id') || null,
      }), authHeaders);
      return true;
    }

    if (pathname === '/api/scheduler/availability') {
      if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
      const startDate = url.searchParams.get('start_date') || url.searchParams.get('start');
      const endDate = url.searchParams.get('end_date') || url.searchParams.get('end');
      if (!startDate || !endDate) {
        sendJson(response, 400, schedulerError('missing_date_range', 'start_date and end_date are required.'), authHeaders);
        return true;
      }
      const filters = Object.fromEntries(url.searchParams.entries());
      filters.start_date = startDate;
      filters.end_date = endDate;
      const appointmentTypes = await repository.listAppointmentTypes(filters);
      const appointmentType = appointmentTypes[0] || {
        id: filters.appointment_type_id || filters.appointmentTypeId || '',
        duration_minutes: 30,
        min_notice_minutes: 0,
        max_booking_window_days: 365,
      };
      const availabilityRules = await repository.listAvailabilityRules(filters);
      const blackouts = await repository.listBlackoutWindows(filters);
      const slots = typeof repository.generateAvailability === 'function'
        ? await repository.generateAvailability(filters)
        : generateAvailabilitySlots({
          availabilityRules,
          appointmentType,
          providerId: filters.provider_id || '',
          resourceId: filters.resource_id || '',
          startDate,
          endDate,
          blackouts,
          existingAppointments: [],
        });
      const busySync = await googleCalendarBusySyncAdapter();
      sendJson(response, 200, schedulerOk({
        status: 'ready',
        slots,
        timezone: normalizeSchedulerTimezone(url.searchParams.get('timezone')),
        integrations: { google_calendar_busy_sync: busySync.status },
      }), authHeaders);
      return true;
    }

    if (pathname === '/api/scheduler/my-appointments' || pathname === '/api/scheduler/my-appointment-history') {
      if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
      const history = pathname.endsWith('/my-appointment-history');
      const appointments = history
        ? await repository.listAppointmentHistory(actor, Object.fromEntries(url.searchParams.entries()))
        : await repository.listMyAppointments(actor, Object.fromEntries(url.searchParams.entries()));
      sendJson(response, 200, schedulerOk({
        status: 'ready',
        appointments,
        history,
        student_user_id: actor.userId,
      }), authHeaders);
      return true;
    }

    if (pathname === '/api/scheduler/calendar-feed') {
      if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
      const filters = Object.fromEntries(url.searchParams.entries());
      const [appointments, providers, appointmentTypes] = await Promise.all([
        repository.listMyAppointments(actor, filters),
        repository.listProviders({}),
        repository.listAppointmentTypes({}),
      ]);
      sendJson(response, 200, schedulerOk({
        status: 'ready',
        events: buildSchedulerCalendarFeedEvents(appointments, {
          providers,
          appointmentTypes,
          start: filters.start || filters.start_at || filters.startAt,
          end: filters.end || filters.end_at || filters.endAt,
        }),
      }), authHeaders);
      return true;
    }

    if (pathname.startsWith('/api/scheduler/join/')) {
      if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
      sendJson(response, 501, schedulerError('meeting_link_not_configured', 'Join links are scaffolded but not wired until meeting-link storage is approved.', {
        appointment_id: pathname.replace('/api/scheduler/join/', ''),
        status: 'not_configured',
      }), authHeaders);
      return true;
    }

    if (pathname === '/api/scheduler/payments/intent' || pathname === '/api/scheduler/payments/confirm') {
      if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
      const payload = await readBody(readJsonBody, request);
      const paymentResponse = await handleSchedulerPaymentRoute({
        pathname,
        payload,
        actor,
        repository,
        paymentAdapter,
        authHeaders,
        response,
        sendJson,
      });
      if (paymentResponse) return true;
    }

    if (STUDENT_MUTATION_PATHS.has(pathname)) {
      if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
      const payload = await readBody(readJsonBody, request);
      const idempotencyKey = String(payload.idempotency_key || payload.idempotencyKey || '').trim();
      if (!idempotencyKey) {
        sendJson(response, 400, schedulerError('idempotency_key_required', 'idempotency_key is required for scheduler mutations.'), authHeaders);
        return true;
      }
      const identityCheck = assertSchedulerMutationIdentity(actor, repository.status());
      if (!identityCheck.ok) {
        sendJson(response, identityCheck.status, schedulerError(identityCheck.error, identityCheck.message), authHeaders);
        return true;
      }
      const action = pathname.split('/').pop();
      let configCheck = { ok: true };
      if (action === 'book') {
        configCheck = await validateStudentBookingConfig({
          repository,
          payload,
          actor,
          paymentAdapter,
          authHeaders,
          response,
          sendJson,
        });
        if (!configCheck.ok) {
          return true;
        }
        const eligibility = await enrollmentAdapter({
          ...payload,
          appointmentType: configCheck.appointmentType,
          appointment_type: configCheck.appointmentType,
          studentUserId: actor.userId,
          studentWpUserId: actor.wpUserId,
          actor,
        });
        if (!eligibility?.eligible) {
          const code = eligibility?.status === 'not_configured'
            ? 'scheduler_eligibility_not_configured'
            : 'scheduler_eligibility_required';
          sendJson(response, 403, schedulerError(code, eligibility?.message || 'Student eligibility could not be confirmed for this appointment type.', {
            eligibility: safeEligibilityDecision(eligibility),
          }), authHeaders);
          return true;
        }
      }
      const mutationPayload = {
        ...payload,
        idempotency_key: idempotencyKey,
        idempotencyKey,
        student_user_id: actor.userId,
        studentUserId: actor.userId,
        student_wp_user_id: actor.wpUserId,
        studentWpUserId: actor.wpUserId,
      };
      const result = action === 'book'
        ? await repository.createAppointment({ actor, payload: mutationPayload })
        : action === 'reschedule'
          ? await repository.rescheduleAppointment({ actor, payload: mutationPayload })
          : await repository.cancelAppointment({ actor, payload: mutationPayload });
      const integrations = await runSchedulerPostMutationIntegrations({
        action,
        result,
        actor,
        payload: mutationPayload,
        appointmentType: configCheck.appointmentType,
        repository,
        schedulerAdapters,
      });
      const placeholders = await buildMutationPlaceholderSummary(action, result?.appointment?.id || result?.appointment_id, schedulerAdapters);
      sendJson(response, 200, schedulerOk({
        status: 'mutation_accepted',
        action,
        result,
        actor: safeSchedulerActor(actor),
        integrations,
        placeholders,
      }), authHeaders);
      return true;
    }

    if (pathname.startsWith('/api/scheduler/admin/')) {
      return await handleAdminSchedulerRoute({ request, response, url, actor, context: { ...context, repository } });
    }

    if (pathname.startsWith('/api/scheduler/provider/')) {
      return await handleProviderSchedulerRoute({ request, response, url, actor, context: { ...context, repository } });
    }

    sendJson(response, 404, schedulerError('scheduler_route_not_found', 'Scheduler route was not found.'), authHeaders);
    return true;
  } catch (error) {
    const normalized = normalizeSchedulerPersistenceError(error);
    sendJson(response, normalized.status, schedulerError(normalized.error, normalized.message, {
      status: normalized.status === 501 ? 'not_configured' : 'error',
      details: normalized.details,
    }), authHeaders);
    return true;
  }
}

async function handleAdminSchedulerRoute({ request, response, url, actor, context }) {
  const { pathname } = url;
  const { sendJson, sendMethodNotAllowed, readJsonBody, authHeaders = {}, repository, schedulerAdapters = {} } = context;

  if (pathname === '/api/scheduler/admin/availability-grid') {
    if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
    const grid = await buildAdminAvailabilityGrid({
      repository,
      filters: Object.fromEntries(url.searchParams.entries()),
    });
    sendJson(response, 200, schedulerOk({ status: 'ready', actor: safeSchedulerActor(actor), ...grid }), authHeaders);
    return true;
  }

  if (pathname === '/api/scheduler/admin/availability-cell') {
    if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
    const payload = await readBody(readJsonBody, request);
    const result = await mutateAdminAvailabilityCell({
      repository,
      actor,
      payload,
    });
    sendJson(response, 200, schedulerOk({ status: 'mutation_accepted', actor: safeSchedulerActor(actor), result }), authHeaders);
    return true;
  }

  if (pathname === '/api/scheduler/admin/import/ssa-preview') {
    if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
    const payload = await readBody(readJsonBody, request);
    const preview = typeof repository.ssaImportPreview === 'function'
      ? await repository.ssaImportPreview(payload)
      : await ssaImportPreviewAdapter(payload);
    sendJson(response, 200, schedulerOk({ status: 'dry_run', actor: safeSchedulerActor(actor), preview }), authHeaders);
    return true;
  }

  if (pathname === '/api/scheduler/admin/appointments') {
    if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
    const appointments = await repository.adminListAppointments(Object.fromEntries(url.searchParams.entries()));
    sendJson(response, 200, schedulerOk({ status: 'ready', appointments, filters: Object.fromEntries(url.searchParams.entries()) }), authHeaders);
    return true;
  }

  if (pathname === '/api/scheduler/admin/analytics') {
    if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
    sendJson(response, 200, schedulerOk({ status: 'placeholder', analytics: {}, message: 'Analytics waits for persisted scheduler usage data.' }), authHeaders);
    return true;
  }

  if (pathname === '/api/scheduler/admin/audit-log') {
    if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
    const events = await repository.adminListAuditLog(Object.fromEntries(url.searchParams.entries()));
    sendJson(response, 200, schedulerOk({
      status: 'ready',
      events: events.map(sanitizeAuditEventForAdmin),
      filters: Object.fromEntries(url.searchParams.entries()),
    }), authHeaders);
    return true;
  }

  if (pathname === '/api/scheduler/admin/entitlements/config') {
    if (!['GET', 'PATCH'].includes(request.method)) return methodNotAllowed(sendMethodNotAllowed, response, ['GET', 'PATCH']);
    const payload = request.method === 'PATCH' ? await readBody(readJsonBody, request) : {};
    sendJson(response, 200, schedulerOk({
      status: request.method === 'PATCH' ? 'contract_preview' : 'ready',
      actor: safeSchedulerActor(actor),
      config: buildSchedulerEntitlementAdminConfig(),
      requested_update: request.method === 'PATCH' ? sanitizeEntitlementConfigPatch(payload) : null,
      persistence: {
        status: 'not_configured',
        message: 'Live entitlement rule editing requires approved Scheduler settings persistence or Scheduler-only entitlement tables.',
      },
    }), authHeaders);
    return true;
  }

  if (pathname === '/api/scheduler/admin/notifications/dispatch-due') {
    if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
    const payload = await readBody(readJsonBody, request);
    const dispatch = await dispatchDueSchedulerNotifications({
      repository,
      schedulerAdapters,
      limit: payload.limit,
      now: payload.now || new Date(),
    });
    sendJson(response, 200, schedulerOk({ status: 'ready', actor: safeSchedulerActor(actor), dispatch }), authHeaders);
    return true;
  }

  if (ADMIN_MUTATION_PATHS.has(pathname)) {
    if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
    const payload = await readBody(readJsonBody, request);
    if (pathname === '/api/scheduler/admin/override-book' && !String(payload.reason || '').trim()) {
      sendJson(response, 400, schedulerError('override_reason_required', 'Admin override booking requires a reason.'), authHeaders);
      return true;
    }
    const action = pathname.split('/').pop();
    const mutationPayload = {
      ...payload,
      idempotency_key: payload.idempotency_key || payload.idempotencyKey || `admin-${action}-${payload.appointment_id || payload.appointmentId || Date.now()}`,
    };
      const result = action === 'override-book'
        ? await repository.createAppointment({ actor, payload: { ...mutationPayload, actorType: 'admin' } })
        : action === 'reschedule'
          ? await repository.rescheduleAppointment({ actor, payload: { ...mutationPayload, actorType: 'admin' } })
          : action === 'no-show'
            ? await repository.adminMarkNoShow({ actor, payload: mutationPayload })
            : await repository.cancelAppointment({ actor, payload: { ...mutationPayload, actorType: 'admin' } });
    const integrations = action === 'cancel'
      ? await runSchedulerPostMutationIntegrations({
        action,
        result,
        actor,
        payload: mutationPayload,
        repository,
        schedulerAdapters,
      })
      : null;
    sendJson(response, 200, schedulerOk({
      status: 'mutation_accepted',
      action,
      actor: safeSchedulerActor(actor),
      result,
      ...(integrations ? { integrations } : {}),
    }), authHeaders);
    return true;
  }

  const appointmentTypeConfigMatch = pathname.match(/^\/api\/scheduler\/admin\/appointment-types\/([^/]+)\/(config|availability-preview|availability-publish|availability-unpublish|intake-fields|notifications|booking-flow|web-meetings|payments)(?:\/([^/]+))?$/u);
  if (appointmentTypeConfigMatch) {
    return await handleAdminAppointmentTypeConfigRoute({
      request,
      response,
      url,
      actor,
      context,
      appointmentTypeId: appointmentTypeConfigMatch[1],
      section: appointmentTypeConfigMatch[2],
      childId: appointmentTypeConfigMatch[3] || null,
    });
  }

  const crudMatch = pathname.match(/^\/api\/scheduler\/admin\/([^/]+)(?:\/([^/]+))?$/u);
  if (crudMatch && ADMIN_CRUD_COLLECTIONS.has(crudMatch[1])) {
    const collection = crudMatch[1];
    const id = crudMatch[2] || null;
    const allowed = id ? ['GET', 'PUT', 'PATCH', 'DELETE'] : ['GET', 'POST'];
    if (!allowed.includes(request.method)) return methodNotAllowed(sendMethodNotAllowed, response, allowed);
    const payload = request.method === 'GET' ? {} : await readBody(readJsonBody, request);
    const result = await callAdminCrud(repository, collection, { method: request.method, id, payload });
    sendJson(response, 200, schedulerOk({ status: 'ready', collection, id, result }), authHeaders);
    return true;
  }

  sendJson(response, 404, schedulerError('scheduler_admin_route_not_found', 'Scheduler admin route was not found.'), authHeaders);
  return true;
}

async function buildAdminAvailabilityGrid({ repository, filters = {} } = {}) {
  const timezone = normalizeSchedulerTimezone(filters.timezone || 'America/New_York');
  const weekStart = normalizeWeekStart(filters.week_start || filters.weekStart || filters.start_date || filters.start);
  const providerId = String(filters.provider_id || filters.providerId || '').trim();
  const appointmentTypeId = String(filters.appointment_type_id || filters.appointmentTypeId || '').trim();
  const dateKeys = Array.from({ length: 7 }, (_, index) => addDaysToDateKey(weekStart, index));
  const startBoundary = zonedDateTimeToUtc(dateKeys[0], 0, timezone);
  const endBoundary = new Date(zonedDateTimeToUtc(dateKeys[6], 0, timezone).getTime() + 24 * 60 * 60_000);

  const [providers, appointmentTypes] = await Promise.all([
    repository.listProviders(providerId ? { provider_id: providerId } : {}),
    repository.listAppointmentTypes(appointmentTypeId ? { appointment_type_id: appointmentTypeId } : {}),
  ]);
  const provider = providerId ? providers.find((row) => String(row.id) === providerId) : providers[0];
  const appointmentType = appointmentTypeId ? appointmentTypes.find((row) => String(row.id) === appointmentTypeId) : appointmentTypes[0];
  const resolvedProviderId = providerId || provider?.id || '';
  const resolvedTypeId = appointmentTypeId || appointmentType?.id || '';

  if (!resolvedProviderId || !resolvedTypeId) {
    return {
      timezone,
      week_start: weekStart,
      provider: provider || null,
      appointment_type: appointmentType || null,
      providers,
      appointment_types: appointmentTypes,
      cells: [],
      appointments: [],
      message: 'Select a mentor and meeting type to load the admin availability grid.',
    };
  }

  const [availabilityRules, blackouts, appointments] = await Promise.all([
    repository.listAvailabilityRules({ provider_id: resolvedProviderId, appointment_type_id: resolvedTypeId }),
    repository.listBlackoutWindows({ provider_id: resolvedProviderId, appointment_type_id: resolvedTypeId }),
    typeof repository.adminListAppointments === 'function'
      ? repository.adminListAppointments({ provider_id: resolvedProviderId })
      : [],
  ]);

  const durationMinutes = positiveInteger(appointmentType?.duration_minutes ?? appointmentType?.durationMinutes, 30);
  const availabilitySlots = typeof repository.generateAvailability === 'function'
    ? await repository.generateAvailability({
      provider_id: resolvedProviderId,
      appointment_type_id: resolvedTypeId,
      start_date: startBoundary.toISOString(),
      end_date: endBoundary.toISOString(),
      timezone,
    })
    : generateAvailabilitySlots({
      availabilityRules,
      appointmentType,
      providerId: resolvedProviderId,
      startDate: startBoundary.toISOString(),
      endDate: endBoundary.toISOString(),
      blackouts,
      existingAppointments: appointments,
    });
  const activeAppointments = appointments
    .filter(isActiveAppointmentForGrid)
    .filter((row) => String(row.provider_id || row.providerId || '') === String(resolvedProviderId))
    .filter((row) => !resolvedTypeId || String(row.appointment_type_id || row.appointmentTypeId || '') === String(resolvedTypeId))
    .filter((row) => dateRangesOverlap(row.start_at || row.startAt, row.end_at || row.endAt, startBoundary.toISOString(), endBoundary.toISOString()))
    .sort((a, b) => String(a.start_at || a.startAt || '').localeCompare(String(b.start_at || b.startAt || '')));

  const slotByStart = new Map((availabilitySlots || []).map((slot) => [String(slot.startAt || slot.start_at || ''), slot]));
  const cells = [];
  for (const dateKey of dateKeys) {
    for (let minutes = 8 * 60; minutes <= 19 * 60 + 30; minutes += 30) {
      const start = zonedDateTimeToUtc(dateKey, minutes, timezone);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const appointment = activeAppointments.find((row) => dateRangesOverlap(row.start_at || row.startAt, row.end_at || row.endAt, startIso, endIso));
      const blackout = appointment ? null : firstMatchingBlackout(blackouts, { providerId: resolvedProviderId, appointmentTypeId: resolvedTypeId, startIso, endIso });
      const slot = appointment || blackout ? null : slotByStart.get(startIso);
      const status = appointment
        ? 'booked'
        : blackout
          ? blackoutGridStatus(blackout)
          : slot
            ? 'open'
            : 'closed';

      cells.push({
        id: `${resolvedProviderId}:${resolvedTypeId}:${startIso}`,
        date: dateKey,
        label: `${dateKey} ${minutesToClockLabel(minutes)}`,
        time_label: minutesToClockLabel(minutes),
        start_at: startIso,
        end_at: endIso,
        timezone,
        provider_id: resolvedProviderId,
        appointment_type_id: resolvedTypeId,
        status,
        source: appointment ? 'appointment' : blackout ? 'blackout' : slot ? 'availability_rule' : 'none',
        can_toggle: !appointment,
        appointment_id: appointment?.id || appointment?.appointment_id || null,
        appointment: appointment ? sanitizeGridAppointment(appointment) : null,
        blackout_id: blackout?.id || null,
        blackout_reason: blackout?.reason || null,
      });
    }
  }

  return {
    timezone,
    week_start: weekStart,
    week_end: dateKeys[6],
    provider: provider || null,
    appointment_type: appointmentType || null,
    providers,
    appointment_types: appointmentTypes,
    cells,
    appointments: activeAppointments.map(sanitizeGridAppointment),
  };
}

async function mutateAdminAvailabilityCell({ repository, actor, payload = {} } = {}) {
  const action = String(payload.action || '').trim().toLowerCase();
  const allowedActions = new Set(['open', 'close', 'reserve', 'blackout', 'clear']);
  if (!allowedActions.has(action)) {
    throw schedulerPersistenceStyleError('scheduler_admin_grid_action_invalid', 'A valid slot action is required.', 400);
  }

  const providerId = String(payload.provider_id || payload.providerId || '').trim();
  const appointmentTypeId = String(payload.appointment_type_id || payload.appointmentTypeId || '').trim();
  const startIso = normalizeIso(payload.start_at || payload.startAt);
  const endIso = normalizeIso(payload.end_at || payload.endAt);
  const timezone = normalizeSchedulerTimezone(payload.timezone || 'America/New_York');
  const repeatWeekly = action === 'open' && coerceBoolean(payload.repeat_weekly ?? payload.repeatWeekly);
  const repeatUntil = repeatWeekly
    ? parseDateKey(payload.repeat_until || payload.repeatUntil || payload.effective_end || payload.effectiveEnd)
    : '';
  if (!providerId || !appointmentTypeId || !startIso || !endIso) {
    throw schedulerPersistenceStyleError('scheduler_admin_grid_cell_invalid', 'provider_id, appointment_type_id, start_at, and end_at are required.', 400);
  }
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    throw schedulerPersistenceStyleError('scheduler_admin_grid_range_invalid', 'The slot end time must be after the start time.', 400);
  }

  const [providers, appointmentTypes, appointments, blackouts, availabilityRules] = await Promise.all([
    repository.listProviders({ provider_id: providerId }),
    repository.listAppointmentTypes({ appointment_type_id: appointmentTypeId }),
    typeof repository.adminListAppointments === 'function' ? repository.adminListAppointments({ provider_id: providerId }) : [],
    repository.listBlackoutWindows({ provider_id: providerId, appointment_type_id: appointmentTypeId }),
    repository.listAvailabilityRules({ provider_id: providerId, appointment_type_id: appointmentTypeId }),
  ]);
  const provider = providers.find((row) => String(row.id) === providerId);
  const appointmentType = appointmentTypes.find((row) => String(row.id) === appointmentTypeId);
  if (!provider) throw schedulerPersistenceStyleError('scheduler_admin_grid_provider_not_found', 'The selected mentor was not found.', 404);
  if (!appointmentType) throw schedulerPersistenceStyleError('scheduler_admin_grid_type_not_found', 'The selected appointment type was not found.', 404);

  const lockedAppointment = appointments
    .filter(isActiveAppointmentForGrid)
    .find((row) => String(row.provider_id || row.providerId || '') === providerId
      && dateRangesOverlap(row.start_at || row.startAt, row.end_at || row.endAt, startIso, endIso));
  if (lockedAppointment) {
    throw schedulerPersistenceStyleError('scheduler_admin_grid_booked_slot_locked', 'Booked slots open appointment details and cannot be toggled from the availability grid.', 409, {
      appointment_id: lockedAppointment.id || null,
    });
  }

  const matchingBlackouts = (blackouts || []).filter((row) => matchingBusyBlock(row, { providerId, appointmentTypeId, startIso, endIso }));
  const matchingAdminRules = (availabilityRules || []).filter((row) => matchingAdminOneOffRule(row, { providerId, appointmentTypeId, startIso, endIso, timezone }));
  const nowIso = new Date().toISOString();
  const mutations = [];

  if (action === 'open' || action === 'clear') {
    mutations.push(...await archiveGridBlackouts(repository, matchingBlackouts, { nowIso, actor, action }));
  }

  if (action === 'clear') {
    mutations.push(...await archiveGridAvailabilityRules(repository, matchingAdminRules, { nowIso, actor, action }));
  }

  if (action === 'open') {
    const activeRules = (availabilityRules || []).filter((row) => ruleCoversCell(row, { providerId, appointmentTypeId, startIso, endIso, timezone }));
    const local = localPartsForIso(startIso, timezone);
    const localEnd = localPartsForIso(endIso, timezone);
    if (repeatWeekly) {
      if (!repeatUntil) {
        throw schedulerPersistenceStyleError('scheduler_admin_grid_repeat_until_required', 'Choose an end date for weekly repeated openings.', 400);
      }
      if (repeatUntil < local.date) {
        throw schedulerPersistenceStyleError('scheduler_admin_grid_repeat_until_invalid', 'The weekly repeat end date must be on or after the selected slot date.', 400);
      }
      const existingRecurring = activeRules.find((row) => matchingAdminRecurringRule(row, {
        providerId,
        appointmentTypeId,
        startIso,
        endIso,
        timezone,
        repeatUntil,
      }));
      if (!existingRecurring) {
        mutations.push(await repository.adminCrudAvailability({
          method: 'POST',
          payload: {
            provider_id: providerId,
            appointment_type_id: appointmentTypeId,
            rule_type: 'recurring',
            day_of_week: [local.dayOfWeek],
            start_time: minutesToSqlTime(local.hour * 60 + local.minute),
            end_time: minutesToSqlTime(localEnd.hour * 60 + localEnd.minute),
            timezone,
            effective_start: local.date,
            effective_end: repeatUntil,
            status: 'active',
            active: true,
            metadata: {
              scheduler_admin_grid: true,
              source: 'scheduler_ops_board',
              repeat_weekly: true,
              repeat_until: repeatUntil,
              created_by_actor: safeAuditActor(actor),
              created_at: nowIso,
            },
          },
        }));
      }
    } else if (activeRules.length === 0) {
      mutations.push(await repository.adminCrudAvailability({
        method: 'POST',
        payload: {
          provider_id: providerId,
          appointment_type_id: appointmentTypeId,
          rule_type: 'one_off',
          day_of_week: [local.dayOfWeek],
          start_time: minutesToSqlTime(local.hour * 60 + local.minute),
          end_time: minutesToSqlTime(localEnd.hour * 60 + localEnd.minute),
          timezone,
          effective_start: local.date,
          effective_end: local.date,
          status: 'active',
          active: true,
          metadata: {
            scheduler_admin_grid: true,
            source: 'scheduler_ops_board',
            created_by_actor: safeAuditActor(actor),
            created_at: nowIso,
          },
        },
      }));
    }
  }

  if (['close', 'reserve', 'blackout'].includes(action)) {
    const existing = matchingBlackouts.find((row) => blackoutGridStatus(row) === action || (action === 'close' && blackoutGridStatus(row) === 'closed'));
    if (!existing) {
      mutations.push(await repository.adminCrudBlackout({
        method: 'POST',
        payload: {
          provider_id: providerId,
          appointment_type_id: appointmentTypeId,
          start_at: startIso,
          end_at: endIso,
          timezone,
          reason: payload.reason || defaultGridActionReason(action),
          status: 'active',
          metadata: {
            scheduler_admin_grid: true,
            source: 'scheduler_ops_board',
            kind: action === 'close' ? 'closed' : action,
            created_by_actor: safeAuditActor(actor),
            created_at: nowIso,
          },
        },
      }));
    }
  }

  const audit = await writeAuditSafe(repository, {
    entity_type: 'availability_cell',
    entity_id: `${providerId}:${appointmentTypeId}:${startIso}`,
    action: `scheduler.admin.availability_cell.${action}`,
    actor_type: actor.isAdmin ? 'admin' : actor.isProvider ? 'provider' : 'student',
    actor_id: actor.userId || actor.wpUserId || null,
    idempotency_key: payload.idempotency_key || payload.idempotencyKey || `admin-grid:${action}:${providerId}:${appointmentTypeId}:${startIso}`,
    after_json: {
      provider_id: providerId,
      appointment_type_id: appointmentTypeId,
      start_at: startIso,
      end_at: endIso,
      timezone,
      action,
      repeat_weekly: repeatWeekly,
      repeat_until: repeatWeekly ? repeatUntil : null,
      mutation_count: mutations.length,
    },
  });

  return {
    ok: true,
    action,
    provider_id: providerId,
    appointment_type_id: appointmentTypeId,
    start_at: startIso,
    end_at: endIso,
    repeat_weekly: repeatWeekly,
    repeat_until: repeatWeekly ? repeatUntil : null,
    mutations,
    audit,
  };
}

async function handleAdminAppointmentTypeConfigRoute({
  request,
  response,
  actor,
  context,
  appointmentTypeId,
  section,
  childId = null,
}) {
  const { sendJson, sendMethodNotAllowed, readJsonBody, authHeaders = {}, repository } = context;
  const payload = request.method === 'GET' ? {} : await readBody(readJsonBody, request);
  const baseRows = await repository.adminCrudAppointmentType({ method: 'GET', id: appointmentTypeId });
  const appointmentType = Array.isArray(baseRows) ? baseRows[0] : baseRows;

  if (!appointmentType && section !== 'config') {
    sendJson(response, 404, schedulerError('scheduler_appointment_type_not_found', 'Appointment type was not found.'), authHeaders);
    return true;
  }

  if (section === 'config') {
    if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
    sendJson(response, 200, schedulerOk({
      status: 'ready',
      appointment_type: appointmentType || null,
      config: buildAppointmentTypeAdminConfig(appointmentType || { id: appointmentTypeId }),
      integrations: await integrationStatusSummary(),
    }), authHeaders);
    return true;
  }

  if (section === 'availability-preview') {
    if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
    const preview = buildAvailabilityPreview(payload, appointmentTypeId);
    sendJson(response, 200, schedulerOk({
      status: 'preview',
      appointment_type_id: appointmentTypeId,
      preview,
      actor: safeSchedulerActor(actor),
    }), authHeaders);
    return true;
  }

  if (section === 'availability-publish' || section === 'availability-unpublish') {
    if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
    const action = section === 'availability-publish' ? 'publish' : 'unpublish';
    sendJson(response, 501, schedulerError(`scheduler_availability_${action}_not_configured`, `Availability ${action} requires approved staging persistence and conflict review.`, {
      status: 'not_configured',
      appointment_type_id: appointmentTypeId,
      requested_slots: Array.isArray(payload.slots || payload.draft_slots) ? (payload.slots || payload.draft_slots).length : 0,
    }), authHeaders);
    return true;
  }

  if (section === 'intake-fields') {
    if (!childId && request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
    if (childId && request.method !== 'PATCH') return methodNotAllowed(sendMethodNotAllowed, response, ['PATCH']);
    const metadata = mergeAppointmentTypeSection(appointmentType.metadata, 'intake_fields', normalizeIntakeFieldsPayload(payload, childId));
    const result = await repository.adminCrudAppointmentType({ method: 'PATCH', id: appointmentTypeId, payload: { metadata } });
    sendJson(response, 200, schedulerOk({ status: 'ready', section, result, actor: safeSchedulerActor(actor) }), authHeaders);
    return true;
  }

  const sectionMethods = {
    notifications: 'POST',
    'booking-flow': 'PATCH',
    'web-meetings': 'PATCH',
    payments: 'PATCH',
  };
  const expectedMethod = sectionMethods[section];
  if (expectedMethod && request.method !== expectedMethod) {
    return methodNotAllowed(sendMethodNotAllowed, response, [expectedMethod]);
  }

  if (expectedMethod) {
    const metadataKey = {
      notifications: 'notifications',
      'booking-flow': 'booking_flow',
      'web-meetings': 'web_meetings',
      payments: 'payments',
    }[section];
    const normalized = normalizeAdminConfigPayload(section, payload);
    const metadata = mergeAppointmentTypeSection(appointmentType.metadata, metadataKey, normalized);
    const result = await repository.adminCrudAppointmentType({ method: 'PATCH', id: appointmentTypeId, payload: { metadata } });
    sendJson(response, 200, schedulerOk({
      status: 'ready',
      section,
      result,
      integrations: section === 'web-meetings' || section === 'payments' ? await integrationStatusSummary() : undefined,
      actor: safeSchedulerActor(actor),
    }), authHeaders);
    return true;
  }

  sendJson(response, 404, schedulerError('scheduler_admin_config_route_not_found', 'Scheduler appointment type config route was not found.'), authHeaders);
  return true;
}

async function handleProviderSchedulerRoute({ request, response, url, actor, context }) {
  const { pathname } = url;
  const { sendJson, sendMethodNotAllowed, readJsonBody, authHeaders = {}, repository } = context;

  if (pathname === '/api/scheduler/provider/my-schedule') {
    if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
    const schedule = await repository.providerListSchedule(actor, Object.fromEntries(url.searchParams.entries()));
    sendJson(response, 200, schedulerOk({ status: 'ready', schedule, actor: safeSchedulerActor(actor), filters: Object.fromEntries(url.searchParams.entries()) }), authHeaders);
    return true;
  }

  if (pathname === '/api/scheduler/provider/block-time') {
    if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
    const payload = await readBody(readJsonBody, request);
    const result = await repository.providerBlockTime(actor, payload);
    sendJson(response, 200, schedulerOk({ status: 'mutation_accepted', result, actor: safeSchedulerActor(actor) }), authHeaders);
    return true;
  }

  if (pathname === '/api/scheduler/provider/unblock-time') {
    if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
    const payload = await readBody(readJsonBody, request);
    const result = await repository.providerUnblockTime(actor, payload);
    sendJson(response, 200, schedulerOk({ status: 'mutation_accepted', result, actor: safeSchedulerActor(actor) }), authHeaders);
    return true;
  }

  if (pathname === '/api/scheduler/provider/notes') {
    if (request.method !== 'POST') return methodNotAllowed(sendMethodNotAllowed, response, ['POST']);
    const payload = await readBody(readJsonBody, request);
    const result = await repository.providerAddNote(actor, payload);
    sendJson(response, 200, schedulerOk({ status: 'mutation_accepted', result: redactProviderNote(result), actor: safeSchedulerActor(actor) }), authHeaders);
    return true;
  }

  const appointmentMatch = pathname.match(/^\/api\/scheduler\/provider\/appointment\/([^/]+)$/u);
  if (appointmentMatch) {
    if (request.method !== 'GET') return methodNotAllowed(sendMethodNotAllowed, response, ['GET']);
    const schedule = await repository.providerListSchedule(actor, Object.fromEntries(url.searchParams.entries()));
    const appointment = schedule.find((row) => String(row.id) === String(appointmentMatch[1]));
    if (!appointment) {
      sendJson(response, 404, schedulerError('scheduler_provider_appointment_not_found', 'Appointment was not found for this provider.'), authHeaders);
      return true;
    }
    sendJson(response, 200, schedulerOk({ status: 'ready', appointment, actor: safeSchedulerActor(actor) }), authHeaders);
    return true;
  }

  sendJson(response, 404, schedulerError('scheduler_provider_route_not_found', 'Scheduler provider route was not found.'), authHeaders);
  return true;
}

async function callAdminCrud(repository, collection, operation) {
  if (collection === 'providers') return repository.adminCrudProvider(operation);
  if (collection === 'resources') return repository.adminCrudResource(operation);
  if (collection === 'appointment-types') return repository.adminCrudAppointmentType(operation);
  if (collection === 'availability') return repository.adminCrudAvailability(operation);
  if (collection === 'blackouts') return repository.adminCrudBlackout(operation);
  if (collection === 'schedule-events') return repository.adminCrudScheduleEvent(operation);
  throw new Error(`Unknown scheduler admin collection ${collection}.`);
}

async function handleSchedulerPaymentRoute({
  pathname,
  payload,
  actor,
  repository,
  paymentAdapter,
  authHeaders,
  response,
  sendJson,
}) {
  const appointmentTypeId = payload.appointment_type_id || payload.appointmentTypeId;
  if (!appointmentTypeId) {
    sendJson(response, 400, schedulerError('scheduler_appointment_type_required', 'appointment_type_id is required for scheduler payment routes.'), authHeaders);
    return true;
  }

  const appointmentTypes = await repository.listAppointmentTypes({ appointment_type_id: appointmentTypeId, appointmentTypeId });
  const appointmentType = appointmentTypes?.[0];
  if (!appointmentType) {
    sendJson(response, 404, schedulerError('scheduler_appointment_type_not_found', 'Appointment type was not found.'), authHeaders);
    return true;
  }

  const metadata = normalizeMetadata(appointmentType.metadata);
  const paymentConfig = metadata.payments || metadata.payment || {};
  if (!paymentRequiredByConfig(paymentConfig)) {
    sendJson(response, 200, schedulerOk({
      status: 'not_required',
      payment: { required: false, mode: paymentConfig.mode || 'none' },
    }), authHeaders);
    return true;
  }

  if (pathname.endsWith('/intent')) {
    const result = await paymentAdapter({
      action: 'create',
      appointmentType,
      appointment_type_id: appointmentType.id,
      studentUserId: actor.userId,
      studentWpUserId: actor.wpUserId,
      amount_cents: paymentConfig.amount_cents || payload.amount_cents || payload.amountCents,
      currency: paymentConfig.currency || payload.currency || 'usd',
      idempotency_key: payload.idempotency_key || payload.idempotencyKey || null,
    });
    if (!result.ok) {
      sendJson(response, 402, schedulerError('scheduler_payment_not_configured', result.message || 'Scheduler payment provider is not configured.', {
        status: result.status || 'not_configured',
        payment_provider: paymentConfig.provider || 'stripe',
      }), authHeaders);
      return true;
    }
    await writeAuditSafe(repository, {
      entity_type: 'appointment',
      entity_id: null,
      action: 'scheduler.payment.intent_created',
      actor_type: 'student',
      actor_id: actor.userId,
      idempotency_key: payload.idempotency_key || payload.idempotencyKey || null,
      after_json: {
        appointment_type_id: appointmentType.id,
        provider: paymentConfig.provider || 'stripe',
        payment_intent_id: result.payment_intent_id || null,
      },
      metadata: { source: 'scheduler_payments' },
    });
    sendJson(response, 200, schedulerOk({
      status: 'payment_pending',
      payment: {
        provider: paymentConfig.provider || 'stripe',
        payment_intent_id: result.payment_intent_id || null,
        client_secret: result.client_secret || null,
        status: result.status,
      },
    }), authHeaders);
    return true;
  }

  const verification = await paymentAdapter({
    action: 'verify',
    appointmentType,
    appointment_type_id: appointmentType.id,
    studentUserId: actor.userId,
    studentWpUserId: actor.wpUserId,
    payment_intent_id: payload.payment_intent_id || payload.paymentIntentId || payload.payment_confirmation_id || payload.paymentConfirmationId,
  });
  if (!verification.ok) {
    sendJson(response, 402, schedulerError('scheduler_payment_confirmation_required', verification.message || 'Payment has not been server-confirmed.', {
      status: verification.status || 'payment_pending',
      payment_provider: paymentConfig.provider || 'stripe',
    }), authHeaders);
    return true;
  }
  sendJson(response, 200, schedulerOk({
    status: 'payment_confirmed',
    payment: {
      provider: paymentConfig.provider || 'stripe',
      payment_confirmation_id: verification.payment_confirmation_id || verification.payment_intent_id,
      status: verification.status,
    },
  }), authHeaders);
  return true;
}

async function validateStudentBookingConfig({ repository, payload, actor, paymentAdapter, authHeaders, response, sendJson }) {
  const appointmentTypeId = payload.appointment_type_id || payload.appointmentTypeId;
  if (!appointmentTypeId || typeof repository.listAppointmentTypes !== 'function') {
    return { ok: true };
  }

  const appointmentTypes = await repository.listAppointmentTypes({ appointment_type_id: appointmentTypeId, appointmentTypeId });
  const appointmentType = appointmentTypes?.[0];
  if (!appointmentType) {
    sendJson(response, 404, schedulerError('scheduler_appointment_type_not_found', 'Appointment type was not found.'), authHeaders);
    return { ok: false };
  }

  const metadata = normalizeMetadata(appointmentType.metadata);
  const requiredFields = getStudentVisibleIntakeFields(metadata)
    .filter((field) => field.required === true);
  const answers = normalizeIntakeAnswers(payload.intake_answers || payload.intakeAnswers || []);
  const missingFields = requiredFields
    .filter((field) => !answers.has(String(field.field_key || field.fieldKey || field.id || '').trim()))
    .map((field) => field.field_key || field.fieldKey || field.id || field.label);
  if (missingFields.length) {
    sendJson(response, 400, schedulerError('scheduler_required_intake_missing', 'Required scheduler intake fields are missing.', {
      missing_fields: missingFields,
    }), authHeaders);
    return { ok: false };
  }

  const paymentConfig = metadata.payments || metadata.payment || {};
  if (paymentRequiredByConfig(paymentConfig)) {
    const confirmation = String(payload.payment_confirmation_id || payload.paymentConfirmationId || payload.payment_intent_id || payload.paymentIntentId || '').trim();
    if (!confirmation) {
      sendJson(response, 402, schedulerError('scheduler_payment_confirmation_required', 'This appointment type requires server-verified payment before booking.', {
        status: 'payment_required',
        payment_provider: paymentConfig.provider || 'stripe',
      }), authHeaders);
      return { ok: false };
    }
    const verification = await paymentAdapter({
      action: 'verify',
      appointmentType,
      appointment_type_id: appointmentType.id,
      studentUserId: actor.userId,
      studentWpUserId: actor.wpUserId,
      payment_intent_id: confirmation,
      payment_confirmation_id: confirmation,
    });
    if (!verification?.ok) {
      const error = verification?.status === 'not_configured'
        ? 'scheduler_payment_not_configured'
        : 'scheduler_payment_confirmation_required';
      sendJson(response, 402, schedulerError(error, verification?.message || 'Payment could not be verified server-side.', {
        status: verification?.status || 'payment_pending',
        payment_provider: paymentConfig.provider || 'stripe',
      }), authHeaders);
      return { ok: false };
    }
  }

  const dailyLimitCheck = await validateSchedulerDailyBookingLimit({
    repository,
    payload,
    appointmentType,
  });
  if (!dailyLimitCheck.ok) {
    sendJson(response, 409, schedulerError(dailyLimitCheck.code, dailyLimitCheck.message, dailyLimitCheck.details), authHeaders);
    return { ok: false };
  }

  return { ok: true, appointmentType };
}

async function validateSchedulerDailyBookingLimit({ repository, payload = {}, appointmentType = {} } = {}) {
  const metadata = normalizeMetadata(appointmentType.metadata);
  const config = normalizeDailyLimitConfig(metadata.missionmed_360_daily_limit || metadata.daily_limit || metadata.dailyLimit || metadata.per_day_limit);
  if (!config.enabled) return { ok: true };

  const limit = positiveInteger(config.limit, 0);
  if (!limit) return { ok: true };

  const providerId = String(payload.provider_id || payload.providerId || '').trim();
  const startAt = payload.start_at || payload.startAt;
  const timezone = payload.timezone || appointmentType.timezone || metadata.availability?.timezone || 'America/New_York';
  const targetDate = localDateKeyFromIso(startAt, timezone);
  if (!providerId || !targetDate || typeof repository.adminListAppointments !== 'function') {
    return { ok: true };
  }

  const [appointments, appointmentTypes] = await Promise.all([
    repository.adminListAppointments({ provider_id: providerId }),
    typeof repository.listAppointmentTypes === 'function' ? repository.listAppointmentTypes({}) : Promise.resolve([appointmentType]),
  ]);
  const limitedTypeIds = new Set((appointmentTypes || [])
    .filter((type) => {
      const typeMetadata = normalizeMetadata(type.metadata);
      const typeConfig = normalizeDailyLimitConfig(typeMetadata.missionmed_360_daily_limit || typeMetadata.daily_limit || typeMetadata.dailyLimit || typeMetadata.per_day_limit);
      if (!typeConfig.enabled) return false;
      return true;
    })
    .map((type) => String(type.id || ''))
    .filter(Boolean));
  limitedTypeIds.add(String(appointmentType.id || payload.appointment_type_id || payload.appointmentTypeId || ''));

  const activeCount = (appointments || []).filter((appointment) => {
    const status = String(appointment.status || '').toLowerCase();
    if (!['held', 'booked', 'confirmed'].includes(status)) return false;
    if (String(appointment.provider_id || appointment.providerId || '') !== providerId) return false;
    if (!limitedTypeIds.has(String(appointment.appointment_type_id || appointment.appointmentTypeId || ''))) return false;
    return localDateKeyFromIso(appointment.start_at || appointment.startAt, timezone) === targetDate;
  }).length;

  if (activeCount >= limit) {
    return {
      ok: false,
      code: 'scheduler_daily_limit_reached',
      message: 'This Mission Residency day already has the maximum allowed 360 reservation.',
      details: {
        provider_id: providerId,
        date: targetDate,
        limit,
        active_count: activeCount,
        browser_limit_trusted: false,
      },
    };
  }

  return { ok: true };
}

function normalizeDailyLimitConfig(value = null) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      ...value,
      enabled: value.enabled !== false,
    };
  }
  const limit = positiveInteger(value, 0);
  return {
    enabled: limit > 0,
    limit,
  };
}

async function runSchedulerPostMutationIntegrations({
  action,
  result,
  actor,
  payload,
  appointmentType,
  repository,
  schedulerAdapters = {},
}) {
  const appointmentId = result?.appointment?.id || result?.appointment_id || result?.appointmentId || null;
  const appointment = result?.appointment || {
    id: appointmentId,
    start_at: payload.start_at || payload.startAt,
    end_at: payload.end_at || payload.endAt,
    timezone: payload.timezone,
    provider_id: payload.provider_id || payload.providerId,
    appointment_type_id: payload.appointment_type_id || payload.appointmentTypeId,
  };
  const replay = result?.idempotentReplay === true || result?.idempotency_replay === true;
  const summary = {
    idempotency_replay: replay,
    meeting: { status: replay ? 'skipped_replay' : 'not_required' },
    notifications: [],
  };

  if (!appointmentId || replay) {
    return summary;
  }

  if (action === 'book') {
    summary.meeting = await createAndPersistMeetingLink({
      appointment,
      appointmentType,
      payload,
      repository,
      actor,
      schedulerAdapters,
    });
  }

  if (action === 'cancel') {
    summary.meeting = await cleanupZoomMeetingAfterCancel({
      appointment,
      appointmentType,
      payload,
      repository,
      actor,
      schedulerAdapters,
    });
  }

  summary.notifications = await enqueueAndDispatchSchedulerNotifications({
    action,
    appointment: {
      ...appointment,
      meeting_url: summary.meeting.meeting_url || appointment.meeting_url || null,
      payment_status: paymentRequiredByConfig(normalizeMetadata(appointmentType?.metadata).payments || {})
        ? 'confirmed'
        : 'not required',
    },
    appointmentType,
    actor,
    payload,
    repository,
    schedulerAdapters,
  });

  return summary;
}

async function createAndPersistMeetingLink({
  appointment,
  appointmentType,
  payload,
  repository,
  actor,
  schedulerAdapters = {},
}) {
  const config = webMeetingConfig(appointmentType);
  if (!['zoom', 'webex', 'manual'].includes(config.provider) || (config.provider !== 'manual' && config.auto_generate !== true)) {
    return { status: 'not_required', provider: config.provider };
  }

  const adapter = {
    zoom: schedulerAdapters.zoomMeetingLinkAdapter || zoomMeetingLinkAdapter,
    webex: schedulerAdapters.webexMeetingLinkAdapter || webexMeetingLinkAdapter,
    manual: schedulerAdapters.manualMeetingLinkAdapter || manualMeetingLinkAdapter,
  }[config.provider];
  const meeting = await adapter({
    ...payload,
    appointment,
    appointmentType,
    appointment_type: appointmentType,
    appointmentId: appointment.id,
    appointment_id: appointment.id,
    provider_account_id: config.provider_account_id,
    meeting_url: config.meeting_url,
    title: appointmentType?.name || 'MissionMed appointment',
    start_at: appointment.start_at || appointment.startAt,
    end_at: appointment.end_at || appointment.endAt,
    timezone: appointment.timezone || payload.timezone,
    duration_minutes: appointmentType?.duration_minutes,
  });

  const externalStatus = meeting.ok && meeting.meeting_url ? 'created' : meeting.status === 'not_configured' ? 'not_configured' : 'failed';
  const patch = {
    meeting_url: meeting.ok && meeting.meeting_url ? meeting.meeting_url : appointment.meeting_url || null,
    external_event_status: externalStatus,
    metadata: {
      ...(appointment.metadata || {}),
      scheduler_integrations: {
        ...((appointment.metadata || {}).scheduler_integrations || {}),
        meeting: {
          ...(((appointment.metadata || {}).scheduler_integrations || {}).meeting || {}),
          provider: config.provider,
          status: meeting.status,
          meeting_url_present: Boolean(meeting.meeting_url),
          external_event_id: meeting.external_event_id || (((appointment.metadata || {}).scheduler_integrations || {}).meeting || {}).external_event_id || null,
          external_event_id_present: Boolean(meeting.external_event_id),
          updated_at: new Date().toISOString(),
        },
      },
    },
  };

  if (typeof repository.updateAppointmentIntegration === 'function') {
    await repository.updateAppointmentIntegration(appointment.id, patch);
    if (resultAppointmentMutable(appointment)) Object.assign(appointment, patch);
  }
  await writeAuditSafe(repository, {
    entity_type: 'appointment',
    entity_id: appointment.id,
    action: `scheduler.meeting.${config.provider}.${meeting.status || 'unknown'}`,
    actor_type: 'system',
    actor_id: actor.userId,
    idempotency_key: `${payload.idempotency_key || payload.idempotencyKey || appointment.id}:meeting:${config.provider}`,
    after_json: {
      provider: config.provider,
      status: meeting.status,
      meeting_url_present: Boolean(meeting.meeting_url),
      external_event_id_present: Boolean(meeting.external_event_id),
    },
    metadata: { source: 'scheduler_integrations' },
  });

  return {
    provider: config.provider,
    status: meeting.status,
    meeting_url: meeting.ok && meeting.meeting_url ? meeting.meeting_url : null,
    meeting_url_present: Boolean(meeting.meeting_url),
    external_event_status: externalStatus,
  };
}

async function cleanupZoomMeetingAfterCancel({
  appointment,
  appointmentType,
  payload,
  repository,
  actor,
  schedulerAdapters = {},
}) {
  const storedAppointment = await resolveAppointmentForIntegration(appointment, repository);
  const resolvedType = appointmentType || await resolveAppointmentTypeForIntegration(storedAppointment, repository);
  const config = webMeetingConfig(resolvedType);
  if (config.provider !== 'zoom' || config.auto_generate !== true) {
    return { status: 'not_required', provider: config.provider };
  }

  const externalEventId = meetingExternalEventId(storedAppointment);
  const cleanupAdapter = schedulerAdapters.zoomMeetingCleanupAdapter || zoomMeetingCleanupAdapter;
  const cleanup = externalEventId
    ? await cleanupAdapter({
      appointment: storedAppointment,
      appointmentType: resolvedType,
      appointment_type: resolvedType,
      appointmentId: storedAppointment.id,
      appointment_id: storedAppointment.id,
      external_event_id: externalEventId,
    })
    : {
      ok: false,
      status: 'missing_external_event_id',
      adapter: 'zoom_meeting_cleanup',
      provider: 'zoom',
      external_event_id_present: false,
      message: 'Zoom meeting cleanup requires a persisted external event id.',
    };

  const existingMetadata = normalizeMetadata(storedAppointment.metadata);
  const existingIntegrations = normalizeMetadata(existingMetadata.scheduler_integrations);
  const existingMeeting = normalizeMetadata(existingIntegrations.meeting);
  const meetingPatch = {
    ...existingMeeting,
    provider: 'zoom',
    cleanup_status: cleanup.status,
    cleanup_ok: cleanup.ok === true,
    cleanup_attempted_at: new Date().toISOString(),
    external_event_id: externalEventId || existingMeeting.external_event_id || null,
    external_event_id_present: Boolean(externalEventId),
  };
  const patch = {
    metadata: {
      ...existingMetadata,
      scheduler_integrations: {
        ...existingIntegrations,
        meeting: meetingPatch,
      },
    },
  };

  if (typeof repository.updateAppointmentIntegration === 'function') {
    await repository.updateAppointmentIntegration(storedAppointment.id, patch);
    if (resultAppointmentMutable(storedAppointment)) Object.assign(storedAppointment, patch);
  }
  await writeAuditSafe(repository, {
    entity_type: 'appointment',
    entity_id: storedAppointment.id,
    action: `scheduler.meeting.zoom.cleanup.${cleanup.ok ? 'success' : 'failed'}`,
    actor_type: 'system',
    actor_id: actor.userId,
    idempotency_key: `${payload.idempotency_key || payload.idempotencyKey || storedAppointment.id}:meeting:zoom:cleanup`,
    after_json: {
      provider: 'zoom',
      status: cleanup.status,
      external_event_id_present: Boolean(externalEventId),
    },
    metadata: { source: 'scheduler_integrations' },
  });

  return {
    provider: 'zoom',
    status: cleanup.status,
    cleanup_ok: cleanup.ok === true,
    external_event_id_present: Boolean(externalEventId),
  };
}

async function resolveAppointmentForIntegration(appointment = {}, repository) {
  const appointmentId = appointment?.id || appointment?.appointment_id || appointment?.appointmentId || null;
  if (appointmentId && typeof repository.getAppointmentById === 'function') {
    const stored = await repository.getAppointmentById(appointmentId);
    if (stored) return stored;
  }
  return appointment || {};
}

async function resolveAppointmentTypeForIntegration(appointment = {}, repository) {
  const appointmentTypeId = appointment?.appointment_type_id || appointment?.appointmentTypeId || null;
  if (!appointmentTypeId || typeof repository.listAppointmentTypes !== 'function') return null;
  const types = await repository.listAppointmentTypes({ appointment_type_id: appointmentTypeId, appointmentTypeId });
  return (types || []).find((type) => String(type.id || '') === String(appointmentTypeId)) || types?.[0] || null;
}

function meetingExternalEventId(appointment = {}) {
  const metadata = normalizeMetadata(appointment.metadata);
  const integrations = normalizeMetadata(metadata.scheduler_integrations);
  const meeting = normalizeMetadata(integrations.meeting);
  return String(
    appointment.external_event_id
      || appointment.externalEventId
      || meeting.external_event_id
      || meeting.externalEventId
      || '',
  ).trim();
}

async function enqueueAndDispatchSchedulerNotifications({
  action,
  appointment,
  appointmentType,
  actor,
  payload,
  repository,
  schedulerAdapters = {},
}) {
  const notifications = notificationRequestsForMutation({ action, appointment, appointmentType, actor, payload });
  const emailAdapter = schedulerAdapters.emailMedMailNotificationAdapter || emailMedMailNotificationAdapter;
  const smsAdapter = schedulerAdapters.smsNotificationProviderAdapter || smsNotificationProviderAdapter;
  const results = [];

  for (const request of notifications) {
    const queued = typeof repository.enqueueNotification === 'function'
      ? await repository.enqueueNotification(request)
      : request;
    const immediate = new Date(request.scheduled_at).getTime() <= Date.now() + 30_000;
    let dispatch = { status: 'queued_only' };
    if (immediate) {
      const adapter = request.channel === 'sms' ? smsAdapter : emailAdapter;
      dispatch = await adapter({
        ...request.metadata,
        queued: true,
        notificationId: queued.id,
        appointment,
        appointmentType,
        template_key: request.template_key,
        templateKey: request.template_key,
        recipient_role: request.recipient_role,
        recipientRole: request.recipient_role,
        appointmentId: appointment.id,
        appointment_id: appointment.id,
        meeting_url: appointment.meeting_url,
        sms_opt_in: payload.sms_opt_in || payload.smsOptIn,
        to_phone: payload.sms_phone || payload.smsPhone,
        to_email: request.metadata?.recipient_email,
        actor,
      });
      if (typeof repository.updateNotificationStatus === 'function' && ['sent', 'failed', 'suppressed'].includes(dispatch.status)) {
        await repository.updateNotificationStatus(queued.id, {
          status: dispatch.status,
          sent_at: dispatch.status === 'sent' ? new Date().toISOString() : undefined,
          provider_message_id: dispatch.provider_message_id || null,
          last_error: dispatch.ok === false ? dispatch.message : null,
          attempt_count: 1,
        });
      }
    }
    results.push({
      id: queued.id || null,
      channel: request.channel,
      template_key: request.template_key,
      recipient_role: request.recipient_role,
      scheduled_at: request.scheduled_at,
      queue_status: queued.status || request.status,
      dispatch_status: dispatch.status,
    });
  }

  return results;
}

async function dispatchDueSchedulerNotifications({
  repository,
  schedulerAdapters = {},
  limit = 25,
  now = new Date(),
} = {}) {
  if (typeof repository.listDueNotifications !== 'function') {
    return {
      status: 'not_configured',
      processed: 0,
      message: 'Notification dispatch requires repository.listDueNotifications.',
    };
  }

  const due = await repository.listDueNotifications({ now, limit });
  const emailAdapter = schedulerAdapters.emailMedMailNotificationAdapter || emailMedMailNotificationAdapter;
  const smsAdapter = schedulerAdapters.smsNotificationProviderAdapter || smsNotificationProviderAdapter;
  const results = [];
  for (const notification of due) {
    const metadata = normalizeMetadata(notification.metadata);
    const adapter = notification.channel === 'sms' ? smsAdapter : emailAdapter;
    const dispatch = await adapter({
      ...metadata,
      notificationId: notification.id,
      appointmentId: notification.appointment_id,
      appointment_id: notification.appointment_id,
      template_key: notification.template_key,
      recipient_role: notification.recipient_role,
      meeting_url: metadata.meeting_url || null,
      sms_opt_in: metadata.sms_opt_in === true,
      to_phone: metadata.to_phone || null,
      to_email: metadata.recipient_email || null,
      queued: true,
    });
    if (typeof repository.updateNotificationStatus === 'function' && ['sent', 'failed', 'suppressed'].includes(dispatch.status)) {
      await repository.updateNotificationStatus(notification.id, {
        status: dispatch.status,
        sent_at: dispatch.status === 'sent' ? new Date().toISOString() : undefined,
        provider_message_id: dispatch.provider_message_id || null,
        last_error: dispatch.ok === false ? dispatch.message : null,
        attempt_count: Number(notification.attempt_count || 0) + 1,
      });
    }
    results.push({
      id: notification.id,
      channel: notification.channel,
      template_key: notification.template_key,
      dispatch_status: dispatch.status,
    });
  }
  return {
    status: 'processed',
    processed: results.length,
    results,
  };
}

function notificationRequestsForMutation({ action, appointment, appointmentType, actor, payload }) {
  const config = notificationConfig(appointmentType);
  const nowIso = new Date().toISOString();
  const baseKey = payload.idempotency_key || payload.idempotencyKey || `${action}:${appointment.id}`;
  const baseMetadata = {
    source: 'scheduler_integrations',
    meeting_url_present: Boolean(appointment.meeting_url),
    meeting_url: appointment.meeting_url || null,
    payment_status: appointment.payment_status || 'not required',
    recipient_email: actor.email || null,
  };
  const rows = [];
  const add = (channel, templateKey, recipientRole, scheduledAt, metadata = {}) => {
    rows.push({
      appointment_id: appointment.id,
      channel,
      template_key: templateKey,
      recipient_role: recipientRole,
      scheduled_at: scheduledAt,
      status: 'pending',
      idempotency_key: `${baseKey}:${channel}:${templateKey}:${recipientRole}:${scheduledAt}`,
      metadata: { ...baseMetadata, ...metadata },
    });
  };

  if (action === 'book') {
    if (config.student_booked_email !== false) add('email', 'scheduler_booking_confirmation', 'student', nowIso);
    if (config.admin_booked_email !== false) add('email', 'scheduler_booking_admin_notice', 'admin', nowIso, { recipient_email: config.admin_email || null });
    if (config.provider_booked_email === true) add('email', 'scheduler_booking_provider_notice', 'provider', nowIso, { recipient_email: config.provider_email || null });
    for (const reminder of normalizeReminderSchedule(config.reminder_schedule)) {
      add('email', 'scheduler_appointment_reminder', 'student', reminderAt(appointment, reminder));
      if (payload.sms_opt_in || payload.smsOptIn || config.sms_reminders === true) {
        add('sms', 'scheduler_appointment_sms_reminder', 'student', reminderAt(appointment, reminder), {
          sms_opt_in: Boolean(payload.sms_opt_in || payload.smsOptIn),
          to_phone: payload.sms_phone || payload.smsPhone || null,
        });
      }
    }
  } else if (action === 'cancel') {
    if (config.student_canceled_email !== false) add('email', 'scheduler_cancellation_confirmation', 'student', nowIso);
    if (config.admin_canceled_email !== false) add('email', 'scheduler_cancellation_admin_notice', 'admin', nowIso, { recipient_email: config.admin_email || null });
  } else if (action === 'reschedule') {
    add('email', 'scheduler_reschedule_confirmation', 'student', nowIso);
    add('email', 'scheduler_reschedule_admin_notice', 'admin', nowIso, { recipient_email: config.admin_email || null });
  }

  return rows;
}

async function buildMutationPlaceholderSummary(action, appointmentId = null, schedulerAdapters = {}) {
  const emailAdapter = schedulerAdapters.emailMedMailNotificationAdapter || emailMedMailNotificationAdapter;
  const smsAdapter = schedulerAdapters.smsNotificationProviderAdapter || smsNotificationProviderAdapter;
  const zoomAdapter = schedulerAdapters.zoomMeetingLinkAdapter || zoomMeetingLinkAdapter;
  const email = await emailAdapter({ appointmentId, templateKey: `scheduler_${action}`, recipientRole: 'student' });
  const calendar = await googleCalendarEventAdapter({ appointmentId });
  const zoom = await zoomAdapter({ appointmentId });
  const meet = await googleMeetAdapter({ appointmentId });
  const sms = await smsAdapter({ appointmentId });
  return {
    email: email.status,
    google_calendar_event: calendar.status,
    zoom: zoom.status,
    google_meet: meet.status,
    sms: sms.status,
  };
}

function paymentRequiredByConfig(paymentConfig = {}) {
  const mode = String(paymentConfig.mode || '').trim().toLowerCase();
  return paymentConfig.required === true || mode === 'required' || mode === 'deposit';
}

function webMeetingConfig(appointmentType = {}) {
  const metadata = normalizeMetadata(appointmentType?.metadata);
  const meeting = metadata.web_meetings || metadata.webMeetings || {};
  const provider = String(meeting.provider || appointmentType?.meeting_mode || 'manual').trim().toLowerCase();
  return {
    provider: ['zoom', 'webex', 'google_meet', 'manual', 'none'].includes(provider) ? provider : 'manual',
    auto_generate: meeting.auto_generate === true || meeting.autoGenerate === true || meeting.auto_generate === 'true',
    provider_account_id: meeting.provider_account_id || meeting.providerAccountId || meeting.meeting_account_id || meeting.meetingAccountId || null,
    meeting_url: meeting.meeting_url || meeting.meetingUrl || null,
    link_policy: meeting.link_policy || meeting.linkPolicy || 'after_confirmation',
  };
}

function notificationConfig(appointmentType = {}) {
  const metadata = normalizeMetadata(appointmentType?.metadata);
  return {
    ...defaultNotificationConfig(),
    ...(metadata.notifications && typeof metadata.notifications === 'object' ? metadata.notifications : {}),
  };
}

function normalizeReminderSchedule(schedule = []) {
  if (!Array.isArray(schedule)) return [];
  return schedule
    .map((item) => {
      if (typeof item === 'number') return { minutes_before: item };
      if (typeof item === 'string' && item.trim()) return { minutes_before: Number(item) };
      return item && typeof item === 'object' ? item : null;
    })
    .filter(Boolean)
    .filter((item) => Number.isFinite(Number(item.minutes_before ?? item.minutesBefore)));
}

function reminderAt(appointment = {}, reminder = {}) {
  const start = new Date(appointment.start_at || appointment.startAt || Date.now());
  const minutes = Number(reminder.minutes_before ?? reminder.minutesBefore ?? 1440);
  if (Number.isNaN(start.getTime())) return new Date().toISOString();
  return new Date(start.getTime() - Math.max(0, minutes) * 60_000).toISOString();
}

async function writeAuditSafe(repository, event = {}) {
  if (typeof repository.writeAuditEvent !== 'function') return null;
  try {
    return await repository.writeAuditEvent(event);
  } catch {
    return null;
  }
}

function resultAppointmentMutable(appointment = {}) {
  return appointment && typeof appointment === 'object';
}

function schedulerPersistenceStyleError(code, message, status = 500, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function normalizeWeekStart(value = '') {
  const parsed = parseDateKey(value) || dateKeyFromDate(new Date());
  const date = parseDateKeyAsUtc(parsed);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return dateKeyFromDate(date);
}

function parseDateKey(value = '') {
  const clean = String(value || '').trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : dateKeyFromDate(date);
}

function parseDateKeyAsUtc(dateKey = '') {
  const parsed = parseDateKey(dateKey) || dateKeyFromDate(new Date());
  const [year, month, day] = parsed.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKeyFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysToDateKey(dateKey, days) {
  const date = parseDateKeyAsUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return dateKeyFromDate(date);
}

function zonedDateTimeToUtc(dateKey, minutes, timezone = 'America/New_York') {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const localAsUtc = new Date(Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0));
  const offset = zonedOffsetMs(localAsUtc, timezone);
  return new Date(localAsUtc.getTime() - offset);
}

function zonedOffsetMs(utcDate, timezone = 'America/New_York') {
  const parts = localPartsForDate(utcDate, timezone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0);
  return localAsUtc - utcDate.getTime();
}

function localPartsForIso(iso, timezone = 'America/New_York') {
  return localPartsForDate(new Date(iso), timezone);
}

function localDateKeyFromIso(iso, timezone = 'America/New_York') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = localPartsForDate(date, timezone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function localPartsForDate(date, timezone = 'America/New_York') {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second || 0),
    dayOfWeek: weekdayMap[values.weekday] ?? 0,
    date: `${values.year}-${values.month}-${values.day}`,
  };
}

function minutesToClockLabel(minutes = 0) {
  const hours = Math.floor(Number(minutes || 0) / 60);
  const mins = Number(minutes || 0) % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = ((hours + 11) % 12) + 1;
  return `${hour12}:${String(mins).padStart(2, '0')} ${period}`;
}

function minutesToSqlTime(minutes = 0) {
  const normalized = Math.max(0, Math.min(24 * 60, Number(minutes || 0)));
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}:00`;
}

function sqlTimeToMinutes(value = '') {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/u);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function positiveInteger(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeIso(value = '') {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

function dateRangesOverlap(startA, endA, startB, endB) {
  const aStart = Date.parse(startA);
  const aEnd = Date.parse(endA || startA);
  const bStart = Date.parse(startB);
  const bEnd = Date.parse(endB || startB);
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false;
  return aStart < bEnd && aEnd > bStart;
}

function isActiveAppointmentForGrid(row = {}) {
  const status = String(row.status || '').toLowerCase();
  return !['canceled', 'cancelled', 'completed', 'no_show', 'no-show'].includes(status);
}

function firstMatchingBlackout(blackouts = [], cell = {}) {
  return (blackouts || []).find((row) => matchingBusyBlock(row, cell)) || null;
}

function matchingBusyBlock(row = {}, { providerId = '', appointmentTypeId = '', startIso = '', endIso = '' } = {}) {
  if (!row || row.active === false || String(row.status || 'active').toLowerCase() === 'inactive') return false;
  const rowProvider = String(row.provider_id || row.providerId || '');
  if (rowProvider && providerId && rowProvider !== String(providerId)) return false;
  const rowType = String(row.appointment_type_id || row.appointmentTypeId || '');
  if (rowType && appointmentTypeId && rowType !== String(appointmentTypeId)) return false;
  return dateRangesOverlap(row.start_at || row.startAt, row.end_at || row.endAt, startIso, endIso);
}

function blackoutGridStatus(row = {}) {
  const metadata = normalizeMetadata(row.metadata);
  const kind = String(metadata.kind || metadata.status || row.kind || '').toLowerCase();
  if (kind === 'reserved') return 'reserved';
  if (kind === 'blackout') return 'blackout';
  if (kind === 'closed' || kind === 'unavailable') return 'closed';
  const reason = String(row.reason || '').toLowerCase();
  if (reason.includes('reserve')) return 'reserved';
  if (reason.includes('blackout')) return 'blackout';
  return 'closed';
}

function ruleCoversCell(row = {}, { providerId = '', appointmentTypeId = '', startIso = '', endIso = '', timezone = 'America/New_York' } = {}) {
  if (!isActiveGridRow(row)) return false;
  if (String(row.provider_id || row.providerId || '') !== String(providerId)) return false;
  const rowType = String(row.appointment_type_id || row.appointmentTypeId || '');
  if (rowType && appointmentTypeId && rowType !== String(appointmentTypeId)) return false;
  const start = localPartsForIso(startIso, timezone);
  const end = localPartsForIso(endIso, timezone);
  const days = normalizeDayArray(row.day_of_week ?? row.dayOfWeek);
  if (days.length && !days.includes(start.dayOfWeek)) return false;
  const effectiveStart = parseDateKey(row.effective_start || row.effectiveStart);
  const effectiveEnd = parseDateKey(row.effective_end || row.effectiveEnd);
  if (effectiveStart && start.date < effectiveStart) return false;
  if (effectiveEnd && start.date > effectiveEnd) return false;
  const rowStart = sqlTimeToMinutes(row.start_time || row.startTime);
  const rowEnd = sqlTimeToMinutes(row.end_time || row.endTime);
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  return rowStart <= startMinutes && rowEnd >= endMinutes;
}

function matchingAdminOneOffRule(row = {}, cell = {}) {
  const metadata = normalizeMetadata(row.metadata);
  if (metadata.scheduler_admin_grid !== true && metadata.source !== 'scheduler_ops_board') return false;
  const ruleType = String(row.rule_type || row.ruleType || '').toLowerCase();
  if (ruleType && ruleType !== 'one_off') return false;
  return ruleCoversCell(row, cell);
}

function matchingAdminRecurringRule(row = {}, cell = {}) {
  const metadata = normalizeMetadata(row.metadata);
  if (metadata.scheduler_admin_grid !== true && metadata.source !== 'scheduler_ops_board') return false;
  const ruleType = String(row.rule_type || row.ruleType || '').toLowerCase();
  if (ruleType !== 'recurring') return false;
  const repeatUntil = parseDateKey(cell.repeatUntil);
  if (repeatUntil) {
    const effectiveEnd = parseDateKey(row.effective_end || row.effectiveEnd);
    if (effectiveEnd && effectiveEnd !== repeatUntil) return false;
  }
  return ruleCoversCell(row, cell);
}

function normalizeDayArray(value) {
  if (Array.isArray(value)) return value.map(Number).filter((item) => Number.isInteger(item));
  if (typeof value === 'number') return [value];
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number).filter((item) => Number.isInteger(item));
    } catch {
      return value.split(',').map((item) => Number(item.trim())).filter((item) => Number.isInteger(item));
    }
  }
  return [];
}

function isActiveGridRow(row = {}) {
  if (!row) return false;
  if (row.active === false) return false;
  const status = String(row.status || 'active').toLowerCase();
  return !['inactive', 'archived', 'deleted'].includes(status);
}

function coerceBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

async function archiveGridBlackouts(repository, rows = [], { nowIso = new Date().toISOString(), actor, action = 'clear' } = {}) {
  const archived = [];
  for (const row of rows || []) {
    if (!row?.id) continue;
    archived.push(await repository.adminCrudBlackout({
      method: 'PATCH',
      id: row.id,
      payload: {
        status: 'inactive',
        metadata: {
          ...normalizePlainObject(row.metadata),
          archived_by_action: action,
          archived_by_actor: safeAuditActor(actor),
          archived_at: nowIso,
        },
      },
    }));
  }
  return archived;
}

async function archiveGridAvailabilityRules(repository, rows = [], { nowIso = new Date().toISOString(), actor, action = 'clear' } = {}) {
  const archived = [];
  for (const row of rows || []) {
    if (!row?.id) continue;
    archived.push(await repository.adminCrudAvailability({
      method: 'PATCH',
      id: row.id,
      payload: {
        active: false,
        status: 'inactive',
        metadata: {
          ...normalizePlainObject(row.metadata),
          archived_by_action: action,
          archived_by_actor: safeAuditActor(actor),
          archived_at: nowIso,
        },
      },
    }));
  }
  return archived;
}

function defaultGridActionReason(action = '') {
  if (action === 'reserve') return 'Reserved by Scheduler Ops';
  if (action === 'blackout') return 'Blackout set by Scheduler Ops';
  return 'Closed by Scheduler Ops';
}

function safeAuditActor(actor = {}) {
  return {
    role: actor.isAdmin ? 'admin' : actor.isProvider ? 'provider' : 'student',
    user_id: actor.userId || null,
    wp_user_id: actor.wpUserId || null,
  };
}

function sanitizeGridAppointment(appointment = {}) {
  return {
    id: appointment.id || appointment.appointment_id || appointment.appointmentId || null,
    provider_id: appointment.provider_id || appointment.providerId || null,
    appointment_type_id: appointment.appointment_type_id || appointment.appointmentTypeId || null,
    appointment_type_name: appointment.appointment_type_name || appointment.appointmentTypeName || appointment.title || null,
    student_label: appointment.student_display_name || appointment.student_name || appointment.student_label || 'Student',
    start_at: appointment.start_at || appointment.startAt || null,
    end_at: appointment.end_at || appointment.endAt || null,
    status: appointment.status || 'scheduled',
    meeting_platform: appointment.meeting_platform || appointment.meetingPlatform || null,
    meeting_url_present: Boolean(appointment.meeting_url || appointment.meetingUrl),
  };
}

function normalizePlainObject(value = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function integrationStatusSummary() {
  const [
    googleBusy,
    googleEvent,
    googleMapping,
    icsInvite,
    zoom,
    webex,
    googleMeet,
    manualMeeting,
    stripe,
    paypal,
    email,
    sms,
  ] = await Promise.all([
    googleCalendarBusySyncAdapter(),
    googleCalendarEventAdapter(),
    googleCalendarProviderMappingAdapter(),
    icsInviteAdapter(),
    zoomMeetingLinkAdapter(),
    webexMeetingLinkAdapter(),
    googleMeetAdapter(),
    manualMeetingLinkAdapter(),
    stripePaymentAdapter(),
    paypalPaymentAdapter(),
    emailMedMailNotificationAdapter(),
    smsNotificationProviderAdapter(),
  ]);

  return {
    google_calendar_busy_sync: googleBusy.status,
    google_calendar_event_creation: googleEvent.status,
    google_calendar_provider_mapping: googleMapping.status,
    ics_invite_generation: icsInvite.status,
    zoom: zoom.status,
    webex: webex.status,
    google_meet: googleMeet.status,
    manual_meeting_link: manualMeeting.status,
    stripe: stripe.status,
    paypal: paypal.status,
    email: email.status,
    sms: sms.status,
  };
}

function schedulerEnrollmentPolicySummary(env = process.env) {
  const launchAllowlistActive = String(env.SCHEDULER_LAUNCH_ENROLLMENT_MODE || '').trim().toLowerCase() === 'allowlist';
  const bridgeEnabled = schedulerEnvFlag(env.SCHEDULER_ENROLLMENT_BRIDGE_ENABLED);
  const bridgeUrlConfigured = Boolean(String(env.SCHEDULER_ENROLLMENT_BRIDGE_URL || '').trim());
  const bridgeTokenConfigured = Boolean(String(env.SCHEDULER_ENROLLMENT_BRIDGE_TOKEN || '').trim());
  const appointmentTypeScoped = Boolean(String(env.SCHEDULER_LAUNCH_ELIGIBLE_APPOINTMENT_TYPE_IDS || env.SCHEDULER_LAUNCH_ELIGIBLE_APPOINTMENT_TYPE_SLUGS || '').trim());
  const userScoped = Boolean(String(env.SCHEDULER_LAUNCH_ELIGIBLE_USER_IDS || env.SCHEDULER_LAUNCH_ELIGIBLE_WP_USER_IDS || env.SCHEDULER_LAUNCH_ELIGIBLE_EMAILS || env.SCHEDULER_LAUNCH_ELIGIBLE_LOGINS || '').trim());
  const entitlements = schedulerEntitlementPolicySummary(env);

  return {
    mode: bridgeEnabled && bridgeUrlConfigured && bridgeTokenConfigured
      ? 'bridge'
      : entitlements.enabled
        ? 'entitlements'
        : launchAllowlistActive
        ? 'launch_allowlist'
        : 'fail_closed',
    entitlements,
    bridge: {
      enabled: bridgeEnabled,
      url_configured: bridgeUrlConfigured,
      token_configured: bridgeTokenConfigured,
    },
    launch_allowlist: {
      active: launchAllowlistActive,
      appointment_type_scoped: appointmentTypeScoped,
      user_scoped: userScoped,
    },
    browser_eligibility_trusted: false,
  };
}

function sanitizeEntitlementConfigPatch(payload = {}) {
  return {
    division_count: Array.isArray(payload.divisions) ? payload.divisions.length : null,
    appointment_type_rule_count: Array.isArray(payload.appointment_type_rules || payload.appointmentTypeRules)
      ? (payload.appointment_type_rules || payload.appointmentTypeRules).length
      : null,
    quota_rule_count: Array.isArray(payload.quota_rules || payload.quotaRules)
      ? (payload.quota_rules || payload.quotaRules).length
      : null,
    credit_pool_count: Array.isArray(payload.credit_pools || payload.creditPools)
      ? (payload.credit_pools || payload.creditPools).length
      : null,
    browser_eligibility_ignored: true,
  };
}

function schedulerEnvFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function sanitizeAuditEventForAdmin(event = {}) {
  return {
    id: event.id || null,
    actor_type: event.actor_type || event.actorType || null,
    actor_id: event.actor_id || event.actorId || null,
    action: event.action || 'scheduler_event',
    target_type: event.entity_type || event.target_type || event.targetType || null,
    target_id: event.entity_id || event.target_id || event.targetId || event.appointment_id || event.appointmentId || null,
    appointment_id: event.appointment_id || event.appointmentId || (event.entity_type === 'appointment' ? event.entity_id : null) || null,
    idempotency_key: event.idempotency_key || event.idempotencyKey || null,
    created_at: event.created_at || event.createdAt || null,
  };
}

function buildAppointmentTypeAdminConfig(appointmentType = {}) {
  const metadata = normalizeMetadata(appointmentType.metadata);
  return {
    basics: {
      name: appointmentType.name || '',
      description: appointmentType.description || '',
      instructions: metadata.instructions || metadata.student_instructions || '',
      duration_minutes: appointmentType.duration_minutes || 30,
      duration_unit: metadata.duration_unit || 'minutes',
      label: metadata.label || null,
      color: metadata.color || metadata.label_color || null,
      booking_layout: metadata.booking_layout || 'guided_week',
      status: appointmentType.status || 'draft',
    },
    availability: {
      start_mode: metadata.availability_start_mode || metadata.availability?.start_mode || 'available_blocks',
      interval_minutes: metadata.interval_minutes || metadata.availability?.interval_minutes || 15,
      date_window: metadata.availability_window || metadata.availability?.date_window || null,
      weekly_grid: metadata.weekly_grid || metadata.availability?.weekly_grid || [],
    },
    capacity: {
      mode: appointmentType.group_enabled ? 'group' : metadata.capacity_mode || 'individual',
      capacity: appointmentType.capacity || metadata.capacity || 1,
      waitlist: metadata.waitlist || { enabled: false },
    },
    scheduling_options: {
      timezone_mode: metadata.timezone_mode || 'localized',
      buffer_before_minutes: appointmentType.buffer_before_minutes || 0,
      buffer_after_minutes: appointmentType.buffer_after_minutes || 0,
      min_notice_minutes: appointmentType.min_notice_minutes || 0,
      max_booking_window_days: appointmentType.max_booking_window_days || 60,
      per_day_limit: metadata.per_day_limit || null,
      booking_window: metadata.booking_window || null,
    },
    web_meetings: metadata.web_meetings || { provider: appointmentType.meeting_mode || 'manual', auto_generate: false },
    customer_information: {
      fields: getStudentVisibleIntakeFields(metadata),
      staff_only_field_count: getIntakeFields(metadata).filter((field) => field.visibility === 'staff_only' || field.visibility === 'admin_only').length,
    },
    notifications: metadata.notifications || defaultNotificationConfig(),
    booking_flow: metadata.booking_flow || { mode: 'expanded', steps: ['type', 'provider', 'date_time', 'intake', 'confirm'] },
    payments: metadata.payments || { mode: 'none', provider: 'stripe', status: 'not_configured' },
    booking_info: {
      matrix_route: `/member-dashboard/#schedule?type=${appointmentType.slug || appointmentType.id || ''}`,
      standalone_route: `/schedule?type=${appointmentType.slug || appointmentType.id || ''}`,
      embed_mount: 'window.MMEDScheduler.mount({ mode: "embedded" })',
    },
  };
}

function buildAvailabilityPreview(payload = {}, appointmentTypeId = '') {
  const providerId = payload.provider_id || payload.providerId || 'provider-pending';
  const startMode = payload.start_mode || payload.availability_start_mode || 'available_blocks';
  const slots = Array.isArray(payload.slots || payload.draft_slots)
    ? (payload.slots || payload.draft_slots)
    : [
      { provider_id: providerId, appointment_type_id: appointmentTypeId, day: 'Monday', start_time: '09:00', end_time: '12:00', status: 'draft' },
      { provider_id: providerId, appointment_type_id: appointmentTypeId, day: 'Wednesday', start_time: '13:00', end_time: '16:00', status: 'draft' },
    ];
  return {
    start_mode: startMode,
    slots,
    conflicts: [],
    warnings: ['Preview is local contract validation only. Publishing requires staging persistence and conflict checks.'],
  };
}

function mergeAppointmentTypeSection(metadata, key, value) {
  return {
    ...normalizeMetadata(metadata),
    [key]: value,
    updated_by_route: 'scheduler_admin_config',
  };
}

function normalizeIntakeFieldsPayload(payload = {}, fieldId = null) {
  const fields = Array.isArray(payload.fields)
    ? payload.fields
    : [payload].filter((field) => Object.keys(field || {}).length);
  return fields.map((field, index) => ({
    id: field.id || fieldId || null,
    field_key: field.field_key || field.fieldKey || field.name || `custom_${index + 1}`,
    label: field.label || field.field_key || field.name || `Custom field ${index + 1}`,
    field_type: field.field_type || field.fieldType || field.type || 'text',
    display: field.display !== false,
    required: field.required === true || field.required === 'true',
    visibility: field.visibility || 'student_and_staff',
    sort_order: Number(field.sort_order || field.sortOrder || index + 1),
  }));
}

function normalizeAdminConfigPayload(section, payload = {}) {
  if (section === 'notifications') {
    return {
      admin_booked_email: payload.admin_booked_email !== false,
      student_booked_email: payload.student_booked_email !== false,
      admin_canceled_email: payload.admin_canceled_email !== false,
      student_canceled_email: payload.student_canceled_email !== false,
      reminder_schedule: payload.reminder_schedule || payload.reminderSchedule || [],
      sms_reminders: payload.sms_reminders === true || payload.smsReminders === true || payload.sms_reminders === 'true',
      admin_email: payload.admin_email || payload.adminEmail || null,
      notification_opt_in: payload.notification_opt_in === true || payload.notification_opt_in === 'true',
      status: 'not_configured',
    };
  }

  if (section === 'booking-flow') {
    return {
      mode: payload.mode || 'expanded',
      steps: Array.isArray(payload.steps) ? payload.steps : ['type', 'provider', 'date_time', 'intake', 'confirm'],
      confirmation_behavior: payload.confirmation_behavior || payload.confirmationBehavior || 'show_confirmation',
      redirect_url: payload.redirect_url || payload.redirectUrl || null,
    };
  }

  if (section === 'web-meetings') {
    return {
      provider: payload.provider || 'manual',
      auto_generate: payload.auto_generate === true || payload.autoGenerate === true || payload.auto_generate === 'true',
      provider_account_id: payload.provider_account_id || payload.providerAccountId || null,
      manual_url_present: Boolean(payload.meeting_url || payload.meetingUrl),
      meeting_url: payload.meeting_url || payload.meetingUrl || null,
      link_policy: payload.link_policy || payload.linkPolicy || 'after_confirmation',
      status: 'not_configured',
    };
  }

  if (section === 'payments') {
    return {
      mode: payload.mode || 'none',
      provider: payload.provider || 'stripe',
      amount_cents: Number(payload.amount_cents || payload.amountCents || 0),
      currency: String(payload.currency || 'usd').toLowerCase(),
      refund_policy: payload.refund_policy || payload.refundPolicy || null,
      status: 'not_configured',
    };
  }

  return payload;
}

function sanitizeAppointmentTypeForStudent(row = {}) {
  const metadata = normalizeMetadata(row.metadata);
  const config = buildAppointmentTypeAdminConfig(row);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    duration_minutes: row.duration_minutes,
    buffer_before_minutes: row.buffer_before_minutes,
    buffer_after_minutes: row.buffer_after_minutes,
    min_notice_minutes: row.min_notice_minutes,
    max_booking_window_days: row.max_booking_window_days,
    capacity: row.capacity,
    group_enabled: row.group_enabled,
    meeting_mode: publicMeetingMode(row, metadata),
    status: row.status,
    active: row.active,
    student_config: {
      instructions: config.basics.instructions,
      booking_layout: config.basics.booking_layout,
      capacity: config.capacity,
      timezone_mode: config.scheduling_options.timezone_mode,
      intake_fields: getStudentVisibleIntakeFields(metadata),
      booking_flow: config.booking_flow,
      web_meetings: {
        provider: publicMeetingMode(row, metadata),
        link_policy: config.web_meetings.link_policy || 'after_confirmation',
      },
      payments: publicPaymentConfig(config.payments),
    },
  };
}

function publicPaymentConfig(paymentConfig = {}) {
  return {
    mode: paymentConfig.mode || 'none',
    provider: paymentConfig.provider || 'stripe',
    required: paymentConfig.mode === 'required' || paymentConfig.required === true,
    amount_cents: paymentConfig.student_visible === true ? paymentConfig.amount_cents || 0 : 0,
    currency: paymentConfig.currency || 'usd',
    status: paymentConfig.status || 'not_configured',
  };
}

function publicMeetingMode(row = {}, metadata = {}) {
  const config = metadata.web_meetings || {};
  const provider = config.provider || row.meeting_mode || 'manual';
  return ['zoom', 'webex', 'google_meet', 'manual', 'none'].includes(provider) ? provider : 'manual';
}

function getStudentVisibleIntakeFields(metadata = {}) {
  return getIntakeFields(metadata)
    .filter((field) => field.display !== false)
    .filter((field) => !['staff_only', 'admin_only'].includes(String(field.visibility || 'student_and_staff')))
    .map((field) => ({
      id: field.id || null,
      field_key: field.field_key || field.fieldKey || field.name || '',
      label: field.label || field.field_key || field.name || 'Question',
      field_type: field.field_type || field.fieldType || field.type || 'text',
      required: field.required === true,
      sort_order: Number(field.sort_order || field.sortOrder || 100),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function getIntakeFields(metadata = {}) {
  if (Array.isArray(metadata.intake_fields)) return metadata.intake_fields;
  if (Array.isArray(metadata.customer_information?.fields)) return metadata.customer_information.fields;
  if (Array.isArray(metadata.intake?.fields)) return metadata.intake.fields;
  return [];
}

function normalizeIntakeAnswers(answers = []) {
  const answerMap = new Map();
  if (!Array.isArray(answers)) return answerMap;
  for (const answer of answers) {
    const key = String(answer?.field_key || answer?.fieldKey || answer?.id || answer?.field_id || answer?.fieldId || '').trim();
    const value = answer?.answer_text ?? answer?.answerText ?? answer?.value ?? answer?.answer_json ?? answer?.answerJson;
    if (key && value !== undefined && value !== null && String(value).trim() !== '') {
      answerMap.set(key, value);
    }
  }
  return answerMap;
}

function normalizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return metadata;
}

function buildSchedulerCalendarFeedEvents(appointments = [], { providers = [], appointmentTypes = [], start = '', end = '' } = {}) {
  const providerById = new Map((providers || []).map((provider) => [String(provider.id || ''), provider]));
  const typeById = new Map((appointmentTypes || []).map((type) => [String(type.id || ''), type]));
  const startBoundary = parseCalendarBoundary(start);
  const endBoundary = parseCalendarBoundary(end);

  return (appointments || [])
    .map((appointment) => buildSchedulerCalendarFeedEvent(appointment, {
      provider: providerById.get(String(appointment.provider_id || appointment.providerId || '')),
      appointmentType: typeById.get(String(appointment.appointment_type_id || appointment.appointmentTypeId || '')),
    }))
    .filter(Boolean)
    .filter((event) => eventWithinCalendarRange(event, startBoundary, endBoundary));
}

function buildSchedulerCalendarFeedEvent(appointment = {}, { provider = {}, appointmentType = {} } = {}) {
  const appointmentId = appointment.id || appointment.appointment_id || appointment.appointmentId;
  const startAt = appointment.start_at || appointment.startAt;
  if (!appointmentId || !startAt) return null;

  const metadata = normalizeCalendarMetadata(appointment.metadata);
  const typeMetadata = normalizeCalendarMetadata(appointmentType.metadata);
  const providerName = provider.display_name || provider.name || appointment.provider_name || appointment.providerName || 'MissionMed mentor';
  const appointmentTypeName = appointmentType.name || appointment.appointment_type_name || appointment.appointmentTypeName || 'MissionMed appointment';
  const description = appointmentType.description || appointment.description || '';
  const meeting = metadata.scheduler_integrations?.meeting || {};
  const status = String(appointment.status || 'booked');

  return {
    source: 'scheduler',
    source_id: String(appointmentId),
    event_type: 'appointment',
    title: `${appointmentTypeName} with ${providerName}`,
    description,
    start_at: startAt,
    end_at: appointment.end_at || appointment.endAt || null,
    all_day: false,
    location: appointment.location || null,
    meeting_url: appointment.meeting_url || appointment.meetingUrl || null,
    meeting_platform: appointment.meeting_platform || appointment.meetingPlatform || meeting.provider || null,
    category: normalizeCalendarCategory(appointment.category || appointment.division || typeMetadata.division || typeMetadata.category || appointmentType.division || 'appointment'),
    status,
    meta_json: {
      appointment_id: String(appointmentId),
      provider_id: appointment.provider_id || appointment.providerId || null,
      provider_name: providerName,
      appointment_type_id: appointment.appointment_type_id || appointment.appointmentTypeId || null,
      appointment_type: appointmentType.slug || appointmentTypeName,
      can_cancel: !['canceled', 'cancelled', 'completed', 'no_show'].includes(status),
      can_reschedule: !['canceled', 'cancelled', 'completed', 'no_show'].includes(status),
    },
  };
}

function normalizeCalendarMetadata(metadata = {}) {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) return metadata;
  if (typeof metadata === 'string' && metadata.trim()) {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeCalendarCategory(value = 'appointment') {
  const normalized = String(value || 'appointment').trim().toLowerCase().replace(/_/gu, '-');
  return normalized || 'appointment';
}

function parseCalendarBoundary(value = '') {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function eventWithinCalendarRange(event = {}, startBoundary = null, endBoundary = null) {
  const eventStart = Date.parse(event.start_at);
  const eventEnd = event.end_at ? Date.parse(event.end_at) : eventStart;
  if (!Number.isFinite(eventStart)) return false;
  if (startBoundary !== null && Number.isFinite(eventEnd) && eventEnd < startBoundary) return false;
  if (endBoundary !== null && eventStart > endBoundary) return false;
  return true;
}

function defaultNotificationConfig() {
  return {
    admin_booked_email: true,
    student_booked_email: true,
    admin_canceled_email: true,
    student_canceled_email: true,
    reminder_schedule: [],
    notification_opt_in: false,
    status: 'not_configured',
  };
}

function schedulerOk(data = {}) {
  return { ok: true, data };
}

function schedulerError(error, message, details = {}) {
  return { ok: false, error, message, ...details };
}

function redactProviderNote(note = {}) {
  return {
    id: note.id || null,
    appointment_id: note.appointment_id || null,
    provider_id: note.provider_id || null,
    visibility: note.visibility || 'staff_only',
    created_at: note.created_at || null,
  };
}

function safeEligibilityDecision(decision = {}) {
  return {
    status: decision.status || 'unknown',
    eligible: Boolean(decision.eligible),
    reason: decision.reason || null,
    mode: decision.mode || null,
    checked: decision.checked || {},
  };
}

function isMutationMethod(method = 'GET') {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase());
}

async function readBody(readJsonBody, request) {
  if (typeof readJsonBody !== 'function') return {};
  try {
    return await readJsonBody(request);
  } catch {
    return {};
  }
}

function methodNotAllowed(sendMethodNotAllowed, response, methods) {
  if (typeof sendMethodNotAllowed === 'function') {
    sendMethodNotAllowed(response, methods);
    return true;
  }
  response.writeHead(405, { Allow: methods.join(', ') });
  response.end();
  return true;
}
