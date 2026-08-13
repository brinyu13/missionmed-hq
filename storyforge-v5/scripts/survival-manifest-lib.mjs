import { createHash } from 'node:crypto';

export const SURVIVAL_SCHEMA = 'missionmed.storyforge.survival-manifest.v3';

const AUDIO_EXTENSIONS = Object.freeze({
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
});

export function resolvedAudioObjectKeys({
  objectKey,
  contentType,
  assemblyExecutor,
  segmentCount = 0,
}) {
  const baseKey = String(objectKey || '');
  if (!baseKey) throw new Error('Permanent audio object key is absent');
  if (/\.(?:webm|m4a|ogg|wav)$/i.test(baseKey)) return [baseKey];
  const extension = AUDIO_EXTENSIONS[String(contentType || '')];
  if (!extension) throw new Error('Permanent audio content type is unsupported');
  const executor = String(assemblyExecutor || '').trim().toLowerCase();
  if (executor === 'concat') return [`${baseKey}.${extension}`];
  if (executor === 'copy') {
    const count = Number(segmentCount);
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      throw new Error('Permanent audio segment manifest is invalid');
    }
    return Array.from(
      { length: count },
      (_, index) => `${baseKey}/seg-${String(index).padStart(5, '0')}.${extension}`,
    );
  }
  throw new Error('STORYFORGE_ASSEMBLY_EXECUTOR must be concat or copy for permanent audio verification');
}

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

export function childSummary(rows, { key = (row) => row.id } = {}) {
  const entries = [...(rows || [])]
    .map((row) => [String(key(row)), rowHash(row)])
    .sort(([left], [right]) => left.localeCompare(right));
  return { count: entries.length, rows: Object.fromEntries(entries) };
}

function difference(differences, { storyId = null, table = null, rowKey = null, field, before = null, after = null, reason = 'changed' }) {
  differences.push({
    storyId,
    table,
    rowKey,
    field,
    reason,
    beforeHash: before == null ? null : rowHash(before),
    afterHash: after == null ? null : rowHash(after),
  });
}

function compareExact(differences, context, before, after) {
  if (canonicalJson(before) !== canonicalJson(after)) difference(differences, { ...context, before, after });
}

function compareRowSet(differences, { storyId, table }, before = { count: 0, rows: {} }, after = { count: 0, rows: {} }) {
  if (Number(after.count) < Number(before.count)) {
    difference(differences, { storyId, table, field: 'count', reason: 'count_decreased', before: before.count, after: after.count });
  }
  for (const [rowKey, beforeHash] of Object.entries(before.rows || {}).sort()) {
    const afterHash = after.rows?.[rowKey];
    if (afterHash == null) {
      difference(differences, { storyId, table, rowKey, field: 'row', reason: 'row_missing', before: beforeHash });
    } else if (beforeHash !== afterHash) {
      difference(differences, { storyId, table, rowKey, field: 'row', reason: 'row_mutated', before: beforeHash, after: afterHash });
    }
  }
}

const CONTRIBUTION_REVIEW_COLUMNS = Object.freeze([
  'student_score', 'student_review_note', 'reviewed_at', 'row_version',
]);
const ARENA_AVATAR_COLUMNS = Object.freeze([
  'arena_avatar_id', 'arena_avatar_thumbnail_url', 'arena_avatar_synced_at',
]);

