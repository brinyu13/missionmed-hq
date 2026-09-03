import assert from 'node:assert/strict';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import {
  contentAddressedEnvelope,
  sha256,
  stableHash,
  verifyContentAddressedEnvelope,
} from '../tools/canonical.mjs';
import {
  acquireExtractionOperationLock,
  assertExtractionOperationLockHeld,
  releaseExtractionOperationLock,
  withExtractionOperationLock,
} from '../tools/extraction-operation-lock.mjs';
import {
  appendJournalEvent,
  buildArtifactLedger,
  createRunJournal,
  validateJournal,
} from '../tools/ledger.mjs';
import { PASS_DEFINITIONS } from '../tools/constants.mjs';
import {
  buildSpecialistReviewPacket,
  SPECIALIST_ROLE_CONTRACT,
} from '../tools/specialist-review.mjs';
import {
  buildContractInvalidPartialRecoveryReceipt,
  buildPreparedSupersessionReceipt,
  CORRECTION_DECISION_SCHEMA,
  CORRECTION_TEST_RECEIPT_SCHEMA,
  dryRun,
  dryRunPartialRecovery,
  EXPECTED_CORRECTION_COMPARATOR,
  EXPECTED_CORRECTION_ID,
  NON_DESTRUCTIVE_ARCHIVE_SCOPE,
  prepareContractInvalidPartialRecoveryFixture,
  recoverContractInvalidPartialExtractionFixture,
  REQUIRED_CORRECTION_CODE_PATHS,
  ROLE_BATCH_SCHEMA,
  rotateSupersededExtractionFixture,
  validateCorrectionDecision,
  validateCorrectionTestReceipt,
  validateContractInvalidPartialRecoveryCompletion,
  validateContractInvalidPartialRecoveryReceipt,
  validateContractInvalidPartialRecoveryStatus,
  validatePreparedSupersessionReceipt,
  validateRoleBatches,
} from '../tools/rotate-superseded-extraction.mjs';

test('contract-invalid partial recovery receipt is deterministic, bounded, and non-destructive', async () => {
  const moveRoots = Object.fromEntries([
    'working_tree', 'reviews_tree', 'extraction_state', 'extraction_journal',
    'extraction_receipt', 'processing_receipts', 'retrieval_receipts', 'artifact_failures',
  ].map((key, index) => [key, String((index % 9) + 1).repeat(64)]));
  const preservationRoots = Object.fromEntries([
    'raw_tree', 'acquisition_state', 'acquisition_receipt', 'alias_map',
    'boundary_decision', 'network_target_approval', 'target_configuration',
    'supersession_status', 'supersession_receipts', 'supersession_completions',
    'prior_superseded_archive',
  ].map((key, index) => [key, String(((index + 2) % 9) + 1).repeat(64)]));
  const input = { journalRoot: 'a'.repeat(64), moveRoots, preservationRoots };
  const first = buildContractInvalidPartialRecoveryReceipt(input);
  const second = buildContractInvalidPartialRecoveryReceipt(structuredClone(input));
  assert.deepEqual(first, second);
  assert.equal(verifyContentAddressedEnvelope(first), true);
  assert.equal(first.fixed_move_contract.length, 8);
  assert.equal(first.non_destructive_archive, true);
  assert.equal(first.production_mutation_authorized, false);
  assert.equal(first.release_or_final_approval_authority, false);
  assert.notEqual(buildContractInvalidPartialRecoveryReceipt({
    ...input, journalRoot: 'b'.repeat(64),
  }).recovery_root, first.recovery_root);
  const dry = await dryRunPartialRecovery();
  assert.equal(dry.result, 'pass');
  assert.equal(dry.protected_reads, 0);
  assert.equal(dry.protected_writes, 0);
});

const MODULE_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const TOP_LEVEL = ['raw', 'working', 'audit', 'quarantine', 'tmp', 'keys', 'state', 'reviews'];
const ROLES = ['OSLER', 'ASSESSMENT_SCIENCE', 'TURING'];
const hash = (value) => sha256(String(value));

async function secureMkdir(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  let current = resolve(path);
  while (current.length > 1) {
    await chmod(current, 0o700).catch(() => {});
    current = dirname(current);
    if (current === dirname(current)) break;
  }
}

async function writeSecure(path, data) {
  await secureMkdir(dirname(path));
  await writeFile(path, data, { mode: 0o600 });
  await chmod(path, 0o600);
}

