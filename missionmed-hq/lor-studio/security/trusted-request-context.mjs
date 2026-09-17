import { AsyncLocalStorage } from 'node:async_hooks';

export const TRUSTED_REQUEST_CONTEXT_SCHEMA_VERSION =
  'missionmed.lor.trusted-request-context.v1';

const CONTEXT_KEYS = Object.freeze([
  'schemaVersion',
  'authenticatedSubject',
  'actorRole',
  'sourceReferenceHash',
  'proofHash',
  'entitlementVerified',
  'lorEnabled',
  'canaryAuthorized',
  'clientAsserted',
]);
const CONTEXT_KEY_SET = new Set(CONTEXT_KEYS);
const ACTOR_ROLES = new Set(['student', 'faculty', 'mentor']);
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SUBJECT_PATTERN = /^wp:([1-9][0-9]*)$/u;
const trustedRequestStorage = new AsyncLocalStorage();

function invalidContext(reason) {
  return new TypeError(`Invalid trusted request context: ${reason}.`);
}

function readDataProperties(input) {
  if (input === null || typeof input !== 'object') {
    throw invalidContext('a plain object is required');
  }

  let prototype;
  let ownKeys;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(input);
    ownKeys = Reflect.ownKeys(input);
    descriptors = Object.getOwnPropertyDescriptors(input);
  } catch {
    throw invalidContext('the object cannot be inspected safely');
  }

  if (prototype !== Object.prototype && prototype !== null) {
    throw invalidContext('a plain object is required');
  }
  if (
    ownKeys.length !== CONTEXT_KEYS.length
    || ownKeys.some((key) => typeof key !== 'string' || !CONTEXT_KEY_SET.has(key))
  ) {
    throw invalidContext('the exact context keys are required');
  }

  const values = Object.create(null);
  for (const key of CONTEXT_KEYS) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      || descriptor.enumerable !== true
    ) {
      throw invalidContext(`${key} must be an enumerable data property`);
    }
    values[key] = descriptor.value;
  }
  return values;
}

function assertSha256OrNull(value, fieldName) {
  if (value !== null && (typeof value !== 'string' || !SHA256_PATTERN.test(value))) {
    throw invalidContext(`${fieldName} must be a lowercase SHA-256 hash or null`);
  }
}

function cloneFrozenContext(context) {
  const clone = Object.create(null);
  for (const key of CONTEXT_KEYS) clone[key] = context[key];
  return Object.freeze(clone);
}

/**
 * Validate untrusted context input and return a detached immutable value.
 *
 * @param {unknown} input
 * @returns {Readonly<Record<string, string | boolean | null>>}
 */
export function createTrustedRequestContext(input) {
  const values = readDataProperties(input);

  if (values.schemaVersion !== TRUSTED_REQUEST_CONTEXT_SCHEMA_VERSION) {
    throw invalidContext('schemaVersion is unsupported');
  }

  if (typeof values.authenticatedSubject !== 'string') {
    throw invalidContext('authenticatedSubject is invalid');
  }
  const subjectMatch = SUBJECT_PATTERN.exec(values.authenticatedSubject);
  const subjectId = subjectMatch ? Number(subjectMatch[1]) : Number.NaN;
  if (!Number.isSafeInteger(subjectId) || subjectId <= 0) {
    throw invalidContext('authenticatedSubject is invalid');
  }

  if (typeof values.actorRole !== 'string' || !ACTOR_ROLES.has(values.actorRole)) {
    throw invalidContext('actorRole is invalid');
  }
  assertSha256OrNull(values.sourceReferenceHash, 'sourceReferenceHash');
  assertSha256OrNull(values.proofHash, 'proofHash');

  if (values.entitlementVerified !== true) {
    throw invalidContext('entitlementVerified must be true');
  }
  if (values.lorEnabled !== true) {
    throw invalidContext('lorEnabled must be true');
  }
  if (values.canaryAuthorized !== true) {
    throw invalidContext('canaryAuthorized must be true');
  }
  if (values.clientAsserted !== false) {
    throw invalidContext('clientAsserted must be false');
  }

  return cloneFrozenContext(values);
}

/**
 * Run one operation with an isolated trusted context. The context is rendered
 * inactive when the operation settles, so detached work fails closed.
 *
 * @param {unknown} input
 * @param {() => unknown | Promise<unknown>} operation
 * @returns {Promise<unknown>}
 */
export async function runWithTrustedRequestContext(input, operation) {
  if (typeof operation !== 'function') {
    throw new TypeError('A trusted request context operation is required.');
  }

  const context = createTrustedRequestContext(input);
  const scope = { active: true, context };
  return trustedRequestStorage.run(scope, async () => {
    try {
      return await operation();
    } finally {
      scope.active = false;
    }
  });
}

/**
 * Read a detached immutable copy of the active trusted request context.
 *
 * @returns {Readonly<Record<string, string | boolean | null>>}
 */
export function readTrustedRequestContext() {
  const scope = trustedRequestStorage.getStore();
  if (!scope || scope.active !== true) {
    throw new Error('Trusted request context is unavailable.');
  }
  return cloneFrozenContext(scope.context);
}
