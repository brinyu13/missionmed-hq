import { REQUIRED_PRIVACY_CLASSES } from './contracts.mjs';

const EXACT_BINOMIAL_CONFIDENCE = 0.95;
const PRECISION_THRESHOLD = 0.90;
const PATIENT_RECALL_THRESHOLD = 0.995;
const REQUIRED_SOURCE_COUNT = 97;
const MINIMUM_ADJUDICATED_SEGMENTS_PER_SOURCE = 20;
const MINIMUM_NON_DRJ_SEGMENTS_PER_SOURCE = 10;

export const REQUIRED_PRIVACY_EVALUATION_CLASSES = REQUIRED_PRIVACY_CLASSES;

const PATIENT_EVALUATION_CLASSES = Object.freeze([
  'PATIENT_DIRECT_IDENTIFIER',
  'PATIENT_QUASI_IDENTIFIER',
  'IDENTIFYING_CLINICAL_ANECDOTE',
]);

const CLASS_POLICY = Object.freeze({
  NON_DRJ_SPEECH: Object.freeze({ minimum_gold_positives: 970, recall_threshold: 1, zero_tolerance: true }),
  STUDENT_NAME: Object.freeze({ minimum_gold_positives: 300, recall_threshold: 0.99, zero_tolerance: false }),
  STUDENT_OTHER_IDENTIFIER: Object.freeze({ minimum_gold_positives: 300, recall_threshold: 0.99, zero_tolerance: false }),
  PATIENT_DIRECT_IDENTIFIER: Object.freeze({ minimum_gold_positives: 600, recall_threshold: 0.995, zero_tolerance: false }),
  PATIENT_QUASI_IDENTIFIER: Object.freeze({ minimum_gold_positives: 600, recall_threshold: 0.995, zero_tolerance: false }),
  THIRD_PARTY_IDENTITY: Object.freeze({ minimum_gold_positives: 300, recall_threshold: 0.99, zero_tolerance: false }),
  IDENTIFYING_CLINICAL_ANECDOTE: Object.freeze({ minimum_gold_positives: 600, recall_threshold: 0.995, zero_tolerance: false }),
  SOURCE_METADATA: Object.freeze({ minimum_gold_positives: 300, recall_threshold: 1, zero_tolerance: true }),
});

export const PRIVACY_EVALUATION_POLICY = Object.freeze({
  confidence: EXACT_BINOMIAL_CONFIDENCE,
  exact_binomial_method: 'CLOPPER_PEARSON_ONE_SIDED_EXACT',
  minimum_adjudicated_segments_per_source: MINIMUM_ADJUDICATED_SEGMENTS_PER_SOURCE,
  minimum_non_drj_segments_per_source: MINIMUM_NON_DRJ_SEGMENTS_PER_SOURCE,
  patient_classes: PATIENT_EVALUATION_CLASSES,
  precision_threshold: PRECISION_THRESHOLD,
  required_classes: REQUIRED_PRIVACY_EVALUATION_CLASSES,
  required_source_count: REQUIRED_SOURCE_COUNT,
  classes: CLASS_POLICY,
});

export const PRIVACY_THRESHOLDS = Object.freeze({
  precision: PRECISION_THRESHOLD,
  recall: Object.freeze(Object.fromEntries(
    REQUIRED_PRIVACY_EVALUATION_CLASSES.map((privacyClass) => [
      privacyClass,
      CLASS_POLICY[privacyClass].recall_threshold,
    ]),
  )),
});

