import {
  cancelAppointmentTransaction,
  createAppointmentTransaction,
  createSchedulerMemoryStore,
  generateAvailabilitySlots,
  rescheduleAppointmentTransaction,
  sanitizeAppointmentForStudent,
} from './engine.mjs';
import {
  createSchedulerTransactionAdapter,
  describeSchedulerTransactionContract,
  SchedulerTransactionNotConfiguredError,
} from './transactions.mjs';

const DEFAULT_TIMEOUT_MS = 6500;

const TABLES = {
  providers: 'mm_schedule_providers',
  resources: 'mm_schedule_resources',
  appointmentTypes: 'mm_appointment_types',
  providerAppointmentTypes: 'mm_provider_appointment_types',
  availability: 'mm_availability_rules',
  blackouts: 'mm_blackout_windows',
  scheduleEvents: 'mm_schedule_events',
  appointments: 'mm_appointments',
  privateNotes: 'mm_appointment_private_notes',
  intakeAnswers: 'mm_appointment_intake_answers',
  notifications: 'mm_appointment_notifications',
  audit: 'mm_appointment_audit_log',
};

const ADMIN_COLLECTION_TABLES = {
  providers: TABLES.providers,
  resources: TABLES.resources,
  'appointment-types': TABLES.appointmentTypes,
  availability: TABLES.availability,
  blackouts: TABLES.blackouts,
  'schedule-events': TABLES.scheduleEvents,
};

export class SchedulerPersistenceNotConfiguredError extends Error {
  constructor(message = 'Scheduler persistence is not configured.', details = {}) {
    super(message);
    this.name = 'SchedulerPersistenceNotConfiguredError';
    this.code = 'scheduler_persistence_not_configured';
    this.status = 501;
    this.details = details;
  }
}

