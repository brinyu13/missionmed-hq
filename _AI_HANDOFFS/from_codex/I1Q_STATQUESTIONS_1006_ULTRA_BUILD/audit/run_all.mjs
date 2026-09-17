#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const AUDIT_ROOT = path.dirname(__filename);
const WORKTREE_ROOT = path.resolve(AUDIT_ROOT, '../../../..');
const RESULTS_DIR = path.join(AUDIT_ROOT, 'results');
const SUMMARY_PATH = path.join(RESULTS_DIR, 'audit_summary.json');

function run(scriptName) {
  const scriptPath = path.join(AUDIT_ROOT, scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: AUDIT_ROOT,
    encoding: 'utf8',
    env: { PATH: process.env.PATH || '' },
    maxBuffer: 20 * 1024 * 1024
  });
  return {
    script: scriptName,
    exit_code: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function readJson(fileName) {
  const filePath = path.join(RESULTS_DIR, fileName);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
}

function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const executions = [
    run('run_official_1005_isolated.mjs'),
    run('run_adversarial_audit.mjs')
  ];
  const official = readJson('official_1005_suite.json');
  const adversarial = readJson('adversarial_audit_report.json');
  const overallStatus = executions.every((row) => row.exit_code === 0)
    && official?.status === 'pass'
    && adversarial?.overall_status === 'pass'
    ? 'pass'
    : 'fail';
  const summary = {
    report_id: 'i1q_1006_phase0_audit_summary',
    mission_id: 'I1Q-1006',
    generated_at: new Date().toISOString(),
    overall_status: overallStatus,
    classification: 'SYNTHETIC_NOT_MEDICAL',
    production_status: 'BLOCKED',
    execution_scope: {
      persistent_writes: '_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/audit/**',
      official_1005_execution: 'isolated temporary copy with exact validator bytes',
      network: false,
      production_reads: false,
      production_writes: false
    },
    exact_tests: {
      official_validators: official?.exact_counts.validators || 0,
      official_leak_tests: official?.exact_counts.leak_tests || 0,
      official_negative_cases: official?.exact_counts.negative_cases || 0,
      new_adversarial_cases: adversarial?.adversarial_catalog.count || 0,
      privacy_contract_tests: adversarial?.privacy_contract_tests.count || 0,
      total_assertions: (official?.exact_counts.validators || 0)
        + (official?.exact_counts.leak_tests || 0)
        + (official?.exact_counts.negative_cases || 0)
        + (adversarial?.adversarial_catalog.count || 0)
        + (adversarial?.privacy_contract_tests.count || 0)
    },
    component_status: {
      official_1005: official?.status || 'missing',
      source_estate_unchanged: official?.source_estate_integrity.unchanged === true ? 'pass' : 'fail',
      source_privacy_finding: adversarial?.source_foundation_privacy_assessment.assertion_status || 'missing',
      adversarial_baseline: adversarial?.baseline.status || 'missing',
      adversarial_mutations: adversarial?.adversarial_catalog.status || 'missing',
      privacy_contract: adversarial?.privacy_contract_tests.status || 'missing'
    },
    result_files: [
      'results/official_1005_suite.json',
      'results/adversarial_audit_report.json',
      'results/audit_summary.json'
    ],
    executions
  };
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    overall_status: overallStatus,
    exact_tests: summary.exact_tests,
    component_status: summary.component_status,
    summary_path: path.relative(WORKTREE_ROOT, SUMMARY_PATH)
  }, null, 2));
  if (overallStatus !== 'pass') process.exitCode = 1;
}

main();
