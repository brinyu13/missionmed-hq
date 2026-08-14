#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, open, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentAddressedEnvelope, stableHash } from './canonical.mjs';
import { PARSER_VERSION, PASS_DEFINITIONS } from './constants.mjs';
import { DEFAULT_RESTRICTED_BOUNDARY } from './boundary.mjs';
import {
  currentFinalizerDriftRotationTcbHashes,
  currentRunContractManifest,
  validateFinalizerDriftRotationDecision,
} from './rotate-superseded-extraction.mjs';

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BOUNDARY_ROOT = DEFAULT_RESTRICTED_BOUNDARY;
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const MODE_MASK = 0o7777;
const OLD_FINALIZER_SHA256 =
  '6177e3cf0b3208ea2f435a83eb0819eae7ec5b9e9c59993ac9c208b2060f15c2';
const OLD_RUN_CONTRACT_ROOT =
  '01e5c2d8db992e47ca08aab3652dd6e753d20c973cfad8874492f941ccdf34ab';
const FINALIZER_PATH = 'tools/finalize-specialist-role-batches.mjs';
const AUTHORITY_TICKET_SHA256 =
  '99a5c0d9f13c77fbcd20fbd57a6e1186fdf467f35e3657269fe99b23efeddb03';
const SCHEMA = 'missionmed.i1q1008e.finalizer_drift_rotation_decision.v1';
const ARCHIVE_SCOPE = [
  'WORKING_TREE', 'REVIEWS_TREE', 'EXTRACTION_STATE', 'EXTRACTION_JOURNAL',
  'EXTRACTION_RECEIPT', 'PROCESSING_RECEIPTS', 'RETRIEVAL_RECEIPTS',
  'ARTIFACT_FAILURES',
];

function secureStat(stat, kind) {
  if (!stat || stat.isSymbolicLink() || stat.uid !== process.getuid()) {
    throw new Error('decision_inventory_rejected');
  }
  if (kind === 'directory') {
    if (!stat.isDirectory() || (stat.mode & MODE_MASK) !== DIRECTORY_MODE) {
      throw new Error('decision_inventory_rejected');
    }
    return;
  }
  if (!stat.isFile() || (stat.mode & MODE_MASK) !== FILE_MODE || stat.nlink !== 1) {
    throw new Error('decision_inventory_rejected');
  }
}

async function hashFile(path) {
  const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    secureStat(before, 'file');
    const digest = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let position = 0;
    while (position < before.size) {
      const { bytesRead } = await handle.read(
        buffer, 0, Math.min(buffer.length, before.size - position), position,
      );
      if (bytesRead <= 0) throw new Error('decision_inventory_rejected');
      digest.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    const after = await handle.stat();
    secureStat(after, 'file');
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size) {
      throw new Error('decision_inventory_rejected');
    }
    return { sha256: digest.digest('hex'), size: before.size };
  } finally {
    await handle.close();
  }
}

async function inventory(relativePath) {
  const root = resolve(BOUNDARY_ROOT, relativePath);
  const relation = relative(BOUNDARY_ROOT, root);
  if (relation === '..' || relation.startsWith(`..${sep}`)) {
    throw new Error('decision_inventory_rejected');
  }
  const entries = [];
  async function visit(path, relativeEntry) {
    const stat = await lstat(path);
    if (stat.isDirectory()) {
      secureStat(stat, 'directory');
      if (await realpath(path) !== path) throw new Error('decision_inventory_rejected');
      entries.push({ relative_path: relativeEntry, kind: 'directory', mode: DIRECTORY_MODE });
      for (const child of (await readdir(path)).sort()) {
        await visit(join(path, child), relativeEntry ? `${relativeEntry}/${child}` : child);
      }
      return;
    }
    secureStat(stat, 'file');
    const hashed = await hashFile(path);
    entries.push({
      relative_path: relativeEntry,
      kind: 'file',
      mode: FILE_MODE,
      size: hashed.size,
      sha256: hashed.sha256,
    });
  }
  await visit(root, '');
  return stableHash(entries);
}

async function restrictedJson(relativePath) {
  return JSON.parse(await readFile(resolve(BOUNDARY_ROOT, relativePath), 'utf8'));
}

function contractFromManifest(manifest, state, acquisition, acquisitionReceipt) {
  const base = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.extraction_run_contract.v1',
    parser_version: PARSER_VERSION,
    pass_definitions: PASS_DEFINITIONS,
    files: manifest,
  });
  return contentAddressedEnvelope({
    ...base,
    extraction_run_id: state.extraction_run_id,
    acquisition_state_hash: acquisition.content_hash,
    acquisition_receipt_hash: acquisitionReceipt.content_hash,
  });
}

