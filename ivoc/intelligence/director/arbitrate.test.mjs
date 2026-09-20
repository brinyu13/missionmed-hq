import assert from 'node:assert/strict';
import test from 'node:test';
import { arbitrate, createMemory, applyMemoryDelta, LANE_PRIORS, PROACTIVE_SALIENCE_THRESHOLD } from './arbitrate.mjs';
import { evaluateReactiveTriggers, evaluateLiveConsistency } from './triggers.mjs';
import { assertDirectorMove } from '../contracts/director-move.mjs';
import { scenario, buildPack, profileFor, ACCUSATION } from '../test-helpers.mjs';

/** Drive a session: ask, answer (memory), arbitrate again. Returns the move log. */
function runSession({ pack, pool, profile, practice_goal, target_asked_count, answers = [], maxTurns = 20, selected_question_id, live_candidates = [] }) {
  let memory = createMemory();
  const moves = [];
  let answerIndex = 0;
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const lastAnswer = memory.current_question_id ? (answers[answerIndex] ?? 'A thoughtful but generic answer about training.') : '';
    const reactive_matches = lastAnswer ? evaluateReactiveTriggers(pack, lastAnswer) : [];
    const live_consistency = lastAnswer ? evaluateLiveConsistency(pack, lastAnswer) : [];
    const move = arbitrate({ pack, pool_snapshot: pool, memory: { ...memory, current_answer_coverage: memory.current_question_id ? 1 : null }, pressure_profile: profile, practice_goal, target_asked_count, reactive_matches, live_consistency, live_candidates, selected_question_id });
    assertDirectorMove(move);
    moves.push(move);
    if (memory.current_question_id) answerIndex += 1;
    memory = applyMemoryDelta(memory, move);
    if (move.kind === 'close') break;
  }
  return { moves, memory };
}

test('lane priors follow the packet and individual_question guarantees only the selected question', async () => {
  assert.deepEqual(LANE_PRIORS.full_simulation, { pool: 0.55, application: 0.20, live_semantic: 0.15, program: 0.07, mentor: 0.03 });
  assert.deepEqual(LANE_PRIORS.guided_mock, { pool: 0.40, application: 0.20, live_semantic: 0.10, program: 0.05, mentor: 0.25 });
  assert.equal(PROACTIVE_SALIENCE_THRESHOLD, 0.6);
  const s = await scenario('reactive');
  const pack = buildPack(s, { practice_goal: 'individual_question' });
  const profile = profileFor({ ...s.scen, practice_goal: 'individual_question', pressure_modifier: false });
  const { moves } = runSession({ pack, pool: s.pool, profile, practice_goal: 'individual_question', target_asked_count: 1, selected_question_id: 'Q-WHY-IM', answers: [s.scen.answer_text, 'More detail about the lab.', 'Even more detail.'] });
  assert.equal(moves[0].kind, 'ask');
  assert.equal(moves[0].question_ref.question_id, 'Q-WHY-IM');
  assert.equal(moves[0].rationale_ref, 'founder_law:individual_question_guarantees_selected_question');
  assert.ok(moves.slice(1, -1).every((m) => m.kind === 'probe' || m.kind === 'follow_up'), 'later moves are probes on the selected question only');
  assert.ok(!moves.some((m) => m.kind === 'ask' && m.question_ref.question_id !== 'Q-WHY-IM'), 'no other pool question is ever asked');
  assert.equal(moves.at(-1).kind, 'close');
  assert.ok(moves.filter((m) => m.kind === 'probe').length <= profile.max_probes_per_question);
});

test('reactive: a research mention yields a grounded application probe with signal_refs on the next turn', async () => {
  const s = await scenario('reactive');
  const pack = buildPack(s);
  const profile = profileFor(s.scen);
  const { moves } = runSession({ pack, pool: s.pool, profile, practice_goal: s.scen.practice_goal, target_asked_count: s.scen.target_asked_count, answers: [s.scen.answer_text] });
  assert.equal(moves[0].kind, 'ask');
  assert.equal(moves[0].lane, 'pool');
  const probe = moves[1];
  assert.equal(probe.kind, 'probe');
  assert.equal(probe.lane, 'application');
  assert.equal(probe.question_ref.origin, 'contextual');
  assert.match(probe.question_ref.text, /genetics/u);
  assert.equal(probe.signal_refs.length, 1);
  const signal = pack.signals.find((sig) => sig.signal_id === probe.signal_refs[0]);
  assert.equal(signal.rule_id, 'AIS-R01');
  assert.match(probe.guidance, /Connect to what the applicant just said about .*research/u);
  assert.ok(!ACCUSATION.test(probe.guidance));
});

