import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleContextPack, packReuseDecision } from './assemble.mjs';
import { assertInterviewContextPack, PACK_BUDGETS, contextReceiptRef, parseContextReceiptRef } from '../contracts/context-pack.mjs';
import { canonicalJson, invalidationReasons } from '../provenance/receipts.mjs';
import { redactForRole } from './serialize.mjs';
import { scenario, buildPack, bumpVersion, fixture } from '../test-helpers.mjs';

test('pack validates, stays within every budget, and is byte-identical across runs', async () => {
  const s = await scenario('cross-source');
  const a = buildPack(s);
  const b = buildPack(s);
  assertInterviewContextPack(a);
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(a.pack_version, b.pack_version);
  assert.ok(canonicalJson(a).length <= PACK_BUDGETS.max_pack_bytes);
  assert.ok(a.facts.length <= PACK_BUDGETS.max_facts);
  assert.ok(a.signals.length <= PACK_BUDGETS.max_signals);
  assert.ok(new TextEncoder().encode(a.actor_block).length <= PACK_BUDGETS.max_actor_block_bytes);
  assert.equal(a.subject_id, s.scen.subject_id);
  assert.equal(a.program.program_ref, 'prog-cedar-valley-im');
  assert.equal(a.documents.length, 3);
  assert.deepEqual(parseContextReceiptRef(contextReceiptRef(a)), { pack_id: a.pack_id, pack_version: a.pack_version });
});

test('pack version changes when any input version changes and stays identical otherwise', async () => {
  const s = await scenario('reactive');
  const base = buildPack(s);
  const same = buildPack({ ...s, projections: structuredClone(s.projections) });
  assert.equal(same.pack_version, base.pack_version);
  const cvIndex = s.projections.findIndex((p) => p.payload?.kind === 'cv');
  const bumped = s.projections.map((p, i) => (i === cvIndex ? bumpVersion(p, 'cv-v4') : p));
  const changed = buildPack({ ...s, projections: bumped });
  assert.notEqual(changed.pack_version, base.pack_version);
  assert.notEqual(changed.pack_id, base.pack_id);
  const decision = packReuseDecision(base, { subject_id: s.scen.subject_id, projections: bumped, now: s.scen.now, pool_snapshot_ref: s.pool.snapshot_id });
  assert.equal(decision.reuse, false);
  assert.ok(decision.reasons.some((r) => r.reason === 'input_version_changed' && r.detail.includes('cv-v3 -> cv-v4')));
  const reuse = packReuseDecision(base, { subject_id: s.scen.subject_id, projections: s.projections, now: s.scen.now, pool_snapshot_ref: s.pool.snapshot_id });
  assert.equal(reuse.reuse, true);
  assert.equal(reuse.receipt_ref, contextReceiptRef(base));
  assert.ok(invalidationReasons(base, base.inputs, { rules_version: 'other' }).some((r) => r.reason === 'rules_version_changed'));
  assert.ok(invalidationReasons(base, base.inputs, { pool_snapshot_ref: 'different' }).some((r) => r.reason === 'pool_snapshot_changed'));
});

test('a revoked input never appears in facts, receipts, or the actor block', async () => {
  const s = await scenario('reactive');
  const cv = s.projections.find((p) => p.payload?.kind === 'cv');
  const pack = buildPack(s, { revoked: [cv.projection_id] });
  assert.ok(pack.facts.every((f) => f.provenance.projection_id !== cv.projection_id));
  assert.ok(pack.inputs.every((r) => r.projection_id !== cv.projection_id));
  assert.deepEqual(pack.dropped_inputs, [{ projection_id: cv.projection_id, reason: 'revoked' }]);
  assert.ok(!pack.actor_block.includes('Variant interpretation'));
  const decision = packReuseDecision(buildPack(s), { subject_id: s.scen.subject_id, projections: s.projections, now: s.scen.now, revoked: [cv.projection_id], pool_snapshot_ref: s.pool.snapshot_id });
  assert.ok(decision.reasons.some((r) => r.reason === 'input_revoked'));
});

