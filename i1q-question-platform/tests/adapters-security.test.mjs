import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  STAT_CHANNEL_CONTRACTS,
  STAT_DATASET_FIELDS,
} from '../src/contracts.mjs';
import {
  assertClassAArtifact,
  assertExactStatDatasetQuestion,
  assertPostAnswerAccess,
  buildReleaseArtifacts,
  compositeQuestionIdentity,
  createHistoricalJoinIdentity,
  projectDrillsAdapter,
  projectStatDatasetQuestion,
  scanForAnswerLeak,
  validateClassAArtifact,
  validateDailyRegistryRow,
} from '../src/exports.mjs';
import { statPackHash } from '../src/hash.mjs';

const VECTOR_URL = new URL(
  '../../_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/lorentz_security/transformation_test_vectors.json',
  import.meta.url,
);
const vectorDocument = JSON.parse(readFileSync(VECTOR_URL, 'utf8'));

function assertCode(operation, expectedCode, expectedField = null) {
  assert.throws(operation, (error) => {
    assert.equal(error.code, expectedCode);
    if (expectedField !== null) assert.equal(error.field, expectedField);
    return true;
  });
}

function mergeAsset(base, override) {
  if (override === undefined) return structuredClone(base);
  if (override === null) return null;
  return { ...structuredClone(base), ...structuredClone(override) };
}

function makeRevision(suffix = 'a', overrides = {}) {
  const base = {
    id: `itemrev_${suffix}`,
    item_id: `item_${suffix}`,
    revision_number: 1,
    content_hash: suffix.slice(0, 1).padEnd(64, suffix.slice(0, 1) || 'a'),
    export_question_id: `I1Q-FIXTURE-${suffix.toUpperCase()}`,
    prompt: `Which label matches synthetic fixture ${suffix}?`,
    choices: [
      { key: 'A', text: `Alpha ${suffix}`, why_tempting: 'Synthetic lure', why_wrong: 'Synthetic mismatch', misconception_id: 'miscon_alpha' },
      { key: 'B', text: `Beta ${suffix}`, why_tempting: null, why_wrong: null, misconception_id: null },
      { key: 'C', text: `Gamma ${suffix}`, why_tempting: 'Synthetic lure', why_wrong: 'Synthetic mismatch', misconception_id: 'miscon_gamma' },
      { key: 'D', text: `Delta ${suffix}`, why_tempting: 'Synthetic lure', why_wrong: 'Synthetic mismatch', misconception_id: 'miscon_delta' },
    ],
    answer: 'B',
    explanation: `Synthetic fixture ${suffix} maps to beta.`,
    correct_answer_rationale: 'Synthetic fixture key.',
    topic: 'Synthetic fixtures',
    subtopic: 'Classification',
    concept_id: `concept_${suffix}`,
    source_ids: [`src_${suffix}`],
    drills: {
      video_id: `video_${suffix}`,
      source_record_id: `src_${suffix}`,
      title: `Synthetic drill ${suffix}`,
      playback: {
        availability: 'available',
        url: `https://example.invalid/${suffix}/playback`,
        stream_id: null,
      },
      nodes: {
        availability: 'available',
        url: `https://example.invalid/${suffix}/nodes.json`,
      },
      transcript: {
        availability: 'missing',
        url: null,
      },
      vtt: {
        availability: 'unknown',
        url: null,
      },
      timestamp: {
        start_seconds: 10,
        end_seconds: 20,
      },
      rights_status: 'cleared_for',
      privacy_status: 'pass_with_redactions',
      source_hash: 'c'.repeat(64),
      working_hash: 'd'.repeat(64),
    },
  };
  const drillsOverride = overrides.drills;
  const merged = { ...base, ...structuredClone(overrides) };
  if (drillsOverride !== null) {
    const source = drillsOverride === undefined ? {} : drillsOverride;
    merged.drills = {
      ...base.drills,
      ...structuredClone(source),
      playback: mergeAsset(base.drills.playback, source.playback),
      nodes: mergeAsset(base.drills.nodes, source.nodes),
      transcript: mergeAsset(base.drills.transcript, source.transcript),
      vtt: mergeAsset(base.drills.vtt, source.vtt),
      timestamp: mergeAsset(base.drills.timestamp, source.timestamp),
    };
  }
  return merged;
}

