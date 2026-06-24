import crypto from 'node:crypto';

// MM-SCHED-012 foundation only: pure booking rules with no live provider calls.
const ACTIVE_APPOINTMENT_STATUSES = new Set(['held', 'booked', 'confirmed']);
const DEFAULT_TIMEZONE = 'America/New_York';

export class SchedulerValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SchedulerValidationError';
    this.code = code;
    this.status = 400;
    this.details = details;
  }
}

export class SchedulerConflictError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SchedulerConflictError';
    this.code = code;
    this.status = 409;
    this.details = details;
  }
}

export function createSchedulerMemoryStore(seed = {}) {
  return {
    appointments: Array.isArray(seed.appointments) ? [...seed.appointments] : [],
    auditEvents: Array.isArray(seed.auditEvents) ? [...seed.auditEvents] : [],
    notifications: Array.isArray(seed.notifications) ? [...seed.notifications] : [],
    idempotency: seed.idempotency instanceof Map ? new Map(seed.idempotency) : new Map(),
    locks: new Set(),
  };
}

export function normalizeSchedulerTimezone(timezone, fallback = DEFAULT_TIMEZONE) {
  const candidate = String(timezone || '').trim();
  const fallbackTimezone = String(fallback || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;

  for (const value of [candidate, fallbackTimezone, 'UTC']) {
    if (!value) continue;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
      return value;
    } catch {
      // Try the next candidate.
    }
  }

  return 'UTC';
}

