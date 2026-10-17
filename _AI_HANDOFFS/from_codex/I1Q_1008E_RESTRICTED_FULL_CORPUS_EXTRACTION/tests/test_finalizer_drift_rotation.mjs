import assert from 'node:assert/strict';
import {
  chmod, link, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import {
  contentAddressedEnvelope, sha256, stableHash, verifyContentAddressedEnvelope,
} from '../tools/canonical.mjs';
import { PASS_DEFINITIONS } from '../tools/constants.mjs';
import {
  appendJournalEvent, buildArtifactLedger, createRunJournal,
} from '../tools/ledger.mjs';
import {
  acquireExtractionOperationLock, releaseExtractionOperationLock,
} from '../tools/extraction-operation-lock.mjs';
import {
  buildFinalizerDriftRotationReceipt,
  currentFinalizerDriftRotationTcbHashes,
  currentRunContractManifest,
  dryRunFinalizerDriftRotation,
  prepareFinalizerDriftRotationFixture,
  reconstructRunContractFromManifest,
  rotateFinalizerDriftExtractionFixture,
  validateFinalizerDriftRotationCompletion,
  validateFinalizerDriftRotationDecision,
  validateFinalizerDriftRunFixture,
  validateFinalizerDriftRotationReceipt,
  validateFinalizerDriftRotationStatus,
} from '../tools/rotate-superseded-extraction.mjs';

const TOP_LEVEL = ['raw', 'working', 'audit', 'quarantine', 'tmp', 'keys', 'state', 'reviews'];
const OLD_FINALIZER = '6177e3cf0b3208ea2f435a83eb0819eae7ec5b9e9c59993ac9c208b2060f15c2';
const NEW_FINALIZER = '5d5ccd4f18eb11fbf6025b7eca65ed5753e86fab30fb74e034188abb1dbcd879';
const OLD_RUN_CONTRACT = '01e5c2d8db992e47ca08aab3652dd6e753d20c973cfad8874492f941ccdf34ab';
const TICKET = '99a5c0d9f13c77fbcd20fbd57a6e1186fdf467f35e3657269fe99b23efeddb03';
const PRIOR_SUPERSESSION = '8b5d419ee1c40c8d8c3aca0f2f7346a3a109b30b8476561c714313132cf325d9';
const PRIOR_PARTIAL = 'abd0f6c3874e16008c273306eedc06a31f2f71f700c2f8d087d3ab5470330808';
const APPROVED_ROOT_KEYS = [
  'extraction_state_root', 'journal_root', 'extraction_receipt_root',
  'working_tree_root', 'reviews_tree_root', 'processing_receipts_tree_root',
  'retrieval_receipts_tree_root', 'artifact_failures_tree_root',
  'move_unit_set_root',
  'artifact_ledger_root', 'coverage_receipt_root',
  'finalization_completion_root', 'packet_set_root', 'submission_set_root',
  'receipt_set_root', 'finalizer_contract_root',
];
const ARCHIVE_SCOPE = [
  'WORKING_TREE', 'REVIEWS_TREE', 'EXTRACTION_STATE', 'EXTRACTION_JOURNAL',
  'EXTRACTION_RECEIPT', 'PROCESSING_RECEIPTS', 'RETRIEVAL_RECEIPTS',
  'ARTIFACT_FAILURES',
];
const UNITS = [
  'working_tree', 'reviews_tree', 'extraction_state', 'extraction_journal',
  'extraction_receipt', 'processing_receipts', 'retrieval_receipts', 'artifact_failures',
];

async function secureMkdir(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  let current = resolve(path);
  while (current.length > 1) {
    await chmod(current, 0o700).catch(() => {});
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

async function writeJson(path, value) {
  await secureMkdir(dirname(path));
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

function reEnvelope(value, changes) {
  const payload = { ...value, ...changes };
  delete payload.content_hash;
  return contentAddressedEnvelope(payload);
}

async function fixtureDecision() {
  const current = await currentRunContractManifest();
  const rotationTcbHashes = await currentFinalizerDriftRotationTcbHashes();
  const old = structuredClone(current);
  const index = old.findIndex(
    (entry) => entry.relative_path === 'tools/finalize-specialist-role-batches.mjs',
  );
  assert.ok(index >= 0);
  assert.equal(current[index].sha256, NEW_FINALIZER);
  old[index].sha256 = OLD_FINALIZER;
  const approved = Object.fromEntries(APPROVED_ROOT_KEYS.map(
    (key, rootIndex) => [key, String((rootIndex % 9) + 1).repeat(64)],
  ));
  return contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.finalizer_drift_rotation_decision.v1',
    decision: 'SUPERSEDE_FINALIZED_RUN_FOR_FINALIZER_HASH_DRIFT',
    authority_ticket_sha256: TICKET,
    extraction_run_id: 'opaque_run_fixture_finalizer_drift',
    old_run_contract_root: OLD_RUN_CONTRACT,
    current_run_contract_root: '2'.repeat(64),
    old_finalizer_sha256: OLD_FINALIZER,
    corrected_finalizer_sha256: NEW_FINALIZER,
    old_run_contract_manifest: old,
    old_manifest_root: stableHash(old),
    current_run_contract_manifest: current,
    current_manifest_root: stableHash(current),
    rotation_tcb_hashes: rotationTcbHashes,
    rotation_tcb_root: stableHash(rotationTcbHashes),
    approved_roots: approved,
    archive_scope: ARCHIVE_SCOPE,
    non_destructive_archive: true,
    raw_acquisition_alias_decisions_preserved: true,
    production_mutation_authorized: false,
    release_or_final_approval_authority: false,
  });
}

async function rotationFixture() {
  const boundaryRoot = await mkdtemp(join(tmpdir(), 'i1q-finalizer-drift-'));
  await chmod(boundaryRoot, 0o700);
  for (const name of TOP_LEVEL) {
    await mkdir(join(boundaryRoot, name), { mode: 0o700 });
    await chmod(join(boundaryRoot, name), 0o700);
  }
  const worktreeRoot = `${boundaryRoot}-separate-worktree`;
  const preserved = {
    'raw/fixture.json': { preserved: 'raw' },
    'state/acquisition-state.json': { preserved: 'acquisition-state' },
    'state/acquisition-targets.json': { preserved: 'targets' },
    'state/opaque-alias-map.json': {
      schema_version: 'missionmed.i1q1008e.opaque_alias_map.v1', aliases: [],
    },
    'audit/acquisition-receipt.json': { preserved: 'acquisition-receipt' },
    'audit/boundary-decision.json': { preserved: 'boundary-decision' },
    'audit/network-target-approval.json': { preserved: 'network-approval' },
    'state/supersession-status.json': { preserved: 'supersession-status' },
    'audit/supersession-receipts/fixture.json': { preserved: 'supersession-receipt' },
    'audit/supersession-completions/fixture.json': { preserved: 'supersession-completion' },
    [`quarantine/superseded-extraction-${PRIOR_SUPERSESSION}/fixture.json`]: {
      preserved: 'supersession-archive',
    },
    'state/partial-run-recovery-status.json': { preserved: 'partial-status' },
    [`quarantine/contract-invalid-partial-${PRIOR_PARTIAL}/fixture.json`]: {
      preserved: 'partial-archive',
    },
  };
  const derived = {
    'working/current.json': { archive: 'working' },
    'reviews/current.json': { archive: 'reviews' },
    'state/extraction-state.json': { archive: 'state' },
    'state/extraction-journal.json': { archive: 'journal' },
    'audit/extraction-receipt.json': { archive: 'receipt' },
    'audit/processing-receipts/current.json': { archive: 'processing' },
    'audit/retrieval-receipts/current.json': { archive: 'retrieval' },
    'audit/artifact-failures/current.json': { archive: 'failures' },
  };
  for (const [path, value] of Object.entries({ ...preserved, ...derived })) {
    await writeJson(join(boundaryRoot, path), value);
  }
  const decision = await fixtureDecision();
  const fixture = { boundaryRoot, worktreeRoot, decision, testOnly: true };
  fixture.preparedReceipt = await prepareFinalizerDriftRotationFixture(fixture);
  fixture.preservedHashes = Object.fromEntries(await Promise.all(
    Object.keys(preserved).map(async (path) => [path, sha256(await readFile(join(boundaryRoot, path)))]),
  ));
  return fixture;
}

async function cleanup(fixture) {
  await rm(fixture.boundaryRoot, { recursive: true, force: true });
  if (fixture.safeRoot) await rm(fixture.safeRoot, { recursive: true, force: true });
}

async function authoritativeFixture(tamper = null) {
  const fixture = await rotationFixture();
  const safeRoot = await mkdtemp(join(tmpdir(), 'i1q-finalizer-drift-safe-'));
  await chmod(safeRoot, 0o700);
  fixture.safeRoot = safeRoot;
  fixture.safeLedgerPath = join(safeRoot, 'ledger.json');
  fixture.safeCoveragePath = join(safeRoot, 'coverage.json');
  const runId = 'opaque_run_fixture_authoritative_finalizer';
  const rosterRoot = sha256('authoritative-roster');
  const acquisition = contentAddressedEnvelope({
    schema_version: 'fixture.acquisition.v1', complete: true,
  });
  const acquisitionReceipt = contentAddressedEnvelope({
    schema_version: 'fixture.acquisition-receipt.v1', complete: true,
  });
  const currentManifest = await currentRunContractManifest();
  const oldManifest = structuredClone(currentManifest);
  oldManifest.find(
    (entry) => entry.relative_path === 'tools/finalize-specialist-role-batches.mjs',
  ).sha256 = OLD_FINALIZER;
  const inputs = {
    extractionRunId: runId,
    acquisitionStateHash: acquisition.content_hash,
    acquisitionReceiptHash: acquisitionReceipt.content_hash,
  };
  const oldRoot = reconstructRunContractFromManifest(oldManifest, inputs).content_hash;
  const currentRoot = reconstructRunContractFromManifest(currentManifest, inputs).content_hash;
  const artifactEntries = Array.from({ length: 97 }, (_, index) => ({
    source_alias: `opaque_source_fixture_${String(index).padStart(4, '0')}`,
    artifact_alias: `opaque_artifact_fixture_${String(index).padStart(4, '0')}`,
    transcript_hash_binding: sha256(`transcript-${index}`),
    nodes_hash_binding: sha256(`nodes-${index}`),
    transcript_hash: sha256(`transcript-${index}`),
    nodes_hash: sha256(`nodes-${index}`),
    run_contract_hash: oldRoot,
    parser_selected: 'transcript_json', nodes_record_count: 1,
    retry_count: 0, successful_attempt_number: 1,
    final_artifact_status: 'COMPLETE',
    pass_receipts: PASS_DEFINITIONS.map((definition) => ({
      pass_id: definition.pass_id, status: 'COMPLETE', attempt_count: 1,
      records_inspected: 1, proposals_emitted: 1,
      proposal_root: sha256(`${index}-${definition.pass_id}`),
    })),
  }));
  const ledger = buildArtifactLedger({ extractionRunId: runId, artifactEntries });
  let statePayload = {
    schema_version: 'missionmed.i1q1008e.restricted_extraction_state.v1',
    extraction_run_id: runId, run_contract_hash: oldRoot, roster_root: rosterRoot,
    artifacts: artifactEntries, extraction_cursor: 97, extraction_complete: false,
    inventory_index_hash: sha256('inventory'), concept_inventory_hash: sha256('concepts'),
    duplicate_relationship_inventory_hash: sha256('duplicates'),
    artifact_ledger_hash: ledger.content_hash,
  };
  if (tamper === 'state_cursor') statePayload = { ...statePayload, extraction_cursor: 96 };
  const state = contentAddressedEnvelope(statePayload);
  let journal = createRunJournal({
    extractionRunId: runId, runContractHash: oldRoot, rosterRoot,
  });
  for (const [artifactIndex, artifact] of artifactEntries.entries()) {
    for (const definition of PASS_DEFINITIONS) {
      const pass = artifact.pass_receipts.find((entry) => entry.pass_id === definition.pass_id);
      const first = artifactIndex === 0 && definition.pass_id === 'PASS_1';
      journal = appendJournalEvent(journal, {
        artifact_alias: first && tamper === 'journal_alias'
          ? 'opaque_artifact_forged_0000' : artifact.artifact_alias,
        phase: definition.pass_id, pass_id: definition.pass_id, attempt_number: 1,
        input_hash: artifact.transcript_hash,
        rules_hash: oldRoot, parser_hash: sha256('parser'),
        state_transition: 'NOT_STARTED_TO_COMPLETE',
        output_shard_hash: first && tamper === 'journal_output'
          ? sha256('forged-output') : pass.proposal_root,
      });
    }
  }
  let receiptPayload = {
    schema_version: 'missionmed.i1q1008e.restricted_extraction_receipt.v1',
    extraction_run_id: runId, run_contract_hash: oldRoot,
    extraction_state_hash: state.content_hash, roster_root: rosterRoot,
    transcript_artifact_count: 97, nodes_artifact_count: 99,
    automated_pass_cell_count: 873, specialist_verification_cell_count: 0,
    specialist_role_review_count: 0, journal_event_count: 873,
    exact_journal_coverage: true, extraction_complete: false,
    no_production_mutation: true,
    inventory_index_hash: state.inventory_index_hash,
    concept_inventory_hash: state.concept_inventory_hash,
    duplicate_relationship_inventory_hash: state.duplicate_relationship_inventory_hash,
  };
  if (tamper === 'receipt_production') {
    receiptPayload = { ...receiptPayload, no_production_mutation: false };
  }
  const extractionReceipt = contentAddressedEnvelope(receiptPayload);
  let completionPayload = {
    schema_version: 'missionmed.i1q1008e.specialist_batch_finalization.v1',
    status: 'COMPLETE', extraction_run_id: runId, run_contract_hash: oldRoot,
    packet_count: 97, packet_set_root: sha256('packets'), role_batch_count: 4,
    role_batch_roots: {}, reviewer_instance_count: 4,
    artifact_submission_count: 97, specialist_role_review_count: 388,
    specialist_verification_cell_count: 194, receipt_count: 97,
    finalizer_contract_root: sha256('finalizer-contract'),
    submission_set_root: sha256('submissions'), receipt_set_root: sha256('receipts'),
    disposition_histogram: {}, no_release_or_final_approval_authority: true,
    production_mutation_performed: false,
  };
  if (tamper === 'completion_count') {
    completionPayload = { ...completionPayload, role_batch_count: 3 };
  }
  const completion = contentAddressedEnvelope(completionPayload);
  const coverage = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.coverage_receipt.v1',
    extraction_run_id: runId, transcript_artifacts_expected: 97,
    transcript_artifacts_processed: 97, nodes_artifacts_accounted: 99,
    automated_pass_cells_required: 873, automated_pass_cells_complete: 873,
    specialist_verification_cells_required: 194, specialist_verification_cells_complete: 0,
    specialist_role_reviews_required: 388, specialist_role_reviews_complete: 0,
    specialist_verification_status: 'PENDING', extraction_complete: false,
    artifact_final_state_histogram: { COMPLETE: 97 }, no_silent_omission: true,
  });
  for (const [path, value] of Object.entries({
    'state/acquisition-state.json': acquisition,
    'audit/acquisition-receipt.json': acquisitionReceipt,
    'state/extraction-state.json': state,
    'state/extraction-journal.json': journal,
    'audit/extraction-receipt.json': extractionReceipt,
    'reviews/finalization/specialist-batch-finalization.json': completion,
  })) await writeJson(join(fixture.boundaryRoot, path), value);
  await writeJson(fixture.safeLedgerPath, ledger);
  await writeJson(fixture.safeCoveragePath, coverage);

  const provisional = await fixtureDecision();
  const preliminary = await prepareFinalizerDriftRotationFixture({
    ...fixture, decision: provisional, testOnly: true,
  });
  const approved = {
    extraction_state_root: state.content_hash,
    journal_root: stableHash(journal), extraction_receipt_root: extractionReceipt.content_hash,
    working_tree_root: preliminary.move_unit_roots.working_tree,
    reviews_tree_root: preliminary.move_unit_roots.reviews_tree,
    processing_receipts_tree_root: preliminary.move_unit_roots.processing_receipts,
    retrieval_receipts_tree_root: preliminary.move_unit_roots.retrieval_receipts,
    artifact_failures_tree_root: preliminary.move_unit_roots.artifact_failures,
    move_unit_set_root: stableHash(preliminary.move_unit_roots),
    artifact_ledger_root: ledger.content_hash, coverage_receipt_root: coverage.content_hash,
    finalization_completion_root: completion.content_hash,
    packet_set_root: completion.packet_set_root,
    submission_set_root: completion.submission_set_root,
    receipt_set_root: completion.receipt_set_root,
    finalizer_contract_root: completion.finalizer_contract_root,
  };
  fixture.decision = contentAddressedEnvelope({
    ...provisional, extraction_run_id: runId, old_run_contract_root: oldRoot,
    current_run_contract_root: currentRoot, old_run_contract_manifest: oldManifest,
    old_manifest_root: stableHash(oldManifest), current_run_contract_manifest: currentManifest,
    current_manifest_root: stableHash(currentManifest), approved_roots: approved,
    content_hash: undefined,
  });
  delete fixture.decision.content_hash;
  fixture.decision = contentAddressedEnvelope(fixture.decision);
  fixture.expectedContractRoots = { old: oldRoot, current: currentRoot };
  fixture.testOnly = true;
  return fixture;
}

