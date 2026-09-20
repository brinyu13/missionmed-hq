// IVOC Application Intelligence — Interview Context Pack assembly.
// Authority: donor packet §4. Runs offline before `armed`; no I/O, no providers.
//
// assembleContextPack({ subject_id, projections, program_ref?, pool_snapshot_ref,
//                       practice_goal, now, revoked?, pack_id? })
//   → validated `ivoc.interview_context_pack.v1`
//
// Deterministic: equal inputs and equal `now` produce byte-identical packs.
// Budgets are enforced in this order: per-kind signal caps, total signal cap, fact
// cap, then the 32 KB canonical-JSON byte cap. Byte trimming drops unreferenced
// facts (oldest first), then the lowest-salience signals, one at a time, and every
// drop is recorded in `budgets_applied`.

import { intakeProjections, IntakeError } from '../normalize/intake.mjs';
import { deriveSignals, AIS_RULES_VERSION } from '../signals/rules.mjs';
import { buildTriggerIndex } from './trigger-index.mjs';
import { serializeForActor } from './serialize.mjs';
import { derivePackId, packVersion, invalidationReasons, canonicalJson } from '../provenance/receipts.mjs';
import {
  PACK_BUDGETS, assertInterviewContextPack, contextReceiptRef, ContextPackError,
} from '../contracts/context-pack.mjs';
import { PRACTICE_GOALS } from '../contracts/pressure-profile.mjs';

const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

function anchorDate(fact) {
  return fact.time_range?.end || fact.time_range?.start || (fact.attributes?.year ? String(fact.attributes.year) : '') || '';
}

function byFactId(a, b) { return a.fact_id < b.fact_id ? -1 : a.fact_id > b.fact_id ? 1 : 0; }

/** Oldest-first ordering among facts, stable on fact_id. */
function oldestFirst(a, b) {
  const da = anchorDate(a);
  const db = anchorDate(b);
  if (da !== db) return da < db ? -1 : 1;
  return byFactId(a, b);
}

/** Apply the per-kind and total signal caps; drop signals whose facts are gone. */
function capSignals(signals, factIds, dropped) {
  const counts = {};
  const survivors = [];
  for (const signal of signals) {
    if (!signal.fact_refs.every((id) => factIds.has(id))) { dropped.push({ signal_id: signal.signal_id, reason: 'fact_trimmed' }); continue; }
    counts[signal.kind] = (counts[signal.kind] || 0) + 1;
    if (counts[signal.kind] > PACK_BUDGETS.max_signals_by_kind[signal.kind]) { dropped.push({ signal_id: signal.signal_id, reason: 'kind_budget' }); continue; }
    survivors.push(signal);
  }
  for (const signal of survivors.slice(PACK_BUDGETS.max_signals)) dropped.push({ signal_id: signal.signal_id, reason: 'signal_budget' });
  return survivors.slice(0, PACK_BUDGETS.max_signals);
}

/** Apply the fact cap: keep referenced facts, then newest unreferenced facts. */
function capFacts(facts, signals, dropped) {
  if (facts.length <= PACK_BUDGETS.max_facts) return facts;
  const referenced = new Set(signals.flatMap((s) => s.fact_refs));
  const ranked = [...facts].sort((a, b) => {
    const ra = referenced.has(a.fact_id) ? 1 : 0;
    const rb = referenced.has(b.fact_id) ? 1 : 0;
    if (ra !== rb) return rb - ra;
    return -oldestFirst(a, b);
  });
  for (const fact of ranked.slice(PACK_BUDGETS.max_facts)) dropped.push({ fact_id: fact.fact_id, reason: 'fact_budget' });
  return ranked.slice(0, PACK_BUDGETS.max_facts).sort(byFactId);
}

function roleVisibility(signals) {
  const all = signals.map((s) => s.signal_id);
  return { student: signals.filter((s) => s.stance !== 'objective_concern').map((s) => s.signal_id), mentor: all, admin: all };
}

