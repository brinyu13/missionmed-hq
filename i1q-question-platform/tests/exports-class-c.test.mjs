import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertClassCStatDebriefArtifact,
  buildReleaseArtifacts,
  validateClassCStatDebriefArtifact,
} from '../src/exports.mjs';

const DEBRIEF_FIELDS = Object.freeze([
  'dataset_version',
  'question_id',
  'answer',
  'explanation',
  'correct_answer_rationale',
  'distractor_rationales',
]);

const RATIONALE_FIELDS = Object.freeze([
  'choice_key',
  'why_tempting',
  'why_wrong',
]);

const CLASS_D_AND_UNKNOWN_FIELDS = Object.freeze([
  'misconception_id',
  'item_id',
  'itemrev_id',
  'item_revision_id',
  'source_id',
  'source_record_id',
  'source_ids',
  'claim_id',
  'evidence_claim_id',
  'evidence_claim_ids',
  'reviewer_id',
  'reviewer_identity',
  'psychometrics',
  'percent_correct',
  'unknown_field',
]);

function makeSyntheticRevision() {
  const choice = (key, text, suffix) => ({
    key,
    text,
    why_tempting: `Synthetic lure ${suffix}`,
    why_wrong: `Synthetic mismatch ${suffix}`,
    misconception_id: `internal_misconception_${suffix}`,
    item_id: `internal_choice_item_${suffix}`,
    itemrev_id: `internal_choice_revision_${suffix}`,
    source_id: `internal_choice_source_${suffix}`,
    claim_id: `internal_choice_claim_${suffix}`,
    reviewer_id: `internal_choice_reviewer_${suffix}`,
    psychometrics: { selection_rate: 0.25 },
    unknown_field: `internal_choice_unknown_${suffix}`,
  });
  return {
    id: 'internal_item_revision_synthetic',
    item_id: 'internal_item_synthetic',
    revision_number: 1,
    content_hash: 'a'.repeat(64),
    export_question_id: 'I1Q-SYNTHETIC-CLASS-C-0001',
    prompt: 'Which label matches the synthetic square?',
    choices: [
      choice('A', 'Label alpha', 'alpha'),
      {
        key: 'B',
        text: 'Label beta',
        why_tempting: null,
        why_wrong: null,
        misconception_id: null,
      },
      choice('C', 'Label gamma', 'gamma'),
      choice('D', 'Label delta', 'delta'),
    ],
    answer: 'B',
    explanation: 'The synthetic key maps the square to label beta.',
    correct_answer_rationale: 'The synthetic fixture explicitly identifies label beta.',
    topic: 'Synthetic classification',
    subtopic: 'Shapes',
    concept_id: 'internal_concept_synthetic',
    source_ids: ['internal_source_synthetic'],
    evidence_claim_ids: ['internal_claim_synthetic'],
    reviewer_id: 'internal_reviewer_synthetic',
    psychometrics: {
      calibration_id: 'internal_psychometric_synthetic',
      percent_correct: 0.75,
    },
    unknown_field: 'internal_unknown_synthetic',
    drills: {
      video_id: 'synthetic_video',
      source_record_id: 'internal_source_synthetic',
      title: 'Synthetic classification drill',
      playback: {
        availability: 'available',
        url: 'https://example.invalid/synthetic/playback',
        stream_id: null,
      },
      nodes: {
        availability: 'available',
        url: 'https://example.invalid/synthetic/nodes.json',
      },
      transcript: { availability: 'missing', url: null },
      vtt: { availability: 'unknown', url: null },
      timestamp: { start_seconds: 10, end_seconds: 20 },
      rights_status: 'cleared_for',
      privacy_status: 'pass',
      source_hash: 'b'.repeat(64),
      working_hash: 'c'.repeat(64),
    },
  };
}

function validDebrief() {
  return {
    dataset_version: 'synthetic_v1',
    question_id: 'I1Q-SYNTHETIC-CLASS-C-0001',
    answer: 'B',
    explanation: 'Synthetic explanation prose.',
    correct_answer_rationale: 'Synthetic correct rationale prose.',
    distractor_rationales: ['A', 'C', 'D'].map((choiceKey) => ({
      choice_key: choiceKey,
      why_tempting: `Synthetic lure ${choiceKey}.`,
      why_wrong: `Synthetic mismatch ${choiceKey}.`,
    })),
  };
}

