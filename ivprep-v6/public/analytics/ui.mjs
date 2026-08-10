import { BrowserAnalyticsPipeline } from './browser-pipeline.mjs';
import { describeStudentEvent, formatDuration, persistentAnalyticsEnvelopes, studentResultProjection } from './results-projection.mjs';

const GUIDED_STEPS = Object.freeze([
  ['Baseline · 10 seconds', 'Sit as you normally would. Face the camera and hold still; keep your head and shoulders in frame.', 10],
  ['Natural speech · 25 seconds', 'Read or paraphrase: “I value careful listening, teamwork, and service.” Gesture as you normally would.', 25],
  ['Pause exercise · 15 seconds', 'Say one sentence, pause for 3–5 seconds, then continue. The system measures silence; it does not infer purpose.', 15],
  ['Gesture range · 20 seconds', 'Make one left-hand gesture, one right-hand gesture, then one two-hand gesture. Return both hands to rest.', 20],
  ['Posture + head · 20 seconds', 'Lean gently and return upright. Turn your head left, right, then face the camera.', 20],
  ['Facial movement · 10 seconds', 'Keep your head still. Smile once, relax, then raise your brows once. This checks movement only, never emotion.', 10],
  ['Delivery contrast + volume · 25 seconds', 'Read the same sentence slowly, then quickly; once quietly, then normally. This exercises captured delivery signals; WPM stays unavailable without an existing transcript.', 25],
]);

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
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

class FounderAnalyticsSurface {
  constructor({ root, pipeline, bridge }) {
    this.root = root;
    this.pipeline = pipeline;
    this.bridge = bridge;
    this.state = 'idle';
    this.stepIndex = 0;
    this.startedAt = null;
    this.timer = null;
    this.recorder = null;
    this.chunks = [];
    this.replayUrl = null;
    this.lastDiagnostic = {};
    this.connectEpoch = 0;
    this.runEpoch = 0;
    this.recorderEpoch = 0;
    this.ownsMedia = false;
    this.pipeline.addEventListener('diagnostic', (event) => {
      this.lastDiagnostic[event.detail.modality] = event.detail;
      this.renderDiagnostics();
    });
    this.pipeline.addEventListener('state', () => this.renderDiagnostics());
    this.render();
  }

  render() {
    this.root.replaceChildren();
    const grid = element('div', 'ca-grid');
    const media = element('div', 'ca-stack');
    const preview = element('video', 'ca-preview');
    preview.id = 'communication-analytics-preview';
    preview.autoplay = true;
    preview.muted = true;
    preview.playsInline = true;
    preview.setAttribute('aria-label', 'Local camera preview for communication analytics');
    media.append(preview);
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
    finish.addEventListener('click', () => this.finish());
    actions.append(connect, start, finish);
    media.append(actions);

    const controls = element('div', 'ca-stack');
    const replayLabel = element('label', 'ca-status');
    const replay = document.createElement('input');
    replay.type = 'checkbox';
    replay.id = 'communication-analytics-replay';
    replayLabel.append(replay, document.createTextNode(' Keep a local replay until this tab closes. Off by default.'));
    controls.append(replayLabel);
    const stepTitle = element('h2', 'pLbl', 'Guided test steps');
    controls.append(stepTitle);
    const steps = element('ol', 'ca-steps');
    steps.id = 'communication-analytics-steps';
    GUIDED_STEPS.forEach(([title, instruction]) => {
      const item = element('li');
      item.append(element('b', '', title), document.createTextNode(` — ${instruction}`));
      steps.append(item);
    });
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
    const diagnosticsLabel = element('label', 'ca-status');
    const diagnosticsToggle = document.createElement('input');
    diagnosticsToggle.type = 'checkbox';
    diagnosticsToggle.id = 'communication-analytics-show-diagnostics';
    diagnosticsToggle.addEventListener('change', () => this.renderDiagnostics());
    diagnosticsLabel.append(diagnosticsToggle, document.createTextNode(' Show live Founder diagnostics'));
    controls.append(diagnosticsLabel);
    const diagnostics = element('div', 'ca-diagnostics ca-hidden');
    diagnostics.id = 'communication-analytics-diagnostics';
    diagnostics.setAttribute('aria-live', 'off');
    controls.append(diagnostics);
    grid.append(media, controls);
    this.root.append(grid);
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
    const current = this.bridge.media;
    current.cam = Boolean(current.cam && current.stream?.getVideoTracks?.().some((track) => track.readyState === 'live'));
    current.mic = Boolean(current.mic && current.stream?.getAudioTracks?.().some((track) => track.readyState === 'live'));
    const preview = document.getElementById('communication-analytics-preview');
    if (preview && current.stream) preview.srcObject = current.stream;
    if (!current.cam && !current.mic) {
      this.setStatus('denied', 'Camera and microphone are blocked or unavailable. Nothing was measured. Use the browser permission control, then retry.');
      document.getElementById('communication-analytics-status')?.focus();
      if (connect) { connect.disabled = false; connect.textContent = 'Retry camera + mic'; }
      return;
    }
    const availability = `${current.cam ? 'CAMERA ACTIVE' : 'CAMERA UNAVAILABLE'} · ${current.mic ? 'MIC ACTIVE' : 'MIC UNAVAILABLE'}`;
    this.setStatus(current.cam && current.mic ? 'ready' : 'partial', `${availability}. Raw frames and audio are not sent by analytics.`);
    if (connect) connect.disabled = false;
    if (start) start.disabled = false;
  }

