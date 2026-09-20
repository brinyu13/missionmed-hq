// End-to-end acceptance for IVOC-APPINTEL-8002 (donor packet §12 acceptance list;
// implementation prompt behaviours 1–9). Synthetic fixtures only.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as AI from './index.mjs';
import { scenario, buildPack, profileFor, bumpVersion, fixture, ACCUSATION } from './test-helpers.mjs';

const WRONGDOING = /\b(lie|lied|lying|dishonest\w*|fraud\w*|fabricat\w*|misrepresent\w*|red[\s_-]?flags?)\b/iu;

function nextMove(pack, s, profile, memory, answer, extra = {}) {
  return AI.arbitrate({
    pack, pool_snapshot: s.pool, memory, pressure_profile: profile, practice_goal: profile.practice_goal,
    target_asked_count: s.scen.target_asked_count,
    reactive_matches: answer ? AI.evaluateReactiveTriggers(pack, answer) : [],
    live_consistency: answer ? AI.evaluateLiveConsistency(pack, answer) : [],
    ...extra,
  });
}

test('1. Reactive: the CV-backed genetics probe surfaces with provenance when the student mentions research', async () => {
  const s = await scenario('reactive');
  const pack = buildPack(s);
  const profile = profileFor(s.scen);
  const opening = nextMove(pack, s, profile, AI.createMemory(), '');
  assert.equal(opening.kind, 'ask');
  const memory = AI.applyMemoryDelta(AI.createMemory(), opening);
  const probe = nextMove(pack, s, profile, { ...memory, current_answer_coverage: 1 }, s.scen.answer_text);
  assert.equal(probe.kind, 'probe');
  assert.equal(probe.lane, 'application');
  assert.match(probe.question_ref.text, /genetics/u);
  const signal = pack.signals.find((sig) => sig.signal_id === probe.signal_refs[0]);
  assert.equal(signal.rule_id, s.scen.expect.rule_id);
  const cvFact = pack.facts.find((f) => signal.fact_refs.includes(f.fact_id) && f.fact_type === 'research_item');
  assert.equal(cvFact.attributes.field, 'genetics');
  assert.equal(cvFact.provenance.projection_type, 'filevault.document_projection');
  assert.ok(pack.inputs.some((r) => r.projection_id === cvFact.provenance.projection_id && r.source_receipt_hash === cvFact.provenance.source_receipt_hash));
  // Never invent absent project details: the probe uses only the field present on the fact.
  assert.ok(!/grant|funding|award|patient count|\b\d{2,}\b/u.test(probe.question_ref.text));
});

test('2. Proactive: salient genetics research enters the interview without any mention, under policy', async () => {
  const s = await scenario('proactive');
  const pack = buildPack(s);
  const profile = profileFor(s.scen);
  const genetics = pack.signals.find((sig) => sig.rule_id === 'AIS-R01' && sig.possible_probes[0].includes('genetics'));
  assert.ok(genetics.salience >= s.scen.expect.min_salience && genetics.proactive_eligible);
  let memory = AI.createMemory();
  const moves = [];
  const answers = [...s.scen.answer_texts, 'I like teaching juniors.', 'Teamwork matters to me.', 'Closing thoughts.'];
  for (let i = 0; i < 8; i += 1) {
    const move = nextMove(pack, s, profile, { ...memory, current_answer_coverage: memory.current_question_id ? 1 : null }, memory.current_question_id ? answers[i - 1] : '');
    moves.push(move);
    memory = AI.applyMemoryDelta(memory, move);
    if (move.kind === 'close') break;
  }
  const proactive = moves.find((m) => m.kind === 'ask' && m.lane === 'application');
  assert.ok(proactive, 'application-derived question asked proactively');
  assert.equal(proactive.signal_refs.length, 1);
  const eligible = proactive.candidates.find((c) => c.id === genetics.signal_id);
  assert.ok(eligible && eligible.lane === 'application' && eligible.score > 0, 'the genetics research signal was an eligible proactive candidate');
  assert.equal(moves.indexOf(proactive) >= 2, true, 'after at least two pool questions');
  assert.ok(!answers.slice(0, moves.indexOf(proactive)).some((a) => /research|genetic/iu.test(a)), 'the student never mentioned research');
});

