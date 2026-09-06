import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalFileBytes, contentAddressedEnvelope } from './canonical.mjs';
import { restrictedShortFingerprints } from '../../I1Q_1008E_RESTRICTED_FULL_CORPUS_EXTRACTION/tools/restricted-leak-audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HANDOFF = dirname(HERE);
const SAFE_EXTENSIONS = new Set(['.json', '.md', '.mjs', '.js', '.sh', '.txt']);
const RECEIPT = 'evidence/leakage-scan-results.json';

function tokens(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu) ?? [];
}

function ngrams(value, size = 12) {
  const values = tokens(value);
  const output = [];
  for (let index = 0; index + size <= values.length; index += 1) output.push(values.slice(index, index + size).join(' '));
  return output;
}

async function walk(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, path));
    else if (entry.isFile() && SAFE_EXTENSIONS.has(extname(entry.name))) files.push(relative(root, path));
  }
  return files.sort();
}

function collectRestrictedStrings(shards, roster) {
  const exact = new Set();
  const rawText = [];
  for (const row of roster) {
    [row.source_alias, row.transcript_path, row.nodes_path, row.transcript_sha256, row.nodes_sha256]
      .filter(Boolean).forEach((value) => exact.add(String(value)));
  }
  function visit(value, key = '') {
    if (Array.isArray(value)) return value.forEach((child) => visit(child, key));
    if (value && typeof value === 'object') return Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    if (typeof value !== 'string' || !value) return;
    if (key === 'safe_projection_hash' || key === 'run_contract_hash' || key === 'speaker_alias') return;
    if (/(?:^|_)(?:verbatim_oral_question|minimally_normalized_question|called_student_alias)$/u.test(key)) rawText.push(value);
    if (/(?:^|_)(?:id|hash)$/u.test(key) && /^[a-f0-9]{32,}$/iu.test(value)) exact.add(value);
    if (/(?:^|_)(?:alias|path|url)$/u.test(key)) exact.add(value);
  }
  shards.forEach((shard) => visit(shard));
  rawText.forEach((value) => { if (value.length >= 12) exact.add(value); });
  return { exact, rawText };
}

async function atomicWrite(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, canonicalFileBytes(value), { mode: 0o644, flag: 'wx' });
  await rename(temporary, path);
}

export async function runSafeHandoffLeakAudit({ boundary, governanceLocator }) {
  const roster = JSON.parse(await readFile(join(boundary, 'state/restricted-roster.json'), 'utf8'));
  const shardDirectory = join(boundary, 'working/shards');
  const shards = [];
  for (const name of await readdir(shardDirectory)) if (/^[a-f0-9]{64}\.json$/u.test(name)) shards.push(JSON.parse(await readFile(join(shardDirectory, name), 'utf8')));
  if (shards.length !== 97) throw new Error('restricted_shard_count_not_97');
  const restricted = collectRestrictedStrings(shards, roster);
  const restrictedNgrams = new Set(restricted.rawText.flatMap((value) => ngrams(value)));
  const restrictedShort = new Set(restricted.rawText.flatMap((value) => restrictedShortFingerprints(value)));
  const files = (await walk(HANDOFF)).filter((name) => name !== RECEIPT);
  const findings = [];
  let governanceCount = 0;
  for (const name of files) {
    const text = await readFile(join(HANDOFF, name), 'utf8');
    const absoluteStrings = text.match(/\/(?:Users|home|private|Volumes)\/[^\s`"')\]}>,]*/gu) ?? [];
    for (const value of absoluteStrings) {
      if (name === 'I1Q_1008F_SOURCE_BOUNDARY_METADATA_DECISION.md' && value === governanceLocator) governanceCount += 1;
      else findings.push({ file: name, code: 'UNAUTHORIZED_ABSOLUTE_BOUNDARY_STRING' });
    }
    for (const value of restricted.exact) {
      if (value && text.includes(value)) findings.push({ file: name, code: 'RESTRICTED_EXACT_VALUE' });
    }
    if (ngrams(text).some((value) => restrictedNgrams.has(value))) findings.push({ file: name, code: 'RESTRICTED_TEXT_12GRAM' });
    if (restrictedShortFingerprints(text).some((value) => restrictedShort.has(value))) findings.push({ file: name, code: 'RESTRICTED_DISTINCTIVE_SHORT_TEXT' });
  }
  if (governanceCount !== 1) findings.push({ file: 'I1Q_1008F_SOURCE_BOUNDARY_METADATA_DECISION.md', code: 'GOVERNANCE_LOCATOR_CARDINALITY' });
  const unique = [...new Map(findings.map((finding) => [`${finding.file}:${finding.code}`, finding])).values()]
    .sort((a, b) => `${a.file}:${a.code}`.localeCompare(`${b.file}:${b.code}`));
  const report = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008f.correlated-leakage-scan.v2',
    scanner_scope: 'COMPLETE_GIT_SAFE_HANDOFF_VS_ACCEPTED_RESTRICTED_GOLD_SET',
    files_scanned: files.length,
    restricted_shards_scanned: shards.length,
    restricted_exact_values_inspected: restricted.exact.size,
    restricted_text_ngrams_inspected: restrictedNgrams.size,
    restricted_short_fingerprints_inspected: restrictedShort.size,
    allowlisted_governance_locator_count: governanceCount,
    allowlisted_governance_locator_file: 'I1Q_1008F_SOURCE_BOUNDARY_METADATA_DECISION.md',
    allowlisted_governance_locator_purpose: 'FILED_PROTECTED_PATH_METADATA_CLEANUP_DECISION',
    unauthorized_absolute_boundary_string_count: unique.filter((finding) => finding.code === 'UNAUTHORIZED_ABSOLUTE_BOUNDARY_STRING').length,
    raw_content_or_identity_finding_count: unique.filter((finding) => finding.code.startsWith('RESTRICTED_')).length,
    finding_count: unique.length,
    findings: unique,
    passed: unique.length === 0,
    raw_transcript_files_committed: 0,
  });
  await atomicWrite(join(HANDOFF, RECEIPT), report);
  return report;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [boundary, governanceLocator] = process.argv.slice(2);
  if (!boundary || !governanceLocator) throw new Error('usage: node run-safe-handoff-leak-audit.mjs BOUNDARY GOVERNANCE_LOCATOR');
  const report = await runSafeHandoffLeakAudit({ boundary: resolve(boundary), governanceLocator });
  process.stdout.write(`${JSON.stringify(report)}\n`);
}
