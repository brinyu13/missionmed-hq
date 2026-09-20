import assert from 'node:assert/strict';
import test from 'node:test';
import { intakeProjections } from '../normalize/intake.mjs';
import { deriveSignals, AIS_RULES_VERSION } from './rules.mjs';
import { findInconsistencies } from './consistency.mjs';
import { salienceFor } from './salience.mjs';
import { fixture, ACCUSATION } from '../test-helpers.mjs';

const NOW = '2026-09-18T12:00:00.000Z';
const SUBJECT = 'stu-fixture-0001';

async function derive(names, practice_goal = 'full_simulation') {
  const projections = await Promise.all(names.map(fixture));
  const intake = intakeProjections(projections, { subject_id: SUBJECT, now: NOW });
  return { intake, ...deriveSignals(intake.facts, { subject_id: SUBJECT, now: NOW, program: intake.program, practice_goal }) };
}

test('rules version is pinned and every signal validates and traces to facts', async () => {
  const { intake, signals, rules_version } = await derive(['projections.filevault-cv.v1.json', 'projections.filevault-ps.v1.json', 'projections.rise-program.v1.json']);
  assert.equal(rules_version, AIS_RULES_VERSION);
  assert.ok(signals.length >= 8);
  const factIds = new Set(intake.facts.map((f) => f.fact_id));
  for (const signal of signals) {
    assert.equal(signal.rules_version, AIS_RULES_VERSION);
    for (const ref of signal.fact_refs) assert.ok(factIds.has(ref), `unknown fact ref ${ref}`);
    assert.ok(!ACCUSATION.test(JSON.stringify(signal)), `accusation language in ${signal.signal_id}`);
    assert.ok(!Object.prototype.hasOwnProperty.call(signal, 'red_flag'));
  }
});

test('AIS-R01 emits a genetics research probe backed by the CV fact, without inventing details', async () => {
  const { intake, signals } = await derive(['projections.filevault-cv.v1.json']);
  const genetics = intake.facts.find((f) => f.fact_type === 'research_item' && f.attributes.field === 'genetics');
  const probe = signals.find((s) => s.rule_id === 'AIS-R01' && s.fact_refs.includes(genetics.fact_id));
  assert.ok(probe);
  assert.match(probe.possible_probes[0], /genetics/u);
  assert.ok(probe.reactive_triggers.includes('research'));
  assert.ok(probe.reactive_triggers.includes('genetic'));
  assert.equal(probe.stance, 'interviewer_plausible');
  assert.equal(probe.proactive_eligible, true);
  // Only present attribute values appear in probes: no institution or year invented into the text.
  assert.ok(!probe.possible_probes.some((p) => /\b20\d\d\b/u.test(p)));
});

test('AIS-R03 exam history is restricted, never proactive, single gentle probe', async () => {
  const { signals } = await derive(['projections.filevault-cv.v1.json']);
  const exam = signals.find((s) => s.rule_id === 'AIS-R03');
  assert.ok(exam);
  assert.equal(exam.sensitivity, 'restricted');
  assert.equal(exam.proactive_eligible, false);
  assert.equal(exam.possible_probes.length, 1);
  assert.match(exam.possible_probes[0], /preparation/u);
  assert.ok(!/fail|attempt/iu.test(exam.possible_probes[0]));
});

test('AIS-R07 turns a PS-versus-CV duration difference into a neutral clarification, not an accusation', async () => {
  const { intake, signals } = await derive(['projections.filevault-cv.v1.json', 'projections.filevault-ps.v1.json']);
  const findings = findInconsistencies(intake.facts);
  const mismatch = findings.find((f) => f.relation === 'date_range_mismatch');
  assert.ok(mismatch);
  assert.match(mismatch.detail, /6 months; document says 2/u);
  const check = signals.find((s) => s.kind === 'consistency_check');
  assert.ok(check);
  assert.equal(check.comparison.relation, 'date_range_mismatch');
  assert.equal(check.stance, 'interviewer_plausible');
  assert.match(check.possible_probes[0], /^Help me line up the timeline/u);
  assert.equal(check.fact_refs.length, 2);
});

test('objective_concern only for confident count or institution contradictions', async () => {
  const cv = await fixture('projections.filevault-cv.v1.json');
  const ps = await fixture('projections.filevault-ps.v1.json');
  ps.payload.claims.push({ claim_id: 'c9', text: 'I have three first-author publications.', asserts: { count_of: 'publication', count: 3 } });
  const intake = intakeProjections([cv, ps], { subject_id: SUBJECT, now: NOW });
  const { signals } = deriveSignals(intake.facts, { subject_id: SUBJECT, now: NOW, program: null, practice_goal: 'full_simulation' });
  const count = signals.find((s) => s.comparison?.relation === 'count_mismatch');
  assert.ok(count);
  assert.equal(count.stance, 'objective_concern');
  assert.equal(count.proactive_eligible, false);
  assert.ok(!ACCUSATION.test(count.possible_probes[0]));
});

test('program affinity and corroboration raise salience deterministically', async () => {
  const withProgram = await derive(['projections.filevault-cv.v1.json', 'projections.filevault-ps.v1.json', 'projections.filevault-mspe.v1.json', 'projections.rise-program.v1.json']);
  const without = await derive(['projections.filevault-cv.v1.json']);
  const qiWith = withProgram.signals.find((s) => s.rule_id === 'AIS-R01' && s.possible_probes[0].includes('quality improvement'));
  const qiWithout = without.signals.find((s) => s.rule_id === 'AIS-R01' && s.possible_probes[0].includes('quality improvement'));
  assert.ok(qiWith.salience > qiWithout.salience);
  assert.ok(qiWith.salience >= 0.9);
  assert.equal(new Set(qiWith.fact_refs.map((id) => withProgram.intake.facts.find((f) => f.fact_id === id).provenance.projection_id)).size, 3);
  assert.deepEqual(qiWith.program_affinity, ['prog-cedar-valley-im']);
  const again = await derive(['projections.filevault-cv.v1.json', 'projections.filevault-ps.v1.json', 'projections.filevault-mspe.v1.json', 'projections.rise-program.v1.json']);
  assert.deepEqual(again.signals, withProgram.signals);
  assert.equal(salienceFor([], { now: NOW }), 0);
});

test('mentor priorities weigh more in guided_mock; prior patterns never name earlier sessions', async () => {
  const guided = await derive(['projections.mcc-priorities.v1.json', 'projections.ivoc-longitudinal.v1.json'], 'guided_mock');
  const sim = await derive(['projections.mcc-priorities.v1.json', 'projections.ivoc-longitudinal.v1.json'], 'full_simulation');
  assert.equal(guided.signals.find((s) => s.rule_id === 'AIS-R09').salience, 1);
  assert.equal(sim.signals.find((s) => s.rule_id === 'AIS-R09').salience, 0.6);
  const pattern = sim.signals.find((s) => s.rule_id === 'AIS-R10');
  assert.ok(pattern);
  assert.ok(!/session|last time|previous/iu.test(pattern.possible_probes[0]));
  assert.ok(!guided.signals.some((s) => s.fact_refs.some((id) => guided.intake.facts.find((f) => f.fact_id === id).student_visible === false)), 'mentor-only notes never become spoken signals');
});

test('deriveSignals refuses facts from another subject', async () => {
  const { intake } = await derive(['projections.filevault-cv.v1.json']);
  assert.throws(() => deriveSignals(intake.facts, { subject_id: 'someone-else', now: NOW, program: null, practice_goal: 'full_simulation' }), /another subject/u);
});
