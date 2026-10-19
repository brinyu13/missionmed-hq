import { createHash } from 'node:crypto';
import { checkCoachingAccess, createCoachingService } from './coaching.mjs';
import { getSchedulerActor } from './auth.mjs';
import { generateAvailabilitySlots } from './engine.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ACTIVE = new Set(['held', 'booked', 'confirmed']);
const SERVICES = new Set(['strategy', 'mock', 'debrief', 'intensive']);
const value = (object, ...keys) => keys.map(key => object?.[key]).find(item => item !== undefined && item !== null && item !== '');
const same = (a, b) => String(a ?? '') === String(b ?? '');
const meta = row => { try { return typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : row?.metadata || {}; } catch { return {}; } };
const coaching = row => String(row?.slug || '').startsWith('mr-coaching-') || Boolean(meta(row).mr_coaching_service);
const kind = row => meta(row).mr_coaching_service || String(row?.slug || '').match(/^mr-coaching-(strategy|mock|debrief|intensive)-/)?.[1];
const date = raw => { const d = new Date(raw); return Number.isFinite(d.getTime()) ? d : null; };
const canonical = item => Array.isArray(item) ? item.map(canonical) : item && typeof item === 'object'
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const localSerial = raw => { const p = Object.fromEntries(NY.formatToParts(new Date(raw)).map(x => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month)-1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)); };
function deny(code, message = 'Your coaching booking could not be confirmed.', status = 403) {
  const error = new Error(message); error.code = code; error.status = status; throw error;
}

