import { deterministicId, sha256 } from './hash.mjs';
import { redactText } from './privacy.mjs';

const NON_QUESTION_PATTERNS = [
  /\b(attendance|schedule|microphone|camera|break|hello|good morning)\b/iu,
  /^(right|okay|understood|any questions)\??$/iu,
];

export function normalizeTranscriptArtifact({ video_id, transcript_id, source_hash, segments }) {
  if (!video_id || !transcript_id || !source_hash || !Array.isArray(segments)) {
    throw new Error('invalid_transcript_artifact');
  }
  return segments.map((segment, index) => {
    const text = String(segment.text || '').normalize('NFC').trim();
    const redaction = redactText(text);
    const segmentId = segment.segment_id || deterministicId('segment', {
      transcript_id,
      index,
      start_time: segment.start_time,
      text,
    });
    return {
      video_id,
      transcript_id,
      segment_id: segmentId,
      speaker: segment.speaker || 'unknown',
      speaker_confidence: Number(segment.speaker_confidence || 0),
      text,
      redacted_text: redaction.redacted_text,
      start_time: Number(segment.start_time || 0),
      end_time: Number(segment.end_time || segment.start_time || 0),
      source_hash,
      working_hash: sha256(redaction.redacted_text),
      node_links: Array.isArray(segment.node_links) ? segment.node_links : [],
      privacy_flags: redaction.findings.map((finding) => finding.privacy_class),
      rights_flags: Array.isArray(segment.rights_flags) ? segment.rights_flags : [],
    };
  });
}

export function detectQuestionCandidates(segments, { classifyMedical = () => ({ medical: false, confidence: 0 }) } = {}) {
  const candidates = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const text = segment.redacted_text || '';
    if (!text.includes('?') || NON_QUESTION_PATTERNS.some((pattern) => pattern.test(text))) {
      continue;
    }
    const classification = classifyMedical(segment);
    if (classification.medical !== true) {
      continue;
    }
    candidates.push({
      id: deterministicId('candidate', {
        transcript_id: segment.transcript_id,
        segment_id: segment.segment_id,
        source_hash: segment.source_hash,
      }),
      source_wording: text,
      cleaned_wording: text.replace(/\s+/gu, ' ').trim(),
      preceding_context: segments[index - 1]?.redacted_text || null,
      following_context: segments[index + 1]?.redacted_text || null,
      question_timestamp: segment.start_time,
      answer_timestamp: null,
      source_video_id: segment.video_id,
      transcript_hash: segment.source_hash,
      node_links: segment.node_links,
      detected_answer_wording: null,
      answer_source_type: 'unresolved',
      confidence: Number(classification.confidence || 0),
      warnings: ['ANSWER_SOURCE_REQUIRED', 'PHYSICIAN_REVIEW_REQUIRED'],
      lineage: 'AI_DRAFT_NOT_MEDICALLY_VALIDATED',
    });
  }
  return candidates;
}

export function validateDraftCandidate(candidate) {
  const errors = [];
  if (candidate.lineage !== 'AI_DRAFT_NOT_MEDICALLY_VALIDATED') {
    errors.push('invalid_candidate_lineage');
  }
  if (!candidate.source_video_id || !candidate.transcript_hash || !Number.isFinite(candidate.question_timestamp)) {
    errors.push('source_lineage_incomplete');
  }
  if (candidate.choices && candidate.choices.length !== 4) {
    errors.push('exactly_four_choices_required');
  }
  if (candidate.distractors && candidate.distractors.length !== 3) {
    errors.push('exactly_three_distractors_required');
  }
  if (candidate.auto_approved === true || candidate.review_status === 'approved') {
    errors.push('auto_approval_forbidden');
  }
  return errors;
}

export function createBatchPlan(sourceIds, { batchSize = 25, completedSourceIds = [] } = {}) {
  const completed = new Set(completedSourceIds);
  const pending = [...new Set(sourceIds)].filter((id) => !completed.has(id)).sort();
  const batches = [];
  for (let index = 0; index < pending.length; index += batchSize) {
    const source_ids = pending.slice(index, index + batchSize);
    batches.push({
      batch_id: deterministicId('batch', source_ids),
      source_ids,
      checkpoint_after: source_ids.at(-1),
    });
  }
  return batches;
}
