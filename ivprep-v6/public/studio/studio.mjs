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
  AdminStudentLibraryCapability,
  buildLongitudinalModel,
  COLLECTIONS,
  compareAttempts,
  contextResultFromSessionSpine,
  createDefaultQuestionStore,
  createLiveContext,
  createLiveInterview,
  DurableStudioSession,
  endLiveInterview,
  InstrumentRack,
  InterviewCalendarCapability,
  LiveInterviewSession,
  LiveMockStudioCapability,
  createMediaAnalyticsBridge,
  loadAnalyticsCapabilityModules,
  loadIvPrepSession,
  MetricBus,
  projectContextResults,
  projectTranscriptMetrics,
  resultLaneReadouts,
  selectCorrection,
  statusRail,
} from './capability-adapter.mjs';
import {
  buildContextSources,
  buildHomeViewModel,
  buildReadinessRows,
  persistedConversationTurns,
} from './presentation-view-model.mjs';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const CRUMBS = Object.freeze({
  home: 'Home', newsession: 'Build Interview', devicecheck: 'Device Calibration',
  training: 'Self Practice', simulation: 'AI Mock Interview', postanswer: 'Answer Review',
  filmroom: 'Recordings & Results', compare: 'Compare Attempts', lab: 'Progress Analytics', mentor: 'Mentor & Admin',
  governance: 'Question Governance', progress: 'My Progress', fingerprint: 'Delivery Profile', vault: 'Answer Library',
});

const store = createDefaultQuestionStore();
const ASTRA_PRESENTATION_CANON = 'dedb726bde521a135bec2286ad4cd5a877a68fc7ecd6144fde16b76bc9c09ac4';

const state = {
  view: 'home',
  launchMode: 'ai',
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
    program: '', programId: null, programReleaseId: null, programVerified: false,
    programSpecialty: '', programState: '', programType: '',
    environment: 'MissionMed', interviewMode: 'Interview Mode', analyticsEnabled: true,
    contextSources: [], storyForgeOptIn: null, storyForgeInclude: false,
    readinessPanel: 'Devices', readinessSignal: 'Camera', readiness: null,
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
  governedQuestions: [],
  adminOverview: null,
  adminLibrary: new AdminStudentLibraryCapability(),
  calendar: new InterviewCalendarCapability(),
  calendarProjection: null,
  calendarState: 'idle',
  liveMock: new LiveMockStudioCapability(),
  vaultFilter: { query: '', evidence: 'all' },
  mentorPriorities: null,
  homeLibrary: [],
  deviceError: null,
  programSearch: { status: 'idle', records: [], total: 0, error: null },
};

