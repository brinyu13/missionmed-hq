import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmod, link, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { contentAddressedEnvelope, stableHash } from '../tools/canonical.mjs';
import { preflightRestrictedBoundary } from '../tools/boundary.mjs';
import { validateSchemaInstance } from '../tools/schema-validator.mjs';
import {
  acquireExtractionOperationLock,
  assertExtractionOperationLockHeld,
  releaseExtractionOperationLock,
  withExtractionOperationLock,
} from '../tools/extraction-operation-lock.mjs';
import {
  buildAndValidateSpecialistFinalization,
  dryRun,
  exclusiveWriteForTest,
  recoverInterruptedPublicationsForTest,
  REQUIRED_SPECIALIST_ROLES,
  syntheticInputs,
  validatePublishedSpecialistFinalization,
  validateSpecialistRoleBatchInputs,
} from '../tools/finalize-specialist-role-batches.mjs';
import {
  buildSpecialistReviewReceipt,
  validateSpecialistReviewReceipt,
} from '../tools/specialist-review.mjs';

const TEST_ROOT = dirname(fileURLToPath(import.meta.url));
const RECEIPT_SCHEMA = JSON.parse(await readFile(
  resolve(TEST_ROOT, '../schemas/specialist-review-receipt.schema.json'), 'utf8',
));
const LEDGER_SCHEMA = JSON.parse(await readFile(
  resolve(TEST_ROOT, '../schemas/artifact-processing-ledger.schema.json'), 'utf8',
));

function rehashBatch(batch) {
  const payload = structuredClone(batch);
  delete payload.content_hash;
  return contentAddressedEnvelope(payload);
}

function rehashEnvelope(value) {
  const payload = structuredClone(value);
  delete payload.content_hash;
  return contentAddressedEnvelope(payload);
}

function protectedRosterRoot(rows) {
  return stableHash(rows.map((row) => ({
    source_alias: row.source_alias,
    transcript_artifact_alias: row.transcript_artifact_alias,
    transcript_hash: row.transcript_hash,
    nodes_artifact_alias: row.nodes_artifact_alias,
    nodes_hash: row.nodes_hash,
  })));
}

function rehashAuthorityChain(inputs) {
  inputs.authority.acquisitionState = rehashEnvelope(inputs.authority.acquisitionState);
  inputs.authority.safeRoster = rehashEnvelope(inputs.authority.safeRoster);
  inputs.authority.extractionState.roster_root = protectedRosterRoot(
    inputs.authority.acquisitionState.roster,
  );
  inputs.authority.extractionState = rehashEnvelope(inputs.authority.extractionState);
  inputs.authority.extractionReceipt.roster_root =
    inputs.authority.extractionState.roster_root;
  inputs.authority.extractionReceipt.extraction_state_hash =
    inputs.authority.extractionState.content_hash;
  inputs.authority.extractionReceipt = rehashEnvelope(inputs.authority.extractionReceipt);
}

const RESTRICTED_DIRECTORIES = [
  'raw', 'working', 'audit', 'quarantine', 'tmp', 'keys', 'state', 'reviews',
];

