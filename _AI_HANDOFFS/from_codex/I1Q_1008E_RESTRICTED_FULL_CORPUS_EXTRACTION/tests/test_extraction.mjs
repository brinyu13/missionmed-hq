import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ARTIFACT_FINAL_STATES,
  DUPLICATE_RELATIONSHIP_TYPES,
  EXTRACTION_CLASSES,
  LIFECYCLE_STATES,
  OBSERVED_COHORT_INVARIANTS,
  OBSERVED_NODES_COUNT,
  OBSERVED_TRANSCRIPT_COUNT,
  PASS_DEFINITIONS,
  REQUIRED_PASS_CELL_COUNT,
  PARSER_VERSION,
  SPEAKER_CLASSES,
} from '../tools/constants.mjs';
import {
  contentAddressedEnvelope,
  deterministicId,
  sha256,
  stableHash,
  stableStringify,
  tokenSignature,
  verifyContentAddressedEnvelope,
} from '../tools/canonical.mjs';
import {
  normalizeTime,
  parseArtifactBody,
  parseArtifactBuffer,
} from '../tools/parsers.mjs';
import {
  classifyMedicalDomain,
  classifySpeaker,
  normalizeOccurrenceText,
  runExtractionPasses,
} from '../tools/passes.mjs';
import {
  buildProvisionalConcepts,
  compareLegacy,
} from '../tools/provisional-dedupe.mjs';
import * as safeExport from '../tools/safe-export.mjs';
import {
  appendJournalEvent,
  buildArtifactLedger,
  createRunJournal,
  validateCoverage,
  validateJournal,
} from '../tools/ledger.mjs';
import {
  assertAliasMapIntegrity,
  assertBoundaryPath,
  atomicWriteRestrictedFile,
  DEFAULT_RESTRICTED_BOUNDARY,
  getOrCreateOpaqueAlias,
  getOrCreateOpaqueAliases,
  postflightRestrictedBoundary,
  preflightRestrictedBoundary,
  recoverStaleAliasLock,
  RESTRICTED_TOP_LEVEL_DIRECTORIES,
} from '../tools/boundary.mjs';
import { validateSchemaInstance } from '../tools/schema-validator.mjs';
import {
  assertAcquisitionCohortMembership,
  assertConceptIntegrity,
  assertCrossInventoryIntegrity,
  assertDuplicateRelationshipInventoryIntegrity,
  assertOccurrenceIntegrity,
  artifactFailureEvidence,
  artifactReceiptBindingsValid,
  executeWithBoundedIsolation,
  retryLedger,
} from '../tools/run-extraction.mjs';
import {
  buildSpecialistReviewPacket,
  buildSpecialistReviewReceipt,
  SPECIALIST_FINALIZER_AUTHORITY_SCHEMA,
  validateSpecialistReviewReceipt,
} from '../tools/specialist-review.mjs';
import {
  APPROVED_NETWORK_TARGET_SEMANTICS,
  artifactFailureDisposition,
  artifactHeadTransition,
  artifactResultExpectationValid,
  cumulativeArtifactAttemptCount,
  expectedArtifactAvailability,
  mapLimitFailFast,
  validateNetworkTargetApprovalBytes,
} from '../tools/acquire.mjs';
import {
  isRestrictedSpeakerFieldKey,
  restrictedShortFingerprints,
  restrictedSpeakerFingerprint,
} from '../tools/restricted-leak-audit.mjs';
import {
  DEDUPE_OCCURRENCE_FIXTURES,
  DETERMINISTIC_ID_INPUT,
  EXPECTED_ARTIFACT_FINAL_STATES,
  EXPECTED_DUPLICATE_RELATIONSHIPS,
  EXPECTED_EXTRACTION_CLASSES,
  EXPECTED_LIFECYCLE_STATES,
  EXPECTED_PASS_IDS,
  EXPECTED_SPEAKER_CLASSES,
  EXTRACTION_CASES,
  HASH_A,
  HASH_B,
  HASH_C,
  HASH_D,
  MALFORMED_ARTIFACT_FIXTURES,
  NODES_SHAPE_FIXTURES,
  NORMALIZATION_CASES,
  PRECISION_NEGATIVE_CASES,
  RESTRICTED_CANARY,
  SAFE_EXPORT_FIXTURE,
  SECRET_CANARY,
  SOURCE_LOCATION_CANARY,
  SPEAKER_CASES,
  TRANSCRIPT_SHAPE_FIXTURES,
  UNICODE_TRANSCRIPT_FIXTURE,
  cloneFixture,
  makeNinePassLedgerFixture,
  makeRosterFixture,
} from './fixtures.mjs';

const TEST_ROOT = dirname(fileURLToPath(import.meta.url));
const HANDOFF_ROOT = resolve(TEST_ROOT, '..');
const WORKTREE_ROOT = resolve(HANDOFF_ROOT, '../../..');

test('restricted leakage audit help mode performs a declared zero-I/O operation', () => {
  const script = resolve(HANDOFF_ROOT, 'tools/restricted-leak-audit.mjs');
  const output = execFileSync(process.execPath, [
    script, '--help',
  ], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.deepEqual(result, {
    mode: 'help',
    result: 'pass',
    usage: 'restricted-leak-audit.mjs [--dry-run|--help]',
    network_requests: 0,
    protected_reads: 0,
    file_writes: 0,
  });
  for (const args of [['--unknown'], ['--help', '--dry-run']]) {
    assert.throws(() => execFileSync(process.execPath, [script, ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }));
  }
});

function errorCode(error) {
  return error?.code || error?.message || String(error);
}

function normalizedValue(result) {
  if (typeof result === 'string' || result === null) return result;
  return result?.privacy_safe_normalized_wording
    ?? result?.normalized_wording
    ?? result?.normalized_text
    ?? result?.text
    ?? null;
}

function speakerClass(result) {
  return typeof result === 'string'
    ? result
    : result?.speaker_authority_class ?? result?.speaker_class ?? result?.classification;
}

function medicalFlag(result) {
  if (typeof result === 'boolean') return result;
  if (result?.is_medical !== undefined) return result.is_medical;
  if (result?.medical !== undefined) return result.medical;
  if (Number.isFinite(result?.medical_relevance_score)) return result.medical_relevance_score >= 0.55;
  return result?.extraction_class !== 'NONMEDICAL';
}

function passRows(result) {
  if (Array.isArray(result?.pass_results)) return result.pass_results;
  if (Array.isArray(result?.passes)) return result.passes;
  if (Array.isArray(result?.pass_receipts)) return result.pass_receipts;
  if (result?.pass_results && typeof result.pass_results === 'object') {
    return Object.entries(result.pass_results).map(([pass_id, value]) => ({ pass_id, ...value }));
  }
  return [];
}

function occurrenceRows(result) {
  const direct = result?.occurrences ?? result?.merged_occurrences ?? result?.proposals ?? [];
  const rows = Array.isArray(direct) ? [...direct] : [];
  for (const pass of passRows(result)) {
    const proposals = pass?.proposals ?? pass?.occurrences ?? [];
    if (Array.isArray(proposals)) rows.push(...proposals);
  }
  return rows;
}

function primaryClass(value) {
  return value?.extraction_class
    ?? value?.primary_extraction_class
    ?? value?.content?.extraction_class
    ?? value?.content?.primary_extraction_class;
}

function scanPassed(result) {
  if (result === true) return true;
  if (result === false || result === null || result === undefined) return false;
  if (result.ok !== undefined) return result.ok === true;
  if (result.pass !== undefined) return result.pass === true;
  if (typeof result.status === 'string') return ['PASS', 'PASSED', 'SAFE'].includes(result.status);
  if (typeof result.result === 'string') return result.result === 'pass';
  if (Array.isArray(result.findings)) return result.findings.length === 0;
  if (Array.isArray(result.errors)) return result.errors.length === 0;
  return false;
}

function coveragePassed(result) {
  if (result === true) return true;
  return result?.ok === true || result?.pass === true
    || result?.status === 'PASS' || result?.result === 'pass';
}

function journalValid(result) {
  if (result === true) return true;
  if (Array.isArray(result)) return result.length === 0;
  return result?.valid === true || result?.ok === true || result?.status === 'PASS';
}

async function temporaryDirectory(prefix, callback) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function temporaryBoundaryDirectory(prefix, callback) {
  const parent = dirname(DEFAULT_RESTRICTED_BOUNDARY);
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, prefix));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function makeBoundary(root) {
  await chmod(root, 0o700);
  for (const directory of RESTRICTED_TOP_LEVEL_DIRECTORIES) {
    await mkdir(join(root, directory), { recursive: true, mode: 0o700 });
    await chmod(join(root, directory), 0o700);
  }
  return root;
}

function runFixturePasses(transcriptRecords, nodesRecords = []) {
  return runExtractionPasses({
    transcriptRecords,
    nodesRecords,
    context: {
      extraction_run_id: 'run_fixture_0001',
      source_alias: 'source_fixture_0001',
      transcript_artifact_alias: 'artifact_transcript_fixture_0001',
      transcript_hash: HASH_A,
      nodes_hash: nodesRecords.length > 0 ? 'b'.repeat(64) : null,
      source_lineage_hash: 'c'.repeat(64),
      retrieval_receipt_binding: 'd'.repeat(64),
      processing_receipt_binding: 'e'.repeat(64),
    },
  });
}

function makeRecord(text, {
  ordinal = 0,
  speaker = 'instructor_fixture',
  start = ordinal,
  locatorPrefix = 'record_index',
} = {}) {
  return {
    record_ordinal: ordinal,
    segment_locator: `${locatorPrefix}_${String(ordinal).padStart(8, '0')}`,
    segment_start_time: start,
    segment_end_time: start + 1,
    speaker_label: speaker,
    text,
    text_status: text ? 'PRESENT' : 'EMPTY_OR_UNSUPPORTED',
    timestamp_status: 'PARSED',
    raw_record_hash: stableHash({ ordinal, speaker, text, locatorPrefix }),
    text_hash: sha256(text),
  };
}

async function readSchema(name) {
  return JSON.parse(await readFile(join(HANDOFF_ROOT, 'schemas', name), 'utf8'));
}

function makeArtifactEntries({ completedPasses = 9 } = {}) {
  const roster = makeRosterFixture();
  const passEntries = makeNinePassLedgerFixture({ completedPasses });
  return roster.entries.slice(0, 97).map((entry, index) => ({
    source_alias: entry.source_alias,
    artifact_alias: `artifact_${entry.transcript.artifact_alias}`,
    parser_selected: 'transcript_json',
    parser_version: PARSER_VERSION,
    segment_count: 1,
    nodes_record_count: entry.nodes ? 1 : 0,
    pass_receipts: EXPECTED_PASS_IDS.map((passId) => {
      const state = passEntries[index].passes[passId];
      return {
        pass_id: passId,
        status: state.status,
        records_inspected: state.status === 'COMPLETE' ? 1 : 0,
        proposals_emitted: 0,
        proposal_root: stableHash([]),
      };
    }),
    final_artifact_status: completedPasses === 9 ? 'COMPLETE' : 'PARTIAL_WITH_PROVEN_BLOCKER',
    blocker_root_cause: completedPasses === 9 ? null : 'SYNTHETIC_INTERRUPTION',
    recovery_methods: completedPasses === 9 ? [] : ['RESUME_FROM_LAST_VALID_CHECKPOINT'],
    resumable_next_step: completedPasses === 9 ? null : 'Resume the missing pass.',
  }));
}

function makeSpecialistPacket(overrides = {}) {
  return buildSpecialistReviewPacket({
    extractionRunId: 'run_fixture_0001',
    runContractHash: HASH_A,
    sourceAlias: 'source_fixture_0001',
    artifactAlias: 'artifact_fixture_0001',
    transcriptHash: HASH_B,
    nodesHash: HASH_C,
    occurrenceShardHash: HASH_D,
    passShardHash: stableHash('pass-shard-fixture'),
    processingReceiptHash: stableHash('processing-receipt-fixture'),
    passReceipts: ['PASS_7', 'PASS_8', 'PASS_9'].map((passId) => ({
      pass_id: passId,
      proposal_root: stableHash(['proposal', passId]),
    })),
    ...overrides,
  });
}

function makeSpecialistSubmissions(overrides = {}) {
  return ['OSLER', 'ASSESSMENT_SCIENCE', 'TURING', 'ENGINEERING'].map((role, index) => ({
    specialist_role: role,
    reviewer_instance_id: `reviewer_fixture_${String(index + 1).padStart(4, '0')}`,
    findings: [],
    disposition: 'VERIFIED_NO_BLOCKER',
    ...(overrides[role] ?? {}),
  }));
}

function makeSpecialistAuthorityBinding(overrides = {}) {
  const roles = ['OSLER', 'ASSESSMENT_SCIENCE', 'TURING', 'ENGINEERING'];
  return {
    schema_version: SPECIALIST_FINALIZER_AUTHORITY_SCHEMA,
    combined_submission_root: stableHash('combined-submission-fixture'),
    role_batch_roots: Object.fromEntries(roles.map((role) => [
      role, stableHash(['role-batch', role]),
    ])),
    role_evidence_roots: Object.fromEntries(roles.map((role) => [
      role, stableHash(['role-evidence', role]),
    ])),
    packet_set_root: stableHash('packet-set-fixture'),
    finalizer_contract_root: stableHash('finalizer-contract-fixture'),
    ...overrides,
  };
}

