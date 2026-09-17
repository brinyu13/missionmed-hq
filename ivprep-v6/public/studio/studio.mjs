// IV Prep On-Call — Astra presentation shell on the proven production runtime.
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

import {
  createLiveInterview,
  endLiveInterview,
  loadIvPrepSession,
} from '../aaa/api-client.mjs';
import { COLLECTIONS, createDefaultQuestionStore } from '../questions/question-store.mjs';
import { LiveInterviewSession } from './live-interview.mjs';
import { DurableStudioSession } from './durable-session.mjs';
import { MetricBus, selectCorrection, statusRail } from './metric-bus.mjs';
import { InstrumentRack } from './instruments.mjs';
import { buildLongitudinalModel, compareAttempts } from './longitudinal-model.mjs';
import { createLiveContext } from './live-context-adapter.mjs';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const CRUMBS = Object.freeze({
  home: 'Home', newsession: 'Build Interview', devicecheck: 'Readiness & Calibration',
  training: 'Coached Practice', simulation: 'Interview Room', postanswer: 'Real Interview Debrief',
  filmroom: 'Performances', compare: 'Compare Attempts', lab: 'Performance Intelligence', mentor: 'Mentor & Admin',
  progress: 'My Progress', fingerprint: 'Delivery Fingerprint', vault: 'Answer History & Clips',
});

const store = createDefaultQuestionStore();
const ASTRA_PRESENTATION_CANON = 'dedb726bde521a135bec2286ad4cd5a877a68fc7ecd6144fde16b76bc9c09ac4';

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
  wizard: {
    goal: 'Full IV Simulation', duration: 15, pressurePractice: false, focus: '',
    questions: null, questionCategory: 'Core / Opening', questionSection: 'CORE', questionSearch: '',
    interviewer: 'Program Director', interviewerStyle: 'Owl', interviewerTab: 'Role & style', interviewerName: '',
    program: '', programSpecialty: '', programState: '', programType: '',
    environment: 'MissionMed', interviewMode: 'Interview Mode', analyticsEnabled: true,
    contextSources: [], readiness: null,
  },
  targetQuestions: 5,
  devices: { cameras: [], microphones: [] },
  selected: { camera: null, microphone: null },
  levelTimer: null,
  audioDebug: { pcmFrames: 0, f0Frames: 0, timer: null },
  // ONE canonical readiness truth. The legacy cockpit keeps its own internal state for
  // its own controls, but the student-facing product reads only this.
  session: { state: 'IDLE', reason: null, startedAt: null, answerId: null },
  trace: { mediaPcm: 0, analyticsPcm: 0, speech: 0, pause: 0, f0: 0, metrics: 0, diagnostics: 0 },
  bus: new MetricBus(),
  rack: null,
  labRack: null,
  primaryMetric: null,
  overlays: { face: true, bodyHands: true, enabled: true },
  liveInterview: null,
  durable: new DurableStudioSession(),
  durableAvailable: false,
  durableError: null,
  lastSaved: null,
  localPlaybackUrl: null,
  longitudinal: null,
  longitudinalPromise: null,
  comparePair: [0, 1],
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
function permittedRoles() {
  const identity = state.admission?.identity || null;
  const roles = Array.isArray(identity?.roles) ? identity.roles.map((role) => String(role).toLowerCase()) : [];
  const founder = identity?.founder === true || roles.some((role) => ['administrator', 'admin'].includes(role));
  if (founder) return new Set(['student', 'mentor', 'admin']);
  if (roles.some((role) => ['mentor', 'coach', 'faculty', 'teacher'].includes(role))) return new Set(['student', 'mentor']);
  return new Set(['student']);
}

function applyRole(role) {
  const allowed = permittedRoles();
  state.role = allowed.has(role) ? role : 'student';
  document.body.dataset.role = state.role;
  for (const button of $$('[data-role]')) {
    const authorized = allowed.has(button.dataset.role);
    button.hidden = !authorized;
    button.disabled = !authorized;
    button.setAttribute('aria-pressed', String(button.dataset.role === state.role));
  }
  const banner = $('#debug-banner');
  if (banner) banner.hidden = state.role !== 'admin';
  const voiceAudition = $('#admin-live-voice-audition');
  if (voiceAudition) voiceAudition.hidden = state.role !== 'admin';
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
    const active = item.dataset.nav === view
      && (view !== 'newsession' || (!item.dataset.builderStep && !item.dataset.openMode));
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
  if (view === 'newsession') renderWizard();
  if (view === 'training') bindCockpitVideo();
  if (view === 'lab') { mountLabInstruments(); void renderLongitudinal(); }
  if (view === 'compare') void renderCompare();
  if (view === 'progress') void renderProgress();
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
    const homeName = $('#home-first-name');
    if (homeName) homeName.textContent = 'Doctor.';
    return;
  }
  const roles = Array.isArray(identity.roles) ? identity.roles : [];
  const founder = identity.founder === true || roles.includes('administrator');
  name.textContent = identity.subject || 'Signed in';
  sub.textContent = founder ? 'Founder / Admin' : (roles[0] || 'Student');
  mark.innerHTML = `<span>${founder ? 'DB' : String(identity.wpUserId ?? '?').slice(0, 2)}</span>`;
  const homeName = $('#home-first-name');
  if (homeName) homeName.textContent = founder ? 'Dr Brian.' : 'Doctor.';
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
    renderPoolSummary();
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
  renderPoolSummary();
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

/* ------------------------------------------------------------------ Astra six-step builder */

const WIZARD_STEPS = Object.freeze([
  { key: 'goal', label: 'Practice Goal', title: ['What are you', 'practicing for?'] },
  { key: 'questions', label: 'Question Pool', title: ['Start broad.', 'Make it yours.'] },
  { key: 'interviewer', label: 'Interviewer', title: ['Who is on', 'the other side?'] },
  { key: 'program', label: 'Program', title: ['Know', 'the room.'] },
  { key: 'environment', label: 'Environment + Context', title: ['Set the scene.', 'Bring your context.'] },
  { key: 'readiness', label: 'Readiness + Calibration', title: ['Find your signal.', 'Enter with confidence.'] },
]);

const QUESTION_CATEGORIES = Object.freeze([
  ['Core / Opening', ['CORE', 'TRADITIONAL', 'BACKGROUND', 'CV_BASED', 'CLOSING']],
  ['Behavioral', ['BEHAVIORAL', 'SITUATIONAL']],
  ['Clinical & Judgment', ['CLINICAL_EXPERIENCE', 'MISTAKE_SAFETY', 'HEALTHCARE_POLICY']],
  ['Teamwork & Communication', ['TEAMWORK', 'COMMUNICATION', 'PATIENT_INTERACTION']],
  ['Leadership', ['LEADERSHIP']],
  ['Conflict / Difficult Situations', ['CONFLICT', 'STRESS_PRESSURE']],
  ['Strengths / Weaknesses / Growth', ['STRENGTHS', 'WEAKNESSES', 'RED_FLAGS']],
  ['Failure / Adversity', ['FAILURE', 'ADVERSITY']],
  ['Program Fit / Why Us', ['PROGRAM_FIT']],
  ['Career Goals / Specialty Fit', ['CAREER_GOALS', 'SPECIALTY', 'MOTIVATION', 'RESEARCH']],
  ['Ethics / Professionalism', ['ETHICS']],
  ['Personal / Outside Medicine', ['PERSONAL', 'HOBBIES', 'CREATIVE_UNUSUAL']],
]);
const QUESTION_TAGS = new Set(QUESTION_CATEGORIES.flatMap(([, tags]) => tags));
const BIRD_STYLES = Object.freeze({
  Dove: 'Warm, patient, supportive', Peacock: 'Expressive, energetic, conversational',
  Owl: 'Measured, analytical, evidence-focused', Eagle: 'Direct, concise, outcome-focused',
});

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function choiceButton({ className = 'canon-tactile', selected = false, label, detail, onClick }) {
  const button = el('button', `${className}${selected ? ' selected' : ''}`);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(selected));
  const strong = el('strong', '', label);
  button.append(strong);
  if (detail) button.append(el('small', '', detail));
  button.addEventListener('click', onClick);
  return button;
}

