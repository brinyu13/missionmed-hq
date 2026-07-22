import { bootstrapCsrf, buildCommandEnvelope, CamApiError, command, query } from './state/api.js';
import { isCamLink, navigate, parseRoute } from './state/router.js';
import { el, object, replaceChildren, setDocumentTitle, text } from './components/dom.js';
import { errorPanel, loadingPanel, metaBanners, statePanel } from './components/state-panel.js';
import {
  closeDialog,
  createShell,
  openDialog,
  populatePalette,
  populateQuickCaptureStudents,
  setSaveState,
  updateShell,
} from './components/shell.js';
import { updateEvidenceInspector } from './components/trust.js';
import { pageIntro } from './mentor/common.js';
import { renderToday } from './mentor/today.js';
import { renderStudents } from './mentor/students.js';
import { renderStudentWorkspace } from './mentor/student-workspace.js';
import { renderSession } from './mentor/session.js';
import { renderWork } from './mentor/work.js';
import { renderReviews } from './reviews/reviews.js';
import { renderOperations } from './operations/operations.js';

const root = document.getElementById('cam-app');
const refs = createShell(root);
const app = {
  route: null,
  envelope: null,
  abortController: null,
  csrfToken: '',
  csrfReady: false,
  csrfError: null,
  students: [],
  evidence: new Map(),
  dirtyForm: null,
  pendingHref: null,
  pendingAction: null,
  pendingDialogId: null,
  focusMode: false,
  canOperate: false,
  commandPending: false,
  loadSequence: 0,
};

bindEvents();
startCsrfBootstrap();
discoverOperationsCapability();
loadRoute({ focus: false });

function bindEvents() {
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleInput);
  window.addEventListener('popstate', () => loadRoute({ focus: true }));
  window.addEventListener('cam:navigate', (event) => loadRoute({ focus: event.detail?.focus !== false }));
  window.addEventListener('online', handleConnectivity);
  window.addEventListener('offline', handleConnectivity);
  window.addEventListener('beforeunload', (event) => {
    if (!app.dirtyForm) return;
    event.preventDefault();
    event.returnValue = '';
  });
  document.addEventListener('keydown', handleKeyboard);
  document.addEventListener('close', (event) => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement)) return;
    const returnId = dialog.dataset.returnFocusId;
    if (returnId) requestAnimationFrame(() => document.getElementById(returnId)?.focus());
  }, true);
}

async function startCsrfBootstrap() {
  try {
    app.csrfToken = await bootstrapCsrf();
    app.csrfReady = true;
    app.csrfError = null;
  } catch (error) {
    app.csrfToken = '';
    app.csrfReady = true;
    app.csrfError = error;
  }
  applyCommandAvailability();
  if (!app.csrfToken && !app.dirtyForm) setSaveState(refs, 'UNAVAILABLE');
}

async function discoverOperationsCapability() {
  try {
    const envelope = await query('/api/mmc/v2/mentor/operations');
    app.canOperate = envelope.data?.kind === 'MENTOR_OPERATIONS';
  } catch {
    app.canOperate = false;
  }
  if (app.route) updateShell(refs, app.route, app.envelope?.meta || {}, {
    capabilities: app.canOperate ? ['operations.read'] : [],
  });
}

async function loadRoute(options = {}) {
  const route = parseRoute();
  if (route.canonicalPath) {
    navigate(route.canonicalPath, { replace: true, focus: options.focus });
    return;
  }
  app.abortController?.abort();
  const controller = new AbortController();
  const sequence = ++app.loadSequence;
  app.abortController = controller;
  app.route = route;
  app.envelope = null;
  app.evidence = new Map();
  document.body.dataset.camReady = 'false';
  document.body.dataset.camRoute = route.name;
  renderLoading(route);

  if (!route.endpoint) {
    renderUnavailable(route, options.focus !== false);
    return;
  }
  try {
    const envelope = await query(route.endpoint, { signal: controller.signal, search: route.search });
    if (sequence !== app.loadSequence) return;
    const composed = await composeContext(route, envelope, controller.signal);
    if (sequence !== app.loadSequence) return;
    app.envelope = Object.freeze({ data: composed.data, meta: envelope.meta });
    if (route.name === 'students') app.students = [...(envelope.data.students || [])];
    indexEvidence(composed.data);
    renderSuccess(route, composed.data, envelope.meta, {
      focus: options.focus !== false,
      contextPartial: composed.contextPartial,
    });
  } catch (error) {
    if (error?.name === 'AbortError' || sequence !== app.loadSequence) return;
    renderFailure(route, error, options.focus !== false);
  }
}

