import { createHash, randomUUID } from 'node:crypto';

import { ValidationError } from './errors.js';

export function assertNonEmptyString(value, fieldName, { maxLength = 512 } = {}) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string`, { fieldName });
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} exceeds its maximum length`, {
      fieldName,
      maxLength,
    });
  }
  return value;
}

export function toIso(value, fieldName = 'timestamp') {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new ValidationError(`${fieldName} must be a valid date`, { fieldName });
  }
  return date.toISOString();
}

function canonicalizeFiniteNumber(value) {
  const serialized = JSON.stringify(value);
  if (!/[eE]/u.test(serialized)) return serialized;

  const negative = serialized.startsWith('-');
  const unsigned = negative ? serialized.slice(1) : serialized;
  const [coefficient, exponentText] = unsigned.toLowerCase().split('e');
  const exponent = Number(exponentText);
  const decimalPosition = coefficient.indexOf('.') === -1
    ? coefficient.length
    : coefficient.indexOf('.');
  const digits = coefficient.replace('.', '');
  const expandedPosition = decimalPosition + exponent;
  let expanded;
  if (expandedPosition <= 0) {
    expanded = `0.${'0'.repeat(-expandedPosition)}${digits}`;
  } else if (expandedPosition >= digits.length) {
    expanded = `${digits}${'0'.repeat(expandedPosition - digits.length)}`;
  } else {
    expanded = `${digits.slice(0, expandedPosition)}.${digits.slice(expandedPosition)}`;
  }
  return negative ? `-${expanded}` : expanded;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

export function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ValidationError('Only finite numbers are supported');
    // PostgreSQL jsonb emits numeric scalars as ordinary decimal text even
    // when the incoming JSON used exponent notation.  Expand JavaScript's
    // exponent form so JS- and DB-computed hashes share one byte contract.
    return canonicalizeFiniteNumber(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value)
      // SQL canonicalization orders jsonb object keys with COLLATE "C", i.e.
      // UTF-8 byte order rather than JavaScript's UTF-16 code-unit order.
      .sort(compareUtf8)
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(',')}}`;
  }
  throw new ValidationError('Value must be JSON-compatible');
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return createHash('sha256').update(bytes).digest('hex');
}

export function hashValue(value) {
  return sha256(canonicalize(value));
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export function cloneFrozen(value) {
  return deepFreeze(structuredClone(value));
}

export function makeId(prefix, idFactory = randomUUID) {
  const suffix = idFactory();
  assertNonEmptyString(suffix, `${prefix} id`, { maxLength: 200 });
  return `${prefix}_${suffix}`;
}

export function assertPlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new ValidationError(`${fieldName} must be a plain object`, { fieldName });
  }
  return value;
}
