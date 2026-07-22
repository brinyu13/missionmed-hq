import { isStrictRfc3339 } from './timestamp-contract.mjs';

const enumOf = (...values) => Object.freeze(Object.fromEntries(values.map((value) => [value, value])));

export const ENVIRONMENT = enumOf('FIXTURE', 'LOCAL', 'STAGING', 'LIVE');
export const PERSISTENCE = enumOf('UNSAVED', 'SAVING', 'SAVED', 'RETRYING', 'CONFLICT', 'FAILED');
export const FRESHNESS = enumOf('CURRENT', 'STALE', 'EXPIRED', 'SOURCE_MISSING');
export const REVIEW = enumOf(
  'NOT_REQUIRED',
  'REVIEW_REQUIRED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
  'REVOKED',
);
export const IDENTITY = enumOf(
  'UNVERIFIED',
  'PROBABLE',
  'MANUAL_REVIEW',
  'CONFLICT',
  'VERIFIED_LOCAL_LINK',
  'REVOKED',
);
export const SENSITIVITY = enumOf('NORMAL', 'RESTRICTED', 'SENSITIVE');
export const VISIBILITY = enumOf(
  'MENTOR_PRIVATE',
  'OPERATIONS_RESTRICTED',
  'PUBLICATION_CANDIDATE',
  'STUDENT_PROJECTION',
);
export const PUBLICATION = enumOf(
  'NOT_ELIGIBLE',
  'DRAFT',
  'APPROVED',
  'PUBLISHED',
  'ACKNOWLEDGED',
  'CORRECTED',
  'SUPERSEDED',
  'WITHDRAWN',
  'EXPIRED',
);
export const JOB = enumOf(
  'QUEUED',
  'LEASED',
  'RUNNING',
  'RETRY_SCHEDULED',
  'SUCCEEDED',
  'FAILED',
  'DEAD_LETTER',
  'CANCELLED',
);
export const EVIDENCE_ORIGIN = enumOf(
  'OBSERVED',
  'IMPORTED',
  'USER_REPORTED',
  'DETERMINISTIC',
  'AI_PROPOSAL',
  'HUMAN_JUDGMENT',
);
export const SECTION_STATE = enumOf('AVAILABLE', 'PARTIAL', 'EMPTY', 'UNAVAILABLE', 'REVOKED');

export const MMC_STATE_ENUMS = Object.freeze({
  environment: ENVIRONMENT,
  persistence: PERSISTENCE,
  freshness: FRESHNESS,
  review: REVIEW,
  identity: IDENTITY,
  sensitivity: SENSITIVITY,
  visibility: VISIBILITY,
  publication: PUBLICATION,
  job: JOB,
  evidenceOrigin: EVIDENCE_ORIGIN,
  section: SECTION_STATE,
});

export const MMC_CONTRACT_LIMITS = Object.freeze({
  PLAIN_TEXT_MAX_BYTES: 32 * 1024,
  ERROR_MESSAGE_MAX_BYTES: 1024,
  OPAQUE_IDENTIFIER_MAX_BYTES: 128,
  SECTION_NAME_MAX_BYTES: 64,
  SECTION_COUNT_MAX: 64,
  DATA_KEY_MAX_BYTES: 128,
  DATA_ARRAY_LENGTH_MAX: 1000,
  DATA_OBJECT_KEYS_MAX: 256,
  DATA_DEPTH_MAX: 16,
  DATA_NODE_COUNT_MAX: 10_000,
  DATA_TOTAL_TEXT_MAX_BYTES: 256 * 1024,
  RETRY_AFTER_SECONDS_MAX: 86_400,
});

const QUERY_ENVELOPE_KEYS = Object.freeze(['data', 'meta']);
const QUERY_META_KEYS = Object.freeze(['environment', 'asOf', 'freshness', 'sections', 'correlationId']);
const SAFE_ERROR_ENVELOPE_KEYS = Object.freeze(['error']);
const SAFE_ERROR_KEYS = Object.freeze([
  'code',
  'message',
  'retryable',
  'correlationId',
  'diagnosticId',
  'retryAfterSeconds',
  'conflict',
]);
const SAFE_ERROR_REQUIRED_KEYS = Object.freeze(['code', 'message', 'retryable', 'correlationId']);
const OPAQUE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const SECTION_NAME_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/u;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/u;
const FORBIDDEN_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const textEncoder = new TextEncoder();