function buildFixtureRelease(revisions, overrides = {}) {
  return buildReleaseArtifacts({
    releaseId: overrides.releaseId || 'release_fixture',
    datasetVersion: overrides.datasetVersion || 'fixture_v1',
    revisions,
    previousManifestHash: overrides.previousManifestHash || null,
  });
}

function executeTransformationVector(vector) {
  switch (vector.id) {
    case 'TV-STAT-001': {
      const revision = makeRevision('a', {
        prompt: vector.input.prompt,
        choices: vector.input.choices.map((text, index) => ({
          key: ['A', 'B', 'C', 'D'][index],
          text,
        })),
        answer: vector.input.answer,
        explanation: vector.input.explanation,
      });
      const row = projectStatDatasetQuestion({
        revision,
        datasetVersion: vector.input.dataset_version,
        questionId: vector.input.question_id,
      });
      assert.deepEqual(Object.keys(row), vector.expected.keys_in_order);
      assert.deepEqual(Object.keys(row).filter((key) => !vector.expected.keys_in_order.includes(key)), vector.expected.extra_keys);
      return;
    }
    case 'TV-STAT-002': {
      const exact = projectStatDatasetQuestion({
        revision: makeRevision('a'),
        datasetVersion: 'fixture_v1',
        questionId: 'I1Q-FIXTURE-A',
      });
      assertCode(() => assertExactStatDatasetQuestion({ ...exact, ...vector.input.added_field }), vector.expected.code);
      return;
    }
    case 'TV-CANON-001': {
      const actual = statPackHash({
        datasetVersion: vector.input.dataset_version,
        questionIds: vector.input.question_ids,
        choicesOrder: vector.input.choices_order,
      });
      assert.equal(actual, vector.expected.sha256);
      return;
    }
    case 'TV-ID-001': {
      const identities = vector.input.map((entry) => compositeQuestionIdentity(entry.dataset_version, entry.question_id));
      assert.equal(new Set(identities).size, vector.expected.distinct_records);
      return;
    }
    case 'TV-ID-002': {
      const [left, right] = vector.input;
      assertCode(() => buildFixtureRelease([
        makeRevision('a', { id: left.itemrev_id, export_question_id: left.question_id }),
        makeRevision('b', { id: right.itemrev_id, export_question_id: right.question_id }),
      ], { datasetVersion: left.dataset_version }), vector.expected.code);
      return;
    }
    case 'TV-ID-003': {
      assertCode(() => buildFixtureRelease([
        makeRevision('a', { export_question_id: undefined }),
      ]), 'export_question_id_required');
      return;
    }
    case 'TV-LEAK-001':
    case 'TV-LEAK-002': {
      assert.throws(() => assertClassAArtifact('stat_pre_answer', vector.input.payload), (error) => {
        assert.equal(error.code, 'class_a_validation_failed');
        assert.ok(error.findings.includes(vector.expected.path));
        return true;
      });
      return;
    }
    case 'TV-LEAK-003':
    case 'TV-LEAK-004': {
      assertCode(() => assertPostAnswerAccess({
        serverState: vector.input.server_state,
        callerIsParticipant: vector.input.caller_is_participant,
      }), vector.expected.code);
      return;
    }
    case 'TV-DRILLS-001': {
      const projected = projectDrillsAdapter({
        releaseId: 'release_fixture',
        revision: makeRevision('a', {
          drills: {
            video_id: vector.input.video_id,
            playback: vector.input.playback,
            nodes: vector.input.nodes,
            transcript: vector.input.transcript,
            vtt: vector.input.vtt,
          },
        }),
      });
      assert.equal(projected.transcript.availability, 'missing');
      assert.equal(projected.transcript.url, null);
      assert.equal(projected.vtt.availability, 'unknown');
      return;
    }
    case 'TV-DRILLS-002': {
      assertCode(() => projectDrillsAdapter({
        releaseId: 'release_fixture',
        revision: makeRevision('a', {
          drills: {
            video_id: vector.input.video_id,
            playback: vector.input.playback,
            nodes: vector.input.nodes,
            transcript: vector.input.transcript,
          },
        }),
      }), vector.expected.code);
      return;
    }
    case 'TV-DRILLS-003': {
      assertCode(() => validateDailyRegistryRow(vector.input), vector.expected.code, vector.expected.field);
      return;
    }
    case 'TV-LEGACY-001': {
      const before = structuredClone(vector.input);
      const identity = createHistoricalJoinIdentity({
        datasetVersion: vector.input.dataset_version,
        questionId: vector.input.question_id,
        contentHash: vector.input.content_hash,
      });
      assert.deepEqual(Object.keys(identity), vector.expected.preserved_join);
      assert.deepEqual(vector.input, before);
      return;
    }
    default:
      assert.fail(`unimplemented_transformation_vector:${vector.id}`);
  }
}

