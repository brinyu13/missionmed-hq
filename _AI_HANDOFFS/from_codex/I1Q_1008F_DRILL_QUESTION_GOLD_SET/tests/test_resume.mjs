import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRestrictedShard } from '../tools/build-gold-shard.mjs';
import { assertPreflight, buildState, recoverShardSet, shouldPostflight, writeShardAtomic } from '../tools/gold-ledger.mjs';
import { stableHash } from '../tools/canonical.mjs';
import { contractHash, row, transcript } from './fixtures.mjs';
import { secureDirectories } from '../tools/run-gold-extraction.mjs';
import { acquireExtractionOperationLock, releaseExtractionOperationLock } from '../../I1Q_1008E_RESTRICTED_FULL_CORPUS_EXTRACTION/tools/extraction-operation-lock.mjs';

test('resume adopts valid orphan, ignores cursor truth, and quarantines invalid orphan', async () => {
  const root = await mkdtemp(join(tmpdir(), 'i1q1008f-'));
  try {
    const shards = join(root, 'shards');
    await mkdir(shards, { mode: 0o700 });
    const value = buildRestrictedShard({ row, transcript, nodes: [], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 8_000_000, detector_options: { accepted_student_names: ['Alice', 'Bob'] } });
    await writeShardAtomic(shards, value);
    const roster = [row, { ...row, drill_order: 2, predecessor_roster_position: 2, transcript_sha256: '4'.repeat(64) }];
    let recovered = await recoverShardSet({ shardDirectory: shards, roster, runContractHash: contractHash });
    assert.deepEqual(recovered.verified_orders, [1]);
    assert.equal(recovered.next_drill_order, 2);
    await writeFile(join(shards, `${'f'.repeat(64)}.json`), '{}\n', { mode: 0o600 });
    recovered = await recoverShardSet({ shardDirectory: shards, roster, runContractHash: contractHash });
    assert.equal(recovered.quarantined.length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('preflight enforces empty raw and 10GiB reserve; postflight cadence is four', async () => {
  const root = await mkdtemp(join(tmpdir(), 'i1q1008f-'));
  try {
    await mkdir(join(root, 'raw'), { mode: 0o700 });
    await assertPreflight({ boundary: root, availableBytes: 10 * 1024 ** 3 });
    await assert.rejects(assertPreflight({ boundary: root, availableBytes: 10 * 1024 ** 3 - 1 }), /reserve/);
    await writeFile(join(root, 'raw', 'forbidden'), 'x');
    await assert.rejects(assertPreflight({ boundary: root, availableBytes: 11 * 1024 ** 3 }), /raw_directory/);
    assert.deepEqual([1, 4, 8].map(shouldPostflight), [false, true, true]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('exclusive operation lock rejects concurrent acquisition and releases deterministically', async () => {
  const root = await mkdtemp(join(tmpdir(), 'i1q1008f-lock-'));
  try {
    await secureDirectories(root);
    const worktreeRoot = new URL('../../../..', import.meta.url).pathname;
    const first = await acquireExtractionOperationLock({ boundaryRoot: root, worktreeRoot, timeoutSeconds: 0 });
    await assert.rejects(acquireExtractionOperationLock({ boundaryRoot: root, worktreeRoot, timeoutSeconds: 0 }), /operation_lock_busy/);
    await releaseExtractionOperationLock(first);
    const second = await acquireExtractionOperationLock({ boundaryRoot: root, worktreeRoot, timeoutSeconds: 0 });
    await releaseExtractionOperationLock(second);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('state shard-set root is invariant to recovered filename/adoption permutation', () => {
  const first = { drill_order: 1, content_hash: 'a'.repeat(64) };
  const second = { drill_order: 2, content_hash: 'b'.repeat(64) };
  const contract = { concurrency: 1 };
  const common = { contract, journalRoot: 'c'.repeat(64), checkpointSequence: 2 };
  const stateA = buildState({ ...common, recovered: { adopted: [first, second], verified_orders: [1, 2], next_drill_order: null } });
  const stateB = buildState({ ...common, recovered: { adopted: [second, first], verified_orders: [1, 2], next_drill_order: null } });
  assert.equal(stateA.shard_set_root, stateB.shard_set_root);
  assert.equal(stateA.shard_set_root, stableHash([first, second]));
});