export class MmcStateContractError extends TypeError {
  constructor(code, field) {
    super(`${code}: invalid ${field}`);
    this.name = 'MmcStateContractError';
    this.code = code;
    this.field = field;
  }
}

// This envelope validates transport truth. Kind-specific resource contracts remain
// responsible for their own exact data fields; authority never enters query metadata.
export function buildQueryEnvelope(input) {
  assertPlainRecord(input, 'query envelope');
  assertExactKeys(input, QUERY_ENVELOPE_KEYS, 'query envelope');
  assertRequiredKeys(input, QUERY_ENVELOPE_KEYS, 'query envelope');
  assertPlainRecord(input.meta, 'query metadata');
  assertExactKeys(input.meta, QUERY_META_KEYS, 'query metadata');
  assertRequiredKeys(input.meta, QUERY_META_KEYS, 'query metadata');

  const envelope = {
    data: cloneBoundedJson(input.data),
    meta: {
      environment: input.meta.environment,
      asOf: input.meta.asOf,
      freshness: input.meta.freshness,
      sections: { ...input.meta.sections },
      correlationId: input.meta.correlationId,
    },
  };

  validateQueryEnvelope(envelope);
  return deepFreeze(envelope);
}

export function validateQueryEnvelope(envelope) {
  assertPlainRecord(envelope, 'query envelope');
  assertExactKeys(envelope, QUERY_ENVELOPE_KEYS, 'query envelope');
  assertRequiredKeys(envelope, QUERY_ENVELOPE_KEYS, 'query envelope');
  cloneBoundedJson(envelope.data);

  const { meta } = envelope;
  assertPlainRecord(meta, 'query metadata');
  assertExactKeys(meta, QUERY_META_KEYS, 'query metadata');
  assertRequiredKeys(meta, QUERY_META_KEYS, 'query metadata');
  assertEnumValue(ENVIRONMENT, meta.environment, 'query environment');
  assertRfc3339(meta.asOf, 'query as-of time');
  assertEnumValue(FRESHNESS, meta.freshness, 'query freshness');
  assertOpaqueIdentifier(meta.correlationId, 'query correlation identifier');
  validateSections(meta.sections);
  return true;
}

export function buildSafeErrorEnvelope(input) {
  assertPlainRecord(input, 'safe error input');
  assertExactKeys(input, SAFE_ERROR_KEYS, 'safe error input');
  assertRequiredKeys(input, SAFE_ERROR_REQUIRED_KEYS, 'safe error input');
  assertBoundedPlainText(input.message, MMC_CONTRACT_LIMITS.ERROR_MESSAGE_MAX_BYTES, 'safe error message');

  const message = redactUnsafeErrorText(input.message);
  const error = {
    code: input.code,
    message: message || 'The request could not be completed safely.',
    retryable: input.retryable,
    correlationId: input.correlationId,
  };

  if (input.diagnosticId !== undefined) error.diagnosticId = input.diagnosticId;
  if (input.retryAfterSeconds !== undefined) error.retryAfterSeconds = input.retryAfterSeconds;
  if (input.conflict !== undefined) error.conflict = { ...input.conflict };

  const envelope = { error };
  validateSafeErrorEnvelope(envelope);
  return deepFreeze(envelope);
}

