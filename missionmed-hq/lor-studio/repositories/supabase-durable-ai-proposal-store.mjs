import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IdempotencyConflictError,
  IntegrationDisabledError,
  NotFoundError,
  ValidationError,
} from '../domain/errors.js';
import {
  GROUNDING_MODEL_VERSION,
  SEGMENT_SEPARATORS,
} from '../domain/claim-validator.js';
import {
  assertNonEmptyString,
  deepFreeze,
  hashValue,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import {
  AI_PROPOSAL_RECORD_SCHEMA,
  aiProposalAlreadyDecided,
} from '../services/ai-proposal-service.js';
import {
  assertValidatedLorTargetBinding,
  LOR_TARGET_BINDING_CONTRACT,
} from '../adapters/lor-target-binding.mjs';

const INTEGRATION = 'lor_ai_proposal_store';
const SCOPE_INTEGRATION = 'lor_ai_proposal_scope';

const SERVER_SCOPE_SCHEMA = 'missionmed.lor.server-query-scope.v1';
const DRIVER_COMMAND_SCHEMA = 'missionmed.lor.ai-proposal-driver-command.v1';
const WRITE_RECEIPT_SCHEMA = 'missionmed.lor.ai-proposal-write-receipt.v1';
const READ_RECEIPT_SCHEMA = 'missionmed.lor.ai-proposal-read-receipt.v1';
const ERROR_RECEIPT_SCHEMA = 'missionmed.lor.ai-proposal-error-receipt.v1';
const RESERVATION_RECEIPT_SCHEMA =
  'missionmed.lor.ai-proposal-generation-reservation-receipt.v1';

const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const WP_SUBJECT_PATTERN = /^wp:[1-9][0-9]*$/u;
const TRANSACTION_REF_PATTERN = /^txn_[a-f0-9]{64}$/u;
const RESERVATION_ID_PATTERN = /^ai_generation_reservation_[a-f0-9]{64}$/u;

const RECORD_KEYS = new Set([
  'schemaVersion',
  'id',
  'caseId',
  'requestedBy',
  'requestedAt',
  'state',
  'humanDecisionRequired',
  'text',
  'segments',
  'claims',
  'grounding',
  'provenance',
  'fallbackUsed',
  'decision',
  'acceptedContent',
]);
const PROVENANCE_KEYS = new Set([
  'schemaVersion',
  'id',
  'caseId',
  'state',
  'provider',
  'model',
  'templateVersion',
  'templateHash',
  'sourceReferences',
  'sourceSetHash',
  'outputHash',
  'generatedAt',
]);
const SOURCE_REFERENCE_KEYS = new Set(['id', 'contentHash']);
const SEGMENT_KEYS = new Set(['kind', 'text', 'separator', 'supportIds']);
const CLAIM_KEYS = new Set(['text', 'supportIds']);
const GROUNDING_KEYS = new Set([
  'schemaVersion',
  'attestationHash',
  'factualSegmentCount',
  'connectiveSegmentCount',
  'supportIds',
  'attestations',
]);
const ATTESTATION_KEYS = new Set([
  'index',
  'kind',
  'supportIds',
  'status',
  'verifierId',
  'rationaleCode',
  'sourceHashes',
]);
const DECISION_KEYS = new Set([
  'schemaVersion',
  'id',
  'caseId',
  'proposalId',
  'proposalOutputHash',
  'facultyId',
  'action',
  'resultingTextHash',
  'decidedAt',
]);
const ACCEPTED_CONTENT_KEYS = new Set([
  'origin',
  'text',
  'textHash',
  'supportIds',
  'groundingAttestationHash',
  'groundedAsAttested',
  'proposalId',
  'decisionId',
  'decidedAt',
]);
const PUT_KEYS = new Set(['caseId', 'idempotencyKey', 'requestHash', 'record']);
const RESERVATION_KEYS = new Set(['caseId', 'idempotencyKey', 'requestHash']);
const READ_KEYS = new Set(['caseId', 'proposalId']);
const DECIDE_KEYS = new Set(['caseId', 'proposalId', 'idempotencyKey', 'requestHash', 'record']);
const SCOPE_KEYS = new Set([
  'schemaVersion',
  'authoritySource',
  'authenticated',
  'roleVerified',
  'authUid',
  'authenticatedSubject',
  'actorId',
  'actorRole',
  'resourceStudentId',
  'caseId',
  'operation',
  'purpose',
  'assignmentId',
  'invitationId',
  'administrativeGrantId',
  'entitlementVerified',
  'lorEnabled',
  'canaryAuthorized',
]);
const WRITE_RECEIPT_KEYS = new Set([
  'schemaVersion',
  'operation',
  'outcome',
  'writeApplied',
  'replayed',
  'sameTransaction',
  'databaseClockUsed',
  'caseId',
  'submittedProposalId',
  'proposalId',
  'idempotencyKey',
  'requestHash',
  'scopeHash',
  'targetBindingHash',
  'submittedRecordHash',
  'recordHash',
  'providerRunHash',
  'outputHash',
  'decisionHash',
  'acceptedContentHash',
  'transactionRef',
  'committedAt',
  'record',
]);
const READ_RECEIPT_KEYS = new Set([
  'schemaVersion',
  'found',
  'caseId',
  'proposalId',
  'scopeHash',
  'targetBindingHash',
  'recordHash',
  'providerRunHash',
  'outputHash',
  'decisionHash',
  'acceptedContentHash',
  'record',
]);
const ERROR_RECEIPT_KEYS = new Set([
  'schemaVersion',
  'operation',
  'errorCode',
  'caseId',
  'proposalId',
  'idempotencyKey',
  'requestHash',
  'scopeHash',
  'targetBindingHash',
]);
const RESERVATION_RECEIPT_KEYS = new Set([
  'schemaVersion',
  'reservationId',
  'caseId',
  'idempotencyKey',
  'requestHash',
  'scopeHash',
  'targetBindingHash',
  'status',
  'providerCallAuthorized',
  'replayed',
  'proposalId',
  'record',
  'transactionRef',
  'reservedAt',
  'settledAt',
]);
const RESERVATION_ERROR_RECEIPT_KEYS = new Set([
  'schemaVersion', 'operation', 'errorCode', 'caseId', 'idempotencyKey',
  'requestHash', 'scopeHash', 'targetBindingHash',
]);
const WRITE_COMMAND_KEYS = new Set([
  'schemaVersion',
  'operation',
  'binding',
  'targetBindingHash',
  'scope',
  'scopeHash',
  'caseId',
  'proposalId',
  'idempotencyKey',
  'requestHash',
  'recordHash',
  'providerRunHash',
  'outputHash',
  'decisionHash',
  'acceptedContentHash',
  'expectedState',
  'expectedOutputHash',
  'expectedDecisionHash',
  'record',
]);
const READ_COMMAND_KEYS = new Set([
  'schemaVersion',
  'operation',
  'binding',
  'targetBindingHash',
  'scope',
  'scopeHash',
  'caseId',
  'proposalId',
]);
const RESERVATION_COMMAND_KEYS = new Set([
  'schemaVersion',
  'operation',
  'binding',
  'targetBindingHash',
  'scope',
  'scopeHash',
  'caseId',
  'idempotencyKey',
  'requestHash',
]);

const MAX = deepFreeze({
  identifier: 200,
  text: 40_000,
  segmentText: 4_000,
  segments: 400,
  supportIds: 32,
  sourceReferences: 500,
});

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function assertExactObject(value, expected, fieldName) {
  if (!hasExactKeys(value, expected)) {
    throw new ValidationError(`${fieldName} has an invalid shape`);
  }
  return value;
}

function snapshotPlain(value, fieldName) {
  if (!isPlainObject(value)) throw new ValidationError(`${fieldName} must be a plain object`);
  try {
    const snapshot = structuredClone(value);
    if (!isPlainObject(snapshot)) throw new Error('not plain');
    return snapshot;
  } catch {
    throw new ValidationError(`${fieldName} must be inert JSON-compatible data`);
  }
}

function assertIdentifier(value, fieldName) {
  assertNonEmptyString(value, fieldName, { maxLength: MAX.identifier });
  if (value.trim() !== value) throw new ValidationError(`${fieldName} must be canonical`);
  return value;
}

function assertHash(value, fieldName) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw new ValidationError(`${fieldName} must be a SHA-256 digest`);
  }
  return value;
}