test('durable transformation vector document is the expected baseline', () => {
  assert.equal(vectorDocument.schema, 'missionmed.i1q.transformation_test_vectors.v1');
  assert.equal(vectorDocument.vectors.length, 14);
  assert.equal(new Set(vectorDocument.vectors.map((vector) => vector.id)).size, vectorDocument.vectors.length);
});

for (const vector of vectorDocument.vectors) {
  test(`${vector.id}: ${vector.title}`, () => executeTransformationVector(vector));
}

test('STAT server projection remains exactly nine fields in frozen order', () => {
  const row = projectStatDatasetQuestion({
    revision: makeRevision('a'),
    datasetVersion: 'fixture_v1',
    questionId: 'I1Q-FIXTURE-A',
  });
  assert.deepEqual(Object.keys(row), STAT_DATASET_FIELDS);
});

test('release construction requires an explicit stable export question ID', () => {
  assertCode(() => buildFixtureRelease([makeRevision('a', { export_question_id: '' })]), 'export_question_id_required');
  assertCode(() => buildFixtureRelease([makeRevision('a', { export_question_id: ' I1Q-FIXTURE-A ' })]), 'export_question_id_required');
});

test('duplicate composite identities fail before artifacts are built', () => {
  assertCode(() => buildFixtureRelease([
    makeRevision('a', { export_question_id: 'I1Q-SAME' }),
    makeRevision('b', { export_question_id: 'I1Q-SAME' }),
  ]), 'duplicate_projected_identity');
});

test('release output and manifest are stable when input revisions are reordered', () => {
  const left = makeRevision('a');
  const right = makeRevision('b');
  const forward = buildFixtureRelease([left, right]);
  const reversed = buildFixtureRelease([right, left]);
  assert.deepEqual(reversed, forward);
  assert.equal(reversed.manifest.manifest_hash, forward.manifest.manifest_hash);
});

test('manifest pins exact release membership tuples', () => {
  const revision = makeRevision('a');
  const generated = buildFixtureRelease([revision]);
  assert.deepEqual(generated.manifest.release_membership, [{
    item_id: revision.item_id,
    item_revision_id: revision.id,
    revision_number: revision.revision_number,
    content_hash: revision.content_hash,
    dataset_version: 'fixture_v1',
    question_id: revision.export_question_id,
  }]);
});