function encodeUnderscores(value, depth) {
  let encoded = value;
  for (let pass = 0; pass < depth; pass += 1) {
    encoded = encoded.replaceAll('%', '%25').replaceAll('_', '%5F');
  }
  return encoded;
}

function encodeAscii(value, depth) {
  let encoded = [...Buffer.from(value, 'utf8')]
    .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
    .join('');
  for (let pass = 1; pass < depth; pass += 1) {
    encoded = encoded.replaceAll('%', '%25');
  }
  return encoded;
}

test('Class C construction strips Class D fields and preserves teaching prose', () => {
  const generated = buildReleaseArtifacts({
    releaseId: 'synthetic_release_class_c',
    datasetVersion: 'synthetic_v1',
    revisions: [makeSyntheticRevision()],
  });
  const artifact = generated.artifacts.find((entry) => entry.channel === 'stat_post_answer_debrief');
  assert.equal(artifact.phase, 'post_answer');
  assert.equal(artifact.data_class, 'C');
  assert.deepEqual(validateClassCStatDebriefArtifact(artifact.payload), []);

  const [debrief] = artifact.payload;
  assert.deepEqual(Object.keys(debrief), DEBRIEF_FIELDS);
  assert.equal(debrief.explanation, 'The synthetic key maps the square to label beta.');
  assert.equal(debrief.correct_answer_rationale, 'The synthetic fixture explicitly identifies label beta.');
  assert.deepEqual(
    debrief.distractor_rationales.map((rationale) => Object.keys(rationale)),
    [RATIONALE_FIELDS, RATIONALE_FIELDS, RATIONALE_FIELDS],
  );
  assert.deepEqual(
    debrief.distractor_rationales.map(({ choice_key: choiceKey, why_tempting: whyTempting, why_wrong: whyWrong }) => ({
      choice_key: choiceKey,
      why_tempting: whyTempting,
      why_wrong: whyWrong,
    })),
    [
      { choice_key: 'A', why_tempting: 'Synthetic lure alpha', why_wrong: 'Synthetic mismatch alpha' },
      { choice_key: 'C', why_tempting: 'Synthetic lure gamma', why_wrong: 'Synthetic mismatch gamma' },
      { choice_key: 'D', why_tempting: 'Synthetic lure delta', why_wrong: 'Synthetic mismatch delta' },
    ],
  );

  const serialized = JSON.stringify(artifact.payload);
  for (const forbidden of [
    'misconception',
    'internal_item_synthetic',
    'internal_item_revision_synthetic',
    'internal_source_synthetic',
    'internal_claim_synthetic',
    'internal_reviewer_synthetic',
    'percent_correct',
    'internal_unknown_synthetic',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('Class C validation rejects unknown fields at both closed-world object levels', () => {
  for (const field of CLASS_D_AND_UNKNOWN_FIELDS) {
    const topLevel = { ...validDebrief(), [field]: `internal_${field}` };
    assert.throws(() => assertClassCStatDebriefArtifact([topLevel]), (error) => {
      assert.equal(error.code, 'class_c_debrief_validation_failed');
      assert.equal(error.statusCode, 422);
      assert.ok(error.findings.includes(`$[0].${field}:unknown_field`));
      return true;
    });

    const nested = validDebrief();
    nested.distractor_rationales[0][field] = `internal_${field}`;
    assert.throws(() => assertClassCStatDebriefArtifact([nested]), (error) => {
      assert.equal(error.code, 'class_c_debrief_validation_failed');
      assert.equal(error.statusCode, 422);
      assert.ok(error.findings.includes(`$[0].distractor_rationales[0].${field}:unknown_field`));
      return true;
    });
  }
});

test('artifact construction rejects identifiers hidden inside teaching prose fields', () => {
  const revision = makeSyntheticRevision();
  revision.choices[0].why_wrong = {
    text: 'Synthetic mismatch alpha',
    claim_id: 'internal_claim_hidden',
  };
  assert.throws(() => buildReleaseArtifacts({
    releaseId: 'synthetic_release_nested_identifier',
    datasetVersion: 'synthetic_v1',
    revisions: [revision],
  }), (error) => {
    assert.equal(error.code, 'class_c_debrief_validation_failed');
    assert.ok(error.findings.includes('$[0].distractor_rationales[0].why_wrong:string_required'));
    return true;
  });
});

test('Class C construction rejects internal identifier values in every prose field', () => {
  const fieldMutators = [
    (revision, value) => { revision.explanation = value; },
    (revision, value) => { revision.correct_answer_rationale = value; },
    (revision, value) => { revision.choices[0].why_tempting = value; },
    (revision, value) => { revision.choices[0].why_wrong = value; },
  ];
  const valueSelectors = [
    (revision) => revision.id,
    (revision) => revision.item_id,
    (revision) => revision.concept_id,
    (revision) => revision.source_ids[0],
    (revision) => revision.evidence_claim_ids[0],
    (revision) => revision.reviewer_id,
    (revision) => revision.choices[0].misconception_id,
    (revision) => revision.drills.source_record_id,
  ];

  for (const mutate of fieldMutators) {
    for (const selectValue of valueSelectors) {
      const revision = makeSyntheticRevision();
      const forbiddenValue = selectValue(revision);
      mutate(revision, `Synthetic prose containing ${forbiddenValue}.`);
      assert.throws(() => buildReleaseArtifacts({
        releaseId: 'synthetic_release_class_d_value',
        datasetVersion: 'synthetic_v1',
        revisions: [revision],
      }), (error) => {
        assert.equal(error.code, 'class_c_debrief_validation_failed');
        assert.equal(error.statusCode, 422);
        assert.ok(error.findings.some((finding) => finding.endsWith(':class_d_identifier_value')));
        assert.equal(JSON.stringify(error.findings).includes(forbiddenValue), false);
        return true;
      });
    }
  }
});

test('Class C value isolation rejects encoded IDs and structured Class D markers', () => {
  for (const transform of [
    (value) => encodeURIComponent(value),
    (value) => Buffer.from(value, 'utf8').toString('base64'),
    (value) => Buffer.from(value, 'utf8').toString('base64url'),
  ]) {
    const revision = makeSyntheticRevision();
    revision.choices[0].why_wrong = `Synthetic encoded value ${transform(revision.source_ids[0])}`;
    assert.throws(() => buildReleaseArtifacts({
      releaseId: 'synthetic_release_encoded_class_d',
      datasetVersion: 'synthetic_v1',
      revisions: [revision],
    }), (error) => (
      error.code === 'class_c_debrief_validation_failed'
      && error.findings.some((finding) => finding.endsWith(':class_d_identifier_value'))
    ));
  }

  const revision = makeSyntheticRevision();
  revision.correct_answer_rationale = 'Synthetic object marker {"reviewer_id":"opaque"}.';
  assert.throws(() => buildReleaseArtifacts({
    releaseId: 'synthetic_release_structured_class_d',
    datasetVersion: 'synthetic_v1',
    revisions: [revision],
  }), (error) => (
    error.code === 'class_c_debrief_validation_failed'
    && error.findings.some((finding) => finding.endsWith(':class_d_field_marker'))
  ));
});

test('Class C rejects mixed-case identifier bytes encoded as base64 in every prose field', () => {
  const injectors = [
    (revision, value) => { revision.explanation = `Synthetic prose ${value}.`; },
    (revision, value) => { revision.correct_answer_rationale = `Synthetic prose ${value}.`; },
    (revision, value) => { revision.choices[0].why_tempting = `Synthetic prose ${value}.`; },
    (revision, value) => { revision.choices[0].why_wrong = `Synthetic prose ${value}.`; },
  ];
  const transforms = [
    (value) => Buffer.from(value, 'utf8').toString('base64'),
    (value) => Buffer.from(value, 'utf8').toString('base64url'),
  ];

  for (const inject of injectors) {
    for (const transform of transforms) {
      const revision = makeSyntheticRevision();
      revision.source_ids = ['Internal_Source_MixedCase'];
      inject(revision, transform(revision.source_ids[0]));
      assert.throws(() => buildReleaseArtifacts({
        releaseId: 'synthetic_release_mixed_case_encoded_class_d',
        datasetVersion: 'synthetic_v1',
        revisions: [revision],
      }), (error) => (
        error.code === 'class_c_debrief_validation_failed'
        && error.statusCode === 422
        && error.findings.some((finding) => finding.endsWith(':class_d_identifier_value'))
        && !JSON.stringify(error.findings).includes(revision.source_ids[0])
      ));
    }
  }
});

test('Class C value isolation permits the opaque release question ID outside prose', () => {
  const revision = makeSyntheticRevision();
  const generated = buildReleaseArtifacts({
    releaseId: 'synthetic_release_question_id_allowed',
    datasetVersion: 'synthetic_v1',
    revisions: [revision],
  });
  const artifact = generated.artifacts.find((entry) => entry.channel === 'stat_post_answer_debrief');
  assert.equal(artifact.payload[0].question_id, revision.export_question_id);
  assert.deepEqual(validateClassCStatDebriefArtifact(artifact.payload), []);
});

test('Class C rejects valid-string Class D values in every permitted prose field', () => {
  const identifierCases = [
    ['item', (revision) => revision.item_id],
    ['revision', (revision) => revision.id],
    ['source', (revision) => revision.source_ids[0]],
    ['claim', (revision) => revision.evidence_claim_ids[0]],
    ['reviewer', (revision) => revision.reviewer_id],
    ['misconception', (revision) => revision.choices[0].misconception_id],
    ['psychometric', (revision) => revision.psychometrics.calibration_id],
  ];
  const injectors = [
    ['explanation', (revision, value) => { revision.explanation = `Synthetic prose ${value}.`; }],
    ['correct rationale', (revision, value) => { revision.correct_answer_rationale = `Synthetic prose ${value}.`; }],
    ['why tempting', (revision, value) => { revision.choices[0].why_tempting = `Synthetic prose ${value}.`; }],
    ['why wrong', (revision, value) => { revision.choices[0].why_wrong = `Synthetic prose ${value}.`; }],
  ];

  for (const [identifierName, identifier] of identifierCases) {
    for (const [fieldName, inject] of injectors) {
      const revision = makeSyntheticRevision();
      inject(revision, identifier(revision));
      assert.throws(() => buildReleaseArtifacts({
        releaseId: `synthetic_release_${identifierName}_${fieldName.replace(' ', '_')}`,
        datasetVersion: 'synthetic_v1',
        revisions: [revision],
      }), (error) => {
        assert.equal(error.code, 'class_c_debrief_validation_failed');
        assert.ok(error.findings.some((finding) => finding.endsWith(':class_d_identifier_value')));
        return true;
      }, `${identifierName} in ${fieldName}`);
    }
  }
});

test('Class C rejects double and triple URL encoding for every identifier family and prose field', () => {
  const identifierCases = [
    ['item', (revision) => revision.item_id],
    ['revision', (revision) => revision.id],
    ['source', (revision) => revision.source_ids[0]],
    ['claim', (revision) => revision.evidence_claim_ids[0]],
    ['reviewer', (revision) => revision.reviewer_id],
    ['misconception', (revision) => revision.choices[0].misconception_id],
    ['psychometric', (revision) => revision.psychometrics.calibration_id],
  ];
  const injectors = [
    ['explanation', (revision, value) => { revision.explanation = `Synthetic prose ${value}.`; }],
    ['correct_rationale', (revision, value) => { revision.correct_answer_rationale = `Synthetic prose ${value}.`; }],
    ['why_tempting', (revision, value) => { revision.choices[0].why_tempting = `Synthetic prose ${value}.`; }],
    ['why_wrong', (revision, value) => { revision.choices[0].why_wrong = `Synthetic prose ${value}.`; }],
  ];

  for (const [encodingName, encode] of [['separator', encodeUnderscores], ['ascii', encodeAscii]]) {
    for (const depth of [2, 3]) {
      for (const [identifierName, identifier] of identifierCases) {
        for (const [fieldName, inject] of injectors) {
          const revision = makeSyntheticRevision();
          inject(revision, encode(identifier(revision), depth));
          assert.throws(() => buildReleaseArtifacts({
            releaseId: `synthetic_release_${encodingName}_${depth}_${identifierName}_${fieldName}`,
            datasetVersion: 'synthetic_v1',
            revisions: [revision],
          }), (error) => (
            error.code === 'class_c_debrief_validation_failed'
            && error.findings.some((finding) => finding.endsWith(':class_d_identifier_value'))
          ));
        }
      }
    }
  }
});

test('Class C rejects encoded internal field markers in otherwise valid prose', () => {
  for (const [index, marker] of [
    'source_id=internal',
    'source%5Fid=internal',
    'source%255Fid=internal',
    'source%25255Fid=internal',
    'source\\u005fid=internal',
    'source&#95;id=internal',
    'source_\u200Bid=internal',
  ].entries()) {
    const revision = makeSyntheticRevision();
    revision.explanation = `Synthetic prose must not serialize ${marker}.`;
    assert.throws(() => buildReleaseArtifacts({
      releaseId: `synthetic_release_class_d_marker_${index}`,
      datasetVersion: 'synthetic_v1',
      revisions: [revision],
    }), (error) => {
      assert.equal(error.code, 'class_c_debrief_validation_failed');
      assert.ok(error.findings.includes('$[0].explanation:class_d_field_marker'));
      return true;
    });
  }
});

test('Class C fails closed when iterative decoding exceeds the bounded depth', () => {
  const revision = makeSyntheticRevision();
  revision.explanation = `Synthetic prose ${encodeUnderscores(revision.source_ids[0], 9)}.`;
  assert.throws(() => buildReleaseArtifacts({
    releaseId: 'synthetic_release_decode_depth_limit',
    datasetVersion: 'synthetic_v1',
    revisions: [revision],
  }), (error) => (
    error.code === 'class_c_security_decode_depth_limit'
    && error.statusCode === 422
  ));
});

test('Class C fails closed when security text exceeds the bounded size', () => {
  const revision = makeSyntheticRevision();
  revision.explanation = 'x'.repeat((64 * 1024) + 1);
  assert.throws(() => buildReleaseArtifacts({
    releaseId: 'synthetic_release_decode_size_limit',
    datasetVersion: 'synthetic_v1',
    revisions: [revision],
  }), (error) => (
    error.code === 'class_c_security_decode_size_limit'
    && error.statusCode === 422
  ));
});

test('Class C rejects simply encoded internal identifier values', () => {
  for (const [index, encodedSourceId] of [
    'internal%5Fsource%5Fsynthetic',
    'internal\\u005fsource\\u005fsynthetic',
    'internal&#95;source&#95;synthetic',
    'internal_\u200Bsource_synthetic',
  ].entries()) {
    const revision = makeSyntheticRevision();
    revision.explanation = `Synthetic prose ${encodedSourceId}.`;
    assert.throws(() => buildReleaseArtifacts({
      releaseId: `synthetic_release_encoded_class_d_value_${index}`,
      datasetVersion: 'synthetic_v1',
      revisions: [revision],
    }), (error) => {
      assert.equal(error.code, 'class_c_debrief_validation_failed');
      assert.ok(error.findings.includes('$[0].explanation:class_d_identifier_value'));
      return true;
    });
  }
});

test('additional release-linked reviewer identifiers are included in the Class D value scan', () => {
  const revision = makeSyntheticRevision();
  delete revision.reviewer_id;
  revision.explanation = 'Synthetic prose internal_linked_reviewer.';
  assert.throws(() => buildReleaseArtifacts({
    releaseId: 'synthetic_release_linked_reviewer',
    datasetVersion: 'synthetic_v1',
    revisions: [revision],
    additionalClassDRecordsByRevisionId: {
      [revision.id]: [{ reviewer_id: 'internal_linked_reviewer' }],
    },
  }), (error) => {
    assert.equal(error.code, 'class_c_debrief_validation_failed');
    assert.ok(error.findings.includes('$[0].explanation:class_d_identifier_value'));
    return true;
  });
});
