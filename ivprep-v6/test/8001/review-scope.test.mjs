import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAdminReviewMedia, createAdminReviewGate, isAdminReview, mayPresentSavedReview, resolveAdminStudentRefreshSelection, resolveReviewDestination, savedReviewHash, parseSavedReviewRoute, resolveOwnSavedReview } from '../../public/studio/review-scope.mjs';

const savedId = '4f708360-6a76-477d-a927-caca2989800d';

test('saved review URLs contain only owned-attempt identity, never media or Admin subject', () => {
  const saved = { persisted: true, session: { id: savedId }, recording: { url: 'https://private.invalid/secret' } };
  for (const view of ['filmroom', 'postanswer']) {
    assert.equal(savedReviewHash(view, saved), `#${view}?session=${savedId}`);
    assert.deepEqual(parseSavedReviewRoute(savedReviewHash(view, saved)), { view, sessionId: savedId });
    assert.equal(savedReviewHash(view, { ...saved, reviewScope: 'admin' }), `#${view}`);
    assert.equal(savedReviewHash(view, { ...saved, persisted: false }), `#${view}`);
  }
  assert.equal(savedReviewHash('home', saved), '#home');
  for (const hash of ['#filmroom', '#mentor?session=' + savedId, '#filmroom?session=' + savedId + '&subject=wp:142',
    '#filmroom?session=' + savedId + '&session=' + savedId, '#filmroom?session=https://private.invalid/secret',
    '#filmroom?session=../../student', '#filmroom?session=' + savedId + '#play']) assert.equal(parseSavedReviewRoute(hash), null);
});

test('cold review resolves exact attempt through own library then fresh authorized detail', async () => {
  const row = { id: savedId, recording: { id: 'recording', status: 'saved' } };
  const detail = { session: { id: savedId }, recording: row.recording, results: { payload: { analytics: { durationMs: 11085 } } } };
  const calls = [];
  const saved = await resolveOwnSavedReview({ route: parseSavedReviewRoute(`#filmroom?session=${savedId}`),
    library: async scope => { calls.push(['library', scope]); return { sessions: [row] }; },
    session: async id => { calls.push(['session', id]); return detail; } });
  assert.deepEqual(calls, [['library', 'own'], ['session', savedId]]);
  assert.equal(saved.persisted, true);
  assert.equal(saved.session, row);
  assert.equal(saved.sessionDetail, detail);
  assert.deepEqual(saved.analytics, { durationMs: 11085 });
});

test('cold review never requests a foreign, unknown or still-active attempt detail', async () => {
  for (const sessions of [[], [{ id: savedId, state: 'active' }], [{ id: 'foreign-id', results: {} }]]) {
    let detailReads = 0;
    const result = await resolveOwnSavedReview({ route: { view: 'postanswer', sessionId: savedId },
      library: async () => ({ sessions }), session: async () => { detailReads += 1; } });
    assert.equal(result, null);
    assert.equal(detailReads, 0);
  }
});

test('cold review drops mismatched detail and navigation/role changes across either request', async () => {
  const route = { view: 'postanswer', sessionId: savedId };
  const own = { sessions: [{ id: savedId, results: {} }] };
  assert.equal(await resolveOwnSavedReview({ route, library: async () => own,
    session: async () => ({ session: { id: 'other-id' } }) }), null);
  for (const changedAt of ['library', 'detail']) {
    let current = true; let detailReads = 0;
    const result = await resolveOwnSavedReview({ route, isCurrent: () => current,
      library: async () => { if (changedAt === 'library') current = false; return own; },
      session: async () => { detailReads += 1; current = false; return { session: { id: savedId } }; } });
    assert.equal(result, null);
    assert.equal(detailReads, changedAt === 'library' ? 0 : 1);
  }
  let reads = 0;
  assert.equal(await resolveOwnSavedReview({ route, isCurrent: () => false, library: async () => { reads += 1; } }), null);
  assert.equal(reads, 0);
});

