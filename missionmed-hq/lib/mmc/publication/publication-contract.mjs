import crypto from 'node:crypto';

import { MMC_STUDENT_RESPONSE_KIND } from '../contracts/command-contract.mjs';
import { isStrictRfc3339 } from '../contracts/timestamp-contract.mjs';
import {
  ENVIRONMENT,
  EVIDENCE_ORIGIN,
  IDENTITY,
  PUBLICATION,
  REVIEW,
  SENSITIVITY,
  VISIBILITY,
} from '../contracts/state-contract.mjs';

const enumOf = (...values) => Object.freeze(Object.fromEntries(values.map((value) => [value, value])));

export const PUBLICATION_ITEM_KIND = enumOf(
  'TASK',
  'MILESTONE',
  'PLAN_UPDATE',
  'SESSION_SUMMARY',
  'FEEDBACK',
  'CORRECTION',
  'WITHDRAWAL_NOTICE',
);
export const STUDENT_RESPONSE_KIND = MMC_STUDENT_RESPONSE_KIND;
export const PUBLICATION_AUTHORITY_OPERATION = enumOf('PREVIEW', 'READBACK', 'STUDENT_RESPOND');

export const PUBLICATION_CONTRACT_LIMITS = Object.freeze({
  ITEM_COUNT_MAX: 100,
  TITLE_MAX_BYTES: 160,
  BODY_MAX_BYTES: 4096,
  SUMMARY_MAX_BYTES: 2048,
  RESPONSE_MAX_BYTES: 2048,
  IDENTIFIER_MAX_BYTES: 128,
});

const ITEM_OWNER = enumOf('STUDENT', 'MENTOR', 'SHARED');
const MILESTONE_STATE = enumOf('PLANNED', 'EVIDENCE_PENDING', 'MET', 'NOT_MET', 'BLOCKED');
const PUBLICATION_ALLOWED_STATES = new Set([
  PUBLICATION.APPROVED,
  PUBLICATION.PUBLISHED,
  PUBLICATION.ACKNOWLEDGED,
  PUBLICATION.CORRECTED,
  PUBLICATION.WITHDRAWN,
  PUBLICATION.SUPERSEDED,
  PUBLICATION.EXPIRED,
]);
const PUBLICATION_READABLE_STATES = new Set([
  PUBLICATION.PUBLISHED,
  PUBLICATION.ACKNOWLEDGED,
  PUBLICATION.CORRECTED,
]);
const PUBLICATION_STATE_PREDECESSORS = Object.freeze({
  [PUBLICATION.APPROVED]: Object.freeze(['DRAFT']),
  [PUBLICATION.PUBLISHED]: Object.freeze([PUBLICATION.APPROVED]),
  [PUBLICATION.ACKNOWLEDGED]: Object.freeze([PUBLICATION.PUBLISHED, PUBLICATION.CORRECTED]),
  [PUBLICATION.CORRECTED]: Object.freeze([PUBLICATION.PUBLISHED, PUBLICATION.ACKNOWLEDGED]),
  [PUBLICATION.WITHDRAWN]: Object.freeze([
    PUBLICATION.APPROVED,
    PUBLICATION.PUBLISHED,
    PUBLICATION.ACKNOWLEDGED,
    PUBLICATION.CORRECTED,
  ]),
  [PUBLICATION.SUPERSEDED]: Object.freeze([
    PUBLICATION.APPROVED,
    PUBLICATION.PUBLISHED,
    PUBLICATION.ACKNOWLEDGED,
    PUBLICATION.CORRECTED,
  ]),
  [PUBLICATION.EXPIRED]: Object.freeze([
    PUBLICATION.PUBLISHED,
    PUBLICATION.ACKNOWLEDGED,
    PUBLICATION.CORRECTED,
  ]),
});
const ALLOWED_SOURCE_ORIGINS = new Set([
  EVIDENCE_ORIGIN.OBSERVED,
  EVIDENCE_ORIGIN.IMPORTED,
  EVIDENCE_ORIGIN.USER_REPORTED,
  EVIDENCE_ORIGIN.DETERMINISTIC,
  EVIDENCE_ORIGIN.HUMAN_JUDGMENT,
]);

const PUBLICATION_KEYS = Object.freeze([
  'publicationId',
  'schemaVersion',
  'version',
  'predecessorPublicationId',
  'predecessorVersion',
  'predecessorProjectionDigest',
  'tenantId',
  'environment',
  'subjectLinkId',
  'assignmentId',
  'studentPrincipalId',
  'identityState',
  'policyVersionId',
  'state',
  'approvedByPrincipalId',
  'approverRole',
  'approvalDecisionId',
  'approvedAt',
  'projectionEffectiveAt',
  'items',
]);
const SOURCE_KEYS = Object.freeze([
  'sourceId',
  'sourceKind',
  'sourceVersion',
  'sourceVersionHash',
  'tenantId',
  'environment',
  'subjectLinkId',
  'assignmentId',
  'reviewState',
  'reviewDecisionId',
  'reviewedByPrincipalId',
  'reviewerRole',
  'reviewedAt',
  'origin',
  'visibility',
  'sensitivity',
  'publicationEligible',
]);
const COMMON_ITEM_KEYS = Object.freeze(['itemId', 'kind', 'source']);
const RESPONSE_COMMON_KEYS = Object.freeze([
  'responseId',
  'schemaVersion',
  'version',
  'tenantId',
  'environment',
  'subjectLinkId',
  'studentPrincipalId',
  'authorPrincipalId',
  'authorship',
  'publicationId',
  'publicationVersion',
  'publicationItemId',
  'kind',
  'createdAt',
  'supersedesResponseId',
]);
const ATTESTATION_KEYS = Object.freeze(['publication', 'identity', 'assignment', 'policy', 'approval', 'sources']);
const ATTESTED_PUBLICATION_KEYS = Object.freeze([
  'publicationId',
  'version',
  'predecessorPublicationId',
  'predecessorVersion',
  'predecessorProjectionDigest',
  'predecessorItemIds',
  'isCurrentSubjectHead',
  'tenantId',
  'environment',
  'subjectLinkId',
  'assignmentId',
  'studentPrincipalId',
  'policyVersionId',
  'state',
  'previousState',
  'approvalDecisionId',
  'approvedByPrincipalId',
  'approverRole',
  'approvedAt',
  'projectionEffectiveAt',
  'projectionDigest',
  'stateChangedAt',
  'publishedAt',
  'expiresAt',
  'withdrawnAt',
]);
const ATTESTED_IDENTITY_KEYS = Object.freeze([
  'tenantId',
  'environment',
  'subjectLinkId',
  'studentPrincipalId',
  'state',
  'revokedAt',
]);
const ATTESTED_ASSIGNMENT_KEYS = Object.freeze([
  'tenantId',
  'environment',
  'assignmentId',
  'subjectLinkId',
  'mentorPrincipalId',
  'state',
  'effectiveAt',
  'expiresAt',
  'revokedAt',
]);
const ATTESTED_POLICY_KEYS = Object.freeze([
  'tenantId',
  'environment',
  'policyVersionId',
  'state',
  'effectiveAt',
  'expiresAt',
]);
const ATTESTED_APPROVAL_KEYS = Object.freeze([
  'tenantId',
  'environment',
  'approvalDecisionId',
  'publicationId',
  'publicationVersion',
  'subjectLinkId',
  'assignmentId',
  'reviewerPrincipalId',
  'reviewerRole',
  'state',
  'publicationEligible',
  'decidedAt',
  'revokedAt',
]);

