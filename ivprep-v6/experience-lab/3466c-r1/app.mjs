import { BrowserAnalyticsPipeline } from './analytics/browser-pipeline.mjs';
import { LocalPlaybackOverlayRuntime } from './analytics/playback-overlay.mjs';

const $ = (id) => document.getElementById(id);
const TRACKS = Object.freeze(['QUESTION', 'PHASE', 'SPEECH', 'SILENCE', 'PAUSE', 'LEVEL', 'FACE', 'HANDS', 'HEAD', 'POSTURE / FRAMING', 'COACHING', 'MARKER', 'SYSTEM']);
const MAX_EVENTS = 420;
const SAMPLE_DURATION_MS = 92_000;

const elements = Object.freeze({
  readyScreen: $('readyScreen'), liveScreen: $('liveScreen'), replayScreen: $('replayScreen'),
  readyEyebrow: $('readyEyebrow'), readyTitle: $('readyTitle'), readyLede: $('readyLede'),
  startSession: $('startSession'), retrySession: $('retrySession'), dismissError: $('dismissError'),
  replayConsent: $('replayConsent'), loadSample: $('loadSample'),
  liveVideo: $('liveVideo'), liveOverlay: $('liveOverlay'), liveModeBadge: $('liveModeBadge'),
  sessionClock: $('sessionClock'), deviceHealth: $('deviceHealth'), phaseLabel: $('phaseLabel'),
  tunerCue: $('tunerCue'), cueMaturity: $('cueMaturity'), cueText: $('cueText'), tunerNeedle: $('tunerNeedle'),
  telemetryDrawer: $('telemetryDrawer'), telemetrySession: $('telemetrySession'), signalStack: $('signalStack'),
  mentorMarker: $('mentorMarker'), dropMarker: $('dropMarker'), finishTake: $('finishTake'),
  replayEyebrow: $('replayEyebrow'), replayTitle: $('replayTitle'), replayVideo: $('replayVideo'),
  replayOverlay: $('replayOverlay'), noReplay: $('noReplay'), sampleWatermark: $('sampleWatermark'),
  momentList: $('momentList'), addReplayMarker: $('addReplayMarker'), flightTracks: $('flightTracks'),
  timeRuler: $('timeRuler'), crumbPhase: $('crumbPhase'), crumbMoment: $('crumbMoment'),
  spotlightMode: $('spotlightMode'), eraseSession: $('eraseSession'), statusToast: $('statusToast'),
  errorSheet: $('errorSheet'), errorTitle: $('errorTitle'), errorMessage: $('errorMessage'),
  openDirector: $('openDirector'), closeDirector: $('closeDirector'), directorPanel: $('directorPanel'),
  directorPrompt: $('directorPrompt'), compileProfile: $('compileProfile'), profilePreview: $('profilePreview'),
  confirmProfile: $('confirmProfile'), addReplayMarkerButton: $('addReplayMarker'),
});

const state = {
  role: 'student',
  mode: 'simulation',
  projection: 'coach',
  status: 'idle',
  faceLayer: true,
  bodyLayer: true,
  replayFaceLayer: true,
  replayBodyLayer: true,
  keepReplay: false,
  stream: null,
  audioContext: null,
  audioSource: null,
  analyser: null,
  bridge: null,
  pipeline: null,
  recorder: null,
  recorderChunks: [],
  replayUrl: null,
  playbackOverlay: null,
  answerResult: null,
  events: [],
  markers: [],
  latest: freshSignals(),
  priorSpeech: null,
  priorFace: null,
  priorTorso: null,
  priorHands: null,
  priorFraming: null,
  priorCue: null,
  phase: 'OPEN',
  lastLevelEventAt: -Infinity,
  clockTimer: null,
  sessionStartedAt: null,
  durationMs: 0,
  sampleMode: false,
  startCount: 0,
  pipelineGenerationAtStart: null,
  focusProfile: Object.freeze([{ id: 'audibility', label: 'Audibility', maturity: 'REAL NOW' }, { id: 'framing', label: 'Framing', maturity: 'EXPERIMENTAL' }]),
  draftProfile: null,
  cleanup: { tracksEnded: [], audioContextState: 'none', workersReleased: true, recorderState: 'none', replayRetained: false },
};

function freshSignals() {
  return {
    audioDbfs: null, peak: null, clipping: null, speaking: null, pauseMs: 0,
    faceCount: null, facePresent: null, torsoPresent: null, leftHand: null, rightHand: null,
    yaw: null, pitch: null, roll: null, framingCentered: null, pipelineMs: null,
    targetFps: null, droppedFrames: 0, overlayStatus: 'idle', workerState: 'idle',
  };
}