test('lookup and indexes carry composite identities without bare question-key overwrite', () => {
  const generated = buildFixtureRelease([makeRevision('a'), makeRevision('b')]);
  const lookup = generated.artifacts.find((entry) => entry.channel === 'stat_lookup').payload;
  assert.deepEqual(Object.keys(lookup), ['schema_version', 'entries']);
  assert.deepEqual(lookup.entries.map(({ dataset_version: datasetVersion, question_id: questionId }) => [datasetVersion, questionId]), [
    ['fixture_v1', 'I1Q-FIXTURE-A'],
    ['fixture_v1', 'I1Q-FIXTURE-B'],
  ]);
  assert.equal(Object.hasOwn(lookup, 'I1Q-FIXTURE-A'), false);

  const indexes = generated.artifacts.find((entry) => entry.channel === 'stat_indexes').payload;
  assert.deepEqual(indexes.by_topic['Synthetic fixtures'][0], {
    dataset_version: 'fixture_v1',
    question_id: 'I1Q-FIXTURE-A',
  });
});

test('question metadata preserves composite identity', () => {
  const generated = buildFixtureRelease([makeRevision('a')]);
  const [metadata] = generated.artifacts.find((entry) => entry.channel === 'question_metadata').payload;
  assert.deepEqual(Object.keys(metadata).slice(0, 2), ['dataset_version', 'question_id']);
  assert.equal(metadata.dataset_version, 'fixture_v1');
  assert.equal(metadata.question_id, 'I1Q-FIXTURE-A');
});

test('STAT channel phases and data classes are fixed', () => {
  const generated = buildFixtureRelease([makeRevision('a')]);
  for (const [channel, expected] of Object.entries(STAT_CHANNEL_CONTRACTS)) {
    const artifact = generated.artifacts.find((entry) => entry.channel === channel);
    assert.ok(artifact, channel);
    assert.equal(artifact.phase, expected.phase, channel);
    assert.equal(artifact.data_class, expected.data_class, channel);
  }
});

test('class A scanner rejects exhaustive answer and rationale aliases recursively', () => {
  const aliases = [
    'answer',
    'answers',
    'answer_map',
    'answerMap',
    'answer_key',
    'answerKey',
    'correct',
    'correctAnswer',
    'correct_answer',
    'correctChoiceKey',
    'correct_option',
    'correctness',
    'explanation',
    'explanations',
    'is_correct',
    'isCorrect',
    'rationale',
    'rationales',
    'distractor_rationales',
    'solution',
    'solutions',
    'why_tempting',
    'whyWrong',
  ];
  for (const alias of aliases) {
    const findings = scanForAnswerLeak({ nested: [{ [alias]: 'synthetic' }] });
    assert.ok(findings.some((finding) => finding.includes(alias)), alias);
  }
});

test('class A value scan catches serialized secrets without rejecting ordinary words', () => {
  assert.deepEqual(scanForAnswerLeak({
    prompt: 'Which answerability measure applies to the corrected sodium value?',
    choices: ['A solution space', 'A rationale-free label', 'An explanation-free mode', 'Ordinary text'],
  }), []);
  assert.deepEqual(scanForAnswerLeak({ debug: 'cached answer_map: {Q1:B}' }), ['$.debug:suspicious_value']);
  assert.deepEqual(scanForAnswerLeak({ note: 'The correct answer is B' }), ['$.note:suspicious_value']);
});

test('closed-world class A validation rejects unknown fields', () => {
  const payload = [{
    dataset_version: 'fixture_v1',
    question_id: 'I1Q-FIXTURE-A',
    prompt: 'Synthetic prompt?',
    choices: ['A', 'B', 'C', 'D'],
    metadata: 'not allowed',
  }];
  assert.ok(validateClassAArtifact('stat_pre_answer', payload).includes('$[0].metadata:unknown_field'));
  assertCode(() => assertClassAArtifact('question_metadata', []), 'class_a_validation_failed');
});

