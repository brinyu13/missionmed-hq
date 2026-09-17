import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRestrictedShard, safeProjectionFromShard } from '../tools/build-gold-shard.mjs';
import { canonicalFileBytes, contentAddressedEnvelope, stableHash, stableStringify } from '../tools/canonical.mjs';
import { classifyPromptEligibility, deriveAcceptedStudentNames, detectGoldCandidates, resolveInstructor } from '../tools/gold-detector.mjs';
import { auditForbiddenRetainedPrompts, auditSafeValue, projectSafeRow } from '../tools/safe-projection.mjs';
import { finalizeShardEngineeringValidation, validateShardSemantics } from '../tools/semantic-validator.mjs';
import { validateSchemaInstance } from '../../I1Q_1008E_RESTRICTED_FULL_CORPUS_EXTRACTION/tools/schema-validator.mjs';
import { contractHash, row, transcript } from './fixtures.mjs';

function shard() {
  return buildRestrictedShard({ row, transcript, nodes: [], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 8_000_000, detector_options: { accepted_student_names: ['Alice', 'Bob'], instructor_aliases: ['Dr. J'] } });
}

test('canonical format rejects non-NFC, -0, nonfinite and preserves array order', () => {
  assert.throws(() => stableStringify('e\u0301'), /non_nfc/);
  assert.throws(() => stableStringify(-0), /negative_zero/);
  assert.throws(() => stableStringify(Infinity), /non_finite/);
  assert.notEqual(stableHash(['a', 'b']), stableHash(['b', 'a']));
});

test('detector excludes jumping-in/admin/learner prompts and preserves rapid follow-ups', () => {
  const result = detectGoldCandidates(transcript, { accepted_student_names: ['Alice', 'Bob'], instructor_aliases: ['Dr. J'] });
  assert.equal(result.jumping.detected, true);
  assert.equal(result.sequences.length, 2);
  assert.equal(result.sequences[0].questions.length, 3);
  assert.deepEqual(result.sequences[0].questions.map((q) => q.answers.length), [0, 1, 1]);
  assert.ok(result.excluded.some((x) => x.category === 'ADMINISTRATION'));
  assert.ok(result.excluded.some((x) => x.category === 'LEARNER_QUESTION'));
  assert.ok(!result.sequences.some((x) => x.called_student_alias.includes('Student')));
});

test('code-point offsets survive astral Unicode and multi-part records', () => {
  const records = transcript.slice(0, 2).concat([{ ...transcript[2], text: 'Alice: 🫀 what heart disease? Which drug?' }]);
  const result = detectGoldCandidates(records, { accepted_student_names: ['Alice'], instructor_aliases: ['Dr. J'] });
  assert.equal(result.sequences[0].questions.length, 2);
  assert.equal(result.sequences[0].questions[0].binding.text_codepoint_start, 7);
  assert.equal(result.sequences[0].questions[0].binding.selected_text_hash.length, 64);
});

test('derived roster aliases are transcript-speaker-grounded and omit ordinary words', () => {
  const names = deriveAcceptedStudentNames(transcript);
  assert.ok(names.includes('Alice Smith') && names.includes('Alice'));
  assert.ok(!names.includes('Student'));
});

test('built shard validates cross-array joins, roots, identities, and counts', () => {
  const value = shard();
  const result = validateShardSemantics(value, { ...row, run_contract_hash: contractHash });
  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(value.counts.primary_questions, value.student_call_sequences.length);
  assert.equal(value.counts.total_questions, value.counts.primary_questions + value.counts.follow_up_questions);
  assert.equal(value.questions[1].student_answer_span_ids.length, 1);
  assert.equal(value.questions[2].student_answer_span_ids.length, 1);
});

test('repeated wording never collapses deterministic records', () => {
  const repeated = transcript.concat([
    { ...transcript[7], record_ordinal: 11, start_us: 8_000_000, text: 'Alice, what renal disease causes pain?' },
    { ...transcript[8], record_ordinal: 12, start_us: 8_500_000 },
  ]);
  const value = buildRestrictedShard({ row, transcript: repeated, nodes: [], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 10_000_000, detector_options: { accepted_student_names: ['Alice', 'Bob'] } });
  assert.equal(new Set(value.questions.map((q) => q.question_id)).size, value.questions.length);
});

