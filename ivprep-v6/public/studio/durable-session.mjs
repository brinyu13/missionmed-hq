import { IvocApi } from '../ivoc-standalone/app/api.mjs';
import { AccountRecordingController } from '../ivoc-standalone/app/recording.mjs';

const finiteMs = (value) => Number.isFinite(Number(value))
  ? Math.max(0, Math.round(Number(value)))
  : null;

export function createDurableResultsEnvelope({
  sessionId,
  analytics,
  recording = null,
  liveConversation = null,
  audioAuthority = null,
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
    ...(liveConversation?.turns?.length ? { liveConversation } : {}),
    ...(audioAuthority?.events?.length ? { audioAuthority } : {}),
  });
}

export class DurableStudioSession {
  constructor({
    api = new IvocApi(),
    recordingFactory = (options) => new AccountRecordingController(options),
    now = () => new Date().toISOString(),
    nowMs = () => performance.now(),
  } = {}) {
    this.api = api;
    this.recordingFactory = recordingFactory;
    this.now = now;
    this.nowMs = nowMs;
    this.bootstrapPayload = null;
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
    this.preparedSessionKey = null;
    this.liveConversationTurns = new Map();
    this.liveConversationSequence = 0;
    this.conversationCaptureStartedAtMs = null;
    this.liveAudioAuthorityEvents = [];
  }

  get ready() { return Boolean(this.bootstrapPayload?.entitlement?.admitted); }

  async bootstrap() {
    this.bootstrapPayload = await this.api.bootstrap();
    return this.bootstrapPayload;
  }