const bridge = createMediaAnalyticsBridge();

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
  if (state.role === 'admin' && state.view === 'mentor') void renderAdminOverview();
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
  if (view === 'simulation') bindSimulationVideo();
  if (view === 'lab') { mountLabInstruments(); void renderLongitudinal(); }
  if (view === 'compare') void renderCompare();
  if (view === 'progress') void renderProgress();
  if (view === 'governance') void refreshQuestionGovernance();
  if (view === 'mentor') void renderAdminOverview();
  if (view === 'filmroom' && state.lastSaved) {
    renderFilmRoomSpine(state.lastSaved.sessionDetail, state.lastSaved.envelope);
  }
  if (view === 'vault') void renderVault();
  if (focus) $('#main-content')?.focus?.({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function renderAdminFacts(host, facts) {
  if (!host) return;
  const list = document.createElement('dl');
  list.className = 'admin-fact-list';
  for (const fact of facts) {
    const row = document.createElement('div');
    row.className = 'admin-fact';
    const key = document.createElement('dt');
    key.textContent = fact.label;
    const value = document.createElement('dd');
    value.textContent = fact.value;
    if (fact.state) value.dataset.state = fact.state;
    row.append(key, value);
    list.append(row);
  }
  host.replaceChildren(list);
}

function renderIntegrationFacts(host, { liveMock = 'CHECKING OWNER', liveMockReady = false } = {}) {
  renderAdminFacts(host, [
    { label: 'Match Bridge', value: 'BOUNDED CLIPS READY', state: 'ready' },
    { label: 'Live Mock Studio', value: liveMock, state: liveMockReady ? 'ready' : 'limited' },
    { label: 'File Vault / RISE / StoryForge', value: 'OWNER PROJECTION REQUIRED', state: 'limited' },
    { label: 'LemonSlice', value: 'DEFERRED', state: 'limited' },
  ]);
}

async function renderAdminOverview() {
  if (state.role !== 'admin') return;
  const configHost = $('[data-admin-summary="config"]');
  const creditHost = $('[data-admin-summary="credits"]');
  const questionHost = $('[data-admin-summary="questions"]');
  const integrationHost = $('[data-admin-summary="integrations"]');
  const liveMockHost = $('#live-mock-studio');
  const studentLibraryHost = $('#admin-student-library');
  if (!configHost || !creditHost || !questionHost || !integrationHost) return;

  renderIntegrationFacts(integrationHost);
  if (liveMockHost) void renderLiveMockStudio(liveMockHost, integrationHost);
  if (studentLibraryHost) void renderAdminStudentLibrary(studentLibraryHost);

  try {
    const overview = state.adminOverview || await state.durable.adminOverview();
    state.adminOverview = overview;
    const config = overview.config || {};
    const account = overview.credits?.account || {};
    const questions = Array.isArray(overview.questions?.questions) ? overview.questions.questions : [];
    const active = questions.filter((item) => item.status === 'active').length;
    const retired = questions.filter((item) => item.status === 'retired').length;
    renderAdminFacts(configHost, [
      { label: 'Policy version', value: config.version ? `v${config.version}` : 'UNAVAILABLE', state: config.version ? 'ready' : 'limited' },
      { label: 'Analytics', value: config.analyticsConfigVersion || 'UNAVAILABLE', state: config.analyticsConfigVersion ? 'ready' : 'limited' },
      { label: 'InterviewBrain', value: config.brainPackVersion || 'UNAVAILABLE', state: config.brainPackVersion ? 'ready' : 'limited' },
      { label: 'Follow-up intensity', value: Number.isInteger(config.pressureDefaults?.defaultFollowUpIntensity) ? String(config.pressureDefaults.defaultFollowUpIntensity) : 'UNAVAILABLE' },
    ]);
    renderAdminFacts(creditHost, [
      { label: 'Subject', value: account.subjectId || 'UNAVAILABLE' },
      { label: 'Account version', value: `v${Number(account.version || 0)}` },
      { label: 'Balance', value: `${Math.max(0, Number(account.balanceSeconds || 0))} SEC`, state: Number(account.balanceSeconds || 0) > 0 ? 'ready' : 'limited' },
      { label: 'Consumed', value: `${Math.max(0, Number(account.consumedSeconds || 0))} SEC` },
    ]);
    renderAdminFacts(questionHost, [
      { label: 'Catalog authority', value: overview.questions?.admin === true ? 'ADMIN VERSIONED' : 'READ ONLY', state: overview.questions?.admin === true ? 'ready' : 'limited' },
      { label: 'Total governed', value: String(questions.length) },
      { label: 'Active', value: String(active), state: active > 0 ? 'ready' : 'limited' },
      { label: 'Retired / hidden', value: String(retired) },
    ]);
  } catch (error) {
    const reason = String(error?.message || 'ADMIN CAPABILITY UNAVAILABLE').toUpperCase().slice(0, 90);
    for (const host of [configHost, creditHost, questionHost]) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const strong = document.createElement('strong');
      strong.textContent = 'Admin data unavailable';
      empty.append(strong, document.createTextNode(reason));
      host.replaceChildren(empty);
    }
  }
}

let adminStudentLibraryRenderId = 0;

async function openAdminStudentSession(session, destination, action) {
  action.disabled = true;
  try {
    const detail = await state.adminLibrary.session(session.id);
    const analytics = detail?.results?.payload?.analytics || null;
    state.lastSaved = {
      persisted: true,
      session,
      sessionDetail: detail,
      analytics,
      recording: detail?.recording ? { recording: detail.recording } : null,
    };
    state.filmGroups?.ingestResult(analytics || {});
    if (destination === 'postanswer') {
      renderPostAnswer(analytics);
      renderContextEvidence(contextResultFromSessionSpine(detail));
      setView('postanswer');
      return;
    }
    const playback = await state.adminLibrary.playback(session.recording.id);
    const video = $('#playback');
    renderFilmRoomSpine(detail);
    if (video) {
      video.src = playback.url;
      await video.play().catch(() => {});
    }
    setView('filmroom');
  } finally {
    action.disabled = false;
  }
}

async function renderAdminStudentLibrary(host) {
  const renderId = ++adminStudentLibraryRenderId;
  host.replaceChildren();
  try {
    const library = await state.adminLibrary.overview();
    if (renderId !== adminStudentLibraryRenderId || state.role !== 'admin' || state.view !== 'mentor') return;
    if (!library.students.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<strong>No authorized practice yet</strong>Student sessions appear here only after they are durably saved.';
      host.append(empty);
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'admin-library-toolbar';
    const selector = document.createElement('select');
    selector.className = 'q-search';
    selector.setAttribute('aria-label', 'Authorized student');
    for (const student of library.students) {
      const option = document.createElement('option');
      option.value = student.subject;
      option.textContent = `${student.displayName} · ${student.sessions.length} session${student.sessions.length === 1 ? '' : 's'}`;
      selector.append(option);
    }
    const summary = document.createElement('span');
    summary.className = 'microcap';
    summary.textContent = `${library.studentCount} AUTHORIZED STUDENT${library.studentCount === 1 ? '' : 'S'} · ${library.sessionCount} SESSIONS`;
    toolbar.append(selector, summary);

    const rows = document.createElement('div');
    rows.className = 'admin-library-rows';
    const paint = () => {
      rows.replaceChildren();
      const student = library.students.find((item) => item.subject === selector.value) || library.students[0];
      for (const session of student.sessions) {
        const row = document.createElement('div');
        row.className = 'admin-library-row';
        const copy = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = session.title;
        const meta = document.createElement('span');
        meta.className = 'microcap';
        const when = session.endedAt ? new Date(session.endedAt).toLocaleString() : 'DATE UNAVAILABLE';
        const evidence = session.answerHistory.supportedObservationCount
          ? `${session.answerHistory.supportedObservationCount} SUPPORTED OBSERVATION${session.answerHistory.supportedObservationCount === 1 ? '' : 'S'}`
          : (session.answerHistory.transcriptAvailable ? 'TRANSCRIPT AVAILABLE' : 'EVIDENCE PENDING');
        meta.textContent = `${session.questionId || session.state.toUpperCase()} · ${evidence} · ${when}`;
        copy.append(title, meta);
        const actions = document.createElement('div');
        actions.className = 'admin-library-actions';
        if (session.resultsAvailable) {
          const results = document.createElement('button');
          results.type = 'button'; results.className = 'btn btn-quiet'; results.innerHTML = '<span>Open Results</span>';
          results.addEventListener('click', () => void openAdminStudentSession(session, 'postanswer', results));
          actions.append(results);
        }
        if (session.recording) {
          const film = document.createElement('button');
          film.type = 'button'; film.className = 'btn btn-quiet'; film.innerHTML = '<span>Open Film Room</span>';
          film.addEventListener('click', () => void openAdminStudentSession(session, 'filmroom', film));
          actions.append(film);
        }
        if (!actions.childElementCount) {
          const pending = document.createElement('span');
          pending.className = 'microcap'; pending.textContent = 'SESSION EVIDENCE PENDING';
          actions.append(pending);
        }
        row.append(copy, actions);
        rows.append(row);
      }
    };
    selector.addEventListener('change', paint);
    host.append(toolbar, rows);
    paint();
  } catch (error) {
    if (renderId !== adminStudentLibraryRenderId || state.role !== 'admin' || state.view !== 'mentor') return;
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<strong>Student library unavailable</strong>The Admin capability failed closed; no private session was inferred.';
    host.append(empty);
  }
}

let liveMockRenderId = 0;

async function renderLiveMockStudio(host, integrationHost) {
  const renderId = ++liveMockRenderId;
  host.replaceChildren();
  try {
    const queue = await state.liveMock.adminQueue();
    if (renderId !== liveMockRenderId || state.role !== 'admin' || state.view !== 'mentor') return;
    const eligible = queue.appointments.filter((item) => item.recordingEligible);
    renderIntegrationFacts(integrationHost, {
      liveMock: `SCHEDULER CONNECTED · ${eligible.length} WEBEX`, liveMockReady: true,
    });
    if (!eligible.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<strong>No Webex mocks ready</strong>The Scheduler owner is connected; no authorized Webex appointment is currently eligible for recording pickup.';
      host.append(empty);
      return;
    }
    for (const appointment of eligible.slice(0, 6)) {
      const row = document.createElement('div');
      row.className = 'live-mock-row';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = appointment.label;
      const meta = document.createElement('span');
      meta.className = 'microcap';
      meta.textContent = `${appointment.status.toUpperCase()}${appointment.startsAt ? ` · ${new Date(appointment.startsAt).toLocaleString()}` : ''}`;
      copy.append(title, meta);
      const action = document.createElement('button');
      action.type = 'button'; action.className = 'btn btn-quiet'; action.innerHTML = '<span>Check recording</span>';
      action.addEventListener('click', async () => {
        action.disabled = true;
        try {
          const status = await state.liveMock.recordingStatus(appointment.id);
          action.innerHTML = `<span>${status.playbackAvailable ? 'Private playback available' : status.status === 'processing' ? 'Recording processing' : 'Recording unavailable'}</span>`;
        } catch { action.innerHTML = '<span>Owner adapter unavailable</span>'; }
      });
      row.append(copy, action); host.append(row);
    }
    const note = document.createElement('p');
    note.className = 'admin-boundary-note';
    note.textContent = 'Scheduler/Webex remains the owner. IVOC checks authorized recording readiness without downloading or claiming sibling media.';
    host.append(note);
  } catch {
    if (renderId !== liveMockRenderId || state.role !== 'admin' || state.view !== 'mentor') return;
    renderIntegrationFacts(integrationHost, { liveMock: 'OWNER ADAPTER UNAVAILABLE' });
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<strong>Live Mock owner unavailable</strong>The supervised adapter failed closed. No appointment or recording state was inferred.';
    host.append(empty);
  }
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

function applyHomeModel() {
  const model = buildHomeViewModel({
    identity: state.admission?.identity || null,
    sessions: state.homeLibrary,
    mentorPriorities: state.mentorPriorities,
  });
  const values = {
    '#home-initials': model.initials,
    '#home-first-name': model.greetingName,
    '#home-continue-title': model.continueTitle,
    '#home-continue-note': model.continueNote,
    '#home-mentor-label': model.mentorLabel,
    '#home-mentor-priority': `“${model.mentorPriority}”`,
  };
  Object.entries(values).forEach(([selector, value]) => {
    const node = $(selector);
    if (node) node.textContent = value;
  });
}

async function hydrateHome() {
  if (!state.durableAvailable) {
    applyHomeModel();
    return;
  }
  const [library, priorities] = await Promise.allSettled([
    state.durable.library('own'),
    state.durable.mentorPriorities(),
  ]);
  state.homeLibrary = library.status === 'fulfilled' && Array.isArray(library.value?.sessions)
    ? library.value.sessions
    : [];
  state.mentorPriorities = priorities.status === 'fulfilled' ? priorities.value : null;
  applyHomeModel();
  if (state.view === 'newsession' && WIZARD_STEPS[state.wizardStep]?.key === 'environment') renderWizard();
}

function governanceStatus(message, stateName = '') {
  const node = $('#question-governance-status');
  if (!node) return;
  node.textContent = message;
  node.dataset.state = stateName;
}

function questionPayloadFromCard(card, status = null) {
  return {
    expectedVersion: Number(card.dataset.version),
    status: status || card.querySelector('[data-field="status"]').value,
    canonicalText: card.querySelector('[data-field="canonicalText"]').value,
    category: card.querySelector('[data-field="category"]').value,
    tags: card.querySelector('[data-field="tags"]').value.split(',').map((tag) => tag.trim()).filter(Boolean),
    source: card.querySelector('[data-field="source"]').value,
    changeReason: card.querySelector('[data-field="changeReason"]').value,
  };
}

function renderQuestionGovernance() {
  const host = $('#question-governance-list');
  if (!host) return;
  host.replaceChildren();
  if (!state.governedQuestions.length) {
    const empty = el('div', 'empty-state');
    empty.append(el('strong', '', 'No governed overrides yet'), document.createTextNode('The 193 canonical seed questions remain active. Add or override a stable ID without deleting its history.'));
    host.append(empty); return;
  }
  for (const record of state.governedQuestions) {
    const card = el('article', 'governance-card');
    card.dataset.questionId = record.questionId;
    card.dataset.version = String(record.version);
    const head = el('div', 'governance-card-head');
    head.append(el('strong', '', record.questionId), el('span', 'microcap', `${record.status} · version ${record.version}`));
    const fields = el('div', 'governance-card-fields');
    const makeField = (label, field, value, className = '') => {
      const wrapper = el('label', `field-label ${className}`.trim(), label);
      const input = field === 'canonicalText' ? document.createElement('textarea') : document.createElement('input');
      input.className = 'q-search'; input.dataset.field = field; input.value = value || '';
      wrapper.append(input); return wrapper;
    };
    fields.append(
      makeField('Question', 'canonicalText', record.canonicalText, 'question-copy'),
      makeField('Category', 'category', record.category),
      makeField('Tags', 'tags', record.tags.join(', ')),
      makeField('Source', 'source', record.source),
      makeField('Change reason', 'changeReason', record.changeReason),
    );
    const status = document.createElement('select');
    status.className = 'q-search'; status.dataset.field = 'status';
    for (const value of ['active', 'hidden', 'retired']) {
      const option = document.createElement('option'); option.value = value; option.textContent = value; option.selected = record.status === value; status.append(option);
    }
    const statusField = el('label', 'field-label', 'Visibility'); statusField.append(status); fields.append(statusField);
    const actions = el('div', 'governance-actions');
    const save = el('button', 'btn btn-secondary', 'Save new version'); save.type = 'button';
    save.disabled = record.status === 'retired';
    save.addEventListener('click', async () => {
      save.disabled = true;
      try { await state.durable.api.updateQuestion(record.questionId, questionPayloadFromCard(card)); await refreshQuestionGovernance(); governanceStatus(`${record.questionId} version saved.`, 'saved'); }
      catch (error) { governanceStatus(String(error?.message || error), 'error'); save.disabled = false; }
    });
    const retire = el('button', 'btn btn-quiet', 'Retire'); retire.type = 'button'; retire.disabled = record.status === 'retired';
    retire.addEventListener('click', async () => {
      retire.disabled = true;
      try { await state.durable.api.updateQuestion(record.questionId, questionPayloadFromCard(card, 'retired')); await refreshQuestionGovernance(); governanceStatus(`${record.questionId} retired with history preserved.`, 'saved'); }
      catch (error) { governanceStatus(String(error?.message || error), 'error'); retire.disabled = false; }
    });
    actions.append(save, retire); card.append(head, fields, actions); host.append(card);
  }
}

async function refreshQuestionGovernance() {
  if (!state.durable.ready) return;
  try {
    const payload = await state.durable.api.questions();
    state.governedQuestions = Array.isArray(payload.questions) ? payload.questions : [];
    store.applyGovernance(state.governedQuestions);
    renderQuestionGovernance(); collectionChips(); renderQuestions(); renderSet(); renderWizard(); renderHomeCorpus();
  } catch (error) {
    governanceStatus(String(error?.message || error), 'error');
  }
}

function wireQuestionGovernance() {
  $('#question-create-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    governanceStatus('Saving version 1…');
    try {
      await state.durable.api.addQuestion({
        questionId: String(data.get('questionId') || '').trim().toUpperCase(), expectedVersion: 0, status: 'active',
        canonicalText: String(data.get('canonicalText') || ''), category: String(data.get('category') || ''),
        tags: String(data.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean),
        source: String(data.get('source') || '').trim().toLowerCase(), changeReason: String(data.get('changeReason') || ''),
      });
      form.reset(); form.elements.source.value = 'admin_custom';
      await refreshQuestionGovernance(); governanceStatus('Question added with immutable version 1.', 'saved');
    } catch (error) { governanceStatus(String(error?.message || error), 'error'); }
  });
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
    empty.innerHTML = '<strong>No matches</strong>No question matches that search.';
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

function wizardStepComplete(index) {
  const key = WIZARD_STEPS[index]?.key;
  if (key === 'questions') return state.interviewSet.length > 0;
  if (key === 'program') return state.wizard.programVerified === true;
  if (key === 'readiness') {
    const preview = $('#builder-readiness-stage video') || $('#devicecheck-stage video');
    return Boolean(liveTrack('video') && liveTrack('audio')
      && bridge.media.AC?.state === 'running' && videoSurfaceReady(preview));
  }
  return Boolean(state.wizard[key]);
}

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
    const complete = wizardStepComplete(index);
    button.className = index === state.wizardStep ? 'current' : complete ? 'complete' : '';
    if (index === state.wizardStep) button.setAttribute('aria-current', 'step');
    button.innerHTML = `<span>${complete ? '✓' : index + 1}</span><b>${step.label}</b>`;
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
  state.interviewSet.forEach((question, index) => {
    const row = el('div', 'pool-preview-row');
    row.append(el('span', '', `${question.question_id} · ${question.canonical_text}`));
    const controls = el('div', 'pool-preview-controls');
    const move = (offset) => {
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= state.interviewSet.length) return;
      const next = [...state.interviewSet];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      state.interviewSet = next;
      renderSet(); renderWizard();
    };
    [['↑', 'Move earlier', -1], ['↓', 'Move later', 1], ['×', 'Remove', 0]].forEach(([label, action, offset]) => {
      const button = el('button', '', label); button.type = 'button'; button.setAttribute('aria-label', `${action}: ${question.canonical_text}`);
      button.disabled = (offset === -1 && index === 0) || (offset === 1 && index === state.interviewSet.length - 1);
      button.addEventListener('click', () => {
        if (action === 'Remove') {
          state.interviewSet = state.interviewSet.filter((entry) => entry.question_id !== question.question_id);
          state.wizard.questions = state.interviewSet.length ? 'Custom Question Pool' : null;
          renderSet(); renderWizard();
        } else move(offset);
      });
      controls.append(button);
    });
    row.append(controls); preview.append(row);
  });
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
  } else if (!state.wizard.questionSection) {
    visible = [];
  } else {
    visible = visible.filter((question) => categoryForQuestion(question) === state.wizard.questionCategory)
      .filter((question) => questionSection(question) === state.wizard.questionSection);
  }
  branch.append(el('h3', '', state.wizard.questionSearch || state.wizard.questionSection
    ? 'Choose specific questions'
    : 'Choose a subcategory to see its questions'));
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
  if (!visible.length && (state.wizard.questionSearch || state.wizard.questionSection)) list.append(el('p', 'canon-muted', 'No questions match. Clear search or choose another branch.'));
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
    panel.innerHTML = '<div class="canon-presence-orb" aria-hidden="true"><span>IV</span></div><div><div class="microcap">Interviewer voice</div><h2>Give the conversation <em>a presence.</em></h2><p>Choose an available interviewer voice for a natural spoken practice conversation.</p></div>';
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

let calendarLoadId = 0;

async function refreshInterviewCalendar() {
  const loadId = ++calendarLoadId;
  state.calendarState = 'loading';
  try {
    const projection = await state.calendar.studentCalendar();
    if (loadId !== calendarLoadId) return;
    state.calendarProjection = projection;
    state.calendarState = 'ready';
  } catch {
    if (loadId !== calendarLoadId) return;
    state.calendarProjection = null;
    state.calendarState = 'unavailable';
  }
  if (state.view === 'newsession' && WIZARD_STEPS[state.wizardStep]?.key === 'program') renderWizard();
}

function renderProgramCalendar(host) {
  const panel = el('section', 'canon-program-result canon-calendar-context');
  panel.append(el('div', 'microcap', 'Interview calendar'));
  if (state.calendarState === 'idle') void refreshInterviewCalendar();
  if (state.calendarState === 'idle' || state.calendarState === 'loading') {
    panel.append(el('h3', '', 'Checking your authorized schedule…'), el('p', 'canon-muted', 'Looking for interviews already connected to your MissionMed account.'));
  } else if (state.calendarState === 'unavailable') {
    panel.dataset.state = 'unavailable';
    panel.append(el('h3', '', 'Calendar unavailable'), el('p', 'canon-muted', 'No interview timing was inferred. You can continue with manual program preparation.'));
  } else if (!state.calendarProjection?.nextEvent) {
    panel.dataset.state = 'ready';
    panel.append(
      el('h3', '', 'Calendar connected'),
      el('p', 'canon-muted', `${state.calendarProjection?.eventCount || 0} authorized appointment${state.calendarProjection?.eventCount === 1 ? '' : 's'} found · none upcoming.`),
    );
  } else {
    const next = state.calendarProjection.nextEvent;
    panel.dataset.state = 'ready';
    panel.append(
      el('h3', '', next.title),
      el('p', 'canon-muted', `${new Date(next.startsAt).toLocaleString()} · ${next.provider.toUpperCase()} · ${next.status.toUpperCase()}`),
      el('p', 'admin-boundary-note', `Join details ${next.joinAvailable ? 'are available in your connected calendar' : 'are not available yet'}.`),
    );
  }
  host.append(panel);
}

function renderProgramStep(host) {
  let searchButton;
  const updateProgramSearchAvailability = () => {
    if (!searchButton) return;
    searchButton.disabled = state.programSearch.status === 'loading' || !state.durableAvailable
      || ![state.wizard.program, state.wizard.programSpecialty, state.wizard.programState]
        .some((value) => String(value || '').trim());
  };
  const photo = el('div', 'canon-photo-heading');
  const image = el('img'); image.src = '/iv-prep-on-call/assets/studio/astra-assets/rise.png'; image.alt = '';
  const copy = el('div'); copy.append(el('h2', '', 'Know the room.'), el('p', '', 'Search and select verified program intelligence, or continue with a manual entry.'));
  photo.append(image, copy); host.append(photo);
  const search = el('label', 'canon-search'); search.append(el('span', 'microcap', 'Program name'));
  const input = el('input'); input.type = 'search'; input.placeholder = 'Search program name…'; input.value = state.wizard.program;
  input.addEventListener('input', () => {
    state.wizard.program = input.value;
    state.wizard.programId = null; state.wizard.programReleaseId = null; state.wizard.programVerified = false;
    state.wizard.contextSources = state.wizard.contextSources.filter((entry) => entry !== 'RISE');
    state.programSearch = { status: 'idle', records: [], total: 0, error: null };
    updateProgramSearchAvailability();
  }); search.append(input); host.append(search);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    searchButton?.click();
  });
  const filters = el('div', 'canon-program-filters');
  [['Specialty', 'All specialties', 'programSpecialty', 'Internal Medicine,Family Medicine,Pediatrics,Surgery,Psychiatry'], ['State', 'All states', 'programState', 'Massachusetts,New York,California,Texas,Florida'], ['Program type', 'All program types', 'programType', 'University,Community,University-affiliated']].forEach(([labelText, placeholder, key, values]) => {
    const label = el('label', 'canon-field'); label.append(el('span', '', labelText)); const select = el('select');
    select.append(new Option(placeholder, ''));
    values.split(',').forEach((value) => select.append(new Option(value, value)));
    select.value = state.wizard[key]; select.addEventListener('change', () => {
      state.wizard[key] = select.value;
      state.wizard.programId = null; state.wizard.programReleaseId = null; state.wizard.programVerified = false;
      state.wizard.contextSources = state.wizard.contextSources.filter((entry) => entry !== 'RISE');
      state.programSearch = { status: 'idle', records: [], total: 0, error: null };
      updateProgramSearchAvailability();
    }); label.append(select); filters.append(label);
  });
  host.append(filters);
  const searchActions = el('div', 'canon-inline-actions');
  searchButton = choiceButton({ className: 'btn btn-primary', label: state.programSearch.status === 'loading' ? 'Searching…' : 'Search verified programs', onClick: async () => {
    if (state.programSearch.status === 'loading') return;
    state.programSearch = { status: 'loading', records: [], total: 0, error: null };
    renderWizard();
    try {
      const result = await state.durable.programs({
        q: state.wizard.program,
        specialty: state.wizard.programSpecialty,
        jurisdiction: state.wizard.programState,
        programType: state.wizard.programType,
      });
      state.programSearch = { status: 'ready', records: result.records || [], total: result.total || 0, error: null, registryReleaseId: result.registryReleaseId };
    } catch (error) {
      state.programSearch = { status: 'error', records: [], total: 0, error: String(error?.message || error).slice(0, 120) };
    }
    renderWizard();
  } });
  updateProgramSearchAvailability();
  searchActions.append(searchButton); host.append(searchActions);

  if (state.programSearch.status === 'ready') {
    const list = el('div', 'canon-program-results');
    list.append(el('div', 'microcap', `${state.programSearch.total} verified result${state.programSearch.total === 1 ? '' : 's'}`));
    for (const program of state.programSearch.records) {
      list.append(choiceButton({
        className: 'canon-program-result', selected: state.wizard.programId === program.id,
        label: program.name,
        detail: [program.specialty, [program.city, program.state].filter(Boolean).join(', '), program.programType].filter(Boolean).join(' · '),
        onClick: () => {
          state.wizard.program = program.name;
          state.wizard.programId = program.id;
          state.wizard.programReleaseId = state.programSearch.registryReleaseId;
          state.wizard.programVerified = true;
          state.wizard.programSpecialty = program.specialty || state.wizard.programSpecialty;
          state.wizard.programState = program.state || state.wizard.programState;
          state.wizard.programType = program.programType || state.wizard.programType;
          state.wizard.contextSources = [...new Set([...state.wizard.contextSources, 'RISE'])];
          renderWizard();
        },
      }));
    }
    if (!state.programSearch.records.length) list.append(el('p', 'canon-muted', 'No verified programs matched. Refine the name, specialty, or state, or continue with a clearly labeled manual entry.'));
    host.append(list);
  } else if (state.programSearch.status === 'error') {
    host.append(el('p', 'unavailable', `PROGRAM SEARCH UNAVAILABLE — ${state.programSearch.error.toUpperCase()}`));
  }
  const result = el('div', 'canon-program-result');
  result.append(el('div', 'microcap', state.wizard.programVerified ? 'Verified RISE program selected' : state.wizard.program ? 'Manual program entry' : 'Program search'));
  result.append(el('h3', '', state.wizard.program || 'Choose a program or enter one manually'));
  result.append(el('p', 'canon-muted', state.wizard.programVerified
    ? `${state.wizard.programSpecialty || 'Specialty unavailable'} · ${state.wizard.programState || 'State unavailable'} · ${state.wizard.programType || 'Type unavailable'} · verified release ${state.wizard.programReleaseId}`
    : state.wizard.program
      ? 'Manual entry only · verified RISE context is not included until you select a search result.'
    : 'Verified RISE program intelligence will hydrate the cheat sheet when available. No program facts are invented.'));
  const facts = el('div', 'canon-cheat-sheet');
  ['Training focus', 'Leadership and interviewers', 'Curriculum and pathways', 'Research, facilities, and fellowships'].forEach((fact) => {
    const row = el('div'); row.append(el('strong', '', fact), el('span', '', state.wizard.programVerified ? 'Authorized detail will hydrate when the interview session begins.' : 'Not available until a verified program is selected.')); facts.append(row);
  });
  result.append(facts); host.append(result); renderProgramCalendar(host);
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
  const sources = buildContextSources({
    mentorPriorities: state.mentorPriorities,
    durableAvailable: state.durableAvailable,
    contextCapabilities: state.durable.bootstrapPayload?.capabilities?.contextSources || {},
  });
  const storyForge = sources.find((source) => source.name === 'StoryForge');
  const story = el('div', 'canon-story-context');
  story.append(el('div', 'microcap', 'StoryForge'), el('h3', '', 'Bring a story when it helps.'), el('p', 'canon-muted', 'Would you like suggestions from your authorized stories for this practice? Your answer stays yours.'));
  const storyActions = el('div', 'canon-inline-actions');
  const chooseStoryForge = (enabled) => {
    state.wizard.storyForgeOptIn = enabled;
    state.wizard.storyForgeInclude = false;
    state.wizard.contextSources = state.wizard.contextSources.filter((entry) => entry !== 'StoryForge');
    renderWizard();
  };
  const yes = choiceButton({ className: 'btn btn-secondary', selected: state.wizard.storyForgeOptIn === true, label: 'Yes, show suggestions', onClick: () => chooseStoryForge(true) });
  yes.disabled = !storyForge?.available;
  const no = choiceButton({ className: 'btn btn-quiet', selected: state.wizard.storyForgeOptIn === false, label: 'No, practice unaided', onClick: () => chooseStoryForge(false) });
  storyActions.append(yes, no); story.append(storyActions);
  if (!storyForge?.available) {
    story.append(el('p', 'canon-consent-note', 'Story suggestions are unavailable for this account and remain excluded.'));
  } else if (state.wizard.storyForgeOptIn === true) {
    const reveal = el('div', 'canon-story-suggestion');
    reveal.append(
      el('div', 'microcap', 'Authorized suggestions'),
      el('h3', '', 'No verified story suggestion is available for this draft yet.'),
      el('p', '', state.interviewSet.length
        ? `Your ${state.interviewSet.length} selected question${state.interviewSet.length === 1 ? '' : 's'} can guide a secure match. No story has been added.`
        : 'Choose at least one question to establish relevance. Until then, no story is added.'),
    );
    reveal.append(choiceButton({ className: 'canon-story-include', selected: state.wizard.storyForgeInclude === true, label: 'Include authorized matching stories if a verified match is found', detail: 'This separate consent allows only approved story summaries to enter the interview context.', onClick: () => {
      state.wizard.storyForgeInclude = !state.wizard.storyForgeInclude;
      state.wizard.contextSources = state.wizard.storyForgeInclude ? [...new Set([...state.wizard.contextSources, 'StoryForge'])] : state.wizard.contextSources.filter((entry) => entry !== 'StoryForge');
      renderWizard();
    } }));
    story.append(reveal);
  } else {
    story.append(el('p', 'canon-consent-note', state.wizard.storyForgeOptIn === false ? 'Suggestions are hidden and StoryForge is excluded from this interview.' : 'Story suggestions stay hidden until you choose Yes.'));
  }
  sources.filter(({ name }) => name !== 'StoryForge').forEach(({ name, available, detail, connected = false }) => sourceGrid.append(choiceButton({
    className: 'canon-source-card', selected: state.wizard.contextSources.includes(name), label: name,
    detail: `${detail} · ${available ? 'Available' : connected ? 'Nothing selected yet' : 'Not connected'}`,
    onClick: () => {
      if (!available) return;
      state.wizard.contextSources = state.wizard.contextSources.includes(name)
        ? state.wizard.contextSources.filter((entry) => entry !== name) : [...state.wizard.contextSources, name];
      renderWizard();
    },
  })));
  const nonStorySources = sources.filter(({ name }) => name !== 'StoryForge');
  [...sourceGrid.children].forEach((button, index) => { if (!nonStorySources[index].available) { button.disabled = true; button.setAttribute('aria-disabled', 'true'); } });
  context.append(story, sourceGrid); layout.append(environment, context); host.append(layout);
}

