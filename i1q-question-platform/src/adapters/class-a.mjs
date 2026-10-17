import {
  CLASS_A_CHANNELS,
  CLASS_A_FORBIDDEN_EXACT_KEYS,
  CLASS_A_FORBIDDEN_KEY_TOKENS,
} from '../contracts.mjs';

const CLASS_A_CHANNEL_SET = new Set(CLASS_A_CHANNELS);
const FORBIDDEN_EXACT = new Set(CLASS_A_FORBIDDEN_EXACT_KEYS);
const FORBIDDEN_TOKENS = new Set(CLASS_A_FORBIDDEN_KEY_TOKENS);

const SUSPICIOUS_VALUE_PATTERNS = Object.freeze([
  /(?:^|[\s,{["'])(?:answer(?:[\s_-]?(?:key|map))?|correct(?:[\s_-]?(?:answer|choice|option|key))|is[\s_-]?correct|solution|explanation|rationale)\s*(?::|=|=>)/iu,
  /\b(?:answer|correct\s+(?:answer|choice|option))\s+is\s+[A-D]\b/iu,
]);

function normalizeKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

function hasForbiddenKey(key) {
  const normalized = normalizeKey(key);
  if (FORBIDDEN_EXACT.has(normalized)) return true;
  return normalized.split('_').some((token) => FORBIDDEN_TOKENS.has(token));
}

function hasSuspiciousValue(value) {
  return typeof value === 'string'
    && SUSPICIOUS_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function pushUnexpectedKeys(findings, value, allowedKeys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    findings.push(`${path}:object_required`);
    return false;
  }
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) findings.push(`${path}.${key}:unknown_field`);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) findings.push(`${path}.${key}:required_field`);
  }
  return true;
}

function validateIdentity(value, path, findings, { includeOrdinal = false } = {}) {
  const keys = includeOrdinal
    ? ['dataset_version', 'question_id', 'ordinal']
    : ['dataset_version', 'question_id'];
  if (!pushUnexpectedKeys(findings, value, keys, path)) return;
  if (typeof value.dataset_version !== 'string' || !value.dataset_version) {
    findings.push(`${path}.dataset_version:string_required`);
  }
  if (typeof value.question_id !== 'string' || !value.question_id) {
    findings.push(`${path}.question_id:string_required`);
  }
  if (includeOrdinal && (!Number.isInteger(value.ordinal) || value.ordinal < 0)) {
    findings.push(`${path}.ordinal:nonnegative_integer_required`);
  }
}

function validatePreAnswer(payload, findings) {
  if (!Array.isArray(payload)) {
    findings.push('$:array_required');
    return;
  }
  payload.forEach((row, index) => {
    const path = `$[${index}]`;
    if (!pushUnexpectedKeys(findings, row, ['dataset_version', 'question_id', 'prompt', 'choices'], path)) return;
    if (typeof row.dataset_version !== 'string' || !row.dataset_version) findings.push(`${path}.dataset_version:string_required`);
    if (typeof row.question_id !== 'string' || !row.question_id) findings.push(`${path}.question_id:string_required`);
    if (typeof row.prompt !== 'string' || !row.prompt.trim()) findings.push(`${path}.prompt:string_required`);
    if (!Array.isArray(row.choices) || row.choices.length !== 4 || row.choices.some((choice) => typeof choice !== 'string' || !choice.trim())) {
      findings.push(`${path}.choices:exactly_four_strings_required`);
    }
  });
}

function validateIndexMap(value, path, findings) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    findings.push(`${path}:object_required`);
    return;
  }
  for (const [key, identities] of Object.entries(value)) {
    if (!Array.isArray(identities)) {
      findings.push(`${path}.${key}:array_required`);
      continue;
    }
    identities.forEach((identity, index) => validateIdentity(identity, `${path}.${key}[${index}]`, findings));
  }
}

function validateIndexes(payload, findings) {
  if (!pushUnexpectedKeys(findings, payload, ['by_topic', 'by_concept'], '$')) return;
  validateIndexMap(payload.by_topic, '$.by_topic', findings);
  validateIndexMap(payload.by_concept, '$.by_concept', findings);
}

function validateLookup(payload, findings) {
  if (!pushUnexpectedKeys(findings, payload, ['schema_version', 'entries'], '$')) return;
  if (payload.schema_version !== 'i1q.stat.lookup.v1') findings.push('$.schema_version:unsupported_version');
  if (!Array.isArray(payload.entries)) {
    findings.push('$.entries:array_required');
    return;
  }
  payload.entries.forEach((identity, index) => validateIdentity(identity, `$.entries[${index}]`, findings, { includeOrdinal: true }));
}

export function scanClassASecrets(value, path = '$') {
  const findings = [];
  const walk = (current, currentPath) => {
    if (Array.isArray(current)) {
      current.forEach((entry, index) => walk(entry, `${currentPath}[${index}]`));
      return;
    }
    if (current && typeof current === 'object') {
      for (const [key, entry] of Object.entries(current)) {
        const nextPath = `${currentPath}.${key}`;
        if (hasForbiddenKey(key)) findings.push(nextPath);
        walk(entry, nextPath);
      }
      return;
    }
    if (hasSuspiciousValue(current)) findings.push(`${currentPath}:suspicious_value`);
  };
  walk(value, path);
  return [...new Set(findings)];
}

export function validateClassAArtifact(channel, payload) {
  const findings = scanClassASecrets(payload);
  if (!CLASS_A_CHANNEL_SET.has(channel)) {
    findings.push(`$:unsupported_class_a_channel:${channel}`);
    return [...new Set(findings)];
  }
  if (channel === 'stat_pre_answer') validatePreAnswer(payload, findings);
  if (channel === 'stat_indexes') validateIndexes(payload, findings);
  if (channel === 'stat_lookup') validateLookup(payload, findings);
  return [...new Set(findings)];
}

export function assertClassAArtifact(channel, payload) {
  const findings = validateClassAArtifact(channel, payload);
  if (findings.length > 0) {
    const error = new Error('class_a_validation_failed');
    error.code = 'class_a_validation_failed';
    error.statusCode = 422;
    error.findings = findings;
    throw error;
  }
  return payload;
}
