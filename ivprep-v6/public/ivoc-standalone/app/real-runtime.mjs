import { BehaviorIntelligenceRuntime } from '/iv-prep-on-call/live-analytics/behavior-intelligence-runtime.mjs';
import { LiveMetricProjector } from '/iv-prep-on-call/live-analytics/live-metric-projector.mjs';
import { LocalTranscriptTimingProducer } from '/iv-prep-on-call/live-analytics/local-transcript-timing.mjs';
import { createLiveAnalyticsMediaBridge } from '/iv-prep-on-call/live-analytics/media-bridge.mjs';
import { COACHING_CONFIG, mapToLiveScale } from '/iv-prep-on-call/analytics/coaching-config.mjs';
import { CALIBRATION } from './data.mjs';

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const finite = (value, fallback = null) => Number.isFinite(value) ? Number(value) : fallback;
const direction = (value, [lo, hi]) => value == null ? null : value < lo ? 1 : value > hi ? -1 : 0;
const FACE_BASELINE_MINIMUM_MS = 3_000;
const FACE_BASELINE_MINIMUM_FRAMES = 16;
const FACE_BASELINE_MAXIMUM_MS = 12_000;
const FACE_BASELINE_MAXIMUM_GAP_MS = 2_000;
const OVERLAY_STALE_AFTER_MS = 1_500;

function corridorScore(value, [lo, hi]) {
  if (!Number.isFinite(value)) return null;
  const mid = (lo + hi) / 2;
  const half = Math.max(.001, (hi - lo) / 2);
  if (value >= lo && value <= hi) return 7.5 + .5 * (1 - Math.abs(value - mid) / half);
  const outside = value < lo ? (lo - value) : (value - hi);
  return clamp(7.5 - outside / half * 3.2, 0, 7.49);
}

function stateName(value) {
  const name = String(value || 'SETUP').toUpperCase();
  if (name === 'SETUP') return 'SETUP';
  if (name.includes('ANSWER')) return 'ANSWERING';
  if (name.includes('PAUSE_LONG')) return 'PAUSE';
  if (name.includes('THINK') || name.includes('PAUSE_SHORT') || name.includes('TRANSITION_TO_ANSWER')) return 'THINKING';
  if (name.includes('TRANSITION')) return 'TRANSITION';
  return 'LISTENING';
}

function vocalVarietyProjection(pitch, modulation) {
  const pitchVariation = Number(pitch?.voicedFrames) >= COACHING_CONFIG.varietyScale.minimumVoicedFrames
    ? finite(pitch?.variationSemitones)
    : null;
  const loudnessVariation = finite(modulation?.speechModulationRangeLu, finite(modulation?.rangeDb));
  const pitchScore = pitchVariation === null ? null : mapToLiveScale(
    pitchVariation,
    COACHING_CONFIG.varietyScale.defaultMinimumSemitones,
    COACHING_CONFIG.varietyScale.defaultMaximumSemitones,
    COACHING_CONFIG.varietyScale.defaultMaximumSemitones + COACHING_CONFIG.varietyScale.highCapAdditionalSemitones,
  );
  const loudnessScore = loudnessVariation === null ? null : mapToLiveScale(
    loudnessVariation,
    COACHING_CONFIG.varietyScale.loudnessMinimumRangeDb,
    COACHING_CONFIG.varietyScale.loudnessMaximumRangeDb,
    COACHING_CONFIG.varietyScale.loudnessMaximumRangeDb + COACHING_CONFIG.varietyScale.loudnessHighCapAdditionalDb,
  );
  const score = pitchScore === null
    ? null
    : loudnessScore === null
      ? pitchScore
      : Number((pitchScore * COACHING_CONFIG.varietyScale.pitchWeight
        + loudnessScore * COACHING_CONFIG.varietyScale.loudnessWeight).toFixed(1));
  return { pitchVariation, loudnessVariation, pitchScore, loudnessScore, score };
}