export const PRIVACY_REASON_CODES = Object.freeze({
  ADDRESS_REDACTED: 'ADDRESS_REDACTED',
  EMAIL_REDACTED: 'EMAIL_REDACTED',
  IDENTIFYING_CLINICAL_ANECDOTE_SUPPRESSED: 'IDENTIFYING_CLINICAL_ANECDOTE_SUPPRESSED',
  PATIENT_IDENTIFIER_REDACTED: 'PATIENT_IDENTIFIER_REDACTED',
  PATIENT_QUASI_IDENTIFIER_REDACTED: 'PATIENT_QUASI_IDENTIFIER_REDACTED',
  PHONE_REDACTED: 'PHONE_REDACTED',
  SOURCE_METADATA_REDACTED: 'SOURCE_METADATA_REDACTED',
  STUDENT_IDENTIFIER_REDACTED: 'STUDENT_IDENTIFIER_REDACTED',
  STUDENT_NAME_REDACTED: 'STUDENT_NAME_REDACTED',
  STUDENT_SPEECH_EXCLUDED: 'STUDENT_SPEECH_EXCLUDED',
  THIRD_PARTY_IDENTITY_REDACTED: 'THIRD_PARTY_IDENTITY_REDACTED',
  UNCLASSIFIED_SENSITIVE_MARKER_SUPPRESSED: 'UNCLASSIFIED_SENSITIVE_MARKER_SUPPRESSED',
  UNVERIFIED_SPEAKER_EXCLUDED: 'UNVERIFIED_SPEAKER_EXCLUDED',
});

const PRIVACY_CLASS_ALIASES = Object.freeze({
  NON_DRJ_SPEECH: 'NON_DRJ_SPEECH',
  non_drj_speech: 'NON_DRJ_SPEECH',
  student_speech: 'NON_DRJ_SPEECH',
  third_party_speech: 'NON_DRJ_SPEECH',
  unverified_speaker: 'NON_DRJ_SPEECH',
  STUDENT_NAME: 'STUDENT_NAME',
  student_name: 'STUDENT_NAME',
  STUDENT_OTHER_IDENTIFIER: 'STUDENT_OTHER_IDENTIFIER',
  student_identifier: 'STUDENT_OTHER_IDENTIFIER',
  student_other_identifier: 'STUDENT_OTHER_IDENTIFIER',
  PATIENT_DIRECT_IDENTIFIER: 'PATIENT_DIRECT_IDENTIFIER',
  email: 'PATIENT_DIRECT_IDENTIFIER',
  patient_direct_identifier: 'PATIENT_DIRECT_IDENTIFIER',
  patient_identifier: 'PATIENT_DIRECT_IDENTIFIER',
  phone: 'PATIENT_DIRECT_IDENTIFIER',
  PATIENT_QUASI_IDENTIFIER: 'PATIENT_QUASI_IDENTIFIER',
  address: 'PATIENT_QUASI_IDENTIFIER',
  patient_quasi_identifier: 'PATIENT_QUASI_IDENTIFIER',
  THIRD_PARTY_IDENTITY: 'THIRD_PARTY_IDENTITY',
  third_party_identity: 'THIRD_PARTY_IDENTITY',
  third_party_name: 'THIRD_PARTY_IDENTITY',
  IDENTIFYING_CLINICAL_ANECDOTE: 'IDENTIFYING_CLINICAL_ANECDOTE',
  clinical_anecdote_identifying_detail: 'IDENTIFYING_CLINICAL_ANECDOTE',
  identifying_clinical_anecdote: 'IDENTIFYING_CLINICAL_ANECDOTE',
  SOURCE_METADATA: 'SOURCE_METADATA',
  source_metadata: 'SOURCE_METADATA',
});

export const CLOSED_PRIVACY_TAXONOMY = Object.freeze({
  metric_classes: REQUIRED_PRIVACY_EVALUATION_CLASSES,
  aliases: PRIVACY_CLASS_ALIASES,
  forbidden_output: Object.freeze([
    'filename',
    'original_id',
    'original_speaker',
    'path',
    'raw_text',
    'raw_transcript',
    'source_hash',
    'source_id',
    'source_metadata',
    'speaker',
    'speaker_attribution',
    'speaker_label',
    'text',
    'title',
    'transcript_id',
    'unclassified_sensitive_marker',
    'url',
    'video_id',
  ]),
});

