function safeText(value, max = 160) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, max);
}

function providerOf(row = {}) {
  return safeText(
    row.meeting_provider || row.meetingProvider || row.provider
      || row.metadata?.meeting_provider || row.metadata?.scheduler_integrations?.meeting?.provider,
    40,
  ).toLowerCase();
}

function publicAppointment(row = {}) {
  const id = safeText(row.id || row.appointment_id || row.appointmentId, 160);
  return Object.freeze({
    id,
    label: safeText(row.title || row.appointment_type_name || row.appointmentTypeName || 'Supervised mock'),
    status: safeText(row.status || 'unknown', 40).toLowerCase(),
    provider: providerOf(row) || 'unavailable',
    startsAt: safeText(row.start_at || row.startAt, 80) || null,
    recordingEligible: Boolean(id && providerOf(row) === 'webex'),
  });
}

async function json(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const error = new Error(safeText(body?.error || body?.message || `live_mock_http_${response.status}`, 120));
    error.status = response.status;
    throw error;
  }
  return body?.data || body || {};
}

/**
 * Presentation-neutral bridge to the existing MissionMed Scheduler/Webex owner.
 * It reads authorized projections only: no sibling mutation, provider secret,
 * direct-download URL, or IVOC media claim crosses this boundary.
 */
export class LiveMockStudioCapability {
  constructor({ fetchImpl, base = '/api/scheduler' } = {}) {
    const resolvedFetch = fetchImpl
      || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
    if (typeof resolvedFetch !== 'function') throw new TypeError('Live Mock Studio requires fetch.');
    this.fetchImpl = resolvedFetch;
    this.base = String(base || '/api/scheduler').replace(/\/$/u, '');
  }

  async adminQueue() {
    const response = await this.fetchImpl(`${this.base}/admin/appointments`, {
      method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' },
    });
    const payload = await json(response);
    const appointments = (Array.isArray(payload.appointments) ? payload.appointments : [])
      .map(publicAppointment)
      .filter((row) => row.id)
      .slice(0, 12);
    return Object.freeze({ schema: 'ivoc.live-mock.queue.v1', appointments });
  }

  async recordingStatus(appointmentId) {
    const id = safeText(appointmentId, 160);
    if (!id) throw new TypeError('appointmentId is required.');
    const response = await this.fetchImpl(`${this.base}/appointments/${encodeURIComponent(id)}/recording`, {
      method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' },
    });
    const payload = await json(response);
    const recording = payload.recording || {};
    return Object.freeze({
      schema: 'ivoc.live-mock.recording.v1',
      appointmentId: id,
      status: safeText(payload.status || 'unavailable', 40).toLowerCase(),
      provider: safeText(payload.meeting_provider || 'webex', 40).toLowerCase(),
      playbackAvailable: payload.has_recording === true && Boolean(payload.playback_url || recording.playback_url),
      downloadAllowed: false,
      source: safeText(payload.source || 'scheduler-owner', 80),
    });
  }
}