test('Admin review responses are invalid after a role switch or newer selection', () => {
  const gate = createAdminReviewGate();
  const first = gate.begin('admin');
  assert.equal(gate.accepts(first, 'admin'), true);
  const second = gate.begin('admin');
  assert.equal(gate.accepts(first, 'admin'), false);
  assert.equal(gate.accepts(second, 'admin'), true);
  gate.invalidate();
  assert.equal(gate.accepts(second, 'admin'), false);
  assert.equal(gate.begin('student'), null);
  assert.equal(gate.accepts(second, 'student'), false);
});

test('Only an Admin-selected student review is cleared on role change', () => {
  assert.equal(isAdminReview({ reviewScope: 'admin' }), true);
  assert.equal(isAdminReview({ persisted: true }), false);
  assert.equal(isAdminReview(null), false);
});

test('pending Admin playback cannot reopen after a role switch', async () => {
  const gate = createAdminReviewGate();
  const saved = { reviewScope: 'admin', recording: { id: 'student-recording' } };
  const ticket = gate.begin('admin');
  let resolvePlayback;
  const playback = new Promise((resolve) => { resolvePlayback = resolve; });
  const pending = playback.then(() => mayPresentSavedReview({
    saved, currentSaved: null, role: 'student', ticket, gate,
  }));
  gate.invalidate();
  resolvePlayback({ url: 'signed-private-media' });
  assert.equal(await pending, false);
  assert.equal(mayPresentSavedReview({ saved, currentSaved: saved, role: 'admin', ticket, gate }), false);
});

test('Leaving an Admin review removes signed playback and student-specific readouts', () => {
  const calls = [];
  const video = {
    pause() { calls.push('pause'); },
    removeAttribute(name) { calls.push(`remove:${name}`); },
    load() { calls.push('load'); },
  };
  const groups = {
    readouts: { 'VOICE.VOLUME': '-21 dBFS', 'BODY.FRAMING': '74% centered' },
    ingestResult(value) { calls.push(value.deliveryIntelligence.readouts); },
  };
  clearAdminReviewMedia(video, groups);
  assert.deepEqual(calls.slice(0, 3), ['pause', 'remove:src', 'load']);
  assert.deepEqual(calls[3], { 'VOICE.VOLUME': 'Unavailable', 'BODY.FRAMING': 'Unavailable' });
});

test('Review navigation opens the private attempt chooser when no attempt is selected', () => {
  assert.equal(resolveReviewDestination('filmroom', null), 'vault');
  assert.equal(resolveReviewDestination('postanswer', null), 'vault');
  assert.equal(resolveReviewDestination('filmroom', { persisted: true }), 'filmroom');
  assert.equal(resolveReviewDestination('home', null), 'home');
});

test('manual student refresh preserves exact available subject and never substitutes another account', () => {
  const students = [{ subject: 'wp:1' }, { subject: 'wp:142' }];
  assert.equal(resolveAdminStudentRefreshSelection(students, 'wp:142'), 'wp:142');
  assert.equal(resolveAdminStudentRefreshSelection(students, 'wp:999'), '');
  assert.equal(resolveAdminStudentRefreshSelection(students, null), '');
  assert.equal(resolveAdminStudentRefreshSelection([], 'wp:142'), '');
});

test('bound review gate rejects changed subject, attempt or view even while Admin remains active', () => {
  const gate = createAdminReviewGate();
  const scope = { subject: 'wp:142', sessionId: 'saved-attempt', view: 'mentor' };
  const ticket = gate.begin('admin', scope);
  assert.equal(gate.accepts(ticket, 'admin', scope), true);
  for (const changed of [{ ...scope, subject: 'wp:1' }, { ...scope, sessionId: 'other' }, { ...scope, view: 'home' }]) {
    assert.equal(gate.accepts(ticket, 'admin', changed), false);
  }
  assert.equal(gate.accepts(ticket, 'admin'), false);
  gate.invalidate();
  assert.equal(gate.accepts(ticket, 'admin', scope), false);
});
