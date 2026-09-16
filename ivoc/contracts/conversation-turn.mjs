export const CONVERSATION_TURN_SCHEMA = 'ivoc.turn.v1';

const SPEAKERS = new Set(['interviewer', 'student', 'admin_interviewer']);
const RELATIONS = new Set([
  'question', 'answer', 'follow_up', 'probe', 'interruption', 'aside',
  'opening', 'closing',
]);
const ORIGINS = new Set(['pool', 'generated', 'contextual', 'human']);

function requiredString(value, label) {
  if (typeof value !== 'string' || !value) throw new TypeError(`${label} is required`);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== 'string' || !value)) {
    throw new TypeError(`${label} must be a non-empty string when present`);
  }
}

function optionalRatio(value, label) {
  if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) {
    throw new TypeError(`${label} must be between 0 and 1`);
  }
}

export function assertConversationTurn(turn) {
  if (!turn || typeof turn !== 'object' || Array.isArray(turn)) {
    throw new TypeError('conversation turn must be an object');
  }
  for (const key of ['turn_id', 'session_id']) requiredString(turn[key], `turn.${key}`);
  if (turn.schema_version !== '1') throw new TypeError('turn.schema_version must be 1');
  if (!SPEAKERS.has(turn.speaker)) throw new TypeError('invalid turn speaker');
  if (!RELATIONS.has(turn.relation)) throw new TypeError('invalid turn relation');
  if (!Number.isFinite(turn.t_start_ms) || turn.t_start_ms < 0) {
    throw new TypeError('turn.t_start_ms must be non-negative');
  }
  if (turn.t_end_ms !== undefined
    && (!Number.isFinite(turn.t_end_ms) || turn.t_end_ms < turn.t_start_ms)) {
    throw new TypeError('turn.t_end_ms must follow t_start_ms');
  }
  if (!turn.transcript || typeof turn.transcript !== 'object' || Array.isArray(turn.transcript)) {
    throw new TypeError('turn.transcript must be an object');
  }
  for (const key of ['provisional_ref', 'canonical_ref', 'text']) {
    optionalString(turn.transcript[key], `turn.transcript.${key}`);
  }
  if (!turn.question || typeof turn.question !== 'object' || Array.isArray(turn.question)) {
    throw new TypeError('turn.question must be an object');
  }
  if (turn.question.identity !== undefined) {
    if (!turn.question.identity || typeof turn.question.identity !== 'object'
      || Array.isArray(turn.question.identity)) {
      throw new TypeError('turn.question.identity must be an object');
    }
    optionalString(turn.question.identity.canonical_question_id, 'turn.question.identity.canonical_question_id');
    optionalString(turn.question.identity.version, 'turn.question.identity.version');
  }
  if (turn.question.origin !== undefined && !ORIGINS.has(turn.question.origin)) {
    throw new TypeError('invalid turn question origin');
  }
  optionalString(turn.question.text_hash, 'turn.question.text_hash');
  optionalString(turn.parent_turn_id, 'turn.parent_turn_id');
  if (!turn.semantic || typeof turn.semantic !== 'object' || Array.isArray(turn.semantic)) {
    throw new TypeError('turn.semantic must be an object');
  }
  optionalString(turn.semantic.classification, 'turn.semantic.classification');
  optionalRatio(turn.semantic.coverage, 'turn.semantic.coverage');
  optionalRatio(turn.semantic.confidence, 'turn.semantic.confidence');
  optionalString(turn.semantic.classifier_version, 'turn.semantic.classifier_version');
  if (turn.interrupted !== undefined) {
    if (!turn.interrupted || !['student', 'interviewer', 'system'].includes(turn.interrupted.by)
      || !Number.isFinite(turn.interrupted.t_ms) || turn.interrupted.t_ms < turn.t_start_ms) {
      throw new TypeError('turn.interrupted is invalid');
    }
  }
  if (!Number.isInteger(turn.version) || turn.version < 1) {
    throw new TypeError('turn.version must be a positive integer');
  }
  return turn;
}
