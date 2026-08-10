import { createHash } from 'node:crypto';

export const SURVIVAL_SCHEMA = 'missionmed.storyforge.survival-manifest.v2';

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
    for (const field of ['rowHash', 'objectKeyHash', 'recordedSize', 'required']) {
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

export function compareSurvivalManifests(pre, post, { expectedLedgerAdditions = [] } = {}) {
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
    if (Number(after.v2Assertions?.generatedVersionRows || 0) !== 0) {
      difference(differences, { storyId, table: 'sf_story_versions', field: 'generatedVersionRows', reason: 'historical_version_synthesized', before: 0, after: after.v2Assertions?.generatedVersionRows });
    }
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
    schema: 'missionmed.storyforge.survival-comparison.v2',
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
