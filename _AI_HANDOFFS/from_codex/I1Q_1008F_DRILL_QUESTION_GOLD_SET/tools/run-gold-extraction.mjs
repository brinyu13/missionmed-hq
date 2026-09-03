import { appendFile, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRestrictedShard } from './build-gold-shard.mjs';
import { canonicalFileBytes, stableHash } from './canonical.mjs';
import { deriveAcceptedStudentNames } from './gold-detector.mjs';
import { assertPreflight, buildState, contractHash, recoverShardSet, shouldPostflight, writeShardAtomic } from './gold-ledger.mjs';
import { streamSourcePairs } from './source-reader.mjs';
import { finalizeShardEngineeringValidation, validateShardSemantics } from './semantic-validator.mjs';
import { withExtractionOperationLock } from '../../I1Q_1008E_RESTRICTED_FULL_CORPUS_EXTRACTION/tools/extraction-operation-lock.mjs';

const WORKTREE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

async function availableBytes(path) {
  const { statfs } = await import('node:fs/promises');
  const info = await statfs(path);
  return Number(info.bavail) * Number(info.bsize);
}

export async function secureDirectories(boundary) {
  await mkdir(boundary, { recursive: true, mode: 0o700 });
  await chmod(boundary, 0o700);
  for (const relative of ['raw', 'working', 'state', 'audit', 'quarantine', 'tmp', 'keys', 'reviews']) {
    const path = join(boundary, relative);
    await mkdir(path, { recursive: true, mode: 0o700 });
    await chmod(path, 0o700);
  }
  const shards = join(boundary, 'working', 'shards');
  await mkdir(shards, { recursive: true, mode: 0o700 });
  await chmod(shards, 0o700);
}

async function runHeld({ boundary, roster, contract, postflight = null }) {
  if (!Array.isArray(roster) || roster.length !== 97 || roster.some((row, index) => row.drill_order !== index + 1)) throw new Error('ordered_97_roster_required');
  if (contract.concurrency !== 1) throw new Error('concurrency_must_equal_one');
  await assertPreflight({ boundary, availableBytes: await availableBytes(boundary) });
  const hash = contractHash(contract);
  const shardDirectory = join(boundary, 'working', 'shards');
  const quarantineDirectory = join(boundary, 'quarantine');
  let recovered = await recoverShardSet({ shardDirectory, roster, runContractHash: hash, quarantineDirectory });
  const journalPath = join(boundary, 'state', 'journal.ndjson');
  let completed = recovered.adopted.length;
  let processedThisRun = 0;
  for await (const pair of streamSourcePairs(roster)) {
    if (recovered.verified_orders.includes(pair.row.drill_order)) continue;
    const times = pair.transcript.flatMap((record) => [record.start_us, record.end_us]).filter(Number.isSafeInteger);
    const drillStart = times.length ? Math.min(...times) : 0;
    const drillEnd = times.length ? Math.max(...times) : 0;
    const detectorOptions = {
      instructor_aliases: ['Dr. J', 'Dr J'],
      accepted_student_names: deriveAcceptedStudentNames(pair.transcript),
    };
    const draft = buildRestrictedShard({ row: pair.row, transcript: pair.transcript, nodes: pair.nodes, run_contract_hash: hash, drill_start_us: drillStart, drill_end_us: drillEnd, detector_options: detectorOptions });
    const draftValidation = validateShardSemantics(draft, { ...pair.row, run_contract_hash: hash });
    if (!draftValidation.valid) throw new Error(`shard_semantic_validation_failed:drill_order=${pair.row.drill_order}:${draftValidation.errors.join(',')}`);
    const shard = finalizeShardEngineeringValidation(draft);
    const validation = validateShardSemantics(shard, { ...pair.row, run_contract_hash: hash });
    if (!validation.valid) throw new Error(`shard_semantic_validation_failed:drill_order=${pair.row.drill_order}:${validation.errors.join(',')}`);
    await writeShardAtomic(shardDirectory, shard);
    completed += 1;
    processedThisRun += 1;
    const event = { checkpoint_sequence: completed, drill_order: pair.row.drill_order, shard_content_hash: shard.content_hash };
    await appendFile(journalPath, canonicalFileBytes(event), { mode: 0o600 });
    recovered = await recoverShardSet({ shardDirectory, roster, runContractHash: hash, quarantineDirectory });
    const journalBytes = await readFile(journalPath);
    const state = buildState({ contract, recovered, journalRoot: stableHash(journalBytes.toString('utf8').split('\n').filter(Boolean)), checkpointSequence: completed });
    await writeFile(join(boundary, 'state', 'run-state.json'), canonicalFileBytes(state), { mode: 0o600 });
    if (shouldPostflight(completed)) {
      await assertPreflight({ boundary, availableBytes: await availableBytes(boundary) });
      if (postflight) await postflight({ completed, state });
    }
  }
  if (processedThisRun > 0 && !shouldPostflight(completed)) {
    await assertPreflight({ boundary, availableBytes: await availableBytes(boundary) });
    if (postflight) await postflight({ completed, final: true });
  }
  return recoverShardSet({ shardDirectory, roster, runContractHash: hash, quarantineDirectory });
}

export async function runGoldExtraction(options) {
  await secureDirectories(options.boundary);
  return withExtractionOperationLock({ boundaryRoot: options.boundary, worktreeRoot: WORKTREE_ROOT, timeoutSeconds: 0 }, () => runHeld(options));
}

const self = resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (self) {
  const [rosterPath, contractPath, boundary] = process.argv.slice(2);
  if (!rosterPath || !contractPath || !boundary) throw new Error('usage: node run-gold-extraction.mjs ROSTER.json CONTRACT.json BOUNDARY');
  const roster = JSON.parse(await readFile(resolve(rosterPath), 'utf8'));
  const contract = JSON.parse(await readFile(resolve(contractPath), 'utf8'));
  const result = await runGoldExtraction({ boundary: resolve(boundary), roster, contract });
  process.stdout.write(`${JSON.stringify({ completed: result.adopted.length, next_drill_order: result.next_drill_order })}\n`);
}
