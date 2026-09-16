export const PROJECTION_SCHEMA = 'matrix.projection.v1';

const AUTHORIZATION_BASES = new Set([
  'student_consent', 'mentor_assignment', 'admin', 'owner_policy',
]);
const DEGRADED_STATES = new Set(['stale', 'partial', 'unavailable']);

function requiredString(value, label) {
  if (typeof value !== 'string' || !value) throw new TypeError(`${label} is required`);
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item)) {
    throw new TypeError(`${label} must be an array of non-empty strings`);
  }
}

export function assertProjectionEnvelope(projection) {
  if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
    throw new TypeError('projection must be an object');
  }
  for (const key of [
    'projection_id', 'owner_app', 'projection_type', 'schema_version',
    'subject_id', 'source_version', 'produced_at',
  ]) {
    requiredString(projection[key], `projection.${key}`);
  }
  if (projection.schema_version !== '1') throw new TypeError('projection.schema_version must be 1');
  if (projection.fresh_until !== undefined) {
    requiredString(projection.fresh_until, 'projection.fresh_until');
  }
  if (!projection.authorization || typeof projection.authorization !== 'object'
    || !AUTHORIZATION_BASES.has(projection.authorization.basis)) {
    throw new TypeError('projection.authorization is invalid');
  }
  if (projection.authorization.consent_ref !== undefined) {
    requiredString(projection.authorization.consent_ref, 'projection.authorization.consent_ref');
  }
  stringArray(projection.authorization.scope, 'projection.authorization.scope');
  if (!projection.minimization || typeof projection.minimization !== 'object') {
    throw new TypeError('projection.minimization must be an object');
  }
  stringArray(projection.minimization.fields_included, 'projection.minimization.fields_included');
  if (projection.minimization.fields_excluded_reason !== undefined
    && (!projection.minimization.fields_excluded_reason
      || typeof projection.minimization.fields_excluded_reason !== 'object'
      || Array.isArray(projection.minimization.fields_excluded_reason))) {
    throw new TypeError('projection.minimization.fields_excluded_reason must be an object');
  }
  if (projection.payload === undefined) throw new TypeError('projection.payload is required');
  if (!projection.source_receipt || typeof projection.source_receipt !== 'object') {
    throw new TypeError('projection.source_receipt must be an object');
  }
  requiredString(projection.source_receipt.owner_ref, 'projection.source_receipt.owner_ref');
  requiredString(projection.source_receipt.hash, 'projection.source_receipt.hash');
  if (projection.source_receipt.signature !== undefined) {
    requiredString(projection.source_receipt.signature, 'projection.source_receipt.signature');
  }
  if (!projection.revocation || typeof projection.revocation !== 'object'
    || typeof projection.revocation.revocable !== 'boolean') {
    throw new TypeError('projection.revocation is invalid');
  }
  if (projection.revocation.check_url !== undefined) {
    requiredString(projection.revocation.check_url, 'projection.revocation.check_url');
  }
  if (projection.degraded !== undefined) {
    if (!DEGRADED_STATES.has(projection.degraded.state)) {
      throw new TypeError('invalid projection degraded state');
    }
    requiredString(projection.degraded.reason, 'projection.degraded.reason');
  }
  return projection;
}
