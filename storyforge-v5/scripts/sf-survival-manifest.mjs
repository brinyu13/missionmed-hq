#!/usr/bin/env node
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';
import { headAudioObject } from '../server/storage.mjs';
import {
  SURVIVAL_SCHEMA,
  canonicalJson,
  childSummary,
  compareSurvivalManifests,
  rowHash,
  safeDifferenceReport,
  sha256,
  sortedSetHash,
} from './survival-manifest-lib.mjs';

const { Client } = pg;
const webRoots = ['public', 'dist'].map((name) => path.resolve(new URL(`../${name}/`, import.meta.url).pathname));
const childTables = Object.freeze([
  ['sf_story_revisions', 'story_id'],
  ['sf_story_reflections', 'story_id'],
  ['sf_feedback', 'story_id'],
  ['sf_story_internal_notes', 'story_id'],
  ['sf_mentor_notes', 'story_id'],
  ['sf_mentor_note_media', 'story_id'],
  ['sf_story_media', 'story_id'],
  ['sf_recording_sessions', 'story_id'],
  ['sf_story_questions', 'story_id'],
  ['sf_use_suggestions', 'story_id'],
  ['sf_audit_events', 'story_id'],
  ['sf_story_versions', 'story_id'],
]);
const globalTables = Object.freeze([
  'sf_users',
  'sf_stories',
  'sf_story_revisions',
  'sf_feedback',
  'sf_audit_events',
  'sf_audio_assets',
  'sf_story_reflections',
  'sf_recording_sessions',
  'sf_recording_segments',
  'sf_mentor_notes',
  'sf_mentor_note_media',
  'sf_story_media',
]);

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const values = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    if (key === '--verify-objects') values.verifyObjects = true;
    else values[key.slice(2)] = rest[++index];
  }
  return values;
}

function assertProtectedOutput(filePath) {
  if (!filePath) throw new Error('--output is required');
  const resolved = path.resolve(filePath);
  if (webRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error('Survival evidence must remain outside StoryForge web roots.');
  }
  return resolved;
}

async function writeProtected(filePath, value) {
  const resolved = assertProtectedOutput(filePath);
  await writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await chmod(resolved, 0o600);
}