function makeFinalizedArtifactEntries() {
  return makeArtifactEntries().map((entry, index) => {
    const pass7Cell = stableHash(['specialist-cell', index, 'PASS_7']);
    const pass8Cell = stableHash(['specialist-cell', index, 'PASS_8']);
    const receiptRoot = stableHash(['specialist-receipt', index]);
    const pass9Finalization = stableHash(['pass9-finalization', index]);
    return {
      ...entry,
      independent_verification_status: 'VERIFIED',
      specialist_role_review_count: 4,
      specialist_review_receipt_root: receiptRoot,
      pass_9_finalization_root: pass9Finalization,
      pass_receipts: entry.pass_receipts.map((receipt) => {
        if (receipt.pass_id === 'PASS_7') return {
          ...receipt,
          independent_verification_status: 'VERIFIED',
          specialist_verification_cell_root: pass7Cell,
        };
        if (receipt.pass_id === 'PASS_8') return {
          ...receipt,
          independent_verification_status: 'VERIFIED',
          specialist_verification_cell_root: pass8Cell,
        };
        if (receipt.pass_id === 'PASS_9') return {
          ...receipt,
          independent_verification_status: 'VERIFIED',
          specialist_verification_receipt_root: receiptRoot,
          finalization_input_root: pass9Finalization,
        };
        return receipt;
      }),
    };
  });
}

function makeSafeProjectionInput(extraOccurrenceFields = {}) {
  const passStatus = Object.fromEntries(EXPECTED_PASS_IDS.map((passId) => [passId, {
    pass_id: passId,
    status: 'COMPLETE',
    records_inspected: 1,
    proposals_emitted: 0,
    proposal_root: stableHash([]),
  }]));
  return {
    extractionRunId: 'run_fixture_0001',
    authorityTicketHash: HASH_A,
    predecessorCommit: '9af94d9',
    predecessorReceiptHash: 'b'.repeat(64),
    boundaryDecisionHash: 'c'.repeat(64),
    roster: [{
      roster_position: 1,
      source_alias: 'source_fixture_0001',
      transcript_artifact_alias: 'artifact_transcript_fixture_0001',
      transcript_hash: HASH_A,
      transcript_availability: 'AVAILABLE',
      nodes_artifact_alias: 'artifact_nodes_fixture_0001',
      nodes_hash: 'b'.repeat(64),
      nodes_availability: 'AVAILABLE',
      predecessor_hash_match: 'MATCH',
      processing_status: 'COMPLETE',
    }],
    artifactLedger: {
      content_hash: 'd'.repeat(64),
      artifacts: [{ final_artifact_status: 'COMPLETE', pass_status: passStatus }],
    },
    occurrences: [{
      candidate_occurrence_id: 'occurrence_fixture_0001',
      source_alias: 'source_fixture_0001',
      artifact_alias: 'artifact_transcript_fixture_0001',
      extraction_class: 'DIAGNOSIS_PROMPT',
      speaker_authority_class: 'PROBABLE_DR_J',
      lifecycle_status: 'REVIEW_REQUIRED',
      subject: 'UNCLASSIFIED',
      question_form: 'DIAGNOSIS',
      verbatim_or_reconstructed: 'VERBATIM',
      privacy_class: 'RESTRICTED_UNREVIEWED',
      rights_status: 'RESTRICTED_INTERNAL_UNKNOWN',
      medical_review_status: 'MEDICAL_REVIEW_REQUIRED',
      privacy_review_status: 'AUTOMATED_SCREEN_ONLY',
      release_status: 'NOT_RELEASEABLE',
      provisional_concept_id: 'concept_fixture_0001',
      provisional_duplicate_cluster_id: 'cluster_fixture_0001',
      content_hash: 'e'.repeat(64),
      transcript_hash_binding: HASH_A,
      extraction_pass_bindings: ['PASS_1'],
      ...extraOccurrenceFields,
    }],
    concepts: [{
      provisional_concept_id: 'concept_fixture_0001',
      provisional_duplicate_cluster_id: 'cluster_fixture_0001',
      status: 'PROVISIONAL_NOT_CANONICAL',
      occurrence_ids: ['occurrence_fixture_0001'],
      subject: 'UNCLASSIFIED',
      organ_system: 'UNCLASSIFIED',
      discipline: 'UNCLASSIFIED',
      question_forms: ['DIAGNOSIS'],
      ambiguity_flags: [],
      adjudication_status: 'PENDING_I1Q_1008F',
      content_hash: 'f'.repeat(64),
    }],
    retryLedger: { content_hash: '1'.repeat(64) },
    legacyComparison: null,
    sourceMutationCount: 0,
  };
}

test('contract enums are exact, closed, and preserve the 97 x 9 = 873 invariant', () => {
  assert.deepEqual(EXTRACTION_CLASSES, EXPECTED_EXTRACTION_CLASSES);
  assert.deepEqual(SPEAKER_CLASSES, EXPECTED_SPEAKER_CLASSES);
  assert.deepEqual(LIFECYCLE_STATES, EXPECTED_LIFECYCLE_STATES);
  assert.deepEqual(DUPLICATE_RELATIONSHIP_TYPES, EXPECTED_DUPLICATE_RELATIONSHIPS);
  assert.deepEqual(ARTIFACT_FINAL_STATES, EXPECTED_ARTIFACT_FINAL_STATES);
  assert.deepEqual(PASS_DEFINITIONS.map((pass) => pass.pass_id), EXPECTED_PASS_IDS);
  assert.equal(PASS_DEFINITIONS.length, 9);
  assert.equal(OBSERVED_TRANSCRIPT_COUNT, 97);
  assert.equal(OBSERVED_NODES_COUNT, 99);
  assert.equal(REQUIRED_PASS_CELL_COUNT, 873);
  assert.deepEqual(OBSERVED_COHORT_INVARIANTS, {
    transcriptArtifactCount: 97,
    nodesArtifactCount: 99,
    requiredPassesPerTranscript: 9,
    requiredPassCellCount: 873,
  });
  for (const list of [
    EXTRACTION_CLASSES,
    SPEAKER_CLASSES,
    LIFECYCLE_STATES,
    DUPLICATE_RELATIONSHIP_TYPES,
    ARTIFACT_FINAL_STATES,
    PASS_DEFINITIONS,
  ]) assert.equal(Object.isFrozen(list), true);
  assert.equal(LIFECYCLE_STATES.includes('APPROVED'), false);
  assert.equal(LIFECYCLE_STATES.includes('RELEASED'), false);
});

test('canonical serialization, hashes, and identifiers are deterministic and hash-bound', () => {
  const left = { z: 1, nested: { b: true, a: 'fixture' }, a: [3, 2, 1] };
  const right = { a: [3, 2, 1], nested: { a: 'fixture', b: true }, z: 1 };
  assert.equal(stableStringify(left), stableStringify(right));
  assert.equal(stableHash(left), stableHash(right));
  assert.equal(sha256(Buffer.from('fixture', 'utf8')), sha256(Buffer.from('fixture', 'utf8')));
  assert.throws(() => stableStringify({ invalid: Number.NaN }), /canonical_non_finite_number/u);
  assert.throws(() => stableStringify({ invalid: undefined }), /canonical_undefined_value/u);

  const idA = deterministicId('occurrence', DETERMINISTIC_ID_INPUT);
  const idB = deterministicId('occurrence', { ...DETERMINISTIC_ID_INPUT });
  const changed = deterministicId('occurrence', { ...DETERMINISTIC_ID_INPUT, transcript_hash_binding: 'c'.repeat(64) });
  assert.equal(idA, idB);
  assert.notEqual(idA, changed);
  assert.match(idA, /^occurrence_sha256_[a-f0-9]{64}$/u);
  assert.throws(() => deterministicId('Invalid Prefix', DETERMINISTIC_ID_INPUT), /prefix_invalid/u);
  assert.equal(tokenSignature('“Modeled finding” cafe\u0301'), tokenSignature('modeled finding café'));
});

test('transcript parser accepts all supported synthetic wrapper shapes deterministically', () => {
  for (const fixture of TRANSCRIPT_SHAPE_FIXTURES) {
    const first = parseArtifactBody(cloneFixture(fixture.payload), 'transcript_json');
    const second = parseArtifactBody(cloneFixture(fixture.payload), 'transcript_json');
    assert.equal(first.record_count, fixture.expected_record_count, fixture.name);
    assert.equal(first.records.length, fixture.expected_record_count, fixture.name);
    assert.deepEqual(first, second, fixture.name);
    assert.deepEqual(first.records.map((record) => record.record_ordinal), [0, 1, 2, 3, 4, 5]);
    assert.equal(new Set(first.records.map((record) => record.segment_locator)).size, first.record_count);
    assert.ok(first.records.every((record) => /^[a-f0-9]{64}$/u.test(record.raw_record_hash)));
  }
});

test('Nodes parser accepts all supported synthetic wrapper shapes', () => {
  for (const fixture of NODES_SHAPE_FIXTURES) {
    const parsed = parseArtifactBody(cloneFixture(fixture.payload), 'nodes_json');
    assert.equal(parsed.record_count, fixture.expected_record_count, fixture.name);
    assert.equal(parsed.records_with_text_count, fixture.expected_record_count, fixture.name);
    assert.ok(parsed.records.every((record) => record.text_status === 'PRESENT'));
  }
});

test('parser rejects malformed bytes, unsupported schemas, hash drift, and invalid UTF-8', () => {
  const malformed = MALFORMED_ARTIFACT_FIXTURES.find((fixture) => fixture.name === 'invalid_json');
  assert.throws(
    () => parseArtifactBuffer(Buffer.from(malformed.body, 'utf8'), 'transcript_json'),
    (error) => errorCode(error) === 'artifact_json_rejected',
  );
  const unsupported = MALFORMED_ARTIFACT_FIXTURES.find((fixture) => fixture.name === 'unsupported_wrapper');
  assert.throws(
    () => parseArtifactBody(cloneFixture(unsupported.payload), 'transcript_json'),
    (error) => errorCode(error) === 'artifact_schema_rejected',
  );
  const validBody = Buffer.from(JSON.stringify(TRANSCRIPT_SHAPE_FIXTURES[0].payload), 'utf8');
  assert.throws(
    () => parseArtifactBuffer(validBody, 'transcript_json', 'f'.repeat(64)),
    (error) => errorCode(error) === 'artifact_hash_mismatch',
  );
  assert.throws(
    () => parseArtifactBuffer(Buffer.from([0xc3, 0x28]), 'transcript_json'),
    (error) => errorCode(error) === 'artifact_utf8_rejected',
  );
  assert.throws(
    () => parseArtifactBody([], 'unsupported_class'),
    (error) => errorCode(error) === 'artifact_class_rejected',
  );
});

test('malformed records remain visible as parser findings rather than disappearing', () => {
  const missingText = MALFORMED_ARTIFACT_FIXTURES.find((fixture) => fixture.name === 'missing_text');
  const missing = parseArtifactBody(cloneFixture(missingText.payload), 'transcript_json');
  assert.equal(missing.record_count, 1);
  assert.equal(missing.records[0].text_status, 'EMPTY_OR_UNSUPPORTED');

  const negativeTime = MALFORMED_ARTIFACT_FIXTURES.find((fixture) => fixture.name === 'negative_timestamp');
  const negative = parseArtifactBody(cloneFixture(negativeTime.payload), 'transcript_json');
  assert.equal(negative.record_count, 1);
  assert.equal(negative.records[0].timestamp_status, 'MISSING_OR_UNPARSEABLE');

  const reversedTime = MALFORMED_ARTIFACT_FIXTURES.find((fixture) => fixture.name === 'reversed_interval');
  const reversed = parseArtifactBody(cloneFixture(reversedTime.payload), 'transcript_json');
  assert.equal(reversed.record_count, 1);
  assert.equal(reversed.records[0].timestamp_status, 'END_BEFORE_START');
  assert.equal(reversed.records[0].segment_end_time, null);
});

test('Unicode and timestamp normalization are loss-aware and deterministic', () => {
  const parsed = parseArtifactBody(cloneFixture(UNICODE_TRANSCRIPT_FIXTURE), 'transcript_json');
  assert.equal(parsed.record_count, 1);
  assert.match(parsed.records[0].text, /café/u);
  assert.match(parsed.records[0].text, /β-blocker/u);
  assert.match(parsed.records[0].text, /👩🏽‍⚕️/u);
  assert.equal(parsed.records[0].text, parsed.records[0].text.normalize('NFC'));
  assert.equal(normalizeTime('01:02:03.5'), 3723.5);
  assert.equal(normalizeTime('PT1M2.5S'), 62.5);
  assert.equal(normalizeTime(1500, 'start_ms'), 1.5);
  assert.equal(normalizeTime(-1), null);
  assert.equal(normalizeTime('not-a-time'), null);
});

test('all nine extraction passes run even when a pass emits no proposals', () => {
  const transcript = parseArtifactBody(cloneFixture(TRANSCRIPT_SHAPE_FIXTURES[0].payload), 'transcript_json');
  const nodes = parseArtifactBody(cloneFixture(NODES_SHAPE_FIXTURES[0].payload), 'nodes_json');
  const result = runFixturePasses(transcript.records, nodes.records);
  const rows = passRows(result);
  assert.deepEqual(rows.map((row) => row.pass_id ?? row.id), EXPECTED_PASS_IDS);
  assert.equal(rows.length, 9);
  assert.ok(rows.every((row) => ['COMPLETE', 'COMPLETE_WITH_FINDINGS'].includes(row.status)));
});