async function composeContext(route, envelope, signal) {
  const data = envelope.data;
  let contextPartial = null;
  if (route.name === 'student-overview') {
    return { data: { ...data, studentContext: { subjectLink: data.subjectLink, assignment: data.assignment, upcomingCall: data.upcomingCall } }, contextPartial };
  }
  if (route.name.startsWith('student-') && route.params.studentId) {
    try {
      const overview = await query(`/api/mmc/v2/mentor/students/${encodeURIComponent(route.params.studentId)}/overview`, { signal });
      return {
        data: { ...data, studentContext: { subjectLink: overview.data.subjectLink, assignment: overview.data.assignment, upcomingCall: overview.data.upcomingCall } },
        contextPartial,
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      contextPartial = 'Verified student name and assignment context could not be loaded; route-owned data remains visible.';
      return { data, contextPartial };
    }
  }
  if (route.name.startsWith('session-') && data.subjectLinkId) {
    try {
      const overview = await query(`/api/mmc/v2/mentor/students/${encodeURIComponent(data.subjectLinkId)}/overview`, { signal });
      return {
        data: { ...data, studentContext: { subjectLink: overview.data.subjectLink, assignment: overview.data.assignment, upcomingCall: overview.data.upcomingCall } },
        contextPartial,
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      contextPartial = 'Pinned subject identity could not be expanded; the opaque session binding remains fixed.';
      return { data, contextPartial };
    }
  }
  if (route.name === 'work' || route.name === 'reviews') {
    try {
      const directory = await loadDirectory(signal);
      const byId = new Map(directory.map((student) => [student.subjectLinkId, student]));
      return {
        data: {
          ...data,
          items: (data.items || []).map((item) => ({ ...item, student: byId.get(item.subjectLinkId) || null })),
        },
        contextPartial,
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      contextPartial = 'Authorized student display names could not be loaded; opaque work bindings remain visible.';
      return { data, contextPartial };
    }
  }
  return { data, contextPartial };
}

async function loadDirectory(signal) {
  if (app.students.length) return app.students;
  const envelope = await query('/api/mmc/v2/mentor/students', { signal });
  app.students = [...(envelope.data.students || [])];
  return app.students;
}

function renderLoading(route) {
  const stage = stageNode([
    pageIntro({ eyebrow: 'Mentor workspace', title: route.title, lead: 'Resolving current server authority before showing protected data.' }),
    loadingPanel(route.title.toLocaleLowerCase()),
  ]);
  replaceChildren(refs.main, stage);
  updateShell(refs, route, {}, {});
  setDocumentTitle(route.title);
}

function renderSuccess(route, data, meta, options = {}) {
  const blocking = blockingMetaState(meta);
  const routeNodes = blocking
    ? [pageIntro({ eyebrow: 'Mentor workspace', title: route.title, lead: 'Current server authority prevents this view.' }), statePanel(blocking)]
    : renderRoute(route, data, meta);
  const contextualBanner = options.contextPartial ? [
    statePanel('partial', {
      title: 'Context is partially available',
      explanation: options.contextPartial,
      impact: 'No other student, fixture fallback, or inferred identity is substituted.',
    }),
  ] : [];
  const stage = stageNode([...metaBanners(meta), ...contextualBanner, ...routeNodes]);
  replaceChildren(refs.main, stage);
  updateShell(refs, route, meta, {
    capabilities: route.name === 'operations' || app.canOperate ? ['operations.read'] : [],
  });
  const saveState = data.saveState || (data.connectivity === 'OFFLINE' ? 'OFFLINE_NOT_SAVED' : app.dirtyForm ? 'UNSAVED' : app.csrfReady && !app.csrfToken ? 'UNAVAILABLE' : 'NONE');
  setSaveState(refs, saveState);
  setDocumentTitle(route.title);
  applyCommandAvailability();
  finishRoute(route, options.focus);
}

function renderFailure(route, error, focus) {
  const stage = stageNode([
    pageIntro({ eyebrow: 'Mentor workspace', title: route.title, lead: 'The authoritative query did not complete.' }),
    errorPanel(error),
  ]);
  replaceChildren(refs.main, stage);
  updateShell(refs, route, {}, {});
  if (!app.csrfToken) setSaveState(refs, 'UNAVAILABLE');
  setDocumentTitle(route.title);
  finishRoute(route, focus);
}

function renderUnavailable(route, focus) {
  const stage = stageNode([
    pageIntro({ eyebrow: 'Private mentor route', title: 'Page unavailable', lead: 'The requested route is not part of the current mentor workspace.' }),
    statePanel('unavailable', {
      secondaryLabel: 'Return to Today',
      secondaryHref: '/mmc-private/today',
    }),
  ]);
  replaceChildren(refs.main, stage);
  updateShell(refs, route, {}, {});
  finishRoute(route, focus);
}

function renderRoute(route, data, meta) {
  if (route.name === 'today') return renderToday(data, meta);
  if (route.name === 'students') return renderStudents(data, meta);
  if (route.name.startsWith('student-')) return renderStudentWorkspace(route, data, meta);
  if (route.name.startsWith('session-')) return renderSession(route, data, meta);
  if (route.name === 'work') return renderWork(data, meta);
  if (route.name === 'reviews') return renderReviews(route, data, meta);
  if (route.name === 'operations') return renderOperations(route, data, meta);
  return [statePanel('unavailable')];
}

function stageNode(children) {
  return el('div', { className: 'route-stage', dataset: { testid: 'route-stage' } }, children);
}

function finishRoute(route, focus) {
  document.body.dataset.camReady = 'true';
  refs.routeAnnouncer.textContent = `${route.title} loaded`;
  if (focus) requestAnimationFrame(() => document.getElementById('route-heading')?.focus());
}

function blockingMetaState(metaInput) {
  const meta = object(metaInput);
  if (String(meta.authorization || '').toUpperCase() === 'REVOKED') return 'revoked';
  if (String(meta.state || '').toUpperCase() === 'ERROR') return 'error';
  if (String(meta.connectivity || '').toUpperCase() === 'OFFLINE' && !app.envelope) return 'offline';
  return null;
}

function handleClick(event) {
  const anchor = event.target.closest('a[href]');
  if (anchor && isCamLink(anchor) && !event.defaultPrevented && event.button === 0
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    requestNavigation(anchor.href, anchor);
    return;
  }
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const action = control.dataset.action;
  if (action === 'open-palette') return openPalette(control);
  if (action === 'open-quick-capture') return openQuickCapture(control);
  if (action === 'open-more') {
    if (blockOverlaySwitch(refs.more)) return;
    return openDialog(refs.more, control);
  }
  if (action === 'close-dialog') return requestDialogClose(control);
  if (action === 'toggle-focus') return toggleFocusMode();
  if (action === 'retry-route') return loadRoute({ focus: false });
  if (action === 'clear-student-search') return clearStudentSearch();
  if (action === 'clear-work-filters') return clearWorkFilters();
  if (action === 'open-evidence') return openEvidence(control);
  if (action === 'close-evidence') return closeEvidence(control);
  if (action === 'open-attention-decision') return openAttentionDecision(control);
  if (action === 'act-top-attention') return document.querySelector('.attention-item--top a[href]')?.click();
  if (action === 'start-session') return startSession(control);
  if (action === 'pause-session') return changeSessionState(control, 'session.pause');
  if (action === 'resume-session') return changeSessionState(control, 'session.resume');
  if (action === 'end-session-review') return endSessionForReview(control);
  if (action === 'complete-work-item') return completeWorkItem(control);
  if (action === 'save-before-navigation') return saveBeforeNavigation();
  if (action === 'discard-navigation') return discardAndNavigate();
  if (action === 'stay-on-page') return stayOnPage();
}

function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === 'session-capture-form') {
    event.preventDefault();
    submitSessionCapture(form);
  } else if (form.id === 'quick-capture-form') {
    event.preventDefault();
    submitQuickCapture(form);
  } else if (form.matches('[data-session-review-item]')) {
    event.preventDefault();
    submitReviewDecision(form);
  } else if (form.id === 'review-decision-form') {
    event.preventDefault();
    submitReviewDecision(form);
  } else if (form.id === 'attention-decision-form') {
    event.preventDefault();
    submitAttentionDecision(form);
  } else if (form.matches('[data-action="student-search-form"], [data-action="work-filter-form"]')) {
    event.preventDefault();
  }
}

function handleInput(event) {
  if (event.target.id === 'palette-search') populatePalette(refs.palette, app.students);
  if (event.target.id === 'student-search') filterStudents();
  if (event.target.closest('[data-action="work-filter-form"]')) filterWork();
  const form = event.target.closest('#session-capture-form, #quick-capture-form, #attention-decision-form, [data-session-review-item], #review-decision-form');
  if (form && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) markDirty(form);
}

function handleKeyboard(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
    event.preventDefault();
    openPalette(document.activeElement);
    return;
  }
  if (event.key === 'Escape') {
    const dialog = document.querySelector('dialog[open]');
    if (dialog) {
      event.preventDefault();
      closeDialog(dialog);
      return;
    }
    const inspector = document.getElementById('evidence-inspector');
    if (inspector && !inspector.hidden) closeEvidence(inspector);
  }
}

