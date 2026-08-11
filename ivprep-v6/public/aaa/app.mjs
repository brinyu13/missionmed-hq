import {
  DEBRIEF_FOLLOWUPS,
  PLAYBOOK_TOPICS,
  QUESTIONS,
  QUESTION_CATEGORIES
} from "./fixtures.mjs";
import { endInterview, loadIvPrepSession, loadVault, startInterview } from "./api-client.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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
  vaultSessions: []
};

const mobileShell = window.matchMedia("(max-width: 920px)");
const phoneShell = window.matchMedia("(max-width: 680px)");

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
  program: ["PROGRAM INTEL", "Prepare for the place, not a generic interview"]
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
  article.innerHTML = `
    <div class="drag-handle" aria-hidden="true">⠿</div>
    <div class="question-copy">
      <span>${question.category}${question.profile ? " · PROFILE MATCH" : ""}</span>
      <h3>${question.prompt}</h3>
      <p>${question.why}</p>
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
  state.plan = QUESTIONS.filter((question) => question.profile).slice(0, 5);
  $("#source-status").hidden = false;
  renderPlan();
  closeWorkspace();
  toast("A five-question draft was built from the synthetic profile.");
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
      <p class="truth-note">Question workspace prototype · no application data is fetched or persisted.</p>
    </div>`);
}

function openSourceChooser() {
  openWorkspace(`
    <div class="source-chooser">
      <p class="eyebrow gold">BUILD FROM WHAT MISSIONMED KNOWS</p>
      <h2 id="modal-title">Choose a preparation source.</h2>
      <p class="workspace-lede">Prototype fixtures demonstrate the workflow. No live Matrix, File Vault, Timeline, or StoryForge data is read here.</p>
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

function startCountdown(prompt = "Dr. Marcus Hale · Internal Medicine · Realistic pressure") {
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

async function startProductionRoom() {
  if (state.roomStarted) return;
  $("#room-start").disabled = true;
  $("#room-status").textContent = "Opening the secure voice-only interview…";
  try {
    const idempotencyKey = `room-${Date.now()}-${crypto.randomUUID()}`;
    const started = await startInterview({ mode: "voice-only", idempotencyKey });
    state.currentInterview = started.interview;
  } catch (error) {
    $("#room-start").disabled = false;
    $("#room-status").textContent = error.code === "ivprep_unavailable" ? "Interview starts are temporarily disabled." : "Secure admission could not be confirmed.";
    toast("Interview start failed closed; no provider session was created.");
    return;
  }
  state.roomStarted = true;
  state.roomSeconds = 0;
  document.body.dataset.roomState = "active";
  $("#room-start").innerHTML = "<span>●</span> Interview active";
  $("#room-status").textContent = "Secure voice-only interview active. Video remains off.";
  state.roomTimer = window.setInterval(() => {
    state.roomSeconds += 1;
    $("#room-time").textContent = formatTime(state.roomSeconds);
  }, 1000);
}

async function stopProductionRoom({ results = true } = {}) {
  window.clearInterval(state.roomTimer);
  state.roomTimer = null;
  const interview = state.currentInterview;
  if (interview?.id) {
    try { await endInterview(interview.id); }
    catch {
      $("#room-status").textContent = "Interview ended locally; server cleanup is unresolved.";
      toast("Cleanup is unresolved. New video starts remain disabled.");
    }
  }
  state.currentInterview = null;
  state.roomStarted = false;
  document.body.dataset.roomState = "ready";
  setRoomComposer(false);
  resetEndConfirmation();
  $("#room-start").disabled = false;
  $("#room-start").innerHTML = "<span>●</span> Start interview";
  $("#room-status").textContent = "Ready when you are.";
  if (results) navigate("results");
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
      <p class="truth-note">Synthetic transcript fixture · replay appears only as a UX state, not as a claim that media exists.</p>
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
    startCountdown(`Dr. Marcus Hale · ${data.get("specialty")} · ${data.get("pressure")} pressure · ${data.get("length")} min`);
  });
  $$('[data-action="start-assigned"]').forEach((button) => button.addEventListener("click", () => startCountdown()));

  $("#open-source-chooser").addEventListener("click", openSourceChooser);
  $$('[data-open-source]').forEach((button) => button.addEventListener("click", openSourceChooser));
  $("#clear-source").addEventListener("click", () => {
    $("#source-status").hidden = true;
    toast("Profile source cleared from the prototype plan.");
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
  $("#room-mute").addEventListener("click", (event) => {
    state.roomMuted = !state.roomMuted;
    event.currentTarget.classList.toggle("active", state.roomMuted);
    event.currentTarget.innerHTML = `<span>♩</span>${state.roomMuted ? "Unmute" : "Mute"}`;
    $("#room-status").textContent = state.roomMuted ? "Microphone muted in this prototype room." : "Prototype microphone state restored.";
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
      toast("Program-specific prototype questions added.");
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
    window.clearTimeout(state.endConfirmTimer);
    if (state.currentInterview?.id) void endInterview(state.currentInterview.id);
  });
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
  renderCategoryFilters();
  renderQuestions();
  renderPlan();
  renderVault();
  bindStaticEvents();
  if (!state.admission?.admitted) {
    $("#room-start").disabled = true;
    $("#room-status").textContent = "Secure IV Prep admission is unavailable.";
  }
  setMobileBuilderPane("questions");
  syncResponsiveState();

  const requestedView = location.hash.slice(1);
  if (viewMeta[requestedView]) setEntered({ view: requestedView, focus: false });
  else $("#enter-product").focus();
}

void initialize();
