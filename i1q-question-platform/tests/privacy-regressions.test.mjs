import assert from 'node:assert/strict';
import test from 'node:test';

import { sha256 } from '../src/hash.mjs';
import {
  detectQuestionCandidates,
  normalizeTranscriptArtifact,
  PRIVACY_PIPELINE_VERSION,
  validateDraftCandidate,
  VERIFIED_DRJ_SPEAKER_AUTHORITY_CLASSES,
  WORKING_SEGMENT_FIELDS,
} from '../src/pipeline.mjs';
import {
  CLOSED_PRIVACY_TAXONOMY,
  exactBinomialLowerConfidenceBound,
  PRIVACY_EVALUATION_POLICY,
  PRIVACY_REASON_CODES,
  redactText,
  REQUIRED_PRIVACY_EVALUATION_CLASSES,
  scorePrivacyAggregate,
} from '../src/privacy.mjs';

const SOURCE_HASH = sha256('SYNTHETIC_PRIVACY_SOURCE');
const MAPPING_SHA256 = sha256('SYNTHETIC_SPEAKER_MAPPING');
const AUTHORITY_CLASS = VERIFIED_DRJ_SPEAKER_AUTHORITY_CLASSES[0];
const DRJ_SPEAKER_LABEL = 'SYNTHETIC_EXACT_DRJ_LABEL';
const WORKING_SOURCE_REF = `working_source_ref_${sha256('SYNTHETIC_WORKING_MAPPING').slice(0, 20)}`;
const SYNTHETIC_SOURCE_REFS = Object.freeze(Array.from(
  { length: PRIVACY_EVALUATION_POLICY.required_source_count },
  (_, index) => `working_source_ref_${sha256(`SYNTHETIC_SOURCE_${index}`).slice(0, 20)}`,
));
const SYNTHETIC_SOURCE_EVALUATIONS = Object.freeze(SYNTHETIC_SOURCE_REFS.map((source_ref) => ({
  adjudicated_segments: PRIVACY_EVALUATION_POLICY.minimum_adjudicated_segments_per_source,
  non_drj_segments: PRIVACY_EVALUATION_POLICY.minimum_non_drj_segments_per_source,
  source_ref,
})));

function normalizeAll(overrides = {}, artifactOverrides = {}) {
  return normalizeTranscriptArtifact({
    drj_speaker_labels: [DRJ_SPEAKER_LABEL],
    segments: [{
      end_time: 4,
      segment_id: 'SOURCE_SEGMENT_SENTINEL',
      speaker: DRJ_SPEAKER_LABEL,
      speaker_attribution: 'verified_drj',
      speaker_evidence: {
        authority_class: AUTHORITY_CLASS,
        mapping_sha256: MAPPING_SHA256,
      },
      speaker_role: 'drj',
      start_time: 1,
      text: 'Which synthetic symbol is selected?',
      ...overrides,
    }],
    source_attribution: 'verified_drj',
    source_hash: SOURCE_HASH,
    transcript_id: 'SOURCE_TRANSCRIPT_SENTINEL',
    video_id: 'SOURCE_VIDEO_SENTINEL',
    working_source_ref: WORKING_SOURCE_REF,
    ...artifactOverrides,
  });
}

function normalizeOne(overrides = {}, artifactOverrides = {}) {
  return normalizeAll(overrides, artifactOverrides)[0];
}

// Release-sized mechanics data is generated in memory only; no corpus fixture is written.
function policyFixture(countOverrides = {}) {
  const labels = [];
  const detections = [];
  const evaluated_counts = {};
  for (const privacyClass of REQUIRED_PRIVACY_EVALUATION_CLASSES) {
    const count = countOverrides[privacyClass]
      ?? PRIVACY_EVALUATION_POLICY.classes[privacyClass].minimum_gold_positives;
    evaluated_counts[privacyClass] = count;
    for (let index = 0; index < count; index += 1) {
      const id = `${privacyClass}_${index}`;
      labels.push({
        id,
        privacy_class: privacyClass,
        source_ref: SYNTHETIC_SOURCE_REFS[index % SYNTHETIC_SOURCE_REFS.length],
      });
      detections.push({ label_id: id, privacy_class: privacyClass });
    }
  }
  return {
    detections,
    evaluated_counts,
    expected_source_refs: SYNTHETIC_SOURCE_REFS,
    labels,
    source_evaluations: SYNTHETIC_SOURCE_EVALUATIONS,
  };
}

