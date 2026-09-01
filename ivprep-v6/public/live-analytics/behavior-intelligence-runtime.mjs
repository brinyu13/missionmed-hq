import { ConversationStateMachine } from '../analytics/conversation-state.mjs';
import { CalibrationSession } from '../analytics/calibration-session.mjs';
import { derivePersonalCorridors } from '../analytics/coaching-config.mjs';
import { FacialActivityTracker } from '../analytics/facial-activity.mjs';
import { GestureUnitDetector } from '../analytics/gesture-units.mjs';
import { NodDetector } from '../analytics/nod-detector.mjs';
import { OrientationTracker } from '../analytics/orientation-state.mjs';
import { TurnMetrics } from '../analytics/turn-metrics.mjs';
import { evaluateWordTiming } from '../analytics/word-timing-ladder.mjs';
import { CueArbiter } from './cue-arbiter.mjs';
import { PostAnswerStore } from './post-answer-store.mjs';
import { SetupReadinessGate } from './setup-readiness.mjs';

function dbfs(rms) {
  return Number.isFinite(rms) && rms > 0 ? 20 * Math.log10(rms) : -96;
}

function quantile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

/**
 * State-aware P0 behavior runtime beneath the locked HUD. It accepts derived local
 * diagnostics only and never owns media, provider sessions, or transcript content.
 */
export class BehaviorIntelligenceRuntime {
  constructor({ now = () => performance.now(), degradedConversation = false, postAnswers = new PostAnswerStore(), calibration = new CalibrationSession() } = {}) {
    this.now = now;
    this.conversation = new ConversationStateMachine({ now, degraded: degradedConversation });
    this.setup = new SetupReadinessGate();
    this.gestures = new GestureUnitDetector();
    // The production vision scheduler is deliberately capped at 8 FPS. Keep
    // the detector fail-closed below that observed cadence, but do not make a
    // validated production signal impossible by requiring 15 FPS here.
    this.nods = new NodDetector({ minimumFps: 8 });
    this.orientationTracker = new OrientationTracker();
    this.facialActivityTracker = new FacialActivityTracker();
    this.turnMetrics = new TurnMetrics();
    this.cues = new CueArbiter();
    this.postAnswers = postAnswers;
    this.calibration = calibration;
    this.baseline = null;
    this.coachingTargets = null;
    this.coachingTargetAudit = null;
    this.reset(0);
  }

  reset(atMs = 0) {
    this.conversation.reset(atMs);
    this.setup.reset();
    this.gestures.reset();
    this.nods.reset();
    this.orientationTracker.reset();
    this.facialActivityTracker.reset();
    this.turnMetrics.reset();
    this.cues.reset();
    this.calibration.reset(atMs);
    this.startedAtMs = atMs;
    this.lastAudioAtMs = null;
    this.speechMs = 0;
    this.audioLevels = [];
    this.speechLevels = [];
    this.priorSpeaking = false;
    this.interviewRequested = false;
    this.interviewerChannel = Object.freeze({
      available: false,
      reason: 'NO_INTERVIEWER_CHANNEL',
      source: null,
      questionId: null,
    });
    this.orientation = Object.freeze({ orientation: 'UNKNOWN', state: 'SETUP', confidence: 'UNAVAILABLE' });
    this.gesture = Object.freeze({ rateAvailable: false, rateUnavailableReason: 'INSUFFICIENT_HANDS_COVERAGE' });
    this.facialActivity = Object.freeze({ available: false, reason: 'NEED_MORE_FACE_GEOMETRY', state: 'SETUP' });
    this.nod = Object.freeze({ available: false, reason: 'INSUFFICIENT_VISION_FRAME_RATE', count: 0 });
    this.notes = Object.freeze({ available: true, active: false, eventCount: 0, provenance: { source: 'EXPLICIT_STUDENT_CONTROL', method: 'TIER_0_NOTES_STATE' } });
    this.coachingMode = 'TRAINING';
    this.latestCue = null;
    this.audio = Object.freeze({ available: false, reason: 'NO_AUDIO_FRAMES' });
    this.wordTiming = Object.freeze({ tier: 'E', wordsPerMinute: null, available: false, reason: 'NO_OBSERVED_WORD_TIMESTAMPS' });
    this.latest = this.snapshot(atMs);
    return this.latest;
  }

