import {
  DEBRIEF_FOLLOWUPS,
  PLAYBOOK_TOPICS,
} from "./fixtures.mjs";
import { createDefaultQuestionStore, COLLECTIONS } from "../questions/question-store.mjs";

const questionStore = createDefaultQuestionStore();

const QUESTIONS = questionStore.all().map((q) => ({
  id: q.question_id,
  category: q.core_priority ? "Core" : (q.tags?.[0] || "General"),
  prompt: q.canonical_text,
  // No coaching field exists on canonical records and none is invented here; the line
  // states real provenance and tags instead.
  why: `${q.source === "founder_core" ? "Founder CORE" : q.source === "mr142" ? "Mission Residency" : "Behavioral"} · ${(q.tags || []).filter((t) => t !== "CORE").slice(0, 3).join(" · ") || "general"}`,
  minutes: q.difficulty >= 3 ? 3 : 2,
  profile: q.core_priority === true,
  tags: q.tags || [],
  difficulty: q.difficulty || 1,
  core: q.core_priority === true,
  behavioral: q.behavioral === true,
  source: q.source,
}));

const QUESTION_CATEGORIES = [...new Set(QUESTIONS.map((q) => q.category))];
import {
  acquireT1Lease,
  authorizeFounderTest,
  canUsePaidFounderControls,
  createFounderMediaReadinessGate,
  createFounderTransportTerminationGate,
  createNoReconnectPolicy,
  endInterview,
  loadInterviewStatus,
  loadIvPrepSession,
  loadT1LeaseState,
  loadVault,
  recordInterviewMediaReady,
  releaseT1Lease,
  startInterview,
} from "./api-client.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let faceModule = null;
let faceRegistry = null;
let pitchCartridge = null;

async function ensureTelemetryModules() {
  if (!faceModule) {
    faceModule = await import('./face-landmarks.mjs');
    faceRegistry = new faceModule.FaceMetricRegistry();
    faceModule.onFaceFrame((frame) => faceRegistry.push(frame));
  }
  if (!pitchCartridge) {
    const { PitchCartridge } = await import('./pitch-cartridge.mjs');
    pitchCartridge = new PitchCartridge({ sampleRate: 44100 });
  }
}

const state = {
  entered: false,
  view: "home",
  filters: new Set(),
  plan: [],
  draggedQuestion: null,
  vaultMode: "interviews",
  roomStarted: false,
  roomMuted: false,
  roomSeconds: 0,
  roomTimer: null,
  endConfirmTimer: null,
  countdownTimer: null,
  countdownValue: 10,
  countdownSound: true,
  debriefStep: 0,
  playbookVersion: 3,
  playbook: structuredClone(PLAYBOOK_TOPICS),
  mobileBuilderPane: "questions",
  lastFocus: null,
  admission: null,
  currentInterview: null,
  founderTestPermit: null,
  founderProofRoom: null,
  founderProofStatusTimer: null,
  communicationAnalytics: null,
  diGroups: null,
  communicationAnalyticsResult: null,
  t1LeaseStatusTimer: null,
  t1Lease: Object.freeze({ state: 'NOT_ACQUIRED', heartbeatCount: 0, stableSeconds: 0 }),
  audibleInterviewerTrack: null,
  roomLayoutSwapped: false,
  vaultSessions: []
};

const mobileShell = window.matchMedia("(max-width: 920px)");
const phoneShell = window.matchMedia("(max-width: 680px)");

const analyticsBridge = {
  media: Object.freeze({ cam: false, mic: false, stream: null, AC: null, analyser: null, data: null }),
  ownsStream: false,
  source: null,
  async bindStream(stream, { ownsStream = false } = {}) {
    this.stopMedia();
    if (!(stream instanceof MediaStream)) throw new TypeError('A browser media stream is required.');
    const tracks = stream.getTracks();
    const mic = tracks.some((track) => track.kind === 'audio' && track.readyState === 'live');
    const cam = tracks.some((track) => track.kind === 'video' && track.readyState === 'live');
    let AC = null;
    let analyser = null;
    let data = null;
    let source = null;
    if (mic) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        AC = new AudioContext();
        await AC.resume();
        analyser = AC.createAnalyser();
        analyser.fftSize = 2048;
        data = new Float32Array(analyser.fftSize);
        source = AC.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
        source.connect(analyser);
      }
    }
    this.ownsStream = ownsStream;
    this.source = source;
    this.media = Object.freeze({ cam, mic: Boolean(mic && AC && analyser && data), stream, AC, analyser, data });
    return this.media;
  },
  async requestMedia(mic = true, cam = true) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: mic === true, video: cam === true });
    return this.bindStream(stream, { ownsStream: true });
  },
  stopMedia() {
    try { this.source?.disconnect?.(); } catch {}
    if (this.ownsStream) this.media.stream?.getTracks?.().forEach((track) => track.stop());
    void this.media.AC?.close?.().catch?.(() => {});
    this.ownsStream = false;
    this.source = null;
    this.media = Object.freeze({ cam: false, mic: false, stream: null, AC: null, analyser: null, data: null });
  },
};

// Y1-Y2-CAM-V6-3505: real authenticated identity. The shell previously displayed a
// fixture student ("Priya Sharma") as though it were a real assignment. Identity now
// comes from the admission payload, and an unavailable field is stated honestly rather
// than invented.
function applyRealIdentity() {
  const identity = state.admission?.identity || null;
  const nameEl = document.getElementById("identity-name");
  const subEl = document.getElementById("identity-sub");
  const markEl = document.getElementById("identity-initials");
  if (!identity) {
    if (nameEl) nameEl.textContent = "Not signed in";
    if (subEl) subEl.textContent = "AUTHENTICATION REQUIRED";
    if (markEl) markEl.textContent = "—";
    return;
  }
  const roles = Array.isArray(identity.roles) ? identity.roles : [];
  const isFounder = identity.founder === true || roles.includes("administrator");
  if (nameEl) nameEl.textContent = identity.subject || "Signed in";
  if (subEl) subEl.textContent = isFounder ? "FOUNDER / ADMIN" : (roles[0] ? roles[0].toUpperCase() : "STUDENT");
  if (markEl) markEl.textContent = isFounder ? "DB" : String(identity.wpUserId ?? "?").slice(0, 2);
  const greeting = document.getElementById("home-greeting");
  if (greeting && isFounder) greeting.textContent = "Founder / Admin session. Delivery Intelligence and the full question library are available.";
}

async function mountDeliveryIntelligenceGroups() {
  // Hierarchical FACE family + real F0 pitch. Display-only: collapsing a group or
  // hiding a lane never stops measurement, because visibility state lives entirely in
  // the panel and has no path back into the pipeline.
  if (state.diGroups) return;
  try {
    const { DeliveryIntelligenceGroups } = await import("../analytics/di-groups-ui.mjs");
    const host = document.getElementById("communication-analytics-test-root");
    if (!host) return;
    const mount = document.createElement("div");
    mount.id = "di-groups-mount";
    host.append(mount);
    state.diGroups = new DeliveryIntelligenceGroups(mount);
    // Y1-Y2-CAM-V6-3507: this used to read `state.communicationAnalytics?.pipeline`,
    // which the facade never exposed, so the optional call silently no-opped and every
    // FACE / PITCH lane stayed UNAVAILABLE forever. Use the real seam.
    state.communicationAnalytics?.onDiagnostic?.((detail) => {
      try { state.diGroups.ingest(detail); } catch { /* rendering must never break capture */ }
    });
  } catch { /* the cockpit stays usable if the group panel fails to load */ }
}

async function initializeDeliveryIntelligence() {
  if (!state.admission?.admitted || state.admission?.runtime?.mode !== 'hosted' || state.communicationAnalytics) return;
  const { initializeAnalyticsUi } = await import('../analytics/ui.mjs');
  state.communicationAnalytics = initializeAnalyticsUi(analyticsBridge, {
    surfaceIds: {
      video: 'founder-student-video',
      stage: 'founder-student-stage',
      room: 'founder-room-stage',
      wrapper: 'founder-room-wrapper',
      playback: 'playback',
    },
    overlayPolicy: {
      authorized: true,
      enabled: true,
      face: true,
      bodyHands: true,
      studentPrimary: true,
    },
  });
  state.communicationAnalytics.onViewChange(state.view, 'admin');
}

