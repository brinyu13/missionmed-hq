import {
  AuthorizationDeniedError,
  IntegrationDisabledError,
  ValidationError,
} from '../domain/errors.js';
import { deepFreeze, toIso } from '../domain/value-utils.js';
import { EntitlementPort } from '../services/ports.js';

const PRODUCER_CONTRACT = 'mmhq_cam_build_entitlement';
const AUTHENTICATED_SUBJECT_SCHEMA = 'missionmed.authenticated-subject.v1';
const ALLOWED_PURCHASE_STATUSES = new Set(['completed', 'processing']);
const FORBIDDEN_REQUEST_FIELDS = new Set([
  'actorId',
  'canaryConsented',
  'canaryEnabled',
  'consent',
  'entitlement',
  'lorEnabled',
  'role',
  'tier',
]);

/**
 * @typedef {object} AuthenticatedSubjectProvider
 * @property {() => Promise<Record<string, unknown> | null | undefined>} getAuthenticatedSubject
 */

/**
 * @typedef {object} VerifiedEntitlementProducer
 * @property {(request: {wordpressSubject: string, producerContract: string}) => Promise<Record<string, unknown> | null | undefined>} readVerifiedEntitlement
 */

/**
 * @typedef {object} LorAdmissionReader
 * @property {(request: {wordpressSubject: string}) => Promise<Record<string, unknown> | null | undefined>} readAdmission
 */

/**
 * @typedef {object} WordPressEntitlementOptions
 * @property {Record<string, unknown> | null} [binding]
 * @property {AuthenticatedSubjectProvider | null} [authenticatedSubjectProvider]
 * @property {VerifiedEntitlementProducer | null} [entitlementProducer]
 * @property {LorAdmissionReader | null} [lorAdmissionReader]
 * @property {() => Date | string | number} [clock]
 * @property {number} [maximumAgeMs]
 */

function denied(studentId, reasonCode, { available = true, sourceVerified = true, revoked = null } = {}) {
  return deepFreeze({
    available,
    sourceVerified,
    studentId,
    actorId: studentId,
    role: 'student',
    active: false,
    tier: null,
    lorEnabled: false,
    revoked,
    canaryEnabled: null,
    canaryConsented: null,
    producerStatus: sourceVerified ? 'VERIFIED_SERVER_CONSUMER' : 'UNAVAILABLE_FAIL_CLOSED',
    denialReason: reasonCode,
  });
}

function assertBinding(binding) {
  if (
    !binding
    || binding.independentlyVerified !== true
    || binding.liveProducerVerified !== true
    || binding.configurationVerified !== true
    || binding.courseIdentifiersVerified !== true
    || binding.producerContract !== PRODUCER_CONTRACT
  ) {
    throw new IntegrationDisabledError('wordpress_lor_entitlement', 'PRODUCER_BINDING_REQUIRED');
  }
  return deepFreeze({ producerContract: binding.producerContract });
}

function assertReader(reader, method, integration) {
  if (!reader || typeof reader[method] !== 'function') {
    throw new IntegrationDisabledError(integration, 'INJECTED_READER_REQUIRED');
  }
  return reader;
}

function assertServerOnlyRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new ValidationError('Entitlement request must be an object');
  }
  for (const key of Object.keys(request)) {
    if (FORBIDDEN_REQUEST_FIELDS.has(key)) {
      throw new ValidationError('Client role, consent, or entitlement assertions are forbidden', { field: key });
    }
  }
  const requestedSubjects = [request.studentId, request.subject]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim());
  if (requestedSubjects.some((subject) => !/^wp:[1-9][0-9]*$/u.test(subject))) {
    throw new ValidationError('LOR subject hints must use the canonical wp:<id> identity');
  }
  if (new Set(requestedSubjects).size > 1) {
    throw new AuthorizationDeniedError('CALLER_SUBJECT_HINT_CONFLICT');
  }
  return requestedSubjects[0] ?? null;
}

function assertAuthenticatedSubjectContext(context) {
  const subject = String(context?.subject || '').trim();
  if (
    !context
    || context.schemaVersion !== AUTHENTICATED_SUBJECT_SCHEMA
    || context.authoritySource !== 'validated_hq_session'
    || context.authenticated !== true
    || context.clientAsserted === true
    || !/^wp:[1-9][0-9]*$/u.test(subject)
  ) {
    throw new IntegrationDisabledError(
      'wordpress_authenticated_subject',
      'VERIFIED_AUTHENTICATED_SUBJECT_REQUIRED',
    );
  }
  return subject;
}