test('generated class A artifacts pass closed-world validation', () => {
  const generated = buildFixtureRelease([makeRevision('a')]);
  for (const channel of ['stat_pre_answer', 'stat_indexes', 'stat_lookup']) {
    const payload = generated.artifacts.find((entry) => entry.channel === channel).payload;
    assert.deepEqual(validateClassAArtifact(channel, payload), [], channel);
  }
});

test('Drills adapter requires explicit transcript and VTT states', () => {
  assertCode(() => projectDrillsAdapter({
    releaseId: 'release_fixture',
    revision: makeRevision('a', { drills: { transcript: null } }),
  }), 'transcript_availability_required');
  assertCode(() => projectDrillsAdapter({
    releaseId: 'release_fixture',
    revision: makeRevision('a', { drills: { vtt: null } }),
  }), 'vtt_availability_required');
});

test('Drills adapter rejects unavailable assets with hidden locations', () => {
  assertCode(() => projectDrillsAdapter({
    releaseId: 'release_fixture',
    revision: makeRevision('a', {
      drills: { transcript: { availability: 'missing', url: 'https://example.invalid/hidden.json' } },
    }),
  }), 'transcript_unavailable_location_forbidden');
});

test('Drills adapter requires playback and nodes availability', () => {
  assertCode(() => projectDrillsAdapter({
    releaseId: 'release_fixture',
    revision: makeRevision('a', { drills: { playback: { availability: 'missing', url: null, stream_id: null } } }),
  }), 'playback_unavailable');
  assertCode(() => projectDrillsAdapter({
    releaseId: 'release_fixture',
    revision: makeRevision('a', { drills: { nodes: { availability: 'unknown', url: null } } }),
  }), 'nodes_unavailable');
});

test('Drills adapter enforces rights, privacy, source hashes, and timestamp linkage', () => {
  assertCode(() => projectDrillsAdapter({
    releaseId: 'release_fixture',
    revision: makeRevision('a', { drills: { rights_status: 'restricted' } }),
  }), 'drills_rights_not_cleared');
  assertCode(() => projectDrillsAdapter({
    releaseId: 'release_fixture',
    revision: makeRevision('a', { drills: { privacy_status: 'blocked' } }),
  }), 'drills_privacy_not_cleared');
  assertCode(() => projectDrillsAdapter({
    releaseId: 'release_fixture',
    revision: makeRevision('a', { drills: { source_hash: 'bad' } }),
  }), 'source_hash_required');
  assertCode(() => projectDrillsAdapter({
    releaseId: 'release_fixture',
    revision: makeRevision('a', { drills: { timestamp: { start_seconds: 20, end_seconds: 10 } } }),
  }), 'timestamp_end_invalid');
});

test('Drills adapter emits explicit unavailable transcript and VTT values', () => {
  const projected = projectDrillsAdapter({ releaseId: 'release_fixture', revision: makeRevision('a') });
  assert.equal(projected.contract_version, 'i1q.drills.adapter.v1');
  assert.deepEqual(projected.transcript, { availability: 'missing', url: null });
  assert.deepEqual(projected.vtt, { availability: 'unknown', url: null });
  assert.equal(projected.nodes.availability, 'available');
  assert.equal(projected.playback.availability, 'available');
});

test('current Daily registry contract still requires all five nonempty fields', () => {
  const row = {
    video_id: 'video_fixture',
    title: 'Synthetic fixture',
    playback_url: 'https://example.invalid/playback',
    nodes_url: 'https://example.invalid/nodes.json',
    transcript_url: 'https://example.invalid/transcript.json',
  };
  assert.equal(validateDailyRegistryRow(row), row);
});

test('post-answer adapter contract authorizes only finalized participants', () => {
  assert.equal(assertPostAnswerAccess({ serverState: 'finalized', callerIsParticipant: true }), true);
  assertCode(() => assertPostAnswerAccess({ serverState: 'active', callerIsParticipant: true }), 'duel_not_finalized');
  assertCode(() => assertPostAnswerAccess({ serverState: 'finalized', callerIsParticipant: false }), 'duel_not_found');
});