function reducedMotionRequested() {
  return document.body.classList.contains("reduce-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setMobileNavigation(open, { restoreFocus = false } = {}) {
  const rail = $("#left-rail");
  const menu = $("#mobile-menu");
  const backdrop = $("#nav-backdrop");
  const enabled = mobileShell.matches;
  const nextOpen = enabled && open;
  rail.classList.toggle("open", nextOpen);
  rail.inert = enabled && !nextOpen;
  if (enabled) rail.setAttribute("aria-hidden", String(!nextOpen));
  else rail.removeAttribute("aria-hidden");
  backdrop.hidden = !nextOpen;
  menu.setAttribute("aria-expanded", String(nextOpen));
  menu.setAttribute("aria-label", nextOpen ? "Close navigation" : "Open navigation");
  if (nextOpen) $(".nav-item", rail)?.focus();
  else if (restoreFocus) menu.focus();
}

function setMobileSheet({ className, panel, backdrop, trigger, open, focusTarget }) {
  document.body.classList.toggle(className, open);
  const panelElement = $(panel);
  if (panelElement?.id === "filter-drawer") panelElement.hidden = !open;
  const backdropElement = $(backdrop);
  if (backdropElement) backdropElement.hidden = !open;
  const triggerElement = $(trigger);
  triggerElement?.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("mobile-sheet-open", ["question-filter-open", "vault-filter-open", "debrief-review-open"].some((name) => document.body.classList.contains(name)));
  if (open) $(focusTarget, panelElement)?.focus();
  else triggerElement?.focus();
}

function closeMobileSheets({ restoreFocus = false } = {}) {
  const sheets = [
    ["question-filter-open", "#filter-drawer", "#question-filter-backdrop", "#filter-toggle"],
    ["vault-filter-open", "#vault-filters", "#vault-filter-backdrop", "#mobile-vault-filter"],
    ["debrief-review-open", "#debrief-record-panel", "#debrief-review-backdrop", "#mobile-debrief-review"]
  ];
  for (const [className, panel, backdrop, trigger] of sheets) {
    const wasOpen = document.body.classList.contains(className);
    document.body.classList.remove(className);
    const panelElement = $(panel);
    if (panelElement?.id === "filter-drawer") panelElement.hidden = true;
    $(backdrop).hidden = true;
    $(trigger)?.setAttribute("aria-expanded", "false");
    if (restoreFocus && wasOpen) $(trigger)?.focus();
  }
  document.body.classList.remove("mobile-sheet-open");
}

function setMobileBuilderPane(pane, { focus = false } = {}) {
  if (!["questions", "plan"].includes(pane)) return;
  state.mobileBuilderPane = pane;
  $("#builder-grid").dataset.mobilePane = pane;
  $$('[data-builder-tab]').forEach((button) => {
    const active = button.dataset.builderTab === pane;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && focus) button.focus();
  });
}

function setRoomComposer(open, { restoreFocus = false } = {}) {
  const composer = $("#typed-room-answer");
  composer.hidden = !open;
  document.body.classList.toggle("room-composer-open", open);
  $("#room-type").setAttribute("aria-expanded", String(open));
  document.body.dataset.roomState = open ? "typed" : (state.roomStarted ? "active" : "ready");
  if (open) $("#room-answer").focus();
  else if (restoreFocus) $("#room-type").focus();
}

function resetEndConfirmation() {
  window.clearTimeout(state.endConfirmTimer);
  state.endConfirmTimer = null;
  const endButton = $("#room-end");
  endButton.classList.remove("confirming");
  endButton.innerHTML = "<span>■</span>End";
  endButton.setAttribute("aria-label", "End interview");
  $("#room-status").textContent = state.roomStarted
    ? "Secure voice-only interview active. Video remains off."
    : "Ready when you are.";
}

function syncResponsiveState() {
  setMobileNavigation(false);
  if (!phoneShell.matches) {
    closeMobileSheets();
    $("#filter-drawer").hidden = true;
  }
}

const viewMeta = {
  home: ["TODAY'S PRACTICE", "Your private interview coach"],
  instant: ["FAST PRACTICE", "Start with only three decisions"],
  custom: ["INTERVIEW DESIGNER", "Build the practice you need"],
  room: ["THE ROOM", "Private practice in progress"],
  results: ["YOUR RESULTS", "Evidence from the latest rep"],
  vault: ["INTERVIEW VAULT", "Your searchable practice history"],
  mentor: ["MENTOR REVIEW", "One moment, the right feedback"],
  debrief: ["REAL INTERVIEW DEBRIEF", "Reconstruct what actually happened"],
  file: ["YOUR FILE", "Application-aware preparation"],
  program: ["PROGRAM INTEL", "Prepare for the place, not a generic interview"],
  delivery: ["DELIVERY INTELLIGENCE", "Observable communication evidence"]
};

function toast(message) {
  const region = $("#toast-region");
  const note = document.createElement("div");
  note.className = "toast";
  note.textContent = message;
  region.replaceChildren(note);
  window.setTimeout(() => note.remove(), 3200);
}

function setEntered({ view = "home", focus = true } = {}) {
  state.entered = true;
  $("#intro").hidden = true;
  $("#product-shell").hidden = false;
  document.body.dataset.activeView = view;
  navigate(view, { focus, updateHash: true });
}

function navigate(view, { focus = true, updateHash = true } = {}) {
  if (!viewMeta[view]) return;
  if (!state.entered) {
    setEntered({ view, focus });
    return;
  }

  if (view !== "room" && state.roomStarted) void stopProductionRoom({ results: false });
  state.view = view;
  document.body.dataset.activeView = view;
  if (view === "room" && !state.roomStarted) document.body.dataset.roomState = "ready";
  $$('[data-view-panel]').forEach((panel) => {
    const active = panel.dataset.viewPanel === view;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  $$('[data-nav]').forEach((item) => {
    const active = item.dataset.nav === view;
    item.classList.toggle("active", active);
    if (item.closest("nav")) {
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    }
  });

  const [kicker, title] = viewMeta[view];
  $("#context-kicker").textContent = kicker;
  $("#context-title").textContent = title;
  setMobileNavigation(false);
  closeMobileSheets();
  if (updateHash) history.replaceState(null, "", `#${view}`);
  state.communicationAnalytics?.onViewChange?.(view, 'admin');
  if (focus) $("#main-content").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reducedMotionRequested() || view === "room" ? "auto" : "smooth" });
}

function questionById(id) {
  return QUESTIONS.find((question) => question.id === id);
}

function questionCard(question) {
  const article = document.createElement("article");
  article.className = "question-card";
  article.draggable = true;
  article.dataset.questionId = question.id;
  article.tabIndex = 0;
  const tagHtml = (question.tags || []).slice(0, 3).map((tag) => {
    const cls = tag === "CORE" ? "tag-chip core" : (question.behavioral ? "tag-chip behavioral" : "tag-chip");
    return `<span class="${cls}">${tag}</span>`;
  }).join("");
  const dots = Array.from({ length: 3 }, (_, i) =>
    `<i class="${i < question.difficulty ? 'filled' : ''}"></i>`
  ).join("");
  article.innerHTML = `
    <div class="drag-handle" aria-hidden="true">⠿</div>
    <div class="question-copy">
      <span>${question.category}${question.core ? " · CORE" : ""}</span>
      <h3>${question.prompt}</h3>
      <div class="tag-row">${tagHtml}</div>
      <div class="difficulty" aria-label="Difficulty ${question.difficulty} of 3">${dots}</div>
    </div>
    <div class="card-actions">
      <button type="button" data-view-question="${question.id}">View</button>
      <button type="button" data-add-to-plan="${question.id}">Add <span aria-hidden="true">＋</span></button>
    </div>`;
  return article;
}

function filteredQuestions() {
  const search = $("#question-search").value.trim().toLowerCase();
  return QUESTIONS.filter((question) => {
    const categoryMatch = state.filters.size === 0 || state.filters.has(question.category);
    const searchMatch = !search || `${question.prompt} ${question.why} ${question.category}`.toLowerCase().includes(search);
    return categoryMatch && searchMatch;
  });
}

function renderQuestions() {
  const list = $("#question-list");
  const questions = filteredQuestions();
  list.replaceChildren(...questions.map(questionCard));
  $("#question-count").textContent = `${questions.length} question${questions.length === 1 ? "" : "s"}`;
  if (!questions.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No questions match those filters.";
    list.append(empty);
  }
}

function renderCategoryFilters() {
  const root = $("#category-filters");
  root.replaceChildren(...QUESTION_CATEGORIES.map((category) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${category}"><span>${category}</span>`;
    const input = $("input", label);
    input.checked = state.filters.has(category);
    input.addEventListener("change", () => {
      if (input.checked) state.filters.add(category);
      else state.filters.delete(category);
      $("#filter-count").textContent = String(state.filters.size);
      renderQuestions();
    });
    return label;
  }));
}

function addToPlan(id, { announce = true } = {}) {
  const question = questionById(id);
  if (!question) return;
  if (state.plan.some((item) => item.id === id)) {
    if (announce) toast("That question is already in your interview.");
    return;
  }
  state.plan.push(question);
  renderPlan();
  if (announce) toast("Question added to your interview.");
}

function removeFromPlan(id) {
  state.plan = state.plan.filter((question) => question.id !== id);
  renderPlan();
  toast("Question returned to the library.");
}

function movePlanItem(id, offset) {
  const index = state.plan.findIndex((question) => question.id === id);
  const next = index + offset;
  if (index < 0 || next < 0 || next >= state.plan.length) return;
  [state.plan[index], state.plan[next]] = [state.plan[next], state.plan[index]];
  renderPlan();
  $(`[data-plan-item="${id}"]`)?.focus();
}

function renderPlan() {
  const list = $("#plan-list");
  list.replaceChildren(...state.plan.map((question, index) => {
    const item = document.createElement("li");
    item.className = "plan-item";
    item.draggable = true;
    item.tabIndex = 0;
    item.dataset.planItem = question.id;
    item.innerHTML = `
      <span class="order">${String(index + 1).padStart(2, "0")}</span>
      <div><small>${question.category}</small><strong>${question.prompt}</strong><span>${question.minutes} min</span></div>
      <div class="item-actions" aria-label="Reorder or remove question">
        <button type="button" data-move-plan="up" data-id="${question.id}" aria-label="Move question up">↑</button>
        <button type="button" data-move-plan="down" data-id="${question.id}" aria-label="Move question down">↓</button>
        <button type="button" data-remove-plan="${question.id}" aria-label="Remove question">×</button>
      </div>`;
    return item;
  }));
  const minutes = state.plan.reduce((sum, question) => sum + question.minutes, 0);
  $("#plan-duration").textContent = `${minutes} min`;
  $("#mobile-plan-count").textContent = String(state.plan.length);
  $("#plan-empty").hidden = state.plan.length > 0;
  $("#review-interview").disabled = state.plan.length === 0;
}