export function generateAvailabilitySlots({
  availabilityRules = [],
  appointmentType = {},
  providerId = '',
  resourceId = '',
  startDate,
  endDate,
  now = new Date(),
  stepMinutes = null,
  blackouts = [],
  existingAppointments = [],
  externalBusyBlocks = [],
} = {}) {
  const durationMinutes = positiveInteger(appointmentType.duration_minutes ?? appointmentType.durationMinutes, 30);
  const metadata = normalizeMetadata(appointmentType.metadata);
  const metadataInterval = metadata.interval_minutes
    ?? metadata.start_interval_minutes
    ?? metadata.availability?.interval_minutes
    ?? metadata.availability?.start_interval_minutes;
  const normalizedStep = positiveInteger(stepMinutes || metadataInterval, 15);
  const rangeStart = parseDateOrThrow(startDate, 'startDate');
  const rangeEnd = parseDateOrThrow(endDate, 'endDate');

  if (rangeEnd <= rangeStart) {
    throw new SchedulerValidationError('invalid_date_range', 'endDate must be after startDate.');
  }

  const slotsByKey = new Map();
  for (const rule of availabilityRules.filter((item) => item && item.active !== false && item.status !== 'inactive')) {
    if (!ruleMatchesScope(rule, { providerId, resourceId, appointmentTypeId: appointmentType.id })) {
      continue;
    }

    const timezone = normalizeSchedulerTimezone(rule.timezone || appointmentType.timezone);
    const effectiveStart = rule.effective_start || rule.effectiveStart
      ? startOfUtcDate(rule.effective_start || rule.effectiveStart)
      : rangeStart;
    const effectiveEnd = rule.effective_end || rule.effectiveEnd
      ? endOfUtcDate(rule.effective_end || rule.effectiveEnd)
      : rangeEnd;
    const ruleStart = Math.max(rangeStart.getTime(), effectiveStart.getTime());
    const ruleEnd = Math.min(rangeEnd.getTime(), effectiveEnd.getTime());
    const ruleDays = normalizeDaySet(rule.day_of_week ?? rule.dayOfWeek);
    const startMinute = parseClockMinutes(rule.start_time ?? rule.startTime);
    const endMinute = parseClockMinutes(rule.end_time ?? rule.endTime);

    if (endMinute <= startMinute) {
      continue;
    }

    for (
      let cursor = ceilToStep(new Date(ruleStart), normalizedStep);
      cursor.getTime() + durationMinutes * 60_000 <= ruleEnd;
      cursor = new Date(cursor.getTime() + normalizedStep * 60_000)
    ) {
      const local = getZonedParts(cursor, timezone);
      if (ruleDays.size > 0 && !ruleDays.has(local.dayOfWeek)) {
        continue;
      }

      const localStartMinute = local.hour * 60 + local.minute;
      const localEndMinute = localStartMinute + durationMinutes;
      if (localStartMinute < startMinute || localEndMinute > endMinute) {
        continue;
      }

      const slot = {
        startAt: cursor.toISOString(),
        endAt: new Date(cursor.getTime() + durationMinutes * 60_000).toISOString(),
        providerId: providerId || rule.provider_id || rule.providerId || null,
        resourceId: resourceId || rule.resource_id || rule.resourceId || null,
        appointmentTypeId: appointmentType.id || rule.appointment_type_id || rule.appointmentTypeId || null,
        timezone,
        available: true,
      };

      if (!checkMinimumNotice(slot, { now, minNoticeMinutes: appointmentType.min_notice_minutes ?? appointmentType.minNoticeMinutes }).ok) continue;
      if (!checkMaximumBookingWindow(slot, { now, maxBookingWindowDays: appointmentType.max_booking_window_days ?? appointmentType.maxBookingWindowDays }).ok) continue;
      if (!checkBlackoutConflicts(slot, blackouts).ok) continue;
      if (!checkExistingAppointmentConflicts(slot, existingAppointments, {
        providerId: slot.providerId,
        bufferBeforeMinutes: appointmentType.buffer_before_minutes ?? appointmentType.bufferBeforeMinutes,
        bufferAfterMinutes: appointmentType.buffer_after_minutes ?? appointmentType.bufferAfterMinutes,
      }).ok) continue;
      if (!checkResourceConflicts(slot, existingAppointments, {
        resourceId: slot.resourceId,
        bufferBeforeMinutes: appointmentType.buffer_before_minutes ?? appointmentType.bufferBeforeMinutes,
        bufferAfterMinutes: appointmentType.buffer_after_minutes ?? appointmentType.bufferAfterMinutes,
      }).ok) continue;
      if (!checkExternalBusyConflicts(slot, externalBusyBlocks).ok) continue;

      slotsByKey.set(`${slot.providerId || ''}:${slot.resourceId || ''}:${slot.startAt}:${slot.endAt}`, slot);
    }
  }

  return [...slotsByKey.values()].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

function normalizeMetadata(value = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function checkProviderAvailability(slot, availabilitySlots = []) {
  const normalizedSlot = normalizeSlot(slot);
  const available = availabilitySlots.some((candidate) => {
    const normalizedCandidate = normalizeSlot(candidate);
    return normalizedCandidate.startAt.getTime() === normalizedSlot.startAt.getTime()
      && normalizedCandidate.endAt.getTime() === normalizedSlot.endAt.getTime()
      && (!normalizedSlot.providerId || !normalizedCandidate.providerId || normalizedSlot.providerId === normalizedCandidate.providerId);
  });

  return available
    ? { ok: true }
    : { ok: false, code: 'provider_unavailable', message: 'The provider is not available for the requested slot.' };
}

export function checkBlackoutConflicts(slot, blackouts = []) {
  const normalizedSlot = normalizeSlot(slot);
  const conflicts = blackouts.filter((blackout) => {
    if (!blackout || blackout.active === false || blackout.status === 'inactive') return false;
    if (!scopeMatchesCandidate(blackout, normalizedSlot)) return false;
    return rangesOverlap(
      normalizedSlot.startAt,
      normalizedSlot.endAt,
      parseDateOrThrow(blackout.start_at ?? blackout.startAt, 'blackout.startAt'),
      parseDateOrThrow(blackout.end_at ?? blackout.endAt, 'blackout.endAt'),
    );
  });

  return conflicts.length
    ? { ok: false, code: 'blackout_conflict', message: 'The requested slot overlaps a blackout window.', conflicts }
    : { ok: true, conflicts: [] };
}

export function checkExistingAppointmentConflicts(slot, appointments = [], options = {}) {
  const normalizedSlot = normalizeSlot(slot);
  const bufferBeforeMinutes = nonNegativeInteger(options.bufferBeforeMinutes ?? options.buffer_before_minutes, 0);
  const bufferAfterMinutes = nonNegativeInteger(options.bufferAfterMinutes ?? options.buffer_after_minutes, 0);
  const candidate = expandRange(normalizedSlot.startAt, normalizedSlot.endAt, bufferBeforeMinutes, bufferAfterMinutes);
  const providerId = String(options.providerId || normalizedSlot.providerId || '').trim();

  const conflicts = appointments.filter((appointment) => {
    if (!isActiveAppointment(appointment)) return false;
    if (providerId && String(appointment.provider_id || appointment.providerId || '') !== providerId) return false;
    const existing = expandRange(
      parseDateOrThrow(appointment.start_at ?? appointment.startAt, 'appointment.startAt'),
      parseDateOrThrow(appointment.end_at ?? appointment.endAt, 'appointment.endAt'),
      nonNegativeInteger(appointment.buffer_before_minutes ?? appointment.bufferBeforeMinutes, 0),
      nonNegativeInteger(appointment.buffer_after_minutes ?? appointment.bufferAfterMinutes, 0),
    );
    return rangesOverlap(candidate.startAt, candidate.endAt, existing.startAt, existing.endAt);
  });

  return conflicts.length
    ? { ok: false, code: 'provider_conflict', message: 'The requested slot overlaps an existing provider appointment.', conflicts }
    : { ok: true, conflicts: [] };
}

export function checkResourceConflicts(slot, appointments = [], options = {}) {
  const normalizedSlot = normalizeSlot(slot);
  const resourceId = String(options.resourceId || normalizedSlot.resourceId || '').trim();
  if (!resourceId) {
    return { ok: true, conflicts: [] };
  }

  const candidate = expandRange(
    normalizedSlot.startAt,
    normalizedSlot.endAt,
    nonNegativeInteger(options.bufferBeforeMinutes ?? options.buffer_before_minutes, 0),
    nonNegativeInteger(options.bufferAfterMinutes ?? options.buffer_after_minutes, 0),
  );
  const conflicts = appointments.filter((appointment) => {
    if (!isActiveAppointment(appointment)) return false;
    if (String(appointment.resource_id || appointment.resourceId || '') !== resourceId) return false;
    const existing = expandRange(
      parseDateOrThrow(appointment.start_at ?? appointment.startAt, 'appointment.startAt'),
      parseDateOrThrow(appointment.end_at ?? appointment.endAt, 'appointment.endAt'),
      nonNegativeInteger(appointment.buffer_before_minutes ?? appointment.bufferBeforeMinutes, 0),
      nonNegativeInteger(appointment.buffer_after_minutes ?? appointment.bufferAfterMinutes, 0),
    );
    return rangesOverlap(
      candidate.startAt,
      candidate.endAt,
      existing.startAt,
      existing.endAt,
    );
  });

  return conflicts.length
    ? { ok: false, code: 'resource_conflict', message: 'The requested slot overlaps an existing resource booking.', conflicts }
    : { ok: true, conflicts: [] };
}

export function checkGroupCapacity(scheduleEvent = {}) {
  if (!scheduleEvent || scheduleEvent.capacity == null) {
    return { ok: true };
  }

  const capacity = Number(scheduleEvent.capacity);
  const reserved = Number(scheduleEvent.reserved_count ?? scheduleEvent.reservedCount ?? 0);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return { ok: false, code: 'invalid_capacity', message: 'Schedule event capacity is invalid.' };
  }

  return reserved < capacity
    ? { ok: true, remaining: capacity - reserved }
    : { ok: false, code: 'capacity_full', message: 'The selected session is full.' };
}

export function checkMinimumNotice(slot, { now = new Date(), minNoticeMinutes = 0 } = {}) {
  const normalizedSlot = normalizeSlot(slot);
  const noticeMs = nonNegativeInteger(minNoticeMinutes, 0) * 60_000;
  const earliest = parseDateOrThrow(now, 'now').getTime() + noticeMs;
  return normalizedSlot.startAt.getTime() >= earliest
    ? { ok: true }
    : { ok: false, code: 'minimum_notice_violation', message: 'The requested slot is inside the minimum notice window.' };
}

export function checkMaximumBookingWindow(slot, { now = new Date(), maxBookingWindowDays = 365 } = {}) {
  const normalizedSlot = normalizeSlot(slot);
  const days = nonNegativeInteger(maxBookingWindowDays, 365);
  const latest = parseDateOrThrow(now, 'now').getTime() + days * 24 * 60 * 60_000;
  return normalizedSlot.startAt.getTime() <= latest
    ? { ok: true }
    : { ok: false, code: 'maximum_window_violation', message: 'The requested slot is outside the maximum booking window.' };
}

export function selectProviderByAssignmentRule({ providers = [], selectedProviderId = '', assignmentRule = {} } = {}) {
  const activeProviders = providers.filter((provider) => provider && provider.active !== false && provider.status !== 'inactive');
  const mode = String(assignmentRule.mode || (selectedProviderId ? 'selected' : 'single')).trim();

  if (selectedProviderId) {
    const selected = activeProviders.find((provider) => String(provider.id) === String(selectedProviderId));
    if (!selected) {
      return { ok: false, code: 'provider_not_available', message: 'Selected provider is not available for this appointment type.' };
    }
    return { ok: true, provider: selected, mode: 'selected' };
  }

  if (activeProviders.length === 0) {
    return { ok: false, code: 'provider_pool_empty', message: 'No active providers are available.' };
  }

  if (mode === 'all_team') {
    return { ok: true, providers: activeProviders, mode };
  }

  if (mode === 'round_robin') {
    const lastId = String(assignmentRule.last_assigned_provider_id || assignmentRule.lastAssignedProviderId || '');
    const lastIndex = activeProviders.findIndex((provider) => String(provider.id) === lastId);
    return { ok: true, provider: activeProviders[(lastIndex + 1) % activeProviders.length], mode };
  }

  if (mode === 'random') {
    const index = Math.floor(Math.random() * Math.max(1, activeProviders.length));
    return { ok: true, provider: activeProviders[index], mode };
  }

  if (activeProviders.length === 1 || mode === 'single' || mode === 'manual') {
    return activeProviders[0]
      ? { ok: true, provider: activeProviders[0], mode: activeProviders.length === 1 ? 'single' : mode }
      : { ok: false, code: 'provider_pool_empty', message: 'No active providers are available.' };
  }

  return { ok: false, code: 'provider_assignment_unsupported', message: `Provider assignment mode ${mode} is not supported yet.` };
}

export function validateAppointmentEligibility({ eligibilityResult = null, appointmentType = {} } = {}) {
  if (!appointmentType || appointmentType.active === false || appointmentType.status === 'archived') {
    return { ok: false, code: 'appointment_type_inactive', message: 'This appointment type is not active.' };
  }

  if (!eligibilityResult) {
    return { ok: true, mode: 'not_configured' };
  }

  if (eligibilityResult.eligible === true || eligibilityResult.ok === true) {
    return { ok: true, mode: eligibilityResult.mode || 'evaluated' };
  }

  return {
    ok: false,
    code: eligibilityResult.code || 'not_eligible',
    message: eligibilityResult.message || 'Student is not eligible for this appointment type.',
    reason: eligibilityResult.reason || 'unknown',
  };
}

export function createAppointmentTransaction({ store = createSchedulerMemoryStore(), request = {}, now = new Date() } = {}) {
  const idempotencyKey = requireString(request.idempotencyKey ?? request.idempotency_key, 'idempotencyKey');
  const payloadFingerprint = stableFingerprint({
    action: 'book',
    studentUserId: request.studentUserId ?? request.student_user_id,
    providerId: request.providerId ?? request.provider_id,
    resourceId: request.resourceId ?? request.resource_id,
    scheduleEventId: request.scheduleEventId ?? request.schedule_event_id,
    appointmentTypeId: request.appointmentTypeId ?? request.appointment_type_id ?? request.appointmentType?.id,
    startAt: request.startAt ?? request.start_at,
    endAt: request.endAt ?? request.end_at,
    intakeAnswers: request.intakeAnswers ?? request.intake_answers ?? [],
  });

  const replay = readIdempotentResult(store, idempotencyKey, payloadFingerprint);
  if (replay) return replay;

  const appointmentType = request.appointmentType || {};
  const slot = normalizeSlot({
    startAt: request.startAt ?? request.start_at,
    endAt: request.endAt ?? request.end_at,
    providerId: request.providerId ?? request.provider_id,
    resourceId: request.resourceId ?? request.resource_id,
    appointmentTypeId: request.appointmentTypeId ?? request.appointment_type_id ?? appointmentType.id,
    timezone: request.timezone || appointmentType.timezone,
  });

  const lockKey = buildBookingLockKey(slot, request.scheduleEventId ?? request.schedule_event_id);
  acquireMemoryLock(store, lockKey);

  try {
    const eligibility = validateAppointmentEligibility({ eligibilityResult: request.eligibilityResult, appointmentType });
    assertCheck(eligibility);
    assertCheck(checkMinimumNotice(slot, { now, minNoticeMinutes: appointmentType.min_notice_minutes ?? appointmentType.minNoticeMinutes }));
    assertCheck(checkMaximumBookingWindow(slot, { now, maxBookingWindowDays: appointmentType.max_booking_window_days ?? appointmentType.maxBookingWindowDays }));
    assertCheck(checkBlackoutConflicts(slot, request.blackouts || []));
    assertCheck(checkExistingAppointmentConflicts(slot, [...store.appointments, ...(request.existingAppointments || [])], {
      providerId: slot.providerId,
      bufferBeforeMinutes: appointmentType.buffer_before_minutes ?? appointmentType.bufferBeforeMinutes,
      bufferAfterMinutes: appointmentType.buffer_after_minutes ?? appointmentType.bufferAfterMinutes,
    }));
    assertCheck(checkResourceConflicts(slot, [...store.appointments, ...(request.existingAppointments || [])], {
      resourceId: slot.resourceId,
      bufferBeforeMinutes: appointmentType.buffer_before_minutes ?? appointmentType.bufferBeforeMinutes,
      bufferAfterMinutes: appointmentType.buffer_after_minutes ?? appointmentType.bufferAfterMinutes,
    }));

    if (request.scheduleEvent) {
      assertCheck(checkGroupCapacity(request.scheduleEvent));
      request.scheduleEvent.reserved_count = Number(request.scheduleEvent.reserved_count ?? request.scheduleEvent.reservedCount ?? 0) + 1;
      request.scheduleEvent.reservedCount = request.scheduleEvent.reserved_count;
    }

    const appointment = {
      id: request.id || crypto.randomUUID(),
      student_user_id: requireString(request.studentUserId ?? request.student_user_id, 'studentUserId'),
      student_wp_user_id: request.studentWpUserId ?? request.student_wp_user_id ?? null,
      appointment_type_id: requireString(slot.appointmentTypeId, 'appointmentTypeId'),
      provider_id: slot.providerId || null,
      resource_id: slot.resourceId || null,
      schedule_event_id: request.scheduleEventId ?? request.schedule_event_id ?? null,
      start_at: slot.startAt.toISOString(),
      end_at: slot.endAt.toISOString(),
      timezone: normalizeSchedulerTimezone(slot.timezone),
      buffer_before_minutes: nonNegativeInteger(appointmentType.buffer_before_minutes ?? appointmentType.bufferBeforeMinutes, 0),
      buffer_after_minutes: nonNegativeInteger(appointmentType.buffer_after_minutes ?? appointmentType.bufferAfterMinutes, 0),
      status: 'booked',
      idempotency_key: idempotencyKey,
      meeting_url: null,
      external_event_status: 'not_configured',
      created_at: parseDateOrThrow(now, 'now').toISOString(),
      updated_at: parseDateOrThrow(now, 'now').toISOString(),
    };

    store.appointments.push(appointment);
    const auditEvent = writeSchedulerAuditEvent(store, {
      entityType: 'appointment',
      entityId: appointment.id,
      action: 'appointment.created',
      actorType: request.actorType || 'student',
      actorId: request.actorId || appointment.student_user_id,
      idempotencyKey,
      after: appointment,
    });
    const notification = enqueueSchedulerNotificationPlaceholder(store, {
      appointmentId: appointment.id,
      templateKey: 'appointment_booked',
      recipientRole: 'student',
      scheduledAt: appointment.created_at,
      idempotencyKey: `${idempotencyKey}:confirmation`,
    });
    const result = { ok: true, appointment, auditEvent, notification, idempotentReplay: false };
    writeIdempotentResult(store, idempotencyKey, payloadFingerprint, result);
    return result;
  } finally {
    releaseMemoryLock(store, lockKey);
  }
}

export function rescheduleAppointmentTransaction({ store = createSchedulerMemoryStore(), request = {}, now = new Date() } = {}) {
  const idempotencyKey = requireString(request.idempotencyKey ?? request.idempotency_key, 'idempotencyKey');
  const appointmentId = requireString(request.appointmentId ?? request.appointment_id, 'appointmentId');
  const payloadFingerprint = stableFingerprint({
    action: 'reschedule',
    appointmentId,
    providerId: request.providerId ?? request.provider_id,
    resourceId: request.resourceId ?? request.resource_id,
    appointmentTypeId: request.appointmentTypeId ?? request.appointment_type_id ?? request.appointmentType?.id,
    startAt: request.startAt ?? request.start_at,
    endAt: request.endAt ?? request.end_at,
    intakeAnswers: request.intakeAnswers ?? request.intake_answers ?? [],
  });
  const replay = readIdempotentResult(store, idempotencyKey, payloadFingerprint);
  if (replay) return replay;

  const existingIndex = store.appointments.findIndex((appointment) => String(appointment.id) === appointmentId);
  const existing = store.appointments[existingIndex];
  if (!existing || !isActiveAppointment(existing)) {
    throw new SchedulerValidationError('appointment_not_reschedulable', 'Appointment cannot be rescheduled.');
  }

  const nowIso = parseDateOrThrow(now, 'now').toISOString();
  const before = { ...existing };
  const replacementRequest = {
    ...request,
    idempotencyKey: `${idempotencyKey}:replacement`,
    studentUserId: existing.student_user_id,
    studentWpUserId: existing.student_wp_user_id,
    appointmentTypeId: request.appointmentTypeId ?? request.appointment_type_id ?? existing.appointment_type_id,
    providerId: request.providerId ?? request.provider_id ?? existing.provider_id,
    resourceId: request.resourceId ?? request.resource_id ?? existing.resource_id,
    scheduleEvent: request.scheduleEvent ? { ...request.scheduleEvent } : request.scheduleEvent,
    rescheduledFromId: existing.id,
    actorType: request.actorType || 'student',
    actorId: request.actorId || existing.student_user_id,
  };

  const stagedAppointments = store.appointments.map((appointment, index) => (
    index === existingIndex
      ? { ...appointment, status: 'rescheduled', updated_at: nowIso }
      : { ...appointment }
  ));
  const stagedStore = createSchedulerMemoryStore({
    appointments: stagedAppointments,
    auditEvents: store.auditEvents,
    notifications: store.notifications,
    idempotency: store.idempotency,
  });

  // Validate the replacement against a staged view before mutating the live in-memory state.
  createAppointmentTransaction({ store: stagedStore, request: replacementRequest, now });

  const appointmentCountBefore = store.appointments.length;
  const auditCountBefore = store.auditEvents.length;
  const notificationCountBefore = store.notifications.length;
  const scheduleEventBefore = request.scheduleEvent
    ? {
        reserved_count: request.scheduleEvent.reserved_count,
        reservedCount: request.scheduleEvent.reservedCount,
      }
    : null;

  try {
    existing.status = 'rescheduled';
    existing.updated_at = nowIso;
    const created = createAppointmentTransaction({ store, request: replacementRequest, now });
    created.appointment.rescheduled_from_id = existing.id;
    created.appointment.idempotency_key = idempotencyKey;
    const rescheduleAuditEvent = writeSchedulerAuditEvent(store, {
      entityType: 'appointment',
      entityId: existing.id,
      action: 'appointment.rescheduled',
      actorType: request.actorType || 'student',
      actorId: request.actorId || existing.student_user_id,
      idempotencyKey,
      before,
      after: existing,
    });
    const result = { ...created, rescheduleAuditEvent, idempotentReplay: false };
    writeIdempotentResult(store, idempotencyKey, payloadFingerprint, result);
    return result;
  } catch (error) {
    Object.assign(existing, before);
    store.appointments.splice(appointmentCountBefore);
    store.auditEvents.splice(auditCountBefore);
    store.notifications.splice(notificationCountBefore);
    if (request.scheduleEvent && scheduleEventBefore) {
      request.scheduleEvent.reserved_count = scheduleEventBefore.reserved_count;
      request.scheduleEvent.reservedCount = scheduleEventBefore.reservedCount;
    }
    throw error;
  }
}

export function cancelAppointmentTransaction({ store = createSchedulerMemoryStore(), request = {}, now = new Date() } = {}) {
  const idempotencyKey = requireString(request.idempotencyKey ?? request.idempotency_key, 'idempotencyKey');
  const appointmentId = requireString(request.appointmentId ?? request.appointment_id, 'appointmentId');
  const payloadFingerprint = stableFingerprint({ action: 'cancel', appointmentId, reason: request.reason || '' });
  const replay = readIdempotentResult(store, idempotencyKey, payloadFingerprint);
  if (replay) return replay;

  const existing = store.appointments.find((appointment) => String(appointment.id) === appointmentId);
  if (!existing || !isActiveAppointment(existing)) {
    throw new SchedulerValidationError('appointment_not_cancelable', 'Appointment cannot be canceled.');
  }

  const before = { ...existing };
  existing.status = 'canceled';
  existing.canceled_at = parseDateOrThrow(now, 'now').toISOString();
  existing.canceled_by = request.actorId || existing.student_user_id;
  existing.updated_at = existing.canceled_at;
  const auditEvent = writeSchedulerAuditEvent(store, {
    entityType: 'appointment',
    entityId: existing.id,
    action: 'appointment.canceled',
    actorType: request.actorType || 'student',
    actorId: request.actorId || existing.student_user_id,
    idempotencyKey,
    before,
    after: existing,
  });
  const result = { ok: true, appointment: existing, auditEvent, idempotentReplay: false };
  writeIdempotentResult(store, idempotencyKey, payloadFingerprint, result);
  return result;
}

export function writeSchedulerAuditEvent(store, event = {}) {
  const auditEvent = {
    id: event.id || crypto.randomUUID(),
    entity_type: requireString(event.entityType ?? event.entity_type, 'entityType'),
    entity_id: event.entityId ?? event.entity_id ?? null,
    action: requireString(event.action, 'action'),
    actor_type: event.actorType ?? event.actor_type ?? 'system',
    actor_id: event.actorId ?? event.actor_id ?? null,
    request_id: event.requestId ?? event.request_id ?? crypto.randomUUID(),
    idempotency_key: event.idempotencyKey ?? event.idempotency_key ?? null,
    before_json: event.before ?? event.before_json ?? null,
    after_json: event.after ?? event.after_json ?? null,
    created_at: new Date().toISOString(),
  };
  store.auditEvents.push(auditEvent);
  return auditEvent;
}

export function enqueueSchedulerNotificationPlaceholder(store, notification = {}) {
  const queued = {
    id: notification.id || crypto.randomUUID(),
    appointment_id: requireString(notification.appointmentId ?? notification.appointment_id, 'appointmentId'),
    channel: notification.channel || 'email',
    template_key: requireString(notification.templateKey ?? notification.template_key, 'templateKey'),
    recipient_role: notification.recipientRole ?? notification.recipient_role ?? 'student',
    scheduled_at: parseDateOrThrow(notification.scheduledAt ?? notification.scheduled_at ?? new Date(), 'scheduledAt').toISOString(),
    status: 'pending',
    idempotency_key: notification.idempotencyKey ?? notification.idempotency_key ?? null,
    provider_message_id: null,
    last_error: null,
    placeholder: true,
  };
  store.notifications.push(queued);
  return queued;
}

export function sanitizeAppointmentForStudent(appointment = {}) {
  const {
    staff_notes: _staffNotes,
    staffNotes: _staffNotesCamel,
    private_notes: _privateNotes,
    privateNotes: _privateNotesCamel,
    ...safe
  } = appointment;

  if (safe.metadata && typeof safe.metadata === 'object') {
    const { staff_notes: _metadataStaffNotes, private_notes: _metadataPrivateNotes, ...metadata } = safe.metadata;
    if (metadata.scheduler_integrations && typeof metadata.scheduler_integrations === 'object') {
      const meeting = metadata.scheduler_integrations.meeting;
      if (meeting && typeof meeting === 'object') {
        const {
          external_event_id: _externalEventId,
          externalEventId: _externalEventIdCamel,
          webex_meeting_id: _webexMeetingId,
          webexMeetingId: _webexMeetingIdCamel,
          zoom_meeting_id: _zoomMeetingId,
          zoomMeetingId: _zoomMeetingIdCamel,
          invitee_id: _inviteeId,
          inviteeId: _inviteeIdCamel,
          host_key: _hostKey,
          hostKey: _hostKeyCamel,
          host_url: _hostUrl,
          hostUrl: _hostUrlCamel,
          start_url: _startUrl,
          startUrl: _startUrlCamel,
          access_token: _accessToken,
          accessToken: _accessTokenCamel,
          refresh_token: _refreshToken,
          refreshToken: _refreshTokenCamel,
          bearer_token: _bearerToken,
          bearerToken: _bearerTokenCamel,
          ...safeMeeting
        } = meeting;
        metadata.scheduler_integrations = {
          ...metadata.scheduler_integrations,
          meeting: safeMeeting,
        };
      }
      if (metadata.scheduler_integrations.booking_student && typeof metadata.scheduler_integrations.booking_student === 'object') {
        const {
          email: _bookingStudentEmail,
          wp_user_id: _bookingStudentWpUserId,
          wpUserId: _bookingStudentWpUserIdCamel,
          ...safeBookingStudent
        } = metadata.scheduler_integrations.booking_student;
        metadata.scheduler_integrations = {
          ...metadata.scheduler_integrations,
          booking_student: safeBookingStudent,
        };
      }
    }
    safe.metadata = metadata;
  }

  return safe;
}

export function canStudentReadAppointment(studentUserId, appointment = {}) {
  return String(studentUserId || '') !== '' && String(appointment.student_user_id || appointment.studentUserId || '') === String(studentUserId);
}

export function canProviderReadAppointment(providerId, appointment = {}) {
  return String(providerId || '') !== '' && String(appointment.provider_id || appointment.providerId || '') === String(providerId);
}

function checkExternalBusyConflicts(slot, blocks = []) {
  const normalizedSlot = normalizeSlot(slot);
  const conflicts = blocks.filter((block) => {
    if (!block || block.busy === false || block.sync_state === 'deleted') return false;
    if (!scopeMatchesCandidate(block, normalizedSlot)) return false;
    return rangesOverlap(
      normalizedSlot.startAt,
      normalizedSlot.endAt,
      parseDateOrThrow(block.start_at ?? block.startAt, 'busy.startAt'),
      parseDateOrThrow(block.end_at ?? block.endAt, 'busy.endAt'),
    );
  });

  return conflicts.length
    ? { ok: false, code: 'external_busy_conflict', message: 'The requested slot overlaps an external calendar busy block.', conflicts }
    : { ok: true, conflicts: [] };
}

function readIdempotentResult(store, key, fingerprint) {
  const existing = store.idempotency.get(key);
  if (!existing) return null;
  if (existing.fingerprint !== fingerprint) {
    throw new SchedulerConflictError('idempotency_key_conflict', 'Idempotency key was reused with a different payload.');
  }
  return { ...existing.result, idempotentReplay: true };
}

function writeIdempotentResult(store, key, fingerprint, result) {
  store.idempotency.set(key, { fingerprint, result });
}

function assertCheck(result) {
  if (result?.ok) return;
  throw new SchedulerConflictError(result?.code || 'scheduler_conflict', result?.message || 'Scheduler conflict.', result);
}

function buildBookingLockKey(slot, scheduleEventId = '') {
  return [
    'book',
    slot.providerId || 'no-provider',
    slot.resourceId || 'no-resource',
    scheduleEventId || 'no-event',
    slot.startAt.toISOString(),
    slot.endAt.toISOString(),
  ].join(':');
}

function acquireMemoryLock(store, lockKey) {
  if (store.locks.has(lockKey)) {
    throw new SchedulerConflictError('booking_lock_conflict', 'A concurrent booking operation is already processing this slot.');
  }
  store.locks.add(lockKey);
}

function releaseMemoryLock(store, lockKey) {
  store.locks.delete(lockKey);
}

function stableFingerprint(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeSlot(slot = {}) {
  return {
    startAt: parseDateOrThrow(slot.startAt ?? slot.start_at, 'slot.startAt'),
    endAt: parseDateOrThrow(slot.endAt ?? slot.end_at, 'slot.endAt'),
    providerId: String(slot.providerId ?? slot.provider_id ?? '').trim(),
    resourceId: String(slot.resourceId ?? slot.resource_id ?? '').trim(),
    appointmentTypeId: String(slot.appointmentTypeId ?? slot.appointment_type_id ?? '').trim(),
    timezone: normalizeSchedulerTimezone(slot.timezone),
  };
}

function parseDateOrThrow(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) {
    throw new SchedulerValidationError('invalid_datetime', `${label} must be a valid date/time.`);
  }
  return date;
}

function parseClockMinutes(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/u);
  if (!match) return 0;
  return Math.min(24 * 60, Number(match[1]) * 60 + Number(match[2]));
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function requireString(value, label) {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new SchedulerValidationError('missing_required_field', `${label} is required.`);
  }
  return text;
}

