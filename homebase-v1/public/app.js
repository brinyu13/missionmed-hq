import { createAuthClient } from './auth.js';

/*
 * HomeBase V1 production adapter — HB-360A-001
 *
 * Forked from the StoryForge V5 shell at live commit 084ce55c. The StoryForge
 * presentation grammar (rail, header, panels, drawers, chips, empty states)
 * is the interaction authority. HomeBase keeps browser state small: identity
 * and durable data come from the signed HomeBase API; only navigation,
 * filters, and open-surface state live here.
 */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const rail = $('#rail');
const hdr = $('#hdr');
const main = $('#main');
const advBanner = $('#advBanner');
const quick = $('#quick');
const toastNode = $('#toast');
const openingNode = $('#storyforgeOpening');

const FIXTURE_PERSONA_KEY = 'homebase_local_fixture_persona';
const FIXTURE_PERSONAS = new Set(['student', 'studentOther', 'studentOutsideRoster', 'admin']);

const STATUS_META = Object.freeze({
  not_started: { label: 'Not Started', cls: 'hb-not_started', hint: 'This step has not begun yet.' },
  waiting_on_student: { label: 'Waiting on Student', cls: 'hb-waiting_on_student', hint: 'The ball is with the student for this step.' },
  submitted: { label: 'Submitted', cls: 'hb-submitted', hint: 'Submitted and waiting to be picked up.' },
  in_review: { label: 'In Review', cls: 'hb-in_review', hint: 'Dr B is actively working on this.' },
  waiting_on_drb: { label: 'Waiting on Dr B', cls: 'hb-waiting_on_drb', hint: 'The ball is with Dr B for this step.' },
  revision_needed: { label: 'Revision Needed', cls: 'hb-revision_needed', hint: 'Changes were requested — check the note.' },
  approved: { label: 'Approved', cls: 'hb-approved', hint: 'Approved by Dr B.' },
  completed: { label: 'Completed', cls: 'hb-completed', hint: 'Done.' },
  not_applicable: { label: 'Not Applicable', cls: 'hb-not_applicable', hint: 'Does not apply to this student.' },
});
const STATUS_ORDER = Object.freeze(Object.keys(STATUS_META));

const NAV = Object.freeze({
  student: [
    ['home', 'Home', '⌂'],
    ['progress', 'My Progress', '◎'],
    ['tasks', 'Tasks', '◫'],
    ['priorities', 'Priorities & Alerts', '⚑'],
    ['calendar', 'Calendar', '▤'],
    ['files', 'Files', '▣'],
  ],
  admin: [
    ['home', 'Command Center', '⌂'],
    ['roster', 'Session Roster', '◎'],
    ['checklist', 'Checklist Manager', '☑'],
    ['tasks', 'Tasks', '◫'],
    ['priorities', 'Priorities & Alerts', '⚑'],
    ['activity', 'Activity', '↗'],
  ],
});

const state = {
  config: null,
  user: null,
  capabilities: Object.freeze({}),
  enrollment: null,
  activeRole: null,
  lockout: null,
  route: 'home',
  routeId: null,
  home: null,
  progress: null,
  tasks: [],
  alerts: { priorities: [], alerts: [] },
  activity: [],
  files: [],
  calendar: { events: [], error: '', loaded: false },
  admin: {
    home: null,
    roster: [],
    rosterQuery: '',
    rosterFilter: '',
    includeHidden: false,
    student: null,
    checklist: null,
    tasks: [],
    alerts: [],
    activity: [],
  },
  subject: null,
  psStages: [],
  quickSurface: null,
  busy: false,
  returnFocus: null,
};