function assertCanonicalIso(value, fieldName) {
  if (typeof value !== 'string' || toIso(value, fieldName) !== value) {
    throw new ValidationError(`${fieldName} must be a canonical ISO timestamp`);
  }
  return value;
}

function assertUniqueIdentifiers(value, fieldName, { allowEmpty = true, maximum = MAX.sourceReferences } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > maximum) {
    throw new ValidationError(`${fieldName} must be a bounded array`);
  }
  const seen = new Set();
  for (const item of value) {
    assertIdentifier(item, `${fieldName} entry`);
    if (seen.has(item)) throw new ValidationError(`${fieldName} entries must be unique`);
    seen.add(item);
  }
  return value;
}

function assertSameArray(left, right, fieldName) {
  if (
    !Array.isArray(left)
    || !Array.isArray(right)
    || left.length !== right.length
    || left.some((value, index) => value !== right[index])
  ) {
    throw new ValidationError(`${fieldName} does not match its bound value`);
  }
}

function validateProvenance(raw, record) {
  const provenance = assertExactObject(raw, PROVENANCE_KEYS, 'record.provenance');
  if (provenance.schemaVersion !== 'missionmed.lor.ai-proposal-provenance.v1') {
    throw new ValidationError('Unsupported AI proposal provenance schema');
  }
  assertIdentifier(provenance.id, 'record.provenance.id');
  assertIdentifier(provenance.caseId, 'record.provenance.caseId');
  if (provenance.id !== record.id || provenance.caseId !== record.caseId || provenance.state !== 'proposal') {
    throw new ValidationError('AI proposal provenance is not bound to the record');
  }
  for (const field of ['provider', 'model', 'templateVersion']) {
    assertIdentifier(provenance[field], `record.provenance.${field}`);
  }
  assertHash(provenance.templateHash, 'record.provenance.templateHash');
  if (provenance.templateHash !== sha256(provenance.templateVersion)) {
    throw new ValidationError('AI proposal template hash does not match its template version');
  }
  if (!Array.isArray(provenance.sourceReferences) || provenance.sourceReferences.length === 0
    || provenance.sourceReferences.length > MAX.sourceReferences) {
    throw new ValidationError('AI proposal provenance requires bounded source references');
  }
  const sourceIds = new Set();
  for (const [index, reference] of provenance.sourceReferences.entries()) {
    assertExactObject(reference, SOURCE_REFERENCE_KEYS, `record.provenance.sourceReferences[${index}]`);
    assertIdentifier(reference.id, `record.provenance.sourceReferences[${index}].id`);
    assertHash(reference.contentHash, `record.provenance.sourceReferences[${index}].contentHash`);
    if (sourceIds.has(reference.id)) {
      throw new ValidationError('AI proposal source references must be unique');
    }
    sourceIds.add(reference.id);
  }
  assertHash(provenance.sourceSetHash, 'record.provenance.sourceSetHash');
  if (provenance.sourceSetHash !== hashValue(provenance.sourceReferences)) {
    throw new ValidationError('AI proposal source-set hash does not match its references');
  }
  assertHash(provenance.outputHash, 'record.provenance.outputHash');
  if (provenance.outputHash !== sha256(record.text)) {
    throw new ValidationError('AI proposal output hash does not match its text');
  }
  assertCanonicalIso(provenance.generatedAt, 'record.provenance.generatedAt');
  return { provenance, sourceIds };
}

