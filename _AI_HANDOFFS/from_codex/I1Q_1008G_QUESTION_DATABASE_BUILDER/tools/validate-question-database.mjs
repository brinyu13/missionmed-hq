import { createHash } from 'node:crypto';
import {
  chmod, lstat, readFile, readdir, stat, writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  canonicalFileBytes, contentAddressedEnvelope, stableHash, verifyContentAddressedEnvelope,
} from '../../I1Q_1008F_DRILL_QUESTION_GOLD_SET/tools/canonical.mjs';
import { assertSchemaInstance } from '../../I1Q_1008E_RESTRICTED_FULL_CORPUS_EXTRACTION/tools/schema-validator.mjs';
import { CSV_COLUMNS } from './build-question-database.mjs';

const EXPECTED = Object.freeze({
  drills: 97, questions: 16690, primary: 3054, follow_up: 13636, ambiguous: 10123,
  direct: 16618, imperative: 72, nodes_null: 1656,
  unique_verbatim: 14578, duplicate_groups: 870, duplicate_rows: 2982,
  contract: 'de31610de045da1ea217a19dc4420e07c3deee9cf533482d3eeff301492d52ff',
  shard_set: '4d906f3825cac5e8190bd8d379e512bcfb339fa2e4489a2bdceb7cd0eb7ff978',
});
const JSON_COLUMNS = new Set(['confidence_basis_codes', 'ambiguity_flags', 'processing_receipt', 'source_aliases']);
const BOOLEAN_COLUMNS = new Set(['ambiguity_flag']);
const INTEGER_COLUMNS = new Set(['drill_order', 'question_order', 'student_sequence_order', 'question_order_in_sequence', 'timestamp_start_us', 'timestamp_end_us', 'confidence_ppm']);

function assert(condition, code) { if (!condition) throw new Error(code); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  assert(!quoted && row.length === 0 && field === '', 'csv_terminal_state_invalid');
  return rows;
}

function typedRecord(columns, values) {
  assert(columns.length === values.length, 'typed_record_column_count_invalid');
  const record = {};
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index];
    const raw = values[index];
    if (raw === null) record[column] = null;
    else if (JSON_COLUMNS.has(column)) record[column] = typeof raw === 'string' ? JSON.parse(raw) : raw;
    else if (BOOLEAN_COLUMNS.has(column)) record[column] = raw === true || raw === 1 || raw === 'true' || raw === 'TRUE';
    else if (INTEGER_COLUMNS.has(column)) record[column] = Number(raw);
    else record[column] = raw;
  }
  return record;
}

export function recordsFromCsv(text) {
  const rows = parseCsv(text);
  assert(rows.length === EXPECTED.questions + 1, 'csv_row_count_invalid');
  assert(JSON.stringify(rows[0]) === JSON.stringify(CSV_COLUMNS), 'csv_header_invalid');
  return rows.slice(1).map((values) => typedRecord(CSV_COLUMNS, values.map((value) => value === '' ? null : value)));
}

function parseSqlTuple(text, start) {
  let index = start;
  const values = [];
  function skip() { while (/\s/u.test(text[index] ?? '')) index += 1; }
  skip();
  assert(text[index] === '(', 'sql_tuple_open_missing');
  index += 1;
  while (true) {
    skip();
    let value;
    if (text[index] === "'") {
      index += 1;
      let result = '';
      while (index < text.length) {
        if (text[index] === "'" && text[index + 1] === "'") { result += "'"; index += 2; }
        else if (text[index] === "'") { index += 1; break; }
        else { result += text[index]; index += 1; }
      }
      if (text.slice(index, index + 7) === '::jsonb') { value = JSON.parse(result); index += 7; }
      else value = result;
    } else {
      const valueStart = index;
      while (index < text.length && text[index] !== ',' && text[index] !== ')') index += 1;
      const token = text.slice(valueStart, index).trim();
      if (token === 'NULL') value = null;
      else if (token === 'TRUE') value = true;
      else if (token === 'FALSE') value = false;
      else if (/^-?\d+$/u.test(token)) value = Number(token);
      else throw new Error(`sql_token_invalid:${token}`);
    }
    values.push(value);
    skip();
    if (text[index] === ',') { index += 1; continue; }
    assert(text[index] === ')', 'sql_tuple_close_missing');
    return { values, next: index + 1 };
  }
}

