import crypto from 'node:crypto';
import { MmcHttpError } from '../trust/security.mjs';
import { parseStrictRfc3339 } from './timestamp-contract.mjs';
import { canonicalUuid } from './uuid-contract.mjs';

export const MMC_COMMAND_SCHEMA_VERSION = 1;

export const MMC_COMMAND_KINDS = Object.freeze([
  'task.upsert',
  'session.close',
  'review.decide',
  'identity.decide',
  'publication.approve',
  'job.enqueue',
  'student.respond',
]);

// This is the single wire vocabulary for student-authored responses. The
// publication DTO imports this exact list so command validation and readback
// cannot drift into near-synonyms that require unsafe adapter translation.
export const MMC_STUDENT_RESPONSE_KIND = Object.freeze(Object.fromEntries([
  'ACKNOWLEDGEMENT',
  'AGREEMENT',
  'CLARIFICATION_REQUEST',
  'DISPUTE',
  'SELF_REPORTED_COMPLETE',
  'BLOCKER_REPORT',
].map((kind) => [kind, kind])));

export const MMC_STUDENT_RESPONSE_KINDS = Object.freeze(Object.values(MMC_STUDENT_RESPONSE_KIND));

const COMMAND_FIELDS = Object.freeze([
  'commandId',
  'idempotencyKey',
  'expectedVersion',
  'targetId',
  'kind',
  'purpose',
  'payload',
  'schemaVersion',
]);

const AUTHORITY_FIELD_PATTERN = /^(?:tenant|tenantId|environment|principal|principalId|actor|actorId|role|capabilities|assignmentId|workloadId|queueName|issuer|audience)$/u;

export function validateCommandEnvelope(input) {
  assertPlainObject(input, 'command');
  assertExactFields(input, COMMAND_FIELDS, COMMAND_FIELDS);
  const command = {
    commandId: requireUuid(input.commandId, 'commandId'),
    idempotencyKey: requireOpaqueText(input.idempotencyKey, 'idempotencyKey', 8, 200),
    expectedVersion: requireNonNegativeInteger(input.expectedVersion, 'expectedVersion'),
    targetId: requireOpaqueId(input.targetId, 'targetId'),
    kind: requireEnum(input.kind, MMC_COMMAND_KINDS, 'kind'),
    purpose: requirePlainText(input.purpose, 'purpose', 3, 160),
    payload: validateCommandPayload(input.kind, input.payload),
    schemaVersion: requireExactInteger(input.schemaVersion, MMC_COMMAND_SCHEMA_VERSION, 'schemaVersion'),
  };
  assertNoAuthorityFields(command.payload);
  assertCommandTargetBinding(command);
  return deepFreeze(command);
}

export function semanticCommandHash(commandInput) {
  const command = validateCommandEnvelope(commandInput);
  const semantic = {
    expectedVersion: command.expectedVersion,
    kind: command.kind,
    payload: command.payload,
    purpose: command.purpose,
    schemaVersion: command.schemaVersion,
    targetId: command.targetId,
  };
  return crypto.createHash('sha256').update(canonicalJson(semantic)).digest('hex');
}

export function commandIdempotencyScope(commandInput, principal) {
  const command = validateCommandEnvelope(commandInput);
  const scope = {
    tenantId: requireOpaqueId(principal?.tenantId, 'principal.tenantId'),
    environment: requireEnum(principal?.environment, ['FIXTURE', 'LOCAL', 'STAGING', 'LIVE'], 'principal.environment'),
    principalId: requireOpaqueId(principal?.id, 'principal.id'),
    kind: command.kind,
    targetId: command.targetId,
    schemaVersion: command.schemaVersion,
    idempotencyKey: command.idempotencyKey,
  };
  return crypto.createHash('sha256').update(canonicalJson(scope)).digest('hex');
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function canonicalize(value, depth = 0) {
  if (depth > 32) {
    throw new MmcHttpError(422, 'COMMAND_NESTING_TOO_DEEP', 'The command payload is too deeply nested.');
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new MmcHttpError(422, 'COMMAND_NUMBER_INVALID', 'Command numbers must be finite.');
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry, depth + 1));
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new MmcHttpError(422, 'COMMAND_VALUE_INVALID', 'Command values must be plain JSON data.');
  }
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key], depth + 1)]));
}