  start() {
    if (!['ready', 'partial'].includes(this.state)) return;
    this.pipeline.resetSession();
    this.lastDiagnostic = {};
    if (this.replayUrl) URL.revokeObjectURL(this.replayUrl);
    this.replayUrl = null;
    this.chunks = [];
    const runEpoch = ++this.runEpoch;
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
      this.setStatus('error', 'The local analytics session could not start. Nothing was retained.');
      return;
    }
    this.setStatus('running', 'Guided test running. No score is being created.');
    for (const id of ['communication-analytics-start', 'communication-analytics-connect']) document.getElementById(id)?.setAttribute('disabled', '');
    for (const id of ['communication-analytics-finish', 'communication-analytics-next', 'communication-analytics-skip']) document.getElementById(id)?.removeAttribute('disabled');
    this.renderStep();
    this.timer = setInterval(() => {
      this.renderStep();
      const elapsed = (performance.now() - this.startedAt) / 1_000;
      const stepEnd = GUIDED_STEPS.slice(0, this.stepIndex + 1).reduce((sum, step) => sum + step[2], 0);
      if (elapsed >= stepEnd) this.nextStep(false);
    }, 250);
  }

  nextStep(skipped) {
    if (this.state !== 'running') return;
    const item = document.querySelectorAll('#communication-analytics-steps li')[this.stepIndex];
    if (skipped && item) item.append(document.createTextNode(' · NOT EXERCISED'));
    this.stepIndex += 1;
    if (this.stepIndex >= GUIDED_STEPS.length) this.finish();
    else this.renderStep(true);
  }

  renderStep(announce = false) {
    document.querySelectorAll('#communication-analytics-steps li').forEach((item, index) => {
      if (index === this.stepIndex && this.state === 'running') item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    if (this.state === 'running') {
      const elapsed = (performance.now() - this.startedAt) / 1_000;
      const step = GUIDED_STEPS[this.stepIndex];
      this.setStatus('running', `${step[0]} · session ${elapsed.toFixed(1)}s. ${step[1]}`, { announce });
    }
  }

  async finish() {
    if (this.state !== 'running') return;
    const runEpoch = this.runEpoch;
    const endAt = performance.now();
    clearInterval(this.timer);
    this.timer = null;
    this.setStatus('finalizing', 'Finalizing synchronized evidence…');
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
    this.renderFounderResult(result);
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
    this.setStatus('complete', 'Test complete. No score was created.');
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
    pad.append(element('div', 'ca-privacy', `PRIVACY RECEIPT · analytics raw audio/frames/landmarks retained: NO · optional local replay: ${this.replayUrl ? 'YES — TAB MEMORY ONLY' : 'NO'} · external analytics egress: BLOCKED BY SAME-ORIGIN WORKER GUARD + CSP · visual inference p95: ${result?.performance?.visualInferenceP95Ms ?? 'UNRESOLVED'} ms`));
    if (this.replayUrl) {
      const replay = element('video', 'ca-preview');
      replay.id = 'communication-analytics-founder-replay';
      replay.controls = true;
      replay.src = this.replayUrl;
      pad.append(replay);
    }
    const actions = element('div', 'ca-actions');
    const again = element('button', 'btnGhost', 'Run another test');
    again.type = 'button';
    again.addEventListener('click', () => {
      if (this.replayUrl) URL.revokeObjectURL(this.replayUrl);
      this.replayUrl = null;this.chunks = [];this.lastDiagnostic = {};
      this.pipeline.resetSession();this.render();this.connect();
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
    this.pipeline.resetSession();
    this.state = 'idle';
    if (this.ownsMedia) this.bridge.stopMedia();
    this.ownsMedia = false;
    if (render) this.render();
  }

  onViewChange(view, role) {
    if (view === 'analytics-test' && role === 'admin') return;
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
  }

  renderDiagnostics() {
    const box = document.getElementById('communication-analytics-diagnostics');
    const toggle = document.getElementById('communication-analytics-show-diagnostics');
    if (!box || !toggle) return;
    box.classList.toggle('ca-hidden', !toggle.checked);
    if (!toggle.checked) return;
    const diagnostics = this.pipeline.diagnostics();
    const audio = this.lastDiagnostic.audio || {};
    const vision = this.lastDiagnostic.vision || {};
    box.textContent = [
      `Engine · active ${diagnostics.active} · vision ${diagnostics.workerReady ? 'READY' : 'WAITING/UNAVAILABLE'} · multi-face protection ${diagnostics.multiFaceProtection === true ? 'READY' : diagnostics.multiFaceProtection === false ? 'UNAVAILABLE — PERSON-SPECIFIC SIGNALS SUPPRESSED' : 'WAITING'} · target ${diagnostics.targetFps} FPS · dropped ${diagnostics.droppedFrames}`,
      `Voice · level ${Number.isFinite(audio.rms) ? (20 * Math.log10(Math.max(audio.rms, 1e-8))).toFixed(1) + ' dBFS' : 'UNAVAILABLE'} · clipping ${Number.isFinite(audio.clippedFraction) ? (audio.clippedFraction * 100).toFixed(1) + '%' : 'UNAVAILABLE'} · detected speech ${audio.speaking ?? 'UNAVAILABLE'} · silence in progress ${Number.isFinite(audio.pauseInProgressMs) ? (audio.pauseInProgressMs / 1000).toFixed(1) + 's' : 'UNAVAILABLE'} · WPM UNAVAILABLE WITHOUT VALIDATED TRANSCRIPT`,
      `Body · torso ${vision.geometry?.pose?.torsoPresent ?? 'UNAVAILABLE'} · lateral lean ${vision.geometry?.pose?.lateralLeanDeg ?? 'UNAVAILABLE'}° · left hand ${vision.geometry?.hands?.left?.present ?? 'UNAVAILABLE'} (${vision.geometry?.hands?.left?.zone ?? 'UNAVAILABLE'}) · right hand ${vision.geometry?.hands?.right?.present ?? 'UNAVAILABLE'} (${vision.geometry?.hands?.right?.zone ?? 'UNAVAILABLE'})`,
      `Face · present ${vision.geometry?.face?.present ?? 'UNAVAILABLE'} · head yaw/pitch/roll ${vision.geometry?.face?.yawProxyDeg ?? 'UNAVAILABLE'}/${vision.geometry?.face?.pitchProxyDeg ?? 'UNAVAILABLE'}/${vision.geometry?.face?.rollProxyDeg ?? 'UNAVAILABLE'}° · movement rate ${vision.geometry?.face?.movementRatePerSecond ?? 'UNAVAILABLE'} score-change/s · inference ${vision.inferenceMs ?? 'UNAVAILABLE'} ms`,
      `Reliability · audio windows ${diagnostics.audioFrameCount} · analyzable visual frames ${diagnostics.visualFrameCount} · ${diagnostics.workerErrors.length || diagnostics.multiFaceProtection === false ? 'LIMITED' : diagnostics.workerReady ? 'COLLECTING' : 'UNAVAILABLE'}`,
      `Privacy · ${diagnostics.networkPolicy}`,
    ].join('\n');
  }
}

export function initializeAnalyticsUi(bridge) {
  const pipeline = new BrowserAnalyticsPipeline({ bridge });
  const founderPipeline = new BrowserAnalyticsPipeline({ bridge });
  const root = document.getElementById('communication-analytics-test-root');
  const founder = root ? new FounderAnalyticsSurface({ root, pipeline: founderPipeline, bridge }) : null;
  const api = Object.freeze({
    beginAnswer: (options) => pipeline.beginAnswer(options),
    prepareEnd: (endAt) => pipeline.prepareEnd(endAt),
    endAnswer: (options) => pipeline.endAnswer(options),
    abandonAnswer: (reason) => pipeline.abandonAnswer(reason),
    renderStudentResults: renderStudentAnalytics,
    onViewChange: (view, role) => founder?.onViewChange(view, role),
    diagnostics: () => pipeline.diagnostics(),
    persistentEnvelopes: (value) => persistentAnalyticsEnvelopes(value),
    resetSession: () => pipeline.resetSession(),
    releaseRuntime: () => pipeline.resetSession(),
    destroy: () => { founder?.clear(); founderPipeline.destroy();pipeline.destroy(); },
  });
  window.addEventListener('pagehide', () => { founder?.clear({ render: false });founderPipeline.destroy();pipeline.destroy(); }, { once: true });
  return api;
}