export class RealAnalyticsEngine extends EventTarget {
  constructor({ video, overlayCanvas, csrfToken = '' } = {}) {
    super();
    this.video = video;
    this.overlayCanvas = overlayCanvas;
    this.csrfToken = csrfToken;
    this.bridge = createLiveAnalyticsMediaBridge();
    this.projector = new LiveMetricProjector();
    this.behavior = new BehaviorIntelligenceRuntime();
    this.transcript = new LocalTranscriptTimingProducer();
    this.pipeline = null;
    this.clock = null;
    this.t = 0;
    this.history = [];
    this.events = [];
    this.latest = null;
    this.running = false;
    this.lastHistoryAt = -Infinity;
    this.lastCounts = { smiles: 0, nods: 0, gestures: 0 };
    this.lastRecordedState = null;
    this.wordTimingState = { state: 'idle', reason: 'WAITING_FOR_TIMED_WORDS' };
    this.latestAudioSpeaking = false;
    this.overlayFreshnessTimer = null;
    this.faceBaselineState = {
      capturing: false,
      available: false,
      reason: 'WAITING_FOR_ADMITTED_FACE',
      admittedFrames: 0,
      rejectedFrames: 0,
      startedAtMs: null,
      lastAdmittedAtMs: null,
      attempts: 0,
    };
    this.overlayVisibility = { face: true, hands: true, body: true, position: true };
    this.onDiagnostic = (event) => this.consumeDiagnostic(event.detail || {});
    this.onPipelineState = (event) => this.dispatchEvent(new CustomEvent('pipeline-state', { detail: event.detail || {} }));
  }

  async start({ cameraDeviceId = '', microphoneDeviceId = '' } = {}) {
    this.bridge.primeAudioContext();
    const media = await this.bridge.requestMedia({
      audio: {
        channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        ...(microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : {}),
      },
      video: {
        width: { ideal: 1280 }, height: { ideal: 720 },
        ...(cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : { facingMode: 'user' }),
      },
    });
    this.video.srcObject = media.stream;
    await this.video.play();
    this.pipeline = this.bridge.ensureAnalytics();
    this.pipeline.addEventListener('diagnostic', this.onDiagnostic);
    this.pipeline.addEventListener('state', this.onPipelineState);
    this.setOverlayVisibility(this.overlayVisibility);
    this.pipeline.setOverlayConsumer((frame) => this.drawOverlay(frame));
    this.projector.reset();
    this.behavior.reset(0);
    // Entering the cockpit begins the real measurement/interview state machine.
    // Without this explicit boundary the behavior runtime remains in SETUP and
    // every genuine microphone observation is mislabeled as LISTENING.
    this.behavior.beginInterview(0, { explicitMeasurementStart: true });
    this.latestAudioSpeaking = false;
    this.bridge.startAnalytics({ videoElement: this.video });
    this.clock = this.bridge.sessionClock;
    this.running = true;
    this.lastRecordedState = null;
    this.faceBaselineState = {
      capturing: false,
      available: false,
      reason: 'WAITING_FOR_ADMITTED_FACE',
      admittedFrames: 0,
      rejectedFrames: 0,
      startedAtMs: null,
      lastAdmittedAtMs: null,
      attempts: 0,
    };
    void this.startTranscriptTiming(media.stream);
    this.latest = this.mapFrame(this.projector.latest);
    return media.stream;
  }

  startTranscriptTiming(stream) {
    return this.transcript.start({
      stream,
      pipeline: this.pipeline,
      clock: this.clock,
      csrfToken: this.csrfToken,
      onTiming: (evidence) => this.consumeWordTiming(evidence),
      onState: (state) => {
        this.wordTimingState = state;
        this.dispatchEvent(new CustomEvent('word-timing-state', { detail: state }));
      },
    });
  }