async function writeJson(path, value) {
  await writeSecure(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function minimalBoundary() {
  const boundaryRoot = await mkdtemp(join(tmpdir(), 'i1q-rotation-boundary-'));
  await chmod(boundaryRoot, 0o700);
  for (const name of TOP_LEVEL) {
    await mkdir(join(boundaryRoot, name), { mode: 0o700 });
    await chmod(join(boundaryRoot, name), 0o700);
  }
  const worktreeRoot = `${boundaryRoot}-separate-worktree`;
  return { boundaryRoot, worktreeRoot };
}

async function partialRecoveryFixture() {
  const fixture = await minimalBoundary();
  const { boundaryRoot } = fixture;
  for (const [relativePath, value] of Object.entries({
    'raw/fixture.json': { fixture: 'raw-preserved' },
    'state/acquisition-state.json': { fixture: 'acquisition-state-preserved' },
    'state/acquisition-targets.json': { fixture: 'targets-preserved' },
    'state/opaque-alias-map.json': {
      schema_version: 'missionmed.i1q1008e.opaque_alias_map.v1', aliases: [],
    },
    'audit/acquisition-receipt.json': { fixture: 'acquisition-receipt-preserved' },
    'audit/boundary-decision.json': { fixture: 'boundary-decision-preserved' },
    'audit/network-target-approval.json': { fixture: 'network-approval-preserved' },
    'state/supersession-status.json': { fixture: 'supersession-status-preserved' },
    'audit/supersession-receipts/fixture.json': { fixture: 'receipt-preserved' },
    'audit/supersession-completions/fixture.json': { fixture: 'completion-preserved' },
    'quarantine/superseded-extraction-8b5d419ee1c40c8d8c3aca0f2f7346a3a109b30b8476561c714313132cf325d9/fixture.json': { fixture: 'archive-preserved' },
    'working/partial.json': { fixture: 'working-archived' },
    'reviews/partial.json': { fixture: 'reviews-archived' },
    'state/extraction-state.json': { fixture: 'state-archived' },
    'state/extraction-journal.json': { fixture: 'journal-archived' },
    'audit/extraction-receipt.json': { fixture: 'extraction-receipt-archived' },
    'audit/processing-receipts/fixture.json': { fixture: 'processing-archived' },
    'audit/retrieval-receipts/fixture.json': { fixture: 'retrieval-archived' },
    'audit/artifact-failures/fixture.json': { fixture: 'failures-archived' },
  })) await writeJson(join(boundaryRoot, relativePath), value);
  fixture.testOnly = true;
  fixture.preparedReceipt = await prepareContractInvalidPartialRecoveryFixture(fixture);
  return fixture;
}

async function cleanupPartialRecoveryFixture(fixture) {
  await rm(fixture.boundaryRoot, { recursive: true, force: true });
}

function reEnvelope(value, changes) {
  const payload = { ...value, ...changes };
  delete payload.content_hash;
  return contentAddressedEnvelope(payload);
}

test('partial recovery resumes every crash cursor and rejects pointer or archive forgery', async () => {
  const units = [
    'working_tree', 'reviews_tree', 'extraction_state', 'extraction_journal',
    'extraction_receipt', 'processing_receipts', 'retrieval_receipts', 'artifact_failures',
  ];
  const markers = [
    'PARTIAL_RECEIPT_WRITTEN', 'PARTIAL_STATUS_PREPARED',
    ...units.flatMap((unit) => [`PARTIAL_MOVED_${unit}`, `PARTIAL_STATUS_${unit}`]),
    'PARTIAL_FRESH_TREES_CREATED', 'PARTIAL_COMPLETION_WRITTEN',
    'PARTIAL_STATUS_COMPLETE',
  ];
  for (const marker of markers) {
    const fixture = await partialRecoveryFixture();
    const preservedBefore = sha256(await readFile(
      join(fixture.boundaryRoot, 'raw/fixture.json'),
    ));
    fixture.crashInjector = async (observed) => {
      if (observed === marker) throw new Error(`partial_fixture_crash_${marker}`);
    };
    await assert.rejects(
      recoverContractInvalidPartialExtractionFixture(fixture),
      new RegExp(`partial_fixture_crash_${marker}`, 'u'),
    );
    delete fixture.crashInjector;
    const resumed = await recoverContractInvalidPartialExtractionFixture(fixture);
    assert.equal(resumed.result, 'pass');
    assert.equal(resumed.archived_unit_count, 8);
    const repeated = await recoverContractInvalidPartialExtractionFixture(fixture);
    assert.equal(repeated.repeated_completion, true);
    assert.equal(sha256(await readFile(join(fixture.boundaryRoot, 'raw/fixture.json'))), preservedBefore);
    for (const root of ['working', 'reviews']) {
      const entries = await readdir(join(fixture.boundaryRoot, root), { withFileTypes: true });
      assert.ok(entries.length > 0);
      for (const entry of entries) {
        assert.equal(entry.isDirectory(), true);
        assert.deepEqual(await readdir(join(fixture.boundaryRoot, root, entry.name)), []);
      }
    }
    for (const name of ['artifact-failures', 'processing-receipts', 'retrieval-receipts']) {
      assert.deepEqual(await readdir(join(fixture.boundaryRoot, 'audit', name)), []);
    }
    await cleanupPartialRecoveryFixture(fixture);
  }

  const forged = await partialRecoveryFixture();
  const receipt = forged.preparedReceipt;
  assert.throws(() => validateContractInvalidPartialRecoveryReceipt(reEnvelope(receipt, {
    archive_root: 'quarantine/forged-pointer',
  })), /partial_recovery_rejected/u);
  const rogueArchive = join(forged.boundaryRoot, receipt.archive_root);
  await secureMkdir(rogueArchive);
  await writeJson(join(rogueArchive, 'rogue.json'), { forged: true });
  await assert.rejects(
    recoverContractInvalidPartialExtractionFixture(forged),
    /archive_collision/u,
  );
  await cleanupPartialRecoveryFixture(forged);

  const completedFixture = await partialRecoveryFixture();
  await recoverContractInvalidPartialExtractionFixture(completedFixture);
  const completedReceipt = completedFixture.preparedReceipt;
  const status = await readJson(join(
    completedFixture.boundaryRoot, 'state/partial-run-recovery-status.json',
  ));
  const completion = await readJson(join(
    completedFixture.boundaryRoot, completedReceipt.archive_root,
    'partial-recovery-completion.json',
  ));
  assert.equal(validateContractInvalidPartialRecoveryStatus(status, completedReceipt), status);
  assert.equal(
    validateContractInvalidPartialRecoveryCompletion(completion, completedReceipt), completion,
  );
  assert.throws(() => validateContractInvalidPartialRecoveryStatus(reEnvelope(status, {
    completed_units: status.completed_units.slice(1),
  }), completedReceipt), /partial_recovery_rejected/u);
  assert.throws(() => validateContractInvalidPartialRecoveryCompletion(reEnvelope(completion, {
    production_mutation_performed: true,
  }), completedReceipt), /partial_recovery_rejected/u);
  await cleanupPartialRecoveryFixture(completedFixture);
});

function passEntries(index) {
  return PASS_DEFINITIONS.map((definition) => ({
    pass_id: definition.pass_id,
    status: 'COMPLETE',
    attempt_count: 1,
    records_inspected: 1,
    proposals_emitted: 1,
    proposal_root: hash(`proposal-${index}-${definition.pass_id}`),
  }));
}

function fixturePacket(runId, contractHash, index, artifact, roots) {
  return buildSpecialistReviewPacket({
    extractionRunId: runId,
    runContractHash: contractHash,
    sourceAlias: artifact.source_alias,
    artifactAlias: artifact.artifact_alias,
    transcriptHash: artifact.transcript_hash_binding,
    nodesHash: artifact.nodes_hash_binding,
    occurrenceShardHash: roots.occurrenceShardHash,
    passShardHash: roots.passShardHash,
    processingReceiptHash: roots.processingReceiptHash,
    passReceipts: artifact.pass_receipts,
  });
}

function fixtureBatches(packets, runId, contractHash) {
  return Object.fromEntries(ROLES.map((role, roleIndex) => [role, contentAddressedEnvelope({
    schema_version: ROLE_BATCH_SCHEMA,
    extraction_run_id: runId,
    run_contract_hash: contractHash,
    specialist_role: role,
    reviewer_instance_id: `reviewer_fixture_${role.toLowerCase()}_${roleIndex}`,
    authority_scope: SPECIALIST_ROLE_CONTRACT[role].authority_scope,
    artifact_review_count: packets.length,
    artifact_reviews: packets.map((packet) => ({
      artifact_alias: packet.artifact_alias,
      review_packet_root: packet.content_hash,
      evidence_root: hash(`${role}-${packet.content_hash}`),
      findings: [],
      disposition: 'VERIFIED_WITH_FINDINGS',
    })),
  })]));
}

async function currentCodeHashes() {
  const values = [];
  for (const relativePath of REQUIRED_CORRECTION_CODE_PATHS) {
    values.push({
      relative_path: relativePath,
      sha256: sha256(await readFile(join(MODULE_ROOT, relativePath))),
    });
  }
  return values;
}

async function correctionTestReceipt() {
  return contentAddressedEnvelope({
    schema_version: CORRECTION_TEST_RECEIPT_SCHEMA,
    correction_id: EXPECTED_CORRECTION_ID,
    verified_at: '2026-07-17T12:00:00.000Z',
    verdict: 'GO_FOR_STATE_ROTATION',
    test_count: 1,
    test_pass_count: 1,
    test_fail_count: 0,
    syntax_check_count: 1,
    syntax_fail_count: 0,
    dry_run_results: {
      acquisition: 'pass',
      extraction: 'pass',
      specialist_review: 'pass',
      restricted_leakage: 'pass',
      rotation: 'pass',
      operation_lock: 'pass',
    },
    protected_comparator: EXPECTED_CORRECTION_COMPARATOR,
    correction_code_hashes: await currentCodeHashes(),
    protected_raw_values_emitted: false,
    release_or_final_approval_authority: false,
    production_mutation_performed: false,
  });
}

async function fullFixture() {
  const { boundaryRoot, worktreeRoot } = await minimalBoundary();
  const safeRoot = await mkdtemp(join(tmpdir(), 'i1q-rotation-safe-'));
  await chmod(safeRoot, 0o700);
  const safeLedgerPath = join(safeRoot, 'ledger.json');
  const safeCoveragePath = join(safeRoot, 'coverage.json');
  const runId = 'run_fixture_rotation_0001';
  const contractHash = hash('fixture-run-contract');
  const rosterRoot = hash('fixture-roster');

  for (const [relativePath, value] of Object.entries({
    'raw/fixture.json': { fixture: true },
    'state/acquisition-state.json': { fixture: 'acquisition-state' },
    'audit/acquisition-receipt.json': { fixture: 'acquisition-receipt' },
    'state/opaque-alias-map.json': {
      schema_version: 'missionmed.i1q1008e.opaque_alias_map.v1',
      aliases: [],
    },
    'audit/boundary-decision.json': { fixture: 'boundary-decision' },
    'audit/network-target-approval.json': { fixture: 'network-target-approval' },
    'state/acquisition-targets.json': { fixture: 'targets' },
  })) await writeJson(join(boundaryRoot, relativePath), value);

  for (const path of [
    'working/parsed-transcripts', 'audit/processing-receipts',
    'audit/retrieval-receipts', 'reviews/packets', 'reviews/role-submissions',
    'reviews/correction-decisions',
  ]) await secureMkdir(join(boundaryRoot, path));
  await writeJson(join(boundaryRoot, 'working/parsed-transcripts/fixture.json'), { fixture: true });
  await writeJson(join(boundaryRoot, 'audit/processing-receipts/fixture.json'), { fixture: true });
  await writeJson(join(boundaryRoot, 'audit/retrieval-receipts/fixture.json'), { fixture: true });

  const occurrenceInventory = contentAddressedEnvelope({
    schema_version: 'fixture.occurrence.v1', count: 1,
  });
  const conceptInventory = contentAddressedEnvelope({
    schema_version: 'fixture.concept.v1', count: 1,
  });
  const duplicateInventory = contentAddressedEnvelope({
    schema_version: 'fixture.duplicate.v1', count: 1,
  });
  const legacyComparison = { comparison_root: hash('legacy-comparison'), count: 1 };
  await writeJson(join(boundaryRoot, 'working/full-occurrence-inventory-index.json'), occurrenceInventory);
  await writeJson(join(boundaryRoot, 'working/provisional-concepts.json'), conceptInventory);
  await writeJson(join(boundaryRoot, 'working/provisional-duplicate-relationships.json'), duplicateInventory);
  await writeJson(join(boundaryRoot, 'working/legacy-comparison.json'), legacyComparison);

  const artifactEntries = Array.from({ length: 97 }, (_, index) => ({
    source_alias: `source_fixture_${String(index).padStart(4, '0')}`,
    artifact_alias: `artifact_fixture_${String(index).padStart(4, '0')}`,
    transcript_hash_binding: hash(`transcript-${index}`),
    nodes_hash_binding: hash(`nodes-${index}`),
    parser_selected: 'transcript_json',
    nodes_record_count: 1,
    retry_count: 0,
    successful_attempt_number: 1,
    pass_receipts: passEntries(index),
  }));
  const ledger = buildArtifactLedger({ extractionRunId: runId, artifactEntries });
  const coverage = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.coverage_receipt.v1',
    extraction_run_id: runId,
    transcript_artifacts_expected: 97,
    transcript_artifacts_processed: 97,
    automated_pass_cells_required: 873,
    automated_pass_cells_complete: 873,
  });
  await writeJson(safeLedgerPath, ledger);
  await writeJson(safeCoveragePath, coverage);

  let journal = createRunJournal({
    extractionRunId: runId,
    runContractHash: contractHash,
    rosterRoot,
  });
  for (let artifactIndex = 0; artifactIndex < 97; artifactIndex += 1) {
    const artifact = artifactEntries[artifactIndex];
    for (const definition of PASS_DEFINITIONS) {
      const passReceipt = artifact.pass_receipts.find(
        (receipt) => receipt.pass_id === definition.pass_id,
      );
      journal = appendJournalEvent(journal, {
        artifact_alias: artifact.artifact_alias,
        phase: definition.pass_id,
        pass_id: definition.pass_id,
        attempt_number: 1,
        input_hash: artifact.transcript_hash_binding,
        rules_hash: contractHash,
        parser_hash: hash('fixture-parser'),
        state_transition: 'NOT_STARTED_TO_COMPLETE',
        output_shard_hash: passReceipt.proposal_root,
      });
    }
  }
  const packets = [];
  for (const [index, artifact] of artifactEntries.entries()) {
    const occurrenceShard = contentAddressedEnvelope({
      schema_version: 'missionmed.i1q1008e.restricted_occurrence_shard.v1',
      extraction_run_id: runId,
      run_contract_hash: contractHash,
      source_alias: artifact.source_alias,
      artifact_alias: artifact.artifact_alias,
      transcript_hash: artifact.transcript_hash_binding,
      nodes_hash: artifact.nodes_hash_binding,
      occurrences: [],
    });
    const passShard = contentAddressedEnvelope({
      schema_version: 'missionmed.i1q1008e.restricted_pass_receipts.v1',
      extraction_run_id: runId,
      run_contract_hash: contractHash,
      source_alias: artifact.source_alias,
      artifact_alias: artifact.artifact_alias,
      pass_receipts: artifact.pass_receipts,
      nodes_unmatched_medical_count: 0,
      unmatched_medical_nodes: [],
    });
    const processingReceipt = contentAddressedEnvelope({
      schema_version: 'missionmed.i1q1008e.restricted_processing_receipt.v1',
      receipt_id: `receipt_fixture_${String(index).padStart(4, '0')}`,
      extraction_run_id: runId,
      run_contract_hash: contractHash,
      source_alias: artifact.source_alias,
      artifact_alias: artifact.artifact_alias,
      transcript_hash: artifact.transcript_hash_binding,
      nodes_hash: artifact.nodes_hash_binding,
      pass_receipt_root: stableHash(artifact.pass_receipts),
      occurrence_set_root: stableHash([]),
      occurrence_count: 0,
      automated_provisional_review_only: true,
      credentialed_medical_approval_performed: false,
      learner_release_performed: false,
    });
    await writeJson(
      join(boundaryRoot, `working/occurrences/${artifact.artifact_alias}.json`),
      occurrenceShard,
    );
    await writeJson(
      join(boundaryRoot, `working/pass-receipts/${artifact.artifact_alias}.json`),
      passShard,
    );
    await writeJson(
      join(boundaryRoot, `audit/processing-receipts/${artifact.artifact_alias}.json`),
      processingReceipt,
    );
    artifact.transcript_hash = artifact.transcript_hash_binding;
    artifact.nodes_hash = artifact.nodes_hash_binding;
    artifact.occurrence_shard_hash = occurrenceShard.content_hash;
    artifact.pass_shard_hash = passShard.content_hash;
    artifact.processing_receipt_hash = processingReceipt.content_hash;
    packets.push(fixturePacket(runId, contractHash, index, artifact, {
      occurrenceShardHash: occurrenceShard.content_hash,
      passShardHash: passShard.content_hash,
      processingReceiptHash: processingReceipt.content_hash,
    }));
  }
  const state = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_extraction_state.v1',
    extraction_run_id: runId,
    run_contract_hash: contractHash,
    roster_root: rosterRoot,
    artifacts: artifactEntries,
    inventory_index_hash: occurrenceInventory.content_hash,
    concept_inventory_hash: conceptInventory.content_hash,
    duplicate_relationship_inventory_hash: duplicateInventory.content_hash,
    artifact_ledger_hash: ledger.content_hash,
    legacy_comparison_root: legacyComparison.comparison_root,
    extraction_complete: false,
  });
  const extractionReceipt = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_extraction_receipt.v1',
    extraction_run_id: runId,
    run_contract_hash: contractHash,
    extraction_state_hash: state.content_hash,
    roster_root: rosterRoot,
    transcript_artifact_count: 97,
    nodes_artifact_count: 99,
    automated_pass_cell_count: 873,
    inventory_index_hash: occurrenceInventory.content_hash,
    concept_inventory_hash: conceptInventory.content_hash,
    duplicate_relationship_inventory_hash: duplicateInventory.content_hash,
    journal_event_count: 873,
    exact_journal_coverage: true,
  });
  await writeJson(join(boundaryRoot, 'state/extraction-state.json'), state);
  await writeJson(join(boundaryRoot, 'state/extraction-journal.json'), journal);
  await writeJson(join(boundaryRoot, 'audit/extraction-receipt.json'), extractionReceipt);
  for (const packet of packets) {
    await writeJson(join(boundaryRoot, `reviews/packets/${packet.artifact_alias}.json`), packet);
  }
  const batches = fixtureBatches(packets, runId, contractHash);
  for (const role of ROLES) {
    await writeJson(join(boundaryRoot, `reviews/role-submissions/${role}.json`), batches[role]);
  }
  const roleValidation = validateRoleBatches({
    packets, batches, extractionRunId: runId, runContractHash: contractHash,
  });
  const testReceipt = await correctionTestReceipt();
  await writeJson(join(boundaryRoot, 'reviews/correction-decisions/OSLER_CLASSIFIER_PRIVACY_CORRECTION_TEST_RECEIPT.json'), testReceipt);
  const reviewsEvidenceRoot = stableHash({
    packet_set_root: roleValidation.packetSetRoot,
    role_batch_roots: roleValidation.batchRoots,
  });
  const decision = contentAddressedEnvelope({
    schema_version: CORRECTION_DECISION_SCHEMA,
    decision: 'SUPERSEDE_AND_REEXTRACT',
    superseded_extraction_run_id: runId,
    superseded_extraction_state_root: state.content_hash,
    superseded_run_contract_root: contractHash,
    superseded_coverage_receipt_root: coverage.content_hash,
    superseded_journal_root: stableHash(journal),
    superseded_extraction_receipt_root: extractionReceipt.content_hash,
    superseded_reviews_tree_root: reviewsEvidenceRoot,
    superseded_packet_set_root: roleValidation.packetSetRoot,
    old_specialist_roots: roleValidation.batchRoots,
    correction_code_hashes: testReceipt.correction_code_hashes,
    correction_test_receipt_root: testReceipt.content_hash,
    archive_scope: NON_DESTRUCTIVE_ARCHIVE_SCOPE,
    raw_acquisition_alias_decisions_preserved: true,
    non_destructive_archive: true,
    release_or_final_approval_authority: false,
    production_mutation_authorized: false,
  });
  await writeJson(join(boundaryRoot, 'reviews/correction-decisions/OSLER_CLASSIFIER_PRIVACY_CORRECTION.json'), decision);
  return {
    boundaryRoot,
    worktreeRoot,
    safeRoot,
    safeLedgerPath,
    safeCoveragePath,
    testOnly: true,
    verifyCodeHashes: true,
    packets,
    batches,
    decision,
    testReceipt,
    state,
    journal,
    extractionReceipt,
    coverage,
  };
}

