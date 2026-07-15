import {
  FEATURE_FLAG_KEYS,
  GOVERNANCE_SLOTS,
  RELEASE_RESTRICTED_FEATURE_FLAG_KEYS,
  RELEASE_TRANSITIONS,
  REVISION_TRANSITIONS,
  WORKFLOW_MANAGED_ENTITY_TYPES,
} from './contracts.mjs';
import {
  AuthorizationError,
  requireAnyRole,
  requireRead,
  requireRole,
  requireTrustedFinalizationContext,
  requireWrite,
} from './auth.mjs';
import {
  assertPostAnswerAccess,
  buildReleaseArtifacts,
  projectDrillsAdapter,
  scanForAnswerLeak,
} from './exports.mjs';
import { deterministicId, sha256 } from './hash.mjs';
import { MemoryRepository } from './store.mjs';

const LOCAL_SYNTHETIC_CAPABILITY = Symbol('local_synthetic_capability');
const SHA256_HEX = /^[0-9a-f]{64}$/u;
const LOCKED_OFF_FLAGS = new Set(RELEASE_RESTRICTED_FEATURE_FLAG_KEYS);
const REVIEWER_ROLES = new Set(['editorial_reviewer', 'physician_reviewer']);
const REVISION_FIELDS = new Set([
  'item_id',
  'concept_id',
  'source_ids',
  'evidence_claim_ids',
  'prompt',
  'choices',
  'answer',
  'explanation',
  'correct_answer_rationale',
  'topic',
  'subtopic',
  'lineage',
  'export_question_id',
  'drills',
]);
const CHOICE_FIELDS = new Set([
  'key',
  'text',
  'why_tempting',
  'why_wrong',
  'misconception_id',
]);
const DRILLS_FIELDS = new Set([
  'video_id',
  'source_record_id',
  'title',
  'playback',
  'nodes',
  'transcript',
  'vtt',
  'timestamp',
  'rights_status',
  'privacy_status',
  'source_hash',
  'working_hash',
]);
const DRILLS_ASSET_FIELDS = new Set(['availability', 'url']);
const DRILLS_PLAYBACK_FIELDS = new Set(['availability', 'url', 'stream_id']);
const DRILLS_TIMESTAMP_FIELDS = new Set(['start_seconds', 'end_seconds']);
const REVIEWER_FIELDS = new Set([
  'actor_id',
  'display_name',
  'roles',
  'credential',
  'delegated_by_actor_id',
  'conflict_actor_ids',
]);
const REVIEW_ASSIGNMENT_FIELDS = new Set([
  'item_revision_id',
  'reviewer_id',
  'review_type',
  'exact_revision_hash',
]);
const REVIEW_EVENT_FIELDS = new Set([
  'item_revision_id',
  'reviewer_id',
  'assignment_id',
  'review_type',
  'exact_revision_hash',
  'verdict',
  'to_status',
  'structured_findings',
]);
const ANSWER_FIELD_KEYS = new Set([
  'answer',
  'answers',
  'answeralias',
  'answeraliases',
  'answerkey',
  'answermap',
  'answertimestamp',
  'correctanswer',
  'correctanswerrationale',
  'correctchoice',
  'correctchoicekey',
  'correctkey',
  'correctness',
  'correctoption',
  'detectedanswerwording',
  'distractorcorrectness',
  'distractorrationale',
  'distractorrationales',
  'explanation',
  'explanations',
  'iscorrect',
  'rationale',
  'rationales',
  'solution',
  'solutionkey',
  'solutions',
  'whytempting',
  'whywrong',
]);
const PRIVATE_SOURCE_FIELD_KEYS = new Set([
  'privatestorage',
  'privatestorageref',
  'privatesourceurl',
  'rawsource',
  'rawtext',
  'rawtranscript',
  'sourcecontent',
  'sourcewording',
  'storagecredential',
  'storageref',
  'transcriptpayload',
]);

function policy(roles, fields) {
  return Object.freeze({ roles: Object.freeze(roles), fields: new Set(fields) });
}

const GENERIC_CREATE_POLICIES = Object.freeze({
  concepts: policy(
    ['platform_admin', 'content_operator', 'author'],
    ['title', 'description', 'taxonomy_version_id', 'tags'],
  ),
  variant_groups: policy(
    ['platform_admin', 'content_operator', 'author'],
    ['concept_id', 'form', 'description'],
  ),
  items: policy(
    ['platform_admin', 'content_operator', 'author'],
    ['variant_group_id', 'item_type', 'external_reference'],
  ),
  inventory_sources: policy(
    ['platform_admin', 'content_operator', 'system'],
    [
      'canonical_video_id',
      'title',
      'transcript_available',
      'vtt_available',
      'nodes_available',
      'duration_seconds',
      'published_at',
    ],
  ),
  batch_jobs: policy(
    ['platform_admin', 'content_operator', 'system'],
    ['job_type', 'input_manifest_hash', 'requested_count'],
  ),
  job_checkpoints: policy(
    ['content_operator', 'system'],
    ['batch_job_id', 'cursor', 'processed_count', 'failed_count'],
  ),
});

const GENERIC_UPDATE_POLICIES = Object.freeze({
  concepts: policy(
    ['platform_admin', 'content_operator', 'author'],
    ['title', 'description', 'tags'],
  ),
  variant_groups: policy(
    ['platform_admin', 'content_operator', 'author'],
    ['description'],
  ),
  items: policy(
    ['platform_admin', 'content_operator', 'author'],
    ['external_reference'],
  ),
  inventory_sources: policy(
    ['platform_admin', 'content_operator', 'system'],
    [
      'title',
      'transcript_available',
      'vtt_available',
      'nodes_available',
      'duration_seconds',
      'published_at',
    ],
  ),
});

function assert(condition, code, statusCode = 422) {
  if (!condition) {
    const error = new Error(code);
    error.code = code;
    error.statusCode = statusCode;
    throw error;
  }
}

