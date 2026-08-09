import { IntegrationDisabledError, ValidationError } from '../domain/errors.js';
import {
  assertNonEmptyString,
  deepFreeze,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { hashFacultyEmail, normalizeFacultyEmail } from '../security/faculty-invitations.js';
import { EmailPort, OtpPort } from '../services/ports.js';

const OTP_PROOF_SCHEMA = 'missionmed.lor.otp-proof.v1';
const DELIVERY_RECEIPT_SCHEMA = 'missionmed.lor.faculty-delivery-receipt.v1';
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const POSTMARK_TEMPLATE_ALIAS = 'lor-faculty-invitation-v1';
const INVITATION_ROUTE_TEMPLATE = '/lor-studio/invitations/{invitationId}';
const OTP_PROVIDER_UNAVAILABLE = 'OTP_PROVIDER_UNAVAILABLE';
const OTP_PROVIDER_PROOF_INVALID = 'BOUND_PROVIDER_PROOF_INVALID';
const POSTMARK_TRANSPORT_UNAVAILABLE = 'DELIVERY_TRANSPORT_UNAVAILABLE';
const POSTMARK_PROVIDER_PROOF_INVALID = 'BOUND_DELIVERY_PROOF_INVALID';

function assertExactKeys(value, allowed, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an object`);
  }
  let unexpected;
  try {
    unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  } catch {
    throw new ValidationError(`${fieldName} contains forbidden fields`);
  }
  if (unexpected.length) {
    throw new ValidationError(`${fieldName} contains forbidden fields`);
  }
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function parseCanonicalIso(value, fieldName) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a canonical ISO timestamp`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new ValidationError(`${fieldName} must be a canonical ISO timestamp`);
  }
  return deepFreeze({ iso: value, timestamp });
}

function assertDigest(value, fieldName) {
  if (!SHA256_PATTERN.test(value ?? '')) {
    throw new ValidationError(`${fieldName} must be a SHA-256 digest`);
  }
}

function assertOtpBinding(binding) {
  if (
    !binding
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.durableChallengeStore !== true
    || binding.oneTimeConsumption !== true
    || binding.invitationBound !== true
    || binding.recipientHashBound !== true
    || binding.challengeIdBound !== true
    || binding.challengeExpiryBound !== true
    || binding.challengeRevocationBound !== true
  ) {
    throw new IntegrationDisabledError('lor_otp', 'OTP_BINDING_REQUIRED');
  }
  return deepFreeze({
    challengeIdBound: true,
    challengeExpiryBound: true,
    challengeRevocationBound: true,
  });
}

function assertPostmarkBinding(binding) {
  if (
    !binding
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.provider !== 'postmark'
    || binding.senderIdentityVerified !== true
    || binding.serverSideCredentials !== true
    || typeof binding.invitationOrigin !== 'string'
    || binding.invitationRouteTemplate !== INVITATION_ROUTE_TEMPLATE
    || binding.templateAlias !== POSTMARK_TEMPLATE_ALIAS
  ) {
    throw new IntegrationDisabledError('postmark', 'POSTMARK_BINDING_REQUIRED');
  }
  let origin;
  try {
    const url = new URL(binding.invitationOrigin);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) throw new Error('invalid');
    origin = url.origin;
  } catch {
    throw new IntegrationDisabledError('postmark', 'POSTMARK_INVITATION_ORIGIN_REQUIRED');
  }
  return deepFreeze({
    origin,
    invitationRouteTemplate: INVITATION_ROUTE_TEMPLATE,
    templateAlias: POSTMARK_TEMPLATE_ALIAS,
  });
}

function deniedOtpProof({ challengeId, invitationId, recipientEmailHash, status }) {
  return deepFreeze({
    schemaVersion: OTP_PROOF_SCHEMA,
    verified: false,
    principalId: null,
    challengeId,
    invitationId,
    recipientEmailHash,
    proofId: null,
    verifiedAt: null,
    expiresAt: null,
    revoked: null,
    status,
  });
}

export class RecipientBoundOtpAdapter extends OtpPort {
  constructor({ binding, challengeRepository, clock } = {}) {
    super();
    this.otpBinding = assertOtpBinding(binding);
    if (!challengeRepository || typeof challengeRepository.verifyAndConsumeOnce !== 'function') {
      throw new IntegrationDisabledError('lor_otp', 'DURABLE_CHALLENGE_REPOSITORY_REQUIRED');
    }
    if (typeof clock !== 'function') {
      throw new IntegrationDisabledError('lor_otp', 'TRUSTED_CLOCK_REQUIRED');
    }
    this.challengeRepository = challengeRepository;
    this.clock = clock;
    this.durability = 'DURABLE_PROVIDER_BOUND';
    Object.freeze(this);
  }