export class SchedulerPersistenceError extends Error {
  constructor(code, message, status = 500, details = {}) {
    super(message);
    this.name = 'SchedulerPersistenceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function createSchedulerRepository(options = {}) {
  if (options.mode === 'memory' || options.memoryStore) {
    return new MemorySchedulerRepository(options);
  }

  return new SupabaseSchedulerRepository(options);
}

export function createMemorySchedulerRepository(options = {}) {
  return new MemorySchedulerRepository({ ...options, mode: 'memory' });
}

export function getSchedulerPersistenceConfig(env = process.env) {
  const supabaseUrl = sanitizeServiceUrl(env.MMHQ_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '');
  const serviceToken = String(env.MMHQ_SUPABASE_KEY || env.MMHQ_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonToken = String(env.MMHQ_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const token = serviceToken || anonToken;

  return {
    supabaseUrl,
    token,
    serviceRoleConfigured: Boolean(serviceToken),
    anonFallbackConfigured: Boolean(!serviceToken && anonToken),
    isConfigured: Boolean(supabaseUrl && token),
  };
}

class SupabaseSchedulerRepository {
  constructor({ config = getSchedulerPersistenceConfig(), fetchImpl = globalThis.fetch, transactionAdapter = null } = {}) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.transactionAdapter = transactionAdapter || createSchedulerTransactionAdapter({
      mode: config.isConfigured ? 'supabase_rest_rpc' : 'not_configured',
      rpcClient: config.isConfigured ? this.rpc.bind(this) : null,
    });
  }

  status() {
    return {
      mode: this.config.isConfigured ? 'supabase_rest' : 'not_configured',
      configured: this.config.isConfigured,
      service_role_configured: this.config.serviceRoleConfigured,
      anon_fallback_configured: this.config.anonFallbackConfigured,
      transaction_contract: describeSchedulerTransactionContract(),
    };
  }

  async listProviders(filters = {}) {
    return this.restSelect(TABLES.providers, {
      select: '*',
      status: 'eq.active',
      deleted_at: 'is.null',
      order: 'display_name.asc',
      ...optionalEq('id', filters.providerId || filters.provider_id),
    });
  }

  async listAppointmentTypes(filters = {}) {
    return this.restSelect(TABLES.appointmentTypes, {
      select: '*',
      status: 'eq.active',
      active: 'eq.true',
      deleted_at: 'is.null',
      order: 'name.asc',
      ...optionalEq('id', filters.appointmentTypeId || filters.appointment_type_id),
    });
  }

  async listAvailabilityRules(filters = {}) {
    return this.restSelect(TABLES.availability, {
      select: '*',
      status: 'eq.active',
      active: 'eq.true',
      deleted_at: 'is.null',
      order: 'provider_id.asc,day_of_week.asc,start_time.asc',
      ...optionalEq('provider_id', filters.providerId || filters.provider_id),
      ...optionalEq('appointment_type_id', filters.appointmentTypeId || filters.appointment_type_id),
    });
  }

  async listBlackoutWindows(filters = {}) {
    return this.restSelect(TABLES.blackouts, {
      select: '*',
      status: 'eq.active',
      deleted_at: 'is.null',
      order: 'start_at.asc',
      ...optionalEq('provider_id', filters.providerId || filters.provider_id),
      ...optionalEq('appointment_type_id', filters.appointmentTypeId || filters.appointment_type_id),
      ...optionalEq('resource_id', filters.resourceId || filters.resource_id),
    });
  }

  async listMyAppointments(actor, { history = false } = {}) {
    const statusFilter = history ? 'in.(completed,canceled,rescheduled,no_show)' : 'in.(held,booked,confirmed)';
    const rows = await this.restSelect(TABLES.appointments, {
      select: '*',
      student_user_id: `eq.${actor.userId}`,
      status: statusFilter,
      deleted_at: 'is.null',
      order: history ? 'start_at.desc' : 'start_at.asc',
    });
    return rows.map(sanitizeAppointmentForStudent);
  }

  async listAppointmentHistory(actor) {
    return this.listMyAppointments(actor, { history: true });
  }

  async getAppointmentById(appointmentId) {
    const rows = await this.restSelect(TABLES.appointments, {
      select: '*',
      id: `eq.${appointmentId}`,
      deleted_at: 'is.null',
      limit: 1,
    });
    return rows[0] || null;
  }

  async createAppointment({ actor, payload }) {
    return this.transactionAdapter.book(buildServerMutationPayload({ actor, payload, action: 'book' }));
  }

  async rescheduleAppointment({ actor, payload }) {
    return this.transactionAdapter.reschedule(buildServerMutationPayload({ actor, payload, action: 'reschedule' }));
  }

  async cancelAppointment({ actor, payload }) {
    return this.transactionAdapter.cancel(buildServerMutationPayload({ actor, payload, action: 'cancel' }));
  }

  async writeAuditEvent(event = {}) {
    return this.restInsert(TABLES.audit, event);
  }

  async enqueueNotification(notification = {}) {
    const inserted = await this.restInsert(TABLES.notifications, notification);
    return Array.isArray(inserted) ? inserted[0] || notification : inserted;
  }

  async listDueNotifications({ now = new Date(), limit = 25 } = {}) {
    return this.restSelect(TABLES.notifications, {
      select: '*',
      status: 'eq.pending',
      scheduled_at: `lte.${new Date(now).toISOString()}`,
      order: 'scheduled_at.asc',
      limit: Math.max(1, Math.min(100, Number(limit) || 25)),
    });
  }

  async updateAppointmentIntegration(appointmentId, patch = {}) {
    return this.restUpdate(TABLES.appointments, appointmentId, normalizeAppointmentIntegrationPatch(patch));
  }

  async updateNotificationStatus(notificationId, patch = {}) {
    return this.restUpdate(TABLES.notifications, notificationId, normalizeNotificationStatusPatch(patch));
  }

  async adminListAppointments(filters = {}) {
    return this.restSelect(TABLES.appointments, {
      select: '*',
      deleted_at: 'is.null',
      order: 'start_at.desc',
      ...optionalEq('status', filters.status),
      ...optionalEq('provider_id', filters.provider_id || filters.providerId),
      ...optionalEq('appointment_type_id', filters.appointment_type_id || filters.appointmentTypeId),
      ...optionalEq('student_user_id', filters.student_user_id || filters.studentUserId),
    });
  }

  async adminListAuditLog(filters = {}) {
    const limit = Math.max(1, Math.min(100, Number(filters.limit || 50) || 50));
    return this.restSelect(TABLES.audit, {
      select: 'id,entity_type,entity_id,action,actor_type,actor_id,idempotency_key,created_at',
      order: 'created_at.desc',
      limit,
      ...optionalEq('entity_type', filters.entity_type || filters.entityType),
      ...optionalEq('entity_id', filters.entity_id || filters.entityId),
      ...optionalEq('actor_type', filters.actor_type || filters.actorType),
      ...optionalEq('action', filters.action),
    });
  }

  async adminCrudProvider(operation) {
    return this.adminCrudCollection('providers', operation);
  }

  async adminCrudResource(operation) {
    return this.adminCrudCollection('resources', operation);
  }

  async adminCrudAppointmentType(operation) {
    return this.adminCrudCollection('appointment-types', operation);
  }

  async adminCrudAvailability(operation) {
    return this.adminCrudCollection('availability', operation);
  }

  async adminCrudBlackout(operation) {
    return this.adminCrudCollection('blackouts', operation);
  }

  async adminCrudScheduleEvent(operation) {
    return this.adminCrudCollection('schedule-events', operation);
  }

  async adminCrudCollection(collection, { method = 'GET', id = null, payload = {} } = {}) {
    const table = ADMIN_COLLECTION_TABLES[collection];
    if (!table) {
      throw new SchedulerPersistenceError('scheduler_collection_unknown', `Unknown scheduler collection ${collection}.`, 404);
    }

    if (method === 'GET') {
      return this.restSelect(table, {
        select: '*',
        ...(id ? { id: `eq.${id}` } : {}),
        order: 'created_at.desc',
      });
    }

    if (method === 'POST') return this.restInsert(table, payload);
    if (method === 'PUT' || method === 'PATCH') return this.restUpdate(table, id, payload);
    if (method === 'DELETE') return this.restUpdate(table, id, { deleted_at: new Date().toISOString(), status: 'archived' });

    throw new SchedulerPersistenceError('scheduler_method_unsupported', `Unsupported scheduler CRUD method ${method}.`, 405);
  }

  async providerListSchedule(actor, filters = {}) {
    const providerId = await this.resolveProviderId(actor);
    return this.restSelect(TABLES.appointments, {
      select: '*',
      provider_id: `eq.${providerId}`,
      deleted_at: 'is.null',
      order: 'start_at.asc',
      ...optionalEq('status', filters.status),
    });
  }

  async providerBlockTime(actor, payload = {}) {
    const providerId = await this.resolveProviderId(actor);
    return this.restInsert(TABLES.scheduleEvents, {
      ...payload,
      provider_id: providerId,
      event_kind: 'provider_block',
      status: 'scheduled',
      metadata: { ...(payload.metadata || {}), provider_self_service: true },
    });
  }

  async providerUnblockTime(actor, payload = {}) {
    const providerId = await this.resolveProviderId(actor);
    return this.restUpdate(TABLES.scheduleEvents, payload.id || payload.event_id, {
      status: 'canceled',
      metadata: { provider_self_service: true, canceled_by_provider_id: providerId },
    });
  }

  async providerAddNote(actor, payload = {}) {
    const providerId = await this.resolveProviderId(actor);
    return this.restInsert(TABLES.privateNotes, {
      appointment_id: payload.appointment_id || payload.appointmentId,
      provider_id: providerId,
      author_user_id: actor.userId,
      note_text: payload.note,
      visibility: payload.visibility || 'staff_only',
    });
  }

  async adminMarkNoShow({ actor, payload = {} }) {
    const appointmentId = payload.appointment_id || payload.appointmentId || payload.id;
    const updated = await this.restUpdate(TABLES.appointments, appointmentId, {
      status: 'no_show',
      updated_at: new Date().toISOString(),
    });
    await this.writeAuditEvent({
      entity_type: 'appointment',
      entity_id: appointmentId,
      action: 'appointment.no_show',
      actor_type: 'admin',
      actor_id: actor.userId,
      idempotency_key: payload.idempotency_key || payload.idempotencyKey || null,
      after_json: { status: 'no_show' },
    });
    return updated;
  }

  async ssaImportPreview(payload = {}) {
    return {
      ok: true,
      status: 'dry_run',
      import_run_enabled: false,
      rows_seen: Array.isArray(payload.rows) ? payload.rows.length : 0,
      message: 'SSA import preview only; no scheduler data was mutated.',
    };
  }

  async rpc(functionName, payload = {}) {
    return this.request(`rpc/${encodeURIComponent(functionName)}`, {
      method: 'POST',
      body: payload,
      includeContentType: true,
    });
  }

  async resolveProviderId(actor = {}) {
    if (actor.providerId) return actor.providerId;

    const lookup = actor.providerLookup || {};
    const candidates = [
      lookup.supabase_user_id ? { supabase_user_id: `eq.${lookup.supabase_user_id}` } : null,
      lookup.wp_user_id ? { wp_user_id: `eq.${lookup.wp_user_id}` } : null,
      lookup.email ? { email: `eq.${lookup.email}` } : null,
    ].filter(Boolean);

    for (const query of candidates) {
      const providers = await this.restSelect(TABLES.providers, {
        select: 'id',
        status: 'eq.active',
        active: 'eq.true',
        deleted_at: 'is.null',
        limit: 1,
        ...query,
      });
      const providerId = providers?.[0]?.id;
      if (providerId) return providerId;
    }

    throw new SchedulerPersistenceError(
      'scheduler_provider_not_configured',
      'Provider route requires an active mm_schedule_providers mapping for the authenticated staff identity.',
      403,
      { lookup_fields: Object.keys(lookup).filter((key) => lookup[key]) },
    );
  }

  async restSelect(table, params = {}) {
    return this.request(table, { method: 'GET', params });
  }

  async restInsert(table, payload = {}) {
    return this.request(table, {
      method: 'POST',
      body: payload,
      includeContentType: true,
      prefer: 'return=representation',
    });
  }

  async restUpdate(table, id, payload = {}) {
    if (!id) {
      throw new SchedulerPersistenceError('scheduler_id_required', 'Scheduler update/delete requires an id.', 400);
    }
    return this.request(table, {
      method: 'PATCH',
      params: { id: `eq.${id}` },
      body: payload,
      includeContentType: true,
      prefer: 'return=representation',
    });
  }

  async request(path, { method = 'GET', params = {}, body = null, includeContentType = false, prefer = '' } = {}) {
    this.assertConfigured();

    const target = new URL(`/rest/v1/${path.replace(/^\/+/u, '')}`, this.config.supabaseUrl);
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && String(value) !== '') {
        target.searchParams.set(key, String(value));
      }
    }

    const headers = {
      Accept: 'application/json',
      apikey: this.config.token,
      Authorization: `Bearer ${this.config.token}`,
      'Accept-Profile': 'public',
    };
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Profile'] = 'public';
    }
    if (prefer) headers.Prefer = prefer;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(target, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      const data = parseJson(text);
      if (!response.ok) {
        throw new SchedulerPersistenceError('scheduler_supabase_request_failed', extractSupabaseError(data, text, response.status), response.status, {
          table: path,
          method,
        });
      }
      return Array.isArray(data) ? data : (data?.data ?? data ?? []);
    } finally {
      clearTimeout(timeout);
    }
  }

  assertConfigured() {
    if (!this.config.isConfigured) {
      throw new SchedulerPersistenceNotConfiguredError('Scheduler Supabase persistence is not configured.', {
        required_env: ['MMHQ_SUPABASE_URL', 'MMHQ_SUPABASE_KEY or MMHQ_SUPABASE_SERVICE_ROLE_KEY'],
      });
    }
  }
}

