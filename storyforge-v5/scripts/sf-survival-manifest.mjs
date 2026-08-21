#!/usr/bin/env node
import { lstat, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';
import { headAudioObject } from '../server/storage.mjs';
import {
  SURVIVAL_SCHEMA,
  canonicalJson,
  childSummary,
  compareSurvivalManifests,
  resolvedAudioObjectKeys,
  rowHash,
  safeDifferenceReport,
  sha256,
  sortedSetHash,
} from './survival-manifest-lib.mjs';

const { Client, types } = pg;
types.setTypeParser(1114, (value) => value);
types.setTypeParser(1184, (value) => value);
types.setTypeParser(20, (value) => value);

const STORY_COLUMNS = Object.freeze([
  'id', 'student_id', 'title', 'original_text', 'current_text', 'capture_type', 'status',
  'student_score', 'mentor_score', 'classification', 'starred', 'needs_followup', 'uses',
  'revision_no', 'submitted_at', 'opened_at', 'reviewed_at', 'approved_at', 'created_at',
  'updated_at', 'legacy_status_at_b1_503', 'prefix_enabled', 'lesson', 'themes', 'student_star',
  'mentor_star', 'birds', 'positions', 'revised', 'reviewed_by', 'row_version',
  'last_submitted_at', 'student_updated_at', 'status_changed_at', 'feedback_sent_at',
  'feedback_opened_at', 'student_responded_at', 'archived_at', 'archived_by',
  'review_suitability', 'suitability_reviewed_by', 'suitability_reviewed_at', 'categories',
]);

const DIRECT_SPECS = Object.freeze([
  ['sf_story_originals', 'story_id', ['story_id'], ['story_id', 'original_transcript', 'audio_asset_id', 'capture_type', 'created_at']],
  ['sf_story_revisions', 'story_id', ['id'], ['id', 'story_id', 'revision_no', 'text_snapshot', 'title_snapshot', 'actor_id', 'reason', 'created_at']],
  ['sf_feedback', 'story_id', ['id'], ['id', 'story_id', 'mentor_id', 'body', 'disposition', 'created_at', 'seen_by_student_at']],
  ['sf_story_reflections', 'story_id', ['id'], ['id', 'story_id', 'prompt', 'answer', 'from_mentor', 'author_id', 'seen_by_student_at', 'created_at', 'answered_at']],
  ['sf_use_suggestions', 'story_id', ['id'], ['id', 'story_id', 'use_key', 'suggested_by', 'created_at', 'withdrawn_at', 'accepted_at', 'accepted_by']],
  ['sf_audio_assets', 'story_id', ['id'], ['id', 'story_id', 'student_id', 'object_key', 'content_type', 'byte_size', 'checksum_sha256', 'state', 'created_at', 'verified_at', 'duration_ms', 'transcription_status', 'transcription_error', 'immutable_at']],
  ['sf_story_questions', 'story_id', ['id'], ['id', 'story_id', 'question_id', 'student_strength', 'mentor_strength', 'student_proposed', 'mentor_confirmed', 'student_notes', 'mentor_notes', 'updated_at', 'state', 'proposed_by', 'proposed_role', 'why', 'clinical', 'confirmed_by', 'confirmed_at', 'rejected_by', 'rejected_at', 'rejection_reason', 'removed_by', 'removed_at', 'created_at', 'row_version']],
  ['sf_question_preferences', 'story_id', ['student_id', 'question_id', 'story_id'], ['student_id', 'question_id', 'story_id', 'set_by', 'row_version', 'set_at', 'updated_at']],
  ['sf_question_coaching_notes', 'story_id', ['id'], ['id', 'student_id', 'question_id', 'story_id', 'mentor_id', 'body', 'created_at']],
  ['sf_story_craft', 'story_id', ['story_id'], ['story_id', 'detail', 'stakes', 'turn', 'honest', 'lesson', 'scored_by', 'scored_at', 'row_version']],
  ['sf_coaching_session_items', 'story_id', ['id'], ['id', 'session_id', 'label', 'story_id', 'question_id', 'route', 'sort_order', 'completed', 'completed_at', 'created_at', 'updated_at']],
  ['sf_recording_sessions', 'story_id', ['id'], ['id', 'student_id', 'story_id', 'state', 'mime_type', 'total_duration_ms', 'segment_count', 'assembled_asset_id', 'provider_id', 'model_id', 'last_activity_at', 'created_at', 'updated_at']],
  ['sf_story_internal_notes', 'story_id', ['id'], ['id', 'story_id', 'admin_id', 'body', 'created_at']],
  ['sf_mentor_notes', 'story_id', ['id'], ['id', 'story_id', 'student_id', 'author_id', 'body', 'internal_only', 'state', 'row_version', 'published_at', 'archived_at', 'created_at', 'updated_at']],
  ['sf_mentor_note_media', 'story_id', ['id'], ['id', 'note_id', 'author_id', 'student_id', 'story_id', 'object_key', 'content_type', 'byte_size', 'checksum_sha256', 'transcript', 'provider_id', 'model_id', 'state', 'created_at', 'verified_at', 'retired_at']],
  ['sf_story_media', 'story_id', ['id'], ['id', 'story_id', 'student_id', 'media_kind', 'mime_type', 'byte_size', 'duration_ms', 'caption', 'sort_order', 'object_key', 'upload_object_key', 'etag', 'state', 'row_version', 'created_at', 'verified_at', 'removed_at']],
  ['sf_notifications', 'story_id', ['id'], ['id', 'recipient_id', 'actor_id', 'story_id', 'event_key', 'title', 'body', 'deep_link', 'read_at', 'created_at', 'question_id', 'event_category', 'first_event_at', 'last_event_at']],
  ['sf_audit_events', 'story_id', ['id'], ['id', 'actor_id', 'actor_role', 'action', 'entity_type', 'entity_id', 'surface', 'previous_value', 'new_value', 'created_at', 'actor_display', 'student_id', 'story_id', 'question_id', 'detail', 'visibility']],
  ['sf_ai_suggestions', 'story_id', ['id'], ['id', 'student_id', 'story_id', 'requested_by', 'mode', 'provider', 'model', 'prompt_version', 'redaction_version', 'output', 'state', 'created_at', 'story_question_id', 'reviewed_by', 'reviewed_at']],
]);

const NESTED_SPECS = Object.freeze([
  ['sf_recording_segments', ['id'], ['id', 'session_id', 'seq', 'object_key', 'mime_type', 'byte_size', 'duration_ms', 'transcribe_state', 'transcript', 'flagged_terms', 'retry_count', 'created_at', 'updated_at'], 'session_id', 'sf_recording_sessions'],
  ['sf_pair_followups', ['id'], ['id', 'story_question_id', 'text', 'source', 'clinical', 'prepared', 'preparation_note', 'sort_order', 'created_by', 'created_at', 'updated_at', 'removed_by', 'removed_at', 'row_version'], 'story_question_id', 'sf_story_questions'],
  ['sf_mentor_note_audio_deletion_intents', ['id'], ['id', 'note_id', 'object_key', 'requested_by', 'state', 'attempts', 'created_at', 'updated_at', 'resolved_at'], 'note_id', 'sf_mentor_notes'],
  ['sf_story_media_deletion_intents', ['id'], ['id', 'media_id', 'object_key', 'state', 'attempts', 'reason', 'created_at', 'resolved_at'], 'media_id', 'sf_story_media'],
]);

const GLOBAL_SPECS = Object.freeze([
  ['sf_users', ['id']], ['sf_stories', ['id']], ['sf_recording_sessions', ['id']],
  ['sf_recording_segments', ['id']], ['sf_mentor_notes', ['id']], ['sf_mentor_note_media', ['id']],
  ['sf_story_media', ['id']], ['sf_audio_assets', ['id']], ['sf_story_revisions', ['id']],
  ['sf_feedback', ['id']], ['sf_story_reflections', ['id']], ['sf_audit_events', ['id']],
]);

// These V2 relationships are protected by the exact whole-table projection.
// Listing them here also makes their sf_stories foreign keys explicitly
// classified, so any future story relationship remains fail-closed.
const V2_PROTECTED_STORY_RELATIONSHIPS = Object.freeze([
  ['sf_story_versions', 'story_id'],
  ['sf_story_version_revisions', 'story_id'],
  ['sf_authored_segments', 'story_id'],
  ['sf_inspiration_events', 'story_id'],
  ['sf_story_contributions', 'promoted_story_id'],
  ['sf_story_use_reviews', 'story_id'],
  ['sf_story_publications', 'story_id'],
  ['sf_story_trash', 'story_id'],
  ['sf_peer_story_grants', 'story_id'],
  ['sf_peer_feedback', 'story_id'],
]);

const CONTRIBUTION_REVIEW_COLUMNS = Object.freeze([
  'student_score', 'student_review_note', 'reviewed_at', 'row_version',
]);
const ARENA_AVATAR_COLUMNS = Object.freeze([
  'arena_avatar_id', 'arena_avatar_thumbnail_url', 'arena_avatar_synced_at',
]);

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const values = {
    command,
    expectedLedgerAddition: [],
    expectedTableAddition: [],
    expectedPopulatedTableAddition: [],
    expectedFeatureFlagAddition: [],
  };
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    if (key === '--require-object-head') values.requireObjectHead = true;
    else if (key === '--expected-contribution-review-columns') values.expectedContributionReviewColumns = true;
    else if (key === '--expected-arena-avatar-columns') values.expectedArenaAvatarColumns = true;
    else if (key === '--expected-ledger-addition') values.expectedLedgerAddition.push(rest[++index]);
    else if (key === '--expected-table-addition') values.expectedTableAddition.push(rest[++index]);
    else if (key === '--expected-populated-table-addition') values.expectedPopulatedTableAddition.push(rest[++index]);
    else if (key === '--expected-feature-flag-addition') values.expectedFeatureFlagAddition.push(rest[++index]);
    else values[key.slice(2)] = rest[++index];
  }
  return values;
}

