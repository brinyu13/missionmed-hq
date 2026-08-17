import { BrowserAnalyticsPipeline } from './browser-pipeline.mjs';
import { describeStudentEvent, formatDuration, persistentAnalyticsEnvelopes, studentResultProjection } from './results-projection.mjs';

const GUIDED_STEPS = Object.freeze([
  Object.freeze(['Baseline · 10 seconds', 'Sit as you normally would. Face the camera and hold still; keep your head and shoulders in frame.', 10]),
  Object.freeze(['Natural speech · 25 seconds', 'Read or paraphrase: “I value careful listening, teamwork, and service.” Gesture as you normally would.', 25]),
  Object.freeze(['Pause exercise · 15 seconds', 'Say one sentence, pause for 3–5 seconds, then continue. The system measures silence; it does not infer purpose.', 15]),
  Object.freeze(['Gesture range · 20 seconds', 'Make one left-hand gesture, one right-hand gesture, then one two-hand gesture. Return both hands to rest.', 20]),
  Object.freeze(['Posture + head · 20 seconds', 'Lean gently and return upright. Turn your head left, right, then face the camera.', 20]),
  Object.freeze(['Facial movement · 10 seconds', 'Keep your head still. Smile once, relax, then raise your brows once. This checks movement only, never emotion.', 10]),
  Object.freeze(['Delivery contrast + volume · 25 seconds', 'Read the same sentence slowly, then quickly; once quietly, then normally. This exercises captured delivery signals; WPM stays unavailable without an existing transcript.', 25]),
]);

const GUIDED_DURATION_MS = GUIDED_STEPS.reduce((sum, step) => sum + step[2] * 1_000, 0);
const enduranceSteps = (minutes) => Object.freeze([
  Object.freeze([
    `${minutes}-minute real-WASM endurance hold`,
    'Keep this tab visible and the camera active. Continue natural speaking and movement while all Founder cockpit instruments remain enabled. Finish early at any time; an early or interrupted run is labeled as such.',
    minutes * 60,
  ]),
]);

export const FOUNDER_RUN_MODES = Object.freeze({
  guided: Object.freeze({ id: 'guided', label: 'Guided functional sequence — 2:05', startLabel: 'Start guided test', targetDurationMs: GUIDED_DURATION_MS, endurance: false, requiresCamera: false, steps: GUIDED_STEPS }),
  'endurance-10': Object.freeze({ id: 'endurance-10', label: 'Real-WASM endurance hold — 10:00', startLabel: 'Start 10-minute endurance', targetDurationMs: 10 * 60_000, endurance: true, requiresCamera: true, steps: enduranceSteps(10) }),
  'endurance-15': Object.freeze({ id: 'endurance-15', label: 'Real-WASM endurance hold — 15:00', startLabel: 'Start 15-minute endurance', targetDurationMs: 15 * 60_000, endurance: true, requiresCamera: true, steps: enduranceSteps(15) }),
});

export const FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS = 10_000;
export const FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS = 1_000;

const FOUNDER_INSTRUMENTATION_CONTROLS = Object.freeze([
  Object.freeze(['communication-analytics-show-overlay', ' Tracking overlay', 'communication-analytics-overlay']),
  Object.freeze(['communication-analytics-show-gauges', ' Head + posture gauges', 'communication-analytics-gauges']),
  Object.freeze(['communication-analytics-show-audio', ' Audio instruments', 'communication-analytics-audio']),
  Object.freeze(['communication-analytics-show-timeline', ' Synchronized timeline', 'communication-analytics-timeline']),
]);

const FOUNDER_OVERLAY_LAYER_CONTROLS = Object.freeze([
  Object.freeze(['communication-analytics-show-face-overlay', ' Face overlay']),
  Object.freeze(['communication-analytics-show-body-hands-overlay', ' Body + hands overlay']),
]);

export function founderRunPlan(modeId = 'guided') {
  return FOUNDER_RUN_MODES[modeId] || FOUNDER_RUN_MODES.guided;
}

export function founderRunProgress(modeId, elapsedMs) {
  const plan = founderRunPlan(modeId);
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Object.freeze({
    modeId: plan.id,
    elapsedMs: elapsed,
    remainingMs: Math.max(0, plan.targetDurationMs - elapsed),
    targetDurationMs: plan.targetDurationMs,
    targetReached: elapsed >= plan.targetDurationMs,
  });
}