class MemorySchedulerRepository {
  constructor({ memoryStore = createSchedulerMemoryStore(), seed = {} } = {}) {
    this.store = memoryStore;
    this.providers = [...(seed.providers || [])];
    this.resources = [...(seed.resources || [])];
    this.appointmentTypes = [...(seed.appointmentTypes || seed.appointment_types || [])];
    this.availabilityRules = [...(seed.availabilityRules || seed.availability_rules || [])];
    this.blackouts = [...(seed.blackouts || [])];
    this.scheduleEvents = [...(seed.scheduleEvents || seed.schedule_events || [])];
    this.privateNotes = [...(seed.privateNotes || seed.private_notes || [])];
  }

  status() {
    return {
      mode: 'memory',
      configured: true,
      service_role_configured: false,
      transaction_contract: describeSchedulerTransactionContract(),
    };
  }

  async listProviders(filters = {}) {
    return this.providers.filter((provider) => isActive(provider)
      && matchesOptional(provider.id, filters.provider_id || filters.providerId)
      && (!filters.appointment_type_id || !provider.appointment_type_ids || provider.appointment_type_ids.includes(filters.appointment_type_id)));
  }

  async listAppointmentTypes(filters = {}) {
    return this.appointmentTypes.filter((type) => isActive(type)
      && matchesOptional(type.id, filters.appointment_type_id || filters.appointmentTypeId));
  }

