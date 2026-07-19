import { createHash } from 'node:crypto';
import {
  chmod, mkdir, open, readFile, readdir, stat, unlink, writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  canonicalFileBytes,
  contentAddressedEnvelope,
  stableHash,
  stableStringify,
  verifyContentAddressedEnvelope,
} from '../../I1Q_1008F_DRILL_QUESTION_GOLD_SET/tools/canonical.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HANDOFF = dirname(HERE);
const EXPECTED = Object.freeze({
  drills: 97,
  questions: 16690,
  primary: 3054,
  follow_up: 13636,
  ambiguous: 10123,
  contract: 'de31610de045da1ea217a19dc4420e07c3deee9cf533482d3eeff301492d52ff',
  shard_set: '4d906f3825cac5e8190bd8d379e512bcfb339fa2e4489a2bdceb7cd0eb7ff978',
});

export const CSV_COLUMNS = Object.freeze([
  'schema_version', 'question_id', 'drill_id', 'drill_order', 'drill_date',
  'source_transcript', 'source_nodes', 'question_order', 'student_sequence_id',
  'student_sequence_order', 'question_order_in_sequence', 'question_role',
  'verbatim_question', 'minimally_normalized_question', 'timestamp_start_us',
  'timestamp_end_us', 'specialty', 'subject', 'topic', 'subtopic', 'organ_system',
  'question_type', 'cognitive_level', 'confidence_ppm', 'confidence_basis_codes',
  'ambiguity_flag', 'ambiguity_flags', 'metadata_status', 'medical_question_status',
  'answer_binding_status', 'transcript_hash', 'nodes_hash', 'transcript_binding_root',
  'nodes_binding_root', 'question_provenance_hash', 'source_question_content_hash',
  'processing_receipt', 'source_aliases', 'release_status', 'record_hash',
]);

const JSON_COLUMNS = new Set([
  'confidence_basis_codes', 'ambiguity_flags', 'processing_receipt', 'source_aliases',
]);
const BOOLEAN_COLUMNS = new Set(['ambiguity_flag']);
const INTEGER_COLUMNS = new Set([
  'drill_order', 'question_order', 'student_sequence_order',
  'question_order_in_sequence', 'timestamp_start_us', 'timestamp_end_us', 'confidence_ppm',
]);

