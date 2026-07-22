const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/** Return the canonical lowercase RFC 9562 UUID string, or null. */
export function canonicalUuid(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return CANONICAL_UUID_PATTERN.test(text) ? text : null;
}

export function isCanonicalUuid(value) {
  return canonicalUuid(value) !== null;
}
