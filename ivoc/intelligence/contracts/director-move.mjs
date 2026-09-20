// IVOC Application Intelligence — DirectorMove contract.
// Pure module. Extends the 8000 master-architecture Move shape (§8.3) with
// `lane` and `signal_refs` (donor packet §5.1). Codex records accepted moves as
// `brain.move.v1` events; this lane never touches the Spine.

import { wordCount } from './application-fact.mjs';
import { PROHIBITED_PROBE_LANGUAGE } from './attention-signal.mjs';

export const DIRECTOR_MOVE_SCHEMA = 'ivoc.director_move.v1';

export const MOVE_KINDS = Object.freeze(['ask', 'probe', 'follow_up', 'move_on', 'close', 'no_hint']);
export const LANES = Object.freeze(['pool', 'application', 'live_semantic', 'program', 'mentor']);
export const QUESTION_ORIGINS = Object.freeze(['pool', 'generated', 'contextual', 'human']);
export const MAX_GUIDANCE_WORDS = 60;

const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export class DirectorMoveError extends TypeError {
  constructor(code, message) {
    super(message || code);
    this.name = 'DirectorMoveError';
    this.code = code;
  }
}

export function assertDirectorMove(move) {
  if (!move || typeof move !== 'object' || Array.isArray(move)) throw new DirectorMoveError('invalid_move', 'move must be an object');
  if (move.schema_version !== '1') throw new DirectorMoveError('invalid_move', 'move.schema_version must be 1');
  if (!MOVE_KINDS.includes(move.kind)) throw new DirectorMoveError('invalid_move', 'move.kind is invalid');
  if (!NON_EMPTY(move.rationale_ref)) throw new DirectorMoveError('invalid_move', 'move.rationale_ref is required');
  if (!Array.isArray(move.signal_refs) || move.signal_refs.some((ref) => !NON_EMPTY(ref))) {
    throw new DirectorMoveError('invalid_move', 'move.signal_refs must be an array of ids');
  }
  if (move.lane !== undefined && move.lane !== null && !LANES.includes(move.lane)) throw new DirectorMoveError('invalid_move', 'move.lane is invalid');
  if (typeof move.guidance !== 'string') throw new DirectorMoveError('invalid_move', 'move.guidance must be a string');
  if (wordCount(move.guidance) > MAX_GUIDANCE_WORDS) throw new DirectorMoveError('guidance_too_long', 'move.guidance exceeds 60 words');
  if (PROHIBITED_PROBE_LANGUAGE.test(move.guidance)) throw new DirectorMoveError('prohibited_language', 'move.guidance contains accusation language');
  if (['ask', 'probe', 'follow_up'].includes(move.kind)) {
    const q = move.question_ref;
    if (!q || typeof q !== 'object' || !QUESTION_ORIGINS.includes(q.origin) || !NON_EMPTY(q.text)) {
      throw new DirectorMoveError('invalid_move', `${move.kind} requires question_ref {origin, text}`);
    }
    if (q.origin === 'pool' && !NON_EMPTY(q.question_id)) throw new DirectorMoveError('invalid_move', 'pool question_ref requires question_id');
    if (q.origin === 'contextual' && move.signal_refs.length === 0) {
      throw new DirectorMoveError('grounding_law', 'contextual moves must carry signal_refs');
    }
    if (!LANES.includes(move.lane)) throw new DirectorMoveError('invalid_move', `${move.kind} requires a lane`);
  } else if (move.question_ref !== undefined && move.question_ref !== null) {
    throw new DirectorMoveError('invalid_move', `${move.kind} carries no question_ref`);
  }
  if (!move.memory_delta || typeof move.memory_delta !== 'object') throw new DirectorMoveError('invalid_move', 'move.memory_delta is required');
  if (!Array.isArray(move.candidates)) throw new DirectorMoveError('invalid_move', 'move.candidates must be an array');
  return move;
}
