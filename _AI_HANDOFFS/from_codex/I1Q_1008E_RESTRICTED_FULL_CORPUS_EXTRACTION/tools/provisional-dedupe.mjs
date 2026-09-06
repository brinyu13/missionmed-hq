import { CONCEPT_SCHEMA_VERSION, DUPLICATE_RELATIONSHIP_TYPES } from './constants.mjs';
import {
  contentAddressedEnvelope,
  deterministicId,
  normalizeForSignature,
  stableHash,
  tokenSignature,
} from './canonical.mjs';

const RELATIONSHIP_SET = new Set(DUPLICATE_RELATIONSHIP_TYPES);
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'does', 'for', 'from', 'how',
  'in', 'is', 'it', 'of', 'on', 'or', 'the', 'this', 'to', 'what', 'when', 'which', 'why',
  'with', 'would', 'you', 'your',
]);
const QUARANTINE_LIFECYCLES = new Set([
  'AMBIGUOUS', 'PRIVACY_QUARANTINED', 'RIGHTS_QUARANTINED',
  'SPEAKER_QUARANTINED', 'MEDICAL_QUARANTINED',
]);
const SEMANTIC_WINDOW = 16;

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))].sort();
}

function tokens(value) {
  return normalizeForSignature(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function jaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size === 0 && rightSet.size === 0) return 1;
  let intersection = 0;
  for (const token of leftSet) if (rightSet.has(token)) intersection += 1;
  return intersection / (leftSet.size + rightSet.size - intersection);
}

function orderedBigrams(values) {
  if (values.length < 2) return values;
  return values.slice(0, -1).map((value, index) => `${value}\0${values[index + 1]}`);
}

function concreteClassification(value) {
  return typeof value === 'string' && value.length > 0
    && !['UNCLASSIFIED', 'UNKNOWN', 'NOT_APPLICABLE'].includes(value);
}

function retained(occurrence) {
  return occurrence.extraction_class !== 'NONMEDICAL'
    && !String(occurrence.lifecycle_status).startsWith('REJECTED_');
}

function mergeEligible(occurrence) {
  return retained(occurrence)
    && !QUARANTINE_LIFECYCLES.has(occurrence.lifecycle_status)
    && typeof occurrence.privacy_safe_normalized_wording === 'string'
    && occurrence.privacy_safe_normalized_wording.trim().length > 0;
}

function targetSignature(occurrence) {
  const normalized = normalizeForSignature(occurrence.target_answer ?? '');
  return normalized ? tokenSignature(normalized) : null;
}

function canExactMerge(occurrence) {
  if (!mergeEligible(occurrence)) return false;
  const tokenCount = new Set(tokens(occurrence.privacy_safe_normalized_wording)).size;
  const supportedTarget = targetSignature(occurrence) !== null;
  return concreteClassification(occurrence.subject)
    && (supportedTarget ? tokenCount >= 2 : tokenCount >= 4);
}

function exactMergeKey(occurrence) {
  if (!canExactMerge(occurrence)) return null;
  return [
    occurrence.subject,
    occurrence.question_form ?? 'OTHER',
    stableHash(normalizeForSignature(occurrence.privacy_safe_normalized_wording)),
    targetSignature(occurrence) ?? 'NO_SUPPORTED_TARGET',
  ].join(':');
}

function semanticBlockingKeys(occurrence) {
  if (!mergeEligible(occurrence) || !concreteClassification(occurrence.subject)) return [];
  const tokenList = uniqueSorted(tokens(occurrence.privacy_safe_normalized_wording));
  if (tokenList.length < 4) return [];
  const prefix = `${occurrence.subject}:${occurrence.question_form ?? 'OTHER'}`;
  return tokenList.slice(0, 6).map((token) => `${prefix}:${token}`);
}

