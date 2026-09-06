#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_RESTRICTED_BOUNDARY,
  DEFAULT_WORKTREE_ROOT,
  DEFAULT_ALIAS_MAP_RELATIVE_PATH,
  assertBoundaryPath,
  postflightRestrictedBoundary,
  preflightRestrictedBoundary,
  readRestrictedFile,
  readRestrictedJson,
  writeRestrictedJson as boundaryWriteRestrictedJson,
} from './boundary.mjs';
import {
  contentAddressedEnvelope,
  deterministicId,
  sha256,
  stableHash,
  verifyContentAddressedEnvelope,
} from './canonical.mjs';
import {
  DUPLICATE_RELATIONSHIP_TYPES,
  EXTRACTION_CLASSES,
  LIFECYCLE_STATES,
  OBSERVED_NODES_COUNT,
  OBSERVED_TRANSCRIPT_COUNT,
  PARSER_VERSION,
  PASS_DEFINITIONS,
  REQUIRED_PASS_CELL_COUNT,
  SPEAKER_CLASSES,
} from './constants.mjs';
import {
  appendJournalEvent,
  buildArtifactLedger,
  createRunJournal,
  validateCoverage,
  validateJournal,
} from './ledger.mjs';
import { parseArtifactBuffer } from './parsers.mjs';
import { classifyMedicalDomain, runExtractionPasses } from './passes.mjs';
import { buildProvisionalConcepts, compareLegacy } from './provisional-dedupe.mjs';
import { assertSafeSerialization, projectSafeArtifacts } from './safe-export.mjs';
import { validateSchemaInstance } from './schema-validator.mjs';
import { artifactResultExpectationValid } from './acquire.mjs';
import {
  assertExtractionOperationLockHeld,
  withExtractionOperationLock,
} from './extraction-operation-lock.mjs';
import {
  buildSpecialistReviewPacket,
} from './specialist-review.mjs';
import {
  REQUIRED_SPECIALIST_ROLES,
  validatePublishedSpecialistFinalization,
} from './finalize-specialist-role-batches.mjs';
import { parseLegacyV4Migration } from '../../../../i1q-question-platform/src/source-factory/legacy-v4.mjs';

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKTREE_ROOT_FROM_MODULE = resolve(MODULE_ROOT, '../../..');
const ACQUISITION_STATE_PATH = 'state/acquisition-state.json';
const ACQUISITION_RECEIPT_PATH = 'audit/acquisition-receipt.json';
const EXTRACTION_STATE_PATH = 'state/extraction-state.json';
const JOURNAL_PATH = 'state/extraction-journal.json';
const CONCEPT_PATH = 'working/provisional-concepts.json';
const LEGACY_COMPARISON_PATH = 'working/legacy-comparison.json';
const DUPLICATE_RELATIONSHIP_PATH = 'working/provisional-duplicate-relationships.json';
const FINAL_INVENTORY_INDEX_PATH = 'working/full-occurrence-inventory-index.json';
const EXTRACTION_RECEIPT_PATH = 'audit/extraction-receipt.json';
const BOUNDARY_DECISION_PATH = 'audit/boundary-decision.json';
const NETWORK_TARGET_APPROVAL_PATH = 'audit/network-target-approval.json';
const BOUNDARY_DECISION_SHA256 =
  '3a80f9f30d2eb3f51cca470886ed12d8d457b9a83638f1771b1974dd6b1d881f';
const NETWORK_TARGET_APPROVAL_SHA256 =
  '4030577a7f48969171b8a036844a8aacb9dd837cb47ab8232ce0cd72a33e1b48';
const LEGACY_SQL_PATH = resolve(
  WORKTREE_ROOT_FROM_MODULE, 'supabase/migrations/20260420111000_stat_dataset_ingest.sql',
);
const LEGACY_PARSER_PATH = resolve(
  WORKTREE_ROOT_FROM_MODULE, 'i1q-question-platform/src/source-factory/legacy-v4.mjs',
);
const AUTHORITY_TICKET_SHA256 =
  '99a5c0d9f13c77fbcd20fbd57a6e1186fdf467f35e3657269fe99b23efeddb03';
const PREDECESSOR_COMMIT = '9af94d976572b20540d006084ef2c34eb3b3b9a5';
const PREDECESSOR_RECEIPT_SHA256 =
  '2c662642392f7fb4435c05ffb517f73c38bd8530065a3cb9044d2283189a252e';
const APPROVED_TARGETS_HASH =
  '98049a4872a62a47e5619f7b98b3db27a9bd9aa1b95641a322835e410d84997a';
const EXTRACTION_STATE_SCHEMA = 'missionmed.i1q1008e.restricted_extraction_state.v1';
const SHARD_SCHEMA = 'missionmed.i1q1008e.restricted_occurrence_shard.v1';
const PARSED_SHARD_SCHEMA = 'missionmed.i1q1008e.restricted_parsed_artifact.v1';
const PASS_SHARD_SCHEMA = 'missionmed.i1q1008e.restricted_pass_receipts.v1';
const SAFE_CODES = new Set([
  'acquisition_state_rejected', 'argument_rejected', 'artifact_processing_failed',
  'boundary_rejected', 'coverage_rejected', 'internal_failure', 'journal_rejected',
  'operation_lock_rejected',
  'legacy_estate_rejected', 'resume_state_rejected', 'safe_projection_rejected',
  'schema_instance_rejected', 'specialist_review_rejected',
]);

export class ExtractionError extends Error {
  constructor(code) {
    const safeCode = SAFE_CODES.has(code) ? code : 'internal_failure';
    super(safeCode);
    this.name = 'ExtractionError';
    this.code = safeCode;
  }
}

function fail(code) {
  throw new ExtractionError(code);
}

function controlledError(error) {
  if (error instanceof ExtractionError) return error.code;
  if (error?.name === 'ExtractionOperationLockError') return 'operation_lock_rejected';
  if (error?.name === 'BoundaryError') return 'boundary_rejected';
  if (error?.name === 'ParserError') return 'artifact_processing_failed';
  return 'internal_failure';
}

let activeExtractionOperationLock = null;