function questionSection(question) {
  if (question.core_priority) return 'CORE';
  return question.tags.find((tag) => QUESTION_TAGS.has(tag)) || 'TRADITIONAL';
}

function categoryForQuestion(question) {
  const section = questionSection(question);
  return QUESTION_CATEGORIES.find(([, tags]) => tags.includes(section))?.[0] || 'Core / Opening';
}

function sectionLabel(value) {
  return String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function showBuilderMode(which) {
  const wizard = $('#mode-wizard');
  const loadout = $('#mode-loadout');
  $('#wizard').hidden = which !== 'wizard';
  $('#loadout').hidden = which !== 'loadout';
  wizard?.setAttribute('aria-pressed', String(which === 'wizard'));
  loadout?.setAttribute('aria-pressed', String(which === 'loadout'));
  if (wizard) wizard.className = which === 'wizard' ? 'btn btn-primary' : 'btn btn-quiet';
  if (loadout) loadout.className = which === 'loadout' ? 'btn btn-primary' : 'btn btn-quiet';
}

function renderWizardProgress() {
  const progress = $('#wizard-progress');
  if (!progress) return;
  progress.replaceChildren();
  WIZARD_STEPS.forEach((step, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = index === state.wizardStep ? 'current' : index < state.wizardStep ? 'complete' : '';
    if (index === state.wizardStep) button.setAttribute('aria-current', 'step');
    button.innerHTML = `<span>${index < state.wizardStep ? '✓' : index + 1}</span><b>${step.label}</b>`;
    button.addEventListener('click', () => { state.wizardStep = index; renderWizard(); });
    progress.append(button);
  });
}

function renderPoolSummary() {
  const count = $('#builder-pool-count');
  const preview = $('#builder-pool-preview');
  if (count) count.textContent = String(state.interviewSet.length);
  if (!preview) return;
  preview.replaceChildren();
  if (!state.interviewSet.length) {
    const empty = document.createElement('span');
    empty.textContent = 'No questions selected yet. Question Plan can seed a pool, or open the full library.';
    preview.append(empty);
    return;
  }
  state.interviewSet.slice(0, 5).forEach((question) => {
    const row = document.createElement('span');
    row.textContent = `${question.question_id} · ${question.canonical_text}`;
    preview.append(row);
  });
  if (state.interviewSet.length > 5) {
    const more = document.createElement('span');
    more.textContent = `+ ${state.interviewSet.length - 5} more in the pool`;
    preview.append(more);
  }
}

function renderGoalStep(host) {
  const choices = [
    ['Full IV Simulation', 'A realistic start-to-finish residency interview.', 'synthetic-candidate.png'],
    ['Guided Mock IV Practice', 'Structured support around one or more priorities.', 'storyforge.png'],
    ['Individual Question', 'Give one specific answer your full attention.', 'iv-prep-on-call.png'],
  ];
  const cards = el('div', 'canon-purpose-cards');
  choices.forEach(([name, detail, image], index) => {
    const button = choiceButton({
      className: 'canon-purpose-card', selected: state.wizard.goal === name, label: name, detail,
      onClick: () => { state.wizard.goal = name; if (name === 'Individual Question') state.targetQuestions = 1; renderWizard(); },
    });
    const img = el('img', 'canon-goal-photo');
    img.src = `/iv-prep-on-call/assets/studio/astra-assets/${image}`;
    img.alt = '';
    button.prepend(img, el('span', 'canon-card-number', `0${index + 1}`));
    cards.append(button);
  });
  const options = el('div', 'canon-goal-options');
  if (state.wizard.goal !== 'Individual Question') {
    const pressure = choiceButton({
      className: 'canon-toggle', selected: state.wizard.pressurePractice,
      label: 'Pressure Practice', detail: 'More persistent follow-ups, shorter recovery time, deliberate challenge.',
      onClick: () => { state.wizard.pressurePractice = !state.wizard.pressurePractice; renderWizard(); },
    });
    options.append(pressure);
  } else options.append(el('p', 'canon-muted', 'Choose one question, or let a category surprise you.'));
  const length = el('div', 'canon-length');
  length.append(el('span', 'microcap', 'Time for this rep'));
  [5, 10, 15, 25].forEach((minutes) => length.append(choiceButton({
    className: 'canon-mini-choice', selected: state.wizard.duration === minutes, label: `${minutes} min`,
    onClick: () => { state.wizard.duration = minutes; renderWizard(); },
  })));
  options.append(length);
  host.append(cards, options);
  if (state.wizard.goal === 'Guided Mock IV Practice') {
    const label = el('label', 'canon-field');
    label.append(el('span', '', 'Your focus for this practice'));
    const input = el('input'); input.type = 'text'; input.maxLength = 200; input.value = state.wizard.focus;
    input.placeholder = 'For example: name my contribution, then explain the impact';
    input.addEventListener('input', () => { state.wizard.focus = input.value; });
    label.append(input); host.append(label);
  }
}

function renderQuestionStep(host) {
  const toolbar = el('div', 'canon-pool-toolbar');
  const search = el('input'); search.type = 'search'; search.value = state.wizard.questionSearch;
  search.placeholder = 'Search every question or source ID…'; search.setAttribute('aria-label', 'Search question pool');
  search.addEventListener('input', () => { state.wizard.questionSearch = search.value; renderWizard(); });
  toolbar.append(search);
  const presets = el('div', 'canon-presets');
  [['Core 10', 'Core 10'], ['Behavioral', 'Behavioral questions'], ['Balanced mix', 'Balanced mix']].forEach(([label, value]) => {
    presets.append(choiceButton({ className: 'canon-mini-choice', label, onClick: () => { applyWizardQuestions(value); state.wizard.questions = label; renderWizard(); } }));
  });
  toolbar.append(presets);
  const count = el('p', 'canon-muted', `${store.count} source questions preserved. Browse branches, add a whole section, or choose specific questions.`);
  const grid = el('div', 'canon-pool-browser');
  const categories = el('nav', 'canon-categories'); categories.setAttribute('aria-label', 'Question categories');
  QUESTION_CATEGORIES.forEach(([name]) => categories.append(choiceButton({
    selected: state.wizard.questionCategory === name, label: name,
    onClick: () => { state.wizard.questionCategory = name; state.wizard.questionSection = ''; state.wizard.questionSearch = ''; renderWizard(); },
  })));
  const branch = el('section', 'canon-branches');
  branch.append(el('h2', '', state.wizard.questionSearch ? 'Search results' : state.wizard.questionCategory));
  const branchActions = el('div', 'canon-inline-actions');
  const categoryQuestions = store.all().filter((question) => categoryForQuestion(question) === state.wizard.questionCategory);
  branchActions.append(choiceButton({ className: 'canon-mini-choice', label: 'Add entire category', onClick: () => { categoryQuestions.forEach(addToSet); renderWizard(); } }));
  branch.append(branchActions);
  if (!state.wizard.questionSearch) {
    const sections = el('div', 'canon-sections');
    const tags = QUESTION_CATEGORIES.find(([name]) => name === state.wizard.questionCategory)?.[1] || [];
    tags.filter((tag) => store.all().some((question) => questionSection(question) === tag)).forEach((tag) => sections.append(choiceButton({
      selected: state.wizard.questionSection === tag, label: sectionLabel(tag),
      onClick: () => { state.wizard.questionSection = tag; renderWizard(); },
    })));
    branch.append(sections);
  }
  let visible = store.all();
  if (state.wizard.questionSearch.trim()) {
    const needle = state.wizard.questionSearch.toLowerCase();
    visible = visible.filter((question) => `${question.question_id} ${question.canonical_text}`.toLowerCase().includes(needle));
  } else {
    visible = visible.filter((question) => categoryForQuestion(question) === state.wizard.questionCategory)
      .filter((question) => !state.wizard.questionSection || questionSection(question) === state.wizard.questionSection);
  }
  branch.append(el('h3', '', 'Choose specific questions'));
  const list = el('div', 'canon-question-list');
  visible.forEach((question) => {
    const selected = state.interviewSet.some((entry) => entry.question_id === question.question_id);
    const button = choiceButton({
      className: 'canon-question canon-tactile', selected,
      label: question.canonical_text, detail: `${question.question_id} · ${sectionLabel(questionSection(question))}`,
      onClick: () => {
        state.interviewSet = selected
          ? state.interviewSet.filter((entry) => entry.question_id !== question.question_id)
          : [...state.interviewSet, question];
        state.wizard.questions = state.interviewSet.length ? 'Custom Question Pool' : null;
        renderSet(); renderWizard();
      },
    });
    list.append(button);
  });
  if (!visible.length) list.append(el('p', 'canon-muted', 'No questions match. Clear search or choose another branch.'));
  branch.append(list); grid.append(categories, branch); host.append(toolbar, count, grid);
}

function renderInterviewerStep(host) {
  const tabs = el('div', 'canon-tabs');
  ['Role & style', 'Voice & presence', 'Name-use coaching'].forEach((tab) => tabs.append(choiceButton({
    className: 'canon-tab', selected: state.wizard.interviewerTab === tab, label: tab,
    onClick: () => { state.wizard.interviewerTab = tab; renderWizard(); },
  })));
  host.append(tabs);
  if (state.wizard.interviewerTab === 'Role & style') {
    const roles = el('div', 'canon-role-cards');
    ['Program Director', 'Faculty', 'Chief Resident', 'Associate Program Director'].forEach((role) => roles.append(choiceButton({
      className: 'canon-role-card', selected: state.wizard.interviewer === role, label: role,
      detail: role === 'Program Director' ? 'Leadership, fit, and vision' : role === 'Chief Resident' ? 'Culture, teamwork, and real life' : 'Clinical judgment and conversation',
      onClick: () => { state.wizard.interviewer = role; renderWizard(); },
    })));
    const heading = el('div', 'canon-section-heading'); heading.append(el('h3', '', 'Conversation style'), el('p', 'canon-muted', 'Style shapes tone and follow-ups. It is not a personality assessment.'));
    const birds = el('div', 'canon-bird-grid');
    Object.entries(BIRD_STYLES).forEach(([name, detail]) => birds.append(choiceButton({
      className: 'canon-bird-card', selected: state.wizard.interviewerStyle === name, label: name, detail,
      onClick: () => { state.wizard.interviewerStyle = name; renderWizard(); },
    })));
    host.append(roles, heading, birds);
  } else if (state.wizard.interviewerTab === 'Voice & presence') {
    const panel = el('div', 'canon-presence');
    panel.innerHTML = '<div class="canon-presence-orb" aria-hidden="true"><span>IV</span></div><div><div class="microcap">Future-ready presence</div><h2>Give the conversation <em>a presence.</em></h2><p>InterviewBrain voice is available when your account is entitled. Animated avatar delivery remains deferred.</p></div>';
    host.append(panel);
  } else {
    const panel = el('div', 'canon-name-coaching');
    panel.append(el('h2', '', 'Make it personal.'));
    const label = el('label', 'canon-field'); label.append(el('span', '', 'Interviewer name (optional)'));
    const input = el('input'); input.value = state.wizard.interviewerName; input.placeholder = 'Enter a verified name when known'; input.maxLength = 100;
    input.addEventListener('input', () => { state.wizard.interviewerName = input.value; }); label.append(input); panel.append(label);
    const windows = el('div', 'canon-name-windows');
    [['Opening', 'First ~60s'], ['Middle', 'When it fits'], ['Close', 'A natural thank-you']].forEach(([name, detail]) => { const cell = el('span'); cell.append(el('strong', '', name), document.createTextNode(detail)); windows.append(cell); });
    panel.append(windows, el('p', 'canon-muted', 'Rapport matters more than exact counts. Coaching stays observational and contextual.')); host.append(panel);
  }
}

function renderProgramStep(host) {
  const photo = el('div', 'canon-photo-heading');
  const image = el('img'); image.src = '/iv-prep-on-call/assets/studio/astra-assets/rise.png'; image.alt = '';
  const copy = el('div'); copy.append(el('h2', '', 'Know the room.'), el('p', '', 'Search and select verified program intelligence, or continue with a manual entry.'));
  photo.append(image, copy); host.append(photo);
  const search = el('label', 'canon-search'); search.append(el('span', 'microcap', 'Program name'));
  const input = el('input'); input.type = 'search'; input.placeholder = 'Search program name…'; input.value = state.wizard.program;
  input.addEventListener('input', () => { state.wizard.program = input.value; }); search.append(input); host.append(search);
  const filters = el('div', 'canon-program-filters');
  [['Specialty', 'All specialties', 'programSpecialty', 'Internal Medicine,Family Medicine,Pediatrics,Surgery,Psychiatry'], ['State', 'All states', 'programState', 'Massachusetts,New York,California,Texas,Florida'], ['Program type', 'All program types', 'programType', 'University,Community,University-affiliated']].forEach(([labelText, placeholder, key, values]) => {
    const label = el('label', 'canon-field'); label.append(el('span', '', labelText)); const select = el('select');
    select.append(new Option(placeholder, ''));
    values.split(',').forEach((value) => select.append(new Option(value, value)));
    select.value = state.wizard[key]; select.addEventListener('change', () => { state.wizard[key] = select.value; }); label.append(select); filters.append(label);
  });
  host.append(filters);
  const result = el('div', 'canon-program-result');
  result.append(el('div', 'microcap', state.wizard.program ? 'Selected program' : 'Program search'));
  result.append(el('h3', '', state.wizard.program || 'Choose a program or enter one manually'));
  result.append(el('p', 'canon-muted', state.wizard.program
    ? `${state.wizard.programSpecialty || 'Specialty not selected'} · ${state.wizard.programState || 'State not selected'} · ${state.wizard.programType || 'Type not selected'}`
    : 'Verified RISE program intelligence will hydrate the cheat sheet when available. No program facts are invented.'));
  const facts = el('div', 'canon-cheat-sheet');
  ['Training focus', 'Leadership and interviewers', 'Curriculum and pathways', 'Research, facilities, and fellowships'].forEach((fact) => {
    const row = el('div'); row.append(el('strong', '', fact), el('span', '', 'Not available until verified program intelligence is selected.')); facts.append(row);
  });
  result.append(facts); host.append(result);
}

function renderEnvironmentStep(host) {
  const layout = el('div', 'canon-environment-layout');
  const environment = el('section', 'canon-panel'); environment.append(el('h2', '', 'Your interview environment.'));
  const rooms = el('div', 'canon-room-grid');
  ['MissionMed', 'Webex', 'Zoom', 'Teams'].forEach((name) => {
    const button = choiceButton({ className: 'canon-room-card', selected: state.wizard.environment === name, label: name, detail: name === 'MissionMed' ? 'Interview workspace' : 'Training simulation', onClick: () => { state.wizard.environment = name; renderWizard(); } });
    const preview = el('div', `canon-room-preview room-${name.toLowerCase()}`); preview.innerHTML = '<span class="room-person"></span><span class="room-self"></span><span class="room-controls">● ● —</span>'; button.prepend(preview); rooms.append(button);
  });
  environment.append(rooms);
  const modes = el('div', 'canon-segment');
  ['Interview Mode', 'Coached / Live Analytics Mode'].forEach((mode) => modes.append(choiceButton({ className: 'canon-tab', selected: state.wizard.interviewMode === mode, label: mode, onClick: () => { state.wizard.interviewMode = mode; renderWizard(); } })));
  environment.append(modes, el('p', 'canon-muted', state.wizard.interviewMode === 'Interview Mode' ? 'A clean interview view. Enabled measurements continue in the background.' : 'Selected coaching overlays stay visible during practice.'));
  const context = el('section', 'canon-panel'); context.append(el('h2', '', 'Bring the right context.'), el('p', 'canon-muted', 'Only sources authorized for your account can be included. Unavailable sources remain off.'));
  const sourceGrid = el('div', 'canon-source-grid');
  const sources = [
    ['StoryForge', false, 'Your authorized stories'], ['RISE', false, 'Verified program intelligence'], ['CV', false, 'Your current curriculum vitae'],
    ['File Vault', false, 'Selected private files'], ['MCC', false, 'MissionMed context'], ['Top 3', false, 'Mentor priorities'], ['Prior IVOC', state.durableAvailable, 'Your own prior practice'],
  ];
  sources.forEach(([name, available, detail]) => sourceGrid.append(choiceButton({
    className: 'canon-source-card', selected: state.wizard.contextSources.includes(name), label: name,
    detail: `${detail} · ${available ? 'Available' : 'Not connected'}`,
    onClick: () => {
      if (!available) return;
      state.wizard.contextSources = state.wizard.contextSources.includes(name)
        ? state.wizard.contextSources.filter((entry) => entry !== name) : [...state.wizard.contextSources, name];
      renderWizard();
    },
  })));
  [...sourceGrid.children].forEach((button, index) => { if (!sources[index][1]) { button.disabled = true; button.setAttribute('aria-disabled', 'true'); } });
  context.append(sourceGrid); layout.append(environment, context); host.append(layout);
}

function readinessRows() {
  const media = bridge.media;
  const analyticsReady = Boolean(state.analytics);
  const live = Boolean(media.stream);
  return [
    ['Camera', media.cam, media.cam ? 'Live' : 'Connect to check'], ['Microphone', media.mic, media.mic ? 'Live' : 'Connect to check'],
    ['Framing', analyticsReady && live, live ? 'Measured in session' : 'Awaiting camera'], ['Face / head', analyticsReady && live, live ? 'Measured in session' : 'Awaiting camera'],
    ['Hands / gestures', analyticsReady && live, live ? 'Measured in session' : 'Awaiting camera'], ['Smile / expression', analyticsReady && live, live ? 'Measured in session' : 'Awaiting camera'],
    ['Volume', media.mic, media.mic ? 'Live meter' : 'Awaiting microphone'], ['Pace', analyticsReady && media.mic, media.mic ? 'Measured in session' : 'Awaiting microphone'],
    ['Pitch', analyticsReady && media.mic, media.mic ? 'Measured in session' : 'Awaiting microphone'], ['Pauses', analyticsReady && media.mic, media.mic ? 'Measured in session' : 'Awaiting microphone'],
    ['Transcript', state.durableAvailable, state.durableAvailable ? 'Available after a saved answer' : 'Unavailable'],
    ['Recording', typeof MediaRecorder !== 'undefined', typeof MediaRecorder !== 'undefined' ? 'Browser supported' : 'Unavailable'],
  ];
}

function renderReadinessStep(host) {
  const intro = el('div', 'canon-photo-heading'); const image = el('img'); image.src = '/iv-prep-on-call/assets/studio/astra-assets/synthetic-candidate.png'; image.alt = '';
  const copy = el('div'); copy.append(el('h2', '', 'Find your signal.'), el('p', '', 'Real capability states from the same camera, microphone, and analytics pipeline used in practice.')); intro.append(image, copy); host.append(intro);
  const layout = el('div', 'canon-readiness-layout');
  state.wizard.readiness = bridge.media.cam && bridge.media.mic
    ? 'Camera and microphone connected'
    : 'Calibration available';
  const preview = el('section', 'canon-readiness-preview');
  const stage = el('div', 'stage'); stage.id = 'builder-readiness-stage'; stage.innerHTML = '<div class="stage-tag"><span>You</span></div>'; preview.append(stage);
  const meter = el('div', 'canon-live-meter'); meter.innerHTML = '<span class="live-mic-fill"></span>'; preview.append(meter, el('p', 'microcap', bridge.media.mic ? 'Speak to test your live microphone level' : 'Connect camera + microphone to begin'));
  const actions = el('div', 'canon-inline-actions');
  const connect = choiceButton({ className: 'btn btn-primary', label: bridge.media.stream ? 'Reconnect camera + mic' : 'Connect camera + mic', onClick: async () => { await connectDevices(); renderWizard(); } });
  const full = choiceButton({ className: 'btn btn-secondary', label: 'Open full calibration', onClick: () => setView('devicecheck') }); actions.append(connect, full); preview.append(actions);
  const signals = el('section', 'canon-signal-grid');
  readinessRows().forEach(([name, ready, detail]) => { const tile = el('div', 'canon-signal-tile'); tile.dataset.ready = String(Boolean(ready)); tile.append(el('strong', '', name), el('span', '', detail)); signals.append(tile); });
  layout.append(preview, signals); host.append(layout);
  bindPreview(); if (bridge.media.mic) startLevelMeter();
}

function renderWizard() {
  const body = $('#wizard-body');
  if (!body) return;
  body.replaceChildren();
  renderWizardProgress();
  renderPoolSummary();
  const layout = body.closest('.builder-layout');
  if (layout) layout.dataset.step = state.wizardStep === 1 ? 'questions' : WIZARD_STEPS[state.wizardStep]?.key || 'summary';

  if (state.wizardStep >= WIZARD_STEPS.length) {
    const summary = document.createElement('div');
    summary.append(el('div', 'microcap', 'Your next rep'));
    const addSummaryRow = (name, value, ready = true) => {
      const item = el('div', 'check-row');
      const status = el('span', 'check-state', value);
      status.dataset.state = ready ? 'ready' : 'pending';
      item.append(el('span', 'check-name', name), status);
      summary.append(item);
    };
    addSummaryRow('Practice', state.wizard.goal);
    addSummaryRow('Question Pool', `${state.interviewSet.length} in pool · target about ${state.targetQuestions}`, state.interviewSet.length > 0);
    addSummaryRow('Interviewer', state.wizard.interviewer);
    addSummaryRow('Program', state.wizard.program || 'No program selected', Boolean(state.wizard.program));
    addSummaryRow('Environment + context', state.wizard.environment);
    addSummaryRow('Readiness', state.wizard.readiness);
    const row = document.createElement('div');
    row.className = 'btn-row';
    const go = document.createElement('button');
    go.className = 'btn btn-primary';
    go.type = 'button';
    go.innerHTML = '<span>Continue to Readiness ▸</span>';
    go.addEventListener('click', () => {
      if (!state.interviewSet.length) applyWizardQuestions('Core 10');
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
  kick.textContent = `Step ${state.wizardStep + 1} of ${WIZARD_STEPS.length} · ${step.label}`;
  const title = document.createElement('h2');
  title.className = 'canon-wizard-title';
  title.append(document.createTextNode(`${step.title[0]} `), el('em', '', step.title[1]));
  const content = el('div', `canon-step canon-step-${step.key}`);
  if (step.key === 'goal') renderGoalStep(content);
  else if (step.key === 'questions') renderQuestionStep(content);
  else if (step.key === 'interviewer') renderInterviewerStep(content);
  else if (step.key === 'program') renderProgramStep(content);
  else if (step.key === 'environment') renderEnvironmentStep(content);
  else renderReadinessStep(content);
  const nav = document.createElement('div');
  nav.className = 'wizard-nav';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn-quiet';
  back.disabled = state.wizardStep === 0;
  back.innerHTML = '<span>← Back</span>';
  back.addEventListener('click', () => { state.wizardStep = Math.max(0, state.wizardStep - 1); renderWizard(); });
  const selected = step.key === 'questions' ? state.interviewSet.length > 0
    : step.key === 'readiness' ? true
      : Boolean(state.wizard[step.key]);
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn btn-quiet';
  next.disabled = !selected;
  next.innerHTML = `<span>${state.wizardStep === 5 ? 'Review interview' : 'Continue'} →</span>`;
  next.addEventListener('click', () => { state.wizardStep += 1; renderWizard(); });
  nav.append(back, next);
  body.append(kick, title, content, nav);
}

function applyWizardQuestions(selection) {
  if (selection === 'Behavioral questions') state.interviewSet = store.query({ collection: COLLECTIONS.BEHAVIORAL }).slice(0, 8);
  else if (selection === 'Balanced mix') state.interviewSet = store.all().filter((_, index) => index % 17 === 0).slice(0, 10);
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
  for (const stage of ['#devicecheck-stage', '#builder-readiness-stage']) {
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
  const bars = [$('#mic-level-fill'), ...$$('.live-mic-fill')].filter(Boolean);
  const readout = $('#mic-level-readout');
  if (!bars.length) return;
  state.levelTimer = setInterval(() => {
    const { analyser, data } = bridge.media;
    if (!analyser || !data) { bars.forEach((bar) => { bar.style.width = '0%'; }); if (readout) readout.textContent = 'UNAVAILABLE'; return; }
    analyser.getFloatTimeDomainData(data);
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) { const v = Math.abs(data[i]); if (v > peak) peak = v; sum += data[i] * data[i]; }
    const rms = Math.sqrt(sum / data.length);
    const dbfs = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    bars.forEach((bar) => { bar.style.width = `${Math.max(0, Math.min(100, (dbfs + 60) / 60 * 100))}%`; });
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



/* ------------------------------------------------------------------ session engine
 * Y1-Y2-CAM-V6-3513. ONE canonical state machine:
 *
 *   IDLE -> MEDIA_READY -> ANALYTICS_READY -> SESSION_READY -> STARTING -> RUNNING
 *        -> FINISHING -> COMPLETE
 *
 * Start Rep previously proxied a click into the LEGACY cockpit's hidden button, whose
 * `disabled` state is derived from that cockpit's own connect() lifecycle. After 3511
 * the Studio button correctly read "Devices connected", so a student went straight to
 * Start Rep while the legacy cockpit had never connected - its state stayed 'idle', its
 * button stayed disabled, and Start Rep refused with "the session engine is not ready".
 *
 * Readiness now derives from REAL prerequisites, and Start Rep drives the session engine
 * directly through the facade (beginAnswer/endAnswer). The legacy cockpit is no longer
 * in the student's critical path.
 *
 * Also note: the pipeline only samples audio between beginAnswer and endAnswer. Before a
 * rep there are deliberately no audio diagnostics - that is connectivity, not failure,
 * and the two are now distinct states rather than both reading "NO AUDIO".
 */

function setSessionState(next, reason = null) {
  state.session.state = next;
  state.session.reason = reason;
  const el = $('#cockpit-session');
  if (el) {
    const label = {
      IDLE: 'Connect your camera and microphone to begin',
      MEDIA_READY: 'Devices connected · analytics attaching',
      ANALYTICS_READY: 'Analytics connected · ready when you are',
      SESSION_READY: 'Ready — press Start rep',
      STARTING: 'Starting…',
      RUNNING: 'Rep running',
      FINISHING: 'Finishing…',
      COMPLETE: 'Rep complete',
      BLOCKED: reason || 'Not ready',
    }[next] || next;
    el.textContent = label;
    el.dataset.notice = next === 'BLOCKED' ? 'true' : 'false';
  }
  const start = $('#cockpit-start');
  if (start) {
    const running = next === 'RUNNING' || next === 'STARTING';
    start.innerHTML = `<span>${running ? 'Rep running…' : 'Start rep ▸'}</span>`;
    start.disabled = running;
  }
  return next;
}

/** Canonical readiness. Real prerequisites only - no legacy cockpit flags, no DOM state. */
function evaluateReadiness() {
  const m = bridge.media;
  const audio = m.stream?.getAudioTracks?.()[0];
  const video = m.stream?.getVideoTracks?.()[0];
  if (!m.stream) return setSessionState('IDLE');
  if (!video || video.readyState !== 'live') return setSessionState('BLOCKED', 'Camera disconnected — reconnect it in Devices.');
  if (!audio || audio.readyState !== 'live') return setSessionState('BLOCKED', 'Microphone disconnected — reconnect it in Devices.');
  if (!m.AC) return setSessionState('BLOCKED', 'Audio could not start. Click Connect camera + mic again.');
  if (m.AC.state !== 'running') return setSessionState('BLOCKED', 'Audio is suspended — click Connect camera + mic to resume it.');
  if (!m.analyser || !m.data) return setSessionState('BLOCKED', 'Audio analysis is not attached. Reconnect your microphone.');
  setSessionState('MEDIA_READY');
  if (!state.analytics) return setSessionState('BLOCKED', 'Delivery Intelligence is still loading. Wait a moment and try again.');
  setSessionState('ANALYTICS_READY');
  return setSessionState('SESSION_READY');
}

async function startRep() {
  if (['STARTING', 'RUNNING'].includes(state.session.state)) return;
  if (evaluateReadiness() !== 'SESSION_READY') return;
  setSessionState('STARTING');
  try {
    const video = $('#cockpit-video');
    // Drive the session engine directly. No legacy button, no hidden state machine.
    const answer = state.analytics.beginAnswer({ videoElement: video });
    state.session.answerId = answer?.answerId ?? null;
    state.session.startedAt = Date.now();
    const q = state.interviewSet[0];
    const save = $('#cockpit-save');
    if (state.durableAvailable) {
      try {
        await state.durable.start({
          stream: bridge.media.stream,
          question: q || null,
          wizard: state.wizard,
          targetQuestions: state.targetQuestions,
          interviewerProvider: state.liveInterview?.sessionId ? 'openai-gpt-live' : 'missionmed-static',
        });
        if (save) { save.dataset.state = 'active'; save.textContent = 'Secure account recording active.'; }
      } catch (error) {
        state.durableError = error;
        if (save) { save.dataset.state = 'error'; save.textContent = `Account save unavailable for this rep — ${String(error?.message || error).slice(0, 100)}`; }
      }
    } else if (save) {
      save.dataset.state = 'error';
      save.textContent = 'Account save unavailable in this environment; Analytics remains local to this rep.';
    }
    const label = $('#cockpit-question');
    if (label) label.textContent = q ? q.canonical_text : 'Free practice';
    setSessionState('RUNNING');
  } catch (error) {
    // Never swallow: a rejected start must name itself.
    setSessionState('BLOCKED', `Could not start the rep: ${String(error?.message || error).slice(0, 120)}`);
  }
}

async function finishRep() {
  const retryingDurableSave = state.session.state === 'BLOCKED'
    && state.durable?.recorder?.state === 'ERROR'
    && state.durable?.pendingAnalytics;
  if (!['RUNNING', 'STARTING'].includes(state.session.state) && !retryingDurableSave) return;
  setSessionState('FINISHING');
  try {
    const analyticsPromise = retryingDurableSave ? null : Promise.resolve().then(() => {
      const analytics = state.analytics?.endAnswer?.({ mediaAvailable: Boolean(state.durable?.recorder) });
      if (!analytics) return analytics;
      return Object.freeze({
        ...analytics,
        deliveryIntelligence: Object.freeze({
          schema: 'ivoc.delivery-intelligence.view-model.v1',
          readouts: state.filmGroups?.readouts || Object.freeze({}),
        }),
      });
    });
    const outcome = state.durable?.accountSession
      ? await state.durable.finish(analyticsPromise)
      : { persisted: false, analytics: await analyticsPromise, recording: null };
    state.lastSaved = outcome;
    if (state.localPlaybackUrl) URL.revokeObjectURL(state.localPlaybackUrl);
    state.localPlaybackUrl = outcome.recording?.blob ? URL.createObjectURL(outcome.recording.blob) : null;
    const playback = $('#playback');
    if (playback && state.localPlaybackUrl) playback.src = state.localPlaybackUrl;
    const save = $('#cockpit-save');
    if (save) {
      save.dataset.state = outcome.persisted ? 'saved' : 'error';
      save.textContent = outcome.persisted
        ? 'Saved privately to your authenticated Answer History.'
        : 'Rep complete, but no durable account record was created.';
    }
    renderPostAnswer(outcome.analytics);
    if (outcome.persisted) void renderVault();
    setSessionState('COMPLETE');
    setView('postanswer');
  } catch (error) {
    const save = $('#cockpit-save');
    if (save) { save.dataset.state = 'error'; save.textContent = `Save failed — ${String(error?.message || error).slice(0, 120)}. Press Finish again to retry the retained capture.`; }
    setSessionState('BLOCKED', `Could not finish cleanly: ${String(error?.message || error).slice(0, 120)}`);
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
  const ready = evaluateReadiness();
  const connect = $('#cockpit-connect');
  if (connect) {
    const live = ready === 'SESSION_READY' || ready === 'RUNNING';
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
  $('#cockpit-start')?.addEventListener('click', () => { void startRep(); });
  $('#cockpit-finish')?.addEventListener('click', () => { void finishRep(); });
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
    // Pipeline trace. The FIRST zero boundary is the breakpoint.
    ['— pipeline trace —', '', true],
    ['MEDIA PCM', String(state.audioDebug.pcmFrames), state.audioDebug.pcmFrames > 0],
    ['ANALYTICS PCM', String(state.trace.analyticsPcm), state.trace.analyticsPcm > 0],
    ['SPEECH INPUT', String(state.trace.speech), state.trace.speech > 0],
    ['PAUSE INPUT', String(state.trace.pause), state.trace.pause > 0],
    ['F0 VOICED', String(state.trace.f0), state.trace.f0 > 0],
    ['METRIC EVENTS', String(state.trace.metrics), state.trace.metrics > 0],
    ['UI DIAGNOSTICS', String(state.trace.diagnostics), state.trace.diagnostics > 0],
    ['SESSION STATE', state.session.state, !['IDLE', 'BLOCKED'].includes(state.session.state)],
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

/* ------------------------------------------------------------------ InterviewBrain
 * Browser WebRTC carries only the already-admitted microphone track and provider
 * audio. The same-origin API broker owns the OpenAI credential and fixes the model,
 * instructions and bounded MissionMed context on the server.
 */

function appendLiveTranscript({ speaker, text }) {
  const host = $('#live-transcript');
  if (!host) return;
  if (host.firstElementChild?.tagName === 'SPAN') host.replaceChildren();
  const row = document.createElement('p');
  const label = document.createElement('b');
  label.textContent = speaker === 'applicant' ? 'You · ' : 'Interviewer · ';
  row.append(label, document.createTextNode(text));
  host.append(row);
  host.scrollTop = host.scrollHeight;
}

function setLiveInterviewStatus({ state: next, detail }) {
  const stage = $('.live-interviewer-stage');
  if (stage) stage.dataset.state = next;
  const title = $('#sim-provider-state');
  const note = $('#sim-provider-note');
  const start = $('#live-interview-start');
  const end = $('#live-interview-end');
  if (title) title.textContent = {
    connecting: 'Connecting…', active: 'Live · listening', closed: 'Interview ended', error: 'Live interview unavailable', unavailable: 'Live voice unavailable', idle: 'Ready when you are',
  }[next] || next;
  if (note && detail) note.textContent = detail;
  if (start) start.disabled = ['connecting', 'active', 'unavailable'].includes(next);
  if (end) end.disabled = !['connecting', 'active'].includes(next);
}

function liveInterviewContext() {
  return createLiveContext({ wizard: state.wizard, interviewSet: state.interviewSet, targetQuestions: state.targetQuestions });
}

function wireLiveInterview() {
  if (typeof window.RTCPeerConnection !== 'function') {
    setLiveInterviewStatus({ state: 'error', detail: 'WebRTC is unavailable in this browser.' });
    return;
  }
  state.liveInterview = new LiveInterviewSession({
    createSession: createLiveInterview,
    endSession: endLiveInterview,
    audioElement: $('#live-interviewer-audio'),
    onStatus: setLiveInterviewStatus,
    onTranscript: appendLiveTranscript,
  });
  const available = state.admission?.runtime?.liveInterviewAvailable === true;
  setLiveInterviewStatus({ state: available ? 'idle' : 'unavailable', detail: available
    ? 'Uses your selected interviewer, program, Question Pool, and authorized context.'
    : 'Live voice is not configured in this environment.' });
  $('#live-interview-start')?.addEventListener('click', async () => {
    if (!state.admission?.runtime?.liveInterviewAvailable) {
      setLiveInterviewStatus({ state: 'error', detail: 'Live voice is not configured in this environment.' });
      return;
    }
    try {
      bridge.primeAudioContext();
      if (!bridge.media.stream?.getAudioTracks?.().some((track) => track.readyState === 'live')) {
        await bridge.requestMedia(true, true);
        bindPreview();
        renderDeviceCheck();
      }
      const track = bridge.media.stream.getAudioTracks()[0];
      const selectedVoice = state.role === 'admin'
        ? ($('#admin-live-voice')?.value || 'marin')
        : 'marin';
      await state.liveInterview.start({ audioTrack: track, voice: selectedVoice, context: liveInterviewContext() });
    } catch (error) {
      setLiveInterviewStatus({ state: 'error', detail: String(error?.message || error).slice(0, 180) });
    }
  });
  $('#live-interview-end')?.addEventListener('click', async () => {
    try { await state.liveInterview.stop(); }
    catch (error) { setLiveInterviewStatus({ state: 'error', detail: `Cleanup unconfirmed: ${String(error?.message || error).slice(0, 120)}` }); }
  });
  window.addEventListener('pagehide', () => {
    if (state.liveInterview?.sessionId) void state.liveInterview.stop({ keepalive: true }).catch(() => {});
  });
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

async function longitudinalModel({ refresh = false } = {}) {
  if (refresh) { state.longitudinal = null; state.longitudinalPromise = null; }
  if (state.longitudinal) return state.longitudinal;
  if (!state.longitudinalPromise) {
    state.longitudinalPromise = (async () => {
      if (!state.durableAvailable) throw state.durableError || new Error('durable_session_unavailable');
      const vault = await state.durable.library('own');
      state.longitudinal = buildLongitudinalModel(Array.isArray(vault?.sessions) ? vault.sessions : []);
      return state.longitudinal;
    })().finally(() => { state.longitudinalPromise = null; });
  }
  return state.longitudinalPromise;
}

function emptyEvidence(host, title, copy) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const strong = document.createElement('strong');
  strong.textContent = title;
  empty.append(strong, document.createTextNode(copy));
  host.replaceChildren(empty);
}

function formatEvidence(value, unit) {
  if (value === null || !Number.isFinite(Number(value))) return 'Unavailable';
  if (unit === 'ms') return `${(Number(value) / 1000).toFixed(1)} s`;
  if (unit === 'fraction') return `${(Number(value) * 100).toFixed(Number(value) < .01 ? 1 : 0)}%`;
  if (unit === 'dBFS') return `${Number(value).toFixed(1)} dBFS`;
  return String(value);
}

function metricCard(label, value, note) {
  const card = document.createElement('div');
  card.className = 'long-card';
  const cap = document.createElement('div'); cap.className = 'microcap'; cap.textContent = label;
  const number = document.createElement('strong'); number.textContent = value;
  const detail = document.createElement('span'); detail.textContent = note;
  card.append(cap, number, detail);
  return card;
}

async function renderProgress() {
  const host = $('#progress-body');
  if (!host) return;
  try {
    const model = await longitudinalModel();
    if (!model.totals.savedSessions) {
      emptyEvidence(host, 'No saved attempts yet', 'Complete and save a real recorded answer to begin your evidence-backed progress history. XP, rank, and badges are not fabricated.');
      return;
    }
    const grid = document.createElement('div'); grid.className = 'long-grid';
    grid.append(
      metricCard('Saved answers', String(model.totals.savedSessions), 'Completed durable sessions'),
      metricCard('Recorded practice', formatEvidence(model.totals.recordedMs, 'ms'), 'Private saved media time'),
      metricCard('Question breadth', String(model.totals.uniqueQuestions), 'Distinct practiced questions'),
      metricCard('Active days', String(model.totals.activeDays), 'Calendar days with saved work'),
    );
    const note = document.createElement('p'); note.className = 'microcap long-note';
    note.textContent = 'Personal history only · no population rank, seeded XP, or inferred mastery.';
    host.replaceChildren(grid, note);
  } catch (error) {
    emptyEvidence(host, 'Progress unavailable', String(error?.message || 'Authenticated Answer History required').toUpperCase().slice(0, 120));
  }
}

async function renderLongitudinal() {
  const host = $('#longitudinal-body');
  if (!host) return;
  try {
    const model = await longitudinalModel();
    if (!model.attempts.length) {
      emptyEvidence(host, 'No validated trend evidence yet', 'A saved answer with validated student-safe analytics creates the first personal evidence point.');
      return;
    }
    const rows = document.createElement('div'); rows.className = 'long-rows';
    for (const attempt of model.attempts.slice(0, 6)) {
      const row = document.createElement('div'); row.className = 'long-row';
      const identity = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = attempt.title;
      const when = document.createElement('span'); when.className = 'microcap'; when.textContent = attempt.at === null ? 'DATE UNAVAILABLE' : new Date(attempt.at).toLocaleString();
      identity.append(title, when);
      const evidence = document.createElement('span'); evidence.className = 'long-values';
      evidence.textContent = `${formatEvidence(attempt.metrics.answerDurationMs, 'ms')} · ${formatEvidence(attempt.metrics.capturedLevelDbfs, 'dBFS')} · ${formatEvidence(attempt.metrics.digitalClippingFraction, 'fraction')} clipping`;
      row.append(identity, evidence); rows.append(row);
    }
    const note = document.createElement('p'); note.className = 'microcap long-note';
    note.textContent = 'Validated student-safe observations only · unavailable means the evidence did not support a value.';
    host.replaceChildren(rows, note);
  } catch (error) {
    emptyEvidence(host, 'Longitudinal evidence unavailable', String(error?.message || 'Authenticated Answer History required').toUpperCase().slice(0, 120));
  }
}

async function renderCompare() {
  const host = $('#compare-body');
  if (!host) return;
  try {
    const model = await longitudinalModel();
    if (model.attempts.length < 2) {
      emptyEvidence(host, 'Needs two saved attempts', 'Your authenticated Answer History supplies the attempts. No pairwise delta is shown until two real saved answers exist.');
      return;
    }
    const makeSelect = (selected, otherIndex) => {
      const select = document.createElement('select'); select.className = 'q-search';
      model.attempts.forEach((attempt, index) => {
        const option = document.createElement('option'); option.value = String(index);
        option.textContent = `${attempt.title} · ${attempt.at === null ? 'date unavailable' : new Date(attempt.at).toLocaleDateString()}`;
        option.selected = index === selected; option.disabled = index === otherIndex; select.append(option);
      });
      return select;
    };
    const selectors = document.createElement('div'); selectors.className = 'compare-selectors';
    const left = makeSelect(state.comparePair[0], state.comparePair[1]);
    const right = makeSelect(state.comparePair[1], state.comparePair[0]);
    const bind = (select, slot) => select.addEventListener('change', () => { state.comparePair[slot] = Number(select.value); void renderCompare(); });
    bind(left, 0); bind(right, 1); selectors.append(left, right);
    const comparison = compareAttempts(model.attempts[state.comparePair[0]], model.attempts[state.comparePair[1]]);
    const table = document.createElement('div'); table.className = 'compare-table';
    for (const metric of comparison.metrics) {
      const row = document.createElement('div'); row.className = 'compare-row';
      const label = document.createElement('strong'); label.textContent = metric.label;
      const before = document.createElement('span'); before.textContent = formatEvidence(metric.left, metric.unit);
      const after = document.createElement('span'); after.textContent = formatEvidence(metric.right, metric.unit);
      const delta = document.createElement('span'); delta.textContent = metric.delta === null ? 'No comparable evidence' : `${metric.delta > 0 ? '+' : ''}${formatEvidence(metric.delta, metric.unit)}`;
      row.append(label, before, after, delta); table.append(row);
    }
    const note = document.createElement('p'); note.className = 'microcap long-note';
    note.textContent = 'Signed deltas are descriptive, not good/bad judgments. Captured mic level is device signal, not calibrated loudness.';
    host.replaceChildren(selectors, table, note);
  } catch (error) {
    emptyEvidence(host, 'Comparison unavailable', String(error?.message || 'Authenticated Answer History required').toUpperCase().slice(0, 120));
  }
}

async function renderVault() {
  const host = $('#vault-body');
  if (!host) return;
  host.replaceChildren();
  try {
    if (!state.durableAvailable) throw state.durableError || new Error('durable_session_unavailable');
    const vault = await state.durable.library('own');
    const sessions = Array.isArray(vault?.sessions) ? vault.sessions : [];
    state.longitudinal = buildLongitudinalModel(sessions);
    if (!sessions.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<strong>No saved answers</strong>Your authenticated Answer History is empty. Finish a real recorded rep to create the first private AnswerRecord.';
      host.append(empty);
      return;
    }
    for (const session of sessions) {
      const row = document.createElement('div');
      row.className = 'check-row vault-answer';
      const copy = document.createElement('div');
      copy.className = 'vault-answer-copy';
      const title = document.createElement('span');
      title.className = 'q-text';
      title.textContent = session.questionText || session.title || session.questionId || 'Saved answer';
      const meta = document.createElement('span');
      meta.className = 'microcap';
      const when = session.endedAt || session.startedAt || '';
      meta.textContent = `${session.state || 'saved'}${when ? ` · ${new Date(when).toLocaleString()}` : ''}`;
      copy.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'vault-answer-actions';
      if (session.recording?.id && session.recording?.status === 'saved') {
        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'btn btn-quiet';
        play.innerHTML = '<span>Play</span>';
        play.addEventListener('click', async () => {
          play.disabled = true;
          try {
            const signed = await state.durable.playback(session.recording.id);
            const video = $('#playback');
            state.filmGroups?.ingestResult(session?.results?.payload?.analytics || {});
            if (video) { video.src = signed.url; await video.play().catch(() => {}); setView('filmroom'); }
          } finally { play.disabled = false; }
        });
        actions.append(play);
      }
      if (['active', 'processing'].includes(session.state)) {
        const abandon = document.createElement('button');
        abandon.type = 'button';
        abandon.className = 'btn btn-quiet';
        abandon.innerHTML = '<span>End interrupted session</span>';
        abandon.addEventListener('click', async () => {
          abandon.disabled = true;
          try {
            await state.durable.api.abandonSession(session.id, { reason: 'owner_cleanup' });
            await renderVault();
          } finally { abandon.disabled = false; }
        });
        actions.append(abandon);
      }
      row.append(copy, actions);
      host.append(row);
    }
  } catch (error) {
    const note = document.createElement('p');
    note.className = 'unavailable';
    note.textContent = `ANSWER HISTORY UNAVAILABLE — ${String(error?.message || 'SESSION REQUIRED').toUpperCase().slice(0, 120)}`;
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
      playback: 'playback',
      playbackViews: ['filmroom'],
      liveRoutes: {
        training: {
          video: 'cockpit-video',
          stage: 'cockpit-stage',
          room: 'cockpit-stage',
          wrapper: 'cockpit-stage',
        },
      },
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
      state.trace.diagnostics += 1;
      if (detail.modality === 'audio') {
        state.trace.analyticsPcm += 1;
        if (detail.speaking === true) state.trace.speech += 1;
        if (detail.speaking === false) state.trace.pause += 1;
        if (detail.pitch?.voiced === true) state.trace.f0 += 1;
      }
      const frame = state.bus.ingest(detail);
      if (frame) state.trace.metrics += 1;
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
  for (const button of $$('[data-builder-step]')) {
    button.addEventListener('click', () => {
      state.wizardStep = Math.max(0, Math.min(WIZARD_STEPS.length - 1, Number(button.dataset.builderStep) || 0));
      showBuilderMode('wizard');
      renderWizard();
    });
  }
  for (const button of $$('[data-open-mode]')) {
    button.addEventListener('click', () => showBuilderMode(button.dataset.openMode));
  }
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

  $('#mode-wizard')?.addEventListener('click', () => showBuilderMode('wizard'));
  $('#mode-loadout')?.addEventListener('click', () => showBuilderMode('loadout'));
  $('#builder-open-pool')?.addEventListener('click', () => showBuilderMode('loadout'));
  $('#builder-target')?.addEventListener('input', (event) => {
    state.targetQuestions = Math.max(1, Math.min(30, Number(event.target.value) || 1));
    event.target.value = String(state.targetQuestions);
  });
  $('#context-analyze')?.addEventListener('click', () => { void analyzeLastAnswer(); });
}

function renderLoadoutConfig() {
  const host = $('#loadout-config');
  if (!host) return;
  const groups = [
    ['Interviewer', ['Voice only', 'Text prompts'], 'Dr Kelly / Dr Woods packs pending'],
    ['Difficulty', ['Standard', 'Pressure'], null],
    ['Follow-ups', ['None', 'Occasional'], 'Hybrid follow-up router pending'],
    ['Overlays', ['Standard', 'Minimal', 'Off'], 'Hiding overlays never stops measurement'],
    ['Recording', ['On'], 'Private account recording + authenticated Answer History'],
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

function renderPostAnswer(analytics = null) {
  const rail = statusRail(state.bus.latest);
  const worked = rail.find((item) => item.state === 'ok');
  const correction = selectCorrection(state.bus.latest);
  const entries = analytics ? [
    ['#post-worked', worked
      ? `<strong>${worked.label}</strong>Observed inside your validated session evidence. Open Film Room for the recording and full signal tracks.`
      : '<strong>No supported positive claim yet</strong>The session saved, but no student-safe signal reached an evidence threshold.'],
    ['#post-fix', correction.state === 'idle'
      ? '<strong>No supported correction yet</strong>The evidence does not justify a coaching claim for this answer.'
      : `<strong>${correction.headline}</strong>${correction.instruction}`],
  ] : [
    ['#post-worked', '<strong>Awaiting evidence</strong>No answer recorded in this session yet. Nothing is asserted without evidence.'],
    ['#post-fix', '<strong>Awaiting evidence</strong>A single correction appears here once a recorded answer produces delivery evidence.'],
  ];
  for (const [id, html] of entries) {
    const host = $(id);
    if (!host) continue;
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = html;
    host.replaceChildren(empty);
  }
  const contextButton = $('#context-analyze');
  if (contextButton) {
    const recordingId = state.lastSaved?.recording?.recording?.id;
    const answerId = state.lastSaved?.analytics?.answerId;
    const questionId = state.lastSaved?.session?.questionId;
    contextButton.disabled = !(state.lastSaved?.persisted && recordingId && answerId && questionId);
  }
}

function renderContextEvidence(result) {
  const host = $('#context-evidence');
  if (!host) return;
  host.replaceChildren();
  const transcript = result?.transcript;
  if (transcript?.status !== 'AVAILABLE') {
    const note = document.createElement('p');
    note.className = 'unavailable';
    note.textContent = `TRANSCRIPT UNAVAILABLE — ${String(transcript?.reason || 'PROVIDER UNAVAILABLE').toUpperCase().slice(0, 120)}`;
    host.append(note);
    return;
  }
  const quote = document.createElement('blockquote');
  quote.textContent = transcript.text;
  host.append(quote);
  const analysis = result?.analysis;
  if (analysis?.status === 'AVAILABLE' && Array.isArray(analysis.semanticObservations) && analysis.semanticObservations.length) {
    const label = document.createElement('div');
    label.className = 'microcap';
    label.textContent = 'Evidence-cited observations';
    const list = document.createElement('ul');
    for (const observation of analysis.semanticObservations) {
      const item = document.createElement('li');
      const refs = Array.isArray(observation.transcriptSegmentIds)
        ? observation.transcriptSegmentIds.join(', ')
        : 'source cited';
      item.textContent = `${observation.text} · ${refs}`;
      list.append(item);
    }
    host.append(label, list);
  } else {
    const note = document.createElement('p');
    note.className = 'unavailable';
    note.textContent = `CONTEXT ANALYSIS UNAVAILABLE — ${String(analysis?.reason || 'NO SUPPORTED OBSERVATIONS').toUpperCase().slice(0, 120)}`;
    host.append(note);
  }
  const privacy = document.createElement('p');
  privacy.className = 'microcap';
  privacy.textContent = 'Ephemeral result · transcript and semantic analysis were not persisted by Context.';
  host.append(privacy);
}

async function analyzeLastAnswer() {
  const button = $('#context-analyze');
  const saved = state.lastSaved;
  const recordingId = saved?.recording?.recording?.id;
  const sessionId = saved?.session?.id;
  const answerId = saved?.analytics?.answerId;
  const questionId = saved?.session?.questionId;
  if (!saved?.persisted || !recordingId || !sessionId || !answerId || !questionId) return;
  if (button) { button.disabled = true; button.innerHTML = '<span>Analyzing sealed answer…</span>'; }
  try {
    const result = await state.durable.analyze({
      sessionId,
      recordingId,
      answerId,
      questionId,
      analyticsEvents: Array.isArray(saved.analytics.studentEvents) ? saved.analytics.studentEvents : [],
    });
    renderContextEvidence(result);
  } catch (error) {
    renderContextEvidence({ transcript: { status: 'UNAVAILABLE', reason: String(error?.message || error).slice(0, 120) } });
  } finally {
    if (button) { button.disabled = false; button.innerHTML = '<span>Generate transcript + context</span>'; }
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
  window.addEventListener('pagehide', () => {
    void state.durable.abandon({ reason: 'pagehide', keepalive: true }).catch(() => {});
  }, { capture: true });

  try {
    state.admission = await loadIvPrepSession();
  } catch {
    state.admission = null;
  }
  applyIdentity();
  applyRole('student');

  if (state.admission?.admitted && state.admission?.runtime?.mode === 'hosted') {
    try {
      await state.durable.bootstrap();
      state.durableAvailable = state.durable.ready;
    } catch (error) {
      state.durableAvailable = false;
      state.durableError = error;
    }
  }

  wireLiveInterview();

  await mountAnalytics();

  const hash = String(location.hash || '').replace('#', '');
  setView(CRUMBS[hash] ? hash : 'home');
}

void boot();