test('closed detector taxonomy emits only canonical privacy classes and never raw text', () => {
  const input = [
    '[STUDENT_NAME:SYNTHETIC_STUDENT]',
    '[STUDENT_IDENTIFIER:SYNTHETIC_STUDENT_ID]',
    '[PATIENT_DIRECT_IDENTIFIER:SYNTHETIC_PATIENT]',
    '[PATIENT_QUASI_IDENTIFIER:SYNTHETIC_QUASI]',
    '[THIRD_PARTY_IDENTITY:SYNTHETIC_PERSON]',
    '[SOURCE_METADATA:SYNTHETIC_SOURCE]',
  ].join(' ');
  const result = redactText(input);

  assert.equal(result.status, 'pass');
  assert.equal(Object.hasOwn(result, 'raw_text'), false);
  assert.equal(Object.hasOwn(result, 'text'), false);
  assert.doesNotMatch(result.redacted_text, /SYNTHETIC_(?:STUDENT|PATIENT|QUASI|PERSON|SOURCE)/u);
  assert.deepEqual(
    [...new Set(result.findings.map((finding) => finding.privacy_class))].sort(),
    [
      'PATIENT_DIRECT_IDENTIFIER',
      'PATIENT_QUASI_IDENTIFIER',
      'SOURCE_METADATA',
      'STUDENT_NAME',
      'STUDENT_OTHER_IDENTIFIER',
      'THIRD_PARTY_IDENTITY',
    ],
  );
  assert.deepEqual(CLOSED_PRIVACY_TAXONOMY.metric_classes, REQUIRED_PRIVACY_EVALUATION_CLASSES);
});

test('identifying anecdotes and unknown sensitive markers suppress the complete segment', () => {
  const anecdote = redactText('Synthetic lead [CLINICAL_ANECDOTE:SYNTHETIC_LINKAGE] synthetic tail');
  assert.equal(anecdote.status, 'suppressed');
  assert.equal(anecdote.redacted_text, '');
  assert.equal(anecdote.findings[0].privacy_class, 'IDENTIFYING_CLINICAL_ANECDOTE');
  assert.ok(anecdote.reason_codes.includes(PRIVACY_REASON_CODES.IDENTIFYING_CLINICAL_ANECDOTE_SUPPRESSED));

  const unknown = redactText('[PATIENT_SECRET:SYNTHETIC_UNKNOWN_CLASS]');
  assert.equal(unknown.status, 'suppressed');
  assert.equal(unknown.redacted_text, '');

  const normalized = normalizeAll({
    text: 'Which [IDENTIFYING_ANECDOTE:SYNTHETIC_LINKAGE] symbol is selected?',
  });
  assert.deepEqual(normalized, []);
});

test('working segments are newly constructed from the Dr J-only field allowlist', () => {
  const segment = normalizeOne({
    filename: 'SOURCE_FILENAME_SENTINEL',
    node_links: ['SOURCE_NODE_SENTINEL'],
    path: 'SOURCE_PATH_SENTINEL',
    title: 'SOURCE_TITLE_SENTINEL',
    url: 'SOURCE_URL_SENTINEL',
    text: 'Which [PATIENT_IDENTIFIER:SYNTHETIC_PATIENT] symbol is selected?',
  });
  const segmentJson = JSON.stringify(segment);

  assert.deepEqual(Object.keys(segment), WORKING_SEGMENT_FIELDS);
  assert.equal(segment.source_ref, WORKING_SOURCE_REF);
  assert.match(segment.segment_ref, /^working_segment_ref_[a-f0-9]{20}$/u);
  assert.equal(segment.start_ms, 1000);
  assert.equal(segment.end_ms, 4000);
  assert.equal(segment.speaker_role, 'DRJ');
  assert.equal(segment.pipeline_version, PRIVACY_PIPELINE_VERSION);
  assert.deepEqual(segment.applied_class_codes, ['PATIENT_DIRECT_IDENTIFIER']);
  assert.equal(Object.hasOwn(segment, 'video_id'), false);
  assert.equal(Object.hasOwn(segment, 'transcript_id'), false);
  assert.equal(Object.hasOwn(segment, 'source_hash'), false);
  assert.equal(Object.hasOwn(segment, 'speaker_attribution'), false);
  assert.equal(Object.hasOwn(segment, 'speaker_evidence'), false);
  assert.doesNotMatch(segmentJson, /SOURCE_(?:VIDEO|TRANSCRIPT|SEGMENT|NODE|TITLE|URL|PATH|FILENAME)_SENTINEL/u);
  assert.doesNotMatch(segment.redacted_text, /SYNTHETIC_PATIENT/u);

  const [candidate] = detectQuestionCandidates([segment], {
    classifyMedical: () => ({ confidence: 1, medical: true }),
  });
  const candidateJson = JSON.stringify(candidate);
  assert.doesNotMatch(candidateJson, /SOURCE_(?:VIDEO|TRANSCRIPT|SEGMENT|NODE|LABEL|TITLE|URL|PATH|FILENAME)_SENTINEL/u);
  assert.deepEqual(Object.keys(candidate.source_lineage), [
    'pipeline_version',
    'segment_ref',
    'source_ref',
    'working_hash',
  ]);
  assert.equal(Object.hasOwn(candidate.source_lineage, 'source_hash'), false);
  assert.equal(Object.hasOwn(candidate, 'speaker_attribution'), false);
  assert.equal(candidate.speaker_role, 'DRJ');
  assert.equal(candidate.rights.public_excerpt_enabled, false);
  assert.equal(candidate.rights.media_clip_enabled, false);
  assert.deepEqual(validateDraftCandidate(candidate), []);
});