function validateSegmentsAndGrounding(record, sourceIds) {
  if (!Array.isArray(record.segments) || record.segments.length === 0 || record.segments.length > MAX.segments) {
    throw new ValidationError('AI proposal requires bounded typed segments');
  }
  const factual = [];
  const supportUnion = new Set();
  for (const [index, segment] of record.segments.entries()) {
    assertExactObject(segment, SEGMENT_KEYS, `record.segments[${index}]`);
    if (!['factual', 'connective'].includes(segment.kind)) {
      throw new ValidationError('AI proposal segment kind is invalid');
    }
    if (
      typeof segment.text !== 'string'
      || segment.text.trim().length === 0
      || segment.text.trim() !== segment.text
      || segment.text.length > MAX.segmentText
      || !Object.hasOwn(SEGMENT_SEPARATORS, segment.separator)
      || (index === 0 && segment.separator === 'inline')
    ) {
      throw new ValidationError('AI proposal segment content is invalid');
    }
    assertUniqueIdentifiers(segment.supportIds, `record.segments[${index}].supportIds`, {
      allowEmpty: segment.kind === 'connective',
      maximum: MAX.supportIds,
    });
    if (segment.kind === 'connective' && segment.supportIds.length !== 0) {
      throw new ValidationError('Connective AI proposal segments cannot cite support');
    }
    if (segment.kind === 'factual') {
      for (const supportId of segment.supportIds) {
        if (!sourceIds.has(supportId)) {
          throw new ValidationError('AI proposal segment cites an unbound source');
        }
        supportUnion.add(supportId);
      }
      factual.push(segment);
    }
  }
  if (factual.length === 0) throw new ValidationError('AI proposal requires a factual segment');
  const composed = record.segments
    .map((segment, index) => (index === 0 ? '' : SEGMENT_SEPARATORS[segment.separator]) + segment.text)
    .join('');
  if (composed !== record.text) {
    throw new ValidationError('AI proposal text is not the exact composition of its segments');
  }

  if (!Array.isArray(record.claims) || record.claims.length !== factual.length) {
    throw new ValidationError('AI proposal claims do not match its factual segments');
  }
  for (const [index, claim] of record.claims.entries()) {
    assertExactObject(claim, CLAIM_KEYS, `record.claims[${index}]`);
    assertUniqueIdentifiers(claim.supportIds, `record.claims[${index}].supportIds`, {
      allowEmpty: false,
      maximum: MAX.supportIds,
    });
    if (claim.text !== factual[index].text) {
      throw new ValidationError('AI proposal claim text does not match its factual segment');
    }
    assertSameArray(claim.supportIds, factual[index].supportIds, 'AI proposal claim support');
  }

  const grounding = assertExactObject(record.grounding, GROUNDING_KEYS, 'record.grounding');
  if (
    grounding.schemaVersion !== GROUNDING_MODEL_VERSION
    || !Number.isSafeInteger(grounding.factualSegmentCount)
    || !Number.isSafeInteger(grounding.connectiveSegmentCount)
    || grounding.factualSegmentCount !== factual.length
    || grounding.connectiveSegmentCount !== record.segments.length - factual.length
  ) {
    throw new ValidationError('AI proposal grounding counts are invalid');
  }
  const expectedSupportIds = [...supportUnion].sort();
  assertUniqueIdentifiers(grounding.supportIds, 'record.grounding.supportIds', { allowEmpty: false });
  assertSameArray(grounding.supportIds, expectedSupportIds, 'AI proposal grounding support');
  if (!Array.isArray(grounding.attestations) || grounding.attestations.length !== record.segments.length) {
    throw new ValidationError('AI proposal grounding attestations are incomplete');
  }
  const sourceHashes = new Map(record.provenance.sourceReferences.map((entry) => [entry.id, entry.contentHash]));
  for (const [index, attestation] of grounding.attestations.entries()) {
    assertExactObject(attestation, ATTESTATION_KEYS, `record.grounding.attestations[${index}]`);
    const segment = record.segments[index];
    if (attestation.index !== index || attestation.kind !== segment.kind) {
      throw new ValidationError('AI proposal grounding attestation is bound to the wrong segment');
    }
    assertUniqueIdentifiers(attestation.supportIds, `record.grounding.attestations[${index}].supportIds`, {
      allowEmpty: segment.kind === 'connective',
      maximum: MAX.supportIds,
    });
    assertSameArray(attestation.supportIds, segment.supportIds, 'AI proposal attestation support');
    if (!Array.isArray(attestation.sourceHashes)) {
      throw new ValidationError('AI proposal attestation source hashes are invalid');
    }
    if (segment.kind === 'factual') {
      if (
        attestation.status !== 'ENTAILED'
        || typeof attestation.verifierId !== 'string'
        || attestation.verifierId.trim().length === 0
        || typeof attestation.rationaleCode !== 'string'
        || attestation.rationaleCode.trim().length === 0
      ) {
        throw new ValidationError('AI proposal factual attestation is invalid');
      }
      const expectedHashes = segment.supportIds.map((id) => sourceHashes.get(id));
      for (const value of attestation.sourceHashes) assertHash(value, 'attestation source hash');
      assertSameArray(attestation.sourceHashes, expectedHashes, 'AI proposal attestation source hashes');
    } else if (
      attestation.status !== 'NO_MATERIAL_ASSERTION'
      || attestation.verifierId !== null
      || attestation.rationaleCode !== 'CONNECTIVE_GUARD_CLEAR'
      || attestation.sourceHashes.length !== 0
    ) {
      throw new ValidationError('AI proposal connective attestation is invalid');
    }
  }
  assertHash(grounding.attestationHash, 'record.grounding.attestationHash');
  const attestedGrounding = {
    schemaVersion: grounding.schemaVersion,
    valid: true,
    claimCount: grounding.factualSegmentCount,
    segmentCount: record.segments.length,
    factualSegmentCount: grounding.factualSegmentCount,
    connectiveSegmentCount: grounding.connectiveSegmentCount,
    supportIds: grounding.supportIds,
    segments: record.segments,
    attestations: grounding.attestations,
  };
  if (grounding.attestationHash !== hashValue(attestedGrounding)) {
    throw new ValidationError('AI proposal grounding attestation hash is invalid');
  }
}