test('recall fixtures are recovered with their required primary classes', () => {
  for (const [index, fixture] of EXTRACTION_CASES.entries()) {
    const record = {
      record_ordinal: index,
      segment_locator: `record_index_${String(index).padStart(8, '0')}`,
      segment_start_time: index,
      segment_end_time: index + 1,
      speaker_label: fixture.speaker ?? 'instructor_fixture',
      text: fixture.text,
      text_status: 'PRESENT',
      timestamp_status: 'PARSED',
      raw_record_hash: stableHash(fixture),
      text_hash: sha256(fixture.text),
    };
    const nodeRecords = fixture.nodes_text ? [{
      ...record,
      segment_locator: `node_index_${String(index).padStart(8, '0')}`,
      text: fixture.nodes_text,
      raw_record_hash: stableHash({ node: fixture.nodes_text }),
      text_hash: sha256(fixture.nodes_text),
    }] : [];
    const transcriptRecords = [record];
    if (fixture.expected_class === 'LEARNER_QUESTION_WITH_DRJ_TEACHING') {
      transcriptRecords.push({
        ...record,
        record_ordinal: index + 1,
        segment_locator: `record_index_${String(index + 1).padStart(8, '0')}`,
        segment_start_time: index + 1,
        segment_end_time: index + 2,
        speaker_label: 'instructor_fixture',
        text: 'The cardiac mechanism explains this modeled finding.',
        raw_record_hash: stableHash({ response: index }),
        text_hash: sha256('The cardiac mechanism explains this modeled finding.'),
      });
    }
    const result = runFixturePasses(transcriptRecords, nodeRecords);
    const classes = new Set(occurrenceRows(result).map(primaryClass).filter(Boolean));
    assert.ok(classes.has(fixture.expected_class), `${fixture.expected_class}: ${fixture.text}`);
  }
});

test('administrative and rhetorical negatives do not become retained medical occurrences', () => {
  const cases = [
    ...PRECISION_NEGATIVE_CASES,
    'Can everyone see the cardiac slide?',
    'Does the ECG slide look blurry?',
    'Can everyone hear the pulmonary lecture audio?',
    'Is the microphone working during the cardiac lecture?',
  ];
  for (const [index, text] of cases.entries()) {
    const record = {
      record_ordinal: index,
      segment_locator: `record_index_${String(index).padStart(8, '0')}`,
      segment_start_time: index,
      segment_end_time: index + 1,
      speaker_label: 'instructor_fixture',
      text,
      text_status: 'PRESENT',
      timestamp_status: 'PARSED',
      raw_record_hash: stableHash({ index, text }),
      text_hash: sha256(text),
    };
    const result = runFixturePasses([record]);
    const classes = occurrenceRows(result).map(primaryClass).filter(Boolean);
    assert.ok(classes.length === 0 || classes.every((value) => value === 'NONMEDICAL'), text);
    assert.equal(medicalFlag(classifyMedicalDomain(text)), false, text);
  }
});

test('presentation media language does not suppress genuine clinical interpretation prompts', () => {
  const cases = [
    'What does the ECG on this slide show?',
    'Interpret the CT image on the shared screen.',
    'Can you see ST elevation on this ECG?',
    'Which diagnosis is illustrated on the cardiac slide on valvular disease?',
  ];
  for (const [index, text] of cases.entries()) {
    const result = runFixturePasses([makeRecord(text, { ordinal: index })]);
    assert.ok(result.occurrences.some((item) => (
      ['INTERPRETATION_PROMPT', 'DIAGNOSIS_PROMPT'].includes(item.extraction_class)
    )), text);
    assert.ok(result.occurrences.some((item) => item.extraction_class !== 'NONMEDICAL'), text);
    assert.equal(medicalFlag(classifyMedicalDomain(text)), true, text);
  }
});

test('normalization repairs surface form without inventing missing clinical facts', () => {
  for (const fixture of NORMALIZATION_CASES) {
    const result = normalizeOccurrenceText(fixture.input);
    const value = normalizedValue(result);
    if (fixture.expected !== null) {
      assert.equal(value, fixture.expected);
      continue;
    }
    const serialized = JSON.stringify(result);
    assert.ok(value === null || value === fixture.input || serialized.includes(fixture.required_lifecycle));
    assert.match(serialized, /missing fact/u);
  }
  const source = 'What is the modeled diagnosis?';
  const normalized = normalizedValue(normalizeOccurrenceText(source));
  for (const forbiddenAddition of ['laboratory value', 'unsupported symptom', 'new diagnosis']) {
    assert.equal(String(normalized).toLowerCase().includes(forbiddenAddition), false);
  }
});

test('speaker authority fixtures preserve uncertainty and require authority for VERIFIED_DR_J', () => {
  for (const fixture of SPEAKER_CASES) {
    const label = fixture.name === 'owner_attested' ? 'fixture_owner'
      : fixture.name === 'corroborated_instructional_turn' ? 'instructor'
        : fixture.name === 'single_probabilistic_signal' ? 'fixture_primary'
          : fixture.name === 'learner_turn' ? 'learner'
            : fixture.name === 'conflicting_labels' ? 'fixture_minor' : '';
    const context = fixture.name === 'owner_attested'
      ? { verified_drj_labels: new Set(['fixture owner']) }
      : fixture.name === 'corroborated_instructional_turn'
        ? { corroborated_drj_labels: new Set(['instructor']) }
      : fixture.name === 'single_probabilistic_signal'
        ? { label_counts: new Map([[label, 1]]), labeled_record_count: 1 }
        : fixture.name === 'conflicting_labels'
          ? {
            label_counts: new Map([[label, 1], ['fixture_primary', 9]]),
            labeled_record_count: 10,
          }
          : {};
    assert.equal(speakerClass(classifySpeaker({ speaker_label: label }, context)), fixture.expected_class, fixture.name);
  }
  const probabilistic = classifySpeaker(
    { speaker_label: 'instructor_fixture' },
    { confidence_score: 1 },
  );
  assert.notEqual(speakerClass(probabilistic), 'VERIFIED_DR_J');
});

test('provisional dedupe is deterministic, non-destructive, and preserves every occurrence', () => {
  const original = cloneFixture(DEDUPE_OCCURRENCE_FIXTURES);
  const first = buildProvisionalConcepts(cloneFixture(original));
  const second = buildProvisionalConcepts(cloneFixture(original));
  assert.deepEqual(first, second);
  assert.deepEqual(original, DEDUPE_OCCURRENCE_FIXTURES);

  const concepts = first?.concepts ?? first?.provisional_concepts ?? [];
  const relationships = first?.relationships
    ?? first?.duplicate_relationships
    ?? concepts.flatMap((concept) => concept.relationship_edges ?? []);
  const linked = new Set(concepts.flatMap((concept) => (
    concept.occurrence_ids ?? concept.candidate_occurrence_ids ?? concept.members ?? []
  )));
  for (const occurrence of original) assert.ok(linked.has(occurrence.candidate_occurrence_id));
  assert.ok(relationships.some((relationship) => (
    relationship.relationship_type ?? relationship.type
  ) === 'EXACT_TEXT_DUPLICATE'));
  assert.ok(relationships.every((relationship) => DUPLICATE_RELATIONSHIP_TYPES.includes(
    relationship.relationship_type ?? relationship.type,
  )));
  assert.equal(first?.destructive_merge_performed ?? false, false);
});

test('legacy comparison remains secondary and cannot promote or delete transcript occurrences', () => {
  const transcriptConcepts = buildProvisionalConcepts(cloneFixture(DEDUPE_OCCURRENCE_FIXTURES));
  const legacyRows = [
    { legacy_alias: 'legacy_fixture_0001', prompt: 'What is the modeled diagnosis?' },
    { legacy_alias: 'legacy_fixture_0002', prompt: 'Unrelated fixture wording.' },
  ];
  const before = stableHash(transcriptConcepts);
  const comparison = compareLegacy(transcriptConcepts.concepts, legacyRows);
  assert.equal(stableHash(transcriptConcepts), before);
  assert.equal(comparison?.legacy_promotions ?? comparison?.promoted_legacy_rows ?? 0, 0);
  assert.equal(comparison?.destructive_merge_performed ?? false, false);
});

test('full-roster coverage requires exactly 97 transcript artifacts and 873 completed pass cells', () => {
  const roster = makeRosterFixture();
  assert.equal(roster.transcript_count, 97);
  assert.equal(roster.nodes_count, 99);
  const ledger = buildArtifactLedger({
    extractionRunId: 'run_fixture_0001',
    artifactEntries: makeArtifactEntries(),
    observedCohort: true,
  });
  const coverage = validateCoverage(ledger, { requireObservedCohort: true });
  assert.equal(coveragePassed(coverage), true);
  assert.equal(coverage.metrics.complete_pass_cells, 873);
  assert.equal(coverage.metrics.expected_pass_cells, 873);
  assert.equal(coverage.metrics.artifact_count, 97);
  assert.equal(coverage.metrics.pass_count, 9);

  const incomplete = buildArtifactLedger({
    extractionRunId: 'run_fixture_0001',
    artifactEntries: makeArtifactEntries({ completedPasses: 8 }),
    observedCohort: true,
  });
  const incompleteCoverage = validateCoverage(incomplete, { requireObservedCohort: true });
  assert.equal(coveragePassed(incompleteCoverage), false);
});

test('journal interruption/resume is hash-chained, idempotent, and tamper-evident', () => {
  let journal = createRunJournal({
    extractionRunId: 'run_fixture_0001',
    runContractHash: 'b'.repeat(64),
    rosterRoot: HASH_A,
  });
  journal = appendJournalEvent(journal, {
    artifact_alias: 'artifact_transcript_fixture_0001',
    phase: 'PASS_1',
    pass_id: 'PASS_1',
    attempt_number: 1,
    input_hash: HASH_A,
    rules_hash: 'b'.repeat(64),
    parser_hash: 'c'.repeat(64),
    state_transition: 'NOT_STARTED_TO_RUNNING',
  });
  assert.equal(journalValid(validateJournal(journal)), true);

  const serializedInterrupted = stableStringify(journal);
  journal = JSON.parse(serializedInterrupted);
  journal = appendJournalEvent(journal, {
    artifact_alias: 'artifact_transcript_fixture_0001',
    phase: 'PASS_1',
    pass_id: 'PASS_1',
    attempt_number: 2,
    input_hash: HASH_A,
    rules_hash: 'b'.repeat(64),
    parser_hash: 'c'.repeat(64),
    state_transition: 'RUNNING_TO_COMPLETE_AFTER_INTERRUPTION',
    output_shard_hash: 'd'.repeat(64),
  });
  assert.equal(journalValid(validateJournal(journal)), true);

  const tampered = cloneFixture(journal);
  const events = tampered.events ?? tampered.journal_events;
  events[0].state = 'COMPLETE';
  assert.equal(journalValid(validateJournal(tampered)), false);
});