async function boundaryFixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'i1q-specialist-finalizer-')));
  await chmod(root, 0o700);
  for (const name of RESTRICTED_DIRECTORIES) {
    await mkdir(join(root, name), { mode: 0o700 });
    await chmod(join(root, name), 0o700);
  }
  return {
    boundaryRoot: root,
    worktreeRoot: join(dirname(root), `${basename(root)}-worktree`),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

const OUTPUT_PATH = 'reviews/submissions/artifact_fixture_output_0001.json';
const OUTPUT_VALUE = contentAddressedEnvelope({
  schema_version: 'missionmed.fixture.specialist_output.v1',
  value: 'aggregate-only-fixture',
});

test('four role batches join exactly 97 packets into 388 reviews and 194 cells', () => {
  const finalized = buildAndValidateSpecialistFinalization(
    syntheticInputs(), RECEIPT_SCHEMA, LEDGER_SCHEMA,
  );
  assert.equal(finalized.orderedPackets.length, 97);
  assert.equal(finalized.submissions.length, 97);
  assert.equal(finalized.receipts.length, 97);
  assert.equal(finalized.completion.specialist_role_review_count, 388);
  assert.equal(finalized.completion.specialist_verification_cell_count, 194);
  assert.equal(finalized.completion.no_release_or_final_approval_authority, true);
  assert.deepEqual(finalized.completion.disposition_histogram, { VERIFIED_NO_BLOCKER: 97 });
});

test('forged and missing role batches fail before output construction', () => {
  const missing = syntheticInputs();
  delete missing.batches.ENGINEERING;
  assert.throws(
    () => validateSpecialistRoleBatchInputs(missing, LEDGER_SCHEMA),
    /batch_coverage_rejected/u,
  );

  const forged = syntheticInputs();
  forged.batches.OSLER.reviewer_instance_id = 'reviewer_forged_identity';
  assert.throws(
    () => validateSpecialistRoleBatchInputs(forged, LEDGER_SCHEMA),
    /batch_authority_rejected/u,
  );
});

test('duplicate artifact coverage and mismatched packet roots are rejected', () => {
  const duplicate = syntheticInputs();
  const batch = structuredClone(duplicate.batches.ASSESSMENT_SCIENCE);
  batch.artifact_reviews[1] = structuredClone(batch.artifact_reviews[0]);
  duplicate.batches.ASSESSMENT_SCIENCE = rehashBatch(batch);
  assert.throws(
    () => validateSpecialistRoleBatchInputs(duplicate, LEDGER_SCHEMA),
    /batch_content_rejected/u,
  );

  const mismatch = syntheticInputs();
  const mismatchedBatch = structuredClone(mismatch.batches.TURING);
  mismatchedBatch.artifact_reviews[0].review_packet_root = '9'.repeat(64);
  mismatch.batches.TURING = rehashBatch(mismatchedBatch);
  assert.throws(
    () => validateSpecialistRoleBatchInputs(mismatch, LEDGER_SCHEMA),
    /batch_coverage_rejected/u,
  );
});

test('reviewers must be distinct and dispositions must be final', () => {
  const repeatedReviewer = syntheticInputs();
  const engineering = structuredClone(repeatedReviewer.batches.ENGINEERING);
  engineering.reviewer_instance_id = repeatedReviewer.batches.TURING.reviewer_instance_id;
  repeatedReviewer.batches.ENGINEERING = rehashBatch(engineering);
  assert.throws(
    () => validateSpecialistRoleBatchInputs(repeatedReviewer, LEDGER_SCHEMA),
    /reviewer_identity_rejected/u,
  );

  const pending = syntheticInputs();
  const osler = structuredClone(pending.batches.OSLER);
  osler.artifact_reviews[0].disposition = 'PENDING';
  pending.batches.OSLER = rehashBatch(osler);
  assert.throws(
    () => validateSpecialistRoleBatchInputs(pending, LEDGER_SCHEMA),
    /batch_content_rejected/u,
  );
});

test('authoritative state, receipt, ledger, and roster reject a self-consistent cohort substitution', () => {
  const substituted = syntheticInputs();
  const packet = structuredClone(substituted.packets[0]);
  packet.source_alias = 'source_substitute_0001';
  packet.artifact_alias = 'artifact_substitute_0001';
  substituted.packets[0] = rehashEnvelope(packet);
  for (const role of REQUIRED_SPECIALIST_ROLES) {
    const batch = structuredClone(substituted.batches[role]);
    batch.artifact_reviews[0].artifact_alias = substituted.packets[0].artifact_alias;
    batch.artifact_reviews[0].review_packet_root = substituted.packets[0].content_hash;
    substituted.batches[role] = rehashBatch(batch);
  }
  assert.throws(
    () => validateSpecialistRoleBatchInputs(substituted, LEDGER_SCHEMA),
    /authority_binding_rejected/u,
  );
});

test('authoritative bindings reject state, receipt, safe-ledger, and roster drift', () => {
  for (const mutate of [
    (inputs) => {
      inputs.authority.acquisitionState.roster[0].source_alias =
        'source_substitute_acquisition_0001';
      inputs.authority.acquisitionState = rehashEnvelope(inputs.authority.acquisitionState);
    },
    (inputs) => {
      inputs.authority.extractionState.artifacts[0].processing_receipt_hash = '9'.repeat(64);
      inputs.authority.extractionState = rehashEnvelope(inputs.authority.extractionState);
    },
    (inputs) => {
      inputs.authority.extractionReceipt.transcript_artifact_count = 96;
      inputs.authority.extractionReceipt = rehashEnvelope(inputs.authority.extractionReceipt);
    },
    (inputs) => {
      inputs.authority.safeLedger.artifacts[0].source_alias = 'source_substitute_ledger_0001';
      inputs.authority.safeLedger = rehashEnvelope(inputs.authority.safeLedger);
    },
    (inputs) => {
      inputs.authority.safeRoster.rows[0].transcript_artifact_alias =
        'artifact_substitute_roster_0001';
      inputs.authority.safeRoster = rehashEnvelope(inputs.authority.safeRoster);
    },
  ]) {
    const inputs = syntheticInputs();
    mutate(inputs);
    assert.throws(
      () => validateSpecialistRoleBatchInputs(inputs, LEDGER_SCHEMA),
      /authority_binding_rejected/u,
    );
  }
});

test('all 105 roster rows enforce source/artifact uniqueness and actual availability totals', () => {
  const reorderedSafeRoster = syntheticInputs();
  reorderedSafeRoster.authority.safeRoster.rows.reverse();
  reorderedSafeRoster.authority.safeRoster = rehashEnvelope(
    reorderedSafeRoster.authority.safeRoster,
  );
  assert.doesNotThrow(
    () => validateSpecialistRoleBatchInputs(reorderedSafeRoster, LEDGER_SCHEMA),
  );

  const duplicateSource = syntheticInputs();
  duplicateSource.authority.acquisitionState.roster[104].source_alias =
    duplicateSource.authority.acquisitionState.roster[103].source_alias;
  duplicateSource.authority.safeRoster.rows[104].source_alias =
    duplicateSource.authority.safeRoster.rows[103].source_alias;
  rehashAuthorityChain(duplicateSource);
  assert.throws(
    () => validateSpecialistRoleBatchInputs(duplicateSource, LEDGER_SCHEMA),
    /authority_binding_rejected/u,
  );

  const falseNodesTotal = syntheticInputs();
  falseNodesTotal.authority.acquisitionState.roster[0].nodes_availability = 'NOT_AVAILABLE';
  falseNodesTotal.authority.acquisitionState.roster[0].nodes_hash = null;
  falseNodesTotal.authority.safeRoster.rows[0].nodes_availability = 'NOT_AVAILABLE';
  falseNodesTotal.authority.safeRoster.rows[0].nodes_artifact_alias = null;
  falseNodesTotal.authority.safeRoster.rows[0].nodes_hash = null;
  rehashAuthorityChain(falseNodesTotal);
  assert.throws(
    () => validateSpecialistRoleBatchInputs(falseNodesTotal, LEDGER_SCHEMA),
    /authority_binding_rejected/u,
  );
});

test('state, extraction receipt, and ledger completeness must agree', () => {
  const conflict = syntheticInputs();
  conflict.authority.extractionReceipt.extraction_complete = true;
  conflict.authority.extractionReceipt = rehashEnvelope(conflict.authority.extractionReceipt);
  assert.throws(
    () => validateSpecialistRoleBatchInputs(conflict, LEDGER_SCHEMA),
    /authority_binding_rejected/u,
  );
});

test('generic forged receipt cannot substitute for finalizer authority or aggregate roots', () => {
  const inputs = syntheticInputs();
  const finalized = buildAndValidateSpecialistFinalization(
    inputs, RECEIPT_SCHEMA, LEDGER_SCHEMA,
  );
  const original = finalized.receipts[0];
  const forgedAuthority = {
    ...original.finalizer_authority_binding,
    finalizer_contract_root: '9'.repeat(64),
  };
  const forged = buildSpecialistReviewReceipt(
    finalized.orderedPackets[0],
    original.role_reviews.map((review) => ({
      specialist_role: review.specialist_role,
      reviewer_instance_id: review.reviewer_instance_id,
      findings: review.findings,
      disposition: review.disposition,
    })),
    forgedAuthority,
  );
  assert.equal(validateSchemaInstance(RECEIPT_SCHEMA, forged).valid, true);
  assert.equal(validateSpecialistReviewReceipt(
    forged, finalized.orderedPackets[0], { requireFinal: true },
  ).valid, false);

  const forgedReceipts = [...finalized.receipts];
  forgedReceipts[0] = forged;
  const forgedCompletionPayload = {
    ...finalized.completion,
    finalizer_contract_root: forgedAuthority.finalizer_contract_root,
    receipt_set_root: stableHash(forgedReceipts.map((receipt) => ({
      artifact_alias: receipt.artifact_alias,
      receipt_root: receipt.content_hash,
    }))),
  };
  delete forgedCompletionPayload.content_hash;
  assert.throws(() => validatePublishedSpecialistFinalization({
    packets: finalized.orderedPackets,
    batches: inputs.batches,
    submissions: finalized.submissions,
    receipts: forgedReceipts,
    completion: contentAddressedEnvelope(forgedCompletionPayload),
  }, RECEIPT_SCHEMA), /receipt_schema_rejected/u);
});

test('legacy live assembler is disabled and cannot race or overwrite finalizer outputs', () => {
  const script = resolve(TEST_ROOT, '../tools/specialist-review.mjs');
  const attemptedLive = spawnSync(process.execPath, [
    script, '--artifact-alias', 'artifact_fixture_0001',
  ], { encoding: 'utf8' });
  assert.notEqual(attemptedLive.status, 0);
  assert.match(attemptedLive.stderr, /specialist_review_rejected/u);
});

test('finding presence and final disposition are equivalent in both directions', () => {
  const finding = {
    finding_code: 'MEDICAL_REVIEW_FINDING',
    severity: 'MEDIUM',
    disposition: 'QUARANTINE',
    evidence_root: '8'.repeat(64),
  };
  const hiddenFinding = syntheticInputs();
  let osler = structuredClone(hiddenFinding.batches.OSLER);
  osler.artifact_reviews[0].findings = [finding];
  hiddenFinding.batches.OSLER = rehashBatch(osler);
  assert.throws(
    () => validateSpecialistRoleBatchInputs(hiddenFinding, LEDGER_SCHEMA),
    /batch_content_rejected/u,
  );

  const falseFindingClaim = syntheticInputs();
  osler = structuredClone(falseFindingClaim.batches.OSLER);
  osler.artifact_reviews[0].disposition = 'VERIFIED_WITH_FINDINGS';
  falseFindingClaim.batches.OSLER = rehashBatch(osler);
  assert.throws(
    () => validateSpecialistRoleBatchInputs(falseFindingClaim, LEDGER_SCHEMA),
    /batch_content_rejected/u,
  );

  const valid = syntheticInputs();
  osler = structuredClone(valid.batches.OSLER);
  osler.artifact_reviews[0].findings = [finding];
  osler.artifact_reviews[0].disposition = 'VERIFIED_WITH_FINDINGS';
  valid.batches.OSLER = rehashBatch(osler);
  const finalized = buildAndValidateSpecialistFinalization(
    valid, RECEIPT_SCHEMA, LEDGER_SCHEMA,
  );
  assert.deepEqual(finalized.completion.disposition_histogram, {
    VERIFIED_NO_BLOCKER: 96,
    VERIFIED_WITH_FINDINGS: 1,
  });
});

test('durable no-clobber publication resumes after every write, fsync, and publication crash point', async () => {
  const stages = [
    'AFTER_TEMP_CREATE',
    'AFTER_TEMP_WRITE',
    'AFTER_TEMP_FILE_SYNC',
    'AFTER_TEMP_DIRECTORY_SYNC',
    'AFTER_PUBLICATION',
    'AFTER_PUBLICATION_SYNC',
    'AFTER_TEMP_UNLINK',
    'AFTER_CLEANUP_SYNC',
  ];
  for (const stage of stages) {
    const fixture = await boundaryFixture();
    try {
      await assert.rejects(
        exclusiveWriteForTest(OUTPUT_PATH, OUTPUT_VALUE, {
          ...fixture,
          faultInjector: (observed) => {
            if (observed === stage) throw new Error('synthetic_crash');
          },
        }),
        /boundary_rejected/u,
      );
      assert.equal(
        await recoverInterruptedPublicationsForTest(fixture.boundaryRoot),
        'RECOVERY_COMPLETE',
      );
      await preflightRestrictedBoundary(fixture);
      const result = await exclusiveWriteForTest(OUTPUT_PATH, OUTPUT_VALUE, fixture);
      assert.ok(['CREATED', 'ALREADY_PRESENT_IDENTICAL'].includes(result));
      const path = join(fixture.boundaryRoot, OUTPUT_PATH);
      assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), OUTPUT_VALUE);
      const stat = await lstat(path);
      assert.equal(stat.nlink, 1);
      assert.equal(stat.mode & 0o7777, 0o600);
    } finally {
      await fixture.cleanup();
    }
  }
});