  currentDevices() {
    const media = this.bridge.media || {};
    const cameraTrack = media.cameraTrack || media.stream?.getVideoTracks?.()[0] || null;
    const microphoneTrack = media.microphoneTrack || media.stream?.getAudioTracks?.()[0] || null;
    return Object.freeze({
      cameraDeviceId: cameraTrack?.getSettings?.().deviceId || '',
      cameraLabel: cameraTrack?.label || 'Browser camera',
      microphoneDeviceId: microphoneTrack?.getSettings?.().deviceId || '',
      microphoneLabel: microphoneTrack?.label || 'Browser microphone',
      readiness: this.bridge.readiness,
    });
  }

  async switchDevice(kind, deviceId) {
    const deviceKind = kind === 'camera' ? 'camera' : kind === 'microphone' ? 'microphone' : null;
    const id = String(deviceId || '').trim();
    if (!deviceKind) throw new TypeError('Device kind must be camera or microphone.');
    if (!id) throw new TypeError('deviceId is required.');
    if (!this.running || !this.bridge.media?.stream) throw new Error('Live analytics must be running before an in-room device switch.');

    const clock = this.clock;
    const pipeline = this.pipeline;
    const media = await this.bridge.switchDevice(deviceKind, id);
    this.video.srcObject = media.stream;
    await this.video.play();
    if (clock !== this.clock || pipeline !== this.pipeline) {
      throw new Error('Active analytics identity changed during device switch.');
    }

    if (deviceKind === 'camera') {
      this.cancelFaceBaseline('CAMERA_CHANGED_RECALIBRATION_REQUIRED');
      const context = this.overlayCanvas?.getContext?.('2d');
      context?.clearRect?.(0, 0, this.overlayCanvas.width || 1, this.overlayCanvas.height || 1);
      this.pipeline?.reselectPrimary?.();
      if (!this.pipeline?.visionTimer) this.pipeline?.startVision?.(this.video);
    } else {
      this.transcript.stop({ preserveState: true });
      this.wordTimingState = { state: 'live', reason: 'MICROPHONE_SWITCHING' };
      this.dispatchEvent(new CustomEvent('word-timing-state', { detail: this.wordTimingState }));
      await this.startTranscriptTiming(media.stream);
    }

    return this.currentDevices();
  }

  tick() {
    this.t = finite(this.clock?.sessionMs?.(), this.t);
    return this.t;
  }

  frame() { return this.latest || this.mapFrame(this.projector.latest); }

  faceBaselineFrameAdmitted(detail = {}) {
    if (detail.modality !== 'vision' || detail.primaryLock?.state !== 'PRIMARY_LOCKED') return false;
    const face = detail.geometry?.face || {};
    const box = face.box || {};
    const faceFraction = finite(box.height);
    const yaw = finite(face.yawDeg, finite(face.yawProxyDeg));
    const pitch = finite(face.pitchDeg, finite(face.pitchProxyDeg));
    const maximumPose = Number(COACHING_CONFIG.face.smileQualityMaximumPoseDegrees);
    return face.present === true
      && faceFraction !== null
      && faceFraction >= Number(COACHING_CONFIG.face.smileQualityMinimumFaceFraction)
      && yaw !== null
      && pitch !== null
      && Math.abs(yaw) <= maximumPose
      && Math.abs(pitch) <= maximumPose;
  }

  cancelFaceBaseline(reason = 'FACE_BASELINE_RETRY_REQUIRED') {
    if (this.faceBaselineState.capturing) this.pipeline?.endPersonalFaceBaseline?.();
    this.pipeline?.faceFamily?.clearPersonalBaseline?.();
    this.faceBaselineState = {
      capturing: false,
      available: false,
      reason,
      admittedFrames: 0,
      rejectedFrames: 0,
      startedAtMs: null,
      lastAdmittedAtMs: null,
      attempts: this.faceBaselineState.attempts || 0,
    };
    return this.faceBaselineState;
  }

