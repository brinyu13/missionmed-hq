#!/usr/bin/env node

/**
 * Crash-resumable, non-destructive rotation of one invalidated extraction.
 *
 * The archive plan is code-defined, never data-defined. The complete working
 * and reviews trees are atomically exchanged with empty protected directories;
 * the remaining fixed files/directories use macOS RENAME_EXCL. Extraction and
 * rotation share one kernel advisory operation lock.
 */

import { execFile } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  assertBoundaryPath,
  DEFAULT_RESTRICTED_BOUNDARY,
  DEFAULT_WORKTREE_ROOT,
  postflightRestrictedBoundary,
  preflightRestrictedBoundary,
  readRestrictedJson,
} from './boundary.mjs';
import {
  contentAddressedEnvelope,
  stableHash,
  verifyContentAddressedEnvelope,
} from './canonical.mjs';
import { PARSER_VERSION, PASS_DEFINITIONS } from './constants.mjs';
import {
  assertExtractionOperationLockHeld,
  withExtractionOperationLock,
} from './extraction-operation-lock.mjs';
import { validateCoverage, validateJournal } from './ledger.mjs';
import {
  buildSpecialistReviewPacket,
  SPECIALIST_ROLE_CONTRACT,
} from './specialist-review.mjs';

const execFileAsync = promisify(execFile);
const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKTREE_ROOT_FROM_MODULE = resolve(MODULE_ROOT, '../../..');
const PYTHON_PATH = '/usr/bin/python3';
const RENAME_HELPER = [
  'import ctypes, os, sys',
  'libc = ctypes.CDLL(None, use_errno=True)',
  'fn = libc.renamex_np',
  'fn.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]',
  'fn.restype = ctypes.c_int',
  "flags = 2 if sys.argv[1] == 'swap' else 4",
  'rc = fn(os.fsencode(sys.argv[2]), os.fsencode(sys.argv[3]), flags)',
  'sys.exit(0 if rc == 0 else min(ctypes.get_errno() or 1, 125))',
].join('; ');

const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const MODE_MASK = 0o7777;
const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_RELATIVE_PATH = /^[A-Za-z0-9._/-]{1,512}$/u;
const REVIEWER_ID = /^reviewer_[A-Za-z0-9_-]{8,128}$/u;
const ALIAS = /^(?:opaque_)?(?:source|artifact)(?:_sha256)?_[A-Za-z0-9_-]{8,}$/u;

const STATE_PATH = 'state/extraction-state.json';
const JOURNAL_PATH = 'state/extraction-journal.json';
const EXTRACTION_RECEIPT_PATH = 'audit/extraction-receipt.json';
const STATUS_PATH = 'state/supersession-status.json';
const CORRECTION_DECISION_PATH =
  'reviews/correction-decisions/OSLER_CLASSIFIER_PRIVACY_CORRECTION.json';
const CORRECTION_TEST_RECEIPT_PATH =
  'reviews/correction-decisions/OSLER_CLASSIFIER_PRIVACY_CORRECTION_TEST_RECEIPT.json';

const SAFE_LEDGER_PATH = resolve(MODULE_ROOT, 'ledgers/ARTIFACT_PROCESSING_LEDGER.json');
const SAFE_COVERAGE_PATH = resolve(MODULE_ROOT, 'evidence/coverage-receipt.json');
const SAFE_FAILURE_LEDGER_PATH = resolve(MODULE_ROOT, 'ledgers/RETRY_AND_FAILURE_LEDGER.json');

const PREPARED_RECEIPT_SCHEMA =
  'missionmed.i1q1008e.superseded_extraction_rotation_receipt.v2';
const COMPLETION_RECEIPT_SCHEMA =
  'missionmed.i1q1008e.superseded_extraction_rotation_completion.v2';
const STATUS_SCHEMA = 'missionmed.i1q1008e.supersession_status.v2';
const PARTIAL_RECOVERY_SCHEMA =
  'missionmed.i1q1008e.contract_invalid_partial_recovery.v1';
const PARTIAL_RECOVERY_STATUS_SCHEMA =
  'missionmed.i1q1008e.contract_invalid_partial_recovery_status.v1';
const PARTIAL_RECOVERY_COMPLETION_SCHEMA =
  'missionmed.i1q1008e.contract_invalid_partial_recovery_completion.v1';
const PARTIAL_RECOVERY_STATUS_PATH = 'state/partial-run-recovery-status.json';
const FINALIZER_DRIFT_DECISION_SCHEMA =
  'missionmed.i1q1008e.finalizer_drift_rotation_decision.v1';
const FINALIZER_DRIFT_RECEIPT_SCHEMA =
  'missionmed.i1q1008e.finalizer_drift_rotation_receipt.v1';
const FINALIZER_DRIFT_STATUS_SCHEMA =
  'missionmed.i1q1008e.finalizer_drift_rotation_status.v1';
const FINALIZER_DRIFT_COMPLETION_SCHEMA =
  'missionmed.i1q1008e.finalizer_drift_rotation_completion.v1';
const FINALIZER_DRIFT_STATUS_PATH = 'state/finalizer-drift-rotation-status.json';
const FINALIZER_DRIFT_DECISION_PATH = resolve(
  MODULE_ROOT, 'evidence/finalizer-drift-rotation-decision.json',
);
const EXPECTED_PARTIAL_JOURNAL_ROOT =
  'fa4e33448c1e2ec4850de89f17511753040382f03cf0c709ad8d2e6798788618';
const EXPECTED_LIVE_PARTIAL_RECOVERY_ROOT =
  'abd0f6c3874e16008c273306eedc06a31f2f71f700c2f8d087d3ab5470330808';
const EXPECTED_PRIOR_SUPERSESSION_ROOT =
  '8b5d419ee1c40c8d8c3aca0f2f7346a3a109b30b8476561c714313132cf325d9';
const EXPECTED_PRIOR_PARTIAL_RECOVERY_ROOT =
  'abd0f6c3874e16008c273306eedc06a31f2f71f700c2f8d087d3ab5470330808';
const EXPECTED_OLD_FINALIZER_SHA256 =
  '6177e3cf0b3208ea2f435a83eb0819eae7ec5b9e9c59993ac9c208b2060f15c2';
const EXPECTED_CORRECTED_FINALIZER_SHA256 =
  '5d5ccd4f18eb11fbf6025b7eca65ed5753e86fab30fb74e034188abb1dbcd879';
const EXPECTED_OLD_RUN_CONTRACT_ROOT =
  '01e5c2d8db992e47ca08aab3652dd6e753d20c973cfad8874492f941ccdf34ab';
const AUTHORITY_TICKET_SHA256 =
  '99a5c0d9f13c77fbcd20fbd57a6e1186fdf467f35e3657269fe99b23efeddb03';
export const CORRECTION_DECISION_SCHEMA =
  'missionmed.i1q1008e.osler_classifier_privacy_correction.v1';
export const CORRECTION_TEST_RECEIPT_SCHEMA =
  'missionmed.i1q1008e.correction_test_receipt.v1';
export const ROLE_BATCH_SCHEMA =
  'missionmed.i1q1008e.restricted_specialist_role_batch.v1';

const EXPECTED_ARTIFACT_COUNT = 97;
const EXPECTED_JOURNAL_EVENT_COUNT = 873;
export const EXPECTED_CORRECTION_ID =
  'OSLER_CLASSIFIER_PRIVACY_CORRECTION';
export const EXPECTED_CORRECTION_COMPARATOR = Object.freeze({
  prior_conflict_count: 170,
  high_specificity_count: 125,
  multi_term_count: 42,
  cue_supported_count: 3,
  routed_to_medical_quarantine_count: 80,
  routed_to_speaker_quarantine_count: 88,
  administrative_negative_count: 2,
  outside_audited_set_promotion_count: 0,
  privacy_precedence_rows_expected: 2,
  privacy_precedence_rows_fixed: 2,
  identifier_restoration_count: 0,
  medical_comparator_root:
    '4e64ab3a534252c3a60ba9a960f18074e0d51d2c8fb8decb59f921524a51301a',
  privacy_comparator_root:
    'dc3b6db593795b692ceeba6c5bc6b2970b20bf0803159d5b7b2a128788076854',
});
const REQUIRED_CORRECTION_ROLES = Object.freeze([
  'OSLER', 'ASSESSMENT_SCIENCE', 'TURING',
]);
export const REQUIRED_CORRECTION_CODE_PATHS = Object.freeze([
  'tools/passes.mjs',
  'tests/test_extraction.mjs',
  'tools/boundary.mjs',
  'tools/canonical.mjs',
  'tools/constants.mjs',
  'tools/extraction-operation-lock.mjs',
  'tools/ledger.mjs',
  'tools/specialist-review.mjs',
  'tools/run-extraction.mjs',
  'tools/rotate-superseded-extraction.mjs',
  'tests/test_rotation.mjs',
]);

export const NON_DESTRUCTIVE_ARCHIVE_SCOPE = Object.freeze([
  'WORKING_TREE',
  'REVIEWS_TREE_INCLUDING_CORRECTION_DECISION',
  'EXTRACTION_STATE',
  'EXTRACTION_JOURNAL',
  'EXTRACTION_RECEIPT',
  'PROCESSING_RECEIPTS',
  'RETRIEVAL_RECEIPTS',
]);

const MOVE_UNITS = Object.freeze([
  Object.freeze({ key: 'working_tree', source: 'working', strategy: 'ATOMIC_DIRECTORY_SWAP' }),
  Object.freeze({ key: 'reviews_tree', source: 'reviews', strategy: 'ATOMIC_DIRECTORY_SWAP' }),
  Object.freeze({ key: 'extraction_state', source: STATE_PATH, strategy: 'ATOMIC_EXCLUSIVE_RENAME' }),
  Object.freeze({ key: 'extraction_journal', source: JOURNAL_PATH, strategy: 'ATOMIC_EXCLUSIVE_RENAME' }),
  Object.freeze({ key: 'extraction_receipt', source: EXTRACTION_RECEIPT_PATH, strategy: 'ATOMIC_EXCLUSIVE_RENAME' }),
  Object.freeze({ key: 'processing_receipts', source: 'audit/processing-receipts', strategy: 'ATOMIC_EXCLUSIVE_RENAME' }),
  Object.freeze({ key: 'retrieval_receipts', source: 'audit/retrieval-receipts', strategy: 'ATOMIC_EXCLUSIVE_RENAME' }),
]);

const FRESH_WORKING_DIRECTORIES = Object.freeze([
  'parsed-transcripts', 'parsed-nodes', 'occurrences', 'deduped-occurrences',
  'pass-receipts', 'lane-b-unmatched-nodes', 'lane-b-nodes',
]);
const FRESH_REVIEW_DIRECTORIES = Object.freeze([
  'automated-provisional', 'packets', 'receipts', 'submissions',
  'role-submissions', 'role-audits', 'correction-decisions', 'finalization',
]);

const PARTIAL_RECOVERY_UNITS = Object.freeze([
  ...MOVE_UNITS,
  Object.freeze({
    key: 'artifact_failures', source: 'audit/artifact-failures',
    strategy: 'ATOMIC_EXCLUSIVE_RENAME',
  }),
]);

const FINALIZER_DRIFT_UNITS = PARTIAL_RECOVERY_UNITS;
const RUN_CONTRACT_MODULE_PATHS = Object.freeze([
  'tools/acquire.mjs', 'tools/boundary.mjs', 'tools/canonical.mjs', 'tools/constants.mjs',
  'tools/extraction-operation-lock.mjs', 'tools/ledger.mjs', 'tools/parsers.mjs',
  'tools/passes.mjs', 'tools/provisional-dedupe.mjs', 'tools/run-extraction.mjs',
  'tools/safe-export.mjs', 'tools/schema-validator.mjs', 'tools/specialist-review.mjs',
  'tools/finalize-specialist-role-batches.mjs',
  'schemas/restricted-occurrence.schema.json', 'schemas/provisional-concept.schema.json',
  'schemas/artifact-processing-ledger.schema.json',
  'schemas/specialist-review-receipt.schema.json',
]);
const RUN_CONTRACT_EXTERNAL_PATHS = Object.freeze([
  Object.freeze({
    relative_path: 'worktree/i1q-question-platform/src/source-factory/legacy-v4.mjs',
    absolute_path: resolve(
      WORKTREE_ROOT_FROM_MODULE, 'i1q-question-platform/src/source-factory/legacy-v4.mjs',
    ),
  }),
  Object.freeze({
    relative_path: 'worktree/supabase/migrations/20260420111000_stat_dataset_ingest.sql',
    absolute_path: resolve(
      WORKTREE_ROOT_FROM_MODULE,
      'supabase/migrations/20260420111000_stat_dataset_ingest.sql',
    ),
  }),
]);
const FINALIZER_DRIFT_ROTATION_TCB_PATHS = Object.freeze([
  'tools/rotate-superseded-extraction.mjs',
  'tests/test_finalizer_drift_rotation.mjs',
  'tools/build-finalizer-drift-decision.mjs',
  'tools/extraction-operation-lock.mjs',
  'tools/boundary.mjs',
  'tools/canonical.mjs',
  'tools/ledger.mjs',
  'tools/constants.mjs',
]);
const FINALIZER_MANIFEST_PATH = 'tools/finalize-specialist-role-batches.mjs';
const FINALIZER_DRIFT_ARCHIVE_SCOPE = Object.freeze([
  'WORKING_TREE', 'REVIEWS_TREE', 'EXTRACTION_STATE', 'EXTRACTION_JOURNAL',
  'EXTRACTION_RECEIPT', 'PROCESSING_RECEIPTS', 'RETRIEVAL_RECEIPTS',
  'ARTIFACT_FAILURES',
]);

const EXPECTED_PARTIAL_RECOVERY = Object.freeze({
  extraction_run_id: 'opaque_run_i2IwFt-nc8yUknV2OcX47LKN7Ibxoqh2WLuNZIrma5M',
  run_contract_hash: '9872762e6cc15303e0767bba1bd0e9f219315389404421199f8507c796ee821b',
  roster_root: '0aa8ab3a17786763c57ff575ebcda59bcb69d273f8f84557d9e94aed5b4258a7',
  state_root: '65adacab90fd3563de9252d04cba5bbd91a937921c7f41312bde8dff8b972ffc',
  extraction_receipt_root: 'f33a5a7a76dd09e2fdc01f85dc47ba06e2f9663981dfa4841aafef36dc97aa29',
  coverage_root: '5dd6056ab2b45a59dace4f5f7b6964e450bda06a95956e448bb97fdcc6f2a48e',
  ledger_root: 'd87a66aa7acbb19057c2de9797dd48f65396d5526e1761cbe76435b8f19419c1',
  failure_ledger_root: 'e564283ab63d907b648dd10fe5698b43e5947f5a549d0515c2ee7569676ce763',
  corrected_schema_sha256: 'fc018bbd267695ad0236a944fc3c5726468faed0140aee66c29e6db471196318',
  corrected_test_sha256: '4488c9a464f52913fa1b6e7fa39cd706dc6a533bfe4400c63af977db07324310',
  complete_artifact_count: 95,
  failed_artifact_count: 2,
  complete_pass_cell_count: 855,
  failed_pass_cell_count: 18,
  journal_event_count: 877,
});

const PRESERVATION_PATHS = Object.freeze({
  raw_tree: 'raw',
  acquisition_state: 'state/acquisition-state.json',
  acquisition_receipt: 'audit/acquisition-receipt.json',
  alias_map: 'state/opaque-alias-map.json',
  boundary_decision: 'audit/boundary-decision.json',
  network_target_approval: 'audit/network-target-approval.json',
  target_configuration: 'state/acquisition-targets.json',
});

const PROTECTED_INVENTORIES = Object.freeze({
  occurrence_inventory: 'working/full-occurrence-inventory-index.json',
  concept_inventory: 'working/provisional-concepts.json',
  duplicate_relationship_inventory: 'working/provisional-duplicate-relationships.json',
  legacy_comparison: 'working/legacy-comparison.json',
});

const OLD_ROOT_KEYS = Object.freeze([
  'extraction_state_root', 'run_contract_root', 'journal_root',
  'extraction_receipt_root', 'artifact_ledger_root', 'coverage_receipt_root',
  'working_tree_root', 'reviews_tree_root', 'processing_receipts_tree_root',
  'retrieval_receipts_tree_root', 'occurrence_inventory', 'concept_inventory',
  'duplicate_relationship_inventory', 'legacy_comparison', 'packet_set_root',
]);
const MOVE_ROOT_KEYS = Object.freeze(MOVE_UNITS.map((unit) => unit.key));
const PRESERVATION_KEYS = Object.freeze(Object.keys(PRESERVATION_PATHS));

const PACKET_KEYS = Object.freeze([
  'schema_version', 'extraction_run_id', 'run_contract_hash', 'source_alias',
  'artifact_alias', 'artifact_input_root', 'automated_pass_roots',
  'required_role_contract', 'specialist_verification_cell_denominator',
  'specialist_role_review_denominator', 'release_or_final_approval_authority',
  'content_hash',
]);
const BATCH_KEYS = Object.freeze([
  'schema_version', 'extraction_run_id', 'run_contract_hash', 'specialist_role',
  'reviewer_instance_id', 'authority_scope', 'artifact_review_count',
  'artifact_reviews', 'content_hash',
]);
const BATCH_REVIEW_KEYS = Object.freeze([
  'artifact_alias', 'review_packet_root', 'evidence_root', 'findings', 'disposition',
]);
const TEST_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'correction_id', 'verified_at', 'verdict', 'test_count',
  'test_pass_count', 'test_fail_count', 'syntax_check_count', 'syntax_fail_count',
  'dry_run_results', 'protected_comparator', 'correction_code_hashes',
  'protected_raw_values_emitted', 'release_or_final_approval_authority',
  'production_mutation_performed', 'content_hash',
]);
const CORRECTION_DECISION_KEYS = Object.freeze([
  'schema_version', 'decision', 'superseded_extraction_run_id',
  'superseded_extraction_state_root', 'superseded_run_contract_root',
  'superseded_coverage_receipt_root', 'superseded_journal_root',
  'superseded_extraction_receipt_root', 'superseded_reviews_tree_root',
  'superseded_packet_set_root', 'old_specialist_roots',
  'correction_code_hashes', 'correction_test_receipt_root', 'archive_scope',
  'raw_acquisition_alias_decisions_preserved', 'non_destructive_archive',
  'release_or_final_approval_authority', 'production_mutation_authorized',
  'content_hash',
]);
const DRY_RUN_KEYS = Object.freeze([
  'acquisition', 'extraction', 'specialist_review', 'restricted_leakage',
  'rotation', 'operation_lock',
]);
const COMPARATOR_KEYS = Object.freeze([
  'prior_conflict_count', 'high_specificity_count', 'multi_term_count',
  'cue_supported_count', 'routed_to_medical_quarantine_count',
  'routed_to_speaker_quarantine_count', 'administrative_negative_count',
  'outside_audited_set_promotion_count', 'privacy_precedence_rows_expected',
  'privacy_precedence_rows_fixed', 'identifier_restoration_count',
  'medical_comparator_root', 'privacy_comparator_root',
]);
const PREPARED_KEYS = Object.freeze([
  'schema_version', 'status', 'supersession_root', 'archive_root',
  'extraction_run_id', 'correction_decision_path', 'correction_decision_root',
  'old_roots', 'preservation_roots', 'move_unit_roots',
  'fixed_move_contract_root', 'raw_acquisition_alias_decisions_preserved',
  'destructive_delete_or_overwrite_authorized',
  'release_or_final_approval_authority', 'content_hash',
]);
const STATUS_KEYS = Object.freeze([
  'schema_version', 'status', 'supersession_root', 'extraction_run_id',
  'prepared_receipt_path', 'prepared_receipt_root', 'completion_receipt_path',
  'completion_receipt_root', 'content_hash',
]);
const COMPLETION_KEYS = Object.freeze([
  'schema_version', 'status', 'supersession_root', 'prepared_receipt_root',
  'extraction_run_id', 'correction_decision_root', 'old_roots',
  'preservation_roots_before', 'preservation_roots_after', 'archived_units',
  'archived_unit_set_root', 'fresh_directory_set_root',
  'destructive_delete_or_overwrite_performed',
  'raw_acquisition_alias_decisions_preserved', 'production_mutation_performed',
  'release_or_final_approval_performed', 'content_hash',
]);

const SAFE_CODES = new Set([
  'argument_rejected', 'archive_collision', 'archive_incomplete',
  'archive_manifest_mismatch', 'boundary_rejected', 'correction_decision_rejected',
  'correction_test_receipt_rejected', 'fresh_tree_rejected', 'internal_failure',
  'old_extraction_rejected', 'operation_lock_rejected',
  'preservation_invariant_failed', 'rotation_pointer_rejected',
  'safe_evidence_rejected', 'specialist_batch_rejected',
  'partial_recovery_rejected',
  'finalizer_drift_rotation_rejected',
]);

export class RotationError extends Error {
  constructor(code) {
    const safeCode = SAFE_CODES.has(code) ? code : 'internal_failure';
    super(safeCode);
    this.name = 'RotationError';
    this.code = safeCode;
  }
}

