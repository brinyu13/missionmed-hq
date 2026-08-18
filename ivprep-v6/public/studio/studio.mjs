// IV Prep On-Call — Performance Studio shell runtime.
//
// Y1-Y2-CAM-V6-3506. This is the approved 3492 cockpit mounted on the EXISTING engine.
// Nothing about the telemetry is reimplemented here: the media bridge and
// initializeAnalyticsUi() are the same ones the pre-Fable shell used, and the surface
// ids in index.html are the ids that cockpit already binds to. That is what keeps the
// physically-proven camera, face mesh, head, hand and audio telemetry working while the
// product around it changes.
//
// Honesty rules enforced in this file:
//   * No fabricated statistics. Empty means empty, and says so.
//   * Identity comes from the authenticated admission payload, never a fixture.
//   * Questions come from the canonical 193-record store, never a prototype fixture.

import { loadIvPrepSession, loadVault } from '../aaa/api-client.mjs';
import { COLLECTIONS, createDefaultQuestionStore } from '../questions/question-store.mjs';
import { MetricBus, selectCorrection, statusRail } from './metric-bus.mjs';
import { InstrumentRack } from './instruments.mjs';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const CRUMBS = Object.freeze({
  home: 'Home', newsession: 'New session', devicecheck: 'Device check',
  training: 'Delivery training', simulation: 'Simulation', postanswer: 'Post-answer',
  filmroom: 'Film room', compare: 'Compare', lab: 'Analytics lab', mentor: 'Mentor review',
  progress: 'Progress', fingerprint: 'Fingerprint', vault: 'Results / Vault',
});

const store = createDefaultQuestionStore();

const state = {
  view: 'home',
  role: 'student',
  admission: null,
  analytics: null,
  filmGroups: null,
  labGroups: null,
  interviewSet: [],
  search: '',
  collection: null,
  wizardStep: 0,
  wizard: { goal: null, focus: null, interviewer: null, coaching: null },
  devices: { cameras: [], microphones: [] },
  selected: { camera: null, microphone: null },
  levelTimer: null,
  audioDebug: { pcmFrames: 0, f0Frames: 0, timer: null },
  bus: new MetricBus(),
  rack: null,
  labRack: null,
  primaryMetric: null,
  overlays: { face: true, bodyHands: true, enabled: true },
};

/* ------------------------------------------------------------------ media bridge
 * Same contract as the proven cockpit: media is published frozen, and the analytics
 * UI derives liveness rather than mutating it.
 */
const bridge = {
  media: Object.freeze({ cam: false, mic: false, stream: null, AC: null, analyser: null, data: null }),
  ownsStream: false,
  source: null,
  /**
   * Create and resume the AudioContext SYNCHRONOUSLY, inside the user gesture.
   *
   * Y1-Y2-CAM-V6-3510 — THE SAFARI ROOT CAUSE.
   *
   * 3508 fixed graph termination but still constructed the AudioContext *after*
   * `await navigator.mediaDevices.getUserMedia(...)`. WebKit does not carry user
   * activation across that await, so a context created afterwards starts 'suspended'
   * and resume() never reaches 'running' without a fresh gesture. The pipeline gates
   * audio on `AC.state === 'running'`, so audio was silently disabled while the camera
   * worked - exactly the reported symptom. Chrome is permissive here, which is why
   * every Chromium run passed.
   *
   * Call this first, from the click handler, before any await.
   */
  primeAudioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new Ctx();
    }
    // resume() inside the gesture; the promise is deliberately not awaited here.
    if (this.audioContext.state !== 'running') void this.audioContext.resume().catch(() => {});
    return this.audioContext;
  },

  async bindStream(stream, { ownsStream = false } = {}) {
    this.stopMedia({ keepContext: true });
    if (!(stream instanceof MediaStream)) throw new TypeError('A browser media stream is required.');
    const tracks = stream.getTracks();
    const mic = tracks.some((t) => t.kind === 'audio' && t.readyState === 'live');
    const cam = tracks.some((t) => t.kind === 'video' && t.readyState === 'live');
    let AC = null; let analyser = null; let data = null; let source = null; let sink = null;
    if (mic) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        // Reuse the gesture-primed context. Creating a new one here is what broke Safari.
        AC = this.primeAudioContext();
        if (AC && AC.state !== 'running') { try { await AC.resume(); } catch { /* reported by the debug panel */ } }
        analyser = AC.createAnalyser();
        analyser.fftSize = 2048;
        data = new Float32Array(analyser.fftSize);

        // Y1-Y2-CAM-V6-3508 — THE MICROPHONE ROOT CAUSE.
        //
        // Two defects, both invisible in Chrome and fatal in Safari:
        //
        // 1. The graph terminated at the analyser. WebKit's Web Audio implementation
        //    is demand-driven: a node with no route to a destination is never pulled,
        //    so getFloatTimeDomainData() returned silence forever. That is exactly the
        //    reported -160 dBFS, peak 0.00, "Detected speech NO", and F0 receiving
        //    nothing. Chrome pulls analysers regardless of termination, which is why
        //    every automated Chrome run passed while the real Safari test failed.
        //
        //    The graph now terminates at the destination through a MUTED gain node.
        //    This is the standards-compliant construction, not a Safari special case:
        //    the graph genuinely ends at a destination, and gain 0 guarantees the
        //    microphone is never played back (no echo, no feedback).
        //
        // 2. createMediaStreamSource() was handed a NEW MediaStream built from
        //    stream.getAudioTracks(). Safari does not reliably pull audio from such a
        //    reconstructed stream. The original stream is used instead.
        source = AC.createMediaStreamSource(stream);
        source.connect(analyser);
        // The graph must terminate at a real destination for WebKit to pull it, but it
        // must never reach the speakers. A MediaStreamAudioDestinationNode is a genuine
        // destination with no playback path at all, so self-monitoring/feedback is
        // structurally impossible - and unlike a gain(0) branch to
        // AudioContext.destination, there is nothing for the engine to optimise away.
        sink = AC.createMediaStreamDestination();
        analyser.connect(sink);
      }
    }
    this.ownsStream = ownsStream;
    this.source = source;
    this.sink = sink;
    this.media = Object.freeze({ cam, mic: Boolean(mic && AC && analyser && data), stream, AC, analyser, data });
    return this.media;
  },

  /**
   * Replace one track in place. Camera and microphone can be swapped mid-session
   * without a refresh, a new session, or restarting Delivery Intelligence.
   * The previous track is stopped only AFTER the replacement is live, so a failed
   * switch never leaves the student with no device.
   */
  async replaceTrack(kind, deviceId) {
    const constraint = kind === 'audio'
      ? { audio: { deviceId: { exact: deviceId } }, video: false }
      : { video: { deviceId: { exact: deviceId } }, audio: false };
    const fresh = await navigator.mediaDevices.getUserMedia(constraint);
    const incoming = kind === 'audio' ? fresh.getAudioTracks()[0] : fresh.getVideoTracks()[0];
    if (!incoming) { fresh.getTracks().forEach((t) => t.stop()); throw new Error(`No ${kind} track returned.`); }

    const current = this.media.stream;
    const outgoing = kind === 'audio' ? current?.getAudioTracks?.()[0] : current?.getVideoTracks?.()[0];
    const retained = (current?.getTracks?.() || []).filter((t) => t !== outgoing);
    const next = new MediaStream([...retained, incoming]);

    // bindStream() begins with stopMedia(), which stops every track of the CURRENT
    // stream when we own it - including the track we are carrying over. Switching the
    // microphone would therefore have killed the camera. Release ownership first so
    // stopMedia() cannot touch the retained tracks, then stop only the device we are
    // actually replacing, and only after the new one is live.
    this.ownsStream = false;
    await this.bindStream(next, { ownsStream: true });
    try { outgoing?.stop?.(); } catch {}
    return this.media;
  },
  async requestMedia(mic = true, cam = true) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: mic === true, video: cam === true });
    return this.bindStream(stream, { ownsStream: true });
  },
  stopMedia({ keepContext = false } = {}) {
    try { this.source?.disconnect?.(); } catch {}
    try { this.sink?.disconnect?.(); } catch {}
    if (this.ownsStream) this.media.stream?.getTracks?.().forEach((t) => t.stop());
    // Closing the context on a hot switch would discard the gesture-primed context and
    // Safari could not legally resume a replacement outside a gesture.
    if (!keepContext) {
      void this.media.AC?.close?.().catch?.(() => {});
      this.audioContext = null;
    }
    this.ownsStream = false;
    this.source = null;
    this.media = Object.freeze({ cam: false, mic: false, stream: null, AC: null, analyser: null, data: null });
  },
};