async function schemaInventory(client) {
  const result = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name LIKE 'sf\\_%' ESCAPE '\\'
      ORDER BY table_name, ordinal_position`,
  );
  const inventory = new Map();
  for (const row of result.rows) {
    if (!inventory.has(row.table_name)) inventory.set(row.table_name, new Set());
    inventory.get(row.table_name).add(row.column_name);
  }
  return inventory;
}

function has(inventory, table, column) {
  return inventory.get(table)?.has(column) === true;
}

async function rowsForStory(client, inventory, table, linkColumn, storyId) {
  if (!has(inventory, table, linkColumn)) return [];
  const result = await client.query(`SELECT * FROM public.${table} WHERE ${linkColumn} = $1 ORDER BY 1`, [storyId]);
  return result.rows;
}

async function segmentRows(client, inventory, recordingRows) {
  if (!has(inventory, 'sf_recording_segments', 'session_id') || recordingRows.length === 0) return [];
  const ids = recordingRows.map((row) => row.id);
  const result = await client.query('SELECT * FROM public.sf_recording_segments WHERE session_id = ANY($1::uuid[]) ORDER BY session_id, seq, id', [ids]);
  return result.rows;
}

async function objectEvidence(rows, verifyObjects) {
  const evidence = [];
  for (const row of rows.sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
    let exists = null;
    let actualSize = null;
    if (verifyObjects && row.object_key) {
      try {
        const head = await headAudioObject({ objectKey: row.object_key });
        exists = true;
        actualSize = head.byteSize;
      } catch (error) {
        exists = false;
        actualSize = null;
      }
    }
    evidence.push({
      id: row.id,
      objectKeyHash: sha256(row.object_key),
      recordedSize: row.byte_size == null ? null : Number(row.byte_size),
      exists,
      actualSize,
      state: row.state ?? null,
    });
  }
  return evidence;
}

function reviewFields(story) {
  return {
    status: story.status ?? null,
    reviewedBy: story.reviewed_by ?? null,
    reviewSuitability: story.review_suitability ?? null,
    suitabilityReviewedBy: story.suitability_reviewed_by ?? null,
    mentorScore: story.mentor_score ?? null,
    statusChangedAt: story.status_changed_at ?? null,
    reviewedAt: story.reviewed_at ?? null,
    approvedAt: story.approved_at ?? null,
  };
}

async function buildStory(client, inventory, story, verifyObjects) {
  const children = {};
  const rawRows = {};
  for (const [table, link] of childTables) {
    const rows = await rowsForStory(client, inventory, table, link, story.id);
    rawRows[table] = rows;
    children[table] = childSummary(rows, { idKey: table === 'sf_story_questions' ? 'question_id' : 'id' });
  }
  const recordings = rawRows.sf_recording_sessions || [];
  const segments = await segmentRows(client, inventory, recordings);
  children.sf_recording_segments = childSummary(segments);
  const originals = await rowsForStory(client, inventory, 'sf_story_originals', 'story_id', story.id);
  children.sf_story_originals = childSummary(originals, { idKey: 'story_id' });
  const audioRows = await rowsForStory(client, inventory, 'sf_audio_assets', 'story_id', story.id);
  const permanentAudio = audioRows.filter((row) => ['verified', 'retired'].includes(row.state));
  const mentorMedia = (rawRows.sf_mentor_note_media || []).filter((row) => ['verified', 'retired'].includes(row.state));
  const storyMedia = (rawRows.sf_story_media || []).filter((row) => ['verified', 'delete_pending', 'deleted'].includes(row.state));
  const audioAssets = await objectEvidence([...permanentAudio, ...mentorMedia, ...storyMedia], verifyObjects);
  const transcriptRecords = [
    ...originals.map((row) => ({ id: `original:${row.story_id}`, hash: sha256(row.original_transcript) })),
    ...segments.map((row) => ({ id: `segment:${row.id}`, hash: sha256(row.transcript) })),
    ...mentorMedia.map((row) => ({ id: `mentor:${row.id}`, hash: sha256(row.transcript) })),
  ].sort((left, right) => left.id.localeCompare(right.id));
  return {
    ownerId: story.student_id,
    ownerWordPressBindingHash: sha256(story.wp_user_id),
    titleHash: sha256(story.title),
    originalHash: sha256(originals[0]?.original_transcript ?? story.original_text),
    workingHash: sha256(story.current_text),
    lessonHash: sha256(story.lesson),
    studentPriority: story.student_score ?? null,
    categories: sortedSetHash(story.categories ?? story.themes ?? []),
    intendedUses: sortedSetHash(story.uses ?? []),
    review: reviewFields(story),
    visibility: Object.hasOwn(story, 'visibility') ? story.visibility : null,
    submission: {
      submittedAt: story.submitted_at ?? null,
      lastSubmittedAt: story.last_submitted_at ?? null,
    },
    timestamps: {
      createdAt: story.created_at ?? null,
      updatedAt: story.updated_at ?? null,
      studentUpdatedAt: story.student_updated_at ?? null,
      feedbackSentAt: story.feedback_sent_at ?? null,
      feedbackOpenedAt: story.feedback_opened_at ?? null,
      studentRespondedAt: story.student_responded_at ?? null,
    },
    rowVersion: story.row_version == null ? null : String(story.row_version),
    transcripts: { count: transcriptRecords.length, hash: rowHash(transcriptRecords) },
    audioAssets: { count: audioAssets.length, hash: rowHash(audioAssets), items: audioAssets },
    children,
  };
}

async function capture({ output, verifyObjects }) {
  const connectionString = String(process.env.STORYFORGE_SURVIVAL_DATABASE_URL || process.env.STORYFORGE_DATABASE_URL || '').trim();
  if (!connectionString) throw new Error('STORYFORGE_SURVIVAL_DATABASE_URL is required');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const inventory = await schemaInventory(client);
    if (!inventory.has('sf_stories') || !inventory.has('sf_users')) throw new Error('StoryForge canonical tables are missing');
    const storyResult = await client.query(
      `SELECT story.*, owner.wp_user_id
         FROM public.sf_stories story
         JOIN public.sf_users owner ON owner.id = story.student_id
        ORDER BY story.id`,
    );
    const stories = {};
    for (const story of storyResult.rows) stories[story.id] = await buildStory(client, inventory, story, Boolean(verifyObjects));
    const globals = {};
    for (const table of globalTables.filter((name) => inventory.has(name))) {
      const count = await client.query(`SELECT count(*)::text AS count FROM public.${table}`);
      globals[table] = count.rows[0].count;
    }
    const ledger = inventory.has('sf_schema_migrations')
      ? (await client.query('SELECT * FROM public.sf_schema_migrations ORDER BY 1')).rows
      : [];
    const manifest = {
      schema: SURVIVAL_SCHEMA,
      generatedAt: new Date().toISOString(),
      databaseIdentityHash: sha256((await client.query('SELECT current_database() AS name')).rows[0].name),
      objectVerification: verifyObjects ? 'r2_head' : 'not_requested',
      ledgerHash: rowHash(ledger),
      globals,
      stories,
    };
    await client.query('COMMIT');
    await writeProtected(output, manifest);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function compare({ pre, post, output }) {
  if (!pre || !post) throw new Error('--pre and --post are required');
  const before = JSON.parse(await readFile(path.resolve(pre), 'utf8'));
  const after = JSON.parse(await readFile(path.resolve(post), 'utf8'));
  const report = safeDifferenceReport(compareSurvivalManifests(before, after));
  if (output) await writeProtected(output, report);
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
