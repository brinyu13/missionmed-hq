import { IvocApi } from '../ivoc-standalone/app/api.mjs';
import { AccountRecordingController } from '../ivoc-standalone/app/recording.mjs';
import { normalizeNameUseCoaching } from '../capabilities/context-results.mjs';
import { normalizePracticeFocus } from './live-context-adapter.mjs';
import {normalizeFollowUpRequest} from '../capabilities/interview-policy.mjs';
import {interviewerPreferenceRequest} from '../capabilities/interviewer-preferences.mjs';

const finiteMs = (value) => Number.isFinite(Number(value))
  ? Math.max(0, Math.round(Number(value)))
  : null;
const CONTEXT_SOURCES = new Set(['StoryForge', 'RISE', 'CV', 'File Vault', 'MCC', 'Top 3', 'Prior IVOC']);

function selectedContextSources(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => CONTEXT_SOURCES.has(item)))].slice(0, CONTEXT_SOURCES.size);
}

export function createDurableResultsEnvelope({
  sessionId,
  analytics,
  recording = null,
  liveConversation = null,
  audioAuthority = null,
  nameUseCoaching = null,
  candidateAudioCapture = null,
  capturedAt = new Date().toISOString(),
} = {}) {
  const sessionDurationMs = finiteMs(analytics?.durationMs);
  const recordingDurationMs = finiteMs(recording?.recordingDurationMs ?? recording?.recording?.durationMs);
  const playableDurationMs = finiteMs(recording?.playableDurationMs ?? recording?.durationMs)
    ?? recordingDurationMs
    ?? sessionDurationMs;
  const nameUse = normalizeNameUseCoaching(nameUseCoaching);
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
    ...(nameUse && sessionId ? {
      nameUseCoaching: { ...nameUse, sessionId },
    } : {}),
    ...(liveConversation?.turns?.length ? { liveConversation } : {}),
    ...(audioAuthority?.events?.length ? { audioAuthority } : {}),
    ...(candidateAudioCapture ? { candidateAudioCapture } : {}),
  });
}