test('restricted boundary rejects the worktree, weak permissions, traversal, and symlink escape', async () => {
  await temporaryBoundaryDirectory('i1q-1008e-boundary-', async (root) => {
    const boundary = await makeBoundary(root);
    await preflightRestrictedBoundary({ boundaryRoot: boundary, worktreeRoot: WORKTREE_ROOT });
    await assertBoundaryPath(boundary, join(boundary, 'state'), { mustExist: true, kind: 'directory' });
    await assert.rejects(
      () => assertBoundaryPath(boundary, join(boundary, '..', 'escape.fixture')),
      /boundary|containment|outside|escape/iu,
    );

    const outside = join(dirname(boundary), `outside-${Date.now()}`);
    await mkdir(outside, { mode: 0o700 });
    try {
      await symlink(outside, join(boundary, 'working', 'escape-link'));
      await assert.rejects(
        () => assertBoundaryPath(boundary, join(boundary, 'working', 'escape-link', 'value.json')),
        /boundary|symlink|containment|outside|escape/iu,
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }

    await chmod(boundary, 0o755);
    await assert.rejects(
      () => preflightRestrictedBoundary({ boundaryRoot: boundary, worktreeRoot: WORKTREE_ROOT }),
      /permission|mode|0700|boundary/iu,
    );
  });

  await assert.rejects(
    () => preflightRestrictedBoundary({ boundaryRoot: HANDOFF_ROOT, worktreeRoot: WORKTREE_ROOT }),
    /worktree|git|boundary|outside/iu,
  );
});

test('restricted atomic writer revalidates its mutation guard immediately before publication', async () => {
  await temporaryBoundaryDirectory('i1q-1008e-write-guard-', async (root) => {
    const boundary = await makeBoundary(root);
    const target = join(boundary, 'state/guarded-publication.json');
    await writeFile(target, '{"version":"old"}\n', { mode: 0o600 });
    await chmod(target, 0o600);
    let guardCallCount = 0;
    const mutationGuard = () => {
      guardCallCount += 1;
      if (guardCallCount === 5) {
        const error = new Error('synthetic_operation_lock_lost_at_publication');
        error.name = 'ExtractionOperationLockError';
        throw error;
      }
    };
    await assert.rejects(
      atomicWriteRestrictedFile('state/guarded-publication.json', '{"version":"new"}\n', {
        boundaryRoot: boundary,
        worktreeRoot: WORKTREE_ROOT,
        mutationGuard,
      }),
      /synthetic_operation_lock_lost_at_publication/u,
    );
    assert.equal(await readFile(target, 'utf8'), '{"version":"old"}\n');
    assert.ok(guardCallCount >= 5);
  });
});

test('stable aliases use a protected 0600 map and never persist an HMAC key', async () => {
  await temporaryBoundaryDirectory('i1q-1008e-alias-', async (root) => {
    const boundary = await makeBoundary(root);
    await preflightRestrictedBoundary({ boundaryRoot: boundary, worktreeRoot: WORKTREE_ROOT });
    const first = await getOrCreateOpaqueAlias('fixture-raw-id-a', { boundaryRoot: boundary, namespace: 'source' });
    const again = await getOrCreateOpaqueAlias('fixture-raw-id-a', { boundaryRoot: boundary, namespace: 'source' });
    const second = await getOrCreateOpaqueAlias('fixture-raw-id-b', { boundaryRoot: boundary, namespace: 'source' });
    assert.equal(first, again);
    assert.notEqual(first, second);
    assert.equal(first.includes('fixture-raw-id-a'), false);

    const bulk = await getOrCreateOpaqueAliases(['fixture-raw-id-b', 'fixture-raw-id-c'], {
      boundaryRoot: boundary,
      namespace: 'artifact',
    });
    assert.equal(Array.isArray(bulk) ? bulk.length : Object.keys(bulk).length, 2);
    await assertAliasMapIntegrity({ boundaryRoot: boundary });

    const mapPath = join(boundary, 'state', 'opaque-alias-map.json');
    const mapStat = await lstat(mapPath);
    assert.equal(mapStat.mode & 0o777, 0o600);
    const keyEntries = await readdir(join(boundary, 'keys'));
    assert.deepEqual(keyEntries, []);
    const persisted = await readFile(mapPath, 'utf8');
    assert.equal(/hmac[_-]?key|secret[_-]?key|alias[_-]?key/iu.test(persisted), false);
    await postflightRestrictedBoundary({ boundaryRoot: boundary, worktreeRoot: WORKTREE_ROOT });
  });
});

test('advisory alias lock is crash-recoverable and keeps one stable protected inode', async () => {
  await temporaryBoundaryDirectory('i1q-1008e-lock-', async (root) => {
    const boundary = await makeBoundary(root);
    const lockPath = join(boundary, 'state', '.opaque-alias-map.lock');
    await recoverStaleAliasLock(lockPath);
    const first = await lstat(lockPath);
    assert.equal(first.mode & 0o777, 0o600);
    await recoverStaleAliasLock(lockPath);
    const second = await lstat(lockPath);
    assert.equal(second.ino, first.ino);
    assert.equal(second.dev, first.dev);
    assert.deepEqual((await readdir(join(boundary, 'state'))).filter(
      (entry) => entry.includes('.reclaim-'),
    ), []);
  });
});

test('three-party stale-lock interleaving cannot admit a contender or orphan a live lock', async () => {
  await temporaryBoundaryDirectory('i1q-1008e-lock-race-', async (root) => {
    const boundary = await makeBoundary(root);
    const lockPath = join(boundary, 'state', '.opaque-alias-map.lock');
    await writeFile(lockPath, 'legacy-stale-metadata\n', { mode: 0o600 });
    let releaseOwner;
    let ownerEntered;
    const ownerGate = new Promise((resolveOwner) => { releaseOwner = resolveOwner; });
    const entered = new Promise((resolveEntered) => { ownerEntered = resolveEntered; });
    const owner = recoverStaleAliasLock(lockPath, {
      whileLockHeld: async () => {
        ownerEntered();
        await ownerGate;
      },
    });
    await entered;
    const before = await lstat(lockPath);
    await assert.rejects(
      () => recoverStaleAliasLock(lockPath),
      /alias_lock_busy/u,
    );
    const during = await lstat(lockPath);
    assert.equal(during.ino, before.ino);
    assert.equal(during.dev, before.dev);
    assert.equal(await readFile(lockPath, 'utf8'), 'legacy-stale-metadata\n');
    assert.deepEqual((await readdir(join(boundary, 'state'))).filter(
      (entry) => entry.includes('.reclaim-'),
    ), []);
    releaseOwner();
    await owner;
    await recoverStaleAliasLock(lockPath);
    const after = await lstat(lockPath);
    assert.equal(after.ino, before.ino);
  });
});

test('safe projection is allowlisted and excludes restricted text, locators, secrets, and unknown keys', () => {
  const forbiddenRawKey = ['restricted', 'verbatim', 'content'].join('_');
  const forbiddenLocationKey = ['source', 'location'].join('_');
  const forbiddenSecretKey = ['credential', 'value'].join('_');
  const restricted = makeSafeProjectionInput({
    [forbiddenRawKey]: RESTRICTED_CANARY,
    [forbiddenLocationKey]: SOURCE_LOCATION_CANARY,
    [forbiddenSecretKey]: SECRET_CANARY,
    unexpected_private_field: RESTRICTED_CANARY,
  });
  const projected = safeExport.projectSafeArtifacts(restricted);
  const serialized = stableStringify(projected);
  for (const canary of [RESTRICTED_CANARY, SOURCE_LOCATION_CANARY, SECRET_CANARY]) {
    assert.equal(serialized.includes(canary), false);
  }
  assert.equal(serialized.includes('unexpected_private_field'), false);

  const allowlistExports = Object.entries(safeExport)
    .filter(([name, value]) => name.startsWith('SAFE_') && Array.isArray(value));
  assert.ok(allowlistExports.length > 0);
  assert.ok(allowlistExports.every(([, value]) => Object.isFrozen(value)));
});

test('safe-tree scanner passes the allowlisted fixture and detects synthetic leakage canaries', async () => {
  await temporaryDirectory('i1q-1008e-safe-scan-', async (root) => {
    const safeRoot = join(root, 'safe');
    await mkdir(safeRoot, { mode: 0o700 });
    await writeFile(join(safeRoot, 'summary.json'), `${JSON.stringify(SAFE_EXPORT_FIXTURE, null, 2)}\n`, { mode: 0o600 });
    assert.equal(scanPassed(await safeExport.scanSafeTree(safeRoot)), true);

    const unsafeRoot = join(root, 'unsafe');
    await mkdir(unsafeRoot, { mode: 0o700 });
    await writeFile(join(unsafeRoot, 'summary.json'), JSON.stringify({ note: RESTRICTED_CANARY }), { mode: 0o600 });
    assert.equal(scanPassed(await safeExport.scanSafeTree(unsafeRoot, {
      forbiddenValues: [RESTRICTED_CANARY, SOURCE_LOCATION_CANARY, SECRET_CANARY],
    })), false);
  });
});

test('restricted correlation catches distinctive short excerpts without generic phrase explosion', () => {
  const oneToken = restrictedShortFingerprints('ultradistinctivefixturemarker');
  const twoTokens = restrictedShortFingerprints('ultradistinctivefixturemarker secondaryuniquemarker');
  const shortExcerpt = restrictedShortFingerprints(
    'uncommonfixturetoken preserves distinctive contextual wording across seven tokens',
  );
  assert.ok(oneToken.length > 0);
  assert.ok(twoTokens.length > 0);
  assert.ok(shortExcerpt.length > 0);
  const normalizedVariant = restrictedShortFingerprints(
    'UNCOMMONFIXTURETOKEN preserves distinctive contextual wording across seven tokens',
  );
  assert.ok(shortExcerpt.some((value) => normalizedVariant.includes(value)));
  assert.deepEqual(restrictedShortFingerprints('what is the diagnosis'), []);
  assert.deepEqual(restrictedShortFingerprints('the patient has a question'), []);
  assert.equal(oneToken.some((value) => value.includes('ultradistinctivefixturemarker')), false);
});

test('restricted correlation forbids every nongeneric speaker label with four normalized characters', () => {
  for (const key of ['speaker', 'speaker_label', 'speakerLabel', 'presenter', 'instructor', 'teacher', 'role']) {
    assert.equal(isRestrictedSpeakerFieldKey(key), true);
  }
  assert.equal(isRestrictedSpeakerFieldKey('text'), false);
  for (const label of ['A B C D', 'Qzv Xrp', 'Zed Q', 'Avery Stone']) {
    const fingerprint = restrictedSpeakerFingerprint(label);
    assert.match(fingerprint, /^[a-f0-9]{64}$/u);
    assert.equal(fingerprint.includes(label), false);
  }
  assert.equal(restrictedSpeakerFingerprint('QZV-XRP'), restrictedSpeakerFingerprint('Qzv Xrp'));
  for (const label of ['Dr J', 'speaker', 'Speaker 7', 'unknown', 'host']) {
    assert.equal(restrictedSpeakerFingerprint(label), null);
  }
  assert.equal(restrictedSpeakerFingerprint('ABC'), null);
});

test('canonicalization rejects special objects and safely preserves __proto__ as data', () => {
  assert.throws(() => stableStringify(new Map([['fixture', 1]])), /canonical_non_plain_object/u);
  assert.throws(() => stableStringify(new Date(0)), /canonical_non_plain_object/u);
  const payload = JSON.parse('{"__proto__":{"polluted":true},"value":1}');
  const serialized = stableStringify(payload);
  const reparsed = JSON.parse(serialized);
  assert.equal(Object.hasOwn(reparsed, '__proto__'), true);
  assert.equal(reparsed.__proto__.polluted, true);
  assert.equal(Object.prototype.polluted, undefined);
});

test('local schema validator honors boolean schemas, refs with siblings, root refs, and object bounds', () => {
  assert.equal(validateSchemaInstance(true, { fixture: 1 }).valid, true);
  assert.equal(validateSchemaInstance(false, { fixture: 1 }).valid, false);
  const siblingRef = {
    $defs: { text: { type: 'string' } },
    $ref: '#/$defs/text',
    minLength: 3,
  };
  assert.equal(validateSchemaInstance(siblingRef, 'x').valid, false);
  assert.equal(validateSchemaInstance(siblingRef, 'fixture').valid, true);
  const rootRef = { $ref: '#', type: 'string', minLength: 2 };
  assert.equal(validateSchemaInstance(rootRef, 'ok').valid, true);
  assert.equal(validateSchemaInstance(rootRef, 'x').valid, false);
  assert.equal(validateSchemaInstance({ type: 'object', minProperties: 2 }, { one: 1 }).valid, false);
  assert.equal(validateSchemaInstance({ type: 'object' }, new Map()).valid, false);
  assert.equal(validateSchemaInstance({ enum: [{ fixture: 1 }] }, { fixture: undefined }).valid, false);
  assert.equal(validateSchemaInstance({ type: 'array', uniqueItems: true }, [new Date(0)]).valid, false);
});

test('generated occurrences, concepts, and ledgers satisfy schemas and integrity checks', async () => {
  const [occurrenceSchema, conceptSchema, ledgerSchema] = await Promise.all([
    readSchema('restricted-occurrence.schema.json'),
    readSchema('provisional-concept.schema.json'),
    readSchema('artifact-processing-ledger.schema.json'),
  ]);
  const result = runFixturePasses([
    makeRecord('What is the cardiac diagnosis?', { ordinal: 0 }),
    makeRecord('The diagnosis is a modeled cardiac condition.', { ordinal: 1 }),
  ]);
  assert.ok(result.occurrences.length > 0);
  for (const occurrence of result.occurrences) {
    assert.equal(validateSchemaInstance(occurrenceSchema, occurrence).valid, true);
    assert.doesNotThrow(() => assertOccurrenceIntegrity(occurrence));
  }
  const dedupe = buildProvisionalConcepts(result.occurrences);
  assert.ok(dedupe.concepts.length > 0);
  for (const concept of dedupe.concepts) {
    assert.equal(validateSchemaInstance(conceptSchema, concept).valid, true);
    assert.doesNotThrow(() => assertConceptIntegrity(concept));
  }
  const ledger = buildArtifactLedger({
    extractionRunId: 'run_fixture_0001', artifactEntries: makeArtifactEntries(), observedCohort: true,
  });
  assert.equal(validateSchemaInstance(ledgerSchema, ledger).valid, true);
  assert.equal(verifyContentAddressedEnvelope(ledger), true);

  const unknownField = { ...result.occurrences[0], unknown_contract_field: true };
  assert.equal(validateSchemaInstance(occurrenceSchema, unknownField).valid, false);
  const staleOccurrence = { ...result.occurrences[0], subject: 'TAMPERED_SUBJECT' };
  assert.equal(verifyContentAddressedEnvelope(staleOccurrence), false);
  assert.throws(() => assertOccurrenceIntegrity(staleOccurrence), /schema_instance_rejected/u);
  const staleConcept = { ...dedupe.concepts[0], occurrence_count: 999 };
  assert.throws(() => assertConceptIntegrity(staleConcept), /schema_instance_rejected/u);
  const rehashedCountMismatch = { ...dedupe.concepts[0], occurrence_count: 999 };
  delete rehashedCountMismatch.content_hash;
  assert.throws(
    () => assertConceptIntegrity(contentAddressedEnvelope(rehashedCountMismatch)),
    /schema_instance_rejected/u,
  );
});

test('cross-inventory integrity rejects rehashed membership, provenance, endpoint, and link drift', async () => {
  const [occurrenceSchema, conceptSchema] = await Promise.all([
    readSchema('restricted-occurrence.schema.json'),
    readSchema('provisional-concept.schema.json'),
  ]);
  const extracted = runFixturePasses([
    makeRecord('What cardiac diagnosis explains the modeled systolic murmur?', { ordinal: 0 }),
    makeRecord('What cardiac diagnosis explains the modeled systolic murmur?', { ordinal: 1 }),
  ]);
  const dedupe = buildProvisionalConcepts(extracted.occurrences);
  const multiConcept = dedupe.concepts.find((concept) => concept.occurrence_count > 1);
  assert.ok(multiConcept);
  assert.doesNotThrow(() => assertCrossInventoryIntegrity({
    occurrences: dedupe.occurrences,
    concepts: dedupe.concepts,
  }));

  const withoutOwningConcept = dedupe.concepts.filter(
    (concept) => concept.provisional_concept_id !== multiConcept.provisional_concept_id,
  );
  assert.throws(
    () => assertCrossInventoryIntegrity({
      occurrences: dedupe.occurrences,
      concepts: withoutOwningConcept,
    }),
    /schema_instance_rejected/u,
  );

  const wrongProvenancePayload = {
    ...multiConcept,
    provenance_bindings: multiConcept.provenance_bindings.map((binding, index) => (
      index === 0 ? { ...binding, occurrence_id: 'occurrence_nonexistent_0001' } : binding
    )),
  };
  delete wrongProvenancePayload.content_hash;
  const wrongProvenance = contentAddressedEnvelope(wrongProvenancePayload);
  assert.equal(validateSchemaInstance(conceptSchema, wrongProvenance).valid, true);
  assert.doesNotThrow(() => assertConceptIntegrity(wrongProvenance));
  assert.throws(
    () => assertCrossInventoryIntegrity({
      occurrences: dedupe.occurrences,
      concepts: dedupe.concepts.map((concept) => (
        concept.provisional_concept_id === multiConcept.provisional_concept_id
          ? wrongProvenance : concept
      )),
    }),
    /schema_instance_rejected/u,
  );

  const relationship = multiConcept.duplicate_relationships[0];
  assert.ok(relationship);
  const wrongEndpointPayload = {
    ...multiConcept,
    duplicate_relationships: multiConcept.duplicate_relationships.map((candidate, index) => (
      index === 0
        ? { ...candidate, right_occurrence_id: 'occurrence_nonexistent_0001' }
        : candidate
    )),
  };
  delete wrongEndpointPayload.content_hash;
  const wrongEndpoint = contentAddressedEnvelope(wrongEndpointPayload);
  assert.equal(validateSchemaInstance(conceptSchema, wrongEndpoint).valid, true);
  assert.doesNotThrow(() => assertConceptIntegrity(wrongEndpoint));
  assert.throws(
    () => assertCrossInventoryIntegrity({
      occurrences: dedupe.occurrences,
      concepts: dedupe.concepts.map((concept) => (
        concept.provisional_concept_id === multiConcept.provisional_concept_id
          ? wrongEndpoint : concept
      )),
    }),
    /schema_instance_rejected/u,
  );

  const linkedOccurrence = dedupe.occurrences.find(
    (occurrence) => occurrence.candidate_occurrence_id === relationship.left_occurrence_id,
  );
  const wrongLinkPayload = {
    ...linkedOccurrence,
    linked_occurrence_ids: ['occurrence_nonexistent_0001'],
  };
  delete wrongLinkPayload.content_hash;
  const wrongLink = contentAddressedEnvelope(wrongLinkPayload);
  assert.equal(validateSchemaInstance(occurrenceSchema, wrongLink).valid, true);
  assert.doesNotThrow(() => assertOccurrenceIntegrity(wrongLink));
  assert.throws(
    () => assertCrossInventoryIntegrity({
      occurrences: dedupe.occurrences.map((occurrence) => (
        occurrence.candidate_occurrence_id === wrongLink.candidate_occurrence_id
          ? wrongLink : occurrence
      )),
      concepts: dedupe.concepts,
    }),
    /schema_instance_rejected/u,
  );
});

test('occurrence schema enforces reconstruction, Nodes, and duplicate cross-field constraints', async () => {
  const schema = await readSchema('restricted-occurrence.schema.json');
  const implied = runFixturePasses([
    makeRecord('The cardiac diagnosis is a modeled condition.', { ordinal: 0 }),
  ]).occurrences.find((item) => item.verbatim_or_reconstructed === 'RECONSTRUCTED');
  assert.ok(implied);
  const brokenReconstruction = {
    ...implied,
    reconstruction_type: null,
    reconstruction_changed_fields: [],
    reconstruction_confidence: null,
  };
  assert.equal(validateSchemaInstance(schema, brokenReconstruction).valid, false);

  const node = makeRecord('What is the cardiac management?', {
    ordinal: 0, locatorPrefix: 'node_index',
  });
  const nodeResult = runFixturePasses([makeRecord('Okay.', { ordinal: 0 })], [node]);
  const nodeOccurrence = nodeResult.occurrences.find((item) => item.nodes_assisted_relationships.length > 0);
  assert.ok(nodeOccurrence);
  assert.equal(validateSchemaInstance(schema, { ...nodeOccurrence, nodes_hash_binding: null }).valid, false);

  const base = runFixturePasses([makeRecord(
    'What cardiac diagnosis explains the modeled systolic murmur?', { ordinal: 0 },
  )])
    .occurrences.find((item) => item.extraction_class !== 'NONMEDICAL');
  const secondPayload = { ...base, candidate_occurrence_id: 'occurrence_fixture_duplicate_0002' };
  delete secondPayload.content_hash;
  const clustered = buildProvisionalConcepts([base, contentAddressedEnvelope(secondPayload)]);
  const exact = clustered.occurrences.find((item) => item.duplicate_relationship_type === 'EXACT_TEXT_DUPLICATE');
  assert.ok(exact);
  assert.equal(validateSchemaInstance(schema, { ...exact, linked_occurrence_ids: [] }).valid, false);
  assert.equal(validateSchemaInstance(schema, { ...exact, duplicate_confidence: null }).valid, false);
});

test('privacy normalization redacts every match and reconstruction never restores identifiers', () => {
  const emailA = ['alpha', 'example.com'].join('@');
  const emailB = ['beta', 'example.org'].join('@');
  const phone = ['+1', '212', '555', '0199'].join(' ');
  const source = `The cardiac diagnosis is modeled for patient named Jane Doe, contact ${emailA} or ${emailB}, phone ${phone}, patient ID AB-1234.`;
  const normalized = normalizeOccurrenceText(source);
  assert.equal(normalized.privacy_redaction_applied, true);
  assert.equal(normalized.normalized_wording.includes(emailA), false);
  assert.equal(normalized.normalized_wording.includes(emailB), false);
  assert.equal(normalized.normalized_wording.includes('AB-1234'), false);
  assert.equal(normalized.normalized_wording.includes('Jane Doe'), false);
  assert.equal((normalized.normalized_wording.match(/\[REDACTED_EMAIL\]/gu) ?? []).length, 2);
  const result = runFixturePasses([makeRecord(source, { ordinal: 0 })]);
  const occurrence = result.occurrences.find((item) => item.verbatim_or_reconstructed === 'RECONSTRUCTED');
  assert.ok(occurrence);
  assert.equal(occurrence.lifecycle_status, 'PRIVACY_QUARANTINED');
  for (const forbidden of [emailA, emailB, phone, 'AB-1234', 'Jane Doe']) {
    assert.equal(occurrence.privacy_safe_normalized_wording.includes(forbidden), false);
  }
});

test('privacy quarantine takes lifecycle and schema precedence over nonmedical rejection', async () => {
  const email = ['fixture', 'invalid.zz'].join('@');
  const modeledNameStatement = ['my', 'name', 'is', 'Fixture', 'Person'].join(' ');
  const result = runFixturePasses([
    makeRecord(`Administrative contact: ${email}.`, { ordinal: 0 }),
    makeRecord(`${modeledNameStatement}.`, { ordinal: 1 }),
  ]);
  const privacyRows = result.occurrences.filter((item) => (
    item.privacy_class === 'POTENTIAL_DIRECT_IDENTIFIER'
  ));
  assert.equal(privacyRows.length, 2);
  assert.ok(privacyRows.every((item) => item.extraction_class === 'NONMEDICAL'));
  assert.ok(privacyRows.every((item) => item.lifecycle_status === 'PRIVACY_QUARANTINED'));
  assert.ok(privacyRows.every((item) => item.quarantine_reasons.includes('POTENTIAL_PRIVACY_CONTENT')));
  const schema = await readSchema('restricted-occurrence.schema.json');
  assert.ok(privacyRows.every((item) => validateSchemaInstance(schema, item).valid));
  assert.ok(privacyRows.every((item) => !validateSchemaInstance(schema, {
    ...item, lifecycle_status: 'REJECTED_NONMEDICAL',
  }).valid));
});

test('mixed segments retain both question and teaching clauses without ordinal-level skipping', () => {
  const result = runFixturePasses([
    makeRecord('What is the cardiac diagnosis? Management is a beta blocker.', { ordinal: 0 }),
  ]);
  const classes = new Set(result.occurrences.map((item) => item.extraction_class));
  assert.equal(classes.has('DIAGNOSIS_PROMPT'), true);
  assert.equal(classes.has('MANAGEMENT_PROMPT'), true);
  assert.ok(result.occurrences.length >= 2);
});

test('compound interrogative prompts retain each independently assessable suboccurrence', () => {
  const cases = [
    {
      text: 'What is the cardiac diagnosis and how would you manage it?',
      exactFragments: ['What is the cardiac diagnosis', 'how would you manage it?'],
    },
    {
      text: 'What is the diagnosis and management of cardiac failure?',
      exactFragments: ['What is the diagnosis', 'management of cardiac failure?'],
    },
    {
      text: 'What is the diagnosis; how should cardiac failure be managed?',
      exactFragments: ['What is the diagnosis', 'how should cardiac failure be managed?'],
    },
  ];
  for (const { text, exactFragments } of cases) {
    const result = runFixturePasses([makeRecord(text, { ordinal: 0 })]);
    const classes = new Set(result.occurrences.map((item) => item.extraction_class));
    assert.equal(classes.has('DIAGNOSIS_PROMPT'), true, text);
    assert.equal(classes.has('MANAGEMENT_PROMPT'), true, text);
    assert.deepEqual(
      result.occurrences.map((item) => item.restricted_verbatim_content).sort(),
      [...exactFragments].sort(),
      text,
    );
    assert.equal(new Set(result.occurrences.map((item) => (
      item.segment_locator.locator_hash
    ))).size, 1, text);
    assert.equal(new Set(result.occurrences.map((item) => (
      item.candidate_occurrence_id
    ))).size, result.occurrences.length, text);
  }
});

test('low-lexicon medical teaching is quarantined for review in transcript and Nodes paths', () => {
  const lowLexiconTeaching = 'Auer rods suggest AML.';
  assert.equal(classifyMedicalDomain(lowLexiconTeaching).medical_relevance_score, 0.55);
  const transcriptResult = runFixturePasses([
    makeRecord(lowLexiconTeaching, { ordinal: 0 }),
  ]);
  const transcriptOccurrence = transcriptResult.occurrences.find((item) => (
    item.restricted_verbatim_content === lowLexiconTeaching
  ));
  assert.ok(transcriptOccurrence);
  assert.notEqual(transcriptOccurrence.extraction_class, 'NONMEDICAL');
  assert.equal(transcriptOccurrence.lifecycle_status, 'MEDICAL_QUARANTINED');

  const node = makeRecord(lowLexiconTeaching, {
    ordinal: 0, locatorPrefix: 'node_index', start: 0,
  });
  const aligned = runFixturePasses([makeRecord('Okay.', { ordinal: 0, start: 0 })], [node]);
  const recovered = aligned.occurrences.find((item) => item.nodes_assisted_relationships.length > 0);
  assert.ok(recovered);
  assert.equal(recovered.lifecycle_status, 'MEDICAL_QUARANTINED');
  assert.equal(recovered.extraction_pass_bindings.includes('PASS_6'), true);

  const unaligned = runFixturePasses(
    [makeRecord('Okay.', { ordinal: 0, start: 0 })],
    [makeRecord(lowLexiconTeaching, { ordinal: 0, locatorPrefix: 'node_index', start: 100 })],
  );
  assert.equal(unaligned.nodes_unmatched_medical_count, 1);

  const administrative = runFixturePasses([
    makeRecord('Can everyone hear me?', { ordinal: 0 }),
  ]);
  assert.ok(administrative.occurrences.every((item) => item.extraction_class === 'NONMEDICAL'));
});

test('controlled medical morphology and conservative strong-signal tiers prevent nonmedical rejection', () => {
  const fixtures = [
    'A modeled case has glomerulonephritis.',
    'A modeled placental disorder requires review.',
    'Diagnostic screening is discussed.',
    'Which diagnostic category is modeled?',
  ];
  for (const [ordinal, text] of fixtures.entries()) {
    assert.equal(classifyMedicalDomain(text).medical_relevance_score, 0.55, text);
    const result = runFixturePasses([makeRecord(text, { ordinal })]);
    const occurrence = result.occurrences.find((item) => item.restricted_verbatim_content === text);
    assert.ok(occurrence, text);
    assert.notEqual(occurrence.extraction_class, 'NONMEDICAL', text);
    assert.equal(occurrence.lifecycle_status, 'MEDICAL_QUARANTINED', text);
  }
});

test('controlled medical fallback preserves administrative rhetorical and single-term metaphor negatives', () => {
  const negatives = [
    'Can everyone see the cardiac slide?',
    'Does the ECG slide look blurry?',
    'The treatment of the manuscript was stylistic.',
    'The screening schedule starts after the break.',
  ];
  for (const [ordinal, text] of negatives.entries()) {
    assert.equal(classifyMedicalDomain(text).medical_relevance_score, 0, text);
    const result = runFixturePasses([makeRecord(text, { ordinal })]);
    assert.ok(result.occurrences.every((item) => item.extraction_class === 'NONMEDICAL'), text);
  }
});

test('Nodes-assisted recovery preserves Nodes wording and retains unaligned medical Nodes', () => {
  const aligned = makeRecord('What is the cardiac management?', {
    ordinal: 0, locatorPrefix: 'node_index', start: 0,
  });
  const alignedResult = runFixturePasses([makeRecord('Okay.', { ordinal: 0, start: 0 })], [aligned]);
  const recovered = alignedResult.occurrences.find((item) => item.nodes_assisted_relationships.length > 0);
  assert.ok(recovered);
  assert.match(recovered.restricted_verbatim_content, /cardiac management/iu);
  assert.doesNotMatch(recovered.restricted_verbatim_content, /^Okay\.?$/iu);
  assert.equal(recovered.extraction_pass_bindings.includes('PASS_6'), true);

  const unaligned = makeRecord('What is the pulmonary diagnosis?', {
    ordinal: 1, locatorPrefix: 'node_index', start: 100,
  });
  const unalignedResult = runFixturePasses([makeRecord('Okay.', { ordinal: 0, start: 0 })], [unaligned]);
  assert.equal(unalignedResult.nodes_unmatched_medical_count, 1);
  assert.equal(unalignedResult.unmatched_medical_nodes.length, 1);
  assert.equal(unalignedResult.unmatched_medical_nodes[0].raw_record_hash, unaligned.raw_record_hash);
});

test('pass roots bind Nodes recovery, provisional review, and final merge content', () => {
  const transcript = [makeRecord('Okay.', { ordinal: 0, start: 0 })];
  const first = runFixturePasses(transcript, [makeRecord('What is the cardiac diagnosis?', {
    ordinal: 0, locatorPrefix: 'node_index', start: 0,
  })]);
  const second = runFixturePasses(transcript, [makeRecord('What is the pulmonary diagnosis?', {
    ordinal: 0, locatorPrefix: 'node_index', start: 0,
  })]);
  const roots = (result) => Object.fromEntries(result.pass_receipts.map((item) => [item.pass_id, item.proposal_root]));
  const left = roots(first);
  const right = roots(second);
  for (const passId of ['PASS_6', 'PASS_7', 'PASS_9']) assert.notEqual(left[passId], right[passId]);
});

test('speaker confidence cannot be elevated by generic roles, dominance, or numeric confidence alone', () => {
  for (const label of ['doctor', 'instructor', 'Dr.']) {
    assert.notEqual(speakerClass(classifySpeaker({ speaker_label: label }, {})), 'HIGH_CONFIDENCE_DR_J');
  }
  const dominant = classifySpeaker(
    { speaker_label: 'speaker_primary' },
    { label_counts: new Map([['speaker_primary', 99], ['speaker_other', 1]]), labeled_record_count: 100 },
  );
  assert.equal(speakerClass(dominant), 'MULTI_SPEAKER_UNRESOLVED');
  assert.notEqual(speakerClass(classifySpeaker({ speaker_label: 'fixture' }, { confidence_score: 1 })), 'HIGH_CONFIDENCE_DR_J');
  assert.equal(speakerClass(classifySpeaker(
    { speaker_label: 'doctor' },
    { corroborated_drj_labels: new Set(['doctor']) },
  )), 'HIGH_CONFIDENCE_DR_J');
});

test('dedupe preserves quarantine and rejected rows and accounts for 501 exact candidates without truncation', () => {
  const seed = cloneFixture(DEDUPE_OCCURRENCE_FIXTURES[0]);
  const bulk = Array.from({ length: 501 }, (_, index) => ({
    ...seed,
    candidate_occurrence_id: `occurrence_bulk_${String(index).padStart(4, '0')}`,
  }));
  const result = buildProvisionalConcepts(bulk);
  assert.equal(result.every_candidate_accounted, true);
  assert.equal(result.silent_member_truncation_count, 0);
  assert.equal(result.occurrences.length, 501);
  assert.equal(result.concepts.reduce((sum, concept) => sum + concept.occurrence_count, 0), 501);
  assert.equal(new Set(result.concepts.flatMap((concept) => concept.occurrence_ids)).size, 501);

  const quarantined = ['PRIVACY_QUARANTINED', 'SPEAKER_QUARANTINED', 'MEDICAL_QUARANTINED']
    .map((lifecycle, index) => ({
      ...seed,
      candidate_occurrence_id: `occurrence_quarantine_${index}`,
      lifecycle_status: lifecycle,
    }));
  const rejected = {
    ...seed,
    candidate_occurrence_id: 'occurrence_rejected_nonmedical',
    extraction_class: 'NONMEDICAL',
    lifecycle_status: 'REJECTED_NONMEDICAL',
  };
  const protectedResult = buildProvisionalConcepts([...quarantined, rejected]);
  assert.deepEqual(
    protectedResult.occurrences.slice(0, 3).map((item) => item.lifecycle_status),
    quarantined.map((item) => item.lifecycle_status),
  );
  assert.equal(protectedResult.occurrences.at(-1).lifecycle_status, 'REJECTED_NONMEDICAL');
  assert.equal(protectedResult.concepts.length, 3);
  assert.ok(protectedResult.concepts.every((concept) => concept.occurrence_count === 1));
});

test('retry accounting is cumulative across acquisition resumes and sums extraction retry counts', () => {
  assert.equal(cumulativeArtifactAttemptCount({ attempt_count: 3 }, 2), 5);
  assert.equal(cumulativeArtifactAttemptCount(null, 2), 2);
  const ledger = retryLedger({ retry_events: [{
    phase: 'ARTIFACT_GET', artifact_alias: 'opaque_artifact_fixture_retry_0001',
    invocation_ordinal: 1, attempt_number: 1,
    controlled_error_class: 'timeout', recovery_action: 'BOUNDED_RETRY',
  }, {
    phase: 'ARTIFACT_GET', artifact_alias: 'opaque_artifact_fixture_retry_0001',
    invocation_ordinal: 2, attempt_number: 1,
    controlled_error_class: 'timeout', recovery_action: 'NONE',
  }] }, [
    {
      artifact_alias: 'opaque_artifact_fixture_retry_0001', retry_count: 3,
      final_artifact_status: 'COMPLETE',
      transient_failure_events: [{
        attempt_number: 3,
        controlled_error_class: 'TIMEOUT',
        recovery_action_scheduled: 'BOUNDED_ARTIFACT_RETRY',
        receipt_hash: 'b'.repeat(64),
        receipt_id: 'receipt_fixture_retry_actual_0001',
      }],
    },
    {
      artifact_alias: 'opaque_artifact_fixture_retry_0002', retry_count: 2,
      final_artifact_status: 'FAILED_WITH_PROVEN_BLOCKER', blocker_root_cause: 'TIMEOUT',
      safe_diagnostic_hash: 'a'.repeat(64),
    },
  ]);
  assert.equal(ledger.acquisition_retry_count, 1);
  assert.equal(ledger.extraction_retry_count, 5);
  assert.equal(ledger.failed_artifact_count, 1);
  assert.deepEqual(ledger.events.slice(0, 2).map((event) => event.invocation_ordinal), [1, 2]);
  const successfulRetry = ledger.events.find((event) => (
    event.phase === 'EXTRACTION_RESUME'
    && event.artifact_alias === 'opaque_artifact_fixture_retry_0001'
  ));
  assert.equal(successfulRetry.controlled_error_class, 'TIMEOUT');
  assert.equal(successfulRetry.evidence_receipt_id, 'receipt_fixture_retry_actual_0001');
  assert.notEqual(successfulRetry.controlled_error_class, 'PRIOR_SHARD_NOT_REUSABLE');
});

test('resume receipt validation binds the summary pass list and every artifact receipt field', () => {
  const row = {
    source_alias: 'opaque_source_fixture_resume_0001',
    transcript_artifact_alias: 'opaque_artifact_fixture_resume_t_0001',
    transcript_hash: '1'.repeat(64), transcript_locator: 'fixture-transcript-locator',
    transcript_availability: 'AVAILABLE',
    nodes_artifact_alias: 'opaque_artifact_fixture_resume_n_0001',
    nodes_hash: '2'.repeat(64), nodes_locator: 'fixture-nodes-locator',
    nodes_availability: 'AVAILABLE',
  };
  const contract = {
    extraction_run_id: 'opaque_run_fixture_resume_0001',
    content_hash: '3'.repeat(64), acquisition_state_hash: '4'.repeat(64),
  };
  const passReceipts = PASS_DEFINITIONS.map((definition, index) => ({
    pass_id: definition.pass_id, status: 'COMPLETE', proposal_root: String(index + 1).repeat(64),
  }));
  const passShard = { pass_receipts: passReceipts };
  const occurrenceShard = { occurrences: [] };
  const retrievalId = deterministicId(
    'receipt', row.transcript_artifact_alias, row.transcript_hash, row.nodes_hash, 'retrieval',
  );
  const processingId = deterministicId(
    'receipt', row.transcript_artifact_alias, contract.content_hash,
    row.transcript_hash, row.nodes_hash,
  );
  const retrievalReceipt = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_retrieval_receipt.v1',
    receipt_id: retrievalId, extraction_run_id: contract.extraction_run_id,
    acquisition_state_hash: contract.acquisition_state_hash, source_alias: row.source_alias,
    transcript_artifact_alias: row.transcript_artifact_alias, transcript_hash: row.transcript_hash,
    transcript_locator: row.transcript_locator, nodes_artifact_alias: row.nodes_artifact_alias,
    nodes_hash: row.nodes_hash, nodes_locator: row.nodes_locator,
    transcript_availability: 'AVAILABLE', nodes_availability: 'AVAILABLE',
  });
  const processingReceipt = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_processing_receipt.v1',
    receipt_id: processingId, extraction_run_id: contract.extraction_run_id,
    run_contract_hash: contract.content_hash, source_alias: row.source_alias,
    artifact_alias: row.transcript_artifact_alias, transcript_hash: row.transcript_hash,
    nodes_hash: row.nodes_hash, pass_receipt_root: stableHash(passReceipts),
    occurrence_set_root: stableHash([]), occurrence_count: 0,
    automated_provisional_review_only: true,
    credentialed_medical_approval_performed: false, learner_release_performed: false,
  });
  const pass7Root = passReceipts.find((item) => item.pass_id === 'PASS_7').proposal_root;
  const automatedReviewReceipt = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_automated_provisional_review_receipts.v1',
    extraction_run_id: contract.extraction_run_id, run_contract_hash: contract.content_hash,
    source_alias: row.source_alias, artifact_alias: row.transcript_artifact_alias,
    reviews: [
      contentAddressedEnvelope({
        receipt_id: deterministicId(
          'review', row.transcript_artifact_alias, contract.content_hash,
          'MEDICAL_AUTOMATED_PROVISIONAL',
        ),
        reviewer_role: 'OSLER_AUTOMATED_PROVISIONAL', review_kind: 'MEDICAL',
        authority_scope: 'AUTOMATED_PROVISIONAL_NOT_CREDENTIALED_PHYSICIAN_APPROVAL',
        pass_7_proposal_root: pass7Root, disposition: 'REVIEW_REQUIRED',
      }),
      contentAddressedEnvelope({
        receipt_id: deterministicId(
          'review', row.transcript_artifact_alias, contract.content_hash,
          'ASSESSMENT_AUTOMATED_PROVISIONAL',
        ),
        reviewer_role: 'ASSESSMENT_SCIENCE_AUTOMATED_PROVISIONAL', review_kind: 'ASSESSMENT',
        authority_scope: 'AUTOMATED_PROVISIONAL_NOT_FINAL_ASSESSMENT_APPROVAL',
        pass_7_proposal_root: pass7Root, disposition: 'REVIEW_REQUIRED',
      }),
    ],
    credentialed_physician_review_performed: false, final_governance_approval_performed: false,
  });
  const summary = {
    pass_receipts: passReceipts, retrieval_receipt_id: retrievalId,
    retrieval_receipt_hash: retrievalReceipt.content_hash,
    processing_receipt_id: processingId, processing_receipt_hash: processingReceipt.content_hash,
    automated_review_receipt_hash: automatedReviewReceipt.content_hash,
  };
  const input = {
    summary, row, occurrenceShard, passShard, retrievalReceipt, processingReceipt,
    automatedReviewReceipt, contract,
  };
  assert.equal(artifactReceiptBindingsValid(input), true);
  assert.equal(artifactReceiptBindingsValid({
    ...input,
    summary: { ...summary, pass_receipts: passReceipts.map((item, index) => (
      index === 0 ? { ...item, proposal_root: 'f'.repeat(64) } : item
    )) },
  }), false);
  assert.equal(artifactReceiptBindingsValid({
    ...input, retrievalReceipt: { ...retrievalReceipt, source_alias: 'opaque_source_wrong_0001' },
  }), false);
});