  advanceFaceBaseline(detail = {}) {
    if (this.faceBaselineState.available || detail.modality !== 'vision') return this.faceBaselineState;
    const atMs = finite(detail.atMs);
    const admitted = atMs !== null && this.faceBaselineFrameAdmitted(detail);
    if (!this.faceBaselineState.capturing) {
      if (!admitted) return this.faceBaselineState;
      const attempts = (this.faceBaselineState.attempts || 0) + 1;
      const started = this.pipeline?.beginPersonalFaceBaseline?.() || {
        capturing: false,
        available: false,
        reason: 'PERSONAL_FACE_BASELINE_UNSUPPORTED',
      };
      this.faceBaselineState = started.available === true
        ? { capturing: false, available: true, reason: null, admittedFrames: 0, rejectedFrames: 0, startedAtMs: null, lastAdmittedAtMs: atMs, attempts }
        : {
            capturing: started.capturing === true,
            available: false,
            reason: started.reason || 'CAPTURING_PERSONAL_FACE_BASELINE',
            admittedFrames: 0,
            rejectedFrames: 0,
            startedAtMs: atMs,
            lastAdmittedAtMs: atMs,
            attempts,
          };
      return this.faceBaselineState;
    }
    if (!admitted) {
      const elapsedMs = Math.max(0, atMs - this.faceBaselineState.startedAtMs);
      const gapMs = Math.max(0, atMs - (this.faceBaselineState.lastAdmittedAtMs ?? this.faceBaselineState.startedAtMs));
      if (elapsedMs > FACE_BASELINE_MAXIMUM_MS || gapMs > FACE_BASELINE_MAXIMUM_GAP_MS) {
        return this.cancelFaceBaseline('FACE_BASELINE_SIGNAL_LOST_RETRY');
      }
      this.faceBaselineState = {
        ...this.faceBaselineState,
        reason: 'CAPTURING_PERSONAL_FACE_BASELINE',
        rejectedFrames: this.faceBaselineState.rejectedFrames + 1,
      };
      return this.faceBaselineState;
    }

    const admittedFrames = this.faceBaselineState.admittedFrames + 1;
    const elapsedMs = Math.max(0, atMs - this.faceBaselineState.startedAtMs);
    this.faceBaselineState = { ...this.faceBaselineState, admittedFrames, lastAdmittedAtMs: atMs };
    if (admittedFrames < FACE_BASELINE_MINIMUM_FRAMES || elapsedMs < FACE_BASELINE_MINIMUM_MS) return this.faceBaselineState;

    const ended = this.pipeline?.endPersonalFaceBaseline?.() || {
      capturing: false,
      available: false,
      reason: 'PERSONAL_FACE_BASELINE_UNSUPPORTED',
    };
    if (ended.available !== true) {
      this.faceBaselineState = { ...this.faceBaselineState, capturing: false };
      return this.cancelFaceBaseline(ended.reason || 'INSUFFICIENT_FACE_BASELINE_FRAMES_RETRY');
    }
    this.faceBaselineState = {
      capturing: false,
      available: true,
      reason: null,
      admittedFrames,
      rejectedFrames: this.faceBaselineState.rejectedFrames,
      startedAtMs: this.faceBaselineState.startedAtMs,
      lastAdmittedAtMs: atMs,
      attempts: this.faceBaselineState.attempts,
    };
    return this.faceBaselineState;
  }

  consumeDiagnostic(detail) {
    const enriched = detail.modality === 'vision' && !detail.faceFamilySummary
      ? { ...detail, faceFamilySummary: this.pipeline?.faceFamily?.summary?.() || null }
      : detail;
    if (detail.modality === 'audio') {
      this.latestAudioSpeaking = detail.vad?.speaking === true
        || detail.speaking === true
        || detail.pitch?.voiced === true;
    }
    if (enriched.modality === 'vision') this.advanceFaceBaseline(enriched);
    this.behavior.setCoachingMode('TRAINING');
    const behavior = this.behavior.ingestDiagnostic(enriched);
    const tagged = { ...enriched, conversationState: behavior.conversation.state, behavior };
    this.projector.setConversationState(behavior.conversation.state);
    const snapshot = this.projector.ingest(tagged);
    this.t = finite(detail.atMs, this.t);
    this.latest = this.mapFrame(snapshot, behavior, detail);
    this.recordHistory(this.latest);
    this.recordStateEvent(this.latest);
    this.recordCountEvents(this.latest);
    this.dispatchEvent(new CustomEvent('frame', { detail: this.latest }));
  }

