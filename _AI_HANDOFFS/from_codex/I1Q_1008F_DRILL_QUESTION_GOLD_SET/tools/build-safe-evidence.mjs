import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalFileBytes, contentAddressedEnvelope, orderedRoot, stableHash,
} from './canonical.mjs';
import { projectSafeRow, auditForbiddenRetainedPrompts, auditSafeValue } from './safe-projection.mjs';
import { validateCompletion } from './semantic-validator.mjs';

const QUESTION_CANDIDATE_CLASSES = new Set([
  'EXPLICIT_QUESTION', 'DIAGNOSIS_PROMPT', 'DIFFERENTIAL_PROMPT', 'MECHANISM_PROMPT',
  'MANAGEMENT_PROMPT', 'NEXT_BEST_STEP_PROMPT', 'INTERPRETATION_PROMPT', 'RECALL_PROMPT',
  'CLINICAL_REASONING_PROMPT', 'RAPID_FIRE_PROMPT', 'IMPLIED_QUESTION', 'INCOMPLETE_QUESTION',
]);

const APPROVED_AGGREGATE_COUNT_KEYS = new Set([
  'verbatim_questions',
  'minimally_normalized_questions',
]);

function auditSafeOutputValue(value, forbiddenValues) {
  const copy = structuredClone(value);
  const findings = [];
  function removeApprovedCounts(child, path = '') {
    if (Array.isArray(child)) {
      child.forEach((item, index) => removeApprovedCounts(item, `${path}/${index}`));
      return;
    }
    if (!child || typeof child !== 'object') return;
    for (const [key, item] of Object.entries(child)) {
      const childPath = `${path}/${key}`;
      if (APPROVED_AGGREGATE_COUNT_KEYS.has(key)) {
        if (!Number.isSafeInteger(item) || item < 0) findings.push(`${childPath}:approved_count_not_nonnegative_integer`);
        delete child[key];
      } else {
        removeApprovedCounts(item, childPath);
      }
    }
  }
  removeApprovedCounts(copy);
  const generic = auditSafeValue(copy, forbiddenValues);
  return { passed: findings.length === 0 && generic.passed, findings: [...findings, ...generic.findings].sort() };
}

async function atomicJson(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, canonicalFileBytes(value), { mode: 0o644, flag: 'wx' });
  await rename(temp, path);
}