test('network approval validator is byte-pinned and semantically binds the target set', () => {
  const approval = {
    schema_version: 'missionmed.i1q1008e.network_target_approval.v1',
    ticket: 'I1Q-1008E', approved_at: APPROVED_NETWORK_TARGET_SEMANTICS.approved_at,
    decision: 'APPROVED_FOR_RESTRICTED_ACQUISITION_ONLY',
    authority_scope: 'internal restricted extraction; no release, production mutation, approval decision, or final assessment content',
    boundary_decision_sha256: '3a80f9f30d2eb3f51cca470886ed12d8d457b9a83638f1771b1974dd6b1d881f',
    ticket_instruction_sha256: '99a5c0d9f13c77fbcd20fbd57a6e1186fdf467f35e3657269fe99b23efeddb03',
    approved_targets_canonical_sha256: '98049a4872a62a47e5619f7b98b3db27a9bd9aa1b95641a322835e410d84997a',
    predecessor_commit: '9af94d976572b20540d006084ef2c34eb3b3b9a5',
    predecessor_receipt_sha256: '2c662642392f7fb4435c05ffb517f73c38bd8530065a3cb9044d2283189a252e',
    network_controls: {
      methods: ['GET', 'HEAD'], redirect_policy: 'REJECT', compression_policy: 'IDENTITY_ONLY',
      concurrency: 3, delay_ms: 300, timeout_ms: 15000, max_attempts: 3,
      credentials_permitted: false, unapproved_targets_permitted: false,
    },
    expected_denominators: APPROVED_NETWORK_TARGET_SEMANTICS.expected_denominators,
    expected_reference_matrix: APPROVED_NETWORK_TARGET_SEMANTICS.expected_reference_matrix,
    safe_output_rule: APPROVED_NETWORK_TARGET_SEMANTICS.safe_output_rule,
    revocation_conditions: APPROVED_NETWORK_TARGET_SEMANTICS.revocation_conditions,
  };
  const bytes = Buffer.from(`${JSON.stringify(approval)}\n`);
  assert.equal(validateNetworkTargetApprovalBytes(bytes, {
    expectedByteSha256: sha256(bytes),
  }).byte_sha256, sha256(bytes));
  const changed = Buffer.from(`${JSON.stringify({ ...approval, decision: 'CHANGED' })}\n`);
  assert.throws(() => validateNetworkTargetApprovalBytes(changed, {
    expectedByteSha256: sha256(bytes),
  }), /approval_rejected/u);
  const wrongTarget = Buffer.from(`${JSON.stringify({
    ...approval, approved_targets_canonical_sha256: 'f'.repeat(64),
  })}\n`);
  assert.throws(() => validateNetworkTargetApprovalBytes(wrongTarget, {
    expectedByteSha256: sha256(wrongTarget),
  }), /approval_rejected/u);
  for (const semanticDrift of [
    { expected_denominators: {} },
    { expected_reference_matrix: {} },
    { safe_output_rule: 'changed' },
    { revocation_conditions: [] },
    { approved_at: '2026-07-17T13:10:54Z' },
  ]) {
    const changedSemantics = Buffer.from(`${JSON.stringify({ ...approval, ...semanticDrift })}\n`);
    assert.throws(() => validateNetworkTargetApprovalBytes(changedSemantics, {
      expectedByteSha256: sha256(changedSemantics),
    }), /approval_rejected/u);
  }
});

