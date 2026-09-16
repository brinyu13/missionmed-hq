export const ANSWER_SEGMENT_SCHEMA = 'ivoc.answer_segment.v1';

const ORIGINS = new Set(['pool', 'generated', 'contextual', 'human']);
const SCORERS = new Set(['ai_draft', 'mentor']);
const MARKERS = new Set(['student', 'mentor', 'ai_draft']);

function requiredString(value, label) {
  if (typeof value !== 'string' || !value) throw new TypeError(`${label} is required`);
}

function stringArray(value, label, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((item) => typeof item !== 'string' || !item)) {
    throw new TypeError(`${label} must be an array of non-empty strings`);
  }
}

export function assertAnswerSegment(segment) {
  if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
    throw new TypeError('answer segment must be an object');
  }
  for (const key of ['segment_id', 'session_id', 'subject_id', 'transcript_ref', 'media_ref']) {
    requiredString(segment[key], `segment.${key}`);
  }
  if (segment.schema_version !== '1') throw new TypeError('segment.schema_version must be 1');
  if (!segment.question || typeof segment.question !== 'object' || Array.isArray(segment.question)) {
    throw new TypeError('segment.question must be an object');
  }
  if (!ORIGINS.has(segment.question.origin)) throw new TypeError('invalid segment question origin');
  for (const key of ['text', 'asked_turn_id']) {
    requiredString(segment.question[key], `segment.question.${key}`);
  }
  for (const key of ['canonical_question_id', 'version']) {
    if (segment.question[key] !== undefined) {
      requiredString(segment.question[key], `segment.question.${key}`);
    }
  }
  if (!Number.isFinite(segment.question.t_asked_ms) || segment.question.t_asked_ms < 0) {
    throw new TypeError('segment.question.t_asked_ms must be non-negative');
  }
  if (!segment.answer || typeof segment.answer !== 'object' || Array.isArray(segment.answer)) {
    throw new TypeError('segment.answer must be an object');
  }
  if (!Number.isFinite(segment.answer.t_start_ms)
    || !Number.isFinite(segment.answer.t_end_ms)
    || segment.answer.t_start_ms < segment.question.t_asked_ms
    || segment.answer.t_end_ms < segment.answer.t_start_ms) {
    throw new TypeError('segment answer time range is invalid');
  }
  stringArray(segment.answer.turn_ids, 'segment.answer.turn_ids', { allowEmpty: false });
  stringArray(segment.answer.follow_up_turn_ids, 'segment.answer.follow_up_turn_ids');
  stringArray(segment.coaching_notes_refs, 'segment.coaching_notes_refs');
  if (segment.scoring !== undefined) {
    requiredString(segment.scoring.rubric_version, 'segment.scoring.rubric_version');
    if (!segment.scoring.scores || typeof segment.scoring.scores !== 'object'
      || Array.isArray(segment.scoring.scores)
      || Object.values(segment.scoring.scores).some((score) => !Number.isFinite(score))) {
      throw new TypeError('segment.scoring.scores must contain finite numbers');
    }
    if (!SCORERS.has(segment.scoring.by)) throw new TypeError('invalid segment scorer');
    requiredString(segment.scoring.at, 'segment.scoring.at');
  }
  if (segment.strongest_marker !== undefined) {
    if (!MARKERS.has(segment.strongest_marker.set_by)) {
      throw new TypeError('invalid strongest marker author');
    }
    requiredString(segment.strongest_marker.at, 'segment.strongest_marker.at');
  }
  if (!Number.isInteger(segment.version) || segment.version < 1) {
    throw new TypeError('segment.version must be a positive integer');
  }
  return segment;
}