async function protectedRoot() {
  const configured = String(process.env.STORYFORGE_SURVIVAL_EVIDENCE_ROOT || '').trim();
  if (!configured || !path.isAbsolute(configured)) throw new Error('STORYFORGE_SURVIVAL_EVIDENCE_ROOT must be an absolute private directory');
  const linkInfo = await lstat(configured);
  if (linkInfo.isSymbolicLink() || !linkInfo.isDirectory()) throw new Error('Survival evidence root must be a real directory, not a symlink');
  const root = await realpath(configured);
  const rootInfo = await stat(root);
  if ((rootInfo.mode & 0o777) !== 0o700) throw new Error('Survival evidence root must have mode 0700');
  return root;
}

async function protectedPath(filePath) {
  if (!filePath) throw new Error('--output is required');
  const root = await protectedRoot();
  const resolved = path.resolve(filePath);
  const parent = await realpath(path.dirname(resolved));
  if (parent !== root) throw new Error('Survival evidence output must be directly inside STORYFORGE_SURVIVAL_EVIDENCE_ROOT');
  return path.join(parent, path.basename(resolved));
}

async function writeProtected(filePath, value) {
  const resolved = await protectedPath(filePath);
  await writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  const info = await stat(resolved);
  if ((info.mode & 0o777) !== 0o600) throw new Error('Survival evidence file was not created with mode 0600');
}

