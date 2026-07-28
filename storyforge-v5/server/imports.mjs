import { readSheet } from 'read-excel-file/node';
import { Readable } from 'node:stream';

const maxBytes = 5 * 1024 * 1024;
const maxRows = 5000;
const maxWorkbookExpandedBytes = 50 * 1024 * 1024;
const maxWorkbookEntries = 2000;
const maxWorkbookCompressionRatio = 200;

function importTooLarge(message) {
  const error = new Error(message);
  error.code = 'import_too_large';
  return error;
}

function validateWorkbookEnvelope(buffer) {
  // XLSX is a ZIP container. Inspect the central directory before any XML is
  // inflated so a tiny compressed upload cannot expand without a hard bound.
  if (buffer.length < 22) {
    const error = new Error('XLSX container is malformed.');
    error.code = 'malformed_xlsx';
    throw error;
  }
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const searchStart = Math.max(0, buffer.length - 65_557);
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) {
    const error = new Error('XLSX container is malformed.');
    error.code = 'malformed_xlsx';
    throw error;
  }

  const entries = buffer.readUInt16LE(eocdOffset + 10);
  const centralBytes = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (
    entries === 0xffff
    || centralBytes === 0xffffffff
    || centralOffset === 0xffffffff
    || entries > maxWorkbookEntries
    || centralOffset + centralBytes > eocdOffset
  ) {
    throw importTooLarge('XLSX container exceeds the safe expansion limits.');
  }

  let offset = centralOffset;
  let expandedBytes = 0;
  let compressedBytes = 0;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== centralSignature) {
      const error = new Error('XLSX central directory is malformed.');
      error.code = 'malformed_xlsx';
      throw error;
    }
    const compressed = buffer.readUInt32LE(offset + 20);
    const expanded = buffer.readUInt32LE(offset + 24);
    const nameBytes = buffer.readUInt16LE(offset + 28);
    const extraBytes = buffer.readUInt16LE(offset + 30);
    const commentBytes = buffer.readUInt16LE(offset + 32);
    if (compressed === 0xffffffff || expanded === 0xffffffff) {
      throw importTooLarge('ZIP64 XLSX containers are not accepted.');
    }
    expandedBytes += expanded;
    compressedBytes += compressed;
    if (
      expandedBytes > maxWorkbookExpandedBytes
      || expanded > maxWorkbookExpandedBytes
      || expandedBytes / Math.max(1, compressedBytes) > maxWorkbookCompressionRatio
    ) {
      throw importTooLarge('XLSX container exceeds the safe expansion limits.');
    }
    offset += 46 + nameBytes + extraBytes + commentBytes;
  }
  if (offset > centralOffset + centralBytes) {
    const error = new Error('XLSX central directory is malformed.');
    error.code = 'malformed_xlsx';
    throw error;
  }
}

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
    .map((line) => {
      const separator = line.lastIndexOf('|');
      return separator >= 0
        ? { text: line.slice(0, separator), family: line.slice(separator + 1) }
        : { text: line, family: '' };
    });
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

function canonicalFamily(value, question) {
  const normalized = normalize(value)
    .toLowerCase()
    .replaceAll('&', 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const aliases = new Map([
    ['core', 'core'],
    ['common', 'core'],
    ['core and common', 'core'],
    ['behavioral', 'behavioral'],
    ['behavioural', 'behavioral'],
    ['clinical', 'clinical'],
    ['cv', 'cv'],
    ['application', 'cv'],
    ['cv and application', 'cv'],
    ['red flag', 'redflag'],
    ['redflag', 'redflag'],
    ['personal', 'personal'],
    ['custom', 'custom'],
  ]);
  if (aliases.has(normalized)) return aliases.get(normalized);
  if (/patient|clinical|care|diagnos/i.test(question)) return 'clinical';
  if (/tell me about a time|conflict|team|leader|mistake|feedback/i.test(question)) {
    return 'behavioral';
  }
  return 'core';
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
      throw importTooLarge('Import file is empty or exceeds the 5 MB limit.');
    }
    if (format === 'xlsx') validateWorkbookEnvelope(buffer);
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
    const family = canonicalFamily(source.family, question);
    const exact = existing.find((item) => item.normalized === question.toLowerCase());
    const near = exact
      ? null
      : existing
        .map((item) => ({ ...item, score: similarity(question, item.text) }))
        .filter((item) => item.score >= 0.75)
        .sort((a, b) => b.score - a.score)[0] || null;
    const formulaLike = /^[=+\-@]/.test(question);
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
