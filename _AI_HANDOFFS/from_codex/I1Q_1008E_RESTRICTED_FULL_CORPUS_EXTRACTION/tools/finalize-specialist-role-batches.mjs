#!/usr/bin/env node

/**
 * Deterministic protected join/finalizer for the four independent specialist
 * role batches. This tool is deliberately excluded from the extraction run
 * contract: it consumes the fresh contract-bound packets after extraction.
 */

import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod, link, lstat, mkdir, open, readdir, readFile, realpath, unlink,
} from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertBoundaryPath,
  DEFAULT_RESTRICTED_BOUNDARY,
  DEFAULT_WORKTREE_ROOT,
  postflightRestrictedBoundary,
  preflightRestrictedBoundary,
  readRestrictedJson,
} from './boundary.mjs';
import {
  contentAddressedEnvelope,
  stableHash,
  verifyContentAddressedEnvelope,
} from './canonical.mjs';
import { validateSchemaInstance } from './schema-validator.mjs';
import { buildArtifactLedger, validateCoverage } from './ledger.mjs';
import {
  assertExtractionOperationLockHeld,
  withExtractionOperationLock,
} from './extraction-operation-lock.mjs';
import {
  buildSpecialistReviewPacket,
  buildSpecialistReviewReceipt,
  SPECIALIST_FINALIZER_AUTHORITY_SCHEMA,
  SPECIALIST_REVIEW_RECEIPT_SCHEMA,
  SPECIALIST_ROLE_CONTRACT,
  validateSpecialistReviewReceipt,
} from './specialist-review.mjs';

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKTREE_ROOT_FROM_MODULE = resolve(MODULE_ROOT, '../../..');
const SHA256 = /^[a-f0-9]{64}$/u;
const REVIEWER_ID = /^reviewer_[A-Za-z0-9_-]{8,128}$/u;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,127}$/u;
const ALIAS = /^(?:opaque_)?(?:source|artifact)(?:_sha256)?_[A-Za-z0-9_-]{8,}$/u;
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const MODE_MASK = 0o7777;
const EXPECTED_ARTIFACT_COUNT = 97;
const EXPECTED_SOURCE_COUNT = 105;
const EXPECTED_NODES_COUNT = 99;
const EXPECTED_AUTOMATED_PASS_CELL_COUNT = 873;
const ACQUISITION_STATE_PATH = 'state/acquisition-state.json';
const EXTRACTION_STATE_PATH = 'state/extraction-state.json';
const EXTRACTION_RECEIPT_PATH = 'audit/extraction-receipt.json';
const SAFE_LEDGER_PATH = resolve(MODULE_ROOT, 'ledgers/ARTIFACT_PROCESSING_LEDGER.json');
const SAFE_ROSTER_PATH = resolve(MODULE_ROOT, 'evidence/processing-roster-safe.json');
const EXTRACTION_STATE_SCHEMA = 'missionmed.i1q1008e.restricted_extraction_state.v1';
const ACQUISITION_STATE_SCHEMA = 'missionmed.i1q1008e.restricted_acquisition_state.v1';
const EXTRACTION_RECEIPT_SCHEMA = 'missionmed.i1q1008e.restricted_extraction_receipt.v1';
const SAFE_LEDGER_SCHEMA = 'missionmed.i1q-1008e.artifact-processing-ledger.v1';
const SAFE_ROSTER_SCHEMA = 'missionmed.i1q.1008e.processing_roster_safe.v1';

const PACKET_SCHEMA = 'missionmed.i1q1008e.restricted_specialist_review_packet.v1';
export const ROLE_BATCH_SCHEMA =
  'missionmed.i1q1008e.restricted_specialist_role_batch.v1';
export const COMBINED_SUBMISSION_SCHEMA =
  'missionmed.i1q1008e.restricted_specialist_review_submissions.v1';
export const SPECIALIST_FINALIZATION_SCHEMA =
  'missionmed.i1q1008e.restricted_specialist_batch_finalization.v1';
const FINALIZER_CONTRACT_SCHEMA =
  'missionmed.i1q1008e.restricted_specialist_finalizer_contract.v1';