test('Dr J retention requires exact source mapping and allowed authority evidence', () => {
  assert.equal(normalizeAll().length, 1);
  assert.deepEqual(normalizeAll({ speaker_evidence: undefined }), []);

  const disallowed = normalizeAll({
    speaker_evidence: { authority_class: 'self_asserted', mapping_sha256: MAPPING_SHA256 },
  });
  assert.deepEqual(disallowed, []);

  const invalidHash = normalizeAll({
    speaker_evidence: { authority_class: AUTHORITY_CLASS, mapping_sha256: 'not-a-sha256' },
  });
  assert.deepEqual(invalidHash, []);

  assert.deepEqual(normalizeAll({}, { drj_speaker_labels: ['SYNTHETIC_FUZZY_LABEL'] }), []);
  assert.deepEqual(normalizeAll({}, { drj_speaker_labels: [] }), []);
});

test('ambiguous, inferred, student, third-party, and non-mapped speech is removed', () => {
  const uncertainInputs = [
    { speaker_attribution: undefined, speaker_confidence: 1, speaker_role: 'drj' },
    { speaker_attribution: 'generic', speaker_role: 'drj' },
    { speaker_attribution: 'inferred_drj', speaker_role: 'drj' },
    { speaker_attribution: 'likely_drj', speaker_role: 'drj' },
    { speaker_attribution: 'unknown', speaker_role: 'drj' },
    { speaker_attribution: 'verified_drj', speaker_role: 'student' },
    { speaker_attribution: 'verified_drj', speaker_role: 'third_party' },
    { speaker: 'student', speaker_attribution: 'verified_drj', speaker_role: 'drj' },
    { ambiguous_speaker: true },
    { mixed_speakers: true },
    { overlapping_speech: true },
  ];
  for (const input of uncertainInputs) {
    assert.deepEqual(normalizeAll(input), []);
  }
  assert.deepEqual(detectQuestionCandidates([], {
    classifyMedical: () => ({ confidence: 1, medical: true }),
  }), []);
});

test('public excerpt and media permissions remain off at the privacy boundary', () => {
  const rawRightsInputs = [
    undefined,
    { cleared_for: ['student_facing_excerpt', 'media_clip'], id: 'SYNTHETIC_RIGHTS' },
    {
      cleared_for: ['student_facing_excerpt', 'media_clip'],
      id: 'SYNTHETIC_RIGHTS',
      open_conflict: false,
    },
  ];
  for (const rights_record of rawRightsInputs) {
    const [candidate] = detectQuestionCandidates([normalizeOne({ rights_record })], {
      classifyMedical: () => ({ confidence: 1, medical: true }),
    });
    assert.equal(candidate.rights.public_excerpt_enabled, false);
    assert.equal(candidate.rights.media_clip_enabled, false);
    assert.equal(Object.hasOwn(candidate.rights, 'rights_record_id'), false);
  }
});

test('a full in-memory synthetic denominator fixture exercises the release PASS mechanics', () => {
  const result = scorePrivacyAggregate(policyFixture());
  assert.equal(result.status, 'PASS');
  assert.equal(result.exact_binomial_method, 'CLOPPER_PEARSON_ONE_SIDED_EXACT');
  assert.equal(result.patient_identifying_information.status, 'PASS');
  assert.deepEqual(Object.keys(result.required_classes), REQUIRED_PRIVACY_EVALUATION_CLASSES);
  assert.equal(result.required_classes.SOURCE_METADATA.status, 'PASS');
  assert.equal(result.required_classes.SOURCE_METADATA.misses, 0);
  assert.equal(result.source_completeness.status, 'PASS');
  assert.equal(result.source_completeness.evaluated_sources, 97);
});