  async listAvailabilityRules(filters = {}) {
    return this.availabilityRules.filter((rule) => isActive(rule)
      && matchesOptional(rule.provider_id ?? rule.providerId, filters.provider_id || filters.providerId)
      && matchesOptional(rule.appointment_type_id ?? rule.appointmentTypeId, filters.appointment_type_id || filters.appointmentTypeId));
  }

  async listBlackoutWindows(filters = {}) {
    return this.blackouts.filter((blackout) => isActive(blackout)
      && matchesOptional(blackout.provider_id ?? blackout.providerId, filters.provider_id || filters.providerId)
      && matchesOptional(blackout.appointment_type_id ?? blackout.appointmentTypeId, filters.appointment_type_id || filters.appointmentTypeId)
      && matchesOptional(blackout.resource_id ?? blackout.resourceId, filters.resource_id || filters.resourceId));
  }

  async listMyAppointments(actor, { history = false } = {}) {
    const activeStatuses = new Set(history ? ['completed', 'canceled', 'rescheduled', 'no_show'] : ['held', 'booked', 'confirmed']);
    return this.store.appointments
      .filter((appointment) => String(appointment.student_user_id) === String(actor.userId))
      .filter((appointment) => activeStatuses.has(String(appointment.status || 'booked')))
      .map(sanitizeAppointmentForStudent);
  }