export class DurableStudioSession {
  constructor({
    api = new IvocApi(),
    recordingFactory = (options) => new AccountRecordingController(options),
    now = () => new Date().toISOString(),
    nowMs = () => performance.now(),
    MediaStreamCtor = globalThis.MediaStream,
  } = {}) {
    this.api = api;
    this.recordingFactory = recordingFactory;
    this.now = now;
    this.nowMs = nowMs;
    this.MediaStreamCtor = MediaStreamCtor;
    this.candidateRecorder = null;
    this.candidateAudioCapture = null;
    this.candidateRetry = null;
    this.captureEpoch = 0;
    this.bootstrapPayload = null;
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
    this.pendingRecording = null;
    this.preparedSessionKey = null;
    this.preparedNameUseCoaching = null;
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
    const practiceFocus = wizard.goal === 'Guided Mock IV Practice' ? normalizePracticeFocus(wizard.focus) : undefined;
    const title = question?.canonical_text || 'IV Prep practice session';
    const verifiedProgram = wizard.programVerified === true
      && typeof wizard.programId === 'string' && wizard.programId
      && typeof wizard.programReleaseId === 'string' && wizard.programReleaseId;
    const contextSources = selectedContextSources(wizard.contextSources)
      .filter((source) => source !== 'RISE' || verifiedProgram);
    const exactRetry = typeof wizard.retrySourceSessionId === 'string' && /^[0-9a-f-]{36}$/u.test(wizard.retrySourceSessionId)
      && question?.question_id === wizard.retryQuestionId && question?.canonical_text === wizard.retryQuestionText
      && interviewSet.length === 1 && targetQuestions === 1
      && ['question', 'quick', 'mock'].includes(wizard.retrySessionType);
    return {
      title: title.split(/\s+/u).slice(0, 10).join(' '),
      sessionType: exactRetry ? wizard.retrySessionType : targetQuestions > 1 ? 'mock' : 'question',
      questionId: question?.question_id || null,
      questionText: question?.canonical_text || null,
      interviewerProvider,
      analyticsSchema: 'ivoc.analytics.v1',
      recordingEnabled: true,
      ...(wizard.embodimentCanary===true?{embodimentCanary:true}:{}),
      ...(exactRetry ? { retrySourceSessionId: wizard.retrySourceSessionId } : {}),
      context: {
        goal: wizard.goal || null,
        interviewer: wizard.interviewer || null,
        interviewerStyle: ['Dove', 'Peacock', 'Owl', 'Eagle'].includes(wizard.interviewerStyle)
          ? wizard.interviewerStyle : null,
        nameUseCoaching: normalizeNameUseCoaching({ schema: 'ivoc.name-use.v1',
          enabled: wizard.nameUseCoaching === true, name: wizard.interviewerName, source: 'manual' }),
        program: wizard.program || null,
        programId: verifiedProgram ? wizard.programId : null,
        programReleaseId: verifiedProgram ? wizard.programReleaseId : null,
        environment: wizard.environment || null,
        readiness: wizard.readiness || null,
        pressurePractice: wizard.goal !== 'Individual Question' && wizard.pressurePractice === true,
        ...(practiceFocus ? { practiceFocus } : {}),
        ...normalizeFollowUpRequest(wizard),
        ...interviewerPreferenceRequest(wizard),
        contextSources,
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
    this.preparedNameUseCoaching = input.context.nameUseCoaching;
    this.preparedSessionKey = key;
    return this.accountSession;
  }

  async start({ stream, candidateStream = null, question = null, interviewSet = [], wizard = {}, targetQuestions = 1, interviewerProvider = 'missionmed-static', assertCaptureReady = () => {} } = {}) {
    const title = question?.canonical_text || 'IV Prep practice session';
    await this.prepare({ question, interviewSet, wizard, targetQuestions, interviewerProvider });
    assertCaptureReady(); // after preparation, before allocating/starting capture
    if (this.recorder) throw new Error('durable_session_already_active');
    this.clearCandidateCapture();
    const captureOrigin = this.nowMs();
    const sessionNow = () => Math.max(0, this.nowMs() - captureOrigin);
    this.recorder = this.recordingFactory({
      api: this.api,
      stream,
      enabled: true,
      sessionId: this.accountSession.id,
      title,
      questionId: question?.question_id || null,
      sessionNow,
      now: this.nowMs,
      assertCaptureReady,
    });
    try {
      if (await this.recorder.start() !== true) throw new Error('recording_unavailable');
    } catch (error) {
      this.recorder.destroy?.();
      this.recorder = null;
      throw error;
    }
    this.liveConversationTurns.clear();
    this.liveConversationSequence = 0;
    // Preserve the existing provisional replay clock: arrival offsets begin at
    // the actual main recorder start, not at asynchronous upload allocation.
    this.conversationCaptureStartedAtMs = this.recorder.startedAt
      ?? (Number.isFinite(this.recorder.recordingStartSessionMs)
        ? captureOrigin + this.recorder.recordingStartSessionMs : this.nowMs());
    if (this.bootstrapPayload?.capabilities?.candidateAudioCapture === true) {
      this.candidateAudioCapture = { status: 'FAILED', reason: 'CANDIDATE_MIC_CAPTURE_UNAVAILABLE', analysisEligibility: 'UNVERIFIED' };
      try {
        const audio = candidateStream?.getAudioTracks?.().filter(track => track.readyState !== 'ended') || [];
        if (audio.length !== 1 || typeof this.MediaStreamCtor !== 'function') throw new Error('candidate_microphone_unavailable');
        const micOnly = new this.MediaStreamCtor(audio);
        const parentRecordingId = this.recorder.recording?.id;
        if (!parentRecordingId) throw new Error('candidate_audio_parent_unavailable');
        this.candidateRecorder = this.recordingFactory({ api: this.api, stream: micOnly,
          enabled: true, sessionId: this.accountSession.id, recordingRole: 'candidate_audio',
          parentRecordingId, sessionNow, now: this.nowMs, assertCaptureReady });
        if (await this.candidateRecorder.start() !== true) throw new Error('candidate_audio_unavailable');
        this.candidateAudioCapture = { status: 'RECORDING', parentRecordingId,
          captureReceipt: this.candidateRecorder.captureReceipt, analysisEligibility: 'UNVERIFIED' };
      } catch {
        this.candidateRecorder?.destroy?.();
        this.candidateRecorder = null;
      }
    }
    return this.accountSession;
  }

  clearCandidateCapture() {
    this.captureEpoch += 1;
    this.candidateRecorder?.destroy?.();
    this.candidateRecorder = null;
    this.candidateAudioCapture = null;
    this.candidateRetry = null;
  }

  async sealCandidateAudio() {
    if (!this.candidateRecorder) return this.candidateAudioCapture;
    const recorder = this.candidateRecorder;
    const epoch = this.captureEpoch;
    try {
      const sealed = await recorder.stopAndSeal();
      if (epoch !== this.captureEpoch) return null;
      if (!sealed?.recording?.id) throw new Error('candidate_audio_not_sealed');
      this.candidateAudioCapture = { status: 'SAVED', recording: sealed.recording,
        parentRecordingId: recorder.parentRecordingId,
        captureReceipt: sealed.captureReceipt || recorder.captureReceipt,
        captureTiming: { recordingStartSessionMs: sealed.recordingStartSessionMs,
          recordingDurationMs: sealed.recordingDurationMs, playableDurationMs: sealed.playableDurationMs,
          pausedSpans: sealed.pausedSpans || [] }, analysisEligibility: 'UNVERIFIED' };
    } catch {
      if (epoch !== this.captureEpoch) return null;
      this.candidateAudioCapture = { ...this.candidateAudioCapture, status: 'FAILED',
        reason: 'CANDIDATE_AUDIO_SAVE_FAILED', analysisEligibility: 'UNVERIFIED',
        retryAvailable: Boolean(recorder.finalBlob) };
    }
    return this.candidateAudioCapture;
  }

  async retryCandidateAudio() {
    if (this.candidateRetry?.pending) return this.candidateRetry.pending;
    const retry = this.candidateRetry;
    if (!retry || !this.candidateRecorder || this.bootstrapPayload?.capabilities?.candidateAudioCapture !== true) {
      return { retried: false, reason: 'candidate_audio_retry_unavailable' };
    }
    const epoch = this.captureEpoch;
    const recorder = this.candidateRecorder;
    retry.pending = (async () => {
      const candidateAudioCapture = await this.sealCandidateAudio();
      if (epoch !== this.captureEpoch) return { retried: false, reason: 'candidate_audio_capture_closed' };
      if (candidateAudioCapture?.status !== 'SAVED') return { retried: false, candidateAudioCapture };
      const envelope = { ...retry.envelope, candidateAudioCapture };
      const result = await this.api.saveResults(retry.sessionId, envelope);
      if (epoch !== this.captureEpoch || this.candidateRecorder !== recorder || this.candidateRetry !== retry) {
        return { retried: false, reason: 'candidate_audio_capture_closed' };
      }
      this.candidateRetry = null;
      recorder.destroy?.(); this.candidateRecorder = null;
      return { retried: true, candidateAudioCapture, envelope, result };
    })().finally(() => { retry.pending = null; });
    return retry.pending;
  }

  recordLiveTranscript(event = {}) {
    if (!this.recorder || !this.accountSession || this.conversationCaptureStartedAtMs == null
      || (Object.hasOwn(event, 'sessionId') && event.sessionId !== this.accountSession.id)) return false;
    const speaker = event.speaker === 'applicant' ? 'student' : event.speaker;
    if (!['student', 'interviewer'].includes(speaker)) return false;
    const rawText = String(event.text || '').slice(0, 8_000);
    const text = event.final ? rawText.trim() : rawText;
    if (event.identity != null && (typeof event.identity !== 'string' || !event.identity.length
      || event.identity.length > 240 || event.identity.trim() !== event.identity)) return false;
    const id = event.identity || `${speaker}:${++this.liveConversationSequence}`;
    for (const key of ['itemId', 'responseId']) {
      if (event[key] != null && (typeof event[key] !== 'string' || !event[key].length
        || event[key].length > 240 || event[key].trim() !== event[key])) return false;
    }
    const observedAtMs = Math.max(0, Math.round(this.nowMs() - this.conversationCaptureStartedAtMs));
    const previous = this.liveConversationTurns.get(id);
    if (previous && (previous.speaker !== speaker || ['itemId', 'responseId'].some(key =>
      previous[key] && event[key] && previous[key] !== event[key]))) return false;
    const current = this.liveConversationTurns.get(id) || {
      id,
      speaker,
      startMs: observedAtMs,
      endMs: observedAtMs,
      text: '',
      final: false,
      providerEventType: null,
      timingBasis: 'MESSAGE_RECEIPT',
      provenance: 'BROWSER_DECLARED',
      finalization: null,
    };
    current.endMs = observedAtMs;
    current.providerEventType = String(event.type || '').slice(0, 200) || current.providerEventType;
    current.text = event.final ? (text || current.text) : `${current.text}${text}`.slice(0, 8_000);
    current.final = current.final || event.final === true;
    if (event.final === true) current.finalization = 'PROVIDER_FINAL_MESSAGE';
    for (const key of ['itemId', 'responseId']) {
      if (typeof event[key] === 'string' && event[key].length <= 240 && event[key].trim()) current[key] = event[key];
    }
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
      sessionId: this.accountSession?.id || null,
      timingBasis: 'MESSAGE_RECEIPT',
      provenance: 'BROWSER_DECLARED',
      turns: Object.freeze(turns),
    });
  }