async function cleanupFixture(fixture) {
  await rm(fixture.boundaryRoot, { recursive: true, force: true });
  await rm(fixture.safeRoot, { recursive: true, force: true });
}

async function crashAt(fixture, marker) {
  fixture.crashInjector = async (observed) => {
    if (observed === marker) throw new Error(`fixture_crash_${marker}`);
  };
  await assert.rejects(
    rotateSupersededExtractionFixture(fixture), new RegExp(`fixture_crash_${marker}`, 'u'),
  );
  delete fixture.crashInjector;
  const names = await readdir(join(fixture.boundaryRoot, 'audit/supersession-receipts'));
  assert.equal(names.length, 1);
  const preparedPath = join(
    fixture.boundaryRoot, 'audit/supersession-receipts', names[0],
  );
  return { preparedPath, prepared: await readJson(preparedPath) };
}

test('operation lock is stable, exclusive, and child loss fails closed', async () => {
  const fixture = await minimalBoundary();
  try {
    const first = await acquireExtractionOperationLock({ ...fixture, timeoutSeconds: 0 });
    assert.equal(assertExtractionOperationLockHeld(first), true);
    await assert.rejects(
      acquireExtractionOperationLock({ ...fixture, timeoutSeconds: 0 }),
      /operation_lock_busy/u,
    );
    first.child.kill('SIGKILL');
    await first.lost;
    assert.throws(() => assertExtractionOperationLockHeld(first), /operation_lock_lost/u);
    await assert.rejects(releaseExtractionOperationLock(first), /operation_lock_lost/u);
    await withExtractionOperationLock(
      { ...fixture, timeoutSeconds: 0 },
      async (lock) => assert.equal(assertExtractionOperationLockHeld(lock), true),
    );
    await assert.rejects(withExtractionOperationLock(
      { ...fixture, timeoutSeconds: 0 },
      async (lock) => {
        lock.child.kill('SIGKILL');
        await lock.lost;
      },
    ), /operation_lock_lost/u);
    const lockStat = await lstat(join(fixture.boundaryRoot, 'state/.extraction-operation.lock'));
    assert.equal(lockStat.mode & 0o7777, 0o600);
    assert.equal(lockStat.nlink, 1);
  } finally {
    await rm(fixture.boundaryRoot, { recursive: true, force: true });
  }
});