async function writeRestrictedJson(targetPath, value, options = {}) {
  assertExtractionOperationLockHeld(activeExtractionOperationLock);
  const result = await boundaryWriteRestrictedJson(targetPath, value, {
    ...options,
    mutationGuard: () => assertExtractionOperationLockHeld(activeExtractionOperationLock),
  });
  assertExtractionOperationLockHeld(activeExtractionOperationLock);
  return result;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseArgs(argv) {
  const options = {
    boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot: DEFAULT_WORKTREE_ROOT,
    dryRun: false,
    help: false,
  };
  const valueOptions = new Map([
    ['--boundary-root', 'boundaryRoot'],
    ['--worktree-root', 'worktreeRoot'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (raw === '--dry-run' || raw === '--self-test') {
      options.dryRun = true;
      continue;
    }
    if (raw === '--help' || raw === '-h') {
      options.help = true;
      continue;
    }
    const equalsAt = raw.indexOf('=');
    const flag = equalsAt === -1 ? raw : raw.slice(0, equalsAt);
    if (!valueOptions.has(flag)) fail('argument_rejected');
    const value = equalsAt === -1 ? argv[++index] : raw.slice(equalsAt + 1);
    if (typeof value !== 'string' || !value) fail('argument_rejected');
    options[valueOptions.get(flag)] = value;
  }
  return options;
}

async function loadSchemas() {
  const entries = await Promise.all([
    ['occurrence', 'schemas/restricted-occurrence.schema.json'],
    ['concept', 'schemas/provisional-concept.schema.json'],
    ['ledger', 'schemas/artifact-processing-ledger.schema.json'],
    ['specialistReview', 'schemas/specialist-review-receipt.schema.json'],
  ].map(async ([name, relativePath]) => [
    name, JSON.parse(await readFile(resolve(MODULE_ROOT, relativePath), 'utf8')),
  ]));
  return Object.fromEntries(entries);
}

function assertSchema(schema, value) {
  const validation = validateSchemaInstance(schema, value);
  if (!validation.valid || !verifyContentAddressedEnvelope(value)) {
    fail('schema_instance_rejected');
  }
}

export function assertOccurrenceIntegrity(occurrence) {
  if (!verifyContentAddressedEnvelope(occurrence)
      || !/^[a-f0-9]{64}$/u.test(occurrence.transcript_hash_binding ?? '')
      || typeof occurrence.source_alias !== 'string'
      || typeof occurrence.artifact_alias !== 'string'
      || !Array.isArray(occurrence.extraction_pass_bindings)
      || occurrence.extraction_pass_bindings.length < 1
      || (occurrence.nodes_assisted_relationships?.length > 0
        && (!/^[a-f0-9]{64}$/u.test(occurrence.nodes_hash_binding ?? '')
          || !occurrence.extraction_pass_bindings.includes('PASS_6')))) {
    fail('schema_instance_rejected');
  }
}

export function assertConceptIntegrity(concept) {
  if (!verifyContentAddressedEnvelope(concept)
      || concept.occurrence_count !== concept.occurrence_ids?.length
      || concept.duplicate_relationship_count !== concept.duplicate_relationships?.length
      || new Set(concept.occurrence_ids ?? []).size !== concept.occurrence_ids?.length) {
    fail('schema_instance_rejected');
  }
}

function sameStringSet(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.size
    && new Set(actual).size === actual.length
    && actual.every((value) => expected.has(value));
}

export function assertAcquisitionCohortMembership(state) {
  const rosterRawIds = (state?.roster ?? []).map((row) => row.raw_id);
  const candidateIds = new Set(state?.raw_candidate_ids ?? []);
  const transcriptAvailableRawIds = (state?.roster ?? []).filter(
    (row) => row.transcript_availability === 'AVAILABLE',
  ).map((row) => row.raw_id);
  const consumerProjectionIds = new Set(state?.consumer_projection_raw_ids ?? []);
  if (!sameStringSet(rosterRawIds, candidateIds)
      || !sameStringSet(transcriptAvailableRawIds, consumerProjectionIds)) {
    fail('acquisition_state_rejected');
  }
  return true;
}

export function assertCrossInventoryIntegrity({ occurrences, concepts }) {
  if (!Array.isArray(occurrences) || !Array.isArray(concepts)) {
    fail('schema_instance_rejected');
  }
  const occurrenceById = new Map();
  for (const occurrence of occurrences) {
    assertOccurrenceIntegrity(occurrence);
    const occurrenceId = occurrence.candidate_occurrence_id;
    if (typeof occurrenceId !== 'string' || occurrenceById.has(occurrenceId)) {
      fail('schema_instance_rejected');
    }
    occurrenceById.set(occurrenceId, occurrence);
  }

  const conceptIds = new Set();
  const clusterIds = new Set();
  const membership = new Map();
  const relationshipIds = new Set();
  for (const concept of concepts) {
    assertConceptIntegrity(concept);
    const conceptId = concept.provisional_concept_id;
    const clusterId = concept.provisional_duplicate_cluster_id;
    if (typeof conceptId !== 'string' || typeof clusterId !== 'string'
        || conceptIds.has(conceptId) || clusterIds.has(clusterId)) {
      fail('schema_instance_rejected');
    }
    conceptIds.add(conceptId);
    clusterIds.add(clusterId);

    const memberIds = new Set(concept.occurrence_ids);
    if (concept.provenance_bindings?.length !== memberIds.size) {
      fail('schema_instance_rejected');
    }
    const provenanceByOccurrence = new Map();
    for (const binding of concept.provenance_bindings) {
      if (provenanceByOccurrence.has(binding.occurrence_id)) fail('schema_instance_rejected');
      provenanceByOccurrence.set(binding.occurrence_id, binding);
    }
    for (const occurrenceId of memberIds) {
      const occurrence = occurrenceById.get(occurrenceId);
      const binding = provenanceByOccurrence.get(occurrenceId);
      if (!occurrence || !binding || membership.has(occurrenceId)
          || occurrence.provisional_concept_id !== conceptId
          || occurrence.provisional_duplicate_cluster_id !== clusterId
          || occurrence.extraction_run_id !== concept.extraction_run_id
          || binding.source_alias !== occurrence.source_alias
          || binding.artifact_alias !== occurrence.artifact_alias
          || binding.transcript_hash_binding !== occurrence.transcript_hash_binding
          || binding.nodes_hash_binding !== occurrence.nodes_hash_binding
          || binding.segment_locator_hash !== stableHash(occurrence.segment_locator)
          || binding.source_lineage_hash !== occurrence.source_lineage_hash) {
        fail('schema_instance_rejected');
      }
      membership.set(occurrenceId, conceptId);
    }

    const expectedNeighbors = new Map(
      [...memberIds].map((occurrenceId) => [occurrenceId, new Set()]),
    );
    const incidentRelationships = new Map(
      [...memberIds].map((occurrenceId) => [occurrenceId, []]),
    );
    for (const relationship of concept.duplicate_relationships) {
      const leftId = relationship.left_occurrence_id;
      const rightId = relationship.right_occurrence_id;
      if (typeof relationship.relationship_id !== 'string'
          || relationshipIds.has(relationship.relationship_id)
          || leftId === rightId
          || !memberIds.has(leftId)
          || !memberIds.has(rightId)
          || !occurrenceById.has(leftId)
          || !occurrenceById.has(rightId)
          || relationship.relationship_type === 'NOT_DUPLICATE') {
        fail('schema_instance_rejected');
      }
      relationshipIds.add(relationship.relationship_id);
      expectedNeighbors.get(leftId).add(rightId);
      expectedNeighbors.get(rightId).add(leftId);
      incidentRelationships.get(leftId).push(relationship);
      incidentRelationships.get(rightId).push(relationship);
    }

    if (memberIds.size > 1) {
      const [firstMember] = memberIds;
      const visited = new Set([firstMember]);
      const pending = [firstMember];
      while (pending.length > 0) {
        for (const neighbor of expectedNeighbors.get(pending.pop())) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            pending.push(neighbor);
          }
        }
      }
      if (visited.size !== memberIds.size) fail('schema_instance_rejected');
    }

    for (const occurrenceId of memberIds) {
      const occurrence = occurrenceById.get(occurrenceId);
      const expected = expectedNeighbors.get(occurrenceId);
      const incident = incidentRelationships.get(occurrenceId);
      if (!sameStringSet(occurrence.linked_occurrence_ids, expected)) {
        fail('schema_instance_rejected');
      }
      if (incident.length === 0) {
        if (occurrence.duplicate_relationship_type !== 'NOT_DUPLICATE'
            || occurrence.duplicate_confidence !== 0) {
          fail('schema_instance_rejected');
        }
      } else if (!incident.some((relationship) => (
        relationship.relationship_type === occurrence.duplicate_relationship_type
        && relationship.confidence === occurrence.duplicate_confidence
      ))) {
        fail('schema_instance_rejected');
      }
    }
  }

  for (const occurrence of occurrences) {
    const occurrenceId = occurrence.candidate_occurrence_id;
    const owningConceptId = membership.get(occurrenceId) ?? null;
    if (owningConceptId === null) {
      if (occurrence.provisional_concept_id !== null
          || occurrence.provisional_duplicate_cluster_id !== null
          || occurrence.duplicate_relationship_type !== 'NOT_DUPLICATE'
          || occurrence.duplicate_confidence !== 0
          || occurrence.linked_occurrence_ids?.length !== 0) {
        fail('schema_instance_rejected');
      }
    } else if (occurrence.provisional_concept_id !== owningConceptId) {
      fail('schema_instance_rejected');
    }
  }
}

export function assertDuplicateRelationshipInventoryIntegrity({
  relationships,
  occurrences,
  concepts,
}) {
  if (!Array.isArray(relationships) || !Array.isArray(occurrences) || !Array.isArray(concepts)) {
    fail('schema_instance_rejected');
  }
  const occurrenceById = new Map();
  for (const occurrence of occurrences) {
    if (typeof occurrence?.candidate_occurrence_id !== 'string'
        || occurrenceById.has(occurrence.candidate_occurrence_id)) {
      fail('schema_instance_rejected');
    }
    occurrenceById.set(occurrence.candidate_occurrence_id, occurrence);
  }
  const relationshipIds = new Set();
  const relationshipById = new Map();
  for (const relationship of relationships) {
    const expectedId = deterministicId(
      'relationship',
      relationship.left_occurrence_id,
      relationship.right_occurrence_id,
      relationship.relationship_type,
    );
    if (relationship.relationship_id !== expectedId
        || relationshipIds.has(relationship.relationship_id)
        || relationship.left_occurrence_id === relationship.right_occurrence_id
        || !occurrenceById.has(relationship.left_occurrence_id)
        || !occurrenceById.has(relationship.right_occurrence_id)
        || !DUPLICATE_RELATIONSHIP_TYPES.includes(relationship.relationship_type)
        || !Number.isFinite(relationship.confidence)
        || relationship.confidence < 0 || relationship.confidence > 1
        || !Array.isArray(relationship.basis_receipt_bindings)
        || relationship.basis_receipt_bindings.length < 1
        || relationship.adjudication_status !== 'DEFERRED_TO_I1Q_1008F') {
      fail('schema_instance_rejected');
    }
    const expectedBasis = [...new Set([
      occurrenceById.get(relationship.left_occurrence_id)?.processing_receipt_binding,
      occurrenceById.get(relationship.right_occurrence_id)?.processing_receipt_binding,
    ].filter((value) => typeof value === 'string' && value.length >= 8))].sort();
    if (expectedBasis.length > 0
        && !sameStringSet(relationship.basis_receipt_bindings, new Set(expectedBasis))) {
      fail('schema_instance_rejected');
    }
    relationshipIds.add(relationship.relationship_id);
    relationshipById.set(relationship.relationship_id, relationship);
  }
  for (const concept of concepts) {
    if (!Array.isArray(concept?.duplicate_relationships)) fail('schema_instance_rejected');
    for (const relationship of concept.duplicate_relationships) {
      const globalRelationship = relationshipById.get(relationship.relationship_id);
      if (!globalRelationship || stableHash(globalRelationship) !== stableHash(relationship)) {
        fail('schema_instance_rejected');
      }
    }
  }
  return true;
}

async function runContract() {
  const relativePaths = [
    'tools/acquire.mjs', 'tools/boundary.mjs', 'tools/canonical.mjs', 'tools/constants.mjs',
    'tools/extraction-operation-lock.mjs', 'tools/ledger.mjs', 'tools/parsers.mjs', 'tools/passes.mjs',
    'tools/provisional-dedupe.mjs', 'tools/run-extraction.mjs', 'tools/safe-export.mjs',
    'tools/schema-validator.mjs', 'tools/specialist-review.mjs',
    'tools/finalize-specialist-role-batches.mjs',
    'schemas/restricted-occurrence.schema.json',
    'schemas/provisional-concept.schema.json',
    'schemas/artifact-processing-ledger.schema.json',
    'schemas/specialist-review-receipt.schema.json',
  ];
  const files = [];
  for (const relativePath of relativePaths) {
    const bytes = await readFile(resolve(MODULE_ROOT, relativePath));
    files.push({ relative_path: relativePath, sha256: sha256(bytes) });
  }
  for (const [relativePath, absolutePath] of [
    ['worktree/i1q-question-platform/src/source-factory/legacy-v4.mjs', LEGACY_PARSER_PATH],
    ['worktree/supabase/migrations/20260420111000_stat_dataset_ingest.sql', LEGACY_SQL_PATH],
  ]) {
    files.push({ relative_path: relativePath, sha256: sha256(await readFile(absolutePath)) });
  }
  return contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.extraction_run_contract.v1',
    parser_version: PARSER_VERSION,
    pass_definitions: PASS_DEFINITIONS,
    files,
  });
}

function validateAcquisitionState(state) {
  if (!isPlainObject(state)
      || !verifyContentAddressedEnvelope(state)
      || state.schema_version !== 'missionmed.i1q1008e.restricted_acquisition_state.v1'
      || state.acquisition_complete !== true
      || state.approved_targets_hash !== APPROVED_TARGETS_HASH
      || state.predecessor_commit !== PREDECESSOR_COMMIT
      || state.predecessor_receipt_sha256 !== PREDECESSOR_RECEIPT_SHA256
      || state.boundary_decision_sha256 !== BOUNDARY_DECISION_SHA256
      || state.network_target_approval_sha256 !== NETWORK_TARGET_APPROVAL_SHA256
      || !Number.isSafeInteger(state.acquisition_invocation_ordinal)
      || state.acquisition_invocation_ordinal < 1
      || !Array.isArray(state.retry_events)
      || !/^[a-f0-9]{64}$/u.test(state.alias_map_sha256 ?? '')
      || !Array.isArray(state.raw_candidate_ids)
      || state.raw_candidate_ids.length !== 105
      || new Set(state.raw_candidate_ids).size !== 105
      || !Array.isArray(state.consumer_projection_raw_ids)
      || state.consumer_projection_raw_ids.length !== 97
      || new Set(state.consumer_projection_raw_ids).size !== 97
      || state.consumer_projection_raw_ids.some((id) => !state.raw_candidate_ids.includes(id))
      || !Array.isArray(state.roster)
      || state.roster.length !== 105
      || !Array.isArray(state.artifact_results)
      || state.artifact_results.length !== 210
      || state.denominator_counts?.transcript_available !== OBSERVED_TRANSCRIPT_COUNT
      || state.denominator_counts?.nodes_available !== OBSERVED_NODES_COUNT
      || state.denominator_counts?.paired !== 97
      || state.denominator_counts?.nodes_only !== 2
      || state.denominator_counts?.neither !== 6
      || state.predecessor_class_hash_set_match?.transcript_json !== true
      || state.predecessor_class_hash_set_match?.nodes_json !== true) {
    fail('acquisition_state_rejected');
  }
  const seenSources = new Set();
  const seenRosterRaw = new Set();
  const seenArtifacts = new Set();
  const resultsByKey = new Map();
  const retryEventKeys = new Set();
  for (const event of state.retry_events) {
    if (!isPlainObject(event)
        || typeof event.phase !== 'string'
        || !Number.isSafeInteger(event.invocation_ordinal)
        || event.invocation_ordinal < 1
        || event.invocation_ordinal > state.acquisition_invocation_ordinal
        || !Number.isSafeInteger(event.attempt_number)
        || event.attempt_number < 1) fail('acquisition_state_rejected');
    const key = `${event.phase}\0${event.artifact_alias ?? ''}\0${event.invocation_ordinal}\0${event.attempt_number}`;
    if (retryEventKeys.has(key)) fail('acquisition_state_rejected');
    retryEventKeys.add(key);
  }
  for (const result of state.artifact_results) {
    const key = `${result.raw_id}\0${result.artifact_class}`;
    if (resultsByKey.has(key) || seenArtifacts.has(result.artifact_alias)
        || !['transcript_json', 'nodes_json'].includes(result.artifact_class)
        || !artifactResultExpectationValid(result)) {
      fail('acquisition_state_rejected');
    }
    resultsByKey.set(key, result);
    seenArtifacts.add(result.artifact_alias);
  }
  for (const row of state.roster) {
    if (seenSources.has(row.source_alias) || seenRosterRaw.has(row.raw_id)) {
      fail('acquisition_state_rejected');
    }
    seenSources.add(row.source_alias);
    seenRosterRaw.add(row.raw_id);
    const transcript = resultsByKey.get(`${row.raw_id}\0transcript_json`);
    const nodes = resultsByKey.get(`${row.raw_id}\0nodes_json`);
    if (!transcript || !nodes
        || transcript.source_alias !== row.source_alias
        || nodes.source_alias !== row.source_alias
        || transcript.artifact_alias !== row.transcript_artifact_alias
        || nodes.artifact_alias !== row.nodes_artifact_alias
        || transcript.availability !== row.transcript_availability
        || nodes.availability !== row.nodes_availability
        || (transcript.content_hash ?? null) !== row.transcript_hash
        || (nodes.content_hash ?? null) !== row.nodes_hash) fail('acquisition_state_rejected');
  }
  assertAcquisitionCohortMembership(state);
  const available = state.artifact_results.filter((item) => item.availability === 'AVAILABLE');
  const transcriptRecords = available.filter((item) => item.artifact_class === 'transcript_json')
    .reduce((sum, item) => sum + Number(item.primary_record_count ?? 0), 0);
  const nodesRecords = available.filter((item) => item.artifact_class === 'nodes_json')
    .reduce((sum, item) => sum + Number(item.primary_record_count ?? 0), 0);
  const matrix = new Map();
  for (const item of state.artifact_results) {
    const key = `${item.direct_reference_integrity}:${item.availability}`;
    matrix.set(key, (matrix.get(key) ?? 0) + 1);
  }
  const identity = new Map();
  for (const item of available) {
    const key = `${item.artifact_class}:${item.identity_binding}`;
    identity.set(key, (identity.get(key) ?? 0) + 1);
  }
  if (transcriptRecords !== 81_604 || nodesRecords !== 82_510
      || matrix.size !== 3
      || matrix.get('DIRECT_REFERENCE_CORROBORATED:AVAILABLE') !== 196
      || matrix.get('DOCUMENTED_DERIVATION_ONLY:NOT_AVAILABLE') !== 12
      || matrix.get('DIRECT_REFERENCE_REJECTED:NOT_AVAILABLE') !== 2
      || identity.size !== 3
      || identity.get('transcript_json:LOCATOR_AND_PAYLOAD') !== 97
      || identity.get('nodes_json:LOCATOR_AND_PAYLOAD') !== 97
      || identity.get('nodes_json:LOCATOR_ONLY') !== 2) fail('acquisition_state_rejected');
  return state;
}

