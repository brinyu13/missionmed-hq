import { deterministicId, sha256 } from './hash.mjs';
import { PRIVACY_REASON_CODES, redactText } from './privacy.mjs';

const NON_QUESTION_PATTERNS = [
  /\b(attendance|schedule|microphone|camera|break|hello|good morning)\b/iu,
  /^(right|okay|understood|any questions)\??$/iu,
];

const SPEAKER_ATTRIBUTIONS = new Set(['verified_drj', 'likely_drj', 'unknown']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const OPAQUE_SOURCE_REF_PATTERN = /^working_source_ref_[a-f0-9]{20,64}$/u;
const NORMALIZED_DRJ_ROLES = new Set(['drj', 'dr_j', 'instructor']);

export const PRIVACY_PIPELINE_VERSION = 'i1q.privacy.normalization.v1';
export const WORKING_SEGMENT_FIELDS = Object.freeze([
  'source_ref',
  'segment_ref',
  'start_ms',
  'end_ms',
  'speaker_role',
  'redacted_text',
  'applied_class_codes',
  'pipeline_version',
]);

export const VERIFIED_DRJ_SPEAKER_AUTHORITY_CLASSES = Object.freeze([
  'authoritative_registry_speaker_mapping',
  'missionmed_authoritative_speaker_mapping',
  'source_owner_attestation',
]);
const VERIFIED_DRJ_SPEAKER_AUTHORITIES = new Set(VERIFIED_DRJ_SPEAKER_AUTHORITY_CLASSES);
const FORBIDDEN_CANDIDATE_TEXT_KEYS = new Set([
  'cleaned_wording',
  'detected_answer_wording',
  'following_context',
  'original_id',
  'original_speaker',
  'original_text',
  'preceding_context',
  'raw_text',
  'raw_transcript',
  'redacted_text',
  'rights_record_id',
  'source_hash',
  'source_id',
  'source_segment_hash',
  'source_segment_id',
  'source_text',
  'source_transcript_id',
  'source_video_id',
  'source_wording',
  'speaker',
  'speaker_attribution',
  'transcript_hash',
  'transcript_text',
  'transcript_id',
  'video_id',
]);
const FORBIDDEN_CANDIDATE_SOURCE_KEYS = new Set([
  'filename',
  'original_segment_id',
  'path',
  'source_segment_hash',
  'source_hash',
  'source_id',
  'source_transcript_id',
  'source_video_id',
  'speaker',
  'speaker_attribution',
  'speaker_label',
  'title',
  'transcript_id',
  'url',
  'video_id',
]);

export const PIPELINE_PRIVACY_REASON_CODES = Object.freeze({
  EMPTY_WORKING_TEXT_EXCLUDED: 'EMPTY_WORKING_TEXT_EXCLUDED',
  MEDIA_CLIP_DISABLED: 'MEDIA_CLIP_DISABLED',
  NON_DRJ_SPEECH_EXCLUDED: 'NON_DRJ_SPEECH_EXCLUDED',
  PRIVACY_SEGMENT_SUPPRESSED: 'PRIVACY_SEGMENT_SUPPRESSED',
  PUBLIC_EXCERPT_DISABLED: 'PUBLIC_EXCERPT_DISABLED',
  SPEAKER_EVIDENCE_CONFLICT: 'SPEAKER_EVIDENCE_CONFLICT',
  SPEAKER_EVIDENCE_AUTHORITY_NOT_ALLOWED: 'SPEAKER_EVIDENCE_AUTHORITY_NOT_ALLOWED',
  SPEAKER_EVIDENCE_MAPPING_HASH_INVALID: 'SPEAKER_EVIDENCE_MAPPING_HASH_INVALID',
  SPEAKER_EVIDENCE_REQUIRED: 'SPEAKER_EVIDENCE_REQUIRED',
  SPEAKER_VERIFIED_EXPLICITLY: 'SPEAKER_VERIFIED_EXPLICITLY',
  THIRD_PARTY_SPEECH_EXCLUDED: 'THIRD_PARTY_SPEECH_EXCLUDED',
});

function normalizeSpeakerRole(segment) {
  const values = [segment.speaker_role, segment.speaker]
    .map((value) => String(value || '').normalize('NFC').trim().toLowerCase());
  if (values.some((value) => ['student', 'learner', 'attendee'].includes(value))) return 'student';
  if (values.some((value) => ['third_party', 'guest', 'other'].includes(value))) return 'third_party';
  if (values.some((value) => ['drj', 'dr_j', 'instructor'].includes(value))) return 'drj';
  return 'unknown';
}

function resolveSpeakerAttribution(segment) {
  const role = normalizeSpeakerRole(segment);
  const explicit = String(segment.speaker_attribution || '').normalize('NFC').trim().toLowerCase();
  const explicitAttribution = SPEAKER_ATTRIBUTIONS.has(explicit) ? explicit : null;
  const roleConflict = ['student', 'third_party'].includes(role) && explicitAttribution === 'verified_drj';

  if (roleConflict) {
    return {
      attribution: 'unknown',
      evidence_reason_code: PIPELINE_PRIVACY_REASON_CODES.SPEAKER_EVIDENCE_CONFLICT,
      evidence: null,
      role,
    };
  }

  if (explicitAttribution === 'verified_drj') {
    const evidence = segment.speaker_evidence;
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
      return {
        attribution: 'unknown',
        evidence: null,
        evidence_reason_code: PIPELINE_PRIVACY_REASON_CODES.SPEAKER_EVIDENCE_REQUIRED,
        role,
      };
    }
    const authorityClass = String(evidence.authority_class || '').normalize('NFC').trim().toLowerCase();
    if (!VERIFIED_DRJ_SPEAKER_AUTHORITIES.has(authorityClass)) {
      return {
        attribution: 'unknown',
        evidence: null,
        evidence_reason_code: PIPELINE_PRIVACY_REASON_CODES.SPEAKER_EVIDENCE_AUTHORITY_NOT_ALLOWED,
        role,
      };
    }
    const mappingSha256 = String(evidence.mapping_sha256 || '').trim().toLowerCase();
    if (!SHA256_PATTERN.test(mappingSha256)) {
      return {
        attribution: 'unknown',
        evidence: null,
        evidence_reason_code: PIPELINE_PRIVACY_REASON_CODES.SPEAKER_EVIDENCE_MAPPING_HASH_INVALID,
        role,
      };
    }
    return {
      attribution: 'verified_drj',
      evidence: {
        authority_class: authorityClass,
        mapping_sha256: mappingSha256,
      },
      evidence_reason_code: PIPELINE_PRIVACY_REASON_CODES.SPEAKER_VERIFIED_EXPLICITLY,
      role,
    };
  }
  return {
    attribution: 'unknown',
    evidence: null,
    evidence_reason_code: PRIVACY_REASON_CODES.UNVERIFIED_SPEAKER_EXCLUDED,
    role,
  };
}

