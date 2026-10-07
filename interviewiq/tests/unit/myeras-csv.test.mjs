import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMyerasCsv,MYERAS_HEADER,MAX_BYTES,MAX_ROWS} from '../../server/myeras-csv.mjs';

// Helper: build a valid CSV with given rows
function buildCsv(rows, header = MYERAS_HEADER) {
  const lines = [header.join(',')];
  for (const row of rows) lines.push(row.join(','));
  return lines.join('\n');
}

function validRow(overrides = {}) {
  const defaults = {
    program_name: 'Mayo Clinic Internal Medicine',
    specialty: 'Internal Medicine',
    track: 'Categorical',
    institution: 'Mayo Clinic',
    city: 'Rochester',
    state: 'MN',
    program_identifier: 'ACGME1234567890',
    application_status: 'Applied',
    signal_status: 'Signaled',
    interview_status: 'Interview Received',
    source: 'MYERAS',
    exported_at: '2025-01-15T12:00:00Z',
  };
  const merged = {...defaults, ...overrides};
  return MYERAS_HEADER.map(k => merged[k]);
}

// ── Constants ────────────────────────────────────────────────────────────

test('MYERAS_HEADER has 12 columns', () => {
  assert.equal(MYERAS_HEADER.length, 12);
});

test('MYERAS_HEADER is frozen', () => {
  assert.ok(Object.isFrozen(MYERAS_HEADER));
});

test('MAX_BYTES is 256 KB', () => {
  assert.equal(MAX_BYTES, 262144);
});

test('MAX_ROWS is 2000', () => {
  assert.equal(MAX_ROWS, 2000);
});

// ── Valid parsing ─────────────────────────────────────────────────────────

test('parses single valid row', () => {
  const csv = buildCsv([validRow()]);
  const result = parseMyerasCsv(csv);
  assert.equal(result.schema, 'iiq-myeras-import-v1');
  assert.equal(result.rowCount, 1);
  assert.equal(result.uniqueCount, 1);
  assert.equal(result.duplicateCount, 0);
  assert.equal(result.programs.length, 1);
  assert.equal(result.programs[0].original.program_name, 'Mayo Clinic Internal Medicine');
  assert.equal(result.programs[0].rowNumber, 1);
  assert.equal(result.programs[0].resolutionState, 'NOT_FOUND');
  assert.equal(result.programs[0].choice, 'MAYBE_LATER');
});

test('parses multiple valid rows', () => {
  const csv = buildCsv([
    validRow(),
    validRow({program_name: 'UCSF Internal Medicine', institution: 'UCSF', city: 'San Francisco', state: 'CA'}),
  ]);
  const result = parseMyerasCsv(csv);
  assert.equal(result.rowCount, 2);
  assert.equal(result.uniqueCount, 2);
  assert.equal(result.programs[0].rowNumber, 1);
  assert.equal(result.programs[1].rowNumber, 2);
});

test('accepts Uint8Array input', () => {
  const csv = buildCsv([validRow()]);
  const bytes = new TextEncoder().encode(csv);
  const result = parseMyerasCsv(bytes);
  assert.equal(result.uniqueCount, 1);
});

test('accepts string input', () => {
  const csv = buildCsv([validRow()]);
  const result = parseMyerasCsv(csv);
  assert.equal(result.uniqueCount, 1);
});

test('handles CRLF line endings', () => {
  const csv = buildCsv([validRow()]).replace(/\n/g, '\r\n');
  const result = parseMyerasCsv(csv);
  assert.equal(result.uniqueCount, 1);
});

test('handles CR-only line endings', () => {
  const csv = buildCsv([validRow()]).replace(/\n/g, '\r');
  const result = parseMyerasCsv(csv);
  assert.equal(result.uniqueCount, 1);
});

test('handles trailing newline', () => {
  const csv = buildCsv([validRow()]) + '\n';
  const result = parseMyerasCsv(csv);
  assert.equal(result.uniqueCount, 1);
});

// ── Quoting ──────────────────────────────────────────────────────────────

test('handles quoted cells with commas', () => {
  const row = validRow({program_name: '"Rochester, MN Program"'});
  // Build manually since the helper doesn't handle pre-quoted
  const header = MYERAS_HEADER.join(',');
  const cells = validRow();
  cells[0] = '"Rochester, MN Program"'; // quoted cell with comma
  const csv = header + '\n' + cells.join(',');
  const result = parseMyerasCsv(csv);
  assert.equal(result.programs[0].original.program_name, 'Rochester, MN Program');
});

test('handles escaped quotes in cells', () => {
  const header = MYERAS_HEADER.join(',');
  const cells = validRow();
  cells[0] = '"She said ""hello""  program"'; // escaped quotes
  const csv = header + '\n' + cells.join(',');
  const result = parseMyerasCsv(csv);
  assert.equal(result.programs[0].original.program_name, 'She said "hello"  program');
});