export function assembleContextPack({
  subject_id, projections, program_ref, pool_snapshot_ref, practice_goal, now, revoked = [], pack_id,
} = {}) {
  if (!NON_EMPTY(subject_id)) throw new ContextPackError('invalid_input', 'subject_id is required');
  if (!NON_EMPTY(pool_snapshot_ref)) throw new ContextPackError('invalid_input', 'pool_snapshot_ref is required');
  if (!PRACTICE_GOALS.includes(practice_goal)) throw new ContextPackError('invalid_input', 'practice_goal is invalid');
  if (!NON_EMPTY(now) || Number.isNaN(Date.parse(now))) throw new ContextPackError('invalid_input', 'now must be an ISO timestamp');

  const intake = intakeProjections(projections, { subject_id, now, revoked });
  if (NON_EMPTY(program_ref) && intake.program && intake.program.program_ref !== program_ref) {
    throw new ContextPackError('program_conflict', `program_ref ${program_ref} does not match the program projection ${intake.program.program_ref}`);
  }
  const program = intake.program ?? (NON_EMPTY(program_ref) ? { program_ref, name: null, specialty: null, projection_id: null, source_version: null } : null);

  const derived = deriveSignals(intake.facts, { subject_id, now, program, practice_goal });
  const dropped = { facts: [], signals: [] };
  let facts = capFacts(intake.facts, derived.signals, dropped.facts);
  let signals = capSignals(derived.signals, new Set(facts.map((f) => f.fact_id)), dropped.signals);

  const inputs = intake.receipts;
  const resolvedPackId = pack_id ?? derivePackId({ subject_id, inputs, rules_version: derived.rules_version, practice_goal, pool_snapshot_ref, program_ref: program?.program_ref ?? null });

  const build = () => {
    const redactions = { restricted: 0, guarded: 0, routine: 0, objective_concern: 0, mentor_only: 0 };
    for (const fact of facts) { redactions[fact.sensitivity] += 1; if (fact.student_visible === false) redactions.mentor_only += 1; }
    for (const signal of signals) if (signal.stance === 'objective_concern') redactions.objective_concern += 1;
    const pack = {
      schema_version: '1',
      pack_id: resolvedPackId,
      subject_id,
      rules_version: derived.rules_version,
      practice_goal,
      built_at: now,
      inputs,
      documents: intake.documents,
      dropped_inputs: intake.dropped,
      facts,
      signals,
      trigger_index: buildTriggerIndex(signals, { max: PACK_BUDGETS.max_trigger_entries }),
      program,
      pool_snapshot_ref,
      role_visibility: roleVisibility(signals),
      coverage_notes: derived.coverage_notes,
      budgets_applied: {
        facts_dropped: dropped.facts,
        signals_dropped: dropped.signals,
        items_dropped: intake.dropped_items,
        attributes_excluded: intake.excluded,
      },
      actor_block: '',
      redactions,
    };
    pack.actor_block = serializeForActor(pack, { practice_goal });
    pack.pack_version = packVersion(pack);
    return pack;
  };

  let pack = build();
  let guard = 0;
  while (canonicalJson(pack).length > PACK_BUDGETS.max_pack_bytes) {
    guard += 1;
    if (guard > 1000) throw new ContextPackError('budget', 'byte trimming did not converge');
    const referenced = new Set(signals.flatMap((s) => s.fact_refs));
    const unreferenced = facts.filter((f) => !referenced.has(f.fact_id)).sort(oldestFirst);
    if (unreferenced.length) {
      const victim = unreferenced[0];
      facts = facts.filter((f) => f.fact_id !== victim.fact_id);
      dropped.facts.push({ fact_id: victim.fact_id, reason: 'byte_budget' });
    } else if (signals.length) {
      // Strength signals go before probes, clarifications and consistency checks;
      // within a tier the lowest salience goes first.
      const tier = (s) => (s.kind === 'strength_interest_signal' ? 0 : 1);
      const victim = [...signals].sort((a, b) => tier(a) - tier(b) || a.salience - b.salience || (a.signal_id < b.signal_id ? -1 : 1))[0];
      signals = signals.filter((s) => s.signal_id !== victim.signal_id);
      dropped.signals.push({ signal_id: victim.signal_id, reason: 'byte_budget' });
    } else {
      throw new ContextPackError('budget', 'pack exceeds the byte budget with no facts or signals left to trim');
    }
    pack = build();
  }
  assertInterviewContextPack(pack);
  return pack;
}

/**
 * Decide whether `previousPack` may be reused for the given projections, or must be
 * rebuilt. Pure; performs intake to compute the current receipts.
 */
export function packReuseDecision(previousPack, { subject_id, projections, now, revoked = [], program_ref, pool_snapshot_ref } = {}) {
  const intake = intakeProjections(projections, { subject_id, now, revoked });
  const reasons = invalidationReasons(previousPack, intake.receipts, {
    rules_version: AIS_RULES_VERSION,
    program_ref: program_ref ?? intake.program?.program_ref ?? null,
    pool_snapshot_ref,
    revoked: new Set(revoked),
  });
  return { reuse: reasons.length === 0, reasons, receipt_ref: reasons.length === 0 ? contextReceiptRef(previousPack) : null };
}

export { IntakeError, contextReceiptRef };
