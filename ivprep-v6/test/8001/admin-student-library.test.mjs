import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdminStudentProgress } from '../../public/studio/presentation-view-model.mjs';

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