function readinessRows() {
  return buildReadinessRows({
    media: bridge.media,
    metrics: state.bus.latest,
    durableAvailable: state.durableAvailable,
    mediaRecorderSupported: typeof MediaRecorder !== 'undefined',
  });
}

const READINESS_PANELS = Object.freeze({
  Devices: ['Camera', 'Microphone', 'Recording', 'Transcript'],
  'Visual signals': ['Framing', 'Face / head', 'Hands / gestures', 'Smile / expression'],
  'Voice signals': ['Volume', 'Pace', 'Pitch', 'Pauses'],
});
const READINESS_GUIDANCE = Object.freeze({
  Camera: ['See the frame you will use', 'Center your face, keep the camera near eye level, and leave room for natural gestures.'],
  Microphone: ['Find a clear speaking level', 'Speak naturally. The live meter should move without staying pinned at either edge.'],
  Recording: ['Protect the full rehearsal', 'A private account recording is created only when recording is enabled for the session.'],
  Transcript: ['Make every answer reviewable', 'A transcript becomes available after a saved answer when the speech path is available.'],
  Framing: ['Set a confident frame', 'Keep head and upper torso visible with balanced space around you.'],
  'Face / head': ['Stay present with the interviewer', 'Head position is measured as an observable signal, never as emotion or intent.'],
  'Hands / gestures': ['Let gestures support the answer', 'Keep gestures visible and natural; no movement is treated as a personality judgment.'],
  'Smile / expression': ['Use expression intentionally', 'Only visible expression cues are measured. No psychological meaning is inferred.'],
  Volume: ['Land in a comfortable range', 'Aim for an audible, conversational level without clipping.'],
  Pace: ['Give ideas room to land', 'Use a pace that remains understandable through complete thoughts.'],
  Pitch: ['Keep vocal energy available', 'Variation is shown as a coaching cue, not a diagnostic score.'],
  Pauses: ['Make silence work for you', 'Brief pauses can separate ideas and give you time to think.'],
});

