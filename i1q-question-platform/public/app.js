const screen = document.querySelector('#screen');
const title = document.querySelector('#screen-title');
const kicker = document.querySelector('#screen-kicker');
const primaryNav = document.querySelector('#primary-nav');
const navToggle = document.querySelector('#nav-toggle');
const refreshButton = document.querySelector('#refresh-button');
const recordContext = document.querySelector('#record-context');
const globalStatus = document.querySelector('#global-status');
const actionStatus = document.querySelector('#action-status');
const politeAnnouncer = document.querySelector('#polite-announcer');
const assertiveAnnouncer = document.querySelector('#assertive-announcer');
const scenarioControl = document.querySelector('#scenario-control');
const scenarioSelect = document.querySelector('#state-scenario');
const actorIdentity = document.querySelector('#actor-identity');
const environmentMode = document.querySelector('#environment-mode');

const REQUIRED_WORKFLOWS = Object.freeze([
  'dashboard',
  'inventory',
  'source',
  'privacy',
  'transcript',
  'extraction',
  'triage',
  'editor',
  'distractors',
  'evidence',
  'editorial',
  'physician',
  'diff',
  'search',
  'release',
  'incidents',
  'audit',
]);

const WORKFLOW_META = Object.freeze({
  dashboard: ['Operations', 'Dashboard'],
  inventory: ['Sources', 'Corpus inventory'],
  source: ['Sources', 'Source detail'],
  privacy: ['Governance', 'Privacy status'],
  transcript: ['Sources', 'Transcript evidence'],
  extraction: ['Extraction', 'Extraction runs'],
  triage: ['Candidates', 'Candidate triage'],
  editor: ['Authoring', 'Question authoring'],
  distractors: ['Assessment quality', 'Distractor review'],
  evidence: ['Evidence', 'Evidence claims'],
  editorial: ['Review', 'Editorial review'],
  physician: ['Review', 'Physician review'],
  diff: ['History', 'Revision comparison'],
  search: ['Library', 'Search and filters'],
  release: ['Release', 'Release assembly'],
  incidents: ['Operations', 'Incidents'],
  audit: ['Governance', 'Immutable audit trail'],
});

const REQUIRED_STATES = Object.freeze([
  'loading',
  'empty',
  'blocked',
  'unauthorized',
  'error',
  'partial-source',
  'privacy-blocked',
  'rights-blocked',
  'expired-evidence',
  'review-conflict',
  'stale-edit',
  'concurrent-edit',
  'extraction-queued',
  'extraction-running',
  'extraction-failed',
  'extraction-resumable',
]);

const STATE_SCENARIOS = Object.freeze({
  loading: {
    label: 'Loading',
    title: 'Loading is taking longer than expected',
    summary: 'The current safe read is still pending. No command has been accepted yet.',
    remedy: 'Retry the current read. Repeated announcements are limited to state changes.',
    owner: 'Question Platform operator',
    tone: 'info',
  },
  empty: {
    label: 'Empty',
    title: 'No records match this view',
    summary: 'The authorized result set is empty; this is not reported as an error.',
    remedy: 'Clear filters or refresh the current resource route.',
    owner: 'Current operator',
    tone: 'neutral',
  },
  blocked: {
    label: 'Blocked',
    title: 'A required governance gate is blocked',
    summary: 'The protected command remains unavailable and no write has been attempted.',
    remedy: 'Resolve the named owner or gate, then reload the exact record.',
    owner: 'Assigned governance owner',
    tone: 'danger',
  },
  unauthorized: {
    label: 'Unauthorized',
    title: 'This role is not authorized for the requested operation',
    summary: 'No protected data or command result is shown.',
    remedy: 'Return through canonical authentication with the required internal role.',
    owner: 'Identity and access owner',
    tone: 'danger',
  },
  error: {
    label: 'Error',
    title: 'The current view could not be loaded',
    summary: 'The failure is separated from authentication and authorization states.',
    remedy: 'Retry the same safe route. Escalate only if the failure repeats.',
    owner: 'Question Platform operator',
    tone: 'danger',
  },
  'partial-source': {
    label: 'Partial source',
    title: 'Only part of the source package is available',
    summary: 'Available metadata remains inspectable; unavailable transcript or timing content is not inferred.',
    remedy: 'Inspect source detail and request an authorized source refresh.',
    owner: 'Corpus operations owner',
    tone: 'warning',
  },
  'privacy-blocked': {
    label: 'Privacy blocked',
    title: 'Privacy review blocks source use',
    summary: 'Raw source wording remains withheld and downstream extraction is unavailable.',
    remedy: 'Open the redaction record and resolve the named failed class through the privacy workflow.',
    owner: 'Privacy owner',
    tone: 'danger',
  },
  'rights-blocked': {
    label: 'Rights blocked',
    title: 'Source rights do not permit this use',
    summary: 'Extraction, authoring, and release commands remain unavailable.',
    remedy: 'Obtain an authorized rights decision or remove the source from the work item.',
    owner: 'Rights and corpus owner',
    tone: 'danger',
  },
  'expired-evidence': {
    label: 'Expired evidence',
    title: 'Evidence currency has expired',
    summary: 'Existing review history is preserved, but approval and release are blocked.',
    remedy: 'Attach a current authorized claim and require re-review of the exact revision.',
    owner: 'Evidence owner',
    tone: 'danger',
  },
  'review-conflict': {
    label: 'Review conflict',
    title: 'The assigned reviewer has a conflict',
    summary: 'No review verdict can be recorded for this assignment.',
    remedy: 'Reassign the exact revision to an independent qualified reviewer.',
    owner: 'Editorial or medical governance owner',
    tone: 'danger',
  },
  'stale-edit': {
    label: 'Stale edit',
    title: 'A newer immutable revision exists',
    summary: 'Unsaved form content is preserved and has not overwritten the newer revision.',
    remedy: 'Compare the newer revision, then deliberately reapply or discard local edits.',
    owner: 'Current author',
    tone: 'warning',
  },
  'concurrent-edit': {
    label: 'Concurrent edit',
    title: 'The selected record changed during this task',
    summary: 'The pending decision is stopped before it can affect the stale revision.',
    remedy: 'Reload the exact hash, compare changes, and repeat the review when still valid.',
    owner: 'Current reviewer',
    tone: 'warning',
  },
  'extraction-queued': {
    label: 'Extraction queued',
    title: 'Extraction is queued',
    summary: 'The request is accepted but no corpus content has been processed.',
    remedy: 'Inspect the run detail or return later; duplicate queue commands are idempotent.',
    owner: 'Corpus operations owner',
    tone: 'info',
  },
  'extraction-running': {
    label: 'Extraction running',
    title: 'Extraction is running from a checkpoint',
    summary: 'Progress and failures are reported separately; partial output is not treated as complete.',
    remedy: 'Monitor the current checkpoint and wait for a terminal state.',
    owner: 'Corpus operations owner',
    tone: 'info',
  },
  'extraction-failed': {
    label: 'Extraction failed',
    title: 'Extraction stopped before completion',
    summary: 'The failed run remains immutable and no result is promoted.',
    remedy: 'Inspect the safe error code and create an explicit retry run.',
    owner: 'Corpus operations owner',
    tone: 'danger',
  },
  'extraction-resumable': {
    label: 'Extraction resumable',
    title: 'A safe checkpoint is available',
    summary: 'Completed work is preserved and can seed a new resume request.',
    remedy: 'Verify the checkpoint identity, then create an explicit resume run.',
    owner: 'Corpus operations owner',
    tone: 'warning',
  },
});

const REQUIRED_PRIVACY_CLASSES = Object.freeze([
  'NON_DRJ_SPEECH',
  'STUDENT_NAME',
  'STUDENT_OTHER_IDENTIFIER',
  'PATIENT_DIRECT_IDENTIFIER',
  'PATIENT_QUASI_IDENTIFIER',
  'THIRD_PARTY_IDENTITY',
  'IDENTIFYING_CLINICAL_ANECDOTE',
  'SOURCE_METADATA',
]);

const EXTRACTION_FIXTURES = Object.freeze([
  { id: 'run_fixture_queued', status: 'queued', stage: 'GX-0_INVENTORY', processed: 0, failed: 0, checkpoint: 'Awaiting worker' },
  { id: 'run_fixture_running', status: 'running', stage: 'GX-4_CONCEPT_EXTRACTION', processed: 18, failed: 0, checkpoint: 'Synthetic checkpoint 18' },
  { id: 'run_fixture_failed', status: 'failed', stage: 'GX-5_CANDIDATE_QUESTION_DETECTION', processed: 18, failed: 1, checkpoint: 'Safe error: fixture_parse_failed' },
  { id: 'run_fixture_resumable', status: 'resumable', stage: 'GX-5_CANDIDATE_QUESTION_DETECTION', processed: 18, failed: 1, checkpoint: 'Synthetic checkpoint 18 retained' },
]);

const state = {
  currentScreen: 'dashboard',
  scenario: 'live',
  renderToken: 0,
  health: null,
  session: null,
  dashboard: null,
  selectedInventorySourceId: null,
  selectedSourceRecordId: null,
  selectedTranscriptArtifactId: null,
  selectedRunId: 'run_fixture_resumable',
  selectedCandidateId: null,
  selectedCandidateDetail: null,
  selectedRevisionId: null,
  selectedAuditId: null,
  editorRevision: null,
  editorDirty: false,
  extractionStatuses: new Map(),
  syntheticRuns: [],
  inventoryFilter: { query: '', status: 'all' },
  search: { query: '', status: 'all', sort: 'newest', page: 0 },
  auditFilter: { query: '', entity: 'all' },
};

let controlSequence = 0;

class ApiError extends Error {
  constructor(code, status) {
    super(code || `request_failed_${status}`);
    this.name = 'ApiError';
    this.code = code || 'request_rejected';
    this.status = status;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function humanize(value) {
  return String(value || 'not supplied').replaceAll('_', ' ').replaceAll('-', ' ');
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatTimestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
    : 'Not supplied';
}

function shortHash(value) {
  const text = String(value || 'Not supplied');
  return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

function toneForStatus(value) {
  const status = String(value || '').toLowerCase();
  if (/(pass|clear|current|ready|complete|approved|verified|available)/u.test(status)) return 'green';
  if (/(block|fail|error|reject|expire|conflict|withdraw|missing)/u.test(status)) return 'red';
  if (/(running|active|progress)/u.test(status)) return 'blue';
  return 'amber';
}

function badge(label, tone = toneForStatus(label)) {
  return `<span class="badge badge-${tone}">${escapeHtml(humanize(label))}</span>`;
}

function stateNotice(id, titleText, message, remedy, tone = 'warning') {
  const headingId = `state-heading-${++controlSequence}`;
  return `
    <section class="state-notice state-${tone}" data-state="${escapeHtml(id)}" aria-labelledby="${headingId}">
      <div>
        <p class="state-label">${escapeHtml(humanize(id))}</p>
        <h2 id="${headingId}">${escapeHtml(titleText)}</h2>
        <p>${escapeHtml(message)}</p>
      </div>
      <p class="state-remedy"><strong>Recovery</strong><span>${escapeHtml(remedy)}</span></p>
    </section>`;
}

function emptyState(titleText, message) {
  return `
    <div class="empty-state" data-state="empty" role="status">
      <div><strong>${escapeHtml(titleText)}</strong><p>${escapeHtml(message)}</p></div>
    </div>`;
}

function disabledCommand(label, reason, { tone = '', className = '' } = {}) {
  const reasonId = `command-reason-${++controlSequence}`;
  const toneClass = tone ? ` button-${tone}` : '';
  return `
    <div class="disabled-command ${escapeHtml(className)}">
      <button class="button${toneClass}" type="button" data-action="blocked-command" aria-disabled="true" aria-describedby="${reasonId}">${escapeHtml(label)}</button>
      <p class="control-reason" id="${reasonId}">${escapeHtml(reason)}</p>
    </div>`;
}

function detailList(entries, className = '') {
  return `<dl class="detail-list ${escapeHtml(className)}">${entries.map(([term, description]) => `
    <div><dt>${escapeHtml(term)}</dt><dd>${description}</dd></div>`).join('')}</dl>`;
}

function selectedOption(value, expected) {
  return value === expected ? ' selected' : '';
}

function actionKey(prefix = 'action') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && state.session?.session?.csrf_token) {
    requestHeaders['X-CSRF-Token'] = state.session.session.csrf_token;
  }
  const options = { method, headers: requestHeaders };
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error, response.status);
  }
  return payload;
}