export const REQUIRED_SPECIALIST_ROLES = Object.freeze([
  'OSLER', 'ASSESSMENT_SCIENCE', 'TURING', 'ENGINEERING',
]);
const FINAL_DISPOSITIONS = new Set(['VERIFIED_NO_BLOCKER', 'VERIFIED_WITH_FINDINGS']);
const FINDING_SEVERITIES = new Set(['BLOCKER', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
const FINDING_DISPOSITIONS = new Set(['ACCEPTED', 'QUARANTINE', 'CORRECTED', 'BLOCKER']);

const PACKET_KEYS = Object.freeze([
  'schema_version', 'extraction_run_id', 'run_contract_hash', 'source_alias',
  'artifact_alias', 'artifact_input_root', 'automated_pass_roots',
  'required_role_contract', 'specialist_verification_cell_denominator',
  'specialist_role_review_denominator', 'release_or_final_approval_authority',
  'content_hash',
]);
const BATCH_KEYS = Object.freeze([
  'schema_version', 'extraction_run_id', 'run_contract_hash', 'specialist_role',
  'reviewer_instance_id', 'authority_scope', 'artifact_review_count',
  'artifact_reviews', 'content_hash',
]);
const REVIEW_KEYS = Object.freeze([
  'artifact_alias', 'review_packet_root', 'evidence_root', 'findings', 'disposition',
]);
const FINDING_REQUIRED_KEYS = Object.freeze([
  'finding_code', 'severity', 'disposition', 'evidence_root',
]);
const FINDING_ALLOWED_KEYS = new Set([...FINDING_REQUIRED_KEYS, 'note']);
const COMPLETION_KEYS = Object.freeze([
  'schema_version', 'status', 'extraction_run_id', 'run_contract_hash',
  'packet_count', 'packet_set_root', 'role_batch_count', 'role_batch_roots',
  'reviewer_instance_count', 'artifact_submission_count',
  'specialist_role_review_count', 'specialist_verification_cell_count',
  'receipt_count', 'finalizer_contract_root', 'submission_set_root',
  'receipt_set_root', 'disposition_histogram',
  'no_release_or_final_approval_authority', 'production_mutation_performed',
  'content_hash',
]);

const SAFE_CODES = new Set([
  'argument_rejected',
  'authority_binding_rejected',
  'batch_authority_rejected',
  'batch_content_rejected',
  'batch_coverage_rejected',
  'boundary_rejected',
  'finalization_output_collision',
  'finding_shape_rejected',
  'internal_failure',
  'packet_set_rejected',
  'receipt_schema_rejected',
  'reviewer_identity_rejected',
]);

export class SpecialistFinalizationError extends Error {
  constructor(code) {
    const safeCode = SAFE_CODES.has(code) ? code : 'internal_failure';
    super(safeCode);
    this.name = 'SpecialistFinalizationError';
    this.code = safeCode;
  }
}

function fail(code) {
  throw new SpecialistFinalizationError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function requireHash(value, code = 'batch_content_rejected') {
  if (!SHA256.test(value ?? '')) fail(code);
  return value;
}

function validateFinding(finding) {
  if (!isPlainObject(finding)
      || FINDING_REQUIRED_KEYS.some((key) => !Object.hasOwn(finding, key))
      || Object.keys(finding).some((key) => !FINDING_ALLOWED_KEYS.has(key))
      || !SAFE_CODE.test(finding.finding_code ?? '')
      || !FINDING_SEVERITIES.has(finding.severity)
      || !FINDING_DISPOSITIONS.has(finding.disposition)
      || !SHA256.test(finding.evidence_root ?? '')
      || (Object.hasOwn(finding, 'note')
        && (typeof finding.note !== 'string'
          || finding.note.length < 1 || finding.note.length > 4096))) {
    fail('finding_shape_rejected');
  }
  if (finding.severity === 'BLOCKER' || finding.disposition === 'BLOCKER') {
    fail('batch_content_rejected');
  }
  return true;
}

function validatePacket(packet) {
  if (!verifyContentAddressedEnvelope(packet)
      || !exactKeys(packet, PACKET_KEYS)
      || packet.schema_version !== PACKET_SCHEMA
      || !ALIAS.test(packet.source_alias ?? '')
      || !ALIAS.test(packet.artifact_alias ?? '')
      || !SHA256.test(packet.run_contract_hash ?? '')
      || !SHA256.test(packet.artifact_input_root ?? '')
      || !isPlainObject(packet.automated_pass_roots)
      || Object.keys(packet.automated_pass_roots).sort().join(',')
        !== ['PASS_7', 'PASS_8', 'PASS_9'].join(',')
      || !Object.values(packet.automated_pass_roots).every((root) => SHA256.test(root))
      || stableHash(packet.required_role_contract) !== stableHash(SPECIALIST_ROLE_CONTRACT)
      || packet.specialist_verification_cell_denominator !== 2
      || packet.specialist_role_review_denominator !== 4
      || packet.release_or_final_approval_authority !== false) fail('packet_set_rejected');
  if (typeof packet.extraction_run_id !== 'string' || packet.extraction_run_id.length < 8) {
    fail('packet_set_rejected');
  }
  return packet;
}

function safeRosterRoot(rows) {
  return stableHash(rows.map((row) => ({
    source_alias: row.source_alias,
    transcript_artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    nodes_artifact_alias: row.nodes_artifact_alias,
    nodes_hash: row.nodes_hash,
  })));
}

function validateFullRoster(acquisitionRows, safeRoster) {
  if (!Array.isArray(acquisitionRows) || acquisitionRows.length !== EXPECTED_SOURCE_COUNT
      || !Array.isArray(safeRoster.rows) || safeRoster.rows.length !== EXPECTED_SOURCE_COUNT) {
    fail('authority_binding_rejected');
  }
  const sourceAliases = new Set();
  const protectedArtifactAliases = new Set();
  const positions = new Set();
  const counts = {
    transcript: 0, nodes: 0, paired: 0, nodesOnly: 0, transcriptOnly: 0, neither: 0,
  };
  const safeBySource = new Map();
  for (const safeRow of safeRoster.rows) {
    if (!isPlainObject(safeRow) || !ALIAS.test(safeRow.source_alias ?? '')
        || safeBySource.has(safeRow.source_alias)) fail('authority_binding_rejected');
    safeBySource.set(safeRow.source_alias, safeRow);
  }
  for (const row of acquisitionRows) {
    if (!isPlainObject(row) || !Number.isSafeInteger(row.roster_position)
        || row.roster_position < 1 || row.roster_position > EXPECTED_SOURCE_COUNT
        || positions.has(row.roster_position) || !ALIAS.test(row.source_alias ?? '')
        || sourceAliases.has(row.source_alias)
        || !['AVAILABLE', 'NOT_AVAILABLE'].includes(row.transcript_availability)
        || !['AVAILABLE', 'NOT_AVAILABLE'].includes(row.nodes_availability)) {
      fail('authority_binding_rejected');
    }
    positions.add(row.roster_position);
    sourceAliases.add(row.source_alias);
    for (const alias of [row.transcript_artifact_alias, row.nodes_artifact_alias]) {
      if (!ALIAS.test(alias ?? '') || protectedArtifactAliases.has(alias)) {
        fail('authority_binding_rejected');
      }
      protectedArtifactAliases.add(alias);
    }
    const transcriptAvailable = row.transcript_availability === 'AVAILABLE';
    const nodesAvailable = row.nodes_availability === 'AVAILABLE';
    if ((transcriptAvailable && !SHA256.test(row.transcript_hash ?? ''))
        || (!transcriptAvailable && row.transcript_hash !== null)
        || (nodesAvailable && !SHA256.test(row.nodes_hash ?? ''))
        || (!nodesAvailable && row.nodes_hash !== null)) fail('authority_binding_rejected');
    counts.transcript += Number(transcriptAvailable);
    counts.nodes += Number(nodesAvailable);
    counts.paired += Number(transcriptAvailable && nodesAvailable);
    counts.nodesOnly += Number(!transcriptAvailable && nodesAvailable);
    counts.transcriptOnly += Number(transcriptAvailable && !nodesAvailable);
    counts.neither += Number(!transcriptAvailable && !nodesAvailable);
    const safeRow = safeBySource.get(row.source_alias);
    const expectedStatus = transcriptAvailable
      ? new Set(['COMPLETE', 'COMPLETE_WITH_QUARANTINE'])
      : nodesAvailable
        ? new Set(['RECONCILED_NODES_ONLY_NO_TRANSCRIPT'])
        : new Set(['UNRESOLVED_NO_VALIDATED_ARTIFACT']);
    if (!safeRow || safeRow.roster_position !== row.roster_position
        || safeRow.transcript_availability !== row.transcript_availability
        || safeRow.nodes_availability !== row.nodes_availability
        || safeRow.transcript_artifact_alias !== (transcriptAvailable
          ? row.transcript_artifact_alias : null)
        || safeRow.transcript_hash !== (transcriptAvailable ? row.transcript_hash : null)
        || safeRow.nodes_artifact_alias !== (nodesAvailable ? row.nodes_artifact_alias : null)
        || safeRow.nodes_hash !== (nodesAvailable ? row.nodes_hash : null)
        || !expectedStatus.has(safeRow.processing_status)) fail('authority_binding_rejected');
  }
  if (positions.size !== EXPECTED_SOURCE_COUNT || safeBySource.size !== EXPECTED_SOURCE_COUNT
      || counts.transcript !== EXPECTED_ARTIFACT_COUNT || counts.nodes !== EXPECTED_NODES_COUNT
      || counts.paired !== EXPECTED_ARTIFACT_COUNT || counts.nodesOnly !== 2
      || counts.transcriptOnly !== 0 || counts.neither !== 6
      || safeRoster.source_count !== EXPECTED_SOURCE_COUNT
      || safeRoster.transcript_available_count !== counts.transcript
      || safeRoster.nodes_available_count !== counts.nodes
      || safeRoster.nodes_only_reconciled_count !== counts.nodesOnly
      || safeRoster.neither_unresolved_count !== counts.neither
      || safeRoster.outside_consumer_projection_count !== counts.nodesOnly + counts.neither) {
    fail('authority_binding_rejected');
  }
}

function validateAuthoritativeCohort(authority, packets, ledgerSchema) {
  if (!exactKeys(authority, [
    'acquisitionState', 'extractionState', 'extractionReceipt', 'safeLedger', 'safeRoster',
  ]) || !isPlainObject(ledgerSchema)) fail('authority_binding_rejected');
  const {
    acquisitionState: acquisition,
    extractionState: state,
    extractionReceipt: receipt,
    safeLedger: ledger,
    safeRoster: roster,
  } = authority;
  if (!verifyContentAddressedEnvelope(state)
      || state.schema_version !== EXTRACTION_STATE_SCHEMA
      || !SHA256.test(state.run_contract_hash ?? '')
      || !SHA256.test(state.roster_root ?? '')
      || !Array.isArray(state.artifacts)
      || state.artifacts.length !== EXPECTED_ARTIFACT_COUNT
      || state.extraction_cursor !== EXPECTED_ARTIFACT_COUNT
      || !SHA256.test(state.artifact_ledger_hash ?? '')) fail('authority_binding_rejected');
  if (!verifyContentAddressedEnvelope(acquisition)
      || acquisition.schema_version !== ACQUISITION_STATE_SCHEMA
      || acquisition.acquisition_complete !== true
      || acquisition.extraction_run_id !== state.extraction_run_id
      || !Array.isArray(acquisition.roster)
      || acquisition.roster.length !== EXPECTED_SOURCE_COUNT
      || safeRosterRoot(acquisition.roster) !== state.roster_root) {
    fail('authority_binding_rejected');
  }
  if (!verifyContentAddressedEnvelope(receipt)
      || receipt.schema_version !== EXTRACTION_RECEIPT_SCHEMA
      || receipt.extraction_state_hash !== state.content_hash
      || receipt.extraction_run_id !== state.extraction_run_id
      || receipt.run_contract_hash !== state.run_contract_hash
      || receipt.roster_root !== state.roster_root
      || receipt.transcript_artifact_count !== EXPECTED_ARTIFACT_COUNT
      || receipt.automated_pass_cell_count !== EXPECTED_AUTOMATED_PASS_CELL_COUNT
      || receipt.exact_journal_coverage !== true
      || receipt.no_production_mutation !== true
      || typeof receipt.extraction_complete !== 'boolean') fail('authority_binding_rejected');
  const ledgerSchemaResult = validateSchemaInstance(ledgerSchema, ledger);
  const ledgerCoverage = validateCoverage(ledger, {
    requireObservedCohort: true, requireFinalization: false,
  });
  if (!verifyContentAddressedEnvelope(ledger)
      || ledger.schema_version !== SAFE_LEDGER_SCHEMA
      || !ledgerSchemaResult.valid
      || ledgerCoverage.result !== 'pass'
      || ledger.extraction_run_id !== state.extraction_run_id
      || ledger.artifacts.length !== EXPECTED_ARTIFACT_COUNT
      || state.artifact_ledger_hash !== ledger.content_hash) fail('authority_binding_rejected');
  if (!verifyContentAddressedEnvelope(roster)
      || roster.schema_version !== SAFE_ROSTER_SCHEMA
      || roster.extraction_run_id !== state.extraction_run_id
      || roster.claim_class !== 'C1_OBSERVED'
      || roster.source_count !== EXPECTED_SOURCE_COUNT
      || roster.transcript_available_count !== EXPECTED_ARTIFACT_COUNT
      || roster.nodes_available_count !== EXPECTED_NODES_COUNT
      || roster.nodes_only_reconciled_count !== 2
      || roster.neither_unresolved_count !== 6
      || !Array.isArray(roster.rows)
      || roster.rows.length !== EXPECTED_SOURCE_COUNT) fail('authority_binding_rejected');

  validateFullRoster(acquisition.roster, roster);
  if (state.extraction_complete !== receipt.extraction_complete
      || state.extraction_complete !== ledger.extraction_complete) {
    fail('authority_binding_rejected');
  }

  const byRosterPosition = (left, right) => left.roster_position - right.roster_position;
  const protectedRosterProjection = [...acquisition.roster].sort(byRosterPosition).map((row) => ({
    source_alias: row.source_alias,
    transcript_artifact_alias: row.transcript_availability === 'AVAILABLE'
      ? row.transcript_artifact_alias : null,
    transcript_hash: row.transcript_availability === 'AVAILABLE' ? row.transcript_hash : null,
    transcript_availability: row.transcript_availability,
    nodes_artifact_alias: row.nodes_availability === 'AVAILABLE' ? row.nodes_artifact_alias : null,
    nodes_hash: row.nodes_availability === 'AVAILABLE' ? row.nodes_hash : null,
    nodes_availability: row.nodes_availability,
  }));
  const safeRosterProjection = [...roster.rows].sort(byRosterPosition).map((row) => ({
    source_alias: row.source_alias,
    transcript_artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    transcript_availability: row.transcript_availability,
    nodes_artifact_alias: row.nodes_artifact_alias,
    nodes_hash: row.nodes_hash,
    nodes_availability: row.nodes_availability,
  }));
  if (stableHash(protectedRosterProjection) !== stableHash(safeRosterProjection)) {
    fail('authority_binding_rejected');
  }

  const packetByAlias = new Map(packets.map((packet) => [packet.artifact_alias, packet]));
  const ledgerByAlias = new Map(ledger.artifacts.map((artifact) => [
    artifact.artifact_alias, artifact,
  ]));
  const rosterTranscriptRows = roster.rows.filter(
    (row) => row.transcript_availability === 'AVAILABLE',
  );
  const rosterByAlias = new Map(rosterTranscriptRows.map((row) => [
    row.transcript_artifact_alias, row,
  ]));
  if (packetByAlias.size !== EXPECTED_ARTIFACT_COUNT
      || ledgerByAlias.size !== EXPECTED_ARTIFACT_COUNT
      || rosterByAlias.size !== EXPECTED_ARTIFACT_COUNT) fail('authority_binding_rejected');

  const seenSources = new Set();
  for (const summary of state.artifacts) {
    if (!isPlainObject(summary)
        || !ALIAS.test(summary.source_alias ?? '')
        || !ALIAS.test(summary.artifact_alias ?? '')
        || seenSources.has(summary.source_alias)
        || summary.run_contract_hash !== state.run_contract_hash
        || !['COMPLETE', 'COMPLETE_WITH_QUARANTINE'].includes(summary.final_artifact_status)
        || !SHA256.test(summary.transcript_hash ?? '')
        || (summary.nodes_hash !== null && !SHA256.test(summary.nodes_hash ?? ''))
        || !SHA256.test(summary.occurrence_shard_hash ?? '')
        || !SHA256.test(summary.pass_shard_hash ?? '')
        || !SHA256.test(summary.processing_receipt_hash ?? '')
        || !Array.isArray(summary.pass_receipts)
        || summary.pass_receipts.length !== 9) fail('authority_binding_rejected');
    seenSources.add(summary.source_alias);
    const expectedPacket = buildSpecialistReviewPacket({
      extractionRunId: state.extraction_run_id,
      runContractHash: state.run_contract_hash,
      sourceAlias: summary.source_alias,
      artifactAlias: summary.artifact_alias,
      transcriptHash: summary.transcript_hash,
      nodesHash: summary.nodes_hash,
      occurrenceShardHash: summary.occurrence_shard_hash,
      passShardHash: summary.pass_shard_hash,
      processingReceiptHash: summary.processing_receipt_hash,
      passReceipts: summary.pass_receipts,
    });
    const packet = packetByAlias.get(summary.artifact_alias);
    const ledgerArtifact = ledgerByAlias.get(summary.artifact_alias);
    const rosterRow = rosterByAlias.get(summary.artifact_alias);
    const ledgerPasses = new Map(
      (ledgerArtifact?.extraction_passes ?? []).map((item) => [item.pass_id, item]),
    );
    if (!packet || packet.content_hash !== expectedPacket.content_hash
        || !ledgerArtifact || !rosterRow
        || ledgerArtifact.source_alias !== summary.source_alias
        || ledgerArtifact.transcript_hash_binding !== summary.transcript_hash
        || ledgerArtifact.nodes_hash_binding !== summary.nodes_hash
        || rosterRow.source_alias !== summary.source_alias
        || rosterRow.transcript_hash !== summary.transcript_hash
        || rosterRow.nodes_hash !== summary.nodes_hash
        || ['PASS_7', 'PASS_8', 'PASS_9'].some((passId) => (
          ledgerPasses.get(passId)?.proposal_root
            !== expectedPacket.automated_pass_roots[passId]
        ))) fail('authority_binding_rejected');
  }
  if (seenSources.size !== EXPECTED_ARTIFACT_COUNT
      || state.artifacts.some((summary) => !packetByAlias.has(summary.artifact_alias))
      || [...packetByAlias.keys()].some((alias) => !ledgerByAlias.has(alias))) {
    fail('authority_binding_rejected');
  }
  return true;
}

async function syncDirectory(path) {
  if (!Number.isInteger(fsConstants.O_DIRECTORY)
      || !Number.isInteger(fsConstants.O_NOFOLLOW)) fail('boundary_rejected');
  let handle;
  try {
    handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
    );
    await handle.sync();
  } catch {
    fail('boundary_rejected');
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

function validateRoleBatch(batch, role, packetByAlias, extractionRunId, runContractHash) {
  const contract = SPECIALIST_ROLE_CONTRACT[role];
  if (!verifyContentAddressedEnvelope(batch)
      || !exactKeys(batch, BATCH_KEYS)
      || batch.schema_version !== ROLE_BATCH_SCHEMA
      || batch.specialist_role !== role
      || batch.authority_scope !== contract.authority_scope
      || batch.extraction_run_id !== extractionRunId
      || batch.run_contract_hash !== runContractHash) fail('batch_authority_rejected');
  if (!REVIEWER_ID.test(batch.reviewer_instance_id ?? '')) fail('reviewer_identity_rejected');
  if (batch.artifact_review_count !== EXPECTED_ARTIFACT_COUNT
      || !Array.isArray(batch.artifact_reviews)
      || batch.artifact_reviews.length !== EXPECTED_ARTIFACT_COUNT) {
    fail('batch_coverage_rejected');
  }
  const seen = new Set();
  const reviews = new Map();
  for (const review of batch.artifact_reviews) {
    if (!exactKeys(review, REVIEW_KEYS)
        || !ALIAS.test(review.artifact_alias ?? '')
        || seen.has(review.artifact_alias)
        || !SHA256.test(review.review_packet_root ?? '')
        || !SHA256.test(review.evidence_root ?? '')
        || !FINAL_DISPOSITIONS.has(review.disposition)
        || !Array.isArray(review.findings)) fail('batch_content_rejected');
    const packet = packetByAlias.get(review.artifact_alias);
    if (!packet || review.review_packet_root !== packet.content_hash) {
      fail('batch_coverage_rejected');
    }
    for (const finding of review.findings) validateFinding(finding);
    if ((review.findings.length === 0) !== (review.disposition === 'VERIFIED_NO_BLOCKER')) {
      fail('batch_content_rejected');
    }
    seen.add(review.artifact_alias);
    reviews.set(review.artifact_alias, review);
  }
  if (seen.size !== packetByAlias.size
      || [...packetByAlias.keys()].some((alias) => !seen.has(alias))) {
    fail('batch_coverage_rejected');
  }
  return reviews;
}

export function validateSpecialistRoleBatchInputs({ packets, batches, authority }, ledgerSchema) {
  if (!Array.isArray(packets) || packets.length !== EXPECTED_ARTIFACT_COUNT
      || !isPlainObject(batches)
      || Object.keys(batches).sort().join(',') !== [...REQUIRED_SPECIALIST_ROLES].sort().join(',')) {
    fail('batch_coverage_rejected');
  }
  const packetByAlias = new Map();
  const sourceAliases = new Set();
  let extractionRunId = null;
  let runContractHash = null;
  for (const packetValue of packets) {
    const packet = validatePacket(packetValue);
    if (packetByAlias.has(packet.artifact_alias) || sourceAliases.has(packet.source_alias)) {
      fail('packet_set_rejected');
    }
    extractionRunId ??= packet.extraction_run_id;
    runContractHash ??= packet.run_contract_hash;
    if (packet.extraction_run_id !== extractionRunId
        || packet.run_contract_hash !== runContractHash) fail('packet_set_rejected');
    packetByAlias.set(packet.artifact_alias, packet);
    sourceAliases.add(packet.source_alias);
  }
  validateAuthoritativeCohort(authority, packets, ledgerSchema);
  const reviewerIds = new Set();
  const reviewsByRole = new Map();
  for (const role of REQUIRED_SPECIALIST_ROLES) {
    const batch = batches[role];
    if (reviewerIds.has(batch?.reviewer_instance_id)) fail('reviewer_identity_rejected');
    const reviews = validateRoleBatch(
      batch, role, packetByAlias, extractionRunId, runContractHash,
    );
    reviewerIds.add(batch.reviewer_instance_id);
    reviewsByRole.set(role, reviews);
  }
  if (reviewerIds.size !== REQUIRED_SPECIALIST_ROLES.length) fail('reviewer_identity_rejected');

  const orderedPackets = [...packetByAlias.values()].sort(
    (left, right) => left.artifact_alias.localeCompare(right.artifact_alias),
  );
  const packetSetRoot = stableHash(orderedPackets.map((packet) => ({
    artifact_alias: packet.artifact_alias,
    review_packet_root: packet.content_hash,
  })));
  const batchRoots = Object.fromEntries(REQUIRED_SPECIALIST_ROLES.map((role) => [
    role, batches[role].content_hash,
  ]));
  const submissions = [];
  for (const packet of orderedPackets) {
    const roleEvidenceRoots = {};
    const reviews = REQUIRED_SPECIALIST_ROLES.map((role) => {
      const review = reviewsByRole.get(role).get(packet.artifact_alias);
      roleEvidenceRoots[role] = review.evidence_root;
      return {
        specialist_role: role,
        reviewer_instance_id: batches[role].reviewer_instance_id,
        findings: structuredClone(review.findings),
        disposition: review.disposition,
      };
    });
    submissions.push(contentAddressedEnvelope({
      schema_version: COMBINED_SUBMISSION_SCHEMA,
      extraction_run_id: extractionRunId,
      run_contract_hash: runContractHash,
      source_alias: packet.source_alias,
      artifact_alias: packet.artifact_alias,
      review_packet_root: packet.content_hash,
      role_batch_bindings: batchRoots,
      role_evidence_roots: roleEvidenceRoots,
      reviews,
    }));
  }
  return {
    extractionRunId,
    runContractHash,
    packetSetRoot,
    batchRoots,
    orderedPackets,
    submissions,
  };
}

export function buildAndValidateSpecialistFinalization(inputs, receiptSchema, ledgerSchema) {
  if (!isPlainObject(receiptSchema) || !isPlainObject(ledgerSchema)) {
    fail('receipt_schema_rejected');
  }
  const validated = validateSpecialistRoleBatchInputs(inputs, ledgerSchema);
  const submissionSetRoot = stableHash(validated.submissions.map((submission) => ({
    artifact_alias: submission.artifact_alias,
    submission_root: submission.content_hash,
  })));
  const finalizerContractRoot = stableHash({
    schema_version: FINALIZER_CONTRACT_SCHEMA,
    extraction_run_id: validated.extractionRunId,
    run_contract_hash: validated.runContractHash,
    packet_count: validated.orderedPackets.length,
    packet_set_root: validated.packetSetRoot,
    role_batch_count: REQUIRED_SPECIALIST_ROLES.length,
    role_batch_roots: validated.batchRoots,
    artifact_submission_count: validated.submissions.length,
    submission_set_root: submissionSetRoot,
    required_specialist_role_review_count:
      validated.submissions.length * REQUIRED_SPECIALIST_ROLES.length,
    required_specialist_verification_cell_count: validated.submissions.length * 2,
  });
  const receipts = [];
  const dispositionHistogram = {};
  for (let index = 0; index < validated.orderedPackets.length; index += 1) {
    const packet = validated.orderedPackets[index];
    const submission = validated.submissions[index];
    const authorityBinding = {
      schema_version: SPECIALIST_FINALIZER_AUTHORITY_SCHEMA,
      combined_submission_root: submission.content_hash,
      role_batch_roots: validated.batchRoots,
      role_evidence_roots: submission.role_evidence_roots,
      packet_set_root: validated.packetSetRoot,
      finalizer_contract_root: finalizerContractRoot,
    };
    const receipt = buildSpecialistReviewReceipt(
      packet, submission.reviews, authorityBinding,
    );
    const binding = validateSpecialistReviewReceipt(receipt, packet, {
      requireFinal: true,
      expectedAuthorityBinding: authorityBinding,
    });
    const schema = validateSchemaInstance(receiptSchema, receipt);
    if (!binding.valid || !schema.valid
        || receipt.schema_version !== SPECIALIST_REVIEW_RECEIPT_SCHEMA
        || receipt.artifact_alias !== submission.artifact_alias
        || receipt.review_packet_root !== submission.review_packet_root) {
      fail('receipt_schema_rejected');
    }
    dispositionHistogram[receipt.disposition] =
      (dispositionHistogram[receipt.disposition] ?? 0) + 1;
    receipts.push(receipt);
  }
  const receiptSetRoot = stableHash(receipts.map((receipt) => ({
    artifact_alias: receipt.artifact_alias,
    receipt_root: receipt.content_hash,
  })));
  const completion = contentAddressedEnvelope({
    schema_version: SPECIALIST_FINALIZATION_SCHEMA,
    status: 'COMPLETE',
    extraction_run_id: validated.extractionRunId,
    run_contract_hash: validated.runContractHash,
    packet_count: validated.orderedPackets.length,
    packet_set_root: validated.packetSetRoot,
    role_batch_count: REQUIRED_SPECIALIST_ROLES.length,
    role_batch_roots: validated.batchRoots,
    reviewer_instance_count: REQUIRED_SPECIALIST_ROLES.length,
    artifact_submission_count: validated.submissions.length,
    specialist_role_review_count:
      validated.submissions.length * REQUIRED_SPECIALIST_ROLES.length,
    specialist_verification_cell_count: validated.submissions.length * 2,
    receipt_count: receipts.length,
    finalizer_contract_root: finalizerContractRoot,
    submission_set_root: submissionSetRoot,
    receipt_set_root: receiptSetRoot,
    disposition_histogram: Object.fromEntries(
      Object.entries(dispositionHistogram).sort(([left], [right]) => left.localeCompare(right)),
    ),
    no_release_or_final_approval_authority: true,
    production_mutation_performed: false,
  });
  return { ...validated, receipts, completion };
}

export function validatePublishedSpecialistFinalization({
  packets, batches, submissions, receipts, completion,
}, receiptSchema) {
  if (!Array.isArray(packets) || packets.length !== EXPECTED_ARTIFACT_COUNT
      || !Array.isArray(submissions) || submissions.length !== EXPECTED_ARTIFACT_COUNT
      || !Array.isArray(receipts) || receipts.length !== EXPECTED_ARTIFACT_COUNT
      || !isPlainObject(batches)
      || Object.keys(batches).sort().join(',')
        !== [...REQUIRED_SPECIALIST_ROLES].sort().join(',')
      || !isPlainObject(receiptSchema)) fail('batch_coverage_rejected');
  const packetByAlias = new Map();
  const sourceAliases = new Set();
  let extractionRunId = null;
  let runContractHash = null;
  for (const value of packets) {
    const packet = validatePacket(value);
    if (packetByAlias.has(packet.artifact_alias) || sourceAliases.has(packet.source_alias)) {
      fail('packet_set_rejected');
    }
    extractionRunId ??= packet.extraction_run_id;
    runContractHash ??= packet.run_contract_hash;
    if (packet.extraction_run_id !== extractionRunId
        || packet.run_contract_hash !== runContractHash) fail('packet_set_rejected');
    packetByAlias.set(packet.artifact_alias, packet);
    sourceAliases.add(packet.source_alias);
  }
  const reviewerIds = new Set();
  const reviewsByRole = new Map();
  const batchRoots = {};
  for (const role of REQUIRED_SPECIALIST_ROLES) {
    const batch = batches[role];
    if (reviewerIds.has(batch?.reviewer_instance_id)) fail('reviewer_identity_rejected');
    reviewsByRole.set(role, validateRoleBatch(
      batch, role, packetByAlias, extractionRunId, runContractHash,
    ));
    reviewerIds.add(batch.reviewer_instance_id);
    batchRoots[role] = batch.content_hash;
  }
  const orderedPackets = [...packetByAlias.values()].sort(
    (left, right) => left.artifact_alias.localeCompare(right.artifact_alias),
  );
  const packetSetRoot = stableHash(orderedPackets.map((packet) => ({
    artifact_alias: packet.artifact_alias,
    review_packet_root: packet.content_hash,
  })));
  const submissionByAlias = new Map(submissions.map((item) => [item?.artifact_alias, item]));
  const receiptByAlias = new Map(receipts.map((item) => [item?.artifact_alias, item]));
  if (submissionByAlias.size !== EXPECTED_ARTIFACT_COUNT
      || receiptByAlias.size !== EXPECTED_ARTIFACT_COUNT) fail('batch_coverage_rejected');
  const expectedSubmissions = [];
  for (const packet of orderedPackets) {
    const roleEvidenceRoots = {};
    const reviews = REQUIRED_SPECIALIST_ROLES.map((role) => {
      const review = reviewsByRole.get(role).get(packet.artifact_alias);
      roleEvidenceRoots[role] = review.evidence_root;
      return {
        specialist_role: role,
        reviewer_instance_id: batches[role].reviewer_instance_id,
        findings: structuredClone(review.findings),
        disposition: review.disposition,
      };
    });
    const expected = contentAddressedEnvelope({
      schema_version: COMBINED_SUBMISSION_SCHEMA,
      extraction_run_id: extractionRunId,
      run_contract_hash: runContractHash,
      source_alias: packet.source_alias,
      artifact_alias: packet.artifact_alias,
      review_packet_root: packet.content_hash,
      role_batch_bindings: batchRoots,
      role_evidence_roots: roleEvidenceRoots,
      reviews,
    });
    const observed = submissionByAlias.get(packet.artifact_alias);
    if (!observed || stableHash(observed) !== stableHash(expected)) {
      fail('batch_content_rejected');
    }
    expectedSubmissions.push(expected);
  }
  const submissionSetRoot = stableHash(expectedSubmissions.map((submission) => ({
    artifact_alias: submission.artifact_alias,
    submission_root: submission.content_hash,
  })));
  const finalizerContractRoot = stableHash({
    schema_version: FINALIZER_CONTRACT_SCHEMA,
    extraction_run_id: extractionRunId,
    run_contract_hash: runContractHash,
    packet_count: orderedPackets.length,
    packet_set_root: packetSetRoot,
    role_batch_count: REQUIRED_SPECIALIST_ROLES.length,
    role_batch_roots: batchRoots,
    artifact_submission_count: expectedSubmissions.length,
    submission_set_root: submissionSetRoot,
    required_specialist_role_review_count:
      expectedSubmissions.length * REQUIRED_SPECIALIST_ROLES.length,
    required_specialist_verification_cell_count: expectedSubmissions.length * 2,
  });
  const verifiedReceipts = [];
  const dispositionHistogram = {};
  for (const [index, packet] of orderedPackets.entries()) {
    const submission = expectedSubmissions[index];
    const expectedAuthorityBinding = {
      schema_version: SPECIALIST_FINALIZER_AUTHORITY_SCHEMA,
      combined_submission_root: submission.content_hash,
      role_batch_roots: batchRoots,
      role_evidence_roots: submission.role_evidence_roots,
      packet_set_root: packetSetRoot,
      finalizer_contract_root: finalizerContractRoot,
    };
    const receipt = receiptByAlias.get(packet.artifact_alias);
    const schema = validateSchemaInstance(receiptSchema, receipt);
    const binding = validateSpecialistReviewReceipt(receipt, packet, {
      requireFinal: true,
      expectedAuthorityBinding,
    });
    if (!schema.valid || !binding.valid) fail('receipt_schema_rejected');
    verifiedReceipts.push(receipt);
    dispositionHistogram[receipt.disposition] =
      (dispositionHistogram[receipt.disposition] ?? 0) + 1;
  }
  const receiptSetRoot = stableHash(verifiedReceipts.map((receipt) => ({
    artifact_alias: receipt.artifact_alias,
    receipt_root: receipt.content_hash,
  })));
  const expectedHistogram = Object.fromEntries(
    Object.entries(dispositionHistogram).sort(([left], [right]) => left.localeCompare(right)),
  );
  if (!verifyContentAddressedEnvelope(completion)
      || !exactKeys(completion, COMPLETION_KEYS)
      || completion.schema_version !== SPECIALIST_FINALIZATION_SCHEMA
      || completion.status !== 'COMPLETE'
      || completion.extraction_run_id !== extractionRunId
      || completion.run_contract_hash !== runContractHash
      || completion.packet_count !== EXPECTED_ARTIFACT_COUNT
      || completion.packet_set_root !== packetSetRoot
      || completion.role_batch_count !== REQUIRED_SPECIALIST_ROLES.length
      || stableHash(completion.role_batch_roots) !== stableHash(batchRoots)
      || completion.reviewer_instance_count !== REQUIRED_SPECIALIST_ROLES.length
      || completion.artifact_submission_count !== EXPECTED_ARTIFACT_COUNT
      || completion.specialist_role_review_count
        !== EXPECTED_ARTIFACT_COUNT * REQUIRED_SPECIALIST_ROLES.length
      || completion.specialist_verification_cell_count !== EXPECTED_ARTIFACT_COUNT * 2
      || completion.receipt_count !== EXPECTED_ARTIFACT_COUNT
      || completion.finalizer_contract_root !== finalizerContractRoot
      || completion.submission_set_root !== submissionSetRoot
      || completion.receipt_set_root !== receiptSetRoot
      || stableHash(completion.disposition_histogram) !== stableHash(expectedHistogram)
      || completion.no_release_or_final_approval_authority !== true
      || completion.production_mutation_performed !== false) fail('receipt_schema_rejected');
  return {
    extractionRunId,
    runContractHash,
    packetSetRoot,
    batchRoots,
    submissionSetRoot,
    receiptSetRoot,
    finalizerContractRoot,
    receiptsByArtifact: new Map(verifiedReceipts.map((receipt) => [
      receipt.artifact_alias, receipt,
    ])),
    completion,
  };
}

async function secureMkdir(relativePath, boundaryRoot, worktreeRoot) {
  const parts = relativePath.split('/');
  let current = '';
  for (const part of parts) {
    if (!/^[A-Za-z0-9._-]+$/u.test(part)) fail('boundary_rejected');
    current = current ? `${current}/${part}` : part;
    const path = await assertBoundaryPath(boundaryRoot, current, {
      mustExist: false, kind: 'directory', operation: 'write', worktreeRoot,
    });
    let stat;
    try {
      stat = await lstat(path);
    } catch (error) {
      if (error?.code !== 'ENOENT') fail('boundary_rejected');
      await mkdir(path, { mode: DIRECTORY_MODE }).catch(() => fail('boundary_rejected'));
      await chmod(path, DIRECTORY_MODE).catch(() => fail('boundary_rejected'));
      await syncDirectory(dirname(path));
      stat = await lstat(path).catch(() => fail('boundary_rejected'));
    }
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()
        || (stat.mode & MODE_MASK) !== DIRECTORY_MODE) fail('boundary_rejected');
  }
}

function assertPublishedFileStat(stat, { allowPublicationLink = false } = {}) {
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid()
      || (stat.mode & MODE_MASK) !== FILE_MODE
      || (allowPublicationLink ? ![1, 2].includes(stat.nlink) : stat.nlink !== 1)) {
    fail('boundary_rejected');
  }
}

async function readPublishedBytes(path, { allowPublicationLink = false } = {}) {
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const stat = await handle.stat();
    assertPublishedFileStat(stat, { allowPublicationLink });
    return await handle.readFile();
  } catch (error) {
    if (error instanceof SpecialistFinalizationError) throw error;
    fail('boundary_rejected');
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function maybeStat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    fail('boundary_rejected');
  }
}

async function pendingOutputs(parent, fileName) {
  const prefix = `.${fileName}.specialist-finalize-`;
  const names = (await readdir(parent)).filter(
    (name) => name.startsWith(prefix) && name.endsWith('.tmp'),
  );
  const output = [];
  for (const name of names) {
    const path = resolve(parent, name);
    const stat = await maybeStat(path);
    if (!stat) continue;
    assertPublishedFileStat(stat, { allowPublicationLink: true });
    output.push({ path, stat });
  }
  return output;
}

async function recoverPublishedOutput(path, serialized, pending, parent) {
  const finalStat = await maybeStat(path);
  if (!finalStat) {
    for (const item of pending) {
      if (item.stat.nlink !== 1) fail('boundary_rejected');
      await unlink(item.path).catch(() => fail('boundary_rejected'));
    }
    if (pending.length > 0) await syncDirectory(parent);
    return null;
  }
  assertPublishedFileStat(finalStat, { allowPublicationLink: true });
  if (finalStat.nlink === 2) {
    const linked = pending.filter((item) => (
      item.stat.dev === finalStat.dev && item.stat.ino === finalStat.ino
    ));
    if (linked.length !== 1 || pending.length !== 1) fail('boundary_rejected');
    const bytes = await readPublishedBytes(path, { allowPublicationLink: true });
    if (!bytes.equals(Buffer.from(serialized, 'utf8'))) fail('finalization_output_collision');
    await unlink(linked[0].path).catch(() => fail('boundary_rejected'));
    await syncDirectory(parent);
    const recoveredStat = await lstat(path).catch(() => fail('boundary_rejected'));
    assertPublishedFileStat(recoveredStat);
    return 'ALREADY_PRESENT_IDENTICAL';
  }
  const bytes = await readPublishedBytes(path);
  if (!bytes.equals(Buffer.from(serialized, 'utf8'))) fail('finalization_output_collision');
  for (const item of pending) {
    if (item.stat.nlink !== 1) fail('boundary_rejected');
    await unlink(item.path).catch(() => fail('boundary_rejected'));
  }
  await syncDirectory(parent);
  return 'ALREADY_PRESENT_IDENTICAL';
}

async function injectFault(faultInjector, stage) {
  if (faultInjector !== null) await faultInjector(stage);
}

export async function exclusiveWriteForTest(
  relativePath,
  value,
  { boundaryRoot, worktreeRoot, faultInjector = null },
) {
  if (faultInjector !== null && typeof faultInjector !== 'function') fail('argument_rejected');
  await secureMkdir(dirname(relativePath), boundaryRoot, worktreeRoot);
  const fileName = basename(relativePath);
  if (!/^[A-Za-z0-9._-]+$/u.test(fileName)) fail('boundary_rejected');
  const parent = await assertBoundaryPath(boundaryRoot, dirname(relativePath), {
    mustExist: true, kind: 'directory', operation: 'write', worktreeRoot,
  });
  const path = resolve(parent, fileName);
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  const pending = await pendingOutputs(parent, fileName);
  const recovered = await recoverPublishedOutput(path, serialized, pending, parent);
  if (recovered !== null) return recovered;

  const temporary = resolve(
    parent,
    `.${fileName}.specialist-finalize-${randomBytes(18).toString('hex')}.tmp`,
  );
  let handle;
  try {
    handle = await open(
      temporary,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      FILE_MODE,
    );
    await handle.chmod(FILE_MODE);
    await injectFault(faultInjector, 'AFTER_TEMP_CREATE');
    await handle.writeFile(serialized);
    await injectFault(faultInjector, 'AFTER_TEMP_WRITE');
    await handle.sync();
    await injectFault(faultInjector, 'AFTER_TEMP_FILE_SYNC');
    await handle.close();
    handle = null;
    await syncDirectory(parent);
    await injectFault(faultInjector, 'AFTER_TEMP_DIRECTORY_SYNC');
    const temporaryStat = await lstat(temporary);
    assertPublishedFileStat(temporaryStat);
    await link(temporary, path);
    await injectFault(faultInjector, 'AFTER_PUBLICATION');
    await syncDirectory(parent);
    await injectFault(faultInjector, 'AFTER_PUBLICATION_SYNC');
    await unlink(temporary);
    await injectFault(faultInjector, 'AFTER_TEMP_UNLINK');
    await syncDirectory(parent);
    await injectFault(faultInjector, 'AFTER_CLEANUP_SYNC');
    const stat = await lstat(path);
    assertPublishedFileStat(stat);
    const bytes = await readPublishedBytes(path);
    if (!bytes.equals(Buffer.from(serialized, 'utf8'))) fail('finalization_output_collision');
    return 'CREATED';
  } catch (error) {
    await handle?.close().catch(() => {});
    if (error instanceof SpecialistFinalizationError) throw error;
    fail('boundary_rejected');
  }
}

async function exclusiveWrite(
  relativePath, value, boundaryRoot, worktreeRoot, operationLock,
) {
  assertExtractionOperationLockHeld(operationLock);
  const result = await exclusiveWriteForTest(relativePath, value, {
    boundaryRoot,
    worktreeRoot,
    faultInjector: () => assertExtractionOperationLockHeld(operationLock),
  });
  assertExtractionOperationLockHeld(operationLock);
  return result;
}

export async function recoverInterruptedPublicationsForTest(boundaryRoot) {
  const root = resolve(boundaryRoot);
  const rootStat = await maybeStat(root);
  if (!rootStat || !rootStat.isDirectory() || rootStat.isSymbolicLink()
      || rootStat.uid !== process.getuid() || (rootStat.mode & MODE_MASK) !== DIRECTORY_MODE
      || await realpath(root).catch(() => null) !== root) fail('boundary_rejected');
  for (const relativeDirectory of [
    'reviews/submissions', 'reviews/receipts', 'reviews/finalization',
  ]) {
    const directory = resolve(root, relativeDirectory);
    const directoryStat = await maybeStat(directory);
    if (!directoryStat) continue;
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()
        || directoryStat.uid !== process.getuid()
        || (directoryStat.mode & MODE_MASK) !== DIRECTORY_MODE
        || await realpath(directory).catch(() => null) !== directory) fail('boundary_rejected');
    const entries = await readdir(directory);
    for (const name of entries) {
      const match = /^\.(?<target>[A-Za-z0-9._-]+)\.specialist-finalize-[a-f0-9]{36}\.tmp$/u.exec(name);
      if (!match) continue;
      const temporary = resolve(directory, name);
      const temporaryStat = await lstat(temporary).catch(() => fail('boundary_rejected'));
      assertPublishedFileStat(temporaryStat, { allowPublicationLink: true });
      if (temporaryStat.nlink === 1) {
        await unlink(temporary).catch(() => fail('boundary_rejected'));
        await syncDirectory(directory);
        continue;
      }
      const target = resolve(directory, match.groups.target);
      const targetStat = await lstat(target).catch(() => fail('boundary_rejected'));
      assertPublishedFileStat(targetStat, { allowPublicationLink: true });
      if (targetStat.nlink !== 2 || targetStat.dev !== temporaryStat.dev
          || targetStat.ino !== temporaryStat.ino) fail('boundary_rejected');
      await unlink(temporary).catch(() => fail('boundary_rejected'));
      await syncDirectory(directory);
      assertPublishedFileStat(await lstat(target).catch(() => fail('boundary_rejected')));
    }
  }
  return 'RECOVERY_COMPLETE';
}