function unique(values) {
  return [...new Set(values)];
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedKey(key) {
  return String(key).replace(/[^a-z0-9]/giu, '').toLowerCase();
}

function redactKeys(value, forbiddenKeys) {
  if (Array.isArray(value)) {
    return value.map((entry) => redactKeys(entry, forbiddenKeys));
  }
  if (!isRecord(value)) {
    return value;
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalized = normalizedKey(key);
    const answerAlias = forbiddenKeys === ANSWER_FIELD_KEYS && (
      normalized.startsWith('answer')
      || normalized.startsWith('correct')
      || normalized.startsWith('solution')
      || normalized.includes('explanation')
      || normalized.includes('rationale')
    );
    if (!forbiddenKeys.has(normalized) && !answerAlias) {
      result[key] = redactKeys(entry, forbiddenKeys);
    }
  }
  return result;
}

function allowlistedPayload(payload, fields, { allowEmpty = false } = {}) {
  assert(isRecord(payload), 'request_payload_required');
  const keys = Object.keys(payload);
  if (!allowEmpty) {
    assert(keys.length > 0, 'request_payload_required');
  }
  if (keys.some((key) => !fields.has(key))) {
    throw new AuthorizationError('request_fields_not_allowed');
  }
  return structuredClone(payload);
}

function assertGenericFieldShapes(payload) {
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'tags') {
      assert(Array.isArray(value) && value.every((entry) => typeof entry === 'string'), 'request_payload_invalid');
      continue;
    }
    if (isRecord(value) || Array.isArray(value)) {
      throw new AuthorizationError('request_fields_not_allowed');
    }
  }
}

function currentMedicalCredential(reviewer, now = Date.now()) {
  const expiresAt = Date.parse(reviewer?.credential?.expires_at || '');
  return Boolean(
    reviewer?.roles?.includes('physician_reviewer')
    && ['md', 'do'].includes(reviewer?.credential?.type)
    && reviewer?.credential?.status === 'verified'
    && String(reviewer?.credential?.verification_id || '').trim()
    && Number.isFinite(expiresAt)
    && expiresAt > now,
  );
}

function stableExportQuestionId(payload, revisionNumber) {
  if (payload.export_question_id !== undefined) {
    assert(
      typeof payload.export_question_id === 'string'
      && payload.export_question_id.length > 0
      && payload.export_question_id === payload.export_question_id.trim(),
      'export_question_id_required',
    );
    return payload.export_question_id;
  }
  return `I1Q-${sha256({ item_id: payload.item_id, revision_number: revisionNumber }).slice(0, 16).toUpperCase()}`;
}

function validateRevisionPayload(payload) {
  const revision = allowlistedPayload(payload, REVISION_FIELDS);
  assert(String(revision.prompt || '').trim(), 'revision_prompt_required');
  assert(Array.isArray(revision.choices) && revision.choices.length === 4, 'exactly_four_choices_required');
  for (const choice of revision.choices) {
    allowlistedPayload(choice, CHOICE_FIELDS);
  }
  const keys = revision.choices.map((choice) => choice.key);
  assert(keys.join(',') === 'A,B,C,D', 'choice_keys_must_be_A_through_D');
  assert(revision.choices.every((choice) => String(choice.text || '').trim()), 'choice_text_required');
  assert(unique(revision.choices.map((choice) => choice.text.trim().toLowerCase())).length === 4, 'choices_must_be_distinct');
  assert(['A', 'B', 'C', 'D'].includes(revision.answer), 'valid_answer_required');
  assert(String(revision.explanation || '').trim(), 'explanation_required');
  assert(String(revision.correct_answer_rationale || '').trim(), 'correct_answer_rationale_required');
  const distractors = revision.choices.filter((choice) => choice.key !== revision.answer);
  assert(distractors.every((choice) => choice.why_tempting && choice.why_wrong && choice.misconception_id), 'distractor_rationale_required');
  assert(Array.isArray(revision.source_ids) && revision.source_ids.length > 0, 'source_lineage_required');
  assert(Array.isArray(revision.evidence_claim_ids) && revision.evidence_claim_ids.length > 0, 'evidence_claims_required');
  assert(revision.source_ids.every((id) => typeof id === 'string' && id.trim()), 'source_lineage_required');
  assert(revision.evidence_claim_ids.every((id) => typeof id === 'string' && id.trim()), 'evidence_claims_required');
  assert(String(revision.concept_id || '').trim(), 'concept_id_required');
  assert(String(revision.item_id || '').trim(), 'item_id_required');
  assert(isRecord(revision.drills), 'drills_projection_required');
  revision.drills = allowlistedPayload(revision.drills, DRILLS_FIELDS);
  assert(isRecord(revision.drills.playback), 'playback_availability_required');
  revision.drills.playback = allowlistedPayload(revision.drills.playback, DRILLS_PLAYBACK_FIELDS);
  for (const field of ['nodes', 'transcript', 'vtt']) {
    assert(isRecord(revision.drills[field]), `${field}_availability_required`);
    revision.drills[field] = allowlistedPayload(revision.drills[field], DRILLS_ASSET_FIELDS);
  }
  assert(isRecord(revision.drills.timestamp), 'timestamp_linkage_required');
  revision.drills.timestamp = allowlistedPayload(revision.drills.timestamp, DRILLS_TIMESTAMP_FIELDS);
  projectDrillsAdapter({
    revision: { ...revision, id: 'itemrev_validation' },
    releaseId: 'release_validation',
  });
  return revision;
}

function validateReviewFindings(findings) {
  if (findings === undefined) {
    return {};
  }
  assert(isRecord(findings), 'structured_findings_invalid');
  return structuredClone(findings);
}

export class QuestionPlatform {
  #repository;
  #governance;
  #idempotency = new Map();
  #credentialVerifier;
  #publicationRatificationVerifier;
  #syntheticDemo;

  constructor({
    repository = new MemoryRepository(),
    credentialVerifier = null,
    publicationRatificationVerifier = null,
    localSyntheticCapability = null,
  } = {}) {
    assert(credentialVerifier === null || typeof credentialVerifier === 'function', 'credential_verifier_invalid', 500);
    assert(
      publicationRatificationVerifier === null || typeof publicationRatificationVerifier === 'function',
      'publication_ratification_verifier_invalid',
      500,
    );
    this.#repository = repository;
    this.#credentialVerifier = credentialVerifier;
    this.#publicationRatificationVerifier = publicationRatificationVerifier;
    this.#syntheticDemo = localSyntheticCapability === LOCAL_SYNTHETIC_CAPABILITY;
    this.#governance = Object.fromEntries(GOVERNANCE_SLOTS.map((slot) => [slot, null]));
  }