function isActiveAppointment(appointment = {}) {
  return appointment.deleted_at == null
    && appointment.deletedAt == null
    && ACTIVE_APPOINTMENT_STATUSES.has(String(appointment.status || 'booked'));
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function expandRange(startAt, endAt, bufferBeforeMinutes = 0, bufferAfterMinutes = 0) {
  return {
    startAt: new Date(startAt.getTime() - nonNegativeInteger(bufferBeforeMinutes, 0) * 60_000),
    endAt: new Date(endAt.getTime() + nonNegativeInteger(bufferAfterMinutes, 0) * 60_000),
  };
}

function ruleMatchesScope(rule, candidate = {}) {
  return scopeMatchesCandidate(rule, {
    providerId: candidate.providerId,
    resourceId: candidate.resourceId,
    appointmentTypeId: candidate.appointmentTypeId,
  });
}

function scopeMatchesCandidate(scope = {}, candidate = {}) {
  const scopeProvider = String(scope.provider_id ?? scope.providerId ?? '').trim();
  const scopeResource = String(scope.resource_id ?? scope.resourceId ?? '').trim();
  const scopeType = String(scope.appointment_type_id ?? scope.appointmentTypeId ?? '').trim();
  if (scopeProvider && candidate.providerId && scopeProvider !== String(candidate.providerId)) return false;
  if (scopeResource && candidate.resourceId && scopeResource !== String(candidate.resourceId)) return false;
  if (scopeType && candidate.appointmentTypeId && scopeType !== String(candidate.appointmentTypeId)) return false;
  return true;
}

function normalizeDaySet(value) {
  if (Array.isArray(value)) {
    return new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6));
  }
  if (value == null || value === '') {
    return new Set();
  }
  return new Set([Number(value)].filter((item) => Number.isInteger(item) && item >= 0 && item <= 6));
}

function ceilToStep(date, stepMinutes) {
  const stepMs = stepMinutes * 60_000;
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
}

function startOfUtcDate(value) {
  const date = parseDateOrThrow(value, 'date');
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDate(value) {
  return new Date(startOfUtcDate(value).getTime() + 24 * 60 * 60_000 - 1);
}

const formatterCache = new Map();

function getZonedParts(date, timeZone) {
  const normalizedZone = normalizeSchedulerTimezone(timeZone);
  const cacheKey = normalizedZone;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: normalizedZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(cacheKey, formatter);
  }

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dayOfWeek: weekdayMap[parts.weekday] ?? 0,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}
