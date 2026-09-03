import { TextDecoder } from 'node:util';
import { PARSER_VERSION } from './constants.mjs';
import { sha256, stableHash } from './canonical.mjs';

const ARTIFACT_CLASSES = new Set(['transcript_json', 'nodes_json']);
const WRAPPER_KEYS = Object.freeze({
  transcript_json: Object.freeze(['segments', 'transcript', 'chunks', 'data']),
  nodes_json: Object.freeze(['drill_nodes', 'drillNodes', 'nodes', 'segments', 'data']),
});
const TEXT_KEYS = Object.freeze({
  transcript_json: Object.freeze([
    'text', 'transcript', 'content', 'utterance', 'caption', 'sentence', 'value', 'words',
  ]),
  nodes_json: Object.freeze([
    'text', 'title', 'label', 'summary', 'content', 'question', 'answer', 'description',
    'topic', 'node_text', 'nodeText', 'value', 'transcript',
  ]),
});
const START_KEYS = Object.freeze([
  'start', 'start_time', 'startTime', 'start_seconds', 'startSeconds', 'timestamp', 'time',
]);
const END_KEYS = Object.freeze([
  'end', 'end_time', 'endTime', 'end_seconds', 'endSeconds',
]);
const SPEAKER_KEYS = Object.freeze(['speaker', 'speaker_label', 'speakerLabel', 'role']);

export class ParserError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ParserError';
    this.code = code;
  }
}

function fail(code) {
  throw new ParserError(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function firstPresent(record, keys) {
  if (!isPlainObject(record)) return null;
  for (const key of keys) {
    if (record[key] !== null && record[key] !== undefined && String(record[key]).trim() !== '') {
      return { key, value: record[key] };
    }
  }
  return null;
}

export function normalizeTime(value, keyHint = '') {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    const milliseconds = /(?:^|_)(?:ms|msec|milliseconds?)(?:$|_)/iu.test(keyHint);
    return Number((milliseconds ? value / 1000 : value).toFixed(6));
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/u.test(raw)) return normalizeTime(Number(raw), keyHint);
  const match = raw.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/u);
  if (match) {
    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (minutes >= 60 || seconds >= 60) return null;
    return Number((hours * 3600 + minutes * 60 + seconds).toFixed(6));
  }
  const isoDuration = raw.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/iu);
  if (isoDuration) {
    const seconds = Number(isoDuration[1] ?? 0) * 3600
      + Number(isoDuration[2] ?? 0) * 60
      + Number(isoDuration[3] ?? 0);
    return Number(seconds.toFixed(6));
  }
  return null;
}

function collectText(value, artifactClass, depth = 0, seen = new Set()) {
  if (depth > 8 || value === null || value === undefined) return [];
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (typeof value === 'number' || typeof value === 'boolean') return [];
  if (typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.flatMap((child) => collectText(child, artifactClass, depth + 1, seen));
    }
    const output = [];
    for (const key of TEXT_KEYS[artifactClass]) {
      if (!(key in value)) continue;
      const child = value[key];
      if (typeof child === 'string' && child.trim()) output.push(child);
      else if (Array.isArray(child) || isPlainObject(child)) {
        output.push(...collectText(child, artifactClass, depth + 1, seen));
      }
    }
    return output;
  } finally {
    seen.delete(value);
  }
}

function normalizeTextParts(parts) {
  const unique = [];
  const seen = new Set();
  for (const part of parts) {
    const normalized = String(part).normalize('NFC').replace(/\s+/gu, ' ').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique.join(' ').trim();
}

export function parseArtifactBody(payload, artifactClass) {
  if (!ARTIFACT_CLASSES.has(artifactClass)) fail('artifact_class_rejected');
  let records = null;
  let schemaClass = null;
  if (Array.isArray(payload)) {
    records = payload;
    schemaClass = 'direct_array';
  } else if (isPlainObject(payload)) {
    for (const key of WRAPPER_KEYS[artifactClass]) {
      if (Array.isArray(payload[key])) {
        records = payload[key];
        schemaClass = `wrapper:${key}`;
        break;
      }
      if (isPlainObject(payload[key])) {
        for (const nested of WRAPPER_KEYS[artifactClass]) {
          if (Array.isArray(payload[key][nested])) {
            records = payload[key][nested];
            schemaClass = `nested_wrapper:${key}.${nested}`;
            break;
          }
        }
      }
      if (records) break;
    }
  }
  if (!records) fail('artifact_schema_rejected');

  const canonicalRecords = records.map((record, ordinal) => {
    const startEntry = firstPresent(record, START_KEYS);
    const endEntry = firstPresent(record, END_KEYS);
    const speakerEntry = firstPresent(record, SPEAKER_KEYS);
    const start = normalizeTime(startEntry?.value, startEntry?.key);
    const endCandidate = normalizeTime(endEntry?.value, endEntry?.key);
    const end = endCandidate !== null && start !== null && endCandidate < start ? null : endCandidate;
    const text = normalizeTextParts(collectText(record, artifactClass));
    const ordinalText = String(ordinal).padStart(8, '0');
    return {
      record_ordinal: ordinal,
      segment_locator: `record_index_${ordinalText}`,
      segment_start_time: start,
      segment_end_time: end,
      timestamp_status: start === null ? 'MISSING_OR_UNPARSEABLE' : (
        endCandidate !== null && end === null ? 'END_BEFORE_START' : 'PARSED'
      ),
      speaker_label: speakerEntry ? String(speakerEntry.value).normalize('NFC').trim() : null,
      text,
      text_status: text ? 'PRESENT' : 'EMPTY_OR_UNSUPPORTED',
      raw_record_hash: stableHash(record),
      text_hash: sha256(text),
    };
  });

  return {
    parser_version: PARSER_VERSION,
    artifact_class: artifactClass,
    schema_class: schemaClass,
    record_count: canonicalRecords.length,
    records_with_text_count: canonicalRecords.filter((record) => record.text).length,
    records_with_timestamp_count: canonicalRecords.filter(
      (record) => record.segment_start_time !== null,
    ).length,
    records: canonicalRecords,
  };
}

export function parseArtifactBuffer(buffer, artifactClass, expectedHash = null) {
  if (!Buffer.isBuffer(buffer)) fail('artifact_buffer_required');
  const artifactHash = sha256(buffer);
  if (expectedHash !== null && artifactHash !== expectedHash) fail('artifact_hash_mismatch');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail('artifact_utf8_rejected');
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    fail('artifact_json_rejected');
  }
  const parsed = parseArtifactBody(payload, artifactClass);
  return { ...parsed, artifact_hash: artifactHash, byte_count: buffer.length };
}