test('durable publication is idempotent and rejects collision, corruption, weak mode, symlink, and hardlink', async () => {
  const fixture = await boundaryFixture();
  try {
    assert.equal(await exclusiveWriteForTest(OUTPUT_PATH, OUTPUT_VALUE, fixture), 'CREATED');
    assert.equal(
      await exclusiveWriteForTest(OUTPUT_PATH, OUTPUT_VALUE, fixture),
      'ALREADY_PRESENT_IDENTICAL',
    );
    await assert.rejects(
      exclusiveWriteForTest(OUTPUT_PATH, { ...OUTPUT_VALUE, value: 'collision' }, fixture),
      /finalization_output_collision/u,
    );
  } finally {
    await fixture.cleanup();
  }

  for (const setup of [
    async (path) => writeFile(path, '{"corrupt":', { mode: 0o600 }),
    async (path) => writeFile(path, '{}\n', { mode: 0o644 }),
    async (path, root) => {
      const anchor = join(root, 'audit', 'symlink-anchor.json');
      await writeFile(anchor, '{}\n', { mode: 0o600 });
      await symlink(anchor, path);
    },
    async (path, root) => {
      const anchor = join(root, 'audit', 'hardlink-anchor.json');
      await writeFile(anchor, '{}\n', { mode: 0o600 });
      await link(anchor, path);
    },
  ]) {
    const unsafe = await boundaryFixture();
    try {
      const parent = dirname(join(unsafe.boundaryRoot, OUTPUT_PATH));
      await mkdir(parent, { recursive: true, mode: 0o700 });
      await chmod(join(unsafe.boundaryRoot, 'reviews'), 0o700);
      await chmod(parent, 0o700);
      const path = join(unsafe.boundaryRoot, OUTPUT_PATH);
      await setup(path, unsafe.boundaryRoot);
      await assert.rejects(
        exclusiveWriteForTest(OUTPUT_PATH, OUTPUT_VALUE, unsafe),
        /(boundary_rejected|finalization_output_collision)/u,
      );
    } finally {
      await unsafe.cleanup();
    }
  }
});