  async listAppointmentHistory(actor) {
    return this.listMyAppointments(actor, { history: true });
  }

  async getAppointmentById(appointmentId) {
    return findById(this.store.appointments, appointmentId) || null;
  }

  async createAppointment({ actor, payload = {} }) {
    const studentUserId = actor.isAdmin || actor.isProvider
      ? (payload.student_user_id || payload.studentUserId || actor.userId)
      : actor.userId;
    const studentWpUserId = actor.isAdmin || actor.isProvider
      ? (payload.student_wp_user_id || payload.studentWpUserId || actor.wpUserId)
      : actor.wpUserId;
    const appointmentType = findById(this.appointmentTypes, payload.appointment_type_id || payload.appointmentTypeId || payload.appointmentType?.id)
      || payload.appointmentType;
    const request = {
      ...payload,
      studentUserId,
      studentWpUserId,
      actorType: actor.isAdmin ? 'admin' : 'student',
      actorId: actor.userId,
      appointmentType,
      blackouts: this.blackouts,
      scheduleEvent: findById(this.scheduleEvents, payload.schedule_event_id || payload.scheduleEventId),
    };
    return createAppointmentTransaction({ store: this.store, request, now: payload.now || new Date() });
  }

  async rescheduleAppointment({ actor, payload = {} }) {
    return rescheduleAppointmentTransaction({
      store: this.store,
      request: {
        ...payload,
        actorType: actor.isAdmin ? 'admin' : 'student',
        actorId: actor.userId,
        appointmentType: findById(this.appointmentTypes, payload.appointment_type_id || payload.appointmentTypeId) || payload.appointmentType,
        blackouts: this.blackouts,
        scheduleEvent: findById(this.scheduleEvents, payload.schedule_event_id || payload.scheduleEventId),
      },
      now: payload.now || new Date(),
    });
  }

  async cancelAppointment({ actor, payload = {} }) {
    return cancelAppointmentTransaction({
      store: this.store,
      request: {
        ...payload,
        actorType: actor.isAdmin ? 'admin' : 'student',
        actorId: actor.userId,
      },
      now: payload.now || new Date(),
    });
  }

  async writeAuditEvent(event = {}) {
    this.store.auditEvents.push({ ...event, id: event.id || `audit-${this.store.auditEvents.length + 1}` });
    return this.store.auditEvents.at(-1);
  }

  async enqueueNotification(notification = {}) {
    const idempotencyKey = notification.idempotency_key || notification.idempotencyKey || null;
    if (idempotencyKey) {
      const existing = this.store.notifications.find((row) => String(row.idempotency_key || row.idempotencyKey || '') === String(idempotencyKey));
      if (existing) return existing;
    }
    this.store.notifications.push({ ...notification, id: notification.id || `notification-${this.store.notifications.length + 1}` });
    return this.store.notifications.at(-1);
  }

