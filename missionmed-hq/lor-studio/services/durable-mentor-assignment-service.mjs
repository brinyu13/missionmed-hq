import {
  IntegrationDisabledError,
  ValidationError,
} from '../domain/errors.js';
import {
  isAuthenticSupabaseDurableMentorAssignmentRepository,
} from '../repositories/supabase-durable-mentor-assignment-repository.mjs';

const INTEGRATION = 'lor_trusted_mentor_assignment_operator';
const SUBJECT = /^wp:[1-9][0-9]*$/u;
const LOCATOR = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const ASSIGNMENT_ID = /^mentor_service_assignment_[a-f0-9]{64}$/u;
const REASON_CODE = /^[A-Z0-9_:-]{1,120}$/u;
const OPTION_KEYS = new Set(['repository']);
const ASSIGN_KEYS = new Set([
  'caseId', 'studentAuthSubject', 'mentorAuthSubject', 'purpose',
  'maximumLifetimeSeconds', 'idempotencyKey',
]);
const REVOKE_KEYS = new Set([
  'caseId', 'studentAuthSubject', 'assignmentId', 'reasonCode', 'idempotencyKey',
]);
const AUTHENTIC_OPERATORS = new WeakSet();

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

function exactSnapshot(value, expectedKeys, errorFactory) {
  if (!plain(value)) throw errorFactory();
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw errorFactory();
  }
  if (
    keys.length !== expectedKeys.size
    || keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
  ) throw errorFactory();
  const snapshot = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, 'value')) {
      throw errorFactory();
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function invalidCommand() {
  return new ValidationError('Trusted mentor assignment command is invalid');
}

function commonCommand(command) {
  if (
    !LOCATOR.test(command.caseId ?? '')
    || !SUBJECT.test(command.studentAuthSubject ?? '')
    || !LOCATOR.test(command.idempotencyKey ?? '')
  ) throw invalidCommand();
  return command;
}

function assignCommand(rawCommand) {
  const command = commonCommand(exactSnapshot(rawCommand, ASSIGN_KEYS, invalidCommand));
  if (
    !SUBJECT.test(command.mentorAuthSubject ?? '')
    || command.mentorAuthSubject === command.studentAuthSubject
    || typeof command.purpose !== 'string'
    || command.purpose.length < 1
    || command.purpose.length > 160
    || command.purpose.trim() !== command.purpose
    || /[\u0000-\u001f\u007f]/u.test(command.purpose)
    || !Number.isSafeInteger(command.maximumLifetimeSeconds)
    || command.maximumLifetimeSeconds < 300
    || command.maximumLifetimeSeconds > 15_552_000
  ) throw invalidCommand();
  return command;
}

function revokeCommand(rawCommand) {
  const command = commonCommand(exactSnapshot(rawCommand, REVOKE_KEYS, invalidCommand));
  if (
    !ASSIGNMENT_ID.test(command.assignmentId ?? '')
    || !REASON_CODE.test(command.reasonCode ?? '')
  ) throw invalidCommand();
  return command;
}

export function createDurableMentorAssignmentOperator(rawOptions = {}) {
  const options = exactSnapshot(
    rawOptions,
    OPTION_KEYS,
    () => unavailable('OPTIONS_INVALID'),
  );
  if (!isAuthenticSupabaseDurableMentorAssignmentRepository(options.repository)) {
    throw unavailable('AUTHENTIC_DURABLE_REPOSITORY_REQUIRED');
  }
  const operator = Object.freeze({
    async assign(rawCommand) {
      return options.repository.assignAndCommit(assignCommand(rawCommand));
    },
    async revoke(rawCommand) {
      return options.repository.revokeAndCommit(revokeCommand(rawCommand));
    },
  });
  AUTHENTIC_OPERATORS.add(operator);
  return operator;
}

export function isAuthenticDurableMentorAssignmentOperator(value) {
  try {
    return AUTHENTIC_OPERATORS.has(value)
      && Object.isFrozen(value)
      && Reflect.ownKeys(value).length === 2
      && typeof value.assign === 'function'
      && typeof value.revoke === 'function';
  } catch {
    return false;
  }
}

export const DURABLE_MENTOR_ASSIGNMENT_OPERATOR_CONTRACT = Object.freeze({
  schemaVersion: 'missionmed.lor.trusted-mentor-assignment-operator.v1',
  actor: 'lor-mentor-assignment-operator-v1',
  transport: 'module_private_server_side_only',
  browserRoute: false,
  operation: 'read_only_mentor_case_access',
  lifetimeSeconds: Object.freeze({ minimum: 300, maximum: 15_552_000 }),
  databaseOwned: Object.freeze([
    'assignmentId', 'mentorAuthUid', 'assignedAt', 'expiresAt',
    'assignmentHash', 'revokedAt', 'revocationHash', 'auditEventRef',
    'eventHash', 'transactionId',
  ]),
});