const DETECTOR_RULES = Object.freeze([
  Object.freeze({
    privacyClass: 'STUDENT_NAME',
    reasonCode: PRIVACY_REASON_CODES.STUDENT_NAME_REDACTED,
    pattern: /\[STUDENT_NAME:[^\]\r\n]+\]/giu,
  }),
  Object.freeze({
    privacyClass: 'STUDENT_OTHER_IDENTIFIER',
    reasonCode: PRIVACY_REASON_CODES.STUDENT_IDENTIFIER_REDACTED,
    pattern: /\[STUDENT_(?:IDENTIFIER|OTHER_IDENTIFIER):[^\]\r\n]+\]/giu,
  }),
  Object.freeze({
    privacyClass: 'THIRD_PARTY_IDENTITY',
    reasonCode: PRIVACY_REASON_CODES.THIRD_PARTY_IDENTITY_REDACTED,
    pattern: /\[THIRD_PARTY_(?:NAME|IDENTITY):[^\]\r\n]+\]/giu,
  }),
  Object.freeze({
    privacyClass: 'IDENTIFYING_CLINICAL_ANECDOTE',
    reasonCode: PRIVACY_REASON_CODES.IDENTIFYING_CLINICAL_ANECDOTE_SUPPRESSED,
    pattern: /\[(?:IDENTIFYING|CLINICAL)_ANECDOTE:[^\]\r\n]+\]/giu,
    suppressSegment: true,
  }),
  Object.freeze({
    privacyClass: 'PATIENT_QUASI_IDENTIFIER',
    reasonCode: PRIVACY_REASON_CODES.PATIENT_QUASI_IDENTIFIER_REDACTED,
    pattern: /\[PATIENT_QUASI_IDENTIFIER:[^\]\r\n]+\]/giu,
  }),
  Object.freeze({
    privacyClass: 'PATIENT_DIRECT_IDENTIFIER',
    reasonCode: PRIVACY_REASON_CODES.PATIENT_IDENTIFIER_REDACTED,
    pattern: /\[(?:PATIENT_DIRECT_IDENTIFIER|PATIENT_IDENTIFIER|PATIENT_ID):[^\]\r\n]+\]/giu,
  }),
  Object.freeze({
    privacyClass: 'PATIENT_DIRECT_IDENTIFIER',
    reasonCode: PRIVACY_REASON_CODES.PATIENT_IDENTIFIER_REDACTED,
    pattern: /(?<!\[)\b(?:PATIENT|PAT|MRN|MEDICAL RECORD)[\s:._-]*(?:[A-Z0-9][\s:._-]*){4,20}\b/giu,
  }),
  Object.freeze({
    privacyClass: 'PATIENT_DIRECT_IDENTIFIER',
    reasonCode: PRIVACY_REASON_CODES.EMAIL_REDACTED,
    pattern: /\[EMAIL:[^\]\r\n]+\]|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  }),
  Object.freeze({
    privacyClass: 'PATIENT_DIRECT_IDENTIFIER',
    reasonCode: PRIVACY_REASON_CODES.PHONE_REDACTED,
    pattern: /\[PHONE:[^\]\r\n]+\]|\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/giu,
  }),
  Object.freeze({
    privacyClass: 'PATIENT_QUASI_IDENTIFIER',
    reasonCode: PRIVACY_REASON_CODES.ADDRESS_REDACTED,
    pattern: /\[ADDRESS:[^\]\r\n]+\]|\b\d{1,6}\s+[A-Za-z][A-Za-z .'-]{1,60}\s(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr)\b/giu,
  }),
  Object.freeze({
    privacyClass: 'SOURCE_METADATA',
    reasonCode: PRIVACY_REASON_CODES.SOURCE_METADATA_REDACTED,
    pattern: /\[SOURCE_METADATA:[^\]\r\n]+\]|\bhttps?:\/\/[^\s]+|\b[A-Z]:\\(?:[^\\\s]+\\)*[^\\\s]+|\/(?:Users|home|tmp|var)\/[^\s]+/giu,
  }),
]);

