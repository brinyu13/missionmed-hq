import { createHash } from 'node:crypto';

export const SURVIVAL_SCHEMA = 'missionmed.storyforge.survival-manifest.v1';

export function sha256(value) {
  const marker = value === null ? 'null:' : `value:${String(value)}`;
  return createHash('sha256').update(marker, 'utf8').digest('hex');
}

function canonicalize(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function rowHash(row) {
  return sha256(canonicalJson(row));
}

export function sortedSetHash(values) {
  const normalized = [...new Set((values || []).map((value) => String(value)))].sort();
  return { count: normalized.length, hash: sha256(canonicalJson(normalized)) };
}

export function childSummary(rows, { idKey = 'id' } = {}) {
  const normalized = [...(rows || [])]
    .map((row) => canonicalize(row))
    .sort((left, right) => String(left?.[idKey] ?? canonicalJson(left)).localeCompare(String(right?.[idKey] ?? canonicalJson(right))));
  return {
    count: normalized.length,
    idsHash: sha256(canonicalJson(normalized.map((row) => row?.[idKey] ?? null))),
    rowsHash: sha256(canonicalJson(normalized)),
  };
}

function stableStory(story) {
  const { generatedAt: _generatedAt, ...rest } = story || {};
  return canonicalize(rest);
}

const EXACT_FIELDS = Object.freeze([
  'ownerId', 'ownerWordPressBindingHash', 'titleHash', 'originalHash',
  'workingHash', 'lessonHash', 'studentPriority', 'categories', 'intendedUses',
  'review', 'visibility', 'submission', 'timestamps', 'rowVersion',
  'transcripts', 'audioAssets', 'children',
]);

function compareValue(differences, storyId, field, before, after) {
  if (canonicalJson(before) !== canonicalJson(after)) {
    differences.push({ storyId, field, beforeHash: rowHash(before), afterHash: rowHash(after) });
  }
}

export function compareSurvivalManifests(pre, post) {
  const differences = [];
  if (pre?.schema !== SURVIVAL_SCHEMA || post?.schema !== SURVIVAL_SCHEMA) {
    return { pass: false, differences: [{ storyId: null, field: 'schema', beforeHash: rowHash(pre?.schema), afterHash: rowHash(post?.schema) }] };
  }
  const preStories = pre.stories || {};
  const postStories = post.stories || {};
  for (const storyId of Object.keys(preStories).sort()) {
    const before = stableStory(preStories[storyId]);
    const after = postStories[storyId] ? stableStory(postStories[storyId]) : null;
    if (!after) {
      differences.push({ storyId, field: 'story_missing', beforeHash: rowHash(before), afterHash: null });
      continue;
    }
    for (const field of EXACT_FIELDS) compareValue(differences, storyId, field, before[field], after[field]);
  }
  for (const storyId of Object.keys(postStories).sort()) {
    if (!preStories[storyId]) {
      differences.push({ storyId, field: 'unexpected_story_added', beforeHash: null, afterHash: rowHash(postStories[storyId]) });
    }
  }
  compareValue(differences, null, 'globals', pre.globals || {}, post.globals || {});
  return { pass: differences.length === 0, differences };
}

export function safeDifferenceReport(result) {
  return {
    schema: 'missionmed.storyforge.survival-comparison.v1',
    pass: Boolean(result?.pass),
    differenceCount: result?.differences?.length || 0,
    differences: (result?.differences || []).map(({ storyId, field, beforeHash, afterHash }) => ({
      storyId,
      field,
      beforeHash,
      afterHash,
    })),
  };
}