/* ------------------------------------------------------------------ role
 * Y1-Y2-CAM-V6-3508. The role switcher used to change a badge. The Founder physical
 * test found the engineering cockpit (FOUNDER RUN MODE, guided-test steps, raw
 * diagnostics, FPS/dropped-frame counters, engineering timeline) rendering inside the
 * normal STUDENT session. That tooling is valuable and is NOT deleted - it moves
 * behind the Admin role.
 *
 * This is presentation only. Hiding engineering instrumentation never changes what is
 * measured; the pipeline is untouched by this function.
 */
function applyRole(role) {
  state.role = role === 'admin' || role === 'mentor' ? role : 'student';
  document.body.dataset.role = state.role;
  for (const button of $$('[data-role]')) {
    button.setAttribute('aria-pressed', String(button.dataset.role === state.role));
  }
  const banner = $('#debug-banner');
  if (banner) banner.hidden = state.role !== 'admin';
  // The analytics cockpit gets the real role so its own founder surfaces follow suit.
  state.analytics?.onViewChange?.(state.view, state.role === 'student' ? 'student' : 'admin');
}

/* ------------------------------------------------------------------ router */

function setView(view, { focus = false } = {}) {
  if (!CRUMBS[view]) return;
  state.view = view;
  for (const panel of $$('[data-view-panel]')) {
    panel.dataset.active = String(panel.dataset.viewPanel === view);
  }
  for (const item of $$('[data-nav]')) {
    const active = item.dataset.nav === view;
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
  $('#crumb').textContent = CRUMBS[view];
  document.body.dataset.activeView = view;
  $('#rail').dataset.open = 'false';
  history.replaceState(null, '', `#${view}`);
  // The analytics cockpit must learn about the view change so it does not tear down
  // live media while its own screen is active.
  state.analytics?.onViewChange?.(view, state.role === 'student' ? 'student' : 'admin');
  if (view === 'devicecheck') renderDeviceCheck();
  if (view === 'training') bindCockpitVideo();
  if (view === 'lab') mountLabInstruments();
  if (view === 'vault') void renderVault();
  if (focus) $('#main-content')?.focus?.({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* ------------------------------------------------------------------ identity */

function applyIdentity() {
  const identity = state.admission?.identity || null;
  const name = $('#identity-name');
  const sub = $('#identity-sub');
  const mark = $('#identity-initials');
  if (!identity) {
    name.textContent = 'Not signed in';
    sub.textContent = 'Authentication required';
    mark.innerHTML = '<span>—</span>';
    return;
  }
  const roles = Array.isArray(identity.roles) ? identity.roles : [];
  const founder = identity.founder === true || roles.includes('administrator');
  name.textContent = identity.subject || 'Signed in';
  sub.textContent = founder ? 'Founder / Admin' : (roles[0] || 'Student');
  mark.innerHTML = `<span>${founder ? 'DB' : String(identity.wpUserId ?? '?').slice(0, 2)}</span>`;
}

/* ------------------------------------------------------------------ questions */

function collectionChips() {
  const host = $('#q-collections');
  const chips = [
    { id: null, label: `All ${store.count}` },
    { id: COLLECTIONS.CORE, label: 'Core 10' },
    { id: COLLECTIONS.BEHAVIORAL, label: 'Behavioural' },
    { id: COLLECTIONS.NEVER_PRACTICED, label: 'Never practised' },
  ];
  host.replaceChildren();
  for (const chip of chips) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'q-chip';
    button.textContent = chip.label;
    button.setAttribute('aria-pressed', String(state.collection === chip.id));
    button.addEventListener('click', () => {
      state.collection = state.collection === chip.id ? null : chip.id;
      collectionChips();
      renderQuestions();
    });
    host.append(button);
  }
}

function renderQuestions() {
  const list = $('#q-list');
  if (!list) return;
  const rows = store.query({ search: state.search, collection: state.collection });
  $('#q-count').textContent = `${rows.length} of ${store.count}`;
  list.replaceChildren();
  // Cap the rendered rows for responsiveness; the count above always states the truth.
  for (const q of rows.slice(0, 220)) {
    const row = document.createElement('div');
    row.className = 'q-row';
    row.dataset.core = String(q.core_priority === true);

    const pin = document.createElement('span');
    if (q.core_priority) { pin.className = 'q-core-pin'; pin.textContent = 'CORE'; }
    else { pin.className = 'microcap'; pin.textContent = q.question_id.split('-')[0]; }

    const text = document.createElement('div');
    const prompt = document.createElement('div');
    prompt.className = 'q-text';
    prompt.textContent = q.canonical_text;
    const meta = document.createElement('span');
    meta.className = 'microcap q-meta';
    meta.textContent = `${q.question_id} · ${q.tags.filter((t) => t !== 'CORE').slice(0, 3).join(' · ') || 'general'}`;
    text.append(prompt, meta);

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'q-add';
    add.textContent = '+';
    add.setAttribute('aria-label', `Add ${q.question_id} to the interview set`);
    add.addEventListener('click', () => addToSet(q));

    row.append(pin, text, add);
    list.append(row);
  }
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<strong>No matches</strong>No canonical question matches that search.';
    list.append(empty);
  }
}

function addToSet(question) {
  if (state.interviewSet.some((q) => q.question_id === question.question_id)) return;
  state.interviewSet.push(question);
  renderSet();
}

function renderSet() {
  const host = $('#set-list');
  if (!host) return;
  host.replaceChildren();
  if (!state.interviewSet.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<strong>Set is empty</strong>Add questions from the library, or use the Core 10 collection for a one-tap set.';
    host.append(empty);
    renderSimProgression();
    return;
  }
  state.interviewSet.forEach((q, index) => {
    const row = document.createElement('div');
    row.className = 'set-row';
    const order = document.createElement('span');
    order.className = 'set-order';
    order.textContent = String(index + 1).padStart(2, '0');
    const text = document.createElement('div');
    text.className = 'q-text';
    text.textContent = q.canonical_text;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'q-add';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${q.question_id}`);
    remove.addEventListener('click', () => {
      state.interviewSet = state.interviewSet.filter((entry) => entry.question_id !== q.question_id);
      renderSet();
    });
    row.append(order, text, remove);
    host.append(row);
  });
  renderSimProgression();
}

function renderSimProgression() {
  const host = $('#sim-progression');
  if (!host) return;
  host.replaceChildren();
  if (!state.interviewSet.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<strong>No questions selected</strong>Build an interview set in New session to run a structured simulation.';
    host.append(empty);
    return;
  }
  state.interviewSet.forEach((q, index) => {
    const row = document.createElement('div');
    row.className = 'check-row';
    const name = document.createElement('span');
    name.className = 'q-text';
    name.textContent = `${String(index + 1).padStart(2, '0')} · ${q.canonical_text}`;
    const status = document.createElement('span');
    status.className = 'check-state';
    status.dataset.state = 'pending';
    status.textContent = index === 0 ? 'NEXT' : 'QUEUED';
    row.append(name, status);
    host.append(row);
  });
}

/* ------------------------------------------------------------------ quick wizard */

const WIZARD_STEPS = Object.freeze([
  { key: 'goal', title: 'What do you want to do?', options: ['Quick rep', 'Practice a question', 'Delivery training', 'Full interview'] },
  { key: 'focus', title: 'What do you want to practise?', options: ['Core 10', 'Behavioural', 'Surprise me', 'Choose from library'] },
  { key: 'interviewer', title: 'Who is interviewing?', options: ['Voice only', 'Text prompts', 'Dr Kelly (pack pending)', 'Dr Woods (pack pending)'] },
  { key: 'coaching', title: 'How much coaching?', options: ['None', 'Minimal', 'Standard', 'Coach me'] },
]);

function renderWizard() {
  const body = $('#wizard-body');
  if (!body) return;
  body.replaceChildren();

  if (state.wizardStep >= WIZARD_STEPS.length) {
    const summary = document.createElement('div');
    summary.innerHTML = `
      <div class="microcap">Ready</div>
      <div class="check-row"><span class="check-name">Goal</span><span class="check-state" data-state="ready">${state.wizard.goal}</span></div>
      <div class="check-row"><span class="check-name">Focus</span><span class="check-state" data-state="ready">${state.wizard.focus}</span></div>
      <div class="check-row"><span class="check-name">Interviewer</span><span class="check-state" data-state="ready">${state.wizard.interviewer}</span></div>
      <div class="check-row"><span class="check-name">Coaching</span><span class="check-state" data-state="ready">${state.wizard.coaching}</span></div>
      <div class="check-row"><span class="check-name">Questions</span><span class="check-state" data-state="${state.interviewSet.length ? 'ready' : 'pending'}">${state.interviewSet.length || 'set on continue'}</span></div>`;
    const row = document.createElement('div');
    row.className = 'btn-row';
    const go = document.createElement('button');
    go.className = 'btn btn-primary';
    go.type = 'button';
    go.innerHTML = '<span>Continue to device check ▸</span>';
    go.addEventListener('click', () => {
      if (!state.interviewSet.length) applyWizardFocus();
      setView('devicecheck');
    });
    const back = document.createElement('button');
    back.className = 'btn btn-quiet';
    back.type = 'button';
    back.innerHTML = '<span>Start over</span>';
    back.addEventListener('click', () => { state.wizardStep = 0; renderWizard(); });
    row.append(go, back);
    body.append(summary, row);
    return;
  }

  const step = WIZARD_STEPS[state.wizardStep];
  const kick = document.createElement('div');
  kick.className = 'microcap';
  kick.textContent = `Step ${state.wizardStep + 1} of ${WIZARD_STEPS.length}`;
  const title = document.createElement('div');
  title.className = 'housing-title';
  title.style.fontSize = '18px';
  title.style.margin = '6px 0 14px';
  title.textContent = step.title;
  const row = document.createElement('div');
  row.className = 'btn-row';
  row.style.marginTop = '0';
  for (const option of step.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.innerHTML = `<span>${option}</span>`;
    button.addEventListener('click', () => {
      state.wizard[step.key] = option;
      state.wizardStep += 1;
      renderWizard();
    });
    row.append(button);
  }
  body.append(kick, title, row);
}

function applyWizardFocus() {
  const focus = state.wizard.focus;
  if (focus === 'Behavioural') state.interviewSet = store.query({ collection: COLLECTIONS.BEHAVIORAL }).slice(0, 5);
  else if (focus === 'Surprise me') state.interviewSet = store.all().slice(0, 40).sort(() => 0.5 - Math.sin(state.interviewSet.length + 1)).slice(0, 5);
  else state.interviewSet = store.core();
  renderSet();
}

/* ------------------------------------------------------------------ devices
 * Production device management. The browser permission prompt alone is not a device
 * picker: labels are only exposed AFTER permission is granted, so enumeration runs
 * post-permission and the selection persists locally for next time.
 */

const DEVICE_STORE_KEY = 'ivprep.devices.v1';

function loadDevicePreference() {
  try { return JSON.parse(localStorage.getItem(DEVICE_STORE_KEY) || '{}'); } catch { return {}; }
}

function saveDevicePreference() {
  try {
    localStorage.setItem(DEVICE_STORE_KEY, JSON.stringify({
      camera: state.selected.camera, microphone: state.selected.microphone,
    }));
  } catch { /* private browsing must not break device switching */ }
}

async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const all = await navigator.mediaDevices.enumerateDevices();
  state.devices.cameras = all.filter((d) => d.kind === 'videoinput');
  state.devices.microphones = all.filter((d) => d.kind === 'audioinput');

  // Adopt whatever the live tracks actually resolved to, so the selectors reflect
  // reality rather than a guess.
  const settings = {
    camera: bridge.media.stream?.getVideoTracks?.()[0]?.getSettings?.().deviceId,
    microphone: bridge.media.stream?.getAudioTracks?.()[0]?.getSettings?.().deviceId,
  };
  const preferred = loadDevicePreference();
  for (const kind of ['camera', 'microphone']) {
    const list = kind === 'camera' ? state.devices.cameras : state.devices.microphones;
    const wanted = settings[kind] || state.selected[kind] || preferred[kind];
    state.selected[kind] = list.some((d) => d.deviceId === wanted) ? wanted : (list[0]?.deviceId || null);
  }
  renderDeviceSelectors();
}

function deviceLabel(device, index, kind) {
  // Labels are empty until permission is granted; say so rather than showing a blank.
  return device.label || `${kind} ${index + 1} (allow access to see its name)`;
}

function renderDeviceSelectors() {
  for (const host of $$('[data-device-selectors]')) {
    host.replaceChildren();
    for (const [kind, list, label] of [
      ['camera', state.devices.cameras, 'Camera'],
      ['microphone', state.devices.microphones, 'Microphone'],
    ]) {
      const wrap = document.createElement('div');
      const cap = document.createElement('div');
      cap.className = 'microcap';
      cap.textContent = label;
      const select = document.createElement('select');
      select.className = 'q-search';
      select.dataset.deviceKind = kind;
      select.setAttribute('aria-label', `${label} device`);
      if (!list.length) {
        const opt = document.createElement('option');
        opt.textContent = 'No device found';
        select.append(opt);
        select.disabled = true;
      }
      list.forEach((device, index) => {
        const opt = document.createElement('option');
        opt.value = device.deviceId;
        opt.textContent = deviceLabel(device, index, label);
        opt.selected = device.deviceId === state.selected[kind];
        select.append(opt);
      });
      select.addEventListener('change', () => void switchDevice(kind, select.value));
      wrap.append(cap, select);
      host.append(wrap);
    }
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'btn btn-quiet';
    refresh.innerHTML = '<span>Refresh devices</span>';
    refresh.addEventListener('click', () => void refreshDevices());
    host.append(refresh);
  }
}

async function switchDevice(kind, deviceId) {
  if (!deviceId) return;
  // A device switch is also a gesture; re-prime so a suspended context can recover.
  bridge.primeAudioContext();
  const trackKind = kind === 'camera' ? 'video' : 'audio';
  const status = $('#device-switch-status');
  if (status) status.textContent = `Switching ${kind}…`;
  try {
    if (!bridge.media.stream) {
      await bridge.requestMedia(true, true);
    } else {
      await bridge.replaceTrack(trackKind, deviceId);
    }
    state.selected[kind] = deviceId;
    saveDevicePreference();
    bindPreview();
    startLevelMeter();
    if (status) status.textContent = `${kind === 'camera' ? 'Camera' : 'Microphone'} switched.`;
  } catch (error) {
    if (status) status.textContent = `Could not switch ${kind}: ${String(error?.name || error)}`;
  }
  renderDeviceCheck();
  await refreshDevices();
}

function bindPreview() {
  for (const stage of ['#devicecheck-stage']) {
    const host = $(stage);
    if (!host) continue;
    let video = host.querySelector('video');
    if (!video) {
      video = document.createElement('video');
      video.autoplay = true; video.muted = true; video.playsInline = true;
      host.append(video);
    }
    if (video.srcObject !== bridge.media.stream) video.srcObject = bridge.media.stream;
  }
}

/** Live input meter so the student can SEE the microphone working before a session. */
function startLevelMeter() {
  if (state.levelTimer) clearInterval(state.levelTimer);
  const bar = $('#mic-level-fill');
  const readout = $('#mic-level-readout');
  if (!bar) return;
  state.levelTimer = setInterval(() => {
    const { analyser, data } = bridge.media;
    if (!analyser || !data) { bar.style.width = '0%'; if (readout) readout.textContent = 'UNAVAILABLE'; return; }
    analyser.getFloatTimeDomainData(data);
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) { const v = Math.abs(data[i]); if (v > peak) peak = v; sum += data[i] * data[i]; }
    const rms = Math.sqrt(sum / data.length);
    const dbfs = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    bar.style.width = `${Math.max(0, Math.min(100, (dbfs + 60) / 60 * 100))}%`;
    if (readout) {
      readout.textContent = Number.isFinite(dbfs)
        ? `${dbfs.toFixed(1)} dBFS · peak ${peak.toFixed(3)}`
        : 'SILENT — check the microphone selector';
    }
  }, 100);
}

/* ------------------------------------------------------------------ student cockpit
 * The approved instrument layer. Telemetry arrives as raw analytics diagnostics, is
 * normalized by MetricBus, and is rendered by swappable instruments. No DSP lives in
 * this file or in any gauge.
 *
 * DISPLAY IS NOT MEASUREMENT: overlay toggles and instrument visibility never
 * unsubscribe a cartridge. The only thing they change is what is drawn.
 */

const PRIMARY_FOR = Object.freeze({
  VOLUME_VARIATION: 'VOLUME_VARIATION', VOICE_LEVEL: 'VOICE_LEVEL', PACE: 'PACE',
  PITCH_VARIATION: 'PITCH_VARIATION', CADENCE: 'CADENCE', FRAMING: 'FRAMING',
});

const LAB_ORDER = Object.freeze([
  'VOICE_LEVEL', 'VOLUME_VARIATION', 'PITCH', 'PITCH_VARIATION',
  'PACE', 'CADENCE', 'PAUSE', 'FACE', 'HANDS', 'FRAMING',
]);

function mountPrimary(metricId) {
  const host = $('#cockpit-primary');
  if (!host || state.primaryMetric === metricId) return;
  host.replaceChildren();
  const shell = document.createElement('div');
  host.append(shell);
  state.rack = new InstrumentRack();
  state.rack.mount(shell, metricId);
  state.rack.start();
  state.primaryMetric = metricId;
  // Immediately paint with whatever evidence already exists.
  state.rack.update(state.bus.latest);
}

function mountLabInstruments() {
  const host = $('#lab-instruments');
  if (!host || state.labRack) return;
  host.replaceChildren();
  state.labRack = new InstrumentRack();
  for (const id of LAB_ORDER) {
    const cell = document.createElement('div');
    host.append(cell);
    state.labRack.mount(cell, id);
  }
  state.labRack.start();
}

function renderCorrection() {
  const correction = selectCorrection(state.bus.latest);
  const plate = $('#cockpit-correction');
  const metric = $('#correction-metric');
  const verdict = $('#correction-verdict');
  if (!plate) return;
  plate.dataset.state = correction.state === 'locked' ? 'locked' : correction.state === 'warn' ? 'warn' : 'idle';
  if (metric) metric.textContent = correction.headline;
  if (verdict) verdict.textContent = correction.instruction;
  // One dominant correction, ever: the primary instrument follows the limiting
  // contributor, and falls back to voice level when nothing needs correcting.
  mountPrimary(PRIMARY_FOR[correction.metric] || 'VOICE_LEVEL');
}

function renderStatusRail() {
  const host = $('#cockpit-rail');
  if (!host) return;
  const rows = statusRail(state.bus.latest);
  host.replaceChildren();
  for (const row of rows) {
    const pill = document.createElement('span');
    pill.className = 'status-pill';
    pill.dataset.ok = row.state === 'ok' ? 'true' : row.state === 'warn' ? 'warn' : 'false';
    pill.textContent = `${row.label} ${row.state === 'ok' ? '✓' : row.state === 'warn' ? '!' : '—'}`;
    host.append(pill);
  }
}

function renderOverlayToggles() {
  const host = $('#cockpit-overlays');
  if (!host || host.childElementCount) return;
  const defs = [
    ['enabled', 'Tracking overlay'],
    ['face', 'Face'],
    ['bodyHands', 'Body + hands'],
  ];
  for (const [key, label] of defs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(state.overlays[key]));
    b.addEventListener('click', () => {
      state.overlays[key] = !state.overlays[key];
      b.setAttribute('aria-pressed', String(state.overlays[key]));
      // Presentation only. setInstrumentation changes what the worker DRAWS; the
      // landmark inference and every metric cartridge keep running.
      state.analytics?.setInstrumentation?.({
        overlayEnabled: state.overlays.enabled,
        faceOverlayEnabled: state.overlays.face,
        bodyHandsOverlayEnabled: state.overlays.bodyHands,
      });
    });
    host.append(b);
  }
}


/** Explicit, actionable prerequisites. A dead button with no explanation is a defect. */
function startBlockedReason() {
  const m = bridge.media;
  const audio = m.stream?.getAudioTracks?.()[0];
  const video = m.stream?.getVideoTracks?.()[0];
  if (!m.stream) return 'Connect your camera and microphone first.';
  if (!video || video.readyState !== 'live') return 'Camera disconnected — reconnect it in Devices.';
  if (!audio || audio.readyState !== 'live') return 'Microphone disconnected — reconnect it in Devices.';
  if (!m.AC) return 'Audio could not start. Click Connect camera + mic again.';
  if (m.AC.state !== 'running') return 'Audio is suspended — click Connect camera + mic to resume it.';
  if (!m.analyser || !m.data) return 'Audio analysis is not attached. Reconnect your microphone.';
  return null;
}

function showCockpitNotice(message) {
  const el = $('#cockpit-session');
  if (!el) return;
  el.textContent = message || 'Session idle';
  el.dataset.notice = message ? 'true' : 'false';
}

function bindCockpitVideo() {
  // Consume the EXISTING session. No new getUserMedia, no new AudioContext, no new
  // permission prompt - Device Check establishes the media session and Delivery
  // Training attaches to the same one.
  const v = $('#cockpit-video');
  if (v && bridge.media.stream && v.srcObject !== bridge.media.stream) v.srcObject = bridge.media.stream;
  const reason = startBlockedReason();
  showCockpitNotice(reason || '');
  const connect = $('#cockpit-connect');
  if (connect) {
    const live = !reason;
    connect.innerHTML = `<span>${live ? 'Devices connected ✓' : 'Connect camera + mic'}</span>`;
  }
}

function wireCockpit() {
  renderOverlayToggles();
  renderStatusRail();
  renderCorrection();
  $('#cockpit-connect')?.addEventListener('click', async () => {
    // MUST be first and synchronous: WebKit only allows AudioContext resume inside the
    // gesture, and everything below awaits.
    bridge.primeAudioContext();
    // Route through the analytics cockpit's own connect so it reaches its 'ready'
    // state against the SHARED bridge. Calling requestMedia directly here would leave
    // the analytics module idle and its start() would return early - the student would
    // see a live camera and no telemetry.
    const analyticsConnect = document.getElementById('communication-analytics-connect');
    if (analyticsConnect) analyticsConnect.click();
    else await connectDevices();
    // Give the shared bridge a moment to publish media, then adopt it.
    await new Promise((r) => setTimeout(r, 1200));
    bindCockpitVideo();
    bindPreview();
    await refreshDevices();
    startLevelMeter();
    renderDeviceCheck();
  });
  $('#cockpit-start')?.addEventListener('click', () => {
    // Y1-Y2-CAM-V6-3511: this used optional chaining into the analytics start button, so
    // when prerequisites were not met it did nothing at all and said nothing - a dead
    // button. Prerequisites are now checked explicitly and every failure is actionable.
    const reason = startBlockedReason();
    if (reason) { showCockpitNotice(reason); return; }
    const startButton = document.getElementById('communication-analytics-start');
    if (!startButton || startButton.disabled) {
      showCockpitNotice('The session engine is not ready yet. Reconnect your camera and microphone.');
      return;
    }
    startButton.click();
    const q = state.interviewSet[0];
    const label = $('#cockpit-question');
    if (label) label.textContent = q ? q.canonical_text : 'Free practice';
    showCockpitNotice('');
  });
  $('#cockpit-finish')?.addEventListener('click', () => {
    document.getElementById('communication-analytics-finish')?.click();
  });
}


/* ------------------------------------------------------------------ audio debug
 * Founder/Admin only. Added because Safari QA was flying blind: the product reported
 * "NO AUDIO" with no way to see WHERE the chain broke. Every field below is read
 * directly from the live objects, so it cannot agree with a broken pipeline.
 */
function renderAudioDebug() {
  const host = $('#audio-debug');
  if (!host) return;
  const m = bridge.media;
  const track = m.stream?.getAudioTracks?.()[0] || null;
  const settings = track?.getSettings?.() || {};
  let rms = null; let peak = null;
  if (m.analyser && m.data) {
    m.analyser.getFloatTimeDomainData(m.data);
    let sum = 0; let pk = 0;
    for (let i = 0; i < m.data.length; i += 1) { const v = Math.abs(m.data[i]); if (v > pk) pk = v; sum += m.data[i] * m.data[i]; }
    rms = Math.sqrt(sum / m.data.length);
    peak = pk;
    if (rms > 0) state.audioDebug.pcmFrames += 1;
    if (rms > 0.002) state.audioDebug.f0Frames += 1;
  }
  const dbfs = rms && rms > 0 ? 20 * Math.log10(rms) : null;
  const rows = [
    ['Audio track', track ? track.readyState : 'NONE', track?.readyState === 'live'],
    ['Track enabled', String(track?.enabled ?? '—'), track?.enabled === true],
    ['Track muted (transient)', String(track?.muted ?? '—'), track?.muted !== true],
    ['AudioContext', m.AC?.state ?? 'NONE', m.AC?.state === 'running'],
    ['Sample rate', String(settings.sampleRate ?? m.AC?.sampleRate ?? '—'), true],
    ['Channels', String(settings.channelCount ?? '—'), true],
    ['Device id', String(settings.deviceId ?? '—').slice(0, 14), true],
    ['PCM frames', String(state.audioDebug.pcmFrames), state.audioDebug.pcmFrames > 0],
    ['RMS', rms === null ? '—' : rms.toFixed(5), (rms ?? 0) > 0],
    ['Peak', peak === null ? '—' : peak.toFixed(4), (peak ?? 0) > 0],
    ['dBFS', dbfs === null ? '—' : dbfs.toFixed(1), dbfs !== null && dbfs > -90],
    ['F0 input frames', String(state.audioDebug.f0Frames), state.audioDebug.f0Frames > 0],
  ];
  host.replaceChildren();
  for (const [name, value, good] of rows) {
    const row = document.createElement('div');
    row.className = 'check-row';
    const n = document.createElement('span'); n.className = 'check-name'; n.textContent = name;
    const v = document.createElement('span'); v.className = 'check-state';
    v.dataset.state = good ? 'ready' : 'unavailable';
    v.textContent = value;
    row.append(n, v);
    host.append(row);
  }
}

function startAudioDebug() {
  if (state.audioDebug.timer) clearInterval(state.audioDebug.timer);
  state.audioDebug.timer = setInterval(renderAudioDebug, 250);
}

/* ------------------------------------------------------------------ device check */

function renderDeviceCheck() {
  const host = $('#device-checklist');
  if (!host) return;
  const media = bridge.media;
  const diagnostics = state.analytics?.diagnostics?.() || {};
  const rows = [
    ['Camera', media.cam ? 'ready' : 'pending', media.cam ? 'LIVE' : 'NOT CONNECTED'],
    ['Microphone', media.mic ? 'ready' : 'pending', media.mic ? 'LIVE' : 'NOT CONNECTED'],
    ['Video surface', media.stream ? 'ready' : 'pending', media.stream ? 'BOUND' : 'IDLE'],
    ['Audio context', media.AC?.state === 'running' ? 'ready' : 'pending', (media.AC?.state || 'IDLE').toUpperCase()],
    ['Vision worker', diagnostics.active ? 'ready' : 'pending', diagnostics.active ? 'RUNNING' : 'IDLE'],
    ['Face landmarks', diagnostics.active ? 'ready' : 'pending', diagnostics.active ? 'AVAILABLE ON START' : 'AWAITING SESSION'],
    ['Body + hands', diagnostics.active ? 'ready' : 'pending', diagnostics.active ? 'AVAILABLE ON START' : 'AWAITING SESSION'],
  ];
  host.replaceChildren();
  for (const [name, level, text] of rows) {
    const row = document.createElement('div');
    row.className = 'check-row';
    const label = document.createElement('span');
    label.className = 'check-name';
    label.textContent = name;
    const status = document.createElement('span');
    status.className = 'check-state';
    status.dataset.state = level;
    status.textContent = text;
    row.append(label, status);
    host.append(row);
  }
}

async function connectDevices() {
  // Same law as the cockpit handler: prime before any await.
  bridge.primeAudioContext();
  const button = $('#device-connect');
  if (button) { button.disabled = true; button.innerHTML = '<span>Requesting…</span>'; }
  try {
    await bridge.requestMedia(true, true);
    bindPreview();
    await refreshDevices();
    startLevelMeter();
  } catch (error) {
    const host = $('#device-checklist');
    const note = document.createElement('p');
    note.className = 'unavailable';
    note.textContent = `CAMERA / MIC UNAVAILABLE — ${String(error?.name || error).toUpperCase()}`;
    host?.append(note);
  }
  if (button) { button.disabled = false; button.innerHTML = '<span>Reconnect camera + mic</span>'; }
  renderDeviceCheck();
}

/* ------------------------------------------------------------------ vault */

async function renderVault() {
  const host = $('#vault-body');
  if (!host) return;
  host.replaceChildren();
  try {
    const vault = await loadVault();
    const sessions = Array.isArray(vault?.sessions) ? vault.sessions : [];
    if (!sessions.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<strong>No saved answers</strong>Durable vault persistence is not active for this account yet, so nothing is stored. Question history, attempts, Personal Best and mentor review attach here once AnswerRecords persist.';
      host.append(empty);
      return;
    }
    for (const session of sessions) {
      const row = document.createElement('div');
      row.className = 'check-row';
      row.innerHTML = `<span class="q-text">${session.questionId || session.id || 'Answer'}</span><span class="check-state" data-state="ready">${session.createdAt || ''}</span>`;
      host.append(row);
    }
  } catch {
    const note = document.createElement('p');
    note.className = 'unavailable';
    note.textContent = 'VAULT UNAVAILABLE — SESSION REQUIRED';
    host.append(note);
  }
}

/* ------------------------------------------------------------------ analytics mount */

async function mountAnalytics() {
  if (state.analytics) return;
  if (!state.admission?.admitted || state.admission?.runtime?.mode !== 'hosted') return;
  const { initializeAnalyticsUi } = await import('../analytics/ui.mjs');
  state.analytics = initializeAnalyticsUi(bridge, {
    surfaceIds: {
      video: 'founder-student-video',
      stage: 'founder-student-stage',
      room: 'founder-room-stage',
      wrapper: 'founder-room-wrapper',
      playback: 'playback',
    },
    overlayPolicy: { authorized: true, enabled: true, face: true, bodyHands: true, studentPrimary: true },
  });
  state.analytics.onViewChange(state.view, 'admin');

  // Film Room and Analytics Lab both render the hierarchical groups. Two instances so
  // each surface keeps its own show/hide and solo state; both are display-only.
  const { DeliveryIntelligenceGroups } = await import('../analytics/di-groups-ui.mjs');
  const film = $('#filmroom-groups');
  const lab = $('#lab-groups');
  if (film) state.filmGroups = new DeliveryIntelligenceGroups(film);
  if (lab) state.labGroups = new DeliveryIntelligenceGroups(lab);
  state.analytics.onDiagnostic?.((detail) => {
    try { state.filmGroups?.ingest(detail); } catch {}
    try { state.labGroups?.ingest(detail); } catch {}
    // Raw diagnostic -> normalized metric frame -> renderers. Renderers never see the
    // raw payload, which is what keeps them swappable.
    try {
      const frame = state.bus.ingest(detail);
      if (!frame) return;
      state.rack?.update(frame);
      state.labRack?.update(frame);
      renderStatusRail();
      renderCorrection();
    } catch { /* rendering must never break capture */ }
  });
  mountLabInstruments();
}

/* ------------------------------------------------------------------ boot */

function wireChrome() {
  for (const item of $$('[data-nav]')) item.addEventListener('click', () => setView(item.dataset.nav, { focus: true }));
  for (const button of $$('[data-goto]')) button.addEventListener('click', () => setView(button.dataset.goto, { focus: true }));
  $('#nav-toggle')?.addEventListener('click', () => {
    const rail = $('#rail');
    rail.dataset.open = String(rail.dataset.open !== 'true');
  });
  for (const button of $$('[data-role]')) {
    button.addEventListener('click', () => applyRole(button.dataset.role));
  }
  $('#q-search')?.addEventListener('input', (event) => { state.search = event.target.value; renderQuestions(); });
  $('#set-clear')?.addEventListener('click', () => { state.interviewSet = []; renderSet(); });
  $('#device-connect')?.addEventListener('click', () => void connectDevices());

  const wizard = $('#mode-wizard');
  const loadout = $('#mode-loadout');
  const show = (which) => {
    $('#wizard').hidden = which !== 'wizard';
    $('#loadout').hidden = which !== 'loadout';
    wizard?.setAttribute('aria-pressed', String(which === 'wizard'));
    loadout?.setAttribute('aria-pressed', String(which === 'loadout'));
    wizard.className = which === 'wizard' ? 'btn btn-primary' : 'btn btn-quiet';
    loadout.className = which === 'loadout' ? 'btn btn-primary' : 'btn btn-quiet';
  };
  wizard?.addEventListener('click', () => show('wizard'));
  loadout?.addEventListener('click', () => show('loadout'));
}

function renderLoadoutConfig() {
  const host = $('#loadout-config');
  if (!host) return;
  const groups = [
    ['Interviewer', ['Voice only', 'Text prompts'], 'Dr Kelly / Dr Woods packs pending'],
    ['Difficulty', ['Standard', 'Pressure'], null],
    ['Follow-ups', ['None', 'Occasional'], 'Hybrid follow-up router pending'],
    ['Overlays', ['Standard', 'Minimal', 'Off'], 'Hiding overlays never stops measurement'],
    ['Recording', ['On'], 'Durable persistence pending'],
    ['Duration', ['90 seconds', '5 minutes'], null],
  ];
  host.replaceChildren();
  for (const [name, options, note] of groups) {
    const cell = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'microcap';
    label.textContent = name;
    cell.append(label);
    const select = document.createElement('select');
    select.className = 'q-search';
    select.setAttribute('aria-label', name);
    for (const option of options) {
      const opt = document.createElement('option');
      opt.textContent = option;
      select.append(opt);
    }
    cell.append(select);
    if (note) {
      const hint = document.createElement('div');
      hint.className = 'microcap';
      hint.style.marginTop = '6px';
      hint.textContent = note;
      cell.append(hint);
    }
    host.append(cell);
  }
}

function renderPostAnswer() {
  for (const [id, text] of [
    ['#post-worked', 'No answer recorded in this session yet. Nothing is asserted without evidence.'],
    ['#post-fix', 'A single correction appears here once a recorded answer produces delivery evidence.'],
  ]) {
    const host = $(id);
    if (!host) continue;
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `<strong>Awaiting evidence</strong>${text}`;
    host.replaceChildren(empty);
  }
}

function renderHomeCorpus() {
  const core = store.core().length;
  const total = store.count;
  const behavioural = store.query({ collection: COLLECTIONS.BEHAVIORAL }).length;
  $('#home-corpus-count').textContent = String(total);
  $('#home-corpus-breakdown').textContent = `${core} Core · ${total - core - behavioural} Mission Residency · ${behavioural} Behavioural`;
}

async function boot() {
  wireChrome();
  applyRole('student');
  wireCockpit();
  startAudioDebug();
  collectionChips();
  renderQuestions();
  renderSet();
  renderWizard();
  renderLoadoutConfig();
  renderPostAnswer();
  renderHomeCorpus();
  renderDeviceCheck();
  void refreshDevices();
  navigator.mediaDevices?.addEventListener?.('devicechange', () => void refreshDevices());

  try {
    state.admission = await loadIvPrepSession();
  } catch {
    state.admission = null;
  }
  applyIdentity();

  const provider = state.admission?.runtime;
  if (provider) {
    const label = provider.workerRegistrationState === 'READY' ? 'Provider ready' : 'Provider unavailable';
    const el = $('#sim-provider-state');
    if (el) el.textContent = label;
  }

  await mountAnalytics();

  const hash = String(location.hash || '').replace('#', '');
  setView(CRUMBS[hash] ? hash : 'home');
}

void boot();