test('fail-fast acquisition scheduler starts no job after approval revocation', async () => {
  const abortState = { revoked: false };
  const started = [];
  await assert.rejects(
    () => mapLimitFailFast(Array.from({ length: 20 }, (_, index) => index), 3, async (item) => {
      started.push(item);
      if (item === 0) {
        abortState.revoked = true;
        const error = new Error('approval_revoked');
        error.code = 'approval_revoked';
        throw error;
      }
      return item;
    }, { abortState }),
    /approval_revoked/u,
  );
  assert.deepEqual(started, [0]);
});

test('artifact HEAD availability transitions enforce the exact approved 404 exception', () => {
  assert.equal(
    expectedArtifactAvailability('DIRECT_REFERENCE_CORROBORATED'),
    'AVAILABLE',
  );
  for (const referenceClass of [
    'DOCUMENTED_DERIVATION_ONLY', 'DIRECT_REFERENCE_REJECTED',
  ]) {
    assert.equal(expectedArtifactAvailability(referenceClass), 'NOT_AVAILABLE');
  }
  assert.equal(
    artifactHeadTransition('DIRECT_REFERENCE_CORROBORATED', 'HEAD_200'),
    'PROCEED_TO_GET',
  );
  assert.equal(
    artifactHeadTransition('DIRECT_REFERENCE_CORROBORATED', 'HEAD_404'),
    'REVOKE_AVAILABILITY_MISMATCH',
  );
  for (const referenceClass of [
    'DOCUMENTED_DERIVATION_ONLY', 'DIRECT_REFERENCE_REJECTED',
  ]) {
    assert.equal(
      artifactHeadTransition(referenceClass, 'HEAD_404'),
      'TERMINAL_EXPECTED_ABSENCE',
    );
    assert.equal(
      artifactHeadTransition(referenceClass, 'HEAD_200'),
      'REVOKE_AVAILABILITY_MISMATCH',
    );
  }
  assert.throws(
    () => expectedArtifactAvailability('DIRECT_REFERENCE_CONFLICT'),
    /corpus_denominator_drift/u,
  );
});