function handleConnectivity() {
  refs.connectionStatus.textContent = navigator.onLine === false ? 'Offline' : 'Connected';
  if (navigator.onLine === false && app.dirtyForm) {
    setSaveState(refs, 'OFFLINE_NOT_SAVED');
    announce('Offline. Browser-only text is not saved and may be lost on close or reload.');
  } else if (navigator.onLine && app.dirtyForm) {
    setSaveState(refs, 'UNSAVED');
    announce('Connection restored. Review and save the retained browser text.');
  }
}

function requestNavigation(href, opener) {
  const target = new URL(href, window.location.origin);
  if (app.route?.name === 'session-live' && target.pathname.startsWith('/mmc-private/students/')) {
    announce('Pause the pinned session or enter review before switching students.', true);
    return;
  }
  if (app.dirtyForm) {
    app.pendingHref = `${target.pathname}${target.search}${target.hash}`;
    app.pendingAction = null;
    app.pendingDialogId = null;
    openDialog(refs.unsaved, opener);
    return;
  }
  document.querySelectorAll('dialog[open]').forEach((dialog) => closeDialog(dialog));
  navigate(target.href);
}

function requestDialogClose(control) {
  const dialog = control.closest('dialog');
  if (app.dirtyForm && dialog?.contains(app.dirtyForm)) {
    app.pendingHref = null;
    app.pendingAction = null;
    app.pendingDialogId = dialog.id;
    openDialog(refs.unsaved, control);
    return;
  }
  closeDialog(dialog);
}

