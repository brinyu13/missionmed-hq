// IVOC Application Intelligence — provenance, hashing and invalidation.
// This is the ONLY module in the lane that imports from Node (`node:crypto`).
// Everything hashed here is canonical JSON so equal content yields equal digests.

import { createHash } from 'node:crypto';
import { assertSourceReceipt } from '../contracts/context-pack.mjs';

const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

/** Stable JSON: object keys sorted recursively, arrays kept in order, no whitespace. */
export function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

export function sha256Hex(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function hashValue(value) {
  return sha256Hex(canonicalJson(value));
}

/** Deterministic fact identity: sha256 of `fact_type|owner_app|source_version|normalized_key`. */
export function factId({ fact_type, owner_app, source_version, normalized_key }) {
  for (const [key, value] of Object.entries({ fact_type, owner_app, source_version, normalized_key })) {
    if (!NON_EMPTY(value)) throw new TypeError(`factId requires ${key}`);
  }
  return `fact:${sha256Hex(`${fact_type}|${owner_app}|${source_version}|${normalized_key}`).slice(0, 32)}`;
}

/** Deterministic signal identity from rule id and the sorted fact refs it rests on. */
export function signalId(rule_id, fact_refs) {
  if (!NON_EMPTY(rule_id) || !Array.isArray(fact_refs) || fact_refs.length === 0) throw new TypeError('signalId requires rule_id and fact_refs');
  return `sig:${rule_id}:${sha256Hex([...fact_refs].sort().join('|')).slice(0, 16)}`;
}

/** Deterministic, UUID-shaped pack id derived from subject, inputs and rules version. */
export function derivePackId({ subject_id, inputs, rules_version, practice_goal, pool_snapshot_ref, program_ref }) {
  const digest = sha256Hex(canonicalJson({
    subject_id,
    rules_version,
    practice_goal,
    pool_snapshot_ref,
    program_ref: program_ref ?? null,
    inputs: (inputs || []).map((r) => `${r.owner_app}|${r.projection_type}|${r.projection_id}|${r.source_version}|${r.source_receipt_hash}`).sort(),
  }));
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

/** Build a SourceReceipt from a validated `matrix.projection.v1` envelope. */
export function sourceReceiptFromProjection(projection, { now } = {}) {
  const stale = NON_EMPTY(projection.fresh_until) && NON_EMPTY(now) && projection.fresh_until < now;
  const degraded = projection.degraded
    ? { state: projection.degraded.state, reason: projection.degraded.reason }
    : (stale ? { state: 'stale', reason: `fresh_until ${projection.fresh_until} passed` } : null);
  return assertSourceReceipt(Object.freeze({
    owner_app: projection.owner_app,
    projection_type: projection.projection_type,
    projection_id: projection.projection_id,
    source_version: projection.source_version,
    source_receipt_hash: projection.source_receipt.hash,
    fresh_until: projection.fresh_until ?? null,
    degraded,
    authorization_basis: projection.authorization.basis,
    consent_ref: projection.authorization.consent_ref ?? null,
  }));
}

/**
 * Pack version: sha256 over the canonical pack minus `built_at` and minus the
 * version field itself (donor packet §4.1).
 */
export function packVersion(pack) {
  const { built_at, pack_version, ...rest } = pack;
  return hashValue(rest);
}

/**
 * Why a previously built pack is no longer valid for the given current inputs.
 * Returns an empty array when the previous pack may be reused.
 */
export function invalidationReasons(previousPack, currentInputs, { rules_version, program_ref, pool_snapshot_ref, revoked = new Set() } = {}) {
  const reasons = [];
  if (!previousPack) return [{ reason: 'no_previous_pack' }];
  if (rules_version !== undefined && previousPack.rules_version !== rules_version) {
    reasons.push({ reason: 'rules_version_changed', detail: `${previousPack.rules_version} -> ${rules_version}` });
  }
  const previousProgram = previousPack.program?.program_ref ?? null;
  if (program_ref !== undefined && (program_ref ?? null) !== previousProgram) {
    reasons.push({ reason: 'program_ref_changed', detail: `${previousProgram} -> ${program_ref ?? null}` });
  }
  if (pool_snapshot_ref !== undefined && previousPack.pool_snapshot_ref !== pool_snapshot_ref) {
    reasons.push({ reason: 'pool_snapshot_changed', detail: `${previousPack.pool_snapshot_ref} -> ${pool_snapshot_ref}` });
  }
  const previous = new Map(previousPack.inputs.map((r) => [r.projection_id, r]));
  const current = new Map((currentInputs || []).map((r) => [r.projection_id, r]));
  for (const [id, receipt] of current) {
    const before = previous.get(id);
    if (!before) { reasons.push({ reason: 'input_added', detail: id }); continue; }
    if (before.source_version !== receipt.source_version || before.source_receipt_hash !== receipt.source_receipt_hash) {
      reasons.push({ reason: 'input_version_changed', detail: `${id}: ${before.source_version} -> ${receipt.source_version}` });
    }
    if (receipt.degraded?.state === 'unavailable' && before.degraded?.state !== 'unavailable') {
      reasons.push({ reason: 'input_unavailable', detail: id });
    }
  }
  for (const id of previous.keys()) {
    if (!current.has(id)) reasons.push({ reason: 'input_removed', detail: id });
    if (revoked.has(id)) reasons.push({ reason: 'input_revoked', detail: id });
  }
  return reasons;
}