function validateAcquisitionReceipt(receipt, state) {
  const artifactResultRoot = stableHash(state.artifact_results.map((item) => ({
    artifact_alias: item.artifact_alias,
    artifact_class: item.artifact_class,
    direct_reference_integrity: item.direct_reference_integrity,
    expected_availability: item.expected_availability,
    availability: item.availability,
    content_hash: item.content_hash ?? null,
  })));
  if (!isPlainObject(receipt)
      || !verifyContentAddressedEnvelope(receipt)
      || receipt.schema_version !== 'missionmed.i1q1008e.restricted_acquisition_receipt.v1'
      || receipt.extraction_run_id !== state.extraction_run_id
      || receipt.approved_targets_hash !== APPROVED_TARGETS_HASH
      || receipt.predecessor_commit !== PREDECESSOR_COMMIT
      || receipt.predecessor_receipt_sha256 !== PREDECESSOR_RECEIPT_SHA256
      || receipt.boundary_decision_sha256 !== BOUNDARY_DECISION_SHA256
      || receipt.network_target_approval_sha256 !== NETWORK_TARGET_APPROVAL_SHA256
      || receipt.acquisition_invocation_ordinal !== state.acquisition_invocation_ordinal
      || receipt.alias_map_sha256 !== state.alias_map_sha256
      || receipt.acquisition_state_hash !== state.content_hash
      || receipt.candidate_count !== 105
      || receipt.consumer_projection_count !== 97
      || stableHash(receipt.counts) !== stableHash(state.denominator_counts)
      || receipt.predecessor_class_hash_set_match?.transcript_json !== true
      || receipt.predecessor_class_hash_set_match?.nodes_json !== true
      || receipt.artifact_result_root !== artifactResultRoot
      || receipt.acquisition_complete !== true) fail('acquisition_state_rejected');
}

function rosterRoot(state) {
  return stableHash(state.roster.map((row) => ({
    source_alias: row.source_alias,
    transcript_artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    nodes_artifact_alias: row.nodes_artifact_alias,
    nodes_hash: row.nodes_hash,
  })));
}