async function main() {
  if (process.argv.length !== 2) throw new Error('argument_rejected');
  const [state, journal, extractionReceipt, acquisition, acquisitionReceipt, completion] =
    await Promise.all([
      restrictedJson('state/extraction-state.json'),
      restrictedJson('state/extraction-journal.json'),
      restrictedJson('audit/extraction-receipt.json'),
      restrictedJson('state/acquisition-state.json'),
      restrictedJson('audit/acquisition-receipt.json'),
      restrictedJson('reviews/finalization/specialist-batch-finalization.json'),
    ]);
  const currentManifest = await currentRunContractManifest();
  const rotationTcbHashes = await currentFinalizerDriftRotationTcbHashes();
  const oldManifest = structuredClone(currentManifest);
  const finalizerIndex = oldManifest.findIndex((entry) => entry.relative_path === FINALIZER_PATH);
  if (finalizerIndex < 0) throw new Error('decision_manifest_rejected');
  oldManifest[finalizerIndex].sha256 = OLD_FINALIZER_SHA256;
  const oldContract = contractFromManifest(oldManifest, state, acquisition, acquisitionReceipt);
  const currentContract = contractFromManifest(
    currentManifest, state, acquisition, acquisitionReceipt,
  );
  if (oldContract.content_hash !== OLD_RUN_CONTRACT_ROOT
      || state.run_contract_hash !== OLD_RUN_CONTRACT_ROOT) {
    throw new Error('decision_old_contract_rejected');
  }
  const moveUnitRoots = {
    working_tree: await inventory('working'),
    reviews_tree: await inventory('reviews'),
    extraction_state: await inventory('state/extraction-state.json'),
    extraction_journal: await inventory('state/extraction-journal.json'),
    extraction_receipt: await inventory('audit/extraction-receipt.json'),
    processing_receipts: await inventory('audit/processing-receipts'),
    retrieval_receipts: await inventory('audit/retrieval-receipts'),
    artifact_failures: await inventory('audit/artifact-failures'),
  };
  const approvedRoots = {
    extraction_state_root: state.content_hash,
    journal_root: stableHash(journal),
    extraction_receipt_root: extractionReceipt.content_hash,
    working_tree_root: moveUnitRoots.working_tree,
    reviews_tree_root: moveUnitRoots.reviews_tree,
    processing_receipts_tree_root: moveUnitRoots.processing_receipts,
    retrieval_receipts_tree_root: moveUnitRoots.retrieval_receipts,
    artifact_failures_tree_root: moveUnitRoots.artifact_failures,
    move_unit_set_root: stableHash(moveUnitRoots),
    artifact_ledger_root: '',
    coverage_receipt_root: '',
    finalization_completion_root: completion.content_hash,
    packet_set_root: completion.packet_set_root,
    submission_set_root: completion.submission_set_root,
    receipt_set_root: completion.receipt_set_root,
    finalizer_contract_root: completion.finalizer_contract_root,
  };
  const artifactLedger = JSON.parse(await readFile(
    resolve(MODULE_ROOT, 'ledgers/ARTIFACT_PROCESSING_LEDGER.json'), 'utf8',
  ));
  const coverageReceipt = JSON.parse(await readFile(
    resolve(MODULE_ROOT, 'evidence/coverage-receipt.json'), 'utf8',
  ));
  approvedRoots.artifact_ledger_root = artifactLedger.content_hash;
  approvedRoots.coverage_receipt_root = coverageReceipt.content_hash;
  const decision = contentAddressedEnvelope({
    schema_version: SCHEMA,
    decision: 'SUPERSEDE_FINALIZED_RUN_FOR_FINALIZER_HASH_DRIFT',
    authority_ticket_sha256: AUTHORITY_TICKET_SHA256,
    extraction_run_id: state.extraction_run_id,
    old_run_contract_root: OLD_RUN_CONTRACT_ROOT,
    current_run_contract_root: currentContract.content_hash,
    old_finalizer_sha256: OLD_FINALIZER_SHA256,
    corrected_finalizer_sha256: currentManifest[finalizerIndex].sha256,
    old_run_contract_manifest: oldManifest,
    old_manifest_root: stableHash(oldManifest),
    current_run_contract_manifest: currentManifest,
    current_manifest_root: stableHash(currentManifest),
    rotation_tcb_hashes: rotationTcbHashes,
    rotation_tcb_root: stableHash(rotationTcbHashes),
    approved_roots: approvedRoots,
    archive_scope: ARCHIVE_SCOPE,
    non_destructive_archive: true,
    raw_acquisition_alias_decisions_preserved: true,
    production_mutation_authorized: false,
    release_or_final_approval_authority: false,
  });
  await validateFinalizerDriftRotationDecision(decision);
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ result: 'fail', error_code: error.message })}\n`);
  process.exitCode = 1;
});