function validateDecisionAndContent(record) {
  if (record.state === 'proposal') {
    if (record.humanDecisionRequired !== true || record.decision !== null || record.acceptedContent !== null) {
      throw new ValidationError('An undecided AI proposal cannot carry content or a decision');
    }
    return;
  }
  if (record.state !== 'decided' || record.humanDecisionRequired !== false) {
    throw new ValidationError('AI proposal state is invalid');
  }
  const decision = assertExactObject(record.decision, DECISION_KEYS, 'record.decision');
  if (decision.schemaVersion !== 'missionmed.lor.human-decision.v1') {
    throw new ValidationError('Unsupported AI proposal decision schema');
  }
  for (const field of ['id', 'caseId', 'proposalId', 'facultyId']) {
    assertIdentifier(decision[field], `record.decision.${field}`);
  }
  if (
    decision.caseId !== record.caseId
    || decision.proposalId !== record.id
    || decision.proposalOutputHash !== record.provenance.outputHash
  ) {
    throw new ValidationError('AI proposal decision is not bound to the proposal output');
  }
  assertHash(decision.proposalOutputHash, 'record.decision.proposalOutputHash');
  assertCanonicalIso(decision.decidedAt, 'record.decision.decidedAt');
  if (!['accepted', 'edited', 'rejected'].includes(decision.action)) {
    throw new ValidationError('AI proposal decision action is invalid');
  }
  if (decision.action === 'rejected') {
    if (decision.resultingTextHash !== null || record.acceptedContent !== null) {
      throw new ValidationError('A rejected AI proposal cannot carry accepted content');
    }
    return;
  }
  assertHash(decision.resultingTextHash, 'record.decision.resultingTextHash');
  const accepted = assertExactObject(record.acceptedContent, ACCEPTED_CONTENT_KEYS, 'record.acceptedContent');
  if (
    typeof accepted.text !== 'string'
    || accepted.text.trim().length === 0
    || accepted.text.length > MAX.text
    || accepted.textHash !== sha256(accepted.text)
    || accepted.textHash !== decision.resultingTextHash
  ) {
    throw new ValidationError('Accepted AI proposal content hash does not match its text');
  }
  assertHash(accepted.textHash, 'record.acceptedContent.textHash');
  assertUniqueIdentifiers(accepted.supportIds, 'record.acceptedContent.supportIds', { allowEmpty: false });
  assertSameArray(accepted.supportIds, record.grounding.supportIds, 'accepted content grounding support');
  if (
    accepted.groundingAttestationHash !== record.grounding.attestationHash
    || accepted.proposalId !== record.id
    || accepted.decisionId !== decision.id
    || accepted.decidedAt !== decision.decidedAt
  ) {
    throw new ValidationError('Accepted AI proposal content is not bound to its decision and grounding');
  }
  assertHash(accepted.groundingAttestationHash, 'acceptedContent.groundingAttestationHash');
  if (decision.action === 'accepted') {
    if (
      accepted.origin !== 'ai_proposal_accepted'
      || accepted.groundedAsAttested !== true
      || accepted.text !== record.text
      || accepted.textHash !== record.provenance.outputHash
    ) {
      throw new ValidationError('Accepted AI proposal content does not match the attested output');
    }
  } else if (accepted.origin !== 'human_edited' || accepted.groundedAsAttested !== false) {
    throw new ValidationError('Edited AI proposal content cannot claim attested grounding');
  }
}

function validateRecord(rawRecord, { expectedCaseId = null, expectedProposalId = null } = {}) {
  const record = snapshotPlain(rawRecord, 'AI proposal record');
  assertExactObject(record, RECORD_KEYS, 'AI proposal record');
  if (record.schemaVersion !== AI_PROPOSAL_RECORD_SCHEMA) {
    throw new ValidationError('Unsupported AI proposal record schema');
  }
  assertIdentifier(record.id, 'record.id');
  assertIdentifier(record.caseId, 'record.caseId');
  assertIdentifier(record.requestedBy, 'record.requestedBy');
  assertCanonicalIso(record.requestedAt, 'record.requestedAt');
  if (expectedCaseId !== null && record.caseId !== expectedCaseId) {
    throw new ValidationError('AI proposal record is bound to the wrong case');
  }
  if (expectedProposalId !== null && record.id !== expectedProposalId) {
    throw new ValidationError('AI proposal record is bound to the wrong proposal');
  }
  if (typeof record.text !== 'string' || record.text.trim().length === 0 || record.text.length > MAX.text) {
    throw new ValidationError('AI proposal record text is invalid');
  }
  if (typeof record.fallbackUsed !== 'boolean') {
    throw new ValidationError('AI proposal fallbackUsed must be boolean');
  }
  const { sourceIds } = validateProvenance(record.provenance, record);
  validateSegmentsAndGrounding(record, sourceIds);
  validateDecisionAndContent(record);
  return deepFreeze(record);
}

function recordBindings(record) {
  return deepFreeze({
    recordHash: hashValue(record),
    providerRunHash: hashValue(record.provenance),
    outputHash: record.provenance.outputHash,
    decisionHash: record.decision === null ? null : hashValue(record.decision),
    acceptedContentHash: record.acceptedContent === null ? null : hashValue(record.acceptedContent),
  });
}