const UNCLASSIFIED_SENSITIVE_MARKER = /\[(?:STUDENT|PATIENT|THIRD_PARTY|IDENTIFYING|CLINICAL|SOURCE|PRIVATE|PERSON)[A-Z0-9_]*:[^\]\r\n]+\]/giu;
const LANCZOS_COEFFICIENTS = Object.freeze([
  0.9999999999998099,
  676.5203681218851,
  -1259.1392167224028,
  771.3234287776531,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9.984369578019572e-6,
  1.5056327351493116e-7,
]);

function canonicalPrivacyClass(value) {
  return PRIVACY_CLASS_ALIASES[String(value || '')] || null;
}

function logGamma(value) {
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  const shifted = value - 1;
  let sum = LANCZOS_COEFFICIENTS[0];
  for (let index = 1; index < LANCZOS_COEFFICIENTS.length; index += 1) {
    sum += LANCZOS_COEFFICIENTS[index] / (shifted + index);
  }
  const t = shifted + LANCZOS_COEFFICIENTS.length - 1.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum);
}

function betaContinuedFraction(a, b, x) {
  const maxIterations = 300;
  const epsilon = 3e-14;
  const floor = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d;
  let h = d;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const m2 = 2 * iteration;
    let coefficient = (iteration * (b - iteration) * x) / ((qam + m2) * (a + m2));
    d = 1 + coefficient * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + coefficient / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    h *= d * c;

    coefficient = -((a + iteration) * (qab + iteration) * x)
      / ((a + m2) * (qap + m2));
    d = 1 + coefficient * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + coefficient / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) <= epsilon) return h;
  }
  throw new Error('exact_binomial_beta_fraction_did_not_converge');
}

function regularizedIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const logFront = logGamma(a + b) - logGamma(a) - logGamma(b)
    + a * Math.log(x) + b * Math.log1p(-x);
  const front = Math.exp(logFront);
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

export function exactBinomialLowerConfidenceBound(successes, trials, confidence = EXACT_BINOMIAL_CONFIDENCE) {
  if (!Number.isInteger(successes) || !Number.isInteger(trials)
    || successes < 0 || trials < 0 || successes > trials) {
    throw new RangeError('invalid_exact_binomial_counts');
  }
  if (!(confidence > 0 && confidence < 1)) {
    throw new RangeError('invalid_exact_binomial_confidence');
  }
  if (trials === 0 || successes === 0) return 0;
  const alpha = 1 - confidence;
  if (successes === trials) return alpha ** (1 / trials);

  const a = successes;
  const b = trials - successes + 1;
  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 120; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (regularizedIncompleteBeta(midpoint, a, b) < alpha) lower = midpoint;
    else upper = midpoint;
  }
  return (lower + upper) / 2;
}

export function redactText(input) {
  let text = String(input || '').normalize('NFC');
  const findings = [];
  let suppressSegment = false;

  for (const rule of DETECTOR_RULES) {
    text = text.replace(rule.pattern, (match) => {
      findings.push({
        action: rule.suppressSegment ? 'suppress_segment' : 'redact_span',
        match_length: match.length,
        privacy_class: rule.privacyClass,
        reason_code: rule.reasonCode,
      });
      suppressSegment ||= rule.suppressSegment === true;
      return `[REDACTED_${rule.privacyClass}]`;
    });
  }

  text = text.replace(UNCLASSIFIED_SENSITIVE_MARKER, (match) => {
    findings.push({
      action: 'suppress_segment',
      match_length: match.length,
      privacy_class: 'UNCLASSIFIED_SENSITIVE_MARKER',
      reason_code: PRIVACY_REASON_CODES.UNCLASSIFIED_SENSITIVE_MARKER_SUPPRESSED,
    });
    suppressSegment = true;
    return '[REDACTED_UNCLASSIFIED_SENSITIVE_MARKER]';
  });

  return {
    findings,
    reason_codes: [...new Set(findings.map((finding) => finding.reason_code))],
    redacted_text: suppressSegment ? '' : text,
    status: suppressSegment ? 'suppressed' : 'pass',
  };
}