test('semantic validator rejects tamper, provenance and pairing substitution', () => {
  const original = shard();
  const tampered = structuredClone(original);
  tampered.questions[0].provenance_hash = '0'.repeat(64);
  Object.assign(tampered.questions[0], contentAddressedEnvelope(tampered.questions[0]));
  Object.assign(tampered, contentAddressedEnvelope(tampered));
  assert.ok(validateShardSemantics(tampered).errors.includes('question_provenance_hash_invalid'));
  assert.ok(validateShardSemantics(original, { transcript_sha256: '9'.repeat(64) }).errors.includes('transcript_pair_substitution'));
});

test('safe projection joins restricted shard and rejects leakage', () => {
  const value = shard();
  const rowValue = projectSafeRow(value);
  assert.equal(rowValue.safe_projection_hash, value.safe_projection_hash);
  assert.equal(auditSafeValue(rowValue, ['Alice']).passed, true);
  assert.equal(auditSafeValue({ verbatim_question: 'Alice secret' }, ['Alice']).passed, false);
});

test('restricted shard schema rejects unknown fields and invalid enums', async () => {
  const schemaUrl = new URL('../schemas/restricted-drill-gold-set.schema.json', import.meta.url);
  const schema = JSON.parse(await readFile(schemaUrl, 'utf8'));
  const value = shard();
  assert.equal(validateSchemaInstance(schema, value).valid, true);
  assert.equal(validateSchemaInstance(schema, { ...value, surprise: true }).valid, false);
  assert.equal(validateSchemaInstance(schema, { ...value, processing_status: 'APPROVED' }).valid, false);
});

test('canonical shard bytes are deterministic across two executions', () => {
  assert.deepEqual(canonicalFileBytes(shard()), canonicalFileBytes(shard()));
});

test('engineering finalization follows passing semantics without implying clinical approval', () => {
  const finalized = finalizeShardEngineeringValidation(shard());
  assert.match(finalized.validation_status, /^ENGINEERING_VERIFIED/);
  assert.ok(finalized.student_call_sequences.every((sequence) => sequence.validation_status === finalized.validation_status));
  assert.equal(finalized.validation_receipt_bindings.length, 1);
  assert.ok(finalized.questions.every((question) => question.review_status === 'UNREVIEWED' && question.release_status === 'RESTRICTED_ONLY'));
  assert.equal(validateShardSemantics(finalized).valid, true);
});

test('Nodes corroboration is comparison-only and never substitutes for transcript provenance', () => {
  const exactNode = [{ record_ordinal: 0, start_us: 2_000_000, end_us: 3_000_000, text: 'what heart disease causes this?', raw_record_hash: 'a'.repeat(64) }];
  const exact = buildRestrictedShard({ row, transcript, nodes: exactNode, run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 8_000_000, detector_options: { accepted_student_names: ['Alice', 'Bob'] } });
  assert.equal(exact.counts.runtime_comparison.nodes_confirmed_questions, 1);
  assert.equal(exact.questions[0].nodes_bindings[0].relationship, 'QUESTION_CONFIRMATION');
  assert.ok(exact.questions.every((question) => question.transcript_segment_bindings.length > 0));
  const noMatch = buildRestrictedShard({ row, transcript, nodes: [{ record_ordinal: 0, text: 'unrelated', raw_record_hash: 'b'.repeat(64) }], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 8_000_000, detector_options: { accepted_student_names: ['Alice', 'Bob'] } });
  assert.equal(noMatch.counts.runtime_comparison.nodes_confirmed_questions, 0);
  const malformed = buildRestrictedShard({ row, transcript, nodes: [null, { nope: true }], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 8_000_000, detector_options: { accepted_student_names: ['Alice', 'Bob'] } });
  assert.equal(malformed.counts.runtime_comparison.nodes_confirmed_questions, 0);
});