test('restricted facts and objective_concern signals never reach the Actor; role views are bounded', async () => {
  const s = await scenario('reactive');
  const cv = s.projections.find((p) => p.payload?.kind === 'cv');
  const ps = structuredClone(s.projections.find((p) => p.payload?.kind === 'ps'));
  ps.payload.claims.push({ claim_id: 'c9', text: 'I have three first-author publications.', asserts: { count_of: 'publication', count: 3 } });
  const mcc = await fixture('projections.mcc-priorities.v1.json');
  const pack = buildPack({ ...s, projections: [cv, ps, mcc] });
  assert.ok(pack.facts.some((f) => f.sensitivity === 'restricted'), 'fixture keeps a restricted exam fact');
  assert.ok(!pack.actor_block.includes('Step 2 CK'));
  assert.ok(!/fact:[0-9a-f]{32}|sig:AIS/u.test(pack.actor_block), 'ids are never read to the Actor');
  const objective = pack.signals.find((s2) => s2.stance === 'objective_concern');
  assert.ok(objective);
  assert.ok(!pack.actor_block.includes(objective.possible_probes[0]));
  assert.ok(!pack.role_visibility.student.includes(objective.signal_id));
  assert.ok(pack.role_visibility.mentor.includes(objective.signal_id));
  const student = redactForRole(pack, 'student');
  assert.ok(student.facts.every((f) => f.student_visible !== false));
  assert.ok(!student.signals.some((s2) => s2.stance === 'objective_concern'));
  assert.deepEqual(student.coverage_notes, []);
  const admin = redactForRole(pack, 'admin');
  assert.ok(admin.facts.some((f) => f.student_visible === false));
  assert.ok(admin.signals.some((s2) => s2.stance === 'objective_concern'));
  assert.equal(pack.redactions.objective_concern, 1);
  assert.ok(pack.redactions.mentor_only >= 1);
});

test('fails closed on missing subject, wrong program_ref, malformed projections, or subject mixing', async () => {
  const s = await scenario('reactive');
  assert.throws(() => buildPack(s, { subject_id: '' }), /subject_id/u);
  assert.throws(() => buildPack(s, { program_ref: 'prog-someone-else' }), /program_conflict|does not match/u);
  assert.throws(() => buildPack(s, { practice_goal: 'freestyle' }), /practice_goal/u);
  const other = await fixture('projections.other-subject.v1.json');
  assert.throws(() => buildPack({ ...s, projections: [...s.projections, other] }), (e) => e.code === 'subject_mismatch');
  assert.throws(() => buildPack({ ...s, projections: [{ nonsense: true }] }), (e) => e.code === 'malformed_projection');
  const empty = assembleContextPack({ subject_id: s.scen.subject_id, projections: [], pool_snapshot_ref: 'p', practice_goal: 'full_simulation', now: s.scen.now });
  assert.equal(empty.facts.length, 0);
  assert.equal(empty.signals.length, 0);
  assert.match(empty.actor_block, /APPLICANT FACTS:\n- none provided/u);
});

test('byte budget trimming is deterministic and recorded', async () => {
  const s = await scenario('cross-source');
  const pack = buildPack(s);
  const dropped = pack.budgets_applied.signals_dropped.filter((d) => d.reason === 'byte_budget');
  if (dropped.length) {
    assert.ok(dropped.every((d) => !pack.signals.some((sig) => sig.signal_id === d.signal_id)));
    const kept = pack.signals.filter((sig) => sig.kind !== 'strength_interest_signal');
    assert.ok(kept.length > 0, 'probes and clarifications survive before strengths are exhausted');
  }
  assert.ok(pack.budgets_applied.attributes_excluded.some((x) => Object.values(x.excluded).includes('prohibited_attribute')));
});