async function loadResumeState(options, contractHash, expectedRosterRoot, extractionRunId) {
  let state = null;
  try {
    state = await readRestrictedJson(EXTRACTION_STATE_PATH, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
  } catch (error) {
    if (!(error?.name === 'BoundaryError' && error.code === 'boundary_missing')) throw error;
  }
  if (state && (!verifyContentAddressedEnvelope(state)
      || state.schema_version !== EXTRACTION_STATE_SCHEMA
      || state.extraction_run_id !== extractionRunId
      || state.run_contract_hash !== contractHash
      || state.roster_root !== expectedRosterRoot
      || !Array.isArray(state.artifacts))) fail('resume_state_rejected');
  let journal = null;
  try {
    journal = await readRestrictedJson(JOURNAL_PATH, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
  } catch (error) {
    if (!(error?.name === 'BoundaryError' && error.code === 'boundary_missing')) throw error;
  }
  if (!journal) journal = createRunJournal({
    extractionRunId, runContractHash: contractHash, rosterRoot: expectedRosterRoot,
  });
  if (validateJournal(journal).length > 0
      || journal.run_contract_hash !== contractHash
      || journal.roster_root !== expectedRosterRoot) fail('journal_rejected');
  return {
    state: state ?? {
      schema_version: EXTRACTION_STATE_SCHEMA,
      extraction_run_id: extractionRunId,
      run_contract_hash: contractHash,
      roster_root: expectedRosterRoot,
      artifacts: [],
      lane_b_nodes_only: [],
      extraction_complete: false,
    },
    journal,
  };
}

function shardPaths(artifactAlias) {
  return {
    parsedTranscript: `working/parsed-transcripts/${artifactAlias}.json`,
    parsedNodes: `working/parsed-nodes/${artifactAlias}.json`,
    occurrences: `working/occurrences/${artifactAlias}.json`,
    dedupedOccurrences: `working/deduped-occurrences/${artifactAlias}.json`,
    passes: `working/pass-receipts/${artifactAlias}.json`,
    unmatchedNodes: `working/lane-b-unmatched-nodes/${artifactAlias}.json`,
    retrievalReceipt: `audit/retrieval-receipts/${artifactAlias}.json`,
    processingReceipt: `audit/processing-receipts/${artifactAlias}.json`,
    automatedReviewReceipt: `reviews/automated-provisional/${artifactAlias}.json`,
  };
}

function journalArtifactComplete(journal, row, passReceipts, contract) {
  const parserHash = contract.files.find(
    (item) => item.relative_path === 'tools/parsers.mjs',
  )?.sha256;
  const events = journal.events.filter((event) => event.artifact_alias === row.transcript_artifact_alias);
  if (events.length !== PASS_DEFINITIONS.length) return false;
  return PASS_DEFINITIONS.every((definition) => {
    const receipt = passReceipts.find((item) => item.pass_id === definition.pass_id);
    const matches = events.filter((event) => event.pass_id === definition.pass_id);
    return receipt && matches.length === 1
      && matches[0].input_hash === row.transcript_hash
      && matches[0].rules_hash === contract.content_hash
      && matches[0].parser_hash === parserHash
      && matches[0].state_transition === 'NOT_STARTED_TO_COMPLETE'
      && matches[0].output_shard_hash === receipt.proposal_root;
  });
}

function canonicalSuccessfulJournal(transcriptRows, summaries, contract, rosterRootValue) {
  const summaryByAlias = new Map(summaries.map((summary) => [summary.artifact_alias, summary]));
  const parserHash = contract.files.find(
    (item) => item.relative_path === 'tools/parsers.mjs',
  ).sha256;
  let canonical = createRunJournal({
    extractionRunId: contract.extraction_run_id,
    runContractHash: contract.content_hash,
    rosterRoot: rosterRootValue,
  });
  for (const row of transcriptRows) {
    const summary = summaryByAlias.get(row.transcript_artifact_alias);
    if (!summary || !['COMPLETE', 'COMPLETE_WITH_QUARANTINE'].includes(
      summary.final_artifact_status,
    )) return null;
    for (const definition of PASS_DEFINITIONS) {
      const receipt = summary.pass_receipts.find((item) => item.pass_id === definition.pass_id);
      if (!receipt || receipt.status !== 'COMPLETE') return null;
      canonical = appendJournalEvent(canonical, {
        artifact_alias: row.transcript_artifact_alias,
        phase: definition.pass_id,
        pass_id: definition.pass_id,
        attempt_number: Number(summary.successful_attempt_number ?? 1),
        input_hash: row.transcript_hash,
        rules_hash: contract.content_hash,
        parser_hash: parserHash,
        state_transition: 'NOT_STARTED_TO_COMPLETE',
        output_shard_hash: receipt.proposal_root,
      });
    }
  }
  return canonical;
}

function exactSuccessfulJournal(journal, transcriptRows, summaries, contract) {
  if (validateJournal(journal).length > 0
      || journal.events.length !== REQUIRED_PASS_CELL_COUNT
      || new Set(journal.events.map((event) => (
        `${event.artifact_alias}\0${event.pass_id}`
      ))).size !== REQUIRED_PASS_CELL_COUNT) return false;
  const summaryByAlias = new Map(summaries.map((summary) => [summary.artifact_alias, summary]));
  return transcriptRows.every((row) => {
    const summary = summaryByAlias.get(row.transcript_artifact_alias);
    return summary && journalArtifactComplete(journal, row, summary.pass_receipts, contract);
  });
}

export function artifactReceiptBindingsValid({
  summary,
  row,
  occurrenceShard,
  passShard,
  retrievalReceipt,
  processingReceipt,
  automatedReviewReceipt,
  contract,
}) {
  if (!summary || !row || !contract
      || !Array.isArray(summary.pass_receipts)
      || !Array.isArray(passShard?.pass_receipts)
      || stableHash(summary.pass_receipts) !== stableHash(passShard.pass_receipts)) return false;
  const expectedRetrievalId = deterministicId(
    'receipt', row.transcript_artifact_alias, row.transcript_hash, row.nodes_hash, 'retrieval',
  );
  const expectedProcessingId = deterministicId(
    'receipt', row.transcript_artifact_alias, contract.content_hash,
    row.transcript_hash, row.nodes_hash,
  );
  const expectedMedicalReviewId = deterministicId(
    'review', row.transcript_artifact_alias, contract.content_hash,
    'MEDICAL_AUTOMATED_PROVISIONAL',
  );
  const expectedAssessmentReviewId = deterministicId(
    'review', row.transcript_artifact_alias, contract.content_hash,
    'ASSESSMENT_AUTOMATED_PROVISIONAL',
  );
  const pass7Root = passShard.pass_receipts.find((item) => item.pass_id === 'PASS_7')?.proposal_root;
  const expectedReviews = [
    {
      receipt_id: expectedMedicalReviewId,
      reviewer_role: 'OSLER_AUTOMATED_PROVISIONAL',
      review_kind: 'MEDICAL',
      authority_scope: 'AUTOMATED_PROVISIONAL_NOT_CREDENTIALED_PHYSICIAN_APPROVAL',
    },
    {
      receipt_id: expectedAssessmentReviewId,
      reviewer_role: 'ASSESSMENT_SCIENCE_AUTOMATED_PROVISIONAL',
      review_kind: 'ASSESSMENT',
      authority_scope: 'AUTOMATED_PROVISIONAL_NOT_FINAL_ASSESSMENT_APPROVAL',
    },
  ];
  return retrievalReceipt?.schema_version === 'missionmed.i1q1008e.restricted_retrieval_receipt.v1'
    && retrievalReceipt.receipt_id === expectedRetrievalId
    && retrievalReceipt.receipt_id === summary.retrieval_receipt_id
    && retrievalReceipt.content_hash === summary.retrieval_receipt_hash
    && retrievalReceipt.extraction_run_id === contract.extraction_run_id
    && retrievalReceipt.acquisition_state_hash === contract.acquisition_state_hash
    && retrievalReceipt.source_alias === row.source_alias
    && retrievalReceipt.transcript_artifact_alias === row.transcript_artifact_alias
    && retrievalReceipt.transcript_hash === row.transcript_hash
    && retrievalReceipt.transcript_locator === row.transcript_locator
    && retrievalReceipt.nodes_artifact_alias === row.nodes_artifact_alias
    && retrievalReceipt.nodes_hash === row.nodes_hash
    && retrievalReceipt.nodes_locator === row.nodes_locator
    && retrievalReceipt.transcript_availability === row.transcript_availability
    && retrievalReceipt.nodes_availability === row.nodes_availability
    && processingReceipt?.schema_version === 'missionmed.i1q1008e.restricted_processing_receipt.v1'
    && processingReceipt.receipt_id === expectedProcessingId
    && processingReceipt.receipt_id === summary.processing_receipt_id
    && processingReceipt.content_hash === summary.processing_receipt_hash
    && processingReceipt.extraction_run_id === contract.extraction_run_id
    && processingReceipt.run_contract_hash === contract.content_hash
    && processingReceipt.source_alias === row.source_alias
    && processingReceipt.artifact_alias === row.transcript_artifact_alias
    && processingReceipt.transcript_hash === row.transcript_hash
    && processingReceipt.nodes_hash === row.nodes_hash
    && processingReceipt.pass_receipt_root === stableHash(passShard.pass_receipts)
    && processingReceipt.occurrence_set_root === stableHash(
      occurrenceShard.occurrences.map((item) => item.content_hash).sort(),
    )
    && processingReceipt.occurrence_count === occurrenceShard.occurrences.length
    && processingReceipt.automated_provisional_review_only === true
    && processingReceipt.credentialed_medical_approval_performed === false
    && processingReceipt.learner_release_performed === false
    && automatedReviewReceipt?.schema_version
      === 'missionmed.i1q1008e.restricted_automated_provisional_review_receipts.v1'
    && automatedReviewReceipt.content_hash === summary.automated_review_receipt_hash
    && automatedReviewReceipt.extraction_run_id === contract.extraction_run_id
    && automatedReviewReceipt.run_contract_hash === contract.content_hash
    && automatedReviewReceipt.source_alias === row.source_alias
    && automatedReviewReceipt.artifact_alias === row.transcript_artifact_alias
    && automatedReviewReceipt.credentialed_physician_review_performed === false
    && automatedReviewReceipt.final_governance_approval_performed === false
    && Array.isArray(automatedReviewReceipt.reviews)
    && automatedReviewReceipt.reviews.length === expectedReviews.length
    && automatedReviewReceipt.reviews.every((receipt, index) => (
      verifyContentAddressedEnvelope(receipt)
      && receipt.receipt_id === expectedReviews[index].receipt_id
      && receipt.reviewer_role === expectedReviews[index].reviewer_role
      && receipt.review_kind === expectedReviews[index].review_kind
      && receipt.authority_scope === expectedReviews[index].authority_scope
      && receipt.pass_7_proposal_root === pass7Root
      && receipt.disposition === 'REVIEW_REQUIRED'
    ));
}

async function reusableArtifact(summary, row, options, schemas, contract, journal) {
  const contractHash = contract.content_hash;
  if (!summary || summary.final_artifact_status === 'FAILED_WITH_PROVEN_BLOCKER'
      || summary.source_alias !== row.source_alias
      || summary.artifact_alias !== row.transcript_artifact_alias
      || summary.transcript_hash !== row.transcript_hash
      || summary.nodes_hash !== row.nodes_hash
      || summary.run_contract_hash !== contractHash) return null;
  try {
    const paths = shardPaths(row.transcript_artifact_alias);
    const occurrenceShard = await readRestrictedJson(paths.occurrences, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
    const passShard = await readRestrictedJson(paths.passes, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
    const retrievalReceipt = await readRestrictedJson(paths.retrievalReceipt, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
    const processingReceipt = await readRestrictedJson(paths.processingReceipt, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
    const automatedReviewReceipt = await readRestrictedJson(paths.automatedReviewReceipt, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
    if (!verifyContentAddressedEnvelope(occurrenceShard)
        || !verifyContentAddressedEnvelope(passShard)
        || !verifyContentAddressedEnvelope(retrievalReceipt)
        || !verifyContentAddressedEnvelope(processingReceipt)
        || !verifyContentAddressedEnvelope(automatedReviewReceipt)
        || occurrenceShard.content_hash !== summary.occurrence_shard_hash
        || passShard.content_hash !== summary.pass_shard_hash
        || occurrenceShard.schema_version !== SHARD_SCHEMA
        || passShard.schema_version !== PASS_SHARD_SCHEMA
        || occurrenceShard.extraction_run_id !== contract.extraction_run_id
        || passShard.extraction_run_id !== contract.extraction_run_id
        || occurrenceShard.run_contract_hash !== contractHash
        || passShard.run_contract_hash !== contractHash
        || occurrenceShard.source_alias !== row.source_alias
        || passShard.source_alias !== row.source_alias
        || occurrenceShard.artifact_alias !== row.transcript_artifact_alias
        || passShard.artifact_alias !== row.transcript_artifact_alias
        || occurrenceShard.transcript_hash !== row.transcript_hash
        || occurrenceShard.nodes_hash !== row.nodes_hash
        || !artifactReceiptBindingsValid({
          summary, row, occurrenceShard, passShard, retrievalReceipt,
          processingReceipt, automatedReviewReceipt, contract,
        })
        || passShard.pass_receipts.length !== 9
        || passShard.pass_receipts.some((receipt, index) => (
          receipt.status !== 'COMPLETE' || receipt.pass_id !== PASS_DEFINITIONS[index].pass_id
        ))
        || !journalArtifactComplete(journal, row, passShard.pass_receipts, contract)) return null;
    for (const occurrence of occurrenceShard.occurrences) {
      assertSchema(schemas.occurrence, occurrence);
      assertOccurrenceIntegrity(occurrence);
      if (occurrence.source_alias !== row.source_alias
          || occurrence.artifact_alias !== row.transcript_artifact_alias
          || occurrence.transcript_hash_binding !== row.transcript_hash
          || occurrence.retrieval_receipt_binding !== retrievalReceipt.receipt_id
          || occurrence.processing_receipt_binding !== processingReceipt.receipt_id
          || !occurrence.agent_review_receipts.every((receiptId) => (
            automatedReviewReceipt.reviews.some((receipt) => receipt.receipt_id === receiptId)
          ))) return null;
    }
    return { summary, occurrenceShard, passShard, reused: true };
  } catch {
    return null;
  }
}

function classificationCounts(occurrences) {
  const quarantineCount = occurrences.filter((item) => (
    item.lifecycle_status.endsWith('_QUARANTINED') || item.lifecycle_status === 'AMBIGUOUS'
  )).length;
  const rejectionCount = occurrences.filter((item) => item.lifecycle_status.startsWith('REJECTED_')).length;
  return { quarantineCount, rejectionCount };
}

function artifactFailureCanBeIsolated(error) {
  if (error?.name === 'BoundaryError') return error.code === 'boundary_missing';
  if (String(error?.message ?? '').startsWith('journal_')) return false;
  return true;
}

export async function executeWithBoundedIsolation(items, {
  maximumAttempts = 2,
  worker,
  blocker,
  isolatable = () => true,
  onAttemptFailure = async () => {},
  onSettled = async () => {},
} = {}) {
  if (!Array.isArray(items)
      || !Number.isSafeInteger(maximumAttempts)
      || maximumAttempts < 1
      || typeof worker !== 'function'
      || typeof blocker !== 'function'
      || typeof isolatable !== 'function'
      || typeof onAttemptFailure !== 'function'
      || typeof onSettled !== 'function') throw new TypeError('isolation_contract_invalid');
  const results = [];
  for (const [index, item] of items.entries()) {
    let result = null;
    let lastError = null;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        result = await worker(item, index, attempt);
        break;
      } catch (error) {
        if (!isolatable(error, item, index, attempt)) throw error;
        lastError = error;
        await onAttemptFailure(error, item, index, attempt, maximumAttempts);
      }
    }
    if (result === null) {
      result = await blocker(item, index, lastError, maximumAttempts);
    }
    results.push(result);
    await onSettled(result, item, index, [...results]);
  }
  return results;
}

export function artifactFailureEvidence(row, contract, error, actualAttemptNumber, willRetry) {
  if (!Number.isSafeInteger(actualAttemptNumber) || actualAttemptNumber < 1
      || typeof willRetry !== 'boolean') fail('artifact_processing_failed');
  const controlledCode = controlledError(error).toUpperCase();
  const receiptId = deterministicId(
    'receipt', row.transcript_artifact_alias, contract.content_hash,
    'artifact-attempt-failure', actualAttemptNumber, controlledCode,
  );
  return contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_artifact_failure_receipt.v1',
    receipt_id: receiptId,
    extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash,
    source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    nodes_hash: row.nodes_hash,
    controlled_error_class: controlledCode,
    error_source_class: error?.name === 'BoundaryError'
      ? 'RESTRICTED_BOUNDARY' : error?.name === 'ParserError' ? 'PARSER' : 'EXTRACTION',
    attempt_number: actualAttemptNumber,
    recovery_action_scheduled: willRetry ? 'BOUNDED_ARTIFACT_RETRY' : 'NONE',
    recovery_methods_completed_before_attempt: actualAttemptNumber > 1
      ? ['BOUNDED_ARTIFACT_RETRY'] : [],
    raw_error_message_persisted: false,
  });
}

async function persistArtifactFailureEvidence(row, options, contract, error, actualAttemptNumber, willRetry) {
  const receipt = artifactFailureEvidence(
    row, contract, error, actualAttemptNumber, willRetry,
  );
  await writeRestrictedJson(
    `audit/artifact-failures/${row.transcript_artifact_alias}-attempt-${actualAttemptNumber}.json`,
    receipt,
    { boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot },
  );
  return {
    attempt_number: actualAttemptNumber,
    controlled_error_class: receipt.controlled_error_class,
    receipt_id: receipt.receipt_id,
    receipt_hash: receipt.content_hash,
    recovery_action_scheduled: receipt.recovery_action_scheduled,
    recovery_methods_completed_before_attempt: receipt.recovery_methods_completed_before_attempt,
  };
}

async function failedArtifactResult(
  row, options, contract, journal, error, attemptCount, priorSummary = null,
  failureHistory = [],
) {
  const paths = shardPaths(row.transcript_artifact_alias);
  const controlledCode = controlledError(error).toUpperCase();
  const finalFailure = failureHistory.at(-1);
  if (!finalFailure || finalFailure.controlled_error_class !== controlledCode) {
    fail('artifact_processing_failed');
  }
  const safeDiagnosticHash = finalFailure.receipt_hash;
  const completedRecoveryMethods = failureHistory.length > 1
    ? ['BOUNDED_ARTIFACT_RETRY'] : [];
  const passReceipts = PASS_DEFINITIONS.map((definition) => ({
    pass_id: definition.pass_id,
    status: 'FAILED_WITH_PROVEN_BLOCKER',
    attempt_count: finalFailure.attempt_number,
    records_inspected: 0,
    proposals_emitted: 0,
    proposal_root: stableHash([
      row.transcript_artifact_alias, definition.pass_id, safeDiagnosticHash,
    ]),
    blocker_root_cause: controlledCode,
    recovery_methods: completedRecoveryMethods,
    evidence_receipt_id: finalFailure.receipt_id,
    resumable_next_step: `Resume ${definition.pass_id} from the protected acquisition checkpoint.`,
  }));
  const occurrenceShard = contentAddressedEnvelope({
    schema_version: SHARD_SCHEMA,
    extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash,
    source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    nodes_hash: row.nodes_hash,
    occurrences: [],
    blocker_safe_diagnostic_hash: safeDiagnosticHash,
  });
  const passShard = contentAddressedEnvelope({
    schema_version: PASS_SHARD_SCHEMA,
    extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash,
    source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias,
    pass_receipts: passReceipts,
    nodes_unmatched_medical_count: 0,
    unmatched_medical_nodes: [],
    blocker_safe_diagnostic_hash: safeDiagnosticHash,
  });
  await writeRestrictedJson(paths.occurrences, occurrenceShard, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  await writeRestrictedJson(paths.passes, passShard, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  const parserHash = contract.files.find(
    (item) => item.relative_path === 'tools/parsers.mjs',
  ).sha256;
  for (const receipt of passReceipts) {
    journal = appendJournalEvent(journal, {
      artifact_alias: row.transcript_artifact_alias,
      phase: receipt.pass_id,
      pass_id: receipt.pass_id,
      attempt_number: finalFailure.attempt_number,
      input_hash: row.transcript_hash,
      rules_hash: contract.content_hash,
      parser_hash: parserHash,
      state_transition: 'NOT_STARTED_TO_FAILED_WITH_PROVEN_BLOCKER',
      controlled_error_class: controlledCode,
      safe_diagnostic_hash: safeDiagnosticHash,
      recovery_action: completedRecoveryMethods.at(-1) ?? null,
      output_shard_hash: receipt.proposal_root,
    });
  }
  const summary = {
    source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    nodes_hash: row.nodes_hash,
    run_contract_hash: contract.content_hash,
    segment_count: 0,
    nodes_record_count: 0,
    records_with_text_count: 0,
    malformed_record_count: 0,
    candidate_count: 0,
    quarantine_count: 0,
    rejection_count: 0,
    pass_receipts: passReceipts,
    occurrence_shard_hash: occurrenceShard.content_hash,
    pass_shard_hash: passShard.content_hash,
    final_artifact_status: 'FAILED_WITH_PROVEN_BLOCKER',
    retry_count: priorSummary
      ? Number(priorSummary.retry_count ?? 0) + attemptCount
      : Math.max(0, attemptCount - 1),
    blocker_root_cause: controlledCode,
    recovery_methods: completedRecoveryMethods,
    resumable_next_step: 'Resume this artifact from the protected acquisition checkpoint.',
    safe_diagnostic_hash: safeDiagnosticHash,
    failure_receipt_id: finalFailure.receipt_id,
    failure_receipt_hash: finalFailure.receipt_hash,
    transient_failure_events: failureHistory,
  };
  return { summary, occurrenceShard, passShard, journal, reused: false, blocked: true };
}

async function processArtifact(
  row, options, schemas, contract, priorSummary, journal, successfulAttemptNumber = 1,
) {
  const reusable = await reusableArtifact(
    priorSummary, row, options, schemas, contract, journal,
  );
  if (reusable) return { ...reusable, journal };
  const paths = shardPaths(row.transcript_artifact_alias);
  const transcriptBytes = await readRestrictedFile(`raw/${row.transcript_artifact_alias}.json`, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    maximumBytes: 64 * 1024 * 1024,
  });
  const transcript = parseArtifactBuffer(transcriptBytes, 'transcript_json', row.transcript_hash);
  let nodes = null;
  if (row.nodes_availability === 'AVAILABLE') {
    const nodesBytes = await readRestrictedFile(`raw/${row.nodes_artifact_alias}.json`, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
      maximumBytes: 64 * 1024 * 1024,
    });
    nodes = parseArtifactBuffer(nodesBytes, 'nodes_json', row.nodes_hash);
  }
  const processingReceipt = deterministicId(
    'receipt', row.transcript_artifact_alias, contract.content_hash, row.transcript_hash, row.nodes_hash,
  );
  const retrievalReceipt = deterministicId(
    'receipt', row.transcript_artifact_alias, row.transcript_hash, row.nodes_hash, 'retrieval',
  );
  const medicalReviewReceipt = deterministicId(
    'review', row.transcript_artifact_alias, contract.content_hash, 'MEDICAL_AUTOMATED_PROVISIONAL',
  );
  const assessmentReviewReceipt = deterministicId(
    'review', row.transcript_artifact_alias, contract.content_hash, 'ASSESSMENT_AUTOMATED_PROVISIONAL',
  );
  const result = runExtractionPasses({
    transcriptRecords: transcript.records,
    nodesRecords: nodes?.records ?? [],
    context: {
      extraction_run_id: contract.extraction_run_id,
      source_alias: row.source_alias,
      transcript_artifact_alias: row.transcript_artifact_alias,
      transcript_hash: row.transcript_hash,
      nodes_hash: row.nodes_hash,
      source_lineage_hash: stableHash({
        source_alias: row.source_alias,
        transcript_hash: row.transcript_hash,
        nodes_hash: row.nodes_hash,
      }),
      retrieval_receipt_binding: deterministicId(
        'receipt', row.transcript_artifact_alias, row.transcript_hash, row.nodes_hash, 'retrieval',
      ),
      processing_receipt_binding: processingReceipt,
      medical_review_receipt_binding: medicalReviewReceipt,
      assessment_review_receipt_binding: assessmentReviewReceipt,
    },
  });
  for (const occurrence of result.occurrences) {
    assertSchema(schemas.occurrence, occurrence);
    assertOccurrenceIntegrity(occurrence);
  }
  const parsedTranscriptShard = contentAddressedEnvelope({
    schema_version: PARSED_SHARD_SCHEMA,
    extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash,
    source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias,
    artifact_hash: row.transcript_hash,
    parsed: transcript,
  });
  const parsedNodesShard = nodes ? contentAddressedEnvelope({
    schema_version: PARSED_SHARD_SCHEMA,
    extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash,
    source_alias: row.source_alias,
    artifact_alias: row.nodes_artifact_alias,
    artifact_hash: row.nodes_hash,
    parsed: nodes,
  }) : null;
  const occurrenceShard = contentAddressedEnvelope({
    schema_version: SHARD_SCHEMA,
    extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash,
    source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    nodes_hash: row.nodes_hash,
    occurrences: result.occurrences,
  });
  const passShard = contentAddressedEnvelope({
    schema_version: PASS_SHARD_SCHEMA,
    extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash,
    source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias,
    pass_receipts: result.pass_receipts,
    nodes_unmatched_medical_count: result.nodes_unmatched_medical_count,
    unmatched_medical_nodes: result.unmatched_medical_nodes,
  });
  const retrievalReceiptEnvelope = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_retrieval_receipt.v1',
    receipt_id: retrievalReceipt,
    extraction_run_id: contract.extraction_run_id,
    acquisition_state_hash: contract.acquisition_state_hash,
    source_alias: row.source_alias,
    transcript_artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    transcript_locator: row.transcript_locator,
    nodes_artifact_alias: row.nodes_artifact_alias,
    nodes_hash: row.nodes_hash,
    nodes_locator: row.nodes_locator,
    transcript_availability: row.transcript_availability,
    nodes_availability: row.nodes_availability,
  });
  const processingReceiptEnvelope = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_processing_receipt.v1',
    receipt_id: processingReceipt,
    extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash,
    source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    nodes_hash: row.nodes_hash,
    pass_receipt_root: stableHash(result.pass_receipts),
    occurrence_set_root: stableHash(result.occurrences.map((item) => item.content_hash).sort()),
    occurrence_count: result.occurrences.length,
    automated_provisional_review_only: true,
    credentialed_medical_approval_performed: false,
    learner_release_performed: false,
  });
  const automatedReviewReceiptEnvelope = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_automated_provisional_review_receipts.v1',
    extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash,
    source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias,
    reviews: [
      contentAddressedEnvelope({
        receipt_id: medicalReviewReceipt,
        reviewer_role: 'OSLER_AUTOMATED_PROVISIONAL',
        review_kind: 'MEDICAL',
        authority_scope: 'AUTOMATED_PROVISIONAL_NOT_CREDENTIALED_PHYSICIAN_APPROVAL',
        pass_7_proposal_root: result.pass_receipts.find(
          (item) => item.pass_id === 'PASS_7',
        ).proposal_root,
        disposition: 'REVIEW_REQUIRED',
      }),
      contentAddressedEnvelope({
        receipt_id: assessmentReviewReceipt,
        reviewer_role: 'ASSESSMENT_SCIENCE_AUTOMATED_PROVISIONAL',
        review_kind: 'ASSESSMENT',
        authority_scope: 'AUTOMATED_PROVISIONAL_NOT_FINAL_ASSESSMENT_APPROVAL',
        pass_7_proposal_root: result.pass_receipts.find(
          (item) => item.pass_id === 'PASS_7',
        ).proposal_root,
        disposition: 'REVIEW_REQUIRED',
      }),
    ],
    credentialed_physician_review_performed: false,
    final_governance_approval_performed: false,
  });
  await writeRestrictedJson(paths.retrievalReceipt, retrievalReceiptEnvelope, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  await writeRestrictedJson(paths.processingReceipt, processingReceiptEnvelope, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  await writeRestrictedJson(paths.automatedReviewReceipt, automatedReviewReceiptEnvelope, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  await writeRestrictedJson(paths.parsedTranscript, parsedTranscriptShard, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  if (parsedNodesShard) await writeRestrictedJson(paths.parsedNodes, parsedNodesShard, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  await writeRestrictedJson(paths.occurrences, occurrenceShard, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  await writeRestrictedJson(paths.passes, passShard, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  if (result.unmatched_medical_nodes.length > 0) {
    await writeRestrictedJson(paths.unmatchedNodes, contentAddressedEnvelope({
      schema_version: 'missionmed.i1q1008e.restricted_unmatched_nodes_reconciliation.v1',
      extraction_run_id: contract.extraction_run_id,
      run_contract_hash: contract.content_hash,
      source_alias: row.source_alias,
      transcript_artifact_alias: row.transcript_artifact_alias,
      nodes_artifact_alias: row.nodes_artifact_alias,
      nodes_hash: row.nodes_hash,
      disposition: 'LANE_B_REVIEW_REQUIRED_NOT_PROMOTED',
      medical_node_record_count: result.unmatched_medical_nodes.length,
      records: result.unmatched_medical_nodes,
    }), {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
  }
  for (const receipt of result.pass_receipts) {
    journal = appendJournalEvent(journal, {
      artifact_alias: row.transcript_artifact_alias,
      phase: receipt.pass_id,
      pass_id: receipt.pass_id,
      attempt_number: successfulAttemptNumber,
      input_hash: row.transcript_hash,
      rules_hash: contract.content_hash,
      parser_hash: contract.files.find((item) => item.relative_path === 'tools/parsers.mjs').sha256,
      state_transition: 'NOT_STARTED_TO_COMPLETE',
      output_shard_hash: receipt.proposal_root,
    });
  }
  const counts = classificationCounts(result.occurrences);
  const summary = {
    source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    nodes_hash: row.nodes_hash,
    run_contract_hash: contract.content_hash,
    segment_count: transcript.record_count,
    nodes_record_count: nodes?.record_count ?? 0,
    records_with_text_count: transcript.records_with_text_count,
    malformed_record_count: transcript.records.filter((record) => (
      record.text_status !== 'PRESENT' || record.timestamp_status !== 'PARSED'
    )).length,
    candidate_count: result.occurrences.length,
    quarantine_count: counts.quarantineCount,
    rejection_count: counts.rejectionCount,
    pass_receipts: result.pass_receipts,
    occurrence_shard_hash: occurrenceShard.content_hash,
    pass_shard_hash: passShard.content_hash,
    retrieval_receipt_id: retrievalReceipt,
    retrieval_receipt_hash: retrievalReceiptEnvelope.content_hash,
    processing_receipt_id: processingReceipt,
    processing_receipt_hash: processingReceiptEnvelope.content_hash,
    automated_review_receipt_hash: automatedReviewReceiptEnvelope.content_hash,
    final_artifact_status: counts.quarantineCount > 0
      ? 'COMPLETE_WITH_QUARANTINE' : 'COMPLETE',
    retry_count: Math.max(0, successfulAttemptNumber - 1),
    successful_attempt_number: successfulAttemptNumber,
  };
  return { summary, occurrenceShard, passShard, journal, reused: false };
}

async function processNodesOnly(acquisition, options, contract) {
  const rows = acquisition.roster.filter((row) => (
    row.transcript_availability !== 'AVAILABLE' && row.nodes_availability === 'AVAILABLE'
  ));
  const output = [];
  for (const row of rows) {
    try {
      const bytes = await readRestrictedFile(`raw/${row.nodes_artifact_alias}.json`, {
        boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
        maximumBytes: 64 * 1024 * 1024,
      });
      const parsed = parseArtifactBuffer(bytes, 'nodes_json', row.nodes_hash);
      const medicalRecordCount = parsed.records.filter((record) => (
        record.text && classifyMedicalDomain(record.text).medical_relevance_score >= 0.55
      )).length;
      const shard = contentAddressedEnvelope({
        schema_version: PARSED_SHARD_SCHEMA,
        extraction_run_id: contract.extraction_run_id,
        run_contract_hash: contract.content_hash,
        source_alias: row.source_alias,
        artifact_alias: row.nodes_artifact_alias,
        artifact_hash: row.nodes_hash,
        lane: 'LANE_B_NODES_ONLY_RECONCILIATION',
        transcript_availability: row.transcript_availability,
        candidate_promotion_performed: false,
        disposition: 'REVIEW_REQUIRED_NO_TRANSCRIPT_PROVENANCE',
        medical_record_count: medicalRecordCount,
        parsed,
      });
      await writeRestrictedJson(`working/lane-b-nodes/${row.nodes_artifact_alias}.json`, shard, {
        boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
      });
      output.push({
        source_alias: row.source_alias,
        artifact_alias: row.nodes_artifact_alias,
        nodes_hash: row.nodes_hash,
        record_count: parsed.record_count,
        medical_record_count: medicalRecordCount,
        shard_hash: shard.content_hash,
        candidate_promotion_count: 0,
        status: 'RECONCILED_NODES_ONLY_NO_TRANSCRIPT',
      });
    } catch (error) {
      if (error?.name === 'BoundaryError' && error.code !== 'boundary_missing') throw error;
      if (!(error?.name === 'BoundaryError' || error?.name === 'ParserError')) throw error;
      output.push({
        source_alias: row.source_alias,
        artifact_alias: row.nodes_artifact_alias,
        nodes_hash: row.nodes_hash,
        record_count: 0,
        medical_record_count: 0,
        shard_hash: null,
        candidate_promotion_count: 0,
        status: 'FAILED_WITH_PROVEN_BLOCKER',
        blocker_root_cause: controlledError(error).toUpperCase(),
        recovery_methods: ['HASH_REVALIDATION', 'PARSER_RETRY'],
        resumable_next_step: 'Retry Lane B from the protected acquisition checkpoint.',
      });
    }
  }
  return output;
}

function safeRoster(acquisition, summaries, laneBNodesOnly) {
  const bySource = new Map(summaries.map((summary) => [summary.source_alias, summary]));
  const laneBBySource = new Map(laneBNodesOnly.map((summary) => [summary.source_alias, summary]));
  return acquisition.roster.map((row) => {
    const summary = bySource.get(row.source_alias);
    return {
      roster_position: row.roster_position,
      source_alias: row.source_alias,
      transcript_artifact_alias: row.transcript_availability === 'AVAILABLE'
        ? row.transcript_artifact_alias : null,
      transcript_hash: row.transcript_availability === 'AVAILABLE' ? row.transcript_hash : null,
      transcript_availability: row.transcript_availability,
      nodes_artifact_alias: row.nodes_availability === 'AVAILABLE' ? row.nodes_artifact_alias : null,
      nodes_hash: row.nodes_availability === 'AVAILABLE' ? row.nodes_hash : null,
      nodes_availability: row.nodes_availability,
      predecessor_hash_match: row.transcript_availability === 'AVAILABLE'
        ? (row.transcript_predecessor_hash_match ? 'MATCH' : 'MISMATCH')
        : (row.nodes_predecessor_hash_match ? 'NODES_ONLY_MATCH' : 'NOT_AVAILABLE'),
      processing_status: summary?.final_artifact_status
        ?? (row.nodes_availability === 'AVAILABLE'
          ? (laneBBySource.get(row.source_alias)?.status ?? 'LANE_B_NOT_PROCESSED')
          : 'UNRESOLVED_NO_VALIDATED_ARTIFACT'),
    };
  });
}

function artifactEntries(acquisition, summaries, occurrencesByArtifact) {
  const rowByAlias = new Map(acquisition.roster.map((row) => [row.transcript_artifact_alias, row]));
  return summaries.map((summary) => {
    const row = rowByAlias.get(summary.artifact_alias);
    const occurrences = occurrencesByArtifact.get(summary.artifact_alias) ?? [];
    const counts = classificationCounts(occurrences);
    return {
      source_alias: summary.source_alias,
      artifact_alias: summary.artifact_alias,
      transcript_hash_binding: summary.transcript_hash,
      nodes_hash_binding: summary.nodes_hash,
      transcript_retrieval_status: 'RETRIEVED',
      transcript_hash_status: 'VERIFIED',
      nodes_retrieval_status: row.nodes_availability === 'AVAILABLE' ? 'RETRIEVED' : 'NOT_AVAILABLE',
      parser_selected: 'transcript_json',
      parser_version: PARSER_VERSION,
      segment_count: summary.segment_count,
      nodes_record_count: summary.nodes_record_count,
      pass_receipts: summary.pass_receipts,
      candidate_count: occurrences.length,
      quarantine_count: counts.quarantineCount,
      rejection_count: counts.rejectionCount,
      parser_error_count: summary.malformed_record_count,
      retry_count: summary.retry_count,
      final_artifact_status: summary.final_artifact_status,
      independent_verification_status: summary.independent_verification_status ?? 'PENDING',
      specialist_role_review_count: summary.specialist_role_review_count ?? 0,
      specialist_review_receipt_root: summary.specialist_review_receipt_root ?? null,
      pass_9_finalization_root: summary.pass_9_finalization_root ?? null,
      blocker_root_cause: summary.blocker_root_cause,
      recovery_methods: summary.recovery_methods,
      resumable_next_step: summary.resumable_next_step,
      evidence_receipt_id: summary.failure_receipt_id,
    };
  });
}

async function writeSpecialistReviewPackets(summaries, contract, options) {
  const packets = new Map();
  for (const summary of summaries) {
    if (!['COMPLETE', 'COMPLETE_WITH_QUARANTINE'].includes(summary.final_artifact_status)) continue;
    const packet = buildSpecialistReviewPacket({
      extractionRunId: contract.extraction_run_id,
      runContractHash: contract.content_hash,
      sourceAlias: summary.source_alias,
      artifactAlias: summary.artifact_alias,
      transcriptHash: summary.transcript_hash,
      nodesHash: summary.nodes_hash,
      occurrenceShardHash: summary.occurrence_shard_hash,
      passShardHash: summary.pass_shard_hash,
      processingReceiptHash: summary.processing_receipt_hash,
      passReceipts: summary.pass_receipts,
    });
    await writeRestrictedJson(`reviews/packets/${summary.artifact_alias}.json`, packet, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
    packets.set(summary.artifact_alias, packet);
  }
  return packets;
}

async function loadVerifiedSpecialistReviews(packets, schema, options) {
  async function listOutputDirectory(relativePath) {
    let path;
    try {
      path = await assertBoundaryPath(options.boundaryRoot, relativePath, {
        mustExist: true,
        kind: 'directory',
        operation: 'read',
        worktreeRoot: options.worktreeRoot,
      });
    } catch (error) {
      if (error?.name === 'BoundaryError' && error.code === 'boundary_missing') return [];
      throw error;
    }
    const entries = await readdir(path, { withFileTypes: true });
    if (entries.some((entry) => !entry.isFile() || !entry.name.endsWith('.json'))) {
      fail('specialist_review_rejected');
    }
    return entries.map((entry) => entry.name).sort();
  }
  const submissionNames = await listOutputDirectory('reviews/submissions');
  const receiptNames = await listOutputDirectory('reviews/receipts');
  const finalizationNames = await listOutputDirectory('reviews/finalization');
  let completion;
  try {
    completion = await readRestrictedJson(
      'reviews/finalization/specialist-batch-finalization.json',
      { boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot },
    );
  } catch (error) {
    if (error?.name === 'BoundaryError' && error.code === 'boundary_missing') {
      if (submissionNames.length !== 0 || receiptNames.length !== 0) {
        fail('specialist_review_rejected');
      }
      if (finalizationNames.length !== 0) fail('specialist_review_rejected');
      return new Map();
    }
    throw error;
  }
  const expectedNames = [...packets.keys()].map((alias) => `${alias}.json`).sort();
  const roleSubmissionNames = await listOutputDirectory('reviews/role-submissions');
  const expectedRoleSubmissionNames = REQUIRED_SPECIALIST_ROLES.map(
    (role) => `${role}.json`,
  ).sort();
  if (submissionNames.length !== OBSERVED_TRANSCRIPT_COUNT
      || receiptNames.length !== OBSERVED_TRANSCRIPT_COUNT
      || stableHash(submissionNames) !== stableHash(expectedNames)
      || stableHash(receiptNames) !== stableHash(expectedNames)
      || stableHash(roleSubmissionNames) !== stableHash(expectedRoleSubmissionNames)
      || stableHash(finalizationNames)
        !== stableHash(['specialist-batch-finalization.json'])) {
    fail('specialist_review_rejected');
  }
  const batches = {};
  for (const role of REQUIRED_SPECIALIST_ROLES) {
    batches[role] = await readRestrictedJson(`reviews/role-submissions/${role}.json`, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
  }
  const submissions = [];
  const receipts = [];
  for (const fileName of expectedNames) {
    submissions.push(await readRestrictedJson(`reviews/submissions/${fileName}`, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    }));
    receipts.push(await readRestrictedJson(`reviews/receipts/${fileName}`, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    }));
  }
  let finalized;
  try {
    finalized = validatePublishedSpecialistFinalization({
      packets: [...packets.values()], batches, submissions, receipts, completion,
    }, schema);
  } catch {
    fail('specialist_review_rejected');
  }
  return finalized.receiptsByArtifact;
}

function bindSpecialistReviews(summaries, reviewsByArtifact) {
  return summaries.map((summary) => {
    const receipt = reviewsByArtifact.get(summary.artifact_alias);
    if (!receipt) {
      return {
        ...summary,
        independent_verification_status: 'PENDING',
        specialist_role_review_count: 0,
        specialist_review_receipt_root: null,
        pass_9_finalization_root: null,
      };
    }
    const pass7Cell = receipt.pass_7_verification_cell;
    const pass8Cell = receipt.pass_8_verification_cell;
    const pass9Finalization = receipt.pass_9_finalization_binding;
    const passReceipts = summary.pass_receipts.map((passReceipt) => {
      if (passReceipt.pass_id === 'PASS_7') return {
        ...passReceipt,
        independent_verification_status: 'VERIFIED',
        specialist_verification_cell_root: pass7Cell.content_hash,
        specialist_verification_receipt_root: null,
        finalization_input_root: null,
      };
      if (passReceipt.pass_id === 'PASS_8') return {
        ...passReceipt,
        independent_verification_status: 'VERIFIED',
        specialist_verification_cell_root: pass8Cell.content_hash,
        specialist_verification_receipt_root: null,
        finalization_input_root: null,
      };
      if (passReceipt.pass_id === 'PASS_9') return {
        ...passReceipt,
        independent_verification_status: 'VERIFIED',
        specialist_verification_cell_root: null,
        specialist_verification_receipt_root: receipt.content_hash,
        finalization_input_root: pass9Finalization.finalization_input_root,
      };
      return {
        ...passReceipt,
        specialist_verification_cell_root: null,
        specialist_verification_receipt_root: null,
        finalization_input_root: null,
      };
    });
    return {
      ...summary,
      pass_receipts: passReceipts,
      independent_verification_status: 'VERIFIED',
      specialist_role_review_count: 4,
      specialist_review_receipt_root: receipt.content_hash,
      pass_9_finalization_root: pass9Finalization.finalization_input_root,
    };
  });
}

async function safeAtomicWrite(relativePath, value) {
  assertExtractionOperationLockHeld(activeExtractionOperationLock);
  const target = resolve(MODULE_ROOT, relativePath);
  const relation = relative(MODULE_ROOT, target);
  if (relation === '..' || relation.startsWith(`..${sep}`)) fail('safe_projection_rejected');
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (assertSafeSerialization(serialized).length > 0) fail('safe_projection_rejected');
  assertExtractionOperationLockHeld(activeExtractionOperationLock);
  await mkdir(dirname(target), { recursive: true });
  const temporary = resolve(
    dirname(target),
    `.safe-write-${process.pid}-${sha256(relativePath).slice(0, 16)}-${randomBytes(8).toString('hex')}.tmp`,
  );
  let handle;
  try {
    assertExtractionOperationLockHeld(activeExtractionOperationLock);
    handle = await open(
      temporary,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL,
      0o600,
    );
    assertExtractionOperationLockHeld(activeExtractionOperationLock);
    await handle.writeFile(serialized, 'utf8');
    assertExtractionOperationLockHeld(activeExtractionOperationLock);
    await handle.sync();
    await handle.close();
    handle = null;
    assertExtractionOperationLockHeld(activeExtractionOperationLock);
    await rename(temporary, target);
    assertExtractionOperationLockHeld(activeExtractionOperationLock);
  } catch (error) {
    await handle?.close().catch(() => {});
    try {
      assertExtractionOperationLockHeld(activeExtractionOperationLock);
      await unlink(temporary);
    } catch (cleanupError) {
      if (cleanupError?.name !== 'ExtractionOperationLockError'
          && cleanupError?.code !== 'ENOENT') throw cleanupError;
    }
    throw error;
  }
}

async function loadLegacyRows() {
  try {
    const sql = await readFile(LEGACY_SQL_PATH, 'utf8');
    const rows = parseLegacyV4Migration(sql);
    if (rows.length !== 845) fail('legacy_estate_rejected');
    return rows;
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    fail('legacy_estate_rejected');
  }
}

export function retryLedger(acquisition, summaries) {
  const acquisitionEvents = (acquisition.retry_events ?? []).map((event) => ({
    phase: event.phase,
    artifact_alias: event.artifact_alias,
    invocation_ordinal: event.invocation_ordinal,
    attempt_number: event.attempt_number,
    controlled_error_class: event.controlled_error_class,
    recovery_action: event.recovery_action,
  }));
  const extractionSummaryEvents = summaries.filter((summary) => (
    summary.retry_count > 0 || summary.final_artifact_status === 'FAILED_WITH_PROVEN_BLOCKER'
  )).map((summary) => {
    const lastFailure = (summary.transient_failure_events ?? []).at(-1) ?? null;
    return {
      phase: summary.final_artifact_status === 'FAILED_WITH_PROVEN_BLOCKER'
        ? 'EXTRACTION_FAILURE' : 'EXTRACTION_RESUME',
      artifact_alias: summary.artifact_alias,
      attempt_number: summary.retry_count + 1,
      controlled_error_class: summary.blocker_root_cause
        ?? lastFailure?.controlled_error_class
        ?? 'PRIOR_SHARD_NOT_REUSABLE',
      recovery_action: summary.final_artifact_status === 'FAILED_WITH_PROVEN_BLOCKER'
        ? 'RESUME_FROM_PROTECTED_ACQUISITION_CHECKPOINT' : 'REREAD_REPARSE_REEXTRACT',
      safe_diagnostic_hash: summary.safe_diagnostic_hash ?? lastFailure?.receipt_hash ?? null,
      evidence_receipt_id: lastFailure?.receipt_id ?? null,
      retry_count: Number(summary.retry_count ?? 0),
    };
  });
  const extractionFailureEvents = summaries.flatMap((summary) => (
    (summary.transient_failure_events ?? []).map((event) => ({
      phase: 'EXTRACTION_ATTEMPT_FAILURE',
      artifact_alias: summary.artifact_alias,
      attempt_number: event.attempt_number,
      controlled_error_class: event.controlled_error_class,
      recovery_action: event.recovery_action_scheduled,
      safe_diagnostic_hash: event.receipt_hash,
      evidence_receipt_id: event.receipt_id,
    }))
  ));
  return contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.retry_and_failure_ledger.v1',
    acquisition_retry_count: acquisitionEvents.filter(
      (event) => event.recovery_action === 'BOUNDED_RETRY',
    ).length,
    extraction_retry_count: extractionSummaryEvents.reduce(
      (sum, event) => sum + event.retry_count, 0,
    ),
    failed_artifact_count: summaries.filter(
      (summary) => summary.final_artifact_status === 'FAILED_WITH_PROVEN_BLOCKER',
    ).length,
    events: [...acquisitionEvents, ...extractionFailureEvents, ...extractionSummaryEvents],
  });
}

async function runExtractionLocked(options, operationLock) {
  assertExtractionOperationLockHeld(operationLock);
  await preflightRestrictedBoundary({
    boundaryRoot: options.boundaryRoot, worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
  });
  assertExtractionOperationLockHeld(operationLock);
  const schemas = await loadSchemas();
  const acquisition = validateAcquisitionState(await readRestrictedJson(ACQUISITION_STATE_PATH, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
  }));
  const acquisitionReceipt = await readRestrictedJson(ACQUISITION_RECEIPT_PATH, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
  });
  validateAcquisitionReceipt(acquisitionReceipt, acquisition);
  const boundaryDecisionBytes = await readRestrictedFile(BOUNDARY_DECISION_PATH, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
    maximumBytes: 1024 * 1024,
  });
  if (sha256(boundaryDecisionBytes) !== BOUNDARY_DECISION_SHA256) fail('boundary_rejected');
  const networkTargetApprovalBytes = await readRestrictedFile(NETWORK_TARGET_APPROVAL_PATH, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
    maximumBytes: 1024 * 1024,
  });
  if (sha256(networkTargetApprovalBytes) !== NETWORK_TARGET_APPROVAL_SHA256) {
    fail('boundary_rejected');
  }
  const aliasMapHash = sha256(await readRestrictedFile(DEFAULT_ALIAS_MAP_RELATIVE_PATH, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
    maximumBytes: 16 * 1024 * 1024,
  }));
  if (aliasMapHash !== acquisition.alias_map_sha256) fail('acquisition_state_rejected');
  const contractBase = await runContract();
  const contract = contentAddressedEnvelope({
    ...contractBase,
    extraction_run_id: acquisition.extraction_run_id,
    acquisition_state_hash: acquisition.content_hash,
    acquisition_receipt_hash: acquisitionReceipt.content_hash,
  });
  const expectedRosterRoot = rosterRoot(acquisition);
  let { state, journal } = await loadResumeState(
    options, contract.content_hash, expectedRosterRoot, acquisition.extraction_run_id,
  );
  const priorByAlias = new Map(state.artifacts.map((item) => [item.artifact_alias, item]));
  const failureEventsByAlias = new Map(state.artifacts.map((item) => [
    item.artifact_alias, [...(item.transient_failure_events ?? [])],
  ]));
  let completed = [];
  const transcriptRows = acquisition.roster.filter(
    (row) => row.transcript_availability === 'AVAILABLE',
  );
  completed = await executeWithBoundedIsolation(transcriptRows, {
    maximumAttempts: 2,
    worker: async (row, _index, attempt) => {
      const priorSummary = priorByAlias.get(row.transcript_artifact_alias) ?? null;
      const successfulAttemptNumber = priorSummary
        ? Number(priorSummary.retry_count ?? 0) + 1 + attempt
        : attempt;
      const processed = await processArtifact(
          row,
          options,
          schemas,
          contract,
          priorSummary,
          journal,
          successfulAttemptNumber,
        );
      const transientFailures = failureEventsByAlias.get(row.transcript_artifact_alias) ?? [];
      if (transientFailures.length > 0) {
        processed.summary = {
          ...processed.summary,
          transient_failure_events: transientFailures,
          failure_receipt_id: transientFailures.at(-1).receipt_id,
          failure_receipt_hash: transientFailures.at(-1).receipt_hash,
        };
      }
      return processed;
    },
    blocker: (row, _index, error, attemptCount) => failedArtifactResult(
      row, options, contract, journal, error, attemptCount,
      priorByAlias.get(row.transcript_artifact_alias) ?? null,
      failureEventsByAlias.get(row.transcript_artifact_alias) ?? [],
    ),
    isolatable: artifactFailureCanBeIsolated,
    onAttemptFailure: async (error, row, _index, attempt, maximumAttempts) => {
      const priorSummary = priorByAlias.get(row.transcript_artifact_alias) ?? null;
      const actualAttemptNumber = priorSummary
        ? Number(priorSummary.retry_count ?? 0) + 1 + attempt
        : attempt;
      const failure = await persistArtifactFailureEvidence(
        row, options, contract, error, actualAttemptNumber, attempt < maximumAttempts,
      );
      const history = failureEventsByAlias.get(row.transcript_artifact_alias) ?? [];
      failureEventsByAlias.set(row.transcript_artifact_alias, [...history, failure]);
      journal = appendJournalEvent(journal, {
        artifact_alias: row.transcript_artifact_alias,
        phase: 'ARTIFACT_ATTEMPT',
        pass_id: null,
        attempt_number: actualAttemptNumber,
        input_hash: row.transcript_hash,
        rules_hash: contract.content_hash,
        parser_hash: contract.files.find(
          (item) => item.relative_path === 'tools/parsers.mjs',
        ).sha256,
        state_transition: attempt < maximumAttempts
          ? 'IN_PROGRESS_TO_RETRY_PENDING' : 'IN_PROGRESS_TO_FAILED_WITH_PROVEN_BLOCKER',
        controlled_error_class: failure.controlled_error_class,
        safe_diagnostic_hash: failure.receipt_hash,
        recovery_action: attempt < maximumAttempts ? 'BOUNDED_RETRY_SCHEDULED' : null,
        output_shard_hash: failure.receipt_hash,
      });
    },
    onSettled: async (processed, _row, index, settled) => {
      journal = processed.journal;
      state = contentAddressedEnvelope({
        ...state,
        artifacts: settled.map((item) => item.summary),
        extraction_cursor: index + 1,
        extraction_complete: false,
      });
      await writeRestrictedJson(JOURNAL_PATH, journal, {
        boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
      });
      await writeRestrictedJson(EXTRACTION_STATE_PATH, state, {
        boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
      });
      if ((index + 1) % 10 === 0) await postflightRestrictedBoundary({
        boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
      });
    },
  });
  if (completed.length !== OBSERVED_TRANSCRIPT_COUNT) fail('coverage_rejected');
  const laneBNodesOnly = await processNodesOnly(acquisition, options, contract);

  const allOccurrences = completed.flatMap((item) => item.occurrenceShard.occurrences);
  const dedupe = buildProvisionalConcepts(allOccurrences);
  if (!dedupe.every_candidate_accounted || dedupe.silent_member_truncation_count !== 0) {
    fail('schema_instance_rejected');
  }
  for (const occurrence of dedupe.occurrences) {
    assertSchema(schemas.occurrence, occurrence);
    assertOccurrenceIntegrity(occurrence);
  }
  for (const concept of dedupe.concepts) {
    assertSchema(schemas.concept, concept);
    assertConceptIntegrity(concept);
  }
  assertCrossInventoryIntegrity({
    occurrences: dedupe.occurrences,
    concepts: dedupe.concepts,
  });
  assertDuplicateRelationshipInventoryIntegrity({
    relationships: dedupe.duplicate_relationships,
    occurrences: dedupe.occurrences,
    concepts: dedupe.concepts,
  });
  const occurrencesByArtifact = new Map();
  for (const occurrence of dedupe.occurrences) {
    const items = occurrencesByArtifact.get(occurrence.artifact_alias) ?? [];
    items.push(occurrence);
    occurrencesByArtifact.set(occurrence.artifact_alias, items);
  }
  const inventoryShards = [];
  for (const summary of completed.map((item) => item.summary)) {
    const occurrences = occurrencesByArtifact.get(summary.artifact_alias) ?? [];
    const shard = contentAddressedEnvelope({
      schema_version: SHARD_SCHEMA,
      extraction_run_id: contract.extraction_run_id,
      run_contract_hash: contract.content_hash,
      source_alias: summary.source_alias,
      artifact_alias: summary.artifact_alias,
      transcript_hash: summary.transcript_hash,
      nodes_hash: summary.nodes_hash,
      deduplication_applied: true,
      occurrences,
    });
    const path = shardPaths(summary.artifact_alias).dedupedOccurrences;
    await writeRestrictedJson(path, shard, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
    inventoryShards.push({
      source_alias: summary.source_alias,
      artifact_alias: summary.artifact_alias,
      occurrence_count: occurrences.length,
      shard_hash: shard.content_hash,
    });
  }
  const inventoryIndex = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_occurrence_inventory_index.v1',
    extraction_run_id: contract.extraction_run_id,
    occurrence_count: dedupe.occurrences.length,
    shard_count: inventoryShards.length,
    shards: inventoryShards,
  });
  await writeRestrictedJson(FINAL_INVENTORY_INDEX_PATH, inventoryIndex, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  const conceptEnvelope = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_provisional_concept_inventory.v1',
    extraction_run_id: contract.extraction_run_id,
    concept_count: dedupe.concepts.length,
    concepts: dedupe.concepts,
    comparison_pair_count: dedupe.comparison_pair_count,
    semantic_window_size: dedupe.semantic_window_size,
    destructive_merge_performed: false,
  });
  await writeRestrictedJson(CONCEPT_PATH, conceptEnvelope, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  const duplicateRelationshipEnvelope = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_duplicate_relationship_inventory.v1',
    extraction_run_id: contract.extraction_run_id,
    relationship_count: dedupe.duplicate_relationships.length,
    relationship_set_root: stableHash(dedupe.duplicate_relationships),
    relationships: dedupe.duplicate_relationships,
    final_adjudication_performed: false,
    destructive_merge_performed: false,
  });
  await writeRestrictedJson(DUPLICATE_RELATIONSHIP_PATH, duplicateRelationshipEnvelope, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });

  const legacyRows = await loadLegacyRows();
  const legacyComparison = compareLegacy(dedupe.concepts, legacyRows);
  await writeRestrictedJson(LEGACY_COMPARISON_PATH, legacyComparison, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  const automatedSummaries = completed.map((item) => item.summary);
  const canonicalJournal = canonicalSuccessfulJournal(
    transcriptRows, automatedSummaries, contract, expectedRosterRoot,
  );
  if (canonicalJournal && stableHash(canonicalJournal) !== stableHash(journal)) {
    await writeRestrictedJson(
      `audit/superseded-journals/${stableHash(journal)}.json`,
      contentAddressedEnvelope({
        schema_version: 'missionmed.i1q1008e.restricted_superseded_journal.v1',
        extraction_run_id: contract.extraction_run_id,
        supersession_reason: 'CANONICAL_RECOVERY_RECONCILIATION',
        prior_journal: journal,
      }),
      { boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot },
    );
    journal = canonicalJournal;
    await writeRestrictedJson(JOURNAL_PATH, journal, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
  }
  const journalCoveragePass = canonicalJournal !== null
    && exactSuccessfulJournal(journal, transcriptRows, automatedSummaries, contract);
  const specialistPackets = await writeSpecialistReviewPackets(
    automatedSummaries, contract, options,
  );
  const specialistReviews = await loadVerifiedSpecialistReviews(
    specialistPackets, schemas.specialistReview, options,
  );
  const summaries = bindSpecialistReviews(automatedSummaries, specialistReviews);
  const ledger = buildArtifactLedger({
    extractionRunId: contract.extraction_run_id,
    artifactEntries: artifactEntries(acquisition, summaries, occurrencesByArtifact),
    observedCohort: true,
  });
  assertSchema(schemas.ledger, ledger);
  const automatedCoverage = validateCoverage(ledger, {
    requireObservedCohort: true, requireFinalization: false,
  });
  const finalCoverage = validateCoverage(ledger, {
    requireObservedCohort: true, requireFinalization: true,
  });
  const nodesOnlyReconciliationPass = laneBNodesOnly.length === 2
    && laneBNodesOnly.every((item) => item.status === 'RECONCILED_NODES_ONLY_NO_TRANSCRIPT');
  const coveragePass = automatedCoverage.result === 'pass'
    && automatedCoverage.metrics.complete_pass_cells === REQUIRED_PASS_CELL_COUNT
    && finalCoverage.result === 'pass'
    && finalCoverage.metrics.specialist_verification_cells === 194
    && journalCoveragePass
    && nodesOnlyReconciliationPass;
  const retries = retryLedger(acquisition, summaries);
  const boundaryDecisionHash = sha256(await readRestrictedFile(BOUNDARY_DECISION_PATH, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    maximumBytes: 1024 * 1024,
  }));
  const availableTranscriptResults = acquisition.artifact_results.filter((item) => (
    item.artifact_class === 'transcript_json' && item.availability === 'AVAILABLE'
  ));
  const availableNodesResults = acquisition.artifact_results.filter((item) => (
    item.artifact_class === 'nodes_json' && item.availability === 'AVAILABLE'
  ));
  const malformedRecordCount = ledger.artifacts.reduce(
    (sum, item) => sum + item.parser_error_count, 0,
  );
  const projected = projectSafeArtifacts({
    extractionRunId: contract.extraction_run_id,
    authorityTicketHash: AUTHORITY_TICKET_SHA256,
    predecessorCommit: PREDECESSOR_COMMIT,
    predecessorReceiptHash: PREDECESSOR_RECEIPT_SHA256,
    boundaryDecisionHash,
    roster: safeRoster(acquisition, summaries, laneBNodesOnly),
    artifactLedger: ledger,
    occurrences: dedupe.occurrences,
    concepts: dedupe.concepts,
    retryLedger: retries,
    legacyComparison,
    duplicateRelationshipInventory: duplicateRelationshipEnvelope,
    sourceContentMetrics: {
      transcript_segment_count: ledger.artifacts.reduce(
        (sum, item) => sum + item.segment_count, 0,
      ),
      nodes_record_count: availableNodesResults.reduce(
        (sum, item) => sum + item.primary_record_count, 0,
      ),
      transcript_byte_count: availableTranscriptResults.reduce(
        (sum, item) => sum + item.byte_count, 0,
      ),
      artifact_retry_count: retries.acquisition_retry_count + retries.extraction_retry_count,
      malformed_record_count: malformedRecordCount,
      repaired_record_count: 0,
      unrecoverable_record_count: malformedRecordCount,
      newly_recovered_transcript_count: Math.max(
        0, availableTranscriptResults.length - OBSERVED_TRANSCRIPT_COUNT,
      ),
      newly_recovered_nodes_count: Math.max(
        0, availableNodesResults.length - OBSERVED_NODES_COUNT,
      ),
    },
    sourceMutationCount: 0,
  });
  await safeAtomicWrite('ledgers/ARTIFACT_PROCESSING_LEDGER.json', ledger);
  await safeAtomicWrite('ledgers/RETRY_AND_FAILURE_LEDGER.json', retries);
  for (const [name, value] of Object.entries(projected)) {
    if (value === null) continue;
    const fileName = name.replaceAll('_', '-');
    const requiredNames = {
      run_manifest: 'extraction-run-manifest',
      processing_roster_safe: 'processing-roster-safe',
      coverage_receipt: 'coverage-receipt',
      candidate_inventory_safe_summary: 'candidate-inventory-safe-summary',
      quarantine_summary: 'quarantine-summary',
      provisional_concept_summary: 'provisional-concept-summary',
      provenance_invariant_results: 'provenance-invariant-results',
      legacy_comparison_safe_summary: 'legacy-comparison-safe-summary',
      source_content_safe_summary: 'source-content-safe-summary',
    };
    await safeAtomicWrite(`evidence/${requiredNames[name] ?? fileName}.json`, value);
  }
  state = contentAddressedEnvelope({
    ...state,
    artifacts: automatedSummaries,
    lane_b_nodes_only: laneBNodesOnly,
    outside_consumer_projection: {
      source_count: 8,
      nodes_only_reconciled_count: laneBNodesOnly.filter(
        (item) => item.status === 'RECONCILED_NODES_ONLY_NO_TRANSCRIPT',
      ).length,
      neither_unresolved_count: 6,
      registry_cdn_r2_historical_reconciliation_status: 'UNRESOLVED_OUT_OF_SCOPE',
      exclusion_tombstone_reconciliation_status: 'UNRESOLVED_OUT_OF_SCOPE',
      overall_lane_b_status: 'OPEN_CONSTRAINS_COMPLETENESS',
    },
    extraction_cursor: completed.length,
    extraction_complete: coveragePass,
    total_occurrence_count: dedupe.occurrences.length,
    provisional_concept_count: dedupe.concepts.length,
    inventory_index_hash: inventoryIndex.content_hash,
    concept_inventory_hash: conceptEnvelope.content_hash,
    duplicate_relationship_inventory_hash: duplicateRelationshipEnvelope.content_hash,
    artifact_ledger_hash: ledger.content_hash,
    specialist_verified_receipt_count: specialistReviews.size,
    specialist_verified_receipt_set_root: ledger.finalization_summary
      .verified_specialist_receipt_set_root,
    legacy_comparison_root: legacyComparison.comparison_root,
  });
  await writeRestrictedJson(EXTRACTION_STATE_PATH, state, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  const rowByTranscriptAlias = new Map(acquisition.roster.map((row) => [
    row.transcript_artifact_alias, row,
  ]));
  const nodesArtifactCount = summaries.filter((summary) => (
    ['COMPLETE', 'COMPLETE_WITH_QUARANTINE'].includes(summary.final_artifact_status)
      && rowByTranscriptAlias.get(summary.artifact_alias)?.nodes_availability === 'AVAILABLE'
  )).length + laneBNodesOnly.filter(
    (item) => item.status === 'RECONCILED_NODES_ONLY_NO_TRANSCRIPT',
  ).length;
  await writeRestrictedJson(EXTRACTION_RECEIPT_PATH, contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_extraction_receipt.v1',
    extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash,
    extraction_state_hash: state.content_hash,
    roster_root: expectedRosterRoot,
    transcript_artifact_count: completed.length,
    nodes_artifact_count: nodesArtifactCount,
    automated_pass_cell_count: automatedCoverage.metrics.complete_pass_cells,
    specialist_verification_cell_count:
      finalCoverage.metrics.specialist_verification_cells,
    specialist_role_review_count: finalCoverage.metrics.specialist_role_reviews,
    occurrence_count: dedupe.occurrences.length,
    concept_count: dedupe.concepts.length,
    inventory_index_hash: inventoryIndex.content_hash,
    concept_inventory_hash: conceptEnvelope.content_hash,
    duplicate_relationship_inventory_hash: duplicateRelationshipEnvelope.content_hash,
    duplicate_relationship_count: duplicateRelationshipEnvelope.relationship_count,
    journal_event_count: journal.events.length,
    exact_journal_coverage: journalCoveragePass,
    nodes_only_reconciliation_scope: 'OBSERVED_TWO_NODES_ONLY_ARTIFACTS',
    nodes_only_reconciliation_complete: nodesOnlyReconciliationPass,
    nodes_only_reconciled_count: laneBNodesOnly.filter(
      (item) => item.status === 'RECONCILED_NODES_ONLY_NO_TRANSCRIPT',
    ).length,
    neither_unresolved_count: 6,
    outside_consumer_projection_count: 8,
    overall_lane_b_status: 'OPEN_CONSTRAINS_COMPLETENESS',
    registry_cdn_r2_historical_reconciliation_status: 'UNRESOLVED_OUT_OF_SCOPE',
    exclusion_tombstone_reconciliation_status: 'UNRESOLVED_OUT_OF_SCOPE',
    extraction_complete: coveragePass,
    no_production_mutation: true,
  }), { boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot });
  await postflightRestrictedBoundary({
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  assertExtractionOperationLockHeld(operationLock);
  if (!coveragePass) fail('coverage_rejected');
  return {
    result: 'pass',
    transcript_artifact_count: completed.length,
    nodes_artifact_count: nodesArtifactCount,
    automated_pass_cell_count: automatedCoverage.metrics.complete_pass_cells,
    specialist_verification_cell_count: finalCoverage.metrics.specialist_verification_cells,
    occurrence_count: dedupe.occurrences.length,
    provisional_concept_count: dedupe.concepts.length,
    reused_artifact_count: completed.filter((item) => item.reused).length,
    production_mutation_count: 0,
  };
}

export async function runExtraction(options) {
  if (resolve(options.boundaryRoot) !== resolve(DEFAULT_RESTRICTED_BOUNDARY)
      || resolve(options.worktreeRoot) !== WORKTREE_ROOT_FROM_MODULE
      || resolve(options.worktreeRoot) !== resolve(DEFAULT_WORKTREE_ROOT)) {
    fail('boundary_rejected');
  }
  return withExtractionOperationLock({
    boundaryRoot: options.boundaryRoot,
    worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
    timeoutSeconds: 0,
  }, async (operationLock) => {
    if (activeExtractionOperationLock !== null) fail('operation_lock_rejected');
    activeExtractionOperationLock = operationLock;
    try {
      return await runExtractionLocked(options, operationLock);
    } finally {
      activeExtractionOperationLock = null;
    }
  });
}

async function dryRun() {
  const schemas = await loadSchemas();
  const transcript = parseArtifactBuffer(Buffer.from(JSON.stringify({ segments: [
    { start: 0, end: 1, speaker: 'instructor_fixture', text: 'What is the cardiac diagnosis?' },
    { start: 1, end: 2, speaker: 'instructor_fixture', text: 'The diagnosis is a modeled cardiac condition.' },
  ] })), 'transcript_json');
  const context = {
    extraction_run_id: 'run_fixture_0001',
    source_alias: 'source_fixture_0001',
    transcript_artifact_alias: 'artifact_fixture_0001',
    transcript_hash: transcript.artifact_hash,
    nodes_hash: null,
    source_lineage_hash: stableHash('fixture-lineage'),
    retrieval_receipt_binding: 'receipt_fixture_0001',
    processing_receipt_binding: 'receipt_fixture_0002',
  };
  const result = runExtractionPasses({ transcriptRecords: transcript.records, context });
  for (const occurrence of result.occurrences) assertSchema(schemas.occurrence, occurrence);
  const dedupe = buildProvisionalConcepts(result.occurrences);
  for (const occurrence of dedupe.occurrences) {
    assertSchema(schemas.occurrence, occurrence);
    assertOccurrenceIntegrity(occurrence);
  }
  for (const concept of dedupe.concepts) assertSchema(schemas.concept, concept);
  for (const concept of dedupe.concepts) assertConceptIntegrity(concept);
  assertCrossInventoryIntegrity({
    occurrences: dedupe.occurrences,
    concepts: dedupe.concepts,
  });
  const entries = Array.from({ length: OBSERVED_TRANSCRIPT_COUNT }, (_, index) => ({
    source_alias: `source_fixture_${String(index).padStart(4, '0')}`,
    artifact_alias: `artifact_fixture_${String(index).padStart(4, '0')}`,
    parser_selected: 'transcript_json',
    parser_version: PARSER_VERSION,
    segment_count: transcript.record_count,
    nodes_record_count: 1,
    pass_receipts: result.pass_receipts,
    final_artifact_status: 'COMPLETE',
  }));
  const ledger = buildArtifactLedger({
    extractionRunId: 'run_fixture_0001', artifactEntries: entries, observedCohort: true,
  });
  assertSchema(schemas.ledger, ledger);
  const coverage = validateCoverage(ledger, { requireObservedCohort: true });
  if (coverage.result !== 'pass') fail('coverage_rejected');
  let journal = createRunJournal({
    extractionRunId: 'run_fixture_0001',
    runContractHash: 'a'.repeat(64),
    rosterRoot: 'b'.repeat(64),
  });
  const event = {
    artifact_alias: 'artifact_fixture_0001', phase: 'PASS_1', pass_id: 'PASS_1',
    attempt_number: 1, input_hash: 'c'.repeat(64), rules_hash: 'a'.repeat(64),
    parser_hash: 'd'.repeat(64), state_transition: 'NOT_STARTED_TO_COMPLETE',
    output_shard_hash: 'e'.repeat(64),
  };
  journal = appendJournalEvent(journal, event);
  const idempotent = appendJournalEvent(journal, event);
  if (idempotent.events.length !== 1 || validateJournal(idempotent).length > 0) fail('journal_rejected');
  const tampered = structuredClone(journal);
  tampered.roster_root = 'f'.repeat(64);
  if (validateJournal(tampered).length === 0) fail('journal_rejected');
  return {
    mode: 'dry_run', result: 'pass', network_requests: 0, file_writes: 0,
    occurrence_schema_instances_validated: result.occurrences.length,
    concept_schema_instances_validated: dedupe.concepts.length,
    synthetic_artifact_count: coverage.metrics.artifact_count,
    synthetic_pass_cell_count: coverage.metrics.complete_pass_cells,
    resume_idempotency: 'pass', recovery_tamper_detection: 'pass',
  };
}

function printHelp() {
  process.stdout.write([
    'I1Q-1008E restricted extraction runner',
    'Usage: node tools/run-extraction.mjs [--boundary-root <path>] [--worktree-root <path>]',
    '       node tools/run-extraction.mjs --dry-run',
    'Live mode is read-only outside the protected boundary and resumes verified shards.',
  ].join('\n') + '\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const result = options.dryRun ? await dryRun() : await runExtraction(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ result: 'fail', error_code: controlledError(error) })}\n`);
    process.exitCode = 1;
  });
}
