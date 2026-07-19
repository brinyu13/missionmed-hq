import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalFileBytes, contentAddressedEnvelope } from '../../I1Q_1008F_DRILL_QUESTION_GOLD_SET/tools/canonical.mjs';
import { restrictedShortFingerprints } from '../../I1Q_1008E_RESTRICTED_FULL_CORPUS_EXTRACTION/tools/restricted-leak-audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HANDOFF = dirname(HERE);
const RECEIPT = 'evidence/leakage-scan-results.json';
const SAFE_EXTENSIONS = new Set(['.json', '.md', '.mjs', '.js', '.sql', '.sh', '.txt']);

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

function collectRestricted(shards, roster) {
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
    if (['safe_projection_hash', 'run_contract_hash', 'speaker_alias'].includes(key)) return;
    if (['verbatim_oral_question', 'minimally_normalized_question', 'called_student_alias'].includes(key)) rawText.push(value);
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

export async function runSafeHandoffLeakAudit(sourceBoundary) {
  const source = resolve(sourceBoundary);
  const roster = JSON.parse(await readFile(join(source, 'state/restricted-roster.json'), 'utf8'));
  const shards = [];
  for (const name of await readdir(join(source, 'working/shards'))) if (/^[a-f0-9]{64}\.json$/u.test(name)) shards.push(JSON.parse(await readFile(join(source, 'working/shards', name), 'utf8')));
  if (shards.length !== 97) throw new Error('restricted_shard_count_not_97');
  const restricted = collectRestricted(shards, roster);
  const restrictedNgrams = new Set(restricted.rawText.flatMap((value) => ngrams(value)));
  const restrictedShort = new Set(restricted.rawText.flatMap((value) => restrictedShortFingerprints(value)));
  const files = (await walk(HANDOFF)).filter((name) => name !== RECEIPT);
  const findings = [];
  for (const name of files) {
    const text = await readFile(join(HANDOFF, name), 'utf8');
    if (/\/(?:Users|home|private|Volumes)\//u.test(text)) findings.push({ file: name, code: 'ABSOLUTE_RESTRICTED_LOCATOR' });
    for (const value of restricted.exact) if (value && text.includes(value)) findings.push({ file: name, code: 'RESTRICTED_EXACT_VALUE' });
    if (ngrams(text).some((value) => restrictedNgrams.has(value))) findings.push({ file: name, code: 'RESTRICTED_TEXT_12GRAM' });
    if (restrictedShortFingerprints(text).some((value) => restrictedShort.has(value))) findings.push({ file: name, code: 'RESTRICTED_DISTINCTIVE_SHORT_TEXT' });
  }
  const unique = [...new Map(findings.map((finding) => [`${finding.file}:${finding.code}`, finding])).values()]
    .sort((left, right) => `${left.file}:${left.code}`.localeCompare(`${right.file}:${right.code}`));
  const report = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008g.correlated-leakage-scan.v1',
    scanner_scope: 'COMPLETE_GIT_SAFE_HANDOFF_VS_ACCEPTED_1008F_GOLD_SET',
    files_scanned: files.length,
    restricted_shards_scanned: shards.length,
    restricted_exact_values_inspected: restricted.exact.size,
    restricted_text_ngrams_inspected: restrictedNgrams.size,
    restricted_short_fingerprints_inspected: restrictedShort.size,
    unauthorized_absolute_locator_count: unique.filter((finding) => finding.code === 'ABSOLUTE_RESTRICTED_LOCATOR').length,
    raw_content_or_identity_finding_count: unique.filter((finding) => finding.code.startsWith('RESTRICTED_')).length,
    finding_count: unique.length,
    findings: unique,
    passed: unique.length === 0,
    raw_question_records_committed: 0,
    production_mutation_count: 0,
  });
  await atomicWrite(join(HANDOFF, RECEIPT), report);
  return report;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [sourceBoundary] = process.argv.slice(2);
  if (!sourceBoundary) throw new Error('usage: node run-safe-handoff-leak-audit.mjs SOURCE_GOLD_BOUNDARY');
  process.stdout.write(`${JSON.stringify(await runSafeHandoffLeakAudit(sourceBoundary))}\n`);
}