const SQLITE_DDL = `
PRAGMA foreign_keys = ON;
CREATE TABLE question_database (
  schema_version TEXT NOT NULL,
  question_id TEXT PRIMARY KEY,
  drill_id TEXT NOT NULL,
  drill_order INTEGER NOT NULL CHECK (drill_order BETWEEN 1 AND 97),
  drill_date TEXT NULL,
  source_transcript TEXT NOT NULL,
  source_nodes TEXT NOT NULL,
  question_order INTEGER NOT NULL CHECK (question_order > 0),
  student_sequence_id TEXT NOT NULL,
  student_sequence_order INTEGER NOT NULL CHECK (student_sequence_order > 0),
  question_order_in_sequence INTEGER NOT NULL CHECK (question_order_in_sequence > 0),
  question_role TEXT NOT NULL CHECK (question_role IN ('PRIMARY','FOLLOW_UP')),
  verbatim_question TEXT NOT NULL CHECK (length(verbatim_question) > 0),
  minimally_normalized_question TEXT NULL,
  timestamp_start_us INTEGER NOT NULL CHECK (timestamp_start_us >= 0),
  timestamp_end_us INTEGER NOT NULL CHECK (timestamp_end_us >= timestamp_start_us),
  specialty TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  organ_system TEXT NOT NULL,
  question_type TEXT NOT NULL,
  cognitive_level TEXT NOT NULL,
  confidence_ppm INTEGER NOT NULL CHECK (confidence_ppm BETWEEN 0 AND 1000000),
  confidence_basis_codes TEXT NOT NULL CHECK (json_valid(confidence_basis_codes)),
  ambiguity_flag INTEGER NOT NULL CHECK (ambiguity_flag IN (0,1)),
  ambiguity_flags TEXT NOT NULL CHECK (json_valid(ambiguity_flags)),
  metadata_status TEXT NOT NULL,
  medical_question_status TEXT NOT NULL,
  answer_binding_status TEXT NOT NULL,
  transcript_hash TEXT NOT NULL,
  nodes_hash TEXT NOT NULL,
  transcript_binding_root TEXT NOT NULL,
  nodes_binding_root TEXT NULL,
  question_provenance_hash TEXT NOT NULL,
  source_question_content_hash TEXT NOT NULL,
  processing_receipt TEXT NOT NULL CHECK (json_valid(processing_receipt)),
  source_aliases TEXT NOT NULL CHECK (json_valid(source_aliases)),
  release_status TEXT NOT NULL CHECK (release_status = 'RESTRICTED_ONLY'),
  record_hash TEXT NOT NULL,
  UNIQUE (drill_id, question_order)
);
CREATE INDEX question_database_drill_sequence_idx
  ON question_database (drill_order, student_sequence_order, question_order_in_sequence);
CREATE INDEX question_database_topic_idx ON question_database (topic);
CREATE INDEX question_database_specialty_idx ON question_database (specialty);
CREATE INDEX question_database_subject_idx ON question_database (subject);
CREATE INDEX question_database_organ_system_idx ON question_database (organ_system);
`;

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function sha256File(path) {
  return sha256Bytes(await readFile(path));
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function csvCell(value) {
  if (value === null) return '';
  const text = typeof value === 'object' ? stableStringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function sqlText(value) {
  if (value === null) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(column, value) {
  if (value === null) return 'NULL';
  if (JSON_COLUMNS.has(column)) return `${sqlText(stableStringify(value))}::jsonb`;
  if (BOOLEAN_COLUMNS.has(column)) return value ? 'TRUE' : 'FALSE';
  if (INTEGER_COLUMNS.has(column)) return String(value);
  return sqlText(value);
}

function sqliteValue(column, value) {
  if (value === null) return null;
  if (JSON_COLUMNS.has(column)) return stableStringify(value);
  if (BOOLEAN_COLUMNS.has(column)) return value ? 1 : 0;
  return value;
}

function sourceProjection(shard, question, sequence) {
  return {
    drill_order: shard.drill_order,
    drill_id: question.drill_id,
    question_order: question.question_order_in_drill,
    question_id: question.question_id,
    sequence_id: question.sequence_id,
    sequence_order: sequence.sequence_order,
    question_order_in_sequence: question.question_order_in_sequence,
    question_role: question.question_role,
    verbatim_question: question.verbatim_oral_question,
    minimally_normalized_question: question.minimally_normalized_question,
    timestamp_start_us: question.start_timestamp_us,
    timestamp_end_us: question.end_timestamp_us,
    transcript_hash: shard.transcript_sha256,
    nodes_hash: shard.nodes_sha256,
    transcript_binding_root: question.transcript_binding_root,
    nodes_binding_root: question.nodes_binding_root,
    question_provenance_hash: question.provenance_hash,
  };
}

function databaseProjection(record) {
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

function toRecord(shard, question, sequence, rosterRow) {
  const aliases = {
    drill_source_alias: shard.source_alias,
    transcript_artifact_alias: basename(rosterRow.transcript_path).replace(/\.json$/u, ''),
    nodes_artifact_alias: basename(rosterRow.nodes_path).replace(/\.json$/u, ''),
  };
  const record = {
    schema_version: 'missionmed.i1q.1008g.question-record.v1',
    question_id: question.question_id,
    drill_id: shard.drill_id,
    drill_order: shard.drill_order,
    drill_date: null,
    source_transcript: aliases.transcript_artifact_alias,
    source_nodes: aliases.nodes_artifact_alias,
    question_order: question.question_order_in_drill,
    student_sequence_id: question.sequence_id,
    student_sequence_order: sequence.sequence_order,
    question_order_in_sequence: question.question_order_in_sequence,
    question_role: question.question_role,
    verbatim_question: question.verbatim_oral_question,
    minimally_normalized_question: question.minimally_normalized_question,
    timestamp_start_us: question.start_timestamp_us,
    timestamp_end_us: question.end_timestamp_us,
    specialty: 'UNCLASSIFIED',
    subject: 'UNCLASSIFIED',
    topic: 'UNCLASSIFIED',
    subtopic: 'UNCLASSIFIED',
    organ_system: 'UNCLASSIFIED',
    question_type: question.question_form,
    cognitive_level: 'UNCLASSIFIED',
    confidence_ppm: question.confidence.score_ppm,
    confidence_basis_codes: question.confidence.basis_codes,
    ambiguity_flag: question.ambiguity_flags.length > 0 || question.medical_question_status === 'AMBIGUOUS_RETAINED_QUARANTINED',
    ambiguity_flags: question.ambiguity_flags,
    metadata_status: 'SOURCE_METADATA_ABSENT_UNCLASSIFIED',
    medical_question_status: question.medical_question_status,
    answer_binding_status: question.answer_binding_status,
    transcript_hash: shard.transcript_sha256,
    nodes_hash: shard.nodes_sha256,
    transcript_binding_root: question.transcript_binding_root,
    nodes_binding_root: question.nodes_binding_root,
    question_provenance_hash: question.provenance_hash,
    source_question_content_hash: question.content_hash,
    processing_receipt: {
      source_schema_version: shard.schema_version,
      run_contract_hash: shard.run_contract_hash,
      shard_id: shard.shard_id,
      shard_content_hash: shard.content_hash,
      shard_safe_projection_hash: shard.safe_projection_hash,
      question_content_hash: question.content_hash,
      question_provenance_hash: question.provenance_hash,
      validation_receipt_bindings: shard.validation_receipt_bindings,
    },
    source_aliases: aliases,
    release_status: question.release_status,
  };
  return { ...record, record_hash: stableHash(record) };
}

function validateSource(shards, roster, state) {
  assert(shards.length === EXPECTED.drills, 'source_shard_count_invalid');
  assert(roster.length === EXPECTED.drills, 'source_roster_count_invalid');
  assert(state.run_contract_hash === EXPECTED.contract, 'source_contract_hash_invalid');
  assert(state.shard_set_root === EXPECTED.shard_set, 'source_shard_set_root_invalid');
  const recomputedRoot = stableHash(shards.map((shard) => ({ drill_order: shard.drill_order, content_hash: shard.content_hash })));
  assert(recomputedRoot === state.shard_set_root, 'source_shard_set_recompute_failed');
  const ids = new Set();
  let total = 0;
  let primary = 0;
  let followUp = 0;
  let ambiguous = 0;
  for (let index = 0; index < shards.length; index += 1) {
    const shard = shards[index];
    const row = roster[index];
    assert(shard.drill_order === index + 1 && row.drill_order === index + 1, 'source_drill_order_invalid');
    assert(verifyContentAddressedEnvelope(shard), `source_shard_content_hash_invalid:${index + 1}`);
    assert(shard.run_contract_hash === state.run_contract_hash, `source_contract_binding_invalid:${index + 1}`);
    assert(shard.source_alias === row.source_alias, `source_alias_binding_invalid:${index + 1}`);
    assert(shard.transcript_sha256 === row.transcript_sha256, `source_transcript_binding_invalid:${index + 1}`);
    assert(shard.nodes_sha256 === row.nodes_sha256, `source_nodes_binding_invalid:${index + 1}`);
    assert(shard.questions.every((question, questionIndex) => question.question_order_in_drill === questionIndex + 1), `source_question_order_invalid:${index + 1}`);
    const sequences = new Map(shard.student_call_sequences.map((sequence) => [sequence.sequence_id, sequence]));
    for (const question of shard.questions) {
      assert(verifyContentAddressedEnvelope(question), `source_question_content_hash_invalid:${question.question_id}`);
      assert(!ids.has(question.question_id), `source_question_id_duplicate:${question.question_id}`);
      ids.add(question.question_id);
      const sequence = sequences.get(question.sequence_id);
      assert(sequence, `source_sequence_join_missing:${question.question_id}`);
      assert(sequence.question_ids.includes(question.question_id), `source_sequence_membership_missing:${question.question_id}`);
      assert(question.start_timestamp_us <= question.end_timestamp_us, `source_timestamp_invalid:${question.question_id}`);
      assert(question.transcript_segment_bindings.length > 0, `source_transcript_binding_empty:${question.question_id}`);
      if (question.question_role === 'PRIMARY') primary += 1;
      else if (question.question_role === 'FOLLOW_UP') followUp += 1;
      else throw new Error(`source_question_role_invalid:${question.question_id}`);
      if (question.ambiguity_flags.length > 0 || question.medical_question_status === 'AMBIGUOUS_RETAINED_QUARANTINED') ambiguous += 1;
      total += 1;
    }
    for (const sequence of shard.student_call_sequences) {
      const questions = sequence.question_ids.map((id) => shard.questions.find((question) => question.question_id === id));
      assert(questions.length > 0 && questions.every(Boolean), `source_sequence_question_missing:${sequence.sequence_id}`);
      assert(questions[0].question_role === 'PRIMARY' && questions[0].question_order_in_sequence === 1, `source_sequence_primary_invalid:${sequence.sequence_id}`);
      assert(questions.slice(1).every((question, qIndex) => question.question_role === 'FOLLOW_UP' && question.question_order_in_sequence === qIndex + 2), `source_sequence_followup_invalid:${sequence.sequence_id}`);
    }
  }
  assert(total === EXPECTED.questions, 'source_question_count_invalid');
  assert(primary === EXPECTED.primary, 'source_primary_count_invalid');
  assert(followUp === EXPECTED.follow_up, 'source_followup_count_invalid');
  assert(ambiguous === EXPECTED.ambiguous, 'source_ambiguous_count_invalid');
  return { total, primary, follow_up: followUp, ambiguous, unique_question_ids: ids.size, recomputed_shard_set_root: recomputedRoot };
}

function rollup(records, field) {
  const counts = new Map();
  for (const record of records) counts.set(record[field] ?? 'UNCLASSIFIED', (counts.get(record[field] ?? 'UNCLASSIFIED') ?? 0) + 1);
  return [...counts].sort(([left], [right]) => left.localeCompare(right)).map(([value, question_count]) => ({ [field]: value, question_count }));
}

function buildDrillCounts(records) {
  const grouped = new Map();
  for (const record of records) {
    if (!grouped.has(record.drill_order)) grouped.set(record.drill_order, []);
    grouped.get(record.drill_order).push(record);
  }
  return [...grouped].sort(([left], [right]) => left - right).map(([drillOrder, rows]) => {
    const starts = rows.map((row) => row.timestamp_start_us);
    const numerator = starts.at(-1) - starts[0];
    const denominator = Math.max(0, starts.length - 1);
    return {
      drill_order: drillOrder,
      drill_id: rows[0].drill_id,
      drill_date: null,
      question_count: rows.length,
      primary_count: rows.filter((row) => row.question_role === 'PRIMARY').length,
      follow_up_count: rows.filter((row) => row.question_role === 'FOLLOW_UP').length,
      average_timestamp_spacing_numerator_us: denominator ? numerator : null,
      average_timestamp_spacing_denominator: denominator || null,
      average_timestamp_spacing_us_decimal: denominator ? (numerator / denominator).toFixed(6) : null,
      validation: rows.every((row, index) => row.question_order === index + 1) ? 'PASS' : 'FAIL',
    };
  });
}

async function atomicWrite(path, bytes) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
  await chmod(temporary, 0o600);
  await import('node:fs/promises').then(({ rename }) => rename(temporary, path));
}

async function writeJson(path, value) {
  await atomicWrite(path, canonicalFileBytes(value));
}

function sqliteInsert(db, records) {
  const placeholders = CSV_COLUMNS.map(() => '?').join(',');
  const statement = db.prepare(`INSERT INTO question_database (${CSV_COLUMNS.join(',')}) VALUES (${placeholders})`);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const record of records) statement.run(...CSV_COLUMNS.map((column) => sqliteValue(column, record[column])));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function markdownQuestionsPerDrill(drillCounts) {
  const lines = [
    '# Questions per Drill', '',
    'Drill dates are unavailable in the accepted Gold Set and remain `UNKNOWN`. Average spacing uses consecutive question start timestamps in question order and includes zero gaps.', '',
    '| Drill | Question count | Primary | Follow-up | Average spacing (seconds) | Validation |',
    '|---:|---:|---:|---:|---:|:---:|',
  ];
  for (const row of drillCounts) lines.push(`| ${row.drill_order} | ${row.question_count} | ${row.primary_count} | ${row.follow_up_count} | ${(Number(row.average_timestamp_spacing_us_decimal) / 1_000_000).toFixed(3)} | ${row.validation} |`);
  return `${lines.join('\n')}\n`;
}

export async function buildQuestionDatabase({ sourceBoundary, targetBoundary }) {
  const source = resolve(sourceBoundary);
  const target = resolve(targetBoundary);
  const targetExists = await stat(target).then(() => true, () => false);
  if (targetExists) assert((await readdir(target)).length === 0, 'target_boundary_must_be_absent_or_empty');
  await mkdir(target, { recursive: true, mode: 0o700 });
  await chmod(target, 0o700);
  const lockPath = join(target, '.question-database-builder.lock');
  const lock = await open(lockPath, 'wx', 0o600);
  try {
    const roster = JSON.parse(await readFile(join(source, 'state/restricted-roster.json'), 'utf8'));
    const state = JSON.parse(await readFile(join(source, 'state/run-state.json'), 'utf8'));
    const shardFiles = (await readdir(join(source, 'working/shards'))).filter((name) => /^[a-f0-9]{64}\.json$/u.test(name));
    const shards = [];
    for (const name of shardFiles) shards.push(JSON.parse(await readFile(join(source, 'working/shards', name), 'utf8')));
    shards.sort((left, right) => left.drill_order - right.drill_order);
    roster.sort((left, right) => left.drill_order - right.drill_order);
    const sourceValidation = validateSource(shards, roster, state);

    const records = [];
    const sourceProjections = [];
    for (const shard of shards) {
      const sequences = new Map(shard.student_call_sequences.map((sequence) => [sequence.sequence_id, sequence]));
      const rosterRow = roster[shard.drill_order - 1];
      for (const question of shard.questions) {
        const sequence = sequences.get(question.sequence_id);
        const record = toRecord(shard, question, sequence, rosterRow);
        records.push(record);
        sourceProjections.push(sourceProjection(shard, question, sequence));
      }
    }
    records.sort((left, right) => left.drill_order - right.drill_order || left.question_order - right.question_order);
    assert(records.length === EXPECTED.questions, 'database_record_count_invalid');
    assert(stableHash(sourceProjections) === stableHash(records.map(databaseProjection)), 'database_projection_mismatch');
    assert(new Set(records.map((record) => record.question_id)).size === EXPECTED.questions, 'database_question_id_uniqueness_invalid');

    const sourceProjectionRoot = stableHash(sourceProjections);
    const orderedRecordRoot = stableHash(records.map((record) => record.record_hash));
    const jsonEnvelope = contentAddressedEnvelope({
      schema_version: 'missionmed.i1q.1008g.question-database-import.v1',
      source_run_contract_hash: state.run_contract_hash,
      source_shard_set_root: state.shard_set_root,
      record_count: records.length,
      source_projection_root: sourceProjectionRoot,
      ordered_record_root: orderedRecordRoot,
      records,
    });

    const jsonPath = join(target, 'question-database.import.json');
    await writeJson(jsonPath, jsonEnvelope);

    const csvPath = join(target, 'question-database.import.csv');
    const csv = [CSV_COLUMNS.map(csvCell).join(','), ...records.map((record) => CSV_COLUMNS.map((column) => csvCell(record[column])).join(','))].join('\n') + '\n';
    await atomicWrite(csvPath, Buffer.from(csv, 'utf8'));

    const schemaPath = join(HANDOFF, 'schemas/question-database.postgresql.sql');
    const schemaSql = await readFile(schemaPath, 'utf8');
    const insertChunks = [];
    for (let start = 0; start < records.length; start += 250) {
      const chunk = records.slice(start, start + 250);
      const values = chunk.map((record) => `(${CSV_COLUMNS.map((column) => sqlValue(column, record[column])).join(',')})`).join(',\n');
      insertChunks.push(`INSERT INTO question_database (${CSV_COLUMNS.join(',')}) VALUES\n${values};`);
    }
    const sqlPath = join(target, 'question-database.import.sql');
    const sql = `BEGIN;\n${schemaSql.trim()}\n\n${insertChunks.join('\n')}\nCOMMIT;\n`;
    await atomicWrite(sqlPath, Buffer.from(sql, 'utf8'));

    const databasePath = join(target, 'question-database.sqlite');
    const db = new DatabaseSync(databasePath);
    try {
      db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
      db.exec(SQLITE_DDL);
      sqliteInsert(db, records);
      const row = db.prepare('SELECT count(*) AS n, count(DISTINCT question_id) AS ids FROM question_database').get();
      assert(row.n === EXPECTED.questions && row.ids === EXPECTED.questions, 'sqlite_record_count_invalid');
      db.exec('VACUUM');
    } finally {
      db.close();
    }
    await chmod(databasePath, 0o600);

    await atomicWrite(join(target, 'question-record.schema.json'), await readFile(join(HANDOFF, 'schemas/question-record.schema.json')));
    await atomicWrite(join(target, 'question-database.postgresql.sql'), Buffer.from(schemaSql, 'utf8'));

    const drillCounts = buildDrillCounts(records);
    const countArtifacts = {
      'question-counts-by-drill.json': contentAddressedEnvelope({ schema_version: 'missionmed.i1q.1008g.counts-by-drill.v1', rows: drillCounts, total: records.length }),
      'question-counts-by-topic.json': contentAddressedEnvelope({ schema_version: 'missionmed.i1q.1008g.counts-by-topic.v1', rows: rollup(records, 'topic'), total: records.length }),
      'question-counts-by-specialty.json': contentAddressedEnvelope({ schema_version: 'missionmed.i1q.1008g.counts-by-specialty.v1', rows: rollup(records, 'specialty'), total: records.length }),
      'question-counts-by-subject.json': contentAddressedEnvelope({ schema_version: 'missionmed.i1q.1008g.counts-by-subject.v1', rows: rollup(records, 'subject'), total: records.length }),
      'question-counts-by-organ-system.json': contentAddressedEnvelope({ schema_version: 'missionmed.i1q.1008g.counts-by-organ-system.v1', rows: rollup(records, 'organ_system'), total: records.length }),
    };
    for (const [name, value] of Object.entries(countArtifacts)) await writeJson(join(target, name), value);
    await atomicWrite(join(target, 'questions-per-drill.md'), Buffer.from(markdownQuestionsPerDrill(drillCounts), 'utf8'));

    const manifestEntries = records.map((record, index) => ({
      ordinal: index + 1,
      question_id: record.question_id,
      drill_order: record.drill_order,
      question_order: record.question_order,
      record_hash: record.record_hash,
    }));
    const coreArtifacts = [
      'question-database.sqlite', 'question-database.import.json', 'question-database.import.csv',
      'question-database.import.sql', 'question-record.schema.json', 'question-database.postgresql.sql',
      ...Object.keys(countArtifacts), 'questions-per-drill.md',
    ];
    const artifactManifest = [];
    for (const name of coreArtifacts) {
      const info = await stat(join(target, name));
      artifactManifest.push({ name, bytes: info.size, sha256: await sha256File(join(target, name)) });
    }
    const manifest = contentAddressedEnvelope({
      schema_version: 'missionmed.i1q.1008g.question-manifest.v1',
      source_run_contract_hash: state.run_contract_hash,
      source_shard_set_root: state.shard_set_root,
      record_count: records.length,
      ordered_record_root: orderedRecordRoot,
      source_projection_root: sourceProjectionRoot,
      duplicate_policy: 'PRESERVE_EVERY_OCCURRENCE',
      records: manifestEntries,
      artifacts: artifactManifest,
    });
    await writeJson(join(target, 'question-manifest.json'), manifest);

    const receipt = contentAddressedEnvelope({
      schema_version: 'missionmed.i1q.1008g.build-receipt.v1',
      source_validation: sourceValidation,
      source_run_contract_hash: state.run_contract_hash,
      source_shard_set_root_before: state.shard_set_root,
      source_shard_set_root_after: stableHash(shards.map((shard) => ({ drill_order: shard.drill_order, content_hash: shard.content_hash }))),
      source_projection_root: sourceProjectionRoot,
      ordered_record_root: orderedRecordRoot,
      record_count: records.length,
      primary_count: records.filter((record) => record.question_role === 'PRIMARY').length,
      follow_up_count: records.filter((record) => record.question_role === 'FOLLOW_UP').length,
      ambiguous_count: records.filter((record) => record.ambiguity_flag).length,
      duplicate_policy: 'PRESERVE_EVERY_OCCURRENCE',
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
    await writeJson(join(target, 'build-receipt.json'), receipt);
    for (const entry of await readdir(target, { withFileTypes: true })) if (entry.isFile()) await chmod(join(target, entry.name), 0o600);
    return { target, record_count: records.length, source_projection_root: sourceProjectionRoot, ordered_record_root: orderedRecordRoot, manifest_hash: manifest.content_hash, build_receipt_hash: receipt.content_hash };
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [sourceBoundary, targetBoundary] = process.argv.slice(2);
  if (!sourceBoundary || !targetBoundary) throw new Error('usage: node build-question-database.mjs SOURCE_GOLD_BOUNDARY TARGET_DATABASE_BOUNDARY');
  const result = await buildQuestionDatabase({ sourceBoundary, targetBoundary });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