test('operation lock rejects symlinks and hardlinks', async () => {
  for (const kind of ['symlink', 'hardlink']) {
    const fixture = await minimalBoundary();
    const lockPath = join(fixture.boundaryRoot, 'state/.extraction-operation.lock');
    const outside = join(fixture.boundaryRoot, 'tmp/lock-target');
    await writeSecure(outside, '');
    if (kind === 'symlink') await symlink(outside, lockPath);
    else await link(outside, lockPath);
    await assert.rejects(
      acquireExtractionOperationLock({ ...fixture, timeoutSeconds: 0 }),
      /boundary_(?:symlink|hardlink)_rejected|operation_lock_io_failure/u,
    );
    await rm(fixture.boundaryRoot, { recursive: true, force: true });
  }
});

test('operation lock pathname replacement invalidates the displaced holder', async () => {
  const fixture = await minimalBoundary();
  let first;
  let second;
  try {
    first = await acquireExtractionOperationLock({ ...fixture, timeoutSeconds: 0 });
    const canonical = join(fixture.boundaryRoot, 'state/.extraction-operation.lock');
    const displaced = join(fixture.boundaryRoot, 'state/.extraction-operation.lock.displaced');
    await rename(canonical, displaced);
    await writeSecure(canonical, '');
    second = await acquireExtractionOperationLock({ ...fixture, timeoutSeconds: 0 });
    let mutationPerformed = false;
    assert.throws(() => {
      assertExtractionOperationLockHeld(first);
      mutationPerformed = true;
    }, /operation_lock_lost/u);
    await first.lost;
    await first.exited;
    assert.equal(first.state, 'LOST');
    assert.equal(mutationPerformed, false);
    assert.equal(assertExtractionOperationLockHeld(second), true);
  } finally {
    if (second?.state === 'HELD') await releaseExtractionOperationLock(second);
    if (first?.state === 'HELD') await releaseExtractionOperationLock(first).catch(() => {});
    await rm(fixture.boundaryRoot, { recursive: true, force: true });
  }
});

