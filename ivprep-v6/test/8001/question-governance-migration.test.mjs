import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260920154000_ivoc_question_governance_fail_fast.sql',
  import.meta.url,
);

test('question version conflicts fail fast instead of requesting a transaction retry', async () => {
  const migration = await readFile(migrationUrl, 'utf8');
  const conflictRaises = migration.match(
    /raise exception 'ivoc_question_version_conflict' using errcode = '([^']+)'/gu,
  ) || [];

  assert.equal(conflictRaises.length, 2);
  assert.ok(conflictRaises.every((statement) => statement.endsWith("errcode = 'P0001'")));
  assert.doesNotMatch(migration, /ivoc_question_version_conflict' using errcode = '40001'/u);
  assert.match(migration, /ivoc_question_retired' using errcode = '22023'/u);
  assert.match(migration, /grant execute on function public\.ivoc_write_question_version/u);
});