function disabledPublicRights() {
  return {
    media_clip_enabled: false,
    public_excerpt_enabled: false,
    reason_codes: [
      PIPELINE_PRIVACY_REASON_CODES.PUBLIC_EXCERPT_DISABLED,
      PIPELINE_PRIVACY_REASON_CODES.MEDIA_CLIP_DISABLED,
    ],
  };
}

function toMilliseconds(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`invalid_transcript_segment_${fieldName}`);
  }
  const milliseconds = Math.round(value * 1000);
  if (!Number.isSafeInteger(milliseconds)) throw new Error(`invalid_transcript_segment_${fieldName}`);
  return milliseconds;
}

function segmentIsAmbiguous(segment) {
  if (segment.ambiguous_speaker === true
    || segment.mixed_speakers === true
    || segment.overlapping_speech === true) {
    return true;
  }
  if (Object.hasOwn(segment, 'speaker_role')) {
    const role = String(segment.speaker_role).normalize('NFC').trim().toLowerCase();
    if (!NORMALIZED_DRJ_ROLES.has(role)) return true;
  }
  return false;
}

function findForbiddenCandidateTextKeys(value, path = '$', findings = []) {
  if (!value || typeof value !== 'object') return findings;
  for (const [key, nested] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_CANDIDATE_TEXT_KEYS.has(key)) findings.push(childPath);
    findForbiddenCandidateTextKeys(nested, childPath, findings);
  }
  return findings;
}

function findForbiddenCandidateSourceKeys(value, path = '$', findings = []) {
  if (!value || typeof value !== 'object') return findings;
  for (const [key, nested] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_CANDIDATE_SOURCE_KEYS.has(key)) findings.push(childPath);
    findForbiddenCandidateSourceKeys(nested, childPath, findings);
  }
  return findings;
}