function buildProfilePlan() {
  state.plan = QUESTIONS.filter((question) => question.core).slice(0, 5);
  $("#source-status").hidden = false;
  renderPlan();
  closeWorkspace();
  toast("A five-question draft was built from the CORE collection.");
}

function surprisePlan() {
  const source = [...QUESTIONS];
  source.sort(() => Math.random() - 0.5);
  state.plan = source.slice(0, 5);
  renderPlan();
  toast("A balanced five-question interview is ready.");
}

function openWorkspace(html) {
  state.lastFocus = document.activeElement;
  $("#modal-content").innerHTML = html;
  $("#modal-backdrop").hidden = false;
  const dialog = $("#workspace-modal");
  if (!dialog.open) dialog.showModal();
  $("button, input, select, textarea, [tabindex='0']", dialog)?.focus();
}

function closeWorkspace() {
  const dialog = $("#workspace-modal");
  if (dialog.open) dialog.close();
  $("#modal-backdrop").hidden = true;
  state.lastFocus?.focus?.();
}

function openQuestionWorkspace(id) {
  const question = questionById(id);
  if (!question) return;
  openWorkspace(`
    <div class="question-workspace">
      <p class="eyebrow">${question.category} · ${question.minutes} MINUTES</p>
      <h2 id="modal-title">${question.prompt}</h2>
      <p class="workspace-lede">${question.why}</p>
      <div class="question-workspace-grid">
        <section class="workspace-section"><span>WHAT TO PROVE</span><strong>Specific role, visible choice, grounded reflection.</strong><p>Use evidence from your experience. The interviewer should never invent a missing fact.</p></section>
        <section class="workspace-section"><span>COACHING LENS</span><strong>Answer first. Context second.</strong><p>Keep the setup short enough that your contribution is unmistakable.</p></section>
      </div>
      <div class="workspace-actions"><button class="btn btn-primary" type="button" data-modal-add="${question.id}">ADD TO INTERVIEW</button><button class="btn btn-secondary" type="button" data-modal-practice="${question.id}">PRACTICE THIS NOW</button></div>
      <p class="truth-note">Question workspace · preparation data loads from your MissionMed profile.</p>
    </div>`);
}

function openSourceChooser() {
  openWorkspace(`
    <div class="source-chooser">
      <p class="eyebrow gold">BUILD FROM WHAT MISSIONMED KNOWS</p>
      <h2 id="modal-title">Choose a preparation source.</h2>
      <p class="workspace-lede">Build your practice from MissionMed's knowledge of your profile, target programs, and preparation history.</p>
      <div class="source-chooser-grid">
        <button class="source-option" type="button" data-source-choice="profile"><span>MF</span><strong>MissionMed Profile</strong><small>CV transitions, Timeline chronology, StoryForge examples</small><em>CONNECTED FIXTURE</em></button>
        <button class="source-option" type="button" data-source-choice="program"><span>PI</span><strong>Program Intel</strong><small>Build around one program and its sourced differentiators</small><em>PROTOTYPE</em></button>
        <button class="source-option" type="button" data-source-choice="blank"><span>＋</span><strong>Start blank</strong><small>Choose every question yourself</small><em>AVAILABLE</em></button>
      </div>
    </div>`);
}

function tickSound() {
  if (!state.countdownSound) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = state.countdownValue <= 3 ? 520 : 360;
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
    oscillator.addEventListener("ended", () => context.close());
  } catch {
    // Sound is optional; the visible countdown remains complete.
  }
}

function startCountdown(prompt = "Interview Practice · Realistic pressure") {
  window.clearInterval(state.countdownTimer);
  state.lastFocus = document.activeElement;
  state.countdownValue = reducedMotionRequested() ? 3 : 10;
  $("#countdown-prompt").textContent = prompt;
  $("#countdown-number").textContent = String(state.countdownValue);
  const overlay = $("#countdown-overlay");
  if (!overlay.open) overlay.showModal();
  $("#countdown-skip").focus();
  tickSound();
  state.countdownTimer = window.setInterval(() => {
    state.countdownValue -= 1;
    $("#countdown-number").textContent = String(Math.max(0, state.countdownValue));
    if (state.countdownValue <= 0) finishCountdown();
    else tickSound();
  }, 1000);
}

function finishCountdown() {
  window.clearInterval(state.countdownTimer);
  state.countdownTimer = null;
  const overlay = $("#countdown-overlay");
  if (overlay.open) overlay.close();
  navigate("room");
  $("#room-start").focus();
}