test('STATE0 excludes multiple jumping-in answer exchanges and absent phrase remains clean', () => {
  const opening = [
    { ...transcript[0], text: 'Jumping in: what is the diagnosis?' },
    transcript[1],
    { ...transcript[0], record_ordinal: 2, start_us: 2_000_000, text: 'Jumping in again: which drug?' },
    { ...transcript[1], record_ordinal: 3, start_us: 3_000_000 },
    { ...transcript[2], record_ordinal: 4, start_us: 4_000_000 },
  ];
  const detected = detectGoldCandidates(opening, { accepted_student_names: ['Alice'] });
  assert.equal(detected.jumping.excluded_answer_exchange_count, 2);
  assert.equal(detected.jumping.spans.length, 4);
  const absent = detectGoldCandidates(transcript.slice(2), { accepted_student_names: ['Alice', 'Bob'] });
  assert.equal(absent.jumping.detected, false);
  assert.equal(absent.jumping.excluded_answer_exchange_count, 0);
});

test('self-answer and next-student interruption do not invent student answer spans', () => {
  const records = [
    transcript[2],
    { ...transcript[9], record_ordinal: 3, start_us: 3_000_000, text: 'The heart disease is cardiomyopathy.' },
    { ...transcript[7], record_ordinal: 4, start_us: 4_000_000 },
  ];
  const value = buildRestrictedShard({ row, transcript: records, nodes: [], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 8_000_000, detector_options: { accepted_student_names: ['Alice', 'Bob'] } });
  assert.equal(value.questions.at(-1).answer_binding_status, 'NO_ANSWER_OBSERVED');
  assert.equal(value.questions[1].answer_binding_status, 'DR_J_SELF_ANSWER');
  assert.equal(value.questions[1].student_answer_span_ids.length, 0);
});

test('one-on-one Dr J transcript opens one implicit ambiguous session without invented call wording', () => {
  const records = [
    { ...transcript[2], text: 'What heart disease causes this?', speaker: 'Dr. J' },
    { ...transcript[3], speaker: 'Solo Learner' },
    { ...transcript[4], text: 'Which drug treats it?', speaker: 'Dr. J' },
    { ...transcript[5], speaker: 'Solo Learner' },
  ];
  const value = buildRestrictedShard({ row, transcript: records, nodes: [], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 8_000_000, detector_options: { accepted_student_names: deriveAcceptedStudentNames(records) } });
  assert.equal(value.student_call_sequences.length, 1);
  assert.equal(value.student_call_sequences[0].roster_match_status, 'AMBIGUOUS_NAME');
  assert.ok(value.student_call_sequences[0].ambiguity_flags.includes('IMPLICIT_SESSION_SEQUENCE'));
  assert.ok(value.questions.every((question) => question.medical_question_status === 'AMBIGUOUS_RETAINED_QUARANTINED'));
  assert.equal(value.processing_status, 'COMPLETE_WITH_AMBIGUITY');
  assert.equal(validateShardSemantics(value).valid, true);
});

test('dominant generic unknown instructor requires convergent calls, alternation, and medical prompts', () => {
  const records = [];
  for (let index = 0; index < 13; index += 1) {
    const text = index === 0 ? 'Alice, what heart disease causes pain?' : index === 5 ? 'Alice, which drug treats infection?' : index % 3 === 0 ? 'What else?' : 'Teaching context.';
    records.push({ ...transcript[2], record_ordinal: index * 2, start_us: index * 2_000_000, end_us: index * 2_000_000 + 500_000, speaker: 'unknown', text });
    if (index === 0 || index === 5) records.push({ ...transcript[3], record_ordinal: index * 2 + 1, start_us: index * 2_000_000 + 600_000, speaker: 'Alice Smith', text: 'Answer.' });
  }
  const names = deriveAcceptedStudentNames(records);
  const resolution = resolveInstructor(records, ['Dr. J'], names);
  assert.equal(resolution?.speaker_class, 'PROBABLE_DR_J');
  const value = buildRestrictedShard({ row, transcript: records, nodes: [], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 30_000_000, detector_options: { accepted_student_names: names } });
  assert.ok(value.questions.length > 0);
  assert.ok(value.questions.every((question) => question.speaker_class === 'PROBABLE_DR_J' && question.medical_question_status === 'AMBIGUOUS_RETAINED_QUARANTINED'));
  assert.equal(validateShardSemantics(value).valid, true);
  const noConvergence = records.map((record) => ({ ...record, text: record.speaker === 'unknown' ? 'What heart disease?' : record.text }));
  assert.equal(resolveInstructor(noConvergence, ['Dr. J'], names), null);
});