function freshTimestamp(value, nowMs, maximumAgeMs) {
  const evaluatedAt = Date.parse(String(value || ''));
  return Number.isFinite(evaluatedAt)
    && evaluatedAt <= nowMs + 60_000
    && nowMs - evaluatedAt <= maximumAgeMs;
}

function expiryIsValid(projection, nowMs) {
  if (projection.expiryStatus === 'not_applicable' && projection.accessExpiresAt == null) return true;
  if (projection.expiryStatus !== 'expires') return false;
  const expiry = Date.parse(String(projection.accessExpiresAt || ''));
  return Number.isFinite(expiry) && expiry > nowMs;
}

function producerDenial(projection, subject, nowMs, maximumAgeMs) {
  if (!projection || typeof projection !== 'object') return 'ENTITLEMENT_MISSING';
  if (projection.available !== true) return 'ENTITLEMENT_UNAVAILABLE';
  if (projection.verified !== true || projection.producerContract !== PRODUCER_CONTRACT) {
    return 'ENTITLEMENT_UNVERIFIED';
  }
  if (projection.studentId !== subject) return 'ENTITLEMENT_SUBJECT_MISMATCH';
  if (!freshTimestamp(projection.evaluatedAt, nowMs, maximumAgeMs)) return 'ENTITLEMENT_STALE';
  if (
    typeof projection.restricted !== 'boolean'
    || typeof projection.revoked !== 'boolean'
    || typeof projection.active !== 'boolean'
  ) {
    return 'ENTITLEMENT_EVIDENCE_INCOMPLETE';
  }
  if (projection.restricted === true) return 'ENTITLEMENT_RESTRICTED';
  if (projection.revoked === true) return 'ENTITLEMENT_REVOKED';
  if (projection.active !== true) return 'ENTITLEMENT_INACTIVE';
  if (!expiryIsValid(projection, nowMs)) return 'ENTITLEMENT_EXPIRED_OR_UNPROVEN';
  if (
    projection.purchaseEvidence?.valid !== true
    || !ALLOWED_PURCHASE_STATUSES.has(projection.purchaseEvidence?.status)
    || !freshTimestamp(projection.purchaseEvidence?.evaluatedAt, nowMs, maximumAgeMs)
  ) {
    return 'ENTITLEMENT_PURCHASE_INVALID';
  }
  if (projection.programTier !== 'tier3_360') return 'ENTITLEMENT_INELIGIBLE_TIER';
  return null;
}

function admissionDenial(record, subject, nowMs, maximumAgeMs) {
  if (!record || typeof record !== 'object') return 'LOR_ADMISSION_MISSING';
  if (
    record.source !== 'lor_owned_server_record'
    || record.studentId !== subject
  ) {
    return 'LOR_ADMISSION_UNVERIFIED';
  }
  if (
    typeof record.verified !== 'boolean'
    || typeof record.revoked !== 'boolean'
    || typeof record.lorEnabled !== 'boolean'
    || typeof record.canaryEnabled !== 'boolean'
    || typeof record.canaryConsented !== 'boolean'
  ) {
    return 'LOR_ADMISSION_EVIDENCE_INCOMPLETE';
  }
  if (record.verified !== true) return 'LOR_ADMISSION_UNVERIFIED';
  if (!freshTimestamp(record.evaluatedAt, nowMs, maximumAgeMs)) return 'LOR_ADMISSION_STALE';
  if (record.revoked !== false) return 'LOR_ADMISSION_REVOKED';
  if (record.lorEnabled !== true) return 'LOR_NOT_EXPLICITLY_ENABLED';
  return null;
}

export class WordPressEntitlementConsumer extends EntitlementPort {
  /** @param {WordPressEntitlementOptions} [options] */
  constructor({
    binding,
    authenticatedSubjectProvider,
    entitlementProducer,
    lorAdmissionReader,
    clock = () => new Date(),
    maximumAgeMs = 5 * 60 * 1_000,
  } = {}) {
    super();
    this.binding = assertBinding(binding);
    this.authenticatedSubjectProvider = assertReader(
      authenticatedSubjectProvider,
      'getAuthenticatedSubject',
      'wordpress_authenticated_subject',
    );
    this.entitlementProducer = assertReader(
      entitlementProducer,
      'readVerifiedEntitlement',
      'wordpress_lor_entitlement',
    );
    this.lorAdmissionReader = assertReader(
      lorAdmissionReader,
      'readAdmission',
      'lor_admission_record',
    );
    if (typeof clock !== 'function') throw new TypeError('clock must be injected');
    if (!Number.isSafeInteger(maximumAgeMs) || maximumAgeMs < 1_000 || maximumAgeMs > 60 * 60 * 1_000) {
      throw new ValidationError('maximumAgeMs must be between one second and one hour');
    }
    this.clock = clock;
    this.maximumAgeMs = maximumAgeMs;
    this.producerStatus = 'VERIFIED_SERVER_CONSUMER';
    Object.freeze(this);
  }