const ITEM_SPECS = Object.freeze({
  TASK: Object.freeze({
    sourceKinds: Object.freeze(['TASK']),
    fields: Object.freeze([
      field('title', 'text', PUBLICATION_CONTRACT_LIMITS.TITLE_MAX_BYTES),
      field('description', 'text', PUBLICATION_CONTRACT_LIMITS.BODY_MAX_BYTES),
      field('owner', 'enum', ITEM_OWNER),
      field('dueAt', 'timestampOrNull'),
    ]),
  }),
  MILESTONE: Object.freeze({
    sourceKinds: Object.freeze(['MILESTONE']),
    fields: Object.freeze([
      field('title', 'text', PUBLICATION_CONTRACT_LIMITS.TITLE_MAX_BYTES),
      field('criteria', 'text', PUBLICATION_CONTRACT_LIMITS.BODY_MAX_BYTES),
      field('milestoneState', 'enum', MILESTONE_STATE),
      field('targetAt', 'timestampOrNull'),
    ]),
  }),
  PLAN_UPDATE: Object.freeze({
    sourceKinds: Object.freeze(['PLAN_UPDATE', 'GOAL']),
    fields: Object.freeze([
      field('title', 'text', PUBLICATION_CONTRACT_LIMITS.TITLE_MAX_BYTES),
      field('summary', 'text', PUBLICATION_CONTRACT_LIMITS.SUMMARY_MAX_BYTES),
      field('effectiveAt', 'timestamp'),
    ]),
  }),
  SESSION_SUMMARY: Object.freeze({
    sourceKinds: Object.freeze(['SESSION_SUMMARY']),
    fields: Object.freeze([
      field('title', 'text', PUBLICATION_CONTRACT_LIMITS.TITLE_MAX_BYTES),
      field('summary', 'text', PUBLICATION_CONTRACT_LIMITS.BODY_MAX_BYTES),
      field('sessionAt', 'timestamp'),
    ]),
  }),
  FEEDBACK: Object.freeze({
    sourceKinds: Object.freeze(['FEEDBACK']),
    fields: Object.freeze([
      field('title', 'text', PUBLICATION_CONTRACT_LIMITS.TITLE_MAX_BYTES),
      field('body', 'text', PUBLICATION_CONTRACT_LIMITS.BODY_MAX_BYTES),
      field('nextStep', 'text', PUBLICATION_CONTRACT_LIMITS.SUMMARY_MAX_BYTES),
    ]),
  }),
  CORRECTION: Object.freeze({
    sourceKinds: Object.freeze(['CORRECTION']),
    fields: Object.freeze([
      field('title', 'text', PUBLICATION_CONTRACT_LIMITS.TITLE_MAX_BYTES),
      field('correctedText', 'text', PUBLICATION_CONTRACT_LIMITS.BODY_MAX_BYTES),
      field('changeSummary', 'text', PUBLICATION_CONTRACT_LIMITS.SUMMARY_MAX_BYTES),
      field('replacesPublicationItemId', 'identifier'),
    ]),
  }),
  WITHDRAWAL_NOTICE: Object.freeze({
    sourceKinds: Object.freeze(['WITHDRAWAL_DECISION']),
    fields: Object.freeze([field('withdrawnAt', 'timestamp')]),
  }),
});

const RESPONSE_SPECS = Object.freeze({
  ACKNOWLEDGEMENT: Object.freeze([]),
  AGREEMENT: Object.freeze([]),
  CLARIFICATION_REQUEST: Object.freeze([field('message', 'text', PUBLICATION_CONTRACT_LIMITS.RESPONSE_MAX_BYTES)]),
  DISPUTE: Object.freeze([field('message', 'text', PUBLICATION_CONTRACT_LIMITS.RESPONSE_MAX_BYTES)]),
  SELF_REPORTED_COMPLETE: Object.freeze([field('message', 'text', PUBLICATION_CONTRACT_LIMITS.RESPONSE_MAX_BYTES)]),
  BLOCKER_REPORT: Object.freeze([field('message', 'text', PUBLICATION_CONTRACT_LIMITS.RESPONSE_MAX_BYTES)]),
});

const OPAQUE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const FORBIDDEN_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const BIDI_OVERRIDE_PATTERN = /[\u202a-\u202e\u2066-\u2069]/u;
const HTML_PATTERN = /<\/?[A-Za-z][^>]*(?:>|$)/u;
const URI_PATTERN = /\b[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s]/u;
const DOMAIN_PATTERN = /\b(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:\/[^\s]*)?/u;
const FILE_PATH_PATTERN = /(?:^|[\s"'(:=])(?:\/(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+|[A-Za-z]:\\|\.\.[\\/])/u;
const CREDENTIAL_PATTERNS = Object.freeze([
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/iu,
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{12,}\b/u,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,})\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/iu,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\beyJ[A-Za-z0-9_-]{6,}\.eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{8,}\b/u,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|password|authorization)\b\s*[:=]\s*["']?[^\s"']{6,}/iu,
]);
const textEncoder = new TextEncoder();
const verifierStates = new WeakMap();
const authorityStates = new WeakMap();

export class MmcPublicationContractError extends TypeError {
  constructor(code, field) {
    super(`${code}: invalid ${field}`);
    this.name = 'MmcPublicationContractError';
    this.code = code;
    this.field = field;
  }
}

// The verifier is a server bootstrap boundary. Only its loader can supply the
// persisted identity, assignment, policy, review, approval, and state snapshot.
// The returned grant has no reflectable authority data; its binding is held in
// module-private WeakMaps and is intentionally short-lived and single-use.
export function createPublicationAuthorityVerifier(options = {}) {
  if (typeof options.loadAttestation !== 'function') {
    fail('MMC_PUBLICATION_AUTHORITY_LOADER_REQUIRED', 'publication authority loader');
  }
  if (options.clock !== undefined && typeof options.clock !== 'function') {
    fail('MMC_PUBLICATION_AUTHORITY_CLOCK_INVALID', 'publication authority clock');
  }
  const verifier = {
    authorize(publication, context = {}) {
      return authorizePublication(verifier, publication, context);
    },
  };
  verifierStates.set(verifier, Object.freeze({
    loadAttestation: options.loadAttestation,
    clock: options.clock || (() => new Date()),
    maxGrantAgeMs: normalizeGrantAge(options.maxGrantAgeMs),
  }));
  return Object.freeze(verifier);
}

export function buildPublication(input) {
  return deepFreeze(canonicalizePublication(input, false));
}

export function validatePublication(publication) {
  canonicalizePublication(publication, true);
  return true;
}