  async verify(request) {
    assertExactKeys(
      request,
      new Set(['challengeId', 'code', 'recipientEmailHash', 'invitationId']),
      'OTP request',
    );
    assertNonEmptyString(request.challengeId, 'challengeId', { maxLength: 200 });
    assertNonEmptyString(request.code, 'code', { maxLength: 32 });
    assertNonEmptyString(request.invitationId, 'invitationId', { maxLength: 200 });
    assertDigest(request.recipientEmailHash, 'recipientEmailHash');

    let proof;
    try {
      proof = await this.challengeRepository.verifyAndConsumeOnce({
        challengeId: request.challengeId,
        code: request.code,
        invitationId: request.invitationId,
        recipientEmailHash: request.recipientEmailHash,
      });
    } catch {
      throw new IntegrationDisabledError('lor_otp', OTP_PROVIDER_UNAVAILABLE);
    }
    let proofVerified;
    try {
      proofVerified = proof?.verified;
    } catch {
      throw new IntegrationDisabledError('lor_otp', OTP_PROVIDER_UNAVAILABLE);
    }
    if (!proof || proofVerified !== true) {
      return deniedOtpProof({
        challengeId: request.challengeId,
        invitationId: request.invitationId,
        recipientEmailHash: request.recipientEmailHash,
        status: 'DENIED_FAIL_CLOSED',
      });
    }
    let verifiedAt;
    let expiresAt;
    try {
      const expectedProofFields = new Set([
        'consumed',
        'challengeId',
        'expiresAt',
        'invitationId',
        'principalId',
        'proofId',
        'recipientEmailHash',
        'revoked',
        'schemaVersion',
        'verified',
        'verifiedAt',
      ]);
      if (
        !hasExactKeys(proof, expectedProofFields)
        || proof.schemaVersion !== OTP_PROOF_SCHEMA
        || proof.challengeId !== request.challengeId
        || proof.invitationId !== request.invitationId
        || proof.recipientEmailHash !== request.recipientEmailHash
        || proof.consumed !== true
        || proof.revoked !== false
        || typeof proof.principalId !== 'string'
        || proof.principalId.trim() === ''
        || !SHA256_PATTERN.test(proof.proofId ?? '')
      ) {
        throw new Error('invalid proof');
      }
      verifiedAt = parseCanonicalIso(proof.verifiedAt, 'verifiedAt');
      expiresAt = parseCanonicalIso(proof.expiresAt, 'expiresAt');
      const now = Date.parse(toIso(this.clock(), 'clock'));
      if (
        verifiedAt.timestamp > now
        || now >= expiresAt.timestamp
        || verifiedAt.timestamp >= expiresAt.timestamp
      ) {
        throw new Error('invalid proof window');
      }
    } catch {
      throw new IntegrationDisabledError('lor_otp', OTP_PROVIDER_PROOF_INVALID);
    }
    return deepFreeze({
      schemaVersion: OTP_PROOF_SCHEMA,
      verified: true,
      principalId: proof.principalId,
      challengeId: proof.challengeId,
      invitationId: proof.invitationId,
      recipientEmailHash: proof.recipientEmailHash,
      proofId: proof.proofId,
      verifiedAt: verifiedAt.iso,
      expiresAt: expiresAt.iso,
      revoked: false,
      status: 'VERIFIED_ONE_TIME_PROVIDER_PROOF',
    });
  }
}

export class PostmarkFacultyInvitationAdapter extends EmailPort {
  constructor({ binding, transport, clock } = {}) {
    super();
    this.deliveryBinding = assertPostmarkBinding(binding);
    if (!transport || typeof transport.sendBoundInvitation !== 'function') {
      throw new IntegrationDisabledError('postmark', 'INJECTED_TRANSPORT_REQUIRED');
    }
    if (typeof clock !== 'function') {
      throw new IntegrationDisabledError('postmark', 'INJECTED_CLOCK_REQUIRED');
    }
    this.transport = transport;
    this.clock = clock;
    this.provider = 'postmark';
    Object.freeze(this);
  }

