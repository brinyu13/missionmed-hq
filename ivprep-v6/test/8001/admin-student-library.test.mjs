import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdminStudentProgress } from '../../public/studio/presentation-view-model.mjs';
import { IvocApi } from '../../public/ivoc-standalone/app/api.mjs';
import { createAdminReviewGate, isAdminReview, resolveAdminStudentRefreshSelection } from '../../public/studio/review-scope.mjs';
import { readFileSync } from 'node:fs';

import {
  AdminStudentLibraryCapability,
  projectAdminStudentLibrary,
} from '../../public/capabilities/admin-student-library.mjs';

test('Admin library projection preserves unavailable duration through the progress presentation', () => {
  for (const durationMs of [null, undefined, '', 'unknown']) {
    const view = projectAdminStudentLibrary({ sessions: [{ id: 'a', ownerSubject: 'wp:142', state: 'saved', durationMs }] });
    assert.equal(view.students[0].sessions[0].durationMs, null);
    assert.equal(buildAdminStudentProgress(view.students[0]).durationAvailable, false);
  }
  const view = projectAdminStudentLibrary({ sessions: [{ id: 'a', ownerSubject: 'wp:142', state: 'saved', durationMs: 0 }] });
  assert.equal(buildAdminStudentProgress(view.students[0]).durationAvailable, true);
});

test('Admin library groups the authorized projection by stable student identity', () => {
  const view = projectAdminStudentLibrary({ sessions: [
    {
      id: 'session-b', ownerSubject: 'wp:7', ownerDisplayName: 'Student Seven',
      questionText: 'Why this program?', state: 'saved', endedAt: '2026-09-20T12:00:00Z',
      recording: { id: 'recording-b', status: 'saved' }, results: { payload: {} },
      answerHistory: { transcriptAvailable: true, supportedObservationCount: 2 },
    },
    {
      id: 'session-a', ownerSubject: 'wp:42', ownerDisplayName: 'Student Forty Two',
      title: 'Opening answer', state: 'processing', startedAt: '2026-09-20T11:00:00Z',
    },
    { id: 'missing-owner', ownerDisplayName: 'Not authorized for projection' },
  ] });

  assert.equal(view.studentCount, 2);
  assert.equal(view.sessionCount, 2);
  assert.deepEqual(view.students.map((student) => student.subject), ['wp:42', 'wp:7']);
  assert.equal(view.students[1].sessions[0].recording.id, 'recording-b');
  assert.equal(view.students[1].sessions[0].answerHistory.supportedObservationCount, 2);
});

test('Admin capability uses only the stable library, detail and signed-playback contracts', async () => {
  const calls = [];
  const api = {
    library: async (scope) => { calls.push(['library', scope]); return { sessions: [] }; },
    session: async (id) => { calls.push(['session', id]); return { id }; },
    playback: async (id) => { calls.push(['playback', id]); return { url: 'https://media.test/signed' }; },
  };
  const capability = new AdminStudentLibraryCapability({ api });
  await capability.overview();
  await capability.session('session-1');
  await capability.playback('recording-1');
  assert.deepEqual(calls, [
    ['library', 'all'], ['session', 'session-1'], ['playback', 'recording-1'],
  ]);
});

test('selected-student comparison never substitutes the actor or an unattributed session', async () => {
  const calls = [];
  const selected = { id: 'student-attempt', ownerSubject: 'wp:142', results: { payload: { analytics: {} } } };
  const capability = new AdminStudentLibraryCapability({ api: {
    library: async (scope) => {
      calls.push(scope);
      return { sessions: [selected, { id: 'actor-attempt', ownerSubject: 'wp:1' }, { id: 'unknown' }] };
    },
  } });
  assert.deepEqual(await capability.comparisonSessions('wp:142'), [selected]);
  assert.deepEqual(await capability.comparisonSessions('wp:999'), []);
  await assert.rejects(capability.comparisonSessions(''), /ivoc_student_required/);
  assert.deepEqual(calls, ['all', 'all']);
});

const SUBJECT = 'wp:142';
const SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const authorizedAttempt = () => ({ id: SESSION_ID, ownerSubject: SUBJECT, ownerDisplayName: 'Student 142', state: 'saved', results: { payload: {} } });
const current = () => true;

test('fresh library binding supplies detail scope without inventing owner authority or accepting mismatches', async () => {
  for (const detail of [{ id: 'wrong' }, { id: SESSION_ID, ownerSubject: 'wp:1' }]) {
    const capability = new AdminStudentLibraryCapability({ api: {
      library: async () => ({ sessions: [authorizedAttempt()] }), session: async () => detail,
    } });
    await assert.rejects(() => capability.sessionForStudent({ subject: SUBJECT, sessionId: SESSION_ID, isCurrent: current }), /identity_mismatch/u);
  }
  const capability = new AdminStudentLibraryCapability({ api: {
    library: async () => ({ sessions: [authorizedAttempt()] }), session: async () => ({ id: SESSION_ID, reviewStatus: null }),
  } });
  const detail = await capability.sessionForStudent({ subject: SUBJECT, sessionId: SESSION_ID, isCurrent: current });
  assert.equal(detail.ownerSubject, SUBJECT);
  await assert.rejects(() => capability.sessionForStudent({ subject: 'wp:1', sessionId: SESSION_ID, isCurrent: current }), /selected_attempt_unavailable/u);
});

