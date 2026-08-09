import { createHash, randomUUID } from 'node:crypto';

const EVENT_TYPES = new Set([
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
const ACTOR_ROLES = new Set(['student', 'faculty', 'mentor', 'admin', 'service']);
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

export function createAuditEvent({ type, actor, caseId, targetId = '', outcome, metadata = {}, at = new Date() } = {}) {
  if (!EVENT_TYPES.has(type)) throw new Error('Audit event type is not allowlisted.');
  if (!ACTOR_ROLES.has(actor?.role)) throw new Error('Audit actor role is not allowlisted.');
  if (!actor?.id) throw new Error('Audit actor id is required.');
  if (!caseId) throw new Error('Audit case id is required.');
  if (!OUTCOMES.has(outcome)) throw new Error('Audit outcome is not allowlisted.');
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
    return value.slice(0, 20).map((item) => redactForOperationalTelemetry(item, depth + 1, fieldName));
  }
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, child] of Object.entries(value).slice(0, 40)) {
      output[key] = PROTECTED_KEY.test(key)
        ? '[REDACTED]'
        : redactForOperationalTelemetry(child, depth + 1, key);
    }
    return output;
  }
  if (typeof value === 'string') {
    return SAFE_TELEMETRY_STRING_KEYS.has(fieldName) && SAFE_TELEMETRY_VALUE.test(value)
      ? value
      : '[REDACTED]';
  }
  if (['number', 'boolean'].includes(typeof value) || value == null) return value;
  return String(value);
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
