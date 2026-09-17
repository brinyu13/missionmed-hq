import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalFileBytes, sha256, stableHash } from './canonical.mjs';
import { CONCURRENCY, MINIMUM_RUNTIME_RESERVE_BYTES, RUNTIME_COMPARISON } from './constants.mjs';

const PREDECESSOR = 'c8397c9c0eba9a6cffec16b926ec7e61a869fa5f';
const DECISION_HASH = '84f864b36991473b70f0c315fddf8421d1312ba33352248947dfce1f1c5943fe';
const COVERAGE_ROOT = 'dc878857d099276b4ceb653c44426addc38a061a541eade8868b08495dca28ec';
const PROCESSING_LEDGER_ROOT = '6b1d50a01856ef69a1634ee5b6abd44b4c77e5080e6001a46bdbe327337c232f';
const HERE = dirname(fileURLToPath(import.meta.url));
const HANDOFF = dirname(HERE);

async function hashFile(path) { return sha256(await readFile(path)); }

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, canonicalFileBytes(value), { mode: 0o600, flag: 'wx' });
  await rename(temp, path);
  await chmod(path, 0o600);
}

export async function buildRestrictedInputs({ safeRosterPath, sourceBoundary, targetBoundary }) {
  const safeRoster = JSON.parse(await readFile(safeRosterPath, 'utf8'));
  const paired = safeRoster.rows.filter((row) => row.transcript_availability === 'AVAILABLE' && row.nodes_availability === 'AVAILABLE' && row.predecessor_hash_match === 'MATCH').sort((a, b) => a.roster_position - b.roster_position);
  if (paired.length !== 97) throw new Error('validated_pair_count_not_97');
  const roster = [];
  for (let index = 0; index < paired.length; index += 1) {
    const source = paired[index];
    const transcriptPath = join(sourceBoundary, 'raw', `${source.transcript_artifact_alias}.json`);
    const nodesPath = join(sourceBoundary, 'raw', `${source.nodes_artifact_alias}.json`);
    if (await hashFile(transcriptPath) !== source.transcript_hash) throw new Error('transcript_hash_mismatch');
    if (await hashFile(nodesPath) !== source.nodes_hash) throw new Error('nodes_hash_mismatch');
    roster.push({ drill_order: index + 1, predecessor_roster_position: source.roster_position, source_alias: source.source_alias, transcript_path: transcriptPath, nodes_path: nodesPath, transcript_sha256: source.transcript_hash, nodes_sha256: source.nodes_hash });
  }
  const toolNames = ['canonical.mjs', 'constants.mjs', 'source-reader.mjs', 'gold-detector.mjs', 'build-gold-shard.mjs', 'semantic-validator.mjs', 'gold-ledger.mjs', 'safe-projection.mjs', 'run-gold-extraction.mjs', 'build-restricted-inputs.mjs'];
  const schemaNames = ['restricted-drill-gold-set.schema.json', 'restricted-run-state.schema.json', 'drill-processing-ledger-safe.schema.json'];
  const toolHashes = Object.fromEntries(await Promise.all(toolNames.map(async (name) => [name, await hashFile(join(HERE, name))])));
  const predecessorToolRoot = resolve(HANDOFF, '..', 'I1Q_1008E_RESTRICTED_FULL_CORPUS_EXTRACTION', 'tools');
  const predecessorHelperNames = ['canonical.mjs', 'boundary.mjs', 'parsers.mjs', 'schema-validator.mjs', 'extraction-operation-lock.mjs'];
  const predecessorHelperHashes = Object.fromEntries(await Promise.all(predecessorHelperNames.map(async (name) => [name, await hashFile(join(predecessorToolRoot, name))])));
  const schemaHashes = Object.fromEntries(await Promise.all(schemaNames.map(async (name) => [name, await hashFile(join(HANDOFF, 'schemas', name))])));
  const orderedRosterRoot = stableHash(roster.map((row) => ({ drill_order: row.drill_order, predecessor_roster_position: row.predecessor_roster_position, source_alias: row.source_alias, transcript_sha256: row.transcript_sha256, nodes_sha256: row.nodes_sha256 })));
  const contract = {
    schema_version: 'missionmed.i1q.1008f.run-contract.v1',
    decision_sha256: DECISION_HASH,
    predecessor_commit: PREDECESSOR,
    predecessor_coverage_root: COVERAGE_ROOT,
    predecessor_processing_ledger_root: PROCESSING_LEDGER_ROOT,
    ordered_roster_root: orderedRosterRoot,
    runtime_comparison_map_hash: stableHash(RUNTIME_COMPARISON),
    tool_hashes: toolHashes,
    predecessor_helper_hashes: predecessorHelperHashes,
    schema_hashes: schemaHashes,
    concurrency: CONCURRENCY,
    minimum_runtime_reserve_bytes: MINIMUM_RUNTIME_RESERVE_BYTES,
    raw_directory_required_empty: true,
  };
  const rosterPath = join(targetBoundary, 'state', 'restricted-roster.json');
  const contractPath = join(targetBoundary, 'state', 'run-contract.json');
  await atomicJson(rosterPath, roster);
  await atomicJson(contractPath, contract);
  return { roster_path: rosterPath, contract_path: contractPath, ordered_roster_root: orderedRosterRoot, run_contract_hash: stableHash(contract) };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [safeRosterPath, sourceBoundary, targetBoundary] = process.argv.slice(2);
  if (!safeRosterPath || !sourceBoundary || !targetBoundary) throw new Error('usage: node build-restricted-inputs.mjs SAFE_ROSTER.json SOURCE_BOUNDARY TARGET_BOUNDARY');
  const result = await buildRestrictedInputs({ safeRosterPath: resolve(safeRosterPath), sourceBoundary: resolve(sourceBoundary), targetBoundary: resolve(targetBoundary) });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
