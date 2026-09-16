export const RESULT_SCHEMA = 'ivoc.result.v1';
export const COACHING_EVIDENCE_SCHEMA = 'ivoc.coaching_evidence.v1';

export function assertResultSet(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new TypeError('result must be an object');
  for (const key of ['result_id', 'session_id', 'subject_id', 'projector_version', 'analytics_config_version', 'produced_at']) {
    if (typeof result[key] !== 'string' || !result[key]) throw new TypeError(`result.${key} is required`);
  }
  if (!['provisional', 'canonical'].includes(result.status)) throw new TypeError('invalid result status');
  for (const key of ['dimensions', 'segments', 'coaching', 'limitations']) {
    if (!Array.isArray(result[key])) throw new TypeError(`result.${key} must be an array`);
  }
  return result;
}

export function assertCoachingEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new TypeError('coaching evidence must be an object');
  for (const key of ['evidence_id', 'session_id', 'subject_id', 'dimension']) {
    if (typeof evidence[key] !== 'string' || !evidence[key]) throw new TypeError(`evidence.${key} is required`);
  }
  if (!Array.isArray(evidence.refs) || evidence.refs.length === 0) throw new TypeError('evidence refs are required');
  if (!Number.isInteger(evidence.version) || evidence.version < 1) throw new TypeError('evidence version is invalid');
  return evidence;
}