test('shared extraction-operation lock rejects contention and releases after success or failure', async () => {
  const fixture = await boundaryFixture();
  const options = { ...fixture, timeoutSeconds: 0 };
  try {
    const held = await acquireExtractionOperationLock(options);
    assert.equal(assertExtractionOperationLockHeld(held), true);
    await assert.rejects(
      acquireExtractionOperationLock(options),
      /operation_lock_busy/u,
    );
    await releaseExtractionOperationLock(held);

    await assert.rejects(
      withExtractionOperationLock(options, async (lock) => {
        assert.equal(assertExtractionOperationLockHeld(lock), true);
        throw new Error('synthetic_finalizer_failure');
      }),
      /synthetic_finalizer_failure/u,
    );
    const afterFailure = await acquireExtractionOperationLock(options);
    assert.equal(assertExtractionOperationLockHeld(afterFailure), true);
    await releaseExtractionOperationLock(afterFailure);
  } finally {
    await fixture.cleanup();
  }
});

test('shared extraction-operation lock loss is detected fail-closed and kernel cleanup permits recovery', async () => {
  const fixture = await boundaryFixture();
  const options = { ...fixture, timeoutSeconds: 0 };
  try {
    const held = await acquireExtractionOperationLock(options);
    held.child.kill('SIGKILL');
    const loss = await held.lost;
    assert.match(loss.message, /operation_lock_lost/u);
    assert.throws(() => assertExtractionOperationLockHeld(held), /operation_lock_lost/u);
    await assert.rejects(releaseExtractionOperationLock(held), /operation_lock_lost/u);

    await assert.rejects(
      withExtractionOperationLock(options, async (lock) => {
        lock.child.kill('SIGKILL');
        await lock.lost;
      }),
      /operation_lock_lost/u,
    );
    const recovered = await acquireExtractionOperationLock(options);
    assert.equal(assertExtractionOperationLockHeld(recovered), true);
    await releaseExtractionOperationLock(recovered);
  } finally {
    await fixture.cleanup();
  }
});