function normalizedMetricEntries(entries) {
  return entries.map((entry) => ({
    ...entry,
    canonical_privacy_class: canonicalPrivacyClass(entry?.privacy_class),
    normalized_source_ref: typeof entry?.source_ref === 'string' && entry.source_ref.trim()
      ? entry.source_ref.normalize('NFC').trim()
      : null,
  }));
}

function statusFromClassEvidence(incompleteReasons, failureReasons) {
  if (incompleteReasons.length > 0) return 'INCOMPLETE';
  if (failureReasons.length > 0) return 'FAIL';
  return 'PASS';
}

function scoreSourceCompleteness({ expectedSourceRefs, sourceEvaluations, normalizedLabels }) {
  const incompleteReasons = [];
  const expectedRefs = Array.isArray(expectedSourceRefs)
    ? expectedSourceRefs.map((value) => (
      typeof value === 'string' && value.trim() ? value.normalize('NFC').trim() : null
    ))
    : [];
  const validExpectedRefs = expectedRefs.filter(Boolean);
  const expectedSet = new Set(validExpectedRefs);

  if (!Array.isArray(expectedSourceRefs)) incompleteReasons.push('EXPECTED_SOURCE_REFS_REQUIRED');
  if (expectedRefs.some((value) => value === null)) incompleteReasons.push('INVALID_EXPECTED_SOURCE_REF');
  if (expectedSet.size !== validExpectedRefs.length) incompleteReasons.push('DUPLICATE_EXPECTED_SOURCE_REF');
  if (expectedSet.size !== REQUIRED_SOURCE_COUNT) incompleteReasons.push('REQUIRED_SOURCE_COUNT_NOT_MET');

  const evaluations = Array.isArray(sourceEvaluations) ? sourceEvaluations : [];
  if (!Array.isArray(sourceEvaluations)) incompleteReasons.push('SOURCE_EVALUATIONS_REQUIRED');
  const evaluationBySource = new Map();
  let invalidEvaluationCount = 0;
  let duplicateEvaluationCount = 0;
  let insufficientAdjudicatedSourceCount = 0;
  let insufficientNonDrjEvaluationSourceCount = 0;

  for (const evaluation of evaluations) {
    const sourceRef = typeof evaluation?.source_ref === 'string' && evaluation.source_ref.trim()
      ? evaluation.source_ref.normalize('NFC').trim()
      : null;
    const adjudicatedSegments = Number(evaluation?.adjudicated_segments);
    const nonDrjSegments = Number(evaluation?.non_drj_segments);
    if (!sourceRef
      || !Number.isInteger(adjudicatedSegments) || adjudicatedSegments < 0
      || !Number.isInteger(nonDrjSegments) || nonDrjSegments < 0) {
      invalidEvaluationCount += 1;
      continue;
    }
    if (evaluationBySource.has(sourceRef)) {
      duplicateEvaluationCount += 1;
      continue;
    }
    evaluationBySource.set(sourceRef, { adjudicatedSegments, nonDrjSegments });
    if (adjudicatedSegments < MINIMUM_ADJUDICATED_SEGMENTS_PER_SOURCE) {
      insufficientAdjudicatedSourceCount += 1;
    }
    if (nonDrjSegments < MINIMUM_NON_DRJ_SEGMENTS_PER_SOURCE) {
      insufficientNonDrjEvaluationSourceCount += 1;
    }
  }

  if (invalidEvaluationCount > 0) incompleteReasons.push('INVALID_SOURCE_EVALUATION');
  if (duplicateEvaluationCount > 0) incompleteReasons.push('DUPLICATE_SOURCE_EVALUATION');
  if (insufficientAdjudicatedSourceCount > 0) {
    incompleteReasons.push('MINIMUM_ADJUDICATED_SEGMENTS_PER_SOURCE_NOT_MET');
  }
  if (insufficientNonDrjEvaluationSourceCount > 0) {
    incompleteReasons.push('MINIMUM_NON_DRJ_SEGMENTS_PER_SOURCE_NOT_MET');
  }

  const missingEvaluationCount = [...expectedSet]
    .filter((sourceRef) => !evaluationBySource.has(sourceRef)).length;
  const unexpectedEvaluationCount = [...evaluationBySource.keys()]
    .filter((sourceRef) => !expectedSet.has(sourceRef)).length;
  if (missingEvaluationCount > 0) incompleteReasons.push('SOURCE_EVALUATION_OMITTED');
  if (unexpectedEvaluationCount > 0) incompleteReasons.push('UNEXPECTED_SOURCE_EVALUATION');

  const requiredLabels = normalizedLabels.filter((label) => label.canonical_privacy_class !== null);
  const labelsMissingSourceRef = requiredLabels
    .filter((label) => label.normalized_source_ref === null).length;
  const labelsOutsideExpectedSources = requiredLabels
    .filter((label) => label.normalized_source_ref !== null
      && !expectedSet.has(label.normalized_source_ref)).length;
  if (labelsMissingSourceRef > 0) incompleteReasons.push('GOLD_SOURCE_REFERENCE_REQUIRED');
  if (labelsOutsideExpectedSources > 0) incompleteReasons.push('GOLD_SOURCE_OUTSIDE_EXPECTED_CORPUS');

  const nonDrjGoldBySource = new Map();
  for (const label of requiredLabels) {
    if (label.canonical_privacy_class !== 'NON_DRJ_SPEECH' || !label.normalized_source_ref) continue;
    nonDrjGoldBySource.set(
      label.normalized_source_ref,
      (nonDrjGoldBySource.get(label.normalized_source_ref) || 0) + 1,
    );
  }
  const insufficientNonDrjGoldSourceCount = [...expectedSet]
    .filter((sourceRef) => (
      nonDrjGoldBySource.get(sourceRef) || 0
    ) < MINIMUM_NON_DRJ_SEGMENTS_PER_SOURCE).length;
  if (insufficientNonDrjGoldSourceCount > 0) {
    incompleteReasons.push('MINIMUM_NON_DRJ_GOLD_PER_SOURCE_NOT_MET');
  }

  return {
    duplicate_source_evaluations: duplicateEvaluationCount,
    evaluated_sources: evaluationBySource.size,
    expected_sources: expectedSet.size,
    incomplete_reasons: [...new Set(incompleteReasons)],
    insufficient_adjudicated_sources: insufficientAdjudicatedSourceCount,
    insufficient_non_drj_evaluation_sources: insufficientNonDrjEvaluationSourceCount,
    insufficient_non_drj_gold_sources: insufficientNonDrjGoldSourceCount,
    invalid_source_evaluations: invalidEvaluationCount,
    labels_missing_source_ref: labelsMissingSourceRef,
    labels_outside_expected_sources: labelsOutsideExpectedSources,
    minimum_adjudicated_segments_per_source: MINIMUM_ADJUDICATED_SEGMENTS_PER_SOURCE,
    minimum_non_drj_segments_per_source: MINIMUM_NON_DRJ_SEGMENTS_PER_SOURCE,
    missing_source_evaluations: missingEvaluationCount,
    required_sources: REQUIRED_SOURCE_COUNT,
    status: incompleteReasons.length > 0 ? 'INCOMPLETE' : 'PASS',
    unexpected_source_evaluations: unexpectedEvaluationCount,
  };
}