  async listDueNotifications({ now = new Date(), limit = 25 } = {}) {
    const cutoff = new Date(now).getTime();
    return this.store.notifications
      .filter((row) => String(row.status || 'pending') === 'pending')
      .filter((row) => new Date(row.scheduled_at || row.scheduledAt).getTime() <= cutoff)
      .sort((a, b) => String(a.scheduled_at || a.scheduledAt).localeCompare(String(b.scheduled_at || b.scheduledAt)))
      .slice(0, Math.max(1, Math.min(100, Number(limit) || 25)));
  }

  async updateAppointmentIntegration(appointmentId, patch = {}) {
    const appointment = findById(this.store.appointments, appointmentId);
    if (!appointment) {
      throw new SchedulerPersistenceError('scheduler_appointment_not_found', 'Appointment was not found.', 404);
    }
    Object.assign(appointment, normalizeAppointmentIntegrationPatch(patch));
    return appointment;
  }

  async updateNotificationStatus(notificationId, patch = {}) {
    const notification = findById(this.store.notifications, notificationId);
    if (!notification) {
      throw new SchedulerPersistenceError('scheduler_notification_not_found', 'Notification was not found.', 404);
    }
    Object.assign(notification, normalizeNotificationStatusPatch(patch));
    return notification;
  }

  async adminListAppointments(filters = {}) {
    return [...this.store.appointments]
      .filter((appointment) => matchesOptional(appointment.provider_id ?? appointment.providerId, filters.provider_id || filters.providerId))
      .filter((appointment) => matchesOptional(appointment.appointment_type_id ?? appointment.appointmentTypeId, filters.appointment_type_id || filters.appointmentTypeId));
  }

  async adminListAuditLog(filters = {}) {
    const limit = Math.max(1, Math.min(100, Number(filters.limit || 50) || 50));
    return [...this.store.auditEvents]
      .filter((event) => matchesOptional(event.entity_type ?? event.entityType, filters.entity_type || filters.entityType))
      .filter((event) => matchesOptional(event.entity_id ?? event.entityId, filters.entity_id || filters.entityId))
      .filter((event) => matchesOptional(event.actor_type ?? event.actorType, filters.actor_type || filters.actorType))
      .filter((event) => matchesOptional(event.action, filters.action))
      .sort((a, b) => String(b.created_at || b.createdAt || '').localeCompare(String(a.created_at || a.createdAt || '')))
      .slice(0, limit);
  }

  async adminCrudProvider(operation) {
    return memoryCrud(this.providers, operation);
  }

  async adminCrudResource(operation) {
    return memoryCrud(this.resources, operation);
  }

  async adminCrudAppointmentType(operation) {
    return memoryCrud(this.appointmentTypes, operation);
  }

  async adminCrudAvailability(operation) {
    return memoryCrud(this.availabilityRules, operation);
  }

  async adminCrudBlackout(operation) {
    return memoryCrud(this.blackouts, operation);
  }

  async adminCrudScheduleEvent(operation) {
    return memoryCrud(this.scheduleEvents, operation);
  }

  async providerListSchedule(actor) {
    const providerId = actor.providerId;
    if (!providerId) {
      throw new SchedulerPersistenceError('scheduler_provider_not_configured', 'Provider route requires a configured scheduler provider mapping.', 403);
    }
    return this.store.appointments.filter((appointment) => String(appointment.provider_id) === String(providerId));
  }

  async providerBlockTime(actor, payload = {}) {
    if (!actor.providerId) {
      throw new SchedulerPersistenceError('scheduler_provider_not_configured', 'Provider block-time requires a configured scheduler provider mapping.', 403);
    }
    const event = {
      id: payload.id || `block-${this.scheduleEvents.length + 1}`,
      provider_id: actor.providerId,
      event_kind: 'provider_block',
      status: 'scheduled',
      start_at: payload.start_at || payload.startAt,
      end_at: payload.end_at || payload.endAt,
      timezone: payload.timezone || 'America/New_York',
      metadata: { provider_self_service: true },
    };
    this.scheduleEvents.push(event);
    return event;
  }