export function computePublicationProjectionDigest(publication) {
  validatePublication(publication);
  const payload = buildStudentPayload(publication);
  assertNoCredentialMaterial(payload, 'publication projection');
  return crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

export function serializePublicationPreview(publication, authority) {
  consumePublicationAuthority(publication, authority, PUBLICATION_AUTHORITY_OPERATION.PREVIEW);
  if (publication.state !== PUBLICATION.APPROVED) {
    fail('MMC_PUBLICATION_PREVIEW_DENIED', 'publication state');
  }
  return JSON.stringify(buildStudentPayload(publication));
}

export function serializePublicationReadback(publication, authority) {
  consumePublicationAuthority(publication, authority, PUBLICATION_AUTHORITY_OPERATION.READBACK);
  assertReadablePublication(publication);
  return JSON.stringify(buildStudentPayload(publication));
}

export function assertPublicationBytesEquivalent(preview, readback) {
  if (typeof preview !== 'string' || typeof readback !== 'string') {
    fail('MMC_PUBLICATION_INVALID_SERIALIZATION', 'publication serialization');
  }
  const previewBytes = textEncoder.encode(preview);
  const readbackBytes = textEncoder.encode(readback);
  if (previewBytes.byteLength !== readbackBytes.byteLength) {
    fail('MMC_PUBLICATION_BYTE_MISMATCH', 'publication serialization');
  }
  for (let index = 0; index < previewBytes.byteLength; index += 1) {
    if (previewBytes[index] !== readbackBytes[index]) {
      fail('MMC_PUBLICATION_BYTE_MISMATCH', 'publication serialization');
    }
  }
  return true;
}

export function buildStudentResponse(input, publication, authority) {
  const authorityState = consumePublicationAuthority(
    publication, authority, PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  );
  assertReadablePublication(publication);
  return deepFreeze(canonicalizeStudentResponse(input, publication, false, authorityState));
}

export function validateStudentResponse(response, publication, authority) {
  const authorityState = consumePublicationAuthority(
    publication, authority, PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  );
  assertReadablePublication(publication);
  canonicalizeStudentResponse(response, publication, true, authorityState);
  return true;
}

async function authorizePublication(verifier, publication, context) {
  const verifierState = verifierStates.get(verifier);
  if (!verifierState) fail('MMC_PUBLICATION_AUTHORITY_VERIFIER_INVALID', 'publication authority verifier');
  validatePublication(publication);
  const operation = context?.operation;
  if (!Object.hasOwn(PUBLICATION_AUTHORITY_OPERATION, operation)) {
    fail('MMC_PUBLICATION_AUTHORITY_OPERATION_INVALID', 'publication authority operation');
  }
  const principal = canonicalizeAuthorityPrincipal(context?.principal, publication, operation);
  const lookup = deepFreeze({
    tenantId: publication.tenantId,
    environment: publication.environment,
    publicationId: publication.publicationId,
    version: publication.version,
  });
  const attestation = await verifierState.loadAttestation(lookup);
  const nowMs = readAuthorityClock(verifierState.clock);
  const projectionDigest = computePublicationProjectionDigest(publication);
  validatePersistedAuthority(attestation, publication, projectionDigest, operation, principal, nowMs);

  const authority = Object.freeze(Object.create(null));
  authorityStates.set(authority, {
    operation,
    principalId: principal.id,
    tenantId: publication.tenantId,
    environment: publication.environment,
    publicationId: publication.publicationId,
    publicationVersion: publication.version,
    projectionDigest,
    authorizedAt: new Date(nowMs).toISOString(),
    clock: verifierState.clock,
    expiresAtMs: nowMs + verifierState.maxGrantAgeMs,
    consumed: false,
  });
  return authority;
}

function consumePublicationAuthority(publication, authority, expectedOperation) {
  validatePublication(publication);
  const state = authorityStates.get(authority);
  if (!state || state.operation !== expectedOperation) {
    fail('MMC_PUBLICATION_AUTHORITY_REQUIRED', 'publication authority');
  }
  if (state.consumed) fail('MMC_PUBLICATION_AUTHORITY_REPLAYED', 'publication authority');
  if (readAuthorityClock(state.clock) > state.expiresAtMs) {
    fail('MMC_PUBLICATION_AUTHORITY_EXPIRED', 'publication authority');
  }
  const projectionDigest = computePublicationProjectionDigest(publication);
  if (
    state.tenantId !== publication.tenantId
    || state.environment !== publication.environment
    || state.publicationId !== publication.publicationId
    || state.publicationVersion !== publication.version
    || state.projectionDigest !== projectionDigest
  ) {
    fail('MMC_PUBLICATION_AUTHORITY_BINDING_MISMATCH', 'publication authority');
  }
  state.consumed = true;
  return state;
}

function canonicalizeAuthorityPrincipal(input, publication, operation) {
  assertPlainRecord(input, 'publication authority principal');
  const allowedKeys = [
    'id', 'tenantId', 'environment', 'role', 'subjectId', 'assignmentId',
    'workloadId', 'queueName', 'capabilities',
  ];
  assertExactKeys(input, allowedKeys, 'publication authority principal');
  assertRequiredKeys(input, ['id', 'tenantId', 'environment', 'role', 'capabilities'], 'publication authority principal');
  assertOpaqueIdentifier(input.id, 'publication authority principal identifier');
  assertBinding(input.tenantId, publication.tenantId, 'publication authority principal tenant');
  assertBinding(input.environment, publication.environment, 'publication authority principal environment');
  if (!Array.isArray(input.capabilities) || input.capabilities.some((entry) => typeof entry !== 'string')) {
    fail('MMC_PUBLICATION_AUTHORITY_PRINCIPAL_INVALID', 'publication authority principal capabilities');
  }
  if (input.workloadId !== null || input.queueName !== null) {
    fail('MMC_PUBLICATION_AUTHORITY_PRINCIPAL_MISMATCH', 'publication authority workload binding');
  }

  const preview = operation === PUBLICATION_AUTHORITY_OPERATION.PREVIEW;
  const expectedRole = preview ? 'mentor' : 'student';
  const expectedPrincipalId = preview ? publication.approvedByPrincipalId : publication.studentPrincipalId;
  const expectedCapability = preview
    ? 'mmc:publication:approve'
    : operation === PUBLICATION_AUTHORITY_OPERATION.READBACK
      ? 'mmc:publication:read'
      : 'mmc:student:respond';
  if (String(input.role).toLowerCase() !== expectedRole || input.id !== expectedPrincipalId) {
    fail('MMC_PUBLICATION_AUTHORITY_PRINCIPAL_MISMATCH', 'publication authority principal');
  }
  if (!input.capabilities.includes(expectedCapability)) {
    fail('MMC_PUBLICATION_AUTHORITY_CAPABILITY_REQUIRED', 'publication authority principal capability');
  }
  if (input.subjectId !== undefined && input.subjectId !== null) {
    assertBinding(input.subjectId, publication.subjectLinkId, 'publication authority principal subject');
  }
  if (input.assignmentId !== undefined && input.assignmentId !== null) {
    assertBinding(input.assignmentId, publication.assignmentId, 'publication authority principal assignment');
  }
  return Object.freeze({ id: input.id, role: expectedRole });
}

function validatePersistedAuthority(attestation, publication, projectionDigest, operation, principal, nowMs) {
  if (attestation === null || attestation === undefined) {
    fail('MMC_PUBLICATION_AUTHORITY_UNAVAILABLE', 'persisted publication authority');
  }
  assertExactRequiredRecord(attestation, ATTESTATION_KEYS, 'persisted publication authority');
  assertExactRequiredRecord(attestation.publication, ATTESTED_PUBLICATION_KEYS, 'persisted publication');
  assertExactRequiredRecord(attestation.identity, ATTESTED_IDENTITY_KEYS, 'persisted identity');
  assertExactRequiredRecord(attestation.assignment, ATTESTED_ASSIGNMENT_KEYS, 'persisted assignment');
  assertExactRequiredRecord(attestation.policy, ATTESTED_POLICY_KEYS, 'persisted policy');
  assertExactRequiredRecord(attestation.approval, ATTESTED_APPROVAL_KEYS, 'persisted approval');
  if (!Array.isArray(attestation.sources)) {
    fail('MMC_PUBLICATION_AUTHORITY_INVALID', 'persisted sources');
  }

  const persisted = attestation.publication;
  const exactPublicationBindings = [
    'publicationId',
    'version',
    'predecessorPublicationId',
    'predecessorVersion',
    'predecessorProjectionDigest',
    'tenantId',
    'environment',
    'subjectLinkId',
    'assignmentId',
    'studentPrincipalId',
    'policyVersionId',
    'state',
    'approvalDecisionId',
    'approvedByPrincipalId',
    'approverRole',
    'approvedAt',
    'projectionEffectiveAt',
  ];
  for (const key of exactPublicationBindings) {
    assertPersistedBinding(persisted[key], publication[key], `persisted publication ${key}`);
  }
  if (persisted.projectionDigest !== projectionDigest || !SHA256_PATTERN.test(String(persisted.projectionDigest || ''))) {
    fail('MMC_PUBLICATION_PROJECTION_DIGEST_MISMATCH', 'persisted publication projection digest');
  }
  if (persisted.isCurrentSubjectHead !== true) {
    fail('MMC_PUBLICATION_NOT_CURRENT_HEAD', 'persisted publication lineage head');
  }
  if (!Array.isArray(persisted.predecessorItemIds)
    || new Set(persisted.predecessorItemIds).size !== persisted.predecessorItemIds.length) {
    fail('MMC_PUBLICATION_PREDECESSOR_INVALID', 'persisted publication predecessor items');
  }
  for (const itemId of persisted.predecessorItemIds) {
    assertOpaqueIdentifier(itemId, 'persisted predecessor item identifier');
  }
  if (publication.state === PUBLICATION.CORRECTED) {
    const corrections = publication.items.filter((item) => item.kind === 'CORRECTION');
    if (!corrections.length || corrections.some((item) => (
      !persisted.predecessorItemIds.includes(item.replacesPublicationItemId)
    ))) {
      fail('MMC_PUBLICATION_CORRECTION_LINEAGE_INVALID', 'persisted publication correction lineage');
    }
  }
  assertRfc3339(persisted.stateChangedAt, 'persisted publication state change');
  assertNullableRfc3339(persisted.publishedAt, 'persisted publication publish time');
  assertNullableRfc3339(persisted.expiresAt, 'persisted publication expiry');
  assertNullableRfc3339(persisted.withdrawnAt, 'persisted publication withdrawal');
  if (!PUBLICATION_STATE_PREDECESSORS[persisted.state]?.includes(persisted.previousState)) {
    fail('MMC_PUBLICATION_STATE_TRANSITION_INVALID', 'persisted publication transition');
  }
  if (Date.parse(persisted.approvedAt) > nowMs || Date.parse(persisted.stateChangedAt) > nowMs) {
    fail('MMC_PUBLICATION_FUTURE_STATE_DENIED', 'persisted publication timing');
  }
  if (Date.parse(persisted.approvedAt) > Date.parse(persisted.stateChangedAt)) {
    fail('MMC_PUBLICATION_INVALID_TIME_ORDER', 'persisted publication state timing');
  }

  const preview = operation === PUBLICATION_AUTHORITY_OPERATION.PREVIEW;
  if (preview) {
    if (persisted.state !== PUBLICATION.APPROVED || persisted.publishedAt !== null || persisted.withdrawnAt !== null) {
      fail('MMC_PUBLICATION_PREVIEW_DENIED', 'persisted publication state');
    }
  } else {
    if (!PUBLICATION_READABLE_STATES.has(persisted.state)) {
      fail('MMC_PUBLICATION_READ_DENIED', 'persisted publication state');
    }
    if (persisted.publishedAt === null || Date.parse(persisted.publishedAt) > nowMs) {
      fail('MMC_PUBLICATION_FUTURE_STATE_DENIED', 'persisted publication publish time');
    }
    if (Date.parse(persisted.publishedAt) > Date.parse(persisted.stateChangedAt)) {
      fail('MMC_PUBLICATION_INVALID_TIME_ORDER', 'persisted publication publish time');
    }
    if (Date.parse(persisted.projectionEffectiveAt) > nowMs) {
      fail('MMC_PUBLICATION_FUTURE_STATE_DENIED', 'persisted publication projection time');
    }
    if (persisted.expiresAt !== null && Date.parse(persisted.expiresAt) <= nowMs) {
      fail('MMC_PUBLICATION_EXPIRED', 'persisted publication expiry');
    }
    if (persisted.withdrawnAt !== null && Date.parse(persisted.withdrawnAt) <= nowMs) {
      fail('MMC_PUBLICATION_WITHDRAWN', 'persisted publication withdrawal');
    }
  }

  validatePersistedIdentity(attestation.identity, publication, nowMs);
  validatePersistedAssignment(attestation.assignment, publication, nowMs, operation);
  validatePersistedPolicy(attestation.policy, publication, nowMs, operation);
  validatePersistedApproval(attestation.approval, publication, attestation.assignment, nowMs);
  validatePersistedSources(attestation.sources, publication, attestation.assignment, nowMs);

  if (operation === PUBLICATION_AUTHORITY_OPERATION.PREVIEW) {
    assertPersistedBinding(principal.id, attestation.assignment.mentorPrincipalId, 'persisted publication mentor principal');
  } else {
    assertPersistedBinding(principal.id, attestation.identity.studentPrincipalId, 'persisted publication student principal');
  }
}

function validatePersistedIdentity(identity, publication, nowMs) {
  assertPersistedBinding(identity.tenantId, publication.tenantId, 'persisted identity tenant');
  assertPersistedBinding(identity.environment, publication.environment, 'persisted identity environment');
  assertPersistedBinding(identity.subjectLinkId, publication.subjectLinkId, 'persisted identity subject');
  assertPersistedBinding(identity.studentPrincipalId, publication.studentPrincipalId, 'persisted identity student');
  if (identity.state !== IDENTITY.VERIFIED_LOCAL_LINK) {
    fail('MMC_PUBLICATION_IDENTITY_UNRESOLVED', 'persisted identity state');
  }
  assertNullableRfc3339(identity.revokedAt, 'persisted identity revocation');
  if (identity.revokedAt !== null && Date.parse(identity.revokedAt) <= nowMs) {
    fail('MMC_PUBLICATION_IDENTITY_REVOKED', 'persisted identity revocation');
  }
}

function validatePersistedAssignment(assignment, publication, nowMs, operation) {
  assertPersistedBinding(assignment.tenantId, publication.tenantId, 'persisted assignment tenant');
  assertPersistedBinding(assignment.environment, publication.environment, 'persisted assignment environment');
  assertPersistedBinding(assignment.assignmentId, publication.assignmentId, 'persisted assignment identifier');
  assertPersistedBinding(assignment.subjectLinkId, publication.subjectLinkId, 'persisted assignment subject');
  assertPersistedBinding(assignment.mentorPrincipalId, publication.approvedByPrincipalId, 'persisted assignment mentor');
  if (operation === PUBLICATION_AUTHORITY_OPERATION.PREVIEW) {
    assertActiveWindow(assignment, publication.approvedAt, nowMs, 'persisted assignment');
  } else {
    assertAssignmentWasActiveAtApproval(assignment, publication.approvedAt, nowMs);
  }
}

function assertAssignmentWasActiveAtApproval(assignment, approvedAt, nowMs) {
  if (!['ACTIVE', 'EXPIRED', 'REVOKED', 'REASSIGNED'].includes(assignment.state)) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', 'persisted assignment state');
  }
  assertRfc3339(assignment.effectiveAt, 'persisted assignment effective time');
  assertNullableRfc3339(assignment.expiresAt, 'persisted assignment expiry');
  assertNullableRfc3339(assignment.revokedAt, 'persisted assignment revocation');
  const approvedMs = Date.parse(approvedAt);
  if (Date.parse(assignment.effectiveAt) > approvedMs) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', 'persisted assignment effective time');
  }
  if (assignment.expiresAt !== null && Date.parse(assignment.expiresAt) <= approvedMs) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', 'persisted assignment expiry');
  }
  if (assignment.revokedAt !== null && Date.parse(assignment.revokedAt) <= approvedMs) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', 'persisted assignment revocation');
  }
  if (assignment.state === 'EXPIRED'
    && (assignment.expiresAt === null || Date.parse(assignment.expiresAt) > nowMs)) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', 'persisted assignment expiry state');
  }
  if (['REVOKED', 'REASSIGNED'].includes(assignment.state)
    && (assignment.revokedAt === null || Date.parse(assignment.revokedAt) > nowMs)) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', 'persisted assignment end state');
  }
}

