export const RESULT_SCHEMA = 'ivoc.result.v1';
export const COACHING_EVIDENCE_SCHEMA = 'ivoc.coaching_evidence.v1';

export function assertResultSet(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new TypeError('result must be an object');
  for (const key of ['result_id', 'session_id', 'subject_id', 'projector_version', 'analytics_config_version', 'produced_at', 'evidence_index_ref']) {
    if (typeof result[key] !== 'string' || !result[key]) throw new TypeError(`result.${key} is required`);
  }
  if (result.schema_version !== '1') throw new TypeError('result.schema_version must be 1');
  if (result.pack_version !== undefined && (typeof result.pack_version !== 'string' || !result.pack_version)) {
    throw new TypeError('result.pack_version must be non-empty when present');
  }
  if (!['provisional', 'canonical'].includes(result.status)) throw new TypeError('invalid result status');
  for (const key of ['dimensions', 'segments', 'coaching', 'limitations']) {
    if (!Array.isArray(result[key])) throw new TypeError(`result.${key} must be an array`);
  }
  if (result.segments.some((ref) => typeof ref !== 'string' || !ref)
    || result.coaching.some((ref) => typeof ref !== 'string' || !ref)
    || result.limitations.some((item) => typeof item !== 'string' || !item)) {
    throw new TypeError('result references and limitations must be non-empty strings');
  }
  for (const dimension of result.dimensions) {
    if (!dimension || typeof dimension.dimension !== 'string' || !dimension.dimension
      || typeof dimension.valid !== 'boolean'
      || !Array.isArray(dimension.evidence_refs)
      || dimension.evidence_refs.some((ref) => typeof ref !== 'string' || !ref)) {
      throw new TypeError('result dimension is invalid');
    }
    if (dimension.score !== undefined && !Number.isFinite(dimension.score)) {
      throw new TypeError('result dimension score must be finite');
    }
    if (dimension.scale !== undefined && !['0_10', 'raw'].includes(dimension.scale)) {
      throw new TypeError('result dimension scale is invalid');
    }
  }
  return result;
}

export function assertCoachingEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new TypeError('coaching evidence must be an object');
  for (const key of ['evidence_id', 'session_id', 'subject_id', 'dimension']) {
    if (typeof evidence[key] !== 'string' || !evidence[key]) throw new TypeError(`evidence.${key} is required`);
  }
  if (evidence.schema_version !== '1') throw new TypeError('evidence.schema_version must be 1');
  if (!Array.isArray(evidence.refs) || evidence.refs.length === 0
    || evidence.refs.some((ref) => !ref || typeof ref !== 'object'
      || !['transcript_span', 'signal_window', 'turn', 'segment', 'event'].includes(ref.kind)
      || typeof ref.ref !== 'string' || !ref.ref)) {
    throw new TypeError('evidence refs are required and must be typed');
  }
  if (!evidence.interpretation || typeof evidence.interpretation.text !== 'string'
    || !evidence.interpretation.text
    || !['ai_draft', 'mentor', 'admin'].includes(evidence.interpretation.by)) {
    throw new TypeError('evidence interpretation is required');
  }
  if (evidence.score !== undefined) {
    if (!Number.isFinite(evidence.score.value)
      || !['0_10', 'raw'].includes(evidence.score.scale)
      || typeof evidence.score.valid !== 'boolean') {
      throw new TypeError('evidence score is invalid');
    }
  }
  if (evidence.confidence !== undefined
    && (!Number.isFinite(evidence.confidence) || evidence.confidence < 0 || evidence.confidence > 1)) {
    throw new TypeError('evidence confidence must be between 0 and 1');
  }
  if (evidence.limitations !== undefined
    && (!Array.isArray(evidence.limitations)
      || evidence.limitations.some((item) => typeof item !== 'string' || !item))) {
    throw new TypeError('evidence limitations must be non-empty strings');
  }
  if (!Number.isInteger(evidence.version) || evidence.version < 1) throw new TypeError('evidence version is invalid');
  return evidence;
}