async function loadSchemas() {
  try {
    return {
      receipt: JSON.parse(await readFile(
        resolve(MODULE_ROOT, 'schemas/specialist-review-receipt.schema.json'), 'utf8',
      )),
      ledger: JSON.parse(await readFile(
        resolve(MODULE_ROOT, 'schemas/artifact-processing-ledger.schema.json'), 'utf8',
      )),
    };
  } catch {
    fail('receipt_schema_rejected');
  }
}

async function loadSafeAuthorityJson(path) {
  try {
    const stat = await lstat(path);
    const canonical = await realpath(path);
    const relation = relative(MODULE_ROOT, canonical);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1
        || canonical !== path || relation === '..' || relation.startsWith(`..${sep}`)
        || stat.size > 512 * 1024 * 1024) fail('authority_binding_rejected');
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof SpecialistFinalizationError) throw error;
    fail('authority_binding_rejected');
  }
}

async function loadLiveInputs(boundaryRoot, worktreeRoot) {
  const packetsPath = await assertBoundaryPath(boundaryRoot, 'reviews/packets', {
    mustExist: true, kind: 'directory', operation: 'read', worktreeRoot,
  });
  const entries = await readdir(packetsPath, { withFileTypes: true });
  if (entries.length !== EXPECTED_ARTIFACT_COUNT
      || entries.some((entry) => !entry.isFile() || !entry.name.endsWith('.json'))) {
    fail('packet_set_rejected');
  }
  const packets = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const packet = await readRestrictedJson(`reviews/packets/${entry.name}`, {
      boundaryRoot, worktreeRoot,
    });
    if (entry.name !== `${packet.artifact_alias}.json`) fail('packet_set_rejected');
    packets.push(packet);
  }
  const batches = {};
  for (const role of REQUIRED_SPECIALIST_ROLES) {
    batches[role] = await readRestrictedJson(`reviews/role-submissions/${role}.json`, {
      boundaryRoot, worktreeRoot,
    });
  }
  return {
    packets,
    batches,
    authority: {
      acquisitionState: await readRestrictedJson(ACQUISITION_STATE_PATH, {
        boundaryRoot, worktreeRoot,
      }),
      extractionState: await readRestrictedJson(EXTRACTION_STATE_PATH, {
        boundaryRoot, worktreeRoot,
      }),
      extractionReceipt: await readRestrictedJson(EXTRACTION_RECEIPT_PATH, {
        boundaryRoot, worktreeRoot,
      }),
      safeLedger: await loadSafeAuthorityJson(SAFE_LEDGER_PATH),
      safeRoster: await loadSafeAuthorityJson(SAFE_ROSTER_PATH),
    },
  };
}

