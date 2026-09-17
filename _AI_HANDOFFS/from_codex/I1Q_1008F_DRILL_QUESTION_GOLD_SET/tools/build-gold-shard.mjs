import {
  contentAddressedEnvelope, deterministicId, orderedRoot, sortedUnique, stableHash,
} from './canonical.mjs';
import { detectGoldCandidates } from './gold-detector.mjs';
import { REJECTION_CATEGORIES, SCHEMA } from './constants.mjs';

function bindingRoot(bindings) {
  return orderedRoot(bindings.map((binding) => ({
    order: binding.record_ordinal,
    raw_record_hash: binding.raw_record_hash,
    selected_text_hash: binding.selected_text_hash,
  })), 'missionmed.i1q.1008f.transcript-bindings.v1');
}

function withHash(value) { return contentAddressedEnvelope(value); }

function normalizedPrompt(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function corroborate(question, nodes) {
  const q = normalizedPrompt(question.text);
  const qTokens = new Set(q.split(' ').filter(Boolean));
  let best = null;
  for (const node of nodes ?? []) {
    if (!node || !Number.isSafeInteger(node.record_ordinal) || typeof node.text !== 'string' || typeof node.raw_record_hash !== 'string') continue;
    const overlaps = (node.start_us ?? 0) <= question.end_us && (node.end_us ?? node.start_us ?? 0) >= question.start_us;
    if (!overlaps) continue;
    const n = normalizedPrompt(node.text);
    const nTokens = new Set(n.split(' ').filter(Boolean));
    const shared = [...qTokens].filter((token) => nTokens.has(token)).length;
    const union = new Set([...qTokens, ...nTokens]).size || 1;
    const score = q === n ? 1 : shared / union;
    if (score >= 0.6 && (!best || score > best.score || (score === best.score && node.record_ordinal < best.node.record_ordinal))) best = { node, score, exact: q === n };
  }
  if (!best) return { bindings: [], root: null };
  const bindings = [{ record_ordinal: best.node.record_ordinal, node_start_us: best.node.start_us ?? 0, node_end_us: best.node.end_us, raw_record_hash: best.node.raw_record_hash, relationship: best.exact ? 'QUESTION_CONFIRMATION' : 'RUNTIME_COMPARISON_ONLY' }];
  return { bindings, root: orderedRoot(bindings.map((binding) => ({ order: binding.record_ordinal, raw_record_hash: binding.raw_record_hash, relationship: binding.relationship })), 'missionmed.i1q.1008f.nodes-bindings.v1') };
}

export function buildRestrictedShard(input) {
  const { row, transcript, run_contract_hash } = input;
  const drillId = deterministicId('drill', SCHEMA.shard, row.transcript_sha256, row.nodes_sha256);
  const detected = detectGoldCandidates(transcript, input.detector_options ?? {});
  const questions = [];
  const answers = [];
  const sequences = [];

  detected.sequences.forEach((candidate, sequenceIndex) => {
    const sequenceOrder = sequenceIndex + 1;
    const callRoot = bindingRoot(candidate.call_bindings);
    const sequenceId = deterministicId('sequence', drillId, sequenceOrder, callRoot);
    const questionIds = [];
    candidate.questions.forEach((question, questionIndex) => {
      const binding = [question.binding];
      if (question.eligibility_binding.selected_text_hash !== question.binding.selected_text_hash
          || question.eligibility_binding.text_codepoint_start !== question.binding.text_codepoint_start
          || question.eligibility_binding.text_codepoint_end !== question.binding.text_codepoint_end) {
        binding.push(question.eligibility_binding);
      }
      const root = bindingRoot(binding);
      const role = questionIndex === 0 ? 'PRIMARY' : 'FOLLOW_UP';
      const questionId = deterministicId('question', drillId, sequenceId, questionIndex + 1, role, root);
      questionIds.push(questionId);
      const nodeEvidence = corroborate(question, input.nodes);
      questions.push(withHash({
        schema_version: SCHEMA.question,
        question_id: questionId,
        drill_id: drillId,
        sequence_id: sequenceId,
        question_order_in_drill: questions.length + 1,
        question_order_in_sequence: questionIndex + 1,
        question_role: role,
        origin_class: 'DR_J_ASKED_MEDICAL_PROMPT',
        question_form: question.form,
        verbatim_oral_question: question.text,
        eligibility_clause_codepoint_start: question.eligibility_clause_codepoint_start,
        eligibility_clause_codepoint_end: question.eligibility_clause_codepoint_end,
        eligibility_basis: question.eligibility_basis,
        minimally_normalized_question: null,
        wording_status: 'VERBATIM_ONLY',
        normalization_operations: [],
        start_timestamp_us: question.start_us,
        end_timestamp_us: question.end_us,
        speaker_class: candidate.speaker_class,
        speaker_authority_class: candidate.speaker_authority_class,
        inclusion_basis_codes: sortedUnique(['INSTRUCTOR_PROMPT', 'STUDENT_CALL_SEQUENCE', ...candidate.sequence_basis_codes]),
        answer_binding_status: question.answers.length ? 'BOUND' : question.self_answer ? 'DR_J_SELF_ANSWER' : question.interrupted ? 'INTERRUPTED_BY_NEXT_STUDENT' : 'NO_ANSWER_OBSERVED',
        student_answer_span_ids: [],
        transcript_segment_bindings: binding,
        transcript_binding_root: root,
        nodes_bindings: nodeEvidence.bindings,
        nodes_binding_root: nodeEvidence.root,
        confidence: { score_ppm: candidate.ambiguity_flags.length ? 600000 : 900000, basis_codes: sortedUnique(['DETERMINISTIC_TRANSCRIPT_RULE', ...candidate.sequence_basis_codes]) },
        medical_question_status: question.medical_status,
        ambiguity_flags: candidate.ambiguity_flags,
        provenance_hash: stableHash({ transcript_sha256: row.transcript_sha256, root }),
        review_status: 'UNREVIEWED',
        release_status: 'RESTRICTED_ONLY',
      }));
      const builtQuestion = questions.at(-1);
      question.answers.forEach((answer, answerIndex) => {
        const targetId = questionId;
        const root = bindingRoot([answer.binding]);
        const answerId = deterministicId('answer', drillId, sequenceId, targetId, answerIndex + 1, root);
        answers.push(withHash({
        schema_version: SCHEMA.answer,
        student_answer_span_id: answerId,
        drill_id: drillId,
        sequence_id: sequenceId,
        responding_to_question_id: targetId,
        answer_order_for_question: answerIndex + 1,
        speaker_alias: answer.speaker_alias,
        speaker_relation: answer.speaker_alias === candidate.called_student_alias ? 'CALLED_STUDENT' : 'OTHER_STUDENT',
        start_timestamp_us: answer.start_us,
        end_timestamp_us: answer.end_us,
        transcript_segment_bindings: [answer.binding],
        transcript_binding_root: root,
        boundary_status: answer.start_us < question.end_us ? 'OVERLAPPING' : 'EXACT_TURN_BOUNDARY',
        confidence: { score_ppm: 850000, basis_codes: ['NEXT_NON_INSTRUCTOR_TURN'] },
        ambiguity_flags: answer.start_us < question.end_us ? ['OVERLAPPING_TIMESTAMP'] : [],
        provenance_hash: stableHash({ transcript_sha256: row.transcript_sha256, root }),
        }));
        builtQuestion.student_answer_span_ids.push(answerId);
      });
      Object.assign(builtQuestion, withHash(builtQuestion));
    });
    sequences.push(withHash({
      schema_version: SCHEMA.sequence,
      sequence_id: sequenceId,
      drill_id: drillId,
      sequence_order: sequenceOrder,
      called_student_alias: candidate.called_student_alias,
      roster_match_status: candidate.roster_match_status,
      student_call_timestamp_us: candidate.call_bindings[0].segment_start_us,
      student_call_transcript_bindings: candidate.call_bindings,
      student_call_binding_root: callRoot,
      sequence_start_us: candidate.call_bindings[0].segment_start_us,
      sequence_end_us: Math.max(...candidate.questions.map((q) => q.end_us), ...candidate.questions.flatMap((q) => q.answers.map((a) => a.end_us))),
      primary_question_id: questionIds[0],
      follow_up_question_ids: questionIds.slice(1),
      question_ids: questionIds,
      confidence: { score_ppm: candidate.ambiguity_flags.length ? 650000 : 900000, basis_codes: sortedUnique(['INSTRUCTOR_PROMPT', ...candidate.sequence_basis_codes]) },
      ambiguity_flags: candidate.ambiguity_flags,
      validation_status: 'PENDING',
    }));
  });

  const jumpingRoot = detected.jumping.spans.length ? bindingRoot(detected.jumping.spans) : null;
  const jumping = withHash({
    schema_version: SCHEMA.jumping,
    jumping_in_exclusion_id: deterministicId('jumping', drillId, detected.jumping.decision, jumpingRoot),
    drill_id: drillId,
    decision: detected.jumping.decision,
    jumping_in_detected: detected.jumping.detected,
    jumping_in_excluded: detected.jumping.detected,
    start_timestamp_us: detected.jumping.spans[0]?.segment_start_us ?? null,
    end_timestamp_us: detected.jumping.spans.at(-1)?.segment_end_us ?? null,
    exchange_spans: detected.jumping.spans,
    excluded_prompt_count: detected.excluded.filter((x) => x.category === 'JUMPING_IN').length,
    excluded_answer_exchange_count: detected.jumping.excluded_answer_exchange_count,
    exclusion_basis_codes: detected.jumping.basis_codes,
    transition_record_ordinal: null,
    transcript_binding_root: jumpingRoot,
    confidence: { score_ppm: detected.jumping.detected ? 990000 : 700000, basis_codes: detected.jumping.basis_codes },
    ambiguity_flags: [],
    provenance_hash: stableHash({ transcript_sha256: row.transcript_sha256, jumpingRoot }),
    review_status: 'UNREVIEWED',
  });

  const rejectionCounts = Object.fromEntries(REJECTION_CATEGORIES.map((key) => [key, detected.excluded.filter((item) => item.category === key).length]));
  const ambiguousCount = questions.filter((question) => question.medical_question_status === 'AMBIGUOUS_RETAINED_QUARANTINED').length;
  const completionStatus = ambiguousCount ? 'COMPLETE_WITH_AMBIGUITY' : 'COMPLETE';
  const nodesConfirmed = questions.filter((question) => question.nodes_bindings.length > 0).length;
  const safeProjection = {
    drill_order: row.drill_order,
    processing_status: completionStatus,
    validation_status: 'PENDING',
    jumping_in_detected: jumping.jumping_in_detected,
    jumping_in_excluded: jumping.jumping_in_excluded,
    counts: { sequences: sequences.length, primary_questions: sequences.length, follow_up_questions: questions.length - sequences.length, total_questions: questions.length, ambiguous_questions: ambiguousCount, rejection_classes: rejectionCounts, runtime_comparison: { transcript_questions: questions.length, nodes_confirmed_questions: nodesConfirmed, nodes_unmatched_questions: questions.length - nodesConfirmed, agreement_ppm: questions.length ? Math.floor(nodesConfirmed * 1000000 / questions.length) : 0, authority: 'COMPARISON_ONLY' } },
    duration_us: input.drill_end_us - input.drill_start_us,
  };
  const safeProjectionHash = stableHash(safeProjection);
  return contentAddressedEnvelope({
    schema_version: SCHEMA.shard,
    shard_id: deterministicId('shard', run_contract_hash, drillId),
    run_contract_hash,
    drill_id: drillId,
    drill_order: row.drill_order,
    predecessor_roster_position: row.predecessor_roster_position ?? row.drill_order,
    source_alias: row.source_alias,
    transcript_sha256: row.transcript_sha256,
    nodes_sha256: row.nodes_sha256,
    drill_start_us: input.drill_start_us,
    drill_end_us: input.drill_end_us,
    processing_status: completionStatus,
    jumping_in_exclusion: jumping,
    student_call_sequences: sequences,
    questions,
    student_answer_spans: answers,
    excluded_candidate_decisions: detected.excluded.map((item, index) => ({ decision_order: index + 1, category: item.category, binding_root: bindingRoot(item.bindings) })),
    unresolved_trailing_span: null,
    counts: safeProjection.counts,
    ordered_sequence_root: orderedRoot(sequences.map((x) => ({ order: x.sequence_order, id: x.sequence_id, content_hash: x.content_hash }))),
    ordered_question_root: orderedRoot(questions.map((x) => ({ order: x.question_order_in_drill, id: x.question_id, content_hash: x.content_hash }))),
    ordered_answer_span_root: orderedRoot(answers.map((x) => ({ order: x.answer_order_for_question, id: x.student_answer_span_id, content_hash: x.content_hash }))),
    excluded_candidate_root: orderedRoot(detected.excluded.map((x, index) => ({ order: index + 1, category: x.category, binding_root: bindingRoot(x.bindings) }))),
    provenance_root: stableHash({ transcript_sha256: row.transcript_sha256, nodes_sha256: row.nodes_sha256 }),
    validation_status: 'PENDING',
    validation_receipt_bindings: [],
    blocker: null,
    safe_projection_hash: safeProjectionHash,
  });
}

export function safeProjectionFromShard(shard) {
  return {
    drill_order: shard.drill_order,
    processing_status: shard.processing_status,
    validation_status: shard.validation_status,
    jumping_in_detected: shard.jumping_in_exclusion.jumping_in_detected,
    jumping_in_excluded: shard.jumping_in_exclusion.jumping_in_excluded,
    counts: shard.counts,
    duration_us: shard.drill_end_us - shard.drill_start_us,
  };
}
