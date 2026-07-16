import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const htmlPath = new URL('../public/index.html', import.meta.url);
const cssPath = new URL('../public/styles.css', import.meta.url);
const appPath = new URL('../public/app.js', import.meta.url);

let harnessSequence = 0;

function baseUiPayloads(extra = []) {
  return new Map([
    ['/api/health', { ok: true, service: 'i1q-question-platform', mode: 'LOCAL_SYNTHETIC_DEMO' }],
    ['/api/v1/session', {
      actor: { id: 'actor_ui_repair', roles: ['platform_admin', 'author', 'editorial_reviewer'] },
      session: { expires_at: '2099-01-01T00:00:00.000Z', csrf_token: 'ui-repair-csrf' },
    }],
    ['/api/v1/dashboard', {
      inventory_sources: 0,
      extraction_jobs: 0,
      candidates: 0,
      review_assignments: 0,
      blocked_releases: 0,
      incidents: 0,
      governance_unassigned: ['medical_governance_lead'],
      production_gate: 'BLOCKED',
    }],
    ['/api/v1/governance', { medical_governance_lead: null }],
    ['/api/v1/resources/feature_flags?limit=200', { total: 0, rows: [] }],
    ...extra,
  ]);
}

async function createUiHarness(payloads, requestHandler) {
  const html = await readFile(htmlPath, 'utf8');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4176/' });
  const originalGlobals = Object.fromEntries([
    'document', 'window', 'FormData', 'fetch',
  ].map((key) => [key, globalThis[key]]));
  const requests = [];
  const restore = () => {
    dom.window.close();
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  };

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.FormData = dom.window.FormData;
  globalThis.fetch = async (path, options = {}) => {
    const requestPath = String(path);
    requests.push({ path: requestPath, options });
    const handled = await requestHandler?.(requestPath, options);
    const status = handled?.status ?? (payloads.has(requestPath) ? 200 : 404);
    const payload = handled?.payload ?? payloads.get(requestPath) ?? { error: 'not_found' };
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => structuredClone(payload),
    };
  };
  dom.window.confirm = () => true;

  try {
    const app = await import(`${appPath.href}?repair-harness=${Date.now()}-${++harnessSequence}`);
    await app.bootPromise;
  } catch (error) {
    restore();
    throw error;
  }

  return {
    dom,
    requests,
    restore,
    async waitFor(predicate, message = 'UI did not reach the expected state') {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (predicate()) return;
        await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
      }
      assert.fail(message);
    },
  };
}

test('review app exposes all seventeen required workflows', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const screens = [...html.matchAll(/data-screen="([a-z]+)"/gu)].map((match) => match[1]);
  assert.equal(screens.length, 17);
  assert.deepEqual(screens, [
    'dashboard', 'inventory', 'source', 'privacy', 'transcript', 'extraction',
    'triage', 'editor', 'distractors', 'evidence', 'editorial', 'physician',
    'diff', 'search', 'release', 'incidents', 'audit',
  ]);
});

test('static shell has accessible landmarks, live regions, and named controls', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /<main id="workspace"/u);
  assert.match(html, /<nav id="primary-nav"/u);
  assert.match(html, /aria-live="polite"/u);
  assert.match(html, /aria-live="assertive"/u);
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)];
  assert.ok(buttons.length > 0);
  for (const [, attributes, content] of buttons) {
    assert.ok(content.replace(/<[^>]+>/gu, '').trim() || /aria-label="[^"]+"/u.test(attributes), 'all buttons need an accessible name');
  }
});