test('finalizer-drift authority is exact and dry-run performs zero I/O', async () => {
  const decision = await fixtureDecision();
  assert.equal(await validateFinalizerDriftRotationDecision(decision), decision);
  const reconstructed = reconstructRunContractFromManifest(
    decision.old_run_contract_manifest,
    {
      extractionRunId: 'opaque_run_fixture_contract_reconstruction',
      acquisitionStateHash: '3'.repeat(64),
      acquisitionReceiptHash: '4'.repeat(64),
    },
  );
  assert.equal(
    reconstructed.content_hash,
    '6c433d0c5a13da56e5aec52e57541749428084bb4e77e8a41264fb13e462e8a8',
  );
  assert.equal(decision.old_run_contract_root, OLD_RUN_CONTRACT);
  for (const changes of [
    { old_finalizer_sha256: '3'.repeat(64) },
    { corrected_finalizer_sha256: '4'.repeat(64) },
    { old_run_contract_root: '5'.repeat(64) },
    { old_run_contract_root: `01e5c2${'0'.repeat(58)}` },
    { archive_scope: ARCHIVE_SCOPE.slice(1) },
    { production_mutation_authorized: true },
  ]) {
    await assert.rejects(
      validateFinalizerDriftRotationDecision(reEnvelope(decision, changes)),
      /finalizer_drift_rotation_rejected/u,
    );
  }
  const extraDrift = structuredClone(decision.current_run_contract_manifest);
  extraDrift[0].sha256 = '9'.repeat(64);
  await assert.rejects(validateFinalizerDriftRotationDecision(reEnvelope(decision, {
    current_run_contract_manifest: extraDrift,
    current_manifest_root: stableHash(extraDrift),
  }), { verifyCurrentManifest: false }), /finalizer_drift_rotation_rejected/u);
  const tcbDrift = structuredClone(decision.rotation_tcb_hashes);
  tcbDrift[0].sha256 = 'c'.repeat(64);
  await assert.rejects(validateFinalizerDriftRotationDecision(reEnvelope(decision, {
    rotation_tcb_hashes: tcbDrift,
    rotation_tcb_root: stableHash(tcbDrift),
  })), /finalizer_drift_rotation_rejected/u);
  const dry = await dryRunFinalizerDriftRotation();
  assert.deepEqual(
    [dry.result, dry.protected_reads, dry.protected_writes, dry.network_requests],
    ['pass', 0, 0, 0],
  );
  assert.equal(dry.exact_manifest_delta_count, 1);
  assert.equal(dry.fixed_move_unit_count, 8);
});

