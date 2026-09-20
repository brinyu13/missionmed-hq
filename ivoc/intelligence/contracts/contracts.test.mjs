import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPLICATION_FACT_SCHEMA, ATTENTION_SIGNAL_SCHEMA, CONTEXT_PACK_SCHEMA, PRESSURE_PROFILE_SCHEMA, DIRECTOR_MOVE_SCHEMA,
  assertApplicationFact, sanitizeAttributes, assertAttentionSignal, assertProbeText, isActorSpeakable,
  resolvePressureProfile, assertPressureProfile, contextReceiptRef, parseContextReceiptRef, assertDirectorMove,
  FACT_TYPES, PROHIBITED_ATTRIBUTE_KEYS,
} from './index.mjs';

const provenance = {
  projection_id: 'p1', owner_app: 'filevault', projection_type: 'filevault.document_projection',
  source_version: 'v1', source_receipt_hash: 'h1', extracted_by: 'owner_structured', extracted_at: '2026-09-18T12:00:00.000Z',
};
const baseFact = (over = {}) => ({
  schema_version: '1', fact_id: 'fact:1', subject_id: 's1', fact_type: 'research_item',
  attributes: { title: 'A study' }, provenance, confidence: 1, sensitivity: 'routine', student_visible: true, version: 1, ...over,
});
const baseSignal = (over = {}) => ({
  schema_version: '1', signal_id: 'sig:1', subject_id: 's1', kind: 'probe_candidate', stance: 'interviewer_plausible',
  fact_refs: ['fact:1'], rule_id: 'AIS-R01', rules_version: '2026-09-18.1', rationale: 'Research ownership is a routine topic.',
  confidence: 1, salience: 0.8, sensitivity: 'routine', proactive_eligible: true, reactive_triggers: ['research'],
  allowed_roles: ['program_director'], possible_probes: ['What did you personally do in that study?'],
  program_affinity: [], expires_with: ['p1@v1'], ...over,
});

test('schema strings are fixed by the donor packet', () => {
  assert.equal(APPLICATION_FACT_SCHEMA, 'ivoc.application_fact.v1');
  assert.equal(ATTENTION_SIGNAL_SCHEMA, 'ivoc.attention_signal.v1');
  assert.equal(CONTEXT_PACK_SCHEMA, 'ivoc.interview_context_pack.v1');
  assert.equal(PRESSURE_PROFILE_SCHEMA, 'ivoc.pressure_profile.v1');
  assert.equal(DIRECTOR_MOVE_SCHEMA, 'ivoc.director_move.v1');
  assert.equal(FACT_TYPES.length, 18);
});

test('facts: closed schema, prohibited attributes, sensitivity and confidence laws', () => {
  const fact = baseFact();
  assert.equal(assertApplicationFact(fact), fact);
  assert.throws(() => assertApplicationFact(baseFact({ attributes: { title: 'x', ethnicity: 'y' } })), /prohibited/u);
  assert.throws(() => assertApplicationFact(baseFact({ attributes: { title: 'x', favorite_color: 'y' } })), /not in the research_item schema/u);
  assert.throws(() => assertApplicationFact(baseFact({ attributes: {} })), /required/u);
  assert.throws(() => assertApplicationFact(baseFact({ fact_type: 'exam', attributes: { name: 'Step 1' }, sensitivity: 'routine' })), /restricted/u);
  assert.throws(() => assertApplicationFact(baseFact({ provenance: { ...provenance, extracted_by: 'model_assisted' }, confidence: 0.95 })), /capped/u);
  assert.throws(() => assertApplicationFact(baseFact({ fact_type: 'nonsense' })), /unknown fact type/u);
  assert.ok(PROHIBITED_ATTRIBUTE_KEYS.includes('immigration_status'));
  const { attributes, excluded } = sanitizeAttributes('research_item', { title: 'x', Race: 'dropped', venue: 'not-in-schema', field: undefined });
  assert.deepEqual(attributes, { title: 'x' });
  assert.deepEqual(excluded, { Race: 'prohibited_attribute', venue: 'not_in_closed_schema' });
});

