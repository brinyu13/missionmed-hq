#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RESTRICTED_BOUNDARY,
  DEFAULT_WORKTREE_ROOT,
  preflightRestrictedBoundary,
  readRestrictedFile,
  readRestrictedJson,
} from './boundary.mjs';
import { contentAddressedEnvelope, stableHash } from './canonical.mjs';
import { assertSafeSerialization, scanSafeTree } from './safe-export.mjs';

const HANDOFF_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACTUAL_WORKTREE_ROOT = resolve(HANDOFF_ROOT, '../../..');
const ACQUISITION_STATE_PATH = 'state/acquisition-state.json';
const SAFE_EXTENSIONS = new Set(['.json', '.md', '.mjs', '.js', '.sh', '.txt']);
const NGRAM_SIZE = 12;
const MAX_SHORT_TOKEN_COUNT = NGRAM_SIZE - 1;
const MAX_SAFE_FILE_BYTES = 64 * 1024 * 1024;
const MAX_RAW_FILE_BYTES = 64 * 1024 * 1024;
const GENERIC_SPEAKER_LABELS = new Set([
  'doctor', 'dr', 'dr j', 'faculty', 'host', 'instructor', 'learner', 'moderator',
  'participant', 'person', 'speaker', 'student', 'teacher', 'unknown', 'voice',
]);
const GENERIC_SHORT_PHRASES = new Set([
  'all right', 'any questions', 'can you explain', 'clinical question',
  'medical question', 'next best step', 'okay so', 'tell me about',
  'thank you', 'the patient', 'this patient', 'what is the answer',
  'what is the diagnosis', 'what is the most likely diagnosis',
]);
const COMMON_SHORT_TOKENS = new Set([
  'a', 'about', 'all', 'an', 'and', 'answer', 'are', 'as', 'at', 'be', 'because',
  'best', 'but', 'by', 'can', 'case', 'clinical', 'diagnosis', 'did', 'do',
  'does', 'for', 'from', 'has', 'have', 'he', 'her', 'here', 'his', 'how', 'i',
  'in', 'is', 'it', 'likely', 'medical', 'most', 'next', 'not', 'of', 'on',
  'or', 'patient', 'question', 'she', 'should', 'so', 'step', 'that', 'the',
  'their', 'there', 'they', 'this', 'to', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
]);

const SHORT_MINIMUMS = Object.freeze({
  1: Object.freeze({ characters: 20, distinctive_tokens: 1, long_tokens: 1 }),
  2: Object.freeze({ characters: 24, distinctive_tokens: 2, long_tokens: 1 }),
  3: Object.freeze({ characters: 28, distinctive_tokens: 2, long_tokens: 2 }),
  4: Object.freeze({ characters: 32, distinctive_tokens: 2, long_tokens: 2 }),
  5: Object.freeze({ characters: 34, distinctive_tokens: 3, long_tokens: 2 }),
  6: Object.freeze({ characters: 36, distinctive_tokens: 3, long_tokens: 2 }),
});

function tokens(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length > 1) ?? [];
}

