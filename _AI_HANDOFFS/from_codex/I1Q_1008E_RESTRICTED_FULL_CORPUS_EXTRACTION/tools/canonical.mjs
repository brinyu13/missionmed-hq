import { createHash } from 'node:crypto';

const IDENTIFIER_PREFIX = /^[a-z][a-z0-9_]{1,31}$/u;

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value, seen) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical_non_finite_number');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'bigint') return { $bigint: value.toString(10) };
  if (typeof value !== 'object') throw new TypeError('canonical_unsupported_value');
  if (seen.has(value)) throw new TypeError('canonical_cycle');
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen));
    if (!isPlainObject(value)) throw new TypeError('canonical_non_plain_object');
    const result = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      if (child === undefined) throw new TypeError('canonical_undefined_value');
      result[key] = canonicalize(child, seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function stableStringify(value) {
  return JSON.stringify(canonicalize(value, new Set()));
}

export function stableHash(value) {
  return sha256(stableStringify(value));
}

export function deterministicId(prefix, ...anchorParts) {
  if (!IDENTIFIER_PREFIX.test(prefix)) throw new TypeError('deterministic_id_prefix_invalid');
  const anchor = stableStringify(anchorParts);
  return `${prefix}_sha256_${sha256(`${prefix}\0${anchor}`)}`;
}

export function normalizeForSignature(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function tokenSignature(value) {
  const tokens = normalizeForSignature(value)
    .split(' ')
    .filter((token) => token.length > 1);
  return sha256([...new Set(tokens)].sort().join('\n'));
}

export function merkleRoot(values, domain = 'missionmed.i1q.1008e.merkle.v1') {
  const leaves = [...values].map((value) => sha256(`${domain}:leaf\0${value}`)).sort();
  if (leaves.length === 0) return sha256(`${domain}:empty`);
  let level = leaves;
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(sha256(`${domain}:node\0${left}\0${right}`));
    }
    level = next;
  }
  return level[0];
}

export function contentAddressedEnvelope(payload, hashField = 'content_hash') {
  if (!isPlainObject(payload)) {
    throw new TypeError('content_envelope_invalid');
  }
  const withoutHash = { ...payload };
  delete withoutHash[hashField];
  return { ...withoutHash, [hashField]: stableHash(withoutHash) };
}

export function verifyContentAddressedEnvelope(value, hashField = 'content_hash') {
  if (!isPlainObject(value)) return false;
  const claimed = value[hashField];
  if (typeof claimed !== 'string' || !/^[a-f0-9]{64}$/u.test(claimed)) return false;
  const payload = { ...value };
  delete payload[hashField];
  return stableHash(payload) === claimed;
}
