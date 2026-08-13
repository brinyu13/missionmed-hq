import { ValidationError } from '../domain/errors.js';
import {
  assertNonEmptyString,
  deepFreeze,
  makeId,
  sha256,
  toIso,
} from '../domain/value-utils.js';

const ALLOWED_OUTCOMES = new Set(['success', 'denied', 'failed', 'idempotent_replay']);
const ALLOWED_EVENT_TYPES = new Set([
  'case.created',
  'builder.autosaved',
  'builder.step_completed',
  'consent.recorded',
  'faculty.verification_denied',
  'faculty.verified',
  'waiver.recorded',
]);
const ALLOWED_ACTOR_ROLES = new Set([
  'student',
  'faculty',
  'mentor',
  'admin',
  'founder',
  'support',
  'service',
]);
const ALLOWED_EVENT_FIELDS = new Set([
  'schemaVersion',
  'eventRef',
  'eventType',
  'caseRef',
  'actorRef',
  'actorRole',
  'correlationRef',
  'outcome',
  'revision',
  'occurredAt',
]);

const FORBIDDEN_KEY_PATTERN = /(?:text|content|answer|note|draft|letter|token|secret|email|prompt|evidence)/iu;
const REFERENCE_PATTERN = /^(?:event|case|actor|correlation)_[a-f0-9]{64}$/u;

function digestReference(namespace, value) {
  assertNonEmptyString(value, namespace, { maxLength: 512 });
  return `${namespace}_${sha256(`lor-studio:${namespace}:${value}`)}`;
}

export function createMetadataServiceEvent({
  eventId,
  eventType,
  caseId,
  actorId,
  actorRole,
  correlationId,
  outcome = 'success',
  revision = null,
  occurredAt = new Date(),
  idFactory,
}) {
  assertNonEmptyString(eventType, 'eventType', { maxLength: 100 });
  assertNonEmptyString(actorRole, 'actorRole', { maxLength: 50 });
  if (!ALLOWED_EVENT_TYPES.has(eventType)) throw new ValidationError('Unknown metadata event type');
  if (!ALLOWED_ACTOR_ROLES.has(actorRole)) throw new ValidationError('Unknown metadata actor role');
  if (!ALLOWED_OUTCOMES.has(outcome)) throw new ValidationError('Unknown metadata event outcome');
  if (revision !== null && (!Number.isSafeInteger(revision) || revision < 0)) {
    throw new ValidationError('Metadata event revision must be a non-negative integer');
  }
  const event = {
    schemaVersion: 'missionmed.lor.service-event.v1',
    eventRef: digestReference('event', eventId ?? makeId('event', idFactory)),
    eventType,
    caseRef: digestReference('case', caseId),
    actorRef: digestReference('actor', actorId),
    actorRole,
    correlationRef: digestReference('correlation', correlationId),
    outcome,
    revision,
    occurredAt: toIso(occurredAt, 'occurredAt'),
  };
  validateMetadataServiceEvent(event);
  return deepFreeze(event);
}

export function validateMetadataServiceEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new ValidationError('Service event must be an object');
  }
  for (const key of Object.keys(event)) {
    if (!ALLOWED_EVENT_FIELDS.has(key) || FORBIDDEN_KEY_PATTERN.test(key)) {
      throw new ValidationError('Service event contains a non-metadata field', { field: key });
    }
  }
  if (Object.keys(event).length !== ALLOWED_EVENT_FIELDS.size) {
    throw new ValidationError('Service event is missing required metadata fields');
  }
  for (const field of ['eventRef', 'caseRef', 'actorRef', 'correlationRef']) {
    if (!REFERENCE_PATTERN.test(event[field] ?? '')) {
      throw new ValidationError('Service event references must be pseudonymized digests', { field });
    }
  }
  if (event.schemaVersion !== 'missionmed.lor.service-event.v1') {
    throw new ValidationError('Unsupported service event schema');
  }
  if (!ALLOWED_EVENT_TYPES.has(event.eventType)) throw new ValidationError('Unknown metadata event type');
  if (!ALLOWED_ACTOR_ROLES.has(event.actorRole)) throw new ValidationError('Unknown metadata actor role');
  if (!ALLOWED_OUTCOMES.has(event.outcome)) throw new ValidationError('Unknown metadata event outcome');
  if (event.revision !== null && (!Number.isSafeInteger(event.revision) || event.revision < 0)) {
    throw new ValidationError('Metadata event revision must be a non-negative integer');
  }
  toIso(event.occurredAt, 'occurredAt');
  if (Buffer.byteLength(JSON.stringify(event), 'utf8') > 2_048) {
    throw new ValidationError('Service event exceeds the metadata-only size limit');
  }
  return true;
}