function listResource(entityType, limit = 200) {
  return api(`/api/v1/resources/${encodeURIComponent(entityType)}?limit=${limit}`);
}

function getResource(entityType, id) {
  return api(`/api/v1/resources/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`);
}

function resolveInventorySource(rows) {
  const selected = rows.find((row) => row.id === state.selectedInventorySourceId) || null;
  if (selected) return selected;
  if (rows.length !== 1) return null;
  state.selectedInventorySourceId = rows[0].id;
  return rows[0];
}

function resolveSourceRecord(rows, inventory) {
  const selected = rows.find((row) => row.id === state.selectedSourceRecordId) || null;
  const matchesInventory = (row) => !inventory || [
    row.canonical_source_id,
    row.video_id,
  ].includes(inventory.canonical_video_id);
  if (selected && matchesInventory(selected)) return selected;
  if (!inventory) return null;
  const matches = rows.filter(matchesInventory);
  if (matches.length !== 1) return null;
  state.selectedSourceRecordId = matches[0].id;
  return matches[0];
}

function announce(message, assertive = false) {
  const region = assertive ? assertiveAnnouncer : politeAnnouncer;
  region.textContent = '';
  window.setTimeout(() => { region.textContent = message; }, 20);
}

function showActionStatus(message, { tone = 'success', focus = false, assertive = false } = {}) {
  actionStatus.hidden = false;
  actionStatus.className = `action-status action-status-${tone}`;
  actionStatus.setAttribute('role', assertive ? 'alert' : 'status');
  actionStatus.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  actionStatus.textContent = message;
  if (focus) actionStatus.focus({ preventScroll: true });
}

function clearActionStatus() {
  actionStatus.hidden = true;
  actionStatus.textContent = '';
}

function setContext(entries = []) {
  if (!entries.length) {
    recordContext.hidden = true;
    recordContext.innerHTML = '';
    return;
  }
  recordContext.hidden = false;
  recordContext.innerHTML = detailList(entries, 'context-list');
}

function setGlobalStatus(data) {
  const unassigned = safeArray(data?.governance_unassigned);
  const blocked = String(data?.production_gate || '').includes('BLOCKED') || unassigned.length > 0;
  globalStatus.className = `status-banner ${blocked ? 'status-warning' : 'status-neutral'}`;
  globalStatus.innerHTML = blocked
    ? `<strong>Internal release gate blocked</strong><span>${unassigned.length} governance owner${unassigned.length === 1 ? '' : 's'} unassigned. Student, STAT, and Drills consumers remain off.</span>`
    : '<strong>Internal review workspace</strong><span>Student, STAT, and Drills consumers remain off unless separately authorized.</span>';
}

function scenarioTemplate(id) {
  const fixture = STATE_SCENARIOS[id];
  const headingId = `scenario-${escapeHtml(id)}-heading`;
  const role = ['unauthorized', 'error'].includes(id) ? 'alert' : 'status';
  return `
    <section class="scenario-state state-${escapeHtml(fixture.tone)}" data-state="${escapeHtml(id)}" role="${role}" aria-labelledby="${headingId}">
      <div class="scenario-heading">
        ${badge('Synthetic state fixture', 'blue')}
        <p class="state-label">${escapeHtml(fixture.label)}</p>
        <h2 id="${headingId}" tabindex="-1">${escapeHtml(fixture.title)}</h2>
        <p>${escapeHtml(fixture.summary)}</p>
      </div>
      ${detailList([
        ['Recovery', escapeHtml(fixture.remedy)],
        ['Owner', escapeHtml(fixture.owner)],
        ['Data boundary', 'Non-clinical local UI fixture; not release evidence'],
      ])}
      <button class="button button-primary" type="button" data-action="exit-scenario">Retry live route</button>
    </section>`;
}

function renderError(error) {
  const unauthorized = [401, 403].includes(error?.status);
  const stateId = unauthorized ? 'unauthorized' : 'error';
  const heading = unauthorized ? 'Access unavailable' : 'View unavailable';
  const remedy = unauthorized
    ? 'Return through canonical authentication with the required internal role.'
    : 'Retry the same safe route. No previous record was changed.';
  return `
    <section class="error-state" data-state="${stateId}" role="alert" aria-labelledby="view-error-heading">
      <div>
        <strong id="view-error-heading" tabindex="-1">${heading}</strong>
        <p>${escapeHtml(humanize(error?.code || error?.message || 'request failed'))}</p>
        <p>${escapeHtml(remedy)}</p>
        <button class="button" type="button" data-action="retry-view">Retry</button>
      </div>
    </section>`;
}

async function dashboardTemplate() {
  const [data, governance, flagsPage] = await Promise.all([
    api('/api/v1/dashboard'),
    api('/api/v1/governance'),
    listResource('feature_flags'),
  ]);
  state.dashboard = data;
  setGlobalStatus(data);
  const metrics = [
    ['Inventory sources', data.inventory_sources],
    ['Extraction jobs', data.extraction_jobs],
    ['Candidates', data.candidates],
    ['Review assignments', data.review_assignments],
    ['Blocked releases', data.blocked_releases],
    ['Incidents', data.incidents],
  ];
  const blockers = Object.entries(governance).filter(([, owner]) => owner === null);
  const flags = new Map(flagsPage.rows.map((row) => [row.key, row.enabled === true]));
  const featureFlags = [
    ['Internal platform', 'internal_platform_enabled', true],
    ['Internal review', 'internal_review_enabled', true],
    ['Student content', 'student_content_enabled', false],
    ['Student release', 'student_release_enabled', false],
    ['STAT adapter', 'stat_adapter_enabled', false],
    ['Drills adapter', 'drills_adapter_enabled', false],
  ];
  return {
    context: [
      ['Workspace', 'Question Platform'],
      ['Data class', 'Local synthetic only'],
      ['Release gate', badge(data.production_gate || 'not supplied')],
    ],
    markup: `
      <div class="metrics-grid">${metrics.map(([label, value]) => `
        <article class="metric"><span class="label">${escapeHtml(label)}</span><strong>${Number(value) || 0}</strong><small>Authorized API count</small></article>`).join('')}</div>
      <div class="layout-two">
        <section class="panel" aria-labelledby="governance-heading">
          <div class="panel-header"><h2 id="governance-heading">Governance owners</h2>${badge(blockers.length ? 'Blocked' : 'Assigned')}</div>
          ${blockers.length ? blockers.map(([slot]) => `
            <div class="owner-blocker"><strong>${escapeHtml(humanize(slot))}</strong><span class="muted">Owner unassigned</span>${badge('Blocking', 'red')}</div>`).join('') : emptyState('No unassigned owners', 'The governance route returned no unassigned slots.')}
        </section>
        <section class="panel" aria-labelledby="consumer-heading">
          <h2 id="consumer-heading">Consumer guardrails</h2>
          <ul class="status-list">${featureFlags.map(([label, key, internal]) => {
            const enabled = flags.get(key) === true;
            const tone = enabled ? (internal ? 'green' : 'red') : (internal ? 'amber' : 'green');
            return `<li><span>${escapeHtml(label)}</span>${badge(enabled ? 'On' : 'Off', tone)}</li>`;
          }).join('')}</ul>
          <div class="action-row compact-actions">
            <button class="button" type="button" data-nav-screen="extraction">Open extraction queue</button>
            <button class="button" type="button" data-nav-screen="audit">Inspect audit trail</button>
          </div>
        </section>
      </div>`,
  };
}