export function scorePrivacyAggregate({
  labels = [],
  detections = [],
  evaluated_counts = null,
  expected_source_refs = null,
  source_evaluations = null,
} = {}) {
  if (!Array.isArray(labels) || !Array.isArray(detections)) {
    throw new TypeError('privacy_labels_and_detections_must_be_arrays');
  }

  const normalizedLabels = normalizedMetricEntries(labels);
  const normalizedDetections = normalizedMetricEntries(detections);
  const unexpectedClasses = [...new Set([...normalizedLabels, ...normalizedDetections]
    .filter((entry) => entry.canonical_privacy_class === null)
    .map((entry) => String(entry.privacy_class || 'MISSING_PRIVACY_CLASS')))].sort();
  const evaluatedCountsObject = evaluated_counts !== null
    && typeof evaluated_counts === 'object'
    && !Array.isArray(evaluated_counts);
  const unexpectedEvaluationClasses = evaluatedCountsObject
    ? Object.keys(evaluated_counts)
      .filter((privacyClass) => !REQUIRED_PRIVACY_EVALUATION_CLASSES.includes(privacyClass))
      .sort()
    : [];
  const result = {
    confidence: EXACT_BINOMIAL_CONFIDENCE,
    evaluated_counts_required: true,
    exact_binomial_method: 'CLOPPER_PEARSON_ONE_SIDED_EXACT',
    precision_threshold: PRECISION_THRESHOLD,
    required_classes: {},
    source_completeness: null,
    status: 'INCOMPLETE',
    unexpected_classes: unexpectedClasses,
    unexpected_evaluation_classes: unexpectedEvaluationClasses,
  };

  result.source_completeness = scoreSourceCompleteness({
    expectedSourceRefs: expected_source_refs,
    normalizedLabels,
    sourceEvaluations: source_evaluations,
  });

  for (const privacyClass of REQUIRED_PRIVACY_EVALUATION_CLASSES) {
    const policy = CLASS_POLICY[privacyClass];
    const classLabels = normalizedLabels.filter(
      (label) => label.canonical_privacy_class === privacyClass,
    );
    const classDetections = normalizedDetections.filter(
      (detection) => detection.canonical_privacy_class === privacyClass,
    );
    const validGoldIds = classLabels
      .map((label) => label.id)
      .filter((id) => typeof id === 'string' && id.length > 0);
    const goldIds = new Set(validGoldIds);
    const matchedIds = new Set(classDetections
      .filter((detection) => goldIds.has(detection.label_id))
      .map((detection) => detection.label_id));
    const denominator = classLabels.length;
    const matched = matchedIds.size;
    const misses = denominator - matched;
    const recall = denominator === 0 ? 0 : matched / denominator;
    const precision = classDetections.length === 0 ? 0 : matched / classDetections.length;
    const recallLowerBound = exactBinomialLowerConfidenceBound(matched, denominator);
    const evaluatedClassPresent = evaluatedCountsObject
      && Object.hasOwn(evaluated_counts, privacyClass);
    const evaluatedItems = evaluatedClassPresent ? evaluated_counts[privacyClass] : 0;
    const validEvaluatedItems = Number.isInteger(evaluatedItems) && evaluatedItems >= 0;
    const incompleteReasons = [];
    const failureReasons = [];

    if (!evaluatedCountsObject) incompleteReasons.push('EVALUATED_COUNTS_REQUIRED');
    else if (!evaluatedClassPresent) incompleteReasons.push('EVALUATION_CLASS_OMITTED');
    if (evaluatedClassPresent && !validEvaluatedItems) incompleteReasons.push('INVALID_EVALUATED_ITEM_COUNT');
    if (evaluatedClassPresent && validEvaluatedItems && evaluatedItems === 0) {
      incompleteReasons.push('ZERO_EVALUATED_ITEMS');
    }
    if (denominator === 0) incompleteReasons.push('ZERO_GOLD_POSITIVES');
    if (denominator < policy.minimum_gold_positives) incompleteReasons.push('GOLD_MINIMUM_NOT_MET');
    if (validGoldIds.length !== classLabels.length) incompleteReasons.push('GOLD_LABEL_ID_REQUIRED');
    if (goldIds.size !== validGoldIds.length) incompleteReasons.push('DUPLICATE_GOLD_LABEL_ID');
    if (evaluatedClassPresent && validEvaluatedItems && evaluatedItems < denominator) {
      incompleteReasons.push('EVALUATED_COUNT_BELOW_GOLD_DENOMINATOR');
    }

    if (incompleteReasons.length === 0) {
      if (policy.zero_tolerance && misses > 0) failureReasons.push('ZERO_TOLERANCE_MISS');
      if (recall < policy.recall_threshold) failureReasons.push('RECALL_POINT_BELOW_THRESHOLD');
      if (!policy.zero_tolerance && recallLowerBound < policy.recall_threshold) {
        failureReasons.push('RECALL_EXACT_LOWER_BOUND_BELOW_THRESHOLD');
      }
      if (classDetections.length === 0) failureReasons.push('ZERO_PRECISION_DENOMINATOR');
      if (precision < PRECISION_THRESHOLD) failureReasons.push('PRECISION_BELOW_THRESHOLD');
    }

    result.required_classes[privacyClass] = {
      denominator,
      detections: classDetections.length,
      evaluated_items: validEvaluatedItems ? evaluatedItems : 0,
      exact_recall_lower_bound_95: recallLowerBound,
      false_negatives: misses,
      false_positives: classDetections.length - matched,
      failure_reasons: failureReasons,
      incomplete_reasons: incompleteReasons,
      lower_bound_gate: policy.zero_tolerance ? 'ZERO_TOLERANCE' : policy.recall_threshold,
      matched,
      minimum_gold_positives: policy.minimum_gold_positives,
      misses,
      precision: Number(precision),
      precision_denominator: classDetections.length,
      precision_threshold: PRECISION_THRESHOLD,
      recall: Number(recall),
      recall_denominator: denominator,
      recall_threshold: policy.recall_threshold,
      status: statusFromClassEvidence(incompleteReasons, failureReasons),
      true_positives: matched,
      zero_tolerance: policy.zero_tolerance,
    };
  }

  const patientScores = PATIENT_EVALUATION_CLASSES.map(
    (privacyClass) => result.required_classes[privacyClass],
  );
  const patientDenominator = patientScores.reduce((total, score) => total + score.denominator, 0);
  const patientDetections = patientScores.reduce((total, score) => total + score.detections, 0);
  const patientMatched = patientScores.reduce((total, score) => total + score.matched, 0);
  const patientRecall = patientDenominator === 0 ? 0 : patientMatched / patientDenominator;
  const patientPrecision = patientDetections === 0 ? 0 : patientMatched / patientDetections;
  const patientLowerBound = exactBinomialLowerConfidenceBound(patientMatched, patientDenominator);
  const patientIncomplete = patientScores.some((score) => score.status === 'INCOMPLETE');
  const patientFailureReasons = [];
  if (!patientIncomplete && patientRecall < PATIENT_RECALL_THRESHOLD) {
    patientFailureReasons.push('PATIENT_RECALL_POINT_BELOW_THRESHOLD');
  }
  if (!patientIncomplete && patientLowerBound < PATIENT_RECALL_THRESHOLD) {
    patientFailureReasons.push('PATIENT_RECALL_EXACT_LOWER_BOUND_BELOW_THRESHOLD');
  }
  result.patient_identifying_information = {
    cannot_override_required_class_failures: true,
    classes: [...PATIENT_EVALUATION_CLASSES],
    denominator: patientDenominator,
    detections: patientDetections,
    exact_recall_lower_bound_95: patientLowerBound,
    false_negatives: patientDenominator - patientMatched,
    false_positives: patientDetections - patientMatched,
    failure_reasons: patientFailureReasons,
    matched: patientMatched,
    precision: Number(patientPrecision),
    precision_denominator: patientDetections,
    recall: Number(patientRecall),
    recall_denominator: patientDenominator,
    recall_threshold: PATIENT_RECALL_THRESHOLD,
    status: patientIncomplete
      ? 'INCOMPLETE'
      : patientFailureReasons.length > 0 ? 'FAIL' : 'PASS',
    true_positives: patientMatched,
  };

  const classStatuses = Object.values(result.required_classes).map((score) => score.status);
  if (unexpectedClasses.length > 0 || unexpectedEvaluationClasses.length > 0
    || classStatuses.includes('FAIL') || result.patient_identifying_information.status === 'FAIL') {
    result.status = 'FAIL';
  } else if (classStatuses.includes('INCOMPLETE')
    || result.patient_identifying_information.status === 'INCOMPLETE'
    || result.source_completeness.status === 'INCOMPLETE') {
    result.status = 'INCOMPLETE';
  } else {
    result.status = 'PASS';
  }
  return result;
}