function validatePersistedPolicy(policy, publication, nowMs, operation) {
  assertPersistedBinding(policy.tenantId, publication.tenantId, 'persisted policy tenant');
  assertPersistedBinding(policy.environment, publication.environment, 'persisted policy environment');
  assertPersistedBinding(policy.policyVersionId, publication.policyVersionId, 'persisted policy version');
  if (operation === PUBLICATION_AUTHORITY_OPERATION.PREVIEW) {
    assertActiveWindow(policy, publication.approvedAt, nowMs, 'persisted policy');
    return;
  }
  if (!['ACTIVE', 'RETIRED'].includes(policy.state)) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', 'persisted policy state');
  }
  assertRfc3339(policy.effectiveAt, 'persisted policy effective time');
  assertNullableRfc3339(policy.expiresAt, 'persisted policy expiry');
  const approvedMs = Date.parse(publication.approvedAt);
  if (Date.parse(policy.effectiveAt) > approvedMs
    || (policy.expiresAt !== null && Date.parse(policy.expiresAt) <= approvedMs)) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', 'persisted policy approval window');
  }
  if (policy.state === 'RETIRED'
    && (policy.expiresAt === null || Date.parse(policy.expiresAt) > nowMs)) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', 'persisted policy retirement state');
  }
}

function validatePersistedApproval(approval, publication, assignment, nowMs) {
  assertPersistedBinding(approval.tenantId, publication.tenantId, 'persisted approval tenant');
  assertPersistedBinding(approval.environment, publication.environment, 'persisted approval environment');
  assertPersistedBinding(approval.approvalDecisionId, publication.approvalDecisionId, 'persisted approval decision');
  assertPersistedBinding(approval.publicationId, publication.publicationId, 'persisted approval publication');
  assertPersistedBinding(approval.publicationVersion, publication.version, 'persisted approval version');
  assertPersistedBinding(approval.subjectLinkId, publication.subjectLinkId, 'persisted approval subject');
  assertPersistedBinding(approval.assignmentId, publication.assignmentId, 'persisted approval assignment');
  assertPersistedBinding(approval.reviewerPrincipalId, publication.approvedByPrincipalId, 'persisted approval reviewer');
  assertPersistedBinding(approval.reviewerPrincipalId, assignment.mentorPrincipalId, 'persisted approval assignment mentor');
  if (
    approval.reviewerRole !== 'MENTOR'
    || approval.state !== REVIEW.APPROVED
    || approval.publicationEligible !== true
  ) {
    fail('MMC_PUBLICATION_APPROVAL_INVALID', 'persisted approval');
  }
  assertPersistedBinding(approval.decidedAt, publication.approvedAt, 'persisted approval decision time');
  assertRfc3339(approval.decidedAt, 'persisted approval decision time');
  assertNullableRfc3339(approval.revokedAt, 'persisted approval revocation');
  if (Date.parse(approval.decidedAt) > nowMs) {
    fail('MMC_PUBLICATION_FUTURE_STATE_DENIED', 'persisted approval decision time');
  }
  if (approval.revokedAt !== null && Date.parse(approval.revokedAt) <= nowMs) {
    fail('MMC_PUBLICATION_APPROVAL_REVOKED', 'persisted approval revocation');
  }
}