test('authoritative loader enforces 97x9 state, journal, ledger, receipt, and finalization joins', async () => {
  const valid = await authoritativeFixture();
  const loaded = await validateFinalizerDriftRunFixture(valid);
  assert.equal(loaded.state.artifacts.length, 97);
  assert.equal(loaded.state.extraction_cursor, 97);
  assert.equal(loaded.state.extraction_complete, false);
  await cleanup(valid);

  for (const tamper of [
    'journal_alias', 'journal_output', 'state_cursor',
    'receipt_production', 'completion_count',
  ]) {
    const fixture = await authoritativeFixture(tamper);
    await assert.rejects(
      validateFinalizerDriftRunFixture(fixture),
      /finalizer_drift_rotation_rejected/u,
    );
    await cleanup(fixture);
  }
});

test('finalizer-drift rotation resumes identically from every crash cursor', async () => {
  const markers = [
    'FINALIZER_DRIFT_RECEIPTS_WRITTEN', 'FINALIZER_DRIFT_STATUS_PREPARED',
    ...UNITS.flatMap((unit) => [
      `FINALIZER_DRIFT_MOVED_${unit}`, `FINALIZER_DRIFT_STATUS_${unit}`,
    ]),
    'FINALIZER_DRIFT_FRESH_TREES_CREATED', 'FINALIZER_DRIFT_COMPLETIONS_WRITTEN',
    'FINALIZER_DRIFT_STATUS_COMPLETE',
  ];
  let expectedCompletion = null;
  for (const marker of markers) {
    const fixture = await rotationFixture();
    fixture.crashInjector = async (observed) => {
      if (observed === marker) throw new Error(`fixture_crash_${marker}`);
    };
    await assert.rejects(
      rotateFinalizerDriftExtractionFixture(fixture),
      new RegExp(`fixture_crash_${marker}`, 'u'),
    );
    delete fixture.crashInjector;
    const resumed = await rotateFinalizerDriftExtractionFixture(fixture);
    assert.equal(resumed.result, 'pass');
    assert.equal(resumed.archived_unit_count, 8);
    expectedCompletion ??= resumed.completion_root;
    assert.equal(resumed.completion_root, expectedCompletion);
    const repeated = await rotateFinalizerDriftExtractionFixture(fixture);
    assert.equal(repeated.repeated_completion, true);
    assert.equal(repeated.completion_root, expectedCompletion);
    for (const [path, digest] of Object.entries(fixture.preservedHashes)) {
      assert.equal(sha256(await readFile(join(fixture.boundaryRoot, path))), digest);
    }
    for (const root of ['working', 'reviews']) {
      for (const entry of await readdir(join(fixture.boundaryRoot, root), { withFileTypes: true })) {
        assert.equal(entry.isDirectory(), true);
        assert.deepEqual(await readdir(join(fixture.boundaryRoot, root, entry.name)), []);
      }
    }
    await cleanup(fixture);
  }
});

