import { assertAnswerSegment } from '../contracts/answer-segment.mjs';
import { assertCanonicalTranscript } from './canonical.mjs';

const byTime = (left, right) => left.t_media_ms - right.t_media_ms || left.seq - right.seq;

export function segmentPromptedMock({ sessionId, subjectId, mediaRef, transcript, events }) {
  assertCanonicalTranscript(transcript);
  if (!Array.isArray(events)) throw new TypeError('events are required');
  const ordered = [...events].sort(byTime);
  const questions = ordered.filter((event) => event.type === 'question.asked.v1');
  return questions.map((question, index) => {
    const nextQuestionAt = questions[index + 1]?.t_media_ms ?? Infinity;
    const start = ordered.find((event) => event.type === 'question.answer.started.v1' && event.t_media_ms >= question.t_media_ms && event.t_media_ms < nextQuestionAt);
    const end = ordered.find((event) => event.type === 'question.answer.ended.v1' && start && event.t_media_ms >= start.t_media_ms && event.t_media_ms < nextQuestionAt);
    if (!start || !end) throw new Error(`incomplete deterministic answer boundary for ${question.event_id}`);
    const followUps = ordered.filter((event) => event.type === 'question.follow_up.v1' && event.t_media_ms > start.t_media_ms && event.t_media_ms < end.t_media_ms);
    const segment = {
      segment_id: `${sessionId}:segment:${index + 1}`,
      session_id: sessionId,
      subject_id: subjectId,
      schema_version: '1',
      question: {
        origin: question.payload.origin ?? 'pool',
        canonical_question_id: question.payload.question_id,
        text: question.payload.text ?? `Question ${question.payload.question_id}`,
        asked_turn_id: question.payload.turn_id,
        t_asked_ms: question.t_media_ms,
      },
      answer: {
        t_start_ms: start.t_media_ms,
        t_end_ms: end.t_media_ms,
        turn_ids: [start.payload.turn_id],
        follow_up_turn_ids: followUps.map((event) => event.payload.turn_id),
      },
      transcript_ref: transcript.transcript_id,
      media_ref: mediaRef,
      coaching_notes_refs: [],
      version: 1,
    };
    assertAnswerSegment(segment);
    return segment;
  });
}