test('correction authority is exact and self-authenticating', async () => {
  const fixture = await fullFixture();
  try {
    const role = validateRoleBatches({
      packets: fixture.packets,
      batches: fixture.batches,
      extractionRunId: fixture.state.extraction_run_id,
      runContractHash: fixture.state.run_contract_hash,
    });
    await validateCorrectionTestReceipt(fixture.testReceipt);
    await validateCorrectionDecision(fixture.decision, {
      extraction_run_id: fixture.state.extraction_run_id,
      extraction_state_root: fixture.state.content_hash,
      run_contract_root: fixture.state.run_contract_hash,
      coverage_receipt_root: fixture.coverage.content_hash,
      journal_root: stableHash(fixture.journal),
      extraction_receipt_root: fixture.extractionReceipt.content_hash,
      reviews_evidence_root: fixture.decision.superseded_reviews_tree_root,
    }, {
      batchRoots: role.batchRoots,
      packetSetRoot: role.packetSetRoot,
      testReceipt: fixture.testReceipt,
    });
    const falseBatch = structuredClone(fixture.batches);
    falseBatch.OSLER = contentAddressedEnvelope({
      ...falseBatch.OSLER,
      artifact_review_count: 96,
    });
    assert.throws(() => validateRoleBatches({
      packets: fixture.packets,
      batches: falseBatch,
      extractionRunId: fixture.state.extraction_run_id,
      runContractHash: fixture.state.run_contract_hash,
    }), /specialist_batch_rejected/u);
    for (const mutation of [
      { correction_id: 'OSLER_CLASSIFIER_PRIVACY_CORRECTION_WRONG' },
      {
        protected_comparator: {
          ...fixture.testReceipt.protected_comparator,
          prior_conflict_count: fixture.testReceipt.protected_comparator.prior_conflict_count - 1,
        },
      },
    ]) {
      const invalid = contentAddressedEnvelope({ ...fixture.testReceipt, ...mutation });
      await assert.rejects(
        validateCorrectionTestReceipt(invalid), /correction_test_receipt_rejected/u,
      );
    }
  } finally {
    await cleanupFixture(fixture);
  }
});

