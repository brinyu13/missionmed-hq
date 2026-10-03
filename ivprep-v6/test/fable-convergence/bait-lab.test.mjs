import test from 'node:test';
import assert from 'node:assert/strict';
import { detectHooks, evaluateBite, assistHooks, lemma, tokens } from '../../public/studio-fable/app/brain/hook-detector.mjs';
import { HOOK_FIXTURES } from '../../public/studio-fable/fixtures/hooks/hook-fixtures.mjs';
import { mountBaitLab } from '../../public/studio-fable/app/bait-lab.mjs';

const byId = new Map(HOOK_FIXTURES.map((f) => [f.id, f]));
const run = (fixture) => detectHooks({ question: fixture.question, answer: fixture.answer, priorTurns: fixture.priorTurns || [], context: fixture.context || {}, policy: fixture.policy || {} });
const includesLemma = (text, stems) => { const toks = tokens(text).join(' '); return stems.some((s) => toks.includes(lemma(s)) || text.toLowerCase().includes(s)); };

for (const fixture of HOOK_FIXTURES) {
  test(`${fixture.id} · ${fixture.label}`, () => {
    const report = run(fixture);
    const e = fixture.expect;
    assert.equal(report.decision, e.decision, `decision (reasons: ${report.reasons.join(',')}; top=${JSON.stringify(report.hooks[0]?.span?.text)} total=${report.hooks[0]?.total})`);
    if (e.notFollow) assert.notEqual(report.decision, 'FOLLOW_HOOK');
    if (e.categoryIn) assert.ok(report.primary && e.categoryIn.includes(report.primary.category), `category ${report.primary?.category} not in ${e.categoryIn}`);
    if (e.spanIncludes) for (const s of e.spanIncludes) assert.ok(report.primary?.span?.text?.toLowerCase().includes(s.toLowerCase()), `span "${report.primary?.span?.text}" lacks "${s}"`);
    if (e.followUpLemmas) assert.ok(includesLemma(report.primary?.suggestedFollowUp || '', e.followUpLemmas), `follow-up "${report.primary?.suggestedFollowUp}" lacks ${e.followUpLemmas}`);
    if (e.markerPresent) assert.equal(report.primary?.markerPresent, true);
    if (e.flags) for (const [k, v] of Object.entries(e.flags)) assert.equal(report.flags[k], v, `flag ${k}`);
    if (e.topResolved) assert.equal(report.hooks[0]?.resolvedInAnswer, true, 'top hook should be resolved in answer');
    if (e.topGuarded) { assert.equal(report.hooks[0]?.guarded, true); assert.equal(report.hooks[0]?.total, 0); }
    if (e.primaryPresent) assert.ok(report.primary, 'primary should be recorded even when blocked');
    if (e.blockedBy) assert.equal(report.blockedBy, e.blockedBy);
    if (e.deferredCount != null) assert.equal(report.hooks.filter((h) => h.deferred).length, e.deferredCount);
    if (e.compareHigherThan) {
      const other = run(byId.get(e.compareHigherThan));
      assert.ok(report.primary.total > other.primary.total, `${report.primary.total} should exceed ${other.primary.total}`);
    }
  });
}

test('guarded hook never leaks its span into the follow-up', () => {
  const report = run(byId.get('HK-N08'));
  const guarded = report.hooks.find((h) => h.guarded);
  assert.ok(guarded);
  assert.equal(report.primary, null);
});

test('determinism: 100 runs of every fixture are byte-identical', () => {
  for (const fixture of HOOK_FIXTURES) {
    const first = JSON.stringify(run(fixture));
    for (let i = 0; i < 100; i += 1) assert.equal(JSON.stringify(run(fixture)), first, fixture.id);
  }
});

test('maxDepth 0 (admin intensity 0) never follows', () => {
  for (const fixture of HOOK_FIXTURES) {
    const report = detectHooks({ question: fixture.question, answer: fixture.answer, priorTurns: fixture.priorTurns || [], policy: { ...(fixture.policy || {}), maxDepth: 0 } });
    assert.notEqual(report.decision, 'FOLLOW_HOOK', fixture.id);
    assert.notEqual(report.decision, 'PROBE_VAGUE', fixture.id);
  }
});

test('evaluateBite: interviewer question overlapping the hook counts as taken', () => {
  const report = run(byId.get('HK-P01'));
  assert.equal(evaluateBite(report.primary, 'What happened with your son yesterday?').taken, true);
  assert.equal(evaluateBite(report.primary, 'Tell me about your research in Boston.').taken, false);
});