export function validateSafeErrorEnvelope(envelope) {
  assertPlainRecord(envelope, 'safe error envelope');
  assertExactKeys(envelope, SAFE_ERROR_ENVELOPE_KEYS, 'safe error envelope');
  assertRequiredKeys(envelope, SAFE_ERROR_ENVELOPE_KEYS, 'safe error envelope');
  assertPlainRecord(envelope.error, 'safe error');
  assertExactKeys(envelope.error, SAFE_ERROR_KEYS, 'safe error');
  assertRequiredKeys(envelope.error, SAFE_ERROR_REQUIRED_KEYS, 'safe error');

  const error = envelope.error;
  assertBoundedPlainText(error.code, 64, 'safe error code');
  if (!ERROR_CODE_PATTERN.test(error.code)) fail('MMC_CONTRACT_INVALID_ERROR_CODE', 'safe error code');
  assertBoundedPlainText(error.message, MMC_CONTRACT_LIMITS.ERROR_MESSAGE_MAX_BYTES, 'safe error message');
  if (!error.message.trim()) fail('MMC_CONTRACT_INVALID_TEXT', 'safe error message');
  if (redactUnsafeErrorText(error.message) !== error.message) {
    fail('MMC_CONTRACT_UNSAFE_TEXT', 'safe error message');
  }
  if (typeof error.retryable !== 'boolean') fail('MMC_CONTRACT_INVALID_SHAPE', 'safe error retryability');
  assertOpaqueIdentifier(error.correlationId, 'safe error correlation identifier');

  if (error.diagnosticId !== undefined) {
    assertOpaqueIdentifier(error.diagnosticId, 'safe error diagnostic identifier');
  }
  if (error.retryAfterSeconds !== undefined) {
    if (!error.retryable) fail('MMC_CONTRACT_INVALID_RETRY', 'safe error retry delay');
    if (
      !Number.isInteger(error.retryAfterSeconds)
      || error.retryAfterSeconds < 0
      || error.retryAfterSeconds > MMC_CONTRACT_LIMITS.RETRY_AFTER_SECONDS_MAX
    ) {
      fail('MMC_CONTRACT_INVALID_RETRY', 'safe error retry delay');
    }
  }
  if (error.conflict !== undefined) validateConflict(error.conflict);
  return true;
}

function validateConflict(conflict) {
  assertPlainRecord(conflict, 'safe version conflict');
  assertExactKeys(conflict, ['expectedVersion', 'currentVersion', 'resolution'], 'safe version conflict');
  assertRequiredKeys(conflict, ['expectedVersion', 'currentVersion', 'resolution'], 'safe version conflict');
  if (!Number.isSafeInteger(conflict.expectedVersion) || conflict.expectedVersion < 0
    || !Number.isSafeInteger(conflict.currentVersion) || conflict.currentVersion < 0
    || conflict.resolution !== 'COMPARE_AND_REAPPLY') {
    fail('MMC_CONTRACT_INVALID_CONFLICT', 'safe version conflict');
  }
}

function validateSections(sections) {
  assertPlainRecord(sections, 'query sections');
  const entries = Object.entries(sections);
  if (entries.length < 1 || entries.length > MMC_CONTRACT_LIMITS.SECTION_COUNT_MAX) {
    fail('MMC_CONTRACT_LIMIT_EXCEEDED', 'query sections');
  }
  for (const [name, state] of entries) {
    assertBoundedPlainText(name, MMC_CONTRACT_LIMITS.SECTION_NAME_MAX_BYTES, 'query section name');
    if (!SECTION_NAME_PATTERN.test(name)) fail('MMC_CONTRACT_INVALID_IDENTIFIER', 'query section name');
    assertEnumValue(SECTION_STATE, state, 'query section state');
  }
}

function cloneBoundedJson(value) {
  const context = {
    depth: 0,
    nodes: 0,
    totalTextBytes: 0,
    ancestors: new WeakSet(),
  };
  return cloneJsonValue(value, context);
}

function cloneJsonValue(value, context) {
  context.nodes += 1;
  if (context.nodes > MMC_CONTRACT_LIMITS.DATA_NODE_COUNT_MAX) {
    fail('MMC_CONTRACT_LIMIT_EXCEEDED', 'query data');
  }

  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('MMC_CONTRACT_INVALID_JSON', 'query data');
    return value;
  }
  if (typeof value === 'string') {
    const bytes = assertBoundedPlainText(value, MMC_CONTRACT_LIMITS.PLAIN_TEXT_MAX_BYTES, 'query data text');
    context.totalTextBytes += bytes;
    if (context.totalTextBytes > MMC_CONTRACT_LIMITS.DATA_TOTAL_TEXT_MAX_BYTES) {
      fail('MMC_CONTRACT_LIMIT_EXCEEDED', 'query data text');
    }
    return value;
  }
  if (typeof value !== 'object') fail('MMC_CONTRACT_INVALID_JSON', 'query data');
  if (context.depth >= MMC_CONTRACT_LIMITS.DATA_DEPTH_MAX) {
    fail('MMC_CONTRACT_LIMIT_EXCEEDED', 'query data depth');
  }
  if (context.ancestors.has(value)) fail('MMC_CONTRACT_INVALID_JSON', 'query data cycle');

  context.ancestors.add(value);
  context.depth += 1;
  try {
    if (Array.isArray(value)) {
      if (value.length > MMC_CONTRACT_LIMITS.DATA_ARRAY_LENGTH_MAX) {
        fail('MMC_CONTRACT_LIMIT_EXCEEDED', 'query data array');
      }
      return value.map((item) => cloneJsonValue(item, context));
    }

    assertPlainRecord(value, 'query data object');
    const entries = Object.entries(value);
    if (entries.length > MMC_CONTRACT_LIMITS.DATA_OBJECT_KEYS_MAX) {
      fail('MMC_CONTRACT_LIMIT_EXCEEDED', 'query data object');
    }
    const clone = {};
    for (const [key, item] of entries) {
      assertBoundedPlainText(key, MMC_CONTRACT_LIMITS.DATA_KEY_MAX_BYTES, 'query data key');
      if (DANGEROUS_OBJECT_KEYS.has(key)) fail('MMC_CONTRACT_INVALID_JSON', 'query data key');
      clone[key] = cloneJsonValue(item, context);
    }
    return clone;
  } finally {
    context.depth -= 1;
    context.ancestors.delete(value);
  }
}