test('finalizer-drift pointer, terminal, archive, and preservation forgeries fail closed', async () => {
  const fixture = await rotationFixture();
  const receipt = fixture.preparedReceipt;
  assert.throws(() => validateFinalizerDriftRotationReceipt(reEnvelope(receipt, {
    archive_root: 'quarantine/forged',
  }), fixture.decision), /finalizer_drift_rotation_rejected/u);
  await secureMkdir(join(fixture.boundaryRoot, receipt.archive_root));
  await writeJson(join(fixture.boundaryRoot, receipt.archive_root, 'rogue.json'), { rogue: true });
  await assert.rejects(
    rotateFinalizerDriftExtractionFixture(fixture), /archive_collision/u,
  );
  await cleanup(fixture);

  const completeFixture = await rotationFixture();
  const result = await rotateFinalizerDriftExtractionFixture(completeFixture);
  const statusPath = join(
    completeFixture.boundaryRoot, 'state/finalizer-drift-rotation-status.json',
  );
  const status = JSON.parse(await readFile(statusPath, 'utf8'));
  assert.equal(verifyContentAddressedEnvelope(status), true);
  assert.throws(() => validateFinalizerDriftRotationStatus(reEnvelope(status, {
    prepared_receipt_root: 'f'.repeat(64),
  }), completeFixture.preparedReceipt), /finalizer_drift_rotation_rejected/u);
  await writeJson(statusPath, reEnvelope(status, {
    completion_receipt_root: 'e'.repeat(64),
  }));
  await assert.rejects(
    rotateFinalizerDriftExtractionFixture(completeFixture),
    /finalizer_drift_rotation_rejected/u,
  );
  await writeJson(statusPath, status);
  const completionPath = join(
    completeFixture.boundaryRoot,
    `audit/finalizer-drift-rotation-completions/${result.rotation_root}.json`,
  );
  const completion = JSON.parse(await readFile(completionPath, 'utf8'));
  assert.throws(() => validateFinalizerDriftRotationCompletion(reEnvelope(completion, {
    production_mutation_performed: true,
  }), completeFixture.preparedReceipt), /finalizer_drift_rotation_rejected/u);
  await writeJson(join(completeFixture.boundaryRoot, 'raw/fixture.json'), { changed: true });
  await assert.rejects(
    rotateFinalizerDriftExtractionFixture(completeFixture), /preservation_invariant_failed/u,
  );
  await cleanup(completeFixture);
});