function fail(code) {
  throw new RotationError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function sameStringSet(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && new Set(actual).size === actual.length
    && actual.every((value) => expected.includes(value));
}

function assertHash(value, code = 'old_extraction_rejected') {
  if (!SHA256.test(value ?? '')) fail(code);
  return value;
}

function assertRelativePath(value, code = 'archive_manifest_mismatch') {
  if (typeof value !== 'string' || !SAFE_RELATIVE_PATH.test(value)
      || isAbsolute(value) || value.includes('\\')
      || value.split('/').some((part) => !part || part === '.' || part === '..')) fail(code);
  return value;
}

function isContained(root, candidate) {
  const remainder = relative(root, candidate);
  return remainder === '' || (!remainder.startsWith(`..${sep}`)
    && remainder !== '..' && !isAbsolute(remainder));
}

function secureStat(stat, kind) {
  if (!stat || stat.isSymbolicLink() || stat.uid !== process.getuid()) {
    fail('archive_manifest_mismatch');
  }
  if (kind === 'directory') {
    if (!stat.isDirectory() || (stat.mode & MODE_MASK) !== DIRECTORY_MODE) {
      fail('archive_manifest_mismatch');
    }
    return;
  }
  if (!stat.isFile() || (stat.mode & MODE_MASK) !== FILE_MODE || stat.nlink !== 1) {
    fail('archive_manifest_mismatch');
  }
}

async function optionalLstat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    fail('internal_failure');
  }
}

