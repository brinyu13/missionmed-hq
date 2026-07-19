import {
  contentAddressedEnvelope, deterministicId, orderedRoot, stableHash, verifyContentAddressedEnvelope,
} from './canonical.mjs';
import { safeProjectionFromShard } from './build-gold-shard.mjs';
import { SCHEMA } from './constants.mjs';
import { classifyFullSourceExclusion, classifyPromptEligibility } from './gold-detector.mjs';

function root(bindings) {
  return orderedRoot(bindings.map((binding) => ({
    order: binding.record_ordinal,
    raw_record_hash: binding.raw_record_hash,
    selected_text_hash: binding.selected_text_hash,
  })), 'missionmed.i1q.1008f.transcript-bindings.v1');
}

export function validateShardSemantics(shard, expected = {}) {
  const errors = [];
  const fail = (code) => errors.push(code);
  if (!verifyContentAddressedEnvelope(shard)) fail('shard_content_hash_invalid');
  if (shard.schema_version !== SCHEMA.shard) fail('shard_schema_version_invalid');
  if (expected.run_contract_hash && shard.run_contract_hash !== expected.run_contract_hash) fail('contract_drift');
  if (expected.transcript_sha256 && shard.transcript_sha256 !== expected.transcript_sha256) fail('transcript_pair_substitution');
  if (expected.nodes_sha256 && shard.nodes_sha256 !== expected.nodes_sha256) fail('nodes_pair_substitution');
  if (expected.drill_order && shard.drill_order !== expected.drill_order) fail('drill_position_substitution');
  const drillId = deterministicId('drill', SCHEMA.shard, shard.transcript_sha256, shard.nodes_sha256);
  if (shard.drill_id !== drillId) fail('drill_id_invalid');
  if (shard.shard_id !== deterministicId('shard', shard.run_contract_hash, drillId)) fail('shard_id_invalid');

  const sequenceIds = new Set();
  const questionIds = new Set();
  shard.student_call_sequences.forEach((sequence, index) => {
    if (!verifyContentAddressedEnvelope(sequence)) fail('sequence_content_hash_invalid');
    if (sequence.sequence_order !== index + 1) fail('sequence_order_noncontiguous');
    const callRoot = root(sequence.student_call_transcript_bindings);
    if (callRoot !== sequence.student_call_binding_root) fail('student_call_binding_root_invalid');
    const id = deterministicId('sequence', drillId, sequence.sequence_order, callRoot);
    if (id !== sequence.sequence_id || sequenceIds.has(id)) fail('sequence_id_invalid');
    sequenceIds.add(id);
    if (sequence.question_ids[0] !== sequence.primary_question_id) fail('primary_id_join_invalid');
    if (sequence.roster_match_status === 'AMBIGUOUS_NAME' && sequence.ambiguity_flags.length === 0) fail('ambiguous_sequence_flag_missing');
  });
  shard.questions.forEach((question, index) => {
    if (!verifyContentAddressedEnvelope(question)) fail('question_content_hash_invalid');
    if (question.question_order_in_drill !== index + 1) fail('question_order_noncontiguous');
    if (!sequenceIds.has(question.sequence_id)) fail('question_sequence_join_invalid');
    if (!question.transcript_segment_bindings.length) fail('question_transcript_provenance_missing');
    const sequence = shard.student_call_sequences.find((item) => item.sequence_id === question.sequence_id);
    const priorInSequence = shard.questions.some((item) => item.sequence_id === question.sequence_id && item.question_order_in_sequence < question.question_order_in_sequence);
    const questionCodepoints = [...question.verbatim_oral_question];
    if (question.eligibility_clause_codepoint_start < 0 || question.eligibility_clause_codepoint_end > questionCodepoints.length || question.eligibility_clause_codepoint_start >= question.eligibility_clause_codepoint_end) fail('eligibility_clause_bounds_invalid');
    const eligibilityClause = questionCodepoints.slice(question.eligibility_clause_codepoint_start, question.eligibility_clause_codepoint_end).join('');
    const fullQuestionExclusion = classifyFullSourceExclusion(question.verbatim_oral_question);
    const eligibility = classifyPromptEligibility(eligibilityClause, { accepted_student_names: sequence ? [sequence.called_student_alias] : [], has_prior_eligible_question: priorInSequence, active_student_sequence: Boolean(sequence) });
    if (fullQuestionExclusion || !eligibility.eligible) fail('forbidden_retained_prompt_class');
    if (eligibility.basis !== question.eligibility_basis) fail('eligibility_basis_invalid');
    if (question.speaker_class === 'PROBABLE_DR_J') {
      if (question.speaker_authority_class !== 'INFERRED_INSTRUCTOR_AMBIGUOUS') fail('inferred_instructor_authority_invalid');
      if (question.medical_question_status !== 'AMBIGUOUS_RETAINED_QUARANTINED' || !question.ambiguity_flags.includes('INSTRUCTOR_DIARIZATION_INFERRED')) fail('inferred_instructor_quarantine_missing');
    }
    const bindingRoot = root(question.transcript_segment_bindings);
    if (bindingRoot !== question.transcript_binding_root) fail('question_binding_root_invalid');
    if (question.nodes_bindings.length === 0 && question.nodes_binding_root !== null) fail('nodes_binding_root_invalid');
    if (question.nodes_bindings.length > 0) {
      const nodesRoot = orderedRoot(question.nodes_bindings.map((binding) => ({ order: binding.record_ordinal, raw_record_hash: binding.raw_record_hash, relationship: binding.relationship })), 'missionmed.i1q.1008f.nodes-bindings.v1');
      if (nodesRoot !== question.nodes_binding_root) fail('nodes_binding_root_invalid');
    }
    if (question.provenance_hash !== stableHash({ transcript_sha256: shard.transcript_sha256, root: bindingRoot })) fail('question_provenance_hash_invalid');
    const id = deterministicId('question', drillId, question.sequence_id, question.question_order_in_sequence, question.question_role, bindingRoot);
    if (id !== question.question_id || questionIds.has(id)) fail('question_id_invalid');
    questionIds.add(id);
    if (question.start_timestamp_us < shard.drill_start_us || question.end_timestamp_us > shard.drill_end_us) fail('question_outside_drill_bounds');
  });
  for (const sequence of shard.student_call_sequences) {
    const joined = shard.questions.filter((question) => question.sequence_id === sequence.sequence_id);
    if (joined.length === 0 || joined[0].question_role !== 'PRIMARY' || joined[0].question_order_in_sequence !== 1) fail('sequence_primary_cardinality_invalid');
    if (joined.filter((q) => q.question_role === 'PRIMARY').length !== 1) fail('sequence_primary_cardinality_invalid');
    if (stableHash(sequence.question_ids) !== stableHash(joined.map((q) => q.question_id))) fail('sequence_question_order_join_invalid');
    if (stableHash(sequence.follow_up_question_ids) !== stableHash(joined.filter((q) => q.question_role === 'FOLLOW_UP').map((q) => q.question_id))) fail('follow_up_join_invalid');
    if (joined.some((question, index) => question.question_order_in_sequence !== index + 1)) fail('question_sequence_order_noncontiguous');
    for (const question of joined) {
      const joinedAnswers = shard.student_answer_spans.filter((answer) => answer.responding_to_question_id === question.question_id).map((answer) => answer.student_answer_span_id);
      if (stableHash(question.student_answer_span_ids) !== stableHash(joinedAnswers)) fail('question_answer_span_join_invalid');
    }
  }
  shard.student_answer_spans.forEach((answer) => {
    if (!verifyContentAddressedEnvelope(answer)) fail('answer_content_hash_invalid');
    const question = shard.questions.find((item) => item.question_id === answer.responding_to_question_id);
    if (!question || question.sequence_id !== answer.sequence_id) fail('answer_question_join_invalid');
    const bindingRoot = root(answer.transcript_segment_bindings);
    if (bindingRoot !== answer.transcript_binding_root) fail('answer_binding_root_invalid');
    if (answer.provenance_hash !== stableHash({ transcript_sha256: shard.transcript_sha256, root: bindingRoot })) fail('answer_provenance_hash_invalid');
    const id = deterministicId('answer', drillId, answer.sequence_id, answer.responding_to_question_id, answer.answer_order_for_question, bindingRoot);
    if (id !== answer.student_answer_span_id) fail('answer_id_invalid');
    if (answer.start_timestamp_us < shard.drill_start_us || answer.end_timestamp_us > shard.drill_end_us) fail('answer_outside_drill_bounds');
  });
  for (const question of shard.questions) {
    const joinedAnswers = shard.student_answer_spans.filter((answer) => answer.responding_to_question_id === question.question_id);
    if (joinedAnswers.some((answer, index) => answer.answer_order_for_question !== index + 1)) fail('answer_order_noncontiguous');
  }
  if (shard.counts.sequences !== shard.student_call_sequences.length) fail('sequence_count_invalid');
  if (!verifyContentAddressedEnvelope(shard.jumping_in_exclusion)) fail('jumping_content_hash_invalid');
  if (shard.counts.primary_questions !== shard.student_call_sequences.length) fail('primary_count_invalid');
  if (shard.counts.total_questions !== shard.questions.length) fail('question_count_invalid');
  if (shard.counts.ambiguous_questions !== shard.questions.filter((question) => question.medical_question_status === 'AMBIGUOUS_RETAINED_QUARANTINED').length) fail('ambiguous_question_count_invalid');
  if (shard.counts.ambiguous_questions > 0 && shard.processing_status !== 'COMPLETE_WITH_AMBIGUITY') fail('ambiguous_processing_status_invalid');
  if (shard.counts.runtime_comparison.nodes_confirmed_questions !== shard.questions.filter((question) => question.nodes_bindings.length > 0).length) fail('runtime_comparison_count_invalid');
  if (shard.counts.total_questions !== shard.counts.primary_questions + shard.counts.follow_up_questions) fail('question_arithmetic_invalid');
  if (shard.provenance_root !== stableHash({ transcript_sha256: shard.transcript_sha256, nodes_sha256: shard.nodes_sha256 })) fail('provenance_root_invalid');
  const retainedOrdinals = new Set(shard.questions.flatMap((question) => question.transcript_segment_bindings.map((binding) => binding.record_ordinal)));
  if (shard.jumping_in_exclusion.exchange_spans.some((binding) => retainedOrdinals.has(binding.record_ordinal))) fail('jumping_in_overlap_retained_question');
  if (shard.ordered_sequence_root !== orderedRoot(shard.student_call_sequences.map((x) => ({ order: x.sequence_order, id: x.sequence_id, content_hash: x.content_hash })))) fail('ordered_sequence_root_invalid');
  if (shard.ordered_question_root !== orderedRoot(shard.questions.map((x) => ({ order: x.question_order_in_drill, id: x.question_id, content_hash: x.content_hash })))) fail('ordered_question_root_invalid');
  if (shard.ordered_answer_span_root !== orderedRoot(shard.student_answer_spans.map((x) => ({ order: x.answer_order_for_question, id: x.student_answer_span_id, content_hash: x.content_hash })))) fail('ordered_answer_root_invalid');
  if (shard.safe_projection_hash !== stableHash(safeProjectionFromShard(shard))) fail('safe_projection_join_invalid');
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

export function validateCompletion(shards, roster, runContractHash) {
  const errors = [];
  if (roster.length !== 97 || shards.length !== 97) errors.push('false_97_completion_claim');
  const orders = shards.map((shard) => shard.drill_order);
  if (new Set(orders).size !== orders.length) errors.push('duplicate_drill_position');
  for (let index = 0; index < roster.length; index += 1) {
    const shard = shards.find((item) => item.drill_order === index + 1);
    if (!shard) { errors.push('missing_drill_position'); continue; }
    const result = validateShardSemantics(shard, { ...roster[index], run_contract_hash: runContractHash, drill_order: index + 1 });
    errors.push(...result.errors.map((code) => `drill_${index + 1}:${code}`));
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

export function finalizeShardEngineeringValidation(draft) {
  const draftValidation = validateShardSemantics(draft, { run_contract_hash: draft.run_contract_hash, transcript_sha256: draft.transcript_sha256, nodes_sha256: draft.nodes_sha256, drill_order: draft.drill_order });
  if (!draftValidation.valid) throw new Error(`draft_semantic_validation_failed:${draftValidation.errors.join(',')}`);
  const finalized = structuredClone(draft);
  const status = finalized.counts.ambiguous_questions > 0 ? 'ENGINEERING_VERIFIED_WITH_AMBIGUITY' : 'ENGINEERING_VERIFIED';
  finalized.student_call_sequences = finalized.student_call_sequences.map((sequence) => contentAddressedEnvelope({ ...sequence, validation_status: status }));
  finalized.ordered_sequence_root = orderedRoot(finalized.student_call_sequences.map((sequence) => ({ order: sequence.sequence_order, id: sequence.sequence_id, content_hash: sequence.content_hash })));
  finalized.validation_status = status;
  finalized.validation_receipt_bindings = [stableHash({ schema_version: 'missionmed.i1q.1008f.engineering-validation-receipt.v1', draft_content_hash: draft.content_hash, validator: 'semantic-validator.mjs', result: 'PASS' })];
  finalized.safe_projection_hash = stableHash(safeProjectionFromShard(finalized));
  return contentAddressedEnvelope(finalized);
}