function renderReadinessStep(host) {
  const intro = el('div', 'canon-photo-heading'); const image = el('img'); image.src = '/iv-prep-on-call/assets/studio/astra-assets/synthetic-candidate.png'; image.alt = '';
  const copy = el('div'); copy.append(el('h2', '', 'Find your signal.'), el('p', '', 'Real capability states from the same camera, microphone, and analytics pipeline used in practice.')); intro.append(image, copy); host.append(intro);
  const rows = readinessRows();
  const tabs = el('div', 'canon-readiness-tabs');
  [...Object.keys(READINESS_PANELS), 'Signal health'].forEach((panel) => tabs.append(choiceButton({ className: 'canon-tab', selected: state.wizard.readinessPanel === panel, label: panel, onClick: () => { state.wizard.readinessPanel = panel; state.wizard.readinessSignal = READINESS_PANELS[panel]?.[0] || state.wizard.readinessSignal; renderWizard(); } })));
  host.append(tabs);
  const layout = el('div', 'canon-readiness-layout');
  state.wizard.readiness = bridge.media.cam && bridge.media.mic
    ? 'Camera and microphone connected'
    : 'Calibration available';
  const preview = el('section', 'canon-readiness-preview');
  const stage = el('div', 'stage'); stage.id = 'builder-readiness-stage'; stage.innerHTML = '<div class="stage-tag"><span>You</span></div><div class="canon-frame-guide" aria-hidden="true"><span></span></div>'; preview.append(stage);
  const meter = el('div', 'canon-live-meter'); meter.innerHTML = '<span class="live-mic-fill"></span>'; preview.append(meter, el('p', 'microcap', bridge.media.mic ? 'Speak to test your live microphone level' : 'Connect camera + microphone to begin'));
  const actions = el('div', 'canon-inline-actions');
  const connect = choiceButton({ className: 'btn btn-primary', label: bridge.media.stream ? 'Reconnect camera + mic' : 'Connect camera + mic', onClick: async () => { await connectDevices(); renderWizard(); } });
  const full = choiceButton({ className: 'btn btn-secondary', label: 'Open full calibration', onClick: () => setView('devicecheck') }); actions.append(connect, full); preview.append(actions);
  const workspace = el('section', 'canon-readiness-workspace');
  const liveRows = rows.filter(([name]) => !['Recording', 'Transcript'].includes(name));
  const readyCount = liveRows.filter(([, ready]) => ready).length;
  workspace.append(el('div', 'canon-readiness-count', `${readyCount} of ${liveRows.length} live checks ready now`));
  if (state.wizard.readinessPanel === 'Signal health') {
    const signals = el('div', 'canon-signal-grid canon-signal-health');
    rows.forEach(([name, ready, detail]) => { const tile = el('div', 'canon-signal-tile'); tile.dataset.ready = String(Boolean(ready)); tile.append(el('strong', '', name), el('span', '', detail)); signals.append(tile); });
    workspace.append(el('h3', '', 'Know what is actually ready.'), el('p', 'canon-muted', 'Unavailable signals stay unavailable. Connecting devices does not count as measured evidence.'), signals);
  } else {
    const names = READINESS_PANELS[state.wizard.readinessPanel] || READINESS_PANELS.Devices;
    if (!names.includes(state.wizard.readinessSignal)) state.wizard.readinessSignal = names[0];
    const picks = el('div', 'canon-signal-picks');
    names.forEach((name) => { const row = rows.find(([candidate]) => candidate === name) || [name, false, 'Unavailable']; picks.append(choiceButton({ className: 'canon-signal-pick', selected: state.wizard.readinessSignal === name, label: name, detail: row[2], onClick: () => { state.wizard.readinessSignal = name; renderWizard(); } })); });
    const current = rows.find(([name]) => name === state.wizard.readinessSignal) || rows[0];
    const guidance = READINESS_GUIDANCE[current[0]] || [current[0], current[2]];
    const focus = el('div', 'canon-readiness-focus'); focus.dataset.ready = String(Boolean(current[1]));
    focus.append(el('div', 'microcap', `${state.wizard.readinessPanel} · ${current[1] ? 'Ready now' : current[2]}`), el('h3', '', guidance[0]), el('p', '', guidance[1]), el('span', 'canon-readiness-state', current[1] ? '✓ Live capability confirmed' : `○ ${current[2]}`));
    workspace.append(picks, focus);
  }
  layout.append(preview, workspace); host.append(layout);
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
    addSummaryRow('Program', state.wizard.programVerified
      ? `${state.wizard.program} · verified`
      : state.wizard.program ? `${state.wizard.program} · manual / unverified` : 'No program selected', state.wizard.programVerified);
    addSummaryRow('Environment + context', state.wizard.environment);
    const devicesReady = wizardStepComplete(5);
    addSummaryRow('Readiness', devicesReady ? 'Camera, microphone, and visible preview confirmed' : 'Device calibration required', devicesReady);
    const row = document.createElement('div');
    row.className = 'btn-row';
    const launch = (mode) => {
      if (!state.interviewSet.length) return;
      state.launchMode = mode;
      setView('devicecheck');
    };
    const go = document.createElement('button');
    go.className = 'btn btn-primary';
    go.type = 'button';
    go.disabled = !state.interviewSet.length;
    go.innerHTML = `<span>${devicesReady ? 'Enter AI Interview Room ▸' : 'Continue to device calibration ▸'}</span>`;
    go.addEventListener('click', () => launch('ai'));
    const practice = document.createElement('button');
    practice.className = 'btn btn-secondary';
    practice.type = 'button';
    practice.disabled = !state.interviewSet.length;
    practice.innerHTML = `<span>${devicesReady ? 'Open coached practice' : 'Calibrate for coached practice'}</span>`;
    practice.addEventListener('click', () => launch('practice'));
    const back = document.createElement('button');
    back.className = 'btn btn-quiet';
    back.type = 'button';
    back.innerHTML = '<span>Start over</span>';
    back.addEventListener('click', () => { state.wizardStep = 0; renderWizard(); });
    row.append(go, practice, back);
    body.append(summary);
    if (!state.interviewSet.length) body.append(el('p', 'unavailable', 'CHOOSE AT LEAST ONE QUESTION BEFORE STARTING.'));
    body.append(row);
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
    : step.key === 'readiness' ? state.interviewSet.length > 0
      : Boolean(state.wizard[step.key]);
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn btn-quiet';
  next.disabled = !selected;
  next.innerHTML = `<span>${state.wizardStep === 5 ? 'Review interview' : 'Continue'} →</span>`;
  next.addEventListener('click', () => { state.wizardStep += 1; renderWizard(); });
  nav.append(back, next);
  body.append(kick, title, content, nav);
  if (step.key === 'readiness') {
    if (!state.interviewSet.length) {
      nav.before(el('p', 'unavailable', 'CHOOSE AT LEAST ONE QUESTION BEFORE REVIEWING OR STARTING.'));
    }
    bindPreview();
    if (bridge.media.mic) startLevelMeter();
  }
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
    const connected = Boolean(liveTrack('video') && liveTrack('audio'));
    refresh.innerHTML = `<span>${connected ? 'Refresh devices' : 'Connect camera + mic'}</span>`;
    refresh.addEventListener('click', () => void (connected ? refreshDevices() : connectDevices()));
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
      await bridge.requestMedia(true, true, {
        camera: kind === 'camera' ? deviceId : state.selected.camera,
        microphone: kind === 'microphone' ? deviceId : state.selected.microphone,
      });
    } else {
      await bridge.replaceTrack(trackKind, deviceId);
    }
    state.selected[kind] = deviceId;
    saveDevicePreference();
    bindPreview();
    if (kind === 'camera') {
      const preview = $('#devicecheck-stage video') || $('#builder-readiness-stage video');
      await ensureVisibleVideoFrame(preview);
    }
    startLevelMeter();
    if (status) status.textContent = `${kind === 'camera' ? 'Camera' : 'Microphone'} switched.`;
  } catch (error) {
    if (status) status.textContent = `Could not switch ${kind}: ${String(error?.message || error?.name || error)}`;
  }
  renderDeviceCheck();
  await refreshDevices();
}