  sessionInput({ question = null, interviewSet = [], wizard = {}, targetQuestions = 1, interviewerProvider = 'missionmed-static' } = {}) {
    const title = question?.canonical_text || 'IV Prep practice session';
    return {
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
        pressurePractice: wizard.pressurePractice === true,
        questionIds: interviewSet.map((item) => String(item?.question_id || '')).filter(Boolean).slice(0, 30),
        targetQuestions: Math.max(1, Math.min(30, Number(targetQuestions) || 1)),
      },
    };
  }

  async prepare(options = {}) {
    if (!this.ready) throw new Error('durable_session_not_ready');
    const input = this.sessionInput(options);
    const key = JSON.stringify(input);
    if (this.accountSession) {
      if (this.preparedSessionKey !== key) throw new Error('durable_session_context_changed');
      return this.accountSession;
    }
    this.liveConversationTurns.clear();
    this.liveConversationSequence = 0;
    this.conversationCaptureStartedAtMs = null;
    this.liveAudioAuthorityEvents = [];
    this.accountSession = await this.api.createSession(input);
    this.preparedSessionKey = key;
    return this.accountSession;
  }

  async start({ stream, question = null, interviewSet = [], wizard = {}, targetQuestions = 1, interviewerProvider = 'missionmed-static' } = {}) {
    const title = question?.canonical_text || 'IV Prep practice session';
    await this.prepare({ question, interviewSet, wizard, targetQuestions, interviewerProvider });
    if (this.recorder) throw new Error('durable_session_already_active');
    this.recorder = this.recordingFactory({
      api: this.api,
      stream,
      enabled: true,
      sessionId: this.accountSession.id,
      title,
      questionId: question?.question_id || null,
    });
    await this.recorder.start();
    this.liveConversationTurns.clear();
    this.liveConversationSequence = 0;
    this.conversationCaptureStartedAtMs = this.nowMs();
    return this.accountSession;
  }

  recordLiveTranscript(event = {}) {
    if (!this.recorder || this.conversationCaptureStartedAtMs == null) return false;
    const speaker = event.speaker === 'applicant' ? 'student' : event.speaker;
    if (!['student', 'interviewer'].includes(speaker)) return false;
    const rawText = String(event.text || '').slice(0, 8_000);
    const text = event.final ? rawText.trim() : rawText;
    const id = String(event.identity || `${speaker}:${++this.liveConversationSequence}`).slice(0, 240);
    const observedAtMs = Math.max(0, Math.round(this.nowMs() - this.conversationCaptureStartedAtMs));
    const current = this.liveConversationTurns.get(id) || {
      id,
      speaker,
      startMs: observedAtMs,
      endMs: observedAtMs,
      text: '',
      final: false,
      providerEventType: null,
    };
    current.endMs = observedAtMs;
    current.providerEventType = String(event.type || '').slice(0, 200) || current.providerEventType;
    current.text = event.final ? (text || current.text) : `${current.text}${text}`.slice(0, 8_000);
    current.final = current.final || event.final === true;
    this.liveConversationTurns.set(id, current);
    return true;
  }

  recordLiveAudioTelemetry(event = {}) {
    if (!this.accountSession || event.schema !== 'ivoc.audio-authority.event.v1'
        || event.authority !== 'openai-gpt-live-native' || event.mode !== 'single'
        || !['configured', 'bound', 'surplus_rejected', 'released'].includes(event.state)) return false;
    const observedAtMs = finiteMs(event.observedAtMs) ?? 0;
    this.liveAudioAuthorityEvents.push(Object.freeze({ state: event.state, observedAtMs }));
    this.liveAudioAuthorityEvents = this.liveAudioAuthorityEvents.slice(-64);
    return true;
  }

  liveAudioAuthoritySnapshot() {
    if (!this.liveAudioAuthorityEvents.length) return null;
    return Object.freeze({
      schema: 'ivoc.audio-authority.v1',
      mode: 'single',
      authority: 'openai-gpt-live-native',
      events: Object.freeze(this.liveAudioAuthorityEvents.map((event) => Object.freeze({ ...event }))),
    });
  }

  liveConversationSnapshot() {
    const turns = [...this.liveConversationTurns.values()]
      .filter((turn) => turn.final && turn.text)
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
      .slice(0, 128)
      .map((turn) => Object.freeze({ ...turn }));
    return Object.freeze({
      schema: 'ivoc.live-conversation.v1',
      provider: 'openai-gpt-live',
      clock: 'recording-observed',
      turns: Object.freeze(turns),
    });
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
    const liveConversation = this.liveConversationSnapshot();
    const envelope = createDurableResultsEnvelope({
      sessionId: accountSession.id,
      analytics,
      recording,
      liveConversation,
      audioAuthority: this.liveAudioAuthoritySnapshot(),
      capturedAt: this.now(),
    });
    const result = await this.api.saveResults(accountSession.id, envelope);
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
    this.preparedSessionKey = null;
    this.liveConversationTurns.clear();
    this.liveAudioAuthorityEvents = [];
    this.conversationCaptureStartedAtMs = null;
    return { persisted: true, analytics, recording, result, envelope, session: accountSession };
  }

  async library(scope = 'own') { return this.api.library(scope); }
  async playback(recordingId, disposition = 'inline') { return this.api.playback(recordingId, disposition); }
  async adminOverview() {
    if (!this.ready || this.bootstrapPayload?.identity?.admin !== true) {
      throw new Error('ivoc_admin_required');
    }
    const [config, credits, questions] = await Promise.all([
      this.api.adminConfig(),
      this.api.credits(),
      this.api.questions(),
    ]);
    return Object.freeze({ config, credits, questions });
  }
  async abandon({ reason = 'client_exit', keepalive = false } = {}) {
    const accountSession = this.accountSession;
    if (!accountSession?.id) return { abandoned: false, reason: 'no_active_session' };
    const result = await this.api.abandonSession(accountSession.id, { reason }, { keepalive });
    this.recorder?.destroy?.();
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
    this.preparedSessionKey = null;
    this.liveConversationTurns.clear();
    this.liveAudioAuthorityEvents = [];
    this.conversationCaptureStartedAtMs = null;
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
    this.preparedSessionKey = null;
    this.liveConversationTurns.clear();
    this.liveAudioAuthorityEvents = [];
    this.conversationCaptureStartedAtMs = null;
  }
}