export function founderRunClock(milliseconds, { rounding = 'floor' } = {}) {
  const value = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  const round = rounding === 'ceil' ? Math.ceil : Math.floor;
  const seconds = round(value / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function founderRunReceipt({
  modeId = 'guided', elapsedMs = 0, interrupted = false, interruptionCount = 0,
  visualFrameCount = 0, firstVisualAtMs = null, lastVisualAtMs = null,
} = {}) {
  const plan = founderRunPlan(modeId);
  const progress = founderRunProgress(plan.id, elapsedMs);
  const frames = Number.isFinite(visualFrameCount) ? Math.max(0, Math.round(visualFrameCount)) : 0;
  const interruptions = Number.isFinite(interruptionCount) ? Math.max(0, Math.round(interruptionCount)) : 0;
  const firstVisual = Number.isFinite(firstVisualAtMs) && firstVisualAtMs >= 0 ? Math.round(firstVisualAtMs) : null;
  const lastVisual = Number.isFinite(lastVisualAtMs) && lastVisualAtMs >= 0 ? Math.round(lastVisualAtMs) : null;
  const realWasmObserved = frames > 0;
  const uninterrupted = !interrupted && interruptions === 0;
  const minimumVisualFrameCount = plan.endurance
    ? Math.max(1, Math.floor((plan.targetDurationMs - FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS) / FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS))
    : 0;
  const visualFrameMinimumRatio = plan.endurance && minimumVisualFrameCount
    ? Number(Math.min(1, frames / minimumVisualFrameCount).toFixed(4))
    : null;
  const visualStartedWithinBound = !plan.endurance || (firstVisual !== null && firstVisual <= FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS);
  const visualFreshThroughTarget = !plan.endurance || (lastVisual !== null && lastVisual >= plan.targetDurationMs - FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS);
  const visualFrameMinimumMet = !plan.endurance || frames >= minimumVisualFrameCount;
  const meaningfulVisualCoverage = realWasmObserved && visualStartedWithinBound && visualFreshThroughTarget && visualFrameMinimumMet;
  const targetCompleted = plan.endurance
    ? progress.targetReached && uninterrupted && meaningfulVisualCoverage
    : progress.targetReached;
  const incompleteReasons = [];
  if (plan.endurance && !progress.targetReached) incompleteReasons.push(`target duration not reached (${founderRunClock(progress.elapsedMs)} of ${founderRunClock(progress.targetDurationMs)})`);
  if (plan.endurance && !uninterrupted) incompleteReasons.push(interruptions > 0
    ? `${interruptions} instrumentation interruption${interruptions === 1 ? '' : 's'} recorded`
    : 'instrumentation interruption recorded');
  if (plan.endurance && !realWasmObserved) incompleteReasons.push('no analyzable visual WASM frames observed');
  if (plan.endurance && realWasmObserved && !visualStartedWithinBound) incompleteReasons.push(`first analyzable visual frame missed the ${founderRunClock(FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS)} startup bound`);
  if (plan.endurance && realWasmObserved && !visualFreshThroughTarget) incompleteReasons.push(`last analyzable visual frame was not within ${founderRunClock(FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS, { rounding: 'ceil' })} of the target boundary`);
  if (plan.endurance && realWasmObserved && !visualFrameMinimumMet) incompleteReasons.push(`${frames} analyzable visual frames observed; minimum ${minimumVisualFrameCount} required at one frame per ${FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS / 1_000}s freshness interval after the ${FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS / 1_000}s startup allowance`);
  let summary;
  if (!plan.endurance) {
    summary = progress.targetReached
      ? `GUIDED FUNCTIONAL SEQUENCE COMPLETE · ${founderRunClock(progress.elapsedMs)} SESSION-CLOCK ELAPSED`
      : `GUIDED FUNCTIONAL SEQUENCE ENDED EARLY · ${founderRunClock(progress.elapsedMs)} OF ${founderRunClock(progress.targetDurationMs)}`;
  } else if (targetCompleted) {
    summary = `${founderRunClock(progress.targetDurationMs)} REAL-WASM ENDURANCE TARGET COMPLETE · ${frames} VISUAL FRAMES OBSERVED · NO RECORDED INSTRUMENTATION INTERRUPTION`;
  } else if (!progress.targetReached) {
    summary = `ENDURANCE ENDED EARLY · ${founderRunClock(progress.elapsedMs)} OF ${founderRunClock(progress.targetDurationMs)} · TARGET NOT COMPLETE · ${incompleteReasons.join(' · ').toUpperCase()}`;
  } else {
    summary = `${founderRunClock(progress.targetDurationMs)} CLOCK TARGET REACHED · NOT AN UNINTERRUPTED REAL-WASM PASS · ${incompleteReasons.join(' · ').toUpperCase()}`;
  }
  return Object.freeze({
    ...progress, endurance: plan.endurance, visualFrameCount: frames,
    firstVisualAtMs: firstVisual, lastVisualAtMs: lastVisual,
    minimumVisualFrameCount, visualFrameMinimumRatio, visualStartedWithinBound,
    visualFreshThroughTarget, visualFrameMinimumMet, meaningfulVisualCoverage,
    interruptionCount: interruptions, uninterrupted, realWasmObserved, targetCompleted,
    incompleteReasons: Object.freeze(incompleteReasons), summary,
  });
}

const MAX_AUDIO_HISTORY = 180;
const MAX_TIMELINE_TRANSITIONS = 4_800;
export const FOUNDER_TIMELINE_LEVEL_CAPACITY = 640;
const LIVE_TIMELINE_WINDOW_MS = 30_000;
const OVERLAY_STALE_MS = FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS;
const TIMING_BUCKET_WIDTH_MS = 0.25;
const TIMING_BUCKET_MAX_MS = 2_000;
const TIMING_BUCKET_COUNT = Math.floor(TIMING_BUCKET_MAX_MS / TIMING_BUCKET_WIDTH_MS) + 2;

export const FOUNDER_DIAGNOSTIC_CONTRACT = Object.freeze({
  clock: 'Every diagnostic detail must include finite, non-negative atMs on the analytics session clock before it can enter the synchronized live timeline.',
  audio: Object.freeze(['modality', 'atMs', 'available', 'rmsDb|rms', 'peak', 'clippingFraction|clippedFraction', 'speaking', 'pauseInProgressMs', 'frameCount']),
  vision: Object.freeze(['modality', 'atMs', 'geometry', 'geometry.faceCount', 'geometry.primaryAssociated', 'primaryLock', 'live', 'overlayRendered', 'overlayPrimitiveCount', 'inferenceMs', 'targetFps', 'droppedFrames']),
  overlay: 'The dedicated same-session workers may transiently transfer a padded primary ROI and render current-frame MediaPipe geometry to a transparent ImageBitmap. Raw frames, crops, coordinates, and anonymous track identifiers are never persisted or sent over a network. The bitmap is drawn only on the student video surface, then closed. Missing, stale, or unassociated primary input clears the overlay.',
});

export function studentSurfaceOverlayContract({
  studentSurfaceId = 'communication-analytics-preview',
  overlaySurfaceId = 'communication-analytics-overlay',
  layoutMode = 'native',
  studentPrimary = true,
  mirrored = false,
  playback = false,
} = {}) {
  const mode = String(layoutMode || 'native').toLowerCase();
  if (!['native', 'zoom', 'webex', 'teams'].includes(mode)) throw new TypeError('Unknown interview layout mode.');
  const studentId = String(studentSurfaceId || '').trim();
  const overlayId = String(overlaySurfaceId || '').trim();
  if (!studentId || !overlayId || studentId === overlayId) throw new TypeError('Student and overlay surfaces must be distinct and named.');
  return Object.freeze({
    studentSurfaceId: studentId,
    overlaySurfaceId: overlayId,
    layoutMode: mode,
    studentLayoutRole: studentPrimary ? 'primary' : 'inset',
    anchor: 'student-video',
    mirrorTransform: mirrored ? 'scaleX(-1)' : 'none',
    playback: Boolean(playback),
    remainsStudentAnchored: true,
  });
}

export function studentOverlayDrawRect(bitmapWidth, bitmapHeight, surfaceWidth, surfaceHeight) {
  if (![bitmapWidth, bitmapHeight, surfaceWidth, surfaceHeight].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.max(surfaceWidth / bitmapWidth, surfaceHeight / bitmapHeight);
  const width = bitmapWidth * scale;
  const height = bitmapHeight * scale;
  return Object.freeze({ width, height, left: (surfaceWidth - width) / 2, top: (surfaceHeight - height) / 2 });
}

function interviewLayoutMode(meetwrap) {
  for (const mode of ['zoom', 'webex', 'teams']) if (meetwrap?.classList?.contains?.(`mp-${mode}`)) return mode;
  return 'native';
}

export class StudentSurfaceOverlayController {
  constructor({
    pipeline,
    playbackPipeline,
    documentRef = globalThis.document,
    scheduleMicrotask = (callback) => queueMicrotask(callback),
    surfaceIds = {},
  } = {}) {
    if (!pipeline || !playbackPipeline) throw new TypeError('Live and playback analytics pipelines are required.');
    this.pipeline = pipeline;
    this.playbackPipeline = playbackPipeline;
    this.document = documentRef;
    this.scheduleMicrotask = scheduleMicrotask;
    this.surfaceIds = Object.freeze({
      video: surfaceIds.video || 'pipvid',
      stage: surfaceIds.stage || 'selfpip',
      room: surfaceIds.room || 'roomstage',
      wrapper: surfaceIds.wrapper || 'meetwrap',
      playback: surfaceIds.playback || 'playback',
    });
    this.policy = Object.freeze({ authorized: false, enabled: false, face: false, bodyHands: false, studentPrimary: true });
    this.view = null;
    this.role = null;
    this.mode = null;
    this.video = null;
    this.stage = null;
    this.overlay = null;
    this.controls = null;
    this.playbackWrapper = null;
    this.playbackParent = null;
    this.playbackNextSibling = null;
    this.layoutObserver = null;
    this.boundPlaybackStart = () => this.startPlayback();
    this.boundPlaybackStop = () => this.stopPlayback('playback_paused');
    this.boundPlaybackSeeking = () => this.stopPlayback('playback_seek');
    this.boundPlaybackSeeked = () => {
      this.stopPlayback('playback_seeked');
      if (this.video?.paused === false && this.video?.ended !== true) this.startPlayback();
    };
    this.pipeline.setOverlayConsumer?.((payload) => this.consumeOverlay(payload, 'live'));
    this.playbackPipeline.setOverlayConsumer?.((payload) => this.consumeOverlay(payload, 'playback'));
    this.applyInstrumentation();
  }

  configure({ authorized = false, enabled = false, face = true, bodyHands = true, studentPrimary = true } = {}) {
    this.policy = Object.freeze({
      authorized: authorized === true,
      enabled: authorized === true && enabled === true,
      face: authorized === true && enabled === true && face === true,
      bodyHands: authorized === true && enabled === true && bodyHands === true,
      studentPrimary: studentPrimary !== false,
    });
    this.applyInstrumentation();
    this.routeSurface();
    return this.snapshot();
  }

  snapshot() {
    return Object.freeze({
      active: this.policy.enabled,
      face: this.policy.face,
      bodyHands: this.policy.bodyHands,
      view: this.view,
      surface: this.mode,
      studentLayoutRole: this.overlay?.dataset?.studentLayoutRole || 'inset',
    });
  }

  applyInstrumentation() {
    const options = {
      overlayEnabled: this.policy.enabled && (this.policy.face || this.policy.bodyHands),
      faceOverlayEnabled: this.policy.face,
      bodyHandsOverlayEnabled: this.policy.bodyHands,
    };
    this.pipeline.setInstrumentation?.(options);
    this.playbackPipeline.setInstrumentation?.(options);
    if (!options.overlayEnabled) this.clearOverlay();
  }

  onViewChange(view, role) {
    this.view = String(view || '');
    this.role = String(role || '');
    this.routeSurface();
  }

  routeSurface() {
    if (!this.policy.enabled) {
      this.unbindSurface();
      return;
    }
    if (this.view === 'room') {
      this.bindLiveSurface();
      return;
    }
    if (this.view === 'results') {
      this.unbindSurface();
      this.scheduleMicrotask(() => {
        if (this.policy.enabled && this.view === 'results') this.bindPlaybackSurface();
      });
      return;
    }
    this.unbindSurface();
  }

  createOverlay(stage, id) {
    const overlay = this.document.createElement('canvas');
    overlay.id = id;
    overlay.className = 'ca-student-surface-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.dataset.overlayLayer = 'student-analytics';
    stage.append(overlay);
    return overlay;
  }

  createControls(stage, includeSwap) {
    const controls = this.document.createElement('div');
    controls.className = 'ca-student-overlay-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Student tracking overlay controls');
    const button = (label, key, pressed) => {
      const control = this.document.createElement('button');
      control.type = 'button';
      control.textContent = label;
      control.dataset.overlayControl = key;
      control.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      control.addEventListener('click', (event) => {
        event.stopPropagation?.();
        if (key === 'swap') this.toggleStudentPrimary();
        else this.toggleOverlayPart(key);
      });
      controls.append(control);
    };
    button('Face', 'face', this.policy.face);
    button('Body / Hands', 'bodyHands', this.policy.bodyHands);
    if (includeSwap) button('Swap student / interviewer', 'swap', this.policy.studentPrimary);
    stage.append(controls);
    return controls;
  }

  bindLiveSurface() {
    const video = this.document.getElementById(this.surfaceIds.video);
    const stage = this.document.getElementById(this.surfaceIds.stage);
    const room = this.document.getElementById(this.surfaceIds.room);
    if (!video || !stage || !room) {
      this.unbindSurface();
      return false;
    }
    if (this.mode === 'live' && this.video === video && this.stage === stage) {
      this.syncSurfaceContract();
      return true;
    }
    this.unbindSurface();
    this.mode = 'live';
    this.video = video;
    this.stage = stage;
    room.classList.toggle('ca-student-primary', this.policy.studentPrimary);
    this.overlay = this.createOverlay(stage, 'communication-analytics-student-live-overlay');
    this.controls = this.createControls(stage, true);
    this.observeLayout([this.document.getElementById(this.surfaceIds.wrapper), room, stage, video]);
    this.syncSurfaceContract();
    return true;
  }

  bindPlaybackSurface() {
    const video = this.document.getElementById(this.surfaceIds.playback);
    if (!video || !video.parentNode) return false;
    if (this.mode === 'playback' && this.video === video) {
      this.syncSurfaceContract();
      return true;
    }
    this.unbindSurface();
    const parent = video.parentNode;
    const nextSibling = video.nextSibling;
    const wrapper = this.document.createElement('div');
    wrapper.className = 'ca-student-playback-stage';
    parent.insertBefore(wrapper, video);
    wrapper.append(video);
    this.mode = 'playback';
    this.video = video;
    this.stage = wrapper;
    this.playbackWrapper = wrapper;
    this.playbackParent = parent;
    this.playbackNextSibling = nextSibling;
    this.overlay = this.createOverlay(wrapper, 'communication-analytics-student-playback-overlay');
    this.controls = this.createControls(wrapper, false);
    for (const event of ['play', 'playing']) video.addEventListener(event, this.boundPlaybackStart);
    for (const event of ['pause', 'ended', 'emptied']) video.addEventListener(event, this.boundPlaybackStop);
    video.addEventListener('seeking', this.boundPlaybackSeeking);
    video.addEventListener('seeked', this.boundPlaybackSeeked);
    this.observeLayout([video, wrapper]);
    this.syncSurfaceContract();
    if (video.paused === false && video.ended !== true) this.startPlayback();
    return true;
  }

  observeLayout(nodes) {
    const Observer = this.document?.defaultView?.MutationObserver || globalThis.MutationObserver;
    if (typeof Observer !== 'function') return;
    this.layoutObserver = new Observer(() => this.syncSurfaceContract());
    for (const node of nodes.filter(Boolean)) this.layoutObserver.observe(node, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  syncSurfaceContract() {
    if (!this.overlay || !this.video) return null;
    const meetwrap = this.document.getElementById(this.surfaceIds.wrapper);
    const room = this.document.getElementById(this.surfaceIds.room);
    const transform = String(this.video.style?.transform || this.document.defaultView?.getComputedStyle?.(this.video)?.transform || 'none');
    const contract = studentSurfaceOverlayContract({
      studentSurfaceId: this.video.id,
      overlaySurfaceId: this.overlay.id,
      layoutMode: interviewLayoutMode(meetwrap),
      studentPrimary: this.mode === 'playback' || room?.classList?.contains?.('ca-student-primary'),
      mirrored: transform.includes('scaleX(-1)') || /^matrix\(-1,/u.test(transform),
      playback: this.mode === 'playback',
    });
    this.overlay.dataset.anchorSurface = contract.studentSurfaceId;
    this.overlay.dataset.layoutMode = contract.layoutMode;
    this.overlay.dataset.studentLayoutRole = contract.studentLayoutRole;
    this.overlay.dataset.playback = String(contract.playback);
    this.overlay.style.transform = contract.mirrorTransform;
    this.overlay.style.transformOrigin = 'center';
    this.controls?.querySelector?.('[data-overlay-control="swap"]')?.setAttribute?.('aria-pressed', contract.studentLayoutRole === 'primary' ? 'true' : 'false');
    return contract;
  }

  toggleOverlayPart(key) {
    if (!['face', 'bodyHands'].includes(key)) return false;
    this.policy = Object.freeze({ ...this.policy, [key]: !this.policy[key] });
    this.controls?.querySelector?.(`[data-overlay-control="${key}"]`)?.setAttribute?.('aria-pressed', this.policy[key] ? 'true' : 'false');
    this.applyInstrumentation();
    return true;
  }

  toggleStudentPrimary() {
    if (this.mode !== 'live') return false;
    const room = this.document.getElementById(this.surfaceIds.room);
    if (!room) return false;
    const primary = !room.classList.contains('ca-student-primary');
    room.classList.toggle('ca-student-primary', primary);
    this.policy = Object.freeze({ ...this.policy, studentPrimary: primary });
    this.syncSurfaceContract();
    return true;
  }

  startPlayback() {
    if (this.mode !== 'playback' || !this.policy.enabled || !this.video || this.video.paused === true || this.video.ended === true) return false;
    if (this.playbackPipeline.diagnostics?.().active) return true;
    try {
      this.playbackPipeline.beginPlayback({ videoElement: this.video });
      return true;
    } catch {
      this.clearOverlay();
      return false;
    }
  }

  stopPlayback(reason = 'playback_stopped') {
    this.clearOverlay();
    return this.playbackPipeline.endPlayback?.(reason) || false;
  }

  consumeOverlay({ bitmap } = {}, source) {
    if (!this.policy.enabled || source !== this.mode || !bitmap || !this.overlay || !this.video) {
      this.clearOverlay();
      return false;
    }
    const width = Math.max(1, Math.round(this.video.clientWidth || this.video.videoWidth || this.stage?.clientWidth || 1));
    const height = Math.max(1, Math.round(this.video.clientHeight || this.video.videoHeight || this.stage?.clientHeight || 1));
    const bitmapWidth = Number(bitmap.width);
    const bitmapHeight = Number(bitmap.height);
    const rect = studentOverlayDrawRect(bitmapWidth, bitmapHeight, width, height);
    const context = this.overlay.getContext?.('2d');
    if (!context || !rect) {
      this.clearOverlay();
      return false;
    }
    this.overlay.width = width;
    this.overlay.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height);
    this.syncSurfaceContract();
    return true;
  }

  clearOverlay() {
    const context = this.overlay?.getContext?.('2d');
    if (context) context.clearRect(0, 0, this.overlay.width || 0, this.overlay.height || 0);
  }

  unbindSurface() {
    this.stopPlayback('surface_unbound');
    if (this.video && this.mode === 'playback') {
      for (const event of ['play', 'playing']) this.video.removeEventListener(event, this.boundPlaybackStart);
      for (const event of ['pause', 'ended', 'emptied']) this.video.removeEventListener(event, this.boundPlaybackStop);
      this.video.removeEventListener('seeking', this.boundPlaybackSeeking);
      this.video.removeEventListener('seeked', this.boundPlaybackSeeked);
    }
    this.layoutObserver?.disconnect?.();
    this.layoutObserver = null;
    this.overlay?.remove?.();
    this.controls?.remove?.();
    if (this.playbackWrapper && this.video && this.playbackParent) {
      this.playbackParent.insertBefore(this.video, this.playbackNextSibling || this.playbackWrapper);
      this.playbackWrapper.remove?.();
    }
    if (this.mode === 'live') this.document.getElementById(this.surfaceIds.room)?.classList?.remove?.('ca-student-primary');
    this.mode = null;
    this.video = null;
    this.stage = null;
    this.overlay = null;
    this.controls = null;
    this.playbackWrapper = null;
    this.playbackParent = null;
    this.playbackNextSibling = null;
  }

  destroy() {
    this.unbindSurface();
    this.pipeline.setOverlayConsumer?.(null);
    this.playbackPipeline.setOverlayConsumer?.(null);
  }
}

export function founderDiagnosticAtMs(detail) {
  return Number.isFinite(detail?.atMs) && detail.atMs >= 0 ? Math.round(detail.atMs) : null;
}

export function boundedFounderHistory(history, value, maximum) {
  if (!Array.isArray(history) || !Number.isInteger(maximum) || maximum < 1) throw new TypeError('A bounded Founder history requires an array and positive integer maximum.');
  history.push(value);
  if (history.length > maximum) history.splice(0, history.length - maximum);
  return history;
}

export function appendFounderTimelineTransition(history, anchors, value, maximum = MAX_TIMELINE_TRANSITIONS) {
  if (!Array.isArray(history) || !(anchors instanceof Map) || !Number.isInteger(maximum) || maximum < 1) throw new TypeError('A bounded Founder timeline requires an array, anchor map, and positive integer maximum.');
  history.push(value);
  while (history.length > maximum) {
    const evicted = history.shift();
    if (evicted?.key) anchors.set(evicted.key, evicted);
  }
  return history;
}

export function founderPauseTimelineTransition(detail) {
  const atMs = founderDiagnosticAtMs(detail);
  if (atMs === null || !Number.isFinite(detail?.pauseInProgressMs)) return null;
  const durationMs = Math.max(0, detail.pauseInProgressMs);
  const active = durationMs >= 1_000;
  return Object.freeze({ active, atMs: active ? Math.max(0, Math.round(atMs - durationMs)) : atMs });
}

export function founderAudioDiagnosticAvailable(detail) {
  return detail?.available !== false && founderDiagnosticAtMs(detail) !== null;
}

export function founderVisionDiagnosticFreshness(detail, maximumAgeMs = OVERLAY_STALE_MS) {
  const atMs = founderDiagnosticAtMs(detail);
  const inferenceMs = Number.isFinite(detail?.inferenceMs) && detail.inferenceMs >= 0 ? detail.inferenceMs : null;
  if (atMs === null || inferenceMs === null || !Number.isFinite(maximumAgeMs) || maximumAgeMs <= 0) {
    return Object.freeze({ fresh: false, atMs, inferenceMs, staleAtMs: atMs, remainingMs: 0 });
  }
  return Object.freeze({
    fresh: inferenceMs < maximumAgeMs,
    atMs,
    inferenceMs,
    staleAtMs: inferenceMs < maximumAgeMs ? null : atMs + maximumAgeMs,
    remainingMs: Math.max(0, maximumAgeMs - inferenceMs),
  });
}

export function founderScalePresentation(value, minimum, maximum, unit = '', decimals = 1, { allowOutOfRange = true } = {}) {
  if (![value, minimum, maximum].every(Number.isFinite) || minimum >= maximum) return Object.freeze({ available: false, bounded: null, text: 'UNAVAILABLE' });
  if (!allowOutOfRange && (value < minimum || value > maximum)) return Object.freeze({ available: false, bounded: null, text: 'UNAVAILABLE' });
  const bounded = Math.max(minimum, Math.min(maximum, value));
  const actual = value.toFixed(decimals);
  const lower = minimum.toFixed(decimals);
  const upper = maximum.toFixed(decimals);
  const suffix = value < minimum
    ? ` — BELOW ${lower}${unit} DISPLAY RANGE`
    : value > maximum ? ` — ABOVE ${upper}${unit} DISPLAY RANGE` : '';
  return Object.freeze({ available: true, bounded, text: `${actual}${unit}${suffix}` });
}

export function createFounderTimingAccumulator() {
  return { count: 0, maxMs: null, buckets: new Uint32Array(TIMING_BUCKET_COUNT) };
}

export function recordFounderTiming(accumulator, value) {
  if (!accumulator || !(accumulator.buckets instanceof Uint32Array) || accumulator.buckets.length !== TIMING_BUCKET_COUNT) throw new TypeError('Founder timing accumulator is invalid.');
  if (!Number.isFinite(value) || value < 0) return accumulator;
  const index = Math.min(TIMING_BUCKET_COUNT - 1, Math.floor(value / TIMING_BUCKET_WIDTH_MS));
  accumulator.buckets[index] += 1;
  accumulator.count += 1;
  accumulator.maxMs = accumulator.maxMs === null ? value : Math.max(accumulator.maxMs, value);
  return accumulator;
}

function percentile95(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? Number(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)].toFixed(2)) : null;
}

export function founderInstrumentationPerformance(costs = {}) {
  const summary = {};
  for (const key of ['overlay', 'audio', 'timeline', 'frame']) {
    const cost = costs[key];
    if (cost?.buckets instanceof Uint32Array && Number.isInteger(cost.count)) {
      const target = Math.ceil(cost.count * 0.95);
      let cumulative = 0;
      let bucketIndex = -1;
      for (let index = 0; index < cost.buckets.length; index += 1) {
        cumulative += cost.buckets[index];
        if (cumulative >= target) { bucketIndex = index;break; }
      }
      const p95Ms = cost.count === 0 ? null : bucketIndex === cost.buckets.length - 1
        ? `>=${TIMING_BUCKET_MAX_MS}`
        : Number((bucketIndex * TIMING_BUCKET_WIDTH_MS).toFixed(2));
      summary[key] = Object.freeze({ samples: cost.count, p95Ms, maxMs: cost.maxMs === null ? null : Number(cost.maxMs.toFixed(2)) });
    } else {
      const values = Array.isArray(cost) ? cost.filter(Number.isFinite) : [];
      summary[key] = Object.freeze({
        samples: values.length,
        p95Ms: percentile95(values),
        maxMs: values.length ? Number(Math.max(...values).toFixed(2)) : null,
      });
    }
  }
  return Object.freeze(summary);
}

export function founderFaceProtectionStatus(detail = {}, diagnostics = {}) {
  const rawFaceCount = detail?.geometry?.faceCount;
  const faceCount = Number.isFinite(rawFaceCount) && rawFaceCount >= 0 ? Math.round(rawFaceCount) : null;
  const explicitStatus = ['idle', 'initializing', 'ready', 'unavailable'].includes(diagnostics?.faceDetectorStatus)
    ? diagnostics.faceDetectorStatus
    : null;
  const inferredCapabilityReady = diagnostics?.multiFaceProtection === true && diagnostics?.faceWorkerReady !== false;
  const detectorStatus = explicitStatus || (inferredCapabilityReady
    ? 'ready'
    : diagnostics?.multiFaceProtection === false ? 'unavailable' : 'initializing');
  const capabilityReady = detectorStatus === 'ready'
    && diagnostics?.multiFaceProtection === true
    && diagnostics?.faceWorkerReady !== false;
  const primaryLock = detail?.primaryLock || diagnostics?.primaryLock || null;
  const primaryAssociated = detail?.geometry?.primaryAssociated === true;
  const guardReady = capabilityReady && primaryLock?.state === 'PRIMARY_LOCKED' && primaryAssociated;
  let label;
  if (detectorStatus === 'unavailable') {
    label = 'FACE DETECTOR UNAVAILABLE · FACE COUNT UNKNOWN · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED';
  } else if (detectorStatus === 'idle') {
    label = 'FACE DETECTOR IDLE · FACE COUNT UNKNOWN · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED';
  } else if (!capabilityReady) {
    label = 'FACE DETECTOR INITIALIZING · FACE COUNT UNKNOWN · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED PENDING GUARD';
  } else if (faceCount === null) {
    label = 'FACE DETECTOR READY · FACE COUNT UNKNOWN · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED';
  } else if (faceCount === 0) {
    label = 'FACE DETECTOR READY · FACE COUNT 0 · NO PERSON DETECTED · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED';
  } else if (guardReady && faceCount > 1) {
    label = `PRIMARY INTERVIEWEE LOCKED · ${faceCount - 1} BYSTANDER${faceCount - 1 === 1 ? '' : 'S'} EXCLUDED · PERSON-SPECIFIC ANALYTICS CONTINUE`;
  } else if (guardReady) {
    label = 'PRIMARY INTERVIEWEE LOCKED · NO BYSTANDER PRESENT';
  } else if (primaryLock?.state === 'PRIMARY_SELECTION_REQUIRED') {
    label = 'PRIMARY SELECTION REQUIRED · USE LOCK TO ME / RESELECT PRIMARY · PERSON-SPECIFIC ANALYTICS WITHHELD';
  } else if (['PRIMARY_TEMPORARILY_OCCLUDED', 'REACQUIRING'].includes(primaryLock?.state)) {
    label = `${primaryLock.state.replaceAll('_', ' ')} · CONTINUITY RETAINED · PERSON-SPECIFIC ANALYTICS TEMPORARILY WITHHELD`;
  } else {
    label = `PRIMARY INTERVIEWEE ${primaryLock?.state?.replaceAll?.('_', ' ') || 'SEARCHING'} · PERSON-SPECIFIC ANALYTICS WITHHELD UNTIL LOCKED`;
  }
  return Object.freeze({ detectorStatus, faceCount, capabilityReady, guardReady, primaryLock, suppressed: !guardReady, label });
}

export function founderOverlayGeometry(detail, { multiFaceProtection = false } = {}) {
  const geometry = detail?.modality === 'vision' ? detail.geometry : null;
  const associated = geometry?.primaryAssociated === true
    || (geometry?.primaryAssociated === undefined && !detail?.primaryLock && geometry?.faceCount === 1);
  if (!multiFaceProtection || !geometry || !associated) return null;
  return geometry;
}

export function founderOverlayDrawRect(bitmapWidth, bitmapHeight, surfaceWidth, surfaceHeight) {
  if (![bitmapWidth, bitmapHeight, surfaceWidth, surfaceHeight].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(surfaceWidth / bitmapWidth, surfaceHeight / bitmapHeight);
  const width = bitmapWidth * scale;
  const height = bitmapHeight * scale;
  return Object.freeze({ width, height, left: (surfaceWidth - width) / 2, top: (surfaceHeight - height) / 2 });
}

function audioLevelDb(detail) {
  if (Number.isFinite(detail?.rmsDb)) return detail.rmsDb <= 0 ? Math.max(-160, detail.rmsDb) : null;
  if (!Number.isFinite(detail?.rms) || detail.rms < 0) return null;
  return Math.max(-160, Math.min(0, 20 * Math.log10(Math.max(detail.rms, 1e-8))));
}

function founderQuantile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export function founderEnergyVariationDb(samples) {
  const bounded = (Array.isArray(samples) ? samples : []).slice(-MAX_AUDIO_HISTORY);
  const values = bounded.map((sample) => Number.isFinite(sample) ? sample : sample?.db).filter(Number.isFinite);
  if (values.length < 4) return null;
  const lower = founderQuantile(values, 0.25);
  const upper = founderQuantile(values, 0.75);
  return lower === null || upper === null ? null : Number(Math.max(0, upper - lower).toFixed(2));
}

function clippingFraction(detail) {
  const value = Number.isFinite(detail?.clippingFraction) ? detail.clippingFraction : detail?.clippedFraction;
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function founderVisualStates(geometry, live = null) {
  if (!geometry) return Object.freeze({ cameraFacing: null, framingCentered: null, gesture: null, headMovement: false, postureMovement: false, facialMovement: false });
  const face = geometry.face || {};
  const box = face.box;
  const cameraFacing = face.present
    ? Math.abs(face.yawProxyDeg || 0) <= 20 && Math.abs(face.pitchProxyDeg || 0) <= 15 && Math.abs(face.rollProxyDeg || 0) <= 15
    : null;
  const framingCentered = face.present && box
    ? box.centerX >= 0.3 && box.centerX <= 0.7 && box.centerY >= 0.2 && box.centerY <= 0.65 && box.width >= 0.12
    : null;
  return Object.freeze({
    cameraFacing,
    framingCentered,
    gesture: ['left', 'right', 'both'].includes(live?.gestureActive) ? live.gestureActive : null,
    headMovement: Boolean(live?.headTurnActive),
    postureMovement: Boolean(live?.postureMovementActive),
    facialMovement: Boolean(live?.facialMovementActive),
  });
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function toggleControl(id, text, checked = true) {
  const label = element('label', 'ca-toggle');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;
  label.append(input, document.createTextNode(text));
  return { label, input };
}

function gauge(id, label, minimum, maximum, unit = '°') {
  const row = element('div', 'ca-gauge');
  const head = element('div', 'ca-gauge-head');
  head.append(element('span', '', label), element('output', 'ca-gauge-value', 'UNAVAILABLE'));
  const meter = element('div', 'ca-gauge-track ca-unavailable');
  meter.id = id;
  meter.dataset.minimum = String(minimum);
  meter.dataset.maximum = String(maximum);
  meter.dataset.unit = unit;
  meter.setAttribute('role', 'meter');
  meter.setAttribute('aria-label', label);
  meter.setAttribute('aria-valuemin', String(minimum));
  meter.setAttribute('aria-valuemax', String(maximum));
  meter.setAttribute('aria-valuetext', 'Unavailable');
  meter.append(element('span', 'ca-gauge-center'), element('i', 'ca-gauge-marker'));
  row.append(head, meter);
  return row;
}

function instrumentMeter(id, label, minimum, maximum, unit) {
  const row = element('div', 'ca-meter-row');
  const head = element('div', 'ca-gauge-head');
  const output = element('output', 'ca-gauge-value', 'UNAVAILABLE');
  output.htmlFor = id;
  head.append(element('span', '', label), output);
  const meter = document.createElement('meter');
  meter.id = id;
  meter.min = minimum;
  meter.max = maximum;
  meter.dataset.unit = unit;
  meter.className = 'ca-meter ca-unavailable';
  meter.setAttribute('aria-label', label);
  meter.setAttribute('aria-valuetext', 'Unavailable');
  row.append(head, meter);
  return row;
}

function setUnsafeLegacyVisibility(hidden) {
  const direct = ['#v-pitch', '#v-move', '#v-crop', '#v-height'];
  for (const selector of direct) document.querySelector(selector)?.closest('.lensrow')?.classList.toggle('ca-hidden', hidden);
  document.querySelector('#checkchips')?.classList.toggle('ca-hidden', hidden);
  document.querySelector('#highlights')?.closest('.panel')?.classList.toggle('ca-hidden', hidden);
  document.querySelector('#stratRead')?.closest('.panel')?.classList.toggle('ca-hidden', hidden);
  document.querySelector('#v-dur')?.closest('.panel')?.classList.toggle('ca-hidden', hidden);
  const replayPanel = document.querySelector('#playback')?.closest('.panel');
  replayPanel?.querySelectorAll('.canvasbox,.teachline').forEach((node) => node.classList.toggle('ca-hidden', hidden));
  document.querySelector('#noplayback')?.classList.toggle('ca-hidden', hidden);
}

export function renderStudentAnalytics(result) {
  const anchor = document.getElementById('communication-results-anchor');
  if (!anchor) return;
  anchor.replaceChildren();
  const projection = studentResultProjection(result);
  const attempted = Boolean(result?.communicationAnalyticsAttempted);
  setUnsafeLegacyVisibility(projection.engineAvailable || attempted);
  if (!projection.engineAvailable && !attempted) return;

  const panel = element('div', 'panel ca-result');
  const pad = element('div', 'pPad');
  const head = element('div', 'ca-result-head');
  const title = element('h2', 'pLbl', 'Communication moments');
  const badge = element('span', projection.available ? 'real' : 'sim', projection.available ? 'VALIDATED · STUDENT SAFE' : 'NO VALIDATED SIGNALS');
  head.append(title, badge);
  pad.append(head);
  pad.append(element('p', 'serif', 'Observable signals from this interview. No communication score was created. Dr Brian’s coaching remains authoritative.'));
  pad.append(element('p', 'serif', 'Only validated signals appear here. Experimental measures stay in the Founder test.'));
  const list = element('div', 'ca-event-list');
  if (!projection.events.length) {
    list.append(element('div', 'ca-status', 'Communication analytics were not available for this interview. No result was inferred.'));
  } else {
    const answerLabels = new Map();
    for (const event of projection.events.slice(0, 9)) {
      if (!answerLabels.has(event.answerId)) answerLabels.set(event.answerId, answerLabels.size + 1);
      const row = element('div', 'ca-event');
      row.append(element('span', 'ca-event-time', formatDuration(event.evidenceRef?.mediaStartMs ?? event.startMs)));
      row.append(element('span', '', `Answer ${answerLabels.get(event.answerId)} · ${describeStudentEvent(event)}`));
      const playback = document.getElementById('playback');
      if (result?.blobUrl && event.evidenceRef?.mediaId && event.evidenceRef.mediaId === result.communicationAnalyticsReplayMediaId && playback && playback.style.display !== 'none') {
        const watch = element('button', 'qBtn', `Watch ${formatDuration(event.evidenceRef.mediaStartMs)}`);
        watch.type = 'button';
        watch.addEventListener('click', () => {
          playback.currentTime = event.evidenceRef.mediaStartMs / 1_000;
          playback.play().catch(() => {});
        });
        row.append(watch);
      }
      list.append(row);
    }
  }
  pad.append(list);
  pad.append(element('div', 'ca-privacy', 'LOCAL DERIVED EVENTS · NO RAW AUDIO, CAMERA FRAMES, LANDMARKS, BIOMETRIC TEMPLATES, OR COMMUNICATION SCORE SAVED BY ANALYTICS'));
  panel.append(pad);
  anchor.append(panel);
}

export class FounderAnalyticsSurface {
  constructor({ root, pipeline, bridge }) {
    this.root = root;
    this.pipeline = pipeline;
    this.bridge = bridge;
    this.state = 'idle';
    this.stepIndex = 0;
    this.startedAt = null;
    this.timer = null;
    this.selectedRunModeId = 'guided';
    this.activeRunPlan = null;
    this.runInterrupted = false;
    this.runInterruptionCount = 0;
    this.runInterruptions = [];
    this.runOpenInterruptions = new Set();
    this.runFirstVisualAtMs = null;
    this.runLastVisualAtMs = null;
    this.runVisualFrameCount = 0;
    this.completedRunReceipt = null;
    this.completedRunCleanup = null;
    this.recorder = null;
    this.chunks = [];
    this.replayUrl = null;
    this.lastDiagnostic = {};
    this.connectEpoch = 0;
    this.runEpoch = 0;
    this.recorderEpoch = 0;
    this.ownsMedia = false;
    this.instrumentationFrame = null;
    this.overlayExpiryTimer = null;
    this.audioHistory = [];
    this.timelineTransitions = [];
    this.timelineTransitionAnchors = new Map();
    this.timelineLevels = [];
    this.timelineStates = new Map();
    this.timelineLatestAtMs = null;
    this.instrumentationCosts = this.newInstrumentationCosts();
    this.completedInstrumentationPerformance = null;
    this.visionStale = true;
    this.visionDiagnosticStale = true;
    this.visionUnavailableReason = null;
    this.audioStale = true;
    this.overlayError = null;
    this.lastOverlayPrimitiveCount = 0;
    this.lastTrackingSummary = '';
    this.lastPrimaryLock = null;
    this.pipeline.addEventListener('diagnostic', (event) => {
      this.consumeDiagnostic(event.detail || {});
    });
    this.pipeline.addEventListener('state', (event) => this.consumePipelineState(event.detail || {}));
    this.pipeline.setOverlayConsumer?.((payload) => this.consumeOverlay(payload));
    // The view this cockpit lives in, read from the DOM rather than hardcoded, so a
    // renamed or re-hosted view can never silently strand onViewChange() again.
    // Two hosts mount this cockpit and they use different attributes:
    //   public/index.html  -> <section data-view="analytics-test" id="analytics-test">
    //   public/aaa/        -> <section data-view-panel="delivery">
    // See onViewChange for what went wrong when this was a hardcoded string.
    this.viewHost = this.root?.closest?.('[data-view-panel],[data-view]') || null;
    this.viewId = this.viewHost?.dataset?.viewPanel || this.viewHost?.dataset?.view || null;
    this.render();
  }

  render() {
    this.root.replaceChildren();
    const grid = element('div', 'ca-grid');
    const media = element('div', 'ca-stack');
    const previewStage = element('div', 'ca-preview-stage');
    const preview = element('video', 'ca-preview');
    preview.id = 'communication-analytics-preview';
    preview.autoplay = true;
    preview.muted = true;
    preview.playsInline = true;
    preview.setAttribute('aria-label', 'Local camera preview for communication analytics');
    const overlay = document.createElement('canvas');
    overlay.id = 'communication-analytics-overlay';
    overlay.className = 'ca-tracking-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    preview.dataset.interviewParticipant = 'student';
    previewStage.dataset.interviewLayout = 'native';
    previewStage.dataset.studentLayoutRole = 'primary';
    overlay.dataset.anchorSurface = preview.id;
    overlay.dataset.overlayLayer = 'student-analytics';
    previewStage.append(preview, overlay);
    // render() rebuilds this subtree via root.replaceChildren(), which discards the
    // <video> that was holding srcObject. Any render while media is live would
    // otherwise leave a black preview with the camera still running. Re-attach the
    // live stream so the surface is self-healing rather than order-dependent.
    const liveStream = this.bridge?.media?.stream;
    if (liveStream && this.bridge?.media?.cam) preview.srcObject = liveStream;
    media.append(previewStage);
    const status = element('div', 'ca-status', 'Connect camera and microphone to begin. Nothing is measured while idle.');
    status.id = 'communication-analytics-status';
    status.tabIndex = -1;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    media.append(status);
    const actions = element('div', 'ca-actions');
    const connect = element('button', 'btnPri cyan', 'Connect camera + mic');
    connect.type = 'button';
    connect.id = 'communication-analytics-connect';
    connect.addEventListener('click', () => this.connect());
    const start = element('button', 'btnHero', 'Start guided test');
    start.type = 'button';
    start.id = 'communication-analytics-start';
    start.disabled = true;
    start.addEventListener('click', () => this.start());
    const finish = element('button', 'btnGhost', 'Finish test');
    finish.type = 'button';
    finish.id = 'communication-analytics-finish';
    finish.disabled = true;
    finish.addEventListener('click', () => this.finish('manual'));
    const reselect = element('button', 'btnGhost', 'LOCK TO ME / RESELECT PRIMARY');
    reselect.type = 'button';
    reselect.id = 'communication-analytics-reselect-primary';
    reselect.disabled = true;
    reselect.setAttribute('aria-label', 'Restart primary interviewee selection from the central strike zone');
    reselect.addEventListener('click', () => {
      if (!this.pipeline.reselectPrimary?.()) return;
      this.lastPrimaryLock = Object.freeze({ state: 'SEARCHING', selectionRequired: false, continuity: 'explicit_selection_restart' });
      this.setStatus('running', 'PRIMARY RESELECTION STARTED · Center yourself in the camera. Person-specific analytics remain withheld until the lock is stable.', { announce: true });
      this.updatePrimarySelectionControl();
      this.scheduleInstrumentationRender();
    });
    actions.append(connect, start, reselect, finish);
    media.append(actions);

    const controls = element('div', 'ca-stack');
    const runConfig = element('div', 'ca-run-config');
    const runModeLabel = element('label', '', 'Founder run mode');
    runModeLabel.htmlFor = 'communication-analytics-run-mode';
    const runMode = document.createElement('select');
    runMode.id = 'communication-analytics-run-mode';
    for (const plan of Object.values(FOUNDER_RUN_MODES)) {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.label;
      runMode.append(option);
    }
    runMode.value = founderRunPlan(this.selectedRunModeId).id;
    runMode.addEventListener('change', () => {
      this.selectedRunModeId = founderRunPlan(runMode.value).id;
      this.renderRunPlan();
      this.updateStartAvailability();
    });
    const runModeNote = element('p', 'ca-instrument-note');
    runModeNote.id = 'communication-analytics-run-mode-note';
    runConfig.append(runModeLabel, runMode, runModeNote);
    controls.append(runConfig);
    const replayLabel = element('label', 'ca-status');
    const replay = document.createElement('input');
    replay.type = 'checkbox';
    replay.id = 'communication-analytics-replay';
    replayLabel.append(replay, document.createTextNode(' Keep a local replay until this tab closes. Off by default.'));
    controls.append(replayLabel);
    const stepTitle = element('h2', 'pLbl', 'Guided test steps');
    stepTitle.id = 'communication-analytics-step-title';
    controls.append(stepTitle);
    const steps = element('ol', 'ca-steps');
    steps.id = 'communication-analytics-steps';
    controls.append(steps);
    const stepActions = element('div', 'ca-actions');
    const next = element('button', 'btnGhost', 'Next step');
    next.type = 'button';
    next.id = 'communication-analytics-next';
    next.disabled = true;
    next.addEventListener('click', () => this.nextStep(false));
    const skip = element('button', 'btnGhost', 'Skip step');
    skip.type = 'button';
    skip.id = 'communication-analytics-skip';
    skip.disabled = true;
    skip.addEventListener('click', () => this.nextStep(true));
    stepActions.append(next, skip);
    controls.append(stepActions);
    grid.append(media, controls);
    this.root.append(grid, this.buildFounderCockpit());
    this.configureOverlay(true);
    this.renderRunPlan();
    this.updateStartAvailability();
    this.scheduleInstrumentationRender();
  }

  renderRunPlan() {
    const plan = founderRunPlan(this.selectedRunModeId);
    this.selectedRunModeId = plan.id;
    const selector = document.getElementById('communication-analytics-run-mode');
    if (selector) selector.value = plan.id;
    const title = document.getElementById('communication-analytics-step-title');
    if (title) title.textContent = plan.endurance ? 'Endurance hold' : 'Guided test steps';
    const note = document.getElementById('communication-analytics-run-mode-note');
    if (note) note.textContent = plan.endurance
      ? `${formatDuration(plan.targetDurationMs)} session-clock target · live camera required to exercise real MediaPipe WASM · cockpit overlay, gauges, audio, and timeline lock on · local replay is disabled to keep the endurance path bounded · keep this tab visible · Finish test remains available for an explicitly early result.`
      : `${formatDuration(plan.targetDurationMs)} guided functional sequence · Next and Skip remain available · automatic finish follows the final step.`;
    const steps = document.getElementById('communication-analytics-steps');
    if (steps) {
      steps.replaceChildren();
      for (const [stepTitle, instruction] of plan.steps) {
        const item = element('li');
        item.append(element('b', '', stepTitle), document.createTextNode(` — ${instruction}`));
        steps.append(item);
      }
    }
    const start = document.getElementById('communication-analytics-start');
    if (start) start.textContent = plan.startLabel;
    const active = this.state === 'running';
    for (const id of ['communication-analytics-next', 'communication-analytics-skip']) {
      const control = document.getElementById(id);
      if (control) control.disabled = !active || plan.endurance;
    }
  }

  cameraIsLive() {
    const media = this.bridge.media || {};
    return Boolean(media.cam && media.stream?.getVideoTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
  }

  microphoneIsLive() {
    const media = this.bridge.media || {};
    return Boolean(media.mic && media.AC?.state === 'running' && media.stream?.getAudioTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
  }

  updateStartAvailability() {
    const plan = founderRunPlan(this.selectedRunModeId);
    const start = document.getElementById('communication-analytics-start');
    const selector = document.getElementById('communication-analytics-run-mode');
    const replay = document.getElementById('communication-analytics-replay');
    const transitioning = ['requesting', 'running', 'finalizing'].includes(this.state);
    const anyMedia = this.cameraIsLive() || this.microphoneIsLive();
    const canStart = ['ready', 'partial'].includes(this.state) && anyMedia && (!plan.requiresCamera || this.cameraIsLive());
    if (start) {
      start.textContent = plan.startLabel;
      start.disabled = !canStart;
    }
    if (selector) selector.disabled = transitioning;
    if (replay) {
      if (plan.endurance) replay.checked = false;
      replay.disabled = transitioning || plan.endurance;
    }
  }

  lockFounderInstrumentation(locked) {
    for (const [id, , targetId] of FOUNDER_INSTRUMENTATION_CONTROLS) {
      const control = document.getElementById(id);
      if (!control) continue;
      if (locked) {
        control.checked = true;
        document.getElementById(targetId)?.classList.remove('ca-hidden');
      }
      control.disabled = Boolean(locked);
    }
    for (const [id] of FOUNDER_OVERLAY_LAYER_CONTROLS) {
      const control = document.getElementById(id);
      if (!control) continue;
      if (locked) control.checked = true;
      control.disabled = Boolean(locked);
    }
    if (locked) this.configureOverlay(true);
    this.scheduleInstrumentationRender();
  }

  buildFounderCockpit() {
    const cockpit = element('section', 'ca-cockpit');
    cockpit.id = 'communication-analytics-founder-cockpit';
    cockpit.setAttribute('aria-labelledby', 'communication-analytics-cockpit-title');
    const head = element('div', 'ca-cockpit-head');
    const heading = element('h2', 'pLbl', 'Live Founder instrumentation');
    heading.id = 'communication-analytics-cockpit-title';
    const badges = element('div', 'ca-badges');
    badges.append(element('span', 'real', 'FOUNDER ONLY'), element('span', 'sim', 'LOCAL DERIVED SIGNALS'));
    head.append(heading, badges);
    cockpit.append(head);
    cockpit.append(element('p', 'ca-cockpit-note', 'Live engineering visibility only. These instruments are not a communication score and do not change the student result.'));

    const toggles = element('div', 'ca-instrument-toggles');
    for (const [id, label, targetId] of FOUNDER_INSTRUMENTATION_CONTROLS) {
      const control = toggleControl(id, label, true);
      control.input.setAttribute('aria-controls', targetId);
      control.input.addEventListener('change', () => {
        const target = document.getElementById(targetId);
        target?.classList.toggle('ca-hidden', !control.input.checked);
        if (id === 'communication-analytics-show-overlay') this.configureOverlay(control.input.checked);
        this.scheduleInstrumentationRender();
      });
      toggles.append(control.label);
    }
    const rawControl = toggleControl('communication-analytics-show-diagnostics', ' Raw diagnostics', false);
    rawControl.input.setAttribute('aria-controls', 'communication-analytics-diagnostics');
    rawControl.input.addEventListener('change', () => this.renderDiagnostics());
    toggles.append(rawControl.label);
    for (const [id, label] of FOUNDER_OVERLAY_LAYER_CONTROLS) {
      const control = toggleControl(id, label, true);
      control.input.setAttribute('aria-controls', 'communication-analytics-overlay');
      control.input.addEventListener('change', () => this.configureOverlay());
      toggles.append(control.label);
    }
    cockpit.append(toggles);

    const tracking = element('div', 'ca-tracking-status');
    tracking.id = 'communication-analytics-tracking-status';
    tracking.setAttribute('role', 'status');
    tracking.setAttribute('aria-live', 'polite');
    tracking.setAttribute('aria-atomic', 'true');
    tracking.textContent = 'Tracking · IDLE — START A GUIDED TEST';
    cockpit.append(tracking);

    const instruments = element('div', 'ca-instrument-grid');
    const gauges = element('section', 'ca-instrument');
    gauges.id = 'communication-analytics-gauges';
    gauges.setAttribute('aria-labelledby', 'communication-analytics-gauges-title');
    const gaugesTitle = element('h3', '', 'Head + posture proxies');
    gaugesTitle.id = 'communication-analytics-gauges-title';
    gauges.append(gaugesTitle, element('p', 'ca-instrument-note', 'Camera-relative geometric proxies for the locked primary interviewee only; bystanders are excluded and never become a student penalty.'));
    gauges.append(
      gauge('communication-analytics-yaw-gauge', 'Head yaw proxy', -45, 45),
      gauge('communication-analytics-pitch-gauge', 'Head pitch proxy', -30, 30),
      gauge('communication-analytics-roll-gauge', 'Head roll proxy', -30, 30),
      gauge('communication-analytics-lean-gauge', 'Torso lateral lean', -30, 30),
    );

    const audio = element('section', 'ca-instrument');
    audio.id = 'communication-analytics-audio';
    audio.setAttribute('aria-labelledby', 'communication-analytics-audio-title');
    const audioTitle = element('h3', '', 'Voice + delivery instruments');
    audioTitle.id = 'communication-analytics-audio-title';
    const audioCanvas = document.createElement('canvas');
    audioCanvas.id = 'communication-analytics-audio-waveform';
    audioCanvas.className = 'ca-signal-canvas';
    audioCanvas.setAttribute('role', 'img');
    audioCanvas.setAttribute('aria-label', 'Audio level envelope unavailable');
    audio.append(audioTitle, element('p', 'ca-instrument-note', 'Bounded derived RMS level envelope; no PCM samples are retained.'), audioCanvas);
    const meters = element('div', 'ca-meter-grid');
    meters.append(
      instrumentMeter('communication-analytics-level-meter', 'Captured level', -80, 0, ' dBFS'),
      instrumentMeter('communication-analytics-peak-meter', 'Peak amplitude', 0, 1, ''),
      instrumentMeter('communication-analytics-clipping-meter', 'Clipping', 0, 100, '%'),
    );
    audio.append(meters);
    const delivery = element('dl', 'ca-delivery-status');
    delivery.append(
      element('dt', '', 'Detected speech'), element('dd', '', 'UNAVAILABLE'),
      element('dt', '', 'Pause in progress'), element('dd', '', 'UNAVAILABLE'),
      element('dt', '', 'Pitch'), element('dd', '', 'UNAVAILABLE — NO VALIDATED F0 INPUT'),
      element('dt', '', 'WPM'), element('dd', '', 'TRANSCRIPT REQUIRED — UNAVAILABLE IN LIVE COCKPIT'),
      element('dt', '', 'Energy variation'), element('dd', '', 'UNAVAILABLE — FOUNDER EXPERIMENTAL ONLY'),
    );
    delivery.id = 'communication-analytics-delivery-status';
    audio.append(delivery);

    const timeline = element('section', 'ca-instrument ca-instrument-wide');
    timeline.id = 'communication-analytics-timeline';
    timeline.setAttribute('aria-labelledby', 'communication-analytics-timeline-title');
    const timelineTitle = element('h3', '', 'Synchronized live timeline');
    timelineTitle.id = 'communication-analytics-timeline-title';
    const timelineCanvas = document.createElement('canvas');
    timelineCanvas.id = 'communication-analytics-live-timeline';
    timelineCanvas.className = 'ca-timeline-canvas';
    timelineCanvas.setAttribute('role', 'img');
    timelineCanvas.setAttribute('aria-label', 'Synchronized timeline awaiting timestamped diagnostics');
    const timelineStatus = element('p', 'ca-timeline-status', 'AWAITING TIMESTAMPED DIAGNOSTICS — NO SYNCHRONIZED EVENTS SHOWN');
    timelineStatus.id = 'communication-analytics-timeline-status';
    timeline.append(timelineTitle, element('p', 'ca-instrument-note', 'Rolling 30-second window. Rows are derived transitions on the analytics session clock, not inferred coaching claims.'), timelineCanvas, timelineStatus);

    instruments.append(gauges, audio, timeline);
    cockpit.append(instruments);
    const diagnostics = element('div', 'ca-diagnostics ca-hidden');
    diagnostics.id = 'communication-analytics-diagnostics';
    diagnostics.setAttribute('aria-live', 'off');
    cockpit.append(diagnostics);
    return cockpit;
  }

  configureOverlay(enabled = document.getElementById('communication-analytics-show-overlay')?.checked !== false) {
    const overlay = document.getElementById('communication-analytics-overlay');
    overlay?.classList.toggle('ca-hidden', !enabled);
    const faceOverlayEnabled = document.getElementById('communication-analytics-show-face-overlay')?.checked !== false;
    const bodyHandsOverlayEnabled = document.getElementById('communication-analytics-show-body-hands-overlay')?.checked !== false;
    try { this.pipeline.setInstrumentation?.({ overlayEnabled: Boolean(enabled), faceOverlayEnabled, bodyHandsOverlayEnabled }); } catch {}
    if (!enabled) this.clearOverlay();
  }

  updatePrimarySelectionControl() {
    const control = globalThis.document?.getElementById?.('communication-analytics-reselect-primary');
    if (!control) return;
    const cameraReady = this.bridge ? this.cameraIsLive() : true;
    control.disabled = this.state !== 'running' || !cameraReady;
    control.classList?.toggle?.('ca-selection-required', this.lastPrimaryLock?.state === 'PRIMARY_SELECTION_REQUIRED');
    control.textContent = this.lastPrimaryLock?.state === 'PRIMARY_SELECTION_REQUIRED'
      ? 'LOCK TO ME / RESELECT PRIMARY — REQUIRED'
      : 'LOCK TO ME / RESELECT PRIMARY';
  }

  consumePipelineState(detail) {
    if (detail?.state === 'primary-lock') {
      this.lastPrimaryLock = detail.primaryLock || null;
      this.updatePrimarySelectionControl();
    }
    if (detail?.state === 'partial') {
      const atMs = founderDiagnosticAtMs(detail);
      if (['vision', 'multi-face-protection', 'all'].includes(detail?.subsystem)) {
        this.expireVision(atMs, detail.message || detail.subsystem);
      }
      if (['audio', 'all'].includes(detail?.subsystem)) {
        this.recordRunInterruption({ ...detail, atMs, subsystem: 'audio' });
        this.audioStale = true;
        this.audioHistory.length = 0;
        this.closeTimelineStates(['audioAvailable', 'speech', 'silence', 'pause', 'clipping'], atMs);
      }
      if (!['vision', 'multi-face-protection', 'audio', 'all'].includes(detail?.subsystem)) this.recordRunInterruption({ ...detail, atMs });
    }
    if (['idle', 'complete'].includes(detail?.state)) {
      this.visionStale = true;
      this.visionDiagnosticStale = true;
      this.audioStale = true;
      this.clearOverlay();
      if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
      this.overlayExpiryTimer = null;
      this.lastPrimaryLock = null;
      this.updatePrimarySelectionControl();
    }
    this.renderDiagnostics();
    this.scheduleInstrumentationRender();
  }

  consumeDiagnostic(detail) {
    const modality = detail?.modality;
    if (modality !== 'audio' && modality !== 'vision') return;
    this.lastDiagnostic[modality] = detail;
    const atMs = founderDiagnosticAtMs(detail);

    if (modality === 'audio') {
      if (!founderAudioDiagnosticAvailable(detail)) {
        this.recordRunInterruption({ subsystem: 'audio', atMs, message: detail.reason || 'audio diagnostics unavailable' });
        this.audioStale = true;
        this.audioHistory.length = 0;
        this.closeTimelineStates(['audioAvailable', 'speech', 'silence', 'pause', 'clipping'], atMs);
        this.renderDiagnostics();
        this.scheduleInstrumentationRender();
        return;
      }
      this.runOpenInterruptions?.delete('audio');
      this.audioStale = false;
      const db = audioLevelDb(detail);
      const peak = Number.isFinite(detail.peak) ? Math.max(0, Math.min(1, detail.peak)) : null;
      const clipping = clippingFraction(detail);
      if (db !== null || peak !== null || clipping !== null) {
        boundedFounderHistory(this.audioHistory, { atMs, db, peak, clipping }, MAX_AUDIO_HISTORY);
      }
      if (atMs !== null) {
        this.timelineLatestAtMs = Math.max(this.timelineLatestAtMs ?? atMs, atMs);
        this.recordTimelineState('audioAvailable', true, atMs);
        if (db !== null) boundedFounderHistory(this.timelineLevels, { atMs, db }, FOUNDER_TIMELINE_LEVEL_CAPACITY);
        if (typeof detail.speaking === 'boolean') this.recordTimelineState('speech', detail.speaking, atMs);
        if (typeof detail.speaking === 'boolean') this.recordTimelineState('silence', !detail.speaking, atMs);
        const pause = founderPauseTimelineTransition(detail);
        if (pause) this.recordTimelineState('pause', pause.active, pause.atMs);
        if (clipping !== null) this.recordTimelineState('clipping', clipping > 0, atMs);
      }
    }

    if (modality === 'vision') {
      this.lastPrimaryLock = detail.primaryLock || this.lastPrimaryLock;
      this.updatePrimarySelectionControl();
      const freshness = founderVisionDiagnosticFreshness(detail);
      if (!freshness.fresh) {
        if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
        this.overlayExpiryTimer = null;
        const boundaryAtMs = freshness.staleAtMs ?? this.timelineLatestAtMs;
        this.expireVision(boundaryAtMs, freshness.inferenceMs === null
          ? 'vision diagnostics unavailable — missing bounded latency'
          : `vision diagnostics stale — ${freshness.inferenceMs.toFixed(1)} ms capture-to-return latency`);
        this.renderDiagnostics();
        return;
      }
      if (!detail.geometry) {
        this.expireVision(freshness.atMs, 'vision geometry unavailable — local frame inference failed');
        this.renderDiagnostics();
        return;
      }
      const diagnostics = this.pipeline.diagnostics();
      const protection = founderFaceProtectionStatus(detail, diagnostics);
      const geometry = founderOverlayGeometry(detail, { multiFaceProtection: protection.guardReady });
      this.runOpenInterruptions?.delete('vision');
      if (atMs !== null) {
        this.runVisualFrameCount = (Number.isFinite(this.runVisualFrameCount) ? this.runVisualFrameCount : 0) + 1;
        if (this.runFirstVisualAtMs === null) this.runFirstVisualAtMs = atMs;
        this.runLastVisualAtMs = Math.max(this.runLastVisualAtMs ?? atMs, atMs);
      }
      this.visionStale = !geometry;
      this.visionDiagnosticStale = false;
      this.visionUnavailableReason = null;
      if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
      this.overlayExpiryTimer = null;
      const overlayEnabled = document.getElementById('communication-analytics-show-overlay')?.checked !== false;
      if (this.state !== 'running' || !overlayEnabled || !geometry || !detail.overlayRendered) this.clearOverlay();
      if (this.state === 'running') {
        const staleAtMs = atMs === null ? null : atMs + OVERLAY_STALE_MS;
        this.overlayExpiryTimer = setTimeout(() => {
          this.overlayExpiryTimer = null;
          this.expireVision(staleAtMs, 'vision diagnostics stale — local inference stopped updating');
        }, freshness.remainingMs);
      }
      if (atMs !== null) {
        const visual = founderVisualStates(geometry, detail.live);
        this.timelineLatestAtMs = Math.max(this.timelineLatestAtMs ?? atMs, atMs);
        this.recordTimelineState('visionAvailable', Boolean(detail.geometry), atMs);
        this.recordTimelineState('face', Boolean(geometry?.face?.present), atMs);
        this.recordTimelineState('torso', Boolean(geometry?.pose?.torsoPresent), atMs);
        this.recordTimelineState('leftHand', Boolean(geometry?.hands?.left?.present), atMs);
        this.recordTimelineState('rightHand', Boolean(geometry?.hands?.right?.present), atMs);
        this.recordTimelineState('gesture', Boolean(visual.gesture), atMs);
        this.recordTimelineState('head', visual.headMovement, atMs);
        this.recordTimelineState('posture', visual.postureMovement, atMs);
        this.recordTimelineState('framing', visual.framingCentered === true, atMs);
      }
    }

    this.renderDiagnostics();
    this.scheduleInstrumentationRender();
  }

  consumeOverlay({ bitmap, geometry, primaryLock = null, atMs, primitiveCount = 0, pipelineMs = null } = {}) {
    const diagnostics = this.pipeline.diagnostics();
    const enabled = document.getElementById('communication-analytics-show-overlay')?.checked !== false;
    const detail = { modality: 'vision', geometry, primaryLock };
    const protection = founderFaceProtectionStatus(detail, diagnostics);
    const protectedGeometry = founderOverlayGeometry(detail, { multiFaceProtection: protection.guardReady });
    const freshness = founderVisionDiagnosticFreshness({ atMs, inferenceMs: pipelineMs });
    if (this.state !== 'running' || !enabled || !bitmap || !protectedGeometry || !freshness.fresh) {
      this.clearOverlay();
      return;
    }
    try {
      this.drawOverlayBitmap(bitmap);
      this.overlayError = null;
      this.lastOverlayPrimitiveCount = Number.isFinite(primitiveCount) ? primitiveCount : 0;
    } catch (error) {
      this.overlayError = String(error?.message || error).slice(0, 300);
      this.clearOverlay();
    }
  }

  recordTimelineState(key, active, atMs) {
    if (founderDiagnosticAtMs({ atMs }) === null) return;
    if (this.timelineStates.get(key) === active) return;
    this.timelineStates.set(key, active);
    appendFounderTimelineTransition(this.timelineTransitions, this.timelineTransitionAnchors, { key, active, atMs }, MAX_TIMELINE_TRANSITIONS);
  }

  closeTimelineStates(keys, atMs) {
    if (atMs === null) return;
    this.timelineLatestAtMs = Math.max(this.timelineLatestAtMs ?? atMs, atMs);
    for (const key of keys) this.recordTimelineState(key, false, atMs);
  }

  recordRunInterruption({ subsystem = 'unknown', atMs = null, message = 'instrumentation unavailable' } = {}) {
    if (this.state !== 'running' || !this.activeRunPlan?.endurance) return false;
    const rawSubsystem = String(subsystem || 'unknown').slice(0, 80);
    const interruptionKey = ['vision', 'multi-face-protection', 'all'].includes(rawSubsystem) ? 'vision' : rawSubsystem;
    if (!(this.runOpenInterruptions instanceof Set)) this.runOpenInterruptions = new Set();
    if (this.runOpenInterruptions.has(interruptionKey)) return false;
    this.runOpenInterruptions.add(interruptionKey);
    this.runInterrupted = true;
    this.runInterruptionCount += 1;
    if (!Array.isArray(this.runInterruptions)) this.runInterruptions = [];
    boundedFounderHistory(this.runInterruptions, Object.freeze({
      atMs: founderDiagnosticAtMs({ atMs }),
      subsystem: rawSubsystem,
      message: String(message || 'instrumentation unavailable').slice(0, 160),
    }), 20);
    return true;
  }

  expireVision(atMs, reason = 'vision unavailable') {
    this.recordRunInterruption({ subsystem: 'vision', atMs, message: reason });
    this.visionStale = true;
    this.visionDiagnosticStale = true;
    this.visionUnavailableReason = reason;
    this.closeTimelineStates(['visionAvailable', 'face', 'torso', 'leftHand', 'rightHand', 'gesture', 'head', 'posture', 'framing'], atMs);
    this.clearOverlay();
    if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
    this.overlayExpiryTimer = null;
    this.renderDiagnostics?.();
    this.scheduleInstrumentationRender();
  }

  scheduleInstrumentationRender() {
    if (this.instrumentationFrame !== null) return;
    if (typeof requestAnimationFrame !== 'function') {
      this.renderInstrumentation();
      return;
    }
    this.instrumentationFrame = requestAnimationFrame(() => {
      this.instrumentationFrame = null;
      this.renderInstrumentation();
    });
  }

  measureInstrumentation(kind, callback) {
    const startedAt = globalThis.performance?.now?.() ?? Date.now();
    try {
      return callback();
    } finally {
      const elapsed = Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - startedAt);
      const accumulator = this.instrumentationCosts[kind];
      if (accumulator) recordFounderTiming(accumulator, elapsed);
    }
  }

  newInstrumentationCosts() {
    return {
      overlay: createFounderTimingAccumulator(),
      audio: createFounderTimingAccumulator(),
      timeline: createFounderTimingAccumulator(),
      frame: createFounderTimingAccumulator(),
    };
  }

  instrumentationPerformance() {
    return founderInstrumentationPerformance(this.instrumentationCosts);
  }

  renderInstrumentation() {
    return this.measureInstrumentation('frame', () => {
      const diagnostics = this.pipeline.diagnostics();
      const vision = this.lastDiagnostic.vision || {};
      const protection = founderFaceProtectionStatus(this.visionDiagnosticStale ? {} : vision, diagnostics);
      const geometry = this.state === 'running' && !this.visionStale
        ? founderOverlayGeometry(vision, { multiFaceProtection: protection.guardReady })
        : null;
      this.renderTrackingStatus(diagnostics, geometry, protection);
      this.setGauge('communication-analytics-yaw-gauge', geometry?.face?.present ? geometry.face.yawProxyDeg : null);
      this.setGauge('communication-analytics-pitch-gauge', geometry?.face?.present ? geometry.face.pitchProxyDeg : null);
      this.setGauge('communication-analytics-roll-gauge', geometry?.face?.present ? geometry.face.rollProxyDeg : null);
      this.setGauge('communication-analytics-lean-gauge', geometry?.pose?.torsoPresent ? geometry.pose.lateralLeanDeg : null);
      this.renderAudioInstruments();
      this.renderTimeline();
    });
  }

  renderTrackingStatus(diagnostics, geometry, protection = founderFaceProtectionStatus(this.lastDiagnostic.vision || {}, diagnostics)) {
    const status = document.getElementById('communication-analytics-tracking-status');
    if (!status) return;
    const running = this.state === 'running';
    const worker = running
      ? this.visionUnavailableReason ? 'VISION UNAVAILABLE' : diagnostics.workerReady ? 'VISION READY' : 'VISION WAITING/UNAVAILABLE'
      : 'VISION IDLE';
    const protectionLabel = running ? protection.label : 'PERSON SAFETY IDLE';
    const face = geometry?.face?.present ? 'FACE TRACKED' : 'FACE UNAVAILABLE';
    const torso = geometry?.pose?.torsoPresent ? 'TORSO TRACKED' : 'TORSO UNAVAILABLE';
    const left = geometry?.hands?.left?.present ? 'LEFT HAND TRACKED' : 'LEFT HAND UNAVAILABLE';
    const right = geometry?.hands?.right?.present ? 'RIGHT HAND TRACKED' : 'RIGHT HAND UNAVAILABLE';
    const visual = founderVisualStates(geometry, this.lastDiagnostic.vision?.live);
    const facing = visual.cameraFacing === null ? 'CAMERA-FACING PROXY UNAVAILABLE' : visual.cameraFacing ? 'CAMERA-FACING PROXY YES' : 'CAMERA-FACING PROXY NO';
    const framing = visual.framingCentered === null ? 'FRAMING UNAVAILABLE' : visual.framingCentered ? 'FRAMING CENTERED' : 'FRAMING OUTSIDE CENTER GUIDE';
    const gesture = !geometry ? 'GESTURE UNAVAILABLE' : visual.gesture ? `GESTURE ACTIVE ${visual.gesture.toUpperCase()}` : 'GESTURE INACTIVE';
    const summary = `${worker} · ${protectionLabel} · ${face} · ${torso} · ${left} · ${right} · ${facing} · ${framing} · ${gesture} · ${diagnostics.targetFps ?? 'UNAVAILABLE'} FPS TARGET · ${diagnostics.droppedFrames ?? 'UNAVAILABLE'} DROPPED`;
    if (summary !== this.lastTrackingSummary) {
      status.textContent = summary;
      this.lastTrackingSummary = summary;
    }
  }

  setGauge(id, value) {
    const meter = document.getElementById(id);
    if (!meter) return;
    const output = meter.parentElement?.querySelector('output');
    const marker = meter.querySelector('.ca-gauge-marker');
    const minimum = Number(meter.dataset.minimum);
    const maximum = Number(meter.dataset.maximum);
    const presentation = founderScalePresentation(value, minimum, maximum, meter.dataset.unit, 1);
    meter.classList.toggle('ca-unavailable', !presentation.available);
    if (!presentation.available) {
      meter.removeAttribute('aria-valuenow');
      meter.setAttribute('aria-valuetext', 'Unavailable');
      if (output) output.textContent = 'UNAVAILABLE';
      if (marker) marker.style.removeProperty('--ca-gauge-position');
      return;
    }
    meter.setAttribute('aria-valuenow', presentation.bounded.toFixed(1));
    meter.setAttribute('aria-valuetext', presentation.text);
    if (output) output.textContent = presentation.text;
    if (marker) marker.style.setProperty('--ca-gauge-position', `${((presentation.bounded - minimum) / (maximum - minimum)) * 100}%`);
  }

  setInstrumentMeter(id, value, decimals = 1, allowOutOfRange = false) {
    const meter = document.getElementById(id);
    if (!meter) return;
    const output = meter.parentElement?.querySelector('output');
    const presentation = founderScalePresentation(value, Number(meter.min), Number(meter.max), meter.dataset.unit, decimals, { allowOutOfRange });
    meter.classList.toggle('ca-unavailable', !presentation.available);
    if (!presentation.available) {
      meter.removeAttribute('value');
      meter.setAttribute('aria-valuetext', 'Unavailable');
      if (output) output.textContent = 'UNAVAILABLE';
      return;
    }
    meter.value = presentation.bounded;
    meter.setAttribute('aria-valuetext', presentation.text);
    if (output) output.textContent = presentation.text;
  }

  renderAudioInstruments() {
    const audio = this.state === 'running' && !this.audioStale ? this.lastDiagnostic.audio || {} : {};
    const db = audioLevelDb(audio);
    const peak = Number.isFinite(audio.peak) && audio.peak >= 0 && audio.peak <= 1 ? audio.peak : null;
    const clipping = clippingFraction(audio);
    const energyVariation = founderEnergyVariationDb(this.audioHistory);
    this.setInstrumentMeter('communication-analytics-level-meter', db, 1, true);
    this.setInstrumentMeter('communication-analytics-peak-meter', peak, 2);
    this.setInstrumentMeter('communication-analytics-clipping-meter', clipping === null ? null : clipping * 100, 1);
    const delivery = document.getElementById('communication-analytics-delivery-status');
    const values = delivery?.querySelectorAll('dd');
    if (values?.length >= 5) {
      values[0].textContent = typeof audio.speaking === 'boolean' ? (audio.speaking ? 'YES — DERIVED LEVEL ACTIVITY' : 'NO') : 'UNAVAILABLE';
      values[1].textContent = Number.isFinite(audio.pauseInProgressMs) ? `${(audio.pauseInProgressMs / 1_000).toFixed(1)} s — SILENCE ONLY; PURPOSE NOT INFERRED` : 'UNAVAILABLE';
      values[2].textContent = 'UNAVAILABLE — NO VALIDATED F0 INPUT';
      values[3].textContent = 'TRANSCRIPT REQUIRED — UNAVAILABLE IN LIVE COCKPIT';
      values[4].textContent = energyVariation === null
        ? 'UNAVAILABLE — NEEDS AT LEAST 4 VALID LEVEL FRAMES · FOUNDER EXPERIMENTAL ONLY'
        : `${energyVariation.toFixed(1)} dB IQR · BOUNDED LAST 180 LEVEL FRAMES · CAPTURED ENERGY ONLY · FOUNDER EXPERIMENTAL ONLY`;
    }
    this.drawAudioEnvelope();
  }

  canvasContext(canvas, fallbackWidth, fallbackHeight) {
    if (!canvas || canvas.classList.contains('ca-hidden')) return null;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || fallbackWidth));
    const cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || fallbackHeight));
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.round(cssWidth * ratio);
    const height = Math.round(cssHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context ? { context, width: cssWidth, height: cssHeight } : null;
  }

  drawOverlayBitmap(bitmap) {
    return this.measureInstrumentation('overlay', () => {
      const canvas = document.getElementById('communication-analytics-overlay');
      const preview = document.getElementById('communication-analytics-preview');
      const stage = canvas?.parentElement;
      if (!canvas || !preview || !stage) return;
      const surface = this.canvasContext(canvas, preview.clientWidth || 480, preview.clientHeight || 270);
      if (!surface) return;
      const { context, width, height } = surface;
      context.clearRect(0, 0, width, height);
      const rect = founderOverlayDrawRect(bitmap.width, bitmap.height, width, height);
      if (!rect) throw new TypeError('Founder overlay bitmap dimensions are unavailable.');
      context.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height);
    });
  }

  clearOverlay() {
    const canvas = document.getElementById('communication-analytics-overlay');
    const context = canvas?.getContext?.('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  }

  drawAudioEnvelope() {
    return this.measureInstrumentation('audio', () => {
      const canvas = document.getElementById('communication-analytics-audio-waveform');
      if (!canvas || document.getElementById('communication-analytics-show-audio')?.checked === false) return;
      const surface = this.canvasContext(canvas, 520, 112);
      if (!surface) return;
      const { context, width, height } = surface;
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#070b12';
      context.fillRect(0, 0, width, height);
      const values = this.audioHistory.map((sample) => sample.db).filter(Number.isFinite);
      if (!values.length) {
        canvas.setAttribute('aria-label', 'Audio level envelope unavailable');
        return;
      }
      context.strokeStyle = 'rgba(57,214,255,.25)';
      context.lineWidth = 1;
      for (const db of [-60, -40, -20]) {
        const y = height - ((db + 80) / 80) * height;
        context.beginPath();context.moveTo(0, y);context.lineTo(width, y);context.stroke();
      }
      context.strokeStyle = '#39d6ff';
      context.lineWidth = 2;
      context.beginPath();
      let started = false;
      this.audioHistory.forEach((sample, index) => {
        if (!Number.isFinite(sample.db)) return;
        const x = this.audioHistory.length < 2 ? width : (index / (this.audioHistory.length - 1)) * width;
        const y = height - ((Math.max(-80, Math.min(0, sample.db)) + 80) / 80) * height;
        if (!started) { context.moveTo(x, y);started = true; } else context.lineTo(x, y);
      });
      context.stroke();
      const latest = values.at(-1);
      canvas.setAttribute('aria-label', `Bounded derived audio level envelope, latest ${latest.toFixed(1)} decibels full scale; no PCM samples retained`);
    });
  }

  renderTimeline() {
    return this.measureInstrumentation('timeline', () => {
    const canvas = document.getElementById('communication-analytics-live-timeline');
    const status = document.getElementById('communication-analytics-timeline-status');
    if (!canvas || !status || document.getElementById('communication-analytics-show-timeline')?.checked === false) return;
    const surface = this.canvasContext(canvas, 920, 280);
    if (!surface) return;
    const { context, width, height } = surface;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#070b12';
    context.fillRect(0, 0, width, height);
    if (this.timelineLatestAtMs === null) {
      status.textContent = 'AWAITING TIMESTAMPED DIAGNOSTICS — NO SYNCHRONIZED EVENTS SHOWN';
      canvas.setAttribute('aria-label', 'Synchronized timeline awaiting timestamped diagnostics');
      return;
    }
    const rows = [
      ['audioAvailable', 'AUDIO DATA'], ['speech', 'SPEECH'], ['silence', 'SILENCE'], ['pause', 'PAUSE'], ['clipping', 'CLIP'], ['level', 'LEVEL'],
      ['visionAvailable', 'VISION DATA'],
      ['face', 'FACE'], ['leftHand', 'L HAND'], ['rightHand', 'R HAND'], ['gesture', 'GESTURE'],
      ['head', 'HEAD'], ['posture', 'POSTURE'], ['framing', 'FRAMING'],
    ];
    const labelWidth = 62;
    const endAt = this.timelineLatestAtMs;
    const startAt = Math.max(0, endAt - LIVE_TIMELINE_WINDOW_MS);
    const span = Math.max(1, endAt - startAt);
    const trackWidth = Math.max(1, width - labelWidth - 8);
    const rowHeight = height / rows.length;
    const xAt = (atMs) => labelWidth + ((Math.max(startAt, Math.min(endAt, atMs)) - startAt) / span) * trackWidth;
    context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    rows.forEach(([key, label], rowIndex) => {
      const top = rowIndex * rowHeight;
      const center = top + rowHeight / 2;
      context.fillStyle = '#8e9daf';
      context.fillText(label, 4, center + 3);
      context.strokeStyle = 'rgba(255,255,255,.1)';
      context.beginPath();context.moveTo(labelWidth, center);context.lineTo(width, center);context.stroke();
      if (key === 'level') {
        const samples = this.timelineLevels.filter((sample) => sample.atMs >= startAt && sample.atMs <= endAt && Number.isFinite(sample.db));
        if (samples.length) {
          context.strokeStyle = '#ffd166';
          context.lineWidth = 1.5;
          context.beginPath();
          samples.forEach((sample, index) => {
            const boundedDb = Math.max(-80, Math.min(0, sample.db));
            const y = top + rowHeight - 4 - ((boundedDb + 80) / 80) * Math.max(3, rowHeight - 8);
            if (index === 0) context.moveTo(xAt(sample.atMs), y);
            else context.lineTo(xAt(sample.atMs), y);
          });
          context.stroke();
        }
        return;
      }
      const transitions = this.timelineTransitions.filter((item) => item.key === key).sort((a, b) => a.atMs - b.atMs);
      let active = Boolean(this.timelineTransitionAnchors.get(key)?.active);
      let activeFrom = startAt;
      for (const transition of transitions) {
        if (transition.atMs < startAt) {
          active = transition.active;
          activeFrom = startAt;
          continue;
        }
        if (transition.atMs > endAt) break;
        if (active) {
          context.fillStyle = key === 'clipping' ? '#ff5d73' : '#39d6ff';
          context.fillRect(xAt(activeFrom), top + 7, Math.max(1, xAt(transition.atMs) - xAt(activeFrom)), Math.max(3, rowHeight - 14));
        }
        active = transition.active;
        activeFrom = transition.atMs;
      }
      if (active) {
        context.fillStyle = key === 'clipping' ? '#ff5d73' : '#39d6ff';
        context.fillRect(xAt(activeFrom), top + 7, Math.max(1, xAt(endAt) - xAt(activeFrom)), Math.max(3, rowHeight - 14));
      }
    });
    const seconds = (span / 1_000).toFixed(1);
    status.textContent = `${this.timelineTransitions.length} BOUNDED STATE TRANSITIONS · ${this.timelineLevels.length} BOUNDED LEVEL SAMPLES · ${seconds} s SESSION-CLOCK WINDOW · NEWEST ${formatDuration(endAt)}`;
    canvas.setAttribute('aria-label', `Synchronized live timeline with ${this.timelineTransitions.length} bounded state transitions and ${this.timelineLevels.length} bounded level samples through ${formatDuration(endAt)}`);
    });
  }

  resetInstrumentation() {
    if (this.instrumentationFrame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.instrumentationFrame);
    this.instrumentationFrame = null;
    if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
    this.overlayExpiryTimer = null;
    this.audioHistory.length = 0;
    this.timelineTransitions.length = 0;
    this.timelineTransitionAnchors.clear();
    this.timelineLevels.length = 0;
    this.timelineStates.clear();
    this.timelineLatestAtMs = null;
    this.runFirstVisualAtMs = null;
    this.runLastVisualAtMs = null;
    this.runVisualFrameCount = 0;
    this.visionStale = true;
    this.visionDiagnosticStale = true;
    this.visionUnavailableReason = null;
    this.audioStale = true;
    this.overlayError = null;
    this.lastOverlayPrimitiveCount = 0;
    this.lastTrackingSummary = '';
    this.lastPrimaryLock = null;
    this.instrumentationCosts = this.newInstrumentationCosts();
    this.clearOverlay();
    for (const id of ['communication-analytics-audio-waveform', 'communication-analytics-live-timeline']) {
      const canvas = document.getElementById(id);
      canvas?.getContext?.('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  async connect() {
    if (this.state === 'requesting' || this.state === 'running' || this.state === 'finalizing') return;
    const connectEpoch = ++this.connectEpoch;
    this.ownsMedia = true;
    this.setStatus('requesting', 'Waiting for browser permission…');
    const connect = document.getElementById('communication-analytics-connect');
    if (connect) connect.disabled = true;
    const start = document.getElementById('communication-analytics-start');
    if (start) start.disabled = true;
    await Promise.resolve(this.bridge.requestMedia(true, true));
    if (connectEpoch !== this.connectEpoch) {
      if (this.bridge.media?.stream) this.bridge.stopMedia();
      this.ownsMedia = false;
      return;
    }
    // Y1-Y2-CAM-V6-3502: this block used to assign to current.cam / current.mic.
    // The bridge publishes its media as Object.freeze({...}) (see analyticsBridge in
    // public/aaa/app.mjs), and ES modules are always strict, so the write threw
    // "TypeError: Cannot assign to read only property 'cam'" and aborted connect()
    // right here - after getUserMedia had already succeeded and the camera was live,
    // but before the stream reached the preview and before the status left
    // "Waiting for browser permission...". That is the reported M1 failure exactly:
    // permission granted, webcam LED on, black video, vision IDLE, every metric
    // unavailable, Start never enabling. Liveness is now derived into locals and the
    // bridge's frozen contract is respected.
    const current = this.bridge.media;
    const camLive = Boolean(current.cam && current.stream?.getVideoTracks?.().some((track) => track.readyState === 'live'));
    const micLive = Boolean(current.mic && current.stream?.getAudioTracks?.().some((track) => track.readyState === 'live'));
    const preview = document.getElementById('communication-analytics-preview');
    if (preview && current.stream) preview.srcObject = current.stream;
    if (!camLive && !micLive) {
      this.setStatus('denied', 'Camera and microphone are blocked or unavailable. Nothing was measured. Use the browser permission control, then retry.');
      document.getElementById('communication-analytics-status')?.focus();
      if (connect) { connect.disabled = false; connect.textContent = 'Retry camera + mic'; }
      return;
    }
    const availability = `${camLive ? 'CAMERA ACTIVE' : 'CAMERA UNAVAILABLE'} · ${micLive ? 'MIC ACTIVE' : 'MIC UNAVAILABLE'}`;
    this.setStatus(camLive && micLive ? 'ready' : 'partial', `${availability}. Raw frames and audio are not sent by analytics.`);
    if (connect) connect.disabled = false;
    this.updateStartAvailability();
  }

  start() {
    if (!['ready', 'partial'].includes(this.state)) return;
    const selected = document.getElementById('communication-analytics-run-mode')?.value || this.selectedRunModeId;
    const plan = founderRunPlan(selected);
    this.selectedRunModeId = plan.id;
    if (plan.requiresCamera && !this.cameraIsLive()) {
      this.setStatus('partial', `${plan.label} requires a live camera so real MediaPipe WASM frames are actually processed. Reconnect camera or choose the guided functional sequence.`);
      document.getElementById('communication-analytics-status')?.focus();
      return;
    }
    this.pipeline.resetSession();
    this.completedInstrumentationPerformance = null;
    this.completedRunReceipt = null;
    this.completedRunCleanup = null;
    this.resetInstrumentation();
    this.lastDiagnostic = {};
    if (this.replayUrl) URL.revokeObjectURL(this.replayUrl);
    this.replayUrl = null;
    this.chunks = [];
    const runEpoch = ++this.runEpoch;
    this.activeRunPlan = plan;
    this.runInterrupted = false;
    this.runInterruptionCount = 0;
    this.runInterruptions.length = 0;
    this.runOpenInterruptions.clear();
    this.runFirstVisualAtMs = null;
    this.runLastVisualAtMs = null;
    this.runVisualFrameCount = 0;
    this.stepIndex = 0;
    this.startedAt = performance.now();
    const mediaId = `founder-${Date.now()}`;
    let mediaStartedAt = null;
    const replay = document.getElementById('communication-analytics-replay');
    if (replay?.checked && window.MediaRecorder && this.bridge.media?.stream) {
      try {
        const recorder = new MediaRecorder(this.bridge.media.stream);
        const recorderEpoch = ++this.recorderEpoch;
        this.recorder = recorder;
        recorder.ondataavailable = (event) => {
          if (this.recorder === recorder && this.recorderEpoch === recorderEpoch && runEpoch === this.runEpoch && event.data.size) this.chunks.push(event.data);
        };
        recorder.start(250);
        mediaStartedAt = performance.now();
      } catch { this.recorder = null; }
    }
    try {
      this.pipeline.beginAnswer({ answerId: mediaId, mediaId, mediaStartedAt, videoElement: document.getElementById('communication-analytics-preview') });
    } catch {
      this.detachRecorder();
      this.activeRunPlan = null;
      this.lockFounderInstrumentation(false);
      this.setStatus('error', 'The local analytics session could not start. Nothing was retained.');
      return;
    }
    this.lockFounderInstrumentation(plan.endurance);
    this.setStatus('running', plan.endurance
      ? `${plan.label} running. Cockpit instrumentation is locked on. Keep this tab visible; Finish test ends early and will be labeled honestly.`
      : 'Guided functional test running. No score is being created.');
    for (const id of ['communication-analytics-start', 'communication-analytics-connect']) document.getElementById(id)?.setAttribute('disabled', '');
    document.getElementById('communication-analytics-finish')?.removeAttribute('disabled');
    this.renderRunPlan();
    this.renderStep();
    this.timer = setInterval(() => this.tickRun(runEpoch), 250);
  }

  tickRun(runEpoch = this.runEpoch, now = performance.now()) {
    if (runEpoch !== this.runEpoch || this.state !== 'running' || !this.activeRunPlan) return;
    this.renderStep();
    const elapsedMs = Math.max(0, now - this.startedAt);
    if (this.activeRunPlan.endurance) {
      if (elapsedMs >= this.activeRunPlan.targetDurationMs) this.finish('target_elapsed');
      return;
    }
    const stepEndMs = this.activeRunPlan.steps.slice(0, this.stepIndex + 1).reduce((sum, step) => sum + step[2] * 1_000, 0);
    if (elapsedMs >= stepEndMs) this.nextStep(false);
  }

  nextStep(skipped) {
    if (this.state !== 'running' || !this.activeRunPlan || this.activeRunPlan.endurance) return;
    const item = document.querySelectorAll('#communication-analytics-steps li')[this.stepIndex];
    if (skipped && item) item.append(document.createTextNode(' · NOT EXERCISED'));
    this.stepIndex += 1;
    if (this.stepIndex >= this.activeRunPlan.steps.length) this.finish('guided_sequence_complete');
    else this.renderStep(true);
  }

  renderStep(announce = false) {
    document.querySelectorAll('#communication-analytics-steps li').forEach((item, index) => {
      if (index === this.stepIndex && this.state === 'running') item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    if (this.state === 'running' && this.activeRunPlan) {
      const elapsedMs = Math.max(0, performance.now() - this.startedAt);
      const step = this.activeRunPlan.steps[this.stepIndex] || this.activeRunPlan.steps.at(-1);
      if (this.activeRunPlan.endurance) {
        const progress = founderRunProgress(this.activeRunPlan.id, elapsedMs);
        this.setStatus('running', `${step[0]} · elapsed ${founderRunClock(progress.elapsedMs)} · remaining ${founderRunClock(progress.remainingMs, { rounding: 'ceil' })} · ${this.runInterrupted ? 'INTERRUPTION RECORDED — RUN WILL NOT BE LABELED UNINTERRUPTED' : 'NO INSTRUMENTATION INTERRUPTION RECORDED'} · ${step[1]}`, { announce });
      } else {
        this.setStatus('running', `${step[0]} · session ${founderRunClock(elapsedMs)} elapsed · ${step[1]}`, { announce });
      }
    }
  }

  async finish(reason = 'manual') {
    if (this.state !== 'running') return;
    const runEpoch = this.runEpoch;
    const endAt = performance.now();
    const elapsedMs = Math.max(0, endAt - this.startedAt);
    this.completedRunReceipt = founderRunReceipt({
      modeId: this.activeRunPlan?.id || this.selectedRunModeId,
      elapsedMs,
      interrupted: this.runInterrupted,
      interruptionCount: this.runInterruptionCount,
      visualFrameCount: this.runVisualFrameCount,
      firstVisualAtMs: this.runFirstVisualAtMs,
      lastVisualAtMs: this.runLastVisualAtMs,
    });
    clearInterval(this.timer);
    this.timer = null;
    this.setStatus('finalizing', `${reason === 'target_elapsed' || reason === 'guided_sequence_complete' ? 'Target reached.' : 'Finish requested.'} Finalizing synchronized evidence…`);
    if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
    this.overlayExpiryTimer = null;
    this.visionStale = true;
    this.visionDiagnosticStale = true;
    this.clearOverlay();
    this.pipeline.prepareEnd(endAt);
    const recorder = this.recorder;
    let recorderStopped = false;
    if (recorder) {
      recorderStopped = await Promise.race([
        new Promise((resolve) => {
          recorder.addEventListener('stop', () => resolve(true), { once: true });
          recorder.addEventListener('error', () => resolve(false), { once: true });
          try { if (recorder.state !== 'inactive') recorder.stop(); else resolve(true); } catch { resolve(false); }
        }),
        new Promise((resolve) => setTimeout(() => resolve(false), 2_000)),
      ]);
    }
    if (runEpoch !== this.runEpoch) return;
    if (recorder && recorderStopped && this.chunks.length) this.replayUrl = URL.createObjectURL(new Blob(this.chunks, { type: this.chunks[0].type || 'video/webm' }));
    this.detachRecorder({ stop: false });
    const result = this.pipeline.endAnswer({ mediaAvailable: Boolean(this.replayUrl), endAt });
    if (!result) {
      if (this.replayUrl) URL.revokeObjectURL(this.replayUrl);
      this.replayUrl = null;
      this.chunks = [];
      this.clear();
      this.setStatus('error', 'TEST FAILED · RESULT WITHHELD. Local validation did not accept this run; devices were released and no analytics result was retained. Retry when ready.');
      document.getElementById('communication-analytics-status')?.focus();
      return;
    }
    this.completedInstrumentationPerformance = this.instrumentationPerformance();
    this.lockFounderInstrumentation(false);
    this.resetInstrumentation();
    this.completedRunCleanup = this.releaseCompletedRunResources();
    this.renderFounderResult(result);
  }

  releaseCompletedRunResources() {
    let released = true;
    try { this.pipeline.resetSession(); } catch { released = false; }
    if (this.ownsMedia) {
      try {
        this.bridge.stopMedia();
        this.ownsMedia = false;
      } catch { released = false; }
    }
    if (released) {
      const preview = document.getElementById('communication-analytics-preview');
      if (preview) preview.srcObject = null;
    }
    return released;
  }

  detachRecorder({ stop = true } = {}) {
    const recorder = this.recorder;
    this.recorderEpoch += 1;
    this.recorder = null;
    if (!recorder) return;
    recorder.ondataavailable = null;
    recorder.onerror = null;
    recorder.onstop = null;
    if (stop && recorder.state !== 'inactive') { try { recorder.stop(); } catch {} }
  }

  renderFounderResult(result) {
    const runReceipt = this.completedRunReceipt;
    this.setStatus('complete', `${runReceipt?.summary || 'TEST COMPLETE'} · No score was created.`);
    const prior = document.getElementById('communication-analytics-founder-result');
    prior?.remove();
    const panel = element('div', 'panel ca-result');
    panel.id = 'communication-analytics-founder-result';
    panel.tabIndex = -1;
    const pad = element('div', 'pPad');
    pad.append(element('h2', 'pLbl', 'Synchronized evidence and validation catalog'));
    const studentSafe = result?.studentEvents?.length || 0;
    const experimental = result?.events?.filter((event) => event.maturity === 'FOUNDER_EXPERIMENTAL').length || 0;
    pad.append(element('div', 'ca-status', `${studentSafe} validated student-safe observations · ${experimental} Founder-only experimental observations · ${result?.events?.length || 0} total timestamped events.`));
    if (runReceipt) pad.append(element('div', `ca-run-receipt ${runReceipt.targetCompleted && this.completedRunCleanup ? 'ca-run-complete' : 'ca-run-limited'}`, `${runReceipt.summary} · ${this.completedRunCleanup ? 'CAMERA, MICROPHONE, AND LOCAL WASM WORKERS RELEASED' : 'AUTOMATIC CLEANUP INCOMPLETE — USE CLEAR TEST + RELEASE DEVICES'}`));
    const energyVariation = result?.events?.find((event) => event.metric === 'energy_variation_db');
    if (energyVariation && Number.isFinite(energyVariation.observation?.value)) {
      pad.append(element('div', 'ca-status', `FOUNDER EXPERIMENTAL · energy_variation_db ${Number(energyVariation.observation.value).toFixed(2)} dB IQR across this answer · captured energy only · delivery quality not inferred · never included in student projection.`));
    }
    const primaryLock = result?.founderDiagnostics?.primaryIntervieweeLock;
    if (primaryLock) {
      const intervals = (primaryLock.withheldIntervals || []).map((interval) => `${formatDuration(interval.startMs)}–${formatDuration(interval.endMs)} ${interval.reason}`).join(' · ') || 'NONE';
      pad.append(element('div', 'ca-status', `FOUNDER DIAGNOSTIC ONLY · PRIMARY ${primaryLock.state} · MAXIMUM BYSTANDERS ${primaryLock.maximumBystanderCount ?? 0} · EXACT WITHHELD ${primaryLock.excludedDurationMs ?? 0} ms · REACQUISITIONS ${primaryLock.reacquisitionCount ?? 0} · INTERVALS ${intervals} · NO STUDENT PENALTY.`));
    }
    const list = element('div', 'ca-event-list');
    for (const event of (result?.events || [])) {
      const row = element('div', 'ca-event');
      row.append(element('span', 'ca-event-time', formatDuration(event.evidenceRef?.mediaStartMs ?? 0)));
      const observed = typeof event.observation?.value === 'object' ? JSON.stringify(event.observation.value) : String(event.observation?.value ?? 'unavailable');
      const limitations = event.quality?.limitations?.length ? ` · limitations: ${event.quality.limitations.join(', ')}` : '';
      row.append(element('span', '', `${event.metric.replaceAll('_', ' ')} · ${observed} ${event.observation?.unit || ''} · ${event.durationMs} ms · reliability ${event.quality?.reliability || 'unavailable'}${limitations} · ${event.maturity === 'VALIDATED_STUDENT_SAFE' ? 'VALIDATED · STUDENT SAFE' : event.maturity === 'REJECTED_UNRELIABLE' ? 'REJECTED · UNRELIABLE' : 'EXPERIMENTAL · FOUNDER ONLY'}`));
      if (this.replayUrl && event.evidenceRef?.mediaId) {
        const watch = element('button', 'qBtn', `Watch ${formatDuration(event.evidenceRef.mediaStartMs)}`);
        watch.type = 'button';
        watch.addEventListener('click', () => {
          const replay = document.getElementById('communication-analytics-founder-replay');
          if (replay) { replay.currentTime = event.evidenceRef.mediaStartMs / 1_000; replay.play().catch(() => {}); }
        });
        row.append(watch);
      }
      list.append(row);
    }
    pad.append(list);
    const cockpitPerformance = this.completedInstrumentationPerformance;
    pad.append(element('div', 'ca-privacy', `PRIVACY RECEIPT · analytics raw audio/frames/crops/landmarks/anonymous track identifiers retained: NO · transient worker ROI transfer: SAME-SESSION MEMORY ONLY · optional local replay: ${this.replayUrl ? 'YES — TAB MEMORY ONLY' : 'NO'} · external analytics egress: BLOCKED BY SAME-ORIGIN WORKER GUARD + CSP · full visual pipeline p95 (includes worker rendering): ${result?.performance?.visualInferenceP95Ms ?? 'UNRESOLVED'} ms · Founder cockpit run-wide p95 (0.25 ms histogram) overlay blit/audio/timeline/frame: ${cockpitPerformance?.overlay?.p95Ms ?? 'UNRESOLVED'}/${cockpitPerformance?.audio?.p95Ms ?? 'UNRESOLVED'}/${cockpitPerformance?.timeline?.p95Ms ?? 'UNRESOLVED'}/${cockpitPerformance?.frame?.p95Ms ?? 'UNRESOLVED'} ms`));
    if (this.replayUrl) {
      const replay = element('video', 'ca-preview');
      replay.id = 'communication-analytics-founder-replay';
      replay.controls = true;
      replay.src = this.replayUrl;
      replay.setAttribute('aria-label', 'Local Founder replay for synchronized communication evidence');
      pad.append(replay);
    }
    const actions = element('div', 'ca-actions');
    const again = element('button', 'btnGhost', 'Run another test');
    again.type = 'button';
    again.addEventListener('click', () => {
      if (this.replayUrl) URL.revokeObjectURL(this.replayUrl);
      this.replayUrl = null;this.chunks = [];this.lastDiagnostic = {};
      this.completedInstrumentationPerformance = null;this.completedRunReceipt = null;this.completedRunCleanup = null;this.activeRunPlan = null;this.runInterrupted = false;this.runInterruptionCount = 0;this.runInterruptions.length = 0;this.runOpenInterruptions.clear();this.runFirstVisualAtMs = null;this.runLastVisualAtMs = null;this.runVisualFrameCount = 0;
      this.resetInstrumentation();this.pipeline.resetSession();this.render();this.connect();
    });
    const clear = element('button', 'btnGhost', 'Clear test + release devices');
    clear.type = 'button';
    clear.addEventListener('click', () => this.clear());
    actions.append(again, clear);
    pad.append(actions);
    panel.append(pad);
    this.root.append(panel);
    panel.focus();
    for (const id of ['communication-analytics-finish', 'communication-analytics-next', 'communication-analytics-skip']) document.getElementById(id)?.setAttribute('disabled', '');
  }

  clear({ render = true } = {}) {
    this.connectEpoch += 1;
    this.runEpoch += 1;
    clearInterval(this.timer);
    this.timer = null;
    this.detachRecorder();
    this.chunks = [];
    if (this.replayUrl) URL.revokeObjectURL(this.replayUrl);
    this.replayUrl = null;
    this.lastDiagnostic = {};
    this.completedInstrumentationPerformance = null;
    this.completedRunReceipt = null;
    this.completedRunCleanup = null;
    this.activeRunPlan = null;
    this.runInterrupted = false;
    this.runInterruptionCount = 0;
    this.runInterruptions.length = 0;
    this.runOpenInterruptions.clear();
    this.runFirstVisualAtMs = null;
    this.runLastVisualAtMs = null;
    this.runVisualFrameCount = 0;
    this.lockFounderInstrumentation(false);
    this.resetInstrumentation();
    this.pipeline.resetSession();
    this.state = 'idle';
    if (this.ownsMedia) this.bridge.stopMedia();
    this.ownsMedia = false;
    if (render) this.render();
  }

  // Y1-Y2-CAM-V6-3502: this guard used to read `view === 'analytics-test'`, a literal
  // that is only correct for the public/index.html host. In the shipped AAA product
  // the views are home/instant/custom/results/vault/mentor/debrief/delivery/file/
  // program and this cockpit lives in 'delivery', so the guard never matched. Every
  // view sync after connecting fell through to clear(), which calls
  // bridge.stopMedia() and render(): the camera tracks were stopped and the preview
  // <video> was rebuilt empty. That is precisely the reported failure - permission
  // granted, webcam LED on, student video black, vision IDLE, face/torso/hands
  // unavailable, gauges unavailable, controls unresponsive.
  //
  // The owning view is now resolved from the DOM, so re-hosting or renaming the view
  // cannot strand this again.
  ownsActiveView(view, role) {
    if (String(role || '') !== 'admin') return false;
    if (this.viewId && String(view || '') === this.viewId) return true;
    // setView() applies panel.hidden before calling onViewChange, so an unhidden
    // owning panel is authoritative even if the id lookup failed.
    return Boolean(this.viewHost && this.viewHost.hidden !== true);
  }

  onViewChange(view, role) {
    if (this.ownsActiveView(view, role)) return;
    if (this.ownsMedia || this.state !== 'idle' || this.replayUrl) this.clear();
  }

  setStatus(state, message, { announce = false } = {}) {
    this.state = state;
    const status = document.getElementById('communication-analytics-status');
    if (status) {
      status.textContent = message;
      status.classList.toggle('ca-error', state === 'denied' || state === 'error');
      status.setAttribute('aria-busy', state === 'requesting' || state === 'finalizing' ? 'true' : 'false');
      status.setAttribute('aria-live', state === 'running' && !announce ? 'off' : 'polite');
    }
    this.updateStartAvailability();
    this.updatePrimarySelectionControl();
    this.scheduleInstrumentationRender();
  }

  renderDiagnostics() {
    const box = document.getElementById('communication-analytics-diagnostics');
    const toggle = document.getElementById('communication-analytics-show-diagnostics');
    if (!box || !toggle) return;
    box.classList.toggle('ca-hidden', !toggle.checked);
    if (!toggle.checked) return;
    const diagnostics = this.pipeline.diagnostics();
    const audio = this.audioStale ? {} : this.lastDiagnostic.audio || {};
    const vision = this.visionDiagnosticStale ? {} : this.lastDiagnostic.vision || {};
    const voiceDb = audioLevelDb(audio);
    const clipped = clippingFraction(audio);
    const energyVariation = founderEnergyVariationDb(this.audioHistory);
    const protection = founderFaceProtectionStatus(vision, diagnostics);
    const geometry = this.state === 'running' && !this.visionStale
      ? founderOverlayGeometry(vision, { multiFaceProtection: protection.guardReady })
      : null;
    const cockpitPerformance = this.instrumentationPerformance();
    const reliability = diagnostics.workerErrors.length || protection.detectorStatus === 'unavailable'
      ? 'LIMITED'
      : protection.detectorStatus === 'initializing' ? 'WAITING FOR FACE DETECTOR' : diagnostics.workerReady ? 'COLLECTING' : 'UNAVAILABLE';
    box.textContent = [
      `Engine · active ${diagnostics.active} · vision ${this.visionUnavailableReason ? 'UNAVAILABLE' : diagnostics.workerReady ? 'READY' : 'WAITING/UNAVAILABLE'} · ${protection.label} · target ${diagnostics.targetFps} FPS · dropped ${diagnostics.droppedFrames}`,
      `Primary lock · state ${protection.primaryLock?.state || 'UNAVAILABLE'} · zone ${protection.primaryLock?.zoneStatus || 'UNAVAILABLE'} · continuity ${protection.primaryLock?.continuity || 'UNAVAILABLE'} · bystanders excluded ${protection.primaryLock?.bystanderCount ?? 'UNAVAILABLE'} · exact withheld ${protection.primaryLock?.excludedDurationMs ?? 'UNAVAILABLE'} ms · reacquisitions ${protection.primaryLock?.reacquisitionCount ?? 'UNAVAILABLE'}`,
      `Voice · level ${voiceDb === null ? 'UNAVAILABLE' : voiceDb.toFixed(1) + ' dBFS'} · clipping ${clipped === null ? 'UNAVAILABLE' : (clipped * 100).toFixed(1) + '%'} · detected speech ${audio.speaking ?? 'UNAVAILABLE'} · silence in progress ${Number.isFinite(audio.pauseInProgressMs) ? (audio.pauseInProgressMs / 1000).toFixed(1) + 's' : 'UNAVAILABLE'} · bounded live energy variation ${energyVariation === null ? 'UNAVAILABLE' : energyVariation.toFixed(1) + ' dB IQR'} (last 180 level frames; captured energy only; FOUNDER EXPERIMENTAL) · PITCH UNAVAILABLE WITHOUT VALIDATED F0 INPUT · WPM UNAVAILABLE WITHOUT VALIDATED TRANSCRIPT`,
      `Body · torso ${geometry?.pose?.torsoPresent ?? 'UNAVAILABLE'} · lateral lean ${geometry?.pose?.lateralLeanDeg ?? 'UNAVAILABLE'}° · left hand ${geometry?.hands?.left?.present ?? 'UNAVAILABLE'} (${geometry?.hands?.left?.zone ?? 'UNAVAILABLE'}) · right hand ${geometry?.hands?.right?.present ?? 'UNAVAILABLE'} (${geometry?.hands?.right?.zone ?? 'UNAVAILABLE'})`,
      `Face · present ${geometry?.face?.present ?? 'UNAVAILABLE'} · head yaw/pitch/roll ${geometry?.face?.yawProxyDeg ?? 'UNAVAILABLE'}/${geometry?.face?.pitchProxyDeg ?? 'UNAVAILABLE'}/${geometry?.face?.rollProxyDeg ?? 'UNAVAILABLE'}° · movement rate ${geometry?.face?.movementRatePerSecond ?? 'UNAVAILABLE'} score-change/s · full pipeline ${vision.inferenceMs ?? 'UNAVAILABLE'} ms (face ${vision.faceInferenceMs ?? 'UNAVAILABLE'} ms · Holistic ${vision.holisticInferenceMs ?? 'UNAVAILABLE'} ms) · overlay ${this.visionStale ? 'UNAVAILABLE/STALE' : this.overlayError ? `FAILED (${this.overlayError})` : vision.overlayRequested ? (vision.overlayRendered ? `RENDERED (${vision.overlayPrimitiveCount ?? this.lastOverlayPrimitiveCount ?? 0} transient worker-drawn primitives)` : 'UNAVAILABLE') : 'OFF'}`,
      `Reliability · audio windows ${diagnostics.audioFrameCount} · analyzable visual frames ${diagnostics.visualFrameCount} · ${reliability}`,
      `Run-wide instrumentation cost p95 · overlay blit ${cockpitPerformance.overlay.p95Ms ?? 'UNRESOLVED'} ms · audio ${cockpitPerformance.audio.p95Ms ?? 'UNRESOLVED'} ms · timeline ${cockpitPerformance.timeline.p95Ms ?? 'UNRESOLVED'} ms · full cockpit frame ${cockpitPerformance.frame.p95Ms ?? 'UNRESOLVED'} ms · bounded fixed-memory 0.25 ms histograms`,
      ...(diagnostics.workerErrors.length ? [`Vision limitation · ${diagnostics.workerErrors.at(-1)}`] : []),
      `Privacy · ${diagnostics.networkPolicy}`,
    ].join('\n');
  }
}

export function initializeAnalyticsUi(bridge, { surfaceIds = {}, overlayPolicy = null } = {}) {
  const pipeline = new BrowserAnalyticsPipeline({ bridge });
  const playbackPipeline = new BrowserAnalyticsPipeline({ bridge });
  const founderPipeline = new BrowserAnalyticsPipeline({ bridge });
  const root = document.getElementById('communication-analytics-test-root');
  const founder = root ? new FounderAnalyticsSurface({ root, pipeline: founderPipeline, bridge }) : null;
  const studentOverlay = new StudentSurfaceOverlayController({ pipeline, playbackPipeline, surfaceIds });
  if (overlayPolicy) studentOverlay.configure(overlayPolicy);
  const api = Object.freeze({
    beginAnswer: (options) => pipeline.beginAnswer(options),
    prepareEnd: (endAt) => pipeline.prepareEnd(endAt),
    endAnswer: (options) => pipeline.endAnswer(options),
    abandonAnswer: (reason) => pipeline.abandonAnswer(reason),
    renderStudentResults: renderStudentAnalytics,
    onViewChange: (view, role) => { studentOverlay.onViewChange(view, role);founder?.onViewChange(view, role); },
    diagnostics: () => pipeline.diagnostics(),
    // Y1-Y2-CAM-V6-3506: the facade exposed no way to observe telemetry, so external
    // surfaces (Film Room, Analytics Lab) had no diagnostic source and rendered every
    // lane UNAVAILABLE. Two pipelines emit: `founderPipeline` drives the cockpit's own
    // guided runs and `pipeline` drives the student overlay, so both are forwarded.
    // Returns an unsubscribe function. Read-only by construction - a listener cannot
    // influence capture.
    onDiagnostic: (listener) => {
      if (typeof listener !== 'function') throw new TypeError('A diagnostic listener function is required.');
      const handler = (event) => { try { listener(event.detail || {}); } catch { /* a consumer must never break capture */ } };
      founderPipeline.addEventListener('diagnostic', handler);
      pipeline.addEventListener('diagnostic', handler);
      return () => {
        founderPipeline.removeEventListener('diagnostic', handler);
        pipeline.removeEventListener('diagnostic', handler);
      };
    },
    persistentEnvelopes: (value) => persistentAnalyticsEnvelopes(value),
    resetSession: () => { playbackPipeline.endPlayback('session_reset');pipeline.resetSession(); },
    releaseRuntime: () => { playbackPipeline.endPlayback('runtime_released');pipeline.resetSession(); },
    destroy: () => { studentOverlay.destroy();founder?.clear({ render: false });founderPipeline.destroy();playbackPipeline.destroy();pipeline.destroy(); },
  });
  window.addEventListener('pagehide', () => { studentOverlay.destroy();founder?.clear({ render: false });founderPipeline.destroy();playbackPipeline.destroy();pipeline.destroy(); }, { once: true });
  return api;
}
