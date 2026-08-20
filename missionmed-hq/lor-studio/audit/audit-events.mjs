import { createHash, randomUUID } from 'node:crypto';

const EVENT_TYPES = new Set([
  // Grounded AI drafting, kept in step with ALLOWED_EVENT_TYPES in services/metadata-events.js.
  // The two vocabularies stay separate on purpose (different outcomes, different record shapes)
  // but must be JOINTLY closed over the AI plane: an event the ledger accepts and the audit sink
  // rejects is an unauditable state change. core-domain.test.mjs asserts both accept both.
  'ai.proposal_decision_recorded',
  'ai.proposal_generated',
  'case.created',
  'builder.saved',
  'builder.conflict',
  'faculty.invited',
  'faculty.verified',
  'faculty.finalized',
  'artifact.generated',
  'artifact.accessed',
  'artifact.denied',
  'case.exported',
  'case.deletion_requested',
  'case.deleted',
  'provider.fallback_used',
  'access.denied',
]);
const ACTOR_ROLES = new Set(['student', 'faculty', 'mentor', 'admin', 'founder', 'support', 'service']);
const OUTCOMES = new Set(['success', 'denied', 'conflict', 'degraded', 'failed']);
const SAFE_METADATA_KEYS = new Set([
  'action',
  'artifactFormat',
  'durationBucket',
  'errorCode',
  'fromRevision',
  'providerClass',
  'reasonCode',
  'result',
  'stepId',
  'toRevision',
]);
const PROTECTED_KEY = /(authorization|body|content|cookie|email|evidence|letter|name|prompt|secret|signature|story|text|token)/iu;
// A telemetry key must itself be a plain camelCase identifier. This rejects keys that ARE the
// sensitive datum - email addresses, numeric ids, `wp:1234` - which a value-only redaction
// would leave exposed in a per-identifier counter map.
const SAFE_TELEMETRY_KEY = /^[A-Za-z][A-Za-z0-9]{0,63}$/u;
const SAFE_TELEMETRY_STRING_KEYS = new Set([
  'action',
  'durationBucket',
  'errorCode',
  'format',
  'method',
  'outcome',
  'providerClass',
  'reasonCode',
  'result',
  'routeClass',
  'status',
  'stepId',
]);
const SAFE_TELEMETRY_SCALAR_KEYS = new Set([
  'artifactFailureRate',
  'attempt',
  'attemptCount',
  'authDenialRate',
  'count',
  'durable',
  'durationMs',
  'elapsedMs',
  'enabled',
  'errorRate',
  'killSwitch',
  'latencyMs',
  'p95LatencyMs',
  'retryCount',
  'sizeBytes',
  'staleWriteRate',
  'statusCode',
  'total',
  'truncated',
]);
const SAFE_TELEMETRY_VALUE = /^[A-Za-z0-9_.:/-]{1,120}$/u;

function digestReference(namespace, value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  return createHash('sha256').update(`lor-studio:${namespace}:${normalized}`).digest('hex').slice(0, 24);
}

function safeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Audit metadata must be an object.');
  const output = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) throw new Error(`Audit metadata key ${key} is not allowlisted.`);
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`Audit metadata value ${key} must be scalar.`);
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (typeof normalized === 'string' && normalized.length > 120) throw new Error(`Audit metadata value ${key} is too long.`);
    output[key] = normalized;
  }
  return output;
}

/**
 * @typedef {{
 *   id?: string,
 *   role?: string,
 * }} AuditActor
 */

/**
 * @param {{
 *   type?: string,
 *   actor?: AuditActor,
 *   caseId?: string,
 *   targetId?: string,
 *   outcome?: string,
 *   metadata?: Record<string, string | number | boolean>,
 *   at?: Date | string | number,
 * }} [options]
 */
export function createAuditEvent({ type, actor, caseId, targetId = '', outcome, metadata = {}, at = new Date() } = {}) {
  if (typeof type !== 'string' || !EVENT_TYPES.has(type)) throw new Error('Audit event type is not allowlisted.');
  if (typeof actor?.role !== 'string' || !ACTOR_ROLES.has(actor.role)) throw new Error('Audit actor role is not allowlisted.');
  if (!actor?.id) throw new Error('Audit actor id is required.');
  if (!caseId) throw new Error('Audit case id is required.');
  if (typeof outcome !== 'string' || !OUTCOMES.has(outcome)) throw new Error('Audit outcome is not allowlisted.');
  const timestamp = at instanceof Date ? at.toISOString() : new Date(at).toISOString();
  return Object.freeze({
    schemaVersion: 1,
    eventId: randomUUID(),
    type,
    at: timestamp,
    actorRole: actor.role,
    actorRef: digestReference('actor', actor.id),
    caseRef: digestReference('case', caseId),
    targetRef: targetId ? digestReference('target', targetId) : '',
    outcome,
    metadata: Object.freeze(safeMetadata(metadata)),
  });
}

export function redactForOperationalTelemetry(value, depth = 0, fieldName = '') {
  if (depth > 5) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    // Elements are unnamed: an allowlisted parent key must never vouch for its members,
    // or `{count: [studentId]}` would smuggle an identifier past the scalar gate.
    return value.slice(0, 20).map((item) => redactForOperationalTelemetry(item, depth + 1, ''));
  }
  if (value && typeof value === 'object') {
    const output = {};
    let redactedKeyCount = 0;
    for (const [key, child] of Object.entries(value).slice(0, 40)) {
      // Two distinct risks. A key like `email` merely NAMES a sensitive field: the key is a
      // schema label and only its value must go. A key like `jane.doe@example.com` or `4471`
      // IS the datum - a per-identifier counter map - so redacting only its value would still
      // publish the identifier. Drop the latter whole and report a count instead.
      if (!SAFE_TELEMETRY_KEY.test(key)) {
        redactedKeyCount += 1;
        continue;
      }
      output[key] = PROTECTED_KEY.test(key)
        ? '[REDACTED]'
        : redactForOperationalTelemetry(child, depth + 1, key);
    }
    if (redactedKeyCount > 0) output.redactedKeys = redactedKeyCount;
    return output;
  }
  if (typeof value === 'string') {
    return SAFE_TELEMETRY_STRING_KEYS.has(fieldName) && SAFE_TELEMETRY_VALUE.test(value)
      ? value
      : '[REDACTED]';
  }
  if (typeof value === 'boolean') {
    return SAFE_TELEMETRY_SCALAR_KEYS.has(fieldName) ? value : '[REDACTED]';
  }
  if (typeof value === 'number') {
    return SAFE_TELEMETRY_SCALAR_KEYS.has(fieldName) && Number.isFinite(value)
      ? value
      : '[REDACTED]';
  }
  if (value == null) return value;
  return '[REDACTED]';
}

export class InMemoryAuditEventSink {
  constructor() {
    this.durability = 'NON_DURABLE_TEST_ONLY';
    this.isDurable = false;
    this.events = [];
  }

  async emit(event) {
    if (!event?.eventId || !EVENT_TYPES.has(event.type)) throw new Error('Validated audit event is required.');
    this.events.push(structuredClone(event));
    return { accepted: true, durability: this.durability };
  }

  list() {
    return structuredClone(this.events);
  }
}
