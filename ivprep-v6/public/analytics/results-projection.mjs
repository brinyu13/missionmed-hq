import {
  ANALYTICS_ENGINE_VERSION,
  SESSION_SCHEMA,
  serializeAnalyticsEnvelope,
  validateEvidenceTimeline,
} from './event-contract.mjs';
import { VALIDATION_RECORD, projectStudentEvents } from './signal-registry.mjs';

function isCanonicalEnvelope(entry) {
  try {
    if (!entry || entry.schema !== SESSION_SCHEMA || entry.engineVersion !== ANALYTICS_ENGINE_VERSION) return false;
    if (entry.validationRecordId !== VALIDATION_RECORD.id || entry.validationManifestSha256 !== VALIDATION_RECORD.fixtureManifestSha256) return false;
    if (!entry.privacy || entry.privacy.rawAudioStored !== false || entry.privacy.rawFramesStored !== false || entry.privacy.rawLandmarksStored !== false || entry.privacy.externalAnalyticsCalls !== false) return false;
    if (!Array.isArray(entry.events) || entry.sessionId === undefined || !Number.isFinite(entry.startedAtMs) || !Number.isFinite(entry.endedAtMs) || !Number.isFinite(entry.durationMs)) return false;
    if (entry.endedAtMs < entry.startedAtMs || entry.durationMs !== entry.endedAtMs - entry.startedAtMs) return false;
    for (const event of entry.events) {
      if (event.answerId !== entry.answerId || event.startMs < entry.startedAtMs || event.endMs > entry.endedAtMs) return false;
      const evidenceLimitMs = event.evidenceRef?.mediaId ? entry.mediaTimelineDurationMs : entry.durationMs;
      if (event.evidenceRef && (!Number.isFinite(evidenceLimitMs) || event.evidenceRef.mediaStartMs < 0 || event.evidenceRef.mediaEndMs < event.evidenceRef.mediaStartMs || event.evidenceRef.mediaEndMs > evidenceLimitMs)) return false;
    }
    const durationEvents = entry.events.filter((event) => event.metric === 'answer_duration_ms');
    if (durationEvents.length !== 1) return false;
    const durationEvent = durationEvents[0];
    if (durationEvent.startMs !== entry.startedAtMs || durationEvent.endMs !== entry.endedAtMs || durationEvent.durationMs !== entry.durationMs || durationEvent.observation?.value !== entry.durationMs || durationEvent.observation?.unit !== 'ms') return false;
    validateEvidenceTimeline(entry.events, { sessionId: entry.sessionId, durationMs: entry.endedAtMs });
    serializeAnalyticsEnvelope(entry);
    return true;
  } catch {
    return false;
  }
}

export function analyticsEnvelopes(result) {
  const value = result?.communicationAnalytics;
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(isCanonicalEnvelope);
}

export function studentResultProjection(result) {
  const envelopes = analyticsEnvelopes(result);
  const events = envelopes.flatMap((envelope) => projectStudentEvents(envelope.events));
  return Object.freeze({
    engineAvailable: envelopes.length > 0,
    available: events.length > 0,
    events: Object.freeze(events.slice(0, 18)),
    answerCount: envelopes.length,
    privacy: Object.freeze({ rawAudioStored: false, rawFramesStored: false, rawLandmarksStored: false, externalAnalyticsCalls: false }),
  });
}

export function persistentAnalyticsEnvelopes(value) {
  return analyticsEnvelopes({ communicationAnalytics: value }).map((entry) => {
    const events = projectStudentEvents(entry.events).map((event) => {
      const clone = JSON.parse(JSON.stringify(event));
      clone.evidenceRef = clone.evidenceRef ? {
        mediaId: null,
        mediaStartMs: Math.max(0, event.startMs - entry.startedAtMs),
        mediaEndMs: Math.max(0, event.endMs - entry.startedAtMs),
        transcriptSegmentIds: [],
      } : null;
      return clone;
    });
    if (!events.some((event) => event.metric === 'answer_duration_ms')) return null;
    const persisted = {
      schema: entry.schema,
      engineVersion: entry.engineVersion,
      validationRecordId: entry.validationRecordId,
      validationManifestSha256: entry.validationManifestSha256,
      sessionId: entry.sessionId,
      answerId: entry.answerId,
      startedAtMs: entry.startedAtMs,
      endedAtMs: entry.endedAtMs,
      durationMs: entry.durationMs,
      mediaTimelineDurationMs: null,
      events,
      studentEvents: events,
      privacy: {
        rawAudioStored: false,
        rawFramesStored: false,
        rawLandmarksStored: false,
        externalAnalyticsCalls: false,
        blockedExternalAttemptCount: Math.max(0, Number(entry.privacy?.blockedExternalAttemptCount) || 0),
      },
    };
    return isCanonicalEnvelope(persisted) ? Object.freeze(persisted) : null;
  }).filter(Boolean);
}

export function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.round(Number(milliseconds) / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function describeStudentEvent(event) {
  const value = event?.observation?.value;
  if (event.metric === 'answer_duration_ms') return `Answer duration ${formatDuration(value)}.`;
  if (event.metric === 'captured_level_dbfs') return `Captured microphone level ${Number(value).toFixed(1)} dBFS. This is a device signal, not calibrated loudness.`;
  if (event.metric === 'digital_clipping_fraction') {
    const fraction = Number(value);
    if (fraction === 0) return 'No digital clipping was detected in analyzed digital audio samples.';
    const percent = fraction * 100;
    const display = percent < 1 ? '<1' : String(Number(percent.toFixed(percent < 10 ? 1 : 0)));
    return `${display}% of analyzed digital audio samples were clipped.`;
  }
  return 'Validated observable signal.';
}