test('rejects quoted cells with embedded newlines', () => {
  const header = MYERAS_HEADER.join(',');
  const cells = validRow();
  cells[0] = '"Line one\nLine two"';
  const csv = header + '\n' + cells.join(',');
  // The newline in the quoted cell is preserved, but unsafe_csv_cell rejects \r\n in values
  assert.throws(() => parseMyerasCsv(csv), {code: 'unsafe_csv_cell'});
});

// ── Deduplication ────────────────────────────────────────────────────────

test('deduplicates identical rows (ignoring exported_at)', () => {
  const csv = buildCsv([
    validRow({exported_at: '2025-01-15T12:00:00Z'}),
    validRow({exported_at: '2025-01-16T12:00:00Z'}),
  ]);
  const result = parseMyerasCsv(csv);
  assert.equal(result.rowCount, 2);
  assert.equal(result.uniqueCount, 1);
  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(result.programs[0].exportedAt, ['2025-01-15T12:00:00Z', '2025-01-16T12:00:00Z']);
});

test('does not deduplicate rows with different content', () => {
  const csv = buildCsv([
    validRow({application_status: 'Applied'}),
    validRow({application_status: 'Withdrawn'}),
  ]);
  const result = parseMyerasCsv(csv);
  assert.equal(result.uniqueCount, 2);
  assert.equal(result.duplicateCount, 0);
});

// ── Size validation ──────────────────────────────────────────────────────

test('rejects empty input', () => {
  assert.throws(() => parseMyerasCsv(''), {code: 'invalid_csv_size'});
});

test('rejects empty Uint8Array', () => {
  assert.throws(() => parseMyerasCsv(new Uint8Array(0)), {code: 'invalid_csv_size'});
});

test('rejects oversized input', () => {
  const big = 'x'.repeat(MAX_BYTES + 1);
  assert.throws(() => parseMyerasCsv(big), {code: 'invalid_csv_size'});
});

test('rejects non-string non-Uint8Array', () => {
  assert.throws(() => parseMyerasCsv(42), {code: 'invalid_csv_size'});
});

// ── UTF-8 validation ────────────────────────────────────────────────────

test('rejects invalid UTF-8', () => {
  const bad = new Uint8Array([0x80, 0x81, 0x82]); // invalid UTF-8
  assert.throws(() => parseMyerasCsv(bad), {code: 'invalid_csv_utf8'});
});

// ── Control character rejection ─────────────────────────────────────────

test('rejects NUL character', () => {
  const csv = buildCsv([validRow()]).replace('Mayo', 'Ma\x00yo');
  assert.throws(() => parseMyerasCsv(csv), {code: 'unsafe_csv_control'});
});

test('rejects tab character', () => {
  const csv = buildCsv([validRow()]).replace('Mayo', 'Ma\tyo');
  assert.throws(() => parseMyerasCsv(csv), {code: 'unsafe_csv_control'});
});

test('rejects bidi override U+202A', () => {
  const csv = buildCsv([validRow()]).replace('Mayo', 'Ma‪yo');
  assert.throws(() => parseMyerasCsv(csv), {code: 'unsafe_csv_control'});
});

test('rejects bidi isolate U+2066', () => {
  const csv = buildCsv([validRow()]).replace('Mayo', 'Ma⁦yo');
  assert.throws(() => parseMyerasCsv(csv), {code: 'unsafe_csv_control'});
});

// ── Header validation ───────────────────────────────────────────────────

test('rejects wrong header', () => {
  const csv = 'name,specialty\nfoo,bar\n';
  assert.throws(() => parseMyerasCsv(csv), {code: 'unexpected_csv_header'});
});

test('rejects missing header', () => {
  const csv = validRow().join(',') + '\n'; // data line but no header
  assert.throws(() => parseMyerasCsv(csv), {code: 'unexpected_csv_header'});
});

test('rejects header only (no data)', () => {
  const csv = MYERAS_HEADER.join(',') + '\n';
  assert.throws(() => parseMyerasCsv(csv), {code: 'empty_csv_programs'});
});

// ── Column count validation ─────────────────────────────────────────────

test('rejects row with fewer columns', () => {
  const header = MYERAS_HEADER.join(',');
  const csv = header + '\nfoo,bar,baz\n';
  assert.throws(() => parseMyerasCsv(csv), {code: 'malformed_csv_columns'});
});

test('rejects row with too many columns', () => {
  const header = MYERAS_HEADER.join(',');
  const cells = [...validRow(), 'extra'];
  const csv = header + '\n' + cells.join(',');
  assert.throws(() => parseMyerasCsv(csv), {code: 'unexpected_csv_columns'});
});

// ── Cell content validation ─────────────────────────────────────────────

test('rejects cell starting with = (formula injection)', () => {
  const csv = buildCsv([validRow({program_name: '=SUM(A1:B1)'})]);
  assert.throws(() => parseMyerasCsv(csv), {code: 'unsafe_csv_cell'});
});