  async sendFacultyInvitation(request) {
    assertExactKeys(
      request,
      new Set([
        'expiresAt',
        'invitationId',
        'invitationUrl',
        'recipientEmail',
        'recipientEmailHash',
        'templateAlias',
      ]),
      'Postmark invitation request',
    );
    assertNonEmptyString(request.invitationId, 'invitationId', { maxLength: 200 });
    if (!/^[A-Za-z0-9_-]{1,200}$/u.test(request.invitationId)) {
      throw new ValidationError('Invitation ID is not route-safe');
    }
    assertNonEmptyString(request.invitationUrl, 'invitationUrl', { maxLength: 2_048 });
    assertNonEmptyString(request.templateAlias, 'templateAlias', { maxLength: 100 });
    let invitationUrl;
    try {
      invitationUrl = new URL(request.invitationUrl);
    } catch {
      throw new ValidationError('Invitation URL is invalid');
    }
    if (
      invitationUrl.origin !== this.deliveryBinding.origin
      || invitationUrl.protocol !== 'https:'
      || invitationUrl.username
      || invitationUrl.password
      || invitationUrl.search
      || invitationUrl.hash
      || invitationUrl.pathname !== this.deliveryBinding.invitationRouteTemplate.replace(
        '{invitationId}',
        encodeURIComponent(request.invitationId),
      )
    ) {
      throw new ValidationError('Invitation URL does not match the exact verified invitation route');
    }
    if (request.templateAlias !== this.deliveryBinding.templateAlias) {
      throw new ValidationError('Postmark template alias does not match the verified binding');
    }
    const recipientEmail = normalizeFacultyEmail(request.recipientEmail);
    const recipientEmailHash = hashFacultyEmail(recipientEmail);
    if (recipientEmailHash !== request.recipientEmailHash) {
      throw new ValidationError('Recipient email hash does not match the server-normalized recipient');
    }
    const expiresAt = parseCanonicalIso(request.expiresAt, 'expiresAt');
    const now = new Date(toIso(this.clock(), 'clock')).valueOf();
    if (expiresAt.timestamp <= now) {
      throw new ValidationError('Invitation expiry is not usable');
    }

    let providerResult;
    try {
      providerResult = await this.transport.sendBoundInvitation({
        provider: 'postmark',
        recipientEmail,
        recipientEmailHash,
        invitationId: request.invitationId,
        invitationUrl: invitationUrl.toString(),
        expiresAt: expiresAt.iso,
        templateAlias: this.deliveryBinding.templateAlias,
        protectedLetterContent: null,
      });
    } catch {
      throw new IntegrationDisabledError('postmark', POSTMARK_TRANSPORT_UNAVAILABLE);
    }
    let acceptedAt;
    let providerMessageId;
    try {
      if (
        !providerResult
        || providerResult.accepted !== true
        || providerResult.invitationId !== request.invitationId
        || providerResult.recipientEmailHash !== recipientEmailHash
        || providerResult.invitationPath !== invitationUrl.pathname
        || providerResult.templateAlias !== this.deliveryBinding.templateAlias
        || typeof providerResult.messageId !== 'string'
        || providerResult.messageId.trim() === ''
      ) {
        throw new Error('invalid provider result');
      }
      acceptedAt = parseCanonicalIso(providerResult.acceptedAt, 'acceptedAt').iso;
      providerMessageId = providerResult.messageId;
    } catch {
      throw new IntegrationDisabledError('postmark', POSTMARK_PROVIDER_PROOF_INVALID);
    }
    const providerMessageRef = sha256(`lor-studio:postmark:${providerMessageId}`);
    return deepFreeze({
      schemaVersion: DELIVERY_RECEIPT_SCHEMA,
      provider: 'postmark',
      invitationRef: sha256(`lor-studio:invitation:${request.invitationId}`),
      recipientRef: recipientEmailHash,
      providerMessageRef,
      invitationRouteRef: sha256(`lor-studio:invitation-route:${invitationUrl.pathname}`),
      templateAlias: this.deliveryBinding.templateAlias,
      acceptedAt,
      status: 'accepted_for_delivery',
      recipientAndInvitationBound: true,
    });
  }
}

export const FACULTY_DELIVERY_CONTRACT = deepFreeze({
  otpProofSchema: OTP_PROOF_SCHEMA,
  deliveryReceiptSchema: DELIVERY_RECEIPT_SCHEMA,
  otp: 'durable_one_time_recipient_invitation_expiry_revocation_and_clock_bound',
  otpBindingAxes: ['challengeIdBound', 'challengeExpiryBound', 'challengeRevocationBound'],
  otpProofAxes: ['challengeId', 'verifiedAt', 'expiresAt', 'revoked'],
  boundaryErrors: [
    OTP_PROVIDER_UNAVAILABLE,
    OTP_PROVIDER_PROOF_INVALID,
    POSTMARK_TRANSPORT_UNAVAILABLE,
    POSTMARK_PROVIDER_PROOF_INVALID,
  ],
  email: 'postmark_server_side_delivery_is_not_identity_proof',
});