async function schemaInventory(client) {
  const result = await client.query(
    `SELECT columns.table_name, columns.column_name
       FROM information_schema.columns columns
       JOIN pg_namespace namespace ON namespace.nspname = columns.table_schema
       JOIN pg_class relation
         ON relation.relnamespace = namespace.oid
        AND relation.relname = columns.table_name
        AND relation.relkind IN ('r', 'p')
      WHERE columns.table_schema = 'public'
        AND columns.table_name LIKE 'sf\\_%' ESCAPE '\\'
      ORDER BY columns.table_name, columns.ordinal_position`,
  );
  const inventory = new Map();
  for (const row of result.rows) {
    if (!inventory.has(row.table_name)) inventory.set(row.table_name, new Set());
    inventory.get(row.table_name).add(row.column_name);
  }
  return inventory;
}

function existingColumns(inventory, table, columns) {
  return columns.filter((column) => inventory.get(table)?.has(column));
}

function rowKey(row, columns) {
  return columns.map((column) => String(row[column])).join(':');
}

async function selectDirect(client, inventory, table, link, columns, storyId) {
  if (!inventory.has(table) || !inventory.get(table).has(link)) return [];
  const selected = existingColumns(inventory, table, columns);
  const result = await client.query(`SELECT ${selected.map((column) => `"${column}"`).join(', ')} FROM public."${table}" WHERE "${link}" = $1`, [storyId]);
  return result.rows;
}

async function selectNested(client, inventory, table, columns, link, parentRows) {
  if (!inventory.has(table) || parentRows.length === 0) return [];
  const ids = parentRows.map((row) => row.id);
  const selected = existingColumns(inventory, table, columns);
  const result = await client.query(`SELECT ${selected.map((column) => `"${column}"`).join(', ')} FROM public."${table}" WHERE "${link}" = ANY($1::uuid[])`, [ids]);
  return result.rows;
}