export function normalizeTranscriptArtifact({
  drj_speaker_labels,
  segments,
  source_attribution,
  source_hash,
  working_source_ref,
} = {}) {
  const normalizedSourceHash = String(source_hash || '').trim().toLowerCase();
  const validSpeakerLabels = Array.isArray(drj_speaker_labels)
    && drj_speaker_labels.every((label) => typeof label === 'string' && label.length > 0);
  const normalizedSpeakerLabels = validSpeakerLabels
    ? drj_speaker_labels.map((label) => label.normalize('NFC'))
    : [];
  const drjSpeakerLabels = new Set(normalizedSpeakerLabels);
  if (!SHA256_PATTERN.test(normalizedSourceHash)
    || source_attribution !== 'verified_drj'
    || !OPAQUE_SOURCE_REF_PATTERN.test(String(working_source_ref || ''))
    || !validSpeakerLabels
    || drjSpeakerLabels.size !== normalizedSpeakerLabels.length
    || !Array.isArray(segments)) {
    throw new Error('invalid_transcript_artifact');
  }

  const workingSegments = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)
      || typeof segment.text !== 'string'
      || typeof segment.speaker !== 'string'
      || !Object.hasOwn(segment, 'start_time')
      || !Object.hasOwn(segment, 'end_time')) {
      throw new Error('invalid_transcript_segment');
    }
    const startMs = toMilliseconds(segment.start_time, 'start_time');
    const endMs = toMilliseconds(segment.end_time, 'end_time');
    if (endMs < startMs) throw new Error('invalid_transcript_segment_time_range');

    const speaker = resolveSpeakerAttribution(segment);
    const exactSpeakerLabel = segment.speaker.normalize('NFC');
    if (speaker.attribution !== 'verified_drj'
      || !drjSpeakerLabels.has(exactSpeakerLabel)
      || segmentIsAmbiguous(segment)) {
      continue;
    }

    const redaction = redactText(segment.text.normalize('NFC').trim());
    if (redaction.status !== 'pass' || !redaction.redacted_text.trim()) continue;
    const segmentRef = deterministicId('working_segment_ref', {
      index,
      working_source_ref,
    });
    workingSegments.push({
      source_ref: working_source_ref,
      segment_ref: segmentRef,
      start_ms: startMs,
      end_ms: endMs,
      speaker_role: 'DRJ',
      redacted_text: redaction.redacted_text,
      applied_class_codes: [...new Set(
        redaction.findings.map((finding) => finding.privacy_class),
      )],
      pipeline_version: PRIVACY_PIPELINE_VERSION,
    });
  }
  return workingSegments;
}

export function detectQuestionCandidates(segments, { classifyMedical = () => ({ medical: false, confidence: 0 }) } = {}) {
  const candidates = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const text = segment.redacted_text || '';
    if (segment.speaker_role !== 'DRJ'
      || !segment.source_ref
      || !segment.segment_ref
      || segment.pipeline_version !== PRIVACY_PIPELINE_VERSION) {
      continue;
    }
    if (!text.includes('?') || NON_QUESTION_PATTERNS.some((pattern) => pattern.test(text))) {
      continue;
    }
    const classification = classifyMedical(segment);
    if (classification.medical !== true) {
      continue;
    }
    const workingHash = sha256(segment);
    const rights = disabledPublicRights();
    candidates.push({
      id: deterministicId('candidate', {
        segment_ref: segment.segment_ref,
        source_ref: segment.source_ref,
        working_hash: workingHash,
      }),
      answer_timestamp: null,
      answer_source_type: 'unresolved',
      confidence: Number(classification.confidence || 0),
      context_segment_refs: [segments[index - 1], segments[index + 1]]
        .filter((context) => context?.speaker_role === 'DRJ')
        .map((context) => context.segment_ref),
      lineage: 'AI_DRAFT_NOT_MEDICALLY_VALIDATED',
      privacy_classes: segment.applied_class_codes,
      privacy_status: 'pass',
      question_end_ms: segment.end_ms,
      question_start_ms: segment.start_ms,
      rights,
      source_lineage: {
        pipeline_version: segment.pipeline_version,
        segment_ref: segment.segment_ref,
        source_ref: segment.source_ref,
        working_hash: workingHash,
      },
      speaker_role: segment.speaker_role,
      warnings: [
        'ANSWER_SOURCE_REQUIRED',
        'PHYSICIAN_REVIEW_REQUIRED',
        ...rights.reason_codes,
      ],
      working_hash: workingHash,
      working_text: text.replace(/\s+/gu, ' ').trim(),
    });
  }
  return candidates;
}

export function validateDraftCandidate(candidate) {
  const errors = [];
  if (candidate.lineage !== 'AI_DRAFT_NOT_MEDICALLY_VALIDATED') {
    errors.push('invalid_candidate_lineage');
  }
  const sourceLineage = candidate.source_lineage;
  if (!sourceLineage
    || !OPAQUE_SOURCE_REF_PATTERN.test(String(sourceLineage.source_ref || ''))
    || !sourceLineage.segment_ref
    || sourceLineage.pipeline_version !== PRIVACY_PIPELINE_VERSION
    || !sourceLineage.working_hash
    || !Number.isFinite(candidate.question_start_ms)
    || !Number.isFinite(candidate.question_end_ms)) {
    errors.push('source_lineage_incomplete');
  }
  if (!candidate.working_text || !candidate.working_hash) {
    errors.push('privacy_safe_working_text_required');
  }
  if (candidate.privacy_status !== 'pass') {
    errors.push('privacy_scrub_not_passed');
  }
  if (candidate.speaker_role !== 'DRJ') {
    errors.push('verified_drj_segment_required');
  }
  for (const path of findForbiddenCandidateTextKeys(candidate)) {
    errors.push(`unsafe_source_text_field:${path}`);
  }
  for (const path of findForbiddenCandidateSourceKeys(candidate)) {
    errors.push(`unsafe_source_metadata_field:${path}`);
  }
  if (candidate.rights?.public_excerpt_enabled === true) errors.push('public_excerpt_disabled');
  if (candidate.rights?.media_clip_enabled === true) errors.push('media_clip_disabled');
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