test('punctuation, tag acknowledgments, audience solicitation and navigation never promote', () => {
  const records = [
    { ...transcript[2], text: 'Alice, what heart disease causes pain?' },
    transcript[3],
    { ...transcript[4], text: 'Okay?' },
    { ...transcript[4], record_ordinal: 5, text: 'Questions, anybody?' },
    { ...transcript[4], record_ordinal: 6, text: '?' },
    { ...transcript[4], record_ordinal: 7, text: 'First sentence?' },
    { ...transcript[4], record_ordinal: 8, text: 'Which is?' },
  ];
  const detected = detectGoldCandidates(records, { accepted_student_names: ['Alice'] });
  assert.equal(detected.sequences[0].questions.length, 1);
  assert.ok(detected.excluded.some((item) => item.category === 'BANTER'));
  assert.ok(detected.excluded.some((item) => item.category === 'ADMINISTRATION'));
  assert.ok(detected.excluded.some((item) => item.category === 'NONMEDICAL_INSTRUCTION'));
});

test('mixed instructor records reject trivial subparts at exact clause bindings', () => {
  const records = [
    { ...transcript[2], text: 'Alice, what heart disease causes pain? Okay? Questions, anybody? Which is? Anyone?' },
    transcript[3],
  ];
  const detected = detectGoldCandidates(records, { accepted_student_names: ['Alice'] });
  assert.deepEqual(detected.sequences[0].questions.map((question) => question.text), ['what heart disease causes pain?']);
  const rejected = detected.excluded.filter((item) => ['BANTER', 'ADMINISTRATION', 'NONMEDICAL_INSTRUCTION'].includes(item.category));
  assert.equal(rejected.length, 4);
  assert.ok(rejected.every((item) => item.bindings.length === 1 && item.bindings[0].text_codepoint_end > item.bindings[0].text_codepoint_start));
  assert.equal(new Set(rejected.map((item) => `${item.bindings[0].text_codepoint_start}:${item.bindings[0].text_codepoint_end}`)).size, 4);
});

test('safe aggregate asserts zero forbidden retained prompt classes without exporting wording', () => {
  const clean = shard();
  assert.deepEqual(auditForbiddenRetainedPrompts([clean]), { passed: true, forbidden_retained_prompt_count: 0, forbidden_class_counts: { ADMINISTRATION: 0, BANTER: 0, NONMEDICAL_INSTRUCTION: 0, TEACHING_STATEMENT: 0 } });
  const contaminated = structuredClone(clean);
  contaminated.questions[0].verbatim_oral_question = 'Okay?';
  assert.deepEqual(auditForbiddenRetainedPrompts([contaminated]), { passed: false, forbidden_retained_prompt_count: 1, forbidden_class_counts: { ADMINISTRATION: 0, BANTER: 1, NONMEDICAL_INSTRUCTION: 0, TEACHING_STATEMENT: 0 } });
});