function formatTime(milliseconds) {
  const value = Math.max(0, Number(milliseconds) || 0);
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.floor((value % 60_000) / 1_000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function sessionMs() {
  if (state.pipeline?.session?.clock) return state.pipeline.session.clock.sessionMs();
  if (state.status === 'running' && Number.isFinite(state.sessionStartedAt)) return performance.now() - state.sessionStartedAt;
  return state.durationMs;
}

function showScreen(name) {
  for (const [key, element] of [['ready', elements.readyScreen], ['live', elements.liveScreen], ['replay', elements.replayScreen]]) {
    const active = key === name;
    element.hidden = !active;
    element.classList.toggle('is-active', active);
  }
  location.hash = name;
}

let toastTimer = null;
function toast(message, duration = 2_600) {
  clearTimeout(toastTimer);
  elements.statusToast.textContent = String(message || '').slice(0, 220);
  elements.statusToast.hidden = false;
  toastTimer = setTimeout(() => { elements.statusToast.hidden = true; }, duration);
}

function setRole(role) {
  if (!['student', 'mentor'].includes(role)) return;
  state.role = role;
  document.documentElement.dataset.role = role;
  for (const button of document.querySelectorAll('[data-role-choice]')) {
    const active = button.dataset.roleChoice === role;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  const mentor = role === 'mentor';
  elements.readyEyebrow.textContent = mentor ? 'DR BRIAN LIVE COACHING STUDIO' : 'STUDENT INTERVIEW STUDIO';
  elements.readyTitle.innerHTML = mentor ? 'Teach the moment.<br><span>Not the dashboard.</span>' : 'Walk in ready.<br><span>Leave knowing why.</span>';
  elements.readyLede.textContent = mentor
    ? 'A screen-share-safe local rehearsal: one student surface, one recorder, and instant film-room teaching.'
    : 'One question. One real take. Your camera, microphone, and analytics stay in this browser.';
  elements.mentorMarker.hidden = !(mentor && state.status === 'running');
  elements.replayEyebrow.textContent = mentor ? 'DR BRIAN FILM ROOM' : 'STUDENT FILM ROOM';
  elements.replayTitle.textContent = mentor ? 'Stop. Seek. Teach the exact moment.' : 'The answer is now teachable.';
  elements.addReplayMarker.hidden = !mentor;
}

function setMode(mode) {
  if (!['simulation', 'live-coaching'].includes(mode) || state.status === 'running') return;
  state.mode = mode;
  for (const button of document.querySelectorAll('[data-mode]')) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function setProjection(projection) {
  if (!['coach', 'telemetry'].includes(projection)) return;
  state.projection = projection;
  document.documentElement.dataset.projection = projection;
  for (const button of document.querySelectorAll('[data-projection-choice]')) {
    const active = button.dataset.projectionChoice === projection;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  elements.telemetryDrawer.hidden = projection !== 'telemetry';
  if (projection === 'telemetry') renderTelemetry();
}

function setLayer(layer, enabled) {
  if (layer === 'face') state.faceLayer = Boolean(enabled);
  if (layer === 'body') state.bodyLayer = Boolean(enabled);
  for (const button of document.querySelectorAll(`[data-layer="${layer}"]`)) button.setAttribute('aria-pressed', String(Boolean(enabled)));
  state.pipeline?.setInstrumentation({
    overlayEnabled: state.faceLayer || state.bodyLayer,
    faceEnabled: state.faceLayer,
    bodyEnabled: state.bodyLayer,
  });
  if (!state.faceLayer && !state.bodyLayer) clearCanvas(elements.liveOverlay);
  toast(`${layer === 'face' ? 'Face' : 'Body + hands'} layer ${enabled ? 'on' : 'off'} · analytics session unchanged`);
}

function setReplayLayer(layer, enabled) {
  if (layer === 'face') state.replayFaceLayer = Boolean(enabled);
  if (layer === 'body') state.replayBodyLayer = Boolean(enabled);
  for (const button of document.querySelectorAll(`[data-replay-layer="${layer}"]`)) button.setAttribute('aria-pressed', String(Boolean(enabled)));
  state.playbackOverlay?.setLayers({
    overlayEnabled: state.replayFaceLayer || state.replayBodyLayer,
    faceEnabled: state.replayFaceLayer,
    bodyEnabled: state.replayBodyLayer,
  });
}

function addEvent(track, atMs, label, maturity = 'EXPERIMENTAL', options = {}) {
  const safeTrack = TRACKS.includes(track) ? track : 'SYSTEM';
  const start = Math.max(0, Math.round(Number(atMs) || 0));
  const end = Math.max(start, Math.round(Number(options.endMs ?? start + (options.durationMs ?? 260)) || start));
  const event = Object.freeze({
    id: `${safeTrack.toLowerCase().replace(/[^a-z]+/g, '-')}-${start}-${state.events.length + 1}`,
    track: safeTrack,
    atMs: start,
    endMs: end,
    label: String(label || safeTrack).slice(0, 120),
    maturity,
    source: String(options.source || '3420R local evidence').slice(0, 100),
  });
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  return event;
}

function phaseFor(milliseconds) {
  if (milliseconds < 15_000) return 'OPEN';
  if (milliseconds < 42_000) return 'PROVE';
  if (milliseconds < 70_000) return 'STORY';
  return 'CLOSE';
}

function updatePhase(milliseconds) {
  const next = phaseFor(milliseconds);
  if (next !== state.phase) {
    state.phase = next;
    addEvent('PHASE', milliseconds, `${next} · sample strategy timing`, 'SAMPLE/DEMO', { durationMs: 2_000, source: 'Local product-story clock' });
  }
  elements.phaseLabel.textContent = `${next} · SAMPLE STRATEGY`;
}

function startClock() {
  clearInterval(state.clockTimer);
  state.clockTimer = setInterval(() => {
    const at = sessionMs();
    state.durationMs = at;
    elements.sessionClock.textContent = formatTime(at);
    updatePhase(at);
  }, 100);
}

function stopClock() {
  clearInterval(state.clockTimer);
  state.clockTimer = null;
}

function drawLiveBitmap(bitmap) {
  if (!bitmap || !state.faceLayer && !state.bodyLayer) return;
  const canvas = elements.liveOverlay;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(3, Math.max(1, devicePixelRatio || 1));
  const targetWidth = Math.max(1, Math.round(rect.width * dpr));
  const targetHeight = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== targetWidth) canvas.width = targetWidth;
  if (canvas.height !== targetHeight) canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  const scale = Math.max(targetWidth / bitmap.width, targetHeight / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.clearRect(0, 0, targetWidth, targetHeight);
  context.drawImage(bitmap, (targetWidth - width) / 2, (targetHeight - height) / 2, width, height);
}

function clearCanvas(canvas) {
  try { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); } catch {}
}

function dbfs(rms) {
  return 20 * Math.log10(Math.max(Number(rms) || 0, 1e-8));
}

function handleDiagnostic(detail = {}) {
  const at = Number.isFinite(detail.atMs) ? detail.atMs : sessionMs();
  if (detail.modality === 'audio' && detail.available) {
    const level = dbfs(detail.rms);
    state.latest.audioDbfs = level;
    state.latest.peak = Number(detail.peak) || 0;
    state.latest.clipping = Number(detail.clippedFraction) || 0;
    state.latest.speaking = Boolean(detail.speaking);
    state.latest.pauseMs = Number(detail.pauseInProgressMs) || 0;
    if (state.priorSpeech !== state.latest.speaking) {
      addEvent(state.latest.speaking ? 'SPEECH' : 'SILENCE', at, state.latest.speaking ? 'Detected speech activity' : 'Detected silence', 'EXPERIMENTAL', { durationMs: 700 });
      state.priorSpeech = state.latest.speaking;
    }
    if (state.latest.pauseMs >= 1_000 && state.latest.pauseMs < 1_180) addEvent('PAUSE', at - state.latest.pauseMs, 'Silence between detected speech · purpose not inferred', 'EXPERIMENTAL', { endMs: at });
    if (at - state.lastLevelEventAt >= 500) {
      addEvent('LEVEL', at, `${level.toFixed(1)} dBFS`, 'REAL NOW', { durationMs: 110 });
      state.lastLevelEventAt = at;
    }
  }
  if (detail.modality === 'vision') {
    const geometry = detail.geometry || null;
    state.latest.pipelineMs = Number.isFinite(detail.inferenceMs) ? detail.inferenceMs : null;
    state.latest.targetFps = Number.isFinite(detail.targetFps) ? detail.targetFps : null;
    state.latest.droppedFrames = Number(detail.droppedFrames) || 0;
    state.latest.overlayStatus = detail.overlayStatus || (detail.overlayRendered ? 'rendered' : 'unavailable');
    state.latest.faceCount = Number.isFinite(geometry?.faceCount) ? geometry.faceCount : null;
    state.latest.facePresent = geometry?.face?.present ?? null;
    state.latest.torsoPresent = geometry?.pose?.torsoPresent ?? null;
    state.latest.leftHand = geometry?.hands?.left?.present ?? null;
    state.latest.rightHand = geometry?.hands?.right?.present ?? null;
    state.latest.yaw = Number.isFinite(geometry?.face?.yawProxyDeg) ? geometry.face.yawProxyDeg : null;
    state.latest.pitch = Number.isFinite(geometry?.face?.pitchProxyDeg) ? geometry.face.pitchProxyDeg : null;
    state.latest.roll = Number.isFinite(geometry?.face?.rollProxyDeg) ? geometry.face.rollProxyDeg : null;
    const box = geometry?.face?.box;
    state.latest.framingCentered = box ? box.centerX >= .3 && box.centerX <= .7 && box.centerY >= .2 && box.centerY <= .65 && box.width >= .12 : null;

    if (state.priorFace !== state.latest.facePresent) {
      addEvent('FACE', at, state.latest.facePresent ? 'Face tracked' : 'Face unavailable', 'EXPERIMENTAL', { durationMs: 700 });
      state.priorFace = state.latest.facePresent;
    }
    if (state.priorTorso !== state.latest.torsoPresent) {
      addEvent('POSTURE / FRAMING', at, state.latest.torsoPresent ? 'Torso proxy available' : 'Torso proxy unavailable', 'EXPERIMENTAL', { durationMs: 700 });
      state.priorTorso = state.latest.torsoPresent;
    }
    const hands = `${state.latest.leftHand ? 'L' : ''}${state.latest.rightHand ? 'R' : ''}` || 'NONE';
    if (state.priorHands !== hands) {
      addEvent('HANDS', at, `Hand visibility ${hands}`, 'EXPERIMENTAL', { durationMs: 700 });
      state.priorHands = hands;
    }
    if (state.priorFraming !== state.latest.framingCentered) {
      addEvent('POSTURE / FRAMING', at, state.latest.framingCentered ? 'Framing centered proxy' : 'Framing outside center guide', 'EXPERIMENTAL', { durationMs: 700 });
      state.priorFraming = state.latest.framingCentered;
    }
    if (state.latest.yaw !== null) addEvent('HEAD', at, `Head proxy ${state.latest.yaw.toFixed(1)}°`, 'EXPERIMENTAL', { durationMs: 100 });
  }
  updateCue(at);
  if (state.projection === 'telemetry') renderTelemetry();
}

function handlePipelineState(detail = {}) {
  const at = Number.isFinite(detail.atMs) ? detail.atMs : sessionMs();
  if (detail.state === 'vision-ready') state.latest.workerState = detail.multiFaceProtection ? 'vision + face guard ready' : 'vision ready';
  if (detail.state === 'privacy-guard') addEvent('SYSTEM', at, 'Worker blocked external analytics egress', 'SYSTEM', { durationMs: 500 });
  if (detail.state === 'partial') addEvent('SYSTEM', at, String(detail.message || detail.subsystem || 'Partial analytics'), 'SYSTEM', { durationMs: 900 });
  if (detail.state === 'complete') state.answerResult = detail.result || state.answerResult;
  if (state.projection === 'telemetry') renderTelemetry();
}

function cueForSignals() {
  const focus = new Set(state.focusProfile.map((item) => item.id));
  if (state.latest.faceCount !== null && state.latest.faceCount !== 1 && focus.has('framing')) return { id: 'face-guard', text: 'Keep one person in frame', maturity: 'EXPERIMENTAL', needle: 18 };
  if (state.latest.clipping > .005 && focus.has('audibility')) return { id: 'clip', text: 'Ease back from the mic', maturity: 'REAL NOW', needle: 92 };
  if (state.latest.framingCentered === false && focus.has('framing')) return { id: 'framing', text: 'Return to center', maturity: 'EXPERIMENTAL', needle: 28 };
  if (state.latest.audioDbfs !== null && state.latest.audioDbfs < -42 && focus.has('audibility')) return { id: 'quiet', text: 'Come closer to the mic', maturity: 'REAL NOW', needle: 22 };
  if (state.latest.pauseMs >= 3_000 && focus.has('pauses')) return { id: 'pause', text: 'Continue when ready', maturity: 'EXPERIMENTAL', needle: 50 };
  return { id: 'range', text: 'You’re in range', maturity: state.latest.audioDbfs === null ? 'WAITING FOR SIGNAL' : 'REAL NOW', needle: 50 };
}

function updateCue(at = sessionMs()) {
  const enabled = state.mode === 'live-coaching' && state.projection === 'coach';
  elements.tunerCue.hidden = !enabled;
  if (!enabled) return;
  const cue = cueForSignals();
  elements.cueText.textContent = cue.text;
  elements.cueMaturity.textContent = cue.maturity;
  elements.tunerNeedle.style.left = `${cue.needle}%`;
  if (cue.id !== state.priorCue) {
    addEvent('COACHING', at, cue.text, cue.maturity === 'REAL NOW' ? 'REAL NOW' : 'EXPERIMENTAL', { durationMs: 1_200, source: 'Local deterministic CueBus prototype' });
    state.priorCue = cue.id;
  }
}

function signalRow(label, maturity, value) {
  return `<div class="signal-row"><span>${label}<small>${maturity}</small></span><b>${value}</b></div>`;
}

function yesNo(value) {
  return value === null ? '—' : value ? 'YES' : 'NO';
}

function finite(value, suffix = '', places = 1) {
  return Number.isFinite(value) ? `${value.toFixed(places)}${suffix}` : '—';
}

function renderTelemetry() {
  const value = state.latest;
  elements.telemetrySession.textContent = `SESSION ${state.pipeline?.session?.sessionId?.slice(-8).toUpperCase() || '—'}`;
  elements.signalStack.innerHTML = [
    signalRow('Captured microphone level', 'REAL NOW · VALIDATED STUDENT-SAFE', finite(value.audioDbfs, ' dBFS')),
    signalRow('Peak amplitude', 'REAL NOW · DIGITAL CAPTURE', finite(value.peak, '', 3)),
    signalRow('Digital clipping', 'REAL NOW · VALIDATED STUDENT-SAFE', finite((value.clipping ?? NaN) * 100, '%', 2)),
    signalRow('Detected speech activity', 'EXPERIMENTAL · VAD NOT GROUND-TRUTHED', yesNo(value.speaking)),
    signalRow('Silence in progress', 'EXPERIMENTAL · PURPOSE NOT INFERRED', finite(value.pauseMs / 1_000, ' s')),
    signalRow('Face count guard', 'REAL DETECTOR · PERSON METRICS EXPERIMENTAL', value.faceCount ?? '—'),
    signalRow('Face tracked', 'EXPERIMENTAL', yesNo(value.facePresent)),
    signalRow('Torso proxy available', 'EXPERIMENTAL · NOT A POSTURE SCORE', yesNo(value.torsoPresent)),
    signalRow('Left / right hand', 'EXPERIMENTAL', `${yesNo(value.leftHand)} / ${yesNo(value.rightHand)}`),
    signalRow('Head yaw / pitch / roll', 'EXPERIMENTAL · CAMERA RELATIVE', `${finite(value.yaw, '°')} / ${finite(value.pitch, '°')} / ${finite(value.roll, '°')}`),
    signalRow('Framing centered proxy', 'EXPERIMENTAL', yesNo(value.framingCentered)),
    signalRow('Vision pipeline', 'REAL RUNTIME HEALTH', `${finite(value.pipelineMs, ' ms')} · ${value.targetFps ?? '—'} FPS`),
    signalRow('Overlay frame', 'REAL LOCAL RENDERER', String(value.overlayStatus || '—').toUpperCase()),
    signalRow('Worker state', 'REAL RUNTIME HEALTH', String(value.workerState || '—').toUpperCase()),
  ].join('');
}

function resetLiveEvidence() {
  state.events = [];
  state.markers = [];
  state.answerResult = null;
  state.latest = freshSignals();
  state.priorSpeech = null;
  state.priorFace = null;
  state.priorTorso = null;
  state.priorHands = null;
  state.priorFraming = null;
  state.priorCue = null;
  state.phase = 'OPEN';
  state.lastLevelEventAt = -Infinity;
  state.durationMs = 0;
  state.sampleMode = false;
}

async function prepareMedia() {
  if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Chrome requires a localhost secure context for camera and microphone access.');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  if (!stream.getVideoTracks().length || !stream.getAudioTracks().length) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error('Both a camera and a microphone are required for this Founder acceptance path.');
  }
  elements.liveVideo.srcObject = stream;
  await elements.liveVideo.play();
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio is unavailable in this browser.');
  const audioContext = new AudioContextClass();
  await audioContext.resume();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = .15;
  source.connect(analyser);
  return { stream, audioContext, source, analyser, data: new Float32Array(analyser.fftSize) };
}

function recorderMimeType() {
  if (!globalThis.MediaRecorder) return null;
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function startRecorder() {
  if (!state.keepReplay || !globalThis.MediaRecorder || !state.stream) return;
  try {
    const mimeType = recorderMimeType();
    state.recorderChunks = [];
    state.recorder = new MediaRecorder(state.stream, mimeType ? { mimeType } : undefined);
    state.recorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) state.recorderChunks.push(event.data);
    });
    state.recorder.start(500);
  } catch {
    state.keepReplay = false;
    state.recorder = null;
    toast('Replay unavailable in this browser; live analytics continue.');
  }
}

async function stopRecorder({ retain = true } = {}) {
  const recorder = state.recorder;
  if (!recorder) return null;
  if (recorder.state !== 'inactive') {
    await new Promise((resolve) => {
      const fallback = setTimeout(resolve, 1_500);
      recorder.addEventListener('stop', () => { clearTimeout(fallback); resolve(); }, { once: true });
      try { recorder.stop(); } catch { clearTimeout(fallback); resolve(); }
    });
  }
  const chunks = state.recorderChunks;
  state.cleanup.recorderState = recorder.state;
  state.recorder = null;
  if (!retain || !chunks.length) {
    state.recorderChunks = [];
    return null;
  }
  const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
  state.recorderChunks = [];
  return blob.size ? blob : null;
}

async function startSession() {
  if (state.status !== 'idle') return;
  state.status = 'starting';
  elements.startSession.disabled = true;
  elements.startSession.querySelector('span').textContent = 'Waiting for Chrome…';
  elements.errorSheet.hidden = true;
  resetLiveEvidence();
  state.keepReplay = elements.replayConsent.checked;
  try {
    const media = await prepareMedia();
    state.stream = media.stream;
    state.audioContext = media.audioContext;
    state.audioSource = media.source;
    state.analyser = media.analyser;
    state.bridge = {
      media: {
        stream: media.stream,
        cam: true,
        mic: true,
        AC: media.audioContext,
        analyser: media.analyser,
        data: media.data,
      },
    };
    state.pipeline = new BrowserAnalyticsPipeline({ bridge: state.bridge });
    state.pipeline.setInstrumentation({ overlayEnabled: state.faceLayer || state.bodyLayer, faceEnabled: state.faceLayer, bodyEnabled: state.bodyLayer });
    state.pipeline.setOverlayConsumer((payload) => {
      if (payload.bitmap) drawLiveBitmap(payload.bitmap);
      else clearCanvas(elements.liveOverlay);
    });
    state.pipeline.addEventListener('diagnostic', (event) => handleDiagnostic(event.detail || {}));
    state.pipeline.addEventListener('state', (event) => handlePipelineState(event.detail || {}));
    state.sessionStartedAt = performance.now();
    state.pipeline.beginAnswer({
      answerId: `q01-${Date.now().toString(36)}`,
      mediaId: state.keepReplay ? 'tab-memory-take' : null,
      mediaStartedAt: state.keepReplay ? state.sessionStartedAt : null,
      videoElement: elements.liveVideo,
    });
    state.pipelineGenerationAtStart = state.pipeline.generation;
    state.startCount += 1;
    state.status = 'running';
    addEvent('QUESTION', 0, 'Tell me about yourself · answer start', 'REAL NOW', { durationMs: 1_200, source: 'Local session clock' });
    addEvent('PHASE', 0, 'OPEN · sample strategy timing', 'SAMPLE/DEMO', { durationMs: 2_000, source: 'Local product-story clock' });
    startRecorder();
    elements.liveModeBadge.textContent = state.mode === 'simulation' ? 'SIMULATION · COACHING OFF' : 'LIVE COACHING · ONE CUE MAX';
    elements.tunerCue.hidden = state.mode !== 'live-coaching';
    elements.mentorMarker.hidden = state.role !== 'mentor';
    setProjection('coach');
    renderTelemetry();
    startClock();
    showScreen('live');
    elements.finishTake.focus();
  } catch (error) {
    await cleanupMedia({ eraseReplay: true, abandon: true });
    state.status = 'idle';
    elements.errorTitle.textContent = error?.name === 'NotAllowedError' ? 'Chrome did not grant both devices.' : 'Camera and microphone are still off.';
    elements.errorMessage.textContent = error?.name === 'NotAllowedError'
      ? 'Allow camera and microphone for this localhost page, then try again. No media was captured.'
      : String(error?.message || 'Check that both devices are available, then try again.').slice(0, 240);
    elements.errorSheet.hidden = false;
  } finally {
    elements.startSession.disabled = false;
    elements.startSession.querySelector('span').textContent = 'Connect camera + mic';
  }
}

async function cleanupMedia({ eraseReplay = false, abandon = false } = {}) {
  stopClock();
  if (state.pipeline) {
    try { if (abandon && state.pipeline.answer) state.pipeline.abandonAnswer('connection_failed'); } catch {}
    try { state.pipeline.destroy(); } catch {}
  }
  state.pipeline = null;
  try { state.audioSource?.disconnect?.(); } catch {}
  try { state.analyser?.disconnect?.(); } catch {}
  const tracks = state.stream?.getTracks?.() || [];
  for (const track of tracks) { try { track.stop(); } catch {} }
  state.cleanup.tracksEnded = tracks.map((track) => track.readyState === 'ended');
  state.cleanup.workersReleased = true;
  try { await state.audioContext?.close?.(); } catch {}
  state.cleanup.audioContextState = state.audioContext?.state || 'closed';
  elements.liveVideo.srcObject = null;
  state.stream = null;
  state.audioSource = null;
  state.analyser = null;
  state.audioContext = null;
  state.bridge = null;
  clearCanvas(elements.liveOverlay);
  if (eraseReplay) eraseReplayState();
}

function mergeSealedEvents(result) {
  if (!result?.events) return;
  for (const item of result.events) {
    const metric = item.metric || 'system';
    const track = metric.includes('pause') ? 'PAUSE'
      : metric.includes('speech') || metric.includes('response_start') ? 'SPEECH'
      : metric.includes('level') || metric.includes('clipping') || metric.includes('energy') ? 'LEVEL'
      : metric.includes('hand') || metric.includes('gesture') ? 'HANDS'
      : metric.includes('head') || metric.includes('camera_facing') ? 'HEAD'
      : metric.includes('face') ? 'FACE'
      : metric.includes('torso') || metric.includes('framing') || metric.includes('sway') || metric.includes('lean') ? 'POSTURE / FRAMING'
      : metric.includes('observation_gap') || metric.includes('multiple_faces') ? 'SYSTEM' : 'SYSTEM';
    const maturity = item.maturity === 'VALIDATED_STUDENT_SAFE' ? 'REAL NOW' : item.maturity === 'FOUNDER_EXPERIMENTAL' ? 'EXPERIMENTAL' : 'SYSTEM';
    addEvent(track, item.startMs, metric.replaceAll('_', ' '), maturity, { endMs: item.endMs, source: item.source?.engine || '3420R sealed event' });
  }
}

async function finishTake() {
  if (state.status !== 'running') return;
  state.status = 'finishing';
  elements.finishTake.disabled = true;
  const endAt = performance.now();
  state.durationMs = sessionMs();
  let result = null;
  try {
    state.pipeline?.prepareEnd(endAt);
    result = state.pipeline?.endAnswer({ transcript: '', mediaAvailable: state.keepReplay, endAt }) || null;
  } catch {
    addEvent('SYSTEM', state.durationMs, 'Final analytics envelope unavailable', 'SYSTEM', { durationMs: 500 });
  }
  const replayBlob = await stopRecorder({ retain: state.keepReplay });
  await cleanupMedia({ eraseReplay: false });
  state.answerResult = result;
  mergeSealedEvents(result);
  addEvent('QUESTION', state.durationMs, 'Answer end', 'REAL NOW', { durationMs: 400, source: 'Local session clock' });
  if (replayBlob) {
    eraseReplayState();
    state.replayUrl = URL.createObjectURL(replayBlob);
    state.cleanup.replayRetained = true;
  }
  state.status = 'replay';
  renderReplay();
  showScreen('replay');
  elements.finishTake.disabled = false;
  elements.spotlightMode.focus();
}

function eraseReplayState() {
  state.playbackOverlay?.destroy();
  state.playbackOverlay = null;
  elements.replayVideo.pause();
  elements.replayVideo.removeAttribute('src');
  elements.replayVideo.load();
  if (state.replayUrl) URL.revokeObjectURL(state.replayUrl);
  state.replayUrl = null;
  state.cleanup.replayRetained = false;
  clearCanvas(elements.replayOverlay);
}

function momentCandidates() {
  const priorities = ['MARKER', 'COACHING', 'PAUSE', 'POSTURE / FRAMING', 'HANDS', 'FACE', 'SYSTEM'];
  const values = [];
  for (const track of priorities) {
    for (const event of state.events.filter((item) => item.track === track)) {
      if (!values.some((item) => Math.abs(item.atMs - event.atMs) < 1_000)) values.push(event);
      if (values.length >= 6) return values;
    }
  }
  return values.length ? values : state.events.slice(0, 4);
}

function renderReplay() {
  elements.sampleWatermark.hidden = !state.sampleMode;
  elements.noReplay.hidden = Boolean(state.replayUrl) || state.sampleMode;
  elements.replayVideo.hidden = !state.replayUrl;
  elements.addReplayMarker.hidden = state.role !== 'mentor';
  if (state.replayUrl) {
    elements.replayVideo.src = state.replayUrl;
    elements.replayVideo.load();
    elements.replayVideo.addEventListener('loadedmetadata', initializePlaybackOverlay, { once: true });
  } else {
    state.playbackOverlay?.destroy();
    state.playbackOverlay = null;
  }
  const moments = momentCandidates();
  elements.momentList.innerHTML = moments.map((item) => `<button class="moment-item" type="button" data-moment-id="${item.id}"><time>${formatTime(item.atMs)}</time><span><strong>${escapeHtml(item.label)}</strong><small>${item.maturity} · ${escapeHtml(item.track)}</small></span></button>`).join('') || '<p>No derived moments were retained.</p>';
  renderFlightRecorder();
}

function initializePlaybackOverlay() {
  state.playbackOverlay?.destroy();
  state.playbackOverlay = new LocalPlaybackOverlayRuntime({
    video: elements.replayVideo,
    canvas: elements.replayOverlay,
    onState: (detail) => {
      if (detail.state === 'failed') toast('Replay overlay unavailable; original media remains intact.');
    },
  });
  state.playbackOverlay.setLayers({ overlayEnabled: state.replayFaceLayer || state.replayBodyLayer, faceEnabled: state.replayFaceLayer, bodyEnabled: state.replayBodyLayer });
  state.playbackOverlay.start();
}

function renderFlightRecorder() {
  const duration = Math.max(1_000, state.durationMs || SAMPLE_DURATION_MS);
  const rulerPoints = 5;
  elements.timeRuler.innerHTML = Array.from({ length: rulerPoints }, (_, index) => `<span>${formatTime(duration * index / (rulerPoints - 1))}</span>`).join('');
  elements.flightTracks.innerHTML = TRACKS.map((track) => {
    const events = state.events.filter((item) => item.track === track);
    const buttons = events.map((item) => {
      return `<button class="track-event" type="button" data-moment-id="${item.id}" data-maturity="${item.maturity}" aria-label="${escapeHtml(`${formatTime(item.atMs)} ${item.label} ${item.maturity}`)}"></button>`;
    }).join('');
    return `<div class="flight-track"><span class="track-label">${track}</span><div class="track-lane">${buttons}</div></div>`;
  }).join('');
  // Apply geometry through the DOM API so the strict no-inline-style CSP remains intact.
  for (const button of elements.flightTracks.querySelectorAll('.track-event')) {
    const item = state.events.find((event) => event.id === button.dataset.momentId);
    if (!item) continue;
    const left = Math.min(99.3, Math.max(0, item.atMs / duration * 100));
    const width = Math.min(100 - left, Math.max(.7, (item.endMs - item.atMs) / duration * 100));
    button.style.left = `${left.toFixed(3)}%`;
    button.style.width = `${width.toFixed(3)}%`;
  }
}

function seekMoment(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  if (state.replayUrl && Number.isFinite(elements.replayVideo.duration)) elements.replayVideo.currentTime = Math.min(elements.replayVideo.duration, event.atMs / 1_000);
  elements.crumbPhase.textContent = phaseFor(event.atMs);
  elements.crumbMoment.textContent = `${formatTime(event.atMs)} · ${event.label.toUpperCase()}`;
  toast(`${formatTime(event.atMs)} · ${event.label}`);
}

function dropMarker(tag = 'FIX-FIRST') {
  if (!['running', 'replay'].includes(state.status)) return;
  const at = state.status === 'running' ? sessionMs() : state.replayUrl ? elements.replayVideo.currentTime * 1_000 : state.durationMs / 2;
  const event = addEvent('MARKER', at, `Dr Brian · ${tag}`, 'REAL NOW', { durationMs: 500, source: 'Mentor annotation' });
  state.markers.push(event);
  toast(`Marker dropped at ${formatTime(at)} · ${tag}`);
  if (state.status === 'replay') renderReplay();
}

function loadSampleReplay() {
  if (state.status !== 'idle') return;
  resetLiveEvidence();
  state.sampleMode = true;
  state.durationMs = SAMPLE_DURATION_MS;
  const sample = [
    ['QUESTION', 0, 92_000, 'Tell me about yourself', 'SAMPLE/DEMO'],
    ['PHASE', 0, 15_000, 'OPEN · sample timing', 'SAMPLE/DEMO'],
    ['PHASE', 15_000, 42_000, 'PROVE · sample timing', 'SAMPLE/DEMO'],
    ['PHASE', 42_000, 70_000, 'STORY · sample timing', 'SAMPLE/DEMO'],
    ['PHASE', 70_000, 92_000, 'CLOSE · sample timing', 'SAMPLE/DEMO'],
    ['SPEECH', 2_200, 18_000, 'Sample speech-active span', 'SAMPLE/DEMO'],
    ['PAUSE', 18_000, 21_800, 'Sample silence · purpose not inferred', 'SAMPLE/DEMO'],
    ['LEVEL', 26_000, 26_500, 'Sample captured level', 'SAMPLE/DEMO'],
    ['FACE', 0, 92_000, 'Sample face availability', 'SAMPLE/DEMO'],
    ['HANDS', 47_000, 53_000, 'Sample two-hand gesture', 'SAMPLE/DEMO'],
    ['POSTURE / FRAMING', 62_000, 69_000, 'Sample framing outside center guide', 'SAMPLE/DEMO'],
    ['COACHING', 64_000, 70_000, 'Sample cue · Return to center', 'SAMPLE/DEMO'],
    ['MARKER', 71_500, 72_000, 'Dr Brian · STRONG-MOMENT', 'SAMPLE/DEMO'],
  ];
  for (const [track, start, end, label, maturity] of sample) addEvent(track, start, label, maturity, { endMs: end, source: 'Explicit SAMPLE/DEMO story' });
  state.status = 'replay';
  renderReplay();
  showScreen('replay');
}

async function endAndErase() {
  if (state.status === 'running' || state.status === 'finishing') {
    try { await stopRecorder({ retain: false }); } catch {}
    await cleanupMedia({ eraseReplay: true, abandon: true });
  } else {
    eraseReplayState();
  }
  resetLiveEvidence();
  state.status = 'idle';
  elements.replayScreen.classList.remove('is-spotlight');
  elements.spotlightMode.textContent = 'Spotlight';
  showScreen('ready');
  elements.startSession.focus();
  toast('Lab erased · camera, microphone, workers, replay, and local evidence released');
}

function compileProfile() {
  const text = elements.directorPrompt.value.toLowerCase();
  const definitions = [
    { id: 'audibility', label: 'Audibility', maturity: 'REAL NOW', terms: ['audib', 'volume', 'mic', 'level', 'clipping'] },
    { id: 'framing', label: 'Framing', maturity: 'EXPERIMENTAL', terms: ['fram', 'camera', 'center', 'face'] },
    { id: 'hands', label: 'Hand visibility', maturity: 'EXPERIMENTAL', terms: ['hand', 'gesture'] },
    { id: 'pauses', label: 'Silence / pause', maturity: 'EXPERIMENTAL', terms: ['pause', 'silence', 'reset'] },
  ];
  const excluded = (definition) => definition.terms.some((term) => new RegExp(`(?:ignore|exclude|no)\\s+(?:\\w+\\s+){0,2}${term}`).test(text));
  let profile = definitions.filter((definition) => definition.terms.some((term) => text.includes(term)) && !excluded(definition));
  if (!profile.length) profile = [definitions[0]];
  state.draftProfile = Object.freeze(profile.map(({ terms, ...item }) => Object.freeze(item)));
  elements.profilePreview.innerHTML = state.draftProfile.map((item) => `<div class="profile-row"><span>${item.label}</span><b>${item.maturity}</b></div>`).join('') + '<div class="profile-row"><span>Pace / WPM</span><b>NOT ACTIVE · TRANSCRIPT REQUIRED</b></div>';
  elements.confirmProfile.disabled = false;
}

function confirmProfile() {
  if (!state.draftProfile) return;
  state.focusProfile = state.draftProfile;
  elements.confirmProfile.disabled = true;
  elements.confirmProfile.querySelector('span').textContent = 'Profile confirmed';
  toast(`Focus confirmed · ${state.focusProfile.map((item) => item.label).join(' + ')}`);
  setTimeout(() => closeDirector(), 500);
}

function openDirector() {
  elements.directorPanel.hidden = false;
  elements.openDirector.setAttribute('aria-expanded', 'true');
  elements.directorPrompt.focus();
}

function closeDirector() {
  elements.directorPanel.hidden = true;
  elements.openDirector.setAttribute('aria-expanded', 'false');
  elements.openDirector.focus();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
}

function debugSnapshot() {
  return Object.freeze({
    status: state.status,
    role: state.role,
    mode: state.mode,
    projection: state.projection,
    sessionId: state.pipeline?.session?.sessionId || state.answerResult?.sessionId || null,
    startCount: state.startCount,
    pipelineGenerationAtStart: state.pipelineGenerationAtStart,
    currentPipelineGeneration: state.pipeline?.generation ?? null,
    faceLayer: state.faceLayer,
    bodyLayer: state.bodyLayer,
    eventCount: state.events.length,
    sampleMode: state.sampleMode,
    tracks: state.stream?.getTracks?.().map((track) => ({ kind: track.kind, readyState: track.readyState })) || [],
    audioContextState: state.audioContext?.state || state.cleanup.audioContextState,
    workerCount: state.pipeline ? Number(Boolean(state.pipeline.worker)) + Number(Boolean(state.pipeline.faceWorker)) : 0,
    recorderState: state.recorder?.state || state.cleanup.recorderState,
    replayRetained: Boolean(state.replayUrl),
    rawMediaPersisted: false,
    rawGeometryPersisted: false,
    externalAnalyticsCalls: false,
  });
}

for (const button of document.querySelectorAll('[data-role-choice]')) button.addEventListener('click', () => setRole(button.dataset.roleChoice));
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => setMode(button.dataset.mode));
for (const button of document.querySelectorAll('[data-projection-choice]')) button.addEventListener('click', () => setProjection(button.dataset.projectionChoice));
for (const button of document.querySelectorAll('[data-layer]')) button.addEventListener('click', () => setLayer(button.dataset.layer, button.getAttribute('aria-pressed') !== 'true'));
for (const button of document.querySelectorAll('[data-replay-layer]')) button.addEventListener('click', () => setReplayLayer(button.dataset.replayLayer, button.getAttribute('aria-pressed') !== 'true'));