test('3. Cross-source: answer + CV + PS + MSPE + program jointly raise probe relevance with provenance to every source', async () => {
  const s = await scenario('cross-source');
  const pack = buildPack(s);
  const qi = pack.signals.find((sig) => sig.rule_id === 'AIS-R01' && sig.possible_probes[0].includes('quality improvement'));
  assert.ok(qi.salience >= s.scen.expect.min_salience);
  const sources = new Set(qi.fact_refs.map((id) => pack.facts.find((f) => f.fact_id === id).provenance.projection_id));
  assert.ok(sources.size >= s.scen.expect.min_sources, 'CV, PS and MSPE each remain traceable');
  assert.deepEqual(qi.program_affinity, ['prog-cedar-valley-im']);
  for (const id of qi.fact_refs) {
    const fact = pack.facts.find((f) => f.fact_id === id);
    assert.ok(fact.provenance.source_receipt_hash && fact.provenance.source_version, 'no silently merged fact');
  }
  const profile = profileFor(s.scen);
  const memory = AI.createMemory({ asked_question_ids: ['Q-TELL-ME'], pool_questions_asked: 1, current_question_id: 'Q-TELL-ME', current_answer_coverage: 1, lane_moves: { pool: 1 } });
  const move = nextMove(pack, s, profile, memory, s.scen.answer_text);
  assert.equal(move.lane, 'application');
  assert.deepEqual(move.signal_refs, [qi.signal_id]);
  const poolBest = Math.max(...move.candidates.filter((c) => c.lane === 'pool').map((c) => c.score), 0);
  const chosen = move.candidates.find((c) => c.id === qi.signal_id);
  assert.ok(chosen.score > poolBest, 'probe relevance dominated the pool for this turn');
});

test('4. Consistency: differing document facts and answer-versus-document facts become clarifications, never accusations', async () => {
  const s = await scenario('consistency');
  const pack = buildPack(s);
  const check = pack.signals.find((sig) => sig.kind === 'consistency_check');
  assert.equal(check.comparison.relation, s.scen.expect.relation);
  assert.equal(check.stance, s.scen.expect.stance);
  assert.ok(!WRONGDOING.test(JSON.stringify(pack)), 'no wrongdoing language anywhere in the pack');
  const live = AI.evaluateLiveConsistency(pack, s.scen.answer_text);
  assert.equal(live[0].relation, 'date_range_mismatch');
  assert.ok(!WRONGDOING.test(JSON.stringify(live)));
  const profile = profileFor(s.scen);
  const memory = AI.createMemory({ asked_question_ids: ['Q-TELL-ME', 'Q-WHY-IM'], pool_questions_asked: 2, answers_completed: 2, current_question_id: 'Q-WHY-IM', current_answer_coverage: 1, lane_moves: { pool: 2 } });
  const move = nextMove(pack, s, profile, memory, s.scen.answer_text);
  assert.equal(move.kind, 'probe');
  assert.match(move.question_ref.text, /^Help me line up the timeline/u);
  assert.match(move.guidance, /^Ask gently, as a curiosity/u);
  assert.ok(!ACCUSATION.test(move.guidance));
});

test('5. Pressure: low and high settings change depth, skepticism, tolerance and move-on, not voice, never abusive', async () => {
  const s = await scenario('pressure');
  const low = profileFor({ ...s.scen, ...s.scen.low });
  const high = profileFor({ ...s.scen, ...s.scen.high });
  const differing = Object.keys(high).filter((k) => JSON.stringify(high[k]) !== JSON.stringify(low[k]));
  assert.deepEqual(differing.sort(), ['consistency_surfacing', 'effective_style', 'evidence_challenge_rate', 'max_probes_per_question', 'move_on_coverage_threshold',
    'pressure_modifier', 'proactive_budget_per_session', 'rambling_tolerance_s', 'restricted_reactive_allowed', 'silence_tolerance_ms', 'style'].sort());
  assert.ok(!('voice' in low) && !('voice' in high));
  assert.equal(high.max_consecutive_probes, 3);
  assert.equal(high.clarification_cap_per_session, 1);
  const pack = buildPack(s);
  const lowBlock = AI.serializeForActor(pack, { practice_goal: s.scen.practice_goal, pressure_profile: low });
  const highBlock = AI.serializeForActor(pack, { practice_goal: s.scen.practice_goal, pressure_profile: high });
  assert.equal(lowBlock, highBlock, 'pressure never rewrites what the Actor knows, only how the Director steers');
  assert.ok(!ACCUSATION.test(highBlock));
});

