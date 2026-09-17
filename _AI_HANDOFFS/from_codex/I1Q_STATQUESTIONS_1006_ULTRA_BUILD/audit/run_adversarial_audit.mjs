#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditWorld,
  buildMutationCases,
  deepClone,
  evaluatePrivacyAggregate,
  REQUIRED_PRIVACY_CLASSES,
  runPrivacyContractTests,
  sha256
} from './lib/hardened_evaluators.mjs';

const __filename = fileURLToPath(import.meta.url);
const AUDIT_ROOT = path.dirname(__filename);
const WORKTREE_ROOT = path.resolve(AUDIT_ROOT, '../../../..');
const FOUNDATION_ROOT = path.join(WORKTREE_ROOT, '_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1005_FOUNDATION_SLICE');
const WORLD_PATH = path.join(FOUNDATION_ROOT, 'fixtures/positive/foundation_world.json');
const RESULTS_DIR = path.join(AUDIT_ROOT, 'results');
const REPORT_PATH = path.join(RESULTS_DIR, 'adversarial_audit_report.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readFoundationInputs() {
  const world = readJson(WORLD_PATH);
  const artifacts = {};
  for (const artifact of world.channel_artifacts) {
    const artifactPath = path.resolve(FOUNDATION_ROOT, artifact.artifact_path);
    if (!artifactPath.startsWith(`${FOUNDATION_ROOT}${path.sep}`)) throw new Error(`Unsafe foundation artifact path: ${artifact.artifact_path}`);
    artifacts[artifact.artifact_path] = readJson(artifactPath);
  }
  return { world, artifacts };
}

function summarizeCategories(rows) {
  const summary = {};
  for (const row of rows) {
    if (!summary[row.category]) summary[row.category] = { total: 0, passed: 0, failed: 0 };
    summary[row.category].total += 1;
    summary[row.category][row.status === 'pass' ? 'passed' : 'failed'] += 1;
  }
  return summary;
}

function buildCorrectedAuditControl(sourceWorld) {
  const world = deepClone(sourceWorld);
  const syntheticPatientId = 'FAKE-PAT-0001';
  for (const row of world.redaction_corpus.labels) {
    if (row.text === syntheticPatientId) row.class = 'patient_identifier';
  }
  for (const row of world.redaction_corpus.generated_detections) {
    if (row.text === syntheticPatientId) row.class = 'patient_identifier';
  }
  for (const record of world.privacy_redaction_records) {
    record.redaction_classes = [...REQUIRED_PRIVACY_CLASSES];
  }
  return world;
}

