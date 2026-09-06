import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CORE_ENTITY_TYPES, OPERATIONAL_ENTITY_TYPES } from '../src/contracts.mjs';

const migrationPath = new URL('../db/migrations/0001_i1q_question_platform.sql', import.meta.url);

test('candidate migration defines every architecture and operational entity', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const table of [...CORE_ENTITY_TYPES, ...OPERATIONAL_ENTITY_TYPES]) {
    assert.match(sql, new RegExp(`create table if not exists i1q\\.${table}\\s*\\(`, 'i'), `missing ${table}`);
  }
});

test('candidate migration defaults feature flags off and forces RLS', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /'flag_student_release', 'student_release_enabled', false/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /No client grants are made/);
  assert.doesNotMatch(sql, /grant\s+all/iu);
});

test('published history tables reject update and delete', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const table of ['item_revisions', 'review_events', 'release_snapshots', 'release_promotion_records', 'channel_artifacts', 'audit_events']) {
    assert.match(sql, new RegExp(`before update or delete on i1q\\.${table}`, 'i'));
  }
});