test('source coverage and both per-source minimums are required for completeness', () => {
  const absentCoverage = policyFixture();
  absentCoverage.expected_source_refs = null;
  absentCoverage.source_evaluations = null;
  const absent = scorePrivacyAggregate(absentCoverage);
  assert.equal(absent.status, 'INCOMPLETE');
  assert.ok(absent.source_completeness.incomplete_reasons.includes('EXPECTED_SOURCE_REFS_REQUIRED'));
  assert.ok(absent.source_completeness.incomplete_reasons.includes('SOURCE_EVALUATIONS_REQUIRED'));

  const shortEvaluation = policyFixture();
  shortEvaluation.source_evaluations = shortEvaluation.source_evaluations.map((evaluation, index) => (
    index === 0
      ? { ...evaluation, adjudicated_segments: 19, non_drj_segments: 9 }
      : evaluation
  ));
  const short = scorePrivacyAggregate(shortEvaluation);
  assert.equal(short.status, 'INCOMPLETE');
  assert.ok(short.source_completeness.incomplete_reasons.includes(
    'MINIMUM_ADJUDICATED_SEGMENTS_PER_SOURCE_NOT_MET',
  ));
  assert.ok(short.source_completeness.incomplete_reasons.includes(
    'MINIMUM_NON_DRJ_SEGMENTS_PER_SOURCE_NOT_MET',
  ));

  const imbalancedGold = policyFixture();
  const firstNonDrj = imbalancedGold.labels.find((label) => (
    label.privacy_class === 'NON_DRJ_SPEECH' && label.source_ref === SYNTHETIC_SOURCE_REFS[0]
  ));
  firstNonDrj.source_ref = SYNTHETIC_SOURCE_REFS[1];
  const imbalanced = scorePrivacyAggregate(imbalancedGold);
  assert.equal(imbalanced.status, 'INCOMPLETE');
  assert.ok(imbalanced.source_completeness.incomplete_reasons.includes(
    'MINIMUM_NON_DRJ_GOLD_PER_SOURCE_NOT_MET',
  ));
});

test('missing or zero evaluated_counts can never infer coverage from gold labels', () => {
  const fixture = policyFixture();
  const missing = scorePrivacyAggregate({ labels: fixture.labels, detections: fixture.detections });
  assert.equal(missing.status, 'INCOMPLETE');
  assert.ok(missing.required_classes.PATIENT_DIRECT_IDENTIFIER.incomplete_reasons.includes('EVALUATED_COUNTS_REQUIRED'));

  const zeroCounts = { ...fixture.evaluated_counts, STUDENT_NAME: 0 };
  const zero = scorePrivacyAggregate({ ...fixture, evaluated_counts: zeroCounts });
  assert.equal(zero.status, 'INCOMPLETE');
  assert.ok(zero.required_classes.STUDENT_NAME.incomplete_reasons.includes('ZERO_EVALUATED_ITEMS'));

  for (const invalidValue of [null, '300']) {
    const invalidCounts = { ...fixture.evaluated_counts, STUDENT_NAME: invalidValue };
    const invalid = scorePrivacyAggregate({ ...fixture, evaluated_counts: invalidCounts });
    assert.equal(invalid.status, 'INCOMPLETE');
    assert.ok(invalid.required_classes.STUDENT_NAME.incomplete_reasons.includes('INVALID_EVALUATED_ITEM_COUNT'));
  }
});

test('every omitted required class in evaluation coverage or gold labels is incomplete', async (t) => {
  const fixture = policyFixture();
  for (const privacyClass of REQUIRED_PRIVACY_EVALUATION_CLASSES) {
    await t.test(privacyClass, () => {
      const evaluated_counts = { ...fixture.evaluated_counts };
      delete evaluated_counts[privacyClass];
      const result = scorePrivacyAggregate({ ...fixture, evaluated_counts });
      assert.equal(result.status, 'INCOMPLETE');
      assert.ok(result.required_classes[privacyClass].incomplete_reasons.includes('EVALUATION_CLASS_OMITTED'));

      const missingGold = scorePrivacyAggregate({
        ...fixture,
        detections: fixture.detections.filter((entry) => entry.privacy_class !== privacyClass),
        labels: fixture.labels.filter((entry) => entry.privacy_class !== privacyClass),
      });
      assert.equal(missingGold.status, 'INCOMPLETE');
      assert.ok(missingGold.required_classes[privacyClass].incomplete_reasons.includes('ZERO_GOLD_POSITIVES'));
    });
  }
});

