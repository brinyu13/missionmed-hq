import {
  AuthorizationDeniedError,
  IntegrationDisabledError,
  LorDomainError,
  ValidationError,
} from '../domain/errors.js';
import { deepFreeze, hashValue, sha256 } from '../domain/value-utils.js';
import { assertValidatedLorTargetBinding } from '../adapters/lor-target-binding.mjs';

const INTEGRATION = 'lor_artifact_audit_sink';
const SCOPE_SCHEMA = 'missionmed.lor.server-query-scope.v1';
const COMMAND_SCHEMA = 'missionmed.lor.artifact-audit-command.v1';
const RECEIPT_SCHEMA = 'missionmed.lor.artifact-audit-receipt.v1';
const CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const WP_SUBJECT = /^wp:[1-9][0-9]*$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH = /^[a-f0-9]{64}$/u;
const SAFE_REF = /^[a-f0-9]{24}$/u;
const TRANSACTION_REF = /^txn_[a-f0-9]{64}$/u;
const EVENT_TYPES = new Set(['artifact.generated', 'artifact.denied']);
const OUTCOMES = new Set(['success', 'denied']);
const EVENT_KEYS = new Set([
  'schemaVersion', 'eventId', 'type', 'at', 'actorRole', 'actorRef', 'caseRef',
  'targetRef', 'outcome', 'metadata',
]);
const CONTEXT_KEYS = new Set(['actorId', 'actorRole', 'caseId']);
const SCOPE_KEYS = new Set([
  'schemaVersion', 'authoritySource', 'authenticated', 'roleVerified', 'authUid',
  'authenticatedSubject', 'actorId', 'actorRole', 'resourceStudentId', 'caseId',
  'operation', 'purpose', 'assignmentId', 'invitationId', 'administrativeGrantId',
  'entitlementVerified', 'lorEnabled', 'canaryAuthorized',
]);
const RECEIPT_KEYS = new Set([
  'schemaVersion', 'accepted', 'replayed', 'caseId', 'eventId', 'eventType',
  'outcome', 'eventHash', 'scopeHash', 'targetBindingHash', 'transactionRef',
  'artifactSha256', 'releaseDocumentHash', 'sourceRevision', 'committedAt',
]);
const METADATA_FIELDS = Object.freeze({
  'artifact.generated': new Set([
    'action', 'artifactFormat', 'result', 'artifactSha256',
    'releaseDocumentHash', 'sourceRevision',
  ]),
  'artifact.denied': new Set(['action', 'artifactFormat', 'reasonCode']),
});
const AUTHENTIC_DURABLE_ARTIFACT_AUDIT_SINKS = new WeakSet();