  get repository() {
    return this.#repository;
  }

  get syntheticDemo() {
    return this.#syntheticDemo;
  }

  governance(actorInput) {
    requireRead(actorInput);
    return structuredClone(this.#governance);
  }

  assignGovernanceSlot(slot, reviewerId, actorInput) {
    const actor = requireRole(actorInput, 'platform_admin');
    assert(GOVERNANCE_SLOTS.includes(slot), 'unknown_governance_slot');
    assert(this.#repository.has('reviewers', reviewerId), 'reviewer_not_found');
    const reviewer = this.#repository.get('reviewers', reviewerId);
    if (slot === 'medical_governance_lead') {
      assert(currentMedicalCredential(reviewer), 'medical_governance_credential_not_verified');
    }
    this.#governance[slot] = reviewerId;
    this.#repository.appendAudit({
      actor_id: actor.id,
      action: 'governance_slot_assigned',
      entity_type: 'reviewers',
      entity_id: reviewerId,
    });
    return this.governance(actor);
  }

  executeIdempotent(key, actorInput, operation, scope = 'operation') {
    const actor = requireWrite(actorInput);
    assert(String(key || '').trim(), 'idempotency_key_required');
    const scopedKey = `${actor.id}:${scope}:${key}`;
    if (this.#idempotency.has(scopedKey)) {
      return structuredClone(this.#idempotency.get(scopedKey));
    }
    const result = operation(actor);
    this.#idempotency.set(scopedKey, structuredClone(result));
    this.#repository.create('api_idempotency_keys', {
      actor_id: actor.id,
      request_key_hash: sha256(scopedKey),
      response_hash: sha256(result),
      state: 'completed',
    }, { actorId: actor.id });
    return structuredClone(result);
  }

  create(entityType, payload, actorInput, options = {}) {
    assert(!WORKFLOW_MANAGED_ENTITY_TYPES.has(entityType), 'workflow_endpoint_required');
    const resourcePolicy = GENERIC_CREATE_POLICIES[entityType];
    if (!resourcePolicy) {
      throw new AuthorizationError('generic_create_forbidden');
    }
    const actor = requireAnyRole(actorInput, resourcePolicy.roles);
    const permittedPayload = allowlistedPayload(payload, resourcePolicy.fields);
    assertGenericFieldShapes(permittedPayload);
    const operation = () => this.#repository.create(entityType, permittedPayload, {
      id: options.id,
      actorId: actor.id,
    });
    const result = options.idempotencyKey
      ? this.executeIdempotent(options.idempotencyKey, actor, operation, `generic_create:${entityType}`)
      : operation();
    return this.#sanitizeResource(entityType, result, actor);
  }

  list(entityType, query, actorInput) {
    const actor = requireRead(actorInput);
    if (entityType === 'channel_artifacts') {
      throw new AuthorizationError('protected_route_required');
    }
    if (entityType === 'api_idempotency_keys') {
      requireAnyRole(actor, ['platform_admin', 'release_manager', 'system']);
    }
    if (entityType === 'export_validation_results') {
      requireAnyRole(actor, ['release_manager', 'system']);
    }
    if (entityType === 'audit_events') {
      requireAnyRole(actor, ['platform_admin', 'incident_owner', 'system']);
    }
    const page = this.#repository.list(entityType, query);
    return { ...page, rows: page.rows.map((row) => this.#sanitizeResource(entityType, row, actor)) };
  }

  get(entityType, id, actorInput) {
    const actor = requireRead(actorInput);
    if (entityType === 'channel_artifacts') {
      throw new AuthorizationError('protected_route_required');
    }
    if (entityType === 'api_idempotency_keys') {
      requireAnyRole(actor, ['platform_admin', 'release_manager', 'system']);
    }
    if (entityType === 'export_validation_results') {
      requireAnyRole(actor, ['release_manager', 'system']);
    }
    if (entityType === 'audit_events') {
      requireAnyRole(actor, ['platform_admin', 'incident_owner', 'system']);
    }
    return this.#sanitizeResource(entityType, this.#repository.get(entityType, id), actor);
  }

  update(entityType, id, patch, actorInput, options = {}) {
    assert(!WORKFLOW_MANAGED_ENTITY_TYPES.has(entityType), 'workflow_endpoint_required');
    const resourcePolicy = GENERIC_UPDATE_POLICIES[entityType];
    if (!resourcePolicy) {
      throw new AuthorizationError('generic_update_forbidden');
    }
    const actor = requireAnyRole(actorInput, resourcePolicy.roles);
    const permittedPatch = allowlistedPayload(patch, resourcePolicy.fields);
    assertGenericFieldShapes(permittedPatch);
    assert(String(options.expectedHash || '').trim(), 'optimistic_lock_required');
    const updated = this.#repository.update(entityType, id, permittedPatch, {
      actorId: actor.id,
      expectedHash: options.expectedHash,
    });
    return this.#sanitizeResource(entityType, updated, actor);
  }

  #credentialFor(payload) {
    const claim = isRecord(payload.credential) ? structuredClone(payload.credential) : {};
    if (!payload.roles.includes('physician_reviewer')) {
      return Object.freeze({ type: 'editorial', status: 'not_applicable' });
    }

    const claimedType = ['md', 'do'].includes(claim.type) ? claim.type : 'unverified_medical';
    const unverified = Object.freeze({
      type: claimedType,
      status: 'unverified',
      verification_id: null,
      verified_at: null,
      expires_at: null,
    });
    if (!this.#credentialVerifier || !['md', 'do'].includes(claimedType)) {
      return unverified;
    }

    let result;
    try {
      result = this.#credentialVerifier(Object.freeze({
        subject_actor_id: payload.actor_id,
        claimed_credential: Object.freeze(claim),
      }));
    } catch {
      return unverified;
    }
    if (!isRecord(result) || typeof result.then === 'function') {
      return unverified;
    }

    const verifiedAt = Date.parse(result.verified_at || '');
    const expiresAt = Date.parse(result.expires_at || '');
    const now = Date.parse(this.#repository.now());
    if (
      result.verified !== true
      || result.subject_actor_id !== payload.actor_id
      || result.type !== claimedType
      || !String(result.verification_id || '').trim()
      || !Number.isFinite(verifiedAt)
      || verifiedAt > now + 30_000
      || !Number.isFinite(expiresAt)
      || expiresAt <= now
    ) {
      return unverified;
    }
    return Object.freeze({
      type: result.type,
      status: 'verified',
      verification_id: String(result.verification_id),
      verified_at: new Date(verifiedAt).toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
    });
  }

  registerReviewer(payload, actorInput, { id } = {}) {
    const actor = requireRole(actorInput, 'platform_admin');
    const reviewerInput = allowlistedPayload(payload, REVIEWER_FIELDS);
    assert(Array.isArray(reviewerInput.roles) && reviewerInput.roles.length > 0, 'reviewer_roles_required');
    const roles = unique(reviewerInput.roles);
    assert(roles.every((role) => REVIEWER_ROLES.has(role)), 'reviewer_roles_invalid');
    assert(typeof reviewerInput.actor_id === 'string' && reviewerInput.actor_id.trim(), 'reviewer_actor_required');
    assert(typeof reviewerInput.display_name === 'string' && reviewerInput.display_name.trim(), 'reviewer_display_name_required');
    const conflicts = unique(Array.isArray(reviewerInput.conflict_actor_ids)
      ? reviewerInput.conflict_actor_ids.filter((value) => typeof value === 'string' && value.trim())
      : []);
    const normalized = {
      actor_id: reviewerInput.actor_id.trim(),
      display_name: reviewerInput.display_name.trim(),
      roles,
      credential: this.#credentialFor({ ...reviewerInput, roles }),
      delegated_by_actor_id: typeof reviewerInput.delegated_by_actor_id === 'string'
        ? reviewerInput.delegated_by_actor_id.trim() || null
        : null,
      conflict_actor_ids: conflicts,
    };
    return this.#repository.create('reviewers', normalized, { id, actorId: actor.id });
  }

  setFeatureFlag(key, enabled, scope, actorInput) {
    const actor = requireRole(actorInput, 'platform_admin');
    assert(FEATURE_FLAG_KEYS.includes(key), 'unknown_feature_flag');
    if (Boolean(enabled) && LOCKED_OFF_FLAGS.has(key)) {
      throw new AuthorizationError('feature_flag_locked_off');
    }
    const existing = this.#repository.list('feature_flags', {
      predicate: (row) => row.key === key,
      limit: 1,
    }).rows[0];
    if (existing) {
      return this.#repository.update('feature_flags', existing.id, {
        enabled: Boolean(enabled),
        scope: structuredClone(scope || {}),
        changed_by: actor.id,
      }, { actorId: actor.id, expectedHash: existing.content_hash });
    }
    return this.#repository.create('feature_flags', {
      key,
      enabled: Boolean(enabled),
      scope: structuredClone(scope || {}),
      changed_by: actor.id,
    }, { actorId: actor.id });
  }

  #sanitizeResource(entityType, row, actor) {
    let sanitized = structuredClone(row);
    if (entityType === 'item_revisions') {
      sanitized.choices = Array.isArray(sanitized.choices)
        ? sanitized.choices.map((choice) => ({ key: choice.key, text: choice.text }))
        : [];
    }
    sanitized = redactKeys(sanitized, ANSWER_FIELD_KEYS);

    const canReadPrivateSources = actor.roles.some((role) => ['platform_admin', 'privacy_officer', 'system'].includes(role));
    if (!canReadPrivateSources) {
      sanitized = redactKeys(sanitized, PRIVATE_SOURCE_FIELD_KEYS);
      if (entityType === 'item_revisions') {
        delete sanitized.drills;
      }
      if (entityType === 'transcript_artifacts') {
        for (const key of ['segments', 'transcript', 'vtt', 'nodes', 'payload', 'text']) {
          delete sanitized[key];
        }
      }
      if (entityType === 'normalized_transcript_segments') {
        for (const key of ['text', 'raw_text', 'redacted_text', 'source_wording', 'detected_answer_wording']) {
          delete sanitized[key];
        }
      }
    }
    if (entityType === 'reviewers' && !actor.roles.some((role) => ['platform_admin', 'system'].includes(role))) {
      if (sanitized.credential) {
        sanitized.credential = {
          type: sanitized.credential.type,
          status: sanitized.credential.status,
        };
      }
    }
    return sanitized;
  }

  createRevision(payload, actorInput, { idempotencyKey } = {}) {
    const actor = requireRole(actorInput, 'author');
    const revisionPayload = validateRevisionPayload(payload);
    assert(this.#repository.has('items', revisionPayload.item_id), 'item_not_found');
    assert(this.#repository.has('concepts', revisionPayload.concept_id), 'concept_not_found');
    for (const sourceId of revisionPayload.source_ids) {
      assert(this.#repository.has('source_records', sourceId), 'source_not_found');
    }
    for (const claimId of revisionPayload.evidence_claim_ids) {
      assert(this.#repository.has('evidence_claims', claimId), 'claim_not_found');
    }
    assert(
      revisionPayload.source_ids.includes(revisionPayload.drills.source_record_id),
      'drills_source_record_mismatch',
    );
    const drillsSource = this.#repository.get('source_records', revisionPayload.drills.source_record_id);
    assert(drillsSource.source_hash === revisionPayload.drills.source_hash, 'drills_source_hash_mismatch');
    const revisionNumber = this.#repository.list('item_revisions', {
      predicate: (row) => row.item_id === revisionPayload.item_id,
      limit: 200,
    }).total + 1;
    const exportQuestionId = stableExportQuestionId(revisionPayload, revisionNumber);
    assert(this.#repository.list('item_revisions', {
      predicate: (row) => row.export_question_id === exportQuestionId,
      limit: 1,
    }).total === 0, 'duplicate_export_question_id');
    const revision = {
      ...revisionPayload,
      export_question_id: exportQuestionId,
      author_actor_id: actor.id,
      revision_number: revisionNumber,
      workflow_status: 'draft',
      medical_validation_status: 'AI_DRAFT_NOT_MEDICALLY_VALIDATED',
    };
    return this.executeIdempotent(
      idempotencyKey || deterministicId('revision_request', revision),
      actor,
      () => this.#repository.create('item_revisions', revision, { actorId: actor.id }),
      'item_revision_create',
    );
  }

  #assertNoReviewConflict(reviewer, revision) {
    assert(revision.author_actor_id !== reviewer.actor_id, 'self_review_forbidden');
    assert(reviewer.delegated_by_actor_id !== revision.author_actor_id, 'indirect_self_review_forbidden');
    assert(!reviewer.conflict_actor_ids?.includes(revision.author_actor_id), 'reviewer_conflict_forbidden');
  }

  createReviewAssignment(payload, actorInput) {
    const assignmentInput = allowlistedPayload(payload, REVIEW_ASSIGNMENT_FIELDS);
    assert(['editorial', 'medical'].includes(assignmentInput.review_type), 'invalid_review_type');
    const actor = assignmentInput.review_type === 'medical'
      ? requireRole(actorInput, 'platform_admin')
      : requireAnyRole(actorInput, ['platform_admin', 'editorial_reviewer']);
    assert(this.#repository.has('item_revisions', assignmentInput.item_revision_id), 'revision_not_found');
    assert(this.#repository.has('reviewers', assignmentInput.reviewer_id), 'reviewer_not_found');
    const revision = this.#repository.get('item_revisions', assignmentInput.item_revision_id);
    const reviewer = this.#repository.get('reviewers', assignmentInput.reviewer_id);
    const requiredRole = assignmentInput.review_type === 'medical' ? 'physician_reviewer' : 'editorial_reviewer';
    assert(reviewer.roles?.includes(requiredRole), 'reviewer_role_mismatch');
    this.#assertNoReviewConflict(reviewer, revision);
    if (assignmentInput.review_type === 'medical') {
      assert(currentMedicalCredential(reviewer), 'physician_credential_not_verified');
    }
    if (assignmentInput.exact_revision_hash !== undefined) {
      assert(assignmentInput.exact_revision_hash === revision.content_hash, 'assignment_revision_hash_mismatch');
    }
    assert(this.#repository.list('review_assignments', {
      predicate: (row) => row.item_revision_id === revision.id
        && row.review_type === assignmentInput.review_type
        && row.state === 'accepted',
      limit: 1,
    }).total === 0, 'active_assignment_exists');
    return this.#repository.create('review_assignments', {
      item_revision_id: revision.id,
      reviewer_id: reviewer.id,
      reviewer_actor_id: reviewer.actor_id,
      review_type: assignmentInput.review_type,
      required_role: requiredRole,
      exact_revision_hash: revision.content_hash,
      credential_status: reviewer.credential?.status || 'not_applicable',
      credential_verification_id: reviewer.credential?.verification_id || null,
      state: 'accepted',
      assigned_by: actor.id,
    }, { actorId: actor.id });
  }

  revisionStatus(itemRevisionId) {
    const revision = this.#repository.get('item_revisions', itemRevisionId);
    const events = this.#repository.list('review_events', {
      predicate: (event) => event.item_revision_id === itemRevisionId,
      limit: 200,
    }).rows.sort((a, b) => a.sequence - b.sequence);
    return events.at(-1)?.to_status || revision.workflow_status;
  }

  submitReviewEvent(payload, actorInput) {
    const eventInput = allowlistedPayload(payload, REVIEW_EVENT_FIELDS);
    const actor = requireWrite(actorInput);
    assert(['editorial', 'medical'].includes(eventInput.review_type), 'invalid_review_type');
    const revision = this.#repository.get('item_revisions', eventInput.item_revision_id);
    const reviewer = this.#repository.get('reviewers', eventInput.reviewer_id);
    const assignment = this.#repository.get('review_assignments', eventInput.assignment_id);
    const requiredRole = eventInput.review_type === 'medical' ? 'physician_reviewer' : 'editorial_reviewer';

    assert(reviewer.actor_id === actor.id, 'reviewer_actor_mismatch');
    assert(actor.roles.includes(requiredRole), 'reviewer_role_mismatch');
    assert(reviewer.roles?.includes(requiredRole), 'reviewer_role_mismatch');
    this.#assertNoReviewConflict(reviewer, revision);
    assert(assignment.item_revision_id === revision.id, 'assignment_revision_mismatch');
    assert(assignment.reviewer_id === reviewer.id, 'assignment_reviewer_mismatch');
    assert(assignment.reviewer_actor_id === actor.id, 'assignment_actor_mismatch');
    assert(assignment.review_type === eventInput.review_type, 'assignment_type_mismatch');
    assert(assignment.required_role === requiredRole, 'assignment_role_mismatch');
    assert(assignment.exact_revision_hash === revision.content_hash, 'assignment_revision_hash_mismatch');
    assert(assignment.state === 'accepted', 'assignment_not_active');
    if (eventInput.exact_revision_hash !== undefined) {
      assert(eventInput.exact_revision_hash === revision.content_hash, 'review_revision_hash_mismatch');
    }

    const fromStatus = this.revisionStatus(revision.id);
    assert((REVISION_TRANSITIONS[fromStatus] || []).includes(eventInput.to_status), 'illegal_revision_transition');
    assert(['pass', 'fail', 'changes_requested'].includes(eventInput.verdict), 'review_verdict_invalid');

    if (eventInput.review_type === 'editorial') {
      assert(eventInput.to_status !== 'approved', 'editorial_cannot_medically_approve');
    } else {
      assert(fromStatus === 'medical_review', 'medical_review_requires_editorial_pass');
      assert(currentMedicalCredential(reviewer), 'physician_credential_not_verified');
      assert(assignment.credential_status === 'verified', 'assignment_credential_not_verified');
      assert(
        assignment.credential_verification_id === reviewer.credential.verification_id,
        'assignment_credential_mismatch',
      );
      if (eventInput.to_status === 'approved') {
        assert(this.#governance.medical_governance_lead !== null, 'medical_governance_lead_unassigned');
        assert(eventInput.verdict === 'pass', 'medical_pass_required');
      }
    }

    const sequence = this.#repository.list('review_events', {
      predicate: (event) => event.item_revision_id === revision.id,
      limit: 200,
    }).total + 1;
    return this.#repository.create('review_events', {
      item_revision_id: revision.id,
      reviewer_id: reviewer.id,
      reviewer_actor_id: reviewer.actor_id,
      assignment_id: assignment.id,
      assignment_state: assignment.state,
      assignment_review_type: assignment.review_type,
      review_type: eventInput.review_type,
      reviewer_role: requiredRole,
      credential_status: reviewer.credential?.status || 'not_applicable',
      credential_verification_id: reviewer.credential?.verification_id || null,
      verdict: eventInput.verdict,
      to_status: eventInput.to_status,
      structured_findings: validateReviewFindings(eventInput.structured_findings),
      from_status: fromStatus,
      sequence,
      exact_revision_hash: revision.content_hash,
      actor_id: actor.id,
    }, { actorId: actor.id });
  }

  assembleRelease(payload, actorInput) {
    const releaseInput = allowlistedPayload(payload, new Set([
      'datasetVersion',
      'itemRevisionIds',
      'previousManifestHash',
    ]));
    const actor = requireRole(actorInput, 'release_manager');
    assert(Array.isArray(releaseInput.itemRevisionIds) && releaseInput.itemRevisionIds.length > 0, 'release_requires_items');
    assert(typeof releaseInput.datasetVersion === 'string' && releaseInput.datasetVersion === releaseInput.datasetVersion.trim() && releaseInput.datasetVersion, 'dataset_version_required');
    if (releaseInput.previousManifestHash !== undefined && releaseInput.previousManifestHash !== null) {
      assert(SHA256_HEX.test(releaseInput.previousManifestHash), 'previous_manifest_hash_invalid');
    }
    const itemRevisionIds = unique(releaseInput.itemRevisionIds);
    assert(itemRevisionIds.length === releaseInput.itemRevisionIds.length, 'duplicate_item_revision_id');
    const revisions = itemRevisionIds.map((id) => this.#repository.get('item_revisions', id));
    for (const revision of revisions) {
      assert(this.revisionStatus(revision.id) === 'approved', 'revision_not_approved');
      const medicalPass = this.#repository.list('review_events', {
        predicate: (event) => event.item_revision_id === revision.id
          && event.review_type === 'medical'
          && event.to_status === 'approved'
          && event.verdict === 'pass'
          && event.credential_status === 'verified'
          && event.assignment_state === 'accepted'
          && event.exact_revision_hash === revision.content_hash,
      }).total;
      assert(medicalPass > 0, 'exact_medical_approval_missing');
      for (const claimId of revision.evidence_claim_ids) {
        const claim = this.#repository.get('evidence_claims', claimId);
        assert(claim.status === 'verified', 'claim_not_verified');
        assert(!claim.expires_at || Date.parse(claim.expires_at) > Date.now(), 'claim_expired');
      }
      for (const sourceId of revision.source_ids) {
        const source = this.#repository.get('source_records', sourceId);
        const rights = this.#repository.get('rights_records', source.rights_record_id);
        const privacy = this.#repository.get('privacy_redaction_records', source.privacy_redaction_record_id);
        assert(rights.rights_status === 'cleared_for', 'source_rights_not_cleared');
        assert(['pass', 'pass_with_redactions'].includes(privacy.status), 'source_privacy_not_cleared');
        if (source.id === revision.drills.source_record_id) {
          assert(source.source_hash === revision.drills.source_hash, 'drills_source_hash_mismatch');
          assert(rights.rights_status === revision.drills.rights_status, 'drills_rights_state_mismatch');
          assert(privacy.status === revision.drills.privacy_status, 'drills_privacy_state_mismatch');
        }
      }
    }

    const releaseId = deterministicId('release', {
      datasetVersion: releaseInput.datasetVersion,
      itemRevisionIds: [...itemRevisionIds].sort(),
    });
    const generated = buildReleaseArtifacts({
      releaseId,
      datasetVersion: releaseInput.datasetVersion,
      revisions,
      previousManifestHash: releaseInput.previousManifestHash || null,
    });
    const preAnswer = generated.artifacts.find((artifact) => artifact.channel === 'stat_pre_answer');
    assert(scanForAnswerLeak(preAnswer.payload).length === 0, 'pre_answer_leak_detected');
    const snapshot = this.#repository.create('release_snapshots', {
      release_id: releaseId,
      dataset_version: releaseInput.datasetVersion,
      state: 'assembled',
      item_revision_ids: [...itemRevisionIds].sort(),
      release_membership: structuredClone(generated.manifest.release_membership),
      manifest: generated.manifest,
      assembled_by_actor_id: actor.id,
    }, { id: releaseId, actorId: actor.id });
    const artifacts = generated.artifacts.map((entry) => this.#repository.create('channel_artifacts', {
      release_id: releaseId,
      ...entry,
    }, { actorId: actor.id }));
    return {
      release: snapshot,
      artifacts: artifacts.map(({ payload: _payload, ...metadata }) => metadata),
    };
  }

  recordReleaseValidation(releaseId, payload, actorInput) {
    const actor = requireAnyRole(actorInput, ['release_manager', 'system']);
    const validationInput = allowlistedPayload(payload, new Set([
      'manifest_hash',
      'evidence_hash',
      'checks',
    ]));
    const release = this.#repository.get('release_snapshots', releaseId);
    assert(validationInput.manifest_hash === release.manifest.manifest_hash, 'manifest_hash_mismatch');
    assert(SHA256_HEX.test(validationInput.evidence_hash || ''), 'validator_evidence_hash_required');
    assert(Array.isArray(validationInput.checks) && validationInput.checks.length > 0, 'validator_checks_required');
    const checkIds = validationInput.checks.map((check) => {
      const normalized = allowlistedPayload(check, new Set(['id', 'status']));
      assert(typeof normalized.id === 'string' && normalized.id.trim(), 'validator_check_id_required');
      assert(normalized.status === 'pass', 'validator_check_failed');
      return normalized.id.trim();
    });
    assert(release.assembled_by_actor_id && release.assembled_by_actor_id !== actor.id, 'release_actor_separation_required');
    assert(this.#repository.list('export_validation_results', {
      predicate: (row) => row.release_id === releaseId && row.status === 'pass',
      limit: 1,
    }).total === 0, 'release_already_validated');
    return this.#repository.create('export_validation_results', {
      release_id: releaseId,
      manifest_hash: release.manifest.manifest_hash,
      evidence_hash: validationInput.evidence_hash,
      check_ids: unique(checkIds),
      status: 'pass',
      validator_actor_id: actor.id,
      validated_at: this.#repository.now(),
    }, { actorId: actor.id });
  }

  #verifiedPublicationRatification(claim, release, publisherActorId) {
    assert(isRecord(claim), 'brian_publication_ratification_required');
    if (!this.#publicationRatificationVerifier) {
      throw new AuthorizationError('publication_ratification_unavailable');
    }
    let result;
    try {
      result = this.#publicationRatificationVerifier(Object.freeze({
        claim: Object.freeze(structuredClone(claim)),
        release_id: release.id,
        manifest_hash: release.manifest.manifest_hash,
        publisher_actor_id: publisherActorId,
      }));
    } catch {
      throw new AuthorizationError('publication_ratification_unavailable');
    }
    const brianIdentity = String(result?.ratifier_name || '') === 'Brian'
      || String(result?.actor_id || '').toLowerCase() === 'brian';
    assert(
      isRecord(result)
      && result.verified === true
      && brianIdentity
      && result.manifest_hash === release.manifest.manifest_hash
      && String(result.ratification_id || '').trim()
      && String(result.actor_id || '').trim()
      && result.actor_id !== publisherActorId,
      'brian_publication_ratification_invalid',
    );
    return {
      ratification_id: String(result.ratification_id),
      actor_id: String(result.actor_id),
    };
  }

  promoteRelease(releaseId, promotionInput, actorInput) {
    const input = typeof promotionInput === 'string'
      ? { to_state: promotionInput }
      : allowlistedPayload(promotionInput, new Set([
        'to_state',
        'manifest_hash',
        'validation_evidence_id',
        'publication_ratification',
      ]));
    const toState = input.to_state;
    const actor = toState === 'validated'
      ? requireAnyRole(actorInput, ['release_manager', 'system'])
      : requireRole(actorInput, 'release_manager');
    const release = this.#repository.get('release_snapshots', releaseId);
    assert(input.manifest_hash === release.manifest.manifest_hash, 'manifest_hash_mismatch');
    const promotions = this.#repository.list('release_promotion_records', {
      predicate: (promotion) => promotion.release_id === releaseId,
      limit: 200,
    }).rows.sort((a, b) => a.sequence - b.sequence);
    const fromState = promotions.at(-1)?.to_state || release.state;
    assert((RELEASE_TRANSITIONS[fromState] || []).includes(toState), 'illegal_release_transition');

    let validation = null;
    if (['validated', 'ratified', 'published'].includes(toState)) {
      assert(typeof input.validation_evidence_id === 'string' && input.validation_evidence_id.trim(), 'validator_evidence_required');
      validation = this.#repository.get('export_validation_results', input.validation_evidence_id);
      assert(validation.release_id === releaseId, 'validator_evidence_release_mismatch');
      assert(validation.manifest_hash === release.manifest.manifest_hash, 'validator_evidence_manifest_mismatch');
      assert(validation.status === 'pass', 'validator_evidence_not_passed');
    }

    const validatedPromotion = promotions.find((promotion) => promotion.to_state === 'validated');
    const ratifiedPromotion = promotions.find((promotion) => promotion.to_state === 'ratified');
    if (toState === 'validated') {
      assert(validation.validator_actor_id === actor.id, 'validator_actor_mismatch');
      assert(actor.id !== release.assembled_by_actor_id, 'release_actor_separation_required');
    }
    if (toState === 'ratified') {
      assert(validatedPromotion?.validation_evidence_id === validation.id, 'validator_evidence_chain_mismatch');
      assert(actor.id !== release.assembled_by_actor_id, 'release_actor_separation_required');
      assert(actor.id !== validation.validator_actor_id, 'independent_ratification_actor_required');
    }

    let brianRatification = null;
    if (toState === 'published') {
      assert(validatedPromotion?.validation_evidence_id === validation.id, 'validator_evidence_chain_mismatch');
      assert(ratifiedPromotion, 'release_ratification_required');
      assert(actor.id !== release.assembled_by_actor_id, 'release_actor_separation_required');
      assert(actor.id !== validation.validator_actor_id, 'release_actor_separation_required');
      assert(actor.id !== ratifiedPromotion.actor_id, 'release_actor_separation_required');
      const studentFlag = this.#repository.list('feature_flags', {
        predicate: (row) => row.key === 'student_release_enabled' && row.enabled === true,
      }).rows[0];
      assert(Boolean(studentFlag), 'student_release_feature_flag_disabled');
      assert(this.#governance.release_manager !== null, 'release_manager_unassigned');
      assert(this.#governance.medical_governance_lead !== null, 'medical_governance_lead_unassigned');
      const releaseManager = this.#repository.get('reviewers', this.#governance.release_manager);
      assert(releaseManager.actor_id === actor.id, 'release_manager_actor_mismatch');
      brianRatification = this.#verifiedPublicationRatification(
        input.publication_ratification,
        release,
        actor.id,
      );
    }

    return this.#repository.create('release_promotion_records', {
      release_id: releaseId,
      from_state: fromState,
      to_state: toState,
      actor_id: actor.id,
      sequence: promotions.length + 1,
      manifest_hash: release.manifest.manifest_hash,
      validation_evidence_id: validation?.id || null,
      brian_publication_ratification_id: brianRatification?.ratification_id || null,
      brian_publication_ratifier_actor_id: brianRatification?.actor_id || null,
    }, { actorId: actor.id });
  }

  artifactForPhase(releaseId, channel, finalizationContext, actorInput) {
    const actor = requireRead(actorInput);
    const artifact = this.#repository.list('channel_artifacts', {
      predicate: (row) => row.release_id === releaseId && row.channel === channel,
      limit: 2,
    }).rows[0];
    assert(artifact, 'artifact_not_found');
    if (artifact.phase === 'post_answer') {
      const trusted = requireTrustedFinalizationContext(finalizationContext, {
        actorInput: actor,
        releaseId,
        channel,
      });
      assertPostAnswerAccess({
        serverState: trusted.state,
        callerIsParticipant: trusted.scope === 'participant',
      });
    }
    if (artifact.phase === 'server_only') {
      requireAnyRole(actor, ['release_manager', 'system']);
    }
    if (artifact.phase === 'internal') {
      requireAnyRole(actor, ['content_operator', 'release_manager', 'system']);
    }
    if (artifact.phase === 'pre_answer') {
      assert(scanForAnswerLeak(artifact.payload).length === 0, 'pre_answer_leak_detected', 500);
    }
    return artifact;
  }
}