test('either artifact HEAD availability mismatch revokes before any later job starts', async () => {
  for (const scenario of [
    ['DIRECT_REFERENCE_CORROBORATED', 'HEAD_404'],
    ['DOCUMENTED_DERIVATION_ONLY', 'HEAD_200'],
    ['DIRECT_REFERENCE_REJECTED', 'HEAD_200'],
  ]) {
    const abortState = { revoked: false };
    const started = [];
    await assert.rejects(
      () => mapLimitFailFast([0, 1, 2, 3], 3, async (item) => {
        started.push(item);
        if (item === 0 && artifactHeadTransition(...scenario)
            === 'REVOKE_AVAILABILITY_MISMATCH') {
          abortState.revoked = true;
          const error = new Error('approval_revoked');
          error.code = 'approval_revoked';
          throw error;
        }
        return item;
      }, { abortState }),
      /approval_revoked/u,
    );
    assert.deepEqual(started, [0]);
  }
});

test('persisted artifact results bind expected availability to reference integrity class', () => {
  const valid = {
    direct_reference_integrity: 'DIRECT_REFERENCE_CORROBORATED',
    expected_availability: 'AVAILABLE',
  };
  assert.equal(artifactResultExpectationValid(valid), true);
  assert.equal(artifactResultExpectationValid({
    ...valid, expected_availability: 'NOT_AVAILABLE',
  }), false);
  assert.equal(artifactResultExpectationValid({
    ...valid, direct_reference_integrity: 'DOCUMENTED_DERIVATION_ONLY',
  }), false);
  assert.equal(artifactResultExpectationValid({
    ...valid, direct_reference_integrity: 'DIRECT_REFERENCE_CONFLICT',
  }), false);
});

test('exact dedupe preserves token order and retains non-union comparison evidence', () => {
  const seed = {
    ...cloneFixture(DEDUPE_OCCURRENCE_FIXTURES[0]),
    target_answer: null,
    extraction_class: 'MECHANISM_PROMPT',
    question_form: 'MECHANISM',
  };
  const result = buildProvisionalConcepts([
    {
      ...seed,
      candidate_occurrence_id: 'occurrence_order_fixture_0001',
      privacy_safe_normalized_wording: 'Alpha inhibits beta causing gamma delta.',
    },
    {
      ...seed,
      candidate_occurrence_id: 'occurrence_order_fixture_0002',
      privacy_safe_normalized_wording: 'Beta inhibits alpha causing gamma delta.',
    },
  ]);
  assert.equal(result.concepts.length, 2);
  assert.equal(result.duplicate_relationships.some((relationship) => (
    relationship.relationship_type === 'EXACT_TEXT_DUPLICATE'
  )), false);
  assert.equal(result.duplicate_relationships.some((relationship) => (
    relationship.relationship_type === 'SAME_TOPIC_DIFFERENT_CONCEPT'
  )), true);
  assert.ok(result.concepts.every((concept) => concept.occurrence_count === 1));
});

test('journal identical replay is a no-op while conflicting replay and header tampering fail', () => {
  let journal = createRunJournal({
    extractionRunId: 'run_fixture_0001', runContractHash: HASH_A, rosterRoot: 'b'.repeat(64),
  });
  const event = {
    artifact_alias: 'artifact_fixture_0001', phase: 'PASS_1', pass_id: 'PASS_1',
    attempt_number: 1, input_hash: 'c'.repeat(64), rules_hash: HASH_A,
    parser_hash: 'd'.repeat(64), state_transition: 'NOT_STARTED_TO_COMPLETE',
    output_shard_hash: 'e'.repeat(64),
  };
  journal = appendJournalEvent(journal, event);
  assert.equal(appendJournalEvent(journal, event).events.length, 1);
  assert.throws(
    () => appendJournalEvent(journal, { ...event, output_shard_hash: 'f'.repeat(64) }),
    /journal_idempotency_conflict/u,
  );
  const tampered = cloneFixture(journal);
  tampered.roster_root = 'f'.repeat(64);
  assert.ok(validateJournal(tampered).length > 0);
});

test('bounded artifact isolation records one blocker and continues through the remaining 96 artifacts', async () => {
  const visited = [];
  const settled = [];
  const failedAttempts = [];
  const items = Array.from({ length: 97 }, (_, index) => index);
  const results = await executeWithBoundedIsolation(items, {
    maximumAttempts: 2,
    worker: async (item, _index, attempt) => {
      visited.push(`${item}:${attempt}`);
      if (item === 5) throw new Error('synthetic_artifact_failure');
      return { item, status: 'COMPLETE' };
    },
    blocker: async (item, _index, error, attempts) => ({
      item, status: 'FAILED_WITH_PROVEN_BLOCKER', safe_code: error.message, attempts,
    }),
    isolatable: () => true,
    onAttemptFailure: async (_error, item, _index, attempt, maximumAttempts) => {
      failedAttempts.push({ item, attempt, maximumAttempts });
    },
    onSettled: async (result) => { settled.push(result.item); },
  });
  assert.equal(results.length, 97);
  assert.equal(results.filter((item) => item.status === 'FAILED_WITH_PROVEN_BLOCKER').length, 1);
  assert.equal(results[5].attempts, 2);
  assert.equal(visited.includes('96:1'), true);
  assert.deepEqual(failedAttempts, [
    { item: 5, attempt: 1, maximumAttempts: 2 },
    { item: 5, attempt: 2, maximumAttempts: 2 },
  ]);
  assert.deepEqual(settled, items);
});

test('failure evidence hashes the actual controlled event and claims only completed recovery', () => {
  const row = {
    source_alias: 'opaque_source_fixture_failure_0001',
    transcript_artifact_alias: 'opaque_artifact_fixture_failure_0001',
    transcript_hash: 'a'.repeat(64), nodes_hash: null,
  };
  const contract = {
    extraction_run_id: 'opaque_run_fixture_failure_0001', content_hash: 'b'.repeat(64),
  };
  const first = artifactFailureEvidence(row, contract, new Error('raw detail must not persist'), 1, true);
  const second = artifactFailureEvidence(row, contract, new Error('different raw detail'), 2, false);
  assert.equal(first.raw_error_message_persisted, false);
  assert.equal(JSON.stringify(first).includes('raw detail'), false);
  assert.deepEqual(first.recovery_methods_completed_before_attempt, []);
  assert.deepEqual(second.recovery_methods_completed_before_attempt, ['BOUNDED_ARTIFACT_RETRY']);
  assert.notEqual(first.content_hash, second.content_hash);
  assert.equal(verifyContentAddressedEnvelope(first), true);
});

test('blocked ledger cells bind the dereferenceable protected failure receipt id', () => {
  const artifactAlias = 'opaque_artifact_fixture_blocked_0001';
  const receiptId = deterministicId('receipt', artifactAlias, 'actual-failure-attempt-2');
  const passReceipts = PASS_DEFINITIONS.map((definition) => ({
    pass_id: definition.pass_id, status: 'FAILED_WITH_PROVEN_BLOCKER', attempt_count: 2,
    records_inspected: 0, proposals_emitted: 0,
    proposal_root: stableHash([artifactAlias, definition.pass_id]),
    blocker_root_cause: 'ARTIFACT_PROCESSING_FAILED',
    recovery_methods: ['BOUNDED_ARTIFACT_RETRY'],
    evidence_receipt_id: receiptId,
    resumable_next_step: `Resume ${definition.pass_id}.`,
  }));
  const ledger = buildArtifactLedger({
    extractionRunId: 'opaque_run_fixture_blocked_0001', observedCohort: false,
    artifactEntries: [{
      source_alias: 'opaque_source_fixture_blocked_0001', artifact_alias: artifactAlias,
      parser_selected: 'transcript_json', segment_count: 0, nodes_record_count: 0,
      pass_receipts: passReceipts, final_artifact_status: 'FAILED_WITH_PROVEN_BLOCKER',
      blocker_root_cause: 'ARTIFACT_PROCESSING_FAILED',
      recovery_methods: ['BOUNDED_ARTIFACT_RETRY'], evidence_receipt_id: receiptId,
      resumable_next_step: 'Resume from the protected acquisition checkpoint.',
    }],
  });
  assert.deepEqual(ledger.artifacts[0].blocker.evidence_receipt_bindings, [receiptId]);
  assert.ok(ledger.artifacts[0].extraction_passes.every((receipt) => (
    receipt.blocker.evidence_receipt_bindings[0] === receiptId
  )));
});

test('acquisition failure disposition distinguishes 404 absence and counts exhausted retries exactly', () => {
  assert.deepEqual(artifactFailureDisposition({
    stage: 'HEAD', controlledErrorClass: 'not_found', failedAttemptCount: 1,
  }), {
    availability: 'NOT_AVAILABLE', rejection_stage: 'HEAD',
    controlled_error_class: 'not_found', attempt_count: 1,
  });
  assert.deepEqual(artifactFailureDisposition({
    stage: 'HEAD', controlledErrorClass: 'timeout', failedAttemptCount: 3,
  }), {
    availability: 'FAILED_WITH_PROVEN_BLOCKER', rejection_stage: 'HEAD',
    controlled_error_class: 'timeout', attempt_count: 3,
  });
  assert.deepEqual(artifactFailureDisposition({
    stage: 'GET', controlledErrorClass: 'transport_failure',
    completedAttemptCount: 2, failedAttemptCount: 3,
  }), {
    availability: 'FAILED_WITH_PROVEN_BLOCKER', rejection_stage: 'GET',
    controlled_error_class: 'transport_failure', attempt_count: 5,
  });
});