function main() {
  const { world: sourceWorld, artifacts: baselineArtifacts } = readFoundationInputs();
  const sourcePrivacyAggregate = evaluatePrivacyAggregate(sourceWorld.redaction_corpus);
  const sourcePrivacyExpectedFinding = sourcePrivacyAggregate.status === 'fail'
    && sourcePrivacyAggregate.errors.some((row) => row.code === 'P_MISSING_REQUIRED_CLASS' && row.path === 'by_class.patient_identifier')
    && sourcePrivacyAggregate.by_class.patient_identifier.recall === 0
    && typeof sourcePrivacyAggregate.am12_mapping.redaction_recall_patient_identifying_info === 'number';
  const baselineWorld = buildCorrectedAuditControl(sourceWorld);
  const baseline = auditWorld(baselineWorld, baselineArtifacts, baselineWorld, baselineArtifacts);
  const mutationCases = buildMutationCases();
  const mutationResults = mutationCases.map((testCase) => {
    const world = deepClone(baselineWorld);
    const artifacts = deepClone(baselineArtifacts);
    let audit;
    let harnessException = null;
    try {
      testCase.mutate(world, artifacts);
      audit = auditWorld(world, artifacts, baselineWorld, baselineArtifacts);
    } catch (error) {
      harnessException = { name: error.name, message: error.message, stack: error.stack };
      audit = { status: 'error', errors: [], privacy_aggregate: null };
    }
    const observedCodes = [...new Set(audit.errors.map((row) => row.code))].sort();
    const status = harnessException === null && observedCodes.includes(testCase.expected_error_code) ? 'pass' : 'fail';
    const result = {
      fixture_id: testCase.id,
      category: testCase.category,
      title: testCase.title,
      expected_error_code: testCase.expected_error_code,
      status,
      observed_error_codes: observedCodes,
      observed_errors: audit.errors
    };
    if (testCase.category === 'privacy_aggregate') result.privacy_aggregate = audit.privacy_aggregate;
    if (harnessException) result.harness_exception = harnessException;
    return result;
  });
  const privacyContractTests = runPrivacyContractTests(baselineWorld);
  const mutationStatus = mutationResults.every((row) => row.status === 'pass') ? 'pass' : 'fail';
  const privacyContractStatus = privacyContractTests.every((row) => row.status === 'pass') ? 'pass' : 'fail';
  const overallStatus = sourcePrivacyExpectedFinding && baseline.status === 'pass' && mutationStatus === 'pass' && privacyContractStatus === 'pass' ? 'pass' : 'fail';

  const inputFiles = [WORLD_PATH, ...sourceWorld.channel_artifacts.map((artifact) => path.join(FOUNDATION_ROOT, artifact.artifact_path))];
  const report = {
    report_id: 'i1q_1006_phase0_adversarial_audit',
    mission_id: 'I1Q-1006',
    phase: 'Phase 0',
    classification: 'SYNTHETIC_NOT_MEDICAL',
    generated_at: new Date().toISOString(),
    protected_systems: {
      production_reads: false,
      production_writes: false,
      network: false,
      package_install: false,
      migrations: false,
      runtime_changes: false,
      student_data: false,
      publication: false
    },
    input_integrity: inputFiles.map((filePath) => ({
      path: path.relative(WORKTREE_ROOT, filePath),
      sha256: sha256(fs.readFileSync(filePath))
    })),
    source_foundation_privacy_assessment: {
      assertion_status: sourcePrivacyExpectedFinding ? 'pass' : 'fail',
      expected_finding: 'The 1005 source corpus labels FAKE-PAT-0001 as student_name, leaving required patient_identifier gold absent.',
      source_modified: false,
      privacy_aggregate: sourcePrivacyAggregate
    },
    baseline: {
      status: baseline.status,
      fixture_kind: 'in-memory synthetic audit control',
      correction: 'Relabel FAKE-PAT-0001 and its synthetic detection as patient_identifier; make required redaction classes explicit.',
      source_modified: false,
      error_count: baseline.errors.length,
      errors: baseline.errors,
      privacy_aggregate: baseline.privacy_aggregate
    },
    adversarial_catalog: {
      id_start: mutationCases[0].id,
      id_end: mutationCases.at(-1).id,
      count: mutationResults.length,
      status: mutationStatus,
      category_summary: summarizeCategories(mutationResults),
      cases: mutationResults
    },
    privacy_contract_tests: {
      count: privacyContractTests.length,
      status: privacyContractStatus,
      tests: privacyContractTests
    },
    overall_status: overallStatus
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    overall_status: overallStatus,
    source_privacy_finding_status: sourcePrivacyExpectedFinding ? 'pass' : 'fail',
    baseline_status: baseline.status,
    mutation_cases_passed: mutationResults.filter((row) => row.status === 'pass').length,
    mutation_cases_total: mutationResults.length,
    privacy_contract_tests_passed: privacyContractTests.filter((row) => row.status === 'pass').length,
    privacy_contract_tests_total: privacyContractTests.length,
    report_path: path.relative(WORKTREE_ROOT, REPORT_PATH)
  }, null, 2));
  if (overallStatus !== 'pass') process.exitCode = 1;
}

main();