async function inventoryTemplate() {
  const page = await listResource('inventory_sources');
  const query = state.inventoryFilter.query.trim().toLowerCase();
  const status = state.inventoryFilter.status;
  const rows = page.rows.filter((row) => {
    const searchable = `${row.title || ''} ${row.canonical_video_id || ''} ${row.id || ''}`.toLowerCase();
    const matchesQuery = !query || searchable.includes(query);
    const partial = !row.transcript_available || !row.vtt_available || !row.nodes_available;
    const blocked = !['cleared_for', 'fixture_only'].includes(row.rights_status) || !['pass', 'pass_with_redactions'].includes(row.privacy_status);
    const matchesStatus = status === 'all' || (status === 'partial' && partial) || (status === 'blocked' && blocked) || (status === 'ready' && !partial && !blocked);
    return matchesQuery && matchesStatus;
  });
  return {
    context: [['Result count', String(rows.length)], ['Data boundary', 'Sanitized inventory metadata']],
    markup: `
      <section class="panel" aria-labelledby="inventory-heading">
        <div class="toolbar">
          <div><h2 id="inventory-heading">Authorized source records</h2><span class="muted">${rows.length} of ${page.total} visible</span></div>
          <button class="button" type="button" data-action="retry-view">Refresh inventory</button>
        </div>
        <form id="inventory-filter-form" class="filters filters-three" role="search">
          <label>Search sources<input name="query" type="search" value="${escapeHtml(state.inventoryFilter.query)}" autocomplete="off"></label>
          <label>Availability<select name="status">
            <option value="all"${selectedOption(status, 'all')}>All records</option>
            <option value="ready"${selectedOption(status, 'ready')}>Complete and ready</option>
            <option value="partial"${selectedOption(status, 'partial')}>Partial source</option>
            <option value="blocked"${selectedOption(status, 'blocked')}>Privacy or rights blocked</option>
          </select></label>
          <button class="button button-primary filter-submit" type="submit">Apply filters</button>
        </form>
        ${rows.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Source inventory table"><table>
          <thead><tr><th scope="col">Source</th><th scope="col">Transcript</th><th scope="col">VTT</th><th scope="col">Nodes</th><th scope="col">Rights</th><th scope="col">Privacy</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
          <tbody>${rows.map((row) => `<tr>
            <th scope="row"><strong>${escapeHtml(row.title || 'Untitled source')}</strong><br><span class="muted hash-text">${escapeHtml(row.canonical_video_id || row.id)}</span></th>
            <td>${badge(row.transcript_available ? 'Available' : 'Missing')}</td>
            <td>${badge(row.vtt_available ? 'Available' : 'Missing')}</td>
            <td>${badge(row.nodes_available ? 'Available' : 'Missing')}</td>
            <td>${badge(row.rights_status || 'Not supplied')}</td>
            <td>${badge(row.privacy_status || 'Not supplied')}</td>
            <td><button class="button button-small" type="button" data-action="open-source" data-id="${escapeHtml(row.id)}">Open details</button></td>
          </tr>`).join('')}</tbody>
        </table></div>` : emptyState('No sources match', 'Clear the current filters or refresh the inventory route.')}
      </section>`,
  };
}

async function sourceTemplate() {
  const [sourcesPage, inventoryPage, rightsPage, privacyPage] = await Promise.all([
    listResource('source_records'),
    listResource('inventory_sources'),
    listResource('rights_records'),
    listResource('privacy_redaction_records'),
  ]);
  const inventory = resolveInventorySource(inventoryPage.rows);
  const source = resolveSourceRecord(sourcesPage.rows, inventory);
  if (!source && !inventory) {
    return { context: [], markup: emptyState('Select one source record', 'Open an authorized inventory row before inspecting source details.') };
  }
  const rights = rightsPage.rows.find((row) => row.id === source?.rights_record_id) || null;
  const privacy = privacyPage.rows.find((row) => row.id === source?.privacy_redaction_record_id) || null;
  const isPartial = inventory && (!inventory.transcript_available || !inventory.vtt_available || !inventory.nodes_available);
  const privacyBlocked = privacy && !['pass', 'pass_with_redactions'].includes(privacy.status);
  const rightsBlocked = rights && rights.rights_status !== 'cleared_for';
  const notices = [
    !source ? stateNotice('lineage-error', 'Source lineage is unresolved', 'No unique source record matches the selected inventory record.', 'Resolve the canonical video identity before using privacy, transcript, or extraction evidence.', 'danger') : '',
    isPartial ? stateNotice('partial-source', 'Source package is incomplete', 'One or more transcript, VTT, or node assets are unavailable.', 'Inspect the available metadata and request an authorized corpus refresh.') : '',
    privacyBlocked ? stateNotice('privacy-blocked', 'Privacy decision blocks use', 'The linked redaction record is not cleared.', 'Open Privacy status and resolve the failed class before extraction.', 'danger') : '',
    rightsBlocked ? stateNotice('rights-blocked', 'Rights decision blocks use', 'The linked rights record does not permit this use.', 'Obtain an authorized rights decision or remove this source.', 'danger') : '',
  ].join('');
  const sourceTitle = source?.title || inventory?.title || 'Untitled source';
  return {
    context: [
      ['Source', escapeHtml(sourceTitle)],
      ['Source record', `<span class="hash-text">${escapeHtml(source?.id || inventory?.id)}</span>`],
      ['Rights', badge(rights?.rights_status || inventory?.rights_status || 'Not supplied')],
      ['Privacy', badge(privacy?.status || inventory?.privacy_status || 'Not supplied')],
    ],
    markup: `
      ${notices}
      <div class="layout-two">
        <section class="panel" aria-labelledby="source-identity-heading">
          <div class="panel-header"><h2 id="source-identity-heading">Source identity</h2>${badge(source?.source_type || 'Inventory only', 'blue')}</div>
          ${detailList([
            ['Title', escapeHtml(sourceTitle)],
            ['Source record ID', `<span class="hash-text">${escapeHtml(source?.id || 'Not supplied')}</span>`],
            ['Canonical video ID', `<span class="hash-text">${escapeHtml(inventory?.canonical_video_id || 'Not supplied')}</span>`],
            ['Source hash', `<span class="hash-text" title="${escapeHtml(source?.source_hash || '')}">${escapeHtml(shortHash(source?.source_hash))}</span>`],
            ['Record hash', `<span class="hash-text" title="${escapeHtml(source?.content_hash || '')}">${escapeHtml(shortHash(source?.content_hash))}</span>`],
            ['Created', escapeHtml(formatTimestamp(source?.created_at || inventory?.created_at))],
            ['Private source content', 'Not rendered by this shell'],
          ])}
        </section>
        <aside class="panel" aria-labelledby="source-gates-heading">
          <h2 id="source-gates-heading">Use gates</h2>
          ${detailList([
            ['Rights record', `<span class="hash-text">${escapeHtml(rights?.id || 'Not supplied')}</span>`],
            ['Rights status', badge(rights?.rights_status || inventory?.rights_status || 'Not supplied')],
            ['Allowed uses', escapeHtml(safeArray(rights?.allowed_uses).map(humanize).join(', ') || 'Not supplied')],
            ['Privacy record', `<span class="hash-text">${escapeHtml(privacy?.id || 'Not supplied')}</span>`],
            ['Privacy status', badge(privacy?.status || inventory?.privacy_status || 'Not supplied')],
          ])}
          <div class="action-row compact-actions">
            <button class="button" type="button" data-nav-screen="privacy">Open privacy record</button>
            <button class="button" type="button" data-nav-screen="transcript">Open transcript evidence</button>
            <button class="button" type="button" data-nav-screen="extraction">Open extraction runs</button>
          </div>
        </aside>
      </div>`,
  };
}

async function privacyTemplate() {
  const [privacyPage, sourcesPage, inventoryPage] = await Promise.all([
    listResource('privacy_redaction_records'),
    listResource('source_records'),
    listResource('inventory_sources'),
  ]);
  const inventory = resolveInventorySource(inventoryPage.rows);
  const source = resolveSourceRecord(sourcesPage.rows, inventory);
  if (!source) {
    return { context: [], markup: emptyState('Privacy lineage is unresolved', 'Select an inventory source with one canonical source-record match before reviewing privacy status.') };
  }
  const record = privacyPage.rows.find((row) => row.id === source.privacy_redaction_record_id) || null;
  if (!record) {
    return { context: [], markup: emptyState('No privacy record is available', 'No authorized redaction decision was returned.') };
  }
  const linkedSources = sourcesPage.rows.filter((row) => row.privacy_redaction_record_id === record.id);
  const metrics = record.required_class_metrics && typeof record.required_class_metrics === 'object'
    ? record.required_class_metrics
    : {};
  const blocked = !['pass', 'pass_with_redactions'].includes(record.status);
  return {
    context: [
      ['Privacy record', `<span class="hash-text">${escapeHtml(record.id)}</span>`],
      ['Decision', badge(record.status || 'Not supplied')],
      ['Linked sources', String(linkedSources.length)],
    ],
    markup: `
      ${blocked ? stateNotice('privacy-blocked', 'Privacy clearance is required', 'The current redaction decision blocks source use.', 'Resolve the failed class through the governed privacy service.', 'danger') : ''}
      <div class="layout-two">
        <section class="panel" aria-labelledby="privacy-classes-heading">
          <div class="panel-header"><h2 id="privacy-classes-heading">Required redaction classes</h2>${badge(record.status || 'Not supplied')}</div>
          <div class="table-wrap" tabindex="0" role="region" aria-label="Privacy class results"><table>
            <thead><tr><th scope="col">Class</th><th scope="col">Result</th><th scope="col">Evidence</th></tr></thead>
            <tbody>${REQUIRED_PRIVACY_CLASSES.map((privacyClass) => {
              const metric = metrics[privacyClass];
              const result = typeof metric === 'object' ? metric.status : metric;
              return `<tr><th scope="row">${escapeHtml(humanize(privacyClass))}</th><td>${badge(result || 'Not supplied')}</td><td>${metric === undefined ? 'No class metric returned' : 'Class metric present in authorized record'}</td></tr>`;
            }).join('')}</tbody>
          </table></div>
        </section>
        <aside class="panel" aria-labelledby="privacy-decision-heading">
          <h2 id="privacy-decision-heading">Decision record</h2>
          ${detailList([
            ['Immutable record', `<span class="hash-text">${escapeHtml(record.id)}</span>`],
            ['Content hash', `<span class="hash-text" title="${escapeHtml(record.content_hash || '')}">${escapeHtml(shortHash(record.content_hash))}</span>`],
            ['Created', escapeHtml(formatTimestamp(record.created_at))],
            ['Source wording', 'Withheld from this decision summary'],
          ])}
          ${disabledCommand('Record privacy decision', 'No governed privacy-decision write route is exposed to the current shell.', { tone: 'primary' })}
        </aside>
      </div>`,
  };
}

async function transcriptTemplate() {
  const [artifactsPage, segmentsPage, inventoryPage, sourcesPage] = await Promise.all([
    listResource('transcript_artifacts'),
    listResource('normalized_transcript_segments'),
    listResource('inventory_sources'),
    listResource('source_records'),
  ]);
  const inventory = resolveInventorySource(inventoryPage.rows);
  const source = resolveSourceRecord(sourcesPage.rows, inventory);
  if (!inventory) {
    return { context: [], markup: emptyState('Select one source record', 'Open an authorized inventory row before inspecting transcript evidence.') };
  }
  const artifacts = artifactsPage.rows.filter((artifact) => artifact.inventory_source_id === inventory.id);
  let selectedArtifact = artifacts.find((artifact) => artifact.id === state.selectedTranscriptArtifactId) || null;
  if (!selectedArtifact && artifacts.length === 1) {
    [selectedArtifact] = artifacts;
    state.selectedTranscriptArtifactId = selectedArtifact.id;
  }
  const segments = selectedArtifact
    ? segmentsPage.rows.filter((segment) => segment.transcript_artifact_id === selectedArtifact.id)
    : [];
  const ambiguousArtifacts = artifacts.length > 1 && !selectedArtifact;
  const partial = !inventory?.transcript_available || !inventory?.vtt_available || segments.length === 0;
  return {
    context: [
      ['Source', escapeHtml(source?.title || inventory.title)],
      ['Inventory record', `<span class="hash-text">${escapeHtml(inventory.id)}</span>`],
      ['Source record', `<span class="hash-text">${escapeHtml(source?.id || 'Unresolved')}</span>`],
      ['Transcript artifact', `<span class="hash-text">${escapeHtml(selectedArtifact?.id || 'Not selected')}</span>`],
      ['Sanitized segments', String(segments.length)],
      ['Availability', badge(partial ? 'Partial source' : 'Available')],
    ],
    markup: `
      ${!source ? stateNotice('lineage-error', 'Source lineage is unresolved', 'No unique source record matches this inventory record.', 'Resolve the canonical source identity before extraction.', 'danger') : ''}
      ${ambiguousArtifacts ? stateNotice('lineage-error', 'Select one transcript artifact', 'Multiple transcript artifacts are linked to this inventory record.', 'Choose the exact artifact whose sanitized segments should be reviewed.', 'warning') : ''}
      ${partial ? stateNotice('partial-source', 'Transcript evidence is incomplete', 'The safe routes did not return a complete transcript and timing package.', 'Inspect Source detail, then request an authorized corpus refresh.') : ''}
      ${artifacts.length > 1 ? `<section class="panel" aria-labelledby="transcript-artifacts-heading">
        <div class="panel-header"><h2 id="transcript-artifacts-heading">Linked transcript artifacts</h2>${badge(`${artifacts.length} available`)}</div>
        <div class="action-row">${artifacts.map((artifact) => `<button class="button button-small" type="button" data-action="select-transcript-artifact" data-id="${escapeHtml(artifact.id)}"${artifact.id === selectedArtifact?.id ? ' aria-current="true"' : ''}>${escapeHtml(artifact.id)}</button>`).join('')}</div>
      </section>` : ''}
      <div class="layout-two">
        <section class="panel" aria-labelledby="transcript-segments-heading">
          <div class="panel-header"><h2 id="transcript-segments-heading">Sanitized evidence segments</h2>${badge(segments.length ? `${segments.length} returned` : 'No segments')}</div>
          ${segments.length ? `<ol class="transcript-list">${segments.map((segment) => `
            <li>
              <div class="transcript-meta"><span>${escapeHtml(segment.start_seconds ?? 'Time unavailable')}</span><strong>${escapeHtml(segment.speaker_label || 'Speaker unavailable')}</strong></div>
              <p>${escapeHtml(segment.redacted_text || 'Redacted segment wording was not supplied.')}</p>
              <span class="muted hash-text">${escapeHtml(segment.id)}</span>
            </li>`).join('')}</ol>` : emptyState('No sanitized transcript segments', 'Source wording is not inferred from inventory metadata.')}
        </section>
        <aside class="panel" aria-labelledby="transcript-boundary-heading">
          <h2 id="transcript-boundary-heading">Evidence boundary</h2>
          ${detailList([
            ['Transcript available', badge(inventory?.transcript_available ? 'Available' : 'Missing')],
            ['VTT available', badge(inventory?.vtt_available ? 'Available' : 'Missing')],
            ['Nodes available', badge(inventory?.nodes_available ? 'Available' : 'Missing')],
            ['Raw source wording', 'Not rendered by this shell'],
            ['Answer wording', 'Not returned by the safe generic read route'],
          ])}
          <div class="action-row compact-actions">
            <button class="button" type="button" data-nav-screen="source">Open source detail</button>
            <button class="button" type="button" data-nav-screen="privacy">Open privacy status</button>
          </div>
        </aside>
      </div>`,
  };
}

function extractionRow(run, isFixture = false) {
  const status = state.extractionStatuses.get(run.id) || run.status || 'queued';
  return `
    <tr data-state="extraction-${escapeHtml(status)}">
      <th scope="row"><strong>${escapeHtml(run.id)}</strong><br><span class="muted">${isFixture ? 'Non-clinical UI fixture' : 'API-backed synthetic job'}</span></th>
      <td>${badge(status)}</td>
      <td>${escapeHtml(run.stage || run.job_type || 'Queued for assignment')}</td>
      <td>${Number(run.processed ?? run.requested_count) || 0}</td>
      <td>${Number(run.failed) || 0}</td>
      <td><button class="button button-small" type="button" data-action="select-run" data-id="${escapeHtml(run.id)}">View details</button></td>
    </tr>`;
}

async function extractionTemplate() {
  const [jobsPage, runsPage, checkpointsPage] = await Promise.all([
    listResource('batch_jobs'),
    listResource('extraction_runs'),
    listResource('job_checkpoints'),
  ]);
  const apiRuns = [
    ...jobsPage.rows.map((job) => ({ ...job, status: state.extractionStatuses.get(job.id) || 'queued' })),
    ...runsPage.rows,
  ];
  const allRuns = [...state.syntheticRuns, ...EXTRACTION_FIXTURES, ...apiRuns];
  const selected = allRuns.find((run) => run.id === state.selectedRunId) || allRuns[0];
  state.selectedRunId = selected?.id || null;
  const selectedStatus = state.extractionStatuses.get(selected?.id) || selected?.status || 'queued';
  const checkpoint = checkpointsPage.rows.find((entry) => entry.batch_job_id === selected?.id);
  const isFixture = EXTRACTION_FIXTURES.some((entry) => entry.id === selected?.id);
  const recoveryCommand = selectedStatus === 'failed'
    ? `<button class="button button-danger" type="button" data-action="retry-extraction" data-id="${escapeHtml(selected.id)}">Retry as new run</button>`
    : selectedStatus === 'resumable'
      ? `<button class="button button-primary" type="button" data-action="resume-extraction" data-id="${escapeHtml(selected.id)}">Resume from checkpoint</button>`
      : '';
  return {
    context: [
      ['Selected run', `<span class="hash-text">${escapeHtml(selected?.id || 'None')}</span>`],
      ['Status', badge(selectedStatus)],
      ['Checkpoint', escapeHtml(checkpoint?.cursor || selected?.checkpoint || 'Not supplied')],
      ['Corpus boundary', 'Non-clinical synthetic fixture'],
    ],
    markup: `
      <div class="layout-run">
        <section class="panel" aria-labelledby="run-queue-heading">
          <div class="toolbar">
            <div><h2 id="run-queue-heading">Run queue</h2><span class="muted">${allRuns.length} runs; four deterministic recovery fixtures</span></div>
            <button class="button button-primary" type="button" data-action="queue-extraction">Queue synthetic extraction</button>
          </div>
          <div class="table-wrap" tabindex="0" role="region" aria-label="Extraction run queue"><table>
            <thead><tr><th scope="col">Run</th><th scope="col">Status</th><th scope="col">Stage</th><th scope="col">Processed</th><th scope="col">Failed</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
            <tbody>${EXTRACTION_FIXTURES.map((run) => extractionRow(run, true)).join('')}${apiRuns.map((run) => extractionRow(run)).join('')}</tbody>
          </table></div>
        </section>
        <aside class="panel run-detail" aria-labelledby="run-detail-heading">
          <div class="panel-header"><h2 id="run-detail-heading">Run detail</h2>${badge(selectedStatus)}</div>
          ${detailList([
            ['Run ID', `<span class="hash-text">${escapeHtml(selected?.id || 'Not supplied')}</span>`],
            ['State source', isFixture ? 'Non-clinical UI recovery fixture' : 'Safe batch job API'],
            ['Stage', escapeHtml(selected?.stage || selected?.job_type || 'Not supplied')],
            ['Processed', String(Number(selected?.processed ?? checkpoint?.processed_count) || 0)],
            ['Failed', String(Number(selected?.failed ?? checkpoint?.failed_count) || 0)],
            ['Checkpoint', escapeHtml(checkpoint?.cursor || selected?.checkpoint || 'Not supplied')],
            ['Source content', 'No corpus content is attached to this fixture'],
          ])}
          ${recoveryCommand ? `<div class="action-row">${recoveryCommand}</div>` : '<p class="muted">Retry and resume commands appear only for eligible terminal states.</p>'}
        </aside>
      </div>`,
  };
}

function candidateMetadata(candidate) {
  return [
    ['Candidate ID', `<span class="hash-text">${escapeHtml(candidate.id || 'Not supplied')}</span>`],
    ['Source record', `<span class="hash-text">${escapeHtml(candidate.source_record_id || 'Not supplied')}</span>`],
    ['Type', escapeHtml(humanize(candidate.candidate_type || candidate.type || 'Not supplied'))],
    ['Confidence', candidate.confidence === undefined ? 'Not supplied' : escapeHtml(candidate.confidence)],
    ['Status', badge(candidate.status || 'Not supplied')],
    ['Created', escapeHtml(formatTimestamp(candidate.created_at))],
    ['Answer/source wording', 'Withheld from the triage summary'],
  ];
}

async function triageTemplate() {
  const [candidatesPage, flagsPage] = await Promise.all([
    listResource('extraction_candidates'),
    listResource('candidate_quality_flags'),
  ]);
  const selected = state.selectedCandidateDetail
    || candidatesPage.rows.find((candidate) => candidate.id === state.selectedCandidateId)
    || null;
  const actionReason = 'No governed candidate assignment, quarantine, or rejection write route is exposed to this shell.';
  return {
    context: [
      ['Queue count', String(candidatesPage.total)],
      ['Selected candidate', `<span class="hash-text">${escapeHtml(selected?.id || 'None')}</span>`],
      ['Quality flags', String(flagsPage.total)],
    ],
    markup: `
      <div class="layout-two">
        <section class="panel" aria-labelledby="candidate-queue-heading">
          <div class="toolbar"><div><h2 id="candidate-queue-heading">Sanitized candidate queue</h2><span class="muted">Answer and source wording are not shown</span></div><button class="button" type="button" data-action="retry-view">Refresh queue</button></div>
          ${candidatesPage.rows.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Candidate triage queue"><table>
            <thead><tr><th scope="col">Candidate</th><th scope="col">Type</th><th scope="col">Confidence</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
            <tbody>${candidatesPage.rows.map((candidate) => `<tr><th scope="row"><span class="hash-text">${escapeHtml(candidate.id)}</span></th><td>${escapeHtml(humanize(candidate.candidate_type || candidate.type))}</td><td>${escapeHtml(candidate.confidence ?? 'Not supplied')}</td><td>${badge(candidate.status || 'Not supplied')}</td><td><button class="button button-small" type="button" data-action="open-candidate" data-id="${escapeHtml(candidate.id)}">Inspect</button></td></tr>`).join('')}</tbody>
          </table></div>` : emptyState('No candidates are queued', 'The authorized extraction candidate route returned no records.')}
        </section>
        <aside class="panel" aria-labelledby="candidate-detail-heading">
          <h2 id="candidate-detail-heading">Candidate detail</h2>
          ${selected ? detailList(candidateMetadata(selected)) : '<p class="muted">Select a candidate to inspect sanitized metadata.</p>'}
          <div class="command-stack">
            ${disabledCommand('Assign candidate', actionReason)}
            ${disabledCommand('Quarantine candidate', actionReason)}
            ${disabledCommand('Reject candidate', actionReason, { tone: 'danger' })}
          </div>
        </aside>
      </div>`,
  };
}