test('6. Question-source policy: five lanes represented; pool guides, never guarantees; individual question guarantees', async () => {
  assert.deepEqual(Object.keys(AI.LANE_PRIORS.full_simulation), ['pool', 'application', 'live_semantic', 'program', 'mentor']);
  const s = await scenario('proactive');
  const mcc = await fixture('projections.mcc-priorities.v1.json');
  const pack = buildPack({ ...s, projections: [...s.projections, mcc], practice_goal: 'guided_mock' });
  const profile = profileFor({ ...s.scen, practice_goal: 'guided_mock' });
  let memory = AI.createMemory();
  const lanes = new Set();
  for (let i = 0; i < 12; i += 1) {
    const move = AI.arbitrate({ pack, pool_snapshot: s.pool, memory: { ...memory, current_answer_coverage: memory.current_question_id ? 1 : null }, pressure_profile: profile, practice_goal: 'guided_mock', target_asked_count: 4, reactive_matches: [], live_candidates: memory.current_question_id ? [{ id: `lc-${i}`, text: 'Can you give one concrete example?', confidence: 0.9 }] : [] });
    if (move.lane) lanes.add(move.lane);
    memory = AI.applyMemoryDelta(memory, move);
    if (move.kind === 'close') break;
  }
  assert.ok(lanes.has('pool') && (lanes.has('application') || lanes.has('mentor') || lanes.has('program')), `lanes used: ${[...lanes].join(', ')}`);
  assert.ok(memory.asked_question_ids.filter((id) => s.pool.expanded_question_ids.includes(id)).length < s.pool.expanded_question_ids.length, 'pool items remained unasked');
  const iqPack = buildPack(s, { practice_goal: 'individual_question' });
  const iq = AI.arbitrate({ pack: iqPack, pool_snapshot: s.pool, memory: AI.createMemory(), pressure_profile: profileFor({ ...s.scen, practice_goal: 'individual_question', pressure_modifier: false }), practice_goal: 'individual_question', target_asked_count: 1, selected_question_id: 'Q-CHALLENGE' });
  assert.equal(iq.question_ref.question_id, 'Q-CHALLENGE');
});

test('7. Privacy and subject separation: no cross-student mixing anywhere', async () => {
  const s = await scenario('reactive');
  const other = await fixture('projections.other-subject.v1.json');
  assert.throws(() => buildPack({ ...s, projections: [...s.projections, other] }), (e) => e.code === 'subject_mismatch');
  const pack = buildPack(s);
  const foreignFact = { ...pack.facts[0], subject_id: 'stu-fixture-9999' };
  assert.throws(() => AI.assertInterviewContextPack({ ...pack, facts: [foreignFact, ...pack.facts.slice(1)] }), /exactly one subject/u);
  assert.throws(() => AI.deriveSignals([foreignFact], { subject_id: pack.subject_id, now: s.scen.now, program: null, practice_goal: 'full_simulation' }), /another subject/u);
  assert.ok(!pack.actor_block.includes('9999'));
});

test('8. Malformed or missing input fails closed', async () => {
  const s = await scenario('reactive');
  assert.throws(() => AI.assembleContextPack({}), /subject_id/u);
  assert.throws(() => buildPack({ ...s, projections: [{ projection_id: 'x' }] }), (e) => e.code === 'malformed_projection');
  assert.throws(() => buildPack({ ...s, projections: [{ ...s.projections[0], projection_type: 'unknown.owner' }] }), (e) => e.code === 'unsupported_projection_type');
  assert.throws(() => AI.arbitrate({}), /pack is required/u);
  assert.throws(() => AI.resolvePressureProfile({ style: 'hawk', follow_up_intensity: 1, practice_goal: 'full_simulation' }), /style must be/u);
  assert.throws(() => AI.evaluateReactiveTriggers({}, 'text'), /trigger_index/u);
  const pack = buildPack(s);
  assert.deepEqual(AI.evaluateReactiveTriggers(pack, ''), []);
});

test('9. Repeatability: identical inputs produce byte-identical packs, versions, actor blocks and moves; versions move with inputs', async () => {
  const s = await scenario('cross-source');
  const a = buildPack(s);
  const b = buildPack(s);
  assert.equal(AI.canonicalJson(a), AI.canonicalJson(b));
  assert.equal(a.actor_block, b.actor_block);
  assert.ok(new TextEncoder().encode(a.actor_block).length <= 6144);
  const profile = profileFor(s.scen);
  const memory = AI.createMemory({ asked_question_ids: ['Q-TELL-ME'], pool_questions_asked: 1, current_question_id: 'Q-TELL-ME', current_answer_coverage: 1, lane_moves: { pool: 1 } });
  assert.deepEqual(nextMove(a, s, profile, memory, s.scen.answer_text), nextMove(b, s, profile, memory, s.scen.answer_text));
  const bumped = s.projections.map((p) => (p.payload?.kind === 'mspe' ? bumpVersion(p, 'mspe-v2') : p));
  const c = buildPack({ ...s, projections: bumped });
  assert.notEqual(c.pack_version, a.pack_version);
  assert.equal(AI.packReuseDecision(a, { subject_id: s.scen.subject_id, projections: s.projections, now: s.scen.now, pool_snapshot_ref: s.pool.snapshot_id }).reuse, true);
  assert.equal(AI.packReuseDecision(a, { subject_id: s.scen.subject_id, projections: bumped, now: s.scen.now, pool_snapshot_ref: s.pool.snapshot_id }).reuse, false);
  const restricted = a.facts.filter((f) => f.sensitivity === 'restricted');
  for (const fact of restricted) assert.ok(!a.actor_block.includes(AI.factLine(fact)));
});