function correlationTokens(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

function normalizedCharacters(values) {
  return values.reduce((sum, value) => sum + [...value].length, 0);
}

function shortMinimums(tokenCount) {
  return SHORT_MINIMUMS[Math.min(tokenCount, 6)];
}

function isDistinctiveShortSequence(values) {
  if (values.length < 1 || values.length > MAX_SHORT_TOKEN_COUNT) return false;
  const phrase = values.join(' ');
  if (GENERIC_SHORT_PHRASES.has(phrase)) return false;
  const minimums = shortMinimums(values.length);
  const distinctiveTokens = values.filter((value) => (
    value.length >= 4 && !COMMON_SHORT_TOKENS.has(value)
  )).length;
  const longTokens = values.filter((value) => value.length >= 7).length;
  return normalizedCharacters(values) >= minimums.characters
    && distinctiveTokens >= minimums.distinctive_tokens
    && longTokens >= minimums.long_tokens;
}

function correlationFingerprint(kind, normalizedValue) {
  return stableHash(`missionmed.i1q1008e.leak-correlation.${kind}\0${normalizedValue}`);
}

export function restrictedShortFingerprints(value) {
  const values = correlationTokens(value);
  const fingerprints = new Set();
  for (let start = 0; start < values.length; start += 1) {
    const maximum = Math.min(MAX_SHORT_TOKEN_COUNT, values.length - start);
    for (let size = 1; size <= maximum; size += 1) {
      const window = values.slice(start, start + size);
      if (!isDistinctiveShortSequence(window)) continue;
      fingerprints.add(correlationFingerprint('short', window.join(' ')));
    }
  }
  return [...fingerprints].sort();
}

function normalizedSpeakerLabel(value) {
  const values = correlationTokens(value);
  const normalized = values.join(' ');
  if (normalizedCharacters(values) < 4 || GENERIC_SPEAKER_LABELS.has(normalized)) return null;
  if (/^(?:participant|person|speaker|unknown|voice)(?: [a-z0-9]+)?$/u.test(normalized)) return null;
  return normalized;
}

export function restrictedSpeakerFingerprint(value) {
  const normalized = normalizedSpeakerLabel(value);
  return normalized === null ? null : correlationFingerprint('speaker', normalized);
}

export function isRestrictedSpeakerFieldKey(value) {
  return /speaker|presenter|instructor|teacher|role/iu.test(String(value ?? ''));
}

function ngrams(value) {
  const values = tokens(value);
  const output = [];
  for (let index = 0; index + NGRAM_SIZE <= values.length; index += 1) {
    output.push(values.slice(index, index + NGRAM_SIZE).join(' '));
  }
  return output;
}

async function walkSafeFiles(root, current = root) {
  const output = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) output.push(...await walkSafeFiles(root, path));
    else if (entry.isFile() && SAFE_EXTENSIONS.has(extname(entry.name).toLowerCase())) output.push(path);
  }
  return output;
}

function collectStrings(value, visitor, depth = 0) {
  if (depth > 96) return;
  if (typeof value === 'string') {
    visitor(value, null);
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) collectStrings(child, visitor, depth + 1);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string') visitor(child, key);
    else collectStrings(child, visitor, depth + 1);
  }
}

function protectedStateValues(state) {
  const values = new Set();
  for (const value of [
    ...(state.raw_candidate_ids ?? []),
    ...(state.consumer_projection_raw_ids ?? []),
  ]) if (typeof value === 'string' && value.length >= 4) values.add(value);
  for (const item of state.artifact_results ?? []) {
    for (const value of [item.raw_id, item.canonical_locator]) {
      if (typeof value === 'string' && value.length >= 4) values.add(value);
    }
  }
  for (const row of state.roster ?? []) {
    for (const value of [row.raw_id, row.transcript_locator, row.nodes_locator]) {
      if (typeof value === 'string' && value.length >= 4) values.add(value);
    }
  }
  return values;
}

function addIndexBinding(index, fingerprint, fileHash) {
  const bindings = index.get(fingerprint) ?? new Set();
  bindings.add(fileHash);
  index.set(fingerprint, bindings);
}

async function safeNgramIndex() {
  const longIndex = new Map();
  const shortIndex = new Map();
  const documents = [];
  const files = await walkSafeFiles(HANDOFF_ROOT);
  for (const path of files) {
    const bytes = await readFile(path);
    if (bytes.length > MAX_SAFE_FILE_BYTES) throw new Error('safe_file_cap_exceeded');
    const fileHash = stableHash(relative(HANDOFF_ROOT, path));
    const serialized = bytes.toString('utf8');
    for (const gram of ngrams(serialized)) {
      addIndexBinding(longIndex, correlationFingerprint('long', gram), fileHash);
    }
    for (const fingerprint of restrictedShortFingerprints(serialized)) {
      addIndexBinding(shortIndex, fingerprint, fileHash);
    }
    documents.push({
      fileHash,
      normalizedTokenText: ` ${correlationTokens(serialized).join(' ')} `,
    });
  }
  return { longIndex, shortIndex, documents, fileCount: files.length };
}

async function rawFileNames(boundaryRoot) {
  const root = resolve(boundaryRoot, 'raw');
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
}