function compareProtectedTables(
  differences,
  pre = {},
  post = {},
  expectedTableAdditions = [],
  expectedContributionReviewColumns = false,
  expectedArenaAvatarColumns = false,
) {
  const expected = new Set(expectedTableAdditions || []);
  for (const [table, before] of Object.entries(pre).sort()) {
    const after = post?.[table];
    if (!after) {
      difference(differences, { table, field: 'protectedTable', reason: 'table_missing', before });
      continue;
    }
    if (table === 'sf_story_contributions' && expectedContributionReviewColumns) {
      const beforeEvolution = before.contributionReviewEvolution;
      const afterEvolution = after.contributionReviewEvolution;
      compareExact(differences, { table, field: 'baseColumnNamesHash' }, beforeEvolution?.baseColumnNamesHash, afterEvolution?.baseColumnNamesHash);
      compareExact(differences, { table, field: 'baseRows' }, beforeEvolution?.baseRows, afterEvolution?.baseRows);
      compareExact(differences, { table, field: 'preAddedColumns' }, [], beforeEvolution?.addedColumnsPresent);
      compareExact(differences, { table, field: 'postAddedColumns' }, CONTRIBUTION_REVIEW_COLUMNS, afterEvolution?.addedColumnsPresent);
      compareExact(differences, { table, field: 'postDefaultsExact' }, true, afterEvolution?.defaultsExact);
      compareExact(differences, { table, field: 'count' }, before.count, after.count);
    } else if (table === 'sf_users' && expectedArenaAvatarColumns) {
      const beforeEvolution = before.arenaAvatarEvolution;
      const afterEvolution = after.arenaAvatarEvolution;
      compareExact(differences, { table, field: 'baseColumnNamesHash' }, beforeEvolution?.baseColumnNamesHash, afterEvolution?.baseColumnNamesHash);
      compareExact(differences, { table, field: 'baseRows' }, beforeEvolution?.baseRows, afterEvolution?.baseRows);
      compareExact(differences, { table, field: 'preAddedColumns' }, [], beforeEvolution?.addedColumnsPresent);
      compareExact(differences, { table, field: 'postAddedColumns' }, ARENA_AVATAR_COLUMNS, afterEvolution?.addedColumnsPresent);
      compareExact(differences, { table, field: 'postDefaultsExact' }, true, afterEvolution?.defaultsExact);
      compareExact(differences, { table, field: 'count' }, before.count, after.count);
    } else {
      compareExact(differences, { table, field: 'protectedTable' }, before, after);
    }
  }
  for (const [table, after] of Object.entries(post || {}).sort()) {
    if (pre?.[table]) continue;
    if (!expected.has(table)) {
      difference(differences, { table, field: 'protectedTable', reason: 'unexpected_table_addition', after });
    } else if (Number(after?.count || 0) !== 0) {
      difference(differences, {
        table,
        field: 'protectedTable.count',
        reason: 'expected_table_not_empty',
        before: 0,
        after: after?.count,
      });
    }
  }
  for (const table of expected) {
    if (pre?.[table] || !post?.[table]) {
      difference(differences, {
        table,
        field: 'protectedTable',
        reason: pre?.[table] ? 'expected_table_already_existed' : 'expected_table_addition_missing',
        before: pre?.[table] || null,
        after: post?.[table] || null,
      });
    }
  }
}

function compareFeatureFlags(differences, pre = { rows: {} }, post = { rows: {} }, expectedAdditions = []) {
  const expected = new Map(expectedAdditions || []);
  for (const [key, before] of Object.entries(pre?.rows || {}).sort()) {
    compareExact(
      differences,
      { table: 'sf_feature_flags', rowKey: key, field: 'row' },
      before,
      post?.rows?.[key] ?? null,
    );
  }
  for (const [key, after] of Object.entries(post?.rows || {}).sort()) {
    if (pre?.rows?.[key] != null) continue;
    const expectedHash = expected.get(key);
    if (expectedHash !== after?.rowHash) {
      difference(differences, {
        table: 'sf_feature_flags', rowKey: key, field: 'addition',
        reason: 'unexpected_feature_flag_addition', after,
      });
    } else if (after?.defaultOff !== true) {
      difference(differences, {
        table: 'sf_feature_flags', rowKey: key, field: 'scope',
        reason: 'expected_feature_flag_not_default_off', after,
      });
    }
  }
  for (const [key, expectedHash] of expected) {
    const actual = post?.rows?.[key];
    if (pre?.rows?.[key]) {
      difference(differences, {
        table: 'sf_feature_flags', rowKey: key, field: 'expected_addition',
        reason: 'expected_feature_flag_already_existed',
        before: pre.rows[key],
        after: actual || null,
      });
    } else if (!actual || actual.rowHash !== expectedHash) {
      difference(differences, {
        table: 'sf_feature_flags', rowKey: key, field: 'expected_addition',
        reason: 'expected_feature_flag_addition_missing',
        before: expectedHash,
        after: actual?.rowHash ?? null,
      });
    }
  }
}

function validateObjectSet(differences, storyId, phase, objectSet = { count: 0, rows: {} }) {
  for (const [rowKey, item] of Object.entries(objectSet.rows || {}).sort()) {
    const valid = item?.required !== true || (
      item.exists === true
      && Number(item.actualSize) === Number(item.recordedSize)
    );
    if (!valid) {
      difference(differences, {
        storyId,
        table: 'objects',
        rowKey,
        field: phase,
        reason: 'object_verification_failed',
        before: { recordedSize: item?.recordedSize, exists: item?.exists },
        after: { actualSize: item?.actualSize },
      });
    }
  }
}

function compareObjects(differences, storyId, before, after) {
  validateObjectSet(differences, storyId, 'pre', before);
  validateObjectSet(differences, storyId, 'post', after);
  if (Number(after?.count || 0) < Number(before?.count || 0)) {
    difference(differences, { storyId, table: 'objects', field: 'count', reason: 'count_decreased', before: before?.count, after: after?.count });
  }
  for (const [rowKey, item] of Object.entries(before?.rows || {}).sort()) {
    const next = after?.rows?.[rowKey];
    if (!next) {
      difference(differences, { storyId, table: 'objects', rowKey, field: 'row', reason: 'row_missing', before: item });
      continue;
    }
    for (const field of ['rowHash', 'objectKeyHash', 'resolvedObjectKeyHashes', 'recordedSize', 'required']) {
      compareExact(differences, { storyId, table: 'objects', rowKey, field }, item[field], next[field]);
    }
  }
}

