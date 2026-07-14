import { CHANNELS, STAT_DATASET_FIELDS } from './contracts.mjs';
import { canonicalJson, sha256 } from './hash.mjs';

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
  if (Object.keys(row).join(',') !== STAT_DATASET_FIELDS.join(',')) {
    throw new Error('stat_projection_field_drift');
  }
  return row;
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
    question_id: questionId,
    topic: revision.topic,
    subtopic: revision.subtopic || null,
    concept_id: revision.concept_id,
    source: 'I1Q',
    dataset_version: datasetVersion,
  };
}

function artifact(channel, phase, payload) {
  return {
    channel,
    phase,
    payload,
    media_type: 'application/json',
    sha256: sha256(canonicalJson(payload)),
    record_count: Array.isArray(payload) ? payload.length : 1,
  };
}

export function buildReleaseArtifacts({ releaseId, datasetVersion, revisions, previousManifestHash = null }) {
  const ordered = [...revisions].sort((a, b) => a.id.localeCompare(b.id));
  const datasetRows = ordered.map((revision, index) => projectStatDatasetQuestion({
    revision,
    datasetVersion,
    questionId: revision.export_question_id || `I1Q-${String(index + 1).padStart(6, '0')}`,
  }));
  const preAnswer = datasetRows.map(projectStatPreAnswer);
  const debrief = datasetRows.map((row, index) => projectStatDebrief(row, ordered[index]));
  const metadata = datasetRows.map((row, index) => projectQuestionMetadata({
    revision: ordered[index],
    questionId: row.question_id,
    datasetVersion,
  }));
  const lookup = Object.fromEntries(datasetRows.map((row) => [row.question_id, {
    dataset_version: row.dataset_version,
    ordinal: datasetRows.indexOf(row),
  }]));
  const indexes = {
    by_topic: metadata.reduce((acc, row) => {
      acc[row.topic] ||= [];
      acc[row.topic].push(row.question_id);
      return acc;
    }, {}),
    by_concept: metadata.reduce((acc, row) => {
      acc[row.concept_id] ||= [];
      acc[row.concept_id].push(row.question_id);
      return acc;
    }, {}),
  };

  const artifacts = [
    artifact('stat_dataset_questions', 'server_only', datasetRows),
    artifact('stat_pre_answer', 'pre_answer', preAnswer),
    artifact('stat_post_answer_debrief', 'post_answer', debrief),
    artifact('stat_indexes', 'pre_answer', indexes),
    artifact('stat_lookup', 'pre_answer', lookup),
    artifact('question_metadata', 'server_only', metadata),
    artifact('drills', 'internal', ordered.map((revision) => ({
      item_revision_id: revision.id,
      prompt: revision.prompt,
      concept_id: revision.concept_id,
      source_ids: revision.source_ids,
      review_status: 'approved',
    }))),
  ];

  const futureChannels = CHANNELS.filter((channel) => !artifacts.some((entry) => entry.channel === channel));
  for (const channel of futureChannels) {
    artifacts.push(artifact(channel, 'contract_only', []));
  }

  const manifestPayload = {
    release_id: releaseId,
    dataset_version: datasetVersion,
    previous_manifest_hash: previousManifestHash,
    artifact_hashes: artifacts.map(({ channel, phase, sha256: artifactHash, record_count: recordCount }) => ({
      channel,
      phase,
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
  const findings = [];
  const forbidden = /^(answer|answer_key|answerKey|correctAnswer|correct_answer|correct_option|solution)$/u;
  const walk = (current, currentPath) => {
    if (Array.isArray(current)) {
      current.forEach((entry, index) => walk(entry, `${currentPath}[${index}]`));
      return;
    }
    if (!current || typeof current !== 'object') {
      return;
    }
    for (const [key, entry] of Object.entries(current)) {
      const nextPath = `${currentPath}.${key}`;
      if (forbidden.test(key)) {
        findings.push(nextPath);
      }
      walk(entry, nextPath);
    }
  };
  walk(value, path);
  return findings;
}