function assertDriver(driver) {
  if (
    !driver
    || driver.rlsEnforced !== true
    || driver.serverOnly !== true
    || driver.databaseClock !== true
    || driver.actorSafeReads !== true
    || driver.atomicProviderCallReservation !== true
    || driver.atomicProviderRunAndProposal !== true
    || driver.conditionalAtomicOneDecision !== true
    || typeof driver.reserveAiProposalGenerationAtomic !== 'function'
    || typeof driver.markAiProposalGenerationUnknownAtomic !== 'function'
    || typeof driver.persistProviderRunAndProposalAtomic !== 'function'
    || typeof driver.readActorSafeAiProposal !== 'function'
    || typeof driver.attachDecisionIfUndecidedAtomic !== 'function'
  ) {
    throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_RLS_AI_PROPOSAL_DRIVER_REQUIRED');
  }
  return driver;
}

function assertScope(rawScope, { caseId, operation }) {
  const scope = snapshotPlain(rawScope, 'AI proposal server scope');
  if (
    !hasExactKeys(scope, SCOPE_KEYS)
    || scope.schemaVersion !== SERVER_SCOPE_SCHEMA
    || scope.authoritySource !== 'server_verified_session_crosswalk'
    || scope.authenticated !== true
    || scope.roleVerified !== true
    || scope.actorRole !== 'faculty'
    || scope.caseId !== caseId
    || scope.operation !== operation
    || scope.purpose !== 'faculty_private_edit'
    || scope.assignmentId !== null
    || scope.administrativeGrantId !== null
    || scope.entitlementVerified !== true
    || scope.lorEnabled !== true
    || scope.canaryAuthorized !== true
  ) {
    throw new IntegrationDisabledError(SCOPE_INTEGRATION, 'VERIFIED_FACULTY_SCOPE_REQUIRED');
  }
  for (const field of ['authUid', 'authenticatedSubject', 'actorId', 'resourceStudentId', 'invitationId']) {
    assertIdentifier(scope[field], `scope.${field}`);
  }
  if (
    !WP_SUBJECT_PATTERN.test(scope.authenticatedSubject)
    || scope.actorId !== scope.authenticatedSubject
    || !WP_SUBJECT_PATTERN.test(scope.resourceStudentId)
  ) {
    throw new IntegrationDisabledError(SCOPE_INTEGRATION, 'VERIFIED_FACULTY_SCOPE_REQUIRED');
  }
  return deepFreeze(scope);
}

function buildWriteCommand({ store, operation, scope, caseId, proposalId, idempotencyKey, requestHash, record }) {
  const bindings = recordBindings(record);
  return deepFreeze({
    schemaVersion: DRIVER_COMMAND_SCHEMA,
    operation,
    binding: store.binding,
    targetBindingHash: store.targetBindingHash,
    scope,
    scopeHash: hashValue(scope),
    caseId,
    proposalId,
    idempotencyKey,
    requestHash,
    ...bindings,
    expectedState: operation === 'attach_decision' ? 'proposal' : 'absent_or_same_idempotency',
    expectedOutputHash: operation === 'attach_decision' ? bindings.outputHash : null,
    expectedDecisionHash: null,
    record,
  });
}

function assertErrorReceipt(rawResult, command) {
  let result;
  try {
    result = snapshotPlain(rawResult, 'AI proposal error receipt');
  } catch {
    return false;
  }
  if (
    !hasExactKeys(result, ERROR_RECEIPT_KEYS)
    || result.schemaVersion !== ERROR_RECEIPT_SCHEMA
    || result.operation !== command.operation
    || result.caseId !== command.caseId
    || result.proposalId !== command.proposalId
    || result.idempotencyKey !== command.idempotencyKey
    || result.requestHash !== command.requestHash
    || result.scopeHash !== command.scopeHash
    || result.targetBindingHash !== command.targetBindingHash
  ) return false;
  if (result.errorCode === 'IDEMPOTENCY_CONFLICT') {
    throw new IdempotencyConflictError({ idempotencyKey: command.idempotencyKey });
  }
  if (command.operation === 'attach_decision' && result.errorCode === 'NOT_FOUND') {
    throw new NotFoundError('ai_proposal', command.proposalId);
  }
  if (
    command.operation === 'attach_decision'
    && ['AI_PROPOSAL_ALREADY_DECIDED', 'CONCURRENT_DECISION_CONFLICT'].includes(result.errorCode)
  ) {
    throw aiProposalAlreadyDecided(command.proposalId);
  }
  return false;
}

function validateWriteReceipt(rawResult, command) {
  assertErrorReceipt(rawResult, command);
  const result = snapshotPlain(rawResult, 'AI proposal write receipt');
  if (
    !hasExactKeys(result, WRITE_RECEIPT_KEYS)
    || result.schemaVersion !== WRITE_RECEIPT_SCHEMA
    || result.operation !== command.operation
    || result.caseId !== command.caseId
    || result.submittedProposalId !== command.proposalId
    || result.idempotencyKey !== command.idempotencyKey
    || result.requestHash !== command.requestHash
    || result.scopeHash !== command.scopeHash
    || result.targetBindingHash !== command.targetBindingHash
    || result.submittedRecordHash !== command.recordHash
    || result.sameTransaction !== true
    || result.databaseClockUsed !== true
    || typeof result.replayed !== 'boolean'
    || result.outcome !== (result.replayed ? 'replayed' : 'committed')
    || result.writeApplied !== !result.replayed
    || typeof result.transactionRef !== 'string'
    || !TRANSACTION_REF_PATTERN.test(result.transactionRef)
  ) {
    throw new ValidationError('AI proposal write receipt is not bound to its command');
  }
  assertCanonicalIso(result.committedAt, 'receipt.committedAt');
  const record = validateRecord(result.record, {
    expectedCaseId: command.caseId,
    expectedProposalId: result.proposalId,
  });
  const bindings = recordBindings(record);
  for (const field of ['recordHash', 'providerRunHash', 'outputHash', 'decisionHash', 'acceptedContentHash']) {
    if (result[field] !== bindings[field]) {
      throw new ValidationError('AI proposal write receipt contains a forged record hash');
    }
  }
  if (!result.replayed) {
    if (result.proposalId !== command.proposalId || result.recordHash !== command.recordHash) {
      throw new ValidationError('AI proposal write receipt committed a different record');
    }
  }
  if (command.operation === 'put_proposal') {
    if (!result.replayed && record.state !== 'proposal') {
      throw new ValidationError('AI proposal create receipt contains decided content');
    }
  } else if (record.state !== 'decided' || record.decision === null) {
    throw new ValidationError('AI proposal decision receipt contains no decision');
  }
  return deepFreeze({ record, replayed: result.replayed });
}

