import {
  IntegrationDisabledError,
  ValidationError,
} from '../domain/errors.js';
import { MentorAssignmentRepositoryPort } from '../services/ports.js';
import { assertValidatedLorTargetBinding } from '../adapters/lor-target-binding.mjs';

const INTEGRATION = 'lor_mentor_assignment_repository';
const RECEIPT_SCHEMA = 'missionmed.lor.mentor-assignment-command-receipt.v1';
const SUBJECT = /^wp:[1-9][0-9]*$/u;
const LOCATOR = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const ASSIGNMENT_ID = /^mentor_service_assignment_[a-f0-9]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const EVENT_REF = /^event_[a-f0-9]{64}$/u;
const TRANSACTION_ID = /^(?:0|[1-9][0-9]{0,39})$/u;
const ASSIGN_KEYS = new Set([
  'caseId', 'studentAuthSubject', 'mentorAuthSubject', 'purpose',
  'maximumLifetimeSeconds', 'idempotencyKey',
]);
const REVOKE_KEYS = new Set([
  'caseId', 'studentAuthSubject', 'assignmentId', 'reasonCode', 'idempotencyKey',
]);
const RECEIPT_KEYS = new Set([
  'schemaVersion', 'action', 'committed', 'replayed', 'assignmentId', 'caseId',
  'studentAuthSubject', 'mentorAuthSubject', 'mentorAuthUid', 'operation', 'purpose',
  'assignedAt', 'expiresAt', 'revokedAt', 'assignmentHash', 'revocationHash',
  'auditEventRef', 'eventHash', 'transactionId',
]);
const AUTHENTIC_REPOSITORIES = new WeakSet();

function unavailable(status) {
  return new IntegrationDisabledError(INTEGRATION, status);
}

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    return [Object.prototype, null].includes(Object.getPrototypeOf(value));
  } catch {
    return false;
  }
}