test('shared eligibility predicate separates ambiguity from answer-target eligibility', () => {
  const options = { accepted_student_names: ['Alice'], has_prior_eligible_question: true };
  for (const text of ['What bug?', 'Which test?', 'How present?', 'Otherwise known as?', 'Viral or bacterial?', 'What else?']) {
    assert.equal(classifyPromptEligibility(text, options).eligible, true, text);
  }
  const rejected = new Map([
    ['You would give antibiotics, right?', 'BANTER'],
    ['What antibiotic would you give, right?', 'BANTER'],
    ['Good, Alice?', 'BANTER'],
    ['Why?', 'NONMEDICAL_INSTRUCTION'],
    ['Which is?', 'NONMEDICAL_INSTRUCTION'],
    ['Where do I find the slide?', 'ADMINISTRATION'],
    ['Where were we?', 'ADMINISTRATION'],
    ['I want to know what treatment', 'TEACHING_STATEMENT'],
    ['Tell me?', 'NONMEDICAL_INSTRUCTION'],
  ]);
  for (const [text, category] of rejected) {
    const result = classifyPromptEligibility(text, options);
    assert.equal(result.eligible, false, text);
    assert.equal(result.category, category, text);
  }
  assert.equal(classifyPromptEligibility('What else?', { ...options, has_prior_eligible_question: false }).eligible, false);
  assert.equal(classifyPromptEligibility('Describe treatment', options).eligible, true);
});

test('bounded feedback, context and vocatives preserve real questions without reopening teaching', () => {
  const options = { accepted_student_names: ['Alice'], has_prior_eligible_question: true };
  for (const text of [
    'Great work, Alice, what bug?',
    'Given the clinical context, which test?',
    'This patient has pneumonia. How present?',
    'What bug',
    'Describe the disease',
  ]) assert.equal(classifyPromptEligibility(text, options).eligible, true, text);
  for (const text of [
    'I spent the last several minutes teaching everyone what treatment means?',
    'Remember that I explained what treatment means?',
    'Pneumonia is a disease. Alice?',
    'Nice work. Okay?',
  ]) assert.equal(classifyPromptEligibility(text, options).eligible, false, text);

  const records = [
    { ...transcript[2], text: 'Alice, what heart disease causes pain?' },
    transcript[3],
    { ...transcript[4], text: 'Great work, Alice, which test?' },
    { ...transcript[4], record_ordinal: 5, text: 'I explained what treatment means?' },
    { ...transcript[4], record_ordinal: 6, text: 'What bug' },
  ];
  const detected = detectGoldCandidates(records, { accepted_student_names: ['Alice'] });
  assert.deepEqual(detected.sequences[0].questions.map((question) => question.text), [
    'what heart disease causes pain?',
    'Great work, Alice, which test?',
    'What bug',
  ]);
  assert.ok(detected.excluded.some((item) => ['UNBOUNDED_DECLARATIVE_PREFIX', 'DECLARATIVE_TEACHING_WITH_EMBEDDED_WH'].includes(item.basis)));
});

test('eligibility clause binding keeps detector and validator identical for multi-sentence context', () => {
  const records = [
    { ...transcript[2], text: 'Alice, where do I begin. What heart disease causes pain?' },
    transcript[3],
  ];
  const value = buildRestrictedShard({ row, transcript: records, nodes: [], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 8_000_000, detector_options: { accepted_student_names: ['Alice'] } });
  assert.equal(value.questions.length, 1);
  assert.ok(value.questions[0].eligibility_clause_codepoint_start > 0);
  assert.ok(value.questions[0].eligibility_clause_codepoint_end <= [...value.questions[0].verbatim_oral_question].length);
  assert.equal(value.questions[0].transcript_segment_bindings.length, 2);
  const [fullBinding, eligibilityBinding] = value.questions[0].transcript_segment_bindings;
  assert.equal(eligibilityBinding.raw_record_hash, fullBinding.raw_record_hash);
  assert.equal(eligibilityBinding.text_codepoint_start, fullBinding.text_codepoint_start + value.questions[0].eligibility_clause_codepoint_start);
  assert.equal(eligibilityBinding.text_codepoint_end, fullBinding.text_codepoint_start + value.questions[0].eligibility_clause_codepoint_end);
  assert.notEqual(eligibilityBinding.selected_text_hash, fullBinding.selected_text_hash);
  assert.equal(validateShardSemantics(value).valid, true);
});