test('proactive: salient genetics research enters without a mention, only after two pool questions and within budget', async () => {
  const s = await scenario('proactive');
  const pack = buildPack(s);
  const profile = profileFor(s.scen);
  const genetics = pack.signals.find((sig) => sig.rule_id === 'AIS-R01' && sig.possible_probes[0].includes('genetics'));
  assert.ok(genetics.salience >= s.scen.expect.min_salience);
  assert.equal(genetics.proactive_eligible, true);
  const { moves } = runSession({ pack, pool: s.pool, profile, practice_goal: s.scen.practice_goal, target_asked_count: s.scen.target_asked_count, answers: s.scen.answer_texts });
  const proactive = moves.filter((m) => m.kind === 'ask' && m.lane === 'application');
  assert.ok(proactive.length >= 1, 'an application-derived question was asked proactively');
  const firstIndex = moves.indexOf(proactive[0]);
  const poolBefore = moves.slice(0, firstIndex).filter((m) => m.kind === 'ask' && m.lane === 'pool').length;
  assert.ok(poolBefore >= 2, 'proactive probes wait for two pool questions');
  assert.ok(proactive.length <= profile.proactive_budget_per_session);
  assert.ok(proactive.every((m) => m.signal_refs.length === 1 && m.question_ref.origin === 'contextual'));
  const asked = new Set(moves.filter((m) => m.kind === 'ask' && m.lane === 'pool').map((m) => m.question_ref.question_id));
  assert.ok(asked.size < s.pool.expanded_question_ids.length, 'the pool guided the interview but did not guarantee every question');
  assert.equal(moves.at(-1).kind, 'close');
});

test('pressure policy: Dove and Eagle differ only in profile-driven behaviour, never voice, never abuse', async () => {
  const s = await scenario('pressure');
  const pack = buildPack(s);
  const low = profileFor({ ...s.scen, ...s.scen.low });
  const high = profileFor({ ...s.scen, ...s.scen.high });
  assert.ok(high.max_probes_per_question > low.max_probes_per_question);
  assert.ok(high.evidence_challenge_rate > low.evidence_challenge_rate);
  assert.ok(high.move_on_coverage_threshold > low.move_on_coverage_threshold);
  assert.ok(high.rambling_tolerance_s < low.rambling_tolerance_s);
  assert.equal(low.consistency_surfacing, 'results_only');
  assert.equal(high.consistency_surfacing, 'immediate');
  assert.equal(high.max_consecutive_probes, 3);
  assert.deepEqual(s.scen.voice, { voice: 'marin', accent: 'neutral' }, 'voice configuration is untouched by either profile');
  for (const profile of [low, high]) for (const key of Object.keys(profile)) assert.ok(!['voice', 'accent', 'tone'].includes(key));
  const answers = ['I did a lot of research.', 'I did a lot of research.', 'Research again.', 'Research again.'];
  const lowRun = runSession({ pack, pool: s.pool, profile: low, practice_goal: s.scen.practice_goal, target_asked_count: s.scen.target_asked_count, answers });
  const highRun = runSession({ pack, pool: s.pool, profile: high, practice_goal: s.scen.practice_goal, target_asked_count: s.scen.target_asked_count, answers });
  const probes = (run) => run.moves.filter((m) => m.kind === 'probe').length;
  assert.ok(probes(highRun) >= probes(lowRun));
  for (const run of [lowRun, highRun]) {
    let streak = 0;
    for (const m of run.moves) { streak = m.kind === 'probe' || m.kind === 'follow_up' ? streak + 1 : 0; assert.ok(streak <= 3, 'never more than three consecutive probes'); }
    assert.ok(run.moves.every((m) => !ACCUSATION.test(m.guidance)));
  }
});