function exactSnapshot(value, expectedKeys, status) {
  if (!plain(value)) throw unavailable(status);
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw unavailable(status);
  }
  if (
    keys.length !== expectedKeys.size
    || keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
  ) throw unavailable(status);
  const snapshot = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, 'value')) {
      throw unavailable(status);
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function canonicalInstant(value) {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function validateDriver(driver) {
  if (
    !driver
    || driver.serverOnly !== true
    || driver.rlsEnforced !== true
    || driver.databaseClock !== true
    || driver.atomicMentorAssignmentCommands !== true
    || typeof driver.assignMentorCaseAtomic !== 'function'
    || typeof driver.revokeMentorCaseAssignmentAtomic !== 'function'
  ) throw unavailable('ATOMIC_MENTOR_ASSIGNMENT_DRIVER_REQUIRED');
  return driver;
}

function validateCommand(rawCommand, expectedKeys, status) {
  const command = exactSnapshot(rawCommand, expectedKeys, status);
  if (
    !LOCATOR.test(command.caseId ?? '')
    || !SUBJECT.test(command.studentAuthSubject ?? '')
    || !LOCATOR.test(command.idempotencyKey ?? '')
  ) throw new ValidationError('Mentor assignment command is invalid');
  return command;
}

function validateReceipt(rawReceipt, expected) {
  const receipt = exactSnapshot(
    rawReceipt,
    RECEIPT_KEYS,
    'ATOMIC_MENTOR_ASSIGNMENT_RECEIPT_INVALID',
  );
  const assignedAt = Date.parse(String(receipt.assignedAt ?? ''));
  const expiresAt = Date.parse(String(receipt.expiresAt ?? ''));
  const revokedAt = receipt.revokedAt === null
    ? null
    : Date.parse(String(receipt.revokedAt));
  if (
    receipt.schemaVersion !== RECEIPT_SCHEMA
    || receipt.action !== expected.action
    || receipt.committed !== true
    || typeof receipt.replayed !== 'boolean'
    || !ASSIGNMENT_ID.test(receipt.assignmentId ?? '')
    || receipt.caseId !== expected.caseId
    || receipt.studentAuthSubject !== expected.studentAuthSubject
    || !SUBJECT.test(receipt.mentorAuthSubject ?? '')
    || !UUID.test(receipt.mentorAuthUid ?? '')
    || receipt.operation !== 'read'
    || typeof receipt.purpose !== 'string'
    || receipt.purpose.length < 1
    || receipt.purpose.length > 160
    || receipt.purpose.trim() !== receipt.purpose
    || !canonicalInstant(receipt.assignedAt)
    || !canonicalInstant(receipt.expiresAt)
    || expiresAt <= assignedAt
    || !SHA256.test(receipt.assignmentHash ?? '')
    || !EVENT_REF.test(receipt.auditEventRef ?? '')
    || !SHA256.test(receipt.eventHash ?? '')
    || !TRANSACTION_ID.test(receipt.transactionId ?? '')
  ) throw unavailable('ATOMIC_MENTOR_ASSIGNMENT_RECEIPT_INVALID');
  if (expected.action === 'mentor.assignment_issued') {
    if (
      receipt.mentorAuthSubject !== expected.mentorAuthSubject
      || receipt.purpose !== expected.purpose
      || expiresAt - assignedAt !== expected.maximumLifetimeSeconds * 1_000
      || receipt.revokedAt !== null
      || receipt.revocationHash !== null
    ) throw unavailable('ATOMIC_MENTOR_ASSIGNMENT_RECEIPT_INVALID');
  } else if (
    receipt.assignmentId !== expected.assignmentId
    || !canonicalInstant(receipt.revokedAt)
    || revokedAt < assignedAt
    || !SHA256.test(receipt.revocationHash ?? '')
  ) throw unavailable('ATOMIC_MENTOR_ASSIGNMENT_RECEIPT_INVALID');
  return Object.freeze({ ...receipt });
}

export class SupabaseDurableMentorAssignmentRepository
  extends MentorAssignmentRepositoryPort {
  /**
   * @param {{binding?: unknown, driver?: unknown}} [options]
   */
  constructor({ binding, driver } = {}) {
    super();
    this.binding = assertValidatedLorTargetBinding(binding, INTEGRATION);
    this.driver = validateDriver(driver);
    this.isDurable = true;
    this.serverOnly = true;
    this.databaseClock = true;
    this.atomicMentorAssignmentAndAudit = true;
    Object.freeze(this);
    AUTHENTIC_REPOSITORIES.add(this);
  }

  async assignAndCommit(rawCommand) {
    const command = validateCommand(
      rawCommand,
      ASSIGN_KEYS,
      'MENTOR_ASSIGNMENT_COMMAND_INVALID',
    );
    const receipt = await this.driver.assignMentorCaseAtomic(Object.freeze({
      binding: this.binding,
      ...command,
    }));
    return validateReceipt(receipt, {
      action: 'mentor.assignment_issued',
      caseId: command.caseId,
      studentAuthSubject: command.studentAuthSubject,
      mentorAuthSubject: command.mentorAuthSubject,
      purpose: command.purpose,
      maximumLifetimeSeconds: command.maximumLifetimeSeconds,
    });
  }

  async revokeAndCommit(rawCommand) {
    const command = validateCommand(
      rawCommand,
      REVOKE_KEYS,
      'MENTOR_REVOCATION_COMMAND_INVALID',
    );
    const receipt = await this.driver.revokeMentorCaseAssignmentAtomic(Object.freeze({
      binding: this.binding,
      ...command,
    }));
    return validateReceipt(receipt, {
      action: 'mentor.assignment_revoked',
      caseId: command.caseId,
      studentAuthSubject: command.studentAuthSubject,
      assignmentId: command.assignmentId,
    });
  }
}

export function isAuthenticSupabaseDurableMentorAssignmentRepository(value) {
  try {
    return AUTHENTIC_REPOSITORIES.has(value)
      && Object.isFrozen(value)
      && value.isDurable === true
      && value.serverOnly === true
      && value.atomicMentorAssignmentAndAudit === true;
  } catch {
    return false;
  }
}