test('signals: proactive law, stance law, accusation language, no red_flag concept', () => {
  assert.ok(assertAttentionSignal(baseSignal()));
  assert.throws(() => assertAttentionSignal(baseSignal({ sensitivity: 'restricted' })), /never be proactive/u);
  assert.ok(assertAttentionSignal(baseSignal({ sensitivity: 'restricted', proactive_eligible: false })));
  assert.throws(() => assertAttentionSignal(baseSignal({ stance: 'objective_concern', proactive_eligible: false })), /consistency_check/u);
  assert.throws(() => assertAttentionSignal(baseSignal({ red_flag: true })), /red_flag/u);
  assert.throws(() => assertAttentionSignal(baseSignal({ possible_probes: ['Why did you lie about that?'] })), /accusation/u);
  assert.throws(() => assertAttentionSignal(baseSignal({ possible_probes: ['one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six?'] })), /exceeds 25 words/u);
  assert.throws(() => assertAttentionSignal(baseSignal({ kind: 'consistency_check' })), /comparison/u);
  assert.ok(assertAttentionSignal(baseSignal({ kind: 'consistency_check', comparison: { a: 'fact:1', b: 'fact:2', relation: 'date_range_mismatch' } })));
  assert.throws(() => assertProbeText('That is suspicious.'), /accusation/u);
  assert.equal(isActorSpeakable(baseSignal({ sensitivity: 'restricted', proactive_eligible: false })), false);
  assert.equal(isActorSpeakable(baseSignal({ sensitivity: 'restricted', proactive_eligible: false }), { reactive: true, restricted_reactive_allowed: true }), true);
  assert.equal(isActorSpeakable(baseSignal({ kind: 'consistency_check', stance: 'objective_concern', proactive_eligible: false, comparison: { a: 'a', b: 'b', relation: 'count_mismatch' } }), { reactive: true, restricted_reactive_allowed: true }), false);
});

test('pressure profile: style table, modifier, intensity, mode law, no Actor fields', () => {
  const dove = resolvePressureProfile({ style: 'dove', follow_up_intensity: 2, practice_goal: 'full_simulation' });
  const eagle = resolvePressureProfile({ style: 'eagle', pressure_modifier: true, follow_up_intensity: 2, practice_goal: 'full_simulation' });
  assert.equal(dove.max_probes_per_question, 1);
  assert.equal(eagle.max_probes_per_question, 3);
  assert.equal(dove.evidence_challenge_rate, 0.10);
  assert.equal(eagle.evidence_challenge_rate, 0.60);
  assert.equal(dove.consistency_surfacing, 'results_only');
  assert.equal(eagle.consistency_surfacing, 'immediate');
  assert.equal(dove.move_on_coverage_threshold, 0.5);
  assert.equal(eagle.move_on_coverage_threshold, 0.8);
  assert.equal(dove.restricted_reactive_allowed, false);
  assert.equal(eagle.restricted_reactive_allowed, true);
  const peacockUp = resolvePressureProfile({ style: 'peacock', pressure_modifier: true, follow_up_intensity: 2, practice_goal: 'full_simulation' });
  assert.equal(peacockUp.effective_style, 'owl');
  assert.equal(resolvePressureProfile({ style: 'owl', follow_up_intensity: 0, practice_goal: 'full_simulation' }).max_probes_per_question, 0);
  assert.equal(resolvePressureProfile({ style: 'owl', follow_up_intensity: 3, practice_goal: 'full_simulation' }).max_probes_per_question, 3);
  assert.throws(() => resolvePressureProfile({ style: 'owl', pressure_modifier: true, follow_up_intensity: 1, practice_goal: 'individual_question' }), /not valid for individual question/u);
  const guided = resolvePressureProfile({ style: 'eagle', follow_up_intensity: 2, practice_goal: 'guided_mock' });
  assert.equal(guided.consistency_surfacing, 'end_of_answer_block');
  assert.equal(guided.coaching_interjections_per_answer, 1);
  assert.equal(dove.coaching_language_allowed, false);
  for (const key of Object.keys(eagle)) assert.ok(!['voice', 'accent', 'tone', 'warmth', 'embodiment'].includes(key));
  assert.throws(() => assertPressureProfile({ ...dove, voice: 'marin' }), /belongs to the Actor/u);
  assert.throws(() => assertPressureProfile({ ...dove, max_consecutive_probes: 5 }), /fixed at 3/u);
});

test('context receipt ref round-trips', () => {
  const ref = contextReceiptRef({ pack_id: 'abc', pack_version: 'f'.repeat(64) });
  assert.equal(ref, `ctxpack:abc@${'f'.repeat(64)}`);
  assert.deepEqual(parseContextReceiptRef(ref), { pack_id: 'abc', pack_version: 'f'.repeat(64) });
  assert.equal(parseContextReceiptRef('nope'), null);
});

test('director move: grounding law for contextual moves', () => {
  const move = {
    schema_version: '1', kind: 'ask', lane: 'application', signal_refs: [], guidance: 'Ask it.', rationale_ref: 'r',
    question_ref: { origin: 'contextual', text: 'What did you do?' }, memory_delta: {}, candidates: [],
  };
  assert.throws(() => assertDirectorMove(move), /signal_refs/u);
  assert.ok(assertDirectorMove({ ...move, signal_refs: ['sig:1'] }));
  assert.throws(() => assertDirectorMove({ ...move, signal_refs: ['sig:1'], guidance: 'Catch the liar.' }), /accusation/u);
  assert.ok(assertDirectorMove({ schema_version: '1', kind: 'close', guidance: 'Thank them.', rationale_ref: 'r', signal_refs: [], memory_delta: {}, candidates: [] }));
});
