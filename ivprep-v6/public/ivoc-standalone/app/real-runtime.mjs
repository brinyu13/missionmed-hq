import { BehaviorIntelligenceRuntime } from '/iv-prep-on-call/live-analytics/behavior-intelligence-runtime.mjs';
import { LiveMetricProjector } from '/iv-prep-on-call/live-analytics/live-metric-projector.mjs';
import { LocalTranscriptTimingProducer } from '/iv-prep-on-call/live-analytics/local-transcript-timing.mjs';
import { createLiveAnalyticsMediaBridge } from '/iv-prep-on-call/live-analytics/media-bridge.mjs';
import { CALIBRATION } from './data.mjs';

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const finite = (value, fallback = null) => Number.isFinite(value) ? Number(value) : fallback;
const direction = (value, [lo, hi]) => value == null ? null : value < lo ? 1 : value > hi ? -1 : 0;

function corridorScore(value, [lo, hi]) {
  if (!Number.isFinite(value)) return null;
  const mid = (lo + hi) / 2;
  const half = Math.max(.001, (hi - lo) / 2);
  if (value >= lo && value <= hi) return 7.5 + .5 * (1 - Math.abs(value - mid) / half);
  const outside = value < lo ? (lo - value) : (value - hi);
  return clamp(7.5 - outside / half * 3.2, 0, 7.49);
}

