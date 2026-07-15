import {
  CHANNELS,
  STAT_CHANNEL_CONTRACTS,
} from './contracts.mjs';
import {
  assertClassAArtifact,
  scanClassASecrets,
  validateClassAArtifact,
} from './adapters/class-a.mjs';
import { projectDrillsAdapter, validateDailyRegistryRow } from './adapters/drills-v1.mjs';
import {
  assertExactStatDatasetQuestion,
  assertPostAnswerAccess,
  assertUniqueCompositeIdentities,
  buildCompositeIndexes,
  buildCompositeLookup,
  buildReleaseMembership,
  compositeQuestionIdentity,
  createHistoricalJoinIdentity,
  prepareStatRelease,
} from './adapters/stat-v1.mjs';
import { canonicalJson, sha256 } from './hash.mjs';

export {
  assertClassAArtifact,
  assertExactStatDatasetQuestion,
  assertPostAnswerAccess,
  assertUniqueCompositeIdentities,
  compositeQuestionIdentity,
  createHistoricalJoinIdentity,
  projectDrillsAdapter,
  validateClassAArtifact,
  validateDailyRegistryRow,
};

function assertFourChoices(revision) {
  if (!Array.isArray(revision.choices) || revision.choices.length !== 4) {
    throw new Error('exactly_four_choices_required');
  }
  const keys = revision.choices.map((choice) => choice.key);
  if (keys.join(',') !== 'A,B,C,D') {
    throw new Error('choice_keys_must_be_A_through_D');
  }
}

export function projectStatDatasetQuestion({ revision, datasetVersion, questionId }) {
  assertFourChoices(revision);
  const row = {
    dataset_version: datasetVersion,
    question_id: questionId,
    prompt: revision.prompt,
    choice_a: revision.choices[0].text,
    choice_b: revision.choices[1].text,
    choice_c: revision.choices[2].text,
    choice_d: revision.choices[3].text,
    answer: revision.answer,
    explanation: revision.explanation,
  };
  return assertExactStatDatasetQuestion(row);
}

export function projectStatPreAnswer(row) {
  return {
    dataset_version: row.dataset_version,
    question_id: row.question_id,
    prompt: row.prompt,
    choices: [row.choice_a, row.choice_b, row.choice_c, row.choice_d],
  };
}

export function projectStatDebrief(row, revision) {
  return {
    dataset_version: row.dataset_version,
    question_id: row.question_id,
    answer: row.answer,
    explanation: row.explanation,
    correct_answer_rationale: revision.correct_answer_rationale,
    distractor_rationales: revision.choices
      .filter((choice) => choice.key !== revision.answer)
      .map((choice) => ({
        choice_key: choice.key,
        why_tempting: choice.why_tempting,
        why_wrong: choice.why_wrong,
        misconception_id: choice.misconception_id,
      })),
  };
}

export function projectQuestionMetadata({ revision, questionId, datasetVersion }) {
  return {
    dataset_version: datasetVersion,
    question_id: questionId,
    topic: revision.topic,
    subtopic: revision.subtopic || null,
    concept_id: revision.concept_id,
    source: 'I1Q',
  };
}

function artifact(channel, phase, dataClass, payload) {
  return {
    channel,
    phase,
    data_class: dataClass,
    payload,
    media_type: 'application/json',
    sha256: sha256(canonicalJson(payload)),
    record_count: Array.isArray(payload) ? payload.length : 1,
  };
}

function governedArtifact(channel, payload) {
  const contract = STAT_CHANNEL_CONTRACTS[channel];
  if (!contract) throw new Error(`channel_contract_required:${channel}`);
  return artifact(channel, contract.phase, contract.data_class, payload);
}

export function buildReleaseArtifacts({ releaseId, datasetVersion, revisions, previousManifestHash = null }) {
  const entries = prepareStatRelease({ datasetVersion, revisions });
  const datasetRows = entries.map((entry) => projectStatDatasetQuestion({
    revision: entry.revision,
    datasetVersion: entry.dataset_version,
    questionId: entry.question_id,
  }));
  const preAnswer = datasetRows.map(projectStatPreAnswer);
  const debrief = datasetRows.map((row, index) => projectStatDebrief(row, entries[index].revision));
  const metadata = datasetRows.map((row, index) => projectQuestionMetadata({
    revision: entries[index].revision,
    questionId: row.question_id,
    datasetVersion: row.dataset_version,
  }));
  const lookup = buildCompositeLookup(entries);
  const indexes = buildCompositeIndexes(metadata);
  const drills = entries.map(({ revision }) => projectDrillsAdapter({ revision, releaseId }));
  const releaseMembership = buildReleaseMembership(entries);

  assertClassAArtifact('stat_pre_answer', preAnswer);
  assertClassAArtifact('stat_indexes', indexes);
  assertClassAArtifact('stat_lookup', lookup);

  const artifacts = [
    governedArtifact('stat_dataset_questions', datasetRows),
    governedArtifact('stat_pre_answer', preAnswer),
    governedArtifact('stat_post_answer_debrief', debrief),
    governedArtifact('stat_indexes', indexes),
    governedArtifact('stat_lookup', lookup),
    governedArtifact('question_metadata', metadata),
    governedArtifact('drills', drills),
  ];

  const futureChannels = CHANNELS.filter((channel) => !artifacts.some((entry) => entry.channel === channel));
  for (const channel of futureChannels) {
    artifacts.push(artifact(channel, 'contract_only', 'contract_only', []));
  }

  const manifestPayload = {
    release_id: releaseId,
    dataset_version: datasetVersion,
    previous_manifest_hash: previousManifestHash,
    release_membership: releaseMembership,
    artifact_hashes: artifacts.map(({ channel, phase, data_class: dataClass, sha256: artifactHash, record_count: recordCount }) => ({
      channel,
      phase,
      data_class: dataClass,
      sha256: artifactHash,
      record_count: recordCount,
    })),
  };
  return {
    manifest: {
      ...manifestPayload,
      manifest_hash: sha256(manifestPayload),
    },
    artifacts,
  };
}

export function scanForAnswerLeak(value, path = '$') {
  return scanClassASecrets(value, path);
}