  consumeWordTiming(evidence) {
    const behavior = this.behavior.ingestWordTiming(evidence);
    this.projector.setConversationState(behavior.conversation.state);
    const snapshot = this.projector.ingestTranscriptTiming(evidence);
    this.t = finite(evidence.atMs, this.t);
    this.latest = this.mapFrame(snapshot, behavior);
    this.recordHistory(this.latest, true);
    this.recordStateEvent(this.latest);
    this.dispatchEvent(new CustomEvent('frame', { detail: this.latest }));
  }

  recordHistory(frame, force = false) {
    if (!frame || (!force && frame.t - this.lastHistoryAt < .5)) return;
    this.lastHistoryAt = frame.t;
    this.history.push({
      t: frame.t,
      vol: frame.speaking && frame.volume.available ? frame.volume.normalized : null,
      pitch: frame.speaking && frame.pitch.available && frame.pitch.voiced && frame.pitch.semitonesFromSpeakerMedian != null
        ? clamp((frame.pitch.semitonesFromSpeakerMedian + 6) / 12, 0, 1)
        : null,
      pace: frame.speaking && frame.speedWpm.available
        ? clamp((frame.speedWpm.wordsPerMinute - 90) / 130, 0, 1)
        : null,
      variety: frame.speaking && frame.volumeModulation.available && Number.isFinite(frame.volumeModulation.score)
        ? clamp(frame.volumeModulation.score / 10, 0, 1)
        : null,
      speaking: frame.speaking,
      state: frame.state,
      hands: frame.bodyHands.visibility,
      presence: frame.headFace.presence,
      facing: frame.headFace.cameraFacingPct,
      nods: frame.headFace.nods,
      smiles: frame.headFace.smileEvents,
      gestures: frame.bodyHands.gestures,
      wpm: frame.speedWpm.available ? frame.speedWpm.wordsPerMinute : null,
      loudness: frame.volume.available ? frame.volume.scientificValue : null,
      loudnessUnit: frame.volume.available ? frame.volume.scientificUnit : null,
      f0Hz: frame.pitch.available && frame.pitch.voiced ? frame.pitch.f0Hz : null,
      signalGap: frame.speaking === true
        && frame.volume.available !== true
        && frame.pitch.available !== true
        && frame.speedWpm.available !== true,
    });
    // Preserve the full time span without allowing the saved JSON envelope to
    // grow without bound. Older observations are progressively decimated while
    // the latest ten minutes retain the native 0.5-second cadence.
    if (this.history.length > 7_200) {
      const recent = this.history.slice(-1_200);
      const older = this.history.slice(0, -1_200).filter((_, index) => index % 2 === 0);
      this.history = [...older, ...recent];
    }
  }

  recordStateEvent(frame) {
    if (!frame?.state || frame.state === this.lastRecordedState) return;
    const previous = this.lastRecordedState;
    this.lastRecordedState = frame.state;
    this.events.push({
      t: frame.t,
      kind: previous === null ? 'answer' : 'transition',
      label: previous === null ? `Measurement state · ${frame.state}` : `${previous} → ${frame.state}`,
    });
  }

  recordCountEvents(frame) {
    for (const [key, kind, label] of [
      ['smiles', 'smile', 'Qualifying observable smile pattern'],
      ['nods', 'nod', 'Observed head-pitch cycle'],
      ['gestures', 'gesture', 'Observed gesture unit'],
    ]) {
      const current = key === 'smiles' ? frame.headFace.smileEvents : key === 'nods' ? frame.headFace.nods : frame.bodyHands.gestures;
      if (!Number.isFinite(current)) continue;
      if (current > this.lastCounts[key]) this.events.push({ t: frame.t, kind, label });
      this.lastCounts[key] = current;
    }
  }

