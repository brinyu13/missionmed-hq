// IVOC Application Intelligence — InterviewContextPack contract.
// Pure module. Authority: donor packet §4.

import { assertApplicationFact } from './application-fact.mjs';
import { assertAttentionSignal, SIGNAL_KINDS } from './attention-signal.mjs';
import { PRACTICE_GOALS } from './pressure-profile.mjs';

export const CONTEXT_PACK_SCHEMA = 'ivoc.interview_context_pack.v1';

export const PACK_BUDGETS = Object.freeze({
  max_pack_bytes: 32 * 1024,
  max_facts: 120,
  max_signals: 24,
  max_signals_by_kind: Object.freeze({
    probe_candidate: 10,
    clarification_candidate: 6,
    strength_interest_signal: 6,
    consistency_check: 4,
  }),
  max_fact_line_words: 30,
  max_probe_words: 25,
  max_actor_block_bytes: 6 * 1024,
  max_trigger_entries: 200,
});

export const VIEW_ROLES = Object.freeze(['student', 'mentor', 'admin']);
export const RECEIPT_PREFIX = 'ctxpack:';

const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export class ContextPackError extends TypeError {
  constructor(code, message) {
    super(message || code);
    this.name = 'ContextPackError';
    this.code = code;
  }
}

export function assertSourceReceipt(receipt, label = 'receipt') {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new ContextPackError('invalid_receipt', `${label} must be an object`);
  for (const key of ['owner_app', 'projection_type', 'projection_id', 'source_version', 'source_receipt_hash', 'authorization_basis']) {
    if (!NON_EMPTY(receipt[key])) throw new ContextPackError('invalid_receipt', `${label}.${key} is required`);
  }
  if (receipt.fresh_until !== undefined && receipt.fresh_until !== null && !NON_EMPTY(receipt.fresh_until)) {
    throw new ContextPackError('invalid_receipt', `${label}.fresh_until must be a string`);
  }
  if (receipt.degraded !== undefined && receipt.degraded !== null) {
    if (!['stale', 'partial', 'unavailable'].includes(receipt.degraded.state) || !NON_EMPTY(receipt.degraded.reason)) {
      throw new ContextPackError('invalid_receipt', `${label}.degraded is invalid`);
    }
  }
  if (receipt.consent_ref !== undefined && receipt.consent_ref !== null && !NON_EMPTY(receipt.consent_ref)) {
    throw new ContextPackError('invalid_receipt', `${label}.consent_ref must be a string`);
  }
  return receipt;
}

export function contextReceiptRef(pack) {
  if (!pack || !NON_EMPTY(pack.pack_id) || !NON_EMPTY(pack.pack_version)) {
    throw new ContextPackError('invalid_pack', 'pack_id and pack_version are required for a receipt ref');
  }
  return `${RECEIPT_PREFIX}${pack.pack_id}@${pack.pack_version}`;
}

export function parseContextReceiptRef(ref) {
  if (!NON_EMPTY(ref) || !ref.startsWith(RECEIPT_PREFIX)) return null;
  const body = ref.slice(RECEIPT_PREFIX.length);
  const at = body.lastIndexOf('@');
  if (at <= 0 || at === body.length - 1) return null;
  return { pack_id: body.slice(0, at), pack_version: body.slice(at + 1) };
}

export function assertInterviewContextPack(pack, { skipItems = false } = {}) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) throw new ContextPackError('invalid_pack', 'pack must be an object');
  if (pack.schema_version !== '1') throw new ContextPackError('invalid_pack', 'pack.schema_version must be 1');
  for (const key of ['pack_id', 'subject_id', 'pack_version', 'rules_version', 'built_at', 'pool_snapshot_ref']) {
    if (!NON_EMPTY(pack[key])) throw new ContextPackError('invalid_pack', `pack.${key} is required`);
  }
  if (!/^[0-9a-f]{64}$/u.test(pack.pack_version)) throw new ContextPackError('invalid_pack', 'pack.pack_version must be a sha256 hex digest');
  if (!PRACTICE_GOALS.includes(pack.practice_goal)) throw new ContextPackError('invalid_pack', 'pack.practice_goal is invalid');
  if (!Array.isArray(pack.inputs)) throw new ContextPackError('invalid_pack', 'pack.inputs must be an array');
  pack.inputs.forEach((receipt, index) => assertSourceReceipt(receipt, `pack.inputs[${index}]`));
  if (!Array.isArray(pack.facts) || pack.facts.length > PACK_BUDGETS.max_facts) throw new ContextPackError('budget', 'pack.facts exceeds budget or is not an array');
  if (!Array.isArray(pack.signals) || pack.signals.length > PACK_BUDGETS.max_signals) throw new ContextPackError('budget', 'pack.signals exceeds budget or is not an array');
  const subjects = new Set([pack.subject_id]);
  if (!skipItems) {
    for (const fact of pack.facts) { assertApplicationFact(fact); subjects.add(fact.subject_id); }
    const byKind = Object.fromEntries(SIGNAL_KINDS.map((kind) => [kind, 0]));
    for (const signal of pack.signals) {
      assertAttentionSignal(signal);
      subjects.add(signal.subject_id);
      byKind[signal.kind] += 1;
    }
    for (const [kind, count] of Object.entries(byKind)) {
      if (count > PACK_BUDGETS.max_signals_by_kind[kind]) throw new ContextPackError('budget', `pack.signals holds too many ${kind}`);
    }
  }
  if (subjects.size !== 1) throw new ContextPackError('subject_mixing', 'a pack may hold exactly one subject');
  if (!pack.trigger_index || typeof pack.trigger_index !== 'object' || Array.isArray(pack.trigger_index)) {
    throw new ContextPackError('invalid_pack', 'pack.trigger_index must be an object');
  }
  if (Object.keys(pack.trigger_index).length > PACK_BUDGETS.max_trigger_entries) throw new ContextPackError('budget', 'pack.trigger_index exceeds budget');
  if (pack.program !== null && (typeof pack.program !== 'object' || !NON_EMPTY(pack.program.program_ref))) {
    throw new ContextPackError('invalid_pack', 'pack.program must be null or carry a program_ref');
  }
  if (!pack.role_visibility || typeof pack.role_visibility !== 'object') throw new ContextPackError('invalid_pack', 'pack.role_visibility is required');
  for (const role of VIEW_ROLES) {
    if (!Array.isArray(pack.role_visibility[role])) throw new ContextPackError('invalid_pack', `pack.role_visibility.${role} must be an array`);
  }
  if (!pack.budgets_applied || typeof pack.budgets_applied !== 'object') throw new ContextPackError('invalid_pack', 'pack.budgets_applied is required');
  if (typeof pack.actor_block !== 'string') throw new ContextPackError('invalid_pack', 'pack.actor_block must be a string');
  if (byteLength(pack.actor_block) > PACK_BUDGETS.max_actor_block_bytes) throw new ContextPackError('budget', 'pack.actor_block exceeds 6 KB');
  if (!pack.redactions || typeof pack.redactions !== 'object') throw new ContextPackError('invalid_pack', 'pack.redactions is required');
  return pack;
}

/** UTF-8 byte length without Node's Buffer (browser-safe). */
export function byteLength(text) {
  return new TextEncoder().encode(String(text)).length;
}