async function rawCorrelationFindings(boundaryRoot, safeIndex) {
  const findings = new Map();
  const speakerLabels = new Set();
  let rawStringCount = 0;
  let rawNgramCount = 0;
  let rawShortFingerprintCount = 0;
  const files = await rawFileNames(boundaryRoot);
  for (const fileName of files) {
    const bytes = await readRestrictedFile(`raw/${fileName}`, {
      boundaryRoot,
      worktreeRoot: ACTUAL_WORKTREE_ROOT,
      maximumBytes: MAX_RAW_FILE_BYTES,
    });
    let payload;
    try {
      payload = JSON.parse(bytes.toString('utf8'));
    } catch {
      payload = bytes.toString('utf8');
    }
    collectStrings(payload, (value, key) => {
      rawStringCount += 1;
      if (isRestrictedSpeakerFieldKey(key)) {
        const normalized = normalizedSpeakerLabel(value);
        if (normalized !== null) speakerLabels.add(normalized);
      }
      for (const gram of ngrams(value)) {
        rawNgramCount += 1;
        const safeFiles = safeIndex.longIndex.get(correlationFingerprint('long', gram));
        if (!safeFiles) continue;
        for (const fileHash of safeFiles) {
          findings.set(`${fileHash}:RAW_TEXT_NGRAM_MATCH`, {
            file_hash: fileHash,
            code: 'RAW_TEXT_NGRAM_MATCH',
          });
        }
      }
      const shortFingerprints = restrictedShortFingerprints(value);
      rawShortFingerprintCount += shortFingerprints.length;
      for (const fingerprint of shortFingerprints) {
        const safeFiles = safeIndex.shortIndex.get(fingerprint);
        if (!safeFiles) continue;
        for (const fileHash of safeFiles) {
          findings.set(`${fileHash}:RAW_SHORT_TEXT_MATCH`, {
            file_hash: fileHash,
            code: 'RAW_SHORT_TEXT_MATCH',
          });
        }
      }
    });
  }
  for (const normalized of speakerLabels) {
    const needle = ` ${normalized} `;
    for (const document of safeIndex.documents) {
      if (!document.normalizedTokenText.includes(needle)) continue;
      findings.set(`${document.fileHash}:RESTRICTED_SPEAKER_LABEL_MATCH`, {
        file_hash: document.fileHash,
        code: 'RESTRICTED_SPEAKER_LABEL_MATCH',
      });
    }
  }
  return {
    findings: [...findings.values()],
    speakerLabels,
    rawFileCount: files.length,
    rawStringCount,
    rawNgramCount,
    rawShortFingerprintCount,
  };
}