test('finalizer-drift lock contention, symlinks, and hardlinks fail before mutation', async () => {
  const manifestGap = await rotationFixture();
  let drifted = false;
  manifestGap.authorityLoader = async () => {
    if (!drifted) return manifestGap.decision;
    const manifest = structuredClone(manifestGap.decision.current_run_contract_manifest);
    manifest[0].sha256 = 'd'.repeat(64);
    return reEnvelope(manifestGap.decision, {
      current_run_contract_manifest: manifest,
      current_manifest_root: stableHash(manifest),
    });
  };
  manifestGap.beforeFirstMutationInjector = async () => { drifted = true; };
  await assert.rejects(
    rotateFinalizerDriftExtractionFixture(manifestGap),
    /finalizer_drift_rotation_rejected/u,
  );
  assert.equal(JSON.parse(await readFile(
    join(manifestGap.boundaryRoot, 'working/current.json'), 'utf8',
  )).archive, 'working');
  assert.equal((await readdir(join(manifestGap.boundaryRoot, 'quarantine'))).some(
    (name) => name.startsWith('finalizer-drift-supersession-'),
  ), false);
  await cleanup(manifestGap);

  const contention = await rotationFixture();
  const lock = await acquireExtractionOperationLock({
    boundaryRoot: contention.boundaryRoot, worktreeRoot: contention.worktreeRoot,
  });
  await assert.rejects(
    rotateFinalizerDriftExtractionFixture(contention), /operation_lock_busy/u,
  );
  await releaseExtractionOperationLock(lock);
  await cleanup(contention);

  const lost = await rotationFixture();
  let replaced = false;
  lost.beforeMutationInjector = async (marker) => {
    if (replaced || marker !== 'BEFORE_SWAP_working_tree') return;
    replaced = true;
    const lockPath = join(lost.boundaryRoot, 'state/.extraction-operation.lock');
    await rename(lockPath, `${lockPath}.displaced`);
    await writeFile(lockPath, '', { mode: 0o600 });
    await chmod(lockPath, 0o600);
  };
  await assert.rejects(
    rotateFinalizerDriftExtractionFixture(lost), /operation_lock_lost/u,
  );
  assert.equal(JSON.parse(await readFile(
    join(lost.boundaryRoot, 'working/current.json'), 'utf8',
  )).archive, 'working');
  await cleanup(lost);

  const symbolic = await rotationFixture();
  await symlink(
    join(symbolic.boundaryRoot, 'raw/fixture.json'),
    join(symbolic.boundaryRoot, 'working/escape'),
  );
  await assert.rejects(
    rotateFinalizerDriftExtractionFixture(symbolic), /boundary_|archive_manifest/u,
  );
  await cleanup(symbolic);

  const hardlinked = await rotationFixture();
  await link(
    join(hardlinked.boundaryRoot, 'working/current.json'),
    join(hardlinked.boundaryRoot, 'working/duplicate.json'),
  );
  await assert.rejects(
    rotateFinalizerDriftExtractionFixture(hardlinked), /boundary_|archive_manifest/u,
  );
  await cleanup(hardlinked);
});