elements.startSession.addEventListener('click', startSession);
elements.retrySession.addEventListener('click', startSession);
elements.dismissError.addEventListener('click', () => { elements.errorSheet.hidden = true; elements.startSession.focus(); });
elements.loadSample.addEventListener('click', loadSampleReplay);
elements.finishTake.addEventListener('click', finishTake);
elements.dropMarker.addEventListener('click', () => dropMarker('FIX-FIRST'));
elements.addReplayMarker.addEventListener('click', () => dropMarker('FIX-FIRST'));
elements.eraseSession.addEventListener('click', endAndErase);
elements.spotlightMode.addEventListener('click', () => {
  const active = elements.replayScreen.classList.toggle('is-spotlight');
  elements.spotlightMode.textContent = active ? 'Exit spotlight' : 'Spotlight';
});
elements.openDirector.addEventListener('click', openDirector);
elements.closeDirector.addEventListener('click', closeDirector);
elements.compileProfile.addEventListener('click', compileProfile);
elements.confirmProfile.addEventListener('click', confirmProfile);
elements.momentList.addEventListener('click', (event) => seekMoment(event.target.closest('[data-moment-id]')?.dataset.momentId));
elements.flightTracks.addEventListener('click', (event) => seekMoment(event.target.closest('[data-moment-id]')?.dataset.momentId));
document.querySelector('[data-seek-level="whole"]').addEventListener('click', () => { if (state.replayUrl) elements.replayVideo.currentTime = 0; elements.crumbMoment.textContent = 'WHOLE INTERVIEW'; });
document.querySelector('[data-seek-level="question"]').addEventListener('click', () => { if (state.replayUrl) elements.replayVideo.currentTime = 0; elements.crumbMoment.textContent = 'QUESTION 01'; });

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
  if (state.role === 'mentor' && event.key.toLowerCase() === 'm') { event.preventDefault(); dropMarker('FIX-FIRST'); }
  if (state.role === 'mentor' && event.key === '1') dropMarker('STRONG-MOMENT');
  if (state.role === 'mentor' && event.key === '2') dropMarker('FIX-FIRST');
  if (state.role === 'mentor' && event.key === '3') dropMarker('PAUSE-WON');
});

window.addEventListener('resize', () => {
  if (state.status === 'running') clearCanvas(elements.liveOverlay);
});
window.addEventListener('pagehide', () => {
  try { state.playbackOverlay?.destroy(); } catch {}
  try { state.pipeline?.destroy(); } catch {}
  try { state.recorder?.state !== 'inactive' && state.recorder?.stop(); } catch {}
  for (const track of state.stream?.getTracks?.() || []) { try { track.stop(); } catch {} }
  try { state.audioSource?.disconnect?.(); } catch {}
  try { state.audioContext?.close?.(); } catch {}
  if (state.replayUrl) URL.revokeObjectURL(state.replayUrl);
  state.events = [];
  state.markers = [];
});

Object.defineProperty(window, '__MM3466C_DEBUG__', { value: Object.freeze({ snapshot: debugSnapshot, loadSample: loadSampleReplay }), writable: false, configurable: false });
$('launchGate').hidden = true;
setRole('student');
setMode('simulation');
setProjection('coach');
renderTelemetry();