export function recordsFromSql(text) {
  const records = [];
  const marker = `INSERT INTO question_database (${CSV_COLUMNS.join(',')}) VALUES`;
  let cursor = 0;
  while (true) {
    const insertion = text.indexOf(marker, cursor);
    if (insertion < 0) break;
    let index = insertion + marker.length;
    while (index < text.length) {
      while (/\s/u.test(text[index] ?? '')) index += 1;
      const tuple = parseSqlTuple(text, index);
      records.push(typedRecord(CSV_COLUMNS, tuple.values));
      index = tuple.next;
      while (/\s/u.test(text[index] ?? '')) index += 1;
      if (text[index] === ',') { index += 1; continue; }
      assert(text[index] === ';', 'sql_insert_terminator_missing');
      cursor = index + 1;
      break;
    }
  }
  return records;
}

function recordsFromSqlite(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return db.prepare(`SELECT ${CSV_COLUMNS.join(',')} FROM question_database ORDER BY drill_order, question_order`).all().map((row) => typedRecord(CSV_COLUMNS, CSV_COLUMNS.map((column) => row[column])));
  } finally { db.close(); }
}

function recordProjection(record) {
  return {
    drill_order: record.drill_order,
    drill_id: record.drill_id,
    question_order: record.question_order,
    question_id: record.question_id,
    sequence_id: record.student_sequence_id,
    sequence_order: record.student_sequence_order,
    question_order_in_sequence: record.question_order_in_sequence,
    question_role: record.question_role,
    verbatim_question: record.verbatim_question,
    minimally_normalized_question: record.minimally_normalized_question,
    timestamp_start_us: record.timestamp_start_us,
    timestamp_end_us: record.timestamp_end_us,
    transcript_hash: record.transcript_hash,
    nodes_hash: record.nodes_hash,
    transcript_binding_root: record.transcript_binding_root,
    nodes_binding_root: record.nodes_binding_root,
    question_provenance_hash: record.question_provenance_hash,
  };
}

function verifyRecords(records, schema, label) {
  assert(records.length === EXPECTED.questions, `${label}_record_count_invalid`);
  const ids = new Set();
  let primary = 0;
  let followUp = 0;
  let ambiguous = 0;
  let direct = 0;
  let imperative = 0;
  let nodesNull = 0;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    assertSchemaInstance(schema, record);
    const withoutHash = { ...record };
    delete withoutHash.record_hash;
    assert(stableHash(withoutHash) === record.record_hash, `${label}_record_hash_invalid:${index}`);
    assert(!ids.has(record.question_id), `${label}_question_id_duplicate:${index}`);
    ids.add(record.question_id);
    assert(record.timestamp_start_us <= record.timestamp_end_us, `${label}_timestamp_invalid:${index}`);
    assert(record.minimally_normalized_question === null, `${label}_unexpected_normalized_question:${index}`);
    assert(record.drill_date === null, `${label}_unexpected_drill_date:${index}`);
    for (const field of ['specialty', 'subject', 'topic', 'subtopic', 'organ_system', 'cognitive_level']) assert(record[field] === 'UNCLASSIFIED', `${label}_${field}_not_unclassified:${index}`);
    if (record.question_role === 'PRIMARY') primary += 1; else followUp += 1;
    if (record.ambiguity_flag) ambiguous += 1;
    if (record.question_type === 'DIRECT_INTERROGATIVE') direct += 1; else imperative += 1;
    if (record.nodes_binding_root === null) nodesNull += 1;
  }
  assert(ids.size === EXPECTED.questions, `${label}_question_id_count_invalid`);
  assert(primary === EXPECTED.primary && followUp === EXPECTED.follow_up, `${label}_role_counts_invalid`);
  assert(ambiguous === EXPECTED.ambiguous, `${label}_ambiguity_count_invalid`);
  assert(direct === EXPECTED.direct && imperative === EXPECTED.imperative, `${label}_question_type_counts_invalid`);
  assert(nodesNull === EXPECTED.nodes_null, `${label}_nodes_null_count_invalid`);
  return { rows: records.length, primary, follow_up: followUp, ambiguous, direct, imperative, nodes_null: nodesNull, projection_root: stableHash(records.map(recordProjection)), record_root: stableHash(records.map((record) => record.record_hash)) };
}

async function verifyPermissions(target) {
  const findings = [];
  const root = await stat(target);
  if ((root.mode & 0o777) !== 0o700) findings.push('target_directory_mode');
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const path = join(target, entry.name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) findings.push(`symlink:${entry.name}`);
    if (info.isFile() && (info.mode & 0o777) !== 0o600) findings.push(`file_mode:${entry.name}`);
    if (info.isFile() && info.nlink !== 1) findings.push(`hardlink:${entry.name}`);
  }
  return findings;
}