  finalizeLiveConversation() {
    for (const turn of this.liveConversationTurns.values()) {
      if (turn.final || !String(turn.text || '').trim()) continue;
      turn.text = String(turn.text).trim();
      turn.final = true;
      turn.finalization = 'CLIENT_FINISH';
      turn.providerEventType = `${String(turn.providerEventType || 'provider_transcript').slice(0, 180)}:client-finish`;
    }
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
    // A sealed recorder returns null on a second stop. Retain its exact receipt
    // until Results persistence succeeds so retry cannot lose media/timebase.
    const recordingPromise = this.pendingRecording
      ? Promise.resolve(this.pendingRecording)
      : Promise.resolve(recorder?.stopAndSeal?.() || null).then((value) => {
        if (!value?.recording?.id) throw new Error('recording_not_sealed');
        this.pendingRecording = value;
        return value;
      });
    const [analytics, recording, candidateAudioCapture] = await Promise.all([resolvedAnalytics, recordingPromise, this.sealCandidateAudio()]);
    // The user-controlled Finish action is the terminal boundary for any
    // provider transcript deltas still in flight. Preserve that text only as
    // provisional live-conversation evidence; server transcription remains
    // the sole authority that can assign a canonical transcript reference.
    this.finalizeLiveConversation();
    const liveConversation = this.liveConversationSnapshot();
    const envelope = createDurableResultsEnvelope({
      sessionId: accountSession.id,
      analytics,
      recording,
      liveConversation,
      audioAuthority: this.liveAudioAuthoritySnapshot(),
      nameUseCoaching: this.preparedNameUseCoaching,
      candidateAudioCapture,
      capturedAt: this.now(),
    });
    const result = await this.api.saveResults(accountSession.id, envelope);
    if (this.candidateRecorder && candidateAudioCapture?.retryAvailable) {
      this.candidateRetry = { sessionId: accountSession.id, envelope, pending: null };
    } else {
      this.candidateRecorder?.destroy?.(); this.candidateRecorder = null;
    }
    this.pendingRecording = null;
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
    this.preparedSessionKey = null;
    this.preparedNameUseCoaching = null;
    this.liveConversationTurns.clear();
    this.liveAudioAuthorityEvents = [];
    this.conversationCaptureStartedAtMs = null;
    return { persisted: true, analytics, recording, result, envelope, session: accountSession };
  }

