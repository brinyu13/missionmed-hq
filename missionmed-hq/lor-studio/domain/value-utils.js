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

export function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ValidationError('Only finite numbers are supported');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value)
      .sort()
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