function validateReadReceipt(rawResult, command) {
  const result = snapshotPlain(rawResult, 'AI proposal read receipt');
  if (
    !hasExactKeys(result, READ_RECEIPT_KEYS)
    || result.schemaVersion !== READ_RECEIPT_SCHEMA
    || result.caseId !== command.caseId
    || result.proposalId !== command.proposalId
    || result.scopeHash !== command.scopeHash
    || result.targetBindingHash !== command.targetBindingHash
    || typeof result.found !== 'boolean'
  ) {
    throw new ValidationError('AI proposal read receipt is not bound to its command');
  }
  if (!result.found) {
    if (
      result.record !== null
      || result.recordHash !== null
      || result.providerRunHash !== null
      || result.outputHash !== null
      || result.decisionHash !== null
      || result.acceptedContentHash !== null
    ) {
      throw new ValidationError('AI proposal absence receipt contains protected state');
    }
    return null;
  }
  const record = validateRecord(result.record, {
    expectedCaseId: command.caseId,
    expectedProposalId: command.proposalId,
  });
  const bindings = recordBindings(record);
  for (const field of ['recordHash', 'providerRunHash', 'outputHash', 'decisionHash', 'acceptedContentHash']) {
    if (result[field] !== bindings[field]) {
      throw new ValidationError('AI proposal read receipt contains a forged record hash');
    }
  }
  return record;
}

function buildReservationCommand({ store, operation, scope, caseId, idempotencyKey, requestHash }) {
  return deepFreeze({
    schemaVersion: DRIVER_COMMAND_SCHEMA,
    operation,
    binding: store.binding,
    targetBindingHash: store.targetBindingHash,
    scope,
    scopeHash: hashValue(scope),
    caseId,
    idempotencyKey,
    requestHash,
  });
}

function assertReservationErrorReceipt(rawResult, command) {
  let result;
  try {
    result = snapshotPlain(rawResult, 'AI generation reservation error receipt');
  } catch {
    return false;
  }
  if (!hasExactKeys(result, RESERVATION_ERROR_RECEIPT_KEYS)) return false;
  if (
    result.schemaVersion !== ERROR_RECEIPT_SCHEMA
    || result.operation !== command.operation
    || result.caseId !== command.caseId
    || result.idempotencyKey !== command.idempotencyKey
    || result.requestHash !== command.requestHash
    || result.scopeHash !== command.scopeHash
    || result.targetBindingHash !== command.targetBindingHash
  ) return false;
  if (result.errorCode === 'IDEMPOTENCY_CONFLICT') {
    throw new IdempotencyConflictError({ idempotencyKey: command.idempotencyKey });
  }
  return false;
}

function validateReservationReceipt(rawResult, command) {
  assertReservationErrorReceipt(rawResult, command);
  const result = snapshotPlain(rawResult, 'AI generation reservation receipt');
  if (
    !hasExactKeys(result, RESERVATION_RECEIPT_KEYS)
    || result.schemaVersion !== RESERVATION_RECEIPT_SCHEMA
    || !RESERVATION_ID_PATTERN.test(result.reservationId ?? '')
    || result.caseId !== command.caseId
    || result.idempotencyKey !== command.idempotencyKey
    || result.requestHash !== command.requestHash
    || result.scopeHash !== command.scopeHash
    || result.targetBindingHash !== command.targetBindingHash
    || !['pending', 'accepted', 'unknown'].includes(result.status)
    || typeof result.providerCallAuthorized !== 'boolean'
    || typeof result.replayed !== 'boolean'
    || !TRANSACTION_REF_PATTERN.test(result.transactionRef ?? '')
  ) {
    throw new ValidationError('AI generation reservation receipt is not bound to its command');
  }
  assertCanonicalIso(result.reservedAt, 'reservation.reservedAt');
  if (result.status === 'pending') {
    if (
      result.proposalId !== null
      || result.record !== null
      || result.settledAt !== null
      || result.providerCallAuthorized !== !result.replayed
    ) {
      throw new ValidationError('Pending AI generation reservation state is invalid');
    }
  } else {
    if (result.providerCallAuthorized !== false || result.settledAt === null) {
      throw new ValidationError('Settled AI generation reservation state is invalid');
    }
    assertCanonicalIso(result.settledAt, 'reservation.settledAt');
    if (result.status === 'unknown') {
      if (result.proposalId !== null || result.record !== null) {
        throw new ValidationError('Unknown AI generation state cannot claim a proposal');
      }
    } else {
      const record = validateRecord(result.record, { expectedCaseId: command.caseId });
      if (record.state !== 'proposal' || result.proposalId !== record.id) {
        throw new ValidationError('Accepted AI generation state is not bound to its proposal');
      }
      result.record = record;
    }
  }
  return deepFreeze(result);
}

