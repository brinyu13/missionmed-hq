/* Pure post-session projections. No DOM, network, account, or media access. */

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const milliseconds = value => {
  const parsed = finite(value);
  return parsed === null ? null : Math.max(0, Math.round(parsed));
};

function firstMilliseconds(...values) {
  for (const value of values) {
    const parsed = milliseconds(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function normalizeTimebase(input = {}) {
  const nested = input?.timebase && typeof input.timebase === 'object' ? input.timebase : {};
  const recordingStartSessionMs = firstMilliseconds(
    nested.recordingStartSessionMs,
    input?.recordingStartSessionMs,
    0,
  );
  const sourceSpans = Array.isArray(nested.pausedSpans)
    ? nested.pausedSpans
    : Array.isArray(input?.pausedSpans)
      ? input.pausedSpans
      : [];
  const pausedSpans = sourceSpans
    .map((span) => {
      const startMs = milliseconds(span?.startMs);
      if (startMs === null) return null;
      const endMs = milliseconds(span?.endMs);
      return {
        startMs: Math.max(recordingStartSessionMs, startMs),
        endMs: endMs === null ? null : Math.max(recordingStartSessionMs, startMs, endMs),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMs - b.startMs);
  return Object.freeze({
    canonical: 'session',
    recordingStartSessionMs,
    pausedSpans: Object.freeze(pausedSpans.map((span) => Object.freeze(span))),
  });
}

export function sessionToMediaMs(sessionMs, input = {}) {
  const at = milliseconds(sessionMs);
  if (at === null) return null;
  const timebase = normalizeTimebase(input);
  if (at <= timebase.recordingStartSessionMs) return 0;
  let mediaMs = at - timebase.recordingStartSessionMs;
  for (const span of timebase.pausedSpans) {
    if (at <= span.startMs) break;
    const observedEnd = span.endMs ?? at;
    mediaMs -= Math.max(0, Math.min(at, observedEnd) - span.startMs);
  }
  const playableLimit = firstMilliseconds(input?.playableDurationMs, input?.timebase?.playableDurationMs);
  return Math.max(0, playableLimit === null ? mediaMs : Math.min(mediaMs, playableLimit));
}

export function mediaToSessionMs(mediaMs, input = {}) {
  const at = milliseconds(mediaMs);
  if (at === null) return null;
  const timebase = normalizeTimebase(input);
  let sessionMs = timebase.recordingStartSessionMs + at;
  let removedPauseMs = 0;
  for (const span of timebase.pausedSpans) {
    const mediaAtPause = Math.max(0, span.startMs - timebase.recordingStartSessionMs - removedPauseMs);
    if (at < mediaAtPause) break;
    if (span.endMs === null) return span.startMs;
    const pauseMs = Math.max(0, span.endMs - span.startMs);
    sessionMs += pauseMs;
    removedPauseMs += pauseMs;
  }
  return sessionMs;
}

export function sessionToMediaSeconds(sessionSeconds, input = {}) {
  const seconds = finite(sessionSeconds);
  if (seconds === null) return null;
  const mapped = sessionToMediaMs(seconds * 1000, input);
  return mapped === null ? null : mapped / 1000;
}

export function mediaToSessionSeconds(mediaSeconds, input = {}) {
  const seconds = finite(mediaSeconds);
  if (seconds === null) return null;
  const mapped = mediaToSessionMs(seconds * 1000, input);
  return mapped === null ? null : mapped / 1000;
}

export function normalizeDurations(input = {}) {
  const nested = input?.durations && typeof input.durations === 'object' ? input.durations : {};
  const hasExplicitVocabulary = [
    nested.sessionMs,
    nested.recordingMs,
    nested.playableMs,
    input?.sessionDurationMs,
    input?.recordingDurationMs,
    input?.playableDurationMs,
  ].some((value) => milliseconds(value) !== null);
  const sessionMs = firstMilliseconds(nested.sessionMs, input?.sessionDurationMs, input?.durationMs);
  const recordingMs = firstMilliseconds(
    nested.recordingMs,
    input?.recordingDurationMs,
    input?.recording?.durationMs,
    !hasExplicitVocabulary ? input?.durationMs : null,
  );
  const playableMs = firstMilliseconds(
    nested.playableMs,
    input?.playableDurationMs,
    hasExplicitVocabulary ? input?.durationMs : null,
    recordingMs,
  );
  const activeAnsweringMs = firstMilliseconds(nested.activeAnsweringMs, input?.activeAnsweringDurationMs);
  const analyticsObservationMs = firstMilliseconds(nested.analyticsObservationMs, input?.analyticsObservationDurationMs);
  return Object.freeze({
    sessionDurationMs: sessionMs,
    recordingDurationMs: recordingMs,
    playableDurationMs: playableMs,
    activeAnsweringDurationMs: activeAnsweringMs,
    analyticsObservationDurationMs: analyticsObservationMs,
    sessionMs,
    recordingMs,
    playableMs,
    activeAnsweringMs,
    analyticsObservationMs,
    timelineMs: sessionMs ?? analyticsObservationMs ?? recordingMs ?? playableMs,
    replayMs: playableMs ?? recordingMs,
  });
}

export function tracePath(history = [], key, totalSeconds) {
  const total = Math.max(1, finite(totalSeconds) ?? 1);
  const points = history
    .map(point => ({ point, at: finite(point?.t) }))
    .filter(({ at }) => at !== null && at >= 0 && at <= total)
    .sort((a, b) => a.at - b.at);
  if (!points.length) return '';
  if (!points.some(({ point }) => point?.speaking === false || finite(point?.[key]) !== null)) return '';
  const bottom = 94;
  const top = 6;
  const yOf = normalized => bottom - Math.max(0, Math.min(1, normalized)) * (bottom - top);
  const commands = [`M0.00,${bottom.toFixed(2)}`];
  let value = 0;
  for (const entry of points) {
    const { point, at } = entry;
    const observed = finite(point?.[key]);
    if (point?.speaking === false) value = 0;
    else if (observed !== null) value = Math.max(0, Math.min(1, observed));
    const x = Math.max(0, Math.min(100, at / total * 100));
    commands.push(`L${x.toFixed(2)},${yOf(value).toFixed(2)}`);
  }
  commands.push(`L100.00,${yOf(value).toFixed(2)}`);
  return commands.join(' ');
}

export function intervalRuns(history = [], selector, totalSeconds, { maximumGapSeconds = 1.2 } = {}) {
  const total = Math.max(1, finite(totalSeconds) ?? 1);
  const maximumGap = Math.max(0, finite(maximumGapSeconds) ?? 1.2);
  const runs = [];
  let current = null;
  let previousAt = null;
  for (const point of history) {
    const at = finite(point?.t);
    if (at === null) continue;
    const value = selector(point);
    const followsGap = previousAt !== null && at - previousAt > maximumGap;
    if (!current || current.value !== value || followsGap) {
      if (current && !followsGap) current.end = at;
      current = { value, start: at, end: at };
      runs.push(current);
    } else current.end = at;
    previousAt = at;
  }
  return runs.map(run => ({
    ...run,
    left: Math.max(0, Math.min(100, run.start / total * 100)),
    width: Math.max(.35, Math.min(100, (run.end - run.start) / total * 100)),
  }));
}

export function selectLibrarySessions(sessions = [], {
  filter = 'all', query = '', sort = 'newest', scoreOf = () => ({}),
  dateRangeDays = 0, category = 'all', performance = 'all', now = Date.now(),
} = {}) {
  const needle = String(query).trim().toLowerCase();
  const average = row => {
    const values = Object.values(scoreOf(row) || {}).map(finite).filter(value => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : -1;
  };
  return sessions
    .filter(row => filter === 'all'
      ? true
      : filter === 'reviewed'
        ? row.reviewStatus === 'reviewed'
        : filter === 'pending'
          ? row.reviewStatus !== 'reviewed'
          : row.sessionType === filter)
    .filter(row => !needle || `${row.title || ''} ${row.questionText || ''}`.toLowerCase().includes(needle))
    .filter(row => category === 'all' || row.category === category || row.questionCategory === category)
    .filter(row => !dateRangeDays || now - new Date(row.startedAt).getTime() <= Number(dateRangeDays) * 86_400_000)
    .filter(row => {
      if (performance === 'all') return true;
      const score = average(row);
      return performance === 'on-target' ? score >= 7 && score <= 8.5 : performance === 'needs-work' ? score >= 0 && (score < 7 || score > 8.5) : true;
    })
    .slice()
    .sort((a, b) => sort === 'oldest'
      ? new Date(a.startedAt) - new Date(b.startedAt)
      : sort === 'score'
        ? average(b) - average(a)
        : sort === 'duration'
          ? (finite(b.recording?.durationMs ?? b.durationMs) ?? -1) - (finite(a.recording?.durationMs ?? a.durationMs) ?? -1)
          : ['pace', 'volume', 'variety'].includes(sort)
            ? (finite(scoreOf(b)?.[sort]) ?? -1) - (finite(scoreOf(a)?.[sort]) ?? -1)
            : sort === 'review'
              ? String(a.reviewStatus || '').localeCompare(String(b.reviewStatus || ''))
              : sort === 'question'
                ? String(a.questionText || a.title || '').localeCompare(String(b.questionText || b.title || ''))
        : new Date(b.startedAt) - new Date(a.startedAt));
}

export function selectMentorSessions(sessions = [], {
  filter = 'pending', query = '', student = 'all', mode = 'all', category = 'all', dateRangeDays = 0, now = Date.now(),
} = {}) {
  const needle = String(query).trim().toLowerCase();
  return sessions
    .filter(row => filter === 'all' ? true : filter === 'reviewed' ? row.reviewStatus === 'reviewed' : row.reviewStatus !== 'reviewed')
    .filter(row => !needle || `${row.title || ''} ${row.studentName || row.ownerDisplayName || ''} ${row.questionText || ''}`.toLowerCase().includes(needle))
    .filter(row => student === 'all' || String(row.ownerId || row.studentId || row.studentName || row.ownerDisplayName) === student)
    .filter(row => mode === 'all' || row.sessionType === mode)
    .filter(row => category === 'all' || row.category === category || row.questionCategory === category)
    .filter(row => !dateRangeDays || now - new Date(row.startedAt).getTime() <= Number(dateRangeDays) * 86_400_000);
}