  async getStudentEntitlement(request) {
    const requestedSubject = assertServerOnlyRequest(request);
    let authenticatedSubjectContext;
    try {
      authenticatedSubjectContext = await this.authenticatedSubjectProvider.getAuthenticatedSubject();
    } catch {
      throw new IntegrationDisabledError(
        'wordpress_authenticated_subject',
        'AUTHENTICATED_SUBJECT_LOOKUP_FAILED',
      );
    }
    const studentId = assertAuthenticatedSubjectContext(authenticatedSubjectContext);
    if (requestedSubject !== null && requestedSubject !== studentId) {
      throw new AuthorizationDeniedError('CALLER_SUBJECT_HINT_MISMATCH');
    }
    const now = new Date(toIso(this.clock(), 'clock'));
    let producerProjection;
    try {
      producerProjection = await this.entitlementProducer.readVerifiedEntitlement({
        wordpressSubject: studentId,
        producerContract: this.binding.producerContract,
      });
    } catch {
      return denied(studentId, 'ENTITLEMENT_UNAVAILABLE', {
        available: false,
        sourceVerified: false,
      });
    }

    const producerReason = producerDenial(
      producerProjection,
      studentId,
      now.valueOf(),
      this.maximumAgeMs,
    );
    if (producerReason) {
      return denied(studentId, producerReason, {
        available: producerReason !== 'ENTITLEMENT_UNAVAILABLE',
        sourceVerified: !['ENTITLEMENT_MISSING', 'ENTITLEMENT_UNAVAILABLE', 'ENTITLEMENT_UNVERIFIED'].includes(producerReason),
        revoked: producerReason === 'ENTITLEMENT_REVOKED'
          ? true
          : (typeof producerProjection?.revoked === 'boolean' ? producerProjection.revoked : null),
      });
    }

    let admission;
    try {
      admission = await this.lorAdmissionReader.readAdmission({ wordpressSubject: studentId });
    } catch {
      return denied(studentId, 'LOR_ADMISSION_UNAVAILABLE', {
        available: false,
        sourceVerified: false,
      });
    }
    const admissionReason = admissionDenial(admission, studentId, now.valueOf(), this.maximumAgeMs);
    if (admissionReason) {
      return denied(studentId, admissionReason, {
        available: true,
        sourceVerified: true,
        revoked: admissionReason === 'LOR_ADMISSION_REVOKED'
          ? true
          : (typeof admission?.revoked === 'boolean' ? admission.revoked : null),
      });
    }

    return deepFreeze({
      available: true,
      sourceVerified: true,
      studentId,
      actorId: studentId,
      role: 'student',
      active: true,
      tier: 'tier3_360',
      lorEnabled: true,
      revoked: false,
      canaryEnabled: admission.canaryEnabled,
      canaryConsented: admission.canaryConsented,
      producerStatus: this.producerStatus,
      evaluatedAt: now.toISOString(),
    });
  }

  async resolve(request) {
    return this.getStudentEntitlement(request);
  }
}

export const WORDPRESS_LOR_ENTITLEMENT_CONTRACT = deepFreeze({
  producerContract: PRODUCER_CONTRACT,
  identity: 'wp:<numeric-user-id>',
  authenticatedSubjectSchema: AUTHENTICATED_SUBJECT_SCHEMA,
  authenticatedSubjectAuthority: 'validated_hq_session',
  requestAuthority: 'trusted_authenticated_subject_provider_only',
  callerSubjectHintsSelectIdentity: false,
  clientAssertionsTrusted: false,
  admissionBooleanAuthority: [
    'verified',
    'revoked',
    'lorEnabled',
    'canaryEnabled',
    'canaryConsented',
  ],
  purchaseStatuses: [...ALLOWED_PURCHASE_STATUSES],
});