test('prepared receipt is deterministic and rejects arbitrary move authority', async () => {
  const oldRootNames = [
    'extraction_state_root', 'run_contract_root', 'journal_root',
    'extraction_receipt_root', 'artifact_ledger_root', 'coverage_receipt_root',
    'working_tree_root', 'reviews_tree_root', 'processing_receipts_tree_root',
    'retrieval_receipts_tree_root', 'occurrence_inventory', 'concept_inventory',
    'duplicate_relationship_inventory', 'legacy_comparison', 'packet_set_root',
  ];
  const preservationNames = [
    'raw_tree', 'acquisition_state', 'acquisition_receipt', 'alias_map',
    'boundary_decision', 'network_target_approval', 'target_configuration',
  ];
  const moveNames = [
    'working_tree', 'reviews_tree', 'extraction_state', 'extraction_journal',
    'extraction_receipt', 'processing_receipts', 'retrieval_receipts',
  ];
  const input = {
    extractionRunId: 'run_fixture_rotation_0001',
    correctionDecisionRoot: hash('decision'),
    oldRoots: Object.fromEntries(oldRootNames.map((name) => [name, hash(name)])),
    preservation: Object.fromEntries(preservationNames.map((name) => [name, hash(name)])),
    moveRoots: Object.fromEntries(moveNames.map((name) => [name, hash(name)])),
  };
  const first = buildPreparedSupersessionReceipt(input);
  const second = buildPreparedSupersessionReceipt(structuredClone(input));
  assert.deepEqual(first, second);
  assert.equal(verifyContentAddressedEnvelope(first), true);
  assert.equal(Object.hasOwn(first, 'move_plan'), false);
  assert.equal(validatePreparedSupersessionReceipt(first), first);
  const unauthorized = contentAddressedEnvelope({
    ...first,
    move_plan: [{ source: 'raw', destination: `${first.archive_root}/raw` }],
  });
  assert.throws(
    () => validatePreparedSupersessionReceipt(unauthorized),
    /rotation_pointer_rejected/u,
  );
});

test('complete rotation preserves authority and repeated invocation is identical', async () => {
  const fixture = await fullFixture();
  try {
    const preservedBefore = await readFile(join(fixture.boundaryRoot, 'state/acquisition-state.json'));
    const first = await rotateSupersededExtractionFixture(fixture);
    const second = await rotateSupersededExtractionFixture(fixture);
    assert.equal(first.result, 'pass');
    assert.equal(first.repeated_completion, false);
    assert.equal(second.repeated_completion, true);
    assert.equal(second.completion_receipt_root, first.completion_receipt_root);
    assert.deepEqual(
      await readFile(join(fixture.boundaryRoot, 'state/acquisition-state.json')),
      preservedBefore,
    );
    for (const root of ['working', 'reviews']) {
      const entries = await readdir(join(fixture.boundaryRoot, root), { withFileTypes: true });
      assert.ok(entries.length > 0);
      for (const entry of entries) {
        assert.equal(entry.isDirectory(), true);
        assert.equal((await readdir(join(fixture.boundaryRoot, root, entry.name))).length, 0);
      }
    }
  } finally {
    await cleanupFixture(fixture);
  }
});