test('assistHooks: unknown id or guarded phrasing is rejected; decision never changes', () => {
  const report = run(byId.get('HK-E02'));
  assert.equal(assistHooks(report, { rerank: ['nope'] }).status, 'ASSIST_REJECTED');
  assert.equal(assistHooks(report, { phrasing: { [report.hooks[0].id]: 'Tell me about your medical condition' } }).status, 'ASSIST_REJECTED');
  const applied = assistHooks(report, { rerank: [report.hooks[1].id, report.hooks[0].id], phrasing: { [report.hooks[0].id]: 'What happened with your son?' } });
  assert.equal(applied.status, 'ASSIST_APPLIED');
  assert.equal(applied.report.decision, report.decision);
  assert.equal(applied.report.primary.id, report.primary.id);
});

// Tiny view-only DOM doubles: no browser, media, provider or persistence runtime.
class Element {
  constructor() { this.innerHTML = ''; this.value = ''; this.listeners = new Map(); this.attrs = {}; this.removed = false; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  removeEventListener(type, handler) { if (this.listeners.get(type) === handler) this.listeners.delete(type); }
  setAttribute(name, value) { this.attrs[name] = value; }
  remove() { this.removed = true; }
}
class Main {
  constructor() { this.writes = 0; this.html = ''; }
  set innerHTML(value) {
    this.writes++; this.html = value;
    this.lab = new Element(); this.text = new Element(); this.output = new Element(); this.list = new Element();
    this.buttons = HOOK_FIXTURES.map(f => { const b = new Element(); b.dataset = { id: f.id }; b.closest = () => b; return b; });
    this.lab.querySelector = selector => ({ '#bait-text': this.text, '#bait-report': this.output, '#bait-list': this.list })[selector];
    this.lab.querySelectorAll = () => this.buttons;
  }
  querySelector(selector) { return selector === '[data-bait-lab]' ? this.lab : null; }
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function adminHarness({ bootstrap } = {}) {
  const main = new Main(), calls = [];
  const account = { mode: 'REAL', subject: 'wp:1', role: 'admin', api: { bootstrap: async () => {
    calls.push('bootstrap');
    return bootstrap ? bootstrap() : { entitlement: { admitted: true }, identity: { subject: 'wp:1', admin: true } };
  } } };
  const controller = { account };
  const loadFixtures = async () => { calls.push('fixtures'); assert.equal(main.writes, 0); return { HOOK_FIXTURES }; };
  return { main, controller, calls, loadFixtures, options: { controller, loadFixtures } };
}

test('all 34 fictional donor fixtures and expectation fields remain in the QA pack', () => {
  assert.equal(HOOK_FIXTURES.length, 34); assert.equal(new Set(HOOK_FIXTURES.map(f => f.id)).size, 34);
  assert.equal(HOOK_FIXTURES.filter(f => f.id.startsWith('HK-P')).length, 15);
  assert.equal(HOOK_FIXTURES.filter(f => f.id.startsWith('HK-N')).length, 11);
  assert.equal(HOOK_FIXTURES.filter(f => f.id.startsWith('HK-E')).length, 8);
});

test('Bait Lab requires fresh exact admitted Admin actor before fixture import or render', async () => {
  const h = adminHarness(); const dispose = await mountBaitLab(h.main, h.options);
  assert.deepEqual(h.calls, ['bootstrap', 'fixtures']); assert.equal(h.main.writes, 1);
  assert.match(h.main.html, /OFFLINE FICTIONAL TEACHING-RULE QA/);
  assert.match(h.main.html, /does not control or certify the native realtime InterviewBrain/);
  assert.match(h.main.html, /No camera, microphone, provider session, account session or saved Results are created/);
  assert.match(h.main.html, /fictional fixtures/); assert.match(h.main.output.innerHTML, /Offline rule decision/);
  dispose();
});

test('cached student, malformed actor and stale initial view cannot import fixtures', async () => {
  for (const patch of [{ role: 'student' }, { subject: 'wp:0' }, { mode: 'DEMO' }]) {
    const h = adminHarness(); Object.assign(h.controller.account, patch);
    await assert.rejects(mountBaitLab(h.main, h.options), /current admitted Admin/);
    assert.deepEqual(h.calls, []); assert.equal(h.main.writes, 0);
  }
  const h = adminHarness(); const dispose = await mountBaitLab(h.main, { ...h.options, isCurrent: () => false });
  assert.deepEqual(h.calls, []); assert.equal(h.main.writes, 0); dispose();
});

test('revoked admission, downgraded or replaced identity fail before fictional import/render', async () => {
  for (const payload of [
    { entitlement: { admitted: false }, identity: { subject: 'wp:1', admin: true } },
    { entitlement: { admitted: 'true' }, identity: { subject: 'wp:1', admin: true } },
    { entitlement: { admitted: true }, identity: { subject: 'wp:1', admin: false } },
    { entitlement: { admitted: true }, identity: { subject: 'wp:1', admin: 'true' } },
    { entitlement: { admitted: true }, identity: { subject: 'wp:2', admin: true } },
  ]) {
    const h = adminHarness({ bootstrap: () => payload });
    await assert.rejects(mountBaitLab(h.main, h.options), /Admin access changed/);
    assert.deepEqual(h.calls, ['bootstrap']); assert.equal(h.main.writes, 0);
  }
});

test('bootstrap failure leaves fixtures unimported and the current view untouched', async () => {
  const h = adminHarness({ bootstrap: () => { throw new Error('bootstrap unavailable'); } });
  await assert.rejects(mountBaitLab(h.main, h.options), /bootstrap unavailable/);
  assert.deepEqual(h.calls, ['bootstrap']); assert.equal(h.main.writes, 0);
});

test('stale account or view during fresh bootstrap prevents fictional import/render', async () => {
  for (const change of ['account', 'subject', 'view']) {
    const wait = deferred(), h = adminHarness({ bootstrap: () => wait.promise }); let current = true;
    const pending = mountBaitLab(h.main, { ...h.options, isCurrent: () => current });
    if (change === 'account') h.controller.account = { ...h.controller.account };
    else if (change === 'subject') h.controller.account.subject = 'wp:2';
    else current = false;
    wait.resolve({ entitlement: { admitted: true }, identity: { subject: 'wp:1', admin: true } });
    const dispose = await pending; dispose(); assert.deepEqual(h.calls, ['bootstrap']); assert.equal(h.main.writes, 0);
  }
});

test('stale actor or view while fictional module loads cannot render a late Admin page', async () => {
  for (const change of ['account', 'view']) {
    const wait = deferred(), started = deferred(), h = adminHarness(); let current = true;
    const pending = mountBaitLab(h.main, { ...h.options, isCurrent: () => current,
      loadFixtures: () => { started.resolve(); return wait.promise; } });
    await started.promise;
    if (change === 'account') h.controller.account = { ...h.controller.account };
    else current = false;
    wait.resolve({ HOOK_FIXTURES }); const dispose = await pending; dispose(); assert.equal(h.main.writes, 0);
  }
});

test('actual lab composition selects all 34 fixtures and renders detector report/score factors', async () => {
  const h = adminHarness(); const dispose = await mountBaitLab(h.main, h.options);
  for (const [n, fixture] of HOOK_FIXTURES.entries()) {
    h.main.list.listeners.get('click')({ target: h.main.buttons[n] });
    assert.equal(h.main.text.value, fixture.answer);
    assert.match(h.main.output.innerHTML, new RegExp(fixture.expect.decision));
    assert.match(h.main.output.innerHTML, /fixture decision expectation/);
    assert.equal(h.main.buttons.filter(b => b.attrs['aria-pressed'] === 'true').length, 1);
    if (run(fixture).hooks.length) assert.match(h.main.output.innerHTML, /d\d.*s\d.*r\d.*v\d.*a\d.*i\d/);
  }
  dispose(); assert.equal(h.main.text.value, ''); assert.equal(h.main.output.innerHTML, '');
  assert.equal(h.main.list.listeners.size, 0); assert.equal(h.main.text.listeners.size, 0); assert.equal(h.main.lab.removed, true);
});

test('fictional edits rerun the actual detector, escape markup and are cleared on stale actor', async () => {
  const h = adminHarness(); const dispose = await mountBaitLab(h.main, h.options);
  h.main.text.value = 'Actually, there was a really interesting teaching moment with my son <img src=x onerror=alert(1)> yesterday.';
  h.main.text.listeners.get('input')();
  assert.match(h.main.output.innerHTML, /&lt;img/); assert.doesNotMatch(h.main.output.innerHTML, /<img/);
  h.controller.account = { ...h.controller.account, subject: 'wp:2' };
  h.main.text.listeners.get('input')();
  assert.equal(h.main.text.value, ''); assert.equal(h.main.output.innerHTML, ''); assert.equal(h.main.lab.removed, true); dispose();
});