test('shared lock serializes stale and fresh finalizer views without stale publication', async () => {
  const fixture = await boundaryFixture();
  const options = { ...fixture, timeoutSeconds: 0 };
  const authorityPath = join(fixture.boundaryRoot, 'state', 'authority-epoch.json');
  const publicationPath = join(fixture.boundaryRoot, 'reviews', 'fresh-epoch.json');
  const readAuthority = async () => JSON.parse(await readFile(authorityPath, 'utf8'));
  const writeAuthority = async (epoch) => writeFile(
    authorityPath,
    `${JSON.stringify({ epoch })}\n`,
    { mode: 0o600 },
  );
  const guardedPublication = async (snapshot) => withExtractionOperationLock(
    options,
    async (lock) => {
      assert.equal(assertExtractionOperationLockHeld(lock), true);
      const current = await readAuthority();
      if (current.epoch !== snapshot.epoch) throw new Error('stale_authority_snapshot');
      await writeFile(
        publicationPath,
        `${JSON.stringify({ finalized_epoch: current.epoch })}\n`,
        { mode: 0o600, flag: 'wx' },
      );
      assert.equal(assertExtractionOperationLockHeld(lock), true);
    },
  );
  try {
    await writeAuthority(1);
    const staleSnapshot = await readAuthority();

    await withExtractionOperationLock(options, async (lock) => {
      assert.equal(assertExtractionOperationLockHeld(lock), true);
      await writeAuthority(2);
    });
    await assert.rejects(guardedPublication(staleSnapshot), /stale_authority_snapshot/u);
    await assert.rejects(readFile(publicationPath), /ENOENT/u);

    const freshSnapshot = await readAuthority();
    const held = await acquireExtractionOperationLock(options);
    await assert.rejects(guardedPublication(freshSnapshot), /operation_lock_busy/u);
    await releaseExtractionOperationLock(held);

    await guardedPublication(freshSnapshot);
    assert.deepEqual(JSON.parse(await readFile(publicationPath, 'utf8')), {
      finalized_epoch: 2,
    });
  } finally {
    await fixture.cleanup();
  }
});

test('finalizer dry run has exact zero-I/O contract', async () => {
  const result = await dryRun();
  assert.equal(result.result, 'pass');
  assert.equal(result.packet_count, 97);
  assert.equal(result.role_batch_count, REQUIRED_SPECIALIST_ROLES.length);
  assert.equal(result.protected_reads, 0);
  assert.equal(result.protected_writes, 0);
  assert.equal(result.network_requests, 0);
});
