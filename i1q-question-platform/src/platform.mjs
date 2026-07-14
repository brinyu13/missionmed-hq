import {
  GOVERNANCE_SLOTS,
  RELEASE_TRANSITIONS,
  REVISION_TRANSITIONS,
  WORKFLOW_MANAGED_ENTITY_TYPES,
} from './contracts.mjs';
import { requireAnyRole, requireRead, requireRole, requireWrite } from './auth.mjs';
import { buildReleaseArtifacts, scanForAnswerLeak } from './exports.mjs';
import { deterministicId, sha256 } from './hash.mjs';
import { ConflictError, MemoryRepository } from './store.mjs';

function assert(condition, code) {
  if (!condition) {
    const error = new Error(code);
    error.code = code;
    error.statusCode = 422;
    throw error;
  }
}

function unique(values) {
  return [...new Set(values)];
}

function validateRevisionPayload(payload) {
  assert(payload && typeof payload === 'object', 'revision_payload_required');
  assert(String(payload.prompt || '').trim(), 'revision_prompt_required');
  assert(Array.isArray(payload.choices) && payload.choices.length === 4, 'exactly_four_choices_required');
  const keys = payload.choices.map((choice) => choice.key);
  assert(keys.join(',') === 'A,B,C,D', 'choice_keys_must_be_A_through_D');
  assert(payload.choices.every((choice) => String(choice.text || '').trim()), 'choice_text_required');
  assert(unique(payload.choices.map((choice) => choice.text.trim().toLowerCase())).length === 4, 'choices_must_be_distinct');
  assert(['A', 'B', 'C', 'D'].includes(payload.answer), 'valid_answer_required');
  assert(String(payload.explanation || '').trim(), 'explanation_required');
  assert(String(payload.correct_answer_rationale || '').trim(), 'correct_answer_rationale_required');
  const distractors = payload.choices.filter((choice) => choice.key !== payload.answer);
  assert(distractors.every((choice) => choice.why_tempting && choice.why_wrong && choice.misconception_id), 'distractor_rationale_required');
  assert(Array.isArray(payload.source_ids) && payload.source_ids.length > 0, 'source_lineage_required');
  assert(Array.isArray(payload.evidence_claim_ids) && payload.evidence_claim_ids.length > 0, 'evidence_claims_required');
  assert(payload.concept_id, 'concept_id_required');
  assert(payload.item_id, 'item_id_required');
}

export class QuestionPlatform {
  #repository;
  #governance;
  #idempotency = new Map();

  constructor({ repository = new MemoryRepository() } = {}) {
    this.#repository = repository;
    this.#governance = Object.fromEntries(GOVERNANCE_SLOTS.map((slot) => [slot, null]));
  }

