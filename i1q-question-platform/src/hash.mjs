import { createHash } from 'node:crypto';

function normalizeValue(value) {
  if (typeof value === 'string') {
    return value.normalize('NFC');
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (value && typeof value === 'object') {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key.normalize('NFC')] = normalizeValue(value[key]);
    }
    return normalized;
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(normalizeValue(value));
}

export function sha256(value) {
  const bytes = typeof value === 'string' ? value.normalize('NFC') : canonicalJson(value);
  return createHash('sha256').update(bytes, 'utf8').digest('hex');
}

export function deterministicId(prefix, value) {
  return `${prefix}_${sha256(value).slice(0, 20)}`;
}

export function hashChain(previousHash, payload) {
  return sha256({ previous_hash: previousHash || null, payload });
}

export function statPackHash({ datasetVersion, questionIds, choicesOrder }) {
  const preimage = [
    `dataset_version=${datasetVersion}`,
    `question_ids=${questionIds.join(',')}`,
    `choices_order=${choicesOrder.map((row) => row.join(',')).join(';')}`,
  ].join('|');
  return sha256(preimage);
}
