#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const AUDIT_ROOT = path.dirname(__filename);
const WORKTREE_ROOT = path.resolve(AUDIT_ROOT, '../../../..');
const FOUNDATION_ROOT = path.join(WORKTREE_ROOT, '_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1005_FOUNDATION_SLICE');
const VALIDATOR_RELATIVE_PATH = 'validators/run_all_validations.mjs';
const RESULTS_DIR = path.join(AUDIT_ROOT, 'results');
const REPORT_PATH = path.join(RESULTS_DIR, 'official_1005_suite.json');

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function listFiles(root) {
  const rows = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile()) rows.push(fullPath);
    }
  };
  walk(root);
  return rows;
}

function treeHash(root) {
  const manifest = listFiles(root).map((filePath) => `${path.relative(root, filePath)}\u0000${sha256(fs.readFileSync(filePath))}`).join('\n');
  return { file_count: listFiles(root).length, sha256: sha256(manifest) };
}

function compactOfficialReport(report) {
  return {
    overall_status: report.overall_status,
    positive_status: report.positive_status,
    leak_status: report.leak_status,
    negative_status: report.negative_status,
    privacy_status: report.privacy_harness?.status,
    determinism_status: report.determinism?.status,
    validators: Object.entries(report.validators || {}).map(([id, row]) => ({ id, status: row.status, error_count: row.errors?.length || 0 })),
    leak_tests: Object.entries(report.leak_tests || {}).map(([id, row]) => ({ id, status: row.status, error_count: row.errors?.length || 0 })),
    negative_cases: (report.negative_catalog || []).map((row) => ({
      id: row.fixture_id,
      status: row.status,
      expected_validator: row.expected_validator,
      expected_error_code: row.expected_error_code
    })),
    combined_handoff: report.combined_handoff,
    forbidden_unicode_hits: report.forbidden_unicode_hits
  };
}

function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const sourceValidatorPath = path.join(FOUNDATION_ROOT, VALIDATOR_RELATIVE_PATH);
  const sourceEstateBefore = treeHash(FOUNDATION_ROOT);
  const sourceValidatorBefore = sha256(fs.readFileSync(sourceValidatorPath));
  const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(), 'i1q-1006-official-1005-'));
  const isolatedRoot = path.join(temporaryParent, 'I1Q_STATQUESTIONS_1005_FOUNDATION_SLICE');
  let execution;
  let officialReport = null;
  let copiedValidatorHash = null;
  let failure = null;

  try {
    fs.cpSync(FOUNDATION_ROOT, isolatedRoot, { recursive: true, preserveTimestamps: true });
    const copiedValidatorPath = path.join(isolatedRoot, VALIDATOR_RELATIVE_PATH);
    copiedValidatorHash = sha256(fs.readFileSync(copiedValidatorPath));
    execution = spawnSync(process.execPath, [copiedValidatorPath], {
      cwd: isolatedRoot,
      encoding: 'utf8',
      env: { PATH: process.env.PATH || '' },
      maxBuffer: 20 * 1024 * 1024
    });
    const generatedReportPath = path.join(isolatedRoot, 'validation_results/validation_report.json');
    if (fs.existsSync(generatedReportPath)) officialReport = JSON.parse(fs.readFileSync(generatedReportPath, 'utf8'));
  } catch (error) {
    failure = { name: error.name, message: error.message, stack: error.stack };
  } finally {
    fs.rmSync(temporaryParent, { recursive: true, force: true });
  }

  const sourceEstateAfter = treeHash(FOUNDATION_ROOT);
  const sourceValidatorAfter = sha256(fs.readFileSync(sourceValidatorPath));
  let stdoutJson = null;
  try {
    stdoutJson = execution?.stdout ? JSON.parse(execution.stdout) : null;
  } catch {
    stdoutJson = null;
  }
  const compact = officialReport ? compactOfficialReport(officialReport) : null;
  const exactCounts = {
    validators: compact?.validators.length || 0,
    leak_tests: compact?.leak_tests.length || 0,
    negative_cases: compact?.negative_cases.length || 0
  };
  const status = failure === null
    && execution?.status === 0
    && sourceValidatorBefore === copiedValidatorHash
    && sourceValidatorBefore === sourceValidatorAfter
    && sourceEstateBefore.sha256 === sourceEstateAfter.sha256
    && compact?.overall_status === 'pass'
    && exactCounts.validators === 20
    && exactCounts.leak_tests === 6
    && exactCounts.negative_cases === 30
    && compact.validators.every((row) => row.status === 'pass')
    && compact.leak_tests.every((row) => row.status === 'pass')
    && compact.negative_cases.every((row) => row.status === 'pass')
    ? 'pass'
    : 'fail';

  const report = {
    report_id: 'i1q_1006_official_1005_isolated_execution',
    mission_id: 'I1Q-1006',
    generated_at: new Date().toISOString(),
    status,
    isolation: {
      strategy: 'recursive temporary copy; execute copied validator bytes; delete temporary tree',
      source_worktree_executed: false,
      temporary_tree_retained: false,
      network: false,
      production_reads: false,
      production_writes: false
    },
    validator_integrity: {
      relative_path: VALIDATOR_RELATIVE_PATH,
      source_sha256_before: sourceValidatorBefore,
      copied_sha256: copiedValidatorHash,
      source_sha256_after: sourceValidatorAfter,
      exact_byte_match: sourceValidatorBefore === copiedValidatorHash && sourceValidatorBefore === sourceValidatorAfter
    },
    source_estate_integrity: {
      before: sourceEstateBefore,
      after: sourceEstateAfter,
      unchanged: sourceEstateBefore.sha256 === sourceEstateAfter.sha256
    },
    execution: {
      executable: 'node',
      script: VALIDATOR_RELATIVE_PATH,
      exit_code: execution?.status ?? null,
      signal: execution?.signal ?? null,
      stdout_json: stdoutJson,
      stderr: execution?.stderr || ''
    },
    exact_counts: exactCounts,
    official_report: compact,
    failure
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    status,
    validator_exact_byte_match: report.validator_integrity.exact_byte_match,
    source_estate_unchanged: report.source_estate_integrity.unchanged,
    validators_passed: compact?.validators.filter((row) => row.status === 'pass').length || 0,
    leak_tests_passed: compact?.leak_tests.filter((row) => row.status === 'pass').length || 0,
    negative_cases_passed: compact?.negative_cases.filter((row) => row.status === 'pass').length || 0,
    report_path: path.relative(WORKTREE_ROOT, REPORT_PATH)
  }, null, 2));
  if (status !== 'pass') process.exitCode = 1;
}

main();