async function openPalette(opener) {
  if (blockOverlaySwitch(refs.palette)) return;
  openDialog(refs.palette, opener);
  populatePalette(refs.palette, app.students);
  if (!app.students.length) {
    try {
      await loadDirectory();
      populatePalette(refs.palette, app.students);
    } catch {
      replaceChildren(refs.palette.querySelector('#palette-results'), el('li', { className: 'empty-inline', text: 'Authorized student search is unavailable. Destinations remain available.' }));
    }
  }
}

async function openQuickCapture(opener) {
  if (blockOverlaySwitch(refs.quickCapture)) return;
  openDialog(refs.quickCapture, opener);
  const status = refs.quickCapture.querySelector('#quick-capture-errors');
  replaceChildren(status);
  try {
    await loadDirectory();
    populateQuickCaptureStudents(refs.quickCapture, app.students);
  } catch (error) {
    replaceChildren(status, commandErrorSummary(error));
  }
  applyCommandAvailability();
}

function blockOverlaySwitch(targetDialog) {
  if (!app.dirtyForm || targetDialog.contains(app.dirtyForm)) return false;
  announce('Save or discard the current browser-only text before opening another overlay.', true);
  requestAnimationFrame(() => app.dirtyForm.querySelector('textarea, input, select')?.focus());
  return true;
}

function toggleFocusMode() {
  app.focusMode = !app.focusMode;
  document.body.classList.toggle('cam-focus-mode', app.focusMode);
  document.querySelectorAll('[data-action="toggle-focus"]').forEach((button) => {
    button.setAttribute('aria-pressed', String(app.focusMode));
    if (button.classList.contains('focus-toggle')) button.setAttribute('aria-label', app.focusMode ? 'Exit focus mode' : 'Enter focus mode');
  });
  document.querySelectorAll('dialog[open]').forEach((dialog) => closeDialog(dialog));
  announce(app.focusMode ? 'Focus mode on.' : 'Focus mode off.');
}

