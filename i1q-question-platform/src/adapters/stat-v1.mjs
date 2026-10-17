import { STAT_DATASET_FIELDS } from '../contracts.mjs';

const SHA256_HEX = /^[0-9a-f]{64}$/u;

function contractError(code, details = null) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = 422;
  if (details) error.details = details;
  return error;
}

function requireStableString(value, code) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw contractError(code);
  }
  return value;
}

function requireSha256(value, code) {
  if (typeof value !== 'string' || !SHA256_HEX.test(value)) {
    throw contractError(code);
  }
  return value;
}

function compareStableIds(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function compositeQuestionIdentity(datasetVersion, questionId) {
  return JSON.stringify([
    requireStableString(datasetVersion, 'dataset_version_required'),
    requireStableString(questionId, 'export_question_id_required'),
  ]);
}

export function assertExactStatDatasetQuestion(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw contractError('stat_projection_row_required');
  }
  if (Object.keys(row).join(',') !== STAT_DATASET_FIELDS.join(',')) {
    throw contractError('stat_projection_field_drift');
  }
  requireStableString(row.dataset_version, 'dataset_version_required');
  requireStableString(row.question_id, 'export_question_id_required');
  return row;
}

export function assertUniqueCompositeIdentities(identities) {
  if (!Array.isArray(identities)) {
    throw contractError('composite_identities_required');
  }
  const seen = new Set();
  for (const identity of identities) {
    const key = compositeQuestionIdentity(identity.dataset_version, identity.question_id);
    if (seen.has(key)) {
      throw contractError('duplicate_projected_identity', {
        dataset_version: identity.dataset_version,
        question_id: identity.question_id,
      });
    }
    seen.add(key);
  }
  return identities;
}

export function prepareStatRelease({ datasetVersion, revisions }) {
  const stableDatasetVersion = requireStableString(datasetVersion, 'dataset_version_required');
  if (!Array.isArray(revisions) || revisions.length === 0) {
    throw contractError('release_requires_items');
  }

  const ordered = [...revisions].map((revision) => {
    if (!revision || typeof revision !== 'object' || Array.isArray(revision)) {
      throw contractError('revision_required');
    }
    const itemRevisionId = requireStableString(revision.id, 'item_revision_id_required');
    const questionId = requireStableString(revision.export_question_id, 'export_question_id_required');
    return {
      revision,
      dataset_version: stableDatasetVersion,
      question_id: questionId,
      item_revision_id: itemRevisionId,
    };
  }).sort((left, right) => compareStableIds(left.item_revision_id, right.item_revision_id));

  const revisionIds = new Set();
  for (const entry of ordered) {
    if (revisionIds.has(entry.item_revision_id)) {
      throw contractError('duplicate_item_revision_id', { item_revision_id: entry.item_revision_id });
    }
    revisionIds.add(entry.item_revision_id);
  }

  assertUniqueCompositeIdentities(ordered);
  return ordered;
}

export function buildReleaseMembership(entries) {
  return entries.map(({ revision, dataset_version: datasetVersion, question_id: questionId }) => {
    const revisionNumber = revision.revision_number;
    if (!Number.isInteger(revisionNumber) || revisionNumber <= 0) {
      throw contractError('revision_number_required');
    }
    return {
      item_id: requireStableString(revision.item_id, 'item_id_required'),
      item_revision_id: requireStableString(revision.id, 'item_revision_id_required'),
      revision_number: revisionNumber,
      content_hash: requireSha256(revision.content_hash, 'revision_content_hash_required'),
      dataset_version: datasetVersion,
      question_id: questionId,
    };
  });
}

export function buildCompositeLookup(entries) {
  return {
    schema_version: 'i1q.stat.lookup.v1',
    entries: entries.map((entry, ordinal) => ({
      dataset_version: entry.dataset_version,
      question_id: entry.question_id,
      ordinal,
    })),
  };
}

function addIndexIdentity(index, key, identity) {
  const stableKey = typeof key === 'string' && key.trim() ? key.trim() : 'unclassified';
  index[stableKey] ||= [];
  index[stableKey].push(identity);
}

export function buildCompositeIndexes(metadata) {
  const indexes = {
    by_topic: {},
    by_concept: {},
  };
  for (const row of metadata) {
    const identity = {
      dataset_version: row.dataset_version,
      question_id: row.question_id,
    };
    addIndexIdentity(indexes.by_topic, row.topic, identity);
    addIndexIdentity(indexes.by_concept, row.concept_id, identity);
  }
  return indexes;
}

export function createHistoricalJoinIdentity({ datasetVersion, questionId, contentHash }) {
  return {
    dataset_version: requireStableString(datasetVersion, 'dataset_version_required'),
    question_id: requireStableString(questionId, 'export_question_id_required'),
    content_hash: requireSha256(contentHash, 'source_content_hash_required'),
  };
}

export function assertPostAnswerAccess({ serverState, callerIsParticipant }) {
  if (serverState !== 'finalized') {
    throw contractError('duel_not_finalized');
  }
  if (callerIsParticipant !== true) {
    const error = contractError('duel_not_found');
    error.statusCode = 404;
    throw error;
  }
  return true;
}