function cancelCountdown() {
  window.clearInterval(state.countdownTimer);
  state.countdownTimer = null;
  const overlay = $("#countdown-overlay");
  if (overlay.open) overlay.close();
  state.lastFocus?.focus?.();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function setRoomClockLimit(maximumSeconds) {
  const limit = Number(maximumSeconds);
  const node = $('.room-clock small');
  if (node && Number.isInteger(limit) && limit > 0 && limit <= 60 * 60) node.textContent = `of ${formatTime(limit)}`;
}

function updateRoomClockFromProvider(startedAtMs, maximumSeconds) {
  const started = Number(startedAtMs);
  const maximum = Number(maximumSeconds);
  if (!Number.isFinite(started) || !Number.isInteger(maximum) || maximum < 1 || maximum > 59) return false;
  state.roomSeconds = Math.min(maximum, Math.max(0, Math.floor((Date.now() - started) / 1000)));
  $('#room-time').textContent = formatTime(state.roomSeconds);
  return true;
}

async function startProductionRoom() {
  if (state.roomStarted) return;
  if (state.admission?.founderPaidTest?.enabled && !canUsePaidFounderControls(state.t1Lease.state)) {
    toast('The product lease keeper must be READY before Test #1 can start.');
    return;
  }
  if (state.founderTestPermit && state.t1Lease.workerRegistrationState !== 'READY') {
    toast('Wait for the exact Profile B worker to register before starting the clock.');
    return;
  }
  $("#room-start").disabled = true;
  const videoProof = Boolean(state.founderTestPermit);
  $("#room-status").textContent = videoProof ? "Opening the bounded Founder video proof…" : "Opening the secure voice-only interview…";
  try {
    const idempotencyKey = `room-${Date.now()}-${crypto.randomUUID()}`;
    const started = await startInterview({
      mode: videoProof ? "video" : "voice-only",
      idempotencyKey,
      authorization: state.founderTestPermit,
    });
    state.currentInterview = started.interview;
    if (videoProof) started.providerStatus = await connectFounderProofMedia(started);
  } catch (error) {
    const interview = state.currentInterview;
    if (interview?.id) {
      try { await endInterview(interview.id); }
      catch {
        toast("Startup cleanup is unresolved. New video starts remain disabled.");
      }
      state.currentInterview = null;
    }
    window.clearInterval(state.founderProofStatusTimer);
    state.founderProofStatusTimer = null;
    try { await state.founderProofRoom?.localParticipant?.setMicrophoneEnabled?.(false); }
    catch { /* the server-side kill path above remains authoritative */ }
    state.founderProofRoom?.disconnect?.(true);
    state.founderProofRoom = null;
    state.audibleInterviewerTrack = null;
    if (state.admission?.founderPaidTest?.enabled && state.admission?.runtime?.mode !== 'hosted') {
      try { state.t1Lease = Object.freeze(await releaseT1Lease()); }
      catch { state.t1Lease = Object.freeze({ ...state.t1Lease, state: 'LOST' }); }
      renderT1LeaseState();
    }
    $("#room-start").disabled = !canUsePaidFounderControls(state.t1Lease.state)
      || state.t1Lease.workerRegistrationState !== 'READY';
    $("#room-status").textContent = error.code === "ivprep_unavailable" ? "Interview starts are temporarily disabled." : "Secure admission could not be confirmed.";
    toast("Interview start failed closed; provider cleanup was requested.");
    return;
  }
  state.roomStarted = true;
  ensureTelemetryModules().then(() => {
    const video = $('#founder-student-video');
    if (video && faceModule) {
      faceModule.initFaceLandmarks().then(() => faceModule.startFaceProcessing(video)).catch(() => {});
    }
    if (pitchCartridge && analyticsBridge.media.analyser && analyticsBridge.media.data) {
      pitchCartridge.reset();
      const { analyser, data } = analyticsBridge.media;
      state._pitchTick = window.setInterval(() => {
        analyser.getFloatTimeDomainData(data);
        pitchCartridge.process(data);
      }, 50);
    }
  }).catch(() => {});
  if (analyticsBridge.media.stream && !state.communicationAnalytics?.diagnostics?.().active) {
    try {
      state.communicationAnalytics?.beginAnswer?.({
        answerId: `hosted-${started.interview.id}`,
        videoElement: $('#founder-student-video'),
      });
    } catch { /* analytics fails unavailable without blocking the interview */ }
  }
  const providerTiming = started.providerStatus?.provider || null;
  state.roomSeconds = 0;
  setRoomClockLimit(videoProof ? providerTiming?.maximumSeconds : 15 * 60);
  updateRoomClockFromProvider(providerTiming?.startedAtMs, providerTiming?.maximumSeconds);
  document.body.dataset.roomState = "active";
  $("#room-start").innerHTML = "<span>●</span> Interview active";
  $("#room-status").textContent = videoProof ? "Founder proof is active. Dr Kelly is the sole avatar and audio authority." : "Secure voice-only interview active. Video remains off.";
  state.roomTimer = window.setInterval(() => {
    if (!updateRoomClockFromProvider(providerTiming?.startedAtMs, providerTiming?.maximumSeconds)) {
      state.roomSeconds += 1;
      $('#room-time').textContent = formatTime(state.roomSeconds);
    }
  }, 1000);
}

async function stopProductionRoom({
  results = true,
  skipServerEnd = false,
  terminalMessage = "Ready when you are.",
} = {}) {
  const founderSequenceWasEnabled = state.admission?.founderPaidTest?.enabled === true;
  window.clearInterval(state.roomTimer);
  state.roomTimer = null;
  window.clearInterval(state._pitchTick);
  state._pitchTick = null;
  faceModule?.stopFaceProcessing?.();
  const interview = state.currentInterview;
  try {
    state.communicationAnalyticsResult = state.communicationAnalytics?.endAnswer?.({ mediaAvailable: false }) || null;
    if (state.communicationAnalyticsResult) state.communicationAnalytics?.renderStudentResults?.(state.communicationAnalyticsResult);
  } catch { state.communicationAnalyticsResult = null; }
  const activeRoom = state.founderProofRoom;
  if (activeRoom?.localParticipant) {
    try { await activeRoom.localParticipant.setMicrophoneEnabled(false); }
    catch {
      terminalMessage = 'Interview ended locally; microphone shutdown was not confirmed.';
    }
  }
  if (interview?.id && !skipServerEnd) {
    try { await endInterview(interview.id); }
    catch {
      $("#room-status").textContent = "Interview ended locally; server cleanup is unresolved.";
      toast("Cleanup is unresolved. New video starts remain disabled.");
    }
  }
  state.founderTestPermit = null;
  let nextFounderProof = null;
  if (founderSequenceWasEnabled) {
    try {
      state.admission = await loadIvPrepSession();
      nextFounderProof = state.admission?.founderPaidTest || null;
    } catch {
      terminalMessage = 'Interview ended; the next Founder test contract could not be verified.';
    }
  }
  const nextFounderTestReady = nextFounderProof?.enabled === true && nextFounderProof.state === 'READY';
  if (!nextFounderTestReady && founderSequenceWasEnabled
    && state.admission?.runtime?.mode !== 'hosted'
    && state.t1Lease.state !== 'NOT_ACQUIRED') {
    try { state.t1Lease = Object.freeze(await releaseT1Lease()); }
    catch { state.t1Lease = Object.freeze({ ...state.t1Lease, state: 'LOST' }); }
  }
  window.clearInterval(state.founderProofStatusTimer);
  state.founderProofStatusTimer = null;
  state.founderProofRoom?.disconnect?.(true);
  state.founderProofRoom = null;
  analyticsBridge.stopMedia();
  state.audibleInterviewerTrack = null;
  state.roomMuted = false;
  $('#room-mute').classList.remove('active');
  $('#room-mute').setAttribute('aria-pressed', 'false');
  $('#room-mute').innerHTML = '<span>♩</span>Mute';
  state.currentInterview = null;
  state.roomStarted = false;
  state.roomSeconds = 0;
  $('#room-time').textContent = '00:00';
  setRoomClockLimit(15 * 60);
  document.body.dataset.roomState = "ready";
  setRoomComposer(false);
  resetEndConfirmation();
  renderFounderProofContract(nextFounderProof);
  renderT1LeaseState();
  $("#room-start").innerHTML = "<span>●</span> Start interview";
  $("#room-status").textContent = terminalMessage;
  if (results) navigate("results");
}

async function ensureLiveKitClient() {
  if (window.LivekitClient?.Room) return window.LivekitClient;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-livekit-client]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = '/iv-prep-on-call/assets/vendor/livekit-client.umd.js';
    script.dataset.livekitClient = 'true';
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.append(script);
  });
  if (!window.LivekitClient?.Room) throw new Error('LiveKit browser adapter is unavailable.');
  return window.LivekitClient;
}

async function waitForFounderProofActive(interviewId, setMilestone, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  do {
    const status = await loadInterviewStatus(interviewId);
    setMilestone('worker', status.provider?.state || 'Starting');
    if (status.provider?.state === 'ACTIVE' && status.interview?.state === 'active') return status;
    if (['CLOSED', 'FAILED_CLOSED'].includes(status.provider?.state)
      || ['ended', 'failed_closed'].includes(status.interview?.state)) {
      throw new Error('ivprep_media_readiness_unconfirmed');
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error('ivprep_media_readiness_unconfirmed');
}

function decodedVideoProof(video, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener('error', onError);
      if (ok) resolve(true);
      else reject(new Error('ivprep_media_readiness_unconfirmed'));
    };
    const onError = () => finish(false);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    video.addEventListener('error', onError, { once: true });
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => finish(true));
    } else {
      video.addEventListener('playing', () => finish(video.readyState >= 2), { once: true });
    }
  });
}

async function audibleAudioProof(audio, timeoutMs = 10_000) {
  await audio.play();
  if (!audio.paused && audio.readyState >= 2) return true;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('ivprep_media_readiness_unconfirmed'));
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timer);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('error', onError);
    };
    const onPlaying = () => {
      if (audio.paused || audio.readyState < 2) return;
      cleanup();
      resolve(true);
    };
    const onError = () => {
      cleanup();
      reject(new Error('ivprep_media_readiness_unconfirmed'));
    };
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('error', onError, { once: true });
  });
}