function openEvidence(control) {
  const evidence = app.evidence.get(control.dataset.evidenceId) || app.evidence.get('current');
  const inspector = document.getElementById('evidence-inspector');
  if (!inspector || !evidence) {
    announce('No additional evidence detail was returned for this item.');
    return;
  }
  updateEvidenceInspector(inspector, evidence);
  inspector.dataset.returnFocusId = ensureId(control);
  requestAnimationFrame(() => inspector.querySelector('h2')?.focus?.());
}

function closeEvidence(control) {
  const inspector = control.closest?.('#evidence-inspector') || document.getElementById('evidence-inspector');
  if (!inspector) return;
  const returnId = inspector.dataset.returnFocusId;
  inspector.hidden = true;
  inspector.dataset.open = 'false';
  if (returnId) requestAnimationFrame(() => document.getElementById(returnId)?.focus());
}

function openAttentionDecision(control) {
  if (blockOverlaySwitch(refs.attentionDecision)) return;
  const form = refs.attentionDecision.querySelector('#attention-decision-form');
  form.reset();
  form.elements.kind.value = control.dataset.decisionKind;
  form.elements.targetId.value = control.dataset.objectId;
  form.elements.expectedVersion.value = control.dataset.expectedVersion;
  form.elements.sourceVersion.value = control.dataset.sourceVersion;
  refs.attentionDecision.querySelector('#attention-decision-title').textContent = control.dataset.decisionKind === 'attention.dismiss'
    ? 'Dismiss this condition'
    : 'Defer this condition';
  replaceChildren(refs.attentionDecision.querySelector('#attention-decision-status'));
  openDialog(refs.attentionDecision, control);
  applyCommandAvailability();
}

async function startSession(control) {
  const data = object(app.envelope?.data);
  const subjectLinkId = data.subjectLinkId || control.dataset.studentId;
  const objective = data.objective;
  if (!subjectLinkId || !objective) return announce('Session start needs a verified student and objective.', true);
  const scheduledCallId = data.studentContext?.upcomingCall?.id || null;
  const targetId = crypto.randomUUID();
  const payload = { subjectLinkId, objective };
  if (scheduledCallId) payload.scheduledCallId = scheduledCallId;
  const result = await runCommand({
    kind: 'session.start',
    targetId,
    expectedVersion: 0,
    purpose: 'start_pinned_mentor_session',
    payload,
  }, control.closest('.prep-actions'));
  if (result) navigate(`/mmc-private/sessions/${encodeURIComponent(result.readback.id)}/live`);
}

async function changeSessionState(control, kind) {
  const session = object(app.envelope?.data?.session);
  const result = await runCommand({
    kind,
    targetId: session.id || control.dataset.targetId,
    expectedVersion: session.version,
    purpose: kind === 'session.pause' ? 'pause_pinned_mentor_session' : 'resume_pinned_mentor_session',
    payload: {},
  }, control.closest('.page-intro__actions'));
  if (result) loadRoute({ focus: false });
}

async function endSessionForReview(control) {
  const session = object(app.envelope?.data?.session);
  if (app.dirtyForm) {
    app.pendingHref = null;
    app.pendingDialogId = null;
    app.pendingAction = {
      type: 'end-session-review',
      targetId: session.id || control.dataset.targetId,
      expectedVersion: session.version,
    };
    openDialog(refs.unsaved, control);
    return;
  }
  await performEndSessionForReview(session.id || control.dataset.targetId, session.version, control.closest('.page-intro__actions'));
}

async function performEndSessionForReview(targetId, expectedVersion, statusRegion) {
  const result = await runCommand({
    kind: 'session.end_for_review',
    targetId,
    expectedVersion,
    purpose: 'end_capture_and_open_review',
    payload: {},
  }, statusRegion);
  if (result) navigate(`/mmc-private/sessions/${encodeURIComponent(result.readback.id)}/review`);
}

async function submitSessionCapture(form) {
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const data = object(app.envelope?.data);
  const payload = {
    subjectLinkId: data.subjectLinkId,
    sessionId: form.dataset.sessionId,
    captureKind: values.get('captureType'),
    text: values.get('text'),
  };
  if (values.get('includeTimestamp') === 'true') payload.occurredAt = new Date().toISOString();
  const result = await runCommand({
    kind: 'capture.save',
    targetId: crypto.randomUUID(),
    expectedVersion: 0,
    purpose: 'save_typed_session_capture',
    payload,
  }, form.querySelector('#capture-form-status'));
  if (result) {
    form.reset();
    clearDirty(form);
    loadRoute({ focus: false });
  }
}