  async providerUnblockTime(actor, payload = {}) {
    if (!actor.providerId) {
      throw new SchedulerPersistenceError('scheduler_provider_not_configured', 'Provider unblock-time requires a configured scheduler provider mapping.', 403);
    }
    const event = findById(this.scheduleEvents, payload.id || payload.event_id || payload.eventId);
    if (!event || String(event.provider_id) !== String(actor.providerId)) {
      throw new SchedulerPersistenceError('scheduler_event_not_found', 'Provider block was not found for this provider.', 404);
    }
    event.status = 'canceled';
    return event;
  }

  async providerAddNote(actor, payload = {}) {
    if (!actor.providerId) {
      throw new SchedulerPersistenceError('scheduler_provider_not_configured', 'Provider notes require a configured scheduler provider mapping.', 403);
    }
    const appointmentId = payload.appointment_id || payload.appointmentId;
    const appointment = findById(this.store.appointments, appointmentId);
    const providerId = actor.providerId;
    if (!appointment || String(appointment.provider_id) !== String(providerId)) {
      throw new SchedulerPersistenceError('scheduler_provider_note_forbidden', 'Provider notes require an assigned appointment.', 403);
    }
    const note = {
      id: payload.id || `note-${this.privateNotes.length + 1}`,
      appointment_id: appointmentId,
      provider_id: providerId,
      author_user_id: actor.userId,
      note: String(payload.note || ''),
      visibility: payload.visibility || 'staff_only',
    };
    this.privateNotes.push(note);
    return note;
  }

  async adminMarkNoShow({ actor, payload = {} }) {
    const appointmentId = payload.appointment_id || payload.appointmentId || payload.id;
    const appointment = findById(this.store.appointments, appointmentId);
    if (!appointment) {
      throw new SchedulerPersistenceError('scheduler_appointment_not_found', 'Appointment was not found.', 404);
    }
    const before = { ...appointment };
    appointment.status = 'no_show';
    appointment.updated_at = new Date().toISOString();
    this.store.auditEvents.push({
      id: `audit-${this.store.auditEvents.length + 1}`,
      entity_type: 'appointment',
      entity_id: appointmentId,
      action: 'appointment.no_show',
      actor_type: 'admin',
      actor_id: actor.userId,
      idempotency_key: payload.idempotency_key || payload.idempotencyKey || null,
      before_json: before,
      after_json: { ...appointment },
      created_at: appointment.updated_at,
    });
    return appointment;
  }

  async ssaImportPreview(payload = {}) {
    return {
      ok: true,
      status: 'dry_run',
      import_run_enabled: false,
      rows_seen: Array.isArray(payload.rows) ? payload.rows.length : 0,
    };
  }

  async generateAvailability(filters = {}) {
    const appointmentType = findById(this.appointmentTypes, filters.appointment_type_id || filters.appointmentTypeId) || {};
    return generateAvailabilitySlots({
      availabilityRules: this.availabilityRules,
      appointmentType,
      providerId: filters.provider_id || filters.providerId || '',
      resourceId: filters.resource_id || filters.resourceId || '',
      startDate: filters.start_date || filters.startDate,
      endDate: filters.end_date || filters.endDate,
      blackouts: this.blackouts,
      existingAppointments: this.store.appointments,
    });
  }
}

function buildServerMutationPayload({ actor, payload = {}, action }) {
  const actorType = payload.actor_type || payload.actorType || (actor.isAdmin ? 'admin' : actor.isProvider ? 'provider' : 'student');
  const targetStudentUserId = ['admin', 'support', 'service_role'].includes(actorType)
    ? (payload.student_user_id || payload.studentUserId || actor.userId)
    : actor.userId;
  const targetStudentWpUserId = ['admin', 'support', 'service_role'].includes(actorType)
    ? (payload.student_wp_user_id || payload.studentWpUserId || actor.wpUserId)
    : actor.wpUserId;
  return {
    ...payload,
    action,
    student_user_id: targetStudentUserId,
    studentUserId: targetStudentUserId,
    student_wp_user_id: targetStudentWpUserId,
    studentWpUserId: targetStudentWpUserId,
    actor_user_id: actor.userId,
    actorUserId: actor.userId,
    actor_provider_id: actor.providerId,
    actorProviderId: actor.providerId,
    actor_type: actorType,
    actorType,
    actor_roles: actor.roles || [],
  };
}