function choiceEditor(choice) {
  const key = choice.key;
  return `
    <fieldset class="choice-editor">
      <legend>Choice ${escapeHtml(key)}</legend>
      <label>Choice text<input name="choice_${escapeHtml(key)}" value="${escapeHtml(choice.text || '')}" required></label>
      <div class="choice-rationale">
        <label>Why it may be tempting<input name="tempting_${escapeHtml(key)}" autocomplete="off" required></label>
        <label>Why it is wrong<input name="wrong_${escapeHtml(key)}" autocomplete="off" required></label>
        <label>Misconception ID<input name="misconception_${escapeHtml(key)}" autocomplete="off" required></label>
      </div>
    </fieldset>`;
}

async function editorTemplate() {
  const [revisionsPage, sourcesPage, claimsPage] = await Promise.all([
    listResource('item_revisions'),
    listResource('source_records'),
    listResource('evidence_claims'),
  ]);
  const revisions = [...revisionsPage.rows].sort((left, right) => Number(right.revision_number) - Number(left.revision_number));
  const revision = revisions.find((row) => row.id === state.selectedRevisionId) || revisions[0] || null;
  if (!revision) {
    state.editorRevision = null;
    return { context: [], markup: emptyState('No authoring revision is available', 'Create an item through the governed content workflow before authoring.') };
  }
  state.selectedRevisionId = revision.id;
  state.editorRevision = revision;
  const choices = ['A', 'B', 'C', 'D'].map((key) => revision.choices?.find((choice) => choice.key === key) || { key, text: '' });
  const hasLineage = safeArray(revision.source_ids).length > 0 && safeArray(revision.evidence_claim_ids).length > 0;
  const isDraft = revision.workflow_status === 'draft';
  const sourceLabels = safeArray(revision.source_ids).map((id) => sourcesPage.rows.find((row) => row.id === id)?.title || id);
  const claimLabels = safeArray(revision.evidence_claim_ids).map((id) => claimsPage.rows.find((row) => row.id === id)?.id || id);
  return {
    context: [
      ['Item', `<span class="hash-text">${escapeHtml(revision.item_id)}</span>`],
      ['Immutable revision', `<span class="hash-text">${escapeHtml(revision.id)}</span>`],
      ['Revision hash', `<span class="hash-text" title="${escapeHtml(revision.content_hash || '')}">${escapeHtml(shortHash(revision.content_hash))}</span>`],
      ['Source', escapeHtml(sourceLabels.join(', ') || 'Not supplied')],
      ['Role', 'Author'],
      ['Medical status', badge(revision.medical_validation_status || 'Not validated')],
    ],
    markup: `
      <div id="editor-conflict"></div>
      <form id="editor-form" class="editor-grid" data-revision-id="${escapeHtml(revision.id)}" data-revision-hash="${escapeHtml(revision.content_hash || '')}" novalidate>
        <section class="panel field-stack" aria-labelledby="draft-content-heading">
          <div class="panel-header"><h2 id="draft-content-heading">Draft content</h2><span id="save-state" class="save-state" role="status">No unsaved changes</span></div>
          <label>Stem<textarea name="prompt" required>${escapeHtml(revision.prompt || '')}</textarea></label>
          ${choices.map(choiceEditor).join('')}
        </section>
        <aside class="panel field-stack" aria-labelledby="answer-authoring-heading">
          <h2 id="answer-authoring-heading">Protected authoring fields</h2>
          <p class="privacy-note">The safe read route never pre-fills answer or rationale fields. Values are sent only on an explicit save and are not stored in browser storage.</p>
          <label>Correct answer<select name="answer" required>
            <option value="">Select answer</option>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
          </select></label>
          <label>Correct answer rationale<textarea name="correct_answer_rationale" required autocomplete="off"></textarea></label>
          <label>Explanation<textarea name="explanation" required autocomplete="off"></textarea></label>
          <label>Concept ID<input value="${escapeHtml(revision.concept_id || '')}" readonly aria-readonly="true"></label>
          ${detailList([
            ['Source lineage', escapeHtml(sourceLabels.join(', ') || 'Not supplied')],
            ['Evidence lineage', escapeHtml(claimLabels.join(', ') || 'Not supplied')],
          ])}
          <div class="action-row">
            ${hasLineage && isDraft ? '<button class="button button-primary" type="submit">Save draft</button>' : disabledCommand('Save draft', isDraft ? 'Source and evidence lineage are required before this route can persist a draft.' : 'This exact revision is frozen after candidate submission.', { tone: 'primary' })}
            ${hasLineage && isDraft ? `<button class="button" type="button" data-action="submit-candidate" data-id="${escapeHtml(revision.id)}">Submit for review</button>` : disabledCommand('Submit for review', isDraft ? 'Source and evidence lineage are required before candidate submission.' : 'This exact revision has already left draft state.')}
          </div>
        </aside>
      </form>`,
  };
}