test('responsive, focus, reduced-motion, and non-color status rules exist', async () => {
  const css = await readFile(cssPath, 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.badge::before/);
  assert.match(css, /#primary-nav\.is-open/);
  assert.match(css, /\.sidebar :focus-visible/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});

test('navigation uses native keyboard-activated buttons', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const nav = html.match(/<nav id="primary-nav"[\s\S]*?<\/nav>/u)?.[0] || '';
  const controls = [...nav.matchAll(/<button\b([^>]*)data-screen="([a-z]+)"([^>]*)>/gu)];
  assert.equal(controls.length, 17);
  for (const [, before, , after] of controls) {
    assert.match(`${before}${after}`, /type="button"/u);
    assert.doesNotMatch(`${before}${after}`, /tabindex="(?:-[^1]|[1-9])/u);
  }
});

test('client declares every required operational state and privacy class', async () => {
  const app = await readFile(appPath, 'utf8');
  for (const state of [
    'loading', 'empty', 'blocked', 'unauthorized', 'error', 'partial-source',
    'privacy-blocked', 'rights-blocked', 'expired-evidence', 'review-conflict',
    'stale-edit', 'concurrent-edit', 'extraction-queued', 'extraction-running',
    'extraction-failed', 'extraction-resumable',
  ]) {
    assert.match(app, new RegExp(`'${state}'`, 'u'));
  }
  for (const privacyClass of [
    'NON_DRJ_SPEECH', 'STUDENT_NAME', 'STUDENT_OTHER_IDENTIFIER',
    'PATIENT_DIRECT_IDENTIFIER', 'PATIENT_QUASI_IDENTIFIER',
    'THIRD_PARTY_IDENTITY', 'IDENTIFYING_CLINICAL_ANECDOTE', 'SOURCE_METADATA',
  ]) {
    assert.match(app, new RegExp(`'${privacyClass}'`, 'u'));
  }
});

test('client boots the dashboard and navigates with API-backed rendering', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4176/' });
  const originalGlobals = Object.fromEntries([
    'document', 'window', 'FormData', 'fetch',
  ].map((key) => [key, globalThis[key]]));
  const payloads = new Map([
    ['/api/health', { ok: true, service: 'i1q-question-platform', mode: 'LOCAL_SYNTHETIC_DEMO' }],
    ['/api/v1/session', {
      actor: { id: 'actor_local_demo', roles: ['platform_admin', 'author', 'editorial_reviewer'] },
      session: { expires_at: '2099-01-01T00:00:00.000Z', csrf_token: 'synthetic-ui-csrf-token' },
    }],
    ['/api/v1/dashboard', {
      inventory_sources: 1,
      extraction_jobs: 0,
      candidates: 0,
      review_assignments: 0,
      blocked_releases: 0,
      incidents: 0,
      governance_unassigned: ['medical_governance_lead'],
      production_gate: 'BLOCKED',
    }],
    ['/api/v1/governance', { medical_governance_lead: null }],
    ['/api/v1/resources/feature_flags?limit=200', { total: 0, rows: [] }],
    ['/api/v1/resources/inventory_sources?limit=200', { total: 0, rows: [] }],
  ]);

  try {
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.FormData = dom.window.FormData;
    globalThis.fetch = async (path) => ({
      ok: payloads.has(String(path)),
      status: payloads.has(String(path)) ? 200 : 404,
      json: async () => payloads.get(String(path)) || { error: 'not_found' },
    });
    dom.window.confirm = () => true;

    const moduleUrl = `${appPath.href}?ui-test=${Date.now()}`;
    const app = await import(moduleUrl);
    await app.bootPromise;
    assert.equal(dom.window.document.querySelector('#screen').getAttribute('aria-busy'), 'false');
    assert.match(dom.window.document.querySelector('#screen').textContent, /Governance owners/u);

    dom.window.document.querySelector('[data-screen="inventory"]').click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    assert.match(dom.window.document.querySelector('#screen').textContent, /No sources match/u);
    assert.equal(dom.window.document.querySelector('[data-screen="inventory"]').getAttribute('aria-current'), 'page');
  } finally {
    dom.window.close();
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('selected source lineage never falls back across inventory records', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4176/' });
  const originalGlobals = Object.fromEntries([
    'document', 'window', 'FormData', 'fetch',
  ].map((key) => [key, globalThis[key]]));
  const inventory = [
    { id: 'inventory_one', canonical_video_id: 'video_one', title: 'Inventory one', transcript_available: true, vtt_available: true, nodes_available: true, rights_status: 'cleared_for', privacy_status: 'pass' },
    { id: 'inventory_two', canonical_video_id: 'video_two', title: 'Inventory two', transcript_available: true, vtt_available: true, nodes_available: true, rights_status: 'cleared_for', privacy_status: 'pass' },
    { id: 'inventory_three', canonical_video_id: 'video_three', title: 'Inventory three', transcript_available: true, vtt_available: true, nodes_available: true, rights_status: 'cleared_for', privacy_status: 'pass' },
  ];
  const sources = inventory.map((row, index) => ({
    id: `source_${index + 1}`,
    canonical_source_id: row.canonical_video_id,
    video_id: row.canonical_video_id,
    title: `Source ${index + 1}`,
    source_type: 'AI_DRAFT',
    source_hash: String(index + 1).repeat(64),
    rights_record_id: `rights_${index + 1}`,
    privacy_redaction_record_id: `privacy_${index + 1}`,
  }));
  const payloads = new Map([
    ['/api/health', { ok: true, service: 'i1q-question-platform', mode: 'LOCAL_SYNTHETIC_DEMO' }],
    ['/api/v1/session', { actor: { id: 'actor_local_demo', roles: ['platform_admin', 'author'] }, session: { expires_at: null, csrf_token: null } }],
    ['/api/v1/dashboard', { inventory_sources: 3, extraction_jobs: 0, candidates: 0, review_assignments: 0, blocked_releases: 0, incidents: 0, governance_unassigned: ['medical_governance_lead'], production_gate: 'BLOCKED' }],
    ['/api/v1/governance', { medical_governance_lead: null }],
    ['/api/v1/resources/feature_flags?limit=200', { total: 0, rows: [] }],
    ['/api/v1/resources/inventory_sources?limit=200', { total: inventory.length, rows: inventory }],
    ['/api/v1/resources/source_records?limit=200', { total: sources.length, rows: sources }],
    ['/api/v1/resources/rights_records?limit=200', { total: 3, rows: [1, 2, 3].map((id) => ({ id: `rights_${id}`, rights_status: 'cleared_for', allowed_uses: ['synthetic_fixture'] })) }],
    ['/api/v1/resources/privacy_redaction_records?limit=200', { total: 3, rows: [1, 2, 3].map((id) => ({ id: `privacy_${id}`, status: 'pass', required_class_metrics: {} })) }],
    ['/api/v1/resources/transcript_artifacts?limit=200', { total: 2, rows: [
      { id: 'artifact_one', inventory_source_id: 'inventory_one' },
      { id: 'artifact_two', inventory_source_id: 'inventory_two' },
    ] }],
    ['/api/v1/resources/normalized_transcript_segments?limit=200', { total: 2, rows: [
      { id: 'segment_one', transcript_artifact_id: 'artifact_one', redacted_text: 'Sanitized segment one', speaker_label: 'Fixture speaker', start_seconds: 1 },
      { id: 'segment_two', transcript_artifact_id: 'artifact_two', redacted_text: 'Sanitized segment two', speaker_label: 'Fixture speaker', start_seconds: 2 },
    ] }],
  ]);
  const settle = () => new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  try {
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.FormData = dom.window.FormData;
    globalThis.fetch = async (path) => ({
      ok: payloads.has(String(path)),
      status: payloads.has(String(path)) ? 200 : 404,
      json: async () => payloads.get(String(path)) || { error: 'not_found' },
    });
    dom.window.confirm = () => true;

    const app = await import(`${appPath.href}?lineage-test=${Date.now()}`);
    await app.bootPromise;
    dom.window.document.querySelector('[data-screen="inventory"]').click();
    await settle();
    dom.window.document.querySelector('[data-action="open-source"][data-id="inventory_two"]').click();
    await settle();
    const sourceText = dom.window.document.querySelector('#screen').textContent;
    assert.match(sourceText, /Source 2/u);
    assert.match(sourceText, /source_2/u);
    assert.doesNotMatch(sourceText, /Source 1/u);

    dom.window.document.querySelector('[data-screen="transcript"]').click();
    await settle();
    const transcriptText = dom.window.document.querySelector('#screen').textContent;
    assert.match(dom.window.document.querySelector('#record-context').textContent, /artifact_two/u);
    assert.match(transcriptText, /Sanitized segment two/u);
    assert.doesNotMatch(transcriptText, /Sanitized segment one/u);
  } finally {
    dom.window.close();
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('accepted editorial reviewers see exact protected answer and rationale content without browser persistence', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4176/' });
  const originalGlobals = Object.fromEntries([
    'document', 'window', 'FormData', 'fetch',
  ].map((key) => [key, globalThis[key]]));
  const revisionHash = 'a'.repeat(64);
  const revision = {
    id: 'itemrev_protected_ui',
    item_id: 'item_protected_ui',
    author_actor_id: 'actor_author_ui',
    content_hash: revisionHash,
    revision_number: 1,
    workflow_status: 'candidate',
    choices: [
      { key: 'A', text: 'Alpha safe wording' },
      { key: 'B', text: 'Beta safe wording' },
      { key: 'C', text: 'Gamma safe wording' },
      { key: 'D', text: 'Delta safe wording' },
    ],
    evidence_claim_ids: ['claim_protected_ui'],
    active_flags: [],
  };
  const assignment = {
    id: 'assignment_protected_ui',
    item_revision_id: revision.id,
    reviewer_id: 'reviewer_protected_ui',
    reviewer_actor_id: 'actor_editor_ui',
    review_type: 'editorial',
    required_role: 'editorial_reviewer',
    exact_revision_hash: revisionHash,
    state: 'accepted',
  };
  const reviewPath = `/api/v1/item-revisions/${revision.id}/review-content?assignment_id=${assignment.id}&purpose=editorial_review`;
  const payloads = new Map([
    ['/api/health', { ok: true, service: 'i1q-question-platform', mode: 'INJECTED_AUTH_ADAPTER' }],
    ['/api/v1/session', {
      actor: { id: 'actor_editor_ui', roles: ['editorial_reviewer'] },
      session: { expires_at: '2099-01-01T00:00:00.000Z', csrf_token: 'synthetic-ui-csrf-token' },
    }],
    ['/api/v1/dashboard', { inventory_sources: 0, extraction_jobs: 0, candidates: 1, review_assignments: 1, blocked_releases: 0, incidents: 0, governance_unassigned: ['medical_governance_lead'], production_gate: 'BLOCKED' }],
    ['/api/v1/governance', { medical_governance_lead: null }],
    ['/api/v1/resources/feature_flags?limit=200', { total: 2, rows: [
      { id: 'flag_internal_platform', key: 'internal_platform_enabled', enabled: true },
      { id: 'flag_internal_review', key: 'internal_review_enabled', enabled: true },
    ] }],
    ['/api/v1/resources/item_revisions?limit=200', { total: 1, rows: [revision] }],
    ['/api/v1/resources/reviewers?limit=200', { total: 1, rows: [{
      id: 'reviewer_protected_ui',
      actor_id: 'actor_editor_ui',
      roles: ['editorial_reviewer'],
      conflict_actor_ids: [],
    }] }],
    ['/api/v1/resources/review_assignments?limit=200', { total: 1, rows: [assignment] }],
    ['/api/v1/resources/evidence_claims?limit=200', { total: 1, rows: [{
      id: 'claim_protected_ui',
      status: 'verified',
      expires_at: '2099-01-01T00:00:00.000Z',
    }] }],
    ['/api/v1/resources/review_events?limit=200', { total: 0, rows: [] }],
    [reviewPath, {
      item_revision_id: revision.id,
      assignment_id: assignment.id,
      exact_revision_hash: revisionHash,
      review_type: 'editorial',
      prompt: 'Which synthetic label is correct?',
      choices: [
        { key: 'A', text: 'Alpha protected wording', why_tempting: 'Alpha lure', why_wrong: 'Alpha mismatch', misconception_id: 'miscon_alpha_ui' },
        { key: 'B', text: 'Beta protected wording', why_tempting: null, why_wrong: null, misconception_id: null },
        { key: 'C', text: 'Gamma protected wording', why_tempting: 'Gamma lure', why_wrong: 'Gamma mismatch', misconception_id: 'miscon_gamma_ui' },
        { key: 'D', text: 'Delta protected wording', why_tempting: 'Delta lure', why_wrong: 'Delta mismatch', misconception_id: 'miscon_delta_ui' },
      ],
      answer: 'B',
      explanation: 'SECRET_UI_TEACHING_EXPLANATION',
      correct_answer_rationale: 'SECRET_UI_CORRECT_RATIONALE',
      source_ids: ['source_protected_ui'],
      evidence_claim_ids: ['claim_protected_ui'],
    }],
  ]);
  const requested = [];
  const settle = () => new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  try {
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.FormData = dom.window.FormData;
    globalThis.fetch = async (path) => {
      requested.push(String(path));
      return {
        ok: payloads.has(String(path)),
        status: payloads.has(String(path)) ? 200 : 404,
        json: async () => structuredClone(payloads.get(String(path)) || { error: 'not_found' }),
      };
    };
    dom.window.confirm = () => true;

    const app = await import(`${appPath.href}?protected-review-test=${Date.now()}`);
    await app.bootPromise;
    dom.window.document.querySelector('[data-screen="editorial"]').click();
    await settle();
    await settle();

    const screen = dom.window.document.querySelector('#screen');
    assert.match(screen.textContent, /Protected review content/u);
    assert.match(screen.textContent, /Answer B/u);
    assert.match(screen.textContent, /SECRET_UI_TEACHING_EXPLANATION/u);
    assert.match(screen.textContent, /SECRET_UI_CORRECT_RATIONALE/u);
    assert.match(screen.textContent, /miscon_alpha_ui/u);
    assert.match(screen.textContent, /source_protected_ui/u);
    assert.ok(screen.querySelector('[data-action="editorial-decision"][data-verdict="pass"]'));
    assert.ok(requested.includes(reviewPath));
    assert.equal(dom.window.localStorage.length, 0);
    assert.equal(dom.window.sessionStorage.length, 0);
  } finally {
    dom.window.close();
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('control boundaries, status reflow, and refresh geometry have deterministic repair rules', async () => {
  const css = await readFile(cssPath, 'utf8');
  const border = css.match(/--control-border:\s*(#[0-9a-f]{6})/iu)?.[1];
  assert.ok(border, 'control border color must be declared');

  const luminance = (hex) => {
    const channels = hex.slice(1).match(/.{2}/gu).map((channel) => Number.parseInt(channel, 16) / 255);
    const [red, green, blue] = channels.map((channel) => (
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    ));
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
  };
  const boundaryContrast = (luminance('#ffffff') + 0.05) / (luminance(border) + 0.05);
  assert.ok(boundaryContrast >= 3, `control border contrast was ${boundaryContrast.toFixed(2)}:1`);

  const badgeRule = css.match(/\.badge\s*\{([\s\S]*?)\}/u)?.[1] || '';
  const iconRule = css.match(/\.icon-button\s*\{([\s\S]*?)\}/u)?.[1] || '';
  assert.match(badgeRule, /max-width:\s*100%/u);
  assert.match(badgeRule, /white-space:\s*normal/u);
  assert.match(css, /\.badge > span\s*\{[\s\S]*?overflow-wrap:\s*anywhere/u);
  assert.match(iconRule, /flex:\s*0 0 44px/u);
  assert.match(iconRule, /min-width:\s*44px/u);
  assert.match(iconRule, /min-height:\s*44px/u);
});

test('wide tables remain contained and pagination labels do not shrink', async () => {
  const css = await readFile(cssPath, 'utf8');
  const mainRule = css.match(/main\s*\{([\s\S]*?)\}/u)?.[1] || '';
  const tableWrapRule = css.match(/\.table-wrap\s*\{([\s\S]*?)\}/u)?.[1] || '';
  const paginationButtonRule = css.match(/\.pagination \.button\s*\{([\s\S]*?)\}/u)?.[1] || '';
  assert.match(mainRule, /overflow-x:\s*clip/u);
  assert.match(tableWrapRule, /position:\s*relative/u);
  assert.match(tableWrapRule, /max-width:\s*100%/u);
  assert.match(tableWrapRule, /overflow-x:\s*auto/u);
  assert.match(paginationButtonRule, /flex:\s*0 0 auto/u);
  assert.match(paginationButtonRule, /white-space:\s*nowrap/u);
});

test('mobile layout preserves operator and environment context', async () => {
  const css = await readFile(cssPath, 'utf8');
  const mobileStart = css.indexOf('@media (max-width: 760px)');
  const mobileEnd = css.indexOf('@media (forced-colors: active)');
  const mobileRules = css.slice(mobileStart, mobileEnd);
  const identityRule = mobileRules.match(/\.identity\s*\{([\s\S]*?)\}/u)?.[1] || '';
  const environmentRule = mobileRules.match(/\.environment-label\s*\{([\s\S]*?)\}/u)?.[1] || '';
  assert.doesNotMatch(identityRule, /display:\s*none/u);
  assert.doesNotMatch(environmentRule, /display:\s*none/u);
  assert.match(identityRule, /white-space:\s*normal/u);
});

test('immutable revision hashes are fully visible without title-only disclosure', async () => {
  const appSource = await readFile(appPath, 'utf8');
  assert.doesNotMatch(appSource, /class="hash-text" title=/u);
  assert.match(appSource, /\['Revision hash', `<span class="hash-text">\$\{escapeHtml\(revision\.content_hash \|\| 'Not supplied'\)\}<\/span>`\]/u);
  assert.match(appSource, /\['Exact revision hash', `<span class="hash-text">\$\{escapeHtml\(revision\.content_hash \|\| 'Not supplied'\)\}<\/span>`\]/u);
  assert.match(appSource, /\['After hash', `<span class="hash-text">\$\{escapeHtml\(after\.content_hash \|\| 'Not supplied'\)\}<\/span>`\]/u);
});

test('resource workflows drain cursor pages instead of silently stopping at 200 rows', async () => {
  const rows = Array.from({ length: 250 }, (_, index) => ({
    id: `source_${String(index).padStart(4, '0')}`,
    title: `Synthetic source ${index}`,
    source_classification: 'synthetic',
    transcript_available: false,
    nodes_available: false,
    privacy_status: 'not_started',
    rights_status: 'not_started',
  }));
  const requestedPages = [];
  const harness = await createUiHarness(baseUiPayloads(), (path) => {
    if (!path.startsWith('/api/v1/resources/inventory_sources?')) return null;
    requestedPages.push(path);
    const url = new URL(path, 'http://127.0.0.1');
    const cursor = url.searchParams.get('cursor');
    if (!cursor) {
      return {
        status: 200,
        payload: { rows: rows.slice(0, 200), total: rows.length, next_cursor: rows[199].id },
      };
    }
    assert.equal(cursor, rows[199].id);
    return {
      status: 200,
      payload: { rows: rows.slice(200), total: rows.length, next_cursor: null },
    };
  });

  try {
    const { document } = harness.dom.window;
    document.querySelector('[data-screen="inventory"]').click();
    await harness.waitFor(() => document.querySelectorAll('[aria-label="Source inventory table"] tbody tr').length === 250);
    assert.equal(requestedPages.length, 2);
    assert.match(document.querySelector('#screen').textContent, /Synthetic source 249/u);
  } finally {
    harness.restore();
  }
});

test('authoring clears and disables the correct option while preserving wrong-option requirements and If-Match', async () => {
  const revisionHash = 'b'.repeat(64);
  const revision = {
    id: 'itemrev_authoring_repair',
    item_id: 'item_authoring_repair',
    content_hash: revisionHash,
    revision_number: 1,
    workflow_status: 'draft',
    concept_id: 'concept_authoring_repair',
    source_ids: ['source_authoring_repair'],
    evidence_claim_ids: ['claim_authoring_repair'],
    choices: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Choice ${key}` })),
  };
  let draftPatch = null;
  const payloads = baseUiPayloads([
    ['/api/v1/resources/item_revisions?limit=200', { total: 1, rows: [revision] }],
    [`/api/v1/resources/item_revisions/${revision.id}`, revision],
    ['/api/v1/resources/source_records?limit=200', { total: 1, rows: [{ id: 'source_authoring_repair', title: 'Synthetic source' }] }],
    ['/api/v1/resources/evidence_claims?limit=200', { total: 1, rows: [{ id: 'claim_authoring_repair', status: 'verified' }] }],
  ]);
  const harness = await createUiHarness(payloads, (path, options) => {
    if (path === `/api/v1/item-revisions/${revision.id}/draft` && options.method === 'PATCH') {
      draftPatch = options;
      return { status: 200, payload: revision };
    }
    return null;
  });

  try {
    const { document } = harness.dom.window;
    document.querySelector('[data-screen="editor"]').click();
    await harness.waitFor(() => document.querySelector('#editor-form'));
    const form = document.querySelector('#editor-form');
    for (const key of ['A', 'B', 'C', 'D']) {
      for (const prefix of ['tempting', 'wrong', 'misconception']) {
        form.elements.namedItem(`${prefix}_${key}`).value = `${prefix}-${key}`;
      }
    }

    const answer = form.elements.namedItem('answer');
    answer.value = 'B';
    answer.dispatchEvent(new harness.dom.window.Event('change', { bubbles: true }));
    for (const prefix of ['tempting', 'wrong', 'misconception']) {
      const field = form.elements.namedItem(`${prefix}_B`);
      assert.equal(field.disabled, true);
      assert.equal(field.required, false);
      assert.equal(field.value, '');
    }

    answer.value = 'C';
    answer.dispatchEvent(new harness.dom.window.Event('change', { bubbles: true }));
    for (const prefix of ['tempting', 'wrong', 'misconception']) {
      const restored = form.elements.namedItem(`${prefix}_B`);
      assert.equal(restored.disabled, false);
      assert.equal(restored.required, true);
      restored.value = `${prefix}-B-restored`;
      const newlyCorrect = form.elements.namedItem(`${prefix}_C`);
      assert.equal(newlyCorrect.disabled, true);
      assert.equal(newlyCorrect.required, false);
      assert.equal(newlyCorrect.value, '');
    }
    form.elements.namedItem('correct_answer_rationale').value = 'Correct rationale';
    form.elements.namedItem('explanation').value = 'Teaching explanation';
    form.elements.namedItem('prompt').value = 'Which synthetic option is correct?';
    form.dispatchEvent(new harness.dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await harness.waitFor(() => draftPatch !== null, 'draft PATCH was not sent');

    assert.equal(draftPatch.headers['If-Match'], revisionHash);
    const body = JSON.parse(draftPatch.body);
    assert.equal(body.answer, 'C');
    const correct = body.choices.find((choice) => choice.key === 'C');
    assert.deepEqual(
      [correct.why_tempting, correct.why_wrong, correct.misconception_id],
      [null, null, null],
    );
    for (const wrong of body.choices.filter((choice) => choice.key !== 'C')) {
      assert.ok(wrong.why_tempting);
      assert.ok(wrong.why_wrong);
      assert.ok(wrong.misconception_id);
    }
  } finally {
    harness.restore();
  }
});

test('revision comparison requires one selected item and derives only an exact same-item pair', async () => {
  const revisions = [
    { id: 'itemrev_alpha_1', item_id: 'item_alpha', revision_number: 1, content_hash: '1'.repeat(64), prompt: 'Alpha before', choices: [] },
    { id: 'itemrev_beta_1', item_id: 'item_beta', revision_number: 2, content_hash: '2'.repeat(64), prompt: 'Beta before', choices: [] },
    { id: 'itemrev_alpha_2', item_id: 'item_alpha', revision_number: 3, content_hash: '3'.repeat(64), prompt: 'Alpha after', choices: [] },
    { id: 'itemrev_beta_2', item_id: 'item_beta', revision_number: 4, content_hash: '4'.repeat(64), prompt: 'Beta after', choices: [] },
  ];
  const harness = await createUiHarness(baseUiPayloads([
    ['/api/v1/resources/item_revisions?limit=200', { total: revisions.length, rows: revisions }],
  ]));

  try {
    const { document } = harness.dom.window;
    document.querySelector('[data-screen="diff"]').click();
    await harness.waitFor(() => document.querySelector('#diff-selection-form'));
    assert.equal(document.querySelector('#revision-diff-heading'), null);
    assert.match(document.querySelector('#screen').textContent, /Select one item/u);

    const itemSelect = document.querySelector('#diff-item-id');
    itemSelect.value = 'item_alpha';
    itemSelect.dispatchEvent(new harness.dom.window.Event('change', { bubbles: true }));
    await harness.waitFor(() => document.querySelector('[data-item-id="item_alpha"]'));

    const comparison = document.querySelector('[data-item-id="item_alpha"]');
    assert.equal(comparison.dataset.beforeRevisionId, 'itemrev_alpha_1');
    assert.equal(comparison.dataset.afterRevisionId, 'itemrev_alpha_2');
    assert.match(comparison.textContent, /Alpha before/u);
    assert.match(comparison.textContent, /Alpha after/u);
    assert.doesNotMatch(comparison.textContent, /Beta before|Beta after/u);
    for (const name of ['before_revision_id', 'after_revision_id']) {
      const values = [...document.querySelector(`[name="${name}"]`).options].map((option) => option.value).filter(Boolean);
      assert.deepEqual(values, ['itemrev_alpha_1', 'itemrev_alpha_2']);
    }
  } finally {
    harness.restore();
  }
});

test('release assembly posts the deliberately selected exact revision instead of the global maximum', async () => {
  const selectedHash = 'a'.repeat(64);
  const globalMaximumHash = 'f'.repeat(64);
  const revisions = [
    {
      id: 'itemrev_selected_exact',
      item_id: 'item_selected',
      revision_number: 1,
      content_hash: selectedHash,
      workflow_status: 'approved',
      evidence_claim_ids: ['claim_selected'],
    },
    {
      id: 'itemrev_global_maximum',
      item_id: 'item_other',
      revision_number: 99,
      content_hash: globalMaximumHash,
      workflow_status: 'approved',
      evidence_claim_ids: ['claim_other'],
    },
  ];
  const events = revisions.map((revision, index) => ({
    id: `event_${index}`,
    item_revision_id: revision.id,
    review_type: 'medical',
    verdict: 'pass',
    to_status: 'approved',
    exact_revision_hash: revision.content_hash,
  }));
  let releasePost = null;
  const payloads = baseUiPayloads([
    ['/api/v1/resources/release_snapshots?limit=200', { total: 0, rows: [] }],
    ['/api/v1/resources/item_revisions?limit=200', { total: revisions.length, rows: revisions }],
    ['/api/v1/resources/review_events?limit=200', { total: events.length, rows: events }],
    ['/api/v1/resources/evidence_claims?limit=200', { total: 2, rows: [
      { id: 'claim_selected', status: 'verified', expires_at: '2099-01-01T00:00:00.000Z' },
      { id: 'claim_other', status: 'verified', expires_at: '2099-01-01T00:00:00.000Z' },
    ] }],
    ['/api/v1/resources/feature_flags?limit=200', { total: 3, rows: [
      { id: 'flag_student_release', key: 'student_release_enabled', enabled: false },
      { id: 'flag_stat_adapter', key: 'stat_adapter_enabled', enabled: false },
      { id: 'flag_drills_adapter', key: 'drills_adapter_enabled', enabled: false },
    ] }],
  ]);
  const harness = await createUiHarness(payloads, (path, options) => {
    if (path === '/api/v1/releases' && options.method === 'POST') {
      releasePost = options;
      return { status: 200, payload: { release: { id: 'release_selected_exact' } } };
    }
    return null;
  });

  try {
    const { document } = harness.dom.window;
    document.querySelector('[data-screen="release"]').click();
    await harness.waitFor(() => document.querySelector('#release-revision'));
    assert.equal(document.querySelector('[data-action="assemble-release"]'), null);

    const selector = document.querySelector('#release-revision');
    selector.value = 'itemrev_selected_exact';
    selector.dispatchEvent(new harness.dom.window.Event('change', { bubbles: true }));
    await harness.waitFor(() => document.querySelector('[data-action="assemble-release"]'));
    const assemble = document.querySelector('[data-action="assemble-release"]');
    assert.equal(assemble.dataset.revisionId, 'itemrev_selected_exact');
    assert.equal(assemble.dataset.revisionHash, selectedHash);
    assemble.click();
    await harness.waitFor(() => releasePost !== null, 'release POST was not sent');
    assert.deepEqual(JSON.parse(releasePost.body).itemRevisionIds, ['itemrev_selected_exact']);
  } finally {
    harness.restore();
  }
});

test('initial authentication failure focuses the deterministic error heading', async () => {
  const harness = await createUiHarness(baseUiPayloads(), (path) => (
    path === '/api/v1/session'
      ? { status: 401, payload: { error: 'authentication_required' } }
      : null
  ));

  try {
    const { document } = harness.dom.window;
    const heading = document.querySelector('#view-error-heading');
    assert.ok(heading);
    assert.equal(heading.tagName, 'H2');
    assert.equal(document.activeElement, heading);
    assert.equal(document.querySelector('#screen [data-state="unauthorized"]')?.getAttribute('role'), 'alert');
  } finally {
    harness.restore();
  }
});

test('expired, revoked, and provider-outage sessions render distinct focused recovery states', async () => {
  const cases = [
    ['session_expired', 401, 'session-expired', 'Session expired'],
    ['session_revoked', 401, 'session-revoked', 'Access revoked'],
    ['identity_adapter_unavailable', 503, 'identity-outage', 'Identity service unavailable'],
  ];
  for (const [code, status, stateId, headingText] of cases) {
    const harness = await createUiHarness(baseUiPayloads(), (path) => (
      path === '/api/v1/session' ? { status, payload: { error: code } } : null
    ));
    try {
      const { document } = harness.dom.window;
      const heading = document.querySelector('#view-error-heading');
      assert.equal(document.querySelector('#screen [data-state]')?.dataset.state, stateId);
      assert.equal(heading.textContent, headingText);
      assert.equal(document.activeElement, heading);
    } finally {
      harness.restore();
    }
  }
});

test('canonical logout clears the in-memory workspace and focuses a signed-out return state without confirmation', async () => {
  const revision = {
    id: 'itemrev_logout_memory',
    item_id: 'item_logout_memory',
    content_hash: '9'.repeat(64),
    revision_number: 1,
    workflow_status: 'draft',
    concept_id: 'concept_logout_memory',
    source_ids: ['source_logout_memory'],
    evidence_claim_ids: ['claim_logout_memory'],
    choices: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Choice ${key}` })),
  };
  let logoutRequest = null;
  const payloads = baseUiPayloads([
    ['/api/health', { ok: true, service: 'i1q-question-platform', mode: 'INJECTED_AUTH_ADAPTER' }],
    ['/api/v1/resources/item_revisions?limit=200', { total: 1, rows: [revision] }],
    ['/api/v1/resources/source_records?limit=200', { total: 1, rows: [{ id: 'source_logout_memory', title: 'Synthetic source' }] }],
    ['/api/v1/resources/evidence_claims?limit=200', { total: 1, rows: [{ id: 'claim_logout_memory', status: 'verified' }] }],
  ]);
  const harness = await createUiHarness(payloads, (path, options) => {
    if (path === '/api/v1/logout' && options.method === 'POST') {
      logoutRequest = options;
      return { status: 200, payload: { logged_out: true } };
    }
    return null;
  });

  try {
    const { document } = harness.dom.window;
    let confirmationCount = 0;
    harness.dom.window.confirm = () => {
      confirmationCount += 1;
      return true;
    };
    document.querySelector('[data-screen="editor"]').click();
    await harness.waitFor(() => document.querySelector('#editor-form'));
    assert.match(document.querySelector('#record-context').textContent, /itemrev_logout_memory/u);

    const logout = document.querySelector('#logout-button');
    assert.equal(logout.hidden, false);
    assert.match(document.querySelector('#actor-identity').textContent, /Roles: platform admin, author, editorial reviewer/u);
    assert.match(document.querySelector('#actor-identity').textContent, /Session active until/u);
    logout.click();
    await harness.waitFor(() => document.querySelector('#signed-out-heading'));

    assert.ok(logoutRequest);
    assert.equal(logoutRequest.headers['X-CSRF-Token'], 'ui-repair-csrf');
    assert.equal(confirmationCount, 0);
    assert.equal(document.activeElement, document.querySelector('#signed-out-heading'));
    assert.doesNotMatch(document.querySelector('#screen').textContent, /itemrev_logout_memory/u);
    assert.equal(document.querySelector('#record-context').hidden, true);
    assert.equal(document.querySelector('#logout-button').hidden, true);
    assert.equal(document.querySelector('#refresh-button').disabled, true);
    assert.ok([...document.querySelectorAll('[data-screen]')].every((button) => button.disabled));
    assert.equal(harness.dom.window.localStorage.length, 0);
    assert.equal(harness.dom.window.sessionStorage.length, 0);
  } finally {
    harness.restore();
  }
});