const auth = createAuthClient({
  onLockout(lockoutState, message) {
    state.user = null;
    state.lockout = lockoutState || 'access_unavailable';
    renderLockout(state.lockout, message);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function attr(value) {
  return esc(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDate(value) {
  if (!value) return '';
  const raw = String(value).slice(0, 10);
  const date = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ago(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(value);
}

function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${String(value).slice(0, 10)}T12:00:00Z`).getTime();
  if (Number.isNaN(target)) return null;
  return Math.round((target - Date.now()) / 86400000);
}

function deadlineChip(value) {
  const days = daysUntil(value);
  if (days === null) return '';
  if (days < 0) return `<span class="hbChip hb-revision_needed">Overdue · ${formatDate(value)}</span>`;
  if (days <= 7) return `<span class="hbChip hb-waiting_on_student">Due ${days === 0 ? 'today' : `in ${days}d`} · ${formatDate(value)}</span>`;
  return `<span class="hbChip hb-not_started">Due ${formatDate(value)}</span>`;
}

function statusChip(status) {
  const meta = STATUS_META[status] || STATUS_META.not_started;
  return `<span class="hbChip ${meta.cls}" title="${attr(meta.hint)}">${esc(meta.label)}</span>`;
}

function ballChip(owner, { big = false } = {}) {
  if (owner === 'drb') {
    return `<span class="hbBall drb ${big ? 'big' : ''}">🏀 Dr B has the ball</span>`;
  }
  if (owner === 'student') {
    return `<span class="hbBall student ${big ? 'big' : ''}">🏀 You have the ball</span>`;
  }
  return `<span class="hbBall none ${big ? 'big' : ''}">—</span>`;
}

function adminBallChip(owner) {
  if (owner === 'drb') return '<span class="hbBall drb">Waiting on Dr B</span>';
  if (owner === 'student') return '<span class="hbBall student">Waiting on Student</span>';
  return '<span class="hbBall none">Unassigned</span>';
}

function initialsFor(value) {
  return String(value || '?').split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function studentAvatarMarkup(student, { className = 'hbAvatar' } = {}) {
  const name = student?.name || `${student?.firstName || ''} ${student?.lastName || ''}`.trim();
  if (student?.photoUrl) {
    return `<img class="${className}" src="${attr(student.photoUrl)}" alt="${attr(name)}">`;
  }
  return `<span class="${className} hbAvatarInitials" aria-hidden="true">${esc(initialsFor(name))}</span>`;
}

function psStageMeta(stage) {
  return state.psStages[Number(stage)] || state.psStages[0] || { stage: 0, student: 'Getting Started', admin: 'No info from student' };
}

function psTimelineMarkup(stage, { adminLabels = false } = {}) {
  const current = Number(stage) || 0;
  return `<div class="hbStageTrack" role="img" aria-label="Personal statement stage ${current} of 7">
    ${state.psStages.map((meta) => `
      <div class="hbStageStep ${meta.stage < current ? 'done' : ''} ${meta.stage === current ? 'now' : ''}">
        <span class="hbStageDot">${meta.stage < current ? '✓' : meta.stage}</span>
        <span class="hbStageLbl">${esc(adminLabels ? meta.admin : meta.student)}</span>
      </div>`).join('')}
  </div>`;
}

function categoryProgress(category) {
  const items = asArray(category.items).filter((item) => item.status !== 'not_applicable');
  const done = items.filter((item) => ['completed', 'approved'].includes(item.status)).length;
  return { done, total: items.length };
}

function notify(message, kind = '') {
  toastNode.innerHTML = `<div class="toastCard ${kind}">${esc(message)}</div>`;
  toastNode.classList.add('show');
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => toastNode.classList.remove('show'), 4200);
}

async function withBusy(task, message = '') {
  if (state.busy) return;
  state.busy = true;
  try {
    await task();
  } catch (error) {
    notify(error.message || 'Something went wrong.', 'error');
  } finally {
    state.busy = false;
  }
}

function jsonOptions(method, body) {
  return {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function loadingView(message) {
  return `<section class="hbLoading" role="status"><span class="hbLoadingPulse"></span>${esc(message)}</section>`;
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------
const api = Object.freeze({
  config: () => auth.publicRequest('api/config'),
  fixture: (persona) => auth.request(`/api/dev/session/${persona}`, jsonOptions('POST', {})),
  session: () => auth.request('/api/session'),
  home: () => auth.request('/api/home'),
  progress: () => auth.request('/api/progress'),
  tasks: () => auth.request('/api/tasks'),
  submitTask: (assignmentId, comment) => auth.request(`/api/tasks/${assignmentId}/submit`, jsonOptions('POST', { comment })),
  commentTask: (assignmentId, comment) => auth.request(`/api/tasks/${assignmentId}/comment`, jsonOptions('POST', { comment })),
  alerts: () => auth.request('/api/alerts'),
  dismissAlert: (id) => auth.request(`/api/alerts/${id}/dismiss`, jsonOptions('POST', {})),
  activity: () => auth.request('/api/activity'),
  files: () => auth.request('/api/files'),
  adminHome: () => auth.request('/api/admin/home'),
  adminRoster: (query = '') => auth.request(`/api/admin/roster${query ? `?${query}` : ''}`),
  adminAddStudent: (body) => auth.request('/api/admin/roster', jsonOptions('POST', body)),
  adminStudent: (id) => auth.request(`/api/admin/students/${id}`),
  adminPatchStudent: (id, body) => auth.request(`/api/admin/students/${id}`, jsonOptions('PATCH', body)),
  adminSubjectHome: (id) => auth.request(`/api/admin/subjects/${id}/home`),
  adminChecklist: () => auth.request('/api/admin/checklist'),
  adminCreateCategory: (body) => auth.request('/api/admin/checklist/categories', jsonOptions('POST', body)),
  adminPatchCategory: (id, body) => auth.request(`/api/admin/checklist/categories/${id}`, jsonOptions('PATCH', body)),
  adminDeleteCategory: (id) => auth.request(`/api/admin/checklist/categories/${id}`, jsonOptions('DELETE', { confirm: true })),
  adminCreateItem: (body) => auth.request('/api/admin/checklist/items', jsonOptions('POST', body)),
  adminPatchItem: (id, body) => auth.request(`/api/admin/checklist/items/${id}`, jsonOptions('PATCH', body)),
  adminDeleteItem: (id) => auth.request(`/api/admin/checklist/items/${id}`, jsonOptions('DELETE', { confirm: true })),
  adminSetItemState: (body) => auth.request('/api/admin/item-states', jsonOptions('POST', body)),
  adminTasks: () => auth.request('/api/admin/tasks'),
  adminCreateTask: (body) => auth.request('/api/admin/tasks', jsonOptions('POST', body)),
  adminAssignmentStatus: (id, body) => auth.request(`/api/admin/task-assignments/${id}/status`, jsonOptions('POST', body)),
  adminAlerts: () => auth.request('/api/admin/alerts'),
  adminCreateAlert: (body) => auth.request('/api/admin/alerts', jsonOptions('POST', body)),
  adminPatchAlert: (id, body) => auth.request(`/api/admin/alerts/${id}`, jsonOptions('PATCH', body)),
  adminActivity: (query = '') => auth.request(`/api/admin/activity${query ? `?${query}` : ''}`),
  adminAddFile: (body) => auth.request('/api/admin/files', jsonOptions('POST', body)),
});

// ---------------------------------------------------------------------------
// Role helpers + shell
// ---------------------------------------------------------------------------
function isAdmin() {
  return state.user?.role === 'admin';
}

function adminLens() {
  return isAdmin() && state.activeRole === 'admin' && !state.subject;
}

function subjectContext() {
  return Boolean(state.subject);
}

function viewLabel() {
  if (subjectContext()) return 'Student Preview';
  return adminLens() ? 'Administrator View' : 'Student View';
}

function roleSwitchMarkup() {
  if (!isAdmin()) return '';
  return `<div class="roleSwitch hbRoleSwitch" role="group" aria-label="View switch">
    <button type="button" class="${adminLens() ? 'on' : ''}" data-set-view="admin">Administrator View</button>
    <button type="button" class="${!adminLens() || subjectContext() ? 'on' : ''}" data-set-view="student">Student View</button>
  </div>`;
}

function matrixHref() {
  return state.config?.matrixBaseUrl || '/member-dashboard/';
}

function firstName() {
  return state.user?.first_name || String(state.user?.display_name || '').split(/\s+/)[0] || 'there';
}

function navFor() {
  if (subjectContext()) {
    return [
      ['home', 'Home', '⌂'],
      ['progress', 'My Progress', '◎'],
      ['tasks', 'Tasks', '◫'],
    ];
  }
  return adminLens() ? NAV.admin : NAV.student;
}

function railNavButton([route, label, icon]) {
  return `<button type="button" class="rtab ${state.route === route ? 'on' : ''}" data-nav="${attr(route)}" aria-current="${state.route === route ? 'page' : 'false'}">
    <span class="ric" aria-hidden="true">${icon}</span><span>${esc(label)}</span>
  </button>`;
}

function renderShell() {
  if (!state.user) return;
  document.body.dataset.role = adminLens() ? 'admin' : 'student';
  rail.innerHTML = `
    <div class="logo" aria-label="HomeBase">Home<b>Base</b></div><div class="logoSub">MissionMed</div>
    ${navFor().map(railNavButton).join('')}
    <div class="railFoot">
      <a class="rtab matrixAnchor" href="${attr(matrixHref())}">↩ Back to Matrix</a>
      ${subjectContext() ? '<button class="rowBtn" type="button" data-exit-subject>Exit student preview</button>' : roleSwitchMarkup()}
      <div class="signedIdentity"><span>${esc(state.user.display_name)}</span></div>
      ${state.config?.devAuth ? '<button class="rowBtn fixtureChange" type="button" data-change-fixture>Change fixture identity</button>' : ''}
    </div>`;

  hdr.innerHTML = `
    <a class="storyforgeMatrixBack" href="${attr(matrixHref())}" aria-label="Back to Matrix">
      <span aria-hidden="true">←</span><span>Matrix</span>
    </a>
    <div class="storyforgeBrand" aria-label="MissionMed HomeBase">
      <div class="storyforgeBrandTitle"><span>MissionMed</span><b>//HomeBase</b></div>
      <div class="storyforgeBrandSub">360 MATCH MENTORSHIP · SESSION A</div>
    </div>
    <div class="storyforgeHeaderActions">
      ${state.config?.betaBadge ? '<span class="hbBetaTag">BETA — ACTIVE DEVELOPMENT</span>' : ''}
      <span class="viewChip roleReadOnly" title="This view comes from your signed MissionMed role">${viewLabel()}</span>
      ${subjectContext() ? `<div class="hbSubjectChip" role="status">${studentAvatarMarkup(state.subject, { className: 'hbAvatar sm' })}<span>PREVIEWING</span><b>${esc(state.subject.name)}</b></div>` : ''}
    </div>`;

  advBanner.classList.toggle('show', subjectContext());
  advBanner.querySelector('span').textContent = subjectContext()
    ? `Student preview · You are seeing ${state.subject.name}'s HomeBase in a clearly labeled administrator context. Nothing here changes their account.`
    : '';
  document.body.classList.remove('is-booting');
}

function clearOverlays() {
  quick.classList.remove('open');
  quick.innerHTML = '';
  state.quickSurface = null;
}

function openDrawer(html, { label = 'HomeBase panel' } = {}) {
  quick.innerHTML = `<div class="hbDrawer" role="dialog" aria-modal="true" aria-label="${attr(label)}">
    <button class="hbDrawerClose" type="button" data-close-drawer aria-label="Close">✕</button>
    ${html}
  </div>`;
  quick.classList.add('open');
  const focusable = $('input, select, textarea, button:not([data-close-drawer])', quick);
  focusable?.focus();
}

function pushPath(route, id = null, replace = false) {
  const base = state.config?.basePath || '/';
  const suffix = route === 'home' ? '' : `${route}${id ? `/${encodeURIComponent(id)}` : ''}`;
  history[replace ? 'replaceState' : 'pushState'](null, '', `${base}${suffix}`);
}

function parseRoute() {
  const fragment = location.hash.replace(/^#/, '');
  const base = state.config?.basePath || '/';
  const relative = fragment || (location.pathname.startsWith(base) ? location.pathname.slice(base.length) : '');
  const [route, id] = relative.replace(/^\/+|\/+$/g, '').split('/');
  state.route = route || 'home';
  state.routeId = id ? decodeURIComponent(id) : null;
}

async function navigate(route, id = null, options = {}) {
  clearOverlays();
  state.route = route;
  state.routeId = id;
  pushPath(route, id, options.replace);
  await renderRoute();
  main.scrollTop = 0;
  const heading = $('h1, .h1', main);
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

// ---------------------------------------------------------------------------
// Student views
// ---------------------------------------------------------------------------
function heroStatusMarkup(payload) {
  const enrollment = payload.enrollment;
  const ps = psStageMeta(enrollment.psStage);
  return `<div class="hbStatusGrid">
    <div class="hbHud pri">
      <span class="hbHudLbl">MY CURRENT STATUS</span>
      <span class="hbHudVal">${esc(enrollment.currentStatus || ps.student)}</span>
      <span class="hbHudSub">Personal Statement · ${esc(ps.student)}</span>
    </div>
    <div class="hbHud ball">
      <span class="hbHudLbl">WHO HAS THE BALL?</span>
      <span class="hbHudVal">${ballChip(enrollment.ballOwner, { big: true })}</span>
    </div>
    <div class="hbHud">
      <span class="hbHudLbl">WHAT I NEED TO DO</span>
      <span class="hbHudVal small">${esc(enrollment.studentNextAction || 'Nothing right now — Dr B has the next move.')}</span>
    </div>
    <div class="hbHud">
      <span class="hbHudLbl">WHAT DR B IS WORKING ON</span>
      <span class="hbHudVal small">${esc(enrollment.drbNextAction || 'Watching your progress.')}</span>
    </div>
    <div class="hbHud">
      <span class="hbHudLbl">WHAT HAPPENS NEXT</span>
      <span class="hbHudVal small">${esc(enrollment.nextMilestone || 'Your next milestone will appear here.')}</span>
      ${enrollment.deadline ? `<span class="hbHudSub">${deadlineChip(enrollment.deadline)}</span>` : ''}
    </div>
  </div>`;
}

function prioritiesPanel(payload, { compact = false } = {}) {
  const priorities = asArray(payload.priorities);
  return `<div class="panel">
    <div class="pHead"><div class="h2">Top priorities <em>this week</em></div>${compact ? '<button class="pMore" type="button" data-nav="priorities">All ▸</button>' : ''}</div>
    <div class="pBody">
      ${priorities.length ? priorities.slice(0, compact ? 3 : 50).map((item) => `
        <div class="hbPriority ${item.urgency}">
          <span class="hbPriorityTitle">${esc(item.title)}</span>
          ${item.body ? `<span class="hbPriorityBody">${esc(item.body)}</span>` : ''}
        </div>`).join('') : '<div class="storyEmpty">No weekly priorities posted yet.</div>'}
    </div>
  </div>`;
}

function alertsPanel(payload, { compact = false } = {}) {
  const alerts = asArray(payload.alerts);
  return `<div class="panel">
    <div class="pHead"><div class="h2">Alerts</div>${compact ? '<button class="pMore" type="button" data-nav="priorities">All ▸</button>' : ''}</div>
    <div class="pBody">
      ${alerts.length ? alerts.slice(0, compact ? 3 : 50).map((item) => `
        <div class="hbAlert ${item.urgency}">
          <div class="hbAlertMain">
            <span class="hbPriorityTitle">${esc(item.title)}</span>
            ${item.body ? `<span class="hbPriorityBody">${esc(item.body)}</span>` : ''}
            ${item.ctaLabel && item.ctaUrl ? `<a class="rowBtn pri hbAlertCta" href="${attr(item.ctaUrl)}">${esc(item.ctaLabel)}</a>` : ''}
          </div>
          ${item.dismissible && !subjectContext() ? `<button class="rowBtn" type="button" data-dismiss-alert="${attr(item.id)}">Dismiss</button>` : ''}
        </div>`).join('') : '<div class="storyEmpty">No active alerts. You are all caught up.</div>'}
    </div>
  </div>`;
}

function progressSummaryPanel(payload) {
  const categories = asArray(payload.progress);
  return `<div class="panel">
    <div class="pHead"><div class="h2">My <em>checklist</em></div><button class="pMore" type="button" data-nav="progress">My Progress ▸</button></div>
    <div class="pBody">
      ${categories.map((category) => {
        const { done, total } = categoryProgress(category);
        return `<button class="hbCatRow" type="button" data-nav="progress">
          <span class="hbCatTitle">${esc(category.title)}</span>
          <span class="hbCatMeter"><span class="hbCatFill" style="width:${total ? Math.round((done / total) * 100) : 0}%"></span></span>
          <span class="hbCatCount">${done}/${total}</span>
        </button>`;
      }).join('') || '<div class="storyEmpty">Your checklist is being prepared.</div>'}
    </div>
  </div>`;
}

function upcomingPanel(payload) {
  const upcoming = asArray(payload.upcoming);
  return `<div class="panel">
    <div class="pHead"><div class="h2">Upcoming</div></div>
    <div class="pBody">
      ${upcoming.length ? upcoming.map((item) => `
        <div class="hbUpcoming">
          <span>${esc(item.title)}</span>${deadlineChip(item.dueDate)}
        </div>`).join('') : '<div class="storyEmpty">Nothing due soon. Deadlines will appear here.</div>'}
    </div>
  </div>`;
}

function activityPanel(payload, { compact = true } = {}) {
  const activity = asArray(payload.activity);
  return `<div class="panel">
    <div class="pHead"><div class="h2">Recent <em>updates</em></div></div>
    <div class="pBody">
      ${activity.length ? activity.slice(0, compact ? 6 : 100).map((item) => `
        <div class="advNote hbActivityRow">
          <span class="avc adv">${esc(item.actorRole === 'admin' ? 'B' : item.actorRole === 'student' ? 'S' : '⚙')}</span>
          <span><span class="who">${esc(ago(item.createdAt))}</span>
          <span class="txt">${esc(item.summary)}</span></span>
        </div>`).join('') : '<div class="storyEmpty">Updates will appear here the moment anything changes.</div>'}
    </div>
  </div>`;
}

function filesPanel(payload) {
  const files = asArray(payload.files);
  return `<div class="panel">
    <div class="pHead"><div class="h2">Quick <em>files</em></div><button class="pMore" type="button" data-nav="files">All files ▸</button></div>
    <div class="pBody">
      ${files.length ? files.map(fileRow).join('') : '<div class="storyEmpty">Files Dr B shares with you will appear here.</div>'}
    </div>
  </div>`;
}

function fileRow(file) {
  const target = file.externalUrl
    || (file.vaultDocumentUuid ? `${matrixHref()}#filevault` : '');
  return `<a class="hbFileRow" ${target ? `href="${attr(target)}"` : ''} ${file.externalUrl ? 'target="_blank" rel="noopener"' : ''}>
    <span class="hbFileIcon" aria-hidden="true">▣</span>
    <span class="hbFileMain"><span class="hbFileTitle">${esc(file.title)}</span>
    <span class="hbFileMeta">${esc(file.kind.replace(/_/g, ' '))} · ${esc(ago(file.createdAt))}</span></span>
  </a>`;
}

function renderHome() {
  const payload = state.home;
  if (!payload) {
    main.innerHTML = loadingView('Opening your HomeBase…');
    return;
  }
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const enrollment = payload.enrollment;
  const photoNudge = enrollment.photoState === 'missing' && !subjectContext()
    ? `<div class="hbPhotoNudge"><b>UPLOAD YOUR PROFILE PHOTO</b><span>Every Session A student needs a real professional headshot on file.</span><button class="rowBtn pri" type="button" data-nav="files">Add it now</button></div>`
    : '';
  main.innerHTML = `<section data-view="home" class="live">
    <div class="homeHero hbHero">
      <div class="hbHomeIdentity">${studentAvatarMarkup(enrollment, { className: 'hbAvatar lg' })}
        <div><div class="greet">${greeting}, <em>${esc(subjectContext() ? enrollment.firstName : firstName())}</em>.</div>
        <div class="greetSub">${esc(enrollment.sessionName || '360 Match Mentorship — Session A')}</div></div>
      </div>
      ${photoNudge}
      ${heroStatusMarkup(payload)}
    </div>
    <div class="homeGrid hbHomeGrid">
      <div>
        ${prioritiesPanel(payload, { compact: true })}
        ${progressSummaryPanel(payload)}
        ${tasksMiniPanel(payload)}
      </div>
      <div>
        ${alertsPanel(payload, { compact: true })}
        ${upcomingPanel(payload)}
        ${activityPanel(payload)}
        ${filesPanel(payload)}
      </div>
    </div>
  </section>`;
}

function tasksMiniPanel(payload) {
  const open = asArray(payload.tasks).filter((task) => !['completed', 'approved'].includes(task.status));
  return `<div class="panel">
    <div class="pHead"><div class="h2">My <em>tasks</em></div><button class="pMore" type="button" data-nav="tasks">All tasks ▸</button></div>
    <div class="pBody">
      ${open.length ? open.slice(0, 4).map((task) => `
        <button class="shortItem" type="button" data-nav="tasks">
          <span class="si">${esc(task.title)}</span>
          <span class="sd">${esc(STATUS_LABEL_TASK[task.status] || task.status)}${task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}</span>
        </button>`).join('') : '<div class="storyEmpty">No open assignments right now.</div>'}
    </div>
  </div>`;
}

const STATUS_LABEL_TASK = Object.freeze({
  assigned: 'Assigned',
  submitted: 'Submitted — waiting on Dr B',
  revision_needed: 'Revision needed',
  approved: 'Approved',
  completed: 'Completed',
  reopened: 'Reopened',
});

function renderProgress() {
  const payload = state.progress;
  if (!payload) {
    main.innerHTML = loadingView('Opening your progress…');
    return;
  }
  const enrollment = payload.enrollment;
  main.innerHTML = `<section data-view="progress" class="live">
    <div class="hbPageHead">
      <h1 class="h1">My <em>Progress</em></h1>
      <p class="hbPageSub">Every step of your Session A journey — and exactly who has the ball on each one.</p>
    </div>
    ${asArray(payload.progress).map((category) => {
      const { done, total } = categoryProgress(category);
      return `<div class="panel panel-spaced">
        <div class="pHead">
          <div class="h2">${esc(category.title)}</div>
          <span class="hbCatCount">${done}/${total} complete</span>
        </div>
        <div class="pBody">
          ${category.description ? `<p class="stageHint">${esc(category.description)}</p>` : ''}
          ${asArray(category.items).map((item) => item.isPsTracker
            ? `<div class="hbItemRow hbPsTracker">
                <div class="hbItemMain">
                  <span class="hbItemTitle">${esc(item.title)}</span>
                  <span class="hbItemDesc">Currently: <b>${esc(psStageMeta(enrollment.psStage).student)}</b> · ${ballChip(enrollment.ballOwner)}</span>
                  ${psTimelineMarkup(enrollment.psStage)}
                </div>
              </div>`
            : `<div class="hbItemRow">
                <div class="hbItemMain">
                  <span class="hbItemTitle">${esc(item.title)}${item.required ? '' : ' <small>(optional)</small>'}</span>
                  ${item.description ? `<span class="hbItemDesc">${esc(item.description)}</span>` : ''}
                  ${item.note ? `<span class="hbItemNote">Note from Dr B: ${esc(item.note)}</span>` : ''}
                </div>
                <div class="hbItemSide">
                  ${statusChip(item.status)}
                  ${item.dueDate ? deadlineChip(item.dueDate) : ''}
                </div>
              </div>`).join('')}
        </div>
      </div>`;
    }).join('')}
  </section>`;
}

function renderTasks() {
  const tasks = asArray(state.tasks);
  const open = tasks.filter((task) => !['completed', 'approved'].includes(task.status));
  const closed = tasks.filter((task) => ['completed', 'approved'].includes(task.status));
  const taskCard = (task) => `<div class="panel panel-spaced hbTaskCard">
    <div class="pHead"><div class="h2">${esc(task.title)}</div>${statusChip(task.status === 'assigned' ? 'waiting_on_student' : task.status === 'submitted' ? 'waiting_on_drb' : task.status === 'revision_needed' ? 'revision_needed' : task.status === 'reopened' ? 'waiting_on_student' : 'completed')}</div>
    <div class="pBody">
      ${task.description ? `<p class="stageHint">${esc(task.description)}</p>` : ''}
      <div class="hbTaskMeta">
        <span>Assigned by ${esc(task.assignedBy)} · ${esc(formatDate(task.assignedOn))}</span>
        ${task.dueDate ? deadlineChip(task.dueDate) : ''}
        ${task.priority !== 'normal' ? `<span class="hbChip hb-${task.priority === 'urgent' ? 'revision_needed' : 'waiting_on_student'}">${esc(task.priority)}</span>` : ''}
      </div>
      ${task.adminComment ? `<div class="hbItemNote">Dr B: ${esc(task.adminComment)}</div>` : ''}
      ${task.studentComment ? `<div class="hbItemNote mine">You: ${esc(task.studentComment)}</div>` : ''}
      ${!subjectContext() && ['assigned', 'revision_needed', 'reopened'].includes(task.status) ? `
        <form class="hbInlineForm" data-submit-task="${attr(task.assignmentId)}">
          <input name="comment" placeholder="Add a note with your submission (optional)" maxlength="2000">
          <button class="rowBtn pri" type="submit">Mark submitted</button>
        </form>` : ''}
    </div>
  </div>`;
  main.innerHTML = `<section data-view="tasks" class="live">
    <div class="hbPageHead"><h1 class="h1">My <em>Tasks</em></h1>
    <p class="hbPageSub">Assignments from Dr B — submit here when you are done.</p></div>
    ${open.length ? open.map(taskCard).join('') : '<div class="panel"><div class="pBody"><div class="storyEmpty">No open assignments. New tasks from Dr B will appear here.</div></div></div>'}
    ${closed.length ? `<div class="hbPageHead"><h2 class="h2">Completed</h2></div>${closed.map(taskCard).join('')}` : ''}
  </section>`;
}

function renderPriorities() {
  main.innerHTML = `<section data-view="priorities" class="live">
    <div class="hbPageHead"><h1 class="h1">Priorities <em>&amp; Alerts</em></h1>
    <p class="hbPageSub">What matters this week for Session A — straight from Dr B.</p></div>
    ${prioritiesPanel(state.alerts)}
    ${alertsPanel(state.alerts)}
  </section>`;
}

function renderCalendar() {
  const { events, error, loaded } = state.calendar;
  main.innerHTML = `<section data-view="calendar" class="live">
    <div class="hbPageHead"><h1 class="h1">My <em>Calendar</em></h1>
    <p class="hbPageSub">Session A events, deadlines, and advising — from your Matrix calendar.</p></div>
    <div class="panel"><div class="pBody">
      ${!loaded ? '<div class="storyEmpty">Loading your events…</div>'
        : error ? `<div class="storyEmpty">${esc(error)}<br><a class="rowBtn" href="${attr(matrixHref())}#calendar">Open the full Matrix Calendar</a></div>`
        : events.length ? events.map((event) => `
          <div class="hbUpcoming hbEvent">
            <span class="hbEventTitle">${esc(event.title || 'Event')}</span>
            <span class="hbEventMeta">${esc(event.start_datetime ? new Date(event.start_datetime).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')}${event.event_type ? ` · ${esc(String(event.event_type).replace(/_/g, ' '))}` : ''}</span>
            ${event.meeting_url ? `<a class="rowBtn pri" href="${attr(event.meeting_url)}" target="_blank" rel="noopener">Join</a>` : ''}
          </div>`).join('')
        : `<div class="storyEmpty">No upcoming events found.<br><a class="rowBtn" href="${attr(matrixHref())}#calendar">Open the full Matrix Calendar</a></div>`}
    </div></div>
  </section>`;
}

function renderFiles() {
  const files = asArray(state.files);
  main.innerHTML = `<section data-view="files" class="live">
    <div class="hbPageHead"><h1 class="h1">My <em>Files</em></h1>
    <p class="hbPageSub">Documents linked to your HomeBase. The File Vault remains your full document home.</p></div>
    <div class="panel"><div class="pHead"><div class="h2">Linked files</div>
      <a class="pMore" href="${attr(matrixHref())}#filevault">Open File Vault ▸</a></div>
    <div class="pBody">
      ${files.length ? files.map(fileRow).join('') : '<div class="storyEmpty">Nothing linked yet. Upload documents in the File Vault and Dr B will link the important ones here.</div>'}
    </div></div>
    <div class="panel"><div class="pHead"><div class="h2">Your profile photo</div></div>
    <div class="pBody"><p class="stageHint">Upload a real professional headshot to the File Vault and tell Dr B — it will appear on your roster profile. Your Matrix Arena avatar stays separate.</p>
    <a class="rowBtn pri" href="${attr(matrixHref())}#filevault">Upload in File Vault</a></div></div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Admin views
// ---------------------------------------------------------------------------
function rosterCard(student, { compact = false } = {}) {
  const attention = [];
  if (student.photoState === 'missing') attention.push('<span class="hbChip hb-revision_needed">PHOTO REQUIRED</span>');
  if (['needs_review', 'not_supplied'].includes(student.identityStatus)) {
    attention.push('<span class="hbChip hb-waiting_on_student">IDENTITY MATCH NEEDS REVIEW</span>');
  }
  if (student.status !== 'active') attention.push(`<span class="hbChip hb-not_applicable">${esc(student.status.toUpperCase())}</span>`);
  return `<div class="hbRosterCard ${compact ? 'compact' : ''}">
    <button class="hbRosterMain" type="button" data-open-student="${attr(student.id)}">
      ${studentAvatarMarkup(student, { className: 'hbAvatar' })}
      <span class="hbRosterName"><b>${esc(student.name)}</b>
      <span class="hbRosterMeta">${esc(student.email || 'email NOT SUPPLIED')}</span>
      <span class="hbRosterMeta">${esc(student.sessionName || '')}</span></span>
    </button>
    <div class="hbRosterState">
      <span class="hbRosterStage">PS · ${esc(student.psStageAdminLabel || psStageMeta(student.psStage).admin)}</span>
      ${adminBallChip(student.ballOwner)}
      ${student.deadline ? deadlineChip(student.deadline) : ''}
      ${attention.join('')}
    </div>
    ${compact ? '' : `<div class="hbRosterActions">
      <button class="rowBtn" type="button" data-open-student="${attr(student.id)}">Open</button>
      <button class="rowBtn" type="button" data-preview-student="${attr(student.id)}" data-student-name="${attr(student.name)}">Preview as student</button>
    </div>`}
  </div>`;
}

function renderAdminHome() {
  const payload = state.admin.home;
  if (!payload) {
    main.innerHTML = loadingView('Opening the command center…');
    return;
  }
  const bucket = (key, title, emptyText) => `<div class="panel panel-spaced">
    <div class="pHead"><div class="h2">${title}</div><span class="hbCatCount">${payload[key].length}</span></div>
    <div class="pBody">${payload[key].length
      ? payload[key].slice(0, 6).map((student) => rosterCard(student, { compact: true })).join('')
      : `<div class="storyEmpty">${esc(emptyText)}</div>`}</div>
  </div>`;
  main.innerHTML = `<section data-view="admin-home" class="live">
    <div class="hbPageHead"><h1 class="h1">Admin <em>Command Center</em></h1>
    <p class="hbPageSub">${payload.counts.active} active Session A students · one glance, zero spreadsheets.</p></div>
    <div class="hbQuickViews">
      ${[
        ['waitingOnMe', 'WAITING ON ME'],
        ['waitingOnStudent', 'WAITING ON STUDENT'],
        ['overdue', 'OVERDUE'],
        ['dueThisWeek', 'DUE THIS WEEK'],
        ['psToReview', 'PS TO REVIEW'],
        ['missingPhoto', 'MISSING PHOTO'],
        ['identityReview', 'IDENTITY REVIEW'],
        ['noNextAction', 'NO NEXT ACTION'],
        ['stalled', 'STALLED'],
      ].map(([key, label]) => `<span class="hbQuickView ${payload[key].length ? 'hot' : ''}">${label} <b>${payload[key].length}</b></span>`).join('')}
    </div>
    <div class="homeGrid hbHomeGrid">
      <div>
        ${bucket('waitingOnMe', 'Waiting on <em>me</em>', 'Nobody is waiting on you. Enjoy it while it lasts.')}
        ${bucket('psToReview', 'PS drafts to <em>review</em>', 'No PS drafts waiting for review.')}
        ${bucket('overdue', '<em>Overdue</em>', 'Nothing overdue.')}
        ${bucket('identityReview', 'Identity match <em>needs review</em>', 'All roster identities are resolved.')}
      </div>
      <div>
        ${bucket('waitingOnStudent', 'Waiting on <em>students</em>', 'No students owe you anything right now.')}
        ${bucket('dueThisWeek', 'Due <em>this week</em>', 'No deadlines this week.')}
        ${bucket('missingPhoto', 'Missing <em>photo</em>', 'Every student has a headshot.')}
        ${bucket('stalled', '<em>Stalled</em> (no activity 7d+)', 'Nobody has stalled.')}
        ${prioritiesPanel({ priorities: payload.priorities }, {})}
        ${activityPanel({ activity: payload.recentActivity })}
      </div>
    </div>
  </section>`;
}

function renderRoster() {
  const students = asArray(state.admin.roster);
  const filters = [
    ['', 'All'],
    ['waiting_on_drb', 'Waiting on Dr B'],
    ['waiting_on_student', 'Waiting on Student'],
    ['overdue', 'Overdue'],
    ['due_this_week', 'Due This Week'],
    ['missing_photo', 'Missing Photo'],
    ['needs_review', 'Identity Review'],
    ['no_next_action', 'No Next Action'],
    ['hidden', 'Hidden/Archived'],
  ];
  main.innerHTML = `<section data-view="roster" class="live">
    <div class="hbPageHead">
      <h1 class="h1">Session <em>Roster</em></h1>
      <button class="rowBtn pri" type="button" data-add-student>＋ ADD STUDENT</button>
    </div>
    <div class="hbFilters">
      <input id="rosterSearch" type="search" placeholder="Search name or email…" value="${attr(state.admin.rosterQuery)}" aria-label="Search roster">
      ${filters.map(([key, label]) => `<button type="button" class="hbFilterBtn ${state.admin.rosterFilter === key ? 'on' : ''}" data-roster-filter="${attr(key)}">${esc(label)}</button>`).join('')}
    </div>
    <div class="hbRosterGrid">
      ${students.length ? students.map((student) => rosterCard(student)).join('') : '<div class="storyEmpty">No students match this view.</div>'}
    </div>
  </section>`;
}

function fieldRow(label, control) {
  return `<label class="hbField"><span>${esc(label)}</span>${control}</label>`;
}

function selectControl(name, options, current) {
  return `<select name="${attr(name)}">${options.map(([value, label]) => `<option value="${attr(value)}" ${String(current) === String(value) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
}

function renderAdminStudent() {
  const payload = state.admin.student;
  if (!payload) {
    main.innerHTML = loadingView('Opening student…');
    return;
  }
  const student = payload.student;
  main.innerHTML = `<section data-view="admin-student" class="live">
    <div class="hbPageHead">
      <button class="rowBtn" type="button" data-nav="roster">← Roster</button>
      <h1 class="h1">${esc(student.name)}</h1>
      <button class="rowBtn" type="button" data-preview-student="${attr(student.id)}" data-student-name="${attr(student.name)}">Preview as student</button>
    </div>
    <div class="homeGrid hbHomeGrid">
      <div>
        <div class="panel panel-spaced">
          <div class="pHead"><div class="h2">Student <em>record</em></div>
            ${student.photoState === 'missing' ? '<span class="hbChip hb-revision_needed">PHOTO REQUIRED</span>' : ''}</div>
          <div class="pBody">
            <div class="hbStudentIdentity">${studentAvatarMarkup(student, { className: 'hbAvatar lg' })}
              <div><b>${esc(student.name)}</b><br><span class="hbRosterMeta">${esc(student.email || 'email NOT SUPPLIED')} · ${esc(student.username || 'username NOT SUPPLIED')}</span>
              <br><span class="hbRosterMeta">Identity: ${esc(student.identityStatus)}${student.identityNote ? ` — ${esc(student.identityNote)}` : ''}</span></div>
            </div>
            <form class="hbForm" data-save-student="${attr(student.id)}">
              ${fieldRow('First name', `<input name="firstName" value="${attr(student.firstName)}" maxlength="80">`)}
              ${fieldRow('Last name', `<input name="lastName" value="${attr(student.lastName)}" maxlength="80">`)}
              ${fieldRow('Email', `<input name="email" type="email" value="${attr(student.email || '')}" maxlength="190">`)}
              ${fieldRow('Username', `<input name="username" value="${attr(student.username || '')}" maxlength="80">`)}
              ${fieldRow('Photo URL', `<input name="photoUrl" value="${attr(student.photoUrl || '')}" maxlength="500" placeholder="Paste headshot URL (File Vault signed link or CDN)">`)}
              ${fieldRow('Photo state', selectControl('photoState', [['missing', 'Missing — PHOTO REQUIRED'], ['uploaded', 'Uploaded'], ['approved', 'Approved']], student.photoState))}
              ${fieldRow('Current status', `<input name="currentStatus" value="${attr(student.currentStatus)}" maxlength="200">`)}
              ${fieldRow('PS stage', selectControl('psStage', state.psStages.map((meta) => [meta.stage, `${meta.stage} — ${meta.admin}`]), student.psStage))}
              ${fieldRow('Who has the ball', selectControl('ballOwner', [['student', 'Student'], ['drb', 'Dr B'], ['none', 'Nobody']], student.ballOwner))}
              ${fieldRow('Student next action', `<input name="studentNextAction" value="${attr(student.studentNextAction)}" maxlength="400">`)}
              ${fieldRow('Dr B next action', `<input name="drbNextAction" value="${attr(student.drbNextAction)}" maxlength="400">`)}
              ${fieldRow('Next milestone', `<input name="nextMilestone" value="${attr(student.nextMilestone)}" maxlength="200">`)}
              ${fieldRow('Deadline', `<input name="deadline" type="date" value="${attr(student.deadline ? String(student.deadline).slice(0, 10) : '')}">`)}
              ${fieldRow('Roster status', selectControl('status', [['active', 'Active'], ['hidden', 'Hidden'], ['archived', 'Archived'], ['removed', 'Removed from HomeBase']], student.status))}
              ${fieldRow('Admin note (private)', `<textarea name="adminNote" maxlength="4000">${esc(student.adminNote || '')}</textarea>`)}
              <button class="rowBtn pri" type="submit">Save student</button>
              <p class="stageHint">Hiding, archiving, or removing a student here never deletes their MissionMed account, File Vault documents, or history.</p>
            </form>
          </div>
        </div>
        <div class="panel panel-spaced">
          <div class="pHead"><div class="h2">Link a <em>file</em></div></div>
          <div class="pBody">
            <form class="hbForm" data-add-file="${attr(student.id)}">
              ${fieldRow('Title', '<input name="title" maxlength="200" placeholder="PS Advanced Draft v4" required>')}
              ${fieldRow('Kind', selectControl('kind', [['ps_draft', 'PS draft'], ['timeline', 'Timeline'], ['headshot', 'Headshot'], ['resource', 'Resource'], ['document', 'Document'], ['other', 'Other']], 'document'))}
              ${fieldRow('File Vault document UUID', '<input name="vaultDocumentUuid" maxlength="64" placeholder="from File Vault (optional)">')}
              ${fieldRow('External URL', '<input name="externalUrl" maxlength="500" placeholder="or a direct link (optional)">')}
              <button class="rowBtn pri" type="submit">Link file</button>
            </form>
            ${asArray(payload.files).map(fileRow).join('') || '<div class="storyEmpty">No linked files yet.</div>'}
          </div>
        </div>
      </div>
      <div>
        <div class="panel panel-spaced">
          <div class="pHead"><div class="h2">Checklist — <em>rapid update</em></div></div>
          <div class="pBody">
            ${asArray(payload.progress).map((category) => `
              <div class="hbAdminCat"><b>${esc(category.title)}</b>
                ${asArray(category.items).map((item) => item.isPsTracker
                  ? `<div class="hbAdminItemRow"><span>${esc(item.title)}</span><span class="hbRosterStage">Stage ${esc(String(student.psStage))} — ${esc(student.psStageAdminLabel || '')}</span></div>`
                  : `<div class="hbAdminItemRow">
                      <span>${esc(item.title)}</span>
                      <select data-item-state="${attr(item.id)}" data-enrollment="${attr(student.id)}" aria-label="Status for ${attr(item.title)}">
                        ${STATUS_ORDER.map((status) => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${esc(STATUS_META[status].label)}</option>`).join('')}
                      </select>
                    </div>`).join('')}
              </div>`).join('')}
          </div>
        </div>
        <div class="panel panel-spaced">
          <div class="pHead"><div class="h2">Tasks</div></div>
          <div class="pBody">
            ${asArray(payload.tasks).length ? payload.tasks.map((task) => `
              <div class="hbAdminItemRow">
                <span>${esc(task.title)}${task.dueDate ? ` · due ${esc(formatDate(task.dueDate))}` : ''}</span>
                ${statusChip(task.status === 'assigned' ? 'waiting_on_student' : task.status === 'submitted' ? 'waiting_on_drb' : task.status)}
              </div>`).join('') : '<div class="storyEmpty">No tasks assigned yet.</div>'}
          </div>
        </div>
        <div class="panel panel-spaced">
          <div class="pHead"><div class="h2">Full <em>history</em></div></div>
          <div class="pBody">${asArray(payload.activity).slice(0, 30).map((item) => `
            <div class="advNote hbActivityRow"><span class="avc adv">${esc(item.actorRole === 'admin' ? 'B' : item.actorRole === 'student' ? 'S' : '⚙')}</span>
            <span><span class="who">${esc(ago(item.createdAt))}${item.studentVisible ? '' : ' · private'}</span>
            <span class="txt">${esc(item.summary)}</span></span></div>`).join('') || '<div class="storyEmpty">No history yet.</div>'}</div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderChecklistManager() {
  const payload = state.admin.checklist;
  if (!payload) {
    main.innerHTML = loadingView('Opening the checklist manager…');
    return;
  }
  main.innerHTML = `<section data-view="checklist" class="live">
    <div class="hbPageHead">
      <h1 class="h1">Checklist <em>Manager</em></h1>
      <button class="rowBtn pri" type="button" data-add-category>＋ ADD CATEGORY</button>
    </div>
    <p class="hbPageSub">You own this taxonomy. Add, rename, reorder, hide, archive — students always see a clean progression, never a spreadsheet.</p>
    ${asArray(payload.categories).map((category, index, all) => `
      <div class="panel panel-spaced ${category.state !== 'active' ? 'hbDimmed' : ''}">
        <div class="pHead">
          <div class="h2">${esc(category.title)} ${category.state !== 'active' ? `<small>(${esc(category.state)})</small>` : ''}</div>
          <div class="hbRowActions">
            <button class="rowBtn" type="button" data-cat-move="${attr(category.id)}" data-dir="up" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button class="rowBtn" type="button" data-cat-move="${attr(category.id)}" data-dir="down" ${index === all.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="rowBtn" type="button" data-cat-rename="${attr(category.id)}" data-title="${attr(category.title)}">Rename</button>
            <button class="rowBtn" type="button" data-cat-state="${attr(category.id)}" data-state="${category.state === 'hidden' ? 'active' : 'hidden'}">${category.state === 'hidden' ? 'Unhide' : 'Hide'}</button>
            <button class="rowBtn" type="button" data-cat-state="${attr(category.id)}" data-state="${category.state === 'archived' ? 'active' : 'archived'}">${category.state === 'archived' ? 'Restore' : 'Archive'}</button>
            <button class="rowBtn hbDanger" type="button" data-cat-delete="${attr(category.id)}" data-title="${attr(category.title)}">Delete</button>
            <button class="rowBtn pri" type="button" data-add-item="${attr(category.id)}" data-title="${attr(category.title)}">＋ Item</button>
          </div>
        </div>
        <div class="pBody">
          ${asArray(category.items).map((item, itemIndex, items) => `
            <div class="hbAdminItemRow ${item.state !== 'active' ? 'hbDimmed' : ''}">
              <span>${esc(item.title)}${item.isPsTracker ? ' <small>· PS tracker</small>' : ''}${item.required ? '' : ' <small>· optional</small>'}${item.state !== 'active' ? ` <small>(${esc(item.state)})</small>` : ''}</span>
              <div class="hbRowActions">
                <button class="rowBtn" type="button" data-item-move="${attr(item.id)}" data-dir="up" ${itemIndex === 0 ? 'disabled' : ''}>↑</button>
                <button class="rowBtn" type="button" data-item-move="${attr(item.id)}" data-dir="down" ${itemIndex === items.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="rowBtn" type="button" data-item-rename="${attr(item.id)}" data-title="${attr(item.title)}">Rename</button>
                <button class="rowBtn" type="button" data-item-required="${attr(item.id)}" data-required="${item.required ? '0' : '1'}">${item.required ? 'Make optional' : 'Make required'}</button>
                <button class="rowBtn" type="button" data-item-state-toggle="${attr(item.id)}" data-state="${item.state === 'hidden' ? 'active' : 'hidden'}">${item.state === 'hidden' ? 'Unhide' : 'Hide'}</button>
                <button class="rowBtn" type="button" data-item-state-toggle="${attr(item.id)}" data-state="${item.state === 'archived' ? 'active' : 'archived'}">${item.state === 'archived' ? 'Restore' : 'Archive'}</button>
                <button class="rowBtn hbDanger" type="button" data-item-delete="${attr(item.id)}" data-title="${attr(item.title)}">Delete</button>
              </div>
            </div>`).join('') || '<div class="storyEmpty">No items yet — add the first one.</div>'}
        </div>
      </div>`).join('')}
  </section>`;
}

function renderAdminTasks() {
  const tasks = asArray(state.admin.tasks);
  main.innerHTML = `<section data-view="admin-tasks" class="live">
    <div class="hbPageHead">
      <h1 class="h1">Tasks <em>&amp; Assignments</em></h1>
      <button class="rowBtn pri" type="button" data-create-task>＋ NEW TASK</button>
    </div>
    ${tasks.length ? tasks.map((task) => `
      <div class="panel panel-spaced">
        <div class="pHead"><div class="h2">${esc(task.title)}</div>
        <span class="hbCatCount">${task.doneCount}/${task.assignedCount} done</span></div>
        <div class="pBody">
          <div class="hbTaskMeta">
            <span>${esc(task.audience)} · assigned ${esc(formatDate(task.assignedOn))}</span>
            ${task.dueDate ? deadlineChip(task.dueDate) : ''}
            ${task.priority !== 'normal' ? `<span class="hbChip hb-waiting_on_student">${esc(task.priority)}</span>` : ''}
          </div>
          ${asArray(task.assignments).map((assignment) => `
            <div class="hbAdminItemRow">
              <span>${esc(assignment.studentName)}${assignment.studentComment ? ` — “${esc(assignment.studentComment)}”` : ''}</span>
              <div class="hbRowActions">
                ${statusChip(assignment.status === 'assigned' ? 'waiting_on_student' : assignment.status === 'submitted' ? 'waiting_on_drb' : assignment.status)}
                ${assignment.status === 'submitted' ? `
                  <button class="rowBtn pri" type="button" data-assignment-status="${attr(assignment.id)}" data-status="approved">Approve</button>
                  <button class="rowBtn" type="button" data-assignment-status="${attr(assignment.id)}" data-status="revision_needed">Return</button>` : ''}
                ${['approved', 'completed'].includes(assignment.status) ? `
                  <button class="rowBtn" type="button" data-assignment-status="${attr(assignment.id)}" data-status="reopened">Reopen</button>` : ''}
                ${['assigned', 'reopened', 'revision_needed'].includes(assignment.status) ? `
                  <button class="rowBtn" type="button" data-assignment-status="${attr(assignment.id)}" data-status="completed">Mark done</button>` : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('') : '<div class="panel"><div class="pBody"><div class="storyEmpty">No tasks yet. Create the first Session A assignment.</div></div></div>'}
  </section>`;
}

function renderAdminAlerts() {
  const alerts = asArray(state.admin.alerts);
  const group = (kind, title) => `<div class="panel panel-spaced">
    <div class="pHead"><div class="h2">${title}</div></div>
    <div class="pBody">
      ${alerts.filter((alert) => alert.kind === kind).map((alert) => `
        <div class="hbAdminItemRow ${alert.state !== 'active' ? 'hbDimmed' : ''}">
          <span><b>${esc(alert.title)}</b>${alert.body ? ` — ${esc(alert.body)}` : ''} <small>(${esc(alert.urgency)}${alert.state !== 'active' ? ` · ${esc(alert.state)}` : ''})</small></span>
          <div class="hbRowActions">
            <button class="rowBtn" type="button" data-alert-state="${attr(alert.id)}" data-state="${alert.state === 'active' ? 'hidden' : 'active'}">${alert.state === 'active' ? 'Hide' : 'Reactivate'}</button>
            <button class="rowBtn hbDanger" type="button" data-alert-state="${attr(alert.id)}" data-state="archived">Remove</button>
          </div>
        </div>`).join('') || '<div class="storyEmpty">Nothing posted.</div>'}
    </div>
  </div>`;
  main.innerHTML = `<section data-view="admin-alerts" class="live">
    <div class="hbPageHead">
      <h1 class="h1">Priorities <em>&amp; Alerts</em></h1>
      <button class="rowBtn pri" type="button" data-create-alert>＋ POST</button>
    </div>
    ${group('priority', 'Top priorities <em>this week</em>')}
    ${group('alert', 'Alerts')}
  </section>`;
}

function renderAdminActivity() {
  main.innerHTML = `<section data-view="admin-activity" class="live">
    <div class="hbPageHead"><h1 class="h1">Session <em>Activity</em></h1>
    <p class="hbPageSub">Every meaningful change, timestamped. Students see only their own student-safe history.</p></div>
    <div class="panel"><div class="pBody">
      ${asArray(state.admin.activity).map((item) => `
        <div class="advNote hbActivityRow"><span class="avc adv">${esc(item.actorRole === 'admin' ? 'B' : item.actorRole === 'student' ? 'S' : '⚙')}</span>
        <span><span class="who">${esc(ago(item.createdAt))} · ${esc(item.actorName || item.actorRole)}${item.studentVisible ? '' : ' · private'}</span>
        <span class="txt">${esc(item.summary)}</span></span></div>`).join('') || '<div class="storyEmpty">No activity yet.</div>'}
    </div></div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Drawers (admin forms)
// ---------------------------------------------------------------------------
function openAddStudentDrawer() {
  openDrawer(`
    <h2 class="h2">＋ Add a student</h2>
    <p class="stageHint">Adding here is explicit authorization to bring one more person into Session A HomeBase. Search existing Matrix identity first — never create duplicates casually.</p>
    <form class="hbForm" data-add-student-form>
      ${fieldRow('First name', '<input name="firstName" maxlength="80" required>')}
      ${fieldRow('Last name', '<input name="lastName" maxlength="80" required>')}
      ${fieldRow('Email', '<input name="email" type="email" maxlength="190" placeholder="leave blank only if truly not supplied">')}
      ${fieldRow('Username', '<input name="username" maxlength="80" placeholder="Matrix username (optional)">')}
      <button class="rowBtn pri" type="submit">Add to Session A</button>
    </form>`, { label: 'Add student' });
}

function openCreateTaskDrawer() {
  const students = asArray(state.admin.roster);
  openDrawer(`
    <h2 class="h2">＋ New task</h2>
    <form class="hbForm" data-create-task-form>
      ${fieldRow('Title', '<input name="title" maxlength="200" required placeholder="Submit updated timeline">')}
      ${fieldRow('Description', '<textarea name="description" maxlength="4000" placeholder="What exactly should the student do?"></textarea>')}
      ${fieldRow('Audience', selectControl('audience', [['session', 'Whole session'], ['subset', 'Selected students'], ['individual', 'One student']], 'session'))}
      ${fieldRow('Students (for subset/individual)', `<select name="enrollmentIds" multiple size="6">${students.map((student) => `<option value="${attr(student.id)}">${esc(student.name)}</option>`).join('')}</select>`)}
      ${fieldRow('Due date', '<input name="dueDate" type="date">')}
      ${fieldRow('Priority', selectControl('priority', [['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent'], ['low', 'Low']], 'normal'))}
      <button class="rowBtn pri" type="submit">Assign task</button>
    </form>`, { label: 'New task' });
}

function openCreateAlertDrawer() {
  const students = asArray(state.admin.roster);
  openDrawer(`
    <h2 class="h2">＋ Post priority or alert</h2>
    <form class="hbForm" data-create-alert-form>
      ${fieldRow('Type', selectControl('kind', [['priority', 'Weekly priority'], ['alert', 'Alert']], 'priority'))}
      ${fieldRow('Title', '<input name="title" maxlength="200" required placeholder="360 Strategy — Tuesday 9 PM ET">')}
      ${fieldRow('Body', '<textarea name="body" maxlength="2000"></textarea>')}
      ${fieldRow('Urgency', selectControl('urgency', [['notice', 'Notice'], ['urgent', 'Urgent'], ['info', 'Info']], 'notice'))}
      ${fieldRow('Audience', `<select name="enrollmentId"><option value="">Whole session</option>${students.map((student) => `<option value="${attr(student.id)}">${esc(student.name)} only</option>`).join('')}</select>`)}
      ${fieldRow('Expires', '<input name="expiresAt" type="date">')}
      <label class="hbField hbCheck"><input type="checkbox" name="dismissible" checked><span>Students can dismiss</span></label>
      <button class="rowBtn pri" type="submit">Post it</button>
    </form>`, { label: 'Post priority or alert' });
}

function openAddCategoryDrawer() {
  openDrawer(`
    <h2 class="h2">＋ Add category</h2>
    <form class="hbForm" data-add-category-form>
      ${fieldRow('Title', '<input name="title" maxlength="120" required placeholder="Interview Prep">')}
      ${fieldRow('Description', '<textarea name="description" maxlength="500"></textarea>')}
      <button class="rowBtn pri" type="submit">Add category</button>
    </form>`, { label: 'Add category' });
}

function openAddItemDrawer(categoryId, categoryTitle) {
  openDrawer(`
    <h2 class="h2">＋ Add item to ${esc(categoryTitle)}</h2>
    <form class="hbForm" data-add-item-form="${attr(categoryId)}">
      ${fieldRow('Title', '<input name="title" maxlength="200" required>')}
      ${fieldRow('Description', '<textarea name="description" maxlength="500"></textarea>')}
      ${fieldRow('Default owner', selectControl('defaultOwner', [['student', 'Student'], ['drb', 'Dr B'], ['none', 'Nobody']], 'student'))}
      ${fieldRow('Due date (optional)', '<input name="dueDate" type="date">')}
      <label class="hbField hbCheck"><input type="checkbox" name="required" checked><span>Required</span></label>
      <button class="rowBtn pri" type="submit">Add item</button>
    </form>`, { label: 'Add checklist item' });
}

function openStudentPicker() {
  const students = asArray(state.admin.roster);
  openDrawer(`
    <h2 class="h2">Preview as a student</h2>
    <p class="stageHint">Choose which authorized Session A student to preview. This is a clearly labeled read-only lens — it never changes authentication.</p>
    ${students.filter((student) => student.status === 'active').map((student) => `
      <button class="hbRosterMain hbPickerRow" type="button" data-preview-student="${attr(student.id)}" data-student-name="${attr(student.name)}">
        ${studentAvatarMarkup(student, { className: 'hbAvatar' })}
        <span class="hbRosterName"><b>${esc(student.name)}</b><span class="hbRosterMeta">${esc(student.email || 'email NOT SUPPLIED')}</span></span>
      </button>`).join('') || '<div class="storyEmpty">No active students on the roster.</div>'}
  `, { label: 'Choose student to preview' });
}

// ---------------------------------------------------------------------------
// Lockout / login / failure surfaces
// ---------------------------------------------------------------------------
function renderLogin(errorMessage = '') {
  document.body.classList.remove('is-booting');
  dismissOpening();
  main.innerHTML = `<section class="hbGate">
    <h1 class="h1">HomeBase <em>local fixtures</em></h1>
    <p class="hbPageSub">Choose a fixture identity to explore the prototype.</p>
    ${errorMessage ? `<p class="hbGateError">${esc(errorMessage)}</p>` : ''}
    <div class="hbGateGrid">
      ${['admin', 'student', 'studentOther', 'studentOutsideRoster'].map((persona) => `
        <button class="rowBtn pri" type="button" data-fixture-persona="${persona}">${persona}</button>`).join('')}
    </div>
  </section>`;
}

function renderLockout(lockoutState = 'access_unavailable', message = '') {
  document.body.classList.remove('is-booting');
  dismissOpening();
  const roster = lockoutState === 'homebase_roster_required';
  rail.innerHTML = '';
  hdr.innerHTML = '';
  main.innerHTML = `<section class="hbGate">
    <h1 class="h1">${roster ? 'HomeBase is <em>invite-only</em> right now' : 'HomeBase is <em>unavailable</em>'}</h1>
    <p class="hbPageSub">${esc(message || (roster
    ? 'Your MissionMed account is signed in, but it is not on the Session A HomeBase roster.'
    : 'Your MissionMed session could not be verified. Return to Matrix and try again.'))}</p>
    <a class="rowBtn pri" href="${attr(matrixHref())}">↩ Back to Matrix</a>
  </section>`;
}

function renderStartupFailure() {
  document.body.classList.remove('is-booting');
  dismissOpening();
  main.innerHTML = `<section class="hbGate">
    <h1 class="h1">HomeBase could not <em>open</em></h1>
    <p class="hbPageSub">Something interrupted the connection. Give it another try.</p>
    <button class="rowBtn pri" type="button" data-retry-startup>Try again</button>
    <a class="rowBtn" href="${attr(matrixHref())}">↩ Back to Matrix</a>
  </section>`;
}

function dismissOpening() {
  if (!openingNode) return;
  openingNode.dataset.phase = 'complete';
  openingNode.style.transition = 'opacity .45s ease';
  openingNode.style.opacity = '0';
  window.setTimeout(() => openingNode.remove(), 500);
}

// ---------------------------------------------------------------------------
// Loaders + router
// ---------------------------------------------------------------------------
async function loadCalendar() {
  state.calendar.loaded = false;
  state.calendar.error = '';
  try {
    const start = new Date();
    const end = new Date(Date.now() + 60 * 86400000);
    const payload = await auth.wpRequest(
      `/wp-json/mmed/v1/events?start=${start.toISOString().slice(0, 10)}&end=${end.toISOString().slice(0, 10)}`,
    );
    state.calendar.events = asArray(payload?.events || payload).slice(0, 40);
  } catch {
    state.calendar.events = [];
    state.calendar.error = 'Your Matrix calendar could not be reached from here yet.';
  }
  state.calendar.loaded = true;
}

async function renderRoute() {
  if (!state.user) return;
  renderShell();
  main.innerHTML = loadingView('Opening…');

  try {
    if (subjectContext()) {
      const payload = await api.adminSubjectHome(state.subject.id);
      state.home = payload;
      state.progress = payload;
      state.tasks = payload.tasks;
      if (state.route === 'progress') renderProgress();
      else if (state.route === 'tasks') renderTasks();
      else renderHome();
      renderShell();
      return;
    }

    if (adminLens()) {
      switch (state.route) {
        case 'home': {
          state.admin.home = await api.adminHome();
          renderAdminHome();
          return;
        }
        case 'roster': {
          const params = new URLSearchParams();
          if (state.admin.rosterQuery) params.set('query', state.admin.rosterQuery);
          if (state.admin.rosterFilter) params.set('filter', state.admin.rosterFilter);
          if (state.admin.rosterFilter === 'hidden') params.set('includeHidden', '1');
          const payload = await api.adminRoster(params.toString());
          state.admin.roster = payload.students;
          renderRoster();
          return;
        }
        case 'student': {
          if (!state.routeId) { await navigate('roster', null, { replace: true }); return; }
          state.admin.student = await api.adminStudent(state.routeId);
          state.psStages = state.admin.student.psStages || state.psStages;
          renderAdminStudent();
          return;
        }
        case 'checklist': {
          state.admin.checklist = await api.adminChecklist();
          renderChecklistManager();
          return;
        }
        case 'tasks': {
          const [tasks, roster] = await Promise.all([api.adminTasks(), api.adminRoster()]);
          state.admin.tasks = tasks.tasks;
          state.admin.roster = roster.students;
          renderAdminTasks();
          return;
        }
        case 'priorities': {
          const [alerts, roster] = await Promise.all([api.adminAlerts(), api.adminRoster()]);
          state.admin.alerts = alerts.alerts;
          state.admin.roster = roster.students;
          renderAdminAlerts();
          return;
        }
        case 'activity': {
          const payload = await api.adminActivity();
          state.admin.activity = payload.activity;
          renderAdminActivity();
          return;
        }
        default: {
          await navigate('home', null, { replace: true });
          return;
        }
      }
    }

    // Student lens
    switch (state.route) {
      case 'home': {
        state.home = await api.home();
        state.psStages = state.home.psStages || state.psStages;
        renderHome();
        return;
      }
      case 'progress': {
        state.progress = await api.progress();
        state.psStages = state.progress.psStages || state.psStages;
        renderProgress();
        return;
      }
      case 'tasks': {
        const payload = await api.tasks();
        state.tasks = payload.tasks;
        renderTasks();
        return;
      }
      case 'priorities': {
        state.alerts = await api.alerts();
        renderPriorities();
        return;
      }
      case 'calendar': {
        renderCalendar();
        await loadCalendar();
        renderCalendar();
        return;
      }
      case 'files': {
        const payload = await api.files();
        state.files = payload.files;
        renderFiles();
        return;
      }
      default: {
        await navigate('home', null, { replace: true });
      }
    }
  } catch (error) {
    if (error.code === 'homebase_roster_required') {
      state.lockout = 'homebase_roster_required';
      renderLockout(state.lockout, error.message);
      return;
    }
    main.innerHTML = `<div class="panel"><div class="pBody"><div class="storyEmpty">${esc(error.message || 'That did not load.')}</div></div></div>`;
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
document.addEventListener('click', async (event) => {
  const target = event.target.closest('button, a[data-nav]');
  if (!target) return;
  const data = target.dataset;

  if (data.nav !== undefined && data.nav !== '') {
    event.preventDefault();
    await withBusy(() => navigate(data.nav));
    return;
  }
  if (data.closeDrawer !== undefined) { clearOverlays(); return; }
  if (data.changeFixture !== undefined) {
    sessionStorage.removeItem(FIXTURE_PERSONA_KEY);
    renderLogin();
    return;
  }
  if (data.fixturePersona) {
    try {
      target.disabled = true;
      await enterFixturePersona(data.fixturePersona);
    } catch (error) {
      renderLogin(error.message);
    }
    return;
  }
  if (data.retryStartup !== undefined) { await init(); return; }

  if (data.setView) {
    if (data.setView === 'admin') {
      state.subject = null;
      state.activeRole = 'admin';
      await withBusy(() => navigate('home', null, { replace: true }));
    } else if (isAdmin()) {
      if (!state.admin.roster.length) {
        try {
          const payload = await api.adminRoster();
          state.admin.roster = payload.students;
        } catch (error) {
          notify(error.message, 'error');
          return;
        }
      }
      openStudentPicker();
    }
    return;
  }
  if (data.previewStudent) {
    state.subject = { id: data.previewStudent, name: data.studentName || 'Student' };
    state.activeRole = 'student';
    clearOverlays();
    await withBusy(() => navigate('home', null, { replace: true }));
    return;
  }
  if (data.exitSubject !== undefined) {
    state.subject = null;
    state.activeRole = 'admin';
    await withBusy(() => navigate('roster', null, { replace: true }));
    return;
  }

  if (data.dismissAlert) {
    await withBusy(async () => {
      await api.dismissAlert(data.dismissAlert);
      state.alerts = await api.alerts();
      if (state.route === 'priorities') renderPriorities();
      else { state.home = await api.home(); renderHome(); }
      notify('Dismissed.');
    });
    return;
  }

  if (data.openStudent) {
    await withBusy(() => navigate('student', data.openStudent));
    return;
  }
  if (data.addStudent !== undefined) { openAddStudentDrawer(); return; }
  if (data.createTask !== undefined) { openCreateTaskDrawer(); return; }
  if (data.createAlert !== undefined) { openCreateAlertDrawer(); return; }
  if (data.addCategory !== undefined) { openAddCategoryDrawer(); return; }
  if (data.addItem) { openAddItemDrawer(data.addItem, data.title || ''); return; }

  if (data.rosterFilter !== undefined) {
    state.admin.rosterFilter = data.rosterFilter;
    await withBusy(() => renderRoute());
    return;
  }

  if (data.catMove || data.itemMove) {
    const isCategory = Boolean(data.catMove);
    const id = data.catMove || data.itemMove;
    const list = isCategory
      ? state.admin.checklist.categories
      : state.admin.checklist.categories.flatMap((category) => category.items.map((item) => ({ ...item, _cat: category.id })));
    const scoped = isCategory ? list : list.filter((item) => item._cat === list.find((entry) => entry.id === id)?._cat);
    const index = scoped.findIndex((entry) => entry.id === id);
    const swapWith = data.dir === 'up' ? scoped[index - 1] : scoped[index + 1];
    if (!swapWith) return;
    await withBusy(async () => {
      const patch = isCategory ? api.adminPatchCategory : api.adminPatchItem;
      await patch(id, { sortOrder: swapWith.sortOrder });
      await patch(swapWith.id, { sortOrder: scoped[index].sortOrder });
      state.admin.checklist = await api.adminChecklist();
      renderChecklistManager();
    });
    return;
  }
  if (data.catRename || data.itemRename) {
    const id = data.catRename || data.itemRename;
    const title = window.prompt('New name:', data.title || '');
    if (!title || !title.trim()) return;
    await withBusy(async () => {
      await (data.catRename ? api.adminPatchCategory : api.adminPatchItem)(id, { title: title.trim() });
      state.admin.checklist = await api.adminChecklist();
      renderChecklistManager();
      notify('Renamed.');
    });
    return;
  }
  if (data.catState) {
    await withBusy(async () => {
      await api.adminPatchCategory(data.catState, { state: data.state });
      state.admin.checklist = await api.adminChecklist();
      renderChecklistManager();
    });
    return;
  }
  if (data.itemStateToggle) {
    await withBusy(async () => {
      await api.adminPatchItem(data.itemStateToggle, { state: data.state });
      state.admin.checklist = await api.adminChecklist();
      renderChecklistManager();
    });
    return;
  }
  if (data.itemRequired) {
    await withBusy(async () => {
      await api.adminPatchItem(data.itemRequired, { required: data.required === '1' });
      state.admin.checklist = await api.adminChecklist();
      renderChecklistManager();
    });
    return;
  }
  if (data.catDelete || data.itemDelete) {
    const label = data.title || 'this';
    if (!window.confirm(`Delete “${label}” permanently? Archiving is usually better — students keep their history.`)) return;
    await withBusy(async () => {
      await (data.catDelete ? api.adminDeleteCategory : api.adminDeleteItem)(data.catDelete || data.itemDelete);
      state.admin.checklist = await api.adminChecklist();
      renderChecklistManager();
      notify('Deleted.');
    });
    return;
  }
  if (data.assignmentStatus) {
    await withBusy(async () => {
      await api.adminAssignmentStatus(data.assignmentStatus, { status: data.status });
      const payload = await api.adminTasks();
      state.admin.tasks = payload.tasks;
      renderAdminTasks();
      notify('Updated.');
    });
    return;
  }
  if (data.alertState) {
    await withBusy(async () => {
      await api.adminPatchAlert(data.alertState, { state: data.state });
      const payload = await api.adminAlerts();
      state.admin.alerts = payload.alerts;
      renderAdminAlerts();
    });
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form');
  if (!form) return;
  event.preventDefault();
  const fields = new FormData(form);
  const value = (name) => String(fields.get(name) || '').trim();

  if (form.dataset.submitTask) {
    await withBusy(async () => {
      await api.submitTask(form.dataset.submitTask, value('comment'));
      const payload = await api.tasks();
      state.tasks = payload.tasks;
      renderTasks();
      notify('Submitted — Dr B has the ball now.');
    });
    return;
  }
  if (form.dataset.addStudentForm !== undefined) {
    await withBusy(async () => {
      await api.adminAddStudent({
        firstName: value('firstName'),
        lastName: value('lastName'),
        email: value('email'),
        username: value('username'),
      });
      clearOverlays();
      await navigate('roster', null, { replace: true });
      notify('Student added to Session A.');
    });
    return;
  }
  if (form.dataset.saveStudent) {
    await withBusy(async () => {
      await api.adminPatchStudent(form.dataset.saveStudent, {
        firstName: value('firstName'),
        lastName: value('lastName'),
        email: value('email'),
        username: value('username'),
        photoUrl: value('photoUrl'),
        photoState: value('photoState'),
        currentStatus: value('currentStatus'),
        psStage: Number(value('psStage')),
        ballOwner: value('ballOwner'),
        studentNextAction: value('studentNextAction'),
        drbNextAction: value('drbNextAction'),
        nextMilestone: value('nextMilestone'),
        deadline: value('deadline'),
        status: value('status'),
        adminNote: value('adminNote'),
      });
      state.admin.student = await api.adminStudent(form.dataset.saveStudent);
      renderAdminStudent();
      notify('Saved.');
    });
    return;
  }
  if (form.dataset.addFile) {
    await withBusy(async () => {
      await api.adminAddFile({
        enrollmentId: form.dataset.addFile,
        title: value('title'),
        kind: value('kind'),
        vaultDocumentUuid: value('vaultDocumentUuid'),
        externalUrl: value('externalUrl'),
      });
      state.admin.student = await api.adminStudent(form.dataset.addFile);
      renderAdminStudent();
      notify('File linked.');
    });
    return;
  }
  if (form.dataset.createTaskForm !== undefined) {
    await withBusy(async () => {
      const enrollmentIds = fields.getAll('enrollmentIds').map(String).filter(Boolean);
      await api.adminCreateTask({
        title: value('title'),
        description: value('description'),
        audience: value('audience'),
        enrollmentIds,
        dueDate: value('dueDate'),
        priority: value('priority'),
      });
      clearOverlays();
      const payload = await api.adminTasks();
      state.admin.tasks = payload.tasks;
      renderAdminTasks();
      notify('Task assigned.');
    });
    return;
  }
  if (form.dataset.createAlertForm !== undefined) {
    await withBusy(async () => {
      await api.adminCreateAlert({
        kind: value('kind'),
        title: value('title'),
        body: value('body'),
        urgency: value('urgency'),
        enrollmentId: value('enrollmentId') || undefined,
        expiresAt: value('expiresAt') || undefined,
        dismissible: fields.get('dismissible') === 'on',
      });
      clearOverlays();
      const payload = await api.adminAlerts();
      state.admin.alerts = payload.alerts;
      renderAdminAlerts();
      notify('Posted.');
    });
    return;
  }
  if (form.dataset.addCategoryForm !== undefined) {
    await withBusy(async () => {
      await api.adminCreateCategory({ title: value('title'), description: value('description') });
      clearOverlays();
      state.admin.checklist = await api.adminChecklist();
      renderChecklistManager();
      notify('Category added.');
    });
    return;
  }
  if (form.dataset.addItemForm) {
    await withBusy(async () => {
      await api.adminCreateItem({
        categoryId: form.dataset.addItemForm,
        title: value('title'),
        description: value('description'),
        defaultOwner: value('defaultOwner'),
        dueDate: value('dueDate'),
        required: fields.get('required') === 'on',
      });
      clearOverlays();
      state.admin.checklist = await api.adminChecklist();
      renderChecklistManager();
      notify('Item added.');
    });
  }
});

document.addEventListener('change', async (event) => {
  const select = event.target.closest('select[data-item-state]');
  if (select) {
    await withBusy(async () => {
      await api.adminSetItemState({
        itemId: select.dataset.itemState,
        enrollmentId: select.dataset.enrollment,
        status: select.value,
      });
      notify(`Status → ${STATUS_META[select.value]?.label || select.value}.`);
    });
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'rosterSearch') {
    state.admin.rosterQuery = event.target.value;
    window.clearTimeout(document.rosterSearchTimer);
    document.rosterSearchTimer = window.setTimeout(async () => {
      const params = new URLSearchParams();
      if (state.admin.rosterQuery) params.set('query', state.admin.rosterQuery);
      if (state.admin.rosterFilter) params.set('filter', state.admin.rosterFilter);
      try {
        const payload = await api.adminRoster(params.toString());
        state.admin.roster = payload.students;
        if (state.route === 'roster') {
          const active = document.activeElement === event.target;
          const cursor = event.target.selectionStart;
          renderRoster();
          if (active) {
            const input = $('#rosterSearch');
            input?.focus();
            input?.setSelectionRange(cursor, cursor);
          }
        }
      } catch {
        // keep the current list on transient failures
      }
    }, 250);
  }
});

window.addEventListener('popstate', async () => {
  if (!state.user) return;
  parseRoute();
  clearOverlays();
  try {
    await renderRoute();
  } catch (error) {
    notify(error.message);
  }
});

$('.skip-link')?.addEventListener('click', (event) => {
  event.preventDefault();
  const heading = $('h1, .h1', main);
  heading?.setAttribute('tabindex', '-1');
  heading?.focus();
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function bootstrapSession() {
  const session = await api.session();
  state.user = session.user;
  state.capabilities = Object.freeze(session.capabilities || {});
  state.enrollment = session.enrollment;
  state.activeRole = session.user.role;
  state.subject = null;
  state.lockout = null;
  parseRoute();
  const studentRoutes = new Set(['home', 'progress', 'tasks', 'priorities', 'calendar', 'files']);
  const adminRoutes = new Set(['home', 'roster', 'student', 'checklist', 'tasks', 'priorities', 'activity']);
  const allowed = adminLens() ? adminRoutes : studentRoutes;
  if (!allowed.has(state.route)) {
    state.route = 'home';
    state.routeId = null;
    pushPath('home', null, true);
  }
  await renderRoute();
  dismissOpening();
}

async function enterFixturePersona(persona) {
  if (!FIXTURE_PERSONAS.has(persona)) throw new Error('Unknown fixture identity.');
  const payload = await api.fixture(persona);
  auth.setToken(payload.token);
  sessionStorage.setItem(FIXTURE_PERSONA_KEY, persona);
  try {
    await bootstrapSession();
  } catch (error) {
    if (error.code === 'homebase_roster_required') {
      state.lockout = 'homebase_roster_required';
      renderLockout(state.lockout, error.message);
      return;
    }
    throw error;
  }
}

async function init() {
  try {
    state.config = await api.config();
    auth.configure(state.config);
    if (state.config.devAuth) {
      const remembered = sessionStorage.getItem(FIXTURE_PERSONA_KEY);
      if (remembered && FIXTURE_PERSONAS.has(remembered)) {
        await enterFixturePersona(remembered);
        return;
      }
      renderLogin();
      return;
    }
    await auth.exchange();
    await bootstrapSession();
  } catch (error) {
    if (error.code === 'homebase_roster_required') {
      state.lockout = 'homebase_roster_required';
      renderLockout(state.lockout, error.message);
      return;
    }
    if (!error.redirecting && !state.lockout) renderStartupFailure();
  }
}

init();
