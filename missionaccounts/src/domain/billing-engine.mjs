import { createHash } from 'node:crypto';

const DAY_MS = 86_400_000;

export const ENGINE_VERSION = 'missionaccounts-billing-v1';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function assertIsoDay(value, label = 'day') {
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(String(value)), `${label} must be YYYY-MM-DD`);
  return String(value);
}

export function localDayFromIso(value, timeZone = 'America/New_York') {
  const date = new Date(value);
  invariant(Number.isFinite(date.getTime()), 'timestamp must be valid');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function appliesToDay(window, day) {
  const from = assertIsoDay(window.from_on, 'grace from_on');
  const to = window.to_on ? assertIsoDay(window.to_on, 'grace to_on') : null;
  return day > from && (!to || day <= to);
}

function interpretedEvents(events, corrections) {
  const eventState = new Map();
  const stepOverride = new Map();
  const revertedIds = new Set(corrections.map(item => item.reverts_id).filter(Boolean));
  const ordered = [...corrections]
    .filter(item => !item.reverted_by_id && !revertedIds.has(item.id))
    .sort((a, b) => String(a.created_at || a.at || '').localeCompare(String(b.created_at || b.at || '')) || String(a.id || '').localeCompare(String(b.id || '')));
  for (const correction of ordered) {
    if (!correction.attendance_event_id) continue;
    if (correction.type === 'remove') eventState.set(correction.attendance_event_id, false);
    if (correction.type === 'add') eventState.set(correction.attendance_event_id, true);
    if (correction.type === 'step_relabel') {
      const step = correction.to_val?.step || correction.to_val;
      if (['s1', 's23', 'unknown'].includes(step)) stepOverride.set(correction.attendance_event_id, step);
    }
  }
  return events
    .filter(event => !event.superseded_by_id && eventState.get(event.id) !== false)
    .map(event => stepOverride.has(event.id) ? { ...event, step: stepOverride.get(event.id) } : event);
}

function stableUnique(values) {
  return [...new Set(values)];
}

export function deriveBillableDays({
  student,
  events,
  corrections = [],
  sessions = [],
  graceWindows = [],
  persistedCompDays = [],
  timeZone = 'America/New_York',
}) {
  invariant(student?.id, 'student is required');
  const confirmedSessions = new Map(sessions.map(session => [session.id, session]));
  const normalized = interpretedEvents(events, corrections)
    .filter(event => event.student_id === student.id)
    .filter(event => {
      const session = confirmedSessions.get(event.session_id);
      return session && session.state === 'confirmed' && !session.superseded_by_id;
    })
    .map(event => ({
      ...event,
      local_day: event.local_day
        ? assertIsoDay(event.local_day, 'event local_day')
        : localDayFromIso(event.joined_at || confirmedSessions.get(event.session_id).starts_at, timeZone),
    }))
    .sort((a, b) => a.local_day.localeCompare(b.local_day) || String(a.id).localeCompare(String(b.id)));

  const byDay = new Map();
  for (const event of normalized) {
    const row = byDay.get(event.local_day) || [];
    row.push(event);
    byDay.set(event.local_day, row);
  }

  const allowance = Math.max(0, Number(student.comp_days_allowance || 0));
  const locked = new Set(persistedCompDays.map(day => assertIsoDay(day)));
  let used = locked.size;
  const days = [];

  for (const [day, dayEvents] of byDay) {
    let kind = 'billable';
    let compIndex = null;

    // A persisted comp decision is immutable unless a separate audited retroactive
    // correction explicitly supersedes it.
    if (locked.has(day)) {
      kind = 'comped';
      compIndex = [...locked].sort().indexOf(day) + 1;
    } else if (graceWindows.some(window => appliesToDay(window, day))) {
      // Comp allowances are consumed only by otherwise-billable days. This is the
      // narrow interpretation of "first N billable days" and avoids wasting comp.
      kind = 'grace';
    } else if (used < allowance) {
      kind = 'comped';
      used += 1;
      compIndex = used;
    }

    days.push({
      idempotency_key: `${student.id}:${day}`,
      student_id: student.id,
      cycle_key: dayEvents[0].cycle_key,
      day,
      event_ids: dayEvents.map(event => event.id),
      steps: stableUnique(dayEvents.map(event => event.step).filter(Boolean)),
      same_day_multiple_events: dayEvents.length > 1,
      kind,
      comp_index: compIndex,
      engine_version: ENGINE_VERSION,
    });
  }

  return days;
}

export function calculateCycleAmount({ days, treatment = null, historicalArrangement = null }) {
  const billableDays = days.filter(day => day.kind === 'billable').length;
  const zeroTreatments = new Set(['ucc', 'mul', 'waived', 'prepaid', 'already_paid', 'already_invoiced']);

  if (zeroTreatments.has(treatment)) {
    return { amount_cents: 0, billable_days: billableDays, reason: treatment };
  }

  const raw = billableDays * 2_500;
  if (historicalArrangement?.verified === true && historicalArrangement.type === 'full_cycle_300') {
    return {
      amount_cents: Math.min(raw, 30_000),
      billable_days: billableDays,
      reason: raw > 30_000 ? 'verified_historical_full_cycle_ceiling' : 'per_day',
    };
  }

  return { amount_cents: raw, billable_days: billableDays, reason: 'per_day' };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildDecisionBasis(days, financial = {}) {
  const basis = {
    rule: 'one_charge_per_calendar_day',
    units: 'calendar_days',
    dayCount: days.length,
    att: days.reduce((sum, day) => sum + day.event_ids.length, 0),
    billable: days.filter(day => day.kind === 'billable').length,
    comped: days.filter(day => day.kind === 'comped').length,
    grace: days.filter(day => day.kind === 'grace').length,
    engine_version: ENGINE_VERSION,
    event_ids: days.flatMap(day => day.event_ids || []).sort(),
    day_states: days.map(day => ({ id: day.id || day.idempotency_key, day: day.day, kind: day.kind })).sort((a, b) => a.day.localeCompare(b.day)),
    source_digest: financial.source_digest || null,
    treatment: financial.treatment || null,
    amount_cents: Number(financial.amount_cents || 0),
    account_state: financial.account_state || 'estimate',
    cycle_cap_13_15: financial.cycle_cap_13_15 || null,
    cap: financial.cap ? {
      id: financial.cap.id || null,
      status: financial.cap.status || 'candidate',
      ceiling_cents: Number(financial.cap.ceiling_cents || 0),
    } : null,
  };
  return { ...basis, basis_sha256: createHash('sha256').update(canonicalJson(basis)).digest('hex') };
}

export function decisionIsStale(decision, days, financial = {}) {
  if (!decision?.basis) return true;
  const current = buildDecisionBasis(days, financial);
  const storedHash = decision.basis_sha256 || decision.basis.basis_sha256;
  if (!storedHash) return true;
  return storedHash !== current.basis_sha256;
}

export function daysBetweenInclusive(fromDay, toDay) {
  const from = Date.parse(`${assertIsoDay(fromDay)}T00:00:00Z`);
  const to = Date.parse(`${assertIsoDay(toDay)}T00:00:00Z`);
  return Math.floor((to - from) / DAY_MS) + 1;
}