export function createSyntheticDemoPlatform() {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({
    repository,
    localSyntheticCapability: LOCAL_SYNTHETIC_CAPABILITY,
  });
  const admin = {
    id: 'reviewer_local_demo',
    roles: ['platform_admin', 'author', 'editorial_reviewer', 'release_manager'],
  };
  platform.registerReviewer({
    actor_id: admin.id,
    display_name: 'Local Demo Reviewer',
    roles: ['editorial_reviewer'],
    credential: { type: 'editorial', status: 'claimed' },
  }, admin, { id: 'reviewer_local_demo' });

  const concept = repository.create('concepts', {
    title: 'Synthetic classification concept',
    taxonomy_version_id: 'taxv_local_demo',
    status: 'draft',
  }, { id: 'concept_local_demo', actorId: admin.id });
  const group = repository.create('variant_groups', {
    concept_id: concept.id,
    form: 'recall',
    status: 'draft',
  }, { id: 'vg_local_demo', actorId: admin.id });
  const item = repository.create('items', {
    variant_group_id: group.id,
    lifecycle: 'active',
    item_type: 'single_best_answer',
  }, { id: 'item_local_demo', actorId: admin.id });
  const rights = repository.create('rights_records', {
    rights_status: 'cleared_for',
    allowed_uses: ['synthetic_fixture'],
  }, { id: 'rights_local_demo', actorId: admin.id });
  const privacy = repository.create('privacy_redaction_records', {
    status: 'pass',
    required_class_metrics: {},
  }, { id: 'redact_local_demo', actorId: admin.id });
  const sourceHash = sha256('synthetic non-clinical fixture');
  const workingHash = sha256('synthetic non-clinical working fixture');
  const source = repository.create('source_records', {
    source_type: 'AI_DRAFT',
    title: 'Synthetic non-clinical fixture',
    rights_record_id: rights.id,
    privacy_redaction_record_id: privacy.id,
    source_hash: sourceHash,
  }, { id: 'src_local_demo', actorId: admin.id });
  const claim = repository.create('evidence_claims', {
    claim_text: 'Synthetic fixture key maps blue to beta.',
    status: 'verified',
    authority_class: 'fixture_only',
    source_record_ids: [source.id],
    expires_at: '2099-01-01T00:00:00.000Z',
  }, { id: 'claim_local_demo', actorId: admin.id });
  repository.create('inventory_sources', {
    canonical_video_id: 'video_local_demo',
    title: 'Synthetic source fixture',
    transcript_available: false,
    vtt_available: false,
    nodes_available: true,
    rights_status: 'fixture_only',
    privacy_status: 'pass',
    extraction_suitability: 'synthetic_only',
  }, { id: 'inventory_local_demo', actorId: admin.id });

  for (const key of FEATURE_FLAG_KEYS) {
    platform.setFeatureFlag(key, false, { audience: 'none' }, admin);
  }

  platform.createRevision({
    item_id: item.id,
    concept_id: concept.id,
    source_ids: [source.id],
    evidence_claim_ids: [claim.id],
    export_question_id: 'I1Q-LOCAL-DEMO-0001',
    prompt: 'Which label matches the blue sample in this synthetic fixture?',
    choices: [
      { key: 'A', text: 'Label alpha', why_tempting: 'First position bias', why_wrong: 'Does not match the fixture key', misconception_id: 'miscon_position_bias' },
      { key: 'B', text: 'Label beta', why_tempting: null, why_wrong: null, misconception_id: null },
      { key: 'C', text: 'Label gamma', why_tempting: 'Nearby label', why_wrong: 'Does not match the fixture key', misconception_id: 'miscon_nearby_label' },
      { key: 'D', text: 'Label delta', why_tempting: 'Similar ordering', why_wrong: 'Uses a different ordering rule', misconception_id: 'miscon_order_rule' },
    ],
    answer: 'B',
    explanation: 'The synthetic fixture key maps blue to label beta.',
    correct_answer_rationale: 'The fixture key explicitly maps blue to beta.',
    topic: 'Synthetic fixtures',
    subtopic: 'Classification',
    lineage: 'AI_DRAFT_NOT_MEDICALLY_VALIDATED',
    drills: {
      video_id: 'video_local_demo',
      source_record_id: source.id,
      title: 'Synthetic local demo drill',
      playback: {
        availability: 'available',
        url: 'https://example.invalid/local-demo/playback',
        stream_id: null,
      },
      nodes: {
        availability: 'available',
        url: 'https://example.invalid/local-demo/nodes.json',
      },
      transcript: { availability: 'missing', url: null },
      vtt: { availability: 'missing', url: null },
      timestamp: { start_seconds: 0, end_seconds: 5 },
      rights_status: 'cleared_for',
      privacy_status: 'pass',
      source_hash: sourceHash,
      working_hash: workingHash,
    },
  }, admin, { idempotencyKey: 'seed_revision_local_demo' });
  return platform;
}