  async library(scope = 'own') { return this.api.library(scope); }
  async programs(input = {}) {
    if (!this.ready) throw new Error('durable_session_not_ready');
    return this.api.searchPrograms(input);
  }
  async mentorPriorities() { return this.api.mentorPriorities(); }
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
  requireAdmin() {
    if (!this.ready || this.bootstrapPayload?.identity?.admin !== true) throw new Error('ivoc_admin_required');
  }
  async saveAdminConfig(input) { this.requireAdmin(); return this.api.saveAdminConfig(input); }
  async adminCredits(subjectId) { this.requireAdmin(); return this.api.adminCredits(subjectId); }
  async saveAdminCredits(input) { this.requireAdmin(); return this.api.saveAdminCredits(input); }
  async adminMentorPriorities(subjectId) { this.requireAdmin(); return this.api.adminMentorPriorities(subjectId); }
  async saveAdminMentorPriorities(input) { this.requireAdmin(); return this.api.saveAdminMentorPriorities(input); }
  async abandon({ reason = 'client_exit', keepalive = false } = {}) {
    const accountSession = this.accountSession;
    if (!accountSession?.id) { this.clearCandidateCapture(); return { abandoned: false, reason: 'no_active_session' }; }
    const result = await this.api.abandonSession(accountSession.id, { reason }, { keepalive });
    this.clearCandidateCapture();
    this.pendingRecording = null;
    this.recorder?.destroy?.();
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
    this.preparedSessionKey = null;
    this.preparedNameUseCoaching = null;
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
    this.clearCandidateCapture();
    this.pendingRecording = null;
    this.recorder?.destroy?.();
    this.accountSession = null;
    this.recorder = null;
    this.pendingAnalytics = null;
    this.preparedSessionKey = null;
    this.preparedNameUseCoaching = null;
    this.liveConversationTurns.clear();
    this.liveAudioAuthorityEvents = [];
    this.conversationCaptureStartedAtMs = null;
  }
}