function validateCommandPayload(kind, payload) {
  assertPlainObject(payload, 'payload');
  if (Buffer.byteLength(canonicalJson(payload), 'utf8') > 32 * 1024) {
    throw new MmcHttpError(413, 'COMMAND_PAYLOAD_TOO_LARGE', 'The semantic command payload is too large.');
  }

  if (kind === 'task.upsert') {
    assertExactFields(payload, ['title', 'details', 'dueAt', 'ownerType', 'status', 'sensitivity'], ['title', 'ownerType', 'status', 'sensitivity']);
    return compact({
      title: requirePlainText(payload.title, 'payload.title', 1, 300),
      details: optionalPlainText(payload.details, 'payload.details', 4000),
      dueAt: optionalRfc3339(payload.dueAt, 'payload.dueAt'),
      ownerType: requireEnum(payload.ownerType, ['MENTOR', 'STUDENT', 'SHARED'], 'payload.ownerType'),
      status: requireEnum(payload.status, ['DRAFT', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'], 'payload.status'),
      sensitivity: requireEnum(payload.sensitivity, ['NORMAL', 'RESTRICTED', 'SENSITIVE'], 'payload.sensitivity'),
    });
  }

  if (kind === 'session.close') {
    assertExactFields(payload, ['decisions', 'summary'], ['decisions']);
    if (!Array.isArray(payload.decisions) || payload.decisions.length > 100) {
      throw invalid('COMMAND_DECISIONS_INVALID', 'payload.decisions must contain at most 100 decisions.');
    }
    return compact({
      decisions: payload.decisions.map((decision, index) => validateReviewDecision(decision, `payload.decisions[${index}]`)),
      summary: optionalPlainText(payload.summary, 'payload.summary', 8000),
    });
  }

  if (kind === 'review.decide') {
    return validateReviewDecision(payload, 'payload');
  }

  if (kind === 'identity.decide') {
    assertExactFields(payload, ['candidateId', 'decision', 'evidenceEnvelopeIds', 'reason'], ['candidateId', 'decision', 'evidenceEnvelopeIds', 'reason']);
    if (!Array.isArray(payload.evidenceEnvelopeIds) || payload.evidenceEnvelopeIds.length < 1 || payload.evidenceEnvelopeIds.length > 20) {
      throw invalid('IDENTITY_EVIDENCE_REQUIRED', 'Identity decisions require one to twenty attested evidence envelope IDs.');
    }
    return {
      candidateId: requireOpaqueId(payload.candidateId, 'payload.candidateId'),
      decision: requireEnum(payload.decision, ['APPROVE_LOCAL_LINK', 'REJECT', 'REVOKE', 'REQUEST_EVIDENCE'], 'payload.decision'),
      evidenceEnvelopeIds: payload.evidenceEnvelopeIds.map((id, index) => requireOpaqueId(id, `payload.evidenceEnvelopeIds[${index}]`)),
      reason: requirePlainText(payload.reason, 'payload.reason', 3, 2000),
    };
  }

  if (kind === 'publication.approve') {
    assertExactFields(payload, ['publicationId', 'sourceVersionIds', 'policyVersionId'], ['publicationId', 'sourceVersionIds', 'policyVersionId']);
    if (!Array.isArray(payload.sourceVersionIds) || payload.sourceVersionIds.length < 1 || payload.sourceVersionIds.length > 200) {
      throw invalid('PUBLICATION_SOURCES_INVALID', 'Publication approval requires one to two hundred source versions.');
    }
    return {
      publicationId: requireOpaqueId(payload.publicationId, 'payload.publicationId'),
      sourceVersionIds: payload.sourceVersionIds.map((id, index) => requireOpaqueId(id, `payload.sourceVersionIds[${index}]`)),
      policyVersionId: requireOpaqueId(payload.policyVersionId, 'payload.policyVersionId'),
    };
  }

  if (kind === 'job.enqueue') {
    assertExactFields(payload, ['jobKind', 'assetHandle', 'authorityGrantId', 'policyVersionId'], ['jobKind', 'assetHandle', 'authorityGrantId']);
    return compact({
      jobKind: requireEnum(payload.jobKind, [
        'SOURCE_DISCOVERY', 'ASSET_ACQUISITION', 'TRANSCRIPT_PROCESSING',
        'AI_ANALYSIS', 'PUBLICATION_RENDER', 'RECONCILIATION',
      ], 'payload.jobKind'),
      assetHandle: requireOpaqueId(payload.assetHandle, 'payload.assetHandle'),
      authorityGrantId: requireOpaqueId(payload.authorityGrantId, 'payload.authorityGrantId'),
      policyVersionId: payload.policyVersionId ? requireOpaqueId(payload.policyVersionId, 'payload.policyVersionId') : undefined,
    });
  }

  if (kind === 'student.respond') {
    assertExactFields(payload, ['publicationId', 'itemId', 'response', 'comment'], ['publicationId', 'itemId', 'response']);
    const response = requireEnum(payload.response, MMC_STUDENT_RESPONSE_KINDS, 'payload.response');
    const requiresComment = !['ACKNOWLEDGEMENT', 'AGREEMENT'].includes(response);
    if (requiresComment && !Object.hasOwn(payload, 'comment')) {
      throw invalid('STUDENT_RESPONSE_COMMENT_REQUIRED', 'This student response kind requires a comment.');
    }
    if (!requiresComment && Object.hasOwn(payload, 'comment')) {
      throw invalid('STUDENT_RESPONSE_COMMENT_FORBIDDEN', 'This student response kind does not accept a comment.');
    }
    return compact({
      publicationId: requireOpaqueId(payload.publicationId, 'payload.publicationId'),
      itemId: requireOpaqueId(payload.itemId, 'payload.itemId'),
      response,
      comment: optionalPlainText(payload.comment, 'payload.comment', 4000),
    });
  }

  throw invalid('COMMAND_KIND_UNSUPPORTED', 'The command kind is not supported.');
}

function assertCommandTargetBinding(command) {
  const payloadTargetByKind = {
    'review.decide': command.payload.proposalId,
    'identity.decide': command.payload.candidateId,
    'publication.approve': command.payload.publicationId,
    'student.respond': command.payload.publicationId,
  };
  const payloadTarget = payloadTargetByKind[command.kind];
  if (payloadTarget !== undefined && payloadTarget !== command.targetId) {
    throw invalid(
      'COMMAND_TARGET_BINDING_MISMATCH',
      `targetId must exactly match the typed ${command.kind} payload target.`,
    );
  }
}

function validateReviewDecision(input, label) {
  assertPlainObject(input, label);
  assertExactFields(input, ['proposalId', 'decision', 'editedText', 'rationale', 'policyVersionId'], ['proposalId', 'decision', 'rationale', 'policyVersionId']);
  return compact({
    proposalId: requireOpaqueId(input.proposalId, `${label}.proposalId`),
    decision: requireEnum(input.decision, ['ACCEPT', 'REJECT', 'DEFER', 'REQUEST_EVIDENCE'], `${label}.decision`),
    editedText: optionalPlainText(input.editedText, `${label}.editedText`, 8000),
    rationale: requirePlainText(input.rationale, `${label}.rationale`, 3, 2000),
    policyVersionId: requireOpaqueId(input.policyVersionId, `${label}.policyVersionId`),
  });
}

function assertNoAuthorityFields(value, path = 'payload') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoAuthorityFields(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (AUTHORITY_FIELD_PATTERN.test(key)) {
      throw invalid('CLIENT_AUTHORITY_FIELD_FORBIDDEN', `${path}.${key} is server-derived and cannot be supplied by a client.`);
    }
    assertNoAuthorityFields(entry, `${path}.${key}`);
  }
}

function assertExactFields(value, allowed, required) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknown.length) throw invalid('UNKNOWN_COMMAND_FIELD', `Unknown command field: ${unknown[0]}.`);
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (missing.length) throw invalid('COMMAND_FIELD_REQUIRED', `Missing command field: ${missing[0]}.`);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw invalid('COMMAND_OBJECT_REQUIRED', `${label} must be a plain JSON object.`);
  }
}