async function connectFounderProofMedia(started) {
  const connection = started?.connection;
  if (!connection?.url || !connection?.token || !started?.interview?.id
    || !/^[A-Za-z0-9._:-]{8,160}$/u.test(String(connection.avatarParticipantIdentity || ''))) {
    throw new Error('ivprep_media_readiness_unconfirmed');
  }
  const avatarParticipantIdentity = connection.avatarParticipantIdentity;
  const setMilestone = (name, value) => {
    const node = $(`[data-proof-milestone="${name}"]`);
    if (node) node.textContent = value;
  };
  setMilestone('authorization', 'Bound');
  setMilestone('dispatch', 'One-shot');
  let activeStatus = null;
  if (connection.synthetic === true || connection.url === 'wss://synthetic.invalid') {
    setMilestone('media', 'Synthetic ready');
    await recordInterviewMediaReady(started.interview.id, avatarParticipantIdentity);
    activeStatus = await waitForFounderProofActive(started.interview.id, setMilestone);
  } else {
    const livekit = await ensureLiveKitClient();
    const room = new livekit.Room({
      adaptiveStream: true,
      dynacast: false,
      disconnectOnPageLeave: true,
      reconnectPolicy: createNoReconnectPolicy(),
    });
    state.founderProofRoom = room;
    let videoReady = false;
    let audioReady = false;
    let mediaCommitPromise = null;
    let failTransport;
    const transportFailure = new Promise((resolve, reject) => { failTransport = reject; });
    const transportGate = createFounderTransportTerminationGate({
      onPreReadyFailure: () => failTransport(new Error('ivprep_media_readiness_unconfirmed')),
      onPostReadyFailure: () => stopProductionRoom({
        results: false,
        terminalMessage: 'Founder proof ended after avatar media transport was lost.',
      }),
    });
    const maybeReady = async () => {
      if (!videoReady || !audioReady || state.currentInterview?.id !== started.interview.id) return;
      if (!mediaCommitPromise) {
        mediaCommitPromise = (async () => {
          setMilestone('media', 'Decoded + audible');
          await recordInterviewMediaReady(started.interview.id, avatarParticipantIdentity);
          await waitForFounderProofActive(started.interview.id, setMilestone);
          return true;
        })();
      }
      return mediaCommitPromise;
    };
    const failClosed = (reason = 'media_transport_failed') => transportGate.fail(reason);
    const mediaGate = createFounderMediaReadinessGate({
      avatarParticipantIdentity,
      onReady: maybeReady,
      onFail: failClosed,
    });
    room.on(livekit.RoomEvent.Reconnecting, failClosed);
    room.on(livekit.RoomEvent.Disconnected, failClosed);
    room.on(livekit.RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (participant?.identity === avatarParticipantIdentity) mediaGate.fail('avatar_track_unsubscribed');
    });
    room.on(livekit.RoomEvent.AudioPlaybackStatusChanged, () => {
      if (room.canPlaybackAudio === false) failClosed();
    });
    room.on(livekit.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (participant?.identity !== avatarParticipantIdentity) {
        track.detach();
        return;
      }
      if (track.kind === livekit.Track.Kind.Video && !videoReady) {
        const video = $('#founder-avatar-video');
        track.attach(video);
        video.style.objectFit = 'contain';
        video.style.objectPosition = 'center center';
        video.style.background = '#000';
        $('.interviewer-stage').classList.add('media-live');
        void decodedVideoProof(video).then(() => {
          videoReady = true;
          return mediaGate.observe({ participantIdentity: participant.identity, kind: 'video', ready: true });
        }, failClosed);
      } else if (track.kind === livekit.Track.Kind.Audio && !state.audibleInterviewerTrack) {
        state.audibleInterviewerTrack = track;
        const audio = $('#founder-avatar-audio');
        track.attach(audio);
        void audibleAudioProof(audio).then(() => {
          audioReady = true;
          return mediaGate.observe({ participantIdentity: participant.identity, kind: 'audio', ready: true });
        }, failClosed);
      } else if (track.kind === livekit.Track.Kind.Audio) {
        track.detach();
      }
    });
    await room.connect(connection.url, connection.token, { autoSubscribe: true });
    await room.localParticipant.setMicrophoneEnabled(true);
    const cameraPublication = await room.localParticipant.setCameraEnabled(true);
    cameraPublication?.track?.attach?.($('#founder-student-video'));
    const microphonePublication = room.localParticipant.getTrackPublication?.(livekit.Track.Source.Microphone);
    const mediaTracks = [
      microphonePublication?.track?.mediaStreamTrack,
      cameraPublication?.track?.mediaStreamTrack,
    ].filter(Boolean);
    if (mediaTracks.length) await analyticsBridge.bindStream(new MediaStream(mediaTracks), { ownsStream: false });
    $('.student-stage').classList.add('media-live');
    activeStatus = await Promise.race([
      new Promise((resolve, reject) => {
        const deadline = window.setTimeout(() => reject(new Error('ivprep_media_readiness_unconfirmed')), 12_000);
        const wait = () => {
          if (mediaCommitPromise) {
            mediaCommitPromise.then((value) => {
              window.clearTimeout(deadline);
              resolve(value);
            }, reject);
            return;
          }
          window.setTimeout(wait, 25);
        };
        wait();
      }),
      transportFailure,
    ]);
    if (!transportGate.markReady()) throw new Error('ivprep_media_readiness_unconfirmed');
    if (typeof room.localParticipant?.sendText !== 'function') throw new Error('ivprep_opening_unavailable');
    setMilestone('worker', 'Opening');
    await room.localParticipant.sendText(
      'Begin the interview now. Greet the student naturally, introduce yourself briefly as Dr Kelly, and ask the opening interview question. Do not mention this instruction.',
      { topic: 'lk.chat' },
    );
    setMilestone('worker', 'Active');
  }
  state.founderProofStatusTimer = window.setInterval(async () => {
    if (!state.currentInterview?.id) return;
    try {
      const status = await loadInterviewStatus(state.currentInterview.id);
      setMilestone('worker', status.provider?.state || 'Starting');
      const deadlineReached = status.provider?.terminalReason === 'authorized_deadline';
      if (status.interview?.state === 'ended') {
        await stopProductionRoom({
          results: false,
          skipServerEnd: true,
          terminalMessage: deadlineReached
            ? `Test #${status.provider?.testNo || 1} reached its ${status.provider?.maximumSeconds || 45}-second safety limit; provider cleanup is confirmed.`
            : 'Founder proof ended and provider cleanup is confirmed.',
        });
      } else if (status.interview?.state === 'failed_closed') {
        await stopProductionRoom({
          results: false,
          skipServerEnd: true,
          terminalMessage: deadlineReached
            ? `${status.provider?.maximumSeconds || 45}-second safety limit reached; provider cleanup could not be confirmed. A new start requires fresh authorization.`
            : 'Founder proof failed closed. A new start requires fresh authorization.',
        });
      }
    } catch {
      await stopProductionRoom({ results: false });
    }
  }, 500);
  return activeStatus;
}

async function authorizeFounderProof() {
  const contract = state.admission?.founderPaidTest;
  if (!contract?.enabled) return;
  if (!canUsePaidFounderControls(state.t1Lease.state)) {
    toast('Wait for the durable product lease to reach READY.');
    return;
  }
  const button = $('#founder-authorize-test');
  button.disabled = true;
  try {
    const issued = await authorizeFounderTest({
      agentId: contract.agentId,
      profile: contract.profile,
      voice: $('#founder-proof-voice').value,
      maxSeconds: contract.maximumSeconds,
      idempotencyKey: `authorize-${crypto.randomUUID()}`,
    });
    state.founderTestPermit = issued.authorization;
    $('#founder-proof-state').textContent = 'AUTHORIZED ONCE';
    $('#founder-proof-selected').textContent = `${issued.authorization.voice} · ${issued.authorization.maxSeconds}s maximum`;
    $('#room-start').innerHTML = '<span>●</span> Start Founder video proof';
    renderT1LeaseState();
    toast(`Founder Test #${issued.authorization.testNo} is bound. Start stays disabled until the exact Profile B worker registers.`);
  } catch (error) {
    button.disabled = false;
    $('#founder-proof-state').textContent = 'DENIED';
    toast(error.code || 'Founder authorization failed closed.');
  }
}

function renderFounderProofContract(founderProof) {
  const panel = $('#founder-proof-panel');
  if (!panel) return;
  panel.hidden = founderProof?.enabled !== true;
  if (founderProof?.enabled !== true) return;
  const testNo = Number(founderProof.testNo);
  panel.querySelector('.eyebrow.gold').textContent = `FOUNDER TEST #${testNo} · ONE SHOT`;
  $('#founder-proof-agent').textContent = founderProof.agentId;
  $('#founder-proof-duration').textContent = `${founderProof.maximumSeconds}s hard maximum`;
  $('#founder-proof-state').textContent = founderProof.state === 'READY' ? 'NOT AUTHORIZED' : founderProof.state;
  $('#founder-authorize-test').textContent = `AUTHORIZE TEST #${testNo} ONCE`;
  $('#founder-proof-selected').textContent = `Test #${testNo} · ${founderProof.maximumSeconds}s maximum`;
  const voice = $('#founder-proof-voice');
  const selected = founderProof.voices.includes(voice.value) ? voice.value : 'marin';
  voice.replaceChildren(...founderProof.voices.map((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.selected = name === selected;
    return option;
  }));
}

function renderT1LeaseState() {
  const lease = state.t1Lease || { state: 'LOST', heartbeatCount: 0, stableSeconds: 0 };
  const stateNode = $('#founder-lease-state');
  const detailNode = $('#founder-lease-detail');
  const acquireButton = $('#founder-acquire-lease');
  const authorizeButton = $('#founder-authorize-test');
  const ready = canUsePaidFounderControls(lease.state);
  const workerReady = lease.workerRegistrationState === 'READY';
  if (stateNode) stateNode.textContent = lease.state;
  if (detailNode) {
    detailNode.textContent = lease.state === 'STABILIZING'
      ? `${lease.heartbeatCount} heartbeats · ${lease.stableSeconds}s stable · 30s required`
      : lease.state === 'READY'
        ? `${lease.heartbeatCount} heartbeats · ${lease.stableSeconds}s stable · ${state.founderTestPermit && !workerReady ? 'waiting for Profile B worker registration' : 'automatic keeper active'}`
        : lease.state === 'LOST'
          ? 'Authority was lost. Paid controls are closed and no automatic reacquire is allowed.'
          : lease.state === 'RELEASED'
            ? 'Lease released. This harness cannot reacquire automatically.'
            : 'Founder may start the keeper when physically ready.';
  }
  if (acquireButton) {
    acquireButton.disabled = lease.state !== 'NOT_ACQUIRED';
    acquireButton.textContent = lease.state === 'NOT_ACQUIRED' ? 'START LEASE KEEPER' : `LEASE ${lease.state}`;
  }
  if (authorizeButton) authorizeButton.disabled = !ready || Boolean(state.founderTestPermit);
  if ($('#room-start') && !state.roomStarted) {
    $('#room-start').disabled = !ready || !state.founderTestPermit || !workerReady;
  }
}

async function refreshT1LeaseState() {
  try {
    const previous = state.t1Lease.state;
    state.t1Lease = Object.freeze(await loadT1LeaseState());
    renderT1LeaseState();
    if (state.t1Lease.state === 'LOST' && previous !== 'LOST' && state.roomStarted) {
      await stopProductionRoom({
        results: false,
        terminalMessage: 'Founder proof stopped because product lease authority was lost.',
      });
    }
  } catch {
    state.t1Lease = Object.freeze({ ...state.t1Lease, state: 'LOST' });
    renderT1LeaseState();
  }
}

async function acquireFounderProofLease() {
  const button = $('#founder-acquire-lease');
  button.disabled = true;
  try {
    state.t1Lease = Object.freeze(await acquireT1Lease());
    renderT1LeaseState();
    toast('Lease keeper is stabilizing automatically. Provider calls remain zero.');
  } catch (error) {
    state.t1Lease = Object.freeze({ ...state.t1Lease, state: 'LOST' });
    renderT1LeaseState();
    toast(error.code || 'Lease keeper failed closed.');
  }
}

function requestEndInterview() {
  const endButton = $("#room-end");
  if (endButton.classList.contains("confirming")) {
    void stopProductionRoom();
    return;
  }
  endButton.classList.add("confirming");
  endButton.textContent = "Tap again to end";
  endButton.setAttribute("aria-label", "Confirm end interview");
  $("#room-status").textContent = "Tap End again to finish the interview.";
  state.endConfirmTimer = window.setTimeout(resetEndConfirmation, 4000);
}