  get repository() {
    return this.#repository;
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
      assert(reviewer.roles?.includes('physician_reviewer'), 'medical_governance_requires_physician');
      assert(['md', 'do'].includes(reviewer.credential?.type), 'medical_governance_credential_required');
      assert(reviewer.credential?.status === 'verified', 'medical_governance_credential_not_verified');
      assert(!reviewer.credential?.expires_at || Date.parse(reviewer.credential.expires_at) > Date.now(), 'medical_governance_credential_expired');
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

  executeIdempotent(key, actorInput, operation) {
    const actor = requireWrite(actorInput);
    assert(String(key || '').trim(), 'idempotency_key_required');
    const scopedKey = `${actor.id}:${key}`;
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
    assert(!WORKFLOW_MANAGED_ENTITY_TYPES.has(entityType), `workflow_endpoint_required:${entityType}`);
    const operation = (actor) => this.#repository.create(entityType, payload, {
      id: options.id,
      actorId: actor.id,
    });
    if (options.idempotencyKey) {
      return this.executeIdempotent(options.idempotencyKey, actorInput, operation);
    }
    return operation(requireWrite(actorInput));
  }

  list(entityType, query, actorInput) {
    const actor = requireRead(actorInput);
    if (['channel_artifacts', 'api_idempotency_keys'].includes(entityType)) {
      requireAnyRole(actor, ['platform_admin', 'release_manager', 'system']);
    }
    if (entityType === 'audit_events') {
      requireAnyRole(actor, ['platform_admin', 'incident_owner', 'system']);
    }
    const page = this.#repository.list(entityType, query);
    return { ...page, rows: page.rows.map((row) => this.#sanitizeResource(entityType, row, actor)) };
  }

  get(entityType, id, actorInput) {
    const actor = requireRead(actorInput);
    if (['channel_artifacts', 'api_idempotency_keys'].includes(entityType)) {
      requireAnyRole(actor, ['platform_admin', 'release_manager', 'system']);
    }
    if (entityType === 'audit_events') {
      requireAnyRole(actor, ['platform_admin', 'incident_owner', 'system']);
    }
    return this.#sanitizeResource(entityType, this.#repository.get(entityType, id), actor);
  }

  update(entityType, id, patch, actorInput, options = {}) {
    assert(!WORKFLOW_MANAGED_ENTITY_TYPES.has(entityType), `workflow_endpoint_required:${entityType}`);
    const actor = requireWrite(actorInput);
    return this.#repository.update(entityType, id, patch, {
      actorId: actor.id,
      expectedHash: options.expectedHash,
    });
  }

  registerReviewer(payload, actorInput, { id } = {}) {
    const actor = requireRole(actorInput, 'platform_admin');
    assert(Array.isArray(payload.roles) && payload.roles.length > 0, 'reviewer_roles_required');
    assert(payload.actor_id, 'reviewer_actor_required');
    return this.#repository.create('reviewers', payload, { id, actorId: actor.id });
  }

  setFeatureFlag(key, enabled, scope, actorInput) {
    const actor = requireRole(actorInput, 'platform_admin');
    assert(['internal_platform_enabled', 'stat_adapter_enabled', 'drills_adapter_enabled', 'student_release_enabled'].includes(key), 'unknown_feature_flag');
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
    const sanitized = structuredClone(row);
    const canReadPrivateSources = actor.roles.some((role) => ['platform_admin', 'privacy_officer', 'system'].includes(role));
    if (!canReadPrivateSources && ['source_records', 'transcript_artifacts'].includes(entityType)) {
      delete sanitized.private_storage_ref;
    }
    if (!canReadPrivateSources && entityType === 'normalized_transcript_segments') {
      delete sanitized.text;
      delete sanitized.raw_text;
    }
    return sanitized;
  }

  createRevision(payload, actorInput, { idempotencyKey } = {}) {
    const actor = requireRole(actorInput, 'author');
    validateRevisionPayload(payload);
    assert(this.#repository.has('items', payload.item_id), 'item_not_found');
    assert(this.#repository.has('concepts', payload.concept_id), 'concept_not_found');
    for (const sourceId of payload.source_ids) {
      assert(this.#repository.has('source_records', sourceId), `source_not_found:${sourceId}`);
    }
    for (const claimId of payload.evidence_claim_ids) {
      assert(this.#repository.has('evidence_claims', claimId), `claim_not_found:${claimId}`);
    }
    const revisionNumber = this.#repository.list('item_revisions', {
      predicate: (row) => row.item_id === payload.item_id,
      limit: 200,
    }).total + 1;
    const revision = {
      ...structuredClone(payload),
      author_actor_id: actor.id,
      revision_number: revisionNumber,
      workflow_status: 'draft',
      medical_validation_status: 'AI_DRAFT_NOT_MEDICALLY_VALIDATED',
    };
    return this.executeIdempotent(
      idempotencyKey || deterministicId('revision_request', revision),
      actor,
      () => this.#repository.create('item_revisions', revision, { actorId: actor.id }),
    );
  }

  createReviewAssignment(payload, actorInput) {
    const actor = payload.review_type === 'medical'
      ? requireRole(actorInput, 'platform_admin')
      : requireRole(actorInput, 'editorial_reviewer');
    assert(this.#repository.has('item_revisions', payload.item_revision_id), 'revision_not_found');
    assert(this.#repository.has('reviewers', payload.reviewer_id), 'reviewer_not_found');
    assert(['editorial', 'medical'].includes(payload.review_type), 'invalid_review_type');
    return this.#repository.create('review_assignments', {
      ...payload,
      state: payload.state || 'accepted',
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
    const actor = requireWrite(actorInput);
    const revision = this.#repository.get('item_revisions', payload.item_revision_id);
    const reviewer = this.#repository.get('reviewers', payload.reviewer_id);
    const assignment = this.#repository.get('review_assignments', payload.assignment_id);
    assert(reviewer.actor_id === actor.id || actor.roles.includes('platform_admin'), 'reviewer_actor_mismatch');
    assert(revision.author_actor_id !== reviewer.actor_id, 'self_review_forbidden');
    assert(reviewer.delegated_by_actor_id !== revision.author_actor_id, 'indirect_self_review_forbidden');
    assert(!reviewer.conflict_actor_ids?.includes(revision.author_actor_id), 'reviewer_conflict_forbidden');
    assert(assignment.item_revision_id === revision.id, 'assignment_revision_mismatch');
    assert(assignment.reviewer_id === reviewer.id, 'assignment_reviewer_mismatch');
    assert(assignment.state === 'accepted', 'assignment_not_active');
    const fromStatus = this.revisionStatus(revision.id);
    assert((REVISION_TRANSITIONS[fromStatus] || []).includes(payload.to_status), 'illegal_revision_transition');

    if (payload.review_type === 'editorial') {
      assert(reviewer.roles?.includes('editorial_reviewer'), 'editorial_role_required');
      assert(payload.to_status !== 'approved', 'editorial_cannot_medically_approve');
    }
    if (payload.review_type === 'medical') {
      assert(fromStatus === 'medical_review', 'medical_review_requires_editorial_pass');
      assert(reviewer.roles?.includes('physician_reviewer'), 'physician_role_required');
      assert(['md', 'do'].includes(reviewer.credential?.type), 'physician_credential_required');
      assert(reviewer.credential?.status === 'verified', 'physician_credential_not_verified');
      assert(!reviewer.credential?.expires_at || Date.parse(reviewer.credential.expires_at) > Date.now(), 'physician_credential_expired');
      if (payload.to_status === 'approved') {
        assert(this.#governance.medical_governance_lead !== null, 'medical_governance_lead_unassigned');
        assert(payload.verdict === 'pass', 'medical_pass_required');
      }
    }

    const sequence = this.#repository.list('review_events', {
      predicate: (event) => event.item_revision_id === revision.id,
      limit: 200,
    }).total + 1;
    return this.#repository.create('review_events', {
      ...payload,
      from_status: fromStatus,
      sequence,
      exact_revision_hash: revision.content_hash,
      actor_id: actor.id,
    }, { actorId: actor.id });
  }

  assembleRelease({ datasetVersion, itemRevisionIds, previousManifestHash = null }, actorInput) {
    const actor = requireRole(actorInput, 'release_manager');
    assert(itemRevisionIds.length > 0, 'release_requires_items');
    const revisions = itemRevisionIds.map((id) => this.#repository.get('item_revisions', id));
    for (const revision of revisions) {
      assert(this.revisionStatus(revision.id) === 'approved', `revision_not_approved:${revision.id}`);
      const medicalPass = this.#repository.list('review_events', {
        predicate: (event) => event.item_revision_id === revision.id
          && event.review_type === 'medical'
          && event.to_status === 'approved'
          && event.exact_revision_hash === revision.content_hash,
      }).total;
      assert(medicalPass > 0, `exact_medical_approval_missing:${revision.id}`);
      for (const claimId of revision.evidence_claim_ids) {
        const claim = this.#repository.get('evidence_claims', claimId);
        assert(claim.status === 'verified', `claim_not_verified:${claimId}`);
        assert(!claim.expires_at || Date.parse(claim.expires_at) > Date.now(), `claim_expired:${claimId}`);
      }
      for (const sourceId of revision.source_ids) {
        const source = this.#repository.get('source_records', sourceId);
        const rights = this.#repository.get('rights_records', source.rights_record_id);
        const privacy = this.#repository.get('privacy_redaction_records', source.privacy_redaction_record_id);
        assert(rights.rights_status === 'cleared_for', `source_rights_not_cleared:${sourceId}`);
        assert(['pass', 'pass_with_redactions'].includes(privacy.status), `source_privacy_not_cleared:${sourceId}`);
      }
    }
    const releaseId = deterministicId('release', { datasetVersion, itemRevisionIds: [...itemRevisionIds].sort() });
    const generated = buildReleaseArtifacts({
      releaseId,
      datasetVersion,
      revisions,
      previousManifestHash,
    });
    const preAnswer = generated.artifacts.find((artifact) => artifact.channel === 'stat_pre_answer');
    assert(scanForAnswerLeak(preAnswer.payload).length === 0, 'pre_answer_leak_detected');
    const snapshot = this.#repository.create('release_snapshots', {
      release_id: releaseId,
      dataset_version: datasetVersion,
      state: 'assembled',
      item_revision_ids: [...itemRevisionIds].sort(),
      manifest: generated.manifest,
    }, { id: releaseId, actorId: actor.id });
    const artifacts = generated.artifacts.map((entry) => this.#repository.create('channel_artifacts', {
      release_id: releaseId,
      ...entry,
    }, { actorId: actor.id }));
    return { release: snapshot, artifacts };
  }

  promoteRelease(releaseId, toState, actorInput) {
    const actor = requireRole(actorInput, 'release_manager');
    const release = this.#repository.get('release_snapshots', releaseId);
    const promotions = this.#repository.list('release_promotion_records', {
      predicate: (promotion) => promotion.release_id === releaseId,
      limit: 200,
    }).rows.sort((a, b) => a.sequence - b.sequence);
    const fromState = promotions.at(-1)?.to_state || release.state;
    assert((RELEASE_TRANSITIONS[fromState] || []).includes(toState), 'illegal_release_transition');
    if (toState === 'published') {
      const flag = this.#repository.list('feature_flags', {
        predicate: (row) => row.key === 'student_release_enabled' && row.enabled === true,
      }).rows[0];
      assert(Boolean(flag), 'student_release_feature_flag_disabled');
      assert(this.#governance.release_manager !== null, 'release_manager_unassigned');
      assert(this.#governance.medical_governance_lead !== null, 'medical_governance_lead_unassigned');
    }
    return this.#repository.create('release_promotion_records', {
      release_id: releaseId,
      from_state: fromState,
      to_state: toState,
      actor_id: actor.id,
      sequence: promotions.length + 1,
      manifest_hash: release.manifest.manifest_hash,
    }, { actorId: actor.id });
  }

  artifactForPhase(releaseId, channel, phase, actorInput) {
    const actor = requireRead(actorInput);
    const artifact = this.#repository.list('channel_artifacts', {
      predicate: (row) => row.release_id === releaseId && row.channel === channel,
      limit: 2,
    }).rows[0];
    assert(artifact, 'artifact_not_found');
    if (artifact.phase === 'post_answer' && phase !== 'post_answer_finalized') {
      const error = new ConflictError('post_answer_requires_finalization');
      error.statusCode = 403;
      throw error;
    }
    if (artifact.phase === 'server_only' && !actor.roles.some((role) => ['release_manager', 'platform_admin', 'system'].includes(role))) {
      const error = new ConflictError('server_only_artifact_forbidden');
      error.statusCode = 403;
      throw error;
    }
    return artifact;
  }
}