function requireUuid(value, label) {
  const text = canonicalUuid(value);
  if (!text) {
    throw invalid('COMMAND_UUID_INVALID', `${label} must be a UUID.`);
  }
  return text;
}

function requireOpaqueId(value, label) {
  return requireOpaqueText(value, label, 3, 200);
}

function requireOpaqueText(value, label, min, max) {
  if (typeof value !== 'string') {
    throw invalid('COMMAND_IDENTIFIER_INVALID', `${label} is invalid.`);
  }
  const text = value.trim();
  if (text.length < min || text.length > max || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u.test(text)) {
    throw invalid('COMMAND_IDENTIFIER_INVALID', `${label} is invalid.`);
  }
  return text;
}

function requirePlainText(value, label, min, max) {
  if (typeof value !== 'string') throw invalid('COMMAND_TEXT_INVALID', `${label} must be text.`);
  const text = value.normalize('NFC').replace(/\r\n?/gu, '\n').trim();
  if (text.length < min || text.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) {
    throw invalid('COMMAND_TEXT_INVALID', `${label} is outside the allowed text boundary.`);
  }
  return text;
}

function optionalPlainText(value, label, max) {
  if (value == null || value === '') return undefined;
  return requirePlainText(value, label, 1, max);
}

function optionalRfc3339(value, label) {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/u.test(value)) {
    throw invalid('COMMAND_TIMESTAMP_INVALID', `${label} must be an RFC3339 UTC timestamp.`);
  }
  const milliseconds = parseStrictRfc3339(value);
  if (milliseconds === null) throw invalid('COMMAND_TIMESTAMP_INVALID', `${label} is invalid.`);
  return new Date(milliseconds).toISOString();
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw invalid('COMMAND_VERSION_INVALID', `${label} must be a non-negative integer.`);
  return value;
}

function requireExactInteger(value, expected, label) {
  if (value !== expected) throw invalid('COMMAND_SCHEMA_VERSION_UNSUPPORTED', `${label} must equal ${expected}.`);
  return value;
}

function requireEnum(value, allowed, label) {
  const text = String(value || '').trim();
  if (!allowed.includes(text)) throw invalid('COMMAND_ENUM_INVALID', `${label} is invalid.`);
  return text;
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

function invalid(code, message) {
  return new MmcHttpError(422, code, message);
}