test('every class minimum is enforced without materializing a disk fixture', async (t) => {
  for (const privacyClass of REQUIRED_PRIVACY_EVALUATION_CLASSES) {
    await t.test(privacyClass, () => {
      const minimum = PRIVACY_EVALUATION_POLICY.classes[privacyClass].minimum_gold_positives;
      const fixture = policyFixture({ [privacyClass]: minimum - 1 });
      const result = scorePrivacyAggregate(fixture);
      assert.equal(result.status, 'INCOMPLETE');
      assert.ok(result.required_classes[privacyClass].incomplete_reasons.includes('GOLD_MINIMUM_NOT_MET'));
    });
  }
});

test('historical missing patient_identifier gold class cannot aggregate to pass', () => {
  const fixture = policyFixture();
  fixture.labels = fixture.labels.filter(
    (label) => label.privacy_class !== 'PATIENT_DIRECT_IDENTIFIER',
  );
  fixture.detections = fixture.detections.filter(
    (detection) => detection.privacy_class !== 'PATIENT_DIRECT_IDENTIFIER',
  );
  const result = scorePrivacyAggregate(fixture);
  assert.equal(result.status, 'INCOMPLETE');
  assert.equal(result.required_classes.PATIENT_DIRECT_IDENTIFIER.denominator, 0);
  assert.ok(result.required_classes.PATIENT_DIRECT_IDENTIFIER.incomplete_reasons.includes('ZERO_GOLD_POSITIVES'));
});

test('a complete zero-recall class fails even when aggregate reporting looks strong', () => {
  const fixture = policyFixture();
  fixture.detections = fixture.detections.filter(
    (detection) => detection.privacy_class !== 'THIRD_PARTY_IDENTITY',
  );
  const result = scorePrivacyAggregate(fixture);
  const classScore = result.required_classes.THIRD_PARTY_IDENTITY;
  assert.equal(classScore.recall, 0);
  assert.equal(classScore.status, 'FAIL');
  assert.ok(classScore.failure_reasons.includes('RECALL_POINT_BELOW_THRESHOLD'));
  assert.ok(classScore.failure_reasons.includes('ZERO_PRECISION_DENOMINATOR'));
  assert.equal(result.patient_identifying_information.status, 'PASS');
  assert.equal(result.status, 'FAIL');
});

test('exact lower-bound gate fails even when patient point recall passes', () => {
  const fixture = policyFixture();
  const omittedId = 'PATIENT_DIRECT_IDENTIFIER_599';
  fixture.detections = fixture.detections.filter((detection) => detection.label_id !== omittedId);
  const result = scorePrivacyAggregate(fixture);
  const direct = result.required_classes.PATIENT_DIRECT_IDENTIFIER;

  assert.equal(direct.recall, 599 / 600);
  assert.ok(direct.recall > direct.recall_threshold);
  assert.ok(direct.exact_recall_lower_bound_95 < direct.recall_threshold);
  assert.ok(direct.failure_reasons.includes('RECALL_EXACT_LOWER_BOUND_BELOW_THRESHOLD'));
  assert.equal(direct.status, 'FAIL');
  assert.equal(result.status, 'FAIL');
  assert.equal(exactBinomialLowerConfidenceBound(600, 600), 0.05 ** (1 / 600));
});

test('patient aggregate enforces its exact lower bound independently of its point estimate', () => {
  const fixture = policyFixture();
  const omittedIds = new Set([
    'PATIENT_DIRECT_IDENTIFIER_598',
    'PATIENT_DIRECT_IDENTIFIER_599',
    'PATIENT_QUASI_IDENTIFIER_599',
    'IDENTIFYING_CLINICAL_ANECDOTE_599',
  ]);
  fixture.detections = fixture.detections.filter(
    (detection) => !omittedIds.has(detection.label_id),
  );
  const aggregate = scorePrivacyAggregate(fixture).patient_identifying_information;
  assert.ok(aggregate.recall > aggregate.recall_threshold);
  assert.ok(aggregate.exact_recall_lower_bound_95 < aggregate.recall_threshold);
  assert.ok(aggregate.failure_reasons.includes('PATIENT_RECALL_EXACT_LOWER_BOUND_BELOW_THRESHOLD'));
  assert.equal(aggregate.status, 'FAIL');
});

