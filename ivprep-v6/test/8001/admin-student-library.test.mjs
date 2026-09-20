import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AdminStudentLibraryCapability,
  projectAdminStudentLibrary,
} from '../../public/capabilities/admin-student-library.mjs';

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
