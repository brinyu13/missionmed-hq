import { IvocApi } from '../ivoc-standalone/app/api.mjs';
import { AccountRecordingController } from '../ivoc-standalone/app/recording.mjs';

const finiteMs = (value) => Number.isFinite(Number(value))
  ? Math.max(0, Math.round(Number(value)))
  : null;

export function createDurableResultsEnvelope({
  sessionId,
  analytics,
  recording = null,
  capturedAt = new Date().toISOString(),
} = {}) {
  const sessionDurationMs = finiteMs(analytics?.durationMs);
  const recordingDurationMs = finiteMs(recording?.recordingDurationMs ?? recording?.recording?.durationMs);
  const playableDurationMs = finiteMs(recording?.playableDurationMs ?? recording?.durationMs)
    ?? recordingDurationMs
    ?? sessionDurationMs;
  return Object.freeze({
    schema: 'ivoc.analytics.v1',
    schemaVersion: 1,
    sessionId: sessionId || null,
    capturedAt,
    durationMs: playableDurationMs,
    sessionDurationMs,
    recordingDurationMs,
    playableDurationMs,
    activeAnsweringDurationMs: sessionDurationMs,
    analyticsObservationDurationMs: sessionDurationMs,
    recordingStartSessionMs: finiteMs(recording?.recordingStartSessionMs),
    pausedSpans: Array.isArray(recording?.pausedSpans)
      ? recording.pausedSpans.map((span) => ({ startMs: finiteMs(span.startMs), endMs: finiteMs(span.endMs) }))
      : [],
    // No population score or behavior inference is manufactured by the persistence
    // adapter. The validated analytics envelope remains the evidence authority.
    scores: {},
    counters: {},
    events: Array.isArray(analytics?.events) ? analytics.events : [],
    history: [],
    metrics: null,
    behavior: null,
    analytics: analytics || null,
  });
}

export class DurableStudioSession {
  constructor({
    api = new IvocApi(),
    recordingFactory = (options) => new AccountRecordingController(options),
    now = () => new Date().toISOString(),
  } = {}) {
    this.api = api;
    this.recordingFactory = recordingFactory;
    this.now = now;
    this.bootstrapPayload = null;
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
  }

  get ready() { return Boolean(this.bootstrapPayload?.entitlement?.admitted); }

  async bootstrap() {
    this.bootstrapPayload = await this.api.bootstrap();
    return this.bootstrapPayload;
  }

  async start({ stream, question = null, wizard = {}, targetQuestions = 1, interviewerProvider = 'missionmed-static' } = {}) {
    if (!this.ready) throw new Error('durable_session_not_ready');
    if (this.accountSession) throw new Error('durable_session_already_active');
    const title = question?.canonical_text || 'IV Prep practice session';
    this.accountSession = await this.api.createSession({
      title: title.split(/\s+/u).slice(0, 10).join(' '),
      sessionType: targetQuestions > 1 ? 'mock' : 'question',
      questionId: question?.question_id || null,
      questionText: question?.canonical_text || null,
      interviewerProvider,
      analyticsSchema: 'ivoc.analytics.v1',
      recordingEnabled: true,
      context: {
        goal: wizard.goal || null,
        interviewer: wizard.interviewer || null,
        program: wizard.program || null,
        environment: wizard.environment || null,
        readiness: wizard.readiness || null,
        targetQuestions: Math.max(1, Math.min(30, Number(targetQuestions) || 1)),
      },
    });
    this.recorder = this.recordingFactory({
      api: this.api,
      stream,
      enabled: true,
      sessionId: this.accountSession.id,
      title,
      questionId: question?.question_id || null,
    });
    await this.recorder.start();
    return this.accountSession;
  }

  async finish(analyticsPromise) {
    const accountSession = this.accountSession;
    const recorder = this.recorder;
    if (!accountSession) return { persisted: false, analytics: await analyticsPromise, recording: null, result: null };
    const resolvedAnalytics = analyticsPromise == null
      ? Promise.resolve(this.pendingAnalytics)
      : Promise.resolve(analyticsPromise).then((value) => {
        this.pendingAnalytics = value;
        return value;
      });
    const recordingPromise = recorder?.stopAndSeal?.() || Promise.resolve(null);
    const [analytics, recording] = await Promise.all([resolvedAnalytics, recordingPromise]);
    const envelope = createDurableResultsEnvelope({
      sessionId: accountSession.id,
      analytics,
      recording,
      capturedAt: this.now(),
    });
    const result = await this.api.saveResults(accountSession.id, envelope);
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
    return { persisted: true, analytics, recording, result, envelope, session: accountSession };
  }

  async library(scope = 'own') { return this.api.library(scope); }
  async playback(recordingId, disposition = 'inline') { return this.api.playback(recordingId, disposition); }
  async abandon({ reason = 'client_exit', keepalive = false } = {}) {
    const accountSession = this.accountSession;
    if (!accountSession?.id) return { abandoned: false, reason: 'no_active_session' };
    const result = await this.api.abandonSession(accountSession.id, { reason }, { keepalive });
    this.recorder?.destroy?.();
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
    return result;
  }
  async analyze({ sessionId, recordingId, answerId, questionId, analyticsEvents = [] } = {}) {
    return this.api.context({
      action: 'analyze',
      sessionId,
      recordingId,
      answerId,
      questionId,
      analyticsEvents,
    });
  }

  destroy() {
    this.recorder?.destroy?.();
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
  }
}