function redactUnsafeErrorText(value) {
  // Defense in depth only: callers should supply stable user-safe copy, never raw
  // provider, filesystem, credential, stack, or private-object messages.
  return value
    .replace(/\b(?:provider|upstream|remote)\s+(?:payload|response|body|detail)\s*[:=][\s\S]{1,1024}$/giu, '[redacted-provider-payload]')
    .replace(/\bhttps?:\/\/[^\s<>"']+/giu, '[redacted-url]')
    .replace(/(^|[\s"'(:=])\/(?:Users|home|private|var|tmp|etc|opt|Volumes|root|srv|app|workspace|mnt|data)\/[^\s<>"']+/gmu, '$1[redacted-path]')
    .replace(/(^|[\s"'(:=])[A-Za-z]:\\[^\s<>"']+/gmu, '$1[redacted-path]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/giu, 'Bearer [redacted-secret]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|xox[baprs]?-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/gu, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/gu, '[redacted-secret]')
    .replace(/\b(token|access[_-]?token|refresh[_-]?token|api[_-]?key|anon[_-]?key|authorization|secret|client[_-]?secret|private[_-]?key|password|service[_-]?role|cookie|session)\s*[:=]\s*["']?[^\s,;"'}]+/giu, '$1=[redacted-secret]')
    .trim();
}

function assertPlainRecord(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('MMC_CONTRACT_INVALID_SHAPE', field);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail('MMC_CONTRACT_INVALID_SHAPE', field);
  }
}

function assertExactKeys(value, allowedKeys, field) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    fail('MMC_CONTRACT_UNKNOWN_FIELD', field);
  }
}

function assertRequiredKeys(value, requiredKeys, field) {
  if (requiredKeys.some((key) => !Object.hasOwn(value, key))) {
    fail('MMC_CONTRACT_MISSING_FIELD', field);
  }
}

function assertEnumValue(enumObject, value, field) {
  if (typeof value !== 'string' || !Object.hasOwn(enumObject, value)) {
    fail('MMC_CONTRACT_INVALID_ENUM', field);
  }
}

function assertRfc3339(value, field) {
  if (!isStrictRfc3339(value)) {
    fail('MMC_CONTRACT_INVALID_TIMESTAMP', field);
  }
}

function assertOpaqueIdentifier(value, field) {
  assertBoundedPlainText(value, MMC_CONTRACT_LIMITS.OPAQUE_IDENTIFIER_MAX_BYTES, field);
  if (!OPAQUE_IDENTIFIER_PATTERN.test(value)) fail('MMC_CONTRACT_INVALID_IDENTIFIER', field);
}

function assertBoundedPlainText(value, maxBytes, field) {
  if (typeof value !== 'string' || FORBIDDEN_CONTROL_PATTERN.test(value)) {
    fail('MMC_CONTRACT_INVALID_TEXT', field);
  }
  const byteLength = textEncoder.encode(value).byteLength;
  if (byteLength > maxBytes) fail('MMC_CONTRACT_LIMIT_EXCEEDED', field);
  return byteLength;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

function fail(code, field) {
  throw new MmcStateContractError(code, field);
}