function validatePersistedSources(sources, publication, assignment, nowMs) {
  const expected = new Map();
  for (const item of publication.items) {
    expected.set(`${item.source.sourceId}\u001f${item.source.sourceVersion}`, item.source);
  }
  const persisted = new Map();
  for (const source of sources) {
    assertExactRequiredRecord(source, SOURCE_KEYS, 'persisted publication source');
    const key = `${source.sourceId}\u001f${source.sourceVersion}`;
    if (persisted.has(key)) fail('MMC_PUBLICATION_AUTHORITY_INVALID', 'duplicate persisted source');
    persisted.set(key, source);
  }
  if (persisted.size !== expected.size) {
    fail('MMC_PUBLICATION_SOURCE_ATTESTATION_MISMATCH', 'persisted publication sources');
  }
  for (const [key, expectedSource] of expected) {
    const persistedSource = persisted.get(key);
    if (!persistedSource) fail('MMC_PUBLICATION_SOURCE_ATTESTATION_MISMATCH', 'persisted publication source');
    for (const fieldName of SOURCE_KEYS) {
      assertPersistedBinding(persistedSource[fieldName], expectedSource[fieldName], `persisted publication source ${fieldName}`);
    }
    assertPersistedBinding(persistedSource.reviewedByPrincipalId, assignment.mentorPrincipalId, 'persisted publication source reviewer');
    if (Date.parse(persistedSource.reviewedAt) > nowMs) {
      fail('MMC_PUBLICATION_FUTURE_STATE_DENIED', 'persisted publication source review time');
    }
  }
}