  mapFrame(snapshot, behavior = this.behavior.latest, detail = null) {
    const m = snapshot?.metrics || {};
    const speed = m.SPEED_WPM || {};
    const volume = m.VOLUME || {};
    const modulation = m.VOLUME_MODULATION || {};
    const pitch = m.PITCH || {};
    const head = m.HEAD_FACE || {};
    const body = m.BODY_HANDS || {};
    const wpm = finite(speed.wordsPerMinute);
    const speechLufsK = finite(volume.speechLufsK);
    const dbfs = finite(volume.dbfs);
    const loudness = speechLufsK ?? dbfs;
    const loudnessUnit = speechLufsK !== null ? 'LUFS-K' : dbfs !== null ? 'dBFS' : null;
    const authoritativeLufsCorridor = behavior?.corridors?.loudnessLufsK;
    const authoritativeMinimum = finite(authoritativeLufsCorridor?.minimum);
    const authoritativeMaximum = finite(authoritativeLufsCorridor?.maximum);
    const corridorOffsets = Array.isArray(CALIBRATION.volumeCorridorLu)
      ? CALIBRATION.volumeCorridorLu.map((value) => finite(value))
      : [];
    const loudnessCenter = authoritativeMinimum !== null && authoritativeMaximum !== null
      ? (authoritativeMinimum + authoritativeMaximum) / 2
      : null;
    const loudnessCorridor = speechLufsK !== null
      && loudnessCenter !== null
      && corridorOffsets.length === 2
      && corridorOffsets.every((value) => value !== null)
      ? [loudnessCenter + corridorOffsets[0], loudnessCenter + corridorOffsets[1]]
      : null;
    const range = finite(modulation.speechModulationRangeLu, finite(modulation.rangeDb));
    const paceScore = speed.available ? corridorScore(wpm, CALIBRATION.paceCorridor) : null;
    // Camera diagnostics arrive much faster than audio diagnostics. Persist the
    // latest microphone/VAD truth so a vision frame cannot erase speaking state.
    const speaking = this.latestAudioSpeaking || stateName(behavior?.conversation?.state) === 'ANSWERING';
    const volumeObserved = volume.available === true && loudness !== null;
    const volumeCoachingAvailable = volumeObserved
      && speaking
      && speechLufsK !== null
      && loudnessCorridor !== null;
    const variety = vocalVarietyProjection(pitch, modulation);
    const varietyObserved = variety.score !== null && speaking;
    const volumeScore = volumeCoachingAvailable ? corridorScore(speechLufsK, loudnessCorridor) : null;
    const varietyScore = varietyObserved ? variety.score : null;
    const hands = body.hands || {};
    const handsAvailable = body.available === true && hands.available === true;
    const handVisibility = hands.bothPresent === true
      ? 'BOTH'
      : hands.left?.present === true
        ? 'LEFT'
        : hands.right?.present === true
          ? 'RIGHT'
          : 'NONE';
    const nodsAvailable = head.headNods?.available === true;
    const smilesAvailable = head.smileEvents?.available === true;
    const gestureEventCount = finite(body.gestureUnits?.eventCount);
    const gesturesAvailable = gestureEventCount !== null;
    const gestureRateAvailable = body.gestureUnits?.rateAvailable === true;
    const nods = nodsAvailable ? finite(head.headNods?.eventCount, finite(head.headNods?.count, 0)) : null;
    const smiles = smilesAvailable ? finite(head.smileEvents?.count, 0) : null;
    const gestures = gesturesAvailable ? gestureEventCount : null;
    const facingRatio = finite(head.cameraFacingDwell?.cameraFacingRatio);
    const gestureRate = finite(body.gestureUnits?.unitsPerSpeakingMinute);
    return {
      t: this.t / 1000,
      state: stateName(behavior?.conversation?.state),
      speaking,
      speedWpm: {
        available: speed.available === true,
        wordsPerMinute: wpm,
        score: paceScore,
        cue: direction(wpm, CALIBRATION.paceCorridor),
        holdReason: speed.available ? null : this.wordTimingState.reason || speed.reason || 'WAITING FOR TIMED WORDS',
      },
      volume: {
        available: volumeObserved,
        coachingAvailable: volumeCoachingAvailable,
        speakingObserved: speaking,
        scientificValue: loudness,
        scientificUnit: loudnessUnit,
        speechLufsK,
        dbfs,
        normalized: finite(volume.normalized),
        deltaLu: speechLufsK == null ? null : speechLufsK + 24,
        score: volumeScore,
        cue: volumeCoachingAvailable ? direction(speechLufsK, loudnessCorridor) : null,
        corridor: loudnessCorridor,
        corridorBasis: loudnessCorridor !== null ? 'PERSONAL_LUFS_K_BASELINE_PLUS_SESSION_OFFSETS' : null,
        rawBasis: speechLufsK !== null ? 'VALIDATED_LUFS_K_OBSERVATION' : dbfs !== null ? 'UNCALIBRATED_DEVICE_DBFS' : null,
        holdReason: !volumeObserved
          ? volume.reason || 'WAITING FOR MICROPHONE'
          : !speaking
            ? 'SPEECH-GATED · LISTENING'
            : speechLufsK === null
              ? 'UNCALIBRATED DBFS · RAW LEVEL ONLY'
              : loudnessCorridor === null
                ? 'PERSONAL LOUDNESS BASELINE REQUIRED'
                : null,
      },
      volumeModulation: {
        available: varietyObserved,
        rangeLu: range,
        pitchVariationSemitones: variety.pitchVariation,
        loudnessVariationLu: variety.loudnessVariation,
        pitchComponentScore: variety.pitchScore,
        loudnessComponentScore: variety.loudnessScore,
        score: varietyScore,
        cue: varietyScore === null ? null : varietyScore < 7 ? 1 : varietyScore > 9.5 ? -1 : 0,
        holdReason: varietyObserved
          ? null
          : speaking
            ? variety.pitchVariation === null ? 'ESTABLISHING VOICED RANGE' : modulation.reason || 'BUILDING SPEECH HISTORY'
            : 'SPEECH-GATED · LISTENING',
      },
      pitch: {
        available: pitch.available === true,
        voiced: pitch.voiced === true,
        f0Hz: finite(pitch.f0Hz),
        semitonesFromSpeakerMedian: finite(pitch.semitonesFromSpeakerMedian),
        register: finite(pitch.register),
        variationSemitones: finite(pitch.variationSemitones),
        voicedFrames: finite(pitch.voicedFrames),
      },
      headFace: {
        nods,
        nodsAvailable,
        nodsUnavailableReason: nodsAvailable ? null : head.headNods?.reason || 'NO_VALIDATED_HEAD_NOD_DETECTOR',
        smileEvents: smiles,
        smileEventsAvailable: smilesAvailable,
        smileEventsUnavailableReason: smilesAvailable ? null : head.smileEvents?.reason || 'PERSONAL_BASELINE_REQUIRED',
        faceBaseline: { ...this.faceBaselineState },
        presence: head.facePresent ? 'TRACKED' : 'SEARCHING',
        cameraFacingPct: facingRatio == null ? (head.orientation?.cameraFacingProxy === true ? 100 : 0) : Math.round(facingRatio * 100),
        mouthActive: head.mouthCornerElevation?.active === true,
        eyesActive: head.periocularContraction?.active === true,
      },
      bodyHands: {
        handsAvailable,
        handsVisible: handsAvailable ? hands.left?.present === true || hands.right?.present === true : null,
        bothHandsVisible: handsAvailable ? hands.bothPresent === true : null,
        leftVisible: handsAvailable ? hands.left?.present === true : null,
        rightVisible: handsAvailable ? hands.right?.present === true : null,
        handCount: handsAvailable ? Number(hands.left?.present === true) + Number(hands.right?.present === true) : null,
        visibility: handsAvailable ? handVisibility : 'UNAVAILABLE',
        gestures,
        gesturesAvailable,
        gestureUnavailableReason: gesturesAvailable ? null : body.gestureUnits?.reason || 'NO_GESTURE_UNIT_EVIDENCE',
        rawGestureActivityCount: finite(body.gestureEvents?.count),
        gestureRate,
        gestureRateAvailable,
        gestureRateUnavailableReason: gestureRateAvailable ? null : body.gestureUnits?.rateUnavailableReason || 'INSUFFICIENT_SPEAKING_TIME',
        gestureState: body.gestureUnits?.corridorState || 'UNAVAILABLE',
        inFrame: body.upperBodyPresent === true,
        activity: body.observableActivity?.handRegionActive || (body.movementLevel?.active ? 'active' : 'observing'),
      },
    };
  }