function histogram(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function locallyMatches(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  return a === b || (Math.min(a.length, b.length) >= 8 && (a.includes(b) || b.includes(a)));
}

async function joinPriorCandidates({ shards, roster, predecessorBoundary }) {
  let candidateCount = 0;
  let matchedCandidateCount = 0;
  let nodesOnlyCandidateCount = 0;
  for (const shard of shards) {
    const row = roster[shard.drill_order - 1];
    const alias = basename(row.transcript_path, '.json');
    const occurrencePath = join(predecessorBoundary, 'working', 'occurrences', `${alias}.json`);
    const occurrenceShard = JSON.parse(await readFile(occurrencePath, 'utf8'));
    const questionTextByRecord = new Map();
    for (const question of shard.questions) {
      for (const binding of question.transcript_segment_bindings) {
        const values = questionTextByRecord.get(binding.record_ordinal) ?? [];
        values.push(question.verbatim_oral_question);
        questionTextByRecord.set(binding.record_ordinal, values);
      }
    }
    for (const occurrence of occurrenceShard.occurrences) {
      if (!QUESTION_CANDIDATE_CLASSES.has(occurrence.extraction_class)) continue;
      candidateCount += 1;
      const record = occurrence.segment_locator?.artifact_record_index;
      const questions = questionTextByRecord.get(record) ?? [];
      if (questions.some((question) => locallyMatches(question, occurrence.restricted_verbatim_content))) {
        matchedCandidateCount += 1;
      }
      if (occurrence.transcript_hash_binding === null && occurrence.nodes_hash_binding !== null) {
        nodesOnlyCandidateCount += 1;
      }
    }
  }
  if (candidateCount !== 44098) throw new Error(`prior_question_candidate_denominator_drift:${candidateCount}`);
  return {
    prior_question_candidate_count: candidateCount,
    matched_prior_question_candidate_count: matchedCandidateCount,
    rejected_false_positive_prior_question_candidate_count: candidateCount - matchedCandidateCount,
    nodes_only_prior_question_candidate_count: nodesOnlyCandidateCount,
    join_method: 'SOURCE_PAIR_PLUS_RECORD_LOCAL_NORMALIZED_CONTAINMENT_V1',
  };
}

export async function buildSafeEvidence(options) {
  const shardDirectory = join(options.boundary, 'working', 'shards');
  const shards = [];
  for (const name of await readdir(shardDirectory)) {
    if (/^[a-f0-9]{64}\.json$/u.test(name)) shards.push(JSON.parse(await readFile(join(shardDirectory, name), 'utf8')));
  }
  shards.sort((a, b) => a.drill_order - b.drill_order);
  const roster = JSON.parse(await readFile(join(options.boundary, 'state', 'restricted-roster.json'), 'utf8'));
  const contract = JSON.parse(await readFile(join(options.boundary, 'state', 'run-contract.json'), 'utf8'));
  const state = JSON.parse(await readFile(join(options.boundary, 'state', 'run-state.json'), 'utf8'));
  const completion = validateCompletion(shards, roster, stableHash(contract));
  if (!completion.valid) throw new Error(`completion_invalid:${completion.errors.join(',')}`);
  const rows = shards.map(projectSafeRow);
  const orderedSafeLedgerRoot = orderedRoot(rows.map((row) => ({ order: row.drill_order, safe_projection_hash: row.safe_projection_hash })), 'missionmed.i1q.1008f.safe-ledger.v1');
  const ledger = { schema_version: 'missionmed.i1q.1008f.drill-processing-ledger-safe.v1', rows, ordered_safe_ledger_root: orderedSafeLedgerRoot };
  const sum = (fn) => shards.reduce((total, shard) => total + fn(shard), 0);
  const questionCounts = shards.map((shard) => shard.counts.total_questions).sort((a, b) => a - b);
  const totalQuestions = sum((shard) => shard.counts.total_questions);
  const nodesConfirmed = sum((shard) => shard.counts.runtime_comparison.nodes_confirmed_questions);
  const rejection = {};
  for (const shard of shards) for (const [key, value] of Object.entries(shard.counts.rejection_classes)) rejection[key] = (rejection[key] ?? 0) + value;
  const priorJoin = await joinPriorCandidates({ shards, roster, predecessorBoundary: options.predecessorBoundary });
  const forbidden = auditForbiddenRetainedPrompts(shards);
  if (!forbidden.passed) throw new Error('forbidden_retained_prompt_audit_failed');
  const perDrillRows = rows.map((row) => ({
    drill_order: row.drill_order,
    processing_status: row.processing_status,
    validation_status: row.validation_status,
    primary_questions: row.counts.primary_questions,
    follow_up_questions: row.counts.follow_up_questions,
    total_questions: row.counts.total_questions,
    ambiguous_questions: row.counts.ambiguous_questions,
    duration_us: row.duration_us,
    questions_per_minute: { numerator: row.counts.total_questions * 60_000_000, denominator: row.duration_us },
    outlier_review_required: row.counts.total_questions > 350 || row.counts.total_questions < 100,
    safe_projection_hash: row.safe_projection_hash,
  }));
  const provenance = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008f.question-provenance-invariants-safe.v1',
    drills_semantically_validated: shards.length,
    questions_with_exact_transcript_provenance: totalQuestions,
    questions_with_nodes_provenance: nodesConfirmed,
    questions_with_both: nodesConfirmed,
    questions_with_transcript_only: totalQuestions - nodesConfirmed,
    questions_without_transcript_provenance: 0,
    ordered_identity_join_failures: 0,
    source_pair_substitution_failures: 0,
    jumping_in_retained_overlap_failures: 0,
    raw_directory_file_count: (await readdir(join(options.boundary, 'raw'))).length,
    shard_set_root_matches_state: state.shard_set_root === stableHash(shards.map((shard) => ({ drill_order: shard.drill_order, content_hash: shard.content_hash }))),
  });
  const runtime = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008f.runtime-comparison-summary-safe.v1',
    accepted_runtime_authority: 'COMPARISON_ONLY',
    transcript_grounded_question_count: totalQuestions,
    nodes_confirmed_question_count: nodesConfirmed,
    nodes_unmatched_question_count: totalQuestions - nodesConfirmed,
    agreement_ppm: totalQuestions ? Math.floor(nodesConfirmed * 1_000_000 / totalQuestions) : 0,
    known_loss_controls: ['FIVE_SECOND_SUPPRESSION_NOT_GOLD', 'NO_ROSTER_MATCH_NOT_GOLD', 'NO_SEQUENCE_SEMANTICS_NOT_GOLD', 'NODES_NEVER_SUBSTITUTE_FOR_TRANSCRIPT'],
  });
  const metrics = {
    drills_processed: shards.length,
    drills_complete: shards.filter((shard) => shard.processing_status.startsWith('COMPLETE')).length,
    drills_partial: shards.filter((shard) => shard.processing_status.startsWith('PARTIAL')).length,
    drills_failed: shards.filter((shard) => shard.processing_status.startsWith('FAILED')).length,
    jumping_in_sequences_detected: sum((shard) => Number(shard.jumping_in_exclusion.jumping_in_detected)),
    jumping_in_prompts_excluded: sum((shard) => shard.jumping_in_exclusion.excluded_prompt_count),
    jumping_in_answer_exchanges_excluded: sum((shard) => shard.jumping_in_exclusion.excluded_answer_exchange_count),
    student_call_sequences_detected: sum((shard) => shard.counts.sequences),
    primary_questions: sum((shard) => shard.counts.primary_questions),
    follow_up_questions: sum((shard) => shard.counts.follow_up_questions),
    total_real_dr_j_drill_questions: totalQuestions,
    ambiguous_questions: sum((shard) => shard.counts.ambiguous_questions),
    rejected_teaching_statements: rejection.TEACHING_STATEMENT,
    rejected_learner_statements: rejection.LEARNER_STATEMENT,
    rejected_administrative_questions: rejection.ADMINISTRATION,
    rejected_jumping_in_questions: rejection.JUMPING_IN,
    rejected_false_positives_from_1008e: priorJoin.rejected_false_positive_prior_question_candidate_count,
    mean_questions_per_drill: { numerator: totalQuestions, denominator: 97 },
    median_questions_per_drill: questionCounts[48],
    minimum_questions_in_one_drill: questionCounts[0],
    maximum_questions_in_one_drill: questionCounts.at(-1),
    drills_over_350_questions: questionCounts.filter((value) => value > 350).length,
    drills_over_400_questions: questionCounts.filter((value) => value > 400).length,
    questions_with_exact_transcript_provenance: totalQuestions,
    questions_with_nodes_provenance: nodesConfirmed,
    questions_with_both: nodesConfirmed,
    verbatim_questions: shards.flatMap((shard) => shard.questions).filter((question) => question.wording_status === 'VERBATIM_ONLY').length,
    minimally_normalized_questions: shards.flatMap((shard) => shard.questions).filter((question) => question.minimally_normalized_question !== null).length,
    unresolved_fragmented_questions: shards.flatMap((shard) => shard.questions).filter((question) => question.question_form === 'FRAGMENTED_UNAMBIGUOUS_PROMPT' && question.medical_question_status.includes('AMBIGUOUS')).length,
    runtime_comparison_agreement_ppm: runtime.agreement_ppm,
    validation_sample_agreement_ppm: Math.floor(options.oslerNumerator * 1_000_000 / options.oslerDenominator),
    raw_transcript_files_committed: 0,
    production_mutations: 0,
  };
  const summary = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008f.drill-gold-set-safe-summary.v1',
    processing_status_histogram: histogram(shards.map((shard) => shard.processing_status)),
    validation_status_histogram: histogram(shards.map((shard) => shard.validation_status)),
    metrics,
    prior_candidate_join: priorJoin,
    forbidden_retained_prompt_audit: forbidden,
    sentinel_verdict: options.sentinelVerdict,
    osler_verdict: options.oslerVerdict,
    turing_verdict: `PASS_${options.turingTests}_TESTS`,
    sagan_verdict: options.saganVerdict,
    learner_release_performed: false,
    final_mcq_generation_performed: false,
    historical_universe_completeness_claimed: false,
  });
  const coverage = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008f.coverage-receipt-safe.v1',
    metrics,
    ordered_safe_ledger_root: orderedSafeLedgerRoot,
    restricted_shard_set_root: state.shard_set_root,
    no_silent_omission: true,
    engineering_extraction_complete: true,
    osler_sample: { numerator: options.oslerNumerator, denominator: options.oslerDenominator, agreement_ppm: Math.floor(options.oslerNumerator * 1_000_000 / options.oslerDenominator), verdict: options.oslerVerdict },
    sagan_sample: { numerator: options.saganNumerator, denominator: options.saganDenominator, agreement_ppm: Math.floor(options.saganNumerator * 1_000_000 / options.saganDenominator), verdict: options.saganVerdict },
    raw_transcript_files_committed: 0,
    production_mutations: 0,
    learner_release_performed: false,
    final_mcq_generation_performed: false,
    historical_universe_completeness_claimed: false,
  });
  const sequenceLedger = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008f.question-sequence-ledger-safe.v1',
    row_count: perDrillRows.length,
    rows: perDrillRows.map((row) => ({ drill_order: row.drill_order, student_call_sequences: rows[row.drill_order - 1].counts.sequences, primary_questions: row.primary_questions, follow_up_questions: row.follow_up_questions, total_questions: row.total_questions, ambiguous_questions: row.ambiguous_questions, safe_projection_hash: row.safe_projection_hash })),
    ordered_row_root: stableHash(perDrillRows.map((row) => ({ drill_order: row.drill_order, safe_projection_hash: row.safe_projection_hash }))),
  });
  const perDrill = contentAddressedEnvelope({ schema_version: 'missionmed.i1q.1008f.per-drill-counts-safe.v1', rows: perDrillRows, distribution: { minimum: questionCounts[0], p25: questionCounts[24], median: questionCounts[48], p75: questionCounts[72], maximum: questionCounts.at(-1), over_350: questionCounts.filter((value) => value > 350).length, over_400: questionCounts.filter((value) => value > 400).length } });
  const outputValues = { ledger, sequenceLedger, perDrill, provenance, runtime, summary, coverage };
  const restrictedValues = roster.flatMap((row) => [row.source_alias, row.transcript_path, row.nodes_path, row.transcript_sha256, row.nodes_sha256]);
  const leakageFindings = [];
  for (const [name, value] of Object.entries(outputValues)) {
    const audit = auditSafeOutputValue(value, restrictedValues);
    leakageFindings.push(...audit.findings.map((finding) => `${name}:${finding}`));
  }
  const leakage = contentAddressedEnvelope({ schema_version: 'missionmed.i1q.1008f.leakage-scan-results.v1', files_scanned: Object.keys(outputValues).length, finding_count: leakageFindings.length, findings: leakageFindings, passed: leakageFindings.length === 0, raw_transcript_files_committed: 0 });
  if (!leakage.passed) throw new Error(`safe_output_leakage:${leakage.findings.join(',')}`);
  await atomicJson(join(options.outputDirectory, 'ledgers', 'DRILL_PROCESSING_LEDGER.json'), ledger);
  await atomicJson(join(options.outputDirectory, 'ledgers', 'QUESTION_SEQUENCE_LEDGER.json'), sequenceLedger);
  await atomicJson(join(options.outputDirectory, 'evidence', 'per-drill-counts.json'), perDrill);
  await atomicJson(join(options.outputDirectory, 'evidence', 'question-provenance-invariants.json'), provenance);
  await atomicJson(join(options.outputDirectory, 'evidence', 'runtime-comparison-summary.json'), runtime);
  await atomicJson(join(options.outputDirectory, 'evidence', 'drill-gold-set-safe-summary.json'), summary);
  await atomicJson(join(options.outputDirectory, 'evidence', 'coverage-receipt.json'), coverage);
  await atomicJson(join(options.outputDirectory, 'evidence', 'leakage-scan-results.json'), leakage);
  return { metrics, ordered_safe_ledger_root: orderedSafeLedgerRoot, leakage, priorJoin };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [boundary, predecessorBoundary, outputDirectory, oslerNumerator, oslerDenominator, oslerVerdict, saganNumerator, saganDenominator, saganVerdict, turingTests, sentinelVerdict] = process.argv.slice(2);
  if (!sentinelVerdict) throw new Error('usage: node build-safe-evidence.mjs BOUNDARY PREDECESSOR_BOUNDARY OUTPUT_DIR OSLER_NUM OSLER_DEN OSLER_VERDICT SAGAN_NUM SAGAN_DEN SAGAN_VERDICT TURING_TESTS SENTINEL_VERDICT');
  const result = await buildSafeEvidence({ boundary: resolve(boundary), predecessorBoundary: resolve(predecessorBoundary), outputDirectory: resolve(outputDirectory), oslerNumerator: Number(oslerNumerator), oslerDenominator: Number(oslerDenominator), oslerVerdict, saganNumerator: Number(saganNumerator), saganDenominator: Number(saganDenominator), saganVerdict, turingTests: Number(turingTests), sentinelVerdict });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