test('stale library/detail replies are discarded before they can publish selected-student private data', async () => {
  for (const stage of ['library', 'detail']) {
    let valid = true;
    let detailReads = 0;
    const capability = new AdminStudentLibraryCapability({ api: {
      library: async () => { if (stage === 'library') valid = false; return { sessions: [authorizedAttempt()] }; },
      session: async () => { detailReads += 1; valid = false; return { id: SESSION_ID }; },
    } });
    assert.equal(await capability.sessionForStudent({ subject: SUBJECT, sessionId: SESSION_ID, isCurrent: () => valid }), null);
    assert.equal(detailReads, stage === 'library' ? 0 : 1);
  }
});

test('status-only review bootstraps the real API and sends exact attempt plus CSRF without notes', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    let body;
    if (url.endsWith('/bootstrap')) body = { identity: { subject: 'wp:1', admin: true }, csrfToken: 'a'.repeat(24) };
    else if (url.includes('/library?scope=all')) body = { sessions: [authorizedAttempt()] };
    else if (url.endsWith('/review')) body = { sessionId: SESSION_ID, reviewStatus: 'reviewed', reviewedAt: '2026-10-01T12:00:00Z' };
    else body = { id: SESSION_ID, reviewStatus: null };
    return { ok: true, json: async () => body };
  });
  const capability = new AdminStudentLibraryCapability({ api: new IvocApi() });
  const result = await capability.markReviewed({ subject: SUBJECT, sessionId: SESSION_ID, isCurrent: current });
  assert.equal(result.ownerSubject, SUBJECT);
  assert.equal(result.reviewStatus, 'reviewed');
  assert.equal(calls.length, 4);
  const write = calls.at(-1);
  assert.equal(write.url, `/api/ivoc/v1/sessions/${SESSION_ID}/review`);
  assert.equal(write.init.headers['X-MMHQ-CSRF'], 'a'.repeat(24));
  assert.deepEqual(JSON.parse(write.init.body), {});
  assert.equal(write.init.credentials, 'same-origin');
  assert.equal(write.init.method, 'POST');
});

function reviewApi({ admin = true, csrf = 'a'.repeat(24), stage = null, alreadyReviewed = false, deny = false } = {}) {
  let valid = true;
  const calls = [];
  const api = {
    async bootstrap() {
      calls.push('bootstrap'); api.csrfToken = csrf;
      if (stage === 'bootstrap') valid = false;
      return { identity: { admin }, csrfToken: csrf };
    },
    async library() {
      calls.push('library'); if (stage === 'library') valid = false;
      return { sessions: [authorizedAttempt()] };
    },
    async session() {
      calls.push('detail'); if (stage === 'detail') valid = false;
      return { id: SESSION_ID, reviewStatus: alreadyReviewed ? 'reviewed' : null };
    },
    async markReviewed(id, body) {
      calls.push('write'); assert.equal(id, SESSION_ID); assert.deepEqual(body, {});
      if (deny) throw Object.assign(new Error('ivoc_admin_required'), { status: 403 });
      if (stage === 'write') valid = false;
      return { sessionId: SESSION_ID, reviewStatus: 'reviewed' };
    },
  };
  return { api, calls, isCurrent: () => valid };
}

test('review submission rejects missing authority/CSRF, already-reviewed attempts and server denial', async () => {
  for (const options of [{ admin: false }, { csrf: '' }, { alreadyReviewed: true }, { deny: true }]) {
    const harness = reviewApi(options);
    const capability = new AdminStudentLibraryCapability({ api: harness.api });
    await assert.rejects(() => capability.markReviewed({ subject: SUBJECT, sessionId: SESSION_ID, isCurrent: current }), /admin_review_unavailable|already_reviewed|admin_required/u);
    assert.equal(harness.calls.includes('write'), options.deny === true);
  }
});

test('review writes and response publication respect every asynchronous scope boundary', async () => {
  for (const stage of ['bootstrap', 'library', 'detail', 'write']) {
    const harness = reviewApi({ stage });
    const capability = new AdminStudentLibraryCapability({ api: harness.api });
    assert.equal(await capability.markReviewed({ subject: SUBJECT, sessionId: SESSION_ID, isCurrent: harness.isCurrent }), null);
    assert.equal(harness.calls.includes('write'), stage === 'write');
  }
});