test('full-source coaching and logistics exclusions never reach emitted shards', () => {
  const records = [
    { ...transcript[2], text: 'Alice, what heart disease causes pain?' },
    transcript[3],
    { ...transcript[4], text: 'Use this case for coaching. What clue in the vignette gives it away?' },
    { ...transcript[4], record_ordinal: 5, text: 'Look at this case. Which line in the stem tells you what?' },
    { ...transcript[4], record_ordinal: 6, text: 'The patient is young. Does the age matter for this question?' },
    { ...transcript[4], record_ordinal: 7, text: 'Before we continue, how many more drills?' },
    { ...transcript[4], record_ordinal: 8, text: 'Before cardiology, did you study for this session?' },
    { ...transcript[4], record_ordinal: 9, text: 'Are we going to finish the review session today?' },
  ];
  const value = buildRestrictedShard({ row, transcript: records, nodes: [], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 12_000_000, detector_options: { accepted_student_names: ['Alice'] } });
  assert.equal(value.questions.length, 1);
  assert.equal(value.questions[0].verbatim_oral_question, 'what heart disease causes pain?');
  assert.equal(validateShardSemantics(value).valid, true);
  assert.equal(auditForbiddenRetainedPrompts([value]).passed, true);
});

test('v7 semantic exceptions are subtractively excluded from emitted shards', () => {
  const records = [
    { ...transcript[2], text: 'Alice, what heart disease causes pain?' },
    transcript[3],
    { ...transcript[4], text: 'Vanessa, and who was me too?' },
    { ...transcript[4], record_ordinal: 5, text: 'What questions are you doing?' },
    { ...transcript[4], record_ordinal: 6, text: 'You are pushing too hard to know it in the first sentence. What do I know?' },
    { ...transcript[4], record_ordinal: 7, text: 'Does a 35-year-old male farmer mean he is a tough guy?' },
    { ...transcript[4], record_ordinal: 8, text: 'Why did I go through this craziness?' },
  ];
  const detected = detectGoldCandidates(records, { accepted_student_names: ['Alice'] });
  assert.deepEqual(detected.sequences[0].questions.map((question) => question.text), ['what heart disease causes pain?']);
  assert.deepEqual(new Set(detected.excluded.map((item) => item.basis)), new Set([
    'GARBLED_STUDENT_SELECTION',
    'QUESTION_SET_ACTIVITY_META',
    'SENTENCE_METACOGNITIVE_COACHING',
    'DEMOGRAPHIC_TOUGHNESS_RHETORIC',
    'SELF_REFERENTIAL_CONVERSATIONAL_RHETORIC',
  ]));
  const value = buildRestrictedShard({ row, transcript: records, nodes: [], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 12_000_000, detector_options: { accepted_student_names: ['Alice'] } });
  assert.equal(value.questions.length, 1);
  assert.equal(validateShardSemantics(value).valid, true);
  assert.equal(auditForbiddenRetainedPrompts([value]).passed, true);
});

test('active sequences retain long-context terminal answer slots but not long teaching, tag, or meta prompts', () => {
  const active = { accepted_student_names: ['Alice'], has_prior_eligible_question: true, active_student_sequence: true };
  for (const text of [
    'The patient has fever, hypotension, a new murmur, and embolic findings and presents how?',
    'After reviewing the complete infectious differential and the blood culture pattern this is due to what?',
    'The patient has a long clinical history with fever and progressive pain what test?',
  ]) assert.equal(classifyPromptEligibility(text, active).eligible, true, text);
  const negatives = [
    ['I explained throughout the lecture what treatment means?', 'TEACHING_STATEMENT'],
    ['The patient receives antibiotics and improves, right?', 'BANTER'],
    ['After this long discussion where were we on the slide?', 'ADMINISTRATION'],
    ['The patient has fever and a long history what test', 'TEACHING_STATEMENT'],
    ['Did you study the diagnosis?', 'NONMEDICAL_INSTRUCTION'],
    ['Are you sure you know the answer?', 'NONMEDICAL_INSTRUCTION'],
    ['How many questions did I ask?', 'ADMINISTRATION'],
    ['Is that the correct answer?', 'BANTER'],
  ];
  for (const [text, category] of negatives) {
    const result = classifyPromptEligibility(text, active);
    assert.equal(result.eligible, false, text);
    assert.equal(result.category, category, text);
  }

  const records = [
    { ...transcript[2], text: 'Alice, what heart disease causes pain?' },
    transcript[3],
    { ...transcript[4], text: 'The patient has fever, hypotension, a murmur, embolic findings, and presents how?' },
    { ...transcript[4], record_ordinal: 5, text: 'I explained throughout the lecture what treatment means?' },
  ];
  const detected = detectGoldCandidates(records, { accepted_student_names: ['Alice'] });
  assert.equal(detected.sequences[0].questions.length, 2);
  assert.equal(detected.sequences[0].questions[1].eligibility_basis, 'TERMINAL_CLINICAL_ANSWER_SLOT');
  assert.ok(detected.excluded.some((item) => item.basis === 'DECLARATIVE_TEACHING_WITH_EMBEDDED_WH'));
});