function validationMarkdown(report) {
  return `# I1Q-1008G Validation Report\n\nVerdict: **${report.passed ? 'PASS' : 'FAIL'}**\n\n- Gold questions reconciled: ${report.record_count} / ${EXPECTED.questions}\n- Primary / follow-up: ${report.primary_count} / ${report.follow_up_count}\n- JSON / CSV / SQL / SQLite projection agreement: ${report.cross_format_projection_agreement}\n- Duplicate wording groups preserved: ${report.duplicate_verbatim_groups}\n- Metadata absent in Gold: explicit UNCLASSIFIED; no inference or ontology generated\n- Production mutations: 0\n- Learner releases: 0\n`;
}

export async function validateQuestionDatabase({ sourceBoundary, targetBoundary }) {
  const source = resolve(sourceBoundary);
  const target = resolve(targetBoundary);
  const schema = JSON.parse(await readFile(join(target, 'question-record.schema.json'), 'utf8'));
  const jsonEnvelope = JSON.parse(await readFile(join(target, 'question-database.import.json'), 'utf8'));
  assert(verifyContentAddressedEnvelope(jsonEnvelope), 'json_envelope_content_hash_invalid');
  const jsonRecords = jsonEnvelope.records;
  const csvRecords = recordsFromCsv(await readFile(join(target, 'question-database.import.csv'), 'utf8'));
  const sqlText = await readFile(join(target, 'question-database.import.sql'), 'utf8');
  assert(sqlText.trimStart().startsWith('BEGIN;'), 'sql_transaction_must_precede_ddl');
  assert(!/ON\s+CONFLICT\s+DO\s+NOTHING/iu.test(sqlText), 'sql_conflict_suppression_forbidden');
  assert(!/UNIQUE\s*\([^)]*(?:verbatim|minimally_normalized|topic|subject|specialty)/iu.test(sqlText), 'sql_semantic_uniqueness_forbidden');
  const ddlBody = sqlText.match(/CREATE TABLE question_database\s*\(([\s\S]*?)\n\);/u)?.[1];
  assert(ddlBody, 'sql_ddl_missing');
  const ddlColumns = [...ddlBody.matchAll(/^\s{2}([a-z_]+)\s/gmu)].map((match) => match[1]);
  assert(JSON.stringify(ddlColumns) === JSON.stringify(CSV_COLUMNS), 'sql_ddl_insert_column_mismatch');
  const sqlRecords = recordsFromSql(sqlText);
  assert(sqlRecords.length === EXPECTED.questions, 'sql_row_count_invalid');
  const sqliteRecords = recordsFromSqlite(join(target, 'question-database.sqlite'));
  const formats = {
    json: verifyRecords(jsonRecords, schema, 'json'),
    csv: verifyRecords(csvRecords, schema, 'csv'),
    sql: verifyRecords(sqlRecords, schema, 'sql'),
    sqlite: verifyRecords(sqliteRecords, schema, 'sqlite'),
  };
  const projectionRoots = new Set(Object.values(formats).map((format) => format.projection_root));
  const recordRoots = new Set(Object.values(formats).map((format) => format.record_root));
  assert(projectionRoots.size === 1, 'cross_format_projection_root_mismatch');
  assert(recordRoots.size === 1, 'cross_format_record_root_mismatch');
  assert(formats.json.projection_root === jsonEnvelope.source_projection_root, 'json_source_projection_root_mismatch');
  assert(formats.json.record_root === jsonEnvelope.ordered_record_root, 'json_ordered_record_root_mismatch');

  const state = JSON.parse(await readFile(join(source, 'state/run-state.json'), 'utf8'));
  assert(state.run_contract_hash === EXPECTED.contract && state.shard_set_root === EXPECTED.shard_set, 'source_state_changed');
  const shards = [];
  for (const name of await readdir(join(source, 'working/shards'))) if (/^[a-f0-9]{64}\.json$/u.test(name)) shards.push(JSON.parse(await readFile(join(source, 'working/shards', name), 'utf8')));
  shards.sort((left, right) => left.drill_order - right.drill_order);
  const roster = JSON.parse(await readFile(join(source, 'state/restricted-roster.json'), 'utf8'));
  roster.sort((left, right) => left.drill_order - right.drill_order);
  assert(stableHash(shards.map((shard) => ({ drill_order: shard.drill_order, content_hash: shard.content_hash }))) === state.shard_set_root, 'source_shard_set_recompute_failed');
  const sourceQuestions = shards.flatMap((shard) => shard.questions);
  const sourceIds = sourceQuestions.map((question) => question.question_id);
  assert(JSON.stringify(sourceIds) === JSON.stringify(jsonRecords.map((record) => record.question_id)), 'source_question_id_order_mismatch');
  assert(sourceQuestions.every((question, index) => question.verbatim_oral_question === jsonRecords[index].verbatim_question), 'source_verbatim_mismatch');
  assert(sourceQuestions.every((question, index) => question.minimally_normalized_question === jsonRecords[index].minimally_normalized_question), 'source_normalized_mismatch');
  let recordIndex = 0;
  for (const shard of shards) {
    const row = roster[shard.drill_order - 1];
    const sequences = new Map(shard.student_call_sequences.map((sequence) => [sequence.sequence_id, sequence]));
    for (const question of shard.questions) {
      const record = jsonRecords[recordIndex];
      const sequence = sequences.get(question.sequence_id);
      const expectedAmbiguity = question.ambiguity_flags.length > 0 || question.medical_question_status === 'AMBIGUOUS_RETAINED_QUARANTINED';
      const expectedAliases = {
        drill_source_alias: shard.source_alias,
        transcript_artifact_alias: basename(row.transcript_path).replace(/\.json$/u, ''),
        nodes_artifact_alias: basename(row.nodes_path).replace(/\.json$/u, ''),
      };
      const expectedReceipt = {
        source_schema_version: shard.schema_version,
        run_contract_hash: shard.run_contract_hash,
        shard_id: shard.shard_id,
        shard_content_hash: shard.content_hash,
        shard_safe_projection_hash: shard.safe_projection_hash,
        question_content_hash: question.content_hash,
        question_provenance_hash: question.provenance_hash,
        validation_receipt_bindings: shard.validation_receipt_bindings,
      };
      assert(record.drill_id === shard.drill_id && record.drill_order === shard.drill_order, `source_drill_identity_mismatch:${recordIndex}`);
      assert(record.question_order === question.question_order_in_drill && record.student_sequence_id === question.sequence_id, `source_question_order_mismatch:${recordIndex}`);
      assert(record.student_sequence_order === sequence.sequence_order && record.question_order_in_sequence === question.question_order_in_sequence, `source_sequence_order_mismatch:${recordIndex}`);
      assert(record.question_role === question.question_role && record.question_type === question.question_form, `source_question_form_mismatch:${recordIndex}`);
      assert(record.timestamp_start_us === question.start_timestamp_us && record.timestamp_end_us === question.end_timestamp_us, `source_timestamp_mismatch:${recordIndex}`);
      assert(record.confidence_ppm === question.confidence.score_ppm && stableHash(record.confidence_basis_codes) === stableHash(question.confidence.basis_codes), `source_confidence_mismatch:${recordIndex}`);
      assert(record.ambiguity_flag === expectedAmbiguity && stableHash(record.ambiguity_flags) === stableHash(question.ambiguity_flags), `source_ambiguity_mismatch:${recordIndex}`);
      assert(record.medical_question_status === question.medical_question_status && record.answer_binding_status === question.answer_binding_status, `source_status_mismatch:${recordIndex}`);
      assert(record.transcript_hash === shard.transcript_sha256 && record.nodes_hash === shard.nodes_sha256, `source_artifact_hash_mismatch:${recordIndex}`);
      assert(record.transcript_binding_root === question.transcript_binding_root && record.nodes_binding_root === question.nodes_binding_root, `source_binding_root_mismatch:${recordIndex}`);
      assert(record.question_provenance_hash === question.provenance_hash && record.source_question_content_hash === question.content_hash, `source_question_hash_mismatch:${recordIndex}`);
      assert(stableHash(record.processing_receipt) === stableHash(expectedReceipt), `source_processing_receipt_mismatch:${recordIndex}`);
      assert(stableHash(record.source_aliases) === stableHash(expectedAliases), `source_aliases_mismatch:${recordIndex}`);
      assert(record.source_transcript === expectedAliases.transcript_artifact_alias && record.source_nodes === expectedAliases.nodes_artifact_alias, `source_artifact_alias_mismatch:${recordIndex}`);
      assert(record.release_status === question.release_status, `source_release_status_mismatch:${recordIndex}`);
      recordIndex += 1;
    }
  }
  assert(recordIndex === EXPECTED.questions, 'source_full_row_reconciliation_count_invalid');

  const textCounts = new Map();
  for (const record of jsonRecords) textCounts.set(record.verbatim_question, (textCounts.get(record.verbatim_question) ?? 0) + 1);
  const duplicateCounts = [...textCounts.values()].filter((count) => count > 1);
  assert(textCounts.size === EXPECTED.unique_verbatim, 'duplicate_unique_verbatim_count_invalid');
  assert(duplicateCounts.length === EXPECTED.duplicate_groups, 'duplicate_group_count_invalid');
  assert(duplicateCounts.reduce((sum, count) => sum + count, 0) === EXPECTED.duplicate_rows, 'duplicate_row_count_invalid');

  for (const name of ['question-counts-by-drill.json', 'question-counts-by-topic.json', 'question-counts-by-specialty.json', 'question-counts-by-subject.json', 'question-counts-by-organ-system.json']) {
    const aggregate = JSON.parse(await readFile(join(target, name), 'utf8'));
    assert(verifyContentAddressedEnvelope(aggregate), `aggregate_hash_invalid:${name}`);
    assert(aggregate.total === EXPECTED.questions && aggregate.rows.reduce((sum, row) => sum + row.question_count, 0) === EXPECTED.questions, `aggregate_total_invalid:${name}`);
  }
  const drillCounts = JSON.parse(await readFile(join(target, 'question-counts-by-drill.json'), 'utf8'));
  assert(drillCounts.rows.length === EXPECTED.drills, 'drill_rollup_count_invalid');
  assert(drillCounts.rows.every((row) => row.validation === 'PASS'), 'drill_rollup_validation_failed');

  const manifest = JSON.parse(await readFile(join(target, 'question-manifest.json'), 'utf8'));
  assert(verifyContentAddressedEnvelope(manifest), 'manifest_content_hash_invalid');
  assert(manifest.record_count === EXPECTED.questions && manifest.records.length === EXPECTED.questions, 'manifest_record_count_invalid');
  for (const artifact of manifest.artifacts) {
    const bytes = await readFile(join(target, artifact.name));
    assert(bytes.length === artifact.bytes && sha256(bytes) === artifact.sha256, `manifest_artifact_hash_invalid:${artifact.name}`);
  }
  const permissionFindings = await verifyPermissions(target);
  assert(permissionFindings.length === 0, `restricted_permission_findings:${permissionFindings.join(',')}`);

  const report = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008g.validation-report.v1',
    passed: true,
    source_contract_hash: state.run_contract_hash,
    source_shard_set_root: state.shard_set_root,
    record_count: EXPECTED.questions,
    drill_count: EXPECTED.drills,
    primary_count: EXPECTED.primary,
    follow_up_count: EXPECTED.follow_up,
    ambiguous_count: EXPECTED.ambiguous,
    unique_question_id_count: EXPECTED.questions,
    unique_verbatim_count: textCounts.size,
    duplicate_verbatim_groups: duplicateCounts.length,
    duplicate_verbatim_rows: duplicateCounts.reduce((sum, count) => sum + count, 0),
    cross_format_projection_agreement: 'PASS',
    cross_format_record_agreement: 'PASS',
    format_results: formats,
    source_question_id_order_agreement: 'PASS',
    source_verbatim_byte_agreement: 'PASS',
    source_normalized_value_agreement: 'PASS',
    source_metadata_and_provenance_field_agreement: 'PASS',
    sql_ddl_insert_column_agreement: 'PASS',
    sql_ddl_and_data_atomic_transaction: 'PASS',
    schema_validation: 'PASS_16690_OF_16690_EACH_FORMAT',
    csv_rfc4180_parse: 'PASS',
    sql_literal_parse: 'PASS',
    restricted_permissions: 'PASS',
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
  await writeFile(join(target, 'validation-report.json'), canonicalFileBytes(report), { mode: 0o600 });
  await chmod(join(target, 'validation-report.json'), 0o600);
  await writeFile(join(target, 'validation-report.md'), validationMarkdown(report), { mode: 0o600 });
  await chmod(join(target, 'validation-report.md'), 0o600);
  return report;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [sourceBoundary, targetBoundary] = process.argv.slice(2);
  if (!sourceBoundary || !targetBoundary) throw new Error('usage: node validate-question-database.mjs SOURCE_GOLD_BOUNDARY TARGET_DATABASE_BOUNDARY');
  const report = await validateQuestionDatabase({ sourceBoundary, targetBoundary });
  process.stdout.write(`${JSON.stringify({ passed: report.passed, record_count: report.record_count, content_hash: report.content_hash })}\n`);
}
