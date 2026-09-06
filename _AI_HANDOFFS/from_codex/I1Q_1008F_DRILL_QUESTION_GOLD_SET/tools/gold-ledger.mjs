import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalFileBytes, stableHash } from './canonical.mjs';
import { validateShardSemantics } from './semantic-validator.mjs';
import { CONCURRENCY, MINIMUM_RUNTIME_RESERVE_BYTES, POSTFLIGHT_INTERVAL, SCHEMA } from './constants.mjs';

export function runContract(bindings) {
  return { schema_version: 'missionmed.i1q.1008f.run-contract.v1', concurrency: CONCURRENCY, minimum_runtime_reserve_bytes: MINIMUM_RUNTIME_RESERVE_BYTES, raw_directory_required_empty: true, ...bindings };
}

export function contractHash(contract) { return stableHash(contract); }

export async function assertPreflight({ boundary, availableBytes }) {
  if (availableBytes < MINIMUM_RUNTIME_RESERVE_BYTES) throw new Error('runtime_reserve_below_10gib');
  const raw = await readdir(join(boundary, 'raw'));
  if (raw.length !== 0) throw new Error('raw_directory_not_empty');
}

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }

export async function recoverShardSet({ shardDirectory, roster, runContractHash, quarantineDirectory = null }) {
  await mkdir(shardDirectory, { recursive: true, mode: 0o700 });
  const files = (await readdir(shardDirectory)).filter((name) => /^[a-f0-9]{64}\.json$/u.test(name)).sort();
  const adopted = [];
  const quarantined = [];
  for (const file of files) {
    try {
      const shard = await readJson(join(shardDirectory, file));
      const expected = roster[shard.drill_order - 1];
      const result = expected ? validateShardSemantics(shard, { ...expected, run_contract_hash: runContractHash, drill_order: shard.drill_order }) : { valid: false };
      if (!result.valid || file !== `${shard.content_hash}.json`) quarantined.push(file);
      else adopted.push(shard);
    } catch { quarantined.push(file); }
  }
  if (quarantineDirectory && quarantined.length) {
    await mkdir(quarantineDirectory, { recursive: true, mode: 0o700 });
    for (const file of quarantined) await rename(join(shardDirectory, file), join(quarantineDirectory, `${file}.invalid`));
  }
  const valid = adopted.filter((shard) => !quarantined.includes(`${shard.content_hash}.json`)).sort((left, right) => left.drill_order - right.drill_order);
  const verifiedOrders = [...new Set(valid.map((shard) => shard.drill_order))].sort((a, b) => a - b);
  const nextDrillOrder = roster.find((row) => !verifiedOrders.includes(row.drill_order))?.drill_order ?? null;
  return { adopted: valid, quarantined, verified_orders: verifiedOrders, next_drill_order: nextDrillOrder };
}

export async function writeShardAtomic(shardDirectory, shard) {
  const bytes = canonicalFileBytes(shard);
  const finalPath = join(shardDirectory, `${shard.content_hash}.json`);
  const tempPath = `${finalPath}.tmp-${process.pid}`;
  await writeFile(tempPath, bytes, { mode: 0o600, flag: 'wx' });
  await rename(tempPath, finalPath);
  const mode = (await stat(finalPath)).mode & 0o777;
  if (mode !== 0o600) throw new Error('restricted_file_mode_invalid');
  return finalPath;
}

export function shouldPostflight(completedCount) {
  return completedCount > 0 && completedCount % POSTFLIGHT_INTERVAL === 0;
}

export function buildState({ contract, recovered, journalRoot, checkpointSequence }) {
  return {
    schema_version: SCHEMA.state,
    run_contract_hash: contractHash(contract),
    concurrency: CONCURRENCY,
    minimum_runtime_reserve_bytes: MINIMUM_RUNTIME_RESERVE_BYTES,
    raw_directory_required_empty: true,
    verified_shard_orders: recovered.verified_orders,
    advisory_cursor: recovered.next_drill_order,
    checkpoint_sequence: checkpointSequence,
    journal_root: journalRoot,
    shard_set_root: stableHash([...recovered.adopted].sort((left, right) => left.drill_order - right.drill_order).map((x) => ({ drill_order: x.drill_order, content_hash: x.content_hash }))),
  };
}