async function syncDirectory(path, lock = null) {
  if (lock) assertExtractionOperationLockHeld(lock);
  if (!Number.isInteger(fsConstants.O_DIRECTORY)
      || !Number.isInteger(fsConstants.O_NOFOLLOW)) fail('internal_failure');
  let handle;
  try {
    handle = await open(
      path, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
    );
    if (lock) assertExtractionOperationLockHeld(lock);
    await handle.sync();
  } catch (error) {
    if (error?.name === 'ExtractionOperationLockError') throw error;
    fail('internal_failure');
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function hashFile(path) {
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const before = await handle.stat();
    secureStat(before, 'file');
    const digest = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let position = 0;
    while (position < before.size) {
      const { bytesRead } = await handle.read(
        buffer, 0, Math.min(buffer.length, before.size - position), position,
      );
      if (bytesRead <= 0) fail('archive_manifest_mismatch');
      digest.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    const after = await handle.stat();
    secureStat(after, 'file');
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size) {
      fail('archive_manifest_mismatch');
    }
    return { sha256: digest.digest('hex'), size: before.size };
  } catch (error) {
    if (error instanceof RotationError) throw error;
    fail('archive_manifest_mismatch');
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function inventoryAbsoluteTree(rootPath) {
  const entries = [];
  async function visit(path, relativePath) {
    const stat = await lstat(path).catch(() => fail('archive_manifest_mismatch'));
    if (stat.isDirectory()) {
      secureStat(stat, 'directory');
      const canonical = await realpath(path).catch(() => fail('archive_manifest_mismatch'));
      if (canonical !== path) fail('archive_manifest_mismatch');
      entries.push({ relative_path: relativePath, kind: 'directory', mode: DIRECTORY_MODE });
      for (const child of (await readdir(path)).sort()) {
        await visit(join(path, child), relativePath ? `${relativePath}/${child}` : child);
      }
      return;
    }
    secureStat(stat, 'file');
    const hashed = await hashFile(path);
    entries.push({
      relative_path: relativePath,
      kind: 'file',
      mode: FILE_MODE,
      size: hashed.size,
      sha256: hashed.sha256,
    });
  }
  await visit(rootPath, '');
  return {
    entry_count: entries.length,
    file_count: entries.filter((entry) => entry.kind === 'file').length,
    directory_count: entries.filter((entry) => entry.kind === 'directory').length,
    byte_count: entries.filter((entry) => entry.kind === 'file')
      .reduce((sum, entry) => sum + entry.size, 0),
    tree_root: stableHash(entries),
    entries,
  };
}

async function restrictedAbsolute(relativePath, boundaryRoot, worktreeRoot, {
  kind = 'any', mustExist = false,
} = {}) {
  assertRelativePath(relativePath);
  return assertBoundaryPath(boundaryRoot, relativePath, {
    mustExist, kind, operation: 'write', worktreeRoot,
  });
}

async function inventoryRestrictedTree(relativePath, boundaryRoot, worktreeRoot) {
  const path = await restrictedAbsolute(relativePath, boundaryRoot, worktreeRoot, {
    mustExist: true,
  });
  return inventoryAbsoluteTree(path);
}

async function ensureRestrictedDirectory(
  relativePath, boundaryRoot, worktreeRoot, lock = null,
) {
  assertRelativePath(relativePath);
  let built = '';
  for (const part of relativePath.split('/')) {
    built = built ? `${built}/${part}` : part;
    const target = await restrictedAbsolute(built, boundaryRoot, worktreeRoot, {
      kind: 'directory', mustExist: false,
    });
    const existing = await optionalLstat(target);
    if (!existing) {
      try {
        if (lock) assertExtractionOperationLockHeld(lock);
        await mkdir(target, { mode: DIRECTORY_MODE });
        if (lock) assertExtractionOperationLockHeld(lock);
        await chmod(target, DIRECTORY_MODE);
        await syncDirectory(dirname(target), lock);
      } catch (error) {
        if (error?.name === 'ExtractionOperationLockError') throw error;
        fail('internal_failure');
      }
    }
    secureStat(await lstat(target), 'directory');
  }
}

async function nativeRename(operation, source, destination, lock) {
  assertExtractionOperationLockHeld(lock);
  if (process.platform !== 'darwin' || !['swap', 'exclusive'].includes(operation)) {
    fail('boundary_rejected');
  }
  try {
    assertExtractionOperationLockHeld(lock);
    await execFileAsync(PYTHON_PATH, ['-c', RENAME_HELPER, operation, source, destination], {
      timeout: 30_000,
      maxBuffer: 1024,
    });
  } catch (error) {
    if (error?.name === 'ExtractionOperationLockError') throw error;
    fail('archive_collision');
  }
}

async function atomicDurableJson(relativePath, value, boundaryRoot, worktreeRoot, lock, {
  exclusive = false,
} = {}) {
  assertExtractionOperationLockHeld(lock);
  assertRelativePath(relativePath);
  await ensureRestrictedDirectory(
    dirname(relativePath), boundaryRoot, worktreeRoot, lock,
  );
  const target = await restrictedAbsolute(relativePath, boundaryRoot, worktreeRoot, {
    kind: 'file', mustExist: false,
  });
  const existingStat = await optionalLstat(target);
  if (exclusive && existingStat) {
    const existing = await readRestrictedJson(relativePath, { boundaryRoot, worktreeRoot });
    if (stableHash(existing) !== stableHash(value)) fail('archive_collision');
    return 'ALREADY_PRESENT_IDENTICAL';
  }
  const tempRelative = `${dirname(relativePath)}/.rotation-write-${randomBytes(18).toString('hex')}.tmp`;
  const temporary = await restrictedAbsolute(tempRelative, boundaryRoot, worktreeRoot, {
    kind: 'file', mustExist: false,
  });
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  let handle;
  let moved = false;
  try {
    assertExtractionOperationLockHeld(lock);
    handle = await open(
      temporary,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      FILE_MODE,
    );
    assertExtractionOperationLockHeld(lock);
    await handle.chmod(FILE_MODE);
    assertExtractionOperationLockHeld(lock);
    await handle.writeFile(serialized);
    assertExtractionOperationLockHeld(lock);
    await handle.sync();
    await handle.close();
    handle = null;
    assertExtractionOperationLockHeld(lock);
    if (exclusive) await nativeRename('exclusive', temporary, target, lock);
    else {
      assertExtractionOperationLockHeld(lock);
      await rename(temporary, target);
    }
    moved = true;
    await syncDirectory(dirname(target), lock);
    assertExtractionOperationLockHeld(lock);
    const final = await readRestrictedJson(relativePath, { boundaryRoot, worktreeRoot });
    if (stableHash(final) !== stableHash(value)) fail('archive_collision');
    return existingStat ? 'REPLACED_ATOMICALLY' : 'CREATED';
  } catch (error) {
    if (error instanceof RotationError
        || error?.name === 'ExtractionOperationLockError') throw error;
    fail('internal_failure');
  } finally {
    await handle?.close().catch(() => {});
    if (!moved) {
      try {
        assertExtractionOperationLockHeld(lock);
        await unlink(temporary);
      } catch {
        // On lock loss, leave the private temporary file for safe recovery.
      }
    }
  }
}

async function readSecureSafeEnvelope(path, allowedRoot = MODULE_ROOT) {
  if (!isContained(allowedRoot, path) || !Number.isInteger(fsConstants.O_NOFOLLOW)) {
    fail('safe_evidence_rejected');
  }
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1
        || before.uid !== process.getuid() || (before.mode & 0o022) !== 0) {
      fail('safe_evidence_rejected');
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size) {
      fail('safe_evidence_rejected');
    }
    const value = JSON.parse(bytes.toString('utf8'));
    if (!verifyContentAddressedEnvelope(value)) fail('safe_evidence_rejected');
    return value;
  } catch (error) {
    if (error instanceof RotationError) throw error;
    fail('safe_evidence_rejected');
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function codeHashes({ verifyFiles = true } = {}) {
  const values = [];
  for (const relativePath of REQUIRED_CORRECTION_CODE_PATHS) {
    let digest = '0'.repeat(64);
    if (verifyFiles) {
      const target = resolve(MODULE_ROOT, relativePath);
      if (!isContained(MODULE_ROOT, target)) fail('correction_test_receipt_rejected');
      let handle;
      try {
        handle = await open(target, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
        const stat = await handle.stat();
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1
            || stat.uid !== process.getuid() || (stat.mode & 0o022) !== 0) {
          fail('correction_test_receipt_rejected');
        }
        digest = createHash('sha256').update(await handle.readFile()).digest('hex');
      } catch (error) {
        if (error instanceof RotationError) throw error;
        fail('correction_test_receipt_rejected');
      } finally {
        await handle?.close().catch(() => {});
      }
    }
    values.push({ relative_path: relativePath, sha256: digest });
  }
  return values;
}

function dryRunPassed(value) {
  return value === 'pass' || value === 'PASS'
    || (isPlainObject(value) && value.result === 'pass');
}

export async function validateCorrectionTestReceipt(receipt, {
  verifyCodeHashes = true,
} = {}) {
  if (!verifyContentAddressedEnvelope(receipt)
      || !exactKeys(receipt, TEST_RECEIPT_KEYS)
      || receipt.schema_version !== CORRECTION_TEST_RECEIPT_SCHEMA
      || receipt.correction_id !== EXPECTED_CORRECTION_ID
      || typeof receipt.verified_at !== 'string' || receipt.verified_at.length < 8
      || receipt.verdict !== 'GO_FOR_STATE_ROTATION'
      || !Number.isSafeInteger(receipt.test_count) || receipt.test_count < 1
      || receipt.test_pass_count !== receipt.test_count || receipt.test_fail_count !== 0
      || !Number.isSafeInteger(receipt.syntax_check_count) || receipt.syntax_check_count < 1
      || receipt.syntax_fail_count !== 0
      || !exactKeys(receipt.dry_run_results, DRY_RUN_KEYS)
      || !Object.values(receipt.dry_run_results).every(dryRunPassed)
      || !exactKeys(receipt.protected_comparator, COMPARATOR_KEYS)
      || stableHash(receipt.protected_comparator)
        !== stableHash(EXPECTED_CORRECTION_COMPARATOR)
      || receipt.protected_raw_values_emitted !== false
      || receipt.release_or_final_approval_authority !== false
      || receipt.production_mutation_performed !== false) {
    fail('correction_test_receipt_rejected');
  }
  for (const [key, value] of Object.entries(receipt.protected_comparator)) {
    if (key.endsWith('_root')) {
      assertHash(value, 'correction_test_receipt_rejected');
    } else if (!Number.isSafeInteger(value) || value < 0) {
      fail('correction_test_receipt_rejected');
    }
  }
  if (receipt.protected_comparator.outside_audited_set_promotion_count !== 0
      || receipt.protected_comparator.identifier_restoration_count !== 0
      || receipt.protected_comparator.privacy_precedence_rows_expected
        !== receipt.protected_comparator.privacy_precedence_rows_fixed) {
    fail('correction_test_receipt_rejected');
  }
  const expectedCodeHashes = await codeHashes({ verifyFiles: verifyCodeHashes });
  if (!Array.isArray(receipt.correction_code_hashes)
      || stableHash(receipt.correction_code_hashes) !== stableHash(expectedCodeHashes)) {
    fail('correction_test_receipt_rejected');
  }
  return true;
}

function validatePacket(packet, runId, contractHash) {
  if (!verifyContentAddressedEnvelope(packet) || !exactKeys(packet, PACKET_KEYS)
      || packet.schema_version !== 'missionmed.i1q1008e.restricted_specialist_review_packet.v1'
      || packet.extraction_run_id !== runId || packet.run_contract_hash !== contractHash
      || !ALIAS.test(packet.source_alias ?? '') || !ALIAS.test(packet.artifact_alias ?? '')
      || !SHA256.test(packet.artifact_input_root ?? '')
      || packet.release_or_final_approval_authority !== false) {
    fail('specialist_batch_rejected');
  }
  return packet;
}

export function validateRoleBatches({ packets, batches, extractionRunId, runContractHash }) {
  if (!Array.isArray(packets) || packets.length !== EXPECTED_ARTIFACT_COUNT
      || !isPlainObject(batches)
      || !exactKeys(batches, REQUIRED_CORRECTION_ROLES)) fail('specialist_batch_rejected');
  const packetByAlias = new Map();
  for (const value of packets) {
    const packet = validatePacket(value, extractionRunId, runContractHash);
    if (packetByAlias.has(packet.artifact_alias)) fail('specialist_batch_rejected');
    packetByAlias.set(packet.artifact_alias, packet);
  }
  const reviewerIds = new Set();
  const batchRoots = {};
  for (const role of REQUIRED_CORRECTION_ROLES) {
    const batch = batches[role];
    const contract = SPECIALIST_ROLE_CONTRACT[role];
    if (!verifyContentAddressedEnvelope(batch) || !exactKeys(batch, BATCH_KEYS)
        || batch.schema_version !== ROLE_BATCH_SCHEMA
        || batch.extraction_run_id !== extractionRunId
        || batch.run_contract_hash !== runContractHash
        || batch.specialist_role !== role
        || batch.authority_scope !== contract.authority_scope
        || !REVIEWER_ID.test(batch.reviewer_instance_id ?? '')
        || reviewerIds.has(batch.reviewer_instance_id)
        || batch.artifact_review_count !== EXPECTED_ARTIFACT_COUNT
        || !Array.isArray(batch.artifact_reviews)
        || batch.artifact_reviews.length !== EXPECTED_ARTIFACT_COUNT) {
      fail('specialist_batch_rejected');
    }
    const seen = new Set();
    for (const review of batch.artifact_reviews) {
      const packet = packetByAlias.get(review?.artifact_alias);
      if (!exactKeys(review, BATCH_REVIEW_KEYS) || !packet
          || seen.has(review.artifact_alias)
          || review.review_packet_root !== packet.content_hash
          || !SHA256.test(review.evidence_root ?? '')
          || !Array.isArray(review.findings)
          || typeof review.disposition !== 'string'
          || !/^[A-Z][A-Z0-9_]{1,127}$/u.test(review.disposition)) {
        fail('specialist_batch_rejected');
      }
      seen.add(review.artifact_alias);
    }
    if (seen.size !== packetByAlias.size) fail('specialist_batch_rejected');
    reviewerIds.add(batch.reviewer_instance_id);
    batchRoots[role] = batch.content_hash;
  }
  const packetSetRoot = stableHash([...packetByAlias.values()]
    .sort((left, right) => left.artifact_alias.localeCompare(right.artifact_alias))
    .map((packet) => ({
      artifact_alias: packet.artifact_alias,
      review_packet_root: packet.content_hash,
    })));
  return { batchRoots, packetSetRoot };
}

export async function validateCorrectionDecision(decision, observed, {
  batchRoots,
  packetSetRoot,
  testReceipt,
  verifyCodeHashes = true,
} = {}) {
  if (!verifyContentAddressedEnvelope(decision)
      || !exactKeys(decision, CORRECTION_DECISION_KEYS)
      || decision.schema_version !== CORRECTION_DECISION_SCHEMA
      || decision.decision !== 'SUPERSEDE_AND_REEXTRACT'
      || decision.superseded_extraction_run_id !== observed.extraction_run_id
      || decision.superseded_extraction_state_root !== observed.extraction_state_root
      || decision.superseded_run_contract_root !== observed.run_contract_root
      || decision.superseded_coverage_receipt_root !== observed.coverage_receipt_root
      || decision.superseded_journal_root !== observed.journal_root
      || decision.superseded_extraction_receipt_root !== observed.extraction_receipt_root
      // This is the deterministic reviewer-evidence manifest root (packet set
      // plus exact role-batch roots), not the physical reviews tree: the
      // decision itself lives inside that tree and cannot hash itself.
      || decision.superseded_reviews_tree_root !== observed.reviews_evidence_root
      || decision.superseded_packet_set_root !== packetSetRoot
      || !sameStringSet(decision.archive_scope, NON_DESTRUCTIVE_ARCHIVE_SCOPE)
      || decision.raw_acquisition_alias_decisions_preserved !== true
      || decision.non_destructive_archive !== true
      || decision.release_or_final_approval_authority !== false
      || decision.production_mutation_authorized !== false
      || !exactKeys(decision.old_specialist_roots, REQUIRED_CORRECTION_ROLES)
      || stableHash(decision.old_specialist_roots) !== stableHash(batchRoots)
      || !verifyContentAddressedEnvelope(testReceipt)
      || decision.correction_test_receipt_root !== testReceipt.content_hash) {
    fail('correction_decision_rejected');
  }
  await validateCorrectionTestReceipt(testReceipt, { verifyCodeHashes });
  if (stableHash(decision.correction_code_hashes)
      !== stableHash(testReceipt.correction_code_hashes)) {
    fail('correction_decision_rejected');
  }
  return true;
}

async function preservationRoots(boundaryRoot, worktreeRoot) {
  const roots = {};
  for (const [key, path] of Object.entries(PRESERVATION_PATHS)) {
    roots[key] = (await inventoryRestrictedTree(path, boundaryRoot, worktreeRoot)).tree_root;
  }
  return roots;
}

async function existingRelative(relativePath, boundaryRoot, worktreeRoot) {
  const path = await restrictedAbsolute(relativePath, boundaryRoot, worktreeRoot, {
    mustExist: false,
  });
  return (await optionalLstat(path)) ? path : null;
}

async function oldRelativePath(relativePath, receipt, boundaryRoot, worktreeRoot) {
  if (!receipt) {
    const source = await existingRelative(relativePath, boundaryRoot, worktreeRoot);
    if (!source) fail('old_extraction_rejected');
    return relativePath;
  }
  const source = await existingRelative(relativePath, boundaryRoot, worktreeRoot);
  const archivedRelative = `${receipt.archive_root}/${relativePath}`;
  const archived = await existingRelative(archivedRelative, boundaryRoot, worktreeRoot);
  if (Boolean(source) === Boolean(archived)) fail('archive_manifest_mismatch');
  return source ? relativePath : archivedRelative;
}

async function oldTreePath(relativePath, expectedRoot, receipt, boundaryRoot, worktreeRoot) {
  if (!receipt) return relativePath;
  const candidates = [relativePath, `${receipt.archive_root}/${relativePath}`];
  const matches = [];
  for (const candidate of candidates) {
    if (await existingRelative(candidate, boundaryRoot, worktreeRoot)) {
      const inventory = await inventoryRestrictedTree(candidate, boundaryRoot, worktreeRoot);
      if (inventory.tree_root === expectedRoot) matches.push(candidate);
    }
  }
  if (matches.length !== 1) fail('archive_manifest_mismatch');
  return matches[0];
}

async function readOldJson(relativePath, receipt, boundaryRoot, worktreeRoot) {
  return readRestrictedJson(
    await oldRelativePath(relativePath, receipt, boundaryRoot, worktreeRoot),
    { boundaryRoot, worktreeRoot },
  );
}

async function readPacketsAndBatches(reviewsBase, boundaryRoot, worktreeRoot) {
  const packetDirectory = `${reviewsBase}/packets`;
  const absolute = await restrictedAbsolute(packetDirectory, boundaryRoot, worktreeRoot, {
    mustExist: true, kind: 'directory',
  });
  const entries = (await readdir(absolute, { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (entries.length !== EXPECTED_ARTIFACT_COUNT
      || entries.some((entry) => !entry.isFile() || !entry.name.endsWith('.json'))) {
    fail('specialist_batch_rejected');
  }
  const packets = [];
  for (const entry of entries) {
    const packet = await readRestrictedJson(`${packetDirectory}/${entry.name}`, {
      boundaryRoot, worktreeRoot,
    });
    if (entry.name !== `${packet.artifact_alias}.json`) fail('specialist_batch_rejected');
    packets.push(packet);
  }
  const batches = {};
  for (const role of REQUIRED_CORRECTION_ROLES) {
    batches[role] = await readRestrictedJson(`${reviewsBase}/role-submissions/${role}.json`, {
      boundaryRoot, worktreeRoot,
    });
  }
  return { packets, batches };
}

async function validatePacketsAgainstExtractionState({
  state,
  packets,
  workingBase,
  processingBase,
  boundaryRoot,
  worktreeRoot,
}) {
  if (!Array.isArray(state.artifacts) || state.artifacts.length !== EXPECTED_ARTIFACT_COUNT
      || !Array.isArray(packets) || packets.length !== EXPECTED_ARTIFACT_COUNT) {
    fail('specialist_batch_rejected');
  }
  const packetByAlias = new Map(packets.map((packet) => [packet.artifact_alias, packet]));
  if (packetByAlias.size !== EXPECTED_ARTIFACT_COUNT) fail('specialist_batch_rejected');
  const stateAliases = new Set();
  const stateSources = new Set();
  for (const artifact of state.artifacts) {
    if (!isPlainObject(artifact) || !ALIAS.test(artifact.source_alias ?? '')
        || !ALIAS.test(artifact.artifact_alias ?? '')
        || stateSources.has(artifact.source_alias)
        || stateAliases.has(artifact.artifact_alias)
        || !SHA256.test(artifact.transcript_hash ?? '')
        || (artifact.nodes_hash !== null && !SHA256.test(artifact.nodes_hash ?? ''))
        || !SHA256.test(artifact.occurrence_shard_hash ?? '')
        || !SHA256.test(artifact.pass_shard_hash ?? '')
        || !SHA256.test(artifact.processing_receipt_hash ?? '')
        || !Array.isArray(artifact.pass_receipts)) {
      fail('old_extraction_rejected');
    }
    stateSources.add(artifact.source_alias);
    stateAliases.add(artifact.artifact_alias);
    const occurrenceShard = await readRestrictedJson(
      `${workingBase}/occurrences/${artifact.artifact_alias}.json`,
      { boundaryRoot, worktreeRoot },
    );
    const passShard = await readRestrictedJson(
      `${workingBase}/pass-receipts/${artifact.artifact_alias}.json`,
      { boundaryRoot, worktreeRoot },
    );
    const processingReceipt = await readRestrictedJson(
      `${processingBase}/${artifact.artifact_alias}.json`,
      { boundaryRoot, worktreeRoot },
    );
    if (!verifyContentAddressedEnvelope(occurrenceShard)
        || occurrenceShard.schema_version
          !== 'missionmed.i1q1008e.restricted_occurrence_shard.v1'
        || !verifyContentAddressedEnvelope(passShard)
        || passShard.schema_version
          !== 'missionmed.i1q1008e.restricted_pass_receipts.v1'
        || !verifyContentAddressedEnvelope(processingReceipt)
        || processingReceipt.schema_version
          !== 'missionmed.i1q1008e.restricted_processing_receipt.v1'
        || occurrenceShard.extraction_run_id !== state.extraction_run_id
        || occurrenceShard.run_contract_hash !== state.run_contract_hash
        || occurrenceShard.source_alias !== artifact.source_alias
        || occurrenceShard.artifact_alias !== artifact.artifact_alias
        || occurrenceShard.transcript_hash !== artifact.transcript_hash
        || occurrenceShard.nodes_hash !== artifact.nodes_hash
        || occurrenceShard.content_hash !== artifact.occurrence_shard_hash
        || !Array.isArray(occurrenceShard.occurrences)
        || passShard.extraction_run_id !== state.extraction_run_id
        || passShard.run_contract_hash !== state.run_contract_hash
        || passShard.source_alias !== artifact.source_alias
        || passShard.artifact_alias !== artifact.artifact_alias
        || passShard.content_hash !== artifact.pass_shard_hash
        || stableHash(passShard.pass_receipts) !== stableHash(artifact.pass_receipts)
        || processingReceipt.extraction_run_id !== state.extraction_run_id
        || processingReceipt.run_contract_hash !== state.run_contract_hash
        || processingReceipt.source_alias !== artifact.source_alias
        || processingReceipt.artifact_alias !== artifact.artifact_alias
        || processingReceipt.transcript_hash !== artifact.transcript_hash
        || processingReceipt.nodes_hash !== artifact.nodes_hash
        || processingReceipt.content_hash !== artifact.processing_receipt_hash
        || processingReceipt.pass_receipt_root !== stableHash(artifact.pass_receipts)
        || processingReceipt.occurrence_count !== occurrenceShard.occurrences.length
        || processingReceipt.occurrence_set_root !== stableHash(
          occurrenceShard.occurrences.map((occurrence) => occurrence?.content_hash).sort(),
        )) {
      fail('old_extraction_rejected');
    }
    const expected = buildSpecialistReviewPacket({
      extractionRunId: state.extraction_run_id,
      runContractHash: state.run_contract_hash,
      sourceAlias: artifact.source_alias,
      artifactAlias: artifact.artifact_alias,
      transcriptHash: artifact.transcript_hash,
      nodesHash: artifact.nodes_hash,
      occurrenceShardHash: occurrenceShard.content_hash,
      passShardHash: passShard.content_hash,
      processingReceiptHash: processingReceipt.content_hash,
      passReceipts: artifact.pass_receipts,
    });
    const packet = packetByAlias.get(artifact.artifact_alias);
    if (!packet || stableHash(packet) !== stableHash(expected)) {
      fail('specialist_batch_rejected');
    }
  }
  if (stateSources.size !== EXPECTED_ARTIFACT_COUNT
      || stateAliases.size !== packetByAlias.size
      || [...packetByAlias.keys()].some((alias) => !stateAliases.has(alias))) {
    fail('specialist_batch_rejected');
  }
}

function validateJournalAgainstExtractionState(state, journal) {
  const expectedPassIds = PASS_DEFINITIONS.map((definition) => definition.pass_id);
  const expectedPassIdSet = new Set(expectedPassIds);
  const expectedEvents = new Map();
  for (const artifact of state.artifacts) {
    if (!isPlainObject(artifact) || !ALIAS.test(artifact.artifact_alias ?? '')
        || !SHA256.test(artifact.transcript_hash ?? '')
        || !Array.isArray(artifact.pass_receipts)
        || artifact.pass_receipts.length !== expectedPassIds.length) {
      fail('old_extraction_rejected');
    }
    const receipts = new Map();
    for (const receipt of artifact.pass_receipts) {
      if (!isPlainObject(receipt) || !expectedPassIdSet.has(receipt.pass_id)
          || receipts.has(receipt.pass_id) || !SHA256.test(receipt.proposal_root ?? '')) {
        fail('old_extraction_rejected');
      }
      receipts.set(receipt.pass_id, receipt);
    }
    if (receipts.size !== expectedPassIds.length) fail('old_extraction_rejected');
    const attemptNumber = Number(
      artifact.successful_attempt_number ?? (Number(artifact.retry_count ?? 0) + 1),
    );
    if (!Number.isSafeInteger(attemptNumber) || attemptNumber < 1) {
      fail('old_extraction_rejected');
    }
    for (const passId of expectedPassIds) {
      const key = `${artifact.artifact_alias}\0${passId}`;
      if (expectedEvents.has(key)) fail('old_extraction_rejected');
      expectedEvents.set(key, {
        artifact_alias: artifact.artifact_alias,
        pass_id: passId,
        attempt_number: attemptNumber,
        input_hash: artifact.transcript_hash,
        output_shard_hash: receipts.get(passId).proposal_root,
      });
    }
  }
  if (expectedEvents.size !== EXPECTED_JOURNAL_EVENT_COUNT
      || journal.events.length !== expectedEvents.size) fail('old_extraction_rejected');
  const parserHashes = new Set();
  for (const event of journal.events) {
    const expected = expectedEvents.get(`${event.artifact_alias}\0${event.pass_id}`);
    if (!expected
        || event.phase !== expected.pass_id
        || event.attempt_number !== expected.attempt_number
        || event.input_hash !== expected.input_hash
        || event.output_shard_hash !== expected.output_shard_hash
        || event.rules_hash !== state.run_contract_hash
        || event.state_transition !== 'NOT_STARTED_TO_COMPLETE'
        || event.controlled_error_class !== null
        || event.safe_diagnostic_hash !== null
        || event.recovery_action !== null
        || !SHA256.test(event.parser_hash ?? '')) {
      fail('old_extraction_rejected');
    }
    parserHashes.add(event.parser_hash);
    expectedEvents.delete(`${event.artifact_alias}\0${event.pass_id}`);
  }
  if (expectedEvents.size !== 0 || parserHashes.size !== 1) fail('old_extraction_rejected');
}

async function loadOldRun({
  boundaryRoot,
  worktreeRoot,
  receipt = null,
  safeLedgerPath = SAFE_LEDGER_PATH,
  safeCoveragePath = SAFE_COVERAGE_PATH,
  safeRoot = MODULE_ROOT,
  verifyCodeHashes = true,
}) {
  const expected = receipt?.old_roots ?? null;
  const workingBase = await oldTreePath(
    'working', expected?.working_tree_root, receipt, boundaryRoot, worktreeRoot,
  );
  const reviewsBase = await oldTreePath(
    'reviews', expected?.reviews_tree_root, receipt, boundaryRoot, worktreeRoot,
  );
  const state = await readOldJson(STATE_PATH, receipt, boundaryRoot, worktreeRoot);
  const journal = await readOldJson(JOURNAL_PATH, receipt, boundaryRoot, worktreeRoot);
  const extractionReceipt = await readOldJson(
    EXTRACTION_RECEIPT_PATH, receipt, boundaryRoot, worktreeRoot,
  );
  const ledger = await readSecureSafeEnvelope(safeLedgerPath, safeRoot);
  const coverage = await readSecureSafeEnvelope(safeCoveragePath, safeRoot);
  const inventories = {};
  for (const [key, relativePath] of Object.entries(PROTECTED_INVENTORIES)) {
    inventories[key] = await readRestrictedJson(
      `${workingBase}/${relativePath.slice('working/'.length)}`,
      { boundaryRoot, worktreeRoot },
    );
  }
  const working = await inventoryRestrictedTree(workingBase, boundaryRoot, worktreeRoot);
  const reviews = await inventoryRestrictedTree(reviewsBase, boundaryRoot, worktreeRoot);
  const processingPath = await oldTreePath(
    'audit/processing-receipts', expected?.processing_receipts_tree_root,
    receipt, boundaryRoot, worktreeRoot,
  );
  const retrievalPath = await oldTreePath(
    'audit/retrieval-receipts', expected?.retrieval_receipts_tree_root,
    receipt, boundaryRoot, worktreeRoot,
  );
  const processing = await inventoryRestrictedTree(processingPath, boundaryRoot, worktreeRoot);
  const retrieval = await inventoryRestrictedTree(retrievalPath, boundaryRoot, worktreeRoot);

  if (!verifyContentAddressedEnvelope(state)
      || state.schema_version !== 'missionmed.i1q1008e.restricted_extraction_state.v1'
      || !verifyContentAddressedEnvelope(extractionReceipt)
      || extractionReceipt.schema_version
        !== 'missionmed.i1q1008e.restricted_extraction_receipt.v1'
      || validateJournal(journal).length > 0
      || !Array.isArray(state.artifacts) || state.artifacts.length !== EXPECTED_ARTIFACT_COUNT
      || journal.events.length !== EXPECTED_JOURNAL_EVENT_COUNT
      || extractionReceipt.journal_event_count !== journal.events.length
      || extractionReceipt.exact_journal_coverage !== true
      || journal.extraction_run_id !== state.extraction_run_id
      || extractionReceipt.extraction_run_id !== state.extraction_run_id
      || ledger.extraction_run_id !== state.extraction_run_id
      || coverage.extraction_run_id !== state.extraction_run_id
      || journal.run_contract_hash !== state.run_contract_hash
      || extractionReceipt.run_contract_hash !== state.run_contract_hash
      || journal.roster_root !== state.roster_root
      || extractionReceipt.roster_root !== state.roster_root
      || extractionReceipt.extraction_state_hash !== state.content_hash
      || state.artifact_ledger_hash !== ledger.content_hash
      || extractionReceipt.transcript_artifact_count !== EXPECTED_ARTIFACT_COUNT
      || extractionReceipt.nodes_artifact_count !== 99
      || coverage.transcript_artifacts_expected !== EXPECTED_ARTIFACT_COUNT
      || coverage.transcript_artifacts_processed !== extractionReceipt.transcript_artifact_count
      || coverage.automated_pass_cells_required !== EXPECTED_JOURNAL_EVENT_COUNT
      || coverage.automated_pass_cells_complete !== extractionReceipt.automated_pass_cell_count
      || validateCoverage(ledger, { requireObservedCohort: true }).result !== 'pass') {
    fail('old_extraction_rejected');
  }
  validateJournalAgainstExtractionState(state, journal);
  for (const key of ['inventory_index_hash', 'concept_inventory_hash',
    'duplicate_relationship_inventory_hash']) {
    if (state[key] !== extractionReceipt[key]) fail('old_extraction_rejected');
  }
  if (!verifyContentAddressedEnvelope(inventories.occurrence_inventory)
      || !verifyContentAddressedEnvelope(inventories.concept_inventory)
      || !verifyContentAddressedEnvelope(inventories.duplicate_relationship_inventory)
      || state.inventory_index_hash !== inventories.occurrence_inventory.content_hash
      || state.concept_inventory_hash !== inventories.concept_inventory.content_hash
      || state.duplicate_relationship_inventory_hash
        !== inventories.duplicate_relationship_inventory.content_hash
      || state.legacy_comparison_root !== inventories.legacy_comparison.comparison_root
      || extractionReceipt.inventory_index_hash !== inventories.occurrence_inventory.content_hash
      || extractionReceipt.concept_inventory_hash !== inventories.concept_inventory.content_hash
      || extractionReceipt.duplicate_relationship_inventory_hash
        !== inventories.duplicate_relationship_inventory.content_hash) {
    fail('old_extraction_rejected');
  }

  const { packets, batches } = await readPacketsAndBatches(
    reviewsBase, boundaryRoot, worktreeRoot,
  );
  await validatePacketsAgainstExtractionState({
    state,
    packets,
    workingBase,
    processingBase: processingPath,
    boundaryRoot,
    worktreeRoot,
  });
  const roleValidation = validateRoleBatches({
    packets,
    batches,
    extractionRunId: state.extraction_run_id,
    runContractHash: state.run_contract_hash,
  });
  const decision = await readRestrictedJson(
    `${reviewsBase}/${CORRECTION_DECISION_PATH.slice('reviews/'.length)}`,
    { boundaryRoot, worktreeRoot },
  );
  const testReceipt = await readRestrictedJson(
    `${reviewsBase}/${CORRECTION_TEST_RECEIPT_PATH.slice('reviews/'.length)}`,
    { boundaryRoot, worktreeRoot },
  );
  const oldRoots = {
    extraction_state_root: state.content_hash,
    run_contract_root: assertHash(state.run_contract_hash),
    journal_root: stableHash(journal),
    extraction_receipt_root: extractionReceipt.content_hash,
    artifact_ledger_root: ledger.content_hash,
    coverage_receipt_root: coverage.content_hash,
    working_tree_root: working.tree_root,
    reviews_tree_root: reviews.tree_root,
    processing_receipts_tree_root: processing.tree_root,
    retrieval_receipts_tree_root: retrieval.tree_root,
    occurrence_inventory: inventories.occurrence_inventory.content_hash,
    concept_inventory: inventories.concept_inventory.content_hash,
    duplicate_relationship_inventory: inventories.duplicate_relationship_inventory.content_hash,
    legacy_comparison: assertHash(inventories.legacy_comparison.comparison_root),
    packet_set_root: roleValidation.packetSetRoot,
  };
  const observed = {
    extraction_run_id: state.extraction_run_id,
    extraction_state_root: state.content_hash,
    run_contract_root: state.run_contract_hash,
    coverage_receipt_root: coverage.content_hash,
    journal_root: oldRoots.journal_root,
    extraction_receipt_root: extractionReceipt.content_hash,
    reviews_evidence_root: stableHash({
      packet_set_root: roleValidation.packetSetRoot,
      role_batch_roots: roleValidation.batchRoots,
    }),
  };
  await validateCorrectionDecision(decision, observed, {
    batchRoots: roleValidation.batchRoots,
    packetSetRoot: roleValidation.packetSetRoot,
    testReceipt,
    verifyCodeHashes,
  });
  if (receipt && (stableHash(oldRoots) !== stableHash(receipt.old_roots)
      || decision.content_hash !== receipt.correction_decision_root)) {
    fail('archive_manifest_mismatch');
  }
  return {
    state,
    journal,
    extractionReceipt,
    decision,
    testReceipt,
    oldRoots,
    workingBase,
    reviewsBase,
  };
}

async function moveUnitRoots(boundaryRoot, worktreeRoot) {
  const roots = {};
  for (const unit of MOVE_UNITS) {
    roots[unit.key] = (await inventoryRestrictedTree(
      unit.source, boundaryRoot, worktreeRoot,
    )).tree_root;
  }
  return roots;
}

function validateRootMap(value, keys, code) {
  if (!exactKeys(value, keys)) fail(code);
  for (const root of Object.values(value)) assertHash(root, code);
}

export function buildPreparedSupersessionReceipt({
  extractionRunId,
  correctionDecisionRoot,
  oldRoots,
  preservation,
  moveRoots,
}) {
  if (typeof extractionRunId !== 'string' || extractionRunId.length < 8) {
    fail('old_extraction_rejected');
  }
  assertHash(correctionDecisionRoot, 'correction_decision_rejected');
  validateRootMap(oldRoots, OLD_ROOT_KEYS, 'old_extraction_rejected');
  validateRootMap(preservation, PRESERVATION_KEYS, 'preservation_invariant_failed');
  validateRootMap(moveRoots, MOVE_ROOT_KEYS, 'archive_manifest_mismatch');
  const supersessionRoot = stableHash({
    extraction_run_id: extractionRunId,
    correction_decision_root: correctionDecisionRoot,
    old_roots: oldRoots,
    preservation_roots: preservation,
    move_unit_roots: moveRoots,
    fixed_move_contract: MOVE_UNITS,
  });
  return contentAddressedEnvelope({
    schema_version: PREPARED_RECEIPT_SCHEMA,
    status: 'PREPARED_FOR_NON_DESTRUCTIVE_ROTATION',
    supersession_root: supersessionRoot,
    archive_root: `quarantine/superseded-extraction-${supersessionRoot}`,
    extraction_run_id: extractionRunId,
    correction_decision_path: CORRECTION_DECISION_PATH,
    correction_decision_root: correctionDecisionRoot,
    old_roots: oldRoots,
    preservation_roots: preservation,
    move_unit_roots: moveRoots,
    fixed_move_contract_root: stableHash(MOVE_UNITS),
    raw_acquisition_alias_decisions_preserved: true,
    destructive_delete_or_overwrite_authorized: false,
    release_or_final_approval_authority: false,
  });
}

function validatePreparedReceipt(receipt) {
  if (!verifyContentAddressedEnvelope(receipt)
      || !exactKeys(receipt, PREPARED_KEYS)
      || receipt.schema_version !== PREPARED_RECEIPT_SCHEMA
      || receipt.status !== 'PREPARED_FOR_NON_DESTRUCTIVE_ROTATION'
      || receipt.archive_root !== `quarantine/superseded-extraction-${receipt.supersession_root}`
      || receipt.correction_decision_path !== CORRECTION_DECISION_PATH
      || receipt.fixed_move_contract_root !== stableHash(MOVE_UNITS)
      || receipt.raw_acquisition_alias_decisions_preserved !== true
      || receipt.destructive_delete_or_overwrite_authorized !== false
      || receipt.release_or_final_approval_authority !== false) {
    fail('rotation_pointer_rejected');
  }
  validateRootMap(receipt.old_roots, OLD_ROOT_KEYS, 'rotation_pointer_rejected');
  validateRootMap(receipt.preservation_roots, PRESERVATION_KEYS, 'rotation_pointer_rejected');
  validateRootMap(receipt.move_unit_roots, MOVE_ROOT_KEYS, 'rotation_pointer_rejected');
  const expectedRoot = stableHash({
    extraction_run_id: receipt.extraction_run_id,
    correction_decision_root: receipt.correction_decision_root,
    old_roots: receipt.old_roots,
    preservation_roots: receipt.preservation_roots,
    move_unit_roots: receipt.move_unit_roots,
    fixed_move_contract: MOVE_UNITS,
  });
  if (receipt.supersession_root !== expectedRoot) fail('rotation_pointer_rejected');
  return receipt;
}

export function validatePreparedSupersessionReceipt(receipt) {
  return validatePreparedReceipt(receipt);
}

function preparedReceiptPath(root) {
  return `audit/supersession-receipts/${root}.json`;
}

function completionReceiptPath(root) {
  return `audit/supersession-completions/${root}.json`;
}

function buildStatus(receipt, status, completion = null) {
  if (!['PREPARED', 'MOVING', 'COMPLETE'].includes(status)) fail('rotation_pointer_rejected');
  return contentAddressedEnvelope({
    schema_version: STATUS_SCHEMA,
    status,
    supersession_root: receipt.supersession_root,
    extraction_run_id: receipt.extraction_run_id,
    prepared_receipt_path: preparedReceiptPath(receipt.supersession_root),
    prepared_receipt_root: receipt.content_hash,
    completion_receipt_path: completion
      ? completionReceiptPath(receipt.supersession_root) : null,
    completion_receipt_root: completion?.content_hash ?? null,
  });
}

function validateStatus(status) {
  if (!verifyContentAddressedEnvelope(status)
      || !exactKeys(status, STATUS_KEYS)
      || status.schema_version !== STATUS_SCHEMA
      || !['PREPARED', 'MOVING', 'COMPLETE'].includes(status.status)
      || !SHA256.test(status.supersession_root ?? '')
      || !SHA256.test(status.prepared_receipt_root ?? '')
      || status.prepared_receipt_path !== preparedReceiptPath(status.supersession_root)) {
    fail('rotation_pointer_rejected');
  }
  if (status.status === 'COMPLETE') {
    if (!SHA256.test(status.completion_receipt_root ?? '')
        || status.completion_receipt_path !== completionReceiptPath(status.supersession_root)) {
      fail('rotation_pointer_rejected');
    }
  } else if (status.completion_receipt_path !== null
      || status.completion_receipt_root !== null) fail('rotation_pointer_rejected');
  return status;
}

async function optionalRestrictedJson(relativePath, boundaryRoot, worktreeRoot) {
  try {
    return await readRestrictedJson(relativePath, { boundaryRoot, worktreeRoot });
  } catch (error) {
    if (error?.name === 'BoundaryError' && error.code === 'boundary_missing') return null;
    throw error;
  }
}

async function reserveArchive(receipt, status, boundaryRoot, worktreeRoot, lock) {
  assertExtractionOperationLockHeld(lock);
  const path = await restrictedAbsolute(receipt.archive_root, boundaryRoot, worktreeRoot, {
    kind: 'directory', mustExist: false,
  });
  const existing = await optionalLstat(path);
  if (!existing) {
    try {
      assertExtractionOperationLockHeld(lock);
      await mkdir(path, { mode: DIRECTORY_MODE });
      assertExtractionOperationLockHeld(lock);
      await chmod(path, DIRECTORY_MODE);
      await syncDirectory(dirname(path), lock);
    } catch (error) {
      if (error?.name === 'ExtractionOperationLockError') throw error;
      fail('archive_collision');
    }
  } else {
    secureStat(existing, 'directory');
    if (!status && (await readdir(path)).length !== 0) fail('archive_collision');
  }
  assertExtractionOperationLockHeld(lock);
}

async function prepareSwapDestination(
  unit, receipt, boundaryRoot, worktreeRoot, lock,
) {
  const destination = `${receipt.archive_root}/${unit.source}`;
  const path = await restrictedAbsolute(destination, boundaryRoot, worktreeRoot, {
    kind: 'directory', mustExist: false,
  });
  if (!(await optionalLstat(path))) {
    await ensureRestrictedDirectory(
      dirname(destination), boundaryRoot, worktreeRoot, lock,
    );
    assertExtractionOperationLockHeld(lock);
    await mkdir(path, { mode: DIRECTORY_MODE }).catch(() => fail('archive_collision'));
    assertExtractionOperationLockHeld(lock);
    await chmod(path, DIRECTORY_MODE).catch(() => fail('archive_collision'));
    await syncDirectory(dirname(path), lock);
  }
  secureStat(await lstat(path), 'directory');
}

function validFreshSwapInventory(unit, inventory) {
  if (inventory.file_count !== 0) return false;
  if (inventory.entry_count === 1) return true;
  const expected = unit.key === 'working_tree'
    ? FRESH_WORKING_DIRECTORIES : FRESH_REVIEW_DIRECTORIES;
  const observed = inventory.entries
    .filter((entry) => entry.relative_path !== '')
    .map((entry) => entry.relative_path)
    .sort();
  return observed.length === expected.length
    && observed.every((value, index) => value === [...expected].sort()[index])
    && inventory.entries.every((entry) => entry.kind === 'directory');
}

async function moveOne(unit, receipt, boundaryRoot, worktreeRoot, lock, options) {
  assertExtractionOperationLockHeld(lock);
  const source = await restrictedAbsolute(unit.source, boundaryRoot, worktreeRoot, {
    mustExist: false,
  });
  const destinationRelative = `${receipt.archive_root}/${unit.source}`;
  const destination = await restrictedAbsolute(
    destinationRelative, boundaryRoot, worktreeRoot, { mustExist: false },
  );
  const expectedRoot = receipt.move_unit_roots[unit.key];
  if (unit.strategy === 'ATOMIC_DIRECTORY_SWAP') {
    await prepareSwapDestination(unit, receipt, boundaryRoot, worktreeRoot, lock);
    const sourceInventory = await inventoryAbsoluteTree(source);
    const destinationInventory = await inventoryAbsoluteTree(destination);
    const sourceIsOld = sourceInventory.tree_root === expectedRoot;
    const destinationIsOld = destinationInventory.tree_root === expectedRoot;
    const sourceIsEmpty = validFreshSwapInventory(unit, sourceInventory);
    const destinationIsEmpty = destinationInventory.entry_count === 1
      && destinationInventory.file_count === 0;
    if (sourceIsOld && destinationIsEmpty) {
      if (options?.testOnly === true
          && typeof options.beforeMutationInjector === 'function') {
        await options.beforeMutationInjector(`BEFORE_SWAP_${unit.key}`);
      }
      assertExtractionOperationLockHeld(lock);
      await nativeRename('swap', source, destination, lock);
      await syncDirectory(dirname(source), lock);
      await syncDirectory(dirname(destination), lock);
    } else if (!(sourceIsEmpty && destinationIsOld)) {
      fail('archive_manifest_mismatch');
    }
  } else {
    const sourceStat = await optionalLstat(source);
    const destinationStat = await optionalLstat(destination);
    const isFreshReceiptDirectory = ['processing_receipts', 'retrieval_receipts']
      .includes(unit.key);
    if (sourceStat && destinationStat) {
      if (!isFreshReceiptDirectory) fail('archive_collision');
      const sourceInventory = await inventoryAbsoluteTree(source);
      const destinationInventory = await inventoryAbsoluteTree(destination);
      if (sourceInventory.entry_count !== 1 || sourceInventory.file_count !== 0
          || destinationInventory.tree_root !== expectedRoot) {
        fail('archive_collision');
      }
    }
    if (!sourceStat && !destinationStat) fail('archive_incomplete');
    if (sourceStat && !destinationStat) {
      const current = await inventoryAbsoluteTree(source);
      if (current.tree_root !== expectedRoot) fail('archive_manifest_mismatch');
      await ensureRestrictedDirectory(
        dirname(destinationRelative), boundaryRoot, worktreeRoot, lock,
      );
      if (options?.testOnly === true
          && typeof options.beforeMutationInjector === 'function') {
        await options.beforeMutationInjector(`BEFORE_EXCLUSIVE_${unit.key}`);
      }
      assertExtractionOperationLockHeld(lock);
      await nativeRename('exclusive', source, destination, lock);
      await syncDirectory(dirname(source), lock);
      await syncDirectory(dirname(destination), lock);
    }
  }
  const archived = await inventoryAbsoluteTree(destination);
  if (archived.tree_root !== expectedRoot) fail('archive_manifest_mismatch');
  assertExtractionOperationLockHeld(lock);
  return archived;
}

async function ensureFreshTrees(boundaryRoot, worktreeRoot, lock) {
  assertExtractionOperationLockHeld(lock);
  for (const path of FRESH_WORKING_DIRECTORIES.map((name) => `working/${name}`)) {
    await ensureRestrictedDirectory(path, boundaryRoot, worktreeRoot, lock);
  }
  for (const path of FRESH_REVIEW_DIRECTORIES.map((name) => `reviews/${name}`)) {
    await ensureRestrictedDirectory(path, boundaryRoot, worktreeRoot, lock);
  }
  for (const path of ['audit/processing-receipts', 'audit/retrieval-receipts']) {
    await ensureRestrictedDirectory(path, boundaryRoot, worktreeRoot, lock);
  }
  for (const [root, expected] of [
    ['working', FRESH_WORKING_DIRECTORIES],
    ['reviews', FRESH_REVIEW_DIRECTORIES],
  ]) {
    const absolute = await restrictedAbsolute(root, boundaryRoot, worktreeRoot, {
      mustExist: true, kind: 'directory',
    });
    const entries = (await readdir(absolute, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    if (entries.length !== expected.length
        || entries.some((entry) => !entry.isDirectory() || !expected.includes(entry.name))) {
      fail('fresh_tree_rejected');
    }
    for (const entry of entries) {
      const child = join(absolute, entry.name);
      secureStat(await lstat(child), 'directory');
      if ((await readdir(child)).length !== 0) fail('fresh_tree_rejected');
    }
  }
  for (const relativePath of ['audit/processing-receipts', 'audit/retrieval-receipts']) {
    const absolute = await restrictedAbsolute(relativePath, boundaryRoot, worktreeRoot, {
      mustExist: true, kind: 'directory',
    });
    secureStat(await lstat(absolute), 'directory');
    if ((await readdir(absolute)).length !== 0) fail('fresh_tree_rejected');
  }
  assertExtractionOperationLockHeld(lock);
}

async function validateArchivedUnits(receipt, boundaryRoot, worktreeRoot) {
  const archivedUnits = [];
  for (const unit of MOVE_UNITS) {
    const destination = `${receipt.archive_root}/${unit.source}`;
    const inventory = await inventoryRestrictedTree(destination, boundaryRoot, worktreeRoot);
    if (inventory.tree_root !== receipt.move_unit_roots[unit.key]) {
      fail('archive_manifest_mismatch');
    }
    archivedUnits.push({
      key: unit.key,
      destination,
      strategy: unit.strategy,
      tree_root: inventory.tree_root,
      entry_count: inventory.entry_count,
      file_count: inventory.file_count,
      byte_count: inventory.byte_count,
    });
  }
  return archivedUnits;
}

function validateCompletion(completion, receipt) {
  if (!verifyContentAddressedEnvelope(completion)
      || !exactKeys(completion, COMPLETION_KEYS)
      || completion.schema_version !== COMPLETION_RECEIPT_SCHEMA
      || completion.status !== 'COMPLETE'
      || completion.supersession_root !== receipt.supersession_root
      || completion.prepared_receipt_root !== receipt.content_hash
      || stableHash(completion.old_roots) !== stableHash(receipt.old_roots)
      || stableHash(completion.preservation_roots_before)
        !== stableHash(receipt.preservation_roots)
      || stableHash(completion.preservation_roots_after)
        !== stableHash(receipt.preservation_roots)
      || completion.archived_unit_set_root !== stableHash(completion.archived_units)
      || completion.fresh_directory_set_root !== stableHash({
        working: FRESH_WORKING_DIRECTORIES,
        reviews: FRESH_REVIEW_DIRECTORIES,
        audit: ['processing-receipts', 'retrieval-receipts'],
      })
      || completion.destructive_delete_or_overwrite_performed !== false
      || completion.raw_acquisition_alias_decisions_preserved !== true
      || completion.production_mutation_performed !== false
      || completion.release_or_final_approval_performed !== false) {
    fail('rotation_pointer_rejected');
  }
  return completion;
}

async function maybeCrash(options, marker) {
  if (typeof options.crashInjector === 'function') await options.crashInjector(marker);
}

async function rotateCore(options, operationLock) {
  const boundaryRoot = options.boundaryRoot;
  const worktreeRoot = options.worktreeRoot;
  assertExtractionOperationLockHeld(operationLock);
  await preflightRestrictedBoundary({ boundaryRoot, worktreeRoot });
  let status = await optionalRestrictedJson(STATUS_PATH, boundaryRoot, worktreeRoot);
  if (status) validateStatus(status);

  let receipt;
  if (status) {
    receipt = validatePreparedReceipt(await readRestrictedJson(status.prepared_receipt_path, {
      boundaryRoot, worktreeRoot,
    }));
    if (receipt.content_hash !== status.prepared_receipt_root
        || receipt.supersession_root !== status.supersession_root) {
      fail('rotation_pointer_rejected');
    }
    await loadOldRun({ ...options, receipt });
  } else {
    const old = await loadOldRun(options);
    const preservation = await preservationRoots(boundaryRoot, worktreeRoot);
    const moveRoots = await moveUnitRoots(boundaryRoot, worktreeRoot);
    receipt = buildPreparedSupersessionReceipt({
      extractionRunId: old.state.extraction_run_id,
      correctionDecisionRoot: old.decision.content_hash,
      oldRoots: old.oldRoots,
      preservation,
      moveRoots,
    });
    await reserveArchive(receipt, null, boundaryRoot, worktreeRoot, operationLock);
    await maybeCrash(options, 'ARCHIVE_RESERVED');
    await atomicDurableJson(
      preparedReceiptPath(receipt.supersession_root), receipt,
      boundaryRoot, worktreeRoot, operationLock, { exclusive: true },
    );
    await maybeCrash(options, 'PREPARED_RECEIPT_WRITTEN');
    status = buildStatus(receipt, 'PREPARED');
    await atomicDurableJson(
      STATUS_PATH, status, boundaryRoot, worktreeRoot, operationLock,
    );
    await maybeCrash(options, 'STATUS_PREPARED');
  }

  await reserveArchive(receipt, status, boundaryRoot, worktreeRoot, operationLock);
  await atomicDurableJson(
    `${receipt.archive_root}/supersession-receipt.json`, receipt,
    boundaryRoot, worktreeRoot, operationLock, { exclusive: true },
  );
  await maybeCrash(options, 'ARCHIVE_RECEIPT_WRITTEN');

  if (status.status === 'COMPLETE') {
    const completion = validateCompletion(await readRestrictedJson(
      status.completion_receipt_path, { boundaryRoot, worktreeRoot },
    ), receipt);
    if (completion.content_hash !== status.completion_receipt_root) {
      fail('rotation_pointer_rejected');
    }
    const preserved = await preservationRoots(boundaryRoot, worktreeRoot);
    if (stableHash(preserved) !== stableHash(receipt.preservation_roots)) {
      fail('preservation_invariant_failed');
    }
    await validateArchivedUnits(receipt, boundaryRoot, worktreeRoot);
    await ensureFreshTrees(boundaryRoot, worktreeRoot, operationLock);
    await postflightRestrictedBoundary({ boundaryRoot, worktreeRoot });
    return { receipt, completion, repeated: true };
  }

  if (status.status === 'PREPARED') {
    status = buildStatus(receipt, 'MOVING');
    await atomicDurableJson(
      STATUS_PATH, status, boundaryRoot, worktreeRoot, operationLock,
    );
    await maybeCrash(options, 'STATUS_MOVING');
  }
  if (status.status !== 'MOVING') fail('rotation_pointer_rejected');

  for (const [index, unit] of MOVE_UNITS.entries()) {
    await moveOne(unit, receipt, boundaryRoot, worktreeRoot, operationLock, options);
    await maybeCrash(options, `MOVE_${index + 1}_${unit.key}`);
  }
  await ensureFreshTrees(boundaryRoot, worktreeRoot, operationLock);
  await maybeCrash(options, 'FRESH_TREES_CREATED');

  const preservedAfter = await preservationRoots(boundaryRoot, worktreeRoot);
  if (stableHash(preservedAfter) !== stableHash(receipt.preservation_roots)) {
    fail('preservation_invariant_failed');
  }
  await loadOldRun({ ...options, receipt });
  const archivedUnits = await validateArchivedUnits(receipt, boundaryRoot, worktreeRoot);
  const completion = contentAddressedEnvelope({
    schema_version: COMPLETION_RECEIPT_SCHEMA,
    status: 'COMPLETE',
    supersession_root: receipt.supersession_root,
    prepared_receipt_root: receipt.content_hash,
    extraction_run_id: receipt.extraction_run_id,
    correction_decision_root: receipt.correction_decision_root,
    old_roots: receipt.old_roots,
    preservation_roots_before: receipt.preservation_roots,
    preservation_roots_after: preservedAfter,
    archived_units: archivedUnits,
    archived_unit_set_root: stableHash(archivedUnits),
    fresh_directory_set_root: stableHash({
      working: FRESH_WORKING_DIRECTORIES,
      reviews: FRESH_REVIEW_DIRECTORIES,
      audit: ['processing-receipts', 'retrieval-receipts'],
    }),
    destructive_delete_or_overwrite_performed: false,
    raw_acquisition_alias_decisions_preserved: true,
    production_mutation_performed: false,
    release_or_final_approval_performed: false,
  });
  await atomicDurableJson(
    completionReceiptPath(receipt.supersession_root), completion,
    boundaryRoot, worktreeRoot, operationLock, { exclusive: true },
  );
  await atomicDurableJson(
    `${receipt.archive_root}/supersession-completion.json`, completion,
    boundaryRoot, worktreeRoot, operationLock, { exclusive: true },
  );
  await maybeCrash(options, 'COMPLETION_RECEIPTS_WRITTEN');
  status = buildStatus(receipt, 'COMPLETE', completion);
  await atomicDurableJson(STATUS_PATH, status, boundaryRoot, worktreeRoot, operationLock);
  await maybeCrash(options, 'STATUS_COMPLETE');
  await postflightRestrictedBoundary({ boundaryRoot, worktreeRoot });
  assertExtractionOperationLockHeld(operationLock);
  return { receipt, completion, repeated: false };
}

function publicResult({ receipt, completion, repeated }) {
  return {
    result: 'pass',
    supersession_root: receipt.supersession_root,
    prepared_receipt_root: receipt.content_hash,
    completion_receipt_root: completion.content_hash,
    archived_unit_count: completion.archived_units.length,
    fresh_directory_count:
      FRESH_WORKING_DIRECTORIES.length + FRESH_REVIEW_DIRECTORIES.length + 2,
    destructive_delete_or_overwrite_count: 0,
    production_mutation_count: 0,
    repeated_completion: repeated,
  };
}

async function partialRecoveryPreservationRoots(boundaryRoot, worktreeRoot) {
  return {
    ...await preservationRoots(boundaryRoot, worktreeRoot),
    supersession_status: (await inventoryRestrictedTree(
      STATUS_PATH, boundaryRoot, worktreeRoot,
    )).tree_root,
    supersession_receipts: (await inventoryRestrictedTree(
      'audit/supersession-receipts', boundaryRoot, worktreeRoot,
    )).tree_root,
    supersession_completions: (await inventoryRestrictedTree(
      'audit/supersession-completions', boundaryRoot, worktreeRoot,
    )).tree_root,
    prior_superseded_archive: (await inventoryRestrictedTree(
      'quarantine/superseded-extraction-8b5d419ee1c40c8d8c3aca0f2f7346a3a109b30b8476561c714313132cf325d9',
      boundaryRoot, worktreeRoot,
    )).tree_root,
  };
}

async function partialRecoveryUnitRoots(boundaryRoot, worktreeRoot) {
  const roots = {};
  for (const unit of PARTIAL_RECOVERY_UNITS) {
    roots[unit.key] = (await inventoryRestrictedTree(
      unit.source, boundaryRoot, worktreeRoot,
    )).tree_root;
  }
  return roots;
}

async function directFileSha256(path) {
  const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1
        || stat.uid !== process.getuid() || (stat.mode & 0o022) !== 0) {
      fail('partial_recovery_rejected');
    }
    return createHash('sha256').update(await handle.readFile()).digest('hex');
  } finally {
    await handle.close().catch(() => {});
  }
}

async function loadContractInvalidPartialRun(boundaryRoot, worktreeRoot) {
  const state = await readRestrictedJson(STATE_PATH, { boundaryRoot, worktreeRoot });
  const journal = await readRestrictedJson(JOURNAL_PATH, { boundaryRoot, worktreeRoot });
  const extractionReceipt = await readRestrictedJson(
    EXTRACTION_RECEIPT_PATH, { boundaryRoot, worktreeRoot },
  );
  const ledger = await readSecureSafeEnvelope(SAFE_LEDGER_PATH);
  const coverage = await readSecureSafeEnvelope(SAFE_COVERAGE_PATH);
  const failures = await readSecureSafeEnvelope(SAFE_FAILURE_LEDGER_PATH);
  const completeArtifacts = state.artifacts?.filter(
    (artifact) => artifact.final_artifact_status === 'COMPLETE_WITH_QUARANTINE',
  ).length;
  const failedArtifacts = state.artifacts?.filter(
    (artifact) => artifact.final_artifact_status === 'FAILED_WITH_PROVEN_BLOCKER',
  ).length;
  if (!verifyContentAddressedEnvelope(state)
      || state.content_hash !== EXPECTED_PARTIAL_RECOVERY.state_root
      || state.extraction_run_id !== EXPECTED_PARTIAL_RECOVERY.extraction_run_id
      || state.run_contract_hash !== EXPECTED_PARTIAL_RECOVERY.run_contract_hash
      || state.roster_root !== EXPECTED_PARTIAL_RECOVERY.roster_root
      || state.extraction_complete !== false || state.artifacts?.length !== 97
      || completeArtifacts !== EXPECTED_PARTIAL_RECOVERY.complete_artifact_count
      || failedArtifacts !== EXPECTED_PARTIAL_RECOVERY.failed_artifact_count
      || validateJournal(journal).length !== 0
      || journal.events?.length !== EXPECTED_PARTIAL_RECOVERY.journal_event_count
      || stableHash(journal) !== EXPECTED_PARTIAL_JOURNAL_ROOT
      || journal.extraction_run_id !== EXPECTED_PARTIAL_RECOVERY.extraction_run_id
      || journal.run_contract_hash !== EXPECTED_PARTIAL_RECOVERY.run_contract_hash
      || journal.roster_root !== EXPECTED_PARTIAL_RECOVERY.roster_root
      || !verifyContentAddressedEnvelope(extractionReceipt)
      || extractionReceipt.content_hash !== EXPECTED_PARTIAL_RECOVERY.extraction_receipt_root
      || extractionReceipt.extraction_run_id !== EXPECTED_PARTIAL_RECOVERY.extraction_run_id
      || extractionReceipt.run_contract_hash !== EXPECTED_PARTIAL_RECOVERY.run_contract_hash
      || extractionReceipt.extraction_state_hash !== EXPECTED_PARTIAL_RECOVERY.state_root
      || extractionReceipt.roster_root !== EXPECTED_PARTIAL_RECOVERY.roster_root
      || extractionReceipt.extraction_complete !== false
      || ledger.content_hash !== EXPECTED_PARTIAL_RECOVERY.ledger_root
      || ledger.processing_summary?.pass_cells_complete_count
        !== EXPECTED_PARTIAL_RECOVERY.complete_pass_cell_count
      || ledger.processing_summary?.pass_cells_with_proven_blocker_count
        !== EXPECTED_PARTIAL_RECOVERY.failed_pass_cell_count
      || coverage.content_hash !== EXPECTED_PARTIAL_RECOVERY.coverage_root
      || coverage.extraction_complete !== false
      || failures.content_hash !== EXPECTED_PARTIAL_RECOVERY.failure_ledger_root
      || failures.failed_artifact_count !== EXPECTED_PARTIAL_RECOVERY.failed_artifact_count
      || failures.extraction_retry_count !== EXPECTED_PARTIAL_RECOVERY.failed_artifact_count
      || await directFileSha256(resolve(MODULE_ROOT, 'schemas/restricted-occurrence.schema.json'))
        !== EXPECTED_PARTIAL_RECOVERY.corrected_schema_sha256
      || await directFileSha256(resolve(MODULE_ROOT, 'tests/test_extraction.mjs'))
        !== EXPECTED_PARTIAL_RECOVERY.corrected_test_sha256) {
    fail('partial_recovery_rejected');
  }
  return { state, journal, extractionReceipt, ledger, coverage, failures };
}

export function buildContractInvalidPartialRecoveryReceipt({
  journalRoot, moveRoots, preservationRoots: preservation,
}) {
  const moveKeys = PARTIAL_RECOVERY_UNITS.map((unit) => unit.key);
  const preservationKeys = [
    ...PRESERVATION_KEYS, 'supersession_status', 'supersession_receipts',
    'supersession_completions', 'prior_superseded_archive',
  ];
  if (!exactKeys(moveRoots, moveKeys) || !exactKeys(preservation, preservationKeys)) {
    fail('partial_recovery_rejected');
  }
  for (const value of [journalRoot, ...Object.values(moveRoots), ...Object.values(preservation)]) {
    assertHash(value, 'partial_recovery_rejected');
  }
  const recoveryRoot = stableHash({
    decision: 'ARCHIVE_CONTRACT_INVALID_PARTIAL_RUN_AND_REEXTRACT',
    expected: EXPECTED_PARTIAL_RECOVERY,
    journal_root: journalRoot,
    move_unit_roots: moveRoots,
    preservation_roots: preservation,
    fixed_move_contract: PARTIAL_RECOVERY_UNITS,
  });
  return validateContractInvalidPartialRecoveryReceipt(contentAddressedEnvelope({
    schema_version: PARTIAL_RECOVERY_SCHEMA,
    status: 'PREPARED_FOR_NON_DESTRUCTIVE_PARTIAL_RECOVERY',
    decision: 'ARCHIVE_CONTRACT_INVALID_PARTIAL_RUN_AND_REEXTRACT',
    recovery_root: recoveryRoot,
    archive_root: `quarantine/contract-invalid-partial-${recoveryRoot}`,
    expected_partial_run: EXPECTED_PARTIAL_RECOVERY,
    journal_root: journalRoot,
    move_unit_roots: moveRoots,
    preservation_roots: preservation,
    fixed_move_contract: PARTIAL_RECOVERY_UNITS,
    non_destructive_archive: true,
    production_mutation_authorized: false,
    release_or_final_approval_authority: false,
  }));
}

const PARTIAL_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'status', 'decision', 'recovery_root', 'archive_root',
  'expected_partial_run', 'journal_root', 'move_unit_roots', 'preservation_roots',
  'fixed_move_contract', 'non_destructive_archive', 'production_mutation_authorized',
  'release_or_final_approval_authority', 'content_hash',
]);
const PARTIAL_STATUS_KEYS = Object.freeze([
  'schema_version', 'status', 'recovery_root', 'archive_root',
  'prepared_receipt_root', 'completed_units', 'completion_root', 'content_hash',
]);
const PARTIAL_COMPLETION_KEYS = Object.freeze([
  'schema_version', 'status', 'recovery_root', 'prepared_receipt_root',
  'archived_units', 'archived_unit_set_root', 'preservation_roots_before',
  'preservation_roots_after', 'fresh_directory_set_root',
  'destructive_delete_or_overwrite_performed', 'production_mutation_performed',
  'release_or_final_approval_performed', 'content_hash',
]);
const PARTIAL_ARCHIVED_UNIT_KEYS = Object.freeze([
  'key', 'destination', 'strategy', 'tree_root', 'entry_count',
  'file_count', 'byte_count',
]);

export function validateContractInvalidPartialRecoveryReceipt(receipt, {
  requireLiveBinding = false,
} = {}) {
  const moveKeys = PARTIAL_RECOVERY_UNITS.map((unit) => unit.key);
  const preservationKeys = [
    ...PRESERVATION_KEYS, 'supersession_status', 'supersession_receipts',
    'supersession_completions', 'prior_superseded_archive',
  ];
  if (!verifyContentAddressedEnvelope(receipt)
      || !exactKeys(receipt, PARTIAL_RECEIPT_KEYS)
      || receipt.schema_version !== PARTIAL_RECOVERY_SCHEMA
      || receipt.status !== 'PREPARED_FOR_NON_DESTRUCTIVE_PARTIAL_RECOVERY'
      || receipt.decision !== 'ARCHIVE_CONTRACT_INVALID_PARTIAL_RUN_AND_REEXTRACT'
      || !exactKeys(receipt.expected_partial_run, Object.keys(EXPECTED_PARTIAL_RECOVERY))
      || stableHash(receipt.expected_partial_run) !== stableHash(EXPECTED_PARTIAL_RECOVERY)
      || !exactKeys(receipt.move_unit_roots, moveKeys)
      || !exactKeys(receipt.preservation_roots, preservationKeys)
      || stableHash(receipt.fixed_move_contract) !== stableHash(PARTIAL_RECOVERY_UNITS)
      || receipt.archive_root !== `quarantine/contract-invalid-partial-${receipt.recovery_root}`
      || (requireLiveBinding
        && receipt.recovery_root !== EXPECTED_LIVE_PARTIAL_RECOVERY_ROOT)
      || receipt.non_destructive_archive !== true
      || receipt.production_mutation_authorized !== false
      || receipt.release_or_final_approval_authority !== false) {
    fail('partial_recovery_rejected');
  }
  for (const value of [
    receipt.journal_root, ...Object.values(receipt.move_unit_roots),
    ...Object.values(receipt.preservation_roots),
  ]) assertHash(value, 'partial_recovery_rejected');
  const expectedRoot = stableHash({
    decision: receipt.decision, expected: EXPECTED_PARTIAL_RECOVERY,
    journal_root: receipt.journal_root,
    move_unit_roots: receipt.move_unit_roots,
    preservation_roots: receipt.preservation_roots,
    fixed_move_contract: PARTIAL_RECOVERY_UNITS,
  });
  if (receipt.recovery_root !== expectedRoot) fail('partial_recovery_rejected');
  return receipt;
}

export function validateContractInvalidPartialRecoveryStatus(status, receipt = null) {
  const unitKeys = PARTIAL_RECOVERY_UNITS.map((unit) => unit.key);
  if (!verifyContentAddressedEnvelope(status) || !exactKeys(status, PARTIAL_STATUS_KEYS)
      || status.schema_version !== PARTIAL_RECOVERY_STATUS_SCHEMA
      || !['PREPARED', 'MOVING', 'COMPLETE'].includes(status.status)
      || !SHA256.test(status.recovery_root ?? '')
      || status.archive_root !== `quarantine/contract-invalid-partial-${status.recovery_root}`
      || !SHA256.test(status.prepared_receipt_root ?? '')
      || !Array.isArray(status.completed_units)
      || new Set(status.completed_units).size !== status.completed_units.length
      || !status.completed_units.every((value, index) => value === unitKeys[index])
      || (status.status === 'PREPARED' && status.completed_units.length !== 0)
      || (status.status === 'MOVING'
        && (status.completed_units.length < 1 || status.completed_units.length > unitKeys.length))
      || (status.status === 'COMPLETE'
        && (status.completed_units.length !== unitKeys.length
          || !SHA256.test(status.completion_root ?? '')))
      || (status.status !== 'COMPLETE' && status.completion_root !== null)) {
    fail('partial_recovery_rejected');
  }
  if (receipt && (status.recovery_root !== receipt.recovery_root
      || status.archive_root !== receipt.archive_root
      || status.prepared_receipt_root !== receipt.content_hash)) {
    fail('partial_recovery_rejected');
  }
  return status;
}

export function validateContractInvalidPartialRecoveryCompletion(completion, receipt) {
  const unitKeys = PARTIAL_RECOVERY_UNITS.map((unit) => unit.key);
  if (!verifyContentAddressedEnvelope(completion)
      || !exactKeys(completion, PARTIAL_COMPLETION_KEYS)
      || completion.schema_version !== PARTIAL_RECOVERY_COMPLETION_SCHEMA
      || completion.status !== 'COMPLETE'
      || completion.recovery_root !== receipt.recovery_root
      || completion.prepared_receipt_root !== receipt.content_hash
      || !Array.isArray(completion.archived_units)
      || completion.archived_units.length !== unitKeys.length
      || completion.archived_units.some((unit, index) => (
        !exactKeys(unit, PARTIAL_ARCHIVED_UNIT_KEYS)
        || unit.key !== unitKeys[index]
        || unit.destination !== `${receipt.archive_root}/${PARTIAL_RECOVERY_UNITS[index].source}`
        || unit.strategy !== PARTIAL_RECOVERY_UNITS[index].strategy
        || unit.tree_root !== receipt.move_unit_roots[unit.key]
        || !Number.isSafeInteger(unit.entry_count) || unit.entry_count < 1
        || !Number.isSafeInteger(unit.file_count) || unit.file_count < 0
        || !Number.isSafeInteger(unit.byte_count) || unit.byte_count < 0
      ))
      || completion.archived_unit_set_root !== stableHash(completion.archived_units)
      || stableHash(completion.preservation_roots_before)
        !== stableHash(receipt.preservation_roots)
      || stableHash(completion.preservation_roots_after)
        !== stableHash(receipt.preservation_roots)
      || completion.fresh_directory_set_root !== stableHash({
        working: FRESH_WORKING_DIRECTORIES, reviews: FRESH_REVIEW_DIRECTORIES,
        audit: ['artifact-failures', 'processing-receipts', 'retrieval-receipts'],
      })
      || completion.destructive_delete_or_overwrite_performed !== false
      || completion.production_mutation_performed !== false
      || completion.release_or_final_approval_performed !== false) {
    fail('partial_recovery_rejected');
  }
  return completion;
}

function partialStatus(receipt, status, completedUnits, completionRoot = null) {
  return contentAddressedEnvelope({
    schema_version: PARTIAL_RECOVERY_STATUS_SCHEMA,
    status,
    recovery_root: receipt.recovery_root,
    archive_root: receipt.archive_root,
    prepared_receipt_root: receipt.content_hash,
    completed_units: [...completedUnits],
    completion_root: completionRoot,
  });
}

async function validatePartialArchivedUnits(receipt, boundaryRoot, worktreeRoot) {
  const archived = [];
  for (const unit of PARTIAL_RECOVERY_UNITS) {
    const destination = `${receipt.archive_root}/${unit.source}`;
    const inventory = await inventoryRestrictedTree(destination, boundaryRoot, worktreeRoot);
    if (inventory.tree_root !== receipt.move_unit_roots[unit.key]) {
      fail('archive_manifest_mismatch');
    }
    archived.push({
      key: unit.key, destination, strategy: unit.strategy,
      tree_root: inventory.tree_root, entry_count: inventory.entry_count,
      file_count: inventory.file_count, byte_count: inventory.byte_count,
    });
  }
  return archived;
}

async function validatePartialArchiveShape(receipt, boundaryRoot, worktreeRoot, status = null) {
  const root = await restrictedAbsolute(receipt.archive_root, boundaryRoot, worktreeRoot, {
    kind: 'directory', mustExist: true,
  });
  const rootAllowed = new Set([
    'partial-recovery-receipt.json', 'partial-recovery-completion.json',
    'working', 'reviews', 'state', 'audit',
  ]);
  const entries = await readdir(root, { withFileTypes: true });
  if (entries.some((entry) => !rootAllowed.has(entry.name))) fail('archive_collision');
  if (entries.some((entry) => entry.name === 'partial-recovery-completion.json')
      && (!status || status.completed_units?.length !== PARTIAL_RECOVERY_UNITS.length)) {
    fail('archive_collision');
  }
  for (const [name, allowed] of [
    ['state', new Set(['extraction-state.json', 'extraction-journal.json'])],
    ['audit', new Set([
      'extraction-receipt.json', 'processing-receipts',
      'retrieval-receipts', 'artifact-failures',
    ])],
  ]) {
    const path = join(root, name);
    if (!(await optionalLstat(path))) continue;
    const children = await readdir(path, { withFileTypes: true });
    if (children.some((entry) => !allowed.has(entry.name))) fail('archive_collision');
  }
}

async function validateInitialPartialArchive(receipt, boundaryRoot, worktreeRoot) {
  await validatePartialArchiveShape(receipt, boundaryRoot, worktreeRoot);
  const root = await restrictedAbsolute(receipt.archive_root, boundaryRoot, worktreeRoot, {
    kind: 'directory', mustExist: true,
  });
  const entries = await readdir(root);
  if (entries.length === 0) return;
  if (entries.length !== 1 || entries[0] !== 'partial-recovery-receipt.json') {
    fail('archive_collision');
  }
  const existing = validateContractInvalidPartialRecoveryReceipt(await readRestrictedJson(
    `${receipt.archive_root}/partial-recovery-receipt.json`, { boundaryRoot, worktreeRoot },
  ));
  if (existing.content_hash !== receipt.content_hash) fail('archive_collision');
}

async function validatePartialProgress(receipt, status, boundaryRoot, worktreeRoot) {
  await validatePartialArchiveShape(receipt, boundaryRoot, worktreeRoot, status);
  const completedCount = status.completed_units.length;
  for (const [index, unit] of PARTIAL_RECOVERY_UNITS.entries()) {
    const source = await restrictedAbsolute(unit.source, boundaryRoot, worktreeRoot, {
      mustExist: false,
    });
    const destination = await restrictedAbsolute(
      `${receipt.archive_root}/${unit.source}`, boundaryRoot, worktreeRoot,
      { mustExist: false },
    );
    const sourceStat = await optionalLstat(source);
    const destinationStat = await optionalLstat(destination);
    if (index === completedCount && status.status !== 'COMPLETE') {
      const sourceRoot = sourceStat ? (await inventoryAbsoluteTree(source)).tree_root : null;
      const destinationInventory = destinationStat
        ? await inventoryAbsoluteTree(destination) : null;
      const destinationRoot = destinationInventory?.tree_root ?? null;
      const beforeMove = sourceRoot === receipt.move_unit_roots[unit.key]
        && (unit.strategy !== 'ATOMIC_DIRECTORY_SWAP'
          ? !destinationStat
          : !destinationStat || (destinationInventory.entry_count === 1
            && destinationInventory.file_count === 0));
      const afterMove = destinationRoot === receipt.move_unit_roots[unit.key]
        && (unit.strategy === 'ATOMIC_DIRECTORY_SWAP'
          ? sourceStat && validFreshSwapInventory(unit, await inventoryAbsoluteTree(source))
          : !sourceStat);
      if (!beforeMove && !afterMove) fail('archive_collision');
    } else if (index < completedCount) {
      if (!destinationStat) fail('archive_incomplete');
      const archived = await inventoryAbsoluteTree(destination);
      if (archived.tree_root !== receipt.move_unit_roots[unit.key]) {
        fail('archive_manifest_mismatch');
      }
      if (sourceStat) {
        const current = await inventoryAbsoluteTree(source);
        const allowedFresh = unit.strategy === 'ATOMIC_DIRECTORY_SWAP'
          ? validFreshSwapInventory(unit, current)
          : ['processing_receipts', 'retrieval_receipts', 'artifact_failures'].includes(unit.key)
            && current.entry_count === 1 && current.file_count === 0;
        if (!allowedFresh) fail('archive_collision');
      }
    } else {
      if (!sourceStat || destinationStat) fail('archive_collision');
      const current = await inventoryAbsoluteTree(source);
      if (current.tree_root !== receipt.move_unit_roots[unit.key]) {
        fail('archive_manifest_mismatch');
      }
    }
  }
}

async function validateFreshPartialTrees(boundaryRoot, worktreeRoot) {
  for (const [rootName, expected] of [
    ['working', FRESH_WORKING_DIRECTORIES], ['reviews', FRESH_REVIEW_DIRECTORIES],
  ]) {
    const root = await restrictedAbsolute(rootName, boundaryRoot, worktreeRoot, {
      kind: 'directory', mustExist: true,
    });
    const entries = (await readdir(root, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    if (entries.length !== expected.length
        || entries.some((entry) => !entry.isDirectory() || !expected.includes(entry.name))) {
      fail('fresh_tree_rejected');
    }
    for (const entry of entries) {
      const child = join(root, entry.name);
      secureStat(await lstat(child), 'directory');
      if ((await readdir(child)).length !== 0) fail('fresh_tree_rejected');
    }
  }
  for (const name of ['artifact-failures', 'processing-receipts', 'retrieval-receipts']) {
    const root = await restrictedAbsolute(`audit/${name}`, boundaryRoot, worktreeRoot, {
      kind: 'directory', mustExist: true,
    });
    secureStat(await lstat(root), 'directory');
    if ((await readdir(root)).length !== 0) fail('fresh_tree_rejected');
  }
}

async function partialRecoveryCore(options, lock) {
  const { boundaryRoot, worktreeRoot } = options;
  assertExtractionOperationLockHeld(lock);
  await preflightRestrictedBoundary({ boundaryRoot, worktreeRoot });
  let status = await optionalRestrictedJson(
    PARTIAL_RECOVERY_STATUS_PATH, boundaryRoot, worktreeRoot,
  );
  let receipt;
  if (status) {
    validateContractInvalidPartialRecoveryStatus(status);
    receipt = validateContractInvalidPartialRecoveryReceipt(await readRestrictedJson(
      `${status.archive_root}/partial-recovery-receipt.json`, { boundaryRoot, worktreeRoot },
    ), { requireLiveBinding: options?.testOnly !== true });
    validateContractInvalidPartialRecoveryStatus(status, receipt);
    await validatePartialProgress(receipt, status, boundaryRoot, worktreeRoot);
    if (status.status === 'COMPLETE') {
      const completion = validateContractInvalidPartialRecoveryCompletion(await readRestrictedJson(
        `${receipt.archive_root}/partial-recovery-completion.json`,
        { boundaryRoot, worktreeRoot },
      ), receipt);
      if (completion.content_hash !== status.completion_root) fail('partial_recovery_rejected');
      const archived = await validatePartialArchivedUnits(
        receipt, boundaryRoot, worktreeRoot,
      );
      const preserved = await partialRecoveryPreservationRoots(boundaryRoot, worktreeRoot);
      await validateFreshPartialTrees(boundaryRoot, worktreeRoot);
      if (stableHash(archived) !== stableHash(completion.archived_units)
          || stableHash(preserved) !== stableHash(receipt.preservation_roots)) {
        fail('preservation_invariant_failed');
      }
      await postflightRestrictedBoundary({ boundaryRoot, worktreeRoot });
      assertExtractionOperationLockHeld(lock);
      return { receipt, completion, repeated: true };
    }
  } else {
    if (options?.testOnly === true && options.preparedReceipt) {
      receipt = validateContractInvalidPartialRecoveryReceipt(options.preparedReceipt);
      const currentMoveRoots = await partialRecoveryUnitRoots(boundaryRoot, worktreeRoot);
      const currentPreservation = await partialRecoveryPreservationRoots(
        boundaryRoot, worktreeRoot,
      );
      if (stableHash(currentMoveRoots) !== stableHash(receipt.move_unit_roots)
          || stableHash(currentPreservation) !== stableHash(receipt.preservation_roots)) {
        fail('partial_recovery_rejected');
      }
    } else {
      const partial = await loadContractInvalidPartialRun(boundaryRoot, worktreeRoot);
      const moveRoots = await partialRecoveryUnitRoots(boundaryRoot, worktreeRoot);
      const preservation = await partialRecoveryPreservationRoots(boundaryRoot, worktreeRoot);
      receipt = buildContractInvalidPartialRecoveryReceipt({
        journalRoot: stableHash(partial.journal), moveRoots, preservationRoots: preservation,
      });
      validateContractInvalidPartialRecoveryReceipt(receipt, { requireLiveBinding: true });
    }
    await reserveArchive(receipt, { status: 'INITIALIZING' }, boundaryRoot, worktreeRoot, lock);
    await validateInitialPartialArchive(receipt, boundaryRoot, worktreeRoot);
    await atomicDurableJson(
      `${receipt.archive_root}/partial-recovery-receipt.json`, receipt,
      boundaryRoot, worktreeRoot, lock, { exclusive: true },
    );
    await maybeCrash(options, 'PARTIAL_RECEIPT_WRITTEN');
    status = partialStatus(receipt, 'PREPARED', []);
    await atomicDurableJson(
      PARTIAL_RECOVERY_STATUS_PATH, status, boundaryRoot, worktreeRoot, lock,
    );
    await maybeCrash(options, 'PARTIAL_STATUS_PREPARED');
  }
  await reserveArchive(receipt, status, boundaryRoot, worktreeRoot, lock);
  const completed = new Set(status.completed_units ?? []);
  for (const unit of PARTIAL_RECOVERY_UNITS) {
    if (!completed.has(unit.key)) {
      await moveOne(unit, receipt, boundaryRoot, worktreeRoot, lock, options);
      await maybeCrash(options, `PARTIAL_MOVED_${unit.key}`);
      completed.add(unit.key);
      status = partialStatus(receipt, 'MOVING', completed);
      await atomicDurableJson(
        PARTIAL_RECOVERY_STATUS_PATH, status, boundaryRoot, worktreeRoot, lock,
      );
      await maybeCrash(options, `PARTIAL_STATUS_${unit.key}`);
    }
  }
  await ensureFreshTrees(boundaryRoot, worktreeRoot, lock);
  await ensureRestrictedDirectory('audit/artifact-failures', boundaryRoot, worktreeRoot, lock);
  await validateFreshPartialTrees(boundaryRoot, worktreeRoot);
  await maybeCrash(options, 'PARTIAL_FRESH_TREES_CREATED');
  const archivedUnits = await validatePartialArchivedUnits(receipt, boundaryRoot, worktreeRoot);
  const preservedAfter = await partialRecoveryPreservationRoots(boundaryRoot, worktreeRoot);
  if (stableHash(preservedAfter) !== stableHash(receipt.preservation_roots)) {
    fail('preservation_invariant_failed');
  }
  const completion = validateContractInvalidPartialRecoveryCompletion(contentAddressedEnvelope({
    schema_version: PARTIAL_RECOVERY_COMPLETION_SCHEMA,
    status: 'COMPLETE', recovery_root: receipt.recovery_root,
    prepared_receipt_root: receipt.content_hash,
    archived_units: archivedUnits,
    archived_unit_set_root: stableHash(archivedUnits),
    preservation_roots_before: receipt.preservation_roots,
    preservation_roots_after: preservedAfter,
    fresh_directory_set_root: stableHash({
      working: FRESH_WORKING_DIRECTORIES, reviews: FRESH_REVIEW_DIRECTORIES,
      audit: ['artifact-failures', 'processing-receipts', 'retrieval-receipts'],
    }),
    destructive_delete_or_overwrite_performed: false,
    production_mutation_performed: false,
    release_or_final_approval_performed: false,
  }), receipt);
  await atomicDurableJson(
    `${receipt.archive_root}/partial-recovery-completion.json`, completion,
    boundaryRoot, worktreeRoot, lock, { exclusive: true },
  );
  await maybeCrash(options, 'PARTIAL_COMPLETION_WRITTEN');
  status = partialStatus(receipt, 'COMPLETE', completed, completion.content_hash);
  await atomicDurableJson(
    PARTIAL_RECOVERY_STATUS_PATH, status, boundaryRoot, worktreeRoot, lock,
  );
  await maybeCrash(options, 'PARTIAL_STATUS_COMPLETE');
  await postflightRestrictedBoundary({ boundaryRoot, worktreeRoot });
  assertExtractionOperationLockHeld(lock);
  return { receipt, completion, repeated: false };
}

export async function recoverContractInvalidPartialExtraction(options) {
  if (resolve(options.boundaryRoot) !== resolve(DEFAULT_RESTRICTED_BOUNDARY)
      || resolve(options.worktreeRoot) !== WORKTREE_ROOT_FROM_MODULE
      || resolve(options.worktreeRoot) !== resolve(DEFAULT_WORKTREE_ROOT)) {
    fail('boundary_rejected');
  }
  const liveOptions = {
    boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
  };
  const result = await withExtractionOperationLock({
    boundaryRoot: liveOptions.boundaryRoot,
    worktreeRoot: liveOptions.worktreeRoot,
    timeoutSeconds: 0,
  }, (lock) => partialRecoveryCore(liveOptions, lock));
  return {
    result: 'pass', recovery_root: result.receipt.recovery_root,
    completion_root: result.completion.content_hash,
    archived_unit_count: result.completion.archived_units.length,
    destructive_delete_or_overwrite_count: 0,
    production_mutation_count: 0,
    repeated_completion: result.repeated,
  };
}

/** Test-only fixture helpers; live callers cannot inject prepared evidence or crash hooks. */
export async function prepareContractInvalidPartialRecoveryFixture(options) {
  if (options?.testOnly !== true || !isAbsolute(options.boundaryRoot)
      || !isAbsolute(options.worktreeRoot)) fail('argument_rejected');
  const moveRoots = await partialRecoveryUnitRoots(options.boundaryRoot, options.worktreeRoot);
  const preservation = await partialRecoveryPreservationRoots(
    options.boundaryRoot, options.worktreeRoot,
  );
  return buildContractInvalidPartialRecoveryReceipt({
    journalRoot: 'a'.repeat(64), moveRoots, preservationRoots: preservation,
  });
}

export async function recoverContractInvalidPartialExtractionFixture(options) {
  if (options?.testOnly !== true || !isAbsolute(options.boundaryRoot)
      || !isAbsolute(options.worktreeRoot) || !options.preparedReceipt) {
    fail('argument_rejected');
  }
  const result = await withExtractionOperationLock({
    boundaryRoot: options.boundaryRoot,
    worktreeRoot: options.worktreeRoot,
    timeoutSeconds: 0,
  }, (lock) => partialRecoveryCore(options, lock));
  return {
    result: 'pass', recovery_root: result.receipt.recovery_root,
    completion_root: result.completion.content_hash,
    archived_unit_count: result.completion.archived_units.length,
    repeated_completion: result.repeated,
  };
}

export async function preflightContractInvalidPartialRecovery(options) {
  if (resolve(options.boundaryRoot) !== resolve(DEFAULT_RESTRICTED_BOUNDARY)
      || resolve(options.worktreeRoot) !== WORKTREE_ROOT_FROM_MODULE
      || resolve(options.worktreeRoot) !== resolve(DEFAULT_WORKTREE_ROOT)) {
    fail('boundary_rejected');
  }
  return withExtractionOperationLock({
    boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
    timeoutSeconds: 0,
  }, async (lock) => {
    await preflightRestrictedBoundary({
      boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
      worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
    });
    await loadContractInvalidPartialRun(
      DEFAULT_RESTRICTED_BOUNDARY, WORKTREE_ROOT_FROM_MODULE,
    );
    const moveRoots = await partialRecoveryUnitRoots(
      DEFAULT_RESTRICTED_BOUNDARY, WORKTREE_ROOT_FROM_MODULE,
    );
    const preservation = await partialRecoveryPreservationRoots(
      DEFAULT_RESTRICTED_BOUNDARY, WORKTREE_ROOT_FROM_MODULE,
    );
    const journal = await readRestrictedJson(JOURNAL_PATH, {
      boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
      worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
    });
    const receipt = buildContractInvalidPartialRecoveryReceipt({
      journalRoot: stableHash(journal), moveRoots, preservationRoots: preservation,
    });
    assertExtractionOperationLockHeld(lock);
    return {
      result: 'pass', recovery_root: receipt.recovery_root,
      protected_reads: true, protected_writes: 0, network_requests: 0,
      move_unit_count: PARTIAL_RECOVERY_UNITS.length,
      preserved_root_count: Object.keys(preservation).length,
    };
  });
}

const FINALIZER_DECISION_KEYS = Object.freeze([
  'schema_version', 'decision', 'authority_ticket_sha256', 'extraction_run_id',
  'old_run_contract_root', 'current_run_contract_root', 'old_finalizer_sha256',
  'corrected_finalizer_sha256', 'old_run_contract_manifest', 'old_manifest_root',
  'current_run_contract_manifest', 'current_manifest_root', 'approved_roots',
  'rotation_tcb_hashes', 'rotation_tcb_root',
  'archive_scope', 'non_destructive_archive',
  'raw_acquisition_alias_decisions_preserved', 'production_mutation_authorized',
  'release_or_final_approval_authority', 'content_hash',
]);
const FINALIZER_APPROVED_ROOT_KEYS = Object.freeze([
  'extraction_state_root', 'journal_root', 'extraction_receipt_root',
  'working_tree_root', 'reviews_tree_root', 'processing_receipts_tree_root',
  'retrieval_receipts_tree_root', 'artifact_failures_tree_root',
  'move_unit_set_root',
  'artifact_ledger_root', 'coverage_receipt_root',
  'finalization_completion_root', 'packet_set_root', 'submission_set_root',
  'receipt_set_root', 'finalizer_contract_root',
]);
const FINALIZER_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'status', 'decision_root', 'rotation_root', 'archive_root',
  'extraction_run_id', 'old_run_contract_root', 'current_run_contract_root',
  'move_unit_roots', 'preservation_roots', 'finalization_roots',
  'fixed_move_contract', 'non_destructive_archive',
  'production_mutation_authorized', 'release_or_final_approval_authority', 'content_hash',
]);
const FINALIZER_STATUS_KEYS = Object.freeze([
  'schema_version', 'status', 'rotation_root', 'archive_root',
  'prepared_receipt_path', 'prepared_receipt_root', 'completed_units',
  'completion_receipt_path', 'completion_receipt_root', 'content_hash',
]);
const FINALIZER_COMPLETION_KEYS = Object.freeze([
  'schema_version', 'status', 'rotation_root', 'prepared_receipt_root',
  'decision_root', 'archived_units', 'archived_unit_set_root',
  'preservation_roots_before', 'preservation_roots_after',
  'fresh_directory_set_root', 'destructive_delete_or_overwrite_performed',
  'production_mutation_performed', 'release_or_final_approval_performed', 'content_hash',
]);
const FINALIZER_ARCHIVED_UNIT_KEYS = PARTIAL_ARCHIVED_UNIT_KEYS;

function expectedRunContractManifestPaths() {
  return [
    ...RUN_CONTRACT_MODULE_PATHS,
    ...RUN_CONTRACT_EXTERNAL_PATHS.map((entry) => entry.relative_path),
  ];
}

export async function currentRunContractManifest() {
  const output = [];
  for (const relativePath of RUN_CONTRACT_MODULE_PATHS) {
    output.push({
      relative_path: relativePath,
      sha256: await directFileSha256(resolve(MODULE_ROOT, relativePath)),
    });
  }
  for (const entry of RUN_CONTRACT_EXTERNAL_PATHS) {
    output.push({
      relative_path: entry.relative_path,
      sha256: await directFileSha256(entry.absolute_path),
    });
  }
  return output;
}

export async function currentFinalizerDriftRotationTcbHashes() {
  const output = [];
  for (const relativePath of FINALIZER_DRIFT_ROTATION_TCB_PATHS) {
    output.push({
      relative_path: relativePath,
      sha256: await directFileSha256(resolve(MODULE_ROOT, relativePath)),
    });
  }
  return output;
}

function validateRotationTcbShape(values) {
  if (!Array.isArray(values) || values.length !== FINALIZER_DRIFT_ROTATION_TCB_PATHS.length) {
    fail('finalizer_drift_rotation_rejected');
  }
  for (const [index, value] of values.entries()) {
    if (!exactKeys(value, ['relative_path', 'sha256'])
        || value.relative_path !== FINALIZER_DRIFT_ROTATION_TCB_PATHS[index]
        || !SHA256.test(value.sha256 ?? '')) fail('finalizer_drift_rotation_rejected');
  }
}

function validateManifestShape(manifest) {
  const paths = expectedRunContractManifestPaths();
  if (!Array.isArray(manifest) || manifest.length !== paths.length) {
    fail('finalizer_drift_rotation_rejected');
  }
  for (const [index, item] of manifest.entries()) {
    if (!exactKeys(item, ['relative_path', 'sha256'])
        || item.relative_path !== paths[index] || !SHA256.test(item.sha256 ?? '')) {
      fail('finalizer_drift_rotation_rejected');
    }
  }
  return manifest;
}

function validateFinalizerManifestDelta(oldManifest, currentManifest) {
  validateManifestShape(oldManifest);
  validateManifestShape(currentManifest);
  const deltas = oldManifest.filter(
    (entry, index) => entry.sha256 !== currentManifest[index].sha256,
  );
  const finalizerIndex = expectedRunContractManifestPaths().indexOf(FINALIZER_MANIFEST_PATH);
  if (deltas.length !== 1 || deltas[0].relative_path !== FINALIZER_MANIFEST_PATH
      || oldManifest[finalizerIndex].sha256 !== EXPECTED_OLD_FINALIZER_SHA256
      || currentManifest[finalizerIndex].sha256 !== EXPECTED_CORRECTED_FINALIZER_SHA256) {
    fail('finalizer_drift_rotation_rejected');
  }
}

export async function validateFinalizerDriftRotationDecision(decision, {
  verifyCurrentManifest = true,
  verifyRotationTcb = true,
} = {}) {
  if (!verifyContentAddressedEnvelope(decision)
      || !exactKeys(decision, FINALIZER_DECISION_KEYS)
      || decision.schema_version !== FINALIZER_DRIFT_DECISION_SCHEMA
      || decision.decision !== 'SUPERSEDE_FINALIZED_RUN_FOR_FINALIZER_HASH_DRIFT'
      || decision.authority_ticket_sha256 !== AUTHORITY_TICKET_SHA256
      || typeof decision.extraction_run_id !== 'string' || decision.extraction_run_id.length < 8
      || decision.old_run_contract_root !== EXPECTED_OLD_RUN_CONTRACT_ROOT
      || !SHA256.test(decision.current_run_contract_root ?? '')
      || decision.current_run_contract_root === decision.old_run_contract_root
      || decision.old_finalizer_sha256 !== EXPECTED_OLD_FINALIZER_SHA256
      || decision.corrected_finalizer_sha256 !== EXPECTED_CORRECTED_FINALIZER_SHA256
      || decision.old_manifest_root !== stableHash(decision.old_run_contract_manifest)
      || decision.current_manifest_root !== stableHash(decision.current_run_contract_manifest)
      || decision.rotation_tcb_root !== stableHash(decision.rotation_tcb_hashes)
      || !exactKeys(decision.approved_roots, FINALIZER_APPROVED_ROOT_KEYS)
      || !sameStringSet(decision.archive_scope, FINALIZER_DRIFT_ARCHIVE_SCOPE)
      || decision.non_destructive_archive !== true
      || decision.raw_acquisition_alias_decisions_preserved !== true
      || decision.production_mutation_authorized !== false
      || decision.release_or_final_approval_authority !== false) {
    fail('finalizer_drift_rotation_rejected');
  }
  for (const root of Object.values(decision.approved_roots)) {
    assertHash(root, 'finalizer_drift_rotation_rejected');
  }
  validateFinalizerManifestDelta(
    decision.old_run_contract_manifest, decision.current_run_contract_manifest,
  );
  validateRotationTcbShape(decision.rotation_tcb_hashes);
  if (verifyCurrentManifest) {
    const observed = await currentRunContractManifest();
    if (stableHash(observed) !== stableHash(decision.current_run_contract_manifest)) {
      fail('finalizer_drift_rotation_rejected');
    }
  }
  if (verifyRotationTcb) {
    const observedTcb = await currentFinalizerDriftRotationTcbHashes();
    if (stableHash(observedTcb) !== stableHash(decision.rotation_tcb_hashes)) {
      fail('finalizer_drift_rotation_rejected');
    }
  }
  return decision;
}

export function reconstructRunContractFromManifest(
  manifest, { extractionRunId, acquisitionStateHash, acquisitionReceiptHash },
) {
  validateManifestShape(manifest);
  if (typeof extractionRunId !== 'string' || extractionRunId.length < 8
      || !SHA256.test(acquisitionStateHash ?? '')
      || !SHA256.test(acquisitionReceiptHash ?? '')) {
    fail('finalizer_drift_rotation_rejected');
  }
  const base = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.extraction_run_contract.v1',
    parser_version: PARSER_VERSION,
    pass_definitions: PASS_DEFINITIONS,
    files: manifest,
  });
  return contentAddressedEnvelope({
    ...base,
    extraction_run_id: extractionRunId,
    acquisition_state_hash: acquisitionStateHash,
    acquisition_receipt_hash: acquisitionReceiptHash,
  });
}

async function finalizerDriftPreservationRoots(boundaryRoot, worktreeRoot) {
  return {
    ...await partialRecoveryPreservationRoots(boundaryRoot, worktreeRoot),
    partial_recovery_status: (await inventoryRestrictedTree(
      PARTIAL_RECOVERY_STATUS_PATH, boundaryRoot, worktreeRoot,
    )).tree_root,
    prior_partial_recovery_archive: (await inventoryRestrictedTree(
      `quarantine/contract-invalid-partial-${EXPECTED_PRIOR_PARTIAL_RECOVERY_ROOT}`,
      boundaryRoot, worktreeRoot,
    )).tree_root,
  };
}

async function loadFinalizerDriftRun(decision, boundaryRoot, worktreeRoot, {
  safeLedgerPath = SAFE_LEDGER_PATH,
  safeCoveragePath = SAFE_COVERAGE_PATH,
  safeRoot = MODULE_ROOT,
  expectedContractRoots = null,
} = {}) {
  const [state, journal, extractionReceipt, acquisition, acquisitionReceipt, completion,
    ledger, coverage] =
    await Promise.all([
      readRestrictedJson(STATE_PATH, { boundaryRoot, worktreeRoot }),
      readRestrictedJson(JOURNAL_PATH, { boundaryRoot, worktreeRoot }),
      readRestrictedJson(EXTRACTION_RECEIPT_PATH, { boundaryRoot, worktreeRoot }),
      readRestrictedJson('state/acquisition-state.json', { boundaryRoot, worktreeRoot }),
      readRestrictedJson('audit/acquisition-receipt.json', { boundaryRoot, worktreeRoot }),
      readRestrictedJson('reviews/finalization/specialist-batch-finalization.json', {
        boundaryRoot, worktreeRoot,
      }),
      readSecureSafeEnvelope(safeLedgerPath, safeRoot),
      readSecureSafeEnvelope(safeCoveragePath, safeRoot),
    ]);
  const completeCount = state.artifacts?.filter((artifact) => (
    ['COMPLETE', 'COMPLETE_WITH_QUARANTINE'].includes(artifact.final_artifact_status)
  )).length;
  if (!verifyContentAddressedEnvelope(state)
      || !verifyContentAddressedEnvelope(extractionReceipt)
      || !verifyContentAddressedEnvelope(acquisition)
      || !verifyContentAddressedEnvelope(acquisitionReceipt)
      || !verifyContentAddressedEnvelope(completion)
      || state.extraction_run_id !== decision.extraction_run_id
      || state.run_contract_hash !== decision.old_run_contract_root
      || state.content_hash !== decision.approved_roots.extraction_state_root
      || state.artifacts?.length !== EXPECTED_ARTIFACT_COUNT
      || state.extraction_cursor !== EXPECTED_ARTIFACT_COUNT
      || state.extraction_complete !== false
      || completeCount !== EXPECTED_ARTIFACT_COUNT
      || new Set(state.artifacts.map((artifact) => artifact.artifact_alias)).size
        !== EXPECTED_ARTIFACT_COUNT
      || state.artifacts.some((artifact) => (
        artifact.run_contract_hash !== state.run_contract_hash
        || !Array.isArray(artifact.pass_receipts)
        || artifact.pass_receipts.length !== PASS_DEFINITIONS.length
        || artifact.pass_receipts.some((pass) => pass.status !== 'COMPLETE')
      ))
      || validateJournal(journal).length !== 0
      || journal.events?.length !== EXPECTED_JOURNAL_EVENT_COUNT
      || journal.extraction_run_id !== state.extraction_run_id
      || journal.run_contract_hash !== state.run_contract_hash
      || journal.roster_root !== state.roster_root
      || stableHash(journal) !== decision.approved_roots.journal_root
      || extractionReceipt.content_hash !== decision.approved_roots.extraction_receipt_root
      || extractionReceipt.extraction_state_hash !== state.content_hash
      || extractionReceipt.roster_root !== state.roster_root
      || extractionReceipt.run_contract_hash !== state.run_contract_hash
      || extractionReceipt.transcript_artifact_count !== EXPECTED_ARTIFACT_COUNT
      || extractionReceipt.nodes_artifact_count !== 99
      || extractionReceipt.automated_pass_cell_count !== EXPECTED_JOURNAL_EVENT_COUNT
      || extractionReceipt.specialist_verification_cell_count !== 0
      || extractionReceipt.specialist_role_review_count !== 0
      || extractionReceipt.exact_journal_coverage !== true
      || extractionReceipt.extraction_complete !== false
      || extractionReceipt.no_production_mutation !== true
      || state.inventory_index_hash !== extractionReceipt.inventory_index_hash
      || state.concept_inventory_hash !== extractionReceipt.concept_inventory_hash
      || state.duplicate_relationship_inventory_hash
        !== extractionReceipt.duplicate_relationship_inventory_hash
      || !verifyContentAddressedEnvelope(ledger)
      || ledger.content_hash !== decision.approved_roots.artifact_ledger_root
      || ledger.content_hash !== state.artifact_ledger_hash
      || ledger.extraction_run_id !== state.extraction_run_id
      || ledger.extraction_complete !== false
      || ledger.artifacts?.length !== EXPECTED_ARTIFACT_COUNT
      || ledger.observed_cohort_invariants?.transcript_artifact_count
        !== EXPECTED_ARTIFACT_COUNT
      || ledger.observed_cohort_invariants?.nodes_artifact_count !== 99
      || ledger.processing_summary?.required_pass_cell_count
        !== EXPECTED_JOURNAL_EVENT_COUNT
      || ledger.processing_summary?.pass_cells_complete_count
        !== EXPECTED_JOURNAL_EVENT_COUNT
      || ledger.processing_summary?.unaccounted_pass_cell_count !== 0
      || ledger.finalization_summary?.completed_specialist_verification_cell_count !== 0
      || ledger.finalization_summary?.completed_specialist_role_review_count !== 0
      || ledger.finalization_summary?.status !== 'PENDING_SPECIALIST_REVIEW'
      || validateCoverage(ledger, {
        requireObservedCohort: true, requireFinalization: false,
      }).result !== 'pass'
      || validateCoverage(ledger, {
        requireObservedCohort: true, requireFinalization: true,
      }).result === 'pass'
      || !verifyContentAddressedEnvelope(coverage)
      || coverage.content_hash !== decision.approved_roots.coverage_receipt_root
      || coverage.extraction_run_id !== state.extraction_run_id
      || coverage.transcript_artifacts_expected !== EXPECTED_ARTIFACT_COUNT
      || coverage.transcript_artifacts_processed !== EXPECTED_ARTIFACT_COUNT
      || coverage.automated_pass_cells_required !== EXPECTED_JOURNAL_EVENT_COUNT
      || coverage.automated_pass_cells_complete !== EXPECTED_JOURNAL_EVENT_COUNT
      || coverage.specialist_verification_cells_complete !== 0
      || coverage.specialist_role_reviews_complete !== 0
      || coverage.extraction_complete !== false
      || completion.content_hash !== decision.approved_roots.finalization_completion_root
      || completion.status !== 'COMPLETE'
      || completion.extraction_run_id !== state.extraction_run_id
      || completion.run_contract_hash !== state.run_contract_hash
      || completion.packet_count !== EXPECTED_ARTIFACT_COUNT
      || completion.role_batch_count !== 4
      || completion.artifact_submission_count !== EXPECTED_ARTIFACT_COUNT
      || completion.specialist_role_review_count !== 388
      || completion.specialist_verification_cell_count !== 194
      || completion.receipt_count !== EXPECTED_ARTIFACT_COUNT
      || completion.packet_set_root !== decision.approved_roots.packet_set_root
      || completion.submission_set_root !== decision.approved_roots.submission_set_root
      || completion.receipt_set_root !== decision.approved_roots.receipt_set_root
      || completion.finalizer_contract_root !== decision.approved_roots.finalizer_contract_root
      || completion.no_release_or_final_approval_authority !== true
      || completion.production_mutation_performed !== false) {
    fail('finalizer_drift_rotation_rejected');
  }
  try {
    validateJournalAgainstExtractionState(state, journal);
  } catch (error) {
    if (error instanceof RotationError) fail('finalizer_drift_rotation_rejected');
    throw error;
  }
  const contractInputs = {
    extractionRunId: state.extraction_run_id,
    acquisitionStateHash: acquisition.content_hash,
    acquisitionReceiptHash: acquisitionReceipt.content_hash,
  };
  const oldContract = reconstructRunContractFromManifest(
    decision.old_run_contract_manifest, contractInputs,
  );
  const currentContract = reconstructRunContractFromManifest(
    decision.current_run_contract_manifest, contractInputs,
  );
  const requiredOldRoot = expectedContractRoots?.old ?? decision.old_run_contract_root;
  const requiredCurrentRoot = expectedContractRoots?.current ?? decision.current_run_contract_root;
  if (state.run_contract_hash !== requiredOldRoot
      || oldContract.content_hash !== requiredOldRoot
      || currentContract.content_hash !== requiredCurrentRoot) {
    fail('finalizer_drift_rotation_rejected');
  }
  const moveRoots = await partialRecoveryUnitRoots(boundaryRoot, worktreeRoot);
  if (stableHash(moveRoots) !== decision.approved_roots.move_unit_set_root) {
    fail('finalizer_drift_rotation_rejected');
  }
  return { state, moveRoots, completion };
}

/** Test-only authoritative-loader entrypoint; never reachable from the live CLI. */
export async function validateFinalizerDriftRunFixture(options) {
  if (options?.testOnly !== true || !options.decision
      || !isAbsolute(options.boundaryRoot) || !isAbsolute(options.worktreeRoot)
      || !isAbsolute(options.safeLedgerPath) || !isAbsolute(options.safeCoveragePath)
      || !isAbsolute(options.safeRoot) || !isPlainObject(options.expectedContractRoots)) {
    fail('argument_rejected');
  }
  return loadFinalizerDriftRun(
    options.decision, options.boundaryRoot, options.worktreeRoot, {
      safeLedgerPath: options.safeLedgerPath,
      safeCoveragePath: options.safeCoveragePath,
      safeRoot: options.safeRoot,
      expectedContractRoots: options.expectedContractRoots,
    },
  );
}

export function buildFinalizerDriftRotationReceipt({
  decision, moveRoots, preservationRoots: preservation,
}) {
  const moveKeys = FINALIZER_DRIFT_UNITS.map((unit) => unit.key);
  const preservationKeys = [
    ...PRESERVATION_KEYS, 'supersession_status', 'supersession_receipts',
    'supersession_completions', 'prior_superseded_archive',
    'partial_recovery_status', 'prior_partial_recovery_archive',
  ];
  if (!verifyContentAddressedEnvelope(decision)
      || !exactKeys(moveRoots, moveKeys) || !exactKeys(preservation, preservationKeys)) {
    fail('finalizer_drift_rotation_rejected');
  }
  for (const root of [...Object.values(moveRoots), ...Object.values(preservation)]) {
    assertHash(root, 'finalizer_drift_rotation_rejected');
  }
  const finalizationRoots = Object.fromEntries(
    ['finalization_completion_root', 'packet_set_root', 'submission_set_root',
      'receipt_set_root', 'finalizer_contract_root']
      .map((key) => [key, decision.approved_roots[key]]),
  );
  const rotationRoot = stableHash({
    decision_root: decision.content_hash,
    move_unit_roots: moveRoots,
    preservation_roots: preservation,
    finalization_roots: finalizationRoots,
    fixed_move_contract: FINALIZER_DRIFT_UNITS,
  });
  return validateFinalizerDriftRotationReceipt(contentAddressedEnvelope({
    schema_version: FINALIZER_DRIFT_RECEIPT_SCHEMA,
    status: 'PREPARED_FOR_FINALIZER_DRIFT_ROTATION',
    decision_root: decision.content_hash,
    rotation_root: rotationRoot,
    archive_root: `quarantine/finalizer-drift-supersession-${rotationRoot}`,
    extraction_run_id: decision.extraction_run_id,
    old_run_contract_root: decision.old_run_contract_root,
    current_run_contract_root: decision.current_run_contract_root,
    move_unit_roots: moveRoots,
    preservation_roots: preservation,
    finalization_roots: finalizationRoots,
    fixed_move_contract: FINALIZER_DRIFT_UNITS,
    non_destructive_archive: true,
    production_mutation_authorized: false,
    release_or_final_approval_authority: false,
  }));
}

export function validateFinalizerDriftRotationReceipt(receipt, decision = null) {
  const moveKeys = FINALIZER_DRIFT_UNITS.map((unit) => unit.key);
  const preservationKeys = [
    ...PRESERVATION_KEYS, 'supersession_status', 'supersession_receipts',
    'supersession_completions', 'prior_superseded_archive',
    'partial_recovery_status', 'prior_partial_recovery_archive',
  ];
  const finalizationKeys = [
    'finalization_completion_root', 'packet_set_root', 'submission_set_root',
    'receipt_set_root', 'finalizer_contract_root',
  ];
  if (!verifyContentAddressedEnvelope(receipt)
      || !exactKeys(receipt, FINALIZER_RECEIPT_KEYS)
      || receipt.schema_version !== FINALIZER_DRIFT_RECEIPT_SCHEMA
      || receipt.status !== 'PREPARED_FOR_FINALIZER_DRIFT_ROTATION'
      || !SHA256.test(receipt.decision_root ?? '')
      || !exactKeys(receipt.move_unit_roots, moveKeys)
      || !exactKeys(receipt.preservation_roots, preservationKeys)
      || !exactKeys(receipt.finalization_roots, finalizationKeys)
      || stableHash(receipt.fixed_move_contract) !== stableHash(FINALIZER_DRIFT_UNITS)
      || receipt.archive_root
        !== `quarantine/finalizer-drift-supersession-${receipt.rotation_root}`
      || receipt.non_destructive_archive !== true
      || receipt.production_mutation_authorized !== false
      || receipt.release_or_final_approval_authority !== false) {
    fail('finalizer_drift_rotation_rejected');
  }
  for (const root of [
    ...Object.values(receipt.move_unit_roots), ...Object.values(receipt.preservation_roots),
    ...Object.values(receipt.finalization_roots),
  ]) assertHash(root, 'finalizer_drift_rotation_rejected');
  const expectedRoot = stableHash({
    decision_root: receipt.decision_root,
    move_unit_roots: receipt.move_unit_roots,
    preservation_roots: receipt.preservation_roots,
    finalization_roots: receipt.finalization_roots,
    fixed_move_contract: FINALIZER_DRIFT_UNITS,
  });
  if (receipt.rotation_root !== expectedRoot
      || (decision && (receipt.decision_root !== decision.content_hash
        || receipt.extraction_run_id !== decision.extraction_run_id
        || receipt.old_run_contract_root !== decision.old_run_contract_root
        || receipt.current_run_contract_root !== decision.current_run_contract_root))) {
    fail('finalizer_drift_rotation_rejected');
  }
  return receipt;
}

function finalizerPreparedPath(root) {
  return `audit/finalizer-drift-rotation-receipts/${root}.json`;
}
function finalizerCompletionPath(root) {
  return `audit/finalizer-drift-rotation-completions/${root}.json`;
}

function finalizerStatus(receipt, status, completedUnits, completion = null) {
  return contentAddressedEnvelope({
    schema_version: FINALIZER_DRIFT_STATUS_SCHEMA,
    status,
    rotation_root: receipt.rotation_root,
    archive_root: receipt.archive_root,
    prepared_receipt_path: finalizerPreparedPath(receipt.rotation_root),
    prepared_receipt_root: receipt.content_hash,
    completed_units: [...completedUnits],
    completion_receipt_path: completion ? finalizerCompletionPath(receipt.rotation_root) : null,
    completion_receipt_root: completion?.content_hash ?? null,
  });
}

export function validateFinalizerDriftRotationStatus(status, receipt = null) {
  const unitKeys = FINALIZER_DRIFT_UNITS.map((unit) => unit.key);
  if (!verifyContentAddressedEnvelope(status) || !exactKeys(status, FINALIZER_STATUS_KEYS)
      || status.schema_version !== FINALIZER_DRIFT_STATUS_SCHEMA
      || !['PREPARED', 'MOVING', 'COMPLETE'].includes(status.status)
      || !SHA256.test(status.rotation_root ?? '')
      || status.archive_root
        !== `quarantine/finalizer-drift-supersession-${status.rotation_root}`
      || status.prepared_receipt_path !== finalizerPreparedPath(status.rotation_root)
      || !SHA256.test(status.prepared_receipt_root ?? '')
      || !Array.isArray(status.completed_units)
      || new Set(status.completed_units).size !== status.completed_units.length
      || !status.completed_units.every((key, index) => key === unitKeys[index])
      || (status.status === 'PREPARED' && status.completed_units.length !== 0)
      || (status.status === 'MOVING'
        && (status.completed_units.length < 1 || status.completed_units.length > unitKeys.length))
      || (status.status === 'COMPLETE'
        && (status.completed_units.length !== unitKeys.length
          || status.completion_receipt_path !== finalizerCompletionPath(status.rotation_root)
          || !SHA256.test(status.completion_receipt_root ?? '')))
      || (status.status !== 'COMPLETE'
        && (status.completion_receipt_path !== null
          || status.completion_receipt_root !== null))) {
    fail('finalizer_drift_rotation_rejected');
  }
  if (receipt && (status.rotation_root !== receipt.rotation_root
      || status.prepared_receipt_root !== receipt.content_hash)) {
    fail('finalizer_drift_rotation_rejected');
  }
  return status;
}

export function validateFinalizerDriftRotationCompletion(completion, receipt) {
  const keys = FINALIZER_DRIFT_UNITS.map((unit) => unit.key);
  if (!verifyContentAddressedEnvelope(completion)
      || !exactKeys(completion, FINALIZER_COMPLETION_KEYS)
      || completion.schema_version !== FINALIZER_DRIFT_COMPLETION_SCHEMA
      || completion.status !== 'COMPLETE'
      || completion.rotation_root !== receipt.rotation_root
      || completion.prepared_receipt_root !== receipt.content_hash
      || completion.decision_root !== receipt.decision_root
      || !Array.isArray(completion.archived_units)
      || completion.archived_units.length !== keys.length
      || completion.archived_units.some((unit, index) => (
        !exactKeys(unit, FINALIZER_ARCHIVED_UNIT_KEYS)
        || unit.key !== keys[index]
        || unit.destination !== `${receipt.archive_root}/${FINALIZER_DRIFT_UNITS[index].source}`
        || unit.strategy !== FINALIZER_DRIFT_UNITS[index].strategy
        || unit.tree_root !== receipt.move_unit_roots[unit.key]
        || !Number.isSafeInteger(unit.entry_count) || unit.entry_count < 1
        || !Number.isSafeInteger(unit.file_count) || unit.file_count < 0
        || !Number.isSafeInteger(unit.byte_count) || unit.byte_count < 0
      ))
      || completion.archived_unit_set_root !== stableHash(completion.archived_units)
      || stableHash(completion.preservation_roots_before)
        !== stableHash(receipt.preservation_roots)
      || stableHash(completion.preservation_roots_after)
        !== stableHash(receipt.preservation_roots)
      || completion.fresh_directory_set_root !== stableHash({
        working: FRESH_WORKING_DIRECTORIES, reviews: FRESH_REVIEW_DIRECTORIES,
        audit: ['artifact-failures', 'processing-receipts', 'retrieval-receipts'],
      })
      || completion.destructive_delete_or_overwrite_performed !== false
      || completion.production_mutation_performed !== false
      || completion.release_or_final_approval_performed !== false) {
    fail('finalizer_drift_rotation_rejected');
  }
  return completion;
}

async function validateFinalizerArchiveShape(receipt, boundaryRoot, worktreeRoot, status = null) {
  const root = await restrictedAbsolute(receipt.archive_root, boundaryRoot, worktreeRoot, {
    kind: 'directory', mustExist: true,
  });
  const allowed = new Set([
    'finalizer-drift-rotation-receipt.json', 'finalizer-drift-rotation-completion.json',
    'working', 'reviews', 'state', 'audit',
  ]);
  const entries = await readdir(root, { withFileTypes: true });
  if (entries.some((entry) => !allowed.has(entry.name))) fail('archive_collision');
  if (entries.some((entry) => entry.name === 'finalizer-drift-rotation-completion.json')
      && (!status || status.completed_units?.length !== FINALIZER_DRIFT_UNITS.length)) {
    fail('archive_collision');
  }
  for (const [name, names] of [
    ['state', ['extraction-state.json', 'extraction-journal.json']],
    ['audit', ['extraction-receipt.json', 'processing-receipts',
      'retrieval-receipts', 'artifact-failures']],
  ]) {
    const path = join(root, name);
    if (!(await optionalLstat(path))) continue;
    const children = await readdir(path);
    if (children.some((child) => !names.includes(child))) fail('archive_collision');
  }
}

async function validateFinalizerProgress(receipt, status, boundaryRoot, worktreeRoot) {
  await validateFinalizerArchiveShape(receipt, boundaryRoot, worktreeRoot, status);
  const completedCount = status.completed_units.length;
  for (const [index, unit] of FINALIZER_DRIFT_UNITS.entries()) {
    const source = await restrictedAbsolute(unit.source, boundaryRoot, worktreeRoot, {
      mustExist: false,
    });
    const destination = await restrictedAbsolute(
      `${receipt.archive_root}/${unit.source}`, boundaryRoot, worktreeRoot, { mustExist: false },
    );
    const sourceStat = await optionalLstat(source);
    const destinationStat = await optionalLstat(destination);
    if (index < completedCount) {
      if (!destinationStat) fail('archive_incomplete');
      if ((await inventoryAbsoluteTree(destination)).tree_root
          !== receipt.move_unit_roots[unit.key]) fail('archive_manifest_mismatch');
      if (sourceStat) {
        const inventory = await inventoryAbsoluteTree(source);
        const fresh = unit.strategy === 'ATOMIC_DIRECTORY_SWAP'
          ? validFreshSwapInventory(unit, inventory)
          : ['artifact_failures', 'processing_receipts', 'retrieval_receipts'].includes(unit.key)
            && inventory.entry_count === 1 && inventory.file_count === 0;
        if (!fresh) fail('archive_collision');
      }
    } else if (index > completedCount || status.status === 'COMPLETE') {
      if (status.status === 'COMPLETE') continue;
      if (!sourceStat || destinationStat
          || (await inventoryAbsoluteTree(source)).tree_root
            !== receipt.move_unit_roots[unit.key]) fail('archive_collision');
    } else {
      const sourceRoot = sourceStat ? (await inventoryAbsoluteTree(source)).tree_root : null;
      const destinationInventory = destinationStat
        ? await inventoryAbsoluteTree(destination) : null;
      const before = sourceRoot === receipt.move_unit_roots[unit.key]
        && (unit.strategy !== 'ATOMIC_DIRECTORY_SWAP'
          ? !destinationStat
          : !destinationStat || (destinationInventory.entry_count === 1
            && destinationInventory.file_count === 0));
      const after = destinationInventory?.tree_root === receipt.move_unit_roots[unit.key]
        && (unit.strategy === 'ATOMIC_DIRECTORY_SWAP'
          ? sourceStat && validFreshSwapInventory(unit, await inventoryAbsoluteTree(source))
          : !sourceStat);
      if (!before && !after) fail('archive_collision');
    }
  }
}

async function validateFinalizerArchivedUnits(receipt, boundaryRoot, worktreeRoot) {
  const output = [];
  for (const unit of FINALIZER_DRIFT_UNITS) {
    const destination = `${receipt.archive_root}/${unit.source}`;
    const inventory = await inventoryRestrictedTree(destination, boundaryRoot, worktreeRoot);
    if (inventory.tree_root !== receipt.move_unit_roots[unit.key]) {
      fail('archive_manifest_mismatch');
    }
    output.push({
      key: unit.key, destination, strategy: unit.strategy,
      tree_root: inventory.tree_root, entry_count: inventory.entry_count,
      file_count: inventory.file_count, byte_count: inventory.byte_count,
    });
  }
  return output;
}

async function validateFinalizerAuthorityUnderLock(options, lock) {
  assertExtractionOperationLockHeld(lock);
  const candidate = options?.testOnly === true
    ? (typeof options.authorityLoader === 'function'
      ? await options.authorityLoader() : options.decision)
    : await readSecureSafeEnvelope(FINALIZER_DRIFT_DECISION_PATH);
  const decision = await validateFinalizerDriftRotationDecision(candidate, {
    verifyCurrentManifest: options?.testOnly !== true,
  });
  assertExtractionOperationLockHeld(lock);
  return decision;
}

async function finalizerDriftCore(options, lock) {
  const { boundaryRoot, worktreeRoot } = options;
  assertExtractionOperationLockHeld(lock);
  let decision = await validateFinalizerAuthorityUnderLock(options, lock);
  await preflightRestrictedBoundary({ boundaryRoot, worktreeRoot });
  let status = await optionalRestrictedJson(
    FINALIZER_DRIFT_STATUS_PATH, boundaryRoot, worktreeRoot,
  );
  let receipt;
  if (status) {
    validateFinalizerDriftRotationStatus(status);
    receipt = validateFinalizerDriftRotationReceipt(await readRestrictedJson(
      status.prepared_receipt_path, { boundaryRoot, worktreeRoot },
    ), decision);
    validateFinalizerDriftRotationStatus(status, receipt);
    await validateFinalizerProgress(receipt, status, boundaryRoot, worktreeRoot);
    if (status.status === 'COMPLETE') {
      const completion = validateFinalizerDriftRotationCompletion(await readRestrictedJson(
        status.completion_receipt_path, { boundaryRoot, worktreeRoot },
      ), receipt);
      if (completion.content_hash !== status.completion_receipt_root) {
        fail('finalizer_drift_rotation_rejected');
      }
      const archived = await validateFinalizerArchivedUnits(
        receipt, boundaryRoot, worktreeRoot,
      );
      const preserved = await finalizerDriftPreservationRoots(boundaryRoot, worktreeRoot);
      await validateFreshPartialTrees(boundaryRoot, worktreeRoot);
      if (stableHash(archived) !== stableHash(completion.archived_units)
          || stableHash(preserved) !== stableHash(receipt.preservation_roots)) {
        fail('preservation_invariant_failed');
      }
      await postflightRestrictedBoundary({ boundaryRoot, worktreeRoot });
      return { receipt, completion, repeated: true };
    }
  } else {
    let moveRoots;
    let preservation;
    if (options?.testOnly === true && options.preparedReceipt) {
      receipt = validateFinalizerDriftRotationReceipt(options.preparedReceipt, decision);
      moveRoots = await partialRecoveryUnitRoots(boundaryRoot, worktreeRoot);
      preservation = await finalizerDriftPreservationRoots(boundaryRoot, worktreeRoot);
      if (stableHash(moveRoots) !== stableHash(receipt.move_unit_roots)
          || stableHash(preservation) !== stableHash(receipt.preservation_roots)) {
        fail('finalizer_drift_rotation_rejected');
      }
    } else {
      const loaded = await loadFinalizerDriftRun(decision, boundaryRoot, worktreeRoot);
      moveRoots = loaded.moveRoots;
      preservation = await finalizerDriftPreservationRoots(boundaryRoot, worktreeRoot);
      receipt = buildFinalizerDriftRotationReceipt({ decision, moveRoots,
        preservationRoots: preservation });
    }
    if (options?.testOnly === true
        && typeof options.beforeFirstMutationInjector === 'function') {
      await options.beforeFirstMutationInjector();
    }
    const immediateDecision = await validateFinalizerAuthorityUnderLock(options, lock);
    if (immediateDecision.content_hash !== decision.content_hash) {
      fail('finalizer_drift_rotation_rejected');
    }
    decision = immediateDecision;
    await reserveArchive(receipt, { status: 'INITIALIZING' }, boundaryRoot, worktreeRoot, lock);
    await validateFinalizerArchiveShape(receipt, boundaryRoot, worktreeRoot);
    await atomicDurableJson(
      `${receipt.archive_root}/finalizer-drift-rotation-receipt.json`, receipt,
      boundaryRoot, worktreeRoot, lock, { exclusive: true },
    );
    await atomicDurableJson(
      finalizerPreparedPath(receipt.rotation_root), receipt,
      boundaryRoot, worktreeRoot, lock, { exclusive: true },
    );
    await maybeCrash(options, 'FINALIZER_DRIFT_RECEIPTS_WRITTEN');
    status = finalizerStatus(receipt, 'PREPARED', []);
    await atomicDurableJson(
      FINALIZER_DRIFT_STATUS_PATH, status, boundaryRoot, worktreeRoot, lock,
    );
    await maybeCrash(options, 'FINALIZER_DRIFT_STATUS_PREPARED');
  }

  const immediateDecision = await validateFinalizerAuthorityUnderLock(options, lock);
  if (immediateDecision.content_hash !== decision.content_hash
      || immediateDecision.content_hash !== receipt.decision_root) {
    fail('finalizer_drift_rotation_rejected');
  }
  await reserveArchive(receipt, status, boundaryRoot, worktreeRoot, lock);
  const completed = new Set(status.completed_units);
  for (const unit of FINALIZER_DRIFT_UNITS) {
    if (completed.has(unit.key)) continue;
    await moveOne(unit, receipt, boundaryRoot, worktreeRoot, lock, options);
    await maybeCrash(options, `FINALIZER_DRIFT_MOVED_${unit.key}`);
    completed.add(unit.key);
    status = finalizerStatus(receipt, 'MOVING', completed);
    await atomicDurableJson(
      FINALIZER_DRIFT_STATUS_PATH, status, boundaryRoot, worktreeRoot, lock,
    );
    await maybeCrash(options, `FINALIZER_DRIFT_STATUS_${unit.key}`);
  }
  await ensureFreshTrees(boundaryRoot, worktreeRoot, lock);
  await ensureRestrictedDirectory('audit/artifact-failures', boundaryRoot, worktreeRoot, lock);
  await validateFreshPartialTrees(boundaryRoot, worktreeRoot);
  await maybeCrash(options, 'FINALIZER_DRIFT_FRESH_TREES_CREATED');
  const archivedUnits = await validateFinalizerArchivedUnits(
    receipt, boundaryRoot, worktreeRoot,
  );
  const preservedAfter = await finalizerDriftPreservationRoots(boundaryRoot, worktreeRoot);
  if (stableHash(preservedAfter) !== stableHash(receipt.preservation_roots)) {
    fail('preservation_invariant_failed');
  }
  const completion = validateFinalizerDriftRotationCompletion(contentAddressedEnvelope({
    schema_version: FINALIZER_DRIFT_COMPLETION_SCHEMA,
    status: 'COMPLETE', rotation_root: receipt.rotation_root,
    prepared_receipt_root: receipt.content_hash, decision_root: receipt.decision_root,
    archived_units: archivedUnits, archived_unit_set_root: stableHash(archivedUnits),
    preservation_roots_before: receipt.preservation_roots,
    preservation_roots_after: preservedAfter,
    fresh_directory_set_root: stableHash({
      working: FRESH_WORKING_DIRECTORIES, reviews: FRESH_REVIEW_DIRECTORIES,
      audit: ['artifact-failures', 'processing-receipts', 'retrieval-receipts'],
    }),
    destructive_delete_or_overwrite_performed: false,
    production_mutation_performed: false,
    release_or_final_approval_performed: false,
  }), receipt);
  await atomicDurableJson(
    `${receipt.archive_root}/finalizer-drift-rotation-completion.json`, completion,
    boundaryRoot, worktreeRoot, lock, { exclusive: true },
  );
  await atomicDurableJson(
    finalizerCompletionPath(receipt.rotation_root), completion,
    boundaryRoot, worktreeRoot, lock, { exclusive: true },
  );
  await maybeCrash(options, 'FINALIZER_DRIFT_COMPLETIONS_WRITTEN');
  status = finalizerStatus(receipt, 'COMPLETE', completed, completion);
  await atomicDurableJson(
    FINALIZER_DRIFT_STATUS_PATH, status, boundaryRoot, worktreeRoot, lock,
  );
  await maybeCrash(options, 'FINALIZER_DRIFT_STATUS_COMPLETE');
  await postflightRestrictedBoundary({ boundaryRoot, worktreeRoot });
  assertExtractionOperationLockHeld(lock);
  return { receipt, completion, repeated: false };
}

export async function rotateFinalizerDriftExtraction(options) {
  if (resolve(options.boundaryRoot) !== resolve(DEFAULT_RESTRICTED_BOUNDARY)
      || resolve(options.worktreeRoot) !== WORKTREE_ROOT_FROM_MODULE
      || resolve(options.worktreeRoot) !== resolve(DEFAULT_WORKTREE_ROOT)) {
    fail('boundary_rejected');
  }
  const result = await withExtractionOperationLock({
    boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
    timeoutSeconds: 0,
  }, (lock) => finalizerDriftCore({
    boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
  }, lock));
  return {
    result: 'pass', rotation_root: result.receipt.rotation_root,
    completion_root: result.completion.content_hash,
    archived_unit_count: result.completion.archived_units.length,
    destructive_delete_or_overwrite_count: 0, production_mutation_count: 0,
    repeated_completion: result.repeated,
  };
}

export async function prepareFinalizerDriftRotationFixture(options) {
  if (options?.testOnly !== true || !options.decision
      || !isAbsolute(options.boundaryRoot) || !isAbsolute(options.worktreeRoot)) {
    fail('argument_rejected');
  }
  return buildFinalizerDriftRotationReceipt({
    decision: options.decision,
    moveRoots: await partialRecoveryUnitRoots(options.boundaryRoot, options.worktreeRoot),
    preservationRoots: await finalizerDriftPreservationRoots(
      options.boundaryRoot, options.worktreeRoot,
    ),
  });
}

export async function rotateFinalizerDriftExtractionFixture(options) {
  if (options?.testOnly !== true || !options.decision || !options.preparedReceipt
      || !isAbsolute(options.boundaryRoot) || !isAbsolute(options.worktreeRoot)) {
    fail('argument_rejected');
  }
  const result = await withExtractionOperationLock({
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot, timeoutSeconds: 0,
  }, (lock) => finalizerDriftCore(options, lock));
  return {
    result: 'pass', rotation_root: result.receipt.rotation_root,
    completion_root: result.completion.content_hash,
    archived_unit_count: result.completion.archived_units.length,
    repeated_completion: result.repeated,
  };
}

export async function dryRunFinalizerDriftRotation() {
  const paths = expectedRunContractManifestPaths();
  const currentManifest = paths.map((relativePath, index) => ({
    relative_path: relativePath, sha256: String((index % 9) + 1).repeat(64),
  }));
  const finalizerIndex = paths.indexOf(FINALIZER_MANIFEST_PATH);
  currentManifest[finalizerIndex].sha256 = EXPECTED_CORRECTED_FINALIZER_SHA256;
  const oldManifest = structuredClone(currentManifest);
  oldManifest[finalizerIndex].sha256 = EXPECTED_OLD_FINALIZER_SHA256;
  const roots = Object.fromEntries(
    FINALIZER_APPROVED_ROOT_KEYS.map((key, index) => [key, String(((index + 2) % 9) + 1).repeat(64)]),
  );
  const rotationTcbHashes = FINALIZER_DRIFT_ROTATION_TCB_PATHS.map(
    (relativePath, index) => ({
      relative_path: relativePath, sha256: String(((index + 5) % 9) + 1).repeat(64),
    }),
  );
  const decision = contentAddressedEnvelope({
    schema_version: FINALIZER_DRIFT_DECISION_SCHEMA,
    decision: 'SUPERSEDE_FINALIZED_RUN_FOR_FINALIZER_HASH_DRIFT',
    authority_ticket_sha256: AUTHORITY_TICKET_SHA256,
    extraction_run_id: 'opaque_run_fixture_finalizer_drift',
    old_run_contract_root: EXPECTED_OLD_RUN_CONTRACT_ROOT,
    current_run_contract_root: '2'.repeat(64),
    old_finalizer_sha256: EXPECTED_OLD_FINALIZER_SHA256,
    corrected_finalizer_sha256: EXPECTED_CORRECTED_FINALIZER_SHA256,
    old_run_contract_manifest: oldManifest, old_manifest_root: stableHash(oldManifest),
    current_run_contract_manifest: currentManifest,
    current_manifest_root: stableHash(currentManifest), approved_roots: roots,
    rotation_tcb_hashes: rotationTcbHashes,
    rotation_tcb_root: stableHash(rotationTcbHashes),
    archive_scope: FINALIZER_DRIFT_ARCHIVE_SCOPE,
    non_destructive_archive: true,
    raw_acquisition_alias_decisions_preserved: true,
    production_mutation_authorized: false, release_or_final_approval_authority: false,
  });
  await validateFinalizerDriftRotationDecision(decision, {
    verifyCurrentManifest: false, verifyRotationTcb: false,
  });
  const moveRoots = Object.fromEntries(FINALIZER_DRIFT_UNITS.map(
    (unit, index) => [unit.key, String(((index + 3) % 9) + 1).repeat(64)],
  ));
  const preservationKeys = [
    ...PRESERVATION_KEYS, 'supersession_status', 'supersession_receipts',
    'supersession_completions', 'prior_superseded_archive',
    'partial_recovery_status', 'prior_partial_recovery_archive',
  ];
  const preservation = Object.fromEntries(preservationKeys.map(
    (key, index) => [key, String(((index + 4) % 9) + 1).repeat(64)],
  ));
  const receipt = buildFinalizerDriftRotationReceipt({
    decision, moveRoots, preservationRoots: preservation,
  });
  return {
    mode: 'finalizer_drift_rotation_dry_run', result: 'pass',
    protected_reads: 0, protected_writes: 0, network_requests: 0,
    exact_manifest_delta_count: 1, fixed_move_unit_count: FINALIZER_DRIFT_UNITS.length,
    distinct_status_namespace: FINALIZER_DRIFT_STATUS_PATH,
    prepared_receipt_valid: verifyContentAddressedEnvelope(receipt),
    shared_kernel_lock_contract_present: true,
  };
}

export async function rotateSupersededExtraction(options) {
  if (resolve(options.boundaryRoot) !== resolve(DEFAULT_RESTRICTED_BOUNDARY)
      || resolve(options.worktreeRoot) !== WORKTREE_ROOT_FROM_MODULE
      || resolve(options.worktreeRoot) !== resolve(DEFAULT_WORKTREE_ROOT)) {
    fail('boundary_rejected');
  }
  // Never forward caller-controlled fixture or verification overrides into the
  // live path. Test-only controls remain confined to the fixture entrypoint.
  const liveOptions = {
    boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
    verifyCodeHashes: true,
  };
  try {
    const result = await withExtractionOperationLock({
      boundaryRoot: liveOptions.boundaryRoot,
      worktreeRoot: WORKTREE_ROOT_FROM_MODULE,
      timeoutSeconds: 0,
    }, (lock) => rotateCore(liveOptions, lock));
    return publicResult(result);
  } catch (error) {
    if (error?.name === 'ExtractionOperationLockError') fail('operation_lock_rejected');
    throw error;
  }
}

/** Test-only entrypoint: caller must provide an isolated complete boundary. */
export async function rotateSupersededExtractionFixture(options) {
  if (options?.testOnly !== true || !isAbsolute(options.boundaryRoot)
      || !isAbsolute(options.worktreeRoot) || !isAbsolute(options.safeLedgerPath)
      || !isAbsolute(options.safeCoveragePath) || !isAbsolute(options.safeRoot)) {
    fail('argument_rejected');
  }
  const result = await withExtractionOperationLock({
    boundaryRoot: options.boundaryRoot,
    worktreeRoot: options.worktreeRoot,
    timeoutSeconds: 0,
  }, (lock) => rotateCore(options, lock));
  return publicResult(result);
}

function syntheticHash(character) {
  return character.repeat(64);
}

export async function dryRun() {
  const oldRoots = Object.fromEntries(
    OLD_ROOT_KEYS.map((key, index) => [key, String((index % 9) + 1).repeat(64)]),
  );
  const preservation = Object.fromEntries(
    PRESERVATION_KEYS.map((key, index) => [key, String(((index + 1) % 9) + 1).repeat(64)]),
  );
  const moveRoots = Object.fromEntries(
    MOVE_ROOT_KEYS.map((key, index) => [key, String(((index + 2) % 9) + 1).repeat(64)]),
  );
  const receipt = buildPreparedSupersessionReceipt({
    extractionRunId: 'run_fixture_rotation_0001',
    correctionDecisionRoot: syntheticHash('a'),
    oldRoots,
    preservation,
    moveRoots,
  });
  validatePreparedReceipt(receipt);
  return {
    mode: 'dry_run',
    result: 'pass',
    protected_reads: 0,
    protected_writes: 0,
    network_requests: 0,
    fixed_move_unit_count: MOVE_UNITS.length,
    prepared_receipt_valid: true,
    resumable_terminal_status_contract_valid: true,
    shared_kernel_lock_contract_present: true,
  };
}

export async function dryRunPartialRecovery() {
  const moveRoots = Object.fromEntries(PARTIAL_RECOVERY_UNITS.map(
    (unit, index) => [unit.key, String((index % 9) + 1).repeat(64)],
  ));
  const preservation = Object.fromEntries([
    ...PRESERVATION_KEYS,
    'supersession_status', 'supersession_receipts',
    'supersession_completions', 'prior_superseded_archive',
  ].map((key, index) => [key, String(((index + 2) % 9) + 1).repeat(64)]));
  const receipt = buildContractInvalidPartialRecoveryReceipt({
    journalRoot: 'a'.repeat(64), moveRoots, preservationRoots: preservation,
  });
  if (!verifyContentAddressedEnvelope(receipt)
      || receipt.fixed_move_contract.length !== PARTIAL_RECOVERY_UNITS.length
      || receipt.non_destructive_archive !== true) fail('partial_recovery_rejected');
  return {
    mode: 'partial_recovery_dry_run', result: 'pass',
    protected_reads: 0, protected_writes: 0, network_requests: 0,
    fixed_move_unit_count: PARTIAL_RECOVERY_UNITS.length,
    content_addressed_receipt_valid: true,
    shared_kernel_lock_contract_present: true,
  };
}

function parseArgs(argv) {
  const options = {
    boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot: DEFAULT_WORKTREE_ROOT,
    dryRun: false,
    partialRecovery: false,
    partialRecoveryDryRun: false,
    partialRecoveryPreflight: false,
    finalizerDriftRotation: false,
    finalizerDriftDryRun: false,
    help: false,
  };
  for (const raw of argv) {
    if (raw === '--dry-run' || raw === '--self-test') options.dryRun = true;
    else if (raw === '--recover-contract-invalid-partial') options.partialRecovery = true;
    else if (raw === '--partial-recovery-dry-run') options.partialRecoveryDryRun = true;
    else if (raw === '--partial-recovery-preflight') options.partialRecoveryPreflight = true;
    else if (raw === '--rotate-finalizer-drift') options.finalizerDriftRotation = true;
    else if (raw === '--finalizer-drift-dry-run') options.finalizerDriftDryRun = true;
    else if (raw === '--help' || raw === '-h') options.help = true;
    else fail('argument_rejected');
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write([
      'I1Q-1008E non-destructive superseded extraction rotation',
      'Usage: node tools/rotate-superseded-extraction.mjs',
      '       node tools/rotate-superseded-extraction.mjs --dry-run',
      '       node tools/rotate-superseded-extraction.mjs --partial-recovery-dry-run',
      '       node tools/rotate-superseded-extraction.mjs --partial-recovery-preflight',
      '       node tools/rotate-superseded-extraction.mjs --recover-contract-invalid-partial',
      '       node tools/rotate-superseded-extraction.mjs --finalizer-drift-dry-run',
      '       node tools/rotate-superseded-extraction.mjs --rotate-finalizer-drift',
      'Live mode accepts only the exact approved boundary and worktree.',
    ].join('\n') + '\n');
    return;
  }
  if ([options.dryRun, options.partialRecovery, options.partialRecoveryDryRun,
    options.partialRecoveryPreflight, options.finalizerDriftRotation,
    options.finalizerDriftDryRun]
    .filter(Boolean).length > 1) fail('argument_rejected');
  const result = options.partialRecoveryDryRun ? await dryRunPartialRecovery()
    : options.partialRecoveryPreflight ? await preflightContractInvalidPartialRecovery(options)
    : options.partialRecovery ? await recoverContractInvalidPartialExtraction(options)
      : options.finalizerDriftDryRun ? await dryRunFinalizerDriftRotation()
        : options.finalizerDriftRotation ? await rotateFinalizerDriftExtraction(options)
      : options.dryRun ? await dryRun() : await rotateSupersededExtraction(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      result: 'fail',
      error_code: error instanceof RotationError ? error.code
        : error?.name === 'BoundaryError' ? 'boundary_rejected'
          : error?.name === 'ExtractionOperationLockError'
            ? 'operation_lock_rejected' : 'internal_failure',
    })}\n`);
    process.exitCode = 1;
  });
}