test('short and elliptical oral-exam slots recover only inside answer-bearing sequence context', () => {
  const active = { accepted_student_names: ['Alice'], has_prior_eligible_question: true, active_student_sequence: true };
  const eligible = new Map([
    ['A patient with progressive weakness, where?', 'TERMINAL_ELLIPTICAL_ANSWER_SLOT'],
    ['The next diagnostic test?', 'MEDICAL_DIRECT_QUESTION'],
    ['And if it is gram positive?', 'ELLIPTICAL_COPULAR_OR_AUXILIARY_TARGET'],
    ['The diagnosis here is bacterial?', 'MEDICAL_DIRECT_QUESTION'],
    ['And inherited risk factors?', 'ELLIPTICAL_EXAM_NOUN_PHRASE'],
    ['A diffusion, ventilation, or perfusion mismatch?', 'ELLIPTICAL_EXAM_NOUN_PHRASE'],
  ]);
  for (const [text, basis] of eligible) {
    const result = classifyPromptEligibility(text, active);
    assert.equal(result.eligible, true, text);
    assert.equal(result.basis, basis, text);
  }
  assert.equal(classifyPromptEligibility('Why?', active).eligible, false);
  assert.equal(classifyPromptEligibility('A patient with progressive weakness, where?', { ...active, active_student_sequence: false }).eligible, false);

  const hardExclusions = new Map([
    ['When I was studying, what was my score?', 'KNOWLEDGE_OR_STUDY_CHECK'],
    ['How am I doing on these questions?', 'QUESTION_COUNT_OR_COMPARISON_META'],
    ['Where are we in this vignette?', 'VIGNETTE_POSITION_META'],
    ['What line in the vignette?', 'VIGNETTE_POSITION_META'],
    ['Would changing this pathology change the diagnosis?', 'RHETORICAL_PATHOLOGY_CHANGE'],
    ['Is that right?', 'GENERIC_ANSWER_META'],
  ]);
  for (const [text, basis] of hardExclusions) {
    const result = classifyPromptEligibility(text, active);
    assert.equal(result.eligible, false, text);
    assert.equal(result.basis, basis, text);
  }
});

test('bounded risk-factor and pulmonary-process targets survive emitted-shard construction', () => {
  const records = [
    { ...transcript[2], text: 'Alice, what heart disease causes pain?' },
    transcript[3],
    { ...transcript[4], text: 'And inherited risk factors?' },
    { ...transcript[3], record_ordinal: 5, text: 'Smoking.' },
    { ...transcript[4], record_ordinal: 6, text: 'A diffusion, ventilation, or perfusion mismatch?' },
  ];
  const value = buildRestrictedShard({ row, transcript: records, nodes: [], run_contract_hash: contractHash, drill_start_us: 0, drill_end_us: 12_000_000, detector_options: { accepted_student_names: ['Alice'] } });
  assert.equal(value.questions.length, 3);
  assert.deepEqual(value.questions.slice(1).map((question) => question.eligibility_basis), [
    'ELLIPTICAL_EXAM_NOUN_PHRASE',
    'ELLIPTICAL_EXAM_NOUN_PHRASE',
  ]);
  assert.equal(validateShardSemantics(value).valid, true);
});