async function submitQuickCapture(form) {
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const captureType = String(values.get('captureType'));
  const ownerType = captureType === 'MENTOR_TASK' ? 'MENTOR' : captureType === 'STUDENT_TASK' ? 'STUDENT' : 'SHARED';
  const kind = captureType === 'MUTUAL_COMMITMENT' ? 'commitment.upsert' : 'task.upsert';
  const result = await runCommand({
    kind,
    targetId: crypto.randomUUID(),
    expectedVersion: 0,
    purpose: 'create_typed_global_mentor_capture',
    payload: {
      subjectLinkId: values.get('studentId'),
      title: values.get('text'),
      ownerType,
      status: 'DRAFT',
      sensitivity: 'NORMAL',
    },
  }, form.querySelector('#quick-capture-errors'));
  if (result) {
    form.reset();
    clearDirty(form);
    closeDialog(refs.quickCapture);
    loadRoute({ focus: false });
  }
}

async function submitReviewDecision(form) {
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const targetId = form.dataset.reviewId;
  const payload = {
    decision: values.get('decision'),
    rationale: values.get('rationale'),
    policyVersionId: form.dataset.policyVersionId,
  };
  const editedText = String(values.get('editedText') || '').trim();
  if (editedText) payload.editedText = editedText;
  const result = await runCommand({
    kind: 'review.decide',
    targetId,
    expectedVersion: Number(form.dataset.expectedVersion || 0),
    purpose: 'record_individual_human_review_decision',
    payload,
  }, form.querySelector('.form-status') || form.previousElementSibling || form);
  if (result) {
    clearDirty(form);
    loadRoute({ focus: false });
  }
}

async function submitAttentionDecision(form) {
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const hours = Number(values.get('expiryHours'));
  const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();
  const result = await runCommand({
    kind: values.get('kind'),
    targetId: values.get('targetId'),
    expectedVersion: Number(values.get('expectedVersion')),
    purpose: values.get('kind') === 'attention.dismiss' ? 'dismiss_actionable_attention_with_reason' : 'defer_actionable_attention_with_reason',
    payload: {
      sourceVersion: Number(values.get('sourceVersion')),
      reason: values.get('reason'),
      expiresAt,
    },
  }, form.querySelector('#attention-decision-status'));
  if (result) {
    form.reset();
    clearDirty(form);
    closeDialog(refs.attentionDecision);
    loadRoute({ focus: false });
  }
}

async function completeWorkItem(control) {
  const item = findObjectById(app.envelope?.data?.items, control.dataset.objectId);
  if (!item) return announce('The current work item could not be found.', true);
  const kind = String(item.kind).toUpperCase() === 'COMMITMENT' ? 'commitment.upsert' : 'task.upsert';
  const payload = {
    subjectLinkId: item.subjectLinkId,
    title: item.title,
    ownerType: item.ownerType,
    status: 'COMPLETED',
    sensitivity: item.sensitivity,
  };
  if (item.details) payload.details = item.details;
  if (item.dueAt) payload.dueAt = item.dueAt;
  const result = await runCommand({
    kind,
    targetId: item.id,
    expectedVersion: item.version,
    purpose: 'complete_evidence_backed_work_item',
    payload,
  }, control.closest('.work-item__actions'));
  if (result) loadRoute({ focus: false });
}