export function createSyntheticDemoPlatform() {
  const platform = new QuestionPlatform();
  const admin = { id: 'reviewer_local_demo', roles: ['platform_admin', 'author', 'editorial_reviewer', 'release_manager'] };
  platform.registerReviewer({
    actor_id: admin.id,
    display_name: 'Local Demo Reviewer',
    roles: ['author', 'editorial_reviewer'],
    credential: { type: 'editorial', status: 'verified' },
  }, admin, { id: 'reviewer_local_demo' });
  const concept = platform.create('concepts', {
    title: 'Synthetic classification concept',
    taxonomy_version_id: 'taxv_local_demo',
    status: 'draft',
  }, admin, { id: 'concept_local_demo' });
  const group = platform.create('variant_groups', {
    concept_id: concept.id,
    form: 'recall',
    status: 'draft',
  }, admin, { id: 'vg_local_demo' });
  const item = platform.create('items', {
    variant_group_id: group.id,
    lifecycle: 'active',
    item_type: 'single_best_answer',
  }, admin, { id: 'item_local_demo' });
  const rights = platform.create('rights_records', {
    rights_status: 'cleared_for',
    allowed_uses: ['synthetic_fixture'],
  }, admin, { id: 'rights_local_demo' });
  const privacy = platform.create('privacy_redaction_records', {
    status: 'pass',
    required_class_metrics: {},
  }, admin, { id: 'redact_local_demo' });
  const source = platform.create('source_records', {
    source_type: 'AI_DRAFT',
    title: 'Synthetic non-clinical fixture',
    rights_record_id: rights.id,
    privacy_redaction_record_id: privacy.id,
    source_hash: sha256('synthetic non-clinical fixture'),
  }, admin, { id: 'src_local_demo' });
  const claim = platform.create('evidence_claims', {
    claim_text: 'Synthetic fixture key maps blue to beta.',
    status: 'verified',
    authority_class: 'fixture_only',
    source_record_ids: [source.id],
    expires_at: '2099-01-01T00:00:00.000Z',
  }, admin, { id: 'claim_local_demo' });
  platform.create('inventory_sources', {
    canonical_video_id: 'video_local_demo',
    title: 'Synthetic source fixture',
    transcript_available: true,
    vtt_available: true,
    nodes_available: true,
    rights_status: 'fixture_only',
    privacy_status: 'pass',
    extraction_suitability: 'synthetic_only',
  }, admin, { id: 'inventory_local_demo' });
  platform.createRevision({
    item_id: item.id,
    concept_id: concept.id,
    source_ids: [source.id],
    evidence_claim_ids: [claim.id],
    prompt: 'Which label matches the blue sample in this synthetic fixture?',
    choices: [
      { key: 'A', text: 'Label alpha', why_tempting: null, why_wrong: null, misconception_id: null },
      { key: 'B', text: 'Label beta', why_tempting: null, why_wrong: null, misconception_id: null },
      { key: 'C', text: 'Label gamma', why_tempting: 'Nearby label', why_wrong: 'Does not match the fixture key', misconception_id: 'miscon_nearby_label' },
      { key: 'D', text: 'Label delta', why_tempting: 'Similar ordering', why_wrong: 'Uses a different ordering rule', misconception_id: 'miscon_order_rule' },
    ].map((choice) => choice.key === 'A'
      ? { ...choice, why_tempting: 'First position bias', why_wrong: 'Does not match the fixture key', misconception_id: 'miscon_position_bias' }
      : choice),
    answer: 'B',
    explanation: 'The synthetic fixture key maps blue to label beta.',
    correct_answer_rationale: 'The fixture key explicitly maps blue to beta.',
    topic: 'Synthetic fixtures',
    subtopic: 'Classification',
    lineage: 'AI_DRAFT_NOT_MEDICALLY_VALIDATED',
  }, admin, { idempotencyKey: 'seed_revision_local_demo' });
  return platform;
}