function stateName(value) {
  const name = String(value || 'LISTENING').toUpperCase();
  if (name.includes('ANSWER')) return 'ANSWERING';
  if (name.includes('THINK') || name.includes('PAUSE')) return 'THINKING';
  return 'LISTENING';
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
    this.wordTimingState = { state: 'idle', reason: 'WAITING_FOR_TIMED_WORDS' };
    this.onDiagnostic = (event) => this.consumeDiagnostic(event.detail || {});
    this.onPipelineState = (event) => this.dispatchEvent(new CustomEvent('pipeline-state', { detail: event.detail || {} }));
  }

  async start() {
    this.bridge.primeAudioContext();
    const media = await this.bridge.requestMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    });
    this.video.srcObject = media.stream;
    await this.video.play();
    this.pipeline = this.bridge.ensureAnalytics();
    this.pipeline.addEventListener('diagnostic', this.onDiagnostic);
    this.pipeline.addEventListener('state', this.onPipelineState);
    this.pipeline.setInstrumentation({
      overlayEnabled: true,
      faceOverlayEnabled: true,
      bodyHandsOverlayEnabled: true,
      handsOverlayEnabled: true,
      bodyOverlayEnabled: true,
      framingOverlayEnabled: true,
    });
    this.pipeline.setOverlayConsumer((frame) => this.drawOverlay(frame));
    this.projector.reset();
    this.behavior.reset(0);
    this.bridge.startAnalytics({ videoElement: this.video });
    this.clock = this.bridge.sessionClock;
    this.running = true;
    void this.transcript.start({
      stream: media.stream,
      pipeline: this.pipeline,
      clock: this.clock,
      csrfToken: this.csrfToken,
      onTiming: (evidence) => this.consumeWordTiming(evidence),
      onState: (state) => {
        this.wordTimingState = state;
        this.dispatchEvent(new CustomEvent('word-timing-state', { detail: state }));
      },
    });
    this.latest = this.mapFrame(this.projector.latest);
    return media.stream;
  }

  tick() {
    this.t = finite(this.clock?.sessionMs?.(), this.t);
    return this.t;
  }

  frame() { return this.latest || this.mapFrame(this.projector.latest); }

  consumeDiagnostic(detail) {
    this.behavior.setCoachingMode('TRAINING');
    const enriched = detail.modality === 'vision' && !detail.faceFamilySummary
      ? { ...detail, faceFamilySummary: this.pipeline?.faceFamily?.summary?.() || null }
      : detail;
    const behavior = this.behavior.ingestDiagnostic(enriched);
    const tagged = { ...enriched, conversationState: behavior.conversation.state, behavior };
    this.projector.setConversationState(behavior.conversation.state);
    const snapshot = this.projector.ingest(tagged);
    this.t = finite(detail.atMs, this.t);
    this.latest = this.mapFrame(snapshot, behavior, detail);
    this.recordHistory(this.latest);
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
    this.dispatchEvent(new CustomEvent('frame', { detail: this.latest }));
  }

  recordHistory(frame, force = false) {
    if (!frame || (!force && frame.t - this.lastHistoryAt < .2)) return;
    this.lastHistoryAt = frame.t;
    this.history.push({
      t: frame.t,
      vol: frame.volume.available ? clamp((frame.volume.speechLufsK + 48) / 48, 0, 1) : null,
      pitch: frame.pitch.available && frame.pitch.semitonesFromSpeakerMedian != null ? clamp((frame.pitch.semitonesFromSpeakerMedian + 6) / 12, 0, 1) : null,
      pace: frame.speedWpm.available ? clamp((frame.speedWpm.wordsPerMinute - 90) / 130, 0, 1) : null,
      speaking: frame.speaking,
    });
    if (this.history.length > 3_000) this.history.splice(0, 500);
  }

  recordCountEvents(frame) {
    for (const [key, kind, label] of [
      ['smiles', 'smile', 'Qualifying observable smile pattern'],
      ['nods', 'nod', 'Listening nod'],
      ['gestures', 'gesture', 'Observed gesture unit'],
    ]) {
      const current = key === 'smiles' ? frame.headFace.smileEvents : key === 'nods' ? frame.headFace.nods : frame.bodyHands.gestures;
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
    const loudness = finite(volume.speechLufsK, finite(volume.dbfs));
    const range = finite(modulation.speechModulationRangeLu, finite(modulation.rangeDb));
    const paceScore = speed.available ? corridorScore(wpm, CALIBRATION.paceCorridor) : null;
    const speaking = detail?.speaking === true || stateName(behavior?.conversation?.state) === 'ANSWERING';
    const volumeObserved = volume.available === true && speaking;
    const varietyObserved = modulation.available === true && speaking;
    const volumeScore = volumeObserved ? corridorScore(loudness, [-30, -18]) : null;
    const varietyScore = varietyObserved ? corridorScore(range, [3.4, 8]) : null;
    const hands = body.hands || {};
    const nods = finite(head.headNods?.eventCount, finite(head.headNods?.count, 0));
    const smiles = finite(head.smileEvents?.count, 0);
    const gestures = finite(body.gestureUnits?.eventCount, finite(body.gestureEvents?.count, 0));
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
        speechLufsK: loudness,
        deltaLu: loudness == null ? null : loudness + 24,
        score: volumeScore,
        cue: direction(loudness, [-30, -18]),
        holdReason: volumeObserved ? null : speaking ? volume.reason || 'WAITING FOR MICROPHONE' : 'SPEECH-GATED · LISTENING',
      },
      volumeModulation: {
        available: varietyObserved,
        rangeLu: range,
        score: varietyScore,
        cue: direction(range, [3.4, 8]),
        holdReason: varietyObserved ? null : speaking ? modulation.reason || 'BUILDING SPEECH HISTORY' : 'SPEECH-GATED · LISTENING',
      },
      pitch: {
        available: pitch.available === true,
        voiced: pitch.voiced === true,
        f0Hz: finite(pitch.f0Hz),
        semitonesFromSpeakerMedian: finite(pitch.semitonesFromSpeakerMedian),
        register: finite(pitch.register),
      },
      headFace: {
        nods,
        smileEvents: smiles,
        presence: head.facePresent ? 'TRACKED' : 'SEARCHING',
        cameraFacingPct: facingRatio == null ? (head.orientation?.cameraFacingProxy === true ? 100 : 0) : Math.round(facingRatio * 100),
        mouthActive: head.mouthCornerElevation?.active === true,
        eyesActive: head.periocularContraction?.active === true,
      },
      bodyHands: {
        handsVisible: hands.bothPresent === true,
        leftVisible: hands.left?.present === true,
        rightVisible: hands.right?.present === true,
        gestures,
        gestureRate,
        inFrame: body.upperBodyPresent === true,
        activity: body.observableActivity?.handRegionActive || (body.movementLevel?.active ? 'active' : 'observing'),
      },
    };
  }

  drawOverlay({ bitmap }) {
    const canvas = this.overlayCanvas;
    if (!canvas || !bitmap) return;
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
  }

  async finish() {
    if (!this.running) return null;
    this.transcript.stop();
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
    this.pipeline?.removeEventListener?.('diagnostic', this.onDiagnostic);
    this.pipeline?.removeEventListener?.('state', this.onPipelineState);
    if (releaseMedia) this.bridge.destroy();
    if (this.video) this.video.srcObject = null;
    const context = this.overlayCanvas?.getContext?.('2d');
    context?.clearRect?.(0, 0, this.overlayCanvas.width || 1, this.overlayCanvas.height || 1);
    this.running = false;
  }
}