test('public review projection retains reviewed status without private review notes', () => {
  const attempt = { ...authorizedAttempt(), reviewStatus: 'reviewed', review: { notes: ['private-note'] } };
  const library = projectAdminStudentLibrary({ sessions: [attempt] });
  assert.equal(library.students[0].sessions[0].reviewStatus, 'reviewed');
  assert.doesNotMatch(JSON.stringify(library), /private-note|notes/u);
});

test('actual Admin open handler discards role/subject/view changes and mismatched detail before rendering', async () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('async function openAdminStudentSession(');
  const end = source.indexOf('\nfunction renderAdminReviewControl()', start);
  const actual = source.slice(start, end);
  for (const change of ['role', 'subject', 'view', 'identity']) {
    const gate = createAdminReviewGate();
    const state = { role: 'admin', view: 'mentor', adminCreditSubject: { subject: SUBJECT } };
    let paints = 0;
    const session = authorizedAttempt();
    const capability = new AdminStudentLibraryCapability({ api: {
      library: async () => ({ sessions: [session] }),
      session: async () => {
        if (change === 'role') state.role = 'student';
        if (change === 'subject') state.adminCreditSubject.subject = 'wp:1';
        if (change === 'view') state.view = 'home';
        return { id: change === 'identity' ? 'wrong' : SESSION_ID, results: { payload: {} } };
      },
    } });
    state.adminLibrary = capability;
    const open = new Function('state', 'adminReviewGate', 'adminReviewViewGeneration',
      'presentFilmRoomAnalytics', 'renderPostAnswer', 'renderContextEvidence', 'contextResultFromSessionSpine', 'setView', '$', 'renderFilmRoomSpine',
      `return ${actual};`)(state, gate, 0, () => ({}), () => { paints += 1; }, () => {}, () => ({}), () => { paints += 1; }, () => null, () => {});
    const action = { disabled: false };
    await open(session, 'postanswer', action);
    assert.equal(paints, 0);
    assert.equal(state.lastSaved, undefined);
    assert.equal(action.disabled, false);
  }
});

test('actual student-library renderer keeps a refreshed selection or exposes loss without actor fallback', async () => {
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.value = ''; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
    addEventListener(type, listener) { this.listeners[type] = listener; }
  }
  const document = { createElement: tag => new Node(tag) };
  const element = (tag, className, text) => Object.assign(new Node(tag), { className, textContent: text });
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const actual = source.slice(source.indexOf('async function renderAdminStudentLibrary('), source.indexOf('\nlet liveMockRenderId'));
  let rows = [authorizedAttempt(), { ...authorizedAttempt(), id: 'actor-attempt', ownerSubject: 'wp:1' }];
  const state = {
    role: 'admin', view: 'mentor', adminCreditSubject: { subject: SUBJECT },
    adminLibrary: new AdminStudentLibraryCapability({ api: { library: async () => ({ sessions: rows }) } }),
    adminControls: { selectSubject() {}, destroy() {} },
    admission: { identity: { subject: 'wp:1' } },
  };
  const gate = createAdminReviewGate();
  const staleTicket = gate.begin('admin');
  const mentorControls = () => ({ selectSubject() {}, destroy() {} });
  const progress = () => ({ title: 'Practice history', totals: { savedSessions: 1, recordedMs: 0, uniqueQuestions: 1, activeDays: 1 }, durationAvailable: false, note: 'Recorded evidence only' });
  const render = new Function('state', 'adminStudentLibraryRenderId', 'adminReviewGate', 'isAdminReview',
    'clearAdminReviewMedia', '$', 'document', 'el', 'resolveAdminStudentRefreshSelection', 'mountAdminMentorControls',
    'hydrateHome', 'buildAdminStudentProgress', 'metricCard', 'formatEvidence', 'openAdminStudentSession', 'renderAdminOverview',
    `return ${actual};`)(state, 0, gate, isAdminReview, () => {}, () => null, document, element,
    resolveAdminStudentRefreshSelection, mentorControls, () => {}, progress, () => new Node('metric'), String, () => {}, () => {});
  const host = new Node('host');
  await render(host);
  let selector = host.children[0].children.find(child => child.tag === 'select');
  assert.equal(selector.value, SUBJECT);
  assert.equal(state.adminCreditSubject.subject, SUBJECT);
  assert.equal(gate.accepts(staleTicket, 'admin'), false);
  assert.equal(host.children[0].children[0].textContent, 'Refresh saved attempts');
  rows = [{ ...authorizedAttempt(), id: 'actor-attempt', ownerSubject: 'wp:1' }];
  await render(host);
  selector = host.children[0].children.find(child => child.tag === 'select');
  assert.equal(selector.value, '');
  assert.equal(state.adminCreditSubject, null);
  assert.match(selector.children[0].textContent, /Selected student unavailable/u);
  assert.match(host.children.at(-1).children[0].textContent, /no replacement account was selected/u);
  assert.equal(host.children[0].children[0].disabled, false);
});
