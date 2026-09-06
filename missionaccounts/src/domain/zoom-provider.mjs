import { createHash } from 'node:crypto';

function providerError(message, status = 502) {
  return Object.assign(new Error(message), { status });
}

function assertIso(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw providerError(`${label} must be an ISO timestamp`, 400);
  return new Date(parsed).toISOString();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function defaultClassification(meeting) {
  return {
    cycleKey: meeting.cycle_key,
    providerMeetingId: meeting.provider_meeting_id,
    providerInstanceId: meeting.provider_instance_id,
    startsAt: meeting.starts_at,
    heldOn: meeting.held_on,
    timeZone: meeting.time_zone || 'America/New_York',
    step: meeting.step || 'unknown',
    state: meeting.state || 'candidate',
  };
}

function localDateInZone(value, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localDrillsClock(value, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    weekday: values.weekday,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

export function createCycleBoundZoomClassifier({ cycleProvider, timeZone = 'America/New_York' } = {}) {
  if (typeof cycleProvider !== 'function') throw providerError('Zoom cycle provider is required', 503);
  return async meeting => {
    const startsAt = assertIso(meeting?.starts_at, 'Zoom meeting start');
    const heldOn = localDateInZone(startsAt, timeZone);
    const cycles = await cycleProvider();
    if (!Array.isArray(cycles)) throw providerError('MissionAccounts cycle response is invalid');
    const cycle = cycles.find(row => heldOn >= String(row.starts_on) && heldOn <= String(row.ends_on));
    if (!cycle) return null;
    const { weekday, minutes } = localDrillsClock(startsAt, timeZone);
    const participantCount = Number(meeting?.participant_count);
    const failedParameters = [];
    if (!['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday)) failedParameters.push('weekend');
    if (minutes < 11 * 60 + 45) failedParameters.push('before_11_45_et');
    if (minutes > 16 * 60) failedParameters.push('after_16_00_et');
    if (!Number.isInteger(participantCount) || participantCount <= 15) failedParameters.push('participant_count_not_over_15');
    return {
      cycleKey: cycle.key,
      providerMeetingId: meeting.provider_meeting_id,
      providerInstanceId: meeting.provider_instance_id,
      startsAt,
      heldOn,
      timeZone,
      step: meeting.step,
      state: failedParameters.length === 0 ? 'confirmed' : 'needs_review',
      classification: {
        rule: 'weekday_11_45_to_16_00_et_and_participants_over_15_ignore_duration',
        participant_count: Number.isFinite(participantCount) ? participantCount : null,
        failed_parameters: failedParameters,
      },
    };
  };
}

export class ZoomAttendanceProvider {
  constructor({ client = null, classifyMeeting = defaultClassification, mode = 'disabled', now = () => new Date() } = {}) {
    this.client = client;
    this.classifyMeeting = classifyMeeting;
    this.mode = mode;
    this.now = now;
  }

  isConfigured() {
    return this.mode === 'configured'
      && typeof this.client?.listCompletedMeetings === 'function'
      && typeof this.client?.listParticipants === 'function'
      && typeof this.classifyMeeting === 'function';
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw providerError('ZoomAttendanceProvider is not configured', 503);
    }
  }

  async listCompletedMeetings(window) {
    this.assertConfigured();
    const rows = await this.client.listCompletedMeetings(window);
    if (!Array.isArray(rows)) throw providerError('Zoom completed-meeting response is invalid');
    return rows;
  }

  async listParticipants(meeting) {
    this.assertConfigured();
    const rows = await this.client.listParticipants({ meeting });
    if (!Array.isArray(rows)) throw providerError('Zoom participant response is invalid');
    return rows;
  }

  async ingestWindow({ from, to }) {
    this.assertConfigured();
    const windowFrom = assertIso(from, 'Zoom window start');
    const windowTo = assertIso(to, 'Zoom window end');
    if (windowTo < windowFrom || Date.parse(windowTo) - Date.parse(windowFrom) > 31 * 86_400_000) {
      throw providerError('Zoom ingestion window must be ordered and no longer than 31 days', 400);
    }

    const sessions = [];
    const sourceRows = [];
    const completed = await this.listCompletedMeetings({ from: windowFrom, to: windowTo });
    for (const rawMeeting of completed) {
      const participants = await this.listParticipants(rawMeeting);
      const classification = await this.classifyMeeting({
        ...rawMeeting,
        participant_count: Number.isInteger(rawMeeting.participant_count)
          ? rawMeeting.participant_count
          : participants.length,
      });
      if (!classification) continue;
      const {
        cycleKey, providerMeetingId, providerInstanceId, startsAt, heldOn,
        timeZone = 'America/New_York', step = 'unknown', state = 'candidate', classification: classificationEvidence = null,
      } = classification;
      if (!cycleKey || !providerMeetingId || !providerInstanceId
        || !/^\d{4}-\d{2}-\d{2}$/.test(String(heldOn || ''))
        || !['s1', 's23', 'unknown'].includes(step)
        || !['candidate', 'confirmed', 'rejected', 'needs_review'].includes(state)) {
        throw providerError('Zoom meeting classification is incomplete');
      }
      const normalizedStartsAt = assertIso(startsAt, 'Zoom meeting start');
      sessions.push({
        cycle_key: cycleKey,
        provider_meeting_id: String(providerMeetingId),
        provider_instance_id: String(providerInstanceId),
        starts_at: normalizedStartsAt,
        held_on: heldOn,
        time_zone: timeZone,
        step,
        state,
        source_payload: {
          ...rawMeeting,
          classification: classificationEvidence,
        },
      });

      participants.forEach((participant, index) => {
        const displayName = String(participant.display_name || participant.name || '').trim();
        const joinedAt = participant.joined_at ? assertIso(participant.joined_at, 'Zoom participant join') : null;
        const leftAt = participant.left_at ? assertIso(participant.left_at, 'Zoom participant leave') : null;
        if (!displayName) throw providerError('Zoom participant display name is required');
        const durationSeconds = participant.duration_seconds == null ? null : Number(participant.duration_seconds);
        if (durationSeconds != null && (!Number.isInteger(durationSeconds) || durationSeconds < 0)) {
          throw providerError('Zoom participant duration must be a non-negative integer');
        }
        const providerSourceId = String(participant.provider_source_id
          || `${providerInstanceId}:${participant.participant_source_id || 'anonymous'}:${joinedAt || 'unknown'}:${index}`);
        const rawPayload = JSON.stringify(participant);
        sourceRows.push({
          provider_instance_id: String(providerInstanceId),
          provider_source_id: providerSourceId,
          participant_source_id: participant.participant_source_id ? String(participant.participant_source_id) : null,
          display_name: displayName,
          joined_at: joinedAt,
          left_at: leftAt,
          duration_seconds: durationSeconds,
          payload: participant,
          payload_sha256: sha256(rawPayload),
        });
      });
    }

    if (new Set(sourceRows.map(row => row.provider_source_id)).size !== sourceRows.length) {
      throw providerError('Zoom batch contains duplicate provider source rows');
    }
    const serialized = JSON.stringify({ window_from: windowFrom, window_to: windowTo, sessions, source_rows: sourceRows });
    return {
      state: 'ready_to_persist',
      window_from: windowFrom,
      window_to: windowTo,
      artifact: {
        source_path: `zoom-api://completed-meetings/${encodeURIComponent(windowFrom)}/${encodeURIComponent(windowTo)}`,
        sha256: sha256(serialized),
        byte_count: Buffer.byteLength(serialized),
        observed_at: this.now().toISOString(),
      },
      sessions,
      source_rows: sourceRows,
      stats: { completed_meetings: completed.length, classified_sessions: sessions.length, source_rows: sourceRows.length },
    };
  }
}
