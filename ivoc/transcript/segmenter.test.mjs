import assert from 'node:assert/strict';
import test from 'node:test';
import { segmentPromptedMock } from './segmenter.mjs';

const event = (seq, type, at, payload) => ({ event_id: `e${seq}`, session_id: 's1', seq, type, t_media_ms: at, payload });
const transcript = { schema: 'ivoc.transcript.v1', transcript_id: 't1', session_id: 's1', segments: [{ turn_id: 'a1', speaker: 'student', words: [{ w: 'hello', t0: 1200, t1: 1500, conf: 0.9 }] }] };

test('Prompted Mock segmentation uses Spine question and answer boundaries exactly', () => {
  const segments = segmentPromptedMock({ sessionId: 's1', subjectId: 'student-1', mediaRef: 'media-1', transcript, events: [event(3, 'question.answer.ended.v1', 3000, { turn_id: 'a1' }), event(1, 'question.asked.v1', 1000, { question_id: 'q1', text: 'Tell me about yourself.', origin: 'pool', turn_id: 'qturn' }), event(2, 'question.answer.started.v1', 1100, { turn_id: 'a1' })] });
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0].answer, { t_start_ms: 1100, t_end_ms: 3000, turn_ids: ['a1'], follow_up_turn_ids: [] });
  assert.equal(segments[0].question.canonical_question_id, 'q1');
});

test('missing deterministic boundaries fail instead of guessing', () => {
  assert.throws(() => segmentPromptedMock({ sessionId: 's1', subjectId: 'student-1', mediaRef: 'media-1', transcript, events: [event(1, 'question.asked.v1', 1000, { question_id: 'q1', turn_id: 'qturn' })] }), /incomplete deterministic answer boundary/);
});