test('NON_DRJ_SPEECH and SOURCE_METADATA each fail on one zero-tolerance miss', async (t) => {
  for (const privacyClass of ['NON_DRJ_SPEECH', 'SOURCE_METADATA']) {
    await t.test(privacyClass, () => {
      const fixture = policyFixture();
      fixture.detections = fixture.detections.filter(
        (detection) => detection.label_id !== `${privacyClass}_0`,
      );
      const result = scorePrivacyAggregate(fixture);
      assert.equal(result.required_classes[privacyClass].misses, 1);
      assert.ok(result.required_classes[privacyClass].failure_reasons.includes('ZERO_TOLERANCE_MISS'));
      assert.equal(result.required_classes[privacyClass].status, 'FAIL');
      assert.equal(result.status, 'FAIL');
    });
  }
});

test('precision floor and canonical source metadata scoring are enforced', () => {
  const fixture = policyFixture();
  for (let index = 0; index < 34; index += 1) {
    fixture.detections.push({
      label_id: `STUDENT_NAME_FALSE_POSITIVE_${index}`,
      privacy_class: 'STUDENT_NAME',
    });
  }
  const result = scorePrivacyAggregate(fixture);
  assert.ok(result.required_classes.STUDENT_NAME.precision < 0.90);
  assert.ok(result.required_classes.STUDENT_NAME.failure_reasons.includes('PRECISION_BELOW_THRESHOLD'));
  assert.equal(result.required_classes.SOURCE_METADATA.status, 'PASS');
  assert.deepEqual(result.unexpected_classes, []);
  assert.equal(result.status, 'FAIL');
});

test('legacy detector aliases roll up deterministically to canonical classes', () => {
  const result = scorePrivacyAggregate({
    detections: [
      { label_id: 'speech_0', privacy_class: 'student_speech' },
      { label_id: 'patient_0', privacy_class: 'patient_identifier' },
      { label_id: 'metadata_0', privacy_class: 'source_metadata' },
    ],
    evaluated_counts: Object.fromEntries(REQUIRED_PRIVACY_EVALUATION_CLASSES.map((value) => [value, 1])),
    labels: [
      { id: 'speech_0', privacy_class: 'NON_DRJ_SPEECH' },
      { id: 'patient_0', privacy_class: 'PATIENT_DIRECT_IDENTIFIER' },
      { id: 'metadata_0', privacy_class: 'SOURCE_METADATA' },
    ],
  });
  assert.equal(result.status, 'INCOMPLETE');
  assert.equal(result.required_classes.NON_DRJ_SPEECH.matched, 1);
  assert.equal(result.required_classes.PATIENT_DIRECT_IDENTIFIER.matched, 1);
  assert.equal(result.required_classes.SOURCE_METADATA.matched, 1);
  assert.deepEqual(result.unexpected_classes, []);
});

test('candidate validation rejects raw text aliases and original source metadata keys', () => {
  const [candidate] = detectQuestionCandidates([normalizeOne()], {
    classifyMedical: () => ({ confidence: 1, medical: true }),
  });
  const unsafe = {
    ...candidate,
    source_lineage: {
      ...candidate.source_lineage,
      raw_text: 'SYNTHETIC_UNSAFE_TEXT',
      title: 'SYNTHETIC_UNSAFE_TITLE',
      video_id: 'SYNTHETIC_UNSAFE_ID',
    },
  };
  const errors = validateDraftCandidate(unsafe);
  assert.ok(errors.includes('unsafe_source_text_field:$.source_lineage.raw_text'));
  assert.ok(errors.includes('unsafe_source_metadata_field:$.source_lineage.title'));
  assert.ok(errors.includes('unsafe_source_metadata_field:$.source_lineage.video_id'));

  const unverified = validateDraftCandidate({ ...candidate, speaker_role: 'UNKNOWN' });
  assert.ok(unverified.includes('verified_drj_segment_required'));
});

test('normalization is byte-for-byte deterministic for the same non-medical input', () => {
  const first = normalizeOne({
    node_links: ['SYNTHETIC_NODE_A', 'SYNTHETIC_NODE_B'],
    text: 'Which [STUDENT_NAME:SYNTHETIC_STUDENT] symbol is selected?',
  });
  const second = normalizeOne({
    node_links: ['SYNTHETIC_NODE_A', 'SYNTHETIC_NODE_B'],
    text: 'Which [STUDENT_NAME:SYNTHETIC_STUDENT] symbol is selected?',
  });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
