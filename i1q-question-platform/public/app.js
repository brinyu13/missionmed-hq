const screen = document.querySelector('#screen');
const title = document.querySelector('#screen-title');
const kicker = document.querySelector('#screen-kicker');
const announcer = document.querySelector('#announcer');

const TITLES = {
  dashboard: ['Operations', 'Executive dashboard'],
  inventory: ['Sources', 'Source inventory'],
  transcript: ['Sources', 'Transcript evidence'],
  triage: ['Candidates', 'Candidate triage'],
  editor: ['Authoring', 'Question editor'],
  evidence: ['Evidence', 'Evidence workbench'],
  editorial: ['Review', 'Editorial review'],
  physician: ['Review', 'Physician review'],
  diff: ['History', 'Revision diff'],
  search: ['Library', 'Search and filters'],
  release: ['Release', 'Release center'],
  incidents: ['Operations', 'Incident center'],
};

let dashboardData = null;
let currentScreen = 'dashboard';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function api(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `request_failed_${response.status}`);
  }
  return response.json();
}

function badge(label, tone = 'amber') {
  return `<span class="badge badge-${tone}">${escapeHtml(label)}</span>`;
}

function dashboardTemplate(data) {
  const blockers = data.governance_unassigned.slice(0, 5).map((slot) => `
    <div class="owner-blocker">
      <strong>${escapeHtml(slot.replaceAll('_', ' '))}</strong>
      <span class="muted">Owner unassigned</span>
      ${badge('Blocking', 'red')}
    </div>`).join('');
  return `
    <div class="metrics-grid">
      <article class="metric"><span class="label">Inventory sources</span><strong>${data.inventory_sources}</strong><small>Synthetic only</small></article>
      <article class="metric"><span class="label">Extraction jobs</span><strong>${data.extraction_jobs}</strong><small>No authorized corpus</small></article>
      <article class="metric"><span class="label">Candidate questions</span><strong>${data.candidates}</strong><small>Awaiting source gate</small></article>
      <article class="metric"><span class="label">Open review assignments</span><strong>${data.review_assignments}</strong><small>Governance blocked</small></article>
    </div>
    <div class="layout-two">
      <section class="panel">
        <div class="panel-header"><h2>Release readiness</h2>${badge('Blocked', 'red')}</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Gate</th><th>Status</th><th>Required action</th></tr></thead>
            <tbody>
              <tr><td>Foundation audit</td><td>${badge('Running', 'blue')}</td><td>Complete independent mutations</td></tr>
              <tr><td>Medical governance</td><td>${badge('Blocked', 'red')}</td><td>Assign credentialed owner</td></tr>
              <tr><td>Privacy inventory</td><td>${badge('Blocked', 'red')}</td><td>Authorize read-only export</td></tr>
              <tr><td>Student release</td><td>${badge('Disabled', 'amber')}</td><td>Physician approval plus release flag</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <h2>Governance blockers</h2>
        ${blockers || '<p class="muted">No blockers</p>'}
      </section>
    </div>`;
}

