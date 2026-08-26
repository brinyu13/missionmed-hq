import { AsyncLocalStorage } from 'node:async_hooks';

export const FACULTY_CANDIDATE_CREDENTIAL_SCHEMA =
  'missionmed.lor.faculty-candidate-credential.v1';

const CONTEXT_KEYS = Object.freeze([
  'schemaVersion',
  'authoritySource',
  'authenticatedSubject',
  'invitationId',
  'tokenHash',
  'flowNonceHash',
  'issuedAt',
  'expiresAt',
  'clientAsserted',
]);
const KEY_SET = new Set(CONTEXT_KEYS);
const SUBJECT = /^wp:[1-9][0-9]*$/u;
const LOCATOR = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_LIFETIME_MS = 15 * 60 * 1_000;
const CLOCK_SKEW_MS = 30 * 1_000;
const storage = new AsyncLocalStorage();

function invalid(reason) {
  throw new TypeError(`Invalid faculty candidate credential: ${reason}.`);
}

function canonicalInstant(value, fieldName) {
  if (typeof value !== 'string') invalid(`${fieldName} is invalid`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    invalid(`${fieldName} is invalid`);
  }
  return milliseconds;
}

function exactSnapshot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('plain object required');
  let keys;
  let descriptors;
  let prototype;
  try {
    keys = Reflect.ownKeys(input);
    descriptors = Object.getOwnPropertyDescriptors(input);
    prototype = Object.getPrototypeOf(input);
  } catch {
    invalid('credential cannot be inspected');
  }
  if (
    ![Object.prototype, null].includes(prototype)
    || keys.length !== CONTEXT_KEYS.length
    || keys.some((key) => typeof key !== 'string' || !KEY_SET.has(key))
  ) invalid('exact credential keys required');
  const snapshot = Object.create(null);
  for (const key of CONTEXT_KEYS) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || descriptor.enumerable !== true
      || !Object.hasOwn(descriptor, 'value')
    ) invalid(`${key} must be an enumerable data property`);
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function cloneFrozen(input) {
  const clone = Object.create(null);
  for (const key of CONTEXT_KEYS) clone[key] = input[key];
  return Object.freeze(clone);
}

/** @param {unknown} input @param {Date | number} [now] */
export function createFacultyCandidateCredentialContext(input, now = new Date()) {
  const value = exactSnapshot(input);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const issuedAt = canonicalInstant(value.issuedAt, 'issuedAt');
  const expiresAt = canonicalInstant(value.expiresAt, 'expiresAt');
  if (
    value.schemaVersion !== FACULTY_CANDIDATE_CREDENTIAL_SCHEMA
    || value.authoritySource !== 'server_verified_sealed_candidate_cookie'
    || !SUBJECT.test(value.authenticatedSubject ?? '')
    || !LOCATOR.test(value.invitationId ?? '')
    || !SHA256.test(value.tokenHash ?? '')
    || !SHA256.test(value.flowNonceHash ?? '')
    || value.clientAsserted !== false
    || !Number.isFinite(nowMs)
    || issuedAt > nowMs + CLOCK_SKEW_MS
    || expiresAt <= nowMs
    || expiresAt <= issuedAt
    || expiresAt - issuedAt > MAX_LIFETIME_MS
  ) invalid('credential is unavailable or expired');
  return cloneFrozen(value);
}

/** @param {unknown} input @param {() => unknown | Promise<unknown>} operation @param {Date | number} [now] */
export async function runWithFacultyCandidateCredentialContext(input, operation, now = new Date()) {
  if (typeof operation !== 'function') invalid('operation required');
  const context = createFacultyCandidateCredentialContext(input, now);
  const scope = { active: true, context };
  return storage.run(scope, async () => {
    try {
      return await operation();
    } finally {
      scope.active = false;
    }
  });
}

export function readFacultyCandidateCredentialContext() {
  const scope = storage.getStore();
  if (!scope || scope.active !== true) {
    throw new Error('Faculty candidate credential context is unavailable.');
  }
  return cloneFrozen(scope.context);
}

export const FACULTY_CANDIDATE_CREDENTIAL_CONTRACT = Object.freeze({
  schemaVersion: FACULTY_CANDIDATE_CREDENTIAL_SCHEMA,
  authoritySource: 'server_verified_sealed_candidate_cookie',
  maximumLifetimeSeconds: MAX_LIFETIME_MS / 1_000,
  rawTokenAccepted: false,
  browserPersistence: 'none',
  requestScope: 'exact_invitation_candidate_verification_only',
});