function snapshotExact(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an exact object`);
  }
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new ValidationError(`${label} must be an exact object`);
  }
  if (
    keys.length !== expected.size
    || keys.some((key) => typeof key !== 'string' || !expected.has(key))
  ) throw new ValidationError(`${label} must be an exact object`);
  const stringKeys = /** @type {string[]} */ (keys);
  if (stringKeys.some((key) => (
    !descriptors[key]
    || !Object.hasOwn(descriptors[key], 'value')
    || descriptors[key].enumerable !== true
  ))) throw new ValidationError(`${label} must be an exact object`);
  return Object.freeze(Object.fromEntries(
    stringKeys.map((key) => [key, descriptors[key].value]),
  ));
}

function canonicalIso(value, label) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 32) {
    throw new ValidationError(`${label} must be a canonical timestamp`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new ValidationError(`${label} must be a canonical timestamp`);
  }
  return value;
}

function safeMetadata(rawMetadata, eventType) {
  const expected = METADATA_FIELDS[eventType];
  const metadata = snapshotExact(rawMetadata, expected, 'artifact audit metadata');
  for (const [key, value] of Object.entries(metadata)) {
    if (eventType === 'artifact.generated' && key === 'artifactSha256') {
      if (!HASH.test(String(value ?? ''))) {
        throw new ValidationError('artifact audit metadata artifactSha256 is invalid');
      }
      continue;
    }
    if (eventType === 'artifact.generated' && key === 'releaseDocumentHash') {
      if (value !== null && !HASH.test(String(value ?? ''))) {
        throw new ValidationError('artifact audit metadata releaseDocumentHash is invalid');
      }
      continue;
    }
    if (eventType === 'artifact.generated' && key === 'sourceRevision') {
      if (!Number.isSafeInteger(value) || Number(value) < 0) {
        throw new ValidationError('artifact audit metadata sourceRevision is invalid');
      }
      continue;
    }
    if (
      typeof value !== 'string'
      || value.length < 1
      || value.length > 120
      || value.trim() !== value
      || !/^[A-Za-z0-9_.:/ -]+$/u.test(value)
    ) throw new ValidationError(`artifact audit metadata ${key} is invalid`);
  }
  if (
    eventType === 'artifact.generated'
    && metadata.result === 'student_visible'
    && !HASH.test(String(metadata.releaseDocumentHash ?? ''))
  ) {
    throw new ValidationError(
      'student-visible artifact audit metadata requires an immutable releaseDocumentHash',
    );
  }
  return metadata;
}

function validateEvent(rawEvent, context) {
  const event = snapshotExact(rawEvent, EVENT_KEYS, 'artifact audit event');
  if (
    event.schemaVersion !== 1
    || typeof event.eventId !== 'string'
    || !UUID.test(event.eventId)
    || !EVENT_TYPES.has(event.type)
    || !OUTCOMES.has(event.outcome)
    || (event.type === 'artifact.generated' && event.outcome !== 'success')
    || (event.type === 'artifact.denied' && event.outcome !== 'denied')
    || event.actorRole !== context.actorRole
    || !SAFE_REF.test(String(event.actorRef ?? ''))
    || !SAFE_REF.test(String(event.caseRef ?? ''))
    || (event.targetRef !== '' && !SAFE_REF.test(String(event.targetRef ?? '')))
    || event.actorRef !== sha256(`lor-studio:actor:${context.actorId}`).slice(0, 24)
    || event.caseRef !== sha256(`lor-studio:case:${context.caseId}`).slice(0, 24)
  ) throw new ValidationError('artifact audit event is not actor/case bound');
  canonicalIso(event.at, 'artifact audit event.at');
  const metadata = safeMetadata(event.metadata, event.type);
  return deepFreeze({ ...event, metadata });
}

function validateContext(rawContext) {
  const context = snapshotExact(rawContext, CONTEXT_KEYS, 'artifact audit context');
  if (
    typeof context.actorId !== 'string'
    || !WP_SUBJECT.test(context.actorId)
    || !['student', 'faculty'].includes(context.actorRole)
    || typeof context.caseId !== 'string'
    || !CASE_ID.test(context.caseId)
  ) throw new AuthorizationDeniedError('ARTIFACT_AUDIT_CONTEXT_INVALID');
  return context;
}

function validateScope(rawScope, context) {
  let scope;
  try {
    scope = snapshotExact(rawScope, SCOPE_KEYS, 'artifact audit scope');
  } catch {
    throw new IntegrationDisabledError(INTEGRATION, 'VERIFIED_ARTIFACT_SCOPE_REQUIRED');
  }
  const roleShapeValid = context.actorRole === 'student'
    ? scope.purpose === 'student_case_read'
      && scope.resourceStudentId === context.actorId
      && scope.invitationId === null
      && scope.assignmentId === null
      && scope.administrativeGrantId === null
    : scope.purpose === 'faculty_private_edit'
      && typeof scope.invitationId === 'string'
      && CASE_ID.test(scope.invitationId)
      && scope.assignmentId === null
      && scope.administrativeGrantId === null;
  if (
    scope.schemaVersion !== SCOPE_SCHEMA
    || scope.authoritySource !== 'server_verified_session_crosswalk'
    || scope.authenticated !== true
    || scope.roleVerified !== true
    || typeof scope.authUid !== 'string'
    || !UUID.test(scope.authUid)
    || scope.authenticatedSubject !== context.actorId
    || scope.actorId !== context.actorId
    || scope.actorRole !== context.actorRole
    || typeof scope.resourceStudentId !== 'string'
    || !WP_SUBJECT.test(scope.resourceStudentId)
    || scope.caseId !== context.caseId
    || scope.operation !== 'read'
    || scope.entitlementVerified !== true
    || scope.lorEnabled !== true
    || scope.canaryAuthorized !== true
    || !roleShapeValid
  ) throw new AuthorizationDeniedError('VERIFIED_ARTIFACT_SCOPE_REQUIRED');
  return deepFreeze(scope);
}

function assertDriver(driver) {
  if (
    !driver
    || driver.rlsEnforced !== true
    || driver.serverOnly !== true
    || driver.databaseClock !== true
    || driver.appendOnlyArtifactAudit !== true
    || typeof driver.appendArtifactExportAuditAtomic !== 'function'
  ) throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_ARTIFACT_AUDIT_DRIVER_REQUIRED');
  return driver;
}

function validateReceipt(rawReceipt, command) {
  const receipt = snapshotExact(rawReceipt, RECEIPT_KEYS, 'artifact audit receipt');
  const generated = command.event.type === 'artifact.generated';
  const expectedArtifactSha256 = generated ? command.event.metadata.artifactSha256 : null;
  const expectedReleaseDocumentHash = generated
    ? command.event.metadata.releaseDocumentHash
    : null;
  const expectedSourceRevision = generated ? command.event.metadata.sourceRevision : null;
  if (
    receipt.schemaVersion !== RECEIPT_SCHEMA
    || receipt.accepted !== true
    || typeof receipt.replayed !== 'boolean'
    || receipt.caseId !== command.caseId
    || receipt.eventId !== command.event.eventId
    || receipt.eventType !== command.event.type
    || receipt.outcome !== command.event.outcome
    || receipt.eventHash !== command.eventHash
    || receipt.scopeHash !== command.scopeHash
    || receipt.targetBindingHash !== command.targetBindingHash
    || receipt.artifactSha256 !== expectedArtifactSha256
    || receipt.releaseDocumentHash !== expectedReleaseDocumentHash
    || receipt.sourceRevision !== expectedSourceRevision
    || (generated && (
      !HASH.test(String(receipt.artifactSha256 ?? ''))
      || (receipt.releaseDocumentHash !== null
        && !HASH.test(String(receipt.releaseDocumentHash ?? '')))
      || !Number.isSafeInteger(receipt.sourceRevision)
      || Number(receipt.sourceRevision) < 0
    ))
    || !TRANSACTION_REF.test(String(receipt.transactionRef ?? ''))
    || !HASH.test(String(receipt.eventHash ?? ''))
  ) throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_ARTIFACT_AUDIT_RECEIPT_INVALID');
  canonicalIso(receipt.committedAt, 'artifact audit receipt.committedAt');
  return deepFreeze(receipt);
}

export class SupabaseDurableArtifactAuditSink {
  constructor({ binding, driver, scopeProvider } = /** @type {any} */ ({})) {
    this.binding = assertValidatedLorTargetBinding(binding, INTEGRATION);
    this.targetBindingHash = hashValue(this.binding);
    this.driver = assertDriver(driver);
    if (typeof scopeProvider !== 'function') {
      throw new IntegrationDisabledError(INTEGRATION, 'SCOPE_PROVIDER_REQUIRED');
    }
    this.scopeProvider = scopeProvider;
    this.isDurable = true;
    this.serverOnly = true;
    this.actorCaseBound = true;
    this.appendOnly = true;
    this.durability = 'DURABLE_ACTOR_CASE_BOUND_APPEND_ONLY';
    AUTHENTIC_DURABLE_ARTIFACT_AUDIT_SINKS.add(this);
    Object.freeze(this);
  }

  async emit(rawEvent, rawContext) {
    const context = validateContext(rawContext);
    const event = validateEvent(rawEvent, context);
    let scope;
    try {
      const scopeRequest = context.actorRole === 'student'
        ? { caseId: context.caseId, operation: 'read', resourceStudentId: context.actorId }
        : { caseId: context.caseId, operation: 'read' };
      scope = validateScope(
        await this.scopeProvider(scopeRequest),
        context,
      );
    } catch (error) {
      if (error instanceof LorDomainError) throw error;
      throw new IntegrationDisabledError(INTEGRATION, 'VERIFIED_ARTIFACT_SCOPE_REQUIRED');
    }
    const command = deepFreeze({
      schemaVersion: COMMAND_SCHEMA,
      binding: this.binding,
      targetBindingHash: this.targetBindingHash,
      scope,
      scopeHash: hashValue(scope),
      caseId: context.caseId,
      event,
      eventHash: hashValue(event),
    });
    let receipt;
    try {
      receipt = await this.driver.appendArtifactExportAuditAtomic(structuredClone(command));
    } catch (error) {
      if (error instanceof LorDomainError) throw error;
      throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_ARTIFACT_AUDIT_UNAVAILABLE');
    }
    return validateReceipt(receipt, command);
  }
}

Object.freeze(SupabaseDurableArtifactAuditSink.prototype);

export function isAuthenticDurableArtifactAuditSink(value) {
  try {
    return Boolean(
      value
      && typeof value === 'object'
      && AUTHENTIC_DURABLE_ARTIFACT_AUDIT_SINKS.has(value)
      && Object.getPrototypeOf(value) === SupabaseDurableArtifactAuditSink.prototype
      && value.emit === SupabaseDurableArtifactAuditSink.prototype.emit
    );
  } catch {
    return false;
  }
}

export const DURABLE_ARTIFACT_AUDIT_CONTRACT = deepFreeze({
  commandSchema: COMMAND_SCHEMA,
  receiptSchema: RECEIPT_SCHEMA,
  eventTypes: [...EVENT_TYPES],
  roles: ['student', 'faculty'],
  databaseClock: true,
  rawProtectedContentAccepted: false,
  persistence: 'actor_case_bound_append_only_atomic_database_command',
  driverMethod: 'appendArtifactExportAuditAtomic',
});
