import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildComparisonSelection } from '../../public/studio/presentation-view-model.mjs';
import { buildLongitudinalModel, compareAttempts } from '../../public/studio/longitudinal-model.mjs';
const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const readCode = between('async function readComparisonDetails(', '\nasync function renderTeachingComparison(');
const renderCode = between('async function renderTeachingComparison(', '\nasync function renderCompare(');
const openCode = between('async function openLastSavedFilmRoom(', '\nasync function analyzeLastAnswer(');
const selection = { baseline: { id: 'a' }, current: { id: 'b' } };
const ownerRows = ['a', 'b'].map(id => ({ id, ownerSubject: 'wp:1' }));
const reader = state => new Function('state', `${readCode}; return readComparisonDetails;`)(
  { admission: { identity: { subject: 'wp:1' } }, ...state });
const scope = () => ({ subject: 'wp:1', adminReview: false, isCurrent: () => true });

test('actual detail reader binds omitted owner only from fresh exact own-library receipts', async () => {
  const calls = [];
  const read = reader({ durable: { library: async mode => { calls.push(mode); return { sessions: ownerRows.map(({ id }) => ({ id })) }; },
    api: { session: async id => { calls.push(id); return { id }; } } } });
  assert.deepEqual(await read(selection, scope()), ownerRows);
  assert.deepEqual(calls, ['own', 'a', 'b']);
  let callsUnderWrongActor = 0;
  const wrongActor = reader({ admission: { identity: { subject: 'wp:2' } },
    durable: { library: async () => callsUnderWrongActor++ } });
  await assert.rejects(wrongActor(selection, scope()), /account changed/);
  assert.equal(callsUnderWrongActor, 0);
  for (const rows of [[], [ownerRows[0]], [...ownerRows, ownerRows[0]], ownerRows.map(r => ({ ...r, ownerSubject: 'wp:2' }))]) {
    let reads = 0;
    const invalid = reader({ durable: { library: async () => ({ sessions: rows }), api: { session: async () => reads++ } } });
    await assert.rejects(invalid(selection, scope())); assert.equal(reads, 0);
  }
  for (const bad of [{ id: 'foreign' }, { id: 'a', ownerSubject: 'wp:2' }]) {
    const invalid = reader({ durable: { library: async () => ({ sessions: ownerRows }), api: { session: async id => id === 'a' ? bad : { id } } } });
    await assert.rejects(invalid(selection, scope()), /identity changed/);
  }
});

test('reader drops stale own/admin responses and preserves explicit Admin subject', async () => {
  for (const stage of ['library', 'detail']) {
    let current = true, reads = 0;
    const read = reader({ durable: { library: async () => { if (stage === 'library') current = false; return { sessions: ownerRows }; },
      api: { session: async id => { reads++; current = false; return { id }; } } } });
    assert.equal(await read(selection, { ...scope(), isCurrent: () => current }), null);
    assert.equal(reads, stage === 'library' ? 0 : 2);
  }
  const seen = [];
  const read = reader({ adminLibrary: { sessionForStudent: async args => { seen.push(args); return { id: args.sessionId, ownerSubject: args.subject }; } } });
  assert.deepEqual(await read(selection, { ...scope(), adminReview: true, subject: 'wp:142' }),
    ['a', 'b'].map(id => ({ id, ownerSubject: 'wp:142' })));
  assert.deepEqual(seen.map(r => r.subject), ['wp:142', 'wp:142']);
});