test('rejects cell starting with + (formula injection)', () => {
  const csv = buildCsv([validRow({program_name: '+cmd|whoami'})]);
  assert.throws(() => parseMyerasCsv(csv), {code: 'unsafe_csv_cell'});
});

test('rejects cell starting with @ (formula injection)', () => {
  const csv = buildCsv([validRow({program_name: '@SUM(A1)'})]);
  assert.throws(() => parseMyerasCsv(csv), {code: 'unsafe_csv_cell'});
});

test('rejects cell starting with - (formula injection)', () => {
  const csv = buildCsv([validRow({program_name: '-1+1|cmd'})]);
  assert.throws(() => parseMyerasCsv(csv), {code: 'unsafe_csv_cell'});
});

// ── Program name validation ─────────────────────────────────────────────

test('rejects empty program name', () => {
  const csv = buildCsv([validRow({program_name: ''})]);
  assert.throws(() => parseMyerasCsv(csv), {code: 'missing_csv_program_name'});
});

test('rejects whitespace-only program name', () => {
  const csv = buildCsv([validRow({program_name: '   '})]);
  assert.throws(() => parseMyerasCsv(csv), {code: 'missing_csv_program_name'});
});

test('rejects program name over 500 chars', () => {
  const csv = buildCsv([validRow({program_name: 'x'.repeat(501)})]);
  assert.throws(() => parseMyerasCsv(csv), {code: 'missing_csv_program_name'});
});

// ── Source validation ───────────────────────────────────────────────────

test('rejects non-MYERAS source', () => {
  const csv = buildCsv([validRow({source: 'OTHER'})]);
  assert.throws(() => parseMyerasCsv(csv), {code: 'invalid_csv_source'});
});

// ── Export time validation ──────────────────────────────────────────────

test('rejects invalid exported_at date', () => {
  const csv = buildCsv([validRow({exported_at: 'not-a-date'})]);
  assert.throws(() => parseMyerasCsv(csv), {code: 'invalid_csv_export_time'});
});

test('accepts empty exported_at', () => {
  const csv = buildCsv([validRow({exported_at: ''})]);
  const result = parseMyerasCsv(csv);
  assert.equal(result.programs[0].original.exported_at, '');
});

// ── Quote parsing edge cases ────────────────────────────────────────────

test('rejects quote in middle of unquoted cell', () => {
  const header = MYERAS_HEADER.join(',');
  const cells = validRow();
  cells[1] = 'Inter"nal'; // quote in middle of unquoted cell
  const csv = header + '\n' + cells.join(',');
  assert.throws(() => parseMyerasCsv(csv), {code: 'malformed_csv_quotes'});
});

test('rejects text after closing quote', () => {
  const header = MYERAS_HEADER.join(',');
  const cells = validRow();
  cells[0] = '"Mayo"Clinic'; // text after closing quote
  const csv = header + '\n' + cells.join(',');
  assert.throws(() => parseMyerasCsv(csv), {code: 'malformed_csv_quotes'});
});

test('rejects unclosed quote', () => {
  const header = MYERAS_HEADER.join(',');
  const cells = validRow();
  cells[0] = '"Mayo Clinic'; // unclosed quote
  const csv = header + '\n' + cells.join(',');
  assert.throws(() => parseMyerasCsv(csv), {code: 'malformed_csv_quotes'});
});

// ── Cell size limit ─────────────────────────────────────────────────────

test('rejects cell over 2000 chars', () => {
  const csv = buildCsv([validRow({program_name: 'x'.repeat(2001)})]);
  assert.throws(() => parseMyerasCsv(csv), {code: 'csv_cell_too_long'});
});

// ── Output shape ────────────────────────────────────────────────────────

test('output has correct schema', () => {
  const csv = buildCsv([validRow()]);
  const result = parseMyerasCsv(csv);
  assert.equal(result.schema, 'iiq-myeras-import-v1');
  assert.ok('rowCount' in result);
  assert.ok('uniqueCount' in result);
  assert.ok('duplicateCount' in result);
  assert.ok(Array.isArray(result.programs));
});

test('program has correct shape', () => {
  const csv = buildCsv([validRow()]);
  const p = parseMyerasCsv(csv).programs[0];
  assert.ok('rowNumber' in p);
  assert.ok('original' in p);
  assert.ok('exportedAt' in p);
  assert.ok('resolutionState' in p);
  assert.ok('choice' in p);
  assert.ok(Array.isArray(p.exportedAt));
  assert.equal(p.original.source, 'MYERAS');
});

test('original contains all header keys', () => {
  const csv = buildCsv([validRow()]);
  const original = parseMyerasCsv(csv).programs[0].original;
  for (const key of MYERAS_HEADER) {
    assert.ok(key in original, `Missing key: ${key}`);
  }
});