function assertActiveWindow(record, decisionAt, nowMs, fieldName) {
  if (record.state !== 'ACTIVE') fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', `${fieldName} state`);
  assertRfc3339(record.effectiveAt, `${fieldName} effective time`);
  assertNullableRfc3339(record.expiresAt, `${fieldName} expiry`);
  if (Object.hasOwn(record, 'revokedAt')) assertNullableRfc3339(record.revokedAt, `${fieldName} revocation`);
  const decisionMs = Date.parse(decisionAt);
  if (Date.parse(record.effectiveAt) > decisionMs || Date.parse(record.effectiveAt) > nowMs) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', `${fieldName} effective time`);
  }
  if (record.expiresAt !== null && (Date.parse(record.expiresAt) <= decisionMs || Date.parse(record.expiresAt) <= nowMs)) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', `${fieldName} expiry`);
  }
  if (record.revokedAt !== undefined && record.revokedAt !== null
    && (Date.parse(record.revokedAt) <= decisionMs || Date.parse(record.revokedAt) <= nowMs)) {
    fail('MMC_PUBLICATION_AUTHORITY_INACTIVE', `${fieldName} revocation`);
  }
}

function assertExactRequiredRecord(value, keys, fieldName) {
  assertPlainRecord(value, fieldName);
  assertExactKeys(value, keys, fieldName);
  assertRequiredKeys(value, keys, fieldName);
}

function assertPersistedBinding(actual, expected, fieldName) {
  if (actual !== expected) fail('MMC_PUBLICATION_PERSISTED_BINDING_MISMATCH', fieldName);
}

function assertNullableRfc3339(value, fieldName) {
  if (value !== null) assertRfc3339(value, fieldName);
}

function readAuthorityClock(clock) {
  let value;
  try {
    value = clock();
  } catch (error) {
    throw new MmcPublicationContractError('MMC_PUBLICATION_AUTHORITY_CLOCK_INVALID', 'publication authority clock', { cause: error });
  }
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail('MMC_PUBLICATION_AUTHORITY_CLOCK_INVALID', 'publication authority clock');
  return milliseconds;
}

function normalizeGrantAge(value) {
  if (value === undefined) return 5_000;
  if (!Number.isInteger(value) || value < 1 || value > 30_000) {
    fail('MMC_PUBLICATION_AUTHORITY_GRANT_AGE_INVALID', 'publication authority grant age');
  }
  return value;
}

function canonicalizePublication(input, requireCanonicalText) {
  assertPlainRecord(input, 'publication');
  assertExactKeys(input, PUBLICATION_KEYS, 'publication');
  assertRequiredKeys(input, PUBLICATION_KEYS, 'publication');

  assertOpaqueIdentifier(input.publicationId, 'publication identifier');
  assertPositiveInteger(input.schemaVersion, 'publication schema version');
  if (input.schemaVersion !== 1) fail('MMC_PUBLICATION_SCHEMA_UNSUPPORTED', 'publication schema version');
  assertPositiveInteger(input.version, 'publication version');
  if (input.version === 1) {
    if (input.predecessorPublicationId !== null
      || input.predecessorVersion !== null
      || input.predecessorProjectionDigest !== null) {
      fail('MMC_PUBLICATION_PREDECESSOR_INVALID', 'publication predecessor');
    }
  } else {
    assertOpaqueIdentifier(input.predecessorPublicationId, 'publication predecessor identifier');
    if (input.predecessorPublicationId === input.publicationId) {
      fail('MMC_PUBLICATION_PREDECESSOR_INVALID', 'publication predecessor identifier');
    }
    if (input.predecessorVersion !== input.version - 1) {
      fail('MMC_PUBLICATION_PREDECESSOR_INVALID', 'publication predecessor version');
    }
    if (typeof input.predecessorProjectionDigest !== 'string'
      || !SHA256_PATTERN.test(input.predecessorProjectionDigest)) {
      fail('MMC_PUBLICATION_PREDECESSOR_INVALID', 'publication predecessor digest');
    }
  }
  assertOpaqueIdentifier(input.tenantId, 'publication tenant');
  assertEnumValue(ENVIRONMENT, input.environment, 'publication environment');
  assertOpaqueIdentifier(input.subjectLinkId, 'publication subject');
  assertOpaqueIdentifier(input.assignmentId, 'publication assignment');
  assertOpaqueIdentifier(input.studentPrincipalId, 'publication student principal');
  if (input.identityState !== IDENTITY.VERIFIED_LOCAL_LINK) {
    fail('MMC_PUBLICATION_IDENTITY_UNRESOLVED', 'publication identity');
  }
  assertOpaqueIdentifier(input.policyVersionId, 'publication policy version');
  if (!PUBLICATION_ALLOWED_STATES.has(input.state)) fail('MMC_PUBLICATION_INVALID_STATE', 'publication state');
  if (input.state === PUBLICATION.CORRECTED && input.version === 1) {
    fail('MMC_PUBLICATION_PREDECESSOR_INVALID', 'corrected publication predecessor');
  }
  assertOpaqueIdentifier(input.approvedByPrincipalId, 'publication approver');
  if (input.approverRole !== 'MENTOR') fail('MMC_PUBLICATION_APPROVER_REQUIRED', 'publication approver role');
  assertOpaqueIdentifier(input.approvalDecisionId, 'publication approval decision');
  assertRfc3339(input.approvedAt, 'publication approval time');
  assertRfc3339(input.projectionEffectiveAt, 'publication projection time');
  if (Date.parse(input.approvedAt) > Date.parse(input.projectionEffectiveAt)) {
    fail('MMC_PUBLICATION_INVALID_TIME_ORDER', 'publication timing');
  }

  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > PUBLICATION_CONTRACT_LIMITS.ITEM_COUNT_MAX) {
    fail('MMC_PUBLICATION_INVALID_ITEMS', 'publication items');
  }
  const publicationBinding = {
    tenantId: input.tenantId,
    environment: input.environment,
    subjectLinkId: input.subjectLinkId,
    assignmentId: input.assignmentId,
    approvedAt: input.approvedAt,
  };
  const items = input.items.map((item) => canonicalizeItem(item, publicationBinding, requireCanonicalText));
  if (new Set(items.map((item) => item.itemId)).size !== items.length) {
    fail('MMC_PUBLICATION_DUPLICATE_ITEM', 'publication items');
  }
  const sourceIdentities = items.map((item) => (
    `${item.source.sourceId}\u001f${item.source.sourceVersion}`
  ));
  if (new Set(sourceIdentities).size !== sourceIdentities.length) {
    fail('MMC_PUBLICATION_DUPLICATE_SOURCE', 'publication item sources');
  }
  const corrections = items.filter((item) => item.kind === 'CORRECTION');
  if ((input.state === PUBLICATION.CORRECTED) !== (corrections.length > 0)) {
    fail('MMC_PUBLICATION_CORRECTION_LINEAGE_INVALID', 'publication correction items');
  }

  return {
    publicationId: input.publicationId,
    schemaVersion: input.schemaVersion,
    version: input.version,
    predecessorPublicationId: input.predecessorPublicationId,
    predecessorVersion: input.predecessorVersion,
    predecessorProjectionDigest: input.predecessorProjectionDigest,
    tenantId: input.tenantId,
    environment: input.environment,
    subjectLinkId: input.subjectLinkId,
    assignmentId: input.assignmentId,
    studentPrincipalId: input.studentPrincipalId,
    identityState: input.identityState,
    policyVersionId: input.policyVersionId,
    state: input.state,
    approvedByPrincipalId: input.approvedByPrincipalId,
    approverRole: input.approverRole,
    approvalDecisionId: input.approvalDecisionId,
    approvedAt: input.approvedAt,
    projectionEffectiveAt: input.projectionEffectiveAt,
    items,
  };
}