function pairRelationship(left, right) {
  const leftNormalized = normalizeForSignature(left.privacy_safe_normalized_wording);
  const rightNormalized = normalizeForSignature(right.privacy_safe_normalized_wording);
  const leftTokens = tokens(leftNormalized);
  const rightTokens = tokens(rightNormalized);
  const sameSubject = concreteClassification(left.subject) && left.subject === right.subject;
  const sameForm = (left.question_form ?? 'OTHER') === (right.question_form ?? 'OTHER');
  const leftTarget = targetSignature(left);
  const rightTarget = targetSignature(right);
  const sameSupportedTarget = leftTarget !== null && leftTarget === rightTarget;
  const sufficientlySpecific = Math.min(new Set(leftTokens).size, new Set(rightTokens).size)
    >= (sameSupportedTarget ? 2 : 4);
  if (leftNormalized && leftNormalized === rightNormalized && sameSubject && sufficientlySpecific
      && (sameSupportedTarget || sameForm)) {
    return { type: 'EXACT_TEXT_DUPLICATE', confidence: sameSupportedTarget ? 1 : 0.96 };
  }
  const similarity = jaccard(leftTokens, rightTokens);
  const orderedSimilarity = jaccard(orderedBigrams(leftTokens), orderedBigrams(rightTokens));
  if (sameSubject && sameForm && sufficientlySpecific && similarity >= 0.92
      && orderedSimilarity >= 0.6) {
    return { type: 'NEAR_TEXT_DUPLICATE', confidence: similarity };
  }
  if (sameSubject && sameForm && sameSupportedTarget && similarity >= 0.82) {
    return { type: 'SAME_CONCEPT_SAME_TARGET', confidence: similarity };
  }
  if (sameSubject && sameSupportedTarget && similarity >= 0.78) {
    return { type: 'SAME_CONCEPT_DIFFERENT_FORM', confidence: similarity };
  }
  if (sameSubject && sufficientlySpecific && similarity >= 0.62) {
    return { type: 'SAME_TOPIC_DIFFERENT_CONCEPT', confidence: similarity };
  }
  if (sufficientlySpecific && similarity >= 0.72) {
    return { type: 'POSSIBLE_DUPLICATE', confidence: similarity };
  }
  return { type: 'NOT_DUPLICATE', confidence: similarity };
}

class DisjointSet {
  constructor(values) {
    this.parent = new Map(values.map((value) => [value, value]));
  }

  find(value) {
    const parent = this.parent.get(value);
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(left, right) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) return false;
    const [first, second] = [leftRoot, rightRoot].sort();
    this.parent.set(second, first);
    return true;
  }
}

function safeAlias(value, prefix, anchor) {
  if (typeof value === 'string' && value.length >= 8) return value;
  return deterministicId(prefix, anchor);
}

function hashValue(value, anchor) {
  return /^[a-f0-9]{64}$/u.test(value ?? '') ? value : stableHash(anchor);
}

function provenanceBinding(member) {
  return {
    occurrence_id: member.candidate_occurrence_id,
    source_alias: safeAlias(member.source_alias, 'source', member.candidate_occurrence_id),
    artifact_alias: safeAlias(member.artifact_alias, 'artifact', member.candidate_occurrence_id),
    transcript_hash_binding: hashValue(
      member.transcript_hash_binding, ['transcript', member.candidate_occurrence_id],
    ),
    nodes_hash_binding: /^[a-f0-9]{64}$/u.test(member.nodes_hash_binding ?? '')
      ? member.nodes_hash_binding : null,
    segment_locator_hash: stableHash(member.segment_locator ?? member.candidate_occurrence_id),
    source_lineage_hash: hashValue(
      member.source_lineage_hash, ['lineage', member.candidate_occurrence_id],
    ),
  };
}

function duplicateRelationship(edge, byId) {
  const left = byId.get(edge.left_occurrence_id);
  const right = byId.get(edge.right_occurrence_id);
  const bindings = uniqueSorted([
    left.processing_receipt_binding,
    right.processing_receipt_binding,
  ].filter((value) => typeof value === 'string' && value.length >= 8));
  return {
    relationship_id: deterministicId(
      'relationship', edge.left_occurrence_id, edge.right_occurrence_id, edge.relationship_type,
    ),
    left_occurrence_id: edge.left_occurrence_id,
    right_occurrence_id: edge.right_occurrence_id,
    relationship_type: edge.relationship_type,
    confidence: Number(edge.confidence.toFixed(3)),
    basis_receipt_bindings: bindings.length > 0 ? bindings : [
      deterministicId('receipt', edge.left_occurrence_id, edge.right_occurrence_id),
    ],
    adjudication_status: 'DEFERRED_TO_I1Q_1008F',
  };
}