test('acquisition cohort validation requires exact roster and consumer-projection membership', () => {
  const rawIds = Array.from({ length: 105 }, (_, index) => `raw_fixture_${index}`);
  const state = {
    raw_candidate_ids: rawIds,
    consumer_projection_raw_ids: rawIds.slice(0, 97),
    roster: rawIds.map((rawId, index) => ({
      raw_id: rawId,
      transcript_availability: index < 97 ? 'AVAILABLE' : 'NOT_AVAILABLE',
    })),
  };
  assert.equal(assertAcquisitionCohortMembership(state), true);
  const wrongRoster = cloneFixture(state);
  wrongRoster.roster.at(-1).raw_id = 'raw_fixture_not_in_candidate_set';
  assert.throws(() => assertAcquisitionCohortMembership(wrongRoster), /acquisition_state_rejected/u);
  const wrongProjection = cloneFixture(state);
  wrongProjection.consumer_projection_raw_ids = [
    ...rawIds.slice(0, 96), rawIds.at(-1),
  ];
  assert.throws(
    () => assertAcquisitionCohortMembership(wrongProjection),
    /acquisition_state_rejected/u,
  );
});

test('specialist receipt enforces four distinct roles, exact roots, and final dispositions', async () => {
  const packet = makeSpecialistPacket();
  const authorityBinding = makeSpecialistAuthorityBinding();
  const receipt = buildSpecialistReviewReceipt(
    packet, makeSpecialistSubmissions(), authorityBinding,
  );
  const schema = await readSchema('specialist-review-receipt.schema.json');
  assert.equal(validateSchemaInstance(schema, receipt).valid, true);
  assert.equal(validateSpecialistReviewReceipt(receipt, packet, {
    requireFinal: true, expectedAuthorityBinding: authorityBinding,
  }).valid, true);
  assert.equal(receipt.specialist_verification_cell_count, 2);
  assert.equal(receipt.specialist_role_review_count, 4);

  const sameReviewer = makeSpecialistSubmissions();
  sameReviewer[1].reviewer_instance_id = sameReviewer[0].reviewer_instance_id;
  assert.throws(
    () => buildSpecialistReviewReceipt(packet, sameReviewer, authorityBinding),
    /specialist_reviewer_identity_not_distinct/u,
  );

  const wrongPacket = makeSpecialistPacket({
    passReceipts: ['PASS_7', 'PASS_8', 'PASS_9'].map((passId) => ({
      pass_id: passId,
      proposal_root: passId === 'PASS_7'
        ? stableHash('different-pass7-root') : stableHash(['proposal', passId]),
    })),
  });
  assert.equal(
    validateSpecialistReviewReceipt(receipt, wrongPacket, {
      requireFinal: true, expectedAuthorityBinding: authorityBinding,
    }).valid,
    false,
  );

  const forgedRole = { ...receipt.role_reviews[0], authority_scope: 'FORGED_AUTHORITY' };
  const forgedPayload = {
    ...receipt,
    role_reviews: [forgedRole, ...receipt.role_reviews.slice(1)],
  };
  delete forgedPayload.content_hash;
  const forged = contentAddressedEnvelope(forgedPayload);
  assert.equal(validateSpecialistReviewReceipt(forged, packet, {
    requireFinal: true, expectedAuthorityBinding: authorityBinding,
  }).valid, false);

  const pending = buildSpecialistReviewReceipt(packet, makeSpecialistSubmissions({
    OSLER: { disposition: 'PENDING' },
  }), authorityBinding);
  assert.equal(validateSchemaInstance(schema, pending).valid, true);
  assert.equal(validateSpecialistReviewReceipt(pending, packet, {
    requireFinal: false, expectedAuthorityBinding: authorityBinding,
  }).valid, true);
  assert.equal(validateSpecialistReviewReceipt(pending, packet, {
    requireFinal: true, expectedAuthorityBinding: authorityBinding,
  }).valid, false);
});

test('blocker specialist findings force failed disposition and cannot reach final coverage', async () => {
  const packet = makeSpecialistPacket();
  const authorityBinding = makeSpecialistAuthorityBinding();
  const schema = await readSchema('specialist-review-receipt.schema.json');
  const blocker = buildSpecialistReviewReceipt(packet, makeSpecialistSubmissions({
    OSLER: {
      findings: [{
        finding_code: 'PROVEN_MEDICAL_BLOCKER',
        severity: 'BLOCKER',
        evidence_root: stableHash('synthetic-proven-medical-blocker'),
        disposition: 'BLOCKER',
      }],
      disposition: 'VERIFIED_WITH_FINDINGS',
    },
  }), authorityBinding);
  assert.equal(blocker.role_reviews[0].disposition, 'FAILED_WITH_PROVEN_BLOCKER');
  assert.equal(blocker.pass_7_verification_cell.disposition, 'FAILED_WITH_PROVEN_BLOCKER');
  assert.equal(blocker.pass_9_finalization_binding.disposition, 'FAILED_WITH_PROVEN_BLOCKER');
  assert.equal(blocker.disposition, 'FAILED_WITH_PROVEN_BLOCKER');
  assert.equal(validateSchemaInstance(schema, blocker).valid, true);
  assert.equal(validateSpecialistReviewReceipt(
    blocker, packet, { requireFinal: false, expectedAuthorityBinding: authorityBinding },
  ).valid, true);
  assert.equal(validateSpecialistReviewReceipt(
    blocker, packet, { requireFinal: true, expectedAuthorityBinding: authorityBinding },
  ).valid, false);

  const entries = makeFinalizedArtifactEntries();
  entries[0] = {
    ...entries[0],
    independent_verification_status: 'PENDING',
    specialist_role_review_count: 0,
    specialist_review_receipt_root: null,
    pass_9_finalization_root: null,
    pass_receipts: entries[0].pass_receipts.map((receipt) => ({
      ...receipt,
      independent_verification_status: ['PASS_7', 'PASS_8'].includes(receipt.pass_id)
        ? 'PENDING_SPECIALIST_REVIEW' : receipt.pass_id === 'PASS_9'
          ? 'PENDING_INDEPENDENT_AUDIT' : receipt.independent_verification_status,
      specialist_verification_cell_root: null,
      specialist_verification_receipt_root: null,
      finalization_input_root: null,
    })),
  };
  const ledger = buildArtifactLedger({
    extractionRunId: 'run_fixture_0001', artifactEntries: entries, observedCohort: true,
  });
  const coverage = validateCoverage(ledger, {
    requireObservedCohort: true, requireFinalization: true,
  });
  assert.equal(ledger.extraction_complete, false);
  assert.equal(ledger.finalization_summary.completed_specialist_verification_cell_count, 192);
  assert.equal(ledger.finalization_summary.completed_specialist_role_review_count, 384);
  assert.equal(coverage.result, 'fail');
});

test('specialist findings rebind PASS7 into PASS8 and change the PASS9 finalization root', () => {
  const packet = makeSpecialistPacket();
  const authorityBinding = makeSpecialistAuthorityBinding();
  const controlReceipt = buildSpecialistReviewReceipt(
    packet, makeSpecialistSubmissions(), authorityBinding,
  );
  const changed = buildSpecialistReviewReceipt(packet, makeSpecialistSubmissions({
    OSLER: {
      findings: [{
        finding_code: 'SYNTHETIC_MEDICAL_REVIEW_FINDING',
        severity: 'LOW',
        evidence_root: stableHash('synthetic-specialist-evidence'),
        disposition: 'ACCEPTED',
        note: 'Synthetic finding used only to prove root propagation.',
      }],
      disposition: 'VERIFIED_WITH_FINDINGS',
    },
  }), authorityBinding);
  assert.notEqual(
    controlReceipt.pass_7_verification_cell.findings_root,
    changed.pass_7_verification_cell.findings_root,
  );
  assert.notEqual(
    controlReceipt.pass_8_verification_cell.specialist_input_root,
    changed.pass_8_verification_cell.specialist_input_root,
  );
  assert.notEqual(
    controlReceipt.pass_9_finalization_binding.finalization_input_root,
    changed.pass_9_finalization_binding.finalization_input_root,
  );
  assert.notEqual(controlReceipt.content_hash, changed.content_hash);
});

test('ledger separates 873 automated cells from 194 specialist cells and rejects false finalization', async () => {
  const schema = await readSchema('artifact-processing-ledger.schema.json');
  const pending = buildArtifactLedger({
    extractionRunId: 'run_fixture_0001', artifactEntries: makeArtifactEntries(), observedCohort: true,
  });
  assert.equal(pending.processing_summary.pass_cells_complete_count, 873);
  assert.equal(pending.finalization_summary.completed_specialist_verification_cell_count, 0);
  assert.equal(pending.extraction_complete, false);
  assert.equal(validateCoverage(pending, {
    requireObservedCohort: true, requireFinalization: true,
  }).result, 'fail');
  const falseFinalPayload = { ...pending, extraction_complete: true };
  delete falseFinalPayload.content_hash;
  const falseFinal = contentAddressedEnvelope(falseFinalPayload);
  assert.equal(validateSchemaInstance(schema, falseFinal).valid, false);
  assert.equal(validateCoverage(falseFinal, { requireObservedCohort: true }).result, 'fail');

  const finalized = buildArtifactLedger({
    extractionRunId: 'run_fixture_0001',
    artifactEntries: makeFinalizedArtifactEntries(),
    observedCohort: true,
  });
  assert.equal(finalized.processing_summary.pass_cells_complete_count, 873);
  assert.equal(finalized.finalization_summary.completed_specialist_verification_cell_count, 194);
  assert.equal(finalized.finalization_summary.completed_specialist_role_review_count, 388);
  assert.equal(finalized.extraction_complete, true);
  assert.equal(validateSchemaInstance(schema, finalized).valid, true);
  assert.equal(validateCoverage(finalized, {
    requireObservedCohort: true, requireFinalization: true,
  }).result, 'pass');
});

test('global provisional relationship inventory preserves cross-concept comparison evidence', () => {
  const result = buildProvisionalConcepts(cloneFixture(DEDUPE_OCCURRENCE_FIXTURES));
  assert.ok(result.duplicate_relationships.length > 0);
  assert.equal(assertDuplicateRelationshipInventoryIntegrity({
    relationships: result.duplicate_relationships,
    occurrences: result.occurrences,
    concepts: result.concepts,
  }), true);
  const tampered = cloneFixture(result.duplicate_relationships);
  tampered[0].left_occurrence_id = 'occurrence_nonexistent_fixture';
  assert.throws(() => assertDuplicateRelationshipInventoryIntegrity({
    relationships: tampered,
    occurrences: result.occurrences,
    concepts: result.concepts,
  }), /schema_instance_rejected/u);

  const owningIndex = result.concepts.findIndex(
    (concept) => concept.duplicate_relationships.length > 0,
  );
  const owningConcept = result.concepts[owningIndex];
  const relationship = owningConcept.duplicate_relationships[0];
  const withLocalDrift = (changes) => {
    const payload = {
      ...owningConcept,
      duplicate_relationships: owningConcept.duplicate_relationships.map((item, index) => (
        index === 0 ? { ...item, ...changes } : item
      )),
    };
    delete payload.content_hash;
    const concepts = [...result.concepts];
    concepts[owningIndex] = contentAddressedEnvelope(payload);
    return concepts;
  };
  for (const changes of [
    { confidence: relationship.confidence === 0.123 ? 0.124 : 0.123 },
    { basis_receipt_bindings: ['receipt_forged_binding_0001'] },
    { adjudication_status: 'FORGED_ADJUDICATION' },
  ]) {
    assert.throws(() => assertDuplicateRelationshipInventoryIntegrity({
      relationships: result.duplicate_relationships,
      occurrences: result.occurrences,
      concepts: withLocalDrift(changes),
    }), /schema_instance_rejected/u);
  }

  const forgedBasis = ['receipt_forged_binding_0001'];
  const forgedGlobal = result.duplicate_relationships.map((item) => (
    item.relationship_id === relationship.relationship_id
      ? { ...item, basis_receipt_bindings: forgedBasis } : item
  ));
  const endpoints = new Set([
    relationship.left_occurrence_id, relationship.right_occurrence_id,
  ]);
  const boundOccurrences = result.occurrences.map((occurrence) => {
    if (!endpoints.has(occurrence.candidate_occurrence_id)) return occurrence;
    const payload = {
      ...occurrence,
      processing_receipt_binding: relationship.basis_receipt_bindings[0],
    };
    delete payload.content_hash;
    return contentAddressedEnvelope(payload);
  });
  assert.throws(() => assertDuplicateRelationshipInventoryIntegrity({
    relationships: forgedGlobal,
    occurrences: boundOccurrences,
    concepts: withLocalDrift({ basis_receipt_bindings: forgedBasis }),
  }), /schema_instance_rejected/u);
});

test('the actual Git-safe handoff tree passes scanner coverage including implementation sources', async () => {
  const scan = await safeExport.scanSafeTree(HANDOFF_ROOT, { scanCode: true });
  assert.equal(scan.result, 'pass');
  assert.equal(scan.finding_count, 0);
  assert.ok(scan.files_scanned >= 16);
});
