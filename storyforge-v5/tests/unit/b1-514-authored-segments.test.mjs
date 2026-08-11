import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = path.join(
  packageRoot,
  'infra/postgres/migrations/20260810250000_b1_514_v21_authored_segment_writes.sql',
);
const sql = fs.readFileSync(migrationPath, 'utf8');

test('full-story typed provenance is prospective and bound to student revisions', () => {
  assert.match(sql, /AFTER INSERT ON public\.sf_story_revisions/);
  assert.match(sql, /NEW\.actor_id <> v_story\.student_id/);
  assert.match(sql, /'student_typed', 'story', NEW\.story_id/);
  assert.match(sql, /capture_type = 'audio'.*'student_edit'.*'resubmit'/s);
  assert.doesNotMatch(sql, /INSERT INTO public\.sf_authored_segments[\s\S]*SELECT[\s\S]*FROM public\.sf_story_revisions/);
});

test('spoken provenance is recorded only by the canonical attached transition', () => {
  assert.match(sql, /NEW\.state <> 'attached'/);
  assert.match(sql, /OLD\.state = 'attached'/);
  assert.match(sql, /NEW\.assembled_asset_id IS NULL/);
  assert.match(sql, /'student_spoken', 'story', v_story\.id/);
  assert.match(sql, /NEW\.id, NEW\.assembled_asset_id, NEW\.student_id/);
});

test('mentor provenance is student-facing published content only', () => {
  assert.match(sql, /NEW\.state = 'published'/);
  assert.match(sql, /OLD\.state = 'draft'/);
  assert.match(sql, /NOT NEW\.internal_only/);
  assert.match(sql, /'mentor_content', 'mentor_note', NEW\.id/);
});