async function runCommand(spec, statusRegion) {
  if (app.commandPending) {
    announce('A mentor command is already saving. Wait for its readback before trying again.');
    return null;
  }
  if (!app.csrfToken) {
    const error = app.csrfError || new CamApiError('Commands are unavailable because the authenticated CSRF session was not established.', { code: 'CSRF_BOOTSTRAP_UNAVAILABLE', retryable: false });
    showCommandError(statusRegion, error);
    setSaveState(refs, app.dirtyForm ? 'UNSAVED' : 'UNAVAILABLE');
    return null;
  }
  const envelope = buildCommandEnvelope(spec);
  app.commandPending = true;
  applyCommandAvailability();
  setSaveState(refs, 'SAVING');
  setRegionStatus(statusRegion, 'Saving to the current authorized record…');
  try {
    const result = await command(envelope, { csrfToken: app.csrfToken });
    setSaveState(refs, 'SAVED');
    setRegionStatus(statusRegion, `Saved ${result.readback.kind.toLocaleLowerCase()} version ${result.readback.version}.`);
    announce(`Saved ${result.readback.kind.toLocaleLowerCase()} version ${result.readback.version}.`);
    return result;
  } catch (error) {
    showCommandError(statusRegion, error);
    if (error?.status === 409) setSaveState(refs, 'CONFLICT');
    else if (error?.code === 'OFFLINE') setSaveState(refs, 'OFFLINE_NOT_SAVED');
    else setSaveState(refs, 'FAILED');
    return null;
  } finally {
    app.commandPending = false;
    applyCommandAvailability();
  }
}

function showCommandError(region, error) {
  if (!region) return announce(error?.message || 'The command failed.', true);
  replaceChildren(region, commandErrorSummary(error));
}

function commandErrorSummary(error) {
  const conflict = Number(error?.status) === 409 || /CONFLICT/u.test(String(error?.code || ''));
  return el('div', { className: 'command-error', role: 'alert' }, [
    el('strong', { text: conflict ? 'A newer version exists' : 'Not saved' }),
    el('p', { text: text(error?.message, 'The command could not be completed.') }),
    el('p', { className: 'field-help', text: conflict ? 'Your browser text remains in this form. Compare current authority before reapplying or discarding it.' : `Diagnostic: ${text(error?.correlationId || error?.code, 'Unavailable')}` }),
  ]);
}

function setRegionStatus(region, message) {
  if (!region) return;
  replaceChildren(region, el('p', { text: message }));
}

function markDirty(form) {
  app.dirtyForm = form;
  setSaveState(refs, navigator.onLine === false ? 'OFFLINE_NOT_SAVED' : 'UNSAVED');
}

function clearDirty(form) {
  if (app.dirtyForm === form) app.dirtyForm = null;
  setSaveState(refs, app.csrfToken ? 'SAVED' : 'UNAVAILABLE');
}

async function saveBeforeNavigation() {
  const form = app.dirtyForm;
  closeDialog(refs.unsaved);
  if (!form) return completePendingNavigation();
  if (form.id === 'session-capture-form') await submitSessionCapture(form);
  else if (form.id === 'quick-capture-form') await submitQuickCapture(form);
  else if (form.matches('[data-session-review-item], #review-decision-form')) await submitReviewDecision(form);
  else if (form.id === 'attention-decision-form') await submitAttentionDecision(form);
  if (!app.dirtyForm) completePendingNavigation();
}

function discardAndNavigate() {
  if (app.dirtyForm) app.dirtyForm.reset();
  app.dirtyForm = null;
  closeDialog(refs.unsaved);
  completePendingNavigation();
}

function stayOnPage() {
  app.pendingHref = null;
  app.pendingAction = null;
  const dialogId = app.pendingDialogId;
  app.pendingDialogId = null;
  closeDialog(refs.unsaved);
  const dialog = dialogId ? document.getElementById(dialogId) : null;
  if (dialog && !dialog.open) {
    dialog.showModal();
    requestAnimationFrame(() => dialog.querySelector('textarea, input, select, button')?.focus());
  }
}

function completePendingNavigation() {
  const href = app.pendingHref;
  const action = app.pendingAction;
  app.pendingHref = null;
  app.pendingAction = null;
  app.pendingDialogId = null;
  if (href) navigate(href);
  else if (action?.type === 'end-session-review') {
    performEndSessionForReview(action.targetId, action.expectedVersion, refs.actionAnnouncer);
  }
}

function filterStudents() {
  const input = document.getElementById('student-search');
  const queryText = String(input?.value || '').trim().toLocaleLowerCase();
  const rows = [...document.querySelectorAll('.directory-row')];
  let shown = 0;
  rows.forEach((row) => {
    const matches = !queryText || String(row.textContent || '').toLocaleLowerCase().includes(queryText);
    row.hidden = !matches;
    if (matches) shown += 1;
  });
  const status = document.getElementById('student-search-status');
  if (status) status.textContent = `${shown} of ${rows.length} authorized students shown`;
  const empty = document.getElementById('student-filter-empty');
  if (empty) empty.hidden = shown !== 0 || rows.length === 0;
}

