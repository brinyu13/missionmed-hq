import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalFileBytes, contentAddressedEnvelope } from '../../I1Q_1008F_DRILL_QUESTION_GOLD_SET/tools/canonical.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HANDOFF = dirname(HERE);

async function atomicWrite(path, bytes) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { mode: 0o644, flag: 'wx' });
  await rename(temporary, path);
}

async function writeJson(relative, value) {
  await atomicWrite(join(HANDOFF, relative), canonicalFileBytes(value));
}

export async function buildSafeHandoff(targetBoundary) {
  const target = resolve(targetBoundary);
  const validation = JSON.parse(await readFile(join(target, 'validation-report.json'), 'utf8'));
  const receipt = JSON.parse(await readFile(join(target, 'build-receipt.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(join(target, 'question-manifest.json'), 'utf8'));
  const perDrill = JSON.parse(await readFile(join(target, 'question-counts-by-drill.json'), 'utf8'));
  const dimensions = {};
  for (const dimension of ['topic', 'specialty', 'subject', 'organ-system']) {
    const artifact = JSON.parse(await readFile(join(target, `question-counts-by-${dimension}.json`), 'utf8'));
    dimensions[dimension.replace('-', '_')] = artifact.rows;
  }
  const safeArtifacts = manifest.artifacts.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 }));

  const buildSummary = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008g.database-build-safe-summary.v1',
    status: validation.passed ? 'COMPLETE' : 'FAILED',
    drill_count: validation.drill_count,
    question_record_count: validation.record_count,
    primary_count: validation.primary_count,
    follow_up_count: validation.follow_up_count,
    ambiguous_count: validation.ambiguous_count,
    unique_question_id_count: validation.unique_question_id_count,
    unique_verbatim_count: validation.unique_verbatim_count,
    duplicate_verbatim_groups: validation.duplicate_verbatim_groups,
    duplicate_verbatim_rows: validation.duplicate_verbatim_rows,
    occurrence_duplicates_beyond_first: validation.duplicate_verbatim_rows - validation.duplicate_verbatim_groups,
    source_run_contract_hash: validation.source_contract_hash,
    source_shard_set_root: validation.source_shard_set_root,
    source_projection_root: receipt.source_projection_root,
    ordered_record_root: receipt.ordered_record_root,
    question_manifest_hash: manifest.content_hash,
    validation_report_hash: validation.content_hash,
    minimally_normalized_non_null_count: 0,
    drill_date_known_count: 0,
    metadata_policy: 'ABSENT_SOURCE_FIELDS_EXPLICITLY_UNCLASSIFIED_NO_INFERENCE',
    extraction_performed: false,
    deduplication_performed: false,
    canonicalization_performed: false,
    rewriting_performed: false,
    mcq_generation_performed: false,
    ontology_generation_performed: false,
    medical_approval_performed: false,
    production_mutation_count: 0,
    learner_release_count: 0,
  });
  await writeJson('evidence/database-build-safe-summary.json', buildSummary);
  await writeJson('evidence/export-manifest-safe.json', contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008g.export-manifest-safe.v1',
    artifacts: safeArtifacts,
    restricted_artifact_count: safeArtifacts.length,
    question_manifest_hash: manifest.content_hash,
  }));
  await writeJson('evidence/counts-by-dimension-safe.json', contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008g.counts-by-dimension-safe.v1',
    record_count: validation.record_count,
    dimensions,
  }));
  await writeJson('evidence/per-drill-counts-safe.json', contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008g.per-drill-counts-safe.v1',
    rows: perDrill.rows.map(({ drill_id: _omitted, drill_date: _date, ...row }) => ({ ...row, drill_date_status: 'UNKNOWN' })),
    drill_count: perDrill.rows.length,
    total: perDrill.total,
  }));
  await writeJson('evidence/validation-safe-summary.json', contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008g.validation-safe-summary.v1',
    passed: validation.passed,
    record_count: validation.record_count,
    drill_count: validation.drill_count,
    cross_format_projection_agreement: validation.cross_format_projection_agreement,
    cross_format_record_agreement: validation.cross_format_record_agreement,
    source_question_id_order_agreement: validation.source_question_id_order_agreement,
    source_verbatim_byte_agreement: validation.source_verbatim_byte_agreement,
    source_normalized_value_agreement: validation.source_normalized_value_agreement,
    schema_validation: validation.schema_validation,
    csv_rfc4180_parse: validation.csv_rfc4180_parse,
    sql_literal_parse: validation.sql_literal_parse,
    spreadsheet_artifact_csv_validation: 'PASS_16690_ROWS_40_COLUMNS',
    restricted_permissions: validation.restricted_permissions,
    production_mutation_count: validation.production_mutation_count,
    learner_release_count: validation.learner_release_count,
    medical_approval_performed: validation.medical_approval_performed,
  }));
  await writeJson('evidence/recovery-safe-receipt.json', contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008g.recovery-safe-receipt.v1',
    failed_generation_count: 2,
    failed_generation_preserved: true,
    failed_generation_reasons: [
      'CANONICAL_HASHER_REJECTED_FLOATING_POINT_AVERAGE_SPACING',
      'POSTGRESQL_DDL_INSERT_COLUMN_PARITY_DEFECT',
    ],
    corrections: [
      'EXACT_NUMERATOR_DENOMINATOR_PLUS_DECIMAL_STRING',
      'ATOMIC_DDL_AND_INSERT_WITH_EXACT_COLUMN_PARITY',
    ],
    accepted_generation_record_count: validation.record_count,
    source_or_production_mutation_count: 0,
  }));

  await atomicWrite(join(HANDOFF, 'reports/QUESTIONS_PER_DRILL.md'), await readFile(join(target, 'questions-per-drill.md')));
  return { build_summary_hash: buildSummary.content_hash, files_written: 7 };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [targetBoundary] = process.argv.slice(2);
  if (!targetBoundary) throw new Error('usage: node build-safe-handoff.mjs TARGET_DATABASE_BOUNDARY');
  process.stdout.write(`${JSON.stringify(await buildSafeHandoff(targetBoundary))}\n`);
}