function liveTrack(kind) {
  const tracks = kind === 'video' ? bridge.media.stream?.getVideoTracks?.() : bridge.media.stream?.getAudioTracks?.();
  return tracks?.find((track) => track.readyState === 'live') || null;
}

function videoSurfaceReady(video) {
  return Boolean(video && bridge.media.stream && video.srcObject === bridge.media.stream
    && liveTrack('video') && video.videoWidth >= 16 && video.videoHeight >= 16
    && video.paused === false && video.ended !== true);
}

function requestVideoPlayback(video) {
  if (!video || !bridge.media.stream) return;
  const playback = video.play?.();
  if (playback?.catch) playback.catch(() => {});
}

function bindVideoSurface(video) {
  if (!video) return null;
  video.autoplay = true; video.muted = true; video.playsInline = true;
  if (video.srcObject !== bridge.media.stream) video.srcObject = bridge.media.stream;
  if (video.dataset.ivocSurfaceEvents !== 'bound') {
    video.dataset.ivocSurfaceEvents = 'bound';
    for (const name of ['loadedmetadata', 'canplay', 'playing', 'resize', 'emptied', 'ended']) {
      video.addEventListener(name, () => {
        if (name === 'loadedmetadata' || name === 'canplay') requestVideoPlayback(video);
        renderDeviceCheck();
        if (state.view === 'training' || state.view === 'simulation') evaluateReadiness();
      });
    }
  }
  requestVideoPlayback(video);
  return video;
}

async function ensureVisibleVideoFrame(video, { timeoutMs = 5000 } = {}) {
  bindVideoSurface(video);
  if (videoSurfaceReady(video)) return video;
  if (!video || !bridge.media.stream || !liveTrack('video')) {
    throw new Error('Camera stream is not available. Reconnect the camera and microphone.');
  }
  await new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let poll;
    const cleanup = () => {
      clearInterval(poll);
      for (const event of ['loadedmetadata', 'canplay', 'playing', 'resize']) video.removeEventListener(event, settle);
    };
    const settle = () => {
      requestVideoPlayback(video);
      if (videoSurfaceReady(video)) {
        cleanup(); resolve(); return;
      }
      if (Date.now() >= deadline || !liveTrack('video')) {
        cleanup();
        reject(new Error('Camera connected, but IVOC could not render a visible frame. Reconnect the camera before continuing.'));
      }
    };
    for (const event of ['loadedmetadata', 'canplay', 'playing', 'resize']) video.addEventListener(event, settle);
    poll = setInterval(settle, 100);
    settle();
  });
  return video;
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
    bindVideoSurface(video);
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
  const measuring = state.session.state === 'RUNNING';
  const ready = state.session.state === 'SESSION_READY';
  const headline = measuring ? correction.headline : ready ? 'Ready to begin' : 'Not ready';
  const instruction = measuring
    ? correction.instruction
    : ready ? 'Start the rep or interview when you are ready.' : (state.session.reason || 'Complete device calibration to begin measurement.');
  const plate = $('#cockpit-correction');
  const metric = $('#correction-metric');
  const verdict = $('#correction-verdict');
  if (!plate) return;
  plate.dataset.state = measuring && correction.state === 'locked' ? 'locked' : measuring && correction.state === 'warn' ? 'warn' : 'idle';
  if (metric) metric.textContent = headline;
  if (verdict) verdict.textContent = instruction;
  const simPlate = $('#simulation-correction');
  const simMetric = $('#simulation-correction-metric');
  const simVerdict = $('#simulation-correction-verdict');
  if (simPlate) simPlate.dataset.state = plate?.dataset.state || 'idle';
  if (simMetric) simMetric.textContent = headline;
  if (simVerdict) simVerdict.textContent = instruction;
  // One dominant correction, ever: the primary instrument follows the limiting
  // contributor, and falls back to voice level when nothing needs correcting.
  mountPrimary(PRIMARY_FOR[correction.metric] || 'VOICE_LEVEL');
}

function renderStatusRail() {
  const rows = statusRail(state.bus.latest);
  for (const host of [$('#cockpit-rail'), $('#simulation-rail')].filter(Boolean)) {
    host.replaceChildren();
    for (const row of rows) {
      const pill = document.createElement('span');
      pill.className = 'status-pill';
      pill.dataset.ok = row.state === 'ok' ? 'true' : row.state === 'warn' ? 'warn' : 'false';
      pill.textContent = `${row.label} ${row.state === 'ok' ? '✓' : row.state === 'warn' ? '!' : '—'}`;
      host.append(pill);
    }
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
    const ready = next === 'SESSION_READY';
    start.innerHTML = `<span>${running ? 'Rep running…' : ready ? 'Start rep ▸' : 'Connect devices first'}</span>`;
    start.disabled = !ready;
  }
  const finish = $('#cockpit-finish');
  if (finish) finish.disabled = next !== 'RUNNING';
  renderCorrection();
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
  const surface = state.view === 'simulation' ? $('#founder-student-video')
    : state.view === 'training' ? $('#cockpit-video')
      : $('#devicecheck-stage video') || $('#builder-readiness-stage video');
  if (!videoSurfaceReady(surface)) return setSessionState('BLOCKED', 'Camera is connected but no visible frame is rendered yet. Reconnect it in Devices.');
  setSessionState('MEDIA_READY');
  if (!state.analytics) return setSessionState('BLOCKED', 'Delivery Intelligence is still loading. Wait a moment and try again.');
  setSessionState('ANALYTICS_READY');
  return setSessionState('SESSION_READY');
}