  ingestDiagnostic(detail = {}) {
    if (detail.modality === 'audio') return this.#audio(detail);
    if (detail.modality === 'vision') return this.#vision(detail);
    return this.latest;
  }

  setCoachingMode(mode = 'TRAINING') {
    const normalized = String(mode).toUpperCase();
    if (!['SIMULATION', 'TRAINING', 'DRILL'].includes(normalized)) throw new TypeError('Unknown coaching mode.');
    this.coachingMode = normalized;
    if (normalized === 'SIMULATION') this.latestCue = null;
    this.latest = this.snapshot(this.latest?.atMs ?? 0);
    return this.latest;
  }

  setCoachingTargets({ wordsPerMinute = null, loudnessHalfWidthLu = null } = {}, { editorRole = 'ADMIN', atMs = this.latest?.atMs ?? 0 } = {}) {
    const wpmMinimum = Number(wordsPerMinute?.minimum);
    const wpmMaximum = Number(wordsPerMinute?.maximum);
    const hasWpm = Number.isFinite(wpmMinimum) || Number.isFinite(wpmMaximum);
    if (hasWpm && (!Number.isFinite(wpmMinimum) || !Number.isFinite(wpmMaximum))) {
      throw new TypeError('Delivery-speed targets require both minimum and maximum.');
    }
    if (hasWpm && (wpmMinimum < 110 || wpmMaximum > 210 || wpmMinimum >= wpmMaximum)) {
      throw new RangeError('Delivery-speed targets must remain ordered inside 110–210 WPM.');
    }
    const halfWidth = loudnessHalfWidthLu === null ? null : Number(loudnessHalfWidthLu);
    if (halfWidth !== null && (!Number.isFinite(halfWidth) || halfWidth < 3 || halfWidth > 10)) {
      throw new RangeError('Loudness corridor half-width must remain inside 3–10 LU.');
    }
    this.coachingTargets = deepFreeze({
      wordsPerMinute: hasWpm ? { minimum: wpmMinimum, maximum: wpmMaximum, basis: 'ADMIN_SESSION_TARGET' } : null,
      loudnessHalfWidthLu: halfWidth,
    });
    this.coachingTargetAudit = deepFreeze({
      changedAtMs: Number(atMs),
      editorRole: String(editorRole).toUpperCase() === 'FOUNDER' ? 'FOUNDER' : 'ADMIN',
      fields: Object.freeze([
        ...(hasWpm ? ['wordsPerMinute'] : []),
        ...(halfWidth !== null ? ['loudnessHalfWidthLu'] : []),
      ]),
      measurementChanged: false,
    });
    this.latest = this.snapshot(Number(atMs));
    return this.latest;
  }

  beginInterview(atMs = this.latest?.atMs ?? 0, { explicitMeasurementStart = false } = {}) {
    const time = Number(atMs);
    this.interviewRequested = true;
    // START ANALYTICS is an explicit Tier-0 user action. It establishes the
    // measurement boundary immediately; the readiness gate remains coaching
    // feedback and must not masquerade as a hidden state-machine prerequisite.
    if (explicitMeasurementStart && this.conversation.state === 'SETUP') {
      this.#dispatchConversation('SETUP_READY', time);
    }
    this.#advanceConversation({ atMs: time, speaking: this.priorSpeaking });
    this.latest = this.snapshot(time);
    return this.latest;
  }

