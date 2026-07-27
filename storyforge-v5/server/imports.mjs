import { readSheet } from 'read-excel-file/node';
import { Readable } from 'node:stream';

const maxBytes = 5 * 1024 * 1024;
const maxRows = 5000;

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function tokens(value) {
  return new Set(normalize(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean));
}

function similarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function rowsFromPaste(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => ({ text: line, family: 'general' }));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(text || '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (quoted) {
    const error = new Error('CSV contains an unterminated quoted field.');
    error.code = 'malformed_csv';
    throw error;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function rowsFromGrid(data, format) {
  const header = (data[0] || []).map((cell) => normalize(cell).toLowerCase());
  const hasHeader = header.some((cell) => ['question', 'question text', 'text', 'family'].includes(cell));
  const questionIndex = Math.max(0, header.findIndex((cell) => ['question', 'question text', 'text'].includes(cell)));
  const familyIndex = header.findIndex((cell) => cell === 'family');
  const body = hasHeader ? data.slice(1) : data;
  return body.map((row) => ({
    text: row[questionIndex] ?? row[0] ?? '',
    family: familyIndex >= 0 ? row[familyIndex] : 'general',
    format,
  }));
}

async function rowsFromWorkbook(buffer) {
  const data = await readSheet(Readable.from(buffer));
  return rowsFromGrid(data, 'xlsx');
}

export async function previewImport({ format, text, dataBase64, existingQuestions = [] }) {
  if (!['paste', 'csv', 'xlsx'].includes(format)) {
    const error = new Error('Supported formats are paste, CSV, and XLSX.');
    error.code = 'unsupported_import_format';
    throw error;
  }

  let sourceRows;
  if (format === 'paste') {
    if (Buffer.byteLength(String(text || ''), 'utf8') > maxBytes) {
      const error = new Error('Paste exceeds the 5 MB import limit.');
      error.code = 'import_too_large';
      throw error;
    }
    sourceRows = rowsFromPaste(text);
  } else {
    const buffer = Buffer.from(String(dataBase64 || ''), 'base64');
    if (!buffer.length || buffer.length > maxBytes) {
      const error = new Error('Import file is empty or exceeds the 5 MB limit.');
      error.code = 'import_too_large';
      throw error;
    }
    sourceRows = format === 'csv'
      ? rowsFromGrid(parseCsv(buffer.toString('utf8')), 'csv')
      : await rowsFromWorkbook(buffer);
  }

  if (sourceRows.length > maxRows) {
    const error = new Error('Import exceeds the 5,000-row review limit.');
    error.code = 'too_many_import_rows';
    throw error;
  }

  const existing = existingQuestions.map((item) => ({
    id: item.id,
    text: normalize(item.text),
    normalized: normalize(item.text).toLowerCase(),
  }));

  return sourceRows.map((source, index) => {
    const question = normalize(source.text);
    const family = normalize(source.family) || 'general';
    const exact = existing.find((item) => item.normalized === question.toLowerCase());
    const near = exact
      ? null
      : existing
        .map((item) => ({ ...item, score: similarity(question, item.text) }))
        .filter((item) => item.score >= 0.62)
        .sort((a, b) => b.score - a.score)[0] || null;
    const formulaLike = /^[=+@]/.test(question);
    const error = question.length < 3
      ? 'Question text is too short'
      : formulaLike
        ? 'Formula-like cell prefix requires manual review'
        : null;
    return {
      rowNumber: index + 1,
      text: question,
      family,
      exactDuplicateId: exact?.id || null,
      nearDuplicateId: near?.id || null,
      similarity: near ? Number(near.score.toFixed(3)) : null,
      formulaLike,
      safeExportText: formulaLike ? `'${question}` : question,
      error,
      selected: !error && !exact && !near,
    };
  });
}