async function assertFullVisibility(client, inventory) {
  const role = await client.query(
    `SELECT r.rolsuper, r.rolbypassrls
       FROM pg_roles r
      WHERE r.rolname = current_user`,
  );
  if (role.rows[0]?.rolsuper || role.rows[0]?.rolbypassrls) return true;
  const protectedTables = [...inventory.keys()];
  const ownership = await client.query(
    `SELECT c.relname, pg_get_userbyid(c.relowner) = current_user AS owned
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
    [protectedTables],
  );
  if (ownership.rows.length !== protectedTables.length || ownership.rows.some((row) => !row.owned)) {
    throw new Error('Capture role cannot prove full protected-table visibility');
  }
  return true;
}

async function assertClassifiedStoryForeignKeys(client, inventory) {
  const classified = new Set([
    ...DIRECT_SPECS.map(([table]) => table),
    ...V2_PROTECTED_STORY_RELATIONSHIPS.map(([table]) => table),
  ]);
  const result = await client.query(
    `SELECT DISTINCT source.relname AS table_name
       FROM pg_constraint fk
       JOIN pg_class source ON source.oid = fk.conrelid
       JOIN pg_namespace ns ON ns.oid = source.relnamespace
       JOIN pg_class target ON target.oid = fk.confrelid
      WHERE fk.contype = 'f' AND ns.nspname = 'public' AND target.relname = 'sf_stories'`,
  );
  const unclassified = result.rows.map((row) => row.table_name)
    .filter((table) => inventory.has(table) && table !== 'sf_stories' && !classified.has(table));
  if (unclassified.length) throw new Error(`Unclassified StoryForge story relationship: ${unclassified.sort().join(',')}`);
}

async function objectEvidence(rows, requireObjectHead, type, recordingSessions = []) {
  const entries = [];
  const sessionByAsset = new Map(recordingSessions
    .filter((row) => row.assembled_asset_id)
    .map((row) => [String(row.assembled_asset_id), row]));
  for (const row of rows.sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
    const required = row.state === 'verified';
    let exists = null;
    let actualSize = null;
    let resolvedObjectKeyHashes = [];
    if (required) {
      if (!requireObjectHead) throw new Error('Active permanent media requires --require-object-head');
      const objectKeys = type === 'story_audio'
        ? resolvedAudioObjectKeys({
          objectKey: row.object_key,
          contentType: row.content_type,
          assemblyExecutor: process.env.STORYFORGE_ASSEMBLY_EXECUTOR,
          segmentCount: sessionByAsset.get(String(row.id))?.segment_count,
        })
        : [row.object_key];
      const heads = [];
      for (const objectKey of objectKeys) heads.push(await headAudioObject({ objectKey }));
      exists = true;
      actualSize = heads.reduce((total, head) => total + Number(head.byteSize), 0);
      resolvedObjectKeyHashes = objectKeys.map((objectKey) => sha256(objectKey)).sort();
      if (actualSize !== Number(row.byte_size)) throw new Error(`Permanent media size mismatch for ${type}:${row.id}`);
    }
    entries.push([`${type}:${row.id}`, {
      rowHash: rowHash(row),
      objectKeyHash: sha256(row.object_key),
      recordedSize: row.byte_size == null ? null : Number(row.byte_size),
      required,
      exists,
      actualSize,
      resolvedObjectKeyHashes,
    }]);
  }
  return entries;
}

async function primaryKeyInventory(client) {
  const result = await client.query(
    `SELECT relation.relname AS table_name, attribute.attname AS column_name,
            key_column.ordinality
       FROM pg_constraint constraint_row
       JOIN pg_class relation ON relation.oid = constraint_row.conrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       JOIN unnest(constraint_row.conkey) WITH ORDINALITY AS key_column(attnum, ordinality)
         ON true
       JOIN pg_attribute attribute
         ON attribute.attrelid = relation.oid
        AND attribute.attnum = key_column.attnum
      WHERE constraint_row.contype = 'p'
        AND namespace.nspname = 'public'
        AND relation.relname LIKE 'sf\\_%' ESCAPE '\\'
      ORDER BY relation.relname, key_column.ordinality`,
  );
  const keys = new Map();
  for (const row of result.rows) {
    if (!keys.has(row.table_name)) keys.set(row.table_name, []);
    keys.get(row.table_name).push(row.column_name);
  }
  return keys;
}

async function protectedTableSummary(client, inventory, primaryKeys, table) {
  const columns = [...inventory.get(table)];
  const result = await client.query(
    `SELECT ${columns.map((column) => `"${column}"`).join(', ')} FROM public."${table}"`,
  );
  const keyColumns = primaryKeys.get(table) || [];
  const keyed = result.rows.map((row) => ({
    key: keyColumns.length
      ? sha256(canonicalJson(keyColumns.map((column) => row[column])))
      : null,
    hash: rowHash(row),
  }));
  if (!keyColumns.length) {
    keyed.sort((left, right) => left.hash.localeCompare(right.hash));
    keyed.forEach((item, index) => { item.key = sha256(canonicalJson([item.hash, index])); });
  }
  keyed.sort((left, right) => left.key.localeCompare(right.key));
  const summary = {
    columnNamesHash: sha256(canonicalJson(columns)),
    count: keyed.length,
    rows: Object.fromEntries(keyed.map((item) => [item.key, item.hash])),
  };
  if (table === 'sf_story_contributions') {
    const baseColumns = columns.filter((column) => !CONTRIBUTION_REVIEW_COLUMNS.includes(column));
    const addedColumnsPresent = CONTRIBUTION_REVIEW_COLUMNS.filter((column) => columns.includes(column));
    const baseKeyed = result.rows.map((row) => {
      const key = keyColumns.length
        ? sha256(canonicalJson(keyColumns.map((column) => row[column])))
        : null;
      const projected = Object.fromEntries(baseColumns.map((column) => [column, row[column]]));
      return { key, hash: rowHash(projected) };
    });
    if (!keyColumns.length) {
      baseKeyed.sort((left, right) => left.hash.localeCompare(right.hash));
      baseKeyed.forEach((item, index) => { item.key = sha256(canonicalJson([item.hash, index])); });
    }
    baseKeyed.sort((left, right) => left.key.localeCompare(right.key));
    summary.contributionReviewEvolution = {
      baseColumnNamesHash: sha256(canonicalJson(baseColumns)),
      addedColumnsPresent,
      baseRows: Object.fromEntries(baseKeyed.map((item) => [item.key, item.hash])),
      defaultsExact: result.rows.every((row) => (
        row.student_score == null
        && row.student_review_note == null
        && row.reviewed_at == null
        && (row.row_version == null || String(row.row_version) === '0')
      )),
    };
  }
  if (table === 'sf_users') {
    const baseColumns = columns.filter((column) => !ARENA_AVATAR_COLUMNS.includes(column));
    const addedColumnsPresent = ARENA_AVATAR_COLUMNS.filter((column) => columns.includes(column));
    const baseKeyed = result.rows.map((row) => {
      const key = keyColumns.length
        ? sha256(canonicalJson(keyColumns.map((column) => row[column])))
        : null;
      const projected = Object.fromEntries(baseColumns.map((column) => [column, row[column]]));
      return { key, hash: rowHash(projected) };
    });
    if (!keyColumns.length) {
      baseKeyed.sort((left, right) => left.hash.localeCompare(right.hash));
      baseKeyed.forEach((item, index) => { item.key = sha256(canonicalJson([item.hash, index])); });
    }
    baseKeyed.sort((left, right) => left.key.localeCompare(right.key));
    summary.arenaAvatarEvolution = {
      baseColumnNamesHash: sha256(canonicalJson(baseColumns)),
      addedColumnsPresent,
      baseRows: Object.fromEntries(baseKeyed.map((item) => [item.key, item.hash])),
      defaultsExact: result.rows.every((row) => (
        row.arena_avatar_id == null
        && row.arena_avatar_thumbnail_url == null
        && row.arena_avatar_synced_at == null
      )),
    };
  }
  return summary;
}

async function protectedTablesSummary(client, inventory) {
  const primaryKeys = await primaryKeyInventory(client);
  const tables = [...inventory.keys()]
    .filter((table) => !['sf_schema_migrations', 'sf_feature_flags'].includes(table))
    .sort();
  const summaries = {};
  for (const table of tables) {
    summaries[table] = await protectedTableSummary(client, inventory, primaryKeys, table);
  }
  return summaries;
}

async function featureFlagSummary(client, inventory) {
  if (!inventory.has('sf_feature_flags')) return { count: 0, rows: {} };
  const columns = [...inventory.get('sf_feature_flags')];
  const result = await client.query(
    `SELECT ${columns.map((column) => `"${column}"`).join(', ')} FROM public.sf_feature_flags ORDER BY key`,
  );
  return {
    count: result.rows.length,
    rows: Object.fromEntries(result.rows.map((row) => [String(row.key), {
      rowHash: rowHash(row),
      defaultOff: row.scope === 'off',
    }])),
  };
}

async function permanentObjectSummary(client, inventory, requireObjectHead) {
  const select = async (table, columns) => {
    if (!inventory.has(table)) return [];
    const selected = existingColumns(inventory, table, columns);
    return (await client.query(
      `SELECT ${selected.map((column) => `"${column}"`).join(', ')} FROM public."${table}"`,
    )).rows;
  };
  const recordingSessions = await select('sf_recording_sessions', [
    'id', 'assembled_asset_id', 'segment_count',
  ]);
  const entries = [
    ...await objectEvidence(await select('sf_audio_assets', [
      'id', 'object_key', 'content_type', 'byte_size', 'state',
    ]), requireObjectHead, 'story_audio', recordingSessions),
    ...await objectEvidence(await select('sf_mentor_note_media', [
      'id', 'object_key', 'content_type', 'byte_size', 'state',
    ]), requireObjectHead, 'mentor_audio'),
    ...await objectEvidence(await select('sf_story_media', [
      'id', 'object_key', 'mime_type', 'byte_size', 'state',
    ]).then((rows) => rows.map((row) => ({ ...row, content_type: row.mime_type }))), requireObjectHead, 'story_media'),
    ...await objectEvidence(await select('sf_contribution_audio_assets', [
      'id', 'object_key', 'content_type', 'byte_size', 'state',
    ]), requireObjectHead, 'contribution_audio'),
  ].sort(([left], [right]) => left.localeCompare(right));
  return { count: entries.length, rows: Object.fromEntries(entries) };
}

function storyCore(story) {
  return {
    titleHash: sha256(story.title),
    originalTextHash: sha256(story.original_text),
    workingHash: sha256(story.current_text),
    lessonHash: sha256(story.lesson),
    captureType: story.capture_type,
    status: story.status,
    studentScore: story.student_score,
    mentorScore: story.mentor_score,
    classification: story.classification,
    starred: story.starred,
    needsFollowup: story.needs_followup,
    revisionNo: story.revision_no,
    legacyStatus: story.legacy_status_at_b1_503,
    prefixEnabled: story.prefix_enabled,
    studentStar: story.student_star,
    mentorStar: story.mentor_star,
    revised: story.revised,
    rowVersion: story.row_version,
    categories: sortedSetHash(story.categories || []),
    intendedUses: sortedSetHash(story.uses || []),
    themes: sortedSetHash(story.themes || []),
    birds: sortedSetHash(story.birds || []),
    positions: sortedSetHash(story.positions || []),
    timestamps: {
      openedAt: story.opened_at, createdAt: story.created_at, updatedAt: story.updated_at,
      studentUpdatedAt: story.student_updated_at, statusChangedAt: story.status_changed_at,
      feedbackSentAt: story.feedback_sent_at, feedbackOpenedAt: story.feedback_opened_at,
      studentRespondedAt: story.student_responded_at, archivedAt: story.archived_at,
    },
    archivedBy: story.archived_by,
  };
}

async function buildStory(client, inventory, story, requireObjectHead) {
  const raw = {};
  const children = {};
  for (const [table, link, keys, columns] of DIRECT_SPECS) {
    raw[table] = await selectDirect(client, inventory, table, link, columns, story.id);
    children[table] = childSummary(raw[table], { key: (row) => rowKey(row, keys) });
  }
  for (const [table, keys, columns, link, parentTable] of NESTED_SPECS) {
    raw[table] = await selectNested(client, inventory, table, columns, link, raw[parentTable] || []);
    children[table] = childSummary(raw[table], { key: (row) => rowKey(row, keys) });
  }
  if (inventory.has('sf_audio_deletion_intents')) {
    const columns = ['id', 'run_id', 'object_key', 'category', 'student_ref', 'story_ref', 'ref_state', 'state', 'attempts', 'resolved_at', 'created_at', 'updated_at'];
    raw.sf_audio_deletion_intents = await selectDirect(client, inventory, 'sf_audio_deletion_intents', 'story_ref', columns, story.id);
    children.sf_audio_deletion_intents = childSummary(raw.sf_audio_deletion_intents);
  }

  const transcriptRows = [];
  for (const row of raw.sf_story_originals || []) transcriptRows.push({ id: `original:${row.story_id}`, hash: sha256(row.original_transcript) });
  for (const row of raw.sf_recording_segments || []) transcriptRows.push({ id: `segment:${row.id}`, hash: sha256(row.transcript) });
  for (const row of raw.sf_mentor_note_media || []) transcriptRows.push({ id: `mentor:${row.id}`, hash: sha256(row.transcript) });
  transcriptRows.sort((left, right) => left.id.localeCompare(right.id));

  const objectEntries = [
    ...await objectEvidence(
      raw.sf_audio_assets || [],
      requireObjectHead,
      'story_audio',
      raw.sf_recording_sessions || [],
    ),
    ...await objectEvidence(raw.sf_mentor_note_media || [], requireObjectHead, 'mentor_audio'),
    ...await objectEvidence(raw.sf_story_media || [], requireObjectHead, 'story_media'),
  ].sort(([left], [right]) => left.localeCompare(right));
  return {
    owner: { studentId: story.student_id, wpBindingHash: sha256(story.wp_user_id) },
    core: storyCore(story),
    visibility: { columnPresent: inventory.get('sf_stories').has('visibility'), value: story.visibility ?? null },
    review: {
      reviewedBy: story.reviewed_by, reviewSuitability: story.review_suitability,
      suitabilityReviewedBy: story.suitability_reviewed_by, suitabilityReviewedAt: story.suitability_reviewed_at,
      reviewedAt: story.reviewed_at, approvedAt: story.approved_at,
    },
    submission: { submittedAt: story.submitted_at, lastSubmittedAt: story.last_submitted_at },
    transcripts: childSummary(transcriptRows, { key: (row) => row.id }),
    audio: { count: objectEntries.length, rows: Object.fromEntries(objectEntries) },
    children,
  };
}

async function globalSummary(client, inventory, table, keyColumns) {
  if (!inventory.has(table)) return { count: 0, idsHash: sha256(canonicalJson([])) };
  const columns = existingColumns(inventory, table, keyColumns);
  const result = await client.query(`SELECT ${columns.map((column) => `"${column}"`).join(', ')} FROM public."${table}"`);
  const ids = result.rows.map((row) => rowKey(row, columns)).sort();
  return { count: ids.length, idsHash: sha256(canonicalJson(ids)) };
}

async function ledgerSummary(client, inventory) {
  if (!inventory.has('sf_schema_migrations')) return { count: 0, rows: {} };
  const result = await client.query('SELECT version::text, file_name, sha256 FROM public.sf_schema_migrations ORDER BY version');
  return {
    count: result.rows.length,
    rows: Object.fromEntries(result.rows.map((row) => [row.version, rowHash(row)])),
  };
}

async function capture(args) {
  const connectionString = String(process.env.STORYFORGE_SURVIVAL_DATABASE_URL || '').trim();
  if (!connectionString) throw new Error('STORYFORGE_SURVIVAL_DATABASE_URL is required');
  if (!['pre', 'post'].includes(args.phase)) throw new Error('--phase must be pre or post');
  if (!args.release || !args['candidate-sha256']) throw new Error('--release and --candidate-sha256 are required');
  const client = new Client({ connectionString });
  await client.connect();
  let manifest;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY DEFERRABLE');
    await client.query("SET LOCAL row_security = off; SET LOCAL TIME ZONE 'UTC'; SET LOCAL statement_timeout = '60s'; SET LOCAL lock_timeout = '5s'");
    const inventory = await schemaInventory(client);
    if (!inventory.has('sf_stories') || !inventory.has('sf_users')) throw new Error('StoryForge canonical tables are missing');
    await assertFullVisibility(client, inventory);
    await assertClassifiedStoryForeignKeys(client, inventory);
    const selected = existingColumns(inventory, 'sf_stories', STORY_COLUMNS);
    const visibility = inventory.get('sf_stories').has('visibility') ? 'story.visibility' : 'NULL::text AS visibility';
    const storiesResult = await client.query(
      `SELECT ${selected.map((column) => `story."${column}"`).join(', ')}, ${visibility}, owner.wp_user_id::text
         FROM public.sf_stories story
         JOIN public.sf_users owner ON owner.id = story.student_id
        ORDER BY story.id`,
    );
    const stories = {};
    for (const story of storiesResult.rows) stories[story.id] = await buildStory(client, inventory, story, Boolean(args.requireObjectHead));
    const global = {};
    for (const [table, keyColumns] of GLOBAL_SPECS) global[table] = await globalSummary(client, inventory, table, keyColumns);
    const system = await client.query('SELECT system_identifier::text FROM pg_control_system()');
    manifest = {
      schema: SURVIVAL_SCHEMA,
      capture: {
        phase: args.phase,
        release: args.release,
        candidateSha256: args['candidate-sha256'],
        generatedAt: new Date().toISOString(),
        databaseSystemHash: sha256(system.rows[0].system_identifier),
        fullVisibility: true,
        objectVerification: args.requireObjectHead ? 'required_pass' : 'test_only_not_requested',
      },
      global,
      protectedTables: await protectedTablesSummary(client, inventory),
      featureFlags: await featureFlagSummary(client, inventory),
      permanentObjects: await permanentObjectSummary(
        client,
        inventory,
        Boolean(args.requireObjectHead),
      ),
      ledger: await ledgerSummary(client, inventory),
      stories,
    };
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
  await writeProtected(args.output, manifest);
}

function parseLedgerAdditions(values) {
  return (values || []).map((value) => {
    const split = value.indexOf(':');
    if (split < 1) throw new Error('--expected-ledger-addition must be VERSION:ROW_HASH');
    return [value.slice(0, split), value.slice(split + 1)];
  });
}

function parseHashAdditions(values, optionName) {
  return (values || []).map((value) => {
    const split = value.indexOf(':');
    if (split < 1 || !/^[a-f0-9]{64}$/.test(value.slice(split + 1))) {
      throw new Error(`${optionName} must be KEY:ROW_HASH`);
    }
    return [value.slice(0, split), value.slice(split + 1)];
  });
}

function parseTableAdditions(values) {
  return (values || []).map((value) => {
    if (!/^sf_[a-z0-9_]+$/.test(value)
        || ['sf_schema_migrations', 'sf_feature_flags'].includes(value)) {
      throw new Error('--expected-table-addition must name a candidate sf_* data table');
    }
    return value;
  });
}

function parsePopulatedTableAdditions(values) {
  const additions = parseHashAdditions(values, '--expected-populated-table-addition');
  for (const [table] of additions) {
    if (!/^sf_[a-z0-9_]+$/.test(table)
        || ['sf_schema_migrations', 'sf_feature_flags'].includes(table)) {
      throw new Error('--expected-populated-table-addition must name a candidate sf_* data table');
    }
  }
  return additions;
}

async function compare(args) {
  if (!args.pre || !args.post) throw new Error('--pre and --post are required');
  const before = JSON.parse(await readFile(path.resolve(args.pre), 'utf8'));
  const after = JSON.parse(await readFile(path.resolve(args.post), 'utf8'));
  const report = safeDifferenceReport(compareSurvivalManifests(before, after, {
    expectedLedgerAdditions: parseLedgerAdditions(args.expectedLedgerAddition),
    expectedTableAdditions: parseTableAdditions(args.expectedTableAddition),
    expectedPopulatedTableAdditions: parsePopulatedTableAdditions(
      args.expectedPopulatedTableAddition,
    ),
    expectedFeatureFlagAdditions: parseHashAdditions(
      args.expectedFeatureFlagAddition,
      '--expected-feature-flag-addition',
    ),
    expectedContributionReviewColumns: Boolean(args.expectedContributionReviewColumns),
    expectedArenaAvatarColumns: Boolean(args.expectedArenaAvatarColumns),
  }));
  if (args.output) await writeProtected(args.output, report);
  process.stdout.write(report.pass ? 'PASS STORYFORGE_V1_SURVIVAL\n' : `FAIL STORYFORGE_V1_SURVIVAL differences=${report.differenceCount}\n`);
  if (!report.pass) process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'capture') return capture(args);
  if (args.command === 'compare') return compare(args);
  throw new Error('Use capture or compare.');
}

main().catch((error) => {
  process.stderr.write(`StoryForge survival gate failed: ${error.message}\n`);
  process.exitCode = 1;
});