async function distractorsTemplate() {
  const revisionsPage = await listResource('item_revisions');
  const revisions = [...revisionsPage.rows].sort((left, right) => Number(right.revision_number) - Number(left.revision_number));
  const revision = revisions.find((row) => row.id === state.selectedRevisionId) || revisions[0] || null;
  if (!revision) {
    return { context: [], markup: emptyState('No revision is available for distractor review', 'The sanitized revision route returned no records.') };
  }
  state.selectedRevisionId = revision.id;
  return {
    context: [
      ['Item', `<span class="hash-text">${escapeHtml(revision.item_id)}</span>`],
      ['Immutable revision', `<span class="hash-text">${escapeHtml(revision.id)}</span>`],
      ['Revision hash', `<span class="hash-text" title="${escapeHtml(revision.content_hash || '')}">${escapeHtml(shortHash(revision.content_hash))}</span>`],
      ['Answer key', 'Withheld by safe generic read'],
    ],
    markup: `
      <div class="layout-two">
        <section class="panel" aria-labelledby="distractor-options-heading">
          <div class="panel-header"><h2 id="distractor-options-heading">Option review</h2>${badge('Independent review required', 'amber')}</div>
          <div class="table-wrap" tabindex="0" role="region" aria-label="Distractor review table"><table>
            <thead><tr><th scope="col">Option</th><th scope="col">Sanitized wording</th><th scope="col">Plausibility</th><th scope="col">Accidental correctness</th><th scope="col">Misconception</th></tr></thead>
            <tbody>${safeArray(revision.choices).map((choice) => `<tr>
              <th scope="row">${escapeHtml(choice.key)}</th>
              <td>${escapeHtml(choice.text || 'Not supplied')}</td>
              <td>${badge('Not reviewed')}</td>
              <td>${badge('Not reviewed')}</td>
              <td>${badge('Not reviewed')}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </section>
        <aside class="panel" aria-labelledby="distractor-criteria-heading">
          <h2 id="distractor-criteria-heading">Review criteria</h2>
          <ul class="review-criteria">
            <li><strong>Plausibility</strong><span>Each distractor should attract a distinct, relevant misconception.</span></li>
            <li><strong>Accidental correctness</strong><span>No distractor may become correct under a reasonable interpretation.</span></li>
            <li><strong>Option class</strong><span>Choices should remain parallel, mutually exclusive, and comparable.</span></li>
            <li><strong>Safety</strong><span>No option may teach an unsafe or unsupported rule.</span></li>
          </ul>
          ${disabledCommand('Record distractor review', 'The safe read withholds the answer key and no dedicated distractor-review write route is exposed.', { tone: 'primary' })}
          <button class="button" type="button" data-action="open-editor" data-id="${escapeHtml(revision.id)}">Open authoring revision</button>
        </aside>
      </div>`,
  };
}

async function evidenceTemplate() {
  const claimsPage = await listResource('evidence_claims');
  const now = Date.now();
  const claims = claimsPage.rows.map((claim) => ({
    ...claim,
    expired: Number.isFinite(Date.parse(claim.expires_at || '')) && Date.parse(claim.expires_at) <= now,
  }));
  const expired = claims.filter((claim) => claim.expired);
  return {
    context: [
      ['Claim count', String(claimsPage.total)],
      ['Expired claims', String(expired.length)],
      ['Data source', 'Authorized evidence claim route'],
    ],
    markup: `
      ${expired.length ? stateNotice('expired-evidence', 'Evidence currency has expired', `${expired.length} claim${expired.length === 1 ? '' : 's'} require replacement and exact-revision review.`, 'Attach a current authorized claim through the governed evidence service.', 'danger') : ''}
      <div class="layout-two">
        <section class="panel" aria-labelledby="claims-heading">
          <div class="panel-header"><h2 id="claims-heading">Evidence claim records</h2>${badge(`${claims.length} returned`, 'blue')}</div>
          ${claims.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Evidence claims table"><table>
            <thead><tr><th scope="col">Claim</th><th scope="col">Authority</th><th scope="col">Expires</th><th scope="col">Status</th></tr></thead>
            <tbody>${claims.map((claim) => `<tr>
              <th scope="row"><span class="claim-text">${escapeHtml(claim.claim_text || 'Claim wording not supplied')}</span><br><span class="muted hash-text">${escapeHtml(claim.id)}</span></th>
              <td>${escapeHtml(humanize(claim.authority_class || 'Not supplied'))}</td>
              <td>${escapeHtml(formatTimestamp(claim.expires_at))}</td>
              <td>${badge(claim.expired ? 'Expired' : claim.status || 'Not supplied')}</td>
            </tr>`).join('')}</tbody>
          </table></div>` : emptyState('No evidence claims are available', 'No claim is inferred or hard-coded when the authorized route is empty.')}
        </section>
        <aside class="panel" aria-labelledby="evidence-policy-heading">
          <h2 id="evidence-policy-heading">Currency and write policy</h2>
          ${detailList([
            ['Current claims', String(claims.length - expired.length)],
            ['Expired claims', String(expired.length)],
            ['Release behavior', expired.length ? badge('Blocked') : badge('No expiry detected')],
            ['Source wording', 'Not duplicated in this summary'],
          ])}
          ${disabledCommand('Add evidence claim', 'Generic claim creation is forbidden; use the governed evidence ingestion service.', { tone: 'primary' })}
        </aside>
      </div>`,
  };
}

function revisionIdentity(revision, role, assignment, evidenceStatus, conflict) {
  return [
    ['Item', `<span class="hash-text">${escapeHtml(revision?.item_id || 'Not supplied')}</span>`],
    ['Immutable revision', `<span class="hash-text">${escapeHtml(revision?.id || 'Not supplied')}</span>`],
    ['Revision hash', `<span class="hash-text" title="${escapeHtml(revision?.content_hash || '')}">${escapeHtml(shortHash(revision?.content_hash))}</span>`],
    ['Assignment', `<span class="hash-text">${escapeHtml(assignment?.id || 'None')}</span>`],
    ['Current role', escapeHtml(role)],
    ['Evidence currency', evidenceStatus],
    ['Conflict', conflict ? badge('Conflict', 'red') : badge('None detected', 'green')],
  ];
}

function currentRevisionStatus(revision, events) {
  return [...events]
    .filter((event) => event.item_revision_id === revision.id)
    .sort((left, right) => Number(left.sequence) - Number(right.sequence))
    .at(-1)?.to_status || revision.workflow_status;
}

async function editorialTemplate() {
  const [revisionsPage, reviewersPage, assignmentsPage, claimsPage, eventsPage] = await Promise.all([
    listResource('item_revisions'),
    listResource('reviewers'),
    listResource('review_assignments'),
    listResource('evidence_claims'),
    listResource('review_events'),
  ]);
  const revisions = [...revisionsPage.rows].sort((left, right) => Number(right.revision_number) - Number(left.revision_number));
  const revision = revisions.find((row) => row.id === state.selectedRevisionId) || revisions[0] || null;
  if (!revision) {
    return { context: [], markup: emptyState('No revision is available for editorial review', 'The authorized revision queue returned no records.') };
  }
  state.selectedRevisionId = revision.id;
  const actorId = state.session?.actor?.id || '';
  const reviewer = reviewersPage.rows.find((row) => row.actor_id === actorId) || null;
  const assignment = assignmentsPage.rows.find((row) => row.item_revision_id === revision.id
    && row.review_type === 'editorial'
    && row.reviewer_actor_id === actorId
    && ['open', 'accepted'].includes(row.state)) || null;
  const conflict = Boolean(reviewer && (
    reviewer.actor_id === revision.author_actor_id
    || reviewer.delegated_by_actor_id === revision.author_actor_id
    || safeArray(reviewer.conflict_actor_ids).includes(revision.author_actor_id)
  ));
  const relevantClaims = claimsPage.rows.filter((claim) => safeArray(revision.evidence_claim_ids).includes(claim.id));
  const expired = relevantClaims.some((claim) => Number.isFinite(Date.parse(claim.expires_at || '')) && Date.parse(claim.expires_at) <= Date.now());
  const workflowStatus = currentRevisionStatus(revision, eventsPage.rows);
  const effectiveWorkflowStatus = assignment?.state === 'accepted' && workflowStatus === 'candidate'
    ? 'editorial_review'
    : workflowStatus;
  const exactAssignment = Boolean(assignment && assignment.exact_revision_hash === revision.content_hash);
  const canAccept = Boolean(
    assignment?.state === 'open'
    && reviewer
    && !conflict
    && !expired
    && exactAssignment
    && ['candidate', 'editorial_review'].includes(workflowStatus),
  );
  const canReview = Boolean(assignment?.state === 'accepted' && reviewer && !conflict && !expired && exactAssignment && effectiveWorkflowStatus === 'editorial_review');
  const reason = conflict
    ? 'Self-review or a declared reviewer conflict blocks this exact revision.'
    : expired
      ? 'Evidence currency has expired for this exact revision.'
    : !assignment
      ? 'No active editorial assignment exists for this exact revision.'
      : !['candidate', 'editorial_review'].includes(effectiveWorkflowStatus)
        ? 'This revision is not in the editorial candidate state.'
        : !exactAssignment
          ? 'The assignment hash does not match the selected immutable revision.'
          : 'Accept the assignment before recording a verdict.';
  const decisionButtons = canReview
    ? `<button class="button button-danger" type="button" data-action="editorial-decision" data-verdict="fail" data-to-status="rejected">Reject</button>
       <button class="button" type="button" data-action="editorial-decision" data-verdict="needs_revision" data-to-status="candidate">Request revision</button>
       <button class="button button-primary" type="button" data-action="editorial-decision" data-verdict="pass" data-to-status="medical_review">Pass editorial</button>`
    : `${disabledCommand('Reject', reason, { tone: 'danger' })}${disabledCommand('Request revision', reason)}${disabledCommand('Pass editorial', reason, { tone: 'primary' })}`;
  return {
    context: revisionIdentity(revision, 'Editorial reviewer', assignment, expired ? badge('Expired') : badge('Current'), conflict),
    markup: `
      ${conflict ? stateNotice('review-conflict', 'Reviewer conflict blocks a verdict', 'The current reviewer cannot independently review this author revision.', 'Assign a different editorial reviewer to the exact revision hash.', 'danger') : ''}
      ${expired ? stateNotice('expired-evidence', 'Evidence expired during review', 'The verdict controls remain blocked until current evidence is attached.', 'Replace the expired claim and repeat exact-revision review.', 'danger') : ''}
      <form id="editorial-form" class="layout-two" data-revision-id="${escapeHtml(revision.id)}" data-revision-hash="${escapeHtml(revision.content_hash || '')}" data-reviewer-id="${escapeHtml(reviewer?.id || '')}" data-assignment-id="${escapeHtml(assignment?.id || '')}">
        <section class="panel" aria-labelledby="editorial-rubric-heading">
          <h2 id="editorial-rubric-heading">Editorial rubric</h2>
          <ul class="checklist">
            <li><label><input name="single_answer" type="checkbox">One defensible best answer</label></li>
            <li><label><input name="parallel_choices" type="checkbox">Choices are parallel and mutually exclusive</label></li>
            <li><label><input name="answerable_lead_in" type="checkbox">Lead-in is answerable without choices</label></li>
            <li><label><input name="distinct_misconceptions" type="checkbox">Distractors map to distinct misconceptions</label></li>
            <li><label><input name="complete_explanation" type="checkbox">Explanation addresses every option</label></li>
          </ul>
        </section>
        <aside class="panel field-stack" aria-labelledby="editorial-verdict-heading">
          <h2 id="editorial-verdict-heading">Verdict</h2>
          <label>Review note<textarea name="note" placeholder="Required for rejection or revision request"></textarea></label>
          ${canAccept ? `<button class="button button-primary" type="button" data-action="accept-assignment" data-id="${escapeHtml(assignment.id)}">Accept assignment</button>` : ''}
          <div class="action-row review-actions">${decisionButtons}</div>
        </aside>
      </form>`,
  };
}

async function physicianTemplate() {
  const [revisionsPage, assignmentsPage, reviewersPage, governance, claimsPage, eventsPage] = await Promise.all([
    listResource('item_revisions'),
    listResource('review_assignments'),
    listResource('reviewers'),
    api('/api/v1/governance'),
    listResource('evidence_claims'),
    listResource('review_events'),
  ]);
  const revisions = [...revisionsPage.rows].sort((left, right) => Number(right.revision_number) - Number(left.revision_number));
  const revision = revisions.find((row) => row.id === state.selectedRevisionId) || revisions[0] || null;
  if (!revision) {
    return { context: [], markup: emptyState('No revision is available for physician review', 'The authorized medical review queue returned no records.') };
  }
  const actorId = state.session?.actor?.id || '';
  const reviewer = reviewersPage.rows.find((row) => row.actor_id === actorId) || null;
  const assignment = assignmentsPage.rows.find((row) => row.item_revision_id === revision.id
    && row.review_type === 'medical'
    && row.reviewer_actor_id === actorId
    && ['open', 'accepted'].includes(row.state)) || null;
  const relevantClaims = claimsPage.rows.filter((claim) => safeArray(revision.evidence_claim_ids).includes(claim.id));
  const expired = relevantClaims.some((claim) => Number.isFinite(Date.parse(claim.expires_at || '')) && Date.parse(claim.expires_at) <= Date.now());
  const hashConflict = Boolean(assignment && assignment.exact_revision_hash !== revision.content_hash);
  const credentialExpiresAt = Date.parse(reviewer?.credential?.expires_at || '');
  const roleAuthorized = Boolean(
    state.session?.actor?.roles?.includes('physician_reviewer')
    && reviewer?.roles?.includes('physician_reviewer')
    && reviewer.actor_id === actorId
    && reviewer.credential?.status === 'verified'
    && ['md', 'do'].includes(reviewer.credential?.type)
    && Number.isFinite(credentialExpiresAt)
    && credentialExpiresAt > Date.now(),
  );
  const governanceReady = governance.medical_governance_lead !== null;
  const workflowStatus = currentRevisionStatus(revision, eventsPage.rows);
  const canAccept = Boolean(roleAuthorized && assignment?.state === 'open' && !expired && !hashConflict && workflowStatus === 'medical_review');
  const canReview = Boolean(roleAuthorized && assignment?.state === 'accepted' && !expired && !hashConflict && workflowStatus === 'medical_review');
  const reason = !roleAuthorized
    ? 'The current local role is not a credentialed physician reviewer for this assignment.'
    : !governanceReady
      ? 'The medical governance lead is unassigned.'
      : expired
        ? 'Evidence currency has expired and requires exact-revision re-review.'
        : hashConflict
          ? 'The assignment hash does not match the selected immutable revision.'
          : 'No active authorized medical review workflow is available.';
  return {
    context: revisionIdentity(revision, roleAuthorized ? 'Physician reviewer' : 'Editorial local role', assignment, expired ? badge('Expired') : badge('Current'), hashConflict),
    markup: `
      ${!roleAuthorized ? stateNotice('unauthorized', 'Physician review role required', 'The current reviewer cannot sign a medical decision.', 'Use canonical authentication as the assigned credentialed physician reviewer.', 'danger') : ''}
      ${hashConflict ? stateNotice('concurrent-edit', 'Assignment revision changed', 'The signed assignment hash no longer matches this revision.', 'Reload and reassign the exact immutable revision before review.', 'danger') : ''}
      ${expired ? stateNotice('expired-evidence', 'Evidence expired before physician decision', 'Approval is blocked without current claim evidence.', 'Replace the claim and repeat the exact-revision review.', 'danger') : ''}
      <form id="physician-form" class="layout-two" data-revision-id="${escapeHtml(revision.id)}" data-revision-hash="${escapeHtml(revision.content_hash || '')}" data-reviewer-id="${escapeHtml(reviewer?.id || '')}" data-assignment-id="${escapeHtml(assignment?.id || '')}">
        <section class="panel" aria-labelledby="physician-attestation-heading">
          <div class="panel-header"><h2 id="physician-attestation-heading">Exact revision attestation</h2>${badge(canReview ? 'Ready' : 'Blocked', canReview ? 'green' : 'red')}</div>
          <ul class="review-criteria">
            <li><strong>Medical accuracy</strong><span>Requires an assigned, credentialed physician.</span></li>
            <li><strong>Distractor safety</strong><span>Requires every option and rationale for this exact hash.</span></li>
            <li><strong>Evidence currency</strong><span>Requires all linked claims to remain current.</span></li>
            <li><strong>Conflict check</strong><span>Requires an independent assignment with no actor conflict.</span></li>
          </ul>
        </section>
        <aside class="panel field-stack" aria-labelledby="physician-decision-heading">
          <h2 id="physician-decision-heading">Signed decision</h2>
          ${detailList([
            ['Credential', badge(reviewer?.credential?.status || 'Not verified')],
            ['Medical governance lead', `<span class="hash-text">${escapeHtml(governance.medical_governance_lead || 'Unassigned')}</span>`],
            ['Exact revision hash', `<span class="hash-text">${escapeHtml(shortHash(revision.content_hash))}</span>`],
          ])}
          <label>Medical review note<textarea name="note" placeholder="Required for rejection or revision request"></textarea></label>
          ${canAccept ? `<button class="button button-primary" type="button" data-action="accept-assignment" data-id="${escapeHtml(assignment.id)}">Accept assignment</button>` : ''}
          ${canReview ? `<div class="action-row review-actions">
            <button class="button button-danger" type="button" data-action="medical-decision" data-verdict="fail" data-to-status="rejected">Reject</button>
            <button class="button" type="button" data-action="medical-decision" data-verdict="needs_revision" data-to-status="editorial_review">Request revision</button>
            ${governanceReady
    ? '<button class="button button-primary" type="button" data-action="medical-decision" data-verdict="pass" data-to-status="approved">Approve exact revision</button>'
    : disabledCommand('Approve exact revision', 'The medical governance lead is unassigned.', { tone: 'primary' })}
          </div>` : `${disabledCommand('Reject medical review', reason, { tone: 'danger' })}${disabledCommand('Approve exact revision', reason, { tone: 'primary' })}`}
        </aside>
      </form>`,
  };
}

function comparableRevisionFields(revision) {
  return [
    ['Stem', revision.prompt || 'Not supplied'],
    ['Choices', safeArray(revision.choices).map((choice) => `${choice.key}: ${choice.text}`).join(' | ') || 'Not supplied'],
    ['Sources', safeArray(revision.source_ids).join(', ') || 'Not supplied'],
    ['Evidence claims', safeArray(revision.evidence_claim_ids).join(', ') || 'Not supplied'],
    ['Workflow status', revision.workflow_status || 'Not supplied'],
  ];
}

async function diffTemplate() {
  const revisionsPage = await listResource('item_revisions');
  const revisions = [...revisionsPage.rows].sort((left, right) => Number(left.revision_number) - Number(right.revision_number));
  if (revisions.length < 2) {
    const only = revisions[0];
    return {
      context: only ? [['Item', `<span class="hash-text">${escapeHtml(only.item_id)}</span>`], ['Revision count', '1']] : [],
      markup: emptyState('A second revision is required', 'Save a new immutable draft before opening revision comparison.'),
    };
  }
  const before = revisions.at(-2);
  const after = revisions.at(-1);
  const beforeFields = new Map(comparableRevisionFields(before));
  const afterFields = new Map(comparableRevisionFields(after));
  state.selectedRevisionId = after.id;
  return {
    context: [
      ['Item', `<span class="hash-text">${escapeHtml(after.item_id)}</span>`],
      ['Before revision', `<span class="hash-text">${escapeHtml(before.id)}</span>`],
      ['After revision', `<span class="hash-text">${escapeHtml(after.id)}</span>`],
      ['After hash', `<span class="hash-text" title="${escapeHtml(after.content_hash || '')}">${escapeHtml(shortHash(after.content_hash))}</span>`],
    ],
    markup: `
      <section class="panel" aria-labelledby="revision-diff-heading">
        <div class="toolbar"><div><h2 id="revision-diff-heading">Revision ${escapeHtml(before.revision_number)} to revision ${escapeHtml(after.revision_number)}</h2><span class="muted">Protected answer and rationale fields are omitted by the safe route.</span></div><button class="button" type="button" data-action="open-editor" data-id="${escapeHtml(after.id)}">Open latest revision</button></div>
        <div class="table-wrap" tabindex="0" role="region" aria-label="Revision comparison table"><table>
          <thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
          <tbody>${[...beforeFields.keys()].map((field) => {
            const left = beforeFields.get(field);
            const right = afterFields.get(field);
            const changed = left !== right;
            return `<tr><th scope="row">${escapeHtml(field)}</th><td class="${changed ? 'diff-before' : ''}">${escapeHtml(left)}</td><td class="${changed ? 'diff-after' : ''}">${escapeHtml(right)}</td></tr>`;
          }).join('')}</tbody>
        </table></div>
      </section>`,
  };
}

async function searchTemplate() {
  const revisionsPage = await listResource('item_revisions');
  const query = state.search.query.trim().toLowerCase();
  const statuses = [...new Set(revisionsPage.rows.map((row) => row.workflow_status).filter(Boolean))].sort();
  let results = revisionsPage.rows.filter((row) => {
    const searchable = `${row.prompt || ''} ${row.id || ''} ${row.item_id || ''}`.toLowerCase();
    return (!query || searchable.includes(query)) && (state.search.status === 'all' || row.workflow_status === state.search.status);
  });
  results.sort((left, right) => {
    if (state.search.sort === 'oldest') return Number(left.revision_number) - Number(right.revision_number);
    if (state.search.sort === 'id') return left.id.localeCompare(right.id);
    return Number(right.revision_number) - Number(left.revision_number);
  });
  const pageSize = 10;
  const maxPage = Math.max(0, Math.ceil(results.length / pageSize) - 1);
  state.search.page = Math.min(state.search.page, maxPage);
  const visible = results.slice(state.search.page * pageSize, (state.search.page + 1) * pageSize);
  const previousDisabled = state.search.page === 0;
  const nextDisabled = state.search.page >= maxPage;
  return {
    context: [['Result count', String(results.length)], ['Page', `${state.search.page + 1} of ${maxPage + 1}`], ['Data boundary', 'Sanitized revision metadata']],
    markup: `
      <section class="panel" aria-labelledby="search-results-heading">
        <form id="search-form" class="filters" role="search">
          <label>Search revisions<input name="query" type="search" value="${escapeHtml(state.search.query)}" autocomplete="off"></label>
          <label>Review status<select name="status"><option value="all">All statuses</option>${statuses.map((status) => `<option value="${escapeHtml(status)}"${selectedOption(state.search.status, status)}>${escapeHtml(humanize(status))}</option>`).join('')}</select></label>
          <label>Sort<select name="sort"><option value="newest"${selectedOption(state.search.sort, 'newest')}>Newest revision</option><option value="oldest"${selectedOption(state.search.sort, 'oldest')}>Oldest revision</option><option value="id"${selectedOption(state.search.sort, 'id')}>Revision ID</option></select></label>
          <button class="button button-primary filter-submit" type="submit">Search</button>
        </form>
        <div class="panel-header"><h2 id="search-results-heading">Sanitized revision results</h2><span class="muted">${results.length} found</span></div>
        ${visible.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Search results table"><table>
          <thead><tr><th scope="col">Revision</th><th scope="col">Item</th><th scope="col">Stem</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
          <tbody>${visible.map((revision) => `<tr><th scope="row"><span class="hash-text">${escapeHtml(revision.id)}</span></th><td><span class="hash-text">${escapeHtml(revision.item_id)}</span></td><td>${escapeHtml(revision.prompt || 'Not supplied')}</td><td>${badge(revision.workflow_status || 'Not supplied')}</td><td><button class="button button-small" type="button" data-action="open-revision" data-id="${escapeHtml(revision.id)}">Open</button></td></tr>`).join('')}</tbody>
        </table></div>` : emptyState('No revisions match', 'Change the query or status filter and search again.')}
        <div class="pagination" aria-label="Search result pages">
          <button class="button" type="button" data-action="search-page" data-page="${state.search.page - 1}" aria-disabled="${previousDisabled}" aria-describedby="pagination-status">Previous</button>
          <span id="pagination-status">Page ${state.search.page + 1} of ${maxPage + 1}. ${previousDisabled ? 'Previous is unavailable on the first page. ' : ''}${nextDisabled ? 'Next is unavailable on the last page.' : ''}</span>
          <button class="button" type="button" data-action="search-page" data-page="${state.search.page + 1}" aria-disabled="${nextDisabled}" aria-describedby="pagination-status">Next</button>
        </div>
      </section>`,
  };
}

async function releaseTemplate() {
  const [releasesPage, revisionsPage, eventsPage, claimsPage, flagsPage] = await Promise.all([
    listResource('release_snapshots'),
    listResource('item_revisions'),
    listResource('review_events'),
    listResource('evidence_claims'),
    listResource('feature_flags'),
  ]);
  const revisions = [...revisionsPage.rows].sort((left, right) => Number(right.revision_number) - Number(left.revision_number));
  const revision = revisions[0] || null;
  const medicalPass = revision && eventsPage.rows.some((event) => event.item_revision_id === revision.id && event.review_type === 'medical' && event.verdict === 'pass' && event.to_status === 'approved' && event.exact_revision_hash === revision.content_hash);
  const relevantClaims = revision ? claimsPage.rows.filter((claim) => safeArray(revision.evidence_claim_ids).includes(claim.id)) : [];
  const claimsCurrent = relevantClaims.length > 0 && relevantClaims.every((claim) => claim.status === 'verified' && (!claim.expires_at || Date.parse(claim.expires_at) > Date.now()));
  const eligible = Boolean(revision && revision.workflow_status === 'approved' && medicalPass && claimsCurrent);
  const latestRelease = releasesPage.rows.at(-1) || null;
  const flags = new Map(flagsPage.rows.map((flag) => [flag.key, flag.enabled === true]));
  const releaseReason = !revision
    ? 'No revision is available for release assembly.'
    : revision.workflow_status !== 'approved'
      ? 'The selected revision is not approved.'
      : !medicalPass
        ? 'Exact-revision physician approval is missing.'
        : 'At least one linked evidence claim is missing, unverified, or expired.';
  return {
    context: [
      ['Revision', `<span class="hash-text">${escapeHtml(revision?.id || 'None')}</span>`],
      ['Revision hash', `<span class="hash-text">${escapeHtml(shortHash(revision?.content_hash))}</span>`],
      ['Medical approval', badge(medicalPass ? 'Present' : 'Missing')],
      ['Evidence currency', badge(claimsCurrent ? 'Current' : 'Blocked')],
      ['Release', `<span class="hash-text">${escapeHtml(latestRelease?.id || 'Not assembled')}</span>`],
    ],
    markup: `
      ${!eligible ? stateNotice('blocked', 'Release assembly is blocked', releaseReason, 'Resolve every exact-revision gate, then reload release eligibility.', 'danger') : ''}
      <div class="layout-two">
        <section class="panel" aria-labelledby="release-gates-heading">
          <div class="panel-header"><h2 id="release-gates-heading">Release gates</h2>${badge(eligible ? 'Eligible' : 'Blocked')}</div>
          <div class="table-wrap" tabindex="0" role="region" aria-label="Release validation gates"><table>
            <thead><tr><th scope="col">Validation</th><th scope="col">Observed status</th></tr></thead>
            <tbody>
              <tr><th scope="row">Approved workflow state</th><td>${badge(revision?.workflow_status === 'approved' ? 'Present' : 'Missing')}</td></tr>
              <tr><th scope="row">Exact physician approval</th><td>${badge(medicalPass ? 'Present' : 'Missing')}</td></tr>
              <tr><th scope="row">Claims currency</th><td>${badge(claimsCurrent ? 'Current' : 'Blocked')}</td></tr>
              <tr><th scope="row">Student release flag</th><td>${badge(flags.get('student_release_enabled') ? 'On' : 'Off', flags.get('student_release_enabled') ? 'red' : 'green')}</td></tr>
              <tr><th scope="row">STAT adapter flag</th><td>${badge(flags.get('stat_adapter_enabled') ? 'On' : 'Off', flags.get('stat_adapter_enabled') ? 'red' : 'green')}</td></tr>
              <tr><th scope="row">Drills adapter flag</th><td>${badge(flags.get('drills_adapter_enabled') ? 'On' : 'Off', flags.get('drills_adapter_enabled') ? 'red' : 'green')}</td></tr>
            </tbody>
          </table></div>
        </section>
        <aside class="panel field-stack" aria-labelledby="release-command-heading">
          <h2 id="release-command-heading">Assembly and inspection</h2>
          <label>Dataset version<input id="dataset-version" value="local-synthetic-preview" autocomplete="off"></label>
          ${eligible ? `<button class="button button-primary" type="button" data-action="assemble-release" data-revision-id="${escapeHtml(revision.id)}">Assemble internal release</button>` : disabledCommand('Assemble internal release', releaseReason, { tone: 'primary' })}
          ${latestRelease ? `<button class="button" type="button" data-action="preview-release" data-id="${escapeHtml(latestRelease.id)}">Inspect pre-answer metadata</button>` : disabledCommand('Inspect pre-answer metadata', 'No assembled release exists on the authorized release route.')}
          ${disabledCommand('Promote release', 'Publication ratification and independent validation are unavailable in this local shell.', { tone: 'primary' })}
          <p class="privacy-note">Artifact payloads are never rendered in this view. Student-facing consumers remain off.</p>
        </aside>
      </div>`,
  };
}

async function incidentsTemplate() {
  const incidentsPage = await listResource('incident_records');
  const incidentReason = 'No governed incident-creation endpoint is exposed to the current shell.';
  return {
    context: [['Open records returned', String(incidentsPage.total)], ['Current role', 'Local internal reviewer'], ['Consumer flags', 'Off']],
    markup: `
      <section class="panel" aria-labelledby="incident-queue-heading">
        <div class="toolbar"><div><h2 id="incident-queue-heading">Incident queue</h2><span class="muted">Read-only immutable records</span></div>${disabledCommand('Open incident', incidentReason, { tone: 'danger' })}</div>
        ${incidentsPage.rows.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Incident records table"><table>
          <thead><tr><th scope="col">Incident</th><th scope="col">State</th><th scope="col">Owner</th><th scope="col">Created</th></tr></thead>
          <tbody>${incidentsPage.rows.map((incident) => `<tr><th scope="row"><span class="hash-text">${escapeHtml(incident.id)}</span></th><td>${badge(incident.status || incident.state || 'Not supplied')}</td><td>${escapeHtml(incident.owner_id || 'Unassigned')}</td><td>${escapeHtml(formatTimestamp(incident.created_at))}</td></tr>`).join('')}</tbody>
        </table></div>` : emptyState('No incident records returned', 'Consumer flags remain off. Incident creation requires the governed incident service.')}
      </section>`,
  };
}

async function auditTemplate() {
  const page = await listResource('audit_events');
  const ascending = [...page.rows].sort((left, right) => Number(left.sequence) - Number(right.sequence));
  const linkContinuity = ascending.every((event, index) => index === 0
    ? event.previous_hash === null
    : event.previous_hash === ascending[index - 1].event_hash);
  const query = state.auditFilter.query.trim().toLowerCase();
  const entityTypes = [...new Set(ascending.map((event) => event.entity_type).filter(Boolean))].sort();
  const rows = ascending.filter((event) => {
    const searchable = `${event.id} ${event.actor_id} ${event.action} ${event.entity_type} ${event.entity_id}`.toLowerCase();
    return (!query || searchable.includes(query)) && (state.auditFilter.entity === 'all' || event.entity_type === state.auditFilter.entity);
  }).reverse();
  const selected = ascending.find((event) => event.id === state.selectedAuditId) || rows[0] || null;
  if (selected) state.selectedAuditId = selected.id;
  return {
    context: [
      ['Audit events', String(page.total)],
      ['Visible events', String(rows.length)],
      ['Sequence links', badge(linkContinuity ? 'Continuous' : 'Broken', linkContinuity ? 'green' : 'red')],
      ['Record mode', 'Immutable read-only'],
    ],
    markup: `
      <div class="layout-run">
        <section class="panel" aria-labelledby="audit-events-heading">
          <form id="audit-filter-form" class="filters filters-three" role="search">
            <label>Search audit events<input name="query" type="search" value="${escapeHtml(state.auditFilter.query)}" autocomplete="off"></label>
            <label>Entity type<select name="entity"><option value="all">All entities</option>${entityTypes.map((entity) => `<option value="${escapeHtml(entity)}"${selectedOption(state.auditFilter.entity, entity)}>${escapeHtml(humanize(entity))}</option>`).join('')}</select></label>
            <button class="button button-primary filter-submit" type="submit">Apply filters</button>
          </form>
          <div class="panel-header"><h2 id="audit-events-heading">Immutable events</h2>${badge(linkContinuity ? 'Links continuous' : 'Link break detected', linkContinuity ? 'green' : 'red')}</div>
          <p class="privacy-note">This client checks sequence-link continuity only. It does not claim cryptographic release verification.</p>
          ${rows.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Audit event table"><table>
            <thead><tr><th scope="col">Sequence</th><th scope="col">Action</th><th scope="col">Entity</th><th scope="col">Actor</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
            <tbody>${rows.map((event) => `<tr><th scope="row">${Number(event.sequence) || 0}</th><td>${escapeHtml(humanize(event.action))}</td><td>${escapeHtml(humanize(event.entity_type))}<br><span class="muted hash-text">${escapeHtml(event.entity_id)}</span></td><td><span class="hash-text">${escapeHtml(event.actor_id)}</span></td><td><button class="button button-small" type="button" data-action="inspect-audit" data-id="${escapeHtml(event.id)}">Inspect</button></td></tr>`).join('')}</tbody>
          </table></div>` : emptyState('No audit events match', 'Clear the current filters or refresh the immutable event route.')}
        </section>
        <aside class="panel run-detail" aria-labelledby="audit-detail-heading">
          <h2 id="audit-detail-heading">Event detail</h2>
          ${selected ? detailList([
            ['Event ID', `<span class="hash-text">${escapeHtml(selected.id)}</span>`],
            ['Sequence', String(Number(selected.sequence) || 0)],
            ['Occurred', escapeHtml(formatTimestamp(selected.occurred_at || selected.created_at))],
            ['Actor', `<span class="hash-text">${escapeHtml(selected.actor_id)}</span>`],
            ['Action', escapeHtml(humanize(selected.action))],
            ['Entity', `${escapeHtml(humanize(selected.entity_type))}: <span class="hash-text">${escapeHtml(selected.entity_id)}</span>`],
            ['Previous hash', `<span class="hash-text" title="${escapeHtml(selected.previous_hash || '')}">${escapeHtml(shortHash(selected.previous_hash))}</span>`],
            ['Event hash', `<span class="hash-text" title="${escapeHtml(selected.event_hash || '')}">${escapeHtml(shortHash(selected.event_hash))}</span>`],
          ]) : '<p class="muted">Select an immutable audit event.</p>'}
        </aside>
      </div>`,
  };
}

const WORKFLOW_TEMPLATES = Object.freeze({
  dashboard: dashboardTemplate,
  inventory: inventoryTemplate,
  source: sourceTemplate,
  privacy: privacyTemplate,
  transcript: transcriptTemplate,
  extraction: extractionTemplate,
  triage: triageTemplate,
  editor: editorTemplate,
  distractors: distractorsTemplate,
  evidence: evidenceTemplate,
  editorial: editorialTemplate,
  physician: physicianTemplate,
  diff: diffTemplate,
  search: searchTemplate,
  release: releaseTemplate,
  incidents: incidentsTemplate,
  audit: auditTemplate,
});

function setActiveNavigation(name) {
  primaryNav.querySelectorAll('[data-screen]').forEach((button) => {
    const active = button.dataset.screen === name;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

function setMobileNavigation(open) {
  const expanded = Boolean(open);
  navToggle.setAttribute('aria-expanded', String(expanded));
  primaryNav.classList.toggle('is-open', expanded);
}

function showLoading(name) {
  const [, nextTitle] = WORKFLOW_META[name];
  screen.setAttribute('aria-busy', 'true');
  screen.innerHTML = `<div class="loading-state" data-state="loading" role="status">Loading ${escapeHtml(nextTitle.toLowerCase())}</div>`;
}

async function renderScreen(name, { focusHeading = false, preserveStatus = false } = {}) {
  if (!REQUIRED_WORKFLOWS.includes(name)) return;
  const token = ++state.renderToken;
  const previousScreen = state.currentScreen;
  state.currentScreen = name;
  if (previousScreen !== name) state.editorDirty = false;
  if (!preserveStatus) clearActionStatus();
  setActiveNavigation(name);
  setMobileNavigation(false);
  const [nextKicker, nextTitle] = WORKFLOW_META[name];
  kicker.textContent = nextKicker;
  title.textContent = nextTitle;
  showLoading(name);

  if (state.scenario !== 'live') {
    setContext([
      ['Scenario', badge(state.scenario, 'blue')],
      ['Data boundary', 'Non-clinical deterministic fixture'],
    ]);
    screen.innerHTML = scenarioTemplate(state.scenario);
    screen.setAttribute('aria-busy', 'false');
    if (focusHeading) screen.querySelector('h2[tabindex="-1"]')?.focus({ preventScroll: true });
    announce(`${nextTitle} synthetic ${humanize(state.scenario)} state loaded`);
    return;
  }

  try {
    const result = await WORKFLOW_TEMPLATES[name]();
    if (token !== state.renderToken) return;
    setContext(result.context || []);
    screen.innerHTML = result.markup;
    screen.setAttribute('aria-busy', 'false');
    if (focusHeading) title.focus({ preventScroll: true });
    announce(`${nextTitle} loaded`);
  } catch (error) {
    if (token !== state.renderToken) return;
    setContext([]);
    screen.innerHTML = renderError(error);
    screen.setAttribute('aria-busy', 'false');
    screen.querySelector('[tabindex="-1"]')?.focus({ preventScroll: true });
    announce(`${nextTitle} unavailable`, true);
  }
}

function navigate(name) {
  if (!REQUIRED_WORKFLOWS.includes(name)) return;
  if (state.currentScreen === 'editor' && state.editorDirty && name !== 'editor') {
    const discard = window.confirm('Discard unsaved draft changes and leave this revision?');
    if (!discard) return;
  }
  void renderScreen(name, { focusHeading: true });
}

function newSyntheticRun(originId, mode) {
  const run = {
    id: actionKey(`run_fixture_${mode}`),
    status: 'queued',
    stage: mode === 'resume' ? 'GX-5_CANDIDATE_QUESTION_DETECTION' : 'GX-0_INVENTORY',
    processed: 0,
    failed: 0,
    checkpoint: mode === 'resume'
      ? `New run from the safe checkpoint of ${originId}`
      : `New run requested from ${originId || 'the extraction queue'}`,
  };
  state.syntheticRuns.unshift(run);
  state.selectedRunId = run.id;
  return run;
}

async function openCandidate(id) {
  state.selectedCandidateId = id;
  state.selectedCandidateDetail = await getResource('extraction_candidates', id);
  await renderScreen('triage');
}

async function submitEditor(form) {
  if (!form.reportValidity()) return;
  const revision = state.editorRevision;
  if (!revision || form.dataset.revisionId !== revision.id) {
    throw new ApiError('stale_edit', 409);
  }

  const current = await getResource('item_revisions', revision.id);
  if (current.content_hash !== form.dataset.revisionHash) {
    throw new ApiError('concurrent_edit', 409);
  }
  const page = await listResource('item_revisions');
  const newest = page.rows
    .filter((entry) => entry.item_id === revision.item_id)
    .sort((left, right) => Number(right.revision_number) - Number(left.revision_number))[0];
  if (newest && newest.id !== revision.id) {
    const conflict = document.querySelector('#editor-conflict');
    conflict.innerHTML = stateNotice(
      'stale-edit',
      'A newer immutable revision exists',
      'This form was stopped before it could create a revision from stale content.',
      'Compare the newer revision, then deliberately reapply the draft.',
      'warning',
    );
    showActionStatus('Save stopped because a newer immutable revision exists.', {
      tone: 'warning',
      focus: true,
      assertive: true,
    });
    return;
  }

  const data = new FormData(form);
  const answer = String(data.get('answer') || '');
  const choices = ['A', 'B', 'C', 'D'].map((key) => ({
    key,
    text: String(data.get(`choice_${key}`) || '').trim(),
    why_tempting: String(data.get(`tempting_${key}`) || '').trim(),
    why_wrong: String(data.get(`wrong_${key}`) || '').trim(),
    misconception_id: String(data.get(`misconception_${key}`) || '').trim(),
  }));
  const payload = {
    concept_id: revision.concept_id,
    source_ids: safeArray(revision.source_ids),
    evidence_claim_ids: safeArray(revision.evidence_claim_ids),
    prompt: String(data.get('prompt') || '').trim(),
    choices,
    answer,
    explanation: String(data.get('explanation') || '').trim(),
    correct_answer_rationale: String(data.get('correct_answer_rationale') || '').trim(),
    topic: revision.topic || '',
    subtopic: revision.subtopic || '',
    lineage: revision.lineage || 'INTERNAL_HUMAN_EDIT',
  };
  if (revision.drills) payload.drills = revision.drills;
  const updated = await api(`/api/v1/item-revisions/${encodeURIComponent(revision.id)}/draft`, {
    method: 'PATCH',
    body: payload,
  });
  state.editorDirty = false;
  state.selectedRevisionId = updated.id;
  showActionStatus('Draft saved for the exact revision.', { focus: true });
  await renderScreen('editor', { preserveStatus: true });
}

async function submitEditorialDecision(button) {
  const form = button.closest('#editorial-form');
  if (!form) return;
  const data = new FormData(form);
  const verdict = button.dataset.verdict;
  const note = String(data.get('note') || '').trim();
  const rubric = ['single_answer', 'parallel_choices', 'answerable_lead_in', 'distinct_misconceptions', 'complete_explanation'];
  if (verdict === 'pass' && rubric.some((key) => data.get(key) !== 'on')) {
    showActionStatus('Complete every editorial rubric item before passing.', {
      tone: 'warning',
      focus: true,
      assertive: true,
    });
    return;
  }
  if (verdict !== 'pass' && !note) {
    showActionStatus('A review note is required for rejection or revision requests.', {
      tone: 'warning',
      focus: true,
      assertive: true,
    });
    return;
  }
  await api('/api/v1/review-events', {
    method: 'POST',
    body: {
      item_revision_id: form.dataset.revisionId,
      reviewer_id: form.dataset.reviewerId,
      assignment_id: form.dataset.assignmentId,
      review_type: 'editorial',
      exact_revision_hash: form.dataset.revisionHash,
      verdict,
      to_status: button.dataset.toStatus,
      structured_findings: {
        rubric: Object.fromEntries(rubric.map((key) => [key, data.get(key) === 'on'])),
        note,
      },
    },
  });
  showActionStatus('Editorial decision recorded for the exact revision.', { focus: true });
  await renderScreen('editorial', { preserveStatus: true });
}

async function submitMedicalDecision(button) {
  const form = button.closest('#physician-form');
  if (!form) return;
  const note = String(new FormData(form).get('note') || '').trim();
  const verdict = button.dataset.verdict;
  if (verdict !== 'pass' && !note) {
    showActionStatus('A medical review note is required for rejection or revision requests.', {
      tone: 'warning',
      focus: true,
      assertive: true,
    });
    return;
  }
  await api('/api/v1/review-events', {
    method: 'POST',
    body: {
      item_revision_id: form.dataset.revisionId,
      reviewer_id: form.dataset.reviewerId,
      assignment_id: form.dataset.assignmentId,
      review_type: 'medical',
      exact_revision_hash: form.dataset.revisionHash,
      verdict,
      to_status: button.dataset.toStatus,
      structured_findings: { note },
    },
  });
  showActionStatus('Medical decision recorded for the exact revision.', { focus: true });
  await renderScreen('physician', { preserveStatus: true });
}

async function handleAction(button) {
  const action = button.dataset.action;
  if (button.getAttribute('aria-disabled') === 'true') {
    const reason = button.closest('.disabled-command')?.querySelector('.control-reason')?.textContent
      || 'This command is blocked.';
    showActionStatus(reason, { tone: 'warning', focus: true });
    return;
  }

  switch (action) {
    case 'retry-view':
      await renderScreen(state.currentScreen, { focusHeading: true });
      break;
    case 'exit-scenario':
      state.scenario = 'live';
      scenarioSelect.value = 'live';
      await renderScreen(state.currentScreen, { focusHeading: true });
      break;
    case 'open-source':
      state.selectedInventorySourceId = button.dataset.id;
      state.selectedSourceRecordId = null;
      state.selectedTranscriptArtifactId = null;
      navigate('source');
      break;
    case 'select-transcript-artifact':
      state.selectedTranscriptArtifactId = button.dataset.id;
      await renderScreen('transcript', { focusHeading: true });
      break;
    case 'select-run':
      state.selectedRunId = button.dataset.id;
      await renderScreen('extraction');
      break;
    case 'queue-extraction': {
      const run = newSyntheticRun('', 'queue');
      showActionStatus(`Synthetic extraction ${run.id} queued.`, { focus: true });
      await renderScreen('extraction', { preserveStatus: true });
      break;
    }
    case 'retry-extraction':
    case 'resume-extraction': {
      const run = newSyntheticRun(button.dataset.id, action === 'resume-extraction' ? 'resume' : 'retry');
      showActionStatus(`Synthetic extraction ${run.id} queued as a new run.`, { focus: true });
      await renderScreen('extraction', { preserveStatus: true });
      break;
    }
    case 'open-candidate':
      await openCandidate(button.dataset.id);
      break;
    case 'open-editor':
    case 'open-revision':
      state.selectedRevisionId = button.dataset.id;
      navigate('editor');
      break;
    case 'search-page':
      state.search.page = Math.max(0, Number(button.dataset.page) || 0);
      await renderScreen('search');
      break;
    case 'inspect-audit':
      state.selectedAuditId = button.dataset.id;
      await renderScreen('audit');
      break;
    case 'editorial-decision':
      await submitEditorialDecision(button);
      break;
    case 'medical-decision':
      await submitMedicalDecision(button);
      break;
    case 'submit-candidate':
      await api(`/api/v1/item-revisions/${encodeURIComponent(button.dataset.id)}/submit-candidate`, { method: 'POST' });
      showActionStatus('Draft submitted as a candidate for independent review.', { focus: true });
      await renderScreen('editor', { preserveStatus: true });
      break;
    case 'accept-assignment':
      await api(`/api/v1/review-assignments/${encodeURIComponent(button.dataset.id)}/accept`, { method: 'POST' });
      showActionStatus('Assignment accepted for the exact revision.', { focus: true });
      await renderScreen(state.currentScreen, { preserveStatus: true });
      break;
    case 'assemble-release': {
      const datasetVersion = String(document.querySelector('#dataset-version')?.value || '').trim();
      const assembled = await api('/api/v1/releases', {
        method: 'POST',
        body: { datasetVersion, itemRevisionIds: [button.dataset.revisionId] },
      });
      showActionStatus(`Internal release ${assembled.release.id} assembled.`, { focus: true });
      await renderScreen('release', { preserveStatus: true });
      break;
    }
    case 'preview-release': {
      const artifact = await api(`/api/v1/releases/${encodeURIComponent(button.dataset.id)}/artifacts/stat_pre_answer`);
      showActionStatus(`Answer-free artifact ${artifact.id || 'metadata'} verified for inspection.`, { focus: true });
      break;
    }
    case 'blocked-command':
      break;
    default:
      break;
  }
}

primaryNav.addEventListener('click', (event) => {
  const button = event.target.closest('[data-screen]');
  if (button) navigate(button.dataset.screen);
});

navToggle.addEventListener('click', () => {
  setMobileNavigation(navToggle.getAttribute('aria-expanded') !== 'true');
});

refreshButton.addEventListener('click', () => {
  void renderScreen(state.currentScreen, { focusHeading: true });
});

scenarioSelect.addEventListener('change', () => {
  state.scenario = scenarioSelect.value;
  void renderScreen(state.currentScreen, { focusHeading: true });
});

screen.addEventListener('click', (event) => {
  const navigation = event.target.closest('[data-nav-screen]');
  if (navigation) {
    navigate(navigation.dataset.navScreen);
    return;
  }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  void handleAction(action).catch((error) => {
    showActionStatus(humanize(error?.code || error?.message || 'request failed'), {
      tone: 'danger',
      focus: true,
      assertive: true,
    });
  });
});

screen.addEventListener('input', (event) => {
  if (!event.target.closest('#editor-form')) return;
  state.editorDirty = true;
  const saveState = document.querySelector('#save-state');
  if (saveState) saveState.textContent = 'Unsaved changes';
});

screen.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.id === 'inventory-filter-form') {
    const data = new FormData(form);
    state.inventoryFilter = {
      query: String(data.get('query') || ''),
      status: String(data.get('status') || 'all'),
    };
    void renderScreen('inventory');
  } else if (form.id === 'search-form') {
    const data = new FormData(form);
    state.search = {
      query: String(data.get('query') || ''),
      status: String(data.get('status') || 'all'),
      sort: String(data.get('sort') || 'newest'),
      page: 0,
    };
    void renderScreen('search');
  } else if (form.id === 'audit-filter-form') {
    const data = new FormData(form);
    state.auditFilter = {
      query: String(data.get('query') || ''),
      entity: String(data.get('entity') || 'all'),
    };
    void renderScreen('audit');
  } else if (form.id === 'editor-form') {
    void submitEditor(form).catch((error) => {
      showActionStatus(humanize(error?.code || error?.message || 'request failed'), {
        tone: 'danger',
        focus: true,
        assertive: true,
      });
    });
  }
});

async function boot() {
  scenarioSelect.innerHTML = [
    '<option value="live">Live safe routes</option>',
    ...REQUIRED_STATES.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(humanize(id))}</option>`),
  ].join('');
  try {
    state.health = await api('/api/health');
    state.session = await api('/api/v1/session');
    const localDemo = state.health.mode === 'LOCAL_SYNTHETIC_DEMO';
    scenarioControl.hidden = !localDemo;
    environmentMode.textContent = localDemo ? 'Local synthetic fixture' : 'Authenticated internal adapter';
    actorIdentity.textContent = localDemo
      ? 'Local synthetic reviewer'
      : `Authenticated as ${state.session.actor.id}`;
    await renderScreen('dashboard');
  } catch (error) {
    environmentMode.textContent = 'Service unavailable';
    actorIdentity.textContent = 'Identity unavailable';
    screen.innerHTML = renderError(error);
    screen.setAttribute('aria-busy', 'false');
    announce('Question Platform unavailable', true);
  }
}

export const bootPromise = boot();