function inventoryTemplate(rows) {
  const body = rows.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.title)}</strong><br><span class="muted">${escapeHtml(row.canonical_video_id)}</span></td>
      <td>${row.transcript_available ? badge('Transcript', 'green') : badge('Missing', 'red')}</td>
      <td>${row.vtt_available ? 'Available' : 'Missing'}</td>
      <td>${row.nodes_available ? 'Available' : 'Missing'}</td>
      <td>${badge(row.rights_status, row.rights_status === 'cleared_for' ? 'green' : 'amber')}</td>
      <td>${badge(row.extraction_suitability, 'blue')}</td>
    </tr>`).join('');
  return `
    <section class="panel">
      <div class="toolbar">
        <div><h2>Source records</h2><span class="muted">${rows.length} visible</span></div>
        <div class="action-row">
          <select aria-label="Filter source status"><option>All statuses</option><option>Extraction ready</option><option>Blocked</option></select>
          <button class="button" type="button" disabled>Request refresh</button>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Source</th><th>Transcript</th><th>VTT</th><th>Nodes</th><th>Rights</th><th>Suitability</th></tr></thead>
        <tbody>${body || '<tr><td colspan="6">No authorized sources available.</td></tr>'}</tbody>
      </table></div>
    </section>`;
}

function transcriptTemplate() {
  return `
    <div class="layout-two">
      <section class="panel">
        <div class="panel-header"><h2>Synthetic source fixture</h2>${badge('Redacted', 'green')}</div>
        <div class="transcript-line"><span class="muted">00:00</span><strong>Instructor</strong><span>We will classify the sample using the fixture key.</span></div>
        <div class="transcript-line"><span class="muted">00:08</span><strong>Instructor</strong><span><mark>Which label matches the blue sample?</mark></span></div>
        <div class="transcript-line"><span class="muted">00:14</span><strong>Instructor</strong><span>The fixture key maps blue to label beta.</span></div>
      </section>
      <aside class="panel">
        <h2>Source metadata</h2>
        <dl class="timeline">
          <li><dt>Video ID</dt><dd>video_local_demo</dd></li>
          <li><dt>Source hash</dt><dd>Verified fixture hash</dd></li>
          <li><dt>Speaker</dt><dd>Instructor, 0.99</dd></li>
          <li><dt>Node context</dt><dd>Classification</dd></li>
          <li><dt>Privacy</dt><dd>${badge('Pass', 'green')}</dd></li>
        </dl>
      </aside>
    </div>`;
}

function triageTemplate() {
  return `
    <section class="panel">
      <div class="toolbar"><div><h2>Candidate queue</h2><span class="muted">Synthetic fixture only</span></div><button class="button" type="button" disabled>Bulk assign</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th><span class="sr-only">Select</span></th><th>Candidate</th><th>Type</th><th>Answer source</th><th>Confidence</th><th>Status</th></tr></thead>
        <tbody><tr>
          <td><input type="checkbox" aria-label="Select synthetic candidate"></td>
          <td><strong>Which label matches the blue sample?</strong><br><span class="muted">00:08, video_local_demo</span></td>
          <td>${badge('Synthetic', 'blue')}</td><td>Explicit follow-up</td><td>0.99</td><td>${badge('AI draft', 'amber')}</td>
        </tr></tbody>
      </table></div>
    </section>`;
}

function editorTemplate() {
  const choice = (key, text, correct = false) => `
    <div>
      <div class="choice-row"><span class="choice-key">${key}</span><input aria-label="Choice ${key}" value="${escapeHtml(text)}"></div>
      ${correct ? '' : `<div class="choice-rationale"><input aria-label="Why choice ${key} is tempting" value="Synthetic misconception"><input aria-label="Why choice ${key} is wrong" value="Does not match the fixture key"></div>`}
    </div>`;
  return `
    <form id="editor-form" class="editor-grid">
      <section class="panel field-stack">
        <div class="panel-header"><h2>Draft content</h2><span id="save-state" class="save-state" role="status">Saved locally</span></div>
        <label>Stem<textarea name="prompt">Which label matches the blue sample in this synthetic fixture?</textarea></label>
        ${choice('A', 'Label alpha')}
        ${choice('B', 'Label beta', true)}
        ${choice('C', 'Label gamma')}
        ${choice('D', 'Label delta')}
      </section>
      <aside class="panel field-stack">
        <label>Correct answer<select name="answer"><option>A</option><option selected>B</option><option>C</option><option>D</option></select></label>
        <label>Correct answer rationale<textarea>The fixture key explicitly maps blue to beta.</textarea></label>
        <label>Explanation<textarea>The synthetic fixture key maps blue to label beta.</textarea></label>
        <label>Concept<select><option>Synthetic classification concept</option></select></label>
        <label>Difficulty<select><option>Uncalibrated</option><option>Foundational</option><option>Advanced</option></select></label>
        <div class="action-row"><button class="button" type="button">Save draft</button><button class="button button-primary" type="button" disabled>Submit for review</button></div>
      </aside>
    </form>`;
}

function evidenceTemplate() {
  return `
    <div class="layout-two">
      <section class="panel">
        <div class="panel-header"><h2>Evidence claims</h2><button class="button" type="button">Add claim</button></div>
        <div class="table-wrap"><table><thead><tr><th>Claim</th><th>Authority</th><th>Review date</th><th>Status</th></tr></thead>
          <tbody><tr><td>Synthetic fixture key maps blue to beta.</td><td>Fixture record</td><td>2026-07-13</td><td>${badge('Fixture only', 'blue')}</td></tr></tbody>
        </table></div>
      </section>
      <aside class="panel"><h2>Currency checks</h2><ul class="checklist"><li><label><input type="checkbox" checked>Source is immutable</label></li><li><label><input type="checkbox" checked>Claim matches source</label></li><li><label><input type="checkbox">External authority reviewed</label></li></ul></aside>
    </div>`;
}

function editorialTemplate() {
  return `
    <div class="layout-two">
      <section class="panel"><h2>Editorial rubric</h2><ul class="checklist">
        <li><label><input type="checkbox">One defensible best answer</label></li>
        <li><label><input type="checkbox">Choices are parallel and mutually exclusive</label></li>
        <li><label><input type="checkbox">Lead-in is answerable without choices</label></li>
        <li><label><input type="checkbox">Distractors map to distinct misconceptions</label></li>
        <li><label><input type="checkbox">Explanation addresses every option</label></li>
      </ul></section>
      <aside class="panel field-stack"><h2>Verdict</h2><label>Review note<textarea placeholder="Required for revision requests"></textarea></label><div class="action-row"><button class="button button-danger" type="button">Reject</button><button class="button" type="button">Request revision</button><button class="button button-primary" type="button">Pass editorial</button></div></aside>
    </div>`;
}

function physicianTemplate() {
  return `
    <div class="layout-two">
      <section class="panel"><div class="panel-header"><h2>Exact revision attestation</h2>${badge('Governance blocked', 'red')}</div><ul class="checklist">
        <li><label><input type="checkbox" disabled>Correct answer is medically accurate</label></li>
        <li><label><input type="checkbox" disabled>Distractors are plausible and safe</label></li>
        <li><label><input type="checkbox" disabled>Explanation reflects current evidence</label></li>
        <li><label><input type="checkbox" disabled>Source claims are current</label></li>
      </ul></section>
      <aside class="panel field-stack"><h2>Approval</h2><p class="muted">Medical governance lead and credentialed physician reviewer are unassigned.</p><label>Conflict note<textarea disabled></textarea></label><div class="action-row"><button class="button button-danger" type="button" disabled>Reject</button><button class="button button-primary" type="button" disabled>Approve revision</button></div></aside>
    </div>`;
}

function diffTemplate() {
  return `
    <section class="panel">
      <div class="toolbar"><h2>Revision 1 to revision 2</h2><select aria-label="Select revision pair"><option>Revision 1 to Revision 2</option></select></div>
      <div class="table-wrap"><table><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>
        <tr><td>Stem</td><td class="diff-before">Which label is blue?</td><td class="diff-after">Which label matches the blue sample in this synthetic fixture?</td></tr>
        <tr><td>Source</td><td>src_local_demo</td><td>src_local_demo</td></tr>
        <tr><td>Claims</td><td>None</td><td>Fixture mapping claim</td></tr>
      </tbody></table></div>
    </section>`;
}

function searchTemplate() {
  return `
    <section class="panel">
      <div class="filters"><label>Search<input type="search" value="blue sample"></label><label>Subject<select><option>All subjects</option></select></label><label>Review status<select><option>All statuses</option><option>Draft</option><option>Approved</option></select></label><label>Item form<select><option>All forms</option><option>Recall</option><option>Vignette</option></select></label></div>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th>Concept</th><th>Form</th><th>Review status</th><th>Quality</th></tr></thead><tbody>
        <tr><td><strong>Which label matches the blue sample?</strong><br><span class="muted">item_local_demo</span></td><td>Synthetic classification</td><td>Recall</td><td>${badge('Draft', 'amber')}</td><td>Unscored</td></tr>
      </tbody></table></div>
    </section>`;
}

function releaseTemplate() {
  return `
    <div class="layout-two">
      <section class="panel"><div class="panel-header"><h2>Release candidate</h2>${badge('Not assembled', 'amber')}</div><div class="table-wrap"><table><thead><tr><th>Validation</th><th>Status</th></tr></thead><tbody>
        <tr><td>Exact physician approval</td><td>${badge('Blocked', 'red')}</td></tr><tr><td>Answer-leak scan</td><td>${badge('Ready', 'green')}</td></tr><tr><td>Claims currency</td><td>${badge('Blocked', 'red')}</td></tr><tr><td>Single manifest</td><td>${badge('Ready', 'green')}</td></tr>
      </tbody></table></div></section>
      <aside class="panel field-stack"><h2>Promotion</h2><label>Channel preview<select><option>STAT pre-answer</option><option>STAT post-answer</option><option>Drills</option></select></label><button class="button" type="button">Preview artifact</button><button class="button button-primary" type="button" disabled>Assemble release</button></aside>
    </div>`;
}

function incidentsTemplate() {
  return `
    <section class="panel">
      <div class="toolbar"><div><h2>Incident queue</h2><span class="muted">No active incidents</span></div><button class="button button-danger" type="button">Open incident</button></div>
      <div class="empty-state"><div><strong>No incidents in the synthetic workspace</strong><p>Published content remains disabled.</p></div></div>
    </section>`;
}

const TEMPLATES = {
  dashboard: () => dashboardTemplate(dashboardData),
  inventory: async () => inventoryTemplate((await api('/api/v1/resources/inventory_sources')).rows),
  transcript: transcriptTemplate,
  triage: triageTemplate,
  editor: editorTemplate,
  evidence: evidenceTemplate,
  editorial: editorialTemplate,
  physician: physicianTemplate,
  diff: diffTemplate,
  search: searchTemplate,
  release: releaseTemplate,
  incidents: incidentsTemplate,
};

function bindScreenBehavior(name) {
  if (name === 'editor') {
    const form = document.querySelector('#editor-form');
    const state = document.querySelector('#save-state');
    let timer;
    form?.addEventListener('input', () => {
      state.textContent = 'Unsaved changes';
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.textContent = 'Saved locally';
        announcer.textContent = 'Draft saved locally';
      }, 450);
    });
  }
}

async function render(name) {
  currentScreen = name;
  const [nextKicker, nextTitle] = TITLES[name];
  kicker.textContent = nextKicker;
  title.textContent = nextTitle;
  screen.setAttribute('aria-busy', 'true');
  screen.innerHTML = `<div class="loading-state" role="status">Loading ${escapeHtml(nextTitle.toLowerCase())}</div>`;
  try {
    const markup = await TEMPLATES[name]();
    screen.innerHTML = markup;
    screen.setAttribute('aria-busy', 'false');
    bindScreenBehavior(name);
    announcer.textContent = `${nextTitle} loaded`;
  } catch (error) {
    screen.innerHTML = `<div class="error-state" role="alert"><div><strong>View unavailable</strong><p>${escapeHtml(error.message)}</p><button class="button" id="retry-button" type="button">Retry</button></div></div>`;
    screen.setAttribute('aria-busy', 'false');
    document.querySelector('#retry-button')?.addEventListener('click', () => render(name));
  }
}

const primaryNav = document.querySelector('#primary-nav');

primaryNav.addEventListener('click', (event) => {
  const button = event.target.closest('[data-screen]');
  if (!button) return;
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('is-active', item === button);
    if (item === button) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  render(button.dataset.screen);
});

primaryNav.addEventListener('keydown', (event) => {
  const button = event.target.closest('[data-screen]');
  if (!button || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  button.click();
});

document.querySelector('#refresh-button').addEventListener('click', () => render(currentScreen));

async function boot() {
  try {
    dashboardData = await api('/api/v1/dashboard');
    await render('dashboard');
  } catch (error) {
    dashboardData = {
      inventory_sources: 0,
      extraction_jobs: 0,
      candidates: 0,
      review_assignments: 0,
      governance_unassigned: ['authentication_adapter'],
    };
    screen.innerHTML = `<div class="error-state" role="alert"><div><strong>Authentication required</strong><p>${escapeHtml(error.message)}</p></div></div>`;
    screen.setAttribute('aria-busy', 'false');
  }
}

boot();
