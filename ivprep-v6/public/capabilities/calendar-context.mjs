function safeText(value, max = 180) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, max);
}

function publicEvent(row = {}) {
  const id = safeText(row.id || row.source_id, 180);
  const startsAt = safeText(row.start_at || row.startAt, 80);
  const startMs = Date.parse(startsAt);
  if (!id || !Number.isFinite(startMs)) return null;
  return Object.freeze({
    id,
    title: safeText(row.title || 'Scheduled interview'),
    startsAt,
    endsAt: safeText(row.end_at || row.endAt, 80) || null,
    status: safeText(row.status || 'unknown', 40).toLowerCase(),
    provider: safeText(row.meeting_provider || row.meeting_platform || 'unavailable', 40).toLowerCase(),
    joinAvailable: Boolean(row.join_url || row.meeting_url || row.join_button?.url),
    recordingStatus: safeText(row.recording_status || 'not_expected', 40).toLowerCase(),
  });
}

async function json(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const error = new Error(safeText(body?.error || body?.message || `calendar_http_${response.status}`, 120));
    error.status = response.status;
    throw error;
  }
  return body?.data || body || {};
}

/**
 * Presentation-neutral, student-scoped projection of the Scheduler calendar.
 * Join/meeting URLs and owner metadata are reduced to booleans at this boundary.
 */
export class InterviewCalendarCapability {
  constructor({ fetchImpl, now = () => Date.now(), endpoint = '/api/scheduler/calendar-feed' } = {}) {
    const resolvedFetch = fetchImpl
      || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
    if (typeof resolvedFetch !== 'function') throw new TypeError('Interview Calendar requires fetch.');
    this.fetchImpl = resolvedFetch;
    this.now = now;
    this.endpoint = endpoint;
  }

  async studentCalendar() {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' },
    });
    const payload = await json(response);
    const events = (Array.isArray(payload.events) ? payload.events : [])
      .map(publicEvent)
      .filter(Boolean)
      .filter((event) => !['canceled', 'cancelled'].includes(event.status))
      .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
      .slice(0, 24);
    const now = Number(this.now());
    const upcoming = events.filter((event) => Date.parse(event.startsAt) >= now);
    return Object.freeze({
      schema: 'ivoc.calendar-context.v1',
      eventCount: events.length,
      upcomingCount: upcoming.length,
      nextEvent: upcoming[0] || null,
    });
  }
}