async function startRep() {
  if (['STARTING', 'RUNNING'].includes(state.session.state)) return;
  // Device connection publishes through the shared bridge asynchronously. Re-adopt
  // that canonical stream at the action boundary so a late publication can never
  // leave the visible Astra surface black while the hidden analytics preview works.
  bindCockpitVideo();
  if (evaluateReadiness() !== 'SESSION_READY') return;
  setSessionState('STARTING');
  try {
    if (state.admission?.runtime?.mode === 'hosted' && !state.durableAvailable) {
      throw new Error('Secure account recording is unavailable. Reconnect or reload before starting.');
    }
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
          interviewSet: state.interviewSet,
          wizard: state.wizard,
          targetQuestions: state.targetQuestions,
          interviewerProvider: state.liveInterview?.sessionId ? 'openai-gpt-live' : 'missionmed-static',
        });
        if (save) { save.dataset.state = 'active'; save.textContent = 'Secure account recording active.'; }
      } catch (error) {
        state.durableError = error;
        if (save) { save.dataset.state = 'error'; save.textContent = `Account save unavailable for this rep — ${String(error?.message || error).slice(0, 100)}`; }
        // Production practice may not continue as an apparently valid rep after its
        // account transaction failed. End the just-opened analytics answer, abandon
        // the partial owner session, and keep the user on the actionable start state.
        state.analytics?.endAnswer?.({ mediaAvailable: false });
        if (state.durable?.accountSession) {
          await state.durable.abandon({ reason: 'recording_start_failed' }).catch(() => {});
        }
        throw error;
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
    if (!retryingDurableSave && state.liveInterview?.sessionId) {
      await state.liveInterview.stop();
    }
    const outcome = state.durable?.accountSession
      ? await state.durable.finish(analyticsPromise)
      : { persisted: false, analytics: await analyticsPromise, recording: null };
    state.lastSaved = outcome;
    if (state.localPlaybackUrl) URL.revokeObjectURL(state.localPlaybackUrl);
    state.localPlaybackUrl = outcome.recording?.blob ? URL.createObjectURL(outcome.recording.blob) : null;
    const playback = $('#playback');
    if (playback && state.localPlaybackUrl) playback.src = state.localPlaybackUrl;
    const saveState = outcome.persisted ? 'saved' : 'error';
    const saveText = outcome.persisted
        ? 'Saved privately to your authenticated Answer History.'
        : 'Rep complete, but no durable account record was created.';
    for (const save of [$('#cockpit-save'), $('#simulation-save')].filter(Boolean)) {
      save.dataset.state = saveState;
      save.textContent = saveText;
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
  bindVideoSurface($('#cockpit-video'));
  // Re-route even when the view did not change. This repairs the overlay/control
  // nodes if a view render replaced them after the controller first bound.
  state.analytics?.onViewChange?.(state.view, state.role === 'student' ? 'student' : 'admin');
  const ready = evaluateReadiness();
  const connect = $('#cockpit-connect');
  if (connect) {
    const live = ready === 'SESSION_READY' || ready === 'RUNNING';
    connect.innerHTML = `<span>${live ? 'Devices connected ✓' : 'Connect camera + mic'}</span>`;
  }
}

function bindSimulationVideo() {
  bindVideoSurface($('#founder-student-video'));
  state.analytics?.onViewChange?.('simulation', state.role === 'student' ? 'student' : 'admin');
  evaluateReadiness();
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

function appendLiveTranscript(event) {
  const { speaker, text, identity, final } = event;
  state.durable?.recordLiveTranscript?.(event);
  if (!text) return;
  const host = $('#live-transcript');
  if (!host) return;
  if (host.firstElementChild?.tagName === 'SPAN') host.replaceChildren();
  let row = [...host.children].find((item) => item.dataset?.transcriptId === identity);
  if (!row) {
    row = document.createElement('p');
    row.dataset.transcriptId = identity;
    const label = document.createElement('b');
    label.textContent = speaker === 'applicant' ? 'You · ' : 'Interviewer · ';
    const value = document.createElement('span');
    row.append(label, value);
    host.append(row);
  }
  const value = row.lastElementChild;
  if (value) value.textContent = final ? text : `${value.textContent || ''}${text}`;
  host.scrollTop = host.scrollHeight;
}

function setLiveInterviewStatus({ state: next, detail }) {
  const stage = $('.live-interviewer-stage');
  if (stage) stage.dataset.state = next;
  const title = $('#sim-provider-state');
  const note = $('#sim-provider-note');
  const start = $('#live-interview-start');
  const end = $('#live-interview-end');
  const blocked = next === 'idle'
    ? (!state.interviewSet.length ? 'Choose at least one question before entering the Interview Room.' : startBlockedReason())
    : null;
  if (title) title.textContent = {
    connecting: 'Connecting…', active: 'Live · listening', closed: 'Interview ended', error: 'Live interview unavailable', unavailable: 'Live voice unavailable', idle: 'Ready when you are',
  }[next] || next;
  if (title && blocked) title.textContent = 'Not ready yet';
  if (note && (blocked || detail)) note.textContent = blocked || detail;
  if (start) start.disabled = ['connecting', 'active', 'unavailable'].includes(next) || Boolean(blocked);
  if (end) end.disabled = !['connecting', 'active'].includes(next);
}

function liveInterviewContext() {
  return createLiveContext({ wizard: state.wizard, interviewSet: state.interviewSet, targetQuestions: state.targetQuestions });
}

async function startLiveInterview() {
  if (!state.admission?.runtime?.liveInterviewAvailable) {
    setLiveInterviewStatus({ state: 'error', detail: 'Live voice is not configured in this environment.' });
    return false;
  }
  if (state.liveInterview?.sessionId || ['STARTING', 'RUNNING'].includes(state.session.state)) return true;
  if (!state.interviewSet.length) {
    setLiveInterviewStatus({ state: 'error', detail: 'Choose at least one question before starting the live interview.' });
    return false;
  }
  let preparedForLive = false;
  let analyticsStarted = false;
  try {
    setLiveInterviewStatus({
      state: 'connecting',
      detail: 'Preparing your private recording and authorized interview context…',
    });
    bridge.primeAudioContext();
    if (!bridge.media.stream?.getAudioTracks?.().some((track) => track.readyState === 'live')) {
      await bridge.requestMedia(true, true);
      bindPreview(); bindSimulationVideo();
      renderDeviceCheck();
    }
    bindSimulationVideo();
    await ensureVisibleVideoFrame($('#founder-student-video'));
    if (evaluateReadiness() !== 'SESSION_READY') throw new Error(state.session.reason || 'Camera and microphone are not ready.');
    const track = bridge.media.stream.getAudioTracks()[0];
    const selectedVoice = state.role === 'admin'
      ? ($('#admin-live-voice')?.value || 'marin')
      : 'marin';
    if (!state.durableAvailable) throw new Error('Secure account context is unavailable.');
    preparedForLive = !state.durable.accountSession;
    const prepared = await state.durable.prepare({
      question: state.interviewSet[0] || null,
      interviewSet: state.interviewSet,
      wizard: state.wizard,
      targetQuestions: state.targetQuestions,
      interviewerProvider: 'openai-gpt-live',
    });
    const answer = state.analytics.beginAnswer({ videoElement: $('#founder-student-video') });
    analyticsStarted = true;
    state.session.answerId = answer?.answerId ?? null;
    state.session.startedAt = Date.now();
    await state.durable.start({
      stream: bridge.media.stream,
      question: state.interviewSet[0] || null,
      interviewSet: state.interviewSet,
      wizard: state.wizard,
      targetQuestions: state.targetQuestions,
      interviewerProvider: 'openai-gpt-live',
    });
    await state.liveInterview.start({
      audioTrack: track,
      voice: selectedVoice,
      context: liveInterviewContext(),
      ivocSessionId: prepared.id,
      openingQuestion: state.interviewSet[0]?.canonical_text,
    });
    const save = $('#simulation-save');
    if (save) { save.dataset.state = 'active'; save.textContent = 'Secure account recording active.'; }
    setSessionState('RUNNING');
    return true;
  } catch (error) {
    if (analyticsStarted) state.analytics?.endAnswer?.({ mediaAvailable: false });
    if (preparedForLive || state.durable?.accountSession) await state.durable.abandon({ reason: 'client_exit' }).catch(() => {});
    setSessionState('BLOCKED', String(error?.message || error).slice(0, 180));
    setLiveInterviewStatus({ state: 'error', detail: String(error?.message || error).slice(0, 180) });
    return false;
  }
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
    onTelemetry: (event) => state.durable?.recordLiveAudioTelemetry?.(event),
  });
  const available = state.admission?.runtime?.liveInterviewAvailable === true;
  setLiveInterviewStatus({ state: available ? 'idle' : 'unavailable', detail: available
    ? 'Uses your selected interviewer, program, Question Pool, and authorized context.'
    : 'Live voice is not configured in this environment.' });
  $('#live-interview-start')?.addEventListener('click', () => { void startLiveInterview(); });
  $('#live-interview-end')?.addEventListener('click', async () => {
    try {
      await finishRep();
    }
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
  const cameraLive = Boolean(liveTrack('video'));
  const microphoneLive = Boolean(liveTrack('audio') && media.mic);
  const preview = $('#devicecheck-stage video') || $('#builder-readiness-stage video');
  const surfaceLive = videoSurfaceReady(preview);
  const adminDiagnostics = state.role === 'admin';
  const rows = [
    ['Camera', cameraLive ? 'ready' : 'pending', cameraLive ? 'LIVE' : 'NOT CONNECTED'],
    ['Microphone', microphoneLive ? 'ready' : 'pending', microphoneLive ? 'LIVE' : 'NOT CONNECTED'],
    ['Visible preview', surfaceLive ? 'ready' : 'pending', surfaceLive ? `${preview.videoWidth}×${preview.videoHeight} RENDERING` : 'NO VISIBLE FRAME'],
    [adminDiagnostics ? 'Audio context' : 'Microphone processing', media.AC?.state === 'running' ? 'ready' : 'pending', adminDiagnostics ? (media.AC?.state || 'IDLE').toUpperCase() : media.AC?.state === 'running' ? 'READY' : 'CONNECT DEVICES FIRST'],
    [adminDiagnostics ? 'Vision worker' : 'Visual coaching', diagnostics.active ? 'ready' : 'pending', adminDiagnostics ? (diagnostics.active ? 'RUNNING' : 'IDLE') : diagnostics.active ? 'READY DURING PRACTICE' : 'CONNECT DEVICES FIRST'],
    [adminDiagnostics ? 'Face landmarks' : 'Face + head tracking', diagnostics.active ? 'ready' : 'pending', diagnostics.active ? 'AVAILABLE DURING PRACTICE' : 'AWAITING DEVICES'],
    ['Body + hands tracking', diagnostics.active ? 'ready' : 'pending', diagnostics.active ? 'AVAILABLE DURING PRACTICE' : 'AWAITING DEVICES'],
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
  if (state.deviceError) {
    const note = document.createElement('p');
    note.className = 'unavailable';
    note.textContent = `CAMERA / MIC UNAVAILABLE — ${state.deviceError}`;
    host.append(note);
  }
  const proceed = $('#device-proceed');
  if (proceed) {
    const ready = cameraLive && microphoneLive && surfaceLive && media.AC?.state === 'running';
    proceed.disabled = !ready;
    const missingInterviewSet = state.launchMode === 'ai' && !state.interviewSet.length;
    proceed.innerHTML = `<span>${ready
      ? (missingInterviewSet ? 'Choose interview questions ▸' : state.launchMode === 'ai' ? 'Start AI interview ▸' : 'Begin coached practice ▸')
      : 'Connect devices to continue'}</span>`;
  }
}

async function connectDevices() {
  // Same law as the cockpit handler: prime before any await.
  bridge.primeAudioContext();
  const button = $('#device-connect');
  if (button) { button.disabled = true; button.innerHTML = '<span>Requesting…</span>'; }
  try {
    await bridge.requestMedia(true, true, {
      camera: state.selected.camera,
      microphone: state.selected.microphone,
    });
    state.deviceError = null;
    bindPreview();
    const preview = $('#devicecheck-stage video') || $('#builder-readiness-stage video');
    await ensureVisibleVideoFrame(preview);
    await refreshDevices();
    startLevelMeter();
  } catch (error) {
    state.deviceError = String(error?.message || error?.name || error).toUpperCase();
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

let vaultRenderId = 0;

async function renderVault() {
  const host = $('#vault-body');
  if (!host) return;
  const renderId = ++vaultRenderId;
  host.replaceChildren();
  try {
    if (!state.durableAvailable) throw state.durableError || new Error('durable_session_unavailable');
    const vault = await state.durable.library('own');
    if (renderId !== vaultRenderId || state.view !== 'vault') return;
    const sessions = Array.isArray(vault?.sessions) ? vault.sessions : [];
    state.longitudinal = buildLongitudinalModel(sessions);
    if (!sessions.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<strong>No saved answers</strong>Your authenticated Answer History is empty. Finish a real recorded rep to create the first private AnswerRecord.';
      host.append(empty);
      return;
    }
    const toolbar = document.createElement('div');
    toolbar.className = 'vault-toolbar';
    const query = document.createElement('input');
    query.className = 'q-search';
    query.type = 'search';
    query.placeholder = 'Filter by question or answer title';
    query.setAttribute('aria-label', 'Filter Answer History');
    query.value = state.vaultFilter.query;
    const evidence = document.createElement('select');
    evidence.className = 'q-search';
    evidence.setAttribute('aria-label', 'Filter by evidence availability');
    for (const [value, label] of [
      ['all', 'All evidence states'],
      ['semantic', 'Supported semantic evidence'],
      ['transcript', 'Transcript available'],
      ['pending', 'Evidence pending'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = state.vaultFilter.evidence === value;
      evidence.append(option);
    }
    const count = document.createElement('span');
    count.className = 'microcap vault-result-count';
    toolbar.append(query, evidence, count);
    const rows = document.createElement('div');
    rows.className = 'vault-rows';

    const paint = () => {
      rows.replaceChildren();
      const needle = state.vaultFilter.query.trim().toLowerCase();
      const filtered = sessions.filter((session) => {
        const history = session.answerHistory || {};
        const haystack = [session.questionId, session.questionText, session.title].filter(Boolean).join(' ').toLowerCase();
        if (needle && !haystack.includes(needle)) return false;
        if (state.vaultFilter.evidence === 'semantic') return Number(history.supportedObservationCount || 0) > 0;
        if (state.vaultFilter.evidence === 'transcript') return history.transcriptAvailable === true;
        if (state.vaultFilter.evidence === 'pending') return history.transcriptAvailable !== true;
        return true;
      });
      count.textContent = `${filtered.length} OF ${sessions.length} ANSWERS`;
      if (!filtered.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<strong>No matching answers</strong>Change the question or evidence filter. Saved evidence is never inferred.';
        rows.append(empty);
        return;
      }
      for (const session of filtered) {
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
      const history = session.answerHistory || {};
      const evidenceLabel = Number(history.supportedObservationCount || 0) > 0
        ? `${history.supportedObservationCount} supported observation${history.supportedObservationCount === 1 ? '' : 's'}`
        : (history.transcriptAvailable ? 'Transcript · no supported semantic observations' : 'Evidence pending');
      meta.textContent = `${session.questionId || 'QUESTION ID UNAVAILABLE'} · ${evidenceLabel}${when ? ` · ${new Date(when).toLocaleString()}` : ''}`;
      copy.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'vault-answer-actions';
      const canReview = Boolean(session.results || Number(history.supportedObservationCount || 0) > 0
        || history.transcriptAvailable === true || ['complete', 'processed'].includes(session.state));
      if (canReview) {
        const results = document.createElement('button');
        results.type = 'button';
        results.className = 'btn btn-quiet';
        results.innerHTML = '<span>Review answer</span>';
        results.addEventListener('click', async () => {
          results.disabled = true;
          try {
            const detail = await state.durable.api.session(session.id);
            const analytics = detail?.results?.payload?.analytics || null;
            state.lastSaved = {
              persisted: true,
              session,
              sessionDetail: detail,
              analytics,
              recording: detail?.recording ? { recording: detail.recording } : null,
            };
            state.filmGroups?.ingestResult(analytics || {});
            renderPostAnswer(analytics);
            renderContextEvidence(contextResultFromSessionSpine(detail));
            setView('postanswer');
          } finally { results.disabled = false; }
        });
        actions.append(results);
      }
      if (session.recording?.id && session.recording?.status === 'saved') {
        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'btn btn-quiet';
        play.innerHTML = '<span>Play</span>';
        play.addEventListener('click', async () => {
          play.disabled = true;
          try {
            const [signed, detail] = await Promise.all([
              state.durable.playback(session.recording.id),
              state.durable.api.session(session.id),
            ]);
            const video = $('#playback');
            state.lastSaved = { persisted: true, session, sessionDetail: detail };
            state.filmGroups?.ingestResult(detail?.results?.payload?.analytics || session?.results?.payload?.analytics || {});
            renderFilmRoomSpine(detail);
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
        rows.append(row);
      }
    };
    query.addEventListener('input', () => { state.vaultFilter.query = query.value; paint(); });
    evidence.addEventListener('change', () => { state.vaultFilter.evidence = evidence.value; paint(); });
    host.append(toolbar, rows);
    paint();
  } catch (error) {
    if (renderId !== vaultRenderId || state.view !== 'vault') return;
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
  const { initializeAnalyticsUi, DeliveryIntelligenceGroups } = await loadAnalyticsCapabilityModules();
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
        simulation: {
          video: 'founder-student-video',
          stage: 'founder-student-stage',
          room: 'founder-room-stage',
          wrapper: 'founder-room-wrapper',
        },
      },
    },
    overlayPolicy: { authorized: true, enabled: true, face: true, bodyHands: true, studentPrimary: true },
  });
  state.analytics.onViewChange(state.view, 'admin');

  // Film Room and Analytics Lab both render the hierarchical groups. Two instances so
  // each surface keeps its own show/hide and solo state; both are display-only.
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
  wireQuestionGovernance();
  for (const item of $$('[data-nav]')) item.addEventListener('click', () => {
    if (item.dataset.launchMode) state.launchMode = item.dataset.launchMode;
    if (item.dataset.launchMode === 'ai' && !state.interviewSet.length) applyWizardQuestions('Core 10');
    setView(item.dataset.nav, { focus: true });
  });
  for (const button of $$('[data-goto]')) button.addEventListener('click', () => {
    if (button.dataset.launchMode) state.launchMode = button.dataset.launchMode;
    if (button.dataset.launchMode === 'ai' && !state.interviewSet.length) applyWizardQuestions('Core 10');
    setView(button.dataset.goto, { focus: true });
  });
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
  $('#device-proceed')?.addEventListener('click', async () => {
    if (evaluateReadiness() !== 'SESSION_READY') { renderDeviceCheck(); return; }
    if (state.launchMode === 'ai') {
      if (!state.interviewSet.length) {
        state.wizardStep = 1;
        showBuilderMode('wizard');
        setView('newsession', { focus: true });
        return;
      }
      setView('simulation', { focus: true });
      await startLiveInterview();
      return;
    }
    setView('training', { focus: true });
  });

  $('#mode-wizard')?.addEventListener('click', () => showBuilderMode('wizard'));
  $('#mode-loadout')?.addEventListener('click', () => showBuilderMode('loadout'));
  $('#builder-open-pool')?.addEventListener('click', () => showBuilderMode('loadout'));
  $('#builder-target')?.addEventListener('input', (event) => {
    state.targetQuestions = Math.max(1, Math.min(30, Number(event.target.value) || 1));
    event.target.value = String(state.targetQuestions);
  });
  $('#context-analyze')?.addEventListener('click', () => { void analyzeLastAnswer(); });
  $('#post-open-filmroom')?.addEventListener('click', (event) => {
    void openLastSavedFilmRoom(event.currentTarget);
  });
}

function renderLoadoutConfig() {
  const host = $('#loadout-config');
  if (!host) return;
  const groups = [
    ['Interviewer', ['Voice only', 'Text prompts'], 'Additional interviewer profiles will appear when available'],
    ['Difficulty', ['Standard', 'Pressure'], null],
    ['Follow-ups', ['None', 'Occasional'], 'Follow-ups respond to the answer and session goal'],
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
  const provenance = $('#post-provenance');
  if (provenance) {
    const detailSession = state.lastSaved?.sessionDetail?.session || null;
    const librarySession = state.lastSaved?.session || null;
    const session = detailSession || librarySession;
    const question = session?.questionText || session?.title || session?.questionId || 'No saved answer selected';
    const when = session?.endedAt || session?.startedAt || null;
    const program = session?.programName || state.lastSaved?.sessionDetail?.context?.program?.name || null;
    const ownerDisplayName = detailSession?.ownerDisplayName || librarySession?.ownerDisplayName || null;
    provenance.replaceChildren(
      el('span', 'microcap', state.lastSaved?.persisted ? 'Saved private answer' : 'Current unsaved review'),
      el('strong', '', question),
      el('span', 'canon-muted', [
        state.role === 'admin' && ownerDisplayName ? `Student · ${ownerDisplayName}` : null,
        when ? new Date(when).toLocaleString() : null,
        program,
      ].filter(Boolean).join(' · ') || 'Session details unavailable'),
    );
  }
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
  renderFullAnalyticsReport(analytics);
  const contextButton = $('#context-analyze');
  if (contextButton) {
    const recordingId = state.lastSaved?.recording?.recording?.id;
    const answerId = state.lastSaved?.analytics?.answerId;
    const questionId = state.lastSaved?.session?.questionId;
    contextButton.disabled = !(state.lastSaved?.persisted && recordingId && answerId && questionId);
  }
}

function supportedAnalyticsEvent(events, metric) {
  return [...events].reverse().find((event) => event?.metric === metric
    && event?.maturity === 'VALIDATED_STUDENT_SAFE') || null;
}

function observedLaneSummary(readouts, definitions) {
  const values = definitions.flatMap(([id, label]) => {
    const value = readouts?.[id];
    if (typeof value !== 'string' || !value.trim() || value.startsWith('UNAVAILABLE')) return [];
    return [`${label}: ${value}`];
  });
  return values.length
    ? `Observed signal — informational, not a coaching score · ${values.join(' · ')}`
    : null;
}

function renderFullAnalyticsReport(analytics = null) {
  const host = $('#post-analytics-report');
  if (!host) return;
  host.replaceChildren();
  const events = Array.isArray(analytics?.studentEvents) ? analytics.studentEvents : [];
  const event = (metric) => supportedAnalyticsEvent(events, metric);
  const numericEventValue = (metric) => {
    const value = Number(event(metric)?.observation?.value);
    return Number.isFinite(value) ? value : null;
  };
  const unavailable = 'Unavailable — not enough supported evidence';
  const durationMs = numericEventValue('answer_duration_ms');
  const voiceLevel = numericEventValue('captured_level_dbfs');
  const variation = numericEventValue('energy_variation_db');
  const clipping = numericEventValue('digital_clipping_fraction');
  const pauses = events.filter((item) => item?.metric === 'pause_episode'
    && item?.maturity === 'VALIDATED_STUDENT_SAFE');
  const face = event('face_presence');
  const torso = event('torso_presence');
  const hands = event('hand_presence');
  const framing = numericEventValue('framing_center');
  const cameraFacing = numericEventValue('camera_facing_proxy');
  const head = event('head_orientation_proxy')?.observation?.value;
  const headText = head && typeof head === 'object'
    ? ['yawDeg', 'pitchDeg', 'rollDeg'].filter((key) => Number.isFinite(Number(head[key])))
      .map((key) => `${key.replace('Deg', '')} ${Number(head[key]).toFixed(1)}°`).join(' · ')
    : null;
  const laneReadouts = resultLaneReadouts(analytics || {});
  const voiceObserved = observedLaneSummary(laneReadouts, [
    ['VOICE.PITCH', 'Pitch'],
    ['VOICE.PITCH_VARIATION', 'Pitch variation'],
    ['VOICE.PAUSE', 'Pause state'],
  ]);
  const faceHeadObserved = observedLaneSummary(laneReadouts, [
    ['FACE.GAZE', 'Camera-facing head-position proxy'],
    ['FACE.CAMERA_DWELL', 'Camera-facing dwell'],
    ['FACE.MOVEMENT_VARIABILITY', 'Face movement variability'],
    ['BODY.YAW', 'Head yaw'],
    ['BODY.PITCH', 'Head pitch'],
    ['BODY.ROLL', 'Head roll'],
  ]);
  const bodyHandsObserved = observedLaneSummary(laneReadouts, [
    ['HANDS.LEFT', 'Left hand'],
    ['HANDS.RIGHT', 'Right hand'],
    ['HANDS.ZONE', 'Gesture zone'],
    ['BODY.LEAN', 'Torso'],
  ]);
  const framingObserved = observedLaneSummary(laneReadouts, [
    ['BODY.FRAMING', 'Camera framing'],
  ]);
  const conversationTurns = persistedConversationTurns({
    sessionDetail: state.lastSaved?.sessionDetail,
    envelope: state.lastSaved?.envelope,
  });
  const canonicalTranscript = conversationTurns.length > 0 && conversationTurns.every((turn) => turn.canonical);
  const recordingState = state.lastSaved?.recording?.recording?.status
    || state.lastSaved?.sessionDetail?.recording?.status
    || (state.lastSaved?.recording?.blob ? 'captured locally' : null);
  const rows = [
    ['Timing', durationMs === null ? unavailable : `${(durationMs / 1000).toFixed(1)} seconds of supported answer evidence`],
    ['Voice delivery', voiceLevel === null && variation === null
      ? (voiceObserved || unavailable)
      : [voiceLevel === null ? null : `${voiceLevel.toFixed(1)} dBFS captured level`, variation === null ? null : `${variation.toFixed(1)} dB volume variation`, voiceObserved].filter(Boolean).join(' · ')],
    ['Clipping + pauses', clipping === null && !pauses.length
      ? unavailable
      : [clipping === null ? null : `${(clipping * 100).toFixed(2)}% digital clipping`, pauses.length ? `${pauses.length} supported pause${pauses.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')],
    ['Face + head', !face && !headText ? (faceHeadObserved || unavailable) : [face ? 'Face presence measured' : null, headText, faceHeadObserved].filter(Boolean).join(' · ')],
    ['Body + hands', !torso && !hands ? (bodyHandsObserved || unavailable) : [torso ? 'Torso presence measured' : null, hands ? 'Hand presence measured' : null, bodyHandsObserved].filter(Boolean).join(' · ')],
    ['Framing', framing === null && cameraFacing === null
      ? (framingObserved || unavailable)
      : [framing === null ? null : `${Math.round(framing * 100)}% centered frames`, cameraFacing === null ? null : `${Math.round(cameraFacing * 100)}% camera-facing proxy`, framingObserved].filter(Boolean).join(' · ')],
    ['Transcript', conversationTurns.length
      ? `${conversationTurns.length} persisted ${canonicalTranscript ? 'transcript' : 'live conversation'} turn${conversationTurns.length === 1 ? '' : 's'}`
      : 'Unavailable until transcript + context processing completes'],
    ['Recording', recordingState ? `Private recording ${recordingState}` : 'Unavailable — no persisted recording evidence'],
  ];
  for (const [label, detail] of rows) {
    const card = document.createElement('article');
    card.className = 'context-assessment-card';
    const heading = document.createElement('span');
    heading.className = 'microcap';
    heading.textContent = label;
    const copy = document.createElement('p');
    copy.textContent = detail;
    card.append(heading, copy);
    host.append(card);
  }
}

function evidenceReferenceLabel(refs) {
  if (!Array.isArray(refs) || !refs.length) return 'Transcript evidence';
  if (state.role === 'admin') return refs.join(', ');
  return refs.map((ref) => {
    const match = /^seg-(\d+)$/u.exec(String(ref));
    return match ? `Moment ${match[1]}` : 'Transcript evidence';
  }).join(', ');
}

function renderContextEvidence(result) {
  const host = $('#context-evidence');
  if (!host) return;
  host.replaceChildren();
  const transcript = result?.transcript;
  if (transcript?.status !== 'AVAILABLE') {
    const note = document.createElement('p');
    note.className = 'unavailable';
    const reason = String(transcript?.reason || 'PROVIDER UNAVAILABLE').toUpperCase().slice(0, 120);
    note.textContent = state.role === 'admin'
      ? `TRANSCRIPT UNAVAILABLE — ${reason}`
      : reason === 'NO_PERSISTED_TRANSCRIPT'
        ? 'NO SAVED TRANSCRIPT YET'
        : 'TRANSCRIPT PROCESSING IS CURRENTLY UNAVAILABLE';
    host.append(note);
    return;
  }
  const quote = document.createElement('blockquote');
  quote.textContent = transcript.text;
  host.append(quote);
  const transcriptMetrics = projectTranscriptMetrics(result);
  if (transcriptMetrics.status === 'AVAILABLE') {
    const label = document.createElement('div');
    label.className = 'microcap';
    label.textContent = 'Answer transcript';
    const grid = document.createElement('div');
    grid.className = 'context-assessment-grid';
    const summary = document.createElement('article');
    summary.className = 'context-assessment-card';
    const summaryHeading = document.createElement('span');
    summaryHeading.className = 'microcap';
    summaryHeading.textContent = 'Transcript coverage';
    const summaryValue = document.createElement('strong');
    summaryValue.textContent = transcriptMetrics.segmentCount
      ? `${transcriptMetrics.segmentCount} segments · ${transcriptMetrics.wordCount} words`
      : `${transcriptMetrics.wordCount} words`;
    const summaryCopy = document.createElement('p');
    summaryCopy.textContent = transcriptMetrics.startMs === null
      ? 'Saved text is available; timing detail is unavailable.'
      : `${Math.round(transcriptMetrics.startMs / 100) / 10}s–${Math.round(transcriptMetrics.endMs / 100) / 10}s in this saved answer.`;
    summary.append(summaryHeading, summaryValue, summaryCopy);
    const fillers = document.createElement('article');
    fillers.className = 'context-assessment-card';
    const fillersHeading = document.createElement('span');
    fillersHeading.className = 'microcap';
    fillersHeading.textContent = 'Filler words';
    const fillersValue = document.createElement('strong');
    fillersValue.textContent = String(transcriptMetrics.fillerTokenCount);
    const fillersCopy = document.createElement('p');
    fillersCopy.textContent = 'Counted from your transcript using the disclosed um / uh / erm / like / you know / I mean list. No personality or emotion is inferred.';
    fillers.append(fillersHeading, fillersValue, fillersCopy);
    grid.append(summary, fillers);
    host.append(label, grid);
  }
  const analysis = result?.analysis;
  if (analysis?.status === 'AVAILABLE' && Array.isArray(analysis.semanticObservations) && analysis.semanticObservations.length) {
    const label = document.createElement('div');
    label.className = 'microcap';
    label.textContent = 'Evidence-cited observations';
    const list = document.createElement('ul');
    for (const observation of analysis.semanticObservations) {
      const item = document.createElement('li');
      const refs = evidenceReferenceLabel(observation.transcriptSegmentIds);
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
  const assessment = projectContextResults(result);
  if (assessment.status === 'AVAILABLE') {
    const label = document.createElement('div');
    label.className = 'microcap';
    label.textContent = 'Evidence-grounded debrief';
    const grid = document.createElement('div');
    grid.className = 'context-assessment-grid';
    const cards = [
      ['Strongest supported moment', assessment.strongest, 'strength'],
      ['Highest-value improvement', assessment.improvement, 'improvement'],
      ['Next drill', assessment.drill, 'drill'],
    ];
    for (const [title, item, tone] of cards) {
      const card = document.createElement('article');
      card.className = 'context-assessment-card';
      card.dataset.tone = tone;
      const heading = document.createElement('span');
      heading.className = 'microcap';
      heading.textContent = title;
      const facet = document.createElement('strong');
      facet.textContent = item?.facetLabel || 'Not supported yet';
      const copy = document.createElement('p');
      copy.textContent = item?.text || 'This answer does not contain enough cited evidence for this claim.';
      card.append(heading, facet, copy);
      if (item?.refs?.length) {
        const refs = document.createElement('span');
        refs.className = 'context-assessment-refs';
        refs.textContent = `Evidence · ${evidenceReferenceLabel(item.refs)}`;
        card.append(refs);
      }
      grid.append(card);
    }
    const confidence = document.createElement('article');
    confidence.className = 'context-assessment-card context-confidence';
    const confidenceHeading = document.createElement('span');
    confidenceHeading.className = 'microcap';
    confidenceHeading.textContent = 'Evidence quality and limits';
    const confidenceValue = document.createElement('strong');
    confidenceValue.textContent = `${assessment.confidence.label} · ${Math.round(assessment.confidence.score * 100)}% analysis strength · ${Math.round(assessment.confidence.coverage * 100)}% transcript coverage`;
    const confidenceCopy = document.createElement('p');
    confidenceCopy.textContent = assessment.confidence.limitations.length
      ? assessment.confidence.limitations.join(' · ')
      : 'No additional provider limitation was returned; every claim still remains bounded to the cited transcript spans.';
    confidence.append(confidenceHeading, confidenceValue, confidenceCopy);
    host.append(label, grid, confidence);

    for (const [selector, item] of [['#post-worked', assessment.strongest], ['#post-fix', assessment.improvement]]) {
      if (!item) continue;
      const summaryHost = $(selector);
      if (!summaryHost) continue;
      const summary = document.createElement('div');
      summary.className = 'empty-state';
      const heading = document.createElement('strong');
      heading.textContent = item.facetLabel;
      const copy = document.createTextNode(`${item.text} · ${evidenceReferenceLabel(item.refs)}`);
      summary.append(heading, copy);
      summaryHost.replaceChildren(summary);
    }
  }
  const privacy = document.createElement('p');
  privacy.className = 'microcap';
  const supportedObservationCount = Array.isArray(analysis?.semanticObservations)
    ? analysis.semanticObservations.length
    : 0;
  privacy.textContent = result?.persistence?.transcript
    ? (supportedObservationCount
      ? 'Saved privately to this answer with evidence-cited observations.'
      : 'Transcript saved privately to this answer · no supported semantic observations were produced.')
    : 'Result was not persisted.';
  host.append(privacy);
}

function renderFilmRoomSpine(session, envelope = null) {
  const host = $('#filmroom-spine');
  if (!host) return;
  const selectedSession = session?.session || state.lastSaved?.session || null;
  const ownerDisplayName = selectedSession?.ownerDisplayName || state.lastSaved?.session?.ownerDisplayName || null;
  const provenance = $('#filmroom-provenance');
  if (provenance) {
    const question = selectedSession?.questionText || selectedSession?.title || selectedSession?.questionId || 'Saved interview';
    const when = selectedSession?.endedAt || selectedSession?.startedAt || null;
    provenance.replaceChildren(
      el('span', 'microcap', 'Private recording'),
      el('strong', '', question),
      el('span', 'canon-muted', [
        state.role === 'admin' && ownerDisplayName ? `Student · ${ownerDisplayName}` : null,
        when ? new Date(when).toLocaleString() : null,
      ].filter(Boolean).join(' · ') || 'Session details unavailable'),
    );
  }
  const turns = persistedConversationTurns({ sessionDetail: session, envelope });
  const canonicalTranscript = turns.length > 0 && turns.every((turn) => turn.canonical);
  const evidence = Array.isArray(session?.spine?.evidence) ? session.spine.evidence : [];
  host.replaceChildren();
  if (!turns.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<strong>No persisted transcript yet</strong>This recording has no saved conversation turns.';
    host.append(empty);
    return;
  }
  const label = document.createElement('div');
  label.className = 'microcap';
  label.textContent = canonicalTranscript
    ? (state.role === 'admin' ? 'Canonical transcript' : 'Saved transcript')
    : 'Live interview transcript · saved privately with this answer';
  const timeline = document.createElement('div');
  timeline.className = 'long-rows';
  for (const turn of turns) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'long-row';
    const at = document.createElement('strong');
    at.textContent = `${(Number(turn.startMs || 0) / 1000).toFixed(1)}s`;
    const text = document.createElement('span');
    text.textContent = `${turn.speaker === 'student' ? 'You' : 'Interviewer'} · ${turn.text}`;
    row.append(at, text);
    row.addEventListener('click', () => {
      const video = $('#playback');
      if (!video || !Number.isFinite(Number(turn.startMs))) return;
      video.currentTime = Math.max(0, Number(turn.startMs) / 1000);
      void video.play().catch(() => {});
    });
    timeline.append(row);
  }
  host.append(label, timeline);
  if (evidence.length) {
    const label = document.createElement('div');
    label.className = 'microcap';
    label.textContent = 'Evidence-cited observations';
    const list = document.createElement('ul');
    for (const item of evidence) {
      const row = document.createElement('li');
      row.textContent = item.interpretation?.text || 'Evidence available';
      list.append(row);
    }
    host.append(label, list);
  }
}

async function openLastSavedFilmRoom(button) {
  if (button) button.disabled = true;
  try {
    const recordingId = state.lastSaved?.sessionDetail?.recording?.id
      || state.lastSaved?.session?.recording?.id
      || state.lastSaved?.recording?.recording?.id
      || state.lastSaved?.recording?.id
      || null;
    let playbackUrl = state.lastSaved?.recording?.blob ? state.localPlaybackUrl : null;
    if (!playbackUrl && recordingId) {
      const signed = state.role === 'admin'
        ? await state.adminLibrary.playback(recordingId)
        : await state.durable.playback(recordingId);
      playbackUrl = signed?.url || null;
    }
    renderFilmRoomSpine(state.lastSaved?.sessionDetail, state.lastSaved?.envelope);
    const video = $('#playback');
    if (video && playbackUrl) {
      video.src = playbackUrl;
      await video.play().catch(() => {});
    }
    setView('filmroom', { focus: true });
  } finally {
    if (button) button.disabled = false;
  }
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
    if (result?.persistence?.transcript) {
      const detail = await state.durable.api.session(sessionId);
      state.lastSaved = { ...saved, sessionDetail: detail };
      renderFilmRoomSpine(detail);
    }
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
  window.addEventListener('focus', () => void refreshDevices());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshDevices();
  });
  window.addEventListener('ivoc-media-liveness', () => {
    renderDeviceCheck();
    if (state.view === 'training' || state.view === 'simulation') evaluateReadiness();
  });
  window.addEventListener('pagehide', () => {
    void state.durable.abandon({ reason: 'pagehide', keepalive: true }).catch(() => {});
  }, { capture: true });

  try {
    state.admission = await loadIvPrepSession();
  } catch {
    state.admission = null;
  }
  applyIdentity();
  applyHomeModel();
  applyRole('student');

  if (state.admission?.admitted && state.admission?.runtime?.mode === 'hosted') {
    try {
      await state.durable.bootstrap();
      state.durableAvailable = state.durable.ready;
      await refreshQuestionGovernance();
      await hydrateHome();
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