// Request-scoped adapter over the existing repository, native engine and paid
// RPCs. No routes, external providers, identity synchronization or alternate store.
export function createCoachingIntegration({ repository, session, actor, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const enabled = env.MMED_COACHING_ENABLED === '1';
  let modelPromise; let busyPromise; let blackoutsPromise; let accessPromise;
  const appointments = new Map();
  const types = new Map();
  const rules = new Map();
  function trustedActor() {
    const resolved = getSchedulerActor(session, 'student');
    const actual = resolved.actor;
    if (!resolved.ok || !actual?.supabaseIdentityConfirmed || !UUID.test(actual.userId)
      || !Number.isSafeInteger(actual.wpUserId) || actual.wpUserId <= 0
      || !actor?.supabaseIdentityConfirmed || !same(actor.userId, actual.userId) || !same(actor.wpUserId, actual.wpUserId)) {
      deny('coaching_confirmed_identity_required', 'Please sign in to your verified Matrix account.');
    }
    const status = repository?.status?.();
    if (status?.mode !== 'supabase_rest' || status.configured !== true || status.service_role_configured !== true
      || typeof repository.rpc !== 'function') deny('coaching_service_repository_required', 'Coaching scheduling is not available yet.', 503);
    if (!enabled) deny('coaching_disabled', 'Coaching scheduling is not available yet.', 503);
    return actual;
  }
  const service = createCoachingService({ enabled, rpcClient: (...args) => repository.rpc(...args), resolveNativeActor: async () => trustedActor() });
  async function model() {
    trustedActor();
    modelPromise ||= service.readModel(session).then(result => {
      if (!Array.isArray(result?.packages) || !Array.isArray(result?.eligible_services)) deny('coaching_read_model_unavailable', 'Coaching scheduling is not available yet.', 503);
      return result;
    });
    return modelPromise;
  }
  async function access(data, fresh = false) {
    if (fresh) accessPromise = undefined;
    accessPromise ||= checkCoachingAccess({ actor: trustedActor(), secret: env.MMED_COACHING_WOO_SECRET, fetchImpl,
      bindings: data.packages.map(pack => ({ order_id: pack.order_id, snapshot_digest: pack.snapshot_digest })) });
    return accessPromise;
  }
  async function accessibleModel(data, fresh = false) {
    const truth = await access(data, fresh);
    return { ...data, packages: data.packages.map(pack => ({ ...pack,
      booking_allowed: pack.booking_allowed !== false && pack.refund_review_required !== true && truth.get(pack.order_id) === true })) };
  }
  async function type(id) {
    if (!id) return null;
    const key = String(id);
    if (!types.has(key)) types.set(key, repository.listAppointmentTypes({ appointment_type_id: key, appointmentTypeId: key })
      .then(rows => rows.find(row => same(row.id, key)) || null));
    return types.get(key);
  }
  async function appointment(id) {
    if (!id) return null;
    const key = String(id);
    if (!appointments.has(key)) appointments.set(key, repository.getAppointmentById(key));
    return appointments.get(key);
  }
  function owned(ap) {
    const actual = trustedActor();
    return ap && same(ap.student_user_id, actual.userId) && same(ap.student_wp_user_id, actual.wpUserId) && !ap.deleted_at;
  }
  function credits(data) {
    return data.packages.flatMap(pack => (Array.isArray(pack.services) ? pack.services : []).map(credit => ({ ...credit, package: pack })))
      .sort((a, b) => String(a.package.order_id).localeCompare(String(b.package.order_id)) || Number(a.ordinal) - Number(b.ordinal) || String(a.id).localeCompare(String(b.id)));
  }
  async function strategyEnd(credit) {
    if (credit.service !== 'mock' || !['three', 'five'].includes(credit.package.sku)) return -Infinity;
    for (const strategy of credit.package.services.filter(item => item.service === 'strategy' && ['reserved', 'delivered'].includes(item.state))) {
      const ap = await appointment(strategy.appointment_id);
      if (owned(ap) && ['booked', 'confirmed', 'completed'].includes(ap.status) && date(ap.end_at)) return date(ap.end_at).getTime();
    }
    return Infinity;
  }
  async function dependentMockStart(credit) {
    let earliest = Infinity;
    if (credit.service !== 'strategy') return earliest;
    for (const mock of credit.package.services.filter(item => item.service === 'mock' && item.state === 'reserved')) {
      const ap = await appointment(mock.appointment_id);
      if (owned(ap) && ACTIVE.has(ap.status) && date(ap.start_at)) earliest = Math.min(earliest, date(ap.start_at).getTime());
    }
    return earliest;
  }
  async function availableCredits(data, serviceKind, start = Infinity) {
    const result = [];
    for (const credit of credits(data).filter(item => item.service === serviceKind && item.state === 'available' && item.package.booking_allowed !== false)) {
      const threshold = await strategyEnd(credit);
      if (threshold !== Infinity && threshold <= start) result.push(credit);
    }
    return result;
  }
  function approvals(data, rawType, providerId = '') {
    return data.eligible_services.filter(a => same(a.appointment_type_id, rawType.id) && a.service === kind(rawType)
      && (!providerId || same(a.provider_id, providerId)) && date(a.approved_from) && date(a.approved_until))
      .sort((a, b) => String(a.approval_id).localeCompare(String(b.approval_id)));
  }
  async function donorRule(approval) {
    const key = String(approval.approval_id);
    if (!rules.has(key)) rules.set(key, repository.listAvailabilityRules({ provider_id: approval.provider_id, appointment_type_id: approval.donor_appointment_type_id })
      .then(rows => rows.find(r => same(r.id, approval.availability_rule_id) && same(r.provider_id, approval.provider_id)
        && same(r.appointment_type_id, approval.donor_appointment_type_id) && r.active !== false && r.status === 'active' && !r.deleted_at && !r.rrule) || null));
    return rules.get(key);
  }
  async function scan(table, params, code) {
    if (typeof repository.restSelect !== 'function') deny(code, 'Availability needs staff review.', 503);
    const rows = []; const ids = new Set(); let offset = 0;
    for (let page = 0; page < 101; page++) {
      const batch = await repository.restSelect(table, { ...params, order: 'id.asc', limit: 200, offset });
      if (!Array.isArray(batch) || batch.length > 200) deny(code, 'Availability needs staff review.', 503);
      if (!batch.length) return rows;
      if (page === 100) deny(code, 'Availability needs staff review.', 503);
      for (const row of batch) {
        if (!row.id || ids.has(String(row.id))) deny(code, 'Availability needs staff review.', 503);
        ids.add(String(row.id)); rows.push(row);
      }
      offset += batch.length; // Server-side caps may return a short non-final page.
    }
    deny(code, 'Availability needs staff review.', 503);
  }
  async function busy() {
    busyPromise ||= scan('mm_appointments', { select: 'id,status,start_at,end_at,provider_id,resource_id,buffer_before_minutes,buffer_after_minutes',
      deleted_at: 'is.null', status: 'in.(held,booked,confirmed)' }, 'coaching_busy_scan_incomplete').then(batch => {
      const rows = new Map();
      for (const ap of batch) if (ACTIVE.has(ap.status) && !ap.deleted_at) rows.set(String(ap.id), {
        id: ap.id, status: ap.status, start_at: ap.start_at, end_at: ap.end_at, provider_id: ap.provider_id, resource_id: ap.resource_id,
        buffer_before_minutes: ap.buffer_before_minutes || 0, buffer_after_minutes: ap.buffer_after_minutes || 0,
      });
      return [...rows.values()];
    });
    return busyPromise;
  }
  async function blackouts() {
    blackoutsPromise ||= scan('mm_blackout_windows', { select: 'id,provider_id,resource_id,appointment_type_id,start_at,end_at,status',
      deleted_at: 'is.null', status: 'eq.active' }, 'coaching_blackout_scan_incomplete').then(rows => {
      return rows.map(b => ({ provider_id: b.provider_id, resource_id: b.resource_id, appointment_type_id: b.appointment_type_id,
        start_at: b.start_at, end_at: b.end_at, active: b.active, status: b.status }));
    });
    return blackoutsPromise;
  }
  async function reservedCredit(data, ap) {
    if (!owned(ap)) deny('coaching_appointment_owner_required');
    const credit = credits(data).find(c => c.state === 'reserved' && same(c.appointment_id, ap.id));
    if (!credit) deny('coaching_reserved_credit_required');
    return credit;
  }
  async function slots(filters, rawType, data, target = null) {
    if (!SERVICES.has(kind(rawType))) return [];
    const start = date(value(filters, 'start_date', 'startDate', 'start'));
    const end = date(value(filters, 'end_date', 'endDate', 'end'));
    if (!start || !end || end <= start || end - start > 93 * 86400000) deny('coaching_date_range_required', 'Choose a valid date range.', 400);
    const pool = target ? (target.package.booking_allowed === false ? [] : [target]) : await availableCredits(data, kind(rawType));
    if (!pool.length) return [];
    if (!Array.isArray(data.weekly_usage)) deny('coaching_weekly_usage_unavailable', 'Availability needs staff review.', 503);
    const prior = target?.appointment_id ? await appointment(target.appointment_id) : null;
    const existing = (await busy()).filter(ap => !target || !same(ap.id, target.appointment_id)).map(({ id, ...safe }) => safe);
    const allBlackouts = await blackouts();
    const result = new Map();
    for (const approval of approvals(data, rawType, value(filters, 'provider_id', 'providerId'))) {
      const r = await donorRule(approval); if (!r) continue;
      const from = new Date(Math.max(start.getTime(), date(approval.approved_from).getTime()));
      const until = new Date(Math.min(end.getTime(), date(approval.approved_until).getTime()));
      if (until <= from) continue;
      const scopedBlackouts = allBlackouts.filter(b => !b.appointment_type_id || same(b.appointment_type_id, rawType.id) || same(b.appointment_type_id, approval.donor_appointment_type_id))
        .map(b => ({ ...b, appointment_type_id: b.appointment_type_id ? rawType.id : null }));
      const mappedRule = { id: r.id, provider_id: r.provider_id, appointment_type_id: rawType.id, resource_id: r.resource_id,
        day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time, timezone: r.timezone,
        effective_start: r.effective_start, effective_end: r.effective_end, active: r.active, status: r.status };
      const resource = value(filters, 'resource_id', 'resourceId');
      if (resource && !same(resource, r.resource_id)) continue;
      const generated = generateAvailabilitySlots({ availabilityRules: [mappedRule], appointmentType: rawType,
        providerId: approval.provider_id, resourceId: r.resource_id || '', startDate: from, endDate: until,
        blackouts: scopedBlackouts, existingAppointments: existing });
      for (const slot of generated) {
        const week = data.weekly_usage.find(w => Date.parse(w.week_start_utc) <= Date.parse(slot.startAt) && Date.parse(w.week_end_utc) > Date.parse(slot.startAt));
        const usage = week ? Number(week.used_minutes) : 0;
        if (!Number.isFinite(usage) || usage < 0) deny('coaching_weekly_usage_unavailable', 'Availability needs staff review.', 503);
        const reclaimed = week && prior && ACTIVE.has(prior.status) && Date.parse(prior.start_at) >= Date.parse(week.week_start_utc)
          && Date.parse(prior.start_at) < Date.parse(week.week_end_utc) ? (Date.parse(prior.end_at) - Date.parse(prior.start_at)) / 60000 : 0;
        if (usage - reclaimed + Number(rawType.duration_minutes) > 1200) continue;
        // Same NY-week boundary rule as the atomic SQL cap, including DST.
        const localStart = new Date(localSerial(slot.startAt));
        const nextMonday = Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth(), localStart.getUTCDate() + (7 - ((localStart.getUTCDay() + 6) % 7)));
        if (localSerial(slot.endAt) > nextMonday) continue;
        let allowed = false;
        for (const credit of pool) if (await strategyEnd(credit) <= Date.parse(slot.startAt)
          && await dependentMockStart(credit) >= Date.parse(slot.endAt)) { allowed = true; break; }
        if (allowed) result.set(`${slot.providerId}:${slot.resourceId}:${slot.startAt}:${slot.endAt}`, slot);
      }
    }
    return [...result.values()].sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
  return {
    async decorateTypes(sanitizedTypes = [], rawTypes = []) {
      const raw = new Map(rawTypes.map(row => [String(row.id), row]));
      if (!enabled) return sanitizedTypes.filter(row => !coaching(raw.get(String(row.id)) || row));
      let data;
      try { data = await accessibleModel(await model()); } catch { return sanitizedTypes.filter(row => !coaching(raw.get(String(row.id)) || row)); }
      const result = [];
      for (const row of sanitizedTypes) {
        const source = raw.get(String(row.id)) || row;
        if (!coaching(source)) { result.push(row); continue; }
        const remaining = credits(data).filter(c => c.service === kind(source) && c.state === 'available' && c.package.booking_allowed !== false).length;
        const eligible = approvals(data, source).length > 0 && (await availableCredits(data, kind(source))).length > 0;
        result.push({ ...row, division: 'mission-residency', coaching_service: kind(source) || 'unavailable', coaching_remaining: remaining,
          entitlement: { status: eligible ? 'eligible' : 'locked', locked: !eligible,
            reason: eligible ? 'verified_paid_coaching_credit' : 'coaching_credit_or_strategy_required',
            message: eligible ? 'Included in your paid coaching package.' : 'A paid coaching credit and any required strategy session are needed.' } });
      }
      return result;
    },
    async availability(filters = {}, rawAppointmentType) {
      if (!coaching(rawAppointmentType)) return null;
      if (!enabled) return [];
      const data = await accessibleModel(await model());
      const apId = value(filters, 'appointment_id', 'appointmentId', 'exclude_appointment_id');
      const existing = apId ? await appointment(apId) : null;
      const target = existing ? await reservedCredit(data, existing) : apId ? await reservedCredit(data, null) : null;
      if (target && (target.service !== kind(rawAppointmentType) || !same(existing.appointment_type_id, rawAppointmentType.id))) deny('coaching_type_change_forbidden');
      return slots(filters, rawAppointmentType, data, target);
    },
    async mutate(action, payload = {}) {
      if (!['book', 'reschedule', 'cancel'].includes(action)) return null;
      let actual = null;
      let rawType;
      const requestedType = value(payload, 'appointment_type_id', 'appointmentTypeId');
      if (action === 'book') rawType = await type(requestedType);
      else {
        actual = await appointment(value(payload, 'appointment_id', 'appointmentId', 'id'));
        if (!actual) return null;
        rawType = await type(actual.appointment_type_id);
        if (!coaching(rawType) && requestedType && coaching(await type(requestedType))) deny('coaching_type_change_forbidden');
      }
      if (!coaching(rawType)) return null;
      const trusted = trustedActor();
      if (requestedType && !same(requestedType, rawType.id)) deny('coaching_type_change_forbidden');
      const key = String(value(payload, 'idempotency_key', 'idempotencyKey') || '').trim();
      if (!key) deny('coaching_idempotency_required', 'Please retry the booking with its original request identifier.', 400);
      const digest = createHash('sha256').update(JSON.stringify(canonical({ action, payload }))).digest('hex');
      const replayed = await service.lookupOperation(session, { action, idempotency_key: key, client_request_digest: digest });
      if (replayed) return { result: replayed.result, appointmentType: replayed.appointment_type, payload: replayed.payload };
      let data = await model();
      if (action !== 'cancel') data = await accessibleModel(data);
      const start = action === 'cancel' ? date(actual.start_at) : date(value(payload, 'start_at', 'startAt'));
      const end = action === 'cancel' ? date(actual.end_at) : date(value(payload, 'end_at', 'endAt'));
      if (!start || !end || end <= start) deny('coaching_time_range_required', 'Choose a valid appointment time.', 400);
      const provider = action === 'cancel' ? actual.provider_id : value(payload, 'provider_id', 'providerId') || actual?.provider_id;
      let credit = action === 'book' ? null : await reservedCredit(data, actual);
      if (credit && credit.service !== kind(rawType)) deny('coaching_type_change_forbidden');
      // Recover the ordinary book acknowledgement while its native appointment
      // still carries that key. Historical cancellation replay needs ledger lookup.
      let replay = false;
      if (action === 'book') for (const c of credits(data).filter(item => item.service === kind(rawType) && item.state === 'reserved')) {
        const ap = await appointment(c.appointment_id);
        if (owned(ap) && ap.idempotency_key === key && same(ap.appointment_type_id, rawType.id)
          && Date.parse(ap.start_at) === start.getTime() && Date.parse(ap.end_at) === end.getTime()) { credit = c; replay = true; break; }
      }
      if (!credit) credit = (await availableCredits(data, kind(rawType), start.getTime()))[0];
      if (!credit) deny('coaching_paid_credit_required', 'No eligible paid coaching credit is available.');
      if (action !== 'cancel' && credit.package.booking_allowed === false) deny('coaching_package_review_required');
      if (action === 'cancel' && await dependentMockStart(credit) !== Infinity) deny('coaching_strategy_has_dependent_mocks', 'Update your later mocks before canceling strategy.');
      const approval = action === 'cancel' ? null : approvals(data, rawType, provider).find(a => date(a.approved_from) <= start && date(a.approved_until) >= end);
      if (action !== 'cancel' && !approval) deny('coaching_service_approval_required');
      const r = action === 'cancel' ? { timezone: actual.timezone } : await donorRule(approval);
      if (!r) deny('coaching_native_rule_required');
      const resource = actual?.resource_id || r.resource_id || null;
      if (value(payload, 'resource_id', 'resourceId') && !same(value(payload, 'resource_id', 'resourceId'), resource)) deny('coaching_resource_change_forbidden');
      if (value(payload, 'schedule_event_id', 'scheduleEventId') && !same(value(payload, 'schedule_event_id', 'scheduleEventId'), actual?.schedule_event_id)) deny('coaching_schedule_event_change_forbidden');
      if (action !== 'cancel' && !replay) {
        const offered = await slots({ start_date: start.toISOString(), end_date: end.toISOString(), provider_id: approval.provider_id }, rawType, data, action === 'reschedule' ? credit : null);
        if (!offered.some(slot => Date.parse(slot.startAt) === start.getTime() && Date.parse(slot.endAt) === end.getTime())) deny('coaching_native_slot_unavailable', 'That time is no longer available. Please choose another.');
      }
      const resolved = { action, idempotency_key: key, client_request_digest: digest, service_credit_id: credit.id, approval_id: approval?.approval_id || null,
        appointment_type_id: rawType.id, provider_id: approval?.provider_id || actual.provider_id, resource_id: resource, schedule_event_id: actual?.schedule_event_id || null,
        start_at: start.toISOString(), end_at: end.toISOString(), timezone: r.timezone || 'America/New_York',
        actor_type: 'student', actor_user_id: trusted.userId, actor_wp_user_id: trusted.wpUserId,
        student_user_id: trusted.userId, student_wp_user_id: trusted.wpUserId };
      if (actual) resolved.appointment_id = actual.id;
      if (value(payload, 'intake_answers', 'intakeAnswers')) resolved.intake_answers = value(payload, 'intake_answers', 'intakeAnswers');
      if (payload.reason !== undefined) resolved.reason = payload.reason;
      if (action !== 'cancel' && (await access(data, true)).get(credit.package.order_id) !== true) deny('coaching_package_review_required');
      const result = await service.mutateAppointment(session, resolved);
      return { result, appointmentType: rawType, payload: resolved };
    },
  };
}