  interviewerTurnStarted({ atMs = this.latest?.atMs ?? 0, questionId = null, source = 'MENTOR_MANUAL' } = {}) {
    const normalizedSource = String(source).toUpperCase();
    if (!['TTS', 'AVATAR', 'REMOTE_VAD', 'MENTOR_MANUAL', 'QUESTION_ENGINE'].includes(normalizedSource)) {
      throw new TypeError('Unknown interviewer event source.');
    }
    const time = Number(atMs);
    this.interviewerChannel = deepFreeze({
      available: true,
      reason: null,
      source: normalizedSource,
      questionId: questionId === null ? null : String(questionId).slice(0, 120),
    });
    this.#dispatchConversation('INTERVIEWER_SPEECH_START', time);
    this.latestCue = null;
    this.latest = this.snapshot(time);
    return this.latest;
  }

  interviewerTurnEnded({ atMs = this.latest?.atMs ?? 0, questionId = null } = {}) {
    const time = Number(atMs);
    if (!this.interviewerChannel.available) {
      this.interviewerChannel = deepFreeze({
        available: true,
        reason: null,
        source: 'QUESTION_ENGINE',
        questionId: questionId === null ? null : String(questionId).slice(0, 120),
      });
    }
    this.#dispatchConversation('INTERVIEWER_SPEECH_END', time);
    this.latest = this.snapshot(time);
    return this.latest;
  }

  setNotesActive(active, atMs = this.latest?.atMs ?? 0) {
    const next = Boolean(active);
    if (next === this.notes.active) return this.latest;
    this.#dispatchConversation(next ? 'NOTES_START' : 'NOTES_END', Number(atMs));
    this.notes = deepFreeze({
      available: true,
      active: next,
      eventCount: this.notes.eventCount + (next ? 1 : 0),
      provenance: { source: 'EXPLICIT_STUDENT_CONTROL', method: 'TIER_0_NOTES_STATE' },
      claimBoundary: 'EXPLICIT_CONTROL_NOT_INFERRED_BEHAVIOR',
    });
    this.latestCue = null;
    this.latest = this.snapshot(Number(atMs));
    return this.latest;
  }

