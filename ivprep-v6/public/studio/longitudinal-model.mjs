const STUDENT_SAFE = 'VALIDATED_STUDENT_SAFE';

const finite = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ? Number(value)
  : null;
const isoTime = (value) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

function validatedEvents(session) {
  const events = session?.results?.payload?.analytics?.studentEvents;
  return Array.isArray(events)
    ? events.filter((event) => event?.maturity === STUDENT_SAFE && finite(event?.observation?.value) !== null)
    : [];
}

function eventValue(events, metric) {
  const event = events.find((entry) => entry.metric === metric);
  return event ? finite(event.observation.value) : null;
}

export function attemptSnapshot(session) {
  if (!session || session.state !== 'saved') return null;
  const events = validatedEvents(session);
  const analytics = session?.results?.payload?.analytics || {};
  const at = isoTime(session.endedAt || session.startedAt);
  const recordedMs = finite(session?.recording?.durationMs) ?? finite(session.durationMs);
  return Object.freeze({
    id: String(session.id || ''),
    title: String(session.questionText || session.title || session.questionId || 'Saved answer'),
    questionId: session.questionId || null,
    at,
    recordedMs: recordedMs === null ? null : Math.max(0, recordedMs),
    metrics: Object.freeze({
      answerDurationMs: eventValue(events, 'answer_duration_ms'),
      capturedLevelDbfs: eventValue(events, 'captured_level_dbfs'),
      digitalClippingFraction: eventValue(events, 'digital_clipping_fraction'),
      microphoneCoverage: finite(analytics?.modalities?.mic?.coverage),
      cameraCoverage: finite(analytics?.modalities?.camera?.coverage),
    }),
    evidenceCount: events.length,
  });
}

export function buildLongitudinalModel(sessions = []) {
  const attempts = sessions.map(attemptSnapshot).filter(Boolean).sort((a, b) => (b.at ?? -1) - (a.at ?? -1));
  const recordedMs = attempts.reduce((sum, attempt) => sum + (attempt.recordedMs ?? 0), 0);
  const activeDays = new Set(attempts.filter((attempt) => attempt.at !== null).map((attempt) => new Date(attempt.at).toISOString().slice(0, 10))).size;
  const uniqueQuestions = new Set(attempts.map((attempt) => attempt.questionId || attempt.title).filter(Boolean)).size;
  return Object.freeze({
    attempts: Object.freeze(attempts),
    totals: Object.freeze({ savedSessions: attempts.length, recordedMs, activeDays, uniqueQuestions }),
  });
}

export function compareAttempts(left, right) {
  if (!left || !right || left.id === right.id) return null;
  const metrics = [
    ['answerDurationMs', 'Answer duration', 'ms'],
    ['capturedLevelDbfs', 'Captured mic level', 'dBFS'],
    ['digitalClippingFraction', 'Digital clipping', 'fraction'],
    ['microphoneCoverage', 'Microphone coverage', 'fraction'],
    ['cameraCoverage', 'Camera coverage', 'fraction'],
  ].map(([key, label, unit]) => {
    const leftValue = finite(left.metrics?.[key]);
    const rightValue = finite(right.metrics?.[key]);
    return Object.freeze({ key, label, unit, left: leftValue, right: rightValue, delta: leftValue === null || rightValue === null ? null : rightValue - leftValue });
  });
  return Object.freeze({ left, right, metrics: Object.freeze(metrics) });
}