async function finalizeSpecialistRoleBatchesLocked(options, operationLock) {
  assertExtractionOperationLockHeld(operationLock);
  await recoverInterruptedPublicationsForTest(options.boundaryRoot);
  assertExtractionOperationLockHeld(operationLock);
  await preflightRestrictedBoundary({
    boundaryRoot: options.boundaryRoot, worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
  });
  assertExtractionOperationLockHeld(operationLock);
  const inputs = await loadLiveInputs(options.boundaryRoot, WORKTREE_ROOT_FROM_MODULE);
  const schemas = await loadSchemas();
  const finalized = buildAndValidateSpecialistFinalization(
    inputs, schemas.receipt, schemas.ledger,
  );
  assertExtractionOperationLockHeld(operationLock);
  for (let index = 0; index < finalized.submissions.length; index += 1) {
    const submission = finalized.submissions[index];
    const receipt = finalized.receipts[index];
    await exclusiveWrite(
      `reviews/submissions/${submission.artifact_alias}.json`,
      submission,
      options.boundaryRoot,
      WORKTREE_ROOT_FROM_MODULE,
      operationLock,
    );
    await exclusiveWrite(
      `reviews/receipts/${receipt.artifact_alias}.json`,
      receipt,
      options.boundaryRoot,
      WORKTREE_ROOT_FROM_MODULE,
      operationLock,
    );
  }
  await exclusiveWrite(
    'reviews/finalization/specialist-batch-finalization.json',
    finalized.completion,
    options.boundaryRoot,
    WORKTREE_ROOT_FROM_MODULE,
    operationLock,
  );
  assertExtractionOperationLockHeld(operationLock);
  await postflightRestrictedBoundary({
    boundaryRoot: options.boundaryRoot, worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
  });
  assertExtractionOperationLockHeld(operationLock);
  return {
    result: 'pass',
    packet_count: finalized.completion.packet_count,
    role_batch_count: finalized.completion.role_batch_count,
    specialist_role_review_count: finalized.completion.specialist_role_review_count,
    specialist_verification_cell_count:
      finalized.completion.specialist_verification_cell_count,
    submission_count: finalized.completion.artifact_submission_count,
    receipt_count: finalized.completion.receipt_count,
    packet_set_root: finalized.completion.packet_set_root,
    role_batch_set_root: stableHash(finalized.completion.role_batch_roots),
    submission_set_root: finalized.completion.submission_set_root,
    receipt_set_root: finalized.completion.receipt_set_root,
    disposition_histogram: finalized.completion.disposition_histogram,
    production_mutation_count: 0,
  };
}

