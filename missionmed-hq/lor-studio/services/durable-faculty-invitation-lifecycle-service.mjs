import {
  AuthorizationDeniedError,
  IntegrationDisabledError,
  LorDomainError,
  ValidationError,
} from '../domain/errors.js';
import {
  assertNonEmptyString,
  deepFreeze,
  hashValue,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { isAuthenticPostmarkFacultyInvitationAdapter } from '../adapters/faculty-otp-postmark-adapters.mjs';
import { hashFacultyEmail, normalizeFacultyEmail } from '../security/faculty-invitations.js';

const COMMAND_RECEIPT_SCHEMA = 'missionmed.lor.faculty-invitation-command-receipt.v1';
const DELIVERY_RESERVATION_RECEIPT_SCHEMA =
  'missionmed.lor.faculty-invitation-delivery-reservation-receipt.v1';
const SAFE_RESULT_SCHEMA = 'missionmed.lor.faculty-invitation-lifecycle-result.v1';
const TEMPLATE_ALIAS = 'lor-faculty-invitation-v1';
const DEFAULT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const DEFAULT_OTP_TTL_MS = 10 * 60 * 1_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const RECEIPT_ID_PATTERN = /^faculty_command_[a-f0-9]{64}$/u;
const EVENT_REF_PATTERN = /^event_[a-f0-9]{64}$/u;
const RESERVATION_ID_PATTERN = /^faculty_delivery_reservation_[a-f0-9]{64}$/u;
const TRANSACTION_ID_PATTERN = /^[0-9]+$/u;
const ACTOR_KEYS = new Set(['id', 'role']);
const ISSUE_KEYS = new Set([
  'actor', 'caseId', 'expectedRevision', 'idempotencyKey', 'recipientEmail',
]);
const RESEND_KEYS = new Set([
  'actor', 'caseId', 'idempotencyKey', 'recipientEmail',
]);
const REVOKE_KEYS = new Set(['actor', 'caseId', 'idempotencyKey']);
const DELIVERY_RECEIPT_KEYS = new Set([
  'schemaVersion', 'provider', 'invitationRef', 'recipientRef',
  'providerMessageRef', 'invitationRouteRef', 'templateAlias', 'acceptedAt',
  'status', 'recipientAndInvitationBound',
]);
const RECEIPT_KEYS = new Set([
  'schemaVersion',
  'receiptId',
  'action',
  'committed',
  'replayed',
  'caseId',
  'invitationId',
  'challengeIdHash',
  'caseRevision',
  'invitationRevision',
  'verified',
  'reasonCode',
  'auditEventRef',
  'transactionId',
  'invitationExpiresAt',
  'challengeExpiresAt',
]);
const DELIVERY_RESERVATION_RECEIPT_KEYS = new Set([
  'schemaVersion',
  'reservationId',
  'caseId',
  'invitationId',
  'deliveryAction',
  'status',
  'dispatchGranted',
  'replayed',
  'requestHash',
  'providerMessageRefHash',
  'auditEventRef',
  'reservedAt',
  'settledAt',
  'transactionId',
]);
const AUTHENTIC_DURABLE_FACULTY_INVITATION_LIFECYCLE_SERVICES = new WeakSet();

function snapshotExactRecord(value, expectedKeys, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an object`);
  }
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new ValidationError(`${fieldName} is unreadable`);
  }
  if (
    keys.length !== expectedKeys.size
    || keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
    || keys.some((key) => (
      !descriptors[key]
      || descriptors[key].enumerable !== true
      || !Object.hasOwn(descriptors[key], 'value')
    ))
  ) {
    throw new ValidationError(`${fieldName} has an invalid shape`);
  }
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, descriptors[key].value])));
}

function studentActor(rawActor) {
  const actor = snapshotExactRecord(rawActor, ACTOR_KEYS, 'actor');
  if (
    actor.role !== 'student'
    || typeof actor.id !== 'string'
    || !/^wp:[1-9][0-9]*$/u.test(actor.id)
  ) {
    throw new AuthorizationDeniedError('STUDENT_ACTOR_REQUIRED');
  }
  return actor;
}

function boundedCaseId(value) {
  assertNonEmptyString(value, 'caseId', { maxLength: 200 });
  if (!IDENTIFIER_PATTERN.test(value)) throw new ValidationError('caseId is invalid');
  return value;
}

function boundedIdempotencyKey(value) {
  return assertNonEmptyString(value, 'idempotencyKey', { maxLength: 200 });
}

function canonicalTimestamp(value, fieldName) {
  if (typeof value !== 'string' || toIso(value, fieldName) !== value) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_repository',
      'ATOMIC_COMMAND_RECEIPT_INVALID',
    );
  }
  return Object.freeze({ iso: value, timestamp: Date.parse(value) });
}

function assertNullableTimestamp(value, fieldName) {
  if (value === null) return null;
  return canonicalTimestamp(value, fieldName);
}

function validateCommandReceipt(rawReceipt, {
  action,
  caseId,
  invitationId = null,
  challengeId = null,
}) {
  let receipt;
  try {
    receipt = snapshotExactRecord(rawReceipt, RECEIPT_KEYS, 'command receipt');
  } catch {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_repository',
      'ATOMIC_COMMAND_RECEIPT_INVALID',
    );
  }
  if (
    receipt.schemaVersion !== COMMAND_RECEIPT_SCHEMA
    || receipt.action !== action
    || receipt.committed !== true
    || typeof receipt.replayed !== 'boolean'
    || receipt.caseId !== caseId
    || typeof receipt.invitationId !== 'string'
    || !IDENTIFIER_PATTERN.test(receipt.invitationId)
    || (invitationId !== null && receipt.invitationId !== invitationId)
    || typeof receipt.caseRevision !== 'number'
    || !Number.isSafeInteger(receipt.caseRevision)
    || receipt.caseRevision < 0
    || typeof receipt.invitationRevision !== 'number'
    || !Number.isSafeInteger(receipt.invitationRevision)
    || receipt.invitationRevision < 0
    || typeof receipt.receiptId !== 'string'
    || !RECEIPT_ID_PATTERN.test(receipt.receiptId)
    || typeof receipt.auditEventRef !== 'string'
    || !EVENT_REF_PATTERN.test(receipt.auditEventRef)
    || typeof receipt.transactionId !== 'string'
    || !TRANSACTION_ID_PATTERN.test(receipt.transactionId)
    || receipt.verified !== null
    || receipt.reasonCode !== null
  ) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_repository',
      'ATOMIC_COMMAND_RECEIPT_INVALID',
    );
  }
  if (challengeId === null) {
    if (receipt.challengeIdHash !== null) {
      throw new IntegrationDisabledError(
        'lor_faculty_invitation_repository',
        'ATOMIC_COMMAND_RECEIPT_INVALID',
      );
    }
  } else if (
    receipt.challengeIdHash !== hashValue({ challengeId })
    || !SHA256_PATTERN.test(receipt.challengeIdHash)
  ) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_repository',
      'ATOMIC_COMMAND_RECEIPT_INVALID',
    );
  }
  const invitationExpiry = assertNullableTimestamp(
    receipt.invitationExpiresAt,
    'receipt.invitationExpiresAt',
  );
  const challengeExpiry = assertNullableTimestamp(
    receipt.challengeExpiresAt,
    'receipt.challengeExpiresAt',
  );
  return Object.freeze({ receipt, invitationExpiry, challengeExpiry });
}

function assertWindow(receiptState, now) {
  const { invitationExpiry, challengeExpiry } = receiptState;
  if (
    invitationExpiry === null
    || challengeExpiry === null
    || invitationExpiry.timestamp <= now
    || challengeExpiry.timestamp <= now
    || challengeExpiry.timestamp > invitationExpiry.timestamp
  ) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_delivery',
      'COMMITTED_INVITATION_WINDOW_UNUSABLE',
    );
  }
}

function validateDeliveryReservationReceipt(rawReceipt, {
  caseId,
  invitationId,
  deliveryAction,
  requestHash,
}) {
  let receipt;
  try {
    receipt = snapshotExactRecord(
      rawReceipt,
      DELIVERY_RESERVATION_RECEIPT_KEYS,
      'delivery reservation receipt',
    );
  } catch {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_repository',
      'DELIVERY_RESERVATION_RECEIPT_INVALID',
    );
  }
  if (
    receipt.schemaVersion !== DELIVERY_RESERVATION_RECEIPT_SCHEMA
    || typeof receipt.reservationId !== 'string'
    || !RESERVATION_ID_PATTERN.test(receipt.reservationId)
    || receipt.caseId !== caseId
    || receipt.invitationId !== invitationId
    || receipt.deliveryAction !== deliveryAction
    || !['pending', 'accepted', 'unknown'].includes(receipt.status)
    || typeof receipt.dispatchGranted !== 'boolean'
    || typeof receipt.replayed !== 'boolean'
    || receipt.requestHash !== requestHash
    || !SHA256_PATTERN.test(receipt.requestHash)
    || typeof receipt.transactionId !== 'string'
    || !TRANSACTION_ID_PATTERN.test(receipt.transactionId)
  ) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_repository',
      'DELIVERY_RESERVATION_RECEIPT_INVALID',
    );
  }
  const reservedAt = canonicalTimestamp(receipt.reservedAt, 'receipt.reservedAt');
  const settledAt = assertNullableTimestamp(receipt.settledAt, 'receipt.settledAt');
  if (
    (receipt.dispatchGranted && (receipt.replayed || receipt.status !== 'pending'))
    || (!receipt.dispatchGranted && !receipt.replayed)
    || (settledAt !== null && settledAt.timestamp < reservedAt.timestamp)
    || (receipt.status === 'pending' && (
      receipt.providerMessageRefHash !== null
      || receipt.auditEventRef !== null
      || settledAt !== null
    ))
    || (receipt.status === 'unknown' && (
      receipt.providerMessageRefHash !== null
      || receipt.auditEventRef !== null
      || settledAt === null
    ))
    || (receipt.status === 'accepted' && (
      typeof receipt.providerMessageRefHash !== 'string'
      || !SHA256_PATTERN.test(receipt.providerMessageRefHash)
      || typeof receipt.auditEventRef !== 'string'
      || !EVENT_REF_PATTERN.test(receipt.auditEventRef)
      || settledAt === null
    ))
  ) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_repository',
      'DELIVERY_RESERVATION_RECEIPT_INVALID',
    );
  }
  return Object.freeze({ receipt, reservedAt, settledAt });
}

function httpsOrigin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new IntegrationDisabledError('lor_faculty_invitation_delivery', 'HTTPS_ORIGIN_REQUIRED');
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
    || parsed.username
    || parsed.password
  ) {
    throw new IntegrationDisabledError('lor_faculty_invitation_delivery', 'HTTPS_ORIGIN_REQUIRED');
  }
  return parsed.origin;
}

function validateDurations(invitationTtlMs, otpTtlMs) {
  if (
    !Number.isSafeInteger(invitationTtlMs)
    || invitationTtlMs < 60_000
    || invitationTtlMs > 30 * 24 * 60 * 60 * 1_000
    || !Number.isSafeInteger(otpTtlMs)
    || otpTtlMs < 60_000
    || otpTtlMs > 30 * 60 * 1_000
    || otpTtlMs > invitationTtlMs
  ) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_delivery',
      'EXPIRY_CONFIGURATION_INVALID',
    );
  }
  return Object.freeze({ invitationTtlMs, otpTtlMs });
}

function validateDependencies(repository, emailPort, secretDeriver, clock) {
  if (
    !repository
    || repository.isDurable !== true
    || repository.atomicInvitationOtpAndAudit !== true
    || repository.databaseClock !== true
    || typeof repository.issueAndCommit !== 'function'
    || typeof repository.resendOtpAndCommit !== 'function'
    || typeof repository.revokeAndCommit !== 'function'
    || typeof repository.reserveDelivery !== 'function'
    || typeof repository.commitDelivery !== 'function'
    || typeof repository.markDeliveryUnknown !== 'function'
  ) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_repository',
      'DURABLE_COMMAND_REPOSITORY_REQUIRED',
    );
  }
  if (
    !isAuthenticPostmarkFacultyInvitationAdapter(emailPort)
    || typeof emailPort.sendFacultyInvitation !== 'function'
  ) {
    throw new IntegrationDisabledError('postmark', 'EMAIL_PORT_REQUIRED');
  }
  if (
    !secretDeriver
    || typeof secretDeriver.deriveIssue !== 'function'
    || typeof secretDeriver.deriveResend !== 'function'
    || typeof secretDeriver.tokenForInvitation !== 'function'
  ) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_secrets',
      'SECRET_DERIVER_REQUIRED',
    );
  }
  if (typeof clock !== 'function') throw new TypeError('clock must be injected');
}

async function executeRepository(operation, callback) {
  try {
    return await callback();
  } catch (error) {
    if (error instanceof LorDomainError) throw error;
    throw new IntegrationDisabledError('lor_faculty_invitation_repository', operation);
  }
}

function deliveryIdempotencyKey(action, caseId, invitationId, originalIdempotencyKey) {
  return `faculty_delivery_${sha256(`${action}:${caseId}:${invitationId}:${originalIdempotencyKey}`)}`;
}

function safeResult(action, commandState, deliveryState = null) {
  const { receipt, invitationExpiry, challengeExpiry } = commandState;
  return deepFreeze({
    schemaVersion: SAFE_RESULT_SCHEMA,
    action,
    caseId: receipt.caseId,
    caseRevision: receipt.caseRevision,
    invitationRef: sha256(`lor-studio:invitation:${receipt.invitationId}`),
    invitationRevision: receipt.invitationRevision,
    invitationExpiresAt: invitationExpiry?.iso ?? null,
    challengeExpiresAt: challengeExpiry?.iso ?? null,
    delivered: deliveryState?.status === 'accepted',
    deliveryStatus: deliveryState?.status ?? null,
    idempotentReplay: receipt.replayed || deliveryState?.replayed === true,
    auditEventRef: receipt.auditEventRef,
    deliveryAuditEventRef: deliveryState?.auditEventRef ?? null,
  });
}

export class DurableFacultyInvitationLifecycleService {
  constructor({
    repository,
    emailPort,
    secretDeriver,
    invitationOrigin,
    clock = () => new Date(),
    invitationTtlMs = DEFAULT_INVITATION_TTL_MS,
    otpTtlMs = DEFAULT_OTP_TTL_MS,
  } = {}) {
    validateDependencies(repository, emailPort, secretDeriver, clock);
    this.repository = repository;
    this.emailPort = emailPort;
    this.secretDeriver = secretDeriver;
    this.invitationOrigin = httpsOrigin(invitationOrigin);
    this.clock = clock;
    this.durations = validateDurations(invitationTtlMs, otpTtlMs);
    Object.freeze(this);
    AUTHENTIC_DURABLE_FACULTY_INVITATION_LIFECYCLE_SERVICES.add(this);
  }

  async #deliver({
    action,
    actorId,
    caseId,
    idempotencyKey,
    recipientEmail,
    recipientEmailHash,
    rawToken,
    otpCode,
    commandState,
  }) {
    const invitationId = commandState.receipt.invitationId;
    const deliveryKey = deliveryIdempotencyKey(action, caseId, invitationId, idempotencyKey);
    const deliveryRequestHash = hashValue({
      schemaVersion: 'missionmed.lor.faculty-invitation-delivery-reservation-command.v1',
      caseId,
      invitationId,
      deliveryAction: action,
      recipientEmailHash,
      idempotencyKey: deliveryKey,
    });
    const rawReservationReceipt = await executeRepository(
      'DELIVERY_RESERVATION_UNAVAILABLE',
      () => this.repository.reserveDelivery({
        resourceStudentId: actorId,
        caseId,
        invitationId,
        deliveryAction: action,
        idempotencyKey: deliveryKey,
        requestHash: deliveryRequestHash,
      }),
    );
    const reservationState = validateDeliveryReservationReceipt(rawReservationReceipt, {
      caseId,
      invitationId,
      deliveryAction: action,
      requestHash: deliveryRequestHash,
    });
    if (!reservationState.receipt.dispatchGranted) {
      return Object.freeze({
        status: reservationState.receipt.status,
        replayed: true,
        auditEventRef: reservationState.receipt.auditEventRef,
      });
    }
    let providerReceipt;
    try {
      providerReceipt = await this.emailPort.sendFacultyInvitation({
        invitationId,
        recipientEmail,
        recipientEmailHash,
        invitationUrl: `${this.invitationOrigin}/lor-studio/invitations/${encodeURIComponent(invitationId)}`,
        invitationToken: rawToken,
        oneTimeCode: otpCode,
        expiresAt: commandState.invitationExpiry.iso,
        otpExpiresAt: commandState.challengeExpiry.iso,
        templateAlias: TEMPLATE_ALIAS,
      });
    } catch (error) {
      try {
        await this.repository.markDeliveryUnknown({
          resourceStudentId: actorId,
          caseId,
          invitationId,
          idempotencyKey: deliveryKey,
          requestHash: deliveryRequestHash,
        });
      } catch {
        // A persisted pending reservation remains fail-closed and suppresses replay delivery.
      }
      if (error instanceof LorDomainError) throw error;
      throw new IntegrationDisabledError('postmark', 'DELIVERY_TRANSPORT_UNAVAILABLE');
    }
    try {
      providerReceipt = snapshotExactRecord(
        providerReceipt,
        DELIVERY_RECEIPT_KEYS,
        'delivery receipt',
      );
    } catch {
      try {
        await this.repository.markDeliveryUnknown({
          resourceStudentId: actorId,
          caseId,
          invitationId,
          idempotencyKey: deliveryKey,
          requestHash: deliveryRequestHash,
        });
      } catch {
        // A persisted pending reservation remains fail-closed and suppresses replay delivery.
      }
      throw new IntegrationDisabledError('postmark', 'BOUND_DELIVERY_PROOF_INVALID');
    }
    if (
      providerReceipt.schemaVersion !== 'missionmed.lor.faculty-delivery-receipt.v1'
      || providerReceipt.provider !== 'postmark'
      || providerReceipt.invitationRef !== sha256(`lor-studio:invitation:${invitationId}`)
      || providerReceipt.recipientRef !== recipientEmailHash
      || typeof providerReceipt.providerMessageRef !== 'string'
      || !SHA256_PATTERN.test(providerReceipt.providerMessageRef)
      || typeof providerReceipt.invitationRouteRef !== 'string'
      || !SHA256_PATTERN.test(providerReceipt.invitationRouteRef)
      || providerReceipt.templateAlias !== TEMPLATE_ALIAS
      || providerReceipt.status !== 'accepted_for_delivery'
      || providerReceipt.recipientAndInvitationBound !== true
      || typeof providerReceipt.acceptedAt !== 'string'
      || !Number.isFinite(Date.parse(providerReceipt.acceptedAt))
    ) {
      try {
        await this.repository.markDeliveryUnknown({
          resourceStudentId: actorId,
          caseId,
          invitationId,
          idempotencyKey: deliveryKey,
          requestHash: deliveryRequestHash,
        });
      } catch {
        // A persisted pending reservation remains fail-closed and suppresses replay delivery.
      }
      throw new IntegrationDisabledError('postmark', 'BOUND_DELIVERY_PROOF_INVALID');
    }
    const rawDeliveryReceipt = await executeRepository(
      'DELIVERY_COMMIT_UNAVAILABLE',
      () => this.repository.commitDelivery({
        resourceStudentId: actorId,
        caseId,
        invitationId,
        providerMessageRefHash: providerReceipt.providerMessageRef,
        idempotencyKey: deliveryKey,
        requestHash: deliveryRequestHash,
      }),
    );
    const committedState = validateCommandReceipt(rawDeliveryReceipt, {
      action: 'faculty.invitation.delivery',
      caseId,
      invitationId,
    });
    return Object.freeze({
      status: 'accepted',
      replayed: committedState.receipt.replayed,
      auditEventRef: committedState.receipt.auditEventRef,
    });
  }

  async issue(rawInput) {
    const input = snapshotExactRecord(rawInput, ISSUE_KEYS, 'invitation issue request');
    const actor = studentActor(input.actor);
    const caseId = boundedCaseId(input.caseId);
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
      throw new ValidationError('expectedRevision must be a non-negative integer');
    }
    const idempotencyKey = boundedIdempotencyKey(input.idempotencyKey);
    const recipientEmail = normalizeFacultyEmail(input.recipientEmail);
    const recipientEmailHash = hashFacultyEmail(recipientEmail);
    const secret = this.secretDeriver.deriveIssue({
      caseId,
      expectedRevision: input.expectedRevision,
      recipientEmailHash,
      idempotencyKey,
    });
    const now = Date.parse(toIso(this.clock(), 'clock'));
    const invitationExpiresAt = new Date(now + this.durations.invitationTtlMs).toISOString();
    const challengeExpiresAt = new Date(now + this.durations.otpTtlMs).toISOString();
    const requestHash = hashValue({
      schemaVersion: 'missionmed.lor.faculty-invitation-issue-command.v1',
      actorId: actor.id,
      caseId,
      expectedRevision: input.expectedRevision,
      invitationId: secret.invitationId,
      recipientEmailHash,
      tokenHash: secret.tokenHash,
      challengeIdHash: hashValue({ challengeId: secret.challengeId }),
      otpCodeHash: secret.otpCodeHash,
      invitationTtlMs: this.durations.invitationTtlMs,
      otpTtlMs: this.durations.otpTtlMs,
      keyVersion: secret.keyVersion,
      idempotencyKey,
    });
    const rawReceipt = await executeRepository(
      'ISSUE_COMMAND_UNAVAILABLE',
      () => this.repository.issueAndCommit({
        actorId: actor.id,
        caseId,
        expectedRevision: input.expectedRevision,
        invitationId: secret.invitationId,
        recipientEmailHash,
        tokenHash: secret.tokenHash,
        challengeId: secret.challengeId,
        otpCodeHash: secret.otpCodeHash,
        invitationExpiresAt,
        challengeExpiresAt,
        maxAttempts: 5,
        attemptWindowMs: 15 * 60 * 1_000,
        lockoutMs: 30 * 60 * 1_000,
        idempotencyKey,
        requestHash,
      }),
    );
    const commandState = validateCommandReceipt(rawReceipt, {
      action: 'faculty.invitation.issue',
      caseId,
      invitationId: secret.invitationId,
      challengeId: secret.challengeId,
    });
    assertWindow(commandState, now);
    if (commandState.receipt.caseRevision !== input.expectedRevision + 1) {
      throw new IntegrationDisabledError(
        'lor_faculty_invitation_repository',
        'ATOMIC_COMMAND_RECEIPT_INVALID',
      );
    }
    const deliveryState = await this.#deliver({
      action: 'issue',
      actorId: actor.id,
      caseId,
      idempotencyKey,
      recipientEmail,
      recipientEmailHash,
      rawToken: secret.rawToken,
      otpCode: secret.otpCode,
      commandState,
    });
    return safeResult('issued', commandState, deliveryState);
  }

  async resendOtp(rawInput) {
    const input = snapshotExactRecord(rawInput, RESEND_KEYS, 'invitation resend request');
    const actor = studentActor(input.actor);
    const caseId = boundedCaseId(input.caseId);
    const idempotencyKey = boundedIdempotencyKey(input.idempotencyKey);
    const recipientEmail = normalizeFacultyEmail(input.recipientEmail);
    const recipientEmailHash = hashFacultyEmail(recipientEmail);
    const secret = this.secretDeriver.deriveResend({
      caseId,
      recipientEmailHash,
      idempotencyKey,
    });
    const now = Date.parse(toIso(this.clock(), 'clock'));
    const challengeExpiresAt = new Date(now + this.durations.otpTtlMs).toISOString();
    const requestHash = hashValue({
      schemaVersion: 'missionmed.lor.faculty-invitation-otp-resend-command.v1',
      actorId: actor.id,
      caseId,
      recipientEmailHash,
      challengeIdHash: hashValue({ challengeId: secret.challengeId }),
      otpCodeHash: secret.otpCodeHash,
      otpTtlMs: this.durations.otpTtlMs,
      keyVersion: secret.keyVersion,
      idempotencyKey,
    });
    const rawReceipt = await executeRepository(
      'OTP_RESEND_COMMAND_UNAVAILABLE',
      () => this.repository.resendOtpAndCommit({
        actorId: actor.id,
        caseId,
        recipientEmailHash,
        challengeId: secret.challengeId,
        otpCodeHash: secret.otpCodeHash,
        challengeExpiresAt,
        idempotencyKey,
        requestHash,
      }),
    );
    const commandState = validateCommandReceipt(rawReceipt, {
      action: 'faculty.invitation.otp_resend',
      caseId,
      challengeId: secret.challengeId,
    });
    assertWindow(commandState, now);
    const rawToken = this.secretDeriver.tokenForInvitation(commandState.receipt.invitationId);
    const deliveryState = await this.#deliver({
      action: 'resend',
      actorId: actor.id,
      caseId,
      idempotencyKey,
      recipientEmail,
      recipientEmailHash,
      rawToken,
      otpCode: secret.otpCode,
      commandState,
    });
    return safeResult('otp_resent', commandState, deliveryState);
  }

  async revoke(rawInput) {
    const input = snapshotExactRecord(rawInput, REVOKE_KEYS, 'invitation revoke request');
    const actor = studentActor(input.actor);
    const caseId = boundedCaseId(input.caseId);
    const idempotencyKey = boundedIdempotencyKey(input.idempotencyKey);
    const requestHash = hashValue({
      schemaVersion: 'missionmed.lor.faculty-invitation-revoke-command.v1',
      actorId: actor.id,
      caseId,
      idempotencyKey,
    });
    const rawReceipt = await executeRepository(
      'REVOKE_COMMAND_UNAVAILABLE',
      () => this.repository.revokeAndCommit({
        actorId: actor.id,
        caseId,
        idempotencyKey,
        requestHash,
      }),
    );
    const commandState = validateCommandReceipt(rawReceipt, {
      action: 'faculty.invitation.revoke',
      caseId,
    });
    if (commandState.invitationExpiry !== null || commandState.challengeExpiry !== null) {
      throw new IntegrationDisabledError(
        'lor_faculty_invitation_repository',
        'ATOMIC_COMMAND_RECEIPT_INVALID',
      );
    }
    return safeResult('revoked', commandState);
  }
}

Object.freeze(DurableFacultyInvitationLifecycleService.prototype);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAuthenticDurableFacultyInvitationLifecycleService(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  try {
    return AUTHENTIC_DURABLE_FACULTY_INVITATION_LIFECYCLE_SERVICES.has(value)
      && Object.getPrototypeOf(value) === DurableFacultyInvitationLifecycleService.prototype;
  } catch {
    return false;
  }
}

export const DURABLE_FACULTY_INVITATION_LIFECYCLE_CONTRACT = deepFreeze({
  commandReceiptSchema: COMMAND_RECEIPT_SCHEMA,
  safeResultSchema: SAFE_RESULT_SCHEMA,
  deliveryReservationReceiptSchema: DELIVERY_RESERVATION_RECEIPT_SCHEMA,
  clientIssueFields: ['expectedRevision', 'recipientEmail'],
  clientResendFields: ['recipientEmail'],
  clientRevokeFields: [],
  clientProhibitedFields: [
    'actorId', 'invitationId', 'challengeId', 'tokenHash', 'otpCodeHash',
    'recipientEmailHash', 'providerMessageRefHash', 'expiresAt',
  ],
  rawSecretPersistence: 'none',
  retryRecovery: 'server_side_hmac_derivation_only',
  deliveryOrder:
    'atomic_database_command_then_delivery_reservation_then_winner_only_postmark_then_atomic_delivery_receipt',
  deliveryReplay: 'stored_pending_accepted_or_unknown_without_provider_replay',
  providerReceipt: 'metadata_only_hash_refs',
});
