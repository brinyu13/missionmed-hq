import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAdminReviewMedia, createAdminReviewGate, isAdminReview, mayPresentSavedReview, resolveAdminStudentRefreshSelection, resolveReviewDestination } from '../../public/studio/review-scope.mjs';

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