export async function finalizeSpecialistRoleBatches(options) {
  if (resolve(options.boundaryRoot) !== resolve(DEFAULT_RESTRICTED_BOUNDARY)
      || resolve(options.worktreeRoot) !== WORKTREE_ROOT_FROM_MODULE
      || resolve(options.worktreeRoot) !== resolve(DEFAULT_WORKTREE_ROOT)) fail('boundary_rejected');
  return withExtractionOperationLock({
    boundaryRoot: options.boundaryRoot,
    worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
    timeoutSeconds: 0,
  }, (operationLock) => finalizeSpecialistRoleBatchesLocked(options, operationLock));
}

export function syntheticInputs(count = EXPECTED_ARTIFACT_COUNT) {
  const extractionRunId = 'run_fixture_finalizer_0001';
  const runContractHash = 'a'.repeat(64);
  const summaries = Array.from({ length: count }, (_, index) => {
    const sourceAlias = `source_fixture_${String(index).padStart(4, '0')}`;
    const artifactAlias = `artifact_fixture_${String(index).padStart(4, '0')}`;
    const passReceipts = Array.from({ length: 9 }, (_unused, passIndex) => ({
      pass_id: `PASS_${passIndex + 1}`,
      status: 'COMPLETE',
      proposal_root: stableHash([artifactAlias, `PASS_${passIndex + 1}`]),
    }));
    return {
      source_alias: sourceAlias,
      artifact_alias: artifactAlias,
      transcript_hash: stableHash(['transcript', artifactAlias]),
      nodes_hash: stableHash(['nodes', artifactAlias]),
      run_contract_hash: runContractHash,
      occurrence_shard_hash: stableHash(['occurrences', artifactAlias]),
      pass_shard_hash: stableHash(['passes', artifactAlias]),
      processing_receipt_hash: stableHash(['processing', artifactAlias]),
      pass_receipts: passReceipts,
      final_artifact_status: 'COMPLETE',
    };
  });
  const packets = summaries.map((summary) => buildSpecialistReviewPacket({
    extractionRunId,
    runContractHash,
    sourceAlias: summary.source_alias,
    artifactAlias: summary.artifact_alias,
    transcriptHash: summary.transcript_hash,
    nodesHash: summary.nodes_hash,
    occurrenceShardHash: summary.occurrence_shard_hash,
    passShardHash: summary.pass_shard_hash,
    processingReceiptHash: summary.processing_receipt_hash,
    passReceipts: summary.pass_receipts,
  }));
  const batches = {};
  for (const [roleIndex, role] of REQUIRED_SPECIALIST_ROLES.entries()) {
    batches[role] = contentAddressedEnvelope({
      schema_version: ROLE_BATCH_SCHEMA,
      extraction_run_id: extractionRunId,
      run_contract_hash: runContractHash,
      specialist_role: role,
      reviewer_instance_id: `reviewer_fixture_${role.toLowerCase()}_${roleIndex}`,
      authority_scope: SPECIALIST_ROLE_CONTRACT[role].authority_scope,
      artifact_review_count: count,
      artifact_reviews: packets.map((packet) => ({
        artifact_alias: packet.artifact_alias,
        review_packet_root: packet.content_hash,
        evidence_root: stableHash([role, packet.content_hash]),
        findings: [],
        disposition: 'VERIFIED_NO_BLOCKER',
      })),
    });
  }
  const ledger = buildArtifactLedger({
    extractionRunId,
    artifactEntries: summaries.map((summary) => ({
      source_alias: summary.source_alias,
      artifact_alias: summary.artifact_alias,
      transcript_hash_binding: summary.transcript_hash,
      nodes_hash_binding: summary.nodes_hash,
      nodes_retrieval_status: 'RETRIEVED',
      nodes_record_count: 1,
      parser_selected: 'transcript_json',
      pass_receipts: summary.pass_receipts,
      final_artifact_status: 'COMPLETE',
    })),
    observedCohort: true,
  });
  const rows = summaries.map((summary, index) => ({
    roster_position: index + 1,
    source_alias: summary.source_alias,
    transcript_artifact_alias: summary.artifact_alias,
    transcript_hash: summary.transcript_hash,
    transcript_availability: 'AVAILABLE',
    nodes_artifact_alias: `artifact_nodes_${String(index).padStart(4, '0')}`,
    nodes_hash: summary.nodes_hash,
    nodes_availability: 'AVAILABLE',
    predecessor_hash_match: 'MATCH',
    processing_status: 'COMPLETE',
  }));
  for (let index = 0; index < EXPECTED_SOURCE_COUNT - count; index += 1) {
    const nodesOnly = index < 2;
    rows.push({
      roster_position: count + index + 1,
      source_alias: `source_fixture_extra_${String(index).padStart(4, '0')}`,
      transcript_artifact_alias: null,
      transcript_hash: null,
      transcript_availability: 'NOT_AVAILABLE',
      nodes_artifact_alias: nodesOnly
        ? `artifact_nodes_extra_${String(index).padStart(4, '0')}` : null,
      nodes_hash: nodesOnly ? stableHash(['nodes-extra', index]) : null,
      nodes_availability: nodesOnly ? 'AVAILABLE' : 'NOT_AVAILABLE',
      predecessor_hash_match: nodesOnly ? 'NODES_ONLY_MATCH' : 'NOT_AVAILABLE',
      processing_status: nodesOnly
        ? 'RECONCILED_NODES_ONLY_NO_TRANSCRIPT' : 'UNRESOLVED_NO_VALIDATED_ARTIFACT',
    });
  }
  const protectedRows = rows.map((row, index) => ({
    ...row,
    transcript_artifact_alias: row.transcript_artifact_alias
      ?? `artifact_transcript_absent_${String(index).padStart(4, '0')}`,
    nodes_artifact_alias: row.nodes_artifact_alias
      ?? `artifact_nodes_absent_${String(index).padStart(4, '0')}`,
  }));
  const acquisition = contentAddressedEnvelope({
    schema_version: ACQUISITION_STATE_SCHEMA,
    extraction_run_id: extractionRunId,
    acquisition_complete: true,
    roster: protectedRows,
  });
  const roster = contentAddressedEnvelope({
    schema_version: SAFE_ROSTER_SCHEMA,
    extraction_run_id: extractionRunId,
    claim_class: 'C1_OBSERVED',
    source_count: EXPECTED_SOURCE_COUNT,
    transcript_available_count: count,
    nodes_available_count: count + 2,
    nodes_only_reconciliation_scope: 'OBSERVED_TWO_NODES_ONLY_ARTIFACTS',
    nodes_only_reconciled_count: 2,
    neither_unresolved_count: 6,
    outside_consumer_projection_count: 8,
    overall_lane_b_status: 'OPEN_CONSTRAINS_COMPLETENESS',
    registry_cdn_r2_historical_reconciliation_status: 'UNRESOLVED_OUT_OF_SCOPE',
    exclusion_tombstone_reconciliation_status: 'UNRESOLVED_OUT_OF_SCOPE',
    rows,
  });
  const state = contentAddressedEnvelope({
    schema_version: EXTRACTION_STATE_SCHEMA,
    extraction_run_id: extractionRunId,
    run_contract_hash: runContractHash,
    roster_root: safeRosterRoot(protectedRows),
    artifacts: summaries,
    extraction_cursor: count,
    artifact_ledger_hash: ledger.content_hash,
    extraction_complete: false,
  });
  const receipt = contentAddressedEnvelope({
    schema_version: EXTRACTION_RECEIPT_SCHEMA,
    extraction_run_id: extractionRunId,
    run_contract_hash: runContractHash,
    extraction_state_hash: state.content_hash,
    roster_root: state.roster_root,
    transcript_artifact_count: count,
    automated_pass_cell_count: count * 9,
    exact_journal_coverage: true,
    extraction_complete: false,
    no_production_mutation: true,
  });
  return {
    packets,
    batches,
    authority: {
      acquisitionState: acquisition,
      extractionState: state,
      extractionReceipt: receipt,
      safeLedger: ledger,
      safeRoster: roster,
    },
  };
}