function renderVault() {
  const query = $("#vault-search").value.trim().toLowerCase();
  const list = $("#vault-list");
  const hitsRoot = $("#transcript-hits");
  const sessions = state.vaultSessions.filter((session) => {
    const haystack = `${session.title} ${session.type} ${session.interviewer} ${session.status} ${session.highlight} ${session.transcript.map((line) => line.text).join(" ")}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  const transcriptHits = query ? state.vaultSessions.flatMap((session) => session.transcript
    .filter((line) => line.text.toLowerCase().includes(query))
    .map((line) => ({ session, line }))) : [];
  hitsRoot.hidden = transcriptHits.length === 0;
  hitsRoot.innerHTML = transcriptHits.length ? `<strong>${transcriptHits.length} transcript match${transcriptHits.length === 1 ? "" : "es"}</strong>${transcriptHits.map(({ session, line }) => `<button class="transcript-hit" type="button" data-transcript-session="${session.id}" data-transcript-time="${line.time}"><span>${line.time}</span><b>${line.text.replace(new RegExp(query, "ig"), (match) => `<mark>${match}</mark>`)}</b></button>`).join("")}` : "";

  if (state.vaultMode === "questions") {
    const questionAttempts = sessions.flatMap((session) => session.transcript.map((line) => ({ session, line })));
    list.innerHTML = questionAttempts.map(({ session, line }) => `<article class="vault-card question-history"><div><span>${line.time}</span><p class="eyebrow">${session.date} · ${session.interviewer}</p><h2>${line.text}</h2></div><button type="button" data-transcript-session="${session.id}" data-transcript-time="${line.time}">Open moment →</button></article>`).join("");
    return;
  }

  list.innerHTML = sessions.map((session) => `<article class="vault-card"><div class="vault-date"><strong>${session.date}</strong><span>${session.duration}</span></div><div><p class="eyebrow">${session.type} · ${session.interviewer}</p><h2>${session.title}</h2><p>${session.questions} questions · ${session.highlight}</p><span class="status-pill">${session.status}</span></div><div class="vault-card-actions"><button type="button" data-open-session="${session.id}">Open workspace</button><button type="button" data-transcript-session="${session.id}" data-transcript-time="${session.transcript[0].time}">Replay first moment</button></div></article>`).join("");
  if (!sessions.length) list.innerHTML = `<p class="empty-state">No saved sessions are available. Durable vault persistence is not active.</p>`;
}

function openSession(sessionId, time = null) {
  const session = state.vaultSessions.find((item) => item.id === sessionId);
  if (!session) return;
  const selectedTime = time || session.transcript[0].time;
  openWorkspace(`
    <div class="session-workspace">
      <p class="eyebrow">${session.date} · ${session.type}</p>
      <h2 id="modal-title">${session.title}</h2>
      <div class="session-player"><span>▶</span><div><strong>Prototype replay at ${selectedTime}</strong><p>Media transport is not connected in this visual lane.</p></div></div>
      <ol class="workspace-transcript">${session.transcript.map((line) => `<li class="${line.time === selectedTime ? "active" : ""}"><button type="button" data-session-seek="${line.time}">${line.time}</button><p>${line.text}</p></li>`).join("")}</ol>
      <p class="truth-note">Replay appears only as a UX state, not as a claim that media exists.</p>
    </div>`);
}

function openMoment(time) {
  openWorkspace(`
    <div class="moment-workspace">
      <p class="eyebrow gold">REPLAY MOMENT · ${time}</p>
      <h2 id="modal-title">See the coaching evidence in context.</h2>
      <div class="session-player"><span>▶</span><div><strong>Prototype replay is paused at ${time}</strong><p>The production replay adapter remains the media authority.</p></div></div>
      <blockquote>“I noticed the patient was deteriorating before the numbers made it obvious, so I asked the resident to reassess with me.”</blockquote>
      <div class="question-workspace-grid"><section class="workspace-section"><span>OBSERVABLE SIGNAL</span><strong>Answer began with the action.</strong><p>No emotion, personality, or confidence inference.</p></section><section class="workspace-section"><span>NEXT REP</span><strong>Keep the setup under one sentence.</strong><p>Then name your decision and the outcome.</p></section></div>
    </div>`);
}

function appendDebrief() {
  const answer = $("#debrief-answer").value.trim();
  if (!answer) {
    toast("Add what you remember before continuing.");
    $("#debrief-answer").focus();
    return;
  }
  const root = $("#conversation-log");
  const student = document.createElement("article");
  student.className = "user-message";
  student.innerHTML = `<span>YOU</span><div><p>${answer}</p></div>`;
  root.append(student);

  const current = DEBRIEF_FOLLOWUPS[state.debriefStep];
  const recordItems = $$("#debrief-record dd");
  if (current && recordItems[state.debriefStep + 1]) {
    recordItems[state.debriefStep + 1].textContent = answer.length > 62 ? `${answer.slice(0, 59)}…` : answer;
    recordItems[state.debriefStep + 1].classList.remove("pending");
  }
  state.debriefStep += 1;
  const next = DEBRIEF_FOLLOWUPS[state.debriefStep];
  if (next) {
    const coach = document.createElement("article");
    coach.className = "ai-message";
    coach.innerHTML = `<span>DB</span><div><p>${next.prompt}</p><small>${next.topic}</small></div>`;
    root.append(coach);
  } else {
    const coach = document.createElement("article");
    coach.className = "ai-message complete";
    coach.innerHTML = `<span>DB</span><div><p>That is enough to organize a useful record without filling in anything you did not say.</p><small>Ready to finish</small></div>`;
    root.append(coach);
    $("#send-debrief").disabled = true;
  }
  $("#debrief-progress").textContent = `${Math.min(8, state.debriefStep + 1)} of 8 topics captured`;
  $("#debrief-answer").value = "";
  root.scrollTop = root.scrollHeight;
}

function renderPlaybook() {
  const root = $("#playbook-list");
  root.innerHTML = state.playbook.map((topic, index) => `
    <article class="playbook-topic" data-playbook-id="${topic.id}">
      <span class="drag-handle" aria-hidden="true">⠿</span>
      <div><label>Topic name<input type="text" value="${topic.name}" data-topic-name="${topic.id}"></label><label>Follow-up prompt<textarea rows="2" data-topic-prompt="${topic.id}">${topic.prompt}</textarea></label></div>
      <label class="switch"><input type="checkbox" data-topic-enabled="${topic.id}" ${topic.enabled ? "checked" : ""} aria-label="${topic.enabled ? "Disable" : "Enable"} ${topic.name}"><span aria-hidden="true"></span><b>${topic.enabled ? "Active" : "Off"}</b></label>
      <div class="playbook-order"><button type="button" data-topic-move="up" data-id="${topic.id}" aria-label="Move topic up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-topic-move="down" data-id="${topic.id}" aria-label="Move topic down" ${index === state.playbook.length - 1 ? "disabled" : ""}>↓</button></div>
    </article>`).join("");
}

function openPlaybook() {
  state.lastFocus = document.activeElement;
  renderPlaybook();
  const dialog = $("#playbook-modal");
  if (!dialog.open) dialog.showModal();
  $("input", dialog)?.focus();
}

function closePlaybook() {
  const dialog = $("#playbook-modal");
  if (dialog.open) dialog.close();
  state.lastFocus?.focus?.();
}

function movePlaybook(id, offset) {
  const index = state.playbook.findIndex((topic) => topic.id === id);
  const next = index + offset;
  if (index < 0 || next < 0 || next >= state.playbook.length) return;
  [state.playbook[index], state.playbook[next]] = [state.playbook[next], state.playbook[index]];
  renderPlaybook();
}

function bindStaticEvents() {
  $("#enter-product").addEventListener("click", () => setEntered());
  $("#preview-today").addEventListener("click", () => setEntered());
  $("#intro-motion-toggle").addEventListener("click", (event) => {
    const reduced = document.body.classList.toggle("reduce-motion");
    event.currentTarget.setAttribute("aria-pressed", String(reduced));
    event.currentTarget.textContent = reduced ? "Use full motion" : "Reduce motion";
  });

  $$('[data-nav]').forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(button.dataset.nav);
  }));

  $("#mobile-menu").addEventListener("click", (event) => {
    setMobileNavigation(!$("#left-rail").classList.contains("open"), { restoreFocus: true });
  });
  $("#nav-backdrop").addEventListener("click", () => setMobileNavigation(false, { restoreFocus: true }));

  $("#instant-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startCountdown(`${data.get("specialty")} · ${data.get("pressure")} pressure · ${data.get("length")} min`);
  });
  $$('[data-action="start-assigned"]').forEach((button) => button.addEventListener("click", () => startCountdown()));

  $("#open-source-chooser").addEventListener("click", openSourceChooser);
  $$('[data-open-source]').forEach((button) => button.addEventListener("click", openSourceChooser));
  $("#clear-source").addEventListener("click", () => {
    $("#source-status").hidden = true;
    toast("Profile source cleared from the plan.");
  });
  $("#question-search").addEventListener("input", renderQuestions);
  $("#filter-toggle").addEventListener("click", (event) => {
    const drawer = $("#filter-drawer");
    if (phoneShell.matches) {
      const open = !document.body.classList.contains("question-filter-open");
      drawer.hidden = false;
      setMobileSheet({ className: "question-filter-open", panel: "#filter-drawer", backdrop: "#question-filter-backdrop", trigger: "#filter-toggle", open, focusTarget: "#filter-done" });
      return;
    }
    const open = drawer.hidden;
    drawer.hidden = !open;
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  $("#filter-done").addEventListener("click", () => setMobileSheet({ className: "question-filter-open", panel: "#filter-drawer", backdrop: "#question-filter-backdrop", trigger: "#filter-toggle", open: false }));
  $("#question-filter-backdrop").addEventListener("click", () => setMobileSheet({ className: "question-filter-open", panel: "#filter-drawer", backdrop: "#question-filter-backdrop", trigger: "#filter-toggle", open: false }));
  $("#clear-filters").addEventListener("click", () => {
    state.filters.clear();
    $("#filter-count").textContent = "0";
    renderCategoryFilters();
    renderQuestions();
  });
  $("#surprise-build").addEventListener("click", surprisePlan);
  $$('[data-builder-tab]').forEach((button) => button.addEventListener("click", () => setMobileBuilderPane(button.dataset.builderTab)));
  $("#review-interview").addEventListener("click", () => {
    if (!state.plan.length) return toast("Add at least one question first.");
    startCountdown(`${$("#plan-interviewer").value} · ${state.plan.length} planned questions`);
  });

  $("#question-list").addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-to-plan]");
    const view = event.target.closest("[data-view-question]");
    if (add) addToPlan(add.dataset.addToPlan);
    if (view) openQuestionWorkspace(view.dataset.viewQuestion);
  });
  $("#question-list").addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-question-id]");
    if (!card) return;
    state.draggedQuestion = card.dataset.questionId;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", state.draggedQuestion);
  });
  $("[data-drop-zone='plan']").addEventListener("dragover", (event) => {
    event.preventDefault();
    event.currentTarget.classList.add("drop-active");
  });
  $("[data-drop-zone='plan']").addEventListener("dragleave", (event) => event.currentTarget.classList.remove("drop-active"));
  $("[data-drop-zone='plan']").addEventListener("drop", (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove("drop-active");
    addToPlan(event.dataTransfer.getData("text/plain") || state.draggedQuestion);
    state.draggedQuestion = null;
  });
  $("[data-drop-zone='library']").addEventListener("dragover", (event) => event.preventDefault());
  $("[data-drop-zone='library']").addEventListener("drop", (event) => {
    event.preventDefault();
    removeFromPlan(event.dataTransfer.getData("text/plain"));
  });
  $("#plan-list").addEventListener("dragstart", (event) => {
    const item = event.target.closest("[data-plan-item]");
    if (!item) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.dataset.planItem);
  });
  $("#plan-list").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-plan]");
    const move = event.target.closest("[data-move-plan]");
    if (remove) removeFromPlan(remove.dataset.removePlan);
    if (move) movePlanItem(move.dataset.id, move.dataset.movePlan === "up" ? -1 : 1);
  });

  $("#countdown-skip").addEventListener("click", finishCountdown);
  $("#countdown-cancel").addEventListener("click", cancelCountdown);
  $("#countdown-overlay").addEventListener("cancel", (event) => {
    event.preventDefault();
    cancelCountdown();
  });
  $("#countdown-sound").addEventListener("click", (event) => {
    state.countdownSound = !state.countdownSound;
    event.currentTarget.setAttribute("aria-pressed", String(state.countdownSound));
    event.currentTarget.textContent = state.countdownSound ? "♪ Sound on" : "♪ Sound off";
  });

  $("#room-start").addEventListener("click", () => { void startProductionRoom(); });
  $("#founder-acquire-lease").addEventListener("click", () => { void acquireFounderProofLease(); });
  $("#founder-authorize-test").addEventListener("click", () => { void authorizeFounderProof(); });
  $("#room-swap").addEventListener("click", () => {
    state.roomLayoutSwapped = !state.roomLayoutSwapped;
    $('.room-stage').classList.toggle('layout-swapped', state.roomLayoutSwapped);
    $('#room-swap').setAttribute('aria-pressed', String(state.roomLayoutSwapped));
    $('#room-swap').innerHTML = state.roomLayoutSwapped ? '<span>⇄</span>Student primary' : '<span>⇄</span>Swap layout';
  });
  $("#room-mute").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const targetMuted = !state.roomMuted;
    button.disabled = true;
    try {
      const participant = state.founderProofRoom?.localParticipant;
      if (participant) {
        await participant.setMicrophoneEnabled(!targetMuted);
        if (participant.isMicrophoneEnabled !== !targetMuted) {
          throw new Error('LiveKit microphone state could not be confirmed.');
        }
      }
      state.roomMuted = targetMuted;
      button.classList.toggle("active", state.roomMuted);
      button.setAttribute('aria-pressed', String(state.roomMuted));
      button.innerHTML = `<span>♩</span>${state.roomMuted ? "Unmute" : "Mute"}`;
      $("#room-status").textContent = state.roomMuted ? "Microphone muted." : "Microphone live.";
    } catch {
      await stopProductionRoom({
        results: false,
        terminalMessage: 'Microphone control failed closed; provider cleanup was requested.',
      });
    } finally {
      button.disabled = false;
    }
  });
  $("#room-type").setAttribute("aria-expanded", "false");
  $("#room-type").setAttribute("aria-controls", "typed-room-answer");
  $("#room-type").addEventListener("click", () => setRoomComposer($("#typed-room-answer").hidden));
  $("#room-type-close").addEventListener("click", () => setRoomComposer(false, { restoreFocus: true }));
  $("#send-room-answer").addEventListener("click", () => {
    const answer = $("#room-answer").value.trim();
    if (!answer) return toast("Type an answer first.");
    $("#room-answer").value = "";
    $("#room-status").textContent = "Prototype answer captured locally. Use the live alpha room for a contextual follow-up.";
    setRoomComposer(false, { restoreFocus: true });
    toast("Prototype answer captured; no provider call was made.");
  });
  $("#room-interrupt").addEventListener("click", () => {
    $("#room-status").textContent = "Prototype interruption state shown. The accepted 3410 rail owns real barge-in.";
    toast("Open the live alpha room to test full-duplex interruption.");
  });
  $("#room-end").addEventListener("click", requestEndInterview);

  $("#toggle-analysis").addEventListener("click", (event) => {
    const drawer = $("#analysis-drawer");
    const open = drawer.hidden;
    drawer.hidden = !open;
    event.currentTarget.setAttribute("aria-expanded", String(open));
    event.currentTarget.textContent = open ? "Close analysis ↑" : "Full analysis ↓";
  });
  $$('[data-moment]').forEach((button) => button.addEventListener("click", () => openMoment(button.dataset.moment)));

  $("#vault-search").addEventListener("input", renderVault);
  $("#vault-date").addEventListener("change", renderVault);
  $$('[data-vault-mode]').forEach((button) => button.addEventListener("click", () => {
    state.vaultMode = button.dataset.vaultMode;
    $$('[data-vault-mode]').forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderVault();
  }));
  $("#mobile-vault-filter").addEventListener("click", () => setMobileSheet({ className: "vault-filter-open", panel: "#vault-filters", backdrop: "#vault-filter-backdrop", trigger: "#mobile-vault-filter", open: !document.body.classList.contains("vault-filter-open"), focusTarget: "#vault-filter-done" }));
  $("#vault-filter-done").addEventListener("click", () => setMobileSheet({ className: "vault-filter-open", panel: "#vault-filters", backdrop: "#vault-filter-backdrop", trigger: "#mobile-vault-filter", open: false }));
  $("#vault-filter-backdrop").addEventListener("click", () => setMobileSheet({ className: "vault-filter-open", panel: "#vault-filters", backdrop: "#vault-filter-backdrop", trigger: "#mobile-vault-filter", open: false }));
  $("#vault-list").addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-session]");
    const moment = event.target.closest("[data-transcript-session]");
    if (open) openSession(open.dataset.openSession);
    if (moment) openSession(moment.dataset.transcriptSession, moment.dataset.transcriptTime);
  });
  $("#transcript-hits").addEventListener("click", (event) => {
    const moment = event.target.closest("[data-transcript-session]");
    if (moment) openSession(moment.dataset.transcriptSession, moment.dataset.transcriptTime);
  });

  $("#request-review").addEventListener("click", () => {
    $("#request-state").textContent = "Prototype request prepared. Nothing was sent to a mentor.";
    toast("Review request staged locally—no external message was sent.");
  });
  $("#play-mentor-feedback").addEventListener("click", (event) => {
    const playing = event.currentTarget.dataset.playing === "true";
    event.currentTarget.dataset.playing = String(!playing);
    event.currentTarget.textContent = playing ? "▶ PLAY 0:28" : "Ⅱ PAUSE PROTOTYPE";
  });
  $$('[data-add-question]').forEach((button) => button.addEventListener("click", () => {
    addToPlan(button.dataset.addQuestion);
    navigate("custom");
  }));
  $("#practice-program").addEventListener("click", () => {
    state.plan = ["why-program", "tell-me-about-yourself", "clinical-judgment", "questions-for-us"].map(questionById);
    renderPlan();
    startCountdown("Dr. Naomi Chen · Riverside University · Program-specific practice");
  });

  $$('[data-debrief-mode]').forEach((button) => button.addEventListener("click", () => {
    $$('[data-debrief-mode]').forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    const talk = button.dataset.debriefMode === "talk";
    $("#debrief-answer").hidden = talk;
    $("#send-debrief").hidden = talk;
    $("#talk-disabled").hidden = !talk;
  }));
  $("#mobile-debrief-review").addEventListener("click", () => setMobileSheet({ className: "debrief-review-open", panel: "#debrief-record-panel", backdrop: "#debrief-review-backdrop", trigger: "#mobile-debrief-review", open: !document.body.classList.contains("debrief-review-open"), focusTarget: "#debrief-review-done" }));
  $("#debrief-review-done").addEventListener("click", () => setMobileSheet({ className: "debrief-review-open", panel: "#debrief-record-panel", backdrop: "#debrief-review-backdrop", trigger: "#mobile-debrief-review", open: false }));
  $("#debrief-review-backdrop").addEventListener("click", () => setMobileSheet({ className: "debrief-review-open", panel: "#debrief-record-panel", backdrop: "#debrief-review-backdrop", trigger: "#mobile-debrief-review", open: false }));
  $("#send-debrief").addEventListener("click", appendDebrief);
  $("#finish-debrief").addEventListener("click", () => {
    toast("Debrief organized locally. No account record was changed.");
    $("#debrief-progress").textContent = "Prototype debrief organized";
  });
  $("#open-playbook").addEventListener("click", openPlaybook);

  $("#modal-close").addEventListener("click", closeWorkspace);
  $("#modal-backdrop").addEventListener("click", closeWorkspace);
  $("#workspace-modal").addEventListener("cancel", (event) => {
    event.preventDefault();
    closeWorkspace();
  });
  $("#modal-content").addEventListener("click", (event) => {
    const add = event.target.closest("[data-modal-add]");
    const practice = event.target.closest("[data-modal-practice]");
    const source = event.target.closest("[data-source-choice]");
    const seek = event.target.closest("[data-session-seek]");
    if (add) {
      addToPlan(add.dataset.modalAdd);
      closeWorkspace();
    }
    if (practice) {
      state.plan = [questionById(practice.dataset.modalPractice)];
      renderPlan();
      closeWorkspace();
      startCountdown(`Focused practice · ${state.plan[0].category} · 1 question`);
    }
    if (source?.dataset.sourceChoice === "profile") buildProfilePlan();
    if (source?.dataset.sourceChoice === "program") {
      state.plan = ["why-program", "questions-for-us", "clinical-judgment"].map(questionById);
      renderPlan();
      $("#source-status").hidden = false;
      closeWorkspace();
      toast("Program-specific questions added.");
    }
    if (source?.dataset.sourceChoice === "blank") {
      state.plan = [];
      renderPlan();
      closeWorkspace();
      toast("Blank interview ready.");
    }
    if (seek) {
      $$(".workspace-transcript li").forEach((item) => item.classList.toggle("active", $("button", item)?.dataset.sessionSeek === seek.dataset.sessionSeek));
      $(".session-player strong").textContent = `Prototype replay at ${seek.dataset.sessionSeek}`;
    }
  });

  $("#playbook-close").addEventListener("click", closePlaybook);
  $("#playbook-modal").addEventListener("cancel", (event) => {
    event.preventDefault();
    closePlaybook();
  });
  $("#add-playbook-topic").addEventListener("click", () => {
    state.playbook.push({ id: `custom-${Date.now()}`, name: "New debrief topic", prompt: "What should the debrief ask next?", enabled: true });
    renderPlaybook();
    $$("#playbook-list input").at(-1)?.focus();
  });
  $("#publish-playbook").addEventListener("click", () => {
    state.playbookVersion += 1;
    $("#playbook-version").textContent = String(state.playbookVersion);
    toast(`Prototype playbook version ${state.playbookVersion} saved in memory only.`);
  });
  $("#playbook-list").addEventListener("input", (event) => {
    const id = event.target.dataset.topicName || event.target.dataset.topicPrompt || event.target.dataset.topicEnabled;
    const topic = state.playbook.find((item) => item.id === id);
    if (!topic) return;
    if (event.target.dataset.topicName) topic.name = event.target.value;
    if (event.target.dataset.topicPrompt) topic.prompt = event.target.value;
    if (event.target.dataset.topicEnabled) topic.enabled = event.target.checked;
  });
  $("#playbook-list").addEventListener("change", (event) => {
    if (!event.target.dataset.topicEnabled) return;
    const label = event.target.closest("label");
    $("b", label).textContent = event.target.checked ? "Active" : "Off";
    event.target.setAttribute("aria-label", `${event.target.checked ? "Disable" : "Enable"} ${state.playbook.find((item) => item.id === event.target.dataset.topicEnabled)?.name || "topic"}`);
  });
  $("#playbook-list").addEventListener("click", (event) => {
    const move = event.target.closest("[data-topic-move]");
    if (move) movePlaybook(move.dataset.id, move.dataset.topicMove === "up" ? -1 : 1);
  });

  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1);
    if (state.entered && viewMeta[view]) navigate(view, { updateHash: false });
  });
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!$("#typed-room-answer").hidden) return setRoomComposer(false, { restoreFocus: true });
    if (document.body.classList.contains("mobile-sheet-open")) return closeMobileSheets({ restoreFocus: true });
    if ($("#left-rail").classList.contains("open")) return setMobileNavigation(false, { restoreFocus: true });
    if ($("#room-end").classList.contains("confirming")) resetEndConfirmation();
  });
  mobileShell.addEventListener("change", syncResponsiveState);
  window.addEventListener("beforeunload", () => {
    window.clearInterval(state.roomTimer);
    window.clearInterval(state.countdownTimer);
    window.clearInterval(state.founderProofStatusTimer);
    window.clearTimeout(state.endConfirmTimer);
    if (state.currentInterview?.id) void endInterview(state.currentInterview.id);
  });
}

function bindUserIdentity(admission) {
  const name = admission?.subject?.displayName || admission?.subject?.name || "Student";
  const initials = name.split(/\s+/).map((w) => w[0] || "").join("").toUpperCase().slice(0, 2) || "S";
  const role = admission?.subject?.role || "STUDENT";
  const avatarBtn = $(".avatar-button");
  if (avatarBtn) avatarBtn.textContent = initials;
  const profileMark = $(".profile-mark");
  if (profileMark) profileMark.textContent = initials;
  const profileName = $(".rail-profile strong");
  if (profileName) profileName.textContent = name;
  const profileRole = $(".rail-profile span");
  if (profileRole) profileRole.textContent = role;
  const introEyebrow = $(".intro-content .eyebrow.gold");
  if (introEyebrow) introEyebrow.textContent = `${name.toUpperCase()}'S PRIVATE INTERVIEW COACH`;
}

async function initialize() {
  try {
    state.admission = await loadIvPrepSession();
    state.vaultSessions = await loadVault();
  } catch {
    state.admission = null;
    state.vaultSessions = [];
  }
  $$('[data-view-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== "home";
  });
  bindUserIdentity(state.admission);
  renderCategoryFilters();
  renderQuestions();
  renderPlan();
  renderVault();
  bindStaticEvents();
  if (!state.admission?.admitted) {
    $("#room-start").disabled = true;
    $("#room-status").textContent = "Secure IV Prep admission is unavailable.";
  }
  const founderProof = state.admission?.founderPaidTest;
  const hosted = state.admission?.runtime?.mode === 'hosted';
  const hostedReady = hosted && state.admission.runtime.workerRegistrationState === 'READY';
  const providerCreationEnabled = hosted && state.admission.runtime.paidProviderCreationEnabled === true;
  const runtimeNode = $('#hosted-runtime-state');
  if (runtimeNode) {
    runtimeNode.hidden = !hosted;
    runtimeNode.innerHTML = `<i class="proof-dot${hostedReady ? ' live' : ''}"></i> Hosted worker ${hostedReady ? 'ready' : 'unavailable'} · provider ${providerCreationEnabled ? 'armed' : 'off'}`;
  }
  $('#delivery-intelligence-nav').hidden = !hosted;
  applyRealIdentity();
  await initializeDeliveryIntelligence();
  await mountDeliveryIntelligenceGroups();
  if (hosted && founderProof?.enabled !== true) {
    $('#room-start').disabled = true;
    $('#room-status').textContent = 'Hosted foundation ready. Dr Kelly physical testing remains Founder-gated and provider creation is off.';
  }
  renderFounderProofContract(founderProof);
  if (founderProof?.enabled === true) {
    if (hosted) {
      state.t1Lease = Object.freeze({
        state: hostedReady ? 'READY' : 'LOST',
        heartbeatCount: hostedReady ? 1 : 0,
        stableSeconds: hostedReady ? 30 : 0,
        workerRegistrationState: hostedReady ? 'READY' : 'UNAVAILABLE',
      });
      renderT1LeaseState();
    } else {
      await refreshT1LeaseState();
      window.clearInterval(state.t1LeaseStatusTimer);
      state.t1LeaseStatusTimer = window.setInterval(() => { void refreshT1LeaseState(); }, 1_000);
    }
  }
  setMobileBuilderPane("questions");
  syncResponsiveState();

  const requestedView = location.hash.slice(1);
  if (viewMeta[requestedView]) setEntered({ view: requestedView, focus: false });
  else $("#enter-product").focus();
}

void initialize();