function clearStudentSearch() {
  const input = document.getElementById('student-search');
  if (input) input.value = '';
  filterStudents();
  input?.focus();
}

function filterWork() {
  const owner = document.getElementById('work-owner')?.value || '';
  const due = document.getElementById('work-due')?.value || '';
  const queryText = String(document.getElementById('work-search')?.value || '').trim().toLocaleLowerCase();
  const rows = [...document.querySelectorAll('.work-item')];
  let shown = 0;
  rows.forEach((row) => {
    const ownerMatch = !owner || row.dataset.owner === owner;
    const dueMatch = matchDueWindow(row.querySelector('time')?.dateTime, due);
    const textMatch = !queryText || String(row.textContent || '').toLocaleLowerCase().includes(queryText);
    const matches = ownerMatch && dueMatch && textMatch;
    row.hidden = !matches;
    if (matches) shown += 1;
  });
  const status = document.getElementById('work-filter-status');
  if (status) status.textContent = `${shown} of ${rows.length} work items shown`;
  const empty = document.getElementById('work-filter-empty');
  if (empty) empty.hidden = shown !== 0 || rows.length === 0;
}

function clearWorkFilters() {
  document.getElementById('work-owner')?.form?.reset();
  filterWork();
  document.getElementById('work-owner')?.focus();
}

function matchDueWindow(value, filter) {
  if (!filter) return true;
  if (!value) return filter === 'UNDATED';
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (filter === 'OVERDUE') return due < now;
  if (filter === 'TODAY') return due >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && due < endToday;
  if (filter === 'WEEK') return due >= now && due <= new Date(now.valueOf() + 7 * 86_400_000);
  return false;
}

function applyCommandAvailability() {
  const requiresCommand = document.querySelectorAll([
    '[data-action="start-session"]',
    '[data-action="pause-session"]',
    '[data-action="resume-session"]',
    '[data-action="end-session-review"]',
    '[data-action="complete-work-item"]',
    '[data-action="open-attention-decision"]',
    '#session-capture-form button[type="submit"]',
    '#quick-capture-form button[type="submit"]',
    '#attention-decision-form button[type="submit"]',
    '[data-session-review-item] button[type="submit"]',
    '#review-decision-form button[type="submit"]',
  ].join(','));
  requiresCommand.forEach((control) => {
    if (!Object.hasOwn(control.dataset, 'baseDisabled')) {
      control.dataset.baseDisabled = String(control.disabled || control.closest('fieldset')?.disabled === true);
    }
    const policyDisabled = control.dataset.baseDisabled === 'true' || control.closest('fieldset')?.disabled === true;
    control.disabled = policyDisabled || !app.csrfToken || app.commandPending;
    if (!app.csrfToken) control.title = 'Commands unavailable: authenticated command session not established.';
    else if (control.title?.startsWith('Commands unavailable')) control.removeAttribute('title');
  });
}

function indexEvidence(value, parentId = null, depth = 0) {
  if (depth > 20 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => indexEvidence(entry, parentId, depth + 1));
    return;
  }
  if (typeof value !== 'object') return;
  const currentId = typeof value.id === 'string' ? value.id : parentId;
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'evidence' && entry && typeof entry === 'object') {
      if (Array.isArray(entry)) entry.forEach((record) => storeEvidence(record, currentId));
      else storeEvidence(entry, currentId);
    }
    indexEvidence(entry, currentId, depth + 1);
  }
  if (value.sourceLabel && value.origin && value.freshness) storeEvidence(value, currentId);
}

function storeEvidence(evidence, parentId) {
  const id = evidence?.id || parentId || (app.evidence.has('current') ? null : 'current');
  if (id) app.evidence.set(String(id), evidence);
  if (!app.evidence.has('current')) app.evidence.set('current', evidence);
}

function findObjectById(items, id) {
  return Array.isArray(items) ? items.find((item) => String(item?.id) === String(id)) : null;
}

function announce(message, alert = false) {
  refs.actionAnnouncer.setAttribute('role', alert ? 'alert' : 'status');
  refs.actionAnnouncer.textContent = '';
  requestAnimationFrame(() => { refs.actionAnnouncer.textContent = message; });
}

function ensureId(node) {
  if (!node.id) node.id = `cam-focus-${crypto.randomUUID()}`;
  return node.id;
}
