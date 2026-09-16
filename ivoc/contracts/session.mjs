export const SESSION_SCHEMA = 'ivoc.session.v1';

export const SESSION_STATES = Object.freeze([
  'draft',
  'ready_check',
  'armed',
  'live',
  'ending',
  'sealing',
  'processing',
  'complete',
  'abandoned',
  'failed_processing',
  'expired',
]);

export const SESSION_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['ready_check', 'abandoned', 'expired']),
  ready_check: Object.freeze(['armed', 'abandoned']),
  armed: Object.freeze(['live', 'abandoned']),
  live: Object.freeze(['ending']),
  ending: Object.freeze(['sealing']),
  sealing: Object.freeze(['processing', 'failed_processing']),
  processing: Object.freeze(['complete', 'failed_processing']),
  failed_processing: Object.freeze(['processing']),
  complete: Object.freeze([]),
  abandoned: Object.freeze([]),
  expired: Object.freeze([]),
});

const PRACTICE_GOALS = new Set(['full_simulation', 'guided_mock', 'individual_question']);
const ROLE_CONTEXTS = new Set(['student', 'admin', 'mentor']);
const TRANSPORT_PROFILES = new Set(['none', 'A', 'B', 'C']);

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

export function assertSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    throw new TypeError('session must be an object');
  }
  for (const key of [
    'session_id', 'actor_id', 'subject_id', 'interviewer_config_ref',
    'question_pool_ref', 'analytics_config_version', 'created_at', 'updated_at',
  ]) {
    requireString(session[key], `session.${key}`);
  }
  if (session.schema_version !== '1') throw new TypeError('session.schema_version must be 1');
  if (!ROLE_CONTEXTS.has(session.role_context)) throw new TypeError('invalid session.role_context');
  if (!PRACTICE_GOALS.has(session.practice_goal)) throw new TypeError('invalid session.practice_goal');
  if (!TRANSPORT_PROFILES.has(session.transport_profile)) throw new TypeError('invalid session.transport_profile');
  if (!SESSION_STATES.includes(session.state)) throw new TypeError('invalid session.state');
  if (!Number.isInteger(session.state_version) || session.state_version < 0) {
    throw new TypeError('session.state_version must be a non-negative integer');
  }
  if (!session.clock || session.clock.origin !== 'capture_owner') {
    throw new TypeError('session.clock must identify the capture owner');
  }
  requireString(session.clock.started_at_wall, 'session.clock.started_at_wall');
  if (!Array.isArray(session.context_receipts)) throw new TypeError('session.context_receipts must be an array');
  return session;
}

export function canTransition(from, to) {
  return SESSION_TRANSITIONS[from]?.includes(to) === true;
}