async function atomicSafeWrite(relativePath, value) {
  const target = resolve(HANDOFF_ROOT, relativePath);
  const relation = relative(HANDOFF_ROOT, target);
  if (relation === '..' || relation.startsWith(`..${sep}`)) throw new Error('safe_path_escape');
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (assertSafeSerialization(serialized).length > 0) throw new Error('safe_serialization_rejected');
  await mkdir(dirname(target), { recursive: true });
  const temporary = join(dirname(target), `.leak-audit-${randomBytes(12).toString('hex')}.tmp`);
  let handle;
  try {
    handle = await open(temporary, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL, 0o600);
    await handle.writeFile(serialized, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, target);
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function runRestrictedLeakAudit({
  boundaryRoot = DEFAULT_RESTRICTED_BOUNDARY,
  worktreeRoot = DEFAULT_WORKTREE_ROOT,
  write = true,
} = {}) {
  if (resolve(boundaryRoot) !== resolve(DEFAULT_RESTRICTED_BOUNDARY)
      || resolve(worktreeRoot) !== ACTUAL_WORKTREE_ROOT) throw new Error('approved_boundary_required');
  await preflightRestrictedBoundary({ boundaryRoot, worktreeRoot: ACTUAL_WORKTREE_ROOT });
  const state = await readRestrictedJson(ACQUISITION_STATE_PATH, {
    boundaryRoot, worktreeRoot: ACTUAL_WORKTREE_ROOT,
  });
  const forbiddenValues = protectedStateValues(state);
  const safe = await safeNgramIndex();
  const raw = await rawCorrelationFindings(boundaryRoot, safe);
  for (const value of raw.speakerLabels) forbiddenValues.add(value);
  const generic = await scanSafeTree(HANDOFF_ROOT, {
    forbiddenValues: [...forbiddenValues], scanCode: true,
  });
  const findingMap = new Map();
  for (const finding of [...generic.findings, ...raw.findings]) {
    findingMap.set(`${finding.file_hash}:${finding.code}`, finding);
  }
  const findings = [...findingMap.values()].sort((left, right) => (
    `${left.file_hash}:${left.code}`.localeCompare(`${right.file_hash}:${right.code}`)
  ));
  const report = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_correlated_leakage_audit.v1',
    scanner_scope: 'GIT_SAFE_HANDOFF_VS_PROTECTED_ACQUISITION_AND_RAW_CORPUS',
    safe_files_scanned: generic.files_scanned,
    protected_raw_files_scanned: raw.rawFileCount,
    protected_strings_inspected: raw.rawStringCount,
    protected_ngrams_inspected: raw.rawNgramCount,
    protected_short_fingerprints_inspected: raw.rawShortFingerprintCount,
    protected_locator_and_identifier_count: forbiddenValues.size,
    ngram_size: NGRAM_SIZE,
    short_sequence_max_tokens: MAX_SHORT_TOKEN_COUNT,
    short_distinctiveness_policy: 'TOKEN_COUNT_CHARACTER_AND_NONCOMMON_TOKEN_THRESHOLDS_WITH_GENERIC_ALLOWLIST',
    nongeneric_speaker_minimum_normalized_characters: 4,
    generic_short_phrase_allowlist_count: GENERIC_SHORT_PHRASES.size,
    generic_speaker_allowlist_count: GENERIC_SPEAKER_LABELS.size,
    finding_count: findings.length,
    findings,
    generic_safe_tree_result: generic.result,
    result: findings.length === 0 ? 'pass' : 'fail',
  });
  if (write) await atomicSafeWrite('evidence/leakage-scan-results.json', report);
  return report;
}

function dryRun() {
  const syntheticSafe = new Map([[
    'one two three four five six seven eight nine ten eleven twelve',
    new Set([stableHash('synthetic-safe-file')]),
  ]]);
  const matches = syntheticSafe.get(
    ngrams('zero one two three four five six seven eight nine ten eleven twelve thirteen')[1],
  );
  if (!matches || matches.size !== 1) throw new Error('dry_run_failed');
  const distinctive = restrictedShortFingerprints(
    'ultradistinctivefixturemarker secondaryuniquemarker',
  );
  const normalizedVariant = restrictedShortFingerprints(
    'ULTRADISTINCTIVEFIXTUREMARKER -- secondaryuniquemarker',
  );
  if (distinctive.length === 0
      || !distinctive.some((value) => normalizedVariant.includes(value))
      || restrictedShortFingerprints('what is the diagnosis').length !== 0
      || restrictedSpeakerFingerprint('Qzv Xrp') === null
      || restrictedSpeakerFingerprint('QZV-XRP') !== restrictedSpeakerFingerprint('Qzv Xrp')
      || restrictedSpeakerFingerprint('Speaker 7') !== null) {
    throw new Error('dry_run_failed');
  }
  return {
    mode: 'dry_run', result: 'pass', check_count: 7,
    network_requests: 0, protected_reads: 0, file_writes: 0,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const help = args.includes('--help') || args.includes('-h');
  const dry = args.includes('--dry-run');
  const supported = new Set(['--help', '-h', '--dry-run']);
  const unsupported = args.filter((argument) => !supported.has(argument));
  const invalid = unsupported.length > 0 || args.length > 1;
  const operation = invalid
    ? Promise.reject(new Error('unsupported_arguments'))
    : help
      ? Promise.resolve({
      mode: 'help',
      result: 'pass',
      usage: 'restricted-leak-audit.mjs [--dry-run|--help]',
      network_requests: 0,
      protected_reads: 0,
      file_writes: 0,
      })
      : dry
        ? Promise.resolve(dryRun())
        : runRestrictedLeakAudit();
  operation
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(() => {
      process.stderr.write(`${JSON.stringify({ result: 'fail', error_code: 'controlled_leak_audit_failure' })}\n`);
      process.exitCode = 1;
    });
}