function canonicalizeItem(input, publication, requireCanonicalText) {
  assertPlainRecord(input, 'publication item');
  if (!Object.hasOwn(PUBLICATION_ITEM_KIND, input.kind)) {
    fail('MMC_PUBLICATION_ITEM_KIND_UNKNOWN', 'publication item kind');
  }
  const spec = ITEM_SPECS[input.kind];
  const fieldNames = spec.fields.map((descriptor) => descriptor.name);
  const exactKeys = [...COMMON_ITEM_KEYS, ...fieldNames];
  assertExactKeys(input, exactKeys, 'publication item');
  assertRequiredKeys(input, exactKeys, 'publication item');
  assertOpaqueIdentifier(input.itemId, 'publication item identifier');

  const source = canonicalizeSource(input.source, publication, spec);
  const item = { itemId: input.itemId, kind: input.kind, source };
  for (const descriptor of spec.fields) {
    item[descriptor.name] = canonicalizeField(input[descriptor.name], descriptor, requireCanonicalText);
  }
  return item;
}

function canonicalizeSource(input, publication, itemSpec) {
  assertPlainRecord(input, 'publication source');
  assertExactKeys(input, SOURCE_KEYS, 'publication source');
  assertRequiredKeys(input, SOURCE_KEYS, 'publication source');
  assertOpaqueIdentifier(input.sourceId, 'publication source identifier');
  if (!itemSpec.sourceKinds.includes(input.sourceKind)) {
    fail('MMC_PUBLICATION_SOURCE_KIND_INELIGIBLE', 'publication source kind');
  }
  assertPositiveInteger(input.sourceVersion, 'publication source version');
  if (typeof input.sourceVersionHash !== 'string' || !SHA256_PATTERN.test(input.sourceVersionHash)) {
    fail('MMC_PUBLICATION_SOURCE_VERSION_INVALID', 'publication source version hash');
  }
  assertBinding(input.tenantId, publication.tenantId, 'publication source tenant');
  assertBinding(input.environment, publication.environment, 'publication source environment');
  assertBinding(input.subjectLinkId, publication.subjectLinkId, 'publication source subject');
  assertBinding(input.assignmentId, publication.assignmentId, 'publication source assignment');
  if (input.reviewState !== REVIEW.APPROVED || input.reviewerRole !== 'MENTOR') {
    fail('MMC_PUBLICATION_SOURCE_UNREVIEWED', 'publication source review');
  }
  assertOpaqueIdentifier(input.reviewDecisionId, 'publication source review decision');
  assertOpaqueIdentifier(input.reviewedByPrincipalId, 'publication source reviewer');
  assertRfc3339(input.reviewedAt, 'publication source review time');
  if (Date.parse(input.reviewedAt) > Date.parse(publication.approvedAt)) {
    fail('MMC_PUBLICATION_INVALID_TIME_ORDER', 'publication source review time');
  }
  if (!ALLOWED_SOURCE_ORIGINS.has(input.origin)) {
    fail('MMC_PUBLICATION_SOURCE_ORIGIN_INELIGIBLE', 'publication source origin');
  }
  if (input.visibility !== VISIBILITY.PUBLICATION_CANDIDATE) {
    fail('MMC_PUBLICATION_SOURCE_PRIVATE', 'publication source visibility');
  }
  if (input.sensitivity !== SENSITIVITY.NORMAL) {
    fail('MMC_PUBLICATION_SOURCE_SENSITIVE', 'publication source sensitivity');
  }
  if (input.publicationEligible !== true) {
    fail('MMC_PUBLICATION_SOURCE_INELIGIBLE', 'publication source eligibility');
  }

  return {
    sourceId: input.sourceId,
    sourceKind: input.sourceKind,
    sourceVersion: input.sourceVersion,
    sourceVersionHash: input.sourceVersionHash,
    tenantId: input.tenantId,
    environment: input.environment,
    subjectLinkId: input.subjectLinkId,
    assignmentId: input.assignmentId,
    reviewState: input.reviewState,
    reviewDecisionId: input.reviewDecisionId,
    reviewedByPrincipalId: input.reviewedByPrincipalId,
    reviewerRole: input.reviewerRole,
    reviewedAt: input.reviewedAt,
    origin: input.origin,
    visibility: input.visibility,
    sensitivity: input.sensitivity,
    publicationEligible: input.publicationEligible,
  };
}

function canonicalizeStudentResponse(input, publication, requireCanonicalText, authorityState) {
  assertPlainRecord(input, 'student response');
  if (!Object.hasOwn(STUDENT_RESPONSE_KIND, input.kind)) {
    fail('MMC_STUDENT_RESPONSE_KIND_UNKNOWN', 'student response kind');
  }
  const fields = RESPONSE_SPECS[input.kind];
  const exactKeys = [...RESPONSE_COMMON_KEYS, ...fields.map((descriptor) => descriptor.name)];
  assertExactKeys(input, exactKeys, 'student response');
  assertRequiredKeys(input, exactKeys, 'student response');

  assertOpaqueIdentifier(input.responseId, 'student response identifier');
  assertPositiveInteger(input.schemaVersion, 'student response schema version');
  if (input.schemaVersion !== 1) fail('MMC_STUDENT_RESPONSE_SCHEMA_UNSUPPORTED', 'student response schema version');
  assertPositiveInteger(input.version, 'student response version');
  if (input.version !== 1 || input.supersedesResponseId !== null) {
    fail('MMC_STUDENT_RESPONSE_DURABLE_STREAM_REQUIRED', 'student response version lineage');
  }
  assertBinding(input.tenantId, publication.tenantId, 'student response tenant');
  assertBinding(input.environment, publication.environment, 'student response environment');
  assertBinding(input.subjectLinkId, publication.subjectLinkId, 'student response subject');
  assertBinding(input.studentPrincipalId, publication.studentPrincipalId, 'student response principal');
  assertBinding(input.authorPrincipalId, publication.studentPrincipalId, 'student response author');
  if (input.authorship !== 'STUDENT') fail('MMC_STUDENT_RESPONSE_AUTHOR_INVALID', 'student response authorship');
  assertBinding(input.publicationId, publication.publicationId, 'student response publication');
  if (input.publicationVersion !== publication.version) {
    fail('MMC_STUDENT_RESPONSE_BINDING_MISMATCH', 'student response publication version');
  }
  assertOpaqueIdentifier(input.publicationItemId, 'student response publication item');
  if (!publication.items.some((item) => item.itemId === input.publicationItemId)) {
    fail('MMC_STUDENT_RESPONSE_BINDING_MISMATCH', 'student response publication item');
  }
  if (!authorityState) fail('MMC_STUDENT_RESPONSE_SERVER_TIME_REQUIRED', 'student response time');
  const createdAt = requireCanonicalText ? input.createdAt : authorityState.authorizedAt;
  assertRfc3339(createdAt, 'student response time');
  if (requireCanonicalText && Date.parse(createdAt) > Date.parse(authorityState.authorizedAt)) {
    fail('MMC_STUDENT_RESPONSE_FUTURE_TIME', 'student response time');
  }

  const response = {
    responseId: input.responseId,
    schemaVersion: input.schemaVersion,
    version: input.version,
    tenantId: input.tenantId,
    environment: input.environment,
    subjectLinkId: input.subjectLinkId,
    studentPrincipalId: input.studentPrincipalId,
    authorPrincipalId: input.authorPrincipalId,
    authorship: input.authorship,
    publicationId: input.publicationId,
    publicationVersion: input.publicationVersion,
    publicationItemId: input.publicationItemId,
    kind: input.kind,
    createdAt,
    supersedesResponseId: input.supersedesResponseId,
  };
  for (const descriptor of fields) {
    response[descriptor.name] = canonicalizeField(input[descriptor.name], descriptor, requireCanonicalText);
  }
  return response;
}