test('clarifications: once per session, only after two answers, never restricted proactively, results_only respected', async () => {
  const s = await scenario('consistency');
  const pack = buildPack(s);
  const check = pack.signals.find((sig) => sig.kind === 'consistency_check');
  assert.ok(check);
  const owl = profileFor(s.scen);
  const early = arbitrate({ pack, pool_snapshot: s.pool, memory: createMemory({ current_question_id: 'Q-TELL-ME', asked_question_ids: ['Q-TELL-ME'], pool_questions_asked: 1, answers_completed: 0, current_answer_coverage: 1 }), pressure_profile: owl, practice_goal: s.scen.practice_goal, target_asked_count: 4, reactive_matches: [{ signal_id: check.signal_id, matched_lexemes: ['riverbend'] }] });
  assert.ok(!early.signal_refs.includes(check.signal_id), 'no clarification before two answers');
  assert.ok(early.candidates.some((c) => c.reason === 'too_early_for_clarification'));
  const later = arbitrate({ pack, pool_snapshot: s.pool, memory: createMemory({ current_question_id: 'Q-WHY-IM', asked_question_ids: ['Q-TELL-ME', 'Q-WHY-IM'], pool_questions_asked: 2, answers_completed: 2, current_answer_coverage: 1 }), pressure_profile: owl, practice_goal: s.scen.practice_goal, target_asked_count: 4, reactive_matches: [{ signal_id: check.signal_id, matched_lexemes: ['riverbend'] }] });
  assert.deepEqual(later.signal_refs, [check.signal_id]);
  assert.match(later.guidance, /^Ask gently, as a curiosity/u);
  const capped = arbitrate({ pack, pool_snapshot: s.pool, memory: createMemory({ current_question_id: 'Q-WHY-IM', asked_question_ids: ['Q-TELL-ME', 'Q-WHY-IM'], pool_questions_asked: 2, answers_completed: 2, clarifications_used: 1, current_answer_coverage: 1 }), pressure_profile: owl, practice_goal: s.scen.practice_goal, target_asked_count: 4, reactive_matches: [{ signal_id: check.signal_id, matched_lexemes: ['riverbend'] }] });
  assert.ok(!capped.signal_refs.includes(check.signal_id));
  const dove = profileFor({ ...s.scen, style: 'dove', practice_goal: 'full_simulation' });
  const simPack = buildPack(s, { practice_goal: 'full_simulation' });
  const simCheck = simPack.signals.find((sig) => sig.kind === 'consistency_check');
  const doveMove = arbitrate({ pack: simPack, pool_snapshot: s.pool, memory: createMemory({ current_question_id: 'Q-WHY-IM', asked_question_ids: ['Q-TELL-ME', 'Q-WHY-IM'], pool_questions_asked: 2, answers_completed: 2, current_answer_coverage: 1 }), pressure_profile: dove, practice_goal: 'full_simulation', target_asked_count: 4, reactive_matches: [{ signal_id: simCheck.signal_id, matched_lexemes: ['riverbend'] }] });
  assert.ok(!doveMove.signal_refs.includes(simCheck.signal_id), 'Dove surfaces consistency only in Results');
  const exam = simPack.signals.find((sig) => sig.rule_id === 'AIS-R03');
  if (exam) {
    const eagle = profileFor({ ...s.scen, style: 'eagle', practice_goal: 'full_simulation' });
    const noMention = arbitrate({ pack: simPack, pool_snapshot: s.pool, memory: createMemory({ current_question_id: 'Q-WHY-IM', asked_question_ids: ['Q-TELL-ME', 'Q-WHY-IM'], pool_questions_asked: 2, answers_completed: 2, current_answer_coverage: 1 }), pressure_profile: eagle, practice_goal: 'full_simulation', target_asked_count: 6, reactive_matches: [] });
    assert.ok(!noMention.signal_refs.includes(exam.signal_id), 'restricted signals are never proactive');
    const doveMention = arbitrate({ pack: simPack, pool_snapshot: s.pool, memory: createMemory({ current_question_id: 'Q-WHY-IM', asked_question_ids: ['Q-TELL-ME', 'Q-WHY-IM'], pool_questions_asked: 2, answers_completed: 2, current_answer_coverage: 1 }), pressure_profile: dove, practice_goal: 'full_simulation', target_asked_count: 6, reactive_matches: [{ signal_id: exam.signal_id, matched_lexemes: ['step'] }] });
    assert.ok(!doveMention.signal_refs.includes(exam.signal_id), 'Dove may not raise restricted topics even reactively');
    assert.ok(doveMention.candidates.some((c) => c.reason === 'restricted_not_allowed_by_profile'));
  }
});

test('follow_up_intensity 0 keeps the interview inside the pool; deterministic outputs; fail closed on bad input', async () => {
  const s = await scenario('proactive');
  const pack = buildPack(s);
  const strict = profileFor({ ...s.scen, follow_up_intensity: 0 });
  const run = runSession({ pack, pool: s.pool, profile: strict, practice_goal: s.scen.practice_goal, target_asked_count: 4, answers: ['research research research', 'research', 'research'] });
  assert.ok(run.moves.every((m) => m.kind === 'close' || m.lane === 'pool'), 'no probes and no outside-pool moves at intensity 0');
  const a = runSession({ pack, pool: s.pool, profile: profileFor(s.scen), practice_goal: s.scen.practice_goal, target_asked_count: 4, answers: s.scen.answer_texts });
  const b = runSession({ pack, pool: s.pool, profile: profileFor(s.scen), practice_goal: s.scen.practice_goal, target_asked_count: 4, answers: s.scen.answer_texts });
  assert.deepEqual(a.moves, b.moves);
  assert.throws(() => arbitrate({ pack, pool_snapshot: { bad: true }, memory: createMemory(), pressure_profile: strict, practice_goal: 'full_simulation', target_asked_count: 3 }));
  assert.throws(() => arbitrate({ pack, pool_snapshot: s.pool, memory: createMemory(), pressure_profile: strict, practice_goal: 'guided_mock', target_asked_count: 3 }), /must match/u);
  assert.throws(() => arbitrate({ pack, pool_snapshot: s.pool, memory: createMemory(), pressure_profile: strict, practice_goal: 'full_simulation', target_asked_count: 0 }), /positive integer/u);
});