test('rotation refuses contention before protected preflight', async () => {
  const fixture = await fullFixture();
  let lock;
  try {
    lock = await acquireExtractionOperationLock({
      boundaryRoot: fixture.boundaryRoot,
      worktreeRoot: fixture.worktreeRoot,
      timeoutSeconds: 0,
    });
    await assert.rejects(
      rotateSupersededExtractionFixture(fixture), /operation_lock_busy/u,
    );
  } finally {
    if (lock?.state === 'HELD') await releaseExtractionOperationLock(lock);
    await cleanupFixture(fixture);
  }
});

test('lock pathname replacement in inventory-to-rename gap prevents mutation', async () => {
  const fixture = await fullFixture();
  let replacementHolder;
  let injected = false;
  try {
    const sourceSentinel = join(
      fixture.boundaryRoot, 'working/parsed-transcripts/fixture.json',
    );
    const before = await readFile(sourceSentinel);
    fixture.beforeMutationInjector = async (marker) => {
      if (injected || marker !== 'BEFORE_SWAP_working_tree') return;
      injected = true;
      const canonical = join(fixture.boundaryRoot, 'state/.extraction-operation.lock');
      await rename(canonical, `${canonical}.displaced-during-gap`);
      await writeSecure(canonical, '');
      replacementHolder = await acquireExtractionOperationLock({
        boundaryRoot: fixture.boundaryRoot,
        worktreeRoot: fixture.worktreeRoot,
        timeoutSeconds: 0,
      });
    };
    await assert.rejects(
      rotateSupersededExtractionFixture(fixture), /operation_lock_lost/u,
    );
    assert.equal(injected, true);
    assert.deepEqual(await readFile(sourceSentinel), before);
    assert.equal(assertExtractionOperationLockHeld(replacementHolder), true);
  } finally {
    delete fixture.beforeMutationInjector;
    if (replacementHolder?.state === 'HELD') {
      await releaseExtractionOperationLock(replacementHolder);
    }
    await cleanupFixture(fixture);
  }
});

