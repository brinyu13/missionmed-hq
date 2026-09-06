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

export class ZoomAttendanceProvider {
  constructor({ client = null, classifyMeeting = defaultClassification, mode = 'disabled', now = () => new Date() } = {}) {
    this.client = client;
    this.classifyMeeting = classifyMeeting;
    this.mode = mode;
    this.now = now;
  }

  assertConfigured() {
    if (this.mode !== 'configured'
      || typeof this.client?.listCompletedMeetings !== 'function'
      || typeof this.client?.listParticipants !== 'function'
      || typeof this.classifyMeeting !== 'function') {
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
      const classification = await this.classifyMeeting(rawMeeting);
      if (!classification) continue;
      const {
        cycleKey, providerMeetingId, providerInstanceId, startsAt, heldOn,
        timeZone = 'America/New_York', step = 'unknown', state = 'candidate',
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
        source_payload: rawMeeting,
      });

      const participants = await this.listParticipants(rawMeeting);
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