export class SupabaseDurableAiProposalStore {
  constructor({ binding, driver, scopeProvider } = {}) {
    this.binding = assertValidatedLorTargetBinding(binding, INTEGRATION);
    this.targetBindingHash = hashValue(this.binding);
    this.driver = assertDriver(driver);
    if (typeof scopeProvider !== 'function') {
      throw new IntegrationDisabledError(SCOPE_INTEGRATION, 'SCOPE_PROVIDER_REQUIRED');
    }
    this.scopeProvider = scopeProvider;
    this.durability = 'DURABLE_PROVIDER_BOUND';
    this.isDurable = true;
    this.actorSafeReads = true;
    this.atomicProviderCallReservation = true;
    this.atomicProviderRunAndProposal = true;
    this.conditionalAtomicOneDecision = true;
    Object.freeze(this);
  }

  describePersistence() {
    return deepFreeze({
      durability: this.durability,
      environment: this.binding.environment,
      productionEligible: this.binding.environment === 'production',
      rlsBound: true,
      serverOnly: true,
      databaseClock: true,
      actorSafeReads: true,
      atomicProviderCallReservation: true,
      atomicProviderRunAndProposal: true,
      conditionalAtomicOneDecision: true,
      provider: this.binding.provider,
      schema: this.binding.schema,
    });
  }

  assertProductionReady() {
    if (this.binding.environment !== 'production') {
      throw new IntegrationDisabledError(INTEGRATION, 'PRODUCTION_DATA_BINDING_REQUIRED');
    }
    return this.describePersistence();
  }

  async #scope(caseId, operation) {
    let rawScope;
    try {
      rawScope = await this.scopeProvider({ caseId, operation });
    } catch {
      throw new IntegrationDisabledError(SCOPE_INTEGRATION, 'SCOPE_PROVIDER_UNAVAILABLE');
    }
    try {
      return assertScope(rawScope, { caseId, operation });
    } catch {
      throw new IntegrationDisabledError(SCOPE_INTEGRATION, 'VERIFIED_FACULTY_SCOPE_REQUIRED');
    }
  }

  async #transitionGeneration(operation, request) {
    const input = snapshotPlain(request, 'AI generation reservation request');
    assertExactObject(input, RESERVATION_KEYS, 'AI generation reservation request');
    const caseId = assertIdentifier(input.caseId, 'caseId');
    const idempotencyKey = assertIdentifier(input.idempotencyKey, 'idempotencyKey');
    const requestHash = assertHash(input.requestHash, 'requestHash');
    const scope = await this.#scope(caseId, 'save');
    const command = buildReservationCommand({
      store: this,
      operation,
      scope,
      caseId,
      idempotencyKey,
      requestHash,
    });
    const driverMethod = operation === 'reserve_generation'
      ? 'reserveAiProposalGenerationAtomic'
      : 'markAiProposalGenerationUnknownAtomic';
    let result;
    try {
      result = await this.driver[driverMethod](structuredClone(command));
    } catch {
      throw new IntegrationDisabledError(
        INTEGRATION,
        operation === 'reserve_generation'
          ? 'ATOMIC_GENERATION_RESERVATION_UNAVAILABLE'
          : 'ATOMIC_GENERATION_UNKNOWN_TRANSITION_UNAVAILABLE',
      );
    }
    try {
      return validateReservationReceipt(result, command);
    } catch (error) {
      if (error instanceof IdempotencyConflictError) throw error;
      throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_GENERATION_RESERVATION_RECEIPT_INVALID');
    }
  }

  async reserveProposalGeneration(request) {
    return this.#transitionGeneration('reserve_generation', request);
  }

  async markProposalGenerationUnknown(request) {
    return this.#transitionGeneration('mark_generation_unknown', request);
  }

  async finalizeProposalGeneration(request) {
    const input = snapshotPlain(request, 'AI proposal put request');
    assertExactObject(input, PUT_KEYS, 'AI proposal put request');
    const caseId = assertIdentifier(input.caseId, 'caseId');
    const idempotencyKey = assertIdentifier(input.idempotencyKey, 'idempotencyKey');
    const requestHash = assertHash(input.requestHash, 'requestHash');
    const record = validateRecord(input.record, { expectedCaseId: caseId });
    if (record.state !== 'proposal' || record.decision !== null || record.acceptedContent !== null) {
      throw new ValidationError('putProposal accepts undecided proposals only');
    }
    const scope = await this.#scope(caseId, 'save');
    if (record.requestedBy !== scope.actorId) {
      throw new AuthorizationDeniedError('AI_PROPOSAL_REQUESTER_SCOPE_MISMATCH');
    }
    const command = buildWriteCommand({
      store: this,
      operation: 'put_proposal',
      scope,
      caseId,
      proposalId: record.id,
      idempotencyKey,
      requestHash,
      record,
    });
    let result;
    try {
      result = await this.driver.persistProviderRunAndProposalAtomic(structuredClone(command));
    } catch {
      throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_PROPOSAL_PERSISTENCE_UNAVAILABLE');
    }
    try {
      return validateWriteReceipt(result, command);
    } catch (error) {
      if (
        error instanceof IdempotencyConflictError
        || error instanceof NotFoundError
        || error instanceof DomainInvariantError
      ) throw error;
      throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_PROPOSAL_RECEIPT_INVALID');
    }
  }

  // Compatibility alias for bounded callers outside the drafting service. It is deliberately a
  // finalize-only operation: the drafting service itself requires reservation before calling it.
  async putProposal(request) {
    return this.finalizeProposalGeneration(request);
  }

  async getProposal(request) {
    const input = snapshotPlain(request, 'AI proposal read request');
    assertExactObject(input, READ_KEYS, 'AI proposal read request');
    const caseId = assertIdentifier(input.caseId, 'caseId');
    const proposalId = assertIdentifier(input.proposalId, 'proposalId');
    const scope = await this.#scope(caseId, 'read');
    const command = deepFreeze({
      schemaVersion: DRIVER_COMMAND_SCHEMA,
      operation: 'get_proposal',
      binding: this.binding,
      targetBindingHash: this.targetBindingHash,
      scope,
      scopeHash: hashValue(scope),
      caseId,
      proposalId,
    });
    let result;
    try {
      result = await this.driver.readActorSafeAiProposal(structuredClone(command));
    } catch {
      throw new IntegrationDisabledError(INTEGRATION, 'ACTOR_SAFE_PROPOSAL_READ_UNAVAILABLE');
    }
    try {
      return validateReadReceipt(result, command);
    } catch {
      throw new IntegrationDisabledError(INTEGRATION, 'ACTOR_SAFE_PROPOSAL_READ_INVALID');
    }
  }

  async attachDecision(request) {
    const input = snapshotPlain(request, 'AI proposal decision request');
    assertExactObject(input, DECIDE_KEYS, 'AI proposal decision request');
    const caseId = assertIdentifier(input.caseId, 'caseId');
    const proposalId = assertIdentifier(input.proposalId, 'proposalId');
    const idempotencyKey = assertIdentifier(input.idempotencyKey, 'idempotencyKey');
    const requestHash = assertHash(input.requestHash, 'requestHash');
    const record = validateRecord(input.record, { expectedCaseId: caseId, expectedProposalId: proposalId });
    if (record.state !== 'decided' || record.decision === null) {
      throw new ValidationError('attachDecision requires one complete human decision');
    }
    const scope = await this.#scope(caseId, 'save');
    if (record.decision.facultyId !== scope.actorId) {
      throw new AuthorizationDeniedError('AI_PROPOSAL_DECIDER_SCOPE_MISMATCH');
    }
    const command = buildWriteCommand({
      store: this,
      operation: 'attach_decision',
      scope,
      caseId,
      proposalId,
      idempotencyKey,
      requestHash,
      record,
    });
    let result;
    try {
      result = await this.driver.attachDecisionIfUndecidedAtomic(structuredClone(command));
    } catch {
      throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_DECISION_PERSISTENCE_UNAVAILABLE');
    }
    try {
      return validateWriteReceipt(result, command);
    } catch (error) {
      if (
        error instanceof IdempotencyConflictError
        || error instanceof NotFoundError
        || error instanceof DomainInvariantError
      ) throw error;
      throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_DECISION_RECEIPT_INVALID');
    }
  }
}

