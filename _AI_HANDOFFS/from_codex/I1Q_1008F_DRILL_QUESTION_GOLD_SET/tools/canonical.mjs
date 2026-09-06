// Adapted from I1Q-1008E/tools/canonical.mjs. The 1008F contract adds
// fail-closed NFC/-0 handling and order-preserving roots.
import { createHash } from 'node:crypto';

const PREFIX = /^[a-z][a-z0-9_]{1,31}$/u;
const HASH = /^[a-f0-9]{64}$/u;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function plain(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalize(value, seen) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value !== value.normalize('NFC')) throw new TypeError('canonical_non_nfc_string');
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical_non_finite_number');
    if (Object.is(value, -0)) throw new TypeError('canonical_negative_zero');
    if (!Number.isSafeInteger(value)) throw new TypeError('canonical_non_integer_number');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('canonical_unsupported_value');
  if (seen.has(value)) throw new TypeError('canonical_cycle');
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((child) => canonicalize(child, seen));
    if (!plain(value)) throw new TypeError('canonical_unsupported_value');
    const result = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      if (key !== key.normalize('NFC')) throw new TypeError('canonical_non_nfc_string');
      if (value[key] === undefined) throw new TypeError('canonical_undefined_value');
      result[key] = canonicalize(value[key], seen);
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

export function deterministicId(prefix, ...anchors) {
  if (!PREFIX.test(prefix)) throw new TypeError('deterministic_id_prefix_invalid');
  return `${prefix}_sha256_${sha256(`${prefix}\0${stableStringify(anchors)}`)}`;
}

export function sortedUnique(values) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
    throw new TypeError('set_array_invalid');
  }
  return [...new Set(values)].sort();
}

export function orderedRoot(values, domain = 'missionmed.i1q.1008f.ordered.v1') {
  if (!Array.isArray(values)) throw new TypeError('ordered_root_array_required');
  return stableHash({ domain, values });
}

export function contentAddressedEnvelope(payload, hashField = 'content_hash') {
  if (!plain(payload)) throw new TypeError('content_envelope_invalid');
  const without = { ...payload };
  delete without[hashField];
  return { ...without, [hashField]: stableHash(without) };
}

export function verifyContentAddressedEnvelope(value, hashField = 'content_hash') {
  if (!plain(value) || !HASH.test(value[hashField] ?? '')) return false;
  const without = { ...value };
  const claimed = without[hashField];
  delete without[hashField];
  try {
    return stableHash(without) === claimed;
  } catch {
    return false;
  }
}

export function canonicalFileBytes(value) {
  return Buffer.from(`${stableStringify(value)}\n`, 'utf8');
}