function conceptLifecycle(members) {
  if (members.some((member) => QUARANTINE_LIFECYCLES.has(member.lifecycle_status))) {
    return 'QUARANTINED';
  }
  if (members.some((member) => member.lifecycle_status === 'REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
  return 'READY_FOR_I1Q_1008F';
}

function conceptEnvelope(members, edges, byId) {
  const memberIds = members.map((item) => item.candidate_occurrence_id);
  const conceptId = deterministicId(
    'concept', memberIds, members[0].subject ?? 'UNCLASSIFIED', members[0].question_form ?? 'OTHER',
  );
  const clusterId = deterministicId('cluster', memberIds);
  const relationships = edges.map((edge) => duplicateRelationship(edge, byId));
  const provisionalStatus = conceptLifecycle(members);
  const changedFields = uniqueSorted(members.flatMap(
    (member) => member.reconstruction_changed_fields ?? [],
  ));
  const reconstructionConfidences = members.map((member) => member.reconstruction_confidence)
    .filter((value) => Number.isFinite(value));
  return contentAddressedEnvelope({
    provisional_concept_id: conceptId,
    schema_version: CONCEPT_SCHEMA_VERSION,
    extraction_run_id: members[0].extraction_run_id
      ?? deterministicId('run', 'fixture-or-unbound-concept'),
    canonicality: 'PROVISIONAL',
    destructive_deduplication_performed: false,
    final_canonical_adjudication_completed: false,
    successor_mission: 'I1Q-1008F',
    normalized_concept_wording: members[0].privacy_safe_normalized_wording ?? '',
    target_answer: members[0].target_answer ?? null,
    medical_concept: members[0].subject ?? 'UNCLASSIFIED',
    teaching_objective: members[0].educational_intent ?? 'REVIEW_REQUIRED',
    clinical_scenario_summary: null,
    question_forms: uniqueSorted(members.map((item) => item.question_form ?? 'OTHER')),
    subject: members[0].subject ?? 'UNCLASSIFIED',
    organ_system: members[0].organ_system ?? 'UNCLASSIFIED',
    discipline: members[0].discipline ?? 'UNCLASSIFIED',
    competency: members[0].competency ?? 'UNCLASSIFIED',
    cognitive_levels: uniqueSorted(members.map((item) => item.cognitive_level ?? 'UNCLASSIFIED')),
    educational_intents: uniqueSorted(members.map((item) => item.educational_intent ?? 'REVIEW_REQUIRED')),
    evidence_sensitivity_flag: members.some((item) => item.evidence_sensitivity_flag === true),
    guideline_sensitivity_flag: members.some((item) => item.guideline_sensitivity_flag === true),
    medical_ambiguity_flags: uniqueSorted(members.flatMap((item) => item.medical_ambiguity_flags ?? [])),
    assessment_suitability_status: 'REVIEW_REQUIRED',
    provisional_duplicate_cluster_id: clusterId,
    occurrence_ids: memberIds,
    occurrence_count: memberIds.length,
    provenance_bindings: members.map(provenanceBinding),
    duplicate_relationships: relationships,
    duplicate_relationship_count: relationships.length,
    speaker_authority_classes_present: uniqueSorted(
      members.map((item) => item.speaker_authority_class ?? 'UNKNOWN'),
    ),
    normalization_status: members.some((item) => item.verbatim_or_reconstructed === 'RECONSTRUCTED')
      ? 'NORMALIZED_WITH_RECONSTRUCTION' : 'NORMALIZED_WITHOUT_RECONSTRUCTION',
    normalization_changed_fields: changedFields,
    normalization_rationale: changedFields.length > 0
      ? 'Surface normalization and any reconstruction remain occurrence-bound and provisional.' : null,
    normalization_confidence: reconstructionConfidences.length > 0
      ? Number((reconstructionConfidences.reduce((sum, value) => sum + value, 0)
        / reconstructionConfidences.length).toFixed(3))
      : null,
    medical_review_status: provisionalStatus === 'QUARANTINED' ? 'QUARANTINED' : 'REVIEW_REQUIRED',
    assessment_review_status: 'REVIEW_REQUIRED',
    privacy_review_status: provisionalStatus === 'QUARANTINED' ? 'QUARANTINED' : 'REVIEW_REQUIRED',
    rights_status: 'REVIEW_REQUIRED',
    release_status: provisionalStatus === 'QUARANTINED' ? 'QUARANTINED' : 'RESTRICTED_ONLY',
    quarantine_reasons: uniqueSorted(members.flatMap((item) => item.quarantine_reasons ?? [])),
    review_receipt_bindings: uniqueSorted(members.flatMap((item) => item.agent_review_receipts ?? [])),
    disagreement_record_bindings: uniqueSorted(members.flatMap((item) => item.disagreement_records ?? [])),
    adjudication_status: 'DEFERRED_TO_I1Q_1008F',
    legacy_comparison_status: 'NOT_COMPARED',
    provisional_status: provisionalStatus,
  });
}

export function buildProvisionalConcepts(occurrences) {
  if (!Array.isArray(occurrences)) throw new TypeError('occurrences_array_required');
  const candidates = occurrences.filter(retained);
  const byId = new Map(candidates.map((item) => [item.candidate_occurrence_id, item]));
  if (byId.size !== candidates.length) throw new TypeError('duplicate_occurrence_id');
  const disjoint = new DisjointSet([...byId.keys()]);
  const compared = new Set();
  const comparisonEdges = [];

  const consider = (leftId, rightId, forcedRelationship = null) => {
    const [leftKey, rightKey] = [leftId, rightId].sort();
    const pairKey = `${leftKey}\0${rightKey}`;
    if (compared.has(pairKey)) return;
    compared.add(pairKey);
    const relationship = forcedRelationship ?? pairRelationship(byId.get(leftKey), byId.get(rightKey));
    if (!RELATIONSHIP_SET.has(relationship.type)) throw new Error('relationship_internal_invalid');
    comparisonEdges.push({
      left_occurrence_id: leftKey,
      right_occurrence_id: rightKey,
      relationship_type: relationship.type,
      confidence: relationship.confidence,
    });
    if (['EXACT_TEXT_DUPLICATE', 'NEAR_TEXT_DUPLICATE', 'SAME_CONCEPT_SAME_TARGET'].includes(
      relationship.type,
    )) disjoint.union(leftKey, rightKey);
  };

  const exactGroups = new Map();
  for (const occurrence of candidates) {
    const key = exactMergeKey(occurrence);
    if (!key) continue;
    const members = exactGroups.get(key) ?? [];
    members.push(occurrence.candidate_occurrence_id);
    exactGroups.set(key, members);
  }
  for (const rawMembers of exactGroups.values()) {
    const members = uniqueSorted(rawMembers);
    for (let index = 1; index < members.length; index += 1) {
      consider(members[0], members[index], { type: 'EXACT_TEXT_DUPLICATE', confidence: 1 });
    }
  }

  const semanticBlocks = new Map();
  for (const occurrence of candidates) {
    for (const key of semanticBlockingKeys(occurrence)) {
      const members = semanticBlocks.get(key) ?? [];
      members.push(occurrence.candidate_occurrence_id);
      semanticBlocks.set(key, members);
    }
  }
  for (const rawMembers of semanticBlocks.values()) {
    const members = uniqueSorted(rawMembers);
    for (let leftIndex = 0; leftIndex < members.length; leftIndex += 1) {
      const upper = Math.min(members.length, leftIndex + 1 + SEMANTIC_WINDOW);
      for (let rightIndex = leftIndex + 1; rightIndex < upper; rightIndex += 1) {
        consider(members[leftIndex], members[rightIndex]);
      }
    }
  }

  const groups = new Map();
  for (const occurrence of candidates) {
    const root = disjoint.find(occurrence.candidate_occurrence_id);
    const members = groups.get(root) ?? [];
    members.push(occurrence);
    groups.set(root, members);
  }

  const concepts = [];
  const assignments = new Map();
  const edgesByOwnerRoot = new Map();
  const incidentEdges = new Map([...byId.keys()].map((occurrenceId) => [occurrenceId, []]));
  for (const edge of comparisonEdges) {
    const roots = [
      disjoint.find(edge.left_occurrence_id),
      disjoint.find(edge.right_occurrence_id),
    ].sort();
    if (roots[0] === roots[1] && edge.relationship_type !== 'NOT_DUPLICATE') {
      const ownerRoot = roots[0];
      const edges = edgesByOwnerRoot.get(ownerRoot) ?? [];
      edges.push(edge);
      edgesByOwnerRoot.set(ownerRoot, edges);
      incidentEdges.get(edge.left_occurrence_id).push(edge);
      incidentEdges.get(edge.right_occurrence_id).push(edge);
    }
  }
  for (const [root, members] of groups) {
    members.sort((left, right) => left.candidate_occurrence_id.localeCompare(right.candidate_occurrence_id));
    const edges = edgesByOwnerRoot.get(root) ?? [];
    const concept = conceptEnvelope(members, edges, byId);
    concepts.push(concept);
    for (const [index, member] of members.entries()) {
      const relatedEdges = incidentEdges.get(member.candidate_occurrence_id).filter(
        (edge) => edge.relationship_type !== 'NOT_DUPLICATE',
      );
      const strongest = relatedEdges.sort((left, right) => (
        right.confidence - left.confidence
        || left.relationship_type.localeCompare(right.relationship_type)
      ))[0] ?? null;
      assignments.set(member.candidate_occurrence_id, {
        conceptId: concept.provisional_concept_id,
        clusterId: concept.provisional_duplicate_cluster_id,
        relationshipType: strongest?.relationship_type ?? 'NOT_DUPLICATE',
        confidence: strongest?.confidence ?? 0,
        linkedIds: uniqueSorted(relatedEdges.map((edge) => (
          edge.left_occurrence_id === member.candidate_occurrence_id
            ? edge.right_occurrence_id : edge.left_occurrence_id
        ))),
        duplicateOrdinal: index,
        clusterSize: members.length,
      });
    }
  }

  const updatedOccurrences = occurrences.map((occurrence) => {
    const assignment = assignments.get(occurrence.candidate_occurrence_id);
    if (!assignment) return occurrence;
    const payload = { ...occurrence };
    delete payload.content_hash;
    const mayChangeDuplicateState = ['READY_FOR_DEDUPLICATION', 'DUPLICATE_CANDIDATE'].includes(
      occurrence.lifecycle_status,
    );
    const repeated = assignment.clusterSize > 1 && assignment.duplicateOrdinal > 0
      && mayChangeDuplicateState;
    return contentAddressedEnvelope({
      ...payload,
      extraction_class: repeated ? 'DUPLICATE_OCCURRENCE' : occurrence.extraction_class,
      secondary_tags: uniqueSorted([
        ...(occurrence.secondary_tags ?? []),
        repeated ? occurrence.extraction_class : null,
      ]),
      provisional_concept_id: assignment.conceptId,
      provisional_duplicate_cluster_id: assignment.clusterId,
      duplicate_relationship_type: assignment.relationshipType,
      duplicate_confidence: Number(assignment.confidence.toFixed(3)),
      linked_occurrence_ids: assignment.linkedIds,
      lifecycle_status: assignment.clusterSize > 1 && mayChangeDuplicateState
        ? 'DUPLICATE_CANDIDATE' : occurrence.lifecycle_status,
    });
  });

  concepts.sort((left, right) => left.provisional_concept_id.localeCompare(right.provisional_concept_id));
  return {
    occurrences: updatedOccurrences,
    concepts,
    duplicate_relationships: comparisonEdges.map((edge) => duplicateRelationship(edge, byId)),
    comparison_pair_count: compared.size,
    every_candidate_accounted: concepts.reduce((sum, concept) => sum + concept.occurrence_count, 0)
      === candidates.length,
    semantic_window_size: SEMANTIC_WINDOW,
    silent_member_truncation_count: 0,
    concept_root: stableHash(concepts.map((concept) => concept.content_hash).sort()),
    destructive_merge_performed: false,
  };
}

function legacyText(row) {
  if (typeof row === 'string') return row;
  if (!row || typeof row !== 'object') return '';
  for (const key of ['prompt', 'question', 'stem', 'text']) {
    if (typeof row[key] === 'string' && row[key].trim()) return row[key];
  }
  return '';
}

export function compareLegacy(concepts, legacyRows) {
  if (!Array.isArray(concepts) || !Array.isArray(legacyRows)) {
    throw new TypeError('legacy_compare_input_invalid');
  }
  const transcriptSignatures = new Map();
  for (const concept of concepts) {
    transcriptSignatures.set(
      tokenSignature(concept.normalized_concept_wording), concept.provisional_concept_id,
    );
  }
  const relationships = [];
  let legacyWithoutSupport = 0;
  for (let index = 0; index < legacyRows.length; index += 1) {
    const text = legacyText(legacyRows[index]);
    const signature = tokenSignature(text);
    const conceptId = transcriptSignatures.get(signature) ?? null;
    if (!conceptId) legacyWithoutSupport += 1;
    relationships.push({
      legacy_row_alias: deterministicId('legacy', index, stableHash(text)),
      relationship: conceptId
        ? 'LIKELY_OVERLAP_EXACT_TOKEN_SIGNATURE' : 'NO_ESTABLISHED_TRANSCRIPT_SUPPORT',
      provisional_concept_id: conceptId,
    });
  }
  const supportedConcepts = new Set(
    relationships.map((item) => item.provisional_concept_id).filter(Boolean),
  );
  return {
    legacy_row_count: legacyRows.length,
    likely_overlap_count: relationships.length - legacyWithoutSupport,
    transcript_concepts_absent_from_legacy_count: concepts.length - supportedConcepts.size,
    legacy_rows_with_possible_transcript_support_count: relationships.length - legacyWithoutSupport,
    legacy_rows_without_established_transcript_support_count: legacyWithoutSupport,
    unresolved_comparison_count: concepts.length + legacyRows.length,
    relationships,
    comparison_root: stableHash(relationships),
    qualification: 'PRELIMINARY_NONPROMOTING_COMPARISON_FOR_I1Q_1008F',
    legacy_promotions: 0,
    destructive_merge_performed: false,
  };
}
