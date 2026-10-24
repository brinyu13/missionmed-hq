import { chmod, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalFileBytes, contentAddressedEnvelope, sha256, stableHash } from './canonical.mjs';

async function exists(path) {
  try { await stat(path); return true; } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function atomicJson(path, value) {
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, canonicalFileBytes(value), { mode: 0o600, flag: 'wx' });
  await rename(temp, path);
  await chmod(path, 0o600);
}

export async function rotateSupersededRun(boundary, expectedContractHash, reasonCode, expectedShardCount = 97) {
  const stateDirectory = join(boundary, 'state');
  const shardDirectory = join(boundary, 'working', 'shards');
  const contractPath = join(stateDirectory, 'run-contract.json');
  const runStatePath = join(stateDirectory, 'run-state.json');
  const contract = JSON.parse(await readFile(contractPath, 'utf8'));
  const runState = JSON.parse(await readFile(runStatePath, 'utf8'));
  if (stableHash(contract) !== expectedContractHash) throw new Error('supersession_contract_hash_mismatch');
  if (runState.run_contract_hash !== expectedContractHash) throw new Error('supersession_state_contract_mismatch');
  const shardFiles = (await readdir(shardDirectory)).filter((name) => /^[a-f0-9]{64}\.json$/u.test(name)).sort();
  if (!Number.isSafeInteger(expectedShardCount) || expectedShardCount < 1) throw new Error('supersession_expected_shard_count_invalid');
  if (shardFiles.length !== expectedShardCount) throw new Error('supersession_shard_count_mismatch');
  const destination = join(boundary, 'quarantine', `superseded-run-${expectedContractHash}`);
  if (await exists(destination)) throw new Error('supersession_destination_exists');
  await mkdir(join(destination, 'state'), { recursive: true, mode: 0o700 });
  await rename(shardDirectory, join(destination, 'shards'));
  await mkdir(shardDirectory, { recursive: true, mode: 0o700 });
  const stateFiles = ['restricted-roster.json', 'run-contract.json', 'run-state.json', 'journal.ndjson'];
  const stateHashes = {};
  for (const name of stateFiles) {
    const source = join(stateDirectory, name);
    stateHashes[name] = sha256(await readFile(source));
    await rename(source, join(destination, 'state', name));
  }
  const receipt = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008f.superseded-run-receipt.v1',
    superseded_run_contract_hash: expectedContractHash,
    reason_code: reasonCode,
    shard_count: shardFiles.length,
    ordered_shard_file_root: stableHash(shardFiles),
    state_file_hashes: stateHashes,
    replacement_required: true,
    generation_complete_before_supersession: shardFiles.length === 97,
    protected_source_mutations: 0,
    production_mutations: 0,
  });
  await atomicJson(join(destination, 'supersession-receipt.json'), receipt);
  return { destination, receipt };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [boundary, expectedContractHash, reasonCode, expectedShardCount = '97'] = process.argv.slice(2);
  if (!boundary || !expectedContractHash || !reasonCode) throw new Error('usage: node rotate-superseded-gold-run.mjs BOUNDARY CONTRACT_HASH REASON_CODE');
  const result = await rotateSupersededRun(resolve(boundary), expectedContractHash, reasonCode, Number(expectedShardCount));
  process.stdout.write(`${JSON.stringify({ destination: result.destination, receipt_hash: result.receipt.content_hash })}\n`);
}