class Element {
  constructor(tag, cls, text = '') { this.tag = tag; this.className = cls; this.textContent = text; this.children = []; this.listeners = {}; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener(event, fn) { this.listeners[event] = fn; }
  setAttribute(name, value) { this[name] = value; }
}
const el = (...args) => new Element(...args);
const all = node => [node, ...node.children.flatMap(all)];
const model = () => ({ available: true, ...Object.fromEntries(['baseline', 'current'].map((key, index) => [key, {
  sessionId: index ? 'b' : 'a', recordingId: index ? 'rb' : 'ra', durationMs: 20000,
  coaching: { strongest: null, improvement: { text: `saved claim ${key}`, refs: ['seg-1'] }, drill: null, confidence: {} },
  moments: [{ ref: 'seg-1', available: true, startMs: index ? 9000 : 2000, endMs: index ? 10000 : 3000, label: `${key} cited moment` }],
}])) });
function harness({ read, build, open } = {}) {
  const original = {}, state = { view: 'compare', lastSaved: original }, host = el('section');
  let current = true, active = true;
  const opened = [], reads = [];
  const opts = { subject: 'wp:1', adminReview: false, isCurrent: () => current && state.lastSaved === original,
    isScopeCurrent: () => active };
  const render = new Function('state', 'el', 'readComparisonDetails', 'buildTeachingComparison', 'openLastSavedFilmRoom', 'debriefConfidenceCopy',
    `${renderCode}; return renderTeachingComparison;`)(state, el, async (...args) => {
      reads.push(args); return read ? read(...args) : ['a', 'b'].map(id => ({ id, recording: { id: `r${id}` } }));
    }, build || model, async (action, options) => { opened.push({ saved: state.lastSaved, options });
      if (open) return open(action, options); state.view = 'filmroom'; }, () => 'No performance score.');
  return { state, original, host, opts, reads, opened, render: () => render(host, selection, opts),
    stale: () => { current = false; }, revoke: () => { active = false; } };
}

test('actual comparison cards replay each exact attempt with distinct offsets, paused and freshly authorized', async () => {
  for (const index of [0, 1]) {
    const h = harness(); await h.render();
    const buttons = all(h.host).filter(n => n.tag === 'button');
    assert.equal(buttons.length, 2); assert.equal(h.opened.length, 0);
    await buttons[index].listeners.click();
    assert.equal(h.reads.length, 2);
    assert.equal(h.opened.length, 1);
    const { saved, options } = h.opened[0];
    assert.equal(saved.session.id, index ? 'b' : 'a');
    assert.equal(saved.recording.recording.id, index ? 'rb' : 'ra');
    assert.equal(options.moment.startMs, index ? 9000 : 2000);
    assert.equal(options.autoplay, false);
    assert.equal(options.expectedSaved, saved); assert.equal(options.canContinue(), true);
    h.revoke(); assert.equal(options.canContinue(), false);
  }
});

test('stale selection and refreshed recording/range changes cannot open a prior citation', async () => {
  const stale = harness(); await stale.render(); stale.stale();
  await all(stale.host).find(n => n.tag === 'button').listeners.click();
  assert.equal(stale.opened.length, 0); assert.equal(stale.reads.length, 1);
  for (const change of ['recording', 'time', 'missing']) {
    let builds = 0;
    const h = harness({ build: () => { const value = model();
      if (++builds > 1) {
        if (change === 'recording') value.baseline.recordingId = 'replacement';
        if (change === 'time') value.baseline.moments[0].startMs++;
        if (change === 'missing') value.available = false;
      } return value; } });
    await h.render(); await all(h.host).find(n => n.tag === 'button').listeners.click();
    assert.equal(h.opened.length, 0); assert.equal(h.state.lastSaved, h.original);
    assert.ok(all(h.host).some(n => /could not be opened/.test(n.textContent)));
  }
  let calls = 0; const race = harness({ read: async () => {
    if (++calls === 2) race.stale(); return [{ id: 'a' }, { id: 'b' }];
  } });
  await race.render(); await all(race.host).find(n => n.tag === 'button').listeners.click();
  assert.equal(race.opened.length, 0);
});

test('unavailable or failed teaching evidence does not invent claims; failed replay restores selection', async () => {
  const absent = harness({ build: () => ({ available: false, reason: 'Source-bound coaching unavailable.' }) });
  await absent.render(); assert.equal(all(absent.host).filter(n => n.tag === 'button').length, 0);
  assert.ok(all(absent.host).some(n => /unavailable/.test(n.textContent)));
  const error = harness({ read: () => { throw new Error('private backend detail'); } });
  await error.render(); assert.ok(all(error.host).some(n => /measured comparison above is still available/.test(n.textContent)));
  assert.ok(!all(error.host).some(n => /private backend detail/.test(n.textContent)));
  const replay = harness({ open: async () => {} }); await replay.render();
  await all(replay.host).find(n => n.tag === 'button').listeners.click();
  assert.equal(replay.state.lastSaved, replay.original);
  assert.ok(all(replay.host).some(n => /Private replay could not open/.test(n.textContent)));
});

test('actual Film Room discards scoped replay after role/pair/actor guard changes while signing', async () => {
  let valid = true;
  const saved = { session: { recording: { id: 'ra' } } };
  const state = { lastSaved: saved, view: 'compare', role: 'student', durable: { playback: async () => {
    valid = false; return { url: 'https://private.invalid/ra' };
  } } };
  let painted = 0;
  const open = new Function('state', '$', 'isAdminReview', 'adminReviewGate', 'mayPresentSavedReview', 'renderFilmRoomSpine',
    `let playbackReviewRequest=0; ${openCode}; return openLastSavedFilmRoom;`)(state, () => null, () => false, {}, () => true, () => painted++);
  await open(null, { autoplay: false, expectedSaved: saved, canContinue: () => valid });
  assert.equal(painted, 0); assert.equal(state.view, 'compare');
});

test('actual Compare retains metrics and gates teaching reads across actor/role/view changes', async () => {
  const renderCompareCode = between('async function renderCompare(', '\nlet vaultRenderId');
  const attempts = ['b', 'a'].map((id, index) => ({ id, at: 20 - index, title: 'Prompt', questionId: 'q1',
    ownerSubject: null, sessionType: 'question', interviewerProvider: 'missionmed-static', evidenceVersion: 'v1',
    metrics: { answerDurationMs: 2000 + index } }));
  for (const changed of [null, 'actor', 'role', 'view']) {
    const state = { role: 'student', view: 'compare', admission: { identity: { subject: 'wp:1' } },
      lastSaved: { session: { id: 'b' } }, comparePair: {} };
    const host = el('div'); let teaching = 0;
    const render = new Function('state','$','isAdminReview','longitudinalModel','buildComparisonSelection',
      'compareAttempts','renderTeachingComparison','document','el','formatEvidence',
      `let compareRenderId=0; ${renderCompareCode}; return renderCompare;`)(state, () => host, () => false,
      async options => { assert.deepEqual(options, { refresh: true }, 'newly saved retry must not disappear behind cached history');
        if (changed === 'actor') state.admission.identity.subject = 'wp:2';
        if (changed === 'role') state.role = 'admin'; if (changed === 'view') state.view = 'home';
        return { attempts }; }, buildComparisonSelection, compareAttempts,
      async (_host, selected, options) => { teaching++; assert.equal(selected.baseline.id, 'a');
        assert.equal(options.subject, 'wp:1'); assert.equal(options.isCurrent(), true);
        state.admission.identity.subject = 'wp:2'; assert.equal(options.isScopeCurrent(), false); },
      { createElement: el, createTextNode: text => el('text', '', text) }, el, value => String(value));
    await render(); assert.equal(teaching, changed ? 0 : 1);
    assert.equal(all(host).some(n => n.className === 'compare-table'), !changed);
  }
});

test('actual cached history plus Compare keeps a newly saved retry selected after fresh own read', async () => {
  const cacheCode = between('let longitudinalGeneration = 0;', '\nfunction emptyEvidence(');
  const compareCode = between('async function renderCompare(', '\nlet vaultRenderId');
  const old = { id: 'old', state: 'saved', sessionType: 'question', interviewerProvider: 'missionmed-static',
    questionId: 'q1', questionText: 'Prompt', endedAt: '2026-10-01T10:00:00Z',
    recording: { durationMs: 3000 }, results: { schema: 'ivoc.analytics.v1', schemaVersion: 1, payload: { analytics: {} } } };
  const retry = { ...old, id: 'retry', endedAt: '2026-10-02T10:00:00Z' };
  let reads = 0, pair = null;
  const state = { role: 'student', view: 'compare', admission: { identity: { subject: 'wp:1' } },
    lastSaved: { session: retry }, comparePair: { currentId: 'retry' }, durableAvailable: true,
    longitudinal: buildLongitudinalModel([old]), durable: { library: async mode => {
      reads++; assert.equal(mode, 'own'); return { sessions: [retry, old] };
    } } };
  const host = el('div');
  const run = new Function('state', '$', 'isAdminReview', 'buildLongitudinalModel', 'buildComparisonSelection',
    'compareAttempts', 'renderTeachingComparison', 'document', 'el', 'formatEvidence', 'emptyEvidence',
    `let compareRenderId=0; ${cacheCode}\n${compareCode}; return renderCompare;`)(state, () => host, () => false,
    buildLongitudinalModel, buildComparisonSelection, compareAttempts,
    async (_host, selected) => { pair = selected; }, { createElement: el, createTextNode: text => el('text', '', text) },
    el, value => String(value), () => { throw new Error('New retry was lost from comparison'); });
  await run();
  assert.equal(reads, 1); assert.equal(pair.current.id, 'retry'); assert.equal(pair.baseline.id, 'old');
  assert.equal(state.comparePair.currentId, 'retry'); assert.equal(state.longitudinal.attempts[0].id, 'retry');
});
