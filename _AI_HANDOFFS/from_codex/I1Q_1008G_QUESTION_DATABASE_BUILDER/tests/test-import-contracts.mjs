import assert from 'node:assert/strict';
import test from 'node:test';
import { CSV_COLUMNS } from '../tools/build-question-database.mjs';
import { parseCsv, recordsFromSql } from '../tools/validate-question-database.mjs';

test('RFC 4180 parser preserves commas, quotes, apostrophes, Unicode, and line breaks', () => {
  const csv = '"a","b"\n"comma, value","quote "" value"\n"apostrophe \'","Unicode β\nline"\n';
  assert.deepEqual(parseCsv(csv), [
    ['a', 'b'],
    ['comma, value', 'quote " value'],
    ["apostrophe '", 'Unicode β\nline'],
  ]);
});

test('PostgreSQL import parser preserves typed literals and doubled apostrophes', () => {
  const values = Object.fromEntries(CSV_COLUMNS.map((column) => [column, 'x']));
  Object.assign(values, {
    drill_order: 1,
    drill_date: null,
    question_order: 1,
    student_sequence_order: 1,
    question_order_in_sequence: 1,
    timestamp_start_us: 10,
    timestamp_end_us: 20,
    confidence_ppm: 900000,
    confidence_basis_codes: ['A'],
    ambiguity_flag: true,
    ambiguity_flags: [],
    processing_receipt: { source: "O'Brien" },
    source_aliases: { a: 'β' },
  });
  const sqlLiteral = (column, value) => {
    if (value === null) return 'NULL';
    if (['confidence_basis_codes', 'ambiguity_flags', 'processing_receipt', 'source_aliases'].includes(column)) {
      return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
    }
    if (column === 'ambiguity_flag') return 'TRUE';
    if (['drill_order', 'question_order', 'student_sequence_order', 'question_order_in_sequence', 'timestamp_start_us', 'timestamp_end_us', 'confidence_ppm'].includes(column)) return String(value);
    return `'${String(value).replaceAll("'", "''")}'`;
  };
  const sql = `INSERT INTO question_database (${CSV_COLUMNS.join(',')}) VALUES\n(${CSV_COLUMNS.map((column) => sqlLiteral(column, values[column])).join(',')});`;
  const [parsed] = recordsFromSql(sql);
  assert.equal(parsed.drill_date, null);
  assert.equal(parsed.ambiguity_flag, true);
  assert.deepEqual(parsed.processing_receipt, { source: "O'Brien" });
  assert.deepEqual(parsed.source_aliases, { a: 'β' });
});

test('database schema deliberately contains no wording uniqueness or silent conflict suppression', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../schemas/question-database.postgresql.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /ON\s+CONFLICT\s+DO\s+NOTHING/iu);
  assert.doesNotMatch(sql, /UNIQUE\s*\([^)]*(?:verbatim|minimally_normalized|topic|subject|specialty)/iu);
  const ddlBody = sql.match(/CREATE TABLE question_database\s*\(([\s\S]*?)\n\);/u)?.[1];
  assert.ok(ddlBody);
  const ddlColumns = [...ddlBody.matchAll(/^\s{2}([a-z_]+)\s/gmu)].map((match) => match[1]);
  assert.deepEqual(ddlColumns, CSV_COLUMNS);
});