export const SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT = deepFreeze({
  targetBinding: 'injected_validated_lor_target_binding',
  targetBindingSchema: LOR_TARGET_BINDING_CONTRACT.schemaVersion,
  targetBindingAuthority: LOR_TARGET_BINDING_CONTRACT.authority,
  defaultTarget: null,
  schema: LOR_TARGET_BINDING_CONTRACT.schema,
  proposalRecordSchema: AI_PROPOSAL_RECORD_SCHEMA,
  serverScopeSchema: SERVER_SCOPE_SCHEMA,
  driverCommandSchema: DRIVER_COMMAND_SCHEMA,
  writeReceiptSchema: WRITE_RECEIPT_SCHEMA,
  readReceiptSchema: READ_RECEIPT_SCHEMA,
  errorReceiptSchema: ERROR_RECEIPT_SCHEMA,
  reservationReceiptSchema: RESERVATION_RECEIPT_SCHEMA,
  scopeProviderRequest: deepFreeze({
    reserveProposalGeneration: ['caseId', "operation='save'"],
    finalizeProposalGeneration: ['caseId', "operation='save'"],
    markProposalGenerationUnknown: ['caseId', "operation='save'"],
    putProposal: ['caseId', "operation='save'"],
    getProposal: ['caseId', "operation='read'"],
    attachDecision: ['caseId', "operation='save'"],
  }),
  driverCapabilities: [
    'rlsEnforced',
    'serverOnly',
    'databaseClock',
    'actorSafeReads',
    'atomicProviderCallReservation',
    'atomicProviderRunAndProposal',
    'conditionalAtomicOneDecision',
  ],
  driverMethods: deepFreeze({
    reserveProposalGeneration: 'reserveAiProposalGenerationAtomic',
    finalizeProposalGeneration: 'persistProviderRunAndProposalAtomic',
    markProposalGenerationUnknown: 'markAiProposalGenerationUnknownAtomic',
    putProposal: 'persistProviderRunAndProposalAtomic',
    getProposal: 'readActorSafeAiProposal',
    attachDecision: 'attachDecisionIfUndecidedAtomic',
  }),
  writeCommandKeys: [...WRITE_COMMAND_KEYS].sort(),
  readCommandKeys: [...READ_COMMAND_KEYS].sort(),
  reservationCommandKeys: [...RESERVATION_COMMAND_KEYS].sort(),
  writeReceiptKeys: [...WRITE_RECEIPT_KEYS].sort(),
  readReceiptKeys: [...READ_RECEIPT_KEYS].sort(),
  errorReceiptKeys: [...ERROR_RECEIPT_KEYS].sort(),
  reservationReceiptKeys: [...RESERVATION_RECEIPT_KEYS].sort(),
  mappedErrorCodes: [
    'IDEMPOTENCY_CONFLICT',
    'NOT_FOUND',
    'AI_PROPOSAL_ALREADY_DECIDED',
    'CONCURRENT_DECISION_CONFLICT',
  ],
  publicMethods: [
    'reserveProposalGeneration',
    'finalizeProposalGeneration',
    'markProposalGenerationUnknown',
    'putProposal',
    'getProposal',
    'attachDecision',
  ],
  idempotency:
    'durable_case_actor_key_plus_request_hash_reserved_before_provider_with_no_unknown_retry',
  providerPersistence: 'winner_only_provider_call_then_provider_run_and_proposal_same_transaction',
  decisionPersistence: 'conditional_atomic_write_only_while_decision_is_null',
  reads: 'actor_safe_rls_projection_only',
  databaseTime: 'receipt_committedAt_from_database_clock',
});