  #dispatchConversation(event, atMs) {
    // Audio and vision are independent real-time producers. A vision frame may
    // finish after a newer audio frame has already advanced the conversation
    // state, so its observed timestamp can legitimately arrive slightly behind
    // the current state boundary. Preserve the observation while projecting it
    // onto the latest truthful conversation instant; never let cross-modality
    // scheduling regress the state machine clock or flood the live cockpit.
    const observedAtMs = Math.round(Number(atMs));
    const effectiveAtMs = Number.isFinite(observedAtMs)
      ? Math.max(observedAtMs, this.conversation.enteredAtMs)
      : this.conversation.enteredAtMs;
    const result = this.conversation.dispatch(event, effectiveAtMs);
    this.turnMetrics.ingest(event, effectiveAtMs, { state: result.state });
    return result;
  }

  #audio(detail) {
    const atMs = Number(detail.atMs);
    if (!Number.isFinite(atMs)) return this.latest;
    const level = dbfs(Number(detail.rms));
    const deltaMs = this.lastAudioAtMs === null ? 0 : Math.max(0, Math.min(250, atMs - this.lastAudioAtMs));
    this.lastAudioAtMs = atMs;
    // No single producer may erase independent real speech evidence. Silero,
    // the envelope detector, and validated voiced F0 are complementary local
    // observations; the union drives the conversational boundary.
    const speaking = detail.vad?.speaking === true
      || detail.speaking === true
      || detail.pitch?.voiced === true;
    if (speaking) {
      this.speechMs += deltaMs;
      this.speechLevels.push(level);
      if (this.speechLevels.length > 600) this.speechLevels.shift();
    }
    this.audioLevels.push(level);
    if (this.audioLevels.length > 600) this.audioLevels.shift();
    const noiseFloorDb = quantile(this.audioLevels.filter(Number.isFinite), 0.1) ?? -96;
    const speechLevelDb = quantile(this.speechLevels.filter(Number.isFinite), 0.5);
    const speechMean = this.speechLevels.length ? this.speechLevels.reduce((sum, value) => sum + value, 0) / this.speechLevels.length : null;
    const speechLevelStdLu = speechMean === null ? null : Math.sqrt(this.speechLevels.reduce((sum, value) => sum + (value - speechMean) ** 2, 0) / this.speechLevels.length);
    const processing = detail.deviceProcessing || 'UNKNOWN';
    this.setup.ingestAudio({
      available: detail.available !== false,
      speechMs: this.speechMs,
      noiseFloorDb,
      speechLevelDb,
      speechLevelStdLu,
      clippedFraction: Number(detail.clippedFraction) || 0,
      processing,
    });
    this.#advanceConversation({ atMs, speaking });
    this.audio = deepFreeze({
      available: detail.available !== false,
      captureMethod: detail.captureMethod || 'ANALYSER_FALLBACK',
      speaking,
      vad: detail.vad || { available: false, reason: 'SILERO_V5_UNAVAILABLE' },
      loudness: detail.loudness || { available: false, reason: 'LUFS_K_UNAVAILABLE' },
      estimatedSyllableRate: detail.estimatedSyllableRate || { available: false, tier: 'D', reason: 'NEED_MORE_SPEECH_ENVELOPE' },
      speechMs: this.speechMs,
      state: this.conversation.state,
    });
    this.calibration.ingestAudio({ atMs, speaking, loudness: this.audio.loudness, pitch: detail.pitch?.summary || {} });
    this.#arbitrate(atMs);
    this.latest = this.snapshot(atMs);
    return this.latest;
  }

  #advanceConversation({ atMs, speaking }) {
    let setupAdvanced = false;
    if (this.conversation.state === 'SETUP' && this.setup.snapshot().ready && this.interviewRequested) {
      this.#dispatchConversation('SETUP_READY', atMs);
      setupAdvanced = true;
    }
    if (speaking && (!this.priorSpeaking || setupAdvanced)) {
      this.#dispatchConversation(['PAUSE_SHORT', 'PAUSE_LONG'].includes(this.conversation.state) ? 'USER_SPEECH_RESUME' : 'USER_SPEECH_START', atMs);
    } else if (!speaking && this.priorSpeaking) {
      this.#dispatchConversation('USER_SPEECH_END', atMs);
    } else if (!speaking) {
      this.#dispatchConversation('TICK', atMs);
    }
    this.priorSpeaking = speaking;
  }

  #vision(detail) {
    const atMs = Number(detail.atMs);
    if (!Number.isFinite(atMs)) return this.latest;
    const face = detail.geometry?.face || {};
    const box = face.box || {};
    const matrixPose = face.headPoseMethod === 'FACIAL_TRANSFORMATION_MATRIX';
    const faceFamily = detail.faceFamily || {};
    const gazeProxy = faceFamily['FACE.GAZE'];
    const gazeAvailable = gazeProxy?.availability !== 'UNAVAILABLE'
      && Number.isFinite(Number(gazeProxy?.horizontal))
      && Number.isFinite(Number(gazeProxy?.vertical));
    const headYaw = matrixPose ? face.yawDeg : face.yawProxyDeg;
    const headPitch = matrixPose ? face.pitchDeg : face.pitchProxyDeg;
    const fusedYaw = gazeAvailable ? Number(headYaw) * 0.75 + Number(gazeProxy.horizontal) * 30 * 0.25 : headYaw;
    const fusedPitch = gazeAvailable ? Number(headPitch) * 0.75 + Number(gazeProxy.vertical) * 30 * 0.25 : headPitch;
    this.setup.ingestVideo({
      facePresent: face.present === true && detail.primaryLock?.state === 'PRIMARY_LOCKED',
      faceFraction: Number(box.height),
      centerX: box.centerX,
      centerY: box.centerY,
      headPitchDegrees: matrixPose ? face.pitchDeg : face.pitchProxyDeg,
      confidence: detail.primaryLock?.state === 'PRIMARY_LOCKED' ? 0.9 : 0,
    });
    this.orientation = this.orientationTracker.ingest({
      atMs,
      yawDegrees: fusedYaw,
      pitchDegrees: fusedPitch,
      confidence: matrixPose ? 0.9 : 0.55,
      facePresent: face.present === true && detail.primaryLock?.state === 'PRIMARY_LOCKED',
      state: this.conversation.state,
      provenance: gazeAvailable ? 'FUSED_HEAD_POSE_EYELOOK_PROXY' : matrixPose ? 'FACIAL_TRANSFORMATION_MATRIX' : 'LINEAR_HEAD_POSE_PROXY',
    });
    this.nod = this.nods.ingest({
      atMs,
      pitchDegrees: matrixPose ? face.pitchDeg : face.pitchProxyDeg,
      confidence: matrixPose ? 0.9 : 0.55,
      targetFps: detail.targetFps,
      state: this.conversation.state,
    });
    this.facialActivity = this.facialActivityTracker.ingest({
      atMs,
      state: this.conversation.state,
      confidence: matrixPose ? 0.9 : 0.55,
      channels: {
        brow: faceFamily['FACE.BROW']?.magnitude,
        mouth: faceFamily['FACE.SMILE']?.bilateral,
        periocular: faceFamily['FACE.PERIOCULAR']?.bilateral,
        yaw: matrixPose ? face.yawDeg : face.yawProxyDeg,
        pitch: matrixPose ? face.pitchDeg : face.pitchProxyDeg,
      },
    });
    const pose = detail.geometry?.pose || {};
    const shoulderWidth = Number(pose.shoulderWidth);
    const centerX = Number(pose.centerX);
    const shoulders = Number.isFinite(shoulderWidth) && Number.isFinite(centerX)
      ? {
        leftShoulder: { x: centerX - shoulderWidth / 2, y: Number(pose.centerY) },
        rightShoulder: { x: centerX + shoulderWidth / 2, y: Number(pose.centerY) },
      }
      : {};
    const left = detail.geometry?.hands?.left;
    const right = detail.geometry?.hands?.right;
    this.gesture = this.gestures.ingest({
      atMs,
      leftHand: left?.present ? { x: left.centerX, y: left.centerY } : null,
      rightHand: right?.present ? { x: right.centerX, y: right.centerY } : null,
      faceBox: box,
      speaking: this.conversation.state === 'ANSWERING',
      ...shoulders,
    });
    this.calibration.ingestVision({ atMs, faceFamily, faceFraction: box.height });
    this.#advanceConversation({ atMs, speaking: this.priorSpeaking });
    this.#arbitrate(atMs);
    this.latest = this.snapshot(atMs);
    return this.latest;
  }

  ingestWordTiming(evidence = {}, { allowDeterministicFixture = false } = {}) {
    const atMs = Number(evidence.atMs ?? evidence.windowEndedAtMs);
    this.wordTiming = evaluateWordTiming(evidence, { allowDeterministicFixture });
    this.calibration.ingestWordTiming(this.wordTiming);
    this.#arbitrate(Number.isFinite(atMs) ? atMs : this.latest.atMs);
    this.latest = this.snapshot(Number.isFinite(atMs) ? atMs : this.latest.atMs);
    return this.latest;
  }

  #arbitrate(atMs) {
    const loudness = this.audio?.loudness;
    const loudnessCorridor = this.#corridors().loudnessLufsK;
    const candidates = [
      {
        id: 'orientation-away',
        active: this.orientation.orientation === 'AWAY' && this.conversation.state === 'ANSWERING',
        priority: 3,
        message: 'RE-CENTRE',
        minimumDwellMs: 5_000,
        confidence: this.orientation.confidence,
      },
      {
        id: 'loudness-low',
        active: loudness?.available === true
          && loudnessCorridor
          && Number(loudness.speechLufsK) < loudnessCorridor.minimum
          && this.conversation.state === 'ANSWERING',
        priority: 2.5,
        message: 'LOUDER',
        minimumDwellMs: 10_000,
        confidence: loudness?.available === true ? 'MODERATE' : 'UNAVAILABLE',
      },
      {
        id: 'orientation-down',
        active: this.orientation.orientation === 'DOWN' && this.conversation.state === 'ANSWERING',
        priority: 2,
        message: 'LOOK UP',
        minimumDwellMs: 5_000,
        confidence: this.orientation.confidence,
      },
      {
        id: 'speaking-speed',
        active: this.wordTiming.available === true
          && this.wordTiming.deliverySpeed?.zone === 'TOO_FAST'
          && this.conversation.state === 'ANSWERING',
        priority: 2,
        message: 'SLOWER',
        minimumDwellMs: 10_000,
        confidence: this.wordTiming.available ? 'MODERATE' : 'UNAVAILABLE',
        coverage: this.wordTiming.coverage,
      },
    ];
    const selected = this.cues.select(candidates, {
      atMs,
      state: this.conversation.state,
      density: this.coachingMode,
      answerStartedAtMs: this.conversation.state === 'ANSWERING' ? this.conversation.enteredAtMs : null,
    });
    this.latestCue = selected || (Number(this.latestCue?.expiresAtMs) > atMs ? this.latestCue : null);
  }

  snapshot(atMs = this.now()) {
    const calibration = this.calibration.snapshot(atMs);
    const baseline = this.baseline || calibration.derived;
    return deepFreeze({
      atMs: Number.isFinite(atMs) ? atMs : 0,
      conversation: this.conversation.snapshot(atMs),
      setup: this.setup.snapshot(),
      orientation: this.orientation,
      gesture: this.gesture,
      facialActivity: this.facialActivity,
      nod: this.nod,
      notes: this.notes,
      audio: this.audio,
      wordTiming: this.wordTiming,
      turnMetrics: this.turnMetrics.snapshot(atMs),
      interviewerChannel: this.interviewerChannel,
      coachingMode: this.coachingMode,
      cue: this.latestCue,
      calibration,
      baseline,
      corridors: this.#corridors(baseline),
      coachingTargetAudit: this.coachingTargetAudit,
      providerSessions: 0,
      claimBoundary: 'OBSERVABLE_BEHAVIOR_AND_DELIVERY_ONLY',
    });
  }

  finish({ answerId, endedAtMs, metrics = {}, analyticsResult = null } = {}) {
    const end = Number(endedAtMs);
    if (this.conversation.state !== 'SETUP') this.#dispatchConversation('ANSWER_END', end);
    this.calibration.ingestTurnMetrics({ ...this.turnMetrics.snapshot(end), atMs: end });
    const retained = this.postAnswers.retain({
      answerId,
      startedAtMs: this.startedAtMs,
      endedAtMs: end,
      metrics,
      analyticsResult,
      behavior: this.snapshot(end),
    });
    this.latest = this.snapshot(end);
    return retained;
  }

  exportJson(space = 2) { return this.postAnswers.exportJson(space); }

  setBaseline(derived = null) {
    this.baseline = derived && typeof derived === 'object' ? deepFreeze({ ...derived }) : null;
    this.latest = this.snapshot(this.latest?.atMs ?? 0);
    return this.latest;
  }

  #corridors(baseline = this.baseline || this.calibration.derived) {
    const derived = derivePersonalCorridors(baseline || {});
    const personalLoudness = Number(baseline?.speechLufsK);
    const loudnessHalfWidth = this.coachingTargets?.loudnessHalfWidthLu;
    return deepFreeze({
      ...derived,
      wordsPerMinute: this.coachingTargets?.wordsPerMinute || derived.wordsPerMinute,
      loudnessLufsK: Number.isFinite(personalLoudness) && Number.isFinite(loudnessHalfWidth)
        ? {
            minimum: personalLoudness - loudnessHalfWidth,
            maximum: personalLoudness + loudnessHalfWidth,
            basis: 'ADMIN_SESSION_TARGET',
          }
        : derived.loudnessLufsK,
    });
  }

  calibrationDerived() { return this.calibration.derived(); }
}