  clearOverlay() {
    clearTimeout(this.overlayFreshnessTimer);
    this.overlayFreshnessTimer = null;
    const context = this.overlayCanvas?.getContext?.('2d');
    context?.clearRect?.(0, 0, this.overlayCanvas.width || 1, this.overlayCanvas.height || 1);
  }

  drawOverlay({ bitmap, clear = false } = {}) {
    const canvas = this.overlayCanvas;
    if (!canvas) return;
    if (clear || !bitmap) {
      this.clearOverlay();
      return;
    }
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    context.drawImage(bitmap, (width - dw) / 2, (height - dh) / 2, dw, dh);
    clearTimeout(this.overlayFreshnessTimer);
    this.overlayFreshnessTimer = setTimeout(() => this.clearOverlay(), OVERLAY_STALE_AFTER_MS);
  }

  setOverlayVisibility(next = {}) {
    this.overlayVisibility = { ...this.overlayVisibility, ...next };
    const { face, hands, body, position } = this.overlayVisibility;
    this.pipeline?.setInstrumentation({
      overlayEnabled: Boolean(face || hands || body || position),
      faceOverlayEnabled: Boolean(face),
      bodyHandsOverlayEnabled: Boolean(hands || body),
      handsOverlayEnabled: Boolean(hands),
      bodyOverlayEnabled: Boolean(body),
      framingOverlayEnabled: Boolean(position),
    });
    return { ...this.overlayVisibility };
  }

