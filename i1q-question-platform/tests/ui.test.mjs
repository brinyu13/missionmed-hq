import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const htmlPath = new URL('../public/index.html', import.meta.url);
const cssPath = new URL('../public/styles.css', import.meta.url);
const appPath = new URL('../public/app.js', import.meta.url);

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