test('authoritative state recomputation rejects a self-consistent forged packet set', async () => {
  const fixture = await fullFixture();
  try {
    const packets = structuredClone(fixture.packets);
    packets[0] = contentAddressedEnvelope({
      ...packets[0],
      artifact_input_root: hash('forged-artifact-input-root'),
    });
    await writeJson(
      join(fixture.boundaryRoot, `reviews/packets/${packets[0].artifact_alias}.json`),
      packets[0],
    );
    const batches = fixtureBatches(
      packets, fixture.state.extraction_run_id, fixture.state.run_contract_hash,
    );
    for (const role of ROLES) {
      await writeJson(
        join(fixture.boundaryRoot, `reviews/role-submissions/${role}.json`), batches[role],
      );
    }
    const role = validateRoleBatches({
      packets,
      batches,
      extractionRunId: fixture.state.extraction_run_id,
      runContractHash: fixture.state.run_contract_hash,
    });
    const decision = contentAddressedEnvelope({
      ...fixture.decision,
      superseded_reviews_tree_root: stableHash({
        packet_set_root: role.packetSetRoot,
        role_batch_roots: role.batchRoots,
      }),
      superseded_packet_set_root: role.packetSetRoot,
      old_specialist_roots: role.batchRoots,
    });
    await writeJson(
      join(fixture.boundaryRoot,
        'reviews/correction-decisions/OSLER_CLASSIFIER_PRIVACY_CORRECTION.json'),
      decision,
    );
    await assert.rejects(
      rotateSupersededExtractionFixture(fixture), /specialist_batch_rejected/u,
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

test('mechanically valid journal chain cannot forge pass coverage semantics', async () => {
  const fixture = await fullFixture();
  try {
    const forged = structuredClone(fixture.journal);
    forged.events[0].output_shard_hash = hash('forged-pass-output');
    let prior = null;
    for (const event of forged.events) {
      event.prior_event_hash = prior;
      event.event_identity = stableHash({
        artifact_alias: event.artifact_alias,
        phase: event.phase,
        pass_id: event.pass_id,
        attempt_number: event.attempt_number,
      });
      const payload = { ...event };
      delete payload.event_hash;
      delete payload.event_identity;
      event.event_hash = stableHash(payload);
      prior = event.event_hash;
    }
    assert.equal(validateJournal(forged).length, 0);
    await writeJson(join(fixture.boundaryRoot, 'state/extraction-journal.json'), forged);
    await assert.rejects(
      rotateSupersededExtractionFixture(fixture), /old_extraction_rejected/u,
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

test('atomic moves fail closed on swap and exclusive destination collisions', async (context) => {
  await context.test('directory swap destination collision', async () => {
    const fixture = await fullFixture();
    try {
      const { prepared } = await crashAt(fixture, 'STATUS_MOVING');
      const oldState = await readFile(join(fixture.boundaryRoot, 'state/extraction-state.json'));
      await writeSecure(
        join(fixture.boundaryRoot, prepared.archive_root, 'working/rogue'), 'no-clobber',
      );
      await assert.rejects(
        rotateSupersededExtractionFixture(fixture), /archive_manifest_mismatch/u,
      );
      assert.deepEqual(
        await readFile(join(fixture.boundaryRoot, 'state/extraction-state.json')), oldState,
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });

  await context.test('exclusive file destination collision', async () => {
    const fixture = await fullFixture();
    try {
      const { prepared } = await crashAt(fixture, 'MOVE_2_reviews_tree');
      const source = join(fixture.boundaryRoot, 'state/extraction-state.json');
      const oldState = await readFile(source);
      const destination = join(
        fixture.boundaryRoot, prepared.archive_root, 'state/extraction-state.json',
      );
      await writeSecure(destination, '{"rogue":true}\n');
      const rogue = await readFile(destination);
      await assert.rejects(
        rotateSupersededExtractionFixture(fixture),
        /archive_collision|archive_manifest_mismatch/u,
      );
      assert.deepEqual(await readFile(source), oldState);
      assert.deepEqual(await readFile(destination), rogue);
    } finally {
      await cleanupFixture(fixture);
    }
  });
});

test('persisted unauthorized prepared receipt cannot expand move authority', async () => {
  const fixture = await fullFixture();
  try {
    const { preparedPath, prepared } = await crashAt(fixture, 'PREPARED_RECEIPT_WRITTEN');
    const unauthorized = contentAddressedEnvelope({
      ...prepared,
      move_plan: [{ source: 'raw', destination: `${prepared.archive_root}/raw` }],
    });
    await writeJson(preparedPath, unauthorized);
    await assert.rejects(
      rotateSupersededExtractionFixture(fixture),
      /archive_collision|rotation_pointer_rejected/u,
    );
    assert.equal((await readJson(join(fixture.boundaryRoot, 'raw/fixture.json'))).fixture, true);
  } finally {
    await cleanupFixture(fixture);
  }
});

test('rotation rejects protected-tree symlinks and hardlinks before moving', async (context) => {
  for (const kind of ['symlink', 'hardlink']) {
    await context.test(kind, async () => {
      const fixture = await fullFixture();
      try {
        const alias = fixture.state.artifacts[0].artifact_alias;
        const target = join(fixture.boundaryRoot, `working/occurrences/${alias}.json`);
        const outside = join(fixture.boundaryRoot, 'tmp/adversarial-target.json');
        await writeSecure(outside, '{"synthetic":true}\n');
        await rm(target);
        if (kind === 'symlink') await symlink(outside, target);
        else await link(outside, target);
        await assert.rejects(
          rotateSupersededExtractionFixture(fixture),
          /boundary_(?:symlink|hardlink)_rejected/u,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    });
  }
});

const CRASH_MARKERS = [
  'ARCHIVE_RESERVED',
  'PREPARED_RECEIPT_WRITTEN',
  'STATUS_PREPARED',
  'ARCHIVE_RECEIPT_WRITTEN',
  'STATUS_MOVING',
  'MOVE_1_working_tree',
  'MOVE_2_reviews_tree',
  'MOVE_3_extraction_state',
  'MOVE_4_extraction_journal',
  'MOVE_5_extraction_receipt',
  'MOVE_6_processing_receipts',
  'MOVE_7_retrieval_receipts',
  'FRESH_TREES_CREATED',
  'COMPLETION_RECEIPTS_WRITTEN',
  'STATUS_COMPLETE',
];

test('every durable transition and move resumes to one identical COMPLETE receipt', async (context) => {
  for (const marker of CRASH_MARKERS) {
    await context.test(marker, async () => {
      const fixture = await fullFixture();
      try {
        let injected = false;
        fixture.crashInjector = async (observed) => {
          if (!injected && observed === marker) {
            injected = true;
            throw new Error(`fixture_crash_${marker}`);
          }
        };
        await assert.rejects(rotateSupersededExtractionFixture(fixture), /fixture_crash_/u);
        assert.equal(injected, true);
        delete fixture.crashInjector;
        const resumed = await rotateSupersededExtractionFixture(fixture);
        const repeated = await rotateSupersededExtractionFixture(fixture);
        assert.equal(resumed.result, 'pass');
        assert.equal(repeated.repeated_completion, true);
        assert.equal(repeated.completion_receipt_root, resumed.completion_receipt_root);
      } finally {
        await cleanupFixture(fixture);
      }
    });
  }
});

test('archive collision, nonempty fresh tree, and preservation mutation fail closed', async (context) => {
  await context.test('archive collision before status', async () => {
    const fixture = await fullFixture();
    try {
      fixture.crashInjector = async (marker) => {
        if (marker === 'ARCHIVE_RESERVED') throw new Error('fixture_crash_archive');
      };
      await assert.rejects(rotateSupersededExtractionFixture(fixture), /fixture_crash_archive/u);
      const archive = (await readdir(join(fixture.boundaryRoot, 'quarantine')))
        .find((name) => name.startsWith('superseded-extraction-'));
      await writeSecure(join(fixture.boundaryRoot, 'quarantine', archive, 'rogue'), 'x');
      delete fixture.crashInjector;
      await assert.rejects(
        rotateSupersededExtractionFixture(fixture), /archive_collision/u,
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });

  await context.test('nonempty fresh tree', async () => {
    const fixture = await fullFixture();
    try {
      fixture.crashInjector = async (marker) => {
        if (marker === 'FRESH_TREES_CREATED') throw new Error('fixture_crash_fresh');
      };
      await assert.rejects(rotateSupersededExtractionFixture(fixture), /fixture_crash_fresh/u);
      await writeSecure(join(fixture.boundaryRoot, 'working/occurrences/rogue.json'), '{}');
      delete fixture.crashInjector;
      await assert.rejects(
        rotateSupersededExtractionFixture(fixture),
        /archive_manifest_mismatch|fresh_tree_rejected/u,
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });

  await context.test('preservation mutation', async () => {
    const fixture = await fullFixture();
    try {
      fixture.crashInjector = async (marker) => {
        if (marker === 'MOVE_1_working_tree') throw new Error('fixture_crash_preservation');
      };
      await assert.rejects(
        rotateSupersededExtractionFixture(fixture), /fixture_crash_preservation/u,
      );
      await writeJson(join(fixture.boundaryRoot, 'state/acquisition-state.json'), { changed: true });
      delete fixture.crashInjector;
      await assert.rejects(
        rotateSupersededExtractionFixture(fixture), /preservation_invariant_failed/u,
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });
});

test('dry run performs no protected reads or writes', async () => {
  const result = await dryRun();
  assert.equal(result.result, 'pass');
  assert.equal(result.protected_reads, 0);
  assert.equal(result.protected_writes, 0);
  assert.equal(result.network_requests, 0);
});