function compareLedger(differences, pre, post, expectedLedgerAdditions) {
  const expected = new Map(expectedLedgerAdditions || []);
  for (const [version, beforeHash] of Object.entries(pre?.rows || {}).sort()) {
    compareExact(differences, { table: 'migration_ledger', rowKey: version, field: 'row' }, beforeHash, post?.rows?.[version] ?? null);
  }
  for (const [version, afterHash] of Object.entries(post?.rows || {}).sort()) {
    if (pre?.rows?.[version] != null) continue;
    if (expected.get(version) !== afterHash) {
      difference(differences, { table: 'migration_ledger', rowKey: version, field: 'addition', reason: 'unexpected_ledger_addition', after: afterHash });
    }
  }
  for (const [version, expectedHash] of expected.entries()) {
    if (post?.rows?.[version] !== expectedHash) {
      difference(differences, { table: 'migration_ledger', rowKey: version, field: 'expected_addition', reason: 'expected_ledger_addition_missing', before: expectedHash, after: post?.rows?.[version] ?? null });
    }
  }
}

export function compareSurvivalManifests(pre, post, {
  expectedLedgerAdditions = [],
  expectedTableAdditions = [],
  expectedFeatureFlagAdditions = [],
  expectedContributionReviewColumns = false,
  expectedArenaAvatarColumns = false,
} = {}) {
  const differences = [];
  if (pre?.schema !== SURVIVAL_SCHEMA || post?.schema !== SURVIVAL_SCHEMA) {
    difference(differences, { field: 'schema', before: pre?.schema, after: post?.schema });
    return { pass: false, differences };
  }
  compareExact(differences, { field: 'databaseSystemHash' }, pre.capture?.databaseSystemHash, post.capture?.databaseSystemHash);
  for (const [phase, manifest] of [['pre', pre], ['post', post]]) {
    compareExact(differences, { field: `${phase}.fullVisibility` }, true, manifest.capture?.fullVisibility);
    compareExact(differences, { field: `${phase}.objectVerification` }, 'required_pass', manifest.capture?.objectVerification);
  }

  compareProtectedTables(
    differences,
    pre.protectedTables,
    post.protectedTables,
    expectedTableAdditions,
    expectedContributionReviewColumns,
    expectedArenaAvatarColumns,
  );
  compareFeatureFlags(differences, pre.featureFlags, post.featureFlags, expectedFeatureFlagAdditions);
  compareObjects(differences, null, pre.permanentObjects, post.permanentObjects);

  for (const table of new Set([...Object.keys(pre.global || {}), ...Object.keys(post.global || {})])) {
    const before = pre.global?.[table] || { count: 0, idsHash: sha256(canonicalJson([])) };
    const after = post.global?.[table] || { count: 0, idsHash: sha256(canonicalJson([])) };
    if (table === 'sf_users' || table === 'sf_stories') {
      compareExact(differences, { table, field: 'global' }, before, after);
    } else if (Number(after.count) < Number(before.count)) {
      difference(differences, { table, field: 'global.count', reason: 'count_decreased', before: before.count, after: after.count });
    }
  }

  const preStories = pre.stories || {};
  const postStories = post.stories || {};
  for (const storyId of Object.keys(preStories).sort()) {
    const before = preStories[storyId];
    const after = postStories[storyId];
    if (!after) {
      difference(differences, { storyId, field: 'story', reason: 'story_missing', before });
      continue;
    }
    for (const field of ['owner', 'core', 'review', 'submission', 'transcripts']) {
      compareExact(differences, { storyId, field }, before[field], after[field]);
    }
    const preVisibility = before.visibility?.columnPresent ? before.visibility.value : null;
    const postVisibility = after.visibility?.columnPresent ? after.visibility.value : null;
    compareExact(differences, { storyId, field: 'visibility' }, preVisibility, postVisibility);
    for (const table of new Set([...Object.keys(before.children || {}), ...Object.keys(after.children || {})])) {
      compareRowSet(differences, { storyId, table }, before.children?.[table], after.children?.[table]);
    }
    compareObjects(differences, storyId, before.audio, after.audio);
  }
  for (const storyId of Object.keys(postStories).sort()) {
    if (!preStories[storyId]) difference(differences, { storyId, field: 'story', reason: 'unexpected_story_added', after: postStories[storyId] });
  }
  compareLedger(differences, pre.ledger, post.ledger, expectedLedgerAdditions);
  return { pass: differences.length === 0, differences };
}

export function safeDifferenceReport(result) {
  return {
    schema: 'missionmed.storyforge.survival-comparison.v3',
    pass: Boolean(result?.pass),
    differenceCount: result?.differences?.length || 0,
    differences: (result?.differences || []).map(({ storyId, table, rowKey, field, reason, beforeHash, afterHash }) => ({
      storyId,
      table,
      rowKey,
      field,
      reason,
      beforeHash,
      afterHash,
    })),
  };
}