  async finish() {
    if (!this.running) return null;
    this.transcript.stop();
    if (this.faceBaselineState.capturing) this.cancelFaceBaseline('SESSION_ENDED_BEFORE_FACE_BASELINE_READY');
    const analytics = this.bridge.endAnalytics({ transcript: '', mediaAvailable: true });
    const result = this.behavior.finish({
      answerId: this.pipeline?.answer?.answerId || `ivoc-${Date.now()}`,
      endedAtMs: this.clock?.sessionMs?.() || this.t,
      metrics: this.projector.latest.metrics,
      analyticsResult: analytics,
    });
    this.running = false;
    return { analytics, behavior: result, snapshot: this.projector.latest, frame: this.frame(), history: this.history.slice(), events: this.events.slice() };
  }

  destroy({ releaseMedia = true } = {}) {
    this.transcript.stop();
    if (this.faceBaselineState.capturing) this.cancelFaceBaseline('FACE_BASELINE_CAPTURE_DESTROYED');
    this.pipeline?.removeEventListener?.('diagnostic', this.onDiagnostic);
    this.pipeline?.removeEventListener?.('state', this.onPipelineState);
    if (releaseMedia) this.bridge.destroy();
    if (this.video) this.video.srcObject = null;
    this.clearOverlay();
    this.running = false;
    this.latestAudioSpeaking = false;
  }
}