function memoryCrud(collection, { method = 'GET', id = null, payload = {} } = {}) {
  if (method === 'GET') {
    return id ? collection.filter((row) => String(row.id) === String(id)) : [...collection];
  }

  if (method === 'POST') {
    const row = { id: payload.id || `${Date.now()}-${collection.length + 1}`, ...payload };
    collection.push(row);
    return row;
  }

  const index = collection.findIndex((row) => String(row.id) === String(id));
  if (index === -1) {
    throw new SchedulerPersistenceError('scheduler_row_not_found', 'Scheduler row was not found.', 404);
  }

  if (method === 'PUT' || method === 'PATCH') {
    collection[index] = { ...collection[index], ...payload };
    return collection[index];
  }

  if (method === 'DELETE') {
    collection[index] = { ...collection[index], status: 'archived', deleted_at: new Date().toISOString() };
    return collection[index];
  }

  throw new SchedulerPersistenceError('scheduler_method_unsupported', `Unsupported method ${method}.`, 405);
}

function isActive(row = {}) {
  return row.active !== false
    && row.deleted_at == null
    && row.deletedAt == null
    && !['inactive', 'archived', 'deleted'].includes(String(row.status || 'active'));
}

function matchesOptional(value, expected) {
  return expected == null || String(expected) === '' || String(value || '') === String(expected);
}

function findById(rows = [], id = '') {
  return rows.find((row) => String(row.id) === String(id));
}

function optionalEq(key, value) {
  return value == null || String(value) === '' ? {} : { [key]: `eq.${value}` };
}

function normalizeAppointmentIntegrationPatch(patch = {}) {
  const metadata = patch.metadata && typeof patch.metadata === 'object' && !Array.isArray(patch.metadata)
    ? patch.metadata
    : undefined;
  return {
    ...(patch.meeting_url !== undefined ? { meeting_url: patch.meeting_url } : {}),
    ...(patch.meetingUrl !== undefined ? { meeting_url: patch.meetingUrl } : {}),
    ...(patch.external_event_status !== undefined ? { external_event_status: patch.external_event_status } : {}),
    ...(patch.externalEventStatus !== undefined ? { external_event_status: patch.externalEventStatus } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    updated_at: new Date().toISOString(),
  };
}

function normalizeNotificationStatusPatch(patch = {}) {
  return {
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.sent_at !== undefined ? { sent_at: patch.sent_at } : {}),
    ...(patch.sentAt !== undefined ? { sent_at: patch.sentAt } : {}),
    ...(patch.provider_message_id !== undefined ? { provider_message_id: patch.provider_message_id } : {}),
    ...(patch.providerMessageId !== undefined ? { provider_message_id: patch.providerMessageId } : {}),
    ...(patch.last_error !== undefined ? { last_error: patch.last_error } : {}),
    ...(patch.lastError !== undefined ? { last_error: patch.lastError } : {}),
    ...(patch.next_retry_at !== undefined ? { next_retry_at: patch.next_retry_at } : {}),
    ...(patch.nextRetryAt !== undefined ? { next_retry_at: patch.nextRetryAt } : {}),
    attempt_count: Number(patch.attempt_count ?? patch.attemptCount ?? 0),
    updated_at: new Date().toISOString(),
  };
}

function sanitizeServiceUrl(value = '') {
  const text = String(value || '').trim().replace(/\/+$/u, '');
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.toString().replace(/\/+$/u, '');
  } catch {
    return '';
  }
}

function parseJson(text = '') {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractSupabaseError(data, text, status) {
  if (data && typeof data === 'object') {
    return String(data.message || data.msg || data.error || data.details || data.raw || `Supabase request failed with HTTP ${status}.`);
  }
  return String(text || `Supabase request failed with HTTP ${status}.`);
}

export function normalizeSchedulerPersistenceError(error) {
  if (error instanceof SchedulerPersistenceNotConfiguredError
    || error instanceof SchedulerPersistenceError
    || error instanceof SchedulerTransactionNotConfiguredError) {
    return {
      status: error.status || 500,
      error: error.code || 'scheduler_persistence_error',
      message: error.message,
      details: error.details || {},
    };
  }

  return {
    status: error?.status || 500,
    error: error?.code || 'scheduler_error',
    message: error instanceof Error ? error.message : 'Unexpected scheduler error.',
    details: error?.details || {},
  };
}
