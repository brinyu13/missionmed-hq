import assert from 'node:assert/strict';
import test from 'node:test';
import { projectFlightRecorder, seekFlightRecorder } from './flight-recorder.mjs';
import { projectLibrary } from './library.mjs';
import { projectResults } from './results.mjs';

const session = { session_id: 's1', subject_id: 'student-1', analytics_config_version: 'm1', updated_at: '2026-09-16T16:00:00Z', practice_goal: 'guided_mock' };

test('Results include measured evidence and explicit unavailable limitations', () => {
  const result = projectResults({ session, segments: [{ segment_id: 'seg1' }], analyticsSummary: { 'voice.volume': { availability: 'ok', values: [7, 8], scale: '0_10' }, 'frame.framing': { availability: 'unavailable', values: [], reason: 'adapter missing' } }, producedAt: '2026-09-16T16:01:00Z' });
  assert.equal(result.dimensions[0].score, 7.5);
  assert.equal(result.dimensions[1].valid, false);
  assert.deepEqual(result.limitations, ['frame.framing: adapter missing']);
});

test('Flight Recorder shares one media cursor and renders missing lanes as gaps', () => {
  const projection = projectFlightRecorder({ sessionId: 's1', media: { media_id: 'm1' }, events: [{ seq: 1, type: 'question.asked.v1', t_media_ms: 1000 }, { seq: 2, type: 'turn.started.v1', t_media_ms: 1100 }], transcript: { segments: [] }, signalSeries: { 'voice.volume': [{ t_media_ms: 1200, value: 7 }], 'frame.framing': [] } });
  assert.deepEqual(projection.gaps, [{ lane: 'frame.framing', reason: 'signal unavailable' }, { lane: 'transcript', reason: 'canonical transcript pending' }]);
  assert.equal(seekFlightRecorder(projection, 1300).signal_values['voice.volume'].value, 7);
});

test('Video Library is subject-scoped, list-first and searchable', () => {
  const library = projectLibrary([{ ...session, program_name: 'Internal Medicine' }, { ...session, session_id: 's2', subject_id: 'other' }], { subjectId: 'student-1', query: 'internal' });
  assert.deepEqual(library.items.map((item) => item.session_id), ['s1']);
});
