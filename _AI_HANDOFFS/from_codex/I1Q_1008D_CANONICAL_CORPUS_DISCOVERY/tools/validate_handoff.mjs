#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TOOL_DIR, '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function bytes(path) {
  return readFile(path);
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    if (entry.isFile()) output.push(path);
  }
  return output;
}

function countBy(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function verifyReceipt(receipt) {
  assert(receipt.schema_version === 'missionmed.sanitized-runtime-corpus-probe.v1', 'schema');
  assert(receipt.execution.raw_retention === 'none', 'retention');
  assert(receipt.execution.network_request_count === 411, 'network-count');
  assert(receipt.candidate_policy.ratified === false, 'candidate-ratification');
  assert(receipt.candidate_universe.opaque_id_count === 105, 'candidate-count');

  const projection = receipt.candidate_consumer_projection_reconciliation;
  assert(projection.candidate_count === 105, 'projection-candidate-count');
  assert(projection.consumer_projection_count === 97, 'consumer-count');
  assert(projection.intersection_count === 97, 'consumer-intersection');
  assert(projection.candidate_only_count === 8, 'candidate-only');
  assert(projection.consumer_only_count === 0, 'consumer-only');

  const three = receipt.candidate_three_surface_reconciliation;
  assert(three.live_candidate_count === 105, 'three-live');
  assert(three.consumer_projection_count === 97, 'three-consumer');
  assert(three.local_candidate_count === 95, 'three-local');
  const bucketCounts = Object.fromEntries(
    three.membership_buckets.map((entry) => [entry.membership_class, entry.count]),
  );
  assert(bucketCounts.live_consumer_local === 87, 'bucket-all');
  assert(bucketCounts.live_consumer_not_local === 10, 'bucket-consumer');
  assert(bucketCounts.live_local_not_consumer === 8, 'bucket-local');
  assert(bucketCounts.live_only === 0, 'bucket-live-only');
  assert(bucketCounts.consumer_not_live === 0, 'bucket-consumer-outside');
  assert(bucketCounts.local_not_live === 0, 'bucket-local-outside');
  assert(87 + 10 + 8 === 105, 'bucket-arithmetic');

  const summary = receipt.artifact_summary;
  assert(summary.expected_artifact_count === 210, 'artifact-check-count');
  assert(summary.available_count === 196, 'artifact-available');
  assert(summary.rejected_count === 14, 'artifact-rejected');
  assert(summary.duplicate_cluster_count === 0, 'duplicate-clusters');
  assert(receipt.duplicate_clusters.length === 0, 'duplicate-array');

  const byClass = Object.fromEntries(
    summary.by_artifact_class.map((entry) => [entry.artifact_class, entry]),
  );
  assert(byClass.transcript_json.available_count === 97, 'transcript-available');
  assert(byClass.transcript_json.rejected_count === 8, 'transcript-rejected');
  assert(byClass.transcript_json.unique_content_hash_count === 97, 'transcript-unique');
  assert(byClass.transcript_json.primary_record_count_sum === 81604, 'transcript-records');
  assert(byClass.nodes_json.available_count === 99, 'nodes-available');
  assert(byClass.nodes_json.rejected_count === 6, 'nodes-rejected');
  assert(byClass.nodes_json.unique_content_hash_count === 99, 'nodes-unique');
  assert(byClass.nodes_json.primary_record_count_sum === 82510, 'nodes-records');

  const pairs = [...countBy(
    Object.values(Object.groupBy(receipt.artifact_inventory, (entry) => entry.entity_alias)),
    (items) => items.filter((item) => item.availability === 'available')
      .map((item) => item.artifact_class).sort().join('+') || 'neither',
  )];
  const pairCounts = Object.fromEntries(pairs);
  assert(pairCounts['nodes_json+transcript_json'] === 97, 'paired-both');
  assert(pairCounts.nodes_json === 2, 'paired-nodes-only');
  assert(pairCounts.neither === 6, 'paired-neither');

  const unavailable = receipt.artifact_inventory.filter(
    (entry) => entry.availability !== 'available',
  );
  assert(unavailable.length === 14, 'unavailable-count');
  assert(unavailable.every((entry) => (
    entry.error_class === 'not_found' && entry.rejection_stage === 'head'
  )), 'unavailable-class');
}

async function verifyBindings(discovery) {
  const bindings = discovery.live_receipt_binding;
  const paths = {
    probe_tool_sha256: join(TOOL_DIR, 'sanitize_runtime_corpus_probe.mjs'),
    probe_test_sha256: join(TOOL_DIR, 'test_sanitize_runtime_corpus_probe.mjs'),
    live_receipt_sha256: join(ROOT, 'evidence', 'runtime_corpus_probe.json'),
  };
  for (const [field, path] of Object.entries(paths)) {
    assert(sha256(await bytes(path)) === bindings[field], `binding-${field}`);
  }
  const predecessorAudit = resolve(
    ROOT,
    '..',
    'I1Q_STATQUESTIONS_1008C_SOURCE_FACTORY',
    'reports',
    '02_LEGACY_V4_AUDIT_REPORT.md',
  );
  assert(
    sha256(await bytes(predecessorAudit)) === discovery.predecessor_binding.legacy_audit_sha256,
    'binding-predecessor-legacy-audit',
  );
  assert(discovery.predecessor_binding.legacy_row_count === 845, 'legacy-row-count');
}

async function verifySafeArtifacts(files) {
  const safeFiles = files.filter((path) => (
    !path.startsWith(`${TOOL_DIR}/`)
    && ['.md', '.json'].includes(extname(path).toLowerCase())
  ));
  const forbidden = [
    /https?:\/\//i,
    /\/Users\//,
    /\bBearer\s+[A-Za-z0-9._~-]+/i,
    /\bsk-[A-Za-z0-9_-]{8,}/,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
  ];
  for (const path of safeFiles) {
    const text = await readFile(path, 'utf8');
    for (const pattern of forbidden) assert(!pattern.test(text), `unsafe-pattern-${pattern}`);
  }
  return safeFiles.length;
}

async function verifyMarkdownLinks(files) {
  let linkCount = 0;
  for (const path of files.filter((item) => extname(item).toLowerCase() === '.md')) {
    const text = await readFile(path, 'utf8');
    for (const match of text.matchAll(/\[[^\]]+]\(([^)]+)\)/g)) {
      const target = match[1];
      if (target.startsWith('#')) continue;
      assert(!target.includes('://'), 'external-link');
      const targetPath = resolve(dirname(path), target.split('#', 1)[0]);
      assert((await stat(targetPath)).isFile() || (await stat(targetPath)).isDirectory(), 'link-target');
      linkCount += 1;
    }
  }
  return linkCount;
}

try {
  const receipt = await json(join(ROOT, 'evidence', 'runtime_corpus_probe.json'));
  const discovery = await json(join(ROOT, 'evidence', 'discovery_receipts.json'));
  verifyReceipt(receipt);
  await verifyBindings(discovery);
  const files = await walk(ROOT);
  const safeFileCount = await verifySafeArtifacts(files);
  const linkCount = await verifyMarkdownLinks(files);
  process.stdout.write(`${JSON.stringify({
    result: 'pass',
    receipt_invariants: 35,
    bound_hashes: 4,
    safe_artifact_files_scanned: safeFileCount,
    markdown_links_checked: linkCount,
  })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ result: 'failed', check: error.message })}\n`);
  process.exitCode = 1;
}