export async function dryRun() {
  const schemas = await loadSchemas();
  const finalized = buildAndValidateSpecialistFinalization(
    syntheticInputs(), schemas.receipt, schemas.ledger,
  );
  return {
    mode: 'dry_run',
    result: 'pass',
    network_requests: 0,
    protected_reads: 0,
    protected_writes: 0,
    packet_count: finalized.orderedPackets.length,
    role_batch_count: REQUIRED_SPECIALIST_ROLES.length,
    receipt_count: finalized.receipts.length,
    specialist_role_review_count:
      finalized.receipts.length * REQUIRED_SPECIALIST_ROLES.length,
    specialist_verification_cell_count: finalized.receipts.length * 2,
  };
}

function parseArgs(argv) {
  const options = {
    boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot: DEFAULT_WORKTREE_ROOT,
    dryRun: false,
    help: false,
  };
  for (const raw of argv) {
    if (raw === '--dry-run' || raw === '--self-test') options.dryRun = true;
    else if (raw === '--help' || raw === '-h') options.help = true;
    else fail('argument_rejected');
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write([
      'I1Q-1008E protected specialist role-batch finalizer',
      'Usage: node tools/finalize-specialist-role-batches.mjs',
      '       node tools/finalize-specialist-role-batches.mjs --dry-run',
      'Live mode accepts only the exact approved boundary and worktree.',
    ].join('\n') + '\n');
    return;
  }
  const result = options.dryRun ? await dryRun() : await finalizeSpecialistRoleBatches(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      result: 'fail',
      error_code: error instanceof SpecialistFinalizationError ? error.code
        : error?.name === 'BoundaryError' ? 'boundary_rejected'
          : error?.name === 'ExtractionOperationLockError' ? error.code : 'internal_failure',
    })}\n`);
    process.exitCode = 1;
  });
}