function buildStudentPayload(publication) {
  return {
    schemaVersion: publication.schemaVersion,
    publicationId: publication.publicationId,
    publicationVersion: publication.version,
    environment: publication.environment,
    subjectLinkId: publication.subjectLinkId,
    studentPrincipalId: publication.studentPrincipalId,
    effectiveAt: publication.projectionEffectiveAt,
    items: publication.items.map((item) => {
      const projected = { itemId: item.itemId, kind: item.kind };
      for (const descriptor of ITEM_SPECS[item.kind].fields) {
        projected[descriptor.name] = item[descriptor.name];
      }
      return projected;
    }),
  };
}

function assertReadablePublication(publication) {
  if (!PUBLICATION_READABLE_STATES.has(publication.state)) {
    fail('MMC_PUBLICATION_READ_DENIED', 'publication state');
  }
}

function canonicalizeField(value, descriptor, requireCanonicalText) {
  if (descriptor.type === 'text') {
    const normalized = normalizePlainText(value, descriptor.config, descriptor.name);
    if (requireCanonicalText && normalized !== value) {
      fail('MMC_PUBLICATION_TEXT_NOT_NORMALIZED', descriptor.name);
    }
    return normalized;
  }
  if (descriptor.type === 'enum') {
    assertEnumValue(descriptor.config, value, descriptor.name);
    return value;
  }
  if (descriptor.type === 'identifier') {
    assertOpaqueIdentifier(value, descriptor.name);
    return value;
  }
  if (descriptor.type === 'timestamp') {
    assertRfc3339(value, descriptor.name);
    return value;
  }
  if (descriptor.type === 'timestampOrNull') {
    if (value !== null) assertRfc3339(value, descriptor.name);
    return value;
  }
  fail('MMC_PUBLICATION_FIELD_TYPE_UNKNOWN', 'publication field');
}

function normalizePlainText(value, maxBytes, fieldName) {
  if (typeof value !== 'string' || FORBIDDEN_CONTROL_PATTERN.test(value) || BIDI_OVERRIDE_PATTERN.test(value)) {
    fail('MMC_PUBLICATION_TEXT_INVALID', fieldName);
  }
  const normalized = value.normalize('NFC').replace(/\r\n?/gu, '\n').trim();
  if (!normalized) fail('MMC_PUBLICATION_TEXT_INVALID', fieldName);
  if (containsCredential(normalized)) {
    fail('MMC_PUBLICATION_CREDENTIAL_FORBIDDEN', fieldName);
  }
  if (
    HTML_PATTERN.test(normalized)
    || URI_PATTERN.test(normalized)
    || DOMAIN_PATTERN.test(normalized)
    || FILE_PATH_PATTERN.test(normalized)
  ) {
    fail('MMC_PUBLICATION_TEXT_UNSAFE', fieldName);
  }
  if (textEncoder.encode(normalized).byteLength > maxBytes) {
    fail('MMC_PUBLICATION_TEXT_TOO_LARGE', fieldName);
  }
  return normalized;
}

function field(name, type, config) {
  return Object.freeze({ name, type, config });
}

function assertBinding(actual, expected, fieldName) {
  if (actual !== expected) fail('MMC_PUBLICATION_BINDING_MISMATCH', fieldName);
}

function assertPositiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) fail('MMC_PUBLICATION_INTEGER_INVALID', fieldName);
}

function assertEnumValue(enumObject, value, fieldName) {
  if (typeof value !== 'string' || !Object.hasOwn(enumObject, value)) {
    fail('MMC_PUBLICATION_ENUM_INVALID', fieldName);
  }
}

function assertOpaqueIdentifier(value, fieldName) {
  if (
    typeof value !== 'string'
    || textEncoder.encode(value).byteLength > PUBLICATION_CONTRACT_LIMITS.IDENTIFIER_MAX_BYTES
    || !OPAQUE_IDENTIFIER_PATTERN.test(value)
  ) {
    fail('MMC_PUBLICATION_IDENTIFIER_INVALID', fieldName);
  }
  if (containsCredential(value)) fail('MMC_PUBLICATION_CREDENTIAL_FORBIDDEN', fieldName);
}

function assertNoCredentialMaterial(value, fieldName) {
  if (typeof value === 'string') {
    if (containsCredential(value)) fail('MMC_PUBLICATION_CREDENTIAL_FORBIDDEN', fieldName);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => assertNoCredentialMaterial(entry, fieldName));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => assertNoCredentialMaterial(entry, fieldName));
  }
}

function containsCredential(value) {
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(String(value || '')));
}

function assertRfc3339(value, fieldName) {
  if (!isStrictRfc3339(value)) {
    fail('MMC_PUBLICATION_TIMESTAMP_INVALID', fieldName);
  }
}

function assertPlainRecord(value, fieldName) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('MMC_PUBLICATION_SHAPE_INVALID', fieldName);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail('MMC_PUBLICATION_SHAPE_INVALID', fieldName);
  }
}

function assertExactKeys(value, allowedKeys, fieldName) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    fail('MMC_PUBLICATION_UNKNOWN_FIELD', fieldName);
  }
}

function assertRequiredKeys(value, requiredKeys, fieldName) {
  if (requiredKeys.some((key) => !Object.hasOwn(value, key))) {
    fail('MMC_PUBLICATION_MISSING_FIELD', fieldName);
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

function fail(code, fieldName) {
  throw new MmcPublicationContractError(code, fieldName);
}
